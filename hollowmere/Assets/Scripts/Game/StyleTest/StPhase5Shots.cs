using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using Hollowmere.StyleTest.Skills;

namespace Hollowmere.StyleTest
{
    /// <summary>Phase 5 proof: every skill in StSkillDb (30) as an 8-frame strip and a 2340x1080 game-camera shot with the
    /// mobile HUD, plus hud.png, loadout.png, subclass_pick.png and skins.png. -stOnly phase5 | p5_strips | p5_game | p5_ui | p5_skins | p5_probe</summary>
    public static class StPhase5Shots
    {
        static StyleTestRunner R; static Camera C; const string Out = "phase5/";

        static readonly Dictionary<string, float> ShotT = new Dictionary<string, float>
        {
            { "k_slash", 0.48f }, { "k_whirlwind", 0.62f }, { "k_shield_bash", 0.52f }, { "k_charge", 0.62f }, { "k_slam", 0.64f }, { "k_banner", 0.6f }, { "k_iron_skin", 0.32f },
            { "p_consecrate", 0.6f }, { "p_judgement", 0.64f }, { "p_divine_shield", 0.5f },
            { "r_quick_shot", 0.5f }, { "r_piercing", 0.76f }, { "r_volley", 0.66f }, { "r_roll_back", 0.45f }, { "r_multishot", 0.52f }, { "r_rain", 0.62f }, { "r_eagle_eye", 0.45f },
            { "s_snipe", 0.7f }, { "s_death_mark", 0.6f }, { "s_deadeye", 0.55f },
            { "m_bolt", 0.6f }, { "m_meteor", 0.7f }, { "m_frost_nova", 0.72f }, { "m_blink", 0.66f }, { "m_chain_spark", 0.62f }, { "m_storm", 0.6f }, { "m_mana_flow", 0.5f },
            { "f_flame_wave", 0.6f }, { "f_living_bomb", 0.6f }, { "f_inferno", 0.62f },
        };

        static readonly Dictionary<string, string> Biome = new Dictionary<string, string> { { "knight", "crypt" }, { "ranger", "cave" }, { "mage", "sewer" }, { "paladin", "crypt" }, { "sharpshooter", "cave" }, { "fire_wizard", "mine" } };

        static void Clear()
        {
            foreach (var go in Object.FindObjectsByType<GameObject>(FindObjectsSortMode.None))
                if (go.transform.parent == null && go != R.gameObject && go != C.gameObject && go.name != "Hollowmere" && go.name != "arrow_tpl" && go.name != "EventSystem") Object.Destroy(go);
            StWorld.Built.Clear(); C.orthographic = false; C.fieldOfView = 35; C.farClipPlane = 220; C.clearFlags = CameraClearFlags.SolidColor;
            foreach (Transform t in C.transform) Object.Destroy(t.gameObject);
        }

        public static StActor Hero(string cls, string sub, Vector3 p, float yaw)
        {
            var a = StSkillDb.Classes[cls].look().Build(p, yaw);
            if (!string.IsNullOrEmpty(sub)) StSkins.Apply(a, sub);
            return a;
        }

        public static IEnumerator Run(StyleTestRunner r, Camera cam, string only)
        {
            R = r; C = cam;
            var probe = only == "p5_probe";
            Debug.Log("[ST] p5 skills " + StSkillDb.Order.Count + " subclasses " + StSkillDb.SubclassOrder.Count);
            if (only == "phase5" || only == "p5_ui" || probe) yield return Ui();
            if (only == "phase5" || only == "p5_skins" || probe) yield return Skins();
            if (only == "phase5" || only == "p5_strips" || probe) yield return Strips(probe);
            if (only == "phase5" || only == "p5_game" || probe) yield return GameCams(probe);
        }

        static List<SkillDef> Pick(bool probe)
        {
            if (!probe) return StSkillDb.Order;
            var ids = (System.Environment.GetEnvironmentVariable("HM_P5SKILLS") ?? "k_shield_bash,r_quick_shot,m_meteor,f_flame_wave").Split(',');
            var l = new List<SkillDef>(); foreach (var i in ids) if (StSkillDb.Skills.TryGetValue(i.Trim(), out var s)) l.Add(s); return l;
        }

