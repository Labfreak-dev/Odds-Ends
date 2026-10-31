using System;
using System.Linq;

namespace Hollowmere.Core
{
    /// <summary>Gem ids are {name}_{rank}. Combine and socket rules are DESIGN_SPEC section P4.</summary>
    public static class Gems
    {
        public static readonly string[] Names = { "cinder", "thorn", "marrow", "salt" };

        public static bool Parse(string id, out string name, out int rank)
        {
            name = null;
            rank = 0;
            if (string.IsNullOrEmpty(id)) return false;
            int cut = id.LastIndexOf('_');
            if (cut <= 0 || cut == id.Length - 1) return false;
            name = id.Substring(0, cut);
            if (!int.TryParse(id.Substring(cut + 1), out rank)) return false;
            return rank >= 1 && rank <= 5 && Array.IndexOf(Names, name) >= 0;
        }

        public static Item Make(string name, int rank, int count)
        {
            string id = name + "_" + rank;
            string label = char.ToUpper(name[0]) + name.Substring(1);
            return new Item
            {
                uid = id,
                kind = ItemKind.Gem,
                baseId = id,
                gemId = id,
                name = label + " " + rank,
                stack = Math.Max(1, count),
                rarity = rank >= 4 ? Rarity.Legendary : rank == 3 ? Rarity.Rare : rank == 2 ? Rarity.Magic : Rarity.Common,
            };
        }

        public static int Count(Hero hero, string id)
            => hero.inventory.Where(i => i.kind == ItemKind.Gem && i.baseId == id).Sum(i => i.stack);

        public static bool Combine(Hero hero, string name, int rank)
        {
            if (hero == null || rank >= 5 || rank < 1) return false;
            string id = name + "_" + rank;
            if (Count(hero, id) < 3) return false;
            int cost = DesignTable.GemCombineGold(rank);
            if (hero.gold < cost) return false;
            if (!Consume(hero, id, 3)) return false;
            hero.gold -= cost;
            hero.AddItem(Make(name, rank + 1, 1));
            return true;
        }

        public static bool Socket(Hero hero, Item gear, string gemBaseId)
        {
            if (hero == null || gear == null || gear.kind != ItemKind.Equipment || gear.sockets < 1) return false;
            if (!Parse(gemBaseId, out _, out _)) return false;
            if (Count(hero, gemBaseId) < 1) return false;
            if (!string.IsNullOrEmpty(gear.gemId) && Parse(gear.gemId, out var oldName, out var oldRank))
            {
                if (!hero.AddItem(Make(oldName, oldRank, 1))) return false;
            }
            if (!Consume(hero, gemBaseId, 1)) return false;
            gear.gemId = gemBaseId;
            return true;
        }

        public static string EffectLine(string gemId)
        {
            if (!Parse(gemId, out var name, out var rank)) return "";
            DesignTable.GemRow(rank, out _, out int mn, out int mx, out int thorn, out int life, out int salt, out _);
            string label = char.ToUpper(name[0]) + name.Substring(1);
            string effect = name switch
            {
                "cinder" => "weapon +" + mn + "–" + mx + " damage, helm +" + rank + "% XP",
                "thorn" => "+" + thorn + "% critical damage",
                "marrow" => "+" + life + " life",
                "salt" => "+" + salt + " all resist",
                _ => "",
            };
            return "Socket: " + label + " " + rank + " — " + effect;
        }

        public static void Contribute(Hero hero, StatBlock stats)
        {
            if (hero == null) return;
            foreach (var it in hero.equipment)
            {
                if (Item.IsNone(it) || !Parse(it.gemId, out var name, out var rank)) continue;
                DesignTable.GemRow(rank, out _, out int mn, out int mx, out int thorn, out _, out int salt, out _);
                var slot = it.Base != null ? it.Base.slot : ItemSlot.Amulet;
                if (name == "cinder" && slot == ItemSlot.MainHand)
                {
                    stats.Add(Stat.MinWeaponDamage, mn);
                    stats.Add(Stat.MaxWeaponDamage, mx);
                }
                else if (name == "thorn") stats.Add(Stat.CritDamage, thorn);
                else if (name == "salt") stats.Add(Stat.AllResist, salt);
            }
        }

        public static int MarrowLife(Hero hero)
        {
            int life = 0;
            if (hero == null) return 0;
            foreach (var it in hero.equipment)
            {
                if (Item.IsNone(it) || !Parse(it.gemId, out var name, out var rank) || name != "marrow") continue;
                DesignTable.GemRow(rank, out _, out _, out _, out _, out int add, out _, out _);
                life += add;
            }
            return life;
        }

        public static int HelmXpPercent(Hero hero)
        {
            int pct = 0;
            if (hero == null) return 0;
            foreach (var it in hero.equipment)
            {
                if (Item.IsNone(it) || it.Base == null || it.Base.slot != ItemSlot.Head) continue;
                if (!Parse(it.gemId, out var name, out var rank) || name != "cinder") continue;
                pct += rank;
            }
            return pct;
        }

        static bool Consume(Hero hero, string id, int n)
        {
            foreach (var it in hero.inventory.ToList())
            {
                if (it.kind != ItemKind.Gem || it.baseId != id) continue;
                int take = Math.Min(n, it.stack);
                it.stack -= take;
                n -= take;
                if (it.stack <= 0) hero.inventory.Remove(it);
                if (n <= 0) return true;
            }
            return n <= 0;
        }
    }
}
