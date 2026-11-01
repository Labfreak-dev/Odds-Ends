using System.Collections.Generic;
using Hollowmere.Core;
using UnityEngine;

namespace Hollowmere
{
    /// <summary>
    /// Armour for the v5 hero is a shell of the body itself: the same bone weights and
    /// bind poses, pushed out along the normal. Underneath, those triangles are hidden
    /// so the shell does not z-fight or leave a hole. A Meshy mesh in
    /// Resources/Gear/Meshy/&lt;slot&gt; is rebound onto this skeleton and kept only
    /// when the rest-pose fit check accepts it.
    /// </summary>
    public static class GearShell
    {
        const string CacheName = "gear_source";

        /// <summary>Debug only. The shipped equip path is GearWardrobe, which toggles whole regions.</summary>
        public static bool DebugShells;

        public static void Fit(Transform body, Hero hero)
        {
            if (!DebugShells) return;
            if (body == null || hero == null) return;
            var skin = BodySkin(body);
            if (skin == null || skin.sharedMesh == null)
            {
                Debug.LogError("Hollowmere gear FAIL no skinned body");
                return;
            }
            var source = Original(skin);
            if (source == null || !source.isReadable || source.boneWeights == null || source.boneWeights.Length != source.vertexCount)
            {
                Debug.LogError("Hollowmere gear FAIL body mesh is not readable");
                return;
            }
            var worn = new List<EquipSlot>();
            for (int i = 0; i < GearFit.Visible.Length; i++)
            {
                var slot = GearFit.Visible[i];
                if (!Item.IsNone(hero.Equipped(slot))) worn.Add(slot);
            }
            var hide = new bool[source.vertexCount];
            int hidden = 0;
            var built = new List<ShellPiece>();
            for (int s = 0; s < worn.Count; s++)
            {
                var mesh = Build(source, skin.bones, worn[s], GearFit.ShellOffset, out var region);
                var meshy = TryMeshy(body, skin, source, worn[s]);
                if (meshy != null)
                {
                    Object.Destroy(mesh);
                    mesh = meshy;
                }
                if (mesh == null)
                {
                    Debug.LogError("Hollowmere gear FAIL " + GearFit.SlotName(worn[s]) + " has no fitted mesh");
                    continue;
                }
                built.Add(new ShellPiece { slot = worn[s], mesh = mesh, region = region });
                for (int v = 0; v < region.Length; v++)
                    if (region[v]) { hide[v] = true; hidden++; }
            }
            // Plate and the leather under it are two shells on the same skin. Keep the outer one.
            ResolveOverlap(source, skin.bones, built);
            // Anything the surviving shell sits on is removed, including the other slot's faces.
            CoverUnder(source.vertices, built, hide);
            var keep = skin.GetComponent<GearBodySource>();
            if (keep != null) keep.covered = hide;
            for (int s = 0; s < built.Count; s++)
            {
                var mesh = built[s].mesh;
                if (mesh == null) continue;
                if (mesh.triangles == null || mesh.triangles.Length < GearFit.MinShellVerts)
                {
                    Object.Destroy(mesh);
                    continue;
                }
                Attach(body, skin, mesh, built[s].slot);
            }
            skin.sharedMesh = hidden > 0 ? Hide(source, hide) : source;
        }

        sealed class ShellPiece
        {
            public EquipSlot slot;
            public Mesh mesh;
            public bool[] region;
        }

        static Mesh TryMeshy(Transform body, SkinnedMeshRenderer heroSkin, Mesh heroMesh, EquipSlot slot)
        {
            string name = GearFit.SlotName(slot);
            var prefab = Resources.Load<GameObject>("Gear/Meshy/" + name);
            if (prefab == null) return null;
            var inst = Object.Instantiate(prefab);
            var src = inst.GetComponentInChildren<SkinnedMeshRenderer>(true);
            Mesh fitted = null;
            if (src != null && src.sharedMesh != null && src.sharedMesh.isReadable)
                fitted = Rebind(src.sharedMesh, src.bones, heroSkin.bones, heroMesh);
            Object.Destroy(inst);
            if (fitted == null)
            {
                Debug.LogError("Hollowmere gear FAIL meshy " + name + " did not rebind");
                return null;
            }
            if (!RestOk(fitted, heroSkin, heroMesh, slot))
            {
                Debug.LogError("Hollowmere gear FAIL meshy " + name + " does not fit the hero");
                Object.Destroy(fitted);
                return null;
            }
            return fitted;
        }

