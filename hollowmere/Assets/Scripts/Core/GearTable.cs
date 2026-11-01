using System;
using System.Collections.Generic;

namespace Hollowmere.Core
{
    /// <summary>
    /// Item and presentation table for armour tiers and weapon bases. Tier 3 is the
    /// authored v7b mesh. Tiers 1 and 2 use a CC0 mesh at Gear/Lower/&lt;family&gt;/&lt;slot&gt;
    /// when one is present, and otherwise the same v7b mesh. Finish R, G, B multiply
    /// the authored base colour. They do not replace the albedo, normal, or metal
    /// maps. Tier 1 is a worn rusty multiply, tier 2 a clean steel multiply, and
    /// tier 3 stays near the authored maps with a small emission accent. Each weapon
    /// base has its own model. A model is never shared across types. Grip sockets are
    /// per type and keep the prop origin within 5 cm of the hand.
    /// </summary>
    public static class GearTable
    {
        public const int TierCount = 3;
        public const float GripLimit = 0.05f;

        public static readonly string[] Families = { "plate", "leather", "arcane", "bone", "infernal" };

        public readonly struct Finish
        {
            public readonly float R, G, B, Metal, Smooth, Blend, Emit;
            public Finish(float r, float g, float b, float metal, float smooth, float blend, float emit)
            {
                R = r; G = g; B = b; Metal = metal; Smooth = smooth; Blend = blend; Emit = emit;
            }
        }

        public readonly struct Socket
        {
            public readonly float Palm, Pitch, Yaw, Roll, OffHand;
            public Socket(float palm, float pitch, float yaw, float roll, float offHand)
            {
                Palm = palm; Pitch = pitch; Yaw = yaw; Roll = roll; OffHand = offHand;
            }

            public float Reach => Palm < 0f ? -Palm : Palm;
        }

        public readonly struct WeaponRow
        {
            public readonly string Id, Name, Type, Model;
            public readonly ItemSlot Slot;
            public readonly float Lo, Hi, Aps;
            public readonly int Armor;
            public readonly bool TwoHand, Signature;
            public readonly HeroClass? ClassOnly;
            public readonly Element Element;
            /// <summary>R right hand, L left hand, Back the upper spine. From the CC0 manifest.</summary>
            public readonly string Hand;

            public WeaponRow(string id, string name, string type, string model, ItemSlot slot,
                float lo, float hi, float aps, bool twoHand, bool signature, int armor,
                HeroClass? cls, Element element, string hand)
            {
                Id = id; Name = name; Type = type; Model = model; Slot = slot;
                Lo = lo; Hi = hi; Aps = aps; TwoHand = twoHand; Signature = signature;
                Armor = armor; ClassOnly = cls; Element = element; Hand = hand;
            }
        }

        static readonly Finish[] Plate =
        {
            new Finish(0.58f, 0.36f, 0.22f, 0.02f, 0.08f, 1.00f, 0.00f),
            new Finish(1.32f, 1.36f, 1.42f, 0.74f, 0.58f, 1.00f, 0.00f),
            new Finish(1.04f, 1.03f, 0.98f, 0.80f, 0.66f, 0.30f, 0.12f),
        };
        static readonly Finish[] Leather =
        {
            new Finish(0.52f, 0.34f, 0.20f, 0.02f, 0.08f, 1.00f, 0.00f),
            new Finish(1.18f, 1.02f, 0.82f, 0.08f, 0.34f, 1.00f, 0.00f),
            new Finish(1.02f, 0.98f, 0.92f, 0.10f, 0.42f, 0.28f, 0.06f),
        };
        static readonly Finish[] Arcane =
        {
            new Finish(0.50f, 0.54f, 0.68f, 0.04f, 0.10f, 1.00f, 0.00f),
            new Finish(1.08f, 1.16f, 1.40f, 0.24f, 0.50f, 1.00f, 0.00f),
            new Finish(1.02f, 1.04f, 1.08f, 0.28f, 0.60f, 0.25f, 0.14f),
        };
        static readonly Finish[] Bone =
        {
            new Finish(0.60f, 0.48f, 0.32f, 0.02f, 0.08f, 1.00f, 0.00f),
            new Finish(1.22f, 1.12f, 0.88f, 0.10f, 0.30f, 1.00f, 0.00f),
            new Finish(1.04f, 1.00f, 0.92f, 0.16f, 0.36f, 0.28f, 0.08f),
        };
        static readonly Finish[] Infernal =
        {
            new Finish(0.46f, 0.26f, 0.18f, 0.04f, 0.08f, 1.00f, 0.00f),
            new Finish(1.20f, 1.02f, 0.90f, 0.42f, 0.34f, 1.00f, 0.00f),
            new Finish(1.02f, 0.96f, 0.90f, 0.40f, 0.48f, 0.25f, 0.16f),
        };

