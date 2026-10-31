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
            var cinzel = UiArt.LabelFont;
            if (cinzel != null) { font = cinzel; return font; }
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

        public static void Impact(Vector3 at, Color c, Actor target)
        {
            Flip(at + Vector3.up * 0.8f, c, "explosion_flipbook_3x3", 3, 3, 9, 1.8f);
            Burst(at + Vector3.up * 0.6f, c, 1.5f, 0.28f, "slash_01");
            Ring(at, 1.5f, c, 0.32f);
            for (int i = 0; i < 5; i++)
            {
                var off = new Vector3(Mathf.Sin(i * 1.3f), 0.4f + i * 0.05f, Mathf.Cos(i * 1.7f)) * 0.35f;
                Burst(at + off, c, 0.28f, 0.18f);
            }
            if (target != null) target.PunchFlash(c);
        }

        /// <summary>Hex Bolt's hit: the additive impact sheet, a soft glow, and a fading point light.</summary>
        public static void HexImpact(Vector3 at, Color c, Actor target)
        {
            var host = new GameObject("hexImpact");
            host.transform.position = at + Vector3.up * 1.05f;
            // The bolt sheet is a violet hexagram. The impact is a soft round glow only.
            var sprite = Art.VfxSprite(host.transform, 1.8f, c, "magic_01");
            var mr = sprite.GetComponent<MeshRenderer>();
            if (mr != null && mr.sharedMaterial != null)
            {
                var mat = new Material(mr.sharedMaterial);
                if (mat.HasProperty("_Soft")) mat.SetFloat("_Soft", 1f);
                if (mat.HasProperty("_HasMap")) mat.SetFloat("_HasMap", 0f);
                if (mat.HasProperty("_UseVertexColor")) mat.SetFloat("_UseVertexColor", 0f);
                if (mat.HasProperty("_BaseColor")) mat.SetColor("_BaseColor", c);
                mr.sharedMaterial = mat;
            }
            sprite.AddComponent<FxLife>().Init(0.35f, Vector3.one * 1.2f, Vector3.one * 2.2f);
            var l = host.AddComponent<Light>();
            l.type = LightType.Point;
            l.color = c;
            l.range = 11f;
            l.intensity = 8f;
            host.AddComponent<LightFade>().Init(0.42f, 8f);
            if (target != null) target.PunchFlash(c);
        }

        public static void Burst(Vector3 at, Color c, float size = 0.6f, float seconds = 0.25f, string tex = "spark_04")
        {
            var g = Art.VfxSprite(null, size, c, tex);
            g.transform.position = at;
            g.AddComponent<FxLife>().Init(seconds, Vector3.one * size * 0.6f, Vector3.one * size * 1.4f);
        }

        /// <summary>Kenney flipbook. Columns and rows match the sheet (3x3 explosion and flash, 5x5 smoke).</summary>
        public static void Flip(Vector3 at, Color c, string texName, int columns, int rows, int count, float size)
        {
            var tex = Art.VfxTex(texName);
            if (tex == null) return;
            var go = Art.VfxSprite(null, size, c, texName);
            go.transform.position = at;
            var mr = go.GetComponent<MeshRenderer>();
            var play = go.AddComponent<SheetPlay>();
            play.mat = mr != null ? mr.material : null;
            play.columns = columns;
            play.rows = rows;
            play.count = count;
            play.fps = 16;
            play.life = count / 16f + 0.05f;
        }

        /// <summary>Element flipbooks. Fire, frost, lightning and poison are additive. Arcane uses the shadow sheet with alpha.</summary>
        public static void Magic(Vector3 at, Element el)
        {
            string tex;
            bool alpha;
            switch (el)
            {
                case Element.Fire: tex = "fire_flipbook_4x4"; alpha = false; break;
                case Element.Frost: tex = "frost_flipbook_4x4"; alpha = false; break;
                case Element.Lightning: tex = "lightning_flipbook_4x4"; alpha = false; break;
                case Element.Poison: tex = "poison_flipbook_4x4"; alpha = false; break;
                case Element.Arcane: tex = "shadow_flipbook_4x4"; alpha = true; break;
                default: return;
            }
            if (Art.VfxTex(tex) == null) return;
            var go = Art.VfxSprite(null, 1.6f, Color.white, tex);
            go.transform.position = at;
            if (alpha)
            {
                var sheet = Resources.Load<Material>("HollowmereSheet");
                var mr = go.GetComponent<MeshRenderer>();
                if (sheet != null && mr != null)
                {
                    var m = new Material(sheet);
                    var map = Art.VfxTex(tex);
                    m.mainTexture = map;
                    if (m.HasProperty("_MainTex")) m.SetTexture("_MainTex", map);
                    if (m.HasProperty("_Color")) m.SetColor("_Color", Color.white);
                    mr.sharedMaterial = m;
                }
            }
            var play = go.AddComponent<SheetPlay>();
            var rend = go.GetComponent<MeshRenderer>();
            play.mat = rend != null ? rend.material : null;
            play.columns = 4;
            play.rows = 4;
            play.count = 16;
            play.fps = 16;
            play.life = 1.05f;
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
            StyleWorldText(g.AddComponent<TextMesh>(), text, c, 64, 0.05f * size);
            g.AddComponent<FaceCamera>();
            g.AddComponent<FxLife>().Init(seconds, Vector3.one, Vector3.one, rise: 1.6f);
        }

        /// <summary>World-space name. TextMesh faces along its -Z, so matching the camera's rotation
        /// shows the front of the glyphs. A one-shot copy is wrong: labels are created before the
        /// rig aims, and the NPC is then yawed 180, which leaves the text mirrored.</summary>
        public static TextMesh WorldLabel(Transform parent, Vector3 localPos, string text, Color color, int fontSize, float characterSize)
        {
            var lab = new GameObject("label");
            lab.transform.SetParent(parent, false);
            lab.transform.localPosition = localPos;
            var tm = StyleWorldText(lab.AddComponent<TextMesh>(), text, color, fontSize, characterSize);
            lab.AddComponent<FaceCamera>();
            return tm;
        }

        public static TextMesh StyleWorldText(TextMesh tm, string text, Color color, int fontSize, float characterSize)
        {
            tm.font = UiFont();
            tm.text = text;
            tm.fontSize = fontSize;
            tm.characterSize = characterSize;
            tm.anchor = TextAnchor.MiddleCenter;
            tm.color = color;
            var rend = tm.GetComponent<MeshRenderer>();
            var src = Resources.Load<Material>("HollowmereText");
            if (src != null)
            {
                var mat = new Material(src);
                if (tm.font != null && tm.font.material != null && tm.font.material.mainTexture != null)
                    mat.mainTexture = tm.font.material.mainTexture;
                rend.sharedMaterial = mat;
            }
            else if (tm.font != null)
                rend.sharedMaterial = tm.font.material;
            return tm;
        }

        public static void Damage(Vector3 at, Hit h, bool onHero)
        {
            string style = onHero ? "hurt" : h.crit ? "crit" : "normal";
            var spec = DesignTable.Number(style);
            var c = Art.Hex("#" + spec.Hex);
            CombatNumbers.Spawn(at, (h.crit ? "!" : "") + Short(h.amount), style, c);
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

    /// <summary>Point light that dims and then removes its object. Used by Hex Bolt's impact.</summary>
    public sealed class LightFade : MonoBehaviour
    {
        float t, life, intensity;
        Light light;

        public void Init(float seconds, float from)
        {
            life = Mathf.Max(0.05f, seconds);
            intensity = from;
            light = GetComponent<Light>();
        }

        void Update()
        {
            t += Time.deltaTime;
            if (light != null) light.intensity = intensity * (1f - Mathf.Clamp01(t / life));
            if (t >= life) Destroy(gameObject);
        }
    }

    /// <summary>Keep a world-space label facing the camera. Runs after the rig writes its rotation.</summary>
    [DefaultExecutionOrder(200)]
    public sealed class FaceCamera : MonoBehaviour
    {
        void LateUpdate()
        {
            var cam = Camera.main;
            if (cam != null) transform.rotation = cam.transform.rotation;
        }
    }
}
