using System.Collections.Generic;
using Hollowmere.Core;
using UnityEngine;

namespace Hollowmere
{
    /// <summary>
    /// Volume-keeping helper bones for fitted gear (leather). Linear skinning collapses a joint where two bones blend
    /// (shoulder/armpit when the arm lifts, hip in a lunge, elbow, knee, ankle, torso twist): the blended vertices take
    /// the average of two rotations and cave in. Each helper sits on the child joint, under the parent, and turns half
    /// as far as the child. Vertices in the blend zone hand their smaller weight to the helper, so the bend is spread
    /// across three transforms and the surface keeps its volume. Weights are otherwise the body's own.
    /// </summary>
    public static class VolumeHelpers
    {
        static readonly string[] Joints = { "LeftArm", "RightArm", "LeftForeArm", "RightForeArm", "LeftUpLeg", "RightUpLeg", "LeftLeg", "RightLeg", "LeftFoot", "RightFoot", "Spine1", "Spine2", "LeftShoulder", "RightShoulder" };

        public static Transform[] Rig(Mesh mesh, Transform[] bones)
        {
            if (mesh == null || bones == null) return bones;
            var bw = mesh.boneWeights; var bp = new List<Matrix4x4>(mesh.bindposes);
            if (bw == null || bw.Length == 0 || bp.Count != bones.Length) return bones;
            var nb = new List<Transform>(bones);
            int moved = 0;
            foreach (var j in Joints)
            {
                int ci = -1;
                for (int i = 0; i < bones.Length; i++) if (bones[i] != null && GearFit.Tail(bones[i].name) == j) { ci = i; break; }
                if (ci < 0) continue;
                var child = bones[ci]; var parent = child.parent;
                int pi = parent != null ? System.Array.IndexOf(bones, parent) : -1;
                if (pi < 0) continue;
                // rest local rotation of the child from the bind poses (bones may be posed right now)
                var restLocal = (bp[pi] * bp[ci].inverse);
                var rest = Quaternion.LookRotation(restLocal.GetColumn(2), restLocal.GetColumn(1));
                string hn = child.name + "_hmvol";
                var h = parent.Find(hn);
                if (h == null)
                {
                    h = new GameObject(hn).transform; h.SetParent(parent, false);
                    var d = h.gameObject.AddComponent<HalfTurn>(); d.src = child; d.rest = rest;
                    h.localPosition = child.localPosition; h.localRotation = rest; h.localScale = child.localScale;
                }
                int hi = nb.Count; nb.Add(h); bp.Add(bp[ci]);
                for (int v = 0; v < bw.Length; v++)
                {
                    var w = bw[v];
                    float wc = W(w, ci), wp = W(w, pi);
                    if (wc < 0.03f || wp < 0.03f) continue;
                    int small = wc < wp ? ci : pi; float m = Mathf.Min(wc, wp);
                    // the smaller of the two hands its weight over; the larger gives the same amount
                    int big = small == ci ? pi : ci;
                    Set(ref w, small, hi, 2f * m); Add(ref w, big, -m);
                    bw[v] = w; moved++;
                }
            }
            if (moved == 0) return bones;
            for (int v = 0; v < bw.Length; v++) bw[v] = Norm(bw[v]);
            mesh.bindposes = bp.ToArray(); mesh.boneWeights = bw;
            Debug.Log("Hollowmere gear volume helpers " + mesh.name + " moved=" + moved + " bones=" + nb.Count);
            return nb.ToArray();
        }

        static float W(BoneWeight b, int i) => (b.boneIndex0 == i ? b.weight0 : 0) + (b.boneIndex1 == i ? b.weight1 : 0) + (b.boneIndex2 == i ? b.weight2 : 0) + (b.boneIndex3 == i ? b.weight3 : 0);
        static void Set(ref BoneWeight b, int from, int to, float w)
        {
            if (b.boneIndex0 == from && b.weight0 > 0) { b.boneIndex0 = to; b.weight0 = w; return; }
            if (b.boneIndex1 == from && b.weight1 > 0) { b.boneIndex1 = to; b.weight1 = w; return; }
            if (b.boneIndex2 == from && b.weight2 > 0) { b.boneIndex2 = to; b.weight2 = w; return; }
            if (b.boneIndex3 == from && b.weight3 > 0) { b.boneIndex3 = to; b.weight3 = w; }
        }
        static void Add(ref BoneWeight b, int i, float d)
        {
            if (b.boneIndex0 == i) b.weight0 = Mathf.Max(0, b.weight0 + d); else if (b.boneIndex1 == i) b.weight1 = Mathf.Max(0, b.weight1 + d);
            else if (b.boneIndex2 == i) b.weight2 = Mathf.Max(0, b.weight2 + d); else if (b.boneIndex3 == i) b.weight3 = Mathf.Max(0, b.weight3 + d);
        }
        static BoneWeight Norm(BoneWeight b)
        {
            float s = b.weight0 + b.weight1 + b.weight2 + b.weight3; if (s <= 1e-5f) return b;
            b.weight0 /= s; b.weight1 /= s; b.weight2 /= s; b.weight3 /= s; return b;
        }
    }

    /// <summary>Follows a joint at half its rotation from rest (see VolumeHelpers). Runs after IK and the idle rest.</summary>
    [DefaultExecutionOrder(100)]
    public sealed class HalfTurn : MonoBehaviour
    {
        public Transform src; public Quaternion rest;
        void LateUpdate() => Apply();
        public void Apply()
        {
            if (src == null) return;
            transform.localPosition = src.localPosition;
            transform.localRotation = Quaternion.Slerp(rest, src.localRotation, 0.5f);
        }
    }
}
