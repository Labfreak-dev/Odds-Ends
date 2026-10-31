using System;
using System.Collections.Generic;
using System.Linq;

namespace Hollowmere.Core
{
    public enum QuestKind { SlayFamily, SlayElite, CatchFish, ReachDepth }

    [Serializable]
    public sealed class Quest
    {
        public string id, title, text;
        public QuestKind kind;
        public string target;      // family / fish id
        public int depth;          // the floor it happens on (or minimum)
        public int needed, progress;
        public long rewardGold, rewardXp;
        public Rarity rewardRarity;
        public bool accepted, complete, turnedIn;
        public string eliteName;   // SlayElite: the named monster spawned on that floor
    }

    [Serializable]
    public sealed class TimedBuff
    {
        public Stat stat;
        public float value, seconds;
        public string source;
    }

    [Serializable]
    public sealed class Materials
    {
        public int scrap, dust, souls;   // from common/magic, rare, legendary/set salvage
    }

    [Serializable]
    public sealed class Counters
    {
        public long kills, elites, bosses, fishCaught, legendaries, deaths, goldEarned;
    }

    /// <summary>Everything that persists. One JSON file (Unity JsonUtility compatible).</summary>
    [Serializable]
    public sealed class GameState
    {
        public int version = 2;
        public long seed;          // long, not ulong: JsonUtility round-trips it reliably
        public Hero hero = new Hero();
        public PetState pet = new PetState();
        public List<Item> stash = new List<Item>();
        public Materials materials = new Materials();
        public Counters counters = new Counters();
        public int depth;            // 0 = town. Floor depth is the only difficulty.
        public int deepest;
        public int portalDepth;      // floor an open town portal leads back to (0 = none)
        public int portalX, portalY; // tile the portal stands on
        public List<Quest> quests = new List<Quest>();
        public List<TimedBuff> buffs = new List<TimedBuff>();
        public List<string> fishLog = new List<string>();  // species caught at least once
        public List<int> clearedBossFloors = new List<int>();
        public int questSerial;

        public static GameState NewGame(HeroClass cls, string heroName, PetSpecies pet, string petName, ulong seed)
        {
            var rng = new Rng(seed);
            var s = new GameState { seed = (long)seed, hero = Hero.Create(cls, heroName, rng) };
            s.pet.species = pet;
            s.pet.name = petName;
            Town.RefreshQuests(s, rng);
            return s;
        }

        public void Normalize()
        {
            // version 1 saves carried a difficulty enum. The field is gone, so both JsonUtility
            // and System.Text.Json drop it on load. Writing the save again omits it.
            if (version < 2) version = 2;
            hero.Normalize();
            stash.RemoveAll(Item.IsNone);
            pet.pack.RemoveAll(Item.IsNone);
            quests.RemoveAll(q => string.IsNullOrEmpty(q.id));
        }

        /// <summary>Hero stats plus fish buffs and the companion's form bonuses.</summary>
        public StatBlock Stats()
        {
            var s = hero.ComputeStats();
            foreach (var b in buffs) s.Add(b.stat, b.value);
            var form = pet.Form;
            if (form != null && !pet.Away) s.Add(Stat.GoldFind, form.goldFind);
            return s;
        }

        public void TickBuffs(float dt)
        {
            foreach (var b in buffs) b.seconds -= dt;
            buffs.RemoveAll(b => b.seconds <= 0);
        }

        public void AddBuff(Stat stat, float value, float seconds, string source)
        {
            buffs.RemoveAll(b => b.source == source);
            buffs.Add(new TimedBuff { stat = stat, value = value, seconds = seconds, source = source });
        }

        // ---------------- quest hooks ----------------

        public void OnKill(MonsterStats m, int floor)
        {
            counters.kills++;
            if (m.rank == MonsterRank.Elite) counters.elites++;
            if (m.rank == MonsterRank.Boss) { counters.bosses++; if (!clearedBossFloors.Contains(floor)) clearedBossFloors.Add(floor); }
            foreach (var q in quests.Where(q => q.accepted && !q.complete))
            {
                if (q.kind == QuestKind.SlayFamily && m.def.family == q.target && floor >= q.depth) q.progress++;
                if (q.kind == QuestKind.SlayElite && m.displayName == q.eliteName) q.progress++;
                if (q.progress >= q.needed) q.complete = true;
            }
        }

        public void OnFish(FishDef f)
        {
            counters.fishCaught++;
            if (!fishLog.Contains(f.id)) fishLog.Add(f.id);
            foreach (var q in quests.Where(q => q.accepted && !q.complete && q.kind == QuestKind.CatchFish && q.target == f.id))
                if (++q.progress >= q.needed) q.complete = true;
        }

