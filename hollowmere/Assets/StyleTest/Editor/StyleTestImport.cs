using System.IO;
using UnityEditor;
using UnityEngine;

namespace Hollowmere.StyleTestEditor
{
    /// <summary>Style test (free CC0 KayKit packs): characters and clips import as Legacy so one Animation
    /// component plays the shared Rig_Medium clips; props import without animation.</summary>
    public class StyleTestImport : AssetPostprocessor
    {
        void OnPreprocessModel()
        {
            if (!assetPath.Contains("/StyleTest/")) return;
            var mi = (ModelImporter)assetImporter;
            bool rigged = assetPath.Contains("/Anim/") || assetPath.Contains("/Chars/")
                || (assetPath.Contains("/Skel/Skeleton_") && !assetPath.Contains("Skeleton_Axe") && !assetPath.Contains("Skeleton_Blade")
                    && !assetPath.Contains("Skeleton_Staff") && !assetPath.Contains("Skeleton_Shield") && !assetPath.Contains("Skeleton_Crossbow"));
            mi.animationType = rigged ? ModelImporterAnimationType.Legacy : ModelImporterAnimationType.None;
            mi.importAnimation = assetPath.Contains("/Anim/");
            mi.importBlendShapes = false;
            mi.importCameras = false; mi.importLights = false;
            mi.materialImportMode = ModelImporterMaterialImportMode.ImportViaMaterialDescription;
        }
    }

    public static class StyleTestBuild
    {
        const string Flag = "Assets/StyleTest/Resources/ST/st_autoboot.txt";

        /// <summary>APK that boots straight into the style test (creator -> dungeon slice).</summary>
        public static void Android()
        {
            File.WriteAllText(Flag, "1");
            AssetDatabase.ImportAsset(Flag);
            string path = null; var a = System.Environment.GetCommandLineArgs();
            for (int i = 0; i < a.Length - 1; i++) if (a[i] == "-customBuildPath") path = a[i + 1];
            int code = Hollowmere.Editor.HollowmereBuild.Build(string.IsNullOrEmpty(path) ? "/tmp/hm_out/HollowmereStyleTest.apk" : path);
            AssetDatabase.DeleteAsset(Flag);
            EditorApplication.Exit(code);
        }
    }
}
