using System.Collections.Generic;
using UnityEngine;

namespace Hollowmere.StyleTest
{
    /// <summary>Phase 2: four dungeon biomes (crypt, cave, sewer, mine) built from free CC0 kits on one grid.
    /// Irregular rooms come from a cell mask; walls go on every floor edge except the camera-facing south side.
    /// Everything uses the StToon look: KayKit Dungeon pieces are re-tinted per biome, Quaternius props / nature
    /// get flat palette colours (keyword per material), repo gems become glowing crystals/ore.</summary>
    public static class StBiomes
    {
        public static readonly string[] Ids = { "crypt", "cave", "sewer", "mine" };
        public static readonly List<Transform> Built = new List<Transform>();
        public static readonly List<Vector3> Spawns = new List<Vector3>();
        public static Vector3 Centre, Hero;
        /// <summary>Combat spots (relative to room centre): hero + 3 foes. Props and bumpy floor tiles keep clear of them.</summary>
        static readonly Dictionary<string, Vector3[]> Spots = new Dictionary<string, Vector3[]> {
            { "crypt", new[] { new Vector3(0, 0, -3.5f), new Vector3(-4, 0, -2), new Vector3(4, 0, -1), new Vector3(0, 0, 5.5f) } },
            { "cave",  new[] { new Vector3(-1, 0, -1.5f), new Vector3(-4, 0, 1), new Vector3(2, 0, 4), new Vector3(-6, 0, 4) } },
            { "sewer", new[] { new Vector3(-6, 0, -2.5f), new Vector3(-3, 0, -0.5f), new Vector3(3, 0, -1.5f), new Vector3(8, 0, -2.5f) } },
            { "mine",  new[] { new Vector3(0, 0, -1.0f), new Vector3(-6, 0, 3), new Vector3(6, 0, 3.5f), new Vector3(0, 0, 5) } },
        };
        static bool NearSpot(Vector3 p, float r) { foreach (var s in Spawns) if (Vector3.Distance(new Vector3(p.x, 0, p.z), s) < r) return true; return Vector3.Distance(new Vector3(p.x, 0, p.z), Hero) < r; }
        const float T = 4f;
        static System.Random rng;
        static string biome;
        static readonly HashSet<string> logged = new HashSet<string>();

        class Def { public string[] mask; public Color floor, wall, ambSky, ambEq, fog, key; public float fogS, fogE, keyI; }

        static Def Get(string id)
        {
            switch (id)
            {
                case "crypt": return new Def {
                    mask = new[] { "..####..", ".######.", "########", "########", ".######.", "..####.." },
                    floor = new Color(0.92f, 0.92f, 1.0f), wall = new Color(0.84f, 0.85f, 0.98f),
                    ambSky = new Color(0.16f, 0.18f, 0.32f), ambEq = new Color(0.10f, 0.10f, 0.17f), fog = new Color(0.06f, 0.06f, 0.12f), fogS = 24, fogE = 60,
                    key = new Color(0.62f, 0.70f, 1f), keyI = 0.45f };
                case "cave": return new Def {
                    mask = new[] { ".###....", "########", "########", ".#######", "..#####.", "...###.." },
                    floor = new Color(0.95f, 0.92f, 1.0f), wall = new Color(0.62f, 0.58f, 0.66f),
                    ambSky = new Color(0.17f, 0.27f, 0.33f), ambEq = new Color(0.11f, 0.15f, 0.18f), fog = new Color(0.03f, 0.07f, 0.09f), fogS = 20, fogE = 55,
                    key = new Color(0.55f, 0.85f, 1f), keyI = 0.25f };
                case "sewer": return new Def {
                    mask = new[] { "########", "########", "########", "########", ".######." },
                    floor = new Color(0.86f, 0.84f, 0.78f), wall = new Color(0.92f, 0.80f, 0.68f),
                    ambSky = new Color(0.16f, 0.21f, 0.20f), ambEq = new Color(0.12f, 0.12f, 0.10f), fog = new Color(0.05f, 0.09f, 0.08f), fogS = 18, fogE = 50,
                    key = new Color(0.95f, 0.95f, 0.85f), keyI = 0.30f };
                default: return new Def { // mine
                    mask = new[] { "##......", "########", "########", ".#######", ".####.##", "..###..." },
                    floor = new Color(0.86f, 0.72f, 0.58f), wall = new Color(0.70f, 0.55f, 0.42f),
                    ambSky = new Color(0.30f, 0.24f, 0.19f), ambEq = new Color(0.18f, 0.14f, 0.11f), fog = new Color(0.10f, 0.07f, 0.05f), fogS = 22, fogE = 58,
                    key = new Color(1f, 0.82f, 0.6f), keyI = 0.35f };
            }
        }

