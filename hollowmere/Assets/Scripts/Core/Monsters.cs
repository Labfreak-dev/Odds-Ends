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
            new MonsterDef { id = "bonewalker", name = "Bonewalker", model = "hm_skel_warrior", family = "Undead", role = MonsterRole.Melee, life = 1f, damage = 1f, minDepth = 1, maxDepth = 14, color = "#d8d0b8" },
            new MonsterDef { id = "boneslinger", name = "Boneslinger", model = "hm_skel_archer", family = "Undead", role = MonsterRole.Ranged, life = 0.7f, damage = 0.8f, attackRange = 9f, attackCooldown = 2f, minDepth = 2, maxDepth = 14, color = "#c8c0a0" },
            new MonsterDef { id = "gloomspider", name = "Gloomspider", model = "hm_spider", family = "Beast", role = MonsterRole.Swarm, life = 0.35f, damage = 0.45f, speed = 4.6f, attackCooldown = 0.9f, minDepth = 1, maxDepth = 24, element = Element.Poison, xp = 0.4f, color = "#3a2b4a" },
            // Caverns (8-22)
            new MonsterDef { id = "bogfiend", name = "Bogfiend", model = "hm_ghoul", family = "Fiend", role = MonsterRole.Melee, life = 0.8f, damage = 0.9f, speed = 3.8f, minDepth = 6, maxDepth = 30, color = "#5f7a3a" },
            new MonsterDef { id = "bogshaman", name = "Bog Shaman", model = "hm_cultist", family = "Fiend", role = MonsterRole.Caster, life = 0.7f, damage = 1.1f, attackRange = 8f, attackCooldown = 2.4f, minDepth = 8, maxDepth = 30, element = Element.Poison, color = "#7aa04a" },
            new MonsterDef { id = "stonehulk", name = "Stonehulk", model = "hm_demon_brute", family = "Construct", role = MonsterRole.Brute, life = 3f, damage = 2f, speed = 2.3f, attackRange = 2.6f, attackCooldown = 2.2f, minDepth = 10, xp = 2.5f, color = "#6e6a62" },
            // Sunken halls (18+)
            new MonsterDef { id = "drownedwraith", name = "Drowned Wraith", model = "hm_zombie", family = "Undead", role = MonsterRole.Caster, life = 0.9f, damage = 1.2f, attackRange = 9f, attackCooldown = 2f, element = Element.Frost, minDepth = 16, color = "#7fb4c8" },
            new MonsterDef { id = "tidecrawler", name = "Tidecrawler", model = "hm_rat", family = "Beast", role = MonsterRole.Swarm, life = 0.45f, damage = 0.5f, speed = 4.8f, attackCooldown = 0.9f, minDepth = 18, xp = 0.45f, color = "#2e6f7a" },
            // Ember depths (28+)
            new MonsterDef { id = "cinderimp", name = "Cinder Imp", model = "hm_bat", family = "Demon", role = MonsterRole.Ranged, life = 0.7f, damage = 1.1f, speed = 4.2f, attackRange = 8f, attackCooldown = 1.6f, element = Element.Fire, minDepth = 26, color = "#c4462a" },
            new MonsterDef { id = "magmahulk", name = "Magma Hulk", model = "hm_demon_brute", family = "Construct", role = MonsterRole.Brute, life = 3.2f, damage = 2.2f, speed = 2.3f, attackRange = 2.6f, attackCooldown = 2.2f, element = Element.Fire, minDepth = 28, xp = 2.5f, color = "#8a3a1a" },

            // v6 bands. The live game replaces this with the biome roster.
            new MonsterDef { id = "grave_eater", name = "Grave Eater", model = "hm_grave_eater", family = "Undead", role = MonsterRole.Melee, life = 1.1f, damage = 1.05f, minDepth = 1, maxDepth = 5, color = "#6a5340" },
            new MonsterDef { id = "wraith", name = "Wraith", model = "hm_wraith", family = "Undead", role = MonsterRole.Caster, life = 0.85f, damage = 1.1f, speed = 3.4f, attackRange = 8f, attackCooldown = 2f, element = Element.Frost, minDepth = 1, maxDepth = 5, color = "#9ec4d4" },
            new MonsterDef { id = "horror_ghoul", name = "Horror Ghoul", model = "hm_horror_ghoul", family = "Undead", role = MonsterRole.Melee, life = 1.2f, damage = 1.15f, speed = 3.6f, minDepth = 2, maxDepth = 5, color = "#3a4030" },
            new MonsterDef { id = "drowned_husk", name = "Drowned Husk", model = "hm_drowned_husk", family = "Undead", role = MonsterRole.Melee, life = 1.15f, damage = 1f, minDepth = 6, maxDepth = 10, color = "#4a6a62" },
            new MonsterDef { id = "cave_crawler", name = "Cave Crawler", model = "hm_cave_crawler", family = "Beast", role = MonsterRole.Swarm, life = 0.55f, damage = 0.6f, speed = 4.4f, attackCooldown = 1f, minDepth = 6, maxDepth = 10, xp = 0.5f, color = "#5a4030" },
            new MonsterDef { id = "warwolf", name = "Warwolf", model = "hm_warwolf", family = "Beast", role = MonsterRole.Brute, life = 1.6f, damage = 1.3f, speed = 4.2f, scale = 0.62f, minDepth = 6, maxDepth = 10, xp = 1.4f, color = "#6a5a48" },
            new MonsterDef { id = "vampire_bat", name = "Vampire Bat", model = "hm_vampire_bat", family = "Beast", role = MonsterRole.Swarm, life = 0.4f, damage = 0.45f, speed = 5f, attackCooldown = 0.8f, minDepth = 6, maxDepth = 10, xp = 0.35f, color = "#3a2030" },
            new MonsterDef { id = "bone_golem", name = "Bone Golem", model = "hm_bone_golem", family = "Construct", role = MonsterRole.Brute, life = 2.8f, damage = 1.8f, speed = 2.2f, attackRange = 2.4f, attackCooldown = 2f, minDepth = 11, maxDepth = 15, xp = 2.2f, color = "#d8d0c0" },
            new MonsterDef { id = "cultist_smith", name = "Cultist Smith", model = "hm_cultist_smith", family = "Cult", role = MonsterRole.Melee, life = 1.2f, damage = 1.35f, attackRange = 2.2f, minDepth = 11, maxDepth = 15, color = "#6a3030" },
            new MonsterDef { id = "forest_brute", name = "Forest Brute", model = "hm_forest_brute", family = "Beast", role = MonsterRole.Brute, life = 2.4f, damage = 1.6f, speed = 2.4f, scale = 0.72f, attackRange = 2.6f, minDepth = 11, maxDepth = 15, xp = 2f, color = "#3a5a30" },
            new MonsterDef { id = "hellhound", name = "Hellhound", model = "hm_hellhound", family = "Demon", role = MonsterRole.Melee, life = 1.1f, damage = 1.2f, speed = 4.8f, element = Element.Fire, minDepth = 16, color = "#c04020" },
            new MonsterDef { id = "imp", name = "Imp", model = "hm_imp", family = "Demon", role = MonsterRole.Ranged, life = 0.7f, damage = 1f, speed = 4f, attackRange = 8f, element = Element.Fire, minDepth = 16, color = "#e07030" },

            // Bosses (every 5th floor), in rotation
            new MonsterDef { id = "boss_abbot", name = "The Drowned Abbot", model = "hm_zombie", family = "Boss", role = MonsterRole.Brute, life = 1, damage = 1.4f, speed = 2.6f, attackRange = 3.2f, attackCooldown = 1.8f, element = Element.Frost, scale = 1.15f, boss = true, xp = 1, color = "#3c6a7a" },
            new MonsterDef { id = "boss_matriarch", name = "Gloom Matriarch", model = "hm_spider", family = "Boss", role = MonsterRole.Melee, life = 1, damage = 1.2f, speed = 3.6f, attackRange = 3f, attackCooldown = 1.4f, element = Element.Poison, scale = 1.35f, boss = true, color = "#4a2a5a" },
            new MonsterDef { id = "boss_ossuary", name = "Ossuary King", model = "hm_ossuary_king", family = "Boss", role = MonsterRole.Melee, life = 1, damage = 1.5f, speed = 3f, attackRange = 3f, attackCooldown = 1.6f, boss = true, xp = 1, color = "#e6dcc0" },
            new MonsterDef { id = "boss_furnace", name = "Furnace Heart", model = "hm_demon_lord", family = "Boss", role = MonsterRole.Brute, life = 1, damage = 1.7f, speed = 2.2f, attackRange = 3.4f, attackCooldown = 2f, element = Element.Fire, boss = true, color = "#b0401a" },
            new MonsterDef { id = "boss_mutant", name = "Giant Mutant", model = "hm_giant_mutant", family = "Boss", role = MonsterRole.Brute, life = 1, damage = 1.6f, speed = 2.4f, attackRange = 3.2f, attackCooldown = 1.8f, scale = 1.05f, boss = true, color = "#6a7a40" },
            new MonsterDef { id = "boss_lava", name = "Lava Golem", model = "hm_lava_golem", family = "Boss", role = MonsterRole.Brute, life = 1, damage = 1.7f, speed = 2f, attackRange = 3.2f, attackCooldown = 2f, element = Element.Fire, scale = 1.55f, boss = true, color = "#ff5a18" },
        };

        static string[] rosterIds;
        static EliteAffix[] affixPool;

        public static MonsterDef Get(string id) => All.FirstOrDefault(m => m.id == id);

        /// <summary>The biome's roster replaces the depth filter until the next floor or town.</summary>
        public static void UseRoster(string[] ids) { rosterIds = ids; }
        public static void ClearRoster() { rosterIds = null; }

        /// <summary>Affixes the game may roll. Null keeps the full enum, which the core tests use.</summary>
        public static void UseAffixes(EliteAffix[] ids) { affixPool = ids; }

        public static List<MonsterDef> ForDepth(int depth)
        {
            if (rosterIds != null && rosterIds.Length > 0)
            {
                var picked = new List<MonsterDef>();
                for (int i = 0; i < rosterIds.Length; i++)
                {
                    var d = Get(rosterIds[i]);
                    if (d != null && !d.boss) picked.Add(d);
                }
                if (picked.Count > 0) return picked;
            }
            // Past the deepest band the pool loops with everything unlocked.
            var pool = All.Where(m => !m.boss && depth >= m.minDepth && depth <= m.maxDepth).ToList();
            return pool.Count > 0 ? pool : All.Where(m => !m.boss).ToList();
        }

        public static MonsterDef BossFor(int depth)
        {
            var bosses = All.Where(m => m.boss).ToList();
            int n = Math.Max(0, depth / Balance.BossEvery - 1);
            // Introduce them in a fixed order so floor 5 is always the Ossuary King, etc.
            string[] order = { "boss_ossuary", "boss_matriarch", "boss_abbot", "boss_furnace", "boss_mutant", "boss_lava" };
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
            var options = affixPool != null && affixPool.Length > 0
                ? affixPool.ToList()
                : Enum.GetValues(typeof(EliteAffix)).Cast<EliteAffix>().ToList();
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
