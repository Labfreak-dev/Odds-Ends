import asyncio,time
from playwright.async_api import async_playwright
fails=0
def ck(n,ok,x=''):
    global fails; print(('PASS ' if ok else 'FAIL ')+n+' '+str(x))
    if not ok: fails+=1
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        # 1. the page boots and paints before the art arrives; the art is fetched with a version stamp and fills in
        pg=await b.new_page(viewport={'width':420,'height':900}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e))); reqs=[]; pg.on('request',lambda r:reqs.append(r.url))
        t0=time.time(); await pg.goto('http://localhost:8899/dbg6/index.html'); await pg.wait_for_function('window.__ihBoot===true'); tb=time.time()-t0
        early=await pg.evaluate("()=>({art:!!window.__ihArt,spr:Object.keys(window.__D.SPR).length,hasMob:!!window.__D.G.mob,cv:document.getElementById('scene').width>0})")
        await pg.wait_for_function('window.__ihArt===true',timeout=60000); ta=time.time()-t0
        await pg.wait_for_function("window.__D.sprReady('lk_base_idle')&&window.__D.sprReady('chicken_idle')",timeout=60000)
        late=await pg.evaluate("()=>({spr:Object.keys(window.__D.SPR).length,bg:window.__D.AREA_BG.length,lab:!!window.__D.LAB_BG.src})")
        art=[u for u in reqs if 'art.js' in u]
        ck('the page boots on its own before the art (which is fetched once, stamped) and the art then fills every table',not early['art'] and early['hasMob'] and early['cv'] and len(art)==1 and '?v=' in art[0] and late['spr']>300 and late['bg']==9 and late['lab'],{'boot_s':round(tb,2),'art_s':round(ta,2),'early':early,'late':late,'art':art[0].split('/')[-1]})
        ck('no page errors with the art',not errs,errs[:2]); await pg.close()
        # 2. with the art blocked the game still runs in outline and says so
        pg=await b.new_page(viewport={'width':420,'height':900}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.route('**/art.js*',lambda route:route.abort())
        await pg.goto('http://localhost:8899/dbg6/index.html'); await pg.wait_for_function('window.__ihBoot===true'); await pg.wait_for_timeout(1500)
        r=await pg.evaluate("()=>{const D=window.__D;D.S.paused=false;for(let i=0;i<30;i++)D.tick(0.1);let ok=true;try{D.drawScene(1,0.016);}catch(e){ok=String(e);}return {art:!!window.__ihArt,draw:ok,log:document.getElementById('log').textContent.includes('did not arrive')}}")
        ck('with art.js blocked the game fights on in outline and writes a line about it',not r['art'] and r['draw']==True and r['log'] and not errs,{**r,'errs':errs[:1]}); await pg.close()
        await b.close()
    print('FAILS',fails)
asyncio.run(main())
