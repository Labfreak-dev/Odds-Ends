using System;
using System.Collections.Generic;
using System.Linq;

namespace Hollowmere.Core
{
    public enum MonsterRole { Melee, Ranged, Caster, Brute, Swarm }
    public enum MonsterRank { Normal, Champion, Elite, Minion, Boss }

    /// <summary>Elite affixes, D3 style. Each is implemented by the Unity MonsterController.</summary>
    public enum EliteAffix { Hasty, Armored, Vampiric, Molten, Frozen, Teleporter, Shielding, Plagued, Extra, Waller, Sweep, Pulse, Mortar, Jailer }

    public sealed class MonsterDef
    {
        public string id, name, model, family;
        public MonsterRole role;
        public float life = 1, damage = 1;      // multipliers on the level baseline
        public float speed = 3.2f, attackRange = 1.8f, attackCooldown = 1.4f, aggroRange = 11f, scale = 1f;
        public Element element = Element.Physical;
        public int minDepth = 1, maxDepth = 999;
        public float xp = 1;
        public string color = "#999999";       // primitive fallback tint
        public bool boss;
    }

    public sealed class MonsterStats
    {
        public MonsterDef def;
        public MonsterRank rank;
        public int level;
        public string displayName;
        public float maxLife, damage, speed, attackCooldown;
        public long xp;
        public List<EliteAffix> affixes = new List<EliteAffix>();
        public bool IsEliteish => rank == MonsterRank.Champion || rank == MonsterRank.Elite || rank == MonsterRank.Boss;
    }

    public static class MonsterDb
    {
        public static readonly List<MonsterDef> All = new List<MonsterDef>
        {
            // Crypts (1-10)
            new MonsterDef { id = "bonewalker", name = "Bonewalker", model = "mon_bonewalker", family = "Undead", role = MonsterRole.Melee, life = 1f, damage = 1f, minDepth = 1, maxDepth = 14, color = "#d8d0b8" },
            new MonsterDef { id = "boneslinger", name = "Boneslinger", model = "mon_bonewalker", family = "Undead", role = MonsterRole.Ranged, life = 0.7f, damage = 0.8f, attackRange = 9f, attackCooldown = 2f, minDepth = 2, maxDepth = 14, color = "#c8c0a0" },
            new MonsterDef { id = "gloomspider", name = "Gloomspider", model = "mon_gloomspider", family = "Beast", role = MonsterRole.Swarm, life = 0.35f, damage = 0.45f, speed = 4.6f, attackCooldown = 0.9f, minDepth = 1, maxDepth = 24, scale = 0.7f, element = Element.Poison, xp = 0.4f, color = "#3a2b4a" },
            // Caverns (8-22)
            new MonsterDef { id = "bogfiend", name = "Bogfiend", model = "mon_bogfiend", family = "Fiend", role = MonsterRole.Melee, life = 0.8f, damage = 0.9f, speed = 3.8f, minDepth = 6, maxDepth = 30, color = "#5f7a3a" },
            new MonsterDef { id = "bogshaman", name = "Bog Shaman", model = "mon_bogfiend", family = "Fiend", role = MonsterRole.Caster, life = 0.7f, damage = 1.1f, attackRange = 8f, attackCooldown = 2.4f, minDepth = 8, maxDepth = 30, element = Element.Poison, color = "#7aa04a" },
            new MonsterDef { id = "stonehulk", name = "Stonehulk", model = "mon_stonehulk", family = "Construct", role = MonsterRole.Brute, life = 3f, damage = 2f, speed = 2.3f, attackRange = 2.6f, attackCooldown = 2.2f, minDepth = 10, scale = 1.5f, xp = 2.5f, color = "#6e6a62" },
            // Sunken halls (18+)
            new MonsterDef { id = "drownedwraith", name = "Drowned Wraith", model = "mon_drownedwraith", family = "Undead", role = MonsterRole.Caster, life = 0.9f, damage = 1.2f, attackRange = 9f, attackCooldown = 2f, element = Element.Frost, minDepth = 16, color = "#7fb4c8" },
            new MonsterDef { id = "tidecrawler", name = "Tidecrawler", model = "mon_gloomspider", family = "Beast", role = MonsterRole.Swarm, life = 0.45f, damage = 0.5f, speed = 4.8f, attackCooldown = 0.9f, minDepth = 18, scale = 0.8f, xp = 0.45f, color = "#2e6f7a" },
            // Ember depths (28+)
            new MonsterDef { id = "cinderimp", name = "Cinder Imp", model = "mon_cinderimp", family = "Demon", role = MonsterRole.Ranged, life = 0.7f, damage = 1.1f, speed = 4.2f, attackRange = 8f, attackCooldown = 1.6f, element = Element.Fire, minDepth = 26, color = "#c4462a" },
            new MonsterDef { id = "magmahulk", name = "Magma Hulk", model = "mon_stonehulk", family = "Construct", role = MonsterRole.Brute, life = 3.2f, damage = 2.2f, speed = 2.3f, attackRange = 2.6f, attackCooldown = 2.2f, element = Element.Fire, minDepth = 28, scale = 1.6f, xp = 2.5f, color = "#8a3a1a" },

            // Bosses (every 5th floor), in rotation
            new MonsterDef { id = "boss_abbot", name = "The Drowned Abbot", model = "boss_abbot", family = "Boss", role = MonsterRole.Brute, life = 1, damage = 1.4f, speed = 2.6f, attackRange = 3.2f, attackCooldown = 1.8f, element = Element.Frost, scale = 2f, boss = true, xp = 1, color = "#3c6a7a" },
            new MonsterDef { id = "boss_matriarch", name = "Gloom Matriarch", model = "mon_gloomspider", family = "Boss", role = MonsterRole.Melee, life = 1, damage = 1.2f, speed = 3.6f, attackRange = 3f, attackCooldown = 1.4f, element = Element.Poison, scale = 2.6f, boss = true, color = "#4a2a5a" },
            new MonsterDef { id = "boss_ossuary", name = "Ossuary King", model = "mon_bonewalker", family = "Boss", role = MonsterRole.Melee, life = 1, damage = 1.5f, speed = 3f, attackRange = 3f, attackCooldown = 1.6f, scale = 2.2f, boss = true, color = "#e6dcc0" },
            new MonsterDef { id = "boss_furnace", name = "Furnace Heart", model = "mon_stonehulk", family = "Boss", role = MonsterRole.Brute, life = 1, damage = 1.7f, speed = 2.2f, attackRange = 3.4f, attackCooldown = 2f, element = Element.Fire, scale = 2.4f, boss = true, color = "#b0401a" },
        };

