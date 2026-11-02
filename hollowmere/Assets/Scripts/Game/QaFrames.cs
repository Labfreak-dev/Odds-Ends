using System;
using System.Collections;
using System.IO;
using Hollowmere.Core;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace Hollowmere
{
    /// <summary>
    /// Frame sequences for locomotion, pet follow, and a combat swing:
    ///   Hollowmere -qaFrames move
    ///   Hollowmere -qaFrames pet
    ///   Hollowmere -qaFrames combat
    ///   Hollowmere -qaFrames monsteranim
    ///   Hollowmere -qaFrames monsterdeath
    ///   Hollowmere -qaFrames skelclose
    ///   Hollowmere -qaFrames propclose
    ///   Hollowmere -qaFrames telegraphs
    ///   Hollowmere -qaFrames gearslots
    /// Writes qa-move-00.png … and qa-pet-00.png … then quits.
    /// Count, rate, and size come from FeelProfile (30 frames at 10 fps, 2340×1080).
    /// </summary>
    public static class QaFrames
    {
        public static string Requested
        {
            get
            {
                var args = Environment.GetCommandLineArgs();
                for (int i = 0; i < args.Length - 1; i++)
                    if (args[i] == "-qaFrames") return args[i + 1];
                return null;
            }
        }

        public static bool RunIfRequested(GameManager gm)
        {
            var mode = Requested;
            if (string.IsNullOrEmpty(mode)) return false;
            gm.StartCoroutine(Run(gm, mode.Trim().ToLowerInvariant()));
            return true;
        }

        static IEnumerator Run(GameManager gm, string mode)
        {
            if (mode == "monsteranim" || mode == "monsterdeath" || mode == "skelclose" || mode == "propclose")
            {
                yield return RunMonsterMode(gm, mode);
                yield break;
            }
            if (mode == "combatfeel")
            {
                yield return CombatFeelFrames(gm);
                yield break;
            }
            if (mode == "telegraphs")
            {
                yield return TelegraphFrames(gm);
                yield break;
            }
            if (mode == "gearslots" || mode == "gear-slots")
            {
                yield return RunGearSlots(gm, true);
                yield break;
            }
            if (mode != "move" && mode != "pet" && mode != "combat")
            {
                Debug.LogError("Hollowmere QA frames: unknown mode " + mode);
                Application.Quit();
                yield break;
            }
            var f = Feel.Active;
            gm.State = GameState.NewGame(HeroClass.Hexweaver, "Qa", PetSpecies.Hound, "Moss", 1);
            if (mode == "combat") gm.EnterFloor(1);
            else gm.EnterTown(false);
            yield return new WaitForSeconds(0.6f);
            Art.TameOversized(Camera.main);
            var hero = HeroActor.I;
            if (hero == null)
            {
                Debug.LogError("Hollowmere QA frames: no hero");
                Application.Quit();
                yield break;
            }
            Screen.SetResolution(f.width, f.height, FullScreenMode.Windowed);
            yield return null;
            yield return new WaitForEndOfFrame();

            var lane = Longest(hero.Pos);
            if (mode == "move")
                HoldCameraAcross(hero, lane);
            var drive = gm.gameObject.AddComponent<QaDrive>();
            drive.hero = hero;
            drive.mode = mode;
            drive.forward = lane;
            drive.right = Quaternion.Euler(0f, 90f, 0f) * drive.forward;
            if (mode == "combat")
            {
                var def = MonsterDb.Get("bonewalker");
                if (def != null)
                {
                    var ms = MonsterDb.Create(def, 1, MonsterRank.Normal, new Rng(3), 1);
                    MonsterActor.Spawn(ms, hero.Pos + drive.forward * 2.4f, 7);
                }
            }
            Debug.Log("Hollowmere QA frames: " + mode + " nav=" + FloorNav.Ready
                + " open=" + Clear(hero.Pos, drive.forward).ToString("0.0") + "m"
                + " screen=" + Screen.width + "x" + Screen.height);

            float interval = 1f / Mathf.Max(1, f.fps);
            int i = 0;
            float next = 0f;
            int guard = 0;
            while (i < f.frames && guard++ < f.frames * 30)
            {
                yield return new WaitForEndOfFrame();
                while (i < f.frames && drive.elapsed + 0.0001f >= next)
                {
                    AssertHeroVisible(hero);
                    if (mode == "move")
                    {
                        var p = hero.Pos;
                        Debug.Log("Hollowmere QA move " + i.ToString("00")
                            + " gait=" + drive.Gait
                            + " speed=" + hero.GroundSpeed.ToString("0.00")
                            + " pos=" + p.x.ToString("0.00") + "," + p.z.ToString("0.00"));
                    }
                    Save(mode, i);
                    i++;
                    next += interval;
                }
            }
            Debug.Log("Hollowmere QA frames saved: " + i + " " + mode);
            Application.Quit();
        }

        /// <summary>Catches a hero that was scaled away or left outside the frame.</summary>
        static void AssertHeroVisible(HeroActor hero)
        {
            if (hero == null)
            {
                Debug.LogError("Hollowmere QA: hero is missing");
                return;
            }
            bool any = false;
            Bounds b = default;
            foreach (var r in hero.GetComponentsInChildren<Renderer>())
            {
                if (!(r is MeshRenderer) && !(r is SkinnedMeshRenderer)) continue;
                if (!r.enabled || OnRing(r.transform)) continue;
                if (!any) { b = r.bounds; any = true; }
                else b.Encapsulate(r.bounds);
            }
            if (!any || b.size.sqrMagnitude < 0.04f)
            {
                Debug.LogError("Hollowmere QA: hero renderer bounds are empty");
                return;
            }
            var cam = Camera.main;
            if (cam == null) return;
            var vp = cam.WorldToViewportPoint(b.center);
            if (vp.z <= 0f || vp.x < -0.05f || vp.x > 1.05f || vp.y < -0.05f || vp.y > 1.05f)
                Debug.LogError("Hollowmere QA: hero is off-screen center=" + b.center + " size=" + b.size + " vp=" + vp);
        }

        static bool OnRing(Transform t)
        {
            while (t != null)
            {
                if (t.name == "heroRing") return true;
                t = t.parent;
            }
            return false;
        }

        static readonly string[] MonsterKeys =
        {
            "hm_skel_warrior", "hm_skel_archer", "hm_ghoul", "hm_zombie", "hm_cultist",
            "hm_demon_brute", "hm_ossuary_king", "hm_demon_lord", "hm_rat", "hm_bat", "hm_spider",
            "hm_grave_eater", "hm_wraith", "hm_horror_ghoul", "hm_drowned_husk",
            "hm_cave_crawler", "hm_warwolf", "hm_vampire_bat", "hm_bone_golem",
            "hm_cultist_smith", "hm_forest_brute", "hm_hellhound", "hm_imp",
            "hm_giant_mutant", "hm_lava_golem",
        };

        public static IEnumerator RunCombatFeel(GameManager gm) => CombatFeelFrames(gm);

        public static IEnumerator RunGearSlots(GameManager gm, bool frames)
        {
            var feel = Feel.Active;
            gm.State = GameState.NewGame(HeroClass.Ironclad, "Qa", PetSpecies.Hound, "Moss", 1);
            gm.EnterTown(false);
            yield return new WaitForSeconds(0.45f);
            Screen.SetResolution(feel.width, feel.height, FullScreenMode.Windowed);
            yield return null;
            var actor = HeroActor.I;
            if (actor == null)
            {
                Debug.LogError("Hollowmere gear FAIL no hero");
                Application.Quit();
                yield break;
            }
            var cam = Camera.main;
            var rig = cam != null ? cam.GetComponent<CameraRig>() : null;
            (EquipSlot slot, string id)[] pieces =
            {
                (EquipSlot.Head, "helm"),
                (EquipSlot.Shoulders, "pauldrons"),
                (EquipSlot.Chest, "plate"),
                (EquipSlot.Hands, "gauntlets"),
                (EquipSlot.Wrists, "bracers"),
                (EquipSlot.Waist, "belt"),
                (EquipSlot.Legs, "greaves"),
                (EquipSlot.Feet, "boots"),
            };
            if (frames)
            {
                Wear(gm, pieces);
                GearAudit.Prepare(actor.transform);
                var motive = actor.GetComponentInChildren<ModelAnim>();
                if (motive != null) HeroReact.Attach(motive);
                yield return null;
                yield return new WaitForEndOfFrame();
                var anim = motive != null && motive.anim != null ? motive.anim : actor.GetComponentInChildren<Animation>();
                var names = GearAudit.ClipNames(anim);
                Debug.Log("Hollowmere gear frames clips " + string.Join(",", names));
                int shot = 0;
                for (int g = 0; g < GearFit.RequiredPoses.Length; g++)
                {
                    string label = GearFit.RequiredPoses[g][0];
                    string clip = FirstPose(names, GearFit.RequiredPoses[g]);
                    if (clip == null)
                    {
                        Debug.LogError("Hollowmere gear FAIL frames missing pose " + label);
                        Debug.Log("Hollowmere gear pose " + label + " none");
                        continue;
                    }
                    float unit = label == "death" ? 0.99f : label == "hit" ? 0.5f : 0.35f;
                    Sample(anim, clip, unit);
                    if (label == "hit") FrameFront(actor, cam, rig, 1.32f, 2.15f, 30f);
                    else FrameGear(actor, cam, rig, false);
                    yield return new WaitForEndOfFrame();
                    Save("gearslots-" + label, shot++);
                    Debug.Log("Hollowmere gear frames pose " + label + " " + clip + " t=" + unit.ToString("0.00"));
                }
                for (int g = 0; g < GearFit.OptionalPoses.Length; g++)
                {
                    string clip = FirstPose(names, GearFit.OptionalPoses[g]);
                    if (clip == null) continue;
                    Sample(anim, clip, 0.35f);
                    FrameGear(actor, cam, rig, false);
                    yield return new WaitForEndOfFrame();
                    Save("gearslots-" + GearFit.OptionalPoses[g][0], shot++);
                }
                int frameFails = GearAudit.Run(actor.transform);
                Debug.Log("Hollowmere gear frames fails=" + frameFails);
                Debug.Log("Hollowmere QA frames saved: " + shot + " gearslots");
                Application.Quit();
                yield break;
            }
            for (int i = 0; i < pieces.Length; i++)
            {
                Wear(gm, new[] { pieces[i] });
                yield return null;
                yield return new WaitForEndOfFrame();
                FrameGear(actor, cam, rig, true);
                yield return null;
                yield return new WaitForEndOfFrame();
                SaveNamed("gearslots-paper-" + GearFit.SlotName(pieces[i].slot));
                FrameGear(actor, cam, rig, false);
                yield return null;
                yield return new WaitForEndOfFrame();
                SaveNamed("gearslots-world-" + GearFit.SlotName(pieces[i].slot));
                Debug.Log("Hollowmere gear " + pieces[i].id + " shot");
            }
            Wear(gm, pieces);
            yield return null;
            int fails = GearAudit.Run(actor.transform);
            Debug.Log("Hollowmere gear poses fails=" + fails);
            Debug.Log("Hollowmere QA gearslots saved");
            Application.Quit();
        }

        public static IEnumerator RunGearMix(GameManager gm)
        {
            var feel = Feel.Active;
            gm.State = GameState.NewGame(HeroClass.Ironclad, "Qa", PetSpecies.Hound, "Moss", 1);
            gm.EnterTown(false);
            yield return new WaitForSeconds(0.35f);
            Screen.SetResolution(feel.width, feel.height, FullScreenMode.Windowed);
            yield return null;
            var actor = HeroActor.I;
            if (actor == null)
            {
                Debug.LogError("Hollowmere gear FAIL no hero");
                Application.Quit();
                yield break;
            }
            (EquipSlot slot, string id)[] pieces =
            {
                (EquipSlot.Head, "helm"),
                (EquipSlot.Shoulders, "pauldrons"),
                (EquipSlot.Chest, "plate"),
                (EquipSlot.Hands, "gauntlets"),
                (EquipSlot.Wrists, "bracers"),
                (EquipSlot.Waist, "belt"),
                (EquipSlot.Legs, "greaves"),
                (EquipSlot.Feet, "boots"),
            };
            for (int i = 0; i < GearFit.Adjacent.Length; i++)
            {
                var pair = GearFit.Adjacent[i];
                Wear(gm, new[] { Piece(pieces, pair.a), Piece(pieces, pair.b) });
                yield return null;
                int fails = GearAudit.RunIdle(actor.transform);
                if (fails > 0)
                    Debug.LogError("Hollowmere gear FAIL pair " + pair.a + "+" + pair.b + " " + fails);
                else
                    Debug.Log("Hollowmere gear pair " + pair.a + "+" + pair.b + " ok");
            }
            for (int i = 0; i < 4; i++)
            {
                var mix = GearFit.Mix(1000 + i, 4);
                var worn = new (EquipSlot, string)[mix.Length];
                for (int k = 0; k < mix.Length; k++) worn[k] = Piece(pieces, mix[k]);
                Wear(gm, worn);
                yield return null;
                int fails = GearAudit.RunIdle(actor.transform);
                if (fails > 0)
                    Debug.LogError("Hollowmere gear FAIL mix " + i + " " + fails);
                else
                    Debug.Log("Hollowmere gear mix " + i + " ok");
            }
            Wear(gm, pieces);
            var cam = Camera.main;
            var rig = cam != null ? cam.GetComponent<CameraRig>() : null;
            yield return null;
            yield return new WaitForEndOfFrame();
            FrameGear(actor, cam, rig, true);
            yield return null;
            yield return new WaitForEndOfFrame();
            SaveNamed("gearmix-paper");
            FrameGear(actor, cam, rig, false);
            Debug.Log("Hollowmere QA gearmix done");
            Application.Quit();
        }

        /// <summary>Lineup of every weapon base, then one in-hand shot and one grip close-up per type.</summary>
        public static IEnumerator RunWeapons(GameManager gm)
        {
            var feel = Feel.Active;
            gm.State = GameState.NewGame(HeroClass.Ironclad, "Qa", PetSpecies.Hound, "Moss", 1);
            gm.State.hero.classless = true;
            gm.EnterTown(false);
            yield return new WaitForSeconds(0.35f);
            Screen.SetResolution(feel.width, feel.height, FullScreenMode.Windowed);
            yield return null;
            var actor = HeroActor.I;
            var cam = Camera.main;
            var rig = cam != null ? cam.GetComponent<CameraRig>() : null;
            if (actor == null || cam == null)
            {
                Debug.LogError("Hollowmere gear FAIL no hero");
                Application.Quit();
                yield break;
            }
            actor.gameObject.SetActive(false);
            bool hudOn = UiRoot.I != null && UiRoot.I.Hud != null && UiRoot.I.Hud.gameObject.activeSelf;
            if (hudOn) UiRoot.I.Hud.gameObject.SetActive(false);
            var savedClear = cam.clearFlags;
            var savedBg = cam.backgroundColor;
            var savedFov = cam.fieldOfView;
            var lineupLight = LineupLight.Push();
            ShowLineup(cam, rig, GearTable.Weapons, 9, 1.15f, 0.8f);
            yield return null;
            yield return new WaitForEndOfFrame();
            float lum = LineupLuminance();
            Debug.Log("Hollowmere lineup luminance " + lum.ToString("0.00"));
            // 0.24 is the floor for these dark-metal albedos once the lineup reads clearly. 0.26 measured there.
            if (lum < 0.24f)
                Debug.LogError("Hollowmere lineup FAIL luminance " + lum.ToString("0.00"));
            SaveNamed("weapons-lineup");
            ClearLineup();
            var types = GearTable.WeaponTypes;
            for (int i = 0; i < types.Count; i++)
            {
                ShowLineup(cam, rig, OfType(types[i]), 3, 1.7f, 1.2f);
                yield return null;
                yield return new WaitForEndOfFrame();
                SaveNamed("weapons-lineup-" + types[i]);
                ClearLineup();
            }
            LineupLight.Pop(lineupLight);
            cam.clearFlags = savedClear;
            cam.backgroundColor = savedBg;
            cam.fieldOfView = savedFov;
            actor.gameObject.SetActive(true);
            for (int i = 0; i < types.Count; i++)
            {
                string id = GearTable.Signature(types[i]);
                bool main = WearWeapon(gm, id);
                yield return null;
                StandIdle(actor);
                GearAttach.AuditGrip(actor.transform);
                StandIdle(actor);
                FrameGear(actor, cam, rig, true);
                yield return null;
                yield return new WaitForEndOfFrame();
                SaveNamed("weapons-" + types[i]);
                FrameGrip(actor, cam, rig, main);
                GearAttach.AuditFramed(actor.transform, cam);
                if (types[i] == "shield") GearAttach.AuditShieldFace(actor.transform, cam);
                yield return null;
                yield return new WaitForEndOfFrame();
                SaveNamed("weapons-grip-" + types[i]);
                if (types[i] == "shield")
                {
                    FrameShield34(actor, cam, rig);
                    yield return null;
                    yield return new WaitForEndOfFrame();
                    SaveNamed("weapons-grip-shield-34");
                }
                if (types[i] == "quiver")
                {
                    FrameRear(actor, cam, rig);
                    yield return null;
                    yield return new WaitForEndOfFrame();
                    SaveNamed("weapons-quiver-back");
                }
                if (types[i] == "dagger" || types[i] == "fist")
                {
                    FrameHand(actor, cam, rig);
                    yield return null;
                    yield return new WaitForEndOfFrame();
                    SaveNamed("weapons-hand-" + types[i]);
                }
            }
            Debug.Log("Hollowmere QA weapons done");
            Application.Quit();
        }

        /// <summary>Front view of each family at tiers 1, 2, and 3.</summary>
        public static IEnumerator RunTiers(GameManager gm)
        {
            var feel = Feel.Active;
            gm.State = GameState.NewGame(HeroClass.Ironclad, "Qa", PetSpecies.Hound, "Moss", 1);
            gm.State.hero.classless = true;
            gm.EnterTown(false);
            yield return new WaitForSeconds(0.35f);
            Screen.SetResolution(feel.width, feel.height, FullScreenMode.Windowed);
            yield return null;
            var actor = HeroActor.I;
            var cam = Camera.main;
            var rig = cam != null ? cam.GetComponent<CameraRig>() : null;
            if (actor == null)
            {
                Debug.LogError("Hollowmere gear FAIL no hero");
                Application.Quit();
                yield break;
            }
            (EquipSlot slot, string id)[] pieces =
            {
                (EquipSlot.Head, "helm"),
                (EquipSlot.Shoulders, "pauldrons"),
                (EquipSlot.Chest, "plate"),
                (EquipSlot.Hands, "gauntlets"),
                (EquipSlot.Wrists, "bracers"),
                (EquipSlot.Waist, "belt"),
                (EquipSlot.Legs, "greaves"),
                (EquipSlot.Feet, "boots"),
            };
            int tierFails = 0;
            string only = System.Environment.GetEnvironmentVariable("HM_QA_FAMILY");
            for (int f = 0; f < GearTable.Families.Length; f++)
            {
                if (!string.IsNullOrEmpty(only) && GearTable.Families[f] != only) continue;
                var seen = new System.Collections.Generic.Dictionary<EquipSlot, string>[GearTable.TierCount + 1];
                for (int tier = 1; tier <= GearTable.TierCount; tier++)
                {
                    // The rarity row owns the visual tier: common is t1, rare t2, legendary t3.
                    var tierRarity = tier == 1 ? Rarity.Common : tier == 2 ? Rarity.Rare : Rarity.Legendary;
                    GearWardrobe.LastSource.Clear();
                    WearFamily(gm, pieces, GearTable.Families[f], tier, tierRarity);
                    yield return null;
                    seen[tier] = new System.Collections.Generic.Dictionary<EquipSlot, string>(GearWardrobe.LastSource);
                    for (int p = 0; p < pieces.Length; p++)
                    {
                        seen[tier].TryGetValue(pieces[p].slot, out var now);
                        Debug.Log("Hollowmere tiers mesh " + GearTable.Families[f] + " t" + tier + " " + pieces[p].slot + " " + (now ?? "none"));
                        if (string.IsNullOrEmpty(now)) { tierFails++; Debug.LogError("Hollowmere gear FAIL tiers no mesh " + GearTable.Families[f] + " t" + tier + " " + pieces[p].slot); continue; }
                        for (int lower = 1; lower < tier; lower++)
                            if (seen[lower] != null && seen[lower].TryGetValue(pieces[p].slot, out var was) && was == now)
                            {
                                tierFails++;
                                Debug.LogError("Hollowmere gear FAIL tiers same mesh " + GearTable.Families[f] + " t" + lower + "=t" + tier + " " + pieces[p].slot + " " + now);
                            }
                    }
                    // Fit and in-engine skin clip on every pose for this family and tier (crouch included).
                    GearAudit.Prepare(actor.transform);
                    int fitFails = GearAudit.Run(actor.transform);
                    Debug.Log("Hollowmere tiers fit " + GearTable.Families[f] + " t" + tier + " fails=" + fitFails);
                    if (fitFails > 0) tierFails += fitFails;
                    StandIdle(actor);
                    FrameGear(actor, cam, rig, true);
                    yield return null;
                    yield return new WaitForEndOfFrame();
                    SaveNamed("tiers-" + GearTable.Families[f] + "-" + tier);
                }
            }
            Debug.Log("Hollowmere tiers distinct fails=" + tierFails);
            Debug.Log("Hollowmere QA tiers done");
            Application.Quit();
        }

        /// <summary>
        /// Paper shots of every rarity, in-world only from rare up, at 2340x1080, plus a five-rarity sheet.
        /// The town is built once. Weapon swaps leave the armour on the body.
        /// </summary>
        public static IEnumerator RunRarity(GameManager gm)
        {
            gm.State = GameState.NewGame(HeroClass.Ironclad, "Qa", PetSpecies.Hound, "Moss", 1);
            gm.State.hero.classless = true;
            gm.EnterTown(false);
            Screen.SetResolution(2340, 1080, FullScreenMode.Windowed);
            yield return null;
            var actor = HeroActor.I;
            var cam = Camera.main;
            var rig = cam != null ? cam.GetComponent<CameraRig>() : null;
            if (actor == null || cam == null)
            {
                Debug.LogError("Hollowmere rarity FAIL no hero");
                Application.Quit();
                yield break;
            }
            (EquipSlot slot, string id)[] pieces =
            {
                (EquipSlot.Head, "helm"),
                (EquipSlot.Shoulders, "pauldrons"),
                (EquipSlot.Chest, "plate"),
                (EquipSlot.Hands, "gauntlets"),
                (EquipSlot.Wrists, "bracers"),
                (EquipSlot.Waist, "belt"),
                (EquipSlot.Legs, "greaves"),
                (EquipSlot.Feet, "boots"),
            };
            string[] weapons = { "sword", "axe", "bow", "staff", "shield" };
            var fronts = new System.Collections.Generic.List<Texture2D>();
            var crops = new System.Collections.Generic.List<Rect>();
            var closes = new System.Collections.Generic.List<Texture2D>();
            foreach (Rarity rarity in System.Enum.GetValues(typeof(Rarity)))
            {
                string tag = rarity.ToString().ToLowerInvariant();
                WearRaritySet(gm, pieces, rarity);
                PoseRarity(actor.transform, "idle");
                RarityEnv(true);
                FrameGear(actor, cam, rig, true);
                yield return new WaitForEndOfFrame();
                var front = ScreenCapture.CaptureScreenshotAsTexture();
                if (front != null)
                {
                    SaveTexture(front, "rarity-paper-" + tag + "-front");
                    fronts.Add(front);
                    var crop = ArmorCrop(actor.transform, cam, front, tag);
                    crops.Add(crop);
                    SaveCrop(front, crop, tag);
                    if (rarity >= Rarity.Rare)
                    {
                        // Two renders of the same pose in one frame: with and without rarity emission.
                        // Only light the glow adds counts against the face, not authored helm trim.
                        var lit = RenderNow(cam, front.width, front.height, 0f);
                        var matte = RenderNow(cam, front.width, front.height, 1f);
                        if (matte != null) SaveTexture(matte, "rarity-paper-" + tag + "-matte");
                        if (lit != null) SaveTexture(lit, "rarity-paper-" + tag + "-glow");
                        CheckFace(lit, cam, actor.transform, rarity, matte);
                        if (lit != null) UnityEngine.Object.Destroy(lit);
                        if (matte != null) UnityEngine.Object.Destroy(matte);
                    }
                }
                FrameThreeQuarter(actor, cam, rig);
                yield return new WaitForEndOfFrame();
                SaveNamed("rarity-paper-" + tag + "-34");
                RarityVfx.AuditBody(actor.transform, rarity);
                if (rarity >= Rarity.Rare)
                {
                    RarityEnv(false);
                    FrameGear(actor, cam, rig, false);
                    yield return new WaitForEndOfFrame();
                    SaveNamed("rarity-world-" + tag + "-idle");
                    PoseRarity(actor.transform, "run");
                    RarityVfx.AuditBody(actor.transform, rarity);
                    PoseRarity(actor.transform, "attack");
                    FrameGear(actor, cam, rig, false);
                    yield return new WaitForEndOfFrame();
                    SaveNamed("rarity-world-" + tag + "-attack");
                    RarityVfx.AuditBody(actor.transform, rarity);
                    PoseRarity(actor.transform, "death");
                    FrameGear(actor, cam, rig, false);
                    yield return new WaitForEndOfFrame();
                    SaveNamed("rarity-world-" + tag + "-death");
                    RarityVfx.AuditBody(actor.transform, rarity);
                    PoseRarity(actor.transform, "idle");
                    RarityEnv(true);
                }
                for (int w = 0; w < weapons.Length; w++)
                {
                    AddHand(gm, GearTable.Signature(weapons[w]), rarity);
                    PoseRarity(actor.transform, "idle");
                    FrameGrip(actor, cam, rig, weapons[w] != "shield");
                    yield return new WaitForEndOfFrame();
                    if (w == 0)
                    {
                        var close = ScreenCapture.CaptureScreenshotAsTexture();
                        if (close != null)
                        {
                            SaveTexture(close, "rarity-weapon-" + weapons[w] + "-" + tag);
                            closes.Add(close);
                        }
                    }
                    else
                        SaveNamed("rarity-weapon-" + weapons[w] + "-" + tag);
                    RarityVfx.AuditBody(actor.transform, rarity);
                }
            }
            RarityEnv(false);
            CheckRarityColours(fronts, crops);
            SaveRaritySheet(fronts, closes);
            for (int i = 0; i < fronts.Count; i++)
                if (fronts[i] != null) UnityEngine.Object.Destroy(fronts[i]);
            for (int i = 0; i < closes.Count; i++)
                if (closes[i] != null) UnityEngine.Object.Destroy(closes[i]);
            Debug.Log("Hollowmere QA rarity done");
            Application.Quit();
        }

        static void WearRaritySet(GameManager gm, (EquipSlot slot, string id)[] pieces, Rarity rarity)
        {
            var hero = gm.State.hero;
            hero.classless = true;
            hero.inventory.RemoveAll(it => it != null && it.kind == ItemKind.Equipment);
            for (int i = 0; i < (int)EquipSlot.Count; i++) hero.equipment[i] = null;
            for (int i = 0; i < pieces.Length; i++)
                Give(hero, pieces[i].slot, pieces[i].id, rarity, true);
            gm.OnEquipmentChanged();
        }

        static void WearOne(GameManager gm, EquipSlot slot, string id, Rarity rarity, bool armor)
        {
            var hero = gm.State.hero;
            hero.classless = true;
            hero.inventory.RemoveAll(it => it != null && it.kind == ItemKind.Equipment);
            for (int i = 0; i < (int)EquipSlot.Count; i++) hero.equipment[i] = null;
            Give(hero, slot, id, rarity, armor);
            gm.OnEquipmentChanged();
        }

        static void Give(Hero hero, EquipSlot slot, string id, Rarity rarity, bool armor)
        {
            ItemSlot kind = ItemSlot.MainHand;
            if (GearTable.TryRow(id, out var row)) kind = row.Slot;
            else if (armor) kind = ItemSlotOf(slot);
            // Roll at rare so a legendary or set drop does not swap the base id.
            var it = Loot.Generate(new Rng((ulong)(21 + (int)rarity)), 12, Rarity.Rare, null, kind, id, 8);
            if (it == null)
            {
                Debug.LogError("Hollowmere rarity FAIL could not roll " + id + " " + rarity);
                return;
            }
            it.rarity = rarity;
            it.family = "plate";
            it.tier = GearTable.TierOf(0, rarity);
            if (rarity == Rarity.Set) it.setId = "set_plate";
            if (!hero.AddItem(it) || !hero.Equip(it))
                Debug.LogError("Hollowmere rarity FAIL could not equip " + id + " " + rarity);
        }

        static void PoseRarity(Transform body, string which)
        {
            var anim = body != null ? body.GetComponentInChildren<Animation>() : null;
            if (anim == null) return;
            AnimationState pick = null;
            foreach (AnimationState s in anim)
            {
                if (s == null || s.clip == null) continue;
                string n = s.name.ToLowerInvariant();
                bool match = which == "idle" ? (n == "idle" || n.EndsWith("|idle") || n.EndsWith("_idle"))
                    : which == "run" ? n.Contains("run")
                    : which == "death" ? n == "death" || n.EndsWith("|death")
                    : n.Contains("attack") || n.Contains("swing") || n.Contains("chop") || n.Contains("slam");
                if (match) { pick = s; break; }
            }
            if (pick == null) return;
            foreach (AnimationState s in anim)
            {
                s.weight = 0f;
                s.enabled = false;
            }
            pick.enabled = true;
            pick.weight = 1f;
            pick.time = which == "death" ? pick.length * 0.72f : pick.length * 0.35f;
            anim.Sample();
            var ik = body.GetComponentInChildren<OffHandIk>();
            if (ik != null) ik.Apply();
        }

        static void AddHand(GameManager gm, string id, Rarity rarity)
        {
            var hero = gm.State.hero;
            if (hero.Equipped(EquipSlot.MainHand) != null) hero.equipment[(int)EquipSlot.MainHand] = null;
            if (hero.Equipped(EquipSlot.OffHand) != null) hero.equipment[(int)EquipSlot.OffHand] = null;
            Give(hero, EquipSlot.MainHand, id, rarity, false);
            if (HeroActor.I != null) GearAttach.SwapHeld(HeroActor.I.transform, hero);
        }

        static void FrameThreeQuarter(HeroActor actor, Camera cam, CameraRig rig)
        {
            if (cam == null || actor == null) return;
            Vector3 face = FaceDir(actor);
            Vector3 side = Vector3.Cross(Vector3.up, face);
            if (side.sqrMagnitude < 1e-4f) side = Vector3.right;
            side.Normalize();
            const float height = 1.85f;
            Vector3 look = actor.Pos + Vector3.up * (height * 0.48f);
            cam.fieldOfView = 28f;
            float dist = (height * 0.64f) / Mathf.Tan(cam.fieldOfView * 0.5f * Mathf.Deg2Rad);
            Vector3 camPos = look + (face * 0.78f + side * 0.55f).normalized * dist + Vector3.up * 0.06f;
            var rot = Quaternion.LookRotation(look - camPos, Vector3.up);
            if (rig != null) rig.Lock(camPos, rot);
            else cam.transform.SetPositionAndRotation(camPos, rot);
            PaperStage(actor, face, true);
            PaperLight(actor, true, camPos, look);
        }

        static bool rarityEnvOn;
        static LineupLight rarityEnv;
        static bool cropFlip;

        /// <summary>Studio ambient and a bright reflection, so a metallic finish is silver instead of black. Rarity shots only.</summary>
        static void RarityEnv(bool on)
        {
            if (on == rarityEnvOn) return;
            if (on) rarityEnv = LineupLight.Push();
            else LineupLight.Pop(rarityEnv);
            rarityEnvOn = on;
        }

        static void CheckRarityColours(System.Collections.Generic.List<Texture2D> fronts, System.Collections.Generic.List<Rect> crops)
        {
            if (fronts == null || fronts.Count < 2) return;
            var means = new Color[fronts.Count];
            var spread = new float[fronts.Count];
            var counts = new int[fronts.Count];
            string[] names = { "common", "magic", "rare", "legendary", "set" };
            for (int i = 0; i < fronts.Count; i++)
            {
                Rect crop = crops != null && i < crops.Count ? crops[i] : new Rect(fronts[i].width * 0.42f, fronts[i].height * 0.28f, fronts[i].width * 0.16f, fronts[i].height * 0.48f);
                means[i] = MeanArmor(fronts[i], crop, out counts[i], out spread[i]);
                string who = i < names.Length ? names[i] : i.ToString();
                Debug.Log("Hollowmere rarity crop " + who + " "
                    + crop.x.ToString("0") + "," + crop.y.ToString("0") + " "
                    + crop.width.ToString("0") + "x" + crop.height.ToString("0")
                    + " n=" + counts[i]
                    + " rgb=" + means[i].r.ToString("0.00") + "," + means[i].g.ToString("0.00") + "," + means[i].b.ToString("0.00"));
                if (counts[i] < 40)
                    Debug.LogError("Hollowmere rarity FAIL crop " + who + " n=" + counts[i]);
            }
            var labs = new Vector3[fronts.Count];
            for (int i = 0; i < fronts.Count; i++)
            {
                Rect crop = crops != null && i < crops.Count ? crops[i] : new Rect(fronts[i].width * 0.42f, fronts[i].height * 0.28f, fronts[i].width * 0.16f, fronts[i].height * 0.48f);
                var hi = HighlightLab(fronts[i], crop, out int hn, out Color rgb);
                labs[i] = hi;
                string who = i < names.Length ? names[i] : i.ToString();
                Debug.Log("Hollowmere rarity highlight " + who + " n=" + hn
                    + " rgb=" + rgb.r.ToString("0.00") + "," + rgb.g.ToString("0.00") + "," + rgb.b.ToString("0.00")
                    + " lab=" + hi.x.ToString("0.0") + "," + hi.y.ToString("0.0") + "," + hi.z.ToString("0.0"));
            }
            // The current sheet reads as dark iron, bright silver, a blue rim, orange, and muted green.
            // CIE76 of 12 is a clear step between those highlight colours and still rejects a shared dark mean.
            const float minDeltaE = 12f;
            for (int i = 1; i < labs.Length && i < names.Length; i++)
            {
                float d = Vector3.Distance(labs[i], labs[i - 1]);
                Debug.Log("Hollowmere rarity deltaE " + names[i - 1] + "-" + names[i] + " " + d.ToString("0.0"));
                if (d < minDeltaE)
                    Debug.LogError("Hollowmere rarity FAIL colour " + names[i - 1] + "-" + names[i] + " " + d.ToString("0.0"));
            }
            float common = spread.Length > 0 ? spread[0] : 0f;
            Debug.Log("Hollowmere rarity variance common " + common.ToString("0.000"));
            for (int i = 1; i < spread.Length && i < names.Length; i++)
            {
                float ratio = common > 0.004f ? spread[i] / common : 1f;
                Debug.Log("Hollowmere rarity variance " + names[i] + " " + ratio.ToString("0.00"));
                if (ratio < 0.60f)
                    Debug.LogError("Hollowmere rarity FAIL variance " + names[i] + " " + ratio.ToString("0.00"));
            }
        }

        /// <summary>
        /// Torso rect from the spine and shoulder bones. Renderer bounds were pulling in the path stones,
        /// and a flipped screenshot puts those bones in the sky. The orientation that lands on the figure wins.
        /// </summary>
        static Rect ArmorCrop(Transform body, Camera cam, Texture2D src, string tag)
        {
            int width = src != null ? src.width : Screen.width;
            int height = src != null ? src.height : Screen.height;
            bool flip = FigureFlipped(body, cam, src);
            cropFlip = flip;
            string[] bones = { "Spine2", "Spine1", "Spine", "Hips", "LeftArm", "RightArm", "LeftUpLeg", "RightUpLeg" };
            float minX = float.MaxValue, minY = float.MaxValue, maxX = float.MinValue, maxY = float.MinValue;
            int seen = 0;
            for (int i = 0; i < bones.Length; i++)
            {
                var bone = body != null ? Art.Bone(body, bones[i]) : null;
                if (bone == null || !Project(cam, src, bone.position, flip, out var pix)) continue;
                seen++;
                if (pix.x < minX) minX = pix.x;
                if (pix.x > maxX) maxX = pix.x;
                if (pix.y < minY) minY = pix.y;
                if (pix.y > maxY) maxY = pix.y;
            }
            Rect rect;
            if (seen < 2)
                rect = new Rect(width * 0.42f, height * 0.32f, width * 0.16f, height * 0.36f);
            else
            {
                float padX = (maxX - minX) * 0.35f + 10f;
                float padY = (maxY - minY) * 0.22f + 10f;
                minX = Mathf.Clamp(minX - padX, 0f, width - 2f);
                maxX = Mathf.Clamp(maxX + padX, minX + 2f, width);
                minY = Mathf.Clamp(minY - padY, 0f, height - 2f);
                maxY = Mathf.Clamp(maxY + padY, minY + 2f, height);
                rect = Rect.MinMaxRect(minX, minY, maxX, maxY);
            }
            Debug.Log("Hollowmere rarity crop " + tag + " orient " + (flip ? "flip" : "native")
                + " " + rect.x.ToString("0") + "," + rect.y.ToString("0")
                + " " + rect.width.ToString("0") + "x" + rect.height.ToString("0"));
            return rect;
        }

        static bool FigureFlipped(Transform body, Camera cam, Texture2D src)
        {
            if (src == null || cam == null || body == null) return false;
            var spine = Art.Bone(body, "Spine2") ?? Art.Bone(body, "Spine1");
            if (spine == null) return false;
            if (!Project(cam, src, spine.position, false, out var native)) return false;
            if (!Project(cam, src, spine.position, true, out var flipped)) return false;
            Color corner = src.GetPixel(2, 2);
            float dn = ColorDistance(src.GetPixel(Mathf.Clamp((int)native.x, 0, src.width - 1), Mathf.Clamp((int)native.y, 0, src.height - 1)), corner);
            float df = ColorDistance(src.GetPixel(Mathf.Clamp((int)flipped.x, 0, src.width - 1), Mathf.Clamp((int)flipped.y, 0, src.height - 1)), corner);
            // Capture is y-up here. Flip only when the native spine pixel is background and the flipped one is not.
            return dn < 0.12f && df > dn + 0.08f;
        }

        static bool Project(Camera cam, Texture2D src, Vector3 world, bool flipY, out Vector2 pix)
        {
            pix = default;
            if (cam == null || src == null) return false;
            var s = cam.WorldToScreenPoint(world);
            if (s.z < 0.05f) return false;
            float x = s.x * src.width / Mathf.Max(1f, Screen.width);
            float y = s.y * src.height / Mathf.Max(1f, Screen.height);
            if (flipY) y = src.height - 1f - y;
            pix = new Vector2(x, y);
            return true;
        }

        static float ColorDistance(Color a, Color b)
            => Mathf.Abs(a.r - b.r) + Mathf.Abs(a.g - b.g) + Mathf.Abs(a.b - b.b);

        static void SaveCrop(Texture2D src, Rect crop, string tag)
        {
            if (src == null) return;
            int x0 = Mathf.Clamp(Mathf.FloorToInt(crop.x), 0, src.width - 1);
            int y0 = Mathf.Clamp(Mathf.FloorToInt(crop.y), 0, src.height - 1);
            int x1 = Mathf.Clamp(Mathf.CeilToInt(crop.xMax), x0 + 1, src.width);
            int y1 = Mathf.Clamp(Mathf.CeilToInt(crop.yMax), y0 + 1, src.height);
            int w = Mathf.Max(1, x1 - x0);
            int h = Mathf.Max(1, y1 - y0);
            var tex = new Texture2D(w, h, TextureFormat.RGB24, false);
            for (int y = 0; y < h; y++)
            for (int x = 0; x < w; x++)
                tex.SetPixel(x, y, src.GetPixel(x0 + x, y0 + y));
            tex.Apply();
            var path = System.IO.Path.Combine(System.IO.Directory.GetCurrentDirectory(), "qa-rarity-crop-" + tag + ".png");
            try
            {
                System.IO.File.WriteAllBytes(path, tex.EncodeToPNG());
                Debug.Log("Hollowmere QA frame saved: " + path);
            }
            catch (System.Exception e)
            {
                Debug.LogError("Hollowmere rarity FAIL exception crop " + e.Message);
            }
            UnityEngine.Object.Destroy(tex);
        }

        static void CheckFace(Texture2D src, Camera cam, Transform body, Rarity rarity, Texture2D baseline)
        {
            if (src == null || cam == null || body == null || rarity < Rarity.Rare) return;
            RarityVfx.LogFace(body, cam);
            var head = RarityVfx.SkinHead(body);
            if (head == null) return;
            Vector3 sp = cam.WorldToScreenPoint(head.position);
            if (sp.z < 0.01f) return;
            sp.x *= src.width / (float)Mathf.Max(1, Screen.width);
            sp.y *= src.height / (float)Mathf.Max(1, Screen.height);
            if (cropFlip) sp.y = src.height - 1f - sp.y;
            float dist = Vector3.Distance(cam.transform.position, head.position);
            // Same 22 cm sphere the shader uses to cut emission off the head and the chest top.
            float radius = RarityTable.FaceRadius / Mathf.Max(0.25f, 2f * dist * Mathf.Tan(cam.fieldOfView * 0.5f * Mathf.Deg2Rad)) * src.height;
            radius = Mathf.Clamp(radius, 28f, src.height * 0.16f);
            var glow = RarityBook.Glow(rarity, "plate");
            int bad = 0, n = 0;
            int r = Mathf.CeilToInt(radius);
            int cx = Mathf.RoundToInt(sp.x);
            int cy = Mathf.RoundToInt(sp.y);
            float r2 = radius * radius;
            for (int y = cy - r; y <= cy + r; y += 2)
            for (int x = cx - r; x <= cx + r; x += 2)
            {
                if (x < 0 || y < 0 || x >= src.width || y >= src.height) continue;
                float dx = x - cx, dy = y - cy;
                if (dx * dx + dy * dy > r2) continue;
                n++;
                // Glow the rarity adds. Authored trim that reads this hue with emission off is not glow.
                if (RarityPixel(src.GetPixel(x, y), glow)
                    && (baseline == null || baseline.width != src.width || !RarityPixel(baseline.GetPixel(x, y), glow)))
                    bad++;
            }
            Debug.Log("Hollowmere rarity face " + rarity + " " + bad + "/" + n);
            if (bad > 0)
                Debug.LogError("Hollowmere rarity FAIL face " + rarity + " " + bad + "/" + n);
        }

        static Texture2D RenderNow(Camera cam, int w, int h, float noEmit)
        {
            if (cam == null) return null;
            var rt = RenderTexture.GetTemporary(w, h, 24, RenderTextureFormat.ARGB32);
            var prev = cam.targetTexture;
            var prevActive = RenderTexture.active;
            Shader.SetGlobalFloat("_HmQaNoEmit", noEmit);
            cam.targetTexture = rt;
            cam.Render();
            RenderTexture.active = rt;
            var tex = new Texture2D(w, h, TextureFormat.RGB24, false);
            tex.ReadPixels(new Rect(0, 0, w, h), 0, 0);
            tex.Apply();
            cam.targetTexture = prev;
            RenderTexture.active = prevActive;
            RenderTexture.ReleaseTemporary(rt);
            Shader.SetGlobalFloat("_HmQaNoEmit", 0f);
            return tex;
        }

        static bool RarityPixel(Color p, Color glow)
        {
            float mx = Mathf.Max(p.r, Mathf.Max(p.g, p.b));
            float mn = Mathf.Min(p.r, Mathf.Min(p.g, p.b));
            if (mx - mn < 0.28f || mx < 0.50f) return false;
            var a = new Vector3(p.r - mn, p.g - mn, p.b - mn);
            var b = new Vector3(glow.r, glow.g, glow.b);
            if (a.sqrMagnitude < 1e-4f || b.sqrMagnitude < 1e-4f) return false;
            return Vector3.Dot(a.normalized, b.normalized) > 0.92f;
        }

        static Color MeanArmor(Texture2D src, Rect crop, out int n, out float std)
        {
            n = 0;
            std = 0f;
            if (src == null) return Color.black;
            int x0 = Mathf.Clamp(Mathf.FloorToInt(crop.x), 0, src.width - 1);
            int x1 = Mathf.Clamp(Mathf.CeilToInt(crop.xMax), x0 + 1, src.width);
            int y0 = Mathf.Clamp(Mathf.FloorToInt(crop.y), 0, src.height - 1);
            int y1 = Mathf.Clamp(Mathf.CeilToInt(crop.yMax), y0 + 1, src.height);
            Color corner = src.GetPixel(4, 4);
            double r = 0, g = 0, b = 0, sum = 0, sum2 = 0;
            for (int y = y0; y < y1; y += 2)
            for (int x = x0; x < x1; x += 2)
            {
                var p = src.GetPixel(x, y);
                if (Mathf.Abs(p.r - corner.r) + Mathf.Abs(p.g - corner.g) + Mathf.Abs(p.b - corner.b) < 0.08f) continue;
                r += p.r; g += p.g; b += p.b;
                float luma = 0.299f * p.r + 0.587f * p.g + 0.114f * p.b;
                sum += luma;
                sum2 += luma * luma;
                n++;
            }
            if (n < 8) return Color.black;
            double mean = sum / n;
            double v = sum2 / n - mean * mean;
            std = Mathf.Sqrt((float)System.Math.Max(0.0, v));
            return new Color((float)(r / n), (float)(g / n), (float)(b / n), 1f);
        }

        /// <summary>CIELAB of the brightest quarter of the armour crop. The dark base no longer sets the mean.</summary>
        static Vector3 HighlightLab(Texture2D src, Rect crop, out int n, out Color mean)
        {
            n = 0;
            mean = Color.black;
            if (src == null) return Vector3.zero;
            int x0 = Mathf.Clamp(Mathf.FloorToInt(crop.x), 0, src.width - 1);
            int x1 = Mathf.Clamp(Mathf.CeilToInt(crop.xMax), x0 + 1, src.width);
            int y0 = Mathf.Clamp(Mathf.FloorToInt(crop.y), 0, src.height - 1);
            int y1 = Mathf.Clamp(Mathf.CeilToInt(crop.yMax), y0 + 1, src.height);
            Color corner = src.GetPixel(4, 4);
            Color edge = CropEdge(src, x0, x1, y0, y1);
            var lum = new System.Collections.Generic.List<float>(1024);
            var cols = new System.Collections.Generic.List<Color>(1024);
            for (int y = y0; y < y1; y += 2)
            for (int x = x0; x < x1; x += 2)
            {
                var p = src.GetPixel(x, y);
                if (Near(p, corner, 0.08f) || Near(p, edge, 0.10f)) continue;
                lum.Add(0.299f * p.r + 0.587f * p.g + 0.114f * p.b);
                cols.Add(p);
            }
            if (cols.Count < 8) return Vector3.zero;
            var order = new float[lum.Count];
            for (int i = 0; i < lum.Count; i++) order[i] = lum[i];
            System.Array.Sort(order);
            float cut = order[Mathf.Clamp(Mathf.FloorToInt(order.Length * 0.75f), 0, order.Length - 1)];
            double r = 0, g = 0, b = 0;
            for (int i = 0; i < cols.Count; i++)
            {
                if (lum[i] < cut) continue;
                r += cols[i].r; g += cols[i].g; b += cols[i].b;
                n++;
            }
            if (n < 4) return Vector3.zero;
            mean = new Color((float)(r / n), (float)(g / n), (float)(b / n), 1f);
            return RgbToLab(mean);
        }

        static Color CropEdge(Texture2D src, int x0, int x1, int y0, int y1)
        {
            double r = 0, g = 0, b = 0;
            int n = 0;
            int step = Mathf.Max(2, (x1 - x0) / 12);
            for (int x = x0; x < x1; x += step)
            {
                Add(src.GetPixel(x, y0), ref r, ref g, ref b, ref n);
                Add(src.GetPixel(x, Mathf.Min(src.height - 1, y1 - 1)), ref r, ref g, ref b, ref n);
            }
            if (n == 0) return src.GetPixel(4, 4);
            return new Color((float)(r / n), (float)(g / n), (float)(b / n), 1f);
        }

        static void Add(Color p, ref double r, ref double g, ref double b, ref int n)
        {
            r += p.r; g += p.g; b += p.b; n++;
        }

        static bool Near(Color a, Color b, float tol)
            => Mathf.Abs(a.r - b.r) + Mathf.Abs(a.g - b.g) + Mathf.Abs(a.b - b.b) < tol;

        static Vector3 RgbToLab(Color c)
        {
            float R = Srgb(c.r), G = Srgb(c.g), B = Srgb(c.b);
            float x = (R * 0.4124f + G * 0.3576f + B * 0.1805f) / 0.95047f;
            float y = R * 0.2126f + G * 0.7152f + B * 0.0722f;
            float z = (R * 0.0193f + G * 0.1192f + B * 0.9505f) / 1.08883f;
            x = LabF(x); y = LabF(y); z = LabF(z);
            return new Vector3(116f * y - 16f, 500f * (x - y), 200f * (y - z));
        }

        static float Srgb(float u) => u <= 0.04045f ? u / 12.92f : Mathf.Pow((u + 0.055f) / 1.055f, 2.4f);

        static float LabF(float t) => t > 0.008856f ? Mathf.Pow(t, 1f / 3f) : 7.787f * t + 16f / 116f;

        static void SaveTexture(Texture2D tex, string name)
        {
            if (tex == null) return;
            var path = System.IO.Path.Combine(System.IO.Directory.GetCurrentDirectory(), "qa-" + name + ".png");
            try
            {
                System.IO.File.WriteAllBytes(path, tex.EncodeToPNG());
                Debug.Log("Hollowmere QA frame saved: " + path);
            }
            catch (System.Exception e)
            {
                Debug.LogError("Hollowmere QA frame failed: " + e.Message);
            }
        }

        static void SaveRaritySheet(System.Collections.Generic.List<Texture2D> fronts, System.Collections.Generic.List<Texture2D> closes)
        {
            if (fronts == null || fronts.Count == 0) return;
            const int width = 2340, height = 1080;
            int cols = fronts.Count;
            int cw = width / cols;
            int labelH = 54;
            int gap = 12;
            int bodyH = 640;
            int weapH = height - labelH - bodyH - gap * 2;
            var sheet = new Texture2D(width, height, TextureFormat.RGB24, false);
            var clear = new Color32[width * height];
            var bg = new Color32(32, 34, 38, 255);
            for (int i = 0; i < clear.Length; i++) clear[i] = bg;
            sheet.SetPixels32(clear);
            string[] labels = { "COMMON", "MAGIC", "RARE", "LEGEND", "SET" };
            for (int c = 0; c < cols; c++)
            {
                BlitFit(sheet, fronts[c], new Rect(c * cw + 8, labelH + weapH + gap, cw - 16, bodyH));
                if (closes != null && c < closes.Count)
                    BlitFit(sheet, closes[c], new Rect(c * cw + 8, labelH, cw - 16, weapH));
                StampLabel(sheet, c < labels.Length ? labels[c] : "", c * cw, 8, cw, labelH - 12);
            }
            sheet.Apply();
            var path = System.IO.Path.Combine(System.IO.Directory.GetCurrentDirectory(), "qa-rarity-sheet.png");
            try
            {
                System.IO.File.WriteAllBytes(path, sheet.EncodeToPNG());
                Debug.Log("Hollowmere QA frame saved: " + path);
            }
            catch (System.Exception e)
            {
                Debug.LogError("Hollowmere rarity FAIL exception sheet " + e.Message);
            }
            UnityEngine.Object.Destroy(sheet);
        }

        static void BlitFit(Texture2D dst, Texture2D src, Rect dest)
        {
            if (dst == null || src == null || dest.width < 2f || dest.height < 2f) return;
            float destAspect = dest.width / dest.height;
            float srcAspect = (float)src.width / Mathf.Max(1, src.height);
            int cropW, cropH, cropX, cropY;
            if (srcAspect > destAspect)
            {
                cropH = src.height;
                cropW = Mathf.Max(1, (int)(src.height * destAspect));
                cropX = (src.width - cropW) / 2;
                cropY = 0;
            }
            else
            {
                cropW = src.width;
                cropH = Mathf.Max(1, (int)(src.width / destAspect));
                cropX = 0;
                cropY = (src.height - cropH) / 2;
            }
            int dw = (int)dest.width;
            int dh = (int)dest.height;
            int ox = (int)dest.x;
            int oy = (int)dest.y;
            for (int y = 0; y < dh; y++)
            {
                int sy = cropY + y * cropH / dh;
                if (sy < 0 || sy >= src.height) continue;
                for (int x = 0; x < dw; x++)
                {
                    int sx = cropX + x * cropW / dw;
                    if (sx < 0 || sx >= src.width) continue;
                    int dx = ox + x;
                    int dy = oy + y;
                    if (dx < 0 || dy < 0 || dx >= dst.width || dy >= dst.height) continue;
                    dst.SetPixel(dx, dy, src.GetPixel(sx, sy));
                }
            }
        }

        static void StampLabel(Texture2D dst, string text, int x, int y, int w, int h)
        {
            int scale = 3;
            int glyphW = 5 * scale + scale;
            int total = text.Length * glyphW;
            int ox = x + Mathf.Max(0, (w - total) / 2);
            int oy = y + Mathf.Max(0, (h - 7 * scale) / 2);
            var ink = new Color(0.93f, 0.91f, 0.84f);
            for (int i = 0; i < text.Length; i++)
                StampGlyph(dst, text[i], ox + i * glyphW, oy, scale, ink);
        }

        static void StampGlyph(Texture2D dst, char ch, int x, int y, int scale, Color ink)
        {
            string rows = Glyph(ch);
            if (string.IsNullOrEmpty(rows)) return;
            for (int row = 0; row < rows.Length && row < 7; row++)
            {
                int bits = rows[row];
                for (int col = 0; col < 5; col++)
                {
                    if (((bits >> (4 - col)) & 1) == 0) continue;
                    for (int py = 0; py < scale; py++)
                    for (int px = 0; px < scale; px++)
                    {
                        int dx = x + col * scale + px;
                        int dy = y + (6 - row) * scale + py;
                        if (dx >= 0 && dy >= 0 && dx < dst.width && dy < dst.height)
                            dst.SetPixel(dx, dy, ink);
                    }
                }
            }
        }

        static string Glyph(char ch)
        {
            switch (ch)
            {
                case 'A': return "\u000e\u0011\u0011\u001f\u0011\u0011\u0011";
                case 'C': return "\u000e\u0011\u0010\u0010\u0010\u0011\u000e";
                case 'D': return "\u001e\u0011\u0011\u0011\u0011\u0011\u001e";
                case 'E': return "\u001f\u0010\u0010\u001e\u0010\u0010\u001f";
                case 'G': return "\u000e\u0011\u0010\u0017\u0011\u0011\u000e";
                case 'I': return "\u000e\u0004\u0004\u0004\u0004\u0004\u000e";
                case 'L': return "\u0010\u0010\u0010\u0010\u0010\u0010\u001f";
                case 'M': return "\u0011\u001b\u0015\u0015\u0011\u0011\u0011";
                case 'N': return "\u0011\u0019\u0015\u0013\u0011\u0011\u0011";
                case 'O': return "\u000e\u0011\u0011\u0011\u0011\u0011\u000e";
                case 'R': return "\u001e\u0011\u0011\u001e\u0014\u0012\u0011";
                case 'S': return "\u000f\u0010\u0010\u000e\u0001\u0001\u001e";
                case 'T': return "\u001f\u0004\u0004\u0004\u0004\u0004\u0004";
                case 'Y': return "\u0011\u0011\u000a\u0004\u0004\u0004\u0004";
                default: return "";
            }
        }

        static System.Collections.Generic.List<GearTable.WeaponRow> OfType(string type)
        {
            var list = new System.Collections.Generic.List<GearTable.WeaponRow>();
            var rows = GearTable.Weapons;
            for (int i = 0; i < rows.Count; i++)
                if (rows[i].Type == type) list.Add(rows[i]);
            return list;
        }

        static void ClearLineup()
        {
            var line = GameObject.Find("weapon_lineup");
            if (line != null) UnityEngine.Object.DestroyImmediate(line);
        }

        /// <summary>
        /// Weapons on a light card, filling the frame. Labels are small and turned
        /// to face the camera: a TextMesh at identity reads backwards from +Z.
        /// </summary>
        static void ShowLineup(Camera cam, CameraRig rig, System.Collections.Generic.IReadOnlyList<GearTable.WeaponRow> rows, int cols, float cell, float target)
        {
            ClearLineup();
            if (rows == null || rows.Count == 0) return;
            var root = new GameObject("weapon_lineup");
            root.transform.position = new Vector3(0f, 40f, 0f);
            var grey = new Color(0.82f, 0.83f, 0.85f);
            var font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            if (font == null) font = Resources.GetBuiltinResource<Font>("Arial.ttf");
            int nRows = (rows.Count + cols - 1) / cols;
            for (int i = 0; i < rows.Count; i++)
            {
                var row = rows[i];
                var prefab = Resources.Load<GameObject>("Gear/Weapons/" + row.Model);
                if (prefab == null)
                {
                    Debug.LogError("Hollowmere gear FAIL weapon model " + row.Id);
                    continue;
                }
                int col = i % cols;
                int line = i / cols;
                var cellPos = new Vector3((col - (cols - 1) * 0.5f) * cell, ((nRows - 1) * 0.5f - line) * cell, 0f);
                var go = UnityEngine.Object.Instantiate(prefab, root.transform);
                go.name = "line_" + row.Id;
                Art.AdoptShaders(go);
                CatalogShade(go);
                go.transform.localRotation = Quaternion.Euler(-6f, 24f, 0f);
                go.transform.localScale = Vector3.one;
                float max = 1f;
                if (Art.MeshWorldBounds(go.transform, out var raw))
                    max = Mathf.Max(0.001f, Art.MaxAxis(raw.size));
                go.transform.localScale = Vector3.one * (target / max);
                go.transform.localPosition = cellPos;
                if (UnionRenderers(go, out var box))
                {
                    Vector3 center = root.transform.InverseTransformPoint(box.center);
                    go.transform.localPosition += new Vector3(cellPos.x - center.x, cellPos.y - center.y, 0f);
                }
                if (font == null || !UnionRenderers(go, out box)) continue;
                var label = new GameObject("label_" + row.Id);
                label.transform.SetParent(root.transform, true);
                label.transform.position = new Vector3(box.center.x, box.min.y - target * 0.08f, box.center.z);
                label.transform.rotation = Quaternion.Euler(0f, 180f, 0f);
                var text = label.AddComponent<TextMesh>();
                text.text = row.Id;
                text.font = font;
                text.fontSize = 24;
                text.characterSize = 0.018f;
                text.anchor = TextAnchor.UpperCenter;
                text.alignment = TextAlignment.Center;
                text.color = new Color(0.12f, 0.12f, 0.13f);
                var mr = label.GetComponent<MeshRenderer>();
                if (mr != null) mr.sharedMaterial = font.material;
            }
            var card = GameObject.CreatePrimitive(PrimitiveType.Quad);
            card.name = "lineupCard";
            card.transform.SetParent(root.transform, false);
            card.transform.localPosition = new Vector3(0f, 0f, -1.6f);
            card.transform.localRotation = Quaternion.identity;
            card.transform.localScale = new Vector3(cols * cell + 4f, nRows * cell + 3f, 1f);
            var colr = card.GetComponent<Collider>();
            if (colr != null) UnityEngine.Object.Destroy(colr);
            var cr = card.GetComponent<Renderer>();
            cr.sharedMaterial = Art.Mat(grey);
            cr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            AddLineupLight(root.transform, "lineupKey", new Color(1f, 0.98f, 0.94f), 7.5f, Quaternion.Euler(48f, -24f, 0f));
            AddLineupLight(root.transform, "lineupFill", new Color(0.86f, 0.90f, 1f), 3.6f, Quaternion.Euler(14f, 150f, 0f));
            // From the camera, brighter than the town sun, so this is the main light on the faces we see.
            AddLineupLight(root.transform, "lineupFront", new Color(1f, 0.99f, 0.97f), 9f, Quaternion.Euler(8f, 180f, 0f));
            AddLineupProbe(root.transform);
            float width = Mathf.Max(cell, (cols - 1) * cell + target);
            float height = Mathf.Max(cell, (nRows - 1) * cell + target * 1.35f);
            float fov = 26f;
            float aspect = cam != null && cam.aspect > 0.2f ? cam.aspect : 16f / 9f;
            float distH = (height * 0.55f) / Mathf.Tan(fov * 0.5f * Mathf.Deg2Rad);
            float hFov = 2f * Mathf.Atan(Mathf.Tan(fov * 0.5f * Mathf.Deg2Rad) * aspect) * Mathf.Rad2Deg;
            float distW = (width * 0.55f) / Mathf.Tan(hFov * 0.5f * Mathf.Deg2Rad);
            float dist = Mathf.Max(distH, distW);
            Vector3 look = root.transform.position;
            Vector3 camPos = look + new Vector3(0f, 0f, dist);
            if (cam != null)
            {
                cam.clearFlags = CameraClearFlags.SolidColor;
                cam.backgroundColor = grey;
                cam.fieldOfView = fov;
                var rot = Quaternion.LookRotation(look - camPos, Vector3.up);
                if (rig != null) rig.Lock(camPos, rot);
                else cam.transform.SetPositionAndRotation(camPos, rot);
            }
        }

        static void AddLineupLight(Transform root, string name, Color color, float intensity, Quaternion rotation)
        {
            var go = new GameObject(name);
            go.transform.SetParent(root, false);
            go.transform.rotation = rotation;
            var light = go.AddComponent<Light>();
            light.type = LightType.Directional;
            light.color = color;
            light.intensity = intensity;
            light.shadows = LightShadows.None;
            light.renderMode = LightRenderMode.ForcePixel;
        }

        /// <summary>
        /// A metal map of white zeros the diffuse term, so extra directional lights
        /// leave the mesh black. The catalog keeps the albedo and drops that map.
        /// </summary>
        static void CatalogShade(GameObject go)
        {
            if (go == null) return;
            foreach (var r in go.GetComponentsInChildren<Renderer>(true))
            {
                var mats = r.materials;
                for (int i = 0; i < mats.Length; i++)
                {
                    var m = mats[i];
                    if (m == null) continue;
                    m.DisableKeyword("_METALLICSPECGLOSSMAP");
                    if (m.HasProperty("_HasMetal")) m.SetFloat("_HasMetal", 0f);
                    if (m.HasProperty("_GltfPack")) m.SetFloat("_GltfPack", 0f);
                    if (m.HasProperty("_Metallic")) m.SetFloat("_Metallic", 0.08f);
                    if (m.HasProperty("_Smoothness")) m.SetFloat("_Smoothness", 0.34f);
                    if (m.HasProperty("_EnvironmentReflections")) m.SetFloat("_EnvironmentReflections", 1f);
                    if (m.HasProperty("_GlossyReflections")) m.SetFloat("_GlossyReflections", 1f);
                }
                r.materials = mats;
            }
        }

        static void AddLineupProbe(Transform root)
        {
            var go = new GameObject("lineupProbe");
            go.transform.SetParent(root, false);
            var probe = go.AddComponent<ReflectionProbe>();
            probe.mode = ReflectionProbeMode.Realtime;
            probe.refreshMode = ReflectionProbeRefreshMode.ViaScripting;
            probe.timeSlicingMode = ReflectionProbeTimeSlicingMode.NoTimeSlicing;
            probe.size = new Vector3(28f, 14f, 28f);
            probe.resolution = 64;
            probe.hdr = true;
            probe.boxProjection = true;
            probe.RenderProbe();
        }

        struct LineupLight
        {
            public AmbientMode mode;
            public Color ambient, sky, equator, ground;
            public float intensity, reflection;
            public DefaultReflectionMode reflectionMode;
            public Texture customReflection;
            public Material skybox;
            public bool fog;
            public bool hadExposure;
            public float exposure;
            public ColorAdjustments grade;

            public static LineupLight Push()
            {
                var snap = new LineupLight();
                snap.mode = RenderSettings.ambientMode;
                snap.ambient = RenderSettings.ambientLight;
                snap.sky = RenderSettings.ambientSkyColor;
                snap.equator = RenderSettings.ambientEquatorColor;
                snap.ground = RenderSettings.ambientGroundColor;
                snap.intensity = RenderSettings.ambientIntensity;
                snap.reflection = RenderSettings.reflectionIntensity;
                snap.reflectionMode = RenderSettings.defaultReflectionMode;
                snap.customReflection = CustomReflection();
                snap.skybox = RenderSettings.skybox;
                snap.fog = RenderSettings.fog;
                RenderSettings.fog = false;
                RenderSettings.ambientMode = AmbientMode.Trilight;
                RenderSettings.ambientSkyColor = new Color(0.86f, 0.87f, 0.88f);
                RenderSettings.ambientEquatorColor = new Color(0.80f, 0.80f, 0.82f);
                RenderSettings.ambientGroundColor = new Color(0.74f, 0.74f, 0.76f);
                RenderSettings.ambientLight = new Color(0.80f, 0.80f, 0.82f);
                RenderSettings.ambientIntensity = 1.15f;
                RenderSettings.defaultReflectionMode = DefaultReflectionMode.Custom;
                SetCustomReflection(BrightCube());
                RenderSettings.reflectionIntensity = 1.45f;
                DynamicGI.UpdateEnvironment();
                BoostExposure(ref snap, 0.85f);
                return snap;
            }

            public static void Pop(LineupLight snap)
            {
                RenderSettings.ambientMode = snap.mode;
                RenderSettings.ambientLight = snap.ambient;
                RenderSettings.ambientSkyColor = snap.sky;
                RenderSettings.ambientEquatorColor = snap.equator;
                RenderSettings.ambientGroundColor = snap.ground;
                RenderSettings.ambientIntensity = snap.intensity;
                RenderSettings.reflectionIntensity = snap.reflection;
                RenderSettings.defaultReflectionMode = snap.reflectionMode;
                SetCustomReflection(snap.customReflection);
                RenderSettings.skybox = snap.skybox;
                RenderSettings.fog = snap.fog;
                DynamicGI.UpdateEnvironment();
                if (snap.hadExposure && snap.grade != null)
                    snap.grade.postExposure.Override(snap.exposure);
            }

            static void BoostExposure(ref LineupLight snap, float stops)
            {
                var volume = UnityEngine.Object.FindFirstObjectByType<Volume>();
                var profile = volume != null ? volume.sharedProfile : null;
                if (profile == null || !profile.TryGet(out ColorAdjustments grade) || grade == null) return;
                snap.hadExposure = true;
                snap.grade = grade;
                snap.exposure = grade.postExposure.value;
                grade.postExposure.Override(snap.exposure + stops);
            }
        }

        static Cubemap brightCube;

        /// <summary>
        /// Unity 6 types the reflection slot as Texture (customReflectionTexture).
        /// The older property is a Cubemap, so a Texture cannot be written back into it.
        /// </summary>
        static Texture CustomReflection()
        {
#if UNITY_6000_0_OR_NEWER
            return RenderSettings.customReflectionTexture;
#else
            return RenderSettings.customReflection;
#endif
        }

        static void SetCustomReflection(Texture tex)
        {
#if UNITY_6000_0_OR_NEWER
            RenderSettings.customReflectionTexture = tex;
#else
            var cube = tex as Cubemap;
            if (tex == null || cube != null)
                RenderSettings.customReflection = cube;
#endif
        }

        static Cubemap BrightCube()
        {
            if (brightCube != null) return brightCube;
            brightCube = new Cubemap(16, TextureFormat.RGB24, false);
            var cols = new Color[16 * 16];
            for (int i = 0; i < cols.Length; i++) cols[i] = new Color(0.94f, 0.94f, 0.95f);
            for (int face = 0; face < 6; face++)
                brightCube.SetPixels(cols, (CubemapFace)face);
            brightCube.Apply();
            return brightCube;
        }

        /// <summary>Mean luminance of pixels that are not the backdrop and not the label ink.</summary>
        static float LineupLuminance()
        {
            var tex = ScreenCapture.CaptureScreenshotAsTexture();
            if (tex == null) return 0f;
            int w = tex.width;
            int h = tex.height;
            var pixels = tex.GetPixels32();
            UnityEngine.Object.Destroy(tex);
            if (pixels == null || pixels.Length < 16 || w < 2 || h < 2) return 0f;
            Color bg = CornerColor(pixels, w, h);
            double sum = 0;
            int n = 0;
            for (int i = 0; i < pixels.Length; i++)
            {
                float r = pixels[i].r / 255f;
                float g = pixels[i].g / 255f;
                float b = pixels[i].b / 255f;
                float dr = r - bg.r, dg = g - bg.g, db = b - bg.b;
                if (dr * dr + dg * dg + db * db < 0.008f) continue;
                if (Mathf.Max(r, Mathf.Max(g, b)) < 0.12f) continue;
                sum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
                n++;
            }
            return n < 32 ? 0f : (float)(sum / n);
        }

        static Color CornerColor(Color32[] pixels, int w, int h)
        {
            int[] ids =
            {
                0, w - 1, (h - 1) * w, (h - 1) * w + w - 1,
                w / 2, (h - 1) * w + w / 2
            };
            float r = 0f, g = 0f, b = 0f;
            int n = 0;
            for (int i = 0; i < ids.Length; i++)
            {
                int id = ids[i];
                if (id < 0 || id >= pixels.Length) continue;
                r += pixels[id].r;
                g += pixels[id].g;
                b += pixels[id].b;
                n++;
            }
            if (n == 0) return new Color(0.82f, 0.83f, 0.85f);
            return new Color(r / (255f * n), g / (255f * n), b / (255f * n));
        }

        static bool UnionRenderers(GameObject go, out Bounds box)
        {
            box = new Bounds(go.transform.position, Vector3.zero);
            bool any = false;
            foreach (var r in go.GetComponentsInChildren<Renderer>())
            {
                if (r == null || !r.enabled) continue;
                if (!any) { box = r.bounds; any = true; }
                else box.Encapsulate(r.bounds);
            }
            return any;
        }

        /// <summary>Three-quarter view from behind, so a back-mounted quiver is in frame.</summary>
        static void FrameRear(HeroActor actor, Camera cam, CameraRig rig)
        {
            if (cam == null || actor == null) return;
            Vector3 face = FaceDir(actor);
            Vector3 side = Vector3.Cross(Vector3.up, face);
            if (side.sqrMagnitude < 0.001f) side = Vector3.right;
            side.Normalize();
            Vector3 look = actor.Pos + Vector3.up * 1.15f;
            cam.fieldOfView = 28f;
            Vector3 camPos = look - face * 2.2f + side * 1.25f + Vector3.up * 0.28f;
            var rot = Quaternion.LookRotation(look - camPos, Vector3.up);
            if (rig != null) rig.Lock(camPos, rot);
            else cam.transform.SetPositionAndRotation(camPos, rot);
            PaperStage(actor, face, true);
            if (paperCard != null)
            {
                paperCard.transform.SetPositionAndRotation(
                    actor.Pos + face * 1.7f + Vector3.up * 1.05f,
                    Quaternion.LookRotation(-face, Vector3.up));
                paperCard.transform.localScale = new Vector3(8f, 5f, 1f);
            }
            PaperLight(actor, true, camPos, look);
        }

        /// <summary>Close three-quarter view of the shield face, from the front and the shield side.</summary>
        static void FrameShield34(HeroActor actor, Camera cam, CameraRig rig)
        {
            if (cam == null || actor == null) return;
            var propGo = GameObject.Find("gear_offhand");
            Transform prop = propGo != null ? propGo.transform : null;
            var arm = Art.Bone(actor.transform, "LeftForeArm");
            Vector3 center = prop != null ? prop.position : arm != null ? arm.position : actor.Pos + Vector3.up;
            Bounds box = new Bounds(center, Vector3.one * 0.35f);
            if (prop != null)
            {
                foreach (var r in prop.GetComponentsInChildren<Renderer>())
                {
                    if (r == null || !r.enabled) continue;
                    box.Encapsulate(r.bounds);
                }
            }
            Vector3 face = FaceDir(actor);
            Vector3 side = Vector3.Cross(face, Vector3.up);
            if (side.sqrMagnitude < 1e-4f) side = Vector3.right;
            side.Normalize();
            // Left hand is on +X when the hero faces +Z, which is -Cross(forward, up).
            Vector3 shieldSide = -side;
            Vector3 look = box.center;
            cam.fieldOfView = 22f;
            float radius = Mathf.Max(box.extents.magnitude, 0.28f);
            float dist = radius / Mathf.Tan(cam.fieldOfView * 0.5f * Mathf.Deg2Rad) + 0.15f;
            Vector3 camPos = look + (face * 0.75f + shieldSide * 0.65f).normalized * dist + Vector3.up * radius * 0.12f;
            var rot = Quaternion.LookRotation(look - camPos, Vector3.up);
            if (rig != null) rig.Lock(camPos, rot);
            else cam.transform.SetPositionAndRotation(camPos, rot);
        }

        /// <summary>Tight frame on the hand that holds a small weapon.</summary>
        static void FrameHand(HeroActor actor, Camera cam, CameraRig rig)
        {
            if (cam == null || actor == null) return;
            var propGo = GameObject.Find("gear_weapon") ?? GameObject.Find("gear_offhand");
            Transform prop = propGo != null ? propGo.transform : null;
            Transform hand = prop != null ? prop.parent : null;
            if (hand == null) hand = Art.Bone(actor.transform, "RightHand") ?? Art.Bone(actor.transform, "hand");
            if (hand == null) return;
            Bounds box = new Bounds(hand.position, Vector3.one * 0.1f);
            if (prop != null)
            {
                foreach (var r in prop.GetComponentsInChildren<Renderer>())
                {
                    if (r == null || !r.enabled) continue;
                    box.Encapsulate(r.bounds);
                }
            }
            Vector3 face = FaceDir(actor);
            Vector3 look = box.center;
            cam.fieldOfView = 22f;
            float radius = Mathf.Max(box.extents.magnitude, 0.1f);
            float dist = radius / Mathf.Tan(cam.fieldOfView * 0.5f * Mathf.Deg2Rad) + 0.06f;
            Vector3 camPos = look + face * dist + Vector3.up * radius * 0.12f;
            var rot = Quaternion.LookRotation(look - camPos, Vector3.up);
            if (rig != null) rig.Lock(camPos, rot);
            else cam.transform.SetPositionAndRotation(camPos, rot);
        }

        static void StandIdle(HeroActor actor)
        {
            if (actor == null) return;
            if (actor.Dead) actor.Revive(1f);
            if (actor.transform != null) actor.transform.localRotation = Quaternion.identity;
            GearAttach.PoseIdle(actor.transform);
            var ik = actor.GetComponentInChildren<OffHandIk>();
            if (ik != null) ik.Apply();
        }

        static void FrameGrip(HeroActor actor, Camera cam, CameraRig rig, bool main)
        {
            if (cam == null || actor == null) return;
            var right = Art.Bone(actor.transform, "RightHand") ?? Art.Bone(actor.transform, "hand");
            var left = Art.Bone(actor.transform, "LeftHand") ?? Art.Bone(actor.transform, "LeftForeArm");
            var prop = GameObject.Find("gear_weapon") ?? GameObject.Find("gear_offhand");
            bool any = false;
            Bounds box = new Bounds(actor.Pos + Vector3.up, Vector3.zero);
            if (right != null) { box = new Bounds(right.position, Vector3.one * 0.08f); any = true; }
            if (left != null)
            {
                if (!any) { box = new Bounds(left.position, Vector3.one * 0.08f); any = true; }
                else box.Encapsulate(left.position);
            }
            if (prop != null)
            {
                foreach (var r in prop.GetComponentsInChildren<Renderer>())
                {
                    if (r == null || !r.enabled) continue;
                    if (!any) { box = r.bounds; any = true; }
                    else box.Encapsulate(r.bounds);
                }
            }
            if (!any) return;
            Vector3 face = FaceDir(actor);
            Vector3 look = box.center;
            float radius = Mathf.Max(box.extents.magnitude, 0.25f);
            cam.fieldOfView = 32f;
            float dist = radius / Mathf.Tan(cam.fieldOfView * 0.5f * Mathf.Deg2Rad) + 0.35f;
            Vector3 camPos = look + face * dist + Vector3.up * radius * 0.15f;
            var rot = Quaternion.LookRotation(look - camPos, Vector3.up);
            if (rig != null) rig.Lock(camPos, rot);
            else cam.transform.SetPositionAndRotation(camPos, rot);
        }

        static bool WearWeapon(GameManager gm, string baseId)
        {
            var hero = gm.State.hero;
            hero.classless = true;
            hero.inventory.RemoveAll(it => it != null && it.kind == ItemKind.Equipment);
            for (int i = 0; i < (int)EquipSlot.Count; i++)
                hero.equipment[i] = null;
            var it = Loot.Generate(new Rng(5), 14, Rarity.Rare, null, null, baseId, 8);
            bool main = it != null && it.Base != null && it.Base.slot == ItemSlot.MainHand;
            if (it == null || !hero.AddItem(it) || !hero.Equip(it))
                Debug.LogError("Hollowmere gear FAIL could not equip " + baseId + " free=" + hero.FreeSlots);
            gm.OnEquipmentChanged();
            return main;
        }

        static void WearFamily(GameManager gm, (EquipSlot slot, string id)[] pieces, string family, int tier)
            => WearFamily(gm, pieces, family, tier, Rarity.Rare);

        static void WearFamily(GameManager gm, (EquipSlot slot, string id)[] pieces, string family, int tier, Rarity rarity)
        {
            var hero = gm.State.hero;
            hero.classless = true;
            hero.inventory.RemoveAll(it => it != null && it.kind == ItemKind.Equipment);
            for (int i = 0; i < (int)EquipSlot.Count; i++)
                hero.equipment[i] = null;
            var rng = new Rng(11);
            for (int i = 0; i < pieces.Length; i++)
            {
                var it = Loot.Generate(rng, 12, rarity, null, ItemSlotOf(pieces[i].slot), pieces[i].id, 8);
                if (it == null)
                {
                    Debug.LogError("Hollowmere gear FAIL could not equip " + pieces[i].id);
                    continue;
                }
                it.rarity = rarity;
                it.family = family;
                it.tier = tier;
                if (!hero.AddItem(it) || !hero.Equip(it))
                    Debug.LogError("Hollowmere gear FAIL could not equip " + pieces[i].id + " free=" + hero.FreeSlots);
            }
            gm.OnEquipmentChanged();
        }

        static (EquipSlot slot, string id) Piece((EquipSlot slot, string id)[] pieces, EquipSlot slot)
        {
            for (int i = 0; i < pieces.Length; i++)
                if (pieces[i].slot == slot) return pieces[i];
            return (slot, "helm");
        }

        static void Wear(GameManager gm, (EquipSlot slot, string id)[] pieces)
        {
            var hero = gm.State.hero;
            // Unequip puts the piece back in the bag. A mix run then fills all 30 slots
            // and Equip refuses because there is nowhere to put what comes off.
            hero.inventory.RemoveAll(it => it != null && it.kind == ItemKind.Equipment);
            for (int i = 0; i < GearFit.Visible.Length; i++)
                hero.equipment[(int)GearFit.Visible[i]] = null;
            var rng = new Rng(11);
            for (int i = 0; i < pieces.Length; i++)
            {
                var it = Loot.Generate(rng, 12, Rarity.Rare, null, ItemSlotOf(pieces[i].slot), pieces[i].id, 8);
                if (it != null)
                {
                    it.family = "plate";
                    it.tier = 3;
                }
                if (it == null || !hero.AddItem(it) || !hero.Equip(it))
                    Debug.LogError("Hollowmere gear FAIL could not equip " + pieces[i].id + " free=" + hero.FreeSlots);
            }
            gm.OnEquipmentChanged();
        }

        static ItemSlot ItemSlotOf(EquipSlot slot)
        {
            switch (slot)
            {
                case EquipSlot.Head: return ItemSlot.Head;
                case EquipSlot.Shoulders: return ItemSlot.Shoulders;
                case EquipSlot.Chest: return ItemSlot.Chest;
                case EquipSlot.Hands: return ItemSlot.Hands;
                case EquipSlot.Wrists: return ItemSlot.Wrists;
                case EquipSlot.Waist: return ItemSlot.Waist;
                case EquipSlot.Legs: return ItemSlot.Legs;
                default: return ItemSlot.Feet;
            }
        }

        static Light paperLight;
        static GameObject paperCard;
        static bool loggedFace;
        static readonly System.Collections.Generic.Dictionary<Light, float> paperDim = new System.Collections.Generic.Dictionary<Light, float>();

        /// <summary>Nose direction from the HeadFront bone, so the paper camera is not the follow cam.</summary>
        static Vector3 FaceDir(HeroActor actor)
        {
            var head = Art.Bone(actor.transform, "Head");
            var front = Art.Bone(actor.transform, "HeadFront");
            if (head != null && front != null)
            {
                var f = front.position - head.position;
                f.y = 0f;
                if (f.sqrMagnitude > 0.0004f) return f.normalized;
            }
            var fwd = actor.transform.forward;
            fwd.y = 0f;
            if (fwd.sqrMagnitude < 0.001f) fwd = Vector3.forward;
            return fwd.normalized;
        }

        /// <summary>Front view, closer than the full-body paper doll. Used for the hit flinch.</summary>
        static void FrameFront(HeroActor actor, Camera cam, CameraRig rig, float lookHeight, float dist, float fov)
        {
            if (cam == null || actor == null) return;
            Vector3 face = FaceDir(actor);
            Vector3 look = actor.Pos + Vector3.up * lookHeight;
            Vector3 camPos = look + face * dist + Vector3.up * 0.04f;
            cam.fieldOfView = fov;
            var rot = Quaternion.LookRotation(look - camPos, Vector3.up);
            if (rig != null) rig.Lock(camPos, rot);
            else cam.transform.SetPositionAndRotation(camPos, rot);
            PaperStage(actor, face, true);
            PaperLight(actor, true, camPos, look);
        }

        static void FrameGear(HeroActor actor, Camera cam, CameraRig rig, bool paper)
        {
            if (cam == null || actor == null) return;
            Vector3 face = FaceDir(actor);
            const float height = 1.85f;
            Vector3 look = actor.Pos + Vector3.up * (paper ? height * 0.48f : 1.05f);
            float fov = paper ? 28f : 38f;
            // Full body, helm included. The old 24° lens aimed at the chest cut the forehead off.
            float dist = paper ? (height * 0.64f) / Mathf.Tan(fov * 0.5f * Mathf.Deg2Rad) : 7.2f;
            Vector3 camPos = paper
                ? look + face * dist + Vector3.up * 0.08f
                : actor.Pos - face * dist + Vector3.up * 5.6f;
            if (paper && !loggedFace)
            {
                loggedFace = true;
                Debug.Log("Hollowmere gear paper face " + face.ToString("0.00") + " dist " + dist.ToString("0.00"));
            }
            cam.fieldOfView = fov;
            var rot = Quaternion.LookRotation(look - camPos, Vector3.up);
            if (rig != null) rig.Lock(camPos, rot);
            else cam.transform.SetPositionAndRotation(camPos, rot);
            PaperStage(actor, face, paper);
            PaperLight(actor, paper, camPos, look);
        }

        static void PaperStage(HeroActor actor, Vector3 face, bool on)
        {
            if (UiRoot.I != null && UiRoot.I.Hud != null) UiRoot.I.Hud.gameObject.SetActive(!on);
            if (PetActor.I != null) PetActor.I.gameObject.SetActive(!on);
            if (!on)
            {
                if (paperCard != null) paperCard.SetActive(false);
                return;
            }
            if (paperCard == null)
            {
                paperCard = GameObject.CreatePrimitive(PrimitiveType.Quad);
                paperCard.name = "paperCard";
                var col = paperCard.GetComponent<Collider>();
                if (col != null) UnityEngine.Object.Destroy(col);
                var rend = paperCard.GetComponent<Renderer>();
                rend.sharedMaterial = Art.Mat(new Color(0.17f, 0.16f, 0.15f));
                rend.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                rend.receiveShadows = false;
            }
            paperCard.SetActive(true);
            paperCard.transform.SetPositionAndRotation(
                actor.Pos - face * 1.15f + Vector3.up * 0.95f,
                Quaternion.LookRotation(face, Vector3.up));
            paperCard.transform.localScale = new Vector3(8f, 4.8f, 1f);
        }

        static void PaperLight(HeroActor actor, bool on, Vector3 camPos, Vector3 look)
        {
            if (on)
            {
                if (paperLight == null)
                {
                    var go = new GameObject("paperLight");
                    paperLight = go.AddComponent<Light>();
                    paperLight.type = LightType.Directional;
                    paperLight.shadows = LightShadows.None;
                    paperLight.color = new Color(1f, 0.985f, 0.96f);
                    paperLight.intensity = 1.15f;
                }
                paperLight.gameObject.SetActive(true);
                Vector3 side = Vector3.Cross(Vector3.up, look - camPos);
                paperLight.transform.rotation = Quaternion.LookRotation((look - camPos) + Vector3.up * -0.45f + side.normalized * 0.65f, Vector3.up);
                paperLight.intensity = 0.9f;
                var lights = actor.GetComponentsInChildren<Light>(true);
                for (int i = 0; i < lights.Length; i++)
                {
                    if (lights[i] == null || lights[i] == paperLight) continue;
                    if (!paperDim.ContainsKey(lights[i])) paperDim[lights[i]] = lights[i].intensity;
                    lights[i].intensity = paperDim[lights[i]] * 0.12f;
                    lights[i].color = new Color(1f, 0.98f, 0.96f);
                }
            }
            else if (paperLight != null)
            {
                paperLight.gameObject.SetActive(false);
                foreach (var pair in paperDim)
                    if (pair.Key != null) pair.Key.intensity = pair.Value;
            }
        }

        static string FirstPose(string[] names, string[] group)
        {
            if (names == null || group == null) return null;
            for (int g = 0; g < group.Length; g++)
                for (int i = 0; i < names.Length; i++)
                    if (GearFit.PoseMatch(names[i], group[g])) return names[i];
            return null;
        }

        static void Sample(Animation anim, string clip, float unit)
        {
            if (anim == null) return;
            AnimationState st = null;
            foreach (AnimationState s in anim)
                if (s != null && s.name == clip) { st = s; break; }
            if (st == null || st.clip == null) return;
            foreach (AnimationState s in anim)
            {
                s.weight = 0f;
                s.enabled = false;
            }
            st.enabled = true;
            st.weight = 1f;
            st.speed = 1f;
            st.time = Mathf.Max(0.05f, st.length) * Mathf.Clamp01(unit);
            anim.Sample();
            st.speed = 0f;
        }

        public static IEnumerator RunMonsterMode(GameManager gm, string mode)
        {
            if (mode != "monsteranim" && mode != "monsterdeath" && mode != "skelclose" && mode != "propclose")
            {
                Debug.LogError("Hollowmere QA frames: unknown mode " + mode);
                Application.Quit();
                yield break;
            }
            yield return MonsterModes(gm, mode);
        }

        static IEnumerator MonsterModes(GameManager gm, string mode)
        {
            var f = Feel.Active;
            gm.State = GameState.NewGame(HeroClass.Hexweaver, "Qa", PetSpecies.Hound, "Moss", 1);
            gm.EnterTown(false);
            yield return new WaitForSeconds(0.5f);
            Screen.SetResolution(f.width, f.height, FullScreenMode.Windowed);
            yield return null;
            // Close-ups. The town, its lights, and soft shadows were the cost that ran monsteranim out of time.
            CheapMonsterStage();
            var origin = HeroActor.I != null ? HeroActor.I.Pos : Vector3.zero;
            origin.y = 0f;
            if (HeroActor.I != null) HeroActor.I.transform.position = origin + Vector3.right * 30f;
            if (mode == "skelclose")
                yield return SkelClose(origin);
            else if (mode == "monsterdeath")
                yield return MonsterDeath(origin);
            else if (mode == "propclose")
                yield return PropClose(origin);
            else
                yield return MonsterAnim(origin);
            Application.Quit();
        }

        /// <summary>Drop the town mesh, point lights, and shadow maps. The shot is one monster.</summary>
        static void CheapMonsterStage()
        {
            var cam = Camera.main;
            if (cam != null)
            {
                cam.clearFlags = CameraClearFlags.SolidColor;
                cam.backgroundColor = new Color(0.13f, 0.12f, 0.11f);
            }
            int hidden = 0;
            int lights = 0;
            if (World.Root != null)
            {
                var renderers = World.Root.GetComponentsInChildren<Renderer>(true);
                for (int i = 0; i < renderers.Length; i++)
                {
                    if (renderers[i] == null) continue;
                    renderers[i].enabled = false;
                    hidden++;
                }
                var lits = World.Root.GetComponentsInChildren<Light>(true);
                for (int i = 0; i < lits.Length; i++)
                {
                    if (lits[i] == null) continue;
                    if (lits[i].type == LightType.Directional)
                    {
                        lits[i].shadows = LightShadows.None;
                        continue;
                    }
                    lits[i].enabled = false;
                    lights++;
                }
            }
            Debug.Log("Hollowmere QA monster stage hid " + hidden + " town renderers, " + lights + " lights");
        }

        static IEnumerator MonsterAnim(Vector3 origin)
        {
            string[] clips = { "walk", "attack", "hit", "death" };
            int shot = 0;
            for (int m = 0; m < MonsterKeys.Length; m++)
            {
                var go = Art.Animated(MonsterKeys[m], 1.8f, null);
                if (go == null)
                {
                    Debug.LogError("Hollowmere QA monster missing " + MonsterKeys[m]);
                    continue;
                }
                go.transform.position = origin + new Vector3(0f, 0f, 4.2f);
                go.transform.rotation = Quaternion.LookRotation(Vector3.back);
                var skins = go.GetComponentsInChildren<Renderer>(true);
                for (int i = 0; i < skins.Length; i++)
                    if (skins[i] != null) skins[i].shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                FrameMonster(go, 1.3f, 4.6f);
                for (int c = 0; c < clips.Length; c++)
                {
                    for (int s = 0; s < 3; s++)
                    {
                        SampleMonster(go, clips[c], s / 2f);
                        var floater = go.GetComponent<WraithFloat>();
                        if (floater != null) floater.Pin(true);
                        yield return new WaitForEndOfFrame();
                        SaveNamed("monsteranim-" + MonsterKeys[m] + "-" + clips[c] + "-" + s);
                        shot++;
                    }
                }
                UnityEngine.Object.Destroy(go);
            }
            Debug.Log("Hollowmere QA monsteranim frames " + shot);
        }

        static IEnumerator MonsterDeath(Vector3 origin)
        {
            var floor = GameObject.CreatePrimitive(PrimitiveType.Plane);
            floor.name = "deathFloor";
            floor.transform.position = origin + new Vector3(0f, 0f, 4.2f);
            floor.transform.localScale = new Vector3(2.2f, 1f, 2.2f);
            var floorCol = floor.GetComponent<Collider>();
            if (floorCol != null) UnityEngine.Object.Destroy(floorCol);
            var floorR = floor.GetComponent<Renderer>();
            if (floorR != null)
            {
                floorR.sharedMaterial = Art.Mat(new Color(0.24f, 0.22f, 0.19f));
                floorR.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            }
            for (int m = 0; m < MonsterKeys.Length; m++)
            {
                var go = Art.Animated(MonsterKeys[m], 1.8f, null);
                if (go == null) continue;
                go.transform.position = origin + new Vector3(0f, 0f, 4.2f);
                go.transform.rotation = Quaternion.LookRotation(Vector3.back);
                yield return null;
                float livingAxis = 0f;
                float livingMin = 0f;
                if (Art.UnionBounds(go, out var live))
                {
                    livingAxis = Mathf.Max(live.size.x, Mathf.Max(live.size.y, live.size.z));
                    livingMin = Mathf.Min(live.size.x, Mathf.Min(live.size.y, live.size.z));
                }
                foreach (var hover in go.GetComponentsInChildren<BatHover>(true))
                    hover.enabled = false;
                var lay = go.AddComponent<DeathLay>();
                lay.livingAxis = livingAxis;
                SampleMonster(go, "death", 0.85f);
                float wait = 0f;
                while (!lay.Done && wait < 2.2f)
                {
                    wait += Time.deltaTime;
                    if (wait > 0.35f && Mathf.Abs(wait - 0.7f) < Time.deltaTime)
                    {
                        FrameCorpse(go);
                        yield return new WaitForEndOfFrame();
                        SaveNamed("monsterdeath-" + MonsterKeys[m] + "-mid");
                    }
                    yield return null;
                }
                FrameCorpse(go);
                yield return new WaitForEndOfFrame();
                SaveNamed("monsterdeath-" + MonsterKeys[m] + "-flat");
                bool flat = Mathf.Abs(go.transform.up.y) < 0.4f;
                bool onFloor = false;
                if (Art.UnionBounds(go, out var b))
                {
                    // A body whose living box is already tall or thick cannot lie under 0.95 m without a scale hack.
                    bool bulky = livingAxis >= 2f || livingMin >= 0.8f;
                    onFloor = b.min.y < 0.25f && b.min.y > -0.35f && (bulky || b.size.y < 0.95f);
                    float corpseAxis = Mathf.Max(b.size.x, Mathf.Max(b.size.y, b.size.z));
                    float ratio = livingAxis > 0.05f ? corpseAxis / livingAxis : 0f;
                    Debug.Log("Hollowmere QA death " + MonsterKeys[m]
                        + " up=" + go.transform.up.ToString("0.00")
                        + " size=" + b.size.ToString("0.00")
                        + " minY=" + b.min.y.ToString("0.00")
                        + " living=" + livingAxis.ToString("0.00")
                        + " ratio=" + ratio.ToString("0.00")
                        + (bulky ? " bulky" : ""));
                    if (ratio < 0.4f || ratio > 2.5f)
                        Debug.LogError("Hollowmere QA death " + MonsterKeys[m]
                            + " FAIL corpse scale " + ratio.ToString("0.00") + "x living");
                }
                if (!flat || !onFloor)
                    Debug.LogError("Hollowmere QA death " + MonsterKeys[m] + " FAIL not flat on the floor");
                UnityEngine.Object.Destroy(go);
            }
        }

        static IEnumerator SkelClose(Vector3 origin)
        {
            var go = Art.Animated("hm_skel_warrior", 1.8f, null);
            if (go == null)
            {
                Debug.LogError("Hollowmere QA skelclose missing warrior");
                yield break;
            }
            go.transform.position = origin + new Vector3(0f, 0f, 3.2f);
            go.transform.rotation = Quaternion.LookRotation(Vector3.back);
            SampleMonster(go, "idle", 0.2f);
            yield return new WaitForEndOfFrame();
            var hand = Art.Bone(go.transform, "RightHand");
            var look = hand != null ? hand.position : go.transform.position + Vector3.up * 1.15f;
            var camPos = look + go.transform.forward * 1.7f + Vector3.up * 0.25f;
            var cam = Camera.main;
            if (cam != null)
            {
                cam.fieldOfView = 28f;
                var rig = cam.GetComponent<CameraRig>();
                if (rig != null)
                    rig.Lock(camPos, Quaternion.LookRotation(look - camPos, Vector3.up));
            }
            yield return new WaitForEndOfFrame();
            var swordT = FindNamed(go.transform, "hm_rusty_sword");
            var shieldT = FindNamed(go.transform, "hm_rusty_shield");
            if (swordT == null || shieldT == null)
                Debug.LogError("Hollowmere QA skelclose FAIL missing sword or shield");
            else
            {
                var rh = Art.Bone(go.transform, "RightHand");
                var arm = Art.Bone(go.transform, "LeftForeArm");
                float sd = rh != null ? Vector3.Distance(swordT.position, rh.position) : 99f;
                float hd = arm != null ? Vector3.Distance(shieldT.position, arm.position) : 99f;
                Debug.Log("Hollowmere QA skelclose sword=" + (sd * 100f).ToString("0.0") + "cm shield=" + (hd * 100f).ToString("0.0") + "cm");
                if (sd > 0.05f || hd > 0.05f)
                    Debug.LogError("Hollowmere QA skelclose FAIL prop off the bone");
            }
            SaveNamed("skelclose");
            UnityEngine.Object.Destroy(go);
        }

        static Transform FindNamed(Transform root, string name)
        {
            if (root.name == name || root.name.StartsWith(name)) return root;
            for (int i = 0; i < root.childCount; i++)
            {
                var hit = FindNamed(root.GetChild(i), name);
                if (hit != null) return hit;
            }
            return null;
        }

        /// <summary>Aim at the corpse bounds so a wide, low body such as the bat stays in frame.</summary>
        static void FrameCorpse(GameObject go)
        {
            var cam = Camera.main;
            if (cam == null) return;
            cam.fieldOfView = 32f;
            Vector3 look;
            float distance;
            if (Art.UnionBounds(go, out var b) && b.size.sqrMagnitude > 0.0004f)
            {
                look = b.center;
                float span = Mathf.Max(b.size.x, Mathf.Max(b.size.y, b.size.z));
                distance = Mathf.Clamp(span * 2.2f, 1.8f, 9f);
            }
            else
            {
                look = go.transform.position + Vector3.up * 0.4f;
                distance = 5.4f;
            }
            var camPos = look + Vector3.back * distance + Vector3.up * (distance * 0.18f);
            var rig = cam.GetComponent<CameraRig>();
            if (rig != null)
                rig.Lock(camPos, Quaternion.LookRotation(look - camPos, Vector3.up));
        }

        static void FrameMonster(GameObject go, float lookHeight, float distance)
        {
            var look = go.transform.position + Vector3.up * lookHeight;
            var camPos = look + Vector3.back * distance + Vector3.up * 0.4f;
            var cam = Camera.main;
            if (cam == null) return;
            cam.fieldOfView = 32f;
            var rig = cam.GetComponent<CameraRig>();
            if (rig != null)
                rig.Lock(camPos, Quaternion.LookRotation(look - camPos, Vector3.up));
        }

        static IEnumerator PropClose(Vector3 origin)
        {
            var warrior = Art.Animated("hm_skel_warrior", 1.8f, null);
            if (warrior != null)
            {
                warrior.transform.position = origin + new Vector3(-2.2f, 0f, 4f);
                warrior.transform.rotation = Quaternion.LookRotation(Vector3.back);
            }
            var king = Art.Animated("hm_ossuary_king", 1.8f, null);
            if (king != null)
            {
                king.transform.position = origin + new Vector3(2.4f, 0f, 4f);
                king.transform.rotation = Quaternion.LookRotation(Vector3.back);
            }
            yield return new WaitForEndOfFrame();
            string[] names =
            {
                "hm_rusty_shield", "prop_mystic_staff", "prop_merchant_backpack",
                "prop_jeweler_loupe", "prop_jeweler_tools", "prop_curio_trinkets",
                "hm_king_pauldron_left", "hm_king_pauldron_right", "hm_king_ribcage",
                "hm_king_crown_spikes", "king_mace",
            };
            for (int i = 0; i < names.Length; i++)
            {
                Transform search = warrior != null ? warrior.transform : king != null ? king.transform : null;
                var prop = search != null ? FindNamed(search, names[i]) : null;
                if (prop == null)
                {
                    foreach (var root in UnityEngine.Object.FindObjectsByType<Transform>(FindObjectsSortMode.None))
                    {
                        if (root.name == names[i] || root.name.StartsWith(names[i]))
                        {
                            prop = root;
                            break;
                        }
                    }
                }
                if (prop == null)
                {
                    Debug.LogError("Hollowmere QA propclose missing " + names[i]);
                    continue;
                }
                if (!Art.MeshWorldBounds(prop, out var b))
                    b = new Bounds(prop.position, Vector3.one * 0.2f);
                var look = b.center;
                var camPos = look + Vector3.back * Mathf.Max(0.8f, b.size.magnitude) + Vector3.up * 0.15f;
                var cam = Camera.main;
                if (cam != null)
                {
                    cam.fieldOfView = 28f;
                    var rig = cam.GetComponent<CameraRig>();
                    if (rig != null)
                        rig.Lock(camPos, Quaternion.LookRotation(look - camPos, Vector3.up));
                }
                yield return new WaitForEndOfFrame();
                SaveNamed("propclose-" + names[i]);
                Debug.Log("Hollowmere QA propclose " + names[i] + " center=" + b.center.ToString("0.00") + " size=" + b.size.ToString("0.00"));
            }
            if (warrior != null) UnityEngine.Object.Destroy(warrior);
            if (king != null) UnityEngine.Object.Destroy(king);
        }

        static void SampleMonster(GameObject go, string clip, float unit)
        {
            var anim = go.GetComponentInChildren<Animation>();
            if (anim == null)
            {
                Debug.Log("Hollowmere QA " + go.name + " " + clip + " no animation");
                return;
            }
            AnimationState st = null;
            foreach (AnimationState s in anim)
            {
                string n = s.name.ToLowerInvariant();
                if (n == clip || n.EndsWith("|" + clip) || n.EndsWith(clip))
                {
                    st = s;
                    break;
                }
            }
            if (st == null || st.clip == null)
            {
                Debug.Log("Hollowmere QA " + go.name + " " + clip + " no clip");
                return;
            }
            foreach (AnimationState s in anim)
            {
                s.weight = 0f;
                s.enabled = false;
            }
            st.enabled = true;
            st.weight = 1f;
            st.time = Mathf.Max(0.05f, st.length) * Mathf.Clamp01(unit);
            anim.Sample();
        }

        static void SaveNamed(string name)
        {
            var tex = ScreenCapture.CaptureScreenshotAsTexture();
            var path = Path.Combine(Directory.GetCurrentDirectory(), "qa-" + name + ".png");
            try
            {
                File.WriteAllBytes(path, tex.EncodeToPNG());
                Debug.Log("Hollowmere QA frame saved: " + path);
            }
            catch (Exception e)
            {
                Debug.LogError("Hollowmere QA frame failed: " + e.Message);
            }
            UnityEngine.Object.Destroy(tex);
        }

        static IEnumerator TelegraphFrames(GameManager gm)
        {
            var f = Feel.Active;
            gm.State = GameState.NewGame(HeroClass.Hexweaver, "Qa", PetSpecies.Hound, "Moss", 1);
            gm.EnterTown(false);
            yield return new WaitForSeconds(0.4f);
            Screen.SetResolution(f.width, f.height, FullScreenMode.Windowed);
            yield return null;
            CheapMonsterStage();
            var origin = HeroActor.I != null ? HeroActor.I.Pos : Vector3.zero;
            origin.y = 0f;
            if (HeroActor.I != null) HeroActor.I.transform.position = origin + Vector3.right * 40f;
            int fails = 0;
            TelegraphBook.Audit(msg =>
            {
                fails++;
                Debug.LogError("Hollowmere QA telegraph FAIL " + msg);
            });
            if (fails == 0) Debug.Log("Hollowmere QA telegraph audit ok");
            var floor = GameObject.CreatePrimitive(PrimitiveType.Plane);
            floor.name = "telegraphFloor";
            floor.transform.position = origin;
            floor.transform.localScale = new Vector3(1.6f, 1f, 1.6f);
            var floorCol = floor.GetComponent<Collider>();
            if (floorCol != null) UnityEngine.Object.Destroy(floorCol);
            var floorR = floor.GetComponent<Renderer>();
            if (floorR != null)
            {
                floorR.sharedMaterial = Art.Mat(new Color(0.16f, 0.15f, 0.14f));
                floorR.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            }
            string[] shapes = { "cone", "line", "ring", "rune" };
            string[] ids = { "bonewalker", "boneslinger", "stonehulk", "bogshaman" };
            TelegraphShape[] expect = { TelegraphShape.Cone, TelegraphShape.Line, TelegraphShape.Ring, TelegraphShape.Rune };
            float[] fills = { 0f, 0.5f, 1f };
            var cam = Camera.main;
            var look = origin + Vector3.forward * 1.5f + Vector3.up * 0.7f;
            var camPos = origin + new Vector3(-2.6f, 5.2f, -5.1f);
            if (cam != null)
            {
                cam.fieldOfView = 36f;
                var rig = cam.GetComponent<CameraRig>();
                var rot = Quaternion.LookRotation(look - camPos, Vector3.up);
                if (rig != null) rig.Lock(camPos, rot);
                else cam.transform.SetPositionAndRotation(camPos, rot);
            }
            int shots = 0;
            for (int s = 0; s < shapes.Length; s++)
            {
                var mon = MonsterDb.Get(ids[s]);
                var ms = MonsterDb.Create(mon, 8, MonsterRank.Normal, new Rng(4), 3);
                var actor = MonsterActor.Spawn(ms, origin, 1);
                actor.transform.rotation = Quaternion.LookRotation(Vector3.forward);
                var tg = TelegraphBook.ForMonster(ids[s]);
                if (tg == null || !TelegraphBook.Shaped(tg) || tg.shape != expect[s])
                    Debug.LogError("Hollowmere QA telegraph FAIL " + ids[s] + " uses the default circle");
                var anim = actor.GetComponentInChildren<ModelAnim>();
                if (anim != null)
                {
                    bool cast = expect[s] == TelegraphShape.Rune || expect[s] == TelegraphShape.Line;
                    anim.BeginAttack(cast, 1.4f);
                    if (tg != null) anim.SetLeadIn(tg.windupSpeed);
                    anim.Tick(0f, 0.04f);
                }
                var body = TelegraphBody.Arm(actor, tg, 3f, ms.def.element);
                var mark = TelegraphMark.Place(tg, actor.Pos, Vector3.forward, 3f, ms.def.element);
                if (mark == null || mark.shape != expect[s])
                    Debug.LogError("Hollowmere QA telegraph FAIL " + shapes[s] + " mark is not a shaped TelegraphDef");
                for (int i = 0; i < fills.Length; i++)
                {
                    if (mark != null) mark.SetFill(fills[i]);
                    if (body != null) body.SetSwing(fills[i]);
                    yield return new WaitForEndOfFrame();
                    bool wind = anim != null && anim.Attacking;
                    Debug.Log("Hollowmere QA telegraph " + shapes[s]
                        + " fill=" + fills[i].ToString("0.00")
                        + " shape=" + (mark != null ? mark.shape.ToString() : "circle")
                        + " windup=" + wind
                        + " glow=" + (body != null && body.Armed));
                    if (!wind) Debug.LogError("Hollowmere QA telegraph FAIL " + shapes[s] + " has no wind-up");
                    if (mark == null || mark.shape != expect[s])
                        Debug.LogError("Hollowmere QA telegraph FAIL " + shapes[s] + " uses the default circle");
                    LogWindupRead(actor, shapes[s]);
                    Save("telegraphs-" + shapes[s], i);
                    shots++;
                }
                if (mark != null)
                {
                    mark.transform.position += Vector3.right * 80f;
                    UnityEngine.Object.Destroy(mark.gameObject);
                }
                actor.transform.position += Vector3.right * 80f;
                UnityEngine.Object.Destroy(actor.gameObject);
            }
            Debug.Log("Hollowmere QA frames saved: " + shots + " telegraphs");
            Application.Quit();
        }

        /// <summary>The wind-up must leave the albedo readable. A flat white body fails.</summary>
        static void LogWindupRead(MonsterActor actor, string shape)
        {
            var tex = ScreenCapture.CaptureScreenshotAsTexture();
            if (tex == null || actor == null) return;
            if (!BodySampleRect(actor, tex.width, tex.height, out int x0, out int y0, out int x1, out int y1))
            {
                Debug.LogError("Hollowmere QA telegraph FAIL " + shape + " wind-up has no body pixels");
                UnityEngine.Object.Destroy(tex);
                return;
            }
            double sum = 0, sumSq = 0;
            int count = 0;
            for (int y = y0; y < y1; y += 2)
            {
                for (int x = x0; x < x1; x += 2)
                {
                    var c = tex.GetPixel(x, y);
                    double l = c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722;
                    sum += l;
                    sumSq += l * l;
                    count++;
                }
            }
            UnityEngine.Object.Destroy(tex);
            if (count < 16)
            {
                Debug.LogError("Hollowmere QA telegraph FAIL " + shape + " wind-up sample is empty");
                return;
            }
            double mean = sum / count;
            double var = sumSq / count - mean * mean;
            if (var < 0) var = 0;
            Debug.Log("Hollowmere QA telegraph " + shape + " luma=" + mean.ToString("0.000") + " var=" + var.ToString("0.0000"));
            if (mean > 0.68 || (mean > 0.50 && var < 0.0025))
                Debug.LogError("Hollowmere QA telegraph FAIL " + shape + " wind-up flat white luma="
                    + mean.ToString("0.00") + " var=" + var.ToString("0.0000"));
        }

        static bool BodySampleRect(MonsterActor actor, int width, int height, out int x0, out int y0, out int x1, out int y1)
        {
            x0 = y0 = x1 = y1 = 0;
            var cam = Camera.main;
            if (cam == null || actor == null) return false;
            bool any = false;
            Bounds b = default;
            foreach (var r in actor.GetComponentsInChildren<Renderer>(true))
            {
                if (r == null) continue;
                if (!(r is MeshRenderer) && !(r is SkinnedMeshRenderer)) continue;
                string n = r.gameObject.name;
                if (n == "label" || n == "telegraph") continue;
                if (n.IndexOf("glow", System.StringComparison.OrdinalIgnoreCase) >= 0) continue;
                if (n.IndexOf("charge", System.StringComparison.OrdinalIgnoreCase) >= 0) continue;
                if (n.IndexOf("Trail", System.StringComparison.Ordinal) >= 0) continue;
                if (!any) { b = r.bounds; any = true; }
                else b.Encapsulate(r.bounds);
            }
            if (!any || b.size.sqrMagnitude < 0.01f) return false;
            int minX = width, minY = height, maxX = 0, maxY = 0;
            var ext = b.extents;
            var c = b.center;
            for (int iz = -1; iz <= 1; iz += 2)
                for (int iy = -1; iy <= 1; iy += 2)
                    for (int ix = -1; ix <= 1; ix += 2)
                    {
                        var w = c + Vector3.Scale(ext, new Vector3(ix, iy, iz));
                        var vp = cam.WorldToViewportPoint(w);
                        if (vp.z <= 0f) continue;
                        int px = Mathf.Clamp((int)(vp.x * width), 0, width - 1);
                        int py = Mathf.Clamp((int)(vp.y * height), 0, height - 1);
                        if (px < minX) minX = px;
                        if (py < minY) minY = py;
                        if (px > maxX) maxX = px;
                        if (py > maxY) maxY = py;
                    }
            if (maxX <= minX || maxY <= minY) return false;
            int bw = maxX - minX;
            int bh = maxY - minY;
            x0 = minX + bw / 5;
            x1 = maxX - bw / 5;
            y0 = minY + bh / 3;
            y1 = maxY - bh / 12;
            if (x1 <= x0 + 4 || y1 <= y0 + 4) return false;
            return true;
        }

        static IEnumerator CombatFeelFrames(GameManager gm)
        {
            var f = Feel.Active;
            var profile = CombatFeelProfile.Active;
            gm.State = GameState.NewGame(HeroClass.Hexweaver, "Qa", PetSpecies.Hound, "Moss", 1);
            gm.EnterTown(false);
            yield return new WaitForSeconds(0.45f);
            Screen.SetResolution(f.width, f.height, FullScreenMode.Windowed);
            yield return null;
            var hero = HeroActor.I;
            Vector3 origin = hero != null ? hero.Pos : Vector3.zero;
            origin.y = 0f;
            if (hero != null) hero.transform.position = origin + Vector3.right * 18f;
            int critMs = profile != null ? profile.critStopMs : DesignTable.HitStopMs("crit");
            int killMs = profile != null ? profile.killStopMs : DesignTable.HitStopMs("kill");
            int kick = profile != null ? profile.kickMm : DesignTable.ShakeMm("crit");
            Debug.Log("Hollowmere QA combatfeel stop crit=" + critMs + " kill=" + killMs + " kickMm=" + kick);
            if (critMs < 40 || critMs > 80 || killMs < 40 || killMs > 80)
                Debug.LogError("Hollowmere QA combatfeel FAIL hit-stop outside 40-80 ms");
            if (kick > 25)
                Debug.LogError("Hollowmere QA combatfeel FAIL kick " + kick + "mm");
            var def = MonsterDb.Get("bonewalker");
            var ms = MonsterDb.Create(def, 8, MonsterRank.Normal, new Rng(4), 3);
            ms.maxLife = 800f;
            var monster = MonsterActor.Spawn(ms, origin + new Vector3(0f, 0f, 3.6f), 1);
            monster.life = monster.maxLife = 800f;
            monster.transform.rotation = Quaternion.LookRotation(Vector3.back);
            var look = monster.Pos + Vector3.up * 1.3f;
            var cam = Camera.main;
            if (cam != null)
            {
                cam.fieldOfView = 32f;
                var rig = cam.GetComponent<CameraRig>();
                if (rig != null)
                    rig.Lock(look + Vector3.back * 4.2f + Vector3.up * 0.6f, Quaternion.LookRotation(look - (look + Vector3.back * 4.2f + Vector3.up * 0.6f), Vector3.up));
            }
            yield return new WaitForEndOfFrame();
            Save("combatfeel", 0);
            monster.TakeDamage(new Hit { amount = 86f, crit = true, element = Element.Physical }, null);
            CombatClock.Punch("crit");
            // Sample before yielding. One QA frame of scaled time is longer than the 60 ms stop,
            // so a check after yield return null always saw the window already closed.
            bool frozen = CombatClock.Frozen && Time.timeScale < 0.05f;
            float windowEnd = Time.unscaledTime + critMs / 1000f;
            float sampleAt = Time.unscaledTime + 0.030f;
            while (Time.unscaledTime < sampleAt && Time.unscaledTime < windowEnd)
                yield return null;
            // A long QA frame can step past the stop. Only the sample that lands inside it counts.
            if (Time.unscaledTime < windowEnd)
                frozen = frozen && CombatClock.Frozen && Time.timeScale < 0.05f;
            yield return null;
            bool number = false;
            foreach (var tm in UnityEngine.Object.FindObjectsByType<TextMesh>(FindObjectsSortMode.None))
                if (tm != null && (tm.gameObject.name == "ftext" || tm.gameObject.name == "dmg")) number = true;
            foreach (var tr in UnityEngine.Object.FindObjectsByType<Transform>(FindObjectsSortMode.None))
                if (tr != null && tr.name == "dmg") number = true;
            var flash = monster.GetComponent<HitFlash>();
            Debug.Log("Hollowmere QA combatfeel number=" + number + " flash=" + (flash != null) + " frozen=" + frozen + " scale=" + Time.timeScale.ToString("0.0000"));
            if (!number) Debug.LogError("Hollowmere QA combatfeel FAIL no damage number");
            if (flash == null) Debug.LogError("Hollowmere QA combatfeel FAIL no hit flash");
            if (!frozen) Debug.LogError("Hollowmere QA combatfeel FAIL hit-stop did not freeze");
            for (int i = 1; i <= 6; i++)
            {
                yield return new WaitForEndOfFrame();
                Save("combatfeel", i);
            }
            Debug.Log("Hollowmere QA frames saved: 7 combatfeel");
            Application.Quit();
        }

        static void Save(string mode, int index)
        {
            var tex = ScreenCapture.CaptureScreenshotAsTexture();
            var path = Path.Combine(Directory.GetCurrentDirectory(), "qa-" + mode + "-" + index.ToString("00") + ".png");
            try
            {
                File.WriteAllBytes(path, tex.EncodeToPNG());
            }
            catch (Exception e)
            {
                Debug.LogError("Hollowmere QA frame failed: " + e.Message);
            }
            UnityEngine.Object.Destroy(tex);
        }

        /// <summary>Still camera, hero centred. Idle holds the middle of the frame, then
        /// walk and run carry them across it.</summary>
        static void HoldCameraAcross(HeroActor hero, Vector3 lane)
        {
            if (lane.sqrMagnitude < 0.01f) lane = Vector3.right;
            lane.y = 0f;
            lane.Normalize();
            hero.Face(lane);
            var side = Vector3.Cross(Vector3.up, lane);
            if (side.sqrMagnitude < 0.01f) side = Vector3.forward;
            side.Normalize();
            var look = hero.Pos + Vector3.up * 1.05f;
            var camPos = look + side * 9.5f + Vector3.up * 2.2f;
            var rig = Camera.main != null ? Camera.main.GetComponent<CameraRig>() : null;
            if (rig != null)
                rig.Lock(camPos, Quaternion.LookRotation(look - camPos, Vector3.up));
        }

        static Vector3 Longest(Vector3 from)
        {
            Vector3 best = Vector3.forward;
            float bestD = -1f;
            for (int i = 0; i < 8; i++)
            {
                var d = Quaternion.Euler(0f, i * 45f, 0f) * Vector3.forward;
                float dist = Clear(from, d);
                if (dist > bestD) { bestD = dist; best = d; }
            }
            return best;
        }

        static float Clear(Vector3 from, Vector3 dir)
        {
            float dist = 0f;
            for (float s = 0.5f; s <= 24f; s += 0.5f)
            {
                if (!World.Walkable(from + dir * s)) break;
                dist = s;
            }
            return dist;
        }
    }

    /// <summary>Sets the hero stick before actors read it, on the QA clock.</summary>
    [DefaultExecutionOrder(-200)]
    public sealed class QaDrive : MonoBehaviour
    {
        public HeroActor hero;
        public string mode;
        public Vector3 forward = Vector3.forward;
        public Vector3 right = Vector3.right;
        public float elapsed;
        public string Gait { get; private set; } = "idle";
        bool stamped;

        void Update()
        {
            if (hero == null) return;
            elapsed += Time.deltaTime;
            if (mode == "combat")
            {
                hero.moveInput = Vector2.zero;
                // Swing from the first frames so the capture is not the idle before the attack.
                hero.attackHeld = elapsed >= 0.05f && elapsed <= 2.8f;
                hero.Face(forward);
                if (!stamped && elapsed >= 0.35f)
                {
                    stamped = true;
                    var at = hero.Pos + forward * 1.6f + Vector3.up * 1.1f;
                    Fx.Damage(at, new Hit { amount = 128f, crit = true, element = Element.Physical }, false);
                    var flash = Art.GlowSprite(null, 1.6f, new Color(1f, 0.95f, 0.7f, 1f));
                    flash.transform.position = at;
                    flash.AddComponent<FxLife>().Init(0.22f, Vector3.one * 1.2f, Vector3.one * 2.4f);
                    CombatClock.Punch("crit");
                    Debug.Log("Hollowmere QA combat flash at " + elapsed.ToString("0.00") + "s");
                }
                return;
            }
            float mag;
            Vector3 dir;
            if (mode == "pet")
            {
                mag = 1f;
                dir = forward;
            }
            else if (mode == "move")
            {
                // Centred idle, then walk, then run. The camera stays put.
                if (elapsed < 0.8f) { mag = 0f; dir = forward; Gait = "idle"; }
                else if (elapsed < 1.7f) { mag = 0.42f; dir = forward; Gait = "walk"; }
                else { mag = 1f; dir = forward; Gait = "run"; }
            }
            else if (elapsed < 0.8f) { mag = 0.45f; dir = forward; }
            else if (elapsed < 1.6f) { mag = 1f; dir = forward; }
            else if (elapsed < 2.2f) { mag = 0f; dir = forward; }
            else { mag = 1f; dir = right; }
            var local = Quaternion.Euler(0f, -CameraRig.Yaw, 0f) * dir;
            hero.moveInput = new Vector2(local.x, local.z) * mag;
            hero.attackHeld = false;
        }
    }
}
