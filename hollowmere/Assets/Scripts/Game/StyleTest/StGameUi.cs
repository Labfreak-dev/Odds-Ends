using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;
using Hollowmere.StyleTest.Skills;

namespace Hollowmere.StyleTest
{
    /// <summary>Phase-6 uGUI helpers on top of StUi (same 2340x1080 reference, ScaleWithScreenSize).</summary>
    public static class StGameUi
    {
        public static readonly Color Gold = new Color(1f, 0.82f, 0.38f), Dim = new Color(0.72f, 0.74f, 0.8f), Panel = new Color(0.08f, 0.08f, 0.11f, 0.94f);
        public static readonly Color Green = new Color(0.25f, 0.6f, 0.3f), Red = new Color(0.62f, 0.18f, 0.14f), Slate = new Color(0.2f, 0.21f, 0.26f), Blue = new Color(0.22f, 0.36f, 0.62f);

        public static RectTransform Button(Transform parent, string name, string label, Vector2 anchor, Vector2 pos, Vector2 size, Color col, System.Action click, int font = 32)
        {
            var r = StUi.Rect(parent, name, anchor, pos, size); var im = StUi.Img(r, col, StUi.RoundRect); im.type = Image.Type.Sliced;
            var hl = StUi.Rect(r, "hl", new Vector2(0.5f, 1), new Vector2(0, -4), new Vector2(size.x - 16, size.y * 0.35f), new Vector2(0.5f, 1)); StUi.Img(hl, new Color(1, 1, 1, 0.10f), StUi.RoundRect).type = Image.Type.Sliced;
            StUi.Txt(r, label, font, Color.white, new Vector2(0.5f, 0.5f), Vector2.zero, size, TextAnchor.MiddleCenter, FontStyle.Bold).name = "label";
            StUi.Btn(r, click); return r;
        }

        public static RectTransform PanelRect(Transform parent, string name, Vector2 anchor, Vector2 pos, Vector2 size, Color? c = null)
        {
            var r = StUi.Rect(parent, name, anchor, pos, size); var im = StUi.Img(r, c ?? Panel, StUi.RoundRect); im.type = Image.Type.Sliced; im.raycastTarget = true; return r;
        }

        /// <summary>Full-screen dimmer that eats clicks (modal).</summary>
        public static RectTransform Dimmer(Transform parent, float a = 0.6f)
        {
            var r = StUi.Stretch(parent, "dim"); var im = StUi.Img(r, new Color(0, 0, 0, a)); im.raycastTarget = true; return r;
        }

        public static Canvas Canvas(string name, int order)
        {
            var c = StUi.MakeCanvas(null, name); c.sortingOrder = order; return c;
        }

        /// <summary>Finds an active, interactable Button by GameObject name (smoke test drives the real UI wiring).</summary>
        public static Button Find(string name)
        {
            foreach (var b in Object.FindObjectsByType<Button>(FindObjectsSortMode.None))
                if (b.name == name && b.isActiveAndEnabled && b.interactable) return b;
            return null;
        }
    }

    /// <summary>Floating joystick: press anywhere in its zone (left part of the screen), the base appears under the thumb and the
    /// knob follows the drag. A short press without drag is reported as a tap (tap-to-move goes through the same zone).</summary>
    public class StJoystick : MonoBehaviour, IPointerDownHandler, IDragHandler, IPointerUpHandler
    {
        public Vector2 value; public System.Action<Vector2> onTap;
        RectTransform zone, baseR, knob; Image baseImg, knobImg; Vector2 origin, home; float downAt; bool dragged; int pointer = -99;
        const float Radius = 130;

        public static StJoystick Create(Transform canvas)
        {
            var zone = StUi.Rect(canvas, "joystick_zone", new Vector2(0, 0), Vector2.zero, Vector2.zero, Vector2.zero);
            zone.anchorMin = new Vector2(0, 0); zone.anchorMax = new Vector2(0.48f, 0.78f); zone.offsetMin = zone.offsetMax = Vector2.zero;
            var im = StUi.Img(zone, new Color(0, 0, 0, 0)); im.raycastTarget = true; zone.SetAsFirstSibling();
            var j = zone.gameObject.AddComponent<StJoystick>(); j.zone = zone;
            j.home = new Vector2(300, 260);
            j.baseR = StUi.Rect(zone, "joy_base", Vector2.zero, j.home, new Vector2(Radius * 2.2f, Radius * 2.2f)); j.baseImg = StUi.Img(j.baseR, new Color(1, 1, 1, 0.16f), StUi.Ring(0.82f));
            var fill = StUi.Rect(j.baseR, "fill", new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(Radius * 2.0f, Radius * 2.0f)); StUi.Img(fill, new Color(0, 0, 0, 0.18f), StUi.Circle);
            j.knob = StUi.Rect(j.baseR, "joy_knob", new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(120, 120)); j.knobImg = StUi.Img(j.knob, new Color(1, 1, 1, 0.38f), StUi.Circle);
            return j;
        }

        Vector2 Local(PointerEventData e)
        {
            RectTransformUtility.ScreenPointToLocalPointInRectangle(zone, e.position, e.pressEventCamera, out var lp);
            return lp - zone.rect.min; // zone-local, origin bottom-left
        }

