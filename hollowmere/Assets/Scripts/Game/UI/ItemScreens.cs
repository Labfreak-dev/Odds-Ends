using System;
using System.Collections.Generic;
using System.Linq;
using Hollowmere.Core;
using UnityEngine;
using UnityEngine.UI;

namespace Hollowmere
{
    /// <summary>Shared item widgets: a coloured cell per item and the tooltip card.</summary>
    public static class ItemUi
    {
        public static Button Cell(Transform parent, Item it, bool selected, Action onClick, string emptyLabel = "")
        {
            var c = Item.IsNone(it) ? new Color(0.12f, 0.11f, 0.1f) : Art.Rarity(it.rarity) * 0.35f + new Color(0.05f, 0.05f, 0.05f, 1f);
            if (selected) c = Ui.ButtonHot;
            var b = Ui.Button(parent, "", onClick, c, 20);
            var txt = b.GetComponentInChildren<Text>();
            if (Item.IsNone(it)) { txt.text = $"<color=#666666>{emptyLabel}</color>"; return b; }
            string stack = it.stack > 1 ? $"\nx{it.stack}" : "";
            txt.text = $"<color={ItemText.RarityColor(it.rarity)}><b>{ItemText.SlotLabel(it)}</b></color>{stack}" + (it.ancient ? "\n<color=#ff8a1e>A</color>" : "");
            // Rarity edge
            var edge = Ui.Rect(b.transform, "edge", new Vector2(0, 0), new Vector2(1, 0), Vector2.zero, new Vector2(0, 8));
            Ui.Box(edge, Art.Rarity(it.rarity), false).raycastTarget = false;
            return b;
        }

        public static Item EquippedCounterpart(Hero h, Item it)
        {
            if (it.kind != ItemKind.Equipment) return null;
            var slots = ItemDb.EquipSlotsFor(it.Base.slot);
            // compare against the weaker ring
            return slots.Select(h.Equipped).Where(x => x != null).OrderBy(x => x.affixes.Sum(a => a.value)).FirstOrDefault();
        }

        public static void Tooltip(RectTransform area, Item it, Hero h, bool compare)
        {
            Ui.Clear(area);
            if (Item.IsNone(it)) return;
            var list = Ui.Scroll(area, 4);
            var t = Ui.Label(Ui.Rect(list, "tip", Vector2.zero, Vector2.one), ItemText.Describe(it, h, compare ? EquippedCounterpart(h, it) : null), 25, TextAnchor.UpperLeft);
            t.verticalOverflow = VerticalWrapMode.Overflow;
            var fit = t.gameObject.AddComponent<ContentSizeFitter>();
            fit.verticalFit = ContentSizeFitter.FitMode.PreferredSize;
            Ui.Size(t.transform.parent.GetComponent<RectTransform>(), 760);
        }
    }

    public static class InventoryScreen
    {
        static Item selected;
        static EquipSlot? selectedSlot;

