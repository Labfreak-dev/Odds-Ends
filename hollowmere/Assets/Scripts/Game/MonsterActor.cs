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
            m.affixTimer = Random.Range(2f, 5f);
            m.affixTimer2 = Random.Range(3f, 6f);
            m.bossTimer = 6f;
            return m;
        }

        protected override void Update()
        {
            base.Update();
            if (Dead || GameManager.I.Paused) return;
            float dt = Time.deltaTime;
            var hero = HeroActor.I;
            if (hero == null || hero.Dead) { SetMoving(false); return; }

            if (!aggro)
            {
                float d = (hero.Pos - Pos).magnitude;
                if (d < stats.def.aggroRange && World.Sight(Pos, hero.Pos)) Aggro();
                else { SetMoving(false); return; }
            }

            foe = ChooseFoe(hero);
            if (foe == null) return;
            if (Stunned) { SetMoving(false); return; }
            Affixes(dt, hero);
            if (stats.rank == MonsterRank.Boss) BossMoves(dt, hero);

            var to = foe.Pos - Pos; to.y = 0;
            float dist = to.magnitude;
            float range = stats.def.attackRange + foe.radius;
            bool ranged = stats.def.role == MonsterRole.Ranged || stats.def.role == MonsterRole.Caster;

            if (winding)
            {
                windup -= dt;
                Face(to);
                if (windup <= 0) { winding = false; Strike(foe, dist, range); }
                SetMoving(false);
                return;
            }

            bool canSee = World.Sight(Pos, foe.Pos);
            if (dist <= range && (canSee || !ranged))
            {
                SetMoving(false);
                Face(to);
                if (Time.time >= nextAttack)
                {
                    nextAttack = Time.time + stats.attackCooldown * PhaseCooldownScale();
                    winding = true;
                    windup = stats.def.role == MonsterRole.Brute || stats.rank == MonsterRank.Boss ? 0.6f : 0.3f;
                    if (stats.def.role == MonsterRole.Brute || stats.rank == MonsterRank.Boss)
                        Fx.Ring(Pos + transform.forward * 1.5f, 2.5f, new Color(1, 0.3f, 0.2f), windup);
                }
                // Ranged monsters back off a little if the hero closes in.
                if (ranged && dist < range * 0.4f) Move(-to.normalized * stats.speed * 0.6f * SpeedMult * dt);
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
                    step = d.normalized;
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
            Move(step.normalized * stats.speed * SpeedMult * dt);
            Face(step);
            SetMoving(true);
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
                foreach (var a in InRadius(Team.Monster, Pos + transform.forward * 1.5f, 2.5f)) Deal(a, stats.damage, true);
                Fx.Ring(Pos + transform.forward * 1.5f, 2.5f, Art.Element(stats.def.element), 0.25f);
                return;
            }
            if (dist <= range + 0.6f) Deal(f, stats.damage, true);
            AudioHub.Play("sfx_hit", 0.4f);
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
                    GroundEffect.Monster(this, Pos, 2f, stats.damage * 0.6f, Element.Fire, 4f, 0.2f);
                if (stats.affixes.Contains(EliteAffix.Plagued))
                    GroundEffect.Monster(this, World.ClampToFloor(hero.Pos), 2.5f, stats.damage * 0.5f, Element.Poison, 5f, 0.8f);
                if (stats.affixes.Contains(EliteAffix.Frozen))
                    for (int i = 0; i < 3; i++)
                        GroundEffect.Monster(this, World.ClampToFloor(hero.Pos + new Vector3(Random.Range(-3f, 3f), 0, Random.Range(-3f, 3f))), 1.8f, stats.damage * 1.2f, Element.Frost, 0.01f, 1.5f, 0.6f);
                if (stats.affixes.Contains(EliteAffix.Mortar))
                    GroundEffect.Monster(this, World.ClampToFloor(hero.Pos), 2f, stats.damage, Element.Physical, 0.01f, 1f);
                if (stats.affixes.Contains(EliteAffix.Jailer))
                    GroundEffect.Monster(this, World.ClampToFloor(hero.Pos), 1.4f, stats.damage * 0.4f, Element.Physical, 2f, 0.5f, 0.9f);
                if (stats.affixes.Contains(EliteAffix.Pulse))
                    GroundEffect.Monster(this, Pos, 5f, stats.damage, Element.Frost, 0.01f, 1.2f, 0.5f);
                if (stats.affixes.Contains(EliteAffix.Sweep))
                    GroundEffect.Monster(this, Pos + transform.forward * 3f, 1.2f, stats.damage, Element.Arcane, 0.4f, 0.4f);
                if (stats.affixes.Contains(EliteAffix.Waller))
                {
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
                    GroundEffect.Monster(this, World.ClampToFloor(hero.Pos), (float)DesignTable.PhaseThreeHazardRadius, stats.damage, stats.def.element, 0.01f, (float)DesignTable.PhaseThreeHazardWarn);
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
                    GroundEffect.Monster(this, at, 2.2f, stats.damage * 0.8f, stats.def.element, 0.01f, 1.4f);
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
            base.TakeDamage(h, source);
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
            Fx.Ring(Pos, 4f, new Color(1f, 0.45f, 0.2f), 0.6f);
            GameManager.I.Toast($"{stats.displayName} — phase {bossPhase}");
        }

        void SetMoving(bool moving)
        {
            if (modelAnim != null) { modelAnim.SetMoving(moving); return; }
            if (body != null && moving)
                body.localPosition = new Vector3(0, Mathf.Abs(Mathf.Sin(Time.time * 10)) * 0.08f, 0);
        }

        protected override void Die(Actor killer)
        {
            if (Dead) return;
            Dead = true;
            if (cc != null) cc.enabled = false;
            if (stats.affixes.Contains(EliteAffix.Molten))
                GroundEffect.Monster(this, Pos, 3f, stats.damage * 1.5f, Element.Fire, 0.01f, 1.2f);
            GameManager.I.OnMonsterKilled(this);
            AudioHub.Play("sfx_death", 0.5f);
            Fx.Burst(Pos + Vector3.up, Art.Hex(stats.def.color), 1.6f, 0.3f);
            enabled = false;
            if (body != null) body.localRotation = Quaternion.Euler(-85, 0, 0);
            Destroy(gameObject, 1.5f);
        }
    }

    public static class VecExt
    {
        public static Vector3 Flat(this Vector3 v) => new Vector3(v.x, 0, v.z);
    }
}
