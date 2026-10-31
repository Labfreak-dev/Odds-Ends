using Hollowmere.Core;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace Hollowmere
{
    /// <summary>CC0 surfaces and the lake. Textures live in Resources/PbrKit.</summary>
    public static class PbrKit
    {
        const string Root = "PbrKit/materials/";

        public static Material Surface(string name, float tileMetres, Color tint)
        {
            var shader = Shader.Find("Hollowmere/Pbr");
            if (shader == null) shader = Shader.Find("Universal Render Pipeline/Lit");
            if (shader == null) return Art.Mat(tint);
            var m = new Material(shader);
            var albedo = Load(name, "basecolor");
            var normal = Load(name, "normal_gl");
            var metal = Load(name, "metallic_smoothness");
            var ao = Load(name, "ao");
            m.SetColor("_BaseColor", tint);
            if (m.HasProperty("_Color")) m.SetColor("_Color", tint);
            if (albedo != null && m.HasProperty("_BaseMap")) m.SetTexture("_BaseMap", albedo);
            if (normal != null && m.HasProperty("_BumpMap"))
            {
                m.SetTexture("_BumpMap", normal);
                m.EnableKeyword("_NORMALMAP");
                if (m.HasProperty("_HasNormal")) m.SetFloat("_HasNormal", 1f);
            }
            if (metal != null && m.HasProperty("_MetallicGlossMap"))
            {
                m.SetTexture("_MetallicGlossMap", metal);
                m.EnableKeyword("_METALLICSPECGLOSSMAP");
                if (m.HasProperty("_HasMetal")) m.SetFloat("_HasMetal", 1f);
                if (m.HasProperty("_Smoothness")) m.SetFloat("_Smoothness", 1f);
            }
            if (ao != null && m.HasProperty("_OcclusionMap"))
            {
                m.SetTexture("_OcclusionMap", ao);
                m.EnableKeyword("_OCCLUSIONMAP");
                if (m.HasProperty("_HasAo")) m.SetFloat("_HasAo", 1f);
            }
            if (m.HasProperty("_Tile")) m.SetFloat("_Tile", tileMetres);
            return m;
        }

        /// <summary>A kit prop at unit scale. Not run through the character height fit.</summary>
        public static GameObject Prop(string name, Transform parent)
        {
            var prefab = Resources.Load<GameObject>("PbrKit/props/" + name);
            if (prefab == null) prefab = Resources.Load<GameObject>("Models/" + name);
            if (prefab == null) return null;
            var go = UnityEngine.Object.Instantiate(prefab, parent);
            go.name = name;
            go.transform.localPosition = Vector3.zero;
            go.transform.localRotation = Quaternion.identity;
            go.transform.localScale = Vector3.one;
            foreach (var c in go.GetComponentsInChildren<Collider>()) UnityEngine.Object.Destroy(c);
            Art.AdoptShaders(go);
            return go;
        }

        public static Material Water()
        {
            var shader = Shader.Find("Hollowmere/Water");
            if (shader == null) return Art.Mat(new Color(0.08f, 0.22f, 0.28f), 0.4f);
            var m = new Material(shader);
            var n = Resources.Load<Texture2D>("PbrKit/water/water_normal_gl");
            if (n != null && m.HasProperty("_BumpMap")) m.SetTexture("_BumpMap", n);
            if (m.HasProperty("_BaseColor")) m.SetColor("_BaseColor", new Color(0.04f, 0.14f, 0.16f, 1f));
            if (m.HasProperty("_TileA")) m.SetFloat("_TileA", 6f);
            if (m.HasProperty("_TileB")) m.SetFloat("_TileB", 3.7f);
            if (m.HasProperty("_NormalScale")) m.SetFloat("_NormalScale", 0.4f);
            if (m.HasProperty("_Smoothness")) m.SetFloat("_Smoothness", 0.95f);
            return m;
        }

        /// <summary>Global bloom, ACES, and a light grade for this level. SSAO is the renderer feature:
        /// it is not a volume component, and adding it here used to throw.</summary>
        public static void Grade(DungeonMap map)
        {
            if (UnityEngine.Object.FindFirstObjectByType<Volume>() != null) return;
            var spec = PostVolume.For(map);
            var go = new GameObject("pbrVolume");
            UnityEngine.Object.DontDestroyOnLoad(go);
            var volume = go.AddComponent<Volume>();
            var profile = ScriptableObject.CreateInstance<VolumeProfile>();
            volume.sharedProfile = profile;
            volume.isGlobal = true;
            volume.priority = 20f;

            var bloomSpec = spec.Get<PostBloom>();
            var bloom = profile.Add<Bloom>();
            bloom.threshold.Override(bloomSpec.threshold);
            bloom.intensity.Override(bloomSpec.intensity);
            bloom.scatter.Override(bloomSpec.scatter);

            var tone = profile.Add<Tonemapping>();
            tone.mode.Override(spec.Get<PostTonemapping>().mode == PostTonemap.Aces ? TonemappingMode.ACES : TonemappingMode.Neutral);

            var colorSpec = spec.Get<PostColorAdjustments>();
            var color = profile.Add<ColorAdjustments>();
            color.postExposure.Override(colorSpec.postExposure);
            color.contrast.Override(colorSpec.contrast);
            color.saturation.Override(colorSpec.saturation);
            color.colorFilter.Override(new Color(colorSpec.filterR, colorSpec.filterG, colorSpec.filterB, 1f));
        }

        /// <summary>
        /// URP Lit with the surface maps. Metal maps that are nearly white zero the diffuse
        /// term and read as unlit black without a reflection probe, so metallic stays a scalar.
        /// </summary>
        public static Material UrpLit(string name, float tileMetres, Color tint, float metallic, float smoothness, float bump = 0.6f)
        {
            var shader = Shader.Find("Universal Render Pipeline/Lit");
            if (shader == null) shader = Shader.Find("Hollowmere/Pbr");
            if (shader == null) return Art.Mat(tint);
            var m = new Material(shader);
            var albedo = Load(name, "basecolor");
            var normal = Load(name, "normal_gl");
            m.SetColor("_BaseColor", tint);
            if (m.HasProperty("_Color")) m.SetColor("_Color", tint);
            if (albedo != null)
            {
                if (m.HasProperty("_BaseMap")) m.SetTexture("_BaseMap", albedo);
                if (m.HasProperty("_MainTex")) m.SetTexture("_MainTex", albedo);
                float rep = Mathf.Max(0.25f, 2f / Mathf.Max(0.5f, tileMetres));
                if (m.HasProperty("_BaseMap")) m.SetTextureScale("_BaseMap", Vector2.one * rep);
                if (m.HasProperty("_MainTex")) m.SetTextureScale("_MainTex", Vector2.one * rep);
            }
            if (normal != null && m.HasProperty("_BumpMap"))
            {
                m.SetTexture("_BumpMap", normal);
                m.EnableKeyword("_NORMALMAP");
                if (m.HasProperty("_BumpScale")) m.SetFloat("_BumpScale", bump);
            }
            if (m.HasProperty("_Metallic")) m.SetFloat("_Metallic", metallic);
            if (m.HasProperty("_Smoothness")) m.SetFloat("_Smoothness", smoothness);
            m.DisableKeyword("_METALLICSPECGLOSSMAP");
            m.globalIlluminationFlags = MaterialGlobalIlluminationFlags.RealtimeEmissive;
            if (albedo == null)
                Debug.LogError("Hollowmere urp lit " + name + " FAIL missing base map");
            else
                Debug.Log("Hollowmere urp lit " + name + " base=" + albedo.name);
            return m;
        }

        static Texture2D Load(string folder, string suffix)
        {
            return Resources.Load<Texture2D>(Root + folder + "/" + folder + "_" + suffix);
        }

    }
}
