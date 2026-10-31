using Hollowmere.Core;
using UnityEngine;
using UnityEngine.AI;

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
        NavMeshAgent agent;
        readonly Locomotion loco = new Locomotion();
        float gaitPhase, stuckFor;
        bool clipDriven;
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
            p.cc.enabled = false; // the companion slips past monsters; the navmesh keeps it on the floor
            p.agent = go.AddComponent<NavMeshAgent>();
            p.agent.radius = 0.3f;
            p.agent.height = 0.8f;
            p.agent.baseOffset = 0f;
            p.agent.angularSpeed = 0f;
            p.agent.updateRotation = false;
            p.agent.updatePosition = false;
            p.agent.autoBraking = false;
            p.agent.stoppingDistance = 0.05f;
            p.agent.obstacleAvoidanceType = ObstacleAvoidanceType.NoObstacleAvoidance;
            I = p;
            p.Rebuild();
            p.RefreshLife(true);
            if (FloorNav.Ready && p.agent != null) p.agent.Warp(go.transform.position);
            Sfx.Pet("summon");
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
                if (show)
                {
                    // Reappearing beside the hero is a warp, and the player is looking at that spot.
                    WarpTo(Slot(hero), true);
                    life = maxLife;
                    Sfx.Pet("summon");
                }
            }
            if (!show) return;

            if (cc != null) cc.enabled = false;
            float dt = Time.deltaTime;
            var form = P.Form;
            float speedMult = form?.speedMult ?? 1f;

            if (!GameManager.I.InTown)
            {
                if (foe == null || !foe.Targetable || (foe.Pos - hero.Pos).magnitude > 12) foe = Nearest(Team.Hero, hero.Pos, 10f);
                if (foe != null)
                {
                    var to = foe.Pos - Pos; to.y = 0;
                    if (to.magnitude > 1.6f + foe.radius) Seek(foe.Pos, 7.5f * speedMult, dt, false);
                    else
                    {
                        loco.Step(this, Vector3.zero, 0f, dt, to, false, true, false);
                        if (Time.time >= nextAttack && !Stunned)
                        {
                            nextAttack = Time.time + 0.9f;
                            var hit = Combat.PetHit(hero.Ctx, 0.35f * (form?.damageMult ?? 1), form?.element ?? Element.Physical, rng);
                            foe.TakeDamage(hit, hero);
                            if (form != null && form.aoeRadius > 0)
                            {
                                foreach (var a in InRadius(Team.Hero, foe.Pos, form.aoeRadius))
                                    if (a != foe) a.TakeDamage(new Hit { amount = hit.amount * 0.6f, element = hit.element }, hero);
                                Fx.Ring(foe.Pos, form.aoeRadius, Art.Hex(form.color), 0.25f);
                            }
                            if (form != null && form.slow > 0) foe.Slow(form.slow, 2);
                            anim?.BeginAttack(false);
                            Sfx.Pet("attack");
                        }
                    }
                    Pose(dt);
                    return;
                }
            }
            var slot = Slot(hero);
            float dist = Flat(slot - Pos).magnitude;
            float follow = (float)DesignTable.FollowSpeed((decimal)dist) * speedMult;
            float cap = Feel.Active.maxSpeed * Mathf.Max(1f, speedMult);
            Seek(slot, Mathf.Min(cap, follow), dt, true);
            Pose(dt);
        }

        static Vector3 Flat(Vector3 v) => new Vector3(v.x, 0f, v.z);

        Vector3 Slot(HeroActor hero)
        {
            var f = Feel.Active;
            var back = hero.transform.forward;
            back.y = 0f;
            if (back.sqrMagnitude < 0.01f) back = Vector3.forward;
            back.Normalize();
            var side = hero.transform.right;
            side.y = 0f;
            if (side.sqrMagnitude > 0.01f) side.Normalize();
            var slot = hero.Pos - back * f.trailBack + side * f.trailSide;
            if (!World.Walkable(slot)) slot = World.ClampToFloor(slot);
            return slot;
        }

        /// <summary>Path toward a point. Warp only when stuck, or off the mesh past the spec distance.</summary>
        void Seek(Vector3 goal, float wishSpeed, float dt, bool followSlot)
        {
            var f = Feel.Active;
            Vector3 steer = Flat(goal - Pos);
            float dist = steer.magnitude;
            bool onMesh = false;
            if (agent != null && FloorNav.Ready)
            {
                if (!agent.isOnNavMesh)
                {
                    if (NavMesh.SamplePosition(Pos, out var near, f.sample, NavMesh.AllAreas))
                    {
                        // A short slide onto the mesh is not a warp.
                        if (Flat(near.position - Pos).magnitude > 0.05f) Teleport(near.position);
                        agent.Warp(transform.position);
                    }
                    else if (dist > f.warp)
                    {
                        WarpTo(goal, false);
                        return;
                    }
                }
                if (agent.isOnNavMesh)
                {
                    onMesh = true;
                    agent.nextPosition = transform.position;
                    agent.speed = Mathf.Max(wishSpeed, 0.1f);
                    agent.SetDestination(goal);
                    if (agent.hasPath)
                    {
                        var s = Flat(agent.steeringTarget - Pos);
                        if (s.sqrMagnitude > 0.01f) steer = s;
                    }
                }
            }
            if (!onMesh && dist > f.warp && !World.Walkable(Pos))
            {
                WarpTo(goal, false);
                return;
            }
            float wish = wishSpeed;
            if (followSlot && dist < f.arrive) wish = 0f;
            var face = steer.sqrMagnitude > 0.01f ? steer : Vector3.zero;
            loco.Step(this, face, wish, dt, face, false, !onMesh, false);
            if (agent != null && agent.isOnNavMesh) agent.nextPosition = transform.position;

            bool trying = wish > f.idle;
            if (trying && loco.groundSpeed < f.idle) stuckFor += dt;
            else stuckFor = 0f;
            if (stuckFor >= f.stuck) WarpTo(goal, false);
        }

        void WarpTo(Vector3 dest, bool forcePoof)
        {
            var f = Feel.Active;
            if (NavMesh.SamplePosition(dest, out var hit, f.sample, NavMesh.AllAreas))
                dest = hit.position;
            else if (World.Map != null) dest = World.ClampToFloor(dest);
            Vector3 from = Pos;
            bool seen = forcePoof || OnScreen(from) || OnScreen(dest);
            bool warped = agent != null && agent.isOnNavMesh && agent.Warp(dest);
            if (!warped)
            {
                Teleport(dest);
                if (agent != null && FloorNav.Ready) agent.Warp(transform.position);
            }
            else transform.position = new Vector3(dest.x, 0f, dest.z);
            if (agent != null) agent.nextPosition = transform.position;
            loco.velocity = Vector3.zero;
            stuckFor = 0f;
            if (!seen) return;
            var puff = new Color(0.75f, 0.88f, 1f);
            Fx.Burst(from + Vector3.up * 0.45f, puff, 1.15f, 0.4f);
            Fx.Burst(transform.position + Vector3.up * 0.45f, puff, 1.15f, 0.4f);
        }

        static bool OnScreen(Vector3 p)
        {
            var cam = Camera.main;
            if (cam == null) return true;
            var v = cam.WorldToViewportPoint(p + Vector3.up * 0.5f);
            return v.z > 0f && v.x > -0.05f && v.x < 1.05f && v.y > -0.05f && v.y < 1.05f;
        }

        /// <summary>The shipped pet meshes are a single static node, so a trot versus a breathe stands in
        /// for walk and idle. A pet clip, when one is imported, takes over and this holds still.</summary>
        void Pose(float dt)
        {
            if (body == null) return;
            if (clipDriven && anim != null)
            {
                anim.Tick(loco.groundSpeed, dt);
                body.localPosition = Vector3.Lerp(body.localPosition, Vector3.zero, dt * 10f);
                body.localRotation = Quaternion.Slerp(body.localRotation, Quaternion.identity, dt * 10f);
                return;
            }
            float speed = loco.groundSpeed;
            bool moving = speed > Feel.Active.idle;
            float rate = moving ? Mathf.Lerp(6f, 14f, Mathf.Clamp01(speed / Mathf.Max(0.1f, Feel.Active.clipWalk))) : 1.8f;
            gaitPhase += dt * rate;
            var target = Vector3.zero;
            var rot = Quaternion.identity;
            if (moving)
            {
                float s = Mathf.Sin(gaitPhase);
                target = new Vector3(0f, Mathf.Abs(s) * 0.08f, 0f);
                rot = Quaternion.Euler(s * 8f, 0f, Mathf.Sin(gaitPhase * 0.5f) * 6f);
            }
            else target = new Vector3(0f, Mathf.Sin(gaitPhase) * 0.015f, 0f);
            if (anim != null && anim.Attacking && !anim.HasAttackClip)
                target.z += 0.22f * Mathf.Sin(anim.AttackUnit * Mathf.PI);
            body.localPosition = Vector3.Lerp(body.localPosition, target, dt * 10f);
            body.localRotation = Quaternion.Slerp(body.localRotation, rot, dt * 10f);
        }

        public override void TakeDamage(Hit h, Actor source)
        {
            if (Dead || h.amount <= 0f) return;
            base.TakeDamage(h, source);
            Sfx.Pet("hurt");
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