        static readonly WeaponRow[] Rows =
        {
            W("sword", "Sword", "sword", "sword_3", 3, 6, 1.4f),
            W("arming_sword", "Arming Sword", "sword", "sword_2", 3, 7, 1.35f),
            W("greatsword", "Greatsword", "sword", "sword_1", 8, 14, 1.05f, two: true, signature: true),
            W("handaxe", "Handaxe", "axe", "axe_2", 3, 6, 1.35f),
            W("axe", "Axe", "axe", "axe_1", 4, 7, 1.3f, signature: true),
            W("greataxe", "Great Axe", "axe", "axe_3", 7, 13, 1.0f, two: true, cls: HeroClass.Ironclad),
            W("club", "Club", "mace", "mace_2", 3, 7, 1.2f),
            W("mace", "Mace", "mace", "mace_1", 4, 8, 1.2f, signature: true),
            W("warhammer", "Warhammer", "mace", "mace_3", 8, 12, 0.95f, two: true, cls: HeroClass.Ironclad),
            W("javelin", "Javelin", "spear", "spear_2", 4, 8, 1.2f, two: true),
            W("spear", "Spear", "spear", "spear_1", 5, 10, 1.15f, two: true, signature: true),
            W("pike", "Pike", "spear", "spear_3", 6, 12, 0.95f, two: true),
            W("sickle", "Sickle", "scythe", "scythe_2", 3, 6, 1.3f, two: true),
            W("scythe", "Scythe", "scythe", "scythe_1", 7, 13, 1.0f, two: true, signature: true),
            W("warscythe", "Glaive", "scythe", "scythe_3", 8, 14, 0.9f, two: true),
            W("flail", "Flail", "flail", "flail_1", 4, 9, 1.25f, signature: true),
            W("chain", "Chain", "flail", "flail_2", 3, 7, 1.3f),
            W("ballflail", "Ball Flail", "flail", "flail_3", 5, 10, 1.1f),
            W("dagger", "Dagger", "dagger", "dagger_1", 2, 5, 1.6f),
            W("kris", "Kris", "dagger", "dagger_2", 2, 6, 1.45f),
            W("stiletto", "Stiletto", "dagger", "dagger_3", 1, 5, 1.7f),
            W("claw", "Claw", "fist", "fist_1", 2, 5, 1.7f),
            W("knuckle", "Knuckle", "fist", "fist_2", 2, 4, 1.75f),
            W("cestus", "Cestus", "fist", "fist_3", 3, 6, 1.5f),
            W("shortbow", "Shortbow", "bow", "bow_2", 3, 6, 1.5f, two: true, cls: HeroClass.Stalker, hand: "L"),
            W("bow", "Longbow", "bow", "bow_1", 4, 8, 1.4f, two: true, cls: HeroClass.Stalker, signature: true, hand: "L"),
            W("longbow", "Warbow", "bow", "bow_3", 5, 9, 1.2f, two: true, cls: HeroClass.Stalker, hand: "L"),
            W("handcrossbow", "Hand Crossbow", "crossbow", "crossbow_2", 4, 8, 1.25f, cls: HeroClass.Stalker),
            W("crossbow", "Crossbow", "crossbow", "crossbow_1", 6, 10, 1.1f, two: true, cls: HeroClass.Stalker, signature: true),
            W("arbalest", "Arbalest", "crossbow", "crossbow_3", 7, 12, 0.9f, two: true, cls: HeroClass.Stalker),
            W("sceptre", "Sceptre", "wand", "wand_2", 3, 6, 1.25f, cls: HeroClass.Hexweaver, element: Element.Arcane),
            W("wand", "Wand", "wand", "wand_1", 3, 6, 1.4f, cls: HeroClass.Hexweaver, element: Element.Arcane, signature: true),
            W("focus", "Focus", "wand", "wand_3", 2, 5, 1.35f, cls: HeroClass.Hexweaver, element: Element.Arcane),
            W("crook", "Crook", "staff", "staff_2", 4, 8, 1.05f, two: true, cls: HeroClass.Hexweaver, element: Element.Arcane),
            W("staff", "Staff", "staff", "staff_1", 6, 11, 1.0f, two: true, cls: HeroClass.Hexweaver, element: Element.Arcane, signature: true),
            W("warstaff", "War Staff", "staff", "staff_3", 7, 13, 0.9f, two: true, cls: HeroClass.Hexweaver, element: Element.Arcane),
            O("buckler", "Buckler", "shield", "shield_2", 6),
            O("shield", "Kite Shield", "shield", "shield_1", 12, signature: true),
            O("towershield", "Tower Shield", "shield", "shield_3", 18),
            O("crystal", "Crystal", "orb", "orb_2", 2, cls: HeroClass.Hexweaver),
            O("orb", "Source Orb", "orb", "orb_1", 2, cls: HeroClass.Hexweaver, signature: true),
            O("phylactery", "Phylactery", "orb", "orb_3", 3, cls: HeroClass.Hexweaver),
            O("quiver", "Quiver", "quiver", "quiver_1", 2, hand: "Back", cls: HeroClass.Stalker),
            O("boltcase", "Bolt Case", "quiver", "quiver_2", 2, hand: "Back", cls: HeroClass.Stalker),
            O("arrowbag", "Arrow Bag", "quiver", "quiver_3", 3, hand: "Back", cls: HeroClass.Stalker),
        };

