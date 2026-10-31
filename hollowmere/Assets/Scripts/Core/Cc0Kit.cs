using System.Collections.Generic;

namespace Hollowmere.Core
{
    /// <summary>
    /// Authored sizes from the CC0 batch manifest. The number is the longest side in metres.
    /// A spawned prop may grow by at most 20 percent. Past that, the mesh was scaled wrong.
    /// </summary>
    public static class Cc0Kit
    {
        public const float SizeSlack = 1.2f;

        static readonly Dictionary<string, float> MaxMetres = new Dictionary<string, float>
        {
            { "cc0_chandelier", 0.816f },
            { "cc0_cabinet", 2.361f },
            { "cc0_estoc", 1.492f },
            { "cc0_candles", 1.053f },
            { "cc0_caged", 1.162f },
            { "cc0_statue", 1.740f },
            { "cc0_shield", 1.394f },
            { "cc0_dagger", 0.349f },
            { "cc0_mace", 0.630f },
            { "cc0_warhammer", 0.711f },
            { "cc0_firepit", 1.448f },
            { "cc0_chest", 0.959f },
            { "cc0_axe", 0.704f },
            { "cc0_bookshelf", 2.063f },
            { "cc0_candle", 0.220f },
            { "cc0_rack", 1.900f },
            { "cc0_boulder", 1.838f },
            { "cc0_deadtree", 3.051f },
            { "cc0_door", 2.965f },
            { "cc0_gate", 2.950f },
            { "cc0_cliff", 8.279f },
            { "cc0_roots", 4.122f },
        };

        public static IEnumerable<string> Keys => MaxMetres.Keys;

        public static bool TryMax(string key, out float metres) => MaxMetres.TryGetValue(key ?? "", out metres);

        /// <summary>True when the world size is not more than 20 percent over the manifest.</summary>
        public static bool SizeOk(float manifestMetres, float worldMax) =>
            manifestMetres > 0f && worldMax > 0f && worldMax <= manifestMetres * SizeSlack;
    }
}
