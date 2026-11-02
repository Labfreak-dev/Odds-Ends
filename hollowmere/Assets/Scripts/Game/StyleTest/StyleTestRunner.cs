using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using UnityEngine;

namespace Hollowmere.StyleTest
{
    /// <summary>Free stylized style test (KayKit CC0). Boots instead of the game when started with -styleTest
    /// or when Resources/ST/st_autoboot exists (style-test APK). Modes: -stMode play (default) | shots | clip.</summary>
    public class StyleTestRunner : MonoBehaviour
    {
        public static bool Requested()
        {
            foreach (var a in Environment.GetCommandLineArgs()) if (a == "-styleTest") return true;
            return Resources.Load<TextAsset>("ST/st_autoboot") != null;
        }

        static string Arg(string n, string def)
        {
            var a = Environment.GetCommandLineArgs();
            for (int i = 0; i < a.Length - 1; i++) if (a[i] == n) return a[i + 1];
            return def;
        }

        Camera cam;
        string outDir;
        string mode;
        // slice state
        StLook look; int skinIdx, weaponIdx, glowTier;
        StActor hero; readonly List<StActor> foes = new List<StActor>();
        Vector3 moveTarget; bool hasTarget; int wave; bool inCreator = true; int creatorPick;
        readonly List<StActor> creatorActors = new List<StActor>();
        readonly List<GameObject> creatorStuff = new List<GameObject>();
        bool autopilot;

        void Start()
        {
            mode = Arg("-stMode", "play");
            outDir = Arg("-stOut", Directory.GetCurrentDirectory());
            Directory.CreateDirectory(outDir);
            var cg = new GameObject("StCamera"); cg.tag = "MainCamera";
            cam = cg.AddComponent<Camera>(); cam.fieldOfView = 35; cam.nearClipPlane = 0.2f; cam.farClipPlane = 120;
            cam.clearFlags = CameraClearFlags.SolidColor; cam.backgroundColor = new Color(0.05f, 0.05f, 0.08f);
            var _ = StKit.Clips;
            Debug.Log("[ST] mode " + mode + " out " + outDir);
            if (mode == "shots") StartCoroutine(Shots());
            else if (mode == "clip") StartCoroutine(Clip());
            else ShowCreator();
        }

        // ---------------- creator ----------------
        void ShowCreator()
        {
            ClearScene(); inCreator = true;
            StWorld.NeutralLighting();
            RenderSettings.ambientSkyColor *= 0.55f; RenderSettings.ambientEquatorColor *= 0.55f;
            cam.backgroundColor = new Color(0.10f, 0.09f, 0.12f);
            var looks = StLook.Base;
            for (int i = 0; i < 3; i++)
            {
                var p = new Vector3((i - 1) * 3.6f, 0, 0);
                var ped = StKit.Spawn("Dungeon/floor_tile_small", p, 0);
                var b = StWorld.Bounds(ped); ped.transform.position += new Vector3(p.x - b.center.x, -b.max.y, p.z - b.center.z);
                creatorStuff.Add(ped);
                var a = looks[i].Build(p, 180); a.Loop(a.idle); creatorActors.Add(a);
                var t = new GameObject("label").AddComponent<TextMesh>();
                t.text = looks[i].label.ToUpperInvariant(); t.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
                t.GetComponent<MeshRenderer>().sharedMaterial = t.font.material; t.fontSize = 64; t.characterSize = 0.045f;
                t.anchor = TextAnchor.MiddleCenter; t.color = new Color(1f, 0.86f, 0.55f);
                t.transform.position = p + new Vector3(0, -0.45f, -1.6f); t.transform.rotation = Quaternion.Euler(20, 0, 0);
                creatorStuff.Add(t.gameObject);
            }
            var title = new GameObject("title").AddComponent<TextMesh>();
            title.text = "CHOOSE YOUR CLASS"; title.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            title.GetComponent<MeshRenderer>().sharedMaterial = title.font.material; title.fontSize = 64; title.characterSize = 0.05f;
            title.anchor = TextAnchor.MiddleCenter; title.color = new Color(0.95f, 0.92f, 0.85f);
            title.transform.position = new Vector3(0, 3.9f, 0); creatorStuff.Add(title.gameObject);
            cam.transform.position = new Vector3(0, 2.1f, -10.5f); cam.transform.rotation = Quaternion.Euler(5, 0, 0); cam.fieldOfView = 38;
            SelectCreator(creatorPick);
        }

