using System.Collections.Generic;
using UnityEngine;

namespace Hollowmere.StyleTest.Fishing
{
    public enum FishPose { None, Cast, Hold, Bite, Reel, Show }

    /// <summary>Everything the hero needs to fish, model-agnostic: a rod on the hand socket (HeroSockets), a line ribbon,
    /// a bobber, and the fishing poses. Poses are procedural layers on top of a base clip: spine lean + analytic two-bone
    /// IK for both arms + hand orientation solved so the rod points where the key says. Keys live in character space and
    /// in units of the rig's own arm length, so any humanoid that resolves its arm bones gets the same motion.</summary>
    public class StFishRig : MonoBehaviour
    {
        public StActor actor; public Transform rod, tip, bobber; public float rodLen = 2.7f;
        public FishPose pose = FishPose.None; public float t; // normalised time in the current pose (loops use t mod 1)
        public Vector3 bobberPos; public float slack = 1f; public bool lineOn;
        public GameObject held; // caught item dangling from the line (Show pose)
        Transform chest, rU, rL, rH, lU, lL, lH; int rodSide = 1; // +1: rod arm is on the actor's right
        Mesh lineMesh; GameObject lineGo; bool hidWeapons;
        public bool live; // realtime: re-apply in LateUpdate after the Animation component

        static readonly string[] UpR = { "upperarm.r", "mixamorig:RightArm", "RightArm", "upperarm_r", "UpperArm.R", "UpperArm_R", "R_UpperArm", "Bip01 R UpperArm" };
        static readonly string[] LoR = { "lowerarm.r", "mixamorig:RightForeArm", "RightForeArm", "lowerarm_r", "LowerArm.R", "forearm_r", "R_Forearm", "Bip01 R Forearm" };
        static readonly string[] UpL = { "upperarm.l", "mixamorig:LeftArm", "LeftArm", "upperarm_l", "UpperArm.L", "UpperArm_L", "L_UpperArm", "Bip01 L UpperArm" };
        static readonly string[] LoL = { "lowerarm.l", "mixamorig:LeftForeArm", "LeftForeArm", "lowerarm_l", "LowerArm.L", "forearm_l", "L_Forearm", "Bip01 L Forearm" };

        static Transform Find(Transform root, Animator an, HumanBodyBones hb, string[] names)
        {
            if (an != null && an.isHuman) { var b = an.GetBoneTransform(hb); if (b) return b; }
            foreach (var n in names) { var f = StKit.Find(root, n.ToLowerInvariant()); if (f) return f; }
            return null;
        }

        /// <summary>Hand bone = the socket's bone (authored handslot -> its parent; created socket -> its parent).</summary>
        static Transform HandOf(Transform socket) => socket == null ? null : socket.name.StartsWith("socket_") ? socket.parent : socket.parent;

        public static StFishRig Equip(StActor a)
        {
            var r = a.GetComponent<StFishRig>() ?? a.gameObject.AddComponent<StFishRig>(); r.actor = a; r.rodLen = 2.7f * StFishDb.U; r.Setup(); return r;
        }

        void Setup()
        {
            var an = GetComponentInChildren<Animator>(); var root = transform;
            chest = Find(root, an, HumanBodyBones.Chest, new[] { "chest", "mixamorig:Spine2", "Chest", "Spine2", "spine_03", "UpperChest", "Spine1", "spine.003" });
            rU = Find(root, an, HumanBodyBones.RightUpperArm, UpR); rL = Find(root, an, HumanBodyBones.RightLowerArm, LoR); rH = HandOf(actor.sockets[Socket.HandR]);
            lU = Find(root, an, HumanBodyBones.LeftUpperArm, UpL); lL = Find(root, an, HumanBodyBones.LeftLowerArm, LoL); lH = HandOf(actor.sockets[Socket.HandL]);
            if (rU == null || rL == null || rH == null || lU == null || lL == null || lH == null) Debug.LogWarning("[ST] fish rig: unresolved arm bones on " + name);
            // the rod goes in whichever hand is on the actor's right (mirrored rigs still cast right-handed)
            rodSide = rU != null && Vector3.Dot(rU.position - transform.position, transform.right) < 0 ? -1 : 1;
            HideWeapons(true);
            if (rod == null) BuildRod();
            if (bobber == null) BuildBobber();
            if (lineGo == null)
            {
                lineMesh = new Mesh { name = "fish_line" }; lineMesh.MarkDynamic();
                lineGo = StFx.Obj("fish_line", lineMesh, false, null); lineGo.GetComponent<MeshRenderer>().sharedMaterial = StFx.Mat(false);
            }
        }

