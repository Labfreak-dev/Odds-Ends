using System.Collections.Generic;
using Hollowmere.Core;
using UnityEngine;

namespace Hollowmere
{
    public sealed class MonsterActor : Actor
    {
        public MonsterStats stats;
        public int pack;
        public bool aggro;

        Actor foe;
        List<Int2> path;
        int pathIndex;
        float repath, nextAttack, windup, affixTimer, affixTimer2, shieldUntil, bossTimer, hazardTimer;
        int globeBits, bossPhase = 1;
        bool winding;
        ModelAnim modelAnim;
        Transform shield;
        readonly Locomotion loco = new Locomotion();
        static readonly Rng rng = new Rng();

        public override bool IsElite => stats.IsEliteish;
        public override int Level => stats.level;
        public override bool Targetable => base.Targetable && Time.time >= shieldUntil;

        public static MonsterActor Spawn(MonsterStats s, Vector3 at, int pack)
        {
            var go = new GameObject(s.displayName);
            go.transform.position = at;
            go.transform.rotation = Quaternion.Euler(0, Random.Range(0, 360), 0);
            var m = go.AddComponent<MonsterActor>();
            m.team = Team.Monster;
            m.stats = s;
            m.pack = pack;
            m.maxLife = m.life = s.maxLife;
            float scale = s.def.scale * (s.rank == MonsterRank.Elite ? 1.25f : s.rank == MonsterRank.Champion ? 1.15f : 1f);
            m.SetupController(0.4f * scale + (s.def.role == MonsterRole.Brute ? 0.3f : 0), 1.6f * scale);
            var b = new GameObject("body").transform;
            b.SetParent(go.transform, false);
            m.body = b;
            Art.MonsterBody(s.def, b, scale);
            m.modelAnim = b.GetComponentInChildren<ModelAnim>();
            if (m.modelAnim != null && !m.modelAnim.HasClips) m.modelAnim = null;
            if (s.rank == MonsterRank.Champion || s.rank == MonsterRank.Elite || s.rank == MonsterRank.Boss)
            {
                // Coloured halo under elites, like the glow champions get in the classics.
                var c = s.rank == MonsterRank.Champion ? new Color(0.3f, 0.5f, 1f) : s.rank == MonsterRank.Elite ? new Color(1f, 0.8f, 0.2f) : new Color(1f, 0.3f, 0.2f);
                Art.Cylinder(go.transform, new Vector3(0, 0.03f, 0), new Vector3(1.6f * scale, 0.01f, 1.6f * scale), Art.Mat(c, 1.2f));
            }
            if (s.rank == MonsterRank.Champion || s.rank == MonsterRank.Elite)
                EliteMark(go, b.gameObject, s, scale);
            m.affixTimer = Random.Range(2f, 5f);
            m.affixTimer2 = Random.Range(3f, 6f);
            m.bossTimer = 6f;
            return m;
        }

        static void EliteMark(GameObject go, GameObject body, MonsterStats s, float scale)
        {
            var tint = s.affixes.Count > 0
                ? AffixCatalog.Tint(s.affixes[0])
                : s.rank == MonsterRank.Champion ? new Color(0.35f, 0.55f, 1f) : new Color(1f, 0.82f, 0.25f);
            foreach (var r in body.GetComponentsInChildren<Renderer>(true))
            {
                if (r == null || r.gameObject.name == "label") continue;
                var mats = r.materials;
                for (int i = 0; i < mats.Length; i++)
                {
                    var mat = mats[i];
                    if (mat == null) continue;
                    if (mat.HasProperty("_BaseColor"))
                        mat.SetColor("_BaseColor", Color.Lerp(mat.GetColor("_BaseColor"), tint, 0.42f));
                    if (mat.HasProperty("_Color"))
                        mat.SetColor("_Color", Color.Lerp(mat.GetColor("_Color"), tint, 0.42f));
                    if (mat.HasProperty("_EmissionColor"))
                    {
                        mat.EnableKeyword("_EMISSION");
                        mat.SetColor("_EmissionColor", tint * 0.55f);
                    }
                }
            }
            var rim = new GameObject("eliteRim").AddComponent<Light>();
            rim.type = LightType.Point;
            rim.color = tint;
            rim.intensity = 1.6f;
            rim.range = 3.4f;
            rim.shadows = LightShadows.None;
            rim.transform.SetParent(go.transform, false);
            rim.transform.localPosition = new Vector3(0f, 1.3f * scale, 0f);
            string lines = s.displayName;
            if (s.affixes.Count > 0)
            {
                var names = new string[s.affixes.Count];
                for (int i = 0; i < names.Length; i++) names[i] = AffixCatalog.Label(s.affixes[i]);
                lines += "\n" + string.Join(" · ", names);
            }
            var ink = s.rank == MonsterRank.Champion ? new Color(0.75f, 0.86f, 1f) : new Color(1f, 0.9f, 0.45f);
            Fx.WorldLabel(go.transform, new Vector3(0f, 2.35f * scale, 0f), lines, ink, 42, 0.045f);
        }

