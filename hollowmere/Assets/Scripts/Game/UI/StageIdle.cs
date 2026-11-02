using UnityEngine;

namespace Hollowmere
{
    /// <summary>
    /// Idle loop for preview stages (paper doll, creator). The bag/creator run with the game paused
    /// (timeScale 0), so the Animation component never advanced and the doll stood in its bind pose.
    /// Samples the idle clip on unscaled time.
    /// </summary>
    public sealed class StageIdle : MonoBehaviour
    {
        Animation anim; AnimationState idle;

        public static void Attach(GameObject model)
        {
            if (model == null) return;
            var a = model.GetComponentInChildren<Animation>(true);
            if (a == null) return;
            var s = a.gameObject.GetComponent<StageIdle>() ?? a.gameObject.AddComponent<StageIdle>();
            s.anim = a;
        }

        void LateUpdate()
        {
            if (anim == null) return;
            if (idle == null)
            {
                foreach (AnimationState st in anim)
                {
                    string n = st.name.ToLowerInvariant();
                    if (n.Contains("idle") && (idle == null || n.Length < idle.name.Length)) idle = st;
                }
                if (idle == null) return;
                anim.cullingType = AnimationCullingType.AlwaysAnimate;
            }
            foreach (AnimationState o in anim) { o.enabled = false; o.weight = 0f; }
            idle.enabled = true; idle.weight = 1f; idle.speed = 0f;
            idle.time = Mathf.Repeat(Time.unscaledTime, Mathf.Max(0.1f, idle.length));
            anim.Sample();
        }
    }
}
