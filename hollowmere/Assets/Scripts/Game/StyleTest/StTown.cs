using System.Collections.Generic;
using UnityEngine;

namespace Hollowmere.StyleTest
{
    /// <summary>Town hub (Phase 1). Buildings: KayKit Medieval Hexagon (scaled up, CC0). Market, smithy, dressing,
    /// trees: algumacoisaqq Medieval Village Kit (CC0, materials rebuilt with vertex colour). Animals: Quaternius
    /// (CC0). Villagers: Quaternius UBC + Outfits + UAL (CC0). Owned itch 2D art (gitignored) shows on signs,
    /// banners and the notice board when present locally; the public build simply skips it.</summary>
    public static class StTown
    {
        public const float HexScale = 7.5f * StScale.HexKit; // design units; doors reach the 2.2 m standard after the DU shrink
        public static readonly List<Transform> Built = new List<Transform>();
        public static readonly List<StActor> Folk = new List<StActor>();
        public static readonly List<StSmoke> Smokes = new List<StSmoke>();
        public static readonly Dictionary<string, Vector3> Spots = new Dictionary<string, Vector3>();
        public static Vector3 HeroSpawn = new Vector3(0, 0, -9) * StScale.DU;

        // ---------- placement helpers ----------
        public static GameObject VK(string piece, Vector3 pos, float yaw, float scale = 1f)
        {
            var g = StKit.Spawn("Town/VK/SM_VK_" + piece, Vector3.zero, yaw);
            // VK is authored in real metres; layouts are in design units and shrunk by StScale.DU after the build,
            // so pieces spawn at 1/DU to end up at exactly 1 m = 1 u. Pinned pieces (stalls, fountain, lamps) are fitted to the standard.
            g.transform.localScale = Vector3.one * (1f / StScale.DU) * scale;
            if (StScale.KitHeight(piece, out var kh)) StScale.NormalizeHeight(g, StScale.Cat.Prop, kh / StScale.DU * scale);
            StMat.ApplyVK(g);
            Ground(g, pos); Built.Add(g.transform); return g;
        }

        public static GameObject Hex(string piece, Vector3 pos, float yaw, float scale = 1f)
        {
            var g = StKit.Spawn("Town/Hex/" + piece, Vector3.zero, yaw);
            g.transform.localScale = Vector3.one * HexScale * scale;
            StMat.ApplyGeneric(g, 0.62f);
            Ground(g, pos); Built.Add(g.transform); return g;
        }

        /// <summary>Put the model's footprint centre at pos with its base on y = pos.y.</summary>
        static void Ground(GameObject g, Vector3 pos)
        {
            var b = StWorld.Bounds(g);
            g.transform.position += new Vector3(pos.x - b.center.x, pos.y - b.min.y, pos.z - b.center.z);
        }

        static GameObject Plane(string name, Vector3 c, Vector2 size, Material m, float yaw = 0, float y = 0)
        {
            var g = GameObject.CreatePrimitive(PrimitiveType.Quad); g.name = name; Object.Destroy(g.GetComponent<Collider>());
            g.transform.position = new Vector3(c.x, y, c.z); g.transform.rotation = Quaternion.Euler(90, yaw, 0);
            g.transform.localScale = new Vector3(size.x, size.y, 1);
            var r = g.GetComponent<MeshRenderer>(); r.sharedMaterial = m; r.receiveShadows = true; r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            Built.Add(g.transform); return g;
        }

        static GameObject Disc(string name, Vector3 c, float radius, Material m, float y)
        {
            var g = GameObject.CreatePrimitive(PrimitiveType.Cylinder); g.name = name; Object.Destroy(g.GetComponent<Collider>());
            g.transform.position = new Vector3(c.x, y - 0.05f, c.z); g.transform.localScale = new Vector3(radius * 2, 0.05f, radius * 2);
            var r = g.GetComponent<MeshRenderer>(); r.sharedMaterial = m; r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            Built.Add(g.transform); return g;
        }