        public void HideWeapons(bool hide)
        {
            foreach (var w in new[] { actor.weaponR, actor.weaponL }) if (w) w.SetActive(!hide);
            hidWeapons = hide;
        }

        Transform RodHand => rodSide > 0 ? actor.sockets[Socket.HandR] : actor.sockets[Socket.HandL];

        void BuildRod()
        {
            var holder = new GameObject("fish_rod").transform; holder.SetParent(RodHand, false);
            holder.localPosition = Vector3.zero; holder.localRotation = Quaternion.identity;
            // undo the rig's scale so rod length is in world units
            var ls = holder.lossyScale.x; holder.localScale = Vector3.one / Mathf.Max(1e-4f, ls);
            var pf = Resources.Load<GameObject>("ST/Fish/q_rod");
            Transform model;
            if (pf != null)
            {
                var g = Instantiate(pf); g.name = "q_rod"; model = g.transform; StMat.ApplyGeneric(g, 0.55f);
                foreach (var rr in g.GetComponentsInChildren<Renderer>()) rr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.On;
                // normalise: long axis -> holder +Z, butt (model origin) at the hand, length rodLen
                model.SetParent(holder, false); model.localPosition = Vector3.zero; model.localRotation = Quaternion.identity; model.localScale = Vector3.one;
                var b = LocalBounds(model.gameObject, holder); int ax = b.size.x > b.size.y ? (b.size.x > b.size.z ? 0 : 2) : (b.size.y > b.size.z ? 1 : 2);
                var axis = ax == 0 ? Vector3.right : ax == 1 ? Vector3.up : Vector3.forward; if (Vector3.Dot(b.center, axis) < 0) axis = -axis;
                model.localRotation = Quaternion.FromToRotation(axis, Vector3.forward);
                b = LocalBounds(model.gameObject, holder); float len = b.size.z; model.localScale = Vector3.one * (rodLen / Mathf.Max(0.01f, len));
                b = LocalBounds(model.gameObject, holder); model.localPosition = new Vector3(-b.center.x, -b.center.y, -b.min.z);
            }
            else
            {
                // procedural fallback: tapered cylinder + reel
                var g = GameObject.CreatePrimitive(PrimitiveType.Cylinder); Destroy(g.GetComponent<Collider>()); model = g.transform; model.SetParent(holder, false);
                model.localRotation = Quaternion.Euler(90, 0, 0); model.localScale = new Vector3(0.05f, rodLen / 2, 0.05f); model.localPosition = new Vector3(0, 0, rodLen / 2);
                g.GetComponent<Renderer>().sharedMaterial = StMat.Make("rod_wood", null, new Color(0.45f, 0.3f, 0.18f), false);
                Debug.Log("[ST] fish rod: procedural fallback (ST/Fish/q_rod missing)");
            }
            // grip a little above the butt
            model.localPosition += new Vector3(0, 0, -rodLen * 0.1f);
            rod = holder;
            tip = new GameObject("rod_tip").transform; tip.SetParent(holder, false); tip.localPosition = new Vector3(0, 0, rodLen * 0.9f); tip.localScale = Vector3.one;
        }

