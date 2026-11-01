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

        static readonly Key[] Hit =
        {
            new Key { T = 0.10f, Bone = "Spine1", Euler = new Vector3(-8f, 6f, 0f) },
            new Key { T = 0.10f, Bone = "Spine2", Euler = new Vector3(-10f, 4f, 0f) },
            new Key { T = 0.10f, Bone = "Neck", Euler = new Vector3(-6f, -6f, 0f) },
            new Key { T = 0.10f, Bone = "Head", Euler = new Vector3(-12f, -14f, 4f) },
            new Key { T = 0.10f, Bone = "LeftShoulder", Euler = new Vector3(0f, 0f, 10f) },
            new Key { T = 0.10f, Bone = "RightShoulder", Euler = new Vector3(0f, 0f, -10f) },
            new Key { T = 0.10f, Bone = "LeftArm", Euler = new Vector3(12f, 0f, 8f) },
            new Key { T = 0.10f, Bone = "RightArm", Euler = new Vector3(12f, 0f, -8f) },

            new Key { T = 0.24f, Bone = "Spine", Euler = new Vector3(-6f, 4f, 0f) },
            new Key { T = 0.24f, Bone = "Spine1", Euler = new Vector3(-16f, 10f, 0f) },
            new Key { T = 0.24f, Bone = "Spine2", Euler = new Vector3(-22f, 8f, 0f) },
            new Key { T = 0.24f, Bone = "Neck", Euler = new Vector3(-10f, -8f, 0f) },
            new Key { T = 0.24f, Bone = "Head", Euler = new Vector3(-20f, -18f, 6f) },
            new Key { T = 0.24f, Bone = "LeftShoulder", Euler = new Vector3(0f, 0f, 16f) },
            new Key { T = 0.24f, Bone = "RightShoulder", Euler = new Vector3(0f, 0f, -16f) },
            new Key { T = 0.24f, Bone = "LeftArm", Euler = new Vector3(22f, 0f, 14f) },
            new Key { T = 0.24f, Bone = "RightArm", Euler = new Vector3(22f, 0f, -14f) },
            new Key { T = 0.24f, Bone = "LeftForeArm", Euler = new Vector3(0f, 0f, -18f) },
            new Key { T = 0.24f, Bone = "RightForeArm", Euler = new Vector3(0f, 0f, 18f) },
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

            new Key { T = 1.20f, Bone = "Hips", Euler = new Vector3(74f, 6f, 0f) },
            new Key { T = 1.20f, Bone = "Spine", Euler = new Vector3(20f, 0f, 0f) },
            new Key { T = 1.20f, Bone = "Spine1", Euler = new Vector3(16f, 0f, 0f) },
            new Key { T = 1.20f, Bone = "Spine2", Euler = new Vector3(10f, 0f, 0f) },
            new Key { T = 1.20f, Bone = "Neck", Euler = new Vector3(8f, 0f, 0f) },
            new Key { T = 1.20f, Bone = "Head", Euler = new Vector3(14f, -4f, 0f) },
            new Key { T = 1.20f, Bone = "LeftUpLeg", Euler = new Vector3(34f, 0f, 0f) },
            new Key { T = 1.20f, Bone = "RightUpLeg", Euler = new Vector3(34f, 0f, 0f) },
            new Key { T = 1.20f, Bone = "LeftLeg", Euler = new Vector3(-30f, 0f, 0f) },
            new Key { T = 1.20f, Bone = "RightLeg", Euler = new Vector3(-30f, 0f, 0f) },
            new Key { T = 1.20f, Bone = "LeftArm", Euler = new Vector3(24f, 0f, 28f) },
            new Key { T = 1.20f, Bone = "RightArm", Euler = new Vector3(24f, 0f, -28f) },
        };

        public static void Attach(ModelAnim ma)
        {
            if (ma == null || ma.anim == null) return;
            bool hit = Has(ma.anim, "hit");
            bool death = Has(ma.anim, "death");
            if (hit && death) return;
            var skin = ma.anim.GetComponentInChildren<SkinnedMeshRenderer>();
            if (skin == null || skin.bones == null || skin.bones.Length < 8) return;
            if (!hit) ma.anim.AddClip(Build(ma.anim.transform, skin.bones, "hit", 0.50f, Hit), "hit");
            if (!death) ma.anim.AddClip(Build(ma.anim.transform, skin.bones, "death", 1.20f, Death), "death");
            ma.Forget();
        }

        static bool Has(Animation anim, string name)
        {
            foreach (AnimationState s in anim)
                if (s != null && s.clip != null && s.name == name) return true;
            return false;
        }

        static AnimationClip Build(Transform root, Transform[] bones, string name, float length, Key[] motion)
        {
            var clip = new AnimationClip { name = name, legacy = true, frameRate = 24f, wrapMode = WrapMode.ClampForever };
            var times = new List<float> { 0f, length };
            for (int i = 0; i < motion.Length; i++)
                if (!times.Contains(motion[i].T)) times.Add(motion[i].T);
            times.Sort();
            for (int b = 0; b < bones.Length; b++)
            {
                var bone = bones[b];
                if (bone == null) continue;
                string tail = Tail(bone.name);
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
                string path = Rel(root, bone);
                if (path == null) continue;
                clip.SetCurve(path, typeof(Transform), "localRotation.x", cx);
                clip.SetCurve(path, typeof(Transform), "localRotation.y", cy);
                clip.SetCurve(path, typeof(Transform), "localRotation.z", cz);
                clip.SetCurve(path, typeof(Transform), "localRotation.w", cw);
            }
            clip.EnsureQuaternionContinuity();
            return clip;
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
