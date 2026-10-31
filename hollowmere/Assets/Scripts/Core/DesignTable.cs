using System;
using System.Globalization;

namespace Hollowmere.Core
{
    /// <summary>
    /// Every tuned figure from DESIGN_SPEC.md. Formulas live here so combat code does not
    /// carry loose literals. Floor depth is the only difficulty.
    /// </summary>
    public static class DesignTable
    {
        public const int MaxLevel = 70;
        public const int LevelCapPlus = 73;

        public const string UnitInterceptText = "-6.008511016257839";
        public const string UnitSlopeText = "10.547001071872975";

        public const decimal GlobeHealFraction = 0.25m;
        public const decimal GlobeNormalChance = 0.08m;
        public const decimal EliteGlobeFirst = 0.75m;
        public const decimal EliteGlobeSecond = 0.50m;
        public const decimal EliteGlobeThird = 0.25m;
        public const decimal PotionHealFraction = 0.60m;
        public const decimal PotionDurationSeconds = 2m;
        public const decimal PotionCooldownSeconds = 20m;

        public const decimal PhaseTwoLife = 0.66m;
        public const decimal PhaseThreeLife = 0.33m;
        public const decimal PhaseTwoCooldownScale = 0.80m;
        public const decimal PhaseThreeDamageScale = 1.25m;
        public const decimal PhaseThreeHazardSeconds = 8m;
        public const decimal PhaseThreeHazardRadius = 2.5m;
        public const decimal PhaseThreeHazardWarn = 1.0m;
        public const decimal LevelUpSeconds = 1.2m;
        public const decimal DeepwroughtChance = 0.10m;
        public const int DeepwroughtFloor = 60;
        public const decimal DeepwroughtScale = 1.3m;
        public const decimal BeamHeight = 3.5m;
        public const decimal LegendarySplit = 0.70m;
        public const decimal SetSplit = 0.30m;

        public const decimal Accel = 28m;
        public const decimal Decel = 36m;
        public const decimal Turn = 540m;
        public const decimal AttackTurn = 900m;
        public const decimal IdleSpeed = 0.15m;
        public const decimal WalkRun = 3.2m;
        public const decimal ClipWalk = 2.2m;
        public const decimal LocoBlend = 0.18m;
        public const decimal AttackBlend = 0.12m;
        public const decimal AttackSeconds = 0.35m;

        public const decimal TrailBack = 1.75m;
        public const decimal TrailSide = 0.55m;
        public const decimal Arrive = 0.45m;
        public const decimal Cruise = 6.2m;
        public const decimal Catchup = 1.1m;
        public const decimal MaxSpeed = 14m;
        public const decimal WarpDistance = 18m;
        public const decimal StuckSeconds = 1.25m;
        public const decimal SampleRadius = 2m;

        public const int QaFrames = 30;
        public const int QaFps = 10;
        public const int QaWidth = 2340;
        public const int QaHeight = 1080;

        public const int BagColumns = 5;
        public const int BagRows = 6;
        public const int BagGap = 0;
        public const int BagCapacity = 30;

        public const int TrailWidth = 60;
        public const int TrailLife = 140;
        public const int TrailHold = 180;

        public static readonly decimal[] EliteGlobeThresholds = { EliteGlobeFirst, EliteGlobeSecond, EliteGlobeThird };

        public readonly struct Rect
        {
            public readonly string Screen, Id;
            public readonly int X, Y, W, H;
            public Rect(string screen, string id, int x, int y, int w, int h)
            {
                Screen = screen; Id = id; X = x; Y = y; W = w; H = h;
            }
        }

