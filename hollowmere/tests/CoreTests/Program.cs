using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text;
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
        ModelAlbedo();
        PostVolumeLevel();
        HeroFitLevel();
        GearFitLevel();
        Cc0PropFiles();
        ModularKitFiles();
        SpecTables();
        P2P5();
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
        for (int i = 0; i < 20000; i++) counts[(int)Loot.RollRarity(rng, 0, LootSource.Normal)]++;
        Check(counts[0] > counts[1] && counts[1] > counts[2] && counts[2] > counts[3], $"rarity is ordered common>magic>rare>legendary ({string.Join(",", counts)})");
        Check(counts[3] + counts[4] > 0 && counts[3] + counts[4] < 400, $"legendary+set rate is rare but present ({counts[3] + counts[4]}/20000)");

        var mf = new int[5];
        for (int i = 0; i < 20000; i++) mf[(int)Loot.RollRarity(rng, 300, LootSource.Normal)]++;
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
            Check(h.skills.bar.Count(b => !string.IsNullOrEmpty(b)) == 6, $"{cls} bar auto-fills as skills are learned");
        }
        Classless();
        // Level gate
        var low = Hero.Create(HeroClass.Hexweaver, "L", new Rng(6));
        Check(!low.skills.RankUp(SkillDb.Get("hx_meteor"), low.level), "ultimate is level-gated");
    }

    static void Classless()
    {
        var rng = new Rng(9);
        var h = Hero.CreateCustom("Ada", 2, 1, 3, 0, 0.8f, 0.55f, 0.3f, rng);
        Check(h.classless && h.body == 2 && h.Equipped(EquipSlot.MainHand).baseId == "sword", "custom hero starts with a sword");
        Check(h.skills.Rank("ic_cleave") == 1 && h.BasicAttack().id == "ic_cleave" && h.AnimSet() == "melee", "a sword swings Cleave");
        Check(h.DamageStat() == Stat.Strength, "melee scales with strength");
        float bare = h.SheetDps(h.ComputeStats());
        var dex = new Item { uid = "dex", kind = ItemKind.Equipment, baseId = "ring", name = "Fox", rarity = Rarity.Magic, affixes = new List<AffixRoll> { new AffixRoll { stat = Stat.Dexterity, value = 80 } } };
        h.inventory.Add(dex);
        Check(h.Equip(dex), "dexterity ring equips");
        Check(Math.Abs(h.SheetDps(h.ComputeStats()) - bare) < 0.01f, "dexterity does not scale a sword");
        var str = new Item { uid = "str", kind = ItemKind.Equipment, baseId = "ring", name = "Ox", rarity = Rarity.Magic, affixes = new List<AffixRoll> { new AffixRoll { stat = Stat.Strength, value = 100 } } };
        h.inventory.Add(str);
        Check(h.Equip(str), "strength ring equips");
        Check(h.ComputeStats()[Stat.Strength] >= Balance.BaseOffStat(h.level) + 100, "strength comes from the affix");
        Check(h.SheetDps(h.ComputeStats()) > bare * 1.5f, "strength scales the sword");

        var axe = Loot.Generate(rng, 4, Rarity.Common, null, forceBase: "greataxe");
        h.inventory.Add(axe);
        Check(h.Equip(axe) && h.BasicAttack().id == "ic_slam" && h.AnimSet() == "melee2" && h.AttackFamily() == WeaponFamily.Melee, "a two-hander uses the slam set");
        var bow = Loot.Generate(rng, 4, Rarity.Common, null, forceBase: "bow");
        h.inventory.Add(bow);
        Check(h.Equip(bow) && h.AttackFamily() == WeaponFamily.Ranged && h.BasicAttack().id == "st_twinshot" && h.DamageStat() == Stat.Dexterity, "a bow switches to Twin Shot");
        var staff = Loot.Generate(rng, 4, Rarity.Common, null, forceBase: "staff");
        h.inventory.Add(staff);
        Check(h.Equip(staff) && h.AttackFamily() == WeaponFamily.Magic && h.BasicAttack().id == "hx_bolt" && h.AnimSet() == "magic", "a staff switches to Hex Bolt");
        h.equipment[(int)EquipSlot.MainHand] = null;
        var orb = Loot.Generate(rng, 4, Rarity.Common, null, forceBase: "orb");
        h.inventory.Add(orb);
        Check(h.Equip(orb) && h.AttackFamily() == WeaponFamily.Magic, "an orb alone is magic");

        Check(h.Learn("st_volley") && h.skills.bar.Contains("st_volley"), "a tome grants Volley onto the bar");
        Check(!h.Learn("st_volley"), "the same tome does not grant twice");
        Check(h.Knows(SkillDb.Get("ic_cleave")) && h.Knows(SkillDb.Get("st_volley")), "a hybrid can know both families");

        var old = GameState.NewGame(HeroClass.Stalker, "Mig", PetSpecies.Hound, "A", 3);
        old.hero.GainXp(Balance.XpToNext(1) + Balance.XpToNext(2));
        Check(old.hero.skills.RankUp(SkillDb.Get("st_volley"), old.hero.level), "the old stalker learned Volley");
        string bowName = old.hero.Equipped(EquipSlot.MainHand).name;
        old.version = 2;
        old.Normalize();
        Check(old.hero.classless && old.version == 3 && old.hero.Equipped(EquipSlot.MainHand).name == bowName, "migration keeps the bow and becomes one hero");
        Check(old.hero.skills.Rank("st_twinshot") >= 1 && old.hero.skills.Rank("st_volley") >= 1, "former skills stay granted");
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
        Check(DungeonMap.ThemeFor(1) == Theme.Crypt && DungeonMap.ThemeFor(5) == Theme.Crypt, "crypt is floors 1-5");
        Check(DungeonMap.ThemeFor(6) == Theme.Caverns && DungeonMap.ThemeFor(10) == Theme.Caverns, "flooded caverns are floors 6-10");
        Check(DungeonMap.ThemeFor(11) == Theme.SunkenHalls && DungeonMap.ThemeFor(15) == Theme.SunkenHalls, "bone forge is floors 11-15");
        Check(DungeonMap.ThemeFor(16) == Theme.EmberDepths && DungeonMap.ThemeFor(40) == Theme.EmberDepths, "infernal is floor 16 and below");
        var shapes = new HashSet<string>();
        for (int s = 1; s <= 6; s++)
            foreach (var room in DungeonGenerator.Generate(3, (ulong)s).rooms)
                if (!string.IsNullOrEmpty(room.shape)) shapes.Add(room.shape);
        Check(shapes.Count >= 3, $"crypt draws several room shapes ({shapes.Count})");
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
            var m = MonsterDb.Create(def, 20, def.boss ? MonsterRank.Boss : MonsterRank.Normal, rng);
            Check(m.maxLife > 0 && m.damage > 0 && m.xp > 0, $"{def.id} has stats");
        }
        // Time-to-kill sanity: an expected hero kills a normal in ~1-3s, boss in 30-90s.
        foreach (int lvl in new[] { 1, 10, 30, 60, 70 })
        {
            var n = MonsterDb.Create(MonsterDb.Get("bonewalker"), lvl, MonsterRank.Normal, rng);
            var boss = MonsterDb.Create(MonsterDb.Get("boss_abbot"), lvl, MonsterRank.Boss, rng);
            float dps = Balance.ExpectedHeroDps(lvl);
            float ttk = n.maxLife / dps, bttk = boss.maxLife / dps;
            Check(ttk > 0.5f && ttk < 6f, $"lvl {lvl}: normal ttk {ttk:0.0}s vs the expected curve");
            Check(bttk > 20 && bttk < 150, $"lvl {lvl}: boss ttk {bttk:0}s vs the expected curve");
            float hits = Balance.ExpectedHeroLife(lvl) / n.damage;
            Check(hits > 8 && hits < 60, $"lvl {lvl}: hero survives {hits:0} unmitigated normal hits");
        }
        var deep = MonsterDb.Create(MonsterDb.Get("bonewalker"), 70, MonsterRank.Elite, rng, 40);
        Check(deep.affixes.Count == DesignTable.AffixCount(MonsterRank.Elite, 40), "floor 40 elites gain affixes from depth");
        Check(MonsterDb.BossFor(5).id == "boss_ossuary" && MonsterDb.BossFor(10).id == "boss_matriarch", "boss rotation");
        Check(MonsterDb.BossFor(25).id == "boss_mutant" && MonsterDb.BossFor(30).id == "boss_lava", "v6 bosses join the rotation");
        MonsterDb.UseRoster(new[] { "grave_eater", "wraith", "horror_ghoul", "bonewalker", "boneslinger" });
        var crypt = MonsterDb.ForDepth(3);
        Check(crypt.Count == 5 && crypt.Any(m => m.id == "wraith") && crypt.All(m => !m.boss), "crypt roster");
        MonsterDb.ClearRoster();
        for (int d = 1; d < 60; d++) Check(MonsterDb.ForDepth(d).Count > 0, $"monsters exist at depth {d}");
    }

    static void Fishing()
    {
        // A perfect player: tap on bite only, hold while tension < 0.7
        int caught = 0, sessions = 300, nonFish = 0;
        var seen = new HashSet<string>();
        for (int i = 0; i < sessions; i++)
        {
            var fs = new FishingSession(new Rng((ulong)(i + 1)), i % 2 == 0, 12, 0, 0, 20, HeroClass.Stalker);
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
            var fs = new FishingSession(new Rng((ulong)(i + 999)), false, 25, 0, 0, 40, HeroClass.Stalker);
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
        var sp = new FishingSession(new Rng(5), true, 1, 0, 0, 1, HeroClass.Ironclad);
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
        Check(s.version == 3, "new games are save version 3");
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
                    var m = MonsterDb.Create(MonsterDb.Get(sp.monsterId), mlvl, sp.rank, rng, depth);
                    var st = h.ComputeStats();
                    seconds += m.maxLife / Math.Max(1, h.SheetDps(st) * 1.5f);   // skills ~1.5x sheet, some AoE
                    s.OnKill(m, depth);
                    h.GainXp(m.xp);
                    var src = sp.rank == MonsterRank.Boss ? LootSource.Boss : sp.rank == MonsterRank.Elite ? LootSource.Elite : sp.rank == MonsterRank.Champion ? LootSource.Champion : LootSource.Normal;
                    var drop = Loot.Roll(rng, src, m.level, st, cls, depth);
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
                var probe = MonsterDb.Create(MonsterDb.Get("bonewalker"), Balance.MonsterLevel(depth + 1, h.level), MonsterRank.Normal, rng, depth + 1);
                float ttk = probe.maxLife / Math.Max(1, h.SheetDps(fin));
                var bossM = MonsterDb.Create(MonsterDb.BossFor(5), Balance.MonsterLevel(depth, h.level), MonsterRank.Boss, rng, depth);
                float bossTtk = bossM.maxLife / Math.Max(1, h.SheetDps(fin) * 1.5f);
                if (depth % 5 == 0) Check(bossTtk >= 8 && bossTtk < 180, $"{cls} floor {depth}: guardian fight {bossTtk:0}s");
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

        const string oldSave = "{\"version\":1,\"seed\":7,\"difficulty\":6,\"hero\":{\"name\":\"Old\",\"heroClass\":0,\"level\":12},\"depth\":4,\"deepest\":9}";
        var migrated = JsonSerializer.Deserialize<GameState>(oldSave, opts);
        migrated.Normalize();
        Check(migrated.version == 3 && migrated.hero.classless && migrated.hero.level == 12 && migrated.depth == 4 && migrated.deepest == 9, "a version 1 save with a difficulty field still loads");
        Check(migrated.hero.skills.Rank("ic_cleave") == 1, "a migrated ironclad is granted Cleave");
        string rewritten = JsonSerializer.Serialize(migrated, opts);
        Check(!rewritten.Contains("difficulty"), "rewritten saves omit difficulty");
    }

    static bool Overlaps(DesignTable.Rect a, DesignTable.Rect b)
        => a.X < b.X + b.W && b.X < a.X + a.W && a.Y < b.Y + b.H && b.Y < a.Y + a.H;

    static bool Contains(DesignTable.Rect outer, DesignTable.Rect inner)
        => inner.X >= outer.X && inner.Y >= outer.Y && inner.X + inner.W <= outer.X + outer.W && inner.Y + inner.H <= outer.Y + outer.H;

    static string FeelAssetFile(string name)
    {
        foreach (var c in new[]
        {
            Path.Combine("Assets", "Resources", name),
            Path.Combine("hollowmere", "Assets", "Resources", name),
            Path.Combine("..", "..", "Assets", "Resources", name),
        })
            if (File.Exists(c)) return File.ReadAllText(c);
        return null;
    }

    static string YamlField(string text, string key)
    {
        foreach (var raw in text.Split('\n'))
        {
            var line = raw.Trim();
            if (line.StartsWith(key + ":", StringComparison.Ordinal))
                return line.Substring(key.Length + 1).Trim();
        }
        return null;
    }

    static List<string[]> SpecRows(string heading)
    {
        string path = null;
        foreach (var c in new[] { "DESIGN_SPEC.md", Path.Combine("hollowmere", "DESIGN_SPEC.md"), Path.Combine("..", "..", "DESIGN_SPEC.md") })
            if (File.Exists(c)) { path = c; break; }
        Check(path != null, "DESIGN_SPEC.md is on disk");
        if (path == null) return new List<string[]>();
        var rows = new List<string[]>();
        bool on = false, sawTable = false;
        foreach (var raw in File.ReadAllLines(path))
        {
            var line = raw.Trim();
            if (line.StartsWith("### "))
            {
                if (on) break;
                on = line == heading;
                continue;
            }
            if (!on) continue;
            if (line.StartsWith("## ")) break;
            if (!line.StartsWith("|"))
            {
                if (sawTable) break;
                continue;
            }
            if (line.Contains("---")) continue;
            sawTable = true;
            var cells = line.Split('|').Select(s => s.Trim()).Where(s => s.Length > 0).ToArray();
            if (cells.Length == 0) continue;
            if (cells[0] is "Level" or "Rank" or "Floor" or "Rarity" or "Id" or "Screen" or "Slot" or "Gem" or "Source" or "Phase" or "Tab" or "Line")
                continue;
            rows.Add(cells);
        }
        Check(rows.Count > 0, heading + " has rows");
        return rows;
    }

    static string ArtPath(string rel)
    {
        foreach (var root in new[] { "Assets", Path.Combine("hollowmere", "Assets"), Path.Combine("..", "..", "Assets") })
        {
            var p = Path.Combine(root, rel);
            if (File.Exists(p)) return p;
        }
        return null;
    }

    static void CombatSpec()
    {
        foreach (var row in SpecRows("### T.cast"))
        {
            var t = DesignTable.CastFor(row[0]);
            Check(t.Windup == int.Parse(row[1]) && t.Strike == int.Parse(row[2]) && t.Recover == int.Parse(row[3]), "cast " + row[0]);
        }
        foreach (var row in SpecRows("### T.hitstop"))
            Check(DesignTable.HitStopMs(row[0]) == int.Parse(row[1]), "hitstop " + row[0]);
        foreach (var row in SpecRows("### T.shake"))
            Check(DesignTable.ShakeMm(row[0]) == int.Parse(row[1]), "shake " + row[0]);
        foreach (var row in SpecRows("### T.sparks"))
        {
            var s = DesignTable.Sparks(row[0]);
            Check(s.Count == int.Parse(row[1]) && s.Speed == int.Parse(row[2]) && s.Life == int.Parse(row[3]) && s.Size == int.Parse(row[4]), "sparks " + row[0]);
        }
        foreach (var row in SpecRows("### T.numbers"))
        {
            var n = DesignTable.Number(row[0]);
            Check(n.Hex == row[1] && n.Size == int.Parse(row[2]) && n.Rise == int.Parse(row[3]) && n.Life == int.Parse(row[4]), "number " + row[0]);
        }
        foreach (var row in SpecRows("### T.vfx"))
        {
            var v = DesignTable.Vfx(row[0]);
            Check(v.Hex == row[1] && v.Kind == row[2], "vfx " + row[0]);
            string sheet = ArtPath(Path.Combine("Art", "Combat", "vfx", DesignTable.SheetName(row[0]) + ".png"));
            Check(DesignTable.HasSheet(row[0]) == (sheet != null), "sheet " + row[0]);
        }
        foreach (var row in SpecRows("### T.trail"))
            Check(DesignTable.Tune(row[0]) == decimal.Parse(row[1], System.Globalization.CultureInfo.InvariantCulture), "trail " + row[0]);
        foreach (var row in SpecRows("### T.clips"))
        {
            Check(DesignTable.TryTrim(row[0], out int a, out int b, out int src), "trim " + row[0]);
            Check(a == int.Parse(row[1]) && b == int.Parse(row[2]) && src == int.Parse(row[3]), "trim window " + row[0]);
            Check(b > a && b < src, "trim is shorter " + row[0]);
        }
        Check(DesignTable.SheetFps("ic_whirl") == 20 && DesignTable.SheetLoops("ic_whirl"), "whirl sheet loops at 20");
        Check(DesignTable.SheetFps("ic_cleave") == 24 && !DesignTable.SheetLoops("ic_cleave"), "cleave sheet plays once at 24");
        Check(DesignTable.Glyph("normal", '1', out _, out _, out _, out int adv) && adv == 40, "digit 1 advances 40");
        string font = ArtPath(Path.Combine("Art", "Combat", "damage_font", "damage_font.json"));
        Check(font != null, "damage font json is on disk");
        if (font != null)
        {
            using var doc = JsonDocument.Parse(File.ReadAllText(font));
            int fileAdv = doc.RootElement.GetProperty("normal").GetProperty("glyphs").GetProperty("1").GetProperty("advance").GetInt32();
            Check(fileAdv == 40, "font json digit 1 advance");
            int critBang = doc.RootElement.GetProperty("crit").GetProperty("glyphs").GetProperty("!").GetProperty("advance").GetInt32();
            Check(DesignTable.Glyph("crit", '!', out _, out _, out _, out int bang) && bang == critBang, "crit bang advance");
        }
        string[] skills = { "ic_cleave", "ic_slam", "ic_charge", "ic_whirl", "ic_warcry", "ic_earthsplit", "st_twinshot", "st_volley", "st_caltrops", "st_roll", "st_mark", "st_rain", "hx_bolt", "hx_frostring", "hx_chain", "hx_blink", "hx_thrall", "hx_meteor" };
        foreach (var id in skills)
        {
            string packPath = ArtPath(Path.Combine("Resources", "Combat", DesignTable.ClipHero(id) + "_combat.bytes"));
            Check(packPath != null, "clip pack for " + id);
            if (packPath == null) continue;
            var clips = CombatClipPack.Load(File.ReadAllBytes(packPath));
            var clip = clips.FirstOrDefault(c => c.Name == DesignTable.ClipFor(id));
            Check(clip != null && clip.Bones != null && clip.Bones.Length > 0, "clip " + DesignTable.ClipFor(id));
            if (clip == null || clip.Bones == null || clip.Bones.Length == 0) continue;
            var key = clip.Bones[0].Keys[0];
            float m = key.X * key.X + key.Y * key.Y + key.Z * key.Z + key.W * key.W;
            Check(m > 0.98f && m < 1.02f, "unit quaternion " + clip.Name);
            if (DesignTable.TryTrim(clip.Name, out int a, out int b, out _))
            {
                var cut = CombatClipPack.Slice(clip, a, b);
                float last = 0f;
                foreach (var bone in cut.Bones)
                    if (bone.Keys.Length > 0) last = Math.Max(last, bone.Keys[bone.Keys.Length - 1].Time);
                Check(Math.Abs(last - (b - a) / 24f) < 0.02f, "sliced " + clip.Name + " lasts " + last);
            }
        }
    }

    static void P2P5()
    {
        Check(DesignTable.GemCombineGold(1) == 100 && DesignTable.GemCombineGold(2) == 400 && DesignTable.GemCombineGold(5) == 0, "gem combine gold");
        Check(DesignTable.Mote("Legendary").Motes == 12 && DesignTable.Mote("Legendary").Ring == 1, "legendary motes");
        Check(DesignTable.Mote("Common").Motes == 0, "common has no motes");
        Check(System.Math.Abs(DesignTable.FishWeight(10f, 1, 11) - 14f) < 0.02f, "minnow weight at floor 11");
        Check(DesignTable.FishWeight(0.5f, 20, 10) == 0f, "abyssal has no weight below its depth");
        Check(DesignTable.HopMm == 550 && DesignTable.CastMs == 700, "presentation anchors");
        Check(DesignTable.GemArt("cinder_1") == "gem_ruby_chipped" && DesignTable.GemArt("salt_5") == "gem_sapphire_royal", "gem art names");
        Check(DesignTable.WeaponKey(HeroClass.Hexweaver, "staff") == "hexweaver_weapon_1", "staff model");
        foreach (var row in SpecRows("### T.attack"))
        {
            string sample = row[1].Split(',')[0].Trim();
            var got = DesignTable.AttackFor(sample, null);
            Check(got.Id == row[0] && got.BasicSkill == row[2] && got.AnimSet == row[3] && got.Scale.ToString() == row[4], "attack " + row[0]);
        }
        Check(DesignTable.AttackFor(null, "orb").Id == "magic", "an orb is a magic weapon");
        Check(DesignTable.BeamHex("legendary") == "#BF642F" && DesignTable.BeamRelMilli("common") == 350, "beam tint and height");
        foreach (var row in SpecRows("### T.grip"))
        {
            Check(DesignTable.TryGrip(row[0], out var grip)
                && grip.LengthMm == int.Parse(row[1])
                && grip.AboveMm == int.Parse(row[2])
                && grip.BelowMm == int.Parse(row[3])
                && grip.WidthMm == int.Parse(row[4]), "grip " + row[0]);
        }
        var h = Hero.Create(HeroClass.Hexweaver, "Gem", new Rng(2));
        h.AddItem(Gems.Make("cinder", 1, 3));
        Check(Gems.Combine(h, "cinder", 1) && Gems.Count(h, "cinder_2") == 1 && Gems.Count(h, "cinder_1") == 0, "three rank-1 cinders combine");
        var gear = h.Equipped(EquipSlot.Chest);
        if (!Item.IsNone(gear))
        {
            gear.sockets = 1;
            h.AddItem(Gems.Make("marrow", 1, 1));
            Check(Gems.Socket(h, gear, "marrow_1") && gear.gemId == "marrow_1", "socket marrow into the chest");
            Check(Gems.MarrowLife(h) == 35, "rank 1 marrow is 35 life");
        }
    }

    static void SpecTables()
    {
        Check(Balance.XpToNext(70) == long.MaxValue, "level 70 sentinel stays on Balance");
        Check(DesignTable.XpToNext(1) == 120 && DesignTable.XpToNext(10) == 6748, "xp anchors stay on the data table");

        foreach (var row in SpecRows("### T.ui"))
        {
            var hit = DesignTable.Ui.FirstOrDefault(r => r.Screen == row[0] && r.Id == row[1]);
            Check(hit.Id == row[1] && hit.X == int.Parse(row[2]) && hit.Y == int.Parse(row[3]) && hit.W == int.Parse(row[4]) && hit.H == int.Parse(row[5]), "ui " + row[0] + " " + row[1]);
        }
        foreach (var row in SpecRows("### T.doll"))
        {
            var hit = DesignTable.Doll.FirstOrDefault(r => r.Id == row[0]);
            Check(hit.Id == row[0] && hit.X == int.Parse(row[1]) && hit.Y == int.Parse(row[2]) && hit.W == int.Parse(row[3]) && hit.H == int.Parse(row[4]), "doll " + row[0]);
        }

        foreach (var heading in new[] { "### T.motion", "### T.pet", "### T.qa", "### T.bag" })
        {
            foreach (var row in SpecRows(heading))
                Check(DesignTable.Tune(row[0]) == decimal.Parse(row[1], System.Globalization.CultureInfo.InvariantCulture), heading + " " + row[0]);
        }
        foreach (var row in SpecRows("### T.follow"))
        {
            var d = decimal.Parse(row[0], System.Globalization.CultureInfo.InvariantCulture);
            var want = decimal.Parse(row[1], System.Globalization.CultureInfo.InvariantCulture);
            Check(DesignTable.FollowSpeed(d) == want, "follow speed at " + row[0]);
        }
        Check(DesignTable.BagCapacity == Balance.InventorySize, "bag capacity matches the inventory");
        var grid = DesignTable.UiRect("inventory", "grid");
        var cell = DesignTable.UiRect("inventory", "gridCell");
        Check(DesignTable.BagColumns * cell.W + (DesignTable.BagColumns - 1) * DesignTable.BagGap == grid.W, "grid width");
        Check(DesignTable.BagRows * cell.H == 672 && grid.H - 672 == 28, "grid leaves 28 dp under the cells");
        Check(DesignTable.BagColumns * DesignTable.BagRows == DesignTable.BagCapacity, "one item per bag cell");

        string[] leftSlots = { "head", "shoulders", "chest", "wrists", "hands", "belt", "legs" };
        string[] rightSlots = { "amulet", "ring_l", "ring_r", "cloak", "feet", "mainhand", "offhand" };
        var leftCol = DesignTable.UiRect("inventory", "leftColumn");
        var rightCol = DesignTable.UiRect("inventory", "rightColumn");
        var hero = DesignTable.UiRect("inventory", "hero");
        var bag = DesignTable.UiRect("inventory", "bag");
        foreach (var id in leftSlots) Check(Contains(leftCol, DesignTable.DollRect(id)), id + " sits in the left column");
        foreach (var id in rightSlots) Check(Contains(rightCol, DesignTable.DollRect(id)), id + " sits in the right column");
        for (int i = 0; i < DesignTable.Doll.Length; i++)
            for (int j = i + 1; j < DesignTable.Doll.Length; j++)
                Check(!Overlaps(DesignTable.Doll[i], DesignTable.Doll[j]), "slots overlap " + DesignTable.Doll[i].Id + " " + DesignTable.Doll[j].Id);
        Check(!Overlaps(rightCol, bag) && !Overlaps(hero, bag), "bag clears the hero and the right column");
        Check(Overlaps(DesignTable.UiRect("inventory", "tooltip"), hero), "tooltip opens over the hero");
        Check(Contains(bag, grid) && Contains(bag, DesignTable.UiRect("inventory", "tabs")) && Contains(bag, DesignTable.UiRect("inventory", "bottom")), "grid, tabs, and the bottom bar sit in the bag");

        string asset = FeelAssetFile("FeelProfile.asset");
        Check(asset != null, "FeelProfile.asset is on disk");
        if (asset != null)
        {
            foreach (var heading in new[] { "### T.motion", "### T.pet", "### T.qa" })
            {
                foreach (var row in SpecRows(heading))
                    Check(YamlField(asset, row[0]) == row[1], "FeelProfile " + row[0] + " is " + YamlField(asset, row[0]));
            }
        }

        CombatSpec();
        Check(DesignTable.GlobeNormalChance == 0.08m && DesignTable.GlobeHealFraction == 0.25m, "globe rates");
        Check(DesignTable.EliteGlobeThresholds.Length == 3, "three elite globes");
        Check(DesignTable.PotionCooldownSeconds == 20m, "potion cooldown");
        string feet = FeelAssetFile("ClipFeet.asset");
        Check(feet != null, "ClipFeet.asset is on disk");
        if (feet != null)
        {
            int at = feet.IndexOf("model: hero_hexweaver", StringComparison.Ordinal);
            Check(at >= 0, "hexweaver foot speeds are listed");
            if (at >= 0)
            {
                string block = feet.Substring(at, Math.Min(180, feet.Length - at));
                Check(block.Contains("walk: 0.8") && block.Contains("run: 4.11"), "hero walk is about 0.8 m/s and run about 4.1");
            }
            Check(feet.Contains("model: mon_bogfiend") && feet.Contains("longPunch: 1"), "the long punch is marked for a trim");
            Check(feet.Contains("model: hero_stalker") && feet.Contains("model: pet_lynx") && feet.Contains("model: pet_hound"), "the rest of the rigs have foot speeds");
        }
        Check(DesignTable.BossPhase(1f) == 1 && DesignTable.BossPhase(0.66f) == 2 && DesignTable.BossPhase(0.33f) == 3, "guardian phases");
    }

    /// <summary>Gear must leave the v5 hero about 1.8 m tall in town, in the dungeon, and on the gear screen.
    /// 0.06 m is the collapsed body. 84.9 m is the old chest overlay.</summary>
    static void HeroFitLevel()
    {
        foreach (var mode in HeroFit.Modes)
        {
            Check(HeroFit.AfterGear(mode, HeroFit.Height), mode + " hero stays about 1.8 m after gear");
            Check(HeroFit.AfterGear(mode, 1.80f), mode + " accepts a 1.80 m body");
            Check(!HeroFit.AfterGear(mode, 0.06f), mode + " rejects a collapsed 0.06 m hero");
            Check(!HeroFit.HeightOk(0.06f), mode + " height 0.06 m is not about 1.8 m");
            Check(!HeroFit.SkinnedGear(true), mode + " v5 hero does not wear skinned gear");
        }
        Check(HeroFit.SkinnedGear(false), "pre-v5 rigs can still skin gear");
        Check(HeroFit.PreserveBoneScale, "hero bone scale is left alone");
        Check(!HeroFit.GearSizeOk(84.90f), "an 84.9 m chest is rejected");
        Check(HeroFit.GearSizeOk(0.34f), "a body-sized piece is accepted");
        Check(!HeroFit.AfterGear("town", 84.90f), "town rejects an 85 m hero");
        Check(!HeroFit.AfterGear("", 1.8f), "a gear check names its mode");
        foreach (var mode in HeroFit.Modes)
        {
            Check(HeroFit.IconCard(true, 684, false, null), mode + " rejects a sprite renderer on the hero");
            Check(HeroFit.IconCard(false, 4, true, null), mode + " rejects a white-backed quad");
            Check(HeroFit.IconCard(false, 726, false, "icon_pauldrons"), mode + " rejects the pauldron icon card");
            Check(!HeroFit.IconCard(false, 684, false, null), mode + " accepts a steel pauldron mesh");
            Check(!HeroFit.IconCard(false, 3500, false, "Image_0"), mode + " accepts a weapon albedo");
        }
    }

    static void GearFitLevel()
    {
        Check(GearFit.SlotForBone("mixamorig:Head") == EquipSlot.Head, "head bone maps to the helm slot");
        Check(GearFit.SlotForBone("LeftForeArm") == EquipSlot.Wrists, "forearm maps to the wrist slot");
        Check(GearFit.SlotForBone("RightToeBase") == EquipSlot.Feet, "toe maps to the boot slot");
        Check(GearFit.SlotForBone("Jaw") == null, "an unbound bone is not a slot");
        Check(!GearFit.IsVisible(EquipSlot.Amulet) && !GearFit.IsVisible(EquipSlot.Ring1), "rings and the amulet stay invisible");
        Check(GearFit.Visible.Length == 8, "eight armour slots are skinned");
        Check(GearFit.Adjacent.Length >= 7, "adjacent slots are all paired");
        Check(GearFit.WeightsOk(1f) && !GearFit.WeightsOk(0.2f), "bone weights have to sum to one");
        Check(GearFit.GapOk(GearFit.ShellOffset) && !GearFit.GapOk(0.001f) && !GearFit.GapOk(0.2f), "the shell sits off the skin without floating");
        Check(GearFit.StretchOk(1f) && !GearFit.StretchOk(8f), "a vertex that flies off its bone is a stretch");
        Check(GearFit.Covered(0.02f) && !GearFit.Covered(0.2f), "a hidden body vertex must sit under its piece");
        Check(GearFit.VisibleClear(0.02f) && !GearFit.VisibleClear(0.001f), "visible skin must stay clear of the shell");
        var names = new[] { "hero|idle", "Run", "attack_01", "death" };
        Check(GearFit.HasRequiredPose(names, GearFit.RequiredPoses[0]), "idle is a required pose");
        Check(GearFit.HasRequiredPose(names, GearFit.RequiredPoses[1]), "run or walk is a required pose");
        Check(GearFit.HasRequiredPose(names, GearFit.RequiredPoses[2]), "attack is a required pose");
        Check(GearFit.HasRequiredPose(new[] { "ic_attack_cleave" }, GearFit.RequiredPoses[2]), "ic_attack_cleave is an attack pose");
        Check(GearFit.RequiredPoses.Length == 5, "idle, run, attack, hit and death are required poses");
        Check(GearFit.HasRequiredPose(new[] { "hit" }, GearFit.RequiredPoses[3]), "hit is a required pose");
        Check(GearFit.HasRequiredPose(new[] { "death" }, GearFit.RequiredPoses[4]), "death is a required pose");
        Check(GearFit.HasRequiredPose(new[] { "st_roll_fire" }, GearFit.OptionalPoses[0]), "st_roll_fire is a dodge pose");
        Check(GearFit.HasRequiredPose(new[] { "ic_cast_warcry" }, GearFit.OptionalPoses[1]), "ic_cast_warcry is a spell pose");
        Check(GearFit.HasRequiredPose(new[] { "fish_idle" }, GearFit.OptionalPoses[2]), "fish_idle is a fishing pose");
        Check(GearFit.GapOk(0.0026f), "a dense helm shell 2.6 mm off the skin still fits");
        Check(GearFit.ShellsOverlap(0.002f, 0.012f, 0.013f), "shells 2 mm apart over the same skin z-fight");
        Check(!GearFit.ShellsOverlap(0.02f, 0.012f, 0.03f), "shells 2 cm apart are a seam, not an overlap");
        Check(GearFit.DeathFlat(0.04f, 0.06f, 0.42f), "a body lying on the floor passes the death-flat check");
        Check(!GearFit.DeathFlat(0.72f, 0.02f, 0.84f), "a hunched kneel fails the death-flat check");
        Check(!GearFit.DeathFlat(0.04f, 0.6f, 0.42f), "a flat body floating off the floor fails");
        var mix = GearFit.Mix(7, 4);
        var again = GearFit.Mix(7, 4);
        Check(mix.Length == 4 && mix[0] == again[0] && mix[3] == again[3], "a set mix is deterministic");
        Check(GearFit.PoseMatch("hero|fish_idle|0", "fish"), "fishing clips count as a pose");
        Check(GearFit.RegionForBone("mixamorig:HeadFront") == (int)GearFit.BodyRegion.Head, "the face is part of the head region");
        Check(GearFit.RegionForBone("mixamorig:Neck") == (int)GearFit.BodyRegion.UpperTorso, "the neck is part of the upper torso");
        Check(GearFit.RegionForBone("LeftForeArm") == (int)GearFit.BodyRegion.LowerArm, "the forearm is its own region");
        Check(GearFit.Hides(EquipSlot.Chest, (int)GearFit.BodyRegion.UpperTorso), "the chest piece hides the upper torso");
        Check(!GearFit.Hides(EquipSlot.Shoulders, (int)GearFit.BodyRegion.UpperTorso), "pauldrons do not take the torso");
        var worn = new bool[(int)EquipSlot.Count];
        worn[(int)EquipSlot.Chest] = true;
        worn[(int)EquipSlot.Shoulders] = true;
        Check(GearFit.RegionOwner(worn, (int)GearFit.BodyRegion.UpperTorso) == EquipSlot.Chest, "chest beats shoulders for the upper torso");
        Check(GearFit.RegionOwner(worn, (int)GearFit.BodyRegion.UpperArm) == EquipSlot.Shoulders, "shoulders own the upper arm");
        Check(GearFit.HidePriority[0] == EquipSlot.Chest, "chest is first in the hide priority");
    }

    /// <summary>Each CC0 prop keeps a real base, normal, and roughness image, and the mesh
    /// stays within 20 percent of the manifest. A corrupt resize used to leave red-black blocks.</summary>
    static void Cc0PropFiles()
    {
        Check(Cc0Kit.SizeOk(2.965f, 3.5f), "a door within 20 percent of the manifest passes");
        Check(!Cc0Kit.SizeOk(2.965f, 4f), "a door more than 20 percent over the manifest fails");
        int keys = 0;
        foreach (var key in Cc0Kit.Keys)
        {
            keys++;
            string path = Cc0Glb(key);
            Check(path != null, key + " glb is on disk");
            if (path == null) continue;
            bool maps = Cc0Maps(path, out float meshMax, out string why);
            Check(maps, key + " base, normal, and roughness load" + (why == null ? "" : " (" + why + ")"));
            bool sized = Cc0Kit.TryMax(key, out float manifest) && meshMax >= manifest * 0.8f && Cc0Kit.SizeOk(manifest, meshMax);
            Check(sized, key + " mesh " + meshMax.ToString("0.00") + "m stays within 20 percent of " + manifest.ToString("0.00") + "m");
        }
        Check(keys == 22, "every CC0 prop is listed");
    }

    static string Cc0Glb(string key)
    {
        foreach (var c in new[]
        {
            Path.Combine("Assets", "Resources", "Models", key + ".glb"),
            Path.Combine("hollowmere", "Assets", "Resources", "Models", key + ".glb"),
        })
            if (File.Exists(c)) return c;
        return null;
    }

    static bool Cc0Maps(string path, out float meshMax, out string why)
    {
        meshMax = 0f;
        why = null;
        var data = File.ReadAllBytes(path);
        if (data.Length < 20 || data[0] != 'g') { why = "not a glb"; return false; }
        int jlen = BitConverter.ToInt32(data, 12);
        var js = JsonDocument.Parse(Encoding.UTF8.GetString(data, 20, jlen));
        int bin = 20 + jlen;
        if (bin + 8 > data.Length) { why = "no binary chunk"; return false; }
        var root = js.RootElement;
        var views = root.GetProperty("bufferViews");
        var images = root.GetProperty("images");
        var textures = root.GetProperty("textures");
        bool any = false;
        foreach (var mat in root.GetProperty("materials").EnumerateArray())
        {
            any = true;
            var pbr = mat.GetProperty("pbrMetallicRoughness");
            if (!MapImage(data, bin, views, images, textures, pbr, "baseColorTexture", out why)) return false;
            if (!MapImage(data, bin, views, images, textures, mat, "normalTexture", out why)) return false;
            if (!MapImage(data, bin, views, images, textures, pbr, "metallicRoughnessTexture", out why)) return false;
        }
        if (!any) { why = "no material"; return false; }
        foreach (var mesh in root.GetProperty("meshes").EnumerateArray())
        {
            foreach (var prim in mesh.GetProperty("primitives").EnumerateArray())
            {
                int acc = prim.GetProperty("attributes").GetProperty("POSITION").GetInt32();
                var a = root.GetProperty("accessors")[acc];
                var mn = a.GetProperty("min");
                var mx = a.GetProperty("max");
                for (int i = 0; i < 3; i++)
                {
                    float span = mx[i].GetSingle() - mn[i].GetSingle();
                    if (span > meshMax) meshMax = span;
                }
            }
        }
        if (meshMax <= 0f) { why = "no mesh"; return false; }
        return true;
    }

    static bool MapImage(byte[] data, int bin, JsonElement views, JsonElement images, JsonElement textures, JsonElement owner, string prop, out string why)
    {
        why = null;
        if (!owner.TryGetProperty(prop, out var slot)) { why = "missing " + prop; return false; }
        int tex = slot.GetProperty("index").GetInt32();
        int src = textures[tex].GetProperty("source").GetInt32();
        int view = images[src].GetProperty("bufferView").GetInt32();
        var v = views[view];
        int off = v.TryGetProperty("byteOffset", out var o) ? o.GetInt32() : 0;
        int len = v.GetProperty("byteLength").GetInt32();
        int start = bin + 8 + off;
        if (start < 0 || len < 16 || start + len > data.Length) { why = prop + " is outside the file"; return false; }
        if (!ImageHeader(data, start, len, out int w, out int h)) { why = prop + " is not a readable image"; return false; }
        if (w > 512 || h > 512) { why = prop + " is " + w + "x" + h; return false; }
        return true;
    }

    static bool ImageHeader(byte[] data, int start, int len, out int w, out int h)
    {
        w = h = 0;
        if (len >= 24 && data[start] == 0x89 && data[start + 1] == 0x50)
        {
            w = (data[start + 16] << 24) | (data[start + 17] << 16) | (data[start + 18] << 8) | data[start + 19];
            h = (data[start + 20] << 24) | (data[start + 21] << 16) | (data[start + 22] << 8) | data[start + 23];
            return w > 0 && h > 0;
        }
        if (data[start] != 0xFF || data[start + 1] != 0xD8) return false;
        int i = start + 2;
        int end = start + len;
        while (i + 8 < end)
        {
            if (data[i] != 0xFF) { i++; continue; }
            byte marker = data[i + 1];
            if (marker == 0xD8 || marker == 0x01 || (marker >= 0xD0 && marker <= 0xD7)) { i += 2; continue; }
            if (marker == 0xD9) return false;
            int seg = (data[i + 2] << 8) | data[i + 3];
            if (seg < 2 || i + 2 + seg > end) return false;
            if (marker == 0xC0 || marker == 0xC1 || marker == 0xC2)
            {
                h = (data[i + 5] << 8) | data[i + 6];
                w = (data[i + 7] << 8) | data[i + 8];
                return w > 0 && h > 0;
            }
            i += 2 + seg;
        }
        return false;
    }

    /// <summary>Modular kit meshes do not embed the shared textures. Those live once under PbrKit.</summary>
    static void ModularKitFiles()
    {
        string wall = null;
        foreach (var c in new[]
        {
            Path.Combine("Assets", "Resources", "Models", "kit_town_wall_4m.glb"),
            Path.Combine("hollowmere", "Assets", "Resources", "Models", "kit_town_wall_4m.glb"),
        })
            if (File.Exists(c)) wall = c;
        Check(wall != null, "modular town wall is on disk");
        if (wall != null)
        {
            var data = File.ReadAllBytes(wall);
            int jlen = BitConverter.ToInt32(data, 12);
            var js = JsonDocument.Parse(Encoding.UTF8.GetString(data, 20, jlen));
            int images = js.RootElement.TryGetProperty("images", out var im) ? im.GetArrayLength() : 0;
            Check(images == 0, "modular wall does not embed textures");
            Check(data.Length < 200000, "modular wall stays a small mesh");
        }
        string lava = null;
        foreach (var c in new[]
        {
            Path.Combine("Assets", "Resources", "PbrKit", "materials", "lava", "lava_basecolor.jpg"),
            Path.Combine("hollowmere", "Assets", "Resources", "PbrKit", "materials", "lava", "lava_basecolor.jpg"),
        })
            if (File.Exists(c)) lava = c;
        Check(lava != null, "shared lava base map is on disk");
        if (lava != null)
            Check(new FileInfo(lava).Length < 800000, "lava base map was resized under the shared set");
    }

    /// <summary>The character glbs carry a base-color image. AdoptShaders copies that onto
    /// Hollowmere/Color; a model with no embedded texture cannot show anything but flat white.</summary>
    static void PostVolumeLevel()
    {
        var town = Town.BuildTownMap(out _);
        var townVolume = PostVolume.For(town);
        var bloom = townVolume.Get<PostBloom>();
        var tone = townVolume.Get<PostTonemapping>();
        var color = townVolume.Get<PostColorAdjustments>();
        var ao = townVolume.Get<PostOcclusion>();
        Check(bloom != null && bloom.threshold == 1.1f && bloom.intensity == 0.35f && bloom.scatter == 0.55f, "town level volume has bloom");
        Check(tone != null && tone.mode == PostTonemap.Aces, "town level volume tonemaps with ACES");
        Check(color != null && color.postExposure == 0.12f && color.contrast == 8f && color.saturation == 6f, "town level volume has the color grade");
        Check(ao != null && ao.intensity == 0.45f && ao.radius == 0.25f, "town level volume has ambient occlusion");

        var floor = DungeonGenerator.Generate(3, 17);
        var dungeonVolume = PostVolume.For(floor);
        Check(dungeonVolume.components.Count == 4 && dungeonVolume.Get<PostBloom>() != null, "dungeon level builds a post-processing volume");
        Check(PostVolume.For(null).components.Count == 0, "a volume is not built without a level");

        var add = typeof(PostVolume).GetMethod("Add");
        bool rejected = false;
        try { add.MakeGenericMethod(typeof(string)); }
        catch (ArgumentException) { rejected = true; }
        Check(add != null && add.IsGenericMethodDefinition && rejected, "adding a non-component to the volume is rejected");

        string src = null;
        foreach (var path in new[]
        {
            Path.Combine("Assets", "Scripts", "Game", "PbrKit.cs"),
            Path.Combine("hollowmere", "Assets", "Scripts", "Game", "PbrKit.cs"),
        })
            if (File.Exists(path)) src = File.ReadAllText(path);
        Check(src != null && src.IndexOf("MakeGenericMethod", StringComparison.Ordinal) < 0, "player volume setup does not use MakeGenericMethod");
        Check(src != null && src.Contains("Add<Bloom>()") && src.Contains("Add<ColorAdjustments>()") && src.Contains("Add<Tonemapping>()"), "player adds Bloom, ColorAdjustments, and Tonemapping directly");
    }

    static void ModelAlbedo()
    {
        string path = null;
        foreach (var c in new[]
        {
            "Assets/Resources/Models/npc_smith.glb",
            "hollowmere/Assets/Resources/Models/npc_smith.glb",
            Path.Combine("..", "..", "Assets", "Resources", "Models", "npc_smith.glb"),
        })
            if (File.Exists(c)) { path = c; break; }
        Check(path != null, "npc_smith.glb is on disk to load");
        if (path == null) return;
        var json = GlbJson(path);
        int tex = json.IndexOf("baseColorTexture", StringComparison.Ordinal);
        Check(tex >= 0, "npc_smith material references baseColorTexture");
        int images = json.IndexOf("\"images\"", StringComparison.Ordinal);
        Check(images >= 0 && json.IndexOf("\"bufferView\"", images, StringComparison.Ordinal) >= 0, "npc_smith.glb embeds an image");
    }

    static string GlbJson(string path)
    {
        var data = File.ReadAllBytes(path);
        if (data.Length < 20) return "";
        int len = BitConverter.ToInt32(data, 12);
        return Encoding.UTF8.GetString(data, 20, len);
    }
}
