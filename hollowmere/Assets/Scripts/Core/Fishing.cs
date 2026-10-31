using System;
using System.Collections.Generic;
using System.Linq;

namespace Hollowmere.Core
{
    public enum FishEffect { None, PetForm, Heal, Buff }

    public sealed class FishDef
    {
        public string id, name, text;
        public Rarity rarity;
        public int minDepth, maxDepth = 999;
        public bool town, dungeon = true;
        public float weight = 1;
        public float pull = 0.5f, erratic = 0.3f, stamina = 4f;   // how hard the fight is
        public FishEffect effect;
        public string petForm;
        public float formSeconds;     // < 0 = permanent until replaced
        public Stat buffStat;
        public float buffValue, buffSeconds, healPct;
        public int sellValue = 10;
        public string color = "#7aa0c0";
    }

    public static class FishDb
    {
        public static readonly List<FishDef> All = new List<FishDef>
        {
            new FishDef { id = "minnow", name = "Mere Minnow", rarity = Rarity.Common, town = true, minDepth = 1, weight = 10, pull = 0.25f, erratic = 0.2f, stamina = 2.5f, effect = FishEffect.Heal, healPct = 0.15f, sellValue = 4, text = "Feed to your companion to heal you both for 15%.", color = "#a8b8c0" },
            new FishDef { id = "mudperch", name = "Mudperch", rarity = Rarity.Common, town = true, minDepth = 1, weight = 8, pull = 0.35f, erratic = 0.25f, stamina = 3f, effect = FishEffect.PetForm, petForm = "boarhound", formSeconds = 90, sellValue = 8, text = "Companion becomes a tusked Boarhound for 90s: tougher, hits harder.", color = "#7a6a40" },
            new FishDef { id = "cavecarp", name = "Blind Cave Carp", rarity = Rarity.Common, minDepth = 1, weight = 8, pull = 0.4f, erratic = 0.3f, stamina = 3.5f, effect = FishEffect.Buff, buffStat = Stat.MagicFind, buffValue = 25, buffSeconds = 120, sellValue = 10, text = "+25% Magic Find for 2 minutes.", color = "#e0e0e8" },
            new FishDef { id = "emberfin", name = "Emberfin", rarity = Rarity.Magic, minDepth = 3, weight = 5, pull = 0.5f, erratic = 0.4f, stamina = 4f, effect = FishEffect.PetForm, petForm = "cinderdrake", formSeconds = 90, sellValue = 30, text = "Companion becomes a Cinder Drake for 90s: breathes fire.", color = "#e0603a" },
            new FishDef { id = "rimeeel", name = "Rime Eel", rarity = Rarity.Magic, minDepth = 6, weight = 5, pull = 0.55f, erratic = 0.55f, stamina = 4.5f, effect = FishEffect.PetForm, petForm = "frostwyrm", formSeconds = 90, sellValue = 35, text = "Companion becomes a Frost Wyrm for 90s: chills and slows.", color = "#9fd8f0" },
            new FishDef { id = "stormgill", name = "Stormgill", rarity = Rarity.Magic, minDepth = 10, weight = 4, pull = 0.6f, erratic = 0.6f, stamina = 5f, effect = FishEffect.PetForm, petForm = "thunderhound", formSeconds = 90, sellValue = 40, text = "Companion becomes a Thunder Hound for 90s: lightning arcs between foes.", color = "#e8e070" },
            new FishDef { id = "goldscale", name = "Goldscale Koi", rarity = Rarity.Rare, town = true, minDepth = 1, weight = 2, pull = 0.55f, erratic = 0.5f, stamina = 5f, effect = FishEffect.PetForm, petForm = "gildedserpent", formSeconds = 180, sellValue = 120, text = "Companion becomes a Gilded Serpent for 3 min: +75% gold found.", color = "#f0c040" },
            new FishDef { id = "bogtrout", name = "Bog Trout", rarity = Rarity.Common, town = true, minDepth = 1, weight = 6, pull = 0.4f, erratic = 0.3f, stamina = 3f, effect = FishEffect.Buff, buffStat = Stat.Armor, buffValue = 300, buffSeconds = 120, sellValue = 9, text = "+300 Armor for 2 minutes.", color = "#5a7a4a" },
            new FishDef { id = "glassfish", name = "Glassfish", rarity = Rarity.Rare, minDepth = 12, weight = 2, pull = 0.65f, erratic = 0.7f, stamina = 5.5f, effect = FishEffect.Buff, buffStat = Stat.CritChance, buffValue = 10, buffSeconds = 180, sellValue = 90, text = "+10% Critical Hit Chance for 3 minutes.", color = "#d0f0ff" },
            new FishDef { id = "graveling", name = "Graveling", rarity = Rarity.Rare, minDepth = 15, weight = 2, pull = 0.7f, erratic = 0.6f, stamina = 6f, effect = FishEffect.PetForm, petForm = "boneguard", formSeconds = 180, sellValue = 100, text = "Companion becomes a Boneguard for 3 min: draws enemy attacks.", color = "#c8c0a8" },
            new FishDef { id = "abyssal", name = "Abyssal Leviathan Fry", rarity = Rarity.Legendary, minDepth = 20, weight = 0.5f, pull = 0.85f, erratic = 0.8f, stamina = 7f, effect = FishEffect.PetForm, petForm = "leviathan", formSeconds = -1, sellValue = 600, text = "Companion PERMANENTLY becomes a Leviathan (until fed another form fish).", color = "#3a4ab0" },
            new FishDef { id = "moonkoi", name = "Moonlit Koi", rarity = Rarity.Legendary, town = true, dungeon = false, minDepth = 1, weight = 0.4f, pull = 0.8f, erratic = 0.7f, stamina = 6.5f, effect = FishEffect.PetForm, petForm = "moonstag", formSeconds = -1, sellValue = 500, text = "Companion PERMANENTLY becomes a Moon Stag that heals you over time.", color = "#e8e8ff" },
        };

