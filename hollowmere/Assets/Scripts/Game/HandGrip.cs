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
        public struct Palm { public Vector3 centre, knuckle, finger, normal; public bool ok; }

        static Transform Child(Transform hand, string part)
        {
            foreach (var t in hand.GetComponentsInChildren<Transform>(true))
                if (t != hand && t.name.EndsWith(part) && !t.name.StartsWith("gear_")) return t;
            return null;
        }

        /// <summary>Palm frame in world space for the current pose.</summary>
        public static Palm Measure(Transform hand)
        {
            var p = new Palm();
            if (hand == null) return p;
            string side = hand.name.Contains("Left") ? "Left" : "Right";
            var index = Child(hand, side + "HandIndex1");
            var pinky = Child(hand, side + "HandPinky1") ?? Child(hand, side + "HandRing1");
            var middle = Child(hand, side + "HandMiddle1");
            var mid3 = Child(hand, side + "HandMiddle3") ?? Child(hand, side + "HandMiddle2");
            var thumb = Child(hand, side + "HandThumb2") ?? Child(hand, side + "HandThumb1");
            if (index == null || pinky == null || middle == null) return p;
            var knuckles = (index.position + pinky.position) * 0.5f;
            p.finger = (knuckles - hand.position).normalized;
            p.knuckle = (index.position - pinky.position).normalized;
            // Palm side: the thumb sits on it; fall back to the rest curl of the middle finger.
            Vector3 n = Vector3.Cross(p.finger, p.knuckle).normalized;
            Vector3 hint = thumb != null ? thumb.position - knuckles : (mid3 != null ? mid3.position - middle.position : n);
            hint -= Vector3.Project(hint, p.finger) + Vector3.Project(hint, p.knuckle);
            if (hint.sqrMagnitude > 1e-8f && Vector3.Dot(n, hint) < 0f) n = -n;
            p.normal = n;
            p.centre = Vector3.Lerp(hand.position, knuckles, 0.72f);
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
                var v = m.vertices; int step = Mathf.Max(1, v.Length / 1500);
                for (int i = 0; i < v.Length; i += step) pts.Add(weapon.InverseTransformPoint(mf.transform.TransformPoint(v[i])));
            }
            foreach (var sm in weapon.GetComponentsInChildren<SkinnedMeshRenderer>(true))
            {
                var m = sm.sharedMesh; if (m == null || !m.isReadable) continue;
                var v = m.vertices; int step = Mathf.Max(1, v.Length / 1500);
                for (int i = 0; i < v.Length; i += step) pts.Add(weapon.InverseTransformPoint(sm.transform.TransformPoint(v[i])));
            }
            if (pts.Count < 8) return false;
            var min = pts[0]; var max = pts[0];
            foreach (var q in pts) { min = Vector3.Min(min, q); max = Vector3.Max(max, q); }
            var size = max - min;
            int a = size.x >= size.y && size.x >= size.z ? 0 : size.y >= size.z ? 1 : 2;
            int b = a == 0 ? (size.y >= size.z ? 1 : 2) : a == 1 ? (size.x >= size.z ? 0 : 2) : (size.x >= size.y ? 0 : 1);
            var ax = Vector3.zero; ax[a] = 1f;
            var wd = Vector3.zero; wd[b] = 1f;
            // Pommel end: the end nearer the authored origin (every weapon in the kit is authored grip-first).
            float lo = min[a], hi = max[a];
            bool flip = Mathf.Abs(hi) < Mathf.Abs(lo);
            if (flip) { ax = -ax; float t = lo; lo = -hi; hi = -t; }
            float len = hi - lo;
            float f = GripFrac(type);
            float along = f >= 0f ? lo + len * f : lo + Mathf.Min(0.07f, len * 0.2f);
            var centre = (min + max) * 0.5f;
            grip = centre - Vector3.Project(centre, ax) + ax * along;
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
                weapon.position = FistPoint(p, type);
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
            var gripW = weapon.TransformPoint(gripL);
            weapon.position += FistPoint(p, type) - gripW;
            return true;
        }

        /// <summary>World grip point and haft axis of a seated weapon (for the per-frame audit).</summary>
        public static bool Held(Transform weapon, string type, out Vector3 grip, out Vector3 axis)
        {
            grip = weapon != null ? weapon.position : Vector3.zero; axis = Vector3.forward;
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
                    if (t != null) joints.Add((t, t.localRotation, (j == 1 ? 72f : j == 2 ? 88f : 58f) * k));
                }
            for (int j = 1; j <= 3; j++)
            {
                var t = Find(side + "HandThumb" + j);
                if (t != null) joints.Add((t, t.localRotation, (j == 1 ? 18f : 32f) * k));
            }
        }

        Transform Find(string tail)
        {
            foreach (var t in hand.GetComponentsInChildren<Transform>(true))
                if (t.name.EndsWith(tail) && !t.name.StartsWith("gear_")) return t;
            return null;
        }

        void LateUpdate() => Apply();

        public void Apply()
        {
            if (hand == null || joints.Count == 0) return;
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
