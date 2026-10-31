using System;

namespace Hollowmere.Core
{
    public static partial class DesignTable
    {
        public readonly struct CastRow
        {
            public readonly string Id;
            public readonly int Windup, Strike, Recover;
            public CastRow(string id, int windup, int strike, int recover)
            {
                Id = id; Windup = windup; Strike = strike; Recover = recover;
            }
            public int TotalMs => Windup + Strike + Recover;
        }

        public readonly struct SparkRow
        {
            public readonly string Id;
            public readonly int Count, Speed, Life, Size;
            public SparkRow(string id, int count, int speed, int life, int size)
            {
                Id = id; Count = count; Speed = speed; Life = life; Size = size;
            }
        }

        public readonly struct NumberRow
        {
            public readonly string Id, Hex;
            public readonly int Size, Rise, Life;
            public NumberRow(string id, string hex, int size, int rise, int life)
            {
                Id = id; Hex = hex; Size = size; Rise = rise; Life = life;
            }
        }

        public readonly struct VfxRow
        {
            public readonly string Id, Hex, Kind;
            public VfxRow(string id, string hex, string kind) { Id = id; Hex = hex; Kind = kind; }
        }

        public readonly struct MoteRow
        {
            public readonly string Rarity;
            public readonly int Motes, Ring;
            public MoteRow(string rarity, int motes, int ring) { Rarity = rarity; Motes = motes; Ring = ring; }
        }

        public readonly struct GroundRow
        {
            public readonly string Slot, Shape;
            public readonly int X, Y, Z;
            public GroundRow(string slot, string shape, int x, int y, int z)
            {
                Slot = slot; Shape = shape; X = x; Y = y; Z = z;
            }
        }

        public static readonly CastRow[] Casts =
        {
            new CastRow("melee", 80, 100, 140),
            new CastRow("projectile", 100, 60, 140),
            new CastRow("nova", 160, 80, 180),
            new CastRow("cone", 140, 80, 160),
            new CastRow("dash", 60, 80, 60),
            new CastRow("buff", 180, 40, 180),
            new CastRow("channel", 0, 330, 0),
            new CastRow("ground", 200, 250, 200),
            new CastRow("chain", 120, 80, 140),
            new CastRow("summon", 200, 200, 200),
        };

        public static readonly SparkRow[] Sparks =
        {
            new SparkRow("normal", 6, 2400, 280, 80),
            new SparkRow("crit", 12, 3600, 400, 120),
            new SparkRow("skill", 8, 3000, 320, 100),
        };

        public static readonly NumberRow[] Numbers =
        {
            new NumberRow("normal", "f4f1ea", 50, 1400, 700),
            new NumberRow("crit", "ffe25a", 82, 1900, 900),
            new NumberRow("hurt", "ff5a4a", 55, 1400, 700),
        };

        public static readonly VfxRow[] Vfx =
        {
            new VfxRow("ic_cleave", "e8e0d0", "arc"),
            new VfxRow("ic_slam", "c4a574", "nova"),
            new VfxRow("ic_charge", "d8d2c8", "dash"),
            new VfxRow("ic_whirl", "f0e6c8", "spin"),
            new VfxRow("ic_warcry", "e07040", "buff"),
            new VfxRow("ic_earthsplit", "a86830", "line"),
            new VfxRow("st_twinshot", "d8c8a0", "bolt"),
            new VfxRow("st_volley", "c8b888", "fan"),
            new VfxRow("st_caltrops", "8a9a60", "ground"),
            new VfxRow("st_roll", "6a6a72", "dash"),
            new VfxRow("st_mark", "e8d060", "buff"),
            new VfxRow("st_rain", "9ab0c8", "ground"),
            new VfxRow("hx_bolt", "d08aff", "bolt"),
            new VfxRow("hx_frostring", "9fd8f0", "nova"),
            new VfxRow("hx_chain", "e8e070", "chain"),
            new VfxRow("hx_blink", "c8b0ff", "dash"),
            new VfxRow("hx_thrall", "b0a0d8", "summon"),
            new VfxRow("hx_meteor", "e0603a", "meteor"),
        };

        public static readonly MoteRow[] Motes =
        {
            new MoteRow("Common", 0, 0),
            new MoteRow("Magic", 4, 0),
            new MoteRow("Rare", 8, 1),
            new MoteRow("Legendary", 12, 1),
            new MoteRow("Set", 12, 1),
        };

        public static readonly GroundRow[] Ground =
        {
            new GroundRow("weapon", "box", 80, 700, 80),
            new GroundRow("offhand", "box", 280, 360, 60),
            new GroundRow("head", "sphere", 320, 320, 320),
            new GroundRow("shoulders", "box", 420, 80, 180),
            new GroundRow("chest", "box", 420, 380, 220),
            new GroundRow("hands", "box", 140, 80, 140),
            new GroundRow("wrists", "box", 120, 60, 120),
            new GroundRow("waist", "box", 280, 60, 80),
            new GroundRow("legs", "box", 220, 400, 160),
            new GroundRow("feet", "box", 180, 80, 260),
            new GroundRow("amulet", "sphere", 160, 160, 160),
            new GroundRow("ring", "sphere", 100, 100, 100),
        };

