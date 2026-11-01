using System.Collections.Generic;
using Hollowmere.Core;
using UnityEngine;

namespace Hollowmere
{
    /// <summary>
    /// Samples every clip on the hero and checks each fitted piece: weights, gap,
    /// coverage, stretch, and that visible skin is not inside the shell.
    /// </summary>
    public static class GearAudit
    {
        public static void Prepare(Transform body)
        {
            var ma = body != null ? body.GetComponentInChildren<ModelAnim>() : null;
            if (ma != null) EnsurePacks(ma);
        }

        public static int Run(Transform body) => RunClips(body, false);

        /// <summary>One idle keyframe. Used by the mix pass so the full pose sweep stays in gearslots.</summary>
        public static int RunIdle(Transform body) => RunClips(body, true);

        static int RunClips(Transform body, bool idleOnly)
        {
            if (body == null) return Fail("missing hero");
            var ma = body.GetComponentInChildren<ModelAnim>();
            if (ma != null) EnsurePacks(ma);
            var anim = ma != null && ma.anim != null ? ma.anim : body.GetComponentInChildren<Animation>();
            var names = ClipNames(anim);
            int fails = 0;
            var clips = new List<string>();
            for (int g = 0; g < GearFit.RequiredPoses.Length; g++)
            {
                string hit = First(names, GearFit.RequiredPoses[g]);
                if (hit == null) fails += Fail("missing pose " + GearFit.RequiredPoses[g][0] + " clips=" + string.Join(",", names));
                else if (!idleOnly || GearFit.PoseMatch(hit, "idle")) clips.Add(hit);
            }
            if (!idleOnly)
            {
                for (int g = 0; g < GearFit.OptionalPoses.Length; g++)
                {
                    string hit = First(names, GearFit.OptionalPoses[g]);
                    if (hit == null) Debug.Log("Hollowmere gear pose " + GearFit.OptionalPoses[g][0] + " none");
                    else clips.Add(hit);
                }
            }
            if (anim == null) return fails + Fail("no animation");
            var pieces = Pieces(body);
            if (pieces.Count == 0) return fails + Fail("no fitted pieces");
            fails += Weights(pieces);
            fails += Materials(pieces);
            for (int c = 0; c < clips.Count; c++)
            {
                AnimationState st = FindState(anim, clips[c]);
                if (st == null || st.clip == null) continue;
                bool death = GearFit.PoseMatch(st.name, "death") && !GearFit.PoseMatch(st.name, "idle");
                float length = Mathf.Max(0.05f, st.length);
                Pose(anim, st, length * (death ? 0.42f : 0.45f));
                fails += Measure(body, pieces, st.name);
                if (death)
                {
                    Pose(anim, st, length * 0.99f);
                    fails += DeathFlat(body, st.name);
                    fails += Measure(body, pieces, st.name + "@end");
                }
            }
            if (clips.Count > 0)
                Debug.Log("Hollowmere gear sampled " + string.Join(",", clips));
            return fails;
        }

        static void EnsurePacks(ModelAnim ma)
        {
            if (ma.anim == null) return;
            bool attack = false;
            foreach (AnimationState s in ma.anim)
                if (s != null && GearFit.PoseMatch(s.name, "attack")) attack = true;
            if (!attack)
            {
                CombatClipPlayer.Attach(ma, "hero_ironclad");
                CombatClipPlayer.Attach(ma, "hero_stalker");
                CombatClipPlayer.Attach(ma, "hero_hexweaver");
                CombatClipPlayer.AddPack(ma, "Combat/hero_fishing");
            }
            HeroReact.Attach(ma);
        }

        static string First(string[] names, string[] group)
        {
            if (names == null || group == null) return null;
            for (int g = 0; g < group.Length; g++)
                for (int i = 0; i < names.Length; i++)
                    if (GearFit.PoseMatch(names[i], group[g])) return names[i];
            return null;
        }

        static AnimationState FindState(Animation anim, string name)
        {
            foreach (AnimationState s in anim)
                if (s != null && s.name == name) return s;
            return null;
        }

        public static string[] ClipNames(Animation anim)
        {
            if (anim == null) return new string[0];
            var list = new List<string>();
            foreach (AnimationState st in anim)
                if (st != null && st.clip != null) list.Add(st.name);
            return list.ToArray();
        }

        static void Pose(Animation anim, AnimationState st, float time)
        {
            foreach (AnimationState s in anim)
            {
                s.weight = 0f;
                s.enabled = false;
            }
            st.enabled = true;
            st.weight = 1f;
            st.time = time;
            anim.Sample();
        }

