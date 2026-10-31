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
        };

        public void OnPreprocessBuild(BuildReport report)
        {
            ReimportGlbsForUrp();
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
                AssetDatabase.SaveAssets();
                Debug.Log("Hollowmere: added " + added + " shaders to Always Included Shaders.");
            }
        }

        /// <summary>glTFast bakes the pipeline into the imported materials. A Library left over from
        /// the built-in pipeline still has those shaders, which draw magenta under URP.</summary>
        static void ReimportGlbsForUrp()
        {
            if (GraphicsSettings.currentRenderPipeline == null) return;
            var dir = "Assets/Resources/Models";
            if (!Directory.Exists(dir)) return;
            foreach (var file in Directory.GetFiles(dir, "*.glb"))
            {
                var path = file.Replace('\\', '/');
                var urp = false;
                foreach (var asset in AssetDatabase.LoadAllAssetsAtPath(path))
                {
                    var mat = asset as Material;
                    if (mat != null && mat.shader != null && mat.shader.name.StartsWith("Shader Graphs/"))
                        urp = true;
                }
                if (urp) continue;
                Debug.Log("Hollowmere: reimporting " + path + " so its materials match URP.");
                AssetDatabase.ImportAsset(path, ImportAssetOptions.ForceUpdate);
            }
        }
    }
}
