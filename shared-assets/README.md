# Shared art packs

Sprite and FX packs other games and tools can pull from one place. Iron League
keeps its own copies under `iron-league/assets/` so GitHub Pages paths stay
put. This tree is the copy to browse and reuse.

No Git LFS. Every file here is a normal git blob, and none is over GitHub's
100 MB file limit.

| Pack | Path | Files | About |
|---|---|---|---|
| Heroes99 v1.2 | [`heroes99/`](heroes99/) | 774 | Modular character layers (cloth, hair, face, skin, weapon) plus banners and color source files |
| Elements Core | [`elements-core/`](elements-core/) | 592 | Layered PNGs, premade sheets, guide, TDSM style companion, and a short README. Generator apps are not in the repo |
| BitFX packs 1–4 | [`bitfx/packs/`](bitfx/packs/) | 84 PNGs | Premade FX spritesheets and a thumbnail per pack |
| BitFX Forge licenses | [`bitfx/forge/`](bitfx/forge/) | 6 | App license, third-party notices, and a short README. The Windows `.exe` is not in the repo |

## Heroes99 v1.2

Full archive contents, unpacked from `Heroes99_v1.2/`.

Iron League composites fighters from `iron-league/assets/heroes99/`. That
folder is a byte-identical subset of this pack: all 765 PNGs match. Nine
files live only here: `bannercrt.gif`, `bannerplain.gif`,
`color_variations.gif`, `layer.gif`, `list_of_animation_full.gif`,
`samples.gif`, `weapon_types.gif`, `clothcolor.aseprite`, and
`haircolor.aseprite`.

The archive ships no license file.

## Elements Core

See [`elements-core/README.md`](elements-core/README.md). Sheets and the
guide are committed. The Windows, Linux, and macOS Elements Character
Generator binaries stay on the
[Character-asset-gen v1 release](https://github.com/Labfreak-dev/Character-asset-gen/releases/tag/v1).

## BitFX

Premade sheets:

- [`bitfx/packs/1/`](bitfx/packs/1/) — 36 PNGs (35 spritesheets + `thumbnail.png`)
- [`bitfx/packs/2/`](bitfx/packs/2/) — 16 PNGs
- [`bitfx/packs/3/`](bitfx/packs/3/) — 16 PNGs
- [`bitfx/packs/4/`](bitfx/packs/4/) — 16 PNGs

Each pack keeps `spritesheets/` and `thumbnail.png` as they were packed.
Sheet names include size and frame count, for example
`Plasma [size128] [frames24].png`.

Iron League plays a renamed subset from `iron-league/assets/fx/` (see
`iron-league/js/fx.js`). Those nine files match these sheets:

| Iron League | BitFX sheet |
|---|---|
| `assets/fx/bolt.png` | `packs/1/spritesheets/BranchLightning_Biolume [size128] [frames24].png` |
| `assets/fx/dash.png` | `packs/1/spritesheets/EnergyCrack [size128] [frames24].png` |
| `assets/fx/slash.png` | `packs/1/spritesheets/EnergyCrack_2 [size96] [frames24].png` |
| `assets/fx/spark.png` | `packs/1/spritesheets/Fire [size128] [frames24].png` |
| `assets/fx/orbit.png` | `packs/1/spritesheets/Orbit [size128] [frames24].png` |
| `assets/fx/plasma.png` | `packs/1/spritesheets/Plasma [size128] [frames24].png` |
| `assets/fx/shot.png` | `packs/4/spritesheets/Shuriken_Ice [size96] [frames16].png` |
| `assets/fx/boom.png` | `packs/4/spritesheets/SlowBlast_Gold [size96] [frames16].png` |
| `assets/fx/smoke.png` | `packs/4/spritesheets/Smoke_Magic [size96] [frames24].png` |

The premade pack zips did not include a license file. BitFX Forge, the
Windows tool that came with them, did. Its texts are in
[`bitfx/forge/license/`](bitfx/forge/license/), and
[`bitfx/forge/README.md`](bitfx/forge/README.md) says what was left out.
