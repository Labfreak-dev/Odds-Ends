using System.Collections.Generic;
using Hollowmere.Core;
using UnityEngine;

namespace Hollowmere
{
    /// <summary>
    /// Models and materials. A model is looked up as Resources/Models/&lt;key&gt; (Meshy GLBs, itch.io
    /// FBX packs, anything that imports as a GameObject). If it isn't there the game builds a
    /// coloured primitive stand-in, so every asset is optional and can arrive later.
    /// </summary>
    public static class Art
    {
        /// <summary>Extra yaw applied to every imported model. Meshy exports face glTF +Z, which glTFast
        /// keeps as Unity +Z (forward). If models ever walk backwards after an importer change, set 180.</summary>
        public static float ModelYaw = 0f;

        static Material baseMat;
        static readonly Dictionary<string, Material> mats = new Dictionary<string, Material>();
        static readonly Dictionary<string, GameObject> modelCache = new Dictionary<string, GameObject>();

        /// <summary>Clone the built-in primitive material: guaranteed to exist in builds
        /// (Shader.Find can be stripped) and works in whichever render pipeline is active.</summary>
        static Material BaseMaterial()
        {
            if (baseMat != null) return baseMat;
            var tmp = GameObject.CreatePrimitive(PrimitiveType.Cube);
            baseMat = new Material(tmp.GetComponent<Renderer>().sharedMaterial);
            Object.Destroy(tmp);
            return baseMat;
        }

        public static Material Mat(Color c, float emission = 0f)
        {
            string key = ColorUtility.ToHtmlStringRGBA(c) + emission.ToString("0.00");
            if (mats.TryGetValue(key, out var m)) return m;
            m = new Material(BaseMaterial()) { color = c };
            if (m.HasProperty("_BaseColor")) m.SetColor("_BaseColor", c);
            if (m.HasProperty("_Glossiness")) m.SetFloat("_Glossiness", 0.15f);
            if (m.HasProperty("_Smoothness")) m.SetFloat("_Smoothness", 0.15f);
            if (emission > 0)
            {
                m.EnableKeyword("_EMISSION");
                if (m.HasProperty("_EmissionColor")) m.SetColor("_EmissionColor", c * emission);
            }
            mats[key] = m;
            return m;
        }

        public static Material Mat(string hex, float emission = 0f) => Mat(Hex(hex), emission);

        public static Color Hex(string hex) => ColorUtility.TryParseHtmlString(hex, out var c) ? c : Color.magenta;

        public static Color Rarity(Rarity r) => Hex(ItemText.RarityColor(r));
        public static Color Element(Element e) => Hex(ItemText.ElementColor(e));

        public static GameObject LoadModel(string key)
        {
            if (string.IsNullOrEmpty(key)) return null;
            if (modelCache.TryGetValue(key, out var p)) return p;
            p = Resources.Load<GameObject>("Models/" + key);
            modelCache[key] = p;
            return p;
        }

        /// <summary>Instantiate a model scaled to `height` metres, feet on the ground, facing +Z.
        /// Returns null when the asset isn't in the project.</summary>
        public static GameObject Model(string key, float height, Transform parent)
        {
            var prefab = LoadModel(key);
            if (prefab == null) return null;
            var holder = new GameObject(key);
            holder.transform.SetParent(parent, false);
            var go = Object.Instantiate(prefab, holder.transform);
            go.transform.localPosition = Vector3.zero;
            go.transform.localRotation = Quaternion.Euler(0, ModelYaw, 0);
            var rends = go.GetComponentsInChildren<Renderer>();
            if (rends.Length > 0)
            {
                var b = rends[0].bounds;
                foreach (var r in rends) b.Encapsulate(r.bounds);
                float h = Mathf.Max(0.01f, b.size.y);
                float s = height / h;
                go.transform.localScale = Vector3.one * s;
                var bottom = (b.center - holder.transform.position) * s;
                go.transform.localPosition = new Vector3(-bottom.x, -(b.min.y - holder.transform.position.y) * s, -bottom.z);
            }
            foreach (var c in go.GetComponentsInChildren<Collider>()) Object.Destroy(c);
            var anim = go.GetComponentInChildren<Animation>();
            if (anim != null && anim.clip != null)
            {
                anim.wrapMode = WrapMode.Loop;
                anim.Play();
            }
            var ma = holder.AddComponent<ModelAnim>();
            ma.anim = anim;
            ma.animator = go.GetComponentInChildren<Animator>();
            return holder;
        }

