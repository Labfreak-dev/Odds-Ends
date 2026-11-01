using Hollowmere.Core;
using UnityEngine;

namespace Hollowmere
{
    /// <summary>
    /// Helm, chest, and weapon on the class body. A v5 hero keeps the tint mask on the
    /// body and wears rigid pieces only: helm on Head, pauldrons on the arms, weapon
    /// and shield on the hands. The old skinned helm and chest were bound to another
    /// skeleton; remapping them onto the Meshy rig inflated the chest and, once the
    /// bounds pass scaled the holder to match, collapsed the body. Those meshes stay
    /// off on v5. Pre-v5 rigs still skin by bone name.
    /// Nothing in this path writes the hero bones' localScale.
    /// A weapon's origin is the grip. It is parented to the hand bone at world scale 1,
    /// with a per-weapon offset that seats that grip in the palm.
    /// </summary>
    public static class GearAttach
    {
        struct BoneScale
        {
            public Transform bone;
            public Vector3 scale;
        }

        public static void Apply(Transform body, Hero hero)
        {
            if (body == null || hero == null) return;
            var saved = SnapshotBones(body);
            try
            {
                bool v5 = V5Hero(body);
                if (HeroFit.SkinnedGear(v5)) StripClassHeld(body);
                Clear(body);
                var weapon = hero.Equipped(EquipSlot.MainHand);
                if (!Item.IsNone(weapon))
                    Weapon(body, DesignTable.WeaponKey(hero.PresentationClass, weapon.baseId), "gear_weapon", weapon, true);
                var off = hero.Equipped(EquipSlot.OffHand);
                if (!Item.IsNone(off))
                    Weapon(body, "drop_" + off.baseId, "gear_offhand", off, false);
                if (v5)
                    GearWardrobe.Apply(body, hero);
                else
                {
                    Armor(body, hero, EquipSlot.Head, "helm");
                    Armor(body, hero, EquipSlot.Chest, "chest");
                }
            }
            finally
            {
                RestoreBones(saved);
            }
            Art.LogHeroBounds(body.gameObject, Art.PlayMode());
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
            if (!HeroFit.SkinnedGear(V5Hero(body)))
            {
                RigidArmor(body, hero, part, it);
                return;
            }
            string key = DesignTable.ArmorKey(hero.PresentationClass, part, it.rarity);
            if (!Skin(body, key, "gear_" + part))
                Primitive(body, part, it);
        }

        /// <summary>The v5 holder is named hero or hero_plate. A rig node covers a clone passed in directly.</summary>
        static bool V5Hero(Transform body)
        {
            if (body == null) return false;
            if (Art.V5Body(body.name)) return true;
            return Art.Bone(body, "hero_rig") != null;
        }

        /// <summary>Helm on the head. Pauldrons are the king's meshes, steel, sized for this body. A missing mesh stays hidden.</summary>
        static void RigidArmor(Transform body, Hero hero, string part, Item it)
        {
            if (part == "helm")
            {
                var steel = new Color(0.62f, 0.66f, 0.72f);
                PinRigid(body, "Head", "gear_helm", true, new Vector3(0f, 0.11f, 0.02f), new Vector3(0.28f, 0.24f, 0.30f), Art.Mat(steel, 0.2f));
                return;
            }
            // Same mixamo arm pose as the ossuary king. Scale is fitted to the hero afterwards.
            PinPauldron(body, "LeftArm", "gear_pauldron_l", "hm_king_pauldron_left",
                new Vector3(-0.00007f, -0.00003f, 0.00017f),
                new Quaternion(0.312039f, -0.035651f, -0.92486f, 0.214464f));
            PinPauldron(body, "RightArm", "gear_pauldron_r", "hm_king_pauldron_right",
                new Vector3(0.00048f, 0.00014f, -0.00016f),
                new Quaternion(-0.285569f, -0.039112f, -0.926962f, -0.240129f));
        }

        /// <summary>Real pauldron mesh on the arm bone. World size about 26 cm. The bone's own scale is not written.</summary>
        static bool PinPauldron(Transform body, string bone, string name, string key, Vector3 localPos, Quaternion localRot)
        {
            var parent = Art.Bone(body, bone);
            if (parent == null) return false;
            var prefab = Art.LoadModel(key);
            if (prefab == null) return false;
            var go = Object.Instantiate(prefab, parent);
            go.name = name;
            go.transform.localRotation = localRot;
            go.transform.localPosition = localPos;
            var s = parent.lossyScale;
            go.transform.localScale = new Vector3(
                1f / Mathf.Max(0.0001f, Mathf.Abs(s.x)),
                1f / Mathf.Max(0.0001f, Mathf.Abs(s.y)),
                1f / Mathf.Max(0.0001f, Mathf.Abs(s.z)));
            if (Art.MeshWorldBounds(go.transform, out var b))
            {
                float max = Art.MaxAxis(b.size);
                if (max > 0.01f) go.transform.localScale *= 0.26f / max;
            }
            foreach (var c in go.GetComponentsInChildren<Collider>(true)) Object.Destroy(c);
            if (Art.IsIconCard(go))
            {
                Object.Destroy(go);
                return false;
            }
            Art.PaintSteel(go);
            return true;
        }

