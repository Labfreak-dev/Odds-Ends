using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace Hollowmere.StyleTest.Skills
{
    /// <summary>uGUI builders for phase 5 (reference resolution 2340x1080, landscape phone): mobile combat HUD, loadout screen,
    /// subclass pick screen. Built in code (no prefabs) so the style test stays self-contained.</summary>
    public static class StUi
    {
        public static readonly Vector2 Ref = new Vector2(2340, 1080);
        static Font font; public static Font Font => font ? font : (font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf"));
        static readonly Color Ink = new Color(0.06f, 0.06f, 0.08f, 0.92f), Panel = new Color(0.1f, 0.1f, 0.13f, 0.9f), Gold = new Color(1f, 0.82f, 0.38f), Dim = new Color(0.7f, 0.72f, 0.78f);

        // ------------------------------------------------------------------ basics
        public static Canvas MakeCanvas(Camera cam, string name = "p5_ui")
        {
            var g = new GameObject(name); var cv = g.AddComponent<Canvas>();
            if (cam != null) { cv.renderMode = RenderMode.ScreenSpaceCamera; cv.worldCamera = cam; cv.planeDistance = 1f; }
            else cv.renderMode = RenderMode.ScreenSpaceOverlay;
            var sc = g.AddComponent<CanvasScaler>(); sc.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize; sc.referenceResolution = Ref; sc.matchWidthOrHeight = 0.5f;
            g.AddComponent<GraphicRaycaster>();
            if (Object.FindFirstObjectByType<UnityEngine.EventSystems.EventSystem>() == null)
            {
                var es = new GameObject("EventSystem"); es.AddComponent<UnityEngine.EventSystems.EventSystem>();
                es.AddComponent<UnityEngine.InputSystem.UI.InputSystemUIInputModule>();
            }
            return cv;
        }

        public static RectTransform Rect(Transform parent, string name, Vector2 anchor, Vector2 pos, Vector2 size, Vector2? pivot = null)
        {
            var g = new GameObject(name, typeof(RectTransform)); var r = (RectTransform)g.transform; r.SetParent(parent, false);
            r.anchorMin = r.anchorMax = anchor; r.pivot = pivot ?? new Vector2(0.5f, 0.5f); r.anchoredPosition = pos; r.sizeDelta = size; return r;
        }
        public static RectTransform Stretch(Transform parent, string name)
        {
            var g = new GameObject(name, typeof(RectTransform)); var r = (RectTransform)g.transform; r.SetParent(parent, false);
            r.anchorMin = Vector2.zero; r.anchorMax = Vector2.one; r.offsetMin = r.offsetMax = Vector2.zero; return r;
        }
        public static Image Img(RectTransform r, Color c, Sprite s = null)
        {
            var i = r.gameObject.AddComponent<Image>(); i.color = c; i.sprite = s; i.raycastTarget = false; return i;
        }
        public static Text Txt(Transform parent, string s, int size, Color c, Vector2 anchor, Vector2 pos, Vector2 box, TextAnchor al = TextAnchor.MiddleCenter, FontStyle st = FontStyle.Normal)
        {
            int ai = (int)al; var pv = new Vector2(ai % 3 * 0.5f, 1 - ai / 3 * 0.5f);
            var r = Rect(parent, "t_" + (s.Length > 10 ? s.Substring(0, 10) : s), anchor, pos, box, pv); var t = r.gameObject.AddComponent<Text>();
            t.font = Font; t.text = s; t.fontSize = size; t.color = c; t.alignment = al; t.fontStyle = st; t.raycastTarget = false;
            t.horizontalOverflow = HorizontalWrapMode.Wrap; t.verticalOverflow = VerticalWrapMode.Overflow;
            var sh = r.gameObject.AddComponent<Shadow>(); sh.effectColor = new Color(0, 0, 0, 0.8f); sh.effectDistance = new Vector2(2, -2);
            return t;
        }
        public static Button Btn(RectTransform r, System.Action click)
        {
            var img = r.GetComponent<Image>(); if (img) img.raycastTarget = true; else { img = Img(r, new Color(0, 0, 0, 0)); img.raycastTarget = true; }
            var b = r.gameObject.AddComponent<Button>(); b.targetGraphic = img; if (click != null) b.onClick.AddListener(() => click()); return b;
        }

        // ------------------------------------------------------------------ procedural sprites
        static readonly Dictionary<string, Sprite> sprites = new Dictionary<string, Sprite>();
        static Sprite MakeSprite(string key, int n, System.Func<float, float, Color> f, Vector4 border = default)
        {
            if (sprites.TryGetValue(key, out var s) && s) return s;
            var t = new Texture2D(n, n, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Bilinear, name = key };
            var px = new Color[n * n];
            for (int y = 0; y < n; y++) for (int x = 0; x < n; x++) px[y * n + x] = f((x + 0.5f) / n * 2 - 1, (y + 0.5f) / n * 2 - 1);
            t.SetPixels(px); t.Apply();
            s = Sprite.Create(t, new Rect(0, 0, n, n), new Vector2(0.5f, 0.5f), 100, 0, SpriteMeshType.FullRect, border); sprites[key] = s; return s;
        }
        static float AA(float d, float w = 0.02f) => Mathf.Clamp01(0.5f - d / w);
        public static Sprite Circle => MakeSprite("circle", 256, (x, y) => new Color(1, 1, 1, AA(Mathf.Sqrt(x * x + y * y) - 0.98f)));
        public static Sprite Ring(float inner) => MakeSprite("ring" + inner, 256, (x, y) => { float r = Mathf.Sqrt(x * x + y * y); return new Color(1, 1, 1, AA(r - 0.98f) * AA(inner - r)); });
        public static Sprite Soft => MakeSprite("soft", 128, (x, y) => new Color(1, 1, 1, Mathf.Clamp01(1 - Mathf.Sqrt(x * x + y * y))));
        public static Sprite RoundRect => MakeSprite("rrect", 64, (x, y) =>
        {
            float rx = Mathf.Max(0, Mathf.Abs(x) - 0.5f), ry = Mathf.Max(0, Mathf.Abs(y) - 0.5f); return new Color(1, 1, 1, AA(Mathf.Sqrt(rx * rx + ry * ry) - 0.48f, 0.04f));
        }, new Vector4(24, 24, 24, 24));
        public static Sprite Vertical => MakeSprite("vgrad", 64, (x, y) => new Color(1, 1, 1, Mathf.Lerp(0.0f, 1f, (y + 1) / 2)));

        // ------------------------------------------------------------------ skill icons
        static readonly Dictionary<string, Sprite> icons = new Dictionary<string, Sprite>();
        /// <summary>Owned itch icon (gitignored Owned/ folder) gradient-mapped through the palette; procedural glyph when absent.</summary>
        public static Sprite Icon(SkillDef s, Palette pal)
        {
            var key = s.id + "|" + pal.name; if (icons.TryGetValue(key, out var hit) && hit) return hit;
            Color dk = Palette.Ldr(pal.dark) * 0.5f, p = Palette.Ldr(pal.primary), g = Palette.Ldr(pal.glow); dk.a = 1;
            Texture2D outT = null;
            var src = s.icon > 0 ? Resources.Load<Texture2D>("STO/Skills/sk4_" + s.icon + "_Icon") : null;
            if (src != null)
            {
                var rt = RenderTexture.GetTemporary(128, 128, 0, RenderTextureFormat.ARGB32, RenderTextureReadWrite.sRGB); Graphics.Blit(src, rt);
                var prev = RenderTexture.active; RenderTexture.active = rt; outT = new Texture2D(128, 128, TextureFormat.RGBA32, false); outT.ReadPixels(new Rect(0, 0, 128, 128), 0, 0); RenderTexture.active = prev; RenderTexture.ReleaseTemporary(rt);
                var px = outT.GetPixels();
                for (int i = 0; i < px.Length; i++)
                {
                    var c = px[i]; float L = Mathf.Clamp01(c.r * 0.45f + c.g * 0.45f + c.b * 0.1f);
                    Color o = L < 0.3f ? Color.Lerp(dk, p * 0.55f, L / 0.3f) : L < 0.7f ? Color.Lerp(p * 0.55f, p, (L - 0.3f) / 0.4f) : Color.Lerp(p, Color.Lerp(g, Color.white, 0.6f), (L - 0.7f) / 0.3f);
                    o.a = c.a; px[i] = o;
                }
                outT.SetPixels(px); outT.Apply();
            }
            else outT = Glyph(s.Glyph ?? s.id, dk, p, g);
            var sp = Sprite.Create(outT, new Rect(0, 0, outT.width, outT.height), new Vector2(0.5f, 0.5f)); icons[key] = sp; return sp;
        }

        /// <summary>Asset-free fallback icon: palette radial backdrop + a simple glyph picked from the skill's glyph key.</summary>
        static Texture2D Glyph(string key, Color dk, Color p, Color g)
        {
            const int N = 128; var t = new Texture2D(N, N, TextureFormat.RGBA32, false); var px = new Color[N * N];
            int kind = Mathf.Abs(key.GetHashCode()) % 6;
            for (int y = 0; y < N; y++) for (int x = 0; x < N; x++)
            {
                float u = x / (float)N * 2 - 1, v = y / (float)N * 2 - 1, r = Mathf.Sqrt(u * u + v * v), a = Mathf.Atan2(v, u);
                var c = Color.Lerp(p * 0.5f, dk, Mathf.Clamp01(r)); float m = 0;
                switch (kind)
                {
                    case 0: m = AA(Mathf.Abs(r - 0.55f) - 0.09f, 0.04f); break;                                  // ring
                    case 1: m = AA(Mathf.Abs(u + v) / 1.414f - 0.1f, 0.04f) * AA(r - 0.8f, 0.04f); break;       // slash
                    case 2: m = AA(Mathf.Max(Mathf.Abs(u) + Mathf.Abs(v)) - 0.55f, 0.04f); break;               // diamond
                    case 3: m = AA(r - (0.35f + 0.25f * Mathf.Cos(a * 5)), 0.04f); break;                       // star
                    case 4: m = AA(Mathf.Max(Mathf.Abs(u) - 0.12f, Mathf.Abs(v) - 0.65f), 0.04f) + AA(Mathf.Max(Mathf.Abs(u) - 0.5f, Mathf.Abs(v - 0.2f) - 0.1f), 0.04f); break; // sword-cross
                    default: m = AA(r - 0.4f, 0.04f) * (0.6f + 0.4f * (1 - r)); break;                           // orb
                }
                c = Color.Lerp(c, Color.Lerp(g, Color.white, 0.5f), Mathf.Clamp01(m)); c.a = 1; px[y * N + x] = c;
            }
            t.SetPixels(px); t.Apply(); return t;
        }

        // ------------------------------------------------------------------ shared widgets
        public static RectTransform IconButton(Transform parent, SkillDef s, Palette pal, Vector2 anchor, Vector2 pos, float d, bool ultimate = false)
        {
            var root = Rect(parent, "btn_" + (s != null ? s.id : "empty"), anchor, pos, new Vector2(d, d));
            var shadow = Rect(root, "shadow", new Vector2(0.5f, 0.5f), new Vector2(0, -6), new Vector2(d * 1.12f, d * 1.12f)); Img(shadow, new Color(0, 0, 0, 0.45f), Soft);
            var bg = Rect(root, "bg", new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(d, d)); Img(bg, Ink, Circle);
            if (s != null)
            {
                var ic = Rect(root, "icon", new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(d * 0.86f, d * 0.86f)); Img(ic, Color.white, Circle);
                ic.gameObject.AddComponent<Mask>().showMaskGraphic = false;
                var art = Rect(ic, "art", new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(d * 0.9f, d * 0.9f)); Img(art, Color.white, Icon(s, pal));
            }
            var rim = Rect(root, "rim", new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(d, d)); Img(rim, ultimate ? Gold : Color.Lerp(Palette.Ldr(pal.primary), Color.white, 0.35f), Ring(0.86f));
            return root;
        }

        /// <summary>Radial cooldown sweep (dark, clockwise from 12 o'clock) plus remaining seconds.</summary>
        public static Image Cooldown(RectTransform btn, float d, float frac, float secs)
        {
            var r = Rect(btn, "cd", new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(d * 0.86f, d * 0.86f)); var im = Img(r, new Color(0.02f, 0.02f, 0.05f, 0.72f), Circle);
            im.type = Image.Type.Filled; im.fillMethod = Image.FillMethod.Radial360; im.fillOrigin = (int)Image.Origin360.Top; im.fillClockwise = false; im.fillAmount = frac;
            var t = Txt(btn, secs > 0 ? secs.ToString(secs < 10 ? "0.0" : "0") : "", (int)(d * 0.3f), Color.white, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(d, d * 0.5f), TextAnchor.MiddleCenter, FontStyle.Bold);
            t.name = "cd_txt"; return im;
        }

        static Image Bar(Transform p, string name, Vector2 pos, Vector2 size, Color c, float frac, string label)
        {
            var back = Rect(p, name, new Vector2(0, 1), pos, size, new Vector2(0, 1)); Img(back, new Color(0, 0, 0, 0.6f), RoundRect).type = Image.Type.Sliced;
            var fill = Rect(back, "fill", new Vector2(0, 0.5f), new Vector2(4, 0), new Vector2(size.x - 8, size.y - 8), new Vector2(0, 0.5f));
            var fi = Img(fill, c, RoundRect); fi.type = Image.Type.Sliced; fill.sizeDelta = new Vector2((size.x - 8) * Mathf.Clamp01(frac), size.y - 8);
            var hl = Rect(fill, "hl", new Vector2(0.5f, 1), new Vector2(0, -2), new Vector2(0, size.y * 0.3f)); hl.anchorMin = new Vector2(0, 1); hl.anchorMax = new Vector2(1, 1); Img(hl, new Color(1, 1, 1, 0.22f));
            Txt(back, label, (int)(size.y * 0.62f), Color.white, new Vector2(0.5f, 0.5f), Vector2.zero, size, TextAnchor.MiddleCenter, FontStyle.Bold);
            return fi;
        }

        public static RectTransform LevelButton(Transform parent, int level, System.Action click, Vector2 pos)
        {
            var r = Rect(parent, "dbg_level20", new Vector2(1, 1), pos, new Vector2(300, 74), new Vector2(1, 1)); var im = Img(r, new Color(0.55f, 0.15f, 0.12f, 0.95f), RoundRect); im.type = Image.Type.Sliced;
            Txt(r, "DEBUG: Set level 20", 26, Color.white, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(290, 70), TextAnchor.MiddleCenter, FontStyle.Bold);
            Txt(r, "Lv " + level, 22, Gold, new Vector2(0, 0.5f), new Vector2(-50, 0), new Vector2(80, 30), TextAnchor.MiddleRight);
            Btn(r, click); return r;
        }

        // ------------------------------------------------------------------ HUD
        public class Hud
        {
            public Canvas canvas; public StSkillRunner runner; public readonly Dictionary<string, (Image cd, Text txt, float d)> slots = new Dictionary<string, (Image, Text, float)>();
            public Image hp, mana, ultFill; public Text hpTxt, manaTxt;
        }

        public struct HudState { public float hp, maxHp, mana, maxMana, ult; public int level; public Dictionary<string, float> cdFrac, cdSecs; }

        /// <summary>Mobile combat HUD. Big basic attack bottom-right, 4 actives on an arc around it, ultimate on top of the arc,
        /// radial cooldown sweeps, HP/mana bars + passive top-left, debug level button top-right.</summary>
        public static Hud BuildHud(Camera cam, Loadout l, HudState st, StSkillRunner runner = null, System.Action onLevel = null)
        {
            var h = new Hud { canvas = MakeCanvas(cam, "p5_hud"), runner = runner }; var root = h.canvas.transform; var pal = l.Palette;
            var cls = StSkillDb.Classes[l.cls]; var sub = l.subclass != null ? StSkillDb.Subclasses[l.subclass] : null;
            // --- top-left: portrait disc, name, bars, passive
            var port = Rect(root, "portrait", new Vector2(0, 1), new Vector2(40, -36), new Vector2(170, 170), new Vector2(0, 1)); Img(port, Ink, Circle);
            var pr = Rect(port, "rim", new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(170, 170)); Img(pr, Palette.Ldr(pal.primary), Ring(0.88f));
            var pm = Rect(port, "mask", new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(150, 150)); Img(pm, Color.white, Circle); pm.gameObject.AddComponent<Mask>().showMaskGraphic = false;
            var pi = Rect(pm, "cls", new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(156, 156)); Img(pi, Color.white, Icon(StSkillDb.Skills[l.basic], pal));
            Txt(port, st.level.ToString(), 34, Color.white, new Vector2(1, 0), new Vector2(-14, 14), new Vector2(60, 50), TextAnchor.MiddleCenter, FontStyle.Bold);
            Txt(root, (sub != null ? sub.name : cls.name) + "  ·  Lv " + st.level, 34, Color.white, new Vector2(0, 1), new Vector2(232, -52), new Vector2(560, 50), TextAnchor.MiddleLeft, FontStyle.Bold);
            h.hp = Bar(root, "hp", new Vector2(226, -84), new Vector2(560, 46), new Color(0.85f, 0.2f, 0.18f), st.hp / st.maxHp, Mathf.RoundToInt(st.hp) + " / " + Mathf.RoundToInt(st.maxHp));
            h.mana = Bar(root, "mana", new Vector2(226, -136), new Vector2(460, 34), new Color(0.25f, 0.5f, 1f), st.mana / st.maxMana, Mathf.RoundToInt(st.mana) + " / " + Mathf.RoundToInt(st.maxMana));
            h.hpTxt = h.hp.transform.parent.GetComponentInChildren<Text>(); h.manaTxt = h.mana.transform.parent.GetComponentInChildren<Text>();
            if (!string.IsNullOrEmpty(l.passive))
            {
                var ps = StSkillDb.Skills[l.passive]; var pb = IconButton(root, ps, pal, new Vector2(0, 1), new Vector2(740, -152), 64);
                Txt(pb, "passive", 18, Dim, new Vector2(0.5f, 0), new Vector2(0, -14), new Vector2(120, 24));
            }
            if (onLevel != null || runner == null) LevelButton(root, st.level, onLevel, new Vector2(-30, -30));

            // --- bottom-right cluster
            var hub = new Vector2(-270, 235); float big = 270, small = 158, rad = 305;
            var basic = StSkillDb.Skills[l.basic];
            var bb = IconButton(root, basic, pal, new Vector2(1, 0), hub, big); Txt(bb, basic.name, 26, Color.white, new Vector2(0.5f, 0), new Vector2(0, 14), new Vector2(300, 34), TextAnchor.MiddleCenter, FontStyle.Bold);
            if (runner != null) Btn(bb, () => runner.Cast(l.basic));
            float[] angs = { 197, 166, 135, 104 };
            for (int i = 0; i < 4; i++)
            {
                var id = l.actives[i]; var s = string.IsNullOrEmpty(id) ? null : StSkillDb.Skills[id];
                var a = angs[i] * Mathf.Deg2Rad; var pos = hub + new Vector2(Mathf.Cos(a), Mathf.Sin(a)) * rad;
                var b = IconButton(root, s, s != null ? runner?.PaletteOf(s) ?? (s.palettePin ?? pal) : pal, new Vector2(1, 0), pos, small);
                if (s == null) continue;
                float f = 0, secs = 0; st.cdFrac?.TryGetValue(id, out f); st.cdSecs?.TryGetValue(id, out secs);
                var cd = Cooldown(b, small, f, secs); h.slots[id] = (cd, b.Find("cd_txt").GetComponent<Text>(), small);
                if (runner != null) { var sid = id; Btn(b, () => runner.Cast(sid)); }
            }
            // ultimate: above the arc, gold rim, charge fill
            var us = StSkillDb.Skills[l.ultimate]; var upos = hub + new Vector2(Mathf.Cos(70 * Mathf.Deg2Rad), Mathf.Sin(70 * Mathf.Deg2Rad)) * (rad + 130);
            var ub = IconButton(root, us, pal, new Vector2(1, 0), upos, 190, true);
            var glow = Rect(ub, "ult_glow", new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(300, 300)); Img(glow, new Color(Gold.r, Gold.g, Gold.b, st.ult >= 1 ? 0.55f : 0.0f), Soft); glow.SetAsFirstSibling();
            var charge = Rect(ub, "charge", new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(214, 214)); var ci = Img(charge, Gold, Ring(0.88f));
            ci.type = Image.Type.Filled; ci.fillMethod = Image.FillMethod.Radial360; ci.fillOrigin = (int)Image.Origin360.Bottom; ci.fillAmount = Mathf.Clamp01(st.ult); h.ultFill = ci;
            var ucd = Cooldown(ub, 190, 1 - Mathf.Clamp01(st.ult), 0); ucd.color = new Color(0.02f, 0.02f, 0.05f, 0.45f); h.slots[l.ultimate] = (ucd, ub.Find("cd_txt").GetComponent<Text>(), 190);
            Txt(ub, "ULT " + Mathf.RoundToInt(Mathf.Clamp01(st.ult) * 100) + "%", 24, Gold, new Vector2(0.5f, 0), new Vector2(0, -18), new Vector2(200, 30), TextAnchor.MiddleCenter, FontStyle.Bold).name = "ult_pct";
            if (runner != null) Btn(ub, () => runner.Cast(l.ultimate));
            return h;
        }

        /// <summary>Live HUD refresh from a StSkillRunner (play mode).</summary>
        public static void Tick(Hud h)
        {
            var r = h.runner; if (r == null) return;
            foreach (var kv in h.slots)
            {
                var sk = StSkillDb.Skills[kv.Key];
                if (sk.slot == SlotType.Ultimate) { kv.Value.cd.fillAmount = 1 - r.UltCharge; h.ultFill.fillAmount = r.UltCharge; continue; }
                kv.Value.cd.fillAmount = r.CooldownFrac(kv.Key); float s = r.CooldownLeft(kv.Key); kv.Value.txt.text = s > 0 ? s.ToString(s < 10 ? "0.0" : "0") : "";
            }
            SetBar(h.hp, r.hp / r.maxHp, 552); SetBar(h.mana, r.mana / r.maxMana, 452);
            if (h.hpTxt) h.hpTxt.text = Mathf.RoundToInt(r.hp) + " / " + Mathf.RoundToInt(r.maxHp); if (h.manaTxt) h.manaTxt.text = Mathf.RoundToInt(r.mana) + " / " + Mathf.RoundToInt(r.maxMana);
        }
        static void SetBar(Image fill, float f, float w) { var rt = (RectTransform)fill.transform; rt.sizeDelta = new Vector2(w * Mathf.Clamp01(f), rt.sizeDelta.y); }

        // ------------------------------------------------------------------ loadout screen
        public class LoadoutScreen { public Canvas canvas; public Loadout l; public string selected; public System.Action rebuild; }

        public static LoadoutScreen BuildLoadout(Camera cam, Loadout l, int level, Texture portrait, string selected, System.Action<LoadoutScreen> onChange = null, System.Action onDone = null, System.Action onLevel = null)
        {
            var ls = new LoadoutScreen { canvas = MakeCanvas(cam, "p5_loadout"), l = l, selected = selected }; var root = ls.canvas.transform; var pal = l.Palette;
            var bg = Stretch(root, "bg"); Img(bg, new Color(0.07f, 0.07f, 0.09f, 0.97f));
            var tint = Stretch(root, "tint"); Img(tint, A(Palette.Ldr(pal.primary), 0.08f), Vertical);
            var cls = StSkillDb.Classes[l.cls]; var sub = l.subclass != null ? StSkillDb.Subclasses[l.subclass] : null;
            Txt(root, "LOADOUT", 64, Color.white, new Vector2(0, 1), new Vector2(60, -40), new Vector2(600, 80), TextAnchor.UpperLeft, FontStyle.Bold);
            Txt(root, (sub != null ? sub.name + "  (" + cls.name + ")" : cls.name) + "  ·  Level " + level, 34, Gold, new Vector2(0, 1), new Vector2(60, -112), new Vector2(900, 50), TextAnchor.UpperLeft);
            LevelButton(root, level, onLevel, new Vector2(-40, -40));

            // left: hero portrait card
            var card = Rect(root, "hero", new Vector2(0, 0.5f), new Vector2(60, -40), new Vector2(560, 780), new Vector2(0, 0.5f)); var ci = Img(card, Panel, RoundRect); ci.type = Image.Type.Sliced;
            if (portrait != null) { var pr = Rect(card, "portrait", new Vector2(0.5f, 1), new Vector2(0, -20), new Vector2(520, 600), new Vector2(0.5f, 1)); var raw = pr.gameObject.AddComponent<RawImage>(); raw.texture = portrait; raw.raycastTarget = false; }
            Txt(card, sub != null ? sub.name + " outfit" : cls.name + " outfit", 32, Color.white, new Vector2(0.5f, 0), new Vector2(0, 120), new Vector2(520, 44), TextAnchor.MiddleCenter, FontStyle.Bold);
            Swatches(card, pal, new Vector2(0.5f, 0), new Vector2(0, 62), 46);

            // centre: equipped slots
            var eq = Rect(root, "equipped", new Vector2(0.5f, 0.5f), new Vector2(-190, 40), new Vector2(760, 760)); var ei = Img(eq, Panel, RoundRect); ei.type = Image.Type.Sliced;
            Txt(eq, "EQUIPPED", 34, Dim, new Vector2(0.5f, 1), new Vector2(0, -36), new Vector2(700, 50), TextAnchor.MiddleCenter, FontStyle.Bold);
            var selDef = selected != null && StSkillDb.Skills.TryGetValue(selected, out var sd) ? sd : null;
            void Slot(string id, string label, Vector2 pos, float d, SlotType type, int idx)
            {
                var s = string.IsNullOrEmpty(id) ? null : StSkillDb.Skills[id];
                var b = IconButton(eq, s, s?.palettePin ?? pal, new Vector2(0.5f, 0.5f), pos, d, type == SlotType.Ultimate);
                Txt(b, label, 22, Dim, new Vector2(0.5f, 1), new Vector2(0, 30), new Vector2(220, 30));
                if (s != null) Txt(b, s.name, 24, Color.white, new Vector2(0.5f, 0), new Vector2(0, -22), new Vector2(240, 32), TextAnchor.MiddleCenter, FontStyle.Bold);
                bool target = selDef != null && selDef.slot == type && selected != id;
                if (target) { var hl = Rect(b, "target", new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(d * 1.25f, d * 1.25f)); Img(hl, A(Gold, 0.9f), Ring(0.9f)); }
                Btn(b, () =>
                {
                    if (selDef == null || selDef.slot != type) return;
                    if (type == SlotType.Active) { for (int k = 0; k < 4; k++) if (l.actives[k] == selDef.id) l.actives[k] = l.actives[idx]; l.actives[idx] = selDef.id; }
                    else if (type == SlotType.Ultimate) l.ultimate = selDef.id; else if (type == SlotType.Passive) l.passive = selDef.id;
                    onChange?.Invoke(ls);
                });
            }
            Slot(l.ultimate, "ULTIMATE", new Vector2(0, 225), 140, SlotType.Ultimate, 0);
            for (int i = 0; i < 4; i++) Slot(l.actives[i], "ACTIVE " + (i + 1), new Vector2(-270 + i * 180, -30), 130, SlotType.Active, i);
            Slot(l.basic, "BASIC", new Vector2(-140, -235), 160, SlotType.Basic, 0);
            Slot(l.passive, "PASSIVE", new Vector2(150, -235), 120, SlotType.Passive, 0);

            // right: known skills
            var kn = Rect(root, "known", new Vector2(1, 0.5f), new Vector2(-60, 40), new Vector2(780, 760), new Vector2(1, 0.5f)); var ki = Img(kn, Panel, RoundRect); ki.type = Image.Type.Sliced;
            Txt(kn, "KNOWN SKILLS  (tap a skill, then a highlighted slot)", 28, Dim, new Vector2(0.5f, 1), new Vector2(0, -36), new Vector2(740, 44), TextAnchor.MiddleCenter, FontStyle.Bold);
            int n = 0;
            foreach (var s in StSkillDb.Known(l.cls, l.subclass))
            {
                if (s.slot == SlotType.Basic) continue;
                int col = n % 5, row = n / 5; n++;
                var pos = new Vector2(-300 + col * 150, 230 - row * 170);
                var b = IconButton(kn, s, s.palettePin ?? pal, new Vector2(0.5f, 0.5f), pos, 100, s.slot == SlotType.Ultimate);
                Txt(b, s.name, 20, Color.white, new Vector2(0.5f, 0), new Vector2(0, -20), new Vector2(150, 50), TextAnchor.UpperCenter);
                bool equipped = System.Array.IndexOf(l.actives, s.id) >= 0 || l.ultimate == s.id || l.passive == s.id;
                if (equipped) { var e = Rect(b, "eq", new Vector2(1, 1), new Vector2(-6, -6), new Vector2(36, 36)); Img(e, new Color(0.3f, 0.85f, 0.4f), Circle); Txt(e, "E", 22, Color.black, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(36, 36), TextAnchor.MiddleCenter, FontStyle.Bold); }
                if (s.IsSub) { var t = Rect(b, "sub", new Vector2(0, 0), new Vector2(-6, 14), new Vector2(56, 26)); Img(t, Palette.Ldr(pal.primary), RoundRect).type = Image.Type.Sliced; Txt(t, "SUB", 17, Color.black, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(56, 26), TextAnchor.MiddleCenter, FontStyle.Bold); }
                Txt(b, s.slot == SlotType.Ultimate ? "ULT" : s.slot == SlotType.Passive ? "PAS" : "", 18, Gold, new Vector2(1, 0), new Vector2(0, 8), new Vector2(60, 24));
                if (s.id == selected) { var hl = Rect(b, "sel", new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(122, 122)); Img(hl, Color.white, Ring(0.88f)); }
                var sid = s.id; Btn(b, () => { ls.selected = sid; onChange?.Invoke(ls); });
            }
            // tooltip
            if (selDef != null)
            {
                var tip = Rect(kn, "tooltip", new Vector2(0.5f, 0), new Vector2(0, 30), new Vector2(740, 200), new Vector2(0.5f, 0)); var ti = Img(tip, new Color(0, 0, 0, 0.55f), RoundRect); ti.type = Image.Type.Sliced;
                Txt(tip, selDef.name + (selDef.IsSub ? "   [" + StSkillDb.Subclasses[selDef.subclass].name + "]" : ""), 32, Gold, new Vector2(0, 1), new Vector2(24, -14), new Vector2(700, 40), TextAnchor.UpperLeft, FontStyle.Bold).rectTransform.pivot = new Vector2(0, 1);
                var meta = selDef.slot + "  ·  cd " + selDef.cooldown + " s" + (selDef.cost > 0 ? "  ·  " + selDef.cost + " mana" : "") + (selDef.telegraph != null ? "  ·  " + selDef.telegraph.shape.ToString().ToLower() + " telegraph" : "") + "  ·  unlock Lv " + selDef.unlockLevel;
                Txt(tip, meta, 24, Dim, new Vector2(0, 1), new Vector2(24, -58), new Vector2(700, 34), TextAnchor.UpperLeft).rectTransform.pivot = new Vector2(0, 1);
                Txt(tip, selDef.desc, 26, Color.white, new Vector2(0, 1), new Vector2(24, -98), new Vector2(700, 90), TextAnchor.UpperLeft).rectTransform.pivot = new Vector2(0, 1);
            }
            // bottom bar
            var presets = new[] { "Preset 1", "Preset 2" };
            for (int i = 0; i < 2; i++)
            {
                var pb = Rect(root, "preset" + i, new Vector2(0.5f, 0), new Vector2(-380 + i * 260, 40), new Vector2(240, 72)); var pi2 = Img(pb, i == 0 ? A(Palette.Ldr(pal.primary), 0.9f) : new Color(0.2f, 0.2f, 0.24f), RoundRect); pi2.type = Image.Type.Sliced;
                Txt(pb, presets[i], 28, i == 0 ? Color.black : Color.white, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(240, 72), TextAnchor.MiddleCenter, FontStyle.Bold);
            }
            var done = Rect(root, "done", new Vector2(0.5f, 0), new Vector2(200, 40), new Vector2(300, 72)); Img(done, new Color(0.25f, 0.6f, 0.3f), RoundRect).type = Image.Type.Sliced;
            Txt(done, "Enter dungeon", 30, Color.white, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(300, 72), TextAnchor.MiddleCenter, FontStyle.Bold); Btn(done, onDone);
            return ls;
        }

        static Color A(Color c, float a) { c.a = a; return c; }

        public static void Swatches(Transform parent, Palette pal, Vector2 anchor, Vector2 pos, float d)
        {
            var cs = new[] { pal.primary, pal.secondary, pal.glow, pal.dark };
            for (int i = 0; i < 4; i++)
            {
                var r = Rect(parent, "sw" + i, anchor, pos + new Vector2((i - 1.5f) * (d + 12), 0), new Vector2(d, d)); Img(r, Color.white, Circle);
                var r2 = Rect(r, "c", new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(d - 6, d - 6)); Img(r2, Palette.Ldr(cs[i]), Circle);
            }
        }

        // ------------------------------------------------------------------ subclass pick
        public static Canvas BuildSubclassPick(Camera cam, int level, string highlight, Dictionary<string, Texture> portraits, System.Action<SubclassDef> onPick = null, System.Action onLevel = null)
        {
            var cv = MakeCanvas(cam, "p5_pick"); var root = cv.transform;
            var bg = Stretch(root, "bg"); Img(bg, new Color(0.06f, 0.06f, 0.08f, 0.97f));
            Txt(root, "CHOOSE YOUR PATH", 60, Color.white, new Vector2(0.5f, 1), new Vector2(0, -30), new Vector2(1400, 80), TextAnchor.MiddleCenter, FontStyle.Bold);
            Txt(root, "Subclasses unlock at level 20 · respec in town for gold · 3 playable in this prototype", 28, Dim, new Vector2(0.5f, 1), new Vector2(0, -98), new Vector2(1600, 40));
            LevelButton(root, level, onLevel, new Vector2(-30, -30));
            var classes = new[] { "knight", "ranger", "mage" };
            for (int row = 0; row < 3; row++)
            {
                var cls = StSkillDb.Classes[classes[row]]; float y = -210 - row * 285;
                var lab = Rect(root, "row_" + cls.id, new Vector2(0, 1), new Vector2(40, y), new Vector2(200, 250), new Vector2(0, 1)); var li = Img(lab, A(Palette.Ldr(cls.palette.primary), 0.18f), RoundRect); li.type = Image.Type.Sliced;
                Txt(lab, cls.name.ToUpper(), 36, Color.white, new Vector2(0.5f, 0.5f), new Vector2(0, 20), new Vector2(200, 50), TextAnchor.MiddleCenter, FontStyle.Bold);
                Txt(lab, level >= 20 ? "Lv 20 reached" : "needs Lv 20", 22, level >= 20 ? Gold : Dim, new Vector2(0.5f, 0.5f), new Vector2(0, -26), new Vector2(200, 30));
                int col = 0;
                foreach (var s in StSkillDb.SubclassOrder)
                {
                    if (s.cls != cls.id) continue;
                    var c = Rect(root, "card_" + s.id, new Vector2(0, 1), new Vector2(262 + col * 410, y), new Vector2(392, 250), new Vector2(0, 1)); col++;
                    var ci = Img(c, s.playable ? new Color(0.13f, 0.13f, 0.16f, 1) : new Color(0.1f, 0.1f, 0.12f, 1), RoundRect); ci.type = Image.Type.Sliced;
                    var band = Rect(c, "band", new Vector2(0.5f, 1), new Vector2(0, -6), new Vector2(380, 70), new Vector2(0.5f, 1)); var bi = Img(band, Palette.Ldr(s.palette.primary) * (s.playable ? 1 : 0.55f), RoundRect); bi.type = Image.Type.Sliced;
                    var shade = Rect(band, "shade", new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(380, 70)); Img(shade, new Color(0, 0, 0, 0.35f), Vertical).transform.localScale = new Vector3(1, -1, 1);
                    Txt(band, s.name, 34, Color.white, new Vector2(0, 0.5f), new Vector2(18, 0), new Vector2(360, 60), TextAnchor.MiddleLeft, FontStyle.Bold).rectTransform.pivot = new Vector2(0, 0.5f);
                    Txt(c, s.theme, 24, Dim, new Vector2(0, 1), new Vector2(18, -88), new Vector2(240, 30), TextAnchor.UpperLeft).rectTransform.pivot = new Vector2(0, 1);
                    Swatches(c, s.palette, new Vector2(0, 0), new Vector2(110, 44), 38);
                    if (portraits != null && portraits.TryGetValue(s.id, out var tex) && tex != null)
                    { var pr = Rect(c, "portrait", new Vector2(1, 0), new Vector2(-6, 6), new Vector2(150, 170), new Vector2(1, 0)); var raw = pr.gameObject.AddComponent<RawImage>(); raw.texture = tex; raw.raycastTarget = false; }
                    if (s.playable)
                    {
                        int k = 0; foreach (var id in s.skillIds) { var ic = Rect(c, "sk" + k, new Vector2(0, 1), new Vector2(18 + k * 66, -128), new Vector2(58, 58), new Vector2(0, 1)); Img(ic, Color.white, Icon(StSkillDb.Skills[id], s.palette)); k++; }
                        var rim = Rect(c, "rim", new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(400, 258)); var ri = Img(rim, s.id == highlight ? Gold : A(Palette.Ldr(s.palette.primary), 0.8f), RoundRect); ri.type = Image.Type.Sliced; ri.fillCenter = false;
                        var tag = Rect(c, "play", new Vector2(1, 1), new Vector2(-12, -86), new Vector2(110, 40), new Vector2(1, 1)); Img(tag, new Color(0.3f, 0.8f, 0.4f), RoundRect).type = Image.Type.Sliced;
                        Txt(tag, "PLAYABLE", 20, Color.black, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(110, 40), TextAnchor.MiddleCenter, FontStyle.Bold);
                        var ss = s; Btn(c, () => onPick?.Invoke(ss));
                    }
                    else
                    {
                        var lk = Stretch(c, "locked"); Img(lk, new Color(0, 0, 0, 0.45f), RoundRect).type = Image.Type.Sliced;
                        var pad = Rect(c, "lock", new Vector2(1, 0), new Vector2(-70, 80), new Vector2(70, 80)); LockGlyph(pad);
                        Txt(c, "LOCKED · coming later", 22, new Color(0.8f, 0.8f, 0.85f), new Vector2(0, 1), new Vector2(18, -130), new Vector2(300, 30), TextAnchor.UpperLeft).rectTransform.pivot = new Vector2(0, 1);
                    }
                }
            }
            return cv;
        }

        static void LockGlyph(RectTransform r)
        {
            var body = Rect(r, "body", new Vector2(0.5f, 0.5f), new Vector2(0, -12), new Vector2(56, 44)); Img(body, new Color(0.75f, 0.75f, 0.8f), RoundRect).type = Image.Type.Sliced;
            var sh = Rect(r, "shackle", new Vector2(0.5f, 0.5f), new Vector2(0, 16), new Vector2(42, 42)); Img(sh, new Color(0.75f, 0.75f, 0.8f), Ring(0.7f));
            var hole = Rect(body, "hole", new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(10, 16)); Img(hole, new Color(0.15f, 0.15f, 0.18f), Circle);
        }
    }
}
