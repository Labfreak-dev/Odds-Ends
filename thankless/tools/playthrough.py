#!/usr/bin/env python3
"""Headless playthrough of Thankless with a simple healer bot.

  python3 thankless/tools/playthrough.py [--fast 8] [--circle 0] [--tree] [--shots]

The bot keeps the healer near the party, steers away from enemies, chases
motes when mana is low and casts spells when they are useful. It prints the
party's state every game minute and the run's result. --tree buys every
training rank first (a maxed save) to see the ceiling; --shots saves
screenshots to the scratch dir.
"""
import sys, os, json, argparse, time
from playwright.sync_api import sync_playwright

ap=argparse.ArgumentParser()
ap.add_argument('--fast',type=float,default=8)
ap.add_argument('--circle',type=int,default=0)
ap.add_argument('--tree',action='store_true')
ap.add_argument('--field',type=int,default=0)
ap.add_argument('--nobuffs',action='store_true',help='the bot never casts Bless, Haste or Fortify (a control run)')
ap.add_argument('--novice',action='store_true',help='plays like a first-timer: random cards, slow lazy movement, weak fleeing, no mote chasing')
ap.add_argument('--pref',default='',help='comma list: level-up preference order for the bot')
ap.add_argument('--healer',default='',help='wren, ansel or ivy')
ap.add_argument('--party',default='',help='comma list of 3 member keys; unlocks everything')
ap.add_argument('--shots',action='store_true')
ap.add_argument('--every',type=float,default=60,help='log interval in game seconds')
ap.add_argument('--url',default='',help='page to drive instead of ../index.html (tests of a packed copy)')
ap.add_argument('--stop',type=float,default=0,help='stop after this many game seconds')
a=ap.parse_args()

HERE=os.path.dirname(os.path.abspath(__file__))
URL=a.url or 'file://'+os.path.join(HERE,'..','index.html')
OUT=os.environ.get('TL_SHOTS',os.path.join(HERE,'..','..','..','shots'))

