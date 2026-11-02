using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace Hollowmere
{
    /// <summary>
    /// Studio lighting for the paper-doll and creator previews.
    /// Root cause of the near-black previews: URP picks ONE main directional light for the frame (the brightest
    /// visible one, normally the town sun/moon), and the stage's own key/fill/rim were demoted to additional lights
    /// that the hero shaders only half use, under the town's dim night ambient. While a stage camera renders, this
    /// switches the world's directional lights off, makes the stage key the sun, and swaps in a flat studio ambient.
    /// Everything is restored when that camera finishes.
    /// </summary>
    public sealed class StageLighting : MonoBehaviour
    {
        public Camera cam;
        public Light key;
        public Color ambientSky = new Color(0.75f, 0.72f, 0.74f);
        public Color ambientEquator = new Color(0.58f, 0.54f, 0.50f);
        public Color ambientGround = new Color(0.25f, 0.22f, 0.20f);

        readonly List<Light> off = new List<Light>();
        public readonly List<Light> mine = new List<Light>();
        SphericalHarmonicsL2 probe;
        AmbientMode mode; Color sky, eq, gr; float intensity; Light sun; bool fog;
        bool active;

        void OnEnable()
        {
            RenderPipelineManager.beginCameraRendering += Begin;
            RenderPipelineManager.endCameraRendering += End;
        }

        void OnDisable()
        {
            RenderPipelineManager.beginCameraRendering -= Begin;
            RenderPipelineManager.endCameraRendering -= End;
            if (active) Restore();
        }

        void Begin(ScriptableRenderContext ctx, Camera c)
        {
            if (c != cam || active) return;
            active = true;
            off.Clear();
            foreach (var l in Light.GetLights(LightType.Directional, 0))
                if (l != null && l.enabled && !mine.Contains(l)) { l.enabled = false; off.Add(l); }
            mode = RenderSettings.ambientMode; sky = RenderSettings.ambientSkyColor; eq = RenderSettings.ambientEquatorColor;
            gr = RenderSettings.ambientGroundColor; intensity = RenderSettings.ambientIntensity; sun = RenderSettings.sun; fog = RenderSettings.fog;
            RenderSettings.ambientMode = AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = ambientSky;
            RenderSettings.ambientEquatorColor = ambientEquator;
            RenderSettings.ambientGroundColor = ambientGround;
            RenderSettings.ambientIntensity = 1f;
            RenderSettings.fog = false;
            probe = RenderSettings.ambientProbe;
            var sh = new SphericalHarmonicsL2();
            sh.AddAmbientLight(ambientEquator);
            sh.AddDirectionalLight(Vector3.up, ambientSky - ambientEquator * 0.5f, 0.6f);
            RenderSettings.ambientProbe = sh;
            foreach (var l in mine) if (l != null) l.enabled = true;
            if (key != null) RenderSettings.sun = key;
            // Off-playfield stages sit far from the town's light probes; use the studio ambient instead.
            foreach (var r in transform.root.GetComponentsInChildren<Renderer>())
                if (r.lightProbeUsage != LightProbeUsage.Off) r.lightProbeUsage = LightProbeUsage.Off;
            if (!logged) { logged = true; Debug.Log("Hollowmere stage lighting on " + c.name + " worldDirOff=" + off.Count + " key=" + (key != null)); }
        }
        bool logged;

        void End(ScriptableRenderContext ctx, Camera c)
        {
            if (c != cam || !active) return;
            Restore();
        }

        void Restore()
        {
            active = false;
            foreach (var l in off) if (l != null) l.enabled = true;
            off.Clear();
            foreach (var l in mine) if (l != null) l.enabled = false;
            RenderSettings.ambientProbe = probe;
            RenderSettings.ambientMode = mode; RenderSettings.ambientSkyColor = sky; RenderSettings.ambientEquatorColor = eq;
            RenderSettings.ambientGroundColor = gr; RenderSettings.ambientIntensity = intensity; RenderSettings.sun = sun; RenderSettings.fog = fog;
        }

        // The camera sits at +Z looking toward -Z. The old stage keys pointed toward +Z (Euler 40,-24 and 42,-28),
        // so they lit the hero's back and the front read black. The key now travels toward -Z from the upper left.
        /// <summary>Key, fill, rim and a soft backdrop. Returns the key light.</summary>
        public static StageLighting Rig(Transform root, Camera cam, int layer)
        {
            var key = MakeLight(root, "studioKey", LightType.Directional, Quaternion.Euler(30f, 150f, 0f), 2.8f, new Color(1f, 0.94f, 0.84f), layer);
            key.shadows = LightShadows.Soft;
            // Fill and rim as spots: they stay per-pixel additional lights and never compete for the main light.
            var fill = MakeLight(root, "studioFill", LightType.Point, Quaternion.identity, 4.0f, new Color(0.70f, 0.76f, 0.95f), layer);
            fill.transform.localPosition = new Vector3(-2.6f, 1.6f, 3.2f); fill.range = 9f;
            var rimL = MakeLight(root, "studioRimL", LightType.Point, Quaternion.identity, 5.5f, new Color(1f, 0.78f, 0.52f), layer);
            rimL.transform.localPosition = new Vector3(-1.5f, 2.3f, -1.4f); rimL.range = 5f;
            var rimR = MakeLight(root, "studioRimR", LightType.Point, Quaternion.identity, 4.5f, new Color(0.6f, 0.75f, 1f), layer);
            rimR.transform.localPosition = new Vector3(1.6f, 2.0f, -1.3f); rimR.range = 5f;
            var s = root.gameObject.AddComponent<StageLighting>();
            s.cam = cam; s.key = key;
            s.mine.AddRange(new[] { key, fill, rimL, rimR });
            foreach (var l in s.mine) l.enabled = false;
            return s;
        }

        static Light MakeLight(Transform root, string name, LightType type, Quaternion rot, float intensity, Color color, int layer)
        {
            var l = new GameObject(name).AddComponent<Light>();
            l.transform.SetParent(root, false);
            l.type = type;
            l.transform.localRotation = rot;
            l.intensity = intensity;
            l.color = color;
            // Everything: these lights only exist while the stage camera renders, so they cannot touch the world.
            l.cullingMask = ~0;
            return l;
        }

        /// <summary>Lighter studio backdrop: a warm grey vertical gradient, darker at the edges.</summary>
        public static Texture2D Backdrop()
        {
            const int w = 64, h = 128;
            var t = new Texture2D(w, h, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp, name = "studioBackdrop" };
            var top = new Color(0.36f, 0.34f, 0.37f); var mid = new Color(0.52f, 0.47f, 0.43f);
            for (int y = 0; y < h; y++)
                for (int x = 0; x < w; x++)
                {
                    float v = y / (float)(h - 1);
                    var c = Color.Lerp(mid, top, Mathf.SmoothStep(0f, 1f, v));
                    float dx = (x / (float)(w - 1) - 0.5f) * 2f;
                    c *= 1f - 0.35f * dx * dx;
                    c.a = 1f;
                    t.SetPixel(x, y, c);
                }
            t.Apply();
            return t;
        }
    }
}
