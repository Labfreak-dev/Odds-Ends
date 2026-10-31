# Hollowmere art v2: items, environment, HUD and FX

Inventory UI lives in `../art/inventory/`, which has its own README and slices.json. This folder holds the rest. Every sprite's size, borders, notes and the **rarity colour table** (label, beam and slot-wash hex per rarity) are in `ui_slices_v2.json`.

| folder | contents |
|---|---|
| icons/ | 30 painted item icons at 128px (sword, axe, mace, dagger, bow, staff, wand, shield, helm, chest, gloves, boots, belt, pants, shoulders, bracers, ring, amulet, cloak, hpotion, mpotion, scroll, key, gem_red/blue/green/purple, gold, tome, orb) |
| affixes/ | 12 elite affix badges at 128px (molten, frozen, arcane, poison, electric, vortex, shielding, teleporter, jailer, plagued, fastest, vampiric) |
| textures/ | 8 seamless 1024 JPGs (cobble, dirt, grass, wood, flag, cracked, crypt, cave). Wrap Mode = Repeat. Tileability was checked: the wrap seam difference matches the normal pixel-to-pixel difference |
| decals/ | 12 at 512px (blood1/2, crack1/2, moss1/2, bones, rubble, puddle, rune, scorch, leaves) |
| props/ | 17 at 512px, 3/4 top-down (barrel, crate, sconce, brazier, lantern, well, stall, signpost, tombstone, sarcophagus, bonepile, chest, candles, pillar, statue, cauldron, banner) |
| hud/ | globe_frame plus glass plus fills (health, mana, fury, essence). The boss bar has a frame (9-slice L/R 60), a fill (L/R 4) and a phase marker. Also socket_empty, 6 gems (ruby, sapphire, emerald, amethyst, topaz, diamond), skill_ring_bronze, cooldown_mask (Filled Radial360), and minimap_frame plus mask |
| fx/ | loot_beam, loot_ground_glow and loot_label (9-slice 14 all round). All are white, so tint them per rarity, additive. There are 4 telegraphs (circle, cone, line, rune), also white for tinting, and levelup_burst.png (16 frames of 256px in one row) with levelup_burst.json (frames, 24 fps, additive) |

Globes: the frame is 320x360 and the globe centre sits at (160,200), with a fill/glass radius of 124. Draw the fill, then the glass, then the frame. Use the fill as Image Filled Vertical.
Mockups: `env_mockup.png` (town ground on the left and dungeon on the right, with decals and props) and `hud_fx_mockup.png` (globes, boss bar with phases, loot beams per rarity, telegraphs, level-up, affixes, skill rings, minimap). There are 3 contact sheets.
`_build/` has the scripts (proc.py keys AI images, tex.py makes textures seamless, fx.py is all procedural, and the mock_*.py files build the mockups). The raw AI generations were deleted.
