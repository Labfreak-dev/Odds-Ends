import asyncio
from playwright.async_api import async_playwright
URL='http://localhost:8899/dbg6/index.html'
fails=0
def ck(name,ok,extra=''):
    global fails; print(('PASS ' if ok else 'FAIL ')+name+(' '+str(extra) if extra else ''))
    if not ok: fails+=1
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':420,'height':900})
        errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto(URL); await pg.wait_for_function('window.__ihBoot===true'); await pg.wait_for_timeout(500)
        await pg.evaluate('''()=>{const D=window.__D;D.silence();const S=D.S;S.paused=true;D.redeem('IRON-LABFREAKGODMODE.L99.Y1.T9-OM229W');S.cleared=D.AREAS.map(()=>true);S.gold=1e6;S.hp=D.maxHp();}''')
        # 1. the five menu beakers exist, faint, one per host, and clicking claims each
        r=await pg.evaluate('''()=>{const D=window.__D;const out={};
          for(const tab of ['vault','skills','world','keep']){D.showTab(tab);D.renderAll();}
          document.getElementById('btnLedger').onclick();D.renderAll();
          for(const B of D.LAB_BEAKERS){if(!B.host)continue;const host=document.getElementById(B.host);const e=host&&host.querySelector('.labBk[data-lab="'+B.id+'"]');out[B.id]=e?[+getComputedStyle(e).opacity<(B.big?1:0.7),getComputedStyle(host).position!=='static']:null;}
          document.getElementById('lgModal').classList.remove('on');return out}''')
        ck('five beakers planted in the Ledger, Barracks, Bestiary, Feats and Map, faint and positioned',all(v and all(v) for v in r.values()) and len(r)==5,r)
        r=await pg.evaluate('''()=>{const D=window.__D;let n=0;for(const B of D.LAB_BEAKERS){if(!B.host)continue;const e=document.getElementById(B.host).querySelector('.labBk[data-lab="'+B.id+'"]');e.click();n++;}
          const gone=D.LAB_BEAKERS.filter(B=>B.host).every(B=>!document.getElementById(B.host).querySelector('.labBk[data-lab="'+B.id+'"]'));return [n,D.labCount(),gone,D.labFind('ledger')]}''')
        ck('clicking each claims it once; claimed beakers vanish; a second claim is refused',r==[5,5,True,False],r)
        # 2. the painted beakers: a tap on the scene where they sit, in the right area only
        r=await pg.evaluate('''()=>{const D=window.__D;const cv=document.getElementById('scene');const rect=cv.getBoundingClientRect();
          const tap=(x,y)=>cv.dispatchEvent(new PointerEvent('pointerdown',{clientX:rect.left+x*rect.width/D.VW,clientY:rect.top+y*rect.height/D.VH,bubbles:true}));
          const B2=D.LAB_BEAKERS.find(b=>b.id==='sewer'),B5=D.LAB_BEAKERS.find(b=>b.id==='pass');
          D.S.area=0;tap(B2.x,B2.y);const wrongArea=D.labCount();D.S.area=2;tap(B2.x+120,B2.y);const miss=D.labCount();tap(B2.x+4,B2.y-3);const hit=D.labCount();
          D.S.area=5;tap(B5.x,B5.y);const hit2=D.labCount();return [wrongArea,miss,hit,hit2]}''')
        ck('the Sewer beaker only answers a tap in the Sewer and near it; the Frozen Pass beaker likewise',r==[5,5,6,7],r)
        # 3. the chest: one in a thousand
        r=await pg.evaluate('''()=>{const D=window.__D;const S=D.S;S.chests=5000;S.inv=[];const rnd=Math.random;let opened=0;Math.random=()=>0.9;for(let i=0;i<20;i++){S.inv=[];D.openChest();opened++;}const notYet=D.labCount();
          Math.random=()=>0.0005;S.inv=[];D.openChest();Math.random=rnd;return [notYet,D.labCount(),D.labActive(),!!S.lab.unlocked]}''')
        ck('the chest beaker needs the thousandth roll; the eighth beaker opens the laboratory',r==[7,8,True,True],r)
        # 4. the pasture's boss is now Labfreak, in a laboratory; his beakers alternate poison and fire
        r=await pg.evaluate('''()=>{const D=window.__D;const S=D.S;const G=D.G;S.area=0;G.tower=0;D.spawn(true);const m=G.mob;const o={n:m.n,lab:!!m.lab,hpOk:m.hp>=150,lv:m.lv};
          G.mob.atk=1e6;G.mob.str=60;S.hp=D.maxHp();G.poisonT=0;G.burnT=0;G.labN=0;for(let i=0;i<20&&!G.poisonT;i++)D.mobHit();o.first=[G.poisonT,G.burnT||0];for(let i=0;i<20&&!G.burnT;i++)D.mobHit();o.second=[G.poisonT,G.burnT||0];
          S.area=1;D.spawn(true);o.other=G.mob.n;S.area=0;D.spawn(false);o.trash=!G.mob.lab;
          let ok=true;try{D.drawScene(1.0,0.016);}catch(e){ok=String(e);}o.draw=ok;return o}''')
        ck('Labfreak stands in for the bull in the pasture only; green then red beakers; the laboratory draws',r['n']=='Labfreak' and r['lab'] and r['hpOk'] and r['first'][0]==8 and r['first'][1]==0 and r['second'][1]==6 and r['other']!='Labfreak' and r['trash'] and r['draw']==True,r)
        # 5. the kill: a companion the first time, a strongbox after; he can be hired and throws beakers
        r=await pg.evaluate('''()=>{const D=window.__D;const S=D.S;const G=D.G;S.compFound={};S.area=0;D.spawn(true);G.mobHp=1;D.playerHit(true,{sure:1,mult:1});const o={found:!!(S.compFound&&S.compFound.labfreak),kills:S.lab.kills,unlocked:D.compUnlocked('labfreak'),lock:D.compLockText('labfreak')};
          S.chests=0;D.spawn(true);G.mobHp=1;D.playerHit(true,{sure:1,mult:1});o.chestEarly=S.chests;o.kills2=S.lab.kills;for(let i=0;i<4;i++){D.spawn(true);G.mobHp=1;D.playerHit(true,{sure:1,mult:1});}o.chest=S.chests;o.kills6=S.lab.kills;
          S.party=[];S.gold=1e6;o.hired=D.hireComp('labfreak');const c=S.party.find(x=>x.type==='labfreak');if(c)c.field=true;
          S.area=3;D.spawn(false);G.mob=Object.assign({},G.mob,{hp:1e9,def:0});G.mobHp=1e9;G.dot=null;let p=0,bn=0;for(let i=0;i<40;i++){D.compTick();if(G.dot&&G.dot.poison)p=Math.max(p,G.dot.poison.st);if(G.dot&&G.dot.burn)bn=G.dot.burn.pct;}o.poisonSt=p;o.burn=bn;
          D.showTab('keep');D.renderAll();o.barracks=document.getElementById('barracks').textContent.includes('Labfreak');
          D.showTab('vault');D.goRoom('vault','Collection');D.renderAll();o.best=document.getElementById('bestiary').textContent;return o}''')
        ck('first kill hands over the Labfreak companion, later kills a strongbox; hired, he poisons and burns by turns; the Barracks and Bestiary say so',r['found'] and r['kills']==1 and r['unlocked'] and 'Labfreak' in r['lock'] and r['chestEarly']==0 and r['chest']==1 and r['kills2']==2 and r['kills6']==6 and r['hired'] and r['poisonSt']>=2 and r['burn']==6 and r['barracks'] and 'Strange glassware' in r['best'] and '8/8' in r['best'] and 'slain ×6' in r['best'],{k:v for k,v in r.items() if k!='best'})
        # 6. ascension closes the laboratory and the hunt begins again; the companion stays
        r=await pg.evaluate('''()=>{const D=window.__D;const S=D.S;S.asc=S.asc||{};S.asc.shards=S.asc.shards||0;S.asc.realm=S.asc.realm||0;S.asc.count=S.asc.count||0;const before=D.labActive();let ok;try{ok=D.ascend([],[]);}catch(e){ok=String(e);}
          return {before,ok,after:D.labActive(),found:D.labCount(),runs:S.lab.runs,kills:S.lab.kills,comp:!!(S.compFound&&S.compFound.labfreak)}}''')
        ck('ascension closes the laboratory, keeps the count of runs and kills, and keeps the companion',r['before'] and r['ok']==True and not r['after'] and r['found']==0 and r['runs']==1 and r['kills']==6 and r['comp'],r)
        ck('no page errors',not errs,errs[:2])
        await pg.evaluate('()=>localStorage.removeItem("ironhold_idle_v1")'); await b.close()
    print('FAILS',fails)
asyncio.run(main())
