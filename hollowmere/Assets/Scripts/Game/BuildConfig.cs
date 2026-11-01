using UnityEngine;

namespace Hollowmere
{
    /// <summary>
    /// Build switches, read from Resources/BuildConfig.asset. testStart gives every new hero
    /// level 20, unspent points and a stash of level-20 gear for testing. Turn it off for release.
    /// A missing asset reads as a release build: every switch off.
    /// </summary>
    public sealed class BuildConfig : ScriptableObject
    {
        public bool testStart = true;

        static BuildConfig loaded;
        static bool tried;

        public static bool TestStart
        {
            get
            {
                var c = Load();
                return c != null && c.testStart;
            }
        }

        static BuildConfig Load()
        {
            if (tried) return loaded;
            tried = true;
            loaded = Resources.Load<BuildConfig>("BuildConfig");
            return loaded;
        }
    }
}
