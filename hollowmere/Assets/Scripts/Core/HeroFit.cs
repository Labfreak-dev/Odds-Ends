namespace Hollowmere.Core
{
    /// <summary>
    /// The v5 hero is authored about 1.8 m tall. Gear changes in town, in the dungeon,
    /// and on the gear screen must leave that height alone. The old helm and chest
    /// meshes were skinned to a different skeleton; their bindposes are not applied
    /// to a v5 rig, and nothing writes that rig's bone scale.
    /// </summary>
    public static class HeroFit
    {
        public const float Height = 1.8f;
        public const float MinHeight = 1.45f;
        public const float MaxHeight = 2.15f;
        /// <summary>A rigid helm, pauldron, weapon, or shield. The inflated chest was about 85 m.</summary>
        public const float GearMaxAxis = 2.5f;
        public const bool PreserveBoneScale = true;

        public static readonly string[] Modes = { "town", "dungeon", "gear" };

        public static bool KnownMode(string mode)
        {
            if (string.IsNullOrEmpty(mode)) return false;
            for (int i = 0; i < Modes.Length; i++)
                if (Modes[i] == mode) return true;
            return false;
        }

        public static bool HeightOk(float metres) => metres >= MinHeight && metres <= MaxHeight;

        public static bool GearSizeOk(float maxAxis) => maxAxis > 0f && maxAxis <= GearMaxAxis;

        /// <summary>True when a gear change left the hero about 1.8 m tall.</summary>
        public static bool AfterGear(string mode, float heightMetres) => KnownMode(mode) && HeightOk(heightMetres);

        /// <summary>Skinned overlays are for the pre-v5 rigs only.</summary>
        public static bool SkinnedGear(bool v5Body) => !v5Body;

        /// <summary>
        /// A sprite, an icon texture, or a quad whose albedo is a white card.
        /// The flat pauldron icon is named icon_pauldrons and paints a dark shape on a white square
        /// when the alpha is dropped.
        /// </summary>
        public static bool IconCard(bool spriteRenderer, int vertexCount, bool whiteBackdrop, string textureName)
        {
            if (spriteRenderer) return true;
            if (IsIconTexture(textureName)) return true;
            return vertexCount > 0 && vertexCount <= 4 && whiteBackdrop;
        }

        public static bool IsIconTexture(string textureName)
        {
            if (string.IsNullOrEmpty(textureName)) return false;
            if (textureName.StartsWith("icon_")) return true;
            return textureName.IndexOf("sprite", System.StringComparison.OrdinalIgnoreCase) >= 0;
        }
    }
}
