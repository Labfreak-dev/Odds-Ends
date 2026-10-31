using System.Linq;
using Hollowmere.Core;
using UnityEngine;

namespace Hollowmere
{
    /// <summary>Combine three gems of one rank, or socket a gem into a worn piece that has a socket.</summary>
    public static class JewelerScreen
    {
        public static void Show(UiRoot ui)
        {
            AudioHub.Vary("jeweler_ui", 0.8f);
            var gm = GameManager.I;
            var h = gm.State.hero;
            var root = ui.Fullscreen("jeweler");
            Ui.Label(Ui.Rect(root, "title", new Vector2(0.05f, 0.88f), new Vector2(0.7f, 0.97f)), "<b>Jeweler</b>  three of a rank, plus gold, make the next rank", 28, TextAnchor.MiddleLeft, Ui.Gold);
            var list = Ui.Scroll(Ui.Rect(root, "list", new Vector2(0.05f, 0.16f), new Vector2(0.62f, 0.86f)), 8);
            foreach (var name in Gems.Names)
            {
                for (int rank = 1; rank <= 4; rank++)
                {
                    string id = name + "_" + rank;
                    int have = Gems.Count(h, id);
                    int cost = DesignTable.GemCombineGold(rank);
                    var row = Ui.Row(list, 72, 6);
                    Ui.Label(row, $"{id}  x{have}   {cost} gold", 22, TextAnchor.MiddleLeft);
                    int r = rank;
                    string n = name;
                    Ui.Button(row, "Combine", () =>
                    {
                        if (!Gems.Combine(h, n, r)) { ui.Toast("Need three gems and the gold."); AudioHub.Vary("gem_socket_fail", 0.8f); }
                        else { AudioHub.Vary("gem_combine", 0.8f); gm.OnEquipmentChanged(); }
                        ui.Close(root.gameObject);
                        Show(ui);
                    }, new Color(0.25f, 0.4f, 0.55f), 20);
                }
            }
            var gear = Ui.Rect(root, "gear", new Vector2(0.66f, 0.16f), new Vector2(0.96f, 0.86f));
            Ui.Label(gear, "Socket into worn gear", 24, TextAnchor.UpperLeft, Ui.Gold);
            float y = -40f;
            foreach (EquipSlot es in System.Enum.GetValues(typeof(EquipSlot)))
            {
                if (es == EquipSlot.Count) continue;
                var worn = h.Equipped(es);
                if (Item.IsNone(worn) || worn.sockets < 1) continue;
                var line = Ui.At(gear, es.ToString(), new Vector2(0f, 1f), new Vector2(0f, y), new Vector2(640f, 64f));
                string pip = string.IsNullOrEmpty(worn.gemId) ? "empty socket" : worn.gemId;
                Ui.Label(line, worn.name + "\n" + pip, 18, TextAnchor.MiddleLeft);
                var gem = h.inventory.FirstOrDefault(i => i.kind == ItemKind.Gem);
                if (gem != null)
                {
                    var g = gem;
                    var slot = es;
                    Ui.Button(line, "Socket", () =>
                    {
                        if (!Gems.Socket(h, h.Equipped(slot), g.baseId)) AudioHub.Vary("gem_socket_fail", 0.8f);
                        else { AudioHub.Vary("gem_socket", 0.8f); gm.OnEquipmentChanged(); }
                        ui.Close(root.gameObject);
                        Show(ui);
                    }, new Color(0.45f, 0.35f, 0.15f), 18);
                }
                y -= 72f;
            }
            var close = Ui.Button(root, "Close", () => ui.Close(root.gameObject), new Color(0.4f, 0.15f, 0.12f), 26, UiSfx.Back);
            var cr = (RectTransform)close.transform;
            cr.anchorMin = cr.anchorMax = new Vector2(1f, 1f);
            cr.pivot = new Vector2(1f, 1f);
            cr.sizeDelta = new Vector2(180f, 64f);
            cr.anchoredPosition = new Vector2(-24f, -24f);
        }
    }
}
