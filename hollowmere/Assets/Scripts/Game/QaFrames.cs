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
                // The primary is Hex Bolt, which is a round glow and not a ribbon.
                // The swing under test is this world-space trail, seeded before the first frame.
                hero.Face(drive.forward);
                TrailHold.ArmSwing(hero, 3.2f);
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
                    if (mode == "combat") LogTrails(i);
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

        /// <summary>The ribbon has to be on, on a layer the camera draws, and using a shader
        /// the build actually includes. Bounds are logged so an empty strip is obvious.</summary>
        static void LogTrails(int index)
        {
            var cam = Camera.main;
            int mask = cam != null ? cam.cullingMask : 0;
            var trails = UnityEngine.Object.FindObjectsByType<TrailRenderer>(FindObjectsSortMode.None);
            if (trails == null || trails.Length == 0)
            {
                Debug.Log("Hollowmere QA trail " + index.ToString("00") + " none");
                return;
            }
            for (int t = 0; t < trails.Length; t++)
            {
                var tr = trails[t];
                if (tr == null) continue;
                string shader = tr.sharedMaterial != null && tr.sharedMaterial.shader != null
                    ? tr.sharedMaterial.shader.name : "none";
                int layer = tr.gameObject.layer;
                bool rendered = tr.enabled && cam != null && (mask & (1 << layer)) != 0;
                Debug.Log("Hollowmere QA trail " + index.ToString("00")
                    + " name=" + tr.name
                    + " enabled=" + tr.enabled
                    + " layer=" + layer
                    + " rendered=" + rendered
                    + " shader=" + shader
                    + " positions=" + tr.positionCount
                    + " bounds=" + tr.bounds.center.ToString("0.00") + " size=" + tr.bounds.size.ToString("0.00"));
            }
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
