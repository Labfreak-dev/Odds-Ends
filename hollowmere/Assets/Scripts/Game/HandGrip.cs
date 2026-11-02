using System.Linq;
using System.Collections.Generic;
using UnityEngine;

namespace Hollowmere
{
    /// <summary>
    /// Measured grip. The old sockets were per-weapon Euler guesses against the hand bone origin (the wrist),
    /// so on the phone the sword hung diagonally and its hilt sat in the forearm. Here the palm is measured from
    /// the finger bones: palm centre (between the index/pinky knuckles, pulled toward the wrist), knuckle axis
    /// (pinky to index), finger axis (wrist to knuckles) and palm normal. The weapon's own long axis and grip
    /// point are measured from its mesh. The haft is laid along the knuckle axis through the closed fist, the
    /// blade's width along the fingers, and the grip point is seated inside the palm.
    /// </summary>
    public static class HandGrip
    {
        /// <summary>Last measured handle region (fraction of length from the pommel) and a log line.</summary>
        public static float HandleFrom, HandleTo; public static string GripLog = "";
        public struct Palm { public Vector3 centre, knuckle, finger, normal; public bool ok; }

        static Transform Child(Transform hand, string part)
        {
            foreach (var t in hand.GetComponentsInChildren<Transform>(true))
                if (t != hand && t.name.EndsWith(part) && !t.name.StartsWith("gear_")) return t;
            return null;
        }

        /// <summary>Palm frame in world space for the current pose.</summary>
        public static bool LocalFrame(Transform hand, out Vector3 c, out Vector3 f, out Vector3 k, out Vector3 n)
        {
            c = f = k = n = Vector3.zero;
            if (!cache.TryGetValue(hand, out var lp)) { MeasureFromSkin(hand); if (!cache.TryGetValue(hand, out lp)) return false; }
            c = lp.c; f = lp.f; k = lp.k; n = lp.n; return true;
        }

        public static Palm Measure(Transform hand)
        {
            var p = new Palm();
            if (hand == null) return p;
            string side = hand.name.Contains("Left") ? "Left" : "Right";
            var index = Child(hand, side + "HandIndex1");
            var pinky = Child(hand, side + "HandPinky1") ?? Child(hand, side + "HandRing1");
            var middle = Child(hand, side + "HandMiddle1");
            var mid3 = Child(hand, side + "HandMiddle3") ?? Child(hand, side + "HandMiddle2");
            var thumb = Child(hand, side + "HandThumb1") ?? Child(hand, side + "HandThumb2"); // Thumb1 head does not move with the curl
            if (index == null || pinky == null || middle == null || index.name.StartsWith("hm_")) return MeasureFromSkin(hand);
            var knuckles = (index.position + pinky.position) * 0.5f;
            p.finger = (knuckles - hand.position).normalized;
            p.knuckle = (index.position - pinky.position).normalized;
            // Palm side: the thumb sits on it; fall back to the rest curl of the middle finger.
            Vector3 n = Vector3.Cross(p.finger, p.knuckle).normalized;
            // Authored Thumb1 head sits on the back-of-palm side of the knuckle line (verified by eye in close-ups), so flip it.
            Vector3 hint = thumb != null ? knuckles - thumb.position : n;
            if (thumb == null && LocalFrame(hand, out _, out _, out _, out var nl)) hint = hand.TransformDirection(nl); // skin-measured palm side, curl-independent
            hint -= Vector3.Project(hint, p.finger) + Vector3.Project(hint, p.knuckle);
            if (hint.sqrMagnitude > 1e-8f && Vector3.Dot(n, hint) < 0f) n = -n;
            p.normal = n;
            p.centre = Vector3.Lerp(hand.position, knuckles, 0.72f);
            p.ok = true;
            return p;
        }

        struct LocalPalm { public Vector3 c, f, k, n; }
        static readonly Dictionary<Transform, LocalPalm> cache = new Dictionary<Transform, LocalPalm>();

