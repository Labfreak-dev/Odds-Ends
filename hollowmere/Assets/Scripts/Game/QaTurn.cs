using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Hollowmere.Core;
using UnityEngine;

namespace Hollowmere
{
    /// <summary>
    ///   Hollowmere -qaShot turn
    /// Full-body turnarounds (front, 3/4 front, side, back, 3/4 back) on a neutral lit backdrop, one image per outfit:
    /// starter + every family at t1/t2/t3, each with a different weapon type. Then per family (top tier) the live game
    /// camera at idle / mid-run / mid-attack, 2340x1080. Then the armoured skeleton turnaround.
    /// Writes qa-turn-&lt;tag&gt;.png and qa-turncam-&lt;family&gt;-&lt;state&gt;.png.
    /// </summary>
    public static partial class QaFrames
    {
        const int TurnLayer = 31;
        const int PanelW = 760, PanelH = 1400;

        static readonly (EquipSlot slot, string id)[] TurnPieces =
        {
            (EquipSlot.Head, "helm"), (EquipSlot.Shoulders, "pauldrons"), (EquipSlot.Chest, "plate"),
            (EquipSlot.Hands, "gauntlets"), (EquipSlot.Wrists, "bracers"), (EquipSlot.Waist, "belt"),
            (EquipSlot.Legs, "greaves"), (EquipSlot.Feet, "boots"),
        };

        public static IEnumerator RunTurn(GameManager gm)
        {
            gm.State = GameManager.MakeCustom("Aldric", 2, 2, 1, 1, 0.85f, 0.85f, 0.88f, PetSpecies.Hound, "Mossy", 1, 0, true);
            gm.EnterTown(false);
            Screen.SetResolution(2340, 1080, FullScreenMode.Windowed);
            yield return new WaitForSecondsRealtime(1.0f);
            var actor = HeroActor.I;
            if (actor == null) { Debug.LogError("Hollowmere turn FAIL no hero"); Application.Quit(); yield break; }
            var types = GearTable.WeaponTypes.Where(t => t != "shield" && t != "quiver" && t != "orb").ToList();
            Debug.Log("Hollowmere turn weapon types " + string.Join(",", types));
            int wi = 0;
            string only = Environment.GetEnvironmentVariable("HM_TURNONLY");

            // Starter: the fresh hero's own clothes plus a weapon.
            var h = gm.State.hero;
            h.equipment[(int)EquipSlot.MainHand] = null; h.equipment[(int)EquipSlot.OffHand] = null;
            string wt = types[wi++ % types.Count];
            TurnWeapon(gm, wt);
            yield return null;
            yield return TurnShot(actor, "00-starter-" + wt);

            int n = 1;
            foreach (var fam in GearTable.Families)
                foreach (int t in new[] { 1, 2, GearTable.TierCount })
                {
                    wt = types[wi++ % types.Count];
                    if ((!string.IsNullOrEmpty(only) && fam != only) || Environment.GetEnvironmentVariable("HM_TURNCAMONLY") == "1") { n++; continue; }
                    WearFamily(gm, TurnPieces, fam, t, t == 1 ? Rarity.Common : t == 2 ? Rarity.Rare : Rarity.Legendary);
                    TurnWeapon(gm, wt);
                    yield return null;
                    yield return TurnShot(actor, n.ToString("00") + "-" + fam + "-t" + t + "-" + wt);
                    n++;
                }

            // Live game camera per family, in dungeon floor 1 (skills are blocked in town).
            gm.EnterFloor(1);
            yield return new WaitForSecondsRealtime(2.0f);
            actor = HeroActor.I;
            wi = 0;
            foreach (var fam in GearTable.Families)
            {
                wi += 3; wt = types[wi % types.Count];
                if (!string.IsNullOrEmpty(only) && fam != only) continue;
                WearFamily(gm, TurnPieces, fam, GearTable.TierCount, Rarity.Legendary);
                TurnWeapon(gm, wt);
                yield return TurnCam(actor, fam + "-t" + GearTable.TierCount + "-" + wt);
            }

            yield return TurnSkeleton(actor);
            Debug.Log("Hollowmere QA turn done");
            Application.Quit();
        }

        static void TurnWeapon(GameManager gm, string type)
        {
            var hero = gm.State.hero;
            hero.equipment[(int)EquipSlot.MainHand] = null;
            hero.equipment[(int)EquipSlot.OffHand] = null;
            string id = GearTable.Signature(type);
            var it = Loot.Generate(new Rng(5), 14, Rarity.Rare, null, null, id, 8);
            if (it == null || !hero.AddItem(it) || !hero.Equip(it))
                Debug.LogError("Hollowmere turn FAIL equip weapon " + type + " " + id);
            gm.OnEquipmentChanged();
        }

