#!/usr/bin/env python3
"""Headless smoke test for Glimmerdeep: boots the page, starts a run, plays
battles on Auto, walks through the reward modals and checks for console errors.

    pip install playwright==1.56.0
    python3 glimmerdeep/tools/smoke.py [--shots DIR] [--nodes N]
"""
import argparse, functools, http.server, os, sys, threading, time
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
ap = argparse.ArgumentParser()
ap.add_argument('--shots', default=None)
ap.add_argument('--nodes', type=int, default=6)
ap.add_argument('--mobile', action='store_true')
ap.add_argument('--deep', action='store_true', help='boost the party and wander every node type')
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

with sync_playwright() as p:
    b = p.chromium.launch()
    vp = {'width': 412, 'height': 860} if a.mobile else {'width': 1280, 'height': 800}
    page = b.new_page(viewport=vp)
    errs = []
    page.on('pageerror', lambda e: errs.append(str(e)))
    page.on('console', lambda m: m.type == 'error' and 'ERR_CERT' not in m.text and errs.append(m.text))  # sandbox proxy blocks Google Fonts
    page.goto(URL)
    page.wait_for_selector('#title.on')
    check(page.locator('#titleMenu [data-v=new]').count() == 1, 'title menu renders')
    shot(page, '01-title')
    page.click('#titleMenu [data-v=new]')
    page.wait_for_selector('#pick.on .card')
    check(page.locator('#pickCards .card').count() == 3, 'three starters offered')
    shot(page, '02-pick')
    page.locator('#pickCards .card').first.click()
    page.wait_for_selector('#map.on .node.can')
    check(page.locator('.node').count() > 10, 'map has nodes')
    page.evaluate("document.getElementById('toast').classList.remove('on')")
    shot(page, '03-map')
    # team and bag screens open
    if True:
        page.click('[data-top=team]'); page.wait_for_selector('#modal.on')
        shot(page, '07-team')
        page.locator('#modalBox .li.click').first.click(); page.wait_for_timeout(200)
        shot(page, '08-detail')
        check(page.locator('#modalBox .stats').count() == 1, 'creature detail shows stats')
        page.click('#modalBox [data-v=back]'); page.wait_for_timeout(150)
        page.click('#modalBox [data-v=close]'); page.wait_for_timeout(150)
        page.click('[data-top=bag]'); page.wait_for_selector('#modal.on')
        shot(page, '09-bag')
        page.click('#modalBox [data-v=ok]')
        # the camp, the dex and the help open from the title too
        page.click('[data-top=menu]'); page.wait_for_selector('#modal.on')
        page.click('#modalBox [data-v=how]'); page.wait_for_timeout(150)
        check(page.locator('#modalBox .how').count() == 1, 'how-to-play opens')
        page.click('#modalBox [data-v=ok]'); page.wait_for_timeout(150)
    if a.deep:
        # a stronger party so the run reaches evolutions, later acts and the shop/event flows
        page.evaluate("""() => { const r = GLIM.run; r.gold = 400; r.items = {berry: 3, revive: 2, candy: 2, evo: 1, bomb: 2, elixir: 1, lure: 1};
          r.charms = ['fang', 'lens']; for (const p of r.party) { p.lvl = 6; p.xp = 0; } GLIM.renderMap(); }""")
    import random
    rnd = random.Random(7)
    seen_types = set()
    battles = 0
    for step in range(a.nodes):
        if page.locator('#map.on').count() == 0 and page.locator('#title.on, #camp.on').count():
            break
        # prefer fights so the smoke exercises battle + rewards
        nodes = page.locator('.node.can')
        n = nodes.count()
        if not n:
            break
        pick_i = 0
        for i in range(n):
            t = nodes.nth(i).get_attribute('title')
            if t in ('Wild battle', 'Elite battle', 'Boss'): pick_i = i; break
        if a.deep: pick_i = rnd.randrange(n)
        title = nodes.nth(pick_i).get_attribute('title')
        seen_types.add(title)
        nodes.nth(pick_i).click(force=True)
        t0 = time.time()
        if title in ('Wild battle', 'Elite battle', 'Boss'):
            page.wait_for_selector('#battle.on .chip')
            if battles == 0:
                shot(page, '04-battle-plan')
                # pick the second skill for the first creature, then fight one round by hand
                chips = page.locator('#cmdRows .crow').first.locator('.chip:not(.cd)')
                if chips.count() > 1: chips.nth(1).click()
                check(page.locator('#cmdRows .chip.sel').count() >= 1, 'skill chips selectable')
                page.locator('.mon.side1').first.click()
                check(page.locator('.mon.focus').count() == 1, 'focus marker on tapped foe')
                page.click('#cmdFoot [data-c=fight]')
                page.wait_for_timeout(700)
                shot(page, '05-battle-anim')
            page.click('#cmdFoot [data-c=speed]'); page.click('#cmdFoot [data-c=speed]')
            if 'toggle on' not in (page.locator('#cmdFoot [data-c=auto]').get_attribute('class') or ''):
                page.click('#cmdFoot [data-c=auto]')
            page.wait_for_selector('#modal.on', timeout=240000)
            battles += 1
            check(True, f'battle {battles} resolved ({title}) in {time.time() - t0:.0f}s')
            if battles == 1: shot(page, '06-rewards')
        # click through whatever modals appear
        for _ in range(30):
            if page.locator('#modal.on').count() == 0:
                # a mystery can start a fight
                if page.locator('#battle.on').count():
                    if 'toggle on' not in (page.locator('#cmdFoot [data-c=auto]').get_attribute('class') or ''):
                        page.click('#cmdFoot [data-c=auto]')
                    page.wait_for_selector('#modal.on, #map.on', timeout=240000)
                    if page.locator('#modal.on').count() == 0: break
                    continue
                break
            box = page.locator('#modalBox')
            if box.locator('.shopitem').count() and a.deep and 'Shop' not in seen_types:
                seen_types.add('Shop')
                box.locator('.shopitem:not(.sold):not(.poor)').first.click(); page.wait_for_timeout(200)
                check(True, 'bought something in the shop')
            for sel in ['[data-v=ok]', '[data-v=go]', '[data-v=leave]', '.card[data-v]', '[data-v=heal]', '[data-v=skip]', '.li.click[data-v]', '[data-v="0"]', '[data-v]']:
                if box.locator(sel).count():
                    box.locator(sel).first.click(); break
            page.wait_for_timeout(1700 if box.locator('.evo-stage').count() else 250)
        page.wait_for_timeout(200)
    check(battles >= 1, f'{battles} battles played')
    if a.deep:
        lv = page.evaluate("GLIM.run ? GLIM.run.party.map(p => p.sp + p.stage + ' L' + p.lvl).join(', ') : 'run over'")
        print('node types visited:', sorted(t for t in seen_types if t), '| party:', lv, '| act', page.evaluate("GLIM.run ? GLIM.run.act + 1 : '-'"))
    check(not errs, 'no console errors' + ('' if not errs else ': ' + ' | '.join(errs[:5])))
    b.close()
srv.shutdown()
print(f'{checks - len(fails)}/{checks} checks passed')
if not fails: print('GLIMMERDEEP SMOKE: ALL PASS')
sys.exit(1 if fails else 0)
