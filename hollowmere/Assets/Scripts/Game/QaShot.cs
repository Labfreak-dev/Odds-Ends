using System;
using System.Collections;
using System.IO;
using Hollowmere.Core;
using UnityEngine;

namespace Hollowmere
{
    /// <summary>
    /// Player builds can be checked without a hand on the mouse:
    ///   Hollowmere -qaShot town
    ///   Hollowmere -qaShot dungeon
    ///   Hollowmere -qaShot title
    ///   Hollowmere -qaShot fishing
    ///   Hollowmere -qaShot gearclose
    ///   Hollowmere -qaShot npcs
    ///   Hollowmere -qaShot npcs-close
    ///   Hollowmere -qaShot monsters
    ///   Hollowmere -qaShot monsteranim
    ///   Hollowmere -qaShot monsterdeath
    ///   Hollowmere -qaShot skelclose
    ///   Hollowmere -qaShot propclose
    ///   Hollowmere -qaShot gearslots
    ///   Hollowmere -qaShot gearmix
    ///   Hollowmere -qaShot weapons
    ///   Hollowmere -qaShot creator
    ///   Hollowmere -qaShot weapon-melee
    ///   Hollowmere -qaShot weapon-ranged
    ///   Hollowmere -qaShot weapon-magic
    ///   Hollowmere -qaShot inventory
    ///   Hollowmere -qaShot menus
    ///   Hollowmere -qaShot hud
    ///   Hollowmere -qaShot biome-crypt
    ///   Hollowmere -qaShot biome-caverns
    ///   Hollowmere -qaShot biome-forge
    ///   Hollowmere -qaShot biome-infernal
    /// The shot is written to qa-&lt;scene&gt;.png in the working directory, then the player quits.
    /// Dungeon also fires Hex Bolt so the projectile is in the frame.
    /// Weapon shots equip one sword, bow, or staff on the classless hero and log the family.
    /// </summary>
    public static class QaShot
    {
        public static string Requested
        {
            get
            {
                var args = Environment.GetCommandLineArgs();
                for (int i = 0; i < args.Length - 1; i++)
                    if (args[i] == "-qaShot") return args[i + 1];
                return null;
            }
        }

        public static bool RunIfRequested(GameManager gm)
        {
            var scene = Requested;
            if (string.IsNullOrEmpty(scene)) return false;
            gm.StartCoroutine(Run(gm, scene.Trim().ToLowerInvariant()));
            return true;
        }

        static bool KnownShot(string scene)
        {
            switch (scene)
            {
                case "town":
                case "dungeon":
                case "floor":
                case "floor1":
                case "1":
                case "title":
                case "newhero":
                case "new-hero":
                case "create":
                case "creator":
                case "weapon-melee":
                case "melee":
                case "weapon-ranged":
                case "ranged":
                case "weapon-magic":
                case "magic":
                case "inventory":
                case "bag":
                case "menus":
                case "menu":
                case "hud":
                case "biome-crypt":
                case "biome-caverns":
                case "biome-forge":
                case "biome-infernal":
                case "loot":
                case "gear":
                case "gearclose":
                case "gear-close":
                case "gems":
                case "jeweler":
                case "fishing":
                case "fish":
                case "npcs":
                case "npc":
                case "npcs-close":
                case "npcclose":
                case "monsters":
                case "monster":
                case "monsters-v6":
                case "monstersv6":
                case "elites":
                case "eliteshot":
                case "elite":
                case "monsteranim":
                case "monsterdeath":
                case "skelclose":
                case "skel-close":
                case "propclose":
                case "prop-close":
                case "combatfeel":
                case "lootbeam":
                case "loot-beam":
                case "gearslots":
                case "gear-slots":
                case "gearmix":
                case "gear-mix":
                case "weapons":
                case "weaponline":
                case "tiers":
                case "geartiers":
                    return true;
            }
            return false;
        }

