# Glimmerdeep arena contract (v1)

Frozen so a second agent can build the sprite renderer without waiting on the
simulation, and so the simulation can land without changing the current game.

This is Stage 0–1 of a real-time arena autobattler (free-moving fighters,
dodgeable projectiles and skillshots with telegraphs, cast times, per-creature
tactics). It is **not** a replacement for `chess.js`.

## Feature flag

- Page: `?arena=1` (query param, exact string `"1"`).
- Headless sim: `ARENA=1`.
- A Settings toggle comes later and must set the same switch. It is not part of
  this stage. Do not add a toggle that defaults on.
- Flag **off**: `game.js` keeps calling `GC` (`chess.js`). Saves, Wilds, relics,
  the shop, `fightOpts()`, and `crun.js` output are unchanged. `chess.js` stays.
- Flag **on**: fights are created and stepped with `GArena` (`arena.js`).
  `fightOpts()` is still the only options object. `crun.endRound`, rewards, the
  Battle report, and Wilds battles all consume that fight state.

`arena.js` is a classic script (no `import` / `export`), no DOM, safe to load
on every page. It must not throw at load time. The global is **`GArena`**, not
`GA` — `GA` is already `GlimAnim` inside `game.js`.

```javascript
GArena.create(opts)   // same object fightOpts() returns; also Wilds' create() args
GArena.tick(st)       // exactly one step; returns the events emitted this step
GArena.resolve(st)    // tick until st.over or the time cap
GArena.alive(st, side)
GArena.byId(st, id)
GArena.view(st, alpha) // render snapshot, alpha in [0, 1)
GArena.hit(st, a, d, sk, ev, o) // same signature and same numbers as GC.hit
GArena.skillShape(id)
GArena.tacticOf(inst)
GArena.DT             // 1/30
GArena.HZ             // 30
GArena.AW             // 960
GArena.AH             // 600
GArena.CELL           // 120
GArena.TIME_LIMIT     // 60
GArena.EV             // 2
```

`opts` keys, all optional except the two rosters: `board`, `enemies`, `relics`,
`perks`, `biome`, `seed`, `depth`, `camp`, `foeBonus`, `mods`, `noHaz`. Each
roster entry is `{ inst, x, y }` with `x` in 0..7 and `y` in 0..4. The player
roster is already on columns 0–3; the enemy roster is already on columns 4–7.

## Arena

Logical size **960 × 600** (8:5). One prep-board cell is **120 × 120**. Column
`c`, row `r` has its center at `((c + 0.5) * 120, (r + 0.5) * 120)`.

| | |
|---|---|
| x | 0 left edge, 960 right edge. Player half is x &lt; 480. |
| y | 0 top, 600 bottom. Row 0 is the top row, same as the prep board. |
| up | decreasing y |

Bodies are circles. The default body radius is **26** arena units (the atlas
may override per creature). Units are clamped so the circle stays inside the
arena. Separation is soft: overlapping circles push apart along the contact
normal, half the overlap each, after velocity is integrated. Separation never
reads the wall clock.

### Spawn

```
jx = (jitter() - 0.5) * 36     // ±18
jy = (jitter() - 0.5) * 36
pos = ((x + 0.5) * 120 + jx, (y + 0.5) * 120 + jy)
```

`jitter` is a dedicated RNG, `GC.mkRng((seed ^ 0xA11A5EED) >>> 0)`, so it does
not consume the combat RNG `chess.js` uses. Jitter is applied in roster order
(player board, then enemies).

**Enemy mirror.** Do not reflect enemy x a second time. `crun.js` already
places the enemy front on column 4, which is the mirror of the player's front
on column 3 (the midline is x = 480). "Mirrored" means:

- enemy `facing` starts at **−1** (toward the player),
- a sprite authored facing right is drawn with `scaleX(-1)` when `facing < 0`,
- muzzle, feet and hit-frame x are flipped in code around the feet anchor.

Player `facing` starts at **+1**.

`unit.x` / `unit.y` stay the prep-board cell (integers). The renderer reads
`pos`, never `x`/`y`, for where to draw. Cell coordinates exist so the ported
perk and hazard checks (guardian adjacency, pierce, gusts) keep their meaning:
a cell is `floor(pos / 120)`, clamped to the board, and refreshed after each
step. At spawn, before any step, `x`/`y` are the roster cell, not the jittered
floor, so a damage probe taken before the first step sees the same cells as
`chess.js`.

## Time

Fixed step **30 Hz**. `DT = 1/30` second. The step index is an integer `st.n`.
Simulated time is `st.t = st.n / 30` (do not accumulate `t += 1/30`).

