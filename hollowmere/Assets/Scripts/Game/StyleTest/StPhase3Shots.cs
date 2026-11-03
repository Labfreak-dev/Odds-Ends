using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace Hollowmere.StyleTest
{
    /// <summary>Phase 3 proof per biome: roster lineup, turnaround + attack strip per monster, and the roster fighting the hero in its biome.</summary>
    public static class StPhase3Shots
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
            {
                if (only == "phase3" || only == "p3_" + id) yield return Lineup(id);
                if (only == "phase3" || only == "p3_" + id || only == "p3scene_" + id) yield return Scene(id);
            }
        }

        static IEnumerator Lineup(string id)
        {
            Clear(); yield return null;
            StWorld.NeutralLighting(); C.backgroundColor = new Color(0.56f, 0.57f, 0.59f);
            var ros = StBestiary.Rosters[id]; var made = new List<StActor>(); float x = 0;
            foreach (var e in ros)
            {
                var a = StBestiary.Spawn(e, Vector3.zero, 155); if (!a) continue;
                var b = a.WorldBounds(); float w = Mathf.Max(1.5f, b.size.x);
                a.transform.position = new Vector3(x + w * 0.5f - b.center.x + a.transform.position.x, a.transform.position.y, 0); x += w + 1.0f;
                made.Add(a);
            }
            var hero = StLook.Knight().Build(new Vector3(x + 1, 0, 0), 180); hero.Pose(hero.idle, 0.3f); x += 2;
            yield return null;
            var all = new Bounds(new Vector3(x * 0.5f, 2, 0), Vector3.one); foreach (var a in made) all.Encapsulate(a.WorldBounds()); all.Encapsulate(hero.WorldBounds()); all.Expand(new Vector3(1.5f,0.5f,0));
            C.orthographic = true; C.orthographicSize = Mathf.Max(all.size.y * 0.62f, all.size.x * 1300f / 2800f * 0.55f);
            C.transform.position = new Vector3(all.center.x, all.center.y, -40); C.transform.rotation = Quaternion.identity;
            R.SavePub(R.RenderPub(C, 2800, 1300), "phase3/" + id + "/lineup.png");
            foreach (var a in made) if (a) Object.Destroy(a.gameObject); Object.Destroy(hero.gameObject); yield return null;
            foreach (var e in ros)
            {
                var a = StBestiary.Spawn(e, Vector3.zero, 155); if (!a) continue;
                yield return R.TurnPub(a, "phase3/" + id + "/turn_" + e.id, a.idle, 0.3f);
                if (a.anim && a.anim.GetClip(a.attack) != null) yield return R.StripPub(a, "phase3/" + id + "/strip_" + e.id + "_attack", a.attack);
                Object.Destroy(a.gameObject); yield return null;
            }
        }

        /// <summary>Boss stands off the hero->camera line so neither hides the other.</summary>
        public static Vector3 BossPos(string id)
        {
            var c = StBiomes.Centre;
            return c + (id == "mine" ? new Vector3(3.5f, 0, 3.6f) : id == "crypt" ? new Vector3(1.5f, 0, 9.5f) : new Vector3(2.5f, 0, 7.0f)) * StScale.DU * StScale.DungeonKit;
        }

        static IEnumerator Scene(string id)
        {
            Clear(); yield return null;
            StBiomes.Build(id); C.backgroundColor = RenderSettings.fogColor;
            var hi = System.Array.IndexOf(StBiomes.Ids, id) % 3;
            var hero = StLook.Base[hi].Build(StBiomes.Hero, 20); hero.Pose(hero.attack, 0.45f);
            var ros = StBestiary.Rosters[id]; var c = StBiomes.Centre;
            var spots = new List<Vector3>(StBiomes.Spawns);
            spots.Add(StBiomes.Hero + new Vector3(-3.5f, 0, 2.5f) * StScale.DU); spots.Add(StBiomes.Hero + new Vector3(3.5f, 0, 2.2f) * StScale.DU); spots.Add(StBiomes.Hero + new Vector3(5.5f, 0, -0.5f) * StScale.DU);
            int si = 0;
            foreach (var e in ros)
            {
                Vector3 p = e.tier == 2 ? BossPos(id) : spots[si++ % spots.Count];
                var d = StBiomes.Hero - p; d.y = 0;
                var a = StBestiary.Spawn(e, p, Quaternion.LookRotation(d.sqrMagnitude > 0.01f ? d : Vector3.back).eulerAngles.y);
                if (a && a.anim && a.anim.GetClip(a.attack) != null) a.Pose(a.attack, 0.3f + 0.1f * si);
            }
            yield return null; yield return null;
            C.fieldOfView = 40; C.transform.position = c + new Vector3(0, 30, -26) * StScale.DU; C.transform.LookAt(c + new Vector3(0, 0, 1) * StScale.DU);
            yield return null; R.SavePub(R.RenderPub(C, 2340, 1080), "phase3/" + id + "/fight_overview.png");
            var hud = StPhase1Shots.Hud();
            foreach (var (tag, focus, dist) in new[] { ("gamecam", StBiomes.Hero + new Vector3(0, 0, 2.5f) * StScale.DU, 17f * StScale.DU), ("gamecam_boss", Vector3.Lerp(StBiomes.Hero, BossPos(id), 0.45f), 21f * StScale.DU) })
            {
                C.fieldOfView = 35; var tgt = focus + new Vector3(0, 1.2f, 1.0f) * StScale.DU;
                C.transform.position = tgt + Quaternion.Euler(52, 0, 0) * new Vector3(0, 0, -dist); C.transform.rotation = Quaternion.Euler(52, 0, 0);
                yield return null; R.SavePub(R.RenderPub(C, 2340, 1080), "phase3/" + id + "/" + tag + ".png");
            }
            if (hud) Object.Destroy(hud);
        }
    }
}
