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
at their file size. Phones cap the pixel ratio at 1.5 and skip antialias,
brazier point lights, and most of the drifting motes. Desktop stays at 2.

Death is scaled a little larger than the throne (`pack.deathScale`) and
shifted so his hips stay in the seat. While the fight is up, `#scene3d` is
`position: fixed` and fills the viewport. The reels, spin, both life bars
and the log pack into a bottom strip (`#game.death3d`). The forecast sits
in a small chip just above that strip. The class comes off when the fight
ends, so a normal run is unchanged.

The resting camera is over the hero's shoulder, looking up at Death. An
intro rises from the dais into that shot. A resolve plays a short sequence
(hero push-in, cut to Death's flinch, or a wide low angle when a soul blast
or beam hits the hero) and then returns. Win and loss have their own
finishers. A tap on the 3D view skips the sequence. `prefers-reduced-motion`
and a reduce-flashing save flag (`S.reduceFlash`, `S.reduceFlashing`, or
`S.flashing === false`) crossfade those cuts instead of snapping them.

Lighting is real. A warm spot at the near `Socket_Flame_Brazier` casts
PCFSoft shadows (2048, or 1024 on a phone) onto the floor and the throne.
A green rim sits behind Death, his eyes are emissive, and a hemisphere
fills the room. Tone mapping stays ACESFilmic with an sRGB target, and the
hall has fog. Desktop adds UnrealBloomPass. Phones skip that pass and use a
soft additive halo instead. A RoomEnvironment PMREM is the env map, and
roughness/metalness are pulled off the clay defaults. The scythe mesh is
detached and re-parented so the hand sits about 40% up the shaft with the
blade over the shoulder. It swings on attack cues. A future `scythe.glb`
(origin at the grip, +Y toward the blade) drops in through `manifest.js`
`assets.scythe.url`.

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
ratio is capped at 2. Shadows are soft PCF from the torch key light
(r186 dropped `PCFSoftShadowMap`; the spot uses `shadow.radius`). The resting
shot sits on the hero's shoulder with a tighter field of view so Death
fills the hall. The scythe is aimed every frame: the hand stays about 40%
up the shaft, the blade leans out over the shoulder toward the camera, and
the flat of the blade faces the lens.

## Files

- `manifest.js` — slots, clip names, camera and seat.
- `placeholders.js` — the procedural Death, heroes, throne, and room.
- `scene.js` — renderer, lighting, animation, effects.
- `assets/` — the real models and VFX sheets. See `assets/README.md`.

three.js itself is `../vendor/three/` (r0.186.1, ES modules). It is not in
`art-src/` and `pack-art.py` does not read it.
