using System.Collections.Generic;
using Hollowmere.Core;
using UnityEngine;

namespace Hollowmere
{
    /// <summary>
    /// The v5 body is cut once, when the hero is first equipped, into one renderer per
    /// region. Later equips only enable or disable those renderers. Armour is an authored
    /// mesh rebound onto the hero bones. The offset-shell generator does not run.
    /// </summary>
    public static class BodyRegions
    {
        const string RootName = "body_regions";

        public static void Ensure(Transform body)
        {
            if (body == null || body.GetComponentInChildren<BodySplit>(true) != null) return;
            var skin = Source(body);
            if (skin == null || skin.sharedMesh == null || !skin.sharedMesh.isReadable) return;
            var mesh = skin.sharedMesh;
            var weights = mesh.boneWeights;
            var tris = mesh.triangles;
            if (weights == null || tris == null || weights.Length != mesh.vertexCount) return;
            var region = new int[mesh.vertexCount];
            var bones = skin.bones;
            for (int i = 0; i < region.Length; i++)
            {
                int d = GearShell.Dominant(weights[i]);
                region[i] = bones != null && d >= 0 && d < bones.Length && bones[d] != null
                    ? GearFit.RegionForBone(bones[d].name) : -1;
            }
            var root = new GameObject(RootName);
            root.AddComponent<BodySplit>();
            root.transform.SetParent(skin.transform.parent, false);
            root.transform.localPosition = skin.transform.localPosition;
            root.transform.localRotation = skin.transform.localRotation;
            root.transform.localScale = skin.transform.localScale;
            int count = (int)GearFit.BodyRegion.Count;
            for (int r = 0; r < count; r++)
            {
                var part = Cut(mesh, weights, tris, region, r);
                if (part == null) continue;
                var go = new GameObject("body_" + GearFit.RegionName(r));
                go.transform.SetParent(root.transform, false);
                var smr = go.AddComponent<SkinnedMeshRenderer>();
                smr.sharedMesh = part;
                smr.bones = skin.bones;
                smr.rootBone = skin.rootBone;
                smr.sharedMaterial = skin.sharedMaterial;
                smr.updateWhenOffscreen = true;
                smr.localBounds = skin.localBounds;
            }
            // The whole mesh stays available for the death-flat bake, but it must not draw.
            skin.forceRenderingOff = true;
        }

        public static void Show(Transform body, bool[] on)
        {
            Ensure(body);
            var mark = body != null ? body.GetComponentInChildren<BodySplit>(true) : null;
            var root = mark != null ? mark.transform : null;
            if (root == null || on == null) return;
            for (int i = 0; i < root.childCount; i++)
            {
                var child = root.GetChild(i);
                int region = RegionOf(child.name);
                if (region < 0 || region >= on.Length) continue;
                child.gameObject.SetActive(true);
                var smr = child.GetComponent<SkinnedMeshRenderer>();
                if (smr != null) smr.forceRenderingOff = !on[region];
            }
        }

        public static List<SkinnedMeshRenderer> Visible(Transform body)
        {
            var list = new List<SkinnedMeshRenderer>();
            var mark = body != null ? body.GetComponentInChildren<BodySplit>(true) : null;
            var root = mark != null ? mark.transform : null;
            if (root == null) return list;
            for (int i = 0; i < root.childCount; i++)
            {
                var smr = root.GetChild(i).GetComponent<SkinnedMeshRenderer>();
                if (smr == null || !smr.enabled || smr.forceRenderingOff) continue;
                if (!smr.gameObject.activeInHierarchy) continue;
                list.Add(smr);
            }
            return list;
        }

        public static SkinnedMeshRenderer Source(Transform body)
        {
            SkinnedMeshRenderer best = null;
            int n = 0;
            if (body == null) return null;
            var skins = body.GetComponentsInChildren<SkinnedMeshRenderer>(true);
            for (int i = 0; i < skins.Length; i++)
            {
                var smr = skins[i];
                if (smr == null) continue;
                if (smr.gameObject.name.StartsWith("gear_") || smr.gameObject.name.StartsWith("body_")) continue;
                int c = smr.sharedMesh != null ? smr.sharedMesh.vertexCount : 0;
                if (c > n) { n = c; best = smr; }
            }
            return best;
        }