        void SelectCreator(int i)
        {
            creatorPick = i;
            foreach (var g in creatorStuff) if (g != null && g.name == "pick_ring") Destroy(g);
            var ring = GameObject.CreatePrimitive(PrimitiveType.Quad); Destroy(ring.GetComponent<Collider>()); ring.name = "pick_ring";
            ring.transform.position = creatorActors[i].transform.position + Vector3.up * 0.04f; ring.transform.rotation = Quaternion.Euler(90, 0, 0); ring.transform.localScale = Vector3.one * 3.0f;
            ring.GetComponent<MeshRenderer>().sharedMaterial = StGlow.Mat(new Color(1.6f, 1.1f, 0.4f), 1);
            creatorStuff.Add(ring);
            if (Application.isPlaying && creatorActors[i].anim != null) { creatorActors[i].Once(creatorActors[i].attack); creatorActors[i].current = null; }
        }

        void StartSlice(int pick)
        {
            ClearScene(); inCreator = false;
            look = StLook.Base[pick]; skinIdx = 0; weaponIdx = 0; glowTier = 0;
            StWorld.DungeonLighting();
            StWorld.BuildRoom();
            cam.backgroundColor = new Color(0.03f, 0.03f, 0.05f); cam.fieldOfView = 35;
            SpawnHero(new Vector3(0, 0, -4));
            wave = 0; SpawnWave();
            var t0 = hero.transform.position + new Vector3(0, 1.2f, 1.0f);
            cam.transform.position = t0 + Quaternion.Euler(52, 0, 0) * new Vector3(0, 0, -19f); cam.transform.rotation = Quaternion.Euler(52, 0, 0);
        }

        void ClearScene()
        {
            foreach (var go in FindObjectsByType<GameObject>(FindObjectsSortMode.None))
                if (go.transform.parent == null && go != gameObject && go != cam.gameObject && go.name != "Hollowmere") Destroy(go);
            creatorActors.Clear(); creatorStuff.Clear(); foes.Clear(); StWorld.Built.Clear(); hero = null;
        }

        StLook CurrentLook()
        {
            var l = look;
            if (skinIdx == 1) l = l.UpgradeSkin() ?? l;
            if (weaponIdx > 0) l = l.Loadout(weaponIdx);
            if (glowTier > 0) l = l.WithGlow(glowTier);
            return l;
        }

        void SpawnHero(Vector3 at)
        {
            float yaw = hero ? hero.transform.eulerAngles.y : 0;
            if (hero) Destroy(hero.gameObject);
            hero = CurrentLook().Build(at, yaw); hero.Loop(hero.idle);
            HeroLight(hero);
        }

        /// <summary>ARPG-style player light: a soft warm pool that keeps the hero readable in the dark room.</summary>
        static void HeroLight(StActor h)
        {
            var l = new GameObject("hero_light").AddComponent<Light>();
            l.type = LightType.Point; l.color = new Color(1f, 0.9f, 0.75f); l.intensity = 3.5f; l.range = 9f; l.shadows = LightShadows.None;
            l.transform.SetParent(h.transform, false); l.transform.localPosition = new Vector3(0, 4.5f / h.transform.localScale.y, -1.5f / h.transform.localScale.y);
        }

        void SpawnWave()
        {
            wave++;
            bool boss = wave % 3 == 0;
            if (boss) foes.Add(Skeleton(true, new Vector3(0, 0, 6f)));
            else
            {
                string[] kinds = { "Skel/Skeleton_Warrior", "Skel/Skeleton_Minion", "Skel/Skeleton_Rogue", "Skel/Skeleton_Mage" };
                for (int i = 0; i < 4; i++) foes.Add(Skeleton(false, new Vector3(-6f + i * 4f, 0, 5f + (i % 2) * 2f), kinds[i]));
            }
        }

