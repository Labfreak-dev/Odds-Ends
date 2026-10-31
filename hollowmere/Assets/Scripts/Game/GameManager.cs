using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Hollowmere.Core;
using UnityEngine;

namespace Hollowmere
{
    /// <summary>Owns the save, builds the town and dungeon floors, and routes every game event
    /// (kills, loot, death, portals, fishing, the companion) between the core and the scene.</summary>
    public sealed class GameManager : MonoBehaviour
    {
        public static GameManager I;
        public GameState State;
        public bool InTown => State != null && State.depth == 0;
        public bool Paused => State == null || UiRoot.I.AnyModal || (HeroActor.I != null && HeroActor.I.Dead);

        readonly Rng rng = new Rng();
        CameraRig cam;
        float autosave;
        MonsterActor boss;
        Interactable stairsDown;

        static string SavePath => Path.Combine(Application.persistentDataPath, "hollowmere.json");
        public static bool HasSave => File.Exists(SavePath);

        void Awake()
        {
            I = this;
            gameObject.AddComponent<AudioHub>();
            cam = CameraRig.Create();
            DontDestroyOnLoad(cam.gameObject);
            var ui = new GameObject("UI").AddComponent<UiRoot>();
            DontDestroyOnLoad(ui.gameObject);
        }

        void Start()
        {
            if (!QaShot.RunIfRequested(this) && !QaFrames.RunIfRequested(this)) UiRoot.I.ShowTitle();
        }

        // ====================== save / load ======================

        public void NewGame(HeroClass cls, string heroName, PetSpecies pet, string petName)
        {
            State = GameState.NewGame(cls, heroName, pet, petName, (ulong)DateTime.UtcNow.Ticks);
            Save();
            EnterTown(false);
        }

        public bool Continue()
        {
            try
            {
                var json = File.ReadAllText(SavePath);
                State = JsonUtility.FromJson<GameState>(json);
                State.Normalize();
            }
            catch (Exception e)
            {
                Debug.LogWarning("Save could not be read: " + e.Message);
                return false;
            }
            EnterTown(false);
            return true;
        }

        public void Save()
        {
            if (State == null) return;
            try { File.WriteAllText(SavePath, JsonUtility.ToJson(State)); }
            catch (Exception e) { Debug.LogWarning("Save failed: " + e.Message); }
        }

        void OnApplicationPause(bool paused) { if (paused) Save(); }
        void OnApplicationQuit() => Save();

        // ====================== world building ======================

        void ClearWorld()
        {
            UiRoot.I.CloseFishing();
            FloorNav.Clear();
            Pickup.ClearAll();
            foreach (var a in Actor.All.ToList()) if (a != null) Destroy(a.gameObject);
            Actor.All.Clear();
            Interactable.All.Clear();
            if (World.Root != null) Destroy(World.Root.gameObject);
            boss = null;
            stairsDown = null;
            UiRoot.I.Hud.SetBoss(null);
        }