        static IEnumerator Run(GameManager gm, string scene)
        {
            if (!KnownShot(scene))
            {
                Debug.LogError("Hollowmere QA shot: unknown mode " + scene);
                Application.Quit();
                yield break;
            }
            if (scene == "monsteranim" || scene == "monsterdeath" || scene == "skelclose" || scene == "skel-close"
                || scene == "propclose" || scene == "prop-close")
            {
                string mode = scene == "skel-close" ? "skelclose" : scene == "prop-close" ? "propclose" : scene;
                yield return QaFrames.RunMonsterMode(gm, mode);
                yield break;
            }
            if (scene == "combatfeel")
            {
                yield return QaFrames.RunCombatFeel(gm);
                yield break;
            }
            if (scene == "gearslots" || scene == "gear-slots")
            {
                yield return QaFrames.RunGearSlots(gm, false);
                yield break;
            }
            if (scene == "gearmix" || scene == "gear-mix")
            {
                yield return QaFrames.RunGearMix(gm);
                yield break;
            }
            if (scene == "weapons" || scene == "weaponline")
            {
                yield return QaFrames.RunWeapons(gm);
                yield break;
            }
            if (scene == "tiers" || scene == "geartiers")
            {
                yield return QaFrames.RunTiers(gm);
                yield break;
            }
            bool title = scene == "title";
            bool newHero = scene == "newhero" || scene == "new-hero" || scene == "create" || scene == "creator";
            bool weaponMelee = scene == "weapon-melee" || scene == "melee";
            bool weaponRanged = scene == "weapon-ranged" || scene == "ranged";
            bool weaponMagic = scene == "weapon-magic" || scene == "magic";
            bool weapon = weaponMelee || weaponRanged || weaponMagic;
            bool inventory = scene == "inventory" || scene == "bag";
            bool menus = scene == "menus" || scene == "menu";
            bool hud = scene == "hud";
            int biomeDepth = scene == "biome-crypt" ? 3 : scene == "biome-caverns" ? 8 : scene == "biome-forge" ? 13 : scene == "biome-infernal" ? 18 : 0;
            bool loot = scene == "loot";
            bool gear = scene == "gear";
            bool gearClose = scene == "gearclose" || scene == "gear-close";
            bool gems = scene == "gems" || scene == "jeweler";
            bool fishing = scene == "fishing" || scene == "fish";
            bool npcs = scene == "npcs" || scene == "npc" || scene == "npcs-close" || scene == "npcclose";
            bool npcsClose = scene == "npcs-close" || scene == "npcclose";
            bool monsters = scene == "monsters" || scene == "monster";
            bool monstersV6 = scene == "monsters-v6" || scene == "monstersv6";
            bool elites = scene == "elites" || scene == "eliteshot" || scene == "elite";
            bool lootbeam = scene == "lootbeam" || scene == "loot-beam";
            bool dungeon = scene == "dungeon" || scene == "floor" || scene == "floor1" || scene == "1" || loot;
            if (title || newHero)
            {
                UiRoot.I.ShowTitle();
                if (newHero) TitleScreen.ShowNewHero();
                yield return new WaitForSecondsRealtime(1.2f);
            }
            else if (weapon)
            {
                gm.State = GameState.NewCustom("Qa", 1, 2, 1, 0, 0.85f, 0.7f, 0.45f, PetSpecies.Hound, "Moss", 1);
                gm.EnterTown(false);
                yield return new WaitForSeconds(0.8f);
                string id = weaponRanged ? "bow" : weaponMagic ? "staff" : "sword";
                var it = Loot.Generate(new Rng(4), 8, Rarity.Rare, null, ItemSlot.MainHand, forceBase: id, floor: 6);
                gm.State.hero.inventory.Add(it);
                gm.State.hero.Equip(it);
                gm.OnEquipmentChanged();
                var worn = gm.State.hero;
                var basic = worn.BasicAttack();
                string held = worn.Equipped(EquipSlot.MainHand) != null ? worn.Equipped(EquipSlot.MainHand).baseId : "";
                Debug.Log("Hollowmere QA weapon family=" + worn.AttackFamily() + " anim=" + worn.AnimSet()
                    + " skill=" + (basic != null ? basic.id : "") + " base=" + held);
                if (HeroActor.I != null) FrameGear(HeroActor.I);
                yield return new WaitForSeconds(0.35f);
            }
            else
            {
                gm.State = GameState.NewGame(HeroClass.Hexweaver, "Qa", PetSpecies.Hound, "Moss", 1);
                if (biomeDepth > 0) gm.EnterFloor(biomeDepth);
                else if (dungeon) gm.EnterFloor(1);
                else gm.EnterTown(false);
                yield return new WaitForSeconds(0.8f);
                if (npcsClose)
                {
                    yield return CloseUps();
                    Application.Quit();
                    yield break;
                }
                if (monsters) FrameMonsters();
                else if (monstersV6) FrameV6();
                else if (elites) FrameElites();
                else if (lootbeam) DropLootBeams();
                else if (npcs) FrameNpcs();
                Art.TameOversized(Camera.main);
                var albedo = HeroActor.I != null ? Art.AlbedoOf(HeroActor.I.gameObject) : null;
                if (albedo == null)
                    Debug.LogError("Hollowmere QA: hero material has no albedo texture.");
                else
                    Debug.Log("Hollowmere QA: hero albedo " + albedo.name + " " + albedo.width + "x" + albedo.height
                        + (albedo is Texture2D t && t.isReadable ? " readable" : ""));
                if (HeroActor.I != null)
                {
                    Art.LogHeroBounds(HeroActor.I.gameObject, dungeon ? "dungeon" : "town");
                    if (Art.UnionBounds(HeroActor.I.gameObject, out var hb))
                        Debug.Log("Hollowmere QA: hero bounds size " + hb.size + " center " + hb.center);
                }
                if (loot && HeroActor.I != null)
                {
                    var rng = new Rng(9);
                    var hero = gm.State.hero;
                    Vector3 at = HeroActor.I.Pos + HeroActor.I.transform.forward * 2.2f;
                    Pickup.DropItem(Loot.Generate(rng, 12, Rarity.Rare, hero.heroClass, floor: 8), at);
                    Pickup.DropItem(Loot.Generate(rng, 20, Rarity.Legendary, hero.heroClass, floor: 12), at + new Vector3(1.1f, 0f, 0.4f));
                    Pickup.DropGold(40, at + new Vector3(-0.8f, 0f, 0.3f));
                    yield return new WaitForSeconds(0.45f);
                }
                else if (gear || gearClose)
                {
                    EquipShowcase(gm);
                    if (HeroActor.I != null) Art.LogHeroBounds(HeroActor.I.gameObject, "gear");
                    if (gearClose && HeroActor.I != null)
                        FrameGear(HeroActor.I);
                    yield return new WaitForSeconds(0.35f);
                }
                else if (gems)
                {
                    var hero = gm.State.hero;
                    hero.AddItem(Gems.Make("cinder", 1, 3));
                    hero.AddItem(Gems.Make("thorn", 2, 1));
                    var chest = hero.Equipped(EquipSlot.Chest);
                    if (!Item.IsNone(chest)) { chest.sockets = 1; Gems.Socket(hero, chest, "thorn_2"); }
                    UiRoot.I.OpenJeweler();
                    yield return new WaitForSecondsRealtime(0.35f);
                }
                else if (fishing && HeroActor.I != null)
                {
                    Interactable spot = null;
                    foreach (var it in Interactable.All)
                        if (it != null && it.kind == InteractKind.Fishing) { spot = it; break; }
                    Vector3 water = spot != null ? spot.transform.position : HeroActor.I.Pos + Vector3.left * 4f;
                    water.y = 0.07f;
                    // standAt is the Old Angler's tile. Step off them onto the next shore tile.
                    Vector3 angler = spot != null && spot.pool != null ? World.ToWorld(spot.pool.standAt) : water + Vector3.right * World.T;
                    Vector3 stand = angler + Vector3.right * World.T;
                    if (!World.Walkable(stand)) stand = angler - Vector3.forward * World.T;
                    if (!World.Walkable(stand)) stand = angler + Vector3.forward * World.T;
                    var hero = HeroActor.I;
                    hero.Teleport(stand);
                    hero.Face(water - stand);
                    var rig = Camera.main != null ? Camera.main.GetComponent<CameraRig>() : null;
                    if (rig != null) rig.Snap();
                    var s = new FishingSession(new Rng(3), true, 1, 0f, 0f, 1, HeroClass.Hexweaver);
                    s.phase = FishingPhase.Waiting;
                    s.timer = 30f;
                    UiRoot.I.OpenFishing(s, water, () => { });
                    yield return new WaitForSecondsRealtime(0.45f);
                }
                else if (inventory)
                {
                    InventoryScreen.Show(UiRoot.I);
                    yield return new WaitForSecondsRealtime(0.6f);
                    AuditBagIcons();
                    AuditFrames("inventory");
                }
                else if (menus)
                {
                    MenuScreen.Show(UiRoot.I);
                    yield return new WaitForSecondsRealtime(0.45f);
                }
                else if (hud)
                {
                    int buttons = 0;
                    if (UiRoot.I != null && UiRoot.I.Hud != null)
                        buttons = UiRoot.I.Hud.GetComponentsInChildren<UnityEngine.UI.Button>(true).Length;
                    Debug.Log("Hollowmere QA hud buttons " + buttons);
                    if (buttons < 4) Debug.LogError("Hollowmere QA hud FAIL missing menu buttons");
                    AuditFrames("hud");
                    yield return new WaitForSeconds(0.35f);
                }
                else if (biomeDepth > 0)
                {
                    var band = BiomeCatalog.ForDepth(biomeDepth);
                    var theme = World.Map != null ? World.Map.theme.ToString() : "none";
                    int rooms = World.Map != null ? World.Map.rooms.Count : 0;
                    Debug.Log("Hollowmere QA biome " + (band != null ? band.id : "missing")
                        + " depth=" + biomeDepth + " theme=" + theme + " rooms=" + rooms);
                    if (band == null || World.Map == null || World.Map.theme != band.theme)
                        Debug.LogError("Hollowmere QA biome FAIL " + scene);
                    FrameBiome();
                    yield return new WaitForSeconds(0.35f);
                }
                else if (dungeon && HeroActor.I != null)
                {
                    StandForBolt(HeroActor.I);
                    var bolt = SkillDb.Get("hx_bolt");
                    bool fired = bolt != null && HeroActor.I.UseSkill(bolt);
                    if (!fired) Debug.LogError("Hollowmere QA: Hex Bolt did not fire.");
                    // Mid-flight. 22 m/s for 0.15 s is about three metres in front of the hero.
                    yield return new WaitForSeconds(0.15f);
                }
            }
            if (HeroActor.I != null) GearAttach.AuditGrip(HeroActor.I.transform);
            if (monstersV6)
            {
                for (int i = 0; i < 4; i++)
                    yield return null;
            }
            yield return new WaitForEndOfFrame();
            if (monstersV6) LogWraithHeight();
            var tex = ScreenCapture.CaptureScreenshotAsTexture();
            var path = Path.Combine(Directory.GetCurrentDirectory(), "qa-" + scene + ".png");
            try
            {
                File.WriteAllBytes(path, tex.EncodeToPNG());
                Debug.Log("Hollowmere QA shot saved: " + path);
            }
            catch (Exception e)
            {
                Debug.LogError("Hollowmere QA shot failed: " + e.Message);
            }
            UnityEngine.Object.Destroy(tex);
            Application.Quit();
        }