        // ---------- palette recolour (Quaternius props / nature have no FBX textures) ----------
        static Color Pal(string n, Color fallback)
        {
            n = n.ToLowerInvariant();
            if (n.Contains("flame") || n.Contains("fire") || n.Contains("light")) return new Color(1f, 0.6f, 0.2f);
            if (n.Contains("gold") || n.Contains("coin")) return new Color(0.95f, 0.75f, 0.25f);
            if (n.Contains("metal") || n.Contains("iron") || n.Contains("chain") || n.Contains("steel")) return new Color(0.55f, 0.57f, 0.62f);
            if (n.Contains("bronze") || n.Contains("copper")) return new Color(0.75f, 0.5f, 0.3f);
            if (n.Contains("rope") || n.Contains("cloth") || n.Contains("bag") || n.Contains("paper") || n.Contains("scroll")) return new Color(0.82f, 0.72f, 0.52f);
            if (n.Contains("candle") || n.Contains("wax")) return new Color(0.95f, 0.9f, 0.78f);
            if (n.Contains("leaf") || n.Contains("leaves") || n.Contains("grass") || n.Contains("fern") || n.Contains("plant")) return new Color(0.42f, 0.62f, 0.32f);
            if (n.Contains("mush")) return new Color(0.85f, 0.35f, 0.3f);
            if (n.Contains("stem")) return new Color(0.92f, 0.86f, 0.74f);
            if (n.Contains("rock") || n.Contains("stone") || n.Contains("pebble")) return new Color(0.58f, 0.56f, 0.58f);
            if (n.Contains("bark") || n.Contains("trunk") || n.Contains("wood") || n.Contains("furniture")) return new Color(0.55f, 0.38f, 0.24f);
            if (n.Contains("book")) return new Color(0.55f, 0.22f, 0.25f);
            if (n.Contains("glass") || n.Contains("bottle") || n.Contains("potion")) return new Color(0.4f, 0.75f, 0.8f);
            return fallback;
        }

        static void Flat(GameObject g, Color fallback, Color tint, Color emis = default)
        {
            foreach (var r in g.GetComponentsInChildren<Renderer>())
            {
                var ms = r.sharedMaterials;
                for (int k = 0; k < ms.Length; k++)
                {
                    var src = ms[k] ? ms[k].name : r.name;
                    var c = Pal(src, Pal(g.name, fallback)) * tint; c.a = 1;
                    var e = emis; var low = src.ToLowerInvariant();
                    if (e == default && (low.Contains("flame") || low.Contains("fire"))) e = new Color(1.2f, 0.5f, 0.1f);
                    bool vc = low.Contains("vertex");
                    if (vc) { c = tint; c.a = 1; }
                    var m = StMat.Make("bio_" + (vc ? "vc" : "") + ColorUtility.ToHtmlStringRGB(c) + ColorUtility.ToHtmlStringRGB(e), null, c, vc, 0, e);
                    m.SetFloat("_Ramp", 0.15f); ms[k] = m;
                }
                r.sharedMaterials = ms;
                r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.On;
            }
        }

        static void Tint(GameObject g, Color tint)
        {
            foreach (var r in g.GetComponentsInChildren<Renderer>())
            {
                var ms = r.sharedMaterials;
                for (int k = 0; k < ms.Length; k++)
                {
                    var o = ms[k]; if (!o) continue;
                    var key = "tint_" + o.name + ColorUtility.ToHtmlStringRGB(tint);
                    Texture tex = o.HasProperty("_BaseMap") ? o.GetTexture("_BaseMap") : o.mainTexture;
                    var m = StMat.Make(key, tex, tint, false); m.SetFloat("_Ramp", 0.18f); ms[k] = m;
                }
                r.sharedMaterials = ms;
            }
        }

        static GameObject Ground(GameObject g, Vector3 pos, bool snap = true)
        {
            var b = StWorld.Bounds(g);
            g.transform.position += new Vector3(pos.x - b.center.x, snap ? pos.y - b.min.y : pos.y - b.center.y, pos.z - b.center.z);
            Built.Add(g.transform); return g;
        }

        static GameObject Kit(string name, Vector3 pos, float yaw, Color tint, bool snap = true)
        { var g = StKit.Spawn("Dungeon/" + name, Vector3.zero, yaw); Tint(g, tint); return Ground(g, pos, snap); }

        static GameObject Prop(string name, Vector3 pos, float yaw, float h, Color fallback, Color tint, Color emis = default)
        {
            var g = StKit.Spawn((name.StartsWith("Nature/") ? "" : "Props/") + name, Vector3.zero, yaw);
            var pf = Resources.Load<GameObject>("ST/" + (name.StartsWith("Nature/") ? "" : "Props/") + name);
            if (pf) g.transform.rotation = Quaternion.Euler(0, yaw, 0) * pf.transform.rotation; // keep the FBX root's axis conversion (Spawn overwrites it)
            var b = StWorld.Bounds(g);
            if (!logged.Contains(name)) { logged.Add(name); var mats = new List<string>(); foreach (var r in g.GetComponentsInChildren<Renderer>()) foreach (var mm in r.sharedMaterials) mats.Add(mm ? mm.name : "null"); Debug.Log("[ST] prop " + name + " size " + b.size + " mats " + string.Join(",", mats)); }
            if (b.size.y > 0.001f) g.transform.localScale *= h / b.size.y;
            Flat(g, fallback, tint, emis); return Ground(g, pos);
        }

        static GameObject Gem(string kind, Vector3 pos, float h, Color glow, float yawTilt)
        {
            var p = Resources.Load<GameObject>("Models/gem_" + kind + "_royal") ?? Resources.Load<GameObject>("Models/gem_" + kind + "_regular");
            if (!p) return null;
            var g = Object.Instantiate(p); g.transform.rotation = Quaternion.Euler(yawTilt * 0.3f, yawTilt, yawTilt * 0.2f);
            var b = StWorld.Bounds(g); float mx = Mathf.Max(b.size.x, Mathf.Max(b.size.y, b.size.z));
            if (mx > 0.001f) g.transform.localScale = Vector3.Scale(g.transform.localScale * (h / mx), new Vector3(0.45f, 1.0f, 0.45f));
            var bb = StWorld.Bounds(g); if (bb.size.y < h * 0.8f) g.transform.localScale = Vector3.Scale(g.transform.localScale, new Vector3(1f, h / Mathf.Max(0.01f, bb.size.y), 1f));
            foreach (var r in g.GetComponentsInChildren<Renderer>()) { var m = StMat.Make("gem_" + kind + ColorUtility.ToHtmlStringRGB(glow), null, glow * 0.45f, false, 0, glow * 0.35f); m.SetFloat("_Ramp", 0.1f); r.sharedMaterial = m; }
            return Ground(g, pos);
        }