No frame-time dependence. `requestAnimationFrame` only chooses how many
**whole** steps to run and the interpolation alpha. Speed 2× runs two steps
per 1× second of wall time; it does not change the step size.

Cap **60 s** (`n === 1800`). At the cap the fight ends as a loss, same as
`chess.js`: `{ k: 'end', win: false, timeout: true }`, `st.over === 2`.
The cave still rumbles at 40 s (the same growing damage and the same `text`
event) so a stalled fight cannot sit at the cap with everyone full.

Target length at 1× is **15–30 s**. That is a tuning goal, not a clamp.

### Interpolation

At the start of a step each moving body copies `pos` into `prev`, then
integrates. Bodies that did not move still have `prev` equal to the previous
`pos`.

`alpha` is the fraction of the **next** step that has elapsed, in `[0, 1)`.

```
x = prev.x + (pos.x - prev.x) * alpha
y = prev.y + (pos.y - prev.y) * alpha
```

`GArena.view(st, alpha)` returns:

```javascript
{
  ev: 2, t: st.t, alpha, over: st.over, aw: 960, ah: 600,
  units: [{ id, side, x, y, facing, r, hp, maxHp, shield, mana, manaNeed,
            state, name, el, art, boss, star, alive }],
  projs: [{ id, x, y, vx, vy, r, el, friendly }],
  telegraphs: [{ id, shape, x, y, x2, y2, r, ang, arc, el, left, dur }]
}
```

`x`/`y` on that snapshot are **interpolated**. `state` is the discrete anim
state at the end of the last step (do not interpolate it). Projectiles and
telegraphs interpolate the same way (`prev` → current). The placeholder canvas
and the future renderer both draw from `view()` only.

## Unit state

Every fighter, including summons:

```javascript
{
  id, side,            // 0 player, 1 enemy. id is unique inside the fight
  inst, name, art, el, el2, role, star, boss, elite, shiny, summoned,
  x, y,                // prep cell, integer; see Spawn
  pos: { x, y }, prev: { x, y }, vel: { x, y },
  facing,              // +1 right, -1 left
  radius,              // body circle, arena units
  hp, maxHp, shield, mana, alive,
  state,               // 'idle' | 'run' | 'attack' | 'cast' | 'hit' | 'dead'
  tactic,              // resolved tactic, see below. Never null
  // combat bookkeeping ported from chess.js (st statuses, b stats, perk, …)
}
```

`state` is what the atlas clip follows:

| state | clip | when |
|---|---|---|
| `idle` | idle | standing, desired point reached |
| `run` | run | steering |
| `attack` | attack | basic wind-up through recovery |
| `cast` | cast | cast time and channel |
| `hit` | hit | flinch; stun uses hit and holds it |
| `dead` | death | `alive === false`, plays once |

A stun sets `state` to `hit` and interrupts a cast or a wind-up.

## Tactics

Stored on the creature as `inst.tactic`. Every field is optional. A missing
or unknown field uses the role default, so old saves load unchanged. Extra
fields are ignored. The resolved object is copied onto the fighter at spawn;
editing it mid-fight does not write the save.

Tokens (what is stored) and labels (what a future UI shows):

| field | token | label |
|---|---|---|
| stance | `aggressive` | Aggressive |
| | `pursue` | Pursue |
| | `balanced` | Balanced |
| | `cautious` | Cautious |
| | `behind` | Behind Allies |
| | `defensive` | Defensive |
| spacing | `tight` | Tight |
| | `close` | Close |
| | `balanced` | Balanced |
| | `loose` | Loose |
| focus | `closest` | Closest |
| | `lowest` | Lowest HP |
| | `healers` | Healers |
| | `backline` | Backline |
| | `threat` | Biggest threat |
| ff | `avoid` | Avoid |
| | `calculated` | Calculated |
| | `dodge` | They'll Dodge |
| aoe | `natural` | Natural |
| | `2` | ≥2 |
| | `3` | ≥3 |

Role defaults (`boss` is the role string on boss fighters):

| role | stance | spacing | focus | ff | aoe |
|---|---|---|---|---|---|
| striker | aggressive | close | closest | calculated | natural |
| caster | cautious | loose | backline | avoid | 2 |
| tank | defensive | tight | closest | avoid | natural |
| support | behind | balanced | healers | avoid | natural |
| boss | pursue | balanced | threat | calculated | 2 |

Meaning:

