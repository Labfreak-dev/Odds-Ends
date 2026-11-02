using System.Collections.Generic;
using UnityEngine;

namespace Hollowmere.StyleTest
{
    /// <summary>Loads the free CC0 KayKit assets (Resources/ST) and builds animated actors from them.
    /// Every look is a complete KayKit character on its own body; weapons sit on the rig's handslot bones.</summary>
    public static class StKit
    {
        static Dictionary<string, AnimationClip> clips;
        public static Vector3 StaffRot = new Vector3(0, 0, 0);

        public static Dictionary<string, AnimationClip> Clips
        {
            get
            {
                if (clips != null) return clips;
                clips = new Dictionary<string, AnimationClip>();
                foreach (var c in Resources.LoadAll<AnimationClip>("ST/Anim"))
                {
                    var n = c.name; var bar = n.LastIndexOf('|'); if (bar >= 0) n = n.Substring(bar + 1);
                    if (!clips.ContainsKey(n)) clips[n] = c;
                }
                Debug.Log("[ST] clips " + clips.Count + ": " + string.Join(",", clips.Keys));
                return clips;
            }
        }

        public static GameObject Spawn(string res, Vector3 pos, float yaw)
        {
            var p = Resources.Load<GameObject>("ST/" + res);
            if (p == null) { Debug.LogError("[ST] missing " + res); return new GameObject("missing_" + res); }
            var g = Object.Instantiate(p, pos, Quaternion.Euler(0, yaw, 0));
            g.name = res;
            foreach (var sk in g.GetComponentsInChildren<SkinnedMeshRenderer>()) sk.updateWhenOffscreen = true;
            foreach (var r in g.GetComponentsInChildren<Renderer>()) { r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.On; r.receiveShadows = true; }
            foreach (var m in g.GetComponentsInChildren<Renderer>())
                foreach (var mat in m.sharedMaterials)
                    if (mat != null && mat.HasProperty("_Smoothness")) mat.SetFloat("_Smoothness", 0.15f);
            return g;
        }

        public static Transform Find(Transform t, string lowerName)
        {
            if (t.name.ToLowerInvariant() == lowerName) return t;
            foreach (Transform c in t) { var f = Find(c, lowerName); if (f != null) return f; }
            return null;
        }

        public static GameObject Attach(Transform bone, string res)
        {
            if (bone == null) { Debug.LogError("[ST] no bone for " + res); return null; }
            var p = Resources.Load<GameObject>("ST/" + res);
            if (p == null) { Debug.LogError("[ST] missing " + res); return null; }
            var g = Object.Instantiate(p, bone);
            g.name = res;
            g.transform.localPosition = Vector3.zero; g.transform.localRotation = Quaternion.identity; g.transform.localScale = Vector3.one;
            // Staffs are held upright (KayKit default points them forward like a sword); the grip stays at the handslot.
            if (res.EndsWith("staff") || res.EndsWith("Skeleton_Staff"))
            {
                var e = System.Environment.GetEnvironmentVariable("HM_STAFFROT");
                var v = StaffRot;
                if (!string.IsNullOrEmpty(e)) { var sp = e.Split(','); v = new Vector3(float.Parse(sp[0]), float.Parse(sp[1]), float.Parse(sp[2])); }
                g.transform.localRotation = Quaternion.Euler(v);
            }
            return g;
        }

        public static string Hierarchy(Transform t, int depth = 0)
        {
            var s = new string(' ', depth * 2) + t.name + "\n";
            if (depth < 6) foreach (Transform c in t) s += Hierarchy(c, depth + 1);
            return s;
        }
    }

    public class StActor : MonoBehaviour
    {
        public Animation anim;
        public string idle = "Idle_A", run = "Running_A", attack = "Melee_1H_Attack_Chop", hit = "Hit_A", death = "Death_A";
        public Transform handR, handL;
        public HeroSockets sockets;
        public GameObject weaponR, weaponL;
        public const float BindHeight = 3.0f;
        public float hp = 3, speed = 6.5f, attackRange = 2.8f;
        public bool dead;
        public string current;
        float lockUntil;