        public static void Show(UiRoot ui)
        {
            var gm = GameManager.I;
            var h = gm.State.hero;
            var body = ui.Modal("bag", $"{h.name} — {h.inventory.Count}/{Balance.InventorySize}", new Vector2(0.02f, 0.03f), new Vector2(0.98f, 0.97f), onClose: gm.OnEquipmentChanged);
            if (selected != null && !h.inventory.Contains(selected) && !h.equipment.Contains(selected)) { selected = null; selectedSlot = null; }

            // ---- paper doll
            var doll = Ui.Rect(body, "doll", Vector2.zero, new Vector2(0.3f, 1), Vector2.zero, new Vector2(-8, 0));
            var dg = Ui.Grid(doll, new Vector2(160, 104), 6);
            foreach (EquipSlot es in Enum.GetValues(typeof(EquipSlot)))
            {
                if (es == EquipSlot.Count) continue;
                var e = es;
                var it = h.Equipped(es);
                ItemUi.Cell(dg, it, selectedSlot == es, () => { selected = h.Equipped(e); selectedSlot = e; Show(ui); }, es.ToString());
            }
            var hero = HeroActor.I;
            var st = hero != null ? hero.stats : gm.State.Stats();
            var statBox = Ui.Rect(dg, "stats", Vector2.zero, Vector2.one);
            Ui.Label(statBox, $"<color=#ffe25a>DPS {Fx.Short(h.SheetDps(st))}</color>\nLife {Fx.Short(h.MaxLife(st))}\nArmor {st[Stat.Armor]:0}", 20, TextAnchor.UpperLeft);

            // ---- bag
            var bag = Ui.Rect(body, "bag", new Vector2(0.3f, 0), new Vector2(0.64f, 1), new Vector2(8, 80), new Vector2(-8, 0));
            var grid = Ui.Grid(bag, new Vector2(120, 104), 6);
            foreach (var it in h.inventory)
            {
                var itx = it;
                ItemUi.Cell(grid, it, it == selected, () => { selected = itx; selectedSlot = null; Show(ui); });
            }
            var bagBtns = Ui.Rect(body, "bagBtns", new Vector2(0.3f, 0), new Vector2(0.64f, 0), new Vector2(8, 0), new Vector2(-8, 70));
            var hl = bagBtns.gameObject.AddComponent<HorizontalLayoutGroup>(); hl.spacing = 8; hl.childControlWidth = true; hl.childControlHeight = true;
            Ui.Button(bagBtns, "Sort", () => { h.inventory = h.inventory.OrderBy(i => i.kind).ThenByDescending(i => i.rarity).ThenBy(i => i.Base?.slot).ToList(); Show(ui); }, Ui.ButtonC, 24);
            Ui.Button(bagBtns, $"Gold {h.gold:N0}", null, new Color(0.15f, 0.13f, 0.1f), 24).interactable = false;

            // ---- tooltip + actions
            var side = Ui.Rect(body, "side", new Vector2(0.64f, 0), Vector2.one, new Vector2(8, 0), Vector2.zero);
            Ui.Box(side, Ui.PanelLight);
            var tip = Ui.Rect(side, "tip", Vector2.zero, Vector2.one, new Vector2(10, 230), new Vector2(-10, -10));
            if (selected == null)
            {
                Ui.Label(tip, "Tap an item to inspect it.\n\nItems are compared against what you wear: <color=#4cff4c>green</color> is better.\n\nGive junk to your companion (Pet) to sell without leaving the dungeon.", 25, TextAnchor.UpperLeft, new Color(0.75f, 0.72f, 0.66f));
                return;
            }
            ItemUi.Tooltip(tip, selected, h, selectedSlot == null);
            var acts = Ui.Rect(side, "acts", Vector2.zero, new Vector2(1, 0), new Vector2(10, 10), new Vector2(-10, 220));
            var ag = acts.gameObject.AddComponent<GridLayoutGroup>();
            ag.cellSize = new Vector2(250, 66); ag.spacing = new Vector2(8, 8);

            var sel = selected;
            if (selectedSlot != null)
            {
                Ui.Button(acts, "Unequip", () => { if (!h.Unequip(selectedSlot.Value)) ui.Toast("Bag is full."); selectedSlot = null; gm.OnEquipmentChanged(); Show(ui); });
                return;
            }
            switch (sel.kind)
            {
                case ItemKind.Equipment:
                    if (h.CanEquip(sel))
                    {
                        if (sel.Base.slot == ItemSlot.Ring)
                        {
                            Ui.Button(acts, "Wear (ring 1)", () => { Equip(h, sel, EquipSlot.Ring1, ui); });
                            Ui.Button(acts, "Wear (ring 2)", () => { Equip(h, sel, EquipSlot.Ring2, ui); });
                        }
                        else Ui.Button(acts, "Equip", () => Equip(h, sel, null, ui), new Color(0.25f, 0.45f, 0.2f));
                    }
                    Ui.Button(acts, sel.junk ? "Unmark junk" : "Mark junk", () => { sel.junk = !sel.junk; Show(ui); });
                    Ui.Button(acts, "Give to pet", () => { if (!gm.GiveToPet(sel)) ui.Toast(gm.State.pet.Away ? "Your companion is away." : "Saddlebags are full."); selected = null; Show(ui); });
                    break;
                case ItemKind.Fish:
                    var f = FishDb.Get(sel.fishId);
                    Ui.Button(acts, f?.effect == FishEffect.PetForm ? "Feed to pet" : "Eat", () => { gm.UseFish(sel, true); Show(ui); }, new Color(0.25f, 0.4f, 0.55f));
                    Ui.Button(acts, "Give to pet (sell)", () => { if (!gm.GiveToPet(sel)) ui.Toast("Can't right now."); selected = null; Show(ui); });
                    break;
                case ItemKind.Potion:
                    Ui.Button(acts, "Drink", () => { HeroActor.I?.DrinkPotion(); Show(ui); });
                    break;
                case ItemKind.TownPortal:
                    Ui.Button(acts, "Read", () => { ui.CloseAll(); gm.UseTownPortal(); });
                    break;
            }
            Ui.Button(acts, "Drop", () => { h.inventory.Remove(sel); if (HeroActor.I != null) Pickup.DropItem(sel, HeroActor.I.Pos + HeroActor.I.transform.forward * 2); selected = null; Show(ui); }, new Color(0.4f, 0.15f, 0.12f));
        }