        static void PointLight(Vector3 p, Color c, float i, float range, bool flicker)
        {
            var l = new GameObject("bio_light").AddComponent<Light>(); l.type = LightType.Point; l.color = c; l.intensity = i; l.range = range; l.shadows = LightShadows.None;
            l.transform.position = p; if (flicker) l.gameObject.AddComponent<StFlicker>(); Built.Add(l.transform);
        }

        static void Flame(Vector3 p, Color c, float s)
        {
            var fl = GameObject.CreatePrimitive(PrimitiveType.Quad); Object.Destroy(fl.GetComponent<Collider>());
            fl.transform.position = p; fl.transform.localScale = Vector3.one * s;
            fl.GetComponent<MeshRenderer>().sharedMaterial = StGlow.Mat(c, 2); fl.AddComponent<StBillboard>(); Built.Add(fl.transform);
        }

        static GameObject Box(Vector3 pos, Vector3 size, Color c, Color emis = default)
        {
            var g = GameObject.CreatePrimitive(PrimitiveType.Cube); Object.Destroy(g.GetComponent<Collider>());
            g.transform.position = pos; g.transform.localScale = size;
            g.GetComponent<MeshRenderer>().sharedMaterial = StMat.Make("box_" + ColorUtility.ToHtmlStringRGB(c) + ColorUtility.ToHtmlStringRGB(emis), null, c, false, 0, emis);
            Built.Add(g.transform); return g;
        }

        public static void Lighting(string id)
        {
            var d = Get(id);
            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = d.ambSky * 1.9f; RenderSettings.ambientEquatorColor = d.ambEq * 1.9f; RenderSettings.ambientGroundColor = d.ambEq * 1.6f;
            RenderSettings.fog = true; RenderSettings.fogMode = FogMode.Linear; RenderSettings.fogColor = d.fog;
            RenderSettings.fogStartDistance = d.fogS; RenderSettings.fogEndDistance = d.fogE;
            var k = new GameObject("bio_key").AddComponent<Light>(); k.type = LightType.Directional; k.color = d.key; k.intensity = d.keyI * 1.6f;
            k.shadows = LightShadows.Soft; k.shadowStrength = 0.7f; k.transform.rotation = Quaternion.Euler(60, -25, 0); Built.Add(k.transform);
        }

        /// <summary>True when no floor lies further out in that direction (an outer side wall, not an inner notch that would hide the hero).</summary>
        static bool Outer(string[] m, int x, int z, int dir) { for (int i = x + dir; i >= 0 && i < m[z].Length; i += dir) if (At(m, i, z)) return z < 2; return true; }

        static bool At(string[] m, int x, int z) => z >= 0 && z < m.Length && x >= 0 && x < m[z].Length && m[z][x] != '.';

        /// <summary>World position of cell centre. Row 0 of the mask is the far (north) side.</summary>
        static Vector3 Cell(string[] m, int x, int z) => new Vector3((x - m[0].Length * 0.5f + 0.5f) * T, 0, ((m.Length - 1 - z) - m.Length * 0.5f + 0.5f) * T);

        public static void Build(string id)
        {
            biome = id; rng = new System.Random(id.GetHashCode() & 0xffff);
            Built.Clear(); Spawns.Clear();
            var d = Get(id); var m = d.mask;
            bool rocky = id == "cave" || id == "mine";
            string[] floors = id == "cave" ? new[] { "floor_tile_large" }
                : id == "sewer" ? new[] { "floor_tile_large", "floor_tile_large", "floor_tile_large_rocks" }
                : id == "crypt" ? new[] { "floor_tile_large", "floor_tile_large", "floor_tile_large_rocks" }
                : new[] { "floor_tile_large_rocks", "floor_tile_large" };
            var cells = new List<Vector3>();
            { Vector3 a = Vector3.one * 1e5f, bmax = -Vector3.one * 1e5f; for (int zz = 0; zz < m.Length; zz++) for (int xx = 0; xx < m[zz].Length; xx++) if (At(m, xx, zz)) { var cc = Cell(m, xx, zz); a = Vector3.Min(a, cc); bmax = Vector3.Max(bmax, cc); } Centre = (a + bmax) * 0.5f; }
            var sp = Spots[id]; Hero = Centre + sp[0]; for (int i = 1; i < sp.Length; i++) Spawns.Add(Centre + sp[i]);
            // dark pit floor under the whole room so notches read as drops, not void
            Box(Centre + new Vector3(0, -1.6f, 0), new Vector3(m[0].Length * T + 12, 0.2f, m.Length * T + 12), d.wall * 0.25f);
            for (int z = 0; z < m.Length; z++)
                for (int x = 0; x < m[z].Length; x++)
                {
                    if (!At(m, x, z)) continue;
                    var c = Cell(m, x, z); cells.Add(c);
                    bool channel = id == "sewer" && z == 1;
                    if (channel) { WaterCell(c); continue; }
                    var f = floors[rng.Next(floors.Length)];
                    if (id == "sewer" && rng.Next(6) == 0) f = "floor_tile_big_grate";
                    if (NearSpot(c, 3.2f)) f = "floor_tile_large"; // flat footing where actors stand
                    var g = StKit.Spawn("Dungeon/" + f, Vector3.zero, 90 * rng.Next(4)); Tint(g, d.floor);
                    g.transform.localScale = Vector3.Scale(g.transform.localScale, new Vector3(1.03f, 1f, 1.03f));
                    var b = StWorld.Bounds(g); g.transform.position += new Vector3(c.x - b.center.x, (f.Contains("grate") ? -b.max.y : -b.min.y - 0.15f), c.z - b.center.z); Built.Add(g.transform); // slab top at y=0; rocks/grate rims stand proud
                    if (!logged.Contains(f)) { logged.Add(f); Debug.Log("[ST] floor " + f + " size " + b.size); }
                    // edges: N (z-1), W (x-1), E (x+1); south edge (z+1) stays open towards the camera
                    if (!At(m, x, z - 1)) Edge(c + new Vector3(0, 0, T * 0.5f), true, d.wall, rocky, z == 0 ? 1 : 0);
                    if (!At(m, x - 1, z)) { if (Outer(m, x, z, -1)) Edge(c + new Vector3(-T * 0.5f, 0, 0), false, d.wall, rocky, 0); else Lip(c + new Vector3(-T * 0.5f, 0, 0), d.wall, rocky); }
                    if (!At(m, x + 1, z)) { if (Outer(m, x, z, 1)) Edge(c + new Vector3(T * 0.5f, 0, 0), false, d.wall, rocky, 0); else Lip(c + new Vector3(T * 0.5f, 0, 0), d.wall, rocky); }
                    if (!At(m, x, z + 1)) Lip(c + new Vector3(0, 0, -T * 0.5f), d.wall, rocky);
                }
            var mn = cells[0]; var mx = cells[0]; foreach (var c in cells) { mn = Vector3.Min(mn, c); mx = Vector3.Max(mx, c); }
            Centre = (mn + mx) * 0.5f;
            Lighting(id);
            switch (id)
            {
                case "crypt": Crypt(m); break;
                case "cave": Cave(m); break;
                case "sewer": Sewer(m); break;
                default: Mine(m); break;
            }
            Atmos(id, cells);
            Debug.Log("[ST] biome " + id + " pieces " + Built.Count);
        }