- **Stance** picks the desired point. Aggressive and Pursue close inside
  preferred range. Balanced holds preferred range. Cautious kites to max range
  and sidesteps telegraphs. Behind stays on the friendly side of the ally
  centroid. Defensive holds the back 40% of its own half.
- **Spacing** scales preferred distance: tight 0.65, close 0.85, balanced 1,
  loose 1.25, times the fighter's attack range in units.
- **Focus**: closest euclidean; lowest HP fraction; healers prefer support
  role then lowest HP; backline prefers the enemy unit nearest that side's
  back edge; threat prefers the enemy with the highest recent damage to allies.
- **Friendly fire**: Avoid never damages allies. Calculated allows a shape
  only when it will hit strictly more enemies than allies. They'll Dodge fires
  anyway; allies treat it as a telegraph and try to leave.
- **AoE efficiency**: Natural casts whenever there is a legal target. `2` and
  `3` hold the cast until that many enemies are inside the shape.

**Mistakes.** Each focus pick, dodge decision, and AoE hold rolls `st.rnd()`.
With probability **0.08** the fighter does the simpler thing instead (focus
closest, fail the sidestep, or cast anyway). The roll is part of the combat
RNG.

## Events (schema v2)

`st.ev` is the full log. `tick` returns only the events appended during that
step, then also pushes them onto `st.ev`, matching `chess.js`. Kind is the
`k` field. `st.evVer === 2`.

### Kept from chess.js

Emit these with the same fields whenever the same thing happens, so
`fightstats.js` (called from the damage path, not from the log) and any
reader of the log keep working:

| k | fields |
|---|---|
| `move` | `u, x, y` — cell the body occupies after the step, only when the cell changes |
| `blink` | `u, x, y` — a leap that skips the in-between cells |
| `atk` | `a, t, rng, el` — emitted at the **hit frame**, not at wind-up |
| `cast` | `a, sk, n, ult, el, tg, aoe` — emitted when the cast **resolves**, with the targets actually affected |
| `aim` | `a, t, el` |
| `zap` | `a, t` |
| `perk` | `a, t, n, el`, plus optional `aoe`, `ring`, `heal` |
| `dmg` | `t, a, v, crit, eff, hp, sh, dot, thorn, basic, el` |
| `miss` | `t, a, dodge` |
| `heal` | `t, v, hp, sh, quiet` |
| `shield` | `t, v, sh` |
| `status` | `t, s`, optional `haz` |
| `cleanse` | `t` |
| `mana` | `t, v` |
| `react` | `t, name` |
| `ko` | `t` |
| `revive` | `t, hp, name` |
| `summon` | `u` |
| `flux` | `t, el` |
| `text` | `v` |
| `pushed` | `t` |
| `star` | `t` |
| `end` | `win`, optional `timeout` |

`st.over` is `0` while running, `1` on a player win, `2` on a loss. A double
knockout is a loss. `FightStats.init` / `basicHit` / `dmg` / `heal` / `shield`
/ `status` / `ko` / `revive` / `dodge` / `cast` / `row` are called from the
same points `chess.js` calls them.

### Added in v2

| k | fields | when |
|---|---|---|
| `attack_windup` | `a, t, el, wind` | basic attack starts. `wind` is seconds until the hit frame |
| `attack_hit` | `a, t, el, frame` | hit frame. `frame` is the atlas hit-frame index (default 3). `atk` is emitted in the same step |
| `cast_start` | `a, sk, n, ult, el, cast` | cast time starts. `cast` is seconds. Mana is **not** spent yet |
| `cast_end` | `a, sk, interrupted` | cast resolved or cancelled. `cast` (the chess event) is emitted in the same step only if `interrupted` is false |
| `channel` | `a, sk, t, left` | once per step while a channel still has `left` seconds |
| `telegraph` | `id, shape, a, x, y, x2, y2, r, ang, arc, el, dur` | a shape is shown before it hits. `dur` seconds. `shape` is `line`, `circle`, `cone`, or `ring` |
| `proj` | `id, a, x, y, vx, vy, r, el, life, ff` | a projectile spawns. Later steps move it; they do not re-emit `proj` |
| `knock` | `t, x, y, vx, vy` | a knockback or pull impulse is applied. `vx`/`vy` are units per second |
| `dash` | `u, x, y, x2, y2, dur` | the body commits to a straight dash/leap. `x,y` start, `x2,y2` end |

Projectile record inside the sim (not all of it is copied onto the `proj`
event): `{ id, a, pos, prev, vel, radius, el, life, pierce, ff, friendly,
skill, onHit }`. `ff` is the firer's friendly-fire token. `life` is remaining
seconds. `pierce` is how many **additional** bodies it may pass through (0
dies on the first hit).

