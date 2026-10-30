using System;
using System.Collections.Generic;
using System.Linq;

namespace Hollowmere.Core
{
    /// <summary>Static item tables: bases, affixes, legendary powers and sets.</summary>
    public static class ItemDb
    {
        public static readonly List<ItemBase> Bases = new List<ItemBase>();
        public static readonly List<AffixDef> Affixes = new List<AffixDef>();
        public static readonly List<LegendaryDef> Legendaries = new List<LegendaryDef>();
        public static readonly List<SetDef> Sets = new List<SetDef>();
        static readonly Dictionary<string, ItemBase> baseById = new Dictionary<string, ItemBase>();

        public static ItemBase Base(string id) => id != null && baseById.TryGetValue(id, out var b) ? b : null;
        public static LegendaryDef Legendary(string id) => Legendaries.FirstOrDefault(l => l.id == id);
        public static SetDef Set(string id) => Sets.FirstOrDefault(s => s.id == id);
        public static AffixDef Affix(string id) => Affixes.FirstOrDefault(a => a.id == id);

        static ItemDb()
        {
            // ---- weapons: dmg at ilvl 1, scaled by Loot.WeaponScale(ilvl)
            Weapon("sword", "Sword", 3, 6, 1.4f);
            Weapon("axe", "Axe", 4, 7, 1.3f);
            Weapon("mace", "Mace", 4, 8, 1.2f);
            Weapon("greataxe", "Great Axe", 7, 13, 1.0f, twoHanded: true, cls: HeroClass.Ironclad);
            Weapon("warhammer", "Warhammer", 8, 12, 0.95f, twoHanded: true, cls: HeroClass.Ironclad);
            Weapon("bow", "Longbow", 4, 8, 1.4f, twoHanded: true, cls: HeroClass.Stalker);
            Weapon("crossbow", "Crossbow", 6, 10, 1.1f, twoHanded: true, cls: HeroClass.Stalker);
            Weapon("dagger", "Dagger", 2, 5, 1.6f);
            Weapon("wand", "Wand", 3, 6, 1.4f, cls: HeroClass.Hexweaver);
            Weapon("staff", "Staff", 6, 11, 1.0f, twoHanded: true, cls: HeroClass.Hexweaver, element: Element.Arcane);
            Weapon("rod", "Fishing Spear", 3, 7, 1.3f);

            // ---- off-hands
            Armor("shield", "Kite Shield", ItemSlot.OffHand, 12);
            Armor("quiver", "Quiver", ItemSlot.OffHand, 2, HeroClass.Stalker);
            Armor("orb", "Source Orb", ItemSlot.OffHand, 2, HeroClass.Hexweaver);

            // ---- armour
            Armor("helm", "Helm", ItemSlot.Head, 6);
            Armor("hood", "Hood", ItemSlot.Head, 4);
            Armor("pauldrons", "Pauldrons", ItemSlot.Shoulders, 5);
            Armor("mantle", "Mantle", ItemSlot.Shoulders, 4);
            Armor("plate", "Breastplate", ItemSlot.Chest, 10);
            Armor("robe", "Robe", ItemSlot.Chest, 7);
            Armor("jerkin", "Leather Jerkin", ItemSlot.Chest, 8);
            Armor("gauntlets", "Gauntlets", ItemSlot.Hands, 4);
            Armor("gloves", "Gloves", ItemSlot.Hands, 3);
            Armor("bracers", "Bracers", ItemSlot.Wrists, 3);
            Armor("belt", "Belt", ItemSlot.Waist, 3);
            Armor("sash", "Sash", ItemSlot.Waist, 2);
            Armor("greaves", "Greaves", ItemSlot.Legs, 7);
            Armor("trousers", "Trousers", ItemSlot.Legs, 5);
            Armor("boots", "Boots", ItemSlot.Feet, 4);
            Armor("waders", "Waders", ItemSlot.Feet, 4);
            Armor("amulet", "Amulet", ItemSlot.Amulet, 0);
            Armor("ring", "Ring", ItemSlot.Ring, 0);

            // ---- primary affixes (D3 style: the big numbers)
            Aff("str", Stat.Strength, true, SlotMask.All, 2, 5, 330, 500);
            Aff("dex", Stat.Dexterity, true, SlotMask.All, 2, 5, 330, 500);
            Aff("int", Stat.Intelligence, true, SlotMask.All, 2, 5, 330, 500);
            Aff("vit", Stat.Vitality, true, SlotMask.All, 2, 5, 330, 500);
            Aff("armor", Stat.Armor, true, SlotMask.Armor | SlotMask.OffHand, 5, 12, 400, 600, 0.8f);
            Aff("allres", Stat.AllResist, true, SlotMask.Armor | SlotMask.Jewelry, 2, 5, 70, 100, 0.8f);
            Aff("life%", Stat.MaxLifePercent, true, SlotMask.Head | SlotMask.Chest | SlotMask.Legs | SlotMask.Amulet | SlotMask.OffHand, 2, 4, 10, 15);
            Aff("lps", Stat.LifePerSecond, true, SlotMask.All, 1, 2, 300, 500, 0.6f);
            Aff("loh", Stat.LifeOnHit, true, SlotMask.Weapon | SlotMask.Jewelry | SlotMask.Hands | SlotMask.Wrists, 1, 2, 150, 300, 0.6f);
            Aff("cc", Stat.CritChance, true, SlotMask.Head | SlotMask.Hands | SlotMask.Wrists | SlotMask.Jewelry | SlotMask.OffHand, 1, 2, 8, 10);
            Aff("cd", Stat.CritDamage, true, SlotMask.Hands | SlotMask.Jewelry | SlotMask.Weapon, 4, 8, 45, 50);
            Aff("ias", Stat.AttackSpeed, true, SlotMask.Hands | SlotMask.Jewelry | SlotMask.Weapon, 2, 3, 6, 7);
            Aff("cdr", Stat.CooldownReduction, true, SlotMask.Head | SlotMask.Shoulders | SlotMask.Hands | SlotMask.Jewelry | SlotMask.Weapon | SlotMask.OffHand, 2, 3, 6, 8);
            Aff("rcr", Stat.ResourceCostReduction, true, SlotMask.Shoulders | SlotMask.Jewelry | SlotMask.Weapon | SlotMask.OffHand, 2, 3, 6, 8);
            Aff("dmg%", Stat.DamagePercent, true, SlotMask.Weapon | SlotMask.OffHand | SlotMask.Amulet, 3, 6, 8, 10);
            Aff("min", Stat.MinWeaponDamage, true, SlotMask.Weapon | SlotMask.Jewelry, 1, 2, 25, 40);
            Aff("max", Stat.MaxWeaponDamage, true, SlotMask.Weapon | SlotMask.Jewelry, 2, 4, 45, 70);
            Aff("fire", Stat.FireDamage, true, SlotMask.Wrists | SlotMask.Amulet | SlotMask.OffHand, 3, 6, 15, 20);
            Aff("frost", Stat.FrostDamage, true, SlotMask.Wrists | SlotMask.Amulet | SlotMask.OffHand, 3, 6, 15, 20);
            Aff("light", Stat.LightningDamage, true, SlotMask.Wrists | SlotMask.Amulet | SlotMask.OffHand, 3, 6, 15, 20);
            Aff("poison", Stat.PoisonDamage, true, SlotMask.Wrists | SlotMask.Amulet | SlotMask.OffHand, 3, 6, 15, 20);
            Aff("arcane", Stat.ArcaneDamage, true, SlotMask.Wrists | SlotMask.Amulet | SlotMask.OffHand, 3, 6, 15, 20);
            Aff("phys", Stat.PhysicalDamage, true, SlotMask.Wrists | SlotMask.Amulet | SlotMask.OffHand, 3, 6, 15, 20);
            Aff("area", Stat.AreaDamage, true, SlotMask.Armor | SlotMask.Jewelry | SlotMask.Weapon, 4, 8, 18, 24, 0.7f);
            Aff("elite", Stat.EliteDamage, true, SlotMask.Jewelry | SlotMask.Shoulders | SlotMask.Waist, 2, 4, 12, 15, 0.7f);
            Aff("dr", Stat.DamageReduction, true, SlotMask.Chest | SlotMask.Waist | SlotMask.Shoulders, 1, 2, 6, 8, 0.6f);
            Aff("block", Stat.BlockChance, true, SlotMask.OffHand, 2, 4, 10, 15, 0.6f);
            Aff("ms", Stat.MoveSpeed, true, SlotMask.Feet, 3, 6, 10, 12);
            Aff("petdmg", Stat.PetDamage, true, SlotMask.Jewelry | SlotMask.Hands | SlotMask.OffHand, 4, 8, 25, 35, 0.6f);
            Aff("maxres", Stat.MaxResource, true, SlotMask.Head | SlotMask.OffHand | SlotMask.Weapon, 3, 6, 15, 20, 0.6f);

            // ---- secondary affixes (utility)
            Aff("mf", Stat.MagicFind, false, SlotMask.All, 2, 5, 15, 25);
            Aff("gf", Stat.GoldFind, false, SlotMask.All, 4, 8, 20, 30);
            Aff("pickup", Stat.PickupRadius, false, SlotMask.Armor | SlotMask.Jewelry, 1, 2, 4, 6);
            Aff("lpk", Stat.LifePerKill, false, SlotMask.All, 2, 5, 500, 900, 0.7f);
            Aff("thorns", Stat.Thorns, false, SlotMask.Armor | SlotMask.OffHand, 2, 6, 500, 900, 0.7f);
            Aff("fishing", Stat.FishingLuck, false, SlotMask.All, 1, 3, 15, 25, 0.9f);
            Aff("regen", Stat.ResourceRegen, false, SlotMask.Head | SlotMask.Wrists | SlotMask.Jewelry, 0.5f, 1, 2, 3, 0.6f);

            // ---- legendary powers
            Leg("leg_quakemaker", "Quakemaker", "warhammer", HeroClass.Ironclad, LegendaryEffect.SkillDamage, "ic_slam", 100, 150, "Ground Slam deals {0}% more damage");
            Leg("leg_spinner", "The Tireless Top", "greataxe", HeroClass.Ironclad, LegendaryEffect.SkillRadius, "ic_whirl", 40, 60, "Whirling Steel's radius is increased by {0}%");
            Leg("leg_ramhorn", "Ramhorn Pauldrons", "pauldrons", HeroClass.Ironclad, LegendaryEffect.SkillCooldown, "ic_charge", 40, 60, "Iron Charge cooldown is reduced by {0}%");
            Leg("leg_bloodmoon", "Bloodmoon Girdle", "belt", HeroClass.Ironclad, LegendaryEffect.LowLifeDamage, null, 40, 60, "Deal {0}% more damage while below 35% Life");
            Leg("leg_splitfeather", "Splitfeather", "bow", HeroClass.Stalker, LegendaryEffect.SkillExtraProjectiles, "st_twinshot", 1, 2, "Twin Shot fires {0} additional arrows");
            Leg("leg_skyrend", "Skyrend Quiver", "quiver", HeroClass.Stalker, LegendaryEffect.SkillDamage, "st_rain", 80, 120, "Rain of Arrows deals {0}% more damage");
            Leg("leg_nightstep", "Nightstep Boots", "boots", HeroClass.Stalker, LegendaryEffect.ResourceOnCrit, null, 2, 4, "Critical hits restore {0} Focus");
            Leg("leg_rimecall", "Rimecaller", "staff", HeroClass.Hexweaver, LegendaryEffect.NovaOnKill, null, 15, 25, "{0}% chance on kill to release a Frost Nova (400% weapon damage)", Element.Frost);
            Leg("leg_sparkwand", "Wand of Many Sparks", "wand", HeroClass.Hexweaver, LegendaryEffect.SkillExtraProjectiles, "hx_chain", 2, 3, "Chain Spark jumps {0} additional times");
            Leg("leg_starfall", "Starfall Orb", "orb", HeroClass.Hexweaver, LegendaryEffect.SkillRadius, "hx_meteor", 50, 80, "Meteor's impact radius is increased by {0}%");
            Leg("leg_ember", "Heart of Embers", "amulet", null, LegendaryEffect.ElementDamage, null, 15, 25, "Fire damage increased by {0}%", Element.Fire);
            Leg("leg_tempest", "Tempest Band", "ring", null, LegendaryEffect.ElementDamage, null, 15, 25, "Lightning damage increased by {0}%", Element.Lightning);
            Leg("leg_goldheart", "Miser's Heart", "ring", null, LegendaryEffect.GoldToLife, null, 1, 2, "Picking up gold heals you for {0}% of your maximum Life");
            Leg("leg_houndmaster", "Houndmaster's Gloves", "gloves", null, LegendaryEffect.PetDamage, null, 60, 100, "Your companion deals {0}% more damage");
            Leg("leg_patience", "Rod of Infinite Patience", "rod", null, LegendaryEffect.FishingBiteWindow, null, 0.3f, 0.6f, "You have {0} more seconds to set the hook");
            Leg("leg_brine", "Brinewalker Waders", "waders", null, LegendaryEffect.PetFormDuration, null, 50, 100, "Fish transformations on your companion last {0}% longer");

            // ---- sets: two-piece and four-piece bonuses
            Sets.Add(new SetDef
            {
                id = "set_ironwall", name = "Bulwark of the Ironwall", classOnly = HeroClass.Ironclad,
                pieces = new[] { "helm", "plate", "gauntlets", "greaves" },
                bonuses = new[]
                {
                    (2, Stat.DamageReduction, 15f, "Reduces damage taken by 15%"),
                    (4, Stat.DamagePercent, 200f, "+200% Damage"),
                },
            });
            Sets.Add(new SetDef
            {
                id = "set_ghostwind", name = "Ghostwind Regalia", classOnly = HeroClass.Stalker,
                pieces = new[] { "hood", "jerkin", "bracers", "boots" },
                bonuses = new[]
                {
                    (2, Stat.MoveSpeed, 20f, "+20% Movement Speed"),
                    (4, Stat.CritDamage, 150f, "Critical Hit Damage +150%"),
                },
            });
            Sets.Add(new SetDef
            {
                id = "set_starweave", name = "Starweave Vestments", classOnly = HeroClass.Hexweaver,
                pieces = new[] { "hood", "robe", "gloves", "sash" },
                bonuses = new[]
                {
                    (2, Stat.CooldownReduction, 20f, "Reduces cooldowns by 20%"),
                    (4, Stat.ArcaneDamage, 200f, "Arcane skills deal 200% more damage"),
                },
            });
            Sets.Add(new SetDef
            {
                id = "set_angler", name = "The Old Angler's Kit", classOnly = null,
                pieces = new[] { "rod", "waders", "sash", "hood" },
                bonuses = new[]
                {
                    (2, Stat.FishingLuck, 50f, "+50 Fishing Luck"),
                    (4, Stat.PetDamage, 150f, "Your companion deals 150% more damage"),
                },
            });
        }

