# Batch brief — The Keep becomes a real tower defense

Goal, in the playtester's words: *players can expand and edit the map with
different tiers to create a sort of maze for the mobs, like a true tower
defense game.*

This is a **rewrite of the Keep's engine**, not a feature bolted onto it.
The brief exists so that's clear before anyone starts, and so the two
constraints that decide the design are known up front.

---

## 1. Why it's a rewrite

The Keep today is not spatial. Verified in `workshop/keep.module.js`:

- **A mob's position is a single number.** Movement is `f2.x -= f2.spd*dt`.
  `kpPathPoint(x)` turns that one scalar into screen coordinates by
  interpolating `KP_PATH`, the hardcoded polyline on each map entry.
- **Targeting compares those numbers**: `tgt.x > t.x`. Range is 1-D distance.
- **There is no grid and no pathfinding anywhere in the module.**
- The terraces, stairs, bridge and switchbacks added in Batch 53 are
  *decoration drawn around a 1-D lane*. Mobs do not navigate them.

**And towers are not placed.** `K.towers` is `{blue:1, red:0, yellow:0,
purple:0}` — four *levels*, one per type, drawn at four fixed `slots:[[x,y]…]`
coordinates baked into each map. Cost is `base * 1.9^level`. There is no
concept of a tower having a position the player chose.

So the maze feature needs new versions of: map format, movement, pathfinding,
tower placement, tower economy, targeting, and rendering. Roughly the whole
mode below the economy layer.

## 2. The constraint that should drive the design: phones

A maze you build by tapping cells has a floor on cell size. The Keep's stage
is an 860x540 scene scaled to fit; on a 390px phone that scale is 0.45 (after
the full-bleed fix in Batch 54; it was 0.38 before).