        /// <summary>
        /// The shipped hero has NO finger bones (mixamorig:RightHand is a leaf), so the palm comes from the skin:
        /// vertices bound mostly to the hand bone, taken into hand space through the bindpose, then PCA.
        /// Longest axis = fingers (away from the wrist), middle = knuckle line (sign: thumb side = bind-pose
        /// forward), shortest = palm normal (sign: bind-pose down, T-pose palms face the floor).
        /// </summary>
        static Palm MeasureFromSkin(Transform hand)
        {
            var p = new Palm();
            if (!cache.TryGetValue(hand, out var lp))
            {
                SkinnedMeshRenderer skin = null; int bi = -1;
                foreach (var smr in hand.root.GetComponentsInChildren<SkinnedMeshRenderer>(true))
                {
                    if (smr.name.StartsWith("gear_") || smr.sharedMesh == null || !smr.sharedMesh.isReadable) continue;
                    int k = System.Array.IndexOf(smr.bones, hand);
                    if (k >= 0) { skin = smr; bi = k; if (!smr.name.StartsWith("body_")) break; }
                }
                if (skin == null) return p;
                var mesh = skin.sharedMesh; var v = mesh.vertices; var w = mesh.boneWeights; var bind = mesh.bindposes[bi];
                var pts = new List<Vector3>();
                for (int i = 0; i < v.Length && i < w.Length; i++)
                {
                    var bw = w[i]; float wt = bw.boneIndex0 == bi ? bw.weight0 : bw.boneIndex1 == bi ? bw.weight1 : 0f;
                    if (wt > 0.6f) pts.Add(bind.MultiplyPoint3x4(v[i]));
                }
                if (pts.Count < 20) return p;
                var c = Vector3.zero; foreach (var q in pts) c += q; c /= pts.Count;
                float xx = 0, xy = 0, xz = 0, yy = 0, yz = 0, zz = 0;
                foreach (var q in pts) { var d = q - c; xx += d.x * d.x; xy += d.x * d.y; xz += d.x * d.z; yy += d.y * d.y; yz += d.y * d.z; zz += d.z * d.z; }
                Vector3 Mul(Vector3 a) => new Vector3(xx * a.x + xy * a.y + xz * a.z, xy * a.x + yy * a.y + yz * a.z, xz * a.x + yz * a.y + zz * a.z);
                Vector3 Power(Vector3 a, Vector3 not1, Vector3 not2)
                {
                    for (int it = 0; it < 60; it++) { a = Mul(a); a -= Vector3.Project(a, not1); a -= Vector3.Project(a, not2); a.Normalize(); }
                    return a;
                }
                var e1 = Power(new Vector3(0.3f, 1f, 0.2f).normalized, Vector3.zero, Vector3.zero);
                var e2 = Power(Vector3.Cross(e1, Vector3.right).sqrMagnitude > 0.1f ? Vector3.Cross(e1, Vector3.right).normalized : Vector3.Cross(e1, Vector3.up).normalized, e1, Vector3.zero);
                var e3 = Vector3.Cross(e1, e2).normalized;
                if (Vector3.Dot(e1, c) < 0f) e1 = -e1;
                if (Vector3.Dot(e2, bind.MultiplyVector(Vector3.forward)) < 0f) e2 = -e2;
                if (Vector3.Dot(e3, bind.MultiplyVector(Vector3.down)) < 0f) e3 = -e3;
                lp = new LocalPalm { c = c, f = e1, k = e2, n = e3 };
                cache[hand] = lp;
                Debug.Log("Hollowmere grip palm from skin " + hand.name + " verts=" + pts.Count + " centre=" + c.ToString("F3") + " finger=" + e1.ToString("F2") + " knuckle=" + e2.ToString("F2") + " normal=" + e3.ToString("F2"));
            }
            // Hand space here is the bindpose space (metres of the mesh); go to world through the bone.
            var m = hand.localToWorldMatrix;
            p.centre = m.MultiplyPoint3x4(lp.c);
            p.finger = m.MultiplyVector(lp.f).normalized;
            p.knuckle = m.MultiplyVector(lp.k).normalized;
            p.normal = m.MultiplyVector(lp.n).normalized;
            // Palm centre: the hand mesh centroid sits mid-fingers; the grip is nearer the palm root.
            p.centre -= p.finger * 0.015f;
            p.ok = true;
            return p;
        }

        /// <summary>Where the hilt should sit: inside the closed fist, a little off the palm skin.</summary>
        public static Vector3 FistPoint(Palm p, string type)
        {
            float into = type == "orb" ? 0.055f : type == "fist" ? -0.005f : 0.028f;
            return p.centre + p.normal * into;
        }

