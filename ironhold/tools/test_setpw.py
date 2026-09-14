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
        await pg.evaluate('''()=>{const D=window.__D;D.silence();const S=D.S;S.paused=true;S.lv=99;for(const k in S.xp)S.xp[k]=2e7;S.hp=D.maxHp();window.wear=(k,wt)=>{for(const s of D.SLOTS)S.equip[s]=null;for(const sl of D.setSlots(k))S.equip[sl]=D.makeSetPiece(k,sl);S.equip.weapon=D.makeItem(5,'weapon',1,wt==null?2:wt);S.hp=D.maxHp();};
          window.mob=(shape)=>{D.G.gob=null;D.G.tower=0;D.spawn(false);D.G.mob=Object.assign({},D.G.mob,{shape:shape||D.G.mob.shape,hp:1e9,def:1,spd:3});D.G.mobHp=1e9;D.G.dot=null;D.G.chillT=0;D.G.curseT=0;D.G.rage=0;D.G.still=false;D.G.ward=0;};}''')
        # every set wakes its power at the full set and nothing else
        r=await pg.evaluate('''()=>{const D=window.__D;const out={};for(const k in D.SETS){wear(k);const pw=D.setPowers();const n=D.setSlots(k).length;
          S.equip[D.setSlots(k)[0]]=null;const pw1=D.setPowers();out[k]=[pw.length===1&&pw[0]===k,pw1.length===0,!!D.SET_POWERS[k]];}return out}''')
        bad=[k for k,v in r.items() if not all(v)]
        ck('all 29 sets have a power; it wakes at the full set and sleeps a piece short',not bad and len(r)==29,bad or len(r))
        # elements: weakness and resistance
        r=await pg.evaluate('''()=>{const D=window.__D;return [D.elemMult('light',{shape:'undead'}),D.elemMult('poison',{shape:'undead'}),D.elemMult('ice',{shape:'bird'}),Object.keys(D.ELEM_WEAK).length,Object.keys(D.ELEM).every(e=>Object.values(D.ELEM_WEAK).includes(e))]}''')
        ck('undead take +30% from light and −25% from poison; every element has a kind that fears it',r[0]==1.3 and r[1]==0.75 and r[2]==1 and r[3]==8 and r[4],r)
        # poison stacks; burn; chill; curse
        r=await pg.evaluate('''()=>{const D=window.__D;const G=D.G;const o={};
          wear('sewer');mob('humanoid');for(let i=0;i<12;i++)D.playerHit(true,{sure:1});o.poison=G.dot&&G.dot.poison&&[G.dot.poison.st,G.dot.poison.pct];
          wear('ash');mob('humanoid');D.playerHit(true,{sure:1});o.burn=G.dot&&G.dot.burn&&G.dot.burn.pct;
          wear('pyre');S.equip.weapon=D.makeUnique('pyre_greatsword');mob('humanoid');D.playerHit(true,{sure:1});o.pyreBurn=G.dot&&G.dot.burn&&G.dot.burn.pct;
          wear('frost');mob('humanoid');D.playerHit(true,{sure:1});o.chill=[G.chillT,G.chillPct];
          wear('set_adept',12);mob('humanoid');const h0=S.hp=Math.round(D.maxHp()/2);D.playerHit(true,{sure:1});o.curse=[G.curseT,S.hp>h0];
          return o}''')
        ck('Sewer Rot stacks to four (10%/s); Cinder burns 8, Hellfire 12; Frostbite chills 25%; Miasma curses and drinks',r['poison']==[4,10] and r['burn']==8 and r['pyreBurn']==12 and r['chill']==[4,25] and r['curse'][0]==6 and r['curse'][1],r)
        # the element multiplies damage: light vs undead vs a plain set
        r=await pg.evaluate('''()=>{const D=window.__D;const G=D.G;const avg=(k,shape,wt)=>{wear(k,wt);mob(shape);let t=0;for(let i=0;i<400;i++){G.mobHp=1e9;D.playerHit(true,{sure:1,mult:1});t+=1e9-G.mobHp;}return t/400;};
          const base=avg('giant','undead'),light=avg('saint','undead'),lightDemon=avg('saint','demon'),lightBeast=avg('saint','beast');
          return {base,light,lightDemon,lightBeast,r1:light/base,r2:lightBeast/base}}''')
        ck('Last Saint hits the dead about 30% harder than a plain set and beasts about the same',1.15<r['r1']<1.45 and 0.85<r['r2']<1.15,{k:round(v,2) for k,v in r.items()})
        # rage climbs and a miss ends it; stillness after a miss; smite every fifth swing heals
        r=await pg.evaluate('''()=>{const D=window.__D;const G=D.G;const o={};
          wear('barb');mob('beast');for(let i=0;i<12;i++)D.playerHit(true,{sure:1});o.rage=G.rage;o.mult=D.pwMult(false);G.mob.def=1e9;D.playerHit(false);o.rageAfterMiss=G.rage;
          wear('tr_silent');mob('beast');G.mob.def=1e12;D.playerHit(false);o.still=G.still;G.mob.def=0;G.swings=1;let hits=0;for(let i=0;i<30;i++){G.still=true;G.mobHp=1e9;D.playerHit(false);if(1e9-G.mobHp>0)hits++;}o.stillHits=hits;
          wear('saint');mob('undead');S.hp=10;G.swings=5;G.mobHp=1e9;D.playerHit(false);o.smiteDmg=1e9-G.mobHp;o.smiteHeal=S.hp>10;
          return o}''')
        ck('Rage climbs to 10 stacks (+30%) and a miss ends it; Stillness makes the swing after a miss sure; Smite lands and heals',r['rage']==10 and abs(r['mult']-1.3)<1e-9 and r['rageAfterMiss']==0 and r['still'] and r['stillHits']>=28 and r['smiteDmg']>0 and r['smiteHeal'],r)
        # extra hits: hail, arcs, flurry, breath, infernal
        r=await pg.evaluate('''()=>{const D=window.__D;const G=D.G;const o={};const count=(k,wt,n,swingStep)=>{wear(k,wt);mob('beast');let x=0;for(let i=0;i<n;i++){G.swings=swingStep?swingStep:i+1;if(D.pwExtra(false))x++;}return x/n;};
          o.hail=count('set_frostranger',6,2000);o.storm=count('set_wyrmhide',6,2000);o.arc=count('set_battlemage',12,2000);o.flurry=count('tr_bare',2,2000);o.breath=count('wyrm',2,2000,6);o.breathOff=count('wyrm',2,200,5);wear('pyre');S.equip.weapon=D.makeUnique('pyre_greatsword');mob('beast');G.swings=5;o.infernal=!!D.pwExtra(false);G.swings=4;o.infernalOff=!D.pwExtra(false);
          wear('set_wyrmhide',6);mob('beast');S.spec=0;let s=0;for(let i=0;i<200;i++){G.mobHp=1e9;D.playerHit(true,{sure:1});}o.stormSpec=S.spec;
          return o}''')
        ck('Hail one in four, Storm Arrows one in four (charging the special), Arc three in ten, Flurry three in ten, Breath every sixth, Infernal every fifth',0.2<r['hail']<0.3 and 0.2<r['storm']<0.3 and 0.25<r['arc']<0.35 and 0.25<r['flurry']<0.35 and r['breath']==1 and r['breathOff']==0 and r['infernal'] and r['infernalOff'] and r['stormSpec']>0,{k:(round(v,3) if isinstance(v,float) else v) for k,v in r.items()})
        # the foe's blow: thick hide, shield wall, last stand, solitude, curse
        r=await pg.evaluate('''()=>{const D=window.__D;const G=D.G;const o={};
          wear('giant');mob('beast');G.mob.atk=1e6;G.mob.str=80;G.hideN=0;const hp=S.hp=D.maxHp();const taken=[];for(let i=0;i<8;i++){const h=S.hp;D.mobHit();taken.push(h-S.hp);S.hp=hp;}o.shrug=taken.filter((t,i)=>(i+1)%4===0).every(t=>t===0)&&taken.filter((t,i)=>(i+1)%4!==0).some(t=>t>0);
          wear('hold');mob('beast');G.mob.atk=0;G.mob.str=1;G.mob.def=1;S.hp=10;S.spec=0;for(let i=0;i<10;i++)D.mobHit();o.wall=[S.hp>10,S.spec>0];
          wear('tr_iron');mob('beast');G.mob.atk=1e6;G.mob.str=80;let a=0,c=0;for(let i=0;i<300;i++){S.hp=D.maxHp();const h=S.hp;D.mobHit();a+=h-S.hp;S.hp=Math.round(D.maxHp()*0.2);const h2=S.hp;D.mobHit();c+=h2-S.hp;}o.lastStand=c/a;
          wear('set_adept',12);mob('beast');G.mob.atk=1e6;G.mob.str=80;let u=0,v=0;for(let i=0;i<300;i++){S.hp=D.maxHp();G.curseT=0;let h=S.hp;D.mobHit();u+=h-S.hp;S.hp=D.maxHp();G.curseT=6;h=S.hp;D.mobHit();v+=h-S.hp;}o.curse=v/u;
          return o}''')
        ck('Thick Hide shrugs every fourth blow; Shield Wall heals and charges on a miss; Last Stand takes about 30% less below 30% health; a cursed foe hits about 15% softer',r['shrug'] and all(r['wall']) and 0.6<r['lastStand']<0.8 and 0.68<r['curse']<0.97,{k:(round(v,3) if isinstance(v,float) else v) for k,v in r.items()})
        # kills: second wind, quickstep, footnote, the carried fire, halo, rime, specials cheaper, pickpocket, dirty trick
        r=await pg.evaluate('''()=>{const D=window.__D;const G=D.G;const o={};
          wear('meadow');mob('beast');S.hp=10;G.mob.hp=5;G.mobHp=1;D.playerHit(true,{sure:1});o.secondWind=S.hp>10;
          wear('set_scout',6);mob('beast');G.mob.hp=5;G.mobHp=1;G.pT=2;D.playerHit(true,{sure:1});o.quickstep=G.pT===0;
          wear('chron');S.chronK=24;S.chests=0;mob('beast');G.mob.hp=5;G.mobHp=1;D.playerHit(true,{sure:1});o.footnote=S.chests===1;
          wear('ash');mob('beast');G.mob.hp=5;G.mobHp=1;D.playerHit(true,{sure:1});o.carried=(G.dot&&G.dot.burn&&G.dot.burn.pct)||(D.spawn(false),G.dot&&G.dot.burn&&G.dot.burn.pct);o.carry=8;
          wear('set_vestment',12);G.ward=0;D.spawn(false);o.halo=G.ward>0&&G.ward<=Math.round(D.maxHp()*0.15);
          wear('set_channeler',12);mob('beast');G.ward=0;G.rimeT=0;S.paused=false;for(let i=0;i<60;i++)D.tick(0.1);S.paused=true;o.rime=G.ward>0;
          wear('set_battlemage',12);o.cheap=D.specCost();wear('giant');o.full=D.specCost();
          wear('goblin');mob('beast');S.gold=0;G.mob.gold=[100,200];for(let i=0;i<10;i++){G.mobHp=1e9;D.playerHit(true,{sure:1});}o.pick=S.gold;
          wear('set_skirmish',6);mob('beast');G.parry=0;for(let i=0;i<200;i++){G.mobHp=1e9;D.playerHit(true,{sure:1});}o.blind=G.parry;
          return o}''')
        ck('Second Wind, Quickstep, Footnote, the carried Cinder, Halo, Rime, cheaper Arc specials, Pickpocket and Dirty Trick all fire',r['secondWind'] and r['quickstep'] and r['footnote'] and r['carry']==8 and r['carried']==8 and r['halo'] and r['rime'] and r['cheap']==40 and r['full']==50 and r['pick']>=70 and 20<r['blind']<60,r)
        # the words: item window, codex page, bestiary
        r=await pg.evaluate('''()=>{const D=window.__D;wear('frost');D.openItem(S.equip.body);const w=document.getElementById('modalBox').textContent;document.getElementById('modal').className='';
          D.openCodex('frost_helm');const c=document.getElementById('modalBox').textContent;document.getElementById('modal').className='';
          D.showTab('vault');D.goRoom('vault','Collection');D.renderAll();const b=document.getElementById('bestiary').textContent;
          return [w.includes('Frostbite')&&w.includes('Ice'),c.includes('Frostbite'),b.includes('weak to light')&&b.includes('resists poison')]}''')
        ck("the item window and the Collection name the power and its element; the Bestiary lists each kind's weakness and resistance",all(r),r)
        ck('no page errors',not errs,errs[:2])
        await pg.evaluate('()=>localStorage.removeItem("ironhold_idle_v1")'); await b.close()
    print('FAILS',fails)
asyncio.run(main())
