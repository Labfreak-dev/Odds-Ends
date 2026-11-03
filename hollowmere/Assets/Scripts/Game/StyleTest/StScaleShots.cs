using System.Collections;
using System.Collections.Generic;
using System.IO;
using UnityEngine;
using Hollowmere.StyleTest.Skills;

namespace Hollowmere.StyleTest
{
    /// <summary>Scale-standard proof (-stOnly scale | sc_lineup | sc_game | sc_heights): orthographic side lineups with a
    /// metre ruler (1.8 m line in red), per-class hero variants, 2340x1080 game-camera shots in town + 4 biomes, and a
    /// measured-height log (scale/heights.txt). Output: -stOut/scale/.</summary>
    public static class StScaleShots
    {
        static StyleTestRunner R; static Camera C; const string Out = "scale/";
        static Font font;

        static void Clear()
        {
            foreach (var go in Object.FindObjectsByType<GameObject>(FindObjectsSortMode.None))
                if (go.transform.parent == null && go != R.gameObject && go != C.gameObject && go.name != "Hollowmere" && go.name != "arrow_tpl" && go.name != "EventSystem") Object.Destroy(go);
            StWorld.Built.Clear(); C.orthographic = false; C.fieldOfView = 35; C.farClipPlane = 220; C.clearFlags = CameraClearFlags.SolidColor;
            foreach (Transform t in C.transform) Object.Destroy(t.gameObject);
        }

        static string OutDir()
        {
            var a = System.Environment.GetCommandLineArgs(); int i = System.Array.IndexOf(a, "-stOut");
            return i >= 0 && i + 1 < a.Length ? a[i + 1] : Directory.GetCurrentDirectory();
        }

        public static IEnumerator Run(StyleTestRunner r, Camera cam, string only)
        {
            R = r; C = cam; StPhase1Shots.Bind(r, cam); StScale.Log.Clear();
            StScale.Log.Add("# Hollowmere style test - measured heights (1 unit = 1 m). Renderer bounds, weapons hidden for actors.");
            StScale.Log.Add("# Standard: hero " + StScale.Hero + ", villager " + StScale.Villager + ", elite " + StScale.Elite + ", boss " + StScale.Boss + ", door " + StScale.Door + ", stall " + StScale.StallH + ", fountain rim " + StScale.FountainRim + " / top " + StScale.FountainTop);
            bool all = only == "scale";
            if (all || only == "sc_lineup" || only == "sc_heights") yield return Lineups(only != "sc_heights");
            if (all || only == "sc_heights") yield return WorldHeights();
            if (all || only == "sc_game") yield return GameCams();
            var p = Path.Combine(OutDir(), Out + "heights.txt"); Directory.CreateDirectory(Path.GetDirectoryName(p));
            File.WriteAllLines(p, StScale.Log); Debug.Log("[ST] scale heights -> " + p);
        }

        // ------------------------------------------------------------------ helpers
        static Material M(string n, Color c) => StMat.Make("sc_" + n, null, c, false, 0, c * 0.9f);

        static GameObject Bar(Vector3 c, Vector3 size, Color col)
        {
            var g = GameObject.CreatePrimitive(PrimitiveType.Cube); Object.Destroy(g.GetComponent<Collider>());
            g.transform.position = c; g.transform.localScale = size; var r = g.GetComponent<MeshRenderer>();
            r.sharedMaterial = M(ColorUtility.ToHtmlStringRGB(col), col); r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off; return g;
        }

        static GameObject Label(string text, Vector3 pos, float h, Color col, TextAnchor anchor = TextAnchor.UpperCenter)
        {
            if (!font) font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            var g = new GameObject("lbl_" + text); g.transform.position = pos;
            var tm = g.AddComponent<TextMesh>(); tm.font = font; tm.text = text; tm.fontSize = 96; tm.characterSize = h * 10f / 96f * 1.45f;
            tm.anchor = anchor; tm.alignment = TextAlignment.Center; tm.color = col;
            g.GetComponent<MeshRenderer>().sharedMaterial = font.material; return g;
        }

