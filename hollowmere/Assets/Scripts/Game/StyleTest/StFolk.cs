using System.Collections.Generic;
using UnityEngine;

namespace Hollowmere.StyleTest
{
    /// <summary>Town villagers and the model-agnostic hero proof: Quaternius Universal Base Character body + a
    /// Modular Outfit + hair, all skinned to one skeleton, animated with the Universal Animation Library (Legacy clips).
    /// Same StActor API as KayKit heroes, so anything with the socket standard plugs in.</summary>
    public static class StFolk
    {
        static Dictionary<string, AnimationClip> clips;
        public static Dictionary<string, AnimationClip> Clips
        {
            get
            {
                if (clips != null) return clips;
                clips = new Dictionary<string, AnimationClip>();
                foreach (var o in Resources.LoadAll<AnimationClip>("ST/Folk"))
                {
                    var n = o.name; var bar = n.LastIndexOf('|'); if (bar >= 0) n = n.Substring(bar + 1);
                    if (!clips.ContainsKey(n)) clips[n] = o;
                }
                Debug.Log("[ST] folk clips " + clips.Count);
                return clips;
            }
        }

        public class Recipe { public string id, body, outfit, hair, brows, skinTex, outfitTex; public Color hairTint = Color.white; }

        public static readonly Recipe[] Villagers =
        {
            new Recipe { id = "villager_m1", body = "Superhero_Male_FullBody", outfit = "Male_Peasant", hair = "Hair_SimpleParted", brows = "Eyebrows_Regular", skinTex = "T_Superhero_Male_Ligh", outfitTex = "T_Peasant_BaseColor", hairTint = new Color(0.55f, 0.36f, 0.22f) },
            new Recipe { id = "villager_m2", body = "Superhero_Male_FullBody", outfit = "Male_Peasant", hair = "Hair_Beard", brows = "Eyebrows_Regular", skinTex = "T_Superhero_Male_Dark", outfitTex = "T_Peasant_2_BaseColor", hairTint = new Color(0.25f, 0.18f, 0.12f) },
            new Recipe { id = "villager_f1", body = "Superhero_Female_FullBody", outfit = "Female_Peasant", hair = "Hair_Buns", brows = "Eyebrows_Female", skinTex = "T_Superhero_Female_Light_BaseColor", outfitTex = "T_Peasant_BaseColor", hairTint = new Color(0.75f, 0.5f, 0.25f) },
            new Recipe { id = "villager_f2", body = "Superhero_Female_FullBody", outfit = "Female_Peasant", hair = "Hair_Long", brows = "Eyebrows_Female", skinTex = "T_Superhero_Female_Dark_BaseColor", outfitTex = "T_Peasant_2_BaseColor", hairTint = new Color(0.2f, 0.14f, 0.1f) },
        };
        public static readonly Recipe QRanger = new Recipe { id = "q_ranger_generic", body = "Superhero_Male_FullBody", outfit = "Male_Ranger", hair = null, brows = "Eyebrows_Regular", skinTex = "T_Superhero_Male_Ligh", outfitTex = "T_Ranger_BaseColor" };

        static GameObject Load(string n) => Resources.Load<GameObject>("ST/Folk/" + n);

        /// <summary>Instantiate a skinned part and rebind its bones onto the body skeleton (by bone name).</summary>
        static void Graft(GameObject body, string part, Material mat)
        {
            if (string.IsNullOrEmpty(part)) return;
            var p = Load(part); if (p == null) { Debug.LogError("[ST] folk part missing " + part); return; }
            var g = Object.Instantiate(p);
            var map = new Dictionary<string, Transform>();
            foreach (var t in body.GetComponentsInChildren<Transform>()) if (!map.ContainsKey(t.name)) map[t.name] = t;
            foreach (var sk in g.GetComponentsInChildren<SkinnedMeshRenderer>())
            {
                var bones = sk.bones; var nb = new Transform[bones.Length]; bool ok = true;
                for (int i = 0; i < bones.Length; i++) { if (bones[i] != null && map.TryGetValue(bones[i].name, out var b)) nb[i] = b; else ok = false; }
                if (!ok) Debug.LogWarning("[ST] graft " + part + " missing bones");
                sk.bones = nb;
                if (sk.rootBone != null && map.TryGetValue(sk.rootBone.name, out var rb)) sk.rootBone = rb;
                sk.transform.SetParent(body.transform, false);
                sk.updateWhenOffscreen = true;
                if (mat) { var ms = sk.sharedMaterials; for (int i = 0; i < ms.Length; i++) ms[i] = mat; sk.sharedMaterials = ms; }
            }
            Object.Destroy(g);
        }

