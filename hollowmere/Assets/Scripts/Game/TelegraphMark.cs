using UnityEngine;
using Hollowmere.Core;

namespace Hollowmere
{
    /// <summary>A projected ground mark. The mesh is a quad; the shader cuts the shape.</summary>
    public sealed class TelegraphMark : MonoBehaviour
    {
        public TelegraphDef def;
        public TelegraphShape shape;
        public float seconds = 0.4f;
        float age;
        float fill;
        bool held;
        Material mat;
        static Mesh forwardMesh;
        static Mesh discMesh;
        static Texture2D fallbackNoise;
        static Shader shader;

        public float Fill => fill;

        public static TelegraphMark Place(TelegraphDef def, Vector3 at, Vector3 forward, float seconds, Element element, float size = 0f)
        {
            if (def == null || !TelegraphBook.Shaped(def))
            {
                Debug.LogError("Hollowmere telegraph FAIL " + (def == null ? "missing" : def.id) + " uses the default circle");
                return null;
            }
            forward.y = 0f;
            if (forward.sqrMagnitude < 0.0001f) forward = Vector3.forward;
            forward.Normalize();
            var go = new GameObject("telegraph");
            go.transform.position = new Vector3(at.x, 0.045f, at.z);
            bool disc = def.shape == TelegraphShape.Ring || def.shape == TelegraphShape.Rune;
            bool cone = def.shape == TelegraphShape.Cone;
            if (disc)
                go.transform.rotation = Quaternion.identity;
            else
                go.transform.rotation = Quaternion.LookRotation(forward, Vector3.up);
            float reach = def.reach;
            float width = def.width;
            float radius = def.radius;
            if (size > 0.05f)
            {
                if (disc) radius = size;
                else reach = Mathf.Max(reach, size);
            }
            if (cone)
                go.transform.localScale = new Vector3(reach * 2f, 1f, reach * 2f);
            else if (disc)
                go.transform.localScale = new Vector3(radius * 2f, 1f, radius * 2f);
            else
                go.transform.localScale = new Vector3(Mathf.Max(0.35f, width), 1f, Mathf.Max(0.4f, reach));
            var mark = go.AddComponent<TelegraphMark>();
            mark.def = def;
            mark.shape = def.shape;
            mark.seconds = Mathf.Max(0.05f, seconds);
            mark.Build(element);
            return mark;
        }

        public void SetFill(float value)
        {
            held = true;
            fill = Mathf.Clamp01(value);
            Apply();
        }

        void Build(Element element)
        {
            var filt = gameObject.AddComponent<MeshFilter>();
            bool round = shape == TelegraphShape.Ring || shape == TelegraphShape.Rune || shape == TelegraphShape.Cone;
            filt.sharedMesh = round ? Disc() : Forward();
            var rend = gameObject.AddComponent<MeshRenderer>();
            rend.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            rend.receiveShadows = false;
            mat = NewMat();
            rend.sharedMaterial = mat;
            var col = TelegraphBook.Paint(def, element);
            var edge = Color.Lerp(col, Color.white, 0.55f);
            if (mat.HasProperty("_BaseColor")) mat.SetColor("_BaseColor", col);
            if (mat.HasProperty("_Color")) mat.SetColor("_Color", col);
            if (mat.HasProperty("_EdgeColor")) mat.SetColor("_EdgeColor", edge);
            if (mat.HasProperty("_Shape")) mat.SetFloat("_Shape", (float)shape);
            if (mat.HasProperty("_Inner")) mat.SetFloat("_Inner", def != null ? def.inner : 0.58f);
            if (mat.HasProperty("_FromOrigin")) mat.SetFloat("_FromOrigin", def != null && def.fillFromOrigin != 0 ? 1f : 0f);
            if (mat.HasProperty("_Scroll")) mat.SetFloat("_Scroll", def != null ? def.scroll : 0.45f);
            if (mat.HasProperty("_Angle")) mat.SetFloat("_Angle", def != null ? def.angle : 80f);
            float aspect = 0.2f;
            var sc = transform.localScale;
            if (sc.z > 0.001f) aspect = sc.x / sc.z;
            if (mat.HasProperty("_Aspect")) mat.SetFloat("_Aspect", aspect);
            var noise = Noise(def != null ? def.noiseName : null);
            if (noise != null && mat.HasProperty("_MainTex"))
            {
                mat.SetTexture("_MainTex", noise);
                if (mat.HasProperty("_HasNoise")) mat.SetFloat("_HasNoise", 1f);
            }
            Apply();
        }

