using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using Hollowmere.StyleTest.Skills;
using Hollowmere.StyleTest.Fishing;

namespace Hollowmere.StyleTest
{
    /// <summary>Phase 5b proof (fishing): 8-frame strips of cast / idle-hold / bite-jerk / reel for knight, ranger, mage;
    /// a skins lineup; game-camera shots of the spot in town + each biome; reel minigame, bite prompt, result + escape popups;
    /// catch-table sheet. -stOnly p5b | p5b_strips | p5b_spots | p5b_ui | p5b_table | p5b_probe</summary>
    public static class StPhase5bShots
    {
        static StyleTestRunner R; static Camera C; const string Out = "phase5b/";
        static float U => StFishDb.U;

        static void Clear()
        {
            foreach (var go in Object.FindObjectsByType<GameObject>(FindObjectsSortMode.None))
                if (go.transform.parent == null && go != R.gameObject && go != C.gameObject && go.name != "Hollowmere" && go.name != "arrow_tpl" && go.name != "EventSystem") Object.Destroy(go);
            StWorld.Built.Clear(); C.orthographic = false; C.fieldOfView = 35; C.farClipPlane = 260; C.clearFlags = CameraClearFlags.SolidColor;
            foreach (Transform t in C.transform) Object.Destroy(t.gameObject);
        }

        public static IEnumerator Run(StyleTestRunner r, Camera cam, string only)
        {
            R = r; C = cam; bool all = only == "p5b", probe = only == "p5b_probe";
            Debug.Log("[ST] p5b catches " + StFishDb.Order.Count + " waters " + StFishDb.LocOrder.Count + " U " + U);
            if (all || only == "p5b_table") yield return Table();
            if (all || only == "p5b_strips" || probe) yield return Strips(probe);
            if (all || only == "p5b_strips") yield return Lineup();
            if (all || only == "p5b_spots" || probe) yield return Spots(probe);
            if (all || only == "p5b_ui") yield return Ui();
        }

        // ------------------------------------------------------------------ strips
        static FishSpot TestWater(Vector3 heroPos)
        {
            var s = new FishSpot { loc = "town", stand = heroPos, facing = Vector3.right, waterY = 0.04f * U };
            s.hotspot = heroPos + new Vector3(5.4f * U, 0.04f * U, 0); s.poolCentre = s.hotspot;
            var w = GameObject.CreatePrimitive(PrimitiveType.Cube); Object.Destroy(w.GetComponent<Collider>()); w.name = "strip_water";
            w.transform.position = new Vector3(heroPos.x + 8.6f * U, 0.0f, 0); w.transform.localScale = new Vector3(13 * U, 0.08f * U, 16 * U);
            StFlow.Water(w.GetComponent<MeshRenderer>(), new Color(0.26f, 0.5f, 0.62f), new Vector2(0.05f, 0.03f));
            return s;
        }

        static readonly FishPose[] Poses = { FishPose.Cast, FishPose.Hold, FishPose.Bite, FishPose.Reel };
        static string PoseName(FishPose p) => p == FishPose.Hold ? "idle_hold" : p == FishPose.Bite ? "bite_jerk" : p.ToString().ToLowerInvariant();

        /// <summary>Pose hero + rig + bobber/fx for frame t of a pose (stills path; deterministic).</summary>
        static void Frame(StFishRig rig, FishSpot s, FishPose p, float t, Transform fx, ref Vector3 release)
        {
            StFx.Clear(fx);
            rig.PoseStill(p, t);
            switch (p)
            {
                case FishPose.Cast: if (t < 0.52f) release = rig.tip.position; StFishFx.Cast(rig, s, t, fx, C, release); break;
                case FishPose.Hold: StFishFx.Float(rig, s, t, fx, C, false); break;
                case FishPose.Bite: StFishFx.Bite(rig, s, t, fx, C); break;
                case FishPose.Reel: StFishFx.Reel(rig, s, t, 0.25f + 0.2f * t, Mathf.Sin(t * Mathf.PI * 2) * 0.7f, fx, C); break;
            }
            rig.UpdateLine();
        }

