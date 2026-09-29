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
fight is up, `#scene3d` is `position: fixed` and fills the viewport. The
player's reels hang in the sky above the throne as spectral reels: the same
`#cabinet` (reels, holds, nudges, the fortune wheel chip) pinned to the top of
the screen with the cabinet art dropped and a translucent green glow. The
bottom strip is only the life bars, the log line and the spin row on a dark
scrim; the gear bar is hidden. The forecast sits just above that strip. The
class (`#game.death3d`) comes off when the fight ends, so a normal run is
unchanged.

The camera is one wide, fixed shot (b127). It is solved once per hero from
the settled idle pose (about half a second into the clip) and the measured
screen layout: the throne top sits just under the sky reels, Death's dais
stays above the strip, and the hero stands small in the lower left, whole
body in frame, his head below Death's and clear of him. Attacks, hits,
soul blasts and phase changes do NOT move the camera; only the intro rise
and the win and loss finishers do. Shake is a small tremor, and the idle
sway is applied to the camera only so it cannot drift. Win and loss dialogs
wait about 2.3s so the dissolve can finish. `LDDeath3D.marks()` gives Death's
and the hero's screen positions so the 2D damage numbers float off them.

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

## Skins
The worn Wardrobe skin (`hskinFor(hero)`) repaints the fighting hero. Its maps
are `textures/skins/<hero>_<skin>_<part>_{base,normal,mr}.webp` (parts: `body`
plus the hero's weapon names, e.g. the Knight's `shield` and `sword`), listed in
`../models3d/skins.json`. A material named `Material_N__<part>` takes that
part's maps; a missing map keeps the base look.

## What the fight asks the scene to play

Cues come from the existing enemy turn (`deathCue` in `enemyPhase`) plus
hurt, lunge, and flash already on `view`. Damage numbers still appear the
instant the hit lands. The projectile is the picture of that hit and
arrives a fraction of a second later, the way the old soul shots did.

| Cue | Picture |
|---|---|
| `atk` below 10, phase 1–2 | Soul blast: an orb gathers in the raised hand, then flies at the hero |
| `atk` of 10+ or phase 3 | Soul beam from the eyes, with wisps |
| `drain` | Souls pulled from the hero into Death (also Life Siphon and Wither) |
| `grow` | Souls spiraling into Death |
| `curse`, `jam`, `jamwheel` | A sigil and chains at the hero's feet (also Soul Chains) |
| phase change | Throne cracks, green fire, stronger rim light (no camera move) |
| win | Death slumps, then dissolves into souls; the hero plays victory |
| hero hp at 0 | Camera tilts down, hero plays death. Recovering hp stands him back up |

`prefers-reduced-motion: reduce` cuts shake to 15%, stops the sky reels'
float, and softens shot changes. Fast mode (`S.fast`) is ignored in this fight (b128). Pixel
ratio is capped at 2. The resting shot is solved once from the idle pose:
a wide shot with the hero small in the lower left and the throne under the
sky reels. Lighting matches the v2 mock:
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