        /// <summary>Move a foreign skin onto the hero bones, keeping each vertex's offset in bone space.</summary>
        public static Mesh Rebind(Mesh src, Transform[] srcBones, Transform[] heroBones, Mesh heroMesh)
        {
            if (src == null || heroMesh == null || srcBones == null || heroBones == null) return null;
            if (!src.isReadable || src.boneWeights == null || src.bindposes == null) return null;
            if (heroMesh.bindposes == null) return null;
            var map = new int[srcBones.Length];
            int matched = 0;
            for (int i = 0; i < srcBones.Length; i++)
            {
                map[i] = -1;
                if (srcBones[i] == null) continue;
                string tail = GearFit.Tail(srcBones[i].name);
                for (int h = 0; h < heroBones.Length; h++)
                {
                    if (heroBones[h] == null) continue;
                    if (!string.Equals(GearFit.Tail(heroBones[h].name), tail, System.StringComparison.OrdinalIgnoreCase)) continue;
                    map[i] = h;
                    matched++;
                    break;
                }
            }
            if (matched < 4) return null;
            var verts = src.vertices;
            var weights = src.boneWeights;
            var bind = src.bindposes;
            var heroBind = heroMesh.bindposes;
            var nv = new Vector3[verts.Length];
            var nw = new BoneWeight[verts.Length];
            for (int v = 0; v < verts.Length; v++)
            {
                var w = weights[v];
                Vector3 acc = Vector3.zero;
                float sum = 0f;
                Accumulate(w.boneIndex0, w.weight0, verts[v], bind, map, heroBind, ref acc, ref sum);
                Accumulate(w.boneIndex1, w.weight1, verts[v], bind, map, heroBind, ref acc, ref sum);
                Accumulate(w.boneIndex2, w.weight2, verts[v], bind, map, heroBind, ref acc, ref sum);
                Accumulate(w.boneIndex3, w.weight3, verts[v], bind, map, heroBind, ref acc, ref sum);
                nv[v] = sum > 0.001f ? acc / sum : verts[v];
                nw[v] = new BoneWeight
                {
                    boneIndex0 = Remap(w.boneIndex0, map), weight0 = w.weight0,
                    boneIndex1 = Remap(w.boneIndex1, map), weight1 = w.weight1,
                    boneIndex2 = Remap(w.boneIndex2, map), weight2 = w.weight2,
                    boneIndex3 = Remap(w.boneIndex3, map), weight3 = w.weight3,
                };
            }
            var mesh = new Mesh { name = "meshy_rebind" };
            mesh.vertices = nv;
            mesh.normals = src.normals;
            mesh.uv = src.uv;
            mesh.boneWeights = nw;
            mesh.bindposes = heroBind;
            mesh.triangles = src.triangles;
            mesh.RecalculateBounds();
            if (mesh.normals == null || mesh.normals.Length != nv.Length) mesh.RecalculateNormals();
            return mesh;
        }

        static void Accumulate(int bone, float weight, Vector3 v, Matrix4x4[] bind, int[] map, Matrix4x4[] heroBind, ref Vector3 acc, ref float sum)
        {
            if (weight <= 0f || bone < 0 || bone >= map.Length) return;
            int hero = map[bone];
            if (hero < 0 || hero >= heroBind.Length || bone >= bind.Length) return;
            Vector3 local = bind[bone].MultiplyPoint3x4(v);
            acc += heroBind[hero].inverse.MultiplyPoint3x4(local) * weight;
            sum += weight;
        }

        static int Remap(int bone, int[] map)
        {
            if (bone < 0 || bone >= map.Length || map[bone] < 0) return 0;
            return map[bone];
        }

