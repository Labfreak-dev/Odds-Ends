using System;
using System.Collections.Generic;
using System.Linq;

namespace Hollowmere.Core
{
    [Serializable]
    public sealed class Hero
    {
        public string name = "Wanderer";
        public HeroClass heroClass;
        public int level = 1;
        public long xp;
        public long gold;
        public Item[] equipment = new Item[(int)EquipSlot.Count];
        public List<Item> inventory = new List<Item>();
        public SkillTreeState skills = new SkillTreeState();

        public static Hero Create(HeroClass cls, string name, Rng rng)
        {
            var h = new Hero { heroClass = cls, name = name, gold = 100 };
            h.skills.unspent = SkillDb.PointsAtLevel(1);
            // Start with the class's primary attack learned.
            var primary = SkillDb.ForClass(cls).First(s => s.primary);
            h.skills.RankUp(primary, 1);
            string weapon = cls switch { HeroClass.Ironclad => "axe", HeroClass.Stalker => "bow", _ => "wand" };
            var w = Loot.Generate(rng, 1, Rarity.Common, cls, forceBase: weapon);
            w.name = "Worn " + w.Base.name;
            h.equipment[(int)EquipSlot.MainHand] = w;
            h.equipment[(int)EquipSlot.Chest] = Loot.Generate(rng, 1, Rarity.Common, cls, ItemSlot.Chest);
            h.inventory.Add(Loot.Potion(3));
            h.inventory.Add(Loot.TownPortal(2));
            // A few pieces so a new bag is not an empty grid on the inventory screen.
            h.inventory.Add(Loot.Generate(rng, 1, Rarity.Magic, cls, ItemSlot.Ring));
            h.inventory.Add(Loot.Generate(rng, 1, Rarity.Rare, cls, ItemSlot.Head));
            h.inventory.Add(Loot.Generate(rng, 1, Rarity.Common, cls, ItemSlot.Feet));
            h.inventory.Add(Loot.Generate(rng, 1, Rarity.Magic, cls, ItemSlot.Amulet));
            h.inventory.Add(Loot.Generate(rng, 1, Rarity.Common, cls, ItemSlot.Hands));
            h.inventory.Add(Loot.Generate(rng, 2, Rarity.Rare, cls, ItemSlot.OffHand));
            return h;
        }

        public Item Equipped(EquipSlot s) => Item.IsNone(equipment[(int)s]) ? null : equipment[(int)s];

        /// <summary>JsonUtility turns nulls into empty objects; call after loading.</summary>
        public void Normalize()
        {
            if (equipment == null || equipment.Length != (int)EquipSlot.Count)
            {
                var e = new Item[(int)EquipSlot.Count];
                if (equipment != null) Array.Copy(equipment, e, Math.Min(e.Length, equipment.Length));
                equipment = e;
            }
            for (int i = 0; i < equipment.Length; i++) if (Item.IsNone(equipment[i])) equipment[i] = null;
            inventory.RemoveAll(Item.IsNone);
            if (skills.bar == null || skills.bar.Length != 5) skills.bar = new string[5];
        }

        // ---------------- level & xp ----------------

        /// <summary>Returns the number of levels gained.</summary>
        public int GainXp(long amount)
        {
            if (level >= Balance.MaxLevel) return 0;
            int helm = Gems.HelmXpPercent(this);
            if (helm > 0) amount += amount * helm / 100;
            xp += amount;
            int gained = 0;
            while (level < Balance.MaxLevel && xp >= Balance.XpToNext(level))
            {
                xp -= Balance.XpToNext(level);
                level++;
                gained++;
                skills.unspent += SkillDb.PointsAtLevel(level) - SkillDb.PointsAtLevel(level - 1);
            }
            if (level >= Balance.MaxLevel) xp = 0;
            return gained;
        }

        // ---------------- inventory ----------------

        public int FreeSlots => Balance.InventorySize - inventory.Count;

        public bool AddItem(Item it)
        {
            if (it.Stackable)
            {
                // JsonUtility loads null strings as "", so compare them as equal.
                var same = inventory.FirstOrDefault(x => x.kind == it.kind && (x.fishId ?? "") == (it.fishId ?? "")
                    && (it.kind != ItemKind.Gem || x.baseId == it.baseId));
                if (same != null) { same.stack += it.stack; return true; }
            }
            if (inventory.Count >= Balance.InventorySize) return false;
            inventory.Add(it);
            return true;
        }