        public static FishDef Get(string id) => All.FirstOrDefault(f => f.id == id);

        public static List<FishDef> Available(bool town, int depth) =>
            All.Where(f => town ? f.town : (f.dungeon && depth >= f.minDepth && depth <= f.maxDepth)).ToList();
    }

    /// <summary>Things that are not fish, reeled up from the deep.</summary>
    public enum CatchKind { Fish, Item, Gold, Junk }

    public sealed class CatchResult
    {
        public CatchKind kind;
        public FishDef fish;
        public Item item;
        public int gold;
    }

    public enum FishingPhase { Ready, Casting, Waiting, Nibble, Bite, Reeling, Caught, Escaped, Snapped, Spooked }

    /// <summary>
    /// One cast at a fishing spot, as a pure state machine the UI drives with Tick/Tap/Hold.
    /// Wait for the bobber; it nibbles (tapping now spooks the fish) and then truly bites (tap
    /// inside the window to hook). Reeling: hold to reel in, which raises line tension; release to
    /// let the fish run. Land it before the fish wins or the line snaps.
    /// </summary>
    public sealed class FishingSession
    {
        public FishingPhase phase = FishingPhase.Ready;
        public float timer;
        public float biteWindow;
        public float tension;       // 0..1, snaps above 1
        public float progress;      // 0..1, landed at 1
        public float fishStamina, fishMaxStamina;
        public bool holding;
        public CatchResult result;

        readonly Rng rng;
        readonly bool town;
        readonly int depth;
        readonly float luck;
        readonly float bonusWindow;
        readonly int monsterLevel;
        readonly HeroClass cls;
        float runTimer, runStrength;
        int nibblesLeft;

        public FishingSession(Rng rng, bool town, int depth, float fishingLuck, float bonusWindow, int monsterLevel, HeroClass cls)
        {
            this.rng = rng; this.town = town; this.depth = depth; luck = fishingLuck; this.bonusWindow = bonusWindow;
            this.monsterLevel = monsterLevel; this.cls = cls;
        }

        public bool Done => phase == FishingPhase.Caught || phase == FishingPhase.Escaped || phase == FishingPhase.Snapped || phase == FishingPhase.Spooked;

        static float Sec(string id) => (float)DesignTable.Present(id) / 1000f;

        public void Cast()
        {
            if (phase != FishingPhase.Ready) return;
            phase = FishingPhase.Casting;
            timer = Sec("castMs");
            result = RollCatch();
        }

        public void Tap()
        {
            switch (phase)
            {
                case FishingPhase.Ready: Cast(); break;
                case FishingPhase.Nibble: phase = FishingPhase.Spooked; break;
                case FishingPhase.Waiting: break; // nothing there yet, harmless
                case FishingPhase.Bite:
                    phase = FishingPhase.Reeling;
                    tension = Sec("hookTension"); progress = Sec("hookProgress");
                    fishMaxStamina = fishStamina = result.fish?.stamina ?? 2f;
                    runTimer = 0;
                    break;
            }
        }

