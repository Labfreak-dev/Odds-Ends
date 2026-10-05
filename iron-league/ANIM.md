# Iron League animation table

Fighters are Time Fantasy side-view battlers. The game draws the packed sheets in `assets/timefantasy/`. `js/hero.js` no longer composites the Heroes99 layers; those files can stay on disk unused.

## Source frames

The pack’s singleframes are **48×48** RGBA, almost always **3 frames** to a motion, named like `1_1_walk (1).png`. Military files use the same pattern (`military1_1_bow (1).png`).

80 characters:

- `1_1` … `7_8` (seven sets of eight)
- `military1_1` … `military3_8`

Motions on every character: `idle1`, `walk`, `atk1`, `atk2`, `crouch`, `hit`, `cheer`, `magic`, `item`, `status`, and a death frame. `idle2` is on 79 of them. `bow` is on the 64 characters who are not gun troops. `gun` is on `military2_*` and `military3_*` only (16).

Quirks the packer absorbs:

- `1_1` idle2 files are named `1_1idle2` with no underscore before the motion.
- `1_4` has no idle2. The sheet copies `idle1` into that column. It also has an unused `walk2`.
- `1_1` dies on `down.png`. Everyone else uses `dead.png`. Both land in the `dead` column.
- `item` and `status` are not packed.

Standing art keeps its soles on row 44 of the cell, so the foot anchor is **(24, 45)**. The packed frames face left: a full sword swing and a gun's muzzle reach toward -x. The left team (`facing >= 0`) is mirrored so they look toward the opponent. The right team (`facing < 0`) is drawn as painted, looking back toward the left. Drawing is nearest-neighbour. The anchor stays put, so a lunge does not slide the feet.

## Packed sheet

`assets/timefantasy/<id>.png` is **576×144**: 12 columns by 3 rows of 48×48. `tools/pack-tf.py` builds them. Image URLs carry `?v=8` (the same generation as the script tags in `index.html`).

| Column | Motion |
|---|---|
| 0 | `idle1` |
| 1 | `idle2` |
| 2 | `walk` |
| 3 | `atk1` |
| 4 | `atk2` |
| 5 | `bow` |
| 6 | `gun` |
| 7 | `hit` |
| 8 | `crouch` |
| 9 | `magic` |
| 10 | `cheer` |
| 11 | `dead` |

A missing bow or gun column is left clear. Death is one painting, copied into all three rows.

## Clips

Frame numbers are still **1-based** and the combat windows are unchanged: `fps`, loops, and hit frames are the old table. Each game frame samples one of the three Time Fantasy frames. Sample index **2** is the sword’s full swing and the gun’s muzzle, and that is where the hit frames land. A bow’s loose is the same index.

`js/data.js` holds `CLIP_MOTION` and `CLIP_SAMPLE`. Archer, Ranger, and Skirmisher replace `atk1` only: a bow sheet plays `bow`, a gun sheet plays `gun`. Other clips stay on the motion below. Air attacks stay melee swings; those classes do not leap.

A sword, a gun, and a bow connect on frame index 2, so the weapon points the same way the fighter is facing when the hit lands. The shot samples `0,1,2,2,2,2`.

