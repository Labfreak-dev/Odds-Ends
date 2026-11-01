using System.Collections.Generic;
using UnityEngine;

namespace Hollowmere
{
    /// <summary>
    /// Hit and death takes keyed on the live mixamorig rest pose. The v5 file only
    /// has idle, walk and run, and tipping the actor root is not a death.
    /// Local X pitches a Mixamo bone (Y runs to the child). Angles stay small
    /// enough that a shell skinned to the same bones does not fold through itself.
    /// </summary>
    public static class HeroReact
    {
        struct Key
        {
            public float T;
            public string Bone;
            public Vector3 Euler;
        }

        struct Drop
        {
            public float T;
            public Vector3 Delta;
        }

        // Death falls forward on +X of the hips. The flinch is the opposite sign, on the
        // hips and the head only, so it cannot fold the chest down to the belt.
        static readonly Key[] Hit =
        {
            new Key { T = 0.12f, Bone = "Hips", Euler = new Vector3(-14f, 10f, 0f) },
            new Key { T = 0.12f, Bone = "Head", Euler = new Vector3(-12f, -16f, 0f) },

            new Key { T = 0.30f, Bone = "Hips", Euler = new Vector3(-28f, 18f, 0f) },
            new Key { T = 0.30f, Bone = "Spine2", Euler = new Vector3(-12f, 0f, 0f) },
            new Key { T = 0.30f, Bone = "Head", Euler = new Vector3(-24f, -28f, 0f) },
        };

        static readonly Key[] Death =
        {
            new Key { T = 0.18f, Bone = "Spine1", Euler = new Vector3(-12f, 4f, 0f) },
            new Key { T = 0.18f, Bone = "Spine2", Euler = new Vector3(-16f, 2f, 0f) },
            new Key { T = 0.18f, Bone = "Head", Euler = new Vector3(-18f, -8f, 0f) },
            new Key { T = 0.18f, Bone = "Neck", Euler = new Vector3(-8f, -4f, 0f) },

            new Key { T = 0.48f, Bone = "Hips", Euler = new Vector3(26f, 4f, 0f) },
            new Key { T = 0.48f, Bone = "Spine", Euler = new Vector3(12f, 0f, 0f) },
            new Key { T = 0.48f, Bone = "Spine1", Euler = new Vector3(14f, 0f, 0f) },
            new Key { T = 0.48f, Bone = "Spine2", Euler = new Vector3(10f, 0f, 0f) },
            new Key { T = 0.48f, Bone = "Head", Euler = new Vector3(12f, 0f, 0f) },
            new Key { T = 0.48f, Bone = "LeftUpLeg", Euler = new Vector3(16f, 0f, 0f) },
            new Key { T = 0.48f, Bone = "RightUpLeg", Euler = new Vector3(16f, 0f, 0f) },
            new Key { T = 0.48f, Bone = "LeftLeg", Euler = new Vector3(-14f, 0f, 0f) },
            new Key { T = 0.48f, Bone = "RightLeg", Euler = new Vector3(-14f, 0f, 0f) },
            new Key { T = 0.48f, Bone = "LeftArm", Euler = new Vector3(10f, 0f, 12f) },
            new Key { T = 0.48f, Bone = "RightArm", Euler = new Vector3(10f, 0f, -12f) },

            new Key { T = 0.85f, Bone = "Hips", Euler = new Vector3(58f, 8f, 0f) },
            new Key { T = 0.85f, Bone = "Spine", Euler = new Vector3(22f, 0f, 0f) },
            new Key { T = 0.85f, Bone = "Spine1", Euler = new Vector3(18f, 0f, 0f) },
            new Key { T = 0.85f, Bone = "Spine2", Euler = new Vector3(12f, 0f, 0f) },
            new Key { T = 0.85f, Bone = "Head", Euler = new Vector3(16f, -6f, 0f) },
            new Key { T = 0.85f, Bone = "LeftUpLeg", Euler = new Vector3(28f, 0f, 0f) },
            new Key { T = 0.85f, Bone = "RightUpLeg", Euler = new Vector3(28f, 0f, 0f) },
            new Key { T = 0.85f, Bone = "LeftLeg", Euler = new Vector3(-24f, 0f, 0f) },
            new Key { T = 0.85f, Bone = "RightLeg", Euler = new Vector3(-24f, 0f, 0f) },
            new Key { T = 0.85f, Bone = "LeftArm", Euler = new Vector3(18f, 0f, 20f) },
            new Key { T = 0.85f, Bone = "RightArm", Euler = new Vector3(18f, 0f, -20f) },

            // End flat: hips pitch the bind pose onto its face and drop to the floor.
            // Extra knee and spine bend here is what left the body hunched.
            new Key { T = 1.35f, Bone = "Hips", Euler = new Vector3(90f, 4f, 0f) },
            new Key { T = 1.35f, Bone = "Head", Euler = new Vector3(6f, -28f, 8f) },
            new Key { T = 1.35f, Bone = "LeftUpLeg", Euler = new Vector3(6f, 0f, 0f) },
            new Key { T = 1.35f, Bone = "RightUpLeg", Euler = new Vector3(6f, 0f, 0f) },
            new Key { T = 1.35f, Bone = "LeftLeg", Euler = new Vector3(-4f, 0f, 0f) },
            new Key { T = 1.35f, Bone = "RightLeg", Euler = new Vector3(-4f, 0f, 0f) },
        };