        static void PinRigid(Transform body, string bone, string name, bool sphere, Vector3 localPos, Vector3 worldSize, Material mat)
        {
            var parent = Art.Bone(body, bone) ?? body;
            var host = new GameObject(name).transform;
            host.SetParent(parent, false);
            host.localPosition = localPos;
            host.localRotation = Quaternion.identity;
            host.localScale = Vector3.one;
            var piece = sphere
                ? Art.Sphere(host, Vector3.zero, Vector3.one, mat)
                : Art.Cube(host, Vector3.zero, Vector3.one, mat);
            var s = host.lossyScale;
            piece.transform.localScale = new Vector3(
                worldSize.x / Mathf.Max(0.0001f, Mathf.Abs(s.x)),
                worldSize.y / Mathf.Max(0.0001f, Mathf.Abs(s.y)),
                worldSize.z / Mathf.Max(0.0001f, Mathf.Abs(s.z)));
        }

        /// <summary>Every transform already on the hero, including bones and the body mesh. Gear added later is not in this list.</summary>
        static System.Collections.Generic.List<BoneScale> SnapshotBones(Transform body)
        {
            var list = new System.Collections.Generic.List<BoneScale>();
            foreach (var t in body.GetComponentsInChildren<Transform>(true))
                list.Add(new BoneScale { bone = t, scale = t.localScale });
            return list;
        }

        static void RestoreBones(System.Collections.Generic.List<BoneScale> saved)
        {
            if (!HeroFit.PreserveBoneScale || saved == null) return;
            for (int i = 0; i < saved.Count; i++)
            {
                var row = saved[i];
                if (row.bone == null) continue;
                var now = row.bone.localScale;
                if ((now - row.scale).sqrMagnitude <= 1e-8f) continue;
                Debug.LogError("Hollowmere hero bone scale changed on " + row.bone.name
                    + " " + row.scale.ToString("0.###") + " -> " + now.ToString("0.###"));
                row.bone.localScale = row.scale;
            }
        }

        static void Weapon(Transform body, string key, string name, Item it, bool main)
        {
            var hand = HoldHand(body, it.baseId, main);
            if (hand == null || it == null) return;
            string model = GearTable.ModelFor(it.baseId);
            string type = GearTable.TypeOf(it.baseId);
            if (type == "quiver" && PlaceQuiver(body, "Gear/Weapons/" + model, name, model))
                return;
            if (type == "shield" && PlaceShield(body, "Gear/Weapons/" + model, name, model))
                return;
            if (GripResource(hand, "Gear/Weapons/" + model, it.baseId, name))
            {
                if (main) SeatOffHand(body, it);
                return;
            }
            string cc0 = Art.Cc0Gear(it.baseId);
            if (cc0 != null && Grip(hand, cc0, name, main)) return;
            if (Grip(hand, key, name, main)) return;
            Art.Weapon(hand, it.baseId, Art.Rarity(it.rarity));
        }

        static bool PlaceQuiver(Transform body, string resource, string name, string model)
        {
            var spine = Art.Bone(body, "Spine2") ?? Art.Bone(body, "Spine1") ?? Art.Bone(body, "Spine");
            if (spine == null) return false;
            var prefab = Resources.Load<GameObject>(resource);
            if (prefab == null) return false;
            var go = Object.Instantiate(prefab, spine);
            go.name = name;
            NameMesh(go, model);
            // +Y is the arrow direction, +Z the thin axis. Lay the tube on the upper back
            // and send the arrows up over the character's right shoulder.
            Vector3 back = -spine.forward;
            if (back.sqrMagnitude < 1e-6f) back = Vector3.back;
            back.Normalize();
            Vector3 right = spine.right.sqrMagnitude > 1e-6f ? -spine.right.normalized : Vector3.right;
            Vector3 arrows = (Vector3.up * 0.88f + right * 0.42f + back * 0.12f).normalized;
            go.transform.rotation = Quaternion.LookRotation(back, arrows);
            FitWorldScale(go.transform, spine);
            FitLongest(go.transform, 0.75f);
            Vector3 backSkin = spine.position + back * 0.14f;
            go.transform.position = backSkin + back * 0.09f + right * 0.05f + Vector3.down * 0.02f;
            foreach (var c in go.GetComponentsInChildren<Collider>(true)) Object.Destroy(c);
            Art.AdoptShaders(go);
            Reveal(go, spine.gameObject.layer);
            return true;
        }