        /// <summary>Kenney Graveyard piece (shared colormap texture) on StToon. h = height (0 = native size x scale), len = longest side.</summary>
        static GameObject Grave(string name, Vector3 pos, float yaw, float h, float len, bool snap = true)
        {
            var g = StKit.Spawn("Grave/" + name, Vector3.zero, yaw);
            var pf = Resources.Load<GameObject>("ST/Grave/" + name); if (pf) g.transform.rotation = Quaternion.Euler(0, yaw, 0) * pf.transform.rotation;
            var b = StWorld.Bounds(g);
            if (len > 0) g.transform.localScale *= len / Mathf.Max(b.size.x, b.size.z); else if (h > 0) g.transform.localScale *= h / Mathf.Max(0.01f, b.size.y);
            Tint(g, Color.white); return Ground(g, pos, snap);
        }

        /// <summary>Floating dust motes + low drifting fog sheets (StDrift, unscaled time so they move in shot clips too).</summary>
        static void Atmos(string id, List<Vector3> cells)
        {
            Color dust = id == "cave" ? new Color(0.5f, 1.1f, 1.3f) : id == "mine" ? new Color(1.3f, 0.95f, 0.55f) : id == "sewer" ? new Color(0.8f, 1.2f, 0.6f) : new Color(0.8f, 0.9f, 1.4f);
            Color fog = (RenderSettings.fogColor * 2.2f + new Color(0.06f, 0.06f, 0.06f)); fog.a = 1;
            for (int i = 0; i < 40; i++)
            {
                var c = cells[rng.Next(cells.Count)] + new Vector3(((float)rng.NextDouble() - 0.5f) * T, 0.6f + (float)rng.NextDouble() * 3.2f, ((float)rng.NextDouble() - 0.5f) * T);
                var q = GameObject.CreatePrimitive(PrimitiveType.Quad); Object.Destroy(q.GetComponent<Collider>()); q.name = "dust";
                q.transform.position = c; q.transform.localScale = Vector3.one * (0.08f + (float)rng.NextDouble() * 0.08f);
                q.GetComponent<MeshRenderer>().sharedMaterial = StGlow.Mat(dust * 0.6f, 2); q.AddComponent<StBillboard>();
                var d = q.AddComponent<StDrift>(); d.amp = new Vector3(0.5f, 0.35f, 0.5f); d.speed = 0.15f + (float)rng.NextDouble() * 0.2f; d.seed = i * 1.7f; Built.Add(q.transform);
            }
            for (int i = 0; i < 10; i++)
            {
                var c = cells[rng.Next(cells.Count)] + new Vector3(0, 0.25f + (float)rng.NextDouble() * 0.3f, 0);
                var q = GameObject.CreatePrimitive(PrimitiveType.Quad); Object.Destroy(q.GetComponent<Collider>()); q.name = "fog_sheet";
                q.transform.position = c; q.transform.rotation = Quaternion.Euler(90, rng.Next(360), 0); q.transform.localScale = Vector3.one * (5f + (float)rng.NextDouble() * 4f);
                q.GetComponent<MeshRenderer>().sharedMaterial = StGlow.Mat(fog * (id == "sewer" ? 0.22f : 0.14f), 1.5f);
                var d = q.AddComponent<StDrift>(); d.amp = new Vector3(1.6f, 0f, 1.0f); d.speed = 0.05f + (float)rng.NextDouble() * 0.05f; d.seed = i * 3.1f; d.spin = 4f; Built.Add(q.transform);
            }
        }