        public static MonsterDef Get(string id) => All.FirstOrDefault(m => m.id == id);

        public static List<MonsterDef> ForDepth(int depth)
        {
            // Past the deepest band the pool loops with everything unlocked.
            var pool = All.Where(m => !m.boss && depth >= m.minDepth && depth <= m.maxDepth).ToList();
            return pool.Count > 0 ? pool : All.Where(m => !m.boss).ToList();
        }

        public static MonsterDef BossFor(int depth)
        {
            var bosses = All.Where(m => m.boss).ToList();
            int n = Math.Max(0, depth / Balance.BossEvery - 1);
            // Introduce them in a fixed order so floor 5 is always the Ossuary King, etc.
            string[] order = { "boss_ossuary", "boss_matriarch", "boss_abbot", "boss_furnace" };
            return Get(order[n % order.Length]);
        }

        static readonly string[] ElitePrefix = { "Gorm", "Vex", "Ulda", "Krag", "Seth", "Morra", "Bryn", "Thol", "Iska", "Durn", "Wyl", "Ost" };
        static readonly string[] EliteSuffix = { "the Unwashed", "Gravebloom", "the Hungry", "Mirefang", "the Hollow", "Rotcoil", "the Patient", "Ashmaw", "the Drowned", "Bitterbone" };

        public static MonsterStats Create(MonsterDef def, int level, MonsterRank rank, Rng rng, int floor = 0)
        {
            var m = new MonsterStats { def = def, rank = rank, level = level, displayName = def.name };
            decimal lifeRank = 1m, dmgRank = 1m, xpRank = 1m;
            switch (rank)
            {
                case MonsterRank.Champion: lifeRank = 4m; dmgRank = 1.6m; xpRank = 4m; break;
                case MonsterRank.Elite: lifeRank = 7m; dmgRank = 1.9m; xpRank = 8m; break;
                case MonsterRank.Minion: lifeRank = 1.8m; dmgRank = 1.3m; xpRank = 1.5m; break;
                case MonsterRank.Boss: lifeRank = 28m; dmgRank = 2.2m; xpRank = 40m; break;
            }
            decimal lifeScale = DesignTable.LifeScale(floor);
            decimal dmgScale = DesignTable.DamageScale(floor);
            decimal life = DesignTable.RawLife(level) * (decimal)def.life * lifeRank * lifeScale;
            decimal dmg = DesignTable.RawDamage(level) * (decimal)def.damage * dmgRank * dmgScale;
            m.maxLife = (float)life;
            m.damage = (float)dmg;
            m.speed = def.speed;
            m.attackCooldown = def.attackCooldown;
            m.xp = DesignTable.RoundEven(DesignTable.Unit(level) * (decimal)def.xp * xpRank);

            int affixCount = DesignTable.AffixCount(rank, floor);
            var options = Enum.GetValues(typeof(EliteAffix)).Cast<EliteAffix>().ToList();
            rng.Shuffle(options);
            for (int i = 0; i < Math.Min(affixCount, options.Count); i++) m.affixes.Add(options[i]);
            if (m.affixes.Contains(EliteAffix.Hasty)) { m.speed *= 1.5f; m.attackCooldown *= 0.75f; }
            if (m.affixes.Contains(EliteAffix.Extra)) m.maxLife *= 1.5f;

            if (rank == MonsterRank.Elite)
                m.displayName = $"{rng.Pick(ElitePrefix)} {rng.Pick(EliteSuffix)}";
            else if (rank == MonsterRank.Champion)
                m.displayName = $"Champion {def.name}";
            return m;
        }

        public static string AffixName(EliteAffix a) => DesignTable.AffixName(a);
    }
}
