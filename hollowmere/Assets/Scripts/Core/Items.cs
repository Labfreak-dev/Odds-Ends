using System;
using System.Collections.Generic;

namespace Hollowmere.Core
{
    public enum ItemSlot { Head, Shoulders, Chest, Hands, Wrists, Waist, Legs, Feet, Amulet, Ring, MainHand, OffHand }

    /// <summary>Paper-doll positions. Rings occupy two.</summary>
    public enum EquipSlot { Head, Shoulders, Chest, Hands, Wrists, Waist, Legs, Feet, Amulet, Ring1, Ring2, MainHand, OffHand, Count }

    public enum Rarity { Common, Magic, Rare, Legendary, Set }

    public enum ItemKind { Equipment, Fish, Potion, TownPortal, Gem }

    [Serializable]
    public sealed class AffixRoll
    {
        public string affixId;
        public Stat stat;
        public float value;
        public bool primary;
    }

    /// <summary>One inventory item. Public fields only (no dictionaries, no nulls inside) so Unity's
    /// JsonUtility can save it. JsonUtility writes null class fields as empty objects, so "no item"
    /// is always checked with <see cref="Item.IsNone"/> rather than == null.</summary>
    [Serializable]
    public sealed class Item
    {
        public string uid;
        public ItemKind kind;
        public string baseId;
        public string name;
        public Rarity rarity;
        public int itemLevel;
        public bool ancient;
        public string legendaryId;
        public float legendaryValue;
        public string setId;
        public List<AffixRoll> affixes = new List<AffixRoll>();
        public float weaponMin, weaponMax, attacksPerSecond;
        public int armor;
        public int stack = 1;
        public string fishId;
        public bool junk;          // flagged for the pet to sell
        public int enchantedAffix = -1;  // mystic: only this affix may be re-rolled again
        public int sockets;
        public string gemId;

        public static bool IsNone(Item i) => i == null || string.IsNullOrEmpty(i.baseId);

        public ItemBase Base => ItemDb.Base(baseId);
        public bool IsWeapon => kind == ItemKind.Equipment && Base != null && Base.slot == ItemSlot.MainHand;
        public bool Stackable => kind != ItemKind.Equipment;

        public float Affix(Stat s)
        {
            float t = 0;
            foreach (var a in affixes) if (a.stat == s) t += a.value;
            return t;
        }

        public int SellValue()
        {
            if (kind == ItemKind.Fish) return FishDb.Get(fishId)?.sellValue * stack ?? 1;
            if (kind == ItemKind.Potion) return 5 * stack;
            if (kind == ItemKind.TownPortal) return 10 * stack;
            if (kind == ItemKind.Gem && Gems.Parse(baseId, out _, out int rank)) return Math.Max(1, DesignTable.GemCombineGold(rank) / 3) * stack;
            int mult = rarity switch
            {
                Rarity.Common => 1, Rarity.Magic => 3, Rarity.Rare => 8, _ => 25,
            };
            return Math.Max(1, (5 + itemLevel * 2) * mult);
        }
    }

    public sealed class ItemBase
    {
        public string id, name, model;
        public ItemSlot slot;
        public HeroClass? classOnly;
        public bool twoHanded;
        public float dmgMin, dmgMax, aps;    // weapons, at item level 1; scales with ilvl
        public int armor;                     // armour pieces, at item level 1
        public Element weaponElement = Element.Physical;
        public int minLevel = 1;

        public ItemBase(string id, string name, ItemSlot slot, string model = null)
        {
            this.id = id; this.name = name; this.slot = slot; this.model = model ?? id;
        }
    }

    /// <summary>Which slots an affix may roll on.</summary>
    [Flags]
    public enum SlotMask
    {
        None = 0,
        Head = 1 << ItemSlot.Head, Shoulders = 1 << ItemSlot.Shoulders, Chest = 1 << ItemSlot.Chest,
        Hands = 1 << ItemSlot.Hands, Wrists = 1 << ItemSlot.Wrists, Waist = 1 << ItemSlot.Waist,
        Legs = 1 << ItemSlot.Legs, Feet = 1 << ItemSlot.Feet, Amulet = 1 << ItemSlot.Amulet,
        Ring = 1 << ItemSlot.Ring, MainHand = 1 << ItemSlot.MainHand, OffHand = 1 << ItemSlot.OffHand,
        Jewelry = Amulet | Ring,
        Armor = Head | Shoulders | Chest | Hands | Wrists | Waist | Legs | Feet,
        Weapon = MainHand,
        All = Armor | Jewelry | MainHand | OffHand,
    }

    public sealed class AffixDef
    {
        public string id;
        public Stat stat;
        public bool primary;
        public SlotMask slots;
        public float lo1, hi1, lo70, hi70;   // value range at item level 1 and 70; lerped between
        public float weight = 1f;

        public float Roll(int ilvl, Rng rng, bool ancient)
        {
            float t = Math.Clamp((ilvl - 1) / 69f, 0f, 1f);
            float lo = lo1 + (lo70 - lo1) * t, hi = hi1 + (hi70 - hi1) * t;
            float v = rng.Range(lo, hi);
            if (ancient) v *= (float)DesignTable.DeepwroughtScale;
            return IsInteger(stat) ? (float)Math.Round(v) : (float)Math.Round(v * 10) / 10f;
        }

        public float MaxAt(int ilvl)
        {
            float t = Math.Clamp((ilvl - 1) / 69f, 0f, 1f);
            return hi1 + (hi70 - hi1) * t;
        }

        static bool IsInteger(Stat s) => s switch
        {
            Stat.CritChance or Stat.CritDamage or Stat.AttackSpeed or Stat.CooldownReduction
                or Stat.ResourceCostReduction or Stat.DamagePercent or Stat.MaxLifePercent
                or Stat.DamageReduction or Stat.BlockChance or Stat.MoveSpeed => false,
            _ => true,
        };
    }

    /// <summary>What a legendary power does. The core combat code applies the numeric ones;
    /// the Unity skill executor reads the behavioural ones (extra projectiles, novas, ...).</summary>
    public enum LegendaryEffect
    {
        SkillDamage,          // skill a: +x% damage
        SkillCooldown,        // skill a: cooldown -x%
        SkillExtraProjectiles,// skill a: +x projectiles
        SkillRadius,          // skill a: +x% radius
        ElementDamage,        // element e: +x% damage
        NovaOnKill,           // x% chance on kill: frost/fire nova of y% weapon damage
        PetDamage,            // companion +x% damage
        PetFormDuration,      // fish transformations last x% longer
        FishingBiteWindow,    // +x seconds to set the hook
        GoldToLife,           // picking up gold heals x% life
        LowLifeDamage,        // +x% damage while under 35% life
        ResourceOnCrit,       // +x resource on crit
    }

    public sealed class LegendaryDef
    {
        public string id, name, baseId, text, skillId;
        public LegendaryEffect effect;
        public Element element;
        public float lo, hi;          // power magnitude range (rolled)
        public float extra;           // secondary fixed parameter
        public HeroClass? classOnly;

        public string Describe(float magnitude) => string.Format(text, Math.Round(magnitude, 1));
    }

    public sealed class SetDef
    {
        public string id, name;
        public HeroClass? classOnly;
        public string[] pieces;                 // item base ids
        public (int count, Stat stat, float value, string text)[] bonuses;
    }
}