        static readonly string[] Types =
        {
            "sword", "axe", "mace", "spear", "scythe", "flail", "dagger", "fist",
            "bow", "crossbow", "wand", "staff", "shield", "orb", "quiver",
        };

        public static IReadOnlyList<WeaponRow> Weapons => Rows;

        public static int TierOf(int stored, Rarity rarity)
            => stored >= 1 && stored <= TierCount ? stored : DesignTable.GearTier(rarity);

        public static float ArmorMul(int tier)
        {
            if (tier <= 1) return 0.8f;
            if (tier == 2) return 1f;
            return 1.25f;
        }

        public static bool VisibleArmor(ItemSlot slot)
        {
            for (int i = 0; i < GearFit.Visible.Length; i++)
                if ((int)GearFit.Visible[i] == (int)slot) return true;
            return false;
        }

        public static string FamilyFromSet(string setId)
        {
            if (string.IsNullOrEmpty(setId)) return null;
            string id = setId.StartsWith("set_") ? setId.Substring(4) : setId;
            for (int i = 0; i < Families.Length; i++)
                if (Families[i] == id) return Families[i];
            return null;
        }

        public static string RollFamily(Rng rng)
            => Families[rng.Range(0, Families.Length)];

        public static bool TryFinish(string family, int tier, out Finish finish)
        {
            finish = default;
            if (tier > TierCount || tier < 1) return false;
            Finish[] bank = family switch
            {
                "leather" => Leather,
                "arcane" => Arcane,
                "bone" => Bone,
                "infernal" => Infernal,
                _ => Plate,
            };
            finish = bank[tier - 1];
            return true;
        }

        public static bool TryRow(string id, out WeaponRow row)
        {
            for (int i = 0; i < Rows.Length; i++)
                if (Rows[i].Id == id) { row = Rows[i]; return true; }
            row = default;
            return false;
        }

        public static string ModelFor(string baseId)
            => TryRow(baseId, out var row) ? row.Model : baseId;

        public static string TypeOf(string baseId)
            => TryRow(baseId, out var row) ? row.Type : null;

