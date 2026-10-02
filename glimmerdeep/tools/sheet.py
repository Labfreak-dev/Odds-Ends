import sys, os
from PIL import Image
keys = sys.argv[2:]; out = sys.argv[1]
ims = [Image.open(f'art-src/{k}.webp').convert('RGB') for k in keys]
cell = 300; cols = min(4, len(ims)); rows = (len(ims)+cols-1)//cols
S = Image.new('RGB', (cols*cell, rows*cell), (40,40,40))
for i, im in enumerate(ims):
    im.thumbnail((cell, cell)); S.paste(im, ((i%cols)*cell, (i//cols)*cell))
S.save(out)
