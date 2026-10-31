# Hollowmere design spec

This file covers only P0 and P1. Floor depth is the only difficulty. There is no Normal–Torment ladder and no optional harder-dive toggle. An old save may still contain a `difficulty` field; load ignores it.

Balance curves (experience, monster life, loot odds) stay in `Hollowmere.Core.DesignTable`. They are not repeated here. P0 and P1 tunables below are the ones the player build reads, and the tests compare these tables to that class and to `Assets/Resources/FeelProfile.asset`.

The design canvas is 2340 by 1080 dp, landscape, origin at the top-left, +y down. 1 dp is one pixel of that canvas.

## P0. Inventory

The locked layout is the art pack's `layout_2340x1080` in `Assets/Art/UI/inventory/slices.json`. Those pixels are these dp values. The hero stands in the centre, gear runs down both sides, and the bag is on the right. The tooltip opens over the hero while an item is selected. The hero view overlaps the left column by 10 dp; the ornate frame is the border and the model sits in the clear middle. Slice borders in that json are Unity order L, B, R, T. `tooltip_header` is greyscale and is tinted by rarity. `paperdoll_panel.png` is not used.

### T.ui

| Screen | Id | X | Y | W | H |
| --- | --- | --- | --- | --- | --- |
| hud | portrait | 24 | 24 | 72 | 72 |
| hud | healthGlobe | 108 | 28 | 64 | 64 |
| hud | resourceGlobe | 184 | 28 | 64 | 64 |
| hud | xpBar | 108 | 100 | 360 | 16 |
| hud | gold | 24 | 124 | 280 | 28 |
| hud | buffRow | 24 | 160 | 400 | 36 |
| hud | minimap | 2136 | 24 | 180 | 180 |
| hud | quest | 1960 | 212 | 356 | 72 |
| hud | bossBar | 760 | 24 | 820 | 48 |
| hud | targetBar | 890 | 80 | 560 | 36 |
| hud | joystick | 24 | 896 | 160 | 160 |
| hud | primary | 2220 | 960 | 96 | 96 |
| hud | skill1 | 2108 | 984 | 72 | 72 |
| hud | skill2 | 2060 | 888 | 72 | 72 |
| hud | skill3 | 2148 | 808 | 72 | 72 |
| hud | skill4 | 2244 | 848 | 72 | 72 |
| hud | potion | 1980 | 984 | 64 | 64 |
| inventory | screen | 0 | 0 | 2340 | 1080 |
| inventory | hero | 300 | 110 | 1080 | 930 |
| inventory | header | 600 | 40 | 480 | 80 |
| inventory | leftColumn | 90 | 110 | 220 | 880 |
| inventory | rightColumn | 1400 | 110 | 220 | 880 |
| inventory | bag | 1640 | 60 | 660 | 960 |
| inventory | grid | 1690 | 210 | 560 | 700 |
| inventory | gridCell | 0 | 0 | 112 | 112 |
| inventory | tabs | 1690 | 120 | 560 | 72 |
| inventory | bottom | 1690 | 930 | 560 | 64 |
| inventory | close | 2214 | 40 | 96 | 96 |
| inventory | tooltip | 800 | 140 | 540 | 800 |
| vendor | panel | 48 | 48 | 2244 | 984 |
| vendor | goods | 72 | 120 | 900 | 760 |
| vendor | actions | 72 | 900 | 900 | 80 |
| vendor | grid | 1500 | 160 | 472 | 552 |
| hero | list | 24 | 120 | 400 | 880 |
| hero | stage | 448 | 120 | 1100 | 820 |
| hero | info | 1580 | 120 | 480 | 560 |
| hero | play | 960 | 960 | 420 | 72 |

The bag is 5 columns by 6 rows of 112 dp cells and no gap, so the cells are 560 by 672. The grid rect is 560×700; the extra 28 dp sits under the cells. Capacity is 30. The hero's feet anchor is the point (840, 1000). Empty slots show the greyscale ghost at 45% alpha. Cloak is drawn and is not equippable yet.

### T.bag

| Id | Value |
| --- | --- |
| columns | 5 |
| rows | 6 |
| gap | 0 |
| capacity | 30 |

### T.doll

| Slot | X | Y | W | H |
| --- | --- | --- | --- | --- |
| head | 144 | 134 | 112 | 112 |
| shoulders | 144 | 254 | 112 | 112 |
| chest | 144 | 374 | 112 | 112 |
| wrists | 144 | 494 | 112 | 112 |
| hands | 144 | 614 | 112 | 112 |
| belt | 144 | 734 | 112 | 112 |
| legs | 144 | 854 | 112 | 112 |
| amulet | 1454 | 134 | 112 | 112 |
| ring_l | 1454 | 254 | 112 | 112 |
| ring_r | 1454 | 374 | 112 | 112 |
| cloak | 1454 | 494 | 112 | 112 |
| feet | 1454 | 614 | 112 | 112 |
| mainhand | 1454 | 734 | 112 | 112 |
| offhand | 1454 | 854 | 112 | 112 |

The new-hero screen uses the hero rows above. Its centre is a 3D turntable of the class and the pet, not a portrait.

## P0. Movement and pets

The hero, monsters, and the pet share one motor. Velocity eases toward the wish at `accel` while speeding up and `decel` while slowing. Facing turns at `turn` degrees per second, or `attackTurn` during an attack. Clip rate is ground speed divided by `clipWalk`. Root motion is off. A missing run clip reuses the walk clip. A missing idle clip freezes it.

### T.motion