        public void EnterTown(bool viaPortal)
        {
            ClearWorld();
            State.depth = 0;
            var map = Town.BuildTownMap(out var marks);
            World.Map = map;
            World.Root = LevelBuilder.Build(map);
            var root = World.Root;
            void Svc(char c, InteractKind k, string label) => Interactable.Create(k, World.ToWorld(marks[c]), root, label).transform.rotation = Quaternion.Euler(0, 180, 0);
            Svc('M', InteractKind.Merchant, "Merchant");
            Svc('B', InteractKind.Blacksmith, "Blacksmith");
            Svc('Y', InteractKind.Mystic, "Mystic");
            Svc('G', InteractKind.Gambler, "Curio Dealer");
            Svc('J', InteractKind.Jeweler, "Jeweler");
            Svc('S', InteractKind.Stash, "Stash");
            Svc('Q', InteractKind.QuestBoard, "Quest Board");
            Svc('F', InteractKind.Fisherman, "Old Angler");
            Interactable.Create(InteractKind.DungeonEntrance, World.ToWorld(marks['D']), root, "The Hollow");
            var fishSpot = Interactable.Create(InteractKind.Fishing, World.ToWorld(map.pools[0].center), root);
            fishSpot.pool = map.pools[0];
            fishSpot.range = 3.2f;
            // Scenery
            // North of the hero, off the camera-to-hero line. The old south-east tile sat in the
            // foreground and a blown-up well mesh covered the top-right of the town shot.
            var well = PbrKit.Prop("town_well", root) ?? Art.Model("prop_well", 1.5f, root);
            if (well != null) well.transform.SetPositionAndRotation(World.ToWorld(new Int2(24, 10)), Quaternion.identity);
            var stall = PbrKit.Prop("market_stall", root);
            if (stall != null) stall.transform.SetPositionAndRotation(World.ToWorld(marks['M']) + new Vector3(2.2f, 0f, -1.4f), Quaternion.Euler(0f, 20f, 0f));
            Art.PlaceQuad(root, "woodDeck", World.ToWorld(marks['F']) + new Vector3(-1.4f, 0.03f, 0.2f), Quaternion.identity, 3.4f, 2.4f, PbrKit.Surface("wood_planks", 2f, Color.white), true);
            // A little dock out into the lake beside the Old Angler.
            var dock = Art.Model("prop_dock", 0.5f, root);
            if (dock != null) dock.transform.SetPositionAndRotation(World.ToWorld(marks['F']) + new Vector3(-World.T, -0.2f, 0), Quaternion.Euler(0, 90, 0));
            // Small canopies on the north wall, off the NPC tiles. The old row of 2 m green
            // spheres sat on the mystic and the dealer and read as a figure lying at the top.
            int[] treeX = { 6, 12, 18, 27 };
            for (int i = 0; i < treeX.Length; i++)
            {
                var tp = World.ToWorld(new Int2(treeX[i], 13)) + new Vector3(0, 0, 0.4f);
                Art.Cylinder(root, tp + Vector3.up * 0.7f, new Vector3(0.28f, 0.7f, 0.28f), Art.Mat(new Color(0.4f, 0.28f, 0.16f)));
                Art.Sphere(root, tp + Vector3.up * 1.7f, new Vector3(1.15f, 0.9f, 1.15f), Art.Mat(new Color(0.25f, 0.45f, 0.2f)));
            }
            var blocked = new System.Collections.Generic.List<Int2>();
            foreach (var kv in marks) blocked.Add(kv.Value);
            blocked.Add(new Int2(24, 10));
            Dressing.Scatter(map, root, blocked, (int)State.seed);

            Vector3 spawn = World.ToWorld(map.entry);
            if (viaPortal && State.portalDepth > 0) spawn = World.ToWorld(marks['D']) + new Vector3(-3, 0, 0);
            if (State.portalDepth > 0)
                Interactable.Create(InteractKind.TownPortal, World.ToWorld(marks['D']) + new Vector3(-3, 0, 2), root, $"Portal to Floor {State.portalDepth}");
            SpawnHeroAndPet(spawn);
            Town.RefreshQuests(State, rng);
            AudioHub.Music("mus_town");
            UiRoot.I.Hud.SetLocation("Hollowmere");
            Save();
        }

