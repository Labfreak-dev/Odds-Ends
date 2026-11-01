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
        /// <summary>Two shells closer than this over the same skin are z-fighting.</summary>
        public const float OverlapMetres = 0.003f;
        /// <summary>A lying hero is this thin, and the torso axis is this close to horizontal.</summary>
        public const float DeathFlatHeight = 0.55f;
        public const float DeathFlatUp = 0.35f;

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

        /// <summary>Body regions cut once from dominant bone weight. Equip toggles whole regions.</summary>
        public enum BodyRegion
        {
            Head = 0,
            UpperTorso = 1,
            UpperArm = 2,
            LowerArm = 3,
            Hand = 4,
            Waist = 5,
            Thigh = 6,
            Shin = 7,
            Foot = 8,
            Count = 9,
        }

        /// <summary>Earlier slots win when two pieces hide the same region. Chest beats shoulders.</summary>
        public static readonly EquipSlot[] HidePriority =
        {
            EquipSlot.Chest, EquipSlot.Shoulders, EquipSlot.Head, EquipSlot.Waist,
            EquipSlot.Legs, EquipSlot.Feet, EquipSlot.Wrists, EquipSlot.Hands,
        };

        public static int RegionForBone(string bone)
        {
            string n = Tail(bone);
            if (n.Length == 0) return -1;
            if (Same(n, "Head") || Same(n, "HeadFront") || Same(n, "HeadTop_End")) return (int)BodyRegion.Head;
            if (Same(n, "Neck") || Same(n, "Spine1") || Same(n, "Spine2")) return (int)BodyRegion.UpperTorso;
            if (Same(n, "LeftShoulder") || Same(n, "RightShoulder") || Same(n, "LeftArm") || Same(n, "RightArm"))
                return (int)BodyRegion.UpperArm;
            if (Same(n, "LeftForeArm") || Same(n, "RightForeArm")) return (int)BodyRegion.LowerArm;
            if (Same(n, "LeftHand") || Same(n, "RightHand")) return (int)BodyRegion.Hand;
            if (Same(n, "Hips") || Same(n, "Spine")) return (int)BodyRegion.Waist;
            if (Same(n, "LeftUpLeg") || Same(n, "RightUpLeg")) return (int)BodyRegion.Thigh;
            if (Same(n, "LeftLeg") || Same(n, "RightLeg")) return (int)BodyRegion.Shin;
            if (Same(n, "LeftFoot") || Same(n, "RightFoot") || Same(n, "LeftToeBase") || Same(n, "RightToeBase"))
                return (int)BodyRegion.Foot;
            return -1;
        }

        public static string RegionName(int region)
        {
            if (region < 0 || region >= (int)BodyRegion.Count) return "none";
            return ((BodyRegion)region).ToString();
        }

        /// <summary>Which body regions a piece turns off. Shoulders do not take the torso; chest does.</summary>
        public static bool Hides(EquipSlot slot, int region)
        {
            switch (slot)
            {
                case EquipSlot.Head: return region == (int)BodyRegion.Head;
                case EquipSlot.Shoulders: return region == (int)BodyRegion.UpperArm;
                case EquipSlot.Chest: return region == (int)BodyRegion.UpperTorso;
                case EquipSlot.Hands: return region == (int)BodyRegion.Hand;
                case EquipSlot.Wrists: return region == (int)BodyRegion.LowerArm;
                case EquipSlot.Waist: return region == (int)BodyRegion.Waist;
                case EquipSlot.Legs: return region == (int)BodyRegion.Thigh || region == (int)BodyRegion.Shin;
                case EquipSlot.Feet: return region == (int)BodyRegion.Foot;
                default: return false;
            }
        }

        /// <summary>The worn piece that draws a region. Null when the skin stays on.</summary>
        public static EquipSlot? RegionOwner(bool[] worn, int region)
        {
            if (worn == null) return null;
            for (int i = 0; i < HidePriority.Length; i++)
            {
                var slot = HidePriority[i];
                int idx = (int)slot;
                if (idx < 0 || idx >= worn.Length || !worn[idx]) continue;
                if (Hides(slot, region)) return slot;
            }
            return null;
        }

        public static bool WeightsOk(float sum) => sum >= MinWeightSum && sum <= MaxWeightSum;

        public static bool GapOk(float metres) => metres >= MinGap && metres <= MaxGap;

        public static bool Covered(float metres) => metres <= MaxGap;

        public static bool VisibleClear(float metres) => metres >= MinGap;

        public static bool StretchOk(float ratio) => ratio >= MinStretch && ratio <= MaxStretch;

        /// <summary>True when two shell points over the same body spot are close enough to z-fight.</summary>
        public static bool ShellsOverlap(float betweenMetres, float firstGap, float secondGap)
            => betweenMetres <= OverlapMetres && firstGap <= MaxGap && secondGap <= MaxGap;

        /// <summary>Final death frame: torso axis horizontal, body on the floor, not still kneeling.</summary>
        public static bool DeathFlat(float torsoUpY, float minY, float height)
        {
            if (torsoUpY < 0f) torsoUpY = -torsoUpY;
            return torsoUpY < DeathFlatUp && minY > -0.35f && minY < 0.25f && height > 0.08f && height < DeathFlatHeight;
        }

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