        public static readonly Rect[] Ui =
        {
            new Rect("hud", "portrait", 24, 24, 72, 72),
            new Rect("hud", "healthGlobe", 108, 28, 64, 64),
            new Rect("hud", "resourceGlobe", 184, 28, 64, 64),
            new Rect("hud", "xpBar", 108, 100, 360, 16),
            new Rect("hud", "gold", 24, 124, 280, 28),
            new Rect("hud", "buffRow", 24, 160, 400, 36),
            new Rect("hud", "minimap", 2136, 24, 180, 180),
            new Rect("hud", "quest", 1960, 212, 356, 72),
            new Rect("hud", "bossBar", 760, 24, 820, 48),
            new Rect("hud", "targetBar", 890, 80, 560, 36),
            new Rect("hud", "joystick", 24, 896, 160, 160),
            new Rect("hud", "primary", 2220, 960, 96, 96),
            new Rect("hud", "skill1", 2108, 984, 72, 72),
            new Rect("hud", "skill2", 2060, 888, 72, 72),
            new Rect("hud", "skill3", 2148, 808, 72, 72),
            new Rect("hud", "skill4", 2244, 848, 72, 72),
            new Rect("hud", "potion", 1980, 984, 64, 64),
            new Rect("inventory", "screen", 0, 0, 2340, 1080),
            new Rect("inventory", "hero", 300, 110, 1080, 930),
            new Rect("inventory", "header", 600, 40, 480, 80),
            new Rect("inventory", "leftColumn", 90, 110, 220, 880),
            new Rect("inventory", "rightColumn", 1400, 110, 220, 880),
            new Rect("inventory", "bag", 1640, 60, 660, 960),
            new Rect("inventory", "grid", 1690, 210, 560, 700),
            new Rect("inventory", "gridCell", 0, 0, 112, 112),
            new Rect("inventory", "tabs", 1690, 120, 560, 72),
            new Rect("inventory", "bottom", 1690, 930, 560, 64),
            new Rect("inventory", "close", 2214, 40, 96, 96),
            new Rect("inventory", "tooltip", 800, 140, 540, 800),
            new Rect("vendor", "panel", 48, 48, 2244, 984),
            new Rect("vendor", "goods", 72, 120, 900, 760),
            new Rect("vendor", "actions", 72, 900, 900, 80),
            new Rect("vendor", "grid", 1500, 160, 472, 552),
            new Rect("hero", "list", 24, 120, 400, 880),
            new Rect("hero", "stage", 448, 120, 1100, 820),
            new Rect("hero", "info", 1580, 120, 480, 560),
            new Rect("hero", "play", 960, 960, 420, 72),
        };

        public static readonly Rect[] Doll =
        {
            new Rect("doll", "head", 144, 134, 112, 112),
            new Rect("doll", "shoulders", 144, 254, 112, 112),
            new Rect("doll", "chest", 144, 374, 112, 112),
            new Rect("doll", "wrists", 144, 494, 112, 112),
            new Rect("doll", "hands", 144, 614, 112, 112),
            new Rect("doll", "belt", 144, 734, 112, 112),
            new Rect("doll", "legs", 144, 854, 112, 112),
            new Rect("doll", "amulet", 1454, 134, 112, 112),
            new Rect("doll", "ring_l", 1454, 254, 112, 112),
            new Rect("doll", "ring_r", 1454, 374, 112, 112),
            new Rect("doll", "cloak", 1454, 494, 112, 112),
            new Rect("doll", "feet", 1454, 614, 112, 112),
            new Rect("doll", "mainhand", 1454, 734, 112, 112),
            new Rect("doll", "offhand", 1454, 854, 112, 112),
        };

        public static Rect UiRect(string screen, string id)
        {
            for (int i = 0; i < Ui.Length; i++)
                if (Ui[i].Screen == screen && Ui[i].Id == id) return Ui[i];
            return new Rect(screen, id, 0, 0, 0, 0);
        }

        public static Rect DollRect(string id)
        {
            for (int i = 0; i < Doll.Length; i++)
                if (Doll[i].Id == id) return Doll[i];
            return new Rect("doll", id, 0, 0, 0, 0);
        }

        public static decimal Tune(string id) => id switch
        {
            "accel" => Accel,
            "decel" => Decel,
            "turn" => Turn,
            "attackTurn" => AttackTurn,
            "idle" => IdleSpeed,
            "walkRun" => WalkRun,
            "clipWalk" => ClipWalk,
            "locoBlend" => LocoBlend,
            "attackBlend" => AttackBlend,
            "attackSeconds" => AttackSeconds,
            "trailBack" => TrailBack,
            "trailSide" => TrailSide,
            "arrive" => Arrive,
            "cruise" => Cruise,
            "catchup" => Catchup,
            "maxSpeed" => MaxSpeed,
            "warp" => WarpDistance,
            "stuck" => StuckSeconds,
            "sample" => SampleRadius,
            "frames" => QaFrames,
            "fps" => QaFps,
            "width" => QaWidth,
            "height" => QaHeight,
            "columns" => BagColumns,
            "rows" => BagRows,
            "gap" => BagGap,
            "capacity" => BagCapacity,
            "trailWidth" => TrailWidth,
            "trailLife" => TrailLife,
            "trailHold" => TrailHold,
            _ => 0m,
        };

        /// <summary>Pet follow speed from the distance to the trailing slot, before a form multiplier.</summary>
        public static decimal FollowSpeed(decimal distanceToSlot)
        {
            if (distanceToSlot < Arrive) return 0m;
            decimal s = Cruise + Catchup * (distanceToSlot - Arrive);
            return s > MaxSpeed ? MaxSpeed : s;
        }

        static decimal Intercept => decimal.Parse(UnitInterceptText, CultureInfo.InvariantCulture);
        static decimal Slope => decimal.Parse(UnitSlopeText, CultureInfo.InvariantCulture);

        public static long RoundEven(decimal value) => (long)decimal.Round(value, 0, MidpointRounding.ToEven);