        // ------------------------------------------------------------------ strips
        static void Extents(SkillDef s, out float back, out float fwd, out float side, out float top)
        {
            back = -1.3f; fwd = 1.6f; side = 1.4f; top = 3.5f; var td = s.telegraph;
            if (td != null)
            {
                if (td.atAim) { fwd = Mathf.Max(fwd, s.range + td.size); back = Mathf.Min(back, s.range - td.size); side = Mathf.Max(side, td.size); }
                else if (td.shape == StFx.Shape.Circle || td.shape == StFx.Shape.Ring) { fwd = Mathf.Max(fwd, td.size); back = Mathf.Min(back, -td.size); side = Mathf.Max(side, td.size); }
                else if (td.shape == StFx.Shape.Cone) { fwd = Mathf.Max(fwd, td.size); side = Mathf.Max(side, td.size * Mathf.Sin(td.angle * 0.5f * Mathf.Deg2Rad)); }
                else { fwd = Mathf.Max(fwd, td.size); side = Mathf.Max(side, td.width); }
            }
            else if (s.range > 0) fwd = Mathf.Max(fwd, s.range + 1f);
            if (s.vfx != null) foreach (var st in s.vfx.steps)
            {
                if (st.kind == Vk.Dash || st.kind == Vk.Blink) { fwd = Mathf.Max(fwd, st.off.z + 1.3f); back = Mathf.Min(back, st.off.z - 1.3f); }
                if (st.kind == Vk.RuneRing || st.kind == Vk.Motes) side = Mathf.Max(side, Mathf.Min(st.size, 4f));
                if (st.kind == Vk.Pillar || st.kind == Vk.Meteor || st.kind == Vk.Hammer || st.kind == Vk.Banner) top = 5.2f;
            }
            fwd = Mathf.Min(fwd, 8.5f); back = Mathf.Max(back, -5.5f); side = Mathf.Min(side, 4.6f);
        }

        /// <summary>Tight framing: fixed 3/4 view, distance solved so the hero + the skill's area just fit (hero bigger than phase 4).</summary>
        static void Frame(Camera cam, Vector3 origin, Vector3 fwd, Vector3 right, SkillDef s, float aspect)
        {
            Extents(s, out var back, out var f, out var side, out var top);
            var pts = new List<Vector3>();
            // floor outline of the skill's real area (telegraph shape sampled) instead of a box -> tighter, bigger hero
            var td = s.telegraph; System.Func<float, float, Vector3> L = (x, z) => origin + fwd * x + right * z;
            if (td != null)
            {
                var c0 = td.atAim ? fwd * s.range : Vector3.zero;
                for (int i = 0; i < 16; i++)
                {
                    float a = i * 22.5f * Mathf.Deg2Rad;
                    if (td.shape == StFx.Shape.Cone) { float aa = Mathf.Lerp(-td.angle / 2, td.angle / 2, i / 15f) * Mathf.Deg2Rad; pts.Add(origin + (fwd * Mathf.Cos(aa) + right * Mathf.Sin(aa)) * td.size); }
                    else if (td.shape == StFx.Shape.Line) { pts.Add(L(Mathf.Min(td.size, 8.5f) * (i % 2), (i < 8 ? -1 : 1) * td.width / 2)); }
                    else { var sz = Mathf.Min(td.size, 4.6f); pts.Add(origin + c0 + (fwd * Mathf.Cos(a) + right * Mathf.Sin(a)) * sz); }
                }
            }
            pts.Add(L(f, 0)); pts.Add(L(back, 0));
            if (side > 1.5f && td == null) { pts.Add(L(0, side)); pts.Add(L(0, -side)); }
            if (top > 4f) pts.Add(L(Mathf.Max(0, f - 2), 0) + Vector3.up * top);
            // always keep the whole hero in
            foreach (var x in new[] { -0.9f, 0.9f }) foreach (var y in new[] { 0f, 3.3f }) pts.Add(origin + fwd * x + Vector3.up * y);
            var centre = Vector3.zero; foreach (var p in pts) centre += p; centre /= pts.Count;
            cam.transform.rotation = Quaternion.LookRotation(fwd * 0.12f + Vector3.forward, Vector3.up) * Quaternion.Euler(24, 0, 0);
            cam.aspect = aspect; float lo = 2, hi = 60;
            for (int it = 0; it < 24; it++)
            {
                float d = (lo + hi) / 2; cam.transform.position = centre - cam.transform.forward * d; bool ok = true;
                foreach (var p in pts) { var v = cam.WorldToViewportPoint(p); if (v.z < 0.5f || v.x < 0.04f || v.x > 0.96f || v.y < 0.04f || v.y > 0.96f) { ok = false; break; } }
                if (ok) hi = d; else lo = d;
            }
            cam.transform.position = centre - cam.transform.forward * hi;
            // re-centre on the projected box (the perspective centre is not the box centre)
            float minx = 1, maxx = 0, miny = 1, maxy = 0;
            foreach (var p in pts) { var v = cam.WorldToViewportPoint(p); minx = Mathf.Min(minx, v.x); maxx = Mathf.Max(maxx, v.x); miny = Mathf.Min(miny, v.y); maxy = Mathf.Max(maxy, v.y); }
            var ray = cam.ViewportPointToRay(new Vector3((minx + maxx) / 2, (miny + maxy) / 2, 0));
            var shift = (ray.GetPoint(hi) - (cam.transform.position + cam.transform.forward * hi)); cam.transform.position += shift;
        }

