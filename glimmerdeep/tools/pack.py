#!/usr/bin/env python3
"""Pack glimmerdeep/art-src/*.webp (raw Meshy renders) into glimmerdeep/img/*.webp.

    pip install pillow numpy scipy
    python3 glimmerdeep/tools/pack.py           # everything
    python3 glimmerdeep/tools/pack.py cr_cind1  # just these keys

Sprites are keyed off the magenta background (key_out is the same keyer
Dead Man's Pull uses: border-sampled key colour, un-mixed edges, pink spill
pulled out of the outline, stray pieces dropped), trimmed and fitted.
Backgrounds are cover-cropped to 1280x720.
"""
import os, sys
import numpy as np
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'art-src')
OUT = os.path.join(HERE, '..', 'img')

def kind(key):
    if key.startswith('bg_'): return ('cover', 720, 1280, 76)
    if key.startswith('boss_'): return ('key', 560, 560, 82)
    if key.startswith('cr_'): return ('key', 400, 400, 82)
    if key.startswith('el_'): return ('key', 96, 96, 86)
    return ('key', 128, 128, 84)

def border_colour(a):
    h, w, _ = a.shape
    b = np.concatenate([a[:6].reshape(-1, 3), a[-6:].reshape(-1, 3),
                        a[:, :6].reshape(-1, 3), a[:, -6:].reshape(-1, 3)])
    return np.median(b, axis=0)

def key_out(im):
    a = np.asarray(im.convert('RGB')).astype(np.float32)
    bg = border_colour(a)
    d = np.sqrt(((a - bg) ** 2).sum(-1))
    # the key colour is always in the magenta/pink family: g far below r and b
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    pinkish = (r - g > 60) & (b - g > 25)
    t0, t1 = 38.0, 105.0
    alpha = np.clip((d - t0) / (t1 - t0), 0, 1)
    alpha = np.where(pinkish | (d < t0), alpha, 1.0)
    # Some generators paint a thin pure-magenta frame around a darker hot-pink field,
    # so the sampled border colour is a blend of the two and the field survives. If
    # the edges are still mostly opaque, key out every saturated pink pixel that is
    # connected to the edge instead (pink inside the subject is left alone).
    edge = np.concatenate([alpha[:4].ravel(), alpha[-4:].ravel(), alpha[:, :4].ravel(), alpha[:, -4:].ravel()])
    hot = (r - g > 90) & (b - g > 45) & (g < 110)
    lab, _ = ndimage.label(hot)
    ids = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    field = np.isin(lab, ids[ids > 0])
    # a thin pure frame can key cleanly at the very edge while a big hot-pink field
    # inside it survives (art pack 23): also fall back when that edge-connected pink
    # field is still largely opaque
    survived = field.any() and (alpha[field] > 0.2).mean() > 0.2
    if edge.mean() > 0.08 or survived:
        field = ndimage.binary_dilation(field, iterations=1) & (hot | field)
        bg = np.median(a[field], axis=0) if field.any() else bg
        d = np.sqrt(((a - bg) ** 2).sum(-1))
        alpha = np.where(field, 0.0, np.clip((d - t0) / (t1 - t0), 0, 1))
        alpha = np.where(pinkish | field, alpha, 1.0)
    # un-mix semi-transparent edge pixels from the background colour
    am = np.maximum(alpha, 1e-3)[..., None]
    rgb = np.clip((a - (1 - am) * bg) / am, 0, 255)
    # pull pink spill out of the outline band
    solid = alpha > 0.5
    band = solid & ~ndimage.binary_erosion(solid, iterations=4)
    R, G, B = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    spill = band & (R - G > 30) & (B - G > 30)
    rgb[..., 2] = np.where(spill, G + (B - G) * 0.25, B)
    rgb[..., 0] = np.where(spill, G + (R - G) * 0.6, R)
    # keep the main subject and anything touching its box; drop stray pieces
    lab, n = ndimage.label(alpha > 0.35)
    if n > 1:
        sizes = ndimage.sum(np.ones_like(alpha), lab, range(1, n + 1))
        main = int(np.argmax(sizes)) + 1
        ys, xs = np.where(lab == main)
        y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
        keep = np.zeros(n + 1, bool); keep[main] = True
        for i, sl in enumerate(ndimage.find_objects(lab), start=1):
            if i == main or sl is None or sizes[i - 1] <= 30: continue
            sy, sx = sl
            # the share of this piece's own box that lies inside the subject's box
            iy = max(0, min(sy.stop, y1 + 1) - max(sy.start, y0))
            ix = max(0, min(sx.stop, x1 + 1) - max(sx.start, x0))
            share = iy * ix / ((sy.stop - sy.start) * (sx.stop - sx.start))
            if share >= 0.6: keep[i] = True
        mask = keep[lab]
        # soft edge pixels next to a kept piece stay
        mask = ndimage.binary_dilation(mask, iterations=2)
        alpha = np.where(mask, alpha, 0)
    out = np.dstack([rgb, alpha * 255]).astype(np.uint8)
    img = Image.fromarray(out, 'RGBA')
    bb = img.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    return img.crop(bb) if bb else img


def fit(img, th, mw):
    w, h = img.size
    s = min(th / h, mw / w, 1.0)
    return img.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)

def cover(img, tw, th):
    w, h = img.size
    s = max(tw / w, th / h)
    img = img.resize((round(w * s), round(h * s)), Image.LANCZOS)
    x, y = (img.width - tw) // 2, (img.height - th) // 2
    return img.crop((x, y, x + tw, y + th))

def process(key):
    k, th, mw, q = kind(key)
    im = Image.open(os.path.join(SRC, key + '.webp'))
    img = cover(im.convert('RGB'), mw, th) if k == 'cover' else fit(key_out(im), th, mw)
    img.save(os.path.join(OUT, key + '.webp'), 'WEBP', quality=q, method=6)
    return img.size

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    keys = sys.argv[1:] or sorted(f[:-5] for f in os.listdir(SRC) if f.endswith('.webp') and not f.startswith('_'))
    tot = 0
    for k in keys:
        sz = process(k); tot += os.path.getsize(os.path.join(OUT, k + '.webp'))
        print(k, sz)
    print(len(keys), 'images,', tot // 1024, 'KB')
