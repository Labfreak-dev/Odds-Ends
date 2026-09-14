import asyncio
from playwright.async_api import async_playwright
URL='http://localhost:8899/dbg6/index.html'
fails=0
def ck(name,ok,extra=''):
    global fails
    print(('PASS ' if ok else 'FAIL ')+name+(' '+str(extra) if extra else ''))
    if not ok: fails+=1
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':420,'height':900})
        errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto(URL); await pg.wait_for_function('window.__ihBoot===true'); await pg.wait_for_timeout(600)
        r=await pg.evaluate('''()=>{const D=window.__D;D.silence();const S=D.S;D.redeem('IRON-LABFREAKGODMODE.L99.Y1.T9-OM229W');S.store=[];return {feats:D.FEATS.length,ids:new Set(D.FEATS.map(f=>f.id)).size,uq:Object.keys(D.UNIQUES).length,sets:Object.keys(D.SETS)}}''')
        ck('the board grew: unique ids, new sets present',r['feats']==r['ids'] and r['feats']>=39+24+8+6+12+15 and 'chron' in r['sets'] and 'tr_bare' in r['sets'],r)
        # slayer line: 100k beasts hands you Beastbane into storage, +40% vs beasts only
        r=await pg.evaluate('''()=>{const D=window.__D;const S=D.S;S.bestK={beast:100000};D.featTick();const it=D.store().find(x=>x.uq==='beastbane');const d1=D.featDone('slay_beast_1'),d3=D.featDone('slay_beast_3');
          D.equip(it);S.area=0;D.spawn(false);D.G.mob=Object.assign({},D.G.mob,{shape:'beast',hp:1e9,def:0});D.G.mobHp=1e9;let a=0,b=0;for(let i=0;i<400;i++){D.G.mobHp=1e9;D.G.first=false;D.playerHit(false);a+=1e9-D.G.mobHp;}
          D.G.mob=Object.assign({},D.G.mob,{shape:'bird'});for(let i=0;i<400;i++){D.G.mobHp=1e9;D.G.first=false;D.playerHit(false);b+=1e9-D.G.mobHp;}return {it:!!it,d1,d3,name:it&&D.itemName(it),icon:it&&D.iconKey(it),ratio:a/Math.max(1,b),title:D.FEATS.find(f=>f.id==='slay_beast_3').title}}''')
        ck('a hundred thousand beasts: three feats done, Beastbane stowed with an icon, hits beasts about 40% harder than fowl',r['it'] and r['d1'] and r['d3'] and r['icon']=='beastbane' and 1.15<r['ratio']<1.7 and r['title']=='Beastslayer',r)
        # the Chronicler: numbers hand out pieces; a full set counts
        r=await pg.evaluate('''()=>{const D=window.__D;const S=D.S;S.totalKills=100000;S.goldEarned=1e7;S.chestsOpened=1000;S.tower.best=200;S.ab={best:100};S.gobs=50;S.asc.count=10;S.played=3600000;D.featTick();
          const got=D.store().filter(x=>x.set==='chron');for(const it of got)D.equip(it);const c=D.setCounts().chron;const b=D.bonuses();return {n:got.length,slots:got.map(x=>x.slot).sort(),c,xp:b.xp,icon:D.iconKey(got[0])}}''')
        ck('the Chronicler: eight milestones, eight pieces, worn as a full set with its XP bonus, icons are its own',r['n']==8 and r['c']==8 and r['xp']>=15+6 and r['icon']=='chron_body',r)
        # new-system feats and what their things do
        r=await pg.evaluate('''()=>{const D=window.__D;const S=D.S;S.asc.hall=[{r:0,cl:50,mh:50,k:1,p:'str',t:'the Pretender, kneeling',pre:true},{r:0,cl:50,mh:50,k:1,p:'str',t:'the Pretender, cast down',pre:true}];S.reclaimed=3;S.bestN={Wraith:1,'Moth-witch':1,'Grave hound':1};S.songs={known:['corrido','dirge','reel'],play:'corrido'};S.hunt={0:1,1:1,2:1,3:1,4:1,5:1,6:1,7:1};D.featTick();
          const names=['kingmaker_cloak','usurper_ring','vendetta_ring','watch_lantern','bandleader_ring','huntsman_horn'];const have=names.map(k=>!!D.store().find(x=>x.uq===k)||!!S.inv.find(x=>x.uq===k));
          const horn=D.store().find(x=>x.uq==='huntsman_horn')||S.inv.find(x=>x.uq==='huntsman_horn');const n0=D.huntNext(0);D.equip(horn);const n1=D.huntNext(0);
          const ring=D.store().find(x=>x.uq==='bandleader_ring')||S.inv.find(x=>x.uq==='bandleader_ring');S.party=[{type:'band',lvl:5,field:false}];S.compFound={band:1};const s0=D.song();D.equip(ring);const s1=D.song();
          return {have,n0,n1,s0,s1,slot:horn.slot,icon:D.iconKey(horn)}}''')
        ck('six deeds hand out six things; the horn wakes trophies at 8,000, the ring lets the band play from the roster',all(r['have']) and r['n0']==20000 and r['n1']==16000 and r['s0'] is None and r['s1']=='corrido' and r['slot']=='amulet' and r['icon']=='huntsman_horn',r)
        # trial sets and oath gear
        r=await pg.evaluate('''()=>{const D=window.__D;const S=D.S;S.trials={bare:{best:1,clears:30},alone:{best:1,clears:10}};S.party=[{type:'hound',lvl:30,sworn:true,field:false},{type:'cleric',lvl:29,sworn:true,field:false},{type:'band',lvl:30,sworn:false,field:false}];D.featTick();
          const st=D.store().concat(S.inv);return {bare:st.filter(x=>x.set==='tr_bare').map(x=>x.slot).sort(),alone:st.filter(x=>x.set==='tr_alone').map(x=>x.slot),hound:!!st.find(x=>x.uq==='hound_collar'),cleric:!!st.find(x=>x.uq==='cleric_censer'),band:!!st.find(x=>x.uq==='mariachi_guitar')}}''')
        ck('thirty bare-hands clears give all three pieces, ten lone clears one; the sworn level-30 hound brings its collar, the unsworn and the level-29 nothing',r['bare']==['boots','gloves','ring'] and len(r['alone'])==1 and r['hound'] and not r['cleric'] and not r['band'],r)
        # the board and the collection say where things come from
        await pg.evaluate('''()=>{const D=window.__D;D.showTab('skills');D.goRoom('skills','Feats');D.renderAll();}''')
        r=await pg.evaluate('''()=>{const t=document.getElementById('feats').textContent;return [t.includes('Beastbane'),t.includes('Chronicler Coat'),t.includes('Oath: War hound')]}''')
        ck('the feats board names the things it gives',all(r),r)
        r=await pg.evaluate('''()=>{const D=window.__D;D.showTab('vault');D.goRoom('vault','Collection');D.renderAll();D.openCodex('beastbane');const a=document.getElementById('modalBox').textContent;D.openCodex('chron_head');const b=document.getElementById('modalBox').textContent;D.openCodex('hound_collar');const c=document.getElementById('modalBox').textContent;document.getElementById('modal').className='';return [a.includes('Beasts: a hundred thousand'),b.includes('earned by the numbers'),c.includes('sworn and raised to level 30')]}''')
        ck('the Collection explains each new source',all(r),r)
        ck('no page errors',not errs,errs)
        await pg.evaluate('()=>localStorage.removeItem("ironhold_idle_v1")')
        await b.close()
asyncio.run(main()); print('FAILS',fails); raise SystemExit(1 if fails else 0)
