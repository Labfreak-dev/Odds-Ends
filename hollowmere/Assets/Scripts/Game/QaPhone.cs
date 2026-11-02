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
            UiRoot.I.CloseAll();
            UiRoot.I.ShowTitle();
            TitleScreen.ShowNewHero();
            yield return new WaitForSecondsRealtime(1.2f);
            yield return new WaitForEndOfFrame();
            SaveNamed("phone-creator");
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

        static IEnumerator PhoneShots(HeroActor actor, string tag)
        {
            var joy = UnityEngine.Object.FindFirstObjectByType<Joystick>();
            if (joy != null) joy.Value = Vector2.zero;
            yield return new WaitForSeconds(1.2f);
            yield return new WaitForEndOfFrame();
            SaveNamed("phone-" + tag + "-idle");
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
