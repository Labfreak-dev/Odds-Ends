from playwright.sync_api import sync_playwright
SP='/tmp/claude-0/-home-user-Odds-Ends/6256ba04-1a25-565f-b31b-2b72a8b325ad/scratchpad'
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':420,'height':860},device_scale_factor=2); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://127.0.0.1:8899/dbg6/index.html'); pg.wait_for_function('window.__D'); pg.wait_for_function("!document.getElementById('intro')",timeout=60000)
    pg.evaluate("document.getElementById('modal').className='';coachSet('chest','tap');S.inv=[];S.chests3=1;openChest(3)")
    pg.wait_for_function("document.getElementById('reveal').classList.contains('on')")
    pg.evaluate("()=>{const r=G.rv;for(const t of r.timers)clearTimeout(t);}")   # freeze the phases
    for cls in ['on','on glow','on glow show']:
        pg.evaluate("(c)=>{document.getElementById('reveal').className=c}",cls); pg.wait_for_timeout(1300)
        st=pg.evaluate("()=>{const r=document.querySelector('#reveal .rays');const cs=getComputedStyle(r);return {op:cs.opacity,mask:(cs.webkitMaskImage||cs.maskImage||'').slice(0,40),bg:cs.backgroundColor,w:cs.width,anim:cs.animationName}}")
        print(cls,st)
        pg.screenshot(path=SP+'/cs2_%d.png'%len(cls))
    print('errs',errs); b.close()
