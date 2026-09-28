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
| Death idle / cast / attack / hit / defeat | `Seated_Idle`, `Cast_Windup`, `Attack_Scythe`, `Hit_Flinch`, `Defeat_Slump` |
| Hero idle / attack / hit / dodge / victory / death | `Combat_Idle`, `Attack`, `Hit_React`, `Dodge`, `Victory`, `Death` |

A missing clip does not throw. `idle` loops. `defeat` and `death` hold
their last frame. Other clips play once (`LoopOnce`, clamped) and return to
idle. Death's attack is `Attack_Scythe` (2.58 s in the file): the swing
clears the throne, then the mixer crossfades back to idle. `Defeat_Slump`
drops the scythe at about 1.25 s. The blast or beam still leaves
`Socket_RightHand` (the beam from `Socket_Eyes`). Drain and heal use
`Socket_Chest`. Hero clips that walk off their mark have their hip x/z
pinned back to the idle pose.

`fit: false` on these slots skips the bbox fit. The older `targetHeight` /
`anchor: 'seat'` path is still there for a file that is not already in
meters. Death, the throne and the hall share the package scale (1). Do not
scale Death an extra 1.18 about the hips: that sinks his feet and the scythe
butt into the dais. The win is a dissolve plus soul particles, because the
defeat clip is a slump. On a real GPU the robe and cape also get a wind and
rim shader. On a phone or a machine with 4 GB or less, textures (including
normal and metal-rough maps) are drawn down to 1K before upload. Phones cap
the pixel ratio at 1.5 and skip antialias. Phones and software GL skip the
shadow map and the bloom pass. A phone lights the hall with the sun, the
dais and the two throne-side braziers; candles, the near braziers and the
green column are sprites. Desktop stays at a pixel cap of 2.

Death, the throne and the hall keep the asset package's scale. While the
fight is up, `#scene3d` is `position: fixed` and fills the viewport. The reels,
spin, both life bars and the log pack into a bottom strip (`#game.death3d`).
The forecast is a chip at the top of the screen, off the hero and the throne
base. The class comes off when the fight ends, so a normal run is unchanged.

The resting shot is framed on the settled idle pose (about half a second
into the clip), sampled once per hero and confirmed once more after the
idle is on screen, so the combat sway does not move the camera and the
opening frame is not the bind pose. A phone uses a 50° lens about 3 m
behind the hero, low and looking up: his head sits about a quarter of the way
in from the left and his head and shoulders stay under about 30% of the frame
height, with Death clear in the centre and the throne top in frame. On a wide
window the throne top stays inside the open area above the reel strip, and
Death's skull-to-feet span is about 40% of that height. The hero's head,
shoulders and cape stay above the strip. An intro rises into that shot. A
resolve plays a short sequence (a push from behind the hero, a cut to Death's
flinch, or a side angle on a soul blast that still looks up the hall) and
then returns. Win and loss have their own finishers, and the result dialog
waits about 2.3s so the dissolve can finish. A tap on
the 3D view skips the sequence. Shot timing follows the wall clock, so a slow
frame does not stretch the intro.

`prefers-reduced-motion` and a reduce-flashing save flag (`S.reduceFlash`,
`S.reduceFlashing`, or `S.flashing === false`) crossfade those cuts instead of
snapping them.

Lighting follows the v2 mock (`camera_shot_mock_v2.png`). AgX exposure
starts at about 1.23 and is tuned to 1.5 so the throne matches the PNG
without volumetric scatter. Fog starts at `FogExp2(0x374838, 0.027)` and is
tuned to 0.034. Materials stay
`MeshStandardMaterial` so the normal, roughness and metal maps show; sheen is
dropped. Eye glow keeps emissive strength 4. Light intensity is watts/4π:
four brazier points at 20.7, candles as sprites, a green top spot (199 cd,
25° half-angle), a wide green back spot, a cold key on the spine, a dais
uplight, a fill, a warm hero rim and a 0.35 sun. A real GPU shadows only the
green top spot (512) and blooms with `UnrealBloomPass(0.6, 0.8, 0.7)` before
`OutputPass`. Phones and software GL skip the shadow map, the bloom pass and
the env map. A phone uses the two throne-side brazier lights, the dais light
and the sun, and fakes the rest with sprites. Software GL uses that same
small set plus one green directional, and draws into a smaller buffer. A real
GPU uses the full spot rig. The scythe stays on
bone `Scythe_Grip` (a child of `LeftHand`) at identity. A warm directional
from the camera side lights the hero's back. The standalone scythe and prop
GLBs are not in the pack; the env already contains the hall pieces.

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
ratio is capped at 2. The resting shot is solved once from the idle pose:
on a phone the hero stands in the left quarter, and on a wide window Death
fills about 40% of the open area with the throne top in frame. Lighting matches the v2 mock:
warm braziers, green fog and a green column, AgX at about 1.23. A real GPU
blooms with strength 0.6 / radius 0.8 / threshold 0.7; phones and software
GL use additive sprites and no shadow map. Death, the throne and the hall
keep the asset package's scale. The attack clip is `Attack_Scythe`.

## Files

- `manifest.js` — slots, clip names, camera and seat.
- `placeholders.js` — the procedural Death, heroes, throne, and room.
- `scene.js` — renderer, lighting, animation, effects.
- `assets/` — the real models and VFX sheets. See `assets/README.md`.

three.js itself is `../vendor/three/` (r0.186.1, ES modules). It is not in
`art-src/` and `pack-art.py` does not read it.
