#!/usr/bin/env python3
"""Every Time Fantasy battler sheet is packed and the ranged looks can shoot.

    python3 iron-league/tools/check-clothes.py

Runtime sheets are 576×144, twelve motions by three 48×48 frames. Column
order is MOTIONS in js/hero.js. Archer and ranger looks must have bow
pixels. Skirmisher looks must have gun pixels. Gun troops have no bow.
"""
import re
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
HERO = (ROOT / "js" / "hero.js").read_text()
DATA = (ROOT / "js" / "data.js").read_text()
ATLAS = ROOT / "assets" / "timefantasy"
CELL = 48


def fail(msg):
    print("FAIL", msg)
    sys.exit(1)


def sheet_ids():
    ids = []
    for s in range(1, 8):
        for i in range(1, 9):
            ids.append("%d_%d" % (s, i))
    for m in range(1, 4):
        for i in range(1, 9):
            ids.append("military%d_%d" % (m, i))
    return ids


def opaque(im, col, row):
    crop = im.crop((col * CELL, row * CELL, (col + 1) * CELL, (row + 1) * CELL))
    n = 0
    for px in crop.get_flattened_data():
        if px[3] > 16:
            n += 1
    return n


motions = re.search(r'const MOTIONS = \[(.*?)\]', HERO)
if not motions:
    fail("MOTIONS missing from hero.js")
cols = re.findall(r'"([a-z0-9]+)"', motions.group(1))
if cols != ["idle1", "idle2", "walk", "atk1", "atk2", "bow", "gun", "hit", "crouch", "magic", "cheer", "dead"]:
    fail("column order %s" % cols)

looks = {}
block = re.search(r"const LOOKS = \{(.*?)\n  \};", DATA, re.S)
if not block:
    fail("LOOKS missing from data.js")
for name, body in re.findall(r"(\w+):\s*\[(.*?)\]", block.group(1), re.S):
    looks[name] = re.findall(r'"([^"]+)"', body)

ids = sheet_ids()
files = sorted(p.stem for p in ATLAS.glob("*.png"))
if files != ids:
    fail("atlas ids %s vs %s" % (files, ids))

offered = sorted({sid for pool in looks.values() for sid in pool})
if offered != ids:
    fail("a sheet is missing from the creator pools")

bow_col = cols.index("bow")
gun_col = cols.index("gun")
need = ["idle1", "idle2", "walk", "atk1", "atk2", "hit", "crouch", "magic", "cheer", "dead"]

for sid in ids:
    im = Image.open(ATLAS / (sid + ".png"))
    if im.size != (len(cols) * CELL, 3 * CELL) or im.mode != "RGBA":
        fail("%s size %s %s" % (sid, im.size, im.mode))
    gun = sid.startswith("military2_") or sid.startswith("military3_")
    for motion in need:
        if opaque(im, cols.index(motion), 0) < 20:
            fail("%s empty %s" % (sid, motion))
    bow_px = opaque(im, bow_col, 1)
    gun_px = opaque(im, gun_col, 1)
    if gun:
        if bow_px or gun_px < 20:
            fail("%s gun sheet bow=%s gun=%s" % (sid, bow_px, gun_px))
    elif bow_px < 20 or gun_px:
        fail("%s bow sheet bow=%s gun=%s" % (sid, bow_px, gun_px))

for sid in looks.get("archer", []) + looks.get("ranger", []):
    if sid.startswith("military2_") or sid.startswith("military3_"):
        fail("ranged look is a gun troop " + sid)
for sid in looks.get("skirmisher", []):
    if not (sid.startswith("military2_") or sid.startswith("military3_")):
        fail("skirmisher look is not a gun troop " + sid)

print("ok", len(ids), "battler sheets")
