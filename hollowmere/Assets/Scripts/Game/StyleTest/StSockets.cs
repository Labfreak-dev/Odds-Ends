using System;
using System.Collections.Generic;
using UnityEngine;

namespace Hollowmere.StyleTest
{
    /// <summary>Socket standard shared by every hero skin, whatever the model (KayKit chibi now, normal-proportion
    /// RuneScape-like humanoids later). A skin plugs in if its rig resolves these sockets.</summary>
    public enum Socket { HandR, HandL, Back, Hip, Quiver }

    /// <summary>How a rig family names its bones, plus socket frames. Resolution order per socket:
    /// 1) an explicit socket bone (e.g. KayKit handslot.r), 2) Unity Humanoid avatar bone, 3) name aliases
    /// (Mixamo, Quaternius/UAL, Synty, Blender .L/.R); a socket transform is then created under the found bone with the profile offset.</summary>
    [Serializable]
    public class RigProfile
    {
        public string name;
        public string[] handR, handL, chest, hips;
        public string socketHandR, socketHandL; // pre-authored socket bones, if the rig has them
        public float itemScale = 1f; // weapons are authored for KayKit hands; other rig families can rescale held items
        // socket offsets in units of body height (so any model size works), rotation in degrees
        public Vector3 handPos = Vector3.zero, handRot = Vector3.zero;
        public Vector3 backPos = new Vector3(0, 0.02f, -0.06f), backRot = new Vector3(0, 0, 0);
        public Vector3 hipPos = new Vector3(-0.07f, -0.02f, 0f), hipRot = new Vector3(0, 0, 180);
        public Vector3 quiverPos = new Vector3(0.04f, 0.05f, -0.06f), quiverRot = new Vector3(0, 0, -20);

        public static readonly RigProfile KayKit = new RigProfile
        {
            name = "KayKit Rig_Medium/Large",
            socketHandR = "handslot.r", socketHandL = "handslot.l",
            handR = new[] { "hand.r" }, handL = new[] { "hand.l" }, chest = new[] { "chest" }, hips = new[] { "hips" },
        };

        /// <summary>Generic humanoid fallback: Mixamo, Quaternius UAL/UBC, Synty, Blender-style names.</summary>
        public static readonly RigProfile Generic = new RigProfile
        {
            name = "Generic humanoid",
            handR = new[] { "mixamorig:RightHand", "RightHand", "Hand_R", "hand_r", "Hand.R", "hand.R", "R_Hand", "Bip01 R Hand", "hand_r_01" },
            handL = new[] { "mixamorig:LeftHand", "LeftHand", "Hand_L", "hand_l", "Hand.L", "hand.L", "L_Hand", "Bip01 L Hand", "hand_l_01" },
            chest = new[] { "mixamorig:Spine2", "Chest", "UpperChest", "Spine2", "spine_03", "chest", "Spine1", "spine.003" },
            hips = new[] { "mixamorig:Hips", "Hips", "hips", "pelvis", "Pelvis", "Root_Hips" },
            // a palm-centred grip: move from the wrist pivot into the fist (fraction of body height)
            handPos = new Vector3(0, -0.045f, 0.012f),
            itemScale = 0.7f,
            handRot = StWeapons_Env("HM_GENROT", new Vector3(0, 0, 180)) // UAL hand bone axes differ from KayKit handslot: flip so grips point the same way,
        };
        static Vector3 StWeapons_Env(string k, Vector3 d) { var v = System.Environment.GetEnvironmentVariable(k); if (string.IsNullOrEmpty(v)) return d; var p = v.Split(','); return new Vector3(float.Parse(p[0]), float.Parse(p[1]), float.Parse(p[2])); }

        public static RigProfile Detect(Transform root)
        {
            if (StKit.Find(root, "handslot.r") != null) return KayKit;
            return Generic;
        }
    }

