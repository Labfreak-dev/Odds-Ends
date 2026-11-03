using System.Collections.Generic;
using UnityEngine;

namespace Hollowmere.StyleTest.Skills
{
    /// <summary>Context for one skill evaluation: the caster, its frame at cast time, the aim point and the palette.</summary>
    public class VfxCtx
    {
        public StActor hero; public Transform root; public Camera cam; public SkillDef skill; public Palette pal;
        public Vector3 origin, fwd, right, aim; public float t;
        public Vector3 Local(Vector3 o) => right * o.x + Vector3.up * o.y + fwd * o.z;
        public static VfxCtx For(StActor h, Transform root, Camera cam, SkillDef s, Palette pal, Vector3? aim = null)
        {
            var c = new VfxCtx { hero = h, root = root, cam = cam, skill = s, pal = pal, origin = h.transform.position, fwd = h.transform.forward, right = h.transform.right };
            c.fwd.y = 0; c.fwd.Normalize(); c.right = Vector3.Cross(Vector3.up, c.fwd);
            c.aim = aim ?? (c.origin + c.fwd * Mathf.Max(0.01f, s.range));
            c.aim.y = c.origin.y; return c;
        }
    }

    /// <summary>Evaluates a VfxDef at normalised time t (0..1). Stateless: the scene under 'root' is rebuilt per call, so the
    /// same recipe serves the realtime StSkillRunner (called every frame) and the deterministic proof-shot pipeline.</summary>
    public static class StVfx
    {
        static float U(float t, float a, float b) => Mathf.Clamp01((t - a) / Mathf.Max(1e-4f, b - a));
        static Color Fade(Color c, float k) { c.a *= k; return c * new Color(k, k, k, 1); }
        static Color A(Color c, float a) { c.a = a; return c; }
        static float EaseOut(float u) => 1 - (1 - u) * (1 - u);
        static float Hash(int a, int b) { uint h = (uint)(a * 374761393 + b * 668265263); h = (h ^ (h >> 13)) * 1274126177u; return ((h ^ (h >> 16)) & 0xFFFFFF) / (float)0x1000000; }

        public static Vector3 Resolve(VfxCtx c, Anchor a, Vector3 off)
        {
            var o = c.Local(off);
            switch (a)
            {
                case Anchor.Chest: return c.hero.transform.position + Vector3.up * 1.6f + o;
                case Anchor.HandR: return (c.hero.handR ? c.hero.handR.position : c.hero.transform.position + Vector3.up * 1.6f + c.fwd * 0.5f) + o;
                case Anchor.HandL: return (c.hero.handL ? c.hero.handL.position : c.hero.transform.position + Vector3.up * 1.6f + c.fwd * 0.5f) + o;
                case Anchor.WeaponTip:
                    if (c.hero.weaponR) { var b = StWorld.Bounds(c.hero.weaponR); return new Vector3(b.center.x, b.max.y, b.center.z) + c.fwd * 0.2f + o; }
                    return Resolve(c, Anchor.HandR, off);
                case Anchor.Bow: return Resolve(c, Anchor.HandL, Vector3.zero) + c.fwd * 0.3f + o;
                case Anchor.Aim: return c.aim + o;
                case Anchor.Front: return c.origin + c.fwd * 1.5f + o;
                default: return c.origin + o;
            }
        }

        public static void Play(VfxCtx c, float t)
        {
            c.t = t; StFx.Clear(c.root);
            if (c.skill.vfx == null) return;
            SetVisible(c.hero, true);
            foreach (var s in c.skill.vfx.steps)
            {
                // movers keep their end state after the window
                if (s.kind == Vk.Dash || s.kind == Vk.Blink) { Mover(c, s, t); continue; }
                if (t < s.t0) continue;
                float u, k = 1;
                if (t <= s.t1) u = U(t, s.t0, s.t1);
                else if (s.linger > 0 && t < s.t1 + s.linger) { u = 1; k = 1 - (t - s.t1) / s.linger; }
                else continue;
                Step(c, s, u, k);
            }
        }

