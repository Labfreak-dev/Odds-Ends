Drop real GLB files and VFX textures in this folder, then point
`death3d/manifest.js` at them (`url: 'death.glb'` and so on).

Until a slot's `url` is set, the fight uses the procedural placeholder.
A missing or failed file logs a warning and stays on that placeholder.

Expected names (any name works if the manifest matches):

- `death.glb` — rigged Death. Clips: idle, cast, attack, hit, defeat.
- `throne.glb`
- `hero_knight.glb`, `hero_ranger.glb`, `hero_gambler.glb`, `hero_brute.glb`, `hero_duelist.glb`, `hero_hexpriest.glb`
  Clips: idle, attack, hit, dodge, victory, death.
- `environment.glb` — the throne room, without the characters.
- `vfx_soul.png`, `vfx_spark.png`, `vfx_beam.png`, `vfx_sigil.png`, `vfx_wisp.png`

See `death3d/README.md` for scale, facing, and up-axis.