        static List<StActor> Dummies(SkillDef s, VfxCtx ctx)
        {
            var l = new List<StActor>();
            if (s.range <= 0 || s.targeting == Targeting.Self || s.slot == SlotType.Passive) return l;
            var spots = new List<Vector3> { ctx.aim };
            if (s.id == "m_chain_spark") { spots.Add(ctx.aim + ctx.Local(new Vector3(2.2f, 0, 1.6f))); spots.Add(ctx.aim + ctx.Local(new Vector3(-1.8f, 0, 2.6f))); }
            if (s.id == "s_deadeye") { spots.Add(ctx.aim + ctx.Local(new Vector3(-1.6f, 0, -1f))); spots.Add(ctx.aim + ctx.Local(new Vector3(1.8f, 0, 1.2f))); }
            if (s.id == "r_multishot") { spots.Add(ctx.origin + Quaternion.Euler(0, 20, 0) * ctx.fwd * 5.5f); spots.Add(ctx.origin + Quaternion.Euler(0, -18, 0) * ctx.fwd * 6.2f); }
            if (s.id == "k_charge" || s.id == "m_blink") spots[0] = ctx.origin + ctx.fwd * (s.range + 1.6f);
            foreach (var p in spots)
            {
                var k = StyleTestRunner.Skeleton(false, p, "Skel/Skeleton_Minion"); var d = ctx.origin - p; d.y = 0; k.transform.rotation = Quaternion.LookRotation(d);
                k.Pose(k.idle, 0.3f); l.Add(k);
            }
            return l;
        }

