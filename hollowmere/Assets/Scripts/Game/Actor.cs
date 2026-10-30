using System.Collections.Generic;
using Hollowmere.Core;
using UnityEngine;

namespace Hollowmere
{
    public enum Team { Hero, Monster }

    /// <summary>Anything with life that can be hit: hero, companion, thralls, monsters.
    /// Targeting uses this registry instead of physics layers, which a code-built project lacks.</summary>
    public abstract class Actor : MonoBehaviour
    {
        public static readonly List<Actor> All = new List<Actor>();

        public Team team;
        public float life, maxLife;
        public float radius = 0.5f;
        public bool Dead { get; protected set; }
        public virtual bool Targetable => !Dead && gameObject.activeInHierarchy;
        public virtual bool IsElite => false;
        public virtual int Level => 1;
        public CharacterController cc;
        protected Transform body;

        float slowUntil, slowAmount, stunUntil, hitFlash;
        readonly List<(float dps, float until, Element el, Actor src)> dots = new List<(float, float, Element, Actor)>();

        public Vector3 Pos => transform.position;
        public bool Stunned => Time.time < stunUntil;
        public float SpeedMult => Time.time < slowUntil ? 1 - slowAmount : 1;
        public float LifeFraction => maxLife > 0 ? Mathf.Clamp01(life / maxLife) : 0;

        protected virtual void OnEnable() { if (!All.Contains(this)) All.Add(this); }
        protected virtual void OnDisable() { All.Remove(this); }

        protected void SetupController(float r, float h)
        {
            radius = r;
            cc = gameObject.AddComponent<CharacterController>();
            cc.radius = r;
            cc.height = Mathf.Max(h, r * 2 + 0.1f);
            cc.center = new Vector3(0, cc.height / 2, 0);
            cc.slopeLimit = 0; cc.stepOffset = 0;
            cc.skinWidth = 0.05f;
        }

        public void Move(Vector3 delta)
        {
            delta.y = 0;
            if (cc != null && cc.enabled) cc.Move(delta);
            else transform.position += delta;
            var p = transform.position;
            if (Mathf.Abs(p.y) > 0.001f) transform.position = new Vector3(p.x, 0, p.z);
        }

        public void Teleport(Vector3 to)
        {
            bool was = cc != null && cc.enabled;
            if (was) cc.enabled = false;
            transform.position = new Vector3(to.x, 0, to.z);
            if (was) cc.enabled = true;
        }

        public void Face(Vector3 dir)
        {
            dir.y = 0;
            if (dir.sqrMagnitude > 0.0001f) transform.rotation = Quaternion.LookRotation(dir);
        }

        public virtual void TakeDamage(Hit h, Actor source)
        {
            if (Dead) return;
            life -= h.amount;
            hitFlash = 0.12f;
            Fx.Damage(Pos, h, team == Team.Hero && this is HeroActor);
            if (life <= 0) { life = 0; Die(source); }
        }

        public void Heal(float amount)
        {
            if (Dead || amount <= 0) return;
            life = Mathf.Min(maxLife, life + amount);
        }

        public void Slow(float amount, float seconds)
        {
            if (amount <= 0) return;
            slowAmount = Mathf.Max(Time.time < slowUntil ? slowAmount : 0, Mathf.Clamp01(amount));
            slowUntil = Mathf.Max(slowUntil, Time.time + seconds);
        }

        public virtual void Stun(float seconds)
        {
            if (seconds > 0) stunUntil = Mathf.Max(stunUntil, Time.time + seconds);
        }

        public void Burn(float total, float seconds, Element el, Actor src)
        {
            if (total > 0 && seconds > 0) dots.Add((total / seconds, Time.time + seconds, el, src));
        }

