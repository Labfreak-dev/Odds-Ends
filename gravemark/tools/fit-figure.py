#!/usr/bin/env python3
"""Fit delivered character paintings onto their manifest canvases.

A generator paints a figure at whatever aspect it likes (784x1168 portraits,
this delivery). The game wants a fixed canvas per key: 256x256 for actors and
monsters, 384x320 for bosses, feet resting near the bottom. This keys out the
magenta, crops to the figure, scales it to fit the canvas with its feet at
`--feet` of the height, and mirrors any file listed in --mirror so that every
hero faces RIGHT and every monster faces LEFT in the file itself.

    python3 tools/fit-figure.py <delivery-dir> --out /tmp/stage --mirror chill,vigilant
    python3 tools/art-install.py /tmp/stage

Files are mapped by name: look-<class>.png -> actor/look-<class>,
<mon>-idle.png -> mon/<mon>-idle, b_<boss>-idle.png -> boss/b_<boss>-idle.
"""
import os, sys, json, argparse, subprocess, importlib.util
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("ai", os.path.join(HERE, "art-install.py"))
ai = importlib.util.module_from_spec(spec); spec.loader.exec_module(ai)

def manifest():
    out = subprocess.run(["node", os.path.join(HERE, "art-manifest.js")], capture_output=True, text=True, check=True)
    return {s["key"]: s for s in json.loads(out.stdout)}

def key_for(name):
    base = os.path.splitext(os.path.basename(name))[0]
    if base.startswith("look-"): return "actor/" + base
    if base.startswith("b_"): return "boss/" + base
    if base.startswith("revenant"): return "actor/" + base
    return "mon/" + base

def fit(img, w, h, feet):
    img = img.convert("RGBA")
    img, _ = ai.strip_matte(img)
    bb = img.getchannel("A").getbbox()
    if bb: img = img.crop(bb)
    avail_h = h * feet - 2
    avail_w = w - 4
    s = min(avail_w / img.size[0], avail_h / img.size[1])
    nw, nh = max(1, round(img.size[0] * s)), max(1, round(img.size[1] * s))
    img = img.resize((nw, nh), Image.LANCZOS)
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    out.paste(img, ((w - nw) // 2, round(h * feet) - nh), img)
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("--out", required=True)
    ap.add_argument("--feet", type=float, default=0.96)
    ap.add_argument("--mirror", default="", help="comma list of basenames (without -idle/.png) to flip horizontally")
    a = ap.parse_args()
    specs = manifest()
    mirror = set(x.strip() for x in a.mirror.split(",") if x.strip())
    n = 0
    for f in sorted(os.listdir(a.src)):
        if not f.lower().endswith(".png"): continue
        key = key_for(f)
        sp = specs.get(key)
        if not sp: print("  no manifest key for", f, "->", key); continue
        img = Image.open(os.path.join(a.src, f))
        base = os.path.splitext(f)[0].replace("-idle", "")
        if base in mirror: img = img.transpose(Image.FLIP_LEFT_RIGHT)
        out = fit(img, sp["w"], sp["h"], a.feet)
        dst = os.path.join(a.out, key + ".png")
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        out.save(dst, optimize=True); n += 1
        print(f"  {key:28s} {sp['w']}x{sp['h']}" + ("  mirrored" if base in mirror else ""))
    print(f"fitted {n}; install with: python3 tools/art-install.py {a.out}")

if __name__ == "__main__":
    main()