        static int Weights(List<SkinnedMeshRenderer> pieces)
        {
            int fails = 0;
            for (int p = 0; p < pieces.Count; p++)
            {
                var mesh = pieces[p].sharedMesh;
                var w = mesh != null ? mesh.boneWeights : null;
                if (w == null || w.Length < GearFit.MinShellVerts)
                {
                    fails += Fail(pieces[p].name + " weights missing");
                    continue;
                }
                int bad = 0;
                int step = Mathf.Max(1, w.Length / 120);
                int seen = 0;
                for (int i = 0; i < w.Length; i += step)
                {
                    float sum = w[i].weight0 + w[i].weight1 + w[i].weight2 + w[i].weight3;
                    if (!GearFit.WeightsOk(sum)) bad++;
                    seen++;
                }
                if (bad * 10 > seen) fails += Fail(pieces[p].name + " bone weights do not sum to 1");
            }
            return fails;
        }

        static int Materials(List<SkinnedMeshRenderer> pieces)
        {
            int fails = 0;
            for (int p = 0; p < pieces.Count; p++)
            {
                var mat = pieces[p].sharedMaterial;
                string name = pieces[p].name;
                if (mat == null)
                {
                    fails += Fail(name + " untextured white");
                    continue;
                }
                string found = BaseColor(mat);
                if (found == null)
                    fails += Fail(name + " untextured white shader=" + (mat.shader != null ? mat.shader.name : "none"));
                else
                    Debug.Log("Hollowmere gear mat " + name + " " + found);
            }
            return fails;
        }

        /// <summary>glTFast materials store the colour in baseColorTexture, not only _BaseMap.</summary>
        static string BaseColor(Material mat)
        {
            string[] names =
            {
                "baseColorTexture", "_BaseMap", "_MainTex", "_BaseColorMap",
                "baseColorTexture_tex", "pbrMetallicRoughness_baseColorTexture",
            };
            for (int i = 0; i < names.Length; i++)
            {
                if (!mat.HasProperty(names[i])) continue;
                var tex = mat.GetTexture(names[i]);
                if (tex != null) return names[i] + "=" + tex.name;
            }
            if (mat.mainTexture != null) return "main=" + mat.mainTexture.name;
            var shader = mat.shader;
            if (shader == null) return null;
            int count = shader.GetPropertyCount();
            for (int i = 0; i < count; i++)
            {
                if (shader.GetPropertyType(i) != UnityEngine.Rendering.ShaderPropertyType.Texture) continue;
                string prop = shader.GetPropertyName(i);
                var tex = mat.GetTexture(prop);
                if (tex == null) continue;
                string low = prop.ToLowerInvariant();
                if (low.Contains("base") || low.Contains("albedo") || low.Contains("color") || low.Contains("diffuse"))
                    return prop + "=" + tex.name;
            }
            return null;
        }

        static int Measure(Transform body, List<SkinnedMeshRenderer> pieces, string pose)
        {
            int fails = 0;
            var bodySkin = Body(body);
            if (bodySkin == null || bodySkin.sharedMesh == null) return Fail(pose + " no body");
            for (int p = 0; p < pieces.Count; p++)
            {
                var piece = pieces[p];
                var pts = WorldPoints(piece);
                if (pts == null || pts.Length < GearFit.MinShellVerts)
                {
                    fails += Fail(pose + " " + piece.name + " bounds empty");
                    continue;
                }
                if (!Art.MeshWorldBounds(piece.transform, out var box))
                    fails += Fail(pose + " " + piece.name + " bounds missing");
                else if (!HeroFit.GearSizeOk(Art.MaxAxis(box.size)))
                    fails += Fail(pose + " " + piece.name + " bounds " + Art.MaxAxis(box.size).ToString("0.00") + "m");

                int stretchBad = 0, seen = 0;
                int step = Mathf.Max(1, pts.Length / 240);
                var bind = piece.sharedMesh.bindposes;
                var baked = piece.sharedMesh.boneWeights;
                var rest = piece.sharedMesh.vertices;
                var local = LocalPoints(piece);
                for (int i = 0; i < pts.Length; i += step)
                {
                    seen++;
                    if (baked != null && bind != null && local != null && i < baked.Length && i < rest.Length && i < local.Length)
                    {
                        int d = GearShell.Dominant(baked[i]);
                        if (d >= 0 && d < bind.Length && piece.bones != null && d < piece.bones.Length && piece.bones[d] != null)
                        {
                            Vector3 origin = bind[d].inverse.MultiplyPoint3x4(Vector3.zero);
                            float restLen = Vector3.Distance(rest[i], origin);
                            Vector3 boneLocal = piece.transform.InverseTransformPoint(piece.bones[d].position);
                            float animLen = Vector3.Distance(local[i], boneLocal);
                            float ratio = animLen / Mathf.Max(0.01f, restLen);
                            if (baked[i].weight0 >= 0.65f && !GearFit.StretchOk(ratio)) stretchBad++;
                        }
                    }
                }
                string slot = piece.name;
                if (stretchBad * 8 > seen) fails += Fail(pose + " " + slot + " stretched");
            }
            fails += DominantBones(pieces);
            fails += SeamGaps(body, pieces, pose);
            fails += ClipPieces(body, pieces, pose);
            fails += LimbChains(body, pieces, pose);
            return fails;
        }

