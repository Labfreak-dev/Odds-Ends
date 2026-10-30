using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using Hollowmere.Core;

// Invariant checks for the engine-free core. Exit code 0 = all passed.
static class Program
{
    static int failed, passed;

    static void Check(bool ok, string what)
    {
        if (ok) passed++;
        else { failed++; Console.WriteLine("FAIL  " + what); }
    }

    static int Main()
    {
        Rngs();
        Items();
        Heroes();
        Skills();
        Dungeons();
        Monsters();
        Fishing();
        TownAndQuests();
        SaveRoundTrip();
        Progression();
        Console.WriteLine($"{passed} passed, {failed} failed");
        if (failed == 0) Console.WriteLine("ALL CORE CHECKS PASSED");
        return failed == 0 ? 0 : 1;
    }

    static void Rngs()
    {
        var a = new Rng(42); var b = new Rng(42);
        bool same = true;
        for (int i = 0; i < 100; i++) same &= a.NextU64() == b.NextU64();
        Check(same, "rng is deterministic for a seed");
        var r = new Rng(7);
        bool inRange = true;
        for (int i = 0; i < 10000; i++) { int v = r.Range(3, 9); float f = r.Value(); inRange &= v >= 3 && v < 9 && f >= 0 && f < 1; }
        Check(inRange, "rng ranges stay in bounds");
    }

    static void Items()
    {
        var rng = new Rng(1);
        var counts = new int[5];
        for (int i = 0; i < 20000; i++) counts[(int)Loot.RollRarity(rng, 0, Difficulty.Normal, LootSource.Normal)]++;
        Check(counts[0] > counts[1] && counts[1] > counts[2] && counts[2] > counts[3], $"rarity is ordered common>magic>rare>legendary ({string.Join(",", counts)})");
        Check(counts[3] + counts[4] > 0 && counts[3] + counts[4] < 400, $"legendary+set rate is rare but present ({counts[3] + counts[4]}/20000)");

        var mf = new int[5];
        for (int i = 0; i < 20000; i++) mf[(int)Loot.RollRarity(rng, 300, Difficulty.Normal, LootSource.Normal)]++;
        Check(mf[2] > counts[2], "magic find raises rare rate");

        foreach (HeroClass cls in Enum.GetValues(typeof(HeroClass)))
        {
            for (int i = 0; i < 400; i++)
            {
                var rar = (Rarity)(i % 5);
                var it = Loot.Generate(rng, 1 + i % 70, rar, cls);
                Check(it.Base != null, "item has a base");
                Check(it.affixes.Select(a => a.stat).Distinct().Count() == it.affixes.Count, $"no duplicate affix stats on {it.name}");
                Check(it.affixes.Count(a => StatInfo.IsMainStat(a.stat)) <= 1, $"at most one main stat on {it.name}");
                if (it.rarity >= Rarity.Rare && it.affixes.Any(a => StatInfo.IsMainStat(a.stat)))
                    Check(it.affixes.First(a => StatInfo.IsMainStat(a.stat)).stat == StatInfo.MainStat(cls), $"smart loot gives {cls} its main stat");
                if (it.rarity == Rarity.Legendary) Check(ItemDb.Legendary(it.legendaryId) != null && it.legendaryValue > 0, "legendary has a power");
                if (it.rarity == Rarity.Set) Check(ItemDb.Set(it.setId)?.pieces.Contains(it.baseId) == true, "set item belongs to its set");
                if (it.IsWeapon) Check(it.weaponMax > it.weaponMin && it.weaponMin > 0, "weapon damage is sane");
                foreach (var a in it.affixes)
                {
                    var def = ItemDb.Affix(a.affixId);
                    Check((def.slots & ItemDb.MaskOf(it.Base.slot)) != 0, $"affix {a.affixId} allowed on {it.Base.slot}");
                    Check(a.value > 0 && a.value <= def.MaxAt(it.itemLevel) * 1.31f + 1, $"affix {a.affixId}={a.value} within range at ilvl {it.itemLevel}");
                }
                Check(!string.IsNullOrEmpty(it.name), "item is named");
            }
        }

        // Mystic enchant only touches one affix and locks to it
        var rare = Loot.Generate(new Rng(9), 30, Rarity.Rare, HeroClass.Stalker);
        var before = rare.affixes.Select(a => a.stat).ToList();
        Check(Loot.Enchant(rare, 1, new Rng(10), HeroClass.Stalker), "enchant works");
        Check(rare.affixes.Where((a, i) => i != 1).Select(a => a.stat).SequenceEqual(before.Where((s, i) => i != 1)), "enchant leaves other affixes");
        Check(!Loot.Enchant(rare, 0, new Rng(11), HeroClass.Stalker), "enchant is locked to the first enchanted affix");

        // Every legendary's base exists and every set piece exists
        Check(ItemDb.Legendaries.All(l => ItemDb.Base(l.baseId) != null), "legendary bases exist");
        Check(ItemDb.Sets.All(s => s.pieces.All(p => ItemDb.Base(p) != null)), "set pieces exist");
        Check(ItemDb.Legendaries.Where(l => l.skillId != null).All(l => SkillDb.Get(l.skillId) != null), "legendary skill ids exist");
    }

