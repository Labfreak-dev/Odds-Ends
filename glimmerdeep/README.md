# Glimmerdeep

**Tame. Evolve. Delve.** A creature-taming roguelite auto-battler. Pick a partner,
recruit wild creatures, evolve them, stack relics into combos, and push through four
acts of branching dungeon to the Glimmer Core.

Play: https://labfreak-dev.github.io/Odds-Ends/glimmerdeep/

No build step. `index.html` loads four classic scripts in order:

| File | What it is |
|---|---|
| `data.js` | Every number and name: elements, species, skills, bosses, biomes, traits, relics, sets, fusions, charms, items, mutations, perks, camp upgrades, events. |
| `battle.js` | The battle engine. Pure logic, no DOM. `create()` sets a fight up, `round(st, plans)` resolves one turn and returns an event list. |
| `run.js` | The run: party, map generation, encounters, rewards, XP and evolution, shop stock, events. No DOM. |
| `game.js` | The UI: screens, map, battle playback (animates the event list), reward/evolution/recruit flows, shop, team, bag, camp, Glimdex, save. |

Because `battle.js` and `run.js` never touch the page, `sim.js` plays whole runs headless.

## Verify before shipping
```bash
for f in glimmerdeep/*.js; do node --check "$f"; done
node glimmerdeep/sim.js 300            # balance sim: win rate, where runs die, levels at each boss
python3 glimmerdeep/tools/smoke.py     # real page in headless chromium (pip install playwright==1.56.0)
python3 glimmerdeep/tools/smoke.py --mobile --nodes 9   # phone viewport, through the act-1 boss
python3 glimmerdeep/tools/smoke.py --deep --nodes 26    # boosted party, every node type, evolutions, act changes
```
The sim's bot plays badly on purpose (random paths, no skill choices, takes every
recruit): about 20% wins at Depth 0 is the target. A person choosing skills,
targets, paths and relics does much better.

## How it plays

### The run
4 acts. Each act is a branching map of 7 rows (the last act is 3) ending in a boss:

- **Wild battle**: 2-4 creatures from the biome. Win for gold and XP; ~42% chance one of them wants to join.
- **Elite**: tougher pack with one affixed elite (Vampiric, Thorned, Hasty, Shielded, Enraged). Relic pick of 3, better recruit odds.
- **Den**: choose 1 of 3 creatures to join.
- **Shop**: relics, charms, items, a creature egg, a full heal, rerolls.
- **Campfire**: heal 50% and revive, *or* train one creature +2 levels, *or* forge a legendary relic.
- **Mystery**: one of 10 events (shrine, egg, wishing well, sparring ring, glimmer pool, caravan, a trapped rare creature that fights you first, gambling imp, library, ancient forge).
- **Treasure**: relic pick of 3.
- **Boss**: then a Tamer perk, a relic, and the choice of which biome to enter next.

Act 1 is the Verdant Hollow; act 2 is Magma Forge or Sunken Grotto; act 3 is
Crystal Spire or Shadow Crypt; act 4 is the Glimmer Core and the Glimmerwyrm.

### Battles: turn-based auto-battling with one-tap control
Up to 4 creatures a side, in a front row (slots 1-2) and back row (3-4). Melee skills
must hit the front row first; ranged skills reach anyone. Each turn every creature
**already has a smart move picked** (the same planner the enemies use); tap a
different skill chip to override it, tap a foe to **focus** it, then **FIGHT!**
Turn on **Auto** and the rounds play themselves (1×/2×/3× speed). Turn order is by SPD.

Every creature has a basic attack, a skill, a second skill at L4, and an **ultimate**
once it evolves. Skills have cooldowns; ultimates fire from the **Overdrive** bar,
which fills from acting (+15), being hit (+8) and knockouts (+20).

Statuses: Burn (damage over time, halves healing), Poison (stacks), Soak, Stun, Root
(-40% SPD), Curse (+15% damage taken), Blind (35% miss), plus buffs, shields, regen,
dodge and taunt.

### Elements
Six elements, each strong against two (1.5×) and weak to two (0.67×); same-element
skills get 1.2×.

| Element | Strong vs |
|---|---|
| Ember | Bloom, Shade |
| Tide | Ember, Stone |
| Bloom | Tide, Stone |
| Volt | Tide, Shade |
| Stone | Ember, Volt |
| Shade | Volt, Bloom |

**Reactions** (the combo layer): Volt on Soaked = **Electrocute** (1.5×, may stun) ·
Tide on Burning = **Steam** (1.3×, blinds) · Ember on Poisoned = **Blight Burst** (the
stacks explode onto every foe) · Stone on Rooted = **Shatter** (sure crit, 1.3×) · Shade
on a Cursed foe under 25% = **Doom** (execute) · Ember on Soaked = *Fizzle* (0.7×, an
anti-combo). So a Tide support that soaks makes your Volt striker great, a Bloom
poisoner sets up your Ember caster, and so on.

