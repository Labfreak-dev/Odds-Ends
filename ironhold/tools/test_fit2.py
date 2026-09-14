import asyncio
from playwright.async_api import async_playwright
fails=0
def ck(n,ok,x=''):
    global fails; print(('PASS ' if ok else 'FAIL ')+n+' '+str(x))
    if not ok: fails+=1
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        for w in [360,390,412,430,600,980]:
            pg=await b.new_page(viewport={'width':w,'height':900}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.goto('http://localhost:8899/dbg6/index.html'); await pg.wait_for_function('window.__ihBoot===true'); await pg.wait_for_timeout(300)
            r=await pg.evaluate('''()=>{const D=window.__D;D.silence();D.S.asc={realm:6,count:6,shards:0,vows:[],hall:[]};D.S.area=7;D.renderAll();
              const iw=window.innerWidth;const sw=document.documentElement.scrollWidth;const ids=['prevArea','btnMap','btnClog','btnCoach','btnPause','btnLog','nextArea'];
              const out=ids.map(id=>{const r=document.getElementById(id).getBoundingClientRect();return [id,Math.round(r.left),Math.round(r.right),r.width>0]});
              const sc=document.getElementById('scene').getBoundingClientRect();const lbl=getComputedStyle(document.querySelector('#btnClog span')).display;
              return {iw,sw,out,scene:[Math.round(sc.left),Math.round(sc.right)],lbl,name:document.getElementById('areaName').textContent}}''')
            ok=r['sw']<=r['iw'] and all(x[1]>=0 and x[2]<=r['iw'] and x[3] for x in r['out']) and r['scene'][1]<=r['iw'] and (r['lbl']=='none')==(w<520)
            ck(f'{w}px: nothing wider than the screen, every row button on screen, the log label {"hidden" if w<520 else "shown"}',ok and not errs,{'sw':r['sw'],'scene':r['scene'],'row':[(x[0],x[2]) for x in r['out']][-1],'lbl':r['lbl']})
            await pg.close()
        await b.close()
    print('FAILS',fails)
asyncio.run(main())
