using System.Collections.Generic;
using UnityEngine;

namespace Hollowmere.StyleTest
{
    /// <summary>Procedural, asset-free VFX for the style test: slash arcs, glows, trails, sparks, rings and shaped ground
    /// telegraphs (circle, cone, line, ring) with a fill-progress layer. Everything is a plain mesh on StFx.</summary>
    public static class StFx
    {
        static Shader sh; static Shader Sh => sh ? sh : (sh = Resources.Load<Shader>("ST/StFx"));
        static readonly Dictionary<string, Material> mats = new Dictionary<string, Material>();
        public static Material Mat(bool add, bool onTop = false)
        {
            var k = add + "_" + onTop; if (mats.TryGetValue(k, out var m) && m) return m;
            m = new Material(Sh) { name = "fx_" + k }; m.SetFloat("_Src", add ? 1 : 5); m.SetFloat("_Dst", add ? 1 : 10); m.SetFloat("_ZT", onTop ? 8 : 4);
            m.renderQueue = onTop ? 3100 : 3000; mats[k] = m; return m;
        }

        public static GameObject Obj(string name, Mesh mesh, bool add, Transform parent, bool onTop = false)
        {
            var g = new GameObject(name); g.transform.SetParent(parent, false);
            g.AddComponent<MeshFilter>().sharedMesh = mesh; var r = g.AddComponent<MeshRenderer>(); r.sharedMaterial = Mat(add, onTop);
            r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off; r.receiveShadows = false; return g;
        }

        /// <summary>Annulus sector in XZ (y up), angles in degrees from +Z clockwise. alongFade(u) scales alpha along the arc.</summary>
        public static Mesh Sector(float r0, float r1, float a0, float a1, Color cIn, Color cOut, System.Func<float, float> alongFade = null, int seg = 40)
        {
            var v = new List<Vector3>(); var c = new List<Color>(); var t = new List<int>();
            for (int i = 0; i <= seg; i++)
            {
                float u = i / (float)seg, a = Mathf.Deg2Rad * Mathf.Lerp(a0, a1, u), f = alongFade == null ? 1 : alongFade(u);
                var d = new Vector3(Mathf.Sin(a), 0, Mathf.Cos(a));
                v.Add(d * r0); v.Add(d * r1);
                var ci = cIn; ci.a *= f; var co = cOut; co.a *= f; c.Add(ci); c.Add(co);
                if (i > 0) { int b = i * 2; t.AddRange(new[] { b - 2, b - 1, b, b - 1, b + 1, b }); }
            }
            var m = new Mesh(); m.SetVertices(v); m.SetColors(c); m.SetTriangles(t, 0); m.RecalculateBounds(); return m;
        }

        public static Mesh Rect(float x0, float x1, float z0, float z1, Color cNear, Color cFar)
        {
            var m = new Mesh();
            m.vertices = new[] { new Vector3(x0, 0, z0), new Vector3(x1, 0, z0), new Vector3(x0, 0, z1), new Vector3(x1, 0, z1) };
            m.colors = new[] { cNear, cNear, cFar, cFar }; m.triangles = new[] { 0, 2, 1, 1, 2, 3 }; m.RecalculateBounds(); return m;
        }

        static Color A(Color c, float a) { c.a = a; return c; }

        public enum Shape { Circle, Cone, Line, Ring }

        /// <summary>Enemy/skill telegraph on the floor: faint fill, brighter progress fill (0..1) and a crisp edge.</summary>
        public static GameObject Telegraph(Shape s, Vector3 pos, float yaw, float size, float fill, Color col, Transform parent, float width = 2f, float angle = 70f, float inner = 0.6f)
        {
            var root = new GameObject("tele_" + s); root.transform.SetParent(parent, false); root.transform.position = pos + Vector3.up * 0.06f; root.transform.rotation = Quaternion.Euler(0, yaw, 0);
            Color f0 = A(col, 0.18f), f1 = A(col, 0.42f), e = A(col, 0.95f); float ew = Mathf.Clamp(size * 0.04f, 0.08f, 0.2f);
            fill = Mathf.Clamp01(fill);
            switch (s)
            {
                case Shape.Circle:
                    Obj("fill", Sector(0, size, 0, 360, f0, f0), false, root.transform);
                    Obj("prog", Sector(0, size * fill, 0, 360, A(col, 0.15f), f1), false, root.transform);
                    Obj("edge", Sector(size - ew, size, 0, 360, e, e), true, root.transform); break;
                case Shape.Ring:
                    float ri = size * inner;
                    Obj("fill", Sector(ri, size, 0, 360, f0, f0), false, root.transform);
                    Obj("prog", Sector(ri, Mathf.Lerp(ri, size, fill), 0, 360, f1, f1), false, root.transform);
                    Obj("edge", Sector(size - ew, size, 0, 360, e, e), true, root.transform);
                    Obj("edgeI", Sector(ri, ri + ew, 0, 360, e, e), true, root.transform); break;
                case Shape.Cone:
                    Obj("fill", Sector(0, size, -angle / 2, angle / 2, f0, f0), false, root.transform);
                    Obj("prog", Sector(0, size * fill, -angle / 2, angle / 2, A(col, 0.15f), f1), false, root.transform);
                    Obj("edge", Sector(size - ew, size, -angle / 2, angle / 2, e, e), true, root.transform);
                    foreach (var sgn in new[] { -1f, 1f })
                    {
                        var side = Obj("side", Rect(-ew / 2, ew / 2, 0, size, A(col, 0.5f), e), true, root.transform);
                        side.transform.localRotation = Quaternion.Euler(0, sgn * angle / 2, 0);
                    }
                    break;
                case Shape.Line:
                    float w = width / 2;
                    Obj("fill", Rect(-w, w, 0, size, f0, f0), false, root.transform);
                    Obj("prog", Rect(-w, w, 0, size * fill, f1, f1), false, root.transform);
                    Obj("edgeL", Rect(-w, -w + ew, 0, size, e, e), true, root.transform);
                    Obj("edgeR", Rect(w - ew, w, 0, size, e, e), true, root.transform);
                    Obj("edgeF", Rect(-w, w, size - ew, size, e, e), true, root.transform);
                    // chevrons pointing the way
                    for (int i = 1; i <= 3; i++)
                    {
                        float z = size * (0.2f + 0.22f * i);
                        foreach (var sgn in new[] { -1f, 1f })
                        {
                            var ch = Obj("chev", Rect(-ew, ew, 0, w * 0.9f, A(col, 0.55f), A(col, 0.55f)), true, root.transform);
                            ch.transform.localPosition = new Vector3(0, 0, z); ch.transform.localRotation = Quaternion.Euler(0, 180 + sgn * 50, 0);
                        }
                    }
                    break;
            }
            return root;
        }