        static void EquipShowcase(GameManager gm)
        {
            var rng = new Rng(4);
            var hero = gm.State.hero;
            string weapon = hero.heroClass == HeroClass.Stalker ? "bow" : hero.heroClass == HeroClass.Ironclad ? "axe" : "wand";
            hero.Equip(Loot.Generate(rng, 8, Rarity.Legendary, hero.heroClass, ItemSlot.MainHand, forceBase: weapon, floor: 6));
            hero.Equip(Loot.Generate(rng, 8, Rarity.Rare, hero.heroClass, ItemSlot.Head, floor: 6));
            hero.Equip(Loot.Generate(rng, 8, Rarity.Magic, hero.heroClass, ItemSlot.Chest, floor: 6));
            gm.OnEquipmentChanged();
        }

        /// <summary>Wide town view that fits every service NPC, for pose checks.</summary>
        static void FrameNpcs()
        {
            bool any = false;
            Bounds box = default;
            int count = 0;
            foreach (var it in Interactable.All)
            {
                if (it == null) continue;
                switch (it.kind)
                {
                    case InteractKind.Merchant:
                    case InteractKind.Blacksmith:
                    case InteractKind.Mystic:
                    case InteractKind.Fisherman:
                    case InteractKind.Jeweler:
                    case InteractKind.Gambler:
                        break;
                    default:
                        continue;
                }
                count++;
                if (!Art.UnionBounds(it.gameObject, out var b) || b.size.y < 0.05f)
                    b = new Bounds(it.transform.position + Vector3.up * 0.9f, new Vector3(0.8f, 1.8f, 0.6f));
                if (!any) { box = b; any = true; }
                else box.Encapsulate(b);
                Debug.Log("Hollowmere QA npc " + it.kind + " at " + it.transform.position.ToString("0.0")
                    + " size=" + b.size.ToString("0.00"));
            }
            Debug.Log("Hollowmere QA npc count=" + count);
            if (!any) return;
            var look = box.center;
            float span = Mathf.Max(box.size.x, box.size.z);
            float dist = Mathf.Clamp(span * 0.85f + 6f, 14f, 28f);
            var camPos = look + new Vector3(0f, dist * 0.72f, -dist);
            var cam = Camera.main;
            if (cam == null) return;
            cam.fieldOfView = 42f;
            var rig = cam.GetComponent<CameraRig>();
            if (rig != null)
                rig.Lock(camPos, Quaternion.LookRotation(look - camPos, Vector3.up));
        }