        public static StActor Skeleton(bool boss, Vector3 pos, string kind = "Skel/Skeleton_Warrior")
        {
            var s = StActor.Make(boss ? "Skel/Skeleton_Warrior" : kind, pos, 180);
            s.idle = "Skeletons_Idle"; s.run = "Skeletons_Walking"; s.death = "Skeletons_Death"; s.hit = "Hit_A";
            s.attack = "Melee_1H_Attack_Chop"; s.speed = boss ? 2.2f : 2.8f; s.hp = boss ? 12 : 3;
            if (boss)
            {
                s.transform.localScale *= 1.7f; s.attackRange = 4.4f;
                s.SetWeapons("Skel/Skeleton_Axe", "Skel/Skeleton_Shield_Large_A");
                StGlow.Apply(s, 3);
                foreach (var l in s.GetComponentsInChildren<Light>()) l.color = new Color(1f, 0.25f, 0.15f);
                foreach (var r in s.GetComponentsInChildren<MeshRenderer>()) if (r.name == "glow_ring") r.sharedMaterial = StGlow.Mat(new Color(2.2f, 0.35f, 0.2f), 1);
                foreach (var sk in s.GetComponentsInChildren<SkinnedMeshRenderer>()) { var m = new Material[sk.sharedMaterials.Length + 1]; sk.sharedMaterials.CopyTo(m, 0); m[m.Length - 1] = StGlow.Mat(new Color(0.9f, 0.15f, 0.08f), 0, 3f); sk.sharedMaterials = m; }
            }
            else if (kind.EndsWith("Mage")) s.SetWeapons("Skel/Skeleton_Staff", null);
            else if (kind.EndsWith("Minion")) s.SetWeapons("Skel/Skeleton_Axe", null);
            else if (kind.EndsWith("Rogue")) s.SetWeapons("Skel/Skeleton_Blade", null);
            else s.SetWeapons("Skel/Skeleton_Blade", "Skel/Skeleton_Shield_Small_A");
            s.Loop(s.idle);
            return s;
        }

        // ---------------- gameplay ----------------
        float nextAttack; StActor target; float pendingHitAt = -1;

        void Update()
        {
            if (inCreator || hero == null || mode == "shots") return;
            if (!autopilot && Input.GetMouseButton(0) && Input.mousePosition.y < Screen.height * 0.82f)
            {
                var ray = cam.ScreenPointToRay(Input.mousePosition);
                if (new Plane(Vector3.up, 0).Raycast(ray, out var d)) { moveTarget = ray.GetPoint(d); hasTarget = true; }
            }
            foes.RemoveAll(f => f == null);
            target = Nearest();
            float range = hero.attackRange;
            if (autopilot && target != null)
            {
                var dist = Flat(target.transform.position - hero.transform.position).magnitude;
                if (dist > range * 0.9f) { moveTarget = target.transform.position; hasTarget = true; } else hasTarget = false;
            }
            var lo = StWorld.RoomMin + new Vector3(1, 0, 1); var hi = StWorld.RoomMax - new Vector3(1, 0, 1.5f);
            if (hasTarget && !hero.Busy)
            {
                var to = Flat(moveTarget - hero.transform.position);
                var stop = autopilot && target ? range * 0.85f : 0.15f;
                if (autopilot && target) to = Flat(target.transform.position - hero.transform.position);
                if (to.magnitude > stop)
                {
                    hero.transform.rotation = Quaternion.Slerp(hero.transform.rotation, Quaternion.LookRotation(to), Time.deltaTime * 12);
                    var p = hero.transform.position + to.normalized * hero.speed * Time.deltaTime;
                    p.x = Mathf.Clamp(p.x, lo.x, hi.x); p.z = Mathf.Clamp(p.z, lo.z, hi.z);
                    hero.transform.position = p; hero.Loop(hero.run);
                }
                else { hasTarget = false; hero.Loop(hero.idle); }
            }
            else if (!hero.Busy)
            {
                if (target != null && Flat(target.transform.position - hero.transform.position).magnitude <= range && Time.time >= nextAttack)
                {
                    hero.transform.rotation = Quaternion.LookRotation(Flat(target.transform.position - hero.transform.position));
                    var len = hero.Once(hero.attack); nextAttack = Time.time + len + 0.1f;
                    pendingHitAt = Time.time + len * CurrentLook().hitAt;
                    StartCoroutine(SwingTrail(len));
                }
                else hero.Loop(hero.idle);
            }
            if (pendingHitAt > 0 && Time.time >= pendingHitAt)
            {
                pendingHitAt = -1;
                var l = CurrentLook();
                if (target != null)
                {
                    if (l.projectile != null) StartCoroutine(Projectile(l, target));
                    else Damage(target, 1);
                }
            }
            foreach (var f in foes) EnemyTick(f);
            Separate();
            if (foes.Count == 0 || foes.TrueForAll(f => f.dead)) { if (!waveQueued) StartCoroutine(NextWave()); }
            FollowCam();
        }

