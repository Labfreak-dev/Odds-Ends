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
        static PetSpecies pet = PetSpecies.Hound;
        static int body, skin, hair, face, armour, plate;
        static readonly string[] HeroNames = { "Aldric", "Maren", "Tobin", "Wren", "Corvin", "Isolde", "Bram", "Sela" };
        static readonly string[] PetNames = { "Biscuit", "Pickles", "Bramble", "Soot", "Mossy", "Pepper" };
        static readonly string[] BodyNames = { "Lean", "Balanced", "Broad" };
        static readonly string[] FaceNames = { "Calm", "Stern", "Scarred", "Bright" };
        static readonly string[] PlateNames = { "Cloth", "Plate" };

        static GameObject root;
        static UiRoot ui;
        static RectTransform mainPage, createPage, settingsPage;
        static Text blurb;
        static InputField nameField;
        static readonly List<Button> bodyButtons = new List<Button>();
        static readonly List<Button> skinButtons = new List<Button>();
        static readonly List<Button> hairButtons = new List<Button>();
        static readonly List<Button> faceButtons = new List<Button>();
        static readonly List<Button> armourButtons = new List<Button>();
        static readonly List<Button> plateButtons = new List<Button>();
        static readonly List<(PetSpecies pet, Button button)> pets = new List<(PetSpecies, Button)>();
        static bool onCreate;
        static Button cornerBack;
        static HeroStage stage;
        static RawImage stageView;

        public static void Show(UiRoot rootUi)
        {
            ui = rootUi;
            AudioHub.PlayTitle();
            if (root != null) return;
            onCreate = false;
            bodyButtons.Clear();
            skinButtons.Clear();
            hairButtons.Clear();
            faceButtons.Clear();
            armourButtons.Clear();
            plateButtons.Clear();
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
            var shake = Ui.Button(col, ShakeLabel(), ToggleShake, null, 32);
            Ui.Size(shake, 120);
            var credits = Ui.Button(col, "CREDITS", () => CreditsScreen.Show(ui), null, 32);
            Ui.Size(credits, 120);
            return card;
        }

        static string SoundLabel() => AudioHub.I != null && AudioHub.I.sfxVolume <= 0f ? "SOUND: OFF" : "SOUND: ON";
        static string MusicLabel() => AudioHub.I != null && AudioHub.I.musicVolume <= 0f ? "MUSIC: OFF" : "MUSIC: ON";
        static string ShakeLabel() => CombatClock.ShakeEnabled ? "SHAKE: ON" : "SHAKE: OFF";

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

        static void ToggleShake()
        {
            CombatClock.ShakeEnabled = !CombatClock.ShakeEnabled;
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
                else if (text.text.StartsWith("SHAKE")) text.text = ShakeLabel();
            }
        }

        static RectTransform BuildCreate(RectTransform safe)
        {
            var card = Card(safe, "create");
            card.anchorMin = new Vector2(0.02f, 0.03f);
            card.anchorMax = new Vector2(0.58f, 0.70f);
            var col = Ui.Rect(card, "col", Vector2.zero, Vector2.one, new Vector2(16, 16), new Vector2(-16, -16));
            var list = Ui.Scroll(col, 8);

            nameField = NameBox(list);
            ChoiceRow(list, "Body", BodyNames, bodyButtons, i => { body = i; Paint(); });
            SwatchRow(list, "Skin", Art.SkinTints, skinButtons, i => { skin = i; Paint(); });
            SwatchRow(list, "Hair", Art.HairTints, hairButtons, i => { hair = i; Paint(); });
            ChoiceRow(list, "Face", FaceNames, faceButtons, i => { face = i; Paint(); });
            SwatchRow(list, "Armour", Art.ArmourTints, armourButtons, i => { armour = i; Paint(); });
            ChoiceRow(list, "Plate", PlateNames, plateButtons, i => { plate = i; Paint(); });
            var blurbRt = Ui.Rect(list, "blurb", Vector2.zero, Vector2.one);
            blurb = Ui.Label(blurbRt, "", 20, TextAnchor.UpperLeft, new Color(0.9f, 0.86f, 0.76f));
            Ui.Size(blurbRt, 88);

            var petRow = Ui.Row(list, 56, 8);
            pets.Add((PetSpecies.Hound, Ui.Button(petRow, "Hound", () => SelectPet(PetSpecies.Hound), null, 26)));
            pets.Add((PetSpecies.Lynx, Ui.Button(petRow, "Lynx", () => SelectPet(PetSpecies.Lynx), null, 26)));

            var begin = Ui.Button(list, "Begin", StartGame, new Color(0.75f, 0.55f, 0.22f), 36, UiSfx.None, true);
            Ui.Size(begin, 84);
            Paint();

            var view = Ui.Rect(safe, "stageView", new Vector2(0.60f, 0.08f), new Vector2(0.98f, 0.68f));
            stageView = view.gameObject.AddComponent<RawImage>();
            stageView.raycastTarget = false;
            stageView.color = Color.white;
            stageView.gameObject.SetActive(false);
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
            EnsureStage();
        }

        /// <summary>Used by -qaShot newhero.</summary>
        public static void ShowNewHero()
        {
            if (root == null) return;
            OpenCreate();
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
            if (stage != null) stage.gameObject.SetActive(false);
            if (stageView != null) stageView.gameObject.SetActive(false);
            Slide(mainPage, new Vector2(0f, -28f));
        }

        static void Slide(RectTransform page, Vector2 delta)
        {
            var motion = page.GetComponent<UiMenuMotion>() ?? page.gameObject.AddComponent<UiMenuMotion>();
            motion.Arm(page, delta);
        }

        static InputField NameBox(Transform parent)
        {
            var rt = Ui.Rect(parent, "name", Vector2.zero, Vector2.one);
            var le = rt.gameObject.AddComponent<LayoutElement>();
            le.minHeight = le.preferredHeight = 58f;
            var img = rt.gameObject.AddComponent<Image>();
            img.color = new Color(0.12f, 0.1f, 0.08f, 1f);
            var text = Ui.Label(rt, "", 28, TextAnchor.MiddleLeft);
            text.supportRichText = false;
            text.raycastTarget = true;
            var field = rt.gameObject.AddComponent<InputField>();
            field.textComponent = text;
            field.text = HeroNames[0];
            return field;
        }

        static void ChoiceRow(Transform col, string label, string[] names, List<Button> into, Action<int> pick)
        {
            var row = Ui.Row(col, 48, 6);
            var caption = Ui.Label(row, label, 20, TextAnchor.MiddleLeft, Ui.Gold);
            Ui.Size(caption, -1, 118, 0);
            for (int i = 0; i < names.Length; i++)
            {
                int n = i;
                var b = Ui.Button(row, names[i], () => pick(n), null, 20);
                Ui.Size(b, -1, -1, 1);
                into.Add(b);
            }
        }

        static void SwatchRow(Transform col, string label, Color[] colors, List<Button> into, Action<int> pick)
        {
            var row = Ui.Row(col, 48, 6);
            var caption = Ui.Label(row, label, 20, TextAnchor.MiddleLeft, Ui.Gold);
            Ui.Size(caption, -1, 118, 0);
            for (int i = 0; i < colors.Length; i++)
            {
                int n = i;
                var b = Ui.Button(row, "", () => pick(n), colors[i], 18);
                var img = b.GetComponent<Image>();
                if (img != null)
                {
                    img.sprite = null;
                    img.type = Image.Type.Simple;
                    img.color = colors[i];
                }
                Ui.Size(b, -1, -1, 1);
                into.Add(b);
            }
        }

        static void ShowStage()
        {
            if (stage == null) return;
            var s = Art.SkinTints[Mathf.Clamp(skin, 0, Art.SkinTints.Length - 1)];
            var h = Art.HairTints[Mathf.Clamp(hair, 0, Art.HairTints.Length - 1)];
            var a = Art.ArmourTints[Mathf.Clamp(armour, 0, Art.ArmourTints.Length - 1)];
            stage.SetLook(plate > 0, s, Art.ClothTint(body), h, a, pet);
        }

        static void SelectPet(PetSpecies p)
        {
            pet = p;
            Paint();
        }

        static void Paint()
        {
            if (blurb != null)
                blurb.text = $"{BodyNames[body]} · {FaceNames[face]}\nOne hero. The weapon in hand sets the attack. Skills come from loot.\n" + PetSheet(pet);
            if (onCreate && stage != null) ShowStage();
            PaintMarks(bodyButtons, body);
            PaintSwatches(skinButtons, Art.SkinTints, skin);
            PaintSwatches(hairButtons, Art.HairTints, hair);
            PaintMarks(faceButtons, face);
            PaintSwatches(armourButtons, Art.ArmourTints, armour);
            PaintMarks(plateButtons, plate);
            foreach (var (p, b) in pets) PaintChoice(b, p == pet);
        }

        static void EnsureStage()
        {
            if (stageView == null) return;
            if (stage == null) stage = HeroStage.Create(stageView);
            stage.gameObject.SetActive(true);
            stageView.gameObject.SetActive(true);
            ShowStage();
        }

        static void DropStage()
        {
            if (stage == null) return;
            UnityEngine.Object.Destroy(stage.gameObject);
            stage = null;
        }

        static void PaintMarks(List<Button> buttons, int on)
        {
            for (int i = 0; i < buttons.Count; i++) PaintChoice(buttons[i], i == on);
        }

        static void PaintSwatches(List<Button> buttons, Color[] colors, int on)
        {
            for (int i = 0; i < buttons.Count && i < colors.Length; i++)
            {
                var img = buttons[i] != null ? buttons[i].GetComponent<Image>() : null;
                if (img == null) continue;
                img.sprite = null;
                img.type = Image.Type.Simple;
                var c = colors[i];
                img.color = i == on ? c : new Color(c.r * 0.45f, c.g * 0.45f, c.b * 0.45f, 1f);
            }
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
            DropStage();
            ui.FadeAndClose(go, null);
        }

        static void StartGame()
        {
            var r = new System.Random();
            var hero = nameField != null ? nameField.text.Trim() : "";
            if (hero.Length == 0) hero = HeroNames[r.Next(HeroNames.Length)];
            if (hero.Length > 16) hero = hero.Substring(0, 16);
            var petName = PetNames[r.Next(PetNames.Length)];
            var companion = pet;
            int b = body, sk = skin, hr = hair, fc = face;
            var tint = Art.ArmourTints[Mathf.Clamp(armour, 0, Art.ArmourTints.Length - 1)];
            int plated = plate;
            var go = root;
            root = null;
            DropStage();
            AudioHub.Play("ui_start_game", 1f);
            ui.FadeAndClose(go, () => GameManager.I.NewGameCustom(hero, b, sk, hr, fc, tint.r, tint.g, tint.b, companion, petName, plated));
        }

        static string PetSheet(PetSpecies p) => p == PetSpecies.Hound
            ? "<b>Hound</b>  <color=#8fd48f>Easy</color>\nA sturdy biter that stays at your heel."
            : "<b>Lynx</b>  <color=#e6c35c>Medium</color>\nFaster and meaner, and easier to lose.";
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
