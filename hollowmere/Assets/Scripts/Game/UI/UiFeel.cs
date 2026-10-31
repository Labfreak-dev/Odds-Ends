using System;
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
        RectTransform label;
        Vector2 labelRest;
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
            Haptics.Light();
            if (img != null && pressedSprite != null) img.sprite = pressedSprite;
            ShiftLabel(true);
        }

        public void OnPointerUp(PointerEventData e)
        {
            if (!down) return;
            down = false;
            vel = 2.4f;
            if (img != null) img.sprite = normalSprite;
            ShiftLabel(false);
        }

        /// <summary>The pressed plate already drops the face 4 px, so the label follows it.
        /// The label is created after this component, so it is found on first use.</summary>
        void ShiftLabel(bool pressed)
        {
            if (label == null)
            {
                var text = GetComponentInChildren<Text>();
                if (text == null) return;
                label = text.rectTransform;
                labelRest = label.anchoredPosition;
            }
            label.anchoredPosition = labelRest + (pressed ? new Vector2(0f, -4f) : Vector2.zero);
        }

        void Update()
        {
            float dt = Time.unscaledDeltaTime;
            if (dt <= 0f) return;
            if (pressedSprite != null)
            {
                transform.localScale = Vector3.one;
                return;
            }
            float target = down ? UiFeelProfile.PressScale : 1f;
            vel += (target - scale) * 86f * dt;
            vel *= Mathf.Exp(-13f * dt);
            scale = Mathf.Clamp(scale + vel * dt, 0.84f, 1.08f);
            transform.localScale = new Vector3(scale, scale, 1f);
            if (img != null && pressedSprite == null)
            {
                float g = UiFeelProfile.Glow;
                img.color = Color.Lerp(baseColor, baseColor * g, down ? 1f : 0f);
            }
            var glow = transform.Find("glow");
            if (glow != null)
            {
                var gi = glow.GetComponent<Image>();
                if (gi != null)
                {
                    var gc = gi.color;
                    gc.a = down ? 0.55f : 0f;
                    gi.color = gc;
                }
            }
        }
    }

    /// <summary>Fade, slide, and (when asked) a scale pop when a menu opens. Close scales back down.
    /// Unscaled, so it runs while the game is paused. scaleFrom of 1 leaves the rect's scale alone.</summary>
    public sealed class UiMenuMotion : MonoBehaviour
    {
        RectTransform panel;
        Vector2 from, to;
        CanvasGroup group;
        float t, scaleFrom, outT, outScale;
        bool armed, doScale, playingOut;
        Action onOutro;

        public void Arm(RectTransform panel, Vector2 delta, float scaleFrom = 1f)
        {
            this.panel = panel;
            t = 0f;
            playingOut = false;
            to = panel.anchoredPosition;
            from = to + delta;
            panel.anchoredPosition = from;
            this.scaleFrom = scaleFrom;
            doScale = scaleFrom < 0.999f;
            if (doScale) panel.localScale = new Vector3(scaleFrom, scaleFrom, 1f);
            group = gameObject.GetComponent<CanvasGroup>() ?? gameObject.AddComponent<CanvasGroup>();
            group.alpha = 0f;
            group.blocksRaycasts = true;
            armed = true;
        }

        /// <summary>Scale down and fade, then invoke done. A second call is ignored so the callback runs once.</summary>
        public bool PlayOut(Action done)
        {
            if (playingOut) return true;
            playingOut = true;
            armed = false;
            onOutro = done;
            outT = 0f;
            outScale = panel != null ? panel.localScale.x : 1f;
            group = group != null ? group : GetComponent<CanvasGroup>();
            if (group != null) group.blocksRaycasts = false;
            return true;
        }

        void Update()
        {
            float dt = Time.unscaledDeltaTime;
            if (playingOut)
            {
                outT += dt;
                float k = Mathf.Clamp01(outT / 0.18f);
                float e = k * k;
                if (group != null) group.alpha = 1f - e;
                if (panel != null)
                {
                    float s = Mathf.Lerp(outScale, 0.9f, e);
                    panel.localScale = new Vector3(s, s, 1f);
                }
                if (k >= 1f)
                {
                    playingOut = false;
                    var cb = onOutro;
                    onOutro = null;
                    cb?.Invoke();
                }
                return;
            }
            if (!armed) return;
            t += dt;
            float open = Mathf.Clamp01(t / Mathf.Max(0.12f, UiFeelProfile.Fade));
            float ease = 1f - Mathf.Pow(1f - open, 3f);
            if (panel != null)
            {
                panel.anchoredPosition = Vector2.LerpUnclamped(from, to, ease);
                if (doScale)
                {
                    float s = Mathf.LerpUnclamped(scaleFrom, 1f, ease);
                    s *= 1f + 0.035f * Mathf.Sin(open * Mathf.PI);
                    panel.localScale = new Vector3(s, s, 1f);
                }
            }
            if (group != null) group.alpha = ease;
            if (open >= 1f)
            {
                if (panel != null)
                {
                    panel.anchoredPosition = to;
                    if (doScale) panel.localScale = Vector3.one;
                }
                if (group != null) group.alpha = 1f;
                armed = false;
            }
        }
    }
}