## Damage

`GArena.hit` is a port of `GC.hit`, including status, reaction, trait, perk,
and relic hooks (`damage`, `heal`, `giveShield`, `applyStatus`, `ko`, the
every-second dots, hazards, enrage, phoenix). Same inputs and the same combat
RNG position must produce the same `dmg.v` and the same crit flag.

The combat RNG is `GC.mkRng(seed)` and is consumed in the same order as
`chess.js` `create()` (two rolls per fighter: attack delay, then move delay,
player roster then enemies). Spawn jitter does **not** use that stream.
A unit test calls `GC.hit` and `GArena.hit` on fights created with the same
`fightOpts` seed, before either fight steps, and asserts the numbers match.

Spatial delivery is new and may cause a hit not to land (a sidestep, a whiffed
melee). When it does land, the number comes from `hit`.

## Shapes

`GArena.skillShape(id)` returns one record:

```javascript
{
  id, t, shape,     // melee | projectile | line | cone | circle | dash | pull | knock | chain | summon | buff
  anchor,           // target | self | ground | muzzle
  cast, channel,    // seconds. channel 0 means the payload fires at cast end
  cd,               // seconds after a successful resolve before it may be cast again. 0 = mana is the only gate
  speed, radius, pierce, life, homing, // projectile
  length, width, arc, aoe, knock, hits,
  telegraph,        // seconds, usually equal to cast
  friendly,         // true for heals and ally shields
  hand              // true when a boss or ultimate override applied
}
```

Default by the skill's target-type `t` (every skill, including generated
kits). `cd` here is the **arena** recovery, not `data.js`'s `cd`. `data.js`
`cd` still only selects mana cost, via the same `manaCost` rule as `chess.js`
(ultimate 100, `cd >= 3` → 80, else 60).

| `t` | shape | cast | notes |
|---|---|---|---|
| `self` with only buffs/heal/shield/summon | `buff` or `summon` | 0.40 | anchor `self`. Summon when `fx.summon` is set |
| `self` with `pow` | `circle` | 0.40 | radius 80, anchor `self` |
| `ally` | `projectile` | 0.45 | homing 1, friendly, speed 480, radius 12 |
| `allies` | `circle` | 0.60 | radius 220, anchor `self`, friendly. Ultimates use cast 0.90 |
| `lowfoe` | `dash` | 0.35 | leap to a point just short of the target, then `hit` |
| `foes` | `circle` | 0.65 | radius 150, anchor `ground` on the focus. Telegraph leads the hit |
| `foes` + `ult` | `circle` | 1.00 | radius 220 |
| `foeN` | `chain` | 0.50 | `hits` = N, jump range 180. Ultimates use cast 0.90 |
| `foe` + `rng` | `projectile` | 0.40 | speed 460, radius 14, pierce 0, life 1.6. Aimed at the target's position at cast start (not homing) |
| `foe` melee | `melee` | 0.28 | hit frame at the end of `cast`; whiffs if the target left range |

Basic attacks are not in this table. A basic with range 1 is a melee wind-up
of **0.22 s** and a recovery of **0.16 s**. A basic with range &gt; 1 fires a
projectile at the hit frame (speed 520, radius 10, life 1.4). The swing
period is `1 / effAS` from the ported attack-speed formula, and is never
shorter than wind-up + recovery.

Mana is spent when `cast_end` fires with `interrupted: false`. A stun during
cast or channel emits `cast_end` with `interrupted: true`, spends no mana,
and applies no payload. The chess `cast` event is the resolve, so the Battle
report still counts a cast only when the skill actually goes off.

### Hand tunes

Only boss skills and ultimates override the table. `hand: true` on those
records. Generated species ultimates (`*_u`) use a role preset, not a
hand-written id:

| role | ultimate shape |
|---|---|
| striker | `projectile` if the skill has `rng` or range &gt; 1, otherwise `dash`, cast 0.70, speed 500 |
| caster | `circle` anchor `ground`, radius 240, cast 1.00 |
| tank | `cone` length 260, arc 1.2 rad, cast 0.85, plus the skill's own self-shield |
| support | `circle` anchor `self`, radius 240, cast 0.90, friendly payload kept |

Named overrides (these ids win over the role preset):