        /// <summary>
        /// Shield on the outside of the left forearm, face outward, about 0.8 m tall.
        /// The pivot stays within 5 cm of the bone so the grip audit still passes.
        /// A mirrored arm flips the winding; both sides are drawn or the plate vanishes
        /// while its bounds still pass.
        /// </summary>
        static bool PlaceShield(Transform body, string resource, string name, string model)
        {
            var arm = Art.Bone(body, "LeftForeArm");
            if (arm == null) return false;
            var prefab = Resources.Load<GameObject>(resource);
            if (prefab == null) return false;
            var hand = Art.Bone(body, "LeftHand");
            var chest = Art.Bone(body, "Spine2") ?? Art.Bone(body, "Spine1") ?? Art.Bone(body, "Spine");
            var go = Object.Instantiate(prefab, arm);
            go.name = name;
            NameMesh(go, model);
            Vector3 along = hand != null ? hand.position - arm.position : arm.up;
            if (along.sqrMagnitude < 1e-6f) along = Vector3.down;
            along.Normalize();
            Vector3 outward = arm.position - (chest != null ? chest.position : arm.position);
            outward -= Vector3.Project(outward, along);
            if (outward.sqrMagnitude < 1e-4f) outward = Vector3.Cross(along, Vector3.up);
            outward.Normalize();
            go.transform.rotation = Quaternion.LookRotation(outward, along);
            go.transform.position = arm.position + outward * 0.035f + along * 0.02f;
            FitWorldScale(go.transform, arm);
            FitLongest(go.transform, 0.82f);
            if (arm.localToWorldMatrix.determinant < 0f)
            {
                var s = go.transform.localScale;
                s.x = -s.x;
                go.transform.localScale = s;
            }
            foreach (var c in go.GetComponentsInChildren<Collider>(true)) Object.Destroy(c);
            Art.AdoptShaders(go);
            Reveal(go, arm.gameObject.layer);
            return true;
        }

        /// <summary>Keep the imported mesh, and name the copy after the equipped model so the audit can match it.</summary>
        static void NameMesh(GameObject go, string model)
        {
            if (go == null || string.IsNullOrEmpty(model)) return;
            foreach (var mf in go.GetComponentsInChildren<MeshFilter>(true))
            {
                if (mf.sharedMesh == null || mf.sharedMesh.name == model) continue;
                var copy = Object.Instantiate(mf.sharedMesh);
                copy.name = model;
                mf.sharedMesh = copy;
            }
        }

        /// <summary>Opaque, both sides, on the body layer. A one-sided material on a mirrored bone draws nothing.</summary>
        static void Reveal(GameObject go, int layer)
        {
            if (go == null) return;
            foreach (var r in go.GetComponentsInChildren<Renderer>(true))
            {
                if (r == null) continue;
                r.gameObject.layer = layer;
                r.enabled = true;
                r.forceRenderingOff = false;
                r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.On;
                var mats = r.materials;
                for (int i = 0; i < mats.Length; i++)
                {
                    var m = mats[i];
                    if (m == null) continue;
                    if (m.HasProperty("_Cull")) m.SetFloat("_Cull", 0f);
                    m.doubleSidedGI = true;
                    if (m.HasProperty("_Surface")) m.SetFloat("_Surface", 0f);
                    if (m.HasProperty("_AlphaClip")) m.SetFloat("_AlphaClip", 0f);
                    m.DisableKeyword("_ALPHATEST_ON");
                    m.DisableKeyword("_SURFACE_TYPE_TRANSPARENT");
                    m.DisableKeyword("_ALPHAPREMULTIPLY_ON");
                    m.renderQueue = 2000;
                    if (m.HasProperty("_BaseColor"))
                    {
                        var c = m.GetColor("_BaseColor");
                        c.a = 1f;
                        m.SetColor("_BaseColor", c);
                    }
                    if (m.HasProperty("_Color"))
                    {
                        var c = m.color;
                        c.a = 1f;
                        m.color = c;
                    }
                }
                r.materials = mats;
            }
        }

        /// <summary>Scale so the longest world axis is exactly <paramref name="metres"/>.</summary>
        static void FitLongest(Transform go, float metres)
        {
            if (go == null || metres <= 0.01f) return;
            if (!Art.MeshWorldBounds(go, out var box)) return;
            float longest = Art.MaxAxis(box.size);
            if (longest < 0.001f) return;
            go.localScale *= metres / longest;
        }

        static bool GripResource(Transform hand, string resource, string baseId, string name)
        {
            var prefab = Resources.Load<GameObject>(resource);
            if (prefab == null) return false;
            var go = Object.Instantiate(prefab, hand);
            go.name = name;
            if (!GearTable.TrySocket(baseId, out var sock))
            {
                Object.Destroy(go);
                return false;
            }
            go.transform.localRotation = Quaternion.Euler(sock.Pitch, sock.Yaw, sock.Roll);
            string type = GearTable.TypeOf(baseId);
            float intoPalm = type == "mace" || type == "flail" ? -0.025f : 0f;
            // Metres, not bone-local. A parent scale turns a 3 cm palm offset into half a metre.
            go.transform.localPosition = MetresOn(hand, new Vector3(0f, sock.Palm, intoPalm));
            FitWorldScale(go.transform, hand);
            foreach (var c in go.GetComponentsInChildren<Collider>(true)) Object.Destroy(c);
            Art.AdoptShaders(go);
            PaintPlain(go, type == "fist" ? new Color(0.35f, 0.36f, 0.38f) : new Color(0.62f, 0.58f, 0.50f));
            return true;
        }