        static int RegionOf(string name)
        {
            if (string.IsNullOrEmpty(name) || !name.StartsWith("body_")) return -1;
            string tail = name.Substring(5);
            for (int i = 0; i < (int)GearFit.BodyRegion.Count; i++)
                if (GearFit.RegionName(i) == tail) return i;
            return -1;
        }

        static Mesh Cut(Mesh src, BoneWeight[] weights, int[] tris, int[] region, int want)
        {
            var map = new int[src.vertexCount];
            for (int i = 0; i < map.Length; i++) map[i] = -1;
            var used = new List<int>();
            var keep = new List<int>();
            for (int i = 0; i + 2 < tris.Length; i += 3)
            {
                int a = tris[i], b = tris[i + 1], c = tris[i + 2];
                if (Owner(region, a, b, c) != want) continue;
                keep.Add(Take(map, used, a));
                keep.Add(Take(map, used, b));
                keep.Add(Take(map, used, c));
            }
            if (keep.Count < 3) return null;
            var mesh = new Mesh { name = "body_" + GearFit.RegionName(want) };
            var v = src.vertices;
            var nrm = src.normals;
            var uv = src.uv;
            var nv = new Vector3[used.Count];
            var nn = nrm != null && nrm.Length == v.Length ? new Vector3[used.Count] : null;
            var nuv = uv != null && uv.Length == v.Length ? new Vector2[used.Count] : null;
            var nw = new BoneWeight[used.Count];
            for (int i = 0; i < used.Count; i++)
            {
                int s = used[i];
                nv[i] = v[s];
                if (nn != null) nn[i] = nrm[s];
                if (nuv != null) nuv[i] = uv[s];
                nw[i] = weights[s];
            }
            mesh.vertices = nv;
            if (nn != null) mesh.normals = nn;
            if (nuv != null) mesh.uv = nuv;
            mesh.boneWeights = nw;
            mesh.bindposes = src.bindposes;
            mesh.triangles = keep.ToArray();
            mesh.RecalculateBounds();
            return mesh;
        }

        static int Owner(int[] region, int a, int b, int c)
        {
            int ra = At(region, a), rb = At(region, b), rc = At(region, c);
            if (ra >= 0 && (ra == rb || ra == rc)) return ra;
            if (rb >= 0 && rb == rc) return rb;
            if (ra >= 0) return ra;
            if (rb >= 0) return rb;
            return rc;
        }

        static int At(int[] region, int i) => i >= 0 && i < region.Length ? region[i] : -1;

        static int Take(int[] map, List<int> used, int src)
        {
            if (map[src] >= 0) return map[src];
            map[src] = used.Count;
            used.Add(src);
            return map[src];
        }
    }

    /// <summary>
    /// Authored armour on the v5 hero. Top-tier sets load Gear/Sets/&lt;set&gt;/&lt;slot&gt;.
    /// A piece with no set wears Gear/Lower/&lt;slot&gt; when a CC0 file is there, otherwise
    /// the plate set, which is a real mesh and not a generated shell. Wrists have no file
    /// yet, so the bracers do not hide the forearms.
    /// </summary>
    public static class GearWardrobe
    {
        static readonly string[] Sets = { "plate", "leather", "arcane", "bone", "infernal" };

        public static void Apply(Transform body, Hero hero)
        {
            if (body == null || hero == null) return;
            BodyRegions.Ensure(body);
            var skin = BodyRegions.Source(body);
            var worn = new bool[(int)EquipSlot.Count];
            for (int i = 0; i < GearFit.Visible.Length; i++)
            {
                var slot = GearFit.Visible[i];
                var it = hero.Equipped(slot);
                if (Item.IsNone(it)) continue;
                string folder = Folder(it);
                string slotName = GearFit.SlotName(slot);
                var prefab = Load(folder, slotName, out bool lower);
                if (prefab == null)
                {
                    Debug.Log("Hollowmere gear " + slotName + " no mesh");
                    continue;
                }
                if (!Spawn(body, skin, slot, prefab))
                {
                    Debug.Log("Hollowmere gear " + slotName + " did not bind");
                    continue;
                }
                worn[(int)slot] = true;
                if (!lower && folder != "plate")
                    Debug.Log("Hollowmere gear " + slotName + " set " + folder);
            }
            int count = (int)GearFit.BodyRegion.Count;
            var show = new bool[count];
            for (int r = 0; r < count; r++)
                show[r] = GearFit.RegionOwner(worn, r) == null;
            BodyRegions.Show(body, show);
        }