        static int DominantBones(List<SkinnedMeshRenderer> pieces)
        {
            int fails = 0;
            for (int p = 0; p < pieces.Count; p++)
            {
                var piece = pieces[p];
                var mesh = piece != null ? piece.sharedMesh : null;
                var weights = mesh != null ? mesh.boneWeights : null;
                var bones = piece != null ? piece.bones : null;
                if (weights == null || bones == null)
                {
                    Debug.Log("Hollowmere gear bone " + (piece != null ? piece.name : "none") + " none");
                    continue;
                }
                string top = "none";
                float topW = 0f;
                float inSlot = 0f, total = 0f;
                int step = Mathf.Max(1, weights.Length / 200);
                var slot = SlotFromName(piece.name);
                for (int i = 0; i < weights.Length; i += step)
                {
                    var w = weights[i];
                    AddWeight(w.boneIndex0, w.weight0, bones, slot, ref inSlot, ref total, ref top, ref topW);
                    AddWeight(w.boneIndex1, w.weight1, bones, slot, ref inSlot, ref total, ref top, ref topW);
                    AddWeight(w.boneIndex2, w.weight2, bones, slot, ref inSlot, ref total, ref top, ref topW);
                    AddWeight(w.boneIndex3, w.weight3, bones, slot, ref inSlot, ref total, ref top, ref topW);
                }
                bool ok = slot != null && GearFit.CoverageOk(inSlot, total);
                float cover = total > 0.0001f ? inSlot / total : 0f;
                Debug.Log("Hollowmere gear bone " + piece.name + " cover=" + cover.ToString("0.00") + " bone=" + top + (ok ? " ok" : " OUT"));
                if (!ok) fails += Fail(piece.name + " slot weight " + cover.ToString("0.00") + " bone=" + top);
            }
            return fails;
        }

        static void AddWeight(int bone, float weight, Transform[] bones, EquipSlot? slot, ref float inSlot, ref float total, ref string top, ref float topW)
        {
            if (weight <= 0f) return;
            total += weight;
            if (bones == null || bone < 0 || bone >= bones.Length || bones[bone] == null) return;
            string name = bones[bone].name;
            if (weight > topW) { topW = weight; top = name; }
            if (slot != null && GearFit.BoneInSlot(slot.Value, name)) inSlot += weight;
        }

        /// <summary>Distance from the still-visible skin along a hidden region to the piece that covers it.</summary>
        static int SeamGaps(Transform body, List<SkinnedMeshRenderer> pieces, string pose)
        {
            var mark = body != null ? body.GetComponentInChildren<BodySplit>(true) : null;
            if (mark == null || pieces == null) return 0;
            int fails = 0;
            for (int c = 0; c < mark.transform.childCount; c++)
            {
                var child = mark.transform.GetChild(c);
                var hidden = child.GetComponent<SkinnedMeshRenderer>();
                if (hidden == null || !hidden.forceRenderingOff) continue;
                int region = -1;
                string tail = child.name.StartsWith("body_") ? child.name.Substring(5) : "";
                for (int i = 0; i < (int)GearFit.BodyRegion.Count; i++)
                    if (GearFit.RegionName(i) == tail) region = i;
                if (region < 0) continue;
                var covers = new List<Grid>();
                string who = "";
                for (int p = 0; p < pieces.Count; p++)
                {
                    var slot = SlotFromName(pieces[p].name);
                    if (slot == null || !GearFit.Hides(slot.Value, region)) continue;
                    var piecePts = WorldPoints(pieces[p]);
                    if (piecePts == null) continue;
                    covers.Add(new Grid(piecePts));
                    who = pieces[p].name;
                }
                if (covers.Count == 0) continue;
                var hiddenPts = WorldPoints(hidden);
                if (hiddenPts == null) continue;
                var edge = new Grid(hiddenPts);
                int gap = 0, seams = 0;
                var regions = BodyRegions.Visible(body);
                for (int r = 0; r < regions.Count; r++)
                {
                    var pts = WorldPoints(regions[r]);
                    var used = TriangleUsed(regions[r].sharedMesh);
                    if (pts == null) continue;
                    int step = Mathf.Max(1, pts.Length / 40);
                    for (int i = 0; i < pts.Length; i += step)
                    {
                        if (used != null && (i >= used.Length || !used[i])) continue;
                        if (edge.Nearest(pts[i]) > 0.03f) continue;
                        seams++;
                        float near = 1f;
                        for (int g = 0; g < covers.Count; g++)
                        {
                            float d = covers[g].Nearest(pts[i]);
                            if (d < near) near = d;
                        }
                        if (near > GearFit.SeamGap) gap++;
                    }
                }
                Debug.Log("Hollowmere gear seam " + pose + " " + who + " " + tail + " seams=" + seams + " gaps=" + gap);
                if (seams > 0 && gap * 2 > seams) fails += Fail(pose + " " + who + " gap " + gap + " of " + seams);
            }
            return fails;
        }

