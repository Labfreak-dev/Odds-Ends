using System.Collections.Generic;
using UnityEngine;

namespace Hollowmere.StyleTest.Fishing
{
    /// <summary>A fishing spot: water (pool or an existing channel), a stand point + facing, the bobber hotspot, and a
    /// marker (post + fish sign + floating fish icon + ripple rings). Build() runs after StTown/StBiomes.Build and clears
    /// any props standing in the pool footprint. Offsets are authored in design units (hero = 3) and scaled by StFishDb.U.</summary>
    public class FishSpot
    {
        public string loc; public Vector3 stand, facing, hotspot, poolCentre; public float waterY, rx, rz; public Transform root;
        public LocationDef Def => StFishDb.Locations[loc];
        public static FishSpot Current;
    }

    public static class StFishSpot
    {
        static readonly List<GameObject> made = new List<GameObject>();

        static Texture2D Icon(string key) => Resources.Load<Texture2D>("STO/Fish/" + key);

        public static FishSpot Build(string loc)
        {
            float U = StFishDb.U; var s = new FishSpot { loc = loc }; made.Clear();
            var root = new GameObject("fish_spot_" + loc).transform; s.root = root;
            Vector3 anchor = loc == "town" ? Vector3.zero : StBiomes.Centre;
            float room = loc == "town" ? 1f : StScale.DungeonKit; // dungeon rooms are laid out on the kit grid (x DungeonKit)
            System.Func<float, float, Vector3> P = (x, z) => anchor + new Vector3(x, 0, z) * U * room;
            bool pool = true;
            switch (loc)
            {
                case "town": s.poolCentre = P(-9.5f, -25f); s.rx = 3.4f * U; s.rz = 2.8f * U; s.stand = P(-4.3f, -25f); s.facing = Vector3.left; break;
                case "crypt": s.poolCentre = P(-6.6f, -3.6f); s.rx = 2.6f * U; s.rz = 2.1f * U; s.stand = P(-2.9f, -3.6f); s.facing = Vector3.left; break;
                case "cave": s.poolCentre = P(4.6f, -2.5f); s.rx = 2.5f * U; s.rz = 1.7f * U; s.stand = P(1.2f, -2.5f); s.facing = Vector3.right; break;
                case "mine": s.poolCentre = P(-6.2f, -6.2f); s.rx = 2.4f * U; s.rz = 2.0f * U; s.stand = P(-2.7f, -6.2f); s.facing = Vector3.left; break;
                default:
                {
                    // sewer: fish the existing outflow channel from its south kerb
                    pool = false; float cz = anchor.z + 4 * U, wy = -0.3f * U; bool found = false;
                    foreach (var t in StBiomes.Built) if (t && t.name == "sewer_water") { var b = StWorld.Bounds(t.gameObject); if (!found || Mathf.Abs(b.center.x - (anchor.x - 6 * U)) < 3 * U) { cz = b.center.z; wy = b.max.y; found = true; } }
                    s.poolCentre = new Vector3(anchor.x - 6 * U, wy, cz); s.rx = 2.6f * U; s.rz = 1.6f * U;
                    s.stand = new Vector3(anchor.x - 6 * U, 0, cz - 3.7f * U); s.facing = Vector3.forward; s.waterY = wy; break;
                }
            }
            if (pool) s.waterY = 0.05f * U;
            s.poolCentre.y = s.waterY;
            s.hotspot = s.poolCentre + (s.stand - s.poolCentre).normalized * (loc == "sewer" ? 0 : Mathf.Min(s.rx, s.rz) * 0.15f); s.hotspot.y = s.waterY;
            Clear(s);
            var def = StFishDb.Locations[loc];
            if (pool) Pool(s, def, root);
            Marker(s, def, root);
            if (loc == "town") TownDressing(s, root);
            FishSpot.Current = s;
            Debug.Log("[ST] p5b spot " + loc + " stand " + s.stand + " hotspot " + s.hotspot);
            return s;
        }

