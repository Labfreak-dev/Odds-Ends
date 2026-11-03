using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace Hollowmere.StyleTest.Fishing
{
    /// <summary>Reel-in minigame model (pure, deterministic for a seed): the catch marker darts up and down a bar; holding
    /// pushes the net zone up, releasing lets it sink; the catch meter fills while the marker is inside the zone and drains
    /// outside. Win at 1, escape at 0.</summary>
    public class ReelGame
    {
        public float zonePos = 0.1f, zoneVel, zoneSize = 0.28f, fishPos = 0.3f, fishVel, fishTarget = 0.5f, timer, progress = 0.3f, time;
        public bool Won => progress >= 1f; public bool Lost => progress <= 0f; public bool Done => Won || Lost;
        public bool InZone => fishPos >= zonePos - 0.02f && fishPos <= zonePos + zoneSize + 0.02f;
        public float Tension => Mathf.Clamp01(InZone ? 0.2f + Mathf.Abs(fishVel) * 0.4f : 0.55f + (1 - progress) * 0.45f);
        readonly CatchDef c; readonly System.Random rng;

        public ReelGame(CatchDef c, int seed)
        {
            this.c = c; rng = new System.Random(seed);
            zoneSize = c.kind == CatchKind.Fish ? 0.32f - 0.035f * (int)c.rarity : 0.34f;
        }

        public void Step(float dt, bool hold)
        {
            time += dt;
            zoneVel += (hold ? 2.4f : -2.0f) * dt; zoneVel = Mathf.Clamp(zoneVel, -1.3f, 1.3f); zonePos += zoneVel * dt;
            if (zonePos < 0) { zonePos = 0; zoneVel = Mathf.Max(0, -zoneVel * 0.3f); }
            if (zonePos > 1 - zoneSize) { zonePos = 1 - zoneSize; zoneVel = Mathf.Min(0, -zoneVel * 0.3f); }
            timer -= dt;
            if (timer <= 0) { fishTarget = 0.04f + 0.92f * (float)rng.NextDouble(); timer = Mathf.Lerp(1.7f, 0.45f, c.erratic) * (0.6f + 0.8f * (float)rng.NextDouble()); }
            float maxV = 0.18f + 0.6f * c.speed, want = Mathf.Clamp((fishTarget - fishPos) * 3f, -maxV, maxV);
            fishVel = Mathf.MoveTowards(fishVel, want, 2.5f * dt); fishPos = Mathf.Clamp01(fishPos + fishVel * dt);
            progress += (InZone ? 0.26f : -(0.1f + c.pull * 0.5f)) * dt; progress = Mathf.Clamp(progress, -0.01f, 1.01f);
        }

        /// <summary>Autopilot (smoke tests): hold while the zone centre is below the marker, with a little lead.</summary>
        public bool AutoHold() => zonePos + zoneSize * 0.5f + zoneVel * 0.35f < fishPos + fishVel * 0.2f;
    }

    /// <summary>World-side fishing visuals shared by realtime and stills: bobber flight/float/dunk/drag, splashes, line slack,
    /// and the caught item dangling from the line.</summary>
    public static class StFishFx
    {
        /// <summary>Hero-scaled water ring (StFx.Shock widths are absolute and fill in at small radii).</summary>
        public static void Ring(Vector3 pos, float t, float r, Color col, Transform parent)
        {
            if (t <= 0 || t >= 1) return; float U = StFishDb.U; float rr = Mathf.Lerp(0.12f * U, r, Mathf.Sqrt(t)), w = Mathf.Lerp(0.12f, 0.04f, t) * U;
            var c = col; c.a *= (1 - t);
            var g = StFx.Obj("ring", StFx.Sector(Mathf.Max(0, rr - w), rr, 0, 360, c, c), false, parent); g.transform.position = pos + Vector3.up * 0.02f * U;
        }

        public static Vector3 Arc(Vector3 a, Vector3 b, float u, float h) => Vector3.Lerp(a, b, u) + Vector3.up * h * 4 * u * (1 - u);

        /// <summary>Cast (0..1): bobber leaves the tip at 0.52, lands on the hotspot at 0.86 (splash), then floats.</summary>
        public static void Cast(StFishRig rig, FishSpot s, float t, Transform fx, Camera cam, Vector3 tipAtRelease)
        {
            float U = StFishDb.U; rig.bobber.gameObject.SetActive(true); rig.lineOn = true;
            if (t < 0.52f) { rig.bobber.position = rig.tip.position + Vector3.down * 0.25f * U; rig.slack = 0.2f; }
            else if (t < 0.86f) { float u = Mathf.InverseLerp(0.52f, 0.86f, t); rig.bobber.position = Arc(tipAtRelease, s.hotspot, u, 1.6f * U); rig.slack = Mathf.Lerp(0.1f, 0.6f, u); }
            else { float u = Mathf.InverseLerp(0.86f, 1f, t); rig.bobber.position = s.hotspot + Vector3.up * (0.06f - 0.12f * Mathf.Sin(u * Mathf.PI)) * U; rig.slack = 0.8f; StFx.Sparks(s.hotspot, 0.15f + u * 0.8f, 1.1f * U, new Color(0.75f, 0.9f, 1f, 0.9f), cam, fx, 12, 5); Ring(s.hotspot, u, 1.4f * U, new Color(0.85f, 0.95f, 1f, 0.8f), fx); }
            rig.bobberPos = rig.bobber.position + Vector3.up * 0.2f * U;
        }

        public static void Float(StFishRig rig, FishSpot s, float t, Transform fx, Camera cam, bool nibble)
        {
            float U = StFishDb.U; rig.bobber.gameObject.SetActive(true); rig.lineOn = true; rig.slack = 0.8f;
            float bob = 0.035f * Mathf.Sin(t * Mathf.PI * 2) + (nibble ? -0.06f * Mathf.Max(0, Mathf.Sin(t * Mathf.PI * 6)) : 0);
            rig.bobber.position = s.hotspot + Vector3.up * bob * U; rig.bobber.rotation = Quaternion.Euler(6 * Mathf.Sin(t * 5), 0, 5 * Mathf.Cos(t * 4));
            rig.bobberPos = rig.bobber.position + Vector3.up * 0.2f * U;
            Ring(s.hotspot, Mathf.Repeat(t, 1f), 0.9f * U, new Color(0.85f, 0.95f, 1f, 0.3f), fx);
        }

        /// <summary>Bite (0..1): bobber yanked under at 0.05-0.3 with a big splash, then the line goes tight.</summary>
        public static void Bite(StFishRig rig, FishSpot s, float t, Transform fx, Camera cam)
        {
            float U = StFishDb.U; rig.bobber.gameObject.SetActive(true); rig.lineOn = true;
            float dunk = t < 0.05f ? 0 : t < 0.3f ? Mathf.Sin(Mathf.InverseLerp(0.05f, 0.3f, t) * Mathf.PI * 0.5f) : Mathf.Lerp(1, 0.55f, Mathf.InverseLerp(0.3f, 1f, t));
            rig.bobber.position = s.hotspot + Vector3.down * 0.35f * dunk * U + (rig.transform.position - s.hotspot).normalized * 0.2f * U * Mathf.Clamp01(t * 2);
            rig.bobberPos = rig.bobber.position + Vector3.up * 0.2f * U; rig.slack = Mathf.Lerp(0.8f, 0.05f, Mathf.Clamp01(t * 3));
            if (t > 0.04f) { float u = Mathf.InverseLerp(0.04f, 0.8f, t); StFx.Sparks(s.hotspot, u, 1.6f * U, new Color(0.8f, 0.93f, 1f, 1f), cam, fx, 18, 9); Ring(s.hotspot, u, 2.0f * U, new Color(0.9f, 0.97f, 1f, 0.9f), fx); }
            StFx.Glow(s.hotspot + Vector3.up * 0.3f * U, 0.5f * U * Mathf.Clamp01(1 - t * 1.5f), new Color(1f, 1f, 1f, 0.3f), cam, fx);
        }

        /// <summary>Reel (progress 0..1, fish lateral -1..1): the bobber drags toward the bank, thrashing.</summary>
        public static void Reel(StFishRig rig, FishSpot s, float t, float progress, float lateral, Transform fx, Camera cam)
        {
            float U = StFishDb.U; rig.bobber.gameObject.SetActive(true); rig.lineOn = true; rig.slack = 0.03f;
            var toBank = rig.transform.position - s.hotspot; toBank.y = 0; var side = Vector3.Cross(Vector3.up, toBank.normalized);
            var p = s.hotspot + toBank.normalized * Mathf.Min(toBank.magnitude - 1.4f * U, toBank.magnitude * 0.55f * progress) + side * lateral * 1.1f * U;
            p.y = s.waterY - 0.12f * U + 0.05f * U * Mathf.Sin(t * 30); rig.bobber.position = p; rig.bobberPos = p + Vector3.up * 0.15f * U;
            StFx.Sparks(p, Mathf.Repeat(t * 2.2f, 1f), 0.9f * U, new Color(0.8f, 0.93f, 1f, 0.95f), cam, fx, 10, (int)(t * 2.2f) + 3);
            Ring(p, Mathf.Repeat(t * 1.6f, 1f), 1.0f * U, new Color(0.9f, 0.97f, 1f, 0.7f), fx);
        }

        /// <summary>Show (0..1): the catch is lifted out of the water and dangles from the tip.</summary>
        public static void Show(StFishRig rig, FishSpot s, float t, GameObject item, Transform fx, Camera cam)
        {
            float U = StFishDb.U; rig.bobber.gameObject.SetActive(false); rig.lineOn = true; rig.slack = 0.02f;
            if (item) item.transform.rotation = Quaternion.AngleAxis(Mathf.Sin(t * 7) * 20 * (1 - t * 0.6f), new Vector3(0, -0.79f, 0.62f)); // pendulum swing in the screen plane
            var b = item ? StWorld.Bounds(item) : new Bounds(Vector3.zero, Vector3.one * 0.5f * U); float hang = 0.5f * U + b.size.y * 0.5f;
            var dangle = rig.tip.position + Vector3.down * hang + rig.transform.right * 0.15f * U * Mathf.Sin(t * 9) * (1 - t);
            var from = s.hotspot; float u = Mathf.Clamp01(t / 0.45f); var pos = u < 1 ? Arc(from, dangle, u, 1.2f * U) : dangle;
            if (item) item.transform.position += pos - b.center;
            rig.bobberPos = pos + Vector3.up * b.size.y * 0.5f;
            if (u < 1) { StFx.Sparks(from, u, 1.5f * U, new Color(0.8f, 0.93f, 1f, 1f), cam, fx, 16, 4); }
        }

        /// <summary>3D model for a catch, normalised to `length` world units, hung long-axis vertical.</summary>
        public static GameObject Model(CatchDef c, float length)
        {
            GameObject g = null; var m = c.model ?? "";
            if (m.StartsWith("gem:"))
            {
                var p = Resources.Load<GameObject>("Models/gem_" + m.Substring(4) + "_royal") ?? Resources.Load<GameObject>("Models/gem_" + m.Substring(4) + "_regular");
                if (p) { g = Object.Instantiate(p); var col = m.Contains("sapphire") ? new Color(0.3f, 0.6f, 1.6f) : new Color(1.2f, 0.5f, 1.6f); foreach (var r in g.GetComponentsInChildren<Renderer>()) r.sharedMaterial = StMat.Make("fishgem_" + m, null, col * 0.5f, false, 0, col * 0.35f); }
            }
            else if (m.StartsWith("box:"))
            {
                g = GameObject.CreatePrimitive(PrimitiveType.Cube); Object.Destroy(g.GetComponent<Collider>()); g.transform.localScale = new Vector3(0.35f, 1f, 0.5f);
                ColorUtility.TryParseHtmlString("#" + m.Substring(4), out var col); g.GetComponent<Renderer>().sharedMaterial = StMat.Make("fishbox_" + m, null, col, false, 0, col * 0.25f);
                var w = new GameObject("catch_" + c.id); g.transform.SetParent(w.transform, false); g = w;
            }
            else
            {
                var p = Resources.Load<GameObject>(m.StartsWith("ST/") ? m : "ST/" + m);
                if (p) { g = Object.Instantiate(p); StMat.ApplyGeneric(g, 0.55f); if (c.tint != Color.white) foreach (var r in g.GetComponentsInChildren<Renderer>()) { var ms = r.sharedMaterials; for (int i = 0; i < ms.Length; i++) { ms[i] = new Material(ms[i]); ms[i].SetColor("_BaseColor", ms[i].GetColor("_BaseColor") * c.tint); } r.sharedMaterials = ms; } }
            }
            if (g == null) { g = GameObject.CreatePrimitive(PrimitiveType.Capsule); Object.Destroy(g.GetComponent<Collider>()); g.GetComponent<Renderer>().sharedMaterial = StMat.Make("fish_fb", null, StFishDb.RarityColor(c.rarity), false); Debug.Log("[ST] p5b model fallback " + c.id); }
            g.name = "catch_" + c.id;
            var holder = new GameObject("held_" + c.id); g.transform.SetParent(holder.transform, true); g.transform.localPosition = Vector3.zero;
            var b = StWorld.Bounds(g); var sz = b.size; float mx = Mathf.Max(sz.x, Mathf.Max(sz.y, sz.z));
            if (c.kind == CatchKind.Fish && mx > 1e-4f)
            {
                // long axis vertical (hung by the mouth)
                var ax = sz.x >= sz.y && sz.x >= sz.z ? Vector3.right : sz.z >= sz.y ? Vector3.forward : Vector3.up;
                var want = new Vector3(0, Mathf.Cos(52 * Mathf.Deg2Rad), Mathf.Sin(52 * Mathf.Deg2Rad)).normalized; // perpendicular to the game camera's view
                g.transform.rotation = Quaternion.FromToRotation(ax, want) * g.transform.rotation;
                var thin = sz.x <= sz.y && sz.x <= sz.z ? Vector3.right : sz.z <= sz.y ? Vector3.forward : Vector3.up; if (thin == ax) thin = Vector3.right;
                var th = Vector3.ProjectOnPlane(g.transform.rotation * Quaternion.Inverse(g.transform.rotation) * (Quaternion.FromToRotation(ax, want) * thin), want);
                var tx = Vector3.ProjectOnPlane(new Vector3(0, 0.79f, -0.62f), want); // thin axis toward the camera -> broad side visible if (th.sqrMagnitude > 1e-4f) g.transform.rotation = Quaternion.AngleAxis(Vector3.SignedAngle(th, tx, want), want) * g.transform.rotation;
            }
            b = StWorld.Bounds(g); mx = Mathf.Max(b.size.x, Mathf.Max(b.size.y, b.size.z)); if (mx > 1e-4f) g.transform.localScale *= length / mx;
            b = StWorld.Bounds(g); g.transform.position -= b.center - holder.transform.position;
            foreach (var r in holder.GetComponentsInChildren<Renderer>()) r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.On;
            return holder;
        }

        public static float ShowLength(CatchDef c, float kg) => StFishDb.U * (c.kind == CatchKind.Fish ? Mathf.Lerp(1.2f, 2.2f, Mathf.InverseLerp(c.wMin, c.wMax, kg)) * (c.model.Contains("shark") ? 1.5f : 1f) : c.model.Contains("Chest") ? 1.0f : 0.6f);
    }

    /// <summary>Realtime fishing session on one hero at one spot (FATE-style): cast -> wait (nibbles) -> bite (tap to hook
    /// within a window) -> reel minigame -> catch shown on the line -> result popup. HM_P5BAUTO-driven autoplay for smoke tests.</summary>
    public class StFishing : MonoBehaviour
    {
        public enum State { Casting, Waiting, Bite, Reeling, Show, Result, Done }
        public State state; public StActor hero; public FishSpot spot; public Camera cam; public bool auto; public System.Action<CatchDef, bool> onCatch; public System.Action onEnd;
        public int caught; public string shotDir; public float autoQuit = -1;
        StFishRig rig; Transform fx; float st, waitFor; CatchDef pending; float kg; ReelGame game; StFishUi.ReelPanel panel; Canvas popup; GameObject held; Vector3 release;
        System.Random rng; AudioSource au; readonly HashSet<string> seen = new HashSet<string>(); bool holdUi;

        public static StFishing Begin(StActor hero, FishSpot spot, Camera cam, bool auto, int seed)
        {
            var f = hero.gameObject.AddComponent<StFishing>(); f.hero = hero; f.spot = spot; f.cam = cam; f.auto = auto; f.rng = new System.Random(seed); return f;
        }

        void Start()
        {
            hero.transform.position = spot.stand; hero.transform.rotation = Quaternion.LookRotation(spot.facing);
            Marker(false); rig = StFishRig.Equip(hero); rig.live = true; fx = new GameObject("fish_fx").transform; au = gameObject.AddComponent<AudioSource>(); au.spatialBlend = 0;
            Cast();
        }

        /// <summary>The floating "fish here" lure + hotspot ripples only show while nobody is fishing.</summary>
        void Marker(bool on) { if (spot?.root == null) return; foreach (Transform t in spot.root) if (t.name == "fish_float_icon" || t.name == "fish_ripples") t.gameObject.SetActive(on); }
        public static void MarkerOf(FishSpot s, bool on) { if (s?.root == null) return; foreach (Transform t in s.root) if (t.name == "fish_float_icon" || t.name == "fish_ripples") t.gameObject.SetActive(on); }

        void Sfx(string n, float vol = 0.8f) { var c = Resources.Load<AudioClip>("STO/FishSfx/" + n); if (c && au) au.PlayOneShot(c, vol); }

        void Cast()
        {
            state = State.Casting; st = 0; hero.Loop("Idle_A", 0.1f);
            pending = StFishDb.Roll(spot.loc, rng, out kg); waitFor = 1.5f + (float)rng.NextDouble() * 3f; Sfx("Cast_Overhead");
            Debug.Log("[ST] p5b cast at " + spot.loc + " (will hook " + pending.id + ")");
        }

        bool Tapped()
        {
            var p = UnityEngine.InputSystem.Pointer.current; var k = UnityEngine.InputSystem.Keyboard.current;
            return (p != null && p.press.wasPressedThisFrame) || (k != null && k.spaceKey.wasPressedThisFrame);
        }

        bool Holding()
        {
            var p = UnityEngine.InputSystem.Pointer.current; var k = UnityEngine.InputSystem.Keyboard.current;
            return (p != null && p.press.isPressed) || (k != null && k.spaceKey.isPressed);
        }

        void Shot(string n) { if (string.IsNullOrEmpty(shotDir)) return; System.IO.Directory.CreateDirectory(shotDir); ScreenCapture.CaptureScreenshot(System.IO.Path.Combine(shotDir, n + ".png")); }

        void Update()
        {
            float dt = Time.deltaTime; st += dt; StFx.Clear(fx);
            switch (state)
            {
                case State.Casting:
                {
                    float T = 1.4f, u = Mathf.Clamp01(st / T); rig.pose = FishPose.Cast; rig.t = u;
                    if (u < 0.52f) release = rig.tip.position;
                    StFishFx.Cast(rig, spot, u, fx, cam, release);
                    if (Mathf.Abs(u - 0.86f) < dt / T) Sfx("Bobber_Plunk");
                    if (u >= 1) { state = State.Waiting; st = 0; hero.Loop("Idle_A"); }
                    break;
                }
                case State.Waiting:
                {
                    rig.pose = FishPose.Hold; rig.t = st * 0.35f; bool nib = st > waitFor - 1.2f;
                    if (nib && Mathf.Repeat(st, 0.5f) < dt) Sfx("Fish_Nibble", 0.5f);
                    StFishFx.Float(rig, spot, st * 0.6f, fx, cam, nib);
                    if (st >= waitFor) { state = State.Bite; st = 0; Sfx("Bobber_Submerge"); Sfx("Bite_Alert", 0.6f); if (shotDir != null) Invoke(nameof(ShotBite), 0.25f); }
                    break;
                }
                case State.Bite:
                {
                    const float window = 1.1f; rig.pose = FishPose.Hold; rig.t = 0;
                    StFishFx.Bite(rig, spot, Mathf.Min(0.3f, st / window * 0.3f), fx, cam);
                    if (popup) Destroy(popup.gameObject);
                    var vp = cam.WorldToViewportPoint(spot.hotspot); popup = StFishUi.BitePrompt(null, vp, st / window);
                    bool hook = auto ? st > 0.35f : Tapped();
                    if (hook) { Destroy(popup.gameObject); Sfx("Hook_Set_Hard"); state = State.Reeling; st = 0; game = new ReelGame(pending, rng.Next()); panel = StFishUi.BuildReel(null, pending, game); Debug.Log("[ST] p5b hooked " + pending.id); }
                    else if (st > window) { Destroy(popup.gameObject); Sfx("Fish_Escaped_Fail"); Debug.Log("[ST] p5b missed bite"); popup = StFishUi.Escaped(null, pending, true, Again); state = State.Result; st = 0; rig.lineOn = false; rig.bobber.gameObject.SetActive(false); }
                    break;
                }
                case State.Reeling:
                {
                    bool hold = auto ? game.AutoHold() : Holding(); game.Step(dt, hold); StFishUi.UpdateReel(panel, game, hold);
                    rig.pose = st < 0.6f ? FishPose.Bite : FishPose.Reel; rig.t = st < 0.6f ? 0.3f + st / 0.6f * 0.7f : (st - 0.6f) * 0.9f;
                    StFishFx.Reel(rig, spot, st, Mathf.Clamp01(game.progress), (game.fishPos - 0.5f) * 2, fx, cam);
                    if (hold && Mathf.Repeat(st, 0.45f) < dt) Sfx("Reel_Crank_Fast", 0.4f);
                    if (!game.InZone && Mathf.Repeat(st, 0.7f) < dt) Sfx("Reel_Drag_Light", 0.4f);
                    if (Mathf.Abs(st - 2.0f) < dt * 0.5f) Shot("03_reel_" + pending.id);
                    if (game.Won)
                    {
                        Destroy(panel.canvas.gameObject); state = State.Show; st = 0; held = StFishFx.Model(pending, StFishFx.ShowLength(pending, kg)); rig.held = held;
                        Sfx(pending.kind == CatchKind.Treasure ? "Treasure_Catch" : pending.kind == CatchKind.Junk ? "Old_Boot_Catch" : "Water_Splash_Medium"); Debug.Log("[ST] p5b caught " + pending.id + " " + kg.ToString("0.0") + "kg");
                    }
                    else if (game.Lost) { Destroy(panel.canvas.gameObject); Sfx("Line_Snap_Hard"); Debug.Log("[ST] p5b escaped " + pending.id); popup = StFishUi.Escaped(null, pending, false, Again); state = State.Result; st = 0; rig.lineOn = false; rig.bobber.gameObject.SetActive(false); }
                    break;
                }
                case State.Show:
                {
                    rig.pose = FishPose.Show; rig.t = Mathf.Clamp01(st / 1.4f); StFishFx.Show(rig, spot, rig.t, held, fx, cam);
                    if (st > 1.4f)
                    {
                        caught++; bool isNew = seen.Add(pending.id); onCatch?.Invoke(pending, isNew);
                        Sfx(pending.rarity >= Rarity.Epic ? "Catch_Legendary_Reward" : pending.rarity >= Rarity.Rare ? "Catch_Rare_Reward" : "Catch_Success");
                        popup = StFishUi.Result(null, pending, kg, isNew, caught, Again, Again); state = State.Result; st = 0; Shot("04_result_" + pending.id);
                    }
                    break;
                }
                case State.Result:
                    if (held) { rig.pose = FishPose.Show; rig.t = 1; StFishFx.Show(rig, spot, 1 + Mathf.Repeat(st, 1f) * 0.0f, held, fx, cam); }
                    else { rig.pose = FishPose.Hold; rig.t = st * 0.35f; }
                    if (auto && st > 1.2f) Again();
                    break;
            }
        }

        void ShotBite() => Shot("02_bite");

        void Again()
        {
            if (popup) Destroy(popup.gameObject); if (held) Destroy(held); held = null; rig.held = null;
            if (auto && caught >= 3 || state == State.Done) { End(); return; }
            Cast();
        }

        public void End()
        {
            state = State.Done; if (popup) Destroy(popup.gameObject); if (panel != null && panel.canvas) Destroy(panel.canvas.gameObject); if (held) Destroy(held);
            if (fx) { StFx.Clear(fx); Destroy(fx.gameObject); }
            rig.Unequip(); Marker(true); onEnd?.Invoke(); Destroy(this);
        }
    }
}
