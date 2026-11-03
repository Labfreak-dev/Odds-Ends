using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using Hollowmere.StyleTest.Skills;

namespace Hollowmere.StyleTest
{
    /// <summary>Attack-animation + targeting proof. -stOnly anim | an_strips | an_target   (HM_ANSKILLS=a,b limits the strips)
    /// an_strips: per attack skill an 8-frame BEFORE (phase-5 clip) and AFTER (weighted HM_* clip) strip with the same frame
    ///   times (one of them snapped to the contact frame) and the skill VFX -> anim/before_&lt;id&gt;.jpg, anim/after_&lt;id&gt;.jpg
    /// an_target: 2340x1080 game camera, crypt: a nearer foe behind a kit wall is skipped, a farther visible foe is locked
    ///   -> anim/targeting_los.png and anim/targeting_los_debug.png (sight lines + occluder boxes).</summary>
    public static class StAnimShots
    {
        static StyleTestRunner R; static Camera C; const string Out = "anim/";

        public static readonly string[] Attacks =
        {
            "k_slash", "k_whirlwind", "k_shield_bash", "k_charge", "k_slam", "k_banner", "p_consecrate", "p_judgement",
            "r_quick_shot", "r_piercing", "r_volley", "r_multishot", "r_rain", "s_snipe", "s_death_mark", "s_deadeye",
            "m_bolt", "m_chain_spark", "m_meteor", "m_frost_nova", "m_storm", "f_flame_wave", "f_living_bomb", "f_inferno",
        };

        static void Clear()
        {
            foreach (var go in Object.FindObjectsByType<GameObject>(FindObjectsSortMode.None))
                if (go.transform.parent == null && go != R.gameObject && go != C.gameObject && go.name != "Hollowmere" && go.name != "arrow_tpl" && go.name != "EventSystem") Object.Destroy(go);
            StWorld.Built.Clear(); C.orthographic = false; C.fieldOfView = 35; C.farClipPlane = 220; C.clearFlags = CameraClearFlags.SolidColor;
            foreach (Transform t in C.transform) Object.Destroy(t.gameObject);
        }

        static string OutDir()
        {
            var a = System.Environment.GetCommandLineArgs();
            for (int i = 0; i < a.Length - 1; i++) if (a[i] == "-stOut") return a[i + 1];
            return ".";
        }

        public static IEnumerator Run(StyleTestRunner r, Camera cam, string only)
        {
            R = r; C = cam;
            System.IO.Directory.CreateDirectory(System.IO.Path.Combine(OutDir(), "anim"));
            if (only == "anim" || only == "an_target") yield return Targeting();
            if (only == "anim" || only == "an_strips") yield return Strips();
        }

        // ------------------------------------------------------------------ before / after strips
        static float FirstHit(SkillDef s)
        {
            float t = 1; foreach (var e in s.effects) if (e.kind == EffectKind.Damage || e.kind == EffectKind.Status || e.kind == EffectKind.Buff) t = Mathf.Min(t, e.at);
            return t >= 1 ? 0.5f : t;
        }

        static IEnumerator Strips()
        {
            const int W = 420, H = 470, N = 8;
            var env = System.Environment.GetEnvironmentVariable("HM_ANSKILLS");
            var ids = string.IsNullOrEmpty(env) ? Attacks : env.Split(',');
            var log = new System.Text.StringBuilder();
            foreach (var id in ids)
            {
                if (!StSkillDb.Skills.TryGetValue(id.Trim(), out var s)) continue;
                // frame times: even spacing with the nearest one snapped onto the contact/release time
                var ts = new float[N]; for (int i = 0; i < N; i++) ts[i] = (i + 0.5f) / N;
                float hit = FirstHit(s); int k = Mathf.Clamp(Mathf.RoundToInt(hit * N - 0.5f), 0, N - 1); ts[k] = hit;
                log.Append(s.id).Append(' ').Append(k).Append(' ').Append(string.Join(",", System.Array.ConvertAll(ts, x => x.ToString("0.000", System.Globalization.CultureInfo.InvariantCulture)))).Append('\n');
                for (int pass = 0; pass < 2; pass++)
                {
                    Clear(); yield return null;
                    StWorld.NeutralLighting(); C.backgroundColor = new Color(0.16f, 0.17f, 0.2f);
                    var floor = GameObject.CreatePrimitive(PrimitiveType.Plane); floor.transform.localScale = new Vector3(3, 1, 3);
                    floor.GetComponent<Renderer>().sharedMaterial = StMat.Make("an_floor", null, new Color(0.36f, 0.37f, 0.42f), false);
                    var hero = StPhase5Shots.Hero(s.cls, s.subclass, Vector3.zero, 90); var fx = new GameObject("fx").transform;
                    var pal = s.palettePin ?? StSkillDb.PaletteFor(s.cls, s.subclass);
                    var ctx = VfxCtx.For(hero, fx, C, s, pal);
                    var clip = pass == 0 ? AnimMap.Legacy(s.anim) : AnimMap.ClipFor(hero, s.anim);
                    if (hero.anim.GetClip(clip) == null) Debug.LogWarning("[ST] an noclip " + s.id + " " + clip);
                    // close 3/4 framing on the hero: bow from the string-hand side so the draw to the cheek reads
                    var f = ctx.fwd; var rt = ctx.right; var o = ctx.origin;
                    bool bow = s.cls == "ranger";
                    var camPos = bow ? o + rt * 3.4f + f * 1.6f + Vector3.up * 1.7f : o + f * 3.4f + rt * 2.0f + Vector3.up * 1.9f;
                    var look = o + Vector3.up * 0.95f + f * (bow ? 0.45f : 0.55f);
                    C.fieldOfView = 38; C.transform.position = camPos; C.transform.LookAt(look);
                    C.aspect = W / (float)H;
                    var sheet = new Texture2D(W * N, H, TextureFormat.RGB24, false);
                    for (int i = 0; i < N; i++)
                    {
                        float t = ts[i];
                        StFx.Clear(fx); hero.transform.position = o; hero.Pose(clip, t); yield return null; hero.Pose(clip, t);
                        StVfx.Play(ctx, t);
                        var tile = R.RenderPub(C, W, H); sheet.SetPixels(i * W, 0, W, H, tile.GetPixels()); Object.Destroy(tile);
                    }
                    sheet.Apply(); R.SavePub(sheet, Out + (pass == 0 ? "before_" : "after_") + s.id + ".jpg", true);
                    C.ResetAspect();
                }
                Debug.Log("[ST] an strip " + s.id);
            }
            System.IO.File.WriteAllText(System.IO.Path.Combine(OutDir(), "anim/strip_times.txt"), log.ToString());
        }

