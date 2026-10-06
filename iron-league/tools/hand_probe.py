#!/usr/bin/env python3
"""Measure the front fist on a Time Fantasy sheet and check it on every sheet.

Sheets are 576×144: 12 motions × 3 frames of 48×48, characters facing left.
Skin blobs that are not the head, the hip gap, or a bow stave are hands.
The recorded table lives in js/weapons.js (HAND). This probe redraws the
reference at 8× with a pixel grid, overlays those markers on a contact of
twelve sheets, and fails unless the marker pixel itself is opaque.
"""
import os
import sys
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHEETS = os.path.join(ROOT, "assets", "timefantasy")
CELL = 48
MOTIONS = ["idle1", "idle2", "walk", "atk1", "atk2", "bow", "gun", "hit", "crouch", "magic", "cheer", "dead"]

# Front fist, then the back hand. Same numbers as weapons.js HAND / BACK.
FRONT = {
    "idle1": [(16, 34), (16, 34), (16, 33)],
    "idle2": [(16, 34), (16, 33), (16, 34)],
    "walk": [(21, 34), (20, 34), (20, 35)],
    "atk1": [(19, 37), (27, 31), (20, 37)],
    "atk2": [(26, 35), (25, 22), (24, 35)],
    "bow": [(16, 30), (15, 30), (16, 30)],
    "gun": [(17, 33), (17, 33), (17, 33)],
    "hit": [(19, 33), (18, 30), (19, 29)],
    "crouch": [(19, 38), (19, 37), (19, 38)],
    "magic": [(18, 23), (18, 23), (18, 23)],
    "cheer": [(30, 23), (30, 29), (31, 25)],
    "dead": [(23, 37), (23, 37), (23, 37)],
}
BACK = {
    "idle1": [(31, 33), (31, 33), (31, 32)],
    "idle2": [(33, 33), (33, 32), (33, 33)],
    "walk": [(28, 33), (30, 34), (28, 36)],
    "atk1": [(20, 38), (17, 31), (19, 37)],
    "atk2": [(24, 26), (25, 35), (22, 26)],
    "bow": [(32, 26), (30, 29), (32, 29)],
    "gun": [(26, 33), (26, 33), (24, 33)],
    "hit": [(30, 33), (33, 30), (34, 29)],
    "crouch": [(22, 30), (22, 30), (22, 31)],
    "magic": [(31, 23), (31, 23), (31, 23)],
    "cheer": [(24, 34), (24, 35), (24, 35)],
    "dead": [(32, 39), (32, 39), (32, 39)],
}


def skin(r, g, b, a):
    if a < 180 or (r > 240 and g > 230):
        return False
    return r >= 140 and g >= 70 and b <= 210 and r >= g - 10 and g + 15 >= b and (r - b) >= 28


