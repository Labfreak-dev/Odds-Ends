using System.Collections.Generic;
using UnityEngine;

namespace Hollowmere.StyleTest.Skills
{
    // ---------------------------------------------------------------------------------------------------------------
    // Phase 5 data layer. Plain C# tables (StSkillDb) so the same defs drive the runtime StSkillRunner, the HUD, the
    // loadout/subclass screens and the proof-shot pipeline. Model-agnostic: skills name anim KEYS (mapped per rig by
    // AnimMap) and socket NAMES (Anchor -> StSockets.Socket), never bones, meshes or hard-coded colours.
    // ---------------------------------------------------------------------------------------------------------------

    public enum SlotType { Basic, Active, Ultimate, Passive }
    public enum Targeting { Self, Auto, Aim }
    public enum PaletteRole { Primary, Secondary, Glow, Dark, White, Telegraph }
    public enum Anchor { Root, Chest, HandR, HandL, WeaponTip, Bow, Aim, Front }

    /// <summary>Four-colour effect palette. Every VFX recipe colours itself through roles, so a subclass recolours
    /// every skill it can cast just by swapping this.</summary>
    public struct Palette
    {
        public Color primary, secondary, glow, dark; public string name;
        public Palette(string n, Color p, Color s, Color g, Color d) { name = n; primary = p; secondary = s; glow = g; dark = d; }
        public Color this[PaletteRole r]
        {
            get
            {
                switch (r)
                {
                    case PaletteRole.Secondary: return secondary;
                    case PaletteRole.Glow: return glow;
                    case PaletteRole.Dark: return dark;
                    case PaletteRole.White: return new Color(2f, 2f, 2f, 1);
                    case PaletteRole.Telegraph: return Ldr(secondary) * 1.1f;
                    default: return primary;
                }
            }
        }
        /// <summary>HDR -> displayable swatch colour (UI).</summary>
        public static Color Ldr(Color c) { float m = Mathf.Max(1f, c.maxColorComponent); return new Color(c.r / m, c.g / m, c.b / m, 1); }
    }

    /// <summary>Procedural VFX primitive kinds (StVfx implements each). Phase-4 StFx primitives plus the phase-5 additions.</summary>
    public enum Vk
    {
        Telegraph, Slash, SpinSlash, Glow, Orb, Arrow, ArrowFan, ArrowRain, Sparks, Shock, ConeWave, Shards, Bubble, Pillar, Beam,
        Lightning, RuneRing, Banner, Hammer, Flames, FlameRing, Motes, Dash, Blink, Meteor, Reticle, Stars, Afterimage, Scorch, Clouds,
        Charge, Bomb
    }

    /// <summary>One timed step of a VFX recipe. t0..t1 are normalised skill time; the evaluator hands the primitive u = progress
    /// inside its window. Offsets are in the hero's local frame (x right, y up, z forward).</summary>
    public class VfxStep
    {
        public Vk kind; public PaletteRole role = PaletteRole.Primary; public float t0, t1 = 1;
        public Anchor from = Anchor.Root, to = Anchor.Aim; public Vector3 off, offTo;
        public float size = 1, size2, angle = 60, count = 1, tilt, linger; public int seed = 1; public StFx.Shape shape = StFx.Shape.Circle;
        public VfxStep(Vk k, float a, float b) { kind = k; t0 = a; t1 = b; }
        public VfxStep R(PaletteRole r) { role = r; return this; }
        public VfxStep F(Anchor a, Vector3 o = default) { from = a; off = o; return this; }
        public VfxStep T(Anchor a, Vector3 o = default) { to = a; offTo = o; return this; }
        public VfxStep S(float s, float s2 = 0) { size = s; size2 = s2; return this; }
        public VfxStep N(float n, int sd = 1) { count = n; seed = sd; return this; }
        public VfxStep A(float ang) { angle = ang; return this; }
        public VfxStep Sh(StFx.Shape s) { shape = s; return this; }
        public VfxStep Tl(float deg) { tilt = deg; return this; }
        public VfxStep L(float l) { linger = l; return this; }
    }

    public class VfxDef
    {
        public string id; public readonly List<VfxStep> steps = new List<VfxStep>();
        public VfxDef(string i, params VfxStep[] s) { id = i; steps.AddRange(s); }
    }

    public enum EffectKind { Damage, Heal, Status, Knockback, Dash, Shield, Buff, Summon }
    public enum Status { None, Slow, Stun, Burn, Freeze, Root, Fear, Mark }

    /// <summary>Gameplay step, applied by StSkillRunner at normalised time 'at' to every foe inside the skill's shape.</summary>
    public class EffectStep
    {
        public EffectKind kind; public float at, amount, duration; public Status status;
        public static EffectStep Dmg(float at, float amt) => new EffectStep { kind = EffectKind.Damage, at = at, amount = amt };
        public static EffectStep Heal(float at, float amt) => new EffectStep { kind = EffectKind.Heal, at = at, amount = amt };
        public static EffectStep St(float at, Status s, float dur) => new EffectStep { kind = EffectKind.Status, at = at, status = s, duration = dur };
        public static EffectStep Push(float at, float m) => new EffectStep { kind = EffectKind.Knockback, at = at, amount = m };
        public static EffectStep Shld(float at, float amt, float dur) => new EffectStep { kind = EffectKind.Shield, at = at, amount = amt, duration = dur };
        public static EffectStep Buf(float at, float amt, float dur) => new EffectStep { kind = EffectKind.Buff, at = at, amount = amt, duration = dur };
    }