        /// <summary>Metre ruler behind the lineup: lines every 0.5 m, the 1.8 m hero line in red, labels on both ends.</summary>
        static void Ruler(float x0, float x1, float top)
        {
            float z = 4f, w = x1 - x0;
            Bar(new Vector3((x0 + x1) / 2, -0.03f, 1.5f), new Vector3(w + 2, 0.06f, 8), new Color(0.30f, 0.31f, 0.34f));
            for (float y = 0.5f; y <= top + 0.01f; y += 0.5f)
            {
                bool hero = false; bool whole = Mathf.Abs(y - Mathf.Round(y)) < 0.01f;
                Bar(new Vector3((x0 + x1) / 2, y, z), new Vector3(w + 1.2f, whole ? 0.025f : 0.012f, 0.02f), whole ? new Color(0.85f, 0.86f, 0.9f) : new Color(0.55f, 0.56f, 0.6f));
                if (whole || y < 3) { Label(y.ToString("0.0") + " m", new Vector3(x0 - 0.75f, y + 0.02f, z), 0.22f, Color.white, TextAnchor.LowerRight); }
                if (hero) { }
            }
            Bar(new Vector3((x0 + x1) / 2, StScale.Hero, z - 0.01f), new Vector3(w + 1.2f, 0.035f, 0.02f), new Color(1f, 0.15f, 0.12f));
            Label("1.8 m hero", new Vector3(x1 + 0.7f, StScale.Hero + 0.02f, z), 0.22f, new Color(1f, 0.4f, 0.35f), TextAnchor.LowerLeft);
        }

        static float MeasureActor(StActor a, out Bounds b)
        {
            var off = new List<Renderer>();
            foreach (var w in new[] { a.weaponR, a.weaponL }) if (w) foreach (var r in w.GetComponentsInChildren<Renderer>()) if (r.enabled) { r.enabled = false; off.Add(r); }
            b = StScale.Measure(a.gameObject);
            foreach (var r in off) r.enabled = true;
            return b.size.y;
        }

        static void LogActor(string what, StActor a, float target)
        {
            float h = MeasureActor(a, out var b);
            StScale.Log.Add(string.Format("{0,-34} h={1,5:0.00} m  w={2,5:0.00}  d={3,5:0.00}  target {4:0.00}  ({5:+0;-0}%)", what, h, b.size.x, b.size.z, target, (h / target - 1) * 100));
        }

        // ------------------------------------------------------------------ lineup pieces (all metres)
        /// <summary>DU-authored kit piece converted exactly as the builders do (x StScale.DU).</summary>
        static GameObject DU(GameObject g) { g.transform.localScale *= StScale.DU; return g; }

        static void Place(GameObject g, ref float x, float gap = 0.7f)
        {
            var b = StScale.Measure(g);
            g.transform.position += new Vector3(x - b.min.x, -b.min.y, -b.center.z);
            x += b.size.x + gap;
        }

        static StActor Mon(string id, Vector3 p)
        {
            foreach (var kv in StBestiary.Rosters) foreach (var e in kv.Value) if (e.id == id) return StBestiary.Spawn(e, p, 160);
            Debug.LogWarning("[ST] scale: no monster " + id); return null;
        }

        static readonly (string cls, string sub, string label)[] Heroes =
        {
            ("knight", null, "Knight"), ("ranger", null, "Ranger"), ("mage", null, "Mage"),
            ("knight", "paladin", "Paladin"), ("ranger", "sharpshooter", "Sharpshooter"), ("mage", "fire_wizard", "Fire Wizard"),
        };

