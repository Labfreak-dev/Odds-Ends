#!/usr/bin/env python3
"""Pack thankless/art-src/ into thankless/art.js and stamp index.html.

    python3 thankless/pack-art.py            # pack everything in art-src/
    python3 thankless/pack-art.py --check    # report only, write nothing
    python3 thankless/pack-art.py --src DIR --out FILE --html FILE   # elsewhere (tests)

What happens to each file, by key prefix:
  tile_   ground texture: square crop, 256x256, seams blended so it tiles
  decal_  ground prop: keyed off magenta, trimmed, fitted into 128x128
  face_   HUD bust: square crop, 96x96, background kept
  title   menu painting: 16:9 crop, 640x360, background kept
  (else)  sprite: keyed off magenta, trimmed, fitted into 128x128

Keying (the matte fix): the background colour is the median of the border
pixels. Pixels reachable from the border through colours within TOL of it go
transparent; pixels within TOL/2 of it anywhere go transparent (the gaps
between legs); pixels near the cut get a feathered alpha and a despill so no
magenta fringe survives. A sprite that still has magenta in it after packing
had magenta in its design: regenerate it with the lock in the prompt.

Output: art.js is `window.TL_ART={key:{w,h,src}}` followed by a call to
tlArtLoaded() if the page defines one. index.html's ART_V becomes the file's
hash so a changed art file busts the browser cache.
"""
import argparse, base64, hashlib, io, json, pathlib, re, sys
from collections import deque

HERE = pathlib.Path(__file__).resolve().parent
TOL = 70.0         # colour distance (0..441) that still counts as background
FEATHER = 2        # px of alpha ramp inside the cut

