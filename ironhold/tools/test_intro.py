import time,sys
from playwright.sync_api import sync_playwright
SP='/tmp/claude-0/-home-user-Odds-Ends/6256ba04-1a25-565f-b31b-2b72a8b325ad/scratchpad'
URL='http://127.0.0.1:8899/dbg6/index.html'
fails=[]
def chk(name,ok,info=''):
    print(('PASS ' if ok else 'FAIL ')+name,info); 
    if not ok: fails.append(name)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':420,'height':860}); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    reqs=[]; pg.on('request',lambda r: reqs.append(r.url) if 'art.js' in r.url else None)
    # 1. cold boot through a slowish pipe (2 MB/s) so the curtain is visible
    cdp=ctx.new_cdp_session(pg); cdp.send('Network.enable'); cdp.send('Network.emulateNetworkConditions',{'offline':False,'latency':40,'downloadThroughput':2_000_000,'uploadThroughput':500_000})
    t=time.time(); pg.goto(URL); pg.wait_for_function('window.__D')
    st=pg.evaluate("()=>({vis:!!document.getElementById('intro')&&!document.getElementById('intro').classList.contains('out'),txt:document.getElementById('introTxt').textContent,w:document.getElementById('introFill').style.width,cache:window.__art.cache,got:window.__art.got})")
    chk('curtain up at boot',st['vis'],st)
    pg.wait_for_timeout(2500); pg.screenshot(path=SP+'/intro_mid.png')
    st=pg.evaluate("()=>({txt:document.getElementById('introTxt').textContent,w:document.getElementById('introFill').style.width,got:window.__art.got})")
    chk('bytes progress moves','Fetching' in st['txt'] and st['got']>0 and st['w'] not in ('0%',''),st)
    pg.wait_for_function('window.__ihArt',timeout=60000); tA=time.time()-t
    pg.wait_for_function("!document.getElementById('intro')",timeout=30000); tE=time.time()-t
    chk('curtain lifts after the art lands',True,f'art {tA:.1f}s, lifted {tE:.1f}s')
    chk('no page errors',not errs,errs)
    chk('not from cache on first visit',pg.evaluate('window.__art.cache')==False)
    chk('stamp',pg.evaluate("document.getElementById('bstamp').textContent").startswith('v1.'))
    chk('log has no art complaint',not pg.evaluate("[...document.querySelectorAll('#log div')].some(d=>/art/i.test(d.textContent)&&/not arrive|MISSING|NOT READY/.test(d.textContent))"))
    # 2. warm boot: the Cache API copy, no network request for art.js
    reqs.clear(); t=time.time(); pg.reload(); pg.wait_for_function('window.__D')
    pg.wait_for_function('window.__ihArt',timeout=60000); tA=time.time()-t
    pg.wait_for_function("!document.getElementById('intro')",timeout=30000); tE=time.time()-t
    cache=pg.evaluate('window.__art.cache')
    chk('warm boot reads the vault copy',cache==True and not reqs,f'cache={cache} reqs={reqs} art {tA:.1f}s lifted {tE:.1f}s')
    chk('sprites all complete',pg.evaluate("(()=>{let n=0,c=0;for(const k in SPR)for(const i of SPR[k]){n++;if(i.complete&&i.naturalWidth>0)c++;}return c===n&&n>900;})()"))
    # 3. a slow road: the Enter button after twelve seconds
    pg.evaluate("caches.delete('ih-art')")
    cdp.send('Network.emulateNetworkConditions',{'offline':False,'latency':40,'downloadThroughput':500_000,'uploadThroughput':500_000})
    t=time.time(); pg.reload(); pg.wait_for_function('window.__D')
    pg.wait_for_function("!document.getElementById('introGo').hidden",timeout=20000); tB=time.time()-t
    chk('enter button appears on a slow road',11.5<tB<15,f'{tB:.1f}s')
    pg.screenshot(path=SP+'/intro_slow.png')
    pg.click('#introGo'); pg.wait_for_function("!document.getElementById('intro')",timeout=3000)
    chk('enter lifts the curtain early',not pg.evaluate('window.__ihArt'))
    pg.wait_for_function('window.__ihArt',timeout=60000)
    chk('art still lands behind the game',pg.evaluate("sprReady('hero_idle')"))
    chk('no page errors (slow)',not errs,errs)
    # 4. the art file missing: the curtain says so and lifts
    cdp.send('Network.emulateNetworkConditions',{'offline':False,'latency':0,'downloadThroughput':-1,'uploadThroughput':-1})
    pg.evaluate("caches.delete('ih-art')")
    pg.route('**/art.js*',lambda r:r.abort())
    pg.reload(); pg.wait_for_function('window.__D')
    pg.wait_for_function("!document.getElementById('intro')",timeout=15000)
    chk('missing art: curtain lifts, log tells',pg.evaluate("G.artFail===true&&[...document.querySelectorAll('#log div')].some(d=>/did not arrive/.test(d.textContent))"))
    chk('no page errors (fail)',not errs,errs)
    pg.unroute('**/art.js*')
    b.close()
print('FAILS',fails); sys.exit(1 if fails else 0)
