using System;
using System.Collections;
using System.Linq;
using Hollowmere.Core;
using UnityEngine;

namespace Hollowmere
{
    /// <summary>
    /// Phone-camera QA: what the player actually sees. No pose freezing, no camera override.
    /// The live Animation plays, the game camera follows, the HUD stays, 2340x1080.
    ///   Hollowmere -qaShot phone        (HM_LOADOUT="Head=bone:2:Legendary,Shoulders=leather:2,..." optional; default = each family t1..t3)
    /// Writes qa-phone-&lt;tag&gt;-idle.png, -run.png, -attack.png, plus qa-phone-bag.png and qa-phone-creator.png.
    /// </summary>
    public static partial class QaFrames
    {
        static readonly (EquipSlot slot, string id)[] PhonePieces =
        {
            (EquipSlot.Head, "helm"), (EquipSlot.Shoulders, "pauldrons"), (EquipSlot.Chest, "plate"),
            (EquipSlot.Hands, "gauntlets"), (EquipSlot.Wrists, "bracers"), (EquipSlot.Waist, "belt"),
            (EquipSlot.Legs, "greaves"), (EquipSlot.Feet, "boots"),
        };

        public static IEnumerator RunPhone(GameManager gm)
        {
            var feel = Feel.Active;
            Debug.Log("Hollowmere phone quality=" + QualitySettings.names[QualitySettings.GetQualityLevel()]
                + " skinWeights=" + QualitySettings.skinWeights + " lodBias=" + QualitySettings.lodBias
                + " gfx=" + SystemInfo.graphicsDeviceType);
            gm.State = GameManager.MakeCustom("Aldric", 2, 2, 1, 1, 0.85f, 0.85f, 0.88f, PetSpecies.Hound, "Mossy", 1, 0, true);
            gm.EnterTown(false);
            Screen.SetResolution(2340, 1080, FullScreenMode.Windowed);
            yield return new WaitForSecondsRealtime(1.0f);
            var actor = HeroActor.I;
            if (actor == null) { Debug.LogError("Hollowmere phone FAIL no hero"); Application.Quit(); yield break; }

            PhoneWorldChecks();
            // Plain clothes first: the starter outfit at the phone camera.
            yield return PhoneShots(actor, "plain");
            var s = gm.State;
            var sword = s.stash.FirstOrDefault(i => i.kind == ItemKind.Equipment && i.Base != null && i.Base.slot == ItemSlot.MainHand
                && GearTable.ModelFor(i.baseId) != null && GearTable.ModelFor(i.baseId).StartsWith("sword"));
            if (sword != null && Town.FromStash(s, sword) && s.hero.Equip(sword)) gm.OnEquipmentChanged();
            yield return PhoneShots(actor, "sword");

            string spec = Environment.GetEnvironmentVariable("HM_LOADOUT");
            if (!string.IsNullOrEmpty(spec))
            {
                PhoneWear(gm, spec);
                yield return PhoneShots(actor, "loadout");
                // A/B: the same outfit with QA's frozen idle sample (what the old gear QA saw).
                var anim = actor.GetComponentInChildren<Animation>();
                foreach (AnimationState st in anim) if (st.enabled && st.weight > 0.01f) Debug.Log("Hollowmere phone live clip " + st.name + " w=" + st.weight.ToString("F2") + " t=" + st.time.ToString("F2"));
                LogBones(actor, "live");
                StandIdle(actor);
                LogBones(actor, "standidle");
                PhoneBulge(actor, "loadout-standidle");
                yield return new WaitForEndOfFrame();
                SaveNamed("phone-loadout-standidle");
            }
            else
            {
                foreach (var fam in GearTable.Families)
                    for (int t = 1; t <= GearTable.TierCount; t++)
                    {
                        WearFamily(gm, PhonePieces, fam, t, t == 1 ? Rarity.Common : t == 2 ? Rarity.Rare : Rarity.Legendary);
                        yield return PhoneShots(actor, fam + "-" + t);
                    }
                // A mixed outfit as a player builds it from the stash.
                PhoneWear(gm, "Head=arcane:1:Magic,Shoulders=leather:2:Rare,Chest=plate:2:Rare,Hands=leather:1:Common,Wrists=bone:2:Rare,Waist=leather:2:Rare,Legs=leather:2:Rare,Feet=infernal:1:Common");
                yield return PhoneShots(actor, "mix");
            }

            UiRoot.I.CloseAll();
            InventoryScreen.Show(UiRoot.I);
            yield return new WaitForSecondsRealtime(0.8f);
            yield return new WaitForEndOfFrame();
            SaveNamed("phone-bag");
            PreviewLuma("bag");
            UiRoot.I.CloseAll();
            UiRoot.I.ShowTitle();
            TitleScreen.ShowNewHero();
            yield return new WaitForSecondsRealtime(1.2f);
            yield return new WaitForEndOfFrame();
            SaveNamed("phone-creator");
            PreviewLuma("creator");
            Debug.Log("Hollowmere QA phone done");
            Application.Quit();
        }

