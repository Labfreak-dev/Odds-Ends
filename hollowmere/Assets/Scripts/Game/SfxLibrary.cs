using System.Collections.Generic;
using Hollowmere.Core;
using UnityEngine;

namespace Hollowmere
{
    /// <summary>
    /// Every clip under Assets/Audio. The Resources catalog references them, so a
    /// player build includes the files. Lookup is by the clip's file name.
    /// </summary>
    public sealed class SfxLibrary : ScriptableObject
    {
        public AudioClip[] clips;
    }

    public static class SfxBook
    {
        static Dictionary<string, AudioClip> map;
        static bool tried;

        public static AudioClip Get(string name)
        {
            if (!tried)
            {
                tried = true;
                map = new Dictionary<string, AudioClip>();
                var cat = Resources.Load<SfxLibrary>("SfxLibrary");
                if (cat != null && cat.clips != null)
                    for (int i = 0; i < cat.clips.Length; i++)
                        if (cat.clips[i] != null) map[cat.clips[i].name] = cat.clips[i];
            }
            if (map == null || string.IsNullOrEmpty(name)) return null;
            map.TryGetValue(name, out var clip);
            return clip;
        }
    }

    /// <summary>
    /// Footsteps, pet calls, bag sounds, and combat.
    /// The pack named the classes warden and hexer. Those files are renamed onto the real skills:
    /// cleave, ground slam, shield bash → charge, rallying light → war cry,
    /// hex bolt, frost nova, chain lightning, fireball → meteor,
    /// venom arrow → twin shot, volley, smoke bomb → caltrops, shadow step → roll.
    /// Whirl shares cleave, earthsplit shares slam, rain of arrows shares volley.
    /// Blink has no take. Thrall uses the pet summon.
    /// </summary>
    public static class Sfx
    {
        public static void Step(string surface) => AudioHub.Vary("step_" + surface, 0.5f);
        public static void Pet(string cue) => AudioHub.Vary("pet_" + cue, 0.75f);
        public static void Bag(string cue) => AudioHub.Vary(cue, cue == "hover_tick" ? 0.45f : 0.7f);

        public static void Cast(HeroActor hero, string skillId)
        {
            if (Play(CastCue(skillId), 0.8f)) return;
            Swing(WeaponId(hero));
        }

        public static void Strike(HeroActor hero, string skillId, Actor target, bool crit)
        {
            if (crit)
            {
                AudioHub.Vary("crit_hit", 0.9f);
                return;
            }
            if (Play(ImpactCue(skillId), 0.8f)) return;
            string family = WeaponId(hero);
            bool armor = target is MonsterActor m && (m.stats.def.role == MonsterRole.Brute || m.stats.IsEliteish);
            AudioHub.Vary(armor ? "hit_armor" : "hit_" + family, 0.8f);
        }

        public static void Swing(string family) => AudioHub.Vary("swing_" + family, 0.75f);
        public static void Drop(Rarity rarity)
        {
            string cue = rarity switch
            {
                Rarity.Magic => "drop_magic",
                Rarity.Rare => "drop_rare",
                Rarity.Legendary => "drop_legendary",
                Rarity.Set => "drop_set",
                _ => "drop_common",
            };
            AudioHub.Vary(cue, 0.8f);
        }

        public static void PlayEquip(ItemSlot slot)
        {
            string cue = slot switch
            {
                ItemSlot.Head => "equip_helm",
                ItemSlot.Amulet => "equip_amulet",
                ItemSlot.Chest => "equip_chest",
                ItemSlot.Hands => "equip_gloves",
                ItemSlot.Feet => "equip_boots",
                ItemSlot.Ring => "equip_ring",
                ItemSlot.MainHand => "equip_weapon",
                ItemSlot.OffHand => "equip_offhand",
                ItemSlot.Waist => "equip_belt",
                ItemSlot.Legs => "equip_legs",
                _ => "equip",
            };
            AudioHub.Vary(cue, 0.8f);
        }
        public static void ImpactOnly(string skillId) => Play(ImpactCue(skillId), 0.8f);

        public static string WeaponId(HeroActor hero)
        {
            string id = hero != null ? hero.Hero.Equipped(EquipSlot.MainHand)?.baseId : null;
            switch (id)
            {
                case "axe":
                case "greataxe": return "axe";
                case "mace":
                case "warhammer": return "mace";
                case "dagger": return "dagger";
                case "bow":
                case "crossbow": return "bow";
                case "staff":
                case "wand":
                case "rod": return "staff";
                case "sword": return "sword";
                default: return "sword";
            }
        }

        static bool Play(string cue, float volume)
        {
            if (string.IsNullOrEmpty(cue) || !AudioHub.Has(cue + "_01")) return false;
            AudioHub.Vary(cue, volume);
            return true;
        }

        static string CastCue(string id) => id switch
        {
            "ic_cleave" or "ic_whirl" => "ic_cleave_cast",
            "ic_slam" or "ic_earthsplit" => "ic_slam_cast",
            "ic_charge" => "ic_charge_cast",
            "ic_warcry" => "ic_warcry_cast",
            "st_twinshot" => "st_twinshot_cast",
            "st_volley" or "st_rain" => "st_volley_cast",
            "st_caltrops" => "st_caltrops_cast",
            "st_roll" => "st_roll_cast",
            "hx_bolt" => "hx_bolt_cast",
            "hx_frostring" => "hx_frostring_cast",
            "hx_chain" => "hx_chain_cast",
            "hx_meteor" => "hx_meteor_cast",
            "hx_thrall" => "pet_summon",
            _ => null,
        };

        static string ImpactCue(string id) => id switch
        {
            "ic_cleave" or "ic_whirl" => "ic_cleave_impact",
            "ic_slam" or "ic_earthsplit" => "ic_slam_impact",
            "ic_charge" => "ic_charge_impact",
            "ic_warcry" => "ic_warcry_impact",
            "st_twinshot" => "st_twinshot_impact",
            "st_volley" or "st_rain" => "st_volley_impact",
            "st_caltrops" => "st_caltrops_impact",
            "st_roll" => "st_roll_impact",
            "hx_bolt" => "hx_bolt_impact",
            "hx_frostring" => "hx_frostring_impact",
            "hx_chain" => "hx_chain_impact",
            "hx_meteor" => "hx_meteor_impact",
            _ => null,
        };
    }
}
