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
            s.stashCapacity = 2000;
            foreach (var it in h.inventory.Where(i => i.kind == ItemKind.Equipment).ToList()) Town.ToStash(s, it);
            var rig = cam.GetComponent<CameraRig>(); if (rig != null) rig.enabled = false;
            // Bare-armed so the fist reads (starter gloves only): take off armour that hides the hand.
            foreach (var es in new[] { EquipSlot.Hands, EquipSlot.Wrists, EquipSlot.Shoulders, EquipSlot.Chest })
            { var e = h.Equipped(es); if (e != null) { h.equipment[(int)es] = null; Town.ToStash(s, e); } } // direct: bag is full with the TestStart kit, Unequip() refuses
            gm.OnEquipmentChanged();
            var models = s.stash.Where(i => i.kind == ItemKind.Equipment && i.Base != null && (i.Base.slot == ItemSlot.MainHand || i.Base.slot == ItemSlot.OffHand))
                .Select(i => GearTable.ModelFor(i.baseId)).Where(m => m != null).Distinct().OrderBy(m => m).ToList();
            var seenTypes = new HashSet<string>();
            int fails = 0, checks = 0;
            foreach (var model in models)
            {
                var only = System.Environment.GetEnvironmentVariable("HM_GRIPONLY");
                if (!string.IsNullOrEmpty(only) && !only.Split(',').Contains(model)) continue;
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
                        st.enabled = true; st.weight = 1f; st.speed = 0f; st.time = st.length * (f / 2f) * 0.98f;
                        anim.Sample();
                        var ik = weapon.GetComponent<OffHandIk>() ?? actor.GetComponentInChildren<OffHandIk>(); if (ik != null) ik.Apply();
                        if (curl != null) curl.Apply();
                        var p = HandGrip.Measure(hand);
                        HandGrip.Held(weapon, type, out var grip, out var axis);
                        float h0 = HandGrip.HandleFrom, h1 = HandGrip.HandleTo;
                        // Where along the haft the palm sits, as a fraction from the pommel.
                        HandGrip.MeshAxes(weapon, type, out var axL, out _, out var gL);
                        float lenW = 0f; { var b = weapon.GetComponentInChildren<Renderer>(); if (b != null) lenW = Vector3.Dot(b.bounds.size, new Vector3(Mathf.Abs(axis.x), Mathf.Abs(axis.y), Mathf.Abs(axis.z))); }
                        float palmFrac = lenW > 1e-3f ? ((h0 + h1) * 0.5f) + Vector3.Dot(p.centre - grip, axis) / lenW : -1f;
                        bool inHandle = type == "orb" || type == "fist" || (palmFrac >= h0 - 0.04f && palmFrac <= h1 + 0.04f);
                        // Bows are symmetric about the grip: direction-agnostic.
                        float bdot = Vector3.Dot(axis, type == "fist" ? p.finger : p.knuckle);
                        bool bladeOut = type == "orb" || (type == "bow" ? Mathf.Abs(bdot) : bdot) > 0.6f;
                        float dist = p.ok ? Vector3.Distance(grip, HandGrip.FistPoint(p, type)) : 1f;
                        Vector3 want = type == "fist" ? p.finger : p.knuckle;
                        float ang = type == "orb" ? 0f : Vector3.Angle(axis, want);
                        if (type == "bow") ang = Mathf.Min(ang, 180f - ang);
                        var tip = GripFind(hand, (hand.name.Contains("Left") ? "Left" : "Right") + "HandMiddle3") ?? GripFind(hand, (hand.name.Contains("Left") ? "Left" : "Right") + "HandMiddle2");
                        float wrap = tip != null && type != "orb" && type != "fist" ? Vector3.Cross(tip.position - grip, axis).magnitude : 0f;
                        // Rendered check: baked body_Hand skin (what the player sees) must actually touch the handle.
                        float skin = SkinGap(actor, hand.position, grip, axis, type);
                        bool skinBad = type != "orb" && skin > 0.035f;
                        bool bad = !p.ok || dist > 0.03f || ang > 20f || !inHandle || !bladeOut;
                        checks++; if (bad) fails++;
                        Debug.Log("Hollowmere grip check " + model + " " + type + " " + st.name + " f" + f + " palmDist=" + (dist * 100f).ToString("0.0") + "cm axis=" + ang.ToString("0") + "deg wrap=" + (wrap * 100f).ToString("0.0") + "cm skinGap=" + (skin * 100f).ToString("0.0") + "cm" + (bad ? " FAIL" : " ok"));
                        // Close-up of the hand for the contact sheet.
                        // Dedicated close-up: back of the hand, a little toward the fingertips, cape hidden, and
                        // a near plane that cuts anything between the lens and the hand (torso, shoulder pads).
                        var look = p.ok ? p.centre : hand.position;
                        // Hide every skinned renderer except the bare body (armour, starter cloth, cape, hair) so only skin hand + weapon show.
                        var capes = actor.GetComponentsInChildren<Renderer>(true).Where(r => r.enabled && (r.name.Contains("cloak") || r.name.Contains("cape") || r.name == "gear_chest" || r.name == "gear_shoulders")).ToList();
                        foreach (var r in capes) r.enabled = false;
                        var bodies = new List<SkinnedMeshRenderer>();

                        // Tight on the fist: from outside the body (chest->hand) blended toward the back of the hand.
                        var chest = actor.transform.position + Vector3.up * 1.2f;
                        var outv = (hand.position - chest); outv.y = 0f; outv = outv.sqrMagnitude > 1e-4f ? outv.normalized : actor.transform.right;
                        var side2 = Vector3.Cross(axis, Vector3.up); if (side2.sqrMagnitude < 0.05f) side2 = Vector3.Cross(axis, actor.transform.forward);
                        side2.Normalize(); if (Vector3.Dot(side2, outv) < 0f) side2 = -side2; if (System.Environment.GetEnvironmentVariable("HM_GRIPFLIP") == "1") { side2 = -side2; outv = -outv; }
                        var cdir = (outv + side2 * 0.6f + Vector3.up * 0.2f).normalized;
                        var gcam = new GameObject("qa_gripcam").AddComponent<Camera>();
                        gcam.CopyFrom(cam); gcam.fieldOfView = 35f; gcam.nearClipPlane = 0.05f; gcam.depth = cam.depth + 10;
                        look = grip; gcam.transform.position = look + cdir * GripDist; gcam.transform.LookAt(look, Vector3.up);
                        // The game's own anim driver re-poses the hero in Update; re-sample after it so the
                        // rendered frame is the pose we measured (before this, close-ups showed a different pose).
                        yield return null;
                        foreach (AnimationState o in anim) { o.weight = 0f; o.enabled = false; }
                        st.enabled = true; st.weight = 1f; st.speed = 0f; st.time = st.length * (f / 2f) * 0.98f;
                        anim.Sample(); if (ik != null) ik.Apply(); if (curl != null) curl.Apply();
                        { HandGrip.Held(weapon, type, out var g3, out _); gcam.transform.position = g3 + cdir * GripDist; gcam.transform.LookAt(g3, Vector3.up); }
                        yield return new WaitForEndOfFrame();
                        { HandGrip.Held(weapon, type, out var g2, out var a2); float sk2 = SkinGap(actor, hand.position, g2, a2, type);
                          bool wb = type != "orb" && (sk2 > 0.035f || LastWrap < 0.6f);
                          Debug.Log("Hollowmere grip rendered " + model + " " + st.name + " f" + f + " skinGapAtRender=" + (sk2 * 100f).ToString("0.0") + "cm wrap=" + (LastWrap * 100f).ToString("0") + "%" + (wb ? " FAIL" : " ok"));
                          } // info only: body_Hand holds both hands and glove-covered tris are trimmed, so this cannot prove a wrap
                        SaveCrop("grip-" + model + "-" + Clean(st.name) + "-" + f, 600);
                        UnityEngine.Object.Destroy(gcam.gameObject);
                        foreach (var r in capes) r.enabled = true;
                        foreach (var r in bodies) r.enabled = false;
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

        static Mesh _bake;
        /// Closest baked hand-skin vertex (near this hand bone) to the handle line around the grip point.
        static float SkinGap(HeroActor actor, Vector3 handPos, Vector3 grip, Vector3 axis, string type)
        {
            var smr = actor.GetComponentsInChildren<SkinnedMeshRenderer>(true).FirstOrDefault(r => r.name == "body_Hand");
            if (smr == null) return 9f;
            if (_bake == null) _bake = new Mesh();
            smr.BakeMesh(_bake, true);
            var m = smr.transform.localToWorldMatrix; float best = 9f; int near = 0; var sect = new bool[8];
            var u = Vector3.Cross(axis, Vector3.up); if (u.sqrMagnitude < 0.05f) u = Vector3.Cross(axis, Vector3.right); u.Normalize(); var w = Vector3.Cross(axis, u);
            foreach (var v0 in _bake.vertices)
            {
                var v = m.MultiplyPoint3x4(v0);
                if ((v - handPos).sqrMagnitude > 0.04f) continue; near++;
                var d = v - grip; float along = Vector3.Dot(d, axis);
                if (Mathf.Abs(along) > 0.06f) continue;
                var rad = d - axis * along; best = Mathf.Min(best, rad.magnitude);
                if (Mathf.Abs(along) < 0.04f && rad.magnitude < 0.045f) { float a = Mathf.Atan2(Vector3.Dot(rad, w), Vector3.Dot(rad, u)); sect[Mathf.Clamp((int)((a + Mathf.PI) / (2f * Mathf.PI) * 8f), 0, 7)] = true; }
            }
            if (near == 0) Debug.Log("Hollowmere grip skin: no hand verts near bone " + handPos.ToString("F3"));
            LastWrap = sect.Count(b => b) / 8f;
            return best;
        }
        public static float LastWrap;
        static float GripDist => float.TryParse(System.Environment.GetEnvironmentVariable("HM_GRIPDIST"), System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var d) ? d : 0.65f;
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