        static void Equip(Hero h, Item it, EquipSlot? slot, UiRoot ui)
        {
            if (!h.Equip(it, slot)) ui.Toast("No room in your bag for what comes off.");
            else { AudioHub.Play("sfx_swing", 0.4f); selected = null; }
            GameManager.I.OnEquipmentChanged();
            Show(ui);
        }
    }

    public static class TownScreen
    {
        static Item selected;
        static TownTab tab;

        public static void Show(UiRoot ui, TownTab t)
        {
            tab = t;
            var gm = GameManager.I;
            var s = gm.State;
            var h = s.hero;
            string title = t switch
            {
                TownTab.Merchant => "Merchant", TownTab.Blacksmith => "Blacksmith", TownTab.Mystic => "Mystic",
                TownTab.Gambler => "Curio Dealer", TownTab.Stash => "Stash", _ => "Quest Board",
            };
            var body = ui.Modal("town", $"{title}   <size=28><color=#c9a14a>{h.gold:N0} gold</color>   <color=#bbbbbb>scrap {s.materials.scrap} · dust {s.materials.dust} · souls {s.materials.souls}</color></size>",
                new Vector2(0.02f, 0.03f), new Vector2(0.98f, 0.97f), onClose: gm.OnEquipmentChanged);
            if (selected != null && !h.inventory.Contains(selected) && !s.stash.Contains(selected)) selected = null;

            if (t == TownTab.Quests) { Quests(ui, body); return; }
            if (t == TownTab.Gambler) { Gamble(ui, body); return; }

            // Left: bag (and stash on the stash tab). Right: tooltip + the service's actions.
            var left = Ui.Rect(body, "left", Vector2.zero, new Vector2(0.62f, 1), Vector2.zero, new Vector2(-8, 0));
            if (t == TownTab.Stash)
            {
                var top = Ui.Rect(left, "stash", new Vector2(0, 0.5f), Vector2.one, new Vector2(0, 4), Vector2.zero);
                Ui.Label(Ui.At(top, "lab", new Vector2(0, 1), Vector2.zero, new Vector2(600, 36)), $"Stash {s.stash.Count}/{Balance.StashSize} — tap to take", 24, TextAnchor.MiddleLeft, Ui.Gold);
                var sg = Ui.Grid(Ui.Rect(top, "g", Vector2.zero, Vector2.one, Vector2.zero, new Vector2(0, -38)), new Vector2(120, 96), 6);
                foreach (var it in s.stash) { var itx = it; ItemUi.Cell(sg, it, it == selected, () => { if (!Town.FromStash(s, itx)) ui.Toast("Bag is full."); Show(ui, tab); }); }
                left = Ui.Rect(left, "bagHalf", Vector2.zero, new Vector2(1, 0.5f), Vector2.zero, new Vector2(0, -4));
            }
            Ui.Label(Ui.At(left, "lab", new Vector2(0, 1), Vector2.zero, new Vector2(600, 36)), t == TownTab.Stash ? "Bag — tap to store" : "Bag — tap to select", 24, TextAnchor.MiddleLeft, Ui.Gold);
            var grid = Ui.Grid(Ui.Rect(left, "g", Vector2.zero, Vector2.one, Vector2.zero, new Vector2(0, -38)), new Vector2(120, 96), 6);
            foreach (var it in h.inventory)
            {
                var itx = it;
                ItemUi.Cell(grid, it, it == selected, () =>
                {
                    if (tab == TownTab.Stash) { if (!Town.ToStash(s, itx)) ui.Toast("Stash is full."); }
                    else selected = itx;
                    Show(ui, tab);
                });
            }

            var side = Ui.Rect(body, "side", new Vector2(0.62f, 0), Vector2.one, new Vector2(8, 0), Vector2.zero);
            Ui.Box(side, Ui.PanelLight);
            var tip = Ui.Rect(side, "tip", Vector2.zero, Vector2.one, new Vector2(10, 300), new Vector2(-10, -10));
            var acts = Ui.Rect(side, "acts", Vector2.zero, new Vector2(1, 0), new Vector2(10, 10), new Vector2(-10, 290));
            var ag = acts.gameObject.AddComponent<GridLayoutGroup>();
            ag.cellSize = new Vector2(330, 64); ag.spacing = new Vector2(8, 8);
            if (selected != null) ItemUi.Tooltip(tip, selected, h, true);

            switch (t)
            {
                case TownTab.Merchant:
                    if (selected == null) Ui.Label(tip, $"\"Potions, scrolls, and I'll take anything off your hands.\"", 26, TextAnchor.UpperLeft);
                    Ui.Button(acts, $"Potion x5 ({Town.PotionPrice * 5}g)", () => { if (!Town.Buy(s, ItemKind.Potion, 5)) ui.Toast("Can't afford it."); Show(ui, tab); });
                    Ui.Button(acts, $"Portal scroll x2 ({Town.PortalPrice * 2}g)", () => { if (!Town.Buy(s, ItemKind.TownPortal, 2)) ui.Toast("Can't afford it."); Show(ui, tab); });
                    if (selected != null) Ui.Button(acts, $"Sell ({selected.SellValue()}g)", () => { Town.Sell(s, selected); selected = null; AudioHub.Play("sfx_gold"); Show(ui, tab); }, Ui.ButtonHot);
                    Ui.Button(acts, "Sell all junk", () => { ui.Toast($"+{Town.SellAllJunk(s)} gold"); Show(ui, tab); });
                    Ui.Button(acts, "Sell all white & blue", () =>
                    {
                        long g = 0;
                        foreach (var it in h.inventory.Where(i => i.kind == ItemKind.Equipment && i.rarity <= Rarity.Magic).ToList()) { g += it.SellValue(); Town.Sell(s, it); }
                        ui.Toast($"+{g} gold"); Show(ui, tab);
                    });
                    break;
                case TownTab.Blacksmith:
                    if (selected == null) Ui.Label(tip, "\"Break it down and I'll give you what it's made of.\"\n\nRare items give Arcane Dust, legendary and set items give Forgotten Souls — the Mystic needs both.", 26, TextAnchor.UpperLeft);
                    if (selected != null && selected.kind == ItemKind.Equipment) Ui.Button(acts, "Salvage", () => { Town.Salvage(s, selected); selected = null; Show(ui, tab); }, Ui.ButtonHot);
                    Ui.Button(acts, "Salvage all white & blue", () =>
                    {
                        foreach (var it in h.inventory.Where(i => i.kind == ItemKind.Equipment && i.rarity <= Rarity.Magic).ToList()) Town.Salvage(s, it);
                        Show(ui, tab);
                    });
                    Ui.Button(acts, "Salvage all yellow", () =>
                    {
                        foreach (var it in h.inventory.Where(i => i.kind == ItemKind.Equipment && i.rarity == Rarity.Rare).ToList()) Town.Salvage(s, it);
                        Show(ui, tab);
                    });
                    break;
                case TownTab.Mystic:
                    if (selected == null || selected.kind != ItemKind.Equipment)
                    {
                        Ui.Label(tip, "\"Choose one property and I'll reshape it. Only one — the threads won't take a second.\"", 26, TextAnchor.UpperLeft);
                        break;
                    }
                    var (g0, d0, s0) = Town.EnchantCost(selected);
                    for (int i = 0; i < selected.affixes.Count; i++)
                    {
                        int idx = i;
                        var a = selected.affixes[i];
                        var b = Ui.Button(acts, $"Reroll: {StatInfo.Describe(a.stat, a.value)}", () =>
                        {
                            if (!Town.Enchant(s, selected, idx, gm.Rng)) ui.Toast("Can't: cost, or another property was already enchanted.");
                            Show(ui, tab);
                        }, Ui.ButtonC, 20);
                        b.interactable = selected.enchantedAffix < 0 || selected.enchantedAffix == idx;
                    }
                    Ui.Label(Ui.At(side, "cost", new Vector2(0, 0), new Vector2(10, 260), new Vector2(600, 30)), $"Each reroll: {g0} gold{(d0 > 0 ? $", {d0} dust" : "")}{(s0 > 0 ? $", {s0} soul" : "")}", 22, TextAnchor.MiddleLeft, Ui.Gold);
                    break;
                case TownTab.Stash:
                    if (selected == null) Ui.Label(tip, "Tap items to move them between your bag and the stash.", 26, TextAnchor.UpperLeft);
                    break;
            }
        }