        /// <summary>A world-space offset written into the parent's local position, so bone scale cannot stretch it.</summary>
        static Vector3 MetresOn(Transform parent, Vector3 metres)
        {
            var s = parent != null ? parent.lossyScale : Vector3.one;
            return new Vector3(
                metres.x / Mathf.Max(0.0001f, Mathf.Abs(s.x)),
                metres.y / Mathf.Max(0.0001f, Mathf.Abs(s.y)),
                metres.z / Mathf.Max(0.0001f, Mathf.Abs(s.z)));
        }

        static void FitWorldScale(Transform go, Transform parent)
        {
            var s = parent.lossyScale;
            go.localScale = new Vector3(
                1f / Mathf.Max(0.0001f, Mathf.Abs(s.x)),
                1f / Mathf.Max(0.0001f, Mathf.Abs(s.y)),
                1f / Mathf.Max(0.0001f, Mathf.Abs(s.z)));
            if (!Art.MeshWorldBounds(go, out var box)) return;
            float max = Art.MaxAxis(box.size);
            if (max > 4f) go.localScale *= 2.2f / max;
        }

        static void PaintPlain(GameObject go, Color color)
        {
            foreach (var r in go.GetComponentsInChildren<Renderer>(true))
            {
                var mats = r.sharedMaterials;
                bool textured = false;
                for (int i = 0; i < mats.Length; i++)
                {
                    var m = mats[i];
                    if (m == null) continue;
                    if (m.mainTexture != null) textured = true;
                    if (m.HasProperty("_BaseMap") && m.GetTexture("_BaseMap") != null) textured = true;
                }
                if (textured) continue;
                var lit = Art.Mat(color, 0.08f);
                var next = new Material[mats.Length == 0 ? 1 : mats.Length];
                for (int i = 0; i < next.Length; i++) next[i] = lit;
                r.materials = next;
            }
        }

        static void SeatOffHand(Transform body, Item it)
        {
            if (it == null || it.Base == null || !it.Base.twoHanded) return;
            if (!GearTable.TrySocket(it.baseId, out var sock) || sock.OffHand < 0.05f) return;
            var weapon = Find(body, "gear_weapon");
            bool gripLeft = GearTable.TryRow(it.baseId, out var row) && row.Hand == "L";
            var upper = Art.Bone(body, gripLeft ? "RightArm" : "LeftArm");
            var lower = Art.Bone(body, gripLeft ? "RightForeArm" : "LeftForeArm");
            var hand = Art.Bone(body, gripLeft ? "RightHand" : "LeftHand");
            var holdUpper = Art.Bone(body, gripLeft ? "LeftArm" : "RightArm");
            var holdLower = Art.Bone(body, gripLeft ? "LeftForeArm" : "RightForeArm");
            var holdHand = Art.Bone(body, gripLeft ? "LeftHand" : "RightHand");
            if (weapon == null || upper == null || lower == null || hand == null) return;
            // A shield or orb already occupies the free hand. The quiver hangs on the back.
            var off = Find(body, "gear_offhand");
            if (off != null && (off.parent == hand || off.parent == lower)) return;
            var ik = weapon.gameObject.AddComponent<OffHandIk>();
            ik.upper = upper;
            ik.lower = lower;
            ik.hand = hand;
            ik.weapon = weapon;
            ik.holdUpper = holdUpper;
            ik.holdLower = holdLower;
            ik.holdHand = holdHand;
            ik.chest = Art.Bone(body, "Spine2") ?? Art.Bone(body, "Spine1") ?? Art.Bone(body, "Spine");
            ik.along = sock.OffHand;
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
            if (Art.IsIconCard(go))
            {
                Object.Destroy(go);
                return false;
            }
            Pose(key, main, out var pos, out var rot);
            go.transform.localRotation = rot;
            go.transform.localPosition = MetresOn(hand, pos);
            var s = hand.lossyScale;
            go.transform.localScale = new Vector3(
                1f / Mathf.Max(0.0001f, Mathf.Abs(s.x)),
                1f / Mathf.Max(0.0001f, Mathf.Abs(s.y)),
                1f / Mathf.Max(0.0001f, Mathf.Abs(s.z)));
            foreach (var c in go.GetComponentsInChildren<Collider>(true)) Object.Destroy(c);
            Art.AdoptShaders(go);
            if (key.StartsWith("cc0_")) Art.AuditCc0(go, key);
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
            bool shield = key == "drop_shield" || key == "cc0_shield";
            bool orb = key == "drop_orb";
            bool upright = key.StartsWith("cc0_") && !shield;
            rot = shield ? Quaternion.Euler(0f, 90f, 0f)
                : orb || upright ? Quaternion.identity
                : Quaternion.Euler(-90f, 0f, 0f);
            pos = new Vector3(0f, palm, 0f);
        }