        /// <summary>The walk-cycle variant of a model if one was generated (Meshy rigging), else the static one.</summary>
        public static GameObject Animated(string key, float height, Transform parent)
            => Model(key + "_walk", height, parent) ?? Model(key, height, parent);

        static GameObject Prim(PrimitiveType t, Transform parent, Vector3 pos, Vector3 scale, Material m, Quaternion? rot = null)
        {
            var g = GameObject.CreatePrimitive(t);
            Object.Destroy(g.GetComponent<Collider>());
            g.transform.SetParent(parent, false);
            g.transform.localPosition = pos;
            g.transform.localScale = scale;
            if (rot.HasValue) g.transform.localRotation = rot.Value;
            g.GetComponent<Renderer>().sharedMaterial = m;
            return g;
        }

        public static GameObject Cube(Transform parent, Vector3 pos, Vector3 scale, Material m, Quaternion? rot = null) => Prim(PrimitiveType.Cube, parent, pos, scale, m, rot);
        public static GameObject Sphere(Transform parent, Vector3 pos, Vector3 scale, Material m) => Prim(PrimitiveType.Sphere, parent, pos, scale, m);
        public static GameObject Capsule(Transform parent, Vector3 pos, Vector3 scale, Material m) => Prim(PrimitiveType.Capsule, parent, pos, scale, m);
        public static GameObject Cylinder(Transform parent, Vector3 pos, Vector3 scale, Material m, Quaternion? rot = null) => Prim(PrimitiveType.Cylinder, parent, pos, scale, m, rot);

        // ---------------- stand-ins ----------------

        /// <summary>Simple humanoid: body, head, arms. Returns the root; `weaponHand` is where weapons attach.</summary>
        public static GameObject Humanoid(Transform parent, Color body, Color trim, float height, out Transform weaponHand)
        {
            var root = new GameObject("figure").transform;
            root.SetParent(parent, false);
            float s = height / 1.8f;
            var bm = Mat(body); var tm = Mat(trim);
            Capsule(root, new Vector3(0, 0.95f, 0) * s, new Vector3(0.55f, 0.55f, 0.4f) * s, bm);
            Sphere(root, new Vector3(0, 1.6f, 0) * s, Vector3.one * 0.34f * s, Mat(new Color(0.93f, 0.8f, 0.68f)));
            Cube(root, new Vector3(0, 1.32f, 0) * s, new Vector3(0.62f, 0.12f, 0.42f) * s, tm);
            Capsule(root, new Vector3(-0.17f, 0.32f, 0) * s, new Vector3(0.2f, 0.33f, 0.2f) * s, tm);
            Capsule(root, new Vector3(0.17f, 0.32f, 0) * s, new Vector3(0.2f, 0.33f, 0.2f) * s, tm);
            Capsule(root, new Vector3(-0.38f, 1.0f, 0) * s, new Vector3(0.16f, 0.32f, 0.16f) * s, bm);
            var arm = Capsule(root, new Vector3(0.38f, 1.0f, 0) * s, new Vector3(0.16f, 0.32f, 0.16f) * s, bm);
            weaponHand = new GameObject("hand").transform;
            weaponHand.SetParent(root, false);
            weaponHand.localPosition = new Vector3(0.42f, 0.75f, 0.1f) * s;
            Sphere(root, new Vector3(0.07f, 1.63f, 0.15f) * s, Vector3.one * 0.06f * s, Mat(Color.black));
            Sphere(root, new Vector3(-0.07f, 1.63f, 0.15f) * s, Vector3.one * 0.06f * s, Mat(Color.black));
            return root.gameObject;
        }

        public static GameObject Weapon(Transform hand, string baseId, Color c)
        {
            foreach (Transform ch in hand) Object.Destroy(ch.gameObject);
            var m = Mat(c, 0.3f);
            var g = new GameObject("weapon").transform;
            g.SetParent(hand, false);
            switch (baseId)
            {
                case "bow": case "crossbow":
                    Cylinder(g, new Vector3(0, 0.1f, 0.2f), new Vector3(0.05f, 0.55f, 0.05f), m, Quaternion.Euler(0, 0, 0));
                    break;
                case "staff": case "rod":
                    Cylinder(g, new Vector3(0, 0.3f, 0.1f), new Vector3(0.06f, 0.9f, 0.06f), m);
                    Sphere(g, new Vector3(0, 1.2f, 0.1f), Vector3.one * 0.18f, Mat(c, 1.5f));
                    break;
                case "wand": case "dagger":
                    Cylinder(g, new Vector3(0, 0.15f, 0.15f), new Vector3(0.04f, 0.3f, 0.04f), m, Quaternion.Euler(60, 0, 0));
                    break;
                case "greataxe": case "warhammer": case "axe": case "mace":
                    Cylinder(g, new Vector3(0, 0.3f, 0.2f), new Vector3(0.05f, 0.55f, 0.05f), Mat(new Color(0.4f, 0.28f, 0.18f)), Quaternion.Euler(50, 0, 0));
                    Cube(g, new Vector3(0, 0.75f, 0.6f), new Vector3(0.08f, 0.35f, 0.3f), m, Quaternion.Euler(50, 0, 0));
                    break;
                default:
                    Cube(g, new Vector3(0, 0.4f, 0.4f), new Vector3(0.06f, 0.9f, 0.12f), m, Quaternion.Euler(50, 0, 0));
                    break;
            }
            return g.gameObject;
        }