        public static long XpToNext(int level)
        {
            if (level < 1 || level >= MaxLevel) return 0;
            double raw = 120.0 * Math.Pow(level, 1.75);
            return (long)Math.Round(raw, MidpointRounding.ToEven);
        }

        public static long CumulativeToArrive(int level)
        {
            long sum = 0;
            for (int i = 1; i < level; i++) sum += XpToNext(i);
            return sum;
        }

        public static long DelveXp(int rank)
        {
            if (rank < 1) return 0;
            decimal cost = XpToNext(69);
            for (int i = 1; i < rank; i++) cost *= 1.04m;
            return RoundEven(cost);
        }

        public static int LevelFromFloor(int floor) => Math.Clamp(floor + floor / 10, 1, LevelCapPlus);
        public static int DepthTier(int floor) => Math.Max(0, (floor - 60) / 10);

        public static decimal LifeScale(int floor)
        {
            decimal s = 1m;
            int n = DepthTier(floor);
            for (int i = 0; i < n; i++) s *= 1.12m;
            return s;
        }

        public static decimal DamageScale(int floor)
        {
            decimal s = 1m;
            int n = DepthTier(floor);
            for (int i = 0; i < n; i++) s *= 1.08m;
            return s;
        }

        public static long Unit(int level) => RoundEven(Intercept + Slope * level);

        static decimal AffixMid(decimal lo1, decimal hi1, decimal lo70, decimal hi70, int ilvl)
        {
            decimal t = Clamp01(((decimal)ilvl - 1m) / 69m);
            decimal lo = lo1 + (lo70 - lo1) * t;
            decimal hi = hi1 + (hi70 - hi1) * t;
            return (lo + hi) / 2m;
        }

        static decimal WeaponScale(int ilvl)
        {
            decimal x = ilvl - 1;
            return 1m + 0.09m * x + 0.0035m * x * x;
        }

        public static decimal ExpectedDps(int level)
        {
            decimal weapon = 4.5m * WeaponScale(level) * 1.3m;
            decimal gear = 9m * AffixMid(2, 5, 330, 500, level);
            decimal main = 7 + 3 * level + gear;
            decimal crit = 1m + (0.05m + 0.12m) * (0.5m + 0.6m);
            return weapon * (1m + main / 100m) * crit;
        }

        public static decimal Toughness(int level)
        {
            decimal t = Clamp01(((decimal)level - 5m) / 30m);
            return 1.6m + 2.4m * t;
        }

        public static decimal ExpectedLife(int level)
        {
            decimal vit = 7 + 2 * level + 5m * AffixMid(2, 5, 330, 500, level);
            return 40 + 10 * level + vit * 10m;
        }

        public static decimal RawLife(int level) => ExpectedDps(level) * Toughness(level);
        public static decimal RawDamage(int level) => ExpectedLife(level) * 0.055m;

        public static long NormalLife(int floor)
        {
            int level = LevelFromFloor(floor);
            return RoundEven(RawLife(level) * LifeScale(floor));
        }

        public static long NormalDamage(int floor)
        {
            int level = LevelFromFloor(floor);
            return RoundEven(RawDamage(level) * DamageScale(floor));
        }

        public static long RankLife(int floor, decimal rankMult)
        {
            int level = LevelFromFloor(floor);
            return RoundEven(RawLife(level) * rankMult * LifeScale(floor));
        }

        public static int MainStat(int level) => 7 + 3 * level;
        public static int OffStat(int level) => 7 + level;
        public static int Vitality(int level) => 7 + 2 * level;
        public static int NakedLife(int level) => 40 + 10 * level + 10 * Vitality(level);

        public static decimal NakedArmorMitigation(int level)
        {
            decimal armor = MainStat(level);
            return armor / (armor + 50m * level);
        }

        public static decimal NakedOffResistMitigation(int level)
        {
            decimal resist = OffStat(level) / 10m;
            return resist / (resist + 5m * level);
        }

        public static void AffixBudget(Rarity rarity, out int primary, out int secondary)
        {
            switch (rarity)
            {
                case Rarity.Common: primary = 0; secondary = 0; break;
                case Rarity.Magic: primary = 2; secondary = 0; break;
                case Rarity.Rare: primary = 4; secondary = 2; break;
                default: primary = 4; secondary = 1; break;
            }
        }

        public static decimal SocketChance(Rarity rarity)
        {
            if (rarity == Rarity.Rare) return 0.25m;
            if (rarity == Rarity.Legendary || rarity == Rarity.Set) return 1m;
            return 0m;
        }

        public static bool SocketSlot(ItemSlot slot) =>
            slot == ItemSlot.MainHand || slot == ItemSlot.Head || slot == ItemSlot.Chest || slot == ItemSlot.Legs;

