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
          const last=D.AREAS.length-1;S.cleared=D.AREAS.map((a,i)=>i<last);S.kills=D.AREAS.map(()=>0);S.kills[last]=999;S.area=last;S.asc.realm=0;D.spawn(false);
          const need1=D.wyrmNeed();S.asc.realm=9;const need10=D.wyrmNeed();S.asc.realm=0;
          const asleep=!D.wyrmAwake();document.getElementById('btnBoss').click();const noBoss=!G.isBoss;
          D.renderAll();const txt=document.getElementById('bossTxt').textContent,dis=document.getElementById('btnBoss').disabled,hud=document.getElementById('hudBossTxt').textContent;
          D.coachSet('boss','on');S.asc.count=1;let spawnedBoss=false;for(let i=0;i<200;i++){D.tick(0.1);if(G.isBoss)spawnedBoss=true;}
          S.kills[0]=2500;const awake=D.wyrmAwake();document.getElementById('btnBoss').onclick();const boss=G.isBoss&&G.mob.n;
          return {need1,need10,asleep,noBoss,txt,dis,hud,spawnedBoss,awake,boss};}''')
        ck('the tally is 2,500 in realm 1 and 14,650 in realm 10',r['need1']==2500 and r['need10']==14650,r)
        ck('with the tally short the Wyrm sleeps: the button refuses, reads the count, the orb says Asleep, the Coach does not challenge',r['asleep'] and r['noBoss'] and r['txt'].startswith('Wyrm sleeps') and r['dis'] and r['hud']=='Asleep' and not r['spawnedBoss'],r)
        ck('with the tally met the Wyrm rises',r['awake'] and r['boss'] and 'Wyrm' in r['boss'],r['boss'])
        ck('no page errors',not errs,errs[:2])
        await pg.evaluate('()=>localStorage.removeItem("ironhold_idle_v1")'); await b.close()
    print('FAILS',fails)
asyncio.run(main())