        public static readonly Rect[] Sockets =
        {
            new Rect("socket", "weapon", 150, 1050, 350, 0),
            new Rect("socket", "helm", 0, 1720, 0, 0),
            new Rect("socket", "chest", 0, 1150, 80, 0),
        };

        public static CastRow Cast(string id)
        {
            for (int i = 0; i < Casts.Length; i++) if (Casts[i].Id == id) return Casts[i];
            return new CastRow(id, 0, 0, 0);
        }

        /// <summary>Whirling Steel uses the channel pulse. Every other cast uses its shape.</summary>
        public static CastRow CastFor(string skillId, string shape)
        {
            if (skillId == "ic_whirl") return Cast("channel");
            string id = shape switch
            {
                "MeleeArc" => "melee",
                "Projectile" => "projectile",
                "Nova" => "nova",
                "Cone" => "cone",
                "Dash" => "dash",
                "Buff" => "buff",
                "GroundTarget" => "ground",
                "Chain" => "chain",
                "Summon" => "summon",
                _ => shape,
            };
            return Cast(id);
        }

        public static int HitStopMs(string id) => id switch
        {
            "normal" => 40,
            "crit" => 70,
            "skill" => 55,
            "kill" => 90,
            "hurt" => 50,
            _ => 0,
        };

        public static decimal Present(string id) => id switch
        {
            "shakeDecay" => 9m,
            "shakeCap" => 120m,
            "trailWidth" => 60m,
            "trailLife" => 140m,
            "trailHold" => 180m,
            "hopMm" => 550m,
            "hopMs" => 280m,
            "settleMs" => 120m,
            "pip" => 14m,
            "pipInset" => 6m,
            "icon" => 64m,
            "twoHandMm" => 1050m,
            "castMs" => 700m,
            "waitMinMs" => 1500m,
            "waitMaxMs" => 4500m,
            "nibbleMs" => 450m,
            "nibbleMax" => 3m,
            "gapMinMs" => 600m,
            "gapMaxMs" => 1600m,
            "biteMs" => 750m,
            "biteLuckMs" => 2m,
            "hookTension" => 300m,
            "hookProgress" => 150m,
            "reelHold" => 350m,
            "reelRun" => 1100m,
            "reelGain" => 200m,
            "reelRunCut" => 100m,
            "reelRelease" => 550m,
            "reelSlip" => 120m,
            "runMinMs" => 400m,
            "runMaxMs" => 1400m,
            "bobMm" => 80m,
            "bobHz" => 6m,
            "biteDipMm" => 180m,
            "reelDeg" => 12m,
            "reelPumpMs" => 250m,
            "depthStep" => 40m,
            "depthCap" => 2000m,
            "otherMilli" => 150m,
            "otherLuckCap" => 100m,
            _ => 0m,
        };

        public static int ShakeMm(string id) => id switch
        {
            "normal" => 30,
            "crit" => 70,
            "skill" => 50,
            "kill" => 90,
            "hurt" => 60,
            _ => 0,
        };

        public static SparkRow Spark(string id)
        {
            for (int i = 0; i < Sparks.Length; i++) if (Sparks[i].Id == id) return Sparks[i];
            return new SparkRow(id, 0, 0, 0, 0);
        }

        public static NumberRow NumberStyle(string id)
        {
            for (int i = 0; i < Numbers.Length; i++) if (Numbers[i].Id == id) return Numbers[i];
            return new NumberRow(id, "ffffff", 50, 1400, 700);
        }

        public static VfxRow VfxFor(string id)
        {
            for (int i = 0; i < Vfx.Length; i++) if (Vfx[i].Id == id) return Vfx[i];
            return new VfxRow(id, "ffffff", "burst");
        }

        public static MoteRow Mote(string rarity)
        {
            for (int i = 0; i < Motes.Length; i++) if (Motes[i].Rarity == rarity) return Motes[i];
            return new MoteRow(rarity, 0, 0);
        }

        public static GroundRow GroundFor(string slot)
        {
            for (int i = 0; i < Ground.Length; i++) if (Ground[i].Slot == slot) return Ground[i];
            return new GroundRow(slot, "box", 100, 100, 100);
        }

        public static Rect Socket(string id)
        {
            for (int i = 0; i < Sockets.Length; i++) if (Sockets[i].Id == id) return Sockets[i];
            return new Rect("socket", id, 0, 0, 0, 0);
        }

        /// <summary>Weight of a fish at a floor. Zero below its minimum depth. Grows 4% per floor past that, capped at double.</summary>
        public static decimal FishWeight(decimal baseWeight, int minDepth, int floor)
        {
            if (floor < minDepth) return 0m;
            decimal step = Tune("depthStep") / 1000m;
            decimal cap = Tune("depthCap") / 1000m;
            decimal scale = 1m + step * (floor - minDepth);
            if (scale > cap) scale = cap;
            return baseWeight * scale;
        }
    }
}
