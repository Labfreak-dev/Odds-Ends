#!/usr/bin/env python3
"""Pack Time Fantasy 48×48 singleframes into one sheet per battler.

    python3 iron-league/tools/pack-tf.py /path/to/singleframes

Each output PNG is 576×144: 12 motions by 3 frames, 48×48 cells.
Column order matches MOTIONS in js/hero.js.
"""
import re
import sys
from collections import defaultdict
from pathlib import Path

from PIL import Image

MOTIONS = ["idle1", "idle2", "walk", "atk1", "atk2", "bow", "gun", "hit", "crouch", "magic", "cheer", "dead"]
CELL = 48
NEED = ["idle1", "walk", "atk1", "atk2", "hit", "crouch", "magic", "cheer", "dead"]
# walk2 is an extra on 1_4 and is not a column. item/status are unused.
SKIP = {"item", "status", "walk2"}

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "timefantasy"

NAME = re.compile(
    r"^(?P<id>.+?)_?(?P<motion>idle1|idle2|walk2|walk|atk1|atk2|bow|gun|crouch|hit|cheer|magic|item|status|down|dead)"
    r"(?: \((?P<n>\d+)\))?\.png$"
)


def sheet_ids():
    ids = []
    for s in range(1, 8):
        for i in range(1, 9):
            ids.append("%d_%d" % (s, i))
    for m in range(1, 4):
        for i in range(1, 9):
            ids.append("military%d_%d" % (m, i))
    return ids


def main():
    if len(sys.argv) != 2:
        print("usage: pack-tf.py <singleframes-dir>", file=sys.stderr)
        return 1
    src = Path(sys.argv[1])
    frames = defaultdict(lambda: defaultdict(dict))
    bad = []
    for path in src.rglob("*.png"):
        m = NAME.match(path.name)
        if not m:
            bad.append(path.name)
            continue
        motion = m.group("motion")
        if motion in SKIP:
            continue
        if motion == "down":
            motion = "dead"
        n = int(m.group("n") or 1)
        frames[m.group("id")][motion][n] = path
    if bad:
        print("unparsed", bad)
        return 1

    expected = sheet_ids()
    got = sorted(frames)
    if got != sorted(expected):
        print("id mismatch", "missing", sorted(set(expected) - set(got)), "extra", sorted(set(got) - set(expected)))
        return 1

    OUT.mkdir(parents=True, exist_ok=True)
    for cid in expected:
        motions = frames[cid]
        if "idle2" not in motions:
            motions["idle2"] = dict(motions["idle1"])
        for motion in NEED:
            if motion not in motions or not motions[motion]:
                print(cid, "missing", motion)
                return 1
        sheet = Image.new("RGBA", (len(MOTIONS) * CELL, 3 * CELL), (0, 0, 0, 0))
        for col, motion in enumerate(MOTIONS):
            cells = motions.get(motion) or {}
            if not cells:
                continue
            ordered = [cells[k] for k in sorted(cells)]
            while len(ordered) < 3:
                ordered.append(ordered[-1])
            for row in range(3):
                im = Image.open(ordered[row]).convert("RGBA")
                if im.size != (CELL, CELL):
                    print(cid, motion, "size", im.size)
                    return 1
                sheet.alpha_composite(im, (col * CELL, row * CELL))
        sheet.save(OUT / (cid + ".png"), optimize=True)

    print("packed", len(expected), "sheets into", OUT)
    return 0


if __name__ == "__main__":
    sys.exit(main())
