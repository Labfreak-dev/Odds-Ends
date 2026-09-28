# Vendored three.js r0.186.1

ES module build used only by the Death fight (`lootdaggers/death3d/`).
The game lazy-imports it when a Death fight starts. Nothing here is fetched
during a normal run.

| File | Role |
|---|---|
| `three.module.js` | WebGL renderer and re-exports. Official `build/three.module.js`. |
| `three.core.js` | Scene graph, math, loaders base. Imported by `three.module.js`. |
| `addons/loaders/GLTFLoader.js` | glTF / GLB. Imports the two utils below. |
| `addons/loaders/DRACOLoader.js` | Draco meshes (`KHR_draco_mesh_compression`). Wasm/JS decoded on demand. |
| `addons/libs/draco/` | Draco 1.5.6 decoders that ship with three.js (Apache-2.0). |
| `addons/libs/meshopt_decoder.module.js` | meshopt (`EXT_meshopt_compression` / `KHR_meshopt_compression`). |
| `addons/utils/BufferGeometryUtils.js` | Required by GLTFLoader. |
| `addons/utils/SkeletonUtils.js` | Required by GLTFLoader (`clone`). |
| `addons/postprocessing/EffectComposer.js` | Bloom chain. With Pass, RenderPass, ShaderPass, MaskPass, OutputPass. |
| `addons/postprocessing/UnrealBloomPass.js` | Desktop bloom for the Death fight. |
| `addons/shaders/CopyShader.js` | Required by EffectComposer. |
| `addons/shaders/LuminosityHighPassShader.js` | Required by UnrealBloomPass. |
| `addons/shaders/OutputShader.js` | Required by OutputPass (tone mapping, sRGB). |
| `addons/environments/RoomEnvironment.js` | PMREM room used as the fight's env map. |

Not included: the Draco encoder, the standalone glTF JS decoder
(`draco/gltf/draco_decoder.js`), examples, editor, or docs. `DRACOLoader`
loads a decoder only when a compressed mesh is actually parsed.

Licenses: MIT (`LICENSE`, three.js and meshopt) and Apache-2.0 (Draco, see
`addons/libs/draco/README.md`).

`pack-art.py` reads `art-src/` only. Do not move these files there.