        bool waveQueued;
        IEnumerator NextWave() { waveQueued = true; yield return new WaitForSeconds(1.2f); foes.RemoveAll(f => f == null || f.dead); SpawnWave(); waveQueued = false; }

        static Vector3 Flat(Vector3 v) { v.y = 0; return v; }

        StActor Nearest()
        {
            StActor best = null; float bd = 1e9f;
            foreach (var f in foes) { if (f == null || f.dead) continue; var d = (f.transform.position - hero.transform.position).sqrMagnitude; if (d < bd) { bd = d; best = f; } }
            return best;
        }

        void EnemyTick(StActor f)
        {
            if (f == null || f.dead || f.Busy) return;
            var to = Flat(hero.transform.position - f.transform.position);
            if (to.magnitude > f.attackRange * 0.9f)
            {
                f.transform.rotation = Quaternion.Slerp(f.transform.rotation, Quaternion.LookRotation(to), Time.deltaTime * 6);
                f.transform.position += to.normalized * f.speed * Time.deltaTime; f.Loop(f.run);
            }
            else
            {
                f.transform.rotation = Quaternion.LookRotation(to);
                if (UnityEngine.Random.value < Time.deltaTime * 0.6f) f.Once(f.attack); else f.Loop(f.idle);
            }
        }

        /// <summary>Keeps bodies from interpenetrating (skeletons with each other and with the hero).</summary>
        void Separate()
        {
            for (int i = 0; i < foes.Count; i++)
            {
                var a = foes[i]; if (a == null || a.dead) continue;
                float ra = 0.9f * a.transform.localScale.x / hero.transform.localScale.x;
                var dh = Flat(a.transform.position - hero.transform.position);
                float minH = ra + 0.9f;
                if (dh.magnitude < minH && dh.sqrMagnitude > 1e-4f) a.transform.position = hero.transform.position + dh.normalized * minH;
                for (int j = i + 1; j < foes.Count; j++)
                {
                    var b = foes[j]; if (b == null || b.dead) continue;
                    float rb = 0.9f * b.transform.localScale.x / hero.transform.localScale.x;
                    var d = Flat(a.transform.position - b.transform.position); float min = ra + rb;
                    if (d.magnitude < min && d.sqrMagnitude > 1e-4f) { var push = d.normalized * (min - d.magnitude) * 0.5f; a.transform.position += push; b.transform.position -= push; }
                }
            }
        }

        void Damage(StActor f, float amount)
        {
            if (f == null || f.dead) return;
            f.hp -= amount;
            if (f.hp <= 0) { f.dead = true; f.Once(f.death, 0.08f, true); StartCoroutine(Sink(f)); }
            else f.Once(f.hit);
        }

        IEnumerator Sink(StActor f)
        {
            yield return new WaitForSeconds(2.2f);
            float t = 0; while (t < 1 && f) { t += Time.deltaTime; f.transform.position += Vector3.down * Time.deltaTime * 0.8f; yield return null; }
            if (f) { foes.Remove(f); Destroy(f.gameObject); }
        }

        IEnumerator Projectile(StLook l, StActor tgt)
        {
            GameObject p;
            var from = hero.transform.position + Vector3.up * 2.0f + hero.transform.forward * 1.0f;
            if (l.projectile == "arrow") { p = StKit.Spawn("Weapons/arrow_bow", from, 0); p.transform.localScale = Vector3.one * 1.2f; }
            else
            {
                p = GameObject.CreatePrimitive(PrimitiveType.Quad); Destroy(p.GetComponent<Collider>());
                p.transform.localScale = Vector3.one * 1.4f; p.GetComponent<MeshRenderer>().sharedMaterial = StGlow.Mat(new Color(1.0f, 0.55f, 2.4f), 2);
                p.AddComponent<StBillboard>();
                var lt = p.AddComponent<Light>(); lt.type = LightType.Point; lt.color = new Color(0.7f, 0.45f, 1f); lt.intensity = 3; lt.range = 5;
            }
            p.transform.position = from;
            while (p && tgt)
            {
                var dest = tgt.transform.position + Vector3.up * 1.6f * tgt.transform.localScale.y;
                var d = dest - p.transform.position;
                if (d.magnitude < 0.6f) break;
                if (l.projectile == "arrow") p.transform.rotation = Quaternion.LookRotation(d);
                p.transform.position += d.normalized * Mathf.Min(d.magnitude, 26f * Time.deltaTime);
                yield return null;
            }
            if (p) Destroy(p);
            Damage(tgt, 1);
        }

