import asyncio,json,sys,time
SP='/tmp/claude-0/-home-user-Odds-Ends/6256ba04-1a25-565f-b31b-2b72a8b325ad/scratchpad'
from playwright.async_api import async_playwright
BOT=r'''
window.__bot=(function(){
const D=window.__D,S=D.S,G=D.G;
D.silence();G.sim=true;S.autoEat=true;S.eatPct=50;S.qm=S.qm||{};Object.assign(S.qm,{mode:'salvage',floor:0,best:true});
for(const [k,v] of [['spec','always'],['wear','on'],['boss','on'],['march','on'],['pray','always'],['retreat','on'],['speed',OPT.speed?'2':'1']])D.coachSet(k,v);
S.coach=S.coach||{};S.coach.marchHit=40;const T={t:0,realms:[],deaths:0,lastDeaths:0,lastDeathT:-1e9};
const CREED_PREF=['scholar','heavy','gilded','swift','bloodied','gambler','stone','iron','miser','shepherd','wild','hermit'];
function best(slot){const cands=S.inv.filter(it=>it.slot===slot&&D.reqOk(D.reqFor(it))&&!D.handsBound(it)&&(slot!=='weapon'||!D.WEAPONS[it.wt].style)&&!(slot==='shield'&&S.equip.weapon&&D.WEAPONS[S.equip.weapon.wt].two));
  let b=null,bs=-1;for(const it of cands){const sc=D.itemScore(it);if(sc>bs){bs=sc;b=it;}}
  const cur=S.equip[slot];if(b&&(!cur||D.itemScore(cur)<bs))D.equip(b);}
function wear(){for(const sl of ['weapon','body','legs','head','boots','gloves','cape','amulet','ring','shield'])best(sl);}
function chests(){let n=0;while(S.chests>=5&&D.mimicFeed(2))n++;while((S.chests2||0)>=5&&D.mimicFeed(3))n++;
  for(const k of [3,2,1])for(let i=0;i<40&&D.chestCount(k)>0&&S.inv.length<28;i++)D.openChest(k);}
function prayers(){const l=D.combatLvl();S.quick=l>=50?['piety','protect']:l>=25?['clarity','burst','skin','protect']:['clarity','burst','skin'];}
function spend(){
  // buildings first
  for(const k of ['forge','larder','chest','yard','barracks'])for(let i=0;i<5;i++){const c=D.keepCost(k);if(D.keepLv(k)>=D.keepMax(k)||S.gold<c.gold*1.2||S.scrap<c.scrap)break;if(!D.buildKeep(k))break;}
  // hires
  for(const cd of D.COMPS){if(D.partyHas(cd.id)||!D.compUnlocked(cd.id)||D.keepLv('barracks')<cd.req)continue;if(S.gold>=D.hireCost()*1.1)D.hireComp(cd.id);}
  // put the strongest companions in the field
  {const P=S.party||[];P.forEach((c,i)=>{if(!c.field)D.setField(i,true);});}
  // talents
  {const P=S.party||[];P.forEach((c,i)=>{const cd=D.COMPS.find(x=>x.id===c.type);if(!cd)return;for(let t=0;t<3;t++)if(D.talOpen(c,t)){const pair=D.TALENTS[cd.role][t];if(pair&&pair[0])D.pickTalent(i,t,pair[0].id);}});}
  // gear upgrades on worn pieces (weapon first)
  for(const sl of ['weapon','body','legs','head','shield','boots','gloves','cape','amulet','ring']){const it=S.equip[sl];if(!it)continue;for(let i=0;i<10;i++){if((it.up||0)>=D.forgeMax())break;const uc=D.upgradeCost(it);if(S.gold<uc.gold*1.5||S.scrap<uc.scrap)break;S.gold-=uc.gold;S.scrap-=uc.scrap;it.up=(it.up||0)+1;}}
  // companion training with the surplus
  {const P=(S.party||[]).filter(c=>!c.temp);for(let r=0;r<20;r++){let did=false;for(const c of P){if((c.lvl||0)>=15)continue;const cost=D.compCost(c);if(S.gold>=cost*3){S.gold-=cost;c.lvl=(c.lvl||0)+1;did=true;}}if(!did)break;}}
  // cooking
  for(const r of D.RECIPES)if(D.canCook(r))D.cook(r.id,true);
}
function move(){const A=D.AREAS[S.area];if(G.isBoss||G.dead||G.duel!=null||G.pre)return;
  // deaths: fall back one area after two deaths in five minutes
  if(S.deaths-T.lastDeaths>0){T.lastDeaths=S.deaths;T.lastDeathT=T.t;T.dieBurst=(T.dieBurst||0)+1;}
  if(T.t-T.lastDeathT>300)T.dieBurst=0;
  if((T.dieBurst||0)>=2&&S.area>0){S.area--;D.spawn(false);T.dieBurst=0;return;}
  const last=D.AREAS.length-1;
  // the tally is met anywhere: farm it where two blows in three land, and go to the Lair only for the Wyrm
  if(S.area===last&&!S.cleared[last]&&!D.wyrmAwake()){let best=0;for(let i=0;i<last;i++)if(D.unlocked(i)&&D.areaHit(i)*100>=70)best=i;if(best<last){D.goArea(best);return;}}
  if(S.area<last&&S.cleared[S.area]&&D.unlocked(last)&&!S.cleared[last]&&D.wyrmAwake()&&D.areaHit(last)*100>=30&&T.t-T.lastDeathT>600){D.goArea(last);return;}
  if(!D.coachOpen('boss')&&S.kills[S.area]>=A.need&&!S.cleared[S.area]&&(S.area!==last||D.wyrmAwake())){D.spawn(true);return;}
  if(S.cleared[S.area]&&D.unlocked(S.area+1)&&S.area+1<last&&T.t-T.lastDeathT>600&&(D.areaHit(S.area+1)*100>=40||(T.t-(T.lastPT||0)>7200&&D.areaHit(S.area+1)*100>=25))){D.goArea(S.area+1);}
  // pull back if the hit chance where we stand has fallen under 35% (a stray march)
  if(S.area>0&&D.areaHit(S.area)*100<22)D.goArea(S.area-1);
}
function diag(){const A=D.AREAS;const m=G.mob;return {t:T.t,realm:(S.asc.realm||0)+1,area:S.area,cleared:(S.cleared||[]).map(x=>x?1:0),kills:S.kills.slice(),hit:A.map((a,i)=>Math.round(D.areaHit(i)*100)),cl:D.combatLvl(),hp:[Math.round(S.hp),D.maxHp()],deaths:S.deaths||0,mob:m?{n:m.n,hp:m.hp,cur:Math.round(G.mobHp),spd:m.spd,isBoss:!!G.isBoss,pre:!!G.pre,nem:!!G.nem,duel:G.duel,lair:G.lair,gob:!!m.gob}:null,pre:S.pre?{holds:S.pre.holds,done:S.pre.done,name:S.pre.name,cl:S.pre.cl,prog:S.pre.prog}:null,dead:G.dead,food:D.foodCount(),gold:S.gold,mh:D.playerMaxHit?D.playerMaxHit():null,dl:(S.deathLog||[]).slice(-3),save:D.serialize()};}
function realmStats(){const found=Object.keys(S.found||{});const uq=found.filter(k=>D.UNIQUES[k]).length;const setp=found.filter(k=>!D.UNIQUES[k]).length;
  return {realm:(S.asc.realm||0)+1,hours:+(T.t/3600).toFixed(2),cl:D.combatLvl(),lv:{atk:D.lv('atk'),str:D.lv('str'),def:D.lv('def'),hp:D.lv('hp')},deaths:S.deaths||0,kills:S.totalKills||0,gold:S.goldEarned||0,chests:S.chestsOpened||0,chests2:S.chestsOpened2||0,chests3:S.chestsOpened3||0,uniques:uq,setPieces:setp,party:(S.party||[]).map(c=>c.type+':'+(c.lvl||0)),keep:Object.assign({},S.keep),worn:Object.fromEntries(Object.entries(S.equip).filter(([k,v])=>v).map(([k,v])=>[k,D.itemName(v)+' +'+(v.up||0)])),creeds:(S.asc.creeds||[]).slice(),shards:S.asc.shards||0,area:S.area};}
function ascendNow(){const st=realmStats();T.realms.push(st);
  const ids=D.creedOffer();const pick=CREED_PREF.find(id=>ids.includes(id))||ids[0];
  D.ascend([],[]);S.asc.creeds=[pick].concat(S.asc.creeds||[]);S.asc.creedOffer=null;return st;}
function minute(){wear();chests();prayers();spend();move();
  if(D.preHolds()&&D.preDuelReady())D.startPreDuel();
  if(D.ascReady()){ascendNow();wear();}}
function progressKey(){return (S.asc.realm||0)*1e6+(S.cleared||[]).filter(Boolean).length*1e5+Math.floor(D.realmKills()/500);}
function run(secs){const end=T.t+secs;let m=0;if(T.lastP==null){T.lastP=0;T.lastPT=0;}while(T.t<end){D.tick(0.1);if(OPT.speed&&D.coach('speed')==='2')D.tick(0.1);T.t+=0.1;m+=0.1;if(m>=60){m=0;minute();const pk=progressKey();if(pk!==T.lastP){T.lastP=pk;T.lastPT=T.t;}if(T.t-T.lastPT>3600*120){return Object.assign(diag(),{stall:true});}}
  if((S.asc.realm||0)+1>OPT.target)break;}
  return {t:T.t,realm:(S.asc.realm||0)+1,area:S.area,cl:D.combatLvl(),deaths:S.deaths||0,realms:T.realms.length};}
return {run,T,realmStats,S};
})();
'''
async def main():
    target=int(sys.argv[1]) if len(sys.argv)>1 else 10; speed=int(sys.argv[2]) if len(sys.argv)>2 else 0
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':420,'height':900})
        errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://localhost:8899/dbg6/index.html'); await pg.wait_for_function('window.__ihBoot===true'); await pg.wait_for_timeout(500)
        if len(sys.argv)>3:
            sv=open(sys.argv[3]).read(); await pg.add_init_script("localStorage.setItem('ironhold_idle_v1',%s)"%json.dumps(sv)); await pg.reload(); await pg.wait_for_function('window.__ihBoot===true'); await pg.wait_for_timeout(400)
        else:
            await pg.evaluate('()=>localStorage.removeItem("ironhold_idle_v1")'); await pg.reload(); await pg.wait_for_function('window.__ihBoot===true'); await pg.wait_for_timeout(400)
        await pg.evaluate("window.OPT={target:%d,speed:%d}"%(target,speed)); await pg.evaluate(BOT)
        if len(sys.argv)>4: await pg.evaluate('(h)=>{window.__bot.T.t=h*3600;window.__bot.T.lastPT=h*3600;}',float(sys.argv[4]))
        t0=time.time(); last=0
        while True:
            r=await pg.evaluate('()=>window.__bot.run(3600*4)')
            if r.get('stall'):
                save=r.pop('save'); open(SP+'/stall_%d.txt'%speed,'w').write(save); print('STALL',json.dumps(r),flush=True); break
            if r['realms']>last:
                last=r['realms']; st=await pg.evaluate('()=>window.__bot.T.realms[window.__bot.T.realms.length-1]'); print('ASCEND',json.dumps(st),flush=True); sv=await pg.evaluate('()=>window.__D.serialize()'); open(SP+'/asc_%d_%d.txt'%(speed,st['realm']),'w').write(sv)
            print('t=%.1fh realm %d area %d cl %d deaths %d (wall %.0fs)'%(r['t']/3600,r['realm'],r['area'],r['cl'],r['deaths'],time.time()-t0),flush=True)
            if r['realm']>target or r['t']>3600*2000: break
            if errs: print('ERR',errs[:3]); break
        fin=await pg.evaluate('()=>window.__bot.realmStats()'); print('FINAL',json.dumps(fin)); print('errs',errs[:2])
        await pg.evaluate('()=>localStorage.removeItem("ironhold_idle_v1")'); await b.close()
asyncio.run(main())
