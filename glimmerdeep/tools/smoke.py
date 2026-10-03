#!/usr/bin/env python3
"""Headless smoke test for Glimmerdeep (auto chess): boots the page, starts a run, buys,
drags a creature onto the board, picks a power, plays live fights and walks the reward
modals, checking for console errors.

    pip install playwright==1.56.0
    python3 glimmerdeep/tools/smoke.py [--shots DIR] [--rounds N] [--mobile] [--deep]

--deep gives the run extra gold each round so it reaches merges, bosses and later stages.
Every mode ends with The Wilds: pick a squad, walk the rooms with the arrow keys, battle a wild
creature and check the unlock (--wilds-only skips the auto-chess part).
"""
import argparse, functools, http.server, os, sys, threading, time
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
ap = argparse.ArgumentParser()
ap.add_argument('--shots', default=None)
ap.add_argument('--rounds', type=int, default=4)
ap.add_argument('--mobile', action='store_true')
ap.add_argument('--deep', action='store_true')
ap.add_argument('--wilds-only', action='store_true')
a = ap.parse_args()

class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *x): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Q, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{srv.server_address[1]}/index.html'

fails, checks = [], 0
evo_seen = False
def check(ok, what):
    global checks
    checks += 1
    print(('PASS ' if ok else 'FAIL ') + what, flush=True)
    if not ok: fails.append(what)

def shot(page, name):
    if a.shots:
        os.makedirs(a.shots, exist_ok=True)
        page.screenshot(path=os.path.join(a.shots, name + '.png'))

def center(page, sel):
    b = page.locator(sel).first.bounding_box()
    return b['x'] + b['width'] / 2, b['y'] + b['height'] / 2

def drag(page, src, dst):
    x0, y0 = center(page, src); x1, y1 = center(page, dst)
    page.mouse.move(x0, y0); page.mouse.down()
    page.mouse.move(x0 + 10, y0 + 10, steps=3); page.mouse.move(x1, y1, steps=8); page.mouse.up()
    page.wait_for_timeout(150)

def drag_sell(page, src):
    """Pointer-drag onto the sell overlay. It is display:none until the drag has moved."""
    x0, y0 = center(page, src)
    page.mouse.move(x0, y0); page.mouse.down()
    page.mouse.move(x0 + 18, y0 + 20, steps=5)
    page.wait_for_selector('#sellZone.on', timeout=2000)
    x1, y1 = center(page, '#sellZone.on')
    page.mouse.move(x1, y1, steps=12); page.mouse.up()
    page.wait_for_timeout(250)

def clear_modals(page, limit=20):
    for _ in range(limit):
        # the evolution sequence sits above everything: tap through it
        for _ in range(20):
            if page.locator('.evo').count() == 0: break
            global evo_seen
            evo_seen = True
            page.mouse.click(200, 300); page.wait_for_timeout(350)
            if page.locator('.evo').count() == 0: page.wait_for_timeout(600)   # the mutation pick opens next
        if page.locator('#modal.on').count() == 0: return
        box = page.locator('#modalBox')
        for sel in ['[data-v=ok]', '.card[data-v]', '.li.click[data-v]', '[data-v=x]', '[data-v=skip]', '[data-v]']:
            if box.locator(sel).count():
                box.locator(sel).first.click(); break
        page.wait_for_timeout(1300 if box.locator('.evo-stage').count() else 200)

def steer(page, tx, ty, ms=150):
    p = page.evaluate("[WILDS.view.px, WILDS.view.py]")
    keys = [k for k, c in (('ArrowRight', tx - p[0] > 0.25), ('ArrowLeft', tx - p[0] < -0.25), ('ArrowDown', ty - p[1] > 0.25), ('ArrowUp', ty - p[1] < -0.25)) if c]
    for k in keys: page.keyboard.down(k)
    page.wait_for_timeout(ms)
    for k in keys: page.keyboard.up(k)

