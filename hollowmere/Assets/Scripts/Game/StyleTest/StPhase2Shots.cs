using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace Hollowmere.StyleTest
{
    /// <summary>Phase 2 proof: each dungeon biome -> overview, 2 game-camera shots (2340x1080) with hero + skeletons + HUD, one zoom.</summary>
    public static class StPhase2Shots
    {
        static StyleTestRunner R; static Camera C;

        static void Clear()
        {
            foreach (var go in Object.FindObjectsByType<GameObject>(FindObjectsSortMode.None))
                if (go.transform.parent == null && go != R.gameObject && go != C.gameObject && go.name != "Hollowmere") Object.Destroy(go);
            StWorld.Built.Clear();
            C.orthographic = false; C.fieldOfView = 35; C.farClipPlane = 220;
            foreach (Transform t in C.transform) Object.Destroy(t.gameObject);
        }

        public static IEnumerator Run(StyleTestRunner r, Camera cam, string only)
        {
            R = r; C = cam; StPhase1Shots.Bind(r, cam);
            foreach (var id in StBiomes.Ids)
                if (only == "phase2" || only == "p2_" + id) yield return Biome(id);
        }

        static IEnumerator Biome(string id)
        {
            Clear(); yield return null;
            StBiomes.Build(id); C.backgroundColor = RenderSettings.fogColor;
            var hi = System.Array.IndexOf(StBiomes.Ids, id) % 3;
            var hero = StLook.Base[hi].Build(StBiomes.Centre + new Vector3(0, 0, -3.5f), 20); hero.Pose(hero.idle, 0.3f);
            var foes = new List<StActor>();
            foreach (var s in StBiomes.Spawns) { var sk = R.SkeletonPub(s); var d = hero.transform.position - s; d.y = 0; sk.transform.rotation = Quaternion.LookRotation(d); sk.Pose(sk.idle, 0.2f + foes.Count * 0.2f); foes.Add(sk); }
            yield return null; yield return null;
            var c = StBiomes.Centre;
            C.fieldOfView = 40; C.transform.position = c + new Vector3(0, 30, -26); C.transform.LookAt(c + new Vector3(0, 0, 1));
            yield return null;
            R.SavePub(R.RenderPub(C, 2340, 1080), "phase2/" + id + "/overview.png");
            var hud = StPhase1Shots.Hud();
            int n = 0;
            foreach (var focus in new[] { hero.transform.position, StBiomes.Spawns.Count > 2 ? StBiomes.Spawns[2] : c })
            {
                C.fieldOfView = 35; var tgt = focus + new Vector3(0, 1.2f, 1.0f);
                C.transform.position = tgt + Quaternion.Euler(52, 0, 0) * new Vector3(0, 0, -15); C.transform.rotation = Quaternion.Euler(52, 0, 0);
                yield return null;
                R.SavePub(R.RenderPub(C, 2340, 1080), "phase2/" + id + "/gamecam_" + (n++) + ".png");
            }
            if (hud) Object.Destroy(hud);
            // attack frame (hero swinging toward the nearest skeleton) at zoom distance
            hero.Pose(hero.attack, 0.45f);
            C.transform.position = hero.transform.position + new Vector3(0, 1.2f, 1) + Quaternion.Euler(45, 0, 0) * new Vector3(0, 0, -9); C.transform.rotation = Quaternion.Euler(45, 0, 0);
            yield return null;
            R.SavePub(R.RenderPub(C, 2340, 1080), "phase2/" + id + "/zoom_attack.png");
            // low angle to judge walls / props / lighting
            C.fieldOfView = 50; C.transform.position = c + new Vector3(-6, 4.5f, -9); C.transform.LookAt(c + new Vector3(2, 1.2f, 4));
            yield return null;
            R.SavePub(R.RenderPub(C, 2340, 1080), "phase2/" + id + "/low_angle.png");
        }
    }
}
