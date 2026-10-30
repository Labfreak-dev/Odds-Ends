using System.Collections.Generic;
using UnityEngine;

namespace Hollowmere
{
    /// <summary>
    /// Drop-in title art and UI audio. Put files here and they ship in the player build
    /// because this catalog, which lives in Resources, references them:
    ///   Assets/Art/UI/keyart_bg_*.png, logo.png, button_normal.png, button_pressed.png, button_primary.png
    ///   Assets/Audio/UI/title_theme.ogg, title_sting.ogg, ui_click.ogg, ui_click_2.ogg,
    ///   ui_confirm.ogg, ui_back.ogg, ui_panel_open.ogg, ui_panel_close.ogg, ui_start_game.ogg
    /// Missing files fall back to procedural art and synthesized UI sounds.
    /// The images in the repo are original and released under CC0.
    /// </summary>
    public sealed class UiDropIn : ScriptableObject
    {
        public Sprite logo;
        public Sprite[] keyart;
        public Sprite fog;
        public Sprite buttonNormal;
        public Sprite buttonPressed;
        public Sprite buttonPrimary;
        public AudioClip titleTheme;
        public AudioClip uiClick;
        public AudioClip uiConfirm;
        public AudioClip uiBack;
        public AudioClip titleSting;
        public AudioClip uiClick2;
        public AudioClip uiPanelOpen;
        public AudioClip uiPanelClose;
        public AudioClip uiStartGame;
    }

    public static class UiArt
    {
        public enum ButtonKind { Normal, Pressed, Primary }

        static UiDropIn cat;
        static bool tried;
        static Sprite soft, plate;

        public static UiDropIn Catalog
        {
            get
            {
                if (!tried)
                {
                    tried = true;
                    cat = Resources.Load<UiDropIn>("UiDropIn");
                }
                return cat;
            }
        }

        public static Sprite Logo => Catalog != null ? Catalog.logo : null;

        public static IList<Sprite> Layers
        {
            get
            {
                var list = Catalog != null ? Catalog.keyart : null;
                return list != null && list.Length > 0 ? list : null;
            }
        }

        public static Sprite Fog => Catalog != null ? Catalog.fog : null;

        public static Sprite ButtonSprite(ButtonKind kind)
        {
            var c = Catalog;
            if (c == null) return null;
            switch (kind)
            {
                case ButtonKind.Pressed: return c.buttonPressed != null ? c.buttonPressed : c.buttonNormal;
                case ButtonKind.Primary: return c.buttonPrimary != null ? c.buttonPrimary : c.buttonNormal;
                default: return c.buttonNormal;
            }
        }

        public static AudioClip Clip(string key)
        {
            var c = Catalog;
            if (c == null || string.IsNullOrEmpty(key)) return null;
            switch (key)
            {
                case "title_theme": return c.titleTheme;
                case "title_sting": return c.titleSting;
                case "ui_click": return c.uiClick;
                case "ui_click_2": return c.uiClick2;
                case "ui_confirm": return c.uiConfirm;
                case "ui_back": return c.uiBack;
                case "ui_panel_open": return c.uiPanelOpen;
                case "ui_panel_close": return c.uiPanelClose;
                case "ui_start_game": return c.uiStartGame;
                default: return null;
            }
        }

        /// <summary>Soft round sprite for fog, embers and torch glow.</summary>
        public static Sprite Soft()
        {
            if (soft != null) return soft;
            const int s = 64;
            var tex = new Texture2D(s, s, TextureFormat.RGBA32, false) { filterMode = FilterMode.Bilinear, wrapMode = TextureWrapMode.Clamp };
            float c = (s - 1) * 0.5f;
            for (int y = 0; y < s; y++)
                for (int x = 0; x < s; x++)
                {
                    float d = Mathf.Sqrt((x - c) * (x - c) + (y - c) * (y - c)) / c;
                    float a = Mathf.Clamp01(1f - d);
                    a = a * a;
                    tex.SetPixel(x, y, new Color(1f, 1f, 1f, a));
                }
            tex.Apply();
            soft = Sprite.Create(tex, new Rect(0, 0, s, s), new Vector2(0.5f, 0.5f), 100);
            return soft;
        }

        /// <summary>9-slice plate used when button_*.png is not in the drop-in folder.</summary>
        public static Sprite Plate(Color fill, Color rim)
        {
            if (plate != null) return plate;
            const int s = 64, b = 16;
            var tex = new Texture2D(s, s, TextureFormat.RGBA32, false) { filterMode = FilterMode.Bilinear, wrapMode = TextureWrapMode.Clamp };
            for (int y = 0; y < s; y++)
                for (int x = 0; x < s; x++)
                {
                    int edge = Mathf.Min(Mathf.Min(x, y), Mathf.Min(s - 1 - x, s - 1 - y));
                    float dx = Mathf.Max(0, Mathf.Max(b - x, x - (s - 1 - b)));
                    float dy = Mathf.Max(0, Mathf.Max(b - y, y - (s - 1 - b)));
                    float d = Mathf.Sqrt(dx * dx + dy * dy);
                    float corner = Mathf.Clamp01(b - d);
                    if (corner <= 0f) { tex.SetPixel(x, y, Color.clear); continue; }
                    Color col = edge < 3 ? rim : edge < 6 ? Color.Lerp(rim, fill, 0.45f) : fill;
                    col.a *= Mathf.Clamp01(corner);
                    tex.SetPixel(x, y, col);
                }
            tex.Apply();
            plate = Sprite.Create(tex, new Rect(0, 0, s, s), new Vector2(0.5f, 0.5f), 100, 0, SpriteMeshType.FullRect, new Vector4(b, b, b, b));
            return plate;
        }
    }
}
