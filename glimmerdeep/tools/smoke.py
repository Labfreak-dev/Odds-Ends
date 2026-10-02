#!/usr/bin/env python3
"""Headless smoke test for Glimmerdeep (auto chess): boots the page, starts a run, buys,
drags a creature onto the board, picks a power, plays live fights and walks the reward
modals, checking for console errors.

    pip install playwright==1.56.0
    python3 glimmerdeep/tools/smoke.py [--shots DIR] [--rounds N] [--mobile] [--deep]

--deep gives the run extra gold each round so it reaches merges, bosses and later stages.
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
a = ap.parse_args()

class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *x): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Q, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{srv.server_address[1]}/index.html'

fails, checks = [], 0
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

def clear_modals(page, limit=20):
    for _ in range(limit):
        if page.locator('#modal.on').count() == 0: return
        box = page.locator('#modalBox')
        for sel in ['[data-v=ok]', '.card[data-v]', '.li.click[data-v]', '[data-v=x]', '[data-v=skip]', '[data-v]']:
            if box.locator(sel).count():
                box.locator(sel).first.click(); break
        page.wait_for_timeout(1300 if box.locator('.evo-stage').count() else 200)

with sync_playwright() as p:
    b = p.chromium.launch()
    vp = {'width': 412, 'height': 860} if a.mobile else {'width': 1280, 'height': 800}
    page = b.new_page(viewport=vp)
    errs = []
    page.on('pageerror', lambda e: errs.append(str(e)))
    page.on('console', lambda m: m.type == 'error' and 'ERR_CERT' not in m.text and errs.append(m.text))  # sandbox proxy blocks Google Fonts
    page.goto(URL)
    page.wait_for_selector('#title.on')
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
    if page.locator('#game.on').count():
        page.click('[data-top=bag]'); page.wait_for_selector('#modal.on')
        shot(page, '07-bag')
        page.click('#modalBox [data-v=ok]'); page.wait_for_timeout(200)
        page.locator('#gTraits .trait').first.click(); page.wait_for_timeout(100)
        check(page.locator('#toast.on').count() == 1, 'synergy chip explains itself')
        print('state:', page.evaluate("GLIM.run ? `round ${GLIM.run.round} hp ${GLIM.run.hp} lv ${GLIM.run.tlv} units ${GLIM.run.units.map(u => u.sp + u.star).join(',')}` : 'run over'"))
        shot(page, '08-later')
    check(not errs, 'no console errors' + ('' if not errs else ': ' + ' | '.join(errs[:5])))
    b.close()
srv.shutdown()
print(f'{checks - len(fails)}/{checks} checks passed')
if not fails: print('GLIMMERDEEP SMOKE: ALL PASS')
sys.exit(1 if fails else 0)