| Id | Value |
| --- | --- |
| accel | 28 |
| decel | 36 |
| turn | 540 |
| attackTurn | 900 |
| idle | 0.15 |
| walkRun | 3.2 |
| clipWalk | 2.2 |
| locoBlend | 0.18 |
| attackBlend | 0.12 |
| attackSeconds | 0.35 |

The pet paths on a navmesh built from walkable tiles. The slot is `trailBack` metres behind the hero and `trailSide` metres to the right. Speed is 0 inside `arrive` metres of the slot, otherwise `min(maxSpeed, cruise + catchup * (distance - arrive))`. A warp happens only after `stuck` seconds of no progress, or when the pet is off the mesh and farther than `warp` metres. An on-screen warp plays a burst. Coming back from town always bursts.

### T.pet

| Id | Value |
| --- | --- |
| trailBack | 1.75 |
| trailSide | 0.55 |
| arrive | 0.45 |
| cruise | 6.2 |
| catchup | 1.1 |
| maxSpeed | 14 |
| warp | 18 |
| stuck | 1.25 |
| sample | 2 |

### T.follow

| Id | Value |
| --- | --- |
| 0 | 0 |
| 0.45 | 6.2 |
| 2.45 | 8.4 |
| 20 | 14 |

### T.qa

| Id | Value |
| --- | --- |
| frames | 30 |
| fps | 10 |
| width | 2340 |
| height | 1080 |

`-qaFrames move` and `-qaFrames pet` use that size. `-qaShot town`, `dungeon`, `title`, `inventory`, and `newhero` are stills.

## P1. Combat feel

A cast releases when its windup ends. Whirling Steel uses the channel row: the strike column is the pulse, 330 ms, not the whole spin. Hit-stop pauses actors, not the UI. Shake is millimetres on the camera, decay 9 per second, cap 120 mm, with a Settings toggle that starts on. Crit numbers are `#ffe25a`, larger, and prefixed with `!`.

### T.cast

| Id | Windup | Strike | Recover |
| --- | --- | --- | --- |
| melee | 80 | 100 | 140 |
| projectile | 100 | 60 | 140 |
| nova | 160 | 80 | 180 |
| cone | 140 | 80 | 160 |
| dash | 60 | 80 | 60 |
| buff | 180 | 40 | 180 |
| channel | 0 | 330 | 0 |
| ground | 200 | 250 | 200 |
| chain | 120 | 80 | 140 |
| summon | 200 | 200 | 200 |

### T.hitstop

| Id | Value |
| --- | --- |
| normal | 40 |
| crit | 70 |
| skill | 55 |
| kill | 90 |
| hurt | 50 |

### T.shake

| Id | Value |
| --- | --- |
| normal | 30 |
| crit | 70 |
| skill | 50 |
| kill | 90 |
| hurt | 60 |
| decay | 9 |
| cap | 120 |

Shake is added in millimetres and then decays by `decay` per second, never past `cap`.

### T.sparks

| Id | Count | Speed | Life | Size |
| --- | --- | --- | --- | --- |
| normal | 6 | 2400 | 280 | 80 |
| crit | 12 | 3600 | 400 | 120 |
| skill | 8 | 3000 | 320 | 100 |

### T.numbers

| Id | Hex | Size | Rise | Life |
| --- | --- | --- | --- | --- |
| normal | f4f1ea | 50 | 1400 | 700 |
| crit | ffe25a | 82 | 1900 | 900 |
| hurt | ff5a4a | 55 | 1400 | 700 |

Sheets in `Assets/Art/Combat/vfx/` are 4×3 frames. Whirling Steel is 20 fps and loops. The others are 24 fps and play once. Charge, roll, mark, blink, and thrall have sheets. War Cry still uses a short placeholder. Hexweaver cast glyphs play at the hand or the feet for the matching cast. Trails are white and tint by weapon. Damage glyphs are the sprite font in that folder. A heal uses the green sheet.

### T.trail

| Id | Value |
| --- | --- |
| trailWidth | 60 |
| trailLife | 140 |
| trailHold | 180 |

Width and life are millimetres and milliseconds on the ribbon. `trailHold` is how long it keeps emitting.

### T.clips

Twin Shot, Volley, and Earthsplitter are the long Meshy takes. Playback keeps the strike and drops the hold. Frames are 24 fps, inclusive. `Source` is the last frame of the take.

| Id | Start | End | Source |
| --- | --- | --- | --- |
| st_attack_twinshot | 12 | 36 | 120 |
| st_attack_volley | 0 | 36 | 188 |
| ic_attack_earthsplit | 84 | 120 | 184 |

### T.vfx

| Id | Hex | Kind |
| --- | --- | --- |
| ic_cleave | e8e0d0 | arc |
| ic_slam | c4a574 | nova |
| ic_charge | d8d2c8 | dash |
| ic_whirl | f0e6c8 | spin |
| ic_warcry | e07040 | buff |
| ic_earthsplit | a86830 | line |
| st_twinshot | d8c8a0 | bolt |
| st_volley | c8b888 | fan |
| st_caltrops | 8a9a60 | ground |
| st_roll | 6a6a72 | dash |
| st_mark | e8d060 | buff |
| st_rain | 9ab0c8 | ground |
| hx_bolt | d08aff | bolt |
| hx_frostring | 9fd8f0 | nova |
| hx_chain | e8e070 | chain |
| hx_blink | c8b0ff | dash |
| hx_thrall | b0a0d8 | summon |
| hx_meteor | e0603a | meteor |
