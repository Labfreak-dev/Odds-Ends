using System;
using System.Linq;
using System.Text;

namespace Hollowmere.Core
{
    /// <summary>Tooltip text with Unity rich-text colour tags (plain strings, so it lives in the core).</summary>
    public static class ItemText
    {
        public static string RarityColor(Rarity r) => r switch
        {
            Rarity.Common => "#e8e8e8",
            Rarity.Magic => "#6f8cff",
            Rarity.Rare => "#ffe25a",
            Rarity.Legendary => "#ff8a1e",
            _ => "#3fe05a",
        };

        public static string ElementColor(Element e) => e switch
        {
            Element.Fire => "#ff7a3a",
            Element.Frost => "#8ad8ff",
            Element.Lightning => "#f4f070",
            Element.Poison => "#8ae05a",
            Element.Arcane => "#d08aff",
            _ => "#e8e8e8",
        };

        public static string SlotLabel(Item it)
        {
            if (it.kind == ItemKind.Fish) return "Fish";
            if (it.kind == ItemKind.Potion) return "Potion";
            if (it.kind == ItemKind.TownPortal) return "Scroll";
            var b = it.Base;
            if (b == null) return "?";
            if (b.slot == ItemSlot.MainHand) return b.twoHanded ? "2H " + b.name : b.name;
            return b.slot.ToString();
        }

        public static string Describe(Item it, Hero hero, Item compareTo = null)
        {
            var sb = new StringBuilder();
            string rc = RarityColor(it.rarity);
            sb.Append($"<b><color={rc}>{it.name}</color></b>\n");
            if (it.kind == ItemKind.Fish)
            {
                var f = FishDb.Get(it.fishId);
                sb.Append($"<color={rc}>{it.rarity} Fish</color>  x{it.stack}\n{f?.text}\nSells for {f?.sellValue ?? 0} gold each.");
                return sb.ToString();
            }
            if (it.kind == ItemKind.Potion) return sb.Append($"x{it.stack}\nRestores 60% of your Life over 2 seconds.").ToString();
            if (it.kind == ItemKind.TownPortal) return sb.Append($"x{it.stack}\nOpens a portal to Hollowmere. Step back through it to return to this floor.").ToString();

            var b = it.Base;
            string rarityWord = it.rarity == Rarity.Common ? "" : it.rarity + " ";
            sb.Append($"<color={rc}>{(it.ancient ? "Deepwrought " : "")}{rarityWord}{SlotLabel(it)}</color>   <color=#999999>ilvl {it.itemLevel}</color>\n");
            if (b.classOnly != null) sb.Append($"<color=#bbbbbb>{b.classOnly} only</color>\n");

            if (it.IsWeapon)
            {
                float dps = (it.weaponMin + it.weaponMax) * 0.5f * it.attacksPerSecond;
                sb.Append($"<size=130%><b>{dps:0.0}</b></size> Damage per Second");
                if (compareTo != null && compareTo.IsWeapon) sb.Append(Delta(dps - (compareTo.weaponMin + compareTo.weaponMax) * 0.5f * compareTo.attacksPerSecond));
                sb.Append($"\n{it.weaponMin:0}-{it.weaponMax:0} {b.weaponElement} Damage, {it.attacksPerSecond:0.00} Attacks per Second\n");
            }
            else if (it.armor > 0)
            {
                sb.Append($"<size=130%><b>{it.armor}</b></size> Armor");
                if (compareTo != null) sb.Append(Delta(it.armor - compareTo.armor));
                sb.Append('\n');
            }

            foreach (var a in it.affixes.Where(a => a.primary))
                sb.Append($"<color=#8fb0ff>{Line(a, it)}</color>\n");
            foreach (var a in it.affixes.Where(a => !a.primary))
                sb.Append($"<color=#9a9ad0>{Line(a, it)}</color>\n");

            if (!string.IsNullOrEmpty(it.legendaryId))
            {
                var leg = ItemDb.Legendary(it.legendaryId);
                sb.Append($"<color=#ff8a1e>{leg.Describe(it.legendaryValue)}</color>\n");
            }
            if (!string.IsNullOrEmpty(it.setId))
            {
                var set = ItemDb.Set(it.setId);
                int have = hero?.SetCounts().TryGetValue(set.id, out var n) == true ? n : 0;
                sb.Append($"\n<color=#3fe05a>{set.name}</color>\n");
                foreach (var p in set.pieces)
                {
                    bool worn = hero != null && hero.equipment.Any(e => !Item.IsNone(e) && e.setId == set.id && e.baseId == p);
                    sb.Append($"<color={(worn ? "#3fe05a" : "#666666")}>  {ItemDb.Base(p).name}</color>\n");
                }
                foreach (var bonus in set.bonuses)
                    sb.Append($"<color={(have >= bonus.count ? "#3fe05a" : "#666666")}>({bonus.count}) {bonus.text}</color>\n");
            }

            if (compareTo != null && hero != null)
            {
                var s0 = hero.ComputeStats();
                float dps0 = hero.SheetDps(s0), tough0 = hero.Toughness(s0), life0 = hero.MaxLife(s0);
                var sim = Simulate(hero, it, compareTo);
                if (sim != null)
                {
                    var s1 = sim.ComputeStats();
                    sb.Append("\n<color=#bbbbbb>If equipped:</color>\n");
                    sb.Append($"  Damage {Pct(sim.SheetDps(s1), dps0)}\n");
                    sb.Append($"  Toughness {Pct(sim.Toughness(s1), tough0)}\n");
                    sb.Append($"  Life {Pct(sim.MaxLife(s1), life0)}\n");
                }
            }
            if (b.classOnly != null && hero != null && !hero.classless && b.classOnly != hero.heroClass)
                sb.Append($"\n<color=#ff5050>Your class cannot use this.</color>");
            sb.Append($"\n<color=#c9a14a>Sells for {it.SellValue()} gold</color>");
            if (it.enchantedAffix >= 0) sb.Append("  <color=#c080ff>(Enchanted)</color>");
            return sb.ToString();
        }

        static string Line(AffixRoll a, Item it)
        {
            string s = StatInfo.Describe(a.stat, a.value);
            int idx = it.affixes.IndexOf(a);
            return idx == it.enchantedAffix ? s + " <color=#c080ff>*</color>" : s;
        }

        static string Delta(float d) => Math.Abs(d) < 0.05f ? "" : d > 0 ? $"  <color=#4cff4c>+{d:0.#}</color>" : $"  <color=#ff4c4c>{d:0.#}</color>";

        static string Pct(float now, float before)
        {
            if (before <= 0) return "";
            float p = (now / before - 1) * 100;
            if (Math.Abs(p) < 0.05f) return "<color=#bbbbbb>no change</color>";
            return p > 0 ? $"<color=#4cff4c>+{p:0.0}%</color>" : $"<color=#ff4c4c>{p:0.0}%</color>";
        }

        /// <summary>A throwaway copy of the hero with `it` in place of `replacing`.</summary>
        static Hero Simulate(Hero hero, Item it, Item replacing)
        {
            if (!hero.CanEquip(it)) return null;
            var clone = new Hero { heroClass = hero.heroClass, level = hero.level, skills = hero.skills, equipment = (Item[])hero.equipment.Clone() };
            int idx = Array.IndexOf(clone.equipment, replacing);
            if (idx < 0) return null;
            clone.equipment[idx] = it;
            if (it.Base.twoHanded && it.IsWeapon && !(it.baseId == "bow" || it.baseId == "crossbow")) clone.equipment[(int)EquipSlot.OffHand] = null;
            return clone;
        }
    }
}