        /// <summary>Hide props (not floors/walls/ground) overlapping the pool footprint or the stand point.</summary>
        static void Clear(FishSpot s)
        {
            float U = StFishDb.U; int n = 0;
            var lists = new List<Transform>(); lists.AddRange(StBiomes.Built); if (s.loc == "town") { lists.AddRange(StTown.Built); foreach (var f in StTown.Folk) if (f) lists.Add(f.transform); }
            foreach (var t in lists)
            {
                if (t == null || !t.gameObject.activeSelf) continue; var nm = t.name.ToLowerInvariant();
                if (nm.Contains("floor") || nm.Contains("wall") || nm.Contains("grass") || nm.Contains("road") || nm.Contains("plaza") || nm.Contains("sewer_water") || nm.Contains("bio_key") || t.GetComponent<Light>()) continue;
                var b = StWorld.Bounds(t.gameObject); bool big = b.size.x > 9 * U || b.size.z > 9 * U;
                // nearest point of the prop's footprint to the pool centre, in ellipse space
                var c = new Vector3(Mathf.Clamp(s.poolCentre.x, b.min.x, b.max.x), 0, Mathf.Clamp(s.poolCentre.z, b.min.z, b.max.z));
                float ex = (c.x - s.poolCentre.x) / (s.rx + 0.9f * U), ez = (c.z - s.poolCentre.z) / (s.rz + 0.9f * U);
                var cs = new Vector3(Mathf.Clamp(s.stand.x, b.min.x, b.max.x), 0, Mathf.Clamp(s.stand.z, b.min.z, b.max.z));
                bool hit = !big && (ex * ex + ez * ez < 1 || (cs - new Vector3(s.stand.x, 0, s.stand.z)).magnitude < 1.4f * U);
                // big props (trees, rock clusters): judge by their pivot/trunk instead of the canopy bounds
                var pv = t.position; float px = (pv.x - s.poolCentre.x) / (s.rx + 1.2f * U), pz = (pv.z - s.poolCentre.z) / (s.rz + 1.2f * U);
                if (px * px + pz * pz < 1 || new Vector2(pv.x - s.stand.x, pv.z - s.stand.z).magnitude < 1.4f * U) hit = true;
                if (s.loc == "cave" && nm == "cave_pool") hit = true;
                if (hit) { t.gameObject.SetActive(false); n++; }
            }
            // second sweep at renderer level: anything standing proud inside the pool that isn't floor (kit rubble, scattered rocks)
            foreach (var r in Object.FindObjectsByType<Renderer>(FindObjectsSortMode.None))
            {
                if (!r.enabled || r is ParticleSystemRenderer) continue; var rn = r.transform.root.name.ToLowerInvariant() + "/" + r.name.ToLowerInvariant();
                if (rn.Contains("floor") || rn.Contains("grass") || rn.Contains("road") || rn.Contains("plaza") || rn.Contains("water") || rn.Contains("fish_") || rn.Contains("dust") || rn.Contains("fog")) continue;
                if (r.GetComponentInParent<StActor>() != null) continue;
                var b = r.bounds; if (b.size.x > 9 * U || b.size.z > 9 * U || b.max.y < 0.12f * U || b.min.y < -2f) continue;
                float ex = (b.center.x - s.poolCentre.x) / (s.rx + 0.3f * U), ez = (b.center.z - s.poolCentre.z) / (s.rz + 0.3f * U);
                if (ex * ex + ez * ez < 1) { r.enabled = false; n++; Debug.Log("[ST] p5b spot sweep " + rn); }
            }
            Debug.Log("[ST] p5b spot " + s.loc + " cleared " + n);
        }

        static GameObject Disc(string name, Vector3 c, float rx, float rz, float h, Material m, Transform parent)
        {
            var g = GameObject.CreatePrimitive(PrimitiveType.Cylinder); Object.Destroy(g.GetComponent<Collider>()); g.name = name;
            g.transform.SetParent(parent, false); g.transform.position = c; g.transform.localScale = new Vector3(rx * 2, h, rz * 2);
            var r = g.GetComponent<MeshRenderer>(); r.sharedMaterial = m; r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off; return g;
        }