        /// <summary>Visible region vertices against each piece's skinned triangles. Same mask equip uses.</summary>
        static int ClipPieces(Transform body, List<SkinnedMeshRenderer> pieces, string pose)
        {
            int fails = 0;
            var regions = BodyRegions.Visible(body);
            if (pieces == null) return 0;

            for (int p = 0; p < pieces.Count; p++)
            {
                var piece = pieces[p];
                if (piece == null || !piece.enabled || piece.sharedMesh == null) 
                {
                    Debug.Log("Hollowmere gear clip " + pose + " " + (piece != null ? piece.name : "none") + " no mesh");
                    continue;
                }
                var tris = WorldTris(piece);
                if (tris == null || tris.Length < 3)
                {
                    Debug.Log("Hollowmere gear clip " + pose + " " + piece.name + " no mesh");
                    continue;
                }
                int bad = 0;
                string bone = "none";
                int boneN = 0;
                var tally = new Dictionary<string, int>();
                for (int r = 0; r < regions.Count; r++)
                {
                    var skin = regions[r];
                    if (skin == null || !skin.enabled || !skin.gameObject.activeInHierarchy) continue;
                    var pts = WorldPoints(skin);
                    var used = TriangleUsed(skin.sharedMesh);
                    var weights = skin.sharedMesh != null ? skin.sharedMesh.boneWeights : null;
                    var bones = skin.bones;
                    if (pts == null) continue;
                    int step = Mathf.Max(1, pts.Length / 48);
                    for (int i = 0; i < pts.Length; i += step)
                    {
                        if (used != null && (i >= used.Length || !used[i])) continue;
                        float dist = DistToTris(pts[i], tris);
                        if (dist >= GearFit.MinGap) continue;
                        bad++;
                        string name = "none";
                        if (weights != null && i < weights.Length && bones != null)
                        {
                            int d = GearShell.Dominant(weights[i]);
                            if (d >= 0 && d < bones.Length && bones[d] != null) name = bones[d].name;
                        }
                        tally.TryGetValue(name, out int n);
                        tally[name] = n + 1;
                        if (n + 1 > boneN) { boneN = n + 1; bone = name; }
                    }
                }
                Debug.Log("Hollowmere gear clip " + pose + " " + piece.name + " verts=" + bad + " bone=" + bone + " regions=" + regions.Count);
                if (bad > 8) fails += Fail(pose + " " + piece.name + " clips the body verts=" + bad + " bone=" + bone);
            }
            if (pieces.Count == 0)
                Debug.Log("Hollowmere gear clip " + pose + " verts=0 bone=none");
            return fails;
        }

