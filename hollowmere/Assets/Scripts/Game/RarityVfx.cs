using Hollowmere.Core;
using UnityEngine;

namespace Hollowmere
{
    /// <summary>
    /// Rarity finish and the persistent legendary/set motes. The finish multiplies
    /// the authored albedo and biases metal and smoothness. It does not replace
    /// the albedo, normal, or metal maps. Emission is a fresnel rim, plus an edge
    /// mask on legendary and set. Nothing emits or spawns inside the face sphere,
    /// and the head slot stays dark.
    /// </summary>
    public static class RarityVfx
    {
        public const string Name = "rarity_vfx";

        public static void EnsureFace(Transform body)
        {
            if (body == null) return;
            var host = body.GetComponentInParent<HeroActor>();
            var t = host != null ? host.transform : body.root;
            if (t == null) return;
            if (t.GetComponent<FaceGuard>() == null) t.gameObject.AddComponent<FaceGuard>();
            FaceGuard.Push(t);
        }

        public static void Clear(Transform body)
        {
            if (body == null) return;
            var doomed = new System.Collections.Generic.List<GameObject>();
            foreach (var t in body.GetComponentsInChildren<Transform>(true))
                if (t != null && t.name == Name) doomed.Add(t.gameObject);
            for (int i = 0; i < doomed.Count; i++)
                if (doomed[i] != null) Object.DestroyImmediate(doomed[i]);
        }

        public static void Tint(GameObject go, Item it, string family, EquipSlot slot)
        {
            if (go == null || Item.IsNone(it)) return;
            EnsureFace(go.transform);
            var row = RarityBook.Row(it.rarity);
            bool head = slot == EquipSlot.Head;
            float emit = head ? 0f : row.emit;
            var glow = head ? Color.black : RarityBook.Glow(it.rarity, family) * emit;
            foreach (var r in go.GetComponentsInChildren<Renderer>(true))
            {
                if (r is ParticleSystemRenderer) continue;
                var mats = r.materials;
                for (int i = 0; i < mats.Length; i++)
                {
                    var m = mats[i];
                    if (m == null) continue;
                    UseLit(m);
                    var c = m.HasProperty("_BaseColor") ? m.GetColor("_BaseColor") : m.color;
                    c = new Color(c.r * row.r, c.g * row.g, c.b * row.b, c.a);
                    if (m.HasProperty("_BaseColor")) m.SetColor("_BaseColor", c);
                    if (m.HasProperty("_Color")) m.SetColor("_Color", c);
                    m.color = c;
                    if (m.HasProperty("_Desat")) m.SetFloat("_Desat", row.desat);
                    if (m.HasProperty("_Finish")) m.SetFloat("_Finish", row.finish);
                    if (row.finish > 0.001f)
                    {
                        if (m.HasProperty("_Metallic")) m.SetFloat("_Metallic", row.metal);
                        if (m.HasProperty("_Smoothness")) m.SetFloat("_Smoothness", row.smooth);
                    }
                    if (m.HasProperty("_RimPower")) m.SetFloat("_RimPower", row.rim > 0.5f ? row.rim : 4f);
                    if (m.HasProperty("_EdgeBoost")) m.SetFloat("_EdgeBoost", head ? 0f : row.edge);
                    if (m.HasProperty("_RimOnly")) m.SetFloat("_RimOnly", emit > 0.02f ? 1f : 0f);
                    if (m.HasProperty("_EmissionColor")) m.SetColor("_EmissionColor", glow);
                    if (m.HasProperty("_EmissiveColor")) m.SetColor("_EmissiveColor", glow);
                    if (emit > 0.02f) m.EnableKeyword("_EMISSION");
                    else m.DisableKeyword("_EMISSION");
                }
                r.materials = mats;
            }
        }

        public static void AttachArmor(GameObject piece, Item it, EquipSlot slot)
        {
            if (piece == null || Item.IsNone(it) || slot == EquipSlot.Head) return;
            var row = RarityBook.Row(it.rarity);
            if (row.vfx == 0) return;
            var glow = RarityBook.Glow(it.rarity, it.family);
            var root = piece.transform.root;
            if (Paired(slot))
            {
                Spawn(Bone(root, LeftOf(slot)) ?? piece.transform, glow, row, OnSurface(piece));
                Spawn(Bone(root, RightOf(slot)) ?? piece.transform, glow, row, OnSurface(piece));
            }
            else
                Spawn(Bone(root, CenterOf(slot)) ?? piece.transform, glow, row, OnSurface(piece));
        }