        protected override void Update()
        {
            base.Update();
            if (Dead || GameManager.I.Paused || CombatClock.Frozen) return;
            float dt = Time.deltaTime;
            var hero = HeroActor.I;
            if (hero == null || hero.Dead) { Halt(dt); return; }

            if (!aggro)
            {
                float d = (hero.Pos - Pos).magnitude;
                if (d < stats.def.aggroRange && World.Sight(Pos, hero.Pos)) Aggro();
                else { Halt(dt); return; }
            }

            foe = ChooseFoe(hero);
            if (foe == null) return;
            if (Stunned) { Halt(dt); return; }
            Affixes(dt, hero);
            if (stats.rank == MonsterRank.Boss) BossMoves(dt, hero);

            var to = foe.Pos - Pos; to.y = 0;
            float dist = to.magnitude;
            float range = stats.def.attackRange + foe.radius;
            bool ranged = stats.def.role == MonsterRole.Ranged || stats.def.role == MonsterRole.Caster;

            if (winding)
            {
                windup -= dt;
                loco.Step(this, Vector3.zero, 0f, dt, to, true, false, false);
                if (windup <= 0) { winding = false; Strike(foe, dist, range); }
                Present(dt);
                return;
            }

            bool canSee = World.Sight(Pos, foe.Pos);
            if (dist <= range && (canSee || !ranged))
            {
                float back = ranged && dist < range * 0.4f ? stats.speed * 0.6f * SpeedMult : 0f;
                var away = back > 0f ? -to.normalized : Vector3.zero;
                loco.Step(this, away, back, dt, to, false, false, false);
                if (Time.time >= nextAttack)
                {
                    nextAttack = Time.time + stats.attackCooldown * PhaseCooldownScale();
                    winding = true;
                    windup = stats.def.role == MonsterRole.Brute || stats.rank == MonsterRank.Boss ? 0.6f : 0.3f;
                    bool cast = ranged;
                    modelAnim?.BeginAttack(cast, windup + 0.15f);
                    var tg = TelegraphBook.ForMonster(stats.def.id);
                    if (tg != null) modelAnim?.SetLeadIn(tg.windupSpeed);
                    var fwd = to.sqrMagnitude > 0.0001f ? to.normalized : transform.forward;
                    if (tg == null)
                        Debug.LogError("Hollowmere telegraph FAIL " + stats.def.id + " has no TelegraphDef");
                    else
                    {
                        TelegraphMark.Place(tg, Pos, fwd, windup, stats.def.element);
                        TelegraphBody.Arm(this, tg, windup, stats.def.element);
                    }
                }
                Present(dt);
                return;
            }

            // Chase: straight line when visible and close, A* otherwise.
            Vector3 step;
            if (canSee && dist < 8f) step = to.normalized;
            else
            {
                repath -= dt;
                if (path == null || repath <= 0)
                {
                    repath = Random.Range(0.5f, 0.9f);
                    path = Pathfinder.Find(World.Map, World.ToTile(Pos), World.ToTile(foe.Pos), 2500);
                    pathIndex = 0;
                }
                if (path != null && pathIndex < path.Count)
                {
                    var wp = World.ToWorld(path[pathIndex]);
                    var d = wp - Pos; d.y = 0;
                    if (d.magnitude < 0.6f) pathIndex++;
                    step = d.sqrMagnitude > 0.0001f ? d.normalized : to.normalized;
                }
                else step = to.normalized;
            }
            // Separation so packs fan out instead of stacking.
            foreach (var o in All)
            {
                if (o == this || o.team != Team.Monster) continue;
                var away = Pos - o.Pos; away.y = 0;
                float m = away.magnitude;
                if (m < 1.2f && m > 0.01f) step += away / m * (1.2f - m);
            }
            if (step.sqrMagnitude > 0.0001f) step.Normalize();
            loco.Step(this, step, stats.speed * SpeedMult, dt, step.sqrMagnitude > 0.0001f ? step : to, false, false, false);
            Present(dt);
        }