        static void Step(VfxCtx c, VfxStep s, float u, float k)
        {
            var col = c.pal[s.role]; var p = Resolve(c, s.from, s.off); var q = Quaternion.LookRotation(c.fwd);
            float yaw = q.eulerAngles.y; var floor = new Vector3(p.x, c.origin.y, p.z);
            switch (s.kind)
            {
                case Vk.Telegraph:
                {
                    var td = c.skill.telegraph; if (td == null) break;
                    var at = td.atAim ? c.aim : c.origin + (td.shape == StFx.Shape.Line || td.shape == StFx.Shape.Cone ? c.fwd * 0.3f : Vector3.zero);
                    StFx.Telegraph(td.shape, at, yaw, td.size, u, col, c.root, td.width, td.angle, td.inner); break;
                }
                case Vk.Slash:
                    StFx.Slash(p, q * Quaternion.Euler(0, 0, s.tilt), s.size, -s.angle / 2, -s.angle / 2 + s.angle * u, Fade(col, k), c.root, s.size2); break;
                case Vk.SpinSlash:
                { float head = u * s.angle; StFx.Slash(p, q, s.size, head - 200, head, Fade(col, k), c.root, s.size2); break; }
                case Vk.Glow:
                {
                    float r = Mathf.Lerp(s.size, s.size2 > 0 ? s.size2 : s.size, u);
                    StFx.Glow(p, r, Fade(col, k * 0.85f), c.cam, c.root); StFx.Glow(p, r * 0.35f, Fade(new Color(1.6f, 1.6f, 1.6f, 1), k), c.cam, c.root); break;
                }
                case Vk.Orb:
                {
                    if (u <= 0 || u >= 1) break; var to = Resolve(c, s.to, s.offTo);
                    var pos = Vector3.Lerp(p, to, u) + Vector3.up * Mathf.Sin(u * Mathf.PI) * s.size2; Orb(c, pos, s.size, col, p); break;
                }
                case Vk.Arrow:
                {
                    if (u <= 0 || u >= 1) break; var to = Resolve(c, s.to, s.offTo);
                    var head = Vector3.Lerp(p, to, u); Arrow(c, p, head, col, s.size, s.size2 > 0);
                    break;
                }
                case Vk.ArrowFan:
                {
                    if (u <= 0 || u >= 1) break; int n = Mathf.Max(1, (int)s.count);
                    for (int i = 0; i < n; i++)
                    {
                        float a = n == 1 ? 0 : Mathf.Lerp(-s.angle / 2, s.angle / 2, i / (float)(n - 1));
                        var d = Quaternion.Euler(0, a, 0) * c.fwd; Arrow(c, p, p + d * s.size * u, col, 1, false);
                    }
                    break;
                }
                case Vk.ArrowRain:
                {
                    int n = Mathf.Max(1, (int)s.count);
                    for (int i = 0; i < n; i++)
                    {
                        float ang = Hash(s.seed, i) * 360, rad = Mathf.Sqrt(Hash(s.seed + 7, i)) * s.size;
                        var land = floor + Quaternion.Euler(0, ang, 0) * Vector3.forward * rad;
                        float st = (i / (float)n) * 0.65f, fi = U(u, st, st + 0.3f);
                        var sky = land + Vector3.up * s.size2 - c.fwd * 2.2f;
                        if (fi > 0 && fi < 1) Arrow(c, sky, Vector3.Lerp(sky, land, fi), col, 1, false);
                        else if (fi >= 1)
                        {
                            Stuck(c, land, (land - sky).normalized, k);
                            float sp = U(u, st + 0.3f, st + 0.45f); StFx.Sparks(land + Vector3.up * 0.1f, sp, 0.8f, col, c.cam, c.root, 6, i);
                        }
                    }
                    break;
                }
                case Vk.Sparks: StFx.Sparks(p, u, s.size, col, c.cam, c.root, Mathf.Max(1, (int)s.count), s.seed); break;
                case Vk.Shock: StFx.Shock(floor, u, s.size, Fade(col, k), c.root); break;
                case Vk.ConeWave:
                {
                    if (u <= 0 || u >= 1) break; float R = s.size * EaseOut(u);
                    var g = StFx.Obj("cone_wave", StFx.Sector(Mathf.Max(0, R - (s.size2 > 0 ? s.size2 : 0.8f)), R, -s.angle / 2, s.angle / 2, A(col, 0), Fade(col, (1 - u) * k)), true, c.root);
                    g.transform.position = p; g.transform.rotation = q; break;
                }
                case Vk.Shards:
                {
                    int n = Mathf.Max(1, (int)s.count); float r = Mathf.Lerp(s.size, s.size2 > 0 ? s.size2 : s.size, Mathf.Sqrt(u));
                    float grow = Mathf.Clamp01(u * 4) * (1 - u * 0.45f) * k;
                    var mat = StMat.Make("fx_shard_" + ColorUtility.ToHtmlStringRGB(Palette.Ldr(col)), null, Palette.Ldr(col), false, 0, Palette.Ldr(col) * 0.35f);
                    for (int i = 0; i < n; i++)
                    {
                        float a = i * 360f / n + Hash(s.seed, i) * 25; var pos = floor + Quaternion.Euler(0, a, 0) * Vector3.forward * r * (0.8f + 0.3f * Hash(s.seed + 3, i));
                        var g = StFx.Obj("shard", Crystal, false, c.root); g.GetComponent<MeshRenderer>().sharedMaterial = mat;
                        g.transform.position = pos; g.transform.rotation = Quaternion.Euler(18 + Hash(s.seed + 5, i) * 25, a, 0);
                        float h = 0.7f + 0.6f * Hash(s.seed + 9, i); g.transform.localScale = new Vector3(0.35f, h, 0.35f) * grow * 1.6f;
                    }
                    break;
                }
                case Vk.Bubble:
                {
                    float r = s.size * (0.55f + 0.45f * EaseOut(u)); var g = StFx.Obj("bubble", Sphere(c.cam, p, r, col, k), true, c.root); g.transform.position = p; break;
                }
                case Vk.Pillar:
                {
                    float a = k * (u < 1 ? Mathf.Sin(u * Mathf.PI * 0.5f) : 1);
                    Billboard(c, floor, s.size, s.size2, Fade(col, a * 0.8f)); Billboard(c, floor, s.size * 0.3f, s.size2 * 0.9f, Fade(new Color(1.8f, 1.8f, 1.8f, 1), a)); break;
                }
                case Vk.Beam:
                {
                    var to = Resolve(c, s.to, s.offTo); float w = s.size * (0.5f + 0.5f * k);
                    Ribbon(c, p, to, w, w, Fade(col, 0.5f * k), Fade(col, 0.5f * k)); Ribbon(c, p, to, w * 0.22f, w * 0.22f, Fade(new Color(1.6f, 1.6f, 1.6f, 1), k), Fade(new Color(1.6f, 1.6f, 1.6f, 1), k)); break;
                }
                case Vk.Lightning: Lightning(c, s, p, u, k, col); break;
                case Vk.RuneRing: Rune(c, floor, s.size * (0.75f + 0.25f * EaseOut(u)), c.t * s.angle, Fade(col, k * Mathf.Clamp01(u * 3))); break;
                case Vk.Banner: Banner(c, floor, s.size, u, k); break;
                case Vk.Hammer: Hammer(c, floor, s.size, s.size2, u, k, col); break;
                case Vk.Flames: Flames(c, s, p, u, k); break;
                case Vk.FlameRing:
                {
                    int n = Mathf.Max(3, (int)s.count);
                    for (int i = 0; i < n; i++)
                    {
                        float a = i * 360f / n; var pos = floor + Quaternion.Euler(0, a, 0) * Vector3.forward * s.size;
                        float fl = 0.75f + 0.25f * Mathf.Sin(c.t * 40 + i * 1.7f); Flame(c, pos, 1.1f, s.size2 * EaseOut(u) * k * fl, c.pal.primary, c.pal.glow, k);
                    }
                    break;
                }
                case Vk.Motes:
                {
                    int n = Mathf.Max(1, (int)s.count); float win = Mathf.Clamp01(u * 6) * Mathf.Clamp01((1 - u) * 4 + 0.001f) * k;
                    if (u >= 1) win = k;
                    for (int i = 0; i < n; i++)
                    {
                        float ph = (Hash(s.seed, i) + c.t * 1.3f) % 1f, ang = Hash(s.seed + 1, i) * 360 + c.t * 120, rad = Mathf.Sqrt(Hash(s.seed + 2, i)) * s.size;
                        var pos = floor + Quaternion.Euler(0, ang, 0) * Vector3.forward * rad + Vector3.up * (0.2f + ph * s.size2);
                        StFx.Glow(pos, 0.09f + 0.08f * Hash(s.seed + 4, i), Fade(col, Mathf.Sin(ph * Mathf.PI) * win), c.cam, c.root);
                    }
                    break;
                }
                case Vk.Meteor:
                {
                    if (u <= 0 || u >= 1) break;
                    // starts low and to the side so it is inside the 52-degree game camera's frame for the whole fall
                    var sky = floor + Vector3.up * s.size2 - c.fwd * 1.2f + c.right * 1.6f; var pos = Vector3.Lerp(sky, floor + Vector3.up * 0.4f, u * u);
                    Orb(c, pos, s.size, col, sky);
                    var rock = StFx.Obj("meteor_rock", Crystal, false, c.root);
                    rock.GetComponent<MeshRenderer>().sharedMaterial = StMat.Make("fx_meteor_rock", null, new Color(0.25f, 0.16f, 0.12f), false, 0, Palette.Ldr(col) * 0.5f);
                    rock.transform.position = pos; rock.transform.rotation = Quaternion.Euler(c.t * 700, 30, c.t * 400); rock.transform.localScale = Vector3.one * s.size * 0.9f;
                    break;
                }
                case Vk.Reticle:
                {
                    float r = s.size * (1 + (1 - EaseOut(u)) * 1.4f); var cc = Fade(col, k * Mathf.Clamp01(u * 3));
                    var g = new GameObject("reticle"); g.transform.SetParent(c.root, false); g.transform.position = p; g.transform.rotation = Quaternion.Euler(0, c.t * 90, 0);
                    StFx.Obj("ring", StFx.Sector(r * 0.86f, r, 0, 360, cc, cc), true, g.transform);
                    StFx.Obj("ring2", StFx.Sector(r * 0.38f, r * 0.46f, 0, 360, cc, cc), true, g.transform);
                    for (int i = 0; i < 4; i++) { var tk = StFx.Obj("tick", StFx.Rect(-0.06f * r, 0.06f * r, r * 0.5f, r * 1.25f, cc, cc), true, g.transform); tk.transform.localRotation = Quaternion.Euler(0, i * 90, 0); }
                    break;
                }
                case Vk.Stars:
                {
                    int n = Mathf.Max(1, (int)s.count); float a0 = Mathf.Clamp01(u * 5) * k;
                    for (int i = 0; i < n; i++)
                    {
                        float a = c.t * 540 + i * 360f / n; var pos = p + Quaternion.Euler(0, a, 0) * Vector3.forward * s.size * (n == 1 ? 0 : 1);
                        Star(c, pos, n == 1 ? 0.55f : 0.28f, Fade(c.pal.glow, a0));
                    }
                    break;
                }
                case Vk.Scorch:
                {
                    var dk = Palette.Ldr(col) * 0.4f; float r = s.size * EaseOut(u);
                    var g = StFx.Obj("scorch", StFx.Sector(0, r, 0, 360, A(dk, 0.7f * k), A(dk, 0)), false, c.root); g.transform.position = floor + Vector3.up * 0.05f; break;
                }
                case Vk.Clouds:
                {
                    int n = Mathf.Max(1, (int)s.count); var dk = Palette.Ldr(col) * 0.6f;
                    for (int i = 0; i < n; i++)
                    {
                        float a = i * 360f / n + c.t * 40; float rr = s.size * (0.35f + 0.45f * Hash(s.seed, i));
                        var pos = floor + Vector3.up * (s.size2 + Hash(s.seed + 1, i) * 0.8f) + Quaternion.Euler(0, a, 0) * Vector3.forward * rr;
                        var g = StFx.Obj("cloud", StFx.Sector(0, s.size * 0.42f * EaseOut(u), 0, 360, A(dk, 0.42f * k), A(dk, 0)), false, c.root); g.transform.position = pos;
                    }
                    break;
                }
                case Vk.Charge:
                {
                    int n = Mathf.Max(1, (int)s.count);
                    for (int i = 0; i < n; i++)
                    {
                        float ph = (Hash(s.seed, i) + u * 2.2f) % 1f; var d = Quaternion.Euler(Hash(s.seed + 1, i) * 140 - 70, Hash(s.seed + 2, i) * 360, 0) * Vector3.forward;
                        var hd = p + d * s.size * (1 - ph); StFx.Trail(hd + d * 0.35f * s.size, hd, 0.07f, Fade(col, ph * k), c.cam, c.root);
                    }
                    StFx.Glow(p, 0.12f + 0.35f * u, Fade(col, k), c.cam, c.root); StFx.Glow(p, 0.06f + 0.12f * u, Fade(new Color(2, 2, 2, 1), k), c.cam, c.root);
                    break;
                }
                case Vk.Bomb:
                {
                    if (u >= 1) break; float pulse = 1 + 0.3f * Mathf.Sin(c.t * 60);
                    StFx.Glow(p, s.size * pulse * (0.7f + 0.6f * u), Fade(col, 0.6f + 0.4f * u), c.cam, c.root); StFx.Glow(p, s.size * 0.35f, new Color(2, 1.8f, 1.2f, 1), c.cam, c.root);
                    float rr = Mathf.Lerp(s.size2, 0.4f, u); var g = StFx.Obj("countdown", StFx.Sector(Mathf.Max(0, rr - 0.18f), rr, 0, 360, Fade(col, 0.9f), Fade(col, 0.9f)), true, c.root);
                    g.transform.position = floor + Vector3.up * 0.07f;
                    StFx.Telegraph(StFx.Shape.Circle, floor, 0, s.size2, u, c.pal[PaletteRole.Telegraph], c.root);
                    break;
                }
            }
        }

