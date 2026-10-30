using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEngine;

namespace Hollowmere.Editor
{
    /// <summary>Points Resources/UiDropIn at whatever was dropped in Assets/Art/UI and Assets/Audio/UI.</summary>
    public sealed class UiDropInBind : IPreprocessBuildWithReport
    {
        public int callbackOrder => -20;

        public void OnPreprocessBuild(BuildReport report) => Bind();

        [MenuItem("Hollowmere/Bind UI drop-in art")]
        public static void Bind()
        {
            const string path = "Assets/Resources/UiDropIn.asset";
            var cat = AssetDatabase.LoadAssetAtPath<UiDropIn>(path);
            if (cat == null)
            {
                if (!AssetDatabase.IsValidFolder("Assets/Resources")) AssetDatabase.CreateFolder("Assets", "Resources");
                cat = ScriptableObject.CreateInstance<UiDropIn>();
                AssetDatabase.CreateAsset(cat, path);
            }
            ApplyListedSlices();
            cat.logo = Sprite("Assets/Art/UI/logo.png");
            cat.fog = Sprite("Assets/Art/UI/keyart_bg_fog.png");
            cat.keyart = Layers();
            cat.buttonNormal = Sprite("Assets/Art/UI/button_normal.png");
            cat.buttonPressed = Sprite("Assets/Art/UI/button_pressed.png");
            cat.buttonPrimary = Sprite("Assets/Art/UI/button_primary.png");
            cat.buttonDisabled = Sprite("Assets/Art/UI/button_disabled.png");
            cat.labelFont = AssetDatabase.LoadAssetAtPath<Font>("Assets/Art/UI/Fonts/Cinzel-Bold.ttf");
            cat.panel = Sprite("Assets/Art/UI/panel.png") ?? Sprite("Assets/Art/UI/panel_bg.png") ?? FirstSprite("panel_*.png");
            cat.frame = Sprite("Assets/Art/UI/frame_gold.png") ?? FirstSprite("frame_*.png");
            cat.iconBag = Sprite("Assets/Art/UI/icon_bag.png");
            cat.iconSkills = Sprite("Assets/Art/UI/icon_skills.png");
            cat.iconPet = Sprite("Assets/Art/UI/icon_pet.png");
            cat.iconMenu = Sprite("Assets/Art/UI/icon_menu.png");
            cat.titleTheme = Clip("title_theme");
            cat.titleSting = Clip("title_sting");
            cat.uiClick = Clip("ui_click");
            cat.uiClick2 = Clip("ui_click_2");
            cat.uiConfirm = Clip("ui_confirm");
            cat.uiBack = Clip("ui_back");
            cat.uiPanelOpen = Clip("ui_panel_open");
            cat.uiPanelClose = Clip("ui_panel_close");
            cat.uiStartGame = Clip("ui_start_game");
            cat.hexboltCast = Sfx("hexbolt_cast");
            cat.hexboltImpact = Sfx("hexbolt_impact");
            EditorUtility.SetDirty(cat);
            AssetDatabase.SaveAssets();
        }

        static Sprite FirstSprite(string pattern)
        {
            var dir = "Assets/Art/UI";
            if (!Directory.Exists(dir)) return null;
            var file = Directory.GetFiles(dir, pattern).OrderBy(p => p).FirstOrDefault();
            return file == null ? null : Sprite(file.Replace('\\', '/'));
        }

        static Sprite[] Layers()
        {
            var named = new[] { "keyart_bg_far.png", "keyart_bg_mid.png", "keyart_bg_near.png" };
            var ordered = named.Select(n => Sprite("Assets/Art/UI/" + n)).Where(s => s != null).ToArray();
            if (ordered.Length > 0) return ordered;
            var dir = "Assets/Art/UI";
            if (!Directory.Exists(dir)) return new Sprite[0];
            return Directory.GetFiles(dir, "keyart_bg_*.png")
                .Select(p => p.Replace('\\', '/'))
                .Where(p => !p.Contains("fog") && !p.Contains("mockup"))
                .OrderBy(p => p)
                .Select(Sprite)
                .Where(s => s != null)
                .ToArray();
        }

        /// <summary>ui_slices.json stores left, right, top, bottom. Unity's sprite border is L, B, R, T.</summary>
        static void ApplyListedSlices()
        {
            var jsonPath = "Assets/Art/UI/ui_slices.json";
            if (!File.Exists(jsonPath)) return;
            var text = File.ReadAllText(jsonPath);
            foreach (Match m in Regex.Matches(text, "\"([^\"]+\\.png)\"\\s*:\\s*\\{([^}]*)\\}"))
            {
                var body = m.Groups[2].Value;
                if (!body.Contains("\"left\"")) continue;
                ApplyBorder("Assets/Art/UI/" + m.Groups[1].Value, new Vector4(
                    Prop(body, "left"), Prop(body, "bottom"), Prop(body, "right"), Prop(body, "top")));
            }
            foreach (Match m in Regex.Matches(text, "\"([^\"]+\\.png)\"\\s*:\\s*\\[\\s*([\\d.]+)\\s*,\\s*([\\d.]+)\\s*,\\s*([\\d.]+)\\s*,\\s*([\\d.]+)\\s*\\]"))
            {
                ApplyBorder("Assets/Art/UI/" + m.Groups[1].Value, new Vector4(
                    float.Parse(m.Groups[2].Value, CultureInfo.InvariantCulture),
                    float.Parse(m.Groups[3].Value, CultureInfo.InvariantCulture),
                    float.Parse(m.Groups[4].Value, CultureInfo.InvariantCulture),
                    float.Parse(m.Groups[5].Value, CultureInfo.InvariantCulture)));
            }
        }

        static float Prop(string body, string key)
        {
            var m = Regex.Match(body, "\"" + key + "\"\\s*:\\s*([\\d.]+)");
            return m.Success ? float.Parse(m.Groups[1].Value, CultureInfo.InvariantCulture) : 0f;
        }

        static void ApplyBorder(string asset, Vector4 border)
        {
            if (!File.Exists(asset)) return;
            var importer = AssetImporter.GetAtPath(asset) as TextureImporter;
            if (importer == null) return;
            bool changed = false;
            if (importer.textureType != TextureImporterType.Sprite)
            {
                importer.textureType = TextureImporterType.Sprite;
                importer.spriteImportMode = SpriteImportMode.Single;
                importer.alphaIsTransparency = true;
                importer.mipmapEnabled = false;
                changed = true;
            }
            if ((importer.spriteBorder - border).sqrMagnitude > 0.01f)
            {
                importer.spriteBorder = border;
                changed = true;
            }
            if (changed) importer.SaveAndReimport();
        }

        static Sprite Sprite(string path)
        {
            foreach (var asset in AssetDatabase.LoadAllAssetsAtPath(path))
                if (asset is Sprite sprite) return sprite;
            return AssetDatabase.LoadAssetAtPath<Sprite>(path);
        }

        static AudioClip Clip(string name)
        {
            foreach (var ext in new[] { ".ogg", ".wav", ".mp3" })
            {
                var clip = AssetDatabase.LoadAssetAtPath<AudioClip>("Assets/Audio/UI/" + name + ext);
                if (clip != null) return clip;
            }
            return null;
        }

        static AudioClip Sfx(string name)
        {
            foreach (var ext in new[] { ".ogg", ".wav", ".mp3" })
            {
                var clip = AssetDatabase.LoadAssetAtPath<AudioClip>("Assets/Audio/SFX/" + name + ext);
                if (clip != null) return clip;
            }
            return null;
        }
    }
}