        void Halt(float dt)
        {
            loco.Step(this, Vector3.zero, 0f, dt, Vector3.zero, false, false, false);
            Present(dt);
        }

        void Present(float dt)
        {
            if (modelAnim != null) modelAnim.Tick(loco.groundSpeed, dt);
            else if (body != null)
            {
                float bob = loco.groundSpeed > Feel.Active.idle ? Mathf.Abs(Mathf.Sin(Time.time * 10f)) * 0.08f : 0f;
                body.localPosition = Vector3.Lerp(body.localPosition, new Vector3(0f, bob, 0f), dt * 10f);
            }
        }

        Actor ChooseFoe(HeroActor hero)
        {
            // A taunting companion form pulls attention; otherwise the nearest of hero / companion / thralls,
            // weighted toward the hero.
            Actor best = hero; float bestD = (hero.Pos - Pos).sqrMagnitude * 0.6f;
            foreach (var a in All)
            {
                if (a.team != Team.Hero || a == hero || !a.Targetable) continue;
                float d = (a.Pos - Pos).sqrMagnitude;
                if (a is PetActor p && p.Taunting && d < 64) return a;
                if (d < bestD) { best = a; bestD = d; }
            }
            return best;
        }

        void Strike(Actor f, float dist, float range)
        {
            if (f == null || !f.Targetable) return;
            var role = stats.def.role;
            if (role == MonsterRole.Ranged || role == MonsterRole.Caster)
            {
                var dir = (f.Pos - Pos).normalized;
                Projectile.FireMonster(this, Pos + Vector3.up * 1.2f + dir * 0.5f, dir, stats.damage, stats.def.element, stats.def.attackRange + 3, stats.def.element == Element.Frost ? 0.3f : 0);
                AudioHub.Play("sfx_spell", 0.3f);
                return;
            }
            if (role == MonsterRole.Brute || stats.rank == MonsterRank.Boss)
            {
                AudioHub.Vary("monster_roar", 0.55f);
                foreach (var a in InRadius(Team.Monster, Pos + transform.forward * 1.5f, 2.5f)) Deal(a, stats.damage, true);
                return;
            }
            if (dist <= range + 0.6f) Deal(f, stats.damage, true);
            AudioHub.Vary("swing_mace", 0.45f);
        }

        float PhaseCooldownScale() => stats.rank == MonsterRank.Boss && bossPhase >= 2 ? (float)DesignTable.PhaseTwoCooldownScale : 1f;

        float PhaseDamageScale() => stats.rank == MonsterRank.Boss && bossPhase >= 3 ? (float)DesignTable.PhaseThreeDamageScale : 1f;

        void Deal(Actor a, float raw, bool melee)
        {
            raw *= PhaseDamageScale();
            if (a is HeroActor h) h.TakeMonsterHit(raw, stats.def.element, this, melee);
            else a.TakeDamage(new Hit { amount = raw * 0.5f, element = stats.def.element }, this);
            if (stats.affixes.Contains(EliteAffix.Frozen)) a.Slow(0.4f, 1.5f);
        }