        static void Pool(FishSpot s, LocationDef d, Transform root)
        {
            float U = StFishDb.U; var c = s.poolCentre; c.y = 0;
            // dark bank -> deep ring -> rippled surface (concentric discs read as a sunken basin from the game camera)
            Disc("pool_bank", c + Vector3.up * 0.012f * U, s.rx + 0.45f * U, s.rz + 0.45f * U, 0.01f * U, StMat.Make("pool_bank_" + s.loc, null, Color.Lerp(d.deep, new Color(0.25f, 0.22f, 0.18f), 0.5f), false), root);
            Disc("pool_deep", c + Vector3.up * 0.02f * U, s.rx + 0.12f * U, s.rz + 0.12f * U, 0.01f * U, StMat.Make("pool_deep_" + s.loc, null, d.deep, false, 0, d.deep * 0.3f), root);
            var w = Disc("pool_water", c + Vector3.up * s.waterY, s.rx * 0.93f, s.rz * 0.93f, 0.01f * U, null, root);
            StFlow.Water(w.GetComponent<MeshRenderer>(), d.water * 0.85f, new Vector2(0.05f, 0.03f));
            var cen = Disc("pool_centre", c + Vector3.up * (s.waterY + 0.004f * U), s.rx * 0.5f, s.rz * 0.5f, 0.01f * U, StMat.Make("pool_mid_" + s.loc, null, Color.Lerp(d.water, d.deep, 0.45f), false, 0, d.deep * 0.25f), root);
            cen.GetComponent<MeshRenderer>().sharedMaterial.SetFloat("_Outline", 0);
            // rim stones (skip the stand side so the hero stands on the edge)
            var stoneTint = s.loc == "town" ? new Color(0.75f, 0.74f, 0.7f) : s.loc == "mine" ? new Color(0.62f, 0.5f, 0.4f) : s.loc == "crypt" ? new Color(0.55f, 0.56f, 0.7f) : new Color(0.5f, 0.56f, 0.6f);
            var rng = new System.Random(s.loc.GetHashCode() & 0xffff); var toStand = Mathf.Atan2(s.stand.z - c.z, s.stand.x - c.x);
            int n = 22;
            for (int i = 0; i < n; i++)
            {
                float a = i / (float)n * Mathf.PI * 2; float da = Mathf.DeltaAngle(a * Mathf.Rad2Deg, toStand * Mathf.Rad2Deg);
                if (Mathf.Abs(da) < 24) continue;
                var p = c + new Vector3(Mathf.Cos(a) * (s.rx + 0.25f * U), 0, Mathf.Sin(a) * (s.rz + 0.25f * U));
                var res = i % 3 == 0 ? "Nature/Rock_Medium_" + (1 + rng.Next(3)) : "Nature/Pebble_Round_" + (rng.Next(2) == 0 ? 1 : 3);
                var g = StKit.Spawn(res, Vector3.zero, rng.Next(360)); var pf = Resources.Load<GameObject>("ST/" + res); if (pf) g.transform.rotation = Quaternion.Euler(0, rng.Next(360), 0) * pf.transform.rotation;
                StMat.ApplyGeneric(g, 0.55f); foreach (var r in g.GetComponentsInChildren<Renderer>()) { var m = new Material(r.sharedMaterial); m.SetColor("_BaseColor", stoneTint * (0.85f + 0.3f * (float)rng.NextDouble())); r.sharedMaterial = m; }
                var b = StWorld.Bounds(g); float h = (i % 3 == 0 ? 0.75f : 0.4f) * U * (0.8f + 0.5f * (float)rng.NextDouble());
                g.transform.localScale *= h / Mathf.Max(0.01f, Mathf.Max(b.size.y, Mathf.Max(b.size.x, b.size.z) * 0.6f));
                b = StWorld.Bounds(g); g.transform.position += new Vector3(p.x - b.center.x, -b.min.y - 0.05f * U, p.z - b.center.z); g.transform.SetParent(root, true);
            }
            // biome extras: cave crystals glow in it, crypt candles, mine plank walkway
            if (s.loc == "mine")
                for (int i = 0; i < 3; i++)
                {
                    var g = GameObject.CreatePrimitive(PrimitiveType.Cube); Object.Destroy(g.GetComponent<Collider>()); g.transform.SetParent(root, false);
                    g.transform.position = s.stand + s.facing * (0.9f + i * 0.02f) * U + Vector3.Cross(Vector3.up, s.facing) * (i - 1) * 0.42f * U + Vector3.up * 0.06f * U;
                    g.transform.rotation = Quaternion.LookRotation(s.facing); g.transform.localScale = new Vector3(0.38f, 0.1f, 1.8f) * U;
                    g.GetComponent<Renderer>().sharedMaterial = StMat.Make("mine_plank", null, new Color(0.55f, 0.38f, 0.24f) * (0.9f + 0.1f * i), false);
                }
        }

