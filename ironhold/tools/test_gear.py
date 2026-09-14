from playwright.sync_api import sync_playwright
import json
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':900,'height':950})
    pg.on('pageerror',lambda e: errs.append(str(e))); pg.on('console',lambda m: errs.append(m.text) if m.type=='error' else None)
    pg.goto('http://localhost:8899/dbg6/index.html'); pg.wait_for_timeout(3500)
    r=pg.evaluate("""()=>{const D=window.__D;D.silence();D.G.sim=true;for(const k of ['atk','str','def','hp','rng','mag'])D.S.xp[k]=200000;
      const fails=[];let n=0;const S=D.S;
      const clear=()=>{for(const s of D.SLOTS)S.equip[s]=null;};
      const diff=(a,b)=>{const o={};for(const k in b)if(b[k]!==a[k])o[k]=+(b[k]-a[k]).toFixed(3);return o;};
      const near=(x,y)=>Math.abs(x-y)<=1.0001;   // rounding in itemStats
      // 1. every generatable piece: base stats + affixes land in bonuses exactly, off-style kit at 0.4 attack
      const styles={melee:D.makeItem(7,'weapon',1,2),ranged:D.makeItem(7,'weapon',1,6),magic:D.makeItem(7,'weapon',1,11)};
      for(const sty in styles){clear();S.equip.weapon=styles[sty];const b0=D.bonuses();
        for(let tier=0;tier<8;tier++)for(const slot of D.SLOTS){if(slot==='weapon')continue;
          const arms=[null].concat(D.ARM_FOR[slot]||[]);
          for(const arm of arms)for(const rar of [1,3,5,7]){
            const it=D.makeItem(tier,slot,rar,undefined,arm===null?0:arm);n++;
            S.equip[slot]=it;const b1=D.bonuses();S.equip[slot]=null;
            const st=D.itemStats(it);const d=diff(b0,b1);const off=it.arm&&D.ARMK[it.arm].style!==sty;
            const exp={};if(st.atk)exp.atk=+(st.atk*(off?0.4:1)).toFixed(3);if(st.str)exp.str=st.str;if(st.def)exp.def=st.def;for(const k in it.aff)exp[k]=(exp[k]||0)+it.aff[k];
            for(const k of new Set([...Object.keys(exp),...Object.keys(d)]))if(!near(exp[k]||0,d[k]||0)){fails.push(`${sty} ${D.itemName(it)} [${slot}${arm?' '+arm:''} t${tier} r${rar}] ${k}: expected ${exp[k]||0} got ${d[k]||0}`);break;}}}}
      // 2. weapons: every type at every tier, base + affixes, and the +up multiplier
      clear();for(let tier=0;tier<8;tier++)for(let wt=0;wt<15;wt++)for(const rar of [1,4,7]){const it=D.makeItem(tier,'weapon',rar,wt);n++;
        S.equip.weapon=null;const b0=D.bonuses();S.equip.weapon=it;const b1=D.bonuses();const st=D.itemStats(it);const d=diff(b0,b1);
        const exp={atk:st.atk,str:st.str};if(st.def)exp.def=st.def;for(const k in it.aff)exp[k]=(exp[k]||0)+it.aff[k];
        for(const k of new Set([...Object.keys(exp),...Object.keys(d)]))if(!near(exp[k]||0,d[k]||0)){fails.push(`weapon ${D.itemName(it)} ${k}: expected ${exp[k]||0} got ${d[k]||0}`);break;}
        it.up=5;const st5=D.itemStats(it);if(!(st5.atk===Math.round(it.base.atk*1.3)&&st5.str===Math.round(it.base.str*1.3)))fails.push(`upgrade scaling off on ${D.itemName(it)}`);}
      // 3. uniques: effect rides in as affixes, style requirement follows the weapon
      clear();for(const u in D.UNIQUES){if(D.UNIQUES[u].wt===undefined)continue;const it=D.makeUnique(u);n++;
        for(const k in D.UNIQUES[u].eff)if(it.aff[k]!==D.UNIQUES[u].eff[k])fails.push(`unique ${u} lost effect ${k}`);
        S.equip.weapon=null;const b0=D.bonuses();S.equip.weapon=it;const b1=D.bonuses();for(const k in it.aff)if(!near((b1[k]-b0[k]),it.aff[k]+(D.itemStats(it)[k]||0)))fails.push(`unique ${u} ${k} not applied`);
        const req=D.reqFor(it);const want=D.WEAPONS[it.wt].style==='ranged'?'rng':D.WEAPONS[it.wt].style==='magic'?'mag':'atk';if(req.s!==want)fails.push(`unique ${u} requires ${req.s}, weapon style says ${want}`);}
      // 4. sets: 2 and 4 pieces pay exactly b2 and b4, uniques/sets refuse the bench
      clear();for(const sk in D.SETS){const T=D.SETS[sk];const sl=D.setSlots(sk);n++;
        clear();S.equip.weapon=styles[T.arm==='hide'?'ranged':T.arm==='robe'?'magic':'melee'];const b0=D.bonuses();
        const pcs=sl.map(s=>D.makeSetPiece(sk,s));
        S.equip[pcs[0].slot]=pcs[0];const b1=D.bonuses();for(const e in T.b2)if(b1[e]-b0[e]>= T.b2[e]+(D.itemStats(pcs[0])[e]||0)+(pcs[0].aff[e]||0))fails.push(`set ${sk} paid b2 at one piece`);
        S.equip[pcs[1].slot]=pcs[1];const b2=D.bonuses();for(const e in T.b2){const base=(D.itemStats(pcs[0])[e]||0)+(D.itemStats(pcs[1])[e]||0)+(pcs[0].aff[e]||0)+(pcs[1].aff[e]||0);if(!near(b2[e]-b0[e]-base,T.b2[e]))fails.push(`set ${sk} b2 ${e}: ${b2[e]-b0[e]-base} vs ${T.b2[e]}`);}
        if(pcs.length>=4){S.equip[pcs[2].slot]=pcs[2];S.equip[pcs[3].slot]=pcs[3];const b4=D.bonuses();for(const e in T.b4){let base=0;for(const q of pcs)base+=(D.itemStats(q)[e]||0)+(q.aff[e]||0);const b2e=T.b2[e]||0;if(!near(b4[e]-b0[e]-base-b2e,T.b4[e]))fails.push(`set ${sk} b4 ${e}: ${b4[e]-b0[e]-base-b2e} vs ${T.b4[e]}`);}}
        if(D.canCraft(pcs[0]))fails.push(`set piece ${sk} is craftable`);}
      // 5. runewords: each inscribes on a legal slot, applies its effect, refuses an illegal one
      clear();S.equip.weapon=styles.melee;for(const rw of D.RUNEWORDS){n++;S.runes=[9,9,9,9,9,9];const slot=rw.slots[0];const it=slot==='weapon'?D.makeItem(5,'weapon',1,2):D.makeItem(5,slot,1);it.aff={};
        const ok=D.inscribe(it,rw);if(!ok){fails.push(`runeword ${rw.n} refused on ${slot}`);continue;}
        const prev=S.equip[slot];S.equip[slot]=null;const b0=D.bonuses();S.equip[slot]=it;const b1=D.bonuses();S.equip[slot]=prev;
        for(const e in rw.eff){const base=(D.itemStats(it)[e]||0);if(!near(b1[e]-b0[e]-base,rw.eff[e]))fails.push(`runeword ${rw.n} ${e}: ${b1[e]-b0[e]-base} vs ${rw.eff[e]}`);}
        const bad=D.SLOTS.find(s=>!rw.slots.includes(s));if(bad){const it2=D.makeItem(5,bad,1);if(D.inscribe(it2,rw))fails.push(`runeword ${rw.n} accepted on ${bad}`);}}
      // 6. level gates: equip() refuses gear above the skill
      clear();for(const k of ['atk','rng','mag','def'])S.xp[k]=0;S.inv=[D.makeItem(7,'weapon',1,2),D.makeItem(7,'weapon',1,6),D.makeItem(7,'body',1)];
      for(const it of S.inv.slice()){D.equip(it);if(S.equip[it.slot]===it)fails.push(`equipped ${D.itemName(it)} at level 1`);}
      for(const k of ['atk','str','def','hp','rng','mag'])S.xp[k]=200000;
      // 7. the look follows the body, by style, kit and set
      const look=(w,body)=>{S.equip.weapon=w;S.equip.body=body;return D.lookKey();};
      const L=[];for(const [sty,w,kind,P] of [['melee',styles.melee,0,'lk_'],['ranged',styles.ranged,'hide','lk_bow_'],['magic',styles.magic,'robe','lk_wiz_']]){
        if(look(w,null)!==P+'base')fails.push(`${sty} bare look ${look(w,null)}`);
        for(let t=0;t<8;t++){const k=look(w,D.makeItem(t,'body',1,0,kind));if(k!==P+'kit_'+t)fails.push(`${sty} tier ${t} look ${k}`);if(!D.sprReady(k+'_atk'))fails.push(`${k} attack art not ready`);}
        for(const sk in D.SETS){const T=D.SETS[sk];if((T.arm||'plate')!==(kind||'plate'))continue;const k=look(w,D.makeSetPiece(sk,'body'));const want=P+(sk.indexOf('set_')===0?sk:'set_'+sk);if(k!==want)fails.push(`${sty} set ${sk} look ${k} wanted ${want}`);}}
      // 8. two-handed weapons and shields exclude each other through equip()
      clear();S.inv=[];const sh=D.makeItem(3,'shield',1),gs=D.makeItem(3,'weapon',1,4);S.inv.push(sh,gs);D.equip(sh);D.equip(gs);
      if(S.equip.shield||S.equip.weapon!==gs)fails.push('greatsword did not unseat the shield');D.equip(S.inv.find(x=>x===sh));if(S.equip.weapon||S.equip.shield!==sh)fails.push('shield did not unseat the greatsword');
      clear();S.inv=[];D.G.sim=false;return {checked:n,fails};}""")
    print('champion gear: %d checks, %d failures'%(r['checked'],len(r['fails'])))
    for f in r['fails'][:30]: print('   ',f)
    b.close()
print('errors:',len(errs),errs[:3])
