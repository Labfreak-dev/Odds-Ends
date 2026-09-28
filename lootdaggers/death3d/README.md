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
at their file size. Phones cap the pixel ratio at 1.5 and skip antialias. Phones and software
GL also skip the shadow map, the bloom pass, and all but four point lights.
Desktop stays at a pixel cap of 2.

Death, the throne and the hall keep the asset package's scale. While the
fight is up, `#scene3d` is `position: fixed` and fills the viewport. The reels,
spin, both life bars and the log pack into a bottom strip (`#game.death3d`).
The forecast is a chip at the top of the screen, off the hero and the throne
base. The class comes off when the fight ends, so a normal run is unchanged.

The resting camera sits at shoulder height behind the hero so his back stays
in frame, with the throne centred and the pillars at the sides. An intro rises
into that shot. A resolve plays a short sequence (a push from behind the hero,
a cut to Death's flinch, or a side angle on a soul blast that still looks up
the hall) and then returns. Win and loss have their own finishers, and the
result dialog waits about 1.8s so the finisher is on screen first. A tap on
the 3D view skips the sequence. Shot timing follows the wall clock, so a slow
frame does not stretch the intro.

`prefers-reduced-motion` and a reduce-flashing save flag (`S.reduceFlash`,
`S.reduceFlashing`, or `S.flashing === false`) crossfade those cuts instead of
snapping them.

Lighting follows the artist's render. The hall is dark: thin near-black
`FogExp2`, a low hemisphere, and a dimmed backdrop so the ceiling is not a
teal band. Warm orange point lights sit on the throne-side braziers (candles
are sprites only). A small green soul light and a tight wisp sit on Death's
chest, not over his skull. A real GPU casts one 512 shadow from the near
brazier and blooms only pixels above a high threshold, so flames, eyes and
soul sprites halo and the bone throne does not. Phones and software GL skip
the shadow map, the bloom pass and the env map, light the characters with
Lambert and the hall with the texture only, and keep at most four
shadow-free point lights. Software GL also draws into a slightly smaller
buffer so the frame rate stays near the unlit fight. Tone mapping is AgX. The scythe is held nearly
upright, the curved blade's face toward the camera, the shaft through the
hand. A future `scythe.glb` (origin at the grip, +Y toward the blade) drops in
through `manifest.js` `assets.scythe.url`.

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

`prefers-reduced-motion: reduce` cuts shake to 15%, skips the phase push,
and softens shot changes. Fast mode (`S.fast`) shortens the effects. Pixel
ratio is capped at 2. The resting shot is shoulder height behind the hero,
throne centred, pillars at the edges. Lighting is a dark hall, warm braziers,
and green only as a soul accent on Death. Tone mapping is AgX. A real GPU
blooms flames, eyes and soul sprites above a high threshold; phones and
software GL use small additive sprites and no shadow map. Death, the throne
and the hall keep the asset package's scale.

## Files

- `manifest.js` — slots, clip names, camera and seat.
- `placeholders.js` — the procedural Death, heroes, throne, and room.
- `scene.js` — renderer, lighting, animation, effects.
- `assets/` — the real models and VFX sheets. See `assets/README.md`.

three.js itself is `../vendor/three/` (r0.186.1, ES modules). It is not in
`art-src/` and `pack-art.py` does not read it.
