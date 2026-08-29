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
grid**. That is a very small maze. Pick one deliberately:

- **(a) Small-grid design.** Embrace 8x5-ish. Fewer, more meaningful walls.
  Simplest, works on every device, no new UI.
- **(b) Pan/zoom the stage.** Bigger grid, but needs gesture handling that
  doesn't fight the page scroll — the fishing scene already had to solve
  exactly this (`pan-y`, no idle capture; see Batch 19d).
- **(c) A separate build mode** that zooms in to place, then returns to a
  fitted view for the battle. Most work, best of both.

**Do not skip this decision.** Designing a 20x12 maze on desktop and
discovering it is untappable on a phone is the expensive failure here.

## 3. What has to be built

1. **Map format.** Replace `path:[…]` with a tile grid: per-cell terrain,
   buildable flag, elevation tier, one or more spawns, and the gate. Keep
   `name/cost/scrap/base/note` — the economy reads those.
2. **Pathfinding.** A\* or a flow field from spawn to gate, recomputed on
   every build/sell. A flow field is the better fit: one pass serves every
   mob, and the grid is small.
3. **The no-seal rule.** A placement that would completely block the route
   must be rejected *before* it is committed, with a clear refusal. The
   standard trick is to test the placement on a scratch grid and roll back
   if no path exists. Decide also whether mobs attack walls when boxed in.
4. **Tiers as gameplay.** This is the actual ask: elevation must *mean*
   something. Suggested: mobs move only between cells within one tier step,
   so a raised tier is a wall unless a ramp/stair connects it — which makes
   terracing the maze-building verb, and reuses the Batch 53 art.
5. **Placed towers.** Towers gain `(cell, type, level)`. The `{blue:1,…}`
   level model and the four fixed slots both go away. Needs a new cost
   curve: per-instance placement cost plus per-instance upgrades, replacing
   `base * 1.9^level`.
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

## 7. Questions for the bench to answer first

1. Which phone approach — (a) small grid, (b) pan/zoom, or (c) build mode?
2. Do mobs attack walls when boxed in, or is sealing simply forbidden?
3. Do the four existing maps become grids, or does this ship as a fifth map
   while the originals stay on the old lane engine? (Shipping alongside
   avoids a migration cliff but means maintaining two engines.)
4. Does tower placement cost scale per-tower, or is there a build budget?