        public void Hold(bool on) => holding = on;

        public void Tick(float dt)
        {
            switch (phase)
            {
                case FishingPhase.Casting:
                    if ((timer -= dt) <= 0) { phase = FishingPhase.Waiting; timer = rng.Range(Sec("waitMinMs"), Sec("waitMaxMs")); nibblesLeft = rng.Range(0, (int)DesignTable.Present("nibbleMax")); }
                    break;
                case FishingPhase.Waiting:
                    if ((timer -= dt) <= 0)
                    {
                        if (nibblesLeft > 0) { nibblesLeft--; phase = FishingPhase.Nibble; timer = Sec("nibbleMs"); }
                        else { phase = FishingPhase.Bite; biteWindow = timer = Sec("biteMs") + bonusWindow + luck * Sec("biteLuckMs"); }
                    }
                    break;
                case FishingPhase.Nibble:
                    if ((timer -= dt) <= 0) { phase = FishingPhase.Waiting; timer = rng.Range(Sec("gapMinMs"), Sec("gapMaxMs")); }
                    break;
                case FishingPhase.Bite:
                    if ((timer -= dt) <= 0) phase = FishingPhase.Escaped;
                    break;
                case FishingPhase.Reeling:
                    TickReel(dt);
                    break;
            }
        }

        void TickReel(float dt)
        {
            var f = result.fish;
            float pull = f?.pull ?? 0.3f, erratic = f?.erratic ?? 0.2f;
            // Fish surges: random runs that spike tension if you keep reeling.
            if ((runTimer -= dt) <= 0)
            {
                runTimer = rng.Range(Sec("runMinMs"), Sec("runMaxMs")) * (1.2f - erratic * 0.6f);
                runStrength = rng.Chance(0.35f + erratic * 0.4f) ? rng.Range(0.6f, 1.2f) : rng.Range(0.1f, 0.4f);
            }
            float tired = fishMaxStamina > 0 ? 0.35f + 0.65f * (fishStamina / fishMaxStamina) : 0.35f;
            float run = runStrength * pull * tired;
            if (holding)
            {
                tension += (Sec("reelHold") + run * Sec("reelRun")) * dt;
                progress += (Sec("reelGain") - run * Sec("reelRunCut")) * dt;
                fishStamina = Math.Max(0, fishStamina - dt * (1 + run));
            }
            else
            {
                tension -= Sec("reelRelease") * dt;
                progress -= run * Sec("reelSlip") * dt;
                fishStamina = Math.Max(0, fishStamina - dt * 0.35f);
            }
            tension = Math.Max(0, tension);
            progress = Math.Min(1, progress);
            if (tension >= 1) phase = FishingPhase.Snapped;
            else if (progress >= 1) phase = FishingPhase.Caught;
            else if (progress <= 0) phase = FishingPhase.Escaped;
        }

        CatchResult RollCatch()
        {
            // 15% of casts reel up something that is not a fish (more with luck), as in the old games.
            float other = Sec("otherMilli") + Math.Min(Sec("otherLuckCap"), luck * 0.001f);
            if (rng.Chance(other))
            {
                float r = rng.Value();
                if (r < 0.45f) return new CatchResult { kind = CatchKind.Gold, gold = (int)((10 + monsterLevel * 6) * rng.Range(0.6f, 1.6f)) };
                if (r < 0.75f) return new CatchResult { kind = CatchKind.Junk, item = JunkItem() };
                return new CatchResult { kind = CatchKind.Item, item = Loot.Generate(rng, Balance.ItemLevelFor(monsterLevel, false), Loot.RollRarity(rng, luck, LootSource.Fishing, depth), cls, floor: depth) };
            }
            var pool = FishDb.Available(town, depth);
            var weights = pool.Select(f => (float)DesignTable.FishWeight((decimal)f.weight, f.minDepth, depth) * (f.rarity >= Rarity.Rare ? 1 + luck / 50f : f.rarity == Rarity.Magic ? 1 + luck / 100f : 1f)).ToList();
            return new CatchResult { kind = CatchKind.Fish, fish = pool[rng.Weighted(weights)] };
        }

