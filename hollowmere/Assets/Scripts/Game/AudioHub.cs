using System.Collections.Generic;
using UnityEngine;

namespace Hollowmere
{
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
            c = Resources.Load<AudioClip>("Audio/" + key);
            cache[key] = c;
            return c;
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
