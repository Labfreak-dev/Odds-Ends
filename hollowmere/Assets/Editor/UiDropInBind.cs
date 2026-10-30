using System.Collections.Generic;
using System.IO;
using System.Linq;
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

        [MenuItem("Hollowmere/Bind title drop-in art")]
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
            cat.logo = Sprite("Assets/Art/UI/logo.png");
            cat.fog = Sprite("Assets/Art/UI/keyart_bg_fog.png");
            cat.keyart = Layers();
            cat.buttonNormal = Sprite("Assets/Art/UI/button_normal.png");
            cat.buttonPressed = Sprite("Assets/Art/UI/button_pressed.png");
            cat.buttonPrimary = Sprite("Assets/Art/UI/button_primary.png");
            cat.titleTheme = Clip("title_theme");
            cat.uiClick = Clip("ui_click");
            cat.uiConfirm = Clip("ui_confirm");
            cat.uiBack = Clip("ui_back");
            EditorUtility.SetDirty(cat);
            AssetDatabase.SaveAssets();
        }

        static Sprite[] Layers()
        {
            var dir = "Assets/Art/UI";
            if (!Directory.Exists(dir)) return new Sprite[0];
            return Directory.GetFiles(dir, "keyart_bg_*.png")
                .Select(p => p.Replace('\\', '/'))
                .Where(p => !p.Contains("fog"))
                .OrderBy(p => p)
                .Select(Sprite)
                .Where(s => s != null)
                .ToArray();
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
    }
}
