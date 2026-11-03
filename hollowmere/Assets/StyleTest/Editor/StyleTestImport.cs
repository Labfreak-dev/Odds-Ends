using System.IO;
using UnityEditor;
using UnityEngine;

namespace Hollowmere.StyleTestEditor
{
    /// <summary>Style test (free CC0 KayKit packs): characters and clips import as Legacy so one Animation
    /// component plays the shared Rig_Medium clips; props import without animation.</summary>
    public class StyleTestImport : AssetPostprocessor
    {
        public override uint GetVersion() => 4;
        void OnPreprocessModel()
        {
            if (!assetPath.Contains("/StyleTest/")) return;
            var mi = (ModelImporter)assetImporter;
            bool rigged = assetPath.Contains("/Anim/") || assetPath.Contains("/Chars/")
                || (assetPath.Contains("/Skel/Skeleton_") && !assetPath.Contains("Skeleton_Axe") && !assetPath.Contains("Skeleton_Blade")
                    && !assetPath.Contains("Skeleton_Staff") && !assetPath.Contains("Skeleton_Shield") && !assetPath.Contains("Skeleton_Crossbow"));
            bool folk = assetPath.Contains("/Folk/"), animals = assetPath.Contains("/Town/Animals/") || assetPath.Contains("/ST/Mon/") || assetPath.Contains("/STO/Mon/");
            rigged |= folk || animals;
            mi.animationType = rigged ? ModelImporterAnimationType.Legacy : ModelImporterAnimationType.None;
            mi.importAnimation = assetPath.Contains("/Anim/") || assetPath.Contains("/Folk/UAL") || animals;
            if (folk) mi.isReadable = true;
            if (assetPath.Contains("/Town/")) { mi.isReadable = assetPath.Contains("/Town/Hex/"); mi.meshCompression = ModelImporterMeshCompression.Medium; }
            mi.importBlendShapes = false;
            mi.importCameras = false; mi.importLights = false;
            mi.materialImportMode = ModelImporterMaterialImportMode.ImportViaMaterialDescription;
        }

        /// <summary>Weighted attack clips (Rig_Medium_HMAttacks.fbx, Blender export): keep only bone curves. The exporter bakes the
        /// armature node's own transform into every take; on a hero that would overwrite the normalised rig/root scale.</summary>
        void OnPostprocessAnimation(GameObject root, AnimationClip clip)
        {
            if (!assetPath.Contains("/StyleTest/") || !assetPath.Contains("HMAttacks")) return;
            foreach (var b in AnimationUtility.GetCurveBindings(clip))
                if (b.type == typeof(Transform) && (b.path == "" || b.path == "Rig_Medium" || b.path == "hm_anchor"))
                    AnimationUtility.SetEditorCurve(clip, b, null);
        }
    }

    /// <summary>Town/Folk textures: VK (algumacoisaqq) base maps are sRGB colour; owned 2D packs keep alpha; pixel art stays crisp.</summary>
    public class StyleTestTexImport : AssetPostprocessor
    {
        void OnPreprocessTexture()
        {
            if (!assetPath.Contains("/StyleTest/")) return;
            var ti = (TextureImporter)assetImporter;
            if (assetPath.Contains("/Folk/") || assetPath.Contains("/Town/")) ti.maxTextureSize = 1024;
            if (assetPath.Contains("/Owned/"))
            {
                ti.alphaIsTransparency = true; ti.mipmapEnabled = false; ti.maxTextureSize = 1024;
                ti.wrapMode = TextureWrapMode.Clamp;
                if (assetPath.Contains("/Pixel/") || assetPath.Contains("/BG/")) ti.filterMode = FilterMode.Point;
                ti.textureCompression = TextureImporterCompression.Uncompressed;
            }
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
