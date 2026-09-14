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
        r=await pg.evaluate('''()=>{const D=window.__D,S=D.S,G=D.G;D.silence();G.sim=true;D.redeem('IRON-LABFREAKGODMODE.L99.Y1.T9-OM229W');
          // realm scaling: at realm 10 an ordinary monster's blow multiplier is 1+0.5*9, its health 1+0.3*9 (times steel)
          S.asc.realm=9;S.area=0;S.diff=0;D.spawn(false);const m=G.mob;const base=D.AREAS[0].mobs.find(x=>x.n===m.n.replace(/^(Elite |Night )/,''))||D.AREAS[0].mobs[0];
          const hk=m.hk,hpx=m.hp/base.hp;
          // the Pretender: no realm, difficulty or steel scaling
          S.pre={r:9,name:'Garran the Bold',cl:103,mh:835,p:'atk',from:'',prog:8,pace:0,holds:true,done:false};S.diff=3;D.spawn(['pre']);const pm=D.preMob();const pre={hp:G.mob.hp,want:pm.hp,hk:G.mob.hk,mh:D.mobMaxHit(G.mob)};S.diff=0;G.pre=null;S.pre.holds=false;S.pre.done=true;D.spawn(false);
          // building cost
          S.keep={forge:0};const c0=D.keepCost('forge');S.keep.forge=4;const c4=D.keepCost('forge');S.keep.forge=0;
          // boss chest: a cleared area pays one time in three
          S.area=1;S.cleared[1]=true;S.kills[1]=999;let ch=0;for(let i=0;i<400;i++){S.chests=0;G.isBoss=true;G.mob=Object.assign({},D.AREAS[1].boss);G.mobHp=0;D.killMob();ch+=S.chests;G.isBoss=false;}
          S.cleared[1]=false;let first=0;for(let i=0;i<20;i++){S.chests=0;S.cleared[1]=false;G.isBoss=true;G.mob=Object.assign({},D.AREAS[1].boss);G.mobHp=0;D.killMob();first+=S.chests;G.isBoss=false;}
          // unique rate from the monsters of a mid area
          let uq=0;for(let i=0;i<600000;i++){const u=D.rollUnique({area:3,boss:null},1);if(u&&u.uq)uq++;}
          // Sovereign harness survives ascension
          for(const sl of D.SLOTS)S.equip[sl]=null;S.inv=[];S.store=[];S.equip.head=D.makeSetPiece('sov','head');S.inv.push(D.makeSetPiece('sov','body'));S.store.push(D.makeSetPiece('sov','legs'));S.inv.push(D.makeItem(7,'boots',3));
          S.cleared=D.AREAS.map(()=>true);S.pre=null;const ready=D.ascReady();const ok=D.ascend([],[]);const sov=S.inv.filter(it=>it.set==='sov').map(it=>it.slot);const other=S.inv.filter(it=>it.set!=='sov'&&it.tier>0).length;
          return {hk,hpx,pre,c0,c4,ch,first,uq,ready,ok,sov,other,inv:S.inv.length}}''')
        ck('realm 10 monsters swing 3.5x and carry 7.5x health (before steel)',abs(r['hk']-3.5)<0.01 and abs(r['hpx']-7.45)<0.2,{k:r[k] for k in ('hk','hpx')})
        ck('the Pretender wears no realm, difficulty or steel scaling: his health is exactly the shadow\'s',r['pre']['hp']==r['pre']['want'] and r['pre']['hp']<40000 and r['pre']['hk']==1.15,r['pre'])
        ck('buildings cost 2500 gold and 20 scrap at first and 1.56M gold at the fifth level',r['c0']=={'gold':2500,'scrap':20} and r['c4']['gold']==1562500,{'c0':r['c0'],'c4':r['c4']})
        ck('a boss of a cleared area pays a chest about one time in three; the first clear always',100<r['ch']<180 and r['first']==20,{'ch':r['ch'],'first':r['first']})
        ck('uniques from the monsters of a mid area land about one in 2500',180<r['uq']<300,r['uq'])
        ck('ascension keeps every Sovereign piece, worn, carried or stored, and drops the rest',r['ready'] and r['ok'] and sorted(r['sov'])==['body','head','legs'] and r['other']==0,{'sov':r['sov'],'other':r['other'],'inv':r['inv']})
        ck('no page errors',not errs,errs[:2])
        await pg.evaluate('()=>localStorage.removeItem("ironhold_idle_v1")'); await b.close()
    print('FAILS',fails)
asyncio.run(main())