    /// <summary>Resolved sockets on one spawned skin. Weapons/off-hands go here and nowhere else.</summary>
    public class HeroSockets : MonoBehaviour
    {
        public RigProfile profile;
        public float bodyHeight = 1.8f;
        readonly Dictionary<Socket, Transform> map = new Dictionary<Socket, Transform>();
        public readonly List<string> problems = new List<string>();

        public Transform this[Socket s] => map.TryGetValue(s, out var t) ? t : null;

        public static HeroSockets Resolve(GameObject skin, float bodyHeight, RigProfile forced = null)
        {
            var hs = skin.GetComponent<HeroSockets>() ?? skin.AddComponent<HeroSockets>();
            hs.profile = forced ?? RigProfile.Detect(skin.transform);
            hs.bodyHeight = bodyHeight;
            hs.map.Clear(); hs.problems.Clear();
            var anim = skin.GetComponentInChildren<Animator>();
            bool humanoid = anim != null && anim.isHuman;
            var p = hs.profile;
            hs.map[Socket.HandR] = hs.Make("socket_hand_R", p.socketHandR, humanoid ? anim.GetBoneTransform(HumanBodyBones.RightHand) : null, p.handR, p.handPos, p.handRot);
            hs.map[Socket.HandL] = hs.Make("socket_hand_L", p.socketHandL, humanoid ? anim.GetBoneTransform(HumanBodyBones.LeftHand) : null, p.handL, Vector3.Scale(p.handPos, new Vector3(-1, 1, 1)), p.handRot);
            var chestH = humanoid ? (anim.GetBoneTransform(HumanBodyBones.UpperChest) ?? anim.GetBoneTransform(HumanBodyBones.Chest)) : null;
            hs.map[Socket.Back] = hs.Make("socket_back", null, chestH, p.chest, p.backPos, p.backRot);
            hs.map[Socket.Quiver] = hs.Make("socket_quiver", null, chestH, p.chest, p.quiverPos, p.quiverRot);
            hs.map[Socket.Hip] = hs.Make("socket_hip", null, humanoid ? anim.GetBoneTransform(HumanBodyBones.Hips) : null, p.hips, p.hipPos, p.hipRot);
            if (hs.problems.Count > 0) Debug.LogWarning("[ST] sockets " + skin.name + ": " + string.Join("; ", hs.problems));
            return hs;
        }

        Transform Make(string name, string authored, Transform humanoidBone, string[] aliases, Vector3 posFrac, Vector3 rot)
        {
            if (!string.IsNullOrEmpty(authored))
            {
                var a = StKit.Find(transform, authored.ToLowerInvariant());
                if (a != null) return a;
            }
            var bone = humanoidBone;
            if (bone == null && aliases != null)
                foreach (var al in aliases) { bone = StKit.Find(transform, al.ToLowerInvariant()); if (bone != null) break; }
            if (bone == null) { problems.Add(name + " unresolved"); return null; }
            var s = new GameObject(name).transform;
            s.SetParent(bone, false);
            // offsets are fractions of body height in the root's frame, independent of bone scale
            var scale = bone.lossyScale.x > 1e-5f ? 1f / bone.lossyScale.x : 1f;
            s.localPosition = Quaternion.Inverse(bone.rotation) * (transform.rotation * (posFrac * bodyHeight * transform.lossyScale.x)) * scale;
            s.localRotation = Quaternion.Euler(rot);
            return s;
        }
    }

    /// <summary>One weapon/off-hand asset. Pivot = grip. holdRot/holdPos are the only per-item corrections and are
    /// shared by every skin (they live on the item, never on the outfit).</summary>
    public class WeaponDef
    {
        public string res; public Socket socket; public Vector3 holdRot; public Vector3 holdPos; public float scale = 1f;
        public string kind; // anim set key: 1h, 2h, bow, xbow, staff, wand, shield, tome

