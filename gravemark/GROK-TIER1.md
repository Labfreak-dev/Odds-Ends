# Gravemark — Grok prompt, Tier 1 (round 2)

**Round 1 result.** The five weapons arrived and are installed: `parts/weapon/sword`,
`wand` and `scythe` are painterly and right; `dagger` and `maul` came back as flat
vector icons (a dozen colours) and are in the game as stopgaps. The eleven body parts
did not work: asked for "only the forearm", the generator cropped a rectangle of cloth
out of the reference instead of painting the limb as a cut-out with its own silhouette.
Rectangles cannot hang on a skeleton.

**Round 2 asks for ONE image instead of eleven**: the classic cut-out puppet sheet,
the figure taken apart and laid out with gaps. Generators paint that reliably. The
tool `tools/slice-parts.py` cuts the pieces out and places each on its canvas with the
joint on the pivot, so the layout below is the only thing that has to be right.

Attach `art/actor/hero-idle.png`. Then paste:

---

Hand-painted 2D game art, painterly with visible brush texture. Cold, damp, cut-stone
world. NOT vector, NOT pixel art, NOT 3D render, NOT cartoon, NOT flat cel shading.
One low warm key light against a cold blue-grey ambient, rim light on the edges. Dark
overall; bone #e6e0cf is the brightest neutral. Match the attached reference painting
exactly in style, lighting, colour and scale.

Paint a CUT-OUT PUPPET PARTS SHEET of the attached hooded character, for a paper-doll
style skeletal animation. The figure is taken apart into eleven separate pieces and
laid out on the canvas with clear gaps between them, on a flat solid magenta #FF00FF
background edge to edge. Each piece is a complete cut-out with its own silhouette and
finished edges, as if cut from the painting with scissors and set down on the magenta.
Every piece is painted UPRIGHT, exactly as it sits on the reference at rest, at the
same scale as the others, so that reassembled they would make the reference figure.
Do not draw the assembled figure. No text, no labels, no numbers, no lines, no arrows,
no watermark, no border. Nothing may touch or overlap another piece.

Canvas 1024 x 1024 pixels. Three rows, left to right in each row:

ROW 1 (top): the HEAD (head and hood, from the crown down to and including the neck),
the TORSO (chest and shoulders from the collarbone down to the waist, no arms, no
head), the PELVIS (belt and hips only, waist to the top of the thighs).

ROW 2 (middle), four pieces: the NEAR UPPER ARM (shoulder to elbow), the NEAR FOREARM
(elbow to fingertips, hand included, hand open), the FAR UPPER ARM (a touch darker,
it is further from the light), the FAR FOREARM (a touch darker, hand included).

ROW 3 (bottom), four pieces: the NEAR THIGH (hip to knee), the NEAR SHIN (knee to
sole, boot included), the FAR THIGH (a touch darker), the FAR SHIN (a touch darker,
boot included).

Arms and legs are painted hanging straight down. The pieces must be the SAME hooded
figure as the reference: same cloak, same leathers, same colours.

---

Two more, same style block, each its own image, 80 x 224 pixels, flat magenta
background, the weapon alone with no hand, painted vertically with the grip near the
bottom and the business end at the top, grip centred at 50% across and 82% down.
PAINTERLY with brush texture and worn metal, not a flat icon:

1. dagger.png  A short cruel blade, wrapped grip, dark iron with a bright worn edge.
2. maul.png    A heavy two-handed hammer on a long haft, pitted iron head, bound grip.

---

When the sheet comes back:

```bash
python3 tools/slice-parts.py sheet.png hero-mid --out /tmp/stage   # cuts + places 11 parts
python3 tools/art-install.py /tmp/stage                            # installs, rebuilds the index
python3 tools/shot-swing.py . /tmp/swing.png                       # heroes frozen mid-swing
```
If the pieces came back in a different arrangement, the slicer writes
`slice-contact.png` with each piece numbered; pass `--order head,torso,...` in that order.
