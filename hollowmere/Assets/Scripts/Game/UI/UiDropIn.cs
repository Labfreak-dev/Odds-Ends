using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace Hollowmere
{
    /// <summary>
    /// Drop-in title art and UI audio. Put files here and they ship in the player build
    /// because this catalog, which lives in Resources, references them:
    ///   Assets/Art/UI/keyart_bg_*.png, logo.png, button_*.png
    ///   Assets/Art/UI/panel_bg.png, frame_gold.png, icon_bag.png, icon_skills.png, icon_pet.png, icon_menu.png
    ///   Assets/Art/UI/ui_slices.json — 9-slice borders [left, bottom, right, top] per file name
    ///   Assets/Audio/UI/title_theme.ogg, title_sting.ogg, ui_click.ogg, ui_click_2.ogg,
    ///   ui_confirm.ogg, ui_back.ogg, ui_panel_open.ogg, ui_panel_close.ogg, ui_start_game.ogg
    ///   Assets/Audio/SFX/hexbolt_cast.ogg, hexbolt_impact.ogg, hexbolt_impact_2.ogg
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
        public Sprite buttonDisabled;
        public Font labelFont;
        public AudioClip titleTheme;
        public AudioClip uiClick;
        public AudioClip uiConfirm;
        public AudioClip uiBack;
        public AudioClip titleSting;
        public AudioClip uiClick2;
        public AudioClip uiPanelOpen;
        public AudioClip uiPanelClose;
        public AudioClip uiStartGame;
        public Sprite panel;
        public Sprite frame;
        public Sprite iconBag;
        public Sprite iconSkills;
        public Sprite iconPet;
        public Sprite iconMenu;
        public Sprite panelHeader;
        public Sprite closeButton;
        public Sprite iconButton;
        public Sprite iconButtonPressed;
        public Sprite hudFrame;
        public Sprite hudFillHealth;
        public Sprite hudFillMana;
        public Sprite hudFillXp;
        public Sprite hudFillGhost;
        public Sprite iconInventory;
        public Sprite iconSword;
        public Sprite iconShield;
        public Sprite iconSettings;
        public Sprite iconGem;
        public AudioClip hexboltCast;
        public AudioClip hexboltImpact;
        public AudioClip hexboltImpact2;
    }

    public static class UiArt
    {
        public enum ButtonKind { Normal, Pressed, Primary, Disabled }

        static UiDropIn cat;
        static bool tried;
        static Sprite soft, plate, panelProc, frameProc;
        static readonly Dictionary<string, Sprite> iconProc = new Dictionary<string, Sprite>();

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

        public static Font LabelFont => Catalog != null ? Catalog.labelFont : null;

        public static Sprite ButtonSprite(ButtonKind kind)
        {
            var c = Catalog;
            if (c == null) return null;
            switch (kind)
            {
                case ButtonKind.Pressed: return c.buttonPressed != null ? c.buttonPressed : c.buttonNormal;
                case ButtonKind.Primary: return c.buttonPrimary != null ? c.buttonPrimary : c.buttonNormal;
                case ButtonKind.Disabled: return c.buttonDisabled != null ? c.buttonDisabled : c.buttonNormal;
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
                case "hexbolt_cast": return c.hexboltCast;
                case "hexbolt_impact": return c.hexboltImpact;
                case "hexbolt_impact_2": return c.hexboltImpact2;
                default: return null;
            }
        }

        public static Sprite PanelSprite()
        {
            var s = Catalog != null ? Catalog.panel : null;
            return s != null ? s : ProceduralPanel();
        }

        public static Sprite FrameSprite()
        {
            var s = Catalog != null ? Catalog.frame : null;
            return s != null ? s : ProceduralFrame();
        }

        public static bool HasAuthoredPanel => Catalog != null && Catalog.panel != null;

        public static Sprite PanelHeader => Catalog != null ? Catalog.panelHeader : null;

        public static Sprite CloseButton => Catalog != null ? Catalog.closeButton : null;

        /// <summary>HUD chrome. key is frame, fill_health, fill_mana, fill_xp, or fill_ghost.</summary>
        public static Sprite Hud(string key)
        {
            var c = Catalog;
            if (c == null || string.IsNullOrEmpty(key)) return null;
            switch (key)
            {
                case "frame": return c.hudFrame;
                case "fill_health": return c.hudFillHealth;
                case "fill_mana": return c.hudFillMana;
                case "fill_xp": return c.hudFillXp;
                case "fill_ghost": return c.hudFillGhost;
                default: return null;
            }
        }

        /// <summary>Header icon. Modal names map onto icons/icon_&lt;name&gt;.png.</summary>
        public static Sprite Icon(string modal)
        {
            var c = Catalog;
            Sprite s = null;
            if (c != null)
            {
                if (modal == "bag" || modal == "inventory") s = c.iconInventory != null ? c.iconInventory : c.iconBag;
                else if (modal == "skills" || modal == "sword") s = c.iconSword != null ? c.iconSword : c.iconSkills;
                else if (modal == "pet" || modal == "shield") s = c.iconShield != null ? c.iconShield : c.iconPet;
                else if (modal == "menu" || modal == "settings") s = c.iconSettings != null ? c.iconSettings : c.iconMenu;
                else if (modal == "gem") s = c.iconGem;
            }
            if (s != null) return s;
            if (modal == "bag" || modal == "skills" || modal == "pet" || modal == "menu") return ProceduralIcon(modal);
            return null;
        }

        /// <summary>Sliced by default. tileCenter keeps the 9-slice border and repeats the middle.</summary>
        public static void ApplySlice(Image img, Sprite sprite, bool tileCenter = false)
        {
            if (img == null || sprite == null) return;
            img.sprite = sprite;
            img.type = tileCenter ? Image.Type.Tiled : Image.Type.Sliced;
            img.pixelsPerUnitMultiplier = 1f;
            img.color = Color.white;
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

        /// <summary>Rounded dark plate used when panel_bg.png is missing. Border matches the corner radius.</summary>
        static Sprite ProceduralPanel()
        {
            if (panelProc != null) return panelProc;
            const int s = 160, rad = 48;
            var fill = new Color(0.09f, 0.075f, 0.06f, 0.96f);
            var top = new Color(0.18f, 0.14f, 0.11f, 0.98f);
            var rim = new Color(0.77f, 0.64f, 0.42f, 1f);
            var tex = new Texture2D(s, s, TextureFormat.RGBA32, false) { filterMode = FilterMode.Bilinear, wrapMode = TextureWrapMode.Clamp };
            for (int y = 0; y < s; y++)
                for (int x = 0; x < s; x++)
                {
                    float dx = Mathf.Max(0, Mathf.Max(rad - x, x - (s - 1 - rad)));
                    float dy = Mathf.Max(0, Mathf.Max(rad - y, y - (s - 1 - rad)));
                    float d = Mathf.Sqrt(dx * dx + dy * dy);
                    float a = Mathf.Clamp01(rad - d + 0.6f);
                    if (a <= 0f) { tex.SetPixel(x, y, Color.clear); continue; }
                    int edge = Mathf.Min(Mathf.Min(x, y), Mathf.Min(s - 1 - x, s - 1 - y));
                    var col = Color.Lerp(fill, top, y / (float)(s - 1));
                    if (edge < 3) col = rim;
                    else if (edge < 7) col = Color.Lerp(rim, col, 0.55f);
                    col.a *= a;
                    tex.SetPixel(x, y, col);
                }
            tex.Apply();
            panelProc = Sprite.Create(tex, new Rect(0, 0, s, s), new Vector2(0.5f, 0.5f), 100, 0, SpriteMeshType.FullRect, new Vector4(rad, rad, rad, rad));
            return panelProc;
        }

        /// <summary>Gold frame with a clear center, used when frame_gold.png is missing.</summary>
        static Sprite ProceduralFrame()
        {
            if (frameProc != null) return frameProc;
            const int s = 160, b = 40;
            var tex = new Texture2D(s, s, TextureFormat.RGBA32, false) { filterMode = FilterMode.Bilinear, wrapMode = TextureWrapMode.Clamp };
            var gold = new Color(0.86f, 0.7f, 0.38f, 1f);
            var dark = new Color(0.42f, 0.3f, 0.14f, 1f);
            for (int y = 0; y < s; y++)
                for (int x = 0; x < s; x++)
                {
                    if (x >= b && x < s - b && y >= b && y < s - b) { tex.SetPixel(x, y, Color.clear); continue; }
                    float dx = Mathf.Max(0, Mathf.Max(b - 6 - x, x - (s - 1 - (b - 6))));
                    float dy = Mathf.Max(0, Mathf.Max(b - 6 - y, y - (s - 1 - (b - 6))));
                    float outer = Mathf.Sqrt(dx * dx + dy * dy);
                    int edge = Mathf.Min(Mathf.Min(x, y), Mathf.Min(s - 1 - x, s - 1 - y));
                    int inner = Mathf.Min(Mathf.Min(Mathf.Abs(x - b), Mathf.Abs(x - (s - 1 - b))), Mathf.Min(Mathf.Abs(y - b), Mathf.Abs(y - (s - 1 - b))));
                    if (outer > b - 4) { tex.SetPixel(x, y, Color.clear); continue; }
                    var col = edge < 3 || inner < 2 ? dark : gold;
                    float fade = Mathf.Clamp01(b - 4 - outer);
                    col.a *= Mathf.Clamp01(fade);
                    tex.SetPixel(x, y, col);
                }
            tex.Apply();
            frameProc = Sprite.Create(tex, new Rect(0, 0, s, s), new Vector2(0.5f, 0.5f), 100, 0, SpriteMeshType.FullRect, new Vector4(b, b, b, b));
            return frameProc;
        }

        static Sprite ProceduralIcon(string modal)
        {
            if (iconProc.TryGetValue(modal, out var cached)) return cached;
            const int s = 64;
            var tex = new Texture2D(s, s, TextureFormat.RGBA32, false) { filterMode = FilterMode.Bilinear, wrapMode = TextureWrapMode.Clamp };
            var gold = new Color(0.9f, 0.76f, 0.42f, 1f);
            var ink = new Color(0.16f, 0.12f, 0.09f, 1f);
            for (int y = 0; y < s; y++)
                for (int x = 0; x < s; x++)
                {
                    float cx = x - (s - 1) * 0.5f, cy = y - (s - 1) * 0.5f;
                    float d = Mathf.Sqrt(cx * cx + cy * cy);
                    tex.SetPixel(x, y, d < 28f ? (d > 24f ? gold : ink) : Color.clear);
                }
            if (modal == "bag")
            {
                StampRect(tex, 22, 16, 42, 40, gold);
                StampRect(tex, 26, 36, 38, 44, gold);
            }
            else if (modal == "skills")
            {
                for (int i = -16; i <= 16; i++)
                {
                    Plot(tex, 32 + i, 32, gold);
                    Plot(tex, 32, 32 + i, gold);
                    Plot(tex, 32 + i, 32 + i, gold);
                    Plot(tex, 32 + i, 32 - i, gold);
                }
            }
            else if (modal == "pet")
            {
                StampDisc(tex, 24, 22, 7, gold);
                StampDisc(tex, 40, 22, 7, gold);
                StampDisc(tex, 18, 36, 6, gold);
                StampDisc(tex, 32, 40, 7, gold);
                StampDisc(tex, 46, 36, 6, gold);
            }
            else
            {
                StampRect(tex, 18, 40, 46, 44, gold);
                StampRect(tex, 18, 30, 46, 34, gold);
                StampRect(tex, 18, 20, 46, 24, gold);
            }
            tex.Apply();
            var sprite = Sprite.Create(tex, new Rect(0, 0, s, s), new Vector2(0.5f, 0.5f), 100);
            iconProc[modal] = sprite;
            return sprite;
        }

        static void Plot(Texture2D tex, int x, int y, Color c)
        {
            if (x < 0 || y < 0 || x >= tex.width || y >= tex.height) return;
            tex.SetPixel(x, y, c);
        }

        static void StampRect(Texture2D tex, int x0, int y0, int x1, int y1, Color c)
        {
            for (int y = y0; y <= y1; y++)
                for (int x = x0; x <= x1; x++) Plot(tex, x, y, c);
        }

        static void StampDisc(Texture2D tex, int cx, int cy, int r, Color c)
        {
            for (int y = -r; y <= r; y++)
                for (int x = -r; x <= r; x++)
                    if (x * x + y * y <= r * r) Plot(tex, cx + x, cy + y, c);
        }
    }
}
