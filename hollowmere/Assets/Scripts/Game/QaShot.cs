using System;
using System.Collections;
using System.IO;
using Hollowmere.Core;
using UnityEngine;

namespace Hollowmere
{
    /// <summary>
    /// Player builds can be checked without a hand on the mouse:
    ///   Hollowmere -qaShot town
    ///   Hollowmere -qaShot dungeon
    ///   Hollowmere -qaShot title
    /// The shot is written to qa-&lt;scene&gt;.png in the working directory, then the player quits.
    /// Dungeon also fires Hex Bolt so the projectile is in the frame.
    /// </summary>
    public static class QaShot
    {
        public static string Requested
        {
            get
            {
                var args = Environment.GetCommandLineArgs();
                for (int i = 0; i < args.Length - 1; i++)
                    if (args[i] == "-qaShot") return args[i + 1];
                return null;
            }
        }

        public static bool RunIfRequested(GameManager gm)
        {
            var scene = Requested;
            if (string.IsNullOrEmpty(scene)) return false;
            gm.StartCoroutine(Run(gm, scene.Trim().ToLowerInvariant()));
            return true;
        }

        static IEnumerator Run(GameManager gm, string scene)
        {
            bool title = scene == "title";
            bool newHero = scene == "newhero" || scene == "new-hero" || scene == "create";
            bool inventory = scene == "inventory" || scene == "bag";
            bool loot = scene == "loot";
            bool gear = scene == "gear";
            bool gems = scene == "gems" || scene == "jeweler";
            bool fishing = scene == "fishing" || scene == "fish";
            bool dungeon = scene == "dungeon" || scene == "floor" || scene == "floor1" || scene == "1" || loot;
            if (title || newHero)
            {
                UiRoot.I.ShowTitle();
                if (newHero) TitleScreen.ShowNewHero();
                yield return new WaitForSecondsRealtime(1.2f);
            }
            else
            {
                gm.State = GameState.NewGame(HeroClass.Hexweaver, "Qa", PetSpecies.Hound, "Moss", 1);
                if (dungeon) gm.EnterFloor(1);
                else gm.EnterTown(false);
                yield return new WaitForSeconds(0.8f);
                Art.TameOversized(Camera.main);
                var albedo = HeroActor.I != null ? Art.AlbedoOf(HeroActor.I.gameObject) : null;
                if (albedo == null)
                    Debug.LogError("Hollowmere QA: hero material has no albedo texture.");
                else
                    Debug.Log("Hollowmere QA: hero albedo " + albedo.name + " " + albedo.width + "x" + albedo.height
                        + (albedo is Texture2D t && t.isReadable ? " readable" : ""));
                if (HeroActor.I != null && Art.UnionBounds(HeroActor.I.gameObject, out var hb))
                    Debug.Log("Hollowmere QA: hero bounds size " + hb.size + " center " + hb.center);
                if (loot && HeroActor.I != null)
                {
                    var rng = new Rng(9);
                    var hero = gm.State.hero;
                    Vector3 at = HeroActor.I.Pos + HeroActor.I.transform.forward * 2.2f;
                    Pickup.DropItem(Loot.Generate(rng, 12, Rarity.Rare, hero.heroClass, floor: 8), at);
                    Pickup.DropItem(Loot.Generate(rng, 20, Rarity.Legendary, hero.heroClass, floor: 12), at + new Vector3(1.1f, 0f, 0.4f));
                    Pickup.DropGold(40, at + new Vector3(-0.8f, 0f, 0.3f));
                    yield return new WaitForSeconds(0.45f);
                }
                else if (gear)
                {
                    var rng = new Rng(4);
                    var hero = gm.State.hero;
                    hero.Equip(Loot.Generate(rng, 8, Rarity.Rare, hero.heroClass, ItemSlot.Head, floor: 6));
                    hero.Equip(Loot.Generate(rng, 8, Rarity.Magic, hero.heroClass, ItemSlot.Chest, floor: 6));
                    gm.OnEquipmentChanged();
                    yield return new WaitForSeconds(0.3f);
                }
                else if (gems)
                {
                    var hero = gm.State.hero;
                    hero.AddItem(Gems.Make("cinder", 1, 3));
                    hero.AddItem(Gems.Make("thorn", 2, 1));
                    var chest = hero.Equipped(EquipSlot.Chest);
                    if (!Item.IsNone(chest)) { chest.sockets = 1; Gems.Socket(hero, chest, "thorn_2"); }
                    UiRoot.I.OpenJeweler();
                    yield return new WaitForSecondsRealtime(0.35f);
                }
                else if (fishing)
                {
                    var s = new FishingSession(new Rng(3), true, 1, 0f, 0f, 1, HeroClass.Hexweaver);
                    UiRoot.I.OpenFishing(s, HeroActor.I != null ? HeroActor.I.Pos + Vector3.forward * 3f : Vector3.forward * 4f, () => { });
                    yield return new WaitForSecondsRealtime(0.35f);
                }
                else if (inventory)
                {
                    InventoryScreen.Show(UiRoot.I);
                    yield return new WaitForSecondsRealtime(0.4f);
                }
                else if (dungeon && HeroActor.I != null)
                {
                    StandForBolt(HeroActor.I);
                    var bolt = SkillDb.Get("hx_bolt");
                    bool fired = bolt != null && HeroActor.I.UseSkill(bolt);
                    if (!fired) Debug.LogError("Hollowmere QA: Hex Bolt did not fire.");
                    // Mid-flight. 22 m/s for 0.15 s is about three metres in front of the hero.
                    yield return new WaitForSeconds(0.15f);
                }
            }
            yield return new WaitForEndOfFrame();
            var tex = ScreenCapture.CaptureScreenshotAsTexture();
            var path = Path.Combine(Directory.GetCurrentDirectory(), "qa-" + scene + ".png");
            try
            {
                File.WriteAllBytes(path, tex.EncodeToPNG());
                Debug.Log("Hollowmere QA shot saved: " + path);
            }
            catch (Exception e)
            {
                Debug.LogError("Hollowmere QA shot failed: " + e.Message);
            }
            UnityEngine.Object.Destroy(tex);
            Application.Quit();
        }

