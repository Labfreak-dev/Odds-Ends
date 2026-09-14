import asyncio,json
from playwright.async_api import async_playwright
SP='/tmp/claude-0/-home-user-Odds-Ends/6256ba04-1a25-565f-b31b-2b72a8b325ad/scratchpad'
sv=open(SP+'/stall_r18.txt').read()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':420,'height':900})
        errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.add_init_script("localStorage.setItem('ironhold_idle_v1',%s)"%json.dumps(sv))
        await pg.goto('http://localhost:8899/dbg6/index.html'); await pg.wait_for_function('window.__ihBoot===true'); await pg.wait_for_timeout(500)
        r=await pg.evaluate('''()=>{const D=window.__D,S=D.S,G=D.G;D.silence();G.sim=true;S.area=6;D.spawn(true);const n=G.mob.n,hp=G.mob.hp;
          let t=0,died=false;for(let i=0;i<60000;i++){D.tick(0.1);t+=0.1;if(!G.isBoss||G.mobHp<=0){died=true;break;}if(G.dead)break;}
          return {omen:S.asc.omen,n,hp,died,t:Math.round(t),dead:G.dead,dps:Math.round(D.playerDps()),cap:Math.round(D.playerDps()*0.35),freeRegen:Math.round(hp*0.015)}}''')
        ok=r['omen']=='dead' and r['died'] and r['t']<1800
        print(('PASS ' if ok else 'FAIL ')+'under the Restless Dead the realm-18 Overlord dies within half an hour of fighting',r); print('errs',errs[:2]); await b.close()
asyncio.run(main())
