#!/usr/bin/env python3
"""Every Heroes99 outfit must read as a garment on the body.

    python3 iron-league/tools/check-clothes.py

cloth_bot is the shirt, pants, and boots. A few sheets (cloth 4, cloth 16,
and any brown/gold dye on the default tan skin) paint that garment in the
skin's own hue, so a distance-from-the-pixel-underneath check reports them
covered while the sprite still looks naked. hero.js dressCloth repaints
those pixels. This applies the same rule and fails bare legs, a skin-hued
torso, or a cloth_bot that does not cover the legs (cape-only tops).
"""
import colorsys
import re
import sys
from collections import Counter
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
HERO = ROOT / "js" / "hero.js"
BASE = ROOT / "assets" / "heroes99"
# Idle and the tank idle, from hero.js FRAMES.
FRAMES = {
    "idle": (19, 3, 46, 33),
    "idle2": (13, 43, 45, 32),
}
ORDER = ("wbot", "skin", "face", "clothBot", "clothTop", "hairBot", "hairTop", "wtop")
# Arms sit in the torso band, so that allowance is wider than the legs.
TORSO_BAD = 0.50
LEG_BAD = 0.40


def fail(msg):
    print("FAIL", msg)
    sys.exit(1)


def consts():
    src = HERO.read_text()
    def num(name):
        m = re.search(r"const %s = ([0-9.]+);" % name, src)
        if not m:
            fail("hero.js is missing " + name)
        return float(m.group(1))
    shifts = re.search(r"const DRESS_SHIFTS = \[([^\]]+)\];", src)
    if not shifts:
        fail("hero.js is missing DRESS_SHIFTS")
    if "dressed[3] = dressCloth(imgs[3], skin, true)" not in src or "dressed[4] = dressCloth(imgs[4], skin, false)" not in src:
        fail("compose() must dress both cloth layers and fill bare feet on cloth_bot only")
    m = re.search(r"return \[(wbot, skin, face, clothBot, clothTop, hairBot, hairTop, wtop)\]", src)
    if not m:
        fail("hero.js draw order is not weapon, skin, face, cloth, hair, weapon")
    order = tuple(m.group(1).split(", "))
    if order != ORDER:
        fail("unexpected layer tokens " + ",".join(order))
    return {
        "hue": num("DRESS_HUE"),
        "sat": num("DRESS_SAT"),
        "val": num("DRESS_VAL"),
        "min_ch": int(num("DRESS_MIN_CH")),
        "keep": int(num("DRESS_KEEP")),
        "clear": num("DRESS_CLEAR"),
        "shifts": [float(x.strip()) for x in shifts.group(1).split(",")],
    }


def hue_dist(a, b):
    d = abs(a - b)
    return d if d < 0.5 else 1 - d


def hsv(rgb):
    return colorsys.rgb_to_hsv(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255)


def lum(rgb):
    return 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]


def skin_hues(skin_i):
    im = Image.open(BASE / ("skin/skin_c%d.png" % skin_i)).convert("RGBA")
    px = im.load()
    w, h = im.size
    found = []
    seen = set()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 200 or max(r, g, b) < 31:
                continue
            if (r, g, b) in seen:
                continue
            seen.add((r, g, b))
            found.append(hsv((r, g, b))[0])
    return found


def like_skin(rgb, hues, C):
    h, s, v = hsv(rgb)
    if s < C["sat"] or v < C["val"]:
        return False
    return min(hue_dist(h, sh) for sh in hues) <= C["hue"]


def shift_dye(rgb, hues, C):
    h, s, v = hsv(rgb)
    s = max(s, 0.55)
    v = min(0.78, max(v, 0.42))
    best = rgb
    best_d = -1
    for delta in C["shifts"]:
        hh = (h + delta) % 1
        dist = min(hue_dist(hh, sh) for sh in hues)
        r, g, b = colorsys.hsv_to_rgb(hh, s, v)
        nxt = (int(round(r * 255)), int(round(g * 255)), int(round(b * 255)))
        if dist > best_d:
            best_d = dist
            best = nxt
        if dist >= C["clear"]:
            return nxt
    return best


def fill_feet(cloth, skin, dye):
    """Boots on bare ankles: the lower part of each body, matching fillFeet."""
    sp, cp = skin.load(), cloth.load()
    w, h = cloth.size
    seen = [[False] * w for _ in range(h)]

    def is_body(x, y):
        r, g, b, a = sp[x, y]
        return a >= 200 and max(r, g, b) >= 40

    for y in range(h):
        for x in range(w):
            if seen[y][x] or not is_body(x, y):
                continue
            stack = [(x, y)]
            seen[y][x] = True
            pix = []
            top = bot = y
            while stack:
                cx, cy = stack.pop()
                pix.append((cx, cy))
                if cy < top:
                    top = cy
                if cy > bot:
                    bot = cy
                for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx] and is_body(nx, ny):
                        seen[ny][nx] = True
                        stack.append((nx, ny))
            if bot - top < 8:
                continue
            cut = top + int(0.78 * (bot - top + 1))
            for cx, cy in pix:
                if cy < cut:
                    continue
                if cp[cx, cy][3] >= 20:
                    continue
                cp[cx, cy] = dye + (255,)


