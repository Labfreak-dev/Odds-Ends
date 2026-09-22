import sys
from playwright.sync_api import sync_playwright
SP='/tmp/claude-0/-home-user-Odds-Ends/6256ba04-1a25-565f-b31b-2b72a8b325ad/scratchpad'
fails=[]
with sync_playwright() as p:
    b=p.chromium.launch()
    for w in (360,420,600):
        pg=b.new_page(viewport={'width':w,'height':860},device_scale_factor=2)
        pg.goto('http://127.0.0.1:8899/dbg6/index.html'); pg.wait_for_function('window.__D'); pg.wait_for_function("!document.getElementById('intro')",timeout=60000)
        pg.evaluate("document.getElementById('modal').className='';S.cleared=AREAS.map(()=>true);S.dyn=S.dyn||{};S.dyn.rank=2;S.asc.realm=15;showTab('world');renderAll()")
        pg.wait_for_timeout(300)
        r=pg.evaluate("""()=>[...document.querySelectorAll('#diffs button')].map(b=>{const cs=getComputedStyle(b);const bw=parseFloat(cs.borderLeftWidth)+parseFloat(cs.borderRightWidth),pd=parseFloat(cs.paddingLeft)+parseFloat(cs.paddingRight);
          const rng=document.createRange();rng.selectNodeContents(b);const tw=rng.getBoundingClientRect().width;const inner=b.clientWidth-pd;const br=b.getBoundingClientRect(),tr=rng.getBoundingClientRect();
          return {t:b.textContent,fits:tw<=inner+0.5,off:Math.round((tr.left+tr.right)/2-(br.left+br.right)/2)}})""")
        bad=[x for x in r if not x['fits'] or abs(x['off'])>2]
        print(w,'px:',[(x['t'],x['fits'],x['off']) for x in r])
        if bad: fails.append((w,bad))
        el=pg.query_selector('#diffs'); el.screenshot(path=SP+'/diffs_%d.png'%w)
        pg.close()
    b.close()
print('FAILS',fails); sys.exit(1 if fails else 0)
