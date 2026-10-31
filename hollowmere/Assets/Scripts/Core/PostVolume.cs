using System.Collections.Generic;

namespace Hollowmere.Core
{
    public enum PostTonemap { Neutral, Aces }

    public abstract class PostComponent { }

    public sealed class PostBloom : PostComponent
    {
        public float threshold = 1.1f;
        public float intensity = 0.35f;
        public float scatter = 0.55f;
    }

    public sealed class PostTonemapping : PostComponent
    {
        public PostTonemap mode = PostTonemap.Aces;
    }

    public sealed class PostColorAdjustments : PostComponent
    {
        public float postExposure = 0.12f;
        public float contrast = 8f;
        public float saturation = 6f;
        public float filterR = 1f;
        public float filterG = 0.97f;
        public float filterB = 0.92f;
    }

    /// <summary>Ambient occlusion for the level. URP 17 keeps this on the renderer feature,
    /// not on the volume profile.</summary>
    public sealed class PostOcclusion : PostComponent
    {
        public float intensity = 0.45f;
        public float radius = 0.25f;
    }

    /// <summary>Post-processing for one built level. Components are added by type.</summary>
    public sealed class PostVolume
    {
        public readonly List<PostComponent> components = new List<PostComponent>();

        public T Add<T>() where T : PostComponent, new()
        {
            var component = new T();
            components.Add(component);
            return component;
        }

        public T Get<T>() where T : PostComponent
        {
            foreach (var component in components)
                if (component is T hit) return hit;
            return null;
        }

        public static PostVolume For(DungeonMap map)
        {
            var volume = new PostVolume();
            if (map == null) return volume;
            volume.Add<PostBloom>();
            volume.Add<PostTonemapping>();
            volume.Add<PostColorAdjustments>();
            volume.Add<PostOcclusion>();
            return volume;
        }
    }
}