        static IEnumerator Lineups(bool shots)
        {
            // 1) every hero skin + villagers, measured (heroes.png)
            Clear(); yield return null;
            StWorld.NeutralLighting(); C.backgroundColor = new Color(0.20f, 0.21f, 0.24f);
            float x = 0; var labels = new List<(string, float, float)>();
            foreach (var hd in Heroes)
            {
                var a = StPhase5Shots.Hero(hd.cls, hd.sub, Vector3.zero, 165); a.Pose(a.idle, 0.3f);
                LogActor("hero " + hd.label + " (idle)", a, StScale.Hero);
                Place(a.gameObject, ref x, 0.5f); MeasureActor(a, out var b); labels.Add((hd.label, b.center.x, b.size.y));
            }
            for (int i = 0; i < StFolk.Villagers.Length; i++)
            {
                var v = StFolk.Make(StFolk.Villagers[i], Vector3.zero, 165); if (!v) continue; v.Pose(v.idle, 0.3f);
                LogActor("villager " + StFolk.Villagers[i].id + " (idle)", v, StScale.Villager);
                Place(v.gameObject, ref x, 0.5f); var b = StScale.Measure(v.gameObject); labels.Add((StFolk.Villagers[i].id.Replace("villager_", "villager "), b.center.x, b.size.y));
            }
            if (shots) { yield return null; Shoot(labels, 0, x, 2.6f, "heroes.png", "HERO SKINS + VILLAGERS  ·  1 unit = 1 m  ·  red line = 1.8 m hero standard"); }

            // 2) combined lineup + one per hero skin
            for (int hv = -1; hv < Heroes.Length; hv++)
            {
                if (!shots && hv >= 0) break;
                Clear(); yield return null;
                StWorld.NeutralLighting(); C.backgroundColor = new Color(0.20f, 0.21f, 0.24f);
                x = 0; labels.Clear(); probes.Clear(); bool log = hv == -1;
                var door = DU(StKit.Spawn("Dungeon/wall_doorway", Vector3.zero, 0)); door.transform.localScale *= StScale.DungeonKit; Place(door, ref x);
                var db = StScale.Measure(door);
                labels.Add(("dungeon wall_doorway\n(gate / dungeon kit)", db.center.x, db.size.y)); probes.Add(("door_dungeon", db.center.x));
                if (log) StScale.Record("kit dungeon wall_doorway (x kit fit)", door, "door opening: see probes / doors.png");
                var home = DU(StTown.Hex("building_home_A_blue", Vector3.zero, 180)); Place(home, ref x);
                var hb = StScale.Measure(home); labels.Add(("house (hex home A)", hb.center.x, hb.size.y)); probes.Add(("door_house", hb.center.x));
                if (log) StScale.Record("kit hex building_home_A", home);
                var stall = DU(StTown.VK("MarketStall_Baker", Vector3.zero, 180)); Place(stall, ref x);
                var sb = StScale.Measure(stall); labels.Add(("market stall", sb.center.x, sb.size.y));
                if (log) StScale.Record("kit VK MarketStall_Baker", stall, "target " + StScale.StallH);
                var fount = DU(StTown.VK("Prop_Fountain", Vector3.zero, 0)); Place(fount, ref x);
                var fb = StScale.Measure(fount);
                labels.Add(("fountain", fb.center.x, fb.size.y)); probes.Add(("rim_fountain", fb.center.x - fb.extents.x * 0.80f));
                if (log) StScale.Record("kit VK Prop_Fountain", fount, "target top " + StScale.FountainTop + ", rim " + StScale.FountainRim + " (see probes)");
                var doorsEnd = x;
                x += 0f; var vill = StFolk.Make(StFolk.Villagers[0], Vector3.zero, 165); vill.Pose(vill.idle, 0.3f); x += 0.4f; Place(vill.gameObject, ref x, 1.1f);
                labels.Add(("villager", StScale.Measure(vill.gameObject).center.x, StScale.Measure(vill.gameObject).size.y));
                var hd = Heroes[Mathf.Max(0, hv)];
                var hero = StPhase5Shots.Hero(hd.cls, hd.sub, Vector3.zero, 165); hero.Pose(hero.idle, 0.3f); Place(hero.gameObject, ref x, 1.1f);
                MeasureActor(hero, out var hb2); labels.Add(("HERO\n" + hd.label, hb2.center.x, hb2.size.y));
                foreach (var (id, lab) in new[] { ("rat", "rat\n(critter)"), ("elite_warwolf", "warwolf\n(elite)"), ("skel_warrior", "skeleton"), ("boss_death", "boss\n(Death)") })
                {
                    var m = Mon(id, Vector3.zero); if (!m) continue; Place(m.gameObject, ref x, 1.1f);
                    var mb = StScale.Measure(m.gameObject); labels.Add((lab, mb.center.x, mb.size.y));
                }
                yield return null;
                if (shots) Shoot(labels, 0, x, 7.0f, hv < 0 ? "lineup.png" : "lineup_" + hd.label.ToLowerInvariant().Replace(" ", "_") + ".png",
                    "SCALE LINEUP  ·  1 unit = 1 m  ·  hero " + hd.label + "  ·  red line = 1.8 m", false, hv < 0);
                if (shots && hv < 0)
                {   // close-up of the kit with 0.1 m ticks; the villager steps out, the hero stands right after the fountain
                    vill.gameObject.SetActive(false);
                    var keep = new List<(string, float, float)>(labels.GetRange(0, 4));
                    hero.transform.position += new Vector3(doorsEnd - hb2.min.x, 0, 0); var nb = StScale.Measure(hero.gameObject);
                    keep.Add(("HERO " + hd.label, nb.center.x, hb2.size.y)); yield return null;
                    Shoot(keep, 0, doorsEnd + hb2.size.x + 0.4f, 6.8f, "doors.png", "KIT vs HERO  ·  0.1 m ticks  ·  red = 1.8 m", true, true);
                }
            }
        }

        static readonly List<(string id, float x)> probes = new List<(string, float)>();

