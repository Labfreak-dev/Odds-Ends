# Gravemark — Grok prompt: the revenant, and the rig parts that make the crew move

**Delivered and installed (build b012-rig): all five class sheets, the five weapons and the revenant.** Kept as the template for the monster and boss parts, which use the same convention with their own rigs (see GROK-PARTS.md tiers 3-5).

Same world as the class looks: bright post-apocalypse, chunky painterly figures.
Two jobs in this pack.

1. **The Revenant** — one standing figure. The game's own fallen squad standing
   back up. It fights the player at its own depth.
2. **Rig parts** — the crew taken apart so a skeleton can move them. The game
   already animates: idle, five weapon swings, hit, death, walk are all authored
   in code and run today on the flat paintings. What the skeleton lacks is
   pieces to wear. One exploded sheet per class (five images) and five weapons
   give every hero real limb-by-limb motion.

Attach the matching `look-<class>.png` you already made to every class request.
Save each file under the name given. Zip the lot.

---

STYLE (paste above every request):

Stylised painterly game character art for a colourful post-apocalyptic idle
RPG, in the spirit of Path of Idle's chunky, readable heroes. Hand-painted with
visible brush texture and clean hard edges on the silhouette, exaggerated
proportions: big hands, big boots, big weapons. Bright daylight lighting: a
warm sun from the upper left, a cool sky-blue bounce from the right, strong
saturated colour. Materials of the wasteland: scrap metal, duct tape, car
parts, road signs, salvaged sports gear, patched leather, rope. NOT grim, NOT
gothic, NOT horror, NOT pixel art, NOT 3D render, NOT anime. Flat solid
magenta #FF00FF background edge to edge. No text, no labels, no numbers, no
lines, no arrows, no watermark, no border, no ground, no shadow on the ground.

---

PART 1 — THE REVENANT (one image, faces LEFT)

revenant-idle.png   THE REVENANT. One of the player's own crew who died out
    there and got back up: the Reaver's silhouette, biker jacket and shoulder
    pad and road-sign sword, but sun-bleached, hollow-eyed, held together with
    duct tape and rope, moving on memory. Must be instantly recognisable as
    the Reaver and instantly wrong. Cheerful colours gone chalky; one accent:
    violet #b36bff glowing where the eyes were and leaking from the seams.
    Three-quarter view, full body, whole figure in frame with air above and
    below, feet on an invisible ground line at about 90% of the height, facing
    LEFT.

---

PART 2 — THE CUT-OUT PUPPET SHEETS (five images, one per class)

Paint a CUT-OUT PUPPET PARTS SHEET of the attached character, for paper-doll
style skeletal animation. The figure is taken apart into ELEVEN separate
pieces and laid out on the canvas with clear gaps between them, on the flat
magenta background. Each piece is a complete cut-out with its own silhouette
and finished edges, as if cut from the painting with scissors and set down on
the magenta. Every piece is painted UPRIGHT, exactly as it sits on the
reference at rest, at the same scale as the others, so that reassembled they
would make the reference figure facing RIGHT. Do not draw the assembled
figure. Nothing may touch or overlap another piece. Arms and legs are painted
hanging straight down. Hands are EMPTY: the weapon is a separate image.

Canvas 1024 x 1024 pixels. Three rows, left to right in each row:

ROW 1 (top): the HEAD (head and hair or hood, from the crown down to and
including the neck), the TORSO (chest and shoulders from the collarbone down
to the waist, no arms, no head), the PELVIS (belt and hips only, waist to the
top of the thighs).

ROW 2 (middle), four pieces: the NEAR UPPER ARM (shoulder to elbow), the NEAR
FOREARM (elbow to fingertips, hand included, hand open), the FAR UPPER ARM (a
touch darker, it is further from the light), the FAR FOREARM (a touch darker,
hand included).

ROW 3 (bottom), four pieces: the NEAR THIGH (hip to knee), the NEAR SHIN
(knee to sole, boot included), the FAR THIGH (a touch darker), the FAR SHIN
(a touch darker, boot included).

Make one sheet per class, from its own reference painting:

  parts-warden.png    from look-warden.png   (car-door riot armour, big boots)
  parts-reaver.png    from look-reaver.png   (biker jacket, shoulder pad)
  parts-pyre.png      from look-pyre.png     (scorched lab coat, goggles)
  parts-stalker.png   from look-stalker.png  (hooded track jacket, trainers)
  parts-sexton.png    from look-sexton.png   (long dust coat, wide-brimmed hat)

---

PART 3 — THE FIVE WEAPONS (five images, each its own image)

Each is the weapon ALONE, no hand, no arm, painted VERTICALLY: grip near the
bottom, business end at the top, as if held point-up at rest. Canvas 80 x 224
pixels (or any tall 5:14 canvas), the grip centred at 50% across and 82% down.
Painterly with brush texture and worn, scavenged materials, matching the
class look it belongs to.

  weapon-maul.png     The Warden's sledgehammer: a long pipe haft wrapped in
                      tape, a heavy rusted steel head.
  weapon-sword.png    The Reaver's road-sign sword: a straight blade ground
                      from a stop sign, red paint still on the flat, a grip
                      of wrapped inner tube.
  weapon-wand.png     The Pyre's spark wand: a spark plug and copper wire
                      lashed to a bone handle, a live flame at the tip.
  weapon-dagger.png   The Stalker's kitchen-knife dagger: a chef's knife with
                      the handle re-wrapped in cyan cord.
  weapon-scythe.png   The Sexton's scythe: a length of pipe with a car
                      leaf-spring blade bolted across the top.

Deliver all 11 as PNG, named exactly as listed, in one zip.

---

When it comes back:

```bash
python3 tools/fit-figure.py <dir-with-revenant> --out /tmp/stage       # revenant still
for c in warden reaver pyre stalker sexton; do
  python3 tools/slice-parts.py parts-$c.png $c --out /tmp/stage          # cuts + places 11 parts each
done
# weapons: rename to parts/weapon/<fam>.png under /tmp/stage, then
python3 tools/art-install.py /tmp/stage
python3 tools/shot-swing.py . /tmp/swing.png                              # heroes frozen mid-swing
```
If a sheet came back in a different arrangement, the slicer writes
`slice-contact.png` with each piece numbered; pass `--order head,torso,...`.
