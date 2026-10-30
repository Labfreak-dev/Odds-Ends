using System;
using System.Collections.Generic;
using UnityEngine;

namespace Hollowmere
{
    /// <summary>
    /// Inventory chrome. Looks for textures in Resources/UI/inventory/ (frame, slot, tooltip,
    /// sil_head, sil_chest, sil_hands, sil_legs, sil_feet, sil_weapon, sil_offhand, sil_ring,
    /// sil_amulet). The same names live under Assets/Art/UI/inventory/ for the artist.
    /// A missing file gets a drawn placeholder.
    /// </summary>
    public static class InventoryArt
    {
        static readonly Dictionary<string, Sprite> cache = new Dictionary<string, Sprite>();

        public static Sprite Frame() => Get("frame", DrawFrame);
        public static Sprite Slot() => Get("slot", DrawSlot);
        public static Sprite Tooltip() => Get("tooltip", DrawTooltip);
        public static Sprite Silhouette(string part) => Get("sil_" + part, () => DrawSilhouette(part));

        static Sprite Get(string name, System.Func<Texture2D> draw)
        {
            if (cache.TryGetValue(name, out var s) && s != null) return s;
            var loaded = Resources.Load<Sprite>("UI/inventory/" + name);
            if (loaded != null) { cache[name] = loaded; return loaded; }
            var tex = Resources.Load<Texture2D>("UI/inventory/" + name);
            if (tex == null || !tex.isReadable) tex = draw();
            s = Sprite.Create(tex, new Rect(0, 0, tex.width, tex.height), new Vector2(0.5f, 0.5f), 100f, 0, SpriteMeshType.FullRect, name.StartsWith("sil_") ? Vector4.zero : new Vector4(28, 28, 28, 28));
            s.name = name;
            cache[name] = s;
            return s;
        }

        static Texture2D DrawFrame()
        {
            var t = New(128, 128);
            var gold = new Color(0.78f, 0.6f, 0.28f, 1f);
            var ink = new Color(0.1f, 0.08f, 0.06f, 0.92f);
            Fill(t, ink);
            Border(t, gold, 8);
            Border(t, new Color(0.35f, 0.24f, 0.1f, 1f), 14);
            t.Apply();
            return t;
        }

        static Texture2D DrawSlot()
        {
            var t = New(96, 96);
            Fill(t, new Color(0.12f, 0.1f, 0.09f, 0.95f));
            Border(t, new Color(0.72f, 0.55f, 0.26f, 1f), 4);
            // Corner ticks so an empty slot still reads as a frame.
            var tick = new Color(0.9f, 0.78f, 0.4f, 1f);
            for (int i = 0; i < 14; i++)
            {
                t.SetPixel(6, 6 + i, tick); t.SetPixel(6 + i, 6, tick);
                t.SetPixel(t.width - 7, 6 + i, tick); t.SetPixel(t.width - 7 - i, 6, tick);
                t.SetPixel(6, t.height - 7 - i, tick); t.SetPixel(6 + i, t.height - 7, tick);
                t.SetPixel(t.width - 7, t.height - 7 - i, tick); t.SetPixel(t.width - 7 - i, t.height - 7, tick);
            }
            t.Apply();
            return t;
        }

        static Texture2D DrawTooltip()
        {
            var t = New(128, 160);
            Fill(t, new Color(0.09f, 0.07f, 0.06f, 0.94f));
            Border(t, new Color(0.62f, 0.46f, 0.2f, 1f), 6);
            t.Apply();
            return t;
        }

        static Texture2D DrawSilhouette(string part)
        {
            var t = New(64, 64);
            Fill(t, new Color(0, 0, 0, 0));
            var ink = new Color(0.75f, 0.7f, 0.6f, 0.55f);
            switch (part)
            {
                case "head": Disc(t, 32, 40, 12, ink); break;
                case "chest": Box(t, 20, 14, 44, 40, ink); break;
                case "hands": Disc(t, 16, 32, 8, ink); Disc(t, 48, 32, 8, ink); break;
                case "legs": Box(t, 22, 8, 30, 36, ink); Box(t, 34, 8, 42, 36, ink); break;
                case "feet": Box(t, 18, 10, 30, 18, ink); Box(t, 34, 10, 48, 18, ink); break;
                case "weapon": Box(t, 28, 8, 36, 56, ink); break;
                case "offhand": Disc(t, 32, 34, 16, ink); break;
                case "ring": Disc(t, 32, 32, 14, ink); Disc(t, 32, 32, 7, new Color(0, 0, 0, 0)); break;
                default: Disc(t, 32, 30, 10, ink); Box(t, 30, 40, 34, 54, ink); break;
            }
            t.Apply();
            return t;
        }

        static Texture2D New(int w, int h)
        {
            var t = new Texture2D(w, h, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Bilinear };
            return t;
        }

        static void Fill(Texture2D t, Color c)
        {
            var px = new Color[t.width * t.height];
            for (int i = 0; i < px.Length; i++) px[i] = c;
            t.SetPixels(px);
        }

        static void Border(Texture2D t, Color c, int n)
        {
            for (int y = 0; y < t.height; y++)
                for (int x = 0; x < t.width; x++)
                    if (x < n || y < n || x >= t.width - n || y >= t.height - n)
                        t.SetPixel(x, y, c);
        }

        static void Box(Texture2D t, int x0, int y0, int x1, int y1, Color c)
        {
            for (int y = y0; y < y1; y++)
                for (int x = x0; x < x1; x++)
                    if (x >= 0 && y >= 0 && x < t.width && y < t.height) t.SetPixel(x, y, c);
        }

        static void Disc(Texture2D t, int cx, int cy, int r, Color c)
        {
            for (int y = cy - r; y <= cy + r; y++)
                for (int x = cx - r; x <= cx + r; x++)
                    if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r)
                        if (x >= 0 && y >= 0 && x < t.width && y < t.height) t.SetPixel(x, y, c);
        }
    }
}