        /// <summary>
        /// Shoulder-to-hand and hip-to-foot. A sample fails when that skin is not drawn and no
        /// drawn triangle, body or piece, is within the seam distance.
        /// </summary>
        static int LimbChains(Transform body, List<SkinnedMeshRenderer> pieces, string pose)
        {
            var mark = body != null ? body.GetComponentInChildren<BodySplit>(true) : null;
            if (mark == null) return Fail(pose + " chain missing body");
            var drawnTris = new List<DrawnMesh>();
            for (int c = 0; c < mark.transform.childCount; c++)
            {
                var child = mark.transform.GetChild(c);
                var smr = child.GetComponent<SkinnedMeshRenderer>();
                if (smr == null || smr.forceRenderingOff || !smr.enabled || !smr.gameObject.activeInHierarchy) continue;
                AddDrawn(drawnTris, child.name, smr);
            }
            if (pieces != null)
            {
                for (int p = 0; p < pieces.Count; p++)
                    AddDrawn(drawnTris, pieces[p] != null ? pieces[p].name : "piece", pieces[p]);
            }
            var surfaces = new TriNear(drawnTris);
            string[] links = { "UpperArm", "LowerArm", "Hand", "Waist", "Thigh", "Shin", "Foot" };
            var seen = new bool[links.Length];
            int fails = 0;
            for (int c = 0; c < mark.transform.childCount; c++)
            {
                var child = mark.transform.GetChild(c);
                string tail = child.name.StartsWith("body_") ? child.name.Substring(5) : "";
                int link = -1;
                for (int i = 0; i < links.Length; i++)
                    if (links[i] == tail) link = i;
                if (link < 0) continue;
                seen[link] = true;
                var smr = child.GetComponent<SkinnedMeshRenderer>();
                if (smr == null || smr.sharedMesh == null) continue;
                var pts = WorldPoints(smr);
                var used = TriangleUsed(smr.sharedMesh);
                var weights = smr.sharedMesh.boneWeights;
                var bones = smr.bones;
                if (pts == null) continue;
                bool hidden = smr.forceRenderingOff || !smr.enabled || !smr.gameObject.activeInHierarchy;
                int step = Mathf.Max(1, pts.Length / 80);
                int undrawn = 0, far = 0;
                for (int i = 0; i < pts.Length; i += step)
                {
                    bool drawn = !hidden && used != null && i < used.Length && used[i];
                    if (drawn) continue;
                    undrawn++;
                    float dist = surfaces.Nearest(pts[i], out string nearest);
                    if (GearFit.ChainCovered(false, dist)) continue;
                    far++;
                    string bone = DominantName(weights, bones, i);
                    var p = pts[i];
                    Debug.Log("Hollowmere gear chain " + pose + " " + tail
                        + " bone=" + bone
                        + " pos=(" + p.x.ToString("0.000") + "," + p.y.ToString("0.000") + "," + p.z.ToString("0.000") + ")"
                        + " nearest=" + nearest
                        + " dist=" + dist.ToString("0.000"));
                }
                Debug.Log("Hollowmere gear chain " + pose + " " + tail + " undrawn=" + undrawn + " far=" + far);
                if (far > 0) fails += Fail(pose + " " + tail + " chain gap " + far);
            }
            for (int i = 0; i < links.Length; i++)
                if (!seen[i]) fails += Fail(pose + " " + links[i] + " chain missing");
            return fails;
        }

        static void AddDrawn(List<DrawnMesh> list, string name, SkinnedMeshRenderer smr)
        {
            var pts = WorldPoints(smr);
            var tris = smr != null && smr.sharedMesh != null ? smr.sharedMesh.triangles : null;
            if (pts == null || tris == null || tris.Length < 3) return;
            list.Add(new DrawnMesh { name = string.IsNullOrEmpty(name) ? "surface" : name, pts = pts, tris = tris });
        }

        static string DominantName(BoneWeight[] weights, Transform[] bones, int index)
        {
            if (weights == null || bones == null || index < 0 || index >= weights.Length) return "none";
            int d = GearShell.Dominant(weights[index]);
            if (d < 0 || d >= bones.Length || bones[d] == null) return "none";
            return GearFit.Tail(bones[d].name);
        }

        static bool[] TriangleUsed(Mesh mesh)
        {
            if (mesh == null) return null;
            var tris = mesh.triangles;
            if (tris == null) return null;
            var used = new bool[mesh.vertexCount];
            for (int i = 0; i < tris.Length; i++)
            {
                int k = tris[i];
                if (k >= 0 && k < used.Length) used[k] = true;
            }
            return used;
        }

        static float DistToTris(Vector3 p, Vector3[] tris)
        {
            float best = 1f;
            for (int i = 0; i + 2 < tris.Length; i += 3)
            {
                float d = DistPointTri(p, tris[i], tris[i + 1], tris[i + 2]);
                if (d < best) best = d;
                if (best <= 0.0001f) break;
            }
            return best;
        }