        public void EnterFloor(int depth, bool fromPortal = false, bool fromBelow = false)
        {
            ClearWorld();
            State.OnReachDepth(depth);
            var map = DungeonGenerator.Generate(depth, (ulong)State.seed);
            World.Map = map;
            World.Root = LevelBuilder.Build(map);
            var root = World.Root;
            int mlvl = Balance.MonsterLevel(depth, State.hero.level);

            // Monsters, with any bounty quest's named elite taking over an elite pack leader.
            var bounty = State.EliteQuestOn(depth);
            var packAffixes = new Dictionary<int, List<EliteAffix>>();
            foreach (var s in map.spawns)
            {
                var def = MonsterDb.Get(s.monsterId);
                var ms = MonsterDb.Create(def, mlvl, s.rank, rng, depth);
                if (s.rank == MonsterRank.Elite) packAffixes[s.pack] = ms.affixes;
                else if (s.rank == MonsterRank.Minion && packAffixes.TryGetValue(s.pack, out var aff)) ms.affixes.AddRange(aff.Where(a => a != EliteAffix.Extra));
                if (bounty != null && s.rank == MonsterRank.Elite) { ms.displayName = bounty.eliteName; bounty = null; }
                MonsterActor.Spawn(ms, World.ToWorld(s.pos), s.pack);
            }
            if (bounty != null)
            {
                // No elite pack rolled: the bounty gets its own.
                var room = map.rooms.OrderByDescending(r => r.Center.Chebyshev(map.entry)).First();
                var ms = MonsterDb.Create(MonsterDb.ForDepth(depth)[0], mlvl, MonsterRank.Elite, rng, depth);
                ms.displayName = bounty.eliteName;
                MonsterActor.Spawn(ms, World.ToWorld(room.Center), 9999);
            }

            stairsDown = Interactable.Create(InteractKind.StairsDown, World.ToWorld(map.exit), root, $"Floor {depth + 1}");
            // No floating town name over the spawn. The Ascend prompt is the interact button.
            Interactable.Create(InteractKind.StairsUp, World.ToWorld(map.entry) + new Vector3(0, 0, -World.T), root);
            foreach (var c in map.chests) Interactable.Create(InteractKind.Chest, World.ToWorld(c), root);
            foreach (var s in map.shrines) Interactable.Create(InteractKind.Shrine, World.ToWorld(s), root);
            foreach (var p in map.pools)
            {
                var fi = Interactable.Create(InteractKind.Fishing, World.ToWorld(p.center), root);
                fi.pool = p;
                fi.range = 3.2f;
            }

            Vector3 spawn = World.ToWorld(map.entry);
            if (fromBelow) spawn = World.ToWorld(map.exit) + new Vector3(World.T, 0, 0);
            if (fromPortal && State.portalDepth == depth)
            {
                spawn = World.ClampToFloor(World.ToWorld(new Int2(State.portalX, State.portalY)));
                State.portalDepth = 0;
            }
            SpawnHeroAndPet(World.ClampToFloor(spawn));
            var floorBlocked = new System.Collections.Generic.List<Int2> { map.entry, map.exit };
            floorBlocked.AddRange(map.chests);
            floorBlocked.AddRange(map.shrines);
            foreach (var s in map.spawns) floorBlocked.Add(s.pos);
            Dressing.Scatter(map, root, floorBlocked, (int)State.seed ^ (depth * 997));
            AudioHub.Music(map.bossFloor ? "mus_boss" : "mus_dungeon");
            AudioHub.Play("sfx_stairs", 0.6f);
            string where = map.theme switch { Theme.Crypt => "Crypts", Theme.Caverns => "Caverns", Theme.SunkenHalls => "Sunken Halls", _ => "Ember Depths" };
            UiRoot.I.Hud.SetLocation($"Floor {depth} · {where}");
            Toast(map.bossFloor ? $"Floor {depth}: something large stirs below…" : $"Floor {depth}");
            Save();
        }

        void SpawnHeroAndPet(Vector3 at)
        {
            var hero = HeroActor.Spawn(at);
            // Beside the hero, toward the camera, so the companion is in frame instead of a speck behind it.
            PetActor.Spawn(at + new Vector3(1.35f, 0, -0.85f));
            cam.follow = hero.transform;
            cam.Snap();
            UiRoot.I.Hud.Bind(hero);
        }

        // ====================== per-frame ======================

        void Update()
        {
            if (State == null) return;
            float dt = Time.deltaTime;
            if (!Paused)
            {
                State.TickBuffs(dt);
                long gold = State.pet.Tick(dt);
                if (gold > 0)
                {
                    State.hero.gold += gold;
                    State.counters.goldEarned += gold;
                    Toast($"{State.pet.name} is back with {gold} gold!");
                    Sfx.Pet("happy");
                }
            }
            if ((autosave += Time.unscaledDeltaTime) > 30f) { autosave = 0; Save(); }
        }

        // ====================== events ======================

        public void Toast(string msg) => UiRoot.I.Toast(msg);

