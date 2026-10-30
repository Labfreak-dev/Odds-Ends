# Hollowmere title + UI art (v1)

Palette: midnight blue / slate-teal stone, cold teal mist and rune glow (#3CDCD2), aged gold trim (#FAE2A0 -> #C48C3E -> #6E421A), ember accents, dark iron outline (#08090E).
No text is baked into any button or panel. The game renders the labels (the mockup labels are only a preview, in Cinzel Bold).

## Title key art (2400x1080, landscape 20:9)
| file | notes |
|---|---|
| keyart_bg_far.png | opaque. Moonlit misty hollow, glowing lake, ruined crypt gate. Sky top-centre is left calm for the logo |
| keyart_bg_mid.png | transparent. Ruined gothic gate pillars hugging the left and right edges, with the centre empty |
| keyart_bg_near.png | transparent. Near-black root/rock silhouettes in the corners |
| logo.png | 1760x579 transparent. "HOLLOWMERE" wordmark with gold-metal bevel, dark outline, teal glow and a gold filigree crest |
| title_mockup.png | all layers + logo + buttons composited |
| layers_preview.png | each layer on grey |

Suggested parallax: far 0.1, mid 0.35, near 0.7 (e.g. gyro/drift ±40 px). Logo at the top centre (about 1300 px wide on the 2400 canvas) and the button column centred under it.

Logo font: **Cinzel Decorative Black** by Natanael Gama, SIL Open Font License 1.1 (free for commercial use). Labels: **Cinzel** (OFL 1.1). Both are on Google Fonts, so bundle Cinzel as a TMP font asset for the button labels. The ornament behind the word is AI-generated (Meshy nano-banana).

## 9-slice borders (px; also in ui_slices.json)
Unity's Sprite Editor Border fields are L, B, R, T. Set Image Type = Sliced and Pixels Per Unit Multiplier = 1 on a 2400x1080 reference CanvasScaler.

| sprite | size | left | right | top | bottom |
|---|---|---|---|---|---|
| button_normal / _pressed / _disabled | 480x144 | 44 | 44 | 40 | 46 |
| icon_button / icon_button_pressed | 160x160 | 46 | 46 | 44 | 48 |
| panel | 512x512 | 72 | 72 | 72 | 76 |
| panel_header (banner with pointed ends) | 640x112 | 60 | 60 | 36 | 36 |
| hud_frame (bar frame with trough) | 520x60 | 30 | 30 | 0 | 0 |
| hud_fill_health / _mana / _xp / _ghost | 200x36 | 18 | 18 | 0 | 0 |
| slider_track | 400x40 | 22 | 22 | 0 | 0 |
| slider_fill | 120x20 | 10 | 10 | 0 | 0 |

Pressed buttons have the face shifted down by 4 px, so move the label down 4 px on press. The bottom border is 6 px taller than the top because of the drop shadow. HUD: put the fill inside the frame with a 12 px inset (frame 60 high, fill 36 high), and use the ghost fill for delayed-damage trails. Use Image.type = Sliced with a width-driven RectTransform (not Filled) so the rounded caps stay intact.

## Non-sliced
portrait_frame.png 256 (transparent centre, inner radius 88 px) + portrait_mask.png (use as a Mask for the portrait), close_button.png 128, slider_handle.png 72.
icons/icon_{settings,play,continue,inventory,map,shop,gold,gem,heart,mana,sword,shield}.png, each 256x256, transparent and centred.

## Sources
_ai_sources/ holds the raw Meshy nano-banana outputs. _build_scripts/ holds gen.py, genicons.py, build.py (keying, logo, all UI drawn procedurally with supersampling) and mock.py. The UI frames are code-drawn, not AI, so the edges are crisp and the slices are exact.
No Asset Store assets were used, and nothing was bought.