    public class TelegraphDef
    {
        public StFx.Shape shape = StFx.Shape.Circle; public float size = 3, width = 1.4f, angle = 60, inner = 0.5f;
        public bool atAim; // centred on the aim point (else on the hero)
    }

    public class SkillDef
    {
        public string id, name, desc, cls, subclass, replaces, anim = "Attack", sfx, iconKey;
        public int icon = -1; // owned icon index (sk4_<n>), -1 = procedural only
        public SlotType slot = SlotType.Active; public Targeting targeting = Targeting.Auto;
        public int unlockLevel = 1; public float cooldown = 6, cost = 10, duration = 1.0f, range = 6f;
        public TelegraphDef telegraph; public VfxDef vfx; public readonly List<EffectStep> effects = new List<EffectStep>();
        public Palette? palettePin; // a skill that keeps its own element regardless of subclass (Frost Nova)
        public string Glyph; // procedural icon glyph key (fallback)
        public bool IsSub => !string.IsNullOrEmpty(subclass);
    }

    public class SubclassDef
    {
        public string id, cls, name, theme, skin; public bool playable; public Palette palette;
        public readonly List<string> skillIds = new List<string>();
    }

    public class ClassDef
    {
        public string id, name, blurb; public Palette palette; public string basic; public readonly List<string> actives = new List<string>();
        public string ultimate, passive; public System.Func<StLook> look;
    }

    /// <summary>Per-rig animation key map (model-agnostic): skills say "Spin", the KayKit rig plays Melee_2H_Attack_Spin.
    /// A different hero rig supplies its own map.</summary>
    public static class AnimMap
    {
        public static readonly Dictionary<string, string> KayKit = new Dictionary<string, string>
        {
            { "Slash", "Melee_1H_Attack_Chop" }, { "SlashH", "Melee_1H_Attack_Slice_Horizontal" }, { "Stab", "Melee_1H_Attack_Stab" },
            { "Spin", "Melee_2H_Attack_Spin" }, { "Bash", "Melee_Block_Attack" }, { "Block", "Melee_Blocking" }, { "JumpChop", "Melee_1H_Attack_Jump_Chop" },
            { "Slam", "Melee_2H_Attack_Chop" }, { "Shoot", "Ranged_Bow_Release" }, { "Draw", "Ranged_Bow_Draw" }, { "ShootUp", "Ranged_Bow_Release_Up" },
            { "DrawUp", "Ranged_Bow_Draw_Up" }, { "Aim", "Ranged_Bow_Aiming_Idle" }, { "Bolt", "Ranged_Magic_Shoot" }, { "Summon", "Ranged_Magic_Summon" },
            { "Cast", "Ranged_Magic_Spellcasting" }, { "CastLong", "Ranged_Magic_Spellcasting_Long" }, { "Raise", "Ranged_Magic_Raise" },
            { "DodgeBack", "Dodge_Backward" }, { "DodgeFwd", "Dodge_Forward" }, { "Throw", "Throw" }, { "Use", "Use_Item" }, { "Interact", "Interact" },
            { "Idle", "Idle_A" }, { "Hit", "Hit_A" },
        };
        public static string Clip(string key) => KayKit.TryGetValue(key, out var c) ? c : key;
    }

    /// <summary>Basic + 4 actives + ultimate + 1 passive (phase-5 prototype: one passive slot; 2nd stays data-only).</summary>
    public class Loadout
    {
        public string basic, ultimate, passive; public readonly string[] actives = new string[4];
        public string subclass; public string cls;
        public Palette Palette => StSkillDb.PaletteFor(cls, subclass);
        public IEnumerable<string> All() { yield return basic; foreach (var a in actives) yield return a; yield return ultimate; yield return passive; }
        public Loadout Clone() { var a = new Loadout { basic = basic, ultimate = ultimate, passive = passive, subclass = subclass, cls = cls }; for (int i = 0; i < 4; i++) a.actives[i] = actives[i]; return a; }
        public static Loadout Default(string cls, string sub = null)
        {
            var c = StSkillDb.Classes[cls]; var l = new Loadout { cls = cls, subclass = sub, basic = c.basic, ultimate = c.ultimate, passive = c.passive };
            for (int i = 0; i < 4; i++) l.actives[i] = c.actives[i];
            if (sub != null && StSkillDb.Subclasses.TryGetValue(sub, out var sd))
            {
                // subclass actives take the last slots; a subclass ultimate replaces the base one
                int k = 3;
                foreach (var id in sd.skillIds)
                {
                    var s = StSkillDb.Skills[id];
                    if (s.slot == SlotType.Ultimate) l.ultimate = id;
                    else if (s.slot == SlotType.Active && k >= 1) l.actives[k--] = id;
                }
            }
            return l;
        }
    }
}
