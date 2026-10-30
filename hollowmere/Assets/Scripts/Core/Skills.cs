using System;
using System.Collections.Generic;
using System.Linq;

namespace Hollowmere.Core
{
    public enum SkillShape { MeleeArc, Projectile, Cone, Nova, GroundTarget, Dash, Buff, Summon, Chain, Passive }

    /// <summary>A rune changes how a skill behaves. All fields are multipliers/adds over the base skill
    /// so the Unity executor can apply any rune without per-rune code.</summary>
    public sealed class RuneDef
    {
        public string id, name, text;
        public int unlockLevel;
        public Element? element;
        public float damageMult = 1, radiusMult = 1, cooldownMult = 1, costMult = 1;
        public int extraProjectiles, extraChains, pierce;
        public float slow, burnPct, healPct, stun, knockback, durationMult = 1;
    }

    public sealed class SkillDef
    {
        public string id, name, text;
        public HeroClass cls;
        public SkillShape shape;
        public int reqLevel;
        public int maxRank = 5;
        public bool primary;          // generator: no cost, builds resource
        public bool ultimate;
        public float weaponDamage;    // fraction of weapon damage at rank 1 (1.5 = 150%)
        public float perRank;         // added weaponDamage per extra rank
        public float cost, generate, cooldown;
        public float range = 2.5f, radius = 2f, duration;
        public int projectiles = 1, chains;
        public float slow, stun, knockback;
        public Element element = Element.Physical;
        public Stat passiveStat;
        public float passiveValue;    // per rank
        public string prereq;
        public List<RuneDef> runes = new List<RuneDef>();

        public float DamageAt(int rank) => weaponDamage + perRank * Math.Max(0, rank - 1);
    }

    [Serializable]
    public sealed class SkillRank
    {
        public string id;
        public int rank;
        public string rune;   // chosen rune id or empty
    }

    [Serializable]
    public sealed class SkillTreeState
    {
        public List<SkillRank> ranks = new List<SkillRank>();
        public int unspent;
        /// <summary>Slot 0 = primary attack button, 1..4 = skill buttons.</summary>
        public string[] bar = new string[5];

        public int Rank(string id) => ranks.FirstOrDefault(r => r.id == id)?.rank ?? 0;
        public string Rune(string id) => ranks.FirstOrDefault(r => r.id == id)?.rune;

        public bool CanRankUp(SkillDef s, int heroLevel)
        {
            if (unspent <= 0 || heroLevel < s.reqLevel) return false;
            int r = Rank(s.id);
            if (r >= s.maxRank) return false;
            // each extra rank needs 4 more levels than the skill's requirement
            if (heroLevel < s.reqLevel + r * 4) return false;
            if (s.prereq != null && Rank(s.prereq) == 0) return false;
            return true;
        }

        public bool RankUp(SkillDef s, int heroLevel)
        {
            if (!CanRankUp(s, heroLevel)) return false;
            var e = ranks.FirstOrDefault(r => r.id == s.id);
            if (e == null) ranks.Add(e = new SkillRank { id = s.id, rank = 0, rune = "" });
            e.rank++;
            unspent--;
            if (s.shape != SkillShape.Passive && !bar.Contains(s.id))
            {
                int slot = s.primary ? 0 : Array.FindIndex(bar, 1, b => string.IsNullOrEmpty(b));
                if (slot >= 0 && string.IsNullOrEmpty(bar[slot])) bar[slot] = s.id;
            }
            return true;
        }

        public bool SetRune(SkillDef s, string runeId, int heroLevel)
        {
            var e = ranks.FirstOrDefault(r => r.id == s.id);
            if (e == null || e.rank == 0) return false;
            if (string.IsNullOrEmpty(runeId)) { e.rune = ""; return true; }
            var rune = s.runes.FirstOrDefault(r => r.id == runeId);
            if (rune == null || heroLevel < rune.unlockLevel) return false;
            e.rune = runeId;
            return true;
        }