        // ------------------------------------------------------------------ movers
        static void Mover(VfxCtx c, VfxStep s, float t)
        {
            float u = U(t, s.t0, s.t1); var dest = c.origin + c.Local(s.off);
            if (s.kind == Vk.Dash)
            {
                var e = u * u * (3 - 2 * u); var cur = Vector3.Lerp(c.origin, dest, e); c.hero.transform.position = cur;
                if (u > 0 && u < 1)
                {
                    int n = Mathf.Max(1, (int)s.count); var col = c.pal[s.role];
                    for (int j = 1; j <= n; j++)
                    {
                        var g = Vector3.Lerp(c.origin, cur, Mathf.Max(0, 1 - j * 0.16f)) + Vector3.up * 1.4f;
                        StFx.Glow(g, s.size * (1 - j * 0.12f), Fade(col, 0.5f * (1 - j / (float)(n + 1))), c.cam, c.root);
                    }
                    foreach (var h in new[] { 0.5f, 1.3f, 2.1f })
                        StFx.Trail(c.origin + Vector3.up * h, cur + Vector3.up * h - (dest - c.origin).normalized * 0.4f, 0.22f, Fade(col, 0.8f), c.cam, c.root);
                }
            }
            else
            {
                bool there = u >= 0.5f; c.hero.transform.position = there ? dest : c.origin;
                SetVisible(c.hero, !(u > 0.38f && u < 0.62f));
                if (u > 0 && u < 1)
                {
                    var col = c.pal[s.role]; float a = 1 - Mathf.Abs(u - 0.5f) * 2;
                    foreach (var at in new[] { c.origin, dest })
                    {
                        StFx.Glow(at + Vector3.up * 1.4f, s.size * (0.4f + a), Fade(col, a), c.cam, c.root);
                        Billboard(c, at, s.size * 0.8f, 3.2f, Fade(col, a));
                    }
                }
            }
        }

