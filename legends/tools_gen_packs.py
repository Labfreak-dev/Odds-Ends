#!/usr/bin/env python3
"""Builds the Card Shop's pack-opening assets from the Odds & Ends workshop.

    python3 legends/tools_gen_packs.py

Reads the Rip & Ship foil, sigils and card back out of
workshop/ripship.module.js and the collect_* sounds out of
workshop/sfx-pack.module.js, then writes:

  legends/img/pack_<id>.webp   one foil per shop pack, the two expansion packs included (472x756, 2x the 236x378 tear stage)
  legends/img/sigil_<tier><n>.webp   the reveal blooms
  legends/sfx/pk_*.mp3          tear, flip, reveal-all and one sting per rarity

The Odds & Ends pack wears the real Rip & Ship foil. Every other pack keeps that
foil's crimped ends, recoloured to the pack, around a Legends face: the pack's
cover art in a medallion, the logo and the pack name.
"""
import base64, io, json, os, re, sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEG = os.path.join(ROOT, 'legends')
W, H = 472, 756
FONT = '/usr/share/fonts/truetype/google-fonts/Poppins-Bold.ttf'

PACKS = [  # id, name on the foil, rgb, cover card id (matches PACKS in js/ui.js)
    ('ih', 'SIEGE OF IRONHOLD', (225, 95, 70), 'ihn_ashking'),
    ('dc', 'THE DEEP CATCH', (40, 150, 220), 'dcl_drownedking'),
    ('pt', 'RISE OF THE PANTHEON', (255, 200, 90), 'pt_zeus_sky_father'),
    ('tt', 'TRICKS OF THE TRADE', (255, 140, 230), 'tt_kaleidoscope'),
    ('glim', 'GLIMMERDEEP', (90, 200, 255), 'gd_emdr4'),
    ('dmp', "DEAD MAN'S PULL", (150, 200, 90), 'dmpb_death3'),
    ('th', 'THANKLESS', (240, 190, 90), 'th_kingc'),
    ('oe', None, (60, 210, 190), None),
    ('lab', 'LABFREAK LAB', (255, 110, 225), 's2_200'),
    ('mv', 'MULTIVERSE', (255, 215, 90), 'mv_labfreak'),
]


def b64img(s):
    return Image.open(io.BytesIO(base64.b64decode(s.split(',', 1)[1])))