        public static int GemItemLevel(int rank) => 1 + (rank - 1) * 17;

        public static int GemCombineGold(int rank) => rank >= 5 || rank < 1 ? 0 : 100 * rank * rank;

        public static void GemRow(int rank, out int ilvl, out int cinderMin, out int cinderMax, out int thorn, out int marrow, out int salt, out int gold)
        {
            ilvl = GemItemLevel(rank);
            cinderMin = (int)RoundEven(AffixMid(1, 2, 25, 40, ilvl));
            cinderMax = (int)RoundEven(AffixMid(2, 4, 45, 70, ilvl));
            thorn = (int)RoundEven(AffixMid(4, 8, 45, 50, ilvl));
            marrow = (int)RoundEven(10m * AffixMid(2, 5, 330, 500, ilvl));
            salt = (int)RoundEven(AffixMid(2, 5, 70, 100, ilvl));
            gold = GemCombineGold(rank);
        }

        public const decimal BossExtraSpecialChance = 0.35m;

        /// <summary>Champions start at 1 affix, elites at 2, guardians at 0. Each gains one more every 20 floors.</summary>
        public static int AffixCount(MonsterRank rank, int floor)
        {
            int extra = Math.Max(0, floor) / 20;
            switch (rank)
            {
                case MonsterRank.Champion: return 1 + extra;
                case MonsterRank.Elite: return 2 + extra;
                case MonsterRank.Boss: return extra;
                default: return 0;
            }
        }

        public static void DropWeights(int floor, decimal magicFind, LootSource src, decimal[] into)
        {
            if (floor < 1) floor = 1;
            decimal special = Math.Min(0.06m, 0.01m + 0.0005m * floor);
            decimal rare0 = 0.08m + 0.001m * Math.Min(floor, 50);
            decimal mf = 1m + Math.Max(0m, magicFind) / 100m;
            decimal common = 1m - special - rare0 - 0.28m;
            decimal magic = 0.28m * mf;
            decimal rare = rare0 * mf;
            decimal leg = LegendarySplit * special;
            decimal set = SetSplit * special;
            switch (src)
            {
                case LootSource.Champion:
                    common = 0.25m;
                    leg *= 3m; set *= 3m; rare *= 3m;
                    break;
                case LootSource.Elite:
                    common = 0m;
                    leg *= 5m; set *= 5m; rare *= 5m;
                    break;
                case LootSource.Boss:
                    common = 0m; magic = 0m;
                    leg *= 30m; set *= 30m;
                    rare = 0.60m;
                    break;
                case LootSource.Chest:
                    common = 0.20m;
                    leg *= 2m; set *= 2m; rare *= 2m;
                    break;
                case LootSource.Gamble:
                    common = 0m; magic = 0m;
                    rare = 0.90m;
                    leg = LegendarySplit * 0.10m;
                    set = SetSplit * 0.10m;
                    break;
                case LootSource.Fishing:
                    common = 0.30m;
                    leg *= 2m; set *= 2m; rare *= 2.5m;
                    break;
            }
            into[0] = common; into[1] = magic; into[2] = rare; into[3] = leg; into[4] = set;
            decimal sum = 0m;
            for (int i = 0; i < 5; i++) sum += into[i] < 0m ? 0m : into[i];
            if (sum <= 0m) return;
            for (int i = 0; i < 5; i++) into[i] = (into[i] < 0m ? 0m : into[i]) / sum;
        }

        public static string AffixName(EliteAffix id) => id switch
        {
            EliteAffix.Hasty => "Swift",
            EliteAffix.Armored => "Plated",
            EliteAffix.Vampiric => "Leech",
            EliteAffix.Molten => "Cinder Trail",
            EliteAffix.Frozen => "Rime",
            EliteAffix.Teleporter => "Blink",
            EliteAffix.Shielding => "Aegis",
            EliteAffix.Plagued => "Miasma",
            EliteAffix.Extra => "Hulking",
            EliteAffix.Waller => "Raised Wall",
            EliteAffix.Sweep => "Searing Sweep",
            EliteAffix.Pulse => "Frost Pulse",
            EliteAffix.Mortar => "Lobber",
            EliteAffix.Jailer => "Manacles",
            _ => id.ToString(),
        };