        static string Folder(Item it)
        {
            string id = it != null ? it.setId : null;
            if (!string.IsNullOrEmpty(id))
            {
                if (id.StartsWith("set_")) id = id.Substring(4);
                for (int i = 0; i < Sets.Length; i++)
                    if (Sets[i] == id) return Sets[i];
            }
            return "plate";
        }

        static GameObject Load(string setFolder, string slot, out bool lower)
        {
            lower = false;
            var low = Resources.Load<GameObject>("Gear/Lower/" + slot);
            if (low != null) { lower = true; return low; }
            if (string.IsNullOrEmpty(setFolder)) return null;
            return Resources.Load<GameObject>("Gear/Sets/" + setFolder + "/" + slot);
        }

        static bool Spawn(Transform body, SkinnedMeshRenderer heroSkin, EquipSlot slot, GameObject prefab)
        {
            if (heroSkin == null || prefab == null || heroSkin.sharedMesh == null) return false;
            var inst = Object.Instantiate(prefab);
            var src = inst.GetComponentInChildren<SkinnedMeshRenderer>(true);
            if (src == null || src.sharedMesh == null || !src.sharedMesh.isReadable)
            {
                Object.DestroyImmediate(inst);
                return false;
            }
            var mesh = Object.Instantiate(src.sharedMesh);
            mesh.name = "gear_" + GearFit.SlotName(slot);
            StripToSlot(mesh, src.bones, slot);
            if (mesh.triangles == null || mesh.triangles.Length < 3)
            {
                Object.DestroyImmediate(mesh);
                Object.DestroyImmediate(inst);
                Debug.Log("Hollowmere gear " + GearFit.SlotName(slot) + " empty after bone strip");
                return false;
            }
            if (!Remap(mesh, src.bones, heroSkin.bones, src.sharedMesh.bindposes, heroSkin.sharedMesh.bindposes))
            {
                Object.DestroyImmediate(mesh);
                Object.DestroyImmediate(inst);
                return false;
            }
            var go = new GameObject(mesh.name);
            go.transform.SetParent(heroSkin.transform.parent, false);
            go.transform.localPosition = heroSkin.transform.localPosition;
            go.transform.localRotation = heroSkin.transform.localRotation;
            go.transform.localScale = heroSkin.transform.localScale;
            var smr = go.AddComponent<SkinnedMeshRenderer>();
            smr.sharedMesh = mesh;
            smr.bones = heroSkin.bones;
            smr.rootBone = heroSkin.rootBone;
            smr.updateWhenOffscreen = true;
            var mats = src.materials;
            for (int i = 0; i < mats.Length; i++)
            {
                if (mats[i] == null) continue;
                if (mats[i].HasProperty("_Cull")) mats[i].SetFloat("_Cull", 0f);
            }
            smr.materials = mats;
            Art.AdoptShaders(go);
            Object.DestroyImmediate(inst);
            return true;
        }