        static IEnumerator Strips(bool probe)
        {
            const int W = 560, H = 420, N = 8;
            foreach (var s in Pick(probe))
            {
                Clear(); yield return null;
                StWorld.NeutralLighting(); C.backgroundColor = new Color(0.16f, 0.17f, 0.2f);
                var floor = GameObject.CreatePrimitive(PrimitiveType.Plane); floor.transform.localScale = new Vector3(8, 1, 8); floor.transform.position = new Vector3(3, 0, 0);
                floor.GetComponent<Renderer>().sharedMaterial = StMat.Make("p5_floor", null, new Color(0.36f, 0.37f, 0.42f), false);
                var hero = Hero(s.cls, s.subclass, Vector3.zero, 90); var fx = new GameObject("fx").transform;
                var pal = s.palettePin ?? StSkillDb.PaletteFor(s.cls, s.subclass);
                var ctx = VfxCtx.For(hero, fx, C, s, pal);
                Dummies(s, ctx);
                Frame(C, ctx.origin, ctx.fwd, ctx.right, s, W / (float)H);
                var clip = AnimMap.Clip(s.anim); if (hero.anim.GetClip(clip) == null) Debug.LogWarning("[ST] p5 noclip " + s.id + " " + clip);
                var sheet = new Texture2D(W * N, H, TextureFormat.RGB24, false);
                for (int f = 0; f < N; f++)
                {
                    float t = (f + 0.5f) / N;
                    StFx.Clear(fx); hero.transform.position = ctx.origin; hero.Pose(clip, t); yield return null; hero.Pose(clip, t);
                    StVfx.Play(ctx, t);
                    var tile = R.RenderPub(C, W, H); sheet.SetPixels(f * W, 0, W, H, tile.GetPixels()); Object.Destroy(tile);
                }
                sheet.Apply(); R.SavePub(sheet, Out + "strips/" + s.id + ".jpg", true);
                C.ResetAspect();
                Debug.Log("[ST] p5 strip " + s.id);
            }
        }

        // ------------------------------------------------------------------ game camera
        static Loadout LoadoutWith(SkillDef s)
        {
            var l = Loadout.Default(s.cls, s.subclass);
            if (s.slot == SlotType.Active && System.Array.IndexOf(l.actives, s.id) < 0) l.actives[0] = s.id;
            if (s.slot == SlotType.Ultimate) l.ultimate = s.id;
            if (s.slot == SlotType.Passive) l.passive = s.id;
            return l;
        }

        static StUi.HudState DemoState(Loadout l, string casting, float ult)
        {
            var st = new StUi.HudState { hp = 640, maxHp = 820, mana = 210, maxMana = 300, ult = ult, level = 20, cdFrac = new Dictionary<string, float>(), cdSecs = new Dictionary<string, float>() };
            var fr = new[] { 0f, 0.62f, 0f, 0.25f };
            for (int i = 0; i < 4; i++)
            {
                var id = l.actives[i]; if (string.IsNullOrEmpty(id)) continue; var sk = StSkillDb.Skills[id];
                float f = id == casting ? 0.93f : fr[i]; st.cdFrac[id] = f; st.cdSecs[id] = f * sk.cooldown;
            }
            return st;
        }

        static IEnumerator GameCams(bool probe)
        {
            foreach (var s in Pick(probe))
            {
                Clear(); yield return null;
                var biome = Biome[s.subclass ?? s.cls]; StBiomes.Build(biome); C.backgroundColor = RenderSettings.fogColor;
                var hp = StBiomes.Hero; var hero = Hero(s.cls, s.subclass, hp, biome == "crypt" ? 30 : 0);
                var fx = new GameObject("fx").transform; var pal = s.palettePin ?? StSkillDb.PaletteFor(s.cls, s.subclass);
                var ctx = VfxCtx.For(hero, fx, C, s, pal);
                var ros = StBestiary.Rosters[biome];
                var spots = new List<Vector3> { new Vector3(-1.5f, 0, 7.5f), new Vector3(1.8f, 0, 6.5f), new Vector3(0.2f, 0, 9.0f), new Vector3(-4f, 0, 4f), new Vector3(3.8f, 0, 3.2f) };
                bool aimed = s.range > 0 && s.targeting != Targeting.Self && s.slot != SlotType.Passive;
                if (aimed) { spots.RemoveAll(p => (hp + p - ctx.aim).magnitude < 1.8f); spots.Insert(0, ctx.aim - hp); }
                if (s.id == "m_chain_spark") { spots.Add(ctx.aim - hp + new Vector3(2.2f, 0, 1.6f)); spots.Add(ctx.aim - hp + new Vector3(-1.8f, 0, 2.6f)); }
                if (s.id == "k_charge" || s.id == "m_blink") spots[0] = ctx.origin + ctx.fwd * (s.range + 1.8f) - hp;
                for (int i = 0; i < spots.Count; i++)
                {
                    var m = StBestiary.Spawn(ros[i % 5], hp + spots[i], 180); if (m && m.anim && m.anim.GetClip(m.run) != null) m.Pose(m.run, 0.2f * i);
                }
                C.fieldOfView = 35; var tgt = hp + new Vector3(0, 1.2f, 3.5f);
                C.transform.position = tgt + Quaternion.Euler(52, 0, 0) * new Vector3(0, 0, -17f); C.transform.rotation = Quaternion.Euler(52, 0, 0);
                float t = ShotT.TryGetValue(s.id, out var tt) ? tt : 0.6f; var clip = AnimMap.Clip(s.anim);
                hero.Pose(clip, t); yield return null; hero.Pose(clip, t);
                StVfx.Play(ctx, t);
                var l = LoadoutWith(s); var hud = StUi.BuildHud(C, l, DemoState(l, s.id, s.slot == SlotType.Ultimate ? 0 : 0.7f));
                yield return null; Canvas.ForceUpdateCanvases();
                R.SavePub(R.RenderPub(C, 2340, 1080), Out + "gamecam/" + s.id + ".png");
                Object.Destroy(hud.canvas.gameObject);
                Debug.Log("[ST] p5 game " + s.id + " " + biome);
            }
        }

