using System.Collections.Generic;
using System.Linq;
using Hollowmere.Core;
using UnityEngine;

namespace Hollowmere
{
    public sealed class HeroActor : Actor
    {
        public static HeroActor I;

        public GameState State => GameManager.I.State;
        public Hero Hero => State.hero;
        public StatBlock stats;
        public float resource, maxResource;
        public Vector3 aim = Vector3.forward;
        public Actor target;              // current auto-target (shown on the HUD)
        public bool attackHeld;
        public Vector2 moveInput;
        public bool busy;                 // fishing / channelling: no movement
        public readonly Dictionary<string, float> cooldownUntil = new Dictionary<string, float>();

        readonly List<(Stat stat, float value, float until, string id)> skillBuffs = new List<(Stat, float, float, string)>();
        readonly Combat.Context ctx = new Combat.Context();
        readonly Rng rng = new Rng();
        Transform hand, figure;
        float nextAttack, potionUntil, potionHeal, potionCd, swing, combatTimer, spinUntil, spinTick;
        SkillCast spinCast;
        float regenAcc;

        public static HeroActor Spawn(Vector3 at)
        {
            var go = new GameObject("Hero");
            go.transform.position = at;
            var h = go.AddComponent<HeroActor>();
            h.team = Team.Hero;
            h.SetupController(0.45f, 1.8f);
            h.BuildBody();
            h.RefreshStats(true);
            I = h;
            return h;
        }

        void BuildBody()
        {
            var b = new GameObject("body").transform;
            b.SetParent(transform, false);
            body = b;
            var model = Art.Model(Art.HeroModelKey(Hero.heroClass), 1.8f, b);
            if (model != null) { figure = model.transform; hand = new GameObject("hand").transform; hand.SetParent(figure, false); hand.localPosition = new Vector3(0.45f, 0.9f, 0.2f); }
            else figure = Art.Humanoid(b, Art.ClassColor(Hero.heroClass), Art.ClassColor(Hero.heroClass) * 0.6f + Color.gray * 0.3f, 1.8f, out hand).transform;
            RefreshWeapon();
            // A torch-light that follows the hero keeps dark floors readable on small screens.
            var l = new GameObject("heroLight").AddComponent<Light>();
            l.transform.SetParent(transform, false);
            l.transform.localPosition = new Vector3(0, 4, 0);
            l.type = LightType.Point; l.range = 14; l.intensity = 1.2f; l.color = new Color(1f, 0.9f, 0.75f);
        }

        public void RefreshWeapon()
        {
            var w = Hero.Equipped(EquipSlot.MainHand);
            if (hand != null) Art.Weapon(hand, w?.baseId ?? "sword", w != null ? Art.Rarity(w.rarity) : Color.gray);
        }

        public void RefreshStats(bool fill = false)
        {
            float frac = maxLife > 0 ? life / maxLife : 1;
            stats = State.Stats();
            foreach (var b in skillBuffs) stats.Add(b.stat, b.value);
            maxLife = Hero.MaxLife(stats);
            life = fill ? maxLife : Mathf.Clamp(frac * maxLife, 1, maxLife);
            maxResource = stats[Stat.MaxResource];
            if (fill) resource = Hero.heroClass == HeroClass.Ironclad ? 0 : maxResource;
            resource = Mathf.Min(resource, maxResource);
            ctx.hero = Hero; ctx.stats = stats;
        }

        public override int Level => Hero.level;
        public float MoveSpeed => 6f * (1 + Mathf.Min(stats[Stat.MoveSpeed], 50) / 100f) * SpeedMult;

        protected override void Update()
        {
            base.Update();
            if (Dead || GameManager.I.Paused) return;
            float dt = Time.deltaTime;
            ctx.lifeFraction = LifeFraction;

            // ---- skill buffs expire
            if (skillBuffs.RemoveAll(b => Time.time > b.until) > 0) RefreshStats();

            // ---- regen
            regenAcc += dt;
            if (regenAcc >= 0.25f)
            {
                float k = regenAcc; regenAcc = 0;
                Heal(stats[Stat.LifePerSecond] * k);
                if (potionUntil > Time.time) Heal(potionHeal * k);
                var form = State.pet.Form;
                if (form != null && form.healPerSecondPct > 0 && !State.pet.Away) Heal(maxLife * form.healPerSecondPct * k);
                if (Hero.heroClass == HeroClass.Ironclad)
                {
                    if (combatTimer <= 0) resource = Mathf.Max(0, resource - 3 * k);
                }
                else resource = Mathf.Min(maxResource, resource + stats[Stat.ResourceRegen] * k);
                if (Hero.heroClass == HeroClass.Ironclad) resource = Mathf.Min(maxResource, resource + stats[Stat.ResourceRegen] * k);
            }
            combatTimer -= dt;
            potionCd -= dt;

            // ---- spin (Whirling Steel) ticks while moving
            if (spinUntil > Time.time)
            {
                figure.Rotate(0, 1080 * dt, 0, Space.Self);
                if ((spinTick -= dt) <= 0)
                {
                    spinTick = 0.33f;
                    var hits = InRadius(Team.Hero, Pos, spinCast.radius);
                    foreach (var a in hits) SkillRunner.HitEnemy(this, spinCast, a, 0.33f);
                    SkillRunner.OnHits(this, spinCast, hits.Count);
                }
            }
            else if (figure != null) figure.localRotation = Quaternion.Slerp(figure.localRotation, Quaternion.identity, dt * 12);

            // ---- movement
            if (!busy && !Stunned)
            {
                var input = new Vector3(moveInput.x, 0, moveInput.y);
                // Camera looks along +Z rotated; map joystick to camera-relative directions.
                var cam = CameraRig.Yaw;
                input = Quaternion.Euler(0, cam, 0) * input;
                if (input.sqrMagnitude > 0.01f)
                {
                    Move(input * MoveSpeed * dt);
                    if (spinUntil <= Time.time) Face(input);
                    aim = input.normalized;
                }
            }

            // ---- auto-target and primary attack
            target = PickTarget();
            if (attackHeld && !busy && !Stunned && !GameManager.I.InTown && Time.time >= nextAttack)
            {
                var primary = SkillDb.Get(Hero.skills.bar[0]);
                if (primary != null) UseSkill(primary);
            }

            // ---- swing animation
            if (swing > 0 && hand != null)
            {
                swing -= dt * 4;
                hand.localRotation = Quaternion.Euler(Mathf.Sin(Mathf.Clamp01(swing) * Mathf.PI) * -110, 0, 0);
            }

            // ---- pickups
            Pickup.Collect(this, stats[Stat.PickupRadius]);
        }

