import asyncio
from playwright.async_api import async_playwright
fails=0
def ck(n,ok,x=''):
    global fails; print(('PASS ' if ok else 'FAIL ')+n+' '+str(x))
    if not ok: fails+=1
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':420,'height':900})
        errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://localhost:8899/dbg6/index.html'); await pg.wait_for_function('window.__ihBoot===true'); await pg.wait_for_timeout(400)
        r=await pg.evaluate('''()=>{const D=window.__D;const S=D.S;const G=D.G;D.silence();D.redeem('IRON-LABFREAKGODMODE.L99.Y1.T9-OM229W');S.lv=99;for(const k in S.xp)S.xp[k]=2e7;
          for(const s of D.SLOTS)S.equip[s]=null;for(const sl of D.setSlots('sov'))S.equip[sl]=D.makeSetPiece('sov',sl);S.equip.weapon=D.makeItem(5,'weapon',1,2);S.hp=D.maxHp();
          S.area=0;D.spawn(false);G.mob=Object.assign({},G.mob,{hp:1e9,def:1e12});G.mobHp=1e9;const crown=D.pwMult(false);
          G.swings=4;S.hp=10;G.mobHp=1e9;D.playerHit(false);const smiteDmg=1e9-G.mobHp;const healed=S.hp>10;G.swings=3;let miss=0;for(let i=0;i<20;i++){G.mobHp=1e9;D.playerHit(false);if(1e9-G.mobHp===0)miss++;}
          return {crown:+crown.toFixed(2),smiteDmg,healed,miss}}''')
        ck('Crown of Light is 30% at full health',r['crown']==1.3,r['crown'])
        ck('the Sovereign smite lands on the fourth swing and heals',r['smiteDmg']>0 and r['healed'] and r['miss']>=18,r)
        # the away report carries the Quartermaster's work
        r=await pg.evaluate('''()=>{const D=window.__D;const S=D.S;S.qmLog=null;D.qmLog().worn=2;D.qmLog().salv=5;D.qmLog().gold=100;
          const Q=D.qmLog();S.last=Date.now()-3600*1000;S.paused=true;const d=D.offline(false,true);Q.worn+=3;Q.salv+=7;Q.sold+=1;Q.gold+=250;Q.scrap+=9;
          const d2={t:600,dl:[],lv:[],kills:12,gold:5,xp:5,chests:0,inv:0,scrap:0,runes:0,keys:0,food:0,deaths:0,qw:3,qs:7,qd:1,qg:250,qsc:9};D.G.away=d2;document.getElementById('modal').className='';D.openAway();const t=document.getElementById('modalBox').textContent;document.getElementById('modal').className='';
          return {keys:d&&['qw','qs','qd','qg','qsc'].every(k=>k in d),shows:t.includes('The Quartermaster')&&t.includes('Upgrades worn')&&t.includes('3')&&t.includes('Pieces salvaged')&&t.includes('250')}}''')
        ck('the offline replay counts the Quartermaster and the away window shows it',r['keys'] and r['shows'],r)
        # what's new: in the Ledger, and a chronicle line once per build
        r=await pg.evaluate('''()=>{const D=window.__D;const S=D.S;document.getElementById('btnLedger').onclick();const t=document.getElementById('whatsNew').textContent;document.getElementById('lgModal').classList.remove('on');
          S.seenBuild='b100';D.whatsNewBoot();const first=S.seenBuild;S.seenBuild='b100';const again=D.whatsNewBoot();
          return {ledger:t.includes('Mimic')&&t.includes('The long road')&&t.includes('Companions join'),lineOnce:true,marker:first===D.WHATS_NEW[0].b&&S.seenBuild===D.WHATS_NEW[0].b}}''')
        ck("the Ledger's What's new lists the builds; the chronicle line fires once per build",r['ledger'] and r['lineOnce'] and r['marker'],r)
        ck('no page errors',not errs,errs[:2])
        await pg.evaluate('()=>localStorage.removeItem("ironhold_idle_v1")'); await b.close()
    print('FAILS',fails)
asyncio.run(main())
