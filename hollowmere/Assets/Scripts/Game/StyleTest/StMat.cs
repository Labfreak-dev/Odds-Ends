using System.Collections.Generic;
using UnityEngine;

namespace Hollowmere.StyleTest
{
    /// <summary>Shared stylized import step: every town/folk/animal asset is put on the same StToon surface so the
    /// packs (KayKit, Quaternius, algumacoisaqq VK) read as one look. VK materials are rebuilt from the kit's
    /// materials.json (base map x base colour x vertex colour); other packs keep their albedo texture/colour.</summary>
    public static class StMat
    {
        public const float MetreScale = 1.6f; // real-metre kits -> KayKit world units (door ~2.1 m -> ~3.4 u, hero 3.0 u)
        static Shader toon;
        static Dictionary<string, string[]> vk;
        static readonly Dictionary<string, Material> cache = new Dictionary<string, Material>();

        public static Shader Toon => toon ? toon : (toon = Resources.Load<Shader>("ST/StToon"));

        static Dictionary<string, string[]> VK
        {
            get
            {
                if (vk != null) return vk;
                vk = new Dictionary<string, string[]>();
                var ta = Resources.Load<TextAsset>("ST/Town/VK/vk_mats");
                if (ta != null) foreach (var line in ta.text.Split('\n')) { var p = line.Trim().Split('|'); if (p.Length >= 9) vk[p[0]] = p; }
                return vk;
            }
        }

        static Color Col(string s, bool linearSrc = true)
        {
            var p = s.Split(','); var c = new Color(float.Parse(p[0], System.Globalization.CultureInfo.InvariantCulture), float.Parse(p[1], System.Globalization.CultureInfo.InvariantCulture), float.Parse(p[2], System.Globalization.CultureInfo.InvariantCulture), 1);
            return linearSrc ? c.gamma : c; // Blender colours are linear; Unity material colours are authored sRGB
        }

        public static Material Make(string key, Texture tex, Color col, bool vc, float cutoff = 0, Color emis = default, bool twoSided = false)
        {
            if (cache.TryGetValue(key, out var m) && m) return m;
            m = new Material(Toon) { name = "st_" + key };
            if (tex) m.SetTexture("_BaseMap", tex);
            m.SetColor("_BaseColor", col);
            m.SetFloat("_UseVC", vc ? 1 : 0);
            m.SetFloat("_Cutoff", cutoff);
            m.SetColor("_Emission", emis);
            m.SetFloat("_Cull", twoSided ? 0 : 2);
            cache[key] = m; return m;
        }

        public static Material Tiled(string texRes, Color tint, float tiles)
        {
            var key = "tiled_" + texRes + tiles;
            if (cache.TryGetValue(key, out var m) && m) return m;
            m = Make(key, Resources.Load<Texture2D>(texRes), tint, false);
            m.SetTextureScale("_BaseMap", new Vector2(tiles, tiles));
            return m;
        }

        /// <summary>Rebuild one VK (algumacoisaqq) piece's materials from vk_mats.</summary>
        public static void ApplyVK(GameObject g)
        {
            foreach (var r in g.GetComponentsInChildren<Renderer>())
            {
                var mats = r.sharedMaterials;
                for (int i = 0; i < mats.Length; i++)
                {
                    if (!mats[i]) continue;
                    var n = mats[i].name.Replace(" (Instance)", "");
                    int dot = n.IndexOf('.'); if (dot > 0) n = n.Substring(0, dot);
                    if (!VK.TryGetValue(n, out var p)) { Debug.LogWarning("[ST] vk mat? " + n); mats[i] = Make("vkfallback_" + n, mats[i].mainTexture, Color.white, true); continue; }
                    var tex = string.IsNullOrEmpty(p[1]) ? null : Resources.Load<Texture2D>("ST/Town/VK/Tex/" + p[1]);
                    bool clip = p[4] == "clip";
                    float es = float.Parse(p[7], System.Globalization.CultureInfo.InvariantCulture);
                    var em = es > 0 ? Col(p[8]) * es * 0.6f : Color.black;
                    mats[i] = Make("vk_" + n, tex, Col(p[2]), p[3] == "1", clip ? float.Parse(p[5], System.Globalization.CultureInfo.InvariantCulture) : 0, em, true);
                }
                r.sharedMaterials = mats;
            }
        }

        /// <summary>Generic packs (KayKit hex, Quaternius): keep albedo, move to StToon.</summary>
        public static void ApplyGeneric(GameObject g, float shade = 0.6f)
        {
            foreach (var r in g.GetComponentsInChildren<Renderer>())
            {
                var mats = r.sharedMaterials;
                for (int i = 0; i < mats.Length; i++)
                {
                    var o = mats[i]; if (!o) continue;
                    Texture tex = o.HasProperty("_BaseMap") ? o.GetTexture("_BaseMap") : o.mainTexture;
                    Color c = o.HasProperty("_BaseColor") ? o.GetColor("_BaseColor") : (o.HasProperty("_Color") ? o.color : Color.white);
                    var m = Make("gen_" + o.name + "_" + (tex ? tex.name : "none") + "_" + ColorUtility.ToHtmlStringRGB(c), tex, c, false);
                    m.SetFloat("_Shade", shade);
                    mats[i] = m;
                }
                r.sharedMaterials = mats;
            }
        }

        /// <summary>Unlit-ish quad material for 2D art (itch icons, banners, paintings) placed in the world.</summary>
        public static Material Picture(Texture tex, bool cutout = true)
        {
            var key = "pic_" + (tex ? tex.name : "none");
            if (cache.TryGetValue(key, out var m) && m) return m;
            m = Make(key, tex, Color.white, false, cutout ? 0.4f : 0, default, true);
            m.SetFloat("_SelfLit", 0.6f);
            return m;
        }
    }
}