        public int Count(ItemKind kind) => inventory.Where(i => i.kind == kind).Sum(i => i.stack);

        public bool Consume(ItemKind kind, string fishId = null)
        {
            var it = inventory.FirstOrDefault(i => i.kind == kind && (fishId == null || i.fishId == fishId));
            if (it == null) return false;
            if (--it.stack <= 0) inventory.Remove(it);
            return true;
        }

        public bool CanEquip(Item it)
        {
            if (it == null || it.kind != ItemKind.Equipment) return false;
            var b = it.Base;
            return b.classOnly == null || b.classOnly == heroClass;
        }

        /// <summary>Equip from inventory. Rings go to the empty ring slot first, else ring 1.
        /// Two-handers clear the off-hand. Returns false if there's no room for what comes off.</summary>
        public bool Equip(Item it, EquipSlot? preferred = null)
        {
            if (!CanEquip(it)) return false;
            var b = it.Base;
            var slots = ItemDb.EquipSlotsFor(b.slot);
            EquipSlot target = slots[0];
            if (preferred.HasValue && slots.Contains(preferred.Value)) target = preferred.Value;
            else foreach (var s in slots) if (Equipped(s) == null) { target = s; break; }

            var removed = new List<Item>();
            if (Equipped(target) != null) removed.Add(Equipped(target));
            if (b.slot == ItemSlot.MainHand && b.twoHanded && Equipped(EquipSlot.OffHand) != null) removed.Add(Equipped(EquipSlot.OffHand));
            if (b.slot == ItemSlot.OffHand && Equipped(EquipSlot.MainHand)?.Base.twoHanded == true)
            {
                // Quivers are the exception: they go with bows.
                bool bowQuiver = b.id == "quiver" && (Equipped(EquipSlot.MainHand).baseId == "bow" || Equipped(EquipSlot.MainHand).baseId == "crossbow");
                if (!bowQuiver) removed.Add(Equipped(EquipSlot.MainHand));
            }
            if (b.slot == ItemSlot.MainHand && b.twoHanded && (b.id == "bow" || b.id == "crossbow") && Equipped(EquipSlot.OffHand)?.baseId == "quiver")
                removed.RemoveAll(r => r.baseId == "quiver");

            int room = Balance.InventorySize - (inventory.Count - (inventory.Contains(it) ? 1 : 0));
            if (removed.Count > room) return false;

            inventory.Remove(it);
            foreach (var r in removed)
            {
                for (int i = 0; i < equipment.Length; i++) if (equipment[i] == r) equipment[i] = null;
                inventory.Add(r);
            }
            equipment[(int)target] = it;
            return true;
        }

        public bool Unequip(EquipSlot s)
        {
            var it = Equipped(s);
            if (it == null || inventory.Count >= Balance.InventorySize) return false;
            equipment[(int)s] = null;
            inventory.Add(it);
            return true;
        }

        // ---------------- stats ----------------

        public Element WeaponElement() => Equipped(EquipSlot.MainHand)?.Base.weaponElement ?? Element.Physical;

        public IEnumerable<(LegendaryDef def, float value)> EquippedLegendaries()
        {
            foreach (var it in equipment)
                if (!Item.IsNone(it) && !string.IsNullOrEmpty(it.legendaryId))
                    yield return (ItemDb.Legendary(it.legendaryId), it.legendaryValue);
        }

        public float LegendaryTotal(LegendaryEffect fx, Element? el = null)
            => EquippedLegendaries().Where(l => l.def.effect == fx && (el == null || l.def.element == el)).Sum(l => l.value);

        public Dictionary<string, int> SetCounts()
        {
            var d = new Dictionary<string, int>();
            foreach (var it in equipment)
                if (!Item.IsNone(it) && !string.IsNullOrEmpty(it.setId))
                    d[it.setId] = d.TryGetValue(it.setId, out var n) ? n + 1 : 1;
            return d;
        }

