using System.Collections.Generic;
using UnityEngine;
using P = Hollowmere.StyleTest.Skills.PaletteRole;

namespace Hollowmere.StyleTest.Skills
{
    /// <summary>Static skill / subclass / class tables for the phase-5 prototype (skills_subclasses.md section 6 scope):
    /// 3 classes x 7 base skills + 3 playable subclasses x 3 skills = 30 skills. The 12 other subclasses are locked cards.</summary>
    public static class StSkillDb
    {
        public static readonly Dictionary<string, SkillDef> Skills = new Dictionary<string, SkillDef>();
        public static readonly Dictionary<string, SubclassDef> Subclasses = new Dictionary<string, SubclassDef>();
        public static readonly List<SubclassDef> SubclassOrder = new List<SubclassDef>();
        public static readonly Dictionary<string, ClassDef> Classes = new Dictionary<string, ClassDef>();
        public static readonly List<SkillDef> Order = new List<SkillDef>();

        static Color C(float r, float g, float b) => new Color(r, g, b, 1);

        // ---- palettes (HDR primaries; Ldr() for UI swatches) ----
        public static readonly Palette KnightPal = new Palette("Steel", C(1.6f, 1.35f, 0.7f), C(0.45f, 0.75f, 1.4f), C(2f, 1.8f, 1.1f), C(0.22f, 0.22f, 0.28f));
        public static readonly Palette RangerPal = new Palette("Woodland", C(0.6f, 1.5f, 0.5f), C(1.5f, 1.05f, 0.35f), C(1.1f, 2f, 0.8f), C(0.2f, 0.25f, 0.12f));
        public static readonly Palette MagePal = new Palette("Arcane", C(1.2f, 0.55f, 2.0f), C(0.45f, 0.7f, 2.0f), C(1.7f, 1.3f, 2.3f), C(0.15f, 0.1f, 0.3f));
        public static readonly Palette FrostPal = new Palette("Frost", C(0.5f, 1.1f, 2.0f), C(0.75f, 1.2f, 1.9f), C(1.6f, 1.9f, 2.3f), C(0.1f, 0.18f, 0.35f));

        static SkillDef Add(SkillDef s) { Skills[s.id] = s; Order.Add(s); return s; }
        static VfxStep V(Vk k, float a, float b) => new VfxStep(k, a, b);
        static Vector3 L(float x, float y, float z) => new Vector3(x, y, z);

        public static Palette PaletteFor(string cls, string sub)
        {
            if (!string.IsNullOrEmpty(sub) && Subclasses.TryGetValue(sub, out var s)) return s.palette;
            return Classes.TryGetValue(cls ?? "", out var c) ? c.palette : KnightPal;
        }

        public static IEnumerable<SkillDef> Known(string cls, string sub)
        {
            foreach (var s in Order) if (s.cls == cls && (!s.IsSub || s.subclass == sub)) yield return s;
        }

