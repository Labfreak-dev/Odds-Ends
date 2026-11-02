using System.IO;
using System.Text;
using UnityEditor;
using UnityEngine;

namespace Hollowmere.StyleTestEditor
{
    /// <summary>Batch probe: imports the style-test packs and dumps bounds / clips / materials for layout work.</summary>
    public static class StyleTestProbe
    {
        public static void Dump()
        {
            AssetDatabase.Refresh();
            var sb = new StringBuilder();
            foreach (var dir in new[] { "Town/Hex", "Town/VK", "Town/Animals", "Folk" })
            {
                foreach (var guid in AssetDatabase.FindAssets("t:Model", new[] { "Assets/StyleTest/Resources/ST/" + dir }))
                {
                    var path = AssetDatabase.GUIDToAssetPath(guid);
                    var go = AssetDatabase.LoadAssetAtPath<GameObject>(path);
                    if (go == null) continue;
                    var inst = Object.Instantiate(go);
                    var rs = inst.GetComponentsInChildren<Renderer>();
                    Bounds b = rs.Length > 0 ? rs[0].bounds : new Bounds();
                    foreach (var r in rs) b.Encapsulate(r.bounds);
                    sb.Append("MODEL ").Append(dir).Append('/').Append(Path.GetFileNameWithoutExtension(path))
                      .Append(" size=").Append(b.size.ToString("F2")).Append(" min=").Append(b.min.ToString("F2"));
                    if (dir != "Town/VK" && dir != "Town/Hex")
                    {
                        foreach (var r in rs)
                        {
                            sb.Append("\n   R ").Append(r.name).Append(r is SkinnedMeshRenderer ? " skinned" : "");
                            foreach (var m in r.sharedMaterials) if (m) sb.Append(" [").Append(m.name).Append(':').Append(m.shader.name).Append(':').Append(m.mainTexture ? m.mainTexture.name : "-").Append(']');
                        }
                        foreach (var c in AssetDatabase.LoadAllAssetsAtPath(path)) if (c is AnimationClip ac && !ac.name.StartsWith("__")) sb.Append("\n   CLIP ").Append(ac.name).Append(' ').Append(ac.length.ToString("F2"));
                        var t = inst.transform; sb.Append("\n   BONES ");
                        foreach (var tr in inst.GetComponentsInChildren<Transform>()) if (tr.name.ToLower().Contains("hand") || tr.name.ToLower().Contains("head") || tr.name.ToLower().Contains("spine") || tr.name.ToLower().Contains("hips") || tr.name.ToLower().Contains("pelvis")) sb.Append(tr.name).Append(',');
                    }
                    else
                    {
                        foreach (var r in rs) foreach (var m in r.sharedMaterials) if (m) sb.Append(" [").Append(m.name).Append(']');
                    }
                    sb.Append('\n');
                    Object.DestroyImmediate(inst);
                }
            }
            File.WriteAllText("/workspace/hm_style_test/probe.txt", sb.ToString());
            EditorApplication.Exit(0);
        }
    }
}
