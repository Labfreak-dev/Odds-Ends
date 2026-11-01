using UnityEditor;
public static class QaLinuxBuild {
  public static void Build() {
    var r = BuildPipeline.BuildPlayer(new BuildPlayerOptions{ scenes = new[]{"Assets/Scenes/Main.unity"}, locationPathName="/tmp/hm_linuxq/Hollowmere.x86_64", target=BuildTarget.StandaloneLinux64 });
    EditorApplication.Exit(r.summary.result == UnityEditor.Build.Reporting.BuildResult.Succeeded ? 0 : 1);
  }
}
