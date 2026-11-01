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
            for (int f = 0; f < GearTable.Families.Length; f++)
            {
                for (int tier = 1; tier <= GearTable.TierCount; tier++)
                {
                    WearFamily(gm, pieces, GearTable.Families[f], tier);
                    yield return null;
                    StandIdle(actor);
                    FrameGear(actor, cam, rig, true);
                    yield return null;
                    yield return new WaitForEndOfFrame();
                    SaveNamed("tiers-" + GearTable.Families[f] + "-" + tier);
                }
            }
            Debug.Log("Hollowmere QA tiers done");
            Application.Quit();
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
        {
            var hero = gm.State.hero;
            hero.classless = true;
            hero.inventory.RemoveAll(it => it != null && it.kind == ItemKind.Equipment);
            for (int i = 0; i < (int)EquipSlot.Count; i++)
                hero.equipment[i] = null;
            var rng = new Rng(11);
            for (int i = 0; i < pieces.Length; i++)
            {
                var it = Loot.Generate(rng, 12, Rarity.Rare, null, ItemSlotOf(pieces[i].slot), pieces[i].id, 8);
                if (it == null)
                {
                    Debug.LogError("Hollowmere gear FAIL could not equip " + pieces[i].id);
                    continue;
                }
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
