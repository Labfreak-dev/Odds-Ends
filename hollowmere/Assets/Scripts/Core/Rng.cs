using System;
using System.Collections.Generic;

namespace Hollowmere.Core
{
    /// <summary>Deterministic xorshift64* generator. Floors, loot and fish all draw from one of
    /// these so a seed reproduces a run exactly (handy for tests and bug reports).</summary>
    [Serializable]
    public sealed class Rng
    {
        public ulong state;

        public Rng() : this((ulong)DateTime.UtcNow.Ticks) { }
        public Rng(ulong seed) { state = seed == 0 ? 0x9E3779B97F4A7C15UL : seed; NextU64(); }

        public static ulong Mix(ulong a, ulong b)
        {
            ulong z = a + 0x9E3779B97F4A7C15UL * (b + 1);
            z = (z ^ (z >> 30)) * 0xBF58476D1CE4E5B9UL;
            z = (z ^ (z >> 27)) * 0x94D049BB133111EBUL;
            return z ^ (z >> 31);
        }

        public ulong NextU64()
        {
            state ^= state >> 12;
            state ^= state << 25;
            state ^= state >> 27;
            return state * 0x2545F4914F6CDD1DUL;
        }

        /// <summary>[0,1)</summary>
        public float Value() => (NextU64() >> 40) / (float)(1UL << 24);

        public int Range(int minInclusive, int maxExclusive)
        {
            if (maxExclusive <= minInclusive) return minInclusive;
            return minInclusive + (int)(NextU64() % (ulong)(maxExclusive - minInclusive));
        }

        public float Range(float min, float max) => min + (max - min) * Value();
        public bool Chance(float p) => Value() < p;
        public T Pick<T>(IReadOnlyList<T> list) => list[Range(0, list.Count)];

        public int Weighted(IReadOnlyList<float> weights)
        {
            float total = 0;
            for (int i = 0; i < weights.Count; i++) total += Math.Max(0, weights[i]);
            if (total <= 0) return 0;
            float r = Value() * total;
            for (int i = 0; i < weights.Count; i++)
            {
                r -= Math.Max(0, weights[i]);
                if (r < 0) return i;
            }
            return weights.Count - 1;
        }

        public void Shuffle<T>(IList<T> list)
        {
            for (int i = list.Count - 1; i > 0; i--)
            {
                int j = Range(0, i + 1);
                (list[i], list[j]) = (list[j], list[i]);
            }
        }
    }
}