        public static float GripFrac(string type)
        {
            switch (type)
            {
                case "staff": case "spear": case "scythe": return 0.40f;
                case "bow": return 0.50f;
                case "crossbow": return 0.38f;
                default: return -1f; // short haft: 7 cm from the pommel end
            }
        }

        /// <summary>Weapon-local long axis (pommel to tip), width axis and grip point, from the mesh.</summary>
        public static bool MeshAxes(Transform weapon, string type, out Vector3 axis, out Vector3 width, out Vector3 grip)
        {
            axis = Vector3.forward; width = Vector3.right; grip = Vector3.zero;
            var pts = new List<Vector3>();
            foreach (var mf in weapon.GetComponentsInChildren<MeshFilter>(true))
            {
                var m = mf.sharedMesh; if (m == null || !m.isReadable) continue;
                var v = m.vertices; int step = Mathf.Max(1, v.Length / 20000);
                for (int i = 0; i < v.Length; i += step) pts.Add(weapon.InverseTransformPoint(mf.transform.TransformPoint(v[i])));
            }
            foreach (var smr in weapon.GetComponentsInChildren<SkinnedMeshRenderer>(true))
            {
                var m = smr.sharedMesh; if (m == null || !m.isReadable) continue;
                var v = m.vertices; int step = Mathf.Max(1, v.Length / 20000);
                for (int i = 0; i < v.Length; i += step) pts.Add(weapon.InverseTransformPoint(smr.transform.TransformPoint(v[i])));
            }
            if (pts.Count < 8) return false;
            var min = pts[0]; var max = pts[0];
            foreach (var q in pts) { min = Vector3.Min(min, q); max = Vector3.Max(max, q); }
            var size = max - min;
            int a = size.x >= size.y && size.x >= size.z ? 0 : size.y >= size.z ? 1 : 2;
            int b = a == 0 ? (size.y >= size.z ? 1 : 2) : a == 1 ? (size.x >= size.z ? 0 : 2) : (size.x >= size.y ? 0 : 1);
            var ax = Vector3.zero; ax[a] = 1f;
            var wd = Vector3.zero; wd[b] = 1f;
            // Handle from geometry, not from the pivot (the pivot is the mesh centre or the tip on several models,
            // which is why the phone hero held the sword by the blade). Slice the long axis into 40 bins and take
            // each bin's cross extent. The handle is the longest run of narrow bins touching an end (up to 3 pommel
            // bins skipped); the blade/head is the other way. Pole arms and bows grip at a fraction from the butt,
            // where the butt is the end away from the widest bin (the head).
            const int N = 40;
            float lo = min[a], hi = max[a], len = Mathf.Max(1e-4f, hi - lo);
            var ext = new float[N];
            foreach (var q in pts)
            {
                int bin = Mathf.Clamp((int)((q[a] - lo) / len * N), 0, N - 1);
                var d = q - (min + max) * 0.5f; d[a] = 0f;
                ext[bin] = Mathf.Max(ext[bin], d.magnitude);
            }
            // Fill empty bins, then smooth over 3.
            for (int i = 0; i < N; i++) if (ext[i] <= 0f) { float l = i > 0 ? ext[i - 1] : 0f; int j = i + 1; while (j < N && ext[j] <= 0f) j++; ext[i] = Mathf.Max(l, j < N ? ext[j] : l); }
            var sm = new float[N];
            for (int i = 0; i < N; i++) { float t = 0; int c = 0; for (int k = -1; k <= 1; k++) if (i + k >= 0 && i + k < N) { t += ext[i + k]; c++; } sm[i] = t / c; }
            int widest = 0; for (int i = 1; i < N; i++) if (sm[i] > sm[widest]) widest = i;
            // Swords and daggers: the guard is the widest slice; the handle is the shorter side of it (handles are
            // shorter than blades). Everything else: the head is the widest slice; the butt is the far end.
            bool blade = type == "sword" || type == "dagger";
            bool pole = GripFrac(type) >= 0f;
            bool handleAtLo;
            float a0, a1;
            if (blade)
            {
                handleAtLo = widest < N / 2;
                int guardFromPommel = handleAtLo ? widest : N - 1 - widest;
                float gp = guardFromPommel * len / N;
                // Handle: from just past the pommel cap to just before the guard.
                a0 = Mathf.Min(gp * 0.25f, 0.03f); a1 = Mathf.Max(a0 + 0.04f, gp - 0.01f);
            }
            else
            {
                handleAtLo = widest > N / 2;
                if (type == "bow") { a0 = len * 0.42f; a1 = len * 0.58f; }
                else if (pole) { float f = GripFrac(type); a0 = len * (f - 0.1f); a1 = len * (f + 0.1f); }
                else if (type == "fist") { a0 = len * 0.3f; a1 = len * 0.7f; }
                else { a0 = len * 0.06f; a1 = len * 0.32f; }
            }
            int runLo = 0, runHi = 0; float narrow = sm[widest];
            HandleFrom = a0 / len; HandleTo = a1 / len;
            if (!handleAtLo) ax = -ax;
            float along = (a0 + a1) * 0.5f;
            float pommel = handleAtLo ? lo : -hi;
            var centre = (min + max) * 0.5f;
            grip = centre - Vector3.Project(centre, ax) + ax * (pommel + along);
            GripLog = type + " len=" + len.ToString("F2") + " handle=" + HandleFrom.ToString("F2") + "-" + HandleTo.ToString("F2") + " end=" + (handleAtLo ? "lo" : "hi") + " runs=" + runLo + "/" + runHi + " narrow=" + narrow.ToString("F3") + " ext=" + string.Join(",", System.Array.ConvertAll(ext, e => (e * 100f).ToString("0")));
            axis = ax; width = wd;
            return true;
        }

