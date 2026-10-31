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
            yield return null;
            bool number = false;
            foreach (var tm in UnityEngine.Object.FindObjectsByType<TextMesh>(FindObjectsSortMode.None))
                if (tm != null && (tm.gameObject.name == "ftext" || tm.gameObject.name == "dmg")) number = true;
            foreach (var tr in UnityEngine.Object.FindObjectsByType<Transform>(FindObjectsSortMode.None))
                if (tr != null && tr.name == "dmg") number = true;
            var flash = monster.GetComponent<HitFlash>();
            Debug.Log("Hollowmere QA combatfeel number=" + number + " flash=" + (flash != null) + " frozen=" + CombatClock.Frozen);
            if (!number) Debug.LogError("Hollowmere QA combatfeel FAIL no damage number");
            if (flash == null) Debug.LogError("Hollowmere QA combatfeel FAIL no hit flash");
            if (!CombatClock.Frozen) Debug.LogError("Hollowmere QA combatfeel FAIL hit-stop did not freeze");
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