        /// <summary>One close-up of each service NPC, then one of the hero.</summary>
        static IEnumerator CloseUps()
        {
            var row = new System.Collections.Generic.List<Interactable>();
            foreach (var it in Interactable.All)
            {
                if (it == null) continue;
                switch (it.kind)
                {
                    case InteractKind.Merchant:
                    case InteractKind.Blacksmith:
                    case InteractKind.Mystic:
                    case InteractKind.Fisherman:
                    case InteractKind.Jeweler:
                    case InteractKind.Gambler:
                        row.Add(it);
                        break;
                }
            }
            if (row.Count == 0) Debug.LogError("Hollowmere QA npcclose found no NPCs");
            foreach (var it in row)
            {
                FrameClose(it.transform.position, it.transform.forward, 1.15f, 2.3f);
                yield return new WaitForEndOfFrame();
                SaveShot("npcclose-" + it.kind.ToString().ToLowerInvariant());
            }
            if (HeroActor.I != null)
            {
                Art.LogHeroBounds(HeroActor.I.gameObject, "town");
                FrameClose(HeroActor.I.transform.position, HeroActor.I.transform.forward, 1.2f, 2.5f);
                yield return new WaitForEndOfFrame();
                SaveShot("npcclose-hero");
            }
            else Debug.LogError("Hollowmere QA npcclose found no hero");
        }

