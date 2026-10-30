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
            "Universal Render Pipeline/Lit",
            "Universal Render Pipeline/Simple Lit",
            "Universal Render Pipeline/Unlit",
            "Shader Graphs/glTF-pbrMetallicRoughness",
            "Shader Graphs/glTF-unlit",
            "Shader Graphs/glTF-pbrSpecularGlossiness",
            "Shader Graphs/glTF-pbrMetallicRoughness-Clearcoat",
        };

        public void OnPreprocessBuild(BuildReport report)
        {
            ReimportGlbsForUrp();
            var included = new List<Shader>(GraphicsSettings.alwaysIncludedShaders);
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
                GraphicsSettings.alwaysIncludedShaders = included.ToArray();
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
