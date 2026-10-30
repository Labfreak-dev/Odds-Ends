using System;
using System.Collections.Generic;
using Hollowmere.Core;
using UnityEngine;
using UnityEngine.UI;

namespace Hollowmere
{
    /// <summary>Mobile title: full-bleed key art, a logo, and two pages (main, new hero)
    /// that slide. Art and audio are optional drop-ins; see <see cref="UiDropIn"/>.</summary>
    public static class TitleScreen
    {
        static HeroClass cls = HeroClass.Ironclad;
        static PetSpecies pet = PetSpecies.Hound;
        static readonly string[] HeroNames = { "Aldric", "Maren", "Tobin", "Wren", "Corvin", "Isolde", "Bram", "Sela" };
        static readonly string[] PetNames = { "Biscuit", "Pickles", "Bramble", "Soot", "Mossy", "Pepper" };

        static GameObject root;
        static UiRoot ui;
        static RectTransform mainPage, createPage;
        static Text blurb;
        static readonly List<(HeroClass cls, Button button)> classes = new List<(HeroClass, Button)>();
        static readonly List<(PetSpecies pet, Button button)> pets = new List<(PetSpecies, Button)>();
        static bool onCreate;

        public static void Show(UiRoot rootUi)
        {
            ui = rootUi;
            AudioHub.Music("title_theme");
            if (root != null) return;
            onCreate = false;
            classes.Clear();
            pets.Clear();

            root = new GameObject("title", typeof(RectTransform));
            var rt = (RectTransform)root.transform;
            rt.SetParent(ui.canvas.transform, false);
            rt.anchorMin = Vector2.zero;
            rt.anchorMax = Vector2.one;
            rt.offsetMin = rt.offsetMax = Vector2.zero;
            rt.SetAsLastSibling();
            ui.Track(root);

            TitleAtmosphere.Build(rt);

            var safe = Ui.Rect(rt, "safe", Vector2.zero, Vector2.one);
            safe.gameObject.AddComponent<SafeArea>();

            BuildLogo(safe);
            mainPage = BuildMain(safe);
            createPage = BuildCreate(safe);
            createPage.gameObject.SetActive(false);
            Slide(mainPage, new Vector2(0, -36f));
        }

        static void BuildLogo(RectTransform safe)
        {
            var logo = Ui.Rect(safe, "logo", new Vector2(0, 1), new Vector2(0, 1), new Vector2(48, -300), new Vector2(760, -36));
            var sprite = UiArt.Logo;
            if (sprite != null)
            {
                var img = logo.gameObject.AddComponent<Image>();
                img.sprite = sprite;
                img.preserveAspect = true;
                img.raycastTarget = false;
            }
            else
            {
                Ui.Label(logo, "<b>HOLLOWMERE</b>", 72, TextAnchor.UpperLeft, Ui.Gold);
                var sub = Ui.Rect(logo, "sub", new Vector2(0, 0), new Vector2(1, 0), new Vector2(4, 8), new Vector2(0, 52));
                Ui.Label(sub, "THE LAKE AND THE HOLLOW", 22, TextAnchor.UpperLeft, new Color(0.78f, 0.7f, 0.55f));
            }
            var line = Ui.Rect(safe, "tag", new Vector2(0, 0), new Vector2(0.52f, 0), new Vector2(56, 36), new Vector2(-12, 120));
            Ui.Label(line, "A lakeside town. A hole that goes down forever.\nBring a rod.", 26, TextAnchor.LowerLeft, new Color(0.9f, 0.86f, 0.78f));
        }

        static RectTransform Card(RectTransform safe, string name)
        {
            var card = Ui.Rect(safe, name, new Vector2(1, 0), new Vector2(1, 1), new Vector2(-640, 48), new Vector2(-36, -48));
            Ui.Box(card, new Color(0.05f, 0.04f, 0.06f, 0.72f));
            return card;
        }

