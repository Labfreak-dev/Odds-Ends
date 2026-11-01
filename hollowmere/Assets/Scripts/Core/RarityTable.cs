namespace Hollowmere.Core
{
    /// <summary>
    /// Numbers mirrored by Resources/RarityLook.asset. The asset is what the game
    /// reads. These defaults keep a headless test able to check the same values.
    /// </summary>
    public static class RarityTable
    {
        public const float VfxPad = 0.15f;
        public const float EmitPresent = 0.05f;
        /// <summary>No emission or motes on the head, or on chest-top verts inside this sphere around the head bone.</summary>
        public const float FaceRadius = 0.22f;

        public readonly struct Row
        {
            public readonly Rarity Rarity;
            public readonly int Tier;
            public readonly float R, G, B, Metal, Smooth, Desat, Finish, Emit, Rim, Edge;
            public readonly int ModelPick;
            public readonly string MeshFamily;
            public readonly bool UniqueModel, Vfx;
            public readonly float GlowR, GlowG, GlowB;
            public readonly float Rate, Size, Lift;

            public Row(Rarity rarity, int tier, float r, float g, float b, float metal, float smooth, float desat, float finish,
                float emit, float rim, float edge, int modelPick, string meshFamily, bool unique, bool vfx,
                float glowR, float glowG, float glowB, float rate, float size, float lift)
            {
                Rarity = rarity; Tier = tier; R = r; G = g; B = b; Metal = metal; Smooth = smooth; Desat = desat; Finish = finish;
                Emit = emit; Rim = rim; Edge = edge; ModelPick = modelPick; MeshFamily = meshFamily;
                UniqueModel = unique; Vfx = vfx;
                GlowR = glowR; GlowG = glowG; GlowB = glowB; Rate = rate; Size = size; Lift = lift;
            }
        }

        public readonly struct Glow
        {
            public readonly string Id;
            public readonly float R, G, B;
            public Glow(string id, float r, float g, float b) { Id = id; R = r; G = g; B = b; }
        }

        static readonly Row[] Rows =
        {
            // r,g,b multiply the authored albedo. Finish pulls metal and smoothness toward the scalars
            // without discarding the maps. Rare leaves the maps alone and only adds a fresnel rim.
            new Row(Rarity.Common, 1, 0.84f, 0.77f, 0.70f, 0.08f, 0.14f, 0.40f, 0.62f, 0f, 4f, 0f, 0, "", false, false, 0.55f, 0.42f, 0.28f, 0f, 0.02f, 0.02f),
            new Row(Rarity.Magic, 1, 1.30f, 1.35f, 1.40f, 0.90f, 0.75f, 0f, 0.90f, 0f, 4f, 0f, 0, "", false, false, 0.78f, 0.84f, 0.92f, 0f, 0.02f, 0.02f),
            new Row(Rarity.Rare, 2, 1f, 1f, 1f, 0f, 0f, 0f, 0f, 1.20f, 2.5f, 0f, 0, "", false, false, 0.18f, 0.40f, 1.00f, 0f, 0.02f, 0.02f),
            new Row(Rarity.Legendary, 3, 1.02f, 1.00f, 0.98f, 0.35f, 0.48f, 0f, 0.12f, 0.70f, 4f, 2.6f, 1, "infernal", true, true, 1.00f, 0.42f, 0.08f, 8f, 0.035f, 0.02f),
            new Row(Rarity.Set, 3, 1.00f, 1.02f, 0.98f, 0.30f, 0.44f, 0f, 0.12f, 0.40f, 4f, 1.8f, 2, "arcane", true, true, 0.38f, 0.84f, 0.46f, 8f, 0.035f, 0.02f),
        };

        static readonly Glow[] Sets =
        {
            new Glow("plate", 0.38f, 0.84f, 0.46f),
            new Glow("leather", 0.38f, 0.84f, 0.46f),
            new Glow("arcane", 0.38f, 0.84f, 0.46f),
            new Glow("bone", 0.38f, 0.84f, 0.46f),
            new Glow("infernal", 0.38f, 0.84f, 0.46f),
        };

        static readonly Glow[] Trails =
        {
            new Glow("ember", 1.00f, 0.38f, 0.08f),
            new Glow("frost", 0.55f, 0.86f, 1.00f),
            new Glow("arcane", 0.62f, 0.35f, 1.00f),
            new Glow("shadow", 0.28f, 0.24f, 0.36f),
        };

        public static Row Get(Rarity rarity)
        {
            int i = (int)rarity;
            if (i < 0 || i >= Rows.Length) i = 0;
            return Rows[i];
        }

        public static int Count => Rows.Length;

        public static bool NeedsEmission(Rarity rarity) => rarity >= Rarity.Rare;

        public static Glow SetGlow(string family)
        {
            if (!string.IsNullOrEmpty(family))
                for (int i = 0; i < Sets.Length; i++)
                    if (Sets[i].Id == family) return Sets[i];
            return Sets[0];
        }

        public static Glow Trail(string kind)
        {
            if (!string.IsNullOrEmpty(kind))
                for (int i = 0; i < Trails.Length; i++)
                    if (Trails[i].Id == kind) return Trails[i];
            return Trails[0];
        }

        public static string TrailKind(Element element)
        {
            switch (element)
            {
                case Element.Fire: return "ember";
                case Element.Frost: return "frost";
                case Element.Arcane:
                case Element.Lightning: return "arcane";
                default: return "shadow";
            }
        }
    }
}
