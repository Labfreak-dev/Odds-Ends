using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace Hollowmere.StyleTest
{
    /// <summary>Phase 4 proof: three attacks/spells per class with procedural VFX (StFx), shaped telegraphs, 8-frame attack strips,
    /// an enemy-telegraph sheet and one in-biome game-camera shot per class.</summary>
    public static class StPhase4Shots
    {
        static StyleTestRunner R; static Camera C;

        public class Ctx { public StActor hero; public Transform root; public Vector3 fwd, right, pos; public Camera cam; }
        public class Atk { public string cls, id, clip, label; public System.Action<Ctx, float> fx; }

        static float U(float t, float a, float b) => Mathf.Clamp01((t - a) / (b - a));
        static Color Fade(Color c, float k) { c.a *= k; return c * new Color(k, k, k, 1); }

        static readonly Color Steel = new Color(1.6f, 1.35f, 0.7f), Leaf = new Color(0.6f, 1.5f, 0.5f), Fire = new Color(2.0f, 0.8f, 0.25f),
            Frost = new Color(0.5f, 1.1f, 2.0f), Arcane = new Color(1.2f, 0.5f, 2.0f), Ally = new Color(0.35f, 0.75f, 1.4f), Foe = new Color(1.6f, 0.25f, 0.15f);

        static Vector3 StaffTip(Ctx c)
        {
            if (c.hero.weaponR) { var b = StWorld.Bounds(c.hero.weaponR); return new Vector3(b.center.x, b.max.y, b.center.z) + c.fwd * 0.2f; }
            return c.hero.handR ? c.hero.handR.position : c.pos + Vector3.up * 2;
        }
        static Vector3 Hand(Ctx c, bool right) { var h = right ? c.hero.handR : c.hero.handL; return h ? h.position : c.pos + Vector3.up * 1.6f + c.fwd * 0.5f; }

        // phase 5: the cube arrow is replaced by the KayKit arrow mesh (StVfx.Arrow) with a palette trail
        static void Arrow(Ctx c, Vector3 tail, Vector3 head, Color trail)
            => Skills.StVfx.Arrow(new Skills.VfxCtx { root = c.root, cam = c.cam }, tail, head, trail);

        static void Orb(Ctx c, Vector3 p, float r, Color col, Vector3 from)
        {
            StFx.Glow(p, r * 2.6f, Fade(col, 0.55f), c.cam, c.root); StFx.Glow(p, r * 1.1f, col, c.cam, c.root); StFx.Glow(p, r * 0.5f, new Color(2, 2, 2, 1), c.cam, c.root);
            if ((p - from).sqrMagnitude > 0.05f) StFx.Trail(Vector3.MoveTowards(p, from, 3f), p, r * 1.6f, Fade(col, 0.8f), c.cam, c.root);
        }

        public static readonly List<Atk> Attacks = new List<Atk>
        {
            // ---------------- knight ----------------
            new Atk { cls = "knight", id = "slash", clip = "Melee_1H_Attack_Chop", label = "Slash", fx = (c, t) => {
                float u = U(t, 0.28f, 0.55f), k = 1 - U(t, 0.62f, 0.85f);
                if (u > 0 && k > 0) StFx.Slash(c.pos + Vector3.up * 1.5f + c.fwd * 0.3f, Quaternion.LookRotation(c.fwd) * Quaternion.Euler(0, 0, 65), 2.4f, -85, -85 + 170 * u, Fade(Steel, k), c.root, 0.8f);
                StFx.Sparks(c.pos + c.fwd * 2.3f + Vector3.up * 0.9f, U(t, 0.5f, 0.85f), 1.4f, Steel, c.cam, c.root);
            } },
            new Atk { cls = "knight", id = "whirlwind", clip = "Melee_2H_Attack_Spin", label = "Whirlwind (skill, ring telegraph)", fx = (c, t) => {
                StFx.Telegraph(StFx.Shape.Circle, c.pos, 0, 3.2f, U(t, 0, 0.45f), Ally, c.root);
                float u = U(t, 0.3f, 0.85f), k = 1 - U(t, 0.85f, 1f);
                if (u > 0 && k > 0) { float head = u * 540; StFx.Slash(c.pos + Vector3.up * 1.1f, Quaternion.identity, 3.0f, head - 200, head, Fade(Steel, k), c.root, 0.7f); }
                StFx.Shock(c.pos, U(t, 0.55f, 1f), 3.6f, Steel, c.root);
            } },
            new Atk { cls = "knight", id = "shield_bash", clip = "Melee_Block_Attack", label = "Shield bash (cone telegraph)", fx = (c, t) => {
                StFx.Telegraph(StFx.Shape.Cone, c.pos + c.fwd * 0.3f, Quaternion.LookRotation(c.fwd).eulerAngles.y, 4.2f, U(t, 0, 0.4f), Ally, c.root, angle: 60);
                float u = U(t, 0.38f, 0.8f);
                if (u > 0 && u < 1) { var g = StFx.Obj("cone_wave", StFx.Sector(Mathf.Max(0, 4.2f * u - 0.8f), 4.2f * u, -30, 30, new Color(Steel.r, Steel.g, Steel.b, 0), Fade(Steel, 1 - u)), true, c.root);
                    g.transform.position = c.pos + c.fwd * 0.3f + Vector3.up * 0.9f; g.transform.rotation = Quaternion.LookRotation(c.fwd); }
                StFx.Sparks(Hand(c, false) + c.fwd * 0.4f, U(t, 0.38f, 0.7f), 1.1f, Steel, c.cam, c.root, 10);
            } },
            // ---------------- ranger ----------------
            new Atk { cls = "ranger", id = "shot", clip = "Ranged_Bow_Release", label = "Quick shot", fx = (c, t) => {
                var from = Hand(c, false) + c.fwd * 0.3f; float d = U(t, 0.2f, 0.7f) * 7.5f;
                if (d > 0 && d < 7.5f) Arrow(c, from, from + c.fwd * d, Leaf);
                StFx.Sparks(from + c.fwd * 7.5f, U(t, 0.7f, 1f), 1.2f, Leaf, c.cam, c.root);
                if (t < 0.25f) StFx.Glow(from, 0.35f, Fade(Leaf, 0.8f), c.cam, c.root);
            } },
            new Atk { cls = "ranger", id = "piercing_arrow", clip = "Ranged_Bow_Draw", label = "Piercing arrow (line telegraph)", fx = (c, t) => {
                var from = Hand(c, false) + c.fwd * 0.3f;
                StFx.Telegraph(StFx.Shape.Line, new Vector3(c.pos.x, 0, c.pos.z) + c.fwd * 0.6f, Quaternion.LookRotation(c.fwd).eulerAngles.y, 8f, U(t, 0, 0.6f), Ally, c.root, width: 1.3f);
                if (t < 0.62f) StFx.Glow(from, 0.25f + 0.5f * U(t, 0, 0.6f), Fade(Leaf, 0.9f), c.cam, c.root);
                float d = U(t, 0.62f, 0.85f) * 8.2f;
                if (d > 0 && d < 8.2f) { Arrow(c, from, from + c.fwd * d, Leaf); StFx.Trail(from, from + c.fwd * d, 0.5f, Fade(Leaf, 0.6f), c.cam, c.root); }
                StFx.Sparks(from + c.fwd * 8.2f, U(t, 0.85f, 1f), 1.3f, Leaf, c.cam, c.root);
            } },
            new Atk { cls = "ranger", id = "volley", clip = "Ranged_Bow_Release_Up", label = "Volley (circle telegraph)", fx = (c, t) => {
                var zone = new Vector3(c.pos.x, 0, c.pos.z) + c.fwd * 6.2f;
                StFx.Telegraph(StFx.Shape.Circle, zone, 0, 2.2f, U(t, 0, 0.7f), Ally, c.root);
                var from = Hand(c, false);
                float up = U(t, 0.2f, 0.45f); if (up > 0 && up < 1) Arrow(c, from, from + (Vector3.up * 2.5f + c.fwd * 0.6f) * (0.3f + up * 1.6f), Leaf);
                var rnd = new System.Random(5);
                for (int i = 0; i < 6; i++)
                {
                    var off = new Vector3((float)rnd.NextDouble() * 3.4f - 1.7f, 0, (float)rnd.NextDouble() * 3.4f - 1.7f);
                    float f = U(t, 0.5f + i * 0.04f, 0.8f + i * 0.03f);
                    var land = zone + off; var sky = land + Vector3.up * 9 - c.fwd * 2.5f;
                    if (f > 0 && f < 1) Arrow(c, sky, Vector3.Lerp(sky, land, f), Leaf);
                    StFx.Sparks(land + Vector3.up * 0.1f, U(t, 0.8f + i * 0.03f, 1f), 0.8f, Leaf, c.cam, c.root, 6, i);
                }
            } },
            // ---------------- mage ----------------
            new Atk { cls = "mage", id = "fire_bolt", clip = "Ranged_Magic_Shoot", label = "Fire bolt", fx = (c, t) => {
                var from = StaffTip(c); float d = U(t, 0.3f, 0.75f) * 7.5f;
                if (t < 0.32f) StFx.Glow(from, 0.3f + 0.4f * U(t, 0, 0.3f), Fire, c.cam, c.root);
                var to = new Vector3(from.x, 1.2f, from.z) + c.fwd * 7.5f; var p = Vector3.Lerp(from, to, d / 7.5f);
                if (d > 0 && d < 7.5f) Orb(c, p, 0.35f, Fire, from);
                float h = U(t, 0.75f, 1f); if (h > 0 && h < 1) { StFx.Sparks(to, h, 1.8f, Fire, c.cam, c.root); StFx.Glow(to, 1.4f * (1 - h) + 0.2f, Fade(Fire, 1 - h), c.cam, c.root); }
            } },
            new Atk { cls = "mage", id = "meteor", clip = "Ranged_Magic_Summon", label = "Meteor (circle telegraph)", fx = (c, t) => {
                var zone = new Vector3(c.pos.x, 0, c.pos.z) + c.fwd * 6f;
                if (t < 0.82f) StFx.Telegraph(StFx.Shape.Circle, zone, 0, 2.8f, U(t, 0, 0.78f), new Color(1f, 0.38f, 0.08f), c.root);
                StFx.Glow(StaffTip(c), 0.5f * (1 - U(t, 0.6f, 0.9f)) + 0.05f, Fire, c.cam, c.root);
                float f = U(t, 0.45f, 0.82f); var sky = zone + Vector3.up * 11 - c.fwd * 3;
                if (f > 0 && f < 1) Orb(c, Vector3.Lerp(sky, zone + Vector3.up * 0.5f, f * f), 0.75f, Fire, sky);
                float h = U(t, 0.82f, 1f); StFx.Shock(zone, h, 4.2f, Fire, c.root); StFx.Sparks(zone + Vector3.up * 0.3f, h, 3f, Fire, c.cam, c.root, 22);
                if (h > 0 && h < 1) StFx.Glow(zone + Vector3.up * 0.8f, 2.6f * (1 - h), Fade(Fire, 1 - h), c.cam, c.root);
            } },
            new Atk { cls = "mage", id = "frost_nova", clip = "Ranged_Magic_Spellcasting", label = "Frost nova (ring telegraph)", fx = (c, t) => {
                StFx.Telegraph(StFx.Shape.Ring, c.pos, 0, 4.2f, U(t, 0, 0.55f), Frost, c.root, inner: 0.35f);
                StFx.Glow(Hand(c, true), 0.45f * (1 - U(t, 0.55f, 0.7f)) + 0.05f, Frost, c.cam, c.root);
                float h = U(t, 0.55f, 1f); StFx.Shock(c.pos, h, 4.4f, Frost, c.root); StFx.Shock(c.pos, U(t, 0.62f, 1f), 3.2f, Frost * 0.7f, c.root);
                var rnd = new System.Random(9);
                if (h > 0) for (int i = 0; i < 10; i++)
                {
                    float a = i * 36 + (float)rnd.NextDouble() * 20; var p = c.pos + Quaternion.Euler(0, a, 0) * Vector3.forward * (1.5f + 2.6f * Mathf.Sqrt(h));
                    var s = GameObject.CreatePrimitive(PrimitiveType.Cube); Object.Destroy(s.GetComponent<Collider>()); s.transform.SetParent(c.root, false);
                    s.transform.position = p + Vector3.up * 0.3f; s.transform.rotation = Quaternion.Euler(20 + i * 7, a, 35); s.transform.localScale = new Vector3(0.25f, 0.9f * (1 - h * 0.5f), 0.25f);
                    s.GetComponent<Renderer>().sharedMaterial = StMat.Make("fx_ice", null, new Color(0.7f, 0.9f, 1f), false, 0, new Color(0.2f, 0.45f, 0.8f));
                }
            } },
        };

        static void Clear()
        {
            foreach (var go in Object.FindObjectsByType<GameObject>(FindObjectsSortMode.None))
                if (go.transform.parent == null && go != R.gameObject && go != C.gameObject && go.name != "Hollowmere") Object.Destroy(go);
            StWorld.Built.Clear(); C.orthographic = false; C.fieldOfView = 35; C.farClipPlane = 220;
            foreach (Transform t in C.transform) Object.Destroy(t.gameObject);
        }

        public static IEnumerator Run(StyleTestRunner r, Camera cam, string only)
        {
            R = r; C = cam; StPhase1Shots.Bind(r, cam);
            if (only == "phase4" || only == "p4_strips") yield return Strips();
            if (only == "phase4" || only == "p4_tele") yield return EnemyTelegraphs();
            if (only == "phase4" || only == "p4_game") yield return GameCams();
        }

        static StActor Hero(string cls, Vector3 p, float yaw)
        {
            var l = cls == "knight" ? StLook.Knight() : cls == "ranger" ? StLook.Ranger() : StLook.Mage();
            return l.Build(p, yaw);
        }

        static void Blit(Texture2D dst, Texture2D src, int x, int y) { dst.SetPixels(x, y, src.width, src.height, src.GetPixels()); }

        static IEnumerator Strips()
        {
            const int W = 640, H = 480, N = 8;
            foreach (var cls in new[] { "knight", "ranger", "mage" })
            {
                Clear(); yield return null;
                StWorld.NeutralLighting(); C.backgroundColor = new Color(0.16f, 0.17f, 0.2f);
                var floor = GameObject.CreatePrimitive(PrimitiveType.Plane); floor.transform.localScale = new Vector3(6, 1, 6); floor.transform.position = new Vector3(4, 0, 0);
                floor.GetComponent<Renderer>().sharedMaterial = StMat.Make("p4_floor", null, new Color(0.36f, 0.37f, 0.42f), false);
                var hero = Hero(cls, Vector3.zero, 90); var fx = new GameObject("fx").transform;
                var atks = Attacks.FindAll(a => a.cls == cls);
                var sheet = new Texture2D(W * N, H * atks.Count, TextureFormat.RGB24, false);
                C.fieldOfView = 40; C.transform.position = new Vector3(4.0f, 4.8f, -8.8f); C.transform.LookAt(new Vector3(4.0f, 1.3f, 0.3f));
                for (int ai = 0; ai < atks.Count; ai++)
                {
                    var a = atks[ai];
                    if (hero.anim.GetClip(a.clip) == null) Debug.LogWarning("[ST] p4 noclip " + cls + " " + a.clip);
                    var single = new Texture2D(W * N, H, TextureFormat.RGB24, false);
                    for (int f = 0; f < N; f++)
                    {
                        float t = (f + 0.5f) / N;
                        StFx.Clear(fx); hero.Pose(a.clip, t); yield return null; hero.Pose(a.clip, t);
                        var c = new Ctx { hero = hero, root = fx, fwd = hero.transform.forward, right = hero.transform.right, pos = hero.transform.position, cam = C };
                        a.fx(c, t);
                        var tile = R.RenderPub(C, W, H); Blit(sheet, tile, f * W, (atks.Count - 1 - ai) * H); Blit(single, tile, f * W, 0); Object.Destroy(tile);
                    }
                    single.Apply(); R.SavePub(single, "phase4/" + cls + "/strip_" + a.id + ".jpg", true); Object.Destroy(single);
                    Debug.Log("[ST] p4 strip " + cls + " " + a.id);
                }
                sheet.Apply(); R.SavePub(sheet, "phase4/" + cls + "/attacks_" + cls + ".jpg", true); Object.Destroy(sheet);
                StFx.Clear(fx);
            }
        }

        static IEnumerator EnemyTelegraphs()
        {
            Clear(); yield return null;
            StBiomes.Build("crypt"); C.backgroundColor = RenderSettings.fogColor;
            var hero = StLook.Knight().Build(StBiomes.Hero, 0); hero.Pose(hero.idle, 0.3f);
            var fx = new GameObject("fx").transform; var c = StBiomes.Hero;
            var ros = StBestiary.Rosters["crypt"];
            var boss = StBestiary.Spawn(ros.Find(e => e.tier == 2), c + new Vector3(-4.5f, 0, 7.5f), 160);
            var elite = StBestiary.Spawn(ros.Find(e => e.tier == 1), c + new Vector3(5.5f, 0, 5.5f), 230);
            var mage = StBestiary.Spawn(ros[1], c + new Vector3(-6.5f, 0, 1f), 100);
            var war = StBestiary.Spawn(ros[0], c + new Vector3(4.5f, 0, -1.5f), 280);
            StFx.Telegraph(StFx.Shape.Circle, c + new Vector3(-3.6f, 0, 5.2f), 0, 3.0f, 0.65f, Foe, fx);                          // boss slam
            StFx.Telegraph(StFx.Shape.Cone, c + new Vector3(5.5f, 0, 5.5f), 230, 5.0f, 0.4f, Foe, fx, angle: 55);                    // elite breath / cleave
            StFx.Telegraph(StFx.Shape.Line, c + new Vector3(-6.5f, 0, 1f), 100, 9f, 0.8f, new Color(1.6f, 0.6f, 0.1f), fx, width: 1.4f); // caster beam
            StFx.Telegraph(StFx.Shape.Ring, c + new Vector3(4.5f, 0, -1.5f), 0, 3.2f, 0.25f, Foe, fx, inner: 0.5f);               // spin ring
            if (boss && boss.anim) boss.Pose(boss.attack, 0.25f);
            yield return null; yield return null;
            foreach (var (tag, dist) in new[] { ("telegraphs_gamecam", 17f), ("telegraphs_overview", 26f) })
            {
                C.fieldOfView = 35; var tgt = c + new Vector3(0, 1.0f, 3.0f);
                C.transform.position = tgt + Quaternion.Euler(52, 0, 0) * new Vector3(0, 0, -dist); C.transform.rotation = Quaternion.Euler(52, 0, 0);
                yield return null; R.SavePub(R.RenderPub(C, 2340, 1080), "phase4/telegraphs/" + tag + ".png");
            }
        }

        static IEnumerator GameCams()
        {
            var plan = new[] { ("knight", "crypt", "slash", 0.45f), ("knight", "crypt", "whirlwind", 0.62f), ("ranger", "cave", "volley", 0.72f), ("ranger", "cave", "piercing_arrow", 0.76f),
                               ("mage", "mine", "meteor", 0.7f), ("mage", "mine", "frost_nova", 0.72f), ("mage", "sewer", "fire_bolt", 0.6f) };
            foreach (var (cls, biome, atk, t) in plan)
            {
                Clear(); yield return null;
                StBiomes.Build(biome); C.backgroundColor = RenderSettings.fogColor;
                var hp = StBiomes.Hero; var hero = Hero(cls, hp, 0); var a = Attacks.Find(x => x.cls == cls && x.id == atk);
                var ros = StBestiary.Rosters[biome]; var spots = new[] { new Vector3(-1.5f, 0, 7.5f), new Vector3(1.8f, 0, 6.5f), new Vector3(0.2f, 0, 9.0f), new Vector3(-4f, 0, 4f), new Vector3(3.8f, 0, 3.2f) };
                for (int i = 0; i < spots.Length; i++)
                {
                    var m = StBestiary.Spawn(ros[i % 5], hp + spots[i], 180); if (m && m.anim && m.anim.GetClip(m.run) != null) m.Pose(m.run, 0.2f * i);
                }
                var fx = new GameObject("fx").transform;
                C.fieldOfView = 35; var tgt = hp + new Vector3(0, 1.2f, 3.5f);
                C.transform.position = tgt + Quaternion.Euler(52, 0, 0) * new Vector3(0, 0, -17f); C.transform.rotation = Quaternion.Euler(52, 0, 0);
                hero.Pose(a.clip, t); yield return null; hero.Pose(a.clip, t);
                a.fx(new Ctx { hero = hero, root = fx, fwd = hero.transform.forward, right = hero.transform.right, pos = hero.transform.position, cam = C }, t);
                var hud = StPhase1Shots.Hud(); yield return null;
                R.SavePub(R.RenderPub(C, 2340, 1080), "phase4/" + cls + "/gamecam_" + atk + "_" + biome + ".png");
                if (hud) Object.Destroy(hud);
            }
        }
    }
}