        static readonly List<Renderer> rbuf = new List<Renderer>();
        public static void SetVisible(StActor h, bool v)
        {
            h.GetComponentsInChildren(true, rbuf);
            foreach (var r in rbuf) if (!(r is ParticleSystemRenderer)) r.enabled = v;
        }

        // ------------------------------------------------------------------ primitives
        public static void Orb(VfxCtx c, Vector3 p, float r, Color col, Vector3 from)
        {
            // toned: the outer halo is smaller/fainter than phase 4 (it blew out the warm mine biome)
            StFx.Glow(p, r * 1.9f, Fade(col, 0.32f), c.cam, c.root); StFx.Glow(p, r * 1.05f, Fade(col, 0.9f), c.cam, c.root); StFx.Glow(p, r * 0.45f, new Color(1.6f, 1.6f, 1.6f, 1), c.cam, c.root);
            if ((p - from).sqrMagnitude > 0.05f) StFx.Trail(Vector3.MoveTowards(p, from, 3f), p, r * 1.6f, Fade(col, 0.7f), c.cam, c.root);
        }

        static GameObject arrowTpl;
        /// <summary>KayKit arrow_bow mesh (CC0), re-oriented once so the tip points +Z with the tip at the pivot.</summary>
        static GameObject ArrowTpl
        {
            get
            {
                if (arrowTpl) return arrowTpl;
                var pf = Resources.Load<GameObject>("ST/Weapons/arrow_bow");
                arrowTpl = new GameObject("arrow_tpl"); arrowTpl.SetActive(false); Object.DontDestroyOnLoad(arrowTpl);
                if (pf == null) { Debug.LogWarning("[ST] p5 no arrow mesh"); return arrowTpl; }
                var inst = Object.Instantiate(pf); inst.transform.position = Vector3.zero; inst.transform.rotation = Quaternion.identity;
                // longest axis of the render bounds = shaft (the mesh is not CPU-readable, so no vertex analysis);
                // KayKit weapons point up their +Y/+Z, HM_ARROWFLIP=1 flips it
                var rs = inst.GetComponentsInChildren<Renderer>(); var b = rs.Length > 0 ? rs[0].bounds : new Bounds(Vector3.zero, Vector3.one);
                foreach (var rr in rs) b.Encapsulate(rr.bounds);
                int ax = b.size.x >= b.size.y && b.size.x >= b.size.z ? 0 : b.size.y >= b.size.z ? 1 : 2;
                float len = Mathf.Max(1e-4f, b.size[ax]); float wLo = 0, wHi = 0;
                bool tipHigh = true; var flip = System.Environment.GetEnvironmentVariable("HM_ARROWFLIP"); if (flip == "1") tipHigh = false;
                var axis = ax == 0 ? Vector3.right : ax == 1 ? Vector3.up : Vector3.forward; if (!tipHigh) axis = -axis;
                inst.transform.SetParent(arrowTpl.transform, true);
                float sc = 1.25f / len; inst.transform.localScale *= sc;
                inst.transform.rotation = Quaternion.FromToRotation(axis, Vector3.forward);
                var tip = inst.transform.rotation * (TipPoint(b, ax, tipHigh) * sc);
                inst.transform.localPosition = -tip;
                foreach (var r in inst.GetComponentsInChildren<Renderer>()) { r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off; }
                Debug.Log("[ST] p5 arrow axis " + ax + " tipHigh " + tipHigh + " len " + len + " wLo " + wLo + " wHi " + wHi);
                return arrowTpl;
            }
        }
        static Vector3 TipPoint(Bounds b, int ax, bool high) { var p = b.center; p[ax] = high ? b.max[ax] : b.min[ax]; return p; }

