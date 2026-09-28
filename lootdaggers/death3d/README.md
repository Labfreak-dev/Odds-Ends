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

## Dropping in real GLBs

Edit `manifest.js` only. A slot with `url: null` uses the procedural
placeholder. Set `url` to a filename and that file is loaded from
`death3d/assets/` (a path starting with `http`, `/`, `./`, or `../` is
used as written). A missing or broken file logs a warning and keeps the
placeholder for that slot. GLTFLoader, DRACOLoader, and the meshopt
decoder are fetched only when at least one slot has a url, so the
placeholder fight does not download them.

```js
death: {
  url: 'death.glb',          // death3d/assets/death.glb
  targetHeight: 3.45,        // bbox height in meters after fit; null skips
  anchor: 'seat',            // 'seat' | 'feet' | 'none'
  seatFrac: 0.36,            // fraction of height planted on the seat
  scale: 1,                  // applied before the height fit
  facing: Math.PI,           // yaw in radians, after the up-axis fix
  up: 'y',                   // 'z' rotates X by -90° first (Z-up files)
  offset: [0, 0, 0],         // meters, after the fit
  clips: { idle: 'idle', cast: 'cast', attack: 'attack', hit: 'hit', defeat: 'defeat' },
}
```

World: +Y up, 1 unit = 1 meter. The hero stands near the origin facing +Z.
The throne sits down +Z (`layout.throne`). Death is parented to the throne
at `layout.deathSeat`, which is the cushion. The camera sits behind the
hero, a little above, looking up. Export characters facing +Z (glTF
default). Death's `facing: Math.PI` turns him toward the hero. Do not
also rotate the file 180°, or he faces the wrong way.

| Slot | Suggested file | Clips the fight asks for |
|---|---|---|
| `death` | `death.glb` | idle, cast, attack, hit, defeat |
| `throne` | `throne.glb` | — |
| `hero_knight` `hero_ranger` `hero_gambler` `hero_brute` `hero_duelist` `hero_hexpriest` | `hero_<id>.glb` | idle, attack, hit, dodge, victory, death |
| `environment` | `environment.glb` | — |
| `vfx` | `vfx_soul.png` `vfx_spark.png` `vfx_beam.png` `vfx_sigil.png` `vfx_wisp.png` | — |

`clips` maps the name the fight uses to the clip name in the file. Lookup
is exact, then case-insensitive, then substring. A missing clip does not
throw: the model stays on its rest pose (procedural wind-up, sway, and
lunge only drive the placeholder meshes). `idle` loops. `defeat` and
`death` hold their last frame. Other clips play once and return to idle.

`anchor: 'feet'` puts the bottom of the bbox on the anchor. `anchor: 'seat'`
(Death) puts `seatFrac` of the height on the cushion so the legs hang.
`fit: false` skips the bbox fit; the environment slot uses that and should
already be in meters. `environment.hide` lists procedural pieces to hide
once the file loads: `'room'` and, if the file includes a throne, `'throne'`.

Draco (`KHR_draco_mesh_compression`) and meshopt
(`EXT_meshopt_compression` / `KHR_meshopt_compression`) are wired. The
decoder files live under `vendor/three/` and are not loaded until a
compressed mesh is parsed.

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
| win | Death fades into souls, hero plays victory |
| hero hp at 0 | Camera tilts down, hero plays death. Recovering hp stands him back up |

`prefers-reduced-motion: reduce` cuts shake to 15% and skips the camera
push. Fast mode (`S.fast`) shortens the effects. Pixel ratio is capped at 2.
There are no shadow maps.

## Files

- `manifest.js` — slots, clip names, camera and seat.
- `placeholders.js` — the procedural Death, heroes, throne, and room.
- `scene.js` — renderer, lighting, animation, effects.
- `assets/` — where the real files go. Empty apart from its note until then.

three.js itself is `../vendor/three/` (r0.186.1, ES modules). It is not in
`art-src/` and `pack-art.py` does not read it.