        static Material TexMat(string tex, Color tint)
        {
            var t = Resources.Load<Texture2D>("ST/Folk/" + tex);
            var m = StMat.Make("folk_" + tex + ColorUtility.ToHtmlStringRGB(tint), t, tint, false);
            m.SetFloat("_Shade", 0.62f);
            return m;
        }

        static readonly Dictionary<Mesh, Mesh> headCache = new Dictionary<Mesh, Mesh>();
        static void HeadOnly(SkinnedMeshRenderer sk)
        {
            var src = sk.sharedMesh; if (src == null || !src.isReadable) return;
            if (!headCache.TryGetValue(src, out var m))
            {
                var bones = sk.bones; var keep = new bool[bones.Length];
                for (int i = 0; i < bones.Length; i++) { var n = bones[i] ? bones[i].name.ToLowerInvariant() : ""; keep[i] = n.Contains("head") || n.Contains("neck") || n.Contains("eye") || n.Contains("jaw"); }
                var bw = src.boneWeights; m = Object.Instantiate(src); m.name = src.name + "_head";
                for (int s = 0; s < src.subMeshCount; s++)
                {
                    var tris = src.GetTriangles(s); var outT = new List<int>();
                    for (int t = 0; t < tris.Length; t += 3)
                    {
                        bool ok = true;
                        for (int k = 0; k < 3; k++) { var w = bw[tris[t + k]]; if (!keep[w.boneIndex0] || w.weight0 < 0.5f) { ok = false; break; } }
                        if (ok) { outT.Add(tris[t]); outT.Add(tris[t + 1]); outT.Add(tris[t + 2]); }
                    }
                    m.SetTriangles(outT, s);
                }
                headCache[src] = m;
            }
            sk.sharedMesh = m;
        }