        // ------------------------------------------------------------------ line-of-sight lock-on
        static IEnumerator Targeting()
        {
            for (int dbg = 0; dbg < 2; dbg++)
            {
                Clear(); yield return null;
                StBiomes.Build("crypt"); C.backgroundColor = RenderSettings.fogColor;
                var hp = StBiomes.Hero; var hero = StPhase5Shots.Hero("ranger", null, hp, 0);
                // nearer foe: 3.5 m ahead-left, a kit wall in between. farther foe: ~3.8 m ahead-right in the open (HM_ANFAR=x,z overrides).
                var near = hp + new Vector3(-3.2f, 0, 1.3f); var farOff = new Vector3(2.8f, 0, 2.6f); var fe = System.Environment.GetEnvironmentVariable("HM_ANFAR"); // "x,z" metres from the hero
                if (!string.IsNullOrEmpty(fe)) { var sp = fe.Split(','); farOff = new Vector3(float.Parse(sp[0], System.Globalization.CultureInfo.InvariantCulture), 0, float.Parse(sp[1], System.Globalization.CultureInfo.InvariantCulture)); }
                var far = hp + farOff;
                var wall = StKit.Spawn("Dungeon/wall", Vector3.zero, 90); // long axis north-south: the camera sees past its end
                var wb = StWorld.Bounds(wall); wall.transform.localScale *= 3.17f / Mathf.Max(0.01f, wb.size.y);
                var mid = hp + new Vector3(-1.6f, 0, 1.0f); wb = StWorld.Bounds(wall);
                wall.transform.position += new Vector3(mid.x - wb.center.x, hp.y - wb.min.y, mid.z - wb.center.z);
                StBiomes.Built.Add(wall.transform);
                var foes = new List<StActor>();
                foreach (var p in new[] { near, far })
                {
                    var k = StyleTestRunner.Skeleton(false, p, "Skel/Skeleton_Minion"); var d = hp - p; d.y = 0; k.transform.rotation = Quaternion.LookRotation(d);
                    k.Pose(k.idle, 0.3f); foes.Add(k);
                }
                yield return null; foreach (var k in foes) k.Pose(k.idle, 0.3f);
                var lo = Loadout.Default("ranger", null);
                var runner = StSkillRunner.Attach(hero, C, lo); runner.foes = () => foes; runner.enabled = false; // posed still: no Update
                var dbgList = new List<(StActor foe, bool visible, Vector3 hitPoint)>();
                var range = StSkillRunner.LockRange(StSkillDb.Skills[lo.basic]);
                var tgt = runner.Retarget(range);
                StTargeting.Pick(hero, foes, range, dbgList);
                var dir = tgt != null ? tgt.transform.position - hp : Vector3.forward; dir.y = 0; hero.transform.rotation = Quaternion.LookRotation(dir);
                var clip = AnimMap.ClipFor(hero, "W.QuickShot"); hero.Pose(clip, 0.33f); yield return null; hero.Pose(clip, 0.33f);
                StScale.GameCam(C, hp - new Vector3(0, 0, 1.4f)); // hero low-centre, both foes in frame
                if (runner.marker) runner.marker.Snap(C);
                Debug.Log("[ST] an target picked " + (tgt == foes[0] ? "NEAR(occluded!)" : tgt == foes[1] ? "FAR(visible)" : "none")
                          + " | " + string.Join("; ", dbgList.ConvertAll(x => (x.foe == foes[0] ? "near" : "far") + " vis=" + x.visible)));
                Canvas cv = null; StUi.Hud hud = null;
                if (dbg == 1)
                {
                    var lines = new GameObject("los_debug").transform; var a = StTargeting.Chest(hero);
                    foreach (var x in dbgList)
                    {
                        var b = StTargeting.Chest(x.foe);
                        Line(lines, a, x.visible ? b : x.hitPoint, x.visible ? new Color(0.3f, 1f, 0.35f) : new Color(1f, 0.25f, 0.2f), 0.07f);
                        if (!x.visible) { Line(lines, x.hitPoint, b, new Color(1f, 0.25f, 0.2f, 0.35f), 0.035f); Cross(lines, x.hitPoint, new Color(1f, 0.85f, 0.2f)); }
                    }
                    foreach (var bc in Object.FindObjectsByType<BoxCollider>(FindObjectsSortMode.None))
                        if (bc.gameObject.layer == StTargeting.Layer) Box(lines, bc.bounds, new Color(0.35f, 0.8f, 1f, 0.8f));
                    cv = StUi.MakeCanvas(C, "an_dbg"); var root = cv.transform;
                    StUi.Txt(root, "LOS DEBUG  ·  green = clear sight (locked)  ·  red = blocked at the yellow X (skipped)  ·  blue = occluder boxes (layer " + StTargeting.Layer + ")",
                        34, Color.white, new Vector2(0.5f, 1), new Vector2(0, -44), new Vector2(2200, 60), TextAnchor.MiddleCenter, FontStyle.Bold);
                    Label(root, near + new Vector3(-0.6f, -1.2f, 0), "nearer foe " + Dist(hp, near) + " m\nbehind wall: SKIPPED", new Color(1f, 0.45f, 0.4f));
                    Label(root, far + new Vector3(1.8f, -2.4f, -0.6f), "farther foe " + Dist(hp, far) + " m\nin sight: LOCKED", new Color(0.5f, 1f, 0.55f));
                }
                else hud = StUi.BuildHud(C, lo, new StUi.HudState { hp = 640, maxHp = 820, mana = 210, maxMana = 300, ult = 0.4f, level = 20, cdFrac = new Dictionary<string, float>(), cdSecs = new Dictionary<string, float>() });
                yield return null; if (runner.marker) runner.marker.Snap(C); Canvas.ForceUpdateCanvases();
                R.SavePub(R.RenderPub(C, 2340, 1080), Out + (dbg == 1 ? "targeting_los_debug.png" : "targeting_los.png"));
                if (cv) Object.Destroy(cv.gameObject); if (hud != null) Object.Destroy(hud.canvas.gameObject);
            }
        }