        /// <summary>Distance from the prop origin to the hand that holds it. Every clip. Over 5 cm fails. Restores idle.</summary>
        public static void AuditGrip(Transform body)
        {
            if (body == null) return;
            string type = GripType(body);
            Transform prop = GripProp(body);
            Transform hand = HoldOf(prop);
            if (hand == null || prop == null)
            {
                Debug.LogError("Hollowmere grip " + type + " FAIL missing hand or weapon");
                return;
            }
            var anim = body.GetComponentInChildren<Animation>();
            if (anim == null)
            {
                Debug.Log("Hollowmere grip " + type + " no clips");
                PoseIdle(body);
                return;
            }
            foreach (AnimationState s in anim)
                SampleGrip(anim, s, hand, prop, type);
            PoseIdle(body);
            SettleOffHand(body, type);
            if (!IsHandBone(prop.parent))
            {
                Debug.Log("Hollowmere grip " + type + " bounds back");
                if (type == "quiver") AuditQuiver(body, prop);
                return;
            }
            if (!TryRendererGap(hand, prop, out float gap))
                Debug.Log("Hollowmere grip " + type + " bounds skipped");
            else if (gap > GearTable.GripLimit)
                Debug.LogError("Hollowmere grip " + type + " FAIL bounds " + (gap * 100f).ToString("0.0") + "cm");
            else
                Debug.Log("Hollowmere grip " + type + " bounds " + (gap * 100f).ToString("0.0") + "cm");
            if (type == "shield") AuditShield(body, prop);
        }

        /// <summary>Shield must be a real plate on the forearm, and the renderer that owns the bounds has to be drawing.</summary>
        static void AuditShield(Transform body, Transform prop)
        {
            if (prop == null) return;
            var arm = Art.Bone(body, "LeftForeArm");
            float dist = arm != null ? Vector3.Distance(prop.position, arm.position) : 99f;
            float height = 0f;
            bool drawn = false;
            foreach (var r in prop.GetComponentsInChildren<Renderer>(true))
            {
                if (r == null || !r.gameObject.activeInHierarchy) continue;
                if (!r.enabled || r.forceRenderingOff) continue;
                drawn = true;
                float axis = Art.MaxAxis(r.bounds.size);
                if (axis > height) height = axis;
            }
            var scale = prop.lossyScale;
            float big = Mathf.Max(Mathf.Abs(scale.x), Mathf.Max(Mathf.Abs(scale.y), Mathf.Abs(scale.z)));
            string line = "Hollowmere grip shield forearm " + (dist * 100f).ToString("0.0")
                + "cm height " + (height * 100f).ToString("0.0") + "cm"
                + (drawn ? " drawn" : " hidden");
            Debug.Log(line);
            if (!drawn || height < 0.5f || dist > 0.10f || big < 0.2f)
                Debug.LogError("Hollowmere grip shield FAIL " + line);
        }

        /// <summary>The quiver mesh has to be the equipped model, sitting on the back rather than spiked off it.</summary>
        static void AuditQuiver(Transform body, Transform prop)
        {
            if (prop == null) return;
            string model = EquippedModel(body, EquipSlot.OffHand);
            bool named = MeshNamed(prop, model);
            var spine = Art.Bone(body, "Spine2") ?? Art.Bone(body, "Spine1") ?? Art.Bone(body, "Spine");
            float gap = 99f;
            if (spine != null)
            {
                Vector3 back = -spine.forward;
                if (back.sqrMagnitude < 1e-6f) back = Vector3.back;
                Vector3 backSkin = spine.position + back.normalized * 0.14f;
                foreach (var r in prop.GetComponentsInChildren<Renderer>(true))
                {
                    if (r == null || !r.enabled || !r.gameObject.activeInHierarchy) continue;
                    float d = Vector3.Distance(r.bounds.ClosestPoint(backSkin), backSkin);
                    if (d < gap) gap = d;
                }
            }
            string mesh = named ? model : "mismatch";
            string line = "Hollowmere grip quiver mesh " + mesh + " back " + (gap * 100f).ToString("0.0") + "cm";
            Debug.Log(line);
            if (!named || gap > 0.05f)
                Debug.LogError("Hollowmere grip quiver FAIL " + line);
        }

        static string EquippedModel(Transform body, EquipSlot slot)
        {
            var actor = body != null ? body.GetComponentInParent<HeroActor>() : null;
            var hero = actor != null ? actor.Hero : null;
            var it = hero != null ? hero.Equipped(slot) : null;
            if (Item.IsNone(it)) return "";
            return GearTable.ModelFor(it.baseId);
        }

        static bool MeshNamed(Transform prop, string model)
        {
            if (prop == null || string.IsNullOrEmpty(model)) return false;
            foreach (var mf in prop.GetComponentsInChildren<MeshFilter>(true))
            {
                if (mf.sharedMesh != null && mf.sharedMesh.name == model) return true;
            }
            foreach (var r in prop.GetComponentsInChildren<SkinnedMeshRenderer>(true))
            {
                if (r.sharedMesh != null && r.sharedMesh.name == model) return true;
            }
            return false;
        }