| Clip | Frames | Game id | Plays | Sample (3-frame index) | fps | Loop | Hit frames |
|---|---|---|---|---|---|---|---|
| IDLE 1 | 1–6 | `idle` | `idle1` | 0,1,2,0,1,2 | 8 | whole clip | — |
| IDLE 2 | 7–12 | `idle2` | `idle2` | 0,1,2,0,1,2 | 8 | whole clip | tank idle |
| RUN 1 | 13–20 | `run` | `walk` | 0,1,2,0,1,2,0,1 | 11 | whole clip | — |
| RUN 2 | 21–28 | `run2` | `walk` | 1,2,0,1,2,0,1,2 | 11 | whole clip | archer, rogue gait |
| JUMP | 29–32 | `jump` | `cheer` | 0,1,2,2 | 10 | once | — |
| FALL | 33–35 | `fall` | `cheer` | 1,1,2 | 10 | whole clip | — |
| LAND | 36 | `land` | `crouch` | 2 | 10 | hold | — |
| ATTACK 1 | 37–42 | `atk1` | `atk1`, or `bow` / `gun` | 0,1,2,2,2,2 | 12 | once | **39, 40** |
| ATTACK 2 | 43–48 | `atk2` | `atk2` | 0,1,2,2,2,2 | 12 | once | **45, 46** |
| ATTACK 3 | 49–52 | `atk3` | `atk2` | 0,1,2,2 | 14 | once | **51, 52** |
| AIR ATK 1 | 53–58 | `air1` | `atk1` | 0,1,2,2,2,2 | 12 | once | **55, 56** |
| AIR ATK 2 | 59–62 | `air2` | `atk2` | 0,1,2,2 | 12 | once | **61, 62** |
| CAST 1 | 63–67 | `cast1` | `magic` | 0,0, then 0,1,2 | 10 | 65–67 after 63–64 | — |
| CAST 2 | 68–72 | `cast2` | `magic` | 0,0, then 0,1,2 | 10 | 70–72 after 68–69 | — |
| HURT | 73–76 | `hurt` | `hit` | 0,1,2,2 | 12 | once | — |
| DIE | 77–81 | `die` | `dead` | 0,0,0,0,0 | 8 | hold 81 | — |
| DASH | 82–89 | `dash` | `walk` | 0,1,2,0,1,2,0,1 | 14 | 84–86 while moving | — |
| BLOCK | 90–94 | `block` | `crouch` | 1,1,1,1,1 | 10 | whole clip | — |
| ROLL | 95–102 | `roll` | `crouch` | 0,1,2,0,1,2,1,0 | 12 | once | — |

There is no jump, fall, dash, or roll painting in the pack. Those clips reuse cheer, walk, or crouch. Nothing is invented.

Playback still samples the frame index at the clip fps inside a 60Hz step, so a hit frame stays up for several steps and is not skipped.

Roll is not a dash. A dash closes through someone and can clip them. A roll bursts sideways, or out of a cast circle, with i-frames for about the first 0.42s and then a short recovery. The AI uses it against a melee windup, an arrow that will arrive, or a circle that is already filling.

## Looks

The creator and the hire board pick a **sheet id**, not skin, hair, cloth, and weapon layers. `LOOKS` in `js/data.js` is a curated pool per class. Archer and Ranger only offer sheets that have `bow`, and their ranged `atk1` plays it. Skirmisher offers the gun troops and plays `gun`. Changing class keeps the current sheet when that sheet is also in the new pool; otherwise it snaps to the class default.

An old save whose `parts` are still layered (`skin`, `face`, `hair`, `cloth`, `weapon`) is rewritten to `{ sheet }` on load. The sheet is chosen from that fighter’s class pool by a hash of the old parts, so the same save does not change look on every reload. The save key stays `ironleague.v1`.

## Combat FX

`js/fx.js` plays horizontal strips from `assets/fx/`. Frames are square and run left to right. Drawing is nearest-neighbour and usually additive. A procedural stroke sits under each burst and is the whole effect if that sheet never loads.

| File | Strip | Used for |
|---|---|---|
| `slash.png` | EnergyCrack, 96×24 | melee and air hit frames |
| `spark.png` | Fire, 128×24 | impact, loose, whiff |
| `boom.png` | SlowBlast gold, 96×16 | cast detonation, death |
| `plasma.png` | Plasma, 128×24 | mage cast 1 sigil |
| `orbit.png` | Orbit, 128×24 | tank guard, cast 2 ring |
| `bolt.png` | Branch lightning, 128×24 | cast 2 strike |
| `shot.png` | Shuriken ice, 96×16 | arrowhead glint |
| `dash.png` | EnergyCrack purple, 128×24 | rogue dash trail |
| `smoke.png` | Smoke magic, 96×24 | roll dust, shadowstep |

Class abilities reuse those strips. They do not add sheets.

| Class | Ability | Strip |
|---|---|---|
| Warrior | Cleave | slash |
| Archer | Multishot | shot |
| Mage | Frost Nova, Fireball | plasma, bolt |
| Tank | Taunt | orbit |
| Rogue, Assassin | Bleed, Shadowstep | spark, dash or smoke |
| Lancer | Charge | dash, slash |
| Berserker | Rage | spark |
| Healer | Mend | plasma |
| Ranger | Pierce Shot | shot |
| Battlemage | Arc Burst | plasma |
| Shieldbearer | Guard Zone | orbit |
| Skirmisher | Skirmish | dash |
| Duelist | Lunge | slash |
| Elementalist | Nova, Bolt | plasma, bolt |
