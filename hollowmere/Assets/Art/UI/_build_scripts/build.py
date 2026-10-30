import json, numpy as np, os
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageChops
G='../gen/'; O='../art/'; os.makedirs(O,exist_ok=True)
FD='/usr/share/fonts/truetype/sand-box/google/Cinzel Decorative/CinzelDecorative-Black.ttf'
FC='/usr/share/fonts/truetype/sand-box/google/Cinzel/Cinzel-VariableFont_wght.ttf'
W,H=2400,1080
rng=np.random.default_rng(7)
A=lambda im: np.asarray(im).astype(np.float32)
def U(a): return Image.fromarray(np.clip(a,0,255).astype(np.uint8))

# ---------- keyers ----------
def chroma(im):
    a=A(im.convert('RGB')); r,g,b=a[...,0],a[...,1],a[...,2]
    gr=g-np.maximum(r,b)
    al=np.clip(1-(gr-18)/50,0,1)
    g2=np.minimum(g,np.maximum(r,b)+8)  # despill
    a[...,1]=np.where(gr>0,g2,g)
    out=np.dstack([a,al*255]); o=U(out)
    # tighten edge 1px
    m=o.split()[3].filter(ImageFilter.MinFilter(3)); o.putalpha(ImageChops.lighter(m,ImageChops.multiply(o.split()[3],m)))
    return o
def bgkey(im):
    a=A(im.convert('RGB')); h,w=a.shape[:2]
    # flood-ish: bg colour per row interpolated from left/right borders
    edge=np.concatenate([a[:8].reshape(-1,3),a[-8:].reshape(-1,3),a[:,:8].reshape(-1,3),a[:,-8:].reshape(-1,3)])
    bg=np.median(edge,0)
    from scipy import ndimage
    d=np.sqrt(((a-bg)**2).sum(-1)); gr=a[...,1]-np.maximum(a[...,0],a[...,2])
    cand=(d<70)|(gr>25)
    lab,_=ndimage.label(cand); border=set(np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]])))-{0}
    bgm=np.isin(lab,list(border))
    gm=(gr>22)&(d<90); l2,n2=ndimage.label(gm)
    sz=ndimage.sum(np.ones_like(gr),l2,range(1,n2+1))
    big=[i+1 for i,v in enumerate(sz) if v>120]; bgm|=np.isin(l2,big)
    al=1-ndimage.gaussian_filter(bgm.astype(np.float32),1.0)
    al=np.where(bgm,0,al); al=np.clip((al-0.15)/0.85,0,1)
    g2=np.minimum(a[...,1],np.maximum(a[...,0],a[...,2])+6); edgez=(al<1)&(gr>0); a[...,1]=np.where(edgez,g2,a[...,1])
    return U(np.dstack([a,al*255]))
def split_edges(rgba,h=H,gap_cut=0.5):
    w0,h0=rgba.size; s=h/h0; im=rgba.resize((round(w0*s),h),Image.LANCZOS)
    w=im.size[0]; c=Image.new('RGBA',(W,H),(0,0,0,0))
    L=im.crop((0,0,int(w*gap_cut),h)); R=im.crop((int(w*gap_cut),0,w,h))
    c.alpha_composite(L,(0,0)); c.alpha_composite(R,(W-R.size[0],0)); return c

# ---------- far ----------
far=Image.open(G+'far.png').convert('RGB'); s=W/far.size[0]
far=far.resize((W,round(far.size[1]*s)),Image.LANCZOS)
far=far.crop((0,120,W,120+H)).filter(ImageFilter.UnsharpMask(2,60,2))
# vignette + cool grade
yy,xx=np.mgrid[0:H,0:W]; v=1-0.55*np.clip(((xx-W/2)/(W*0.62))**2+((yy-H*0.45)/(H*0.85))**2,0,1)
fa=A(far)*v[...,None]; fa[...,2]*=1.04
U(fa).save(O+'keyart_bg_far.png')
# ---------- mid ----------
mid=chroma(Image.open(G+'mid.png'))
mid=split_edges(mid)
# darken toward bottom a bit, add faint mist at base
ma=A(mid); ma[...,:3]*=0.92; U(ma).save(O+'keyart_bg_mid.png'); mid=Image.open(O+'keyart_bg_mid.png')
# ---------- near ----------
n=A(Image.open(G+'near.png').convert('L'))
al=np.clip((235-n)/170,0,1)
col=np.zeros(n.shape+(3,)); col[...]=(6,8,14)
nr=U(np.dstack([col,al*255])); near=split_edges(nr)
near.save(O+'keyart_bg_near.png')

