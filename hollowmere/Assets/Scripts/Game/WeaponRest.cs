using UnityEngine;

namespace Hollowmere
{
    /// <summary>
    /// Idle carry pose for the main-hand weapon. The idle clip holds the hand palm-in at the hip, so a seated weapon
    /// stuck out sideways or crossed the body. While idle is playing this turns the hand (the fist stays on the handle,
    /// the weapon is its child) so the blade hangs down and a little forward; polearms and staffs stand upright.
    /// Two-handers (OffHandIk) settle into a ready guard, blade up and forward, and the free hand is re-seated on the haft afterwards. Runs after OffHandIk. Limited to MaxTurn so the wrist never snaps.
    /// </summary>
    [DefaultExecutionOrder(20)]
    public sealed class WeaponRest : MonoBehaviour
    {
        public Transform hand, body;
        public Animation anim;
        public string type;
        const float MaxTurn = 120f;
        bool measured, ok;
        Vector3 localAxis;

        void LateUpdate() => Apply();

        public float IdleWeight()
        {
            if (anim == null) return 0f;
            float idle = 0f, all = 0f;
            foreach (AnimationState st in anim)
            {
                if (!st.enabled || st.weight <= 0f) continue;
                all += st.weight;
                if (st.name.ToLowerInvariant().Contains("idle")) idle += st.weight;
            }
            return all > 1e-4f ? idle / all : 0f;
        }

        public void Apply()
        {
            if (hand == null || body == null || type == "bow" || type == "crossbow" || type == "orb" || type == "fist") return;
            float w = IdleWeight();
            if (w < 0.01f) return;
            // Haft axis measured once in the weapon's local space (MeshAxes walks the mesh), blade end chosen as the far
            // side of the mesh from the grip.
            if (!measured)
            {
                measured = true;
                ok = HandGrip.MeshAxes(transform, type, out localAxis, out _, out var g);
                var rend = GetComponentInChildren<Renderer>();
                if (ok && rend != null && Vector3.Dot(transform.InverseTransformPoint(rend.bounds.center) - g, localAxis) < 0f) localAxis = -localAxis;
                Debug.Log("Hollowmere rest " + type + " measured=" + ok + " axis=" + localAxis.ToString("F2"));
            }
            if (!ok) return;
            var ik = GetComponent<OffHandIk>();
            var fwd = Vector3.ProjectOnPlane(body.forward, Vector3.up).normalized;
            bool upright = type == "spear" || type == "staff" || type == "polearm" || type == "halberd" || type == "rod";
            var want = ik != null ? (Vector3.up * 0.75f + fwd * 0.65f).normalized
                : upright ? (Vector3.up + fwd * 0.25f).normalized : (Vector3.down + fwd * 0.35f).normalized;
            for (int pass = 0; pass < (ik != null ? 2 : 1); pass++)
            {
                var axis = transform.TransformDirection(localAxis).normalized;
                var delta = Quaternion.FromToRotation(axis, want);
                delta.ToAngleAxis(out float ang, out var ax);
                if (ang > 180f) ang -= 360f;
                ang = Mathf.Clamp(ang, -MaxTurn, MaxTurn) * w;
                hand.rotation = Quaternion.AngleAxis(ang, ax) * hand.rotation;
                if (ik != null) ik.Apply();
            }
        }
    }
}