| id | shape | why |
|---|---|---|
| `magma_surge` `solar_flare` `tidal_wave` `blossom` `mycelium` `thunderclap` `tectonic` `eclipse` `spore_storm` `eruption` `tidal_coil` `static_field` `hex_gaze` `cyclone` `dune_quake` `rot_spores` `boiler_burst` `hurricane` `slag_wave` `lure_glow` `glacier_breath` `dread_roar` `grave_slam` `nebula_nova` `singularity` `cataclysm` `flux_breath` | circle, ground, radius 230, cast 1.00 | ultimate or boss "hit everyone here" |
| `pounce` `void_rend` `burrow_strike` `maw_crunch` `volt_dash` | dash, cast 0.30 | leap / pounce |
| `chain` `storm_swarm` `moonveil` `shard_volley` `avalanche` `thorn_volley` `galaxy_dust` `triple_breath` `mirror_storm` `rivet_storm` `soul_lanterns` `prism_barr` | chain, hits from `t`, cast 0.55 (0.90 if `ult`) | multi-hit |
| `crystal_beam` `riddle_beam` `star_crush` `moonbeam` `thunderhead` | line, length 520, width 28, cast 0.70 | beam |
| `sprout_call` `yeti_call` `squall_call` `sand_call` `croc_call` `moth_call` `beetle_call` `gale_call` `bat_call` `abyss_call` `ant_call` `wisp_call` `cosmic_call` | summon, cast 0.50 | calls an add |
| `reef_fort` `stone_wall` `bubble_wall` | circle, self, radius 240, friendly, cast 0.70 | team shield ultimate / wall |

Anything not listed and not an ultimate uses the `t` table. `GArena.SHAPES`
is the resolved map (id → record) built at load.

## Sprite atlas

One JSON document per creature form. Side view, **authored facing right**.
The renderer mirrors; the atlas does not contain left-facing frames.

```json
{
  "id": "cr_cind1",
  "image": "img/atlas/cr_cind1.webp",
  "facing": "right",
  "feet": [0.50, 0.92],
  "radius": 26,
  "muzzle": [0.82, 0.42],
  "clips": {
    "idle":   { "fps": 8,  "loop": true,  "frames": [ { "x": 0, "y": 0, "w": 128, "h": 128 } ] },
    "run":    { "fps": 12, "loop": true,  "frames": [] },
    "attack": { "fps": 14, "loop": false, "hit": 3, "frames": [] },
    "cast":   { "fps": 12, "loop": false, "hit": 4, "frames": [] },
    "hit":    { "fps": 12, "loop": false, "frames": [] },
    "death":  { "fps": 10, "loop": false, "frames": [] }
  }
}
```

- `frames[]` are pixel rects in `image`: `{ x, y, w, h }`.
- `fps` is per clip. Frame index is `min(last, floor(stateTime * fps))`.
  Looping clips wrap. Non-looping clips hold the last frame.
- `feet` is the anchor in **frame-normalized** 0–1, unflipped. The body
  circle sits on the ground at the feet. Screen position of a frame is such
  that the feet land on the interpolated arena position.
- `hit` is the hit-frame index inside that clip. `attack_hit.frame` and the
  cast payload use it. Default attack hit frame is 3, cast is 4, when the
  clip omits `hit`.
- `muzzle` is the projectile origin in the same unflipped 0–1 space. When
  `facing < 0`, mirror x around 0.5 (`mx' = 1 - mx`) before converting to
  arena units. Missing muzzle means "at the feet, 20 units in front of facing".
- `radius` is the body circle in arena units. Missing means 26.
- Clips required: `idle`, `run`, `attack`, `cast`, `hit`, `death`. A missing
  clip falls back to `idle` (and `death` falls back to holding `hit`).

No atlas files are shipped in this stage. `view().units[].art` is the
`img/` key. A missing sheet is baked from that painting (see below).

## Determinism

Same `opts.seed` and the same rosters → the same `st.over`, the same `st.t`,
the same final hp list, the same event log. Forbidden: `Math.random`,
`Date.now`, frame delta, object-key order that is not insertion order, and
any position that is NaN or non-finite. A non-finite position is a bug; the
step must not invent a quiet fallback that hides it in the log, but it may
clamp a fighter back to its `prev` so one bad step cannot poison the page.

## What the placeholder view owns

Replaced by `arena-render.js` (`GArenaView`). The flag, the sim, and this
contract are unchanged. `game.js` still owns skip, speed, pause, the result
modal, and the Battle report. The canvas is `#arenaCv`. It draws from
`view()` plus the events `tick` already returns. No atlas files ship with
the game yet: a missing sheet uses the existing `img/` painting, baked to
about 48px and drawn nearest-neighbour. `arena-preview.html` loads a real
atlas JSON and cycles its clips.