        public static void AttachWeapon(GameObject weapon, Item it)
        {
            if (weapon == null || Item.IsNone(it)) return;
            var row = RarityBook.Row(it.rarity);
            if (row.vfx == 0) return;
            Element element = it.Base != null ? it.Base.weaponElement : Element.Physical;
            var tint = RarityBook.TrailColor(RarityTable.TrailKind(element));
            if (it.rarity == Rarity.Set) tint = RarityBook.Glow(it.rarity, it.family);
            Spawn(weapon.transform, tint, row, MeshCenter(weapon));
        }

        /// <summary>Emission for rare and above. Legendary and set motes stay inside the piece bounds plus the pad.</summary>
        public static void AuditBody(Transform body, Rarity rarity)
        {
            if (body == null) return;
            var pieces = new System.Collections.Generic.List<Renderer>();
            foreach (var t in body.GetComponentsInChildren<Transform>(true))
            {
                if (t == null || !t.name.StartsWith("gear_")) continue;
                if (t.parent != null && t.parent.name.StartsWith("gear_")) continue;
                Debug.Log("Hollowmere rarity cover " + t.name + " " + rarity);
                bool headSlot = HeadPiece(t.name);
                if (headSlot)
                {
                    if (HasEmission(t.gameObject))
                        Debug.LogError("Hollowmere rarity FAIL face emission " + t.name + " " + rarity);
                }
                else if (RarityTable.NeedsEmission(rarity) && !HasEmission(t.gameObject))
                    Debug.LogError("Hollowmere rarity FAIL emission " + t.name + " " + rarity);
                foreach (var r in t.GetComponents<Renderer>())
                    if (r != null && !(r is ParticleSystemRenderer)) pieces.Add(r);
            }
            var row = RarityBook.Row(rarity);
            var head = Art.Bone(body, "Head");
            int motes = 0;
            foreach (var t in body.GetComponentsInChildren<Transform>(true))
            {
                if (t == null || t.name != Name) continue;
                motes++;
                var psr = t.GetComponent<ParticleSystemRenderer>();
                if (psr != null && !Within(pieces, psr, RarityBook.Pad))
                    Debug.LogError("Hollowmere rarity FAIL vfx bounds " + NearName(pieces, t.position) + " " + rarity);
                if (head != null && InFace(t, head.position))
                    Debug.LogError("Hollowmere rarity FAIL vfx face " + rarity);
            }
            if (row.vfx != 0 && motes == 0)
                Debug.LogError("Hollowmere rarity FAIL vfx missing " + rarity);
        }

        static Transform HeadOf(Transform host)
        {
            if (host == null) return null;
            var actor = host.GetComponentInParent<HeroActor>();
            return Art.Bone(actor != null ? actor.transform : host.root, "Head");
        }

        static bool HeadPiece(string name)
        {
            if (string.IsNullOrEmpty(name)) return false;
            return name == "gear_head" || name.EndsWith("_helm") || name.Contains("helm");
        }

        static bool InFace(Transform vfx, Vector3 head)
        {
            if (vfx == null) return false;
            if (Vector3.Distance(vfx.position, head) < RarityTable.FaceRadius) return true;
            var ps = vfx.GetComponent<ParticleSystem>();
            if (ps == null) return false;
            var parts = new ParticleSystem.Particle[16];
            int n = ps.GetParticles(parts);
            for (int i = 0; i < n; i++)
            {
                Vector3 world = ps.main.simulationSpace == ParticleSystemSimulationSpace.Local
                    ? vfx.TransformPoint(parts[i].position)
                    : parts[i].position;
                if (Vector3.Distance(world, head) < RarityTable.FaceRadius) return true;
            }
            return false;
        }

