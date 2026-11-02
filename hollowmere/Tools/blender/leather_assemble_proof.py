import os,glob
from PIL import Image,ImageDraw
R='raw'
for d in ['turnarounds','closeups','gamecam']: os.makedirs(d,exist_ok=True)
for f in glob.glob(R+'/qa-turn-leather-t*.png'):
    Image.open(f).convert('RGB').save('turnarounds/'+os.path.basename(f)[8:-4]+'.jpg',quality=88)
joints=['shoulderR','shoulderL','elbowR','elbowL','hips','kneeR','kneeL','handR','handL']
for t in '123':
  for p in ['idle','run','attack']:
    ims=[Image.open(f'{R}/qa-turn-leather-close-t{t}-{p}-{j}.png').convert('RGB') for j in joints]
    w=600; ims=[i.resize((w,int(i.height*w/i.width))) for i in ims]; h=ims[0].height
    s=Image.new('RGB',(w*3,h*3))
    for k,(i,j) in enumerate(zip(ims,joints)):
        ImageDraw.Draw(i).text((8,8),j,fill=(255,255,0)); s.paste(i,((k%3)*w,(k//3)*h))
    s.save(f'closeups/t{t}_{p}.jpg',quality=85)
gc=sorted(glob.glob(R+'/qa-turncam-*.png'))
for f in gc: Image.open(f).save('gamecam/'+os.path.basename(f)[11:])
ims=[Image.open(f).convert('RGB') for f in gc]; w=640; ims=[i.resize((w,int(i.height*w/i.width))) for i in ims]; h=ims[0].height
s=Image.new('RGB',(w*4,h*3))
for k,i in enumerate(ims): s.paste(i,((k%4)*w,(k//4)*h))
s.save('gamecam_sheet.jpg',quality=85)