        static RectTransform BuildMain(RectTransform safe)
        {
            var card = Card(safe, "main");
            var col = Ui.Rect(card, "col", Vector2.zero, Vector2.one, new Vector2(28, 28), new Vector2(-28, -28));
            var vl = col.gameObject.AddComponent<VerticalLayoutGroup>();
            vl.spacing = 16;
            vl.childAlignment = TextAnchor.MiddleCenter;
            vl.childControlHeight = true;
            vl.childControlWidth = true;
            vl.childForceExpandHeight = false;
            vl.childForceExpandWidth = true;
            var hello = Ui.Rect(col, "hello", Vector2.zero, Vector2.one);
            Ui.Label(hello, "The gate is open.", 28, TextAnchor.MiddleCenter, new Color(0.8f, 0.74f, 0.62f));
            Ui.Size(hello, 48);

            if (GameManager.HasSave)
            {
                var cont = Ui.Button(col, "Continue", Continue, Ui.ButtonHot, 36, UiSfx.Confirm, true);
                Ui.Size(cont, 96);
            }
            var neu = Ui.Button(col, GameManager.HasSave ? "New Hero" : "Begin", OpenCreate, null, 34, UiSfx.Click, !GameManager.HasSave);
            Ui.Size(neu, 96);
            return card;
        }

        static RectTransform BuildCreate(RectTransform safe)
        {
            var card = Card(safe, "create");
            var col = Ui.Rect(card, "col", Vector2.zero, Vector2.one, new Vector2(22, 22), new Vector2(-22, -22));
            var vl = col.gameObject.AddComponent<VerticalLayoutGroup>();
            vl.spacing = 12;
            vl.childControlHeight = true;
            vl.childControlWidth = true;
            vl.childForceExpandHeight = false;
            vl.childForceExpandWidth = true;

            var back = Ui.Button(col, "Back", OpenMain, null, 26, UiSfx.Back);
            Ui.Size(back, 64);

            var row = Ui.Row(col, 120, 10);
            foreach (HeroClass c in Enum.GetValues(typeof(HeroClass)))
            {
                var cc = c;
                var b = Ui.Button(row, $"<b>{ClassName(cc)}</b>", () => SelectClass(cc), null, 26);
                b.GetComponentInChildren<Text>().alignment = TextAnchor.MiddleCenter;
                classes.Add((cc, b));
            }
            var blurbRt = Ui.Rect(col, "blurb", Vector2.zero, Vector2.one);
            blurb = Ui.Label(blurbRt, "", 24, TextAnchor.MiddleCenter, new Color(0.86f, 0.82f, 0.74f));
            Ui.Size(blurbRt, 88);

            var petRow = Ui.Row(col, 72, 10);
            pets.Add((PetSpecies.Hound, Ui.Button(petRow, "Hound", () => SelectPet(PetSpecies.Hound), null, 26)));
            pets.Add((PetSpecies.Lynx, Ui.Button(petRow, "Lynx", () => SelectPet(PetSpecies.Lynx), null, 26)));

            var begin = Ui.Button(col, "Begin", StartGame, new Color(0.75f, 0.55f, 0.22f), 36, UiSfx.Confirm, true);
            Ui.Size(begin, 96);
            Paint();
            return card;
        }

        static void OpenCreate()
        {
            if (onCreate) return;
            onCreate = true;
            mainPage.gameObject.SetActive(false);
            createPage.gameObject.SetActive(true);
            Slide(createPage, new Vector2(72f, 0f));
        }

        static void OpenMain()
        {
            if (!onCreate) return;
            onCreate = false;
            createPage.gameObject.SetActive(false);
            mainPage.gameObject.SetActive(true);
            Slide(mainPage, new Vector2(-72f, 0f));
        }

        static void Slide(RectTransform page, Vector2 delta)
        {
            page.anchoredPosition = Vector2.zero;
            var motion = page.GetComponent<UiMenuMotion>() ?? page.gameObject.AddComponent<UiMenuMotion>();
            motion.Arm(page, delta);
        }

        static void SelectClass(HeroClass c)
        {
            cls = c;
            Paint();
        }

        static void SelectPet(PetSpecies p)
        {
            pet = p;
            Paint();
        }

        static void Paint()
        {
            if (blurb != null) blurb.text = ClassLine(cls);
            foreach (var (c, b) in classes) PaintChoice(b, c == cls);
            foreach (var (p, b) in pets) PaintChoice(b, p == pet);
        }

        static void PaintChoice(Button b, bool on)
        {
            if (b == null) return;
            var img = b.GetComponent<Image>();
            if (img == null) return;
            var skin = UiArt.ButtonSprite(on ? UiArt.ButtonKind.Primary : UiArt.ButtonKind.Normal);
            if (skin != null)
            {
                img.sprite = skin;
                img.type = Image.Type.Sliced;
                img.color = Color.white;
            }
            else img.color = on ? Ui.ButtonHot : Ui.ButtonC;
            var press = b.GetComponent<UiPress>();
            if (press != null) press.Refresh();
        }