        static bool RestOk(Mesh mesh, SkinnedMeshRenderer hero, Mesh heroMesh, EquipSlot slot)
        {
            var weights = mesh.boneWeights;
            if (weights == null || weights.Length < GearFit.MinShellVerts) return false;
            int bad = 0;
            int seen = 0;
            int step = Mathf.Max(1, weights.Length / 80);
            var bind = mesh.bindposes;
            var bones = hero.bones;
            for (int i = 0; i < weights.Length; i += step)
            {
                float sum = weights[i].weight0 + weights[i].weight1 + weights[i].weight2 + weights[i].weight3;
                if (!GearFit.WeightsOk(sum)) bad++;
                seen++;
                int d = Dominant(weights[i]);
                if (bind == null || d < 0 || d >= bind.Length) { bad++; continue; }
                Vector3 origin = bind[d].inverse.MultiplyPoint3x4(Vector3.zero);
                float rest = Vector3.Distance(mesh.vertices[i], origin);
                if (rest > 2.5f) bad++;
            }
            return seen > 0 && bad * 5 < seen;
        }

        static Mesh Build(Mesh source, Transform[] bones, EquipSlot slot, float offset, out bool[] region)
        {
            region = new bool[source.vertexCount];
            var weights = source.boneWeights;
            var verts = source.vertices;
            var normals = source.normals;
            int n = 0;
            for (int i = 0; i < verts.Length; i++)
            {
                int d = Dominant(weights[i]);
                if (d < 0 || bones == null || d >= bones.Length || bones[d] == null) continue;
                var part = GearFit.SlotForBone(bones[d].name);
                if (part == slot) { region[i] = true; n++; }
            }
            if (n < GearFit.MinShellVerts) return null;
            // Keep the outer surface. Inward faces (eyes, mouth, armpit) fold the shell into a blob.
            Vector3 center = Vector3.zero;
            for (int i = 0; i < verts.Length; i++)
                if (region[i]) center += verts[i];
            center /= n;
            var outer = new bool[region.Length];
            int nOuter = 0;
            for (int i = 0; i < verts.Length; i++)
            {
                if (!region[i]) continue;
                Vector3 nrm = normals != null && normals.Length == verts.Length ? normals[i] : Vector3.up;
                Vector3 dir = verts[i] - center;
                if (dir.sqrMagnitude < 1e-8f || Vector3.Dot(nrm, dir.normalized) > 0.2f)
                {
                    outer[i] = true;
                    nOuter++;
                }
            }
            if (nOuter >= GearFit.MinShellVerts)
            {
                region = outer;
                n = nOuter;
            }
            var map = new int[verts.Length];
            var nv = new Vector3[n];
            var nn = new Vector3[n];
            var nw = new BoneWeight[n];
            // The body UVs are a face atlas. Tiling metal across them draws the island borders as white seams.
            var nuv = new Vector2[n];
            int w = 0;
            for (int i = 0; i < verts.Length; i++)
            {
                if (!region[i]) continue;
                map[i] = w;
                Vector3 normal = normals != null && normals.Length == verts.Length ? normals[i] : Vector3.up;
                if (normal.sqrMagnitude < 1e-8f) normal = Vector3.up;
                normal.Normalize();
                nv[w] = verts[i] + normal * offset;
                nn[w] = normal;
                nw[w] = weights[i];
                nuv[w] = new Vector2(verts[i].x + verts[i].z * 0.37f, verts[i].y);
                w++;
            }
            var tris = source.triangles;
            var keep = new List<int>(n);
            for (int i = 0; i + 2 < tris.Length; i += 3)
            {
                if (!region[tris[i]] || !region[tris[i + 1]] || !region[tris[i + 2]]) continue;
                keep.Add(map[tris[i]]);
                keep.Add(map[tris[i + 1]]);
                keep.Add(map[tris[i + 2]]);
            }
            if (keep.Count < GearFit.MinShellVerts) return null;
            var mesh = new Mesh { name = "gear_" + GearFit.SlotName(slot) };
            mesh.vertices = nv;
            mesh.normals = nn;
            mesh.boneWeights = nw;
            mesh.bindposes = source.bindposes;
            if (nuv != null) mesh.uv = nuv;
            mesh.triangles = keep.ToArray();
            mesh.RecalculateTangents();
            mesh.RecalculateBounds();
            return mesh;
        }