    static void Heroes()
    {
        var rng = new Rng(3);
        foreach (HeroClass cls in Enum.GetValues(typeof(HeroClass)))
        {
            var h = Hero.Create(cls, "T", rng);
            var s = h.ComputeStats();
            Check(h.Equipped(EquipSlot.MainHand) != null && h.CanEquip(h.Equipped(EquipSlot.MainHand)), $"{cls} starts with a usable weapon");
            Check(h.MaxLife(s) > 50, $"{cls} life > 50");
            Check(h.SheetDps(s) > 1, $"{cls} dps > 1");
            Check(h.skills.bar[0] != null, $"{cls} starts with a primary skill on the bar");

            int levels = h.GainXp(1_000_000_000);
            Check(h.level == Balance.MaxLevel && levels == Balance.MaxLevel - 1, $"{cls} levels to cap");
            Check(h.skills.unspent + h.skills.ranks.Sum(r => r.rank) == SkillDb.PointsAtLevel(h.level), "skill points add up");

            // Gear makes a hero stronger
            float dps0 = h.SheetDps(h.ComputeStats());
            foreach (EquipSlot es in Enum.GetValues(typeof(EquipSlot)))
            {
                if (es == EquipSlot.Count || es == EquipSlot.OffHand) continue;
                var slot = es == EquipSlot.Ring1 || es == EquipSlot.Ring2 ? ItemSlot.Ring : (ItemSlot)Enum.Parse(typeof(ItemSlot), es.ToString());
                Item it;
                do it = Loot.Generate(rng, 70, Rarity.Rare, cls, slot); while (!h.CanEquip(it));
                h.inventory.Add(it);
                Check(h.Equip(it, es), $"{cls} equips {it.name} in {es}");
            }
            float dps1 = h.SheetDps(h.ComputeStats());
            Check(dps1 > dps0 * 5, $"{cls} level-70 rares multiply dps ({dps0:0} -> {dps1:0})");
            float expected = Balance.ExpectedHeroDps(70);
            Check(dps1 > expected * 0.3f && dps1 < expected * 4f, $"{cls} geared dps {dps1:0} near the curve's {expected:0}");
            Check(h.Equipped(EquipSlot.OffHand) == null || !h.Equipped(EquipSlot.MainHand).Base.twoHanded
                  || h.Equipped(EquipSlot.OffHand).baseId == "quiver", "two-hander never sits with an off-hand (quivers excepted)");
        }

        // Rings fill both slots
        var hr = Hero.Create(HeroClass.Ironclad, "R", rng);
        var r1 = Loot.Generate(rng, 5, Rarity.Magic, HeroClass.Ironclad, ItemSlot.Ring);
        var r2 = Loot.Generate(rng, 5, Rarity.Magic, HeroClass.Ironclad, ItemSlot.Ring);
        hr.inventory.Add(r1); hr.inventory.Add(r2);
        hr.Equip(r1); hr.Equip(r2);
        Check(hr.Equipped(EquipSlot.Ring1) == r1 && hr.Equipped(EquipSlot.Ring2) == r2, "two rings fill both ring slots");
        var r3 = Loot.Generate(rng, 5, Rarity.Magic, HeroClass.Ironclad, ItemSlot.Ring);
        hr.inventory.Add(r3); hr.Equip(r3);
        Check(hr.Equipped(EquipSlot.Ring1) == r3 && hr.inventory.Contains(r1), "third ring swaps ring 1 back to the bag");

        // Set bonuses apply
        var hs = Hero.Create(HeroClass.Ironclad, "S", rng);
        float dr0 = hs.ComputeStats()[Stat.DamageReduction];
        foreach (var p in ItemDb.Set("set_ironwall").pieces.Take(2))
        {
            var it = Loot.Generate(rng, 20, Rarity.Set, HeroClass.Ironclad, forceBase: p);
            it.setId = "set_ironwall";
            hs.inventory.Add(it); hs.Equip(it);
        }
        Check(hs.ComputeStats()[Stat.DamageReduction] >= dr0 + 15, "2-piece set bonus applies");
    }

