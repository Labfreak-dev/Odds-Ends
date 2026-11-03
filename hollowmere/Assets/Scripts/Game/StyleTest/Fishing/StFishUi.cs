using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using Hollowmere.StyleTest.Skills;

namespace Hollowmere.StyleTest.Fishing
{
    /// <summary>uGUI for phase 5b fishing (2340x1080 reference, same helpers as the skill HUD): context FISH button, reel
    /// minigame panel, bite prompt, catch result popup, escape popup and the catch-table sheet.</summary>
    public static class StFishUi
    {
        static readonly Color Ink = new Color(0.06f, 0.07f, 0.1f, 0.94f), Gold = new Color(1f, 0.82f, 0.38f), Dim = new Color(0.72f, 0.74f, 0.8f), Water = new Color(0.12f, 0.32f, 0.48f, 0.95f);
        static readonly Dictionary<string, Sprite> cache = new Dictionary<string, Sprite>();

        /// <summary>Owned icon as a sprite (aspect kept); procedural fish/chest silhouette when the owned pack is absent.</summary>
        public static Sprite IconSprite(string key, Color fallback)
        {
            if (string.IsNullOrEmpty(key)) key = "fish_t1";
            if (cache.TryGetValue(key, out var s) && s) return s;
            var t = Resources.Load<Texture2D>("STO/Fish/" + key) ?? StFishSpot.FallbackFish(fallback);
            s = Sprite.Create(t, new Rect(0, 0, t.width, t.height), new Vector2(0.5f, 0.5f)); cache[key] = s; return s;
        }

        static Image Icon(RectTransform parent, string key, Vector2 pos, float box, Color fb)
        {
            var sp = IconSprite(key, fb); float ar = sp.rect.width / sp.rect.height;
            var r = StUi.Rect(parent, "icon_" + key, new Vector2(0.5f, 0.5f), pos, ar >= 1 ? new Vector2(box, box / ar) : new Vector2(box * ar, box));
            var im = StUi.Img(r, Color.white, sp); im.preserveAspect = true; return im;
        }

        static RectTransform Panel(Transform root, string name, Vector2 anchor, Vector2 pos, Vector2 size, Color c)
        {
            var r = StUi.Rect(root, name, anchor, pos, size); var im = StUi.Img(r, c, StUi.RoundRect); im.type = Image.Type.Sliced; return r;
        }

        // ------------------------------------------------------------------ FISH context button
        public static RectTransform FishButton(Transform root, System.Action tap, string label = "FISH")
        {
            const float d = 190; var b = StUi.Rect(root, "btn_fish", new Vector2(1, 0), new Vector2(-790, 150), new Vector2(d, d));
            var glow = StUi.Rect(b, "glow", new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(d * 1.6f, d * 1.6f)); StUi.Img(glow, new Color(0.4f, 0.8f, 1f, 0.45f), StUi.Soft);
            var bg = StUi.Rect(b, "bg", new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(d, d)); StUi.Img(bg, new Color(0.08f, 0.2f, 0.3f, 0.95f), StUi.Circle);
            Icon(b, "reel_t2", new Vector2(0, 14), d * 0.72f, new Color(0.6f, 0.45f, 0.3f));
            var rim = StUi.Rect(b, "rim", new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(d, d)); StUi.Img(rim, new Color(0.55f, 0.88f, 1f), StUi.Ring(0.88f));
            StUi.Txt(b, label, 34, Color.white, new Vector2(0.5f, 0), new Vector2(0, 30), new Vector2(240, 44), TextAnchor.MiddleCenter, FontStyle.Bold);
            if (tap != null) StUi.Btn(b, tap);
            return b;
        }