        /// <summary>A flat 2D picture (owned itch art) on a board; returns null if the art is not present locally.</summary>
        public static GameObject Picture(string res, Vector3 pos, float yaw, float height, bool frame = true)
        {
            var tex = Resources.Load<Texture2D>(res);
            if (tex == null) return null;
            var g = GameObject.CreatePrimitive(PrimitiveType.Quad); g.name = "pic_" + tex.name; Object.Destroy(g.GetComponent<Collider>());
            float w = height * tex.width / (float)tex.height;
            g.transform.position = pos; g.transform.rotation = Quaternion.Euler(0, yaw, 0); g.transform.localScale = new Vector3(w, height, 1);
            g.GetComponent<MeshRenderer>().sharedMaterial = StMat.Picture(tex, !frame);
            if (frame)
            {
                var f = GameObject.CreatePrimitive(PrimitiveType.Cube); f.name = "frame"; Object.Destroy(f.GetComponent<Collider>());
                f.transform.SetParent(g.transform, false); f.transform.localPosition = new Vector3(0, 0, 0.06f); f.transform.localScale = new Vector3(1.08f, 1.08f, 0.08f);
                f.GetComponent<MeshRenderer>().sharedMaterial = StMat.Make("frame_wood", null, new Color(0.36f, 0.23f, 0.13f), false);
            }
            Built.Add(g.transform); return g;
        }

        static string FirstIn(string folder, int idx = 0)
        {
            var all = Resources.LoadAll<Texture2D>(folder);
            if (all == null || all.Length == 0) return null;
            System.Array.Sort(all, (a, b) => string.CompareOrdinal(a.name, b.name));
            return folder + "/" + all[Mathf.Clamp(idx, 0, all.Length - 1)].name;
        }

        /// <summary>Shop sign: VK hanging sign + an owned itch icon on a round plaque (if available).</summary>
        static void ShopSign(Vector3 pos, float yaw, string iconFolder, int idx)
        {
            var post = VK("Prop_Signpost", pos, yaw, 0.8f);
            var res = FirstIn(iconFolder, idx);
            if (res == null) return;
            var top = StWorld.Bounds(post).max.y;
            var plaque = GameObject.CreatePrimitive(PrimitiveType.Cylinder); Object.Destroy(plaque.GetComponent<Collider>());
            plaque.transform.position = pos + Vector3.up * (top + 1.1f); plaque.transform.rotation = Quaternion.Euler(90, yaw, 0); plaque.transform.localScale = new Vector3(1.9f, 0.06f, 1.9f);
            plaque.GetComponent<MeshRenderer>().sharedMaterial = StMat.Make("plaque", null, new Color(0.30f, 0.20f, 0.12f), false);
            Built.Add(plaque.transform);
            var front = Quaternion.Euler(0, yaw, 0) * Vector3.back;
            Picture(res, plaque.transform.position + front * 0.08f, yaw, 1.5f, false);
            var back = Picture(res, plaque.transform.position - front * 0.08f, yaw + 180, 1.5f, false);
        }

