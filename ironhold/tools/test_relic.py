import json,time,sys,base64
from playwright.sync_api import sync_playwright
SP='/tmp/claude-0/-home-user-Odds-Ends/6256ba04-1a25-565f-b31b-2b72a8b325ad/scratchpad'
URL='http://127.0.0.1:8899/dbg6/index.html'
fails=[]
def chk(name,ok,info=''):
    print(('PASS ' if ok else 'FAIL ')+name,info)
    if not ok: fails.append(name)
def prep(name):
    sv=json.loads(base64.b64decode(open(SP+'/'+name).read()).decode()); sv['S']['last']=int(time.time()*1000)
    return base64.b64encode(json.dumps(sv,separators=(',',':')).encode()).decode()
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':420,'height':860}); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append('PAGE '+str(e))); pg.on('console',lambda m:errs.append('CON '+m.text[:200]) if m.type=='error' else None)
    pg.goto(URL,wait_until='commit'); pg.wait_for_function('window.__D'); pg.wait_for_function("!document.getElementById('intro')",timeout=60000)
    pg.evaluate("document.getElementById('modal').className=''")
    # 1. a chest falls, the Coach opens it on the spot, the reveal plays
    r=pg.evaluate("()=>{S.inv=[];S.area=1;S.cleared[0]=true;chestFall(1);return {field:!!S.field,coach:coach('chest')}}")
    chk('chest falls on the field, coach opens by default',r['field'] and r['coach']=='open',r)
    pg.wait_for_function("!S.field",timeout=8000)
    pg.wait_for_function("document.getElementById('reveal').classList.contains('on')",timeout=3000)
    pg.wait_for_timeout(700); pg.screenshot(path=SP+'/rv_chest.png')
    st=pg.evaluate("()=>({on:document.getElementById('reveal').className,chest:getComputedStyle(document.querySelector('#reveal .chest')).display})")
    chk('the chest shows and glows before the piece','glow' in st['on'] and 'show' not in st['on'] and st['chest']!='none',st)
    pg.wait_for_function("document.getElementById('reveal').classList.contains('show')",timeout=3000); pg.wait_for_timeout(500); pg.screenshot(path=SP+'/rv_item.png')
    r=pg.evaluate("()=>({name:document.getElementById('rvName').textContent,kind:document.getElementById('rvKind').textContent,src:document.getElementById('rvSrc').textContent,inv:S.inv.length,rar:S.inv[0]&&S.inv[0].rar,pity:S.pity&&S.pity[1],hold:G.holdT||0})")
    chk('the piece shows with kind and source; pack has it; the floor is Superior',r['inv']==1 and r['rar']>=3 and r['src'].startswith('From a chest') and r['name'],r)
    pg.wait_for_function("!document.getElementById('reveal').classList.contains('on')",timeout=6000)
    chk('a plain chest reveal closes by itself',True)
    # 2. tap mode: the chest waits for a tap on the field
    pg.evaluate("()=>{coachSet('chest','tap');chestFall(1);}")
    pg.wait_for_timeout(3200)
    chk('in tap mode the chest waits',pg.evaluate("!!S.field"))
    box=pg.evaluate("()=>{const r=document.getElementById('scene').getBoundingClientRect();return {x:r.left+276*r.width/500,y:r.top+(230*0.72-24)*r.height/230}}")
    pg.mouse.click(box['x'],box['y'])
    chk('a tap on the chest opens it',pg.evaluate("!S.field&&S.inv.length===2"))
    pg.evaluate("revealEnd()")
    # 3. left alone, it goes to the Vault after 25 s (ticks driven by hand)
    pg.evaluate("()=>{S.chests=0;chestFall(1);G.sim=false;for(let i=0;i<300;i++)tick(0.1);}")
    chk('an untouched chest is stowed in the Vault after twenty-five seconds',pg.evaluate("!S.field&&S.chests===1"))
    # 4. stow mode goes straight to the Vault
    pg.evaluate("()=>{coachSet('chest','stow');chestFall(1);}")
    chk('stow mode sends it to the Vault at once',pg.evaluate("!S.field&&S.chests===2"))
    pg.evaluate("coachSet('chest','open')")
    # 5. a relic from a kill: the reveal, the source line, the two-second hold
    pg.evaluate("()=>{revealEnd();RV_Q.length=0;S.inv=[];G.swings=0;gainItem(makeUnique('goblin_poker'));}")
    pg.wait_for_function("document.getElementById('reveal').classList.contains('show')",timeout=3000)
    pg.wait_for_timeout(300); pg.screenshot(path=SP+'/rv_relic.png')
    r=pg.evaluate("()=>({kind:document.getElementById('rvKind').textContent,name:document.getElementById('rvName').textContent,fl:document.getElementById('rvFl').textContent,src:document.getElementById('rvSrc').textContent,hold:G.holdT,log:[...document.querySelectorAll('#log div')].map(d=>d.textContent).filter(x=>/^Relic:/.test(x)).slice(-1)[0]||''})")
    chk('a unique from a kill reveals with flavor and source, and holds the fight',r['kind']=='Unique' and 'Goblin Poker' in r['name'] and r['fl'] and r['src'].startswith('From a ') and r['hold']>0.5,r)
    sw=pg.evaluate("()=>{G.holdT=2;const s0=G.swings;G.pT=0;for(let i=0;i<15;i++)tick(0.1);return [G.swings-s0,G.holdT];}")
    chk('no blows land during the hold',sw[0]==0 and sw[1]<1,sw)
    chk('the chronicle keeps where it came from','from' in r['log'],r['log'][:100])
    pg.evaluate("revealEnd()")
    # 6. pity: the fortieth plain chest is a relic
    r=pg.evaluate("()=>{S.inv=[];S.pity={1:39};S.chests=1;openChest(1);revealEnd();RV_Q.length=0;return {sp:isSpecial(S.inv[0]),pity:S.pity[1],tip:chestPityText(1)}}")
    chk('the lock remembers: the cap forces a relic and resets',r['sp'] and r['pity']==0,r)
    # 7. the floor: two hundred plain chests, none below Superior
    r=pg.evaluate("()=>{let lo=0;for(let i=0;i<200;i++){const it=chestRoll0(1,1);if(!isSpecial(it)&&it.rar<3)lo++;}return lo}")
    chk('no plain chest gives less than Superior',r==0,r)
    # 8. the hoard
    r=pg.evaluate("()=>{S.inv=[];S.chests=32583;S.chests2=0;S.chests3=0;S.hoardEaten=0;const g=S.gold;RV_Q.length=0;hoardEat();return {c:S.chests,b:S.chests2,g3:S.chests3,gold:S.gold-g,q:RV_Q.length,log:[...document.querySelectorAll('#log div')].map(d=>d.textContent).filter(x=>/Mimic wakes/.test(x)).length}}")
    chk('the Mimic eats the hoard: 30 kept, 20 banded, 8 gilded, gold, one relic',r['c']==30 and r['b']==20 and r['g3']==8 and r['gold']>0 and r['q']==1 and r['log']==1,r)
    chk('no page errors',not errs,errs[:3])
    ctx.close()
    # 9. the rate: two hours of fighting in two very different areas
    for name,label in [(None,'fresh, Goblin Village'),('asc_1_9.txt','realm 9, Giant Hills')]:
        ctx=b.new_context(); pg=ctx.new_page(); e2=[]; pg.on('pageerror',lambda e:e2.append(str(e)))
        if name: pg.add_init_script("localStorage.setItem('ironhold_idle_v1',%s)"%json.dumps(prep(name)))
        pg.goto(URL,wait_until='commit'); pg.wait_for_function('window.__D',timeout=120000)
        r=pg.evaluate("""()=>{if(S.asc.realm===0){S.area=1;S.cleared[0]=true;}const c0=(S.chests||0)+(S.chests2||0);S.last=Date.now()-4*3600e3/coachSpeed();const d=offline(true,true);G.away=null;return {chests:(S.chests||0)+(S.chests2||0)-c0,h:d.t/3600,kills:d.kills,area:AREAS[S.area].n}}""")
        print(label,r)
        chk('about a chest a quarter-hour in '+label,3<=r['chests']/r['h']<=12,'%.1f per hour'%(r['chests']/r['h']))
        chk('no page errors (rate)',not e2,e2[:2]); ctx.close()
    b.close()
print('FAILS',fails); sys.exit(1 if fails else 0)
