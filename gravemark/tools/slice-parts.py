#!/usr/bin/env python3
"""Cut a character's rig parts out of ONE exploded parts sheet.

Image generators cannot paint "only the forearm" from a reference — asked for
that, they crop a rectangle of cloth out of the painting (the first Tier 1
delivery). What they CAN paint is the classic cut-out puppet sheet: the whole
figure taken apart, every piece complete with its own silhouette, laid out
with gaps on a flat background. This tool takes that sheet and produces the
per-part files the rig wants, each on its manifest canvas with the joint at
the manifest pivot.

    python3 tools/slice-parts.py sheet.png hero --out /tmp/stage
    python3 tools/art-install.py /tmp/stage

Layout the brief asks for (rows top to bottom, left to right):
    row 1:  head  torso  pelvis
    row 2:  uarm_f  farm_f  uarm_b  farm_b
    row 3:  thigh_f  shin_f  thigh_b  shin_b
If the sheet came back in another order, --order names the pieces as they are
found (rows top to bottom, then left to right); a numbered contact sheet is
written next to the output so the order can be read off.
"""
import os, sys, json, argparse, subprocess
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROWS = {
    "humanoid": [["head", "torso", "pelvis"],
                 ["uarm_f", "farm_f", "uarm_b", "farm_b"],
                 ["thigh_f", "shin_f", "thigh_b", "shin_b"]],
}

def manifest():
    out = subprocess.run(["node", os.path.join(HERE, "art-manifest.js")],
                         capture_output=True, text=True, check=True)
    return json.loads(out.stdout)

def is_bg(px, tol=60):
    """Magenta, or the deeper pink card a generator likes to lay the pieces on
    inside the magenta (this delivery: #e9017e). Both are far from any paint
    the figures use: reds have no blue, purples have green."""
    r, g, b = px[:3]
    if r > 255 - tol and g < tol and b > 255 - tol: return True
    return r > 190 and g < 60 and b > 100

def components(img, min_area=120):
    """Connected components of non-magenta pixels (4-neighbour), as bboxes."""
    w, h = img.size
    pix = img.load()
    seen = bytearray(w * h)
    comps = []
    for y0 in range(h):
        for x0 in range(w):
            if seen[y0 * w + x0] or is_bg(pix[x0, y0]):
                continue
            stack = [(x0, y0)]; seen[y0 * w + x0] = 1
            minx = maxx = x0; miny = maxy = y0; n = 0
            while stack:
                x, y = stack.pop(); n += 1
                if x < minx: minx = x
                if x > maxx: maxx = x
                if y < miny: miny = y
                if y > maxy: maxy = y
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and not is_bg(pix[nx, ny]):
                        seen[ny * w + nx] = 1; stack.append((nx, ny))
            if n >= min_area:
                comps.append({"box": (minx, miny, maxx + 1, maxy + 1), "area": n})
    return comps

def merge_close(comps, gap=6):
    """A boot sole or a fingertip can split off its limb by a strip of matte.
    Attach every SMALL component to the nearest big one. Big pieces are never
    merged with each other: on a tightly packed sheet the bounding boxes of
    neighbouring pieces overlap even when their paint does not, and merging on
    box overlap turned a whole sheet into one piece."""
    if not comps: return comps
    biggest = max(c["area"] for c in comps)
    big = [c for c in comps if c["area"] >= biggest * 0.10]
    small = [c for c in comps if c["area"] < biggest * 0.10]
    def dist(a, b):
        dx = max(0, max(a[0], b[0]) - min(a[2], b[2]))
        dy = max(0, max(a[1], b[1]) - min(a[3], b[3]))
        return dx + dy
    for sm in small:
        best = min(big, key=lambda c: dist(c["box"], sm["box"]))
        if dist(best["box"], sm["box"]) > 40: continue      # stray speck: drop it
        a, b = best["box"], sm["box"]
        best["box"] = (min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3]))
        best["area"] += sm["area"]
    return big