        static void Edge(Vector3 e, bool alongX, Color tint, bool rocky, int north)
        {
            if (rocky)
            {
                // boulder wall: 2-3 Quaternius rocks per edge, overlapping, 4-6 u tall
                int n = 2 + rng.Next(2);
                for (int i = 0; i < n; i++)
                {
                    float t = (i + 0.5f) / n - 0.5f; var off = alongX ? new Vector3(t * T, 0, 1.0f) : new Vector3(e.x < Centre.x ? -1.0f : 1.0f, 0, t * T);
                    var r = Prop("Nature/Rock_Medium_" + (1 + rng.Next(3)), e + off, rng.Next(360), 2.8f + (float)rng.NextDouble() * 1.2f, new Color(0.55f, 0.52f, 0.55f), tint);
                    var rb = StWorld.Bounds(r); float wmax = Mathf.Max(rb.size.x, rb.size.z); if (wmax > 2.6f) { float f = 2.6f / wmax; r.transform.localScale = Vector3.Scale(r.transform.localScale, new Vector3(f, 1, f)); Ground(r, e + off); Built.RemoveAt(Built.Count - 1); }
                }
                return;
            }
            string w = rng.Next(5) == 0 ? "wall_cracked" : rng.Next(6) == 0 ? "wall_arched" : "wall";
            var g = StKit.Spawn("Dungeon/" + w, Vector3.zero, 0); Tint(g, tint);
            var b = StWorld.Bounds(g); if ((b.size.x >= b.size.z) != alongX) g.transform.rotation = Quaternion.Euler(0, 90, 0);
            b = StWorld.Bounds(g); g.transform.position += new Vector3(e.x - b.center.x, -b.min.y, e.z - b.center.z); Built.Add(g.transform);
        }

        static void Lip(Vector3 e, Color tint, bool rocky)
        {
            // low front edge so the room reads as enclosed without hiding the hero (kept clear of the combat middle)
            if (Mathf.Abs(e.x - Centre.x) < 7f) return;
            if (rocky) { Prop("Nature/Pebble_Round_" + (rng.Next(2) == 0 ? 1 : 3), e + new Vector3(((float)rng.NextDouble() - 0.5f) * 2, 0, -0.3f), rng.Next(360), 0.8f, new Color(0.5f, 0.48f, 0.5f), tint); return; }
            if (rng.Next(2) == 0) Kit("rubble_half", e + new Vector3(((float)rng.NextDouble() - 0.5f) * 2, 0, -0.4f), rng.Next(360), tint);
        }

        static void WaterCell(Vector3 c)
        {
            // sunken channel: dark bed + translucent green emissive water + side kerbs
            Box(c + new Vector3(0, -0.9f, 0), new Vector3(T, 0.2f, T), new Color(0.12f, 0.16f, 0.10f));
            var w = Box(c + new Vector3(0, -0.35f, 0), new Vector3(T, 0.05f, T * 0.92f), new Color(0.20f, 0.40f, 0.30f), new Color(0.03f, 0.09f, 0.05f));
            w.name = "sewer_water"; StFlow.Water(w.GetComponent<MeshRenderer>(), new Color(0.24f, 0.46f, 0.36f), new Vector2(0.35f, 0f));
            Box(c + new Vector3(0, -0.2f, T * 0.5f - 0.15f), new Vector3(T, 0.5f, 0.3f), new Color(0.48f, 0.52f, 0.44f));
            Box(c + new Vector3(0, -0.2f, -T * 0.5f + 0.15f), new Vector3(T, 0.5f, 0.3f), new Color(0.48f, 0.52f, 0.44f));
        }

        static Vector3 Rand(string[] m, float inset = 1.0f)
        {
            for (int tries = 0; tries < 50; tries++)
            {
                int z = rng.Next(m.Length), x = rng.Next(m[0].Length);
                if (!At(m, x, z)) continue;
                if (biome == "sewer" && z == 1) continue;
                var p = Cell(m, x, z) + new Vector3(((float)rng.NextDouble() - 0.5f) * (T - inset * 2), 0, ((float)rng.NextDouble() - 0.5f) * (T - inset * 2));
                if (NearSpot(p, 2.4f)) continue;
                return p;
            }
            return Vector3.zero;
        }

        /// <summary>Against the north wall of a random column (props hug walls, the middle stays free for combat).</summary>
        static Vector3 NorthWall(string[] m, int x)
        {
            for (int z = 0; z < m.Length; z++) if (At(m, x, z)) return Cell(m, x, z) + new Vector3(0, 0, T * 0.5f - 0.9f);
            return Vector3.zero;
        }

        static void WallTorch(Vector3 p, Color c)
        {
            var g = StKit.Spawn("Dungeon/torch_mounted", Vector3.zero, 180); Ground(g, p + Vector3.up * 2.2f, false);
            PointLight(p + new Vector3(0, 2.7f, -0.5f), c, 8f, 12f, true); Flame(p + new Vector3(0, 2.75f, -0.4f), new Color(2.4f, 1.1f, 0.35f), 0.5f);
        }

