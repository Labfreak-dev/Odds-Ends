# Gravemark — Grok prompt: the five bodies (the look with the weapon arm removed)

Five image EDITS, one per class. The game draws this "body" as the hero and
hangs its own moving arm and weapon on it, so the painting keeps its look and
the arm swings. The edit must change nothing else: every other pixel identical
to the look you already made, same size, same footing, same magenta.

For each class, upload the matching `look-<class>.png` and paste:

---

Edit this image. Remove the character's NEAR arm (the one closest to the
viewer, on the right side of the figure) from the shoulder down, and the
weapon it holds, leaving a clean shoulder where the arm was — paint the
jacket or armour of the shoulder closed as it would look with no arm there.
Keep the FAR arm exactly as it is. Change NOTHING else: same pose, same
face, same clothes, same colours, same size, same position in the frame,
same flat magenta #FF00FF background. No text, no watermark.

---

Save as:

  body-warden.png    from look-warden.png   (remove the maul and the arm holding it)
  body-reaver.png    from look-reaver.png   (remove the sword and the arm holding it)
  body-pyre.png      from look-pyre.png     (remove the wand and the arm holding it)
  body-stalker.png   from look-stalker.png  (remove the near dagger and its arm; keep the far one)
  body-sexton.png    from look-sexton.png   (remove the scythe and the arm holding it)

Zip the five. On receipt: `python3 tools/fit-figure.py <dir> --out /tmp/stage`
then `python3 tools/art-install.py /tmp/stage`. The game switches to
painting-plus-arm automatically for any class whose body is present; the
per-class shoulder offsets live in `GM.Rig.ARM_OFFSET` if an arm needs nudging.
