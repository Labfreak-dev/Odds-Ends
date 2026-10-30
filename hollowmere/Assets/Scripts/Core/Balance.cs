using System;

namespace Hollowmere.Core
{
    public enum Difficulty { Normal, Hard, Expert, Master, Torment1, Torment2, Torment3, Torment4, Torment5, Torment6 }

    /// <summary>Every tuning curve in one place. Monster numbers are derived from what a hero of the
    /// same level is expected to have, so the game stays self-consistent as the item tables change.</summary>
    public static class Balance
    {
        public const int MaxLevel = 70;
        public const int InventorySize = 40;
        public const int StashSize = 120;

        public static readonly string[] DifficultyNames =
            { "Normal", "Hard", "Expert", "Master", "Torment I", "Torment II", "Torment III", "Torment IV", "Torment V", "Torment VI" };

        public static float MonsterLifeMult(Difficulty d) => new[] { 1f, 2f, 3.2f, 5.1f, 8.2f, 13f, 21f, 34f, 54f, 86f }[(int)d];
        public static float MonsterDamageMult(Difficulty d) => new[] { 1f, 1.3f, 1.6f, 2f, 2.5f, 3.1f, 3.9f, 4.9f, 6.1f, 7.6f }[(int)d];
        public static float XpBonus(Difficulty d) => new[] { 0f, 0.75f, 1f, 1.5f, 2f, 3f, 4f, 6f, 8f, 11f }[(int)d];
        public static float GoldBonus(Difficulty d) => XpBonus(d);
        public static float LegendaryBonus(Difficulty d) => new[] { 0f, 0f, 0.1f, 0.2f, 0.4f, 0.6f, 0.8f, 1.0f, 1.3f, 1.6f }[(int)d];
        public static int MinLevelFor(Difficulty d) => new[] { 1, 1, 1, 1, 70, 70, 70, 70, 70, 70 }[(int)d];

        public static long XpToNext(int level) => level >= MaxLevel ? long.MaxValue : (long)Math.Round(120 * Math.Pow(level, 1.75));

        /// <summary>Monster level follows depth (Fate-style: deeper is harder), about one level per floor,
        /// reaching the cap around floor 64. A hero who outlevels a floor finds it easy; difficulty
        /// is the dial for that. heroLevel only lifts the floor's level when the hero is far ahead,
        /// so revisiting floor 1 at level 60 still drops useful items.</summary>
        public static int MonsterLevel(int depth, int heroLevel) =>
            Math.Clamp(Math.Max(depth + depth / 10, heroLevel - 10), 1, MaxLevel + 3);

        public static int ItemLevelFor(int monsterLevel, bool elite) => Math.Clamp(monsterLevel + (elite ? 1 : 0), 1, MaxLevel);

        public static float WeaponScale(int ilvl) { float x = ilvl - 1; return 1 + 0.09f * x + 0.0035f * x * x; }
        public static float ArmorScale(int ilvl) => WeaponScale(ilvl) * 2f;

        public static float BaseMainStat(int level) => 7 + 3 * level;
        public static float BaseOffStat(int level) => 7 + 1 * level;
        public static float BaseVitality(int level) => 7 + 2 * level;
        public static float LifeFromVitality(float vit) => vit * 10f;
        public static float BaseLife(int level) => 40 + 10 * level;

        public static float ArmorMitigation(float armor, int attackerLevel) => armor <= 0 ? 0 : armor / (armor + 50f * attackerLevel);
        public static float ResistMitigation(float resist, int attackerLevel) => resist <= 0 ? 0 : resist / (resist + 5f * attackerLevel);

        /// <summary>What a reasonably geared hero does per second at this level (rares in every slot).</summary>
        public static float ExpectedHeroDps(int level)
        {
            float weapon = 4.5f * WeaponScale(level) * 1.3f;
            float gearMain = 9 * AffixMid("str", level);
            float main = BaseMainStat(level) + gearMain;
            float crit = 1 + (0.05f + 0.12f) * (0.5f + 0.6f);
            return weapon * (1 + main / 100f) * crit;
        }

        /// <summary>Seconds of expected-hero DPS a normal monster soaks. Real heroes outgear the
        /// expected curve as affixes, crit damage and passives stack, so this ramps from 1.6s at the
        /// start to 4s by level 35 (simulated: ~1-1.5s per normal for a hero keeping upgrades).</summary>
        public static float MonsterToughness(int level) => 1.6f + 2.4f * Math.Clamp((level - 5) / 30f, 0f, 1f);

        public static float ExpectedHeroLife(int level) => BaseLife(level) + LifeFromVitality(BaseVitality(level) + 5 * AffixMid("vit", level));

        static float AffixMid(string id, int ilvl)
        {
            var a = ItemDb.Affix(id);
            float t = Math.Clamp((ilvl - 1) / 69f, 0f, 1f);
            return ((a.lo1 + (a.lo70 - a.lo1) * t) + (a.hi1 + (a.hi70 - a.hi1) * t)) * 0.5f;
        }

        // Pack sizes and spawn odds per floor
        public const float ChampionPackChance = 0.12f;
        public const float ElitePackChance = 0.08f;
        public const float FishingPoolChance = 0.6f;
        public const int BossEvery = 5;
    }
}
