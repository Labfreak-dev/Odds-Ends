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
    ///   Hollowmere -qaShot grip
    /// Every weapon type x idle/run/attack clips x 3 frames: measured palm frame, hilt-in-palm distance, haft axis
    /// against the knuckle axis, and middle fingertip to haft (closed fist). Writes qa-grip-&lt;weapon&gt;-&lt;clip&gt;-&lt;i&gt;.jpg
    /// close-ups for the contact sheet and one "Hollowmere grip check" line per frame.
    /// </summary>
    public static partial class QaFrames
    {
        public static IEnumerator RunGrip(GameManager gm)
        {
            gm.State = GameManager.MakeCustom("Aldric", 1, 2, 1, 1, 0.85f, 0.85f, 0.88f, PetSpecies.Hound, "Mossy", 1, 0, true);
            gm.EnterTown(false);
            Screen.SetResolution(2340, 1080, FullScreenMode.Windowed);
            yield return new WaitForSecondsRealtime(1.0f);
            var s = gm.State; var h = s.hero;
            var actor = HeroActor.I; var cam = Camera.main;
            if (actor == null || cam == null) { Debug.LogError("Hollowmere grip FAIL no hero"); Application.Quit(); yield break; }
            foreach (var it in h.inventory.Where(i => i.kind == ItemKind.Equipment).ToList()) Town.ToStash(s, it);
            var rig = cam.GetComponent<CameraRig>(); if (rig != null) rig.enabled = false;
            var models = s.stash.Where(i => i.kind == ItemKind.Equipment && i.Base != null && (i.Base.slot == ItemSlot.MainHand || i.Base.slot == ItemSlot.OffHand))
                .Select(i => GearTable.ModelFor(i.baseId)).Where(m => m != null).Distinct().OrderBy(m => m).ToList();
            var seenTypes = new HashSet<string>();
            int fails = 0, checks = 0;
            foreach (var model in models)
            {
                var pick = TsModel(s, model, null);
                if (pick == null) continue;
                string type = GearTable.TypeOf(pick.baseId);
                if (type == "shield" || type == "quiver") continue;
                if (!seenTypes.Add(type + "_" + model.Split('_')[0]) && seenTypes.Count > 24) continue;
                var off = h.Equipped(EquipSlot.OffHand); if (off != null && h.Unequip(EquipSlot.OffHand)) Town.ToStash(s, off);
                if (type == "orb") TsWear(gm, TsModel(s, "wand_1", ItemSlot.MainHand), "grip main wand", e => { });
                TsWear(gm, pick, "grip " + model, e => Debug.LogError("Hollowmere grip FAIL " + e));
                yield return null;
                var weapon = GripFind(actor.transform, pick.Base.slot == ItemSlot.OffHand ? "gear_offhand" : "gear_weapon");
                if (weapon == null) { fails++; Debug.LogError("Hollowmere grip FAIL " + model + " not held"); continue; }
                var hand = weapon.parent;
                var anim = actor.GetComponentInChildren<Animation>();
                var curl = hand != null ? hand.GetComponent<HandCurl>() : null;
                var clips = new List<AnimationState>();
                if (anim != null)
                    foreach (AnimationState st in anim)
                    {
                        string n = st.name.ToLowerInvariant();
                        if (n.Contains("idle") || n.Contains("run") || n.Contains("attack") || n.Contains("slash") || n.Contains("cast") || n.Contains("shoot") || n.Contains("punch") || n.Contains("stab") || n.Contains("chop"))
                            clips.Add(st);
                    }
                clips = clips.GroupBy(c => c.name.ToLowerInvariant().Contains("idle") ? "idle" : c.name.ToLowerInvariant().Contains("run") ? "run" : c.name).Select(g => g.First()).Take(6).ToList();
                foreach (var st in clips)
                    for (int f = 0; f < 3; f++)
                    {
                        foreach (AnimationState o in anim) { o.weight = 0f; o.enabled = false; }
                        st.enabled = true; st.weight = 1f; st.time = st.length * (f / 2f) * 0.98f;
                        anim.Sample();
                        var ik = weapon.GetComponent<OffHandIk>() ?? actor.GetComponentInChildren<OffHandIk>(); if (ik != null) ik.Apply();
                        if (curl != null) curl.Apply();
                        var p = HandGrip.Measure(hand);
                        HandGrip.Held(weapon, type, out var grip, out var axis);
                        float dist = p.ok ? Vector3.Distance(grip, HandGrip.FistPoint(p, type)) : 1f;
                        Vector3 want = type == "fist" ? p.finger : p.knuckle;
                        float ang = type == "orb" ? 0f : Vector3.Angle(axis, want);
                        var tip = GripFind(hand, (hand.name.Contains("Left") ? "Left" : "Right") + "HandMiddle3") ?? GripFind(hand, (hand.name.Contains("Left") ? "Left" : "Right") + "HandMiddle2");
                        float wrap = tip != null && type != "orb" && type != "fist" ? Vector3.Cross(tip.position - grip, axis).magnitude : 0f;
                        bool bad = !p.ok || dist > 0.03f || ang > 20f || wrap > 0.05f;
                        checks++; if (bad) fails++;
                        Debug.Log("Hollowmere grip check " + model + " " + type + " " + st.name + " f" + f + " palmDist=" + (dist * 100f).ToString("0.0") + "cm axis=" + ang.ToString("0") + "deg wrap=" + (wrap * 100f).ToString("0.0") + "cm" + (bad ? " FAIL" : " ok"));
                        // Close-up of the hand for the contact sheet.
                        var look = p.ok ? p.centre : hand.position;
                        var side = actor.transform.right * (hand.name.Contains("Left") ? -1f : 1f);
                        cam.transform.position = look + (actor.transform.forward * 0.55f + side * 0.35f + Vector3.up * 0.15f);
                        cam.transform.LookAt(look);
                        float fov = cam.fieldOfView; cam.fieldOfView = 40f;
                        yield return new WaitForEndOfFrame();
                        SaveCrop("grip-" + model + "-" + Clean(st.name) + "-" + f, 600);
                        cam.fieldOfView = fov;
                    }
            }
            Debug.Log("Hollowmere grip done checks=" + checks + " fails=" + fails);
            Debug.Log("Hollowmere QA grip done");
            Application.Quit();
        }

        static string Clean(string n) { foreach (var c in Path.GetInvalidFileNameChars()) n = n.Replace(c, '_'); return n.Replace('|', '_').Replace(' ', '_'); }

        static Transform GripFind(Transform root, string tail)
        {
            foreach (var t in root.GetComponentsInChildren<Transform>(true)) if (t.name == tail || t.name.EndsWith(tail)) return t;
            return null;
        }

        static void SaveCrop(string name, int size)
        {
            var t = new Texture2D(size, size, TextureFormat.RGB24, false);
            t.ReadPixels(new Rect((Screen.width - size) / 2, (Screen.height - size) / 2, size, size), 0, 0);
            t.Apply();
            File.WriteAllBytes(Path.Combine(Directory.GetCurrentDirectory(), "qa-" + name + ".jpg"), t.EncodeToJPG(85));
            UnityEngine.Object.Destroy(t);
        }
    }
}
