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
                    if (m.HasProperty("_BaseColor"))
                    {
                        var c = m.GetColor("_BaseColor");
                        var scaled = new Color(c.r * mul.r, c.g * mul.g, c.b * mul.b, c.a);
                        m.SetColor("_BaseColor", Color.Lerp(c, scaled, row.blend));
                    }
                    else
                    {
                        var c = m.color;
                        var scaled = new Color(c.r * mul.r, c.g * mul.g, c.b * mul.b, c.a);
                        m.color = Color.Lerp(c, scaled, row.blend);
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
            Vector3 lift = Outward(piece) * Mathf.Max(0.02f, row.lift);
            Spawn(piece.transform, glow, row, lift);
        }

        public static void AttachWeapon(GameObject weapon, Item it)
        {
            if (weapon == null || Item.IsNone(it)) return;
            var row = RarityBook.Row(it.rarity);
            if (row.vfx == 0) return;
            Element element = it.Base != null ? it.Base.weaponElement : Element.Physical;
            var tint = RarityBook.TrailColor(RarityTable.TrailKind(element));
            if (it.rarity == Rarity.Set) tint = RarityBook.Glow(it.rarity, it.family);
            // Along the blade, not the grip, so the motes stay off the hand and the face.
            Spawn(weapon.transform, tint, row, new Vector3(0f, 0.28f, 0.02f));
        }

        /// <summary>Emission for rare and above. Legendary and set motes stay inside the piece bounds plus the pad.</summary>
        public static void Audit(GameObject piece, Rarity rarity)
        {
            if (piece == null) return;
            if (RarityTable.NeedsEmission(rarity) && !HasEmission(piece))
                Debug.LogError("Hollowmere rarity FAIL emission " + piece.name + " " + rarity);
            var row = RarityBook.Row(rarity);
            var vfx = FindVfx(piece);
            if (row.vfx != 0 && piece.name != "gear_head")
            {
                if (vfx == null)
                {
                    Debug.LogError("Hollowmere rarity FAIL vfx missing " + piece.name + " " + rarity);
                    return;
                }
                if (!Within(piece, vfx, RarityBook.Pad))
                    Debug.LogError("Hollowmere rarity FAIL vfx bounds " + piece.name + " " + rarity);
            }
            else if (vfx != null && !Within(piece, vfx, RarityBook.Pad))
                Debug.LogError("Hollowmere rarity FAIL vfx bounds " + piece.name + " " + rarity);
        }

        static void Spawn(Transform host, Color color, RarityLookProfile.RarityRow row, Vector3 local)
        {
            var go = new GameObject(Name);
            go.transform.SetParent(host, false);
            go.transform.localPosition = local;
            go.layer = host.gameObject.layer;
            var ps = go.AddComponent<ParticleSystem>();
            var main = ps.main;
            main.playOnAwake = false;
            main.loop = true;
            main.startLifetime = 0.35f;
            main.startSpeed = 0.1f;
            main.startSize = Mathf.Max(0.02f, row.size);
            main.maxParticles = 12;
            main.simulationSpace = ParticleSystemSimulationSpace.Local;
            main.startColor = color;
            var emission = ps.emission;
            emission.rateOverTime = Mathf.Max(4f, row.rate);
            var shape = ps.shape;
            shape.shapeType = ParticleSystemShapeType.Sphere;
            shape.radius = 0.025f;
            var col = ps.colorOverLifetime;
            col.enabled = true;
            var grad = new Gradient();
            grad.SetKeys(
                new[] { new GradientColorKey(color, 0f), new GradientColorKey(color, 1f) },
                new[] { new GradientAlphaKey(0.7f, 0f), new GradientAlphaKey(0f, 1f) });
            col.color = grad;
            var pr = ps.GetComponent<ParticleSystemRenderer>();
            pr.material = Art.Mat(color, 1.2f);
            pr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            pr.maxParticleSize = 0.08f;
            ps.Simulate(0.2f, true, true);
            ps.Play();
        }

        static Vector3 Outward(GameObject piece)
        {
            var spine = piece.transform.root != null ? FindBone(piece.transform.root, "Spine2") : null;
            Vector3 from = spine != null ? piece.transform.position - spine.position : piece.transform.forward;
            from.y = 0f;
            if (from.sqrMagnitude < 1e-4f) from = Vector3.back;
            return from.normalized;
        }

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

        static ParticleSystemRenderer FindVfx(GameObject piece)
        {
            var marked = piece.transform.Find(Name);
            if (marked != null)
            {
                var pr = marked.GetComponent<ParticleSystemRenderer>();
                if (pr != null) return pr;
            }
            return piece.GetComponentInChildren<ParticleSystemRenderer>(true);
        }

        static bool Within(GameObject piece, ParticleSystemRenderer vfx, float pad)
        {
            bool any = false;
            Bounds box = new Bounds(piece.transform.position, Vector3.zero);
            foreach (var r in piece.GetComponentsInChildren<Renderer>(true))
            {
                if (r == null || r is ParticleSystemRenderer) continue;
                if (!any) { box = r.bounds; any = true; }
                else box.Encapsulate(r.bounds);
            }
            if (!any) return false;
            box.Expand(pad * 2f);
            var ps = vfx.GetComponent<ParticleSystem>();
            var parts = new ParticleSystem.Particle[24];
            int n = ps != null ? ps.GetParticles(parts) : 0;
            if (n <= 0)
                return box.Contains(vfx.transform.position);
            for (int i = 0; i < n; i++)
            {
                Vector3 world = ps.main.simulationSpace == ParticleSystemSimulationSpace.Local
                    ? vfx.transform.TransformPoint(parts[i].position)
                    : parts[i].position;
                if (!box.Contains(world)) return false;
            }
            return true;
        }
    }
}
