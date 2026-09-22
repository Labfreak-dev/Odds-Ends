import json,time,sys,base64,collections
from playwright.sync_api import sync_playwright
SP='/tmp/claude-0/-home-user-Odds-Ends/6256ba04-1a25-565f-b31b-2b72a8b325ad/scratchpad'
URL='http://127.0.0.1:8899/dbg6/index.html'
def prep(name):
    sv=json.loads(base64.b64decode(open(SP+'/'+name).read()).decode()); sv['S']['last']=int(time.time()*1000)
    return base64.b64encode(json.dumps(sv,separators=(',',':')).encode()).decode()
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(); pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.add_init_script("localStorage.setItem('ironhold_idle_v1',%s)"%json.dumps(prep(sys.argv[1] if len(sys.argv)>1 else 'asc_1_9.txt')))
    for mode in ['0.6','adapt','1.2','0.6','adapt','1.2']:
        pg.goto(URL,wait_until='commit'); pg.wait_for_function('window.__D',timeout=120000)
        r=pg.evaluate("""(mode)=>{const H=6*3600;window.__step0=window.__step0||simStep;
          if(mode==='adapt')simStep=window.__step0;else simStep=()=>+mode;
          const b={k:S.totalKills,g:S.gold,x:Object.values(S.xp).reduce((a,c)=>a+c,0),d:S.deaths||0,sw:G.swings||0,f:S.foodEaten||0,sp:S.specials||0};
          const t0=performance.now();S.last=Date.now()-H*1000/coachSpeed();const d=offline(true,true);G.away=null;const ms=performance.now()-t0;
          return {ms:Math.round(ms),simH:Math.round(d.t/3600),k:S.totalKills-b.k,g:Math.round(S.gold-b.g),x:Math.round(Object.values(S.xp).reduce((a,c)=>a+c,0)-b.x),d:(S.deaths||0)-b.d,sw:(G.swings||0)-b.sw,f:(S.foodEaten||0)-b.f,lvl:combatLvl(),area:AREAS[S.area].n,delay:+attackDelay().toFixed(2),mspd:G.mob&&G.mob.spd};}""",mode)
        print(mode,r)
    print(errs[:2]); b.close()
