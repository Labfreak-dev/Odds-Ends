using Hollowmere.Core;
using UnityEngine;

namespace Hollowmere
{
    /// <summary>
    /// Helm, chest, and weapon on the class body. Helms and chests are skinned to the
    /// hero's rig. The gear file's joint list is shorter than the hero's (helms 6 joints,
    /// chests 10–15) and is not in the same order, so bones[] is remapped by name and
    /// rootBone is Hips. The copied skeleton is then dropped. Chest overlays are pauldrons
    /// plus a tabard, cape, or front plate. The tabard primitives sit on the class hips
    /// (within 2 mm); they are not given an extra sideways offset.
    /// A weapon's origin is the grip. It is parented to RightHand with a zero local
    /// transform and world scale 1, then fitted along that axis to the grip length.
    /// </summary>
    public static class GearAttach
    {
        public static void Apply(Transform body, Hero hero)
        {
            if (body == null || hero == null) return;
            Clear(body);
            var weapon = hero.Equipped(EquipSlot.MainHand);
            if (!Item.IsNone(weapon))
                Weapon(body, DesignTable.WeaponKey(hero.heroClass, weapon.baseId), "gear_weapon", weapon);
            Armor(body, hero, EquipSlot.Head, "helm");
            Armor(body, hero, EquipSlot.Chest, "chest");
        }

        /// <summary>The fishing rod uses the same grip as a weapon and hides the equipped one.</summary>
        public static void Rod(Transform body, bool on)
        {
            if (body == null) return;
            RemoveNamed(body, "gear_rod");
            var worn = Find(body, "gear_weapon");
            if (worn != null)
                foreach (var r in worn.GetComponentsInChildren<Renderer>(true)) r.enabled = !on;
            if (!on) return;
            var hand = Hand(body);
            if (hand == null) return;
            Grip(hand, "fishing_rod", "gear_rod");
        }

        static void Armor(Transform body, Hero hero, EquipSlot slot, string part)
        {
            var it = hero.Equipped(slot);
            if (Item.IsNone(it)) return;
            string key = DesignTable.ArmorKey(hero.heroClass, part, it.rarity);
            if (!Skin(body, key, "gear_" + part))
                Primitive(body, part, it);
        }

        static void Weapon(Transform body, string key, string name, Item it)
        {
            var hand = Hand(body);
            if (hand != null && Grip(hand, key, name)) return;
            if (hand != null)
                Art.Weapon(hand, it.baseId, Art.Rarity(it.rarity));
        }

        /// <summary>Point the skinned overlay at the hero's bones and drop the copied armature.</summary>
        static bool Skin(Transform body, string key, string name)
        {
            var prefab = Art.LoadModel(key);
            if (prefab == null) return false;
            var inst = Object.Instantiate(prefab);
            var skins = inst.GetComponentsInChildren<SkinnedMeshRenderer>(true);
            if (skins.Length == 0) { Object.Destroy(inst); return false; }
            var hips = Find(body, "Hips");
            var arm = hips != null ? hips.parent : body;
            int missed = 0;
            foreach (var smr in skins)
            {
                var src = smr.bones;
                var mapped = new Transform[src.Length];
                for (int i = 0; i < src.Length; i++)
                {
                    if (src[i] == null) { missed++; continue; }
                    mapped[i] = Find(body, src[i].name);
                    if (mapped[i] == null) missed++;
                }
                smr.bones = mapped;
                smr.rootBone = hips != null ? hips : mapped.Length > 0 ? mapped[0] : null;
                smr.transform.SetParent(arm, false);
                smr.transform.localPosition = Vector3.zero;
                smr.transform.localRotation = Quaternion.identity;
                smr.transform.localScale = Vector3.one;
                smr.gameObject.name = name;
                smr.updateWhenOffscreen = true;
                Art.AdoptShaders(smr.gameObject);
            }
            Object.Destroy(inst);
            Debug.Log("Hollowmere gear " + key + " skinned by name root=Hips missed=" + missed);
            return true;
        }

