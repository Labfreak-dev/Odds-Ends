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
    /// The shot is written to qa-&lt;scene&gt;.png in the working directory, then the player quits.
    /// Dungeon also fires Hex Bolt so the projectile is in the frame.
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

        static IEnumerator Run(GameManager gm, string scene)
        {
            bool title = scene == "title";
            bool dungeon = scene == "dungeon" || scene == "floor" || scene == "floor1" || scene == "1";
            if (title)
            {
                UiRoot.I.ShowTitle();
                yield return new WaitForSecondsRealtime(1.2f);
            }
            else
            {
                gm.State = GameState.NewGame(HeroClass.Hexweaver, "Qa", PetSpecies.Hound, "Moss", 1);
                if (dungeon) gm.EnterFloor(1);
                else gm.EnterTown(false);
                yield return new WaitForSeconds(0.8f);
                var albedo = HeroActor.I != null ? Art.AlbedoOf(HeroActor.I.gameObject) : null;
                if (albedo == null)
                    Debug.LogError("Hollowmere QA: hero material has no albedo texture.");
                else
                    Debug.Log("Hollowmere QA: hero albedo " + albedo.name + " " + albedo.width + "x" + albedo.height
                        + (albedo is Texture2D t && t.isReadable ? " readable" : ""));
                if (dungeon && HeroActor.I != null)
                {
                    var aim = OpenAim(HeroActor.I.Pos);
                    HeroActor.I.aim = aim;
                    HeroActor.I.transform.rotation = Quaternion.LookRotation(aim);
                    var bolt = SkillDb.Get("hx_bolt");
                    bool fired = bolt != null && HeroActor.I.UseSkill(bolt);
                    if (!fired) Debug.LogError("Hollowmere QA: Hex Bolt did not fire.");
                    // Mid-flight. 22 m/s for 0.15 s is about three metres in front of the hero.
                    yield return new WaitForSeconds(0.15f);
                }
            }
            yield return new WaitForEndOfFrame();
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

        static Vector3 OpenAim(Vector3 from)
        {
            Vector3 best = Vector3.forward;
            float bestD = -1f;
            for (int i = 0; i < 8; i++)
            {
                var d = Quaternion.Euler(0f, i * 45f, 0f) * Vector3.forward;
                float dist = 0f;
                for (float s = 0.5f; s <= 8f; s += 0.5f)
                {
                    if (!World.Walkable(from + d * s)) break;
                    dist = s;
                }
                if (dist > bestD) { bestD = dist; best = d; }
            }
            return best;
        }
    }
}
