using System;
using System.Collections.Generic;
using System.Linq;

namespace Hollowmere.Core
{
    public enum LootSource { Normal, Champion, Elite, Boss, Chest, Gamble, Fishing }

    public sealed class LootDrop
    {
        public List<Item> items = new List<Item>();
        public int gold;
        public int potions;
    }

    /// <summary>Item generation: rarity roll, base pick (with class-smart bias), affixes, legendary
    /// power or set membership, and naming.</summary>
    public static class Loot
    {
        static readonly string[] RarePrefix = { "Grim", "Storm", "Bone", "Ashen", "Dread", "Hollow", "Tide", "Gloom", "Iron", "Rune", "Blood", "Ember", "Frost", "Mire", "Raven", "Wyrm" };
        static readonly string[] RareSuffix = { "Vow", "Song", "Grasp", "Ward", "Bite", "Veil", "Mark", "Crown", "Fang", "Shroud", "Coil", "Gaze", "Hold", "Wake", "Spire", "Tether" };
        static readonly Dictionary<Stat, string> MagicSuffix = new Dictionary<Stat, string>
        {
            [Stat.Strength] = "of the Ox", [Stat.Dexterity] = "of the Fox", [Stat.Intelligence] = "of the Owl",
            [Stat.Vitality] = "of the Bear", [Stat.CritChance] = "of Precision", [Stat.AttackSpeed] = "of Haste",
            [Stat.MagicFind] = "of Fortune", [Stat.GoldFind] = "of Greed", [Stat.FishingLuck] = "of the Angler",
            [Stat.LifeOnHit] = "of the Leech", [Stat.Armor] = "of Warding", [Stat.MoveSpeed] = "of Speed",
        };
        static readonly Dictionary<Stat, string> MagicPrefix = new Dictionary<Stat, string>
        {
            [Stat.DamagePercent] = "Cruel", [Stat.CritDamage] = "Deadly", [Stat.AllResist] = "Prismatic",
            [Stat.MaxLifePercent] = "Hale", [Stat.FireDamage] = "Burning", [Stat.FrostDamage] = "Chilling",
            [Stat.LightningDamage] = "Shocking", [Stat.PoisonDamage] = "Venomous", [Stat.ArcaneDamage] = "Arcane",
            [Stat.CooldownReduction] = "Swift", [Stat.PetDamage] = "Loyal", [Stat.Thorns] = "Spiked",
        };

        static int uidCounter;

        public static string NewUid(Rng rng) => $"{rng.NextU64():x12}{(++uidCounter):x}";

        public static Rarity RollRarity(Rng rng, float magicFind, LootSource src, int floor = 1)
        {
            var weights = new decimal[5];
            DesignTable.DropWeights(floor, (decimal)magicFind, src, weights);
            var floats = new float[5];
            for (int i = 0; i < 5; i++) floats[i] = (float)weights[i];
            return (Rarity)rng.Weighted(floats);
        }

        public static IEnumerable<ItemBase> BasesFor(HeroClass? cls, ItemSlot? slot, int ilvl)
            => ItemDb.Bases.Where(b => (slot == null || b.slot == slot) && b.minLevel <= ilvl && (b.classOnly == null || cls == null || b.classOnly == cls));