        static Bounds TurnBounds(Transform root)
        {
            var b = new Bounds(root.position + Vector3.up, Vector3.one * 0.1f);
            bool any = false;
            foreach (var r in root.GetComponentsInChildren<Renderer>())
            {
                if (!r.enabled || !(r is SkinnedMeshRenderer || r.name.StartsWith("gear_") || r.name.StartsWith("hm_"))) continue;
                if (r.bounds.size.x > 1.9f || r.bounds.size.z > 1.9f) { Debug.Log("Hollowmere turn skip bounds " + r.name + " " + r.bounds.size.ToString("F2")); continue; }
                if (!any) { b = r.bounds; any = true; } else b.Encapsulate(r.bounds);
            }
            return b;
        }

        static IEnumerator TurnShot(HeroActor actor, string tag)
        {
            yield return new WaitForSeconds(0.6f);
            yield return new WaitForEndOfFrame();
            TurnRender(actor.transform, tag, true);
        }

        /// <summary>Five views of one root on a neutral backdrop with its own key/fill/rim, saved as one wide PNG.</summary>
        static void TurnRender(Transform root, string tag, bool hero, Action pose = null, Transform focus = null, float focusSize = 0f)
        {
            var saved = new Dictionary<GameObject, int>();
            foreach (var t in root.GetComponentsInChildren<Transform>(true))
            {
                bool skip = t.GetComponent<ParticleSystemRenderer>() != null;
                for (var q = t; q != null && q != root; q = q.parent) if (q.name.Contains("heroRing") || q.name.Contains("Ring") || q.name.Contains("shadow") || q.name.Contains("Shadow")) skip = true;
                if (skip) continue;
                saved[t.gameObject] = t.gameObject.layer; t.gameObject.layer = TurnLayer;
            }
            var cam = Camera.main;
            var go = cam.gameObject;
            var rigC = cam.GetComponent<CameraRig>(); bool rigOn = rigC != null && rigC.enabled; if (rigC != null) rigC.enabled = false;
            var sPos = go.transform.position; var sRot = go.transform.rotation; int sMask = cam.cullingMask; var sClear = cam.clearFlags; var sBg = cam.backgroundColor;
            float sFov = cam.fieldOfView, sNear = cam.nearClipPlane, sFar = cam.farClipPlane;
            cam.cullingMask = 1 << TurnLayer;
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = new Color(0.50f, 0.51f, 0.53f);
            cam.fieldOfView = 22f; cam.nearClipPlane = 0.05f; cam.farClipPlane = 60f;
            cam.allowHDR = false; cam.allowMSAA = true;
            var rt = new RenderTexture(PanelW, PanelH, 24, RenderTextureFormat.ARGB32) ;
            cam.targetTexture = rt;
            var lights = new List<Light>();
            Light L(float i, Color c) { var lg = new GameObject("turnLight").AddComponent<Light>(); lg.type = LightType.Directional; lg.intensity = i; lg.color = c; lg.cullingMask = 1 << TurnLayer; lg.shadows = LightShadows.None; lights.Add(lg); return lg; }
            var key = L(1.6f, new Color(1f, 0.97f, 0.92f)); var fill = L(0.8f, new Color(0.85f, 0.9f, 1f)); var rim = L(0.7f, Color.white);
            var amb = RenderSettings.ambientLight; var ambMode = RenderSettings.ambientMode;
            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Flat; RenderSettings.ambientLight = new Color(0.55f, 0.55f, 0.57f);
            pose?.Invoke();
            var b = TurnBounds(root);
            if (focus != null) b = new Bounds(focus.position, Vector3.one * focusSize);
            float hgt = Mathf.Max(b.size.y, b.size.x * PanelH / (float)PanelW * 0.8f, b.size.z * PanelH / (float)PanelW * 0.8f) * 1.12f;
            float dist = hgt * 0.5f / Mathf.Tan(cam.fieldOfView * 0.5f * Mathf.Deg2Rad);
            Debug.Log("Hollowmere turn " + tag + " bounds=" + b.size.ToString("F2"));
            var outTex = new Texture2D(PanelW * 5, PanelH, TextureFormat.RGB24, false);
            float[] yaws = { 0f, 45f, 90f, 180f, 135f };
            var an = root.GetComponentInChildren<Animation>();
            var fwd = Vector3.ProjectOnPlane((an != null ? an.transform : root).forward, Vector3.up).normalized;
            Debug.Log("Hollowmere turn fwd root=" + root.forward.ToString("F2") + " model=" + fwd.ToString("F2"));
            for (int v = 0; v < 5; v++)
            {
                var dir = Quaternion.AngleAxis(yaws[v], Vector3.up) * fwd;
                var look = b.center;
                go.transform.position = look + dir * dist + Vector3.up * hgt * 0.04f;
                go.transform.rotation = Quaternion.LookRotation(look - go.transform.position, Vector3.up);
                key.transform.rotation = go.transform.rotation * Quaternion.Euler(30f, -35f, 0f);
                fill.transform.rotation = go.transform.rotation * Quaternion.Euler(10f, 45f, 0f);
                rim.transform.rotation = Quaternion.LookRotation(-dir + Vector3.down * 0.5f);
                pose?.Invoke();
                cam.Render();
                var prev = RenderTexture.active; RenderTexture.active = rt;
                outTex.ReadPixels(new Rect(0, 0, PanelW, PanelH), v * PanelW, 0);
                RenderTexture.active = prev;
            }
            outTex.Apply();
            var path = Path.Combine(Directory.GetCurrentDirectory(), "qa-turn-" + tag + ".png");
            File.WriteAllBytes(path, outTex.EncodeToPNG());
            Debug.Log("Hollowmere QA frame saved: " + path);
            UnityEngine.Object.Destroy(outTex);
            cam.targetTexture = null; rt.Release(); UnityEngine.Object.Destroy(rt);
            foreach (var lg in lights) UnityEngine.Object.Destroy(lg.gameObject);
            go.transform.SetPositionAndRotation(sPos, sRot); cam.cullingMask = sMask; cam.clearFlags = sClear; cam.backgroundColor = sBg;
            cam.fieldOfView = sFov; cam.nearClipPlane = sNear; cam.farClipPlane = sFar; if (rigC != null) rigC.enabled = rigOn;
            RenderSettings.ambientLight = amb; RenderSettings.ambientMode = ambMode;
            foreach (var kv in saved) if (kv.Key != null) kv.Key.layer = kv.Value;
        }