        static readonly Dictionary<string, WeaponDef> defs = new Dictionary<string, WeaponDef>();
        static WeaponDef D(string res, Socket s, string kind, Vector3 rot = default, Vector3 pos = default, float scale = 1f)
        {
            var d = new WeaponDef { res = res, socket = s, kind = kind, holdRot = rot, holdPos = pos, scale = scale };
            defs[res] = d; return d;
        }

        static WeaponDef()
        {
            D("Weapons/sword_1handed", Socket.HandR, "1h");
            D("Weapons/axe_1handed", Socket.HandR, "1h");
            D("Weapons/sword_2handed", Socket.HandR, "2h");
            D("Weapons/dagger", Socket.HandL, "dagger");
            D("Weapons/wand", Socket.HandR, "wand");
            D("Weapons/staff", Socket.HandR, "staff", default, default, EnvF("HM_STAFFSCALE", 0.88f));
            D("Weapons/crossbow_1handed", Socket.HandR, "xbow");
            // Bow: KayKit idle lowers the bow hand so the lower limb went through the floor -> tilt the bow so the limbs angle forward.
            D("Weapons/bow_withString", Socket.HandL, "bow", Env("HM_BOWROT", new Vector3(-45, 0, 0)), default, EnvF("HM_BOWSCALE", 0.75f));
            D("Weapons/bow", Socket.HandL, "bow", Env("HM_BOWROT", new Vector3(-45, 0, 0)), default, EnvF("HM_BOWSCALE", 0.75f));
            D("Weapons/shield_badge_color", Socket.HandL, "shield");
            D("Weapons/shield_round_color", Socket.HandL, "shield");
            // Open tome: was held upright like a shield; now open and near-horizontal, pages up toward the camera (reading pose). Picked by eye from 12 candidates (phase1/fix).
            D("Weapons/spellbook_open", Socket.HandL, "tome", Env("HM_TOMEROT", new Vector3(0, -90, 35)));
            D("Weapons/spellbook_closed", Socket.HandL, "tome");
            D("Weapons/quiver", Socket.Quiver, "quiver");
            D("Skel/Skeleton_Axe", Socket.HandR, "1h"); D("Skel/Skeleton_Blade", Socket.HandR, "1h");
            D("Skel/Skeleton_Staff", Socket.HandR, "staff"); D("Skel/Skeleton_Crossbow", Socket.HandR, "xbow");
            D("Skel/Skeleton_Shield_Large_A", Socket.HandL, "shield"); D("Skel/Skeleton_Shield_Small_A", Socket.HandL, "shield");
        }

        static float EnvF(string k, float def) { var e = Environment.GetEnvironmentVariable(k); return string.IsNullOrEmpty(e) ? def : float.Parse(e); }

        static Vector3 Env(string k, Vector3 def)
        {
            var e = Environment.GetEnvironmentVariable(k);
            if (string.IsNullOrEmpty(e)) return def;
            var p = e.Split(','); return new Vector3(float.Parse(p[0]), float.Parse(p[1]), float.Parse(p[2]));
        }

        public static WeaponDef Get(string res, Socket fallback)
        {
            if (defs.TryGetValue(res, out var d)) return d;
            return new WeaponDef { res = res, socket = fallback, kind = "misc" };
        }

        public GameObject Equip(HeroSockets hs, Socket? overrideSocket = null)
        {
            var s = hs[overrideSocket ?? socket];
            if (s == null) { Debug.LogError("[ST] socket missing for " + res); return null; }
            var p = Resources.Load<GameObject>("ST/" + res);
            if (p == null) { Debug.LogError("[ST] missing " + res); return null; }
            var g = UnityEngine.Object.Instantiate(p, s);
            g.name = res;
            g.transform.localPosition = holdPos; g.transform.localRotation = Quaternion.Euler(holdRot); g.transform.localScale = Vector3.one * scale * (hs.profile != null ? hs.profile.itemScale : 1f);
            return g;
        }
    }
}
