# Iron League animation table

Measured from the Heroes99 v1.2 sheets in `assets/heroes99/`, checked against `frameguide_v2.png`.

## Sheet facts

Every layer is an **800×680** RGBA PNG. The pack contains **102** sprites, numbered left to right, top to bottom, the same way the frameguide labels them.

They are **not** a uniform 10×10 grid of 80×68 cells. That grid is only the canvas size (10×80 by 10×68). The figures are packed tighter:

- Horizontal pitch is about **100px** (body centers near x = 41, 141, 241, …).
- Vertical pitch is about **40px**.
- A wide swing, cape, or trail crosses the naive 80×68 cell, so cropping cells splits bodies in half and leaves empty cells that are only overflow.

`js/hero.js` stores a measured rectangle per frame: `[x, y, w, h, ax, ay]`. `ax, ay` is the foot point inside that crop (skin centroid x, skin bottom y), padded by one pixel and clamped to the sheet. Drawing places that foot on the arena ground and flips horizontally for facing.

The rects are the union of opaque pixels (alpha > 16) across every sheet in the pack, each pixel assigned to the nearest skin anchor. Widest frame is 68px, tallest 35px. Neighboring rects do not overlap.

88 layer files are fully transparent 800×680 placeholders (mostly cloth or hair “top” sheets with nothing to draw). They still load and composite as empty.

## Draw order

Bottom to top, one blit of each full sheet into an 800×680 atlas, cached by part ids:

1. `weapon_bot`
2. `cloth_bot`
3. `skin`
4. `face`
5. `cloth_top`
6. `hair_bot`
7. `hair_top`
8. `weapon_top`

Parts: skin `c1–c6`, face `c1–c7`, cloth `cloth1–cloth17` × `c1–c8`, hair `m1–m14` and `f1–f9` × `c1–c10`, weapons `weapon1–weapon4` (no tint) and `weapon5` × `c1–c4`.

## Clips

Frame numbers are **1-based and inclusive**. `fps` is what the game plays. Hit frames deal melee damage once per swing (or release one projectile) the first time a listed frame connects.

| Clip | Frames | Game id | fps | Loop | Hit frames | Used in the pit |
|---|---|---|---|---|---|---|
| IDLE 1 | 1–6 | `idle` | 8 | whole clip | — | default idle |
| IDLE 2 | 7–12 | `idle2` | 8 | whole clip | — | tank idle |
| RUN 1 | 13–20 | `run` | 11 | whole clip | — | warrior, mage, tank |
| RUN 2 | 21–28 | `run2` | 11 | whole clip | — | archer, rogue |
| JUMP | 29–32 | `jump` | 10 | once | — | warrior and rogue leap |
| FALL | 33–35 | `fall` | 10 | whole clip | — | leap descent |
| LAND | 36 | `land` | 10 | hold | — | leap landing |
| ATTACK 1 | 37–42 | `atk1` | 12 | once | **39, 40** | warrior, archer (shot), tank, rogue |
| ATTACK 2 | 43–48 | `atk2` | 12 | once | **45, 46** | warrior, tank |
| ATTACK 3 | 49–52 | `atk3` | 14 | once | **51, 52** | warrior finisher, rogue |
| AIR ATK 1 | 53–58 | `air1` | 12 | once | **55, 56** | warrior leap |
| AIR ATK 2 | 59–62 | `air2` | 12 | once | **61, 62** | warrior and rogue leap |
| CAST 1 | 63–67 | `cast1` | 10 | 65–67 after 63–64 | — | mage, wide circle |
| CAST 2 | 68–72 | `cast2` | 10 | 70–72 after 68–69 | — | mage, tighter hotter circle |
| HURT | 73–76 | `hurt` | 12 | once | — | flinch if idle or running |
| DIE | 77–81 | `die` | 8 | hold 81 | — | death |
| DASH | 82–89 | `dash` | 14 | 84–86 while moving; 87–89 are the unused recovery | — | rogue, offensive |
| BLOCK | 90–94 | `block` | 10 | whole clip | — | tank |
| ROLL | 95–102 | `roll` | 12 | once | — | defensive evade, brief i-frames |

The frameguide’s labels match this split: six idles, eight-frame runs, jump 29–32 then fall 33–35 and land 36, the three attacks, both air attacks, both casts with the boxed loops, hurt, five-frame death, dash with the boxed loop on 84–86, block, and an eight-frame roll. Attack 1’s blade reaches farthest forward on 39–40 (union width 64 then 56). Attack 2 does the same on 45–46. Attack 3’s long reach is 51–52 (forward extent about 46px and 39px past the body). Those are the hit frames.

Playback samples the frame index at the clip fps inside a 60Hz sim step, so a hit frame is visible for several steps and is not skipped.

Roll is not a dash. A dash closes through someone and can clip them. A roll bursts sideways, or out of a cast circle, with i-frames for about the first 0.42s and then a short recovery. The AI uses it against a melee windup, an arrow that will arrive, or a circle that is already filling.

## How it was measured

1. Connected components on `skin/skin_c1.png` (alpha > 20, blobs under 20px dropped) produced 102 bodies.
2. Bodies clustered into rows when the vertical gap of centroids exceeded 18px, then sorted by x. That order matches the frameguide numbering, including rows that hold 4, 5, 6, or 8 sprites rather than 10.
3. Every other PNG’s opaque pixels were assigned to the nearest body centroid. The union box, padded by 1px, is the crop.
4. The anchor is that skin blob’s centroid x and bottom y, so a lunge shifts the body and a slash does not yank the feet sideways.

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
| `smoke.png` | Smoke magic, 96×24 | roll dust |
