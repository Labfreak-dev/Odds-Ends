#!/usr/bin/env python3
"""Fail if a class weapon grip misses the fist or the handle is off the sprite.

For every class, motion, frame, and sheet that class can wear, the grip pixel
itself must be opaque, and the weapon's handle pixel must be opaque so the
drawn handle lands on that fist. A frame that already paints a weapon (idle2
sword, sword/thrust attacks, bow, gun) must not also draw a loose weapon, and
a class may stand on that frame only when the baked weapon is its own. Where
a loose weapon is drawn, part of it must land off the body.
"""
import json
import math
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
  const art = kind === "staff" && id === "druid" ? "staff_wood" : (kind === "staff" && id === "alchemist" ? "wand" : kind);
  IL.looksFor(id).forEach(function (sid) {
    IL.weapons.motions.forEach(function (motion) {
      for (let sub = 0; sub < 3; sub++) {
        const body = IL.weapons.column(kind, motion, sid);
        const anchor = IL.weapons.handAnchor(kind, body, sub);
        rows.push({
          id: id, kind: kind, art: art, motion: motion, sub: sub, sheet: sid,
          x: anchor.x, y: anchor.y, rot: anchor.rot, body: body,
          paint: IL.weapons.shouldPaint(kind, body, sid)
        });
      }
    });
  });
});
const specs = {};
Object.keys(IL.weapons.specs).forEach(function (k) {
  const s = IL.weapons.specs[k];
  specs[k] = { w: s.w, h: s.h, gx: s.gx, gy: s.gy, angle: s.angle || 0, native: !!s.native };
});
process.stdout.write(JSON.stringify({ rows: rows, specs: specs, hands: IL.weapons.hands }));
""" % json.dumps(ROOT)

BAKED_MELEE = ("sword", "katana", "spear", "dagger")


def matches_baked(body, kind):
    """True/False when body is a baked-weapon column, else None."""
    if body == "idle2":
        return kind == "sword"
    if body in ("atk1", "atk2"):
        return kind in BAKED_MELEE
    if body == "bow":
        return kind in ("bow", "crossbow")
    if body == "gun":
        return kind == "gun"
    return None


def near(px, ox, oy, x, y):
    return 0 <= x < CELL and 0 <= y < CELL and px[ox + x, oy + y][3] > 40


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

    sprites = {}

    def sprite(kind):
        if kind not in sprites:
            path = os.path.join(SPRITES, kind + ".png")
            sprites[kind] = Image.open(path).convert("RGBA") if os.path.exists(path) else None
        return sprites[kind]

    def visible_count(px, ox, oy, im, spec, ax, ay, spin):
        sp = im.load()
        cos, sin = math.cos(spin), math.sin(spin)
        gx, gy = spec["gx"], spec["gy"]
        shown = 0
        opaque = 0
        for sy in range(spec["h"]):
            for sx in range(spec["w"]):
                if sp[sx, sy][3] <= 40:
                    continue
                opaque += 1
                rx = (sx - gx) * cos - (sy - gy) * sin
                ry = (sx - gx) * sin + (sy - gy) * cos
                wx = int(round(ax + rx))
                wy = int(round(ay + ry))
                if wx < 0 or wy < 0 or wx >= CELL or wy >= CELL or px[ox + wx, oy + wy][3] <= 40:
                    shown += 1
        return shown, opaque

    # Every class pose, on every sheet that class can wear.
    for row in data["rows"]:
        mi = MOTIONS.index(row["body"])
        sid = row["sheet"]
        px = sheet(sid)
        if not nonempty(px, mi * CELL, row["sub"] * CELL):
            fails.append("empty body %s %s %s f%d" % (row["id"], sid, row["body"], row["sub"]))
            continue
        if not near(px, mi * CELL, row["sub"] * CELL, row["x"], row["y"]):
            fails.append("grip %s %s %s f%d (%d,%d)" % (row["id"], sid, row["body"], row["sub"], row["x"], row["y"]))
        baked = matches_baked(row["body"], row["kind"])
        if baked is True and row["paint"]:
            fails.append("overlay on baked %s %s %s -> %s f%d" % (row["id"], sid, row["motion"], row["body"], row["sub"]))
        elif baked is False:
            fails.append("baked weapon on %s %s %s -> %s" % (row["kind"], sid, row["motion"], row["body"]))
        if row["motion"] == "idle2" and row["kind"] != "sword":
            if row["body"] != "idle1" or not row["paint"]:
                fails.append("idle2 sword on %s %s -> %s paint=%s" % (row["id"], row["motion"], row["body"], row["paint"]))
        if row["motion"] in ("atk1", "atk2") and row["kind"] not in BAKED_MELEE:
            if row["kind"] in ("bow", "crossbow"):
                ok = (row["body"] == "bow" and not row["paint"]) or (row["body"] == "magic" and row["paint"])
            elif row["kind"] == "gun":
                ok = (row["body"] == "gun" and not row["paint"]) or (row["body"] == "magic" and row["paint"])
            else:
                ok = row["body"] not in ("atk1", "atk2", "idle2", "bow", "gun") and row["paint"]
            if not ok:
                fails.append("attack column on %s %s -> %s paint=%s" % (row["id"], row["motion"], row["body"], row["paint"]))
        if row["kind"] in ("bow", "crossbow") and row["motion"] == "bow":
            if row["body"] == "bow" and row["paint"]:
                fails.append("second bow %s %s" % (row["id"], sid))
            if row["body"] not in ("bow", "magic"):
                fails.append("bow stood on %s %s" % (row["id"], row["body"]))
        if row["kind"] == "gun" and row["motion"] == "gun":
            if row["body"] == "gun" and row["paint"]:
                fails.append("second gun %s %s" % (row["id"], sid))
            if row["body"] not in ("gun", "magic"):
                fails.append("gun stood on %s %s" % (row["id"], row["body"]))
        if not row["paint"] or row["kind"] == "fist":
            continue
        spec = data["specs"].get(row["art"])
        im = sprite(row["art"])
        if not spec or im is None:
            fails.append("missing sprite %s" % row["art"])
            continue
        spin = row["rot"] if spec["native"] else row["rot"] + spec["angle"] * math.pi / 180
        shown, opaque = visible_count(px, mi * CELL, row["sub"] * CELL, im, spec, row["x"], row["y"], spin)
        need = 6 if opaque >= 6 else opaque
        if shown < need:
            fails.append("hidden %s %s %s f%d %d/%d" % (row["id"], row["body"], row["art"], row["sub"], shown, opaque))

    if fails:
        print("\n".join(fails[:40]))
        print("%d weapon checks failed" % len(fails))
        return 1
    print("weapon check passed (%d class poses)" % len(data["rows"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