        // ---------- the hub ----------
        public static void Build()
        {
            Built.Clear(); Folk.Clear(); Smokes.Clear(); Spots.Clear();
            var scaleSnap = StScale.Snapshot();
            // ground: grass field, cobbled plaza, dirt roads
            Plane("grass", Vector3.zero, new Vector2(260, 260), StMat.Tiled("ST/Town/VK/Tex/T_VK_Grass_BC", new Color(0.78f, 0.84f, 0.70f), 34), 0, 0f);
            Disc("plaza", Vector3.zero, 12.5f, StMat.Tiled("ST/Town/VK/Tex/T_VK_Cobble_BC", new Color(0.86f, 0.84f, 0.80f), 14), 0.03f);
            Plane("road_n", new Vector3(0, 0, 24), new Vector2(6, 26), StMat.Tiled("ST/Town/VK/Tex/T_VK_Dirt_BC", Color.white, 4), 0, 0.02f);
            Plane("road_w", new Vector3(-24, 0, 0), new Vector2(26, 5.5f), StMat.Tiled("ST/Town/VK/Tex/T_VK_Dirt_BC", Color.white, 4), 0, 0.02f);
            Plane("road_e", new Vector3(24, 0, 0), new Vector2(26, 5.5f), StMat.Tiled("ST/Town/VK/Tex/T_VK_Dirt_BC", Color.white, 4), 0, 0.02f);
            Plane("road_s", new Vector3(0, 0, -22), new Vector2(6, 22), StMat.Tiled("ST/Town/VK/Tex/T_VK_Dirt_BC", Color.white, 4), 0, 0.02f);

            // centre: fountain + market cross + benches + lamp ring + bunting
            VK("Prop_Fountain", Vector3.zero, 0);
            for (int i = 0; i < 8; i++)
            {
                float a = (i * 45f + 22.5f) * Mathf.Deg2Rad; var p = new Vector3(Mathf.Sin(a), 0, Mathf.Cos(a)) * 11.6f;
                if (i == 3 || i == 4) continue; // keep the south entrance open for the camera
                Lamp(p, i * 45f + 22.5f + 180);
            }
            VK("Prop_Bench", new Vector3(-5.5f, 0, -3.5f), 120); VK("Prop_Bench", new Vector3(5.5f, 0, -3.5f), -120);
            VK("Prop_Planter", new Vector3(-3.8f, 0, 4.6f), 0); VK("Prop_Planter", new Vector3(3.8f, 0, 4.6f), 0);
            VK("Prop_FlowerBox", new Vector3(-7.4f, 0, 2.4f), 70); VK("Prop_FlowerBox", new Vector3(7.4f, 0, 2.4f), -70);

            Debug.Log("[ST] town step: north: the dungeo");
            // north: the dungeon gate (KayKit dungeon arch + rune glow) at the end of the north road
            Gate(new Vector3(0, 0, 36));
            VK("Prop_NoticeBoard", new Vector3(5.5f, 0, 11.5f), 200);
            var poster = FirstIn("STO/BG", 6) ?? FirstIn("STO/BG", 0);
            if (poster != null) Picture(poster, new Vector3(5.5f, 0, 11.5f) + new Vector3(-0.2f, 2.6f, -0.55f), 200, 1.55f);
            VK("Prop_CrierStand", new Vector3(-6.0f, 0, 12.0f), 160);
            Spots["gate"] = new Vector3(0, 0, 29);

            Debug.Log("[ST] town step: west: blacksmith");
            // west: blacksmith (hex smithy + VK forge yard)
            Hex("building_blacksmith_blue", new Vector3(-27, 0, 9), 90);
            VK("Prop_Forge", new Vector3(-18.5f, 0, 11.2f), 180);
            VK("Prop_Anvil", new Vector3(-16.4f, 0, 8.4f), 70);
            VK("Prop_QuenchTub", new Vector3(-14.8f, 0, 10.6f), 0);
            VK("Prop_Bellows", new Vector3(-20.6f, 0, 11.0f), 180);
            VK("Prop_WeaponRack", new Vector3(-13.6f, 0, 5.2f), 200);
            VK("Prop_ArmorStand", new Vector3(-16.2f, 0, 4.6f), 160);
            VK("Prop_Grindstone", new Vector3(-12.8f, 0, 8.0f), 90);
            VK("Prop_Woodpile", new Vector3(-24.5f, 0, 15.5f), 0);
            ShopSign(new Vector3(-12.5f, 0, 3.0f), 210, "STO/Icons", 0);
            Smokes.Add(StSmoke.At(new Vector3(-18.5f, 4.6f, 11.4f), new Color(0.45f, 0.43f, 0.42f), 1.3f));
            Spots["blacksmith"] = new Vector3(-14.5f, 0, 6.5f);

            Debug.Log("[ST] town step: north-west: taver");
            // north-west: tavern; north-east: church; homes on the corners
            SmokeOn(Hex("building_tavern_blue", new Vector3(-21, 0, 24), 140), 1f);
            VK("Prop_AleCask", new Vector3(-15.5f, 0, 19.5f), 30); VK("Prop_BarrelStack", new Vector3(-13.8f, 0, 21.5f), 60);
            VK("Prop_TavernSign", new Vector3(-14.2f, 0, 17.6f), 140);
            Hex("building_church_blue", new Vector3(21, 0, 25), 210);
            VK("Grave_Cross", new Vector3(28, 0, 19), 20); VK("Grave_A", new Vector3(30, 0, 22), -10); VK("Grave_Obelisk", new Vector3(26.5f, 0, 16.5f), 5);
            SmokeOn(Hex("building_home_A_blue", new Vector3(-32, 0, -12), 60), 0.8f); // spaced for the HexKit fit
            SmokeOn(Hex("building_home_B_blue", new Vector3(-17, 0, -25), 20), 0.8f);
            Hex("building_home_A_blue", new Vector3(35, 0, -10), -60, 1.05f);
            Hex("building_windmill_blue", new Vector3(36, 0, 38), 200, 1.2f);
            VK("Prop_Laundry", new Vector3(-24.5f, 0, -16.5f), 30);
            VK("Prop_Well", new Vector3(-11.5f, 0, -12.5f), 30);

            Debug.Log("[ST] town step: east: market");
            // east: market (VK stalls in an arc) with owned itch icons on the shop signs
            string[] stalls = { "MarketStall_Jeweller", "MarketStall_Armourer", "MarketStall_Apothecary", "MarketStall_Baker", "MarketStall_Greengrocer" };
            string[] icons = { "STO/Gems", "STO/Icons", "STO/Potions", null, null };
            for (int i = 0; i < stalls.Length; i++)
            {
                float a = Mathf.Lerp(40, 140, i / (float)(stalls.Length - 1)) * Mathf.Deg2Rad;
                var p = new Vector3(Mathf.Sin(a), 0, Mathf.Cos(a)) * 17.5f;
                float yaw = Mathf.Atan2(-p.x, -p.z) * Mathf.Rad2Deg; // stall front faces the plaza
                VK(stalls[i], p, yaw);
                if (icons[i] != null) ShopSign(p * 0.84f + Quaternion.Euler(0, yaw, 0) * new Vector3(2.9f, 0, 0), yaw + 180, icons[i], i == 0 ? 20 : 2);
            }
            VK("Prop_Cart", new Vector3(23, 0, -6.5f), 70); VK("Prop_Crates", new Vector3(21, 0, 8.5f), 20); VK("Prop_Sacks", new Vector3(22.5f, 0, 10.5f), 0);
            Spots["market"] = new Vector3(11, 0, 0);

            Debug.Log("[ST] town step: banners on poles");
            // banners on poles around the plaza (VK pole + owned Wenrexa kingdom banners when present)
            Banner(new Vector3(-9.5f, 0, 9.0f), 140, 0); Banner(new Vector3(9.5f, 0, 9.0f), 220, 3);
            Banner(new Vector3(-3.2f, 0, 30.5f), 180, 6); Banner(new Vector3(3.2f, 0, 30.5f), 180, 9);

            Debug.Log("[ST] town step: south-east: anima");
            // south-east: animal pen + chickens
            var penC = new Vector3(24, 0, -26);
            for (int i = 0; i < 4; i++) { VK("Prop_Fence", penC + new Vector3(-4.7f + i * 3.15f, 0, -5.2f), 0); VK(i == 1 ? "Prop_FenceGate" : "Prop_Fence", penC + new Vector3(-4.7f + i * 3.15f, 0, 5.2f), 0); }
            for (int i = 0; i < 3; i++) { VK("Prop_Fence", penC + new Vector3(-6.3f, 0, -3.4f + i * 3.15f), 90); VK("Prop_Fence", penC + new Vector3(6.3f, 0, -3.4f + i * 3.15f), 90); }
            VK("Prop_Trough", penC + new Vector3(-3.6f, 0, 3.6f), 0); VK("Prop_HayBale", penC + new Vector3(4.2f, 0, 3.4f), 30);
            VK("Prop_ChickenCoop", new Vector3(13.5f, 0, -27.5f), -20); VK("Prop_Chickens", new Vector3(15.0f, 0, -23.0f), 30);
            Animal("Sheep", penC + new Vector3(-2, 0, -1), 40, 1.65f, null); Animal("Sheep", penC + new Vector3(1.5f, 0, 1.6f), 200, 1.6f, null); // heights in DU: sheep ~1.0 m
            Animal("Sheep", penC + new Vector3(3, 0, -2.6f), 110, 1.55f, null); Animal("Pig", penC + new Vector3(-1, 0, 2.8f), -70, 1.4f, null);
            Animal("Cow", new Vector3(31, 0, -36), 200, 2.9f, new[] { new Vector3(31, 0, -36), new Vector3(36, 0, -31) });
            Animal("Horse", new Vector3(-8.5f, 0, -16.5f), 90, 3.4f, null);
            VK("Prop_HitchRail", new Vector3(-8.5f, 0, -18.6f), 0);
            Animal("Pug", new Vector3(3.5f, 0, -6.5f), 220, 0.7f, new[] { new Vector3(3.5f, 0, -6.5f), new Vector3(-2.5f, 0, -7.5f), new Vector3(-4f, 0, -2f), new Vector3(2f, 0, -3f) });

            Debug.Log("[ST] town step: trees, bushes");
            // trees, bushes and rocks frame the hub
            var rng = new System.Random(11);
            string[] trees = { "Tree_Oak_A", "Tree_Oak_B", "Tree_Birch", "Tree_Pine_A", "Tree_Apple", "Tree_Blossom" };
            for (int i = 0; i < 26; i++)
            {
                float a = (i / 26f) * Mathf.PI * 2 + (float)rng.NextDouble() * 0.1f; float r = 44 + (float)rng.NextDouble() * 10;
                var p = new Vector3(Mathf.Sin(a) * r, 0, Mathf.Cos(a) * r * 0.9f);
                if (Mathf.Abs(p.x) < 5 && p.z > 0) continue;
                VK(trees[rng.Next(trees.Length)], p, rng.Next(360), 0.8f + (float)rng.NextDouble() * 0.4f);
            }
            // outer ring of pines closes the horizon (KayKit hex mountains were tried and rejected: garish yellow/red tile tops at this scale)
            for (int i = 0; i < 40; i++)
            {
                float a = i / 40f * Mathf.PI * 2; float rr = 60 + (i % 3) * 5;
                VK(i % 4 == 0 ? "Tree_Oak_B" : "Tree_Pine_A", new Vector3(Mathf.Sin(a) * rr, 0, Mathf.Cos(a) * rr * 0.92f), i * 37, 1.0f + (i % 5) * 0.12f);
            }
            VK("Tree_Apple", new Vector3(-9, 0, -24), 30); VK("Tree_Blossom", new Vector3(10, 0, 28), 60); VK("Tree_Willow", new Vector3(-36, 0, 2), 0);
            VK("Tree_Oak_A", new Vector3(36, 0, 6), 50, 0.9f); VK("Tree_Birch", new Vector3(-33, 0, 26), 0, 0.9f);
            string[] small = { "Bush_Round", "Bush_Berry", "Bush_Hydrangea", "Plant_Wildflowers", "Plant_TallGrass", "Rock_Cluster", "Plant_Fern" };
            for (int i = 0; i < 46; i++)
            {
                var p = new Vector3((float)rng.NextDouble() * 76 - 38, 0, (float)rng.NextDouble() * 76 - 38);
                if (p.magnitude < 14 || Mathf.Abs(p.x) < 4 || Mathf.Abs(p.z) < 3.5f) continue;
                if (Physics.CheckSphere(p, 0.1f)) continue;
                VK(small[rng.Next(small.Length)], p, rng.Next(360), 0.8f + (float)rng.NextDouble() * 0.5f);
            }

            Debug.Log("[ST] town step: villagers with si");
            // villagers with simple routines
            var V = StFolk.Villagers;
            AddFolk(V[0], new Vector3(-15.0f, 0, 9.6f), 120, null, "Interact", 0);                     // smith at the anvil
            AddFolk(V[2], new Vector3(13.6f, 0, 7.6f), 230, null, "Idle_Talking_Loop", 0);                   // jeweller
            AddFolk(V[3], new Vector3(16.6f, 0, -1.2f), 270, null, "Idle_Loop", 0);                         // apothecary
            AddFolk(V[1], new Vector3(-8.5f, 0, -8), 0, new[] { new Vector3(-8.5f, 0, -8), new Vector3(-8.5f, 0, 6), new Vector3(6, 0, 8), new Vector3(7.5f, 0, -4) }, "Idle_Talking_Loop", 2.2f);
            AddFolk(V[2], new Vector3(2, 0, 14), 180, new[] { new Vector3(2, 0, 14), new Vector3(2, 0, 28), new Vector3(-2, 0, 20) }, "Idle_Loop", 3f);
            AddFolk(V[0], new Vector3(-12.5f, 0, 19), 140, null, "Idle_Talking_Loop", 0);               // at the tavern (standing: no seat there)
            AddFolk(V[3], new Vector3(16.5f, 0, -19.5f), 180, new[] { new Vector3(16.5f, 0, -19.5f), new Vector3(16.5f, 0, -31.0f) }, "Interact", 2.5f);
            Spots["plaza"] = new Vector3(0, 0, -5.5f);
            Spots["pen"] = new Vector3(17f, 0, -21f);
            // design units -> metres (1 u = 1 m): shrink everything built above, convert the public anchors
            StScale.ShrinkSince(scaleSnap);
            foreach (var k in new List<string>(Spots.Keys)) Spots[k] *= StScale.DU;
            HeroSpawn = new Vector3(0, 0, -9) * StScale.DU;
        }