        static void Crypt(string[] m)
        {
            var col = Get("crypt").wall;
            for (int x = 1; x < m[0].Length - 1; x += 2) WallTorch(NorthWall(m, x) + new Vector3(0, 0, 0.5f), new Color(1f, 0.62f, 0.32f));
            // central sarcophagus (kitbash: KayKit chest scaled + stone slab) with a cold rune glow
            var altar = Grave("altar-stone", Centre + new Vector3(0, 0, 1.5f), 0, 0f, 3.6f);
            Grave("coffin", Centre + new Vector3(0, StWorld.Bounds(altar).max.y, 1.5f), 90, 0.0f, 2.8f);
            Grave("coffin-old", Centre + new Vector3(-6.5f, 0, -3.5f), 70, 0.0f, 3.0f);
            Grave("urn-round", Centre + new Vector3(-1.9f, 0, 3.2f), 0, 0.9f, 0); Grave("urn-square", Centre + new Vector3(1.9f, 0, 3.2f), 0, 0.9f, 0);
            Grave("candle-multiple", Centre + new Vector3(5.8f, 0, -3.2f), 0, 0.6f, 0); Grave("gravestone-broken", Centre + new Vector3(6.2f, 0, 4.0f), 200, 1.4f, 0);
            PointLight(Centre + new Vector3(0, 2.2f, 1.5f), new Color(0.5f, 0.6f, 1f), 6f, 9f, false);
            StGlowRing(Centre + new Vector3(0, 0.05f, 1.5f), new Color(0.4f, 0.55f, 1.6f), 5f);
            for (int i = 0; i < 4; i++) Kit(i % 2 == 0 ? "pillar_decorated" : "pillar", Centre + new Vector3(i < 2 ? -5.5f : 5.5f, 0, i % 2 == 0 ? 4.5f : -2f), 0, col);
            string[] graves = { "Grave_A", "Grave_Cross", "Grave_Obelisk" };
            for (int i = 0; i < 6; i++) { var g = StTown.VK(graves[i % 3], Rand(m, 1.3f), rng.Next(-20, 20) + 180, 0.75f); Built.Add(g.transform); }
            for (int i = 0; i < 5; i++) Prop(i % 2 == 0 ? "Vase_2" : "Vase_4", Rand(m, 0.8f), rng.Next(360), 1.0f, new Color(0.62f, 0.5f, 0.42f), Color.white);
            Prop("Vase_Rubble_Medium", Rand(m), 0, 0.5f, new Color(0.62f, 0.5f, 0.42f), Color.white);
            Prop("CandleStick_Stand", Centre + new Vector3(-2.6f, 0, 1.5f), 0, 2.0f, new Color(0.5f, 0.5f, 0.55f), Color.white);
            Prop("CandleStick_Stand", Centre + new Vector3(2.6f, 0, 1.5f), 0, 2.0f, new Color(0.5f, 0.5f, 0.55f), Color.white);
            Flame(Centre + new Vector3(-2.6f, 2.1f, 1.5f), new Color(2.2f, 1.2f, 0.4f), 0.35f); Flame(Centre + new Vector3(2.6f, 2.1f, 1.5f), new Color(2.2f, 1.2f, 0.4f), 0.35f);
            Prop("Bookcase_2", NorthWall(m, 2) + new Vector3(1.0f, 0, -0.1f), 0, 3.2f, new Color(0.5f, 0.35f, 0.24f), Color.white);
            Prop("Chest_Wood", NorthWall(m, 5) + new Vector3(0, 0, -0.4f), 180, 1.0f, new Color(0.5f, 0.35f, 0.24f), Color.white);
            Prop("Coin_Pile", NorthWall(m, 5) + new Vector3(1.2f, 0, -0.5f), 0, 0.4f, new Color(0.95f, 0.75f, 0.25f), Color.white);
            Kit("banner_patternA_red", NorthWall(m, 3) + new Vector3(0, 2.4f, 0.35f), 0, Color.white, false);
            Kit("banner_shield_red", NorthWall(m, 4) + new Vector3(0, 2.4f, 0.35f), 0, Color.white, false);
        }

        static void Cave(string[] m)
        {
            Color[] glow = { new Color(0.3f, 1.4f, 1.6f), new Color(1.2f, 0.45f, 1.6f), new Color(0.4f, 1.6f, 0.6f) };
            string[] kinds = { "sapphire", "amethyst", "emerald" };
            for (int i = 0; i < 9; i++)
            {
                var p = Rand(m, 0.6f); int k = i % 3;
                for (int j = 0; j < 3; j++) Gem(kinds[k], p + new Vector3(j * 0.5f - 0.5f, 0, (j % 2) * 0.4f), 1.1f + j * 0.45f, glow[k], rng.Next(-35, 35));
                PointLight(p + Vector3.up * 1.5f, glow[k] * 0.6f, 5f, 8f, false);
            }
            for (int i = 0; i < 10; i++)
            {
                var g = Prop(i % 3 == 0 ? "Nature/Mushroom_Laetiporus" : "Nature/Mushroom_Common", Rand(m, 0.5f), rng.Next(360), 0.35f + (float)rng.NextDouble() * 0.4f, new Color(0.85f, 0.35f, 0.3f), Color.white);
                if (i % 2 == 0) Flat(g, new Color(0.4f, 0.9f, 1f), Color.white, new Color(0.1f, 0.35f, 0.45f));
            }
            for (int i = 0; i < 8; i++) Prop("Nature/Pebble_Round_" + (i % 2 == 0 ? 1 : 3), Rand(m, 0.4f), rng.Next(360), 0.5f, new Color(0.55f, 0.52f, 0.55f), Color.white);
            for (int i = 0; i < 4; i++) Prop("Nature/Rock_Medium_" + (1 + i % 3), Rand(m, 1.4f), rng.Next(360), 1.6f, new Color(0.55f, 0.52f, 0.55f), new Color(0.9f, 0.85f, 0.95f));
            for (int i = 0; i < 5; i++) Prop(i % 2 == 0 ? "Nature/Fern_1" : "Nature/Plant_7", Rand(m, 0.4f), rng.Next(360), 0.9f, new Color(0.3f, 0.55f, 0.45f), new Color(0.7f, 1f, 0.9f));
            Prop("Nature/DeadTree_3", NorthWall(m, 3) + new Vector3(0, 0, -0.6f), 0, 4.5f, new Color(0.45f, 0.36f, 0.32f), Color.white);
            // underground pool
            var pool = GameObject.CreatePrimitive(PrimitiveType.Cylinder); Object.Destroy(pool.GetComponent<Collider>()); pool.name = "cave_pool";
            pool.transform.position = Centre + new Vector3(4.5f, 0.02f, -2.5f); pool.transform.localScale = new Vector3(4.6f, 0.02f, 3.0f);
            pool.GetComponent<MeshRenderer>().sharedMaterial = StMat.Make("cave_pool", null, new Color(0.12f, 0.36f, 0.45f), false, 0, new Color(0.04f, 0.18f, 0.24f)); Built.Add(pool.transform);
        }