        public void OnMonsterKilled(MonsterActor m)
        {
            var hero = HeroActor.I;
            var s = m.stats;
            var open = State.quests.Where(q => q.accepted && !q.complete).ToList();
            State.OnKill(s, State.depth);
            foreach (var q in open) if (q.complete) Toast($"Quest complete: {q.title}. Claim it at the board.");
            int levels = State.hero.GainXp(s.xp);
            if (levels > 0) OnLevelUp(levels);
            if (hero != null)
            {
                hero.Heal(hero.stats[Stat.LifePerKill]);
                float nova = hero.Hero.LegendaryTotal(LegendaryEffect.NovaOnKill);
                if (nova > 0 && rng.Chance(nova / 100f))
                {
                    var cast = new SkillCast { skill = SkillDb.Get("hx_frostring"), element = Element.Frost, weaponDamage = 4f, slow = 0.5f };
                    foreach (var a in Actor.InRadius(Team.Hero, m.Pos, 5f)) SkillRunner.HitEnemy(hero, cast, a);
                    Fx.Ring(m.Pos, 5f, Art.Element(Element.Frost));
                }
            }

            var src = s.rank switch
            {
                MonsterRank.Boss => LootSource.Boss, MonsterRank.Elite => LootSource.Elite,
                MonsterRank.Champion => LootSource.Champion, _ => LootSource.Normal,
            };
            var drop = Loot.Roll(rng, src, s.level, hero != null ? hero.stats : State.Stats(), State.hero.heroClass, State.depth);
            float ring = s.rank == MonsterRank.Boss ? 1.5f : 0f;
            for (int i = 0; i < drop.items.Count; i++)
            {
                float ang = drop.items.Count <= 1 ? 0f : i * Mathf.PI * 2f / drop.items.Count;
                var at = m.Pos + new Vector3(Mathf.Cos(ang) * ring, 0f, Mathf.Sin(ang) * ring);
                Pickup.DropItem(drop.items[i], at);
            }
            Pickup.DropGold(drop.gold, m.Pos);
            if (drop.potions > 0) Pickup.DropItem(Loot.Potion(drop.potions), m.Pos);
            if (s.rank == MonsterRank.Normal && rng.Chance((float)DesignTable.GlobeNormalChance))
                Pickup.DropGlobe(m.Pos);

            if (s.rank == MonsterRank.Elite) Toast($"{s.displayName} slain!");
            if (s.rank == MonsterRank.Boss)
            {
                Toast($"{s.displayName} is defeated! The way down is open.");
                UiRoot.I.Hud.SetBoss(null);
                AudioHub.Music("mus_dungeon");
                boss = null;
            }
        }

        void OnLevelUp(int levels)
        {
            var hero = HeroActor.I;
            int lvl = State.hero.level;
            var names = new System.Collections.Generic.List<string>();
            foreach (var sk in SkillDb.ForClass(State.hero.heroClass))
            {
                if (sk.reqLevel == lvl) names.Add(sk.name);
                if (sk.runes == null) continue;
                foreach (var r in sk.runes)
                    if (r.unlockLevel == lvl) names.Add(r.name);
            }
            string extra = names.Count > 0 ? " — " + string.Join(", ", names) : "";
            Toast($"Level {lvl}{extra}");
            AudioHub.Play("sfx_levelup");
            if (hero != null)
            {
                hero.RefreshStats(true);
                var pillar = new GameObject("levelPillar");
                pillar.transform.position = hero.Pos + Vector3.up * 1.2f;
                var light = pillar.AddComponent<Light>();
                light.type = LightType.Point;
                light.color = Art.Hex("#e8c77a");
                light.range = 8f;
                light.intensity = 6f;
                pillar.AddComponent<LightFade>().Init((float)DesignTable.LevelUpSeconds, 6f);
                Fx.Ring(hero.Pos, 4f, new Color(1f, 0.9f, 0.4f), (float)DesignTable.LevelUpSeconds);
                PetActor.I?.RefreshLife(true);
            }
        }

        public void OnBossAggro(MonsterActor m)
        {
            boss = m;
            UiRoot.I.Hud.SetBoss(m);
        }

        public void OnPickedUp(Item it)
        {
            if (it.kind == ItemKind.Equipment && it.rarity >= Rarity.Legendary)
            {
                State.counters.legendaries++;
                Toast($"<color={ItemText.RarityColor(it.rarity)}>{it.name}</color>");
            }
            else if (it.kind != ItemKind.Equipment) Toast($"+{it.stack} {it.name}");
        }

        public void OnHeroDied()
        {
            State.counters.deaths++;
            UiRoot.I.ShowDeath();
        }

        /// <summary>Fate's choice on death: walk back from town for free, or pay to get up where you fell.</summary>
        public long ReviveCost => Math.Max(50, State.hero.gold / 10);

