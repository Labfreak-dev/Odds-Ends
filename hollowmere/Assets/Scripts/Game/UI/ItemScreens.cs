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
            var root = ui.Fullscreen("bag");
            if (selected != null && !h.inventory.Contains(selected) && !h.equipment.Contains(selected)) { selected = null; selectedSlot = null; }

            var frame = ArtDrop.Sprite("inv_screen_frame");
            if (frame != null)
            {
                var plate = root.GetComponent<Image>() ?? root.gameObject.AddComponent<Image>();
                plate.sprite = frame; plate.type = Image.Type.Simple; plate.color = Color.white; plate.raycastTarget = false;
            }
            else Ui.Box(root, new Color(0.04f, 0.035f, 0.03f, 0.97f), false);
            var stageHolder = new GameObject("stageLink");
            stageHolder.transform.SetParent(root, false);
            var link = stageHolder.AddComponent<ReleaseWith>();

            RectTransform At(string id)
            {
                var r = DesignTable.UiRect("inventory", id);
                return Ui.Dp(root, id, r.X, r.Y, r.W, r.H);
            }

            var heroActor = HeroActor.I;
            var st = heroActor != null ? heroActor.stats : gm.State.Stats();
            Ui.Label(At("header"), $"<b>{h.name}</b>  Level {h.level}\n<color=#ffe25a>DPS {Fx.Short(h.SheetDps(st))}</color>  Life {Fx.Short(h.MaxLife(st))}  {h.gold:N0} gold", 22, TextAnchor.MiddleCenter, Ui.Gold);
            PaintSlice(At("leftColumn"), "slot_column");
            PaintSlice(At("rightColumn"), "slot_column");
            var model = At("hero");
            var rawGo = new GameObject("portrait", typeof(RectTransform));
            rawGo.transform.SetParent(model, false);
            var rawRt = (RectTransform)rawGo.transform;
            rawRt.anchorMin = Vector2.zero; rawRt.anchorMax = Vector2.one;
            rawRt.offsetMin = new Vector2(8, 8); rawRt.offsetMax = new Vector2(-8, -8);
            var raw = rawGo.AddComponent<RawImage>();
            raw.raycastTarget = false;
            link.extra = InventoryStage.Build(h.heroClass, raw).gameObject;

            foreach (var d in DesignTable.Doll)
            {
                var slotId = d.Id;
                var es = SlotOf(slotId);
                var cell = Ui.Dp(root, slotId, d.X, d.Y, d.W, d.H);
                if (es == EquipSlot.Count)
                {
                    var locked = ItemUi.Cell(cell, null, false, () => ui.Toast("That slot is not open yet."), "");
                    Stretch(locked);
                    SkinGearSlot(locked, null, slotId);
                    continue;
                }
                var it = h.Equipped(es);
                var slotBtn = ItemUi.Cell(cell, it, selectedSlot == es, () =>
                {
                    var worn = h.Equipped(es);
                    selected = worn;
                    selectedSlot = worn != null ? es : (EquipSlot?)null;
                    Sfx.Bag("hover_tick");
                    Show(ui);
                }, "");
                Stretch(slotBtn);
                SkinGearSlot(slotBtn, it, slotId);
            }

            var tabs = At("tabs");
            var equipTab = Ui.Button(tabs, "Equipment", () => { }, Ui.ButtonHot, 22);
            var cosTab = Ui.Button(tabs, "Cosmetics", () => ui.Toast("Cosmetics are not available yet."), Ui.ButtonC, 22);
            SplitPair(equipTab, cosTab);

            PaintSlice(At("bag"), "bag_panel");
            var close = At("close");
            var closeBtn = Ui.Button(close, "", () => { Sfx.Bag("bag_close"); ui.Close(root.gameObject); gm.OnEquipmentChanged(); }, new Color(0.45f, 0.15f, 0.12f), 28, UiSfx.Back);
            Stretch(closeBtn);
            var closeArt = ArtDrop.Sprite("close_x");
            if (closeArt != null)
            {
                var ci = closeBtn.GetComponent<Image>();
                ci.sprite = closeArt; ci.type = Image.Type.Simple; ci.color = Color.white;
            }

            var grid = DesignTable.UiRect("inventory", "grid");
            var cellSize = DesignTable.UiRect("inventory", "gridCell");
            int pitch = cellSize.W + DesignTable.BagGap;
            int capacity = DesignTable.BagCapacity;
            int n = DesignTable.BagColumns * DesignTable.BagRows;
            for (int i = 0; i < n; i++)
            {
                int col = i % DesignTable.BagColumns;
                int row = i / DesignTable.BagColumns;
                int x = grid.X + col * pitch;
                int y = grid.Y + row * pitch;
                var cell = Ui.Dp(root, "cell" + i, x, y, cellSize.W, cellSize.H);
                if (i >= capacity)
                {
                    Ui.Box(cell, new Color(0.05f, 0.05f, 0.05f, 0.85f), true);
                    Ui.Label(cell, "<color=#555555>sealed</color>", 18, TextAnchor.MiddleCenter);
                    continue;
                }
                if (i >= h.inventory.Count)
                {
                    Ui.Box(cell, new Color(0.1f, 0.09f, 0.08f, 0.9f), true);
                    continue;
                }
                var itx = h.inventory[i];
                Stretch(ItemUi.Cell(cell, itx, selectedSlot == null && itx == selected, () =>
                {
                    selected = itx;
                    selectedSlot = null;
                    Sfx.Bag("hover_tick");
                    Show(ui);
                }));
            }

            var bottom = At("bottom");
            var sortBtn = Ui.Button(bottom, "Sort", () =>
            {
                h.inventory = h.inventory.OrderBy(i => i.kind).ThenByDescending(i => i.rarity).ThenBy(i => i.Base?.slot).ToList();
                Sfx.Bag("item_move");
                Show(ui);
            }, Ui.ButtonC, 22);
            var sortRt = (RectTransform)sortBtn.transform;
            sortRt.anchorMin = Vector2.zero; sortRt.anchorMax = new Vector2(0.34f, 1f);
            sortRt.offsetMin = Vector2.zero; sortRt.offsetMax = new Vector2(-4f, 0f);
            var acts = Ui.Rect(bottom, "acts", new Vector2(0.34f, 0f), Vector2.one, new Vector2(4f, 0f), Vector2.zero);
            var buttons = new List<(string label, Action fn, Color color)>();
            var sel = selected;
            if (selectedSlot != null)
            {
                buttons.Add(("Unequip", () =>
                {
                    if (!h.Unequip(selectedSlot.Value)) { ui.Toast("Bag is full."); Sfx.Bag("error_bag_full"); }
                    else Sfx.Bag("item_move");
                    selectedSlot = null;
                    gm.OnEquipmentChanged();
                    Show(ui);
                }, Ui.ButtonC));
            }
            else if (sel != null)
            {
                switch (sel.kind)
                {
                    case ItemKind.Equipment:
                        if (h.CanEquip(sel))
                        {
                            if (sel.Base.slot == ItemSlot.Ring)
                            {
                                buttons.Add(("Ring 1", () => Equip(h, sel, EquipSlot.Ring1, ui), new Color(0.25f, 0.45f, 0.2f)));
                                buttons.Add(("Ring 2", () => Equip(h, sel, EquipSlot.Ring2, ui), new Color(0.25f, 0.45f, 0.2f)));
                            }
                            else buttons.Add(("Equip", () => Equip(h, sel, null, ui), new Color(0.25f, 0.45f, 0.2f)));
                        }
                        buttons.Add((sel.junk ? "Unmark" : "Junk", () => { sel.junk = !sel.junk; Show(ui); }, Ui.ButtonC));
                        buttons.Add(("To pet", () =>
                        {
                            if (!gm.GiveToPet(sel)) ui.Toast(gm.State.pet.Away ? "Your companion is away." : "Saddlebags are full.");
                            selected = null;
                            Show(ui);
                        }, Ui.ButtonC));
                        break;
                    case ItemKind.Fish:
                        var fish = FishDb.Get(sel.fishId);
                        buttons.Add((fish?.effect == FishEffect.PetForm ? "Feed" : "Eat", () => { gm.UseFish(sel, true); Show(ui); }, new Color(0.25f, 0.4f, 0.55f)));
                        buttons.Add(("To pet", () => { if (!gm.GiveToPet(sel)) ui.Toast("Can't right now."); selected = null; Show(ui); }, Ui.ButtonC));
                        break;
                    case ItemKind.Potion:
                        buttons.Add(("Drink", () => { HeroActor.I?.DrinkPotion(); Show(ui); }, new Color(0.45f, 0.16f, 0.16f)));
                        break;
                    case ItemKind.TownPortal:
                        buttons.Add(("Read", () => { ui.CloseAll(); gm.UseTownPortal(); }, Ui.ButtonHot));
                        break;
                }
                buttons.Add(("Drop", () =>
                {
                    h.inventory.Remove(sel);
                    if (HeroActor.I != null) Pickup.DropItem(sel, HeroActor.I.Pos + HeroActor.I.transform.forward * 2);
                    Sfx.Bag("item_discard");
                    selected = null;
                    Show(ui);
                }, new Color(0.4f, 0.15f, 0.12f)));
            }
            PlaceRow(acts, buttons);

            if (sel != null)
            {
                var tip = At("tooltip");
                PaintSlice(tip, "tooltip_frame");
                var thead = Ui.At(tip, "thead", new Vector2(0f, 1f), new Vector2(16f, -12f), new Vector2(500f, 64f));
                var thi = thead.gameObject.AddComponent<Image>();
                var headerArt = ArtDrop.Sprite("tooltip_header");
                if (headerArt != null) { thi.sprite = headerArt; thi.type = Image.Type.Sliced; }
                thi.color = ArtDrop.RarityTint(sel.rarity.ToString());
                var inner = Ui.Rect(tip, "inner", Vector2.zero, Vector2.one, new Vector2(20, 20), new Vector2(-20, -88));
                ItemUi.Tooltip(inner, sel, h, selectedSlot == null);
            }
        }

        static void Stretch(Component c)
        {
            var rt = (RectTransform)c.transform;
            rt.anchorMin = Vector2.zero;
            rt.anchorMax = Vector2.one;
            rt.offsetMin = Vector2.zero;
            rt.offsetMax = Vector2.zero;
            rt.pivot = new Vector2(0.5f, 0.5f);
        }

        static void SplitPair(Button left, Button right)
        {
            var a = (RectTransform)left.transform;
            var b = (RectTransform)right.transform;
            a.anchorMin = new Vector2(0f, 0f); a.anchorMax = new Vector2(0.5f, 1f);
            a.offsetMin = Vector2.zero; a.offsetMax = new Vector2(-4f, 0f);
            b.anchorMin = new Vector2(0.5f, 0f); b.anchorMax = Vector2.one;
            b.offsetMin = new Vector2(4f, 0f); b.offsetMax = Vector2.zero;
        }

        static void PlaceRow(RectTransform row, List<(string label, Action fn, Color color)> buttons)
        {
            int n = buttons.Count;
            if (n == 0) return;
            float gap = 8f;
            for (int i = 0; i < n; i++)
            {
                var b = buttons[i];
                var btn = Ui.Button(row, b.label, b.fn, b.color, 20);
                var rt = (RectTransform)btn.transform;
                float u0 = i / (float)n;
                float u1 = (i + 1) / (float)n;
                rt.anchorMin = new Vector2(u0, 0f);
                rt.anchorMax = new Vector2(u1, 1f);
                rt.offsetMin = new Vector2(i == 0 ? 0f : gap * 0.5f, 0f);
                rt.offsetMax = new Vector2(i == n - 1 ? 0f : -gap * 0.5f, 0f);
            }
        }

        static void PaintSlice(RectTransform rt, string sprite)
        {
            var s = ArtDrop.Sprite(sprite);
            var img = rt.GetComponent<Image>() ?? rt.gameObject.AddComponent<Image>();
            if (s == null) { img.color = new Color(0.07f, 0.06f, 0.05f, 0.85f); return; }
            img.sprite = s; img.type = Image.Type.Sliced; img.color = Color.white; img.raycastTarget = false;
        }

        static void SkinGearSlot(Button b, Item it, string slotId)
        {
            var img = b.GetComponent<Image>();
            var plate = !Item.IsNone(it) ? ArtDrop.Sprite("slot_" + it.rarity.ToString().ToLowerInvariant()) : ArtDrop.Sprite("slot_normal");
            plate = plate ?? ArtDrop.Sprite("slot_normal");
            if (plate != null && img != null) { img.sprite = plate; img.type = Image.Type.Sliced; img.color = Color.white; }
            if (Item.IsNone(it) && slotId != null)
            {
                string ghostId = slotId == "belt" ? "belt" : slotId == "mainhand" ? "mainhand" : slotId == "ring_l" || slotId == "ring_r" ? "ring" : slotId;
                var ghost = ArtDrop.Sprite("ghost_" + ghostId);
                if (ghost == null) return;
                var g = Ui.At(b.transform, "ghost", new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(72f, 72f));
                var gi = g.gameObject.AddComponent<Image>();
                gi.sprite = ghost; gi.color = new Color(1f, 1f, 1f, 0.45f); gi.raycastTarget = false; gi.preserveAspect = true;
            }
        }

        static EquipSlot SlotOf(string id) => id switch
        {
            "head" => EquipSlot.Head,
            "shoulders" => EquipSlot.Shoulders,
            "chest" => EquipSlot.Chest,
            "hands" => EquipSlot.Hands,
            "wrists" => EquipSlot.Wrists,
            "belt" => EquipSlot.Waist,
            "legs" => EquipSlot.Legs,
            "feet" => EquipSlot.Feet,
            "amulet" => EquipSlot.Amulet,
            "ring_l" => EquipSlot.Ring1,
            "ring_r" => EquipSlot.Ring2,
            "mainhand" => EquipSlot.MainHand,
            "offhand" => EquipSlot.OffHand,
            _ => EquipSlot.Count,
        };

        static void Equip(Hero h, Item it, EquipSlot? slot, UiRoot ui)
        {
            if (!h.Equip(it, slot)) { ui.Toast("No room in your bag for what comes off."); Sfx.Bag("error_bag_full"); }
            else { Sfx.Bag("equip"); selected = null; }
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

    /// <summary>Destroys a world-space object when the modal that owns it goes away.</summary>
    public sealed class ReleaseWith : MonoBehaviour
    {
        public GameObject extra;
        void OnDestroy() { if (extra != null) Destroy(extra); }
    }

    /// <summary>A small stage, off the playfield, that renders the class model into the inventory.</summary>
    public sealed class InventoryStage : MonoBehaviour
    {
        RenderTexture rt;
        Transform pivot;

        public static InventoryStage Build(HeroClass cls, RawImage target)
        {
            var root = new GameObject("InventoryStage");
            root.transform.position = new Vector3(4000f, -40f, 4000f);
            var stage = root.AddComponent<InventoryStage>();
            var tex = new RenderTexture(512, 640, 16) { name = "invHero" };
            stage.rt = tex;
            var camGo = new GameObject("cam");
            camGo.transform.SetParent(root.transform, false);
            camGo.transform.localPosition = new Vector3(0f, 1.15f, -3.4f);
            camGo.transform.localRotation = Quaternion.Euler(8f, 0f, 0f);
            var cam = camGo.AddComponent<Camera>();
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = new Color(0.07f, 0.06f, 0.08f, 1f);
            cam.fieldOfView = 24f;
            cam.nearClipPlane = 0.05f;
            cam.farClipPlane = 12f;
            cam.targetTexture = tex;
            cam.depth = -10f;
            var light = new GameObject("light").AddComponent<Light>();
            light.transform.SetParent(root.transform, false);
            light.transform.localPosition = new Vector3(0.6f, 2.2f, -1.4f);
            light.type = LightType.Point;
            light.range = 8f;
            light.intensity = 3.2f;
            light.color = new Color(1f, 0.94f, 0.86f);
            var pivot = new GameObject("pivot").transform;
            pivot.SetParent(root.transform, false);
            stage.pivot = pivot;
            Art.Animated(Art.HeroModelKey(cls), 1.8f, pivot);
            target.texture = tex;
            target.color = Color.white;
            return stage;
        }

        void Update()
        {
            if (pivot != null) pivot.Rotate(0f, 12f * Time.unscaledDeltaTime, 0f, Space.Self);
        }

        void OnDestroy()
        {
            if (rt == null) return;
            rt.Release();
            Destroy(rt);
        }
    }
}