        public static void Arrow(VfxCtx c, Vector3 tail, Vector3 head, Color trail, float scale = 1, bool glow = false)
        {
            var d = head - tail; if (d.sqrMagnitude < 1e-4f) return;
            var g = Object.Instantiate(ArrowTpl, c.root); g.SetActive(true); g.name = "arrow";
            g.transform.position = head; g.transform.rotation = Quaternion.LookRotation(d); g.transform.localScale = Vector3.one * scale;
            StFx.Trail(head - d.normalized * Mathf.Min(3.2f, d.magnitude), head - d.normalized * 0.9f * scale, 0.26f * scale, Fade(trail, 0.85f), c.cam, c.root);
            if (glow) StFx.Glow(head - d.normalized * 0.2f, 0.35f * scale, Fade(trail, 0.8f), c.cam, c.root);
        }

        static void Stuck(VfxCtx c, Vector3 land, Vector3 dir, float k)
        {
            var g = Object.Instantiate(ArrowTpl, c.root); g.SetActive(true); g.name = "arrow_stuck";
            g.transform.position = land + dir * 0.35f; g.transform.rotation = Quaternion.LookRotation(dir); g.transform.localScale = Vector3.one * Mathf.Max(0.01f, k);
        }

        public static void Ribbon(VfxCtx c, Vector3 a, Vector3 b, float wa, float wb, Color ca, Color cb)
        {
            var dir = b - a; if (dir.sqrMagnitude < 1e-5f) return;
            var side = Vector3.Cross(dir.normalized, c.cam.transform.forward).normalized;
            var m = new Mesh();
            m.vertices = new[] { a - side * wa / 2, a + side * wa / 2, b - side * wb / 2, b + side * wb / 2 };
            m.colors = new[] { ca, ca, cb, cb }; m.triangles = new[] { 0, 2, 1, 1, 2, 3 }; m.RecalculateBounds();
            StFx.Obj("ribbon", m, true, c.root);
        }

        /// <summary>Vertical light column facing the camera (yaw only), soft at the sides and the top.</summary>
        static void Billboard(VfxCtx c, Vector3 basePos, float w, float h, Color col)
        {
            var side = Vector3.Cross(Vector3.up, c.cam.transform.forward); side.y = 0; if (side.sqrMagnitude < 1e-4f) side = c.cam.transform.right; side = side.normalized * (w / 2);
            var m = new Mesh(); var up = Vector3.up * h;
            m.vertices = new[] { basePos - side, basePos, basePos + side, basePos - side + up, basePos + up, basePos + side + up };
            m.colors = new[] { A(col, 0), col, A(col, 0), A(col, 0), A(col, 0), A(col, 0) };
            m.triangles = new[] { 0, 3, 1, 1, 3, 4, 1, 4, 2, 2, 4, 5 }; m.RecalculateBounds();
            StFx.Obj("pillar", m, true, c.root);
        }

        static Mesh Sphere(Camera cam, Vector3 centre, float r, Color col, float k)
        {
            const int la = 14, lo = 24; var v = new List<Vector3>(); var cl = new List<Color>(); var tr = new List<int>();
            for (int i = 0; i <= la; i++) for (int j = 0; j <= lo; j++)
            {
                float th = Mathf.PI * i / la, ph = 2 * Mathf.PI * j / lo; var n = new Vector3(Mathf.Sin(th) * Mathf.Cos(ph), Mathf.Cos(th), Mathf.Sin(th) * Mathf.Sin(ph));
                v.Add(n * r); var view = (cam.transform.position - (centre + n * r)).normalized; float f = Mathf.Pow(1 - Mathf.Abs(Vector3.Dot(n, view)), 2.2f);
                float band = 0.5f + 0.5f * Mathf.Pow(Mathf.Abs(Mathf.Sin(th * 6) * Mathf.Sin(ph * 6)), 8); // faint hex-ish lattice
                cl.Add(Fade(col, Mathf.Clamp01(0.08f + f * 0.9f * band + f * 0.3f) * k));
                if (i < la && j < lo) { int a = i * (lo + 1) + j, b = a + lo + 1; tr.AddRange(new[] { a, b, a + 1, a + 1, b, b + 1 }); }
            }
            var m = new Mesh(); m.SetVertices(v); m.SetColors(cl); m.SetTriangles(tr, 0); m.RecalculateBounds(); return m;
        }

