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
        # feeding: five plain make a Banded, five Banded make a Gilded; buttons follow the counts
        r=await pg.evaluate('''()=>{const D=window.__D;const S=D.S;D.silence();D.redeem('IRON-LABFREAKGODMODE.L99.Y1.T9-OM229W');S.chests=12;S.chests2=0;S.chests3=0;
          const f0=D.mimicFeed(3);const f1=D.mimicFeed(2);const f2=D.mimicFeed(2);const f3=D.mimicFeed(2);const c=[S.chests,S.chests2,S.chests3];
          S.chests2=5;const f4=D.mimicFeed(3);const c2=[S.chests2,S.chests3];
          S.asc=S.asc||{};S.asc.count=Math.max(1,S.asc.count||0);D.showTab('vault');D.goRoom('vault','Storage');D.renderAltars();const html=document.getElementById('vMimic').innerHTML;const btns=[...document.querySelectorAll('[data-feed]')].map(b=>[b.dataset.feed,b.disabled]);
          D.showTab('hero');D.renderAll();const vis=[document.getElementById('btnChest2').hidden,document.getElementById('btnChest3').hidden,document.getElementById('chest3Cnt').textContent];
          return {f0,f1,f2,f3,c,f4,c2,appetite:html.includes('Its appetite'),btns,vis}}''')
        ck('five plain chests feed into one Banded, five Banded into one Gilded; a short purse is refused; the Mimic and the pack show the buttons',not r['f0'] and r['f1'] and r['f2'] and not r['f3'] and r['c']==[2,2,0] and r['f4'] and r['c2']==[0,1] and r['appetite'] and len(r['btns'])>=2 and r['vis']==[True,False,'1'],r)
        # opening: Banded rolls rarity 4+, one in five a Vaultkeeper piece; Gilded rarity 5+, one in three a Gilded piece, gold scales; the sets never come from plain chests
        r=await pg.evaluate('''()=>{const D=window.__D;const S=D.S;S.area=6;const kinds={};let vault=0,gilt=0,minR2=9,minR3=9,plainSet=0;
          for(let i=0;i<300;i++){const it=D.chestRoll(2);if(it.set==='vault')vault++;else if(!it.uq&&!it.set)minR2=Math.min(minR2,it.rar);}
          for(let i=0;i<300;i++){const it=D.chestRoll(3);if(it.set==='gilt')gilt++;else if(!it.uq&&!it.set)minR3=Math.min(minR3,it.rar);}
          for(let i=0;i<300;i++){const it=D.chestRoll(1);if(it.set==='vault'||it.set==='gilt')plainSet++;}
          S.inv=[];S.gold=0;S.chests3=1;D.openChest(3);const g3=S.gold;S.gold=0;S.chests=1;D.openChest(1);const g1=S.gold;
          return {vault:vault/300,gilt:gilt/300,minR2,minR3,plainSet,g3,g1,ratio:g3/Math.max(1,g1)}}''')
        ck('Banded chests hold a Vaultkeeper piece about one in five and roll Masterwork or better; Gilded about one in three and Legendary or better; plain chests never hold either; Gilded gold is many times plain',0.12<r['vault']<0.28 and 0.25<r['gilt']<0.42 and r['minR2']>=4 and r['minR3']>=5 and r['plainSet']==0 and r['ratio']>8,{k:(round(v,3) if isinstance(v,float) else v) for k,v in r.items()})
        # the sets' powers: Coffer's second chest item and double gold; Gilded Storm's chain on the fifth swing; feats and codex
        r=await pg.evaluate('''()=>{const D=window.__D;const S=D.S;const G=D.G;for(const s of D.SLOTS)S.equip[s]=null;for(const sl of D.setSlots('vault'))S.equip[sl]=D.makeSetPiece('vault',sl);S.equip.weapon=D.makeItem(5,'weapon',1,2);
          const pw1=D.setPowers();S.inv=[];S.chests=1;D.openChest(1);const two=S.inv.length===2;
          for(const s of D.SLOTS)S.equip[s]=null;for(const sl of D.setSlots('gilt'))S.equip[sl]=D.makeSetPiece('gilt',sl);S.equip.weapon=D.makeItem(5,'weapon',1,2);S.area=0;D.spawn(false);
          const pw2=D.setPowers();G.swings=5;const chain=!!D.pwExtra(false);G.swings=4;const noChain=!D.pwExtra(false);const el=D.setElem();
          S.chestsOpened2=1;S.chestsOpened3=1;D.featTick();const feats=[D.featDone('mimic_banded'),D.featDone('mimic_gilded')];
          D.openCodex('vault_head');const c1=document.getElementById('modalBox').textContent;document.getElementById('modal').className='';D.openCodex('gilt_body');const c2=document.getElementById('modalBox').textContent;document.getElementById('modal').className='';
          return {pw1,two,pw2,chain,noChain,el,feats,codex:c1.includes('Banded chests')&&c2.includes('Gilded chests'),title:!!D.TITLE_PERK['the Keeper']}}''')
        ck("Coffer doubles a chest's contents; Gilded Storm chains on the fifth swing with lightning; the two feats and the codex texts are in place",r['pw1']==['vault'] and r['two'] and r['pw2']==['gilt'] and r['chain'] and r['noChain'] and r['el']=='lightning' and all(r['feats']) and r['codex'] and r['title'],r)
        ck('no page errors',not errs,errs[:2])
        await pg.evaluate('()=>localStorage.removeItem("ironhold_idle_v1")'); await b.close()
    print('FAILS',fails)
asyncio.run(main())