        void Update()
        {
            if (held) return;
            age += Time.deltaTime;
            fill = seconds <= 0.001f ? 1f : Mathf.Clamp01(age / seconds);
            Apply();
            if (age > seconds + 0.28f) Destroy(gameObject);
        }

        void Apply()
        {
            if (mat == null) return;
            if (mat.HasProperty("_Fill")) mat.SetFloat("_Fill", fill);
            float scroll = def != null ? def.scroll : 0.45f;
            if (mat.HasProperty("_Phase")) mat.SetFloat("_Phase", Time.time * scroll);
        }

        void OnDestroy()
        {
            if (mat != null) Destroy(mat);
        }

        static Material NewMat()
        {
            if (shader == null)
            {
                shader = Resources.Load<Shader>("HollowmereTelegraph");
                if (shader == null) shader = Shader.Find("Hollowmere/Telegraph");
            }
            if (shader == null)
            {
                Debug.LogError("Hollowmere telegraph FAIL shader missing");
                return Art.GlowMat(new Color(1f, 0.35f, 0.1f), false, null);
            }
            var m = new Material(shader);
            m.renderQueue = 3100;
            return m;
        }

        static Texture Noise(string name)
        {
            if (!string.IsNullOrEmpty(name))
            {
                var sprite = ArtDrop.Sprite(name);
                if (sprite != null && sprite.texture != null) return sprite.texture;
            }
            if (fallbackNoise != null) return fallbackNoise;
            const int n = 64;
            fallbackNoise = new Texture2D(n, n, TextureFormat.RGBA32, false);
            fallbackNoise.wrapMode = TextureWrapMode.Repeat;
            fallbackNoise.filterMode = FilterMode.Bilinear;
            var pix = new Color[n * n];
            for (int y = 0; y < n; y++)
                for (int x = 0; x < n; x++)
                {
                    float v = Mathf.PerlinNoise(x * 0.17f, y * 0.17f);
                    pix[y * n + x] = new Color(v, v, v, 1f);
                }
            fallbackNoise.SetPixels(pix);
            fallbackNoise.Apply(false, true);
            return fallbackNoise;
        }

        static Mesh Forward()
        {
            if (forwardMesh != null) return forwardMesh;
            forwardMesh = new Mesh { name = "tgForward" };
            forwardMesh.vertices = new[]
            {
                new Vector3(-0.5f, 0f, 0f), new Vector3(0.5f, 0f, 0f),
                new Vector3(-0.5f, 0f, 1f), new Vector3(0.5f, 0f, 1f),
            };
            forwardMesh.uv = new[]
            {
                new Vector2(0f, 0f), new Vector2(1f, 0f),
                new Vector2(0f, 1f), new Vector2(1f, 1f),
            };
            forwardMesh.triangles = new[] { 0, 2, 1, 2, 3, 1 };
            return forwardMesh;
        }

        static Mesh Disc()
        {
            if (discMesh != null) return discMesh;
            discMesh = new Mesh { name = "tgDisc" };
            discMesh.vertices = new[]
            {
                new Vector3(-0.5f, 0f, -0.5f), new Vector3(0.5f, 0f, -0.5f),
                new Vector3(-0.5f, 0f, 0.5f), new Vector3(0.5f, 0f, 0.5f),
            };
            discMesh.uv = new[]
            {
                new Vector2(0f, 0f), new Vector2(1f, 0f),
                new Vector2(0f, 1f), new Vector2(1f, 1f),
            };
            discMesh.triangles = new[] { 0, 2, 1, 2, 3, 1 };
            return discMesh;
        }
    }

    /// <summary>Wind-up on the body: slowed clip is the caller's job. This is the glow, trail, and charge.</summary>
    public sealed class TelegraphBody : MonoBehaviour
    {
        TelegraphDef def;
        float left;
        Transform hand;
        Transform eyes;
        TrailRenderer trail;
        GameObject weaponGlow;
        GameObject eyeGlow;
        GameObject charge;
        Renderer[] rimHosts;
        Material[][] rimPrev;
        Material rimMat;
        Color elementTint = Color.white;
        bool armed;

        public bool Armed => armed;
        public bool TrailOn => trail != null && trail.emitting;

        public static TelegraphBody Arm(MonsterActor host, TelegraphDef def, float seconds, Element element)
        {
            if (host == null || def == null) return null;
            var body = host.GetComponent<TelegraphBody>();
            if (body == null) body = host.gameObject.AddComponent<TelegraphBody>();
            body.Begin(host, def, seconds, element);
            return body;
        }

        public void SetSwing(float fill)
        {
            if (trail == null) return;
            trail.emitting = def != null && def.trail != 0 && fill >= 0.45f;
        }