        /// <summary>While fishing the skill HUD is hidden; this strip shows where you are, the trip count and a STOP button.</summary>
        public static Canvas FishingHud(Camera cam, string loc, int caught, System.Action stop)
        {
            var cv = StUi.MakeCanvas(cam, "p5b_fishing_hud"); var root = cv.transform; var l = StFishDb.Locations[loc];
            var ban = Panel(root, "banner", new Vector2(0.5f, 1), new Vector2(0, -60), new Vector2(760, 96), new Color(0.06f, 0.1f, 0.14f, 0.85f));
            Icon(ban, "fish_t1", new Vector2(-320, 0), 86, Color.white);
            StUi.Txt(ban, l.name, 40, Color.white, new Vector2(0.5f, 0.5f), new Vector2(20, 14), new Vector2(560, 50), TextAnchor.MiddleCenter, FontStyle.Bold);
            StUi.Txt(ban, "Fishing  ·  catches this trip: " + caught, 24, new Color(0.7f, 0.9f, 1f), new Vector2(0.5f, 0.5f), new Vector2(20, -24), new Vector2(560, 30));
            var sb = Panel(root, "btn_stop_fishing", new Vector2(0, 1), new Vector2(200, -60), new Vector2(320, 90), new Color(0.2f, 0.32f, 0.45f, 0.95f));
            StUi.Txt(sb, "STOP FISHING", 32, Color.white, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(320, 90), TextAnchor.MiddleCenter, FontStyle.Bold);
            if (stop != null) StUi.Btn(sb, stop);
            return cv;
        }

        // ------------------------------------------------------------------ reel minigame
        public class ReelPanel
        {
            public Canvas canvas; public RectTransform zone, fish, progress, root; public Text status, tension; public Image progImg, zoneImg; public RectTransform holdBtn;
            public const float TrackH = 640, TrackW = 150;
        }

        /// <summary>Vertical reel bar: water track with the catch marker darting about, a green net zone the player raises by
        /// holding (falls when released), and a catch meter beside it (fills while the marker is in the zone).</summary>
        public static ReelPanel BuildReel(Camera cam, CatchDef c, ReelGame g)
        {
            var p = new ReelPanel { canvas = StUi.MakeCanvas(cam, "p5b_reel") }; var root = p.canvas.transform;
            var box = Panel(root, "reel_panel", new Vector2(0.5f, 0.5f), new Vector2(520, 30), new Vector2(380, 860), Ink); p.root = box;
            StUi.Txt(box, "REEL IT IN!", 44, Gold, new Vector2(0.5f, 1), new Vector2(0, -16), new Vector2(380, 56), TextAnchor.UpperCenter, FontStyle.Bold);
            var track = StUi.Rect(box, "track", new Vector2(0.5f, 0.5f), new Vector2(-40, -10), new Vector2(ReelPanel.TrackW, ReelPanel.TrackH)); var ti = StUi.Img(track, Water, StUi.RoundRect); ti.type = Image.Type.Sliced;
            var shade = StUi.Rect(track, "depth", new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(ReelPanel.TrackW - 10, ReelPanel.TrackH - 10)); StUi.Img(shade, new Color(0.02f, 0.06f, 0.12f, 0.75f), StUi.Vertical).transform.localRotation = Quaternion.Euler(0, 0, 180);
            for (int i = 1; i < 8; i++) { var l = StUi.Rect(track, "tick", new Vector2(0.5f, 0), new Vector2(0, i * ReelPanel.TrackH / 8), new Vector2(ReelPanel.TrackW - 30, 3)); StUi.Img(l, new Color(1, 1, 1, 0.08f)); }
            p.zone = StUi.Rect(track, "zone", new Vector2(0.5f, 0), Vector2.zero, new Vector2(ReelPanel.TrackW - 14, g.zoneSize * ReelPanel.TrackH), new Vector2(0.5f, 0));
            p.zoneImg = StUi.Img(p.zone, new Color(0.35f, 0.95f, 0.45f, 0.55f), StUi.RoundRect); p.zoneImg.type = Image.Type.Sliced;
            var zr = StUi.Rect(p.zone, "zone_rim", new Vector2(0.5f, 0.5f), Vector2.zero, Vector2.zero); zr.anchorMin = Vector2.zero; zr.anchorMax = Vector2.one; zr.sizeDelta = new Vector2(6, 6);
            var zri = StUi.Img(zr, new Color(0.7f, 1f, 0.7f, 0.9f), StUi.RoundRect); zri.type = Image.Type.Sliced; zri.fillCenter = false;
            p.fish = StUi.Rect(track, "fish", new Vector2(0.5f, 0), Vector2.zero, new Vector2(130, 90));
            var mk = Icon(p.fish, c.kind == CatchKind.Fish ? "wx_07" : c.icon, Vector2.zero, 120, new Color(0.5f, 0.8f, 1f)); mk.color = c.kind == CatchKind.Fish ? new Color(0.1f, 0.12f, 0.18f, 0.92f) : Color.white; // fish shows as a silhouette until caught
            // catch meter
            var meter = StUi.Rect(box, "meter", new Vector2(0.5f, 0.5f), new Vector2(105, -10), new Vector2(46, ReelPanel.TrackH)); var mi = StUi.Img(meter, new Color(0, 0, 0, 0.6f), StUi.RoundRect); mi.type = Image.Type.Sliced;
            p.progress = StUi.Rect(meter, "fill", new Vector2(0.5f, 0), new Vector2(0, 5), new Vector2(34, 0), new Vector2(0.5f, 0));
            p.progImg = StUi.Img(p.progress, Color.yellow, StUi.RoundRect); p.progImg.type = Image.Type.Sliced;
            StUi.Txt(box, "catch", 22, Dim, new Vector2(0.5f, 0), new Vector2(105, 64), new Vector2(120, 30));
            p.status = StUi.Txt(box, "", 26, Color.white, new Vector2(0.5f, 0), new Vector2(0, 28), new Vector2(360, 36), TextAnchor.MiddleCenter, FontStyle.Bold);
            p.tension = StUi.Txt(root, "", 30, Color.white, new Vector2(0.5f, 0.5f), new Vector2(520, 488), new Vector2(380, 40), TextAnchor.MiddleCenter, FontStyle.Bold);
            // big hold button where the basic attack sits
            const float d = 300; var hb = StUi.Rect(root, "btn_reel", new Vector2(1, 0), new Vector2(-270, 235), new Vector2(d, d)); p.holdBtn = hb;
            var hbg = StUi.Rect(hb, "bg", new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(d, d)); StUi.Img(hbg, new Color(0.08f, 0.22f, 0.3f, 0.95f), StUi.Circle);
            Icon(hb, "reel_t2", new Vector2(0, 20), d * 0.66f, new Color(0.6f, 0.45f, 0.3f));
            var hr = StUi.Rect(hb, "rim", new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(d, d)); StUi.Img(hr, new Color(0.55f, 0.88f, 1f), StUi.Ring(0.9f));
            StUi.Txt(hb, "HOLD TO REEL", 32, Color.white, new Vector2(0.5f, 0), new Vector2(0, 36), new Vector2(320, 44), TextAnchor.MiddleCenter, FontStyle.Bold);
            UpdateReel(p, g, false);
            return p;
        }