        void Affixes(float dt, HeroActor hero)
        {
            if (stats.affixes.Count == 0) return;
            affixTimer -= dt; affixTimer2 -= dt;
            if (affixTimer <= 0)
            {
                affixTimer = Random.Range(4f, 7f);
                if (stats.affixes.Contains(EliteAffix.Molten))
                    GroundEffect.Monster(this, Pos, 2f, stats.damage * 0.6f, Element.Fire, 4f, 0.2f, 0f, TelegraphBook.ForAffix(EliteAffix.Molten));
                if (stats.affixes.Contains(EliteAffix.Plagued))
                    GroundEffect.Monster(this, World.ClampToFloor(hero.Pos), 2.5f, stats.damage * 0.5f, Element.Poison, 5f, 0.8f, 0f, TelegraphBook.ForAffix(EliteAffix.Plagued));
                if (stats.affixes.Contains(EliteAffix.Frozen))
                    for (int i = 0; i < 3; i++)
                        GroundEffect.Monster(this, World.ClampToFloor(hero.Pos + new Vector3(Random.Range(-3f, 3f), 0, Random.Range(-3f, 3f))), 1.8f, stats.damage * 1.2f, Element.Frost, 0.01f, 1.5f, 0.6f, TelegraphBook.ForAffix(EliteAffix.Frozen));
                if (stats.affixes.Contains(EliteAffix.Mortar))
                    GroundEffect.Monster(this, World.ClampToFloor(hero.Pos), 2f, stats.damage, Element.Physical, 0.01f, 1f, 0f, TelegraphBook.ForAffix(EliteAffix.Mortar));
                if (stats.affixes.Contains(EliteAffix.Jailer))
                    GroundEffect.Monster(this, World.ClampToFloor(hero.Pos), 1.4f, stats.damage * 0.4f, Element.Physical, 2f, 0.5f, 0.9f, TelegraphBook.ForAffix(EliteAffix.Jailer));
                if (stats.affixes.Contains(EliteAffix.Pulse))
                    GroundEffect.Monster(this, Pos, 5f, stats.damage, Element.Frost, 0.01f, 1.2f, 0.5f, TelegraphBook.ForAffix(EliteAffix.Pulse));
                if (stats.affixes.Contains(EliteAffix.Sweep))
                    GroundEffect.Monster(this, Pos + transform.forward * 3f, 1.2f, stats.damage, Element.Arcane, 0.4f, 0.4f, 0f, TelegraphBook.ForAffix(EliteAffix.Sweep));
                if (stats.affixes.Contains(EliteAffix.Waller))
                {
                    TelegraphMark.Place(TelegraphBook.ForAffix(EliteAffix.Waller), hero.Pos, hero.transform.right, 0.6f, Element.Physical, 4f);
                    for (int i = -2; i <= 2; i++)
                    {
                        var block = Art.Cube(null, hero.Pos + hero.transform.right * (i * 0.8f) + Vector3.up * 0.6f, new Vector3(0.7f, 1.2f, 0.25f), Art.Mat(new Color(0.45f, 0.42f, 0.38f)));
                        Destroy(block, 3f);
                    }
                }
            }
            if (affixTimer2 <= 0)
            {
                affixTimer2 = Random.Range(6f, 9f);
                if (stats.affixes.Contains(EliteAffix.Teleporter) && (hero.Pos - Pos).magnitude > 5)
                {
                    Fx.Burst(Pos, new Color(0.7f, 0.3f, 1f), 1.5f);
                    Teleport(World.ClampToFloor(hero.Pos + Random.insideUnitSphere.Flat() * 2.5f));
                    Fx.Burst(Pos, new Color(0.7f, 0.3f, 1f), 1.5f);
                }
                if (stats.affixes.Contains(EliteAffix.Shielding))
                {
                    shieldUntil = Time.time + 2.5f;
                    if (shield == null) shield = Art.Sphere(transform, Vector3.up * 1f, Vector3.one * 2.4f * stats.def.scale, Art.Mat(new Color(0.6f, 0.6f, 1f), 1f)).transform;
                    shield.gameObject.SetActive(true);
                }
            }
            if (shield != null && Time.time >= shieldUntil && shield.gameObject.activeSelf) shield.gameObject.SetActive(false);
        }

        void BossMoves(float dt, HeroActor hero)
        {
            if (bossPhase >= 3)
            {
                hazardTimer -= dt;
                if (hazardTimer <= 0f)
                {
                    hazardTimer = (float)DesignTable.PhaseThreeHazardSeconds;
                    GroundEffect.Monster(this, World.ClampToFloor(hero.Pos), (float)DesignTable.PhaseThreeHazardRadius, stats.damage, stats.def.element, 0.01f, (float)DesignTable.PhaseThreeHazardWarn, 0f, TelegraphBook.ForAttack("boss-hazard"));
                }
            }
            if ((bossTimer -= dt) > 0) return;
            bossTimer = Random.Range(7f, 10f) * PhaseCooldownScale();
            if (Random.value < 0.5f)
            {
                // Summon a few of the floor's monsters.
                var pool = MonsterDb.ForDepth(GameManager.I.State.depth);
                for (int i = 0; i < 3; i++)
                {
                    var s = MonsterDb.Create(pool[Random.Range(0, pool.Count)], stats.level, MonsterRank.Normal, rng, GameManager.I.State.depth);
                    var m = Spawn(s, World.ClampToFloor(Pos + Random.insideUnitSphere.Flat() * 3f), pack);
                    m.Aggro();
                }
                GameManager.I.Toast($"{stats.displayName} calls for aid!");
            }
            else
            {
                // Telegraphed shockwave rings around the hero.
                for (int i = 0; i < 5; i++)
                {
                    var at = World.ClampToFloor(hero.Pos + Quaternion.Euler(0, i * 72, 0) * Vector3.forward * Random.Range(0f, 4f));
                    GroundEffect.Monster(this, at, 2.2f, stats.damage * 0.8f, stats.def.element, 0.01f, 1.4f, 0f, TelegraphBook.ForAttack("boss-wave"));
                }
            }
        }