        static void Rune(VfxCtx c, Vector3 p, float r, float rot, Color col)
        {
            var g = new GameObject("rune"); g.transform.SetParent(c.root, false); g.transform.position = p + Vector3.up * 0.07f; g.transform.rotation = Quaternion.Euler(0, rot, 0);
            var soft = A(col, col.a * 0.25f);
            StFx.Obj("outer", StFx.Sector(r * 0.95f, r, 0, 360, col, col), true, g.transform);
            StFx.Obj("inner", StFx.Sector(r * 0.74f, r * 0.77f, 0, 360, col, col), true, g.transform);
            StFx.Obj("fill", StFx.Sector(0, r * 0.95f, 0, 360, A(col, 0), soft), true, g.transform);
            for (int i = 0; i < 12; i++)
            {
                var tk = StFx.Obj("glyph", StFx.Rect(-0.04f * r, 0.04f * r, r * 0.79f, r * (i % 3 == 0 ? 0.93f : 0.87f), col, col), true, g.transform);
                tk.transform.localRotation = Quaternion.Euler(0, i * 30, 0);
                var dot = StFx.Obj("dot", StFx.Sector(0, r * 0.025f, 0, 360, col, col, null, 10), true, g.transform);
                dot.transform.localPosition = Quaternion.Euler(0, i * 30 + 15, 0) * Vector3.forward * r * 0.85f;
            }
            // hexagram
            for (int i = 0; i < 6; i++)
            {
                float a0 = i * 60 * Mathf.Deg2Rad, a1 = (i * 60 + 120) * Mathf.Deg2Rad;
                var p0 = new Vector3(Mathf.Sin(a0), 0, Mathf.Cos(a0)) * r * 0.74f; var p1 = new Vector3(Mathf.Sin(a1), 0, Mathf.Cos(a1)) * r * 0.74f;
                var ln = StFx.Obj("star", StFx.Rect(-0.02f * r, 0.02f * r, 0, (p1 - p0).magnitude, A(col, col.a * 0.7f), A(col, col.a * 0.7f)), true, g.transform);
                ln.transform.localPosition = p0; ln.transform.localRotation = Quaternion.LookRotation(p1 - p0);
            }
        }

        static void Star(VfxCtx c, Vector3 p, float r, Color col)
        {
            var g = new GameObject("star"); g.transform.SetParent(c.root, false); g.transform.position = p; g.transform.rotation = c.cam.transform.rotation * Quaternion.Euler(-90, 0, 0);
            var v = new List<Vector3> { Vector3.zero }; var cl = new List<Color> { new Color(2, 2, 2, col.a) }; var tr = new List<int>();
            for (int i = 0; i < 8; i++) { float a = i * 45 * Mathf.Deg2Rad, rr = i % 2 == 0 ? r : r * 0.35f; v.Add(new Vector3(Mathf.Sin(a), 0, Mathf.Cos(a)) * rr); cl.Add(col); }
            for (int i = 0; i < 8; i++) tr.AddRange(new[] { 0, 1 + i, 1 + (i + 1) % 8 });
            var m = new Mesh(); m.SetVertices(v); m.SetColors(cl); m.SetTriangles(tr, 0); m.RecalculateBounds();
            var o = StFx.Obj("starmesh", m, true, g.transform);
        }

        static void Lightning(VfxCtx c, VfxStep s, Vector3 p, float u, float k, Color col)
        {
            var to = Resolve(c, s.to, s.offTo); int frame = Mathf.FloorToInt(c.t * 24);
            if (s.size2 > 0)
            {
                // strikes from the sky at random points within radius size2 around 'to'
                int n = Mathf.Max(1, (int)s.count);
                for (int i = 0; i < n; i++)
                {
                    float st = i / (float)n * 0.85f, w = U(u, st, st + 0.18f); if (w <= 0 || w >= 1) continue;
                    var land = to + Quaternion.Euler(0, Hash(s.seed, i) * 360, 0) * Vector3.forward * Mathf.Sqrt(Hash(s.seed + 1, i)) * s.size2;
                    var sky = land + Vector3.up * (p.y - to.y) + c.fwd * 0.6f; float a = 1 - w;
                    Bolt(c, sky, land, s.size, Fade(col, a * k), s.seed + i * 13 + frame);
                    StFx.Glow(land + Vector3.up * 0.3f, 1.2f * a, Fade(col, a * 0.7f), c.cam, c.root); StFx.Shock(land, w, 1.8f, col, c.root);
                }
                return;
            }
            var hops = new List<Vector3> { p, to }; var extra = new[] { new Vector3(2.2f, 0, 1.6f), new Vector3(-1.8f, 0, 2.6f), new Vector3(1.4f, 0, 3.6f) };
            for (int i = 1; i < (int)s.count && i - 1 < extra.Length; i++) hops.Add(to + c.Local(extra[i - 1]));
            int segs = hops.Count - 1; float reveal = u * segs * 1.6f;
            for (int i = 0; i < segs; i++)
            {
                float a = Mathf.Clamp01(reveal - i); if (a <= 0) break;
                Bolt(c, hops[i], Vector3.Lerp(hops[i], hops[i + 1], a), s.size, Fade(col, k), s.seed * 7 + i * 31 + frame);
                StFx.Glow(hops[i + 1], 0.5f * a, Fade(col, k * a), c.cam, c.root);
            }
        }