        static void Gamble(UiRoot ui, RectTransform body)
        {
            var gm = GameManager.I;
            var s = gm.State;
            int cost = Loot.GambleCost(s.hero.level);
            Ui.Label(Ui.At(body, "say", new Vector2(0, 1), Vector2.zero, new Vector2(1600, 80)), $"\"Wrapped and sealed. Could be anything. Probably rare. Sometimes… much better.\"   <color=#c9a14a>{cost} gold each</color>", 26, TextAnchor.MiddleLeft);
            var area = Ui.Rect(body, "slots", Vector2.zero, new Vector2(0.55f, 1), Vector2.zero, new Vector2(0, -90));
            var g = Ui.Grid(area, new Vector2(270, 90), 8);
            var tip = Ui.Rect(body, "tip", new Vector2(0.55f, 0), Vector2.one, new Vector2(10, 0), new Vector2(0, -90));
            Ui.Box(tip, Ui.PanelLight);
            var inner = Ui.Rect(tip, "in", Vector2.zero, Vector2.one, new Vector2(10, 10), new Vector2(-10, -10));
            if (selected != null && s.hero.inventory.Contains(selected)) ItemUi.Tooltip(inner, selected, s.hero, true);
            foreach (ItemSlot slot in Enum.GetValues(typeof(ItemSlot)))
            {
                var sl = slot;
                var b = Ui.Button(g, sl.ToString(), () =>
                {
                    var it = Town.Gamble(s, sl, gm.Rng);
                    if (it == null) ui.Toast("Not enough gold, or your bag is full.");
                    else { selected = it; if (it.rarity >= Rarity.Legendary) AudioHub.Play("sfx_legendary"); }
                    Show(ui, TownTab.Gambler);
                });
                b.interactable = s.hero.gold >= cost;
            }
        }