        /// <summary>Drop triangles whose vertices are skinned to some other slot. The GLB packs those in beside the piece.</summary>
        static void StripToSlot(Mesh mesh, Transform[] srcBones, EquipSlot slot)
        {
            var weights = mesh.boneWeights;
            var tris = mesh.triangles;
            if (weights == null || tris == null || srcBones == null) return;
            var keepV = new bool[weights.Length];
            int kept = 0;
            for (int i = 0; i < weights.Length; i++)
            {
                int d = GearShell.Dominant(weights[i]);
                if (d < 0 || d >= srcBones.Length || srcBones[d] == null) continue;
                if (!GearFit.BoneInSlot(slot, srcBones[d].name)) continue;
                keepV[i] = true;
                kept++;
            }
            if (kept < 3) return;
            var map = new int[weights.Length];
            for (int i = 0; i < map.Length; i++) map[i] = -1;
            var used = new List<int>();
            var keep = new List<int>();
            for (int i = 0; i + 2 < tris.Length; i += 3)
            {
                int a = tris[i], b = tris[i + 1], c = tris[i + 2];
                if (!keepV[a] || !keepV[b] || !keepV[c]) continue;
                keep.Add(Take(map, used, a));
                keep.Add(Take(map, used, b));
                keep.Add(Take(map, used, c));
            }
            if (keep.Count < 3) return;
            var v = mesh.vertices;
            var nrm = mesh.normals;
            var uv = mesh.uv;
            var nv = new Vector3[used.Count];
            var nn = nrm != null && nrm.Length == v.Length ? new Vector3[used.Count] : null;
            var nuv = uv != null && uv.Length == v.Length ? new Vector2[used.Count] : null;
            var nw = new BoneWeight[used.Count];
            for (int i = 0; i < used.Count; i++)
            {
                int s = used[i];
                nv[i] = v[s];
                if (nn != null) nn[i] = nrm[s];
                if (nuv != null) nuv[i] = uv[s];
                nw[i] = weights[s];
            }
            mesh.vertices = nv;
            if (nn != null) mesh.normals = nn;
            if (nuv != null) mesh.uv = nuv;
            mesh.boneWeights = nw;
            mesh.triangles = keep.ToArray();
            mesh.RecalculateBounds();
        }

        static int Take(int[] map, List<int> used, int src)
        {
            if (map[src] >= 0) return map[src];
            map[src] = used.Count;
            used.Add(src);
            return map[src];
        }

        /// <summary>GLB inverse bind, written into the hero bone's slot. Unmatched hero bones keep the hero bind.</summary>
        static bool Remap(Mesh mesh, Transform[] srcBones, Transform[] heroBones, Matrix4x4[] srcBind, Matrix4x4[] heroBind)
        {
            if (srcBones == null || heroBones == null) return false;
            var weights = mesh.boneWeights;
            if (weights == null || weights.Length == 0) return false;
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
            if (matched < 8) return false;
            var dst = new Matrix4x4[heroBones.Length];
            for (int i = 0; i < dst.Length; i++)
                dst[i] = heroBind != null && i < heroBind.Length ? heroBind[i] : Matrix4x4.identity;
            if (srcBind != null)
            {
                for (int i = 0; i < srcBones.Length && i < srcBind.Length; i++)
                    if (map[i] >= 0) dst[map[i]] = srcBind[i];
            }
            for (int i = 0; i < weights.Length; i++)
            {
                var w = weights[i];
                int i0 = w.boneIndex0, i1 = w.boneIndex1, i2 = w.boneIndex2, i3 = w.boneIndex3;
                float f0 = w.weight0, f1 = w.weight1, f2 = w.weight2, f3 = w.weight3;
                RemapWeight(ref i0, ref f0, map);
                RemapWeight(ref i1, ref f1, map);
                RemapWeight(ref i2, ref f2, map);
                RemapWeight(ref i3, ref f3, map);
                w.boneIndex0 = i0; w.weight0 = f0;
                w.boneIndex1 = i1; w.weight1 = f1;
                w.boneIndex2 = i2; w.weight2 = f2;
                w.boneIndex3 = i3; w.weight3 = f3;
                weights[i] = w;
            }
            mesh.boneWeights = weights;
            mesh.bindposes = dst;
            return true;
        }

        static void RemapWeight(ref int bone, ref float weight, int[] map)
        {
            if (bone < 0 || bone >= map.Length || map[bone] < 0)
            {
                bone = 0;
                weight = 0f;
                return;
            }
            bone = map[bone];
        }

        static int Map(int bone, int[] map)
        {
            if (bone < 0 || bone >= map.Length) return 0;
            return map[bone];
        }
    }

    /// <summary>Marks the one-time region split so equip does not cut the body again.</summary>
    public sealed class BodySplit : MonoBehaviour
    {
    }
}
