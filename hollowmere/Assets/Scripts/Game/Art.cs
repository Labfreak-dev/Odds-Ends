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
        static Material glowBase;
        static Mesh glowQuad;
        static readonly Dictionary<string, Material> mats = new Dictionary<string, Material>();
        static readonly Dictionary<string, Material> glowMats = new Dictionary<string, Material>();
        static readonly Dictionary<string, GameObject> modelCache = new Dictionary<string, GameObject>();

        /// <summary>The URP color material in Resources. A player build keeps it because the asset
        /// is referenced, which is what Shader.Find cannot promise once variants are stripped.</summary>
        static Material BaseMaterial()
        {
            if (baseMat != null) return baseMat;
            var loaded = Resources.Load<Material>("HollowmereColor");
            if (loaded != null)
            {
                baseMat = loaded;
                return baseMat;
            }
            Debug.LogError("Hollowmere: Resources/HollowmereColor is missing. Procedural meshes have no shader.");
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

        /// <summary>Additive unlit material. Vertex-color mode is for TrailRenderer gradients;
        /// the sprite quad uses a flat color so a mesh without colors still glows.</summary>
        public static Material GlowMat(Color c, bool vertexColor = false)
        {
            string key = ColorUtility.ToHtmlStringRGBA(c) + (vertexColor ? "v" : "c");
            if (glowMats.TryGetValue(key, out var m)) return m;
            if (glowBase == null)
            {
                var loaded = Resources.Load<Material>("HollowmereGlow");
                if (loaded == null)
                    Debug.LogError("Hollowmere: Resources/HollowmereGlow is missing. Spell glow falls back to the lit color shader.");
                glowBase = loaded != null ? loaded : BaseMaterial();
            }
            m = new Material(glowBase);
            m.color = c;
            if (m.HasProperty("_BaseColor")) m.SetColor("_BaseColor", c);
            if (m.HasProperty("_Color")) m.SetColor("_Color", c);
            if (m.HasProperty("_EmissionColor")) m.SetColor("_EmissionColor", vertexColor ? Color.white : c);
            if (m.HasProperty("_UseVertexColor")) m.SetFloat("_UseVertexColor", vertexColor ? 1f : 0f);
            glowMats[key] = m;
            return m;
        }

        /// <summary>Camera-facing additive quad. Size is in metres.</summary>
        public static GameObject GlowSprite(Transform parent, float size, Color c)
        {
            var g = new GameObject("glowSprite");
            g.transform.SetParent(parent, false);
            var mf = g.AddComponent<MeshFilter>();
            mf.sharedMesh = GlowQuadMesh();
            var mr = g.AddComponent<MeshRenderer>();
            mr.sharedMaterial = GlowMat(c, false);
            mr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            mr.receiveShadows = false;
            g.transform.localScale = Vector3.one * size;
            g.AddComponent<FaceCamera>();
            return g;
        }

        static Mesh GlowQuadMesh()
        {
            if (glowQuad != null) return glowQuad;
            glowQuad = new Mesh { name = "glowQuad" };
            glowQuad.vertices = new[]
            {
                new Vector3(-0.5f, -0.5f, 0f), new Vector3(-0.5f, 0.5f, 0f),
                new Vector3(0.5f, 0.5f, 0f), new Vector3(0.5f, -0.5f, 0f),
            };
            glowQuad.colors = new[] { Color.white, Color.white, Color.white, Color.white };
            glowQuad.triangles = new[] { 0, 1, 2, 0, 2, 3 };
            glowQuad.RecalculateBounds();
            return glowQuad;
        }

        /// <summary>Dashed ring on the ground so a dark hero still reads at screen centre.</summary>
        public static void GroundRing(Transform parent, Color c, float radius = 0.95f)
        {
            var root = new GameObject("heroRing").transform;
            root.SetParent(parent, false);
            var m = Mat(c, 1.8f);
            const int n = 20;
            for (int i = 0; i < n; i++)
            {
                float a = i * Mathf.PI * 2f / n;
                var pos = new Vector3(Mathf.Cos(a), 0.05f, Mathf.Sin(a)) * radius;
                Cube(root, pos, new Vector3(radius * 0.28f, 0.03f, 0.09f), m, Quaternion.Euler(0f, -a * Mathf.Rad2Deg, 0f));
            }
        }

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
            // Measure the mesh, not Renderer.bounds. A skinned rig often reports the bind-pose
            // box or ignores the armature's 0.01 scale, which turned heroes into specks and
            // the blacksmith into a giant head. Multiplying the existing scale keeps that 0.01.
            // Props (dock, well, torch, skirt-sized scenery) keep the exported size.
            // Fitting those to a short target height blew a flat mesh into the giant plane
            // that covered the corner of the town and the dungeon.
            if (IsCharacter(key))
            {
                if (IsBiped(key)) StandUp(go.transform);
                FitToHeight(go.transform, holder.transform, height);
            }
            foreach (var c in go.GetComponentsInChildren<Collider>()) Object.Destroy(c);
            foreach (var animator in go.GetComponentsInChildren<Animator>()) animator.applyRootMotion = false;
            AdoptShaders(go);
            // ModelFit measures Renderer.bounds after the skin has updated. mesh.bounds stays
            // about two metres even when the armature scale is dropped and the draw is huge.
            var fit = holder.AddComponent<ModelFit>();
            fit.targetHeight = IsCharacter(key) ? height : 0f;
            fit.maxAxis = IsCharacter(key) ? Mathf.Max(2.5f, height * 1.3f) : 4f;
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

        static bool IsCharacter(string key)
        {
            return key.StartsWith("npc_") || key.StartsWith("hero_") || key.StartsWith("pet_")
                || key.StartsWith("mon_") || key.StartsWith("boss_");
        }

        static bool IsBiped(string key)
        {
            return key.StartsWith("npc_") || key.StartsWith("hero_") || key.StartsWith("mon_") || key.StartsWith("boss_");
        }

        /// <summary>Meshy sometimes leaves a figure lying on Z. Try quarter-turns and keep the one
        /// whose mesh stands tallest. Pets are skipped: a hound is supposed to be longer than it is tall.</summary>
        static void StandUp(Transform root)
        {
            Quaternion best = root.localRotation;
            float bestH = -1f;
            Quaternion[] opts =
            {
                Quaternion.identity,
                Quaternion.Euler(-90f, 0f, 0f),
                Quaternion.Euler(90f, 0f, 0f),
                Quaternion.Euler(0f, 0f, -90f),
                Quaternion.Euler(0f, 0f, 90f),
            };
            foreach (var q in opts)
            {
                root.localRotation = q;
                if (!WorldMeshBounds(root, out var b)) continue;
                if (b.size.y > bestH)
                {
                    bestH = b.size.y;
                    best = q;
                }
            }
            root.localRotation = best;
        }

        static void FitToHeight(Transform go, Transform holder, float height)
        {
            if (!WorldMeshBounds(go, out var b)) return;
            float h = Mathf.Max(0.01f, b.size.y);
            go.localScale = go.localScale * (height / h);
            if (!WorldMeshBounds(go, out b)) return;
            go.position += new Vector3(holder.position.x - b.center.x, holder.position.y - b.min.y, holder.position.z - b.center.z);
        }

        static bool WorldMeshBounds(Transform root, out Bounds world)
        {
            world = new Bounds(root.position, Vector3.zero);
            bool any = false;
            foreach (var r in root.GetComponentsInChildren<Renderer>())
            {
                Mesh mesh = null;
                var skin = r as SkinnedMeshRenderer;
                if (skin != null) mesh = skin.sharedMesh;
                else
                {
                    var mf = r.GetComponent<MeshFilter>();
                    if (mf != null) mesh = mf.sharedMesh;
                }
                if (mesh == null) continue;
                var mb = mesh.bounds;
                var ext = mb.extents;
                var l2w = r.transform.localToWorldMatrix;
                for (int i = 0; i < 8; i++)
                {
                    var corner = mb.center + new Vector3((i & 1) == 0 ? -ext.x : ext.x, (i & 2) == 0 ? -ext.y : ext.y, (i & 4) == 0 ? -ext.z : ext.z);
                    var p = l2w.MultiplyPoint3x4(corner);
                    if (!any) { world = new Bounds(p, Vector3.zero); any = true; }
                    else world.Encapsulate(p);
                }
            }
            return any;
        }

        /// <summary>glTF materials ship on URP shader graphs. Those graphs are not in the player
        /// (always-including URP Lit compiles hundreds of thousands of variants), so a stripped
        /// material draws magenta or drops out and leaves the black skirt showing through.
        /// Copy albedo onto Hollowmere/Color, which is always included.</summary>
        public static void AdoptShaders(GameObject go)
        {
            if (go == null) return;
            foreach (var r in go.GetComponentsInChildren<Renderer>(true))
            {
                var src = r.sharedMaterials;
                var next = new Material[src.Length];
                for (int i = 0; i < src.Length; i++)
                {
                    var m = src[i];
                    if (m != null && m.shader != null && (m.shader.name == "Hollowmere/Color" || m.shader.name == "Hollowmere/Text" || m.shader.name == "Hollowmere/Glow"))
                    {
                        next[i] = m;
                        continue;
                    }
                    Color c = Color.white;
                    Texture tex = null;
                    if (m != null)
                    {
                        if (m.HasProperty("_BaseColor")) c = m.GetColor("_BaseColor");
                        else if (m.HasProperty("_Color")) c = m.GetColor("_Color");
                        else if (m.HasProperty("baseColorFactor")) c = m.GetColor("baseColorFactor");
                        else c = m.color;
                        tex = FirstAlbedo(m);
                    }
                    var dst = new Material(BaseMaterial());
                    dst.color = c;
                    if (dst.HasProperty("_BaseColor")) dst.SetColor("_BaseColor", c);
                    if (tex != null)
                    {
                        var readable = ReadableCopy(tex);
                        if (dst.HasProperty("_BaseMap")) dst.SetTexture("_BaseMap", readable);
                        if (dst.HasProperty("_MainTex")) dst.SetTexture("_MainTex", readable);
                        if (dst.HasProperty("_HasMap")) dst.SetFloat("_HasMap", 1f);
                        if (dst.GetTexture("_BaseMap") == null && dst.mainTexture == null)
                            Debug.LogError("Hollowmere: albedo texture did not stick on " + go.name);
                    }
                    next[i] = dst;
                }
                r.sharedMaterials = next;
            }
        }

        /// <summary>glTFast's shader graph calls the base-color image baseColorTexture, not _BaseMap.</summary>
        static readonly string[] AlbedoNames = { "baseColorTexture", "_BaseMap", "_MainTex", "_BaseColorTexture", "baseColorTexture_tex" };

        static Texture FirstAlbedo(Material m)
        {
            if (m == null) return null;
            foreach (var name in AlbedoNames)
            {
                if (!m.HasProperty(name)) continue;
                var tex = m.GetTexture(name);
                if (tex != null) return tex;
            }
            if (m.shader != null)
            {
                int count = m.shader.GetPropertyCount();
                for (int i = 0; i < count; i++)
                {
                    if (m.shader.GetPropertyType(i) != UnityEngine.Rendering.ShaderPropertyType.Texture) continue;
                    var tex = m.GetTexture(m.shader.GetPropertyName(i));
                    if (tex != null) return tex;
                }
            }
            return m.mainTexture;
        }

        /// <summary>GPU-only glTF textures cannot be read back. Blit into a Texture2D so the
        /// copy is readable and is the one the included shader actually samples.</summary>
        static Texture ReadableCopy(Texture src)
        {
            if (src == null) return null;
            if (src is Texture2D tex2d && tex2d.isReadable) return src;
            int w = Mathf.Max(1, src.width);
            int h = Mathf.Max(1, src.height);
            var rt = RenderTexture.GetTemporary(w, h, 0, RenderTextureFormat.ARGB32);
            Graphics.Blit(src, rt);
            var prev = RenderTexture.active;
            RenderTexture.active = rt;
            var copy = new Texture2D(w, h, TextureFormat.RGBA32, false) { name = src.name + " albedo" };
            copy.ReadPixels(new Rect(0, 0, w, h), 0, 0);
            copy.Apply();
            RenderTexture.active = prev;
            RenderTexture.ReleaseTemporary(rt);
            return copy;
        }

        /// <summary>First albedo on a character, for the QA check that the copy kept a texture.</summary>
        public static Texture AlbedoOf(GameObject go)
        {
            if (go == null) return null;
            foreach (var r in go.GetComponentsInChildren<Renderer>(true))
            {
                foreach (var m in r.sharedMaterials)
                {
                    if (m == null) continue;
                    var tex = m.GetTexture("_BaseMap");
                    if (tex == null) tex = m.mainTexture;
                    if (tex != null) return tex;
                }
            }
            return null;
        }

        public static float MaxAxis(Vector3 size) => Mathf.Max(size.x, Mathf.Max(size.y, size.z));

        /// <summary>World AABB of mesh and skinned renderers. Ignores trails and text.</summary>
        public static bool UnionBounds(GameObject go, out Bounds world)
        {
            world = new Bounds(go != null ? go.transform.position : Vector3.zero, Vector3.zero);
            if (go == null) return false;
            bool any = false;
            foreach (var r in go.GetComponentsInChildren<Renderer>(true))
            {
                if (!(r is MeshRenderer) && !(r is SkinnedMeshRenderer)) continue;
                if (!any) { world = r.bounds; any = true; }
                else world.Encapsulate(r.bounds);
            }
            return any;
        }

        /// <summary>Log every renderer bigger than about 10 m, or sitting on the camera, and
        /// shrink anything that is not the floor, walls or the ground skirt.</summary>
        public static void TameOversized(Camera cam)
        {
            var seen = new HashSet<Transform>();
            Vector3 eye = cam != null ? cam.transform.position : Vector3.zero;
            foreach (var r in Object.FindObjectsByType<Renderer>(FindObjectsSortMode.None))
            {
                if (r == null || !r.enabled) continue;
                if (!(r is MeshRenderer) && !(r is SkinnedMeshRenderer)) continue;
                var b = r.bounds;
                float max = MaxAxis(b.size);
                bool near = cam != null && (b.Contains(eye) || DistanceToBounds(eye, b) < 3.5f);
                bool level = IsLevelMesh(r.transform);
                if (max > 10f || near)
                    Debug.LogWarning("Hollowmere bounds: " + PathOf(r.transform) + " size=" + b.size + " center=" + b.center + (near ? " near-camera" : "") + (level ? " level" : ""));
                if (level || max <= 10f) continue;
                var root = ScalableRoot(r.transform);
                if (root == null || !seen.Add(root)) continue;
                var fit = root.GetComponent<ModelFit>();
                float goal = fit != null && fit.targetHeight > 0.2f ? fit.targetHeight : 2.6f;
                float factor = goal / max;
                root.localScale *= factor;
                Debug.LogWarning("Hollowmere: shrunk " + root.name + " x" + factor.ToString("0.###") + " (was " + max.ToString("0.#") + " m)");
            }
        }

        public static bool IsLevelMesh(Transform t)
        {
            while (t != null)
            {
                string n = t.name;
                if (n == "floor" || n == "walls" || n == "water" || n == "skirt" || n == "waterBlock") return true;
                t = t.parent;
            }
            return false;
        }

        public static Transform ScalableRoot(Transform t)
        {
            Transform best = t;
            while (t.parent != null)
            {
                var p = t.parent;
                string n = p.name;
                if (n == "Town" || n.StartsWith("Floor ") || n == "body" || n == "Hero" || n == "Pet") break;
                if (p.GetComponent<Actor>() != null || p.GetComponent<Interactable>() != null) break;
                t = p;
                best = t;
            }
            return best;
        }

        public static string PathOf(Transform t)
        {
            string s = t.name;
            while (t.parent != null) { t = t.parent; s = t.name + "/" + s; }
            return s;
        }

        public static float DistanceToBounds(Vector3 p, Bounds b)
        {
            var c = b.ClosestPoint(p);
            return Vector3.Distance(p, c);
        }

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

    /// <summary>
    /// Blends idle, walk, and run from the ground speed, and crossfades attacks.
    /// Shipped clips are legacy, so the blend is Animation.CrossFade. An Animator
    /// controller is used when the model already has one. Playback rate is
    /// groundSpeed / clipWalk so the feet match the ground. Root motion stays off.
    /// </summary>
    public sealed class ModelAnim : MonoBehaviour
    {
        public Animation anim;
        public Animator animator;
        public bool HasClips => (anim != null && anim.clip != null) || animator != null;
        /// <summary>True only when a clip or an animator controller will actually play. A bare Animator does not.</summary>
        public bool PlaysClips => (anim != null && anim.clip != null) || (animator != null && animator.runtimeAnimatorController != null);
        public bool HasAttackClip { get { Ensure(); return attack != null || HasAttackTrigger; } }
        public bool Attacking => attackLeft > 0f;
        public bool Casting { get; private set; }
        /// <summary>0 at the start of the attack, 1 at the end.</summary>
        public float AttackUnit
        {
            get
            {
                float total = Mathf.Max(0.05f, Feel.Active.attackSeconds);
                return Mathf.Clamp01(1f - attackLeft / total);
            }
        }

        AnimationState idle, walk, run, attack, current;
        float attackLeft;
        bool cached, attackEdge;
        bool HasAttackTrigger;

        public void BeginAttack(bool cast, float seconds = -1f)
        {
            Ensure();
            Casting = cast;
            attackLeft = seconds > 0f ? seconds : Feel.Active.attackSeconds;
            attackEdge = true;
        }

        public void CancelAttack()
        {
            attackLeft = 0f;
            Casting = false;
            attackEdge = false;
        }

        /// <summary>Binary helper for callers that only know moving or still. Prefer Tick.</summary>
        public void SetMoving(bool moving) => Tick(moving ? Feel.Active.walkRun : 0f, Time.deltaTime);

        public void Tick(float groundSpeed, float dt)
        {
            Ensure();
            if (attackLeft > 0f) attackLeft = Mathf.Max(0f, attackLeft - dt);
            var f = Feel.Active;
            if (anim != null && (walk != null || idle != null))
            {
                var clip = attackLeft > 0f && attack != null ? attack : Loco(groundSpeed, f.idle, f.walkRun);
                if (clip != null)
                {
                    float rate = Rate(clip, groundSpeed, f.idle, f.clipWalk);
                    float blend = attackLeft > 0f && clip == attack ? f.attackBlend : f.locoBlend;
                    if (clip != current)
                    {
                        current = clip;
                        clip.wrapMode = clip == attack ? WrapMode.Once : WrapMode.Loop;
                        clip.speed = rate;
                        anim.CrossFade(clip.name, Mathf.Max(0.02f, blend));
                    }
                    else clip.speed = Mathf.MoveTowards(clip.speed, rate, dt / Mathf.Max(0.05f, blend));
                }
            }
            DriveAnimator(groundSpeed, f);
            attackEdge = false;
        }

        void DriveAnimator(float groundSpeed, FeelProfile f)
        {
            if (animator == null || animator.runtimeAnimatorController == null) return;
            animator.applyRootMotion = false;
            animator.speed = 1f;
            var ps = animator.parameters;
            for (int i = 0; i < ps.Length; i++)
            {
                if (ps[i].name == "Speed" && ps[i].type == AnimatorControllerParameterType.Float)
                    animator.SetFloat("Speed", groundSpeed, f.locoBlend, Time.deltaTime);
                else if (ps[i].name == "Attack" && attackEdge)
                    animator.SetTrigger("Attack");
            }
        }

        AnimationState Loco(float speed, float idleAt, float runAt)
        {
            if (speed < idleAt) return idle != null && idle != walk ? idle : walk;
            if (speed >= runAt && run != null) return run;
            return walk ?? idle;
        }

        float Rate(AnimationState clip, float speed, float idleAt, float clipWalk)
        {
            if (clip == idle && idle != walk) return 1f;
            if (speed < idleAt) return 0f;
            return speed / Mathf.Max(0.1f, clipWalk);
        }

        void Ensure()
        {
            if (cached) return;
            cached = true;
            if (anim != null)
            {
                foreach (AnimationState st in anim)
                {
                    string n = st.name.ToLowerInvariant();
                    if (n.Contains("attack") || n.Contains("swing") || n.Contains("cast")) attack = st;
                    else if (n.Contains("run")) run = st;
                    else if (n.Contains("walk")) walk = st;
                    else if (n.Contains("idle") || n.Contains("clip0")) idle = st;
                    else if (walk == null) walk = st;
                }
                if (walk == null && anim.clip != null) walk = anim[anim.clip.name];
            }
            if (animator != null && animator.runtimeAnimatorController != null)
            {
                foreach (var p in animator.parameters)
                    if (p.name == "Attack") HasAttackTrigger = true;
            }
        }
    }

    /// <summary>After the skin updates, pull a blown-up rig or prop back to a human size.
    /// Only grows a character whose bounds are already a real (small) body, never a 2 cm
    /// bind-pose reading that has not been skinned yet.</summary>
    [DefaultExecutionOrder(-40)]
    public sealed class ModelFit : MonoBehaviour
    {
        public float targetHeight;
        public float maxAxis = 4f;
        int pass;
        bool applied;

        void LateUpdate()
        {
            // Frame 0 is often the bind pose. Measure once the skin has written bounds.
            if (pass++ < 2) return;
            enabled = false;
            if (applied) return;
            if (!Art.UnionBounds(gameObject, out var b)) return;
            float max = Art.MaxAxis(b.size);
            if (max < 0.02f) return;
            float factor = 1f;
            if (max > 10f)
                factor = (targetHeight > 0.2f ? targetHeight : Mathf.Min(maxAxis, 2.6f)) / max;
            else if (targetHeight > 0.2f && b.size.y > 0.3f && b.size.y < targetHeight * 0.65f)
                factor = targetHeight / b.size.y;
            if (factor > 0.92f && factor < 1.08f) return;
            applied = true;
            Debug.LogWarning("Hollowmere scale: " + name + " size " + b.size + " center " + b.center + " x" + factor.ToString("0.###"));
            transform.localScale *= factor;
            if (targetHeight > 0.2f && Art.UnionBounds(gameObject, out b))
            {
                var p = transform.position;
                var shift = new Vector3(p.x - b.center.x, p.y - b.min.y, p.z - b.center.z);
                if (shift.sqrMagnitude > 0.0004f)
                    foreach (Transform c in transform) c.position += shift;
            }
        }
    }

    /// <summary>One sweep after the level exists, so a mesh that is not a Model() instance
    /// still gets logged and, when it is not the floor, shrunk.</summary>
    [DefaultExecutionOrder(80)]
    public sealed class BoundsGuard : MonoBehaviour
    {
        int frame;

        void LateUpdate()
        {
            if (frame++ < 4) return;
            Art.TameOversized(Camera.main);
            Destroy(this);
        }
    }
}