        void Begin(MonsterActor host, TelegraphDef d, float seconds, Element element)
        {
            Clear();
            def = d;
            left = Mathf.Max(0.15f, seconds);
            armed = true;
            var col = TelegraphBook.Paint(d, element);
            elementTint = col;
            hand = Find(host.transform, "hand") ?? Find(host.transform, "weapon");
            eyes = Find(host.transform, "eye") ?? Find(host.transform, "head");
            float lift = 1.15f * Mathf.Max(0.6f, host.stats.def.scale);
            AddRim(host, RimTint(host, col));
            if (d.weaponGlow != 0)
            {
                weaponGlow = Art.GlowSprite(null, 0.26f, col * 0.4f);
                weaponGlow.name = "weaponGlow";
            }
            if (d.eyeGlow != 0)
            {
                eyeGlow = Art.GlowSprite(null, 0.12f, col * 0.4f);
                eyeGlow.name = "eyeGlow";
            }
            if (d.charge != 0)
            {
                string sheet = element == Element.Frost ? "frost_flipbook_4x4"
                    : element == Element.Poison ? "poison_flipbook_4x4"
                    : element == Element.Arcane ? "shadow_flipbook_4x4"
                    : element == Element.Lightning ? "lightning_flipbook_4x4"
                    : "fire_flipbook_4x4";
                charge = Art.VfxSprite(null, 0.7f, col, sheet);
                if (charge == null) charge = Art.GlowSprite(null, 0.55f, col);
                if (charge != null) charge.name = "chargeVfx";
            }
            if (d.trail != 0)
            {
                var go = new GameObject("swingTrail");
                trail = go.AddComponent<TrailRenderer>();
                trail.time = 0.26f;
                trail.startWidth = 0.2f;
                trail.endWidth = 0.02f;
                trail.minVertexDistance = 0.04f;
                trail.numCapVertices = 1;
                trail.numCornerVertices = 1;
                trail.emitting = false;
                trail.material = Art.GlowMat(col, true);
                trail.startColor = col;
                trail.endColor = new Color(col.r, col.g, col.b, 0f);
            }
            Place(host, lift);
        }

        void LateUpdate()
        {
            if (!armed) return;
            var host = GetComponent<MonsterActor>();
            if (host == null) return;
            float lift = 1.15f * Mathf.Max(0.6f, host.stats.def.scale);
            Place(host, lift);
        }

        void Place(MonsterActor host, float lift)
        {
            Vector3 handAt = hand != null
                ? hand.position
                : host.Pos + Vector3.up * lift + host.transform.forward * 0.45f + host.transform.right * 0.28f;
            Vector3 eyeAt = eyes != null
                ? eyes.position
                : host.Pos + Vector3.up * (lift + 0.45f) + host.transform.forward * 0.18f;
            if (weaponGlow != null) weaponGlow.transform.position = handAt;
            if (trail != null) trail.transform.position = handAt;
            if (charge != null) charge.transform.position = handAt;
            if (eyeGlow != null) eyeGlow.transform.position = eyeAt;
        }

        void Update()
        {
            if (!armed) return;
            left -= Time.deltaTime;
            float pulse = Mathf.Lerp(0.30f, 0.50f, 0.5f + 0.5f * Mathf.Sin(Time.time * 9f));
            TintGlow(weaponGlow, elementTint * pulse);
            TintGlow(eyeGlow, elementTint * pulse);
            PulseGear(pulse);
            if (left <= 0f) Clear();
        }

        void Clear()
        {
            armed = false;
            if (trail != null)
            {
                trail.emitting = false;
                Destroy(trail.gameObject, trail.time);
                trail = null;
            }
            if (weaponGlow != null) Destroy(weaponGlow);
            if (eyeGlow != null) Destroy(eyeGlow);
            if (charge != null) Destroy(charge);
            weaponGlow = null;
            eyeGlow = null;
            charge = null;
            RemoveRim();
        }

        static Color RimTint(MonsterActor host, Color element)
        {
            string model = host != null && host.stats != null && host.stats.def != null ? host.stats.def.model : "";
            if (!string.IsNullOrEmpty(model) && model.IndexOf("demon", System.StringComparison.OrdinalIgnoreCase) >= 0)
                return new Color(1f, 0.88f, 0.48f, 1f);
            return element;
        }