        public void Aggro()
        {
            if (aggro) return;
            aggro = true;
            // Wake the whole pack.
            foreach (var a in All)
                if (a is MonsterActor m && m.pack == pack && !m.aggro && (m.Pos - Pos).sqrMagnitude < 400) m.Aggro();
            if (stats.rank == MonsterRank.Boss) GameManager.I.OnBossAggro(this);
        }

        public override void TakeDamage(Hit h, Actor source)
        {
            if (Time.time < shieldUntil) { Fx.Text(Pos, "Immune", Color.gray, 0.8f); return; }
            if (stats.affixes.Contains(EliteAffix.Armored)) h.amount *= 0.7f;
            float before = LifeFraction;
            Aggro();
            CombatFeelProfile.Flash(this);
            base.TakeDamage(h, source);
            if (!Dead) AudioHub.Vary("monster_hurt", 0.7f);
            if (stats.IsEliteish)
            {
                float after = LifeFraction;
                for (int i = 0; i < DesignTable.EliteGlobeThresholds.Length; i++)
                {
                    float mark = (float)DesignTable.EliteGlobeThresholds[i];
                    int bit = 1 << i;
                    if ((globeBits & bit) != 0 || before <= mark || after > mark) continue;
                    globeBits |= bit;
                    Pickup.DropGlobe(Pos);
                }
            }
            if (stats.rank == MonsterRank.Boss) CheckBossPhase();
        }

        void CheckBossPhase()
        {
            int next = DesignTable.BossPhase(LifeFraction);
            if (next == bossPhase) return;
            bossPhase = next;
            var phase = TelegraphBook.ForMonster(stats.def.id);
            if (phase != null) TelegraphMark.Place(phase, Pos, transform.forward, 0.6f, stats.def.element, 3.2f);
            GameManager.I.Toast($"{stats.displayName} — phase {bossPhase}");
        }

        protected override void Die(Actor killer)
        {
            if (Dead) return;
            Dead = true;
            if (cc != null) cc.enabled = false;
            if (stats.affixes.Contains(EliteAffix.Molten))
                GroundEffect.Monster(this, Pos, 3f, stats.damage * 1.5f, Element.Fire, 0.01f, 1.2f);
            GameManager.I.OnMonsterKilled(this);
            AudioHub.Vary("monster_death", 0.8f);
            CombatFeelProfile.Death(Pos, CombatFeelProfile.Undead(stats.def));
            enabled = false;
            bool played = modelAnim != null && modelAnim.PlayClip("death", 2.2f);
            foreach (var hover in GetComponentsInChildren<BatHover>(true))
                hover.enabled = false;
            if (body != null) body.gameObject.AddComponent<DeathLay>();
            Destroy(gameObject, played ? 2.6f : 1.8f);
        }
    }

    /// <summary>Holds the robe hem at 0.4 m. Walk and attack may bob by less than 0.08 m, so every reading stays inside 0.3–0.5.</summary>
    [DefaultExecutionOrder(400)]
    public sealed class WraithFloat : MonoBehaviour
    {
        public float lift = 0.4f;
        public float bob = 0.08f;
        public float Hem { get; private set; } = 0.4f;

        void LateUpdate() => Pin(false);

        /// <summary>Call after a clip sample so the hem is inside the window before the shot is read.</summary>
        public void Pin(bool log)
        {
            var visual = transform.childCount > 0 ? transform.GetChild(0) : transform;
            Squash("LeftFoot");
            Squash("RightFoot");
            Squash("LeftToeBase");
            Squash("RightToeBase");
            if (!Art.UnionBounds(gameObject, out var b)) return;
            float low = lift - bob;
            float high = lift + bob;
            float hem = b.min.y;
            if (hem < low || hem > high)
            {
                float dy = lift - hem;
                if (Mathf.Abs(dy) < 3f)
                {
                    var lp = visual.localPosition;
                    lp.y += dy;
                    visual.localPosition = lp;
                    hem = lift;
                }
            }
            Hem = hem;
            if (!log) return;
            Debug.Log("Hollowmere wraith height " + hem.ToString("0.00") + "m");
            if (hem < 0.3f || hem > 0.5f)
                Debug.LogError("Hollowmere wraith height FAIL " + hem.ToString("0.00") + "m");
        }