        static void Continue()
        {
            if (!GameManager.I.Continue())
            {
                ui.Toast("Save could not be loaded.");
                return;
            }
            var go = root;
            root = null;
            ui.FadeAndClose(go, null);
        }

        static void StartGame()
        {
            var r = new System.Random();
            var hero = HeroNames[r.Next(HeroNames.Length)];
            var petName = PetNames[r.Next(PetNames.Length)];
            var chosen = cls;
            var companion = pet;
            var go = root;
            root = null;
            ui.FadeAndClose(go, () => GameManager.I.NewGame(chosen, hero, companion, petName));
        }

        static string ClassName(HeroClass c) => c switch
        {
            HeroClass.Ironclad => "Ironclad",
            HeroClass.Stalker => "Stalker",
            _ => "Hexweaver",
        };

        static string ClassLine(HeroClass c) => c switch
        {
            HeroClass.Ironclad => "Strength · Fury\nA wall of iron that cleaves, slams and charges.",
            HeroClass.Stalker => "Dexterity · Focus\nBows, traps and tumbling. Strike before they arrive.",
            _ => "Intelligence · Arcana\nBolts, chain lightning, thralls and meteors.",
        };
    }

    /// <summary>Parallax key art, drifting fog, embers and a flickering torch. Uses drop-in
    /// layers when they exist, otherwise paints a night lake.</summary>
    public sealed class TitleAtmosphere : MonoBehaviour
    {
        struct Layer
        {
            public RectTransform rt;
            public float speed;
            public float amp;
        }

        readonly List<Layer> layers = new List<Layer>();
        RectTransform fog;
        readonly List<RectTransform> embers = new List<RectTransform>();
        readonly List<float> emberSeed = new List<float>();
        Image torch;
        float torchPhase;

        public static void Build(RectTransform parent)
        {
            var go = new GameObject("atmosphere", typeof(RectTransform));
            var rt = (RectTransform)go.transform;
            rt.SetParent(parent, false);
            rt.anchorMin = Vector2.zero;
            rt.anchorMax = Vector2.one;
            rt.offsetMin = rt.offsetMax = Vector2.zero;
            var at = go.AddComponent<TitleAtmosphere>();
            at.LayArt(rt);
            at.LayFog(rt);
            at.LayTorch(rt);
            at.LayEmbers(rt);
        }

        void LayArt(RectTransform parent)
        {
            var art = UiArt.Layers;
            if (art != null)
            {
                int added = 0;
                for (int i = 0; i < art.Count; i++)
                {
                    if (art[i] == null) continue;
                    var rt = Stretch(parent, "layer" + i, 36f + i * 18f);
                    var img = rt.gameObject.AddComponent<Image>();
                    img.sprite = art[i];
                    img.preserveAspect = false;
                    img.raycastTarget = false;
                    layers.Add(new Layer { rt = rt, speed = 0.07f + i * 0.035f, amp = 10f + i * 14f });
                    added++;
                }
                if (added > 0) return;
            }
            PaintLayer(parent, "sky", Sky(), 0, 8f);
            PaintLayer(parent, "ridge", Ridge(), 1, 16f);
            PaintLayer(parent, "lake", Lake(), 2, 22f);
            PaintLayer(parent, "fore", Fore(), 3, 30f);
        }

        void PaintLayer(RectTransform parent, string name, Sprite sprite, int i, float amp)
        {
            var rt = Stretch(parent, name, 20f + amp);
            var img = rt.gameObject.AddComponent<Image>();
            img.sprite = sprite;
            img.raycastTarget = false;
            layers.Add(new Layer { rt = rt, speed = 0.07f + i * 0.04f, amp = amp });
        }

        void LayFog(RectTransform parent)
        {
            fog = Stretch(parent, "fog", 80f);
            var img = fog.gameObject.AddComponent<Image>();
            img.sprite = UiArt.Fog != null ? UiArt.Fog : UiArt.Soft();
            img.color = new Color(0.75f, 0.8f, 0.9f, UiArt.Fog != null ? 0.55f : 0.18f);
            img.raycastTarget = false;
            if (UiArt.Fog == null)
            {
                fog.anchorMin = new Vector2(-0.2f, 0.28f);
                fog.anchorMax = new Vector2(1.4f, 0.62f);
            }
        }