| internal cell | css px on a phone | grid that fits |
| --- | --- | --- |
| 64px (the art's native tile) | 29 | 13 x 8 |
| 80px | 36 | 10 x 6 |
| 97px | 44 | 8 x 5 |
| 128px | 58 | 6 x 4 |

A comfortable touch target is ~44 css px, which means a **97px cell — an 8x5
grid** if the player taps the fitted board directly. That is too small a maze.

**DECIDED: a separate build screen.** Tapping Build zooms into the board to
place comfortably, then returns to the fitted view to watch the wave. This
decouples maze size from what fits on a phone, so the grid can be as large as
the design wants. It is the most work of the three options considered, and it
brings requirements of its own:

- The build view needs pan, and a clear way back out.
- Panning must not fight the page scroll. The fishing scene already solved
  exactly this — see Batch 19d (`pan-y`, no idle capture) and reuse it.
- The fitted battle view still has to be readable at 390x245 css px, so
  towers and mobs need to stay legible at roughly 0.45 scale even though
  nobody is tapping them there.

## 3. What has to be built

1. **Map format.** Replace `path:[…]` with a tile grid: per-cell terrain,
   buildable flag, elevation tier, one or more spawns, and the gate. Keep
   `name/cost/scrap/base/note` — the economy reads those.

   **DECIDED: hand-built maps AND a free-build map.** Ship a few pre-made
   grid maps whose shape carries a player through a difficulty curve, and a
   separate build map where someone with the credits can raise whatever they
   like and see what they can come up with. Both run the same engine.

   **Building is allowed everywhere**, including the curated maps — a
   player who wants to tinker should never be told "not here". The curated
   maps differ by being BOUNDED: they ship with a designed shape and only
   part of the board unlocked for building, so the difficulty curve still
   means something. The free-build map has the whole board open. So the
   difference is how much room you get, not whether you may build at all.

   The four existing maps stay on the old lane engine and keep working —
   nobody loses a Highlands they paid 1,000,000 credits for. That does mean
   two engines coexist for a while, which is the accepted cost of not
   breaking saves.
2. **Pathfinding.** A\* or a flow field from spawn to gate, recomputed on
   every build/sell. A flow field is the better fit: one pass serves every
   mob, and the grid is small.
3. **The no-seal rule. DECIDED: sealing is forbidden.** A placement that
   would completely block the route is rejected *before* it commits, with a
   refusal the player can understand ("this would close the last way in").
   Test the placement on a scratch grid and roll back if no path exists.
   Mobs never attack walls — that keeps the maze a puzzle rather than a
   wall-off, and avoids wall health, repair costs and target-priority rules.
4. **Tiers as gameplay.** This is the actual ask: elevation must *mean*
   something. Suggested: mobs move only between cells within one tier step,
   so a raised tier is a wall unless a ramp/stair connects it — which makes
   terracing the maze-building verb, and reuses the Batch 53 art.
5. **Placed towers, paid for with LAND. DECIDED.** Towers gain
   `(cell, type, level)`; the `{blue:1,…}` level model and the four fixed
   slots go away. The player does **not** buy towers directly. Credits buy
   and raise LAND, and the land you hold grants how many towers you may
   place — with higher tiers counting for more than flat ground. So
   expanding and terracing the map *is* the economy, which is the feature
   the playtester actually asked for.

   Left to the bench to tune: how much land per tower, and how much extra a
   raised tier is worth. A defensible starting point is one tower per N flat
   cells, with a tier-2 cell counting double and tier-3 triple — so building
   upward is both the maze mechanic and the way to field more towers.
   Whatever the numbers, the existing `base * 1.9^level` curve should move
   onto LAND purchases so the Keep's spending curve survives.
6. **2-D combat.** Radius range, target selection (first/nearest/strongest),
   and projectile fx that fly to a point rather than along the lane.
7. **Rendering.** Grid overlay, build cursor, range preview, a live route
   preview so the player sees what their wall did, and a legible "blocked"
   refusal.
8. **Save migration.** Existing saves carry `towers` levels, `map`, `land`,
   `mapsOwned`, `cleared`, `wave`, `supp`, `held`. Migrate rather than
   reset — players own maps costing up to 1,000,000 credits + 1,000 scrap.
   Simplest honest migration: convert each tower level into that many placed
   towers on a default layout, and keep every map owned.

## 4. Carried-over requirement: give the sea room

From playtest: the animated sea added in Batch 53 is effectively invisible.
Measured on The Isle, edge of frame to where land starts, at the midline:

| left | right | top | bottom |
| --- | --- | --- | --- |
| 4px | 0px | 46px | 46px |

The island runs edge to edge. The only open water is a 46px band, which on a
phone is ~21 screen pixels. **The new map format should reserve a margin of
at least ~90 internal px (one cell) of non-buildable water/void on all four
sides**, so the sea has somewhere to live and the board reads as an island
rather than a full-bleed texture.

## 5. What must NOT change

The Keep's identity is economic, not twitch:

- **The castle never dies.** It pays a bonus on `currentMineRatePerMin`
  (wrapped once via `window.__kpWrap`).
- **Waves suppress income** rather than killing you — `K.supp`, capped at
  0.8, decaying only while the field is clear.
- **Every 5 waves cleared: Advance, or HOLD THE LINE**, freezing the wave
  spec and income growth.
- It stays **idle-friendly**: it must remain playable without constant
  attention. A maze TD that demands live micro would be a different mode.

## 6. Deliverable

Two files, as always: `workshop/keep.module.js` and `workshop/keep.css`.
No wiring needed — the Keep is already registered in the css list,
`MODULE_FILES`, the `tab-keep` splice, and the host's `UI_GAMES`.

Contract (unchanged, see CLAUDE.md): classic script, no `import`/`export`;
every global prefixed `kp`/`KP` (`KP_X`, `KP_TILES`, `KP_ART` are the current
three, everything else lives in the module's IIFE); no load-time throws;
`Object.assign` into `state.keep`, never replace it; assets as committed data
URIs; hooks by exact name.

Because this is large, **land it in stages** rather than one drop — grid and
pathfinding with the old towers first, then placement, then tiers. Each stage
is playable, which makes each stage testable.

## 6b. REVISED DIRECTION — the island grows outward

Playtest of stage 1 corrected the shape of this feature. Two things were
wrong in everything above:

**The board is not a fixed 860x540 frame.** The player BUYS SECTIONS of the
surrounding map to push the island outward into the sea, and the maze gets
huge because the land does. That reframes several earlier decisions:

- The "sea has no room" problem solves itself. The island starts small in
  open water; expansion is what fills the frame, and the water the player
  has not bought yet IS the margin. No map geometry needs reshaping.
- The camera has to zoom and pan, because the board outgrows the screen by
  design. This is no longer only a phone concern — it is the core view.
- Buying sections IS the land purchase that grants tower allowance, so the
  economy decided earlier lands exactly on this mechanic.

**Building is a PALETTE, not a single wall tool.** Stage 1 shipped
tap-a-square-for-a-wall; what is wanted is a menu the player picks from,
placing walls, stairs, paths, towers, and characters — including merchant,
woodcutter and mining folk, so the keep reads as a settlement rather than
only a defence.

### What art already exists to place

Terrain and structures, all in the module today: grass, earth and stone as
full 9-slice sets (`g00-g22`, `e00-e22`, `s00-s22`), water 9-slice
(`w00-w22`), `wall`, `bridge` / `bridgeH` / `bridgeV`, stairs (`st0-st2`),
`tree0` / `tree1`, rocks (`rockA0-3`, `rockB0-3`), `foam` animation frames,
`house`, and `deco0-3`.

Sprites: `castle`, `towerBlue` / `towerRed` / `towerYellow` / `towerPurple`,
`warrior`, `archer`, plus the five foes (`gnome`, `thief`, `bat`, `troll`,
`minotaur`) and `sheep`, `tnt`, `barrel`.

So walls, stairs, paths, bridges, towers, trees, rocks, houses and sheep are
all placeable with what is already committed.

### What art does NOT exist

**Merchant, woodcutter and miner sprites are nowhere in the workshop** —
checked every module. They have to be cut and committed like the rest of the
Tiny Swords art before those can be placed. Until then the palette should
simply not offer them, rather than substituting a warrior and pretending.

## 7. Still open

Answered by the playtester and settled above: sealing (forbidden), maps
(curated set plus a free-build map, old maps untouched), the economy (land
grants towers, tiers count more), and now the expansion model and the
palette in 6b. The "separate build screen" decision is superseded by the
zoom-and-pan camera, which it becomes a mode of rather than a substitute
for.

Left for the bench:

1. **How much land per tower, and what a raised tier is worth.** Needs
   playtesting, not a decision on paper.
2. **How much of each curated map is unlocked for building.** Settled that
   building is allowed everywhere; what is open is how much room each
   curated map gives before the free-build map takes over.
3. **How many curated maps**, and what each one teaches. Three or four that
   introduce one idea each will beat a single clever one.
4. **What the build screen shows** beyond the grid: route preview while
   placing, tower range, remaining tower allowance.