        static void Marker(FishSpot s, LocationDef d, Transform root)
        {
            float U = StFishDb.U; var side = Vector3.Cross(Vector3.up, s.facing).normalized; // facing left -> side = -z? keep the post on the camera-near side
            if (side.z < -0.1f || (Mathf.Abs(side.z) < 0.1f && side.x < 0)) side = -side; // post behind/beside the hero, never between hero and camera
            var basePos = s.stand + side * 1.5f * U + s.facing * 0.6f * U; basePos.y = 0;
            var wood = StMat.Make("fish_post", null, new Color(0.55f, 0.38f, 0.24f), false);
            var post = GameObject.CreatePrimitive(PrimitiveType.Cube); Object.Destroy(post.GetComponent<Collider>()); post.name = "fish_post"; post.transform.SetParent(root, false);
            post.transform.position = basePos + Vector3.up * 1.15f * U; post.transform.localScale = new Vector3(0.18f, 2.3f, 0.18f) * U; post.GetComponent<Renderer>().sharedMaterial = wood;
            var board = GameObject.CreatePrimitive(PrimitiveType.Cube); Object.Destroy(board.GetComponent<Collider>()); board.name = "fish_sign"; board.transform.SetParent(root, false);
            board.transform.position = basePos + Vector3.up * 2.0f * U + Vector3.back * 0.12f * U; board.transform.localScale = new Vector3(1.25f, 0.85f, 0.08f) * U;
            board.GetComponent<Renderer>().sharedMaterial = StMat.Make("fish_board", null, new Color(0.72f, 0.55f, 0.35f), false);
            var tex = Icon("fish_t1") ?? FallbackFish(new Color(0.9f, 0.6f, 0.3f));
            var pic = GameObject.CreatePrimitive(PrimitiveType.Quad); Object.Destroy(pic.GetComponent<Collider>()); pic.name = "fish_sign_icon"; pic.transform.SetParent(root, false);
            pic.transform.position = board.transform.position + Vector3.back * 0.06f * U; pic.transform.rotation = Quaternion.Euler(-35, 0, 0); pic.transform.localScale = new Vector3(1.15f, 0.8f, 1) * U;
            pic.transform.position = board.transform.position + new Vector3(0, 0.02f, -0.06f) * U; pic.transform.rotation = Quaternion.identity;
            pic.GetComponent<MeshRenderer>().sharedMaterial = StMat.Picture(tex);
            // floating "fish here" icon over the hotspot, bobbing, plus soft glow + ripples on the water
            var fl = GameObject.CreatePrimitive(PrimitiveType.Quad); Object.Destroy(fl.GetComponent<Collider>()); fl.name = "fish_float_icon"; fl.transform.SetParent(root, false);
            fl.transform.position = s.hotspot + Vector3.up * 2.1f * U; fl.transform.localScale = Vector3.one * 1.1f * U;
            fl.GetComponent<MeshRenderer>().sharedMaterial = StMat.Picture(Icon("lure_t3") ?? tex); fl.AddComponent<StBillboard>();
            var dr = fl.AddComponent<StDrift>(); dr.amp = new Vector3(0, 0.18f * U, 0); dr.speed = 0.5f; dr.seed = 1.3f;
            var rp = new GameObject("fish_ripples").AddComponent<StFishRipples>(); rp.transform.SetParent(root, false); rp.transform.position = s.hotspot + Vector3.up * 0.02f * U;
            rp.radius = 1.0f * U; rp.col = new Color(0.85f, 0.95f, 1f, 0.35f);
        }

