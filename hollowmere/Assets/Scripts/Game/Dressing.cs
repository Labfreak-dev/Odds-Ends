using System.Collections.Generic;
using Hollowmere.Core;
using UnityEngine;

namespace Hollowmere
{
    /// <summary>Seeded clutter that stays off the gate, the NPCs and the corridor the hero needs.
    /// Props are original primitives (no third-party pack) so the repo stays small and the
    /// licence stays clean. A downloaded replacement can drop in later as a prop_ glb.</summary>
    public static class Dressing
    {
        public static void Scatter(DungeonMap map, Transform root, IList<Int2> blocked, int seed)
        {
            if (map == null || root == null) return;
            var skip = new HashSet<Int2>();
            if (blocked != null)
                foreach (var p in blocked)
                    for (int dy = -1; dy <= 1; dy++)
                        for (int dx = -1; dx <= 1; dx++)
                            skip.Add(new Int2(p.x + dx, p.y + dy));
            skip.Add(map.entry);
            skip.Add(map.exit);
            bool town = map.theme == Theme.Town;
            var rng = new System.Random(seed == 0 ? 1 : seed);
            int placed = 0;
            for (int y = 1; y < map.height - 1; y++)
                for (int x = 1; x < map.width - 1; x++)
                {
                    if (map.Get(x, y) != Tile.Floor) continue;
                    var p = new Int2(x, y);
                    if (skip.Contains(p)) continue;
                    // Keep the ground in front of the spawn camera empty.
                    if (p.y < map.entry.y - 1 && System.Math.Abs(p.x - map.entry.x) < 6) continue;
                    int open = 0, walls = 0;
                    foreach (var d in Pathfinder.Dirs4)
                    {
                        var t = map.Get(x + d.x, y + d.y);
                        if (t == Tile.Floor) open++;
                        else if (t == Tile.Wall) walls++;
                    }
                    if (open <= 2) continue;
                    int roll = rng.Next(10);
                    var at = World.ToWorld(p);
                    if (walls > 0 && roll < 4)
                    {
                        Prop(root, at, rng, town);
                        placed++;
                    }
                    else if (roll == 8)
                    {
                        Decal(root, at, rng, town);
                        placed++;
                    }
                    else if (town && walls == 0 && roll == 9)
                    {
                        Grass(root, at, rng);
                        placed++;
                    }
                }
            Debug.Log("Hollowmere dressing: " + placed + " pieces on " + map.theme);
            if (town) TownTorches(map, root, skip);
        }

        static void TownTorches(DungeonMap map, Transform root, HashSet<Int2> skip)
        {
            for (int x = 4; x < map.width - 4; x += 8)
            {
                int y = map.height - 2;
                var p = new Int2(x, y);
                if (map.Get(x, y) != Tile.Floor || skip.Contains(p)) continue;
                var pos = World.ToWorld(p) + new Vector3(0f, 1.5f, 0.2f);
                var torch = Art.Model("prop_torch", 1f, root);
                if (torch != null) torch.transform.position = pos - Vector3.up * 0.4f;
                else Art.Sphere(root, pos, Vector3.one * 0.22f, Art.Mat(new Color(1f, 0.65f, 0.25f), 2f));
                var l = new GameObject("torch").AddComponent<Light>();
                l.transform.SetParent(root, false);
                l.transform.position = pos;
                l.type = LightType.Point;
                l.color = new Color(1f, 0.72f, 0.4f);
                l.range = 8f;
                l.intensity = 1.2f;
                l.gameObject.AddComponent<TorchFlicker>();
            }
        }

        public static void Mood(DungeonMap map)
        {
            if (map == null) return;
            var (_, _, _, ambient, lightC) = Art.ThemeColors(map.theme);
            RenderSettings.fog = true;
            RenderSettings.fogMode = FogMode.Linear;
            if (map.theme == Theme.Town)
            {
                RenderSettings.fogColor = Color.Lerp(ambient, new Color(0.62f, 0.7f, 0.62f), 0.5f);
                RenderSettings.fogStartDistance = 28f;
                RenderSettings.fogEndDistance = 80f;
            }
            else
            {
                RenderSettings.fogColor = Color.Lerp(ambient, Color.black, 0.45f);
                RenderSettings.fogStartDistance = 9f;
                RenderSettings.fogEndDistance = 26f;
                RenderSettings.ambientLight = ambient * 0.85f;
            }
            foreach (var l in Object.FindObjectsByType<Light>(FindObjectsSortMode.None))
            {
                if (l == null || l.type != LightType.Point || l.name != "torch") continue;
                if (l.GetComponent<TorchFlicker>() == null) l.gameObject.AddComponent<TorchFlicker>();
                l.color = lightC;
            }
        }

        static void Prop(Transform root, Vector3 at, System.Random rng, bool town)
        {
            int kind = rng.Next(town ? 4 : 5);
            float yaw = (float)rng.NextDouble() * 360f;
            var rot = Quaternion.Euler(0f, yaw, 0f);
            switch (kind)
            {
                case 0:
                    Barrel(root, at, rot);
                    break;
                case 1:
                    Crate(root, at, rot, rng);
                    break;
                case 2:
                    Rock(root, at, rng, town);
                    break;
                default:
                    Rubble(root, at, rng);
                    break;
            }
        }