        // ------------------------------------------------------------------ UI screens
        static Texture2D Portrait(string cls, string sub, int w, int h, Color bg, float yaw = 200)
        {
            StWorld.NeutralLighting(); C.backgroundColor = bg;
            var a = Hero(cls, sub, new Vector3(0, 0, 0), yaw); a.Pose(a.idle, 0.3f);
            C.fieldOfView = 30; C.transform.position = new Vector3(0, 2.0f, -6.6f); C.transform.LookAt(new Vector3(0, 1.55f, 0));
            C.aspect = w / (float)h; var t = R.RenderPub(C, w, h); C.ResetAspect(); return t;
        }

        static IEnumerator Ui()
        {
            // portraits for the pick screen + loadout
            var ports = new Dictionary<string, Texture>();
            foreach (var sub in new[] { "paladin", "sharpshooter", "fire_wizard" })
            {
                var sd = StSkillDb.Subclasses[sub]; Clear(); yield return null;
                ports[sub] = Portrait(sd.cls, sub, 150, 170, new Color(0.13f, 0.13f, 0.16f)); yield return null;
            }
            // 1. subclass pick
            Clear(); yield return null; C.backgroundColor = Color.black;
            var pick = StUi.BuildSubclassPick(C, 20, "paladin", ports); yield return null; Canvas.ForceUpdateCanvases();
            R.SavePub(R.RenderPub(C, 2340, 1080), Out + "subclass_pick.png"); Object.Destroy(pick.gameObject);
            // 2. loadout (Paladin, Shield Bash selected -> the active slots it can go into are highlighted)
            Clear(); yield return null; var port = Portrait("knight", "paladin", 520, 600, new Color(0.1f, 0.1f, 0.13f)); yield return null;
            Clear(); yield return null; C.backgroundColor = Color.black;
            var l = Loadout.Default("knight", "paladin");
            var ls = StUi.BuildLoadout(C, l, 20, port, "k_shield_bash"); yield return null; Canvas.ForceUpdateCanvases();
            R.SavePub(R.RenderPub(C, 2340, 1080), Out + "loadout.png"); Object.Destroy(ls.canvas.gameObject);
            // 3. HUD in a fight (Fire Wizard, mine): flame wave mid-cast, cooldowns ticking, ultimate charged
            Clear(); yield return null;
            StBiomes.Build("mine"); C.backgroundColor = RenderSettings.fogColor;
            var hp = StBiomes.Hero; var hero = Hero("mage", "fire_wizard", hp, 0); var s = StSkillDb.Skills["f_flame_wave"];
            var fx = new GameObject("fx").transform; var ctx = VfxCtx.For(hero, fx, C, s, StSkillDb.PaletteFor("mage", "fire_wizard"));
            var ros = StBestiary.Rosters["mine"]; var spots = new[] { new Vector3(-1.5f, 0, 5.5f), new Vector3(1.8f, 0, 4.8f), new Vector3(0.2f, 0, 7.5f), new Vector3(-4f, 0, 4f), new Vector3(3.8f, 0, 3.2f) };
            for (int i = 0; i < spots.Length; i++) { var m = StBestiary.Spawn(ros[i % 5], hp + spots[i], 180); if (m && m.anim && m.anim.GetClip(m.run) != null) m.Pose(m.run, 0.2f * i); }
            C.fieldOfView = 35; var tgt = hp + new Vector3(0, 1.2f, 3.5f);
            C.transform.position = tgt + Quaternion.Euler(52, 0, 0) * new Vector3(0, 0, -17f); C.transform.rotation = Quaternion.Euler(52, 0, 0);
            var clip = AnimMap.Clip(s.anim); hero.Pose(clip, 0.55f); yield return null; hero.Pose(clip, 0.55f); StVfx.Play(ctx, 0.55f);
            var lo = Loadout.Default("mage", "fire_wizard"); var hud = StUi.BuildHud(C, lo, DemoState(lo, "f_flame_wave", 1f));
            yield return null; Canvas.ForceUpdateCanvases();
            R.SavePub(R.RenderPub(C, 2340, 1080), Out + "hud.png"); Object.Destroy(hud.canvas.gameObject);
            Debug.Log("[ST] p5 ui done");
        }

