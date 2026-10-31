using System;

namespace Hollowmere.Core
{
    public enum Stat
    {
        Strength, Dexterity, Intelligence, Vitality,
        Armor, AllResist, MaxLifePercent, LifePerSecond, LifeOnHit, LifePerKill,
        CritChance, CritDamage, AttackSpeed, CooldownReduction, ResourceCostReduction,
        DamagePercent, MinWeaponDamage, MaxWeaponDamage,
        FireDamage, FrostDamage, LightningDamage, PoisonDamage, ArcaneDamage, PhysicalDamage,
        AreaDamage, EliteDamage, DamageReduction, BlockChance, Thorns,
        MoveSpeed, MagicFind, GoldFind, PickupRadius, FishingLuck, PetDamage,
        MaxResource, ResourceRegen,
        Count
    }

    public enum Element { Physical, Fire, Frost, Lightning, Poison, Arcane }

    public enum HeroClass { Ironclad, Stalker, Hexweaver }

    /// <summary>What a weapon (and a skill) is for. One- and two-handed melee share Melee.</summary>
    public enum WeaponFamily { Melee, Ranged, Magic }

    public static class StatInfo
    {
        // {0} = value. Percent stats are stored as percentages (5 = 5%).
        static readonly string[] Formats =
        {
            "+{0} Strength", "+{0} Dexterity", "+{0} Intelligence", "+{0} Vitality",
            "+{0} Armor", "+{0} Resistance to All Elements", "+{0}% Life", "Regenerates {0} Life per Second",
            "+{0} Life per Hit", "+{0} Life after each Kill",
            "Critical Hit Chance +{0}%", "Critical Hit Damage +{0}%", "Attack Speed +{0}%",
            "Reduces cooldowns by {0}%", "Reduces resource costs by {0}%",
            "+{0}% Damage", "+{0} Minimum Damage", "+{0} Maximum Damage",
            "Fire skills deal {0}% more damage", "Frost skills deal {0}% more damage",
            "Lightning skills deal {0}% more damage", "Poison skills deal {0}% more damage",
            "Arcane skills deal {0}% more damage", "Physical skills deal {0}% more damage",
            "Chance to deal {0}% area damage on hit", "Increases damage against elites by {0}%",
            "Reduces damage taken by {0}%", "+{0}% Chance to Block", "Melee attackers take {0} damage",
            "+{0}% Movement Speed", "+{0}% Magic Find", "+{0}% Extra Gold", "Increases Gold and Health pickup radius by {0} yards",
            "+{0} Fishing Luck", "Your companion deals {0}% more damage",
            "+{0} Maximum Resource", "+{0} Resource Regeneration per Second",
        };

        public static string Describe(Stat s, float v)
        {
            string val = Math.Abs(v - Math.Round(v)) < 0.05f ? ((int)Math.Round(v)).ToString() : v.ToString("0.0");
            return string.Format(Formats[(int)s], val);
        }

        public static Stat MainStat(HeroClass c) => c switch
        {
            HeroClass.Ironclad => Stat.Strength,
            HeroClass.Stalker => Stat.Dexterity,
            _ => Stat.Intelligence,
        };

        public static Stat ElementStat(Element e) => e switch
        {
            Element.Fire => Stat.FireDamage,
            Element.Frost => Stat.FrostDamage,
            Element.Lightning => Stat.LightningDamage,
            Element.Poison => Stat.PoisonDamage,
            Element.Arcane => Stat.ArcaneDamage,
            _ => Stat.PhysicalDamage,
        };

        public static string ResourceName(HeroClass c) => c switch
        {
            HeroClass.Ironclad => "Fury",
            HeroClass.Stalker => "Focus",
            _ => "Arcana",
        };

        public static Stat ForFamily(WeaponFamily f) => f switch
        {
            WeaponFamily.Ranged => Stat.Dexterity,
            WeaponFamily.Magic => Stat.Intelligence,
            _ => Stat.Strength,
        };

        public static string ResourceFor(WeaponFamily f) => f switch
        {
            WeaponFamily.Ranged => "Focus",
            WeaponFamily.Magic => "Arcana",
            _ => "Fury",
        };

        public static bool IsMainStat(Stat s) => s == Stat.Strength || s == Stat.Dexterity || s == Stat.Intelligence;
    }

    /// <summary>Flat array of every stat. Additive throughout; percentages are combined by the formulas in Combat.</summary>
    [Serializable]
    public sealed class StatBlock
    {
        public float[] v = new float[(int)Stat.Count];

        public float this[Stat s]
        {
            get => v[(int)s];
            set => v[(int)s] = value;
        }

        public void Add(Stat s, float amount) => v[(int)s] += amount;

        public void Add(StatBlock other)
        {
            for (int i = 0; i < v.Length; i++) v[i] += other.v[i];
        }

        public StatBlock Clone()
        {
            var b = new StatBlock();
            Array.Copy(v, b.v, v.Length);
            return b;
        }
    }
}