        void Squash(string bone)
        {
            var t = Art.Bone(transform, bone);
            if (t != null) t.localScale = new Vector3(0.02f, 0.02f, 0.02f);
        }
    }

    /// <summary>Keeps the bat 1.2 m off the floor and bobs it. LateUpdate wins over the idle clip.</summary>
    public sealed class BatHover : MonoBehaviour
    {
        public float height = 1.2f;
        public float bob = 0.12f;

        int logged;

        void LateUpdate()
        {
            var p = transform.localPosition;
            p.y = height + Mathf.Sin(Time.time * 2.4f) * bob;
            transform.localPosition = p;
            if (logged == 2)
            {
                float feet = transform.position.y;
                if (Art.MeshWorldBounds(transform, out var b)) feet = b.min.y;
                Debug.Log("Hollowmere bat height " + feet.ToString("0.00") + "m root=" + name);
                if (feet < 1.0f || feet > 1.55f)
                    Debug.LogError("Hollowmere bat height FAIL " + feet.ToString("0.00") + "m");
            }
            if (logged < 4) logged++;
        }
    }

    /// <summary>
    /// Leaves a corpse on its back or side with the lowest renderer bound on the floor.
    /// The death clip is sampled and held (the idle loop was replacing it before the
    /// screenshot). The root is tipped so its up axis is horizontal, and the mesh keeps
    /// the death pose so a flat skeleton does not stand back up. A posed body thicker
    /// than the floor check allows is scaled down until it passes.
    /// </summary>
    [DefaultExecutionOrder(500)]
    public sealed class DeathLay : MonoBehaviour
    {
        public float livingAxis;
        string clip = "none";
        bool baked, shaped, warned, matched;
        int grounds, waits;
        Animation anim;

        void LateUpdate()
        {
            foreach (var hover in GetComponentsInChildren<BatHover>(true))
            {
                hover.enabled = false;
                if (!baked)
                {
                    var hp = hover.transform.localPosition;
                    hp.y = 0f;
                    hover.transform.localPosition = hp;
                }
            }
            foreach (var floater in GetComponentsInChildren<WraithFloat>(true))
                floater.enabled = false;
            HoldDeath();
            if (!baked)
            {
                // The clip list is sometimes empty on the instantiate frame. Baking then
                // freezes the bind pose and the weapons walk off in the real death pose.
                if (clip == "none" && waits++ < 3) return;
                if (!TryBake()) return;
                baked = true;
                TipKeepChildren();
                FlattenChildren();
                LayOnBack();
                MatchLiving();
                shaped = true;
            }
            else if (Mathf.Abs(transform.up.y) >= 0.35f)
                TipKeepChildren();
            Ground();
            if (!shaped) return;
            grounds++;
            if (grounds == 2 && Art.UnionBounds(gameObject, out var b))
                Debug.Log("Hollowmere death lay " + name + " clip=" + clip
                    + " up=" + transform.up.ToString("0.00")
                    + " size=" + b.size.ToString("0.00")
                    + " minY=" + b.min.y.ToString("0.00"));
        }

        public bool Done => shaped && grounds >= 2;