        public void OnPointerDown(PointerEventData e)
        {
            if (pointer != -99) return; pointer = e.pointerId;
            origin = Local(e); baseR.anchoredPosition = origin; knob.anchoredPosition = Vector2.zero; downAt = Time.unscaledTime; dragged = false;
            baseImg.color = new Color(1, 1, 1, 0.32f); knobImg.color = new Color(1, 1, 1, 0.7f);
        }

        public void OnDrag(PointerEventData e)
        {
            if (e.pointerId != pointer) return;
            var d = Local(e) - origin; if (d.magnitude > 22) dragged = true;
            var k = Vector2.ClampMagnitude(d, Radius); knob.anchoredPosition = k; value = dragged ? k / Radius : Vector2.zero;
        }

        public void OnPointerUp(PointerEventData e)
        {
            if (e.pointerId != pointer) return; pointer = -99;
            if (!dragged && Time.unscaledTime - downAt < 0.35f) onTap?.Invoke(e.position);
            value = Vector2.zero; knob.anchoredPosition = Vector2.zero; baseR.anchoredPosition = home;
            baseImg.color = new Color(1, 1, 1, 0.16f); knobImg.color = new Color(1, 1, 1, 0.38f);
        }

        void OnDisable() { value = Vector2.zero; pointer = -99; }
    }

    /// <summary>World-space floating combat text: rises, scales in, fades, faces the camera.</summary>
    public class StFloatText : MonoBehaviour
    {
        TextMesh tm; float t0, life = 1.1f; Color col; Vector3 vel;
        static Font font;
        public static void Spawn(string s, Vector3 at, Color c, float size = 1f)
        {
            var g = new GameObject("float_txt"); g.transform.position = at + new Vector3(Random.Range(-0.25f, 0.25f), 0, 0);
            var f = g.AddComponent<StFloatText>(); f.tm = g.AddComponent<TextMesh>();
            font = font ? font : Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            f.tm.font = font; g.GetComponent<MeshRenderer>().sharedMaterial = font.material; f.tm.text = s; f.tm.fontSize = 64; f.tm.characterSize = 0.035f * size;
            f.tm.anchor = TextAnchor.MiddleCenter; f.tm.fontStyle = FontStyle.Bold; f.col = c; f.tm.color = c; f.t0 = Time.time; f.vel = Vector3.up * 1.4f;
        }
        void LateUpdate()
        {
            float u = (Time.time - t0) / life; if (u >= 1) { Destroy(gameObject); return; }
            transform.position += vel * Time.deltaTime; vel *= 0.96f;
            var cam = Camera.main; if (cam) transform.rotation = cam.transform.rotation;
            float s = u < 0.12f ? Mathf.Lerp(0.6f, 1.15f, u / 0.12f) : Mathf.Lerp(1.15f, 1f, (u - 0.12f) * 4);
            transform.localScale = Vector3.one * s; var c = col; c.a = u > 0.6f ? 1 - (u - 0.6f) / 0.4f : 1; tm.color = c;
        }
    }

    /// <summary>Simple glow ring + light pillar used for the return portal and level-up flash.</summary>
    public class StPortal : MonoBehaviour
    {
        Transform ring, pillar; float t0; public bool armed; // armed once the hero has stood clear of it (no instant teleport)
        public static StPortal Create(Vector3 at, Color c, string name = "return_portal")
        {
            var g = new GameObject(name); g.transform.position = at; var p = g.AddComponent<StPortal>(); p.t0 = Time.time;
            var r = GameObject.CreatePrimitive(PrimitiveType.Quad); Object.Destroy(r.GetComponent<Collider>()); r.name = "ring";
            r.transform.SetParent(g.transform, false); r.transform.localPosition = Vector3.up * 0.05f; r.transform.localRotation = Quaternion.Euler(90, 0, 0); r.transform.localScale = Vector3.one * 2.4f;
            r.GetComponent<MeshRenderer>().sharedMaterial = StGlow.Mat(c * 1.6f, 1); p.ring = r.transform;
            var pl = GameObject.CreatePrimitive(PrimitiveType.Cylinder); Object.Destroy(pl.GetComponent<Collider>()); pl.name = "pillar";
            pl.transform.SetParent(g.transform, false); pl.transform.localPosition = Vector3.up * 1.6f; pl.transform.localScale = new Vector3(1.3f, 1.6f, 1.3f);
            pl.GetComponent<MeshRenderer>().sharedMaterial = StGlow.Mat(c * 0.5f, 2); p.pillar = pl.transform;
            var l = new GameObject("portal_light").AddComponent<Light>(); l.type = LightType.Point; l.color = c; l.intensity = 3f; l.range = 6f; l.transform.SetParent(g.transform, false); l.transform.localPosition = Vector3.up * 1.2f;
            return p;
        }
        void Update()
        {
            float t = Time.time - t0; float grow = Mathf.Clamp01(t * 2f);
            ring.localRotation = Quaternion.Euler(90, t * 40, 0); ring.localScale = Vector3.one * 2.4f * grow * (1 + 0.05f * Mathf.Sin(t * 4));
            pillar.localScale = new Vector3(1.3f * grow, 1.6f, 1.3f * grow) * (1 + 0.04f * Mathf.Sin(t * 6));
        }
    }
}
