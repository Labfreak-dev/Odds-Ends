using UnityEngine;

namespace Hollowmere
{
    /// <summary>
    /// Idle carry pose for the main-hand weapon. The idle clip holds the hand palm-in at the hip, so a seated weapon
    /// stuck out sideways or crossed the body. While idle is playing this turns the hand (the fist stays on the handle,
    /// the weapon is its child) so the blade hangs down and a little forward; polearms and staffs stand upright.
    /// Runs before OffHandIk so two-handers still pull the free hand on. Limited to MaxTurn so the wrist never snaps.
    /// </summary>
    [DefaultExecutionOrder(-20)]
    public sealed class WeaponRest : MonoBehaviour
    {
        public Transform hand, body;
        public Animation anim;
        public string type;
        const float MaxTurn = 80f;

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
            if (!HandGrip.Held(transform, type, out _, out var axis)) return;
            var fwd = Vector3.ProjectOnPlane(body.forward, Vector3.up).normalized;
            bool upright = type == "spear" || type == "staff" || type == "polearm" || type == "halberd" || type == "rod";
            var want = upright ? (Vector3.up + fwd * 0.25f).normalized : (Vector3.down + fwd * 0.35f).normalized;
            var delta = Quaternion.FromToRotation(axis, want);
            delta.ToAngleAxis(out float ang, out var ax);
            if (ang > 180f) ang -= 360f;
            ang = Mathf.Clamp(ang, -MaxTurn, MaxTurn) * w;
            hand.rotation = Quaternion.AngleAxis(ang, ax) * hand.rotation;
        }
    }
}
