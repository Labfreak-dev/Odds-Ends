using System;
using UnityEngine;
using UnityEngine.Events;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Hollowmere
{
    /// <summary>uGUI built from code. Reference resolution 1920x1080 (landscape phone);
    /// everything anchors to screen edges so it scales to any aspect.</summary>
    public static class Ui
    {
        public static readonly Color Panel = new Color(0.08f, 0.07f, 0.06f, 0.94f);
        public static readonly Color PanelLight = new Color(0.16f, 0.14f, 0.12f, 0.96f);
        public static readonly Color Gold = new Color(0.86f, 0.7f, 0.35f);
        public static readonly Color ButtonC = new Color(0.27f, 0.22f, 0.17f, 1f);
        public static readonly Color ButtonHot = new Color(0.55f, 0.36f, 0.14f, 1f);
        public static readonly Color TextC = new Color(0.95f, 0.91f, 0.84f);
        public static readonly Color Dim = new Color(0, 0, 0, 0.6f);

        static Sprite round, circle;

        /// <summary>Rounded-rect sprite, 9-sliced, generated once.</summary>
        public static Sprite Round
        {
            get
            {
                if (round != null) return round;
                const int s = 32, r = 10;
                var tex = new Texture2D(s, s, TextureFormat.RGBA32, false) { filterMode = FilterMode.Bilinear, wrapMode = TextureWrapMode.Clamp };
                for (int y = 0; y < s; y++)
                    for (int x = 0; x < s; x++)
                    {
                        float dx = Mathf.Max(0, Mathf.Max(r - x, x - (s - 1 - r)));
                        float dy = Mathf.Max(0, Mathf.Max(r - y, y - (s - 1 - r)));
                        float d = Mathf.Sqrt(dx * dx + dy * dy);
                        tex.SetPixel(x, y, new Color(1, 1, 1, Mathf.Clamp01(r - d + 0.5f)));
                    }
                tex.Apply();
                round = Sprite.Create(tex, new Rect(0, 0, s, s), new Vector2(0.5f, 0.5f), 100, 0, SpriteMeshType.FullRect, new Vector4(r, r, r, r));
                return round;
            }
        }

        public static Sprite Circle
        {
            get
            {
                if (circle != null) return circle;
                const int s = 128;
                var tex = new Texture2D(s, s, TextureFormat.RGBA32, false) { filterMode = FilterMode.Bilinear, wrapMode = TextureWrapMode.Clamp };
                float c = (s - 1) / 2f;
                for (int y = 0; y < s; y++)
                    for (int x = 0; x < s; x++)
                    {
                        float d = Mathf.Sqrt((x - c) * (x - c) + (y - c) * (y - c));
                        tex.SetPixel(x, y, new Color(1, 1, 1, Mathf.Clamp01(c - d + 0.5f)));
                    }
                tex.Apply();
                circle = Sprite.Create(tex, new Rect(0, 0, s, s), new Vector2(0.5f, 0.5f));
                return circle;
            }
        }

        public static RectTransform Rect(Transform parent, string name, Vector2 aMin, Vector2 aMax, Vector2 offMin = default, Vector2 offMax = default)
        {
            var go = new GameObject(name, typeof(RectTransform));
            var rt = (RectTransform)go.transform;
            rt.SetParent(parent, false);
            rt.anchorMin = aMin; rt.anchorMax = aMax;
            rt.offsetMin = offMin; rt.offsetMax = offMax;
            return rt;
        }

        /// <summary>A rect at a fixed pixel size anchored to a point (pivot = anchor).</summary>
        public static RectTransform At(Transform parent, string name, Vector2 anchor, Vector2 pos, Vector2 size)
        {
            var rt = Rect(parent, name, anchor, anchor);
            rt.pivot = anchor;
            rt.sizeDelta = size;
            rt.anchoredPosition = pos;
            return rt;
        }

        public static Image Box(RectTransform rt, Color c, bool rounded = true)
        {
            var img = rt.gameObject.AddComponent<Image>();
            img.color = c;
            if (rounded) { img.sprite = Round; img.type = Image.Type.Sliced; }
            return img;
        }

        public static Image Fill(Transform parent, Color c, bool rounded = true)
        {
            var rt = Rect(parent, "bg", Vector2.zero, Vector2.one);
            return Box(rt, c, rounded);
        }

        public static Text Label(Transform parent, string text, int size = 30, TextAnchor align = TextAnchor.MiddleLeft, Color? color = null)
        {
            var rt = Rect(parent, "text", Vector2.zero, Vector2.one, new Vector2(8, 4), new Vector2(-8, -4));
            var t = rt.gameObject.AddComponent<Text>();
            t.font = Fx.UiFont();
            t.text = text;
            t.fontSize = size;
            t.alignment = align;
            t.color = color ?? TextC;
            t.supportRichText = true;
            t.horizontalOverflow = HorizontalWrapMode.Wrap;
            t.verticalOverflow = VerticalWrapMode.Truncate;
            t.raycastTarget = false;
            return t;
        }

        public static Button Button(Transform parent, string text, Action onClick, Color? color = null, int size = 30, UiSfx sound = UiSfx.Click, bool primary = false)
        {
            var go = new GameObject("button", typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var tint = color ?? (primary ? ButtonHot : ButtonC);
            var img = Box((RectTransform)go.transform, tint);
            var skin = UiArt.ButtonSprite(primary ? UiArt.ButtonKind.Primary : UiArt.ButtonKind.Normal);
            if (skin != null)
            {
                img.sprite = skin;
                img.type = Image.Type.Sliced;
                img.color = Color.white;
            }
            var b = go.AddComponent<Button>();
            b.targetGraphic = img;
            var cb = b.colors;
            cb.normalColor = cb.highlightedColor = cb.pressedColor = cb.selectedColor = Color.white;
            cb.disabledColor = new Color(0.55f, 0.55f, 0.55f, 0.75f);
            cb.fadeDuration = 0.04f;
            b.colors = cb;
            var press = go.AddComponent<UiPress>();
            press.sound = sound;
            press.pressedSprite = UiArt.ButtonSprite(UiArt.ButtonKind.Pressed);
            if (onClick != null) b.onClick.AddListener(() => onClick());
            Label(go.transform, text, size, TextAnchor.MiddleCenter);
            return b;
        }

        public static LayoutElement Size(Component c, float h = -1, float w = -1, float flexW = -1)
        {
            var le = c.gameObject.GetComponent<LayoutElement>() ?? c.gameObject.AddComponent<LayoutElement>();
            if (h >= 0) le.preferredHeight = le.minHeight = h;
            if (w >= 0) le.preferredWidth = le.minWidth = w;
            if (flexW >= 0) le.flexibleWidth = flexW;
            return le;
        }

        /// <summary>A vertical scrolling list. Returns the content rect to add rows to.</summary>
        public static RectTransform Scroll(RectTransform area, float spacing = 8)
        {
            var mask = area.gameObject.AddComponent<RectMask2D>();
            var sr = area.gameObject.AddComponent<ScrollRect>();
            var content = Rect(area, "content", new Vector2(0, 1), new Vector2(1, 1));
            content.pivot = new Vector2(0.5f, 1);
            var vl = content.gameObject.AddComponent<VerticalLayoutGroup>();
            vl.spacing = spacing; vl.childControlHeight = true; vl.childControlWidth = true; vl.childForceExpandHeight = false; vl.childForceExpandWidth = true;
            vl.padding = new RectOffset(6, 6, 6, 6);
            content.gameObject.AddComponent<ContentSizeFitter>().verticalFit = ContentSizeFitter.FitMode.PreferredSize;
            sr.content = content; sr.horizontal = false; sr.vertical = true; sr.movementType = ScrollRect.MovementType.Clamped;
            sr.scrollSensitivity = 30;
            return content;
        }

        public static RectTransform Grid(RectTransform area, Vector2 cell, float spacing = 8)
        {
            var content = Scroll(area, spacing);
            UnityEngine.Object.DestroyImmediate(content.GetComponent<VerticalLayoutGroup>());
            var g = content.gameObject.AddComponent<GridLayoutGroup>();
            g.cellSize = cell; g.spacing = new Vector2(spacing, spacing);
            g.padding = new RectOffset(6, 6, 6, 6);
            return content;
        }

        public static RectTransform Row(Transform parent, float height, float spacing = 8)
        {
            var rt = Rect(parent, "row", Vector2.zero, Vector2.one);
            var hl = rt.gameObject.AddComponent<HorizontalLayoutGroup>();
            hl.spacing = spacing; hl.childControlWidth = true; hl.childControlHeight = true; hl.childForceExpandWidth = true; hl.childForceExpandHeight = true;
            Size(rt, height);
            return rt;
        }

        /// <summary>Horizontal bar; returns the fill rect (set anchorMax.x to the fraction).</summary>
        public static RectTransform Bar(RectTransform area, Color back, Color fill, out Text label, int fontSize = 24)
        {
            Box(area, back);
            var f = Rect(area, "fill", Vector2.zero, Vector2.one, new Vector2(3, 3), new Vector2(-3, -3));
            Box(f, fill);
            label = Label(area, "", fontSize, TextAnchor.MiddleCenter);
            return f;
        }

        public static void SetBar(RectTransform fill, float frac)
        {
            var a = fill.anchorMax;
            a.x = Mathf.Clamp01(frac);
            fill.anchorMax = a;
            fill.gameObject.SetActive(frac > 0.001f);
        }

        public static void Clear(Transform t)
        {
            for (int i = t.childCount - 1; i >= 0; i--) UnityEngine.Object.Destroy(t.GetChild(i).gameObject);
        }
    }

    /// <summary>Virtual thumbstick: touch anywhere in its area, drag to move.</summary>
    public sealed class Joystick : MonoBehaviour, IPointerDownHandler, IDragHandler, IPointerUpHandler
    {
        public Vector2 Value;
        RectTransform area, ring, knob;
        const float Radius = 110f;

        public static Joystick Create(Transform parent)
        {
            var area = Ui.Rect(parent, "joystickArea", new Vector2(0, 0), new Vector2(0.4f, 0.6f));
            var img = area.gameObject.AddComponent<Image>();
            img.color = new Color(0, 0, 0, 0.001f);   // invisible but raycastable
            var j = area.gameObject.AddComponent<Joystick>();
            j.area = area;
            j.ring = Ui.At(area, "ring", Vector2.zero, new Vector2(80, 80), new Vector2(Radius * 2, Radius * 2));
            var ri = j.ring.gameObject.AddComponent<Image>(); ri.sprite = Ui.Circle; ri.color = new Color(1, 1, 1, 0.12f); ri.raycastTarget = false;
            j.knob = Ui.At(j.ring, "knob", new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(100, 100));
            j.knob.pivot = new Vector2(0.5f, 0.5f);
            var ki = j.knob.gameObject.AddComponent<Image>(); ki.sprite = Ui.Circle; ki.color = new Color(1, 1, 1, 0.35f); ki.raycastTarget = false;
            return j;
        }

        public void OnPointerDown(PointerEventData e)
        {
            RectTransformUtility.ScreenPointToLocalPointInRectangle(area, e.position, e.pressEventCamera, out var local);
            var rect = area.rect;
            ring.anchoredPosition = local - rect.min - new Vector2(Radius, Radius);
            OnDrag(e);
        }

        public void OnDrag(PointerEventData e)
        {
            RectTransformUtility.ScreenPointToLocalPointInRectangle(ring, e.position, e.pressEventCamera, out var local);
            var centre = ring.rect.center;
            var d = Vector2.ClampMagnitude(local - centre, Radius);
            knob.anchoredPosition = d;
            Value = d / Radius;
        }

        public void OnPointerUp(PointerEventData e)
        {
            Value = Vector2.zero;
            knob.anchoredPosition = Vector2.zero;
            ring.anchoredPosition = new Vector2(80, 80);
        }
    }

    /// <summary>A round button that reports press and release separately (hold-to-attack, hold-to-reel).</summary>
    public sealed class HoldButton : MonoBehaviour, IPointerDownHandler, IPointerUpHandler, IPointerExitHandler
    {
        public UnityEvent onDown = new UnityEvent(), onUp = new UnityEvent();
        public bool Held { get; private set; }
        public Text label;
        public RectTransform cooldown;
        public Image image;

        public static HoldButton Create(Transform parent, string name, Vector2 anchor, Vector2 pos, float size, Color c, string text, int fontSize = 26)
        {
            var rt = Ui.At(parent, name, anchor, pos, new Vector2(size, size));
            var img = rt.gameObject.AddComponent<Image>();
            img.sprite = Ui.Circle; img.color = c;
            var hb = rt.gameObject.AddComponent<HoldButton>();
            hb.image = img;
            var cd = Ui.Rect(rt, "cooldown", Vector2.zero, new Vector2(1, 0));
            var ci = cd.gameObject.AddComponent<Image>(); ci.color = new Color(0, 0, 0, 0.55f); ci.raycastTarget = false;
            hb.cooldown = cd;
            hb.label = Ui.Label(rt, text, fontSize, TextAnchor.MiddleCenter);
            return hb;
        }

        public void OnPointerDown(PointerEventData e) { Held = true; onDown.Invoke(); }
        public void OnPointerUp(PointerEventData e) { if (Held) { Held = false; onUp.Invoke(); } }
        public void OnPointerExit(PointerEventData e) { }

        public void SetCooldown(float frac)
        {
            var a = cooldown.anchorMax; a.y = Mathf.Clamp01(frac); cooldown.anchorMax = a;
        }
    }
}