        public static string AffixTelegraph(EliteAffix id) => id switch
        {
            EliteAffix.Hasty => "No ground mark. The body leans forward and the move loop runs at 1.5×.",
            EliteAffix.Armored => "A grey shell on the body. Hits show a chip, not a pool.",
            EliteAffix.Vampiric => "A red thread from the target back to the body on each hit that heals.",
            EliteAffix.Molten => "A 2 m fire pool under the body, 0.2 s of warning, then 4 s of damage.",
            EliteAffix.Frozen => "Three 1.8 m frost circles near the hero, 1.5 s of warning, then a 60% slow.",
            EliteAffix.Teleporter => "A violet burst at the old spot and the new spot. No damage in the burst.",
            EliteAffix.Shielding => "A pale sphere for 2.5 s. Damage taken in that window is zero.",
            EliteAffix.Plagued => "A 2.5 m poison pool on the hero, 0.8 s of warning, then 5 s of damage.",
            EliteAffix.Extra => "The life bar is 1.5× and the name is prefixed. No separate pool.",
            EliteAffix.Waller => "A 4 m line of stone across the hero, 0.6 s of dust, then a 3 s blocker.",
            EliteAffix.Sweep => "A rotating 6 m beam, shown as a bright wedge for 0.4 s before it ticks.",
            EliteAffix.Pulse => "A ring that grows from 1 m to 5 m over 1.2 s, then a frost hit on the ring.",
            EliteAffix.Mortar => "A red circle, radius 2 m, on the hero for 1.0 s, then a hit.",
            EliteAffix.Jailer => "A ring at the hero's feet for 0.5 s, then a 2 s root if they are still inside.",
            _ => "",
        };

        public readonly struct CastTiming
        {
            public readonly int Windup, Strike, Recover;
            public CastTiming(int windup, int strike, int recover)
            {
                Windup = windup; Strike = strike; Recover = recover;
            }
        }

        public readonly struct SparkStyle
        {
            public readonly int Count, Speed, Life, Size;
            public SparkStyle(int count, int speed, int life, int size)
            {
                Count = count; Speed = speed; Life = life; Size = size;
            }
        }

        public readonly struct NumberStyle
        {
            public readonly string Hex;
            public readonly int Size, Rise, Life;
            public NumberStyle(string hex, int size, int rise, int life)
            {
                Hex = hex; Size = size; Rise = rise; Life = life;
            }
        }

        public readonly struct VfxStyle
        {
            public readonly string Hex, Kind;
            public VfxStyle(string hex, string kind) { Hex = hex; Kind = kind; }
        }

        public static CastTiming CastFor(string kind) => kind switch
        {
            "melee" => new CastTiming(80, 100, 140),
            "projectile" => new CastTiming(100, 60, 140),
            "nova" => new CastTiming(160, 80, 180),
            "cone" => new CastTiming(140, 80, 160),
            "dash" => new CastTiming(60, 80, 60),
            "buff" => new CastTiming(180, 40, 180),
            "channel" => new CastTiming(0, 330, 0),
            "ground" => new CastTiming(200, 250, 200),
            "chain" => new CastTiming(120, 80, 140),
            "summon" => new CastTiming(200, 200, 200),
            _ => new CastTiming(80, 100, 140),
        };

        public static string CastKind(string skillId) => skillId switch
        {
            "ic_cleave" => "melee",
            "ic_slam" => "nova",
            "ic_charge" => "dash",
            "ic_whirl" => "channel",
            "ic_warcry" => "buff",
            "ic_earthsplit" => "cone",
            "st_twinshot" => "projectile",
            "st_volley" => "cone",
            "st_caltrops" => "ground",
            "st_roll" => "dash",
            "st_mark" => "buff",
            "st_rain" => "ground",
            "hx_bolt" => "projectile",
            "hx_frostring" => "nova",
            "hx_chain" => "chain",
            "hx_blink" => "dash",
            "hx_thrall" => "summon",
            "hx_meteor" => "ground",
            _ => "melee",
        };

        public static int HitStopMs(string id) => id switch
        {
            "normal" => 40,
            "crit" => 70,
            "skill" => 55,
            "kill" => 90,
            "hurt" => 50,
            _ => 0,
        };

        public static int ShakeMm(string id) => id switch
        {
            "normal" => 30,
            "crit" => 70,
            "skill" => 50,
            "kill" => 90,
            "hurt" => 60,
            "decay" => 9,
            "cap" => 120,
            _ => 0,
        };

        public static SparkStyle Sparks(string id) => id switch
        {
            "crit" => new SparkStyle(12, 3600, 400, 120),
            "skill" => new SparkStyle(8, 3000, 320, 100),
            _ => new SparkStyle(6, 2400, 280, 80),
        };

        public static NumberStyle Number(string id) => id switch
        {
            "crit" => new NumberStyle("ffe25a", 82, 1900, 900),
            "hurt" => new NumberStyle("ff5a4a", 55, 1400, 700),
            "heal" => new NumberStyle("3ce650", 50, 1400, 700),
            _ => new NumberStyle("f4f1ea", 50, 1400, 700),
        };