    static void Skills()
    {
        foreach (HeroClass cls in Enum.GetValues(typeof(HeroClass)))
        {
            var list = SkillDb.ForClass(cls).ToList();
            Check(list.Count(s => s.primary) == 1, $"{cls} has exactly one primary");
            Check(list.Count(s => s.ultimate) == 1, $"{cls} has one ultimate");
            Check(list.Count(s => s.shape == SkillShape.Passive) == 4, $"{cls} has four passives");
            Check(list.Where(s => s.shape != SkillShape.Passive).All(s => s.runes.Count == 3), $"{cls} actives have three runes");
            Check(list.All(s => s.prereq == null || SkillDb.Get(s.prereq)?.cls == cls), $"{cls} prereqs are in-class");

            // Spend every point at level 70: tree must be fully completable over a career.
            var h = Hero.Create(cls, "T", new Rng(5));
            h.GainXp(1_000_000_000);
            bool progress = true;
            while (progress)
            {
                progress = false;
                foreach (var s in list) if (h.skills.RankUp(s, h.level)) progress = true;
            }
            Check(list.All(s => h.skills.Rank(s.id) == s.maxRank), $"{cls} can max every skill by level 70 ({h.skills.unspent} points left)");
            foreach (var s in list.Where(s => s.shape != SkillShape.Passive))
                foreach (var r in s.runes) Check(h.skills.SetRune(s, r.id, h.level), $"rune {r.id} selectable at 70");

            var st = h.ComputeStats();
            foreach (var s in list.Where(s => s.shape != SkillShape.Passive))
            {
                var c = SkillDb.Resolve(s, h, st);
                Check(c.cost >= 0 && c.cooldown >= 0 && c.radius > 0, $"{s.id} resolves sanely");
            }
            Check(h.skills.bar.Count(b => !string.IsNullOrEmpty(b)) == 5, $"{cls} bar auto-fills as skills are learned");
        }
        // Level gate
        var low = Hero.Create(HeroClass.Hexweaver, "L", new Rng(6));
        Check(!low.skills.RankUp(SkillDb.Get("hx_meteor"), low.level), "ultimate is level-gated");
    }

    static void Dungeons()
    {
        for (int depth = 1; depth <= 40; depth++)
        {
            var m = DungeonGenerator.Generate(depth, 12345);
            int floor = m.FloorCount();
            Check(m.CountReachable(m.entry) == floor, $"depth {depth}: every floor tile reachable");
            Check(m.Walkable(m.exit) && m.exit != m.entry, $"depth {depth}: exit is reachable and distinct");
            Check(m.spawns.Count > 5, $"depth {depth}: has monsters ({m.spawns.Count})");
            Check(m.spawns.All(s => m.Walkable(s.pos) && MonsterDb.Get(s.monsterId) != null), $"depth {depth}: spawns on floor with valid ids");
            Check(m.bossFloor == (depth % 5 == 0), $"depth {depth}: boss floor flag");
            if (m.bossFloor) Check(m.spawns.Count(s => s.rank == MonsterRank.Boss) == 1, $"depth {depth}: exactly one boss");
            foreach (var p in m.pools)
                Check(m.Get(p.center) == Tile.Water && m.Walkable(p.standAt) && p.center.Chebyshev(p.standAt) == 1, $"depth {depth}: pool has water and a place to stand");
            var path = Pathfinder.Find(m, m.entry, m.exit, 20000);
            Check(path != null && path.Last() == m.exit, $"depth {depth}: A* finds entry->exit");
        }
        var a = DungeonGenerator.Generate(7, 99); var b = DungeonGenerator.Generate(7, 99);
        Check(a.tiles.SequenceEqual(b.tiles) && a.spawns.Count == b.spawns.Count, "same seed, same floor");
        int pools = Enumerable.Range(1, 30).Count(d => DungeonGenerator.Generate(d, 777).pools.Count > 0);
        Check(pools >= 12, $"fishing pools are common ({pools}/30 floors)");

        var town = Town.BuildTownMap(out var marks);
        Check(town.CountReachable(town.entry) == town.FloorCount(), "town is fully connected");
        Check("MBYGSQFDP".All(marks.ContainsKey), "town has every service");
        Check(town.pools.Count == 1 && town.Get(town.pools[0].center) == Tile.Water, "town lake is fishable");
    }