        static string Dist(Vector3 a, Vector3 b) { var d = b - a; d.y = 0; return d.magnitude.ToString("0.0", System.Globalization.CultureInfo.InvariantCulture); }

        static void Label(Transform root, Vector3 world, string s, Color c)
        {
            var vp = C.WorldToViewportPoint(world + Vector3.up * 2.4f);
            StUi.Txt(root, s, 30, c, new Vector2(vp.x, vp.y), new Vector2(0, 40), new Vector2(520, 90), TextAnchor.MiddleCenter, FontStyle.Bold);
        }

        static void Line(Transform p, Vector3 a, Vector3 b, Color c, float w)
        {
            var g = new GameObject("los_line"); g.transform.SetParent(p, false); var lr = g.AddComponent<LineRenderer>();
            lr.positionCount = 2; lr.SetPosition(0, a); lr.SetPosition(1, b); lr.widthMultiplier = w; lr.sharedMaterial = StFx.Mat(false, true);
            lr.startColor = lr.endColor = c; lr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
        }

        static void Cross(Transform p, Vector3 c, Color col)
        {
            float s = 0.25f; Line(p, c + new Vector3(-s, s, 0), c + new Vector3(s, -s, 0), col, 0.06f); Line(p, c + new Vector3(-s, -s, 0), c + new Vector3(s, s, 0), col, 0.06f);
            Line(p, c + new Vector3(0, s, -s), c + new Vector3(0, -s, s), col, 0.06f);
        }

        static void Box(Transform p, Bounds b, Color c)
        {
            var mn = b.min; var mx = b.max;
            var v = new[] { new Vector3(mn.x, mn.y, mn.z), new Vector3(mx.x, mn.y, mn.z), new Vector3(mx.x, mn.y, mx.z), new Vector3(mn.x, mn.y, mx.z),
                            new Vector3(mn.x, mx.y, mn.z), new Vector3(mx.x, mx.y, mn.z), new Vector3(mx.x, mx.y, mx.z), new Vector3(mn.x, mx.y, mx.z) };
            int[] e = { 0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7 };
            for (int i = 0; i < e.Length; i += 2) Line(p, v[e[i]], v[e[i + 1]], c, 0.03f);
        }
    }
}