        static readonly VfxStyle[] VfxRows =
        {
            new VfxStyle("e8e0d0", "arc"),
            new VfxStyle("c4a574", "nova"),
            new VfxStyle("d8d2c8", "dash"),
            new VfxStyle("f0e6c8", "spin"),
            new VfxStyle("e07040", "buff"),
            new VfxStyle("a86830", "line"),
            new VfxStyle("d8c8a0", "bolt"),
            new VfxStyle("c8b888", "fan"),
            new VfxStyle("8a9a60", "ground"),
            new VfxStyle("6a6a72", "dash"),
            new VfxStyle("e8d060", "buff"),
            new VfxStyle("9ab0c8", "ground"),
            new VfxStyle("d08aff", "bolt"),
            new VfxStyle("9fd8f0", "nova"),
            new VfxStyle("e8e070", "chain"),
            new VfxStyle("c8b0ff", "dash"),
            new VfxStyle("b0a0d8", "summon"),
            new VfxStyle("e0603a", "meteor"),
        };

        static readonly string[] VfxIds =
        {
            "ic_cleave", "ic_slam", "ic_charge", "ic_whirl", "ic_warcry", "ic_earthsplit",
            "st_twinshot", "st_volley", "st_caltrops", "st_roll", "st_mark", "st_rain",
            "hx_bolt", "hx_frostring", "hx_chain", "hx_blink", "hx_thrall", "hx_meteor",
        };

        public static VfxStyle Vfx(string skillId)
        {
            for (int i = 0; i < VfxIds.Length; i++)
                if (VfxIds[i] == skillId) return VfxRows[i];
            return new VfxStyle("ffffff", "burst");
        }

        public static bool HasSheet(string skillId)
        {
            if (skillId == "ic_warcry")
                return false;
            return VfxIdsHas(skillId);
        }

        static bool VfxIdsHas(string skillId)
        {
            for (int i = 0; i < VfxIds.Length; i++)
                if (VfxIds[i] == skillId) return true;
            return false;
        }

        public static int SheetFps(string skillId) => skillId == "ic_whirl" ? 20 : 24;

        public static bool SheetLoops(string skillId) => skillId == "ic_whirl";

        public static string SheetName(string skillId)
        {
            string cls = skillId.StartsWith("ic_") ? "ironclad" : skillId.StartsWith("st_") ? "stalker" : "hexweaver";
            return cls + "_" + skillId;
        }

        public static string ClipFor(string skillId) => skillId switch
        {
            "ic_cleave" => "ic_attack_cleave",
            "ic_slam" => "ic_attack_slam",
            "ic_charge" => "ic_charge",
            "ic_whirl" => "ic_whirl",
            "ic_warcry" => "ic_cast_warcry",
            "ic_earthsplit" => "ic_attack_earthsplit",
            "st_twinshot" => "st_attack_twinshot",
            "st_volley" => "st_attack_volley",
            "st_caltrops" => "st_cast_caltrops",
            "st_roll" => "st_roll_fire",
            "st_mark" => "st_cast_mark",
            "st_rain" => "st_aim_rain",
            "hx_bolt" => "hx_cast_bolt",
            "hx_frostring" => "hx_cast_frostring",
            "hx_chain" => "hx_cast_chain",
            "hx_blink" => "hx_cast_blink",
            "hx_thrall" => "hx_cast_thrall",
            "hx_meteor" => "hx_cast_meteor",
            _ => null,
        };

        public static string ClipHero(string skillId)
        {
            if (skillId != null && skillId.StartsWith("ic_")) return "hero_ironclad";
            if (skillId != null && skillId.StartsWith("st_")) return "hero_stalker";
            return "hero_hexweaver";
        }

        /// <summary>Inclusive 24 fps window. Only the three long takes are shortened.</summary>
        public static bool TryTrim(string clipId, out int start, out int end, out int source)
        {
            start = end = source = 0;
            if (clipId == "st_attack_twinshot") { start = 12; end = 36; source = 120; return true; }
            if (clipId == "st_attack_volley") { start = 0; end = 36; source = 188; return true; }
            if (clipId == "ic_attack_earthsplit") { start = 84; end = 120; source = 184; return true; }
            return false;
        }

        const string GlyphOrder = "0123456789+-";
        const string CritOrder = "0123456789+-!";
        static readonly int[] NormalAdvance = { 57, 40, 55, 52, 55, 51, 56, 50, 54, 56, 44, 37 };
        static readonly int[] CritAdvance = { 86, 61, 83, 78, 83, 77, 85, 75, 81, 85, 66, 56, 48 };

        public static bool Glyph(string style, char ch, out int cellW, out int cellH, out int x, out int advance)
        {
            bool crit = style == "crit";
            string order = crit ? CritOrder : GlyphOrder;
            int i = order.IndexOf(ch);
            cellW = crit ? 86 : 57;
            cellH = crit ? 124 : 83;
            if (i < 0) { x = 0; advance = 0; return false; }
            x = i * cellW;
            advance = (crit ? CritAdvance : NormalAdvance)[i];
            return true;
        }

