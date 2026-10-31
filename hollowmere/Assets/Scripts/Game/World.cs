using System.Collections.Generic;
using Hollowmere.Core;
using UnityEngine;
using UnityEngine.AI;

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

        /// <summary>Footstep surface: grass, dirt, stone, or wood.</summary>
        public static string FootSurface(Vector3 w)
        {
            if (Map == null) return "stone";
            if (Map.theme == Theme.Town)
            {
                var t = ToTile(w);
                for (int dy = -1; dy <= 1; dy++)
                    for (int dx = -1; dx <= 1; dx++)
                        if (Map.Get(t.x + dx, t.y + dy) == Tile.Water) return "wood";
                return (t.x + t.y) % 2 == 0 ? "stone" : "grass";
            }
            if (Map.theme == Theme.Caverns || Map.theme == Theme.EmberDepths) return "dirt";
            return "stone";
        }
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
            var floorMats = new[] { Art.Mat(fa), Art.Mat(fb) };
            if (map.theme == Theme.Town)
            {
                var cobble = ArtDrop.Ground("cobble");
                var grass = ArtDrop.Ground("grass");
                if (cobble != null) PaintGround(floorMats[0], cobble);
                if (grass != null) PaintGround(floorMats[1], grass);
            }
            else
            {
                var groundName = map.theme == Theme.Crypt ? "crypt" : map.theme == Theme.Caverns ? "cave" : map.theme == Theme.SunkenHalls ? "flag" : "cracked";
                var groundTex = ArtDrop.Ground(groundName);
                if (groundTex != null)
                    for (int gi = 0; gi < floorMats.Length; gi++) PaintGround(floorMats[gi], groundTex);
            }
            floor.GetComponent<MeshRenderer>().sharedMaterials = floorMats;

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
            var skirtGo = Art.Cube(root, new Vector3(map.width * T / 2, -1.2f, map.height * T / 2), new Vector3(map.width * T + 40, 1, map.height * T + 40), Art.Mat(skirt));
            skirtGo.name = "skirt";
            root.gameObject.AddComponent<BoundsGuard>();
            Art.AdoptShaders(root.gameObject);

            // ---------- lighting
            bool town = map.theme == Theme.Town;
            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Flat;
            RenderSettings.ambientLight = ambient * (town ? 1.35f : 1.45f);
            RenderSettings.fog = true;
            RenderSettings.fogMode = FogMode.Linear;
            if (town)
            {
                RenderSettings.fogColor = Color.Lerp(ambient, new Color(0.78f, 0.84f, 0.8f), 0.35f);
                RenderSettings.fogStartDistance = 24f;
                RenderSettings.fogEndDistance = 78f;
            }
            else
            {
                RenderSettings.fogColor = Color.Lerp(ambient, new Color(0.55f, 0.5f, 0.48f), 0.25f);
                RenderSettings.fogStartDistance = 22f;
                RenderSettings.fogEndDistance = 64f;
            }
            var sun = new GameObject("sun").AddComponent<Light>();
            sun.transform.SetParent(root, false);
            sun.type = LightType.Directional;
            sun.transform.rotation = Quaternion.Euler(50, -30, 0);
            sun.intensity = town ? 1.15f : 1.05f;
            sun.color = town ? new Color(1f, 0.95f, 0.85f) : Color.Lerp(lightC, Color.white, 0.35f);
            if (Camera.main != null) Camera.main.backgroundColor = Color.Lerp(fa, ambient, 0.4f);

            FloorNav.Build(map);
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
            Dressing.Mood(map);
            return root;
        }

        static void PaintGround(Material m, Texture tex)
        {
            if (m == null || tex == null) return;
            m.mainTexture = tex;
            if (m.HasProperty("_BaseMap")) m.SetTexture("_BaseMap", tex);
            if (m.HasProperty("_MainTex")) m.SetTexture("_MainTex", tex);
            if (m.HasProperty("_HasMap")) m.SetFloat("_HasMap", 1f);
            if (m.HasProperty("_BaseColor")) m.SetColor("_BaseColor", Color.white);
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

    /// <summary>Runtime navmesh over the walkable floor tiles. Rebuilt with each level.</summary>
    public static class FloorNav
    {
        static NavMeshDataInstance inst;
        public static bool Ready { get; private set; }

        public static void Clear()
        {
            if (inst.valid) NavMesh.RemoveNavMeshData(inst);
            inst = default;
            Ready = false;
        }

        public static void Build(DungeonMap map)
        {
            Clear();
            if (map == null) return;
            var sources = new List<NavMeshBuildSource>();
            float t = World.T;
            for (int y = 0; y < map.height; y++)
                for (int x = 0; x < map.width; x++)
                {
                    if (!map.Walkable(x, y)) continue;
                    sources.Add(new NavMeshBuildSource
                    {
                        shape = NavMeshBuildSourceShape.Box,
                        // A hair of overlap so neighbouring tiles voxelize as one surface.
                        size = new Vector3(t + 0.08f, 0.25f, t + 0.08f),
                        transform = Matrix4x4.TRS(new Vector3(x * t, -0.12f, y * t), Quaternion.identity, Vector3.one),
                        area = 0,
                    });
                }
            if (sources.Count == 0) return;
            var settings = NavMesh.GetSettingsByID(0);
            settings.agentRadius = 0.28f;
            settings.agentHeight = 1.2f;
            settings.agentSlope = 15f;
            settings.agentClimb = 0.2f;
            var bounds = new Bounds(
                new Vector3(map.width * t * 0.5f, 0f, map.height * t * 0.5f),
                new Vector3(map.width * t + 4f, 6f, map.height * t + 4f));
            var data = NavMeshBuilder.BuildNavMeshData(settings, sources, bounds, Vector3.zero, Quaternion.identity);
            if (data == null)
            {
                Debug.LogWarning("Hollowmere navmesh: build returned nothing");
                return;
            }
            inst = NavMesh.AddNavMeshData(data);
            var tri = NavMesh.CalculateTriangulation();
            int n = tri.indices != null ? tri.indices.Length / 3 : 0;
            Ready = inst.valid && n > 0;
            Debug.Log("Hollowmere navmesh: tiles " + sources.Count + " tris " + n + " ready " + Ready);
        }
    }
}