        /// <summary>The same game camera, same position and angle, zoomed onto the hero (FOV / 3.4) so leather texture,
        /// seams and stitching can be judged at phone scale. Rendered off-screen in the same frame, no UI.</summary>
        static void ZoomCam(HeroActor actor, string name)
        {
            var cam = Camera.main;
            if (cam == null || actor == null) return;
            var t = cam.transform; var p0 = t.position; var r0 = t.rotation; float f0 = cam.fieldOfView;
            var rt = new RenderTexture(1200, 1200, 24); var prev = cam.targetTexture;
            try
            {
                t.rotation = Quaternion.LookRotation(actor.transform.position + Vector3.up * 0.95f - p0, Vector3.up);
                cam.fieldOfView = f0 / 3.4f; cam.targetTexture = rt; cam.Render();
                var a = RenderTexture.active; RenderTexture.active = rt;
                var tex = new Texture2D(rt.width, rt.height, TextureFormat.RGB24, false);
                tex.ReadPixels(new Rect(0, 0, rt.width, rt.height), 0, 0); tex.Apply(); RenderTexture.active = a;
                var path = Path.Combine(Directory.GetCurrentDirectory(), "qa-" + name + ".png");
                File.WriteAllBytes(path, tex.EncodeToPNG()); UnityEngine.Object.Destroy(tex);
                Debug.Log("Hollowmere QA frame saved: " + path);
            }
            finally
            {
                cam.targetTexture = prev; t.SetPositionAndRotation(p0, r0); cam.fieldOfView = f0;
                rt.Release(); UnityEngine.Object.Destroy(rt);
            }
        }

