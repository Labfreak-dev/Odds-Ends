using System.Collections.Generic;
using System.Linq;
using Hollowmere.Core;
using UnityEngine;

namespace Hollowmere
{
    /// <summary>Executes a resolved SkillCast by shape. Runes and legendaries have already been folded
    /// into the cast numbers, so this file never needs to know a rune by name except for the few
    /// buff skills whose runes add a different kind of effect.</summary>
    public static class SkillRunner
    {
        public static void Execute(HeroActor h, SkillCast c, Vector3 dir, Actor target)
        {
            var s = c.skill;
            var col = Art.Element(c.element);
            SkillVfx.Play(h, c, dir, target);
            Sound(c);
            switch (s.shape)
            {
                case SkillShape.MeleeArc:
                {
                    float arc = 120 * c.radius / Mathf.Max(0.1f, s.radius);
                    var hits = Actor.InArc(Team.Hero, h.Pos, dir, c.range, Mathf.Min(360, arc));
                    foreach (var a in hits) HitEnemy(h, c, a);
                    OnHits(h, c, hits.Count);
                    Fx.Ring(h.Pos + dir * 1.2f, c.range * 0.6f, col, 0.18f);
                    if (s.generate > 0 && hits.Count > 0) h.Gain(s.generate);
                    break;
                }
                case SkillShape.Projectile:
                {
                    int n = Mathf.Max(1, c.projectiles);
                    float spread = n > 1 ? 8f : 0;
                    for (int i = 0; i < n; i++)
                    {
                        float ang = (i - (n - 1) / 2f) * spread;
                        var d = Quaternion.Euler(0, ang, 0) * dir;
                        Projectile.FireHero(h, c, h.Pos + Vector3.up * 1.2f + d * 0.6f, d, 22f, c.range, 1f / n * (n > 1 ? 1.6f : 1f));
                    }
                    if (s.generate > 0) h.Gain(s.generate);
                    break;
                }
                case SkillShape.Cone:
                    if (c.projectiles > 1)
                    {
                        int n = c.projectiles;
                        for (int i = 0; i < n; i++)
                        {
                            float ang = Mathf.Lerp(-30, 30, n == 1 ? 0.5f : i / (float)(n - 1));
                            var d = Quaternion.Euler(0, ang, 0) * dir;
                            Projectile.FireHero(h, c, h.Pos + Vector3.up * 1.2f + d * 0.6f, d, 20f, c.range, 1f);
                        }
                    }
                    else
                    {
                        var hits = Actor.InLine(Team.Hero, h.Pos, dir, c.range, c.radius);
                        foreach (var a in hits) HitEnemy(h, c, a);
                        OnHits(h, c, hits.Count);
                        for (float d = 1; d < c.range; d += 1.5f) Fx.Burst(h.Pos + dir * d, col, c.radius * 1.2f, 0.4f);
                        if (c.burnPct > 0) GroundEffect.Hero(h, c, h.Pos + dir * c.range * 0.5f, c.range * 0.5f, 3f, 0.4f, 0f);
                    }
                    break;
                case SkillShape.Nova:
                    if (c.duration > 0 && s.id == "ic_whirl")
                    {
                        h.StartSpin(c);
                        break;
                    }
                    {
                        var hits = Actor.InRadius(Team.Hero, h.Pos, c.radius);
                        foreach (var a in hits) HitEnemy(h, c, a);
                        OnHits(h, c, hits.Count);
                        Fx.Ring(h.Pos, c.radius, col, 0.35f);
                        if (c.rune?.id == "rn_slam_quake") GroundEffect.Hero(h, c, h.Pos, c.radius * 1.3f, 0.01f, 0.5f, 0.5f);
                    }
                    break;
                case SkillShape.GroundTarget:
                {
                    var at = target != null ? target.Pos : h.Pos + dir * c.range * 0.6f;
                    at = World.ClampToFloor(at);
                    bool meteor = s.id == "hx_meteor";
                    float delay = meteor ? 0.9f : 0.2f;
                    float dur = meteor ? 0.01f : Mathf.Max(0.5f, c.duration);
                    GroundEffect.Hero(h, c, at, c.radius, dur, delay, 1f);
                    if (meteor && c.burnPct > 0) GroundEffect.Hero(h, c, at, c.radius, 3f, delay + 0.1f, c.burnPct * 0.3f);
                    break;
                }
                case SkillShape.Dash:
                {
                    var from = h.Pos;
                    var to = World.Sweep(h.Pos, dir, c.range);
                    if (c.weaponDamage > 0)
                    {
                        var hits = Actor.InLine(Team.Hero, from, dir, Vector3.Distance(from, to) + 1, c.radius);
                        foreach (var a in hits) { HitEnemy(h, c, a); a.Knockback(Vector3.Cross(Vector3.up, dir) * (Random.value < 0.5f ? 1 : -1) + dir, c.knockback); }
                        OnHits(h, c, hits.Count);
                    }
                    h.Teleport(to);
                    SkillVfx.Landing(h, c);
                    Fx.Beam(from + Vector3.up, to + Vector3.up, col, 0.5f, 0.25f);
                    if (c.healPct > 0) h.Heal(h.maxLife * c.healPct);
                    if (c.slow > 0) { foreach (var a in Actor.InRadius(Team.Hero, from, 3.5f)) { a.Slow(c.slow, 3); if (s.id == "hx_blink") HitEnemy(h, c, a, 1.5f); } Fx.Ring(from, 3.5f, col); }
                    break;
                }
                case SkillShape.Buff:
                    Buff(h, c);
                    break;
                case SkillShape.Summon:
                {
                    int n = 1 + (c.rune?.extraProjectiles ?? 0);
                    for (int i = 0; i < n; i++)
                        MinionActor.Spawn(h, c, h.Pos + Quaternion.Euler(0, i * 120, 0) * Vector3.right * 1.5f);
                    break;
                }
                case SkillShape.Chain:
                    Chain(h, c, target);
                    break;
            }
        }

