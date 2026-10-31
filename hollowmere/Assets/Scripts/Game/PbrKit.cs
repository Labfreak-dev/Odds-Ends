using System;
using System.Reflection;
using UnityEngine;

namespace Hollowmere
{
    /// <summary>CC0 surfaces and the lake. Textures live in Art/PBR and are linked from Resources/PbrKit.</summary>
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
            m.mainTextureScale = Vector2.one;
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

        /// <summary>Global bloom, SSAO, ACES, and a light grade. Missing types are skipped.</summary>
        public static void Grade()
        {
            var volumeType = Type.GetType("UnityEngine.Rendering.Volume, Unity.RenderPipelines.Core.Runtime");
            var profileType = Type.GetType("UnityEngine.Rendering.VolumeProfile, Unity.RenderPipelines.Core.Runtime");
            if (volumeType == null || profileType == null) return;
            if (UnityEngine.Object.FindFirstObjectByType(volumeType) != null) return;
            var go = new GameObject("pbrVolume");
            UnityEngine.Object.DontDestroyOnLoad(go);
            var volume = go.AddComponent(volumeType);
            var profile = ScriptableObject.CreateInstance(profileType);
            Set(volume, "sharedProfile", profile);
            Set(volume, "isGlobal", true);
            Set(volume, "priority", 20f);
            Add(profile, "UnityEngine.Rendering.Universal.Bloom, Unity.RenderPipelines.Universal.Runtime", c =>
            {
                SetParam(c, "threshold", 1.1f);
                SetParam(c, "intensity", 0.35f);
                SetParam(c, "scatter", 0.55f);
            });
            Add(profile, "UnityEngine.Rendering.Universal.Tonemapping, Unity.RenderPipelines.Universal.Runtime", c =>
            {
                // ACES is mode 2 on TonemappingMode.
                SetParam(c, "mode", 2);
            });
            Add(profile, "UnityEngine.Rendering.Universal.ColorAdjustments, Unity.RenderPipelines.Universal.Runtime", c =>
            {
                SetParam(c, "postExposure", 0.12f);
                SetParam(c, "contrast", 8f);
                SetParam(c, "saturation", 6f);
                SetParam(c, "colorFilter", new Color(1f, 0.97f, 0.92f, 1f));
            });
            Add(profile, "UnityEngine.Rendering.Universal.ScreenSpaceAmbientOcclusion, Unity.RenderPipelines.Universal.Runtime", c =>
            {
                SetParam(c, "intensity", 0.45f);
                SetParam(c, "radius", 0.25f);
            });
        }

        static Texture2D Load(string folder, string suffix)
        {
            return Resources.Load<Texture2D>(Root + folder + "/" + folder + "_" + suffix);
        }

        static void Add(ScriptableObject profile, string typeName, Action<object> fill)
        {
            var t = Type.GetType(typeName);
            if (t == null) return;
            MethodInfo add = null;
            foreach (var method in profile.GetType().GetMethods())
            {
                if (method.Name != "Add" || !method.IsGenericMethodDefinition) continue;
                if (method.GetParameters().Length != 1) continue;
                add = method;
                break;
            }
            if (add == null) return;
            var generic = add.MakeGenericMethod(t);
            var component = generic.Invoke(profile, new object[] { true });
            if (component != null) fill(component);
        }

        static void Set(object target, string name, object value)
        {
            var f = target.GetType().GetField(name, BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);
            if (f != null) { f.SetValue(target, value); return; }
            var p = target.GetType().GetProperty(name, BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);
            if (p != null && p.CanWrite) p.SetValue(target, value);
        }

        static void SetParam(object component, string name, object value)
        {
            var f = component.GetType().GetField(name, BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);
            if (f == null) return;
            var param = f.GetValue(component);
            if (param == null) return;
            var pt = param.GetType();
            var over = pt.GetProperty("overrideState") ?? pt.GetProperty("overrideState", BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);
            over?.SetValue(param, true);
            var prop = pt.GetProperty("value");
            if (prop == null) return;
            var dest = prop.PropertyType;
            if (value is int && dest.IsEnum)
                prop.SetValue(param, Enum.ToObject(dest, (int)value));
            else if (dest.IsInstanceOfType(value) || value == null)
                prop.SetValue(param, value);
            else if (value is float && dest == typeof(float))
                prop.SetValue(param, value);
        }
    }
}