        static Bounds LocalBounds(GameObject g, Transform space)
        {
            bool any = false; var b = new Bounds();
            foreach (var mf in g.GetComponentsInChildren<MeshFilter>())
            {
                if (!mf.sharedMesh) continue; var mb = mf.sharedMesh.bounds;
                for (int i = 0; i < 8; i++)
                {
                    var c = mb.center + Vector3.Scale(mb.extents, new Vector3((i & 1) == 0 ? -1 : 1, (i & 2) == 0 ? -1 : 1, (i & 4) == 0 ? -1 : 1));
                    var p = space.InverseTransformPoint(mf.transform.TransformPoint(c));
                    if (!any) { b = new Bounds(p, Vector3.zero); any = true; } else b.Encapsulate(p);
                }
            }
            return b;
        }

        void BuildBobber()
        {
            var root = new GameObject("fish_bobber").transform; bobber = root;
            var top = GameObject.CreatePrimitive(PrimitiveType.Sphere); Destroy(top.GetComponent<Collider>()); top.transform.SetParent(root, false);
            top.transform.localScale = new Vector3(0.3f, 0.2f, 0.3f); top.transform.localPosition = new Vector3(0, 0.07f, 0);
            top.GetComponent<Renderer>().sharedMaterial = StMat.Make("bobber_red", null, new Color(0.95f, 0.18f, 0.12f), false, 0, new Color(0.25f, 0.03f, 0.02f));
            var bot = GameObject.CreatePrimitive(PrimitiveType.Sphere); Destroy(bot.GetComponent<Collider>()); bot.transform.SetParent(root, false);
            bot.transform.localScale = new Vector3(0.28f, 0.2f, 0.28f); bot.transform.localPosition = new Vector3(0, -0.02f, 0);
            bot.GetComponent<Renderer>().sharedMaterial = StMat.Make("bobber_white", null, new Color(0.96f, 0.95f, 0.9f), false, 0, new Color(0.15f, 0.15f, 0.14f));
            var stick = GameObject.CreatePrimitive(PrimitiveType.Cylinder); Destroy(stick.GetComponent<Collider>()); stick.transform.SetParent(root, false);
            stick.transform.localScale = new Vector3(0.04f, 0.09f, 0.04f); stick.transform.localPosition = new Vector3(0, 0.22f, 0);
            stick.GetComponent<Renderer>().sharedMaterial = StMat.Make("bobber_stick", null, new Color(0.95f, 0.85f, 0.2f), false, 0, new Color(0.3f, 0.25f, 0.02f));
            root.localScale = Vector3.one * StFishDb.U; root.gameObject.SetActive(false);
        }

        public void Unequip()
        {
            if (rod) Destroy(rod.gameObject); if (bobber) Destroy(bobber.gameObject); if (lineGo) Destroy(lineGo); if (lineMesh) Destroy(lineMesh); if (held) Destroy(held);
            HideWeapons(false); Destroy(this);
        }

        void OnDestroy() { if (lineGo) Destroy(lineGo); if (bobber) Destroy(bobber.gameObject); }

        // ------------------------------------------------------------------ pose keys
        /// <summary>One key: rod-hand target relative to the rod-side shoulder (x = outward, y = up, z = forward; units of arm
        /// length), rod direction in character space, spine lean (deg, + = lean back) and twist (deg, + = turn rod side back).</summary>
        struct Key { public float t; public Vector3 hand, rodDir; public float lean, twist; public Key(float t, Vector3 h, Vector3 d, float lean, float twist = 0) { this.t = t; hand = h; rodDir = d; this.lean = lean; this.twist = twist; } }

