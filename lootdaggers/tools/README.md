# 3D pipeline (Meshy)

Everything here rebuilds the game's 3D characters. `MESHY_API_KEY` must be set
in the environment; it is never written to the repo. Every paid Meshy task id
is appended to `meshy-log.jsonl`, so a result can be fetched again later
(`GET /openapi/v1/<kind>/<id>` returns fresh download links).

Setup: `cd lootdaggers/tools && npm i` (gltf-transform + meshoptimizer), and
`pip install pillow numpy`.

| File | What it does |
|---|---|
| `meshy.py` | Tiny API client: create a task, wait for it, download. Logs task ids. |
| `prep.py` | A 2D sprite (magenta background) to a clean white-background PNG. |
| `batch_foes.py` | Foes and bosses: sprite, then a front A-pose reference (image-to-image), then image-to-3D (weapons kept in the mesh), then auto-rig for humanoids. Resumable. |
| `batch_skins.py` | Hero skins: each hero part (body and weapon, the Knight's shield and sword separately) retextured with its own UVs kept, styled by the skin's 2D idle art and its art-pack-26 description. Writes `death3d/assets/textures/skins/<hero>_<skin>_<part>_{base,normal,mr}.webp`. |
| `animlib.mjs` | Merges Meshy animation outputs into one clip-only file (`models3d/anims.glb`). |
| `optimize.mjs` | Meshy GLB to game GLB: WebP textures (base 1K, others 512), quantized, meshopt. About 7-14 MB down to 0.6-0.9 MB. |
| `part.mjs`, `maps.mjs` | Helpers for the skin batch (one hero part as a static GLB; pull the maps out of a result). |

## Why one animation library works for everyone
Meshy's auto-rig gives every humanoid the same 24-bone skeleton (Hips, Spine,
Spine01, Spine02, neck, Head, the arms and legs). The six hero models were
rigged by Meshy too. Clips are stored per bone name, so a clip bought once
plays on every character. The runtime (`slayer3d.js`) keeps each actor's own
hip x/z and scales the hip height to its legs.

## What was bought (b134)
- 30 library animations on the Skeleton's rig, plus its 5 test clips and the free walk/run: 37 clips.
- 19 foes and bosses: 13 rigged humanoids, 6 code-animated creatures (rat, slime, wraith, mimic, brain in a jar, One-Armed Bandit).
- 48 hero skins, 104 part retextures.