        static IEnumerator Strips(bool probe)
        {
            const int W = 560, H = 420, N = 8;
            foreach (var cls in probe ? new[] { "knight" } : new[] { "knight", "ranger", "mage" })
                foreach (var p in Poses)
                {
                    Clear(); yield return null;
                    StWorld.NeutralLighting(); C.backgroundColor = new Color(0.16f, 0.17f, 0.2f);
                    var floor = GameObject.CreatePrimitive(PrimitiveType.Plane); floor.transform.localScale = new Vector3(4, 1, 4) * U; floor.transform.position = new Vector3(-4 * U, 0, 0);
                    floor.GetComponent<Renderer>().sharedMaterial = StMat.Make("p5b_floor", null, new Color(0.42f, 0.4f, 0.36f), false);
                    var hero = StPhase5Shots.Hero(cls, null, Vector3.zero, 90); var s = TestWater(Vector3.zero);
                    var rig = StFishRig.Equip(hero); var fx = new GameObject("fx").transform; var rel = rig.tip.position;
                    // fit the camera to everything the 8 frames touch
                    var pts = new List<Vector3>();
                    for (int f = 0; f < N; f++) { Frame(rig, s, p, (f + 0.5f) / N, fx, ref rel); pts.Add(rig.tip.position); pts.Add(rig.bobber.position + new Vector3(0.9f, 0, 0.6f) * U); pts.Add(rig.bobber.position + new Vector3(0, 0, -0.6f) * U); pts.Add(rig.rod.position); }
                    foreach (var x in new[] { -0.8f, 0.8f }) foreach (var y in new[] { 0f, 3.2f }) foreach (var z in new[] { -0.7f, 0.7f }) pts.Add(new Vector3(x, y, z) * U);
                    Fit(pts, W / (float)H, new Vector3(-0.25f, -0.32f, 1f));
                    var sheet = new Texture2D(W * N, H, TextureFormat.RGB24, false); rel = rig.tip.position;
                    for (int f = 0; f < N; f++)
                    {
                        float t = (f + 0.5f) / N; Frame(rig, s, p, t, fx, ref rel); yield return null; Frame(rig, s, p, t, fx, ref rel);
                        var tile = R.RenderPub(C, W, H); sheet.SetPixels(f * W, 0, W, H, tile.GetPixels()); Object.Destroy(tile);
                    }
                    sheet.Apply(); R.SavePub(sheet, Out + "strips/" + cls + "_" + PoseName(p) + ".jpg", true); C.ResetAspect();
                    Debug.Log("[ST] p5b strip " + cls + " " + PoseName(p));
                }
        }

        /// <summary>Fixed view direction, distance solved so all points fit, re-centred on their projection.</summary>
        static void Fit(List<Vector3> pts, float aspect, Vector3 viewDir)
        {
            var centre = Vector3.zero; foreach (var p in pts) centre += p; centre /= pts.Count;
            C.fieldOfView = 35; C.aspect = aspect; C.transform.rotation = Quaternion.LookRotation(viewDir.normalized, Vector3.up);
            float lo = 1, hi = 80;
            for (int it = 0; it < 26; it++)
            {
                float d = (lo + hi) / 2; C.transform.position = centre - C.transform.forward * d; bool ok = true;
                foreach (var p in pts) { var v = C.WorldToViewportPoint(p); if (v.z < 0.3f || v.x < 0.05f || v.x > 0.95f || v.y < 0.05f || v.y > 0.95f) { ok = false; break; } }
                if (ok) hi = d; else lo = d;
            }
            C.transform.position = centre - C.transform.forward * hi;
            float minx = 1, maxx = 0, miny = 1, maxy = 0;
            foreach (var p in pts) { var v = C.WorldToViewportPoint(p); minx = Mathf.Min(minx, v.x); maxx = Mathf.Max(maxx, v.x); miny = Mathf.Min(miny, v.y); maxy = Mathf.Max(maxy, v.y); }
            var ray = C.ViewportPointToRay(new Vector3((minx + maxx) / 2, (miny + maxy) / 2, 0));
            C.transform.position += ray.GetPoint(hi) - (C.transform.position + C.transform.forward * hi);
        }

