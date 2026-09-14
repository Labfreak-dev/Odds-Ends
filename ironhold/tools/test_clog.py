import asyncio
from playwright.async_api import async_playwright
URL='http://localhost:8899/dbg6/index.html'
fails=0
def ck(name,ok,extra=''):
    global fails; print(('PASS ' if ok else 'FAIL ')+name+(' '+str(extra) if extra else ''))
    if not ok: fails+=1
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':420,'height':900},device_scale_factor=2)
        errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto(URL); await pg.wait_for_function('window.__ihBoot===true'); await pg.wait_for_timeout(500)
        # layout: the name sits above the row, the log button sits where the name was, between the map and pause buttons
        r=await pg.evaluate('''()=>{const R=id=>document.getElementById(id).getBoundingClientRect();const n=R('areaName'),c=R('btnClog'),m=R('btnMap'),pz=R('btnPause');return {nameAbove:n.bottom<=c.top+1,between:m.right<=c.left+1&&c.right<=pz.left+1,nameWide:n.width>c.width*1.5,text:document.getElementById('areaName').textContent,hidden:document.getElementById('clog').hidden}}''')
        ck('the realm name rises above the row; the Combat log button sits between the map and pause buttons; the panel starts folded',r['nameAbove'] and r['between'] and r['nameWide'] and r['text'].startswith('Cow Pasture') and r['hidden'],r)
        # fight: a warlock in the Ashborn set with a cleric and the war hound, eating and leeching, taking blows and poison
        r=await pg.evaluate('''()=>{const D=window.__D;D.silence();const S=D.S;const G=D.G;D.redeem('IRON-LABFREAKGODMODE.L99.Y1.T9-OM229W');S.clog=null;if(S.med){S.med.sock={};}
          for(const s of D.SLOTS)S.equip[s]=null;for(const sl of D.setSlots('ash'))S.equip[sl]=D.makeSetPiece('ash',sl);S.equip.weapon=D.makeItem(5,'weapon',1,2);S.equip.weapon.aff={leech:6};
          S.party=[];S.gold=1e7;D.hireComp('hound');D.hireComp('cleric');S.party.forEach(c=>c.field=true);S.food=S.food.map(()=>50);S.autoEat=true;S.eatPct=90;
          S.area=3;S.cleared=D.AREAS.map(()=>true);S.paused=false;G.tower=0;D.spawn(false);S.hp=D.maxHp();
          G.sim=true;for(let t=0;t<600;t+=0.1){D.tick(0.1);if(G.dead){G.dead=false;S.hp=D.maxHp();}if(t%50<0.1){S.spec=100;D.special();}if(t%97<0.1){G.poisonT=3;}}G.sim=false;S.paused=true;
          S.party.forEach(c=>c.field=c.type==='cleric');S.hp=1;for(let i=0;i<5;i++)D.compTick();S.party.forEach(c=>c.field=c.type==='hound');
          const c=D.cl();return {t:c.t,hits:c.hits,misses:c.misses,best:c.best,dealt:Object.keys(c.dealt),el:Object.keys(c.el),mobs:Object.entries(c.mobs).map(([n,r])=>[n,r.k>0,r.d>0,r.t>=0]),heal:Object.keys(c.heal),taken:Object.keys(c.taken),fire:c.el.fire>0,burnD:c.dealt.dot_burn>0,comp:c.dealt.comp_hound>0&&c.heal.comp_cleric>0}}''')
        ck('ten minutes of fighting fill the tally: blows, specials, burning, hound and cleric, fire as the element, leech and food, blows and poison taken, every monster met with kills',r['t']>500 and r['hits']>50 and r['best']>0 and all(k in r['dealt'] for k in ['hit','spec','dot_burn','comp_hound']) and r['fire'] and r['burnD'] and r['comp'] and 'leech' in r['heal'] and 'food' in r['heal'] and 'comp_cleric' in r['heal'] and 'hit' in r['taken'] and 'poison' in r['taken'] and len(r['mobs'])>=2 and sum(1 for m in r['mobs'] if m[1])>=2,{k:v for k,v in r.items() if k!='mobs'} | {'mobs':len(r['mobs'])})
        # the panel: opens on the button, names every section and every source, the DPS lines, and folds again; reset empties it
        r=await pg.evaluate('''()=>{const D=window.__D;document.getElementById('btnClog').click();const el=document.getElementById('clog');const t=el.textContent;const open=!el.hidden&&document.getElementById('btnClog').classList.contains('on');
          const want=['This realm','Damage a second, now','Best minute','Damage by source','Your blows','Specials','Burning','War hound','Damage by element','Fire','Against the realm','slain','Healing','Lifesteal','Food','Cleric','Damage taken','Blows','Poison','Soaked by wards','Reset the realm log'];const miss=want.filter(w=>!t.includes(w));
          document.getElementById('clReset').click();const after=D.cl();const empty=after.hits===0&&Object.keys(after.dealt).length===0&&document.getElementById('clog').textContent.includes('This realm');
          document.getElementById('btnClog').click();return {open,miss,empty,folded:document.getElementById('clog').hidden,saved:D.S.showClog===false}}''')
        ck('the panel opens on its button with every section and source named, resets to empty, and folds on a second press',r['open'] and not r['miss'] and r['empty'] and r['folded'] and r['saved'],r)
        # ascension clears it
        r=await pg.evaluate('''()=>{const D=window.__D;const S=D.S;D.clAdd('dealt','hit',500);S.asc=S.asc||{};S.asc.shards=S.asc.shards||0;S.asc.realm=S.asc.realm||0;S.asc.count=S.asc.count||0;let ok;try{ok=D.ascend([],[]);}catch(e){ok=String(e);}return [ok,D.cl().dealt.hit||0]}''')
        ck('ascension starts a fresh log',r[0]==True and r[1]==0,r)
        # a screenshot with the panel open after a short fight
        await pg.evaluate('''()=>{const D=window.__D;const S=D.S;const G=D.G;S.clog=null;S.area=3;S.paused=false;G.tower=0;D.spawn(false);S.hp=D.maxHp();G.sim=true;for(let t=0;t<180;t+=0.1){D.tick(0.1);if(G.dead){G.dead=false;S.hp=D.maxHp();}if(t%40<0.1){S.spec=100;D.special();}}G.sim=false;S.paused=true;S.showClog=true;D.applyClog();document.getElementById('clog').dataset.t=0;D.renderClog();D.showTab('hero');window.scrollTo(0,0);}''')
        await pg.wait_for_timeout(300); await pg.screenshot(path='/tmp/clog_shot.png',clip={'x':0,'y':60,'width':420,'height':560})
        ck('no page errors',not errs,errs[:2])
        await pg.evaluate('()=>localStorage.removeItem("ironhold_idle_v1")'); await b.close()
    print('FAILS',fails)
asyncio.run(main())
