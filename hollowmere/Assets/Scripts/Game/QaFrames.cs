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
                hero.attackHeld = elapsed >= 0.45f && elapsed <= 2.6f;
                if (!stamped && elapsed >= 1.15f)
                {
                    stamped = true;
                    Fx.Damage(hero.Pos + forward * 2.2f + Vector3.up, new Hit { amount = 128f, crit = true, element = Element.Physical }, false);
                    CombatClock.Punch("crit");
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
