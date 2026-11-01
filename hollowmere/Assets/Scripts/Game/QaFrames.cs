using System;
using System.Collections;
using System.IO;
using Hollowmere.Core;
using UnityEngine;

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
                yield return null;
                yield return new WaitForEndOfFrame();
                var anim = actor.GetComponentInChildren<Animation>();
                var names = GearAudit.ClipNames(anim);
                int shot = 0;
                for (int g = 0; g < GearFit.RequiredPoses.Length; g++)
                {
                    string clip = FirstPose(names, GearFit.RequiredPoses[g]);
                    if (clip == null) continue;
                    Sample(anim, clip, 0.35f);
                    FrameGear(actor, cam, rig, false);
                    yield return new WaitForEndOfFrame();
                    Save("gearslots-" + GearFit.RequiredPoses[g][0], shot++);
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
            st.time = Mathf.Max(0.05f, st.length) * Mathf.Clamp01(unit);
            anim.Sample();
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
