using Hollowmere.Core;
using UnityEngine;

namespace Hollowmere
{
    /// <summary>Hit-stop and screen shake from the presentation tables. Actors pause; the UI clock does not.</summary>
    public static class CombatClock
    {
        public static float HoldUntil;
        static float amplitude;
        static Vector3 axis = Vector3.right;
        const string Pref = "hollowmere.shake";

        public static bool Frozen => Time.time < HoldUntil;

        public static bool ShakeOn
        {
            get => PlayerPrefs.GetInt(Pref, Present.Active.shakeEnabled) != 0;
            set { PlayerPrefs.SetInt(Pref, value ? 1 : 0); if (!value) amplitude = 0f; }
        }

        public static void Hold(string kind)
        {
            float end = Time.time + DesignTable.HitStopMs(kind) / 1000f;
            if (end > HoldUntil) HoldUntil = end;
        }

        public static void Shake(string kind)
        {
            if (!ShakeOn) return;
            float add = DesignTable.ShakeMm(kind) / 1000f;
            float cap = Present.Active.shakeCap / 1000f;
            amplitude = Mathf.Min(cap, amplitude + add);
            axis = new Vector3(Random.Range(-1f, 1f), Random.Range(-0.25f, 0.25f), Random.Range(-1f, 1f));
            if (axis.sqrMagnitude < 0.01f) axis = Vector3.right;
            axis.Normalize();
        }

        public static void Punch(string kind)
        {
            Hold(kind);
            Shake(kind);
        }

        public static Vector3 Offset(float dt)
        {
            float decay = Mathf.Max(0.01f, Present.Active.shakeDecay);
            amplitude *= Mathf.Exp(-decay * dt);
            if (amplitude < 0.0005f) amplitude = 0f;
            return axis * amplitude;
        }
    }

    /// <summary>One placeholder per cast skill. A drop-in prefab at Resources/Vfx/{id} wins.</summary>
    public static class SkillVfx
    {
        public static void Play(HeroActor hero, SkillCast cast, Vector3 dir)
        {
            if (cast?.skill == null) return;
            var row = DesignTable.VfxFor(cast.skill.id);
            var prefab = Resources.Load<GameObject>("Vfx/" + cast.skill.id);
            var at = hero.Pos + Vector3.up * 0.9f + dir.normalized * 0.8f;
            if (prefab != null)
            {
                var go = Object.Instantiate(prefab, at, Quaternion.LookRotation(dir.sqrMagnitude > 0.01f ? dir : Vector3.forward));
                Object.Destroy(go, 1.5f);
                return;
            }
            var c = Hex(row.Hex);
            float r = Mathf.Max(0.8f, cast.radius > 0.2f ? cast.radius : cast.range * 0.25f);
            switch (row.Kind)
            {
                case "arc":
                    Fx.Ring(hero.Pos + dir * 1.1f, r, c, 0.22f);
                    break;
                case "nova":
                    Fx.Ring(hero.Pos, r, c, 0.35f);
                    Fx.Burst(hero.Pos + Vector3.up, c, r * 0.5f, 0.3f);
                    break;
                case "bolt":
                    Fx.Beam(hero.Pos + Vector3.up * 1.2f, hero.Pos + Vector3.up * 1.2f + dir.normalized * Mathf.Max(2f, r), c, 0.12f, 0.16f);
                    break;
                case "fan":
                    for (int i = -2; i <= 2; i++)
                    {
                        var d = Quaternion.Euler(0f, i * 12f, 0f) * dir;
                        Fx.Beam(hero.Pos + Vector3.up, hero.Pos + Vector3.up + d.normalized * r, c, 0.06f, 0.18f);
                    }
                    break;
                case "ground":
                    Fx.Ring(at, r, c, 0.45f);
                    Fx.Burst(at, c, 0.6f, 0.3f);
                    break;
                case "dash":
                    Fx.Burst(hero.Pos + Vector3.up * 0.6f, c, 0.8f, 0.2f);
                    break;
                case "buff":
                    Fx.Ring(hero.Pos, 1.6f, c, 0.5f);
                    break;
                case "spin":
                    Fx.Ring(hero.Pos, r, c, 0.25f);
                    break;
                case "line":
                    Fx.Beam(hero.Pos + Vector3.up * 0.2f, hero.Pos + dir.normalized * Mathf.Max(4f, cast.range), c, 0.35f, 0.28f);
                    break;
                case "chain":
                    Fx.Burst(at, c, 0.7f, 0.22f);
                    Fx.Beam(hero.Pos + Vector3.up, at + Vector3.up, c, 0.08f, 0.16f);
                    break;
                case "summon":
                    Fx.Ring(at, 1.4f, c, 0.6f);
                    Fx.Burst(at + Vector3.up, c, 1.2f, 0.4f);
                    break;
                default:
                    Fx.Burst(at, c, 1f, 0.3f);
                    break;
            }
        }

        public static Color Hex(string hex)
        {
            if (string.IsNullOrEmpty(hex)) return Color.white;
            if (hex[0] != '#') hex = "#" + hex;
            return ColorUtility.TryParseHtmlString(hex, out var c) ? c : Color.white;
        }
    }

    /// <summary>Turns a trail off after the spec hold, so the ribbon does not drag forever.</summary>
    public sealed class TrailHold : MonoBehaviour
    {
        public float until;
        TrailRenderer trail;

        public static void Arm(GameObject host, Color c)
        {
            if (host == null) return;
            var tr = host.GetComponent<TrailRenderer>();
            if (tr == null)
            {
                tr = host.AddComponent<TrailRenderer>();
                tr.material = Art.Mat(c, 2f);
            }
            var p = Present.Active;
            tr.time = p.trailLife / 1000f;
            tr.startWidth = p.trailWidth / 1000f;
            tr.endWidth = 0.005f;
            tr.colorGradient = GradientOf(c);
            tr.emitting = true;
            var hold = host.GetComponent<TrailHold>() ?? host.AddComponent<TrailHold>();
            hold.trail = tr;
            hold.until = Time.time + p.trailHold / 1000f;
        }

        static Gradient GradientOf(Color c)
        {
            var g = new Gradient();
            g.SetKeys(
                new[] { new GradientColorKey(c, 0f), new GradientColorKey(c, 1f) },
                new[] { new GradientAlphaKey(0.9f, 0f), new GradientAlphaKey(0f, 1f) });
            return g;
        }

        void Update()
        {
            if (trail != null && Time.time >= until) trail.emitting = false;
        }
    }
}
