using UnityEngine;
using Hollowmere.StyleTest.Skills;

namespace Hollowmere.StyleTest
{
    /// <summary>Phase-6 minimal progress in PlayerPrefs (prefix "st6."): hero name, class, level, xp, gold, subclass, loadout,
    /// cleared dungeons (bitmask over StBiomes.Ids), fish caught. Separate from the real game's save.</summary>
    public class StSave
    {
        public string name = "Hero", cls = "knight", sub;
        public int level = 1, xp, gold, cleared, fish, deaths;
        public Loadout loadout;

        const string P = "st6.";
        public static bool Exists => PlayerPrefs.HasKey(P + "cls");

        public static int XpToNext(int level) => 60 + 30 * level;

        public static StSave New(string name, string cls)
        {
            var s = new StSave { name = string.IsNullOrWhiteSpace(name) ? "Hero" : name.Trim(), cls = cls };
            s.loadout = Loadout.Default(cls); return s;
        }

        public static StSave Load()
        {
            if (!Exists) return null;
            var s = new StSave
            {
                name = PlayerPrefs.GetString(P + "name", "Hero"), cls = PlayerPrefs.GetString(P + "cls", "knight"),
                sub = PlayerPrefs.GetString(P + "sub", ""), level = PlayerPrefs.GetInt(P + "level", 1), xp = PlayerPrefs.GetInt(P + "xp", 0),
                gold = PlayerPrefs.GetInt(P + "gold", 0), cleared = PlayerPrefs.GetInt(P + "cleared", 0), fish = PlayerPrefs.GetInt(P + "fish", 0),
                deaths = PlayerPrefs.GetInt(P + "deaths", 0),
            };
            if (!StSkillDb.Classes.ContainsKey(s.cls)) s.cls = "knight";
            if (string.IsNullOrEmpty(s.sub) || !StSkillDb.Subclasses.ContainsKey(s.sub)) s.sub = null;
            s.loadout = Loadout.Default(s.cls, s.sub);
            var parts = PlayerPrefs.GetString(P + "loadout", "").Split(',');
            if (parts.Length == 7)
            {   // only accept skills this hero actually knows, so an old save can't equip a foreign skill
                var known = new System.Collections.Generic.HashSet<string>(); foreach (var k in StSkillDb.Known(s.cls, s.sub)) known.Add(k.id);
                bool Ok(string id, SlotType t) => known.Contains(id) && StSkillDb.Skills[id].slot == t;
                if (Ok(parts[0], SlotType.Basic)) s.loadout.basic = parts[0];
                for (int i = 0; i < 4; i++) if (Ok(parts[1 + i], SlotType.Active)) s.loadout.actives[i] = parts[1 + i];
                if (Ok(parts[5], SlotType.Ultimate)) s.loadout.ultimate = parts[5];
                if (Ok(parts[6], SlotType.Passive)) s.loadout.passive = parts[6];
            }
            return s;
        }

        public void Save()
        {
            PlayerPrefs.SetString(P + "name", name); PlayerPrefs.SetString(P + "cls", cls); PlayerPrefs.SetString(P + "sub", sub ?? "");
            PlayerPrefs.SetInt(P + "level", level); PlayerPrefs.SetInt(P + "xp", xp); PlayerPrefs.SetInt(P + "gold", gold);
            PlayerPrefs.SetInt(P + "cleared", cleared); PlayerPrefs.SetInt(P + "fish", fish); PlayerPrefs.SetInt(P + "deaths", deaths);
            if (loadout != null)
                PlayerPrefs.SetString(P + "loadout", string.Join(",", loadout.basic, loadout.actives[0], loadout.actives[1], loadout.actives[2], loadout.actives[3], loadout.ultimate, loadout.passive));
            PlayerPrefs.Save();
        }

        public static void Wipe()
        {
            foreach (var k in new[] { "name", "cls", "sub", "level", "xp", "gold", "cleared", "fish", "deaths", "loadout" }) PlayerPrefs.DeleteKey(P + k);
            PlayerPrefs.Save();
        }

        public bool Cleared(string biome) { int i = System.Array.IndexOf(StBiomes.Ids, biome); return i >= 0 && (cleared & (1 << i)) != 0; }
        public void MarkCleared(string biome) { int i = System.Array.IndexOf(StBiomes.Ids, biome); if (i >= 0) cleared |= 1 << i; }
    }
}
