#!/usr/bin/env python3
"""Gravemark - tools/art-check.py

Validates a delivered art/ tree against the asset manifest: every key present,
correct pixel dimensions, sprite sheets an exact frame-strip width, alpha where
it is required. Also classifies each file as PAINTED or PLACEHOLDER so a
delivery that is mostly filler cannot be mistaken for a finished pack.

    node tools/art-manifest.js > /tmp/manifest.json
    python3 tools/art-check.py <art-dir> [--manifest /tmp/manifest.json]
"""
import sys, os, json, subprocess, argparse
from PIL import Image, ImageStat

HERE = os.path.dirname(os.path.abspath(__file__))

def manifest(path=None):
    if path and os.path.exists(path):
        return json.load(open(path))
    out = subprocess.run(["node", os.path.join(HERE, "art-manifest.js")],
                         capture_output=True, text=True, check=True)
    return json.loads(out.stdout)

def actual_frames(img, spec):
    """Frame count as the RENDERER computes it: from the image's own width.
    A static sheet collapsed to one frame is legal and plays identically."""
    return max(1, round(img.size[0] / spec["w"])) if spec.get("w") else 1

def classify(img, spec):
    """PAINTED vs PLACEHOLDER.

    A placeholder is flat: few distinct colours and low variance once the
    caption is ignored. Painted art has broad tonal range. Measured on the
    first frame only, so a sheet is judged on its art rather than its repeats.
    """
    w, h = img.size
    frames = actual_frames(img, spec)
    fw = max(1, w // frames)
    frame = img.crop((0, 0, fw, h)).convert("RGBA")

    # composite onto mid grey so transparency does not read as flat colour
    bg = Image.new("RGBA", frame.size, (128, 128, 128, 255))
    flat = Image.alpha_composite(bg, frame).convert("RGB")

    colours = flat.getcolors(maxcolors=200000)
    ncol = len(colours) if colours else 200000
    stat = ImageStat.Stat(flat)
    var = sum(stat.stddev) / 3.0
    real = (ncol > 900 and var > 16) or (ncol > 6 and var > 8 and silhouette(frame))
    return ("PAINTED" if real else "PLACEHOLDER"), ncol, var

def silhouette(frame):
    """A cut-out with real transparency around it is art even when flat-shaded."""
    bb = frame.getchannel("A").getbbox()
    return bool(bb) and (bb[2] - bb[0] < frame.size[0] * 0.9 or bb[3] - bb[1] < frame.size[1] * 0.9)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("artdir")
    ap.add_argument("--manifest", default=None)
    ap.add_argument("--verbose", action="store_true")
    ap.add_argument("--remaining", metavar="FILE",
                    help="write a ready-to-send list of the art still needed")
    a = ap.parse_args()

    spec_list = manifest(a.manifest)
    problems, painted, placeholder, missing = [], [], [], []
    static_sheets, animated_sheets = [], []

    for spec in spec_list:
        key = spec["key"]
        # A SOURCE pack delivers everything as .png; the INSTALLED tree has
        # backdrops converted to .jpg. Accept either so one checker serves both.
        path = None
        for ext in (".png", ".jpg"):
            cand = os.path.join(a.artdir, key + ext)
            if os.path.exists(cand):
                path = cand
                break
        if path is None:
            missing.append(key)
            continue
        try:
            img = Image.open(path)
            img.load()
        except Exception as e:
            problems.append((key, "unreadable: %s" % e))
            continue

        w, h = img.size
        declared = spec.get("frames") or 1
        frames = actual_frames(img, spec)

        # Width must be a whole number of frame cells, and no more cells than
        # the spec asks for. Fewer is allowed: a sheet whose frames were all
        # identical is collapsed to one on install.
        if h != spec["h"] or w != spec["w"] * frames:
            problems.append((key, "size %dx%d is not a whole strip of %dx%d cells"
                             % (w, h, spec["w"], spec["h"])))
        elif frames > declared:
            problems.append((key, "%d frames, spec allows at most %d" % (frames, declared)))

        needs_alpha = not key.startswith("bg/") and not path.endswith(".jpg")
        if needs_alpha and img.mode not in ("RGBA", "LA", "P"):
            problems.append((key, "no alpha channel (mode %s)" % img.mode))

        # A sheet whose frames are all identical is a still image wearing an
        # animation's clothes: it loads and plays, but nothing moves. Worth
        # knowing, because it is invisible in a static screenshot.
        if frames > 1:
            rgba = img.convert("RGBA")
            f0 = rgba.crop((0, 0, spec["w"], h)).tobytes()
            if all(rgba.crop((i * spec["w"], 0, (i + 1) * spec["w"], h)).tobytes() == f0
                   for i in range(1, frames)):
                static_sheets.append(key)
            else:
                animated_sheets.append(key)

        kind, ncol, var = classify(img, spec)
        (painted if kind == "PAINTED" else placeholder).append(key)
        if a.verbose:
            print(f"  {kind:11} {key:44} {ncol:>7} colours  sd {var:5.1f}")

    total = len(spec_list)
    print("\n" + "=" * 66)
    print(f"manifest keys      : {total}")
    print(f"files present      : {total - len(missing)}")
    print(f"missing            : {len(missing)}")
    print(f"spec problems      : {len(problems)}")
    print(f"painted            : {len(painted)}  ({100*len(painted)//max(1,total)}%)")
    print(f"placeholder        : {len(placeholder)}  ({100*len(placeholder)//max(1,total)}%)")
    nsheets = len(static_sheets) + len(animated_sheets)
    if nsheets:
        print(f"sheets animated    : {len(animated_sheets)} / {nsheets}")
        print(f"sheets STATIC      : {len(static_sheets)}  (every frame identical - will not move)")

    if missing:
        print("\nMISSING:")
        for k in missing[:20]:
            print("  - " + k)
    if problems:
        print("\nSPEC PROBLEMS:")
        for k, why in problems[:30]:
            print(f"  - {k}: {why}")
        if len(problems) > 30:
            print(f"  ... and {len(problems)-30} more")

    # placeholder breakdown by category, so it is obvious what still needs art
    if placeholder:
        cats = {}
        for k in placeholder:
            cats.setdefault(k.split("/")[0], []).append(k)
        print("\nSTILL PLACEHOLDER, by category:")
        for c in sorted(cats, key=lambda c: -len(cats[c])):
            print(f"  {c:8} {len(cats[c]):>3}")

    if static_sheets:
        cats = {}
        for k in static_sheets:
            cats.setdefault(k.split("/")[0], []).append(k)
        print("\nSTATIC SHEETS, by category:")
        for c in sorted(cats, key=lambda c: -len(cats[c])):
            print(f"  {c:8} {len(cats[c]):>3}")

    if a.remaining:
        by = {}
        for k in missing + placeholder:
            if k.startswith("parts/"):
                continue          # the rig parts have their own brief
            by.setdefault(k.split("/")[0], []).append(k)
        spec_by = {s["key"]: s for s in spec_list}
        lines = ["# Gravemark — art still needed", "",
                 "_Generated by `tools/art-check.py --remaining`. "
                 "Everything below is either absent or still a placeholder; "
                 "the game draws its own procedural stand-in for each._", "",
                 f"**{sum(len(v) for v in by.values())} of {total} assets outstanding.**", ""]
        LABEL = {"doll": "Paper-doll gear layers — the biggest gap",
                 "boss": "Bosses", "item": "Item icons", "icon": "UI icons",
                 "rune": "Rune glyphs", "ui": "UI chrome", "mon": "Monsters",
                 "frame": "Rarity frames and sockets", "bg": "Backdrops",
                 "actor": "Hero and revenant"}
        for c in sorted(by, key=lambda c: -len(by[c])):
            lines.append(f"## {LABEL.get(c, c)}  ({len(by[c])})")
            lines.append("")
            lines.append("| key | size | frames |")
            lines.append("|---|---|---|")
            for k in sorted(by[c]):
                sp = spec_by[k]
                fr = sp.get("frames") or 1
                lines.append(f"| `{k}` | {sp['w']}×{sp['h']} | {fr if fr > 1 else '—'} |")
            lines.append("")
        open(a.remaining, "w").write("\n".join(lines))
        print(f"\nwrote {a.remaining}")

    return 1 if problems else 0

if __name__ == "__main__":
    sys.exit(main())
