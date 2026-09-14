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
        r=await pg.evaluate('''()=>{const D=window.__D;const S=D.S;D.silence();S.inv=[D.makeItem(0,'body',1),D.makeItem(7,'body',3),D.makeItem(6,'weapon',2,6),D.makeItem(3,'ring',2),D.makeUnique('sov_greatsword')];S.store=[D.makeItem(8,'legs',4)];
          D.showTab('hero');D.renderAll();const cells=[...document.querySelectorAll('#bag .item')];const out=cells.map(c=>[c.querySelector('.nm').textContent,c.querySelector('.wr').className,c.querySelector('.wr').textContent.trim(),c.classList.contains('locked')]);
          D.showTab('vault');D.goRoom('vault','Storage');D.renderAll();const sc=[...document.querySelectorAll('#store .item')].map(c=>[c.querySelector('.wr').className,c.classList.contains('locked')]);
          D.openItem(S.inv[1],false);const win=document.getElementById('modalBox').textContent;document.getElementById('modal').className='';D.openItem(S.inv[0],false);const win2=document.getElementById('modalBox').textContent;document.getElementById('modal').className='';
          return {out,sc,win:win.includes('more to go')&&/you have \\d+/.test(win),win2:win2.includes('ready to wear')}}''')
        ok=[x for x in r['out'] if 'ok' in x[1]]; no=[x for x in r['out'] if 'no' in x[1]]
        ck('at level 1 the pack marks the bronze body with a tick and the rest with a lock naming the skill and level; storage the same; the item window says how far to go',len(ok)==1 and len(no)==4 and all(x[3] for x in no) and not ok[0][3] and any('Def 60' in x[2] or 'Def ' in x[2] for x in no) and any('Rng' in x[2] for x in no) and any('All 99' in x[2] for x in no) and r['sc'][0][1] and r['win'] and r['win2'],r)
        await pg.evaluate('''()=>{const D=window.__D;D.showTab('hero');D.renderAll();window.scrollTo(0,0);}'''); await pg.wait_for_timeout(200)
        box=await pg.locator('#bag').bounding_box(); await pg.screenshot(path='/tmp/wear_shot.png',clip={'x':0,'y':box['y']-10,'width':420,'height':min(300,box['height']+20)})
        ck('no page errors',not errs,errs[:2])
        await pg.evaluate('()=>localStorage.removeItem("ironhold_idle_v1")'); await b.close()
    print('FAILS',fails)
asyncio.run(main())