        /// <summary>Free respec in town.</summary>
        public void Reset(int heroLevel)
        {
            ranks.Clear();
            bar = new string[5];
            unspent = SkillDb.PointsAtLevel(heroLevel);
        }
    }

    /// <summary>Resolved numbers for one cast after rank, rune, gear and legendary powers.</summary>
    public sealed class SkillCast
    {
        public SkillDef skill;
        public RuneDef rune;
        public int rank;
        public Element element;
        public float weaponDamage, cost, generate, cooldown, radius, range, duration;
        public int projectiles, chains, pierce;
        public float slow, burnPct, healPct, stun, knockback;
    }

    public static class SkillDb
    {
        public static readonly List<SkillDef> All = new List<SkillDef>();
        public static SkillDef Get(string id) => id == null ? null : All.FirstOrDefault(s => s.id == id);
        public static IEnumerable<SkillDef> ForClass(HeroClass c) => All.Where(s => s.cls == c);

        /// <summary>One point per level from 2, plus a bonus point every 10 levels.</summary>
        public static int PointsAtLevel(int level) => Math.Max(0, level - 1) + level / 10 + 1;

        static SkillDb()
        {
            // ================= IRONCLAD (Strength, Fury) =================
            var c = HeroClass.Ironclad;
            Add(new SkillDef { id = "ic_cleave", name = "Cleave", cls = c, shape = SkillShape.MeleeArc, reqLevel = 1, primary = true, weaponDamage = 1.3f, perRank = 0.15f, generate = 6, range = 2.6f, radius = 2.6f, text = "Sweep the area in front of you. Generates Fury." },
                R("rn_cleave_rupture", "Rupture", 4, "Enemies killed explode for 50% more damage.", damage: 1.2f),
                R("rn_cleave_ember", "Burning Edge", 10, "Converts to Fire and sets enemies ablaze.", el: Element.Fire, burn: 0.4f),
                R("rn_cleave_wide", "Broad Swing", 18, "Hits a much wider arc.", radius: 1.5f));
            Add(new SkillDef { id = "ic_slam", name = "Ground Slam", cls = c, shape = SkillShape.Nova, reqLevel = 2, weaponDamage = 2.4f, perRank = 0.3f, cost = 20, radius = 4f, stun = 0.6f, text = "Smash the earth, damaging and stunning nearby enemies." },
                R("rn_slam_quake", "Aftershock", 6, "A second shockwave follows for half damage.", damage: 1.4f),
                R("rn_slam_frost", "Permafrost", 12, "Converts to Frost and slows by 60%.", el: Element.Frost, slow: 0.6f),
                R("rn_slam_wide", "Fault Line", 20, "Radius increased by 60%.", radius: 1.6f));
            Add(new SkillDef { id = "ic_charge", name = "Iron Charge", cls = c, shape = SkillShape.Dash, reqLevel = 4, weaponDamage = 1.8f, perRank = 0.25f, cost = 10, cooldown = 6, range = 9f, radius = 2f, knockback = 3f, text = "Charge forward, bowling over enemies in your path." },
                R("rn_charge_ram", "Battering Ram", 8, "Charge deals 80% more damage.", damage: 1.8f),
                R("rn_charge_quick", "Momentum", 14, "Cooldown reduced by 40%.", cd: 0.6f),
                R("rn_charge_storm", "Thunderclap", 22, "Converts to Lightning and stuns.", el: Element.Lightning, stun: 1f));
            Add(new SkillDef { id = "ic_whirl", name = "Whirling Steel", cls = c, shape = SkillShape.Nova, reqLevel = 8, weaponDamage = 3.2f, perRank = 0.4f, cost = 30, cooldown = 3, radius = 3.4f, duration = 2f, prereq = "ic_slam", text = "Spin for 2 seconds, shredding everything around you." },
                R("rn_whirl_blood", "Bloodspin", 12, "Heals 2% of maximum Life per enemy hit.", heal: 0.02f),
                R("rn_whirl_dust", "Dust Devils", 18, "Lasts 50% longer.", duration: 1.5f),
                R("rn_whirl_fire", "Cinder Storm", 26, "Converts to Fire.", el: Element.Fire, damage: 1.2f));
            Add(new SkillDef { id = "ic_warcry", name = "War Cry", cls = c, shape = SkillShape.Buff, reqLevel = 6, weaponDamage = 0, cost = 0, generate = 30, cooldown = 20, duration = 8, passiveStat = Stat.DamagePercent, passiveValue = 20, text = "Bellow a war cry: +20% damage and 30 Fury for 8 seconds." },
                R("rn_warcry_iron", "Iron Skin", 10, "Also reduces damage taken by 30%.", damage: 1f),
                R("rn_warcry_long", "Echoing Cry", 16, "Lasts twice as long.", duration: 2f),
                R("rn_warcry_heal", "Second Wind", 24, "Heals 25% of maximum Life.", heal: 0.25f));
            Add(new SkillDef { id = "ic_earthsplit", name = "Earthsplitter", cls = c, shape = SkillShape.Cone, reqLevel = 20, ultimate = true, weaponDamage = 9f, perRank = 1f, cost = 50, cooldown = 25, range = 10f, radius = 2.5f, stun = 1.5f, prereq = "ic_whirl", text = "Rend the ground in a long line before you." },
                R("rn_earth_lava", "Lava Rift", 26, "Converts to Fire and leaves burning ground.", el: Element.Fire, burn: 1f),
                R("rn_earth_quick", "Restless Earth", 32, "Cooldown reduced by 40%.", cd: 0.6f),
                R("rn_earth_big", "Cataclysm", 40, "Deals 60% more damage.", damage: 1.6f));
            Passive("ic_p_hide", "Thick Hide", c, 3, Stat.Armor, 0, "Armor increased by 6% per rank.", pct: 6);
            Passive("ic_p_bloodlust", "Bloodlust", c, 5, Stat.LifeOnHit, 0, "Gain Life on Hit equal to 1% of your Strength per rank.", pct: 1);
            Passive("ic_p_relentless", "Relentless", c, 10, Stat.CooldownReduction, 3, "Cooldowns reduced by 3% per rank.");
            Passive("ic_p_brute", "Brute Force", c, 15, Stat.DamagePercent, 6, "Damage increased by 6% per rank.");

            // ================= STALKER (Dexterity, Focus) =================
            c = HeroClass.Stalker;
            Add(new SkillDef { id = "st_twinshot", name = "Twin Shot", cls = c, shape = SkillShape.Projectile, reqLevel = 1, primary = true, weaponDamage = 0.75f, perRank = 0.08f, generate = 4, range = 14f, projectiles = 2, text = "Loose two arrows. Generates Focus." },
                R("rn_twin_pierce", "Barbed Shafts", 4, "Arrows pierce one extra enemy.", pierce: 1),
                R("rn_twin_poison", "Venom Tips", 10, "Converts to Poison; poisons for 40% over time.", el: Element.Poison, burn: 0.4f),
                R("rn_twin_triple", "Triple Shot", 18, "Fires a third arrow.", proj: 1));
            Add(new SkillDef { id = "st_volley", name = "Volley", cls = c, shape = SkillShape.Cone, reqLevel = 2, weaponDamage = 1.6f, perRank = 0.2f, cost = 22, range = 12f, projectiles = 5, radius = 1f, text = "Fire a fan of arrows." },
                R("rn_volley_wide", "Scattershot", 6, "Fires 3 more arrows.", proj: 3),
                R("rn_volley_frost", "Hoarfrost Arrows", 12, "Converts to Frost and slows by 50%.", el: Element.Frost, slow: 0.5f),
                R("rn_volley_heavy", "Heavy Draw", 20, "Arrows deal 50% more damage.", damage: 1.5f));
            Add(new SkillDef { id = "st_caltrops", name = "Caltrop Field", cls = c, shape = SkillShape.GroundTarget, reqLevel = 4, weaponDamage = 2.2f, perRank = 0.3f, cost = 15, cooldown = 5, range = 10f, radius = 3f, duration = 4f, slow = 0.4f, text = "Scatter caltrops that wound and slow." },
                R("rn_cal_fire", "Pitch Traps", 8, "Converts to Fire.", el: Element.Fire, damage: 1.2f),
                R("rn_cal_stun", "Bear Traps", 14, "Stuns enemies for 1.5 seconds.", stun: 1.5f),
                R("rn_cal_big", "Minefield", 22, "Radius increased by 50%.", radius: 1.5f));
            Add(new SkillDef { id = "st_roll", name = "Shadow Roll", cls = c, shape = SkillShape.Dash, reqLevel = 6, weaponDamage = 0, cost = 8, cooldown = 4, range = 6f, text = "Tumble a short distance." },
                R("rn_roll_smoke", "Smoke Bomb", 10, "Leave a cloud that slows enemies by 60%.", slow: 0.6f),
                R("rn_roll_quick", "Acrobat", 16, "Cooldown reduced by 50%.", cd: 0.5f),
                R("rn_roll_heal", "Second Breath", 24, "Heals 8% of maximum Life.", heal: 0.08f));
            Add(new SkillDef { id = "st_mark", name = "Hunter's Mark", cls = c, shape = SkillShape.Buff, reqLevel = 8, cooldown = 18, duration = 8, passiveStat = Stat.CritChance, passiveValue = 15, prereq = "st_volley", text = "+15% critical hit chance for 8 seconds." },
                R("rn_mark_deadly", "Deadeye", 12, "Also +50% critical hit damage.", damage: 1f),
                R("rn_mark_long", "Patient Hunter", 18, "Lasts twice as long.", duration: 2f),
                R("rn_mark_focus", "Predator", 26, "Restores 50 Focus.", damage: 1f));
            Add(new SkillDef { id = "st_rain", name = "Rain of Arrows", cls = c, shape = SkillShape.GroundTarget, reqLevel = 20, ultimate = true, weaponDamage = 7f, perRank = 0.9f, cost = 45, cooldown = 22, range = 12f, radius = 5f, duration = 3f, prereq = "st_mark", text = "Darken the sky with arrows over an area." },
                R("rn_rain_light", "Stormsky", 26, "Converts to Lightning.", el: Element.Lightning, damage: 1.2f),
                R("rn_rain_wide", "Endless Quiver", 32, "Radius +40% and lasts 50% longer.", radius: 1.4f, duration: 1.5f),
                R("rn_rain_quick", "Rapid Volley", 40, "Cooldown reduced by 40%.", cd: 0.6f));
            Passive("st_p_keen", "Keen Eye", c, 3, Stat.CritChance, 1.5f, "Critical hit chance +1.5% per rank.");
            Passive("st_p_swift", "Swift Feet", c, 5, Stat.MoveSpeed, 4, "Movement speed +4% per rank.");
            Passive("st_p_steady", "Steady Aim", c, 10, Stat.DamagePercent, 6, "Damage increased by 6% per rank.");
            Passive("st_p_opportunist", "Opportunist", c, 15, Stat.CritDamage, 12, "Critical hit damage +12% per rank.");

            // ================= HEXWEAVER (Intelligence, Arcana) =================
            c = HeroClass.Hexweaver;
            Add(new SkillDef { id = "hx_bolt", name = "Hex Bolt", cls = c, shape = SkillShape.Projectile, reqLevel = 1, primary = true, weaponDamage = 1.4f, perRank = 0.15f, generate = 3, range = 14f, element = Element.Arcane, text = "Hurl a bolt of arcane force." },
                R("rn_bolt_fire", "Firebolt", 4, "Converts to Fire and burns.", el: Element.Fire, burn: 0.3f),
                R("rn_bolt_split", "Splinter", 10, "Fires two extra bolts.", proj: 2, damage: 0.8f),
                R("rn_bolt_frost", "Rimebolt", 18, "Converts to Frost and slows.", el: Element.Frost, slow: 0.4f));
            Add(new SkillDef { id = "hx_frostring", name = "Frost Ring", cls = c, shape = SkillShape.Nova, reqLevel = 2, weaponDamage = 1.8f, perRank = 0.2f, cost = 18, cooldown = 4, radius = 4.5f, slow = 0.6f, element = Element.Frost, text = "Blast frost outward, slowing enemies." },
                R("rn_ring_shatter", "Shatter", 6, "Deals 60% more damage.", damage: 1.6f),
                R("rn_ring_deep", "Deep Freeze", 12, "Freezes enemies solid for 1.5 seconds.", stun: 1.5f),
                R("rn_ring_wide", "Glacial Bloom", 20, "Radius increased by 50%.", radius: 1.5f));
            Add(new SkillDef { id = "hx_chain", name = "Chain Spark", cls = c, shape = SkillShape.Chain, reqLevel = 4, weaponDamage = 2.0f, perRank = 0.25f, cost = 20, range = 12f, chains = 3, element = Element.Lightning, text = "Lightning that leaps between enemies." },
                R("rn_chain_more", "Forked Spark", 8, "Jumps 3 more times.", chains: 3),
                R("rn_chain_stun", "Overload", 14, "Stuns each target.", stun: 0.5f),
                R("rn_chain_void", "Void Arc", 22, "Converts to Arcane, deals 40% more damage.", el: Element.Arcane, damage: 1.4f));
            Add(new SkillDef { id = "hx_blink", name = "Blink", cls = c, shape = SkillShape.Dash, reqLevel = 6, cost = 10, cooldown = 6, range = 8f, text = "Teleport a short distance." },
                R("rn_blink_nova", "Displacement", 10, "Leaves a frost burst where you were.", el: Element.Frost, slow: 0.5f),
                R("rn_blink_quick", "Fleeting", 16, "Cooldown reduced by 50%.", cd: 0.5f),
                R("rn_blink_mend", "Mending Step", 24, "Heals 10% of maximum Life.", heal: 0.1f));
            Add(new SkillDef { id = "hx_thrall", name = "Bound Thrall", cls = c, shape = SkillShape.Summon, reqLevel = 8, weaponDamage = 1.2f, perRank = 0.2f, cost = 35, cooldown = 15, duration = 20, prereq = "hx_chain", text = "Bind a spectral thrall to fight beside you for 20 seconds." },
                R("rn_thrall_two", "Twin Bindings", 12, "Summons two thralls.", proj: 1),
                R("rn_thrall_fire", "Ember Thrall", 18, "Thrall deals Fire damage, 50% more.", el: Element.Fire, damage: 1.5f),
                R("rn_thrall_long", "Eternal Bond", 26, "Lasts twice as long.", duration: 2f));
            Add(new SkillDef { id = "hx_meteor", name = "Meteor", cls = c, shape = SkillShape.GroundTarget, reqLevel = 20, ultimate = true, weaponDamage = 10f, perRank = 1.2f, cost = 55, cooldown = 18, range = 12f, radius = 3.5f, duration = 0.01f, element = Element.Fire, text = "Call down a meteor." }.With(s => s.stun = 1f),
                R("rn_met_comet", "Comet", 26, "Converts to Frost and slows.", el: Element.Frost, slow: 0.6f),
                R("rn_met_molten", "Molten Impact", 32, "Leaves burning ground.", burn: 1.2f),
                R("rn_met_star", "Star Pact", 40, "Deals 60% more damage.", damage: 1.6f));
            Passive("hx_p_mind", "Arcane Mind", c, 3, Stat.MaxResource, 8, "Maximum Arcana +8 per rank.");
            Passive("hx_p_glass", "Glass Cannon", c, 5, Stat.DamagePercent, 8, "Damage +8% per rank, but Armor -5% per rank.");
            Passive("hx_p_attune", "Elemental Attunement", c, 10, Stat.CritChance, 1.5f, "Critical hit chance +1.5% per rank.");
            Passive("hx_p_familiar", "Familiar Bond", c, 15, Stat.PetDamage, 15, "Companion and thrall damage +15% per rank.");
        }