        static void Shoot(List<(string text, float x, float h)> labels, float x0, float x1, float top, string file, string title, bool fine = false, bool probe = false)
        {
            var snap = StScale.Snapshot(); // ruler + labels are removed again after the shot
            Ruler(x0, x1, top);
            if (fine) for (float y = 0.1f; y < top; y += 0.1f) if (Mathf.Abs(y * 2 - Mathf.Round(y * 2)) > 0.01f) Bar(new Vector3(x0 - 0.35f, y, 4f), new Vector3(0.25f, 0.008f, 0.02f), new Color(0.75f, 0.76f, 0.8f));
            foreach (var l in labels)
            {
                Label(l.text, new Vector3(l.x, -0.15f, -1.5f), 0.2f, new Color(1f, 0.92f, 0.7f));
                Label(l.h.ToString("0.00") + " m", new Vector3(l.x, l.h + 0.08f, -1.5f), 0.2f, Color.white, TextAnchor.LowerCenter);
            }
            Label(title, new Vector3((x0 + x1) / 2, top + 0.45f, 4f), 0.3f, Color.white, TextAnchor.LowerCenter);
            float spanX = x1 - x0 + 3.6f, spanY = top + 1.9f; int W = 3600, H = Mathf.Clamp(Mathf.RoundToInt(W * spanY / spanX), 900, 2400);
            C.orthographic = true; C.aspect = W / (float)H; C.orthographicSize = Mathf.Max(spanY / 2, spanX / 2 / C.aspect);
            C.transform.position = new Vector3((x0 + x1) / 2 - 0.3f, spanY / 2 - 0.95f, -30); C.transform.rotation = Quaternion.identity;
            if (probe)
            {   // pixel mapping for scale/measure.py (door openings / fountain rim are read from the image: kit meshes are not readable at runtime)
                float ppm = H / (2 * C.orthographicSize); var g0 = C.WorldToViewportPoint(Vector3.zero);
                foreach (var p in probes) { var v = C.WorldToViewportPoint(new Vector3(p.x, 0, 0)); StScale.Log.Add(string.Format("probe {0} {1} xpx={2:0} groundpx={3:0} ppm={4:0.00}", file, p.id, v.x * W, (1 - g0.y) * H, ppm)); }
            }
            R.SavePub(R.RenderPub(C, W, H), Out + file); C.ResetAspect(); C.orthographic = false;
            foreach (var g in UnityEngine.SceneManagement.SceneManager.GetActiveScene().GetRootGameObjects()) if (!snap.Contains(g) && (g.name.StartsWith("lbl_") || g.name == "Cube")) Object.Destroy(g);
            Debug.Log("[ST] scale shot " + file);
        }

        // ------------------------------------------------------------------ in-world heights (as built)
        static void LogBuilt(string scene, IEnumerable<Transform> built)
        {
            var seen = new HashSet<string>();
            foreach (var t in built)
            {
                if (!t || t.GetComponent<Renderer>() == null && t.GetComponentInChildren<Renderer>() == null) continue;
                var n = t.name.Replace("(Clone)", ""); if (n == "dust" || n == "fog_sheet" || n.StartsWith("Quad") || n.StartsWith("Cube") || n.StartsWith("pic_")) continue;
                if (!seen.Add(n)) continue;
                StScale.Record(scene + " " + n, t.gameObject);
            }
        }

        static IEnumerator WorldHeights()
        {
            Clear(); yield return null; StTown.Lighting(); StTown.Build(); yield return null;
            StScale.Log.Add(""); StScale.Log.Add("## town (as built, after the DU -> m conversion)");
            LogBuilt("town", StTown.Built);
            foreach (var f in StTown.Folk) if (f) { f.Pose(f.idle, 0.3f); LogActor("town folk " + f.name, f, StScale.Villager); }
            foreach (var id in StBiomes.Ids)
            {
                Clear(); yield return null; StBiomes.Build(id); yield return null;
                StScale.Log.Add(""); StScale.Log.Add("## " + id + " (as built)");
                LogBuilt(id, StBiomes.Built);
                foreach (var e in StBestiary.Rosters[id])
                {
                    var a = StBestiary.Spawn(e, StBiomes.Centre + Vector3.right * 40, 180); if (!a) continue;
                    float target = e.tier == 2 ? StScale.Boss : e.tier == 1 ? StScale.Elite : e.h > 0 ? e.h : StScale.Enemy;
                    LogActor("monster " + id + " " + e.id + (e.tier == 2 ? " [boss]" : e.tier == 1 ? " [elite]" : ""), a, target);
                    Object.Destroy(a.gameObject);
                }
            }
        }