        Actor PickTarget()
        {
            float range = 14f;
            if (target != null && target.Targetable && (target.Pos - Pos).sqrMagnitude < range * range) return target;
            return Nearest(Team.Hero, Pos, range);
        }

        public float CooldownLeft(string id) => cooldownUntil.TryGetValue(id, out var t) ? Mathf.Max(0, t - Time.time) : 0;

        public bool UseSkillSlot(int slot)
        {
            var s = SkillDb.Get(Hero.skills.bar[slot]);
            return s != null && UseSkill(s);
        }

        public bool UseSkill(SkillDef s)
        {
            if (Dead || busy || Stunned || GameManager.I.Paused || Hero.skills.Rank(s.id) == 0) return false;
            if (CooldownLeft(s.id) > 0) return false;
            if (GameManager.I.InTown && s.shape != SkillShape.Dash) { GameManager.I.Toast("Not in town."); return false; }
            var cast = SkillDb.Resolve(s, Hero, stats);
            if (resource < cast.cost) { GameManager.I.Toast($"Not enough {StatInfo.ResourceName(Hero.heroClass)}"); return false; }
            resource -= cast.cost;
            if (cast.cooldown > 0) cooldownUntil[s.id] = Time.time + cast.cooldown;
            if (s.primary)
            {
                var (_, _, aps) = Hero.WeaponDamage(stats);
                nextAttack = Time.time + 1f / Mathf.Max(0.3f, aps);
            }
            else nextAttack = Mathf.Max(nextAttack, Time.time + 0.25f);

            Vector3 dir = aim;
            if (target != null && s.shape != SkillShape.Dash) dir = (target.Pos - Pos).normalized;
            if (s.shape != SkillShape.Dash || dir.sqrMagnitude > 0) Face(dir);
            swing = 1;
            combatTimer = 4;
            SkillRunner.Execute(this, cast, dir, target);
            return true;
        }

        public void StartSpin(SkillCast c)
        {
            spinCast = c;
            spinUntil = Time.time + Mathf.Max(0.5f, c.duration);
            spinTick = 0;
        }

        public void AddSkillBuff(Stat stat, float value, float seconds, string id)
        {
            skillBuffs.RemoveAll(b => b.id == id && b.stat == stat);
            skillBuffs.Add((stat, value, Time.time + seconds, id));
            RefreshStats();
        }

        public bool HasBuff(string id) => skillBuffs.Any(b => b.id == id);

        public void Gain(float r) { resource = Mathf.Min(maxResource, resource + r); combatTimer = 4; }

        public Combat.Context Ctx { get { ctx.lifeFraction = LifeFraction; return ctx; } }
        public Rng Rng => rng;

        public bool DrinkPotion()
        {
            if (potionCd > 0 || Dead) return false;
            if (!Hero.Consume(ItemKind.Potion)) { GameManager.I.Toast("No potions"); return false; }
            potionCd = 5f;
            potionHeal = maxLife * 0.3f;   // 60% over 2s
            potionUntil = Time.time + 2f;
            Fx.Ring(Pos, 1.5f, new Color(1f, 0.3f, 0.3f));
            AudioHub.Play("sfx_gold", 0.4f);
            return true;
        }

        public float PotionCooldown => Mathf.Max(0, potionCd);

        /// <summary>A monster's swing or bolt lands.</summary>
        public void TakeMonsterHit(float raw, Element el, MonsterActor from, bool melee)
        {
            if (Dead) return;
            float extra = HasBuff("rn_warcry_iron") ? 0.3f : 0;
            var h = Combat.MonsterHit(raw, el, stats, from != null ? from.Level : Hero.level, rng, extra);
            if (h.blocked) Fx.Text(Pos, "Block", Color.white, 0.8f);
            TakeDamage(h, from);
            combatTimer = 4;
            if (melee && from != null && stats[Stat.Thorns] > 0)
                from.TakeDamage(new Hit { amount = stats[Stat.Thorns], element = Element.Physical }, this);
            if (from != null && from.stats.affixes.Contains(EliteAffix.Vampiric)) from.Heal(h.amount * 3);
        }

        protected override void Die(Actor killer)
        {
            Dead = true;
            spinUntil = 0;
            if (body != null) body.localRotation = Quaternion.Euler(80, 0, 0);
            GameManager.I.OnHeroDied();
        }

        public void Revive(float fraction)
        {
            Dead = false;
            if (body != null) body.localRotation = Quaternion.identity;
            RefreshStats();
            life = maxLife * fraction;
        }
    }
}
