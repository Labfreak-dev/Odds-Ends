# combine anim/before_<id>.jpg + after_<id>.jpg into anim/ba_<id>.jpg with labels and the contact frame marked
import sys, os
from PIL import Image, ImageDraw
d = sys.argv[1]; N = 8
times = {}
for l in open(os.path.join(d, 'strip_times.txt')):
    p = l.split();
    if len(p) == 3: times[p[0]] = (int(p[1]), [float(x) for x in p[2].split(',')])
for sid, (k, ts) in times.items():
    b, a = os.path.join(d, f'before_{sid}.jpg'), os.path.join(d, f'after_{sid}.jpg')
    if not (os.path.exists(b) and os.path.exists(a)): continue
    B, A = Image.open(b), Image.open(a); w = B.width // N; H = 34
    out = Image.new('RGB', (B.width + 150, B.height + A.height + 2 * H), (18, 18, 22)); dr = ImageDraw.Draw(out)
    for row, (im, lab, col) in enumerate(((B, 'BEFORE\nphase-5\nclip', (200, 200, 200)), (A, 'AFTER\nweighted\nclip', (255, 210, 90)))):
        y = row * (B.height + H)
        for i, t in enumerate(ts):
            dr.text((150 + i * w + 8, y + 10), f't={t:.2f}' + ('  CONTACT/RELEASE' if i == k else ''), fill=(255, 120, 90) if i == k else (220, 220, 220))
        out.paste(im, (150, y + H)); dr.text((14, y + H + im.height // 2 - 20), lab, fill=col)
        x0 = 150 + k * w; dr.rectangle([x0, y + H, x0 + w - 1, y + H + im.height - 1], outline=(255, 120, 90), width=3)
    dr.text((14, 10), sid, fill=(150, 200, 255))
    out.save(os.path.join(d, f'ba_{sid}.jpg'), quality=86)
print('combined', len(times))