        static void TownDressing(FishSpot s, Transform root)
        {
            float U = StFishDb.U; var c = s.poolCentre; c.y = 0; var rng = new System.Random(7);
            // lily pads + reeds on the far side, a short jetty under the stand point
            var pad = StMat.Make("lilypad", null, new Color(0.35f, 0.62f, 0.3f), false);
            for (int i = 0; i < 6; i++)
            {
                float a = (float)rng.NextDouble() * Mathf.PI * 2, r = 0.45f + 0.4f * (float)rng.NextDouble();
                var p = c + new Vector3(Mathf.Cos(a) * s.rx * r, s.waterY + 0.01f * U, Mathf.Sin(a) * s.rz * r);
                if ((p - s.hotspot).magnitude < 1.3f * U) continue;
                Disc("lilypad", p, 0.32f * U, 0.3f * U, 0.01f * U, pad, root);
            }
            // cattails (primitive stems + brown heads; the Nature grass/fern cards lose their alpha on StToon)
            var stemM = StMat.Make("cattail_stem", null, new Color(0.42f, 0.62f, 0.3f), false); var headM = StMat.Make("cattail_head", null, new Color(0.45f, 0.3f, 0.18f), false);
            for (int i = 0; i < 14; i++)
            {
                float a = Mathf.PI * (0.45f + 1.1f * i / 13f) + (float)rng.NextDouble() * 0.15f, rr = 0.82f + 0.12f * (float)rng.NextDouble();
                var p = c + new Vector3(Mathf.Cos(a) * s.rx * rr, 0, Mathf.Sin(a) * s.rz * rr); float h = (0.9f + 0.6f * (float)rng.NextDouble()) * U;
                var st = GameObject.CreatePrimitive(PrimitiveType.Cylinder); Object.Destroy(st.GetComponent<Collider>()); st.transform.SetParent(root, false);
                st.transform.position = p + Vector3.up * h * 0.5f; st.transform.localScale = new Vector3(0.05f * U, h * 0.5f, 0.05f * U); st.transform.rotation = Quaternion.Euler((float)rng.NextDouble() * 14 - 7, 0, (float)rng.NextDouble() * 14 - 7);
                st.GetComponent<Renderer>().sharedMaterial = stemM;
                if (i % 2 == 0) { var hd = GameObject.CreatePrimitive(PrimitiveType.Capsule); Object.Destroy(hd.GetComponent<Collider>()); hd.transform.SetParent(root, false); hd.transform.position = st.transform.position + st.transform.up * h * 0.42f; hd.transform.rotation = st.transform.rotation; hd.transform.localScale = new Vector3(0.11f, 0.13f, 0.11f) * U; hd.GetComponent<Renderer>().sharedMaterial = headM; }
            }
            var plank = StMat.Make("jetty", null, new Color(0.6f, 0.43f, 0.28f), false);
            for (int i = 0; i < 5; i++)
            {
                var g = GameObject.CreatePrimitive(PrimitiveType.Cube); Object.Destroy(g.GetComponent<Collider>()); g.transform.SetParent(root, false);
                g.transform.position = s.stand + s.facing * (-0.4f + i * 0.42f) * U + Vector3.up * 0.1f * U; g.transform.localScale = new Vector3(0.36f, 0.12f, 1.9f) * U;
                g.transform.rotation = Quaternion.LookRotation(Vector3.Cross(Vector3.up, s.facing)); g.GetComponent<Renderer>().sharedMaterial = plank;
            }
        }

        /// <summary>Asset-free fish silhouette (used when the owned icon pack is missing).</summary>
        public static Texture2D FallbackFish(Color c)
        {
            const int N = 128; var t = new Texture2D(N, N, TextureFormat.RGBA32, false) { name = "fish_fallback" }; var px = new Color[N * N];
            for (int y = 0; y < N; y++) for (int x = 0; x < N; x++)
            {
                float u = x / (float)N * 2 - 1, v = y / (float)N * 2 - 1;
                float body = (u + 0.15f) * (u + 0.15f) / 0.42f + v * v / 0.12f, tail = (u > 0.45f && Mathf.Abs(v) < (u - 0.45f) * 1.1f && u < 0.95f) ? 0 : 2;
                bool inside = body < 1 || tail < 1; bool eye = (u + 0.55f) * (u + 0.55f) + (v - 0.06f) * (v - 0.06f) < 0.004f;
                var col = eye ? Color.black : Color.Lerp(c, c * 0.55f, Mathf.Clamp01(-v * 2 + 0.3f)); col.a = inside ? 1 : 0; px[y * N + x] = col;
            }
            t.SetPixels(px); t.Apply(); return t;
        }
    }

    /// <summary>Expanding ripple rings (unscaled time, so they also animate in frozen proof runs).</summary>
    public class StFishRipples : MonoBehaviour
    {
        public float radius = 1.2f; public Color col = Color.white; public float speed = 0.6f; public int rings = 3; public float phase;
        public float forceT = -1; // stills: fixed time
        Transform fx;
        void Start() { fx = new GameObject("rings").transform; fx.SetParent(transform, false); }
        void Update() { Draw(forceT >= 0 ? forceT : Time.unscaledTime); }
        public void Draw(float time)
        {
            if (fx == null) { fx = new GameObject("rings").transform; fx.SetParent(transform, false); }
            StFx.Clear(fx);
            for (int i = 0; i < rings; i++)
            {
                float u = Mathf.Repeat(time * speed + i / (float)rings + phase, 1f); float r = Mathf.Lerp(0.15f, 1f, u) * radius, w = Mathf.Lerp(0.12f, 0.04f, u) * radius;
                var c = col; c.a *= (1 - u) * Mathf.Clamp01(u * 6);
                var g = StFx.Obj("ring", StFx.Sector(Mathf.Max(0, r - w), r, 0, 360, c, c), false, fx); g.transform.localPosition = Vector3.zero;
                g.transform.localScale = new Vector3(1, 1, 0.8f);
            }
        }
    }
}
