using Hollowmere.Core;
using UnityEngine;

namespace Hollowmere
{
    /// <summary>Town ground material (Hollowmere/GroundBlend) and the continuous cobble-path field it reads from vertex colour.</summary>
    public static class TownGround
    {
        public static Material Material()
        {
            var sh = Shader.Find("Hollowmere/GroundBlend");
            if (sh == null) { Debug.LogError("Hollowmere floor FAIL GroundBlend shader missing, tile checker fallback"); return null; }
            var m = new Material(sh) { name = "townGround" };
            Set(m, "_CobbleMap", "town_cobble", "basecolor"); Set(m, "_CobbleNormal", "town_cobble", "normal_gl"); Set(m, "_CobbleAo", "town_cobble", "ao");
            Set(m, "_DirtMap", "dirt_path", "basecolor"); Set(m, "_DirtNormal", "dirt_path", "normal_gl");
            Set(m, "_GrassMap", "meadow_grass", "basecolor"); Set(m, "_GrassNormal", "meadow_grass", "normal_gl");
            return m;
        }

        static void Set(Material m, string prop, string folder, string suffix)
        {
            var t = Resources.Load<Texture2D>("PbrKit/materials/" + folder + "/" + folder + "_" + suffix);
            if (t != null) m.SetTexture(prop, t);
            else Debug.LogWarning("Hollowmere floor missing " + folder + "_" + suffix);
        }

        /// <summary>0 = dirt/grass, 1 = cobble. A central plaza, two meandering streets and a lane to the entry.</summary>
        public static float PathWeight(Vector3 w, DungeonMap map)
        {
            float cx = map.width * World.T * 0.5f, cz = map.height * World.T * 0.5f;
            var e = new Vector2(map.entry.x * World.T, map.entry.y * World.T);
            var c = new Vector2(cx, cz);
            var p = new Vector2(w.x, w.z);
            float plaza = 1f - Mathf.SmoothStep(6.5f, 9.5f, Vector2.Distance(p, c));
            float streetA = 1f - Mathf.SmoothStep(1.5f, 2.6f, Mathf.Abs(w.z - (cz + 2.8f * Mathf.Sin(w.x * 0.14f))));
            float streetB = 1f - Mathf.SmoothStep(1.3f, 2.3f, Mathf.Abs(w.x - (cx + 3.2f * Mathf.Sin(w.z * 0.12f + 1.3f))));
            float lane = 1f - Mathf.SmoothStep(1.1f, 2.0f, DistSeg(p, c, e));
            // Paved yards: large Perlin blobs, so most of the town is stone with organic dirt/grass gaps.
            float yard = Mathf.SmoothStep(0.42f, 0.58f, Mathf.PerlinNoise(w.x * 0.045f + 11.3f, w.z * 0.045f + 7.1f));
            return Mathf.Clamp01(Mathf.Max(Mathf.Max(plaza, streetA), Mathf.Max(Mathf.Max(streetB, lane), yard)));
        }

        static float DistSeg(Vector2 p, Vector2 a, Vector2 b)
        {
            var ab = b - a; float t = Mathf.Clamp01(Vector2.Dot(p - a, ab) / Mathf.Max(1e-4f, ab.sqrMagnitude));
            return Vector2.Distance(p, a + ab * t);
        }
    }
}