        static void FrameClose(Vector3 feet, Vector3 forward, float lookHeight, float distance)
        {
            forward.y = 0f;
            if (forward.sqrMagnitude < 0.01f) forward = Vector3.forward;
            forward.Normalize();
            var look = feet + Vector3.up * lookHeight;
            var camPos = look + forward * distance + Vector3.up * 0.15f;
            var cam = Camera.main;
            if (cam == null) return;
            cam.fieldOfView = 32f;
            var rig = cam.GetComponent<CameraRig>();
            if (rig != null)
                rig.Lock(camPos, Quaternion.LookRotation(look - camPos, Vector3.up));
        }

        /// <summary>Bag grid only. Equip slots are named for the doll, not cellN.</summary>
        static void AuditBagIcons()
        {
            int icons = 0;
            int fail = 0;
            foreach (var img in UnityEngine.Object.FindObjectsByType<UnityEngine.UI.Image>(FindObjectsSortMode.None))
            {
                if (img == null || img.gameObject.name != "icon") continue;
                if (!InBagCell(img.transform)) continue;
                icons++;
                var sp = img.sprite;
                string why = null;
                if (sp == null) why = "null sprite";
                else if (ItemIcon.IsFallback(sp)) why = "fallback " + (sp.texture != null ? sp.texture.name : sp.name);
                else if (sp.texture == null) why = "null texture";
                if (why != null)
                {
                    fail++;
                    Debug.LogError("Hollowmere QA bag icon FAIL " + CellName(img.transform) + " " + why);
                }
                else
                    Debug.Log("Hollowmere QA bag icon " + CellName(img.transform) + " sprite=" + sp.name + " tex=" + sp.texture.name + " " + sp.texture.width + "x" + sp.texture.height);
            }
            if (icons == 0)
                Debug.LogError("Hollowmere QA bag icon FAIL no item icons in the bag grid");
            else if (fail == 0)
                Debug.Log("Hollowmere QA bag icons " + icons + " ok");
        }

        /// <summary>
        /// Buttons, panels, and slots that should wear an iron or teal/gold frame.
        /// Empty cells and fill bars are not frames. A horizontal-only border is a bar, not a failure.
        /// </summary>
        static void AuditFrames(string where)
        {
            int frames = 0;
            int bad = 0;
            foreach (var img in UnityEngine.Object.FindObjectsByType<UnityEngine.UI.Image>(FindObjectsSortMode.None))
            {
                if (img == null) continue;
                var sp = img.sprite;
                string n = sp != null ? sp.name : "";
                if (n == "panel_iron")
                {
                    bad++;
                    Debug.LogError("Hollowmere QA frame FAIL " + where + " " + img.gameObject.name + " used panel_iron");
                    continue;
                }
                if (string.IsNullOrEmpty(n) || IsFillBar(n)) continue;
                bool button = img.GetComponent<UnityEngine.UI.Button>() != null || img.GetComponent<HoldButton>() != null;
                if (!button && !IsIronFrame(n)) continue;
                if (sp == null || !IsIronFrame(n))
                {
                    bad++;
                    Debug.LogError("Hollowmere QA frame FAIL " + where + " " + img.gameObject.name + " missing frame sprite=" + n);
                    continue;
                }
                frames++;
                Debug.Log("Hollowmere QA frame " + where + " " + n);
            }
            if (frames == 0)
                Debug.LogError("Hollowmere QA frame FAIL " + where + " no iron frames");
            else if (bad == 0)
                Debug.Log("Hollowmere QA frames " + where + " " + frames + " ok");
        }

        static bool IsFillBar(string name)
        {
            return name.StartsWith("hud_fill") || name.StartsWith("slider_");
        }

        static bool IsIronFrame(string name)
        {
            switch (name)
            {
                case "button_normal":
                case "button_pressed":
                case "button_disabled":
                case "button_dark":
                case "button_red":
                case "icon_button":
                case "icon_button_pressed":
                case "hud_frame":
                case "frame_gold":
                case "panel":
                case "panel_bg":
                case "panel_header":
                case "bag_panel":
                case "inventory_frame":
                case "inv_screen_frame":
                case "slot_column":
                case "stats_panel":
                case "tooltip_frame":
                case "tooltip_header":
                case "tab_active":
                case "tab_inactive":
                    return true;
            }
            return name.StartsWith("slot_") || name.StartsWith("rarity_");
        }

        static bool InBagCell(Transform t)
        {
            while (t != null)
            {
                if (t.name.StartsWith("cell")) return true;
                t = t.parent;
            }
            return false;
        }

        static string CellName(Transform t)
        {
            while (t != null)
            {
                if (t.name.StartsWith("cell")) return t.name;
                t = t.parent;
            }
            return "cell";
        }

        static void SaveShot(string name)
        {
            var tex = ScreenCapture.CaptureScreenshotAsTexture();
            var path = Path.Combine(Directory.GetCurrentDirectory(), "qa-" + name + ".png");
            try
            {
                File.WriteAllBytes(path, tex.EncodeToPNG());
                Debug.Log("Hollowmere QA shot saved: " + path);
            }
            catch (Exception e)
            {
                Debug.LogError("Hollowmere QA shot failed: " + e.Message);
            }
            UnityEngine.Object.Destroy(tex);
        }