        public static StActor Make(string charRes, Vector3 pos, float yaw)
        {
            var g = StKit.Spawn(charRes, pos, yaw);
            var a = g.AddComponent<StActor>();
            // KayKit Rig_Medium characters are ~3.5 m tall in the source glTF (the dungeon kit's 4 m walls/tiles are built for that);
            // the non-Unity character FBX imports smaller, so normalise the bind pose to the kit's scale.
            var hb = a.WorldBounds();
            if (hb.size.y > 0.05f) g.transform.localScale = Vector3.one * (BindHeight / hb.size.y);
            a.anim = g.GetComponent<Animation>() ?? g.AddComponent<Animation>();
            a.anim.playAutomatically = false;
            a.anim.cullingType = AnimationCullingType.AlwaysAnimate;
            foreach (var kv in StKit.Clips)
            {
                if (a.anim.GetClip(kv.Key) != null) continue;
                a.anim.AddClip(kv.Value, kv.Key);
            }
            foreach (AnimationState st in a.anim) st.wrapMode = WrapMode.Loop;
            a.sockets = HeroSockets.Resolve(g, BindHeight);
            a.handR = a.sockets[Socket.HandR]; a.handL = a.sockets[Socket.HandL];
            if (a.handR == null) Debug.Log("[ST] hierarchy " + charRes + "\n" + StKit.Hierarchy(g.transform));
            return a;
        }

        public void SetWeapons(string r, string l)
        {
            if (weaponR) Destroy(weaponR); if (weaponL) Destroy(weaponL);
            weaponR = string.IsNullOrEmpty(r) ? null : WeaponDef.Get(r, Socket.HandR).Equip(sockets, Socket.HandR);
            weaponL = string.IsNullOrEmpty(l) ? null : WeaponDef.Get(l, Socket.HandL).Equip(sockets, Socket.HandL);
        }

        public void Loop(string clip, float fade = 0.15f)
        {
            if (Time.time < lockUntil || dead) return;
            if (current == clip) return;
            if (anim.GetClip(clip) == null) { Debug.LogWarning("[ST] no clip " + clip); return; }
            anim[clip].wrapMode = WrapMode.Loop; anim.CrossFade(clip, fade); current = clip;
        }

        public float Once(string clip, float fade = 0.08f, bool keepLast = false)
        {
            if (anim.GetClip(clip) == null) { Debug.LogWarning("[ST] no clip " + clip); return 0; }
            anim[clip].wrapMode = keepLast ? WrapMode.ClampForever : WrapMode.Once;
            anim[clip].time = 0;
            anim.CrossFade(clip, fade); current = clip;
            lockUntil = Time.time + anim[clip].length * 0.95f;
            return anim[clip].length;
        }

        public bool Busy => Time.time < lockUntil;

        /// <summary>Pose the actor at a normalised point of a clip (for stills).</summary>
        public void Pose(string clip, float t01)
        {
            anim.Stop();
            var st = anim[clip]; if (st == null) { var names = new System.Collections.Generic.List<string>(); foreach (AnimationState x in anim) names.Add(x.name); Debug.LogWarning("[ST] noclip " + clip + " on " + name + " have: " + string.Join(",", names)); return; }
            st.enabled = true; st.weight = 1; st.wrapMode = WrapMode.ClampForever;
            st.normalizedTime = t01;
            anim.Sample();
            st.enabled = false;
            current = null;
        }

        public Bounds WorldBounds()
        {
            var rs = GetComponentsInChildren<Renderer>();
            var b = new Bounds(transform.position + Vector3.up, Vector3.one * 0.1f);
            foreach (var r in rs) if (!(r is ParticleSystemRenderer) && r.enabled && r.gameObject.layer != 2) b.Encapsulate(r.bounds);
            return b;
        }
    }
}