        void LayTorch(RectTransform parent)
        {
            var rt = Ui.Rect(parent, "torch", new Vector2(0.34f, 0.22f), new Vector2(0.34f, 0.22f));
            rt.sizeDelta = new Vector2(280, 280);
            torch = rt.gameObject.AddComponent<Image>();
            torch.sprite = UiArt.Soft();
            torch.color = new Color(1f, 0.62f, 0.28f, 0.45f);
            torch.raycastTarget = false;
        }

        void LayEmbers(RectTransform parent)
        {
            for (int i = 0; i < 16; i++)
            {
                var rt = Ui.Rect(parent, "ember", new Vector2(0, 0), new Vector2(0, 0));
                rt.sizeDelta = new Vector2(10 + (i % 4) * 4, 10 + (i % 3) * 5);
                var img = rt.gameObject.AddComponent<Image>();
                img.sprite = UiArt.Soft();
                img.color = new Color(1f, 0.72f, 0.35f, 0.8f);
                img.raycastTarget = false;
                embers.Add(rt);
                emberSeed.Add(i * 1.7f);
            }
        }

        void Update()
        {
            float time = Time.unscaledTime;
            foreach (var layer in layers)
            {
                if (layer.rt == null) continue;
                float x = Mathf.Sin(time * layer.speed) * layer.amp;
                float y = Mathf.Sin(time * layer.speed * 0.6f + 1.2f) * 4f;
                layer.rt.anchoredPosition = new Vector2(x, y);
            }
            if (fog != null)
            {
                var p = fog.anchoredPosition;
                p.x = Mathf.Repeat(time * 18f, 160f) - 80f;
                fog.anchoredPosition = p;
            }
            if (torch != null)
            {
                torchPhase += Time.unscaledDeltaTime;
                float n = Mathf.PerlinNoise(torchPhase * 3.1f, 0.4f);
                float a = 0.28f + n * 0.38f;
                var c = torch.color;
                c.a = a;
                torch.color = c;
                float s = 0.92f + n * 0.18f;
                torch.rectTransform.localScale = new Vector3(s, s, 1f);
            }
            var area = (RectTransform)transform;
            for (int i = 0; i < embers.Count; i++)
            {
                float u = Mathf.Repeat(time * (0.06f + (i % 5) * 0.015f) + emberSeed[i] * 0.05f, 1f);
                float x = Mathf.Repeat(emberSeed[i] * 0.17f + Mathf.Sin(time * 0.3f + i) * 0.04f, 1f);
                var rt = embers[i];
                rt.anchorMin = rt.anchorMax = new Vector2(x, u);
                var img = rt.GetComponent<Image>();
                var col = img.color;
                col.a = Mathf.Sin(u * Mathf.PI) * 0.85f;
                img.color = col;
            }
        }

        static RectTransform Stretch(RectTransform parent, string name, float bleed)
        {
            return Ui.Rect(parent, name, Vector2.zero, Vector2.one, new Vector2(-bleed, -bleed), new Vector2(bleed, bleed));
        }

        static Sprite Sky()
        {
            const int w = 320, h = 180;
            var tex = NewTex(w, h);
            for (int y = 0; y < h; y++)
            {
                float t = y / (float)(h - 1);
                Color c = Color.Lerp(new Color(0.05f, 0.03f, 0.09f), new Color(0.22f, 0.10f, 0.28f), Mathf.Pow(t, 0.7f));
                c = Color.Lerp(c, new Color(0.10f, 0.16f, 0.22f), Mathf.Clamp01((t - 0.55f) * 2.2f));
                for (int x = 0; x < w; x++) tex.SetPixel(x, y, c);
            }
            var rng = new System.Random(11);
            for (int i = 0; i < 70; i++)
            {
                int x = rng.Next(w), y = rng.Next(h / 2, h);
                float a = 0.35f + (float)rng.NextDouble() * 0.65f;
                tex.SetPixel(x, y, new Color(1f, 0.95f, 0.85f, a));
            }
            FillCircle(tex, 250, 140, 18, new Color(0.95f, 0.9f, 0.75f, 1f));
            FillCircle(tex, 250, 140, 36, new Color(0.95f, 0.85f, 0.55f, 0.18f));
            tex.Apply();
            return Sprite.Create(tex, new Rect(0, 0, w, h), new Vector2(0.5f, 0.5f));
        }