        static void PhoneWear(GameManager gm, string spec)
        {
            var hero = gm.State.hero;
            hero.inventory.RemoveAll(it => it != null && it.kind == ItemKind.Equipment && it.Base != null && it.Base.slot != ItemSlot.MainHand);
            var rng = new Rng(11);
            foreach (var part in spec.Split(','))
            {
                var kv = part.Split('=');
                if (kv.Length != 2 || !Enum.TryParse(kv[0].Trim(), out EquipSlot slot)) continue;
                var f = kv[1].Split(':');
                int tier = f.Length > 1 ? int.Parse(f[1]) : 2;
                var rar = f.Length > 2 && Enum.TryParse(f[2], out Rarity r) ? r : Rarity.Rare;
                hero.equipment[(int)slot] = null;
                var it = Loot.Generate(rng, 12, rar, null, ItemSlotOf(slot), Piece(PhonePieces, slot).id, 8);
                if (it == null) continue;
                it.rarity = rar; it.family = f[0]; it.tier = tier;
                if (!hero.AddItem(it) || !hero.Equip(it)) Debug.LogError("Hollowmere phone FAIL equip " + part);
            }
            gm.OnEquipmentChanged();
        }

        /// <summary>
        /// Bulge check against the bare body: every gear vertex's distance to the nearest body vertex in the live pose.
        /// Logs p95/max per piece; FAIL when p95 &gt; limit (a mantle or blob standing off the body).
        /// </summary>
        public static int PhoneBulge(HeroActor actor, string tag)
        {
            var body = actor.transform;
            var skin = BodyRegions.Source(body);
            if (skin == null || !GearWardrobe.BakeWorld(skin, out var bp, out _)) return 0;
            const float cell = 0.05f;
            var grid = new System.Collections.Generic.Dictionary<Vector3Int, System.Collections.Generic.List<Vector3>>();
            foreach (var p in bp)
            {
                var k = Vector3Int.FloorToInt(p / cell);
                if (!grid.TryGetValue(k, out var l)) grid[k] = l = new System.Collections.Generic.List<Vector3>();
                l.Add(p);
            }
            int fails = 0;
            var bodyBones = new System.Collections.Generic.HashSet<string>();
            { var bw = skin.sharedMesh.boneWeights; foreach (var w in bw) { if (w.weight0 > 0.05f) bodyBones.Add(skin.bones[w.boneIndex0].name); if (w.weight1 > 0.05f) bodyBones.Add(skin.bones[w.boneIndex1].name); } }
            foreach (var smr in body.GetComponentsInChildren<SkinnedMeshRenderer>())
            {
                if (!smr.gameObject.name.StartsWith("gear_") || smr.name == "gear_weapon" || smr.name == "gear_offhand") continue;
                if (!GearWardrobe.BakeWorld(smr, out var gp, out _)) continue;
                {
                    var use = new System.Collections.Generic.Dictionary<string, float>();
                    var bw = smr.sharedMesh.boneWeights;
                    foreach (var w in bw)
                    {
                        void Add(int bi, float wt) { if (wt <= 0f || bi >= smr.bones.Length || smr.bones[bi] == null) return; var n = smr.bones[bi].name; use[n] = (use.TryGetValue(n, out var o) ? o : 0f) + wt; }
                        Add(w.boneIndex0, w.weight0); Add(w.boneIndex1, w.weight1); Add(w.boneIndex2, w.weight2); Add(w.boneIndex3, w.weight3);
                    }
                    var top = use.OrderByDescending(kv => kv.Value).Take(6).Select(kv => kv.Key + (bodyBones.Contains(kv.Key) ? "" : "!") + ":" + (kv.Value / Mathf.Max(1, bw.Length)).ToString("F2"));
                    bool sameRoot = smr.rootBone == skin.rootBone;
                    bool sameBones = smr.bones.Length > 0 && smr.bones.All(b => b == null || skin.bones.Contains(b));
                    Debug.Log("Hollowmere phone bones " + tag + " " + smr.name + " sameRoot=" + sameRoot + " sameBones=" + sameBones + " n=" + smr.bones.Length + " " + string.Join(" ", top));
                }
                var d = new float[gp.Length];
                for (int i = 0; i < gp.Length; i++)
                {
                    var k = Vector3Int.FloorToInt(gp[i] / cell);
                    float best = 1f;
                    for (int r = 0; r <= 6 && best > r * cell; r++)
                        for (int x = -r; x <= r; x++) for (int y = -r; y <= r; y++) for (int z = -r; z <= r; z++)
                        {
                            if (Mathf.Max(Mathf.Abs(x), Mathf.Max(Mathf.Abs(y), Mathf.Abs(z))) != r) continue;
                            if (!grid.TryGetValue(k + new Vector3Int(x, y, z), out var l)) continue;
                            foreach (var q in l) { float dd = (q - gp[i]).magnitude; if (dd < best) best = dd; }
                        }
                    d[i] = best;
                }
                Array.Sort(d);
                float p95 = d[(int)(d.Length * 0.95f)], max = d[d.Length - 1];
                float limit = smr.name == "gear_head" ? 0.16f : smr.name == "gear_shoulders" ? 0.20f : 0.12f;
                bool bad = p95 > limit;
                if (bad) fails++;
                Debug.Log("Hollowmere phone bulge " + tag + " " + smr.name + " p95=" + p95.ToString("F3") + " max=" + max.ToString("F3") + " limit=" + limit + (bad ? " FAIL" : " ok"));
            }
            return fails;
        }

