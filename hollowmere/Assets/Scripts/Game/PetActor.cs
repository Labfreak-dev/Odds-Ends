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
        ModelAnim anim;
        Vector3 followVel;
        float gaitPhase;
        bool gaitMoving, clipDriven;
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
            var m = Art.Animated(key, h, body);
            if (m == null) m = Art.Quadruped(body, P.species == PetSpecies.Hound ? new Color(0.55f, 0.55f, 0.58f) : new Color(0.75f, 0.6f, 0.4f), h);
            anim = m != null ? m.GetComponent<ModelAnim>() : null;
            clipDriven = anim != null && anim.PlaysClips;
            if (form != null && m != null)
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

            if (cc != null) cc.enabled = false;
            float dt = Time.deltaTime;
            var form = P.Form;
            float speed = 7.5f * (form?.speedMult ?? 1);

            if (GameManager.I.InTown) Follow(hero, speed, dt);
            else
            {
                if (foe == null || !foe.Targetable || (foe.Pos - hero.Pos).magnitude > 12) foe = Nearest(Team.Hero, hero.Pos, 10f);
                if (foe != null)
                {
                    var to = foe.Pos - Pos; to.y = 0;
                    if (to.magnitude > 1.6f + foe.radius) Chase(to, speed, dt);
                    else
                    {
                        SetMoving(false);
                        if (Time.time >= nextAttack && !Stunned)
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
                }
                else Follow(hero, speed, dt);
            }
            Pose(dt);
        }

        void Follow(HeroActor hero, float speed, float dt)
        {
            if (World.Map == null) { SetMoving(false); return; }
            var back = hero.transform.forward;
            back.y = 0;
            if (back.sqrMagnitude < 0.01f) back = Vector3.forward;
            back.Normalize();
            var side = hero.transform.right;
            side.y = 0;
            if (side.sqrMagnitude > 0.01f) side.Normalize();
            var slot = hero.Pos - back * 1.75f + side * 0.55f;
            if (!World.Walkable(slot)) slot = World.ClampToFloor(slot);
            if (!World.Walkable(Pos))
            {
                Teleport(World.Walkable(slot) ? slot : World.ClampToFloor(hero.Pos));
                followVel = Vector3.zero;
                SetMoving(false);
                return;
            }
            var to = slot - Pos;
            to.y = 0;
            float dist = to.magnitude;
            if (dist > 14f)
            {
                Teleport(slot);
                followVel = Vector3.zero;
                SetMoving(false);
                return;
            }
            if (dist < 0.4f)
            {
                followVel = Vector3.Lerp(followVel, Vector3.zero, dt * 8f);
                SetMoving(false);
                return;
            }
            var smoothed = Vector3.SmoothDamp(Pos, slot, ref followVel, 0.16f, speed, dt);
            var delta = smoothed - Pos;
            delta.y = 0;
            Step(delta, speed, dt);
        }

        void Chase(Vector3 to, float speed, float dt)
        {
            if (World.Map == null) { SetMoving(false); return; }
            var delta = Vector3.ClampMagnitude(to, speed * dt);
            Step(delta, speed, dt);
        }

        void Step(Vector3 delta, float speed, float dt)
        {
            if (delta.sqrMagnitude < 0.000001f) { SetMoving(false); return; }
            var dir = delta.normalized;
            float stepLen = Mathf.Min(delta.magnitude, speed * dt);
            var swept = World.Sweep(Pos, dir, stepLen);
            var step = swept - Pos;
            step.y = 0;
            if (step.sqrMagnitude < 0.000001f)
            {
                var side = Vector3.Cross(Vector3.up, dir);
                swept = World.Sweep(Pos, side, Mathf.Min(0.7f, speed * dt));
                if ((swept - Pos).sqrMagnitude < 0.000001f)
                    swept = World.Sweep(Pos, -side, Mathf.Min(0.7f, speed * dt));
                step = swept - Pos;
                step.y = 0;
            }
            float spd = dt > 0.0001f ? step.magnitude / dt : 0f;
            bool moving = spd > 0.3f;
            if (moving)
            {
                Move(step);
                Face(step);
            }
            SetMoving(moving);
        }

        void SetMoving(bool moving)
        {
            gaitMoving = moving;
            anim?.SetMoving(moving);
        }

        /// <summary>The shipped pet meshes are a single static node, so a trot versus a breathe stands in
        /// for walk and idle. A pet_*_walk clip, when one is imported, takes over and this holds still.</summary>
        void Pose(float dt)
        {
            if (body == null) return;
            var target = Vector3.zero;
            var rot = Quaternion.identity;
            if (!clipDriven)
            {
                gaitPhase += dt * (gaitMoving ? 12f : 1.8f);
                if (gaitMoving)
                {
                    float s = Mathf.Sin(gaitPhase);
                    target = new Vector3(0f, Mathf.Abs(s) * 0.08f, 0f);
                    rot = Quaternion.Euler(s * 8f, 0f, Mathf.Sin(gaitPhase * 0.5f) * 6f);
                }
                else target = new Vector3(0f, Mathf.Sin(gaitPhase) * 0.015f, 0f);
            }
            body.localPosition = Vector3.Lerp(body.localPosition, target, dt * 10f);
            body.localRotation = Quaternion.Slerp(body.localRotation, rot, dt * 10f);
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
