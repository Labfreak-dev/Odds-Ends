using System.Collections.Generic;
using UnityEngine;

namespace Hollowmere.StyleTest.Fishing
{
    public enum Rarity { Common, Uncommon, Rare, Epic, Legendary }
    public enum CatchKind { Fish, Treasure, Junk }

    /// <summary>One thing that can come out of the water. Model-agnostic references:
    /// icon = owned 2D icon under Resources/STO/Fish (gitignored, procedural fallback), model = "ST/Fish/q_koi" (CC0 FBX),
    /// "ST/Props/Bag", "gem:topaz" (repo gem mesh) or "box:RRGGBB" (procedural ingot).</summary>
    public class CatchDef
    {
        public string id, name, flavor, icon, model; public CatchKind kind; public Rarity rarity;
        public Color tint = Color.white; public float wMin, wMax; public int value;
        /// <summary>Reel fight: fish marker speed 0..1, how often it changes direction 0..1, and how hard progress drains.</summary>
        public float speed, erratic, pull;
    }

    /// <summary>A fishing water: display name, water colours and a weighted catch table.</summary>
    public class LocationDef
    {
        public string id, name, blurb; public Color water, deep; public readonly List<(string id, float w)> table = new List<(string, float)>();
        public float TotalWeight { get { float s = 0; foreach (var e in table) s += e.w; return s; } }
    }

    /// <summary>Static catch tables (same shape as StSkillDb): 5 waters (town + crypt/cave/sewer/mine), 34 catches
    /// (fish, treasure, junk) with weighted rarities. Roll() is deterministic for a given System.Random.</summary>
    public static class StFishDb
    {
        /// <summary>World units per old style-test "design unit" (hero 3.0 u tall). Follows the hero's bind height, so fishing
        /// sizes/offsets track the 1 u = 1 m conversion (hero 1.8 u -> U = 0.6) without code changes.</summary>
        public static float U => StActor.BindHeight / 3f;

        public static readonly Dictionary<string, CatchDef> Catches = new Dictionary<string, CatchDef>();
        public static readonly List<CatchDef> Order = new List<CatchDef>();
        public static readonly Dictionary<string, LocationDef> Locations = new Dictionary<string, LocationDef>();
        public static readonly List<LocationDef> LocOrder = new List<LocationDef>();

        /// <summary>Default table weight per rarity (an entry can override).</summary>
        public static float RarityWeight(Rarity r) => r == Rarity.Common ? 40 : r == Rarity.Uncommon ? 22 : r == Rarity.Rare ? 10 : r == Rarity.Epic ? 4 : 1.2f;

        public static Color RarityColor(Rarity r) => r == Rarity.Common ? new Color(0.82f, 0.84f, 0.86f) : r == Rarity.Uncommon ? new Color(0.36f, 0.86f, 0.36f)
            : r == Rarity.Rare ? new Color(0.3f, 0.6f, 1f) : r == Rarity.Epic ? new Color(0.75f, 0.4f, 1f) : new Color(1f, 0.66f, 0.18f);

        static CatchDef C(string id, string name, CatchKind k, Rarity r, string icon, string model, float wMin, float wMax, int value, float speed, float erratic, string flavor, Color? tint = null)
        {
            var c = new CatchDef { id = id, name = name, kind = k, rarity = r, icon = icon, model = model, wMin = wMin, wMax = wMax, value = value, speed = speed, erratic = erratic, flavor = flavor, tint = tint ?? Color.white };
            c.pull = k == CatchKind.Fish ? 0.12f + 0.05f * (int)r : 0.08f;
            Catches[id] = c; Order.Add(c); return c;
        }

        static LocationDef L(string id, string name, string blurb, Color water, Color deep, params string[] ids)
        {
            var l = new LocationDef { id = id, name = name, blurb = blurb, water = water, deep = deep };
            foreach (var i in ids) l.table.Add((i, RarityWeight(Catches[i].rarity)));
            Locations[id] = l; LocOrder.Add(l); return l;
        }

