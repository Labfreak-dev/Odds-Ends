using System;
using System.Collections.Generic;
using System.Linq;
using Hollowmere.Core;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Hollowmere
{
    public enum TownTab { Merchant, Blacksmith, Mystic, Gambler, Stash, Quests }

    /// <summary>Canvas, event system, HUD and every modal screen.</summary>
    public sealed class UiRoot : MonoBehaviour
    {
        public static UiRoot I;
        public Canvas canvas;
        public Hud Hud;
        public RectTransform modalLayer;
        readonly List<GameObject> modals = new List<GameObject>();
        RectTransform toastBox;
        readonly List<(Text text, float until)> toasts = new List<(Text, float)>();

        public bool AnyModal => modals.Any(m => m != null && m.activeSelf && m.name != "fishing");

        void Awake()
        {
            I = this;
            canvas = gameObject.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = 10;
            var scaler = gameObject.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(2400, 1080);
            scaler.matchWidthOrHeight = 0.6f;
            gameObject.AddComponent<GraphicRaycaster>();

            if (FindFirstObjectByType<EventSystem>() == null)
            {
                var es = new GameObject("EventSystem", typeof(EventSystem));
#if ENABLE_INPUT_SYSTEM && !ENABLE_LEGACY_INPUT_MANAGER
                es.AddComponent<UnityEngine.InputSystem.UI.InputSystemUIInputModule>();
#else
                es.AddComponent<StandaloneInputModule>();
#endif
                DontDestroyOnLoad(es);
            }

            // Respect notches / rounded corners.
            var safe = Ui.Rect(transform, "safe", Vector2.zero, Vector2.one);
            safe.gameObject.AddComponent<SafeArea>();

            Hud = Hud.Create(safe);
            modalLayer = Ui.Rect(safe, "modals", Vector2.zero, Vector2.one);
            toastBox = Ui.Rect(safe, "toasts", new Vector2(0.25f, 0.55f), new Vector2(0.75f, 0.8f));
            var vl = toastBox.gameObject.AddComponent<VerticalLayoutGroup>();
            vl.childAlignment = TextAnchor.LowerCenter; vl.childControlHeight = true; vl.childForceExpandHeight = false; vl.spacing = 4;
        }

        void Update()
        {
            for (int i = toasts.Count - 1; i >= 0; i--)
            {
                var (t, until) = toasts[i];
                if (t == null) { toasts.RemoveAt(i); continue; }
                float left = until - Time.unscaledTime;
                var c = t.color; c.a = Mathf.Clamp01(left); t.color = c;
                if (left <= 0) { Destroy(t.transform.parent.gameObject); toasts.RemoveAt(i); }
            }
            Time.timeScale = AnyModal ? 0f : 1f;
        }

        public void Toast(string msg)
        {
            if (toasts.Count >= 4) { Destroy(toasts[0].text.transform.parent.gameObject); toasts.RemoveAt(0); }
            var row = Ui.Rect(toastBox, "toast", Vector2.zero, Vector2.one);
            Ui.Size(row, 52);
            Ui.Box(row, new Color(0, 0, 0, 0.45f));
            var t = Ui.Label(row, msg, 30, TextAnchor.MiddleCenter);
            toasts.Add((t, Time.unscaledTime + 3.2f));
        }

        // ---------------- modal plumbing ----------------

        /// <summary>A full-screen dimmed modal with a titled panel. `build` fills the panel body.</summary>
        public RectTransform Modal(string name, string title, Vector2 min, Vector2 max, bool closable = true, Action onClose = null)
        {
            CloseAll();
            var root = Ui.Rect(modalLayer, name, Vector2.zero, Vector2.one);
            Ui.Box(root, Ui.Dim, false);
            var panel = Ui.Rect(root, "panel", min, max);
            var bg = Ui.Box(panel, Color.white);
            bool authored = UiArt.HasAuthoredPanel;
            UiArt.ApplySlice(bg, UiArt.PanelSprite(), authored);
            RectTransform frame = null;
            if (!authored)
            {
                frame = Ui.Rect(panel, "frame", Vector2.zero, Vector2.one);
                var frameImg = frame.gameObject.AddComponent<Image>();
                UiArt.ApplySlice(frameImg, UiArt.FrameSprite());
                frameImg.raycastTarget = false;
            }
            root.gameObject.AddComponent<UiMenuMotion>().Arm(panel, new Vector2(0, -22f), 0.9f);
            var head = Ui.Rect(panel, "title", new Vector2(0, 1), new Vector2(1, 1), new Vector2(48, -108), new Vector2(-120, -16));
            if (UiArt.PanelHeader != null)
            {
                var banner = Ui.Rect(head, "banner", Vector2.zero, Vector2.one);
                var bi = banner.gameObject.AddComponent<Image>();
                UiArt.ApplySlice(bi, UiArt.PanelHeader);
                bi.raycastTarget = false;
            }
            var icon = UiArt.Icon(name);
            float textLeft = 8f;
            if (icon != null)
            {
                var slot = Ui.At(head, "icon", new Vector2(0, 0.5f), Vector2.zero, new Vector2(52, 52));
                slot.pivot = new Vector2(0, 0.5f);
                var ii = slot.gameObject.AddComponent<Image>();
                ii.sprite = icon;
                ii.preserveAspect = true;
                ii.raycastTarget = false;
                textLeft = 64f;
            }
            var label = Ui.Label(head, $"<b>{title}</b>", 40, TextAnchor.MiddleLeft, Ui.Gold);
            var lr = (RectTransform)label.transform;
            lr.offsetMin = new Vector2(textLeft, lr.offsetMin.y);
            if (closable)
            {
                var x = Ui.Button(panel, UiArt.CloseButton != null ? "" : "X", () => { Close(root.gameObject); onClose?.Invoke(); }, new Color(0.45f, 0.15f, 0.12f), 34, UiSfx.Back);
                var xr = (RectTransform)x.transform;
                xr.anchorMin = xr.anchorMax = new Vector2(1, 1); xr.pivot = new Vector2(1, 1);
                if (UiArt.CloseButton != null)
                {
                    var xi = x.GetComponent<Image>();
                    xi.sprite = UiArt.CloseButton;
                    xi.type = Image.Type.Simple;
                    xi.color = Color.white;
                    var press = x.GetComponent<UiPress>();
                    if (press != null) press.pressedSprite = null;
                    xr.sizeDelta = new Vector2(96, 96);
                    xr.anchoredPosition = new Vector2(-18, -18);
                }
                else
                {
                    xr.sizeDelta = new Vector2(84, 66);
                    xr.anchoredPosition = new Vector2(-22, -22);
                }
            }
            modals.Add(root.gameObject);
            AudioHub.Panel(true);
            var body = Ui.Rect(panel, "body", Vector2.zero, Vector2.one, new Vector2(48, 40), new Vector2(-48, -120));
            if (frame != null) frame.SetAsLastSibling();
            return body;
        }

        public void Close(GameObject m)
        {
            if (m == null) return;
            if (m.name != "title" && m.name != "fishing" && modals.Contains(m))
                AudioHub.Panel(false);
            var motion = m.GetComponent<UiMenuMotion>();
            if (motion != null && motion.PlayOut(() => FinishClose(m))) return;
            FinishClose(m);
        }

        void FinishClose(GameObject m)
        {
            modals.Remove(m);
            if (m != null) Destroy(m);
            Time.timeScale = AnyModal ? 0f : 1f;
        }

        public void CloseAll()
        {
            foreach (var m in modals.ToList()) if (m != null && m.name != "fishing") { modals.Remove(m); Destroy(m); }
        }

        public void Track(GameObject m) => modals.Add(m);

        /// <summary>Drop any open fishing overlay without resolving it (the world is being torn down).</summary>
        public void CloseFishing()
        {
            foreach (var m in modals.ToList()) if (m != null && m.name == "fishing") { modals.Remove(m); Destroy(m); }
        }

        // ---------------- screens ----------------

        public void ShowTitle() { Hud.gameObject.SetActive(false); TitleScreen.Show(this); }

        /// <summary>Fade a menu out, then close it. Uses unscaled time so it still plays while paused.</summary>
        public void FadeAndClose(GameObject m, Action then)
        {
            if (m == null) { then?.Invoke(); return; }
            StartCoroutine(FadeAndCloseRoutine(m, then));
        }

        System.Collections.IEnumerator FadeAndCloseRoutine(GameObject m, Action then)
        {
            var cg = m.GetComponent<CanvasGroup>() ?? m.AddComponent<CanvasGroup>();
            cg.blocksRaycasts = false;
            float t = 0f;
            while (t < 0.28f && m != null)
            {
                t += Time.unscaledDeltaTime;
                cg.alpha = 1f - Mathf.Clamp01(t / 0.28f);
                yield return null;
            }
            if (m != null) Close(m);
            then?.Invoke();
        }
        public void ShowDeath() => DeathScreen.Show(this);
        public void ShowWaypoints() => WaypointScreen.Show(this);
        public void OpenInventory() => InventoryScreen.Show(this);
        public void OpenSkills() => SkillScreen.Show(this);
        public void OpenPet() => PetScreen.Show(this);
        public void OpenMenu() => MenuScreen.Show(this);
        public void OpenTown(TownTab tab) => TownScreen.Show(this, tab);
        public void OpenFishing(FishingSession s, Vector3 bobberAt, Action onDone) => FishingScreen.Show(this, s, bobberAt, onDone);
    }

    /// <summary>Shrinks its rect to Screen.safeArea.</summary>
    public sealed class SafeArea : MonoBehaviour
    {
        Rect last;
        void Update()
        {
            var sa = Screen.safeArea;
            if (sa == last || Screen.width == 0) return;
            last = sa;
            var rt = (RectTransform)transform;
            rt.anchorMin = new Vector2(sa.xMin / Screen.width, sa.yMin / Screen.height);
            rt.anchorMax = new Vector2(sa.xMax / Screen.width, sa.yMax / Screen.height);
            rt.offsetMin = rt.offsetMax = Vector2.zero;
        }
    }
}