        static void Buff(HeroActor h, SkillCast c)
        {
            var s = c.skill;
            float dur = Mathf.Max(1, c.duration);
            h.AddSkillBuff(s.passiveStat, s.passiveValue, dur, s.id);
            if (s.generate > 0) h.Gain(s.generate);
            if (c.healPct > 0) h.Heal(h.maxLife * c.healPct);
            switch (c.rune?.id)
            {
                case "rn_warcry_iron": h.AddSkillBuff(Stat.DamageReduction, 0, dur, "rn_warcry_iron"); break;
                case "rn_mark_deadly": h.AddSkillBuff(Stat.CritDamage, 50, dur, s.id + "_cd"); break;
                case "rn_mark_focus": h.Gain(50); break;
            }
            Fx.Ring(h.Pos, 3f, new Color(1f, 0.85f, 0.3f), 0.5f);
        }

        static void Chain(HeroActor h, SkillCast c, Actor first)
        {
            var hit = new HashSet<Actor>();
            var cur = first != null && (first.Pos - h.Pos).magnitude <= c.range ? first : Actor.Nearest(Team.Hero, h.Pos, c.range);
            var from = h.Pos + Vector3.up * 1.2f;
            int jumps = Mathf.Max(1, c.chains) + 1;
            var col = Art.Element(c.element);
            for (int i = 0; i < jumps && cur != null; i++)
            {
                Fx.Beam(from, cur.Pos + Vector3.up, col, 0.15f, 0.2f);
                HitEnemy(h, c, cur, i == 0 ? 1f : 0.8f);
                hit.Add(cur);
                from = cur.Pos + Vector3.up;
                var next = Actor.InRadius(Team.Hero, cur.Pos, 7f).Where(a => !hit.Contains(a)).OrderBy(a => (a.Pos - cur.Pos).sqrMagnitude).FirstOrDefault();
                cur = next;
            }
            OnHits(h, c, hit.Count);
        }

        /// <summary>One hit from a hero skill on one enemy, with all on-hit effects.</summary>
        public static void HitEnemy(HeroActor h, SkillCast c, Actor a, float mult = 1f)
        {
            if (a == null || !a.Targetable) return;
            var hit = Combat.HeroHit(h.Ctx, c, a.IsElite, h.Rng, mult);
            a.TakeDamage(hit, h);
            Sfx.Strike(h, c.skill.id, a, hit.crit);
            string punch = a.Dead ? "kill" : hit.crit ? "crit" : c.skill.primary ? "normal" : "skill";
            CombatClock.Punch(punch);
            CombatSparks.Burst(a.Pos + Vector3.up * 0.8f, Art.Element(c.element), hit.crit ? "crit" : c.skill.primary ? "normal" : "skill");
            if (c.slow > 0) a.Slow(c.slow, 2.5f);
            if (c.stun > 0) a.Stun(c.stun);
            if (c.burnPct > 0) a.Burn(hit.amount * c.burnPct, 3f, c.element, h);
            if (c.knockback > 0 && c.skill.shape != SkillShape.Dash) a.Knockback(a.Pos - h.Pos, c.knockback);
            if (hit.crit)
            {
                float r = h.Hero.LegendaryTotal(LegendaryEffect.ResourceOnCrit);
                if (r > 0) h.Gain(r);
            }
            // Area damage: a chance to splash a share of the hit onto others nearby (D3 rule: 20% chance).
            float area = h.stats[Stat.AreaDamage];
            if (area > 0 && h.Rng.Chance(0.2f))
                foreach (var o in Actor.InRadius(Team.Hero, a.Pos, 3f))
                    if (o != a) o.TakeDamage(new Hit { amount = hit.amount * area / 100f, element = hit.element }, h);
        }

