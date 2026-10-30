using Hollowmere.Core;
using UnityEngine;

namespace Hollowmere
{
    /// <summary>The companion: follows, fights, eats fish to change form, and runs to town to sell
    /// loot. When beaten it flees and comes back rather than dying.</summary>
    public sealed class PetActor : Actor
    {
        public static PetActor I;
        PetState P => GameManager.I.State.pet;
        float nextAttack, fleeUntil, hidden;
        string builtForm = "?";
        Actor foe;
        readonly Rng rng = new Rng();

        public bool Taunting => P.Form?.taunt > 0;
        public bool Fled => Time.time < fleeUntil;
        public override bool Targetable => base.Targetable && !Fled && !P.Away && body != null && body.gameObject.activeSelf;
        public override int Level => GameManager.I.State.hero.level;

        public static PetActor Spawn(Vector3 at)
        {
            var go = new GameObject("Companion");
            go.transform.position = at;
            var p = go.AddComponent<PetActor>();
            p.team = Team.Hero;
            p.SetupController(0.35f, 0.9f);
            p.cc.enabled = false; // the companion slips past monsters; walls are handled by World.Sweep
            I = p;
            p.Rebuild();
            p.RefreshLife(true);
            return p;
        }

        public void RefreshLife(bool fill)
        {
            var h = HeroActor.I;
            if (h == null) return;
            float frac = maxLife > 0 ? life / maxLife : 1;
            maxLife = P.MaxLife(h.Hero, h.stats);
            life = fill ? maxLife : Mathf.Max(1, frac * maxLife);
        }

        void Rebuild()
        {
            builtForm = P.form;
            if (body != null) Destroy(body.gameObject);
            body = new GameObject("body").transform;
            body.SetParent(transform, false);
            var form = P.Form;
            float h = form == null ? 0.9f : form.id == "leviathan" ? 1.6f : form.id == "boneguard" ? 1.4f : 1.15f;
            string key = P.species == PetSpecies.Hound ? "pet_hound" : "pet_lynx";
            var m = Art.Model(key, h, body);
            if (m == null) m = Art.Quadruped(body, P.species == PetSpecies.Hound ? new Color(0.55f, 0.55f, 0.58f) : new Color(0.75f, 0.6f, 0.4f), h);
            if (form != null)
            {
                // Tint the form: recolour every renderer's material copy and add an element glow.
                var c = Art.Hex(form.color);
                foreach (var r in m.GetComponentsInChildren<Renderer>())
                {
                    var mats = r.materials;
                    foreach (var mat in mats) mat.color = Color.Lerp(mat.color, c, 0.6f);
                }
                var glow = new GameObject("glow").AddComponent<Light>();
                glow.transform.SetParent(body, false);
                glow.transform.localPosition = Vector3.up;
                glow.type = LightType.Point; glow.color = c; glow.range = 4; glow.intensity = 1.5f;
            }
            RefreshLife(false);
        }

        protected override void Update()
        {
            base.Update();
            if (GameManager.I.Paused) return;
            var hero = HeroActor.I;
            if (hero == null) return;
            if (builtForm != P.form) Rebuild();

            bool show = !P.Away && !Fled;
            if (body.gameObject.activeSelf != show)
            {
                body.gameObject.SetActive(show);
                if (show) { Teleport(hero.Pos - hero.transform.forward * 1.5f); life = maxLife; }
            }
            if (!show) return;

            float dt = Time.deltaTime;
            var form = P.Form;
            float speed = 7.5f * (form?.speedMult ?? 1);

            if (GameManager.I.InTown) { Follow(hero, speed, dt); return; }

            if (foe == null || !foe.Targetable || (foe.Pos - hero.Pos).magnitude > 12) foe = Nearest(Team.Hero, hero.Pos, 10f);
            if (foe != null)
            {
                var to = foe.Pos - Pos; to.y = 0;
                if (to.magnitude > 1.6f + foe.radius) { Step(to, speed, dt); }
                else if (Time.time >= nextAttack && !Stunned)
                {
                    nextAttack = Time.time + 0.9f;
                    Face(to);
                    var hit = Combat.PetHit(hero.Ctx, 0.35f * (form?.damageMult ?? 1), form?.element ?? Element.Physical, rng);
                    foe.TakeDamage(hit, hero);
                    if (form != null && form.aoeRadius > 0)
                    {
                        foreach (var a in InRadius(Team.Hero, foe.Pos, form.aoeRadius))
                            if (a != foe) a.TakeDamage(new Hit { amount = hit.amount * 0.6f, element = hit.element }, hero);
                        Fx.Ring(foe.Pos, form.aoeRadius, Art.Hex(form.color), 0.25f);
                    }
                    if (form != null && form.slow > 0) foe.Slow(form.slow, 2);
                    body.localPosition = transform.InverseTransformDirection(to.normalized) * 0.3f;
                }
            }
            else Follow(hero, speed, dt);
            body.localPosition = Vector3.Lerp(body.localPosition, Vector3.zero, dt * 8);
        }

