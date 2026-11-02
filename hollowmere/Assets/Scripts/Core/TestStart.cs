using System;
using System.Collections.Generic;
using System.Linq;

namespace Hollowmere.Core
{
    /// <summary>
    /// Test-build start: the new hero is level 20 with every skill point unspent, and the stash
    /// holds level-20 gear covering every armour slot, tier and rarity, every set in full, every
    /// weapon and off-hand base, every legendary power and every gem rank. All items come from
    /// Loot.Generate and Gems.Make, so the numbers are the normal loot numbers.
    /// Game code decides whether this runs (BuildConfig.testStart); the core never reads a flag.
    /// </summary>
    public static class TestStart
    {
        public const int Level = 20;
        public const int ItemLevel = 20;

        public static readonly Rarity[] Rarities = { Rarity.Common, Rarity.Magic, Rarity.Rare, Rarity.Legendary, Rarity.Set };

        public static readonly ItemSlot[] ArmourSlots =
        {
            ItemSlot.Head, ItemSlot.Shoulders, ItemSlot.Chest, ItemSlot.Hands,
            ItemSlot.Wrists, ItemSlot.Waist, ItemSlot.Legs, ItemSlot.Feet,
        };

        public static readonly ItemSlot[] JewellerySlots = { ItemSlot.Amulet, ItemSlot.Ring };

        /// <summary>The CC0 weapon meshes the test start has to carry, by model id.</summary>
        public static readonly string[] MeshyModels = { "fist_1", "fist_2", "fist_3", "orb_2", "orb_3", "flail_2", "flail_3" };

        /// <summary>
        /// Root cause of "the bag shows only 2 gems": the kit went to the town STASH (Town.AddToStash), which the Bag
        /// screen never shows and which is only reachable at the stash chest. Only the gems stacked into the bag.
        /// The kit now goes straight into an enlarged, paged bag, and a save that predates the grant gets it on load.
        /// </summary>
        public static void Apply(GameState s, Rng rng)
        {
            if (s == null || rng == null) return;
            LevelUp(s.hero);
            Grant(s, rng);
        }

        /// <summary>Puts the kit in the bag once per save while the test flag is on. Safe to call on every load.</summary>
        public static bool GrantIfMissing(GameState s, Rng rng)
        {
            if (s == null || s.hero == null || s.testStartGranted) return false;
            if (s.hero.level < Level) LevelUp(s.hero);
            Grant(s, rng);
            return true;
        }

        static void Grant(GameState s, Rng rng)
        {
            var items = Stock(rng);
            items.AddRange(EndGame(rng));
            var h = s.hero;
            int slots = items.Count(i => !i.Stackable) + Gems.Names.Length * 5 + h.inventory.Count + 30;
            h.bagCapacity = Math.Max(h.bagCapacity, (slots + 29) / 30 * 30);
            foreach (var it in items)
                if (!h.AddItem(it)) Town.AddToStash(s, it);
            s.testStartGranted = true;
        }

        /// <summary>End-game kit: max item level legendary and set for every armour slot and every weapon/off-hand base, rank-5 gems.</summary>
        public static List<Item> EndGame(Rng rng)
        {
            var list = new List<Item>();
            int il = Balance.MaxLevel;
            foreach (var slot in ArmourSlots)
                for (int k = 0; k < 2; k++)
                    foreach (var r in new[] { Rarity.Legendary, Rarity.Set })
                    {
                        var it = Loot.Generate(rng, il, r, null, slot, tier: GearTable.TierCount);
                        if (it.rarity != r) it.rarity = r;
                        list.Add(it);
                    }
            foreach (var slot in JewellerySlots)
                list.Add(Loot.Generate(rng, il, Rarity.Legendary, null, slot));
            foreach (var b in ItemDb.Bases.Where(x => x.slot == ItemSlot.MainHand || x.slot == ItemSlot.OffHand))
                list.Add(Loot.Generate(rng, il, Rarity.Legendary, null, b.slot, b.id));
            foreach (var name in Gems.Names)
                list.Add(Gems.Make(name, 5, 10));
            return list;
        }

        /// <summary>Level 20 through Hero.GainXp so points accrue the normal way, xp 0 into the level.
        /// A classless hero learns every skill its level allows (the tome rule, no point spent);
        /// a class hero's skills unlock by level as usual. The town respec then hands every point back.</summary>
        public static void LevelUp(Hero h)
        {
            while (h.level < Level)
            {
                long need = Balance.XpToNext(h.level) - h.xp;
                if (need <= 0 || h.GainXp(need) == 0) break;
            }
            if (h.classless)
                foreach (var sk in SkillDb.All.Where(k => k.reqLevel <= h.level))
                    h.Learn(sk.id);
            h.Respec();
        }

        /// <summary>Points a test-start hero holds: everything earned by level 20. A class hero keeps
        /// its primary attack at rank 1, which costs the one point Respec spends on it.</summary>
        public static int ExpectedUnspent(Hero h) => SkillDb.PointsAtLevel(Level) - (h.classless ? 0 : 1);

        public static List<Item> Stock(Rng rng)
        {
            var list = new List<Item>();

            // Every visible armour slot x tier x rarity. Slots the item tables give no legendary
            // power (or set piece) fall back to a rare roll inside Loot.Generate; those are kept
            // at the asked rarity so the wardrobe can be checked for every combination.
            foreach (var slot in ArmourSlots)
                for (int tier = 1; tier <= GearTable.TierCount; tier++)
                    foreach (var r in Rarities)
                    {
                        var it = Loot.Generate(rng, ItemLevel, r, null, slot, tier: tier);
                        if (it.rarity != r) it.rarity = r;
                        list.Add(it);
                    }

            // Jewellery has no visible tier and no set pieces: every rarity the tables can roll.
            foreach (var slot in JewellerySlots)
                foreach (var r in Rarities)
                {
                    if (r == Rarity.Set && !ItemDb.Sets.Any(set => set.pieces.Any(p => ItemDb.Base(p)?.slot == slot))) continue;
                    list.Add(Loot.Generate(rng, ItemLevel, r, null, slot));
                }

            // Every set, every piece.
            foreach (var set in ItemDb.Sets)
                foreach (var piece in set.pieces)
                {
                    var b = ItemDb.Base(piece);
                    if (b == null) continue;
                    list.Add(Loot.Generate(rng, ItemLevel, Rarity.Set, null, b.slot, piece, forceSet: set.id));
                }

            // Every weapon and off-hand base: melee, ranged, magic, shields, orbs, quivers.
            foreach (var b in ItemDb.Bases.Where(x => x.slot == ItemSlot.MainHand || x.slot == ItemSlot.OffHand))
                list.Add(Loot.Generate(rng, ItemLevel, Rarity.Rare, null, b.slot, b.id));

            // Every legendary power on its own base.
            foreach (var leg in ItemDb.Legendaries)
            {
                var b = ItemDb.Base(leg.baseId);
                if (b == null) continue;
                list.Add(Loot.Generate(rng, ItemLevel, Rarity.Legendary, null, b.slot, forceLegendary: leg.id));
            }

            // Every gem at every rank, a few of each so the jeweler can combine.
            foreach (var name in Gems.Names)
                for (int rank = 1; rank <= 5; rank++)
                    list.Add(Gems.Make(name, rank, 3));

            return list;
        }

        /// <summary>Round up to whole stash pages.</summary>
        public static int PageRound(int count) => Math.Max(1, (count + Balance.StashSize - 1) / Balance.StashSize) * Balance.StashSize;
    }
}