        static void Add(SkillDef s, params RuneDef[] runes)
        {
            s.runes.AddRange(runes);
            All.Add(s);
        }

        static void Passive(string id, string name, HeroClass c, int lvl, Stat stat, float perRank, string text, float pct = 0)
            => All.Add(new SkillDef { id = id, name = name, cls = c, shape = SkillShape.Passive, reqLevel = lvl, passiveStat = stat, passiveValue = perRank, weaponDamage = pct, text = text });

        static RuneDef R(string id, string name, int lvl, string text, Element? el = null, float damage = 1, float radius = 1, float cd = 1,
            float cost = 1, int proj = 0, int chains = 0, int pierce = 0, float slow = 0, float burn = 0, float heal = 0, float stun = 0, float duration = 1)
            => new RuneDef { id = id, name = name, unlockLevel = lvl, text = text, element = el, damageMult = damage, radiusMult = radius, cooldownMult = cd,
                costMult = cost, extraProjectiles = proj, extraChains = chains, pierce = pierce, slow = slow, burnPct = burn, healPct = heal, stun = stun, durationMult = duration };

        static SkillDef With(this SkillDef s, Action<SkillDef> f) { f(s); return s; }

        /// <summary>Resolve rank, rune, gear stats and legendary powers into the numbers for one cast.</summary>
        public static SkillCast Resolve(SkillDef s, Hero hero, StatBlock stats)
        {
            int rank = Math.Max(1, hero.skills.Rank(s.id));
            var rune = s.runes.FirstOrDefault(r => r.id == hero.skills.Rune(s.id));
            var cast = new SkillCast
            {
                skill = s, rune = rune, rank = rank,
                element = rune?.element ?? (s.element != Element.Physical ? s.element : hero.WeaponElement()),
                weaponDamage = s.DamageAt(rank) * (rune?.damageMult ?? 1),
                cost = s.cost * (rune?.costMult ?? 1) * (1 - Math.Min(0.75f, stats[Stat.ResourceCostReduction] / 100f)),
                generate = s.generate,
                cooldown = s.cooldown * (rune?.cooldownMult ?? 1) * (1 - Math.Min(0.6f, stats[Stat.CooldownReduction] / 100f)),
                radius = s.radius * (rune?.radiusMult ?? 1),
                range = s.range,
                duration = s.duration * (rune?.durationMult ?? 1),
                projectiles = s.projectiles + (rune?.extraProjectiles ?? 0),
                chains = s.chains + (rune?.extraChains ?? 0),
                pierce = rune?.pierce ?? 0,
                slow = Math.Max(s.slow, rune?.slow ?? 0),
                burnPct = rune?.burnPct ?? 0,
                healPct = rune?.healPct ?? 0,
                stun = Math.Max(s.stun, rune?.stun ?? 0),
                knockback = s.knockback,
            };
            foreach (var (leg, value) in hero.EquippedLegendaries())
            {
                if (leg.skillId != null && leg.skillId != s.id) continue;
                switch (leg.effect)
                {
                    case LegendaryEffect.SkillDamage: cast.weaponDamage *= 1 + value / 100f; break;
                    case LegendaryEffect.SkillCooldown: cast.cooldown *= 1 - value / 100f; break;
                    case LegendaryEffect.SkillRadius: cast.radius *= 1 + value / 100f; break;
                    case LegendaryEffect.SkillExtraProjectiles:
                        if (s.shape == SkillShape.Chain) cast.chains += (int)value; else cast.projectiles += (int)value;
                        break;
                }
            }
            return cast;
        }
    }
}