def main():
    rs = open(os.path.join(ROOT, 'workshop', 'ripship.module.js')).read()
    foil = b64img(re.search(r'const RZ_PACK_IMG = "([^"]+)"', rs).group(1)).convert('RGBA')
    sig = json.loads(re.search(r'const RZ_SIGILS = (\{.*?\});', rs).group(1))
    for tier, arr in sig.items():
        for n, s in enumerate(arr):
            b64img(s).save(os.path.join(LEG, 'img', f'sigil_{tier}{n}.webp'), lossless=True)

    # the six Rip & Ship card backs, worn as cosmetics in Legends (img/back_<id>.webp, 240 px wide)
    backs = [('cream', re.search(r'const RZ_CARDBACK = "([^"]+)"', rs).group(1))]
    blk = rs[rs.index('const RZ_BACKS = ['):]
    backs += re.findall(r'\{ id:"(\w+)",\s*name:"[^"]*",\s*need:"[^"]*",\s*img:"(data:[^"]+)"', blk[:blk.index('];')])
    for bid, s in backs:
        im = b64img(s).convert('RGBA')
        im.resize((240, round(240 * im.height / im.width)), Image.LANCZOS).save(os.path.join(LEG, 'img', f'back_{bid}.webp'), quality=86)

    sp = open(os.path.join(ROOT, 'workshop', 'sfx-pack.module.js')).read()
    for key, out in [('collect_pack_tear', 'pk_tear'), ('collect_card_flip', 'pk_flip'),
                     ('collect_reveal_all', 'pk_all'), ('collect_common', 'pk_r0'),
                     ('collect_rare', 'pk_r1'), ('collect_epic', 'pk_r2'),
                     ('collect_legendary', 'pk_r3'), ('collect_new_card', 'pk_new')]:
        m = re.search(r'"%s"\s*:\s*"data:audio/mpeg;base64,([^"]+)"' % key, sp)
        open(os.path.join(LEG, 'sfx', out + '.mp3'), 'wb').write(base64.b64decode(m.group(1)))

    data = open(os.path.join(LEG, 'data', 'cards.js')).read()
    data = json.loads(data[data.index('{'):data.rstrip().rstrip(';').rindex('}') + 1])
    byid = {c['id']: c for c in data['cards']}

    base = foil.resize((W, H), Image.LANCZOS)
    CR = 58  # crimp height at this size
    gray = ImageOps.grayscale(base.convert('RGB'))
    f_big = ImageFont.truetype(FONT, 52)
    f_sub = ImageFont.truetype(FONT, 25)

    for pid, label, col, cover in PACKS:
        if pid == 'oe':
            base.save(os.path.join(LEG, 'img', f'pack_{pid}.webp'), quality=88)
            continue
        dark = tuple(int(c * .18) for c in col)
        mid = tuple(int(c * .55) for c in col)
        tint = ImageOps.colorize(gray, black=dark, white=tuple(min(255, int(c * .5 + 140)) for c in col), mid=col).convert('RGBA')
        tint.putalpha(base.getchannel('A'))
        out = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        out.paste(tint, (0, 0))
        # the body: a dark foil in the pack colour, with diagonal holo streaks
        body = Image.new('RGBA', (W - 16, H - 2 * CR + 8), dark + (255,))
        bd = ImageDraw.Draw(body)
        bw, bh = body.size
        for y in range(bh):
            t = y / bh
            c = tuple(int(dark[i] * (1 - t) * 1.6 + mid[i] * .35 * (1 - abs(t - .45) * 2) + 8) for i in range(3))
            bd.line([(0, y), (bw, y)], fill=tuple(min(255, v) for v in c) + (255,))
        streak = Image.new('RGBA', body.size, (0, 0, 0, 0))
        sd = ImageDraw.Draw(streak)
        for x0, wdt, a in [(-120, 70, 34), (60, 26, 26), (210, 90, 22), (380, 30, 30)]:
            sd.polygon([(x0, bh), (x0 + wdt, bh), (x0 + wdt + bh * .55, 0), (x0 + bh * .55, 0)], fill=(255, 255, 255, a))
        body = Image.alpha_composite(body, streak.filter(ImageFilter.GaussianBlur(6)))
        bd = ImageDraw.Draw(body)
        gold = (255, 211, 92)
        bd.rounded_rectangle([10, 10, bw - 11, bh - 11], radius=14, outline=gold + (230,), width=4)
        bd.rounded_rectangle([18, 18, bw - 19, bh - 19], radius=10, outline=col + (150,), width=2)
        # logo
        def ctext(y, s, font, fill, stroke=4):
            w = bd.textlength(s, font=font)
            bd.text(((bw - w) / 2, y), s, font=font, fill=fill, stroke_width=stroke, stroke_fill=(40, 16, 0))
        ctext(34, 'LABFREAK', f_big, gold)
        ctext(96, 'L E G E N D S', f_sub, (90, 230, 210), 3)
        # medallion
        c = byid.get(cover)
        R = 150
        cx, cy = bw // 2, 150 + R
        glow = Image.new('RGBA', body.size, (0, 0, 0, 0))
        ImageDraw.Draw(glow).ellipse([cx - R - 18, cy - R - 18, cx + R + 18, cy + R + 18], fill=col + (200,))
        body = Image.alpha_composite(body, glow.filter(ImageFilter.GaussianBlur(16)))
        if c:
            s, i = c['art']
            sheet = Image.open(os.path.join(LEG, 'img', f'a{s:02d}.webp')).convert('RGBA')
            cell = sheet.crop(((i % 8) * 192, (i // 8) * 192, (i % 8) * 192 + 192, (i // 8) * 192 + 192)).resize((2 * R, 2 * R), Image.LANCZOS)
            mask = Image.new('L', (2 * R, 2 * R), 0)
            ImageDraw.Draw(mask).ellipse([0, 0, 2 * R - 1, 2 * R - 1], fill=255)
            disc = Image.new('RGBA', (2 * R, 2 * R), dark + (255,))
            disc.paste(cell, (0, 0), cell)
            body.paste(disc, (cx - R, cy - R), mask)
        bd = ImageDraw.Draw(body)
        bd.ellipse([cx - R - 3, cy - R - 3, cx + R + 3, cy + R + 3], outline=(255, 255, 255, 235), width=6)
        bd.ellipse([cx - R - 10, cy - R - 10, cx + R + 10, cy + R + 10], outline=gold + (200,), width=3)
        # pack name, shrunk to fit
        size = 44
        while size > 20:
            fnt = ImageFont.truetype(FONT, size)
            if bd.textlength(label, font=fnt) < bw - 70:
                break
            size -= 2
        ctext(cy + R + 30, label, fnt, (255, 255, 255))
        ctext(bh - 62, '5 CARDS  ·  AT LEAST ONE RARE', ImageFont.truetype(FONT, 17), (230, 220, 200), 2)
        out.paste(body, (8, CR - 4), body)
        out.save(os.path.join(LEG, 'img', f'pack_{pid}.webp'), quality=88)
    print('packs, sigils and sounds written')


if __name__ == '__main__':
    main()
