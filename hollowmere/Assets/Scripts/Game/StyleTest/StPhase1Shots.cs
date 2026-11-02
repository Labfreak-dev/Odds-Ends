using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace Hollowmere.StyleTest
{
    /// <summary>Phase 1 proof renders: tome/bow fix, kit style+scale board, new character/animal turnarounds and strips,
    /// owned itch 2D showcase + loading screen, and the town hub (overview + game camera + zoom, with a HUD mock).</summary>
    public static class StPhase1Shots
    {
        static StyleTestRunner R; static Camera C;

        public static IEnumerator Run(StyleTestRunner r, Camera cam, string only)
        {
            R = r; C = cam;
            bool all = only == "phase1";
            if (all || only == "tome") yield return Tome();
            if (all || only == "board") yield return Board();
            if (all || only == "folk") yield return Folk();
            if (all || only == "ui") yield return Ui();
            if (all || only == "monsters") yield return Monsters();
            if (all || only == "town") yield return Town();
        }

        static void Clear()
        {
            foreach (var go in Object.FindObjectsByType<GameObject>(FindObjectsSortMode.None))
                if (go.transform.parent == null && go != R.gameObject && go != C.gameObject && go.name != "Hollowmere") Object.Destroy(go);
            StWorld.Built.Clear();
            C.orthographic = false; C.fieldOfView = 35; C.farClipPlane = 220;
            foreach (Transform t in C.transform) Object.Destroy(t.gameObject);
        }

        static void Neutral() { StWorld.NeutralLighting(); C.backgroundColor = new Color(0.56f, 0.57f, 0.59f); }

        // ---------- bow / tome ----------
        static IEnumerator Tome()
        {
            Clear(); yield return null; Neutral(); C.orthographic = true;
            var def = WeaponDef.Get("Weapons/spellbook_open", Socket.HandL);
            var cands = new List<Vector3>();
            var env = System.Environment.GetEnvironmentVariable("HM_TOMECANDS");
            if (!string.IsNullOrEmpty(env)) foreach (var c in env.Split(';')) { var q = c.Split(','); cands.Add(new Vector3(float.Parse(q[0]), float.Parse(q[1]), float.Parse(q[2]))); }
            else cands.Add(def.holdRot);
            foreach (var v in cands)
            {
                def.holdRot = v;
                var l = StLook.Mage().Loadout(1);
                var a = l.Build(Vector3.zero, 180);
                float lo = 99f; foreach (var clip in new[] { a.idle, a.run, a.attack }) for (int f = 0; f < 16; f++) { a.Pose(clip, f / 16f); if (a.weaponL) foreach (var rr in a.weaponL.GetComponentsInChildren<Renderer>()) lo = Mathf.Min(lo, rr.bounds.min.y); }
                Debug.Log("[ST] TOME " + v + " minY=" + lo.ToString("F3"));
                var tag = ((int)v.x) + "_" + ((int)v.y) + "_" + ((int)v.z);
                yield return R.TurnPub(a, "fix/tome_" + tag, a.idle, 0.3f);
                yield return R.TurnPub(a, "fix/tome_" + tag + "_cast", a.attack, 0.5f);
                // game-camera look (pitch 52, close) at idle and casting
                C.orthographic = false; C.fieldOfView = 35;
                foreach (var ph in new[] { 0, 1 })
                {
                    a.transform.rotation = Quaternion.Euler(0, 160, 0); a.Pose(ph == 0 ? a.idle : a.attack, ph == 0 ? 0.3f : 0.5f);
                    C.transform.position = new Vector3(0, 1.5f, 0) + Quaternion.Euler(52, 0, 0) * new Vector3(0, 0, -9); C.transform.rotation = Quaternion.Euler(52, 0, 0);
                    R.SavePub(R.RenderPub(C, 1200, 900), "fix/tome_" + tag + (ph == 0 ? "_gamecam.png" : "_gamecam_cast.png"));
                }
                C.orthographic = true;
                Object.Destroy(a.gameObject); yield return null;
            }
            var rg = StLook.Ranger().Build(Vector3.zero, 180);
            yield return R.TurnPub(rg, "fix/bow_ranger_idle", rg.idle, 0.3f);
            yield return R.TurnPub(rg, "fix/bow_ranger_run", rg.run, 0.25f);
            yield return R.TurnPub(rg, "fix/bow_ranger_release", rg.attack, 0.3f);
            Object.Destroy(rg.gameObject); yield return null;
        }

        // ---------- style + scale board ----------
        static IEnumerator Board()
        {
            Clear(); yield return null; Neutral();
            var items = new List<GameObject>();
            void Add(GameObject g) { if (g) items.Add(g); }
            foreach (var l in StLook.Base) { var a = l.Build(Vector3.zero, 180); a.Pose(a.idle, 0.3f); Add(a.gameObject); }
            foreach (var v in new[] { StFolk.Villagers[0], StFolk.Villagers[2] }) { var a = StFolk.Make(v, Vector3.zero, 180); if (a) { a.Pose("Idle_Loop", 0.3f); Add(a.gameObject); } }
            var q = StFolk.Make(StFolk.QRanger, Vector3.zero, 180);
            if (q) { q.SetWeapons(null, "Weapons/bow_withString"); q.Pose("Idle_Loop", 0.3f); Add(q.gameObject); }
            var sk = R.SkeletonPub(Vector3.zero); sk.transform.rotation = Quaternion.Euler(0, 180, 0); sk.Pose(sk.idle, 0.3f); Add(sk.gameObject);
            foreach (var an in new[] { "Sheep", "Pig", "Pug" }) Add(AnimalActor(an, an == "Pug" ? 0.9f : an == "Pig" ? 1.5f : 1.9f, 200).gameObject);
            Add(StTown.VK("Prop_LampPost", Vector3.zero, 180));
            Add(StTown.VK("MarketStall_Jeweller", Vector3.zero, 180));
            Add(StTown.Hex("building_home_A_blue", Vector3.zero, 180));
            Add(StTown.VK("Prop_Well", Vector3.zero, 180));
            Add(StTown.VK("Tree_Apple", Vector3.zero, 0));
            var door = StKit.Spawn("Dungeon/wall_doorway", Vector3.zero, 0); Add(door);
            // lay out left to right on a floor
            float x = 0; float gap = 0.8f; float maxH = 0;
            foreach (var g in items)
            {
                var b = StWorld.Bounds(g);
                g.transform.position += new Vector3(x - b.min.x, -b.min.y, -b.center.z);
                x += b.size.x + gap; maxH = Mathf.Max(maxH, b.size.y);
            }
            var floor = GameObject.CreatePrimitive(PrimitiveType.Cube); floor.transform.position = new Vector3(x / 2, -0.05f, 0); floor.transform.localScale = new Vector3(x + 4, 0.1f, 14);
            floor.GetComponent<MeshRenderer>().sharedMaterial = StMat.Tiled("ST/Town/VK/Tex/T_VK_Cobble_BC", Color.white, 1);
            // scale lines: hero height 3.0 and door 3.4 (1.6 x 2.1 m)
            Line(new Vector3(x / 2, 3.0f, -2.2f), x + 2, new Color(0.9f, 0.2f, 0.2f));
            Line(new Vector3(x / 2, 1.8f * StMat.MetreScale, -2.2f), x + 2, new Color(0.2f, 0.45f, 0.95f));
            yield return null;
            C.orthographic = true; C.orthographicSize = Mathf.Max(maxH * 0.6f, x * 1080f / 4200f / 2f * 1.0f);
            C.transform.position = new Vector3(x / 2, C.orthographicSize * 0.92f - 0.3f, -40); C.transform.rotation = Quaternion.identity;
            R.SavePub(R.RenderPub(C, 4200, 1080), "board/style_board_front.png");
            // close-up of the characters/creatures (first 10 entries) with the scale lines
            { var cb = StWorld.Bounds(items[0]); for (int i = 1; i < 10 && i < items.Count; i++) cb.Encapsulate(StWorld.Bounds(items[i]));
              C.orthographicSize = Mathf.Max(cb.size.y * 0.62f, cb.size.x * 1080f / 3600f * 0.55f); C.transform.position = new Vector3(cb.center.x, C.orthographicSize * 0.9f - 0.2f, -40);
              R.SavePub(R.RenderPub(C, 3600, 1080), "board/style_board_characters.png"); }
            C.orthographic = false; C.fieldOfView = 35;
            C.transform.position = new Vector3(x / 2, 0, 0) + Quaternion.Euler(30, 0, 0) * new Vector3(0, 0, -x * 1.05f); C.transform.rotation = Quaternion.Euler(30, 0, 0);
            R.SavePub(R.RenderPub(C, 4200, 1600), "board/style_board_perspective.png");
            // game-camera crops: heroes + folk next to a stall/lamp
            var mid = items[4].transform.position;
            C.transform.position = mid + new Vector3(0, 1.2f, 1) + Quaternion.Euler(52, 0, 0) * new Vector3(0, 0, -19); C.transform.rotation = Quaternion.Euler(52, 0, 0);
            R.SavePub(R.RenderPub(C, 2340, 1080), "board/style_board_gamecam.png");
            Debug.Log("[ST] board width " + x.ToString("F1") + " items " + items.Count);
        }

        static void Line(Vector3 c, float len, Color col)
        {
            var l = GameObject.CreatePrimitive(PrimitiveType.Cube); Object.Destroy(l.GetComponent<Collider>());
            l.transform.position = c; l.transform.localScale = new Vector3(len, 0.04f, 0.04f);
            l.GetComponent<MeshRenderer>().sharedMaterial = StGlow.Mat(col * 2f, 0);
            l.GetComponent<MeshRenderer>().sharedMaterial = StMat.Make("line" + ColorUtility.ToHtmlStringRGB(col), null, col, false, 0, col);
        }

        static StActor AnimalActor(string kind, float height, float yaw)
        {
            var g = StKit.Spawn("Town/Animals/" + kind, Vector3.zero, yaw);
            var b = StWorld.Bounds(g); if (b.size.y > 0.01f) g.transform.localScale *= height / b.size.y;
            StMat.ApplyGeneric(g, 0.6f);
            var a = g.AddComponent<StActor>(); a.anim = g.GetComponent<Animation>();
            string idle = null, walk = null;
            if (a.anim) foreach (AnimationState st in a.anim) { if (idle == null && st.name.EndsWith("Idle")) idle = st.name; if (walk == null && (st.name.EndsWith("Walk") || st.name.EndsWith("WalkSlow"))) walk = st.name; }
            a.idle = idle; a.run = walk ?? idle; a.attack = idle;
            return a;
        }

        // ---------- new characters / animals ----------
        static IEnumerator Folk()
        {
            Clear(); yield return null; Neutral(); C.orthographic = true;
            foreach (var v in StFolk.Villagers)
            {
                var a = StFolk.Make(v, Vector3.zero, 180); if (!a) continue;
                yield return R.TurnPub(a, "turn/turn_" + v.id, "Idle_Loop", 0.3f);
                yield return R.TurnPub(a, "turn/turn_" + v.id + "_walk", "Walk_Loop", 0.25f);
                if (v.id == "villager_m1") { yield return R.StripPub(a, "strips/strip_" + v.id + "_Walk_Loop", "Walk_Loop"); yield return R.StripPub(a, "strips/strip_" + v.id + "_Fixing_Kneeling", "Fixing_Kneeling"); }
                if (v.id == "villager_f1") yield return R.StripPub(a, "strips/strip_" + v.id + "_Idle_Talking_Loop", "Idle_Talking_Loop");
                Object.Destroy(a.gameObject); yield return null;
            }
            // model-agnostic proof: normal-proportion Quaternius ranger (Generic rig profile) wearing the KayKit bow / sword+shield on the same sockets
            var q = StFolk.Make(StFolk.QRanger, Vector3.zero, 180);
            if (q)
            {
                q.SetWeapons(null, "Weapons/bow_withString");
                yield return R.TurnPub(q, "turn/turn_q_ranger_generic_bow", "Idle_Loop", 0.3f);
                q.SetWeapons("Weapons/sword_1handed", "Weapons/shield_round_color");
                yield return R.TurnPub(q, "turn/turn_q_ranger_generic_sword_shield", "Sword_Idle", 0.3f);
                yield return R.StripPub(q, "strips/strip_q_ranger_generic_Sword_Attack", "Sword_Attack");
                q.SetWeapons("Weapons/staff", null);
                yield return R.TurnPub(q, "turn/turn_q_ranger_generic_staff", "Spell_Simple_Idle_Loop", 0.3f);
                Debug.Log("[ST] generic sockets: " + (q.sockets.problems.Count == 0 ? "all resolved" : string.Join(";", q.sockets.problems)));
                Object.Destroy(q.gameObject); yield return null;
            }
            foreach (var an in new[] { "Sheep", "Cow", "Pig", "Horse", "Pug" })
            {
                var a = AnimalActor(an, an == "Pug" ? 0.9f : an == "Cow" ? 2.9f : an == "Horse" ? 3.4f : an == "Pig" ? 1.5f : 1.9f, 180);
                a.transform.rotation = Quaternion.Euler(0, 180, 0);
                if (a.anim != null && a.idle != null)
                {
                    yield return R.TurnPub(a, "turn/turn_animal_" + an, a.idle, 0.3f);
                    if (a.run != a.idle) yield return R.StripPub(a, "strips/strip_animal_" + an + "_walk", a.run);
                }
                Object.Destroy(a.gameObject); yield return null;
            }
        }

        // ---------- repo monster recolour test ----------
        static readonly string[] MonIds = { "hm_warwolf", "hm_spider", "hm_lava_golem", "hm_giant_mutant", "hm_vampire_bat", "hm_rat" };
        static readonly Color[] MonPal = { new Color(0.55f, 0.46f, 0.38f), new Color(0.36f, 0.30f, 0.44f), new Color(0.40f, 0.33f, 0.31f), new Color(0.52f, 0.60f, 0.42f), new Color(0.40f, 0.33f, 0.46f), new Color(0.58f, 0.52f, 0.48f) };
        static readonly float[] MonH = { 3.6f, 2.2f, 5.0f, 5.5f, 2.4f, 1.3f };

        /// <summary>0 = original repo PBR, 1 = same texture on StToon (hard ramp), 2 = flat palette toon + elite rim glow.</summary>
        static StActor Monster(int i, int variant)
        {
            var p = Resources.Load<GameObject>("Models/" + MonIds[i]);
            if (p == null) { Debug.LogWarning("[ST] monster missing " + MonIds[i]); return null; }
            var g = Object.Instantiate(p); g.name = MonIds[i] + "_v" + variant;
            var b = StWorld.Bounds(g); if (b.size.y > 0.01f) g.transform.localScale *= MonH[i] / b.size.y;
            foreach (var sk in g.GetComponentsInChildren<SkinnedMeshRenderer>()) sk.updateWhenOffscreen = true;
            if (variant > 0)
            {
                foreach (var r in g.GetComponentsInChildren<Renderer>())
                {
                    var ms = r.sharedMaterials;
                    for (int k = 0; k < ms.Length; k++)
                    {
                        var o = ms[k]; Texture tex = o && o.HasProperty("_BaseMap") ? o.GetTexture("_BaseMap") : (o ? o.mainTexture : null);
                        Material m;
                        if (variant == 1) m = StMat.Make("mon1_" + MonIds[i] + k, tex, new Color(1.15f, 1.1f, 1.05f), false, 0, default, MonIds[i].Contains("mutant"));
                        else m = StMat.Make("mon2_" + MonIds[i] + k, null, MonPal[i], false, 0, MonIds[i].Contains("lava") ? new Color(0.35f, 0.08f, 0.0f) : default, MonIds[i].Contains("mutant"));
                        m.SetFloat("_Ramp", 0.12f); m.SetFloat("_Shade", 0.5f);
                        ms[k] = m;
                    }
                    r.sharedMaterials = ms;
                }
            }
            var a = g.AddComponent<StActor>(); a.anim = g.GetComponentInChildren<Animation>();
            if (a.anim) { foreach (AnimationState st in a.anim) { var n = st.name.ToLowerInvariant(); if (a.idle == "Idle_A" && n.Contains("idle")) a.idle = st.name; if (n.Contains("attack") && a.attack.StartsWith("Melee")) a.attack = st.name; if ((n.Contains("walk") || n.Contains("run")) && a.run == "Running_A") a.run = st.name; } }
            if (variant == 2) StGlow.Apply(a, i % 2 == 0 ? 3 : 2);
            return a;
        }

        static IEnumerator Monsters()
        {
            Clear(); yield return null; StWorld.DungeonLighting(); StWorld.BuildRoom(9, 6); C.backgroundColor = new Color(0.03f, 0.03f, 0.05f);
            var made = new List<StActor>();
            for (int v = 0; v < 3; v++)
                for (int i = 0; i < MonIds.Length; i++)
                {
                    var a = Monster(i, v); if (!a) continue;
                    a.transform.position = new Vector3(-14 + i * 5.6f, 0, 5 - v * 6.5f); a.transform.rotation = Quaternion.Euler(0, 200, 0);
                    if (a.anim && a.anim.GetClip(a.idle) != null) a.Pose(a.idle, 0.3f);
                    var bb = StWorld.Bounds(a.gameObject); a.transform.position += Vector3.up * -bb.min.y;
                    made.Add(a);
                }
            var kn = StLook.Knight().Build(new Vector3(18, 0, -1.5f), 200); kn.Pose(kn.idle, 0.3f);
            var sk = R.SkeletonPub(new Vector3(18, 0, 4.5f)); sk.transform.rotation = Quaternion.Euler(0, 200, 0); sk.Pose(sk.idle, 0.3f);
            yield return null;
            C.orthographic = false; C.fieldOfView = 40;
            C.transform.position = new Vector3(2, 0, -1) + Quaternion.Euler(40, 0, 0) * new Vector3(0, 0, -36); C.transform.rotation = Quaternion.Euler(40, 0, 0);
            R.SavePub(R.RenderPub(C, 2800, 1300), "monsters/recolour_board_rows_original_textoon_flatglow.png");
            // game-camera look at each row
            for (int v = 0; v < 3; v++)
            {
                var c = new Vector3(0, 0, 5 - v * 6.5f);
                C.fieldOfView = 35; C.transform.position = c + new Vector3(0, 1.2f, 1) + Quaternion.Euler(52, 0, 0) * new Vector3(0, 0, -22); C.transform.rotation = Quaternion.Euler(52, 0, 0);
                R.SavePub(R.RenderPub(C, 2340, 1080), "monsters/gamecam_row" + v + (v == 0 ? "_original" : v == 1 ? "_texture_toon" : "_flat_toon_elite_glow") + ".png");
            }
            foreach (var a in made) if (a) Object.Destroy(a.gameObject);
            Object.Destroy(kn.gameObject); Object.Destroy(sk.gameObject); yield return null;
            // turnarounds of the stylized variants
            StWorld.NeutralLighting(); C.backgroundColor = new Color(0.56f, 0.57f, 0.59f); C.orthographic = true;
            foreach (var w in Object.FindObjectsByType<Light>(FindObjectsSortMode.None)) if (w.type != LightType.Directional || w.name == "moon") Object.Destroy(w.gameObject);
            foreach (var t in StWorld.Built) if (t) Object.Destroy(t.gameObject);
            yield return null;
            for (int i = 0; i < MonIds.Length; i++)
                foreach (var v in new[] { 1, 2 })
                {
                    var a = Monster(i, v); if (!a) continue;
                    yield return R.TurnPub(a, "monsters/turn_" + MonIds[i] + (v == 1 ? "_texture_toon" : "_flat_toon"), a.idle, 0.3f);
                    if (v == 2 && a.anim && a.anim.GetClip(a.attack) != null) yield return R.StripPub(a, "monsters/strip_" + MonIds[i] + "_attack", a.attack);
                    Object.Destroy(a.gameObject); yield return null;
                }
        }

        // ---------- owned itch 2D art ----------
        static IEnumerator Ui()
        {
            Clear(); yield return null;
            StWorld.NeutralLighting(); C.backgroundColor = new Color(0.10f, 0.08f, 0.07f); C.orthographic = true;
            string[] rows = { "STO/Gems", "STO/Icons", "STO/Skills", "STO/Potions", "STO/Pixel", "STO/Banners", "STO/BG" };
            string[] names = { "7T4E tiers (gems, medallions, keys, chests, flasks, ingots, ores, bags)", "Wenrexa Fantasy Armory (CC0)", "Wenrexa Skill Icons #4 (CC0)", "Wenrexa RPG Potions", "CaptainSkolot swords / shields / potions (pixel)", "Wenrexa Kingdom banners", "CaptainSkolot backgrounds (loading / signs / paintings)" };
            float y = 0; int any = 0;
            for (int r = 0; r < rows.Length; r++)
            {
                var tex = Resources.LoadAll<Texture2D>(rows[r]);
                System.Array.Sort(tex, (a, b) => string.CompareOrdinal(a.name, b.name));
                var label = Label(names[r] + "  (" + tex.Length + ")", new Vector3(0, y, 0), 0.5f, TextAnchor.UpperLeft); y -= 0.9f;
                float h = r >= 5 ? 3.2f : 1.2f; int maxN = r == 0 ? 56 : r >= 5 ? 6 : 28; float x = 0; int col = 0;
                for (int i = 0; i < tex.Length && i < maxN; i++)
                {
                    float w = h * tex[i].width / (float)tex[i].height;
                    if (x + w > 40) { x = 0; y -= h + 0.2f; }
                    Quad(tex[i], new Vector3(x + w / 2, y - h / 2, 0), new Vector2(w, h));
                    x += w + 0.2f; col++; any++;
                }
                y -= h + 0.6f;
            }
            if (any == 0) { Debug.Log("[ST] ui: no owned art present (public build)"); yield break; }
            C.orthographicSize = (-y + 1) / 2; C.transform.position = new Vector3(20, y / 2 + 0.5f, -10); C.transform.rotation = Quaternion.identity;
            yield return null;
            R.SavePub(R.RenderPub(C, 2400, Mathf.Clamp((int)(2400 * (-y + 1) / 41f), 600, 4000)), "ui/itch_showcase.png");
            // loading screen mock: Skolot landscape + title + tip + bar
            Clear(); yield return null; StWorld.NeutralLighting(); C.orthographic = true; C.backgroundColor = Color.black;
            var bgs = Resources.LoadAll<Texture2D>("STO/BG"); Texture2D bg = null; foreach (var t in bgs) if (t.name.Contains("Pastel")) { bg = t; break; }
            if (bg == null && bgs.Length > 0) bg = bgs[0];
            if (bg != null)
            {
                float hgt = 10, w = hgt * bg.width / (float)bg.height;
                Quad(bg, Vector3.zero, new Vector2(Mathf.Max(w, hgt * 2340f / 1080f), hgt));
                Label("HOLLOWMERE", new Vector3(0, 3.1f, -0.1f), 1.3f, TextAnchor.MiddleCenter, new Color(1f, 0.9f, 0.6f));
                Label("Loading Hollowmere town...", new Vector3(0, -3.6f, -0.1f), 0.42f, TextAnchor.MiddleCenter, Color.white);
                var bar = GameObject.CreatePrimitive(PrimitiveType.Quad); bar.transform.position = new Vector3(-2.5f, -4.2f, -0.1f); bar.transform.localScale = new Vector3(9, 0.22f, 1);
                bar.GetComponent<MeshRenderer>().sharedMaterial = StMat.Make("bar", null, new Color(0.95f, 0.75f, 0.3f), false, 0, new Color(0.6f, 0.45f, 0.15f));
                var gem = Resources.Load<Texture2D>("STO/Gems/gem_tier_6"); if (gem) Quad(gem, new Vector3(2.3f, -4.2f, -0.12f), new Vector2(0.9f, 0.9f));
                C.orthographicSize = 5; C.transform.position = new Vector3(0, 0, -10); C.transform.rotation = Quaternion.identity;
                yield return null;
                R.SavePub(R.RenderPub(C, 2340, 1080), "ui/loading_screen.png");
            }
        }

        static GameObject Quad(Texture2D t, Vector3 p, Vector2 s)
        {
            var q = GameObject.CreatePrimitive(PrimitiveType.Quad); Object.Destroy(q.GetComponent<Collider>());
            q.transform.position = p; q.transform.localScale = new Vector3(s.x, s.y, 1);
            var m = StMat.Make("ui_" + t.name, t, Color.white, false, 0.4f, default, true); m.SetFloat("_SelfLit", 1f); q.GetComponent<MeshRenderer>().sharedMaterial = m;
            return q;
        }

        static TextMesh Label(string s, Vector3 p, float size, TextAnchor an, Color? c = null)
        {
            var t = new GameObject("label").AddComponent<TextMesh>();
            t.text = s; t.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            t.GetComponent<MeshRenderer>().sharedMaterial = t.font.material; t.fontSize = 64; t.characterSize = size * 0.16f;
            t.anchor = an; t.color = c ?? new Color(0.95f, 0.88f, 0.7f); t.transform.position = p;
            return t;
        }

        // ---------- town ----------
        static IEnumerator Town()
        {
            Clear(); yield return null;
            StTown.Lighting(); C.backgroundColor = new Color(0.62f, 0.66f, 0.74f);
            StTown.Build(); Debug.Log("[ST] town built");
            yield return null;
            float t = 1.3f;
            void Settle(float time)
            {
                int k = 0;
                foreach (var f in StTown.Folk) if (f) { f.Pose(f.GetComponent<StWander>() && (k % 2 == 0) ? "Walk_Loop" : f.idle, (time * 0.37f + k * 0.21f) % 1f); k++; }
                foreach (var a in Object.FindObjectsByType<Animation>(FindObjectsSortMode.None))
                    if (a.GetComponent<StActor>() == null) foreach (AnimationState st in a) { if (st.name.EndsWith("Idle")) { st.enabled = true; st.weight = 1; st.normalizedTime = (time * 0.1f + a.GetInstanceID() * 0.013f) % 1f; a.Sample(); st.enabled = false; break; } }
                foreach (var s in StTown.Smokes) if (s) s.Sample(time);
            }
            // overview
            C.fieldOfView = 40;
            C.transform.position = new Vector3(0, 62, -58); C.transform.rotation = Quaternion.Euler(45, 0, 0);
            Settle(t); yield return null; Settle(t);
            Debug.Log("[ST] render overview"); R.SavePub(R.RenderPub(C, 2340, 1080), "town/overview.png"); Debug.Log("[ST] overview saved");
            C.transform.position = new Vector3(-48, 26, -40); C.transform.LookAt(new Vector3(0, 0, 6));
            Settle(t); R.SavePub(R.RenderPub(C, 2340, 1080), "town/establishing.png");
            // hero at each spot, game camera + zoom, with HUD mock (owned icons) on the camera
            var heroes = StLook.Base; int hi = 0;
            foreach (var kv in new[] { "plaza", "blacksmith", "market", "pen", "gate" })
            {
                Debug.Log("[ST] town hero " + kv + " have=" + StTown.Spots.ContainsKey(kv));
                var spot = StTown.Spots[kv];
                var l = heroes[hi++ % 3]; var h = l.Build(spot, kv == "gate" ? 0 : 160); h.Pose(h.idle, 0.3f);
                var hud = Hud();
                foreach (var dist in new[] { 15f, 9f })
                {
                    C.fieldOfView = 35;
                    var tgt = spot + new Vector3(0, 1.2f, 1.0f);
                    C.transform.position = tgt + Quaternion.Euler(52, 0, 0) * new Vector3(0, 0, -dist); C.transform.rotation = Quaternion.Euler(52, 0, 0);
                    if (hud) hud.SetActive(dist > 12);
                    Settle(t + hi); yield return null; Settle(t + hi);
                    R.SavePub(R.RenderPub(C, 2340, 1080), (dist > 12 ? "town/gamecam_" : "town/zoom_") + kv + "_" + l.id + ".png");
                }
                if (hud) Object.Destroy(hud);
                Object.Destroy(h.gameObject); yield return null;
            }
        }

        /// <summary>HUD mock parented to the camera: skill bar (Wenrexa skill icons), potions, gem currency. Owned art only; null if absent.</summary>
        internal static void Bind(StyleTestRunner r, Camera c) { R = r; C = c; }
        internal static GameObject Hud()
        {
            var skills = Resources.LoadAll<Texture2D>("STO/Skills"); var pots = Resources.LoadAll<Texture2D>("STO/Potions");
            if (skills.Length == 0) return null;
            var root = new GameObject("hud"); root.transform.SetParent(C.transform, false);
            float z = 1.0f; float hh = Mathf.Tan(C.fieldOfView * 0.5f * Mathf.Deg2Rad) * z; float ww = hh * 2340f / 1080f;
            float s = hh * 0.16f;
            for (int i = 0; i < 4; i++)
            {
                var q = Quad(skills[(i * 7) % skills.Length], Vector3.zero, new Vector2(s, s)); q.transform.SetParent(root.transform, false);
                q.transform.localPosition = new Vector3(ww - s * (4.6f - i * 1.1f), -hh + s * 0.75f, z); q.transform.localRotation = Quaternion.identity;
            }
            for (int i = 0; i < 2 && i < pots.Length; i++)
            {
                var q = Quad(pots[i * 3 % pots.Length], Vector3.zero, new Vector2(s * 0.9f, s * 0.9f)); q.transform.SetParent(root.transform, false);
                q.transform.localPosition = new Vector3(-ww + s * (0.8f + i * 1.0f), -hh + s * 0.7f, z); q.transform.localRotation = Quaternion.identity;
            }
            var gem = Resources.Load<Texture2D>("STO/Gems/gem_tier_5");
            if (gem) { var q = Quad(gem, Vector3.zero, new Vector2(s * 0.6f, s * 0.6f)); q.transform.SetParent(root.transform, false); q.transform.localPosition = new Vector3(-ww + s * 0.6f, hh - s * 0.5f, z); q.transform.localRotation = Quaternion.identity; }
            return root;
        }
    }
}
