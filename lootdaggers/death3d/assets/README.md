Real Death-fight models and VFX. Loaded by `death3d/manifest.js`.
Not scanned by `pack-art.py`.

```
models/death.glb            meshopt, scythe on bone Scythe_Grip, Attack_Scythe
models/throne.glb           Draco
models/throne_room_env.glb  Draco, markers and flame sockets
models/hero_<id>.glb        meshopt, one hero per fight
textures/vfx/*.webp         soul orb, loop, impact, beam, fire, wisps
```

Meters, +Y up, characters face +Z, floor at y = 0. v2 materials carry albedo,
metal-roughness and normal maps. Clip names and sockets are in `../README.md`.
The game asks for the WebP sheets. PNGs and the frame JSON sit beside them
for the same frames.
