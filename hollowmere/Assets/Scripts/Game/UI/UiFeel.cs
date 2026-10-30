using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Hollowmere
{
    /// <summary>Press-in and a short overshoot on release, so a menu button feels like it clicked.</summary>
    public sealed class UiPress : MonoBehaviour, IPointerDownHandler, IPointerUpHandler
    {
        public UiSfx sound = UiSfx.Click;
        public Sprite pressedSprite;
        Image img;
        Sprite normalSprite;
        Color baseColor;
        float scale = 1f, vel;
        bool down;

        void Awake()
        {
            img = GetComponent<Image>();
            if (img == null) return;
            normalSprite = img.sprite;
            baseColor = img.color;
        }

        public void Refresh()
        {
            if (img == null) img = GetComponent<Image>();
            if (img == null) return;
            normalSprite = img.sprite;
            baseColor = img.color;
        }

        public void OnPointerDown(PointerEventData e)
        {
            var b = GetComponent<Button>();
            if (b != null && !b.interactable) return;
            down = true;
            vel = -3.2f;
            AudioHub.PlayUi(sound);
            if (img != null && pressedSprite != null) img.sprite = pressedSprite;
        }

        public void OnPointerUp(PointerEventData e)
        {
            if (!down) return;
            down = false;
            vel = 2.4f;
            if (img != null) img.sprite = normalSprite;
        }

        void Update()
        {
            float dt = Time.unscaledDeltaTime;
            if (dt <= 0f) return;
            float target = down ? 0.92f : 1f;
            vel += (target - scale) * 86f * dt;
            vel *= Mathf.Exp(-13f * dt);
            scale = Mathf.Clamp(scale + vel * dt, 0.84f, 1.08f);
            transform.localScale = new Vector3(scale, scale, 1f);
            if (img != null && pressedSprite == null)
                img.color = Color.Lerp(baseColor, baseColor * 0.78f, down ? 1f : 0f);
        }
    }

    /// <summary>Fade and a short slide when a menu opens. Unscaled, so it runs while the game is paused.</summary>
    public sealed class UiMenuMotion : MonoBehaviour
    {
        RectTransform panel;
        Vector2 from, to;
        CanvasGroup group;
        float t;
        bool armed;

        public void Arm(RectTransform panel, Vector2 delta)
        {
            this.panel = panel;
            t = 0f;
            to = panel.anchoredPosition;
            from = to + delta;
            panel.anchoredPosition = from;
            group = gameObject.GetComponent<CanvasGroup>() ?? gameObject.AddComponent<CanvasGroup>();
            group.alpha = 0f;
            armed = true;
        }

        void Update()
        {
            if (!armed) return;
            t += Time.unscaledDeltaTime;
            float k = Mathf.Clamp01(t / 0.32f);
            float e = 1f - Mathf.Pow(1f - k, 3f);
            if (panel != null) panel.anchoredPosition = Vector2.LerpUnclamped(from, to, e);
            if (group != null) group.alpha = e;
            if (k >= 1f)
            {
                if (panel != null) panel.anchoredPosition = to;
                if (group != null) group.alpha = 1f;
                armed = false;
            }
        }
    }
}