        /// <summary>Body vertices the shell covers. The audit treats these as not visible skin.</summary>
        static void CoverUnder(Vector3[] body, List<ShellPiece> shells, bool[] hide)
        {
            if (body == null || shells == null || hide == null) return;
            var pts = new List<Vector3>();
            for (int s = 0; s < shells.Count; s++)
            {
                var mesh = shells[s].mesh;
                if (mesh == null) continue;
                var v = mesh.vertices;
                var tris = mesh.triangles;
                if (v == null || tris == null || tris.Length < 3) continue;
                var used = new bool[v.Length];
                for (int i = 0; i < tris.Length; i++)
                    if (tris[i] >= 0 && tris[i] < used.Length) used[tris[i]] = true;
                for (int i = 0; i < v.Length; i++)
                    if (used[i]) pts.Add(v[i]);
            }
            if (pts.Count == 0) return;
            var index = new BodyIndex(pts.ToArray());
            // The shell is 12 mm out. Hide the skin under it and the band it would otherwise clip.
            const float Cover = 0.02f;
            for (int i = 0; i < body.Length && i < hide.Length; i++)
            {
                index.Nearest(body[i], out float d);
                if (d <= Cover) hide[i] = true;
            }
        }

        /// <summary>Where two shells sit on the same skin, drop the inner one so one surface remains.</summary>
        static void ResolveOverlap(Mesh source, Transform[] bones, List<ShellPiece> shells)
        {
            if (shells == null || shells.Count < 2) return;
            var body = source.vertices;
            var weights = source.boneWeights;
            var owner = new EquipSlot?[body.Length];
            for (int i = 0; i < body.Length; i++)
            {
                int d = Dominant(weights[i]);
                if (bones == null || d < 0 || d >= bones.Length || bones[d] == null) continue;
                owner[i] = GearFit.SlotForBone(bones[d].name);
            }
            var index = new BodyIndex(body);
            var pos = new Vector3[shells.Count][];
            var gap = new float[shells.Count][];
            var buckets = new List<int>[4096];
            for (int s = 0; s < shells.Count; s++)
            {
                pos[s] = shells[s].mesh.vertices;
                gap[s] = new float[pos[s].Length];
                for (int v = 0; v < pos[s].Length; v++)
                {
                    int bi = index.Nearest(pos[s][v], out float d);
                    gap[s][v] = d;
                    int key = Hash(pos[s][v]);
                    if (buckets[key] == null) buckets[key] = new List<int>(4);
                    buckets[key].Add((s << 16) | v);
                }
            }
            var lose = new bool[shells.Count][];
            for (int s = 0; s < shells.Count; s++) lose[s] = new bool[pos[s].Length];
            for (int s = 0; s < shells.Count; s++)
            {
                for (int v = 0; v < pos[s].Length; v++)
                {
                    int cx = Mathf.FloorToInt(pos[s][v].x / 0.08f);
                    int cy = Mathf.FloorToInt(pos[s][v].y / 0.08f);
                    int cz = Mathf.FloorToInt(pos[s][v].z / 0.08f);
                    for (int z = -1; z <= 1 && !lose[s][v]; z++)
                        for (int y = -1; y <= 1 && !lose[s][v]; y++)
                            for (int x = -1; x <= 1 && !lose[s][v]; x++)
                            {
                                var list = buckets[Hash(cx + x, cy + y, cz + z)];
                                if (list == null) continue;
                                for (int n = 0; n < list.Count; n++)
                                {
                                    int os = list[n] >> 16;
                                    int ov = list[n] & 0xffff;
                                    if (os == s) continue;
                                    if (ov < 0 || ov >= pos[os].Length) continue;
                                    // Same skin, two surfaces. 12 mm still reads as one z-fighting patch.
                                    if (Vector3.Distance(pos[s][v], pos[os][ov]) > 0.012f) continue;
                                    bool inner = gap[s][v] < gap[os][ov] - 0.0005f;
                                    bool tie = Mathf.Abs(gap[s][v] - gap[os][ov]) <= 0.0005f;
                                    int mid = index.Nearest((pos[s][v] + pos[os][ov]) * 0.5f, out _);
                                    var slot = mid >= 0 && mid < owner.Length ? owner[mid] : null;
                                    if (inner || (tie && slot != null && slot != shells[s].slot))
                                    {
                                        lose[s][v] = true;
                                        break;
                                    }
                                }
                            }
                }
            }
            for (int s = 0; s < shells.Count; s++)
            {
                var tris = shells[s].mesh.triangles;
                var keep = new List<int>(tris.Length);
                for (int i = 0; i + 2 < tris.Length; i += 3)
                {
                    if (lose[s][tris[i]] || lose[s][tris[i + 1]] || lose[s][tris[i + 2]]) continue;
                    keep.Add(tris[i]);
                    keep.Add(tris[i + 1]);
                    keep.Add(tris[i + 2]);
                }
                shells[s].mesh.triangles = keep.ToArray();
                shells[s].mesh.RecalculateBounds();
            }
        }

