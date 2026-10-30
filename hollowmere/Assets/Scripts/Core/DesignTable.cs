using System;
using System.Globalization;

namespace Hollowmere.Core
{
    /// <summary>
    /// Every tuned figure from DESIGN_SPEC.md. Formulas live here so combat code does not
    /// carry loose literals. The difficulty ladder in <see cref="Balance"/> is not part of this table.
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
            new Rect("inventory", "panel", 48, 48, 2244, 984),
            new Rect("inventory", "doll", 72, 120, 640, 860),
            new Rect("inventory", "model", 248, 200, 280, 520),
            new Rect("inventory", "stats", 760, 120, 480, 860),
            new Rect("inventory", "grid", 1500, 160, 472, 552),
            new Rect("inventory", "gridCell", 0, 0, 72, 72),
            new Rect("inventory", "tooltip", 1040, 200, 440, 560),
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
            new Rect("doll", "head", 284, 24, 72, 72),
            new Rect("doll", "shoulders", 120, 160, 72, 72),
            new Rect("doll", "amulet", 448, 160, 72, 72),
            new Rect("doll", "chest", 284, 200, 72, 72),
            new Rect("doll", "hands", 40, 300, 72, 72),
            new Rect("doll", "wrists", 40, 390, 72, 72),
            new Rect("doll", "waist", 284, 400, 72, 72),
            new Rect("doll", "legs", 284, 490, 72, 72),
            new Rect("doll", "feet", 284, 620, 72, 72),
            new Rect("doll", "weapon", 40, 520, 72, 120),
            new Rect("doll", "offhand", 528, 520, 72, 120),
            new Rect("doll", "ring1", 40, 660, 72, 72),
            new Rect("doll", "ring2", 528, 660, 72, 72),
        };

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

        public static void DropWeights(int floor, decimal magicFind, decimal legendaryBonus, LootSource src, decimal[] into)
        {
            if (floor < 1) floor = 1;
            decimal special = Math.Min(0.06m, 0.01m + 0.0005m * floor);
            decimal rare0 = 0.08m + 0.001m * Math.Min(floor, 50);
            decimal mf = 1m + Math.Max(0m, magicFind) / 100m;
            decimal legB = 1m + legendaryBonus;
            decimal common = 1m - special - rare0 - 0.28m;
            decimal magic = 0.28m * mf;
            decimal rare = rare0 * mf;
            decimal leg = LegendarySplit * special * legB;
            decimal set = SetSplit * special * legB;
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

        static decimal Clamp01(decimal t) => t < 0m ? 0m : t > 1m ? 1m : t;

        public static int BossPhase(float lifeFraction)
        {
            if (lifeFraction > (float)PhaseTwoLife) return 1;
            if (lifeFraction > (float)PhaseThreeLife) return 2;
            return 3;
        }
    }
}
