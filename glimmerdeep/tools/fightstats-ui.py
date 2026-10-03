#!/usr/bin/env python3
"""Headless check for the post-fight Battle report.

Opens the real page at 430x932 (?anim=0) and 1280x800, and screenshots the
report on a main-run win, a skipped fight, a game over, a Wilds win, and a
trainer battle. Fails on console errors, HTTP 404s, data-v inside the report,
dismissible result modals, controls under 44px, or horizontal overflow.
"""
import argparse, functools, http.server, os, sys, threading, traceback
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
SHOTS = '/opt/cursor/artifacts/fightstats'
os.makedirs(SHOTS, exist_ok=True)

class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *x): pass

srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Q, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{srv.server_address[1]}/index.html'

fails = []
def check(ok, what):
    print(('PASS ' if ok else 'FAIL ') + what, flush=True)
    if not ok: fails.append(what)

def shot(page, name):
    page.screenshot(path=os.path.join(SHOTS, name + '.png'))

def buff(page):
    page.evaluate("""() => { const fs = GLIM.FS; if (!fs) return;
      for (const u of fs.st.units) if (u.side === 0 && u.b) u.b.atk *= 40; }""")

def wait_result(page, timeout=25000):
    page.wait_for_selector('#modal.on', timeout=timeout)
    page.wait_for_selector('#modalBox .fsum', timeout=5000)

def assert_report(page, tag, anim0):
    title = page.locator('#modalBox h2').inner_text()
    check(page.locator('#modalBox .fsum').count() == 1, f'{tag}: Battle report is in “{title}”')
    check(page.locator('#modalBox .fsum [data-v]').count() == 0, f'{tag}: report uses no data-v')
    check('Battle report' in page.locator('#modalBox .fsum summary').inner_text(), f'{tag}: summary label')
    nums = page.evaluate("""() => [...document.querySelectorAll('#modalBox .fsum [data-fs-n]')].map(n => +n.getAttribute('data-fs-n') || 0)""")
    if not any(n > 0 for n in nums):
        print('ZERO REPORT', tag, page.locator('#modalBox .fsum').inner_text()[:700].replace('\n', ' | '))
    check(any(n > 0 for n in nums), f'{tag}: a creature recorded a number')
    bad = page.evaluate("""() => [...document.querySelectorAll('#modalBox .fsum [data-fs-n]')].filter(n => {
      const v = +n.getAttribute('data-fs-n') || 0;
      const shown = n.textContent.trim();
      const expect = Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : (Math.round(v * 10) / 10).toFixed(1);
      return shown !== expect;
    }).map(n => n.textContent + ' vs ' + n.getAttribute('data-fs-n'))""")
    zeros = page.evaluate("""() => [...document.querySelectorAll('#modalBox .fsum [data-fs-n]')].filter(n => (+n.getAttribute('data-fs-n') || 0) > 0 && n.textContent.trim() === '0').length""")
    if anim0:
        check(not bad, f'{tag}: ?anim=0 shows final numbers before expand' + ('' if not bad else ' ' + str(bad[:3])))
    else:
        check(zeros > 0, f'{tag}: count-up starts at 0 ({zeros} numbers)')
    page.locator('#modalBox .fsum summary').click()
    page.wait_for_selector('#modalBox .fsum[open]')
    if not anim0:
        page.wait_for_timeout(750)
        settled = page.evaluate("""() => [...document.querySelectorAll('#modalBox .fsum [data-fs-n]')].filter(n => {
          const v = +n.getAttribute('data-fs-n') || 0;
          const shown = n.textContent.trim();
          const expect = Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : (Math.round(v * 10) / 10).toFixed(1);
          return shown !== expect;
        }).length""")
        check(settled == 0, f'{tag}: numbers finish counting up')
    for tab in ('heal', 'cc', 'taken', 'dmg'):
        page.locator(f'#modalBox [data-fs-tab="{tab}"]').click()
        page.wait_for_timeout(40)
    page.locator('#modalBox [data-fs-side="1"]').click()
    page.wait_for_timeout(40)
    page.locator('#modalBox [data-fs-side="0"]').click()
    page.locator('#modalBox [data-fs-tab="dmg"]').click()
    if page.locator('#modalBox [data-fs-row]').count():
        page.locator('#modalBox [data-fs-row]').first.click()
        page.wait_for_timeout(40)
    heights = page.evaluate("""() => {
      const h = s => { const e = document.querySelector(s); return e ? e.getBoundingClientRect().height : 0; };
      const rows = [...document.querySelectorAll('#modalBox .fs-row')].map(e => e.getBoundingClientRect().height);
      const tabs = [...document.querySelectorAll('#modalBox .fs-tabs button, #modalBox .fs-sides button')].map(e => e.getBoundingClientRect().height);
      const box = document.getElementById('modalBox');
      const f = document.querySelector('#modalBox .fsum');
      return { summary: h('#modalBox .fsum summary'), rows, tabs,
        boxOver: box.scrollWidth - box.clientWidth, fOver: f.scrollWidth - f.clientWidth,
        pageOver: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    }""")
    check(heights['summary'] >= 44, f'{tag}: summary {heights["summary"]:.0f}px')
    check(all(x >= 44 for x in heights['tabs']), f'{tag}: tabs/toggles >= 44 ({[round(x) for x in heights["tabs"]]})')
    check(not heights['rows'] or min(heights['rows']) >= 44, f'{tag}: rows >= 44')
    check(heights['boxOver'] <= 2 and heights['fOver'] <= 2 and heights['pageOver'] <= 2,
          f'{tag}: no horizontal scroll (box {heights["boxOver"]}, report {heights["fOver"]}, page {heights["pageOver"]})')
    page.keyboard.press('Escape')
    page.evaluate("""() => document.getElementById('modal').dispatchEvent(new MouseEvent('click', { bubbles: true }))""")
    page.wait_for_timeout(80)
    check(page.locator('#modal.on').count() == 1, f'{tag}: Escape and backdrop leave the result open')
    cont = page.locator('#modalBox .acts [data-v]').first
    cont.scroll_into_view_if_needed()
    ch = cont.bounding_box()
    check(ch and ch['height'] >= 40, f'{tag}: Continue is on screen')
    page.locator('#modalBox .fsum').scroll_into_view_if_needed()
    page.wait_for_timeout(60)