        /// <summary>Generate one equipment item. smartFor = the class whose gear this should favour.</summary>
        public static Item Generate(Rng rng, int ilvl, Rarity rarity, HeroClass? smartFor, ItemSlot? slot = null, string forceBase = null, int floor = 0)
        {
            ItemBase b;
            string legendaryId = null, setId = null;

            if (rarity == Rarity.Legendary)
            {
                var pool = ItemDb.Legendaries.Where(l => (smartFor == null || l.classOnly == null || l.classOnly == smartFor)
                    && (slot == null || ItemDb.Base(l.baseId).slot == slot)).ToList();
                if (pool.Count == 0) rarity = Rarity.Rare;
                else
                {
                    var leg = rng.Pick(pool);
                    legendaryId = leg.id;
                    forceBase = leg.baseId;
                }
            }
            if (rarity == Rarity.Set)
            {
                var sets = ItemDb.Sets.Where(s => smartFor == null || s.classOnly == null || s.classOnly == smartFor).ToList();
                var options = sets.SelectMany(s => s.pieces.Select(p => (s, p)))
                    .Where(x => slot == null || ItemDb.Base(x.p).slot == slot).ToList();
                if (options.Count == 0) rarity = Rarity.Rare;
                else
                {
                    var pick = rng.Pick(options);
                    setId = pick.s.id;
                    forceBase = pick.p;
                }
            }

            if (forceBase != null) b = ItemDb.Base(forceBase);
            else
            {
                // Smart loot: 85% of drops are usable by the hero.
                var cls = smartFor != null && rng.Chance(0.85f) ? smartFor : null;
                var pool = BasesFor(cls, slot, ilvl).ToList();
                if (pool.Count == 0) pool = BasesFor(null, slot, ilvl).ToList();
                b = rng.Pick(pool);
            }

            var it = new Item
            {
                uid = NewUid(rng), kind = ItemKind.Equipment, baseId = b.id, rarity = rarity,
                itemLevel = ilvl, legendaryId = legendaryId, setId = setId,
                ancient = (rarity == Rarity.Legendary || rarity == Rarity.Set) && ilvl >= Balance.MaxLevel && floor >= DesignTable.DeepwroughtFloor && rng.Chance((float)DesignTable.DeepwroughtChance),
            };

            if (b.slot == ItemSlot.MainHand)
            {
                float sc = Balance.WeaponScale(ilvl) * (it.ancient ? (float)DesignTable.DeepwroughtScale : 1f) * (rarity >= Rarity.Legendary ? 1.15f : 1f);
                it.weaponMin = (float)Math.Round(b.dmgMin * sc * rng.Range(0.9f, 1.1f));
                it.weaponMax = Math.Max(it.weaponMin + 1, (float)Math.Round(b.dmgMax * sc * rng.Range(0.9f, 1.1f)));
                it.attacksPerSecond = b.aps;
            }
            else if (b.armor > 0)
            {
                it.armor = (int)Math.Round(b.armor * Balance.ArmorScale(ilvl) * rng.Range(0.9f, 1.1f) * (it.ancient ? (float)DesignTable.DeepwroughtScale : 1f));
            }
            if (GearTable.VisibleArmor(b.slot))
            {
                it.tier = GearTable.TierOf(0, rarity);
                it.family = GearTable.FamilyFromSet(setId) ?? GearTable.RollFamily(rng);
                if (it.armor > 0)
                    it.armor = Math.Max(1, (int)Math.Round(it.armor * GearTable.ArmorMul(it.tier)));
            }

            DesignTable.AffixBudget(rarity, out int primaries, out int secondaries);
            RollAffixes(it, b, rng, primaries, secondaries, smartFor);
            if (DesignTable.SocketSlot(b.slot) && rng.Chance((float)DesignTable.SocketChance(rarity)))
                it.sockets = 1;

            if (legendaryId != null)
            {
                var leg = ItemDb.Legendary(legendaryId);
                it.legendaryValue = (float)Math.Round(rng.Range(leg.lo, leg.hi) * (it.ancient ? 1.0f : 1f), leg.hi < 5 ? 1 : 0);
            }

            it.name = MakeName(it, b, rng);
            return it;
        }

        static void RollAffixes(Item it, ItemBase b, Rng rng, int primaries, int secondaries, HeroClass? smartFor)
        {
            var mask = ItemDb.MaskOf(b.slot);
            var used = new HashSet<Stat>();
            bool forceMain = it.rarity >= Rarity.Rare && smartFor != null;
            if (forceMain && primaries > 0)
            {
                var main = StatInfo.MainStat(smartFor.Value);
                AddAffix(it, ItemDb.Affixes.First(a => a.stat == main), rng, used);
                primaries--;
            }
            for (int n = 0; n < primaries; n++) PickAndAdd(it, rng, mask, true, used, smartFor);
            for (int n = 0; n < secondaries; n++) PickAndAdd(it, rng, mask, false, used, smartFor);
        }