        public void OnReachDepth(int d)
        {
            depth = d;
            deepest = Math.Max(deepest, d);
            foreach (var q in quests.Where(q => q.accepted && !q.complete && q.kind == QuestKind.ReachDepth))
                if (d >= q.depth) { q.progress = q.needed; q.complete = true; }
        }

        /// <summary>The named elite a SlayElite quest wants on this floor, if any.</summary>
        public Quest EliteQuestOn(int floor) => quests.FirstOrDefault(q => q.accepted && !q.complete && q.kind == QuestKind.SlayElite && q.depth == floor);
    }

    /// <summary>Town services: merchant, blacksmith (salvage), mystic (enchant), gambler, stash, quest board.</summary>
    public static class Town
    {
        public const int PotionPrice = 25;
        public const int PortalPrice = 40;

        public static bool Buy(GameState s, ItemKind kind, int count)
        {
            int price = (kind == ItemKind.Potion ? PotionPrice : PortalPrice) * count;
            if (s.hero.gold < price) return false;
            var it = kind == ItemKind.Potion ? Loot.Potion(count) : Loot.TownPortal(count);
            if (!s.hero.AddItem(it)) return false;
            s.hero.gold -= price;
            return true;
        }

        public static bool Sell(GameState s, Item it)
        {
            if (!s.hero.inventory.Remove(it)) return false;
            long v = it.SellValue();
            s.hero.gold += v;
            s.counters.goldEarned += v;
            return true;
        }

        public static long SellAllJunk(GameState s)
        {
            var junk = s.hero.inventory.Where(i => i.junk).ToList();
            long total = 0;
            foreach (var it in junk) { total += it.SellValue(); s.hero.inventory.Remove(it); }
            s.hero.gold += total;
            s.counters.goldEarned += total;
            return total;
        }

        public static bool Salvage(GameState s, Item it)
        {
            if (it.kind != ItemKind.Equipment || !s.hero.inventory.Remove(it)) return false;
            switch (it.rarity)
            {
                case Rarity.Common: s.materials.scrap += 1; break;
                case Rarity.Magic: s.materials.scrap += 2; break;
                case Rarity.Rare: s.materials.dust += 1; s.materials.scrap += 1; break;
                default: s.materials.souls += 1; s.materials.dust += 2; break;
            }
            return true;
        }

        public static (int gold, int dust, int souls) EnchantCost(Item it) =>
            (100 + it.itemLevel * 20, it.rarity >= Rarity.Rare ? 1 : 0, it.rarity >= Rarity.Legendary ? 1 : 0);

        public static bool Enchant(GameState s, Item it, int affixIndex, Rng rng)
        {
            var (g, d, so) = EnchantCost(it);
            if (s.hero.gold < g || s.materials.dust < d || s.materials.souls < so) return false;
            if (!Loot.Enchant(it, affixIndex, rng, s.hero.heroClass)) return false;
            s.hero.gold -= g; s.materials.dust -= d; s.materials.souls -= so;
            return true;
        }

        /// <summary>Spend gold for a mystery item of a chosen slot: rare or better, 10% legendary/set.</summary>
        public static Item Gamble(GameState s, ItemSlot slot, Rng rng)
        {
            int cost = Loot.GambleCost(s.hero.level);
            if (s.hero.gold < cost || s.hero.FreeSlots <= 0) return null;
            s.hero.gold -= cost;
            var r = Loot.RollRarity(rng, 0, LootSource.Gamble);
            var it = Loot.Generate(rng, s.hero.level, r, s.hero.heroClass, slot);
            s.hero.AddItem(it);
            if (it.rarity >= Rarity.Legendary) s.counters.legendaries++;
            return it;
        }

        public static bool ToStash(GameState s, Item it)
        {
            if (s.stash.Count >= Balance.StashSize || !s.hero.inventory.Remove(it)) return false;
            s.stash.Add(it);
            return true;
        }

        public static bool FromStash(GameState s, Item it)
        {
            if (s.hero.FreeSlots <= 0 || !s.stash.Remove(it)) return false;
            s.hero.inventory.Add(it);
            return true;
        }

        // ---------------- quest board ----------------