def main_run(page, tag, anim0):
    page.evaluate("GLIM.meta.speed = 4")
    page.click('#shopBtns [data-v=fight]')
    page.wait_for_selector('#game.fighting')
    buff(page)
    wait_result(page)
    title = page.locator('#modalBox h2').inner_text()
    check('Victory' in title or 'defeated' in title.lower(), f'{tag}: main-run result is a win ({title})')
    assert_report(page, tag + ' win', anim0)
    shot(page, 'win-' + tag)
    page.click('#modalBox .acts [data-v=ok]')
    page.wait_for_selector('#modal.on', state='detached')
    page.click('#shopBtns [data-v=fight]')
    page.wait_for_selector('#game.fighting')
    page.click('#fightBar [data-v=skip]')
    wait_result(page)
    assert_report(page, tag + ' skip', anim0)
    shot(page, 'skip-' + tag)
    page.click('#modalBox .acts [data-v=ok]')
    page.wait_for_selector('#modal.on', state='detached')
    page.evaluate("GLIM.run.hp = 1")
    page.click('#shopBtns [data-v=fight]')
    page.wait_for_selector('#game.fighting')
    page.evaluate("""() => { for (const u of GLIM.FS.st.units) if (u.side === 0) { u.hp = 0; u.alive = false; } }""")
    page.click('#fightBar [data-v=skip]')
    page.wait_for_selector('#modal.on', timeout=20000)
    gone = page.locator('#modalBox h2').inner_text()
    check('journey ends' in gone.lower(), f'{tag}: game over modal ({gone})')
    check(page.locator('#modalBox .fsum').count() == 1, f'{tag}: game over includes the report')
    page.locator('#modalBox .fsum summary').click()
    shot(page, 'gameover-' + tag)
    page.click('#modalBox .acts [data-v=ok]')
    page.wait_for_selector('#camp.on')
    page.click('#campTop [data-go=title]')
    page.wait_for_selector('#title.on')