        static void Weapon(string id, string name, float lo, float hi, float aps, bool twoHanded = false, HeroClass? cls = null, Element element = Element.Physical)
        {
            var b = new ItemBase(id, name, ItemSlot.MainHand) { dmgMin = lo, dmgMax = hi, aps = aps, twoHanded = twoHanded, classOnly = cls, weaponElement = element };
            Bases.Add(b);
            baseById[id] = b;
        }

        static void Armor(string id, string name, ItemSlot slot, int armor, HeroClass? cls = null)
        {
            var b = new ItemBase(id, name, slot) { armor = armor, classOnly = cls };
            Bases.Add(b);
            baseById[id] = b;
        }

        static void Aff(string id, Stat s, bool primary, SlotMask slots, float lo1, float hi1, float lo70, float hi70, float weight = 1f)
            => Affixes.Add(new AffixDef { id = id, stat = s, primary = primary, slots = slots, lo1 = lo1, hi1 = hi1, lo70 = lo70, hi70 = hi70, weight = weight });

        static void Leg(string id, string name, string baseId, HeroClass? cls, LegendaryEffect fx, string skill, float lo, float hi, string text, Element el = Element.Physical)
            => Legendaries.Add(new LegendaryDef { id = id, name = name, baseId = baseId, classOnly = cls, effect = fx, skillId = skill, lo = lo, hi = hi, text = text, element = el });

        public static SlotMask MaskOf(ItemSlot s) => (SlotMask)(1 << (int)s);

        public static EquipSlot[] EquipSlotsFor(ItemSlot s) => s switch
        {
            ItemSlot.Ring => new[] { EquipSlot.Ring1, EquipSlot.Ring2 },
            ItemSlot.Head => new[] { EquipSlot.Head },
            ItemSlot.Shoulders => new[] { EquipSlot.Shoulders },
            ItemSlot.Chest => new[] { EquipSlot.Chest },
            ItemSlot.Hands => new[] { EquipSlot.Hands },
            ItemSlot.Wrists => new[] { EquipSlot.Wrists },
            ItemSlot.Waist => new[] { EquipSlot.Waist },
            ItemSlot.Legs => new[] { EquipSlot.Legs },
            ItemSlot.Feet => new[] { EquipSlot.Feet },
            ItemSlot.Amulet => new[] { EquipSlot.Amulet },
            ItemSlot.MainHand => new[] { EquipSlot.MainHand },
            _ => new[] { EquipSlot.OffHand },
        };
    }
}
