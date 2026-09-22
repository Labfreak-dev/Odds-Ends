import json,time,sys,base64
from playwright.sync_api import sync_playwright
SP='/tmp/claude-0/-home-user-Odds-Ends/6256ba04-1a25-565f-b31b-2b72a8b325ad/scratchpad'
URL='http://127.0.0.1:8899/dbg6/index.html'
fails=[]
def chk(name,ok,info=''):
    print(('PASS ' if ok else 'FAIL ')+name,info)
    if not ok: fails.append(name)
def prep(name,age_h):
    sv=json.loads(base64.b64decode(open(SP+'/'+name).read()).decode())
    sv['S']['last']=int(time.time()*1000)-age_h*3600*1000
    return base64.b64encode(json.dumps(sv,separators=(',',':')).encode()).decode()
with sync_playwright() as p:
    b=p.chromium.launch()
    # A. fidelity + speed: the old fixed 0.6 s loop against the new step, 4 h each, three runs
    ctx=b.new_context(); pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.add_init_script("localStorage.setItem('ironhold_idle_v1',%s)"%json.dumps(prep('asc_1_9.txt',0)))
    pg.goto(URL,wait_until='commit'); pg.wait_for_function('window.__D',timeout=120000); pg.wait_for_function('window.__ihArt',timeout=60000)
    snap=pg.evaluate("D=>JSON.stringify({S:S})")  # not used; we reload between runs instead
    res={'old':[], 'new':[]}
    for mode in ['old','new','old','new','old','new']:
        pg.reload(wait_until='commit'); pg.wait_for_function('window.__D',timeout=120000)
        r=pg.evaluate("""(mode)=>{const H=4*3600;const b={k:S.totalKills,g:S.gold,x:Object.values(S.xp).reduce((a,c)=>a+c,0),d:S.deaths||0,inv:S.inv.length,ch:S.chests};
          const t0=performance.now();let n=0;
          if(mode==='old'){G.sim=true;const HH=H*coachSpeed();const t00=Date.now()-HH*1000;try{for(let t=0;t<HH;t+=0.6){G.simNow=t00+t*1000;tick(0.6);n++;}}finally{G.sim=false;G.simNow=0;}}
          else{S.last=Date.now()-H*1000;const d=offline(true,true);n=d?Math.round(d.t):-1;G.away=null;}
          const ms=performance.now()-t0;
          return {ms:Math.round(ms),n,k:S.totalKills-b.k,g:Math.round(S.gold-b.g),x:Math.round(Object.values(S.xp).reduce((a,c)=>a+c,0)-b.x),d:(S.deaths||0)-b.d,inv:S.inv.length-b.inv,ch:S.chests-b.ch,spd:coachSpeed()};}""",mode)
        res[mode].append(r); print(mode,r)
    def avg(k,m): return sum(r[k] for r in res[m])/len(res[m])
    print('avg old kills %.0f new %.0f | gold %.0f / %.0f | xp %.0f / %.0f | deaths %.1f / %.1f | ms %.0f / %.0f'%(avg('k','old'),avg('k','new'),avg('g','old'),avg('g','new'),avg('x','old'),avg('x','new'),avg('d','old'),avg('d','new'),avg('ms','old'),avg('ms','new')))
    chk('new step keeps the kill rate within 12%',abs(avg('k','new')-avg('k','old'))<=0.12*avg('k','old'))
    chk('new step keeps the gold within 12%',abs(avg('g','new')-avg('g','old'))<=0.12*avg('g','old'))
    chk('catch-up at least 1.7x faster per hour',avg('ms','new')*1.7<avg('ms','old'),'%.0f -> %.0f ms'%(avg('ms','old'),avg('ms','new')))
    chk('no page errors (fidelity)',not errs,errs[:2]); ctx.close()
    # B. a 24 h boot: sliced, visible on the curtain, report after, S.last walks forward
    ctx=b.new_context(viewport={'width':420,'height':860}); pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.add_init_script("localStorage.setItem('ironhold_idle_v1',%s)"%json.dumps(prep('asc_1_9.txt',30)))
    t=time.time(); pg.goto(URL,wait_until='commit'); pg.wait_for_function('window.__D',timeout=60000); tD=time.time()-t
    chk('boot returns quickly (no frozen catch-up)',tD<5,'%.1fs'%tD)
    seen=[]; lasts=[]
    while time.time()-t<120:
        r=pg.evaluate("()=>({c:!!G.catch,t:G.catch&&G.catch.t,away:G.catch&&G.catch.away,txt:document.getElementById('introTxt')&&document.getElementById('introTxt').textContent,last:S.last,intro:!!document.getElementById('intro')})")
        seen.append(r['txt']); lasts.append(r['last'])
        if not r['c']: break
        pg.wait_for_timeout(500)
    tC=time.time()-t
    chk('curtain narrates the catch-up',any(x and x.startswith('Catching up') for x in seen),[x for x in seen if x][:3])
    chk('S.last walks forward during the catch-up',len(set(lasts))>2 and lasts==sorted(lasts))
    chk('24 h catch-up done in under 60 s here',tC<60,'%.1fs'%tC)
    pg.wait_for_function("!document.getElementById('intro')",timeout=30000)
    r=pg.evaluate("()=>({modal:document.getElementById('modal').className,title:(document.querySelector('#modal h2')||{}).textContent||'',log:[...document.querySelectorAll('#log div')].map(d=>d.textContent).filter(x=>/While you were away/.test(x)).slice(-1)[0]||'',last:Date.now()-S.last,kills:S.totalKills})")
    chk('the away report opens after the catch-up',r['modal']=='on' and 'away' in r['log'].lower(),{'modal':r['modal'],'log':r['log'][:90]})
    chk('S.last is now',r['last']<5000,r['last'])
    chk('no page errors (boot)',not errs,errs[:2])
    # C. the live fight ticks after the catch-up
    pg.evaluate("document.getElementById('modal').className=''"); k0=pg.evaluate('[G.swings||0,Math.round(G.mobHp)]'); pg.wait_for_timeout(6000)
    k1=pg.evaluate('[G.swings||0,Math.round(G.mobHp)]'); chk('the blade swings after the catch-up',k1[0]>k0[0],(k0,k1))
    ctx.close(); b.close()
print('FAILS',fails); sys.exit(1 if fails else 0)
