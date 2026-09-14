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
        # the controls exist, the old switch migrates, the rules compare against everything owned
        r=await pg.evaluate('''()=>{const D=window.__D;const S=D.S;D.silence();S.autoSalv=true;S.qm=null;const q=D.qm();S.lv=99;for(const k in S.xp)S.xp[k]=2e7;S.keepIf={rar:0,aff:'',style:false};
          for(const s of D.SLOTS)S.equip[s]=null;S.inv=[];S.equip.body=D.makeItem(2,'body',1);const better=D.makeItem(5,'body',3);S.inv.push(better);
          const mid=D.makeItem(3,'body',2);const junkBest=D.qmJunk(mid);q.best=false;const junkWorn=D.qmJunk(mid);q.best=true;
          q.floor=4;const floorJunk=D.qmJunk(D.makeItem(3,'ring',5));q.floor=0;
          const ui=[document.getElementById('qmMode'),document.getElementById('qmFloor'),document.getElementById('qmBest')].every(Boolean);
          return {mode:q.mode,junkBest,junkWorn,floorJunk,ui}}''')
        ck('the old switch migrates to salvage; a mid body is junk against the better one in the pack but not against the worn one; the tier floor bites',r['mode']=='salvage' and r['junkBest'] and not r['junkWorn'] and r['floorJunk'] and r['ui'],r)
        # drops: salvage vs sell, the log, and pack pressure
        r=await pg.evaluate('''()=>{const D=window.__D;const S=D.S;const q=D.qm();S.qmLog=null;S.inv=[];S.scrap=0;S.gold=0;for(const s of D.SLOTS)S.equip[s]=null;S.equip.body=D.makeItem(7,'body',3);
          q.mode='salvage';const r1=D.gainItem(D.makeItem(1,'body',1));const sc=S.scrap;q.mode='sell';const r2=D.gainItem(D.makeItem(1,'body',1));const g=S.gold;
          const L=D.qmLog();const log1=[L.salv,L.sold,L.scrap>0,L.gold>0,L.last.length];
          q.mode='salvage';S.inv=[];for(let i=0;i<25;i++)S.inv.push(D.makeItem(1,'ring',1));S.inv.push(D.makeItem(6,'ring',4));const n0=S.inv.length;D.gainItem(D.makeItem(2,'ring',2));const n1=S.inv.length;const hasBest=S.inv.some(x=>x.tier===6);
          return {r1,r2,sc,g,log1,n0,n1,hasBest}}''')
        ck('a losing drop is salvaged for scrap or sold for gold by the mode; the log counts it; at 24+ the worst junk rings go before the best one',r['r1']=='salvaged' and r['r2']=='sold' and r['sc']>0 and r['g']>0 and r['log1'][0]==1 and r['log1'][1]==1 and r['log1'][2] and r['log1'][3] and r['log1'][4]==2 and r['n0']==26 and r['n1']<24 and r['hasBest'],r)
        # the Quartermaster wears plain upgrades, never over a set piece, never a two-hander over a shield, never another style
        r=await pg.evaluate('''()=>{const D=window.__D;const S=D.S;const q=D.qm();q.mode='salvage';S.coach=S.coach||{};S.coach.wear='on';S.inv=[];S.qmLog=null;for(const s of D.SLOTS)S.equip[s]=null;
          S.equip.weapon=D.makeItem(3,'weapon',1,2);S.equip.body=D.makeItem(2,'body',1,undefined,null);const up=D.makeItem(6,'body',3,undefined,null);const r1=D.gainItem(up);const worn=S.equip.body===up;const oldGone=!S.inv.some(x=>x.tier===2);
          S.equip.head=D.makeSetPiece('saint','head');const r2=D.gainItem(D.makeItem(8,'head',5,undefined,null));const setKept=S.equip.head.set==='saint';
          S.equip.shield=D.makeItem(2,'shield',1);const r3=D.gainItem(D.makeItem(7,'weapon',3,4));const shieldKept=!!S.equip.shield&&S.equip.weapon.tier===3;
          const r4=D.gainItem(D.makeItem(7,'weapon',3,6));const styleKept=S.equip.weapon.tier===3;
          S.coach.wear='off';const r5=D.gainItem(D.makeItem(8,'body',5,undefined,null));const off=S.equip.body===up;
          return {r1,worn,oldGone,r2,setKept,r3,shieldKept,r4,styleKept,r5,off,wornN:D.qmLog().worn}}''')
        ck('wears a plain body upgrade and salvages the old one; leaves the Saint helm, the shield against a greatsword, and the melee weapon against a bow; does nothing when the Coach row is off',r['r1']=='worn' and r['worn'] and r['oldGone'] and r['r2']=='kept' and r['setKept'] and r['r3']=='kept' and r['shieldKept'] and r['r4'] in ('kept','salvaged') and r['styleKept'] and r['r5']=='kept' and r['off'] and r['wornN']==1,r)
        # the Coach row, the log section, and the buttons following the rules
        r=await pg.evaluate('''()=>{const D=window.__D;const S=D.S;D.showTab('skills');D.renderAll();const coach=document.getElementById('coach').textContent.includes('Quartermaster');
          S.showClog=true;D.applyClog();document.getElementById('clog').dataset.t=0;D.renderClog();const t=document.getElementById('clog').textContent;
          S.inv=[D.makeItem(0,'ring',1),D.makeItem(6,'ring',4)];S.gold=0;D.sellJunk();return {coach,loot:t.includes('Loot, this realm')&&t.includes('Worn by the Quartermaster')&&t.includes('Last to go'),sold:S.inv.length===1&&S.gold>0}}''')
        ck('the Coach lists the Quartermaster row; the combat log carries a Loot section; Sell junk follows the same rules',r['coach'] and r['loot'] and r['sold'],r)
        ck('no page errors',not errs,errs[:2])
        await pg.evaluate('()=>localStorage.removeItem("ironhold_idle_v1")'); await b.close()
    print('FAILS',fails)
asyncio.run(main())