        /// <summary>All six skins (base + subclass outfits) in the reel pose with rods: the rig is model/skin agnostic.</summary>
        static IEnumerator Lineup()
        {
            Clear(); yield return null;
            StWorld.NeutralLighting(); C.backgroundColor = new Color(0.2f, 0.21f, 0.24f);
            var floor = GameObject.CreatePrimitive(PrimitiveType.Plane); floor.transform.localScale = new Vector3(8, 1, 8) * U;
            floor.GetComponent<Renderer>().sharedMaterial = StMat.Make("p5b_floor", null, new Color(0.42f, 0.4f, 0.36f), false);
            var lineup = new[] { ("knight", (string)null), ("knight", "paladin"), ("ranger", null), ("ranger", "sharpshooter"), ("mage", null), ("mage", "fire_wizard") };
            var poses = new[] { FishPose.Cast, FishPose.Hold, FishPose.Bite, FishPose.Reel, FishPose.Reel, FishPose.Hold };
            var ts = new[] { 0.32f, 0.3f, 0.35f, 0.2f, 0.6f, 0.7f };
            var rigs = new List<(StFishRig, FishPose, float)>();
            for (int i = 0; i < lineup.Length; i++)
            {
                var a = StPhase5Shots.Hero(lineup[i].Item1, lineup[i].Item2, new Vector3((i - 2.5f) * 3.4f * U, 0, 0), 150); var rg = StFishRig.Equip(a); rigs.Add((rg, poses[i], ts[i]));
            }
            foreach (var (rg, p, t) in rigs) { rg.PoseStill(p, t); rg.lineOn = false; rg.UpdateLine(); }
            yield return null; foreach (var (rg, p, t) in rigs) rg.PoseStill(p, t);
            C.fieldOfView = 30; C.transform.position = new Vector3(0, 5.2f, -22f) * U; C.transform.LookAt(new Vector3(0, 2.0f, 0) * U);
            var cv = StUi.MakeCanvas(C, "p5b_lineup"); var root = cv.transform;
            StUi.Txt(root, "FISHING POSES ON EVERY SKIN  ·  one procedural IK layer, rod on the HandR socket (base + subclass outfits)", 38, Color.white, new Vector2(0.5f, 1), new Vector2(0, -36), new Vector2(2200, 60), TextAnchor.MiddleCenter, FontStyle.Bold);
            var labels = new[] { "Knight · cast", "Paladin · idle-hold", "Ranger · bite-jerk", "Sharpshooter · reel", "Mage · reel", "Fire Wizard · hold" };
            yield return null;
            for (int i = 0; i < labels.Length; i++)
            {
                var vp = C.WorldToViewportPoint(new Vector3((i - 2.5f) * 3.4f * U, 0, 0));
                StUi.Txt(root, labels[i], 32, i % 2 == 1 ? new Color(1f, 0.82f, 0.38f) : Color.white, new Vector2(vp.x, 0), new Vector2(0, 110), new Vector2(380, 50), TextAnchor.MiddleCenter, FontStyle.Bold);
            }
            yield return null; Canvas.ForceUpdateCanvases();
            R.SavePub(R.RenderPub(C, 2340, 1080), Out + "skins_fishing.png"); Object.Destroy(cv.gameObject);
        }

        // ------------------------------------------------------------------ spots
        static string HeroFor(string loc) => loc == "crypt" ? "knight" : loc == "cave" ? "ranger" : loc == "sewer" ? "mage" : loc == "mine" ? "knight" : "ranger";
        static string SubFor(string loc) => loc == "mine" ? "paladin" : loc == "sewer" ? "fire_wizard" : null;

        static FishSpot World(string loc)
        {
            if (loc == "town") { StTown.Lighting(); C.backgroundColor = new Color(0.62f, 0.66f, 0.74f); StTown.Build(); foreach (var f in StTown.Folk) if (f) f.Pose(f.idle, 0.3f); }
            else { StBiomes.Build(loc); C.backgroundColor = RenderSettings.fogColor; }
            return StFishSpot.Build(loc);
        }

        static void GameCam(Vector3 heroPos)
        {
            var s = FishSpot.Current; var focus = s != null ? Vector3.Lerp(s.stand, s.poolCentre, 0.5f) - new Vector3(0, 0, 1.6f) * U : heroPos;
            focus.y = 0; StScale.GameCam(C, focus);
        }

        static StUi.Hud DemoHud(string cls, string sub, bool fishing)
        {
            var l = Loadout.Default(cls, sub);
            var hud = StUi.BuildHud(C, l, new StUi.HudState { hp = 760, maxHp = 820, mana = 280, maxMana = 300, ult = 0.4f, level = 20 });
            StFishUi.FishButton(hud.canvas.transform, null, fishing ? "FISHING" : "FISH");
            return hud;
        }