        /// <summary>Seat a held weapon in the palm of <paramref name="hand"/>. Returns false when the hand has no finger bones.</summary>
        public static bool Seat(Transform hand, Transform weapon, string type)
        {
            if (hand == null || weapon == null) return false;
            if (type == "shield" || type == "quiver") return false;
            var p = Measure(hand);
            if (!p.ok) return false;
            if (type == "orb")
            {
                var rb = weapon.GetComponentInChildren<Renderer>();
                weapon.position += FistPoint(p, type) - (rb != null ? rb.bounds.center : weapon.position);
                return true;
            }
            if (!MeshAxes(weapon, type, out var axisL, out var widthL, out var gripL)) return false;
            // Haft through the fist along the knuckle axis, tip out of the thumb/index side.
            // Fist weapons ride on the knuckles: their long axis follows the fingers.
            Vector3 wantAxis = type == "fist" ? p.finger : p.knuckle;
            Vector3 wantWidth = type == "fist" ? p.knuckle : p.finger;
            if (type == "bow" || type == "crossbow") wantWidth = p.normal;
            var from = Quaternion.LookRotation(axisL, widthL);
            var to = Quaternion.LookRotation(wantAxis, Vector3.ProjectOnPlane(wantWidth, wantAxis));
            weapon.rotation = to * Quaternion.Inverse(from);
            Debug.Log("Hollowmere grip seat " + weapon.name + " " + GripLog);
            var gripW = weapon.TransformPoint(gripL);
            weapon.position += FistPoint(p, type) - gripW;
            return true;
        }

        /// <summary>World grip point and haft axis of a seated weapon (for the per-frame audit).</summary>
        public static bool Held(Transform weapon, string type, out Vector3 grip, out Vector3 axis)
        {
            grip = weapon != null ? weapon.position : Vector3.zero; axis = Vector3.forward;
            if (type == "orb" && weapon != null) { var rb = weapon.GetComponentInChildren<Renderer>(); if (rb != null) grip = rb.bounds.center; return true; }
            if (weapon == null || !MeshAxes(weapon, type, out var a, out _, out var g)) return false;
            grip = weapon.TransformPoint(g); axis = weapon.TransformDirection(a).normalized;
            return true;
        }
    }

    /// <summary>
    /// Finger-curl pose layer. Runs after the Animation component every frame: resets each finger joint to its
    /// rest rotation, then curls it about the knuckle axis so the hand closes around the hilt in every clip.
    /// </summary>
    [DefaultExecutionOrder(10000)]
    public sealed class HandCurl : MonoBehaviour
    {
        public Transform hand;
        public bool open; // orb: cupped, not a fist
        readonly List<(Transform bone, Quaternion rest, float angle)> joints = new List<(Transform, Quaternion, float)>();

