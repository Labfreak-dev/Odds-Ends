#!/usr/bin/env python3
"""Every Heroes99 outfit must cover the body, not sit behind it.

    python3 iron-league/tools/check-clothes.py

cloth_bot is the shirt, pants, and boots. Most cloth_top sheets are empty.
If that garment is blitted under the skin, the idle frame stays briefs and
a weapon. This composites the real sheets in hero.js order and checks the
torso and legs.
"""
import re
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
HERO = ROOT / "js" / "hero.js"
BASE = ROOT / "assets" / "heroes99"
# Idle frame 1 from hero.js FRAMES: [x, y, w, h, ax, ay]
FRAME = (19, 3, 46, 33)
# Below the head. Rows 0-16 stay face and hair.
BODY = range(17, 33)
ORDER = ("wbot", "skin", "face", "clothBot", "clothTop", "hairBot", "hairTop", "wtop")


def fail(msg):
    print("FAIL", msg)
    sys.exit(1)


def layer_order():
    src = HERO.read_text()
    m = re.search(r"return \[(wbot, skin, face, clothBot, clothTop, hairBot, hairTop, wtop)\]", src)
    if not m:
        fail("hero.js draw order is not weapon, skin, face, cloth, hair, weapon")
    return m.group(1).split(", ")


def crop(im):
    x, y, w, h = FRAME
    return im.convert("RGBA").crop((x, y, x + w, y + h))


def load(rel):
    path = BASE / rel
    if not path.is_file():
        fail("missing " + rel)
    return crop(Image.open(path))


def stack(paths):
    im = Image.new("RGBA", (FRAME[2], FRAME[3]), (0, 0, 0, 0))
    for p in paths:
        im.alpha_composite(p)
    return im


def covered_ratio(base, clothed):
    bp, cp = base.load(), clothed.load()
    skin_px = covered = 0
    for y in BODY:
        for x in range(FRAME[2]):
            br, bg, bb, ba = bp[x, y]
            if ba < 200:
                continue
            skin_px += 1
            cr, cg, cb, ca = cp[x, y]
            if abs(cr - br) + abs(cg - bg) + abs(cb - bb) > 24:
                covered += 1
    if skin_px < 80:
        fail("idle body has too little skin to measure (%d)" % skin_px)
    return covered / skin_px, covered, skin_px


def main():
    order = layer_order()
    if tuple(order) != ORDER:
        fail("unexpected layer tokens " + ",".join(order))
    print("ok draw order", " ".join(order))

    skin = load("skin/skin_c1.png")
    face = load("face/face_c1.png")
    bare = stack([skin, face])
    worst = 1
    worst_name = ""
    for n in range(1, 18):
        for color in (1, 4):
            bot = load("cloth/cloth%d/cloth%d_bot/cloth%d_c%d_bot.png" % (n, n, n, color))
            top = load("cloth/cloth%d/cloth%d_top/cloth%d_c%d_top.png" % (n, n, n, color))
            clothed = stack([skin, face, bot, top])
            ratio, covered, skin_px = covered_ratio(bare, clothed)
            if ratio < worst:
                worst = ratio
                worst_name = "cloth%d c%d" % (n, color)
            # A naked composite leaves the body; a clothed one paints over most of it.
            if ratio < 0.45:
                fail("cloth%d c%d covers only %.0f%% of the body (%d/%d)" % (n, color, ratio * 100, covered, skin_px))
            # The face sits above the collar. Outfit pixels must not eat it.
            fp, cp, bare_p = face.load(), clothed.load(), bare.load()
            face_covered = 0
            for y in range(6, 15):
                for x in range(FRAME[2]):
                    if fp[x, y][3] <= 16:
                        continue
                    if cp[x, y][:3] != bare_p[x, y][:3]:
                        face_covered += 1
            if face_covered:
                fail("cloth%d c%d covers %d face pixels" % (n, color, face_covered))
    print("ok all 17 outfits cover the body; thinnest %s %.0f%%" % (worst_name, worst * 100))
    print("clothes passed")


if __name__ == "__main__":
    main()