        /// <summary>Every Meshy monster, in a row, so the lineup and the held props can be checked.</summary>
        static void LogWraithHeight()
        {
            int found = 0;
            foreach (var t in UnityEngine.Object.FindObjectsByType<Transform>(FindObjectsSortMode.None))
            {
                if (t == null || t.name != "hm_wraith") continue;
                found++;
                var floater = t.GetComponent<WraithFloat>();
                if (floater != null) floater.Pin(false);
                if (!Art.UnionBounds(t.gameObject, out var b) && floater == null)
                {
                    Debug.LogError("Hollowmere wraith height FAIL no mesh");
                    continue;
                }
                float hem = floater != null ? floater.Hem : b.min.y;
                Debug.Log("Hollowmere wraith height " + hem.ToString("0.00") + "m");
                if (hem < 0.3f || hem > 0.5f)
                    Debug.LogError("Hollowmere wraith height FAIL " + hem.ToString("0.00") + "m");
            }
            if (found == 0)
                Debug.LogError("Hollowmere wraith height FAIL missing wraith");
        }

        static void FrameMonsters()
        {
            string[] keys =
            {
                "hm_skel_warrior", "hm_skel_archer", "hm_ghoul", "hm_zombie", "hm_cultist",
                "hm_demon_brute", "hm_ossuary_king", "hm_demon_lord", "hm_rat", "hm_bat", "hm_spider",
            };
            Vector3 origin = HeroActor.I != null ? HeroActor.I.Pos : Vector3.zero;
            origin.y = 0f;
            float x = -16f;
            for (int i = 0; i < keys.Length; i++)
            {
                var go = Art.Animated(keys[i], 1.8f, null);
                if (go == null)
                {
                    Debug.LogError("Hollowmere QA monster missing " + keys[i]);
                    continue;
                }
                float gap = keys[i].Contains("demon") || keys[i].Contains("king") || keys[i].Contains("brute") ? 3.6f : 2.3f;
                go.transform.position = origin + new Vector3(x, 0f, 6f);
                go.transform.rotation = Quaternion.LookRotation(Vector3.back);
                Debug.Log("Hollowmere QA monster " + keys[i] + " at " + go.transform.position.ToString("0.0"));
                x += gap;
            }
            var look = origin + new Vector3(0f, 1.4f, 6f);
            var camPos = look + new Vector3(0f, 2.2f, -18f);
            var cam = Camera.main;
            if (cam == null) return;
            cam.fieldOfView = 40f;
            var rig = cam.GetComponent<CameraRig>();
            if (rig != null)
                rig.Lock(camPos, Quaternion.LookRotation(look - camPos, Vector3.up));
        }

        /// <summary>The v6 roster, one row, so the new bodies and the smith's hammer can be checked.</summary>
        static void FrameV6()
        {
            var keys = Art.V6Monsters;
            Vector3 origin = HeroActor.I != null ? HeroActor.I.Pos : Vector3.zero;
            origin.y = 0f;
            if (HeroActor.I != null) HeroActor.I.transform.position = origin + Vector3.right * 40f;
            float x = -18f;
            int shown = 0;
            for (int i = 0; i < keys.Length; i++)
            {
                var go = Art.Animated(keys[i], 1.8f, null);
                if (go == null)
                {
                    Debug.LogError("Hollowmere QA monster missing " + keys[i]);
                    continue;
                }
                shown++;
                bool wide = keys[i].Contains("golem") || keys[i].Contains("brute") || keys[i].Contains("mutant") || keys[i].Contains("wolf");
                go.transform.position = origin + new Vector3(x, 0f, 6f);
                go.transform.rotation = Quaternion.LookRotation(Vector3.back);
                Debug.Log("Hollowmere QA monster " + keys[i] + " at " + go.transform.position.ToString("0.0"));
                x += wide ? 3.8f : 2.4f;
            }
            if (shown != keys.Length)
                Debug.LogError("Hollowmere QA monsters-v6 FAIL " + shown + "/" + keys.Length);
            var look = origin + new Vector3(0f, 1.5f, 6f);
            var camPos = look + new Vector3(0f, 3.2f, -22f);
            var cam = Camera.main;
            if (cam == null) return;
            cam.fieldOfView = 42f;
            var rig = cam.GetComponent<CameraRig>();
            if (rig != null)
                rig.Lock(camPos, Quaternion.LookRotation(look - camPos, Vector3.up));
        }