        public static StActor Make(Recipe r, Vector3 pos, float yaw)
        {
            var p = Load(r.body); if (p == null) { Debug.LogError("[ST] folk body missing " + r.body); return null; }
            // holder (actor root) + model child turned 180: Quaternius models face -Z, KayKit/Hollowmere actors face +Z
            var holder = new GameObject(r.id); holder.transform.position = pos; holder.transform.rotation = Quaternion.Euler(0, yaw, 0);
            var g = Object.Instantiate(p, holder.transform); g.name = r.body;
            g.transform.localPosition = Vector3.zero; g.transform.localRotation = Quaternion.Euler(0, 180, 0);
            // body: the outfits are cut for the "Regular" body and carry their own skin parts, so only the head/neck of the
            // base body is kept (triangles weighted to head/neck bones); eyes keep their own material
            foreach (var sk in g.GetComponentsInChildren<SkinnedMeshRenderer>())
            {
                sk.updateWhenOffscreen = true;
                if (r.outfit != null) HeadOnly(sk);
                var ms = sk.sharedMaterials;
                for (int i = 0; i < ms.Length; i++)
                {
                    var n = ms[i] ? ms[i].name.ToLowerInvariant() : "";
                    ms[i] = n.Contains("eye") ? TexMat("T_Eye_Brown", Color.white) : TexMat(r.skinTex, Color.white);
                }
                sk.sharedMaterials = ms;
            }
            var outfitMat = TexMat(r.outfitTex, Color.white);
            // outfit parts: cloth gets the outfit texture, exposed skin parts keep the body skin
            var op = Load(r.outfit);
            if (op != null)
            {
                var og = Object.Instantiate(op);
                var map = new Dictionary<string, Transform>();
                foreach (var t in g.GetComponentsInChildren<Transform>()) if (!map.ContainsKey(t.name)) map[t.name] = t;
                foreach (var sk in og.GetComponentsInChildren<SkinnedMeshRenderer>())
                {
                    var bones = sk.bones; var nb = new Transform[bones.Length];
                    for (int i = 0; i < bones.Length; i++) nb[i] = bones[i] != null && map.TryGetValue(bones[i].name, out var b) ? b : null;
                    sk.bones = nb; if (sk.rootBone && map.TryGetValue(sk.rootBone.name, out var rb)) sk.rootBone = rb;
                    sk.transform.SetParent(g.transform, false); sk.updateWhenOffscreen = true;
                    var ms = sk.sharedMaterials;
                    for (int i = 0; i < ms.Length; i++) { var n = ms[i] ? ms[i].name : ""; ms[i] = n.Contains("Regular") ? TexMat(r.skinTex, Color.white) : outfitMat; }
                    sk.sharedMaterials = ms;
                }
                Object.Destroy(og);
            }
            Graft(g, r.hair, TexMat("T_Hair_1_BaseColor", r.hairTint));
            Graft(g, r.brows, TexMat("T_Hair_1_BaseColor", r.hairTint * 0.8f));
            foreach (var rr in g.GetComponentsInChildren<Renderer>()) { rr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.On; }

            var a = holder.AddComponent<StActor>();
            // real-metre character -> world units (1.6x), same as the town kits; KayKit heroes are normalised to 3.0
            holder.transform.localScale = Vector3.one * StMat.MetreScale;
            a.anim = g.GetComponent<Animation>() ?? g.AddComponent<Animation>();
            a.anim.playAutomatically = false; a.anim.cullingType = AnimationCullingType.AlwaysAnimate;
            foreach (var kv in Clips) if (a.anim.GetClip(kv.Key) == null) a.anim.AddClip(kv.Value, kv.Key);
            foreach (AnimationState st in a.anim) st.wrapMode = WrapMode.Loop;
            a.idle = "Idle_Loop"; a.run = "Walk_Loop"; a.attack = "Interact"; a.hit = "Hit_Chest"; a.death = "Death01";
            a.sockets = HeroSockets.Resolve(holder, 1.8f * StMat.MetreScale, RigProfile.Generic);
            a.handR = a.sockets[Socket.HandR]; a.handL = a.sockets[Socket.HandL];
            return a;
        }
    }

    /// <summary>Simple life for villagers/animals: walk a loop of waypoints, pause, play an idle/talk clip.</summary>
    public class StWander : MonoBehaviour
    {
        public Vector3[] points; public float speed = 2.2f, pause = 2.5f; public string walk, idle; public StActor actor; public Animation rawAnim;
        int i; float wait;
        void Update()
        {
            if (points == null || points.Length == 0) return;
            if (wait > 0) { wait -= Time.deltaTime; Play(idle); return; }
            var tgt = points[i]; var d = tgt - transform.position; d.y = 0;
            if (d.magnitude < 0.3f) { i = (i + 1) % points.Length; wait = pause; return; }
            transform.rotation = Quaternion.Slerp(transform.rotation, Quaternion.LookRotation(d), Time.deltaTime * 6f);
            transform.position += d.normalized * speed * Time.deltaTime;
            Play(walk);
        }
        void Play(string c)
        {
            if (string.IsNullOrEmpty(c)) return;
            if (actor) actor.Loop(c);
            else if (rawAnim && rawAnim.GetClip(c) != null && !rawAnim.IsPlaying(c)) rawAnim.CrossFade(c, 0.2f);
        }
    }
}
