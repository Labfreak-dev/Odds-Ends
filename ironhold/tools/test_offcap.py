import asyncio
from playwright.async_api import async_playwright
fails=0
def ck(n,ok,x=''):
    global fails; print(('PASS ' if ok else 'FAIL ')+n+' '+str(x))
    if not ok: fails+=1
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':420,'height':900})
        errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://localhost:8899/dbg6/index.html'); await pg.wait_for_function('window.__ihBoot===true'); await pg.wait_for_timeout(400)
        r=await pg.evaluate('''()=>{const D=window.__D,S=D.S,G=D.G;D.silence();G.sim=true;D.redeem('IRON-LABFREAKGODMODE.L99.Y1.T9-OM229W');
          const caps={};for(const r of [0,3,4,7,8,11,12,19]){S.asc.realm=r;caps[r+1]=[D.offCap()/3600,D.offCapNext()];}
          S.asc.realm=4;S.last=Date.now()-30*3600*1000;const d=D.offline(true,true);
          return {caps,away:d&&d.t/3600,capped:d&&d.capped}}''')
        ck('cap is 8 h in realms 1-4, 16 h in 5-8, 24 h in 9-12, 40 h in realm 20; the next step is named',r['caps']['1']==[8,5] and r['caps']['4']==[8,5] and r['caps']['5']==[16,9] and r['caps']['8']==[16,9] and r['caps']['9']==[24,13] and r['caps']['12']==[24,13] and r['caps']['13']==[32,17] and r['caps']['20']==[40,21],r['caps'])
        ck('thirty hours away in realm 5 count as sixteen and the report says it was capped',abs(r['away']-16)<0.01 and r['capped'],{'away':r['away'],'capped':r['capped']})
        ck('no page errors',not errs,errs[:2])
        await pg.evaluate('()=>localStorage.removeItem("ironhold_idle_v1")'); await b.close()
    print('FAILS',fails)
asyncio.run(main())
