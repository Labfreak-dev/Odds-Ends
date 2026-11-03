using UnityEditor;

namespace Hollowmere.StyleTestEditor
{
    /// <summary>Linux QA player to a custom folder (-customBuildPath /tmp/x/Hollowmere.x86_64) so parallel sessions
    /// don't overwrite each other's /tmp/hm_linuxq player.</summary>
    public static class StAltBuild
    {
        public static void Linux()
        {
            string path = "/tmp/hm_linuxq_alt/Hollowmere.x86_64"; var a = System.Environment.GetCommandLineArgs();
            for (int i = 0; i < a.Length - 1; i++) if (a[i] == "-customBuildPath") path = a[i + 1];
            var r = BuildPipeline.BuildPlayer(new BuildPlayerOptions { scenes = new[] { "Assets/Scenes/Main.unity" }, locationPathName = path, target = BuildTarget.StandaloneLinux64 });
            EditorApplication.Exit(r.summary.result == UnityEditor.Build.Reporting.BuildResult.Succeeded ? 0 : 1);
        }
    }
}