        public static void AuditFramed(Transform body, Camera cam)
        {
            if (body == null || cam == null) return;
            string type = GripType(body);
            var prop = GripProp(body);
            if (prop == null)
            {
                Debug.LogError("Hollowmere grip " + type + " FAIL no renderer");
                return;
            }
            var planes = GeometryUtility.CalculateFrustumPlanes(cam);
            bool seen = false;
            bool enabled = false;
            foreach (var r in prop.GetComponentsInChildren<Renderer>(true))
            {
                if (r == null) continue;
                if (!r.enabled || !r.gameObject.activeInHierarchy) continue;
                enabled = true;
                if (GeometryUtility.TestPlanesAABB(planes, r.bounds)) seen = true;
            }
            if (!enabled) Debug.LogError("Hollowmere grip " + type + " FAIL renderer disabled");
            else if (!seen) Debug.LogError("Hollowmere grip " + type + " FAIL off-screen");
            else Debug.Log("Hollowmere grip " + type + " framed");
        }

        /// <summary>The drawn prop. A hidden weapon (the rod is up) is not a bounds target.</summary>
        static Transform GripProp(Transform body)
        {
            var weapon = Find(body, "gear_weapon");
            var rod = Find(body, "gear_rod");
            var off = Find(body, "gear_offhand");
            if (rod != null && RendererOn(rod) && (weapon == null || !RendererOn(weapon))) return rod;
            if (weapon != null && RendererOn(weapon)) return weapon;
            if (off != null && RendererOn(off)) return off;
            return rod != null ? rod : weapon != null ? weapon : off;
        }

        static bool RendererOn(Transform prop)
        {
            if (prop == null) return false;
            foreach (var r in prop.GetComponentsInChildren<Renderer>(true))
            {
                if (r != null && r.enabled && r.gameObject.activeInHierarchy) return true;
            }
            return false;
        }

        static Transform HoldOf(Transform prop)
        {
            if (prop == null) return null;
            if (IsHandBone(prop.parent)) return prop.parent;
            if (prop.name == "gear_offhand") return prop.parent;
            return prop.parent;
        }

        static bool IsHandBone(Transform bone)
        {
            if (bone == null) return false;
            string n = bone.name;
            return n.EndsWith("Hand") || n.EndsWith("ForeArm") || n == "hand";
        }

        /// <summary>Weapon type for the log. The rod wins while fishing has hidden the equipped weapon.</summary>
        static string GripType(Transform body)
        {
            var rod = Find(body, "gear_rod");
            var weapon = Find(body, "gear_weapon");
            if (rod != null && RendererOn(rod) && (weapon == null || !RendererOn(weapon))) return "rod";
            var actor = body != null ? body.GetComponentInParent<HeroActor>() : null;
            var hero = actor != null ? actor.Hero : null;
            if (hero != null)
            {
                bool offOnly = (weapon == null || !RendererOn(weapon)) && Find(body, "gear_offhand") != null;
                var it = hero.Equipped(offOnly ? EquipSlot.OffHand : EquipSlot.MainHand);
                if (Item.IsNone(it)) it = hero.Equipped(EquipSlot.OffHand);
                if (!Item.IsNone(it))
                {
                    string type = GearTable.TypeOf(it.baseId);
                    if (!string.IsNullOrEmpty(type)) return type;
                    if (!string.IsNullOrEmpty(it.baseId)) return it.baseId;
                }
            }
            return "weapon";
        }

        /// <summary>Closest point of an enabled renderer to the hand. False when there is nothing to measure, so a missing renderer is not reported as 99 m.</summary>
        static bool TryRendererGap(Transform hand, Transform prop, out float gap)
        {
            gap = 0f;
            if (hand == null || prop == null) return false;
            float best = float.MaxValue;
            bool any = false;
            foreach (var r in prop.GetComponentsInChildren<Renderer>(true))
            {
                if (r == null || !r.enabled || !r.gameObject.activeInHierarchy) continue;
                Bounds box = r.bounds;
                if (box.extents.sqrMagnitude > 25f || box.size.sqrMagnitude < 1e-8f)
                {
                    var mf = r.GetComponent<MeshFilter>();
                    var smr = r as SkinnedMeshRenderer;
                    Mesh mesh = mf != null ? mf.sharedMesh : smr != null ? smr.sharedMesh : null;
                    if (mesh == null) continue;
                    box = MeshBox(r.transform, mesh.bounds);
                }
                if (box.extents.sqrMagnitude > 25f) continue;
                any = true;
                float d = Vector3.Distance(box.ClosestPoint(hand.position), hand.position);
                if (d < best) best = d;
            }
            if (!any) return false;
            gap = best;
            return true;
        }

        static Bounds MeshBox(Transform t, Bounds local)
        {
            var c = local.center;
            var e = local.extents;
            bool first = true;
            Bounds box = new Bounds(t.position, Vector3.zero);
            for (int i = 0; i < 8; i++)
            {
                var p = t.TransformPoint(c + new Vector3((i & 1) == 0 ? -e.x : e.x, (i & 2) == 0 ? -e.y : e.y, (i & 4) == 0 ? -e.z : e.z));
                if (first) { box = new Bounds(p, Vector3.zero); first = false; }
                else box.Encapsulate(p);
            }
            return box;
        }