        static StSkillDb()
        {
            // ======================================== KNIGHT ========================================
            Add(new SkillDef { id = "k_slash", name = "Slash", cls = "knight", slot = SlotType.Basic, anim = "Slash", icon = 11, Glyph = "slash", cooldown = 0.6f, cost = 0, duration = 0.8f, range = 2.6f,
                desc = "3-hit combo opener. Fast steel arc in front.",
                vfx = new VfxDef("slash",
                    V(Vk.Slash, 0.28f, 0.55f).F(Anchor.Root, L(0, 1.5f, 0.3f)).S(2.4f, 0.8f).A(170).Tl(35).L(0.3f),
                    V(Vk.Sparks, 0.5f, 0.85f).F(Anchor.Root, L(0, 0.9f, 2.3f)).S(1.4f).N(14)) })
                .effects.Add(EffectStep.Dmg(0.45f, 1));
            var ww = Add(new SkillDef { id = "k_whirlwind", name = "Whirlwind", cls = "knight", anim = "Spin", icon = 21, Glyph = "spin", cooldown = 7, cost = 20, duration = 1.2f, range = 3.2f,
                desc = "Spin with the blade, hitting everything around you.", telegraph = new TelegraphDef { shape = StFx.Shape.Circle, size = 3.2f },
                vfx = new VfxDef("whirlwind",
                    V(Vk.Telegraph, 0, 0.45f).R(P.Telegraph),
                    V(Vk.SpinSlash, 0.3f, 0.85f).F(Anchor.Root, L(0, 1.1f, 0)).S(3.0f, 0.7f).A(540).L(0.15f),
                    V(Vk.SpinSlash, 0.36f, 0.9f).F(Anchor.Root, L(0, 0.6f, 0)).S(2.4f, 0.4f).A(540).R(P.Glow).L(0.1f),
                    V(Vk.Shock, 0.55f, 1f).F(Anchor.Root).S(3.6f)) });
            ww.effects.Add(EffectStep.Dmg(0.5f, 1)); ww.effects.Add(EffectStep.Dmg(0.75f, 1));
            var bash = Add(new SkillDef { id = "k_shield_bash", name = "Shield Bash", cls = "knight", anim = "Bash", icon = 35, Glyph = "shield", cooldown = 6, cost = 15, duration = 1.0f, range = 4.2f,
                desc = "Slam the shield forward: a cone shockwave that stuns.", telegraph = new TelegraphDef { shape = StFx.Shape.Cone, size = 4.2f, angle = 60 },
                vfx = new VfxDef("shield_bash",
                    V(Vk.Telegraph, 0, 0.4f).R(P.Telegraph),
                    V(Vk.Glow, 0.25f, 0.45f).F(Anchor.HandL, L(0, 0, 0.4f)).S(0.3f, 0.85f).R(P.Glow).L(0.15f),
                    V(Vk.ConeWave, 0.38f, 0.75f).F(Anchor.Root, L(0, 0.9f, 0.3f)).S(4.4f, 1.1f).A(64),
                    V(Vk.ConeWave, 0.42f, 0.82f).F(Anchor.Root, L(0, 0.25f, 0.3f)).S(4.0f, 0.7f).A(56).R(P.Glow),
                    V(Vk.Shock, 0.4f, 0.8f).F(Anchor.Root, L(0, 0, 1.4f)).S(2.2f).R(P.White),
                    V(Vk.Sparks, 0.38f, 0.72f).F(Anchor.HandL, L(0, 0, 0.5f)).S(2.0f).N(22, 4),
                    V(Vk.Sparks, 0.45f, 0.85f).F(Anchor.Root, L(0, 0.4f, 3.2f)).S(1.4f).N(12, 8).R(P.Dark),
                    V(Vk.Stars, 0.55f, 1f).F(Anchor.Root, L(0, 2.2f, 3.0f)).S(0.55f).N(4)) });
            bash.effects.Add(EffectStep.Dmg(0.45f, 1)); bash.effects.Add(EffectStep.St(0.45f, Status.Stun, 1.5f)); bash.effects.Add(EffectStep.Push(0.45f, 1.5f));
            Add(new SkillDef { id = "k_charge", name = "Charge", cls = "knight", anim = "Stab", icon = 13, Glyph = "dash", cooldown = 8, cost = 15, duration = 1.0f, range = 6f,
                desc = "Dash along a line, knocking foes aside.", telegraph = new TelegraphDef { shape = StFx.Shape.Line, size = 6f, width = 1.6f },
                vfx = new VfxDef("charge",
                    V(Vk.Telegraph, 0, 0.3f).R(P.Telegraph),
                    V(Vk.Dash, 0.25f, 0.7f).F(Anchor.Root, L(0, 0, 5.2f)).S(1.2f).N(5),
                    V(Vk.ConeWave, 0.55f, 0.85f).F(Anchor.Root, L(0, 1.0f, 5.6f)).S(2.2f, 0.6f).A(100),
                    V(Vk.Sparks, 0.62f, 0.95f).F(Anchor.Root, L(0, 1.0f, 6.0f)).S(1.6f).N(16, 2)) })
                .effects.Add(EffectStep.Push(0.6f, 2.5f));
            Skills["k_charge"].effects.Add(EffectStep.Dmg(0.6f, 1));
            var slam = Add(new SkillDef { id = "k_slam", name = "Ground Slam", cls = "knight", anim = "JumpChop", icon = 26, Glyph = "slam", cooldown = 9, cost = 20, duration = 1.2f, range = 3f,
                desc = "Leap and smash the floor, knocking enemies up.", telegraph = new TelegraphDef { shape = StFx.Shape.Circle, size = 3.0f, atAim = true },
                vfx = new VfxDef("slam",
                    V(Vk.Telegraph, 0, 0.55f).R(P.Telegraph),
                    V(Vk.Slash, 0.35f, 0.55f).F(Anchor.Root, L(0, 1.6f, 0.6f)).S(2.2f, 0.6f).A(120).Tl(90).L(0.15f),
                    V(Vk.Shock, 0.55f, 1f).F(Anchor.Aim).S(4.0f),
                    V(Vk.Shock, 0.6f, 1f).F(Anchor.Aim).S(2.6f).R(P.Glow),
                    V(Vk.Shards, 0.55f, 0.75f).F(Anchor.Aim).S(0.8f, 2.6f).N(9, 3).R(P.Dark).L(0.3f),
                    V(Vk.Sparks, 0.55f, 0.95f).F(Anchor.Aim, L(0, 0.2f, 0)).S(2.6f).N(18, 6).R(P.Dark)) });
            slam.effects.Add(EffectStep.Dmg(0.58f, 2)); slam.effects.Add(EffectStep.St(0.58f, Status.Stun, 1f));
            Add(new SkillDef { id = "k_banner", name = "Valor's Banner", cls = "knight", slot = SlotType.Ultimate, anim = "Slam", icon = 17, Glyph = "banner", cooldown = 30, cost = 0, duration = 2.0f, range = 2.5f, unlockLevel = 10,
                desc = "Plant a war banner: allies near it hit harder; it pulses damage.", telegraph = new TelegraphDef { shape = StFx.Shape.Circle, size = 4.5f, atAim = true },
                vfx = new VfxDef("banner",
                    V(Vk.Telegraph, 0, 0.3f).R(P.Telegraph),
                    V(Vk.Banner, 0.2f, 0.42f).F(Anchor.Aim).S(4.2f).L(0.6f),
                    V(Vk.Shock, 0.42f, 0.7f).F(Anchor.Aim).S(4.8f).R(P.White),
                    V(Vk.RuneRing, 0.42f, 0.6f).F(Anchor.Aim).S(4.5f).A(60).L(0.45f),
                    V(Vk.Pillar, 0.42f, 0.7f).F(Anchor.Aim).S(1.6f, 7f).R(P.Glow).L(0.3f),
                    V(Vk.Shock, 0.7f, 1f).F(Anchor.Aim).S(4.5f),
                    V(Vk.Motes, 0.45f, 1f).F(Anchor.Aim).S(4f, 3.5f).N(26, 2)) })
                .effects.Add(EffectStep.Buf(0.42f, 0.3f, 8f));
            Add(new SkillDef { id = "k_iron_skin", name = "Iron Skin", cls = "knight", slot = SlotType.Passive, anim = "Block", icon = 14, Glyph = "armor", cooldown = 20, cost = 0, duration = 1.2f, range = 0, unlockLevel = 5,
                desc = "Passive: below 50% HP take 25% less damage (a steel shell flashes when it triggers).",
                vfx = new VfxDef("iron_skin",
                    V(Vk.Bubble, 0.1f, 0.4f).F(Anchor.Chest, L(0, -0.1f, 0)).S(1.9f).R(P.Secondary).L(0.55f),
                    V(Vk.Shock, 0.1f, 0.6f).F(Anchor.Root).S(2.6f).R(P.Secondary),
                    V(Vk.Sparks, 0.12f, 0.5f).F(Anchor.Chest).S(1.8f).N(12, 5).R(P.White),
                    V(Vk.RuneRing, 0.1f, 0.4f).F(Anchor.Root).S(1.8f).A(90).R(P.Secondary).L(0.5f)) });

            // ---- Paladin ----
            var cons = Add(new SkillDef { id = "p_consecrate", name = "Consecrate", cls = "knight", subclass = "paladin", anim = "Raise", icon = 3, Glyph = "rune", cooldown = 10, cost = 25, duration = 1.6f, range = 0, unlockLevel = 20,
                desc = "Sanctify the ground: burns foes and heals allies standing in it.", telegraph = new TelegraphDef { shape = StFx.Shape.Circle, size = 4f },
                vfx = new VfxDef("consecrate",
                    V(Vk.Telegraph, 0, 0.3f).R(P.Telegraph),
                    V(Vk.Glow, 0.15f, 0.4f).F(Anchor.HandR).S(0.3f, 0.9f).R(P.Glow).L(0.2f),
                    V(Vk.RuneRing, 0.3f, 0.55f).F(Anchor.Root).S(4f).A(80).L(0.45f),
                    V(Vk.RuneRing, 0.35f, 0.6f).F(Anchor.Root).S(2.6f).A(-120).R(P.Secondary).L(0.4f),
                    V(Vk.Shock, 0.3f, 0.65f).F(Anchor.Root).S(4.4f).R(P.White),
                    V(Vk.Motes, 0.3f, 1f).F(Anchor.Root).S(3.8f, 3.2f).N(34, 4).R(P.Glow)) });
            cons.effects.Add(EffectStep.Dmg(0.5f, 1)); cons.effects.Add(EffectStep.Heal(0.5f, 1));
            var judge = Add(new SkillDef { id = "p_judgement", name = "Judgement", cls = "knight", subclass = "paladin", anim = "Slash", icon = 16, Glyph = "hammer", cooldown = 9, cost = 25, duration = 1.3f, range = 5.5f, unlockLevel = 25,
                desc = "A hammer of light drops from the sky onto the target area.", telegraph = new TelegraphDef { shape = StFx.Shape.Circle, size = 2.4f, atAim = true },
                vfx = new VfxDef("judgement",
                    V(Vk.Telegraph, 0, 0.6f).R(P.Telegraph),
                    V(Vk.Pillar, 0.15f, 0.6f).F(Anchor.Aim).S(0.5f, 9f).R(P.Secondary),
                    V(Vk.Hammer, 0.3f, 0.6f).F(Anchor.Aim).S(1.8f, 8f).L(0.2f),
                    V(Vk.Shock, 0.6f, 1f).F(Anchor.Aim).S(3.6f).R(P.White),
                    V(Vk.Shock, 0.64f, 1f).F(Anchor.Aim).S(2.4f),
                    V(Vk.Pillar, 0.6f, 0.75f).F(Anchor.Aim).S(1.6f, 6f).R(P.Glow).L(0.25f),
                    V(Vk.Sparks, 0.6f, 0.95f).F(Anchor.Aim, L(0, 0.4f, 0)).S(2.6f).N(20, 9).R(P.Glow)) });
            judge.effects.Add(EffectStep.Dmg(0.6f, 3)); judge.effects.Add(EffectStep.St(0.6f, Status.Stun, 1f));
            Add(new SkillDef { id = "p_divine_shield", name = "Divine Shield", cls = "knight", subclass = "paladin", anim = "Block", icon = 10, Glyph = "bubble", cooldown = 18, cost = 30, duration = 1.4f, range = 0, unlockLevel = 30,
                desc = "A golden bubble shields you and nearby allies.", telegraph = new TelegraphDef { shape = StFx.Shape.Circle, size = 3.4f },
                vfx = new VfxDef("divine_shield",
                    V(Vk.Pillar, 0.05f, 0.35f).F(Anchor.Root).S(1.5f, 6f).R(P.Glow),
                    V(Vk.Bubble, 0.2f, 0.45f).F(Anchor.Root, L(0, 0.8f, 0)).S(3.0f).R(P.Primary).L(0.55f),
                    V(Vk.RuneRing, 0.2f, 0.45f).F(Anchor.Root).S(3.1f).A(60).R(P.Secondary).L(0.55f),
                    V(Vk.Shock, 0.2f, 0.6f).F(Anchor.Root).S(3.6f).R(P.White),
                    V(Vk.Motes, 0.3f, 1f).F(Anchor.Root).S(2.8f, 3f).N(20, 7).R(P.Glow)) })
                .effects.Add(EffectStep.Shld(0.3f, 5, 6));

            // ======================================== RANGER ========================================
            Add(new SkillDef { id = "r_quick_shot", name = "Quick Shot", cls = "ranger", slot = SlotType.Basic, anim = "Shoot", icon = 30, Glyph = "arrow", cooldown = 0.5f, cost = 0, duration = 0.8f, range = 7.5f,
                desc = "Fast single arrow at the nearest enemy.",
                vfx = new VfxDef("quick_shot",
                    V(Vk.Glow, 0, 0.25f).F(Anchor.Bow).S(0.35f, 0.2f),
                    V(Vk.Arrow, 0.2f, 0.7f).F(Anchor.Bow).T(Anchor.Aim, L(0, 1.1f, 0)),
                    V(Vk.Sparks, 0.7f, 1f).F(Anchor.Aim, L(0, 1.1f, 0)).S(1.2f).N(12)) })
                .effects.Add(EffectStep.Dmg(0.7f, 1));
            Add(new SkillDef { id = "r_piercing", name = "Piercing Arrow", cls = "ranger", anim = "Draw", icon = 23, Glyph = "pierce", cooldown = 6, cost = 15, duration = 1.1f, range = 8.2f,
                desc = "Charged arrow that passes through every enemy in a line.", telegraph = new TelegraphDef { shape = StFx.Shape.Line, size = 8f, width = 1.3f },
                vfx = new VfxDef("piercing",
                    V(Vk.Telegraph, 0, 0.6f).R(P.Telegraph),
                    V(Vk.Charge, 0, 0.6f).F(Anchor.Bow).S(0.7f).N(10),
                    V(Vk.Arrow, 0.62f, 0.85f).F(Anchor.Bow).T(Anchor.Aim, L(0, 1.1f, 0)).S(1, 1),
                    V(Vk.Beam, 0.62f, 0.85f).F(Anchor.Bow).T(Anchor.Aim, L(0, 1.1f, 0)).S(0.28f).R(P.Glow).L(0.12f),
                    V(Vk.Sparks, 0.85f, 1f).F(Anchor.Aim, L(0, 1.1f, 0)).S(1.3f).N(14)) })
                .effects.Add(EffectStep.Dmg(0.8f, 2));
            Add(new SkillDef { id = "r_volley", name = "Volley", cls = "ranger", anim = "ShootUp", icon = 24, Glyph = "volley", cooldown = 8, cost = 20, duration = 1.3f, range = 6.2f,
                desc = "Loose arrows skyward; they rain on the target circle.", telegraph = new TelegraphDef { shape = StFx.Shape.Circle, size = 2.2f, atAim = true },
                vfx = new VfxDef("volley",
                    V(Vk.Telegraph, 0, 0.7f).R(P.Telegraph),
                    V(Vk.Arrow, 0.2f, 0.45f).F(Anchor.Bow).T(Anchor.Bow, L(0, 4.5f, 1.0f)),
                    V(Vk.ArrowRain, 0.5f, 0.9f).F(Anchor.Aim).S(1.8f, 8f).N(7, 5)) })
                .effects.Add(EffectStep.Dmg(0.8f, 2));
            Add(new SkillDef { id = "r_roll_back", name = "Roll Back", cls = "ranger", anim = "DodgeBack", icon = 2, Glyph = "evade", cooldown = 7, cost = 10, duration = 0.9f, range = 0,
                desc = "Evade and leap backwards; next shot is quicker.", targeting = Targeting.Self,
                vfx = new VfxDef("roll_back",
                    V(Vk.Dash, 0.1f, 0.75f).F(Anchor.Root, L(0, 0, -3.2f)).S(0.9f).N(4).R(P.Primary),
                    V(Vk.Sparks, 0.1f, 0.5f).F(Anchor.Root, L(0, 0.2f, 0)).S(1.6f).N(12, 3).R(P.Dark),
                    V(Vk.Shock, 0.1f, 0.5f).F(Anchor.Root).S(2f).R(P.Secondary),
                    V(Vk.Motes, 0.2f, 1f).F(Anchor.Root, L(0, 0, -2f)).S(2.4f, 2f).N(16, 6)) });
            var multi = Add(new SkillDef { id = "r_multishot", name = "Multishot", cls = "ranger", anim = "Shoot", icon = 31, Glyph = "fan", cooldown = 7, cost = 15, duration = 0.9f, range = 7f,
                desc = "Five arrows in a cone.", telegraph = new TelegraphDef { shape = StFx.Shape.Cone, size = 7f, angle = 50 },
                vfx = new VfxDef("multishot",
                    V(Vk.Telegraph, 0, 0.3f).R(P.Telegraph),
                    V(Vk.Glow, 0.15f, 0.3f).F(Anchor.Bow).S(0.4f, 0.8f).R(P.Glow).L(0.1f),
                    V(Vk.ArrowFan, 0.25f, 0.75f).F(Anchor.Bow).S(7f).N(5).A(46),
                    V(Vk.Sparks, 0.72f, 1f).F(Anchor.Aim, L(0, 1.0f, 0)).S(1.0f).N(8, 2)) });
            multi.effects.Add(EffectStep.Dmg(0.6f, 1));
            Add(new SkillDef { id = "r_rain", name = "Rain of Arrows", cls = "ranger", slot = SlotType.Ultimate, anim = "ShootUp", icon = 33, Glyph = "rain", cooldown = 30, cost = 0, duration = 2.2f, range = 6.5f, unlockLevel = 10,
                desc = "A lingering storm of arrows over a large circle.", telegraph = new TelegraphDef { shape = StFx.Shape.Circle, size = 4.2f, atAim = true },
                vfx = new VfxDef("rain",
                    V(Vk.Telegraph, 0, 0.3f).R(P.Telegraph),
                    V(Vk.Arrow, 0.08f, 0.25f).F(Anchor.Bow).T(Anchor.Bow, L(0, 4.5f, 0.6f)),
                    V(Vk.RuneRing, 0.25f, 0.4f).F(Anchor.Aim).S(4.2f).A(25).R(P.Secondary).L(0.55f),
                    V(Vk.ArrowRain, 0.25f, 0.95f).F(Anchor.Aim).S(3.8f, 9f).N(26, 11),
                    V(Vk.Shock, 0.3f, 0.6f).F(Anchor.Aim).S(4.5f).R(P.Secondary)) })
                .effects.Add(EffectStep.Dmg(0.5f, 3));
            Add(new SkillDef { id = "r_eagle_eye", name = "Eagle Eye", cls = "ranger", slot = SlotType.Passive, anim = "Aim", icon = 20, Glyph = "eye", cooldown = 0, cost = 0, duration = 1.2f, range = 0, unlockLevel = 5,
                desc = "Passive: +20% range and +10% crit (a hunter's ring shows the reach).",
                vfx = new VfxDef("eagle_eye",
                    V(Vk.RuneRing, 0.05f, 0.4f).F(Anchor.Root).S(3.4f).A(30).R(P.Secondary).L(0.55f),
                    V(Vk.Reticle, 0.1f, 0.5f).F(Anchor.Root, L(0, 0.1f, 3.4f)).S(0.7f).L(0.5f),
                    V(Vk.Glow, 0.1f, 0.4f).F(Anchor.Bow).S(0.3f, 0.6f).R(P.Glow).L(0.5f),
                    V(Vk.Motes, 0.1f, 1f).F(Anchor.Root).S(1.4f, 3.2f).N(12, 3)) });

            // ---- Sharpshooter ----
            var snipe = Add(new SkillDef { id = "s_snipe", name = "Snipe", cls = "ranger", subclass = "sharpshooter", anim = "Draw", icon = 22, Glyph = "snipe", cooldown = 9, cost = 25, duration = 1.4f, range = 13f, unlockLevel = 20,
                desc = "Long charged shot down a narrow line. Huge crit chance.", telegraph = new TelegraphDef { shape = StFx.Shape.Line, size = 13f, width = 0.8f },
                vfx = new VfxDef("snipe",
                    V(Vk.Telegraph, 0, 0.65f).R(P.Telegraph),
                    V(Vk.Charge, 0, 0.65f).F(Anchor.Bow).S(1.2f).N(16, 3).R(P.Glow),
                    V(Vk.Beam, 0.0f, 0.65f).F(Anchor.Bow).T(Anchor.Aim, L(0, 1.1f, 0)).S(0.04f).R(P.Primary),
                    V(Vk.Arrow, 0.66f, 0.8f).F(Anchor.Bow).T(Anchor.Aim, L(0, 1.1f, 0)).S(1.2f, 1),
                    V(Vk.Beam, 0.66f, 0.78f).F(Anchor.Bow).T(Anchor.Aim, L(0, 1.1f, 0)).S(0.34f).R(P.Glow).L(0.18f),
                    V(Vk.Shock, 0.78f, 1f).F(Anchor.Aim).S(2.4f),
                    V(Vk.Sparks, 0.78f, 1f).F(Anchor.Aim, L(0, 1.1f, 0)).S(2f).N(18, 4).R(P.Glow)) });
            snipe.effects.Add(EffectStep.Dmg(0.75f, 4));
            Add(new SkillDef { id = "s_death_mark", name = "Death Mark", cls = "ranger", subclass = "sharpshooter", anim = "Aim", icon = 34, Glyph = "mark", cooldown = 12, cost = 20, duration = 1.2f, range = 7f, unlockLevel = 25,
                desc = "Mark a target: it takes +30% damage and can't hide.",
                vfx = new VfxDef("death_mark",
                    V(Vk.Glow, 0.0f, 0.35f).F(Anchor.Bow).S(0.2f, 0.5f).R(P.Glow).L(0.15f),
                    V(Vk.Beam, 0.1f, 0.35f).F(Anchor.Bow).T(Anchor.Aim, L(0, 1.4f, 0)).S(0.05f).R(P.Primary).L(0.2f),
                    V(Vk.Reticle, 0.2f, 0.55f).F(Anchor.Aim, L(0, 0.08f, 0)).S(1.4f).L(0.45f),
                    V(Vk.Pillar, 0.3f, 0.6f).F(Anchor.Aim).S(0.6f, 4.5f).R(P.Primary).L(0.4f),
                    V(Vk.Stars, 0.4f, 1f).F(Anchor.Aim, L(0, 3.4f, 0)).S(0.2f).N(1)) })
                .effects.Add(EffectStep.St(0.4f, Status.Mark, 8));
            var dead = Add(new SkillDef { id = "s_deadeye", name = "Deadeye", cls = "ranger", subclass = "sharpshooter", slot = SlotType.Ultimate, anim = "Draw", icon = 12, Glyph = "deadeye", cooldown = 35, cost = 0, duration = 2.2f, range = 9.5f, unlockLevel = 40,
                desc = "Time slows; three perfect shots hit every marked enemy.", telegraph = new TelegraphDef { shape = StFx.Shape.Line, size = 9.5f, width = 1.2f },
                vfx = new VfxDef("deadeye",
                    V(Vk.RuneRing, 0.0f, 0.2f).F(Anchor.Root).S(2.2f).A(120).R(P.Primary).L(0.8f),
                    V(Vk.Charge, 0.0f, 0.3f).F(Anchor.Bow).S(1.0f).N(14, 2).R(P.Glow),
                    V(Vk.Reticle, 0.1f, 0.3f).F(Anchor.Aim, L(-1.6f, 0.08f, -1f)).S(0.8f).L(0.6f),
                    V(Vk.Reticle, 0.12f, 0.32f).F(Anchor.Aim, L(0, 0.08f, 0)).S(0.8f).L(0.6f),
                    V(Vk.Reticle, 0.14f, 0.34f).F(Anchor.Aim, L(1.8f, 0.08f, 1.2f)).S(0.8f).L(0.6f),
                    V(Vk.Beam, 0.32f, 0.42f).F(Anchor.Bow).T(Anchor.Aim, L(-1.6f, 1.1f, -1f)).S(0.26f).R(P.Glow).L(0.12f),
                    V(Vk.Beam, 0.5f, 0.6f).F(Anchor.Bow).T(Anchor.Aim, L(0, 1.1f, 0)).S(0.26f).R(P.Glow).L(0.12f),
                    V(Vk.Beam, 0.68f, 0.78f).F(Anchor.Bow).T(Anchor.Aim, L(1.8f, 1.1f, 1.2f)).S(0.26f).R(P.Glow).L(0.12f),
                    V(Vk.Sparks, 0.42f, 0.7f).F(Anchor.Aim, L(-1.6f, 1.1f, -1f)).S(1.5f).N(12, 1).R(P.Glow),
                    V(Vk.Sparks, 0.6f, 0.88f).F(Anchor.Aim, L(0, 1.1f, 0)).S(1.5f).N(12, 2).R(P.Glow),
                    V(Vk.Sparks, 0.78f, 1f).F(Anchor.Aim, L(1.8f, 1.1f, 1.2f)).S(1.5f).N(12, 3).R(P.Glow)) });
            dead.effects.Add(EffectStep.Dmg(0.4f, 3)); dead.effects.Add(EffectStep.Dmg(0.58f, 3)); dead.effects.Add(EffectStep.Dmg(0.76f, 3));

            // ======================================== MAGE ========================================
            Add(new SkillDef { id = "m_bolt", name = "Bolt", cls = "mage", slot = SlotType.Basic, anim = "Bolt", icon = 27, Glyph = "orb", cooldown = 0.6f, cost = 0, duration = 0.8f, range = 7.5f,
                desc = "Basic spell bolt. Its element follows the subclass (Fire Wizard: Fireball, burns).",
                vfx = new VfxDef("bolt",
                    V(Vk.Glow, 0, 0.32f).F(Anchor.WeaponTip).S(0.3f, 0.7f),
                    V(Vk.Orb, 0.3f, 0.75f).F(Anchor.WeaponTip).T(Anchor.Aim, L(0, 1.2f, 0)).S(0.35f),
                    V(Vk.Sparks, 0.75f, 1f).F(Anchor.Aim, L(0, 1.2f, 0)).S(1.8f).N(14),
                    V(Vk.Glow, 0.75f, 1f).F(Anchor.Aim, L(0, 1.2f, 0)).S(1.4f, 0.2f).L(0)) })
                .effects.Add(EffectStep.Dmg(0.75f, 1));
            var met = Add(new SkillDef { id = "m_meteor", name = "Meteor", cls = "mage", anim = "Summon", icon = 1, Glyph = "meteor", cooldown = 10, cost = 30, duration = 1.5f, range = 6f,
                desc = "After a delay a meteor crashes into the circle.", telegraph = new TelegraphDef { shape = StFx.Shape.Circle, size = 2.8f, atAim = true },
                vfx = new VfxDef("meteor",
                    V(Vk.Telegraph, 0, 0.78f).R(P.Telegraph),
                    V(Vk.Glow, 0, 0.6f).F(Anchor.WeaponTip).S(0.25f, 0.55f).L(0.2f),
                    V(Vk.Meteor, 0.4f, 0.8f).F(Anchor.Aim).S(0.7f, 6.5f),
                    V(Vk.Scorch, 0.8f, 0.85f).F(Anchor.Aim).S(2.4f).R(P.Dark).L(0.15f),
                    V(Vk.Shock, 0.8f, 1f).F(Anchor.Aim).S(4.0f),
                    V(Vk.Sparks, 0.8f, 1f).F(Anchor.Aim, L(0, 0.3f, 0)).S(2.6f).N(20),
                    V(Vk.Glow, 0.8f, 1f).F(Anchor.Aim, L(0, 0.8f, 0)).S(1.5f, 0.1f).R(P.Primary)) });
            met.effects.Add(EffectStep.Dmg(0.8f, 3));
            var nova = Add(new SkillDef { id = "m_frost_nova", name = "Frost Nova", cls = "mage", anim = "Cast", icon = 28, Glyph = "nova", cooldown = 9, cost = 25, duration = 1.2f, range = 0, palettePin = FrostPal,
                desc = "Ring of frost around you; enemies are slowed.", telegraph = new TelegraphDef { shape = StFx.Shape.Ring, size = 4.2f, inner = 0.35f },
                vfx = new VfxDef("frost_nova",
                    V(Vk.Telegraph, 0, 0.55f).R(P.Telegraph),
                    V(Vk.Glow, 0, 0.6f).F(Anchor.HandR).S(0.45f, 0.1f),
                    V(Vk.Shock, 0.55f, 1f).F(Anchor.Root).S(4.4f),
                    V(Vk.Shock, 0.62f, 1f).F(Anchor.Root).S(3.2f).R(P.Secondary),
                    V(Vk.Shards, 0.55f, 1f).F(Anchor.Root).S(1.5f, 4.1f).N(10, 9).R(P.Secondary)) });
            nova.effects.Add(EffectStep.Dmg(0.6f, 1)); nova.effects.Add(EffectStep.St(0.6f, Status.Slow, 3));
            Add(new SkillDef { id = "m_blink", name = "Blink", cls = "mage", anim = "Raise", icon = 3, Glyph = "blink", cooldown = 8, cost = 15, duration = 0.9f, range = 5f, targeting = Targeting.Aim,
                desc = "Teleport a short distance (Fire Wizard: leaves a fire trail).", telegraph = new TelegraphDef { shape = StFx.Shape.Line, size = 5f, width = 1.0f },
                vfx = new VfxDef("blink",
                    V(Vk.Telegraph, 0, 0.35f).R(P.Telegraph),
                    V(Vk.RuneRing, 0.0f, 0.4f).F(Anchor.Root).S(1.6f).A(200).L(0.15f),
                    V(Vk.Blink, 0.3f, 0.6f).F(Anchor.Root, L(0, 0, 5f)).S(1.0f),
                    V(Vk.Shock, 0.5f, 0.9f).F(Anchor.Root, L(0, 0, 5f)).S(2.2f),
                    V(Vk.Sparks, 0.45f, 0.85f).F(Anchor.Root, L(0, 1.2f, 0)).S(1.5f).N(12, 2).R(P.Glow),
                    V(Vk.Sparks, 0.5f, 0.9f).F(Anchor.Root, L(0, 1.2f, 5f)).S(1.5f).N(12, 7)) });
            var chain = Add(new SkillDef { id = "m_chain_spark", name = "Chain Spark", cls = "mage", anim = "Bolt", icon = 18, Glyph = "chain", cooldown = 7, cost = 20, duration = 1.0f, range = 5.5f,
                desc = "Lightning that jumps between 3 enemies.",
                vfx = new VfxDef("chain_spark",
                    V(Vk.Glow, 0, 0.3f).F(Anchor.WeaponTip).S(0.2f, 0.6f).R(P.Glow).L(0.2f),
                    V(Vk.Lightning, 0.3f, 0.75f).F(Anchor.WeaponTip).T(Anchor.Aim, L(0, 1.2f, 0)).S(0.18f).N(3, 4).L(0.15f),
                    V(Vk.Sparks, 0.35f, 0.7f).F(Anchor.Aim, L(0, 1.2f, 0)).S(1.2f).N(10, 1).R(P.Glow),
                    V(Vk.Sparks, 0.45f, 0.8f).F(Anchor.Aim, L(2.2f, 1.2f, 1.6f)).S(1.2f).N(10, 2).R(P.Glow),
                    V(Vk.Sparks, 0.55f, 0.9f).F(Anchor.Aim, L(-1.8f, 1.2f, 2.6f)).S(1.2f).N(10, 3).R(P.Glow)) });
            chain.effects.Add(EffectStep.Dmg(0.4f, 1));
            var storm = Add(new SkillDef { id = "m_storm", name = "Elemental Storm", cls = "mage", slot = SlotType.Ultimate, anim = "CastLong", icon = 32, Glyph = "storm", cooldown = 40, cost = 0, duration = 2.4f, range = 6f, unlockLevel = 10,
                desc = "A storm that rages over the area for 6 s.", telegraph = new TelegraphDef { shape = StFx.Shape.Circle, size = 4.6f, atAim = true },
                vfx = new VfxDef("storm",
                    V(Vk.Telegraph, 0, 0.25f).R(P.Telegraph),
                    V(Vk.Glow, 0, 0.3f).F(Anchor.WeaponTip).S(0.3f, 0.8f).L(0.2f),
                    V(Vk.Clouds, 0.1f, 0.3f).F(Anchor.Aim).S(4.6f, 6.5f).N(9, 2).R(P.Dark).L(0.7f),
                    V(Vk.RuneRing, 0.2f, 0.35f).F(Anchor.Aim).S(4.6f).A(40).L(0.65f),
                    V(Vk.Lightning, 0.3f, 1f).F(Anchor.Aim, L(0, 6.5f, 0)).T(Anchor.Aim).S(0.2f, 4.2f).N(6, 5).R(P.Glow),
                    V(Vk.Motes, 0.25f, 1f).F(Anchor.Aim).S(4.4f, 5f).N(30, 8).R(P.Secondary),
                    V(Vk.Shock, 0.3f, 0.6f).F(Anchor.Aim).S(5f)) });
            storm.effects.Add(EffectStep.Dmg(0.4f, 1)); storm.effects.Add(EffectStep.Dmg(0.6f, 1)); storm.effects.Add(EffectStep.Dmg(0.8f, 1));
            Add(new SkillDef { id = "m_mana_flow", name = "Mana Flow", cls = "mage", slot = SlotType.Passive, anim = "Idle", icon = 36, Glyph = "flow", cooldown = 0, cost = 0, duration = 1.4f, range = 0, unlockLevel = 5,
                desc = "Passive: +50% mana regeneration (mana motes spiral up while it ticks).",
                vfx = new VfxDef("mana_flow",
                    V(Vk.RuneRing, 0, 0.3f).F(Anchor.Root).S(1.7f).A(140).R(P.Secondary).L(0.7f),
                    V(Vk.Motes, 0, 1f).F(Anchor.Root).S(1.3f, 3.6f).N(26, 4).R(P.Secondary),
                    V(Vk.Glow, 0.2f, 0.6f).F(Anchor.Chest).S(0.6f, 0.9f).R(P.Secondary).L(0.4f)) });

            // ---- Fire Wizard ----
            var wave = Add(new SkillDef { id = "f_flame_wave", name = "Flame Wave", cls = "mage", subclass = "fire_wizard", anim = "Cast", icon = 29, Glyph = "flame", cooldown = 8, cost = 25, duration = 1.2f, range = 5.5f, unlockLevel = 20,
                desc = "A wall of fire rolls forward in a cone and sets enemies burning.", telegraph = new TelegraphDef { shape = StFx.Shape.Cone, size = 5.5f, angle = 70 },
                vfx = new VfxDef("flame_wave",
                    V(Vk.Telegraph, 0, 0.4f).R(P.Telegraph),
                    V(Vk.Glow, 0.1f, 0.4f).F(Anchor.HandR).S(0.3f, 0.8f).R(P.Glow).L(0.2f),
                    V(Vk.Flames, 0.35f, 0.9f).F(Anchor.Root, L(0, 0, 0.6f)).S(5.4f, 2.6f).N(9, 2).A(70),
                    V(Vk.ConeWave, 0.35f, 0.9f).F(Anchor.Root, L(0, 0.15f, 0.6f)).S(5.4f, 0.8f).A(72).R(P.Secondary),
                    V(Vk.Scorch, 0.5f, 0.9f).F(Anchor.Root, L(0, 0, 3f)).S(2.4f).R(P.Dark).L(0.1f)) });
            wave.effects.Add(EffectStep.Dmg(0.55f, 2)); wave.effects.Add(EffectStep.St(0.55f, Status.Burn, 3));
            var bomb = Add(new SkillDef { id = "f_living_bomb", name = "Living Bomb", cls = "mage", subclass = "fire_wizard", anim = "Bolt", icon = 25, Glyph = "bomb", cooldown = 10, cost = 25, duration = 1.8f, range = 6f, unlockLevel = 25,
                desc = "Plant a fire seed on a target; it detonates after 3 s and spreads.", telegraph = new TelegraphDef { shape = StFx.Shape.Circle, size = 2.6f, atAim = true },
                vfx = new VfxDef("living_bomb",
                    V(Vk.Orb, 0.15f, 0.35f).F(Anchor.WeaponTip).T(Anchor.Aim, L(0, 1.3f, 0)).S(0.3f),
                    V(Vk.Bomb, 0.35f, 0.75f).F(Anchor.Aim, L(0, 1.3f, 0)).S(0.5f, 2.6f),
                    V(Vk.Glow, 0.75f, 0.95f).F(Anchor.Aim, L(0, 1.2f, 0)).S(2.2f, 0.2f).R(P.Primary),
                    V(Vk.Shock, 0.75f, 1f).F(Anchor.Aim).S(3.2f),
                    V(Vk.Sparks, 0.75f, 1f).F(Anchor.Aim, L(0, 1.2f, 0)).S(2.8f).N(24, 3),
                    V(Vk.Scorch, 0.75f, 0.8f).F(Anchor.Aim).S(2f).R(P.Dark).L(0.2f)) });
            bomb.effects.Add(EffectStep.Dmg(0.78f, 3)); bomb.effects.Add(EffectStep.St(0.78f, Status.Burn, 3));
            var inf = Add(new SkillDef { id = "f_inferno", name = "Inferno", cls = "mage", subclass = "fire_wizard", slot = SlotType.Ultimate, anim = "CastLong", icon = 19, Glyph = "inferno", cooldown = 40, cost = 0, duration = 2.4f, range = 5.5f, unlockLevel = 40,
                desc = "A ring of fire erupts around the target area and burns for 6 s.", telegraph = new TelegraphDef { shape = StFx.Shape.Circle, size = 4.2f, atAim = true },
                vfx = new VfxDef("inferno",
                    V(Vk.Telegraph, 0, 0.25f).R(P.Telegraph),
                    V(Vk.Glow, 0, 0.3f).F(Anchor.WeaponTip).S(0.3f, 0.9f).L(0.2f),
                    V(Vk.Scorch, 0.2f, 0.35f).F(Anchor.Aim).S(4.4f).R(P.Dark).L(0.65f),
                    V(Vk.FlameRing, 0.2f, 0.45f).F(Anchor.Aim).S(4.2f, 3.0f).N(22, 3).L(0.55f),
                    V(Vk.Pillar, 0.3f, 0.6f).F(Anchor.Aim).S(1.6f, 6f).R(P.Primary).L(0.4f),
                    V(Vk.Flames, 0.35f, 1f).F(Anchor.Aim).S(2.8f, 2.4f).N(12, 5).A(360),
                    V(Vk.Motes, 0.25f, 1f).F(Anchor.Aim).S(4f, 6f).N(36, 2).R(P.Glow),
                    V(Vk.Shock, 0.25f, 0.6f).F(Anchor.Aim).S(5f)) });
            inf.effects.Add(EffectStep.Dmg(0.4f, 2)); inf.effects.Add(EffectStep.Dmg(0.7f, 2)); inf.effects.Add(EffectStep.St(0.4f, Status.Burn, 6));

            // ======================================== CLASSES ========================================
            Classes["knight"] = Cls("knight", "Knight", "Sword & shield. Holds the line.", KnightPal, StLook.Knight, "k_slash", "k_banner", "k_iron_skin", "k_whirlwind", "k_shield_bash", "k_charge", "k_slam");
            Classes["ranger"] = Cls("ranger", "Ranger", "Bow. Strikes from range.", RangerPal, StLook.Ranger, "r_quick_shot", "r_rain", "r_eagle_eye", "r_piercing", "r_volley", "r_roll_back", "r_multishot");
            Classes["mage"] = Cls("mage", "Mage", "Staff. Bends the elements.", MagePal, StLook.Mage, "m_bolt", "m_storm", "m_mana_flow", "m_meteor", "m_frost_nova", "m_blink", "m_chain_spark");

            // ======================================== SUBCLASSES (15) ========================================
            Sub("knight", "paladin", "Paladin", "Holy tank / healer", true, new Palette("Holy", C(2.0f, 1.6f, 0.55f), C(0.55f, 0.9f, 1.7f), C(2.3f, 2.1f, 1.5f), C(0.55f, 0.45f, 0.25f)), "p_consecrate", "p_judgement", "p_divine_shield");
            Sub("knight", "berserker", "Berserker", "Rage damage", false, new Palette("Blood", C(1.8f, 0.2f, 0.15f), C(1.8f, 0.6f, 0.15f), C(2f, 0.7f, 0.3f), C(0.08f, 0.05f, 0.05f)));
            Sub("knight", "guardian", "Guardian", "Pure tank", false, new Palette("Bulwark", C(0.5f, 0.75f, 1.3f), C(1.3f, 1.35f, 1.4f), C(1.4f, 1.7f, 2f), C(0.15f, 0.2f, 0.3f)));
            Sub("knight", "dark_knight", "Dark Knight", "Shadow lifedrain", false, new Palette("Shadow", C(0.8f, 0.3f, 1.4f), C(0.6f, 1.4f, 0.4f), C(1.2f, 0.7f, 1.8f), C(0.06f, 0.03f, 0.1f)));
            Sub("knight", "warlord", "Warlord", "Party commander", false, new Palette("Banner", C(1.5f, 0.15f, 0.2f), C(1.5f, 1.1f, 0.45f), C(2f, 1.3f, 0.6f), C(0.2f, 0.08f, 0.06f)));
            Sub("ranger", "sharpshooter", "Sharpshooter", "Long-range crits", true, new Palette("Amber", C(2.0f, 1.2f, 0.3f), C(1.7f, 1.7f, 1.65f), C(2.3f, 1.7f, 0.7f), C(0.3f, 0.2f, 0.1f)), "s_snipe", "s_death_mark", "s_deadeye");
            Sub("ranger", "beastmaster", "Beastmaster", "Wolf companion", false, new Palette("Wild", C(0.85f, 0.55f, 0.3f), C(0.5f, 1.0f, 0.35f), C(1.4f, 1.1f, 0.6f), C(0.2f, 0.14f, 0.08f)));
            Sub("ranger", "trapper", "Trapper", "Zone control", false, new Palette("Powder", C(1.8f, 0.7f, 0.15f), C(1.7f, 1.5f, 0.2f), C(2f, 1.4f, 0.4f), C(0.12f, 0.12f, 0.12f)));
            Sub("ranger", "stormcaller", "Stormcaller", "Elemental arrows", false, new Palette("Gale", C(0.3f, 1.4f, 1.3f), C(1.6f, 1.8f, 2f), C(1.2f, 2f, 2f), C(0.08f, 0.2f, 0.22f)));
            Sub("ranger", "shadow_stalker", "Shadow Stalker", "Stealth & poison", false, new Palette("Venom", C(0.75f, 0.3f, 1.2f), C(0.5f, 1.5f, 0.3f), C(1f, 0.6f, 1.6f), C(0.06f, 0.03f, 0.08f)));
            Sub("mage", "ice_wizard", "Ice Wizard", "Freeze & control", false, new Palette("Ice", C(0.6f, 1.4f, 1.8f), C(1.7f, 1.8f, 1.9f), C(1.6f, 2f, 2.3f), C(0.06f, 0.1f, 0.3f)));
            Sub("mage", "fire_wizard", "Fire Wizard", "Burst & burning", true, new Palette("Ember", C(2.0f, 0.8f, 0.2f), C(1.8f, 0.25f, 0.08f), C(2.3f, 1.5f, 0.5f), C(0.12f, 0.08f, 0.07f)), "f_flame_wave", "f_living_bomb", "f_inferno");
            Sub("mage", "lightning_wizard", "Lightning Wizard", "Chains & speed", false, new Palette("Storm", C(1.9f, 1.7f, 0.3f), C(1.4f, 1.2f, 2f), C(2f, 2f, 1.5f), C(0.15f, 0.12f, 0.3f)));
            Sub("mage", "divine_wizard", "Divine Wizard", "Holy heals", false, new Palette("Dawn", C(2f, 1.7f, 0.8f), C(1.8f, 1.1f, 1.2f), C(2.2f, 2f, 1.6f), C(0.4f, 0.32f, 0.25f)));
            Sub("mage", "arcane_wizard", "Arcane Wizard", "Raw mana & time", false, new Palette("Astral", C(1.7f, 0.35f, 1.5f), C(0.35f, 0.45f, 1.6f), C(2f, 1.8f, 2.2f), C(0.05f, 0.05f, 0.2f)));
        }

        static ClassDef Cls(string id, string name, string blurb, Palette pal, System.Func<StLook> look, string basic, string ult, string passive, params string[] actives)
        {
            var c = new ClassDef { id = id, name = name, blurb = blurb, palette = pal, look = look, basic = basic, ultimate = ult, passive = passive };
            c.actives.AddRange(actives); return c;
        }

        static void Sub(string cls, string id, string name, string theme, bool playable, Palette pal, params string[] skills)
        {
            var s = new SubclassDef { id = id, cls = cls, name = name, theme = theme, playable = playable, palette = pal, skin = playable ? id : null };
            s.skillIds.AddRange(skills); Subclasses[id] = s; SubclassOrder.Add(s);
        }
    }
}