BOT=r"""
(() => {
  const TL=window.TL;
  TL.inputOverride=function(){
    const G=TL.G; if(!G) return {x:0,y:0};
    const h=G.healer;
    // point of interest: most wounded alive ally, else party centroid
    let target=null, best=1.01;
    for(const m of G.party){ if(!m.alive) continue; const r=m.hp/m.maxhp; if(r<best){best=r;target=m;} }
    const alive=G.party.filter(m=>m.alive);
    let cx=h.x, cy=h.y;
    if(alive.length){cx=alive.reduce((s,m)=>s+m.x,0)/alive.length; cy=alive.reduce((s,m)=>s+m.y,0)/alive.length;}
    let tx=cx, ty=cy;
    if(target && best<0.6){ tx=(cx+target.x)/2; ty=(cy+target.y)/2; }
    // events: go where the event is
    const ev=G.event; if(ev&&!ev.done){ if(ev.id==='shrine'){tx=ev.x;ty=ev.y;} else if(ev.id==='pilgrim'&&ev.npc.alive){tx=ev.npc.x;ty=ev.npc.y-30;} else if(ev.id==='moterain'){let bg=null,bd=1e9;for(const g of G.gems){if(!g.ev)continue;const d=Math.hypot(g.x-h.x,g.y-h.y);if(d<bd){bd=d;bg=g;}}if(bg){tx=bg.x;ty=bg.y;}} }
    // chests: always worth the walk
    if(G.chests.length){let bc=null,bd=1e9;for(const c of G.chests){const d=Math.hypot(c.x-h.x,c.y-h.y);if(d<bd){bd=d;bc=c}}if(bd<700){tx=bc.x;ty=bc.y;}}
    // graves: go revive if the spell is ready
    if(G.graves.length && h.mana>=window.TL.reviveCost()){ tx=G.graves[0].x; ty=G.graves[0].y; }
    // low mana: nearest mote
    if(h.mana<h.manaMax*0.45 && G.gems.length){ let bg=null,bd=1e9; for(const g of G.gems){const d=Math.hypot(g.x-h.x,g.y-h.y); if(d<bd){bd=d;bg=g;}} if(bg && bd<420){tx=bg.x;ty=bg.y;} }
    if(NOVICE){ tx=cx+Math.sin(G.t*0.7)*60; ty=cy+Math.cos(G.t*0.5)*60; if(G.graves.length && h.mana>=window.TL.reviveCost() && G.t-(window.__nvRev||0)>6){tx=G.graves[0].x;ty=G.graves[0].y;} }
    let vx=tx-h.x, vy=ty-h.y; const d=Math.hypot(vx,vy);
    if(d<40 && !(h.mana<h.manaMax*0.45 && G.gems.length)){vx=0;vy=0;} else if(d>0){vx/=d;vy/=d;}
    // flee enemies
    const holding=ev&&!ev.done&&ev.id==='shrine'&&h.hp>h.maxhp*0.5;
    for(const e of G.enemies){ const ex=h.x-e.x, ey=h.y-e.y, ed=Math.hypot(ex,ey); const R=NOVICE?(e.boss?120:70):(e.boss?200:(holding?50:120)); if(ed<R){ const k=(R-ed)/R*(NOVICE?1.2:(e.boss?4:2.6)); vx+=ex/ed*k; vy+=ey/ed*k; } }
    const n=Math.hypot(vx,vy); if(n>1){vx/=n;vy/=n;}
    // spells: revive first, then keep buffs rolling, then heal
    const near=m=>G.enemies.filter(e=>Math.hypot(e.x-m.x,e.y-m.y)<220).length;
    const busiest=alive.filter(m=>Math.hypot(m.x-h.x,m.y-h.y)<h.range).sort((a,b)=>near(b)-near(a))[0];
    if(G.graves.length && h.mana>=window.TL.reviveCost()){ if(!NOVICE||Math.hypot(G.graves[0].x-h.x,G.graves[0].y-h.y)<h.range){TL.cast(window.TL.REV); window.__nvRev=G.t;} }
    const tank=G.party.find(m=>m.key==='tank')||{alive:false};
    return {x:vx,y:vy};
  };
})();
"""

