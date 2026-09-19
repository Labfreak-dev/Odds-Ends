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
EDGE = 24          # px inward from the cut that may still be a background mix (a glow fades that far)

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
    # foreground pixels within EDGE px of the background are a mix of the two: estimate
    # each one's alpha from its distance to the background colour, then unmix its true
    # colour (c = a*fg + (1-a)*bg  =>  fg = (c - (1-a)*bg) / a). This is what removes
    # a magenta halo from a glow or a soft outline without touching purples deeper in.
    magenta = bg[0] > 180 and bg[2] > 180 and bg[1] < 80
    depth = [[-1]*w for _ in range(h)]; q = deque()
    for y in range(h):
        for x in range(w):
            if back[y][x]: depth[y][x] = 0; q.append((x, y))
    while q:
        x, y = q.popleft()
        if depth[y][x] >= EDGE: continue
        for nx, ny in ((x+1, y), (x-1, y), (x, y+1), (x, y-1)):
            if 0 <= nx < w and 0 <= ny < h and depth[ny][nx] < 0:
                depth[ny][nx] = depth[y][x] + 1; q.append((nx, ny))
    out = Image.new("RGBA", (w, h)); op = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if back[y][x]: op[x, y] = (0, 0, 0, 0); continue
            dd = d[y][x]; al = None
            if magenta and depth[y][x] > 0 and dd < TOL * 2.6 and abs(r - b) < 40 and g < min(r, b) - 20:
                # a magenta-hued pixel near the cut is spill: its alpha is how much red and blue exceed green
                al = min(1.0, max(0.05, 1.0 - 1.1 * ((r + b) / 2 - g) / 255))
            elif 0 < depth[y][x] <= 6 and dd < TOL * 1.7:
                al = min(1.0, max(0.06, (dd - TOL * 0.35) / (TOL * 1.2)))
            if al is not None and al < 1.0:
                r = int(min(255, max(0, (r - (1-al) * bg[0]) / al)))
                g = int(min(255, max(0, (g - (1-al) * bg[1]) / al)))
                b = int(min(255, max(0, (b - (1-al) * bg[2]) / al)))
                a = int(255 * al)
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
        im = im.convert("RGB"); w, h = im.size; sq = min(w, h)
        out = im.crop(((w-sq)//2, 0, (w-sq)//2+sq, sq)).resize((96, 96), Image.LANCZOS); q = 85   # a bust keeps its head: crop from the top
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