        public static void RefreshQuests(GameState s, Rng rng)
        {
            s.quests.RemoveAll(q => !q.accepted || q.turnedIn);
            int lvl = s.hero.level;
            int baseDepth = Math.Max(1, s.deepest);
            while (s.quests.Count < 3)
            {
                var q = new Quest { id = "q" + (++s.questSerial) };
                int kind = rng.Range(0, 4);
                switch (kind)
                {
                    case 0:
                    {
                        var defs = MonsterDb.ForDepth(baseDepth);
                        var fam = rng.Pick(defs).family;
                        q.kind = QuestKind.SlayFamily; q.target = fam; q.depth = baseDepth; q.needed = rng.Range(15, 31);
                        q.title = $"Cull the {fam}";
                        q.text = $"Slay {q.needed} {fam} on floor {baseDepth} or deeper.";
                        break;
                    }
                    case 1:
                    {
                        q.kind = QuestKind.SlayElite; q.depth = baseDepth + rng.Range(1, 3); q.needed = 1;
                        string[] names = { "Grubnose the Wretched", "Old Mother Mire", "Sir Hollowhelm", "The Gnawing Saint", "Brakk Twicedead", "Lady Cinderveil" };
                        q.eliteName = rng.Pick(names); q.target = q.eliteName;
                        q.title = $"Bounty: {q.eliteName}";
                        q.text = $"{q.eliteName} has been seen on floor {q.depth}. End them.";
                        break;
                    }
                    case 2:
                    {
                        var fishes = FishDb.All.Where(f => f.rarity <= Rarity.Magic && (f.town || f.minDepth <= baseDepth + 3)).ToList();
                        var f = rng.Pick(fishes);
                        q.kind = QuestKind.CatchFish; q.target = f.id; q.needed = rng.Range(1, 4);
                        q.title = $"A Taste for {f.name}";
                        q.text = $"The cook wants {q.needed} {f.name}. {(f.town ? "They bite in the town lake." : $"Found from floor {f.minDepth}.")}";
                        break;
                    }
                    default:
                    {
                        q.kind = QuestKind.ReachDepth; q.depth = baseDepth + rng.Range(2, 5); q.needed = 1;
                        q.title = "Deeper Still";
                        q.text = $"Reach floor {q.depth} of the Hollow.";
                        break;
                    }
                }
                q.rewardGold = 60 + lvl * 30 + q.depth * 20;
                q.rewardXp = (long)(Balance.XpToNext(Math.Min(lvl, Balance.MaxLevel - 1)) * 0.3f);
                q.rewardRarity = rng.Chance(0.25f) ? Rarity.Legendary : Rarity.Rare;
                s.quests.Add(q);
            }
        }

        /// <summary>Returns the reward item (also placed in inventory or stash).</summary>
        public static Item TurnIn(GameState s, Quest q, Rng rng)
        {
            if (!q.complete || q.turnedIn) return null;
            q.turnedIn = true;
            s.hero.gold += q.rewardGold;
            s.hero.GainXp(q.rewardXp);
            var it = Loot.Generate(rng, s.hero.level, q.rewardRarity, s.hero.heroClass);
            if (!s.hero.AddItem(it)) s.stash.Add(it);
            if (it.rarity >= Rarity.Legendary) s.counters.legendaries++;
            return it;
        }

        /// <summary>The town's layout, drawn as text: # wall, . floor, ~ lake, M merchant, B blacksmith,
        /// Y mystic, G gambler, S stash, Q quest board, F fisherman, D dungeon entrance, P hero start.</summary>
        public static readonly string[] Layout =
        {
            "##############################",
            "#............................#",
            "#..M.....B.....Y.....G.......#",
            "#............................#",
            "#............................#",
            "#....S.......P.......Q.......#",
            "#............................#",
            "#............................#",
            "#..~~~~~~~~~.................#",
            "#..~~~~~~~~~~.........D......#",
            "#..~~~~~~~~~~................#",
            "#..~~~~~~~~~F................#",
            "#..~~~~~~~~..................#",
            "#............................#",
            "##############################",
        };

        public static DungeonMap BuildTownMap(out Dictionary<char, Int2> marks)
        {
            int h = Layout.Length, w = Layout[0].Length;
            var map = new DungeonMap(w, h) { theme = Theme.Town, depth = 0 };
            marks = new Dictionary<char, Int2>();
            for (int row = 0; row < h; row++)
            {
                int y = h - 1 - row;   // first text row is the north edge
                for (int x = 0; x < w; x++)
                {
                    char c = Layout[row][x];
                    map.Set(x, y, c == '#' ? Tile.Wall : c == '~' ? Tile.Water : Tile.Floor);
                    if (c != '#' && c != '.' && c != '~') marks[c] = new Int2(x, y);
                }
            }
            map.entry = marks['P'];
            map.exit = marks['D'];
            // The fisherman stands on the shore of the lake: the town's endless fishing spot.
            var f = marks['F'];
            map.pools.Add(new FishingPool { center = new Int2(f.x - 1, f.y), standAt = f, charges = int.MaxValue });
            return map;
        }
    }
}
