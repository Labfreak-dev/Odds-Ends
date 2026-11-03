using System.Collections.Generic;
using UnityEngine;

namespace Hollowmere.StyleTest
{
    /// <summary>ONE scale standard for the style test: 1 Unity unit = 1 metre. Hero 1.8 m.
    /// Layouts (town, biomes, the legacy room) and skill/VFX recipes were authored in "design units" (DU) where the hero
    /// was 3.0; they are converted at a single point each: builders shrink their output by DU after building (ShrinkSince),
    /// StVfx evaluates recipes in a DU frame around the hero and scales the fx root by DU, StSkillRunner converts its
    /// hit tests. Actors are normalised by MEASURED renderer bounds (model-agnostic, no per-model magic numbers).
    /// See Assets/StyleTest/SCALE_STANDARD.md.</summary>
    public static class StScale
    {
        /// <summary>Design unit -> metres (legacy hero 3.0 DU = 1.8 m).</summary>
        public const float DU = 0.6f;

        // ---- characters (metres, top of head/helmet incl. hats, bind/idle pose, weapons excluded) ----
        public const float Hero = 1.8f;
        public const float Villager = 1.75f;
        public const float Enemy = 1.8f;           // regular humanoid foe ~ hero height
        public const float Critter = 0.8f;         // rats, snakes, frogs, slimes, bats: 0.6 - 1.0 m (stated per entry)
        public const float EliteMul = 1.25f, BossMul = 2.5f;
        public const float Elite = Hero * EliteMul; // 2.25 m
        public const float Boss = Hero * BossMul;   // 4.5 m (allowed 3.6 - 5.4)

        // ---- kit (metres) ----
        public const float Door = 2.2f;            // door/gate opening 2.1 - 2.3
        public const float StallH = 2.6f;          // market stall overall 2.4 - 2.8
        public const float FountainRim = 1.0f, FountainTop = 3.1f; // VK fountain: rim measured 0.88 at 2.75 -> ~0.99 at 3.1 (model proportions cannot hit rim 1.1 and spire <= 3 together)
        public const float Storey = 3.0f;          // one house storey; 1-storey cottage eaves ~3 m, ridge 5-7 m
        public const float LampPost = 3.2f, Bench = 0.9f, Barrel = 1.0f, Crate = 0.8f, Fence = 1.1f;
        /// <summary>Kit fits (measured against the ruler in scale/lineup.png): the KayKit Dungeon doorway opening is 1.67 m at
        /// 4 DU x DU, the KayKit Hexagon house door 1.43 m at the old HexScale. Both are scaled to the 2.2 m door standard.</summary>
        public const float DungeonKit = 1.32f;     // dungeon tile 4 DU -> 5.28 DU = 3.17 m; wall 3.17 m; doorway 2.2 m
        public const float HexKit = 1.54f;         // hex buildings: door 2.2 m, 1-storey home ~6.4 m to the chimney
        public const float DungeonWall = 2.4f * DungeonKit;

        // ---- game camera (metres): the phase-5 framing (52 deg pitch, FOV 35, 17 DU back) converted ----
        public const float GameCamPitch = 52f, GameCamFov = 35f;
        public const float GameCamDist = 17f * DU;                       // 10.2 m
        public static readonly Vector3 GameCamTarget = new Vector3(0, 1.2f, 3.5f) * DU;
        public static void GameCam(Camera c, Vector3 focus, float dist = GameCamDist)
        {
            c.fieldOfView = GameCamFov; var tgt = focus + GameCamTarget;
            c.transform.rotation = Quaternion.Euler(GameCamPitch, 0, 0);
            c.transform.position = tgt + Quaternion.Euler(GameCamPitch, 0, 0) * new Vector3(0, 0, -dist);
        }

        public enum Cat { Hero, Villager, Enemy, Critter, Elite, Boss, Door, Stall, Fountain, House, Prop, Animal }

        public static float Target(Cat c)
        {
            switch (c)
            {
                case Cat.Hero: return Hero; case Cat.Villager: return Villager; case Cat.Enemy: return Enemy;
                case Cat.Critter: return Critter; case Cat.Elite: return Elite; case Cat.Boss: return Boss;
                case Cat.Door: return Door; case Cat.Stall: return StallH; case Cat.Fountain: return FountainTop;
                case Cat.House: return Storey * 2f; default: return 1f;
            }
        }