        static void Bolt(VfxCtx c, Vector3 a, Vector3 b, float w, Color col, int seed)
        {
            const int N = 9; var d = b - a; var perp1 = Vector3.Cross(d.normalized, Vector3.up); if (perp1.sqrMagnitude < 0.01f) perp1 = c.right; perp1.Normalize();
            var perp2 = Vector3.Cross(d.normalized, perp1); var prev = a; float amp = Mathf.Min(0.6f, d.magnitude * 0.08f);
            for (int i = 1; i <= N; i++)
            {
                float f = i / (float)N; var pt = Vector3.Lerp(a, b, f);
                if (i < N) pt += perp1 * (Hash(seed, i) - 0.5f) * 2 * amp + perp2 * (Hash(seed + 5, i) - 0.5f) * 2 * amp;
                Ribbon(c, prev, pt, w, w, col, col); Ribbon(c, prev, pt, w * 0.35f, w * 0.35f, new Color(2, 2, 2, col.a), new Color(2, 2, 2, col.a)); prev = pt;
            }
        }

        static void Banner(VfxCtx c, Vector3 p, float h, float u, float k)
        {
            float drop = (1 - u * u) * 5f; var g = new GameObject("banner"); g.transform.SetParent(c.root, false); g.transform.position = p + Vector3.up * drop;
            g.transform.rotation = Quaternion.LookRotation(-c.fwd);
            var pole = GameObject.CreatePrimitive(PrimitiveType.Cylinder); Object.Destroy(pole.GetComponent<Collider>()); pole.transform.SetParent(g.transform, false);
            pole.transform.localScale = new Vector3(0.12f, h / 2, 0.12f); pole.transform.localPosition = Vector3.up * h / 2;
            pole.GetComponent<Renderer>().sharedMaterial = StMat.Make("fx_banner_pole", null, new Color(0.45f, 0.32f, 0.2f), false);
            var tip = GameObject.CreatePrimitive(PrimitiveType.Sphere); Object.Destroy(tip.GetComponent<Collider>()); tip.transform.SetParent(g.transform, false);
            tip.transform.localScale = Vector3.one * 0.3f; tip.transform.localPosition = Vector3.up * (h + 0.1f);
            var gold = Palette.Ldr(c.pal.glow); tip.GetComponent<Renderer>().sharedMaterial = StMat.Make("fx_banner_tip_" + ColorUtility.ToHtmlStringRGB(gold), null, gold, false, 0, gold * 0.6f);
            // flag: a waving cloth strip in the palette colours (two-sided toon)
            var main = Palette.Ldr(c.pal.primary); var trim = Palette.Ldr(c.pal.secondary);
            const int S = 8; var v = new List<Vector3>(); var cl = new List<Color>(); var tr = new List<int>();
            for (int i = 0; i <= S; i++)
            {
                float f = i / (float)S, wv = Mathf.Sin(f * 5 + c.t * 9) * 0.18f * f;
                v.Add(new Vector3(0.08f + f * 1.6f, h - 0.15f - f * 0.15f, wv)); v.Add(new Vector3(0.08f + f * 1.6f, h - 1.9f + f * 0.25f, wv));
                var cc = i == S || i == 0 ? trim : main; cl.Add(cc); cl.Add(i > S - 2 ? trim : main);
                if (i > 0) { int b = i * 2; tr.AddRange(new[] { b - 2, b - 1, b, b - 1, b + 1, b }); }
            }
            var m = new Mesh(); m.SetVertices(v); m.SetColors(cl); m.SetTriangles(tr, 0); m.RecalculateNormals(); m.RecalculateBounds();
            var flag = new GameObject("flag"); flag.transform.SetParent(g.transform, false); flag.AddComponent<MeshFilter>().sharedMesh = m;
            flag.AddComponent<MeshRenderer>().sharedMaterial = StMat.Make("fx_flag", null, Color.white, true, 0, new Color(0.15f, 0.15f, 0.15f), true);
            StFx.Glow(p + Vector3.up * (h + 0.1f + drop), 0.6f * k, Fade(c.pal.glow, 0.7f * k), c.cam, c.root);
        }

        static void Hammer(VfxCtx c, Vector3 p, float size, float height, float u, float k, Color col)
        {
            float e = u * u; var g = new GameObject("hammer"); g.transform.SetParent(c.root, false);
            g.transform.position = p + Vector3.up * ((1 - e) * height + size * 0.15f); g.transform.rotation = Quaternion.LookRotation(c.right) * Quaternion.Euler(0, 0, (1 - e) * 30);
            g.transform.localScale = Vector3.one * size * Mathf.Max(0.01f, k);
            var gold = Palette.Ldr(c.pal.primary); var mat = StMat.Make("fx_hammer_" + ColorUtility.ToHtmlStringRGB(gold), null, gold, false, 0, gold * 0.75f);
            var head = GameObject.CreatePrimitive(PrimitiveType.Cube); Object.Destroy(head.GetComponent<Collider>()); head.transform.SetParent(g.transform, false);
            head.transform.localScale = new Vector3(1.0f, 0.55f, 0.55f); head.transform.localPosition = Vector3.up * 0.3f; head.GetComponent<Renderer>().sharedMaterial = mat;
            var handle = GameObject.CreatePrimitive(PrimitiveType.Cylinder); Object.Destroy(handle.GetComponent<Collider>()); handle.transform.SetParent(g.transform, false);
            handle.transform.localScale = new Vector3(0.14f, 0.8f, 0.14f); handle.transform.localPosition = Vector3.up * 1.3f; handle.GetComponent<Renderer>().sharedMaterial = mat;
            var gp = g.transform.position + Vector3.up * size * 0.5f;
            StFx.Glow(gp, size * 1.3f, Fade(col, 0.45f * k), c.cam, c.root);
            if (u < 1) StFx.Trail(gp + Vector3.up * 3f, gp, size * 0.9f, Fade(c.pal.glow, 0.6f), c.cam, c.root);
        }