        static StFishDb()
        {
            const CatchKind F = CatchKind.Fish, T = CatchKind.Treasure, J = CatchKind.Junk;
            const Rarity Co = Rarity.Common, Un = Rarity.Uncommon, Ra = Rarity.Rare, Ep = Rarity.Epic, Le = Rarity.Legendary;
            // ---- town: the mill pond
            C("t_carp", "Mill Pond Carp", F, Co, "fish_t1", "ST/Fish/q_goldfish", 0.8f, 3.5f, 6, 0.25f, 0.3f, "Fat, lazy and everywhere.", new Color(0.78f, 0.62f, 0.42f));
            C("t_perch", "Reed Perch", F, Co, "wx_12", "ST/Fish/q_salmon", 0.3f, 1.2f, 5, 0.3f, 0.4f, "Hides in the reeds by the mill wheel.", new Color(0.62f, 0.9f, 0.5f));
            C("t_trout", "Brook Trout", F, Un, "fish_t2", "ST/Fish/q_salmon", 0.6f, 2.4f, 14, 0.45f, 0.45f, "Swims up from the river after rain.");
            C("t_koi", "Village Koi", F, Ra, "wx_08", "ST/Fish/q_koi", 1.0f, 4.0f, 40, 0.6f, 0.5f, "The miller swears he never stocked it.");
            C("t_goldkoi", "Golden Koi", F, Ep, "wx_14", "ST/Fish/q_koi", 2.0f, 6.0f, 120, 0.75f, 0.6f, "Said to grant one small wish. Small.", new Color(1.25f, 1.0f, 0.35f));
            C("t_lure", "Tangled Lure", J, Co, "lure_t1", "ST/Fish/q_lure", 0.1f, 0.1f, 1, 0.1f, 0.2f, "Someone else's bad day.");
            C("t_purse", "Lost Coin Purse", T, Un, "bag_t2", "ST/Props/Bag", 0.4f, 0.6f, 25, 0.2f, 0.2f, "Still heavy. Finders keepers.", new Color(0.82f, 0.66f, 0.45f));
            C("t_key", "Bronze Key", T, Ra, "key_t2", "box:B07A3A", 0.2f, 0.2f, 35, 0.2f, 0.3f, "Opens something in the tavern cellar?");
            // ---- crypt: the sunken ossuary basin
            C("c_carp", "Grave Carp", F, Co, "fish_t2", "ST/Fish/q_goldfish", 0.7f, 3.0f, 8, 0.3f, 0.3f, "Pale from never seeing the sun.", new Color(0.62f, 0.68f, 0.85f));
            C("c_bonefish", "Bonefish", F, Un, "fish_t7", "ST/Fish/q_fishbone", 0.3f, 1.1f, 18, 0.5f, 0.6f, "Swims fine without the meat.");
            C("c_ghostkoi", "Ghost Koi", F, Ra, "fish_t5", "ST/Fish/q_bluegold", 1.0f, 3.5f, 45, 0.6f, 0.55f, "You can see the pool floor through it.", new Color(0.85f, 0.95f, 1.35f));
            C("c_angler", "Gloom Angler", F, Ep, "wx_05", "ST/Fish/q_angler", 2.5f, 8.0f, 140, 0.8f, 0.7f, "Its lure is the only light down there.");
            C("c_hook", "Rusty Hook", J, Co, "hook_t1", "ST/Fish/q_lure", 0.05f, 0.05f, 1, 0.1f, 0.2f, "Tetanus, in hook form.", new Color(0.7f, 0.45f, 0.3f));
            C("c_medal", "Silver Medallion", T, Ra, "medal_t3", "box:C8CCD6", 0.3f, 0.3f, 60, 0.25f, 0.3f, "Engraved with a knight's crest.");
            C("c_reliquary", "Drowned Reliquary", T, Le, "chest_t6", "ST/Props/Chest_Wood", 6f, 9f, 400, 0.55f, 0.4f, "Sealed with wax and a curse.", new Color(0.42f, 0.36f, 0.5f));
            // ---- cave: the glimmer pool
            C("v_blind", "Blind Cavefish", F, Co, "fish_t7", "ST/Fish/q_salmon", 0.2f, 0.9f, 7, 0.3f, 0.35f, "Finds your hook by smell alone.", new Color(0.95f, 0.9f, 0.98f));
            C("v_tang", "Glowfin Tang", F, Un, "wx_10", "ST/Fish/q_tang", 0.4f, 1.6f, 16, 0.45f, 0.55f, "Its fins light the cave walls.");
            C("v_puffer", "Crystal Puffer", F, Ra, "wx_07", "ST/Fish/q_puffer", 0.8f, 2.6f, 50, 0.55f, 0.75f, "Spines of pure quartz. Handle with gloves.", new Color(0.65f, 0.95f, 1.35f));
            C("v_lion", "Amethyst Lionfish", F, Ep, "wx_20", "ST/Fish/q_lionfish", 1.5f, 4.5f, 150, 0.8f, 0.7f, "Grows its fins from the crystal veins.", new Color(1.05f, 0.72f, 1.35f));
            C("v_lure", "Lost Lure", J, Co, "lure_t2", "ST/Fish/q_lure", 0.1f, 0.1f, 2, 0.1f, 0.2f, "A miner's lure. The miner is not around.");
            C("v_sapphire", "Raw Sapphire", T, Un, "gem_t3", "gem:sapphire", 0.2f, 0.4f, 30, 0.2f, 0.3f, "Washed loose from the pool wall.");
            C("v_geode", "Star Geode", T, Le, "gem_t7", "gem:amethyst", 1.0f, 2.0f, 380, 0.6f, 0.5f, "There is a night sky inside.");
            // ---- sewer: the outflow channel
            C("s_sludge", "Sludge Carp", F, Co, "wx_13", "ST/Fish/q_goldfish", 0.8f, 4.0f, 5, 0.3f, 0.3f, "Eats anything. Tastes like it.", new Color(0.62f, 0.82f, 0.42f));
            C("s_ratfish", "Ratfish", F, Co, "wx_03", "ST/Fish/q_bigeye", 0.3f, 1.4f, 6, 0.35f, 0.5f, "Half rat. Mostly fish. Squeaks.", new Color(0.78f, 0.68f, 0.58f));
            C("s_tang", "Gutter Tang", F, Un, "wx_11", "ST/Fish/q_tang", 0.4f, 1.5f, 15, 0.5f, 0.55f, "Brightly coloured, against all odds.", new Color(0.62f, 1.0f, 0.72f));
            C("s_shark", "Sewer Shark", F, Le, "wx_04", "ST/Fish/q_shark", 18f, 40f, 500, 0.9f, 0.6f, "The city denies it exists.");
            C("s_hook", "Bent Hook", J, Co, "hook_t1", "ST/Fish/q_lure", 0.05f, 0.05f, 1, 0.1f, 0.2f, "Bent into a perfect question mark.", new Color(0.6f, 0.55f, 0.45f));
            C("s_purse", "Soggy Coin Purse", T, Un, "bag_t1", "ST/Props/Bag", 0.4f, 0.7f, 22, 0.2f, 0.2f, "Dropped through a street grate.", new Color(0.6f, 0.62f, 0.45f));
            C("s_signet", "Signet Medallion", T, Ra, "medal_t2", "box:B87333", 0.3f, 0.3f, 55, 0.25f, 0.3f, "Belonged to a guild master. Probably.");
            // ---- mine: the flooded shaft
            C("m_ironjaw", "Ironjaw Bigeye", F, Co, "wx_04", "ST/Fish/q_bigeye", 0.6f, 2.2f, 8, 0.35f, 0.35f, "Chews through ore carts for fun.", new Color(0.62f, 0.62f, 0.68f));
            C("m_canary", "Canaryfish", F, Co, "wx_15", "ST/Fish/q_butterfly", 0.2f, 0.8f, 7, 0.4f, 0.55f, "Stops singing when the air turns bad.");
            C("m_ember", "Ember Koi", F, Un, "wx_09", "ST/Fish/q_koi", 1.0f, 3.2f, 20, 0.5f, 0.5f, "Warm to the touch. Keep away from hay.", new Color(1.35f, 0.62f, 0.35f));
            C("m_sword", "Magma Swordfish", F, Ep, "wx_17", "ST/Fish/q_swordfish", 4f, 12f, 160, 0.85f, 0.6f, "Its bill glows like a forge poker.", new Color(1.35f, 0.58f, 0.42f));
            C("m_ore", "Copper Ore", T, Co, "ore_t2", "box:A0522D", 0.8f, 1.5f, 10, 0.2f, 0.25f, "Fell off a cart. Many carts.");
            C("m_ingot", "Gold Ingot", T, Ra, "ingot_t3", "box:E0A030", 1.0f, 1.0f, 90, 0.3f, 0.3f, "Stamped with the mine owner's mark.");
            C("m_strongbox", "Miner's Strongbox", T, Ep, "chest_t2", "ST/Props/Chest_Wood", 5f, 8f, 220, 0.5f, 0.4f, "Wages nobody came back for.", new Color(0.6f, 0.42f, 0.26f));

            L("town", "Mill Pond", "Town pond by the south road", new Color(0.26f, 0.5f, 0.62f), new Color(0.07f, 0.18f, 0.25f), "t_carp", "t_perch", "t_trout", "t_koi", "t_goldkoi", "t_lure", "t_purse", "t_key");
            L("crypt", "Ossuary Basin", "Flooded crypt basin", new Color(0.3f, 0.36f, 0.62f), new Color(0.05f, 0.06f, 0.16f), "c_carp", "c_bonefish", "c_ghostkoi", "c_angler", "c_hook", "c_medal", "c_reliquary");
            L("cave", "Glimmer Pool", "Crystal-lit cave pool", new Color(0.2f, 0.55f, 0.66f), new Color(0.03f, 0.16f, 0.22f), "v_blind", "v_tang", "v_puffer", "v_lion", "v_lure", "v_sapphire", "v_geode");
            L("sewer", "Outflow Channel", "Sewer channel (fish from the kerb)", new Color(0.26f, 0.48f, 0.36f), new Color(0.08f, 0.14f, 0.08f), "s_sludge", "s_ratfish", "s_tang", "s_shark", "s_hook", "s_purse", "s_signet");
            L("mine", "Flooded Shaft", "Flooded mine shaft", new Color(0.3f, 0.44f, 0.46f), new Color(0.1f, 0.09f, 0.07f), "m_ironjaw", "m_canary", "m_ember", "m_sword", "m_ore", "m_ingot", "m_strongbox");
        }

        /// <summary>Weighted roll from a water's table; weight in kg rolled toward the low end (big ones are rare).</summary>
        public static CatchDef Roll(string loc, System.Random rng, out float kg)
        {
            var l = Locations[loc]; float r = (float)rng.NextDouble() * l.TotalWeight; CatchDef pick = null;
            foreach (var e in l.table) { r -= e.w; if (r <= 0) { pick = Catches[e.id]; break; } }
            pick = pick ?? Catches[l.table[0].id];
            float u = (float)rng.NextDouble(); kg = Mathf.Lerp(pick.wMin, pick.wMax, u * u);
            return pick;
        }

        public static float Chance(string loc, string id)
        {
            var l = Locations[loc]; foreach (var e in l.table) if (e.id == id) return e.w / l.TotalWeight; return 0;
        }
    }
}
