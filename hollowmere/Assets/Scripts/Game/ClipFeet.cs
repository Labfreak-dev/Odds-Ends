using System;
using UnityEngine;

namespace Hollowmere
{
    /// <summary>
    /// Stance foot speed for each rig, in metres per second, from the animation report.
    /// Playback rate is ground speed divided by this, so the feet stop sliding.
    /// A run speed of 0 means that take has no travel and the walk cycle is used instead.
    /// longPunch marks the 7.3 s punch: play only the contact window.
    /// </summary>
    public sealed class ClipFeet : ScriptableObject
    {
        public Entry[] entries;

        [Serializable]
        public sealed class Entry
        {
            public string model;
            public float walk = 2.2f;
            public float run = 4.1f;
            public bool longPunch;
        }

        static ClipFeet loaded;
        static bool tried;

        public static Entry For(string key)
        {
            key = Strip(key);
            var cat = Load();
            if (cat != null && cat.entries != null)
                for (int i = 0; i < cat.entries.Length; i++)
                    if (cat.entries[i] != null && cat.entries[i].model == key) return cat.entries[i];
            return new Entry { model = key, walk = Feel.Active.clipWalk, run = 0f };
        }

        static ClipFeet Load()
        {
            if (tried) return loaded;
            tried = true;
            loaded = Resources.Load<ClipFeet>("ClipFeet");
            return loaded;
        }

        public static string Strip(string key)
        {
            if (string.IsNullOrEmpty(key)) return key;
            if (key.EndsWith("_walk_v2")) return key.Substring(0, key.Length - "_walk_v2".Length);
            if (key.EndsWith("_walk")) return key.Substring(0, key.Length - "_walk".Length);
            return key;
        }
    }
}