        /// <summary>A blue champion and a yellow elite, with the affix list on the name plate.</summary>
        static void FrameElites()
        {
            AffixCatalog.Install();
            Vector3 origin = HeroActor.I != null ? HeroActor.I.Pos : Vector3.zero;
            origin.y = 0f;
            if (HeroActor.I != null) HeroActor.I.transform.position = origin + Vector3.right * 24f;
            var rng = new Rng(7);
            var champ = MonsterDb.Create(MonsterDb.Get("grave_eater"), 12, MonsterRank.Champion, rng, 8);
            var elite = MonsterDb.Create(MonsterDb.Get("cultist_smith"), 18, MonsterRank.Elite, rng, 14);
            champ.affixes.Clear();
            champ.affixes.Add(EliteAffix.Hasty);
            elite.affixes.Clear();
            elite.affixes.Add(EliteAffix.Molten);
            elite.affixes.Add(EliteAffix.Vampiric);
            var a = MonsterActor.Spawn(champ, origin + new Vector3(-1.7f, 0f, 4.4f), 1);
            var b = MonsterActor.Spawn(elite, origin + new Vector3(1.7f, 0f, 4.4f), 2);
            a.transform.rotation = Quaternion.LookRotation(Vector3.back);
            b.transform.rotation = Quaternion.LookRotation(Vector3.back);
            LogPlate(a, "champion");
            LogPlate(b, "elite");
            var look = origin + new Vector3(0f, 1.6f, 4.4f);
            var camPos = look + new Vector3(0f, 1.1f, -7.5f);
            var cam = Camera.main;
            if (cam == null) return;
            cam.fieldOfView = 36f;
            var rig = cam.GetComponent<CameraRig>();
            if (rig != null)
                rig.Lock(camPos, Quaternion.LookRotation(look - camPos, Vector3.up));
        }

        static void DropLootBeams()
        {
            var rng = new Rng(5);
            Rarity[] rows = { Rarity.Common, Rarity.Magic, Rarity.Rare, Rarity.Legendary, Rarity.Set };
            Vector3 origin = HeroActor.I != null ? HeroActor.I.Pos : Vector3.zero;
            origin.y = 0f;
            if (HeroActor.I != null) HeroActor.I.transform.position = origin + Vector3.right * 28f;
            for (int i = 0; i < rows.Length; i++)
            {
                var it = Loot.Generate(rng, 12, rows[i], HeroClass.Hexweaver, floor: 8);
                Pickup.DropItem(it, origin + new Vector3((i - 2) * 1.7f, 0f, 4f));
            }
            int beams = 0;
            foreach (var t in UnityEngine.Object.FindObjectsByType<Transform>(FindObjectsSortMode.None))
            {
                if (t == null || t.name != "beam") continue;
                beams++;
                var mr = t.GetComponent<MeshRenderer>();
                var c = mr != null && mr.sharedMaterial != null ? mr.sharedMaterial.color : Color.clear;
                Debug.Log("Hollowmere QA lootbeam " + beams + " rgb=" + c.r.ToString("0.00") + "," + c.g.ToString("0.00") + "," + c.b.ToString("0.00"));
                if (mr == null || c.maxColorComponent < 0.15f)
                    Debug.LogError("Hollowmere QA lootbeam FAIL uncoloured beam");
            }
            if (beams < rows.Length)
                Debug.LogError("Hollowmere QA lootbeam FAIL " + beams + "/" + rows.Length);
            else
                Debug.Log("Hollowmere QA lootbeam " + beams + " ok");
            for (int i = 0; i < Sfx.StepSurfaces.Length; i++)
            {
                string surface = Sfx.StepSurfaces[i];
                string clip = Sfx.StepCue(surface) + "_01";
                if (!Sfx.HasStep(surface))
                    Debug.LogError("Hollowmere QA step FAIL missing " + clip);
                else
                    Debug.Log("Hollowmere QA step " + surface + " " + clip);
            }
            var look = origin + new Vector3(0f, 1.1f, 4f);
            var camPos = look + new Vector3(0f, 1.4f, -7.2f);
            var cam = Camera.main;
            if (cam == null) return;
            cam.fieldOfView = 36f;
            var rig = cam.GetComponent<CameraRig>();
            if (rig != null)
                rig.Lock(camPos, Quaternion.LookRotation(look - camPos, Vector3.up));
        }

        static void LogPlate(MonsterActor actor, string kind)
        {
            if (actor == null)
            {
                Debug.LogError("Hollowmere QA elite plate FAIL missing " + kind);
                return;
            }
            TextMesh plate = null;
            foreach (var tm in actor.GetComponentsInChildren<TextMesh>(true))
                if (tm.gameObject.name == "label") plate = tm;
            string text = plate != null ? plate.text : "";
            Debug.Log("Hollowmere QA elite plate " + kind + " " + text.Replace('\n', '|'));
            if (plate == null || string.IsNullOrEmpty(text) || text.IndexOf('\n') < 0)
                Debug.LogError("Hollowmere QA elite plate FAIL " + kind + " has no affix list");
        }

