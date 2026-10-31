using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEngine;
using UnityEngine.Rendering;

namespace Hollowmere.Editor
{
    /// <summary>
    /// Before every player build, pin the shaders the phone actually draws so stripping cannot
    /// drop them. Runtime code loads materials from Resources and never Shader.Find's these.
    /// glTFast's URP shader graphs are found here, in the editor, where Shader.Find still sees
    /// package shaders, and then added to Always Included Shaders for the build.
    /// </summary>
    public sealed class HollowmereRenderSetup : IPreprocessBuildWithReport
    {
        public int callbackOrder => 0;

        static readonly string[] ShaderNames =
        {
            "Hollowmere/Color",
            "Hollowmere/Text",
            "Hollowmere/Glow",
            "Hollowmere/Sheet",
            "Hollowmere/Lit",
            "Hollowmere/Portal",
        };

        public void OnPreprocessBuild(BuildReport report)
        {
            // Do not ImportAsset, Refresh, or SaveAssets here. This callback runs inside
            // BuildPlayer. Reimporting a GLB at that point (and a failed glTFast import in
            // particular) corrupts the script compilation pipeline: EditorCompilation
            // throws InvalidCastException and the player build reports compiler errors
            // even though no script failed to compile. PrepareBeforePlayerBuild does the work.
        }

        /// <summary>Shader pin and GLB check, run from <see cref="HollowmereBuild"/> before BuildPlayer.</summary>
        public static void PrepareBeforePlayerBuild()
        {
            PinShaders(true);
            AdoptImportedModels();
        }

        static void PinShaders(bool save)
        {
            var gsAsset = AssetDatabase.LoadAllAssetsAtPath("ProjectSettings/GraphicsSettings.asset")[0];
            var gsSo = new SerializedObject(gsAsset);
            var gsProp = gsSo.FindProperty("m_AlwaysIncludedShaders");
            var included = new List<Shader>();
            for (int i = 0; i < gsProp.arraySize; i++) { var sh = gsProp.GetArrayElementAtIndex(i).objectReferenceValue as Shader; if (sh != null) included.Add(sh); }
            var added = 0;
            foreach (var name in ShaderNames)
            {
                var shader = Shader.Find(name);
                if (shader == null)
                {
                    Debug.LogWarning("Hollowmere: shader not found to include in the build: " + name);
                    continue;
                }
                if (included.Contains(shader)) continue;
                included.Add(shader);
                added++;
            }
            if (added > 0)
            {
                gsProp.arraySize = included.Count;
                for (int i = 0; i < included.Count; i++) gsProp.GetArrayElementAtIndex(i).objectReferenceValue = included[i];
                gsSo.ApplyModifiedProperties();
                if (save)
                {
                    AssetDatabase.SaveAssets();
                    Debug.Log("Hollowmere: added " + added + " shaders to Always Included Shaders.");
                }
            }
        }

        /// <summary>
        /// A Library left over from the built-in pipeline imports glTFast materials that draw
        /// magenta under URP. Reimport those before the player build, never during it.
        /// A GLB whose import already failed is left alone: the build continues and the
        /// game falls back to the primitive for that model.
        /// </summary>
        static void AdoptImportedModels()
        {
            if (GraphicsSettings.currentRenderPipeline == null) return;
            var dir = "Assets/Resources/Models";
            if (!Directory.Exists(dir)) return;
            foreach (var file in Directory.GetFiles(dir, "*.glb"))
            {
                var path = file.Replace('\\', '/');
                if (AssetDatabase.LoadMainAssetAtPath(path) == null)
                {
                    Debug.LogWarning("Hollowmere: skipping GLB that failed to import: " + path);
                    continue;
                }
                if (!NeedsPipelineReimport(path)) continue;
                try
                {
                    Debug.Log("Hollowmere: reimporting " + path + " so its materials match URP.");
                    AssetDatabase.ImportAsset(path, ImportAssetOptions.ForceUpdate);
                }
                catch (System.Exception e)
                {
                    Debug.LogWarning("Hollowmere: skipping GLB that failed to import: " + path + " (" + e.GetType().Name + ": " + e.Message + ")");
                    continue;
                }
                if (AssetDatabase.LoadMainAssetAtPath(path) == null)
                    Debug.LogWarning("Hollowmere: skipping GLB that failed to import: " + path);
            }
        }

        static bool NeedsPipelineReimport(string path)
        {
            var sawMaterial = false;
            foreach (var asset in AssetDatabase.LoadAllAssetsAtPath(path))
            {
                var mat = asset as Material;
                if (mat == null || mat.shader == null) continue;
                sawMaterial = true;
                var n = mat.shader.name;
                if (n.StartsWith("Shader Graphs/") || n.StartsWith("Universal Render Pipeline/") || n.StartsWith("Hollowmere/"))
                    return false;
            }
            return sawMaterial;
        }
    }
}