        public static bool TrySocket(string baseId, out Socket socket)
        {
            string type = TypeOf(baseId);
            switch (type)
            {
                case "sword": socket = new Socket(0.03f, 0f, 0f, 0f, 0.32f); return true;
                case "axe": socket = new Socket(0.032f, 0f, 0f, 0f, 0.32f); return true;
                case "mace": socket = new Socket(0.04f, 0f, 0f, 0f, 0.30f); return true;
                case "spear": socket = new Socket(0.028f, 0f, 0f, 0f, 0.32f); return true;
                case "scythe": socket = new Socket(0.03f, 0f, 0f, 0f, 0.32f); return true;
                case "flail": socket = new Socket(0.04f, 0f, 0f, 0f, 0.30f); return true;
                case "dagger": socket = new Socket(0.025f, 0f, 0f, 0f, 0f); return true;
                case "fist": socket = new Socket(0.02f, 0f, 0f, 0f, 0f); return true;
                case "bow": socket = new Socket(0.03f, 0f, 0f, 0f, 0.30f); return true;
                case "crossbow": socket = new Socket(0.03f, 0f, 90f, 0f, 0.28f); return true;
                case "wand": socket = new Socket(0.028f, 0f, 0f, 0f, 0f); return true;
                case "staff": socket = new Socket(0.03f, 0f, 0f, 0f, 0.32f); return true;
                case "shield": socket = new Socket(0.03f, 0f, 90f, 0f, 0f); return true;
                case "orb": socket = new Socket(0.028f, 0f, 0f, 0f, 0f); return true;
                case "quiver": socket = new Socket(0.02f, 0f, 180f, 0f, 0f); return true;
                default: socket = default; return false;
            }
        }

        public static int CountType(string type)
        {
            int n = 0;
            for (int i = 0; i < Rows.Length; i++)
                if (Rows[i].Type == type) n++;
            return n;
        }

        public static int CountAll => Rows.Length;

        public static IReadOnlyList<string> WeaponTypes => Types;

        public static string Signature(string type)
        {
            for (int i = 0; i < Rows.Length; i++)
                if (Rows[i].Type == type && Rows[i].Signature) return Rows[i].Id;
            for (int i = 0; i < Rows.Length; i++)
                if (Rows[i].Type == type) return Rows[i].Id;
            return null;
        }

        public static void Register(List<ItemBase> bases, Dictionary<string, ItemBase> byId, List<SetDef> sets)
        {
            for (int i = 0; i < Rows.Length; i++)
            {
                var w = Rows[i];
                if (byId.TryGetValue(w.Id, out var have))
                {
                    have.model = w.Model;
                    continue;
                }
                var b = new ItemBase(w.Id, w.Name, w.Slot, w.Model)
                {
                    dmgMin = w.Lo, dmgMax = w.Hi, aps = w.Aps, twoHanded = w.TwoHand,
                    classOnly = w.ClassOnly, weaponElement = w.Element, armor = w.Armor,
                };
                bases.Add(b);
                byId[w.Id] = b;
            }
            AddFamily(sets, "set_plate", "Plate of the Gate", "helm", "pauldrons", "plate", "gauntlets", "bracers", "belt", "greaves", "boots");
            AddFamily(sets, "set_leather", "Leather of the Hunt", "hood", "mantle", "jerkin", "gloves", "bracers", "belt", "trousers", "boots");
            AddFamily(sets, "set_arcane", "Arcane Vestments", "hood", "mantle", "robe", "gloves", "bracers", "sash", "trousers", "waders");
            AddFamily(sets, "set_bone", "Bone Reliquary", "helm", "pauldrons", "plate", "gauntlets", "bracers", "belt", "greaves", "boots");
            AddFamily(sets, "set_infernal", "Infernal Harness", "helm", "pauldrons", "plate", "gauntlets", "bracers", "belt", "greaves", "boots");
        }

        static void AddFamily(List<SetDef> sets, string id, string name, params string[] pieces)
        {
            sets.Add(new SetDef
            {
                id = id, name = name, classOnly = null, pieces = pieces,
                bonuses = new[]
                {
                    (2, Stat.Armor, 40f, "+40 Armor"),
                    (4, Stat.AllResist, 30f, "+30 All Resist"),
                    (6, Stat.DamagePercent, 80f, "+80% Damage"),
                },
            });
        }

        static WeaponRow W(string id, string name, string type, string model, float lo, float hi, float aps,
            bool two = false, bool signature = false, HeroClass? cls = null, Element element = Element.Physical, string hand = "R")
            => new WeaponRow(id, name, type, model, ItemSlot.MainHand, lo, hi, aps, two, signature, 0, cls, element, hand);

        static WeaponRow O(string id, string name, string type, string model, int armor, bool signature = false, HeroClass? cls = null, string hand = "L")
            => new WeaponRow(id, name, type, model, ItemSlot.OffHand, 0f, 0f, 0f, false, signature, armor, cls, Element.Physical, hand);
    }
}
