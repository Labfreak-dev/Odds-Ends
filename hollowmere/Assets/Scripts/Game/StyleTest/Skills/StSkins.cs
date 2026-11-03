using System.Collections.Generic;
using UnityEngine;

namespace Hollowmere.StyleTest.Skills
{
    /// <summary>Subclass outfit skins = palette recolours of the existing KayKit outfits (no new models). KayKit characters
    /// use a gradient-swatch atlas, so a per-pixel remap by hue band keeps the shading and swaps the cloth colours:
    /// the class's main cloth hue -> 'main', other saturated accents -> 'accent', neutral metal -> tinted metal,
    /// skin tones untouched. Weapons (same atlas family) are recoloured too.</summary>
    public static class StSkins
    {
        public class Recipe
        {
            public string id; public float mainHue, mainWidth = 50; public Color main, accent, metalTint; public float metalAmt, metalGain = 1, leatherGain = 1, mainGain = 1, leatherAmt; public Color leatherTint;
        }

        public static readonly Dictionary<string, Recipe> Recipes = new Dictionary<string, Recipe>
        {
            // knight's red cloth -> sky-blue tabard; blue/gold accents -> gold; steel -> warm white-gold plate
            { "paladin", new Recipe { id = "paladin", mainHue = 355, main = new Color(0.42f, 0.66f, 0.95f), accent = new Color(1f, 0.8f, 0.3f), metalTint = new Color(1f, 0.96f, 0.84f), metalAmt = 0.6f, metalGain = 1.38f } },
            // ranger's green cloth -> amber long coat; other accents -> off-white; leather a touch lighter
            { "sharpshooter", new Recipe { id = "sharpshooter", mainHue = 205, mainWidth = 45, main = new Color(1f, 0.62f, 0.12f), accent = new Color(1f, 0.75f, 0.3f), metalTint = new Color(1f, 0.85f, 0.6f), metalAmt = 0.3f, metalGain = 1.1f, leatherGain = 0.62f, leatherTint = new Color(0.55f, 0.32f, 0.12f), leatherAmt = 0.45f } },
            // mage's violet robe -> ember red; magenta/blue accents -> orange; metal/greys -> charcoal
            { "fire_wizard", new Recipe { id = "fire_wizard", mainHue = 255, mainWidth = 60, main = new Color(0.72f, 0.14f, 0.07f), accent = new Color(1f, 0.55f, 0.12f), metalTint = new Color(0.45f, 0.32f, 0.28f), metalAmt = 0.5f, metalGain = 0.6f, leatherGain = 0.75f, mainGain = 1.1f } },
        };

        static readonly Dictionary<string, Texture2D> cache = new Dictionary<string, Texture2D>();

        static Texture2D Readable(Texture src)
        {
            var rt = RenderTexture.GetTemporary(src.width, src.height, 0, RenderTextureFormat.ARGB32, RenderTextureReadWrite.sRGB);
            Graphics.Blit(src, rt); var prev = RenderTexture.active; RenderTexture.active = rt;
            var t = new Texture2D(src.width, src.height, TextureFormat.RGBA32, false); t.ReadPixels(new Rect(0, 0, src.width, src.height), 0, 0); t.Apply();
            RenderTexture.active = prev; RenderTexture.ReleaseTemporary(rt); return t;
        }

        static float HueDist(float a, float b) { float d = Mathf.Abs(a - b) % 360; return d > 180 ? 360 - d : d; }

        public static Texture2D Recolour(Texture src, Recipe r)
        {
            var key = src.name + "|" + r.id; if (cache.TryGetValue(key, out var hit) && hit) return hit;
            var t = Readable(src); var px = t.GetPixels32();
            for (int i = 0; i < px.Length; i++)
            {
                Color c = px[i]; Color.RGBToHSV(c, out float h, out float s, out float v); float hd = h * 360;
                bool skin = hd >= 12 && hd <= 42 && s > 0.15f && s < 0.55f && v > 0.72f;
                bool leather = hd >= 5 && hd <= 45 && s >= 0.2f && v <= 0.72f;
                Color o;
                if (skin) o = c;
                else if (s < 0.16f) o = Color.Lerp(c, new Color(v, v, v) * r.metalTint * 1.15f, r.metalAmt) * r.metalGain;
                else if (leather) o = Color.Lerp(c, r.leatherTint * (0.4f + v), r.leatherAmt) * r.leatherGain;
                else if (HueDist(hd, r.mainHue) <= r.mainWidth) o = r.main * (0.3f + 0.95f * v) * r.mainGain;
                else o = r.accent * (0.3f + 0.9f * v);
                o.a = c.a; px[i] = o;
            }
            t.SetPixels32(px); t.Apply(true); t.name = key; t.filterMode = FilterMode.Bilinear; cache[key] = t; return t;
        }

        /// <summary>Recolours every renderer under the actor (outfit + weapons). Base materials stay untouched (instances).</summary>
        public static void Apply(StActor a, string subclass)
        {
            if (a == null || string.IsNullOrEmpty(subclass) || !Recipes.TryGetValue(subclass, out var r)) return;
            foreach (var rend in a.GetComponentsInChildren<Renderer>(true))
            {
                if (rend is ParticleSystemRenderer || rend.gameObject.layer == 2) continue;
                var mats = rend.sharedMaterials; bool changed = false;
                for (int i = 0; i < mats.Length; i++)
                {
                    var m = mats[i]; if (m == null) continue;
                    Texture tex = m.HasProperty("_BaseMap") ? m.GetTexture("_BaseMap") : null; if (tex == null) tex = m.mainTexture; if (tex == null) continue;
                    var nm = new Material(m) { name = m.name + "_" + subclass }; var rec = Recolour(tex, r);
                    if (nm.HasProperty("_BaseMap")) nm.SetTexture("_BaseMap", rec); if (nm.HasProperty("_MainTex")) nm.SetTexture("_MainTex", rec);
                    mats[i] = nm; changed = true;
                }
                if (changed) rend.sharedMaterials = mats;
            }
        }
    }
}