        static void Sewer(string[] m)
        {
            for (int x = 0; x < m[0].Length; x += 2)
            {
                var p = NorthWall(m, x) + new Vector3(0, 0, 0.5f);
                var l = Prop("Lantern_Wall", p + new Vector3(0, 2.4f, 0), 180, 0.9f, new Color(0.4f, 0.4f, 0.42f), Color.white); Ground(l, p + new Vector3(0, 2.6f, -0.1f), false);
                PointLight(p + new Vector3(0, 2.4f, -0.8f), new Color(0.95f, 1f, 0.6f), 6f, 10f, true); Flame(p + new Vector3(0, 2.5f, -0.35f), new Color(2.0f, 1.8f, 0.6f), 0.35f);
            }
            // green bounce off the channel
            for (int x = 1; x < m[0].Length; x += 3) PointLight(Cell(m, x, 1) + Vector3.up * 0.6f, new Color(0.35f, 0.9f, 0.3f), 3.5f, 7f, false);
            // bridges over the channel
            foreach (var x in new[] { 2, 6 }) { var c = Cell(m, x, 1); Box(c + new Vector3(0, -0.02f, 0), new Vector3(2.2f, 0.18f, T + 0.4f), new Color(0.5f, 0.36f, 0.24f)); }
            // outflow pipes in the north wall
            foreach (var x in new[] { 1, 4, 7 }) { var c = NorthWall(m, x) + new Vector3(0, 0, 0.7f); var p = Box(c + new Vector3(0, 1.0f, 0), new Vector3(1.3f, 1.3f, 0.6f), new Color(0.40f, 0.42f, 0.38f)); Box(c + new Vector3(0, 1.0f, -0.32f), new Vector3(0.9f, 0.9f, 0.05f), new Color(0.05f, 0.07f, 0.05f)); }
            for (int i = 0; i < 6; i++) Prop(i % 2 == 0 ? "Barrel" : "Bucket_Metal", Rand(m, 1.0f), rng.Next(360), i % 2 == 0 ? 1.3f : 0.6f, new Color(0.45f, 0.4f, 0.3f), new Color(0.85f, 1f, 0.8f));
            for (int i = 0; i < 4; i++) Prop("Crate_Wooden", Rand(m, 1.0f), rng.Next(360), 1.0f, new Color(0.5f, 0.4f, 0.28f), new Color(0.85f, 1f, 0.8f));
            Prop("Cage_Small", Rand(m), 20, 1.4f, new Color(0.45f, 0.47f, 0.5f), Color.white);
            Prop("Chain_Coil", Rand(m), 0, 0.2f, new Color(0.45f, 0.47f, 0.5f), Color.white);
            for (int i = 0; i < 6; i++) Box(Rand(m, 0.6f) + new Vector3(0, 0.01f, 0), new Vector3(0.8f + (float)rng.NextDouble() * 0.6f, 0.02f, 0.6f + (float)rng.NextDouble() * 0.5f), new Color(0.22f, 0.34f, 0.18f), new Color(0.01f, 0.03f, 0.01f)); // slime puddles
        }