        void Follow(HeroActor hero, float speed, float dt)
        {
            var spot = hero.Pos - hero.transform.forward * 1.6f + hero.transform.right * 0.8f;
            var to = spot - Pos; to.y = 0;
            if (to.magnitude > 18f) { Teleport(spot); return; }
            if (to.magnitude > 0.5f) Step(to, speed * Mathf.Clamp(to.magnitude / 3f, 0.5f, 1.3f), dt);
        }

        void Step(Vector3 to, float speed, float dt)
        {
            var dir = to.normalized;
            var next = World.Sweep(Pos, dir, speed * dt + 0.3f);
            var delta = Vector3.ClampMagnitude(next - Pos, speed * dt);
            if (delta.sqrMagnitude < 0.00001f)
            {
                // Blocked: walk the hero's path instead (they always take a walkable one).
                delta = Vector3.ClampMagnitude((HeroActor.I.Pos - Pos).Flat(), speed * dt);
            }
            Move(delta);
            Face(dir);
        }

        protected override void Die(Actor killer)
        {
            // Companions flee instead of dying.
            life = 1;
            fleeUntil = Time.time + 20f;
            GameManager.I.Toast($"{P.name} has fled! Back in 20 seconds.");
        }
    }

    /// <summary>A Hexweaver's thrall: a temporary ally.</summary>
    public sealed class MinionActor : Actor
    {
        HeroActor owner;
        SkillCast cast;
        float until, nextAttack;
        Actor foe;

        public static void Spawn(HeroActor h, SkillCast c, Vector3 at)
        {
            var go = new GameObject("Thrall");
            go.transform.position = World.ClampToFloor(at);
            var m = go.AddComponent<MinionActor>();
            m.team = Team.Hero; m.owner = h; m.cast = c;
            m.until = Time.time + Mathf.Max(5, c.duration);
            m.maxLife = m.life = h.maxLife * 0.5f;
            m.radius = 0.4f;
            m.body = new GameObject("body").transform;
            m.body.SetParent(go.transform, false);
            Art.Wraith(m.body, Art.Element(c.element) * 0.6f + new Color(0.2f, 0.2f, 0.35f), 1.6f);
            Fx.Burst(go.transform.position + Vector3.up, Art.Element(c.element), 1.5f);
        }

        protected override void Update()
        {
            base.Update();
            if (GameManager.I.Paused) return;
            if (Time.time > until || owner == null || owner.Dead) { Die(null); return; }
            float dt = Time.deltaTime;
            if (foe == null || !foe.Targetable) foe = Nearest(Team.Hero, Pos, 12f);
            if (foe == null)
            {
                var to = (owner.Pos - Pos).Flat();
                if (to.magnitude > 2.5f) Move(World.Sweep(Pos, to, 6 * dt) - Pos);
                return;
            }
            var d = (foe.Pos - Pos).Flat();
            Face(d);
            if (d.magnitude > 1.8f + foe.radius) Move(World.Sweep(Pos, d, 6 * dt) - Pos);
            else if (Time.time >= nextAttack)
            {
                nextAttack = Time.time + 1f;
                var hit = Combat.HeroHit(owner.Ctx, cast, foe.IsElite, owner.Rng, 0.4f * (1 + owner.stats[Stat.PetDamage] / 100f));
                foe.TakeDamage(hit, owner);
            }
        }

        protected override void Die(Actor killer)
        {
            if (Dead) return;
            Dead = true;
            Fx.Burst(Pos + Vector3.up, Color.white, 1.2f);
            Destroy(gameObject);
        }
    }
}