        IEnumerator SwingTrail(float len) { yield break; }

        void FollowCam()
        {
            var t = hero.transform.position + new Vector3(0, 1.2f, 1.0f);
            var want = t + Quaternion.Euler(52, 0, 0) * new Vector3(0, 0, -19f);
            cam.transform.position = Vector3.Lerp(cam.transform.position, want, Mathf.Clamp01(Time.deltaTime * 5));
            cam.transform.rotation = Quaternion.Euler(52, 0, 0);
        }

        void OnGUI()
        {
            if (mode != "play") return;
            var s = Screen.height / 1080f; GUI.skin.button.fontSize = (int)(34 * s); GUI.skin.label.fontSize = (int)(30 * s);
            if (inCreator)
            {
                float w = 360 * s, h = 110 * s, y = Screen.height - h - 40 * s;
                for (int i = 0; i < 3; i++)
                {
                    var x = Screen.width * (0.5f + (i - 1) * 0.27f) - w / 2;
                    if (GUI.Button(new Rect(x, y, w, h), (creatorPick == i ? "> " : "") + StLook.Base[i].label)) SelectCreator(i);
                }
                GUI.Label(new Rect(40 * s, 40 * s, 900 * s, 60 * s), StLook.Base[creatorPick].blurb);
                if (GUI.Button(new Rect(Screen.width - 380 * s, 40 * s, 340 * s, 110 * s), "Enter dungeon")) StartSlice(creatorPick);
                return;
            }
            float bw = 300 * s, bh = 90 * s, by = 20 * s; float bx = 20 * s;
            if (GUI.Button(new Rect(bx, by, bw, bh), "Class menu")) { ShowCreator(); return; }
            bx += bw + 12 * s;
            if (GUI.Button(new Rect(bx, by, bw, bh), "Weapon " + (weaponIdx + 1) + "/3")) { weaponIdx = (weaponIdx + 1) % 3; SpawnHero(hero.transform.position); }
            bx += bw + 12 * s;
            if (look.UpgradeSkin() != null && GUI.Button(new Rect(bx, by, bw, bh), skinIdx == 0 ? "Upgrade skin" : "Base skin")) { skinIdx = 1 - skinIdx; SpawnHero(hero.transform.position); }
            bx += bw + 12 * s;
            if (GUI.Button(new Rect(bx, by, bw, bh), glowTier == 0 ? "Glow: off" : glowTier == 2 ? "Glow: rare" : "Glow: legendary")) { glowTier = glowTier == 0 ? 2 : glowTier == 2 ? 3 : 0; SpawnHero(hero.transform.position); }
            bx += bw + 12 * s;
            autopilot = GUI.Toggle(new Rect(bx, by + 20 * s, bw, bh), autopilot, " Auto-fight");
            GUI.Label(new Rect(20 * s, Screen.height - 70 * s, 1400 * s, 60 * s), CurrentLook().label + "  -  wave " + wave + "  (tap floor to move; attacks are automatic)");
        }

        // ---------------- capture helpers ----------------
        Texture2D Render(Camera c, int w, int h)
        {
            var rt = RenderTexture.GetTemporary(w, h, 24, RenderTextureFormat.ARGB32); rt.antiAliasing = 4;
            var prev = c.targetTexture; c.targetTexture = rt; c.Render(); c.targetTexture = prev;
            RenderTexture.active = rt;
            var tex = new Texture2D(w, h, TextureFormat.RGB24, false); tex.ReadPixels(new Rect(0, 0, w, h), 0, 0); tex.Apply();
            RenderTexture.active = null; RenderTexture.ReleaseTemporary(rt);
            return tex;
        }

        void Save(Texture2D t, string name, bool jpg = false)
        {
            var p = Path.Combine(outDir, name);
            Directory.CreateDirectory(Path.GetDirectoryName(p));
            File.WriteAllBytes(p, jpg ? t.EncodeToJPG(90) : t.EncodeToPNG());
            Destroy(t);
        }

        static void Blit(Texture2D dst, Texture2D src, int x, int y)
        {
            dst.SetPixels(x, y, src.width, src.height, src.GetPixels());
        }

