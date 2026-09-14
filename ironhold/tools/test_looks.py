import asyncio
from playwright.async_api import async_playwright
from PIL import Image
URL='http://localhost:8899/dbg6/index.html'
fails=0
def ck(name,ok,extra=''):
    global fails
    print(('PASS ' if ok else 'FAIL ')+name+(' '+str(extra) if extra else ''))
    if not ok: fails+=1
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':420,'height':900},device_scale_factor=2)
        errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto(URL); await pg.wait_for_function('window.__ihBoot===true'); await pg.wait_for_timeout(600)
        await pg.evaluate('''()=>{const D=window.__D;D.silence();const S=D.S;S.paused=true;S.lv=99;for(const k in S.skills||{})S.skills[k]=99;}''')
        # wait for the new sprites to decode
        keys=['lk_set_chron','lk_set_tr_bare','lk_set_tr_alone','lk_set_tr_iron','lk_set_tr_silent','lk_sov_bow','lk_sov_staff']+[p+'set_'+s for s in ['chron','tr_bare','tr_alone','tr_iron','tr_silent'] for p in ['lk_bow_','lk_wiz_']]
        await pg.wait_for_function('''()=>%s.every(k=>window.__D.sprReady(k+'_idle')&&window.__D.sprReady(k+'_atk'))'''%keys,timeout=60000)
        shots=[]
        for st,key in [('chron','lk_set_chron'),('tr_bare','lk_set_tr_bare'),('tr_alone','lk_set_tr_alone'),('tr_iron','lk_set_tr_iron'),('tr_silent','lk_set_tr_silent')]:
            r=await pg.evaluate('''([st])=>{const D=window.__D;const S=D.S;for(const s of D.SLOTS)S.equip[s]=null;S.equip.weapon=D.makeItem(5,'weapon',1,2);
              const partial=[];for(const sl of D.setSlots(st)){S.equip[sl]=D.makeSetPiece(st,sl);partial.push(D.lookKey());}
              const full=D.lookKey();S.equip.weapon=D.makeItem(5,'weapon',1,6);const bow=D.lookKey();S.equip.weapon=D.makeItem(5,'weapon',1,12);const wiz=D.lookKey();
              S.equip.weapon=D.makeItem(5,'weapon',1,2);D.renderAll();return {partial,full,bow,wiz,g:D.lookGrip(full+'_idle',0),hb:D.lookHand(bow+'_idle',0),ab:D.lookAng(wiz+'_atk',1)}}''',[st])
            ck('the %s look in all three classes'%st, r['full']==key and r['bow']=='lk_bow_'+key[3:] and r['wiz']=='lk_wiz_'+key[3:] and r['g'] is not None and r['hb'] is not None and r['ab'] is not None, r)
            await pg.evaluate('''()=>{const D=window.__D;D.showTab('hero');D.G.atk=0;}'''); await pg.wait_for_timeout(250)
            await pg.locator('#scene').screenshot(path='/tmp/look_%s_idle.png'%st)
            await pg.evaluate('''()=>{const D=window.__D;D.G.atk=0.45;D.G.atkT=0.45;}'''); await pg.wait_for_timeout(120)
            await pg.locator('#scene').screenshot(path='/tmp/look_%s_atk.png'%st); shots.append(st)
            for wt,cls in [(6,'bow'),(12,'wiz')]:
                await pg.evaluate('''([wt])=>{const D=window.__D;D.S.equip.weapon=D.makeItem(5,'weapon',1,wt);D.renderAll();D.showTab('hero');D.G.atk=0;}''',[wt]); await pg.wait_for_timeout(250)
                await pg.locator('#scene').screenshot(path='/tmp/look_%s_%s_idle.png'%(st,cls))
                await pg.evaluate('''()=>{const D=window.__D;D.G.atk=0.45;D.G.atkT=0.45;}'''); await pg.wait_for_timeout(120)
                await pg.locator('#scene').screenshot(path='/tmp/look_%s_%s_atk.png'%(st,cls)); shots.append(st+'_'+cls)
        for uq,key in [('sov_longbow','lk_sov_bow'),('sov_battlestaff','lk_sov_staff'),('sov_greatsword','lk_sov')]:
            r=await pg.evaluate('''([uq])=>{const D=window.__D;const S=D.S;for(const s of D.SLOTS)S.equip[s]=null;for(const sl of D.setSlots('sov'))S.equip[sl]=D.makeSetPiece('sov',sl);S.equip.weapon=D.makeUnique(uq);if(uq!=='sov_greatsword')S.equip.shield=null;D.renderAll();return {full:D.sovFull(),look:D.lookKey(),n:D.SPR_SRC[D.lookKey()+'_idle'].f.length,na:D.SPR_SRC[D.lookKey()+'_atk'].f.length}}''',[uq])
            ck('the Ascended with %s wears %s'%(uq,key), r['full'] and r['look']==key and r['n']==12 and r['na']==8, r)
            await pg.evaluate('''()=>{const D=window.__D;D.showTab('hero');D.G.atk=0;}'''); await pg.wait_for_timeout(250)
            await pg.locator('#scene').screenshot(path='/tmp/look_%s_idle.png'%uq)
            await pg.evaluate('''()=>{const D=window.__D;D.G.atk=0.4;D.G.atkT=0.4;}'''); await pg.wait_for_timeout(120)
            await pg.locator('#scene').screenshot(path='/tmp/look_%s_atk.png'%uq); shots.append(uq)
        ck('no page errors',not errs,errs)
        await pg.evaluate('()=>localStorage.removeItem("ironhold_idle_v1")'); await b.close()
        # contact sheet
        ims=[(Image.open('/tmp/look_%s_idle.png'%s),Image.open('/tmp/look_%s_atk.png'%s)) for s in shots]
        w,h=ims[0][0].size; sh=Image.new('RGB',(w*2,h*len(ims)))
        for i,(a,c) in enumerate(ims): sh.paste(a,(0,i*h)); sh.paste(c,(w,i*h))
        sh.save('/tmp/looks_game.png'); print('sheet',sh.size)
    print('FAILS',fails)
asyncio.run(main())