        public const int HopMm = 550;
        public const int HopMs = 280;
        public const int SettleMs = 120;
        public const int Pip = 14;
        public const int PipInset = 6;
        public const int IconPx = 64;
        public const int TwoHandMm = 1050;
        public const int CastMs = 700;
        public const int WaitMinMs = 1500;
        public const int WaitMaxMs = 4500;
        public const int NibbleMs = 450;
        public const int NibbleMax = 3;
        public const int GapMinMs = 600;
        public const int GapMaxMs = 1600;
        public const int BiteMs = 750;
        public const int BiteLuckMs = 2;
        public const int HookTension = 300;
        public const int HookProgress = 150;
        public const int ReelHold = 350;
        public const int ReelRun = 1100;
        public const int ReelGain = 200;
        public const int ReelRunCut = 100;
        public const int ReelRelease = 550;
        public const int DepthStep = 40;
        public const int DepthCap = 2000;
        public const int OtherMilli = 150;

        public readonly struct MoteStyle
        {
            public readonly int Motes, Ring;
            public MoteStyle(int motes, int ring) { Motes = motes; Ring = ring; }
        }

        public static MoteStyle Mote(string rarity) => rarity switch
        {
            "Magic" => new MoteStyle(4, 0),
            "Rare" => new MoteStyle(8, 1),
            "Legendary" or "Set" => new MoteStyle(12, 1),
            _ => new MoteStyle(0, 0),
        };

        public readonly struct GroundShape
        {
            public readonly string Shape;
            public readonly int X, Y, Z;
            public GroundShape(string shape, int x, int y, int z) { Shape = shape; X = x; Y = y; Z = z; }
        }

        public static GroundShape GroundFor(string slot) => slot switch
        {
            "offhand" => new GroundShape("box", 280, 360, 60),
            "head" => new GroundShape("sphere", 320, 320, 320),
            "shoulders" => new GroundShape("box", 420, 80, 180),
            "chest" => new GroundShape("box", 420, 380, 220),
            "hands" => new GroundShape("box", 140, 80, 140),
            "wrists" => new GroundShape("box", 120, 60, 120),
            "waist" => new GroundShape("box", 280, 60, 80),
            "legs" => new GroundShape("box", 220, 400, 160),
            "feet" => new GroundShape("box", 180, 80, 260),
            "amulet" => new GroundShape("sphere", 160, 160, 160),
            "ring" => new GroundShape("sphere", 100, 100, 100),
            _ => new GroundShape("box", 80, 700, 80),
        };

        public static GroundShape Socket(string id) => id switch
        {
            "helm" => new GroundShape("point", 0, 1720, 0),
            "chest" => new GroundShape("point", 0, 1150, 80),
            _ => new GroundShape("point", 150, 1050, 350),
        };

        /// <summary>Weight at floor F. Zero below the fish's minimum depth. Grows 4% per floor and caps at double.</summary>
        public static float FishWeight(float baseWeight, int minDepth, int floor)
        {
            if (floor < minDepth) return 0f;
            float grown = 1f + (DepthStep / 1000f) * (floor - minDepth);
            if (grown > DepthCap / 1000f) grown = DepthCap / 1000f;
            return baseWeight * grown;
        }

        /// <summary>Grip length along the weapon's local Z, in millimetres. Above and below are the reach either side of the grip. Width is the cross-section.</summary>
        public readonly struct Grip
        {
            public readonly int LengthMm, AboveMm, BelowMm, WidthMm;
            public Grip(int length, int above, int below, int width)
            {
                LengthMm = length; AboveMm = above; BelowMm = below; WidthMm = width;
            }
        }

        public static bool TryGrip(string key, out Grip grip)
        {
            switch (key)
            {
                case "ironclad_weapon_1": grip = new Grip(800, 704, 96, 380); return true;
                case "ironclad_weapon_2": grip = new Grip(1250, 1062, 188, 601); return true;
                case "ironclad_weapon_3": grip = new Grip(1300, 1105, 195, 562); return true;
                case "stalker_weapon_1": grip = new Grip(1200, 600, 600, 200); return true;
                case "stalker_weapon_2": grip = new Grip(800, 560, 240, 576); return true;
                case "stalker_weapon_3": grip = new Grip(380, 323, 57, 61); return true;
                case "hexweaver_weapon_1": grip = new Grip(950, 808, 142, 222); return true;
                case "hexweaver_weapon_2": grip = new Grip(400, 340, 60, 37); return true;
                case "hexweaver_weapon_3": grip = new Grip(950, 808, 143, 217); return true;
                case "fishing_rod": grip = new Grip(1800, 1620, 180, 423); return true;
                default: grip = default; return false;
            }
        }

