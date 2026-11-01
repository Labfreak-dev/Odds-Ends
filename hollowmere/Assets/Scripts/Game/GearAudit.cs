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
                var albedo = mat.HasProperty("_BaseMap") ? mat.GetTexture("_BaseMap") : null;
                if (albedo == null) albedo = mat.mainTexture;
                var normal = mat.HasProperty("_BumpMap") ? mat.GetTexture("_BumpMap") : null;
                bool rough = (mat.HasProperty("_MetallicGlossMap") && mat.GetTexture("_MetallicGlossMap") != null)
                    || (mat.HasProperty("_Smoothness") && mat.HasProperty("_Metallic"));
                var tint = mat.HasProperty("_BaseColor") ? mat.GetColor("_BaseColor") : mat.color;
                bool white = tint.r > 0.97f && tint.g > 0.97f && tint.b > 0.97f;
                if (albedo == null || normal == null || !rough || white)
                    fails += Fail(name + " untextured white");
            }
            return fails;
        }

        static int Measure(Transform body, List<SkinnedMeshRenderer> pieces, string pose)
        {
            int fails = 0;
            var bodySkin = Body(body);
            if (bodySkin == null || bodySkin.sharedMesh == null) return Fail(pose + " no body");
            var bodyPts = WorldPoints(bodySkin);
            var bodyHide = Hidden(bodySkin, body);
            var bodyGrid = new Grid(bodyPts);
            var shellGrids = new List<Grid>();
            for (int p = 0; p < pieces.Count; p++)
            {
                var piece = pieces[p];
                var pts = WorldPoints(piece);
                if (pts == null || pts.Length < GearFit.MinShellVerts)
                {
                    fails += Fail(pose + " " + piece.name + " bounds empty");
                    continue;
                }
                var pieceGrid = new Grid(pts);
                shellGrids.Add(pieceGrid);
                if (!Art.MeshWorldBounds(piece.transform, out var box))
                    fails += Fail(pose + " " + piece.name + " bounds missing");
                else if (!HeroFit.GearSizeOk(Art.MaxAxis(box.size)))
                    fails += Fail(pose + " " + piece.name + " bounds " + Art.MaxAxis(box.size).ToString("0.00") + "m");

                int gapBad = 0, clearBad = 0, stretchBad = 0, seen = 0;
                int step = Mathf.Max(1, pts.Length / 240);
                var bind = piece.sharedMesh.bindposes;
                var baked = piece.sharedMesh.boneWeights;
                var rest = piece.sharedMesh.vertices;
                var local = LocalPoints(piece);
                for (int i = 0; i < pts.Length; i += step)
                {
                    seen++;
                    float gap = bodyGrid.Nearest(pts[i]);
                    if (!GearFit.GapOk(gap)) gapBad++;
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
                var mine = SlotFromName(piece.name);
                var bw = bodySkin.sharedMesh.boneWeights;
                var bones = bodySkin.bones;
                if (bodyPts != null && bodyHide != null && bw != null)
                {
                    int bstep = Mathf.Max(1, bodyPts.Length / 280);
                    for (int i = 0; i < bodyPts.Length; i += bstep)
                    {
                        float dist = pieceGrid.Nearest(bodyPts[i]);
                        EquipSlot? vs = null;
                        if (i < bw.Length && bones != null)
                        {
                            int d = GearShell.Dominant(bw[i]);
                            if (d >= 0 && d < bones.Length && bones[d] != null)
                                vs = GearFit.SlotForBone(bones[d].name);
                        }
                        if (mine != null && vs == mine) continue;
                        if (i >= bodyHide.Length || !bodyHide[i])
                        {
                            if (!GearFit.VisibleClear(dist)) clearBad++;
                        }
                    }
                }
                string slot = piece.name;
                if (gapBad * 8 > seen) fails += Fail(pose + " " + slot + " gap");
                if (clearBad > 8) fails += Fail(pose + " " + slot + " clips the body");
                if (stretchBad * 8 > seen) fails += Fail(pose + " " + slot + " stretched");
            }
            fails += Holes(body, bodyPts, pieces, shellGrids, pose);
            fails += Overlap(bodyPts, shellGrids, pose);
            return fails;
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
            if (bodyPts == null || shells == null || shells.Count < 2) return 0;
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
            for (int i = 0; i < w.Length && i < hide.Length; i++)
            {
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