    static void Monsters()
    {
        var rng = new Rng(4);
        foreach (var def in MonsterDb.All)
        {
            var m = MonsterDb.Create(def, 20, def.boss ? MonsterRank.Boss : MonsterRank.Normal, Difficulty.Normal, rng);
            Check(m.maxLife > 0 && m.damage > 0 && m.xp > 0, $"{def.id} has stats");
        }
        // Time-to-kill sanity: an expected hero kills a normal in ~1-3s, boss in 30-90s.
        foreach (int lvl in new[] { 1, 10, 30, 60, 70 })
        {
            var n = MonsterDb.Create(MonsterDb.Get("bonewalker"), lvl, MonsterRank.Normal, Difficulty.Normal, rng);
            var boss = MonsterDb.Create(MonsterDb.Get("boss_abbot"), lvl, MonsterRank.Boss, Difficulty.Normal, rng);
            float dps = Balance.ExpectedHeroDps(lvl);
            float ttk = n.maxLife / dps, bttk = boss.maxLife / dps;
            Check(ttk > 0.5f && ttk < 6f, $"lvl {lvl}: normal ttk {ttk:0.0}s vs the expected curve");
            Check(bttk > 20 && bttk < 150, $"lvl {lvl}: boss ttk {bttk:0}s vs the expected curve");
            float hits = Balance.ExpectedHeroLife(lvl) / n.damage;
            Check(hits > 8 && hits < 60, $"lvl {lvl}: hero survives {hits:0} unmitigated normal hits");
        }
        var t6 = MonsterDb.Create(MonsterDb.Get("bonewalker"), 70, MonsterRank.Elite, Difficulty.Torment6, rng);
        Check(t6.affixes.Count >= 4, "torment elites stack affixes");
        Check(MonsterDb.BossFor(5).id == "boss_ossuary" && MonsterDb.BossFor(10).id == "boss_matriarch", "boss rotation");
        for (int d = 1; d < 60; d++) Check(MonsterDb.ForDepth(d).Count > 0, $"monsters exist at depth {d}");
    }

    static void Fishing()
    {
        // A perfect player: tap on bite only, hold while tension < 0.7
        int caught = 0, sessions = 300, nonFish = 0;
        var seen = new HashSet<string>();
        for (int i = 0; i < sessions; i++)
        {
            var fs = new FishingSession(new Rng((ulong)(i + 1)), i % 2 == 0, 12, 0, 0, 20, HeroClass.Stalker, Difficulty.Normal);
            fs.Cast();
            for (int t = 0; t < 3000 && !fs.Done; t++)
            {
                if (fs.phase == FishingPhase.Bite) fs.Tap();
                if (fs.phase == FishingPhase.Reeling) fs.Hold(fs.tension < 0.7f);
                fs.Tick(0.02f);
            }
            Check(fs.Done, "fishing session ends");
            if (fs.phase == FishingPhase.Caught) { caught++; if (fs.result.fish != null) seen.Add(fs.result.fish.id); else nonFish++; }
        }
        Check(caught > sessions * 0.6f, $"a careful angler lands most fish ({caught}/{sessions})");
        Check(nonFish > 0, "sometimes reels up items/gold/junk");
        Check(seen.Count >= 4, $"variety of species ({seen.Count})");

        // A reckless player who never lets go snaps most lines
        int snapped = 0;
        for (int i = 0; i < 100; i++)
        {
            var fs = new FishingSession(new Rng((ulong)(i + 999)), false, 25, 0, 0, 40, HeroClass.Stalker, Difficulty.Normal);
            fs.Cast();
            for (int t = 0; t < 3000 && !fs.Done; t++)
            {
                if (fs.phase == FishingPhase.Bite) fs.Tap();
                fs.Hold(true);
                fs.Tick(0.02f);
            }
            if (fs.phase == FishingPhase.Snapped) snapped++;
        }
        Check(snapped > 30, $"holding forever snaps lines ({snapped}/100)");

        // Tapping on a nibble spooks
        var sp = new FishingSession(new Rng(5), true, 1, 0, 0, 1, HeroClass.Ironclad, Difficulty.Normal);
        sp.Cast();
        bool spooked = false;
        for (int t = 0; t < 5000 && !sp.Done; t++) { if (sp.phase == FishingPhase.Nibble) { sp.Tap(); spooked = sp.phase == FishingPhase.Spooked; break; } sp.Tick(0.02f); }
        Check(spooked || sp.phase != FishingPhase.Nibble, "tapping a nibble spooks the fish");

        Check(FishDb.All.Where(f => f.effect == FishEffect.PetForm).All(f => PetDb.Get(f.petForm) != null), "every form fish has a pet form");
        Check(FishDb.Available(true, 0).Count >= 4, "town lake has several species");

        var pet = new PetState();
        pet.Feed(FishDb.Get("emberfin"), 0);
        Check(pet.Form?.id == "cinderdrake", "feeding a form fish transforms the pet");
        pet.Tick(100);
        Check(pet.Form == null, "temporary form expires");
        pet.Feed(FishDb.Get("abyssal"), 0);
        pet.Tick(10000);
        Check(pet.Form?.id == "leviathan", "permanent form persists");
        pet.pack.Add(Loot.Generate(new Rng(1), 10, Rarity.Magic, null));
        Check(pet.SendToTown() && pet.Away, "pet goes to town to sell");
        long g = 0; for (int i = 0; i < 100; i++) g += pet.Tick(1);
        Check(!pet.Away && g > 0, "pet returns with gold");
    }

