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
    // graves: go revive if the spell is ready
    if(G.graves.length && h.cd[3]<=0){ tx=G.graves[0].x; ty=G.graves[0].y; }
    // low mana: nearest mote
    if(h.mana<h.manaMax*0.45 && G.gems.length){ let bg=null,bd=1e9; for(const g of G.gems){const d=Math.hypot(g.x-h.x,g.y-h.y); if(d<bd){bd=d;bg=g;}} if(bg && bd<420){tx=bg.x;ty=bg.y;} }
    let vx=tx-h.x, vy=ty-h.y; const d=Math.hypot(vx,vy);
    if(d<40 && !(h.mana<h.manaMax*0.45 && G.gems.length)){vx=0;vy=0;} else if(d>0){vx/=d;vy/=d;}
    // flee enemies
    for(const e of G.enemies){ const ex=h.x-e.x, ey=h.y-e.y, ed=Math.hypot(ex,ey); const R=e.boss?200:120; if(ed<R){ const k=(R-ed)/R*(e.boss?4:2.6); vx+=ex/ed*k; vy+=ey/ed*k; } }
    const n=Math.hypot(vx,vy); if(n>1){vx/=n;vy/=n;}
    // spells
    if(G.graves.length && h.cd[3]<=0 && h.mana>=60){ TL.cast(3); }
    if(target && best<0.45 && h.cd[0]<=0 && h.mana>=30) TL.cast(0);
    const tank=G.party[0]; if(tank.alive && tank.asleep && h.cd[2]<=0 && h.mana>=20 && G.enemies.length>4) TL.cast(2);
    if(h.cd[1]<=0 && h.mana>=40 && alive.filter(m=>m.hp<m.maxhp*0.7).length>=2) TL.cast(1);
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
            pg.evaluate("""()=>{const M=window.TL.META; for(const n of window.TL.TREE){M.tree[n.id]=n.max;} M.gold=0;}""")
        pg.evaluate(f"()=>{{window.TL.META.circle={a.circle}; window.TL.META.maxCircle=Math.max(window.TL.META.maxCircle,{a.circle});}}")
        pg.click('#start')
        pg.wait_for_function('window.TL.G')
        pg.evaluate(BOT)
        pg.evaluate(f'()=>window.TL.setFast({a.fast})')
        if a.shots: os.makedirs(OUT,exist_ok=True)
        last_min=-1; t0=time.time()
        while True:
            # auto-pick level-ups
            st=pg.evaluate("""()=>{const G=window.TL.G; if(!G) return null; if(G.lvOpen){const p=G.pendingPicks; const pref=['pdmg','power','php','haste','holy','overheal','coffee','regen','mana','thorns','hot','chain','magnet','manners','glasses','range','cdr','boots','vit']; let c=p.slice().sort((x,y)=>pref.indexOf(x.id)-pref.indexOf(y.id))[0]; window.TL.chooseUp(c.id);} 
              const h=G.healer; return {t:G.t,over:G.over,won:G.won,level:G.level,kills:G.kills,enemies:G.enemies.length,hp:Math.round(h.hp),mana:Math.round(h.mana),manaMax:Math.round(h.manaMax),gold:Math.round(G.gold),
                party:G.party.map(m=>m.name+':'+(m.alive?Math.round(m.hp)+'/'+m.maxhp+(m.asleep?'z':'')+(m.panicT>0?'!':''):'DOWN')), stats:G.stats, up:G.up, healPower:Math.round(h.healPower), fast:G.fast}}""")
            if st is None: break
            m=int(st['t']//a.every)
            if m!=last_min:
                last_min=m
                print(f"[{int(st['t'])//60}:{int(st['t'])%60:02d}] lv{st['level']} kills {st['kills']} foes {st['enemies']} | Wren {st['hp']} mana {st['mana']}/{st['manaMax']} heal {st['healPower']} | "+' '.join(st['party'])+f" | healed {int(st['stats']['healed'])} ff {st['stats']['ff']} naps {st['stats']['naps']} oom {st['stats']['oom']}")
                if a.shots: pg.screenshot(path=os.path.join(OUT,f'tl-{m:03d}.png'))
            if st['over']:
                print('RESULT:', 'WON' if st['won'] else 'LOST', pg.evaluate("()=>document.getElementById('ovtitle').textContent"), 'at', f"{int(st['t'])//60}:{int(st['t'])%60:02d}", 'gold', st['gold'], 'upgrades', json.dumps(st['up']))
                break
            if a.stop and st['t']>=a.stop: print('STOPPED at',int(st['t']),'s, art keys ready:',pg.evaluate('()=>Object.keys(window.TL.ART.ready).length')); break
            if time.time()-t0>400: print('TIMEOUT'); break
            pg.wait_for_timeout(250)
        pg.wait_for_timeout(1200)
        if a.shots: pg.screenshot(path=os.path.join(OUT,'tl-end.png'))
        if errors: print('ERRORS:'); [print(' ',e) for e in errors]
        else: print('no page errors')
        b.close()
        return 1 if errors else 0

sys.exit(main())
