using System.Collections.Generic;
using UnityEngine;

namespace Hollowmere.StyleTest
{
    /// <summary>Phase 3: per-biome monster rosters from free packs (KayKit Skeletons, Quaternius Easy Enemies + LowPoly Monsters,
    /// Kenney Graveyard characters, owned Quaternius Bestiary if present) plus repo monsters re-surfaced on StToon.
    /// Tiers: 0 normal, 1 elite (x1.3, tier-2 ring + tinted rim glow), 2 boss (big, tier-3 ring + emissive accents + light).</summary>
    public static class StBestiary
    {
        public enum Surf { Keep, Flat, TexToon }
        public class Entry
        {
            public string id, src; public float h; public Surf surf; public Color pal = Color.white, emis; public int tier; public string tex;
            public Entry(string id, string src, float h, Surf surf, int tier = 0) { this.id = id; this.src = src; this.h = h; this.surf = surf; this.tier = tier; }
            public Entry P(Color c) { pal = c; return this; }
            public Entry E(Color c) { emis = c; return this; }
            public Entry T(string t) { tex = t; return this; }
        }

        public static readonly Dictionary<string, List<Entry>> Rosters = new Dictionary<string, List<Entry>>
        {
            { "crypt", new List<Entry> {
                new Entry("skel_warrior", "KK:Skel/Skeleton_Warrior", 0, Surf.Keep),
                new Entry("skel_mage", "KK:Skel/Skeleton_Mage", 0, Surf.Keep),
                new Entry("skel_rogue", "KK:Skel/Skeleton_Rogue", 0, Surf.Keep),
                new Entry("skel_minion", "KK:Skel/Skeleton_Minion", 0, Surf.Keep),
                new Entry("lp_skeleton", "ST/Mon/LP_Skeleton", StScale.Enemy, Surf.Keep).P(new Color(0.85f, 0.85f, 0.95f)),
                new Entry("elite_wraith", "Models/hm_wraith", StScale.Elite, Surf.Flat, 1).P(new Color(0.42f, 0.38f, 0.58f)).E(new Color(0.12f, 0.08f, 0.3f)),
                new Entry("boss_death", "Models/st_death", StScale.Boss, Surf.TexToon, 2).P(new Color(0.62f, 0.6f, 0.78f)).E(new Color(0.18f, 0.1f, 0.4f)),
            } },
            { "cave", new List<Entry> {
                new Entry("spider", "ST/Mon/Easy_Spider", 1.0f, Surf.Keep),
                new Entry("bat", "ST/Mon/LP_Bat", 1.0f, Surf.Keep),
                new Entry("snake", "ST/Mon/Easy_Snake", 0.8f, Surf.Keep),
                new Entry("slime", "ST/Mon/LP_Slime", 1.0f, Surf.Keep),
                new Entry("frog", "ST/Mon/Easy_Frog", 0.8f, Surf.Keep),
                new Entry("elite_warwolf", "Models/hm_warwolf", StScale.Elite, Surf.Flat, 1).P(new Color(0.38f, 0.33f, 0.42f)).E(new Color(0.05f, 0.18f, 0.3f)),
                new Entry("boss_dragon", "ST/Mon/LP_Dragon", StScale.Boss, Surf.Keep, 2).P(new Color(0.8f, 0.5f, 0.85f)).E(new Color(0.08f, 0.04f, 0.12f)),
            } },
            { "sewer", new List<Entry> {
                new Entry("rat", "ST/Mon/Easy_Rat", 0.6f, Surf.Keep),
                new Entry("snake_angry", "ST/Mon/Easy_Snake_angry", 0.8f, Surf.Keep),
                new Entry("wasp", "ST/Mon/Easy_Wasp", 1.0f, Surf.Keep),
                new Entry("slime_green", "ST/Mon/LP_Slime", 1.0f, Surf.Keep).P(new Color(0.6f, 1.2f, 0.5f)),
                new Entry("rat_brute", "Models/hm_rat", 1.5f, Surf.Flat).P(new Color(0.55f, 0.5f, 0.45f)),
                new Entry("elite_horror", "Models/hm_horror_ghoul", StScale.Elite, Surf.Flat, 1).P(new Color(0.55f, 0.62f, 0.45f)).E(new Color(0.08f, 0.2f, 0.05f)),
                new Entry("boss_mutant", "Models/hm_giant_mutant", StScale.Boss, Surf.Flat, 2).P(new Color(0.5f, 0.66f, 0.4f)).E(new Color(0.1f, 0.25f, 0.05f)),
            } },
            { "mine", new List<Entry> {
                new Entry("imp", "STO/Mon/Imp", 1.7f, Surf.Keep).T("T_Imp_BaseColor_1"),
                new Entry("puglin", "STO/Mon/Puglin", 1.2f, Surf.Keep).T("T_Puglin_BaseColor_1"),
                new Entry("crawler", "Models/hm_cave_crawler", 1.0f, Surf.Flat).P(new Color(0.6f, 0.45f, 0.35f)),
                new Entry("spider_rock", "Models/hm_spider", 1.0f, Surf.Flat).P(new Color(0.5f, 0.4f, 0.35f)),
                new Entry("skel_miner", "KK:Skel/Skeleton_Minion", 0, Surf.Keep),
                new Entry("elite_imp", "STO/Mon/Imp", StScale.Elite, Surf.Keep, 1).T("T_Imp_BaseColor_3"),
                new Entry("boss_lava_golem", "Models/hm_lava_golem", StScale.Boss, Surf.TexToon, 2).P(new Color(1.9f, 1.7f, 1.6f)).E(new Color(0.5f, 0.15f, 0.02f)),
            } },
        };