        public static void UpdateReel(ReelPanel p, ReelGame g, bool holding)
        {
            float H = ReelPanel.TrackH;
            p.zone.anchoredPosition = new Vector2(0, g.zonePos * H); p.zone.sizeDelta = new Vector2(ReelPanel.TrackW - 14, g.zoneSize * H);
            p.zoneImg.color = g.InZone ? new Color(0.35f, 0.95f, 0.45f, 0.6f) : new Color(0.95f, 0.55f, 0.3f, 0.45f);
            p.fish.anchoredPosition = new Vector2(Mathf.Sin(g.time * 9f) * 6f * (g.InZone ? 0.4f : 1f), g.fishPos * H); p.fish.localRotation = Quaternion.Euler(0, 0, Mathf.Clamp(g.fishVel * 40f, -35, 35));
            float f = Mathf.Clamp01(g.progress); p.progress.sizeDelta = new Vector2(34, (H - 10) * f);
            p.progImg.color = f < 0.33f ? new Color(0.95f, 0.3f, 0.25f) : f < 0.66f ? new Color(1f, 0.82f, 0.3f) : new Color(0.4f, 0.95f, 0.45f);
            p.status.text = g.InZone ? "Hooked! Keep it in the net" : "It's pulling away!";
            p.status.color = g.InZone ? new Color(0.6f, 1f, 0.6f) : new Color(1f, 0.65f, 0.45f);
            p.tension.text = "Tension " + Mathf.RoundToInt(g.Tension * 100) + "%"; p.tension.color = Color.Lerp(Color.white, new Color(1f, 0.4f, 0.3f), g.Tension);
            var hb = p.holdBtn.Find("bg").GetComponent<Image>(); hb.color = holding ? new Color(0.16f, 0.45f, 0.58f, 0.98f) : new Color(0.08f, 0.22f, 0.3f, 0.95f);
        }