        static readonly Key HoldK = new Key(0, new Vector3(-0.45f, -0.25f, 0.85f), new Vector3(0.05f, 0.55f, 1f), 0);
        static readonly Key[] CastKeys =
        {
            new Key(0.00f, HoldK.hand, HoldK.rodDir, 0),
            new Key(0.30f, new Vector3(0.05f, 0.85f, -0.05f), new Vector3(0.05f, 0.75f, -0.75f), 10, 12),
            new Key(0.42f, new Vector3(-0.05f, 0.9f, 0.3f), new Vector3(0.02f, 1f, 0.05f), 4, 6),
            new Key(0.55f, new Vector3(-0.3f, 0.2f, 0.95f), new Vector3(0f, 0.12f, 1f), -12, -12),
            new Key(0.72f, new Vector3(-0.4f, -0.1f, 0.9f), new Vector3(0.03f, 0.3f, 1f), -6, -5),
            new Key(1.00f, HoldK.hand, HoldK.rodDir, 0),
        };
        static readonly Key[] BiteKeys =
        {
            new Key(0.00f, HoldK.hand, HoldK.rodDir, 0),
            new Key(0.10f, new Vector3(-0.42f, -0.35f, 0.9f), new Vector3(0.05f, 0.25f, 1f), -6),   // tip dips as the fish takes it
            new Key(0.32f, new Vector3(-0.25f, 0.55f, 0.45f), new Vector3(0.02f, 1f, 0.12f), 16, 12), // yank
            new Key(0.52f, new Vector3(-0.3f, 0.45f, 0.55f), new Vector3(0.03f, 0.95f, 0.3f), 13, 8),
            new Key(1.00f, new Vector3(-0.4f, 0.1f, 0.75f), new Vector3(0.04f, 0.85f, 0.75f), 8, 4),  // into the fight stance
        };
        static readonly Key[] ShowKeys =
        {
            new Key(0.00f, new Vector3(-0.4f, 0.1f, 0.75f), new Vector3(0.04f, 0.85f, 0.75f), 8),
            new Key(0.35f, new Vector3(-0.2f, 0.75f, 0.35f), new Vector3(0.1f, 1f, 0.4f), 12, 6),
            new Key(1.00f, new Vector3(-0.25f, 0.65f, 0.45f), new Vector3(0.12f, 1f, 0.55f), 9, 4),
        };

        static float Smooth(float x) => x * x * (3 - 2 * x);

        static Key Sample(Key[] ks, float t)
        {
            t = Mathf.Clamp01(t);
            for (int i = 0; i < ks.Length - 1; i++)
                if (t <= ks[i + 1].t)
                {
                    float u = Smooth(Mathf.InverseLerp(ks[i].t, ks[i + 1].t, t)); var a = ks[i]; var b = ks[i + 1];
                    return new Key(t, Vector3.Lerp(a.hand, b.hand, u), Vector3.Slerp(a.rodDir.normalized, b.rodDir.normalized, u), Mathf.Lerp(a.lean, b.lean, u), Mathf.Lerp(a.twist, b.twist, u));
                }
            return ks[ks.Length - 1];
        }

        Key KeyFor(FishPose p, float t, out Vector3 reelOff)
        {
            reelOff = Vector3.zero; float w = Mathf.PI * 2;
            switch (p)
            {
                case FishPose.Cast: return Sample(CastKeys, t);
                case FishPose.Bite: return Sample(BiteKeys, t);
                case FishPose.Show: return Sample(ShowKeys, t);
                case FishPose.Reel:
                {
                    float s = Mathf.Sin(t * w); // one pump per loop; the crank turns twice
                    var k = new Key(t, new Vector3(-0.42f, -0.12f + 0.12f * s, 0.8f - 0.06f * s), new Vector3(0.04f, 0.6f + 0.22f * s, 1f), 8 + 4 * s, 4);
                    reelOff = new Vector3(Mathf.Cos(t * w * 2), Mathf.Sin(t * w * 2), 0); return k;
                }
                default:
                {
                    float s = Mathf.Sin(t * w); // idle-hold: breathe, tip bobs
                    return new Key(t, HoldK.hand + new Vector3(0, 0.03f * s, 0), HoldK.rodDir + new Vector3(0, 0.05f * s + 0.03f * Mathf.Sin(t * w * 3), 0), 1.5f * s);
                }
            }
        }