        static IEnumerator TurnCam(HeroActor actor, string tag)
        {
            var joy = UnityEngine.Object.FindFirstObjectByType<Joystick>();
            if (joy != null) joy.Value = Vector2.zero;
            yield return new WaitForSeconds(1.2f);
            yield return new WaitForEndOfFrame();
            SaveNamed("turncam-" + tag + "-idle");
            ZoomCam(actor, "turncam-" + tag + "-idle-zoom");
            if (joy != null) joy.Value = new Vector2(0.3f, 0.95f);
            yield return new WaitForSeconds(0.9f);
            yield return new WaitForEndOfFrame();
            SaveNamed("turncam-" + tag + "-run");
            ZoomCam(actor, "turncam-" + tag + "-run-zoom");
            if (joy != null) joy.Value = Vector2.zero;
            yield return new WaitForSeconds(0.8f);
            bool used = false;
            var bar = actor.Hero.skills.bar;
            for (int si = 0; si < bar.Length && !used; si++)
            {
                try { var sd = SkillDb.Get(bar[si]); if (sd != null && sd.primary) used = actor.UseSkill(sd); } catch (Exception e) { Debug.Log("Hollowmere turn skill err " + e.Message); }
            }
            for (int si = 0; si < bar.Length && !used; si++)
            {
                try { used = actor.UseSkillSlot(si); if (used) Debug.Log("Hollowmere turn used slot " + si + " " + bar[si]); } catch (Exception e) { Debug.Log("Hollowmere turn skill err " + e.Message); }
            }
            if (!used) { var ma = actor.GetComponentInChildren<ModelAnim>(); if (ma != null) ma.BeginAttack(false, 0.9f); }
            Debug.Log("Hollowmere turn attack " + tag + " skill=" + used);
            yield return new WaitForSeconds(0.22f);
            yield return new WaitForEndOfFrame();
            SaveNamed("turncam-" + tag + "-attack");
            ZoomCam(actor, "turncam-" + tag + "-attack-zoom");
            yield return new WaitForSeconds(0.18f);
            yield return new WaitForEndOfFrame();
            SaveNamed("turncam-" + tag + "-attack-late");
            ZoomCam(actor, "turncam-" + tag + "-attack-late-zoom");
            if (joy != null) joy.Value = new Vector2(-0.3f, -0.95f);
            yield return new WaitForSeconds(0.9f);
            if (joy != null) joy.Value = Vector2.zero;
            yield return new WaitForSeconds(0.5f);
        }

        /// <summary>Freeze the hero on one clip (idle / run / attack) at a fraction of its length. Returns a re-apply action
        /// for use right before each render (the game's anim driver re-poses the hero in Update).</summary>
        static Action Freeze(HeroActor actor, string key, float frac)
        {
            var anim = actor.GetComponentInChildren<Animation>();
            if (anim == null) return null;
            AnimationState pick = null;
            foreach (AnimationState st in anim)
            {
                string n = st.name.ToLowerInvariant();
                bool ok = key == "attack" ? (n.Contains("attack") || n.Contains("slash") || n.Contains("chop")) : n.Contains(key);
                if (ok && (pick == null || n.Length < pick.name.Length)) pick = st;
            }
            if (pick == null) { Debug.Log("Hollowmere leather no clip " + key); return null; }
            Debug.Log("Hollowmere leather clip " + key + " = " + pick.name);
            var curls = actor.GetComponentsInChildren<HandCurl>(true);
            // Skinning runs once per frame before rendering, so a pose sampled right before a manual Render shows the
            // previous frame's skin (the weapon followed the bone, the body did not). Stop the game's anim driver and
            // leave the frozen state playing so the engine skins it; callers wait a frame before rendering.
            foreach (var ma in actor.GetComponentsInChildren<ModelAnim>(true)) ma.enabled = false;
            return () =>
            {
                foreach (AnimationState o in anim) { o.weight = 0f; o.enabled = false; }
                pick.enabled = true; pick.weight = 1f; pick.speed = 0f; pick.time = pick.length * frac;
                anim.Sample();
                foreach (var c in curls) if (c != null) c.Apply();
                foreach (var ik in actor.GetComponentsInChildren<OffHandIk>(true)) if (ik != null) ik.Apply();
                foreach (var wr in actor.GetComponentsInChildren<WeaponRest>(true)) if (wr != null) wr.Apply();
            };
        }

        static Transform Bone(Transform root, string tail)
        {
            foreach (var t in root.GetComponentsInChildren<Transform>(true)) if (t.name.EndsWith(tail)) return t;
            return null;
        }