        /// <summary>Preview brightness: mean luminance of the centre of every off-screen stage camera's texture. FAIL when the stage averages under 0.20 or the hero pixels under 0.18.</summary>
        public static int PreviewLuma(string tag)
        {
            int fails = 0;
            foreach (var c in Camera.allCameras)
            {
                var rt = c.targetTexture;
                if (rt == null) continue;
                var prev = RenderTexture.active;
                // Hero mask: render once without the stage's animated models, once with; pixels that change are the hero.
                var models = c.transform.root.GetComponentsInChildren<SkinnedMeshRenderer>();
                foreach (var m in models) m.enabled = false;
                c.Render();
                RenderTexture.active = rt;
                var bg = new Texture2D(rt.width, rt.height, TextureFormat.RGBA32, false);
                bg.ReadPixels(new Rect(0, 0, rt.width, rt.height), 0, 0);
                bg.Apply();
                foreach (var m in models) m.enabled = true;
                c.Render();
                RenderTexture.active = rt;
                var t = new Texture2D(rt.width, rt.height, TextureFormat.RGBA32, false);
                t.ReadPixels(new Rect(0, 0, rt.width, rt.height), 0, 0);
                t.Apply();
                RenderTexture.active = prev;
                double sum = 0, heroSum = 0; int n = 0, hn = 0;
                for (int y = rt.height / 4; y < rt.height * 3 / 4; y += 2)
                    for (int x = rt.width / 4; x < rt.width * 3 / 4; x += 2)
                    {
                        var p = t.GetPixel(x, y);
                        float l = 0.2126f * p.r + 0.7152f * p.g + 0.0722f * p.b;
                        sum += l; n++;
                        var q = bg.GetPixel(x, y);
                        if (Mathf.Abs(p.r - q.r) + Mathf.Abs(p.g - q.g) + Mathf.Abs(p.b - q.b) > 0.06f) { heroSum += l; hn++; }
                    }
                UnityEngine.Object.Destroy(t);
                UnityEngine.Object.Destroy(bg);
                float mean = (float)(sum / Mathf.Max(1, n)), hero = (float)(heroSum / Mathf.Max(1, hn));
                bool bad = mean < 0.20f || hero < 0.18f || hn < 200;
                if (bad) fails++;
                Debug.Log("Hollowmere phone preview " + tag + " cam=" + c.name + " meanLuma=" + mean.ToString("F3") + " heroLuma=" + hero.ToString("F3") + " heroPx=" + hn + (bad ? " FAIL" : " ok"));
            }
            return fails;
        }

