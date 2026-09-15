#!/usr/bin/env python3
"""Gravemark - tools/make-sheet.py

Stitches separately-delivered frames into the horizontal strip the game wants.

This exists because image generators produce ONE image per prompt and cannot
lay out a sprite strip. Asking for "an 8-frame walk cycle sheet" has come back
as the same pose copied eight times, every time, across eight deliveries. Ask
instead for numbered single frames -- hero-attack-sword-1.png, -2, -3 -- and
this assembles them.

The renderer derives frame count from the image's own width, so a 3-frame strip
is completely valid art. Three key poses beats eight identical ones.

    python3 tools/make-sheet.py <src-dir> [--dest art] [--dry-run]

Frames are grouped by the key before the trailing -<n>, ordered by that number,
matted (magenta keyed out) and written to <dest>/<key>.png.
"""
import os, re, sys, argparse
from collections import defaultdict
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
FRAME_RE = re.compile(r"^(?P<key>.+?)[-_](?P<n>\d+)$")

def load_strip_parts(src):
    """key -> [(index, path)] for every <name>-<n>.png under src."""
    groups = defaultdict(list)
    for root, _, files in os.walk(src):
        for f in files:
            if not f.lower().endswith(".png"):
                continue
            stem = os.path.splitext(f)[0]
            m = FRAME_RE.match(stem)
            if not m:
                continue
            rel = os.path.relpath(root, src)
            key = m.group("key") if rel in (".", "") else os.path.join(rel, m.group("key"))
            groups[key.replace(os.sep, "/")].append((int(m.group("n")), os.path.join(root, f)))
    for k in groups:
        groups[k].sort(key=lambda t: t[0])
    return groups

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("--dest", default=os.path.join(HERE, "..", "art"))
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    # reuse the installer's matte repair so keyed backgrounds are handled
    import importlib.util
    spec = importlib.util.spec_from_file_location("ai", os.path.join(HERE, "art-install.py"))
    ai = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(ai)

    groups = load_strip_parts(a.src)
    if not groups:
        print("no numbered frames found under " + a.src)
        print("expected files like  actor/hero-attack-sword-1.png  ...-2.png  ...-3.png")
        return 1

    made = 0
    for key, parts in sorted(groups.items()):
        frames = []
        for _, path in parts:
            im = Image.open(path).convert("RGBA")
            im, _changed = ai.strip_matte(im)
            frames.append(im)

        # every cell must be the same size; the first frame sets it
        w, h = frames[0].size
        frames = [f if f.size == (w, h) else f.resize((w, h)) for f in frames]

        strip = Image.new("RGBA", (w * len(frames), h), (0, 0, 0, 0))
        for i, f in enumerate(frames):
            strip.paste(f, (i * w, 0))

        dst = os.path.join(a.dest, key + ".png")
        print(f"  {key}: {len(frames)} frames -> {w * len(frames)}x{h}")
        if not a.dry_run:
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            strip.save(dst, optimize=True)
        made += 1

    print(f"\n{made} sheet(s) " + ("planned" if a.dry_run else "written"))
    print("Re-run tools/art-check.py to confirm they match the manifest.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