def dye_and_paint(im, skin_im, hues, C, fill):
    """Match dressCloth: repaint pixels whose hue is the active skin."""
    src = im.copy()
    px = src.load()
    w, h = src.size
    keep = []
    flesh = []
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 20:
                continue
            if like_skin((r, g, b), hues, C):
                flesh.append((r, g, b))
            elif max(r, g, b) >= C["min_ch"]:
                keep.append((r, g, b))

    def mode(colors):
        if not colors:
            return None
        bins = Counter((c[0] // 24, c[1] // 24, c[2] // 24) for c in colors)
        key, _ = bins.most_common(1)[0]
        bucket = [c for c in colors if (c[0] // 24, c[1] // 24, c[2] // 24) == key]
        return tuple(sum(c[i] for c in bucket) // len(bucket) for i in range(3))

    dye = mode(keep) if len(keep) >= C["keep"] else None
    if dye and like_skin(dye, hues, C):
        dye = shift_dye(dye, hues, C)
    if dye is None:
        base = mode(flesh) or mode(keep) or (140, 70, 40)
        dye = shift_dye(base, hues, C)
    if like_skin(dye, hues, C):
        dye = shift_dye(dye, hues, C)
    dye_l = max(lum(dye), 28)
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 20 or not like_skin((r, g, b), hues, C):
                continue
            scale = max(0.55, min(1.25, lum((r, g, b)) / dye_l))
            ncol = tuple(max(0, min(255, int(round(dye[i] * scale)))) for i in range(3))
            if like_skin(ncol, hues, C):
                ncol = dye
            px[x, y] = ncol + (a,)
    if fill:
        fill_feet(src, skin_im, dye)
    return src, dye


def crop(path, frame):
    im = Image.open(path).convert("RGBA")
    x, y, w, h = frame
    return im.crop((x, y, x + w, y + h))


def bad_frac(skin, clothed, hues, C, y0, y1):
    sp, cp = skin.load(), clothed.load()
    w = skin.size[0]
    tot = bad = 0
    for y in range(y0, y1):
        for x in range(w):
            sr, sg, sb, sa = sp[x, y]
            if sa < 200 or max(sr, sg, sb) < 40:
                continue
            tot += 1
            r, g, b, a = cp[x, y]
            bare = abs(r - sr) + abs(g - sg) + abs(b - sb) <= 12
            if bare or like_skin((r, g, b), hues, C):
                bad += 1
    if tot < 20:
        fail("body band has too little skin to measure (%d)" % tot)
    return bad / tot, bad, tot


def composite(skin, face, bot, top):
    im = Image.new("RGBA", skin.size, (0, 0, 0, 0))
    im.alpha_composite(skin)
    if face is not None:
        im.alpha_composite(face)
    im.alpha_composite(bot)
    if top is not None:
        im.alpha_composite(top)
    return im


def bands(h):
    return int(h * 0.48), int(h * 0.72)


def measure(skin, face, bot, top, hues, C):
    im = composite(skin, face, bot, top)
    y0, y1 = bands(skin.size[1])
    torso = bad_frac(skin, im, hues, C, y0, y1)
    legs = bad_frac(skin, im, hues, C, y1, skin.size[1])
    return torso, legs


def main():
    C = consts()
    print("ok draw order and dressCloth on cloth_bot and cloth_top")
    print("ok dress hue %.2f sat %.2f val %.2f" % (C["hue"], C["sat"], C["val"]))

    hues = {i: skin_hues(i) for i in (1, 2, 5)}
    skins = {}
    faces = {}
    for name, frame in FRAMES.items():
        for i in hues:
            skins[(name, i)] = crop(BASE / ("skin/skin_c%d.png" % i), frame)
            faces[(name, i)] = crop(BASE / "face/face_c1.png", frame)

    # The raw creator kit must fail this metric. That is the hole the old
    # distance check missed.
    frame = FRAMES["idle"]
    raw_bot = crop(BASE / "cloth/cloth4/cloth4_bot/cloth4_c6_bot.png", frame)
    raw_top = crop(BASE / "cloth/cloth4/cloth4_top/cloth4_c6_top.png", frame)
    bare_t, bare_l = measure(skins[("idle", 1)], faces[("idle", 1)], raw_bot, raw_top, hues[1], C)
    if bare_l[0] < 0.70 or bare_t[0] < 0.70:
        fail("undressed cloth4 c6 should read as bare (torso %.0f%% legs %.0f%%)" % (bare_t[0] * 100, bare_l[0] * 100))
    print("ok undressed cloth4 c6 reads bare (torso %.0f%% legs %.0f%%)" % (bare_t[0] * 100, bare_l[0] * 100))

    blank = Image.new("RGBA", skins[("idle", 1)].size, (0, 0, 0, 0))
    empty_t, empty_l = measure(skins[("idle", 1)], faces[("idle", 1)], blank, blank, hues[1], C)
    if empty_l[0] < 0.70:
        fail("an empty cloth_bot should fail the leg check (legs %.0f%%)" % (empty_l[0] * 100))
    print("ok empty cloth_bot fails the leg check")

    worst_l = 0
    worst_name = ""
    for n in range(1, 18):
        for color in range(1, 9):
            for pose in FRAMES:
                frame = FRAMES[pose]
                bot = crop(BASE / ("cloth/cloth%d/cloth%d_bot/cloth%d_c%d_bot.png" % (n, n, n, color)), frame)
                top = crop(BASE / ("cloth/cloth%d/cloth%d_top/cloth%d_c%d_top.png" % (n, n, n, color)), frame)
                for skin_i in hues:
                    skin_im = skins[(pose, skin_i)]
                    db, _ = dye_and_paint(bot, skin_im, hues[skin_i], C, True)
                    dt, _ = dye_and_paint(top, skin_im, hues[skin_i], C, False)
                    torso, legs = measure(skins[(pose, skin_i)], faces[(pose, skin_i)], db, dt, hues[skin_i], C)
                    label = "cloth%d c%d skin%d %s" % (n, color, skin_i, pose)
                    if legs[0] > worst_l:
                        worst_l = legs[0]
                        worst_name = label
                    if torso[0] > TORSO_BAD:
                        fail("%s torso still %.0f%% skin (%d/%d)" % (label, torso[0] * 100, torso[1], torso[2]))
                    if legs[0] > LEG_BAD:
                        fail("%s legs still %.0f%% skin (%d/%d)" % (label, legs[0] * 100, legs[1], legs[2]))
                    # The pants have to live on cloth_bot. A cape-only top must not pass.
                    bot_only = composite(skins[(pose, skin_i)], faces[(pose, skin_i)], db, None)
                    y0, y1 = bands(bot_only.size[1])
                    bot_legs = bad_frac(skins[(pose, skin_i)], bot_only, hues[skin_i], C, y1, bot_only.size[1])
                    if bot_legs[0] > LEG_BAD:
                        fail("%s cloth_bot leaves legs %.0f%% bare" % (label, bot_legs[0] * 100))
                    # Collar must not eat the face.
                    face = faces[(pose, skin_i)]
                    bare = composite(skins[(pose, skin_i)], face, Image.new("RGBA", face.size, (0, 0, 0, 0)), None)
                    dressed = composite(skins[(pose, skin_i)], face, db, dt)
                    fp, dp, bp = face.load(), dressed.load(), bare.load()
                    covered = 0
                    for y in range(6, min(15, face.size[1])):
                        for x in range(face.size[0]):
                            if fp[x, y][3] <= 16:
                                continue
                            if dp[x, y][:3] != bp[x, y][:3]:
                                covered += 1
                    if covered:
                        fail("%s covers %d face pixels" % (label, covered))

    # Full sheets, not just the idle crop: the game dresses the 800×680 atlas.
    for n, color in ((4, 6), (16, 6), (1, 1)):
        bot = Image.open(BASE / ("cloth/cloth%d/cloth%d_bot/cloth%d_c%d_bot.png" % (n, n, n, color))).convert("RGBA")
        top = Image.open(BASE / ("cloth/cloth%d/cloth%d_top/cloth%d_c%d_top.png" % (n, n, n, color))).convert("RGBA")
        skin_full = Image.open(BASE / "skin/skin_c1.png").convert("RGBA")
        db, dye = dye_and_paint(bot, skin_full, hues[1], C, True)
        dt, _ = dye_and_paint(top, skin_full, hues[1], C, False)
        if like_skin(dye, hues[1], C):
            fail("full-sheet dye for cloth%d c%d is still a skin hue %s" % (n, color, dye))
        frame = FRAMES["idle"]
        x, y, w, h = frame
        skin = Image.open(BASE / "skin/skin_c1.png").convert("RGBA").crop((x, y, x + w, y + h))
        face = Image.open(BASE / "face/face_c1.png").convert("RGBA").crop((x, y, x + w, y + h))
        torso, legs = measure(skin, face, db.crop((x, y, x + w, y + h)), dt.crop((x, y, x + w, y + h)), hues[1], C)
        if legs[0] > LEG_BAD or torso[0] > TORSO_BAD:
            fail("full sheet cloth%d c%d idle torso %.0f%% legs %.0f%%" % (n, color, torso[0] * 100, legs[0] * 100))
        print("ok full sheet cloth%d c%d dye %s legs %.0f%%" % (n, color, dye, legs[0] * 100))

    print("ok all 17 outfits on skins 1, 2, 5; barest legs %s %.0f%%" % (worst_name, worst_l * 100))
    print("clothes passed")


if __name__ == "__main__":
    main()