        /// <summary>-qaShot leather: fitted leather set proof. Per tier: 5-view turnaround in idle, run and attack;
        /// close-ups of shoulders, elbows, hips, knees and hands in run and attack. Then game camera idle/run/attack per tier.</summary>
        public static IEnumerator RunLeather(GameManager gm)
        {
            gm.State = GameManager.MakeCustom("Aldric", 2, 2, 1, 1, 0.85f, 0.85f, 0.88f, PetSpecies.Hound, "Mossy", 1, 0, true);
            gm.EnterTown(false);
            Screen.SetResolution(2340, 1080, FullScreenMode.Windowed);
            yield return new WaitForSecondsRealtime(1.0f);
            // Weapons are sheathed in town; shoot in floor 1 with the weapon drawn (own layer + backdrop, so the floor never shows).
            gm.EnterFloor(1);
            yield return new WaitForSecondsRealtime(2.0f);
            var actor = HeroActor.I;
            string[] weps = { "sword", "axe", "spear" };
            var poses = new (string key, float frac)[] { ("idle", 0.3f), ("run", 0.25f), ("attack", 0.45f) };
            var parts = new (string name, string bone, float size)[] { ("shoulderR", "RightArm", 0.30f), ("shoulderL", "LeftArm", 0.30f), ("elbowR", "RightForeArm", 0.26f), ("elbowL", "LeftForeArm", 0.26f), ("hips", "Hips", 0.42f), ("kneeR", "RightLeg", 0.28f), ("kneeL", "LeftLeg", 0.28f), ("handR", "RightHand", 0.22f), ("handL", "LeftHand", 0.22f) };
            bool quick = Environment.GetEnvironmentVariable("HM_LQ") == "1";
            int qt = int.TryParse(Environment.GetEnvironmentVariable("HM_LQT"), out var qv) ? qv : 2;
            for (int t = quick ? qt : 1; t <= (quick ? qt : GearTable.TierCount); t++)
            {
                WearFamily(gm, TurnPieces, "leather", t, t == 1 ? Rarity.Common : t == 2 ? Rarity.Rare : Rarity.Legendary);
                TurnWeapon(gm, weps[t - 1]);
                yield return new WaitForSeconds(0.6f);
                foreach (var ps in poses)
                {
                    var fr = Freeze(actor, ps.key, ps.frac);
                    fr?.Invoke();
                    yield return null; yield return null;
                    yield return new WaitForEndOfFrame();
                    fr?.Invoke();
                    foreach (var tt in actor.GetComponentsInChildren<Transform>(true)) if (tt.name.EndsWith("RightHand") || tt.name.EndsWith("RightForeArm")) Debug.Log("Hollowmere leather bone " + ps.key + " " + tt.name + " root=" + tt.root.name + " up=" + (tt.parent ? tt.parent.name : "-") + " d=" + (tt.position - actor.transform.position).ToString("F2"));
                    foreach (var sm in actor.GetComponentsInChildren<SkinnedMeshRenderer>()) if (sm.name == "body_Hand" || sm.name == "gear_hands") Debug.Log("Hollowmere leather smr " + sm.name + " bone0=" + (sm.bones.Length > 0 && sm.bones[0] ? sm.bones[0].name : "-") + " rightHand=" + System.Array.Find(sm.bones, b => b != null && b.name.EndsWith("RightHand"))?.position.ToString("F2") + " bounds=" + sm.bounds.center.ToString("F2"));
                    foreach (var rr in actor.GetComponentsInChildren<Renderer>()) if (rr.enabled && !(rr is SkinnedMeshRenderer)) Debug.Log("Hollowmere leather rend " + ps.key + " " + rr.name + " parent=" + (rr.transform.parent ? rr.transform.parent.name : "-") + " d=" + (rr.bounds.center - actor.transform.position).ToString("F2"));
                    TurnRender(actor.transform, "leather-t" + t + "-" + weps[t - 1] + "-" + ps.key, true, fr);
                    if (quick) continue;
                    foreach (var pt in parts)
                    {
                        var bn = Bone(actor.transform, pt.bone);
                        if (bn == null) continue;
                        yield return new WaitForEndOfFrame();
                        TurnRender(actor.transform, "leather-close-t" + t + "-" + ps.key + "-" + pt.name, true, fr, bn, pt.size);
                    }
                }
            }
            foreach (var ma in actor.GetComponentsInChildren<ModelAnim>(true)) ma.enabled = true;
            for (int t = 1; t <= (quick ? 0 : GearTable.TierCount); t++)
            {
                WearFamily(gm, TurnPieces, "leather", t, t == 1 ? Rarity.Common : t == 2 ? Rarity.Rare : Rarity.Legendary);
                TurnWeapon(gm, weps[t - 1]);
                yield return TurnCam(actor, "leather-t" + t + "-" + weps[t - 1]);
            }
            Debug.Log("Hollowmere QA leather done");
            Application.Quit();
        }

        static IEnumerator TurnSkeleton(HeroActor actor)
        {
            var go = Art.Animated("hm_skel_warrior", 1.8f, null);
            if (go == null) { Debug.LogError("Hollowmere turn FAIL no skeleton"); yield break; }
            go.transform.position = actor.Pos + Vector3.right * 6f;
            go.transform.rotation = Quaternion.LookRotation(Vector3.back);
            yield return null;
            SampleMonster(go, "idle", 0.2f);
            yield return new WaitForEndOfFrame();
            SampleMonster(go, "idle", 0.2f);
            TurnRender(go.transform, "99-armored-skeleton", false);
            UnityEngine.Object.Destroy(go);
        }
    }
}
