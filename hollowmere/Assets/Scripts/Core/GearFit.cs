using System;

namespace Hollowmere.Core
{
    /// <summary>
    /// Fit rules for armour skinned to the v5 hero. A piece ships only when every
    /// pose keeps it on the body: no clip, float, stretch, z-fight, or hole.
    /// </summary>
    public static class GearFit
    {
        public const float ShellOffset = 0.012f;
        /// <summary>Closer than this and the shell z-fights or sinks into the body.</summary>
        public const float MinGap = 0.002f;
        /// <summary>Farther than this and the piece is floating off the body.</summary>
        public const float MaxGap = 0.035f;
        public const float MinWeightSum = 0.98f;
        public const float MaxWeightSum = 1.02f;
        /// <summary>Animated distance from the dominant bone, over the bind-pose distance.</summary>
        public const float MinStretch = 0.45f;
        public const float MaxStretch = 2.4f;
        public const int MinShellVerts = 24;

        public static readonly EquipSlot[] Visible =
        {
            EquipSlot.Head, EquipSlot.Shoulders, EquipSlot.Chest, EquipSlot.Hands,
            EquipSlot.Wrists, EquipSlot.Waist, EquipSlot.Legs, EquipSlot.Feet,
        };

        /// <summary>Slots that share a seam. Mix checks cover every pair.</summary>
        public static readonly (EquipSlot a, EquipSlot b)[] Adjacent =
        {
            (EquipSlot.Head, EquipSlot.Shoulders),
            (EquipSlot.Shoulders, EquipSlot.Chest),
            (EquipSlot.Shoulders, EquipSlot.Hands),
            (EquipSlot.Hands, EquipSlot.Wrists),
            (EquipSlot.Chest, EquipSlot.Waist),
            (EquipSlot.Waist, EquipSlot.Legs),
            (EquipSlot.Legs, EquipSlot.Feet),
        };

        /// <summary>At least one clip in each group has to be on the hero. Hit and death are skeletal clips, sampled with the rest.</summary>
        public static readonly string[][] RequiredPoses =
        {
            new[] { "idle" },
            new[] { "run", "walk" },
            new[] { "attack", "swing" },
            new[] { "hit" },
            new[] { "death" },
        };

        /// <summary>Sampled when the hero actually has the clip.</summary>
        public static readonly string[][] OptionalPoses =
        {
            new[] { "dodge", "roll" },
            new[] { "cast", "spell" },
            new[] { "fish" },
        };

        public static bool IsVisible(EquipSlot slot)
        {
            for (int i = 0; i < Visible.Length; i++)
                if (Visible[i] == slot) return true;
            return false;
        }

        public static string SlotName(EquipSlot slot)
        {
            switch (slot)
            {
                case EquipSlot.Head: return "head";
                case EquipSlot.Shoulders: return "shoulders";
                case EquipSlot.Chest: return "chest";
                case EquipSlot.Hands: return "hands";
                case EquipSlot.Wrists: return "wrists";
                case EquipSlot.Waist: return "waist";
                case EquipSlot.Legs: return "legs";
                case EquipSlot.Feet: return "feet";
                default: return null;
            }
        }

        public static EquipSlot? SlotForBone(string bone)
        {
            string n = Tail(bone);
            if (n.Length == 0) return null;
            if (Same(n, "Head") || Same(n, "Neck")) return EquipSlot.Head;
            if (Same(n, "LeftShoulder") || Same(n, "RightShoulder") || Same(n, "LeftArm") || Same(n, "RightArm"))
                return EquipSlot.Shoulders;
            if (Same(n, "Spine1") || Same(n, "Spine2")) return EquipSlot.Chest;
            if (Same(n, "LeftHand") || Same(n, "RightHand")) return EquipSlot.Hands;
            if (Same(n, "LeftForeArm") || Same(n, "RightForeArm")) return EquipSlot.Wrists;
            if (Same(n, "Hips") || Same(n, "Spine")) return EquipSlot.Waist;
            if (Same(n, "LeftUpLeg") || Same(n, "RightUpLeg") || Same(n, "LeftLeg") || Same(n, "RightLeg"))
                return EquipSlot.Legs;
            if (Same(n, "LeftFoot") || Same(n, "RightFoot") || Same(n, "LeftToeBase") || Same(n, "RightToeBase"))
                return EquipSlot.Feet;
            return null;
        }

        public static bool WeightsOk(float sum) => sum >= MinWeightSum && sum <= MaxWeightSum;

        public static bool GapOk(float metres) => metres >= MinGap && metres <= MaxGap;

        public static bool Covered(float metres) => metres <= MaxGap;

        public static bool VisibleClear(float metres) => metres >= MinGap;

        public static bool StretchOk(float ratio) => ratio >= MinStretch && ratio <= MaxStretch;

        public static bool PoseMatch(string clipName, string key)
        {
            if (string.IsNullOrEmpty(clipName) || string.IsNullOrEmpty(key)) return false;
            string n = clipName.ToLowerInvariant();
            key = key.ToLowerInvariant();
            return n == key || n.EndsWith("|" + key) || n.Contains("|" + key + "|") || n.EndsWith("_" + key) || n.Contains(key);
        }

        public static bool HasRequiredPose(string[] clipNames, string[] group)
        {
            if (clipNames == null || group == null) return false;
            for (int g = 0; g < group.Length; g++)
                for (int i = 0; i < clipNames.Length; i++)
                    if (PoseMatch(clipNames[i], group[g])) return true;
            return false;
        }

        /// <summary>Deterministic mix of visible slots. The same seed always returns the same set.</summary>
        public static EquipSlot[] Mix(int seed, int count)
        {
            count = Math.Max(1, Math.Min(count, Visible.Length));
            var pick = new EquipSlot[count];
            var used = new bool[Visible.Length];
            uint s = (uint)seed;
            if (s == 0) s = 1;
            int n = 0;
            int guard = 0;
            while (n < count && guard++ < 64)
            {
                s = s * 1664525u + 1013904223u;
                int i = (int)(s % (uint)Visible.Length);
                if (used[i]) continue;
                used[i] = true;
                pick[n++] = Visible[i];
            }
            return pick;
        }

        public static string Tail(string bone)
        {
            if (string.IsNullOrEmpty(bone)) return "";
            int cut = bone.LastIndexOf(':');
            int slash = bone.LastIndexOf('/');
            int start = cut > slash ? cut : slash;
            return start >= 0 ? bone.Substring(start + 1) : bone;
        }

        static bool Same(string a, string b) => string.Equals(a, b, StringComparison.OrdinalIgnoreCase);
    }
}
