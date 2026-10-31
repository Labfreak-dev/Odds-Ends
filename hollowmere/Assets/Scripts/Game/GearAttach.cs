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
    /// A weapon's origin is the grip. It is parented to the hand bone at world scale 1,
    /// with a per-weapon offset that seats that grip in the palm.
    /// </summary>
    public static class GearAttach
    {
        public static void Apply(Transform body, Hero hero)
        {
            if (body == null || hero == null) return;
            StripClassHeld(body);
            Clear(body);
            var weapon = hero.Equipped(EquipSlot.MainHand);
            if (!Item.IsNone(weapon))
                Weapon(body, DesignTable.WeaponKey(hero.PresentationClass, weapon.baseId), "gear_weapon", weapon, true);
            var off = hero.Equipped(EquipSlot.OffHand);
            if (!Item.IsNone(off))
                Weapon(body, "drop_" + off.baseId, "gear_offhand", off, false);
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
            Grip(hand, "fishing_rod", "gear_rod", true);
        }

        static void Armor(Transform body, Hero hero, EquipSlot slot, string part)
        {
            var it = hero.Equipped(slot);
            if (Item.IsNone(it)) return;
            string key = DesignTable.ArmorKey(hero.PresentationClass, part, it.rarity);
            if (!Skin(body, key, "gear_" + part))
                Primitive(body, part, it);
        }

        static void Weapon(Transform body, string key, string name, Item it, bool main)
        {
            var hand = main ? Hand(body) : Art.Bone(body, "LeftHand");
            if (hand != null && Grip(hand, key, name, main)) return;
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
            var hips = Art.Bone(body, "Hips");
            var arm = hips != null ? hips.parent : body;
            int missed = 0;
            foreach (var smr in skins)
            {
                var src = smr.bones;
                var mapped = new Transform[src.Length];
                for (int i = 0; i < src.Length; i++)
                {
                    if (src[i] == null) { missed++; continue; }
                    mapped[i] = Art.Bone(body, src[i].name);
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

        /// <summary>Grip in the palm, world scale 1. The mesh haft is local +Z; the hand bone's +Y runs wrist to fingers.</summary>
        static bool Grip(Transform hand, string key, string name, bool main)
        {
            var prefab = Art.LoadModel(key);
            if (prefab == null) return false;
            var go = Object.Instantiate(prefab, hand);
            go.name = name;
            Pose(key, main, out var pos, out var rot);
            go.transform.localRotation = rot;
            go.transform.localPosition = pos;
            var s = hand.lossyScale;
            go.transform.localScale = new Vector3(
                1f / Mathf.Max(0.0001f, Mathf.Abs(s.x)),
                1f / Mathf.Max(0.0001f, Mathf.Abs(s.y)),
                1f / Mathf.Max(0.0001f, Mathf.Abs(s.z)));
            foreach (var c in go.GetComponentsInChildren<Collider>(true)) Object.Destroy(c);
            Art.AdoptShaders(go);
            return true;
        }

        /// <summary>Measured from each weapon's grip slice (vertices within 4 cm of z = 0 sit on the origin)
        /// and from the hand bone, whose palm is a few centimetres along +Y.</summary>
        static void Pose(string key, bool main, out Vector3 pos, out Quaternion rot)
        {
            float palm;
            switch (key)
            {
                case "ironclad_weapon_1": palm = 0.038f; break;
                case "ironclad_weapon_2": palm = 0.046f; break;
                case "ironclad_weapon_3": palm = 0.042f; break;
                case "stalker_weapon_1": palm = 0.030f; break;
                case "stalker_weapon_2": palm = 0.035f; break;
                case "stalker_weapon_3": palm = 0.025f; break;
                case "hexweaver_weapon_1": palm = 0.040f; break;
                case "hexweaver_weapon_2": palm = 0.020f; break;
                case "hexweaver_weapon_3": palm = 0.030f; break;
                case "fishing_rod": palm = 0.035f; break;
                case "drop_shield": palm = 0.030f; break;
                case "drop_orb": palm = 0.028f; break;
                case "drop_quiver": palm = 0.020f; break;
                default: palm = main ? 0.040f : 0.030f; break;
            }
            bool shield = key == "drop_shield";
            bool orb = key == "drop_orb";
            rot = shield ? Quaternion.Euler(90f, 0f, 0f)
                : orb ? Quaternion.identity
                : Quaternion.Euler(-90f, 0f, 0f);
            pos = new Vector3(0f, palm, 0f);
        }

        /// <summary>Distance from the weapon origin (the grip) to the palm bone. Logs idle, walk, and attack. Over 5 cm fails.</summary>
        public static void AuditGrip(Transform body)
        {
            if (body == null) return;
            var hand = Hand(body);
            var weapon = Find(body, "gear_weapon");
            if (hand == null || weapon == null)
            {
                Debug.LogError("Hollowmere grip missing hand or weapon");
                return;
            }
            var anim = body.GetComponentInChildren<Animation>();
            SampleGrip(anim, "idle", hand, weapon);
            SampleGrip(anim, "walk", hand, weapon);
            SampleGrip(anim, "attack", hand, weapon);
        }

        static void SampleGrip(Animation anim, string key, Transform hand, Transform weapon)
        {
            AnimationState st = null;
            if (anim != null)
            {
                foreach (AnimationState s in anim)
                {
                    string n = s.name.ToLowerInvariant();
                    if (n == key || n.EndsWith("|" + key) || n.Contains("|" + key + "|") || n.Contains(key))
                    {
                        st = s;
                        break;
                    }
                }
            }
            if (st == null || st.clip == null)
            {
                Debug.Log("Hollowmere grip " + key + " no clip");
                return;
            }
            float worst = 0f;
            float len = Mathf.Max(0.05f, st.length);
            for (int i = 0; i < 3; i++)
            {
                foreach (AnimationState s in anim)
                {
                    s.weight = 0f;
                    s.enabled = false;
                }
                st.enabled = true;
                st.weight = 1f;
                st.time = len * (i / 2f);
                anim.Sample();
                float d = Vector3.Distance(weapon.position, hand.position);
                if (d > worst) worst = d;
            }
            string cm = (worst * 100f).ToString("0.0");
            Debug.Log("Hollowmere grip " + key + " " + cm + "cm");
            if (worst > 0.05f)
                Debug.LogError("Hollowmere grip " + key + " FAIL " + cm + "cm");
        }

        /// <summary>Class meshes bake a staff, sword, or shield into the hands. Drop triangles whose
        /// vertices belong to a hand and sit more than 18 cm from that bone's bind point.</summary>
        static void StripClassHeld(Transform body)
        {
            foreach (var smr in body.GetComponentsInChildren<SkinnedMeshRenderer>(true))
            {
                var src = smr.sharedMesh;
                if (src == null || !src.isReadable || src.vertexCount == 0) continue;
                if (src.name.EndsWith("_held")) continue;
                var next = StripHeldMesh(smr, src);
                if (next == null) continue;
                next.name = src.name + "_held";
                smr.sharedMesh = next;
            }
        }

        static Mesh StripHeldMesh(SkinnedMeshRenderer smr, Mesh src)
        {
            var weights = src.boneWeights;
            var verts = src.vertices;
            var bind = src.bindposes;
            var bones = smr.bones;
            if (weights == null || weights.Length != verts.Length || bind == null || bones == null) return null;
            int left = -1, right = -1;
            for (int i = 0; i < bones.Length && i < bind.Length; i++)
            {
                if (bones[i] == null) continue;
                if (BoneName(bones[i].name, "LeftHand")) left = i;
                else if (BoneName(bones[i].name, "RightHand")) right = i;
            }
            if (left < 0 && right < 0) return null;
            Vector3 leftPalm = left >= 0 ? bind[left].inverse.MultiplyPoint3x4(Vector3.zero) : Vector3.zero;
            Vector3 rightPalm = right >= 0 ? bind[right].inverse.MultiplyPoint3x4(Vector3.zero) : Vector3.zero;
            var prop = new bool[verts.Length];
            int propCount = 0;
            for (int i = 0; i < verts.Length; i++)
            {
                var w = weights[i];
                int bone = Dominant(w);
                Vector3 palm;
                if (bone == left) palm = leftPalm;
                else if (bone == right) palm = rightPalm;
                else continue;
                if (Vector3.Distance(verts[i], palm) > 0.18f)
                {
                    prop[i] = true;
                    propCount++;
                }
            }
            if (propCount == 0) return null;
            var tris = src.triangles;
            var keep = new System.Collections.Generic.List<int>(tris.Length);
            int dropped = 0;
            for (int i = 0; i + 2 < tris.Length; i += 3)
            {
                int n = (prop[tris[i]] ? 1 : 0) + (prop[tris[i + 1]] ? 1 : 0) + (prop[tris[i + 2]] ? 1 : 0);
                if (n >= 2) { dropped++; continue; }
                keep.Add(tris[i]);
                keep.Add(tris[i + 1]);
                keep.Add(tris[i + 2]);
            }
            if (dropped == 0) return null;
            var dst = new Mesh { name = src.name };
            dst.vertices = verts;
            dst.normals = src.normals;
            dst.uv = src.uv;
            dst.boneWeights = weights;
            dst.bindposes = bind;
            dst.triangles = keep.ToArray();
            dst.RecalculateBounds();
            Debug.Log("Hollowmere strip class held tris=" + dropped + " verts=" + propCount);
            return dst;
        }

        static int Dominant(BoneWeight w)
        {
            float best = w.weight0;
            int bone = w.boneIndex0;
            if (w.weight1 > best) { best = w.weight1; bone = w.boneIndex1; }
            if (w.weight2 > best) { best = w.weight2; bone = w.boneIndex2; }
            if (w.weight3 > best) bone = w.boneIndex3;
            return bone;
        }

        static bool BoneName(string bone, string want)
        {
            if (string.IsNullOrEmpty(bone)) return false;
            return bone == want || bone.EndsWith(":" + want) || bone.EndsWith(want);
        }

        static void Primitive(Transform body, string part, Item it)
        {
            string bone = part == "helm" ? "Head" : "Spine2";
            var parent = Art.Bone(body, bone) ?? body;
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

        static Transform Hand(Transform body) => Art.Bone(body, "RightHand") ?? Art.Bone(body, "hand");

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