        static void SettleOffHand(Transform body, string type)
        {
            var prop = Find(body, "gear_weapon");
            var ik = prop != null ? prop.GetComponent<OffHandIk>() : null;
            if (ik == null) return;
            ik.Apply();
            float d = ik.HandGap();
            string cm = (d * 100f).ToString("0.0");
            Debug.Log("Hollowmere grip " + type + " offhand " + cm + "cm");
            if (d > GearTable.GripLimit)
                Debug.LogError("Hollowmere grip " + type + " offhand FAIL " + cm + "cm");
        }

        public static void PoseIdle(Transform body)
        {
            var anim = body != null ? body.GetComponentInChildren<Animation>() : null;
            if (anim == null) return;
            AnimationState idle = null;
            foreach (AnimationState s in anim)
            {
                if (s == null || s.clip == null) continue;
                string n = s.name.ToLowerInvariant();
                if (n == "idle" || n.EndsWith("|idle") || n.EndsWith("_idle")) { idle = s; break; }
            }
            if (idle == null) return;
            foreach (AnimationState s in anim)
            {
                s.weight = 0f;
                s.enabled = false;
            }
            idle.enabled = true;
            idle.weight = 1f;
            idle.time = 0.1f;
            anim.Sample();
            var ik = body.GetComponentInChildren<OffHandIk>();
            if (ik != null) ik.Apply();
        }

        static void SampleGrip(Animation anim, AnimationState st, Transform hand, Transform weapon, string type)
        {
            if (st == null || st.clip == null)
            {
                Debug.Log("Hollowmere grip " + type + " none no clip");
                return;
            }
            string key = st.name;
            if (!IsHandBone(weapon.parent))
            {
                Debug.Log("Hollowmere grip " + type + " " + key + " back");
                return;
            }
            float worst = 0f;
            float offWorst = 0f;
            bool two = false;
            float len = Mathf.Max(0.05f, st.length);
            var ik = weapon.GetComponent<OffHandIk>();
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
                // Sample does not run LateUpdate, so the off hand would stay on the hip.
                if (ik != null) ik.Apply();
                float d = Vector3.Distance(weapon.position, hand.position);
                if (d > worst) worst = d;
                if (ik != null)
                {
                    two = true;
                    float od = ik.HandGap();
                    if (od > offWorst) offWorst = od;
                }
            }
            string cm = (worst * 100f).ToString("0.0");
            Debug.Log("Hollowmere grip " + type + " " + key + " " + cm + "cm");
            if (worst > GearTable.GripLimit)
                Debug.LogError("Hollowmere grip " + type + " " + key + " FAIL " + cm + "cm");
            if (two)
            {
                string off = (offWorst * 100f).ToString("0.0");
                Debug.Log("Hollowmere grip " + type + " " + key + " offhand " + off + "cm");
                if (offWorst > GearTable.GripLimit)
                    Debug.LogError("Hollowmere grip " + type + " " + key + " offhand FAIL " + off + "cm");
            }
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

        static Transform HoldHand(Transform body, string baseId, bool main)
        {
            string hand = "R";
            if (GearTable.TryRow(baseId, out var row) && !string.IsNullOrEmpty(row.Hand)) hand = row.Hand;
            if (hand == "L") return Art.Bone(body, "LeftHand") ?? Art.Bone(body, "LeftForeArm");
            if (hand == "Back") return Art.Bone(body, "Spine2") ?? Art.Bone(body, "Spine1") ?? Art.Bone(body, "Spine");
            if (!main && hand == "R") return Hand(body);
            return main || hand == "R" ? Hand(body) : (Art.Bone(body, "LeftHand") ?? Art.Bone(body, "LeftForeArm"));
        }

        static bool IsGearDebris(string name)
        {
            if (string.IsNullOrEmpty(name)) return false;
            if (name.StartsWith("body_")) return false;
            if (name.StartsWith("gear_") || name == "weapon") return true;
            // A Meshy GLB parents its piece and a spare rig under the hero if a previous spawn leaked.
            return name.StartsWith("plate_") || name.StartsWith("leather_") || name.StartsWith("arcane_")
                || name.StartsWith("infernal_") || name.StartsWith("bone_");
        }

