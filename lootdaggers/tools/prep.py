import sys, numpy as np
from PIL import Image
def clean(src, dst, size=768):
    im=np.array(Image.open(src).convert('RGB')).astype(int)
    bg=im[3,3]; d=np.sqrt(((im-bg)**2).sum(-1)); r,g,b=im[...,0],im[...,1],im[...,2]
    mask=(d<90)|((r-g>110)&(b-g>60))
    im[mask]=[255,255,255]
    bb=Image.fromarray((~mask*255).astype('uint8')).getbbox()
    out=Image.fromarray(im.astype('uint8')).crop(bb); out.thumbnail((size,size))
    canvas=Image.new('RGB',(max(out.size)+80,)*2,(255,255,255)); canvas.paste(out,((canvas.width-out.width)//2,(canvas.height-out.height)//2)); canvas.save(dst)
if __name__=='__main__': clean(sys.argv[1],sys.argv[2])
