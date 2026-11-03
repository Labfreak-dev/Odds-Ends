using System;
using System.Collections.Generic;
using UnityEngine;

namespace Hollowmere.StyleTest
{
    /// <summary>Style-test feature flags (phase 6). One static table: unsolid features default OFF and are switched on without a
    /// rebuild by `-stFlag name=on|off` (repeatable; also `-stFlag a=on,b=off`) or the in-game debug menu (Pause -> Debug flags),
    /// which persists the override in PlayerPrefs ("stflag.&lt;name&gt;"). Command-line overrides win over saved toggles.</summary>
    public static class StFlags
    {
        public class Def { public string id, label, note; public bool def; }

        public static readonly List<Def> All = new List<Def>
        {
            // solid: on by default
            new Def { id = "fishing",       def = true,  label = "Fishing",              note = "FATE-style fishing spots (town + every dungeon): cast, bite, reel minigame, catch popup." },
            new Def { id = "weightedAnims", def = true,  label = "Weighted attack clips", note = "24 HM_* attack clips (anticipation, hit-stop, overshoot). Off = phase-5 KayKit clips." },
            new Def { id = "losTargeting",  def = true,  label = "Line-of-sight lock-on", note = "Auto-target skips foes behind walls. Off = nearest foe in range." },
            new Def { id = "targetMarker",  def = true,  label = "Target marker",        note = "Ground ring + chevron on the locked foe." },
            new Def { id = "bossCam",       def = true,  label = "Boss camera",          note = "Camera pulls back and frames hero + boss once a boss is engaged." },
            new Def { id = "joystick",      def = true,  label = "Virtual joystick",     note = "Left-thumb joystick (drag anywhere on the left half)." },
            new Def { id = "tapToMove",     def = true,  label = "Tap to move",          note = "Tap the floor to walk there." },
            // unsolid / debug: off by default
            new Def { id = "presets",       def = false, label = "Loadout presets",      note = "Preset 1/2 buttons on the loadout screen (visual only, not saved)." },
            new Def { id = "eliteHorror",   def = false, label = "Sewer elite: Horror",  note = "Repo hm_horror_ghoul elite. Its rig T-poses with the legacy clip binding; off = Rat Brute elite." },
            new Def { id = "godMode",       def = false, label = "God mode",             note = "Debug: hero takes no damage." },
            new Def { id = "oneShot",       def = false, label = "One-shot foes",        note = "Debug: skills deal x20 damage." },
            new Def { id = "fps",           def = false, label = "FPS counter",          note = "Debug: frame time readout top-centre." },
        };

        static Dictionary<string, bool> cache;
        static readonly Dictionary<string, bool> cli = new Dictionary<string, bool>();

        static void Load()
        {
            if (cache != null) return;
            cache = new Dictionary<string, bool>();
            var a = Environment.GetCommandLineArgs();
            for (int i = 0; i < a.Length - 1; i++)
                if (a[i] == "-stFlag")
                    foreach (var part in a[i + 1].Split(','))
                    {
                        var kv = part.Split('='); if (kv.Length != 2) continue;
                        var v = kv[1].Trim().ToLowerInvariant(); cli[kv[0].Trim()] = v == "on" || v == "1" || v == "true";
                    }
            foreach (var d in All)
            {
                bool v = d.def;
                if (PlayerPrefs.HasKey("stflag." + d.id)) v = PlayerPrefs.GetInt("stflag." + d.id) == 1;
                if (cli.TryGetValue(d.id, out var c)) v = c;
                cache[d.id] = v;
            }
            Debug.Log("[ST] flags " + Describe());
        }

        public static bool On(string id) { Load(); return cache.TryGetValue(id, out var v) && v; }

        /// <summary>Debug-menu toggle: applies now and persists (a later -stFlag on the command line still wins).</summary>
        public static void Set(string id, bool v)
        {
            Load(); cache[id] = v; PlayerPrefs.SetInt("stflag." + id, v ? 1 : 0); PlayerPrefs.Save();
            Debug.Log("[ST] flag " + id + "=" + (v ? "on" : "off"));
        }

        /// <summary>Session-only override (smoke test): not persisted.</summary>
        public static void Override(string id, bool v) { Load(); cache[id] = v; Debug.Log("[ST] flag override " + id + "=" + (v ? "on" : "off")); }

        public static void ResetAll()
        {
            foreach (var d in All) PlayerPrefs.DeleteKey("stflag." + d.id);
            PlayerPrefs.Save(); cache = null; Load();
        }

        public static string Describe()
        {
            Load(); var parts = new List<string>();
            foreach (var d in All) parts.Add(d.id + "=" + (cache[d.id] ? "on" : "off"));
            return string.Join(" ", parts);
        }
    }
}