        public static GameObject Quadruped(Transform parent, Color c, float height)
        {
            var root = new GameObject("beast").transform;
            root.SetParent(parent, false);
            float s = height / 0.9f;
            var m = Mat(c);
            Capsule(root, new Vector3(0, 0.55f, 0) * s, new Vector3(0.45f, 0.5f, 0.45f) * s, m).transform.localRotation = Quaternion.Euler(90, 0, 0);
            Sphere(root, new Vector3(0, 0.78f, 0.55f) * s, Vector3.one * 0.38f * s, m);
            Cube(root, new Vector3(0, 0.72f, 0.78f) * s, new Vector3(0.18f, 0.15f, 0.22f) * s, m);
            foreach (var x in new[] { -0.15f, 0.15f })
                foreach (var z in new[] { -0.3f, 0.3f })
                    Cylinder(root, new Vector3(x, 0.18f, z) * s, new Vector3(0.12f, 0.2f, 0.12f) * s, m);
            Cube(root, new Vector3(0.1f, 1.0f, 0.5f) * s, new Vector3(0.08f, 0.16f, 0.06f) * s, m);
            Cube(root, new Vector3(-0.1f, 1.0f, 0.5f) * s, new Vector3(0.08f, 0.16f, 0.06f) * s, m);
            Sphere(root, new Vector3(0.09f, 0.85f, 0.72f) * s, Vector3.one * 0.06f * s, Mat(Color.black));
            Sphere(root, new Vector3(-0.09f, 0.85f, 0.72f) * s, Vector3.one * 0.06f * s, Mat(Color.black));
            return root.gameObject;
        }

        public static GameObject Spider(Transform parent, Color c, float height)
        {
            var root = new GameObject("spider").transform;
            root.SetParent(parent, false);
            float s = height / 0.8f;
            var m = Mat(c);
            Sphere(root, new Vector3(0, 0.45f, -0.2f) * s, new Vector3(0.7f, 0.5f, 0.8f) * s, m);
            Sphere(root, new Vector3(0, 0.4f, 0.35f) * s, Vector3.one * 0.38f * s, m);
            for (int i = 0; i < 4; i++)
                foreach (var side in new[] { -1, 1 })
                    Cube(root, new Vector3(side * 0.45f, 0.3f, 0.3f - i * 0.22f) * s, new Vector3(0.6f, 0.05f, 0.05f) * s, m, Quaternion.Euler(0, 0, side * 30));
            Sphere(root, new Vector3(0.08f, 0.48f, 0.52f) * s, Vector3.one * 0.08f * s, Mat(new Color(0.8f, 0.3f, 1f), 2f));
            Sphere(root, new Vector3(-0.08f, 0.48f, 0.52f) * s, Vector3.one * 0.08f * s, Mat(new Color(0.8f, 0.3f, 1f), 2f));
            return root.gameObject;
        }

        public static GameObject Brute(Transform parent, Color c, float height)
        {
            var root = new GameObject("brute").transform;
            root.SetParent(parent, false);
            float s = height / 2.6f;
            var m = Mat(c);
            Sphere(root, new Vector3(0, 1.5f, 0) * s, new Vector3(1.6f, 1.4f, 1.1f) * s, m);
            Sphere(root, new Vector3(0, 2.3f, 0.2f) * s, Vector3.one * 0.6f * s, m);
            Capsule(root, new Vector3(-0.95f, 1.1f, 0.1f) * s, new Vector3(0.5f, 0.8f, 0.5f) * s, m);
            Capsule(root, new Vector3(0.95f, 1.1f, 0.1f) * s, new Vector3(0.5f, 0.8f, 0.5f) * s, m);
            Capsule(root, new Vector3(-0.4f, 0.45f, 0) * s, new Vector3(0.5f, 0.45f, 0.5f) * s, m);
            Capsule(root, new Vector3(0.4f, 0.45f, 0) * s, new Vector3(0.5f, 0.45f, 0.5f) * s, m);
            Sphere(root, new Vector3(0.15f, 2.35f, 0.45f) * s, Vector3.one * 0.12f * s, Mat(new Color(1f, 0.6f, 0.2f), 2f));
            Sphere(root, new Vector3(-0.15f, 2.35f, 0.45f) * s, Vector3.one * 0.12f * s, Mat(new Color(1f, 0.6f, 0.2f), 2f));
            return root.gameObject;
        }

