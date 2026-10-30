using System.Collections.Generic;
using Hollowmere.Core;
using UnityEngine;

namespace Hollowmere
{
    /// <summary>The current floor (or town) as a grid, plus conversions between tiles and world space.
    /// Tile (x,y) is centred at world (x*T, 0, y*T).</summary>
    public static class World
    {
        public const float T = 2f;
        public static DungeonMap Map;
        public static Transform Root;

        public static Vector3 ToWorld(Int2 p) => new Vector3(p.x * T, 0, p.y * T);
        public static Int2 ToTile(Vector3 w) => new Int2(Mathf.RoundToInt(w.x / T), Mathf.RoundToInt(w.z / T));
        public static bool Walkable(Vector3 w) => Map != null && Map.Walkable(ToTile(w));
        public static bool Solid(Vector3 w) => Map == null || Map.Get(ToTile(w)) == Tile.Wall;
        public static bool Sight(Vector3 a, Vector3 b) => Map == null || Pathfinder.LineOfSight(Map, ToTile(a), ToTile(b));

        /// <summary>Nearest walkable tile to a point (spiral search), for ground-targeted skills and drops.</summary>
        public static Vector3 ClampToFloor(Vector3 w)
        {
            if (Walkable(w)) return new Vector3(w.x, 0, w.z);
            var c = ToTile(w);
            for (int r = 1; r < 6; r++)
                for (int dy = -r; dy <= r; dy++)
                    for (int dx = -r; dx <= r; dx++)
                    {
                        var p = new Int2(c.x + dx, c.y + dy);
                        if (Map.Walkable(p)) return ToWorld(p);
                    }
            return ToWorld(Map.entry);
        }

        /// <summary>Steer from a point along walkable tiles: returns the furthest point up to `dist`
        /// along `dir` before a wall (used by dashes and knockback).</summary>
        public static Vector3 Sweep(Vector3 from, Vector3 dir, float dist)
        {
            dir.y = 0;
            if (dir.sqrMagnitude < 0.0001f) return from;
            dir.Normalize();
            var last = from;
            for (float d = 0.25f; d <= dist; d += 0.25f)
            {
                var p = from + dir * d;
                if (!Walkable(p)) break;
                last = p;
            }
            return last;
        }
    }