        // ---------------- shots ----------------
        static readonly string[] Views = { "front", "3q_front", "side", "back", "3q_back" };
        static readonly float[] ViewYaw = { 180, 225, 270, 0, 315 };

        IEnumerator Shots()
        {
            yield return null;
            Time.timeScale = 0;
            var only = Arg("-stOnly", "");
            var variants = new List<StLook>();
            foreach (var b in StLook.Base)
                foreach (var skin in new[] { b, b.UpgradeSkin() })
                    if (skin != null) for (int k = 0; k < 3; k++) variants.Add(skin.Loadout(k));
            variants.Add(StLook.Mage().WithGlow(3)); variants.Add(StLook.Knight().WithGlow(2)); variants.Add(StLook.Ranger().WithGlow(3));
            if (only == "fix")
            {
                // bow-in-floor / flat-tome check: weapon lowest point over 16 frames of idle/run/attack (+ turnarounds)
                StWorld.NeutralLighting(); cam.backgroundColor = new Color(0.56f, 0.57f, 0.59f); cam.orthographic = true;
                var fx = new List<StLook>();
                foreach (var v in variants) if (v.id.StartsWith("ranger") || v.id.StartsWith("mage")) fx.Add(v);
                foreach (var v in fx)
                {
                    var a = v.Build(Vector3.zero, 180);
                    foreach (var clip in new[] { a.idle, a.run, a.attack })
                    {
                        float lo = 99f;
                        for (int f = 0; f < 16; f++)
                        {
                            a.Pose(clip, f / 16f);
                            foreach (var w in new[] { a.weaponR, a.weaponL }) if (w) foreach (var r in w.GetComponentsInChildren<Renderer>()) lo = Mathf.Min(lo, r.bounds.min.y);
                        }
                        Debug.Log("[ST] FLOORCHECK " + v.id + " " + clip + " weaponMinY=" + lo.ToString("F3") + (lo < 0.0f ? " FAIL" : " ok"));
                    }
                    yield return Turnaround(a, "fix/turn_" + v.id, a.idle, 0.3f);
                    yield return Turnaround(a, "fix/turn_" + v.id + "_run", a.run, 0.25f);
                    yield return Turnaround(a, "fix/turn_" + v.id + "_attack", a.attack, v.hitAt);
                    Destroy(a.gameObject); yield return null;
                }
                Application.Quit(); yield break;
            }
            if (only == "" || only == "turn")
            {
                StWorld.NeutralLighting();
                cam.backgroundColor = new Color(0.56f, 0.57f, 0.59f); cam.orthographic = true;
                foreach (var v in variants) { var a = v.Build(Vector3.zero, 180); yield return Turnaround(a, "turn_" + v.id, a.idle, 0.3f); Destroy(a.gameObject); yield return null; }
                foreach (var b in variants)
                {
                    if (b.glow > 0) continue;
                    var a = b.Build(Vector3.zero, 180);
                    yield return Turnaround(a, "turn_" + b.id + "_run", a.run, 0.25f);
                    yield return Turnaround(a, "turn_" + b.id + "_attack", a.attack, b.hitAt);
                    foreach (var clip in new[] { a.idle, a.run, a.attack }) yield return Strip(a, "strips/strip_" + b.id + "_" + clip, clip);
                    Destroy(a.gameObject); yield return null;
                }
                { var s = Skeleton(false, Vector3.zero); yield return Turnaround(s, "turn_skeleton", s.idle, 0.3f); foreach (var clip in new[] { s.idle, s.run, s.attack, s.death }) yield return Strip(s, "strips/strip_skeleton_" + clip, clip); Destroy(s.gameObject); }
                { var s = Skeleton(true, Vector3.zero); yield return Turnaround(s, "turn_boss", s.idle, 0.3f); foreach (var clip in new[] { s.idle, s.run, s.attack }) yield return Strip(s, "strips/strip_boss_" + clip, clip); Destroy(s.gameObject); }
                foreach (var go in FindObjectsByType<Light>(FindObjectsSortMode.None)) Destroy(go.gameObject);
                yield return null;
            }
            cam.orthographic = false;
            if (only == "" || only == "creator")
            {
                ShowCreator(); yield return null;
                foreach (var a in creatorActors) a.Pose(a.idle, 0.3f);
                yield return null;
                Save(Render(cam, 2340, 1080), "gamecam/creator.png");
                ClearScene(); foreach (var go in FindObjectsByType<Light>(FindObjectsSortMode.None)) Destroy(go.gameObject); yield return null;
            }
            if (only == "" || only == "gamecam")
            {
                StWorld.DungeonLighting(); StWorld.BuildRoom(); cam.backgroundColor = new Color(0.03f, 0.03f, 0.05f); cam.fieldOfView = 35;
                var sk = new List<StActor>
                {
                    Skeleton(false, new Vector3(2.4f, 0, -0.6f), "Skel/Skeleton_Warrior"), Skeleton(false, new Vector3(4.6f, 0, 2.4f), "Skel/Skeleton_Minion"),
                    Skeleton(false, new Vector3(6.2f, 0, -1.8f), "Skel/Skeleton_Rogue"), Skeleton(false, new Vector3(3.2f, 0, 4.6f), "Skel/Skeleton_Mage"),
                };
                var bossA = Skeleton(true, new Vector3(8.0f, 0, 3.8f));
                var shotLooks = new List<StLook>(variants);
                foreach (var v in shotLooks)
                {
                    var a = v.Build(new Vector3(-2.2f, 0, 0), 100);
                    hero = a; HeroLight(a);
                    foreach (var (clip, t, tag) in new[] { (a.idle, 0.3f, "idle"), (a.run, 0.25f, "run"), (a.attack, v.hitAt, "attack") })
                    {
                        if (tag != "idle" && v.id.Contains("_t") ) continue;
                        a.Pose(clip, t);
                        for (int i = 0; i < sk.Count; i++) sk[i].Pose(i % 2 == 0 ? sk[i].attack : sk[i].run, 0.2f + 0.2f * i);
                        foreach (var e in sk) e.transform.rotation = Quaternion.LookRotation(Flat(a.transform.position - e.transform.position));
                        bossA.transform.rotation = Quaternion.LookRotation(Flat(a.transform.position - bossA.transform.position));
                        bossA.Pose(bossA.idle, 0.4f);
                        GameObject proj = null;
                        if (tag == "attack" && v.projectile != null)
                        {
                            var at = a.transform.position + Vector3.up * 2.0f + a.transform.forward * 2.2f;
                            if (v.projectile == "arrow") { proj = StKit.Spawn("Weapons/arrow_bow", at, 0); proj.transform.rotation = Quaternion.LookRotation(a.transform.forward); proj.transform.localScale = Vector3.one * 1.2f; }
                            else { proj = GameObject.CreatePrimitive(PrimitiveType.Quad); proj.transform.position = at; proj.transform.localScale = Vector3.one * 1.4f; proj.GetComponent<MeshRenderer>().sharedMaterial = StGlow.Mat(new Color(1.0f, 0.55f, 2.4f), 2); proj.transform.rotation = Quaternion.Euler(52, 0, 0); var lt = proj.AddComponent<Light>(); lt.type = LightType.Point; lt.color = new Color(0.7f, 0.45f, 1f); lt.intensity = 3; lt.range = 5; }
                        }
                        var tgt = a.transform.position + new Vector3(1.6f, 1.2f, 1.0f);
                        cam.transform.position = tgt + Quaternion.Euler(52, 0, 0) * new Vector3(0, 0, -19f); cam.transform.rotation = Quaternion.Euler(52, 0, 0);
                        yield return null;
                        Save(Render(cam, 2340, 1080), "gamecam/" + v.id + "_" + tag + ".png");
                        // zoomed game-cam (same angle, closer) so the outfit and grip can be judged
                        cam.transform.position = tgt + Quaternion.Euler(52, 0, 0) * new Vector3(0, 0, -10f);
                        Save(Render(cam, 2340, 1080), "gamecam_zoom/" + v.id + "_" + tag + ".png");
                        if (proj) Destroy(proj);
                    }
                    Destroy(a.gameObject); yield return null;
                }
                // room overview
                cam.transform.position = new Vector3(0, 20, -22); cam.transform.rotation = Quaternion.Euler(45, 0, 0);
                Save(Render(cam, 2340, 1080), "gamecam/room_overview.png");
            }
            Debug.Log("[ST] shots done");
            Application.Quit();
        }

