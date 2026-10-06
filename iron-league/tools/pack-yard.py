#!/usr/bin/env python3
"""Composite Time Elements chibis into one yard atlas.

Layers come from shared-assets/elements-core (already in the repo) and, when
present, iron-league/tools/yard-src (the few expansion pieces this atlas uses:
an axe, a wand, one hair, one top, and three cultist sheets). The game ships
the atlas, not the layer folders.

    python3 iron-league/tools/pack-yard.py
"""
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
CORE = ROOT / "shared-assets" / "elements-core" / "assets"
EXTRA = ROOT / "iron-league" / "tools" / "yard-src"
OUT_DIR = ROOT / "iron-league" / "assets" / "yard"
FW, FH = 48, 48

# Side-view columns on the 23-wide layer sheet. Rows: 0 south, 1 west, 2 east, 3 north.
CLIPS = [
    ("walkW", 1, [0, 1, 2]),
    ("walkE", 2, [0, 1, 2]),
    ("atkW", 1, [11, 12, 13]),
    ("atkE", 2, [11, 12, 13]),
    ("bowW", 1, [15, 16, 17, 18]),
    ("bowE", 2, [15, 16, 17, 18]),
    ("koW", 1, [22]),
    ("koE", 2, [22]),
]


def find(rel):
    for base in (EXTRA, CORE):
        path = base / rel
        if path.exists():
            return path
    return None


def load(rel):
    path = find(rel)
    if path is None:
        raise SystemExit("missing layer " + rel)
    im = Image.open(path).convert("RGBA")
    if im.size != (1104, 192):
        raise SystemExit(rel + " is " + str(im.size) + ", expected 1104x192")
    return im


def composite(parts):
    sheet = Image.new("RGBA", (1104, 192), (0, 0, 0, 0))
    for rel in parts:
        if not rel:
            continue
        sheet.alpha_composite(load(rel))
    return sheet


def take(sheet, col, row):
    return sheet.crop((col * FW, row * FH, (col + 1) * FW, (row + 1) * FH))


def cultist_cell(path, col, row):
    im = Image.open(path).convert("RGBA")
    cell = im.crop((col * 64, row * 64, (col + 1) * 64, (row + 1) * 64))
    small = cell.resize((32, 32), Image.NEAREST)
    frame = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
    frame.paste(small, (8, 1), small)
    return frame


def main():
    looks = [
        ("sword-0", ["shadow/shadow.png", "bottom/bottom1.png", "top/top1.png", "head/head1.png", "hair/hair1.png"], "weapon/sword1.png", None, None),
        ("sword-1", ["shadow/shadow.png", "bottom/bottom1_c2.png", "top/top1_c2.png", "head/head2.png", "hair/hair1_c2.png"], "weapon/sword1_c2.png", None, None),
        ("spear-0", ["shadow/shadow.png", "bottom/bottom2.png", "top/top2.png", "head/head1.png", "hair/hair10.png"], "weapon/spear1.png", None, None),
        ("spear-1", ["shadow/shadow.png", "bottom/bottom2.png", "top/top2.png", "head/head1_c2.png", "hair/hair10.png"], "weapon/spear1_c2.png", None, None),
        ("axe-0", ["shadow/shadow.png", "bottom/bottom1.png", "top/top14.png", "head/head2.png", "hair/hair13_c3.png"], "weapon/axe1.png", None, None),
        ("axe-1", ["shadow/shadow.png", "bottom/bottom1_c2.png", "top/top1.png", "head/head1.png", "hair/hair1.png"], "weapon/axe1.png", None, None),
        ("bow-0", ["shadow/shadow.png", "bottom/bottom1.png", "top/top1.png", "head/head1.png", "hair/hair10.png"], None, "weapon/bow1arrow1.png", None),
        ("bow-1", ["shadow/shadow.png", "bottom/bottom1_c2.png", "top/top1_c2.png", "head/head2.png", "hair/hair1_c2.png"], None, "weapon/bow1.png", None),
        ("wand-0", ["shadow/shadow.png", "bottom/bottom2.png", "top/top2.png", "head/head1.png", "hair/hair1.png"], "weapon/wand1.png", None, None),
        ("wand-1", ["shadow/shadow.png", "bottom/bottom1.png", "top/top14.png", "head/head1_c2.png", "hair/hair13_c3.png"], "weapon/wand1.png", None, None),
        ("shield-0", ["shadow/shadow.png", "bottom/bottom1.png", "top/top1.png", "head/head2.png", "hair/hair1.png"], "weapon/sword1.png", None, ["weapon/shield1L.png", "weapon/shield1R.png"]),
        ("shield-1", ["shadow/shadow.png", "bottom/bottom1_c2.png", "top/top1_c2.png", "head/head1_c2.png", "hair/hair1_c2.png"], "weapon/sword1_c2.png", None, ["weapon/shield1L.png", "weapon/shield1R.png"]),
    ]
    frames = []
    look_map = {}
    for name, body, weapon, bow, extra in looks:
        melee_parts = list(body)
        if weapon:
            melee_parts.append(weapon)
        if extra:
            melee_parts.extend(extra)
        melee = composite(melee_parts)
        bow_sheet = None
        if bow:
            bow_parts = list(body)
            bow_parts.append(bow)
            if extra:
                bow_parts.extend(extra)
            bow_sheet = composite(bow_parts)
        clips = {}
        for key, row, cols in CLIPS:
            use = bow_sheet if (bow_sheet is not None and key.startswith("bow")) else melee
            ids = []
            for col in cols:
                ids.append(len(frames))
                frames.append(take(use, col, row))
            clips[key] = ids
        look_map[name] = clips

    visitors = {}
    for key, filename in (("cult-a", "e_cultistsA.png"), ("cult-b", "e_cultistsB.png"), ("cult-c", "e_cultistsC.png")):
        path = EXTRA / "premade" / filename
        if not path.exists():
            continue
        clips = {}
        for clip, row in (("walkS", 0), ("walkW", 1), ("walkE", 2), ("walkN", 3)):
            ids = []
            for col in range(3):
                ids.append(len(frames))
                frames.append(cultist_cell(path, col, row))
            clips[clip] = ids
        visitors[key] = clips

    cols = 22
    rows = (len(frames) + cols - 1) // cols
    atlas = Image.new("RGBA", (cols * FW, rows * FH), (0, 0, 0, 0))
    for i, frame in enumerate(frames):
        atlas.paste(frame, ((i % cols) * FW, (i // cols) * FH), frame)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    atlas.save(OUT_DIR / "atlas.png", optimize=True)
    meta = {
        "image": "assets/yard/atlas.png",
        "fw": FW,
        "fh": FH,
        "cols": cols,
        "count": len(frames),
        "looks": look_map,
        "visitors": visitors,
    }
    (OUT_DIR / "atlas.json").write_text(json.dumps(meta, indent=2) + "\n")
    print("yard atlas", atlas.size, "frames", len(frames), "looks", len(look_map), "visitors", len(visitors))


if __name__ == "__main__":
    main()
