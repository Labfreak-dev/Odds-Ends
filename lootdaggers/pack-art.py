#!/usr/bin/env python3
"""Pack lootdaggers/art-src/* into lootdaggers/art.js (window.LD_ART).

    pip install pillow numpy scipy
    python3 lootdaggers/pack-art.py                 # pack art-src/
    python3 lootdaggers/pack-art.py --import a.zip  # add raw PNGs to art-src/, then pack

The key is the filename stem (hero_knight_idle.png -> hero_knight_idle).
Keyed images: the background colour is SAMPLED from each image's border rather
than assumed to be #FF00FF, because the generator drifts from pure magenta to
hot pink or a shadowed plum. Pixels near that colour go transparent,
semi-keyed edges are un-mixed from it, and a pink fringe is pulled out of the
outline. Pieces that aren't connected to the main subject (the stray torches
the generator likes to add in a corner) are dropped unless most of the piece
lies inside the subject's bounding box, then the image is trimmed.
"""
import base64, io, json, os, sys, zipfile
import numpy as np
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'art-src')
OUT = os.path.join(HERE, 'art.js')

# kind by key: (keyed?, target height, max width, webp quality)
def kind(key):
    if key.startswith('death_'):     return ('key', 720, 720, 80)   # Death on his throne (final boss)
    if key.startswith('hero_back_'): return ('key', 560, 560, 82)   # heroes seen from behind (final boss)
    if key == 'ui_defy_button':      return ('key', 480, 1100, 80)
    if key == 'title':               return ('cover', 720, 1280, 78)
    if key == 'bg_wall':             return ('wall', 512, 4096, 76)
    if key == 'bg_floor':            return ('floor', 160, 4096, 76)
    if key.startswith('screen_'):    return ('cover', 720, 1280, 78)
    if key.startswith('bg_wall'):    return ('wall', 512, 4096, 76)
    if key.startswith('bg_floor'):   return ('floor', 160, 4096, 76)
    if key == 'bg_far':              return ('wall', 420, 4096, 72)
    if key == 'bg_fog':              return ('fogkey', 300, 4096, 74)
    if key in ('ui_cabinet', 'ui_panel', 'ui_button', 'ui_spin_button', 'ui_stop_button', 'ui_logo', 'ui_slot_frame', 'ui_ooze_button', 'ui_death_button'):
        return ('key', 480, 1100, 80)
    if key in ('ui_reel_strip', 'ui_lever'): return ('key', 640, 640, 80)
    if key in ('app_icon', 'share_card'): return ('skip', 0, 0, 0)   # served as files, not packed
    if key.startswith('portrait_'):  return ('plain', 480, 480, 80)
    if key.startswith('boss'):       return ('key', 440, 440, 82)
    if key.startswith(('hero_', 'enemy_')): return ('key', 340, 340, 82)
    if key.startswith('sym_'):       return ('key', 200, 200, 84)
    if key.startswith(('relic_', 'gear_', 'slot_', 'altar_', 'mod_', 'intent_',
                       'ui_', 'shop_', 'fx_', 'map_', 'elite_')):
        return ('key', 160, 160, 84)
    if key.startswith('torch_'):     return ('key', 420, 420, 80)   # floor-standing torch bearers
    if key.startswith('shell_dealer'): return ('key', 560, 560, 80)   # shell game: the dealer's poses
    if key.startswith('bj_dealer'):  return ('key', 560, 560, 80)   # blackjack: Rattles' poses
    if key == 'bj_card_back':        return ('plain', 220, 220, 84)
    if key.startswith('shell_'):     return ('key', 360, 360, 84)   # shell game parts: hands, cup, eye
    return ('key', 280, 280, 82)     # props: chest, door, shrine, trap, torch...

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
    if edge.mean() > 0.08:
        hot = (r - g > 90) & (b - g > 45) & (g < 110)
        lab, _ = ndimage.label(hot)
        ids = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
        field = np.isin(lab, ids[ids > 0])
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

def green_glow(img):
    """The ooze button's glow was painted yellow over magenta, so it keys out as a
    peach halo. Near the transparent edge, turn pink/peach pixels into a soft
    green glow instead."""
    a = np.asarray(img).astype(np.float32)
    rgb, al = a[..., :3], a[..., 3]
    solid = al > 250
    far = ndimage.distance_transform_edt(solid)          # distance into the art
    R, G, B = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    halo = (far < 16) & (R - G > 20) & (B > 55) & (R > 120)
    rgb[halo] = [120, 255, 110]
    al[halo] = al[halo] * 0.55
    return Image.fromarray(np.dstack([rgb, al]).clip(0, 255).astype(np.uint8), 'RGBA')