        static void PickAndAdd(Item it, Rng rng, SlotMask mask, bool primary, HashSet<Stat> used, HeroClass? smartFor)
        {
            bool hasMain = used.Any(StatInfo.IsMainStat);
            var pool = ItemDb.Affixes.Where(a => a.primary == primary && (a.slots & mask) != 0 && !used.Contains(a.stat)
                && !(hasMain && StatInfo.IsMainStat(a.stat))).ToList();
            if (pool.Count == 0) return;
            var weights = pool.Select(a =>
            {
                float w = a.weight;
                if (smartFor != null && StatInfo.IsMainStat(a.stat)) w *= a.stat == StatInfo.MainStat(smartFor.Value) ? 2.5f : 0.4f;
                return w;
            }).ToList();
            AddAffix(it, pool[rng.Weighted(weights)], rng, used);
        }

        static void AddAffix(Item it, AffixDef a, Rng rng, HashSet<Stat> used)
        {
            used.Add(a.stat);
            it.affixes.Add(new AffixRoll { affixId = a.id, stat = a.stat, value = a.Roll(it.itemLevel, rng, it.ancient), primary = a.primary });
        }

        /// <summary>Mystic: replace one affix with a fresh roll of a different stat (or the same stat re-rolled).
        /// Once an item has been enchanted only that affix may be enchanted again.</summary>
        public static bool Enchant(Item it, int affixIndex, Rng rng, HeroClass? smartFor)
        {
            if (it.kind != ItemKind.Equipment || affixIndex < 0 || affixIndex >= it.affixes.Count) return false;
            if (it.enchantedAffix >= 0 && it.enchantedAffix != affixIndex) return false;
            var old = it.affixes[affixIndex];
            var b = it.Base;
            var mask = ItemDb.MaskOf(b.slot);
            var others = new HashSet<Stat>(it.affixes.Where((a, i) => i != affixIndex).Select(a => a.stat));
            bool hasMain = others.Any(StatInfo.IsMainStat);
            var pool = ItemDb.Affixes.Where(a => a.primary == old.primary && (a.slots & mask) != 0 && !others.Contains(a.stat)
                && !(hasMain && StatInfo.IsMainStat(a.stat))).ToList();
            if (pool.Count == 0) return false;
            var pick = rng.Pick(pool);
            it.affixes[affixIndex] = new AffixRoll { affixId = pick.id, stat = pick.stat, value = pick.Roll(it.itemLevel, rng, it.ancient), primary = pick.primary };
            it.enchantedAffix = affixIndex;
            return true;
        }

        static string MakeName(Item it, ItemBase b, Rng rng)
        {
            switch (it.rarity)
            {
                case Rarity.Legendary: return ItemDb.Legendary(it.legendaryId).name;
                case Rarity.Set:
                {
                    var set = ItemDb.Set(it.setId);
                    string word = set.name.Split(' ').Last();
                    return $"{word} {b.name}";
                }
                case Rarity.Rare: return $"{rng.Pick(RarePrefix)} {rng.Pick(RareSuffix)}";
                case Rarity.Magic:
                {
                    string pre = null, suf = null;
                    foreach (var a in it.affixes)
                    {
                        if (pre == null && MagicPrefix.TryGetValue(a.stat, out var p)) pre = p;
                        else if (suf == null && MagicSuffix.TryGetValue(a.stat, out var s)) suf = s;
                    }
                    return $"{(pre != null ? pre + " " : "")}{b.name}{(suf != null ? " " + suf : "")}";
                }
                default: return b.name;
            }
        }

        public static Item Tome(string skillId)
        {
            var s = SkillDb.Get(skillId);
            return new Item { uid = "tome_" + skillId, kind = ItemKind.Tome, baseId = "tome", skillId = skillId, name = (s?.name ?? "Skill") + " Tome", stack = 1, rarity = Rarity.Magic };
        }