        // ------------------------------------------------------------------ bite prompt
        public static Canvas BitePrompt(Camera cam, Vector2 viewport, float timer01)
        {
            var cv = StUi.MakeCanvas(cam, "p5b_bite"); var root = cv.transform;
            var at = new Vector2((viewport.x - 0.5f) * StUi.Ref.x, (viewport.y - 0.5f) * StUi.Ref.y + 240);
            var r = StUi.Rect(root, "bite", new Vector2(0.5f, 0.5f), at, new Vector2(200, 200));
            var g = StUi.Rect(r, "glow", new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(340, 340)); StUi.Img(g, new Color(1f, 0.85f, 0.3f, 0.6f), StUi.Soft);
            var bg = StUi.Rect(r, "bg", new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(170, 170)); StUi.Img(bg, new Color(0.95f, 0.3f, 0.2f, 0.97f), StUi.Circle);
            var ring = StUi.Rect(r, "timer", new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(200, 200)); var ri = StUi.Img(ring, Gold, StUi.Ring(0.86f));
            ri.type = Image.Type.Filled; ri.fillMethod = Image.FillMethod.Radial360; ri.fillOrigin = (int)Image.Origin360.Top; ri.fillAmount = 1 - timer01;
            StUi.Txt(r, "!", 130, Color.white, new Vector2(0.5f, 0.5f), new Vector2(0, 4), new Vector2(170, 170), TextAnchor.MiddleCenter, FontStyle.Bold);
            StUi.Txt(r, "TAP TO HOOK!", 46, Gold, new Vector2(0.5f, 0), new Vector2(0, -60), new Vector2(520, 60), TextAnchor.MiddleCenter, FontStyle.Bold);
            return cv;
        }

        // ------------------------------------------------------------------ result popups
        public static Canvas Result(Camera cam, CatchDef c, float kg, bool isNew, int caughtCount, System.Action keep, System.Action release = null)
        {
            var cv = StUi.MakeCanvas(cam, "p5b_result"); var root = cv.transform; var rc = StFishDb.RarityColor(c.rarity);
            var dim = StUi.Stretch(root, "dim"); StUi.Img(dim, new Color(0, 0, 0, 0.35f));
            var box = Panel(root, "result", new Vector2(0.5f, 0.5f), new Vector2(0, 10), new Vector2(820, 820), Ink);
            var ray = StUi.Rect(box, "rays", new Vector2(0.5f, 1), new Vector2(0, -330), new Vector2(620, 620)); StUi.Img(ray, new Color(rc.r, rc.g, rc.b, 0.35f), StUi.Soft);
            var rib = Panel(box, "ribbon", new Vector2(0.5f, 1), new Vector2(0, -6), new Vector2(860, 110), Color.Lerp(rc, Color.black, 0.25f));
            string head = c.kind == CatchKind.Fish ? "FISH CAUGHT!" : c.kind == CatchKind.Treasure ? "TREASURE!" : "...JUNK";
            StUi.Txt(rib, head, 58, Color.white, new Vector2(0.5f, 0.5f), new Vector2(0, -4), new Vector2(800, 90), TextAnchor.MiddleCenter, FontStyle.Bold);
            Icon(box, c.icon, new Vector2(0, 150), 340, rc);
            if (isNew)
            {
                var nb = Panel(box, "new", new Vector2(0.5f, 0.5f), new Vector2(250, 270), new Vector2(150, 64), new Color(0.95f, 0.3f, 0.2f));
                nb.localRotation = Quaternion.Euler(0, 0, -12); StUi.Txt(nb, "NEW!", 38, Color.white, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(150, 64), TextAnchor.MiddleCenter, FontStyle.Bold);
            }
            StUi.Txt(box, c.name, 56, Color.white, new Vector2(0.5f, 0.5f), new Vector2(0, -60), new Vector2(780, 70), TextAnchor.MiddleCenter, FontStyle.Bold);
            StUi.Txt(box, c.rarity.ToString().ToUpperInvariant() + "  ·  " + c.kind, 34, rc, new Vector2(0.5f, 0.5f), new Vector2(0, -116), new Vector2(780, 44), TextAnchor.MiddleCenter, FontStyle.Bold);
            StUi.Txt(box, kg.ToString("0.0") + " kg     " + c.value + " gold", 36, Gold, new Vector2(0.5f, 0.5f), new Vector2(0, -170), new Vector2(780, 44), TextAnchor.MiddleCenter, FontStyle.Bold);
            StUi.Txt(box, "\"" + c.flavor + "\"", 28, Dim, new Vector2(0.5f, 0.5f), new Vector2(0, -224), new Vector2(720, 70), TextAnchor.MiddleCenter, FontStyle.Italic);
            StUi.Txt(box, "Catches this trip: " + caughtCount, 24, Dim, new Vector2(0.5f, 0), new Vector2(0, 150), new Vector2(700, 30));
            var k = Panel(box, "btn_keep", new Vector2(0.5f, 0), new Vector2(release != null || c.kind == CatchKind.Fish ? -160 : 0, 74), new Vector2(280, 90), new Color(0.25f, 0.6f, 0.3f));
            StUi.Txt(k, "KEEP", 40, Color.white, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(280, 90), TextAnchor.MiddleCenter, FontStyle.Bold); StUi.Btn(k, keep);
            if (c.kind == CatchKind.Fish)
            {
                var rl = Panel(box, "btn_release", new Vector2(0.5f, 0), new Vector2(160, 74), new Vector2(280, 90), new Color(0.2f, 0.36f, 0.55f));
                StUi.Txt(rl, "RELEASE", 40, Color.white, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(280, 90), TextAnchor.MiddleCenter, FontStyle.Bold); StUi.Btn(rl, release ?? keep);
            }
            return cv;
        }