        /// <summary>Chimney smoke from the highest point of a building (KayKit hex chimneys sit at the roof top).</summary>
        static void SmokeOn(GameObject g, float size)
        {
            Vector3 top = Vector3.zero; float best = -1;
            foreach (var mf in g.GetComponentsInChildren<MeshFilter>())
            {
                var m = mf.sharedMesh; if (m == null || !m.isReadable) continue;
                foreach (var v in m.vertices) { var w = mf.transform.TransformPoint(v); if (w.y > best) { best = w.y; top = w; } }
            }
            if (best < 0) { var b = StWorld.Bounds(g); top = new Vector3(b.center.x, b.max.y, b.center.z); }
            Smokes.Add(StSmoke.At(top, new Color(0.85f, 0.84f, 0.83f), size));
        }

        static void Lamp(Vector3 p, float yaw)
        {
            var g = VK("Prop_LampPost", p, yaw);
            var b = StWorld.Bounds(g);
            var l = new GameObject("lamp_light").AddComponent<Light>();
            l.type = LightType.Point; l.color = new Color(1f, 0.70f, 0.38f); l.intensity = 4.5f; l.range = 9f; l.shadows = LightShadows.None;
            l.transform.position = new Vector3(b.center.x, b.max.y - 0.5f, b.center.z) + (Quaternion.Euler(0, yaw, 0) * Vector3.forward) * 0.35f;
            l.gameObject.AddComponent<StFlicker>();
            var q = GameObject.CreatePrimitive(PrimitiveType.Quad); Object.Destroy(q.GetComponent<Collider>());
            q.transform.position = l.transform.position; q.transform.localScale = Vector3.one * 1.1f;
            q.GetComponent<MeshRenderer>().sharedMaterial = StGlow.Mat(new Color(1.6f, 0.95f, 0.4f), 2); q.AddComponent<StBillboard>();
            Built.Add(l.transform);
        }