        static void Mine(string[] m)
        {
            var wood = new Color(0.55f, 0.38f, 0.24f);
            // timber supports: two posts + lintel along the room, each with a hanging lantern
            for (int i = 0; i < 4; i++)
            {
                var c = Centre + new Vector3(-9 + i * 6, 0, 5.5f); // supports along the back so the game camera sees under them
                Box(c + new Vector3(-2.6f, 2.0f, 0), new Vector3(0.45f, 4f, 0.45f), wood); Box(c + new Vector3(2.6f, 2.0f, 0), new Vector3(0.45f, 4f, 0.45f), wood);
                Box(c + new Vector3(0, 4.1f, 0), new Vector3(6f, 0.5f, 0.55f), wood * 0.9f);
                Box(c + new Vector3(0, 3.55f, 0), new Vector3(0.05f, 0.7f, 0.05f), new Color(0.3f, 0.3f, 0.3f));
                Box(c + new Vector3(0, 3.1f, 0), new Vector3(0.35f, 0.45f, 0.35f), new Color(0.35f, 0.33f, 0.3f), new Color(0.9f, 0.55f, 0.2f));
                PointLight(c + new Vector3(0, 2.9f, 0), new Color(1f, 0.66f, 0.32f), 9f, 11f, true);
            }
            // minecart rails across the room
            float x0 = Centre.x - 14, x1 = Centre.x + 14; float z = Centre.z - 2.5f;
            Box(new Vector3(Centre.x, 0.08f, z - 0.55f), new Vector3(x1 - x0, 0.1f, 0.1f), new Color(0.5f, 0.5f, 0.55f));
            Box(new Vector3(Centre.x, 0.08f, z + 0.55f), new Vector3(x1 - x0, 0.1f, 0.1f), new Color(0.5f, 0.5f, 0.55f));
            for (float x = x0; x <= x1; x += 0.9f) Box(new Vector3(x, 0.03f, z), new Vector3(0.28f, 0.06f, 1.6f), wood * 0.8f);
            // minecart (kitbash: crate body on dark wheels) loaded with ore
            var cart = new Vector3(Centre.x + 3, 0, z);
            Box(cart + new Vector3(0, 0.85f, 0), new Vector3(2.0f, 0.9f, 1.3f), new Color(0.45f, 0.42f, 0.4f));
            foreach (var wx in new[] { -0.7f, 0.7f }) foreach (var wz in new[] { -0.6f, 0.6f }) Box(cart + new Vector3(wx, 0.3f, wz), new Vector3(0.5f, 0.5f, 0.12f), new Color(0.15f, 0.15f, 0.16f));
            for (int i = 0; i < 4; i++) Gem(i % 2 == 0 ? "topaz" : "ruby", cart + new Vector3(-0.6f + i * 0.4f, 1.2f, 0), 0.45f, i % 2 == 0 ? new Color(1.5f, 1.0f, 0.2f) : new Color(1.5f, 0.3f, 0.25f), rng.Next(360));
            // ore veins in the walls
            for (int x = 0; x < m[0].Length; x++) if (rng.Next(2) == 0 && (At(m, x, 0) || At(m, x, 1))) { var p = NorthWall(m, x); if (p != Vector3.zero) { Gem("topaz", p + new Vector3(0.4f, 0f, 0.3f), 0.9f, new Color(1.4f, 0.9f, 0.2f), 30); PointLight(p + new Vector3(0, 1.2f, -0.6f), new Color(1f, 0.75f, 0.3f), 2.5f, 5f, false); } }
            Prop("Pickaxe_Bronze", Rand(m), 40, 1.4f, wood, Color.white);
            Prop("Anvil", Rand(m, 1.2f), 20, 0.9f, new Color(0.4f, 0.4f, 0.44f), Color.white);
            Prop("Workbench", NorthWall(m, 3) + new Vector3(0, 0, -0.4f), 180, 1.4f, wood, Color.white);
            for (int i = 0; i < 6; i++) Prop(i % 3 == 0 ? "Crate_Metal" : "Crate_Wooden", Rand(m, 1.0f), rng.Next(360), 1.0f, wood, Color.white);
            for (int i = 0; i < 3; i++) Prop(i == 0 ? "Rope_1" : "Bag", Rand(m), rng.Next(360), 0.6f, new Color(0.8f, 0.7f, 0.5f), Color.white);
            for (int i = 0; i < 6; i++) Prop("Nature/Pebble_Square_2", Rand(m, 0.4f), rng.Next(360), 0.45f, new Color(0.55f, 0.45f, 0.38f), Color.white);
        }

        static void StGlowRing(Vector3 p, Color c, float d)
        {
            var q = GameObject.CreatePrimitive(PrimitiveType.Quad); Object.Destroy(q.GetComponent<Collider>());
            q.transform.position = p; q.transform.rotation = Quaternion.Euler(90, 0, 0); q.transform.localScale = Vector3.one * d;
            q.GetComponent<MeshRenderer>().sharedMaterial = StGlow.Mat(c, 1); Built.Add(q.transform);
        }
    }

    /// <summary>Procedural ripple texture scrolled on unscaled time (works with Time.timeScale = 0 in proof runs).</summary>
    public class StFlow : MonoBehaviour
    {
        static Texture2D ripple;
        Material m; public Vector2 vel;
        public static void Water(MeshRenderer r, Color col, Vector2 vel)
        {
            if (!ripple)
            {
                ripple = new Texture2D(128, 128, TextureFormat.RGBA32, true) { wrapMode = TextureWrapMode.Repeat, name = "st_ripple" };
                for (int y = 0; y < 128; y++) for (int x = 0; x < 128; x++)
                {
                    float u = x / 128f * Mathf.PI * 2, v = y / 128f * Mathf.PI * 2;
                    float n = 0.5f + 0.25f * Mathf.Sin(u * 3 + Mathf.Sin(v * 2) * 1.5f) + 0.25f * Mathf.Sin(v * 5 + Mathf.Sin(u * 2));
                    float b = n > 0.86f ? 1.35f : n < 0.2f ? 0.82f : 1f; ripple.SetPixel(x, y, new Color(b, b, b, 1));
                }
                ripple.Apply();
            }
            var m = StMat.Make("water_" + ColorUtility.ToHtmlStringRGB(col), ripple, col, false, 0, col * 0.25f);
            m = new Material(m); m.SetTextureScale("_BaseMap", new Vector2(2, 2)); m.SetFloat("_Outline", 0);
            r.sharedMaterial = m; var f = r.gameObject.AddComponent<StFlow>(); f.m = m; f.vel = vel;
        }
        void Update() { if (m) m.SetTextureOffset("_BaseMap", vel * Time.unscaledTime); }
    }

    public class StDrift : MonoBehaviour
    {
        public Vector3 amp; public float speed = 0.2f, seed, spin; Vector3 home; Quaternion rot;
        void Start() { home = transform.position; rot = transform.rotation; }
        void Update()
        {
            float t = Time.unscaledTime * speed + seed;
            transform.position = home + new Vector3(Mathf.Sin(t) * amp.x, Mathf.Sin(t * 1.3f + 1) * amp.y, Mathf.Cos(t * 0.8f) * amp.z);
            if (spin != 0) transform.rotation = Quaternion.Euler(0, Time.unscaledTime * spin + seed * 10, 0) * rot;
        }
    }
}