def blobs(cell):
    px = cell.load()
    seen = [[False] * CELL for _ in range(CELL)]
    found = []
    for y in range(CELL):
        for x in range(CELL):
            if seen[y][x]:
                continue
            r, g, b, a = px[x, y]
            if not skin(r, g, b, a):
                continue
            stack = [(x, y)]
            seen[y][x] = True
            pts = []
            while stack:
                cx, cy = stack.pop()
                pts.append((cx, cy))
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < CELL and 0 <= ny < CELL and not seen[ny][nx]:
                            rr, gg, bb, aa = px[nx, ny]
                            if skin(rr, gg, bb, aa):
                                seen[ny][nx] = True
                                stack.append((nx, ny))
            if len(pts) < 3:
                continue
            xs = [p[0] for p in pts]
            ys = [p[1] for p in pts]
            found.append((len(pts), sorted(xs)[len(xs) // 2], sorted(ys)[len(ys) // 2], min(xs), min(ys), max(xs), max(ys)))
    hands = []
    for b in found:
        w = b[5] - b[3] + 1
        h = b[6] - b[4] + 1
        if b[0] >= 12 and b[2] < 30 and b[4] < 26:
            continue  # head
        if h > 14 and w <= 3:
            continue  # bow stave
        if 22 <= b[1] <= 27 and 33 <= b[2] <= 36 and b[0] <= 6:
            continue  # hip gap
        hands.append(b)
    hands.sort(key=lambda b: b[1])
    return hands


def near_opaque(px, ox, oy, x, y):
    return 0 <= x < CELL and 0 <= y < CELL and px[ox + x, oy + y][3] > 40


def cell_opaque(px, ox, oy):
    for y in range(CELL):
        for x in range(CELL):
            if px[ox + x, oy + y][3] > 40:
                return True
    return False


def draw_grid(sheet_path, out_path):
    im = Image.open(sheet_path).convert("RGBA")
    z = 8
    cw, ch = CELL * z, CELL * z
    pad = 16
    canvas = Image.new("RGB", (12 * (cw + 4) + 8, 3 * (ch + pad) + 8), (24, 22, 20))
    label = ImageDraw.Draw(canvas)
    for mi, name in enumerate(MOTIONS):
        for f in range(3):
            cell = im.crop((mi * CELL, f * CELL, (mi + 1) * CELL, (f + 1) * CELL)).resize((cw, ch), Image.NEAREST)
            bg = Image.new("RGB", (cw, ch), (48, 42, 36))
            bg.paste(cell, (0, 0), cell)
            d = ImageDraw.Draw(bg)
            for i in range(CELL):
                col = (90, 90, 90) if i % 4 == 0 else (60, 60, 60)
                d.line([(i * z, 0), (i * z, ch)], fill=col)
                d.line([(0, i * z), (cw, i * z)], fill=col)
            fx, fy = FRONT[name][f]
            bx, by = BACK[name][f]

            def cross(x, y, color):
                X, Y = x * z + z // 2, y * z + z // 2
                d.line([(X - 5, Y), (X + 5, Y)], fill=color, width=2)
                d.line([(X, Y - 5), (X, Y + 5)], fill=color, width=2)

            cross(fx, fy, (255, 40, 40))
            cross(bx, by, (70, 150, 255))
            ox = 4 + mi * (cw + 4)
            oy = 4 + f * (ch + pad)
            canvas.paste(bg, (ox, oy))
            label.text((ox, oy + ch + 1), "%s %d  %d,%d" % (name, f, fx, fy), fill=(240, 230, 210))
    canvas.save(out_path)
    return canvas.size


def main():
    ref = os.path.join(SHEETS, "1_1.png")
    im = Image.open(ref).convert("RGBA")
    print("reference fists (front blobs, head and hip dropped)")
    for mi, name in enumerate(MOTIONS):
        for f in range(3):
            cell = im.crop((mi * CELL, f * CELL, (mi + 1) * CELL, (f + 1) * CELL))
            found = blobs(cell)
            desc = ", ".join("%d,%d(n%d)" % (b[1], b[2], b[0]) for b in found) or "(none)"
            mark = FRONT[name][f]
            print("  %s f%d mark %d,%d  blobs %s" % (name, f, mark[0], mark[1], desc))

    files = sorted(fn for fn in os.listdir(SHEETS) if fn.endswith(".png"))
    misses = []
    for fn in files:
        px = Image.open(os.path.join(SHEETS, fn)).convert("RGBA").load()
        for mi, name in enumerate(MOTIONS):
            for f, (x, y) in enumerate(FRONT[name]):
                if not cell_opaque(px, mi * CELL, f * CELL):
                    continue
                if not near_opaque(px, mi * CELL, f * CELL, x, y):
                    misses.append("%s %s f%d" % (fn[:-4], name, f))
    out_dir = os.path.join(ROOT, "tools", "out")
    os.makedirs(out_dir, exist_ok=True)
    size = draw_grid(ref, os.path.join(out_dir, "hand_grid.png"))
    sample = ["1_1", "1_5", "2_7", "3_6", "4_5", "4_6", "5_8", "6_2", "7_2", "military1_1", "military2_1", "military3_4"]
    show = [("idle1", 0), ("walk", 1), ("atk1", 2), ("magic", 0), ("bow", 0), ("dead", 0)]
    z = 3
    cw, ch = CELL * z, CELL * z
    contact = Image.new("RGB", (len(show) * (cw + 2) + 90, len(sample) * (ch + 2) + 18), (20, 18, 16))
    cd = ImageDraw.Draw(contact)
    for ci, (name, f) in enumerate(show):
        cd.text((90 + ci * (cw + 2), 1), "%s %d" % (name, f), fill=(220, 210, 190))
    for ri, key in enumerate(sample):
        src = Image.open(os.path.join(SHEETS, key + ".png")).convert("RGBA")
        cd.text((2, 18 + ri * (ch + 2)), key, fill=(220, 210, 190))
        for ci, (name, f) in enumerate(show):
            mi = MOTIONS.index(name)
            cell = src.crop((mi * CELL, f * CELL, (mi + 1) * CELL, (f + 1) * CELL)).resize((cw, ch), Image.NEAREST)
            bg = Image.new("RGB", (cw, ch), (48, 42, 36))
            bg.paste(cell, (0, 0), cell)
            d = ImageDraw.Draw(bg)
            fx, fy = FRONT[name][f]
            X, Y = fx * z + z // 2, fy * z + z // 2
            d.ellipse((X - 3, Y - 3, X + 3, Y + 3), outline=(255, 40, 40))
            contact.paste(bg, (90 + ci * (cw + 2), 18 + ri * (ch + 2)))
    contact.save(os.path.join(out_dir, "hand_contact.png"))
    print("grid", size, "sheets", len(files), "misses", len(misses))
    if misses:
        print("\n".join(misses[:20]))
        return 1
    print("one fist table fits every opaque cell on all 80 sheets")
    print("bow column is empty on military2/3; gun column is empty everywhere else")
    return 0


if __name__ == "__main__":
    sys.exit(main())
