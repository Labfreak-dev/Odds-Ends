using UnityEngine;

namespace Hollowmere
{
    /// <summary>The whole game is built from code, so any scene (even an empty one) boots it.
    /// Open the project, press Play.</summary>
    public static class Boot
    {
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void Start()
        {
            if (Object.FindFirstObjectByType<GameManager>() != null) return;
            Application.targetFrameRate = 60;
            Screen.sleepTimeout = SleepTimeout.NeverSleep;
            Screen.orientation = ScreenOrientation.AutoRotation;
            Screen.autorotateToPortrait = false;
            Screen.autorotateToPortraitUpsideDown = false;
            Screen.autorotateToLandscapeLeft = true;
            Screen.autorotateToLandscapeRight = true;
            QualitySettings.shadows = ShadowQuality.Disable;
            QualitySettings.pixelLightCount = 4;

            // Remove whatever the template scene shipped with: we bring our own camera and light.
            foreach (var cam in Object.FindObjectsByType<Camera>(FindObjectsSortMode.None)) Object.Destroy(cam.gameObject);
            foreach (var l in Object.FindObjectsByType<Light>(FindObjectsSortMode.None)) Object.Destroy(l.gameObject);

            var go = new GameObject("Hollowmere");
            Object.DontDestroyOnLoad(go);
            go.AddComponent<GameManager>();
        }
    }
}