        static void Banner(Vector3 p, float yaw, int idx)
        {
            var pole = VK("Banner_Pole", p, yaw, 0.7f);
            var res = FirstIn("STO/Banners", idx);
            if (res == null) return;
            var b = StWorld.Bounds(pole);
            var fwd = Quaternion.Euler(0, yaw, 0) * Vector3.back;
            Picture(res, new Vector3(b.center.x, b.max.y - 2.4f, b.center.z) + fwd * 0.45f, yaw, 3.2f, false);
        }

        static void Gate(Vector3 p)
        {
            const float k = StScale.DungeonKit; // the gate is KayKit dungeon kit: fit to the 2.2 m door standard
            var arch = StKit.Spawn("Dungeon/wall_doorway", Vector3.zero, 0); arch.transform.localScale *= k;
            var b = StWorld.Bounds(arch); arch.transform.position += new Vector3(p.x - b.center.x, -b.min.y, p.z - b.center.z);
            Built.Add(arch.transform);
            for (int s = -1; s <= 1; s += 2)
            {
                var w = StKit.Spawn("Dungeon/wall", Vector3.zero, 0); w.transform.localScale *= k; var wb = StWorld.Bounds(w);
                w.transform.position += new Vector3(p.x + s * 4f * k - wb.center.x, -wb.min.y, p.z - wb.center.z); Built.Add(w.transform);
                var t = StKit.Spawn("Dungeon/torch_mounted", Vector3.zero, 180); t.transform.localScale *= k; var tb = StWorld.Bounds(t);
                t.transform.position += new Vector3(p.x + s * 2.4f * k - tb.center.x, 2.4f * k - tb.center.y, p.z - 0.6f - tb.center.z);
                var l = new GameObject("gate_torch").AddComponent<Light>(); l.type = LightType.Point; l.color = new Color(1f, 0.55f, 0.25f); l.intensity = 6; l.range = 9;
                l.transform.position = new Vector3(p.x + s * 2.4f * k, 2.9f * k, p.z - 1.0f); l.gameObject.AddComponent<StFlicker>();
            }
            // portal veil: overlay glow inside the arch (shaped, not a plain circle: a tall rune oval)
            var veil = GameObject.CreatePrimitive(PrimitiveType.Quad); Object.Destroy(veil.GetComponent<Collider>());
            veil.transform.position = p + new Vector3(0, 1.9f * k, -0.1f); veil.transform.localScale = new Vector3(2.6f, 3.6f, 1) * k;
            veil.GetComponent<MeshRenderer>().sharedMaterial = StGlow.Mat(new Color(0.45f, 0.35f, 1.6f), 2);
            Built.Add(veil.transform);
            var sign = FirstIn("STO/BG", 3);
        }