        static readonly Drop[] DeathDrop =
        {
            new Drop { T = 0.48f, Delta = new Vector3(0f, -0.12f, 0.04f) },
            new Drop { T = 0.85f, Delta = new Vector3(0f, -0.40f, 0.12f) },
            new Drop { T = 1.35f, Delta = new Vector3(0f, -0.78f, 0.16f) },
        };

        public static void Attach(ModelAnim ma)
        {
            if (ma == null || ma.anim == null) return;
            bool hit = Has(ma.anim, "hit");
            bool death = Has(ma.anim, "death");
            if (hit && death) return;
            var skin = LargestSkin(ma.anim.transform);
            if (skin == null || skin.bones == null || skin.bones.Length < 8) return;
            if (!hit) ma.anim.AddClip(Build(ma.anim.transform, skin.bones, "hit", 0.60f, Hit, null), "hit");
            if (!death) ma.anim.AddClip(Build(ma.anim.transform, skin.bones, "death", 1.35f, Death, DeathDrop), "death");
            ma.Forget();
        }

        static bool Has(Animation anim, string name)
        {
            foreach (AnimationState s in anim)
                if (s != null && s.clip != null && s.name == name) return true;
            return false;
        }

        static SkinnedMeshRenderer LargestSkin(Transform root)
        {
            SkinnedMeshRenderer best = null;
            int n = 0;
            if (root == null) return null;
            var skins = root.GetComponentsInChildren<SkinnedMeshRenderer>(true);
            for (int i = 0; i < skins.Length; i++)
            {
                var smr = skins[i];
                if (smr == null || smr.gameObject.name.StartsWith("gear_")) continue;
                int c = smr.bones != null ? smr.bones.Length : 0;
                if (c > n) { n = c; best = smr; }
            }
            return best;
        }