        /// <summary>After a cast resolves: life on hit and the per-target heal of Bloodspin.</summary>
        public static void OnHits(HeroActor h, SkillCast c, int count)
        {
            if (count <= 0) return;
            float healed = Combat.LifeOnHit(h.stats, count);
            h.Heal(healed);
            if (healed >= 1f) CombatNumbers.Spawn(h.Pos, "+" + Mathf.RoundToInt(healed), "heal", Color.white);
            if (c.rune?.id == "rn_whirl_blood") h.Heal(h.maxLife * c.healPct * count);
            if (c.skill.primary && c.skill.shape != SkillShape.MeleeArc) { }
        }

        static void Sound(SkillCast c)
        {
            // The cast cue already played when the button went down. A skill with no take still needs a swing.
            if (c == null || c.skill == null) return;
        }
    }

    public sealed class Projectile : MonoBehaviour
    {
        Team team;
        Vector3 dir;
        float speed, rangeLeft, mult;
        int pierce;
        bool hexBolt;
        Color tint;
        Vector3 baseScale;
        Light glow;
        HeroActor hero; SkillCast cast;
        MonsterActor monster; float raw; Element el; float slow;
        readonly HashSet<Actor> hit = new HashSet<Actor>();

        public static void FireHero(HeroActor h, SkillCast c, Vector3 from, Vector3 dir, float speed, float range, float mult)
        {
            bool bolt = c.skill.id == "hx_bolt";
            var tint = Art.Element(c.element);
            // Stay on the element colour. Lerping toward white and cranking emission clipped the
            // bolt to three white dots in the dungeon shot.
            var core = bolt ? new Color(0.62f, 0.18f, 1f, 1f) : tint;
            var p = Make(from + (bolt ? Vector3.up * 0.55f : Vector3.zero), core, bolt ? Vector3.one * 1.15f : c.skill.cls == HeroClass.Stalker ? new Vector3(0.12f, 0.12f, 0.9f) : Vector3.one * 0.4f);
            p.team = Team.Hero; p.hero = h; p.cast = c; p.dir = dir.normalized; p.speed = speed; p.rangeLeft = range; p.mult = mult; p.pierce = c.pierce;
            p.hexBolt = bolt; p.tint = tint;
            p.transform.rotation = Quaternion.LookRotation(p.dir);
            if (bolt)
            {
                Fx.Burst(from, tint, 0.7f, 0.16f);
                var rend = p.GetComponent<Renderer>();
                if (rend != null)
                {
                    rend.sharedMaterial = Art.Mat(core, 1.1f);
                    rend.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                }
                // Parent scale is the 1.15 m core. The sprite is sized so the world quad is ~2.6 m.
                Art.GlowSprite(p.transform, 2.6f / 1.15f, tint);
                var trail = p.gameObject.AddComponent<TrailRenderer>();
                trail.time = 0.45f;
                trail.startWidth = 0.72f;
                trail.endWidth = 0.08f;
                trail.minVertexDistance = 0.04f;
                trail.numCornerVertices = 2;
                trail.alignment = LineAlignment.View;
                trail.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                trail.receiveShadows = false;
                trail.material = Art.GlowMat(Color.white, true);
                var grad = new Gradient();
                grad.SetKeys(
                    new[] { new GradientColorKey(tint, 0f), new GradientColorKey(new Color(0.45f, 0.15f, 0.95f), 1f) },
                    new[] { new GradientAlphaKey(1f, 0f), new GradientAlphaKey(0f, 1f) });
                trail.colorGradient = grad;
                var glow = p.gameObject.AddComponent<Light>();
                glow.type = LightType.Point;
                glow.color = tint;
                glow.range = 12f;
                glow.intensity = 7f;
                p.glow = glow;
            }
        }

        public static void FireMonster(MonsterActor m, Vector3 from, Vector3 dir, float raw, Element el, float range, float slow = 0)
        {
            var p = Make(from, Art.Element(el) * 0.8f + Color.red * 0.2f, Vector3.one * 0.45f);
            p.team = Team.Monster; p.monster = m; p.raw = raw; p.el = el; p.dir = dir.normalized; p.speed = 11f; p.rangeLeft = range + 2; p.slow = slow;
        }

        static Projectile Make(Vector3 at, Color c, Vector3 scale)
        {
            var g = Art.Sphere(null, at, scale, Art.Mat(c, 2f));
            var p = g.AddComponent<Projectile>();
            p.baseScale = scale;
            return p;
        }