        public static HandCurl Ensure(Transform hand, bool cupped)
        {
            if (hand == null) return null;
            var c = hand.GetComponent<HandCurl>() ?? hand.gameObject.AddComponent<HandCurl>();
            c.hand = hand; c.open = cupped; c.Build();
            return c;
        }

        void Build()
        {
            joints.Clear();
            string side = hand.name.Contains("Left") ? "Left" : "Right";
            string[] fingers = { "Index", "Middle", "Ring", "Pinky" };
            float k = open ? 0.45f : 1f;
            foreach (var f in fingers)
                for (int j = 1; j <= 3; j++)
                {
                    var t = Find(side + "Hand" + f + j);
                    if (t != null && !t.name.StartsWith("hm_")) joints.Add((t, t.localRotation, (j == 1 ? 72f : j == 2 ? 88f : 58f) * k));
                }
            for (int j = 1; j <= 3; j++)
            {
                var t = Find(side + "HandThumb" + j);
                if (t != null) joints.Add((t, t.localRotation, (j == 1 ? 18f : 32f) * k));
            }
            if (joints.Count == 0) { BuildSynthetic(); return; }
            // Authored fist (hero.glb "grip_fist", Blender-rigged finger bones): read the clip's finger rotations once.
            fist.Clear();
            var an = hand.GetComponentInParent<Animation>();
            var clip = an != null ? an.GetClip("grip_fist") : null;
            if (clip != null)
            {
                var all = an.GetComponentsInChildren<Transform>(true);
                var saved = all.Select(t => (t, t.localPosition, t.localRotation, t.localScale)).ToList();
                clip.SampleAnimation(an.gameObject, 0f);
                foreach (var j in joints) fist[j.bone] = j.bone.localRotation;
                foreach (var x in saved) { x.t.localPosition = x.Item2; x.t.localRotation = x.Item3; x.t.localScale = x.Item4; }
            }
            Debug.Log("Hollowmere fist " + hand.name + " joints=" + joints.Count + " authored=" + fist.Count);
        }
        readonly Dictionary<Transform, Quaternion> fist = new Dictionary<Transform, Quaternion>();

        Transform Find(string tail)
        {
            foreach (var t in hand.GetComponentsInChildren<Transform>(true))
                if (t.name.EndsWith(tail) && !t.name.StartsWith("gear_")) return t;
            return null;
        }

        // ---- Synthetic finger rig: the shipped hero has no finger bones. RigSkin (called by GearWardrobe before the
        // body is split into regions, so every region mesh inherits it) adds two bones (proximal, distal) under each
        // hand and moves the finger skin onto them. HandCurl then curls them into a fist while a weapon is held.
        Transform prox, dist; float curlP, curlD; Vector3 curlAxis;

        void BuildSynthetic()
        {
            if (!HandGrip.LocalFrame(hand, out var c, out var f, out var k, out var n)) return;
            prox = hand.Find(hand.name + "_hmf1"); dist = prox != null ? prox.Find(hand.name + "_hmf2") : null;
            if (prox == null || dist == null) { Debug.Log("Hollowmere fist rig missing on " + hand.name); return; }
            curlAxis = Vector3.Cross(f, n).normalized;
            curlP = open ? 35f : 80f; curlD = open ? 30f : 85f;
        }