def median_border(px, w, h):
    cols = [px[x, 0] for x in range(w)] + [px[x, h-1] for x in range(w)] + [px[0, y] for y in range(h)] + [px[w-1, y] for y in range(h)]
    cols = [c[:3] for c in cols]
    return tuple(sorted(c[i] for c in cols)[len(cols)//2] for i in range(3))

def key_out(im):
    """Return an RGBA image with the border-connected background removed."""
    from PIL import Image
    im = im.convert("RGBA"); w, h = im.size; px = im.load()
    bg = median_border(px, w, h)
    def dist(c): return ((c[0]-bg[0])**2 + (c[1]-bg[1])**2 + (c[2]-bg[2])**2) ** 0.5
    d = [[dist(px[x, y]) for x in range(w)] for y in range(h)]
    back = [[False]*w for _ in range(h)]
    q = deque()
    for x in range(w):
        for y in (0, h-1):
            if d[y][x] < TOL and not back[y][x]: back[y][x] = True; q.append((x, y))
    for y in range(h):
        for x in (0, w-1):
            if d[y][x] < TOL and not back[y][x]: back[y][x] = True; q.append((x, y))
    while q:
        x, y = q.popleft()
        for nx, ny in ((x+1, y), (x-1, y), (x, y+1), (x, y-1)):
            if 0 <= nx < w and 0 <= ny < h and not back[ny][nx] and d[ny][nx] < TOL:
                back[ny][nx] = True; q.append((nx, ny))
    for y in range(h):
        for x in range(w):
            if d[y][x] < TOL * 0.5: back[y][x] = True      # enclosed holes of pure background
    # alpha: 0 for background; feathered for foreground pixels bordering it
    out = Image.new("RGBA", (w, h)); op = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if back[y][x]: op[x, y] = (0, 0, 0, 0); continue
            near = False
            for k in range(1, FEATHER+1):
                for nx, ny in ((x+k, y), (x-k, y), (x, y+k), (x, y-k)):
                    if 0 <= nx < w and 0 <= ny < h and back[ny][nx]: near = True; break
                if near: break
            if near:
                # partial edge pixel: alpha from how far its colour is from the background, and despill
                t = min(1.0, max(0.0, (d[y][x] - TOL * 0.5) / TOL))
                a = int(255 * (0.35 + 0.65 * t))
                if bg[0] > 180 and bg[2] > 180 and bg[1] < 80:       # magenta lock: pull the pink out of the fringe
                    m = (r + b) / 2
                    if m > g: r = int(min(r, g + (r - g) * 0.4)); b = int(min(b, g + (b - g) * 0.4))
            op[x, y] = (r, g, b, a)
    return out

def trim(im):
    bbox = im.getbbox()
    return im.crop(bbox) if bbox else im

def fit(im, box):
    from PIL import Image
    w, h = im.size; s = min(box / w, box / h)
    if s < 1: im = im.resize((max(1, round(w*s)), max(1, round(h*s))), Image.LANCZOS)
    return im

def square(im, size):
    from PIL import Image
    w, h = im.size; s = min(w, h)
    return im.crop(((w-s)//2, (h-s)//2, (w-s)//2+s, (h-s)//2+s)).resize((size, size), Image.LANCZOS)

def seamless(im):
    """Blend the tile with a half-offset copy so its edges meet."""
    from PIL import Image, ImageChops
    w, h = im.size
    shifted = ImageChops.offset(im, w//2, h//2)
    mask = Image.new("L", (w, h)); mp = mask.load()
    for y in range(h):
        for x in range(w):
            fx = min(x, w-1-x) / (w/2); fy = min(y, h-1-y) / (h/2)
            f = min(1.0, min(fx, fy) * 2.2)          # 1 in the middle, 0 at the edges
            mp[x, y] = int(255 * f)
    return Image.composite(im, shifted, mask)

def pack_one(path):
    from PIL import Image
    key = path.stem; im = Image.open(path)
    if key.startswith("tile_"):
        out = seamless(square(im.convert("RGB"), 256)); q = 80
    elif key.startswith("face_"):
        out = square(im.convert("RGB"), 96); q = 85
    elif key == "title":
        w, h = im.size; tw, th = w, int(w * 9 / 16)
        if th > h: th, tw = h, int(h * 16 / 9)
        out = im.convert("RGB").crop(((w-tw)//2, (h-th)//2, (w-tw)//2+tw, (h-th)//2+th)).resize((640, 360), Image.LANCZOS); q = 82
    else:
        out = fit(trim(key_out(im)), 128); q = 88
    buf = io.BytesIO(); out.save(buf, "WEBP", quality=q, method=6)
    return key, out.size, buf.getvalue()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default=str(HERE / "art-src")); ap.add_argument("--out", default=str(HERE / "art.js"))
    ap.add_argument("--html", default=str(HERE / "index.html")); ap.add_argument("--check", action="store_true")
    a = ap.parse_args()
    try: from PIL import Image  # noqa
    except ImportError: sys.exit("Pillow is required:  pip install pillow")
    src = pathlib.Path(a.src); files = sorted(p for p in src.glob("*") if p.suffix.lower() in (".webp", ".png", ".jpg", ".jpeg"))
    entries = {}; total = 0
    for p in files:
        key, (w, h), data = pack_one(p)
        entries[key] = {"w": w, "h": h, "src": "data:image/webp;base64," + base64.b64encode(data).decode()}
        total += len(data); print(f"  {key:16s} {w:4d}x{h:<4d} {len(data)//1024:4d}KB")
    print(f"{len(entries)} images, {total//1024}KB of webp")
    if a.check: return
    js = ("// Thankless — the art. GENERATED by pack-art.py from art-src/; do not edit.\n"
          "window.TL_ART=" + json.dumps(entries, separators=(",", ":")) + ";\n"
          "if(window.tlArtLoaded)window.tlArtLoaded();\n")
    out = pathlib.Path(a.out); out.write_text(js)
    stamp = hashlib.sha1(out.read_bytes()).hexdigest()[:8]
    html = pathlib.Path(a.html); s = html.read_text()
    s2, n = re.subn(r"const ART_V='[0-9a-z]*';", "const ART_V='%s';" % stamp, s)
    if n != 1: sys.exit("ART_V not found exactly once in " + str(html))
    html.write_text(s2); print(f"wrote {out} ({out.stat().st_size//1024}KB), stamped ART_V={stamp}")

if __name__ == "__main__":
    main()