        void AddRim(MonsterActor host, Color rim)
        {
            var shader = Resources.Load<Shader>("HollowmereRim");
            if (shader == null) shader = Shader.Find("Hollowmere/Rim");
            if (shader == null)
            {
                Debug.LogError("Hollowmere telegraph FAIL rim shader missing");
                return;
            }
            string model = host.stats != null && host.stats.def != null ? host.stats.def.model : "";
            bool demon = !string.IsNullOrEmpty(model) && model.IndexOf("demon", System.StringComparison.OrdinalIgnoreCase) >= 0;
            rimMat = new Material(shader);
            rimMat.SetColor("_RimColor", rim);
            rimMat.SetColor("_Color", rim);
            rimMat.SetFloat("_RimPower", 3.2f);
            rimMat.SetFloat("_RimStrength", demon ? 1.45f : 1.1f);
            rimMat.renderQueue = 3000;
            var all = host.GetComponentsInChildren<Renderer>(true);
            int n = 0;
            for (int i = 0; i < all.Length; i++)
                if (BodyMesh(all[i])) n++;
            if (n == 0)
            {
                Destroy(rimMat);
                rimMat = null;
                return;
            }
            rimHosts = new Renderer[n];
            rimPrev = new Material[n][];
            int w = 0;
            for (int i = 0; i < all.Length; i++)
            {
                var r = all[i];
                if (!BodyMesh(r)) continue;
                var mats = r.sharedMaterials;
                rimHosts[w] = r;
                rimPrev[w] = mats;
                var next = new Material[mats.Length + 1];
                for (int m = 0; m < mats.Length; m++) next[m] = mats[m];
                next[mats.Length] = rimMat;
                r.sharedMaterials = next;
                w++;
            }
        }

        void RemoveRim()
        {
            if (rimHosts != null && rimPrev != null)
            {
                int n = Mathf.Min(rimHosts.Length, rimPrev.Length);
                for (int i = 0; i < n; i++)
                    if (rimHosts[i] != null && rimPrev[i] != null) rimHosts[i].sharedMaterials = rimPrev[i];
            }
            rimHosts = null;
            rimPrev = null;
            if (rimMat != null) Destroy(rimMat);
            rimMat = null;
        }

        void PulseGear(float pulse)
        {
            var host = GetComponent<MonsterActor>();
            if (host == null) return;
            var tint = elementTint * pulse;
            var all = host.GetComponentsInChildren<Renderer>(true);
            for (int i = 0; i < all.Length; i++)
            {
                var r = all[i];
                if (!GearMesh(r)) continue;
                var mats = r.materials;
                for (int m = 0; m < mats.Length; m++)
                {
                    var mat = mats[m];
                    if (mat == null || mat == rimMat) continue;
                    if (!mat.HasProperty("_EmissionColor")) continue;
                    mat.EnableKeyword("_EMISSION");
                    mat.SetColor("_EmissionColor", tint);
                }
            }
        }

        static void TintGlow(GameObject go, Color c)
        {
            if (go == null) return;
            var r = go.GetComponent<Renderer>();
            if (r == null) return;
            var mat = r.material;
            if (mat == null) return;
            if (mat.HasProperty("_BaseColor")) mat.SetColor("_BaseColor", c);
            if (mat.HasProperty("_Color")) mat.SetColor("_Color", c);
            if (mat.HasProperty("_EmissionColor")) mat.SetColor("_EmissionColor", c);
        }

        static bool BodyMesh(Renderer r)
        {
            if (r == null || r is TrailRenderer || r is ParticleSystemRenderer || r is LineRenderer) return false;
            if (!(r is MeshRenderer) && !(r is SkinnedMeshRenderer)) return false;
            string n = r.gameObject.name;
            if (n == "label" || n == "telegraph") return false;
            if (n.IndexOf("glow", System.StringComparison.OrdinalIgnoreCase) >= 0) return false;
            if (n.IndexOf("charge", System.StringComparison.OrdinalIgnoreCase) >= 0) return false;
            return r is SkinnedMeshRenderer || GearMesh(r) == false;
        }

        static bool GearMesh(Renderer r)
        {
            if (r == null || r is SkinnedMeshRenderer || r is TrailRenderer) return false;
            string n = r.gameObject.name.ToLowerInvariant();
            return n.Contains("weapon") || n.Contains("sword") || n.Contains("eye") || n.Contains("hand");
        }

        void OnDestroy() => Clear();

        static Transform Find(Transform root, string token)
        {
            if (root == null || string.IsNullOrEmpty(token)) return null;
            if (root.name.ToLowerInvariant().Contains(token)) return root;
            for (int i = 0; i < root.childCount; i++)
            {
                var f = Find(root.GetChild(i), token);
                if (f != null) return f;
            }
            return null;
        }
    }
}