        IEnumerator Turnaround(StActor a, string name, string clip, float t)
        {
            const int W = 860, H = 1600;
            a.transform.rotation = Quaternion.Euler(0, 180, 0);
            a.Pose(clip, t);
            yield return null;
            // frame from the union of all five views
            var b = a.WorldBounds();
            for (int i = 0; i < 5; i++) { a.transform.rotation = Quaternion.Euler(0, ViewYaw[i], 0); a.Pose(clip, t); b.Encapsulate(a.WorldBounds()); }
            float hgt = Mathf.Max(b.size.y, b.size.x * H / W, b.size.z * H / W) * 1.08f;
            cam.orthographicSize = hgt * 0.5f;
            cam.transform.position = new Vector3(a.transform.position.x, b.center.y, a.transform.position.z - 20); cam.transform.rotation = Quaternion.identity;
            var sheet = new Texture2D(W * 5, H, TextureFormat.RGB24, false);
            for (int i = 0; i < 5; i++)
            {
                a.transform.rotation = Quaternion.Euler(0, ViewYaw[i], 0); a.Pose(clip, t);
                var tile = Render(cam, W, H); Blit(sheet, tile, i * W, 0); Destroy(tile);
            }
            sheet.Apply();
            Save(sheet, name + ".png");
            a.transform.rotation = Quaternion.Euler(0, 180, 0);
        }