    static void TownAndQuests()
    {
        var s = GameState.NewGame(HeroClass.Ironclad, "Q", PetSpecies.Hound, "Rex", 77);
        Check(s.quests.Count == 3, "quest board offers three");
        s.hero.gold = 100000;
        Check(Town.Buy(s, ItemKind.Potion, 5), "buy potions");
        var g = Town.Gamble(s, ItemSlot.Ring, new Rng(3));
        Check(g != null && g.rarity >= Rarity.Rare && g.Base.slot == ItemSlot.Ring, "gamble gives a rare+ of the chosen slot");
        Check(Town.Salvage(s, g) && (s.materials.dust > 0 || s.materials.souls > 0), "salvage yields materials");
        var q = s.quests[0]; q.accepted = true; q.complete = true;
        var lvl = s.hero.level;
        var reward = Town.TurnIn(s, q, new Rng(4));
        Check(reward != null && q.turnedIn, "quest turn-in gives a reward");
        Town.RefreshQuests(s, new Rng(8));
        Check(s.quests.Count(x => !x.turnedIn) == 3, "board refills");

        var fishQ = new Quest { id = "fq", kind = QuestKind.CatchFish, target = "minnow", needed = 2, accepted = true };
        s.quests.Add(fishQ);
        s.OnFish(FishDb.Get("minnow")); s.OnFish(FishDb.Get("minnow"));
        Check(fishQ.complete, "fish quest completes");
        Check(!Town.SetDifficulty(s, Difficulty.Torment1), "torment locked before 70");
        Check(Town.SetDifficulty(s, Difficulty.Master), "master open from the start");
    }

