# Glimmerdeep

**Tame. Merge. Evolve.** A creature auto-chess roguelite. Buy creatures from a shop,
place them on your half of the board, and watch them fight on their own. Three copies
merge and evolve. Stack relics and synergies across 24 rounds and four biomes to beat
the Glimmerwyrm.

Play: https://labfreak-dev.github.io/Odds-Ends/glimmerdeep/

No build step. `index.html` loads four classic scripts in order:

| File | What it is |
|---|---|
| `data.js` | Every number and name: elements, species (with shop tier and attack range), skills, bosses, biomes, element and role traits, relics, sets, fusions, charms, items, mutations, perks, camp upgrades, shop odds, Tamer XP curve. |
| `chess.js` | The fight engine. Pure logic, no DOM. `create()` sets a board up; `tick()` advances 0.1 s and returns events (move, attack, cast, damage, status, knockout...). |
| `crun.js` | The run: shop and shared pool, bench and board, buying, selling, merges, income and interest, Tamer XP, the enemy board for each round, rewards. No DOM. |
| `game.js` | The UI: title, planning (shop, drag and drop, the creature panel and its power pick), live fight playback and animations, round results and rewards, bag, camp, Glimdex, save. |

Because `chess.js` and `crun.js` never touch the page, `sim.js` plays whole runs headless.

## Verify before shipping
```bash
for f in glimmerdeep/*.js; do node --check "$f"; done
node glimmerdeep/sim.js 300            # bot plays 300 runs: win rate, boss win rate by stage, per-round table
python3 glimmerdeep/tools/smoke.py     # real page in headless chromium (pip install playwright==1.56.0)
python3 glimmerdeep/tools/smoke.py --mobile --rounds 5
python3 glimmerdeep/tools/smoke.py --deep --rounds 24   # extra gold: merges, bosses, stage changes
```
The sim bot is simple (buys copies of what it owns, levels at 14+ gold, rerolls late,
melee in front): about 25% wins at Depth 0 is the target, with bosses getting harder
by stage (about 83 / 50 / 42 / 23%).

## How it plays

### A run
24 rounds in 4 stages of 6: the Verdant Hollow, then Magma Forge or Sunken Grotto,
then Crystal Spire or Shadow Crypt, then the Glimmer Core. Round 3 of each stage is an
**elite** fight that pays a relic; round 6 is the stage **boss**, which pays a relic and a
Tamer perk, and then you choose the next biome. You have 100 HP: a lost round costs
2 + 2×stage + the value of every foe left standing. The final boss must be beaten; lose
and you fight it again next round.

### Planning
- **Shop**: 5 creatures a round (6 with Collector). Cost = tier: 1, 2 or 3 gold. Reroll for
  2, or **Lock** the shop for next round. Copies come from a shared pool (18/14/10 per
  species by tier), so 3-starring is a race against your own buys.
- **Board and bench**: drag creatures between the bench (9 slots), your 4 columns of the
  8×5 board, and the shop (to sell). The next enemy board is shown while you plan.
