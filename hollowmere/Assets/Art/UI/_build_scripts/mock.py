import json
from PIL import Image, ImageDraw, ImageFont, ImageFilter
O='../art/'; W,H=2400,1080
FC='/usr/share/fonts/truetype/sand-box/google/Cinzel/Cinzel-VariableFont_wght.ttf'
S=json.load(open(O+'ui_slices.json'))['sprites']
def nine(name,w,h):
    im=Image.open(O+name); b=S[name]; L,R,T,B=b['left'],b['right'],b['top'],b['bottom']; sw,sh=im.size
    out=Image.new('RGBA',(w,h)); xs=[(0,L,0,L),(L,sw-R,L,w-R),(sw-R,sw,w-R,w)]; ys=[(0,T,0,T),(T,sh-B,T,h-B),(sh-B,sh,h-B,h)]
    for sx0,sx1,dx0,dx1 in xs:
        for sy0,sy1,dy0,dy1 in ys:
            if sx1>sx0 and sy1>sy0 and dx1>dx0 and dy1>dy0: out.paste(im.crop((sx0,sy0,sx1,sy1)).resize((dx1-dx0,dy1-dy0),Image.LANCZOS),(dx0,dy0))
    return out
def label(c,box,t,size=46,col=(246,232,200)):
    f=ImageFont.truetype(FC,size); f.set_variation_by_name('Bold'); d=ImageDraw.Draw(c)
    x=(box[0]+box[2])/2; y=(box[1]+box[3])/2-4
    d.text((x,y+3),t,font=f,fill=(0,0,0,200),anchor='mm'); d.text((x,y),t,font=f,fill=col,anchor='mm',stroke_width=2,stroke_fill=(10,14,20))
c=Image.open(O+'keyart_bg_far.png').convert('RGBA')
c.alpha_composite(Image.open(O+'keyart_bg_mid.png')); c.alpha_composite(Image.open(O+'keyart_bg_near.png'))
lg=Image.open(O+'logo.png'); lg=lg.resize((1300,int(lg.size[1]*1300/lg.size[0])),Image.LANCZOS); c.alpha_composite(lg,((W-1300)//2,60))
y=520
for name,t in (('button_normal.png','Continue'),('button_normal.png','New Hero'),('button_pressed.png','Settings'),('button_disabled.png','Online')):
    b=nine(name,560,136); x=(W-560)//2; c.alpha_composite(b,(x,y)); label(c,(x,y+(4 if 'pressed' in name else 0),x+560,y+136-6),t,col=(150,150,150) if 'disabled' in name else (246,232,200)); y+=124
# corner icon buttons
for i,k in enumerate(('settings','shop','map')):
    x=W-200-i*170; c.alpha_composite(Image.open(O+'icon_button.png'),(x,40))
    ic=Image.open(O+f'icons/icon_{k}.png').resize((104,104),Image.LANCZOS); c.alpha_composite(ic,(x+28,64))
# currency
for i,(k,v) in enumerate((('gold','1,250'),('gem','48'))):
    x=60+i*330; p=nine('hud_frame.png',280,60); c.alpha_composite(p,(x+40,58)); ic=Image.open(O+f'icons/icon_{k}.png').resize((96,96),Image.LANCZOS); c.alpha_composite(ic,(x,40))
    label(c,(x+90,58,x+320,118),v,40)
d=ImageDraw.Draw(c); f=ImageFont.truetype(FC,26); d.text((W/2,H-30),'v0.1  —  mockup (labels rendered by game)',font=f,fill=(170,190,200,160),anchor='mm')
c.convert('RGB').save(O+'title_mockup.png')
# layers strip
st=Image.new('RGB',(2400,1080+60),(20,20,24))
for i,n in enumerate(('keyart_bg_far.png','keyart_bg_mid.png','keyart_bg_near.png','logo.png')):
    im=Image.open(O+n).convert('RGBA'); bg=Image.new('RGBA',im.size,(60,64,72,255))
    ck=Image.new('RGBA',im.size,(80,84,92,255)); bg.alpha_composite(im); bg.thumbnail((1190,520)); st.paste(bg.convert('RGB'),((i%2)*1205,(i//2)*560))
st.save(O+'layers_preview.png')
# contact sheet
items=['button_normal.png','button_pressed.png','button_disabled.png','panel.png','panel_header.png','hud_frame.png','hud_fill_health.png','hud_fill_mana.png','hud_fill_xp.png','portrait_frame.png','icon_button.png','icon_button_pressed.png','close_button.png','slider_track.png','slider_fill.png','slider_handle.png']+[f'icons/icon_{k}.png' for k in 'settings play continue inventory map shop gold gem heart mana sword shield'.split()]
cs=Image.new('RGBA',(2400,1500),(34,38,46,255)); x,y,rowh=30,30,0
f2=ImageFont.truetype(FC,20)
for n in items:
    im=Image.open(O+n); im.thumbnail((520,300) if 'icons' not in n else (190,190))
    if x+im.size[0]>2370: x=30; y+=rowh+50; rowh=0
    cs.alpha_composite(im,(x,y)); ImageDraw.Draw(cs).text((x,y+im.size[1]+6),n.split('/')[-1],font=f2,fill=(200,200,200))
    x+=im.size[0]+40; rowh=max(rowh,im.size[1])
# demo: stretched panel with header + bars
dp=nine('panel.png',760,420); cs.alpha_composite(dp,(1600,y-30 if y>1000 else 1040)) if False else None
cs=cs.crop((0,0,2400,y+rowh+60))
demo=Image.new('RGBA',(2400,520),(34,38,46,255))
demo.alpha_composite(nine('panel.png',900,460),(30,30)); demo.alpha_composite(nine('panel_header.png',560,100),(200,0))
label(demo,(200,0,760,96),'Inventory',44)
demo.alpha_composite(nine('hud_frame.png',600,60),(1000,60)); demo.alpha_composite(nine('hud_fill_health.png',420,36),(1012,72))
demo.alpha_composite(nine('hud_frame.png',600,60),(1000,140)); demo.alpha_composite(nine('hud_fill_mana.png',300,36),(1012,152))
demo.alpha_composite(nine('slider_track.png',500,40),(1000,240)); demo.alpha_composite(nine('slider_fill.png',300,20),(1010,250)); demo.alpha_composite(Image.open(O+'slider_handle.png'),(1280,224))
p=Image.open(O+'portrait_frame.png'); demo.alpha_composite(p,(1700,40)); demo.alpha_composite(Image.open(O+'close_button.png'),(2100,40))
demo.alpha_composite(nine('button_normal.png',320,110),(1000,330)); label(demo,(1000,330,1320,434),'Equip',40)
full=Image.new('RGBA',(2400,cs.size[1]+520)); full.paste(cs,(0,0)); full.paste(demo,(0,cs.size[1]))
full.convert('RGB').save(O+'contact_sheet.png')