def wilds(page, tag, anim0):
    page.click('#titleMenu [data-v=wilds]')
    page.wait_for_selector('#wilds.on')
    if page.locator('#modal.on').count():
        page.click('#modalBox [data-v=new]')
        page.wait_for_timeout(200)
    for i in range(3):
        page.locator('.wcard').nth(i).click()
    page.click('.wprepbar [data-v=go]')
    page.wait_for_selector('#wilds.exploring')
    page.wait_for_timeout(400)
    info = page.evaluate("""() => {
      const W = WILDS.state, V = WILDS.view;
      const k = Object.keys(W.rooms).find(k => W.rooms[k].mon && !W.rooms[k].mon.beaten);
      if (!k) return null;
      const a = W.rooms[k];
      W.cur = k;
      V.grid = a.tiles ? a.tiles.split('|') : null;
      V.slide = null; V.tr = null; V.sealed = false;
      V.mons = [{ x: 8, y: 4.2, tx: 8, ty: 4.2, t: 9, sz: a.type === 'lair' ? 1.8 : 1.3, lair: a.type === 'lair', bob: 0, shiny: !!a.mon.shiny, fx: 1 }];
      V.px = 8.15; V.py = 4.35; V.inv = 0; V.pause = false;
      return a.mon.sp;
    }""")
    check(bool(info), f'{tag}: a wild creature room exists')
    page.wait_for_selector('#game.fighting', timeout=15000)
    buff(page)
    page.click('#fightBar [data-v=skip]')
    wait_result(page, 20000)
    title = page.locator('#modalBox h2').inner_text()
    check(any(s in title for s in ('Victory', 'unlocked', 'Shiny', 'caught')), f'{tag}: Wilds win ({title})')
    assert_report(page, tag + ' wilds', anim0)
    shot(page, 'wilds-' + tag)
    if page.locator('#modalBox [data-v=no]').count():
        page.click('#modalBox [data-v=no]')
    else:
        page.click('#modalBox .acts [data-v=ok]')
    page.wait_for_selector('#wilds.exploring')
    page.wait_for_timeout(300)
    got = page.evaluate("""() => {
      const W = WILDS.state, V = WILDS.view;
      const k = Object.keys(W.rooms).find(k => W.rooms[k].tr && !W.rooms[k].tr.beaten);
      if (!k) return null;
      const a = W.rooms[k], t = a.tr;
      W.cur = k;
      V.grid = a.tiles ? a.tiles.split('|') : null;
      V.slide = null; V.mons = []; V.sealed = false;
      V.tr = { x: t.x, y: t.y, x0: t.x, y0: t.y, face: t.face, cur: t.face, turn: t.turn || null, t: 0,
        spotted: true, bang: 0, fx: t.face === 'e' ? 1 : -1, cool: 0, walkT: 0 };
      V.px = t.x + 0.2; V.py = t.y; V.inv = 0; V.pause = false;
      return t.arch;
    }""")
    check(bool(got), f'{tag}: a trainer room exists')
    page.wait_for_selector('#modal.on', timeout=10000)
    page.click('#modalBox [data-v=go]')
    page.wait_for_selector('#game.fighting', timeout=15000)
    buff(page)
    page.click('#fightBar [data-v=skip]')
    wait_result(page, 20000)
    title = page.locator('#modalBox h2').inner_text()
    check('defeated' in title.lower() or 'beaten' in title.lower(), f'{tag}: trainer result ({title})')
    assert_report(page, tag + ' trainer', anim0)
    shot(page, 'trainer-' + tag)

def start_wilds(page):
    page.evaluate("GLIM.renderTitle()")
    page.click('#titleMenu [data-v=wilds]')
    page.wait_for_selector('#wilds.on')
    if page.locator('#modal.on').count():
        page.click('#modalBox [data-v=new]')
        page.wait_for_timeout(200)
    for i in range(3):
        page.locator('.wcard').nth(i).click()
    page.click('.wprepbar [data-v=go]')
    page.wait_for_selector('#wilds.exploring')
    page.wait_for_timeout(400)

def doom(page):
    """Leave the squad on 1 HP so Skip resolves as a real wipe, with numbers in the report."""
    page.evaluate("""() => { for (const u of GLIM.FS.st.units) {
      if (u.side === 0) { u.hp = 1; if (u.b) u.b.atk *= 0.01; }
      else if (u.b) u.b.atk *= 40;
    } }""")

def fainted(page, tag, name):
    page.wait_for_selector('#modal.on', timeout=20000)
    title = page.locator('#modalBox h2').inner_text()
    check('fainted' in title.lower(), f'{tag}: squad-fainted modal ({title})')
    assert_report(page, tag, True)
    page.locator('#modalBox [data-fs-tab="heal"]').click()
    page.wait_for_timeout(40)
    pairs = page.locator('#modalBox .fs-pair')
    if pairs.count():
        txt = pairs.first.inner_text()
        check('Heal' in txt and 'Shield' in txt, f'{tag}: healing line shows shields ({txt})')
    page.locator('#modalBox [data-fs-tab="dmg"]').click()
    page.locator('#modalBox .fsum').scroll_into_view_if_needed()
    shot(page, name)
    page.keyboard.press('Escape')
    check(page.locator('#modal.on').count() == 1, f'{tag}: fainted modal stays open')
    page.click('#modalBox .acts [data-v=ok]')
    page.wait_for_selector('#title.on')