def check_push(page):
    """A leftover secret-door push must not stay bright after you let go or leave the room."""
    page.evaluate("() => { const V = WILDS.view; V.keys = {}; V.joy = null; V.push = { d: 'n', t: 0.95 }; }")
    page.wait_for_timeout(120)
    held = page.evaluate("() => !!(WILDS.view.push && WILDS.view.push.t > 0)")
    check(not held, 'Wilds: letting go of a secret wall clears the push')
    door = page.evaluate("""() => {
      const V = WILDS.view, doors = WILDS.doors().filter(d => d[1] === 'open');
      if (!doors.length) return '';
      const d = doors[0][0];
      const pos = { n: [8, 0.30], s: [8, 8.70], w: [0.30, 4.5], e: [15.70, 4.5] }[d];
      const key = { n: 'u', s: 'd', w: 'l', e: 'r' }[d];
      V.px = pos[0]; V.py = pos[1]; V.keys = {}; V.keys[key] = true; V.joy = null;
      V.push = { d: d === 'n' ? 's' : 'n', t: 0.95 };
      return d;
    }""")
    ok = False
    if door:
        try:
            page.wait_for_function("() => !!WILDS.view.slide", timeout=2000)
            ok = page.evaluate("() => { const p = WILDS.view.push; return !!WILDS.view.slide && !(p && p.t > 0); }")
        except Exception:
            ok = False
    page.evaluate("() => { if (WILDS.view) { WILDS.view.keys = {}; WILDS.view.joy = null; } }")
    check(ok, 'Wilds: leaving a room clears the secret push')

def wilds(page):
    import random
    page.evaluate("GLIM.renderTitle()")
    page.click('#titleMenu [data-v=wilds]'); page.wait_for_selector('#wilds.on')
    if page.locator('#modal.on').count(): page.click('#modalBox [data-v=new]'); page.wait_for_timeout(200)
    check(page.locator('.wcard').count() >= 12, 'Wilds: the twelve free species can be picked')
    for i in range(3): page.locator('.wcard').nth(i).click()
    page.click('.wprepbar [data-v=go]'); page.wait_for_timeout(700)
    check(page.locator('#wilds.exploring').count() == 1 and page.locator('.wmem').count() == 3, 'Wilds: expedition starts with the squad')
    check_push(page)
    shot(page, '10-wilds')
    check(page.evaluate("Object.values(WILDS.state.rooms).some(a => a.tiles && /[RPS]/.test(a.tiles))"), 'Wilds: rooms have obstacle layouts')
    check(page.evaluate("Object.values(WILDS.state.rooms).every(a => !a.tiles || a.tiles.split('|')[3][6] === '.')"), 'Wilds: every room keeps its middle clear')
    before = page.evaluate("Object.keys(GLIM.meta.unlocked).length")
    rooms0 = page.evaluate("Object.values(WILDS.state.rooms).filter(a => a.visited).length")
    fought = False
    def dismiss():
        # event rooms and chests open choices on the way: decline them (or take the first)
        for _ in range(4):
            if not page.locator('#modal.on').count(): return
            box = page.locator('#modalBox')
            (box.locator('[data-v=x]') if box.locator('[data-v=x]').count() else box.locator('[data-v]')).first.click()
            page.wait_for_timeout(250)
    for _ in range(40):
        if page.locator('#game.on').count(): fought = True; break
        dismiss()
        info = page.evaluate("({ cur: WILDS.state.cur, mon: WILDS.view.mons.length ? [WILDS.view.mons[0].x, WILDS.view.mons[0].y] : null, doors: WILDS.doors() })")
        if info['mon']:
            for _ in range(80):
                if page.locator('#game.on').count(): break
                dismiss()
                m = page.evaluate("WILDS.view.mons.length ? [WILDS.view.mons[0].x, WILDS.view.mons[0].y] : null")
                if not m: break
                steer(page, m[0], m[1])
            continue
        # head for the nearest room that still has a creature, through open doors only
        step1 = page.evaluate("""() => { const W = WILDS.state, R = W.rooms, D = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };
          const open = (a, b) => b && !(b.type === 'locked' && !b.unlocked) && !(a.type === 'locked' && !a.unlocked) && !(b.type === 'secret' && !b.found) && !(a.type === 'secret' && !a.found);
          const q = [[W.cur, null]], seen = { [W.cur]: 1 };
          while (q.length) { const [k, first] = q.shift(), a = R[k];
            if (first && a.mon && !a.mon.beaten) return first;
            for (const d in D) { const k2 = (a.x + D[d][0]) + ',' + (a.y + D[d][1]), b = R[k2]; if (!seen[k2] && open(a, b)) { seen[k2] = 1; q.push([k2, first || d]); } } }
          return null; }""")
        opens = [d for d in info['doors'] if d[1] == 'open']
        d = next((x for x in opens if x[0] == step1), None) or random.choice(opens)
        for _ in range(40):
            dismiss()
            if page.locator('#game.on').count() or page.evaluate("WILDS.state.cur") != info['cur']: break
            p = page.evaluate("[WILDS.view.px, WILDS.view.py]")
            if d[0] in 'ns' and abs(p[0] - 8) > 0.3: steer(page, 8, p[1])
            elif d[0] in 'ew' and abs(p[1] - 4.5) > 0.3: steer(page, p[0], 4.5)
            else: steer(page, {'w': 0, 'e': 16}.get(d[0], p[0]), {'n': 0, 's': 9}.get(d[0], p[1]))
        page.wait_for_timeout(450)
    check(page.evaluate("Object.values(WILDS.state.rooms).filter(a => a.visited).length") > rooms0 or fought, 'Wilds: walking through a door enters the next room')
    check(fought, 'Wilds: touching a wild creature starts a battle')
    if not fought: return
    page.wait_for_timeout(1200); shot(page, '11-wilds-fight')
    page.click('#fightBar [data-v=skip]')
    page.wait_for_selector('#modal.on', timeout=60000)
    title = page.locator('#modalBox h2').inner_text()
    shot(page, '12-wilds-result')
    won = title in ('Creature unlocked!', 'Victory!', 'Shiny caught!', 'Trainer defeated!')
    after = page.evaluate("Object.keys(GLIM.meta.unlocked).length")
    check(after >= before + (1 if title == 'Creature unlocked!' else 0), f'Wilds: battle resolved ({title}), unlocks {before} -> {after}')
    page.locator('#modalBox [data-v]').first.click(); page.wait_for_timeout(400)
    check(page.locator('#wilds.on').count() == 1 or page.locator('#title.on').count() == 1, 'Wilds: back to exploring after the battle')
    if won and after > before:
        page.evaluate("GLIM.renderTitle()")
        sp = page.evaluate("Object.keys(GLIM.meta.unlocked).find(k => !GD.BASE_SPECIES.includes(k))")
        n = page.evaluate(f"GR.newRun(GLIM.meta, 5, 0).pool['{sp}']")
        check(n > 0, f'Wilds: unlocked {sp} is in the auto-chess shop pool')
    odds = page.evaluate("(() => { const m = Object.assign({}, GLIM.meta, { shinies: { cind: 1 } }); const r = GR.newRun(m, 5, 0); return [r.meta.shinySp.cind || 0, r.meta.shiny] })()")
    check(odds[0] == 1, 'Wilds: a caught shiny boosts that species in the auto-chess shop')

