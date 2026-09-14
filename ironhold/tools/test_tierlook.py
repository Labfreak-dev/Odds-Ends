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
        await pg.goto('http://localhost:8899/dbg6/index.html'); await pg.wait_for_function('window.__ihBoot===true')
        await pg.wait_for_function("['lk_kit_7','lk_kit_8','lk_kit_9','lk_bow_kit_7','lk_bow_kit_8','lk_bow_kit_9','lk_wiz_kit_7','lk_wiz_kit_8','lk_wiz_kit_9','lk_kit_3'].every(k=>window.__D.sprReady(k+'_idle'))",timeout=60000)
        r=await pg.evaluate('''()=>{const D=window.__D;const S=D.S;D.silence();const look=(tier,wt,arm)=>{for(const s of D.SLOTS)S.equip[s]=null;S.equip.weapon=D.makeItem(5,'weapon',1,wt);S.equip.body=D.makeItem(tier,'body',1,undefined,arm||null);return D.lookKey();};
          return {ob:look(8,2),st:look(9,2),obBow:look(8,6,'hide'),stWiz:look(9,12,'robe'),dragon:look(7,2),black:look(3,2)}}''')
        ck('Obsidian and Starsteel wear their own melee looks; every class has its own; lower tiers keep their own',r['ob']=='lk_kit_8' and r['st']=='lk_kit_9' and r['obBow']=='lk_bow_kit_8' and r['stWiz']=='lk_wiz_kit_9' and r['dragon']=='lk_kit_7' and r['black']=='lk_kit_3',r)
        ck('no page errors',not errs,errs[:2])
        await pg.evaluate('()=>localStorage.removeItem("ironhold_idle_v1")'); await b.close()
    print('FAILS',fails)
asyncio.run(main())
