using System;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Profile;
using UnityEditor.Build.Reporting;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace Hollowmere.Editor
{
    /// <summary>
    /// Makes sure <c>Assets/Scenes/Main.unity</c> is in the build, and builds the Android APK.
    /// Player settings are also written into <c>ProjectSettings/ProjectSettings.asset</c> so a build
    /// does not depend on this script having run first. game-ci calls <see cref="Android"/>.
    /// </summary>
    public static class HollowmereBuild
    {
        public const string ScenePath = "Assets/Scenes/Main.unity";
        public const string Company = "Labfreak";
        public const string Product = "Hollowmere";
        public const string ApplicationId = "com.labfreak.hollowmere";

        // 0 = Input Manager, 1 = Input System, 2 = Both.
        // Unity 6 has no dedicated setter. PlayerSettings.SetPropertyInt("activeInputHandler")
        // reimport-loops (Input System 1.19's EditorPlayerSettingHelpers hotfix), so this writes
        // the serialized property on the global PlayerSettings object instead.
        const int InputHandlerBoth = 2;

        [InitializeOnLoadMethod]
        static void RegisterBootstrap()
        {
            EditorApplication.delayCall += () =>
            {
                try { EnsureSceneAsset(); }
                catch (Exception e) { Debug.LogError("Hollowmere scene bootstrap failed: " + e); }
            };
        }

        /// <summary>
        /// Empty scene is enough. <c>Boot.Start</c> is a <c>RuntimeInitializeOnLoadMethod</c>
        /// (<c>AfterSceneLoad</c>) and creates the GameManager itself, so the scene needs no object.
        /// </summary>
        public static void EnsureSceneAsset()
        {
            if (!File.Exists(ScenePath))
            {
                Directory.CreateDirectory("Assets/Scenes");
                var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
                EditorSceneManager.SaveScene(scene, ScenePath);
            }

            var scenes = EditorBuildSettings.scenes;
            for (var i = 0; i < scenes.Length; i++)
            {
                if (scenes[i].path != ScenePath) continue;
                if (!scenes[i].enabled)
                {
                    scenes[i].enabled = true;
                    EditorBuildSettings.scenes = scenes;
                }
                return;
            }

            var list = new List<EditorBuildSettingsScene>(scenes.Length + 1) { new EditorBuildSettingsScene(ScenePath, true) };
            list.AddRange(scenes);
            EditorBuildSettings.scenes = list.ToArray();
        }

        /// <summary>game-ci entry point. Writes the APK to <c>-customBuildPath</c> and exits with the build result.</summary>
        public static void Android()
        {
            var code = Build(null);
            EditorApplication.Exit(code);
        }

        [MenuItem("Hollowmere/Build Android APK")]
        public static void BuildFromMenu()
        {
            var projectRoot = Directory.GetParent(Application.dataPath).FullName;
            var path = Path.Combine(projectRoot, "Builds", "Android", "Hollowmere.apk");
            var code = Build(path);
            if (code == 0) Debug.Log("Hollowmere APK: " + path);
            else Debug.LogError("Hollowmere Android build failed (code " + code + ").");
        }

        public static int Build(string explicitPath)
        {
            var recompile = ApplyAndroidPlayerSettings();
            if (recompile)
            {
                AssetDatabase.SaveAssets();
                Debug.LogError("Hollowmere: scripting backend or input handler differed from the committed "
                    + "ProjectSettings and was corrected. Unity must recompile before the player build. Re-run the build.");
                return 2;
            }

            EnsureSceneAsset();
            ApplyExportType(Arg("androidExportType"));

            var version = Arg("buildVersion");
            if (!string.IsNullOrEmpty(version) && version != "none")
                PlayerSettings.bundleVersion = version;
            var versionCode = Arg("androidVersionCode");
            if (int.TryParse(versionCode, out var code) && code > 0)
                PlayerSettings.Android.bundleVersionCode = code;

            var location = explicitPath;
            if (string.IsNullOrEmpty(location)) location = Arg("customBuildPath");
            if (string.IsNullOrEmpty(location))
            {
                var projectRoot = Directory.GetParent(Application.dataPath).FullName;
                location = Path.Combine(projectRoot, "Builds", "Android", "Hollowmere.apk");
            }
            var dir = Path.GetDirectoryName(location);
            if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);

            if (!File.Exists(ScenePath))
            {
                Debug.LogError("Hollowmere: missing scene " + ScenePath);
                return 1;
            }

            var options = new BuildPlayerOptions
            {
                scenes = new[] { ScenePath },
                locationPathName = location,
                target = BuildTarget.Android,
                options = BuildOptions.None,
            };
            // Bind and any GLB reimport happen before BuildPlayer. Nothing here calls
            // AssetDatabase.Refresh, and a GLB that did not import is skipped.
            UiDropInBind.Bind();
            HollowmereRenderSetup.PrepareBeforePlayerBuild();

            Debug.Log("Hollowmere: building Android player at " + location);
            var report = BuildPipeline.BuildPlayer(options);
            var summary = report.summary;
            Debug.Log("Hollowmere Android build " + summary.result + " errors=" + summary.totalErrors
                + " output=" + summary.outputPath);
            return summary.result == BuildResult.Succeeded ? 0 : 1;
        }

        /// <summary>Returns true when a change will force a script recompile (do not continue into BuildPlayer).</summary>
        public static bool ApplyAndroidPlayerSettings()
        {
            SetString(() => PlayerSettings.companyName, v => PlayerSettings.companyName = v, Company);
            SetString(() => PlayerSettings.productName, v => PlayerSettings.productName = v, Product);
            if (PlayerSettings.GetApplicationIdentifier(NamedBuildTarget.Android) != ApplicationId)
                PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.Android, ApplicationId);

            if (PlayerSettings.defaultInterfaceOrientation != UIOrientation.AutoRotation)
                PlayerSettings.defaultInterfaceOrientation = UIOrientation.AutoRotation;
            if (PlayerSettings.allowedAutorotateToPortrait) PlayerSettings.allowedAutorotateToPortrait = false;
            if (PlayerSettings.allowedAutorotateToPortraitUpsideDown) PlayerSettings.allowedAutorotateToPortraitUpsideDown = false;
            if (!PlayerSettings.allowedAutorotateToLandscapeLeft) PlayerSettings.allowedAutorotateToLandscapeLeft = true;
            if (!PlayerSettings.allowedAutorotateToLandscapeRight) PlayerSettings.allowedAutorotateToLandscapeRight = true;

            if (PlayerSettings.Android.minSdkVersion != AndroidSdkVersions.AndroidApiLevel24)
                PlayerSettings.Android.minSdkVersion = AndroidSdkVersions.AndroidApiLevel24;
            if (PlayerSettings.Android.targetSdkVersion != AndroidSdkVersions.AndroidApiLevelAuto)
                PlayerSettings.Android.targetSdkVersion = AndroidSdkVersions.AndroidApiLevelAuto;
            if (PlayerSettings.Android.targetArchitectures != AndroidArchitecture.ARM64)
                PlayerSettings.Android.targetArchitectures = AndroidArchitecture.ARM64;
            if (PlayerSettings.Android.useCustomKeystore) PlayerSettings.Android.useCustomKeystore = false;
            if (!PlayerSettings.Android.renderOutsideSafeArea) PlayerSettings.Android.renderOutsideSafeArea = true;

            var recompile = false;
            if (PlayerSettings.GetScriptingBackend(NamedBuildTarget.Android) != ScriptingImplementation.IL2CPP)
            {
                PlayerSettings.SetScriptingBackend(NamedBuildTarget.Android, ScriptingImplementation.IL2CPP);
                recompile = true;
            }
            if (EnsureInputHandlerBoth()) recompile = true;
            return recompile;
        }

        static bool EnsureInputHandlerBoth()
        {
            var settings = LoadPlayerSettings();
            if (settings == null)
            {
                Debug.LogWarning("Hollowmere: could not read PlayerSettings; keeping the committed activeInputHandler.");
                return false;
            }
            var so = new SerializedObject(settings);
            var prop = so.FindProperty("activeInputHandler");
            if (prop == null)
            {
                Debug.LogWarning("Hollowmere: activeInputHandler is missing on PlayerSettings; keeping the committed value.");
                return false;
            }
            if (prop.intValue == InputHandlerBoth) return false;
            prop.intValue = InputHandlerBoth;
            so.ApplyModifiedPropertiesWithoutUndo();
            return true;
        }

        static PlayerSettings LoadPlayerSettings()
        {
            var field = typeof(BuildProfile).GetField("s_GlobalPlayerSettings", BindingFlags.Static | BindingFlags.NonPublic);
            if (field != null && field.GetValue(null) is PlayerSettings fromProfile)
                return fromProfile;
            var found = Resources.FindObjectsOfTypeAll<PlayerSettings>();
            return found != null && found.Length > 0 ? found[0] : null;
        }

        static void ApplyExportType(string export)
        {
            switch (export)
            {
                case "androidAppBundle":
                    EditorUserBuildSettings.exportAsGoogleAndroidProject = false;
                    EditorUserBuildSettings.buildAppBundle = true;
                    break;
                case "androidStudioProject":
                    EditorUserBuildSettings.exportAsGoogleAndroidProject = true;
                    EditorUserBuildSettings.buildAppBundle = false;
                    break;
                default:
                    EditorUserBuildSettings.exportAsGoogleAndroidProject = false;
                    EditorUserBuildSettings.buildAppBundle = false;
                    break;
            }
        }

        static void SetString(Func<string> get, Action<string> set, string value)
        {
            if (get() != value) set(value);
        }

        static string Arg(string name)
        {
            var args = Environment.GetCommandLineArgs();
            for (var i = 0; i < args.Length - 1; i++)
            {
                if (args[i] == "-" + name || args[i] == "--" + name)
                    return args[i + 1];
            }
            return null;
        }
    }
}