def main():
    with sync_playwright() as p:
        b=p.chromium.launch()
        pg=b.new_page(viewport={'width':1100,'height':700})
        errors=[]
        pg.on('pageerror',lambda e:errors.append(str(e)))
        pg.on('console',lambda m: errors.append('console.'+m.type+': '+m.text) if m.type in ('error',) else None)
        pg.goto(URL)
        pg.wait_for_function('window.TL && document.getElementById("start")')
        if a.tree:
            pg.evaluate("""()=>{const M=window.TL.META; for(const n of window.TL.TREE){M.tree[n.id]=n.max;} M.gold=0; for(const r of window.TL.RELICS)M.relicsSeen[r.id]=1;}""")
        pg.evaluate(f"()=>{{window.TL.META.circle={a.circle}; window.TL.META.maxCircle=Math.max(window.TL.META.maxCircle,{a.circle},{a.field}); window.TL.META.field={a.field};}}")
        if a.healer:
            pg.evaluate("(k)=>{const M=window.TL.META; M.unlockAll=true; M.healer=k; window.TL.save(); location.reload();}", a.healer)
            pg.wait_for_function('window.TL && document.getElementById("start")')
        if a.party:
            pg.evaluate("(p)=>{const M=window.TL.META; M.unlockAll=true; M.party=p.split(','); window.TL.save&&window.TL.save(); location.reload();}", a.party)
            pg.wait_for_function('window.TL && document.getElementById("start") && !document.getElementById("start").disabled')
        pg.click('#start')
        pg.wait_for_function('window.TL.G')
        if a.pref: pg.evaluate('(p)=>{window.__pref=p.split(",")}',a.pref)
        if a.novice: pg.evaluate('()=>{window.__novice=true}')
        pg.evaluate(BOT.replace('(() => {','(() => { const NOBUFFS='+('true' if a.nobuffs else 'false')+'; const NOVICE='+('true' if a.novice else 'false')+';',1))
        pg.evaluate(f'()=>window.TL.setFast({a.fast})')
        if a.shots: os.makedirs(OUT,exist_ok=True)
        last_min=-1; t0=time.time()
        while True:
            # auto-pick level-ups
            st=pg.evaluate("""()=>{const G=window.TL.G; if(!G) return null; if(G.lvOpen){const p=G.pendingPicks; const pref=(window.__pref||['sp_surge','sp_fortify','pdmg','power','sp_bless','php','sp_mending','sp_haste','w_ember','w_knife','w_hymnal','w_smite','w_whip','w_cross','w_wand','w_candle','w_water','w_incense','haste','holy','overheal','coffee','regen','mana','thorns','hot','chain','magnet','manners','glasses','range','cdr','boots','vit']); const ix=x=>{const i=pref.indexOf(x.id);return i<0?99:i};let c=window.__novice?p[Math.floor(Math.random()*p.length)]:p.slice().sort((x,y)=>ix(x)-ix(y))[0]; window.TL.chooseUp(c.id);} 
              const h=G.healer; return {t:G.t,over:G.over,won:G.won,level:G.level,kills:G.kills,enemies:G.enemies.length,hp:Math.round(h.hp),hk:h.kills,mana:Math.round(h.mana),manaMax:Math.round(h.manaMax),gold:Math.round(G.gold),
                party:G.party.map(m=>m.name+'L'+m.lvl+'g'+Math.round(m.grat||0)+':'+(m.alive?Math.round(m.hp)+'/'+m.maxhp+(m.asleep?'z':'')+(m.panicT>0?'!':''):'DOWN')), stats:G.stats, up:G.up, healPower:Math.round(h.healPower), fast:G.fast, relics:G.relics.join(','), chests:G.chests.length}}""")
            if st is None: break
            m=int(st['t']//a.every)
            if m!=last_min:
                last_min=m
                print(f"[{int(st['t'])//60}:{int(st['t'])%60:02d}] lv{st['level']} kills {st['kills']} foes {st['enemies']} | Wren {st['hp']} k{st['hk']} mana {st['mana']}/{st['manaMax']} heal {st['healPower']} | "+' '.join(st['party'])+f" | healed {int(st['stats']['healed'])} ff {st['stats']['ff']} naps {st['stats']['naps']} oom {st['stats']['oom']}")
                if a.shots: pg.screenshot(path=os.path.join(OUT,f'tl-{m:03d}.png'))
            if st['over']:
                print('ULTS:', pg.evaluate("()=>JSON.stringify({total:G.stats.ults||0,by:G.stats.ultsBy||{}})"))
                print('RESULT:', 'WON' if st['won'] else 'LOST', pg.evaluate("()=>document.getElementById('ovtitle').textContent"), 'at', f"{int(st['t'])//60}:{int(st['t'])%60:02d}", 'gold', st['gold'], 'relics', st['relics'] or 'none', 'events', pg.evaluate('()=>(window.TL.G.stats.eventsWon||0)+"/"+(window.TL.G.stats.events||0)'), 'skills', pg.evaluate('()=>window.TL.G.party.map(m=>m.name+":"+Object.entries(m.skills).map(([k,v])=>k+v).join("+")).join(" ")'), 'upgrades', json.dumps(st['up']))
                break
            if a.stop and st['t']>=a.stop: print('STOPPED at',int(st['t']),'s, art keys ready:',pg.evaluate('()=>Object.keys(window.TL.ART.ready).length')); break
            if time.time()-t0>400: print('TIMEOUT'); break
            pg.wait_for_timeout(250)
        pg.wait_for_timeout(1200)
        try: print('STORY:', ' | '.join(pg.evaluate("()=>[...document.querySelectorAll('#ovstory div')].map(d=>d.textContent)")))
        except Exception: pass
        if a.shots: pg.screenshot(path=os.path.join(OUT,'tl-end.png'))
        if errors: print('ERRORS:'); [print(' ',e) for e in errors]
        else: print('no page errors')
        b.close()
        return 1 if errors else 0

sys.exit(main())