        /// <summary>Floor is the blended ground (not the two-material tile checker); hero ring is the rune decal, not a ring of cubes.</summary>
        public static int PhoneWorldChecks()
        {
            int fails = 0;
            foreach (var r in UnityEngine.Object.FindObjectsByType<MeshRenderer>(FindObjectsSortMode.None))
            {
                if (r.name != "floor") continue;
                var mats = r.sharedMaterials;
                bool ok = mats.Length == 1 && mats[0] != null && mats[0].shader.name == "Hollowmere/GroundBlend";
                if (!ok) fails++;
                Debug.Log("Hollowmere phone floor materials=" + mats.Length + " shader=" + (mats.Length > 0 && mats[0] != null ? mats[0].shader.name : "none") + (ok ? " ok" : " FAIL tile checker"));
            }
            var hero = HeroActor.I;
            var ring = hero != null ? hero.transform.Find("heroRing") : null;
            if (ring == null) { foreach (var t in hero.GetComponentsInChildren<Transform>(true)) if (t.name == "heroRing") ring = t; }
            if (ring == null) { fails++; Debug.Log("Hollowmere phone ring FAIL missing"); }
            else
            {
                var rs = ring.GetComponentsInChildren<Renderer>(true);
                bool rune = rs.Length == 1 && rs[0].sharedMaterial != null && rs[0].sharedMaterial.shader.name == "Hollowmere/HeroRune";
                if (!rune) fails++;
                Debug.Log("Hollowmere phone ring renderers=" + rs.Length + " shader=" + (rs.Length > 0 && rs[0].sharedMaterial != null ? rs[0].sharedMaterial.shader.name : "none") + (rune ? " ok" : " FAIL plain dashed circle"));
            }
            return fails;
        }

        static void LogBones(HeroActor actor, string tag)
        {
            var skin = BodyRegions.Source(actor.transform);
            foreach (var b in skin.bones)
                if (b != null && (b.name.EndsWith("Foot") || b.name.EndsWith("Leg") || b.name.EndsWith("Shoulder") || b.name.EndsWith("Hips")))
                    Debug.Log("Hollowmere phone bone " + tag + " " + b.name + " lpos=" + b.localPosition.ToString("F3") + " lscale=" + b.localScale.ToString("F3") + " lrot=" + b.localEulerAngles.ToString("F0"));
        }

        static IEnumerator PhoneShots(HeroActor actor, string tag)
        {
            var joy = UnityEngine.Object.FindFirstObjectByType<Joystick>();
            if (joy != null) joy.Value = Vector2.zero;
            yield return new WaitForSeconds(1.2f);
            yield return new WaitForEndOfFrame();
            SaveNamed("phone-" + tag + "-idle");
            PhoneBulge(actor, tag);
            if (joy != null) joy.Value = new Vector2(0.3f, 0.95f);
            yield return new WaitForSeconds(0.9f);
            yield return new WaitForEndOfFrame();
            SaveNamed("phone-" + tag + "-run");
            if (joy != null) joy.Value = new Vector2(-0.3f, -0.95f);
            yield return new WaitForSeconds(0.9f);
            if (joy != null) joy.Value = Vector2.zero;
            yield return new WaitForSeconds(0.3f);
        }
    }
}