        static Sprite Ridge()
        {
            const int w = 320, h = 180;
            var tex = NewTex(w, h);
            Clear(tex);
            for (int x = 0; x < w; x++)
            {
                float hill = 70 + Mathf.Sin(x * 0.04f) * 16 + Mathf.Sin(x * 0.01f) * 10;
                int tower = (x > 108 && x < 132) ? 78 : 0;
                if (x > 112 && x < 128 && ((x / 4) % 2 == 0)) tower += 6;
                for (int y = 0; y < h; y++)
                {
                    if (y > hill + tower) continue;
                    float shade = 0.08f + (y / hill) * 0.05f;
                    tex.SetPixel(x, y, new Color(shade, shade * 0.85f, shade * 1.1f, 1f));
                }
                if (x == 120) FillCircle(tex, 120, (int)hill + 40, 3, new Color(1f, 0.72f, 0.35f, 0.9f));
            }
            tex.Apply();
            return Sprite.Create(tex, new Rect(0, 0, w, h), new Vector2(0.5f, 0.5f));
        }

        static Sprite Lake()
        {
            const int w = 320, h = 180;
            var tex = NewTex(w, h);
            Clear(tex);
            for (int y = 0; y < 78; y++)
            {
                float t = y / 78f;
                Color c = Color.Lerp(new Color(0.03f, 0.05f, 0.08f, 0.95f), new Color(0.08f, 0.12f, 0.16f, 0.9f), t);
                for (int x = 0; x < w; x++)
                {
                    if (Mathf.Abs(x - 250) < 6 && y > 20 && y < 60)
                        c = Color.Lerp(c, new Color(0.85f, 0.8f, 0.6f, 0.35f), 0.45f);
                    tex.SetPixel(x, y, c);
                }
            }
            var rng = new System.Random(3);
            for (int i = 0; i < 9; i++)
            {
                int x = 180 + i * 14;
                FillRect(tex, x, 70, 10, 8, new Color(0.12f, 0.08f, 0.07f, 1f));
                FillRect(tex, x + 3, 74, 2, 3, new Color(1f, 0.75f, 0.4f, 0.8f));
            }
            tex.Apply();
            return Sprite.Create(tex, new Rect(0, 0, w, h), new Vector2(0.5f, 0.5f));
        }

        static Sprite Fore()
        {
            const int w = 320, h = 180;
            var tex = NewTex(w, h);
            Clear(tex);
            for (int x = 40; x < 200; x++)
                for (int y = 8; y < 28; y++)
                    tex.SetPixel(x, y, new Color(0.18f, 0.12f, 0.08f, 0.95f));
            for (int i = 0; i < 6; i++)
                FillRect(tex, 48 + i * 26, 10, 3, 22, new Color(0.28f, 0.18f, 0.1f, 1f));
            FillRect(tex, 108, 0, 6, 46, new Color(0.22f, 0.14f, 0.08f, 1f));
            FillCircle(tex, 111, 50, 5, new Color(1f, 0.55f, 0.2f, 0.95f));
            tex.Apply();
            return Sprite.Create(tex, new Rect(0, 0, w, h), new Vector2(0.5f, 0.5f));
        }

        static Texture2D NewTex(int w, int h)
        {
            return new Texture2D(w, h, TextureFormat.RGBA32, false) { filterMode = FilterMode.Bilinear, wrapMode = TextureWrapMode.Clamp };
        }

        static void Clear(Texture2D tex)
        {
            var px = tex.GetPixels32();
            for (int i = 0; i < px.Length; i++) px[i] = new Color32(0, 0, 0, 0);
            tex.SetPixels32(px);
        }

        static void FillCircle(Texture2D tex, int cx, int cy, int r, Color c)
        {
            for (int y = cy - r; y <= cy + r; y++)
                for (int x = cx - r; x <= cx + r; x++)
                {
                    if (x < 0 || y < 0 || x >= tex.width || y >= tex.height) continue;
                    if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r)
                        tex.SetPixel(x, y, Color.Lerp(tex.GetPixel(x, y), c, c.a));
                }
        }

        static void FillRect(Texture2D tex, int x0, int y0, int w, int h, Color c)
        {
            for (int y = y0; y < y0 + h; y++)
                for (int x = x0; x < x0 + w; x++)
                    if (x >= 0 && y >= 0 && x < tex.width && y < tex.height) tex.SetPixel(x, y, c);
        }
    }
}
