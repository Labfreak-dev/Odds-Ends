using System.Collections.Generic;
using UnityEngine;

namespace Hollowmere
{
    public enum UiSfx { Click, Confirm, Back }

    /// <summary>Plays clips from Resources/Audio/&lt;key&gt; (ElevenLabs output or any pack).
    /// Missing clips are silently skipped, so sound can be added at any time.</summary>
    public sealed class AudioHub : MonoBehaviour
    {
        public static AudioHub I;
        readonly Dictionary<string, AudioClip> cache = new Dictionary<string, AudioClip>();
        readonly Dictionary<string, float> lastPlayed = new Dictionary<string, float>();
        AudioSource sfx, music;
        string musicKey;

        public float sfxVolume = 0.8f, musicVolume = 0.45f;

        void Awake()
        {
            I = this;
            sfx = gameObject.AddComponent<AudioSource>();
            music = gameObject.AddComponent<AudioSource>();
            music.loop = true;
            sfxVolume = PlayerPrefs.GetFloat("sfx", 0.8f);
            musicVolume = PlayerPrefs.GetFloat("music", 0.45f);
            music.volume = musicVolume;
        }

        AudioClip Clip(string key)
        {
            if (cache.TryGetValue(key, out var c)) return c;
            c = Resources.Load<AudioClip>("Audio/UI/" + key);
            if (c == null) c = Resources.Load<AudioClip>("Audio/" + key);
            if (c == null) c = UiArt.Clip(key);
            cache[key] = c;
            return c;
        }

        AudioClip Procedural(UiSfx sound)
        {
            string id = "proc_" + sound;
            if (cache.TryGetValue(id, out var c) && c != null) return c;
            c = sound == UiSfx.Confirm ? Tone(new[] { 880f, 1320f }, 0.09f, 16f)
                : sound == UiSfx.Back ? Tone(new[] { 420f }, 0.07f, 14f)
                : Tone(new[] { 1640f }, 0.035f, 32f);
            cache[id] = c;
            return c;
        }

        AudioClip ThemeLoop()
        {
            if (cache.TryGetValue("proc_theme", out var c) && c != null) return c;
            const int rate = 22050;
            const float len = 8f;
            int n = (int)(rate * len);
            var data = new float[n];
            for (int i = 0; i < n; i++)
            {
                float t = i / (float)rate;
                float a = 0.22f * (0.65f + 0.35f * Mathf.Sin(2f * Mathf.PI * t / len));
                data[i] = a * (
                    Mathf.Sin(2f * Mathf.PI * 110f * t) * 0.45f +
                    Mathf.Sin(2f * Mathf.PI * 165f * t) * 0.28f +
                    Mathf.Sin(2f * Mathf.PI * 220f * t) * 0.16f);
            }
            c = AudioClip.Create("title_theme", n, 1, rate, false);
            c.SetData(data, 0);
            cache["proc_theme"] = c;
            return c;
        }

        static AudioClip Tone(float[] freqs, float dur, float decay)
        {
            const int rate = 22050;
            int n = Mathf.Max(1, (int)(rate * dur));
            var data = new float[n];
            for (int i = 0; i < n; i++)
            {
                float t = i / (float)rate;
                float env = Mathf.Exp(-t * decay);
                float s = 0f;
                for (int k = 0; k < freqs.Length; k++) s += Mathf.Sin(2f * Mathf.PI * freqs[k] * t);
                data[i] = env * s / freqs.Length * 0.45f;
            }
            var clip = AudioClip.Create("ui", n, 1, rate, false);
            clip.SetData(data, 0);
            return clip;
        }

        public static void PlayUi(UiSfx sound)
        {
            if (I == null) return;
            string key = sound == UiSfx.Confirm ? "ui_confirm" : sound == UiSfx.Back ? "ui_back" : "ui_click";
            var c = I.Clip(key) ?? I.Procedural(sound);
            if (c == null) return;
            if (I.lastPlayed.TryGetValue(key, out var t) && Time.unscaledTime - t < 0.05f) return;
            I.lastPlayed[key] = Time.unscaledTime;
            I.sfx.PlayOneShot(c, 0.55f * I.sfxVolume);
        }

        public static void Play(string key, float volume = 1f)
        {
            if (I == null) return;
            var c = I.Clip(key);
            if (c == null) return;
            // Throttle: twenty hits in one frame should not be twenty sounds.
            if (I.lastPlayed.TryGetValue(key, out var t) && Time.unscaledTime - t < 0.06f) return;
            I.lastPlayed[key] = Time.unscaledTime;
            I.sfx.PlayOneShot(c, volume * I.sfxVolume);
        }

        public static void Music(string key)
        {
            if (I == null || I.musicKey == key) return;
            I.musicKey = key;
            var c = I.Clip(key);
            if (c == null && key == "title_theme") c = I.ThemeLoop();
            I.music.Stop();
            if (c == null) return;
            I.music.clip = c;
            I.music.volume = I.musicVolume;
            I.music.Play();
        }

        public static void SetVolumes(float sfxV, float musicV)
        {
            if (I == null) return;
            I.sfxVolume = sfxV; I.musicVolume = musicV;
            I.music.volume = musicV;
            PlayerPrefs.SetFloat("sfx", sfxV);
            PlayerPrefs.SetFloat("music", musicV);
        }
    }
}
