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

        /// <summary>Additive unlit material from Resources/HollowmereGlow, which is always included.
        /// Vertex-color mode is for TrailRenderer gradients. A texture (impact sheets) is masked by
        /// luminance so a dark cell does not become an opaque square. A bare quad is a soft disc.</summary>
        public static Material GlowMat(Color c, bool vertexColor = false, Texture tex = null)
        {
            string key = ColorUtility.ToHtmlStringRGBA(c) + (vertexColor ? "v" : "c");
            // A sheet animates mainTextureOffset, so each textured material must be its own instance.
            if (tex == null && glowMats.TryGetValue(key, out var cached)) return cached;
            Material m;
            if (glowBase == null)
            {
                var loaded = Resources.Load<Material>("HollowmereGlow");
                if (loaded == null)
                    Debug.LogError("Hollowmere: Resources/HollowmereGlow is missing. Spell glow falls back to the lit color shader.");
                glowBase = loaded != null ? loaded : BaseMaterial();
            }
            m = new Material(glowBase);
            m.color = c;
            m.renderQueue = 3000;
            if (m.HasProperty("_BaseColor")) m.SetColor("_BaseColor", c);
            if (m.HasProperty("_Color")) m.SetColor("_Color", c);
            if (m.HasProperty("_EmissionColor")) m.SetColor("_EmissionColor", vertexColor ? Color.white : c);
            if (m.HasProperty("_UseVertexColor")) m.SetFloat("_UseVertexColor", vertexColor ? 1f : 0f);
            bool mapped = tex != null;
            if (m.HasProperty("_HasMap")) m.SetFloat("_HasMap", mapped ? 1f : 0f);
            if (m.HasProperty("_Soft")) m.SetFloat("_Soft", !mapped && !vertexColor ? 1f : 0f);
            if (mapped)
            {
                m.mainTexture = tex;
                if (m.HasProperty("_MainTex")) m.SetTexture("_MainTex", tex);
            }
            else glowMats[key] = m;
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
            glowQuad.uv = new[] { new Vector2(0f, 0f), new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(1f, 0f) };
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
            string bodyKey = ClipFeet.Strip(key);
            if (bodyKey == "pet_hound") HideBellySlab(go);
            if (bodyKey == "pet_lynx") FaceLynx(go);
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
            // Only people. A spider or hound is supposed to be longer than it is tall.
            fit.biped = key.StartsWith("npc_") || key.StartsWith("hero_");
            var anim = go.GetComponentInChildren<Animation>();
            if (anim != null && anim.clip != null)
            {
                anim.wrapMode = WrapMode.Loop;
                anim.Play();
            }
            var ma = holder.AddComponent<ModelAnim>();
            ma.anim = anim;
            ma.animator = go.GetComponentInChildren<Animator>();
            var foot = ClipFeet.For(key);
            ma.walkFoot = foot.walk;
            ma.runFoot = foot.run;
            ma.longPunch = foot.longPunch;
            if (bodyKey == "mon_drownedwraith") holder.AddComponent<WraithHips>();
            if (key.StartsWith("npc_")) holder.AddComponent<PoseUpright>();
            if (key.StartsWith("hero_")) CombatClipPlayer.Attach(ma, key);
            return holder;
        }

        /// <summary>The v2 rig if it has landed, else the older walk cycle, else the static mesh.</summary>
        public static GameObject Animated(string key, float height, Transform parent)
            => Model(key + "_walk_v2", height, parent) ?? Model(key + "_walk", height, parent) ?? Model(key, height, parent);

        /// <summary>The older hound mesh has a ground slab under the belly. Collapse those triangles when the mesh can be edited.</summary>
        static void HideBellySlab(GameObject go)
        {
            foreach (var mf in go.GetComponentsInChildren<MeshFilter>())
                ClipSlab(mf.sharedMesh, m => mf.sharedMesh = m);
            foreach (var skin in go.GetComponentsInChildren<SkinnedMeshRenderer>())
                ClipSlab(skin.sharedMesh, m => skin.sharedMesh = m);
        }

        static void ClipSlab(Mesh src, System.Action<Mesh> assign)
        {
            if (src == null || !src.isReadable) return;
            var verts = src.vertices;
            var tris = src.triangles;
            bool dropped = false;
            for (int i = 0; i < tris.Length; i += 3)
            {
                var a = verts[tris[i]];
                var b = verts[tris[i + 1]];
                var c = verts[tris[i + 2]];
                if (a.y >= -0.58f || b.y >= -0.58f || c.y >= -0.58f) continue;
                float cx = (a.x + b.x + c.x) / 3f;
                float cz = (a.z + b.z + c.z) / 3f;
                if (Mathf.Abs(cx) >= 0.28f || Mathf.Abs(cz) >= 0.45f) continue;
                tris[i + 1] = tris[i];
                tris[i + 2] = tris[i];
                dropped = true;
            }
            if (!dropped) return;
            var copy = UnityEngine.Object.Instantiate(src);
            copy.triangles = tris;
            assign(copy);
        }

        /// <summary>A lynx that is longer across X is turned onto +Z. One that already faces +Z is left alone.</summary>
        static void FaceLynx(GameObject go)
        {
            float x = 0f, z = 0f;
            foreach (var mf in go.GetComponentsInChildren<MeshFilter>())
                if (mf.sharedMesh != null)
                {
                    x = Mathf.Max(x, mf.sharedMesh.bounds.size.x);
                    z = Mathf.Max(z, mf.sharedMesh.bounds.size.z);
                }
            foreach (var skin in go.GetComponentsInChildren<SkinnedMeshRenderer>())
                if (skin.sharedMesh != null)
                {
                    x = Mathf.Max(x, skin.sharedMesh.bounds.size.x);
                    z = Mathf.Max(z, skin.sharedMesh.bounds.size.z);
                }
            if (x > z * 1.25f) go.transform.localRotation = Quaternion.Euler(0f, 90f, 0f);
        }

        static bool UnderCharacter(Transform t)
        {
            while (t != null)
            {
                if (IsCharacter(t.name)) return true;
                t = t.parent;
            }
            return false;
        }

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

        public static bool MeshWorldBounds(Transform root, out Bounds world) => WorldMeshBounds(root, out world);

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
                        // Sample the imported texture directly. Blitting a GPU-only glTF map
                        // into a new Texture2D came back white and the dungeon hero was a blob.
                        if (dst.HasProperty("_BaseMap")) dst.SetTexture("_BaseMap", tex);
                        if (dst.HasProperty("_MainTex")) dst.SetTexture("_MainTex", tex);
                        dst.mainTexture = tex;
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

        /// <summary>Hollowmere/Color with a repeating ground texture, tinted so a light photo
        /// does not become a white or cream slab under the stage lights.</summary>
        public static Material GroundMat(string name, Color tint)
        {
            var tex = ArtDrop.Ground(name);
            var m = new Material(BaseMaterial());
            m.color = tint;
            if (m.HasProperty("_BaseColor")) m.SetColor("_BaseColor", tint);
            if (m.HasProperty("_Color")) m.SetColor("_Color", tint);
            if (tex != null)
            {
                if (m.HasProperty("_BaseMap")) m.SetTexture("_BaseMap", tex);
                if (m.HasProperty("_MainTex")) m.SetTexture("_MainTex", tex);
                m.mainTexture = tex;
                m.mainTextureScale = new Vector2(2.5f, 2.5f);
                if (m.HasProperty("_HasMap")) m.SetFloat("_HasMap", 1f);
            }
            return m;
        }

        public static Material GroundMat(string name) => GroundMat(name, Color.white);

        static Mesh flatQuad, wallQuad;

        /// <summary>A horizontal or vertical quad. Cubes squashed flat read as a cream band with bars.</summary>
        public static GameObject PlaceQuad(Transform parent, string name, Vector3 localPos, Quaternion localRot, float width, float height, Material mat, bool floor)
        {
            var g = new GameObject(name);
            g.transform.SetParent(parent, false);
            g.transform.localPosition = localPos;
            g.transform.localRotation = localRot;
            g.transform.localScale = new Vector3(width, floor ? 1f : height, floor ? height : 1f);
            var mf = g.AddComponent<MeshFilter>();
            mf.sharedMesh = floor ? FlatQuad() : WallQuad();
            var mr = g.AddComponent<MeshRenderer>();
            mr.sharedMaterial = mat;
            mr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            mr.receiveShadows = false;
            return g;
        }

        static Mesh FlatQuad()
        {
            if (flatQuad != null) return flatQuad;
            flatQuad = new Mesh { name = "flatQuad" };
            flatQuad.vertices = new[]
            {
                new Vector3(-0.5f, 0f, -0.5f), new Vector3(0.5f, 0f, -0.5f),
                new Vector3(-0.5f, 0f, 0.5f), new Vector3(0.5f, 0f, 0.5f),
            };
            flatQuad.uv = new[] { new Vector2(0f, 0f), new Vector2(1f, 0f), new Vector2(0f, 1f), new Vector2(1f, 1f) };
            flatQuad.normals = new[] { Vector3.up, Vector3.up, Vector3.up, Vector3.up };
            flatQuad.triangles = new[] { 0, 2, 1, 2, 3, 1 };
            return flatQuad;
        }

        static Mesh WallQuad()
        {
            if (wallQuad != null) return wallQuad;
            wallQuad = new Mesh { name = "wallQuad" };
            wallQuad.vertices = new[]
            {
                new Vector3(-0.5f, -0.5f, 0f), new Vector3(0.5f, -0.5f, 0f),
                new Vector3(-0.5f, 0.5f, 0f), new Vector3(0.5f, 0.5f, 0f),
            };
            wallQuad.uv = new[] { new Vector2(0f, 0f), new Vector2(1f, 0f), new Vector2(0f, 1f), new Vector2(1f, 1f) };
            wallQuad.normals = new[] { -Vector3.forward, -Vector3.forward, -Vector3.forward, -Vector3.forward };
            // Normal faces -Z, toward a camera sitting on the negative Z side.
            wallQuad.triangles = new[] { 0, 2, 1, 2, 3, 1 };
            return wallQuad;
        }

        /// <summary>Place a camera so the renderers under root fill the frame. Skips backdrop meshes.</summary>
        public static void FrameCamera(Camera cam, GameObject root, string skipPrefix, float fill = 0.78f)
        {
            if (cam == null || root == null) return;
            bool any = false;
            Bounds b = default;
            foreach (var r in root.GetComponentsInChildren<Renderer>())
            {
                if (!(r is MeshRenderer) && !(r is SkinnedMeshRenderer)) continue;
                if (!string.IsNullOrEmpty(skipPrefix) && r.gameObject.name.StartsWith(skipPrefix)) continue;
                if (!any) { b = r.bounds; any = true; }
                else b.Encapsulate(r.bounds);
            }
            if (!any) return;
            float h = Mathf.Max(0.4f, b.size.y);
            float w = Mathf.Max(h * 0.4f, b.size.x);
            float aspect = cam.aspect > 0.05f ? cam.aspect : 1f;
            float vfov = cam.fieldOfView * Mathf.Deg2Rad;
            float distH = (h * 0.5f) / (Mathf.Tan(vfov * 0.5f) * Mathf.Max(0.4f, fill));
            float hfov = 2f * Mathf.Atan(Mathf.Tan(vfov * 0.5f) * aspect);
            float distW = (w * 0.5f) / (Mathf.Tan(hfov * 0.5f) * Mathf.Max(0.4f, fill));
            float dist = Mathf.Max(distH, distW) + 0.35f;
            var look = b.center;
            cam.transform.position = look + new Vector3(0f, h * 0.04f, -dist);
            cam.transform.rotation = Quaternion.LookRotation(look - cam.transform.position, Vector3.up);
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
                // A skinned AABB can read as tens of metres. Shrinking from that made the
                // blacksmith a speck and hid the hero on the select stage. People are fitted
                // from the mesh, not from that box.
                if (level || max <= 10f || UnderCharacter(r.transform)) continue;
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
    /// Switches idle, walk, and run from the ground speed, and crossfades attacks and hits.
    /// Shipped clips are legacy, so the blend is Animation.CrossFade. Playback rate is
    /// groundSpeed / footSpeed from ClipFeet, so the feet match the ground. Root motion stays off.
    /// </summary>
    public sealed class ModelAnim : MonoBehaviour
    {
        public Animation anim;
        public Animator animator;
        public float walkFoot = 2.2f;
        public float runFoot = 4.1f;
        public bool longPunch;
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
            float total = attackTotal > 0.05f ? attackTotal : Mathf.Max(0.05f, Feel.Active.attackSeconds);
            return Mathf.Clamp01(1f - attackLeft / total);
            }
        }

        AnimationState idle, walk, run, attack, hit, skill, current;
        float attackLeft, attackTotal, hitLeft;
        const float PunchIn = 0.85f;
        const float PunchOut = 1.75f;
        bool cached, attackEdge, skillLoop;
        bool HasAttackTrigger;
        public bool HasNamedSkill => skill != null;
        public bool PlayingSkill => skill != null && attackLeft > 0f;

        public void Forget() { cached = false; }

        public void BeginAttack(bool cast, float seconds = -1f, string clipName = null)
        {
            Ensure();
            Casting = cast;
            attackTotal = seconds > 0.05f ? seconds : (longPunch ? PunchOut - PunchIn : Feel.Active.attackSeconds);
            attackLeft = attackTotal;
            hitLeft = 0f;
            attackEdge = true;
            skillLoop = false;
            skill = null;
            if (anim != null && !string.IsNullOrEmpty(clipName))
            {
                var st = anim[clipName];
                if (st != null && st.clip != null) skill = st;
            }
            if (skill == null) skill = attack;
        }

        public void LoopSkill(float seconds)
        {
            if (skill == null) { CancelAttack(); return; }
            skillLoop = true;
            attackTotal = Mathf.Max(0.2f, seconds);
            attackLeft = attackTotal;
            skill.wrapMode = WrapMode.Loop;
            skill.speed = 1f;
        }

        public void BeginHit()
        {
            Ensure();
            if (hit == null || attackLeft > 0f) return;
            hitLeft = 0.7f;
        }

        public void CancelAttack()
        {
            attackLeft = 0f;
            hitLeft = 0f;
            Casting = false;
            attackEdge = false;
            skillLoop = false;
            skill = null;
        }

        /// <summary>Binary helper for callers that only know moving or still. Prefer Tick.</summary>
        public void SetMoving(bool moving) => Tick(moving ? Feel.Active.walkRun : 0f, Time.deltaTime);

        public void Tick(float groundSpeed, float dt)
        {
            Ensure();
            if (attackLeft > 0f) attackLeft = Mathf.Max(0f, attackLeft - dt);
            if (hitLeft > 0f) hitLeft = Mathf.Max(0f, hitLeft - dt);
            var f = Feel.Active;
            if (anim != null && (walk != null || idle != null))
            {
                var posed = skill != null ? skill : attack;
                bool striking = attackLeft > 0f && posed != null;
                bool flinch = !striking && hitLeft > 0f && hit != null;
                var clip = striking ? posed : flinch ? hit : Loco(groundSpeed, f.idle, f.walkRun);
                if (clip != null)
                {
                    float rate = striking || flinch ? 1f : Rate(clip, groundSpeed, f.idle);
                    float blend = striking || flinch ? f.attackBlend : f.locoBlend;
                    if (clip != current)
                    {
                        current = clip;
                        clip.wrapMode = striking ? (skillLoop ? WrapMode.Loop : WrapMode.Once) : flinch ? WrapMode.Once : WrapMode.Loop;
                        clip.speed = rate;
                        anim.CrossFade(clip.name, Mathf.Max(0.02f, blend));
                        if (striking && longPunch && skill == null) clip.time = PunchIn;
                    }
                    else if (!striking && !flinch) clip.speed = Mathf.MoveTowards(clip.speed, rate, dt / Mathf.Max(0.05f, blend));
                    if (striking && longPunch && skill == null && clip.time >= PunchOut) attackLeft = 0f;
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
            if (speed < idleAt && idle != null && idle != walk) return idle;
            if (speed >= runAt && run != null && runFoot > 0.2f) return run;
            return walk ?? idle;
        }

        float Rate(AnimationState clip, float speed, float idleAt)
        {
            if (clip == idle && idle != walk) return 1f;
            float foot = clip == run && runFoot > 0.2f ? runFoot : walkFoot;
            if (foot < 0.15f) foot = Feel.Active.clipWalk;
            // A missing idle used to freeze the walk at speed 0, which parked the feet mid-stride.
            if (speed < idleAt) return Mathf.Max(0.2f, speed / foot);
            return Mathf.Max(0.05f, speed / foot);
        }

        static bool Named(string n, string key)
        {
            return n == key || n.EndsWith("|" + key) || n.Contains("|" + key + "|");
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
                    if (Named(n, "hit")) hit = st;
                    else if (Named(n, "attack") || Named(n, "swing")) attack = st;
                    else if (Named(n, "run")) run = st;
                    else if (Named(n, "walk")) walk = st;
                    else if (Named(n, "idle") || n.Contains("clip0")) idle = st;
                }
                if (walk == null && anim.clip != null) walk = anim[anim.clip.name];
                if (idle == walk) idle = null;
            }
            if (animator != null && animator.runtimeAnimatorController != null)
            {
                foreach (var p in animator.parameters)
                    if (p.name == "Attack") HasAttackTrigger = true;
            }
        }
    }

    /// <summary>Keeps the drowned wraith's hips over the controller. The long punch walks them almost a metre off to the side.</summary>
    public sealed class WraithHips : MonoBehaviour
    {
        Transform hips;
        Vector3 rest;
        bool ready;

        void LateUpdate()
        {
            if (!ready)
            {
                hips = Find(transform);
                if (hips == null) return;
                rest = hips.localPosition;
                ready = true;
            }
            var p = hips.localPosition;
            p.x = Mathf.Clamp(p.x, rest.x - 0.18f, rest.x + 0.18f);
            p.z = Mathf.Clamp(p.z, rest.z - 0.18f, rest.z + 0.18f);
            hips.localPosition = p;
        }

        static Transform Find(Transform root)
        {
            if (root.name == "Hips") return root;
            for (int i = 0; i < root.childCount; i++)
            {
                var f = Find(root.GetChild(i));
                if (f != null) return f;
            }
            return null;
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
        public bool biped;
        int pass;
        bool applied;

        void LateUpdate()
        {
            // Frame 0 is often the bind pose. Measure once the skin has written bounds.
            if (pass++ < 2) return;
            enabled = false;
            if (applied) return;
            if (biped) StandIfLying();
            // Mesh bounds through the world matrix. Renderer.bounds on these rigs can be
            // huge or tiny and that is what shrank the blacksmith.
            if (!Art.MeshWorldBounds(transform, out var b)) return;
            float h = b.size.y;
            if (h < 0.002f) return;
            float factor = 1f;
            if (targetHeight > 0.2f)
                factor = targetHeight / h;
            else if (Art.MaxAxis(b.size) > maxAxis)
                factor = maxAxis / Art.MaxAxis(b.size);
            if (factor > 0.92f && factor < 1.08f) factor = 1f;
            else
            {
                applied = true;
                Debug.LogWarning("Hollowmere scale: " + name + " mesh " + b.size + " x" + factor.ToString("0.###"));
                transform.localScale *= factor;
            }
            if (targetHeight > 0.2f && Art.MeshWorldBounds(transform, out b))
            {
                var p = transform.position;
                var shift = new Vector3(p.x - b.center.x, p.y - b.min.y, p.z - b.center.z);
                if (shift.sqrMagnitude > 0.0004f)
                    foreach (Transform c in transform) c.position += shift;
            }
        }

        /// <summary>A biped whose skinned bounds are longer than they are tall is lying down.
        /// Quarter-turns of the holder stand the whole clip up. Pets are not bipeds.</summary>
        void StandIfLying()
        {
            // mesh.bounds through the world matrix, not Renderer.bounds: the skinned box
            // stays stale until the end of the frame, so a same-frame turn would see no change.
            if (!Art.MeshWorldBounds(transform, out var b)) return;
            if (b.size.y >= b.size.x * 0.92f && b.size.y >= b.size.z * 0.92f) return;
            var start = transform.localRotation;
            var best = start;
            float bestH = b.size.y;
            Quaternion[] opts =
            {
                Quaternion.Euler(-90f, 0f, 0f),
                Quaternion.Euler(90f, 0f, 0f),
                Quaternion.Euler(0f, 0f, -90f),
                Quaternion.Euler(0f, 0f, 90f),
            };
            foreach (var q in opts)
            {
                transform.localRotation = start * q;
                if (!Art.MeshWorldBounds(transform, out var nb)) continue;
                if (nb.size.y > bestH)
                {
                    bestH = nb.size.y;
                    best = transform.localRotation;
                }
            }
            transform.localRotation = best;
            Debug.LogWarning("Hollowmere stand: " + name + " height " + bestH.ToString("0.00"));
        }
    }

    /// <summary>After the idle pose is playing, stand a person whose skeleton is lying down
    /// and lock their height. Mesh bounds miss a pose that only exists in the bones.</summary>
    [DefaultExecutionOrder(50)]
    public sealed class PoseUpright : MonoBehaviour
    {
        int phase;
        Quaternion bestRot;
        float bestH;
        static readonly Vector3[] Turns =
        {
            new Vector3(-90f, 0f, 0f),
            new Vector3(90f, 0f, 0f),
            new Vector3(0f, 0f, -90f),
            new Vector3(0f, 0f, 90f),
        };

        void LateUpdate()
        {
            phase++;
            if (phase < 3) return;
            if (phase == 3)
            {
                var hips = FindBone(transform, "Hips") ?? FindBone(transform, "hips");
                if (hips != null && hips.up.y < 0.4f)
                    transform.rotation = Quaternion.FromToRotation(hips.up, Vector3.up) * transform.rotation;
                return;
            }
            if (!Sane(out var b))
            {
                if (phase > 4) transform.rotation = bestRot;
                Finish();
                return;
            }
            if (phase == 4)
            {
                bestRot = transform.rotation;
                bestH = b.size.y;
                if (Upright(b)) { Finish(); return; }
                transform.rotation = bestRot * Quaternion.Euler(Turns[0]);
                return;
            }
            int tried = phase - 5;
            if (b.size.y > bestH)
            {
                bestH = b.size.y;
                bestRot = transform.rotation;
            }
            else transform.rotation = bestRot;
            if (Upright(b) || tried >= Turns.Length - 1)
            {
                transform.rotation = bestRot;
                Finish();
                return;
            }
            transform.rotation = bestRot * Quaternion.Euler(Turns[tried + 1]);
        }

        void Finish()
        {
            var fit = GetComponent<ModelFit>();
            float target = fit != null && fit.targetHeight > 0.2f ? fit.targetHeight : 1.75f;
            if (Art.MeshWorldBounds(transform, out var b) && b.size.y > 0.02f)
            {
                float factor = target / b.size.y;
                if (factor < 0.8f || factor > 1.25f)
                    transform.localScale *= factor;
            }
            if (Art.MeshWorldBounds(transform, out var grounded))
            {
                var p = transform.position;
                var shift = new Vector3(p.x - grounded.center.x, p.y - grounded.min.y, p.z - grounded.center.z);
                if (shift.sqrMagnitude > 0.0004f)
                    foreach (Transform c in transform) c.position += shift;
            }
            enabled = false;
        }

        bool Sane(out Bounds b)
        {
            b = default;
            if (!Art.UnionBounds(gameObject, out b)) return false;
            float m = Art.MaxAxis(b.size);
            return m > 0.35f && m < 4.5f;
        }

        static bool Upright(Bounds b) => b.size.y >= Mathf.Max(b.size.x, b.size.z) * 0.85f;

        static Transform FindBone(Transform root, string name)
        {
            if (root.name == name) return root;
            for (int i = 0; i < root.childCount; i++)
            {
                var f = FindBone(root.GetChild(i), name);
                if (f != null) return f;
            }
            return null;
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