        IEnumerator Strip(StActor a, string name, string clip)
        {
            const int W = 540, H = 760, N = 8;
            a.transform.rotation = Quaternion.Euler(0, 180, 0); a.Pose(clip, 0);
            var b = a.WorldBounds();
            for (int f = 0; f < N; f++) { a.Pose(clip, f / (float)N); b.Encapsulate(a.WorldBounds()); }
            cam.orthographicSize = Mathf.Max(b.size.y, Mathf.Max(b.size.x, b.size.z) * H / W) * 0.55f;
            cam.transform.position = new Vector3(a.transform.position.x, b.center.y, a.transform.position.z - 20); cam.transform.rotation = Quaternion.identity;
            var sheet = new Texture2D(W * N, H * 2, TextureFormat.RGB24, false);
            for (int row = 0; row < 2; row++)
                for (int f = 0; f < N; f++)
                {
                    a.transform.rotation = Quaternion.Euler(0, row == 0 ? 215 : 35, 0); a.Pose(clip, f / (float)N);
                    var tile = Render(cam, W, H); Blit(sheet, tile, f * W, (1 - row) * H); Destroy(tile);
                }
            sheet.Apply(); Save(sheet, name + ".jpg", true);
            a.transform.rotation = Quaternion.Euler(0, 180, 0);
            yield return null;
        }

        // ---------------- clip ----------------
        IEnumerator Clip()
        {
            const int W = 1560, H = 720; const int FPS = 30;
            Time.captureFramerate = FPS;
            int frame = 0;
            var dir = Path.Combine(outDir, "clipframes"); Directory.CreateDirectory(dir);
            ShowCreator(); mode = "clip";
            for (int i = 0; i < 3 * FPS; i++)
            {
                if (i == 20) SelectCreator(1); if (i == 45) SelectCreator(2); if (i == 70) SelectCreator(0);
                yield return new WaitForEndOfFrame(); Save(Render(cam, W, H), "clipframes/f" + (frame++).ToString("D4") + ".jpg", true);
            }
            StartSlice(0); autopilot = true;
            float[] segEnd = { 7, 12, 17, 23 };
            int seg = 0; float t0 = 0;
            for (int i = 0; i < 20 * FPS; i++)
            {
                t0 = i / (float)FPS;
                if (seg < segEnd.Length && t0 >= segEnd[seg])
                {
                    seg++;
                    if (seg == 1) { look = StLook.Ranger(); skinIdx = 0; weaponIdx = 0; glowTier = 0; SpawnHero(hero.transform.position); }
                    if (seg == 2) { look = StLook.Mage(); glowTier = 3; SpawnHero(hero.transform.position); }
                    if (seg == 3) { look = StLook.Knight(); skinIdx = 1; weaponIdx = 1; glowTier = 2; SpawnHero(hero.transform.position); }
                }
                if (i == 11 * FPS) { foreach (var f in foes) if (f) Destroy(f.gameObject); foes.Clear(); wave = 2; SpawnWave(); }
                yield return new WaitForEndOfFrame(); Save(Render(cam, W, H), "clipframes/f" + (frame++).ToString("D4") + ".jpg", true);
            }
            Debug.Log("[ST] clip frames " + frame);
            Application.Quit();
        }
    }
}
