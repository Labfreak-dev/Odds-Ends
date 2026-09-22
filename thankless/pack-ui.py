#!/usr/bin/env python3
"""b084: pack the menu UI kit. Reads art-src/ui/NN_*.jpg (Grok, magenta background), keys the magenta with a
soft matte, un-blends the fringe against the background colour, trims, resizes and writes ui/<key>.webp.
Prints the nine-slice insets (in output pixels) for the frames so the CSS border-image values can be set."""
import glob,os,json
from PIL import Image
import numpy as np
NAMES={1:'ui_frame',2:'ui_btn',3:'ui_btn_on',4:'ui_btn_big',5:'ui_nav',6:'ui_nav_on',7:'ui_ribbon',8:'ui_divider',
       9:'ic_camp',10:'ic_party',11:'ic_field',12:'ic_contracts',13:'ic_training',14:'ic_relics',15:'ic_codex',16:'ic_awards',17:'ic_ledger',18:'ic_help',19:'ic_settings',20:'ic_save'}
MAXW={'ui_frame':640,'ui_btn':512,'ui_btn_on':512,'ui_btn_big':640,'ui_nav':256,'ui_nav_on':256,'ui_ribbon':640,'ui_divider':640}
def key(im,hollow):
    """Flood the magenta from the edges (and from the centre for hollow frames) so purple paint that merely
    looks pinkish survives; soften only the pixels that touch the flooded region; un-blend their colour."""
    from PIL import ImageDraw
    a=np.asarray(im.convert('RGB')).astype(np.float32)
    r,g,b=a[...,0],a[...,1],a[...,2]
    m=np.minimum(r,b)-g
    ring=np.concatenate([a[:6].reshape(-1,3),a[-6:].reshape(-1,3),a[:,:6].reshape(-1,3),a[:,-6:].reshape(-1,3)])
    bg=np.median(ring,axis=0);mbg=min(bg[0],bg[2])-bg[1]
    loose=((m>mbg*0.55)&(g<34)).astype(np.uint8)*255        # anything that could be background
    mk=Image.fromarray(loose,'L').copy();h,w=loose.shape
    seeds=[(1,1),(w-2,1),(1,h-2),(w-2,h-2),(w//2,1),(w//2,h-2),(1,h//2),(w-2,h//2)]+([(w//2,h//2)] if hollow else [])
    for x,y in seeds:
        if mk.getpixel((x,y))==255:ImageDraw.floodfill(mk,(x,y),128)
    flood=(np.asarray(mk)==128)|((m>mbg*0.8)&(g<34))    # plus any near-pure magenta pocket (ring holes, glass)
    # pixels within a few px of the flood get a soft alpha from their magenta-ness; the rest are opaque
    near=flood.copy()
    for _ in range(16):
        d=near.copy();d[1:]|=near[:-1];d[:-1]|=near[1:];d[:,1:]|=near[:,:-1];d[:,:-1]|=near[:,1:];near=d
    soft=np.clip((mbg-12-m)/34,0,1)
    alpha=np.where(flood,0.0,np.where(near,soft,1.0)).astype(np.float32)
    # bright pink glow halos next to the background are the magenta bleeding into a glow: fade them by their pinkness
    pinkish=near&(m>mbg*0.45)&(g<r-40)&(g<b-30)
    alpha=np.where(pinkish,alpha*np.clip(1-(m-mbg*0.45)/(mbg*0.45),0,1),alpha)
    hot=near&(r>180)&(g<110)&(r-g>100)&(b>g+10)          # the hot-pink rim of a glow painted over magenta
    alpha=np.where(hot,alpha*np.clip((g-40)/70,0,1),alpha)
    al=alpha[...,None]
    true=np.where(al>0.02,(a-(1-al)*bg)/np.maximum(al,0.02),a)
    out=np.dstack([np.clip(true,0,255),alpha*255]).astype(np.uint8)
    return Image.fromarray(out,'RGBA')
def trim(im,pad=2):
    al=np.asarray(im)[...,3]
    ys,xs=np.where(al>8)
    if not len(xs):return im
    x0,x1,y0,y1=max(0,xs.min()-pad),min(im.width,xs.max()+pad+1),max(0,ys.min()-pad),min(im.height,ys.max()+pad+1)
    return im.crop((x0,y0,x1,y1))
def insets(im):
    al=np.asarray(im)[...,3]>128
    h,w=al.shape;my,mx=h//2,w//2
    row=al[my];col=al[:,mx]
    def run(v):
        n=0
        for x in v:
            if x:n+=1
            elif n>0:break
        return n
    return {'top':run(col),'right':run(col[::-1][::1]) if False else run(row[::-1]),'bottom':run(col[::-1]),'left':run(row)}
os.makedirs('ui',exist_ok=True)
report={}
for f in sorted(glob.glob('art-src/ui/*.jpg')):
    n=int(os.path.basename(f).split('_')[0]);k=NAMES[n]
    im=trim(key(Image.open(f),k.startswith('ui_') and k!='ui_divider'))
    mw=MAXW.get(k,128)
    if k.startswith('ic_'):
        s=mw/max(im.size);im=im.resize((max(1,round(im.width*s)),max(1,round(im.height*s))),Image.LANCZOS)
    elif im.width>mw:
        s=mw/im.width;im=im.resize((mw,max(1,round(im.height*s))),Image.LANCZOS)
    im.save('ui/'+k+'.webp',quality=92,method=6)
    rep={'size':im.size,'kb':round(os.path.getsize('ui/'+k+'.webp')/1024,1)}
    if k.startswith('ui_') and k not in('ui_divider',):rep['insets']=insets(im)
    report[k]=rep
print(json.dumps(report,indent=0))