        static void Animal(string kind, Vector3 p, float yaw, float height, Vector3[] path)
        {
            var g = StKit.Spawn("Town/Animals/" + kind, Vector3.zero, yaw);
            var b = StWorld.Bounds(g);
            if (b.size.y > 0.01f) g.transform.localScale *= height / b.size.y;
            StMat.ApplyGeneric(g, 0.6f);
            Ground(g, p);
            var an = g.GetComponent<Animation>();
            if (an != null)
            {
                foreach (AnimationState st in an) st.wrapMode = WrapMode.Loop;
                string idle = null; foreach (AnimationState st in an) if (st.name.EndsWith("Idle")) { idle = st.name; break; }
                if (idle != null) { an[idle].time = Random.value * 3f; an.Play(idle); }
                if (path != null)
                {
                    string walk = null; foreach (AnimationState st in an) if (st.name.EndsWith("WalkSlow") || st.name.EndsWith("Walk")) { walk = st.name; break; }
                    var w = g.AddComponent<StWander>(); w.points = path; w.rawAnim = an; w.walk = walk ?? idle; w.idle = idle; w.speed = kind == "Pug" ? 3f : 1.2f; w.pause = 3f;
                }
            }
            Built.Add(g.transform);
        }

        static void AddFolk(StFolk.Recipe r, Vector3 p, float yaw, Vector3[] path, string idle, float pause)
        {
            var a = StFolk.Make(r, p, yaw); if (a == null) return;
            a.Loop(idle);
            if (path != null) { var w = a.gameObject.AddComponent<StWander>(); w.points = path; w.actor = a; w.walk = "Walk_Loop"; w.idle = idle; w.pause = pause; w.speed = 2.6f; }
            a.idle = idle;
            Folk.Add(a);
        }

