using UnityEngine;

namespace Hollowmere
{
    /// <summary>Menu motion, button glow, and which UI clips to play. Authored in Resources/Ui.</summary>
    public sealed class UiFeelProfile : ScriptableObject
    {
        public float pressScale = 0.92f;
        public float glow = 1.35f;
        public float slide = 22f;
        public float fade = 0.28f;
        public int haptics = 1;
        public string ironFrame = "panel_iron";
        public string clickCue = "ui_click";
        public string openCue = "ui_panel_open";
        public string lootCue = "item_pickup";

        static UiFeelProfile active;

        public static UiFeelProfile Active
        {
            get
            {
                if (active == null) active = Resources.Load<UiFeelProfile>("Ui/UiFeelProfile");
                return active;
            }
        }

        public static float PressScale => Active != null ? Active.pressScale : 0.92f;
        public static float Glow => Active != null ? Active.glow : 1.35f;
        public static float Slide => Active != null ? Active.slide : 22f;
        public static float Fade => Active != null ? Active.fade : 0.28f;
        public static string IronFrame => Active != null && !string.IsNullOrEmpty(Active.ironFrame) ? Active.ironFrame : "panel_iron";
        public static string LootCue => Active != null && !string.IsNullOrEmpty(Active.lootCue) ? Active.lootCue : "item_pickup";
    }

    /// <summary>Short Handheld.Vibrate pulse. Off unless the settings toggle is on.</summary>
    public static class Haptics
    {
        const string Key = "haptics";
        static float next;

        public static bool Enabled
        {
            get => PlayerPrefs.GetInt(Key, UiFeelProfile.Active != null ? UiFeelProfile.Active.haptics : 1) != 0;
            set
            {
                PlayerPrefs.SetInt(Key, value ? 1 : 0);
                PlayerPrefs.Save();
            }
        }

        public static void Light()
        {
            if (!Enabled) return;
            if (Time.unscaledTime < next) return;
            next = Time.unscaledTime + 0.12f;
            Handheld.Vibrate();
        }
    }

    /// <summary>Full-body portrait. The rig faces +Z, so the camera sits on that side and looks back.</summary>
    public static class PortraitCam
    {
        public static float FrameFront(Camera cam, Bounds b, float fill = 0.7f)
        {
            if (cam == null) return 0f;
            float vfov = cam.fieldOfView * Mathf.Deg2Rad;
            float aspect = cam.aspect > 0.2f ? cam.aspect : 0.75f;
            float distH = (b.size.y * 0.55f) / Mathf.Max(0.05f, Mathf.Tan(vfov * 0.5f)) / Mathf.Max(0.45f, fill);
            float hfov = 2f * Mathf.Atan(Mathf.Tan(vfov * 0.5f) * aspect);
            float distW = (b.size.x * 0.55f) / Mathf.Max(0.05f, Mathf.Tan(hfov * 0.5f)) / Mathf.Max(0.45f, fill);
            float dist = Mathf.Max(distH, distW) + 0.45f;
            var look = b.center;
            cam.transform.position = look + new Vector3(0f, b.size.y * 0.02f, dist);
            cam.transform.rotation = Quaternion.LookRotation(look - cam.transform.position, Vector3.up);
            return dist;
        }
    }
}