        /// <summary>One row per weapon family. The weapon in hand picks the basic attack, the animation set, and which attribute scales the hit.</summary>
        public readonly struct FamilyAttack
        {
            public readonly string Id, BasicSkill, AnimSet;
            public readonly Stat Scale;
            public FamilyAttack(string id, string basic, string anim, Stat scale)
            {
                Id = id; BasicSkill = basic; AnimSet = anim; Scale = scale;
            }
        }

        public static readonly FamilyAttack[] Attacks =
        {
            new FamilyAttack("melee", "ic_cleave", "melee", Stat.Strength),
            new FamilyAttack("melee2", "ic_slam", "melee2", Stat.Strength),
            new FamilyAttack("ranged", "st_twinshot", "ranged", Stat.Dexterity),
            new FamilyAttack("magic", "hx_bolt", "magic", Stat.Intelligence),
        };

        public static FamilyAttack AttackFor(string mainBaseId, string offBaseId)
        {
            string id = string.IsNullOrEmpty(mainBaseId) && offBaseId == "orb" ? "orb" : mainBaseId;
            switch (id)
            {
                case "bow":
                case "crossbow": return Attacks[2];
                case "staff":
                case "wand":
                case "orb": return Attacks[3];
                case "greataxe":
                case "warhammer": return Attacks[1];
                default: return Attacks[0];
            }
        }

        public static string WeaponKey(HeroClass cls, string baseId)
        {
            switch (baseId)
            {
                case "sword":
                case "axe":
                case "mace": return "ironclad_weapon_1";
                case "greataxe": return "ironclad_weapon_2";
                case "warhammer": return "ironclad_weapon_3";
                case "bow": return "stalker_weapon_1";
                case "crossbow": return "stalker_weapon_2";
                case "dagger": return "stalker_weapon_3";
                case "staff": return "hexweaver_weapon_1";
                case "wand": return "hexweaver_weapon_2";
                case "rod": return "fishing_rod";
                case "orb": return "hexweaver_weapon_3";
            }
            if (cls == HeroClass.Ironclad) return "ironclad_weapon_1";
            if (cls == HeroClass.Stalker) return "stalker_weapon_1";
            return "hexweaver_weapon_2";
        }

        public static int GearTier(Rarity rarity)
        {
            if (rarity == Rarity.Rare) return 2;
            if (rarity == Rarity.Legendary || rarity == Rarity.Set) return 3;
            return 1;
        }

        public static string ArmorKey(HeroClass cls, string part, Rarity rarity)
        {
            string who = cls == HeroClass.Ironclad ? "ironclad" : cls == HeroClass.Stalker ? "stalker" : "hexweaver";
            return who + "_" + part + "_" + GearTier(rarity);
        }

        /// <summary>Painted gem: cinder ruby, thorn emerald, marrow amethyst, salt sapphire. Rank 1–5 is chipped through royal.</summary>
        public static string GemArt(string gemId)
        {
            if (!Gems.Parse(gemId, out var name, out int rank)) return null;
            string stone = name == "cinder" ? "ruby" : name == "thorn" ? "emerald" : name == "marrow" ? "amethyst" : name == "salt" ? "sapphire" : null;
            string cut = rank == 1 ? "chipped" : rank == 2 ? "flawed" : rank == 3 ? "regular" : rank == 4 ? "flawless" : rank == 5 ? "royal" : null;
            if (stone == null || cut == null) return null;
            return "gem_" + stone + "_" + cut;
        }

        public static string GemTint(string gemId)
        {
            if (!Gems.Parse(gemId, out var name, out _)) return "#FFFFFF";
            if (name == "cinder") return "#E04040";
            if (name == "thorn") return "#30C070";
            if (name == "marrow") return "#A060D0";
            if (name == "salt") return "#4080E0";
            return "#FFFFFF";
        }

        /// <summary>White beam and ground tint, and the beam height as thousandths of BeamHeight.</summary>
        public static string BeamHex(string rarity)
        {
            switch ((rarity ?? "").ToLowerInvariant())
            {
                case "magic": return "#6969FF";
                case "rare": return "#FFFF00";
                case "legendary": return "#BF642F";
                case "set": return "#00FF00";
                default: return "#FFFFFF";
            }
        }

        public static int BeamRelMilli(string rarity)
        {
            switch ((rarity ?? "").ToLowerInvariant())
            {
                case "magic": return 550;
                case "rare": return 750;
                case "legendary":
                case "set": return 1000;
                default: return 350;
            }
        }

        static decimal Clamp01(decimal t) => t < 0m ? 0m : t > 1m ? 1m : t;

        public static int BossPhase(float lifeFraction)
        {
            if (lifeFraction > (float)PhaseTwoLife) return 1;
            if (lifeFraction > (float)PhaseThreeLife) return 2;
            return 3;
        }
    }
}