        /// <summary>Line the service NPCs up and frame them from a few metres, so props and faces read.</summary>
        static void FrameNpcsClose()
        {
            var row = new System.Collections.Generic.List<Interactable>();
            foreach (var it in Interactable.All)
            {
                if (it == null) continue;
                switch (it.kind)
                {
                    case InteractKind.Merchant:
                    case InteractKind.Blacksmith:
                    case InteractKind.Mystic:
                    case InteractKind.Fisherman:
                    case InteractKind.Jeweler:
                    case InteractKind.Gambler:
                        row.Add(it);
                        break;
                }
            }
            Vector3 origin = HeroActor.I != null ? HeroActor.I.Pos : Vector3.zero;
            origin.y = 0f;
            for (int i = 0; i < row.Count; i++)
            {
                var it = row[i];
                it.transform.position = origin + new Vector3((i - (row.Count - 1) * 0.5f) * 1.65f, 0f, 3.4f);
                it.transform.rotation = Quaternion.LookRotation(Vector3.back);
                Debug.Log("Hollowmere QA npc close " + it.kind + " at " + it.transform.position.ToString("0.0"));
            }
            var look = origin + new Vector3(0f, 1.2f, 3.4f);
            var camPos = look + new Vector3(0f, 0.35f, -8.2f);
            var cam = Camera.main;
            if (cam == null) return;
            cam.fieldOfView = 40f;
            var rig = cam.GetComponent<CameraRig>();
            if (rig != null)
                rig.Lock(camPos, Quaternion.LookRotation(look - camPos, Vector3.up));
        }

        static void FrameBiome()
        {
            if (HeroActor.I == null || Camera.main == null) return;
            var look = HeroActor.I.Pos + Vector3.up * 1.4f;
            var camPos = look + new Vector3(0f, 7.5f, -14f);
            var cam = Camera.main;
            cam.fieldOfView = 42f;
            var rig = cam.GetComponent<CameraRig>();
            if (rig != null)
                rig.Lock(camPos, Quaternion.LookRotation(look - camPos, Vector3.up));
        }

        /// <summary>Close 3/4 view so the helm, chest overlay, and weapon fill the frame.</summary>
        static void FrameGear(HeroActor hero)
        {
            var look = hero.Pos + Vector3.up * 1.28f;
            var fwd = hero.transform.forward;
            var right = hero.transform.right;
            var offset = ((-fwd) + right * 0.75f);
            if (offset.sqrMagnitude < 0.01f) offset = Vector3.back;
            var camPos = look + offset.normalized * 2.45f + Vector3.up * 0.15f;
            var cam = Camera.main;
            if (cam == null) return;
            cam.fieldOfView = 28f;
            var rig = cam.GetComponent<CameraRig>();
            if (rig != null)
                rig.Lock(camPos, Quaternion.LookRotation(look - camPos, Vector3.up));
        }

        static Vector3 OpenAim(Vector3 from)
        {
            Vector3 best = Vector3.forward;
            float bestD = -1f;
            for (int i = 0; i < 8; i++)
            {
                var d = Quaternion.Euler(0f, i * 45f, 0f) * Vector3.forward;
                float dist = ClearDistance(from, d);
                if (dist > bestD) { bestD = dist; best = d; }
            }
            return best;
        }

        static float ClearDistance(Vector3 from, Vector3 dir)
        {
            float dist = 0f;
            for (float s = 0.5f; s <= 10f; s += 0.5f)
            {
                if (!World.Walkable(from + dir * s)) break;
                dist = s;
            }
            return dist;
        }

        /// <summary>Stand where Hex Bolt still has several metres of floor in front of it at 0.15 s,
        /// so the shot shows the projectile instead of a bolt that died in a wall.</summary>
        static void StandForBolt(HeroActor hero)
        {
            var map = World.Map;
            Vector3 origin = hero.Pos;
            Vector3 bestPos = origin;
            Vector3 bestAim = OpenAim(origin);
            float bestScore = ClearDistance(origin, bestAim);
            if (map != null)
            {
                for (int y = 0; y < map.height; y++)
                    for (int x = 0; x < map.width; x++)
                    {
                        if (!map.Walkable(x, y)) continue;
                        var p = World.ToWorld(new Int2(x, y));
                        var aim = OpenAim(p);
                        float dist = ClearDistance(p, aim);
                        float score = dist - Vector3.Distance(p, origin) * 0.02f;
                        if (score > bestScore) { bestScore = score; bestPos = p; bestAim = aim; }
                    }
            }
            hero.Teleport(bestPos);
            hero.aim = bestAim;
            hero.Face(bestAim);
            if (PetActor.I != null) PetActor.I.Teleport(bestPos + new Vector3(1.35f, 0f, -0.85f));
            var rig = UnityEngine.Object.FindObjectOfType<CameraRig>();
            if (rig != null) { rig.follow = hero.transform; rig.Snap(); }
            Debug.Log("Hollowmere QA: bolt lane " + ClearDistance(bestPos, bestAim).ToString("0.0") + "m from " + bestPos);
        }
    }
}