        static float DistPointTri(Vector3 p, Vector3 a, Vector3 b, Vector3 c)
        {
            Vector3 ab = b - a, ac = c - a, ap = p - a;
            float d1 = Vector3.Dot(ab, ap);
            float d2 = Vector3.Dot(ac, ap);
            if (d1 <= 0f && d2 <= 0f) return Vector3.Distance(p, a);
            Vector3 bp = p - b;
            float d3 = Vector3.Dot(ab, bp);
            float d4 = Vector3.Dot(ac, bp);
            if (d3 >= 0f && d4 <= d3) return Vector3.Distance(p, b);
            float vc = d1 * d4 - d3 * d2;
            if (vc <= 0f && d1 >= 0f && d3 <= 0f)
            {
                float v = d1 / (d1 - d3);
                return Vector3.Distance(p, a + v * ab);
            }
            Vector3 cp = p - c;
            float d5 = Vector3.Dot(ab, cp);
            float d6 = Vector3.Dot(ac, cp);
            if (d6 >= 0f && d5 <= d6) return Vector3.Distance(p, c);
            float vb = d5 * d2 - d1 * d6;
            if (vb <= 0f && d2 >= 0f && d6 <= 0f)
            {
                float w = d2 / (d2 - d6);
                return Vector3.Distance(p, a + w * ac);
            }
            float va = d3 * d6 - d5 * d4;
            if (va <= 0f && (d4 - d3) >= 0f && (d5 - d6) >= 0f)
            {
                float w = (d4 - d3) / ((d4 - d3) + (d5 - d6));
                return Vector3.Distance(p, b + w * (c - b));
            }
            float denom = va + vb + vc;
            if (Mathf.Abs(denom) < 1e-8f) return Vector3.Distance(p, a);
            float v2 = vb / denom;
            float w2 = vc / denom;
            return Vector3.Distance(p, a + ab * v2 + ac * w2);
        }

        static Vector3[] WorldTris(SkinnedMeshRenderer smr)
        {
            var pts = WorldPoints(smr);
            if (pts == null || smr.sharedMesh == null) return null;
            var tris = smr.sharedMesh.triangles;
            if (tris == null) return null;
            var world = new Vector3[tris.Length];
            for (int i = 0; i < tris.Length; i++)
            {
                int idx = tris[i];
                world[i] = idx >= 0 && idx < pts.Length ? pts[idx] : Vector3.zero;
            }
            return world;
        }

        /// <summary>A covered body vertex may sit under a neighbouring shell. The outer piece wins an overlap.</summary>
        static int Holes(Transform body, Vector3[] bodyPts, List<SkinnedMeshRenderer> pieces, List<Grid> shells, string pose)
        {
            if (bodyPts == null || pieces == null || shells == null || shells.Count == 0) return 0;
            var skin = Body(body);
            var bw = skin != null && skin.sharedMesh != null ? skin.sharedMesh.boneWeights : null;
            var bones = skin != null ? skin.bones : null;
            if (bw == null) return 0;
            int fails = 0;
            int step = Mathf.Max(1, bodyPts.Length / 280);
            for (int p = 0; p < pieces.Count && p < shells.Count; p++)
            {
                var mine = SlotFromName(pieces[p].name);
                if (mine == null) continue;
                int coverBad = 0;
                for (int i = 0; i < bodyPts.Length; i += step)
                {
                    if (i >= bw.Length || bones == null) continue;
                    int d = GearShell.Dominant(bw[i]);
                    if (d < 0 || d >= bones.Length || bones[d] == null) continue;
                    if (GearFit.SlotForBone(bones[d].name) != mine) continue;
                    float best = 1f;
                    for (int g = 0; g < shells.Count; g++)
                    {
                        float dist = shells[g].Nearest(bodyPts[i]);
                        if (dist < best) best = dist;
                    }
                    if (!GearFit.Covered(best)) coverBad++;
                }
                if (coverBad > 8) fails += Fail(pose + " " + pieces[p].name + " hole in the body");
            }
            return fails;
        }

        /// <summary>Two shells within 3 mm over the same body spot. The inner one should have been removed.</summary>
        static int Overlap(Vector3[] bodyPts, List<Grid> shells, string pose)
        {
            int shellCount = shells == null ? 0 : shells.Count;
            if (bodyPts == null || shells == null || shells.Count < 2)
            {
                Debug.Log("Hollowmere gear overlap " + pose + " shells=" + shellCount + " bad=0");
                return 0;
            }
            int bad = 0;
            int step = Mathf.Max(1, bodyPts.Length / 220);
            for (int i = 0; i < bodyPts.Length; i += step)
            {
                float d0 = 1f, d1 = 1f;
                Vector3 p0 = bodyPts[i], p1 = bodyPts[i];
                for (int s = 0; s < shells.Count; s++)
                {
                    Vector3 q = shells[s].NearestPoint(bodyPts[i], out float d);
                    if (d < d0) { d1 = d0; p1 = p0; d0 = d; p0 = q; }
                    else if (d < d1) { d1 = d; p1 = q; }
                }
                if (GearFit.ShellsOverlap(Vector3.Distance(p0, p1), d0, d1)) bad++;
            }
            Debug.Log("Hollowmere gear overlap " + pose + " shells=" + shells.Count + " bad=" + bad);
            if (bad > 8) return Fail(pose + " shells overlap " + bad);
            return 0;
        }