        /// <summary>Grip at the hand origin, world scale 1, then the manifest length along local Z.</summary>
        static bool Grip(Transform hand, string key, string name)
        {
            var prefab = Art.LoadModel(key);
            if (prefab == null) return false;
            var go = Object.Instantiate(prefab, hand);
            go.name = name;
            go.transform.localPosition = Vector3.zero;
            go.transform.localRotation = Quaternion.identity;
            var s = hand.lossyScale;
            go.transform.localScale = new Vector3(
                1f / Mathf.Max(0.0001f, Mathf.Abs(s.x)),
                1f / Mathf.Max(0.0001f, Mathf.Abs(s.y)),
                1f / Mathf.Max(0.0001f, Mathf.Abs(s.z)));
            foreach (var c in go.GetComponentsInChildren<Collider>(true)) Object.Destroy(c);
            Art.AdoptShaders(go);
            if (DesignTable.TryGrip(key, out var grip))
            {
                float span = LengthZ(go.transform);
                float target = grip.LengthMm / 1000f;
                if (span > 0.02f && target > 0.02f)
                {
                    float k = target / span;
                    if (k < 0.97f || k > 1.03f)
                    {
                        go.transform.localScale *= k;
                        Debug.Log("Hollowmere weapon " + key + " length " + span.ToString("0.00")
                            + " fitted to " + target.ToString("0.00"));
                    }
                }
            }
            return true;
        }

        /// <summary>Extent along local Z, which is the grip axis (above + below the origin).</summary>
        static float LengthZ(Transform root)
        {
            float z0 = float.MaxValue, z1 = float.MinValue;
            bool any = false;
            foreach (var mf in root.GetComponentsInChildren<MeshFilter>(true))
            {
                var mesh = mf.sharedMesh;
                if (mesh == null) continue;
                var b = mesh.bounds;
                var c = b.center;
                var e = b.extents;
                for (int i = 0; i < 8; i++)
                {
                    var corner = c + new Vector3((i & 1) == 0 ? -e.x : e.x, (i & 2) == 0 ? -e.y : e.y, (i & 4) == 0 ? -e.z : e.z);
                    float z = root.InverseTransformPoint(mf.transform.TransformPoint(corner)).z;
                    if (z < z0) z0 = z;
                    if (z > z1) z1 = z;
                    any = true;
                }
            }
            return any ? z1 - z0 : 0f;
        }

        static void Primitive(Transform body, string part, Item it)
        {
            string bone = part == "helm" ? "Head" : "Spine2";
            var parent = Find(body, bone) ?? body;
            var host = new GameObject("gear_" + part).transform;
            host.SetParent(parent, false);
            var col = Color.Lerp(Art.Rarity(it.rarity), Color.white, 0.25f);
            var mat = Art.Mat(col, 0.8f);
            Vector3 world = part == "helm" ? new Vector3(0.42f, 0.38f, 0.42f) : new Vector3(0.62f, 0.5f, 0.32f);
            var piece = part == "helm"
                ? Art.Sphere(host, Vector3.zero, Vector3.one, mat)
                : Art.Cube(host, Vector3.zero, Vector3.one, mat);
            var s = host.lossyScale;
            piece.transform.localScale = new Vector3(
                world.x / Mathf.Max(0.0001f, Mathf.Abs(s.x)),
                world.y / Mathf.Max(0.0001f, Mathf.Abs(s.y)),
                world.z / Mathf.Max(0.0001f, Mathf.Abs(s.z)));
        }

        static Transform Hand(Transform body) => Find(body, "RightHand") ?? Find(body, "hand");

        static void Clear(Transform body)
        {
            var doomed = new System.Collections.Generic.List<GameObject>();
            foreach (var t in body.GetComponentsInChildren<Transform>(true))
                if (t.name.StartsWith("gear_") || t.name == "weapon") doomed.Add(t.gameObject);
            for (int i = 0; i < doomed.Count; i++) Object.Destroy(doomed[i]);
        }

        static void RemoveNamed(Transform body, string name)
        {
            var hit = Find(body, name);
            if (hit != null) Object.Destroy(hit.gameObject);
        }

        static Transform Find(Transform root, string name)
        {
            if (root.name == name) return root;
            for (int i = 0; i < root.childCount; i++)
            {
                var hit = Find(root.GetChild(i), name);
                if (hit != null) return hit;
            }
            return null;
        }
    }
}
