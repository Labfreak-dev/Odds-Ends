using System;
using System.Reflection;
using GLTFast;
using UnityEditor;
using UnityEngine;

namespace Hollowmere.Editor
{
    /// <summary>
    /// Forces glTFast to import every <c>*_walk.glb</c> under Resources/Models as a Legacy clip.
    /// ModelAnim plays a legacy Animation component. glTFast 6.10's design-time default is Mecanim
    /// (GltfImporter.OnImportAsset assigns AnimationMethod.Mecanim when importSettings is null), and a
    /// Mecanim import has no controller so the walk never plays.
    /// </summary>
    /// <remarks>
    /// <c>GLTFast.Editor.GltfImporter</c> is internal in 6.10.1, so this cannot assign
    /// <c>ImportSettings.AnimationMethod</c> through a public importer property. The setting is the
    /// importer's serialized <c>importSettings</c> field (enum value Legacy = 1). The same values are
    /// committed in each walk clip's <c>.meta</c> so the first import is already Legacy; this hook
    /// covers clips added later and any reimport that drifts back to Mecanim.
    /// </remarks>
    public sealed class WalkClipLegacyImporter : AssetPostprocessor
    {
        void OnPreprocessAsset()
        {
            if (!IsWalkModel(assetPath)) return;
            if (assetImporter.GetType().FullName != "GLTFast.Editor.GltfImporter") return;
            try
            {
                ForceLegacy(assetImporter);
            }
            catch (Exception e)
            {
                Debug.LogError("Hollowmere: failed to set Legacy animation on " + assetPath + ": " + e);
            }
        }

        static bool IsWalkModel(string path)
        {
            if (string.IsNullOrEmpty(path)) return false;
            var p = path.Replace('\\', '/');
            if (p.IndexOf("/Resources/Models/", StringComparison.OrdinalIgnoreCase) >= 0
                && (p.EndsWith("_walk.glb", StringComparison.OrdinalIgnoreCase)
                    || p.EndsWith("_walk_v2.glb", StringComparison.OrdinalIgnoreCase)))
                return true;
            return p.EndsWith("_combat_anims.glb", StringComparison.OrdinalIgnoreCase)
                && p.IndexOf("/Art/Combat/anims/", StringComparison.OrdinalIgnoreCase) >= 0;
        }

        /// <summary>Mutates the importer instance that is about to run <c>OnImportAsset</c>. No reimport.</summary>
        static void ForceLegacy(AssetImporter importer)
        {
            var field = importer.GetType().GetField("importSettings",
                BindingFlags.Instance | BindingFlags.NonPublic | BindingFlags.Public);
            if (field != null && field.FieldType == typeof(ImportSettings))
            {
                var settings = field.GetValue(importer) as ImportSettings;
                if (settings == null)
                {
                    // Match glTFast's editor defaults (unique node names, mipmaps) but keep Legacy,
                    // which is also ImportSettings' own field default. The editor replaces a null
                    // settings object with Mecanim, so the object must be non-null before import.
                    settings = new ImportSettings
                    {
                        NodeNameMethod = NameImportMethod.OriginalUnique,
                        GenerateMipMaps = true,
                        AnimationMethod = AnimationMethod.Legacy,
                    };
                    field.SetValue(importer, settings);
                    return;
                }
                if (settings.AnimationMethod == AnimationMethod.Legacy) return;
                settings.AnimationMethod = AnimationMethod.Legacy;
                field.SetValue(importer, settings);
                return;
            }

            var so = new SerializedObject(importer);
            var anim = so.FindProperty("importSettings.animationMethod");
            if (anim == null)
            {
                Debug.LogWarning("Hollowmere: glTFast importer on " + importer.assetPath
                    + " has no importSettings.animationMethod field; walk clip stays at the importer default.");
                return;
            }
            if (anim.intValue == (int)AnimationMethod.Legacy) return;
            anim.intValue = (int)AnimationMethod.Legacy;
            so.ApplyModifiedPropertiesWithoutUndo();
        }
    }
}