        static int DeathFlat(Transform body, string pose)
        {
            var head = Art.Bone(body, "Head");
            var hips = Art.Bone(body, "Hips");
            var skin = Body(body);
            var pts = WorldPoints(skin);
            if (head == null || hips == null || pts == null || pts.Length == 0)
                return Fail(pose + " death flat missing bones");
            Vector3 torso = head.position - hips.position;
            float up = torso.sqrMagnitude > 0.0001f ? torso.normalized.y : 1f;
            float minY = pts[0].y, maxY = pts[0].y;
            for (int i = 1; i < pts.Length; i++)
            {
                if (pts[i].y < minY) minY = pts[i].y;
                if (pts[i].y > maxY) maxY = pts[i].y;
            }
            float height = maxY - minY;
            Debug.Log("Hollowmere gear death flat up=" + up.ToString("0.00")
                + " minY=" + minY.ToString("0.00")
                + " height=" + height.ToString("0.00"));
            if (!GearFit.DeathFlat(up, minY, height))
                return Fail("death not flat on the floor");
            return 0;
        }

        static bool[] Hidden(SkinnedMeshRenderer skin, Transform figure)
        {
            var mesh = skin.sharedMesh;
            if (mesh == null || !mesh.isReadable || mesh.boneWeights == null) return null;
            var hide = new bool[mesh.vertexCount];
            var bones = skin.bones;
            var w = mesh.boneWeights;
            var src = skin.GetComponent<GearBodySource>();
            var covered = src != null ? src.covered : null;
            for (int i = 0; i < w.Length && i < hide.Length; i++)
            {
                if (covered != null && i < covered.Length && covered[i]) { hide[i] = true; continue; }
                int d = GearShell.Dominant(w[i]);
                if (bones == null || d < 0 || d >= bones.Length || bones[d] == null) continue;
                var slot = GearFit.SlotForBone(bones[d].name);
                if (slot == null) continue;
                hide[i] = FindPiece(figure, "gear_" + GearFit.SlotName(slot.Value)) != null;
            }
            return hide;
        }

        static EquipSlot? SlotFromName(string name)
        {
            for (int i = 0; i < GearFit.Visible.Length; i++)
                if (name == "gear_" + GearFit.SlotName(GearFit.Visible[i])) return GearFit.Visible[i];
            return null;
        }

        static Transform FindPiece(Transform figure, string name)
        {
            if (figure == null) return null;
            var hits = figure.GetComponentsInChildren<Transform>(true);
            for (int i = 0; i < hits.Length; i++)
                if (hits[i].name == name) return hits[i];
            return null;
        }

        static List<SkinnedMeshRenderer> Pieces(Transform body)
        {
            var list = new List<SkinnedMeshRenderer>();
            foreach (var smr in body.GetComponentsInChildren<SkinnedMeshRenderer>(true))
            {
                if (smr != null && smr.gameObject.name.StartsWith("gear_")) list.Add(smr);
            }
            return list;
        }

        static SkinnedMeshRenderer Body(Transform body)
        {
            SkinnedMeshRenderer best = null;
            int n = 0;
            foreach (var smr in body.GetComponentsInChildren<SkinnedMeshRenderer>(true))
            {
                if (smr == null || smr.gameObject.name.StartsWith("gear_")) continue;
                int c = smr.sharedMesh != null ? smr.sharedMesh.vertexCount : 0;
                if (c > n) { n = c; best = smr; }
            }
            return best;
        }

        static Vector3[] WorldPoints(SkinnedMeshRenderer smr)
        {
            if (smr == null || smr.sharedMesh == null) return null;
            var baked = new Mesh();
            smr.BakeMesh(baked);
            var local = baked.vertices;
            Object.Destroy(baked);
            var pts = new Vector3[local.Length];
            var m = smr.transform.localToWorldMatrix;
            for (int i = 0; i < local.Length; i++) pts[i] = m.MultiplyPoint3x4(local[i]);
            return pts;
        }

        static Vector3[] LocalPoints(SkinnedMeshRenderer smr)
        {
            if (smr == null || smr.sharedMesh == null) return null;
            var baked = new Mesh();
            smr.BakeMesh(baked);
            var local = baked.vertices;
            Object.Destroy(baked);
            return local;
        }

        static int Fail(string why)
        {
            Debug.LogError("Hollowmere gear FAIL " + why);
            return 1;
        }

        struct DrawnMesh
        {
            public string name;
            public Vector3[] pts;
            public int[] tris;
        }

        /// <summary>Every drawn triangle, body or piece. A query searches the cells the triangle actually overlaps.</summary>
        sealed class TriNear
        {
            struct Item
            {
                public string name;
                public Vector3 a, b, c;
            }

            readonly List<Item>[] cells;
            const float Cell = 0.08f;
            const int Buckets = 8192;