        static IEnumerator Spots(bool probe)
        {
            foreach (var loc in probe ? new[] { "crypt" } : new[] { "town", "crypt", "cave", "sewer", "mine" })
            {
                Clear(); yield return null; var s = World(loc); yield return null;
                var cls = HeroFor(loc); var sub = SubFor(loc);
                // 1) approach: hero next to the marker, FISH button up
                var hero = StPhase5Shots.Hero(cls, sub, s.stand - s.facing * 1.6f * U + Vector3.Cross(Vector3.up, s.facing) * 0.6f * U, Quaternion.LookRotation(s.facing).eulerAngles.y);
                hero.Pose(hero.idle, 0.3f); yield return null; hero.Pose(hero.idle, 0.3f);
                foreach (var rp in Object.FindObjectsByType<StFishRipples>(FindObjectsSortMode.None)) rp.Draw(0.4f);
                GameCam(s.stand); var hud = DemoHud(cls, sub, false); yield return null; Canvas.ForceUpdateCanvases();
                R.SavePub(R.RenderPub(C, 2340, 1080), Out + "spots/" + loc + "_approach.png"); Object.Destroy(hud.canvas.gameObject);
                // 2) fishing: hero on the stand point, line out, bobber floating
                hero.transform.position = s.stand; hero.transform.rotation = Quaternion.LookRotation(s.facing);
                var rig = StFishRig.Equip(hero); var fx = new GameObject("fx").transform;
                rig.PoseStill(FishPose.Hold, 0.3f); StFishFx.Float(rig, s, 0.3f, fx, C, false); yield return null; rig.PoseStill(FishPose.Hold, 0.3f); StFishFx.Float(rig, s, 0.3f, fx, C, false); rig.UpdateLine();
                var fh = StFishUi.FishingHud(C, loc, 2, null); yield return null; Canvas.ForceUpdateCanvases();
                R.SavePub(R.RenderPub(C, 2340, 1080), Out + "spots/" + loc + "_gamecam.png"); Object.Destroy(fh.gameObject);
                // 3) close 3/4 view of the spot for a read on the pool/marker
                Fit(new List<Vector3> { s.stand + Vector3.up * 3.2f * U, s.poolCentre + new Vector3(s.rx, 0, s.rz), s.poolCentre - new Vector3(s.rx, 0, s.rz), s.poolCentre + Vector3.up * 2.4f * U, rig.tip.position }, 2340f / 1080f, new Vector3(0.15f, -1.0f, 1f));
                yield return null; R.SavePub(R.RenderPub(C, 2340, 1080), Out + "spots/" + loc + "_close.png"); C.ResetAspect();
                Debug.Log("[ST] p5b spot shots " + loc);
            }
        }

