using System;

namespace Hollowmere.Core
{
    public struct Hit
    {
        public float amount;
        public bool crit, blocked;
        public Element element;
    }

    /// <summary>Damage formulas. D3-shaped: weapon damage x skill % x (1 + main stat/100) x additive
    /// damage% x element% x crit x elite%; incoming damage is cut by armour (physical) or
    /// resistance (elemental), then flat damage reduction, then block.</summary>
    public static class Combat
    {
        public sealed class Context
        {
            public Hero hero;
            public StatBlock stats;
            public float lifeFraction = 1;
            public float buffDamagePercent;  // War Cry etc.
            public float buffCritChance;
            public float buffCritDamage;
        }

        public static Hit HeroHit(Context c, SkillCast cast, bool targetIsElite, Rng rng, float extraMult = 1)
        {
            var s = c.stats;
            var (lo, hi, _) = c.hero.WeaponDamage(s);
            float baseDmg = rng.Range(lo, hi) * cast.weaponDamage;
            float main = s[c.hero.DamageStat()];
            float dmg = baseDmg * (1 + main / 100f) * (1 + (s[Stat.DamagePercent] + c.buffDamagePercent) / 100f);
            dmg *= 1 + s[StatInfo.ElementStat(cast.element)] / 100f;
            if (targetIsElite) dmg *= 1 + s[Stat.EliteDamage] / 100f;
            if (c.lifeFraction < 0.35f) dmg *= 1 + c.hero.LegendaryTotal(LegendaryEffect.LowLifeDamage) / 100f;
            float cc = Math.Min(100, s[Stat.CritChance] + c.buffCritChance) / 100f;
            bool crit = rng.Chance(cc);
            if (crit) dmg *= 1 + (s[Stat.CritDamage] + c.buffCritDamage) / 100f;
            return new Hit { amount = Math.Max(1, dmg * extraMult), crit = crit, element = cast.element };
        }

        /// <summary>Companion / thrall damage: a share of hero sheet damage, boosted by PetDamage.</summary>
        public static Hit PetHit(Context c, float share, Element el, Rng rng)
        {
            float dps = c.hero.SheetDps(c.stats);
            float dmg = dps * share * rng.Range(0.85f, 1.15f) * (1 + c.stats[Stat.PetDamage] / 100f);
            bool crit = rng.Chance(0.1f);
            if (crit) dmg *= 1.5f;
            return new Hit { amount = Math.Max(1, dmg), crit = crit, element = el };
        }

        public static Hit MonsterHit(float rawDamage, Element el, StatBlock heroStats, int monsterLevel, Rng rng, float extraReduction = 0)
        {
            float mit = el == Element.Physical
                ? Balance.ArmorMitigation(heroStats[Stat.Armor], monsterLevel)
                : Balance.ResistMitigation(heroStats[Stat.AllResist], monsterLevel);
            float dmg = rawDamage * (1 - mit);
            dmg *= 1 - Math.Min(0.75f, heroStats[Stat.DamageReduction] / 100f + extraReduction);
            bool blocked = rng.Chance(Math.Min(0.75f, heroStats[Stat.BlockChance] / 100f));
            if (blocked) dmg *= 0.4f;
            return new Hit { amount = Math.Max(1, dmg), blocked = blocked, element = el };
        }

        public static float LifeOnHit(StatBlock s, int targetsHit) => s[Stat.LifeOnHit] * Math.Min(targetsHit, 5);
    }
}