        // ------------------------------------------------------------------ solve
        public void Apply()
        {
            if (pose == FishPose.None || actor == null) return;
            var k = KeyFor(pose, pose == FishPose.Cast || pose == FishPose.Bite || pose == FishPose.Show ? t : Mathf.Repeat(t, 1f), out var reel);
            var tr = transform; Vector3 R = tr.right * rodSide, U = tr.up, F = tr.forward;
            // spine: lean back (+) about the actor's right axis, twist about up
            if (chest)
            {
                chest.rotation = Quaternion.AngleAxis(-k.lean, tr.right) * chest.rotation;
                chest.rotation = Quaternion.AngleAxis(k.twist * rodSide, U) * chest.rotation;
            }
            Transform up = rodSide > 0 ? rU : lU, lo = rodSide > 0 ? rL : lL, hand = rodSide > 0 ? rH : lH;
            Transform up2 = rodSide > 0 ? lU : rU, lo2 = rodSide > 0 ? lL : rL, hand2 = rodSide > 0 ? lH : rH;
            if (up && lo && hand)
            {
                float L = (lo.position - up.position).magnitude + (hand.position - lo.position).magnitude;
                var target = up.position + (R * k.hand.x + U * k.hand.y + F * k.hand.z) * L;
                TwoBone(up, lo, hand, target, up.position + R * L * 0.7f - U * L * 0.6f - F * L * 0.2f);
                // orient the hand so the rod's long axis (holder +Z) matches the key, reel (holder +X side) hanging down
                var want = (R * k.rodDir.x + U * k.rodDir.y + F * k.rodDir.z).normalized;
                if (rod)
                {
                    hand.rotation = Quaternion.FromToRotation(rod.forward, want) * hand.rotation;
                    var side = Vector3.ProjectOnPlane(-U, want); var cur = Vector3.ProjectOnPlane(rod.right, want);
                    if (side.sqrMagnitude > 1e-4f && cur.sqrMagnitude > 1e-4f) hand.rotation = Quaternion.AngleAxis(Vector3.SignedAngle(cur, side, want) + RollFix, want) * hand.rotation;
                }
            }
            // second hand: on the rod above the grip; cranks a circle at the reel while reeling
            if (up2 && lo2 && hand2 && rod)
            {
                float L2 = (lo2.position - up2.position).magnitude + (hand2.position - lo2.position).magnitude;
                Vector3 target2;
                if (pose == FishPose.Reel) target2 = rod.position + rod.forward * rodLen * 0.02f + (rod.right * reel.x + rod.up * reel.y) * 0.16f * StFishDb.U + (-R) * 0.12f * StFishDb.U;
                else target2 = rod.position + rod.forward * rodLen * 0.17f;
                // short chibi arms: if out of reach the solver stretches toward it (clamped) - the hand stays near the rod
                TwoBone(up2, lo2, hand2, target2, up2.position - R * L2 * 0.7f - U * L2 * 0.6f - F * L2 * 0.1f);
            }
            if (live) UpdateLine();
        }

        static float RollFix = EnvF("HM_REELROLL", 0f);
        static float EnvF(string k, float d) { var e = System.Environment.GetEnvironmentVariable(k); return string.IsNullOrEmpty(e) ? d : float.Parse(e, System.Globalization.CultureInfo.InvariantCulture); }