        static void Clear(Transform body)
        {
            var doomed = new System.Collections.Generic.List<GameObject>();
            foreach (var t in body.GetComponentsInChildren<Transform>(true))
                if (IsGearDebris(t.name)) doomed.Add(t.gameObject);
            for (int i = 0; i < doomed.Count; i++)
            {
                if (doomed[i] == null) continue;
                // End-of-frame Destroy left the previous shells up for the gearmix audit and the shot.
                Object.DestroyImmediate(doomed[i]);
            }
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

    /// <summary>
    /// Pulls the free hand onto a two-handed weapon. Runs in LateUpdate, after the
    /// Animator and the legacy Animation component. A clip sampled by hand has to
    /// call Apply, because Sample does not reach LateUpdate. Rotations only.
    /// </summary>
    [DefaultExecutionOrder(500)]
    public sealed class OffHandIk : MonoBehaviour
    {
        public Transform upper;
        public Transform lower;
        public Transform hand;
        public Transform weapon;
        public Transform holdUpper;
        public Transform holdLower;
        public Transform holdHand;
        public Transform chest;
        public float along = 0.28f;

        void LateUpdate() => Apply();

        public void Apply()
        {
            if (upper == null || lower == null || hand == null || weapon == null) return;
            if (!ShaftInReach())
                TwoBone(holdUpper, holdLower, holdHand, Guard());
            Vector3 goal = ShaftGoal();
            TwoBone(upper, lower, hand, goal);
            TwoBone(upper, lower, hand, goal);
        }

        /// <summary>Distance from the free hand to the nearest point on the haft.</summary>
        public float HandGap()
        {
            if (hand == null || weapon == null) return 0f;
            return Vector3.Distance(hand.position, Closest(HaftA(), HaftB(), hand.position));
        }

        bool ShaftInReach()
        {
            float reach = Reach(upper, lower, hand);
            Vector3 p = Closest(HaftA(), HaftB(), upper.position);
            return Vector3.Distance(p, upper.position) <= reach + 0.02f;
        }

        /// <summary>In front of the chest, where both arms can meet the shaft.</summary>
        Vector3 Guard()
        {
            Vector3 fwd = chest != null ? chest.forward : Vector3.forward;
            if (fwd.sqrMagnitude < 1e-6f) fwd = Vector3.forward;
            Vector3 mid = chest != null ? chest.position : weapon.position;
            return mid + fwd.normalized * 0.24f + Vector3.down * 0.16f;
        }

        Vector3 Up()
        {
            Vector3 u = weapon.TransformDirection(Vector3.up);
            return u.sqrMagnitude < 1e-8f ? Vector3.up : u.normalized;
        }

        Vector3 HaftA() => weapon.position - Up() * 0.08f;

        Vector3 HaftB() => weapon.position + Up() * Mathf.Max(0.2f, along);

        /// <summary>A point on the haft the free arm can reach, near the authored off-hand distance.</summary>
        Vector3 ShaftGoal()
        {
            Vector3 a = HaftA();
            Vector3 b = HaftB();
            float reach = Reach(upper, lower, hand);
            Vector3 best = a;
            float bestScore = float.MaxValue;
            for (int i = 0; i <= 16; i++)
            {
                Vector3 p = Vector3.Lerp(a, b, i / 16f);
                float fromShoulder = Vector3.Distance(p, upper.position);
                float score = fromShoulder > reach
                    ? 10f + fromShoulder
                    : Mathf.Abs(Vector3.Distance(p, weapon.position) - along);
                if (score < bestScore) { bestScore = score; best = p; }
            }
            return best;
        }

        static float Reach(Transform shoulder, Transform elbow, Transform palm)
        {
            if (shoulder == null || elbow == null || palm == null) return 0.4f;
            return Vector3.Distance(shoulder.position, elbow.position) + Vector3.Distance(elbow.position, palm.position) - 0.02f;
        }

        static Vector3 Closest(Vector3 a, Vector3 b, Vector3 p)
        {
            Vector3 ab = b - a;
            float denom = ab.sqrMagnitude;
            if (denom < 1e-8f) return a;
            float t = Mathf.Clamp01(Vector3.Dot(p - a, ab) / denom);
            return a + ab * t;
        }

        public static void TwoBone(Transform shoulder, Transform elbow, Transform palm, Vector3 target)
        {
            if (shoulder == null || elbow == null || palm == null) return;
            for (int pass = 0; pass < 2; pass++)
            {
                Vector3 a = shoulder.position;
                Vector3 b = elbow.position;
                Vector3 c = palm.position;
                float lab = Vector3.Distance(a, b);
                float lbc = Vector3.Distance(b, c);
                if (lab < 0.02f || lbc < 0.02f) return;
                Vector3 to = target - a;
                if (to.sqrMagnitude < 1e-6f) return;
                float reach = Mathf.Clamp(to.magnitude, 0.05f, lab + lbc - 0.02f);
                Vector3 bend = Vector3.Cross(to.normalized, Vector3.up);
                if (bend.sqrMagnitude < 1e-4f) bend = Vector3.Cross(to.normalized, Vector3.right);
                float cosA = Mathf.Clamp((lab * lab + reach * reach - lbc * lbc) / (2f * lab * reach), -1f, 1f);
                float ang = Mathf.Acos(cosA) * Mathf.Rad2Deg;
                Vector3 elbowDir = Quaternion.AngleAxis(-ang, bend.normalized) * to.normalized;
                shoulder.rotation = Quaternion.FromToRotation((b - a).normalized, elbowDir) * shoulder.rotation;
                Vector3 forearm = palm.position - elbow.position;
                Vector3 want = target - elbow.position;
                if (forearm.sqrMagnitude < 1e-6f || want.sqrMagnitude < 1e-6f) return;
                elbow.rotation = Quaternion.FromToRotation(forearm, want) * elbow.rotation;
            }
        }
    }
}
