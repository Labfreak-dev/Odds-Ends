#!/usr/bin/env python3
"""Gravemark - tools/art-install.py

Installs a delivered art pack into art/, but ONLY the files that are actually
painted. Filler is deliberately left out: a placeholder that exists on disk
loads successfully, and the renderer then composites it (45 doll layers of
captioned boxes over the hero). A file that is ABSENT falls back to the game's
own procedural placeholder, which is the behaviour we want.

Also repairs broken mattes. Deliveries frequently arrive pasted on a light
card instead of cut out; on a dark backdrop that reads as a bright rectangle.
Where the border is near-uniform we flood-fill it to transparent from the
edges inward, which removes the card without eating into the figure.

    python3 tools/art-install.py <src-art-dir> [--dest art] [--dry-run]
"""
import os, sys, json, argparse, subprocess, shutil
from collections import deque
from PIL import Image, ImageStat, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))

def manifest(path=None):
    if path and os.path.exists(path):
        return json.load(open(path))
    out = subprocess.run(["node", os.path.join(HERE, "art-manifest.js")],
                         capture_output=True, text=True, check=True)
    return json.loads(out.stdout)

def is_painted(img, spec):
    w, h = img.size
    frames = spec.get("frames") or 1
    fw = max(1, w // frames)
    frame = img.crop((0, 0, fw, h)).convert("RGBA")
    bg = Image.new("RGBA", frame.size, (128, 128, 128, 255))
    flat = Image.alpha_composite(bg, frame).convert("RGB")
    cols = flat.getcolors(maxcolors=200000)
    ncol = len(cols) if cols else 200000
    var = sum(ImageStat.Stat(flat).stddev) / 3.0
    return ncol > 900 and var > 16

def strip_matte(frame, tol=34, flat_thresh=52.0, min_share=0.62):
    """Remove a background card and return (frame, changed).

    Colour alone cannot separate a flat card from a pale figure - that is how
    a grey-green shambler gets eaten by a grey card's fill. So a pixel is only
    cleared when it is BOTH near the card colour AND locally flat. Cards are
    smooth; painted figures are textured, so the texture gate protects them.

    Cards arrive two ways: filling the frame, or as a rectangle inside a
    transparent margin. Flooding from the edge through transparency handles
    both.
    """
    frame = frame.convert("RGBA")
    w, h = frame.size
    px = frame.load()

    # local edge energy: flat card ~0, painted figure high
    grey = frame.convert("L")
    edges = grey.filter(ImageFilter.FIND_EDGES).filter(ImageFilter.MaxFilter(3))
    epx = edges.load()

    def flood(match):
        seen = bytearray(w * h)
        dq = deque()
        for x in range(w):
            dq.append((x, 0)); dq.append((x, h - 1))
        for y in range(h):
            dq.append((0, y)); dq.append((w - 1, y))
        cleared, contacts = 0, []
        while dq:
            x, y = dq.popleft()
            if x < 0 or y < 0 or x >= w or y >= h:
                continue
            i = y * w + x
            if seen[i]:
                continue
            seen[i] = 1
            p = px[x, y]
            if p[3] == 0:
                dq.extend(((x+1,y),(x-1,y),(x,y+1),(x,y-1)))
                continue
            contacts.append(p)
            if match is None or not match(x, y, p):
                continue
            px[x, y] = (p[0], p[1], p[2], 0)
            cleared += 1
            dq.extend(((x+1,y),(x-1,y),(x,y+1),(x,y-1)))
        return cleared, contacts

    # --- detect a card -----------------------------------------------------
    # Sampling what the flood first touches is the wrong signal: figures that
    # throw speckles to the frame edge (a mourner, a frost wraith) drown the
    # card colour in their own outline. The bounding box of opaque pixels is
    # the card's own rectangle, so its PERIMETER is almost pure card - while a
    # properly cut-out sprite has a perimeter that is mostly transparent.
    # Alpha channel only: transparent pixels often retain stale RGB, and an
    # RGBA getbbox() counts those, inflating the box to the whole frame.
    bbox = frame.getchannel("A").getbbox()
    if not bbox:
        return frame, False
    x0, y0, x1, y1 = bbox
    if (x1 - x0) < w * 0.25 or (y1 - y0) < h * 0.25:
        return frame, False

    ring = []
    step = max(1, (x1 - x0) // 64)
    for x in range(x0, x1, step):
        ring.append(px[x, y0]); ring.append(px[x, y1 - 1])
    step = max(1, (y1 - y0) // 64)
    for y in range(y0, y1, step):
        ring.append(px[x0, y]); ring.append(px[x1 - 1, y])

    opaque_ring = [p for p in ring if p[3] > 200]
    if len(opaque_ring) < len(ring) * 0.55:
        return frame, False          # perimeter mostly transparent => already cut out

    buckets = {}
    for p in opaque_ring:
        k = (p[0] // 16, p[1] // 16, p[2] // 16)
        buckets[k] = buckets.get(k, 0) + 1
    best = max(buckets, key=buckets.get)
    if buckets[best] / len(opaque_ring) < min_share:
        return frame, False          # perimeter is varied => not a flat card

    members = [p for p in opaque_ring
               if (p[0] // 16, p[1] // 16, p[2] // 16) == best]
    ref = (sum(p[0] for p in members) / len(members),
           sum(p[1] for p in members) / len(members),
           sum(p[2] for p in members) / len(members))

    # Sample the card's own colour from just inside the bbox corners. The
    # figure is centred, so the corners are card. The bbox PERIMETER is a hard
    # edge (it is the card's boundary), which is exactly why a flood seeded at
    # the frame border can never get in: the flatness gate rejects the boundary
    # itself. Seeding inside the card sidesteps that entirely.
    inset = max(2, min((x1 - x0), (y1 - y0)) // 20)
    seeds = [(x0 + inset, y0 + inset), (x1 - 1 - inset, y0 + inset),
             (x0 + inset, y1 - 1 - inset), (x1 - 1 - inset, y1 - 1 - inset)]
    corner = [px[sx, sy] for sx, sy in seeds if px[sx, sy][3] > 200]
    if not corner:
        return frame, False
    ref = (sum(p[0] for p in corner) / len(corner),
           sum(p[1] for p in corner) / len(corner),
           sum(p[2] for p in corner) / len(corner))
    # Card must be materially lighter than the dark ground the game paints, or
    # there is nothing worth cutting out.
    if sum(ref) / 3 < 90:
        return frame, False

    def near(p):
        return (abs(p[0]-ref[0]) <= tol and abs(p[1]-ref[1]) <= tol
                and abs(p[2]-ref[2]) <= tol)

    # Region-grow from the card's interior corners. Colour only: the figure is
    # what stops it, and detection has already proved a card is present.
    seen = bytearray(w * h)
    dq = deque(seeds)
    cleared = 0
    while dq:
        x, y = dq.popleft()
        if x < x0 or y < y0 or x >= x1 or y >= y1:
            continue
        i = y * w + x
        if seen[i]:
            continue
        seen[i] = 1
        p = px[x, y]
        if p[3] == 0:
            dq.extend(((x+1,y),(x-1,y),(x,y+1),(x,y-1)))
            continue
        if not near(p):
            continue
        px[x, y] = (p[0], p[1], p[2], 0)
        cleared += 1
        dq.extend(((x+1,y),(x-1,y),(x,y+1),(x,y-1)))

    # Enclosed islands: card pixels ringed by the figure (between a dog's legs,
    # inside a cloak's fold) are unreachable from the corner seeds. Sweep the
    # bbox for anything still matching the card colour AND locally flat. The
    # flatness gate is what keeps this from biting into painted detail.
    if cleared:
        for y in range(y0, y1):
            for x in range(x0, x1):
                p = px[x, y]
                if p[3] == 0 or not near(p):
                    continue
                if epx[x, y] < flat_thresh:
                    px[x, y] = (p[0], p[1], p[2], 0)
                    cleared += 1

    return frame, cleared > (w * h * 0.01)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("--dest", default=os.path.join(HERE, "..", "art"))
    ap.add_argument("--manifest", default=None)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--exclude", action="append", default=[],
                    metavar="PREFIX",
                    help="skip keys starting with this prefix (repeatable)")
    a = ap.parse_args()

    specs = manifest(a.manifest)
    installed, skipped, matted, problems, collapsed = [], [], [], [], []
    excluded, wrong_size = [], []

    for spec in specs:
        key = spec["key"]
        if any(key.startswith(pre) for pre in a.exclude):
            excluded.append(key)
            continue
        src = os.path.join(a.src, key + ".png")
        if not os.path.exists(src):
            continue
        try:
            img = Image.open(src); img.load()
        except Exception as e:
            problems.append((key, str(e))); continue

        if not is_painted(img, spec):
            skipped.append(key)
            continue

        # Refuse anything that is not a whole strip of the spec's cell size.
        # A wrong-sized asset is worse than a missing one: it installs quietly
        # and only breaks when that key is eventually wired into the UI.
        iw, ih = img.size
        cells = max(1, round(iw / spec["w"]))
        if ih != spec["h"] or iw != spec["w"] * cells or cells > (spec.get("frames") or 1):
            wrong_size.append((key, "%dx%d vs %dx%d cells"
                               % (iw, ih, spec["w"], spec["h"])))
            continue

        frames = spec.get("frames") or 1
        img = img.convert("RGBA")
        w, h = img.size
        fw = max(1, w // frames)

        # repair each frame's matte independently
        out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        did = False
        for i in range(frames):
            fr = img.crop((i * fw, 0, (i + 1) * fw, h))
            if not key.startswith("bg/"):
                fr, changed = strip_matte(fr)
                did = did or changed
            out.paste(fr, (i * fw, 0))
        if did:
            matted.append(key)

        # Collapse a sheet whose frames are all identical to a single frame.
        # The renderer derives frame count from the image width, so this plays
        # exactly the same while shipping a fraction of the bytes.
        if frames > 1:
            f0 = out.crop((0, 0, fw, h)).tobytes()
            if all(out.crop((i * fw, 0, (i + 1) * fw, h)).tobytes() == f0
                   for i in range(1, frames)):
                out = out.crop((0, 0, fw, h))
                collapsed.append(key)

        # Backdrops have no alpha; as JPEG they are roughly a tenth the size,
        # which matters when there are eighteen 1280x720 paintings.
        if key.startswith("bg/"):
            out = out.convert("RGB")
            dst = os.path.join(a.dest, key + ".jpg")
            if not a.dry_run:
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                out.save(dst, "JPEG", quality=84, optimize=True, progressive=True)
            installed.append(key)
            continue

        dst = os.path.join(a.dest, key + ".png")
        if not a.dry_run:
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            out.save(dst, optimize=True)
        installed.append(key)

    # An index of what exists, so the game never requests art that is not
    # there. Without it every missing key costs a 404 per page load - 182 of
    # them here - and fills the console for players.
    if not a.dry_run and installed:
        os.makedirs(a.dest, exist_ok=True)
        with open(os.path.join(a.dest, "available.json"), "w") as fh:
            json.dump(sorted(installed), fh)

    print("=" * 64)
    print(f"installed (painted) : {len(installed)}")
    print(f"skipped (filler)    : {len(skipped)}")
    print(f"mattes repaired     : {len(matted)}")
    print(f"static sheets collapsed to 1 frame : {len(collapsed)}")
    if excluded:
        print(f"excluded by request  : {len(excluded)}")
    if wrong_size:
        print(f"refused, wrong size  : {len(wrong_size)}")
        for k, why in wrong_size:
            print(f"  - {k}: {why}")
    if problems:
        print(f"unreadable          : {len(problems)}")
    if matted:
        print("\nrepaired:")
        for k in matted:
            print("  - " + k)
    cats = {}
    for k in installed:
        cats.setdefault(k.split("/")[0], []).append(k)
    print("\ninstalled by category:")
    for c in sorted(cats):
        print(f"  {c:8} {len(cats[c]):>3}")
    if a.dry_run:
        print("\n(dry run - nothing written)")
    return 0

if __name__ == "__main__":
    sys.exit(main())