        static readonly Dictionary<string, AnimationClip[]> clipCache = new Dictionary<string, AnimationClip[]>();

        public static StActor Spawn(Entry e, Vector3 pos, float yaw)
        {
            StActor a;
            if (e.src.StartsWith("KK:"))
            {
                a = StyleTestRunner.Skeleton(false, pos, e.src.Substring(3));
                a.transform.rotation = Quaternion.Euler(0, yaw, 0);
            }
            else
            {
                var p = Resources.Load<GameObject>(e.src);
                if (p == null) { Debug.LogWarning("[ST] monster missing " + e.src); return null; }
                var holder = new GameObject(e.id); holder.transform.position = pos; holder.transform.rotation = Quaternion.Euler(0, yaw, 0);
                var g = Object.Instantiate(p, holder.transform); g.transform.localPosition = Vector3.zero;
                // Quaternius/Kenney FBX face -Z? keep authored facing; repo glb face +Z
                foreach (var sk in g.GetComponentsInChildren<SkinnedMeshRenderer>()) sk.updateWhenOffscreen = true;
                Resurface(g, e);
                var b = StWorld.Bounds(g); if (b.size.y > 0.01f && e.h > 0) g.transform.localScale *= e.h / b.size.y;
                a = holder.AddComponent<StActor>();
                a.anim = g.GetComponentInChildren<Animation>() ?? g.AddComponent<Animation>();
                a.anim.cullingType = AnimationCullingType.AlwaysAnimate; a.anim.playAutomatically = false;
                if (a.anim.GetClipCount() == 0 && e.src.StartsWith("STO/"))
                {   // Bestiary FBX ship without clips but use the UE/Quaternius rig names -> borrow the UAL clips
                    foreach (var kv in StFolk.Clips) a.anim.AddClip(kv.Value, kv.Key);
                    foreach (AnimationState st in a.anim) st.wrapMode = WrapMode.Loop;
                    a.idle = "Idle_Loop"; a.run = "Walk_Loop"; a.attack = a.anim.GetClip("Punch_Cross") ? "Punch_Cross" : "Idle_Loop"; a.hit = "Hit_Chest"; a.death = "Death01";
                }
                else PickClips(a);
                var bb = StWorld.Bounds(g); holder.transform.position += Vector3.up * (pos.y - bb.min.y);
            }
            // 1 u = 1 m: e.h is the FINAL measured height in metres (StScale). KayKit skeletons come out at hero height (1.8 m)
            // from StActor.Make, so only they need the tier multiplier.
            if (e.src.StartsWith("KK:") && e.tier > 0) a.transform.localScale *= e.tier == 1 ? StScale.EliteMul : StScale.BossMul;
            if (e.tier == 1) { StGlow.Apply(a, 2); Accent(a, e.emis == default ? new Color(0.25f, 0.2f, 0.05f) : e.emis * 1.6f); }
            if (e.tier == 2)
            {
                StGlow.Apply(a, 3); Accent(a, e.emis * 1.2f);
                var l = new GameObject("boss_light").AddComponent<Light>(); l.type = LightType.Point; l.range = 10 * StScale.DU; l.intensity = 3 * StScale.DU * StScale.DU;
                l.color = e.emis.maxColorComponent > 0 ? e.emis / e.emis.maxColorComponent : Color.white; l.transform.SetParent(a.transform, false); l.transform.localPosition = new Vector3(0, 1.5f / Mathf.Max(0.01f, a.transform.localScale.y), 0);
            }
            if (e.id == "boss_death") { a.idle = "Cast_Windup"; a.run = "Cast_Windup"; a.attack = "Attack_Scythe"; }
            if (a.anim && a.anim.GetClip(a.idle) != null) a.Pose(a.idle, 0.2f);
            // measured in the pose it is seen in (bind poses differ: borrowed UAL clips stretch the Bestiary rigs, bosses crouch)
            if (!e.src.StartsWith("KK:") && e.h > 0) { StScale.NormalizeHeight(a.gameObject, StScale.Cat.Enemy, e.h, pos.y); StScale.SettleNextFrame(a.gameObject, e.h, pos.y); }
            return a;
        }

