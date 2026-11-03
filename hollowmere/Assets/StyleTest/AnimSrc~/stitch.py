# python3 stitch.py meta.json out_dir : stitch Blender preview tiles into labelled strips (system python + PIL).
import json, sys, os
from PIL import Image, ImageDraw
meta = json.load(open(sys.argv[1])); out = sys.argv[2]; os.makedirs(out, exist_ok=True)
T = '/tmp/animwork/tiles'
for m in meta:
    n, v = m['n'], m['views']; im0 = Image.open(f"{T}/{m['tag']}_0_0.png"); w, h = im0.size
    sheet = Image.new('RGB', (w * n, h * v + 30), (20, 20, 24)); d = ImageDraw.Draw(sheet)
    for vi in range(v):
        for i in range(n):
            sheet.paste(Image.open(f"{T}/{m['tag']}_{vi}_{i}.png").convert('RGB'), (i * w, 30 + vi * h))
    for i in range(n):
        u = (i + 0.5) / n; f = u * m['len']
        hit = any(abs(f - hf) <= m['len'] / n / 2 for hf in m['hits'])
        d.text((i * w + 6, 8), f"f{f:4.1f} t{u:.2f}" + ("  HIT" if hit else ""), fill=(255, 210, 90) if hit else (230, 230, 230))
    d.text((w * n - 300, 8), m['tag'], fill=(160, 200, 255))
    sheet.save(f"{out}/{m['tag']}.jpg", quality=88)
    print('wrote', m['tag'])