        public static GameObject Wraith(Transform parent, Color c, float height)
        {
            var root = new GameObject("wraith").transform;
            root.SetParent(parent, false);
            float s = height / 1.9f;
            var m = Mat(c, 0.6f);
            Cylinder(root, new Vector3(0, 1.0f, 0) * s, new Vector3(0.7f, 0.6f, 0.7f) * s, m);
            Sphere(root, new Vector3(0, 1.7f, 0) * s, Vector3.one * 0.45f * s, m);
            Sphere(root, new Vector3(0.1f, 1.72f, 0.2f) * s, Vector3.one * 0.08f * s, Mat(Color.white, 3f));
            Sphere(root, new Vector3(-0.1f, 1.72f, 0.2f) * s, Vector3.one * 0.08f * s, Mat(Color.white, 3f));
            return root.gameObject;
        }

        /// <summary>A monster's body: its model if present, else a stand-in matched to its role.</summary>
        public static GameObject MonsterBody(MonsterDef def, Transform parent, float scale)
        {
            float h = def.role switch { MonsterRole.Swarm => 0.8f, MonsterRole.Brute => 2.6f, _ => 1.8f } * scale;
            var m = Animated(def.model, h, parent);
            if (m != null) return m;
            var c = Hex(def.color);
            switch (def.model)
            {
                case "mon_gloomspider": return Spider(parent, c, h);
                case "mon_stonehulk": return Brute(parent, c, h);
                case "mon_drownedwraith": case "boss_abbot": return Wraith(parent, c, h);
                default:
                    var body = Humanoid(parent, c, c * 0.7f, h, out var hand);
                    if (def.role == MonsterRole.Melee || def.role == MonsterRole.Brute) Weapon(hand, "sword", new Color(0.6f, 0.55f, 0.5f));
                    else Weapon(hand, "staff", Element(def.element));
                    return body;
            }
        }

        public static Color ClassColor(HeroClass c) => c switch
        {
            HeroClass.Ironclad => new Color(0.55f, 0.57f, 0.62f),
            HeroClass.Stalker => new Color(0.25f, 0.45f, 0.25f),
            _ => new Color(0.38f, 0.22f, 0.55f),
        };

        public static string HeroModelKey(HeroClass c) => "hero_" + c.ToString().ToLowerInvariant();

        public static (Color floorA, Color floorB, Color wall, Color ambient, Color light) ThemeColors(Theme t) => t switch
        {
            Theme.Crypt => (Hex("#4a4740"), Hex("#423f39"), Hex("#2e2b28"), Hex("#2a2838"), Hex("#ffb070")),
            Theme.Caverns => (Hex("#3d4a3a"), Hex("#364233"), Hex("#2a3328"), Hex("#203028"), Hex("#b0ff9a")),
            Theme.SunkenHalls => (Hex("#3a4c55"), Hex("#33444c"), Hex("#22323a"), Hex("#1a2a3a"), Hex("#8ad8ff")),
            Theme.EmberDepths => (Hex("#4a3530"), Hex("#422f2a"), Hex("#2e1e1a"), Hex("#3a1a10"), Hex("#ff7a3a")),
            _ => (Hex("#6f8a4a"), Hex("#678244"), Hex("#6a5a48"), Hex("#8a8aa0"), Hex("#fff0d0")),
        };
    }

    /// <summary>Plays an imported model's walk cycle while it moves and nearly freezes it when idle
    /// (the rig only ships walk/run clips, so a slowed walk reads as a breathing idle).</summary>
    public sealed class ModelAnim : MonoBehaviour
    {
        public Animation anim;
        public Animator animator;
        public bool HasClips => (anim != null && anim.clip != null) || animator != null;
        bool? last;

        public void SetMoving(bool moving)
        {
            if (last == moving) return;
            last = moving;
            if (anim != null) foreach (AnimationState st in anim) st.speed = moving ? 1f : 0.15f;
            if (animator != null) animator.speed = moving ? 1f : 0.15f;
        }
    }
}