        static AnimationClip Build(Transform root, Transform[] bones, string name, float length, Key[] motion, Drop[] drop)
        {
            var clip = new AnimationClip { name = name, legacy = true, frameRate = 24f, wrapMode = WrapMode.ClampForever };
            var times = new List<float> { 0f, length };
            for (int i = 0; i < motion.Length; i++)
                if (!times.Contains(motion[i].T)) times.Add(motion[i].T);
            if (drop != null)
                for (int i = 0; i < drop.Length; i++)
                    if (!times.Contains(drop[i].T)) times.Add(drop[i].T);
            times.Sort();
            for (int b = 0; b < bones.Length; b++)
            {
                var bone = bones[b];
                if (bone == null) continue;
                string tail = Tail(bone.name);
                string path = Rel(root, bone);
                if (path == null) continue;
                var rest = bone.localRotation;
                var cx = new AnimationCurve();
                var cy = new AnimationCurve();
                var cz = new AnimationCurve();
                var cw = new AnimationCurve();
                for (int t = 0; t < times.Count; t++)
                {
                    var q = rest * Quaternion.Euler(EulerAt(motion, tail, times[t]));
                    cx.AddKey(times[t], q.x);
                    cy.AddKey(times[t], q.y);
                    cz.AddKey(times[t], q.z);
                    cw.AddKey(times[t], q.w);
                }
                Linear(cx); Linear(cy); Linear(cz); Linear(cw);
                clip.SetCurve(path, typeof(Transform), "localRotation.x", cx);
                clip.SetCurve(path, typeof(Transform), "localRotation.y", cy);
                clip.SetCurve(path, typeof(Transform), "localRotation.z", cz);
                clip.SetCurve(path, typeof(Transform), "localRotation.w", cw);
                if (drop != null && string.Equals(tail, "Hips", System.StringComparison.OrdinalIgnoreCase))
                {
                    var restP = bone.localPosition;
                    var px = new AnimationCurve();
                    var py = new AnimationCurve();
                    var pz = new AnimationCurve();
                    for (int t = 0; t < times.Count; t++)
                    {
                        var p = restP + DropAt(drop, times[t]);
                        px.AddKey(times[t], p.x);
                        py.AddKey(times[t], p.y);
                        pz.AddKey(times[t], p.z);
                    }
                    Linear(px); Linear(py); Linear(pz);
                    clip.SetCurve(path, typeof(Transform), "localPosition.x", px);
                    clip.SetCurve(path, typeof(Transform), "localPosition.y", py);
                    clip.SetCurve(path, typeof(Transform), "localPosition.z", pz);
                }
            }
            clip.EnsureQuaternionContinuity();
            return clip;
        }

        static Vector3 DropAt(Drop[] drop, float time)
        {
            if (drop == null) return Vector3.zero;
            for (int i = 0; i < drop.Length; i++)
                if (drop[i].T == time) return drop[i].Delta;
            return Vector3.zero;
        }

        static Vector3 EulerAt(Key[] motion, string bone, float time)
        {
            for (int i = 0; i < motion.Length; i++)
                if (motion[i].T == time && string.Equals(motion[i].Bone, bone, System.StringComparison.OrdinalIgnoreCase))
                    return motion[i].Euler;
            return Vector3.zero;
        }

        static string Tail(string bone)
        {
            if (string.IsNullOrEmpty(bone)) return "";
            int cut = bone.LastIndexOf(':');
            int slash = bone.LastIndexOf('/');
            int start = cut > slash ? cut : slash;
            return start >= 0 ? bone.Substring(start + 1) : bone;
        }

        static string Rel(Transform root, Transform bone)
        {
            if (bone == root) return "";
            var names = new List<string>();
            var t = bone;
            while (t != null && t != root)
            {
                names.Add(t.name);
                t = t.parent;
            }
            if (t != root) return null;
            names.Reverse();
            return string.Join("/", names);
        }

        static void Linear(AnimationCurve curve)
        {
            for (int i = 0; i < curve.length; i++)
            {
                var key = curve[i];
                key.inTangent = 0f;
                key.outTangent = 0f;
                if (i > 0)
                {
                    var prev = curve[i - 1];
                    float dx = key.time - prev.time;
                    float tan = Mathf.Abs(dx) > 0.00001f ? (key.value - prev.value) / dx : 0f;
                    prev.outTangent = tan;
                    key.inTangent = tan;
                    curve.MoveKey(i - 1, prev);
                }
                curve.MoveKey(i, key);
            }
        }
    }
}
