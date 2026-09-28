# Death arena (3D)

The final Death fight draws a third-person throne room with three.js
instead of the flat painting. Fight rules, turns, phases, rewards, the
reels, and input are unchanged. This folder is only the picture.

`index.html` lazy-imports `scene.js` the moment a Death fight starts
(`kickDeath3D` from `startDeathFight` and from the frame loop). A normal
run never fetches it. If WebGL is missing, the module throws, or a later
frame throws, the WebGL canvas is hidden and `drawDeathArena()` paints the
old arena again. The life bar and floating numbers always stay on the 2D
canvas, on top of the 3D view.

## Real assets

The fight loads `assets/models/` and `assets/textures/` through
`manifest.js`. Characters are meshopt, the throne and the room are Draco,
and the textures are WebP. GLTFLoader, DRACOLoader, and the meshopt decoder
are fetched with the fight, only when a slot has a url. Only the hero who
is actually fighting is downloaded. A missing or broken GLB logs a warning
and keeps the procedural placeholder for that piece. If the room, the
throne, or Death fails, the whole placeholder room stays.

World: meters, +Y up, characters face +Z, floor at y = 0. `death.glb` and
`throne.glb` share an origin, so they both sit at identity and Death is
already in the seat. The hero is placed on `Marker_Hero` (0, 0, 6.5) and
the anchor is yawed 180° so his back is toward the camera. Do not yaw the
hero file as well. The env file also carries flame sockets and the camera
marker. File names, clip names, and sockets are listed in `assets/README.md`.

| Fight name | Clip in the file |
|---|---|
| Death idle / cast / attack / hit / defeat | `Seated_Idle`, `Cast_Windup`, `Attack_Sweep`, `Hit_Flinch`, `Defeat_Slump` |
| Hero idle / attack / hit / dodge / victory / death | `Combat_Idle`, `Attack`, `Hit_React`, `Dodge`, `Victory`, `Death` |

A missing clip does not throw. `idle` loops. `defeat` and `death` hold
their last frame. Other clips play once and return to idle. Death's attack
plays the windup, then the sweep, and the blast or beam leaves
`Socket_RightHand` (the beam from `Socket_Eyes`) when the sweep starts.
Drain and heal use `Socket_Chest`. Hero clips that walk off their mark have
their hip x/z pinned back to the idle pose.

`fit: false` on these slots skips the bbox fit. The older `targetHeight` /
`anchor: 'seat'` path is still there for a file that is not already in
meters. `Attack_Sweep` and `Defeat_Slump` sink the robe a little; the scene
lifts Death 13 cm for those two clips. The win is a dissolve plus soul
particles, because the defeat clip is a slump. Robe and cape wind is a
vertex shader. On a phone or a machine with 4 GB or less, character
textures are drawn down to 1K before upload. The throne and the room stay
at their file size.

## What the fight asks the scene to play

Cues come from the existing enemy turn (`deathCue` in `enemyPhase`) plus
hurt, lunge, and flash already on `view`. Damage numbers still appear the
instant the hit lands. The projectile is the picture of that hit and
arrives a fraction of a second later, the way the old soul shots did.

| Cue | Picture |
|---|---|
| `atk` below 10, phase 1–2 | Soul blast: an orb gathers in the raised hand, then flies at the hero |
| `atk` of 10+ or phase 3 | Soul beam from the eyes, with wisps |
| `drain` | Souls pulled from the hero into Death |
| `grow` | Souls spiraling into Death |
| `curse`, `jam`, `jamwheel` | A sigil and chains at the hero's feet |
| phase change | Camera push, throne cracks, green fire, stronger rim light |
| win | Death slumps, then dissolves into souls; the hero plays victory |
| hero hp at 0 | Camera tilts down, hero plays death. Recovering hp stands him back up |

`prefers-reduced-motion: reduce` cuts shake to 15% and skips the camera
push. Fast mode (`S.fast`) shortens the effects. Pixel ratio is capped at 2.
There are no shadow maps.

## Files

- `manifest.js` — slots, clip names, camera and seat.
- `placeholders.js` — the procedural Death, heroes, throne, and room.
- `scene.js` — renderer, lighting, animation, effects.
- `assets/` — the real models and VFX sheets. See `assets/README.md`.

three.js itself is `../vendor/three/` (r0.186.1, ES modules). It is not in
`art-src/` and `pack-art.py` does not read it.