        public static void Lighting()
        {
            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = new Color(0.52f, 0.56f, 0.70f);
            RenderSettings.ambientEquatorColor = new Color(0.50f, 0.44f, 0.40f);
            RenderSettings.ambientGroundColor = new Color(0.28f, 0.25f, 0.20f);
            RenderSettings.fog = true; RenderSettings.fogMode = FogMode.Linear;
            RenderSettings.fogColor = new Color(0.62f, 0.66f, 0.74f); RenderSettings.fogStartDistance = 45; RenderSettings.fogEndDistance = 110;
            var sun = new GameObject("sun").AddComponent<Light>();
            sun.type = LightType.Directional; sun.color = new Color(1f, 0.86f, 0.66f); sun.intensity = 1.25f;
            sun.shadows = LightShadows.Soft; sun.shadowStrength = 0.7f;
            sun.transform.rotation = Quaternion.Euler(42, -35, 0);
        }
    }

    /// <summary>Chimney / forge smoke: a few soft alpha puffs rising, growing and fading (deterministic in time for stills).</summary>
    public class StSmoke : MonoBehaviour
    {
        public Color col; public float size = 1f; const int N = 9; readonly Transform[] puffs = new Transform[N]; Material[] mats;
        static Texture2D soft;
        public static StSmoke At(Vector3 p, Color c, float size)
        {
            var g = new GameObject("smoke"); g.transform.position = p;
            var s = g.AddComponent<StSmoke>(); s.col = c; s.size = size; s.Init(); return s;
        }
        static Texture2D Soft()
        {
            if (soft) return soft;
            soft = new Texture2D(64, 64, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp };
            for (int y = 0; y < 64; y++) for (int x = 0; x < 64; x++)
            {
                float dx = (x - 31.5f) / 31.5f, dy = (y - 31.5f) / 31.5f; float r = Mathf.Sqrt(dx * dx + dy * dy);
                float n = Mathf.PerlinNoise(x * 0.15f, y * 0.15f) * 0.35f + 0.65f;
                soft.SetPixel(x, y, new Color(1, 1, 1, Mathf.Clamp01(1 - r) * Mathf.Clamp01(1 - r) * n));
            }
            soft.Apply(); return soft;
        }
        void Init()
        {
            var sh = Resources.Load<Shader>("ST/StSmoke");
            mats = new Material[N];
            for (int i = 0; i < N; i++)
            {
                var q = GameObject.CreatePrimitive(PrimitiveType.Quad); Destroy(q.GetComponent<Collider>());
                q.transform.SetParent(transform, false); puffs[i] = q.transform;
                mats[i] = new Material(sh); mats[i].SetTexture("_MainTex", Soft()); q.GetComponent<MeshRenderer>().sharedMaterial = mats[i];
                q.GetComponent<MeshRenderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            }
            Sample(0);
        }
        public void Sample(float t)
        {
            var cam = Camera.main;
            for (int i = 0; i < N; i++)
            {
                float life = ((t * 0.22f) + i / (float)N) % 1f;
                var p = new Vector3(Mathf.Sin(i * 2.1f + t * 0.7f) * 0.35f * life + life * 1.6f, life * 5.5f, Mathf.Cos(i * 1.3f) * 0.25f * life) * size;
                puffs[i].localPosition = p;
                puffs[i].localScale = Vector3.one * size * (0.9f + life * 2.6f);
                if (cam) puffs[i].rotation = cam.transform.rotation * Quaternion.Euler(0, 0, i * 47f + t * 10f);
                var c = col; c.a = Mathf.Sin(life * Mathf.PI) * 0.55f; mats[i].SetColor("_Color", c);
            }
        }
        void LateUpdate() { Sample(Time.time); }
    }
}