    /// <summary>A bot clears floors 1..40: kills everything, keeps any item that raises sheet DPS
    /// without dropping toughness much, spends skill points. Checks the pacing stays sane.</summary>
    static void Progression()
    {
        foreach (HeroClass cls in Enum.GetValues(typeof(HeroClass)))
        {
            var rng = new Rng(2024 + (ulong)cls);
            var s = GameState.NewGame(cls, "Bot", PetSpecies.Hound, "Dog", 99);
            var h = s.hero;
            var table = new List<string>();
            for (int depth = 1; depth <= 40; depth++)
            {
                var map = DungeonGenerator.Generate(depth, 99);
                int mlvl = Balance.MonsterLevel(depth, h.level);
                double seconds = 0;
                foreach (var sp in map.spawns)
                {
                    var m = MonsterDb.Create(MonsterDb.Get(sp.monsterId), mlvl, sp.rank, s.difficulty, rng);
                    var st = h.ComputeStats();
                    seconds += m.maxLife / Math.Max(1, h.SheetDps(st) * 1.5f);   // skills ~1.5x sheet, some AoE
                    s.OnKill(m, depth);
                    h.GainXp(m.xp);
                    var src = sp.rank == MonsterRank.Boss ? LootSource.Boss : sp.rank == MonsterRank.Elite ? LootSource.Elite : sp.rank == MonsterRank.Champion ? LootSource.Champion : LootSource.Normal;
                    var drop = Loot.Roll(rng, src, m.level, s.difficulty, st, cls);
                    h.gold += drop.gold;
                    foreach (var it in drop.items)
                    {
                        if (!h.CanEquip(it)) continue;
                        var before = h.ComputeStats();
                        float dps0 = h.SheetDps(before), t0 = h.Toughness(before);
                        var snapshot = (Item[])h.equipment.Clone();
                        var inv = h.inventory.ToList();
                        h.inventory.Add(it);
                        if (!h.Equip(it)) { h.inventory.Remove(it); continue; }
                        var after = h.ComputeStats();
                        if (h.SheetDps(after) < dps0 * 1.01f || h.Toughness(after) < t0 * 0.85f) { h.equipment = snapshot; h.inventory = inv; }
                        else h.inventory = inv;
                    }
                }
                // Spend points: primary first, then everything else greedily.
                bool any = true;
                while (any) { any = false; foreach (var sk in SkillDb.ForClass(cls)) if (h.skills.RankUp(sk, h.level)) any = true; }
                var fin = h.ComputeStats();
                var probe = MonsterDb.Create(MonsterDb.Get("bonewalker"), Balance.MonsterLevel(depth + 1, h.level), MonsterRank.Normal, s.difficulty, rng);
                float ttk = probe.maxLife / Math.Max(1, h.SheetDps(fin));
                var bossM = MonsterDb.Create(MonsterDb.BossFor(5), Balance.MonsterLevel(depth, h.level), MonsterRank.Boss, s.difficulty, rng);
                float bossTtk = bossM.maxLife / Math.Max(1, h.SheetDps(fin) * 1.5f);
                if (depth % 5 == 0) Check(bossTtk > 10 && bossTtk < 180, $"{cls} floor {depth}: guardian fight {bossTtk:0}s");
                float hits = h.MaxLife(fin) / Combat.MonsterHit(probe.damage, Element.Physical, fin, probe.level, rng).amount;
                if (depth % 5 == 0) table.Add($"  floor {depth,2}: lvl {h.level,2}  clear {seconds / 60:0.0}m  dps {Fx(h.SheetDps(fin)),7}  normal ttk {ttk:0.0}s  guardian {bossTtk:0}s  survives {hits:0} hits");
                if (depth >= 3) Check(ttk > 0.4f && ttk < 8f, $"{cls} floor {depth}: a normal monster dies in < 8s (got {ttk:0.0})");
                if (depth >= 3) Check(hits > 4, $"{cls} floor {depth}: survives > 4 hits (got {hits:0})");
            }
            Check(h.level >= 25 && h.level <= Balance.MaxLevel, $"{cls} reaches a sensible level by floor 40 ({h.level})");
            Console.WriteLine($"{cls}:");
            foreach (var line in table) Console.WriteLine(line);
        }
    }

    static string Fx(float v) => v >= 1e6f ? (v / 1e6f).ToString("0.0") + "M" : v >= 1e4f ? (v / 1e3f).ToString("0") + "K" : v.ToString("0");

    static void SaveRoundTrip()
    {
        var s = GameState.NewGame(HeroClass.Hexweaver, "Save", PetSpecies.Lynx, "Mog", 5);
        var rng = new Rng(2);
        for (int i = 0; i < 10; i++) s.hero.AddItem(Loot.Generate(rng, 30, (Rarity)(i % 5), HeroClass.Hexweaver));
        s.pet.Feed(FishDb.Get("goldscale"), 0);
        var opts = new JsonSerializerOptions { IncludeFields = true };
        string json = JsonSerializer.Serialize(s, opts);
        var back = JsonSerializer.Deserialize<GameState>(json, opts);
        back.Normalize();
        Check(back.hero.inventory.Count == s.hero.inventory.Count, "inventory survives save");
        Check(back.hero.Equipped(EquipSlot.MainHand)?.name == s.hero.Equipped(EquipSlot.MainHand).name, "equipment survives save");
        Check(Math.Abs(back.hero.SheetDps(back.hero.ComputeStats()) - s.hero.SheetDps(s.hero.ComputeStats())) < 0.01f, "stats identical after load");
        // JsonUtility writes null strings as "": stacking must still work after a load.
        var potions = back.hero.inventory.First(i => i.kind == ItemKind.Potion);
        potions.fishId = "";
        int before = back.hero.inventory.Count;
        back.hero.AddItem(Loot.Potion(2));
        Check(back.hero.inventory.Count == before && potions.stack == 5, "potions stack onto a loaded stack");
        Check(back.pet.form == "goldscale".Replace("goldscale", "gildedserpent"), "pet form survives save");
    }
}
