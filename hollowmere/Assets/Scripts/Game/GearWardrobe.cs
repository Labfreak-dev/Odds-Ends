using System.Collections.Generic;
using Hollowmere.Core;
using UnityEngine;

namespace Hollowmere
{
    /// <summary>
    /// The v5 body is cut once, when the hero is first equipped, into one renderer per
    /// region. Later equips hide a region only when a piece covers it, and otherwise leave
    /// the uncovered skin on. Armour is an authored mesh rebound onto the hero bones.
    /// The offset-shell generator does not run.
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
                var kept = go.AddComponent<RegionMesh>();
                kept.full = part;
                smr.bones = skin.bones;
                smr.rootBone = skin.rootBone;
                smr.sharedMaterial = skin.sharedMaterial;
                smr.updateWhenOffscreen = true;
                smr.localBounds = skin.localBounds;
            }
            // The whole mesh stays available for the death-flat bake, but it must not draw.
            skin.forceRenderingOff = true;
        }

        /// <summary>Per-region result of the coverage test. hideAll is the 85 percent case.</summary>
        public struct Cover
        {
            public bool hideAll;
            public bool[] under;
            public float fraction;
        }

        public static void Show(Transform body, Cover[] covers)
        {
            Ensure(body);
            var mark = body != null ? body.GetComponentInChildren<BodySplit>(true) : null;
            var root = mark != null ? mark.transform : null;
            if (root == null || covers == null) return;
            for (int i = 0; i < root.childCount; i++)
            {
                var child = root.GetChild(i);
                int region = RegionOf(child.name);
                if (region < 0 || region >= covers.Length) continue;
                child.gameObject.SetActive(true);
                var smr = child.GetComponent<SkinnedMeshRenderer>();
                if (smr == null) continue;
                var kept = child.GetComponent<RegionMesh>();
                Mesh full = kept != null && kept.full != null ? kept.full : smr.sharedMesh;
                if (smr.sharedMesh != full && smr.sharedMesh != null)
                {
                    var extra = smr.sharedMesh;
                    smr.sharedMesh = full;
                    Object.DestroyImmediate(extra);
                }
                var cover = covers[region];
                if (cover.hideAll || full == null)
                {
                    smr.forceRenderingOff = true;
                    continue;
                }
                var open = Open(full, cover.fraction, cover.under);
                if (open == null)
                {
                    smr.forceRenderingOff = false;
                    continue;
                }
                if (open.triangles == null || open.triangles.Length < 3)
                {
                    Object.DestroyImmediate(open);
                    smr.forceRenderingOff = true;
                    continue;
                }
                smr.sharedMesh = open;
                smr.forceRenderingOff = false;
            }
        }

        /// <summary>Full mesh with the triangles a piece already covers removed. Null when nothing is dropped.</summary>
        static Mesh Open(Mesh full, float fraction, bool[] under)
        {
            if (full == null || under == null) return null;
            var tris = full.triangles;
            if (tris == null || tris.Length < 3) return null;
            var keep = new List<int>(tris.Length);
            for (int i = 0; i + 2 < tris.Length; i += 3)
            {
                int a = tris[i], b = tris[i + 1], c = tris[i + 2];
                bool ca = a >= 0 && a < under.Length && under[a];
                bool cb = b >= 0 && b < under.Length && under[b];
                bool cc = c >= 0 && c < under.Length && under[c];
                if (!GearFit.DrawTriangle(fraction, ca, cb, cc)) continue;
                keep.Add(a);
                keep.Add(b);
                keep.Add(c);
            }
            if (keep.Count == tris.Length) return null;
            var mesh = Object.Instantiate(full);
            mesh.name = full.name + "_open";
            mesh.triangles = keep.ToArray();
            mesh.RecalculateBounds();
            return mesh;
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
    /// the plate set, which is a real mesh and not a generated shell. Each set includes
    /// wrists. The infernal helm is shifted down, bracers are scaled around the forearm,
    /// and the plate gloves drop a stray strap.
    /// </summary>
    public static class GearWardrobe
    {
        /// <summary>Same layout as Gear/Sets/&lt;set&gt;/&lt;slot&gt;.glb. Replaces the files in that folder. Not fetched at runtime.</summary>
        public const string PackFile = "hollowmere_gear_v7b.tar.gz";
        public const string PackUrl = "https://github.com/Labfreak-dev/Odds-Ends/releases/download/hollowmere-assets-v5/hollowmere_gear_v7b.tar.gz";
        public const string PackRoot = "Gear/Sets";

        static readonly string[] Sets = { "plate", "leather", "arcane", "bone", "infernal" };

        public static void Apply(Transform body, Hero hero)
        {
            if (body == null || hero == null) return;
            BodyRegions.Ensure(body);
            var skin = BodyRegions.Source(body);
            var placed = new List<SkinnedMeshRenderer>();
            for (int i = 0; i < GearFit.Visible.Length; i++)
            {
                var slot = GearFit.Visible[i];
                var it = hero.Equipped(slot);
                if (Item.IsNone(it)) continue;
                int tier = GearTable.TierOf(it.tier, it.rarity);
                string family = FamilyOf(it);
                string slotName = GearFit.SlotName(slot);
                var prefab = Load(family, slotName, tier, out bool lower);
                if (prefab == null)
                {
                    Debug.Log("Hollowmere gear " + slotName + " no mesh");
                    continue;
                }
                var piece = Spawn(body, skin, slot, prefab, family, tier, !lower && tier < GearTable.TierCount);
                if (piece == null)
                {
                    Debug.Log("Hollowmere gear " + slotName + " did not bind");
                    continue;
                }
                placed.Add(piece);
                Debug.Log("Hollowmere gear " + slotName + " " + family + " t" + tier + (lower ? " cc0" : tier < GearTable.TierCount ? " finish" : " authored"));
            }
            BodyRegions.Show(body, Coverage(body, placed));
        }

        static void Tint(GameObject go, string family, int tier)
        {
            if (go == null || !GearTable.TryFinish(family, tier, out var fin)) return;
            var tint = new Color(fin.R, fin.G, fin.B, 1f);
            foreach (var r in go.GetComponentsInChildren<Renderer>(true))
            {
                var mats = r.materials;
                for (int i = 0; i < mats.Length; i++)
                {
                    var m = mats[i];
                    if (m == null) continue;
                    if (m.HasProperty("_BaseColor"))
                    {
                        var c = m.GetColor("_BaseColor");
                        c = Color.Lerp(c, tint, fin.Blend);
                        m.SetColor("_BaseColor", c);
                    }
                    else m.color = Color.Lerp(m.color, tint, fin.Blend);
                    if (m.HasProperty("_EmissionColor")) m.SetColor("_EmissionColor", Color.black);
                    if (m.HasProperty("_EmissiveColor")) m.SetColor("_EmissiveColor", Color.black);
                    if (m.HasProperty("_Metallic")) m.SetFloat("_Metallic", fin.Metal);
                    if (m.HasProperty("_Smoothness")) m.SetFloat("_Smoothness", fin.Smooth);
                }
                r.materials = mats;
            }
        }

        static string FamilyOf(Item it)
        {
            string fromSet = GearTable.FamilyFromSet(it != null ? it.setId : null);
            if (!string.IsNullOrEmpty(fromSet)) return fromSet;
            if (it != null && !string.IsNullOrEmpty(it.family))
            {
                for (int i = 0; i < Sets.Length; i++)
                    if (Sets[i] == it.family) return Sets[i];
            }
            return "plate";
        }

        static GameObject Load(string family, string slot, int tier, out bool lower)
        {
            lower = false;
            if (tier < GearTable.TierCount)
            {
                var low = Resources.Load<GameObject>("Gear/Lower/" + family + "/" + slot);
                if (low != null) { lower = true; return low; }
            }
            if (string.IsNullOrEmpty(family)) return null;
            return Resources.Load<GameObject>(PackRoot + "/" + family + "/" + slot);
        }

        static SkinnedMeshRenderer Spawn(Transform body, SkinnedMeshRenderer heroSkin, EquipSlot slot, GameObject prefab, string family, int tier, bool finish)
        {
            if (heroSkin == null || prefab == null || heroSkin.sharedMesh == null) return null;
            var inst = Object.Instantiate(prefab);
            var src = inst.GetComponentInChildren<SkinnedMeshRenderer>(true);
            if (src == null || src.sharedMesh == null || !src.sharedMesh.isReadable)
            {
                Object.DestroyImmediate(inst);
                return null;
            }
            var mesh = Object.Instantiate(src.sharedMesh);
            mesh.name = "gear_" + GearFit.SlotName(slot);
            if (!Remap(mesh, src.bones, heroSkin.bones, src.sharedMesh.bindposes, heroSkin.sharedMesh.bindposes))
            {
                Object.DestroyImmediate(mesh);
                Object.DestroyImmediate(inst);
                return null;
            }
            FitPiece(mesh, slot, family, heroSkin.bones);
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
            if (finish) Tint(go, family, tier);
            Object.DestroyImmediate(inst);
            return smr;
        }

        /// <summary>
        /// Fraction of each body region within 3 cm of a piece, measured in the bind pose once
        /// per equip. A piece hides a region it is allowed to hide only at 85 percent. Below
        /// that, the triangles it fully covers are dropped and the rest of the skin stays.
        /// </summary>
        static BodyRegions.Cover[] Coverage(Transform body, List<SkinnedMeshRenderer> pieces)
        {
            int count = (int)GearFit.BodyRegion.Count;
            var covers = new BodyRegions.Cover[count];
            var mark = body != null ? body.GetComponentInChildren<BodySplit>(true) : null;
            var root = mark != null ? mark.transform : null;
            if (root == null || pieces == null) return covers;
            var grids = new TriGrid[pieces.Count];
            var slots = new EquipSlot?[pieces.Count];
            for (int p = 0; p < pieces.Count; p++)
            {
                var mesh = pieces[p] != null ? pieces[p].sharedMesh : null;
                slots[p] = SlotOf(pieces[p] != null ? pieces[p].name : null);
                if (mesh == null || !mesh.isReadable) continue;
                grids[p] = new TriGrid(mesh.vertices, mesh.triangles, GearFit.CoverDistance);
            }
            for (int c = 0; c < root.childCount; c++)
            {
                var child = root.GetChild(c);
                int region = -1;
                string tail = child.name.StartsWith("body_") ? child.name.Substring(5) : "";
                for (int i = 0; i < count; i++)
                    if (GearFit.RegionName(i) == tail) region = i;
                if (region < 0) continue;
                var kept = child.GetComponent<RegionMesh>();
                var smr = child.GetComponent<SkinnedMeshRenderer>();
                Mesh full = kept != null && kept.full != null ? kept.full : (smr != null ? smr.sharedMesh : null);
                if (full == null || !full.isReadable) continue;
                var verts = full.vertices;
                if (verts == null || verts.Length == 0) continue;
                var under = new bool[verts.Length];
                float best = 0f;
                string who = "";
                for (int p = 0; p < pieces.Count; p++)
                {
                    if (grids[p] == null || slots[p] == null || !GearFit.Hides(slots[p].Value, region)) continue;
                    int hit = 0;
                    for (int v = 0; v < verts.Length; v++)
                    {
                        if (!grids[p].Near(verts[v], GearFit.CoverDistance)) continue;
                        under[v] = true;
                        hit++;
                    }
                    float fraction = hit / (float)verts.Length;
                    if (fraction > best)
                    {
                        best = fraction;
                        who = pieces[p].name;
                    }
                }
                covers[region].fraction = best;
                covers[region].hideAll = GearFit.Covers(best);
                covers[region].under = best > 0f ? under : null;
                if (best > 0.001f)
                    Debug.Log("Hollowmere gear cover " + who + " " + tail + " " + best.ToString("0.00")
                        + (covers[region].hideAll ? " hide" : " open"));
            }
            return covers;
        }

        static EquipSlot? SlotOf(string name)
        {
            if (string.IsNullOrEmpty(name)) return null;
            for (int i = 0; i < GearFit.Visible.Length; i++)
            {
                var slot = GearFit.Visible[i];
                if (name == "gear_" + GearFit.SlotName(slot)) return slot;
            }
            return null;
        }

        /// <summary>
        /// Per-piece corrections that stay in code. The infernal helm's bind box sits 11 cm
        /// above the plate helm, so its vertices drop by that much. Bracers are thin, so
        /// they scale 1.2× around the forearm axis and keep their length. The plate gloves
        /// have four triangles hanging 11 cm below the hand; those are dropped.
        /// </summary>
        const float BracerScale = 1.20f;
        const float HelmDrop = 0.11f;
        const float StrapBelow = 0.08f;

        static void FitPiece(Mesh mesh, EquipSlot slot, string setFolder, Transform[] heroBones)
        {
            if (slot == EquipSlot.Hands && setFolder == "plate") DropPlateStrap(mesh);
            if (slot == EquipSlot.Head && setFolder == "infernal") Offset(mesh, new Vector3(0f, -HelmDrop, 0f));
            if (slot == EquipSlot.Wrists) ScaleAroundForearms(mesh, heroBones, BracerScale);
            if (slot == EquipSlot.Chest) SmoothNormals(mesh, 60f);
        }

        static void Offset(Mesh mesh, Vector3 delta)
        {
            var v = mesh.vertices;
            for (int i = 0; i < v.Length; i++) v[i] += delta;
            mesh.vertices = v;
            mesh.RecalculateBounds();
        }

        static void DropPlateStrap(Mesh mesh)
        {
            var v = mesh.vertices;
            var tris = mesh.triangles;
            if (v == null || tris == null || v.Length == 0 || tris.Length < 3) return;
            var neg = new List<float>();
            var pos = new List<float>();
            for (int i = 0; i < v.Length; i++)
            {
                if (v[i].x < 0f) neg.Add(v[i].y);
                else pos.Add(v[i].y);
            }
            float cutNeg = Percentile(neg, 0.10f) - StrapBelow;
            float cutPos = Percentile(pos, 0.10f) - StrapBelow;
            var bad = new bool[v.Length];
            int n = 0;
            for (int i = 0; i < v.Length; i++)
            {
                float cut = v[i].x < 0f ? cutNeg : cutPos;
                if (v[i].y < cut) { bad[i] = true; n++; }
            }
            if (n == 0) return;
            var keep = new List<int>(tris.Length);
            for (int i = 0; i + 2 < tris.Length; i += 3)
            {
                int a = tris[i], b = tris[i + 1], c = tris[i + 2];
                if (a < 0 || b < 0 || c < 0 || a >= bad.Length || b >= bad.Length || c >= bad.Length) continue;
                if (bad[a] || bad[b] || bad[c]) continue;
                keep.Add(a); keep.Add(b); keep.Add(c);
            }
            if (keep.Count == tris.Length) return;
            mesh.triangles = keep.ToArray();
            mesh.RecalculateBounds();
        }

        static float Percentile(List<float> values, float p)
        {
            if (values == null || values.Count == 0) return 0f;
            values.Sort();
            int i = (int)(p * (values.Count - 1));
            if (i < 0) i = 0;
            if (i >= values.Count) i = values.Count - 1;
            return values[i];
        }

        /// <summary>Radial scale about each forearm. Bone local +Y is the bone axis, so length is unchanged.</summary>
        static void ScaleAroundForearms(Mesh mesh, Transform[] bones, float scale)
        {
            if (bones == null || mesh.bindposes == null) return;
            int left = BoneIndex(bones, "LeftForeArm");
            int right = BoneIndex(bones, "RightForeArm");
            if (left < 0 && right < 0) return;
            var v = mesh.vertices;
            var w = mesh.boneWeights;
            var bind = mesh.bindposes;
            if (w == null || v.Length != w.Length) return;
            bool moved = false;
            for (int i = 0; i < v.Length; i++)
            {
                float wl = WeightOn(w[i], left);
                float wr = WeightOn(w[i], right);
                int bone = wl >= wr ? left : right;
                if (bone < 0 || bone >= bind.Length || (wl <= 0f && wr <= 0f)) continue;
                var inv = bind[bone].inverse;
                Vector3 origin = inv.MultiplyPoint3x4(Vector3.zero);
                Vector3 axis = inv.MultiplyVector(Vector3.up);
                if (axis.sqrMagnitude < 1e-8f) continue;
                axis.Normalize();
                Vector3 d = v[i] - origin;
                float along = Vector3.Dot(d, axis);
                Vector3 radial = d - axis * along;
                v[i] = origin + axis * along + radial * scale;
                moved = true;
            }
            if (!moved) return;
            mesh.vertices = v;
            mesh.RecalculateBounds();
        }

        static int BoneIndex(Transform[] bones, string tail)
        {
            for (int i = 0; i < bones.Length; i++)
            {
                if (bones[i] == null) continue;
                if (string.Equals(GearFit.Tail(bones[i].name), tail, System.StringComparison.OrdinalIgnoreCase))
                    return i;
            }
            return -1;
        }

        static float WeightOn(BoneWeight w, int bone)
        {
            if (bone < 0) return 0f;
            float s = 0f;
            if (w.boneIndex0 == bone) s += w.weight0;
            if (w.boneIndex1 == bone) s += w.weight1;
            if (w.boneIndex2 == bone) s += w.weight2;
            if (w.boneIndex3 == bone) s += w.weight3;
            return s;
        }

        static void SmoothNormals(Mesh mesh, float degrees)
        {
            var v = mesh.vertices;
            var tris = mesh.triangles;
            if (v == null || tris == null || v.Length == 0 || tris.Length < 3) return;
            int ntri = tris.Length / 3;
            var face = new Vector3[ntri];
            var vertFace = new int[v.Length];
            for (int i = 0; i < vertFace.Length; i++) vertFace[i] = -1;
            var groups = new Dictionary<PosKey, List<int>>();
            for (int t = 0; t < ntri; t++)
            {
                int a = tris[t * 3], b = tris[t * 3 + 1], c = tris[t * 3 + 2];
                if (a < 0 || b < 0 || c < 0 || a >= v.Length || b >= v.Length || c >= v.Length) continue;
                Vector3 n = Vector3.Cross(v[b] - v[a], v[c] - v[a]);
                face[t] = n.sqrMagnitude > 1e-12f ? n.normalized : Vector3.up;
                if (vertFace[a] < 0) vertFace[a] = t;
                if (vertFace[b] < 0) vertFace[b] = t;
                if (vertFace[c] < 0) vertFace[c] = t;
                AddFace(groups, v[a], t);
                AddFace(groups, v[b], t);
                AddFace(groups, v[c], t);
            }
            float minDot = Mathf.Cos(degrees * Mathf.Deg2Rad);
            var normals = new Vector3[v.Length];
            for (int i = 0; i < v.Length; i++)
            {
                int t = vertFace[i];
                if (t < 0) { normals[i] = Vector3.up; continue; }
                List<int> list;
                if (!groups.TryGetValue(PosKey.From(v[i]), out list))
                {
                    normals[i] = face[t];
                    continue;
                }
                Vector3 sum = Vector3.zero;
                for (int k = 0; k < list.Count; k++)
                {
                    int o = list[k];
                    if (o < 0 || o >= face.Length) continue;
                    if (Vector3.Dot(face[t], face[o]) < minDot) continue;
                    sum += face[o];
                }
                normals[i] = sum.sqrMagnitude > 1e-12f ? sum.normalized : face[t];
            }
            mesh.normals = normals;
            mesh.RecalculateTangents();
        }

        static void AddFace(Dictionary<PosKey, List<int>> groups, Vector3 p, int tri)
        {
            var key = PosKey.From(p);
            List<int> list;
            if (!groups.TryGetValue(key, out list))
            {
                list = new List<int>(4);
                groups[key] = list;
            }
            for (int i = 0; i < list.Count; i++)
                if (list[i] == tri) return;
            list.Add(tri);
        }

        struct PosKey : System.IEquatable<PosKey>
        {
            public int x, y, z;
            public static PosKey From(Vector3 p)
            {
                return new PosKey
                {
                    x = Mathf.RoundToInt(p.x * 10000f),
                    y = Mathf.RoundToInt(p.y * 10000f),
                    z = Mathf.RoundToInt(p.z * 10000f),
                };
            }
            public bool Equals(PosKey other) => x == other.x && y == other.y && z == other.z;
            public override bool Equals(object obj) => obj is PosKey && Equals((PosKey)obj);
            public override int GetHashCode() => x * 73856093 ^ y * 19349663 ^ z * 83492791;
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

    /// <summary>The uncut region mesh. Equip swaps in an opened copy and restores this one.</summary>
    public sealed class RegionMesh : MonoBehaviour
    {
        public Mesh full;
    }

    /// <summary>Piece triangles bucketed so a body vertex only tests the cell it sits in.</summary>
    sealed class TriGrid
    {
        const float Cell = 0.08f;
        const int Buckets = 4096;
        readonly List<int>[] cells;
        readonly Vector3[] verts;
        readonly int[] tris;

        public TriGrid(Vector3[] verts, int[] tris, float pad)
        {
            this.verts = verts;
            this.tris = tris;
            cells = new List<int>[Buckets];
            if (verts == null || tris == null) return;
            int n = tris.Length / 3;
            for (int t = 0; t < n; t++)
            {
                int ia = tris[t * 3], ib = tris[t * 3 + 1], ic = tris[t * 3 + 2];
                if (ia < 0 || ib < 0 || ic < 0 || ia >= verts.Length || ib >= verts.Length || ic >= verts.Length) continue;
                Vector3 a = verts[ia], b = verts[ib], c = verts[ic];
                Vector3 min = a, max = a;
                Enc(ref min, ref max, b);
                Enc(ref min, ref max, c);
                min -= new Vector3(pad, pad, pad);
                max += new Vector3(pad, pad, pad);
                int x0 = Mathf.FloorToInt(min.x / Cell), x1 = Mathf.FloorToInt(max.x / Cell);
                int y0 = Mathf.FloorToInt(min.y / Cell), y1 = Mathf.FloorToInt(max.y / Cell);
                int z0 = Mathf.FloorToInt(min.z / Cell), z1 = Mathf.FloorToInt(max.z / Cell);
                if (x1 - x0 > 12 || y1 - y0 > 12 || z1 - z0 > 12) continue;
                for (int z = z0; z <= z1; z++)
                    for (int y = y0; y <= y1; y++)
                        for (int x = x0; x <= x1; x++)
                        {
                            int k = Key(x, y, z);
                            if (cells[k] == null) cells[k] = new List<int>(4);
                            cells[k].Add(t);
                        }
            }
        }

        public bool Near(Vector3 p, float dist)
        {
            if (tris == null) return false;
            var list = cells[Key(Mathf.FloorToInt(p.x / Cell), Mathf.FloorToInt(p.y / Cell), Mathf.FloorToInt(p.z / Cell))];
            if (list == null) return false;
            float lim = dist * dist;
            for (int i = 0; i < list.Count; i++)
            {
                int t = list[i];
                int ia = tris[t * 3], ib = tris[t * 3 + 1], ic = tris[t * 3 + 2];
                if (Dist2(p, verts[ia], verts[ib], verts[ic]) <= lim) return true;
            }
            return false;
        }

        static void Enc(ref Vector3 min, ref Vector3 max, Vector3 p)
        {
            if (p.x < min.x) min.x = p.x;
            if (p.y < min.y) min.y = p.y;
            if (p.z < min.z) min.z = p.z;
            if (p.x > max.x) max.x = p.x;
            if (p.y > max.y) max.y = p.y;
            if (p.z > max.z) max.z = p.z;
        }

        static int Key(int x, int y, int z)
        {
            unchecked
            {
                int h = x * 73856093 ^ y * 19349663 ^ z * 83492791;
                return (h & 0x7fffffff) % Buckets;
            }
        }

        static float Dist2(Vector3 p, Vector3 a, Vector3 b, Vector3 c)
        {
            Vector3 ab = b - a, ac = c - a, ap = p - a;
            float d1 = Vector3.Dot(ab, ap);
            float d2 = Vector3.Dot(ac, ap);
            if (d1 <= 0f && d2 <= 0f) return ap.sqrMagnitude;
            Vector3 bp = p - b;
            float d3 = Vector3.Dot(ab, bp);
            float d4 = Vector3.Dot(ac, bp);
            if (d3 >= 0f && d4 <= d3) return bp.sqrMagnitude;
            float vc = d1 * d4 - d3 * d2;
            if (vc <= 0f && d1 >= 0f && d3 <= 0f)
            {
                float v = d1 / (d1 - d3);
                return (p - (a + v * ab)).sqrMagnitude;
            }
            Vector3 cp = p - c;
            float d5 = Vector3.Dot(ab, cp);
            float d6 = Vector3.Dot(ac, cp);
            if (d6 >= 0f && d5 <= d6) return cp.sqrMagnitude;
            float vb = d5 * d2 - d1 * d6;
            if (vb <= 0f && d2 >= 0f && d6 <= 0f)
            {
                float w = d2 / (d2 - d6);
                return (p - (a + w * ac)).sqrMagnitude;
            }
            float va = d3 * d6 - d5 * d4;
            if (va <= 0f && (d4 - d3) >= 0f && (d5 - d6) >= 0f)
            {
                float w = (d4 - d3) / ((d4 - d3) + (d5 - d6));
                return (p - (b + w * (c - b))).sqrMagnitude;
            }
            float denom = va + vb + vc;
            if (Mathf.Abs(denom) < 1e-8f) return ap.sqrMagnitude;
            float v2 = vb / denom;
            float w2 = vc / denom;
            return (p - (a + ab * v2 + ac * w2)).sqrMagnitude;
        }
    }
}