        /// <summary>Everything that contributes to stats: level, gear, set bonuses, passives, legendaries.</summary>
        public StatBlock ComputeStats()
        {
            var s = new StatBlock();
            var main = StatInfo.MainStat(heroClass);
            foreach (var st in new[] { Stat.Strength, Stat.Dexterity, Stat.Intelligence })
                s[st] = st == main ? Balance.BaseMainStat(level) : Balance.BaseOffStat(level);
            s[Stat.Vitality] = Balance.BaseVitality(level);
            s[Stat.CritChance] = 5;
            s[Stat.CritDamage] = 50;
            s[Stat.MaxResource] = heroClass == HeroClass.Hexweaver ? 100 : heroClass == HeroClass.Stalker ? 80 : 100;
            s[Stat.ResourceRegen] = heroClass == HeroClass.Hexweaver ? 6 : heroClass == HeroClass.Stalker ? 4 : 0;
            s[Stat.PickupRadius] = 2;

            float itemArmor = 0;
            foreach (var it in equipment)
            {
                if (Item.IsNone(it)) continue;
                itemArmor += it.armor;
                foreach (var a in it.affixes) s.Add(a.stat, a.value);
            }
            s[Stat.Armor] += itemArmor;

            foreach (var kv in SetCounts())
            {
                var set = ItemDb.Set(kv.Key);
                if (set == null) continue;
                foreach (var b in set.bonuses) if (kv.Value >= b.count) s.Add(b.stat, b.value);
            }

            foreach (var r in skills.ranks)
            {
                var sk = SkillDb.Get(r.id);
                if (sk == null || sk.shape != SkillShape.Passive || sk.cls != heroClass) continue;
                if (sk.id == "ic_p_hide") continue; // percentage of armor, applied below
                if (sk.id == "ic_p_bloodlust") { s.Add(Stat.LifeOnHit, s[Stat.Strength] * 0.01f * r.rank); continue; }
                s.Add(sk.passiveStat, sk.passiveValue * r.rank);
            }

            // Derived: strength gives armour, intelligence gives resistance (D3 rules)
            s[Stat.Armor] += s[Stat.Strength];
            s[Stat.AllResist] += s[Stat.Intelligence] / 10f;
            int hide = skills.Rank("ic_p_hide");
            if (hide > 0 && heroClass == HeroClass.Ironclad) s[Stat.Armor] *= 1 + 0.06f * hide;
            int glass = skills.Rank("hx_p_glass");
            if (glass > 0 && heroClass == HeroClass.Hexweaver) s[Stat.Armor] *= 1 - 0.05f * glass;

            Gems.Contribute(this, s);
            s[Stat.PetDamage] += LegendaryTotal(LegendaryEffect.PetDamage);
            foreach (Element e in Enum.GetValues(typeof(Element)))
                s.Add(StatInfo.ElementStat(e), LegendaryTotal(LegendaryEffect.ElementDamage, e));
            return s;
        }

        public float MaxLife(StatBlock s) => (Balance.BaseLife(level) + Balance.LifeFromVitality(s[Stat.Vitality]) + Gems.MarrowLife(this)) * (1 + s[Stat.MaxLifePercent] / 100f);

        public (float min, float max, float aps) WeaponDamage(StatBlock s)
        {
            var w = Equipped(EquipSlot.MainHand);
            float lo = w?.weaponMin ?? 2, hi = w?.weaponMax ?? 3, aps = w?.attacksPerSecond ?? 1.2f;
            lo += s[Stat.MinWeaponDamage];
            hi += s[Stat.MaxWeaponDamage];
            if (hi < lo) hi = lo;
            return (lo, hi, aps * (1 + s[Stat.AttackSpeed] / 100f));
        }

        /// <summary>The headline "DPS" number on the character sheet: primary attack, no target defenses.</summary>
        public float SheetDps(StatBlock s)
        {
            var (lo, hi, aps) = WeaponDamage(s);
            float main = s[StatInfo.MainStat(heroClass)];
            float crit = 1 + Math.Min(1, s[Stat.CritChance] / 100f) * s[Stat.CritDamage] / 100f;
            return (lo + hi) * 0.5f * aps * (1 + main / 100f) * (1 + s[Stat.DamagePercent] / 100f) * crit;
        }

        public float Toughness(StatBlock s)
        {
            float dr = Balance.ArmorMitigation(s[Stat.Armor], level);
            float rr = Balance.ResistMitigation(s[Stat.AllResist], level);
            float extra = Math.Min(0.75f, s[Stat.DamageReduction] / 100f);
            return MaxLife(s) / Math.Max(0.05f, (1 - dr) * (1 - rr) * (1 - extra));
        }
    }
}