        // ------------------------------------------------------------------ skins lineup
        static IEnumerator Skins()
        {
            Clear(); yield return null;
            StWorld.NeutralLighting(); C.backgroundColor = new Color(0.2f, 0.21f, 0.24f);
            var floor = GameObject.CreatePrimitive(PrimitiveType.Plane); floor.transform.localScale = new Vector3(6, 1, 6);
            floor.GetComponent<Renderer>().sharedMaterial = StMat.Make("p5_floor", null, new Color(0.36f, 0.37f, 0.42f), false);
            var lineup = new[] { ("knight", (string)null), ("knight", "paladin"), ("ranger", null), ("ranger", "sharpshooter"), ("mage", null), ("mage", "fire_wizard") };
            for (int i = 0; i < lineup.Length; i++)
            {
                float x = (i - 2.5f) * 3.0f + (i / 2 - 1) * 1.2f;
                var a = Hero(lineup[i].Item1, lineup[i].Item2, new Vector3(x, 0, 0), 200); a.Pose(a.idle, 0.3f);
            }
            C.fieldOfView = 30; C.transform.position = new Vector3(0, 4.6f, -20f); C.transform.LookAt(new Vector3(0, 1.6f, 0));
            var cv = StUi.MakeCanvas(C, "p5_skins_ui"); var root = cv.transform;
            StUi.Txt(root, "SUBCLASS OUTFIT SKINS  ·  palette recolours of the KayKit outfits (no new models)", 40, Color.white, new Vector2(0.5f, 1), new Vector2(0, -40), new Vector2(2000, 60), TextAnchor.MiddleCenter, FontStyle.Bold);
            var labels = new[] { "Knight", "Paladin", "Ranger", "Sharpshooter", "Mage", "Fire Wizard" };
            yield return null;
            for (int i = 0; i < lineup.Length; i++)
            {
                float x = (i - 2.5f) * 3.0f + (i / 2 - 1) * 1.2f; var vp = C.WorldToViewportPoint(new Vector3(x, 0, 0));
                var t = StUi.Txt(root, labels[i] + (lineup[i].Item2 != null ? "\n(subclass skin)" : "\n(base)"), 34, i % 2 == 1 ? new Color(1f, 0.82f, 0.38f) : Color.white,
                    new Vector2(vp.x, 0), new Vector2(0, 150), new Vector2(380, 100), TextAnchor.MiddleCenter, FontStyle.Bold);
                if (lineup[i].Item2 != null) StUi.Swatches(root, StSkillDb.Subclasses[lineup[i].Item2].palette, new Vector2(vp.x, 0), new Vector2(0, 70), 40);
            }
            yield return null; Canvas.ForceUpdateCanvases();
            R.SavePub(R.RenderPub(C, 2340, 1080), Out + "skins.png"); Object.Destroy(cv.gameObject);
        }
    }
}