        static void Quests(UiRoot ui, RectTransform body)
        {
            var gm = GameManager.I;
            var s = gm.State;
            var list = Ui.Scroll(body, 12);
            foreach (var q in s.quests.Where(q => !q.turnedIn))
            {
                var qq = q;
                var row = Ui.Row(list, 150, 10);
                string state = q.complete ? "<color=#4cff4c>Complete!</color>" : q.accepted ? $"<color=#bbbbbb>{q.progress}/{q.needed}</color>" : "";
                var lab = Ui.Rect(row, "q", Vector2.zero, Vector2.one);
                Ui.Box(lab, Ui.PanelLight);
                Ui.Label(lab, $"<b>{q.title}</b>  {state}\n{q.text}\n<color=#c9a14a>Reward: {q.rewardGold} gold, {q.rewardXp} XP, a {q.rewardRarity} item</color>", 24, TextAnchor.MiddleLeft);
                Ui.Size(lab, -1, -1, 1);
                Button b;
                if (q.complete) b = Ui.Button(row, "Claim", () => { var it = Town.TurnIn(s, qq, gm.Rng); ui.Toast($"Reward: {it?.name}"); gm.OnEquipmentChanged(); Show(ui, TownTab.Quests); }, new Color(0.25f, 0.5f, 0.2f));
                else if (!q.accepted) b = Ui.Button(row, "Accept", () => { qq.accepted = true; Show(ui, TownTab.Quests); }, Ui.ButtonHot);
                else b = Ui.Button(row, "Abandon", () => { s.quests.Remove(qq); Town.RefreshQuests(s, gm.Rng); Show(ui, TownTab.Quests); }, new Color(0.35f, 0.15f, 0.12f));
                Ui.Size(b, -1, 220, 0);
            }
        }
    }
}