        /// <summary>Analytic two-bone IK in world space (rig-axis independent: only bone positions are used).</summary>
        static void TwoBone(Transform a, Transform b, Transform c, Vector3 target, Vector3 pole)
        {
            Vector3 pa = a.position, pb = b.position, pc = c.position;
            float l1 = (pb - pa).magnitude, l2 = (pc - pb).magnitude; if (l1 < 1e-4f || l2 < 1e-4f) return;
            var toT = target - pa; float d = Mathf.Clamp(toT.magnitude, Mathf.Abs(l1 - l2) + 1e-3f, (l1 + l2) * 0.999f); var dir = toT.normalized;
            float cosA = Mathf.Clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1), sinA = Mathf.Sqrt(1 - cosA * cosA);
            var bend = Vector3.ProjectOnPlane(pole - pa, dir); if (bend.sqrMagnitude < 1e-6f) bend = Vector3.ProjectOnPlane(Vector3.down, dir); bend.Normalize();
            var elbow = pa + dir * (l1 * cosA) + bend * (l1 * sinA);
            a.rotation = Quaternion.FromToRotation(pb - pa, elbow - pa) * a.rotation;
            var pc2 = c.position; var end = pa + dir * d;
            b.rotation = Quaternion.FromToRotation(pc2 - b.position, end - b.position) * b.rotation;
        }

        void LateUpdate() { if (live) Apply(); }

        // ------------------------------------------------------------------ line + bobber
        /// <summary>Camera-facing line ribbon from the rod tip to the bobber (or the held catch), sagging with slack.</summary>
        public void UpdateLine()
        {
            if (lineMesh == null || tip == null) return;
            lineGo.SetActive(lineOn);
            if (!lineOn) return;
            var cam = Camera.main ?? Object.FindFirstObjectByType<Camera>(); var a = tip.position; var b = bobberPos;
            const int N = 20; var v = new Vector3[(N + 1) * 2]; var col = new Color[v.Length]; var tri = new int[N * 6];
            float dist = (b - a).magnitude, sag = slack * dist * 0.18f, w = 0.035f * StFishDb.U;
            var lc = new Color(0.93f, 0.93f, 0.88f, 0.95f);
            for (int i = 0; i <= N; i++)
            {
                float u = i / (float)N; var p = Vector3.Lerp(a, b, u) - Vector3.up * sag * 4 * u * (1 - u);
                var p2 = Vector3.Lerp(a, b, Mathf.Min(1, u + 0.05f)) - Vector3.up * sag * 4 * Mathf.Min(1, u + 0.05f) * (1 - Mathf.Min(1, u + 0.05f));
                var tan = (i == N ? p - (Vector3.Lerp(a, b, u - 0.05f) - Vector3.up * sag * 4 * (u - 0.05f) * (1.05f - u)) : p2 - p).normalized;
                var side = cam ? Vector3.Cross(tan, cam.transform.forward).normalized * (w / 2) : Vector3.right * w / 2;
                v[i * 2] = p - side; v[i * 2 + 1] = p + side; col[i * 2] = col[i * 2 + 1] = lc;
                if (i < N) { int k = i * 6, q = i * 2; tri[k] = q; tri[k + 1] = q + 2; tri[k + 2] = q + 1; tri[k + 3] = q + 1; tri[k + 4] = q + 2; tri[k + 5] = q + 3; }
            }
            lineMesh.Clear(); lineMesh.vertices = v; lineMesh.colors = col; lineMesh.triangles = tri; lineMesh.RecalculateBounds();
        }

        /// <summary>Stills path: sample the base clip, layer the fishing pose, update line. Call after StActor.Pose.</summary>
        public static string BaseClip(FishPose p, StActor a)
        {
            if (a.anim.GetClip("Idle_A") != null) return "Idle_A";
            return a.idle;
        }

        public void PoseStill(FishPose p, float t01, float baseT = -1)
        {
            pose = p; t = t01; var clip = BaseClip(p, actor);
            // Throw is only used for body/legs weight shift; keep it roughly in phase with the cast keys
            float bt = baseT >= 0 ? baseT : p == FishPose.Cast ? Mathf.Clamp01(t01 * 0.9f) : Mathf.Repeat(t01 * 0.5f, 1f);
            actor.Pose(clip, bt); Apply(); UpdateLine();
        }
    }
}
