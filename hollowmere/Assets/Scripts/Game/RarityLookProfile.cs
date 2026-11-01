using System;
using Hollowmere.Core;
using UnityEngine;

namespace Hollowmere
{
    /// <summary>
    /// Rarity presentation. Resources/RarityLook is the player-facing table.
    /// Field defaults match <see cref="RarityTable"/> so a missing asset still separates the five rarities.
    /// </summary>
    public sealed class RarityLookProfile : ScriptableObject
    {
        public RarityRow[] rows;
        public FamilyGlow[] sets;
        public TrailTint[] trails;
        public float vfxPad = RarityTable.VfxPad;
        public float emitPresent = RarityTable.EmitPresent;

        [Serializable]
        public class RarityRow
        {
            public int rarity;
            public int tier = 1;
            public float r = 1f, g = 1f, b = 1f, metal, smooth = 0.3f, desat, finish, emit, rim = 4f, edge;
            public int modelPick;
            public string meshFamily;
            public int uniqueModel;
            public int vfx;
            public float glowR = 1f, glowG = 1f, glowB = 1f;
            public float rate, size = 0.03f, lift = 0.04f;
        }

        [Serializable]
        public class FamilyGlow
        {
            public string family;
            public float r = 1f, g = 1f, b = 1f;
        }

        [Serializable]
        public class TrailTint
        {
            public string kind;
            public float r = 1f, g = 1f, b = 1f;
        }

        public static RarityLookProfile FromTable()
        {
            var profile = CreateInstance<RarityLookProfile>();
            profile.rows = new RarityRow[RarityTable.Count];
            for (int i = 0; i < profile.rows.Length; i++)
            {
                var src = RarityTable.Get((Rarity)i);
                profile.rows[i] = new RarityRow
                {
                    rarity = (int)src.Rarity,
                    tier = src.Tier,
                    r = src.R, g = src.G, b = src.B,
                    metal = src.Metal, smooth = src.Smooth, desat = src.Desat, finish = src.Finish,
                    emit = src.Emit, rim = src.Rim, edge = src.Edge,
                    modelPick = src.ModelPick, meshFamily = src.MeshFamily ?? "",
                    uniqueModel = src.UniqueModel ? 1 : 0,
                    vfx = src.Vfx ? 1 : 0,
                    glowR = src.GlowR, glowG = src.GlowG, glowB = src.GlowB,
                    rate = src.Rate, size = src.Size, lift = src.Lift,
                };
            }
            string[] families = { "plate", "leather", "arcane", "bone", "infernal" };
            profile.sets = new FamilyGlow[families.Length];
            for (int i = 0; i < families.Length; i++)
            {
                var g = RarityTable.SetGlow(families[i]);
                profile.sets[i] = new FamilyGlow { family = families[i], r = g.R, g = g.G, b = g.B };
            }
            string[] kinds = { "ember", "frost", "arcane", "shadow" };
            profile.trails = new TrailTint[kinds.Length];
            for (int i = 0; i < kinds.Length; i++)
            {
                var g = RarityTable.Trail(kinds[i]);
                profile.trails[i] = new TrailTint { kind = kinds[i], r = g.R, g = g.G, b = g.B };
            }
            profile.vfxPad = RarityTable.VfxPad;
            profile.emitPresent = RarityTable.EmitPresent;
            return profile;
        }
    }

    public static class RarityBook
    {
        static RarityLookProfile loaded;

        public static RarityLookProfile Active
        {
            get
            {
                if (loaded == null) loaded = Resources.Load<RarityLookProfile>("RarityLook");
                if (loaded == null || loaded.rows == null || loaded.rows.Length < 5) loaded = RarityLookProfile.FromTable();
                return loaded;
            }
        }

        public static RarityLookProfile.RarityRow Row(Rarity rarity)
        {
            var rows = Active.rows;
            int want = (int)rarity;
            for (int i = 0; i < rows.Length; i++)
                if (rows[i] != null && rows[i].rarity == want) return rows[i];
            return rows[Mathf.Clamp(want, 0, rows.Length - 1)];
        }

        public static Color Glow(Rarity rarity, string family)
        {
            if (rarity == Rarity.Set && Active.sets != null)
            {
                for (int i = 0; i < Active.sets.Length; i++)
                {
                    var s = Active.sets[i];
                    if (s != null && s.family == family) return new Color(s.r, s.g, s.b, 1f);
                }
            }
            var row = Row(rarity);
            return new Color(row.glowR, row.glowG, row.glowB, 1f);
        }

        public static Color TrailColor(string kind)
        {
            if (Active.trails != null)
            {
                for (int i = 0; i < Active.trails.Length; i++)
                {
                    var t = Active.trails[i];
                    if (t != null && t.kind == kind) return new Color(t.r, t.g, t.b, 1f);
                }
            }
            var g = RarityTable.Trail(kind);
            return new Color(g.R, g.G, g.B, 1f);
        }

        public static float Pad => Active.vfxPad > 0.01f ? Active.vfxPad : RarityTable.VfxPad;
        public static float EmitFloor => Active.emitPresent > 0f ? Active.emitPresent : RarityTable.EmitPresent;

        public static int ModelPick(Rarity rarity)
        {
            var row = Row(rarity);
            return row != null ? row.modelPick : RarityTable.Get(rarity).ModelPick;
        }

        /// <summary>Empty mesh family keeps the item family. A named one is the set folder to load.</summary>
        public static string MeshFamily(string family, Rarity rarity)
        {
            if (string.IsNullOrEmpty(family)) family = "plate";
            var row = Row(rarity);
            if (row == null || string.IsNullOrEmpty(row.meshFamily) || row.meshFamily == family) return family;
            return row.meshFamily;
        }

        /// <summary>Visual tier from the asset, so a later row edit picks up Gear/Lower without a code change.</summary>
        public static int VisualTier(Rarity rarity, int stored)
        {
            var row = Row(rarity);
            if (row != null && row.tier >= 1 && row.tier <= GearTable.TierCount) return row.tier;
            return GearTable.TierOf(stored, rarity);
        }
    }
}
