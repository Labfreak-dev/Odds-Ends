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

        public static void Fit(Transform body, Hero hero)
        {
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
            var seam = new bool[source.vertexCount];
            int hidden = 0;
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
                Attach(body, skin, mesh, worn[s]);
                bool helm = worn[s] == EquipSlot.Head;
                for (int v = 0; v < region.Length; v++)
                {
                    if (!region[v]) continue;
                    hide[v] = true;
                    hidden++;
                    // The helm's one-vert seam left a pale line of the face around the cut.
                    if (helm) seam[v] = true;
                }
            }
            skin.sharedMesh = hidden > 0 ? Hide(source, hide, seam) : source;
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
            WeldNormals(mesh, nn);
            mesh.RecalculateTangents();
            mesh.RecalculateBounds();
            return mesh;
        }

        /// <summary>Split body normals follow the face UV seams and read as bright lines on metal.
        /// Weld them, and flip the result if it turned the shell inside out.</summary>
        static void WeldNormals(Mesh mesh, Vector3[] pushed)
        {
            mesh.RecalculateNormals();
            var welded = mesh.normals;
            if (welded == null || pushed == null || welded.Length != pushed.Length) return;
            Vector3 want = Vector3.zero, got = Vector3.zero;
            int step = Mathf.Max(1, welded.Length / 48);
            for (int i = 0; i < welded.Length; i += step)
            {
                want += pushed[i];
                got += welded[i];
            }
            if (Vector3.Dot(want, got) < 0f)
            {
                for (int i = 0; i < welded.Length; i++) welded[i] = -welded[i];
                mesh.normals = welded;
            }
        }

        static Mesh Hide(Mesh source, bool[] hide, bool[] seam)
        {
            var tris = source.triangles;
            var keep = new List<int>(tris.Length);
            for (int i = 0; i + 2 < tris.Length; i += 3)
            {
                int a = tris[i], b = tris[i + 1], c = tris[i + 2];
                int n = (hide[a] ? 1 : 0) + (hide[b] ? 1 : 0) + (hide[c] ? 1 : 0);
                bool cut = seam != null && (seam[a] || seam[b] || seam[c]);
                if (n >= 2 || (cut && n >= 1)) continue;
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
                Object.Destroy(gone);
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
    }
}