        static Vector3 OpenAim(Vector3 from)
        {
            Vector3 best = Vector3.forward;
            float bestD = -1f;
            for (int i = 0; i < 8; i++)
            {
                var d = Quaternion.Euler(0f, i * 45f, 0f) * Vector3.forward;
                float dist = ClearDistance(from, d);
                if (dist > bestD) { bestD = dist; best = d; }
            }
            return best;
        }

        static float ClearDistance(Vector3 from, Vector3 dir)
        {
            float dist = 0f;
            for (float s = 0.5f; s <= 10f; s += 0.5f)
            {
                if (!World.Walkable(from + dir * s)) break;
                dist = s;
            }
            return dist;
        }

        /// <summary>Stand where Hex Bolt still has several metres of floor in front of it at 0.15 s,
        /// so the shot shows the projectile instead of a bolt that died in a wall.</summary>
        static void StandForBolt(HeroActor hero)
        {
            var map = World.Map;
            Vector3 origin = hero.Pos;
            Vector3 bestPos = origin;
            Vector3 bestAim = OpenAim(origin);
            float bestScore = ClearDistance(origin, bestAim);
            if (map != null)
            {
                for (int y = 0; y < map.height; y++)
                    for (int x = 0; x < map.width; x++)
                    {
                        if (!map.Walkable(x, y)) continue;
                        var p = World.ToWorld(new Int2(x, y));
                        var aim = OpenAim(p);
                        float dist = ClearDistance(p, aim);
                        float score = dist - Vector3.Distance(p, origin) * 0.02f;
                        if (score > bestScore) { bestScore = score; bestPos = p; bestAim = aim; }
                    }
            }
            hero.Teleport(bestPos);
            hero.aim = bestAim;
            hero.Face(bestAim);
            if (PetActor.I != null) PetActor.I.Teleport(bestPos + new Vector3(1.35f, 0f, -0.85f));
            var rig = UnityEngine.Object.FindObjectOfType<CameraRig>();
            if (rig != null) { rig.follow = hero.transform; rig.Snap(); }
            Debug.Log("Hollowmere QA: bolt lane " + ClearDistance(bestPos, bestAim).ToString("0.0") + "m from " + bestPos);
        }
    }
}