        public static void RigSkin(SkinnedMeshRenderer skin)
        {
            if (skin == null || skin.sharedMesh == null || !skin.sharedMesh.isReadable) return;
            var bones = skin.bones; var mesh0 = skin.sharedMesh;
            if (mesh0.bindposes.Length != bones.Length) return;
            Mesh mesh = null; var nb = new List<Transform>(bones); var nbp = new List<Matrix4x4>(mesh0.bindposes);
            BoneWeight[] w = null; Vector3[] v = mesh0.vertices;
            for (int hi = 0; hi < bones.Length; hi++)
            {
                var hand = bones[hi];
                if (hand == null || !(hand.name.EndsWith("LeftHand") || hand.name.EndsWith("RightHand"))) continue;
                if (hand.Find(hand.name + "_hmf1") != null) continue;
                if (hand.GetComponentsInChildren<Transform>(true).Any(t => t.name.EndsWith("HandIndex1"))) continue; // authored finger bones
                if (!HandGrip.LocalFrame(hand, out var c, out var f, out var k, out var n)) continue;
                if (mesh == null) { mesh = Instantiate(mesh0); mesh.name = mesh0.name; w = mesh.boneWeights; }
                const float t0 = 0.010f, t1 = 0.045f;
                var prox = new GameObject(hand.name + "_hmf1").transform; prox.SetParent(hand, false); prox.localPosition = c + f * t0;
                var dist = new GameObject(hand.name + "_hmf2").transform; dist.SetParent(prox, false); dist.localPosition = f * (t1 - t0);
                var bh = nbp[hi];
                var mp = Matrix4x4.TRS(prox.localPosition, Quaternion.identity, Vector3.one);
                var md = mp * Matrix4x4.TRS(dist.localPosition, Quaternion.identity, Vector3.one);
                int pi = nb.Count; nb.Add(prox); nbp.Add(mp.inverse * bh);
                int di = nb.Count; nb.Add(dist); nbp.Add(md.inverse * bh);
                float kMax = 0f;
                for (int i = 0; i < v.Length && i < w.Length; i++) if (HandW(w[i], hi) > 0.5f) kMax = Mathf.Max(kMax, Vector3.Dot(bh.MultiplyPoint3x4(v[i]) - c, k));
                int moved = 0;
                for (int i = 0; i < v.Length && i < w.Length; i++)
                {
                    var bw = w[i]; if (HandW(bw, hi) < 0.5f) continue;
                    var q = bh.MultiplyPoint3x4(v[i]) - c;
                    float along = Vector3.Dot(q, f), side = Vector3.Dot(q, k);
                    if (along < t0) continue;
                    if (side > 0.55f * kMax && along < t1 + 0.01f) continue; // thumb
                    int to = along > t1 ? di : pi;
                    if (bw.boneIndex0 == hi) bw.boneIndex0 = to; if (bw.boneIndex1 == hi) bw.boneIndex1 = to;
                    if (bw.boneIndex2 == hi) bw.boneIndex2 = to; if (bw.boneIndex3 == hi) bw.boneIndex3 = to;
                    w[i] = bw; moved++;
                }
                Debug.Log("Hollowmere fist rig " + hand.name + " moved=" + moved);
            }
            if (mesh == null) return;
            mesh.boneWeights = w; mesh.bindposes = nbp.ToArray();
            skin.bones = nb.ToArray(); skin.sharedMesh = mesh;
        }

        static float HandW(BoneWeight b, int hi) => (b.boneIndex0 == hi ? b.weight0 : 0) + (b.boneIndex1 == hi ? b.weight1 : 0) + (b.boneIndex2 == hi ? b.weight2 : 0) + (b.boneIndex3 == hi ? b.weight3 : 0);

        void LateUpdate()
        {
            if (joints.Count == 0 && prox != null)
            {
                prox.localRotation = Quaternion.AngleAxis(curlP, curlAxis);
                dist.localRotation = Quaternion.AngleAxis(curlD, curlAxis);
                return;
            }
            Apply();
        }

        void OnDestroy()
        {
            if (prox != null) prox.localRotation = Quaternion.identity;
            if (dist != null) dist.localRotation = Quaternion.identity;
        }

        public void Apply()
        {
            if (hand == null || joints.Count == 0) return;
            if (fist.Count > 0)
            {
                foreach (var j in joints)
                    if (fist.TryGetValue(j.bone, out var q)) j.bone.localRotation = open ? Quaternion.Slerp(j.rest, q, 0.45f) : q;
                return;
            }
            foreach (var j in joints) j.bone.localRotation = j.rest;
            var p = HandGrip.Measure(hand);
            if (!p.ok) return;
            foreach (var j in joints)
            {
                bool thumb = j.bone.name.Contains("Thumb");
                // Curl toward the palm: rotate the finger direction toward the palm normal.
                Vector3 axis = thumb ? Vector3.Cross(p.knuckle, p.normal) * -1f : Vector3.Cross(p.finger, p.normal);
                if (axis.sqrMagnitude < 1e-8f) continue;
                j.bone.rotation = Quaternion.AngleAxis(j.angle, axis.normalized) * j.bone.rotation;
            }
        }
    }
}
