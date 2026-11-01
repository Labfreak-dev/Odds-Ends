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
        ModelAnim modelAnim;
        float nextAttack, potionUntil, potionHeal, potionCd, combatTimer, spinUntil, spinTick;
        float releaseIn = -1f;
        SkillCast spinCast, pendingCast;
        Vector3 pendingDir;
        Actor pendingTarget;
        float regenAcc, deathLeft;
        readonly Locomotion loco = new Locomotion();
        float stepDebt;

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
            var model = Art.Animated(Art.HeroMesh(Hero), 1.8f, b);
            // A generated hero carries its own weapon, so no primitive weapon is attached (hand stays null).
            if (model != null)
            {
                figure = model.transform;
                modelAnim = model.GetComponent<ModelAnim>();
                if (Hero.classless) Art.PaintHero(model, Hero);
                Art.LogHeroBounds(model, Art.PlayMode());
            }
            else figure = Art.Humanoid(b, Art.ClassColor(Hero.PresentationClass), Art.ClassColor(Hero.PresentationClass) * 0.6f + Color.gray * 0.3f, 1.8f, out hand).transform;
            var ring = Hero.classless
                ? new Color(Mathf.Clamp01(Hero.armourR), Mathf.Clamp01(Hero.armourG), Mathf.Clamp01(Hero.armourB))
                : Art.ClassColor(Hero.heroClass);
            Art.GroundRing(transform, new Color(Mathf.Clamp01(ring.r + 0.45f), Mathf.Clamp01(ring.g + 0.25f), Mathf.Clamp01(ring.b + 0.45f)));
            // Fill from the camera side (default rig sits on -Z) so a dark robe still has an edge.
            var rim = new GameObject("rimLight").AddComponent<Light>();
            rim.transform.SetParent(transform, false);
            rim.transform.localPosition = new Vector3(0.35f, 1.45f, -1.35f);
            rim.type = LightType.Point;
            rim.range = 6.5f;
            bool town = Art.PlayMode() == "town";
            rim.intensity = town ? 8f : 6f;
            rim.color = new Color(0.9f, 0.82f, 1f);
            // Warm rim from behind the shoulders so the silhouette reads against the ground.
            var edge = new GameObject("heroRim").AddComponent<Light>();
            edge.transform.SetParent(transform, false);
            edge.transform.localPosition = new Vector3(-0.45f, 1.7f, 1.15f);
            edge.type = LightType.Point;
            edge.range = 5.5f;
            edge.intensity = town ? 8.5f : 5f;
            edge.color = town ? new Color(1f, 0.84f, 0.62f) : new Color(1f, 0.72f, 0.45f);
            RefreshWeapon();
            // Key light just above the hero. The town sun alone left the body in shade.
            var l = new GameObject("heroLight").AddComponent<Light>();
            l.transform.SetParent(transform, false);
            l.transform.localPosition = new Vector3(0.4f, 2.6f, -0.8f);
            l.type = LightType.Point; l.range = 9f; l.intensity = 4.5f; l.color = new Color(1f, 0.92f, 0.78f);
        }

        public void RefreshWeapon()
        {
            if (figure == null) return;
            if (Hero != null && Hero.classless) Art.PaintHero(figure.gameObject, Hero);
            GearAttach.Apply(figure, Hero);
            // Equipment changes are checked again as the gear mode. Town and dungeon
            // are checked inside Apply from the current floor.
            Art.LogHeroBounds(figure.gameObject, "gear");
        }

        public void BeginFishing()
        {
            if (figure != null) GearAttach.Rod(figure, true);
            PlayFishing("fish_idle", true);
        }

        public void PlayFishing(string clip, bool loop)
        {
            if (modelAnim == null) return;
            modelAnim.BeginAttack(true, loop ? 3600f : 2.4f, clip);
            if (loop) modelAnim.LoopSkill(3600f);
        }

        public void EndFishing()
        {
            if (modelAnim != null) modelAnim.CancelAttack();
            RefreshWeapon();
        }

        public void RefreshStats(bool fill = false)
        {
            float frac = maxLife > 0 ? life / maxLife : 1;
            stats = State.Stats();
            foreach (var b in skillBuffs) stats.Add(b.stat, b.value);
            maxLife = Hero.MaxLife(stats);
            life = fill ? maxLife : Mathf.Clamp(frac * maxLife, 1, maxLife);
            maxResource = stats[Stat.MaxResource];
            if (fill) resource = Hero.FuryStyle() ? 0 : maxResource;
            resource = Mathf.Min(resource, maxResource);
            ctx.hero = Hero; ctx.stats = stats;
        }

        public override int Level => Hero.level;
        public float MoveSpeed => 6f * (1 + Mathf.Min(stats[Stat.MoveSpeed], 50) / 100f) * SpeedMult;
        public float GroundSpeed => loco.groundSpeed;

        protected override void Update()
        {
            base.Update();
            if (Dead)
            {
                // The death screen pauses scaled time. The fall still has to play.
                if (deathLeft > 0f && modelAnim != null)
                {
                    float step = Time.unscaledDeltaTime;
                    deathLeft = Mathf.Max(0f, deathLeft - step);
                    modelAnim.Advance(step);
                }
                return;
            }
            if (GameManager.I.Paused) return;
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
                if (Hero.FuryStyle())
                {
                    if (combatTimer <= 0) resource = Mathf.Max(0, resource - 3 * k);
                }
                else resource = Mathf.Min(maxResource, resource + stats[Stat.ResourceRegen] * k);
                if (Hero.FuryStyle()) resource = Mathf.Min(maxResource, resource + stats[Stat.ResourceRegen] * k);
            }
            combatTimer -= dt;
            potionCd -= dt;
            if (CombatClock.Frozen) return;
            ReleaseCast(dt);

            // ---- spin (Whirling Steel) ticks while moving
            bool spinning = spinUntil > Time.time;
            bool clipSpin = modelAnim != null && modelAnim.PlayingSkill;
            if (spinning && figure != null && !clipSpin)
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

            // ---- movement: accelerate into the stick, turn toward it, report real ground speed
            Vector3 wishDir = Vector3.zero;
            float wish = 0f;
            if (!busy && !Stunned)
            {
                var input = new Vector3(moveInput.x, 0, moveInput.y);
                input = Quaternion.Euler(0, CameraRig.Yaw, 0) * input;
                if (input.sqrMagnitude > 0.02f)
                {
                    wishDir = input.normalized;
                    wish = MoveSpeed * Mathf.Clamp01(input.magnitude);
                    aim = wishDir;
                }
            }
            bool attacking = modelAnim != null && modelAnim.Attacking;
            var face = attacking ? aim : wishDir;
            loco.Step(this, wishDir, wish, dt, face, attacking, false, spinning);
            modelAnim?.Tick(loco.groundSpeed, dt);
            Footstep(attacking);

            // A missing attack clip eases a lean in and out. A real clip owns the body instead.
            if (!spinning && figure != null)
            {
                float k = 0f;
                bool cast = false;
                if (modelAnim != null && modelAnim.Attacking && !modelAnim.HasAttackClip)
                {
                    k = Mathf.Sin(modelAnim.AttackUnit * Mathf.PI);
                    cast = modelAnim.Casting;
                }
                var pos = cast ? new Vector3(0f, 0.04f * k, -0.12f * k) : new Vector3(0f, 0f, k * 0.35f);
                var rot = cast ? Quaternion.Euler(-24f * k, 32f * k, 0f) : Quaternion.identity;
                float blend = Mathf.Max(0.05f, Feel.Active.attackBlend);
                float t = 1f - Mathf.Exp(-dt / blend);
                figure.localPosition = Vector3.Lerp(figure.localPosition, pos, t);
                figure.localRotation = Quaternion.Slerp(figure.localRotation, rot, t);
                if (hand != null)
                    hand.localRotation = Quaternion.Slerp(hand.localRotation, Quaternion.Euler(k * -110f, 0f, 0f), t);
            }

            // ---- auto-target and primary attack
            target = PickTarget();
            if (attackHeld && !busy && !Stunned && !GameManager.I.InTown && Time.time >= nextAttack)
            {
                var primary = Hero.classless ? Hero.BasicAttack() : SkillDb.Get(Hero.skills.bar[0]);
                if (primary != null) UseSkill(primary);
            }

            // ---- pickups
            Pickup.Collect(this, stats[Stat.PickupRadius]);
        }

        /// <summary>The walk take is 1.067s with two plants. Distance, not a timer, keeps the boots on the feet.</summary>
        void Footstep(bool attacking)
        {
            if (attacking || loco.groundSpeed < Feel.Active.idle)
            {
                stepDebt = 0f;
                return;
            }
            stepDebt += loco.groundSpeed * Time.deltaTime;
            float stride = Feel.Active.clipWalk * 1.067f * 0.5f;
            if (stepDebt < stride) return;
            stepDebt = 0f;
            Sfx.Step(World.FootSurface(Pos));
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
            if (Dead || busy || Stunned || GameManager.I.Paused) return false;
            bool starter = Hero.classless && s.primary && s.family == Hero.AttackFamily();
            if (Hero.skills.Rank(s.id) == 0 && !starter) return false;
            if (Hero.classless && s.family != Hero.AttackFamily())
            {
                GameManager.I.Toast($"Needs a {s.family.ToString().ToLowerInvariant()} weapon.");
                return false;
            }
            if (releaseIn >= 0f || CombatClock.Frozen) return false;
            if (CooldownLeft(s.id) > 0) return false;
            if (GameManager.I.InTown && s.shape != SkillShape.Dash) { GameManager.I.Toast("Not in town."); return false; }
            var cast = SkillDb.Resolve(s, Hero, stats);
            if (resource < cast.cost) { GameManager.I.Toast($"Not enough {Hero.ResourceLabel()}"); return false; }
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
            if (dir.sqrMagnitude > 0.0001f) aim = dir.normalized;
            if (s.shape == SkillShape.Dash && dir.sqrMagnitude > 0.0001f) Face(dir);
            var timing = DesignTable.CastFor(DesignTable.CastKind(s.id));
            string clip = DesignTable.ClipFor(s.id);
            float seconds = (timing.Windup + timing.Strike + timing.Recover) / 1000f;
            if (!string.IsNullOrEmpty(clip) && DesignTable.TryTrim(clip, out int frameA, out int frameB, out _))
                seconds = (frameB - frameA) / 24f;
            modelAnim?.BeginAttack(s.shape != SkillShape.MeleeArc, seconds, clip);
            Sfx.Cast(this, s.id);
            SkillVfx.CastGlyph(this, s.id);
            pendingCast = cast;
            pendingDir = dir.sqrMagnitude > 0.0001f ? dir.normalized : transform.forward;
            pendingTarget = target;
            releaseIn = timing.Windup / 1000f;
            if (releaseIn <= 0f) releaseIn = 0.0001f;
            combatTimer = 4;
            return true;
        }

        void ReleaseCast(float dt)
        {
            if (releaseIn < 0f) return;
            releaseIn -= dt;
            if (releaseIn > 0f || pendingCast == null) return;
            releaseIn = -1f;
            if (Dead) return;
            var fired = pendingCast;
            pendingCast = null;
            SkillRunner.Execute(this, fired, pendingDir, pendingTarget);
            var shape = fired.skill.shape;
            if (shape == SkillShape.MeleeArc || shape == SkillShape.Projectile || fired.skill.id == "ic_whirl"
                || fired.skill.id == "ic_earthsplit" || fired.skill.id == "ic_slam")
                TrailHold.Arm(this, fired);
        }

        public void StartSpin(SkillCast c)
        {
            spinCast = c;
            spinUntil = Time.time + Mathf.Max(0.5f, c.duration);
            spinTick = 0;
            if (modelAnim != null && modelAnim.HasNamedSkill) modelAnim.LoopSkill(Mathf.Max(0.5f, c.duration));
            else modelAnim?.CancelAttack();
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
            potionCd = (float)DesignTable.PotionCooldownSeconds;
            CombatNumbers.Spawn(Pos, "+" + Mathf.RoundToInt(maxLife * (float)DesignTable.PotionHealFraction), "heal", Color.white);
            // The regen tick multiplies this by elapsed seconds, so the rate is the total heal divided by the window.
            potionHeal = maxLife * (float)(DesignTable.PotionHealFraction / DesignTable.PotionDurationSeconds);
            potionUntil = Time.time + (float)DesignTable.PotionDurationSeconds;
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
            else
            {
                CombatClock.Punch("hurt");
                AudioHub.Vary("player_hurt", 0.8f);
            }
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
            pendingCast = null;
            releaseIn = -1f;
            deathLeft = 0f;
            // The clip folds the skeleton. Tipping the body root left the gear in a T-pose.
            if (modelAnim != null && modelAnim.PlayClip("death", 1.45f)) deathLeft = 1.45f;
            else if (modelAnim != null) Debug.LogError("Hollowmere hero FAIL death clip missing");
            GameManager.I.OnHeroDied();
        }

        public void Revive(float fraction)
        {
            Dead = false;
            deathLeft = 0f;
            if (body != null) body.localRotation = Quaternion.identity;
            modelAnim?.CancelAttack();
            RefreshStats();
            life = maxLife * fraction;
        }
    }
}