def wipe_run(browser):
    ctx = browser.new_context(viewport={'width': 430, 'height': 932})
    page = ctx.new_page()
    errs, http = [], []
    page.on('pageerror', lambda e: errs.append(str(e)))
    page.on('console', lambda m: m.type == 'error' and errs.append(m.text))
    page.on('response', lambda r: r.status >= 400 and http.append(f'{r.status} {r.url}'))
    try:
        page.goto(BASE + '?anim=0')
        page.wait_for_selector('#title.on')
        start_wilds(page)
        info = page.evaluate("""() => {
          const W = WILDS.state, V = WILDS.view;
          const k = Object.keys(W.rooms).find(k => W.rooms[k].mon && !W.rooms[k].mon.beaten);
          if (!k) return null;
          const a = W.rooms[k];
          W.cur = k;
          V.grid = a.tiles ? a.tiles.split('|') : null;
          V.slide = null; V.tr = null; V.sealed = false;
          V.mons = [{ x: 8, y: 4.2, tx: 8, ty: 4.2, t: 9, sz: 1.3, lair: false, bob: 0, shiny: false, fx: 1 }];
          V.px = 8.15; V.py = 4.35; V.inv = 0; V.pause = false;
          return a.mon.sp;
        }""")
        check(bool(info), 'wipe: a wild room exists')
        page.wait_for_selector('#game.fighting', timeout=15000)
        doom(page)
        page.click('#fightBar [data-v=skip]')
        fainted(page, 'wild wipe', 'wipe-430')
        start_wilds(page)
        got = page.evaluate("""() => {
          const W = WILDS.state, V = WILDS.view;
          const k = Object.keys(W.rooms).find(k => W.rooms[k].tr && !W.rooms[k].tr.beaten);
          if (!k) return null;
          const a = W.rooms[k], t = a.tr;
          W.cur = k;
          V.grid = a.tiles ? a.tiles.split('|') : null;
          V.slide = null; V.mons = []; V.sealed = false;
          V.tr = { x: t.x, y: t.y, x0: t.x, y0: t.y, face: t.face, cur: t.face, turn: t.turn || null, t: 0,
            spotted: true, bang: 0, fx: t.face === 'e' ? 1 : -1, cool: 0, walkT: 0 };
          V.px = t.x + 0.2; V.py = t.y; V.inv = 0; V.pause = false;
          return t.arch;
        }""")
        check(bool(got), 'trainer loss: a trainer room exists')
        page.wait_for_selector('#modal.on', timeout=10000)
        page.click('#modalBox [data-v=go]')
        page.wait_for_selector('#game.fighting', timeout=15000)
        doom(page)
        page.click('#fightBar [data-v=skip]')
        fainted(page, 'trainer loss', 'trainer-loss-430')
    except Exception:
        shot(page, 'debug-wipe')
        traceback.print_exc()
        fails.append('wipe flow crashed')
    check(not errs, 'wipe: no console errors' + ('' if not errs else ': ' + ' | '.join(errs[:6])))
    check(not http, 'wipe: no HTTP errors' + ('' if not http else ': ' + ' | '.join(http[:6])))
    ctx.close()

def run(browser, width, height, query, anim0):
    tag = str(width)
    ctx = browser.new_context(viewport={'width': width, 'height': height})
    page = ctx.new_page()
    errs, http = [], []
    page.on('pageerror', lambda e: errs.append(str(e)))
    page.on('console', lambda m: m.type == 'error' and errs.append(m.text))
    page.on('response', lambda r: r.status >= 400 and http.append(f'{r.status} {r.url}'))
    try:
        page.goto(BASE + query)
        page.wait_for_selector('#title.on')
        page.click('#titleMenu [data-v=new]')
        page.wait_for_selector('#modal.on .card')
        page.locator('#modalBox .card').first.click()
        page.wait_for_selector('#game.on .unit.mine')
        main_run(page, tag, anim0)
        wilds(page, tag, anim0)
    except Exception:
        shot(page, 'debug-' + tag)
        traceback.print_exc()
        fails.append(tag + ' flow crashed')
    check(not errs, f'{tag}: no console errors' + ('' if not errs else ': ' + ' | '.join(errs[:6])))
    check(not http, f'{tag}: no HTTP errors' + ('' if not http else ': ' + ' | '.join(http[:6])))
    ctx.close()

ap = argparse.ArgumentParser()
ap.add_argument('--wipe', action='store_true')
args = ap.parse_args()
with sync_playwright() as p:
    browser = p.chromium.launch()
    if args.wipe:
        wipe_run(browser)
    else:
        run(browser, 430, 932, '?anim=0', True)
        run(browser, 1280, 800, '', False)
    browser.close()
srv.shutdown()
print(f'{len(fails)} failure(s)')
if not fails:
    print('FIGHTSTATS UI: ALL PASS')
sys.exit(1 if fails else 0)
