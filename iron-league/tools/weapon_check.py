#!/usr/bin/env python3
"""Fail if a class weapon grip misses the fist or the handle is off the sprite.

For every class, motion, frame, and sheet that class can wear, the grip must
sit within 1px of an opaque pixel, and the weapon's handle pixel must be
opaque so the drawn handle lands on that fist. Sword and thrust columns, and
a bow or gun the sheet already paints, must not also draw a loose weapon.
"""
import json
import os
import subprocess
import sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHEETS = os.path.join(ROOT, "assets", "timefantasy")
SPRITES = os.path.join(ROOT, "assets", "weapons", "sprites")
CELL = 48
MOTIONS = ["idle1", "idle2", "walk", "atk1", "atk2", "bow", "gun", "hit", "crouch", "magic", "cheer", "dead"]

DUMP = r"""
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = %s;
const context = { console, Math, Date, Object, Array, JSON, Number, String, Error };
context.window = context;
context.globalThis = context;
vm.createContext(context);
["data.js", "kits.js", "gear.js", "meta.js", "weapons.js"].forEach(function (name) {
  vm.runInContext(fs.readFileSync(path.join(root, "js", name), "utf8"), context);
});
const IL = context.IL;
const rows = [];
Object.keys(IL.CLASSES).forEach(function (id) {
  const kind = IL.CLASS_WEAPON[id];
  IL.weapons.motions.forEach(function (motion) {
    for (let sub = 0; sub < 3; sub++) {
      const body = IL.weapons.column(kind, motion, IL.defaultSheet(id));
      const anchor = IL.weapons.handAnchor(kind, body, sub);
      rows.push({
        id: id, kind: kind, motion: motion, sub: sub,
        x: anchor.x, y: anchor.y, body: body,
        paint: IL.weapons.shouldPaint(kind, body, IL.defaultSheet(id)),
        sheets: IL.looksFor(id)
      });
    }
  });
});
const specs = {};
Object.keys(IL.weapons.specs).forEach(function (k) {
  const s = IL.weapons.specs[k];
  specs[k] = { w: s.w, h: s.h, gx: s.gx, gy: s.gy };
});
process.stdout.write(JSON.stringify({ rows: rows, specs: specs, hands: IL.weapons.hands }));
""" % json.dumps(ROOT)


def near(px, ox, oy, x, y):
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            xx, yy = x + dx, y + dy
            if 0 <= xx < CELL and 0 <= yy < CELL and px[ox + xx, oy + yy][3] > 40:
                return True
    return False


def nonempty(px, ox, oy):
    for y in range(0, CELL, 2):
        for x in range(0, CELL, 2):
            if px[ox + x, oy + y][3] > 40:
                return True
    return False


def main():
    proc = subprocess.run(["node", "-e", DUMP], capture_output=True, text=True)
    if proc.returncode != 0:
        sys.stderr.write(proc.stderr)
        return 1
    data = json.loads(proc.stdout)
    fails = []
    cache = {}

    def sheet(name):
        if name not in cache:
            cache[name] = Image.open(os.path.join(SHEETS, name + ".png")).convert("RGBA").load()
        return cache[name]

    # Shared fist table, every opaque cell of every sheet.
    for fn in sorted(os.listdir(SHEETS)):
        if not fn.endswith(".png"):
            continue
        key = fn[:-4]
        px = sheet(key)
        for motion, frames in data["hands"].items():
            mi = MOTIONS.index(motion)
            for sub, xy in enumerate(frames):
                if not nonempty(px, mi * CELL, sub * CELL):
                    continue
                if not near(px, mi * CELL, sub * CELL, xy[0], xy[1]):
                    fails.append("fist %s %s f%d (%d,%d)" % (key, motion, sub, xy[0], xy[1]))

    # Handle pixel is opaque on the sprite the game draws.
    for kind, spec in data["specs"].items():
        path = os.path.join(SPRITES, kind + ".png")
        if not os.path.exists(path):
            fails.append("missing sprite %s" % kind)
            continue
        im = Image.open(path).convert("RGBA")
        if im.size != (spec["w"], spec["h"]):
            fails.append("sprite size %s %s != %sx%s" % (kind, im.size, spec["w"], spec["h"]))
            continue
        gx, gy = spec["gx"], spec["gy"]
        if im.getpixel((gx, gy))[3] < 40:
            fails.append("handle empty %s (%d,%d)" % (kind, gx, gy))

    # Every class pose the fighter can show.
    seen = set()
    for row in data["rows"]:
        mi = MOTIONS.index(row["body"])
        for sid in row["sheets"]:
            key = (sid, row["body"], row["sub"], row["x"], row["y"])
            if key in seen:
                continue
            seen.add(key)
            px = sheet(sid)
            if not nonempty(px, mi * CELL, row["sub"] * CELL):
                fails.append("empty body %s %s %s f%d" % (row["id"], sid, row["body"], row["sub"]))
                continue
            if not near(px, mi * CELL, row["sub"] * CELL, row["x"], row["y"]):
                fails.append("grip %s %s %s f%d (%d,%d)" % (row["id"], sid, row["body"], row["sub"], row["x"], row["y"]))

    # No second weapon on a baked frame, and no baked sword on an axe or staff.
    for row in data["rows"]:
        if row["sub"] != 0:
            continue
        if row["kind"] in ("sword", "katana", "spear", "dagger") and row["motion"] in ("atk1", "atk2"):
            if row["body"] not in ("atk1", "atk2") or row["paint"]:
                fails.append("baked melee overlay %s %s -> %s paint=%s" % (row["id"], row["motion"], row["body"], row["paint"]))
        if row["kind"] in ("axe", "mace", "staff", "wand", "book", "scythe", "claw", "fist") and row["motion"] in ("atk1", "atk2"):
            if row["body"] in ("atk1", "atk2") or not row["paint"]:
                fails.append("baked sword on %s %s -> %s" % (row["kind"], row["motion"], row["body"]))
        if row["kind"] == "bow" and row["motion"] == "bow" and row["paint"]:
            fails.append("second bow on %s" % row["id"])

    if fails:
        print("\n".join(fails[:40]))
        print("%d weapon checks failed" % len(fails))
        return 1
    print("weapon check passed (%d class poses)" % len(data["rows"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