def check_save_guards(page):
    """Meta types, reset, Continue/Wilds safety net, and a stale second tab."""
    page.evaluate("""() => {
      localStorage.setItem('glimmerdeep.v1', JSON.stringify({
        meta: { unlocked: 'x', dex: null, shards: 'abc', wins: 3, up: { hoard: 2 }, vol: 70, sound: false },
        run: null
      }));
      localStorage.removeItem('glimmerdeep.wilds.v1');
    }""")
    page.reload(wait_until='domcontentloaded')
    page.wait_for_selector('#title.on', timeout=15000)
    info = page.evaluate("""() => {
      const pill = document.querySelector('#titleMenu .pill').textContent;
      return {
        modal: !!document.querySelector('#modal.on'),
        shards: GLIM.meta.shards, wins: GLIM.meta.wins, hoard: GLIM.meta.up && GLIM.meta.up.hoard,
        dex: GLIM.meta.dex && typeof GLIM.meta.dex, unlocked: typeof GLIM.meta.unlocked,
        sound: GLIM.meta.sound, pill
      };
    }""")
    check(not info['modal'], 'bad meta types are repaired without the start-fresh prompt')
    check(info['shards'] == 0 and 'abc' not in info['pill'] and ' shards' in info['pill'], "non-numeric shards cannot render as 'abc shards'")
    check(info['dex'] == 'object' and info['dex'] is not None and info['unlocked'] == 'object', 'dex and unlocked are objects after a poisoned save')
    check(info['wins'] == 3 and info['hoard'] == 2 and info['sound'] is False, 'valid meta numbers and sound-off are kept')
    page.evaluate("""() => {
      GLIM.meta.shards = 12;
      localStorage.setItem('glimmerdeep.wilds.v1', JSON.stringify({ v: 1, biome: 'verdant' }));
      GLIM.save();
    }""")
    page.click('#titleMenu [data-v=set]')
    page.wait_for_selector('#modalBox [data-v=reset]')
    page.click('#modalBox [data-v=reset]')
    page.wait_for_selector('#modalBox h2:has-text("Reset save?")')
    check('Reset save?' in page.locator('#modalBox h2').inner_text(), 'Reset save asks for confirmation')
    page.click('#modalBox [data-v=n]')
    page.wait_for_selector('#modalBox h2:has-text("Settings")')
    check(page.evaluate("GLIM.meta.shards") == 12, 'cancelling Reset save keeps progress')
    page.click('#modalBox [data-v=reset]')
    page.wait_for_selector('#modalBox [data-v=y]')
    page.click('#modalBox [data-v=y]')
    page.wait_for_selector('#title.on')
    reset = page.evaluate("""() => ({
      shards: GLIM.meta.shards, run: GLIM.run, main: localStorage.getItem('glimmerdeep.v1'), wilds: localStorage.getItem('glimmerdeep.wilds.v1')
    })""")
    check(reset['shards'] == 0 and not reset['run'] and reset['main'] is None and reset['wilds'] is None, 'Reset save clears the run, shards, and both save keys')
    page.evaluate("""() => {
      const r = GR.newRun(GLIM.meta, 11, 0);
      GR.giveStarter(r, 'cind');
      r.biome = 'no-such-biome';
      r.units[0].sp = 'no-such-species';
      localStorage.setItem('glimmerdeep.v1', JSON.stringify({ meta: GLIM.meta, run: r }));
      localStorage.setItem('glimmerdeep.wilds.v1', JSON.stringify({
        v: 1, biome: 'no-such-biome', floor: 1, cur: '0,0', keys: 0,
        rooms: { '0,0': { x: 0, y: 0, type: 'start', mon: { sp: 'no-such-species', star: 1 } } },
        squad: [{ sp: 'no-such-species', star: 1, hp: 1, uid: 1 }]
      }));
    }""")
    page.reload(wait_until='domcontentloaded')
    page.wait_for_selector('#title.on', timeout=15000)
    check(page.locator('#game.on').count() == 0 and page.locator('#titleMenu [data-v=cont]').count() == 0, 'unknown species and biome drop the run instead of a blank board')
    check('Save damaged: start fresh.' in page.locator('#toast').inner_text(), 'a dropped run tells you the save was damaged')
    page.evaluate("""() => {
      const r = GR.newRun(GLIM.meta, 13, 0);
      GR.giveStarter(r, 'cind');
      localStorage.setItem('glimmerdeep.v1', JSON.stringify({ meta: GLIM.meta, run: r }));
      localStorage.setItem('glimmerdeep.wilds.v1', JSON.stringify({
        v: 1, biome: 'verdant', floor: 1, cur: '0,0', keys: 0,
        rooms: { '0,0': { x: 0, y: 0, type: 'start' } },
        squad: [{ sp: 'cind', star: 1, hp: 1, uid: 1 }]
      }));
    }""")
    page.reload(wait_until='domcontentloaded')
    page.wait_for_selector('#titleMenu [data-v=cont]', timeout=15000)
    page.evaluate("""() => { GLIM.run.biome = 'no-such-biome'; GLIM.run.units[0].sp = 'no-such-species'; }""")
    page.click('#titleMenu [data-v=cont]')
    page.wait_for_function("() => !document.querySelector('#game.on') && document.querySelector('#toast').textContent.includes('Save damaged: start fresh.')")
    check(page.locator('#game.on').count() == 0 and 'Save damaged: start fresh.' in page.locator('#toast').inner_text(), 'Continue falls back to the title when the run throws')
    check(page.evaluate("!GLIM.run && !JSON.parse(localStorage.getItem('glimmerdeep.v1')).run"), 'Continue drops the damaged run save')
    page.click('#titleMenu [data-v=wilds]')
    page.wait_for_selector('#modalBox [data-v=go]')
    page.evaluate("""() => {
      localStorage.setItem('glimmerdeep.wilds.v1', JSON.stringify({
        v: 1, biome: 'no-such-biome', floor: 1, cur: '0,0', keys: 0,
        rooms: { '0,0': { x: 0, y: 0, type: 'start', mon: { sp: 'no-such-species', star: 1 } } },
        squad: [{ sp: 'no-such-species', star: 1, hp: 1, uid: 1 }]
      }));
    }""")
    page.click('#modalBox [data-v=go]')
    page.wait_for_function("() => !document.querySelector('#modal.on') && !document.querySelector('#wilds.exploring') && document.querySelector('#toast').textContent.includes('Save damaged: start fresh.')")
    check(page.locator('#wilds.exploring').count() == 0 and 'Save damaged: start fresh.' in page.locator('#toast').inner_text(), 'Wilds Continue falls back to the title for an unknown species and biome')
    check(page.evaluate("localStorage.getItem('glimmerdeep.wilds.v1')") is None, 'Wilds Continue drops the damaged expedition')
    other = page.context.new_page()
    other.goto(page.url)
    other.wait_for_selector('#title.on', timeout=15000)
    page.evaluate("""() => {
      localStorage.setItem('glimmerdeep.v1', JSON.stringify({ meta: { shards: 42, unlocked: {}, dex: {}, wins: 1 }, run: null }));
    }""")
    other.wait_for_selector('#tabNote.on', timeout=5000)
    check(other.locator('#tabNote').inner_text().strip() == 'Game updated in another tab, reload', 'another tab shows the reload banner')
    other.evaluate("""() => { GLIM.meta.shards = 7; GLIM.save(); }""")
    kept = page.evaluate("JSON.parse(localStorage.getItem('glimmerdeep.v1')).meta.shards")
    check(kept == 42, 'a stale tab does not overwrite the save after the banner')
    other.close()