        public void Revive(bool inPlace)
        {
            if (inPlace && !InTown && State.hero.gold >= ReviveCost)
            {
                State.hero.gold -= ReviveCost;
                HeroActor.I.Revive(1f);
                foreach (var a in Actor.InRadius(Team.Hero, HeroActor.I.Pos, 6f)) a.Knockback(a.Pos - HeroActor.I.Pos, 4f);
                Fx.Ring(HeroActor.I.Pos, 6f, Color.white, 0.6f);
                return;
            }
            EnterTown(false);
        }

        // ====================== interactions ======================

        public void Interact(Interactable it)
        {
            if (it == null || Paused) return;
            var hero = HeroActor.I;
            switch (it.kind)
            {
                case InteractKind.StairsDown:
                    if (World.Map.bossFloor && Actor.All.Any(a => a is MonsterActor m && m.stats.rank == MonsterRank.Boss && !m.Dead))
                    { Toast("The guardian of this floor bars the way."); return; }
                    EnterFloor(State.depth + 1);
                    break;
                case InteractKind.StairsUp:
                    if (State.depth <= 1) EnterTown(false);
                    else EnterFloor(State.depth - 1, fromBelow: true);
                    break;
                case InteractKind.TownPortal:
                    if (InTown) EnterFloor(State.portalDepth, fromPortal: true);
                    break;
                case InteractKind.DungeonEntrance:
                    UiRoot.I.ShowWaypoints();
                    break;
                case InteractKind.Chest:
                {
                    it.used = true;
                    int mlvl = Balance.MonsterLevel(State.depth, State.hero.level);
                    var drop = Loot.Roll(rng, LootSource.Chest, mlvl, hero.stats, State.hero.heroClass, State.depth);
                    foreach (var x in drop.items) Pickup.DropItem(x, it.transform.position);
                    Pickup.DropGold(drop.gold, it.transform.position);
                    if (drop.potions > 0) Pickup.DropItem(Loot.Potion(1), it.transform.position);
                    it.transform.localScale = new Vector3(1, 0.5f, 1);
                    AudioHub.Play("sfx_gold");
                    break;
                }
                case InteractKind.Shrine:
                {
                    it.used = true;
                    var options = new[] { (Stat.DamagePercent, 25f, "Shrine of Fury: +25% damage"), (Stat.MoveSpeed, 25f, "Shrine of Haste: +25% movement"),
                        (Stat.MagicFind, 100f, "Shrine of Fortune: +100% magic find"), (Stat.DamageReduction, 25f, "Shrine of Stone: -25% damage taken") };
                    var o = options[rng.Range(0, options.Length)];
                    State.AddBuff(o.Item1, o.Item2, 120f, "shrine");
                    hero.RefreshStats();
                    Toast(o.Item3 + " (2 min)");
                    Fx.Ring(it.transform.position, 4f, new Color(0.3f, 0.7f, 1f), 0.8f);
                    foreach (var l in it.GetComponentsInChildren<Light>()) l.enabled = false;
                    break;
                }
                case InteractKind.Fishing:
                case InteractKind.Fisherman:
                {
                    var spot = it.kind == InteractKind.Fishing ? it : Interactable.All.FirstOrDefault(x => x.kind == InteractKind.Fishing);
                    if (spot?.pool == null) return;
                    StartFishing(spot);
                    break;
                }
                case InteractKind.Merchant: UiRoot.I.OpenTown(TownTab.Merchant); break;
                case InteractKind.Blacksmith: UiRoot.I.OpenTown(TownTab.Blacksmith); break;
                case InteractKind.Mystic: UiRoot.I.OpenTown(TownTab.Mystic); break;
                case InteractKind.Gambler: UiRoot.I.OpenTown(TownTab.Gambler); break;
                case InteractKind.Jeweler: UiRoot.I.OpenJeweler(); break;
                case InteractKind.Stash: UiRoot.I.OpenTown(TownTab.Stash); break;
                case InteractKind.QuestBoard: UiRoot.I.OpenTown(TownTab.Quests); break;
            }
        }

        public void UseTownPortal()
        {
            if (InTown || Paused) return;
            if (!State.hero.Consume(ItemKind.TownPortal)) { Toast("No Town Portal scrolls. Buy them from the merchant."); return; }
            var t = World.ToTile(HeroActor.I.Pos);
            State.portalDepth = State.depth;
            State.portalX = t.x; State.portalY = t.y;
            AudioHub.Play("sfx_portal");
            EnterTown(true);
        }