        Item JunkItem()
        {
            string[] names = { "Soggy Boot", "Tangled Net", "Rusted Helm", "Waterlogged Diary", "Barnacled Tankard" };
            var it = Loot.Generate(rng, Math.Max(1, monsterLevel - 2), Rarity.Common, null);
            it.name = rng.Pick(names);
            it.junk = true;
            return it;
        }
    }

    // ===================== Companion =====================

    public sealed class PetForm
    {
        public string id, name, model, text;
        public Element element = Element.Physical;
        public float damageMult = 1, lifeMult = 1, speedMult = 1;
        public float aoeRadius;        // >0: attacks splash
        public float slow;
        public float goldFind, healPerSecondPct, taunt;
        public string color;
    }

    public enum PetSpecies { Hound, Lynx }

    [Serializable]
    public sealed class PetState
    {
        public string name = "Biscuit";
        public PetSpecies species = PetSpecies.Hound;
        public string form = "";
        public float formSeconds;       // remaining; < 0 permanent
        public float lifeFraction = 1;
        public List<Item> pack = new List<Item>();     // items carried for selling
        public float tripSeconds;       // > 0 while away selling
        public long tripGold;

        public const int PackSize = 12;
        public const float TripLength = 45f;

        public PetForm Form => PetDb.Get(form);
        public bool Away => tripSeconds > 0;

        public void Feed(FishDef f, float durationBonusPct)
        {
            if (f.effect != FishEffect.PetForm) return;
            form = f.petForm;
            formSeconds = f.formSeconds < 0 ? -1 : f.formSeconds * (1 + durationBonusPct / 100f);
        }

        /// <summary>Returns gold delivered if the pet came back this tick.</summary>
        public long Tick(float dt)
        {
            if (formSeconds > 0 && (formSeconds -= dt) <= 0) { form = ""; formSeconds = 0; }
            if (tripSeconds > 0 && (tripSeconds -= dt) <= 0)
            {
                tripSeconds = 0;
                long g = tripGold;
                tripGold = 0;
                return g;
            }
            return 0;
        }

        public bool SendToTown()
        {
            if (Away || pack.Count == 0) return false;
            tripGold = pack.Sum(i => (long)i.SellValue());
            pack.Clear();
            tripSeconds = TripLength;
            return true;
        }

        public float MaxLife(Hero h, StatBlock s) => h.MaxLife(s) * 0.6f * (Form?.lifeMult ?? 1);
    }

    public static class PetDb
    {
        public static readonly List<PetForm> Forms = new List<PetForm>
        {
            new PetForm { id = "boarhound", name = "Boarhound", damageMult = 1.4f, lifeMult = 1.5f, color = "#8a6a4a", text = "Tusked and tough." },
            new PetForm { id = "cinderdrake", name = "Cinder Drake", element = Element.Fire, damageMult = 1.8f, aoeRadius = 2.5f, color = "#e0603a", text = "Breathes fire on groups." },
            new PetForm { id = "frostwyrm", name = "Frost Wyrm", element = Element.Frost, damageMult = 1.6f, aoeRadius = 2f, slow = 0.5f, color = "#9fd8f0", text = "Chills and slows." },
            new PetForm { id = "thunderhound", name = "Thunder Hound", element = Element.Lightning, damageMult = 2f, speedMult = 1.3f, aoeRadius = 1.5f, color = "#e8e070", text = "Fast, arcing lightning." },
            new PetForm { id = "gildedserpent", name = "Gilded Serpent", damageMult = 1.2f, goldFind = 75, color = "#f0c040", text = "+75% gold found." },
            new PetForm { id = "boneguard", name = "Boneguard", damageMult = 1.3f, lifeMult = 3f, taunt = 1, color = "#c8c0a8", text = "Draws enemy attacks." },
            new PetForm { id = "leviathan", name = "Leviathan", element = Element.Frost, damageMult = 3f, lifeMult = 2.5f, aoeRadius = 3f, color = "#3a4ab0", text = "A small sea monster. Permanent." },
            new PetForm { id = "moonstag", name = "Moon Stag", element = Element.Arcane, damageMult = 2f, lifeMult = 2f, healPerSecondPct = 0.01f, color = "#e8e8ff", text = "Heals you 1% per second. Permanent." },
        };

        public static PetForm Get(string id) => string.IsNullOrEmpty(id) ? null : Forms.FirstOrDefault(f => f.id == id);
    }
}