        // ------------------------------------------------------------------ UI
        static IEnumerator Ui()
        {
            // reel minigame (cave, ranger reeling a Crystal Puffer)
            {
                Clear(); yield return null; var s = World("cave"); var hero = StPhase5Shots.Hero("ranger", null, s.stand, Quaternion.LookRotation(s.facing).eulerAngles.y);
                var rig = StFishRig.Equip(hero); var fx = new GameObject("fx").transform; var c = StFishDb.Catches["v_puffer"];
                var g = new ReelGame(c, 11);
                // pick a frame where the marker is in the net and the meter is past half
                for (int i = 0; i < 3000 && !g.Done && !(g.InZone && g.progress > 0.58f && g.progress < 0.75f); i++) g.Step(1 / 60f, g.AutoHold());
                rig.PoseStill(FishPose.Reel, 0.3f); StFishFx.Reel(rig, s, 0.3f, g.progress, (g.fishPos - 0.5f) * 2, fx, C); yield return null; rig.PoseStill(FishPose.Reel, 0.3f); rig.UpdateLine();
                GameCam(s.stand); var p = StFishUi.BuildReel(C, c, g); StFishUi.UpdateReel(p, g, true); yield return null; Canvas.ForceUpdateCanvases();
                R.SavePub(R.RenderPub(C, 2340, 1080), Out + "ui/reel_minigame.png"); Object.Destroy(p.canvas.gameObject);
                Debug.Log("[ST] p5b reel game progress " + g.progress.ToString("0.00") + " t " + g.time.ToString("0.0"));
            }
            // bite prompt (crypt, knight)
            {
                Clear(); yield return null; var s = World("crypt"); var hero = StPhase5Shots.Hero("knight", null, s.stand, Quaternion.LookRotation(s.facing).eulerAngles.y);
                var rig = StFishRig.Equip(hero); var fx = new GameObject("fx").transform;
                rig.PoseStill(FishPose.Bite, 0.12f); StFishFx.Bite(rig, s, 0.22f, fx, C); yield return null; rig.PoseStill(FishPose.Bite, 0.12f); rig.UpdateLine();
                GameCam(s.stand); var cv = StFishUi.BitePrompt(C, C.WorldToViewportPoint(s.hotspot), 0.35f); yield return null; Canvas.ForceUpdateCanvases();
                R.SavePub(R.RenderPub(C, 2340, 1080), Out + "ui/bite_prompt.png"); Object.Destroy(cv.gameObject);
            }
            // results: Golden Koi in town, Drowned Reliquary in the crypt, Magma Swordfish in the mine, escape in the sewer
            foreach (var (loc, id, cls, sub) in new[] { ("town", "t_goldkoi", "ranger", (string)null), ("crypt", "c_reliquary", "knight", "paladin"), ("mine", "m_sword", "mage", "fire_wizard"), ("sewer", "s_shark", "mage", null) })
            {
                Clear(); yield return null; var s = World(loc); var hero = StPhase5Shots.Hero(cls, sub, s.stand, Quaternion.LookRotation(s.facing).eulerAngles.y);
                var rig = StFishRig.Equip(hero); var fx = new GameObject("fx").transform; var c = StFishDb.Catches[id]; float kg = Mathf.Lerp(c.wMin, c.wMax, 0.62f);
                bool escape = loc == "sewer"; Canvas cv;
                if (escape) { rig.PoseStill(FishPose.Bite, 0.4f); rig.lineOn = false; rig.bobber.gameObject.SetActive(false); rig.UpdateLine(); yield return null; rig.PoseStill(FishPose.Bite, 0.4f); rig.UpdateLine(); }
                else
                {
                    var item = StFishFx.Model(c, StFishFx.ShowLength(c, kg));
                    rig.PoseStill(FishPose.Show, 1f); StFishFx.Show(rig, s, 1f, item, fx, C); yield return null; rig.PoseStill(FishPose.Show, 1f); StFishFx.Show(rig, s, 1f, item, fx, C); rig.UpdateLine();
                }
                GameCam(s.stand);
                // a world-only frame of the catch on the line (no popup) for the show beat
                if (!escape)
                {
                    // close 3/4 on the hero holding up the catch (the game camera sees mostly hat)
                    var hb = new List<Vector3> { s.stand + Vector3.up * 2.4f * U, s.stand - Vector3.up * 0.05f, rig.tip.position + Vector3.up * 0.3f * U, rig.bobberPos - Vector3.up * 1.2f * U, s.stand + s.facing * 1.5f * U };
                    Fit(hb, 2340f / 1080f, new Vector3(-0.2f, -0.45f, 1f)); yield return null;
                    R.SavePub(R.RenderPub(C, 2340, 1080), Out + "ui/show_" + id + ".png"); C.ResetAspect(); GameCam(s.stand);
                }
                cv = escape ? StFishUi.Escaped(C, c, false, null) : StFishUi.Result(C, c, kg, true, 3, null);
                yield return null; Canvas.ForceUpdateCanvases();
                R.SavePub(R.RenderPub(C, 2340, 1080), Out + "ui/" + (escape ? "escaped_" : "result_") + id + ".png"); Object.Destroy(cv.gameObject);
            }
            Debug.Log("[ST] p5b ui done");
        }

        static IEnumerator Table()
        {
            Clear(); yield return null; C.backgroundColor = Color.black;
            var cv = StFishUi.CatchTable(C); yield return null; Canvas.ForceUpdateCanvases();
            R.SavePub(R.RenderPub(C, 2340, 1080), Out + "catch_table.png"); Object.Destroy(cv.gameObject);
            // roll check: 10k rolls per water, logged so the table weights are verifiable
            foreach (var l in StFishDb.LocOrder)
            {
                var rng = new System.Random(5); var n = new Dictionary<Rarity, int>();
                for (int i = 0; i < 10000; i++) { var c = StFishDb.Roll(l.id, rng, out _); n.TryGetValue(c.rarity, out var k); n[c.rarity] = k + 1; }
                var sb = new System.Text.StringBuilder(); foreach (var kv in n) sb.Append(kv.Key + "=" + (kv.Value / 100f).ToString("0.0") + "% ");
                Debug.Log("[ST] p5b rolls " + l.id + " " + sb);
            }
        }
    }
}