        public List<int> Waypoints()
        {
            var list = new List<int> { 1 };
            foreach (var f in State.clearedBossFloors.OrderBy(x => x)) if (!list.Contains(f + 1)) list.Add(f + 1);
            return list;
        }

        // ====================== fishing ======================

        void StartFishing(Interactable spot)
        {
            var hero = HeroActor.I;
            var pool = spot.pool;
            if (pool.charges <= 0) { Toast("The fish here have gone quiet."); return; }
            hero.Teleport(World.ToWorld(pool.standAt));
            hero.Face(World.ToWorld(pool.center) - hero.Pos);
            hero.busy = true;
            float window = State.hero.LegendaryTotal(LegendaryEffect.FishingBiteWindow);
            var session = new FishingSession(rng, InTown, Math.Max(1, State.depth), hero.stats[Stat.FishingLuck], window,
                Balance.MonsterLevel(Math.Max(1, State.depth), State.hero.level), State.hero.heroClass);
            UiRoot.I.OpenFishing(session, World.ToWorld(pool.center), () => FinishFishing(session, spot));
        }

        void FinishFishing(FishingSession s, Interactable spot)
        {
            var hero = HeroActor.I;
            if (hero != null) hero.busy = false;
            if (s.phase == FishingPhase.Ready) return; // closed without casting
            if (spot.pool.charges != int.MaxValue) spot.pool.charges--;
            if (spot.pool.charges <= 0)
            {
                spot.used = true;
                foreach (Transform c in spot.transform) c.gameObject.SetActive(false);
            }
            if (s.phase != FishingPhase.Caught) { Save(); return; }
            var r = s.result;
            switch (r.kind)
            {
                case CatchKind.Fish:
                    State.OnFish(r.fish);
                    if (!State.hero.AddItem(Loot.Fish(r.fish.id))) { Toast("No room for the fish!"); Sfx.Bag("error_bag_full"); }
                    break;
                case CatchKind.Gold:
                    State.hero.gold += r.gold;
                    State.counters.goldEarned += r.gold;
                    break;
                default:
                    if (!State.hero.AddItem(r.item)) Pickup.DropItem(r.item, hero.Pos);
                    if (r.item.rarity >= Rarity.Legendary) State.counters.legendaries++;
                    break;
            }
            Save();
        }

        // ====================== companion & consumables ======================

        public void UseFish(Item fish, bool feedPet)
        {
            var f = FishDb.Get(fish.fishId);
            if (f == null || !State.hero.Consume(ItemKind.Fish, fish.fishId)) return;
            var hero = HeroActor.I;
            switch (f.effect)
            {
                case FishEffect.PetForm:
                    State.pet.Feed(f, State.hero.LegendaryTotal(LegendaryEffect.PetFormDuration));
                    Toast($"{State.pet.name} becomes a {State.pet.Form?.name}!");
                    Sfx.Pet("summon");
                    break;
                case FishEffect.Heal:
                    hero?.Heal(hero.maxLife * f.healPct);
                    if (PetActor.I != null) PetActor.I.Heal(PetActor.I.maxLife * f.healPct);
                    Toast("Refreshing!");
                    break;
                case FishEffect.Buff:
                    State.AddBuff(f.buffStat, f.buffValue, f.buffSeconds, "fish_" + f.id);
                    hero?.RefreshStats();
                    Toast(f.text);
                    break;
            }
            Save();
        }

        public bool GiveToPet(Item it)
        {
            var p = State.pet;
            if (p.Away || p.pack.Count >= PetState.PackSize || !State.hero.inventory.Remove(it)) return false;
            p.pack.Add(it);
            return true;
        }

        public void SendPetToTown()
        {
            if (State.pet.SendToTown())
            {
                Toast($"{State.pet.name} trots off to town to sell. Back in {PetState.TripLength:0}s.");
                Sfx.Pet("happy");
            }
        }

        public void OnEquipmentChanged()
        {
            var h = HeroActor.I;
            if (h == null) return;
            h.RefreshStats();
            h.RefreshWeapon();
            PetActor.I?.RefreshLife(false);
        }

        public Rng Rng => rng;
    }
}
