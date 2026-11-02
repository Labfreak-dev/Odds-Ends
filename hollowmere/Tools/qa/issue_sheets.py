from PIL import Image,ImageDraw
import sys
U='user/';A='fix/phone9/qa-phone-'
def crop(f,box=None):
    x=Image.open(f).convert('RGB')
    if f.endswith('K2FRDQFN2TXE71DVRNV7.jpg'): x=x.rotate(90,expand=True) if x.size[1]>x.size[0] else x
    return x.crop(box) if box else x
H=(820,240,1520,840)
issues=[
 ('1 gear deformation / stretching (mixed-set outfit, mantle 1.5m wide)',crop(U+'crop_hero1.jpg'),crop(A+'mix-run.png',H),'Fix: GearConform standoff + rarity keeps mesh family + cloth follows body weights. phone9 bulge p95<=0.083 (limit 0.12)'),
 ('2 tiled checkerboard floor',crop(U+'01M6D6FNMASKFTSZGC8F7NPGV7.jpg'),crop(A+'plain-idle.png'),'Fix: GroundBlend cobble/dirt/grass. floorgrid: user FAIL score 0.53 -> after seams=0 ok'),
 ('3 dark previews (bag paper doll)',crop(U+'01M6D6FQGY8K5J2S7E14Q9T5PR.jpg'),crop(A+'bag.png'),'Fix: preview key light faced hero back; StageLighting. after heroLuma 0.305 ok'),
 ('4 dashed telegraph ring',crop(U+'01M6D6FRK8W08TYV0AMHA2ZWFE.jpg',(0,0,1300,1080)) ,crop(A+'sword-idle.png',H),'Fix: HeroRune procedural rune decal'),
 ('5 starter outfit read as pyjamas / tiny creator hero',crop(U+'01M6D6FST2EWCRWCG0KYG6P50C.jpg'),crop(A+'creator.png'),'Fix: authored leather t3 starter set dyed worn wool; creator fov 20 tighter framing'),
 ('6 blade gripped instead of hilt',crop(U+'crop_hero2.jpg'),crop(A+'sword-run.png',H),'Hilt now seated at handle (720 checks 0 fails). Closed fist NOT visually proven - see grip_closeups_v1.jpg'),
 ('7 no TestStart gear in bag (only 2 gems)',crop(U+'01M6D6FQGY8K5J2S7E14Q9T5PR.jpg'),crop(A+'bag.png'),'Fix: kit into enlarged paged bag (fresh1 bag 354/390) + old saves granted'),
]
for i,(t,b,a,n) in enumerate(issues):
    W,Hh=900,560; im=Image.new('RGB',(W*2,Hh+80),(20,20,20)); d=ImageDraw.Draw(im)
    for j,x in enumerate([b,a]):
        x=x.copy(); x.thumbnail((W-10,Hh)); im.paste(x,(j*W+5,40))
    d.text((5,5),'ISSUE '+t,fill='white'); d.text((5,22),'BEFORE: user APK shot',fill='yellow'); d.text((W+5,22),'AFTER: current branch, Linux build, Android Medium, 2340x1080, game cam, live anim',fill='lime')
    d.text((5,Hh+50),n,fill='white')
    im.save('sheets/issues/issue%d.jpg'%(i+1),quality=85)