        static void Flames(VfxCtx c, VfxStep s, Vector3 p, float u, float k)
        {
            int n = Mathf.Max(2, (int)s.count); var floor = new Vector3(p.x, c.origin.y, p.z);
            if (s.angle >= 359)
            {
                for (int i = 0; i < n; i++)
                {
                    var pos = floor + Quaternion.Euler(0, Hash(s.seed, i) * 360, 0) * Vector3.forward * Mathf.Sqrt(Hash(s.seed + 1, i)) * s.size;
                    float fl = Mathf.Abs(Mathf.Sin(c.t * 9 + i * 2.1f)); Flame(c, pos, 1.0f, s.size2 * (0.5f + 0.6f * fl) * Mathf.Clamp01(u * 4) * k, c.pal.primary, c.pal.glow, k);
                }
                return;
            }
            if (u <= 0 || u >= 1) return;
            float R = s.size * EaseOut(u), hh = s.size2 * (1 - u * 0.55f);
            for (int row = 0; row < 2; row++)
            {
                float rr = row == 0 ? R : R * 0.62f, rh = row == 0 ? hh : hh * 0.6f; int m = row == 0 ? n : n - 2;
                for (int i = 0; i < m; i++)
                {
                    float a = Mathf.Lerp(-s.angle / 2 + 6, s.angle / 2 - 6, i / (float)(m - 1)) + (Hash(s.seed + row, i) - 0.5f) * 6;
                    var pos = floor + Quaternion.Euler(0, a, 0) * c.fwd * rr; float fl = 0.75f + 0.35f * Mathf.Sin(c.t * 30 + i * 1.3f + row);
                    Flame(c, pos, 1.0f + rr * 0.1f, rh * fl, c.pal.primary, c.pal.glow, k * (1 - u * 0.3f));
                }
            }
        }

        /// <summary>One flame tongue: a camera-facing teardrop (bright base, transparent licking tip) with a hot inner core.</summary>
        public static void Flame(VfxCtx c, Vector3 basePos, float w, float h, Color outer, Color core, float k)
        {
            if (h < 0.05f) return;
            Tongue(c, basePos, w, h, Fade(outer, 0.9f * k)); Tongue(c, basePos + Vector3.up * 0.02f, w * 0.5f, h * 0.55f, Fade(core, k));
        }

        static void Tongue(VfxCtx c, Vector3 b, float w, float h, Color col)
        {
            var side = Vector3.Cross(Vector3.up, c.cam.transform.forward); side.y = 0; side = side.sqrMagnitude < 1e-4f ? c.cam.transform.right : side.normalized;
            var tilt = c.cam.transform.forward; tilt.y = 0; tilt = -tilt.normalized * 0.6f; // lean slightly toward the camera so top-down still reads
            const int N = 6; var v = new List<Vector3>(); var cl = new List<Color>(); var tr = new List<int>();
            for (int i = 0; i <= N; i++)
            {
                float f = i / (float)N, wf = Mathf.Sin(Mathf.Lerp(0.25f, 1f, f) * Mathf.PI) * (1 - f * 0.55f);
                var y = (Vector3.up + tilt) * h * f;
                v.Add(b + y - side * w * 0.5f * wf); v.Add(b + y + side * w * 0.5f * wf);
                var cc = A(col, col.a * (1 - f * f)); cl.Add(A(cc, cc.a * 0.55f)); cl.Add(A(cc, cc.a * 0.55f));
            }
            // centre spine for a brighter middle
            int baseCount = v.Count;
            for (int i = 0; i <= N; i++) { float f = i / (float)N; v.Add(b + (Vector3.up + tilt) * h * f); cl.Add(A(col, col.a * (1 - f))); }
            for (int i = 0; i < N; i++)
            {
                int l0 = i * 2, r0 = i * 2 + 1, l1 = l0 + 2, r1 = r0 + 2, c0 = baseCount + i, c1 = c0 + 1;
                tr.AddRange(new[] { l0, l1, c0, c0, l1, c1, c0, c1, r0, r0, c1, r1 });
            }
            var m = new Mesh(); m.SetVertices(v); m.SetColors(cl); m.SetTriangles(tr, 0); m.RecalculateBounds();
            StFx.Obj("flame", m, true, c.root);
        }

        static Mesh crystal;
        /// <summary>Six-sided bipyramid crystal (ice spikes, rock shards, meteor core). Named so StFx.Clear keeps it.</summary>
        public static Mesh Crystal
        {
            get
            {
                if (crystal) return crystal;
                var v = new List<Vector3>(); var t = new List<int>();
                for (int i = 0; i < 6; i++) { float a = i * 60 * Mathf.Deg2Rad; v.Add(new Vector3(Mathf.Sin(a) * 0.5f, 0.25f, Mathf.Cos(a) * 0.5f)); }
                v.Add(new Vector3(0, 1.2f, 0)); v.Add(new Vector3(0, -0.15f, 0));
                for (int i = 0; i < 6; i++) { int j = (i + 1) % 6; t.AddRange(new[] { i, 6, j, j, 7, i }); }
                // flat-shade: split vertices
                var fv = new List<Vector3>(); var ft = new List<int>();
                for (int i = 0; i < t.Count; i++) { fv.Add(v[t[i]]); ft.Add(i); }
                crystal = new Mesh { name = "st_crystal" }; crystal.SetVertices(fv); crystal.SetTriangles(ft, 0); crystal.RecalculateNormals(); crystal.RecalculateBounds();
                var cols = new Color[fv.Count]; for (int i = 0; i < cols.Length; i++) cols[i] = Color.white; crystal.colors = cols;
                return crystal;
            }
        }
    }
}