        static void Barrel(Transform root, Vector3 at, Quaternion rot)
        {
            var wood = Art.Mat(new Color(0.42f, 0.28f, 0.16f));
            var band = Art.Mat(new Color(0.25f, 0.22f, 0.2f));
            Art.Cylinder(root, at + Vector3.up * 0.42f, new Vector3(0.55f, 0.42f, 0.55f), wood, rot);
            Art.Cylinder(root, at + Vector3.up * 0.22f, new Vector3(0.58f, 0.04f, 0.58f), band, rot);
            Art.Cylinder(root, at + Vector3.up * 0.62f, new Vector3(0.58f, 0.04f, 0.58f), band, rot);
        }

        static void Crate(Transform root, Vector3 at, Quaternion rot, System.Random rng)
        {
            float s = 0.55f + (float)rng.NextDouble() * 0.25f;
            var wood = Art.Mat(new Color(0.48f, 0.34f, 0.2f));
            var band = Art.Mat(new Color(0.3f, 0.22f, 0.14f));
            Art.Cube(root, at + Vector3.up * (s * 0.5f), new Vector3(s, s, s), wood, rot);
            Art.Cube(root, at + Vector3.up * (s * 0.5f) + rot * new Vector3(0f, s * 0.5f + 0.02f, 0f), new Vector3(s * 1.05f, 0.04f, 0.08f), band, rot);
        }

        static void Rock(Transform root, Vector3 at, System.Random rng, bool town)
        {
            var c = town ? new Color(0.45f, 0.42f, 0.36f) : new Color(0.32f, 0.3f, 0.28f);
            float s = 0.28f + (float)rng.NextDouble() * 0.35f;
            Art.Sphere(root, at + Vector3.up * (s * 0.45f), new Vector3(s * 1.3f, s * 0.7f, s), Art.Mat(c));
            if (rng.Next(2) == 0)
                Art.Sphere(root, at + new Vector3(s * 0.7f, s * 0.25f, s * 0.2f), Vector3.one * s * 0.55f, Art.Mat(c * 0.85f));
        }

        static void Rubble(Transform root, Vector3 at, System.Random rng)
        {
            var c = Art.Mat(new Color(0.34f, 0.32f, 0.3f));
            for (int i = 0; i < 3; i++)
            {
                float a = (float)rng.NextDouble() * 6.28f;
                float d = 0.15f + (float)rng.NextDouble() * 0.35f;
                var p = at + new Vector3(Mathf.Cos(a) * d, 0.06f, Mathf.Sin(a) * d);
                Art.Cube(root, p, new Vector3(0.18f, 0.08f, 0.14f), c, Quaternion.Euler(0f, a * Mathf.Rad2Deg, 8f));
            }
        }

        static void Grass(Transform root, Vector3 at, System.Random rng)
        {
            var c = Art.Mat(new Color(0.22f, 0.4f, 0.18f));
            for (int i = 0; i < 4; i++)
            {
                float a = (float)rng.NextDouble() * 6.28f;
                var p = at + new Vector3(Mathf.Cos(a) * 0.25f, 0.16f, Mathf.Sin(a) * 0.25f);
                Art.Cube(root, p, new Vector3(0.06f, 0.28f, 0.06f), c, Quaternion.Euler(0f, a * Mathf.Rad2Deg, 12f));
            }
        }

        static void Decal(Transform root, Vector3 at, System.Random rng, bool town)
        {
            bool moss = rng.Next(2) == 0;
            var c = moss
                ? (town ? new Color(0.28f, 0.4f, 0.2f, 1f) : new Color(0.2f, 0.32f, 0.18f, 1f))
                : new Color(0.15f, 0.13f, 0.12f, 1f);
            float s = 0.7f + (float)rng.NextDouble() * 0.8f;
            Art.Cylinder(root, at + Vector3.up * 0.015f, new Vector3(s, 0.008f, s * 0.72f), Art.Mat(c));
        }
    }

    /// <summary>Wall-torch point light plus a few rising embers.</summary>
    public sealed class TorchFlicker : MonoBehaviour
    {
        Light light;
        float baseIntensity;
        float seed;

        void Awake()
        {
            light = GetComponent<Light>();
            baseIntensity = light != null ? light.intensity : 1.6f;
            seed = transform.position.x * 0.13f + transform.position.z * 0.07f;
            var ember = Art.Mat(new Color(1f, 0.55f, 0.22f), 2.5f);
            for (int i = 0; i < 4; i++)
            {
                var e = Art.Sphere(transform, new Vector3(0f, 0.15f, 0f), Vector3.one * 0.05f, ember);
                var mote = e.AddComponent<TorchEmber>();
                mote.seed = seed + i * 1.7f;
            }
        }

        void Update()
        {
            if (light == null) return;
            float n = Mathf.PerlinNoise(seed, Time.time * 5.5f);
            light.intensity = baseIntensity * (0.72f + n * 0.6f);
        }
    }

    public sealed class TorchEmber : MonoBehaviour
    {
        public float seed;
        Vector3 origin;

        void Start() => origin = transform.localPosition;

        void Update()
        {
            float t = Time.time + seed;
            float k = Mathf.Repeat(t * 0.7f, 1f);
            transform.localPosition = origin + new Vector3(Mathf.Sin(t * 3f) * 0.06f, k * 0.55f, Mathf.Cos(t * 2.2f) * 0.06f);
            float s = 0.05f * (1f - k);
            transform.localScale = new Vector3(s, s, s);
        }
    }
}
