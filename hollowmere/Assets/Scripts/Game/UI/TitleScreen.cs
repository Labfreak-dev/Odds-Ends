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
        static RectTransform mainPage, createPage, settingsPage;
        static Text blurb;
        static readonly List<(HeroClass cls, Button button)> classes = new List<(HeroClass, Button)>();
        static readonly List<(PetSpecies pet, Button button)> pets = new List<(PetSpecies, Button)>();
        static bool onCreate;
        static Button cornerBack;

        public static void Show(UiRoot rootUi)
        {
            ui = rootUi;
            AudioHub.PlayTitle();
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
            settingsPage = BuildSettings(safe);
            createPage.gameObject.SetActive(false);
            settingsPage.gameObject.SetActive(false);
            cornerBack = Ui.Button(safe, "Back", OpenMain, null, 26, UiSfx.Back);
            var backRt = (RectTransform)cornerBack.transform;
            backRt.anchorMin = backRt.anchorMax = new Vector2(0f, 1f);
            backRt.pivot = new Vector2(0f, 1f);
            backRt.sizeDelta = new Vector2(220f, 72f);
            backRt.anchoredPosition = new Vector2(36f, -28f);
            cornerBack.gameObject.SetActive(false);
            Slide(mainPage, new Vector2(0, -36f));
        }

        static void BuildLogo(RectTransform safe)
        {
            // Top band only. The button stack owns everything below 0.70, so the two
            // cannot overlap from 16:9 through 20:9. Slide() used to zero anchoredPosition,
            // which pulled a pixel-offset column back up onto the logo.
            var logo = Ui.Rect(safe, "logo", new Vector2(0.16f, 0.72f), new Vector2(0.84f, 0.98f));
            var sprite = UiArt.Logo;
            if (sprite != null)
            {
                var img = logo.gameObject.AddComponent<Image>();
                img.sprite = sprite;
                img.preserveAspect = true;
                img.raycastTarget = false;
            }
            else Ui.Label(logo, "<b>HOLLOWMERE</b>", 72, TextAnchor.MiddleCenter, Ui.Gold);
        }

        static RectTransform Card(RectTransform safe, string name)
        {
            var card = Ui.Rect(safe, name, new Vector2(0.14f, 0.04f), new Vector2(0.86f, 0.68f));
            Ui.Box(card, new Color(0.04f, 0.05f, 0.07f, 0.72f));
            return card;
        }

        static RectTransform BuildMain(RectTransform safe)
        {
            var col = Ui.Rect(safe, "main", new Vector2(0.31f, 0.05f), new Vector2(0.69f, 0.68f));
            var vl = col.gameObject.AddComponent<VerticalLayoutGroup>();
            vl.spacing = 18f;
            vl.childAlignment = TextAnchor.MiddleCenter;
            vl.childControlHeight = true;
            vl.childControlWidth = true;
            vl.childForceExpandHeight = false;
            vl.childForceExpandWidth = true;

            if (GameManager.HasSave)
            {
                var cont = Ui.Button(col, "CONTINUE", Continue, null, 36, UiSfx.Confirm, true);
                Ui.Size(cont, 144);
            }
            var neu = Ui.Button(col, "NEW HERO", OpenCreate, null, 36, UiSfx.Click);
            Ui.Size(neu, 144);
            var settings = Ui.Button(col, "SETTINGS", OpenSettings, null, 36, UiSfx.Click);
            Ui.Size(settings, 144);
            var online = Ui.Button(col, "ONLINE", null, null, 36, UiSfx.None);
            Ui.Size(online, 144);
            online.interactable = false;
            var skin = UiArt.ButtonSprite(UiArt.ButtonKind.Disabled);
            var img = online.GetComponent<Image>();
            if (skin != null && img != null)
            {
                img.sprite = skin;
                img.type = Image.Type.Sliced;
                img.color = Color.white;
            }
            var colors = online.colors;
            colors.disabledColor = Color.white;
            online.colors = colors;
            return col;
        }

        static RectTransform BuildSettings(RectTransform safe)
        {
            var card = Card(safe, "settings");
            var col = Ui.Rect(card, "col", Vector2.zero, Vector2.one, new Vector2(36, 36), new Vector2(-36, -36));
            var vl = col.gameObject.AddComponent<VerticalLayoutGroup>();
            vl.spacing = 16f;
            vl.childControlHeight = true;
            vl.childControlWidth = true;
            vl.childForceExpandHeight = false;
            vl.childForceExpandWidth = true;
            var heading = Ui.Rect(col, "heading", Vector2.zero, Vector2.one);
            Ui.Label(heading, "<b>SETTINGS</b>", 36, TextAnchor.MiddleCenter, Ui.Gold);
            Ui.Size(heading, 64);
            var sound = Ui.Button(col, SoundLabel(), ToggleSound, null, 32);
            Ui.Size(sound, 120);
            var music = Ui.Button(col, MusicLabel(), ToggleMusic, null, 32);
            Ui.Size(music, 120);
            return card;
        }

        static string SoundLabel() => AudioHub.I != null && AudioHub.I.sfxVolume <= 0f ? "SOUND: OFF" : "SOUND: ON";
        static string MusicLabel() => AudioHub.I != null && AudioHub.I.musicVolume <= 0f ? "MUSIC: OFF" : "MUSIC: ON";

        static void ToggleSound()
        {
            if (AudioHub.I == null) return;
            AudioHub.SetVolumes(AudioHub.I.sfxVolume > 0f ? 0f : 0.8f, AudioHub.I.musicVolume);
            RefreshSettings();
        }

        static void ToggleMusic()
        {
            if (AudioHub.I == null) return;
            AudioHub.SetVolumes(AudioHub.I.sfxVolume, AudioHub.I.musicVolume > 0f ? 0f : 0.45f);
            RefreshSettings();
        }

        static void RefreshSettings()
        {
            if (settingsPage == null) return;
            var buttons = settingsPage.GetComponentsInChildren<Button>();
            foreach (var b in buttons)
            {
                var text = b.GetComponentInChildren<Text>();
                if (text == null) continue;
                if (text.text.StartsWith("SOUND")) text.text = SoundLabel();
                else if (text.text.StartsWith("MUSIC")) text.text = MusicLabel();
            }
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

            var row = Ui.Row(col, 200, 10);
            foreach (HeroClass c in Enum.GetValues(typeof(HeroClass)))
            {
                var cc = c;
                var b = Ui.Button(row, $"<b>{ClassName(cc)}</b>", () => SelectClass(cc), null, 26);
                b.GetComponentInChildren<Text>().alignment = TextAnchor.LowerCenter;
                var icon = UiArt.Icon(cc == HeroClass.Ironclad ? "shield" : cc == HeroClass.Stalker ? "sword" : "gem");
                if (icon != null)
                {
                    var slot = Ui.Rect(b.transform, "portrait", new Vector2(0.5f, 0.68f), new Vector2(0.5f, 0.68f));
                    slot.sizeDelta = new Vector2(84f, 84f);
                    var ii = slot.gameObject.AddComponent<Image>();
                    ii.sprite = icon;
                    ii.preserveAspect = true;
                    ii.raycastTarget = false;
                }
                classes.Add((cc, b));
            }
            var blurbRt = Ui.Rect(col, "blurb", Vector2.zero, Vector2.one);
            blurb = Ui.Label(blurbRt, "", 24, TextAnchor.MiddleCenter, new Color(0.86f, 0.82f, 0.74f));
            Ui.Size(blurbRt, 88);

            var petRow = Ui.Row(col, 72, 10);
            pets.Add((PetSpecies.Hound, Ui.Button(petRow, "Hound", () => SelectPet(PetSpecies.Hound), null, 26)));
            pets.Add((PetSpecies.Lynx, Ui.Button(petRow, "Lynx", () => SelectPet(PetSpecies.Lynx), null, 26)));

            var begin = Ui.Button(col, "Begin", StartGame, new Color(0.75f, 0.55f, 0.22f), 36, UiSfx.None, true);
            Ui.Size(begin, 96);
            Paint();
            return card;
        }

        static void OpenCreate()
        {
            if (onCreate) return;
            onCreate = true;
            mainPage.gameObject.SetActive(false);
            settingsPage.gameObject.SetActive(false);
            createPage.gameObject.SetActive(true);
            if (cornerBack != null) cornerBack.gameObject.SetActive(true);
            Slide(createPage, new Vector2(72f, 0f));
        }

        static void OpenSettings()
        {
            onCreate = false;
            mainPage.gameObject.SetActive(false);
            createPage.gameObject.SetActive(false);
            settingsPage.gameObject.SetActive(true);
            if (cornerBack != null) cornerBack.gameObject.SetActive(true);
            RefreshSettings();
            Slide(settingsPage, new Vector2(0f, -28f));
        }

        static void OpenMain()
        {
            onCreate = false;
            createPage.gameObject.SetActive(false);
            settingsPage.gameObject.SetActive(false);
            if (cornerBack != null) cornerBack.gameObject.SetActive(false);
            mainPage.gameObject.SetActive(true);
            Slide(mainPage, new Vector2(0f, -28f));
        }

        static void Slide(RectTransform page, Vector2 delta)
        {
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
            AudioHub.Play("ui_start_game", 1f);
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
        bool hasArt;

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
            if (!at.hasArt)
            {
                at.LayFog(rt);
                at.LayTorch(rt);
                at.LayEmbers(rt);
            }
        }

        void LayArt(RectTransform parent)
        {
            var art = UiArt.Layers;
            if (art != null)
            {
                // Far, mid, near. The bleed lets a ±40 px drift stay inside the frame.
                float[] speeds = { 0.1f, 0.35f, 0.7f };
                int added = 0;
                for (int i = 0; i < art.Count; i++)
                {
                    if (art[i] == null) continue;
                    var rt = Stretch(parent, "layer" + i, 48f);
                    var img = rt.gameObject.AddComponent<Image>();
                    img.sprite = art[i];
                    img.preserveAspect = false;
                    img.raycastTarget = false;
                    float speed = i < speeds.Length ? speeds[i] : speeds[speeds.Length - 1];
                    layers.Add(new Layer { rt = rt, speed = speed, amp = 40f });
                    added++;
                }
                if (added > 0) { hasArt = true; return; }
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
