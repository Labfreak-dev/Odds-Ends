using System.Collections.Generic;
using UnityEngine;

namespace Hollowmere
{
    /// <summary>
    /// Every clip under Assets/Audio. The Resources catalog references them, so a
    /// player build includes the files. Lookup is by the clip's file name.
    /// </summary>
    public sealed class SfxLibrary : ScriptableObject
    {
        public AudioClip[] clips;
    }

    public static class SfxBook
    {
        static Dictionary<string, AudioClip> map;
        static bool tried;

        public static AudioClip Get(string name)
        {
            if (!tried)
            {
                tried = true;
                map = new Dictionary<string, AudioClip>();
                var cat = Resources.Load<SfxLibrary>("SfxLibrary");
                if (cat != null && cat.clips != null)
                    for (int i = 0; i < cat.clips.Length; i++)
                        if (cat.clips[i] != null) map[cat.clips[i].name] = cat.clips[i];
            }
            if (map == null || string.IsNullOrEmpty(name)) return null;
            map.TryGetValue(name, out var clip);
            return clip;
        }
    }

    /// <summary>Footsteps, pet calls, and bag sounds. Variations are cue_01 .. cue_04.</summary>
    public static class Sfx
    {
        public static void Step(string surface) => AudioHub.Vary("step_" + surface, 0.5f);
        public static void Pet(string cue) => AudioHub.Vary("pet_" + cue, 0.75f);
        public static void Bag(string cue) => AudioHub.Vary(cue, cue == "hover_tick" ? 0.45f : 0.7f);
    }
}