        void HoldDeath()
        {
            if (anim == null) anim = GetComponentInChildren<Animation>(true);
            if (anim == null) return;
            anim.cullingType = AnimationCullingType.AlwaysAnimate;
            anim.enabled = true;
            AnimationState death = null;
            string list = "";
            foreach (AnimationState s in anim)
            {
                if (list.Length > 0) list += ",";
                list += s.name;
                if (ClipLeaf(s.name) == "death") death = s;
            }
            bool crawler = CorpseNamed("crawler");
            if (death == null || death.clip == null)
            {
                if (waits >= 3 && !warned)
                {
                    warned = true;
                    Debug.LogWarning("Hollowmere death lay " + name + " no death clip (" + list + ")");
                }
                foreach (var animator in GetComponentsInChildren<Animator>(true))
                    animator.enabled = false;
                return;
            }
            // The crawler's death roll knots the body. Lay the idle pose flat instead.
            AnimationState pose = death;
            if (crawler)
            {
                foreach (AnimationState s in anim)
                    if (ClipLeaf(s.name) == "idle" && s.clip != null) pose = s;
                if (pose != death) Debug.Log("Hollowmere death lay " + name + " crawler uses idle");
            }
            clip = pose == death ? death.name : "idle-flat";
            foreach (AnimationState s in anim)
            {
                s.weight = 0f;
                s.enabled = false;
            }
            pose.wrapMode = WrapMode.ClampForever;
            pose.enabled = true;
            pose.weight = 1f;
            pose.speed = 0f;
            // Play resets the clock. Put it back on the last frame before sampling,
            // or the bake freezes the standing start of the clip.
            anim.Play(pose.name);
            float unit = pose == death ? 0.99f : 0.35f;
            pose.time = Mathf.Max(0.05f, pose.length) * unit;
            pose.normalizedTime = unit;
            anim.Sample();
            foreach (var animator in GetComponentsInChildren<Animator>(true))
                animator.enabled = false;
        }

        static string ClipLeaf(string stateName)
        {
            string n = stateName.ToLowerInvariant();
            int cut = Mathf.Max(n.LastIndexOf('|'), Mathf.Max(n.LastIndexOf('/'), n.LastIndexOf('\\')));
            return cut >= 0 ? n.Substring(cut + 1) : n;
        }

        bool TryBake()
        {
            var skins = GetComponentsInChildren<SkinnedMeshRenderer>(true);
            if (skins.Length == 0)
                return GetComponentInChildren<MeshRenderer>(true) != null;
            for (int i = 0; i < skins.Length; i++)
                ReplaceSkin(skins[i]);
            return true;
        }

        static void ReplaceSkin(SkinnedMeshRenderer smr)
        {
            if (smr == null) return;
            var go = smr.gameObject;
            // World size of the posed skin, before the renderer is destroyed.
            var before = smr.bounds.size;
            float beforeLen = Mathf.Max(before.x, Mathf.Max(before.y, before.z));
            if (smr.sharedMesh != null)
            {
                var meshSize = smr.sharedMesh.bounds.size;
                float meshLen = Mathf.Max(meshSize.x, Mathf.Max(meshSize.y, meshSize.z));
                // A stale skin box reads the 1 cm rig. The authored mesh is the living size.
                if (meshLen > 0.4f && beforeLen < meshLen * 0.25f) beforeLen = meshLen;
            }
            var lossy = smr.transform.lossyScale;
            Mesh mesh = null;
            Material[] mats = smr.sharedMaterials;
            var shadows = smr.shadowCastingMode;
            bool receive = smr.receiveShadows;
            if (smr.sharedMesh != null)
            {
                smr.updateWhenOffscreen = true;
                mesh = new Mesh { name = go.name + "_corpse" };
                smr.BakeMesh(mesh);
                mesh.RecalculateBounds();
            }
            UnityEngine.Object.DestroyImmediate(smr);
            if (mesh == null) return;
            var mf = go.GetComponent<MeshFilter>();
            if (mf == null) mf = go.AddComponent<MeshFilter>();
            mf.sharedMesh = mesh;
            var mr = go.GetComponent<MeshRenderer>();
            if (mr == null) mr = go.AddComponent<MeshRenderer>();
            mr.sharedMaterials = mats;
            mr.shadowCastingMode = shadows;
            mr.receiveShadows = receive;
            // A rig at 0.01 (the horror ghoul) makes BakeMesh a centimetre tall once it is a plain mesh.
            var world = Vector3.Scale(mesh.bounds.size, new Vector3(Mathf.Abs(lossy.x), Mathf.Abs(lossy.y), Mathf.Abs(lossy.z)));
            float afterLen = Mathf.Max(world.x, Mathf.Max(world.y, world.z));
            if (beforeLen > 0.2f && afterLen > 0.0001f)
            {
                float ratio = afterLen / beforeLen;
                if (ratio < 0.4f || ratio > 2.5f)
                {
                    float s = beforeLen / afterLen;
                    go.transform.localScale *= s;
                    Debug.Log("Hollowmere death lay bake " + go.name + " scale x" + s.ToString("0.00")
                        + " was " + afterLen.ToString("0.00") + "m posed " + beforeLen.ToString("0.00") + "m");
                }
            }
        }