    /// <summary>Turns a DungeonMap into meshes: floor (two tones), walls (only visible faces),
    /// water, invisible water blockers, lights and props.</summary>
    public static class LevelBuilder
    {
        public static Transform Build(DungeonMap map)
        {
            var root = new GameObject(map.theme == Theme.Town ? "Town" : $"Floor {map.depth}").transform;
            var (fa, fb, wallC, ambient, lightC) = Art.ThemeColors(map.theme);
            float T = World.T, half = T / 2;

            // ---------- floor: two sub-meshes for a subtle checker
            var fv = new List<Vector3>(); var fn = new List<Vector3>(); var fuv = new List<Vector2>();
            var ta = new List<int>(); var tb = new List<int>();
            // ---------- walls
            var wv = new List<Vector3>(); var wn = new List<Vector3>(); var wt = new List<int>();
            // ---------- water + its blocker collider
            var av = new List<Vector3>(); var an = new List<Vector3>(); var at = new List<int>();
            var bv = new List<Vector3>(); var bt = new List<int>();
            float wallH = map.theme == Theme.Town ? 1.2f : 3f;

            for (int y = 0; y < map.height; y++)
                for (int x = 0; x < map.width; x++)
                {
                    var tile = map.Get(x, y);
                    var c = new Vector3(x * T, 0, y * T);
                    if (tile == Tile.Floor)
                    {
                        Quad(fv, fn, (x + y) % 2 == 0 ? ta : tb, c + new Vector3(-half, 0, -half), c + new Vector3(-half, 0, half), c + new Vector3(half, 0, half), c + new Vector3(half, 0, -half), Vector3.up, fuv);
                    }
                    else if (tile == Tile.Water)
                    {
                        // A solid bed in the included shader, then the water sheet on top. A hole
                        // here used to show the black skirt (and a pink edge where a stripped
                        // material failed).
                        Quad(fv, fn, (x + y) % 2 == 0 ? ta : tb, c + new Vector3(-half, 0, -half), c + new Vector3(-half, 0, half), c + new Vector3(half, 0, half), c + new Vector3(half, 0, -half), Vector3.up, fuv);
                        float wy = -0.08f;
                        Quad(av, an, at, c + new Vector3(-half, wy, -half), c + new Vector3(-half, wy, half), c + new Vector3(half, wy, half), c + new Vector3(half, wy, -half), Vector3.up);
                        Box(bv, bt, c, half, 1.5f);
                    }
                    else
                    {
                        bool visible = false;
                        foreach (var d in Pathfinder.Dirs4) if (map.Get(x + d.x, y + d.y) != Tile.Wall) visible = true;
                        if (!visible) continue;
                        var top = c + Vector3.up * wallH;
                        Quad(wv, wn, wt, top + new Vector3(-half, 0, -half), top + new Vector3(-half, 0, half), top + new Vector3(half, 0, half), top + new Vector3(half, 0, -half), Vector3.up);
                        foreach (var d in Pathfinder.Dirs4)
                        {
                            if (map.Get(x + d.x, y + d.y) == Tile.Wall) continue;
                            var n = new Vector3(d.x, 0, d.y);
                            var side = new Vector3(-n.z, 0, n.x);
                            var b0 = c + n * half - side * half; var b1 = c + n * half + side * half;
                            Quad(wv, wn, wt, b0, b0 + Vector3.up * wallH, b1 + Vector3.up * wallH, b1, n);
                        }
                    }
                }

            Debug.Log("Hollowmere level " + map.theme + " " + map.width + "x" + map.height
                + " floorVerts=" + fv.Count + " wallVerts=" + wv.Count + " depth=" + map.depth);
            var floor = MakeMesh("floor", root, fv, fn, null, Art.Mat(fa), fuv);
            var fm = floor.GetComponent<MeshFilter>().sharedMesh;
            fm.subMeshCount = 2;
            fm.SetTriangles(ta, 0);
            fm.SetTriangles(tb, 1);
            floor.GetComponent<MeshRenderer>().sharedMaterials = new[] { Art.Mat(fa), Art.Mat(fb) };

            var walls = MakeMesh("walls", root, wv, wn, wt, Art.Mat(wallC));
            walls.AddComponent<MeshCollider>().sharedMesh = walls.GetComponent<MeshFilter>().sharedMesh;
            if (av.Count > 0)
            {
                MakeMesh("water", root, av, an, at, Art.Mat(new Color(0.15f, 0.35f, 0.55f), 0.4f));
                var block = new GameObject("waterBlock");
                block.transform.SetParent(root, false);
                var bm = new Mesh { indexFormat = UnityEngine.Rendering.IndexFormat.UInt32 };
                bm.SetVertices(bv); bm.SetTriangles(bt, 0);
                block.AddComponent<MeshCollider>().sharedMesh = bm;
            }
            // A skirt in the floor colour. Pure black read as a missing mesh once the camera
            // looked past the last tile.
            var skirt = Color.Lerp(fa, Color.black, 0.35f);
            Art.Cube(root, new Vector3(map.width * T / 2, -0.6f, map.height * T / 2), new Vector3(map.width * T + 40, 1, map.height * T + 40), Art.Mat(skirt));
            Art.AdoptShaders(root.gameObject);

            // ---------- lighting
            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Flat;
            RenderSettings.ambientLight = ambient * (map.theme == Theme.Town ? 1.3f : 1.6f);
            RenderSettings.fog = map.theme != Theme.Town;
            RenderSettings.fogColor = ambient * 0.5f;
            RenderSettings.fogMode = FogMode.Linear;
            RenderSettings.fogStartDistance = 18; RenderSettings.fogEndDistance = 42;
            var sun = new GameObject("sun").AddComponent<Light>();
            sun.transform.SetParent(root, false);
            sun.type = LightType.Directional;
            sun.transform.rotation = Quaternion.Euler(55, -30, 0);
            sun.intensity = map.theme == Theme.Town ? 1.1f : 0.35f;
            sun.color = map.theme == Theme.Town ? new Color(1f, 0.95f, 0.85f) : lightC;
            if (Camera.main != null) Camera.main.backgroundColor = Color.Lerp(fa, ambient, 0.4f);

            if (map.theme != Theme.Town)
            {
                // Torches in a few rooms (vertex-lit beyond the pixel light budget, which is fine).
                int n = 0;
                foreach (var r in map.rooms)
                {
                    if (n++ % 2 == 1) continue;
                    var pos = World.ToWorld(new Int2(r.x, r.y + r.h / 2)) + new Vector3(0.2f, 2f, 0);
                    var torch = Art.Model("prop_torch", 1f, root);
                    if (torch != null) torch.transform.position = pos - Vector3.up;
                    else Art.Sphere(root, pos, Vector3.one * 0.3f, Art.Mat(lightC, 3f));
                    var l = new GameObject("torch").AddComponent<Light>();
                    l.transform.SetParent(root, false);
                    l.transform.position = pos + Vector3.right;
                    l.type = LightType.Point; l.color = lightC; l.range = 12; l.intensity = 1.6f;
                }
            }
            return root;
        }

        static void Quad(List<Vector3> v, List<Vector3> n, List<int> t, Vector3 a, Vector3 b, Vector3 c, Vector3 d, Vector3 normal, List<Vector2> uv = null)
        {
            int i = v.Count;
            v.Add(a); v.Add(b); v.Add(c); v.Add(d);
            for (int k = 0; k < 4; k++) n.Add(normal);
            if (uv != null) { uv.Add(new Vector2(0, 0)); uv.Add(new Vector2(0, 1)); uv.Add(new Vector2(1, 1)); uv.Add(new Vector2(1, 0)); }
            t.Add(i); t.Add(i + 1); t.Add(i + 2);
            t.Add(i); t.Add(i + 2); t.Add(i + 3);
        }

        static void Box(List<Vector3> v, List<int> t, Vector3 c, float half, float h)
        {
            int i = v.Count;
            for (int k = 0; k < 8; k++)
                v.Add(c + new Vector3((k & 1) == 0 ? -half : half, (k & 2) == 0 ? -0.5f : h, (k & 4) == 0 ? -half : half));
            int[] f = { 0, 2, 3, 0, 3, 1, 4, 5, 7, 4, 7, 6, 0, 4, 6, 0, 6, 2, 1, 3, 7, 1, 7, 5, 2, 6, 7, 2, 7, 3, 0, 1, 5, 0, 5, 4 };
            foreach (var x in f) t.Add(i + x);
        }

        static GameObject MakeMesh(string name, Transform parent, List<Vector3> v, List<Vector3> n, List<int> t, Material m, List<Vector2> uv = null)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            var mesh = new Mesh { indexFormat = UnityEngine.Rendering.IndexFormat.UInt32 };
            mesh.SetVertices(v);
            mesh.SetNormals(n);
            if (uv != null) mesh.SetUVs(0, uv);
            if (t != null) mesh.SetTriangles(t, 0);
            mesh.RecalculateBounds();
            go.AddComponent<MeshFilter>().sharedMesh = mesh;
            go.AddComponent<MeshRenderer>().sharedMaterial = m;
            return go;
        }
    }
}
