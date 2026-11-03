using System.Collections.Generic;
using UnityEngine;

namespace Hollowmere.StyleTest.Skills
{
    /// <summary>Auto lock-on (no drag-to-aim): the nearest living foe in range whose chest the hero can see from its chest.
    /// Sight is a Physics.Linecast against occluder colliders on <see cref="Layer"/>; walls and big props get box colliders
    /// from their renderer bounds (<see cref="BuildOccluders"/>). Doorways/arches stay open, floors and small clutter never block.</summary>
    public static class StTargeting
    {
        /// <summary>Unnamed user layer used for line-of-sight occluders (index only; no TagManager entry needed).</summary>
        public const int Layer = 28;
        public static int Mask => 1 << Layer;
        public const float MinOccluderHeight = 1.1f; // metres: below this a prop doesn't hide a standing enemy's chest

        static readonly HashSet<int> done = new HashSet<int>();

        /// <summary>Adds world-aligned box colliders (on <see cref="Layer"/>) for every tall, non-floor renderer under the roots.
        /// Idempotent per root. Kit meshes aren't CPU-readable, so boxes come from renderer bounds.</summary>
        public static int BuildOccluders(IEnumerable<Transform> roots)
        {
            int n = 0;
            foreach (var root in roots)
            {
                if (root == null || !done.Add(root.GetInstanceID())) continue;
                if (root.GetComponentInParent<StActor>() != null) continue;
                foreach (var r in root.GetComponentsInChildren<MeshRenderer>())
                {
                    var nm = r.gameObject.name.ToLowerInvariant() + "|" + root.name.ToLowerInvariant();
                    if (nm.Contains("door") || nm.Contains("arch") || nm.Contains("floor") || nm.Contains("tile") || nm.Contains("grate") || nm.Contains("stairs")
                        || nm.Contains("torch") || nm.Contains("candle") || nm.Contains("banner") || nm.Contains("rug") || nm.Contains("coin")) continue;
                    var b = r.bounds;
                    if (b.size.y < MinOccluderHeight || b.max.y < MinOccluderHeight) continue;
                    if (b.size.x > 14f || b.size.z > 14f) continue; // merged/backdrop meshes: not a sight blocker
                    var mf = r.GetComponent<MeshFilter>();
                    if (mf != null && mf.sharedMesh != null) AddOriented(r.transform, mf.sharedMesh.bounds); else AddBox(r.transform, b);
                    n++;
                }
            }
            if (n > 0) { Physics.SyncTransforms(); Debug.Log("[ST] occluders +" + n); }
            return n;
        }

        public static GameObject AddBox(Transform owner, Bounds b)
        {
            var g = new GameObject("los_occluder"); g.layer = Layer;
            g.transform.SetParent(owner, true); g.transform.position = b.center; g.transform.rotation = Quaternion.identity;
            var ls = owner.lossyScale; g.transform.localScale = new Vector3(1f / Mathf.Max(1e-4f, ls.x), 1f / Mathf.Max(1e-4f, ls.y), 1f / Mathf.Max(1e-4f, ls.z));
            g.transform.rotation = Quaternion.identity;
            var c = g.AddComponent<BoxCollider>(); c.size = b.size; // world-aligned (rotation reset, scale cancelled)
            return g;
        }

        /// <summary>Box collider in the renderer's own (rotated, scaled) space from the mesh's local bounds, so a diagonal wall
        /// gets a thin oriented box instead of a fat world-aligned one. Mesh.bounds is available on non-readable meshes.</summary>
        public static GameObject AddOriented(Transform owner, Bounds local)
        {
            var g = new GameObject("los_occluder"); g.layer = Layer; g.transform.SetParent(owner, false);
            var c = g.AddComponent<BoxCollider>(); c.center = local.center; c.size = local.size; return g;
        }

        /// <summary>Chest point (60 % of the actor's standing height; 1.8 m hero -> 1.1 m).</summary>
        public static Vector3 Chest(StActor a)
        {
            if (a == null) return Vector3.zero;
            float h = a.sockets != null ? StActor.BindHeight : 1.8f;
            var mon = a.GetComponent<StChestCache>() ?? a.gameObject.AddComponent<StChestCache>();
            if (mon.h <= 0) { var wb = a.WorldBounds(); mon.h = Mathf.Clamp(wb.size.y, 0.4f, 6f); }
            return a.transform.position + Vector3.up * mon.h * 0.6f;
        }

        public static bool Visible(StActor from, StActor to, out RaycastHit hit)
        {
            if (!StFlags.On("losTargeting")) { hit = default; return true; } // flag off: plain nearest-in-range
            var a = Chest(from); var b = Chest(to);
            return !Physics.Linecast(a, b, out hit, Mask, QueryTriggerInteraction.Ignore);
        }

        /// <summary>Nearest living foe within range that is in line of sight. Occluded foes are skipped (even if nearer).</summary>
        public static StActor Pick(StActor hero, IEnumerable<StActor> foes, float range, List<(StActor foe, bool visible, Vector3 hitPoint)> debug = null)
        {
            if (hero == null || foes == null) return null;
            var list = new List<StActor>();
            foreach (var f in foes) if (f != null && !f.dead && Flat(f.transform.position - hero.transform.position) <= range) list.Add(f);
            list.Sort((x, y) => Flat(x.transform.position - hero.transform.position).CompareTo(Flat(y.transform.position - hero.transform.position)));
            StActor best = null;
            foreach (var f in list)
            {
                bool vis = Visible(hero, f, out var hit);
                debug?.Add((f, vis, vis ? Chest(f) : hit.point));
                if (vis && best == null) { best = f; if (debug == null) break; }
            }
            return best;
        }