        /// <summary>Tip this transform onto its back without moving the posed meshes.</summary>
        void TipKeepChildren()
        {
            int n = transform.childCount;
            var rot = new Quaternion[n];
            var pos = new Vector3[n];
            for (int i = 0; i < n; i++)
            {
                rot[i] = transform.GetChild(i).rotation;
                pos[i] = transform.GetChild(i).position;
            }
            var yaw = Vector3.ProjectOnPlane(transform.forward, Vector3.up);
            if (yaw.sqrMagnitude < 0.0001f) yaw = Vector3.forward;
            transform.rotation = Quaternion.LookRotation(Vector3.down, yaw.normalized);
            for (int i = 0; i < n; i++)
            {
                var c = transform.GetChild(i);
                c.rotation = rot[i];
                c.position = pos[i];
            }
        }

        /// <summary>Turn the posed mesh so its thinnest axis is vertical. The root stays tipped.</summary>
        void FlattenChildren()
        {
            int n = transform.childCount;
            if (n == 0) return;
            var bases = new Quaternion[n];
            for (int i = 0; i < n; i++) bases[i] = transform.GetChild(i).rotation;
            float best = Height();
            var bestDelta = Quaternion.identity;
            float[] ang = { 0f, 90f, -90f, 180f, 75f, -75f };
            for (int p = 0; p < ang.Length; p++)
            {
                for (int r = 0; r < ang.Length; r++)
                {
                    if (p == 0 && r == 0) continue;
                    var delta = Quaternion.Euler(ang[p], 0f, ang[r]);
                    for (int i = 0; i < n; i++)
                        transform.GetChild(i).rotation = delta * bases[i];
                    float h = Height();
                    if (h < best - 0.02f)
                    {
                        best = h;
                        bestDelta = delta;
                    }
                }
            }
            for (int i = 0; i < n; i++)
                transform.GetChild(i).rotation = bestDelta * bases[i];
        }

        /// <summary>The brute's death clip ends face-down on its hands, and the rat's sits up.
        /// A half turn lays them on their back without changing the floor height.</summary>
        void LayOnBack()
        {
            if (!CorpseNamed("demon_brute") && !CorpseNamed("hm_rat")) return;
            var hips = Art.Bone(transform, "Hips") ?? Art.Bone(transform, "body");
            if (hips != null && hips.forward.y > -0.35f) return;
            for (int i = 0; i < transform.childCount; i++)
            {
                var c = transform.GetChild(i);
                c.rotation = Quaternion.Euler(0f, 0f, 180f) * c.rotation;
            }
        }

        bool CorpseNamed(string key)
        {
            if (name.IndexOf(key, System.StringComparison.OrdinalIgnoreCase) >= 0) return true;
            for (int i = 0; i < transform.childCount; i++)
                if (transform.GetChild(i).name.IndexOf(key, System.StringComparison.OrdinalIgnoreCase) >= 0)
                    return true;
            return false;
        }

        /// <summary>Pull a corpse that baked or posed far from its living size back to that size. The pose stays.</summary>
        void MatchLiving()
        {
            if (matched || livingAxis < 0.15f) return;
            if (!BoundsNow(out var b)) return;
            float now = Mathf.Max(b.size.x, Mathf.Max(b.size.y, b.size.z));
            if (now < 0.02f) return;
            matched = true;
            float ratio = now / livingAxis;
            if (ratio >= 0.8f && ratio <= 1.2f) return;
            float s = livingAxis / now;
            if (transform.childCount == 0) transform.localScale *= s;
            else
                for (int i = 0; i < transform.childCount; i++)
                    transform.GetChild(i).localScale *= s;
            Debug.Log("Hollowmere death lay " + name + " living scale x" + s.ToString("0.00")
                + " ratio was " + ratio.ToString("0.00"));
        }

        void Ground()
        {
            if (!BoundsNow(out var b)) return;
            float dy = 0.02f - b.min.y;
            if (Mathf.Abs(dy) > 0.004f && Mathf.Abs(dy) < 12f)
                transform.position += new Vector3(0f, dy, 0f);
        }

        float Height() => BoundsNow(out var b) ? b.size.y : 99f;

        bool BoundsNow(out Bounds b)
        {
            if (Art.UnionBounds(gameObject, out b)) return true;
            return Art.MeshWorldBounds(transform, out b);
        }
    }

    public static class VecExt
    {
        public static Vector3 Flat(this Vector3 v) => new Vector3(v.x, 0, v.z);
    }
}