        void Update()
        {
            float step = speed * Time.deltaTime;
            transform.position += dir * step;
            rangeLeft -= step;
            if (hexBolt)
            {
                float pulse = 1f + 0.1f * Mathf.Sin(Time.time * 32f);
                transform.localScale = baseScale * pulse;
                if (glow != null) glow.intensity = 6.5f + 1.2f * Mathf.Sin(Time.time * 28f);
            }
            if (rangeLeft <= 0 || World.Solid(transform.position))
            {
                if (hexBolt)
                {
                    Fx.HexImpact(transform.position, tint, null);
                    Sfx.ImpactOnly("hx_bolt");
                }
                Destroy(gameObject);
                return;
            }
            var flat = new Vector3(transform.position.x, 0, transform.position.z);
            foreach (var a in Actor.InRadius(team, flat, 0.4f))
            {
                if (hit.Contains(a)) continue;
                hit.Add(a);
                if (team == Team.Hero)
                {
                    SkillRunner.HitEnemy(hero, cast, a, mult);
                    SkillRunner.OnHits(hero, cast, 1);
                }
                else
                {
                    if (a is HeroActor h) h.TakeMonsterHit(raw, el, monster, false);
                    else a.TakeDamage(new Hit { amount = raw * 0.5f, element = el }, monster);
                    if (slow > 0) a.Slow(slow, 2);
                }
                if (hexBolt)
                    Fx.HexImpact(transform.position, tint, a);
                else Fx.Burst(transform.position, GetComponent<Renderer>() != null ? GetComponent<Renderer>().sharedMaterial.color : tint, 0.7f, 0.15f);
                if (pierce-- <= 0) { Destroy(gameObject); return; }
            }
        }
    }

    /// <summary>A circle on the ground that hurts whoever stands in it: caltrops, meteors, rain of
    /// arrows for the hero; molten/plagued pools and boss slams for monsters. Telegraphed by a ring.</summary>
    public sealed class GroundEffect : MonoBehaviour
    {
        Team team;
        float radius, duration, delay, tick, mult;
        HeroActor hero; SkillCast cast;
        MonsterActor monster; float raw; Element el; float slow;
        Transform disc;
        bool started;
        float share;
        const float TickEvery = 0.5f;

        public static void Hero(HeroActor h, SkillCast c, Vector3 at, float radius, float duration, float delay, float mult)
        {
            var g = Make(at, radius, Art.Element(c.element));
            g.team = Team.Hero; g.hero = h; g.cast = c; g.radius = radius; g.duration = duration; g.delay = delay; g.mult = mult;
        }

        public static void Monster(MonsterActor m, Vector3 at, float radius, float raw, Element el, float duration, float delay, float slow = 0)
        {
            var g = Make(at, radius, Art.Element(el) * 0.7f + Color.red * 0.3f);
            g.team = Team.Monster; g.monster = m; g.raw = raw; g.el = el; g.radius = radius; g.duration = duration; g.delay = delay; g.slow = slow;
        }

        static GroundEffect Make(Vector3 at, float radius, Color c)
        {
            var root = new GameObject("ground");
            root.transform.position = new Vector3(at.x, 0.06f, at.z);
            var ge = root.AddComponent<GroundEffect>();
            ge.disc = Art.Cylinder(root.transform, Vector3.zero, new Vector3(radius * 2, 0.01f, radius * 2), Art.Mat(new Color(c.r, c.g, c.b) * 0.6f, 0.8f)).transform;
            return ge;
        }

        void Update()
        {
            if (!started)
            {
                delay -= Time.deltaTime;
                float pulse = 0.5f + 0.5f * Mathf.Sin(Time.time * 20);
                disc.localScale = new Vector3(radius * 2, 0.01f, radius * 2) * (0.9f + pulse * 0.1f);
                if (delay > 0) return;
                started = true;
                Fx.Ring(transform.position, radius, disc.GetComponent<Renderer>().sharedMaterial.color * 2, 0.3f);
                tick = 0;
                // Instant effects (duration ~0) deal the whole hit once; lingering ones deal it twice over, spread across ticks.
                share = duration <= TickEvery ? 1f : 2f * TickEvery / (duration + TickEvery);
            }
            duration -= Time.deltaTime;
            if ((tick -= Time.deltaTime) <= 0)
            {
                tick = TickEvery;
                var targets = Actor.InRadius(team, transform.position, radius);
                foreach (var a in targets)
                {
                    if (team == Team.Hero)
                    {
                        if (hero == null) break;
                        SkillRunner.HitEnemy(hero, cast, a, share * mult);
                    }
                    else if (a is HeroActor h) { h.TakeMonsterHit(raw * share, el, monster, false); if (slow > 0) h.Slow(slow, 1.5f); }
                    else a.TakeDamage(new Hit { amount = raw * share * 0.5f, element = el }, monster);
                }
                if (team == Team.Hero && hero != null) SkillRunner.OnHits(hero, cast, targets.Count);
            }
            if (duration <= 0) Destroy(gameObject);
        }
    }
}