        /// <summary>Weapon swing arc: a thick crescent in a tilted plane, bright at the leading edge, fading at the tail.</summary>
        public static GameObject Slash(Vector3 centre, Quaternion plane, float radius, float fromDeg, float toDeg, Color col, Transform parent, float thick = 0.45f)
        {
            if (Mathf.Abs(toDeg - fromDeg) < 1) return null;
            var g = Obj("slash", Sector(radius - thick, radius, fromDeg, toDeg, A(col * 0.6f, 0.0f), A(col, 1f), u => Mathf.Pow(u, 1.6f)), true, parent);
            g.transform.position = centre; g.transform.rotation = plane;
            var core = Obj("slash_core", Sector(radius - thick * 0.25f, radius, fromDeg, toDeg, A(Color.white, 0), A(Color.white, 0.9f), u => Mathf.Pow(u, 3f)), true, g.transform);
            return g;
        }

        /// <summary>Camera-facing soft glow disc (centre bright, edge transparent).</summary>
        public static GameObject Glow(Vector3 pos, float r, Color col, Camera cam, Transform parent)
        {
            var g = Obj("glow", Sector(0, r, 0, 360, A(col, 1f), A(col, 0f)), true, parent, false);
            g.transform.position = pos; g.transform.rotation = Quaternion.LookRotation(Vector3.up, Vector3.forward);
            g.transform.rotation = Quaternion.LookRotation(cam.transform.up, -cam.transform.forward) ; // disc XZ -> face camera
            g.transform.rotation = cam.transform.rotation * Quaternion.Euler(-90, 0, 0);
            return g;
        }

        /// <summary>Camera-facing ribbon from tail to head, transparent at the tail.</summary>
        public static GameObject Trail(Vector3 tail, Vector3 head, float w, Color col, Camera cam, Transform parent)
        {
            var dir = head - tail; if (dir.sqrMagnitude < 1e-4f) return null;
            var side = Vector3.Cross(dir.normalized, cam.transform.forward).normalized * (w / 2);
            var m = new Mesh();
            m.vertices = new[] { tail - side * 0.3f, tail + side * 0.3f, head - side, head + side };
            m.colors = new[] { A(col, 0), A(col, 0), A(col, 1), A(col, 1) }; m.triangles = new[] { 0, 2, 1, 1, 2, 3 }; m.RecalculateBounds();
            return Obj("trail", m, true, parent);
        }

        /// <summary>Radial spark burst at progress t (0..1): streaks fly out and fade.</summary>
        public static void Sparks(Vector3 pos, float t, float r, Color col, Camera cam, Transform parent, int n = 14, int seed = 3)
        {
            if (t <= 0 || t >= 1) return; var rnd = new System.Random(seed);
            for (int i = 0; i < n; i++)
            {
                var d = Quaternion.Euler((float)rnd.NextDouble() * -70 - 10, (float)rnd.NextDouble() * 360, 0) * Vector3.forward;
                float sp = 0.6f + (float)rnd.NextDouble() * 0.6f;
                var head = pos + d * r * sp * Mathf.Sqrt(t); var tail = pos + d * r * sp * Mathf.Max(0, Mathf.Sqrt(t) - 0.25f);
                Trail(tail, head, 0.12f * (1 - t) + 0.03f, A(col, 1 - t), cam, parent);
            }
        }

        /// <summary>Expanding shock ring on the floor at progress t.</summary>
        public static void Shock(Vector3 pos, float t, float r, Color col, Transform parent)
        {
            if (t <= 0 || t >= 1) return; float rr = Mathf.Lerp(0.3f, r, Mathf.Sqrt(t)), w = Mathf.Lerp(0.6f, 0.1f, t);
            var g = Obj("shock", Sector(Mathf.Max(0, rr - w), rr, 0, 360, A(col, 0), A(col, 1 - t)), true, parent);
            g.transform.position = pos + Vector3.up * 0.08f;
        }

        public static void Clear(Transform root) { for (int i = root.childCount - 1; i >= 0; i--) Object.DestroyImmediate(root.GetChild(i).gameObject); }
    }
}
