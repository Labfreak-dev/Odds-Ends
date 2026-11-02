using System.Collections.Generic;
using Hollowmere.Core;
using UnityEngine;

namespace Hollowmere
{
    /// <summary>
    /// Phone-camera fix for oversized lower-tier armour (v8 t1/t2 refits and some mixed-family pieces).
    /// Those meshes stood 20-40 cm off the bare body: a 1.5 m leather mantle, boot shells around the shins,
    /// robe skirts. They passed the clip/gap QA, which only measured skin poking out, never standoff.
    /// In bind space every gear vertex farther than the slot's allowance from the nearest body vertex is
    /// pulled in (soft: the excess keeps 15 %), and a vertex pulled hard takes the body vertex's bone weights,
    /// so a boot follows the foot instead of the shin.
    /// </summary>
    public static class GearConform
    {
        public static bool Enabled = true;
        const float Cell = 0.04f;
        static Mesh cachedBody;
        static Dictionary<Vector3Int, List<int>> grid;
        static Vector3[] bodyV;
        static BoneWeight[] bodyW;

        public static float Allowance(EquipSlot slot)
        {
            switch (slot)
            {
                case EquipSlot.Head: return 0.085f;
                case EquipSlot.Shoulders: return 0.11f;
                case EquipSlot.Chest: return 0.075f;
                case EquipSlot.Waist: return 0.075f;
                case EquipSlot.Legs: return 0.06f;
                case EquipSlot.Feet: return 0.055f;
                default: return 0.05f;
            }
        }

        static void Build(Mesh body)
        {
            if (cachedBody == body && grid != null) return;
            cachedBody = body;
            bodyV = body.vertices;
            bodyW = body.boneWeights;
            grid = new Dictionary<Vector3Int, List<int>>();
            for (int i = 0; i < bodyV.Length; i++)
            {
                var k = Vector3Int.FloorToInt(bodyV[i] / Cell);
                if (!grid.TryGetValue(k, out var l)) grid[k] = l = new List<int>();
                l.Add(i);
            }
        }

        public static int Nearest(Vector3 p, out float dist)
        {
            var k = Vector3Int.FloorToInt(p / Cell);
            int best = -1; float bd = float.MaxValue;
            for (int r = 0; r <= 12; r++)
            {
                if (best >= 0 && bd < (r - 1) * Cell * (r - 1) * Cell) break;
                for (int x = -r; x <= r; x++) for (int y = -r; y <= r; y++) for (int z = -r; z <= r; z++)
                {
                    if (Mathf.Max(Mathf.Abs(x), Mathf.Max(Mathf.Abs(y), Mathf.Abs(z))) != r) continue;
                    if (!grid.TryGetValue(k + new Vector3Int(x, y, z), out var l)) continue;
                    foreach (var i in l) { float d = (bodyV[i] - p).sqrMagnitude; if (d < bd) { bd = d; best = i; } }
                }
            }
            dist = best >= 0 ? Mathf.Sqrt(bd) : 0f;
            return best;
        }

        static bool Follow(EquipSlot s) => s == EquipSlot.Legs || s == EquipSlot.Feet || s == EquipSlot.Waist || s == EquipSlot.Chest || s == EquipSlot.Hands || s == EquipSlot.Wrists;

        public static void Apply(Mesh mesh, EquipSlot slot, Mesh body)
        {
            if (!Enabled || mesh == null || body == null || !body.isReadable) return;
            if (slot == EquipSlot.MainHand || slot == EquipSlot.OffHand) return;
            Build(body);
            float allow = Allowance(slot);
            var v = mesh.vertices;
            var w = mesh.boneWeights;
            bool hasW = w != null && w.Length == v.Length && bodyW != null && bodyW.Length == bodyV.Length;
            int moved = 0;
            for (int i = 0; i < v.Length; i++)
            {
                int n = Nearest(v[i], out float d);
                // Cloth-like slots follow the skin exactly: legs/feet/waist/chest/hands/wrists take the nearest body
                // vertex's weights everywhere (the lower-tier meshes had thigh verts weighted to the hips, which
                // ballooned in the run pose). Rigid slots (head, shoulders) keep their own weights.
                if (n >= 0 && hasW && Follow(slot)) { w[i] = bodyW[n]; moved++; }
                if (n < 0 || d <= allow) continue;
                float keep = allow + (d - allow) * 0.15f;
                v[i] = bodyV[n] + (v[i] - bodyV[n]) * (keep / d);
                if (hasW && d > allow * ((slot == EquipSlot.Legs || slot == EquipSlot.Feet) ? 1f : 2f)) w[i] = bodyW[n];
                moved++;
            }
            if (moved == 0) return;
            mesh.vertices = v;
            if (hasW) mesh.boneWeights = w;
            mesh.RecalculateNormals();
            mesh.RecalculateBounds();
            Debug.Log("Hollowmere gear conform " + slot + " moved " + moved + "/" + v.Length + " allow=" + allow);
        }
    }
}
