import asyncio
from playwright.async_api import async_playwright
fails=0
def ck(n,ok,x=''):
    global fails; print(('PASS ' if ok else 'FAIL ')+n+' '+str(x))
    if not ok: fails+=1
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':420,'height':900},device_scale_factor=2)
        errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://localhost:8899/dbg6/index.html'); await pg.wait_for_function('window.__ihBoot===true'); await pg.wait_for_timeout(500)
        r=await pg.evaluate('''()=>{const D=window.__D;const S=D.S;D.silence();S.compFound={labfreak:1};S.party=[];S.gold=1e7;D.hireComp('labfreak');
          const items=D.cqItemsOf('labfreak');const shown=D.cqShown(D.COMPS.find(x=>x.id==='labfreak'));
          const slots=items.map(x=>x.s).sort();const icons=items.every(x=>D.ICONS[x.i]&&D.ICONS[x.i].length>50);
          const g0=S.gold;for(const it of items)D.cqBuy('labfreak',it.i);const owned=items.filter(x=>S.compOwn[x.i]).length;const spent=g0-S.gold;
          for(const it of items)D.cqOn('labfreak',it.i);const q=D.cqTally('labfreak');
          return {n:items.length,shown,slots,icons,owned,spent,worn:q.n,pow:D.cqPow('labfreak'),magic:q.a[3],range:q.a[4],stab:q.a[0]}}''')
        ck('Labfreak has a seven-piece kit, one per slot, with icons; all seven can be bought and worn; it leans magic and range',r['n']==7 and r['shown'] and r['slots']==sorted(['head','weapon','body','neck','relic','food','charm']) and r['icons'] and r['owned']==7 and r['spent']>0 and r['worn']==7 and r['pow']>0 and r['magic']>=10 and r['range']>=10 and r['stab']==0,r)
        await pg.evaluate('''()=>{const D=window.__D;D.showTab('keep');D.goRoom('keep','Barracks');D.renderAll();D.cqOpen();D.cqUI.sel='labfreak';D.cqRender();}''')
        await pg.wait_for_timeout(400)
        r=await pg.evaluate('''()=>{const el=document.getElementById('cqDoll');const imgs=[...document.querySelectorAll('#cqDoll img, #cqBag img')];return {open:window.__D.cqUI.open,head:document.querySelector('#cqHead h2').textContent,imgs:imgs.length,broken:imgs.filter(i=>i.complete&&i.naturalWidth===0).length}}''')
        ck('the armoury opens on Labfreak with his kit drawn and no broken icons',r['open'] and r['head']=='Labfreak' and r['imgs']>=8 and r['broken']==0,r)
        box=await pg.locator('#cqDoll').bounding_box(); 
        await pg.screenshot(path='/tmp/labkit.png',clip={'x':0,'y':max(0,box['y']-60),'width':420,'height':min(600,900-max(0,box['y']-60))})
        ck('no page errors',not errs,errs[:2])
        await pg.evaluate('()=>localStorage.removeItem("ironhold_idle_v1")'); await b.close()
    print('FAILS',fails)
asyncio.run(main())
