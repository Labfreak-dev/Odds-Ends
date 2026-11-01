using Hollowmere.Core;
using UnityEngine;

namespace Hollowmere
{
    /// <summary>
    /// Rarity finish and the persistent legendary/set motes. Particles stay on the
    /// piece, a few centimetres off the surface, and never on the head.
    /// </summary>
    public static class RarityVfx
    {
        public const string Name = "rarity_vfx";

        public static void Tint(GameObject go, Item it, string family, EquipSlot slot)
        {
            if (go == null || Item.IsNone(it)) return;
            var row = RarityBook.Row(it.rarity);
            float emit = row.emit;
            if (slot == EquipSlot.Head) emit *= 0.5f;
            var glow = RarityBook.Glow(it.rarity, family) * emit;
            var mul = new Color(row.r, row.g, row.b, 1f);
            foreach (var r in go.GetComponentsInChildren<Renderer>(true))
            {
                if (r is ParticleSystemRenderer) continue;
                var mats = r.materials;
                for (int i = 0; i < mats.Length; i++)
                {
                    var m = mats[i];
                    if (m == null) continue;
                    if (emit > 0.02f) UseRimShader(m);
                    if (m.HasProperty("_BaseColor"))
                    {
                        var c = m.GetColor("_BaseColor");
                        m.SetColor("_BaseColor", Lift(c, mul, row.blend));
                    }
                    else
                    {
                        m.color = Lift(m.color, mul, row.blend);
                    }
                    if (emit > 0.02f)
                    {
                        if (m.HasProperty("_EmissionColor")) m.SetColor("_EmissionColor", glow);
                        if (m.HasProperty("_EmissiveColor")) m.SetColor("_EmissiveColor", glow);
                        m.EnableKeyword("_EMISSION");
                    }
                    if (m.HasProperty("_Metallic")) m.SetFloat("_Metallic", row.metal);
                    if (m.HasProperty("_Smoothness")) m.SetFloat("_Smoothness", row.smooth);
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
                if (RarityTable.NeedsEmission(rarity) && !HasEmission(t.gameObject))
                    Debug.LogError("Hollowmere rarity FAIL emission " + t.name + " " + rarity);
                foreach (var r in t.GetComponents<Renderer>())
                    if (r != null && !(r is ParticleSystemRenderer)) pieces.Add(r);
            }
            var row = RarityBook.Row(rarity);
            int motes = 0;
            foreach (var t in body.GetComponentsInChildren<Transform>(true))
            {
                if (t == null || t.name != Name) continue;
                motes++;
                var psr = t.GetComponent<ParticleSystemRenderer>();
                if (psr != null && !Within(pieces, psr, RarityBook.Pad))
                    Debug.LogError("Hollowmere rarity FAIL vfx bounds " + NearName(pieces, t.position) + " " + rarity);
            }
            if (row.vfx != 0 && motes == 0)
                Debug.LogError("Hollowmere rarity FAIL vfx missing " + rarity);
        }

        static Color Lift(Color src, Color tint, float blend)
        {
            float luma = Mathf.Clamp01((src.r + src.g + src.b) / 3f);
            var shaped = tint * Mathf.Lerp(0.7f, 1.15f, luma);
            shaped.a = src.a;
            return Color.Lerp(src, shaped, blend);
        }

        static void UseRimShader(Material m)
        {
            var shader = Shader.Find("Hollowmere/Lit");
            if (shader == null || m.shader == shader) return;
            var albedo = m.HasProperty("_BaseMap") ? m.GetTexture("_BaseMap") : m.mainTexture;
            var normal = m.HasProperty("_BumpMap") ? m.GetTexture("_BumpMap") : null;
            m.shader = shader;
            if (albedo != null)
            {
                if (m.HasProperty("_BaseMap")) m.SetTexture("_BaseMap", albedo);
                m.mainTexture = albedo;
                if (m.HasProperty("_HasMap")) m.SetFloat("_HasMap", 1f);
            }
            if (normal != null && m.HasProperty("_BumpMap"))
            {
                m.SetTexture("_BumpMap", normal);
                if (m.HasProperty("_HasNormal")) m.SetFloat("_HasNormal", 1f);
                m.EnableKeyword("_NORMALMAP");
            }
        }

        static void Spawn(Transform host, Color color, RarityLookProfile.RarityRow row, Vector3 local)
        {
            if (host == null) return;
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
}
