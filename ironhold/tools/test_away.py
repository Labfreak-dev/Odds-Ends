import asyncio,json
from playwright.async_api import async_playwright
URL='http://localhost:8899/dbg6/index.html'
fails=0
def ck(name,ok,extra=''):
    global fails
    print(('PASS ' if ok else 'FAIL ')+name+(' '+str(extra) if extra else ''))
    if not ok: fails+=1
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':420,'height':860})
        errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto(URL); await pg.wait_for_function('window.__ihBoot===true'); await pg.wait_for_timeout(400)
        # 1. seed a save that was last seen 3h ago, reload: the modal tells the tale
        # closing or leaving the page saves with a fresh clock (that is right: away starts at close), so seed storage from a blank page on the same origin
        async def seed(js):
            code=await pg.evaluate(js)
            await pg.goto('http://localhost:8899/dbg6/blank.txt'); await pg.evaluate('(c)=>localStorage.setItem("ironhold_idle_v1",c)',code)
            await pg.goto(URL); await pg.wait_for_function('window.__ihBoot===true'); await pg.wait_for_timeout(900)
        await seed('''()=>{const D=window.__D;D.S.last=Date.now()-3*3600e3;return D.serialize();}''')
        r=await pg.evaluate('''()=>{const D=window.__D;const m=document.getElementById('modal');return {on:m.className,kind:D.G.modalKind,h2:(document.querySelector('#modalBox h2')||{}).textContent,txt:document.getElementById('modalBox').textContent.slice(0,400),kills:D.S.totalKills,log:document.getElementById('log').firstChild.textContent}}''')
        ck('boot after 3h opens the away window',r['on']=='on' and r['kind']=='away' and r['h2']=='While you were away',r['h2'])
        ck('it lists kills, gold, experience and levels',all(w in r['txt'] for w in ['Kills','Gold','Experience','Levels']) and r['kills']>100,r['txt'][:200])
        ck('the chronicle carries the same line with levels',r['log'].startswith('While you were away 3h 0m') and '→' in r['log'],r['log'])
        await pg.click('#mClose'); await pg.wait_for_timeout(200)
        r=await pg.evaluate('()=>[document.getElementById("modal").className,window.__D.G.away]')
        ck('Onward closes it and clears the tale',r==['',None],r)
        # 2. a paused save just waits
        await seed('''()=>{const D=window.__D;D.S.paused=true;D.S.last=Date.now()-3600e3;return D.serialize();}''')
        r=await pg.evaluate('''()=>{const D=window.__D;return [D.G.modalKind,document.getElementById('modalBox').textContent.includes('paused'),document.getElementById('log').firstChild.textContent]}''')
        ck('paused save: the blade waited, and the window says so',r[0]=='away' and r[1] and 'paused' in r[2],r)
        await pg.click('#mClose'); await pg.evaluate('()=>{window.__D.S.paused=false;}')
        # 3. the cap: 30h away counts eight and says so
        r=await pg.evaluate('''()=>{const D=window.__D;D.S.last=Date.now()-30*3600e3;const d=D.offline();D.G.away=null;return [Math.round(d.t/3600),d.capped]}''')
        ck('thirty hours away counts as eight, flagged',r==[8,True],r)
        # 4. the tab coming back: quiet catch-up, a chronicle line, no modal
        r=await pg.evaluate('''async()=>{const D=window.__D;D.S.last=Date.now()-600e3;const k=D.S.totalKills;
           Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));
           return [D.S.totalKills-k,[...document.querySelectorAll('#log div')].map(d=>d.textContent).find(t=>t.startsWith('While you were away'))||'',document.getElementById('modal').className,D.G.away,Date.now()-D.S.last<2000]}''')
        ck('tab back after ten minutes: kills counted, chronicle line, no window, clock reset',r[0]>0 and r[1].startswith('While you were away 10m') and r[2]=='' and r[3] is None and r[4],r)
        r=await pg.evaluate('''()=>{const D=window.__D;const k=D.S.totalKills;document.dispatchEvent(new Event('visibilitychange'));return D.S.totalKills-k}''')
        ck('a second visibility event inside 30 s does nothing',r==0,r)
        # 5. an away window yields to a trial offer already open
        r=await pg.evaluate('''()=>{const D=window.__D;D.G.away={t:100,kills:1,gold:1,xp:1,lv:[],chests:0,inv:0,scrap:0,food:0,deaths:0,runes:0,keys:0};document.getElementById('modal').className='on';D.G.modalKind='trial';D.openAway();const r=[D.G.modalKind,D.G.away];document.getElementById('modal').className='';D.G.modalKind=null;return r}''')
        ck('another open window keeps the floor',r[0]=='trial' and r[1] is None,r)
        ck('no page errors',not errs,errs)
        await pg.evaluate('()=>localStorage.removeItem("ironhold_idle_v1")')
        await b.close()
asyncio.run(main()); print('FAILS',fails); raise SystemExit(1 if fails else 0)