        /// <summary>Kit pieces whose overall height is pinned (metres). Matched by name prefix/contains.</summary>
        public static readonly (string key, float h)[] KitHeights =
        {
            ("MarketStall_", StallH), ("Prop_Fountain", FountainTop), ("Prop_LampPost", LampPost), ("Prop_Bench", Bench),
        };

        public static bool KitHeight(string piece, out float h)
        {
            foreach (var (k, v) in KitHeights) if (piece.Contains(k)) { h = v; return true; }
            h = 0; return false;
        }

        /// <summary>Renderer bounds of g (particles, ignore-raycast helper layer and disabled renderers skipped).</summary>
        public static Bounds Measure(GameObject g)
        {
            Bounds b = default; bool any = false;
            foreach (var r in g.GetComponentsInChildren<Renderer>())
            {
                if (r is ParticleSystemRenderer || !r.enabled || r.gameObject.layer == 2) continue;
                if (r.name == "glow_ring" || r.name.StartsWith("eye")) continue;
                if (!any) { b = r.bounds; any = true; } else b.Encapsulate(r.bounds);
            }
            return any ? b : new Bounds(g.transform.position, Vector3.zero);
        }

        /// <summary>Uniformly scale go so its measured height is the category target (or h if given); keeps its
        /// base on the same floor height. Returns the applied factor.</summary>
        public static float NormalizeHeight(GameObject go, Cat cat, float h = 0, float? groundY = null)
        {
            float target = h > 0 ? h : Target(cat);
            var b = Measure(go); if (b.size.y < 0.01f) return 1;
            float f = target / b.size.y; float floor = groundY ?? b.min.y;
            go.transform.localScale *= f;
            var nb = Measure(go); go.transform.position += Vector3.up * (floor - nb.min.y);
            return f;
        }

        // ---------------- world conversion ----------------
        public static HashSet<GameObject> Snapshot()
        {
            var s = new HashSet<GameObject>();
            foreach (var g in UnityEngine.SceneManagement.SceneManager.GetActiveScene().GetRootGameObjects()) s.Add(g);
            return s;
        }

        /// <summary>Converts everything a builder created since 'before' from DU to metres: positions about the origin
        /// and scales x DU; light ranges x DU and point/spot intensities x DU^2 (inverse-square falloff keeps the look);
        /// wander paths/speeds and drift amplitudes x DU; fog distances x DU. StActors only move (they are already
        /// metric by measured bounds).</summary>
        public static void ShrinkSince(HashSet<GameObject> before, float k = DU)
        {
            foreach (var g in UnityEngine.SceneManagement.SceneManager.GetActiveScene().GetRootGameObjects())
            {
                if (before.Contains(g) || g.GetComponent<Camera>() || g.GetComponent<StyleTestRunner>()) continue;
                var t = g.transform; t.position *= k;
                bool actor = g.GetComponent<StActor>() != null;
                if (!actor) t.localScale *= k;
                foreach (var l in g.GetComponentsInChildren<Light>(true))
                {
                    if (l.type == LightType.Directional) continue;
                    if (!actor) { l.range *= k; l.intensity *= k * k; }
                }
                foreach (var w in g.GetComponentsInChildren<StWander>(true))
                {
                    if (w.points != null) for (int i = 0; i < w.points.Length; i++) w.points[i] *= k;
                    w.speed *= k;
                }
                foreach (var d in g.GetComponentsInChildren<StDrift>(true)) d.amp *= k;
            }
            RenderSettings.fogStartDistance *= k; RenderSettings.fogEndDistance *= k;
        }

        // ---------------- measurement log ----------------
        public static readonly List<string> Log = new List<string>();
        public static float Record(string what, GameObject g, string note = "")
        {
            var b = Measure(g);
            var line = string.Format("{0,-34} h={1,5:0.00} m  w={2,5:0.00}  d={3,5:0.00}  {4}", what, b.size.y, b.size.x, b.size.z, note);
            Log.Add(line); Debug.Log("[ST] scale " + line); return b.size.y;
        }
    }
}