        /// <summary>Hollowmere/Lit keeps the imported maps and evaluates a view-dependent rim. URP Lit's emission is a flat fill.</summary>
        static void UseLit(Material m)
        {
            var shader = Shader.Find("Hollowmere/Lit");
            if (shader == null || m.shader == shader) return;
            var albedo = m.HasProperty("_BaseMap") ? m.GetTexture("_BaseMap") : m.mainTexture;
            var normal = m.HasProperty("_BumpMap") ? m.GetTexture("_BumpMap") : null;
            var metal = m.HasProperty("_MetallicGlossMap") ? m.GetTexture("_MetallicGlossMap") : null;
            float hasMap = albedo != null ? 1f : (m.HasProperty("_HasMap") ? m.GetFloat("_HasMap") : 0f);
            float hasNormal = normal != null ? 1f : (m.HasProperty("_HasNormal") ? m.GetFloat("_HasNormal") : 0f);
            float hasMetal = metal != null ? 1f : (m.HasProperty("_HasMetal") ? m.GetFloat("_HasMetal") : 0f);
            float gltf = m.HasProperty("_GltfPack") ? m.GetFloat("_GltfPack") : 0f;
            float cull = m.HasProperty("_Cull") ? m.GetFloat("_Cull") : 2f;
            float metallic = m.HasProperty("_Metallic") ? m.GetFloat("_Metallic") : 0f;
            float smooth = m.HasProperty("_Smoothness") ? m.GetFloat("_Smoothness") : 0.35f;
            var baseColor = m.HasProperty("_BaseColor") ? m.GetColor("_BaseColor") : m.color;
            m.shader = shader;
            if (m.HasProperty("_BaseColor")) m.SetColor("_BaseColor", baseColor);
            m.color = baseColor;
            if (m.HasProperty("_Metallic")) m.SetFloat("_Metallic", metallic);
            if (m.HasProperty("_Smoothness")) m.SetFloat("_Smoothness", smooth);
            if (m.HasProperty("_Cull")) m.SetFloat("_Cull", cull);
            if (albedo != null)
            {
                if (m.HasProperty("_BaseMap")) m.SetTexture("_BaseMap", albedo);
                m.mainTexture = albedo;
            }
            if (m.HasProperty("_HasMap")) m.SetFloat("_HasMap", hasMap);
            if (normal != null && m.HasProperty("_BumpMap"))
            {
                m.SetTexture("_BumpMap", normal);
                m.EnableKeyword("_NORMALMAP");
            }
            if (m.HasProperty("_HasNormal")) m.SetFloat("_HasNormal", hasNormal);
            if (metal != null && m.HasProperty("_MetallicGlossMap"))
            {
                m.SetTexture("_MetallicGlossMap", metal);
                m.EnableKeyword("_METALLICSPECGLOSSMAP");
            }
            if (m.HasProperty("_HasMetal")) m.SetFloat("_HasMetal", hasMetal);
            if (m.HasProperty("_GltfPack")) m.SetFloat("_GltfPack", gltf);
        }

        static void Spawn(Transform host, Color color, RarityLookProfile.RarityRow row, Vector3 local)
        {
            if (host == null) return;
            var head = HeadOf(host);
            if (head != null && Vector3.Distance(host.TransformPoint(local), head.position) < RarityTable.FaceRadius)
                return;
            var go = new GameObject(Name);
            go.transform.SetParent(host, false);
            go.transform.localPosition = local;
            go.transform.localRotation = Quaternion.identity;
            go.layer = host.gameObject.layer;
            var ps = go.AddComponent<ParticleSystem>();
            var main = ps.main;
            main.playOnAwake = false;
            main.loop = true;
            main.startLifetime = 0.16f;
            main.startSpeed = 0.02f;
            main.startSize = Mathf.Clamp(row.size, 0.02f, 0.05f);
            main.maxParticles = 8;
            main.simulationSpace = ParticleSystemSimulationSpace.Local;
            main.gravityModifier = 0f;
            main.startColor = color;
            var emission = ps.emission;
            emission.rateOverTime = Mathf.Clamp(row.rate <= 0f ? 8f : row.rate, 6f, 12f);
            var shape = ps.shape;
            shape.enabled = true;
            shape.shapeType = ParticleSystemShapeType.Sphere;
            shape.radius = 0.012f;
            var pr = ps.GetComponent<ParticleSystemRenderer>();
            pr.material = Art.Mat(color, 1.6f);
            pr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            pr.maxParticleSize = 0.06f;
            ps.Simulate(0.12f, true, true);
            ps.Play();
        }

        static Vector3 OnSurface(GameObject piece) => new Vector3(0.015f, 0.02f, 0.015f);

        static Vector3 MeshCenter(GameObject go)
        {
            var mf = go.GetComponentInChildren<MeshFilter>();
            if (mf != null && mf.sharedMesh != null) return mf.sharedMesh.bounds.center;
            var smr = go.GetComponentInChildren<SkinnedMeshRenderer>();
            if (smr != null && smr.sharedMesh != null) return smr.sharedMesh.bounds.center;
            return Vector3.zero;
        }

