using System.Collections.Generic;
using Hollowmere.Core;
using UnityEngine;

namespace Hollowmere
{
    public enum TelegraphShape { Cone = 0, Line = 1, Ring = 2, Rune = 3 }

    /// <summary>
    /// One enemy attack's ground mark. Resources/Telegraphs. Monsters, elites, and
    /// boss patterns list the attacks they own. A missing def is a failed telegraph.
    /// </summary>
    public sealed class TelegraphDef : ScriptableObject
    {
        public string id;
        public TelegraphShape shape = TelegraphShape.Cone;
        public Element element = Element.Physical;
        public string biomeId;
        public float reach = 3.2f;
        public float width = 1.6f;
        public float angle = 78f;
        public float radius = 2.4f;
        public float inner = 0.58f;
        public int fillFromOrigin = 1;
        public float scroll = 0.45f;
        public int weaponGlow = 1;
        public int trail = 1;
        public int charge;
        public int eyeGlow = 1;
        public float windupSpeed = 0.34f;
        public string noiseName;
        public string[] monsters;
        public int useAffix;
        public EliteAffix affix;
        public string attack = "basic";
        public int plainCircle;
    }

    public static class TelegraphBook
    {
        static TelegraphDef[] all;
        static bool tried;

        public static TelegraphDef ForMonster(string id)
        {
            if (string.IsNullOrEmpty(id)) return null;
            Ensure();
            if (all == null) return null;
            for (int i = 0; i < all.Length; i++)
            {
                var d = all[i];
                if (d == null || d.monsters == null || d.useAffix != 0) continue;
                for (int m = 0; m < d.monsters.Length; m++)
                    if (d.monsters[m] == id) return d;
            }
            return null;
        }

        public static TelegraphDef ForAffix(EliteAffix id)
        {
            Ensure();
            if (all == null) return null;
            for (int i = 0; i < all.Length; i++)
            {
                var d = all[i];
                if (d != null && d.useAffix != 0 && d.affix == id) return d;
            }
            return null;
        }

        public static TelegraphDef ForAttack(string attack)
        {
            if (string.IsNullOrEmpty(attack)) return null;
            Ensure();
            if (all == null) return null;
            for (int i = 0; i < all.Length; i++)
            {
                var d = all[i];
                if (d != null && d.useAffix == 0 && d.attack == attack && (d.monsters == null || d.monsters.Length == 0))
                    return d;
            }
            return null;
        }

        public static bool Shaped(TelegraphDef def)
        {
            if (def == null || def.plainCircle != 0) return false;
            return def.shape == TelegraphShape.Cone || def.shape == TelegraphShape.Line
                || def.shape == TelegraphShape.Ring || def.shape == TelegraphShape.Rune;
        }

        /// <summary>Every monster basic, every ground affix, and the two boss patterns.</summary>
        public static void Audit(System.Action<string> fail)
        {
            Ensure();
            var claimed = new HashSet<string>();
            if (all != null)
            {
                for (int i = 0; i < all.Length; i++)
                {
                    var d = all[i];
                    if (d == null) continue;
                    if (!Shaped(d)) fail((string.IsNullOrEmpty(d.id) ? "unnamed" : d.id) + " uses the default circle");
                    if (d.monsters == null) continue;
                    for (int m = 0; m < d.monsters.Length; m++)
                    {
                        if (string.IsNullOrEmpty(d.monsters[m])) continue;
                        if (!claimed.Add(d.monsters[m])) fail(d.monsters[m] + " has two TelegraphDefs");
                    }
                }
            }
            for (int i = 0; i < MonsterDb.All.Count; i++)
            {
                var mon = MonsterDb.All[i];
                var d = ForMonster(mon.id);
                if (d == null) fail(mon.id + " has no TelegraphDef");
                else if (!Shaped(d)) fail(mon.id + " uses the default circle");
            }
            EliteAffix[] ground =
            {
                EliteAffix.Molten, EliteAffix.Frozen, EliteAffix.Plagued, EliteAffix.Sweep,
                EliteAffix.Pulse, EliteAffix.Mortar, EliteAffix.Jailer, EliteAffix.Waller,
            };
            for (int i = 0; i < ground.Length; i++)
            {
                var d = ForAffix(ground[i]);
                if (d == null) fail(ground[i] + " has no TelegraphDef");
                else if (!Shaped(d)) fail(ground[i] + " uses the default circle");
            }
            string[] extras = { "boss-wave", "boss-hazard" };
            for (int i = 0; i < extras.Length; i++)
            {
                var d = ForAttack(extras[i]);
                if (d == null) fail(extras[i] + " has no TelegraphDef");
                else if (!Shaped(d)) fail(extras[i] + " uses the default circle");
            }
        }

        public static Color ElementPaint(Element el)
        {
            switch (el)
            {
                case Element.Fire: return new Color(1f, 0.38f, 0.06f, 1f);
                case Element.Frost: return new Color(0.45f, 0.78f, 1f, 1f);
                case Element.Poison: return new Color(0.32f, 0.92f, 0.22f, 1f);
                case Element.Arcane: return new Color(0.58f, 0.22f, 0.95f, 1f);
                case Element.Lightning: return new Color(0.72f, 0.86f, 1f, 1f);
                default: return new Color(0.95f, 0.28f, 0.1f, 1f);
            }
        }

        public static Color Paint(TelegraphDef def, Element element)
        {
            var c = ElementPaint(element);
            string biome = def != null && !string.IsNullOrEmpty(def.biomeId) ? def.biomeId : CurrentBiome();
            if (biome == "crypt") c = Color.Lerp(c, new Color(0.9f, 0.46f, 0.18f), 0.22f);
            else if (biome == "caverns") c = Color.Lerp(c, new Color(0.28f, 0.72f, 0.7f), 0.28f);
            else if (biome == "forge") c = Color.Lerp(c, new Color(1f, 0.42f, 0.08f), 0.34f);
            else if (biome == "infernal") c = Color.Lerp(c, new Color(1f, 0.16f, 0.02f), 0.42f);
            return c;
        }

        public static string CurrentBiome()
        {
            if (World.Map == null) return null;
            var band = BiomeCatalog.ForTheme(World.Map.theme);
            return band != null ? band.id : null;
        }

        static void Ensure()
        {
            if (tried) return;
            tried = true;
            all = Resources.LoadAll<TelegraphDef>("Telegraphs");
        }
    }
}