        static void Resurface(GameObject g, Entry e)
        {
            Texture over = null;
            if (!string.IsNullOrEmpty(e.tex)) over = Resources.Load<Texture2D>("STO/Mon/" + e.tex);
            foreach (var r in g.GetComponentsInChildren<Renderer>())
            {
                var ms = r.sharedMaterials;
                for (int k = 0; k < ms.Length; k++)
                {
                    var o = ms[k]; Texture tex = over ? over : (o && o.HasProperty("_BaseMap") ? o.GetTexture("_BaseMap") : (o ? o.mainTexture : null));
                    Color col = o && o.HasProperty("_BaseColor") ? o.GetColor("_BaseColor") : (o && o.HasProperty("_Color") ? o.GetColor("_Color") : Color.white);
                    Material m;
                    string key = e.id + "_" + k + "_" + (o ? o.name : "x");
                    switch (e.surf)
                    {
                        case Surf.Flat: m = StMat.Make("bst_" + key, null, e.pal, false, 0, e.emis * 0.5f, e.id.Contains("mutant")); break;
                        case Surf.TexToon: m = StMat.Make("bst_" + key, tex, e.pal, false, 0, e.emis * 0.4f, true); break;
                        default: m = StMat.Make("bst_" + key, tex, col * e.pal, false, 0, e.emis * 0.5f); break;
                    }
                    m.SetFloat("_Ramp", 0.14f); m.SetFloat("_Shade", 0.55f); m.SetFloat("_Rim", 0.45f);
                    m.SetFloat("_Outline", e.tier == 2 ? 1.6f : 1.3f);
                    ms[k] = m;
                }
                r.sharedMaterials = ms; r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.On;
            }
        }

        /// <summary>Elite/boss read: emissive eyes near the head front + a pair of horn spikes, all on StToon.</summary>
        static void Adorn(StActor a, Entry e)
        {
            var b = a.WorldBounds(); if (b.size.y < 0.2f) return;
            var ec = e.emis.maxColorComponent > 0 ? e.emis / e.emis.maxColorComponent : new Color(1f, 0.6f, 0.2f);
            var eye = StMat.Make("adorn_eye_" + e.id, null, ec, false, 0, ec * 2.5f);
            var horn = StMat.Make("adorn_horn_" + e.id, null, new Color(0.9f, 0.86f, 0.75f), false);
            var head = a.transform.InverseTransformPoint(new Vector3(b.center.x, b.max.y - b.size.y * 0.12f, b.center.z));
            float s = Mathf.Clamp(b.size.y * 0.035f, 0.06f, 0.3f) / Mathf.Max(0.01f, a.transform.lossyScale.y);
            float fwd = b.extents.z * 0.85f / Mathf.Max(0.01f, a.transform.lossyScale.z);
            for (int i = -1; i <= 1; i += 2)
            {
                var g = GameObject.CreatePrimitive(PrimitiveType.Sphere); Object.Destroy(g.GetComponent<Collider>());
                g.name = "eye"; g.transform.SetParent(a.transform, false); g.transform.localPosition = head + new Vector3(i * s * 1.6f, 0, fwd); g.transform.localScale = Vector3.one * s;
                g.GetComponent<Renderer>().sharedMaterial = eye;

            }
        }

        static void Accent(StActor a, Color c)
        {
            if (c.maxColorComponent <= 0) return;
            foreach (var r in a.GetComponentsInChildren<Renderer>())
                foreach (var m in r.sharedMaterials) if (m && m.shader == StMat.Toon) { var mm = m; mm.SetColor("_Emission", mm.GetColor("_Emission") + c * 0.35f); }
        }

        static void PickClips(StActor a)
        {
            string idle = null, run = null, atk = null, hit = null, death = null, any = null;
            foreach (AnimationState st in a.anim)
            {
                var n = st.name.ToLowerInvariant(); any = any ?? st.name;
                if (idle == null && n.Contains("idle")) idle = st.name;
                if (run == null && (n.Contains("run") || n.Contains("walk") || n.Contains("fly") || n.Contains("move"))) run = st.name;
                if (atk == null && (n.Contains("attack") || n.Contains("bite") || n.Contains("punch") || n.Contains("sweep") || n.Contains("scythe") || n.Contains("sting") || n.Contains("weapon"))) atk = st.name;
                if (hit == null && (n.Contains("hit") || n.Contains("flinch") || n.Contains("damage"))) hit = st.name;
                if (death == null && (n.Contains("death") || n.Contains("die") || n.Contains("defeat"))) death = st.name;
            }
            a.idle = idle ?? run ?? any ?? "none"; a.run = run ?? a.idle; a.attack = atk ?? a.idle; a.hit = hit ?? a.idle; a.death = death ?? a.idle;
            var names = new List<string>(); foreach (AnimationState st in a.anim) names.Add(st.name);
            Debug.Log("[ST] clips " + a.name + ": idle=" + a.idle + " run=" + a.run + " atk=" + a.attack + " | " + string.Join(",", names));
        }
    }
}
