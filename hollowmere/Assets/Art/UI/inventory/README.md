# Hollowmere inventory UI (Diablo-style, Immortal layout)

This evolves the v1 skin (dark iron, aged gold, teal gems) toward heavier ornament: AI-painted thorn-and-filigree corner pieces with a bone skull, a winged gold crest, and carved gold bevels. The frames are code-drawn, so the 9-slice edges are crisp. No text is baked in, and no Blizzard art was traced or copied.
Everything is laid out for a **2340x1080** landscape screen. `slices.json` holds the borders, the rarity colour table, and `layout_2340x1080` (region rects and gear-slot rects as [x,y,w,h] from the top left).

## Layout (Immortal-style, locked)
- `inv_screen_frame.png` 2340x1080 (Simple): full-screen iron border with a transparent centre for the 3D hero, ornate corners, and a crest at top over the hero.
- `slot_column` 9-slice: the left gear column (head, shoulders, chest, wrists, hands, belt, legs) and the right one (amulet, ring L, ring R, cloak, feet, main hand, off hand).
- `bag_panel` 9-slice: the right-hand bag (5x6 grid of 112px cells, tabs on top, Sort / Salvage Blues bar at the bottom).
- The tooltip card opens over the hero on tap, with Equip / Salvage / Lock.
- `paperdoll_panel.png` 720x1040 is an alternative D3-style doll panel with a painted silhouette (slot centres in slices.json). It is not used by the locked layout.

## 9-slice borders (px; Unity Sprite Editor order is L,B,R,T)
| sprite | size | left | right | top | bottom |
|---|---|---|---|---|---|
| inventory_frame | 768x768 | 200 | 200 | 200 | 200 |
| stats_panel | 640x640 | 172 | 172 | 172 | 172 |
| tooltip_frame | 512x512 | 116 | 116 | 116 | 116 |
| slot_normal | 112x112 | 22 | 22 | 22 | 22 |
| slot_hover | 112x112 | 22 | 22 | 22 | 22 |
| slot_selected | 112x112 | 22 | 22 | 22 | 22 |
| slot_locked | 112x112 | 22 | 22 | 22 | 22 |
| tooltip_header | 512x72 | 30 | 30 | 0 | 0 |
| divider | 480x32 | 40 | 40 | 0 | 0 |
| stats_row | 480x44 | 12 | 12 | 6 | 6 |
| stats_row_alt | 480x44 | 12 | 12 | 6 | 6 |
| panel_header | 560x88 | 48 | 48 | 0 | 0 |
| tab_active | 200x84 | 28 | 28 | 24 | 8 |
| tab_inactive | 200x84 | 28 | 28 | 24 | 8 |
| button_red | 420x128 | 48 | 48 | 40 | 40 |
| button_dark | 420x128 | 48 | 48 | 40 | 40 |
| slot_rarity_wash | 112x112 | 22 | 22 | 22 | 22 |
| slot_common | 112x112 | 22 | 22 | 22 | 22 |
| slot_magic | 112x112 | 22 | 22 | 22 | 22 |
| slot_rare | 112x112 | 22 | 22 | 22 | 22 |
| slot_legendary | 112x112 | 22 | 22 | 22 | 22 |
| slot_set | 112x112 | 22 | 22 | 22 | 22 |
| slot_unique | 112x112 | 22 | 22 | 22 | 22 |
| slot_column | 240x800 | 104 | 104 | 104 | 104 |
| bag_panel | 900x900 | 184 | 184 | 184 | 184 |

## Other sprites
- `tooltip_header.png` is **greyscale**. Tint it in code (Image.color) with the rarity colour. Rarity hex values are in slices.json `_meta.rarity_colors` (common #FFFFFF, magic #6969FF, rare #FFFF00, legendary #BF642F, set #00FF00, unique #3CDCD2, mythic #E8403A).
- `slot_rarity_wash.png`: a white radial wash to tint per rarity. The pre-tinted `slot_{common,magic,rare,legendary,set,unique}.png` are optional extras.
- `slot_locked` has a padlock. `slot_hover` has a teal inner glow, and `slot_selected` has a gold one.
- `ghost/ghost_*.png` 96px greyscale engraved empty-slot glyphs (head, shoulders, chest, hands, belt, legs, feet, mainhand, offhand, amulet, ring, wrists, cloak). Show them at about 45% alpha.
- `crest_top.png` is a winged crest overlay. `corner_{tl,tr,bl,br}.png` 128px are small corner overlays. `close_x.png` is 96px, in a red plate.
- `button_red` / `button_dark` are plates with no text. Labels are Cinzel. To press, darken and drop 1-2 px.
- `inventory_mockup.png` 2340x1080 is a preview (labels are only for the preview). `contact_sheet.png` shows all the sprites.

## Build
`_build/inv.py` (frames, slots, tooltip, stats, tabs), `extra.py` (buttons, close, rarity slots), `doll.py` (ghosts, doll panel), `layout.py` (screen frame, columns, bag, layout JSON). `src_corner.png` and `src_crest.png` are the only AI sources kept (keyed, small). The mockup script is in `art_v2/_build/mock_inv2340.py`.