        // ------------------------------------------------------------------ game camera (2340x1080)
        static readonly Dictionary<string, (string cls, string sub)> BiomeHero = new Dictionary<string, (string, string)>
        { { "crypt", ("knight", null) }, { "cave", ("ranger", "sharpshooter") }, { "sewer", ("mage", null) }, { "mine", ("mage", "fire_wizard") } };

        static GameObject Hud(string cls, string sub)
        {
            try
            {
                var l = Loadout.Default(cls, sub);
                var hud = StUi.BuildHud(C, l, new StUi.HudState { hp = 820, maxHp = 820, mana = 300, maxMana = 300, level = 20, ult = 0.6f });
                Canvas.ForceUpdateCanvases(); return hud.canvas.gameObject;
            }
            catch (System.Exception ex) { Debug.LogWarning("[ST] scale hud " + ex.Message); return null; }
        }

        static IEnumerator GameCams()
        {
            // town: plaza (fountain + benches + villagers), market (stalls), gate (doorway)
            foreach (var spot in new[] { "plaza", "market", "gate" })
            {
                Clear(); yield return null; StTown.Lighting(); StTown.Build(); C.backgroundColor = new Color(0.62f, 0.66f, 0.74f);
                var p = StTown.Spots[spot];
                var hero = StPhase5Shots.Hero("knight", "paladin", p, spot == "gate" ? 0 : 160); hero.Pose(hero.idle, 0.3f);
                int k = 0; foreach (var f in StTown.Folk) if (f) f.Pose(f.idle, (k++ * 0.21f) % 1f);
                foreach (var s in StTown.Smokes) if (s) s.Sample(3f);
                StScale.GameCam(C, p); var hud = Hud("knight", "paladin"); yield return null;
                R.SavePub(R.RenderPub(C, 2340, 1080), Out + "gamecam/town_" + spot + ".png"); if (hud) Object.Destroy(hud);
                // eye-level check of the same spot (hero vs props/doors)
                C.fieldOfView = 40; C.transform.position = p + new Vector3(-2.2f, 1.5f, -5.5f); C.transform.LookAt(p + new Vector3(0.6f, 1.1f, 2.5f)); yield return null;
                R.SavePub(R.RenderPub(C, 2340, 1080), Out + "eye/town_" + spot + ".png");
            }
            foreach (var id in StBiomes.Ids)
            {
                Clear(); yield return null;
                StBiomes.Build(id); C.backgroundColor = RenderSettings.fogColor;
                var bh = BiomeHero[id]; var hero = StPhase5Shots.Hero(bh.cls, bh.sub, StBiomes.Hero, 20); hero.Pose(hero.attack, 0.45f);
                var spots = new List<Vector3>(StBiomes.Spawns);
                var kk = StScale.DU * StScale.DungeonKit; spots.Add(StBiomes.Hero + new Vector3(-3.5f, 0, 2.5f) * kk); spots.Add(StBiomes.Hero + new Vector3(3.5f, 0, 2.2f) * kk); spots.Add(StBiomes.Hero + new Vector3(5.5f, 0, -0.5f) * kk);
                int si = 0;
                foreach (var e in StBestiary.Rosters[id])
                {
                    var p = e.tier == 2 ? StPhase3Shots.BossPos(id) : spots[si++ % spots.Count];
                    var d = StBiomes.Hero - p; d.y = 0;
                    var a = StBestiary.Spawn(e, p, Quaternion.LookRotation(d.sqrMagnitude > 0.01f ? d : Vector3.back).eulerAngles.y);
                    if (a && a.anim && a.anim.GetClip(a.attack) != null) a.Pose(a.attack, 0.3f + 0.1f * si);
                }
                yield return null;
                StScale.GameCam(C, StBiomes.Hero); var hud = Hud(bh.cls, bh.sub); yield return null;
                R.SavePub(R.RenderPub(C, 2340, 1080), Out + "gamecam/" + id + ".png");
                StScale.GameCam(C, Vector3.Lerp(StBiomes.Hero, StPhase3Shots.BossPos(id), 0.45f), StScale.GameCamDist * 1.2f); yield return null;
                R.SavePub(R.RenderPub(C, 2340, 1080), Out + "gamecam/" + id + "_boss.png"); if (hud) Object.Destroy(hud);
                var hp = StBiomes.Hero; C.fieldOfView = 45; C.transform.position = hp + new Vector3(-2.5f, 1.4f, -4.5f); C.transform.LookAt(hp + new Vector3(0.8f, 1.2f, 3f)); yield return null;
                R.SavePub(R.RenderPub(C, 2340, 1080), Out + "eye/" + id + ".png");
                Debug.Log("[ST] scale game " + id);
            }
        }
    }
}