def into_rows(comps, rows_wanted):
    """Cluster by vertical centre into the number of rows the layout has."""
    cs = sorted(comps, key=lambda c: (c["box"][1] + c["box"][3]) / 2)
    if len(cs) < 2:
        return [cs]
    gaps = []
    for i in range(1, len(cs)):
        gaps.append(((cs[i]["box"][1] + cs[i]["box"][3]) / 2 - (cs[i - 1]["box"][1] + cs[i - 1]["box"][3]) / 2, i))
    cuts = sorted(sorted(gaps, reverse=True)[:rows_wanted - 1], key=lambda g: g[1])
    rows, start = [], 0
    for _, i in cuts:
        rows.append(cs[start:i]); start = i
    rows.append(cs[start:])
    return [sorted(r, key=lambda c: c["box"][0]) for r in rows]

def place(piece, spec):
    """Fit a cut-out onto its manifest canvas with the joint on the pivot."""
    cw, ch, px, py = spec["w"], spec["h"], spec["pivot"]["x"], spec["pivot"]["y"]
    pw, ph = piece.size
    top_joint = py < 0.5           # limbs and pelvis hang down from the joint
    avail_h = ch * ((1 - py) if top_joint else py) - 4
    avail_w = cw - 4
    s = min(avail_w / pw, avail_h / ph)
    nw, nh = max(1, round(pw * s)), max(1, round(ph * s))
    piece = piece.resize((nw, nh), Image.LANCZOS)
    out = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    jx, jy = round(px * cw), round(py * ch)
    x = jx - nw // 2
    y = jy if top_joint else jy - nh
    out.paste(piece, (x, y), piece)
    return out

def keyed(img):
    """Magenta to transparent, with a soft edge so the fringe does not glow."""
    img = img.convert("RGBA"); pix = img.load(); w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = pix[x, y]
            if is_bg((r, g, b)):
                pix[x, y] = (0, 0, 0, 0)
            elif is_bg((r, g, b), tol=110):          # fringe: half magenta
                pix[x, y] = (r, (g + r) // 2, b, 140)
    return img

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("sheet")
    ap.add_argument("char", help="character id, e.g. hero")
    ap.add_argument("--rig", default="humanoid")
    ap.add_argument("--out", default=os.path.join(HERE, "..", "art"))
    ap.add_argument("--order", help="comma list of part ids in found order (rows top-down, left-right)")
    a = ap.parse_args()

    specs = {s["key"]: s for s in manifest()}
    layout = ROWS[a.rig]
    wanted = [p for row in layout for p in row]

    img = Image.open(a.sheet).convert("RGB")
    comps = merge_close(components(img))
    rows = into_rows(comps, len(layout))
    found = [c for row in rows for c in row]

    # numbered contact sheet, for reading the order off when it is not the brief's
    contact = img.copy(); d = ImageDraw.Draw(contact)
    for i, c in enumerate(found):
        d.rectangle(c["box"], outline=(0, 255, 0), width=2)
        d.text((c["box"][0] + 3, c["box"][1] + 3), str(i + 1), fill=(255, 255, 0))
    os.makedirs(a.out, exist_ok=True)
    contact.save(os.path.join(a.out, "slice-contact.png"))

    print(f"pieces found: {len(found)} in rows {[len(r) for r in rows]}  (layout wants {[len(r) for r in layout]})")
    if a.order:
        names = [n.strip() for n in a.order.split(",")]
    elif [len(r) for r in rows] == [len(r) for r in layout]:
        names = wanted
    else:
        print("  row shape does not match the brief; read slice-contact.png and pass --order")
        sys.exit(1)
    if len(names) != len(found):
        print(f"  --order names {len(names)} pieces but {len(found)} were found"); sys.exit(1)

    dest = os.path.join(a.out, "parts", a.char); os.makedirs(dest, exist_ok=True)
    for name, c in zip(names, found):
        key = f"parts/{a.char}/{name}"
        spec = specs.get(key)
        if not spec:
            print(f"  no manifest spec for {key}, skipped"); continue
        piece = keyed(img.crop(c["box"]))
        bb = piece.getchannel("A").getbbox()
        piece = piece.crop(bb) if bb else piece
        place(piece, spec).save(os.path.join(dest, name + ".png"), optimize=True)
        print(f"  {name:8s} <- piece {c['box']}  -> {spec['w']}x{spec['h']}")
    print(f"wrote {dest}; install with: python3 tools/art-install.py {a.out}")

if __name__ == "__main__":
    main()
