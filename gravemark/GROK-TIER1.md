# Gravemark — Grok prompt, Tier 1 parts (16 images)

Copy everything below the line into Grok. Attach `art/actor/hero-idle.png` to every hero part,
`dagger-high.png` to the dagger and `maul-high.png` to the maul; the other three weapons have no reference yet. Make image 1 (the torso) first and check it before
asking for the rest. Save each result as the file name given, drop them all into one zip.

---

I am building a 2D game with a bone-animated hero. The character is already animated in code.
I need you to paint the hero's BODY PARTS as separate still images, cut from the attached
reference painting, so the skeleton can move them. No animation, no sprite sheets, no frames.
Each image is ONE part, painted once.

STYLE (applies to every image):
Hand-painted 2D game art, painterly with visible brush texture. Cold, damp, cut stone world.
NOT vector, NOT pixel art, NOT 3D render, NOT cartoon. One low warm key light against a cold
blue-grey ambient, rim light on the edges. Dark overall; bone #e6e0cf is the brightest neutral.
Every image is a CROP OF THE ATTACHED REFERENCE and must match it exactly in style, lighting,
colour and scale.

RULES (every image, no exceptions):
1. Paint ONLY the named part. A forearm is elbow to fingertips and nothing else. No neighbouring
   body, no shadow of the torso, no ground.
2. Paint it UPRIGHT, exactly as it sits on the reference in its resting pose. Do not rotate,
   straighten or re-pose it. The skeleton does the posing.
3. Fill the given canvas size, with the named JOINT at the given position. The joint is the
   pivot the part hangs from. If it is off, the limb detaches when it swings.
4. Flat solid magenta #FF00FF background, edge to edge. Not transparent, not white, not a card.
5. No text, no watermark, no border, no frame.
6. "Near" parts face the viewer. "Far" parts are the same limb on the other side of the body:
   paint those a touch darker, they are further from the light.

THE HERO — reference: hero-idle.png (attached). 11 parts.

 1. head.png      112x128 px. Head and hood, from the crown down to and including the neck.
                  Joint: base of the neck, at 50% across, 92% down.
 2. torso.png     144x160 px. Chest and shoulders from the collarbone down to the waist.
                  No arms, no head. Joint: the hips, at 50% across, 95% down.
 3. pelvis.png    112x72 px. Belt and hips only, waist to the top of the thighs.
                  Joint: the hips, at 50% across, 10% down.
 4. uarm_f.png    64x96 px. The NEAR upper arm, shoulder to elbow.
                  Joint: the shoulder, at 50% across, 8% down.
 5. farm_f.png    56x96 px. The NEAR forearm, elbow to fingertips, hand included, hand open.
                  Joint: the elbow, at 50% across, 8% down.
 6. uarm_b.png    64x96 px. The FAR upper arm, shoulder to elbow. A touch darker.
                  Joint: the shoulder, at 50% across, 8% down.
 7. farm_b.png    56x96 px. The FAR forearm, elbow to fingertips, hand included. A touch darker.
                  Joint: the elbow, at 50% across, 8% down.
 8. thigh_f.png   72x128 px. The NEAR thigh, hip to knee.
                  Joint: the hip, at 50% across, 6% down.
 9. shin_f.png    64x128 px. The NEAR shin, knee to sole, boot included.
                  Joint: the knee, at 50% across, 6% down.
10. thigh_b.png   72x128 px. The FAR thigh, hip to knee. A touch darker.
                  Joint: the hip, at 50% across, 6% down.
11. shin_b.png    64x128 px. The FAR shin, knee to sole, boot included. A touch darker.
                  Joint: the knee, at 50% across, 6% down.

THE FIVE WEAPONS — 5 parts. Same style block. Each is the weapon ALONE, no hand, no arm,
painted VERTICALLY: grip near the bottom, business end at the top, as if held point-up at rest.
Every one is 80x224 px, with the JOINT at the middle of the grip, at 50% across, 82% down.
Magenta background, same rules.

12. dagger.png    Reference: dagger-high.png (attached). A short cruel blade, wrapped grip.
13. sword.png     No reference: match the dagger's metal and the hero's palette. A straight
                  double-edged arming sword, plain iron crossguard, leather-wrapped grip, round pommel.
14. maul.png      Reference: maul-high.png (attached). A heavy two-handed hammer, long haft.
15. wand.png      No reference: match the hero's palette. A short carved bone rod, bound with
                  dark leather at the grip, a dull ember glowing at the tip.
16. scythe.png    No reference: match the maul's haft and the dagger's metal. A long dark wooden
                  haft, a curved iron blade at the top with its edge facing left.

Deliver all 16 as PNG at the exact sizes above, named exactly as listed, in one zip.