        sealed class BodyIndex
        {
            readonly Vector3[] pts;
            readonly List<int>[] cells;
            const float Cell = 0.08f;
            const int Buckets = 4096;

            public BodyIndex(Vector3[] points)
            {
                pts = points;
                cells = new List<int>[Buckets];
                for (int i = 0; i < pts.Length; i++)
                {
                    int k = Hash(pts[i]);
                    if (cells[k] == null) cells[k] = new List<int>(4);
                    cells[k].Add(i);
                }
            }

            public int Nearest(Vector3 p, out float dist)
            {
                dist = 1f;
                int best = -1;
                int cx = Mathf.FloorToInt(p.x / Cell);
                int cy = Mathf.FloorToInt(p.y / Cell);
                int cz = Mathf.FloorToInt(p.z / Cell);
                for (int z = -1; z <= 1; z++)
                    for (int y = -1; y <= 1; y++)
                        for (int x = -1; x <= 1; x++)
                        {
                            var list = cells[Hash(cx + x, cy + y, cz + z)];
                            if (list == null) continue;
                            for (int i = 0; i < list.Count; i++)
                            {
                                float d = Vector3.Distance(p, pts[list[i]]);
                                if (d < dist) { dist = d; best = list[i]; }
                            }
                        }
                return best;
            }
        }

        static int Hash(Vector3 p) => Hash(Mathf.FloorToInt(p.x / 0.08f), Mathf.FloorToInt(p.y / 0.08f), Mathf.FloorToInt(p.z / 0.08f));

        static int Hash(int x, int y, int z)
        {
            unchecked
            {
                int h = x * 73856093 ^ y * 19349663 ^ z * 83492791;
                return (h & 0x7fffffff) % 4096;
            }
        }

        static Mesh Hide(Mesh source, bool[] hide)
        {
            var tris = source.triangles;
            var keep = new List<int>(tris.Length);
            for (int i = 0; i + 2 < tris.Length; i += 3)
            {
                int a = tris[i], b = tris[i + 1], c = tris[i + 2];
                int n = (hide[a] ? 1 : 0) + (hide[b] ? 1 : 0) + (hide[c] ? 1 : 0);
                // Any covered vertex: the shell is the only surface. A one-vertex lip z-fights.
                if (n >= 1) continue;
                keep.Add(a);
                keep.Add(b);
                keep.Add(c);
            }
            var mesh = Object.Instantiate(source);
            mesh.name = "body_fit";
            mesh.triangles = keep.ToArray();
            mesh.RecalculateBounds();
            return mesh;
        }