# ---------- logo ----------
LW,LH=1800,640
orn=A(Image.open(G+'orn.png').convert('RGB'))
oa=np.clip((orn.max(-1)-14)/60,0,1); rgb=orn/np.maximum(oa[...,None],1e-3); rgb=np.clip(rgb,0,255)
ornI=U(np.dstack([rgb,oa*255])); bb=ornI.getbbox(); ornI=ornI.crop(bb)
ornI=ornI.resize((LW-40,int(ornI.size[1]*(LW-40)/ornI.size[0]*0.95)),Image.LANCZOS)
logo=Image.new('RGBA',(LW,LH),(0,0,0,0))
logo.alpha_composite(ornI,((LW-ornI.size[0])//2,(LH-ornI.size[1])//2+10))
font=ImageFont.truetype(FD,190); txt='HOLLOWMERE'
tm=Image.new('L',(LW,LH),0); d=ImageDraw.Draw(tm)
tb=d.textbbox((0,0),txt,font=font); tw,th=tb[2]-tb[0],tb[3]-tb[1]
tx,ty=(LW-tw)//2-tb[0],(LH-th)//2-tb[1]+6
# squeeze if too wide
d.text((tx,ty),txt,font=font,fill=255)
bbt=tm.getbbox()
if bbt[2]-bbt[0]>LW-200:
    sc=(LW-200)/(bbt[2]-bbt[0]); t2=tm.crop(bbt); t2=t2.resize((int(t2.size[0]*sc),t2.size[1]),Image.LANCZOS)
    tm=Image.new('L',(LW,LH),0); tm.paste(t2,((LW-t2.size[0])//2,bbt[1]))
M=A(tm)/255
def dil(m,r): return A(Image.fromarray((m*255).astype(np.uint8)).filter(ImageFilter.MaxFilter(r)))/255
def blur(m,r): return A(Image.fromarray(np.clip(m*255,0,255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r)))/255
glow=blur(dil(M,9),18)*0.7
outl=blur(dil(M,15),1.2)  # dark outline
rim=blur(dil(M,7),0.8)    # thin gold rim
# metal fill: vertical gradient with horizon band + noise
ys=np.linspace(0,1,LH)[:,None]*np.ones((1,LW))
bt,bb2=bbt[1],bbt[3]; t=np.clip((np.arange(LH)[:,None]-bt)/(bb2-bt),0,1)*np.ones((1,LW))
def lerp(c0,c1,t): return np.array(c0)[None,None]*(1-t[...,None])+np.array(c1)[None,None]*t[...,None]
top=lerp((255,240,196),(226,176,92),np.clip(t/0.48,0,1)); bot=lerp((120,72,30),(214,160,82),np.clip((t-0.5)/0.5,0,1))
fill=np.where((t<0.5)[...,None],top,bot)
fill*= (0.9+0.1*rng.random((LH,LW,1)))
# bevel via emboss of blurred mask
hb=blur(M,3); gy=np.gradient(hb,axis=0); gx=np.gradient(hb,axis=1); sh=(-gy*1.0-gx*0.5)*900
fill=np.clip(fill+sh[...,None],0,255)
inner=blur(M,1)*(1-blur(M,0)*0)  # aa mask
out=np.zeros((LH,LW,4))
def over(dst,rgb,a):
    a=a[...,None]; da=dst[...,3:4]; na=a+da*(1-a)
    dst[...,:3]=(rgb*a+dst[...,:3]*da*(1-a))/np.maximum(na,1e-4); dst[...,3:4]=na
base=A(logo)/255; out[...,:3]=base[...,:3]*255; out[...,3]=base[...,3]
over(out,np.array([60,220,210.]),glow*0.75)
over(out,np.array([8,10,16.]),outl)
over(out,np.array([150,100,40.]),rim)
over(out,fill,M)
# top specular line
spec=np.clip(M-np.roll(M,4,axis=0),0,1)*0.6; over(out,np.array([255,255,240.]),spec)
o=out.copy(); o[...,3]*=255; logoI=U(o); logoI=logoI.crop(logoI.getbbox()); logoI.save(O+'logo.png')

# ---------- UI primitives ----------
SS=4
def rr(size,box,rad,ss=SS):
    w,h=size; m=Image.new('L',(w*ss,h*ss),0)
    ImageDraw.Draw(m).rounded_rectangle([box[0]*ss,box[1]*ss,box[2]*ss-1,box[3]*ss-1],rad*ss,fill=255)
    return A(m.resize((w,h),Image.LANCZOS))/255
def ell(size,box,ss=SS):
    w,h=size; m=Image.new('L',(w*ss,h*ss),0); ImageDraw.Draw(m).ellipse([v*ss for v in box],fill=255)
    return A(m.resize((w,h),Image.LANCZOS))/255
def vgrad(h,w,c0,c1,p=1.0):
    t=(np.linspace(0,1,h)**p)[:,None]*np.ones((1,w)); return lerp(c0,c1,t)
def blank(w,h): return np.zeros((h,w,4))
def fin(o): o=o.copy(); o[...,3]=np.clip(o[...,3],0,1)*255; return U(o)
NOISE=lambda h,w,amt: 1+amt*(A(Image.fromarray((rng.random((h//4+1,w//4+1))*255).astype(np.uint8)).resize((w,h),Image.BICUBIC))/255-0.5)
GOLD=((250,226,160),(196,140,62),(110,66,26))
def gold_ring(o,outer,innerm,w,h):
    ringm=np.clip(outer-innerm,0,1)
    g=vgrad(h,w,GOLD[0],GOLD[2],0.9)
    over(o,g,ringm)
def button(w,h,rad,face0,face1,state='normal',rivets=True):
    o=blank(w,h)
    off=4 if state=='pressed' else 0
    # drop shadow
    if state!='pressed': over(o,np.array([0,0,0.]),blur(rr((w,h),(4,10,w-4,h),rad),4)*0.6)
    om=rr((w,h),(2,2+off,w-2,h-6+off),rad)
    over(o,np.array([8,9,14.]),om)                       # outline
    gm=rr((w,h),(5,5+off,w-5,h-9+off),rad-3)
    gim=rr((w,h),(11,11+off,w-11,h-15+off),rad-8)
    gold=vgrad(h,w,GOLD[0],GOLD[2],1.0) if state!='disabled' else vgrad(h,w,(170,170,170),(70,70,74))
    if state=='pressed': gold=gold*0.8
    over(o,gold,np.clip(gm-gim,0,1))
    dm=rr((w,h),(13,13+off,w-13,h-17+off),rad-10)
    over(o,np.array([10,14,20.]),np.clip(gim-dm,0,1))
    face=vgrad(h,w,face0,face1,0.8)*NOISE(h,w,0.10)[...,None]
    if state=='pressed': face*=0.72
    over(o,face,dm)
    if state=='normal':
        gl=rr((w,h),(16,16,w-16,int(h*0.45)),rad-12)*np.clip(1-np.linspace(0,1,h)[:,None]*2.2,0,1)*0.28
        over(o,np.array([220,245,255.]),gl)
    else:
        ins=np.clip(dm-np.roll(dm,6,0),0,1)*0.55; over(o,np.array([0,0,0.]),ins)
    # bottom inner edge light
    eb=np.clip(dm-np.roll(dm,-3,0),0,1)*0.35; over(o,np.array([120,220,220.]) if state!='disabled' else np.array([140,140,140.]),eb)
    if rivets:
        for cx in (22,w-22):
            for cy in (22+off,h-26+off):
                rm=ell((w,h),(cx-5,cy-5,cx+5,cy+5)); over(o,np.array([30,20,10.]),rm)
                rm2=ell((w,h),(cx-3.5,cy-4,cx+2.5,cy+2)); over(o,np.array([255,230,160.]) if state!='disabled' else np.array([180,180,180.]),rm2)
    return o
TEAL0,TEAL1=(44,92,104),(14,32,42)
slices={}
def save(name,o,b=None):
    fin(o).save(O+name);
    if b: slices[name]={'left':b[0],'right':b[1],'top':b[2],'bottom':b[3],'size':[o.shape[1],o.shape[0]]}
BW,BH=480,144
save('button_normal.png',button(BW,BH,30,TEAL0,TEAL1,'normal'),(44,44,40,46))
save('button_pressed.png',button(BW,BH,30,TEAL0,TEAL1,'pressed'),(44,44,40,46))
dis=button(BW,BH,30,(70,74,80),(36,38,44),'disabled'); dis[...,3]*=0.92
save('button_disabled.png',dis,(44,44,40,46))
save('icon_button.png',button(160,160,34,TEAL0,TEAL1,'normal',rivets=False),(46,46,44,48))
save('icon_button_pressed.png',button(160,160,34,TEAL0,TEAL1,'pressed',rivets=False),(46,46,44,48))
# ---------- panel ----------
def corner_orn(o,w,h,cx,cy,sx,sy,size=40):
    m=Image.new('L',(w*SS,h*SS),0); d=ImageDraw.Draw(m)
    def P(x,y): return ((cx+sx*x)*SS,(cy+sy*y)*SS)
    d.polygon([P(0,0),P(size,6),P(14,14),P(6,size)],fill=255)
    d.ellipse([*P(-9,-9),*P(9,9)] if True else None,fill=255) if False else None
    mm=A(m.resize((w,h),Image.LANCZOS))/255
    over(o,np.array([8,9,14.]),blur(np.clip(dil(mm,5),0,1),0.6))
    over(o,vgrad(h,w,GOLD[0],GOLD[1]),mm)
    g=ell((w,h),(cx-7,cy-7,cx+7,cy+7)); over(o,np.array([8,9,14.]),dil(g,3)); over(o,np.array([70,230,215.]),g)
    over(o,np.array([230,255,250.]),ell((w,h),(cx-3,cy-4,cx+1,cy)))
def panel(w,h,rad=26,face0=(26,34,48),face1=(12,16,24),orn=True):
    o=blank(w,h)
    over(o,np.array([0,0,0.]),blur(rr((w,h),(6,10,w-6,h-2),rad),6)*0.55)
    om=rr((w,h),(4,4,w-4,h-8),rad); over(o,np.array([8,9,14.]),om)
    g1=rr((w,h),(8,8,w-8,h-12),rad-4); g2=rr((w,h),(14,14,w-14,h-18),rad-9)
    over(o,vgrad(h,w,GOLD[0],GOLD[2]),np.clip(g1-g2,0,1))
    d1=rr((w,h),(16,16,w-16,h-20),rad-11); over(o,np.array([6,8,12.]),np.clip(g2-d1,0,1))
    f=vgrad(h,w,face0,face1)*NOISE(h,w,0.08)[...,None]; over(o,f,d1)
    # inner thin gold hairline
    h1=rr((w,h),(26,26,w-26,h-30),rad-16); h2=rr((w,h),(28,28,w-28,h-32),rad-17)
    over(o,np.array([150,110,50.]),np.clip(h1-h2,0,1)*0.8)
    if orn:
        for cx,cy,sx,sy in ((20,20,1,1),(w-20,20,-1,1),(20,h-24,1,-1),(w-20,h-24,-1,-1)): corner_orn(o,w,h,cx,cy,sx,sy)
    return o
save('panel.png',panel(512,512),(72,72,72,76))
# header banner with notched ends
def header(w,h):
    o=blank(w,h); ss=SS
    def poly(inset):
        i=inset; return [(i+28,i),(w-28-i,i),(w-i,h/2),(w-28-i,h-i),(i+28,h-i),(i,h/2)]
    def pm(inset):
        m=Image.new('L',(w*ss,h*ss),0); ImageDraw.Draw(m).polygon([(x*ss,y*ss) for x,y in poly(inset)],fill=255); return A(m.resize((w,h),Image.LANCZOS))/255
    over(o,np.array([0,0,0.]),blur(pm(2),5)*0.6)
    over(o,np.array([8,9,14.]),pm(2)); a,b=pm(5),pm(11)
    over(o,vgrad(h,w,GOLD[0],GOLD[2]),np.clip(a-b,0,1)); c=pm(13); over(o,np.array([6,8,12.]),np.clip(b-c,0,1))
    over(o,vgrad(h,w,(118,36,40),(52,12,18))*NOISE(h,w,0.08)[...,None],c)
    gl=c*np.clip(1-np.linspace(0,1,h)[:,None]*2.4,0,1)*0.22; over(o,np.array([255,220,200.]),gl)
    for cx in (34,w-34):
        g=ell((w,h),(cx-7,h/2-7,cx+7,h/2+7)); over(o,np.array([8,9,14.]),dil(g,3)); over(o,np.array([70,230,215.]),g)
    return o
save('panel_header.png',header(640,112),(60,60,36,36))
# HUD bar frame + fills
def barframe(w,h):
    o=blank(w,h); r=h//2
    over(o,np.array([0,0,0.]),blur(rr((w,h),(2,4,w-2,h),r),3)*0.6)
    om=rr((w,h),(2,2,w-2,h-2),r); over(o,np.array([8,9,14.]),om)
    a=rr((w,h),(5,5,w-5,h-5),r-3); b=rr((w,h),(10,10,w-10,h-10),r-8)
    over(o,vgrad(h,w,GOLD[0],GOLD[2]),np.clip(a-b,0,1))
    c=rr((w,h),(12,12,w-12,h-12),r-10); over(o,np.array([8,9,14.]),np.clip(b-c,0,1))
    # trough left semi-transparent dark so fill sits underneath? keep trough opaque-dark; fill drawn above in its own image
    over(o,vgrad(h,w,(6,8,12),(20,24,32)),c*0.92)
    return o
def fill_bar(w,h,c0,c1):
    o=blank(w,h); r=h//2; m=rr((w,h),(0,0,w,h),r)
    over(o,vgrad(h,w,c0,c1),m)
    gl=rr((w,h),(4,2,w-4,h*0.45),r*0.6)*0.35; over(o,np.array([255,255,255.]),gl)
    eb=np.clip(m-np.roll(m,-2,0),0,1)*0.5; over(o,np.array([0,0,0.]),eb); return o
save('hud_frame.png',barframe(520,60),(30,30,0,0))
save('hud_fill_health.png',fill_bar(200,36,(255,96,84),(150,18,30)),(18,18,0,0))
save('hud_fill_mana.png',fill_bar(200,36,(110,200,255),(30,60,170)),(18,18,0,0))
save('hud_fill_xp.png',fill_bar(200,36,(255,226,130),(180,110,30)),(18,18,0,0))
save('hud_fill_ghost.png',fill_bar(200,36,(255,240,220),(220,200,180)),(18,18,0,0))
# portrait frame
def portrait(S=256):
    o=blank(S,S); c=S/2
    over(o,np.array([0,0,0.]),np.clip(blur(ell((S,S),(10,16,S-10,S-4)),6)-ell((S,S),(44,44,S-44,S-44)),0,1)*0.6)
    a=ell((S,S),(12,12,S-12,S-12)); over(o,np.array([8,9,14.]),np.clip(a-ell((S,S),(42,42,S-42,S-42)),0,1))
    b=ell((S,S),(16,16,S-16,S-16)); i=ell((S,S),(36,36,S-36,S-36))
    over(o,vgrad(S,S,GOLD[0],GOLD[2]),np.clip(b-i,0,1))
    # engraved ring groove
    g1=ell((S,S),(24,24,S-24,S-24)); g2=ell((S,S),(27,27,S-27,S-27)); over(o,np.array([90,56,22.]),np.clip(g1-g2,0,1))
    i2=ell((S,S),(40,40,S-40,S-40)); over(o,np.array([8,9,14.]),np.clip(i-i2,0,1))
    # gems at 4 points
    for ang in (0,90,180,270):
        x=c+np.cos(np.radians(ang))*(S/2-24); y=c+np.sin(np.radians(ang))*(S/2-24)
        g=ell((S,S),(x-10,y-10,x+10,y+10)); over(o,np.array([8,9,14.]),dil(g,3)); over(o,np.array([60,220,205.]) if ang!=90 else np.array([220,60,70.]),g)
        over(o,np.array([240,255,250.]),ell((S,S),(x-5,y-6,x,y-1)))
    # inside: transparent (portrait shows through); mask provided separately
    return o
save('portrait_frame.png',portrait())
pm=np.zeros((256,256,4)); pm[...,:3]=255; pm[...,3]=ell((256,256),(40,40,216,216)); fin(pm).save(O+'portrait_mask.png')
# close button
def close_btn(S=128):
    o=blank(S,S)
    over(o,np.array([0,0,0.]),blur(ell((S,S),(6,10,S-6,S-2)),4)*0.6)
    over(o,np.array([8,9,14.]),ell((S,S),(4,4,S-4,S-6)))
    a=ell((S,S),(8,8,S-8,S-10)); b=ell((S,S),(16,16,S-16,S-18))
    over(o,vgrad(S,S,GOLD[0],GOLD[2]),np.clip(a-b,0,1))
    over(o,vgrad(S,S,(200,52,52),(90,14,22))*NOISE(S,S,0.08)[...,None],b)
    over(o,np.array([255,230,220.]),ell((S,S),(30,22,S-30,S*0.48))*0.25)
    m=Image.new('L',(S*SS,S*SS),0); d=ImageDraw.Draw(m); k=S*SS
    for p in (((0.35,0.33),(0.65,0.63)),((0.65,0.33),(0.35,0.63))):
        d.line([(p[0][0]*k,p[0][1]*k),(p[1][0]*k,p[1][1]*k)],fill=255,width=int(0.09*k))
    xm=A(m.resize((S,S),Image.LANCZOS))/255
    over(o,np.array([30,6,8.]),dil(xm,5)); over(o,vgrad(S,S,(255,244,220),(220,180,120)),xm)
    return o
save('close_button.png',close_btn())
# slider
save('slider_track.png',barframe(400,40),(22,22,0,0))
save('slider_fill.png',fill_bar(120,20,(120,240,225),(20,120,130)),(10,10,0,0))
def knob(S=72):
    o=blank(S,S); over(o,np.array([0,0,0.]),blur(ell((S,S),(4,8,S-4,S-1)),3)*0.6)
    over(o,np.array([8,9,14.]),ell((S,S),(3,3,S-3,S-5)))
    a=ell((S,S),(6,6,S-6,S-8)); b=ell((S,S),(16,16,S-16,S-18))
    over(o,vgrad(S,S,GOLD[0],GOLD[2]),np.clip(a-b,0,1)); over(o,np.array([8,9,14.]),np.clip(b-ell((S,S),(18,18,S-18,S-20)),0,1))
    g=ell((S,S),(18,18,S-18,S-20)); over(o,vgrad(S,S,(120,250,235),(20,110,120)),g)
    over(o,np.array([255,255,255.]),ell((S,S),(25,23,36,32))*0.8); return o
save('slider_handle.png',knob())
# ---------- icons ----------
os.makedirs(O+'icons',exist_ok=True)
ks='settings play continue inventory map shop gold gem heart mana sword shield'.split()
for k in ks:
    im=bgkey(Image.open(G+f'icon_{k}.png')); a=np.asarray(im)[...,3]
    im.putalpha(Image.fromarray(np.where(a<20,0,a).astype(np.uint8)))
    im=im.crop(im.getbbox()); im.thumbnail((232,232),Image.LANCZOS)
    c=Image.new('RGBA',(256,256),(0,0,0,0)); c.alpha_composite(im,((256-im.size[0])//2,(256-im.size[1])//2)); c.save(O+f'icons/icon_{k}.png')
json.dump({'note':'9-slice borders in px: left,right,top,bottom (Unity Sprite Editor Border = L,B,R,T order!). Sprites at 100 PPU, Pixels Per Unit Multiplier 1 on a 2400x1080 reference canvas.','sprites':slices},open(O+'ui_slices.json','w'),indent=1)
print(json.dumps(slices))