        public static Canvas Escaped(Camera cam, CatchDef c, bool missedBite, System.Action ok)
        {
            var cv = StUi.MakeCanvas(cam, "p5b_escaped"); var root = cv.transform;
            var box = Panel(root, "escaped", new Vector2(0.5f, 0.5f), new Vector2(0, 60), new Vector2(720, 520), Ink);
            var rib = Panel(box, "ribbon", new Vector2(0.5f, 1), new Vector2(0, -6), new Vector2(760, 100), new Color(0.5f, 0.18f, 0.16f));
            StUi.Txt(rib, missedBite ? "TOO SLOW!" : "IT GOT AWAY!", 54, Color.white, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(720, 90), TextAnchor.MiddleCenter, FontStyle.Bold);
            var ic = Icon(box, c.kind == CatchKind.Fish ? "wx_07" : c.icon, new Vector2(0, 40), 260, Color.gray); ic.color = new Color(0.08f, 0.09f, 0.12f, 0.95f);
            StUi.Txt(box, "?", 120, new Color(1, 1, 1, 0.8f), new Vector2(0.5f, 0.5f), new Vector2(0, 40), new Vector2(200, 160), TextAnchor.MiddleCenter, FontStyle.Bold);
            StUi.Txt(box, missedBite ? "Tap as soon as the bobber dunks." : "Something " + (c.rarity >= Rarity.Rare ? "big" : "") + " snapped the line.", 30, Dim, new Vector2(0.5f, 0), new Vector2(0, 150), new Vector2(680, 40));
            var k = Panel(box, "btn_ok", new Vector2(0.5f, 0), new Vector2(0, 66), new Vector2(300, 84), new Color(0.2f, 0.36f, 0.55f));
            StUi.Txt(k, "CAST AGAIN", 36, Color.white, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(300, 84), TextAnchor.MiddleCenter, FontStyle.Bold); StUi.Btn(k, ok);
            return cv;
        }