        /// <summary>A short bright pop on this body, used by Hex Bolt's impact.</summary>
        public void PunchFlash(Color c)
        {
            hitFlash = 0.2f;
            var l = new GameObject("hitflash").AddComponent<Light>();
            l.transform.position = Pos + Vector3.up * 0.9f;
            l.type = LightType.Point;
            l.color = c;
            l.range = 3.2f;
            l.intensity = 5f;
            Destroy(l.gameObject, 0.12f);
            if (body != null)
            {
                var flash = Art.Sphere(body, Vector3.up * 0.85f, Vector3.one * 0.85f, Art.Mat(Color.Lerp(c, Color.white, 0.65f), 4f));
                flash.AddComponent<FxLife>().Init(0.12f, Vector3.one * 0.7f, Vector3.one * 1.35f);
            }
        }

        public void Knockback(Vector3 dir, float dist)
        {
            if (dist <= 0 || this is HeroActor) return;
            var to = World.Sweep(Pos, dir, dist);
            Move(to - Pos);
        }

        protected abstract void Die(Actor killer);

        protected virtual void Update()
        {
            if (Dead) return;
            if (dots.Count > 0)
            {
                float dmg = 0; Element el = Element.Physical; Actor src = null;
                for (int i = dots.Count - 1; i >= 0; i--)
                {
                    var d = dots[i];
                    if (Time.time > d.until) { dots.RemoveAt(i); continue; }
                    dmg += d.dps * Time.deltaTime; el = d.el; src = d.src;
                }
                if (dmg > 0)
                {
                    life -= dmg;
                    if (life <= 0) { life = 0; Die(src); return; }
                }
            }
            if (hitFlash > 0 && body != null)
            {
                hitFlash -= Time.deltaTime;
                body.localScale = Vector3.one * (1 + Mathf.Max(0, hitFlash) * 0.8f);
            }
        }

        // ---------------- queries ----------------

        public static Actor Nearest(Team enemiesOf, Vector3 pos, float range, bool needSight = true)
        {
            Actor best = null;
            float bestD = range * range;
            foreach (var a in All)
            {
                if (a.team == enemiesOf || !a.Targetable) continue;
                float d = (a.Pos - pos).sqrMagnitude;
                if (d < bestD && (!needSight || World.Sight(pos, a.Pos))) { best = a; bestD = d; }
            }
            return best;
        }

        public static List<Actor> InRadius(Team enemiesOf, Vector3 pos, float r)
        {
            var list = new List<Actor>();
            foreach (var a in All)
            {
                if (a.team == enemiesOf || !a.Targetable) continue;
                float rr = r + a.radius;
                var d = a.Pos - pos; d.y = 0;
                if (d.sqrMagnitude <= rr * rr) list.Add(a);
            }
            return list;
        }

        public static List<Actor> InArc(Team enemiesOf, Vector3 pos, Vector3 fwd, float r, float degrees)
        {
            var list = new List<Actor>();
            fwd.y = 0; fwd.Normalize();
            float cos = Mathf.Cos(degrees * 0.5f * Mathf.Deg2Rad);
            foreach (var a in InRadius(enemiesOf, pos, r))
            {
                var d = a.Pos - pos; d.y = 0;
                if (d.sqrMagnitude < 0.5f || Vector3.Dot(d.normalized, fwd) >= cos) list.Add(a);
            }
            return list;
        }

        /// <summary>Enemies inside a rectangle starting at pos, `len` long and `halfWidth` wide.</summary>
        public static List<Actor> InLine(Team enemiesOf, Vector3 pos, Vector3 fwd, float len, float halfWidth)
        {
            var list = new List<Actor>();
            fwd.y = 0; fwd.Normalize();
            foreach (var a in All)
            {
                if (a.team == enemiesOf || !a.Targetable) continue;
                var d = a.Pos - pos; d.y = 0;
                float along = Vector3.Dot(d, fwd);
                if (along < -0.5f || along > len) continue;
                float side = (d - fwd * along).magnitude;
                if (side <= halfWidth + a.radius) list.Add(a);
            }
            return list;
        }
    }
}
