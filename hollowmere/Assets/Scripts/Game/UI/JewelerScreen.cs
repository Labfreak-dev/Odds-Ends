using System.Linq;
using Hollowmere.Core;
using UnityEngine;
using UnityEngine.UI;

namespace Hollowmere
{
    /// <summary>Combine three gems of one rank, or socket a gem into a worn piece that has a socket.
    /// The bench is a modal inside the safe area. The HUD is hidden until it closes.</summary>
    public static class JewelerScreen
    {
        public static void Show(UiRoot ui)
        {
            AudioHub.Vary("jeweler_ui", 0.8f);
            if (ui.Hud != null) ui.Hud.gameObject.SetActive(false);
            var gm = GameManager.I;
            var h = gm.State.hero;
            var root = ui.Fullscreen("jeweler");
            root.gameObject.AddComponent<HudRestorer>();
            var dim = root.gameObject.AddComponent<Image>();
            dim.color = new Color(0.02f, 0.02f, 0.03f, 0.72f);
            dim.raycastTarget = true;

            var safe = Ui.Rect(root, "safe", Vector2.zero, Vector2.one);
            safe.gameObject.AddComponent<SafeArea>();
            var panel = Ui.Rect(safe, "panel", new Vector2(0.06f, 0.08f), new Vector2(0.94f, 0.92f));
            Ui.Box(panel, new Color(0.08f, 0.07f, 0.06f, 0.96f));

            Ui.Label(Ui.Rect(panel, "title", new Vector2(0.03f, 0.9f), new Vector2(0.78f, 0.98f)),
                "<b>Jeweler</b>\nThree of a rank, plus gold, make the next rank.", 26, TextAnchor.MiddleLeft, Ui.Gold);
            var close = Ui.Button(panel, "Close", () => ui.Close(root.gameObject), new Color(0.45f, 0.16f, 0.12f), 24, UiSfx.Back);
            var cr = (RectTransform)close.transform;
            cr.anchorMin = new Vector2(0.8f, 0.9f);
            cr.anchorMax = new Vector2(0.98f, 0.98f);
            cr.offsetMin = cr.offsetMax = Vector2.zero;

            var listArea = Ui.Rect(panel, "list", new Vector2(0.03f, 0.04f), new Vector2(0.62f, 0.88f));
            var list = Ui.Scroll(listArea, 8);
            foreach (var name in Gems.Names)
            {
                for (int rank = 1; rank <= 4; rank++)
                {
                    string id = name + "_" + rank;
                    int have = Gems.Count(h, id);
                    int cost = DesignTable.GemCombineGold(rank);
                    var row = Ui.Row(list, 68, 10);
                    var hl = row.GetComponent<HorizontalLayoutGroup>();
                    hl.childForceExpandWidth = false;
                    hl.padding = new RectOffset(8, 8, 4, 4);
                    var icon = ArtDrop.Sprite(DesignTable.GemArt(id));
                    if (icon != null)
                    {
                        var slot = new GameObject("icon", typeof(RectTransform), typeof(Image));
                        slot.transform.SetParent(row, false);
                        var ii = slot.GetComponent<Image>();
                        ii.sprite = icon;
                        ii.preserveAspect = true;
                        ii.raycastTarget = false;
                        Ui.Size(slot.transform, 56, 56, 0);
                    }
                    var txt = Ui.Label(row, $"{id}   x{have}    {cost} gold", 22, TextAnchor.MiddleLeft);
                    Ui.Size(txt.transform.parent, 60, -1, 1);
                    int r = rank;
                    string n = name;
                    var btn = Ui.Button(row, "Combine", () =>
                    {
                        if (!Gems.Combine(h, n, r)) { ui.Toast("Need three gems and the gold."); AudioHub.Vary("gem_socket_fail", 0.8f); }
                        else { AudioHub.Vary("gem_combine", 0.8f); gm.OnEquipmentChanged(); }
                        ui.Close(root.gameObject);
                        Show(ui);
                    }, new Color(0.25f, 0.4f, 0.55f), 20);
                    Ui.Size(btn, 56, 200, 0);
                }
            }

            var gear = Ui.Rect(panel, "gear", new Vector2(0.64f, 0.04f), new Vector2(0.97f, 0.88f));
            Ui.Label(Ui.Rect(gear, "gearTitle", new Vector2(0f, 0.92f), Vector2.one), "Socket into worn gear", 22, TextAnchor.UpperLeft, Ui.Gold);
            var gearList = Ui.Scroll(Ui.Rect(gear, "gearList", Vector2.zero, new Vector2(1f, 0.9f)), 6);
            foreach (EquipSlot es in System.Enum.GetValues(typeof(EquipSlot)))
            {
                if (es == EquipSlot.Count) continue;
                var worn = h.Equipped(es);
                if (Item.IsNone(worn) || worn.sockets < 1) continue;
                var row = Ui.Row(gearList, 78, 8);
                var ghl = row.GetComponent<HorizontalLayoutGroup>();
                ghl.childForceExpandWidth = false;
                string pip = string.IsNullOrEmpty(worn.gemId) ? "empty socket" : worn.gemId;
                var label = Ui.Label(row, worn.name + "\n" + pip, 18, TextAnchor.MiddleLeft);
                Ui.Size(label.transform.parent, 72, -1, 1);
                var gem = h.inventory.FirstOrDefault(i => i.kind == ItemKind.Gem);
                if (gem == null) continue;
                var g = gem;
                var slot = es;
                var socket = Ui.Button(row, "Socket", () =>
                {
                    if (!Gems.Socket(h, h.Equipped(slot), g.baseId)) AudioHub.Vary("gem_socket_fail", 0.8f);
                    else { AudioHub.Vary("gem_socket", 0.8f); gm.OnEquipmentChanged(); }
                    ui.Close(root.gameObject);
                    Show(ui);
                }, new Color(0.45f, 0.35f, 0.15f), 18);
                Ui.Size(socket, 64, 160, 0);
            }
        }
    }

    /// <summary>Puts the play HUD back when the modal that hid it is destroyed.</summary>
    public sealed class HudRestorer : MonoBehaviour
    {
        void OnDestroy()
        {
            if (UiRoot.I != null && UiRoot.I.Hud != null)
                UiRoot.I.Hud.gameObject.SetActive(true);
        }
    }
}
