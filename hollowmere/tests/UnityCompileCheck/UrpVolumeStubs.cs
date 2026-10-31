using UnityEngine;

namespace UnityEngine.Rendering
{
    public class Volume : MonoBehaviour
    {
        public VolumeProfile sharedProfile;
        public bool isGlobal;
        public float priority;
    }

    public class VolumeComponent : ScriptableObject { }

    public class VolumeProfile : ScriptableObject
    {
        public T Add<T>(bool overrides = false) where T : VolumeComponent, new() => new T();
    }

    public class VolumeParameter<T>
    {
        public bool overrideState;
        public T value;
        public void Override(T x) { value = x; overrideState = true; }
    }

    public class MinFloatParameter : VolumeParameter<float>
    {
        public MinFloatParameter(float value, float min) { this.value = value; }
    }

    public class ClampedFloatParameter : VolumeParameter<float>
    {
        public ClampedFloatParameter(float value, float min, float max) { this.value = value; }
    }

    public class FloatParameter : VolumeParameter<float>
    {
        public FloatParameter(float value) { this.value = value; }
    }

    public class ColorParameter : VolumeParameter<Color>
    {
        public ColorParameter(Color value, bool hdr, bool showAlpha, bool showEyeDropper) { this.value = value; }
    }
}

namespace UnityEngine.Rendering.Universal
{
    public enum TonemappingMode { None, Neutral, ACES }

    public class TonemappingModeParameter : VolumeParameter<TonemappingMode>
    {
        public TonemappingModeParameter(TonemappingMode value) { this.value = value; }
    }

    public sealed class Bloom : VolumeComponent
    {
        public MinFloatParameter threshold = new MinFloatParameter(0.9f, 0f);
        public MinFloatParameter intensity = new MinFloatParameter(0f, 0f);
        public ClampedFloatParameter scatter = new ClampedFloatParameter(0.7f, 0f, 1f);
    }

    public sealed class ColorAdjustments : VolumeComponent
    {
        public FloatParameter postExposure = new FloatParameter(0f);
        public ClampedFloatParameter contrast = new ClampedFloatParameter(0f, -100f, 100f);
        public ClampedFloatParameter saturation = new ClampedFloatParameter(0f, -100f, 100f);
        public ColorParameter colorFilter = new ColorParameter(Color.white, true, false, true);
    }

    public sealed class Tonemapping : VolumeComponent
    {
        public TonemappingModeParameter mode = new TonemappingModeParameter(TonemappingMode.None);
    }
}