- **Tamer level** (the player's XP): +2 XP a round, Buy XP gives 4 for 4 gold. Level =
  how many creatures fit on the board, and higher levels roll rarer tiers.
- **Gold**: 5 a round, +1 per win, +1 interest per 10 held (max 5), +1-3 for streaks.
- **Merging**: 3 copies of a creature at the same star merge and evolve it: ★2 uses the
  second-form art, ★3 the final form (Sunstone: 2 copies for ★2). Every merge offers a
  **mutation**.
- **Power (the loadout)**: tap a creature and pick which of its skills it casts when its
  mana fills. ★1 has two choices, ★2 and ★3 add the ultimate.
- **Charms** (one per creature, stat-only) and **items** (heal HP, Tamer XP, instant ★2,
  next-fight bombs, mana or a free loss, a shop of species you own) drop from wild rounds.

### Fights
Real time, 0.1 s ticks. Creatures walk to the nearest foe (8-way pathing around
others), attack at their own range and speed, and gain mana from attacking (+10) and
being hit. At full mana they cast their power: single hits, splash around the target,
multi-hit volleys, heals, shields, buffs, taunts, summons; assassins with "Phantom
Pounce" leap next to the weakest foe. Basic attacks carry the creature's basic status
(burn, soak, poison, stun, curse). Bosses enrage below half HP (+50% attack speed).
After 40 s the cave quakes so a fight always ends; a double knockout is a loss.

### Synergies, reactions, hazards
- **Element traits** (2 or 3 different species of one element; a Dual Nature mutation
  counts twice): Ember burns longer and hotter, Tide soaks every foe at the start, Bloom
  regenerates, Volt attacks faster, Stone hardens the front column, Shade crits curse.
- **Role traits**: Striker 2/4 (attack speed), Caster 2/3 (skill damage, cheaper mana),
  Guardian 2/3 (start shielded), Support 2 (stronger heals and shields, starting mana).
- **Element chart**: Ember > Bloom, Shade · Tide > Ember, Stone · Bloom > Tide, Stone ·
  Volt > Tide, Shade · Stone > Ember, Volt · Shade > Volt, Bloom (1.5×; same element 1.2×).
- **Reactions**: Volt on Soaked = Electrocute · Tide on Burning = Steam · Ember on
  Poisoned = Blight Burst (the stacks explode on every foe) · Stone on Rooted = Shatter ·
  Shade on a Cursed foe under 25% = Doom · Ember on Soaked = Fizzle.
- **Hazards**: Spore Haze, Scorching Heat, Rising Flood, Prismatic Echo, Pitch Darkness,
  Elemental Flux, each with counters (and counter relics weighted up in relic offers).

### Relics, perks, meta
59 relics (51 + 8 legendary fusions) with tags; three sharing a tag light up one of 15
set bonuses; eight pairs fuse into legendaries (Bag → Forge). Relics whose turn-based
meaning did not carry over were re-pointed in `CHESS_RELIC` (data.js): e.g. Quickglass
makes skills cheaper, Sunstone lets 2 copies merge, Tome/Philosopher give Tamer XP,
the Purse/Jackpot pay gold every round. Tamer perks after each boss; camp upgrades
between runs (starting gold, max HP, a starting relic, an Evo Crystal, shinies, starting
Tamer level, more relic choices, healing after bosses); Depth difficulty after a win.

## Art (Meshy)
Every image is a Meshy render: glossy stylized 3D toy-like creatures, rich saturated
colour, no vector art. Equipment is never drawn on a creature (charms and relics are
icons only), so a stat change never needs new art.

- `tools/gen-art.py`: the full manifest (148 images) and prompts. Stage 1 creatures and
  everything else are text-to-image (`nano-banana`, 3 credits each); stages 2 and 3 are
  image-to-image from the previous stage with the reference used "only as a guide for
  colour palette and render style", which keeps a line recognisable while giving each
  evolution a new silhouette. Resumable; task ids go to `tools/meshy-log.jsonl`.
  `MESHY_API_KEY` comes from the environment and is never written to the repo.
- `art-src/`: the raw 1024px renders (webp q92).
- `tools/pack.py`: keys the magenta background out (the keyer from Dead Man's Pull),
  trims, fits and writes `img/*.webp` (creatures 400px, bosses 560px, icons 128px,
  backgrounds 1280×720). About 2.7 MB in all.
- `tools/sheet.py`: contact sheets for checking a batch by eye.

Re-roll one image: delete `art-src/<key>.webp`, run `gen-art.py <key>`, then `pack.py <key>`.

## Build log
- **g1**: first playable. 12 creature lines × 3 stages, 6 bosses, 6 biomes with hazards,
  69 skills, 59 relics (51 + 8 legendary fusions) with 15 set bonuses, 17 charms,
  8 items, 10 mutations, 9 perks, 8 camp upgrades, 10 events. 148 Meshy images (about
  460 credits, including re-rolls). Balance from `sim.js`:
  - The first sim died in act-1 wild fights: wild foes matched the player 1:1, hits
    took 30% of a bar, and HP carried over with no recovery. Wild foes now scale by
    act (0.74 → 0.97), damage uses `A·pow·A/(A+0.65·D)`, and a won fight heals
    survivors 20% and stands the fallen up at 15%.
  - The act-1 boss was a cliff at evolution (2% at L6, 78% at L7): ultimates arrive with
    stage 2. Starters now begin at L5, act-1 XP is higher, stage multipliers are
    1.3/1.65, and bosses act once until they **enrage** below half HP.
  - Two earlier designs were redone for originality: the fire salamander came back too
    close to a famous fire lizard (now an axolotl), and the yellow electric rodent
    became a crystal-quilled hedgehog.
- **g2**: attack and hit animations, and bosses face the right way.
  - Each creature sprite sits in an inner `.rig` layer, so these animations run on top of the idle bob.
  - Melee attacks crouch, leap and strike while the body dashes in. Ranged and area skills rear back with an element glow, then fire and recoil; multi-hit skills cast once per shot.
  - Buffs, heals and shields play a power-up hop, and ultimates a big charged leap.
  - Hits flash white and knock the target away from the attacker; crits knock harder and shake the arena. Burn and poison ticks give a tinted shudder.
  - A dodge is a sidestep, a heal gives a green glow, and a knockout topples backwards before fading.
  - Bosses: the game mirrors every foe sprite to face the player, but the six boss renders were already drawn facing left, so they were turned around. Bosses are no longer mirrored.
- **g3**: **auto chess.** The turn-based battles and the dungeon map are gone; a run is now
  24 shop/place/fight rounds.
  - New `chess.js` (real-time grid combat) and `crun.js` (shop, pool, bench, merges,
    income, Tamer level, enemy boards) replace `battle.js` and `run.js`, and `game.js` is
    rebuilt around drag and drop and live fight playback.
  - Evolution is now merging (★2/★3 use the stage 2/3 art); the creature XP system became
    the Tamer level, which sets board size and shop odds.
  - The skill loadout replaces per-turn skill picks. New role traits sit next to the
    element traits. Items, perks and camp upgrades were reworked for rounds; mystery
    events and dens are retired.
  - Balance from `sim.js`. First pass: bosses were nearly unbeatable because a boss' star
    multiplied its already-large stats; bosses now get power only from a per-stage scale.
  - Fights that ran to the time limit were already over: a burn or quake wipe was only
    checked after a creature acted, so the end check now also runs after the per-second
    effects, and a double knockout counts as a loss.