def check_damaged(page):
    """A broken save must not throw, and must not leave Continue on a dead screen."""
    page.evaluate("""() => {
      const r = GR.newRun(GLIM.meta, 3, 0);
      GR.giveStarter(r, 'cind');
      localStorage.setItem('glimmerdeep.v1', JSON.stringify({ meta: GLIM.meta, run: r }));
      localStorage.removeItem('glimmerdeep.wilds.v1');
    }""")
    page.reload(wait_until='domcontentloaded')
    page.wait_for_selector('#titleMenu [data-v=cont]', timeout=15000)
    page.click('#titleMenu [data-v=cont]')
    page.wait_for_selector('#game.on .unit.mine', timeout=10000)
    check(page.evaluate("!!(GLIM.run && GLIM.run.units.length === 1 && GLIM.run.biome === 'verdant')"), 'a healthy save still Continues')
    page.evaluate("""() => {
      localStorage.setItem('glimmerdeep.v1', JSON.stringify({
        meta: { vol: 'loud', shards: 4, wins: 1 },
        run: { v: 2, biome: 'nope' }
      }));
      localStorage.setItem('glimmerdeep.wilds.v1', JSON.stringify({
        v: 1, biome: 'atlantis', cur: '0,0', rooms: {}, squad: [{ sp: 'notasp', star: 1 }]
      }));
    }""")
    page.reload(wait_until='domcontentloaded')
    page.wait_for_selector('#title.on', timeout=15000)
    check(page.locator('#titleMenu [data-v=cont]').count() == 0, 'damaged save drops the run and returns to the title')
    vol = page.evaluate("GLIM.meta.vol")
    check(isinstance(vol, (int, float)) and vol == vol and 0 <= vol <= 100, 'bad volume is coerced to a finite setting')
    page.evaluate("localStorage.setItem('glimmerdeep.v1', '{')")
    page.reload(wait_until='domcontentloaded')
    page.wait_for_selector('#modal.on', timeout=15000)
    check('Save damaged: start fresh' in page.locator('#modalBox h2').inner_text(), 'unreadable save asks to start fresh')
    page.click('#modalBox [data-v=ok]')
    page.wait_for_timeout(200)
    check(page.evaluate("!GLIM.run"), 'garbage JSON loads as a fresh save')
    page.click('#titleMenu [data-v=wilds]')
    page.wait_for_timeout(400)
    check(page.locator('#wilds.exploring').count() == 0 and page.locator('#title.on').count() == 1, 'damaged Wilds save returns to the title')
    check('Save damaged: start fresh.' in page.locator('#toast').inner_text(), 'damaged Wilds save explains itself')
    check(page.evaluate("localStorage.getItem('glimmerdeep.wilds.v1')") is None, 'damaged Wilds save is dropped')
    check_save_guards(page)

