# Hollowmere style test: scale standard

**1 Unity unit = 1 metre.** The hero is **1.8 m** tall. Everything else is sized relative to that.

Code config: `Assets/Scripts/Game/StyleTest/StScale.cs` holds the constants, per-category target heights, `NormalizeHeight(go, Cat, h)`, `Measure(go)`, the world conversion and the game-camera helper. This doc is copied to `Assets/StyleTest/SCALE_STANDARD.md`.

## How height is measured
- Height is the **renderer bounds** of the object: max.y − min.y, in world metres.
  - Particles, the ignore-raycast layer (glow rings) and disabled renderers are skipped.
  - For actors, held weapons are excluded.
- **Posed, not bind-pose:** skinned bounds only refresh after the pose has been skinned for a rendered frame. Bestiary monsters and villagers therefore get a one-shot `StScaleSettle`, which re-fits height and floor contact on their second Update.
- It is model-agnostic: actors are normalised from their **measured** bounds, never per-model magic numbers.
  - KayKit heroes and skeletons: bind pose → `StActor.BindHeight = StScale.Hero`.
  - Quaternius villagers: `NormalizeHeight(Cat.Villager)`.
  - Bestiary monsters: `Entry.h`, which is the final height in metres.
- Hats, helmets and hair count towards height. KayKit chibi heroes are head-heavy, so a 1.8 m KayKit hero is shoulder-height to a realistic 1.75 m villager. That is the art style, not a scale error.

## Target heights (metres)
| Category | Target | Allowed | Notes |
|---|---|---|---|
| Hero (all skins: Knight/Ranger/Mage, Paladin/Sharpshooter/Fire Wizard) | 1.80 | 1.75–1.85 | idle pose, top of helmet/hat |
| Villager | 1.75 | 1.70–1.80 | |
| Regular humanoid enemy (skeletons, rat brute, imp, LP skeleton) | 1.80 | 1.5–1.9 | rat brute 1.5, imp 1.7 |
| Small critter (rat, snake, frog, slime, bat, spider, wasp, crawler) | 0.6–1.0 | | rat 0.6; snakes/frog 0.8; spider/slime/wasp/bat/crawler/rock spider 1.0; puglin (goblin-ish) 1.2 |
| Elite | 2.25 | ×1.25 hero | wraith, warwolf, horror, elite imp; KayKit skeletons ×1.25 |
| Boss | 4.50 | ×2–3 hero (3.6–5.4) | Death, dragon, mutant, lava golem; KayKit skeleton boss ×2.5 |
| Door / gate opening | 2.20 | 2.1–2.3 | clear height under the lintel |
| Market stall (overall) | 2.60 | 2.4–2.8 | VK stalls are pinned |
| Fountain | rim ~1.0, top 3.1 | rim 1.0–1.2, spire 2.5–3.0 | The VK model cannot meet both targets. It is pinned to 3.1 m overall, giving a measured rim of 1.02 m. |
| Lamp post | 3.2 | | |
| Bench | 0.9 | | backrest |
| House storey | ~3.0 | | eaves ~3 m, ridge 5–7 m |
| Dungeon wall | 3.17 | | KayKit wall, 4 DU × kit fit 1.32 × 0.6; dungeon grid tile 3.17 m |

## Kit fits (measured, not guessed)
The first scale lineup measured the kit doors against the ruler. Neither kit met the 2.1–2.3 m door standard:
- **KayKit Dungeon** (walls, doorways, floors, pillars, torches; also used for the town's dungeon gate): the doorway opening was **1.67 m**. Fix: **× `StScale.DungeonKit` = 1.32** everywhere it is spawned. The biome grid `T` scales with it, so rooms are 32% larger and walls 3.17 m tall.
- **KayKit Medieval Hexagon** town buildings (houses, tavern, church, smithy, windmill): the door was **1.43 m**. Fix: **× `StScale.HexKit` = 1.54**, so the 1-storey home is about 6.4 m tall to the chimney top.
- **Medieval Village Kit** (market stalls, fountain, props): real metres, 1:1. Stalls are pinned to 2.6 m and the fountain to 3.1 m (rim measured at 1.02 m).

`scale/tools/measure.py` re-measures door openings and the fountain rim from `doors.png` and `lineup.png` with the pixel mapping that StScaleShots logs. Kit meshes are not CPU-readable at runtime, so a raycast probe is not possible in the player.

## Design units → metres
The layouts (town, four biomes, the legacy room) and the skill/VFX recipes were authored in **design units (DU)**, in which the hero was 3.0. They are **not** hand-edited. Instead, each one is converted at a single point with **`StScale.DU = 0.6`**:
- **Builders** (`StTown.Build`, `StBiomes.Build`, `StWorld.BuildRoom`):
  - They snapshot the scene roots, build in DU, then call `StScale.ShrinkSince(snapshot)`. That call multiplies:
    - positions about the origin and scales by 0.6;
    - point and spot light ranges by 0.6 and intensities by 0.36 (inverse-square falloff, so the lighting looks the same);
    - wander paths and speeds and drift amplitudes by 0.6;
    - fog distances by 0.6.
  - `StActor`s (villagers) are only moved, because they are already metric.
  - Public anchors (`StTown.Spots/HeroSpawn`, `StBiomes.Hero/Spawns/Centre`, `StWorld.RoomMin/Max`) are returned in metres.
- **Real-metre kits** (Medieval Village Kit, "VK") spawn at 1/DU, so they come out at exactly 1:1 after the shrink. Pinned pieces (`StScale.KitHeights`: stalls, fountain, lamp posts, benches) are fitted to the standard.
- **Skills:**
  - `SkillDef` ranges and telegraph sizes stay in DU.
  - `StVfx.Play` evaluates a recipe in a DU frame centred on the cast origin. Bone and aim positions are mapped into that frame, and the fx root is then scaled by 0.6 about the origin, so every VFX size is relative to the hero.
  - `StSkillRunner` converts its hit tests, auto-aim, range clamp and knockback by DU.
- **Speeds:** actor speed and attack range are × 0.6 (6.5 → 3.9 m/s run).

New code should be written in metres directly. Use `StScale.DU` only when reusing a DU-authored number.

## Game camera
Pitch 52°, FOV 35, **10.2 m** behind the target (was 17 DU). The target is the hero + (0, 0.72, 2.1) m. Helper: `StScale.GameCam(cam, focus)`. Relative framing at 2340×1080 is unchanged from phase 5.

## Adding something new
1. Pick a category, or pass an explicit height in metres, and call `StScale.NormalizeHeight(go, cat[, h])` after spawning.
2. If it spawns inside a builder (in DU, before the shrink), pass `h / StScale.DU`.
3. Re-run `./scalerun.sh sc_heights` and check `scale/heights.txt`.
