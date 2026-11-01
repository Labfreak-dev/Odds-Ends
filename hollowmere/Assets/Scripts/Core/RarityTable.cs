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

        public readonly struct Row
        {
            public readonly Rarity Rarity;
            public readonly int Tier;
            public readonly float R, G, B, Metal, Smooth, Blend, Emit, Rim;
            public readonly bool UniqueModel, Vfx;
            public readonly float GlowR, GlowG, GlowB;
            public readonly float Rate, Size, Lift;

            public Row(Rarity rarity, int tier, float r, float g, float b, float metal, float smooth, float blend,
                float emit, float rim, bool unique, bool vfx, float glowR, float glowG, float glowB,
                float rate, float size, float lift)
            {
                Rarity = rarity; Tier = tier; R = r; G = g; B = b; Metal = metal; Smooth = smooth; Blend = blend;
                Emit = emit; Rim = rim; UniqueModel = unique; Vfx = vfx;
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
            new Row(Rarity.Common, 1, 0.36f, 0.32f, 0.28f, 0.06f, 0.12f, 0.55f, 0.00f, 0.00f, false, false, 0.36f, 0.32f, 0.28f, 0f, 0.02f, 0.02f),
            new Row(Rarity.Magic, 1, 0.78f, 0.88f, 1.05f, 0.42f, 0.62f, 0.90f, 0.00f, 0.00f, false, false, 0.72f, 0.84f, 1.00f, 0f, 0.02f, 0.02f),
            new Row(Rarity.Rare, 2, 0.55f, 0.72f, 0.95f, 0.28f, 0.48f, 0.40f, 1.15f, 1.00f, false, false, 0.20f, 0.78f, 1.00f, 0f, 0.02f, 0.02f),
            new Row(Rarity.Legendary, 3, 0.95f, 0.46f, 0.16f, 0.30f, 0.40f, 0.48f, 1.80f, 1.00f, true, true, 1.00f, 0.40f, 0.06f, 10f, 0.05f, 0.02f),
            new Row(Rarity.Set, 3, 0.28f, 0.86f, 0.34f, 0.22f, 0.40f, 0.62f, 1.40f, 1.00f, true, true, 0.22f, 0.95f, 0.32f, 10f, 0.05f, 0.02f),
        };

        static readonly Glow[] Sets =
        {
            new Glow("plate", 0.22f, 0.95f, 0.32f),
            new Glow("leather", 0.22f, 0.95f, 0.32f),
            new Glow("arcane", 0.22f, 0.95f, 0.32f),
            new Glow("bone", 0.22f, 0.95f, 0.32f),
            new Glow("infernal", 0.22f, 0.95f, 0.32f),
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