**Team traits**: 2 or 3 creatures of one element on the field unlock a trait (Ember:
longer, hotter burns · Tide: soak every foe at the start · Bloom: team regen · Volt:
+SPD · Stone: front-row DEF · Shade: crits that curse). A **Dual Nature** mutation lets
one creature count for two elements.

### Biome hazards (things to counter)
| Biome | Hazard | Counter |
|---|---|---|
| Verdant Hollow | Spore Haze: non-Bloom allies gain Poison each turn | Bloom creatures, Purifying Incense, cleanses |
| Magma Forge | Scorching Heat: non-Ember/Stone allies lose 5% HP a turn | Tide creatures, Frostcore, healers |
| Sunken Grotto | Rising Flood: everyone permanently Soaked (Volt electrocutes, Ember weakened) | Volt and Bloom creatures, Gill Pearl |
| Crystal Spire | Prismatic Echo: foes reflect 20% of single-target damage | hit-all skills, Prism Lens, lifesteal |
| Shadow Crypt | Pitch Darkness: non-Shade allies miss 25% (an Ember hit lights the room) | Shade and Ember creatures, Lumen Moth |
| Glimmer Core | Elemental Flux: foes change element every turn | a mixed team, Kinship Knot |

You see the next act's hazard when you choose your path, and hazard-counter relics
are weighted up in relic offers for the current and next act.

### Growth
- **XP and levels**: everyone who fought gets full XP, the bench half (Golden Egg: full).
- **Evolution** at L7 and L14 (Sunstone and the Philosopher's Glimmer make it sooner): new
  art, +30%/+65% stats, the ultimate at stage 2, +12% skill power at stage 3. Each
  evolution offers a **mutation** (Hardened, Feral, Swift, Ironhide, Keen, Vampiric,
  Overcharged, Thorny, Dual Nature, Resonant). You can postpone an evolution.
- **Charms**: one per creature, stat-only (never drawn on the creature): ATK, DEF, SPD,
  HP, crit, lifesteal, regen, cooldowns, thorns, Grit (survive one knockout), reach the
  back row, or +25% to one element.
- **Shinies**: 1 in 48 recruits is a recoloured shiny with +10% stats.
- **Tamer perks** (the player's own upgrades, after each boss): Field Medic, Coach,
  Haggler, Tactician, Collector, Rallying Cry, Bulwark, Deep Pockets, Scout.
- **Camp** (between runs, paid in Glimmer Shards): starting gold, bench slots, a
  starting relic, revive seeds, recruit chance, starter levels, extra relic choices, a
  full heal after bosses. Every species you catch joins the starter pool. Winning
  unlocks **Depths** (harder foes, more shards).

### Relics: the combination system
51 relics with tags. Effects are folded into one team bonus at the start of a fight
(`teamBonus` in battle.js), so any combination stacks cleanly.
- **Set bonuses**: three relics sharing a tag light up a set (15 sets: Inferno, Tidal,
  Verdant, Storm, Bedrock, Umbral, Affliction, Precision, Aegis, Swiftness, Bloodline,
  Hoard, Prodigy, Overload, Unity). Most relics carry two tags, so a relic can push
  two sets at once.
- **Fusions**: eight pairs forge into a legendary at a campfire or the Ancient Forge
  (Ember Heart + Comet Core = Supernova; Volt Coil + Bottled Storm = Tempest Engine; Tide
  Pearl + Mirror Pond = Leviathan Pearl; Evergreen Seed + Morning Dew = World Seed;
  Bedrock Idol + Bulwark Shell = Mountain Heart; Night Orchid + Vampire Fang = Eclipse
  Eye; Lucky Purse + Loaded Die = Jackpot; Trainer's Tome + Sunstone = Philosopher's
  Glimmer). The bag shows every recipe you hold half of; relic offers say when a pick
  completes a set or a recipe.
- **Reaction relics** (Thundercloud, Geyser Stone, Blight Bulb, Fault Stone, Hex Doll)
  amplify the element reactions, so team composition, statuses and relics all feed
  each other.

### Mechanics added beyond the brief
Element reactions, team traits, biome hazards with counter relics, front/back rows with
focus targeting, boss enrage (bosses act twice under 50% HP), relic sets and fusions,
evolution mutations (including Dual Nature), shinies, Tamer perks, the trapped-creature
event (beat it to recruit it), a Glimdex, Depth difficulty, and fatigue after turn 20
so a stalled fight always ends.

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