ICONISH = ('shell_', 'death_', 'hero_back_', 'sym_', 'relic_', 'gear_', 'slot_', 'altar_', 'mod_', 'intent_', 'ui_', 'shop_', 'fx_', 'map_', 'elite_')

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

def mirror_tile(img):
    # side-by-side with its own mirror image: tiles seamlessly left-to-right
    w, h = img.size
    t = Image.new(img.mode, (w * 2, h))
    t.paste(img, (0, 0)); t.paste(img.transpose(Image.FLIP_LEFT_RIGHT), (w, 0))
    return t

def process(key, im):
    k, th, mw, q = kind(key)
    scale = None
    if k == 'key' and not key.startswith(ICONISH):
        # world sprites: one fixed scale from the SOURCE canvas, so every pose of a
        # character comes out at the same size however tightly it trims
        sc = th / max(im.size)
        cut = key_out(im)
        img = cut.resize((max(1, round(cut.width * sc)), max(1, round(cut.height * sc))), Image.LANCZOS)
        scale = (sc, max(im.size))
    elif k == 'key':
        cut = key_out(im)
        if key == 'ui_ooze_button': cut = green_glow(cut)
        img = fit(cut, th, mw)
    elif k == 'plain':
        img = fit(im.convert('RGB'), th, mw)
    elif k == 'cover':
        img = cover(im.convert('RGB'), mw, th)
    elif k == 'wall':
        img = mirror_tile(fit(im.convert('RGB'), th, 99999))
    elif k == 'fogkey':
        # the low mist only: bottom band of the canvas, keyed, then greyscale so no
        # pink survives in the semi-transparent wisps; alpha from luminance too
        rgb = im.convert('RGB'); w, h = rgb.size
        cut = key_out(rgb.crop((0, int(h * .80), w, h)))
        g = cut.convert('L'); a = cut.getchannel('A')
        a = Image.eval(a, lambda v: int(v * .85))
        img = Image.merge('RGBA', (g, g, g, a))
        img = mirror_tile(fit(img, th, 99999))
    elif k == 'floor':
        rgb = im.convert('RGB'); w, h = rgb.size
        band = rgb.crop((0, h // 2 - w // 12, w, h // 2 + w // 12))  # a 6:1 strip
        # drop any black border rows the generator left above or below the floor, or the
        # sprites (feet at the strip's top edge) look like they hover over a black ledge
        lum = np.asarray(band.convert('L')).mean(1)
        rows = np.where(lum > 12)[0]
        if len(rows): band = band.crop((0, int(rows[0]), band.width, int(rows[-1]) + 1))
        img = mirror_tile(fit(band, th, 99999))
    buf = io.BytesIO()
    img.save(buf, 'WEBP', quality=q, method=6)
    return img, buf.getvalue(), scale

def import_zip(path):
    os.makedirs(SRC, exist_ok=True)
    with zipfile.ZipFile(path) as z:
        for n in z.namelist():
            if not n.lower().endswith(('.png', '.webp', '.jpg', '.jpeg')) or '__MACOSX' in n: continue
            key = os.path.splitext(os.path.basename(n))[0]
            im = Image.open(io.BytesIO(z.read(n)))
            im.convert('RGB').save(os.path.join(SRC, key + '.webp'), 'WEBP', quality=92, method=6)
            print('imported', key)

def main():
    args = sys.argv[1:]
    while '--import' in args:
        i = args.index('--import'); import_zip(args[i + 1]); del args[i:i + 2]
    files = sorted(f for f in os.listdir(SRC) if f.lower().endswith(('.png', '.webp', '.jpg')))
    art, meta, total = {}, {}, 0
    for f in files:
        key = os.path.splitext(f)[0]
        if kind(key)[0] == 'skip' or key.endswith('_alt'): continue   # _alt: spare takes kept in art-src only
        img, data, scale = process(key, Image.open(os.path.join(SRC, f)))
        if scale: meta[key] = [round(scale[0], 5), scale[1]]
        art[key] = 'data:image/webp;base64,' + base64.b64encode(data).decode()
        total += len(data)
        print(f'{key:26s} {img.width:4d}x{img.height:<4d} {len(data)//1024:4d}KB')
    with open(OUT, 'w') as fh:
        fh.write('// GENERATED by pack-art.py from art-src/ — do not edit by hand.\n')
        fh.write('window.LD_ART = ' + json.dumps(art, separators=(',', ':')).replace('","', '",\n"') + ';\n')
        # [packed px per source px, source canvas size]: lets the game size a
        # sprite relative to the whole generated canvas, not its trimmed box
        fh.write('window.LD_ART_META = ' + json.dumps(meta, separators=(',', ':')) + ';\n')
    print(f'{len(art)} images, {total/1024/1024:.2f}MB -> art.js')

if __name__ == '__main__':
    main()
