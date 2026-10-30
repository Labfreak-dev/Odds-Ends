using Hollowmere.Core;
using UnityEngine;

namespace Hollowmere
{
    /// <summary>Throwaway visual effects built from primitives: expanding rings, bursts, beams,
    /// floating numbers. Cheap enough for mobile and needs no art.</summary>
    public static class Fx
    {
        static Font font;

        public static Font UiFont()
        {
            if (font != null) return font;
            try { font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf"); } catch { }
            if (font == null) try { font = Resources.GetBuiltinResource<Font>("Arial.ttf"); } catch { }
            if (font == null) font = Font.CreateDynamicFontFromOSFont("Arial", 32);
            return font;
        }

        public static void Ring(Vector3 at, float radius, Color c, float seconds = 0.35f)
        {
            var g = Art.Cylinder(null, at + Vector3.up * 0.05f, new Vector3(0.2f, 0.02f, 0.2f), Art.Mat(new Color(c.r, c.g, c.b, 1), 1.5f));
            g.AddComponent<FxLife>().Init(seconds, Vector3.one * 0.2f, new Vector3(radius * 2, 0.02f, radius * 2));
        }

        public static void Burst(Vector3 at, Color c, float size = 0.6f, float seconds = 0.25f)
        {
            var g = Art.Sphere(null, at, Vector3.one * size * 0.3f, Art.Mat(c, 2f));
            g.AddComponent<FxLife>().Init(seconds, Vector3.one * size * 0.3f, Vector3.one * size);
        }

        public static void Beam(Vector3 a, Vector3 b, Color c, float width = 0.12f, float seconds = 0.15f)
        {
            var mid = (a + b) * 0.5f;
            float len = Vector3.Distance(a, b);
            if (len < 0.01f) return;
            var g = Art.Cube(null, mid, new Vector3(width, width, len), Art.Mat(c, 2.5f), Quaternion.LookRotation(b - a));
            g.AddComponent<FxLife>().Init(seconds, g.transform.localScale, new Vector3(0.01f, 0.01f, len));
        }

        public static void Text(Vector3 at, string text, Color c, float size = 1f, float seconds = 0.9f)
        {
            var g = new GameObject("ftext");
            g.transform.position = at + new Vector3(Random.Range(-0.3f, 0.3f), 2.2f, 0);
            var tm = g.AddComponent<TextMesh>();
            tm.font = UiFont();
            tm.GetComponent<MeshRenderer>().sharedMaterial = tm.font.material;
            tm.text = text;
            tm.fontSize = 64;
            tm.characterSize = 0.05f * size;
            tm.anchor = TextAnchor.MiddleCenter;
            tm.color = c;
            var cam = Camera.main;
            if (cam != null) g.transform.rotation = cam.transform.rotation;
            g.AddComponent<FxLife>().Init(seconds, Vector3.one, Vector3.one, rise: 1.6f);
        }

        public static void Damage(Vector3 at, Hit h, bool onHero)
        {
            var c = onHero ? new Color(1f, 0.3f, 0.3f) : h.crit ? new Color(1f, 0.85f, 0.2f) : Art.Element(h.element);
            Text(at, (h.crit ? "!" : "") + Short(h.amount), c, h.crit ? 1.5f : 1f);
        }

        public static string Short(float v)
        {
            if (v >= 1e9f) return (v / 1e9f).ToString("0.0") + "B";
            if (v >= 1e6f) return (v / 1e6f).ToString("0.0") + "M";
            if (v >= 1e4f) return (v / 1e3f).ToString("0") + "K";
            return Mathf.RoundToInt(v).ToString();
        }
    }

    public sealed class FxLife : MonoBehaviour
    {
        float t, life, rise;
        Vector3 from, to;
        Renderer rend;
        TextMesh tm;

        public void Init(float seconds, Vector3 fromScale, Vector3 toScale, float rise = 0)
        {
            life = seconds; from = fromScale; to = toScale; this.rise = rise;
            rend = GetComponent<Renderer>();
            tm = GetComponent<TextMesh>();
        }

        void Update()
        {
            t += Time.deltaTime;
            float k = Mathf.Clamp01(t / life);
            if (tm == null) transform.localScale = Vector3.Lerp(from, to, k);
            if (rise != 0) transform.position += Vector3.up * rise * Time.deltaTime;
            if (tm != null) { var c = tm.color; c.a = 1 - k * k; tm.color = c; }
            if (t >= life) Destroy(gameObject);
        }
    }
}