        static void Attach(Transform body, SkinnedMeshRenderer hero, Mesh mesh, EquipSlot slot)
        {
            var hips = Art.Bone(body, "Hips");
            var go = new GameObject("gear_" + GearFit.SlotName(slot));
            // Same transform as the body skin, so the copied bind pose stays in one space.
            go.transform.SetParent(hero.transform, false);
            go.transform.localPosition = Vector3.zero;
            go.transform.localRotation = Quaternion.identity;
            go.transform.localScale = Vector3.one;
            var smr = go.AddComponent<SkinnedMeshRenderer>();
            smr.sharedMesh = mesh;
            smr.bones = hero.bones;
            smr.rootBone = hips != null ? hips : hero.rootBone;
            smr.updateWhenOffscreen = true;
            smr.sharedMaterial = ShellMat(slot);
            Art.AdoptShaders(go);
        }

        /// <summary>Metal for the harness, darkened iron for leather. Both carry a normal and a roughness map.</summary>
        static Material ShellMat(EquipSlot slot)
        {
            bool leather = slot == EquipSlot.Waist || slot == EquipSlot.Legs || slot == EquipSlot.Feet;
            bool helm = slot == EquipSlot.Head;
            string surf = leather ? "rusted_iron" : "iron_plates";
            // A near-white helm with a sharp smoothness throws a white rim along the cut.
            var tint = leather ? new Color(0.78f, 0.62f, 0.46f) : helm ? new Color(0.58f, 0.60f, 0.64f) : new Color(0.74f, 0.76f, 0.80f);
            float metal = leather ? 0.12f : helm ? 0.42f : 0.62f;
            float smooth = leather ? 0.34f : helm ? 0.28f : 0.42f;
            return PbrKit.UrpLit(surf, leather ? 0.4f : 0.22f, tint, metal, smooth, helm ? 0.4f : 0.65f);
        }

        static Color SlotTint(EquipSlot slot)
        {
            switch (slot)
            {
                case EquipSlot.Head: return new Color(0.62f, 0.66f, 0.72f);
                case EquipSlot.Shoulders: return new Color(0.55f, 0.58f, 0.64f);
                case EquipSlot.Chest: return new Color(0.48f, 0.52f, 0.58f);
                case EquipSlot.Hands: return new Color(0.58f, 0.54f, 0.48f);
                case EquipSlot.Wrists: return new Color(0.50f, 0.48f, 0.44f);
                case EquipSlot.Waist: return new Color(0.42f, 0.36f, 0.28f);
                case EquipSlot.Legs: return new Color(0.40f, 0.42f, 0.48f);
                default: return new Color(0.36f, 0.34f, 0.32f);
            }
        }

        static SkinnedMeshRenderer BodySkin(Transform body)
        {
            SkinnedMeshRenderer best = null;
            int bestCount = 0;
            foreach (var smr in body.GetComponentsInChildren<SkinnedMeshRenderer>(true))
            {
                if (smr == null || smr.gameObject.name.StartsWith("gear_")) continue;
                int n = smr.sharedMesh != null ? smr.sharedMesh.vertexCount : 0;
                if (n > bestCount) { bestCount = n; best = smr; }
            }
            return best;
        }

        static Mesh Original(SkinnedMeshRenderer skin)
        {
            var keep = skin.GetComponent<GearBodySource>();
            if (keep == null) keep = skin.gameObject.AddComponent<GearBodySource>();
            if (keep.original == null)
                keep.original = skin.sharedMesh;
            if (skin.sharedMesh != null && skin.sharedMesh.name == "body_fit")
            {
                var gone = skin.sharedMesh;
                skin.sharedMesh = keep.original;
                Object.DestroyImmediate(gone);
            }
            return keep.original;
        }

        public static int Dominant(BoneWeight w)
        {
            float best = w.weight0;
            int bone = w.boneIndex0;
            if (w.weight1 > best) { best = w.weight1; bone = w.boneIndex1; }
            if (w.weight2 > best) { best = w.weight2; bone = w.boneIndex2; }
            if (w.weight3 > best) bone = w.boneIndex3;
            return bone;
        }
    }

    /// <summary>The imported body mesh, before slot triangles are removed.</summary>
    public sealed class GearBodySource : MonoBehaviour
    {
        public Mesh original;
        /// <summary>Parallel to original.vertices. True where a shell is the only surface.</summary>
        public bool[] covered;
    }
}
