import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':412,'height':900})
        await pg.goto('http://localhost:8899/dbg6/index.html'); await pg.wait_for_function('window.__ihBoot===true'); await pg.wait_for_timeout(400)
        await pg.evaluate('''()=>{const D=window.__D;D.silence();D.redeem('IRON-LABFREAKGODMODE.L99.Y1.T9-OM229W');D.S.asc={realm:6,count:6,shards:0,vows:[],hall:[]};D.S.cleared=D.AREAS.map(()=>true);for(const k in D.UNIQUES){D.markFound(D.makeUnique(k));}for(const k in D.SETS)for(const sl of D.setSlots(k))D.markFound(D.makeSetPiece(k,sl));D.S.showClog=true;D.applyClog();}''')
        rooms=[('hero',None),('vault','Medallion'),('vault','Storage'),('vault','Collection'),('skills','Skills'),('skills','Feats'),('skills','Ascension'),('world','Realm'),('keep','Buildings'),('keep','Barracks'),('keep','Peddler')]
        for tab,room in rooms:
            r=await pg.evaluate('''([tab,room])=>{const D=window.__D;if(room)D.goRoom(tab,room);else D.showTab(tab);D.renderAll();const iw=window.innerWidth;const bad={};
              for(const e of document.querySelectorAll('body *')){const cs=getComputedStyle(e);if(cs.display==='none'||cs.visibility==='hidden')continue;const r=e.getBoundingClientRect();if(r.width===0)continue;if(r.right>iw+1||r.left<-1){const k=e.tagName.toLowerCase()+(e.id?'#'+e.id:'')+(e.className&&typeof e.className==='string'?'.'+e.className.split(' ').slice(0,2).join('.'):'');if(!bad[k])bad[k]=[Math.round(r.left),Math.round(r.right)];}}
              return {sw:document.documentElement.scrollWidth,iw,bad}}''',[tab,room])
            offenders={k:v for k,v in r['bad'].items() if not k.startswith('div#toast') and 'lgModal' not in k and 'modal' not in k}
            print(tab,room,'scrollW',r['sw'],'offenders',len(offenders),list(offenders.items())[:6])
        await b.close()
asyncio.run(main())
