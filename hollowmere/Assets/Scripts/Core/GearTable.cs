using System;
using System.Collections.Generic;

namespace Hollowmere.Core
{
    /// <summary>
    /// Item and presentation table for armour tiers and weapon bases. Tier 3 is the
    /// authored v7b mesh. Tiers 1 and 2 use a CC0 mesh at Gear/Lower/&lt;family&gt;/&lt;slot&gt;
    /// when one is present, and otherwise the same v7b mesh with this finish: no
    /// emission, and a tint that is not the authored material. Each weapon base has
    /// its own model. A model is never shared across types. Grip sockets are per type
    /// and keep the prop origin within 5 cm of the hand.
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

            public WeaponRow(string id, string name, string type, string model, ItemSlot slot,
                float lo, float hi, float aps, bool twoHand, bool signature, int armor,
                HeroClass? cls, Element element)
            {
                Id = id; Name = name; Type = type; Model = model; Slot = slot;
                Lo = lo; Hi = hi; Aps = aps; TwoHand = twoHand; Signature = signature;
                Armor = armor; ClassOnly = cls; Element = element;
            }
        }

        static readonly Finish[] Plate =
        {
            new Finish(0.55f, 0.32f, 0.18f, 0.04f, 0.08f, 0.82f, 0.04f),
            new Finish(0.78f, 0.80f, 0.84f, 0.55f, 0.42f, 0.70f, 0.06f),
            new Finish(0.92f, 0.90f, 0.82f, 0.85f, 0.72f, 0.55f, 0.42f),
        };
        static readonly Finish[] Leather =
        {
            new Finish(0.48f, 0.32f, 0.18f, 0.02f, 0.10f, 0.80f, 0.03f),
            new Finish(0.62f, 0.44f, 0.26f, 0.06f, 0.28f, 0.62f, 0.05f),
            new Finish(0.78f, 0.58f, 0.32f, 0.12f, 0.48f, 0.45f, 0.22f),
        };
        static readonly Finish[] Arcane =
        {
            new Finish(0.42f, 0.44f, 0.55f, 0.04f, 0.12f, 0.78f, 0.04f),
            new Finish(0.55f, 0.62f, 0.86f, 0.15f, 0.40f, 0.60f, 0.10f),
            new Finish(0.72f, 0.78f, 1.00f, 0.25f, 0.62f, 0.40f, 0.55f),
        };
        static readonly Finish[] Bone =
        {
            new Finish(0.55f, 0.48f, 0.36f, 0.02f, 0.08f, 0.75f, 0.03f),
            new Finish(0.78f, 0.70f, 0.52f, 0.08f, 0.22f, 0.55f, 0.06f),
            new Finish(0.95f, 0.88f, 0.62f, 0.18f, 0.40f, 0.40f, 0.28f),
        };
        static readonly Finish[] Infernal =
        {
            new Finish(0.42f, 0.22f, 0.16f, 0.06f, 0.08f, 0.80f, 0.05f),
            new Finish(0.72f, 0.28f, 0.16f, 0.18f, 0.24f, 0.62f, 0.12f),
            new Finish(1.00f, 0.46f, 0.18f, 0.35f, 0.50f, 0.45f, 0.65f),
        };

        static readonly WeaponRow[] Rows =
        {
            W("sword", "Sword", "sword", 3, 6, 1.4f),
            W("arming_sword", "Arming Sword", "sword", 3, 7, 1.35f),
            W("greatsword", "Greatsword", "sword", 8, 14, 1.05f, two: true, signature: true),
            W("handaxe", "Handaxe", "axe", 3, 6, 1.35f),
            W("axe", "Axe", "axe", 4, 7, 1.3f, signature: true),
            W("greataxe", "Great Axe", "axe", 7, 13, 1.0f, two: true, cls: HeroClass.Ironclad),
            W("club", "Club", "mace", 3, 7, 1.2f),
            W("mace", "Mace", "mace", 4, 8, 1.2f, signature: true),
            W("warhammer", "Warhammer", "mace", 8, 12, 0.95f, two: true, cls: HeroClass.Ironclad),
            W("javelin", "Javelin", "spear", 4, 8, 1.2f),
            W("spear", "Spear", "spear", 5, 10, 1.15f, two: true, signature: true),
            W("pike", "Pike", "spear", 6, 12, 0.95f, two: true),
            W("sickle", "Sickle", "scythe", 3, 6, 1.3f),
            W("scythe", "Scythe", "scythe", 7, 13, 1.0f, two: true, signature: true),
            W("warscythe", "War Scythe", "scythe", 8, 14, 0.9f, two: true),
            W("flail", "Flail", "flail", 4, 9, 1.25f, signature: true),
            W("chain", "Chain", "flail", 3, 7, 1.3f),
            W("ballflail", "Ball Flail", "flail", 5, 10, 1.1f),
            W("dagger", "Dagger", "dagger", 2, 5, 1.6f),
            W("kris", "Kris", "dagger", 2, 6, 1.45f),
            W("stiletto", "Stiletto", "dagger", 1, 5, 1.7f),
            W("claw", "Claw", "fist", 2, 5, 1.7f),
            W("knuckle", "Knuckle", "fist", 2, 4, 1.75f),
            W("cestus", "Cestus", "fist", 3, 6, 1.5f),
            W("shortbow", "Shortbow", "bow", 3, 6, 1.5f, two: true, cls: HeroClass.Stalker),
            W("bow", "Longbow", "bow", 4, 8, 1.4f, two: true, cls: HeroClass.Stalker, signature: true),
            W("longbow", "Warbow", "bow", 5, 9, 1.2f, two: true, cls: HeroClass.Stalker),
            W("handcrossbow", "Hand Crossbow", "crossbow", 4, 8, 1.25f, cls: HeroClass.Stalker),
            W("crossbow", "Crossbow", "crossbow", 6, 10, 1.1f, two: true, cls: HeroClass.Stalker, signature: true),
            W("arbalest", "Arbalest", "crossbow", 7, 12, 0.9f, two: true, cls: HeroClass.Stalker),
            W("sceptre", "Sceptre", "wand", 3, 6, 1.25f, cls: HeroClass.Hexweaver, element: Element.Arcane),
            W("wand", "Wand", "wand", 3, 6, 1.4f, cls: HeroClass.Hexweaver, element: Element.Arcane, signature: true),
            W("focus", "Focus", "wand", 2, 5, 1.35f, cls: HeroClass.Hexweaver, element: Element.Arcane),
            W("crook", "Crook", "staff", 4, 8, 1.05f, two: true, cls: HeroClass.Hexweaver, element: Element.Arcane),
            W("staff", "Staff", "staff", 6, 11, 1.0f, two: true, cls: HeroClass.Hexweaver, element: Element.Arcane, signature: true),
            W("warstaff", "War Staff", "staff", 7, 13, 0.9f, two: true, cls: HeroClass.Hexweaver, element: Element.Arcane),
            O("buckler", "Buckler", "shield", 6),
            O("shield", "Kite Shield", "shield", 12, signature: true),
            O("towershield", "Tower Shield", "shield", 18),
            O("crystal", "Crystal", "orb", 2, cls: HeroClass.Hexweaver),
            O("orb", "Source Orb", "orb", 2, cls: HeroClass.Hexweaver, signature: true),
            O("phylactery", "Phylactery", "orb", 3, cls: HeroClass.Hexweaver),
            O("quiver", "Quiver", "quiver", 2, cls: HeroClass.Stalker),
            O("boltcase", "Bolt Case", "quiver", 2, cls: HeroClass.Stalker),
            O("arrowbag", "Arrow Bag", "quiver", 3, cls: HeroClass.Stalker),
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

        static WeaponRow W(string id, string name, string type, float lo, float hi, float aps,
            bool two = false, bool signature = false, HeroClass? cls = null, Element element = Element.Physical)
            => new WeaponRow(id, name, type, id, ItemSlot.MainHand, lo, hi, aps, two, signature, 0, cls, element);

        static WeaponRow O(string id, string name, string type, int armor, bool signature = false, HeroClass? cls = null)
            => new WeaponRow(id, name, type, id, ItemSlot.OffHand, 0f, 0f, 0f, false, signature, armor, cls, Element.Physical);
    }
}