        public static Item RuneItem(string skillId, string runeId)
        {
            var s = SkillDb.Get(skillId);
            var rune = s?.runes.FirstOrDefault(r => r.id == runeId);
            return new Item { uid = "rune_" + runeId, kind = ItemKind.Rune, baseId = runeId, skillId = skillId, name = (rune?.name ?? "Rune") + " Rune", stack = 1, rarity = Rarity.Rare };
        }

        public static Item Potion(int count = 1) => new Item { uid = "potion", kind = ItemKind.Potion, baseId = "potion", name = "Health Potion", stack = count };
        public static Item TownPortal(int count = 1) => new Item { uid = "portal", kind = ItemKind.TownPortal, baseId = "portal", name = "Town Portal Scroll", stack = count };
        public static Item Fish(string fishId, int count = 1)
        {
            var f = FishDb.Get(fishId);
            return new Item { uid = "fish_" + fishId, kind = ItemKind.Fish, baseId = "fish", fishId = fishId, name = f?.name ?? fishId, stack = count, rarity = f?.rarity ?? Rarity.Common };
        }

        /// <summary>What a dead monster, a chest or the boss drops.</summary>
        public static LootDrop Roll(Rng rng, LootSource src, int monsterLevel, StatBlock heroStats, HeroClass cls, int floor = 0)
        {
            var drop = new LootDrop();
            float mf = heroStats[Stat.MagicFind], gf = heroStats[Stat.GoldFind];
            int ilvl = Balance.ItemLevelFor(monsterLevel, src >= LootSource.Elite);
            float itemChance; int maxItems;
            switch (src)
            {
                case LootSource.Champion: itemChance = 1f; maxItems = 3; break;
                case LootSource.Elite: itemChance = 1f; maxItems = 4; break;
                case LootSource.Boss: itemChance = 1f; maxItems = 6; break;
                case LootSource.Chest: itemChance = 1f; maxItems = 3; break;
                default: itemChance = 0.16f; maxItems = 1; break;
            }
            int count = 0;
            for (int i = 0; i < maxItems; i++)
                if (rng.Chance(i == 0 ? itemChance : 0.55f)) count++;
            for (int i = 0; i < count; i++)
                drop.items.Add(Generate(rng, ilvl, RollRarity(rng, mf, src, floor < 1 ? monsterLevel : floor), cls, floor: floor < 1 ? monsterLevel : floor));
            if (src == LootSource.Boss && !drop.items.Any(x => x.rarity >= Rarity.Legendary) && rng.Chance((float)DesignTable.BossExtraSpecialChance))
                drop.items.Add(Generate(rng, ilvl, rng.Chance(0.7f) ? Rarity.Legendary : Rarity.Set, cls, floor: floor < 1 ? monsterLevel : floor));

            float goldChance = src == LootSource.Normal ? 0.35f : 1f;
            if (rng.Chance(goldChance))
                drop.gold = (int)Math.Round((3 + monsterLevel * 2.2f) * rng.Range(0.7f, 1.3f) * (1 + gf / 100f)
                    * (src == LootSource.Boss ? 12 : src == LootSource.Elite ? 6 : src == LootSource.Champion ? 3.5f : src == LootSource.Chest ? 3 : 1));
            if (rng.Chance(src == LootSource.Normal ? 0.03f : 0.3f)) drop.potions = 1;
            if (src >= LootSource.Elite && rng.Chance(src == LootSource.Boss ? 0.35f : 0.12f))
            {
                var pool = SkillDb.All.Where(sk => sk.shape != SkillShape.Passive && !sk.primary).ToList();
                if (pool.Count > 0) drop.items.Add(Tome(rng.Pick(pool).id));
            }
            if (src == LootSource.Boss && rng.Chance(0.2f))
            {
                var pool = SkillDb.All.Where(sk => sk.runes.Count > 0).ToList();
                if (pool.Count > 0)
                {
                    var sk = rng.Pick(pool);
                    drop.items.Add(RuneItem(sk.id, rng.Pick(sk.runes).id));
                }
            }
            return drop;
        }

        public static int GambleCost(int heroLevel) => 50 + heroLevel * 25;
    }
}