        static float Flat(Vector3 v) { v.y = 0; return v.magnitude; }
    }

    /// <summary>Cached standing height for chest-height sight lines (measured once; bounds lag poses by a frame).</summary>
    public class StChestCache : MonoBehaviour { public float h; }

    /// <summary>Lock-on marker: a palette-coloured ground ring that slowly turns plus a bobbing chevron over the target's head.</summary>
    public class StTargetMarker : MonoBehaviour
    {
        public StActor target; public Color color = new Color(1.6f, 1.35f, 0.7f);
        Transform ring, chev; MeshRenderer ringR, chevR; float topH;

        public static StTargetMarker Create(Color c)
        {
            var g = new GameObject("st_target_marker"); var m = g.AddComponent<StTargetMarker>(); m.color = c; m.Build(); return m;
        }

        void Build()
        {
            var lit = Palette.Ldr(color);
            ring = StFx.Obj("ring", RingMesh(0.62f, 0.78f, lit), true, transform).transform;
            // inner faint fill + four tick marks so it reads as a lock-on, not a telegraph
            StFx.Obj("fill", StFx.Sector(0f, 0.62f, 0, 360, new Color(lit.r, lit.g, lit.b, 0.10f), new Color(lit.r, lit.g, lit.b, 0.25f)), true, ring);
            for (int i = 0; i < 4; i++) StFx.Obj("tick", StFx.Sector(0.8f, 1.0f, i * 90 - 9, i * 90 + 9, new Color(lit.r, lit.g, lit.b, 0.95f), new Color(lit.r, lit.g, lit.b, 0.55f), null, 6), true, ring);
            chev = StFx.Obj("chevron", ChevronMesh(lit), false, transform).transform;
            ringR = ring.GetComponent<MeshRenderer>(); chevR = chev.GetComponent<MeshRenderer>();
            gameObject.SetActive(false);
        }

        public void Set(StActor t)
        {
            if (t != target) { target = t; topH = 0; }
            gameObject.SetActive(t != null && !t.dead);
        }

        void LateUpdate()
        {
            if (target == null || target.dead) { gameObject.SetActive(false); return; }
            if (topH <= 0) { var wb = target.WorldBounds(); topH = Mathf.Max(0.5f, wb.max.y - target.transform.position.y); }
            var p = target.transform.position; float rad = Mathf.Clamp(topH * 0.42f, 0.55f, 2.2f);
            ring.position = p + Vector3.up * 0.04f; ring.localScale = Vector3.one * rad; ring.rotation = Quaternion.Euler(0, Time.realtimeSinceStartup * 40f, 0);
            float bob = Mathf.Sin(Time.realtimeSinceStartup * 5f) * 0.06f;
            chev.position = p + Vector3.up * (topH + 0.35f + bob);
            var cam = Camera.main; if (cam) { var d = cam.transform.position - chev.position; d.y = 0; if (d.sqrMagnitude > 1e-4f) chev.rotation = Quaternion.LookRotation(-d); }
            chev.localScale = Vector3.one * Mathf.Clamp(topH * 0.16f, 0.22f, 0.6f);
        }

        /// <summary>Pose for stills (shots run with timeScale 0).</summary>
        public void Snap(Camera cam) { LateUpdate(); if (cam && chev) { var d = cam.transform.position - chev.position; d.y = 0; chev.rotation = Quaternion.LookRotation(-d); } }

        static Mesh RingMesh(float r0, float r1, Color c)
        {
            return StFx.Sector(r0, r1, 0, 360, new Color(c.r, c.g, c.b, 0.95f), new Color(c.r, c.g, c.b, 0.95f), null, 48);
        }

        static Mesh ChevronMesh(Color c)
        {
            // a thick downward V (two slabs), opaque-ish additive so it reads on any floor
            var v = new List<Vector3>(); var t = new List<int>(); var col = new List<Color>();
            void Slab(Vector3 a, Vector3 b, float w, float d)
            {
                var dir = (b - a).normalized; var n = Vector3.Cross(dir, Vector3.forward).normalized * w * 0.5f; var z = Vector3.forward * d * 0.5f;
                var p = new[] { a - n - z, a + n - z, b + n - z, b - n - z, a - n + z, a + n + z, b + n + z, b - n + z };
                int o = v.Count; v.AddRange(p); for (int i = 0; i < 8; i++) col.Add(new Color(c.r, c.g, c.b, 1));
                int[] f = { 0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 1, 5, 6, 1, 6, 2, 2, 6, 7, 2, 7, 3, 3, 7, 4, 3, 4, 0 };
                foreach (var i in f) t.Add(o + i);
            }
            Slab(new Vector3(-0.55f, 0.55f, 0), new Vector3(0, 0, 0), 0.26f, 0.16f);
            Slab(new Vector3(0.55f, 0.55f, 0), new Vector3(0, 0, 0), 0.26f, 0.16f);
            var m = new Mesh(); m.SetVertices(v); m.SetColors(col); m.SetTriangles(t, 0); m.RecalculateNormals(); return m;
        }
    }
}