        // ------------------------------------------------------------------ catch table sheet
        public static Canvas CatchTable(Camera cam)
        {
            var cv = StUi.MakeCanvas(cam, "p5b_table"); var root = cv.transform;
            var bg = StUi.Stretch(root, "bg"); StUi.Img(bg, new Color(0.07f, 0.08f, 0.11f));
            StUi.Txt(root, "FISHING CATCH TABLES  ·  weighted rarity rolls per water (StFishDb)", 40, Gold, new Vector2(0.5f, 1), new Vector2(0, -22), new Vector2(2200, 54), TextAnchor.UpperCenter, FontStyle.Bold);
            float colW = 452, x0 = -2 * colW;
            for (int li = 0; li < StFishDb.LocOrder.Count; li++)
            {
                var l = StFishDb.LocOrder[li];
                var col = Panel(root, "col_" + l.id, new Vector2(0.5f, 1), new Vector2(x0 + li * colW, -540), new Vector2(colW - 14, 960), new Color(0.12f, 0.13f, 0.17f, 1));
                var hd = Panel(col, "hd", new Vector2(0.5f, 1), new Vector2(0, -44), new Vector2(colW - 30, 76), Color.Lerp(l.water, Color.black, 0.2f));
                StUi.Txt(hd, l.name, 34, Color.white, new Vector2(0.5f, 0.5f), new Vector2(0, 10), new Vector2(colW - 40, 40), TextAnchor.MiddleCenter, FontStyle.Bold);
                StUi.Txt(hd, l.id.ToUpperInvariant() + "  ·  " + l.blurb, 18, new Color(0.88f, 0.92f, 1f), new Vector2(0.5f, 0.5f), new Vector2(0, -22), new Vector2(colW - 40, 24));
                var rows = new List<(string id, float w)>(l.table); rows.Sort((a, b) => b.w.CompareTo(a.w));
                for (int i = 0; i < rows.Count; i++)
                {
                    var c = StFishDb.Catches[rows[i].id]; var rc = StFishDb.RarityColor(c.rarity); float y = -140 - i * 112;
                    var row = Panel(col, "row", new Vector2(0.5f, 1), new Vector2(0, y), new Vector2(colW - 34, 104), new Color(0.17f, 0.18f, 0.23f, 1));
                    var strip = StUi.Rect(row, "rar", new Vector2(0, 0.5f), new Vector2(4, 0), new Vector2(8, 92), new Vector2(0, 0.5f)); StUi.Img(strip, rc);
                    Icon(row, c.icon, new Vector2(-colW / 2 + 74, 0), 88, rc);
                    StUi.Txt(row, c.name, 25, Color.white, new Vector2(0, 0.5f), new Vector2(130, 22), new Vector2(240, 32), TextAnchor.MiddleLeft, FontStyle.Bold);
                    StUi.Txt(row, c.rarity + " " + (c.kind == CatchKind.Fish ? "fish" : c.kind.ToString().ToLowerInvariant()), 20, rc, new Vector2(0, 0.5f), new Vector2(130, -6), new Vector2(240, 26), TextAnchor.MiddleLeft);
                    StUi.Txt(row, (c.wMin == c.wMax ? c.wMin.ToString("0.0#") : c.wMin.ToString("0.#") + "-" + c.wMax.ToString("0.#")) + " kg · " + c.value + "g", 18, Dim, new Vector2(0, 0.5f), new Vector2(130, -32), new Vector2(240, 24), TextAnchor.MiddleLeft);
                    StUi.Txt(row, (StFishDb.Chance(l.id, c.id) * 100).ToString("0.0") + "%", 30, Gold, new Vector2(1, 0.5f), new Vector2(-14, 0), new Vector2(100, 40), TextAnchor.MiddleRight, FontStyle.Bold);
                }
            }
            // legend
            var leg = StUi.Rect(root, "legend", new Vector2(0.5f, 0), new Vector2(0, 26), new Vector2(2200, 40));
            for (int r = 0; r < 5; r++)
            {
                var rr = (Rarity)r; var sw = StUi.Rect(leg, "sw", new Vector2(0.5f, 0.5f), new Vector2(-640 + r * 300, 0), new Vector2(26, 26)); StUi.Img(sw, StFishDb.RarityColor(rr), StUi.Circle);
                StUi.Txt(leg, rr + " (w " + StFishDb.RarityWeight(rr).ToString("0.#") + ")", 24, Dim, new Vector2(0.5f, 0.5f), new Vector2(-640 + r * 300 + 24, 0), new Vector2(240, 30), TextAnchor.MiddleLeft);
            }
            return cv;
        }
    }
}