with sync_playwright() as p:
    b = p.chromium.launch()
    vp = {'width': 412, 'height': 860} if a.mobile else {'width': 1280, 'height': 800}
    page = b.new_page(viewport=vp)
    errs = []
    page.on('pageerror', lambda e: errs.append(str(e)))
    page.on('console', lambda m: m.type == 'error' and 'ERR_CERT' not in m.text and errs.append(m.text))  # sandbox proxy blocks Google Fonts
    page.goto(URL)
    page.wait_for_selector('#title.on')
    if a.wilds_only:
        wilds(page)
        check_damaged(page)
        check(not errs, 'no console errors' + ('' if not errs else ': ' + ' | '.join(errs[:5])))
        print(f'{checks - len(fails)}/{checks} checks passed')
        if not fails: print('GLIMMERDEEP SMOKE: ALL PASS')
        sys.exit(1 if fails else 0)
    shot(page, '01-title')
    page.click('#titleMenu [data-v=new]')
    page.wait_for_selector('#modal.on .card')
    check(page.locator('#modalBox .card').count() == 3, 'three starters offered')
    shot(page, '02-starter')
    page.locator('#modalBox .card').first.click()
    page.wait_for_selector('#game.on .unit.mine')
    page.evaluate("document.getElementById('toast').classList.remove('on')")
    check(page.locator('#units .unit.mine').count() == 1, 'starter is on the board')
    check(page.locator('#units .unit.preview').count() >= 1, 'next enemy board is shown')
    check(page.locator('#shop .scard[data-buy]').count() >= 4, 'shop rolled')
    # buy the cheapest card
    page.evaluate("GLIM.run.gold = Math.max(GLIM.run.gold, 3); GLIM.renderGame()")
    page.locator('#shop .scard[data-buy]:not(.poor)').first.click()
    page.wait_for_timeout(300)
    clear_modals(page)
    check(page.locator('#bench .unit.mine').count() >= 1 or page.evaluate("GLIM.run.units.length") >= 2, 'bought a creature')
    # Tamer level 1 allows one creature: buy XP, then drag the bench unit onto the board
    page.evaluate("GLIM.run.gold += 4; GLIM.renderGame()")
    page.click('#shopBtns [data-v=xp]'); page.wait_for_timeout(200)
    check(page.evaluate("GLIM.run.tlv") >= 2, 'buying XP raises the Tamer level')
    if page.locator('#bench .unit.mine').count():
        drag(page, '#bench .unit.mine', '.cell[data-x="3"][data-y="1"]')
        check(page.evaluate("GR.onBoard(GLIM.run).length") == 2, 'drag from bench to board')
    # four creatures, then a real pointer drop on the sell overlay
    page.evaluate("""() => {
      const r = GLIM.run;
      r.tlv = Math.max(r.tlv, 4);
      r.gold = 8;
      const keep = r.units.filter(u => u.at === 'b').slice(0, 1);
      r.units = keep;
      ['bubb', 'sprt', 'pebb'].forEach((sp, i) => {
        const u = GR.mkInst(r, sp, 1, { noShiny: true });
        u.at = 'b'; u.x = i + 1; u.y = 2;
        r.units.push(u);
      });
      GLIM.renderGame();
    }""")
    check(page.evaluate("GLIM.run.units.length") == 4, 'four creatures before the sell drag')
    gold0 = page.evaluate("GLIM.run.gold")
    drag_sell(page, '#units .unit.mine')
    check(page.evaluate("GLIM.run.units.length") == 3, 'drag onto the sell zone sells a creature (4 -> 3)')
    check(page.evaluate("GLIM.run.gold") > gold0, 'selling pays gold')
    drag(page, '#units .unit.mine', '.cell[data-x="0"][data-y="4"]')
    check(page.evaluate("GLIM.run.units.some(u => u.at==='b' && u.x===0 && u.y===4)"), 'drag between board cells')
    drag(page, '#units .unit.mine', '#bench .bslot')
    check(page.evaluate("GR.onBench(GLIM.run).length") >= 1, 'drag from the board to the bench')
    drag(page, '#bench .unit.mine', '.cell[data-x="2"][data-y="1"]')
    check(page.evaluate("GR.onBench(GLIM.run).length === 0 && GR.onBoard(GLIM.run).length === 3"), 'drag from the bench back onto the board')
    shot(page, '03-plan')
    # detail + loadout
    page.locator('#units .unit.mine').first.click()
    page.wait_for_selector('#modal.on .skl')
    shot(page, '04-detail')
    opts = page.locator('#modalBox .skl[data-v]')
    check(opts.count() >= 2, 'power choices listed')
    opts.nth(1).click(); page.wait_for_timeout(150)
    check('● ' in page.locator('#modalBox .skl[data-v]').nth(1).inner_text(), 'power choice sticks')
    page.click('#modalBox [data-v=close]'); page.wait_for_timeout(150)
    rounds = 0
    for r in range(a.rounds):
        if page.locator('#game.on').count() == 0: break
        if a.deep:
            page.evaluate("GLIM.run.gold += 12; GLIM.renderGame()")
        # spend: buy owned copies first, then anything, then fill the board
        page.evaluate("""() => { const r = GLIM.run;
          for (let k = 0; k < 6; k++) { const own = new Set(r.units.map(u => u.sp));
            let i = r.shop.findIndex((sp, j) => sp && own.has(sp) && GR.canBuy(r, j)); if (i < 0) i = r.shop.findIndex((sp, j) => sp && GR.canBuy(r, j));
            if (i < 0 || r.gold < 3 && !own.has(r.shop[i])) break; GR.buy(r, i); }
          if (r.gold >= 8 && r.tlv < 8) GR.buyXp(r); }""")
        page.evaluate("GLIM.renderGame()")
        # merges (and their mutation modals) happen through the real UI path
        page.evaluate("document.querySelector('#shop .scard[data-buy]:not(.poor)') || null")
        if page.locator('#shop .scard[data-buy]:not(.poor)').count() and page.evaluate("GLIM.run.gold") >= 1:
            page.locator('#shop .scard[data-buy]:not(.poor)').first.click(); page.wait_for_timeout(250)
        clear_modals(page)
        page.evaluate("GR.autoPlace(GLIM.run); GLIM.renderGame()")
        t0 = time.time()
        page.click('#shopBtns [data-v=fight]')
        page.wait_for_selector('#game.fighting')
        if r == 0:
            page.wait_for_timeout(1800); shot(page, '05-fight')
            check(page.locator('#units .unit').count() >= 2, 'fight units rendered')
        if r >= 2:
            page.click('#fightBar [data-v=skip]')
        page.wait_for_selector('#modal.on', timeout=120000)
        rounds += 1
        title = page.locator('#modalBox h2').inner_text()
        check(True, f'round {rounds} resolved: {title} ({time.time() - t0:.0f}s)')
        if r == 0: shot(page, '06-result')
        clear_modals(page)
        page.wait_for_timeout(200)
        if page.locator('#camp.on').count(): break
    check(rounds >= 1, f'{rounds} rounds played')
    # an Evo Crystal plays the evolution sequence
    if page.locator('#game.on').count():
        page.evaluate("() => { const r = GLIM.run; if (!r.units.some(u => u.star === 1)) { const u = GR.mkInst(r, 'sprt', 1); u.at = 'n'; u.slot = GR.freeBench(r); r.units.push(u); } r.items.evo = 1; GLIM.renderGame(); }")
        page.click('[data-top=bag]'); page.wait_for_selector('#modalBox [data-v="use:evo"]'); page.click('#modalBox [data-v="use:evo"]')
        page.wait_for_selector('#modalBox .li.click'); page.click('#modalBox .li.click')
        page.wait_for_selector('.evo', timeout=5000)
        page.wait_for_timeout(1400); shot(page, '09-evolving')
        clear_modals(page)
        check(evo_seen and page.locator('.evo').count() == 0, 'evolution sequence plays and closes')
    if page.locator('#game.on').count():
        page.click('[data-top=bag]'); page.wait_for_selector('#modal.on')
        shot(page, '07-bag')
        page.click('#modalBox [data-v=ok]'); page.wait_for_timeout(200)
        page.locator('#gTraits .trait').first.click(); page.wait_for_timeout(100)
        check(page.locator('#toast.on').count() == 1, 'synergy chip explains itself')
        print('state:', page.evaluate("GLIM.run ? `round ${GLIM.run.round} hp ${GLIM.run.hp} lv ${GLIM.run.tlv} units ${GLIM.run.units.map(u => u.sp + u.star).join(',')}` : 'run over'"))
        shot(page, '08-later')
    wilds(page)
    check_damaged(page)
    check(not errs, 'no console errors' + ('' if not errs else ': ' + ' | '.join(errs[:5])))
    b.close()
srv.shutdown()
print(f'{checks - len(fails)}/{checks} checks passed')
if not fails: print('GLIMMERDEEP SMOKE: ALL PASS')
sys.exit(1 if fails else 0)