        static bool Paired(EquipSlot slot)
            => slot == EquipSlot.Shoulders || slot == EquipSlot.Wrists || slot == EquipSlot.Hands
               || slot == EquipSlot.Legs || slot == EquipSlot.Feet;

        static string LeftOf(EquipSlot slot)
        {
            switch (slot)
            {
                case EquipSlot.Shoulders: return "LeftArm";
                case EquipSlot.Wrists: return "LeftForeArm";
                case EquipSlot.Hands: return "LeftHand";
                case EquipSlot.Legs: return "LeftUpLeg";
                default: return "LeftFoot";
            }
        }

        static string RightOf(EquipSlot slot)
        {
            switch (slot)
            {
                case EquipSlot.Shoulders: return "RightArm";
                case EquipSlot.Wrists: return "RightForeArm";
                case EquipSlot.Hands: return "RightHand";
                case EquipSlot.Legs: return "RightUpLeg";
                default: return "RightFoot";
            }
        }

        static string CenterOf(EquipSlot slot)
        {
            switch (slot)
            {
                case EquipSlot.Chest: return "Spine2";
                case EquipSlot.Waist: return "Spine";
                default: return "Spine1";
            }
        }

        static Transform Bone(Transform root, string name) => root == null ? null : FindBone(root, name);

        static Transform FindBone(Transform root, string name)
        {
            if (root.name == name || root.name.EndsWith(":" + name)) return root;
            for (int i = 0; i < root.childCount; i++)
            {
                var hit = FindBone(root.GetChild(i), name);
                if (hit != null) return hit;
            }
            return null;
        }

        static bool HasEmission(GameObject piece)
        {
            float floor = RarityBook.EmitFloor;
            foreach (var r in piece.GetComponentsInChildren<Renderer>(true))
            {
                if (r is ParticleSystemRenderer) continue;
                var mats = r.sharedMaterials;
                for (int i = 0; i < mats.Length; i++)
                {
                    var m = mats[i];
                    if (m == null || !m.HasProperty("_EmissionColor")) continue;
                    var c = m.GetColor("_EmissionColor");
                    if (c.maxColorComponent >= floor) return true;
                }
            }
            return false;
        }

        static bool Within(System.Collections.Generic.List<Renderer> pieces, ParticleSystemRenderer vfx, float pad)
        {
            if (vfx == null || pieces == null || pieces.Count == 0) return false;
            Renderer near = null;
            float best = float.MaxValue;
            for (int i = 0; i < pieces.Count; i++)
            {
                float d = Vector3.Distance(pieces[i].bounds.ClosestPoint(vfx.transform.position), vfx.transform.position);
                if (d < best) { best = d; near = pieces[i]; }
            }
            if (near == null) return false;
            var box = near.bounds;
            box.Expand(pad * 2f);
            var ps = vfx.GetComponent<ParticleSystem>();
            var parts = new ParticleSystem.Particle[16];
            int n = ps != null ? ps.GetParticles(parts) : 0;
            if (n <= 0) return box.Contains(vfx.transform.position);
            for (int i = 0; i < n; i++)
            {
                Vector3 world = ps.main.simulationSpace == ParticleSystemSimulationSpace.Local
                    ? vfx.transform.TransformPoint(parts[i].position)
                    : parts[i].position;
                if (!box.Contains(world)) return false;
            }
            return true;
        }

        static string NearName(System.Collections.Generic.List<Renderer> pieces, Vector3 pos)
        {
            string name = "gear";
            float best = float.MaxValue;
            for (int i = 0; i < pieces.Count; i++)
            {
                float d = Vector3.Distance(pieces[i].bounds.ClosestPoint(pos), pos);
                if (d < best) { best = d; name = pieces[i].name; }
            }
            return name;
        }
    }

    /// <summary>Keeps the face sphere on the head bone after the pose moves.</summary>
    [DefaultExecutionOrder(600)]
    public sealed class FaceGuard : MonoBehaviour
    {
        void LateUpdate() => Push(transform);

        public static void Push(Transform body)
        {
            if (body == null) return;
            var head = Art.Bone(body, "Head");
            if (head == null)
            {
                Shader.SetGlobalFloat("_HmFaceRadius", 0f);
                return;
            }
            Shader.SetGlobalVector("_HmFaceCenter", head.position);
            Shader.SetGlobalFloat("_HmFaceRadius", RarityTable.FaceRadius);
        }
    }
}
