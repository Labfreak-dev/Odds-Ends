# Hollowmere CC0 PBR kit

Everything here is CC0 (ambientCG, Poly Haven) or procedural, made in code. See `manifest.json` for each file's source, author and use.

## Materials (Unity URP Lit)
For each material in `materials/<name>/`:
- **Base Map**: `<name>_basecolor.jpg` (sRGB).
- **Normal Map**: `<name>_normal_gl.jpg`. Set Texture Type to *Normal map*. The maps are OpenGL-style (Y+), which is what Unity uses, so **do not flip green**.
- **Metallic Map**: `<name>_metallic_smoothness.png`. Import it with sRGB off. Set Source to *Metallic Alpha*. Leave Smoothness at 1, because the alpha channel already holds smoothness (1 - roughness).
- **Occlusion Map**: `<name>_ao.jpg` (sRGB off).
- `<name>_roughness.jpg` is kept for other engines and for repacking.
- **Tiling**: Unity tiling = surface size in metres / `tiling_m`. For example, a 10 m floor with `tiling_m` 2.5 needs a tiling of 4. Alternatively, use a world-space triplanar shader with scale 1/`tiling_m`.
- Set `town_plaster_wall` Base Color to a light tint to vary the houses.

## Props
- `props/*.glb` are self-contained GLBs with embedded 1k JPG textures in glTF ORM form.
- They are at real-world scale in metres, with the origin at the base centre and the front facing +Z.
- Import them with glTFast. With its default URP shader graph, set Unity scale to 1. Do not use the runtime height-fit code on props.

## Water
- `water/water_normal_gl.png` is seamless.
- Use it twice on a URP Lit or simple water shader: once at a 6 m tile scrolling at (0.02, 0.01), and once at a 3.7 m tile scrolling at (-0.015, 0.025).
- Use a dark blue-green base colour, Smoothness 0.95, normal strength 0.4.

## Lighting
These PBR materials need real lighting. Set up:
- a directional light (intensity about 1.5–2.5 with shadows on);
- Environment Lighting set to Skybox or a gradient, with Reflection Probes in the town and dungeon;
- torch point lights in the dungeon.

The current custom `Hollowmere/Color` Lambert shader ignores normal, smoothness and AO maps, so use URP/Lit for kit assets.
