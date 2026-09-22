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
    b=p.chromium.launch()
    # ---- the nemesis, from the realm-9 save
    ctx=b.new_context(); pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.add_init_script("localStorage.setItem('ironhold_idle_v1',%s)"%json.dumps(prep('asc_1_9.txt')))
    pg.goto(URL,wait_until='commit'); pg.wait_for_function('window.__D',timeout=120000)
    r=pg.evaluate("""()=>{S.paused=false;for(let i=0;i<4;i++)S.cleared[i]=true;S.area=3;S.nem.slain=false;S.nem.fled=false;S.nem.lvl=0;S.nem.taken=[];spawn('nem');const m=G.mob;
      const pHit=hitChance(playerAtkRoll(),mobDefRoll(m)),mHit=hitChance(mobAtkRoll(m),playerDefRoll()),dr=dmgReduction()/100,mh=mobMaxHit(m)*(1-dr)/maxHp();
      const dps=playerMaxHit()*0.5*0.55/Math.max(0.5,attackDelay());
      return {nem:!!G.nem,n:m.n,lv:m.lv,pHit:+pHit.toFixed(2),mHit:+mHit.toFixed(2),mhFrac:+mh.toFixed(3),hp:m.hp,hpSec:+(m.hp/dps).toFixed(0),spd:m.spd,cl:combatLvl(),maxHp:maxHp(),mobMax:mobMaxHit(m)}}""")
    print('nemesis',r)
    chk('nemesis is the nemesis',r['nem'] and r['lv']>=r['cl']+5)
    chk('you land a little over half the time',0.5<=r['pHit']<=0.6,r['pHit'])
    chk('it lands seven in ten',0.65<=r['mHit']<=0.75,r['mHit'])
    chk('three of its blows would kill you through your armour',0.40<=r['mhFrac']<=0.50,r['mhFrac'])
    chk('its heart takes about 200 s of your blade alone',180<=r['hpSec']<=220,r['hpSec'])
    # the fight itself, simulated to the end
    f=pg.evaluate("""()=>{G.sim=true;let t=0,out='';const hp0=S.hp=maxHp();try{for(;t<600;t+=0.2){tick(0.2);if(G.dead){out='died';break;}if(!G.nem){out='slain';break;}}}finally{G.sim=false;}return {out,t:+t.toFixed(0),mobLeft:G.mob&&G.nem?+(G.mobHp/G.mob.hp).toFixed(2):0,food:foodCount(),deaths:S.deaths}}""")
    print('fight',f)
    chk('the fight resolves one way or the other within ten minutes',f['out'] in ('died','slain'),f)
    # the seventh socket
    r=pg.evaluate("""()=>{S.med=S.med||{sock:{},loose:{}};S.med.wildOpen=false;S.nem.kills=6;S.nem.lvl=0;spawn('nem');nemSlain();const a=!!S.med.wildOpen;
      S.med.wildOpen=false;S.nem.kills=7;uiDefaults();const b=!!S.med.wildOpen;S.med.wildOpen=false;S.nem.kills=3;const txt=jewelCard('wild');return {a,b,txt:/seven nemeses in all \\(3 so far\\)/.test(txt)}}""")
    chk('the seventh slaying opens the socket',r['a'],r)
    chk('a save already past seven opens it at boot',r['b'],r)
    chk('the lock text says seven, with the count',r['txt'],r)
    chk('no page errors (nemesis)',not errs,errs[:3]); ctx.close()
    # ---- the potion belt, from a fresh save
    ctx=b.new_context(viewport={'width':420,'height':860}); pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(URL,wait_until='commit'); pg.wait_for_function('window.__D',timeout=120000); pg.wait_for_function("!document.getElementById('intro')",timeout=60000)
    pg.evaluate("document.getElementById('modal').className='';S.keep.larder=5;S.gold=1e7;for(let i=0;i<FOOD.length;i++)S.food[i]=60;S.belt=[];S.paused=false")
    r=pg.evaluate("()=>({mx:beltMax(),a:brew('bloodmoss'),b:brew('ironbark'),c:brew('wolfsbane'),d:brew('hawkeye'),why:brewWhy(DRAUGHTS.find(x=>x.id==='hawkeye')),n:belt().length,e:pour('ironbark'),f:brew('hawkeye'),n2:belt().length})")
    chk('three slots at Larder 5; a fourth brew says belt full; pour frees the slot',r['mx']==3 and r['a'] and r['b'] and r['c'] and not r['d'] and r['why']=='belt full' and r['e'] and r['f'] and r['n2']==3,r)
    r=pg.evaluate("()=>{S.hp=Math.round(maxHp()*0.2);const h0=S.hp;draughtTick(0.1);return {h0,h1:S.hp,ch:beltEntry('bloodmoss').charges}}")
    chk('Bloodmoss drinks itself below 35%',r['h1']>r['h0'] and r['ch']==2,r)
    r=pg.evaluate("()=>{S.belt=[];brew('quicksilver');brew('nightshade');brew('hawkeye');const d0=attackDelay(),a0=playerAtkRoll();S.area=1;S.cleared[0]=true;spawn(true);const d1=attackDelay(),a1=playerAtkRoll();const hp=G.mobHp;G.sim=true;for(let i=0;i<20;i++)draughtTick(0.1);G.sim=false;return {q:potOn('quicksilver'),h:potOn('hawkeye'),v:G.venomT>0,ratio:+(d1/d0).toFixed(2),acc:+(a1/a0).toFixed(2),bit:+((hp-G.mobHp)/G.mob.hp).toFixed(3)}}")
    chk('boss potions drink on a boss: a fifth faster, +35% accuracy, the venom bites 1%/s',r['q'] and r['h'] and r['v'] and abs(r['ratio']-0.8)<0.02 and abs(r['acc']-1.35)<0.02 and 0.015<=r['bit']<=0.025,r)
    r=pg.evaluate("()=>{S.belt=[];brew('broth');S.hp=maxHp();const m0=maxHp(),h0=S.hp;drink(DRAUGHTS.find(x=>x.id==='broth'));const m1=maxHp(),h1=S.hp;G.pot.broth=0.05;draughtTick(0.1);return {m0,m1,h0,h1,h2:S.hp,m2:maxHp()}}")
    chk("Giant's Broth raises health a fifth and the extra goes first",abs(r['m1']/r['m0']-1.2)<0.03 and r['h1']>r['h0'] and r['h2']<=r['m2'] and r['m2']==r['m0'],r)
    r=pg.evaluate("()=>{S.belt=[];brew('stoneskin');brew('antivenom');G.ward=0;S.hp=Math.round(maxHp()*0.5);G.poisonT=10;G.burnT=5;draughtTick(0.1);return {ward:G.ward,p:G.poisonT,b:G.burnT,av:potOn('antivenom')}}")
    chk('Stoneskin wards below 60%; Antivenom clears poison and burn',r['ward']>0 and r['p']==0 and r['b']==0 and r['av'],r)
    r=pg.evaluate("()=>{S.belt=[];brew('secondwind');G.dead=false;S.hp=0;die();const a={dead:G.dead,hp:S.hp,ch:beltEntry('secondwind').charges};for(let i=0;i<12;i++)draughtKill();return Object.assign(a,{ch2:beltEntry('secondwind').charges,frac:+(a.hp/maxHp()).toFixed(2)})}")
    chk('Second Wind cheats death once and kills do not refill it',not r['dead'] and abs(r['frac']-0.4)<0.02 and r['ch']==0 and r['ch2']==0,r)
    r=pg.evaluate("()=>{S.belt=[];brew('wolfsbane');beltEntry('wolfsbane').charges=0;for(let i=0;i<6;i++)draughtKill();const c=beltEntry('wolfsbane').charges;renderTop();return {c,hud:document.getElementById('hudPotTxt').textContent}}")
    chk('a charge returns every six kills; the orb shows the belt',r['c']==1 and r['hud']=='1/2',r)
    r=pg.evaluate("()=>{openPot();const n=document.querySelectorAll('#modalBox [data-brew]').length,d=document.querySelectorAll('#modalBox [data-pour]').length;document.getElementById('modal').className='';G.modalKind=null;showTab('keep');renderAll();const k=document.querySelectorAll('#tab-keep [data-brew]').length;return {n,d,k}}")
    chk('the potions window and the Larder card list ten brews and the belt',r['n']==10 and r['d']==1 and r['k']==10,r)
    r=pg.evaluate("()=>{S.draught={id:'ironbark',charges:2,kills:1};S.belt=[];beltMigrate();return {b:belt().map(e=>e.id+':'+e.charges).join(','),old:S.draught===undefined}}")
    chk('an old single draught migrates onto the belt',r['b']=='ironbark:2' and r['old'],r)
    r=pg.evaluate("()=>{S.last=Date.now()-3600e3;const d=offline(true,true);G.away=null;return {k:d.kills}}")
    chk('an hour away runs with a belt on',r['k']>0,r)
    chk('no page errors (belt)',not errs,errs[:3]); ctx.close(); b.close()
print('FAILS',fails); sys.exit(1 if fails else 0)