            public TriNear(List<DrawnMesh> meshes)
            {
                cells = new List<Item>[Buckets];
                if (meshes == null) return;
                for (int m = 0; m < meshes.Count; m++)
                {
                    var mesh = meshes[m];
                    if (mesh.pts == null || mesh.tris == null) continue;
                    int n = mesh.tris.Length / 3;
                    for (int t = 0; t < n; t++)
                    {
                        int ia = mesh.tris[t * 3], ib = mesh.tris[t * 3 + 1], ic = mesh.tris[t * 3 + 2];
                        if (ia < 0 || ib < 0 || ic < 0 || ia >= mesh.pts.Length || ib >= mesh.pts.Length || ic >= mesh.pts.Length) continue;
                        var item = new Item { name = mesh.name, a = mesh.pts[ia], b = mesh.pts[ib], c = mesh.pts[ic] };
                        Vector3 min = item.a, max = item.a;
                        Enc(ref min, ref max, item.b);
                        Enc(ref min, ref max, item.c);
                        int x0 = Mathf.FloorToInt(min.x / Cell), x1 = Mathf.FloorToInt(max.x / Cell);
                        int y0 = Mathf.FloorToInt(min.y / Cell), y1 = Mathf.FloorToInt(max.y / Cell);
                        int z0 = Mathf.FloorToInt(min.z / Cell), z1 = Mathf.FloorToInt(max.z / Cell);
                        if (x1 - x0 > 16 || y1 - y0 > 16 || z1 - z0 > 16) { x0 = x1 = Mathf.FloorToInt(item.a.x / Cell); y0 = y1 = Mathf.FloorToInt(item.a.y / Cell); z0 = z1 = Mathf.FloorToInt(item.a.z / Cell); }
                        for (int z = z0; z <= z1; z++)
                            for (int y = y0; y <= y1; y++)
                                for (int x = x0; x <= x1; x++)
                                {
                                    int k = Key(x, y, z);
                                    if (cells[k] == null) cells[k] = new List<Item>(4);
                                    cells[k].Add(item);
                                }
                    }
                }
            }

            public float Nearest(Vector3 p, out string name)
            {
                name = "none";
                float best = 1f;
                int cx = Mathf.FloorToInt(p.x / Cell);
                int cy = Mathf.FloorToInt(p.y / Cell);
                int cz = Mathf.FloorToInt(p.z / Cell);
                for (int z = -2; z <= 2; z++)
                    for (int y = -2; y <= 2; y++)
                        for (int x = -2; x <= 2; x++)
                        {
                            var list = cells[Key(cx + x, cy + y, cz + z)];
                            if (list == null) continue;
                            for (int i = 0; i < list.Count; i++)
                            {
                                float d = DistPointTri(p, list[i].a, list[i].b, list[i].c);
                                if (d >= best) continue;
                                best = d;
                                name = list[i].name;
                            }
                        }
                return best;
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
        }

        sealed class Grid
        {
            readonly List<Vector3>[] cells;
            const float Cell = 0.08f;
            const int Buckets = 4096;

            public Grid(Vector3[] pts)
            {
                cells = new List<Vector3>[Buckets];
                if (pts == null) return;
                for (int i = 0; i < pts.Length; i++)
                {
                    int k = Key(pts[i]);
                    if (cells[k] == null) cells[k] = new List<Vector3>(4);
                    cells[k].Add(pts[i]);
                }
            }

            public float Nearest(Vector3 p) => Vector3.Distance(p, NearestPoint(p, out _));

            public Vector3 NearestPoint(Vector3 p, out float dist)
            {
                dist = 1f;
                Vector3 best = p;
                int cx = Mathf.FloorToInt(p.x / Cell);
                int cy = Mathf.FloorToInt(p.y / Cell);
                int cz = Mathf.FloorToInt(p.z / Cell);
                for (int z = -1; z <= 1; z++)
                    for (int y = -1; y <= 1; y++)
                        for (int x = -1; x <= 1; x++)
                        {
                            var list = cells[Key(cx + x, cy + y, cz + z)];
                            if (list == null) continue;
                            for (int i = 0; i < list.Count; i++)
                            {
                                float d = Vector3.Distance(p, list[i]);
                                if (d < dist) { dist = d; best = list[i]; }
                            }
                        }
                return best;
            }

            static int Key(Vector3 p) => Key(Mathf.FloorToInt(p.x / Cell), Mathf.FloorToInt(p.y / Cell), Mathf.FloorToInt(p.z / Cell));

            static int Key(int x, int y, int z)
            {
                unchecked
                {
                    int h = x * 73856093 ^ y * 19349663 ^ z * 83492791;
                    return (h & 0x7fffffff) % Buckets;
                }
            }
        }
    }
}
