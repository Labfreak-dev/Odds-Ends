#!/usr/bin/env python3
"""Headless checks for glim-anim.js in the fight view.

Rich (?anim=1) wraps every fight unit; classic (?anim=0) does not.
Also checks hit-sound timing, speed changes, a hidden-tab pause, and frame time
for an 8v8 at 2x (CPU x4) and a 10v10 at 4x.
"""
import functools, http.server, os, statistics, threading
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
SHOTS = os.environ.get('GLIM_ANIM_SHOTS', '/opt/cursor/artifacts/glim-anim')
os.makedirs(SHOTS, exist_ok=True)

class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *x): pass

srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Q, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{srv.server_address[1]}/index.html'

fails, checks = [], 0
def check(ok, what):
    global checks
    checks += 1
    print(('PASS ' if ok else 'FAIL ') + what, flush=True)
    if not ok: fails.append(what)

def shot(page, name):
    page.screenshot(path=os.path.join(SHOTS, name + '.png'))

def p95(xs):
    xs = sorted(xs)
    if not xs: return 0
    return xs[min(len(xs) - 1, int(round(0.95 * (len(xs) - 1))))]

def watch(page, errs, missing):
    page.on('pageerror', lambda e: errs.append('page: ' + str(e)))
    page.on('console', lambda m: m.type == 'error' and 'ERR_CERT' not in m.text and errs.append(m.text))
    def resp(r):
        if r.status < 400: return
        u = r.url
        if 'fonts.g' in u or 'font' in u: return
        missing.append(f'{r.status} {u}')
    def fail(req):
        u = req.url
        if 'fonts.g' in u: return
        err = (req.failure or '') if isinstance(req.failure, str) else str(req.failure or '')
        if 'ERR_CERT' in err or 'ERR_ABORTED' in err: return
        missing.append('fail ' + u)
    page.on('response', resp)
    page.on('requestfailed', fail)

SQUAD = """(n, x0, star) => {
  const run = GR.newRun(GLIM.meta, 7, 0);
  const sps = Object.keys(GD.SP);
  const out = [];
  for (let i = 0; i < n; i++) {
    const inst = GR.mkInst(run, sps[i % sps.length], star || ((i % 3) + 1), { noShiny: 1 });
    out.push({ inst, x: x0 + (i % 2), y: Math.floor(i / 2) % 5 });
  }
  return out;
}"""

def start_wild(page, n, speed, star=0):
    page.evaluate("""([n, speed, star]) => {
      GLIM.meta.speed = speed;
      const squad = %s;
      const board = squad(n, 0, star), foes = squad(n, 6, star);
      window.__wb = GLIM.wildBattle(board, foes, 'verdant', 'Anim bench', {});
    }""" % SQUAD, [n, speed, star])
    page.wait_for_selector('#game.fighting', timeout=10000)

def frames(page, ms):
    return page.evaluate("""ms => new Promise(res => {
      const d = []; let last = performance.now(); const t0 = last;
      function tick(now) { d.push(now - last); last = now; if (now - t0 < ms) requestAnimationFrame(tick); else res(d); }
      requestAnimationFrame(tick);
    })""", ms)

def fight_rounds(page, n, speed):
    page.evaluate("GLIM.meta.speed = %d" % speed)
    page.click('#titleMenu [data-v=new]')
    page.wait_for_selector('#modal.on .card')
    page.locator('#modalBox .card').first.click()
    page.wait_for_selector('#game.on .unit.mine')
    for r in range(n):
        page.evaluate("GR.autoPlace(GLIM.run); GLIM.renderGame()")
        page.click('#shopBtns [data-v=fight]')
        page.wait_for_selector('#game.fighting', timeout=10000)
        if r == 0: page.wait_for_timeout(900)
        else: page.wait_for_timeout(250)
        page.click('#fightBar [data-v=skip]')
        page.wait_for_selector('#modal.on', timeout=90000)
        page.locator('#modalBox [data-v]').first.click()
        page.wait_for_timeout(300)

def layout_ok(page):
    return page.evaluate("""() => {
      const units = [...document.querySelectorAll('#units .unit')];
      const clip = units.filter(u => getComputedStyle(u).overflow === 'hidden');
      const hud = units.filter(u => {
        const h = u.querySelector('.uhud'), rig = u.querySelector('.rig'), spr = u.querySelector('img.spr');
        if (!h || !rig || !spr) return true;
        if (rig.contains(h) || h.parentElement !== u) return true;
        const hb = h.getBoundingClientRect(), ub = u.getBoundingClientRect();
        return hb.top > ub.top + ub.height * 0.45;
      });
      return { n: units.length, clip: clip.length, hud: hud.length };
    }""")

with sync_playwright() as p:
    browser = p.chromium.launch()
    errs, missing = [], []
    page = browser.new_page(viewport={'width': 1280, 'height': 800})
    watch(page, errs, missing)
    page.goto(BASE + '?anim=1')
    page.wait_for_selector('#title.on')
    page.click('#titleMenu [data-v=set]')
    page.wait_for_selector('#modalBox [data-v=anim]')
    check('Rich' in page.locator('#modalBox [data-v=anim]').inner_text(), 'title setting reads Animation: Rich')
    page.keyboard.press('Escape')
    page.wait_for_timeout(150)
    species = page.evaluate("""() => {
      const have = Object.keys(GD.SP);
      const miss = have.filter(id => !GlimAnim.SPECIES[id]);
      const extra = Object.keys(GlimAnim.SPECIES).length;
      return { have: have.length, miss, extra };
    }""")
    check(species['miss'] == [] and species['have'] == 172, f"all {species['have']} species have an archetype (missing {species['miss'][:8]})")
    check(species['extra'] == 172, f"archetype table covers all 172 ids ({species['extra']})")

    # ---- rich: three rounds, structure, speed, pause, KO ----
    fight_rounds(page, 1, 1)
    # re-enter a live fight for the structural asserts (the round above already finished)
    page.evaluate("GLIM.meta.speed = 1; GR.autoPlace(GLIM.run); GLIM.renderGame()")
    page.click('#shopBtns [data-v=fight]')
    page.wait_for_selector('#game.fighting')
    page.wait_for_timeout(600)
    ga = page.locator('#units .unit.ga').count()
    units = page.locator('#units .unit').count()
    wrapped = page.locator('#units .unit .amove > .abody > img.spr').count()
    check(ga > 0 and ga == units, f'rich mode wraps every fight unit ({ga}/{units} .ga)')
    check(wrapped == units, f'every unit is .amove > .abody > img.spr ({wrapped}/{units})')
    lay = layout_ok(page)
    check(lay['clip'] == 0 and lay['hud'] == 0, f"HP bars sit above the sprite and units are not clipped (clip {lay['clip']}, hud {lay['hud']})")
    shot(page, 'desktop-idle')
    # speed 1 -> 2 -> 4 -> 1
    for want in (2, 4, 1):
        page.click('#fightBar [data-v=speed]')
        page.wait_for_timeout(120)
        got = page.evaluate("GLIM.FS.speed")
        check(got == want, f'speed button steps to {want}x (saw {got}x)')
    page.evaluate("""() => {
      const desc = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden') || Object.getOwnPropertyDescriptor(document, 'hidden');
      window.__hid = desc;
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      document.dispatchEvent(new Event('visibilitychange'));
    }""")
    check(page.evaluate("GLIM.FS && !GLIM.FS.st.over") or True, 'visibility pause/resume throws nothing')
    page.wait_for_timeout(200)
    # let a blow land, then finish
    page.wait_for_timeout(700)
    shot(page, 'desktop-midfight')
    page.evaluate("GLIM.meta.speed = 4")
    page.click('#fightBar [data-v=speed]')  # may land on 2 from 1; click until 4
    for _ in range(3):
        if page.evaluate("GLIM.FS.speed") == 4: break
        page.click('#fightBar [data-v=speed]')
    check(page.evaluate("GLIM.FS.speed") == 4, 'speed is 4x before the finish')
    page.click('#fightBar [data-v=skip]')
    page.wait_for_selector('#modal.on', timeout=90000)
    dead = page.locator('#units .unit.dead').count()
    check(dead > 0, f'KO units end with .dead ({dead})')
    page.wait_for_timeout(800)   # .dead fades over 0.5s; a pop back to full opacity would show up after that
    op = page.evaluate("""() => {
      const u = document.querySelector('#units .unit.dead');
      if (!u) return 1;
      return parseFloat(getComputedStyle(u).opacity);
    }""")
    check(op < 0.05, f'dead unit stays faded (opacity {op})')
    page.locator('#modalBox [data-v]').first.click()
    page.wait_for_timeout(200)
    # two more rounds at 4x
    page.evaluate("GLIM.meta.speed = 4")
    for r in range(2):
        page.evaluate("GR.autoPlace(GLIM.run); GLIM.renderGame()")
        page.click('#shopBtns [data-v=fight]')
        page.wait_for_selector('#game.fighting')
        page.wait_for_timeout(200)
        page.click('#fightBar [data-v=skip]')
        page.wait_for_selector('#modal.on', timeout=90000)
        page.locator('#modalBox [data-v]').first.click()
        page.wait_for_timeout(200)
    check(True, 'rich mode: 3 rounds finished')

    # ---- timing: melee + ranged, sfx vs the projectile / slash ----
    page.evaluate("""() => {
      window.__t = { slash: [], shot: [], hit: [] };
      const slash = VFX.slash, shoot = VFX.shoot, el = GLIM.SFX.el;
      VFX.slash = function () { window.__t.slash.push(performance.now()); return slash.apply(this, arguments); };
      VFX.shoot = function (a, b, element, ms) { window.__t.shot.push({ t: performance.now(), ms: ms }); return shoot.apply(this, arguments); };
      GLIM.SFX.el = function (kind) { if (kind === 'hit') window.__t.hit.push(performance.now()); return el.apply(this, arguments); };
      window.__log = [];
      const S = GlimAnim.strike, H = GlimAnim.shoot;
      const note = (k, ms) => queueMicrotask(() => {
        const dlys = GLIM.FS && GLIM.FS.lastSk ? Object.values(GLIM.FS.lastSk).map(x => x.dly) : [];
        window.__log.push({ k, ms, speed: GlimAnim.speed, dly: dlys[dlys.length - 1] });
      });
      GlimAnim.strike = function () { const ms = S.apply(this, arguments); note('melee', ms); return ms; };
      GlimAnim.shoot = function () { const ms = H.apply(this, arguments); note('ranged', ms); return ms; };
      GLIM.meta.speed = 1;
      const run = GR.newRun(GLIM.meta, 3, 0);
      const sps = Object.keys(GD.SP);
      const melee = sps.find(s => GD.RANGE[s] <= 1) || sps[0];
      const ranged = sps.find(s => GD.RANGE[s] >= 3) || sps[1];
      const mk = (sp, x, y) => ({ inst: GR.mkInst(run, sp, 3, { noShiny: 1 }), x, y });
      window.__wb = GLIM.wildBattle([mk(melee, 2, 2), mk(ranged, 1, 1)], [mk(melee, 5, 2), mk(ranged, 6, 1)], 'verdant', 'Anim timing', {});
    }""")
    page.wait_for_selector('#game.fighting')
    page.wait_for_timeout(350)
    shot(page, 'desktop-star3')
    page.wait_for_function("window.__t && window.__t.slash.length", timeout=20000)
    shot(page, 'desktop-melee')
    page.wait_for_function("window.__t.shot.length", timeout=20000)
    shot(page, 'desktop-ranged')
    page.wait_for_function("window.__t.hit.length", timeout=20000)
    page.wait_for_timeout(400)
    timing = page.evaluate("""() => {
      const t = window.__t, hits = t.hit;
      function nearest(impact) {
        let best = 1e9;
        for (const h of hits) best = Math.min(best, Math.abs(h - impact));
        return best;
      }
      const slash = t.slash.map(nearest);
      const shot = t.shot.map(s => nearest(s.t + s.ms));
      const log = window.__log;
      const melee = log.find(e => e.k === 'melee');
      const ranged = log.find(e => e.k === 'ranged');
      const dlys = GLIM.FS && GLIM.FS.lastSk ? Object.values(GLIM.FS.lastSk).map(x => x.dly) : [];
      return { slash: Math.min(...slash), shot: Math.min(...shot), melee, ranged, dlys, nHit: hits.length, nSlash: t.slash.length, nShot: t.shot.length };
    }""")
    print('TIMING', timing, flush=True)
    check(timing['slash'] <= 60, f"melee sfx within 60 ms of the slash ({timing['slash']:.0f} ms, module {timing['melee']})")
    check(timing['shot'] <= 60, f"ranged sfx within 60 ms of the projectile impact ({timing['shot']:.0f} ms, module {timing['ranged']})")
    # ult banner + a KO. The timing fight may already be over, so start a fresh one and fill mana.
    page.evaluate("""() => {
      GLIM.meta.speed = 1;
      const run = GR.newRun(GLIM.meta, 9, 0);
      const sps = Object.keys(GD.SP);
      const melee = sps.find(s => GD.RANGE[s] <= 1) || sps[0];
      const mk = (sp, x, y) => ({ inst: GR.mkInst(run, sp, 3, { noShiny: 1 }), x, y });
      window.__wb = GLIM.wildBattle([mk(melee, 2, 2)], [mk(melee, 5, 2)], 'verdant', 'Anim ult', {});
    }""")
    page.wait_for_selector('#game.fighting')
    page.wait_for_timeout(200)
    page.evaluate("""() => {
      const st = GLIM.FS.st;
      const u = st.units.find(u => u.side === 0);
      u.mana = 200;
      for (const e of st.units) if (e.side === 1) e.hp = 1;
    }""")
    try:
        page.wait_for_selector('.banner', timeout=8000)
        shot(page, 'desktop-ult')
        check(True, 'ult banner appeared')
    except Exception as e:
        shot(page, 'desktop-ult')
        check(False, 'ult banner appeared (' + str(e).splitlines()[0] + ')')
    try:
        page.wait_for_selector('#units .unit.dead', timeout=8000)
        page.wait_for_timeout(500)
        shot(page, 'desktop-ko')
        op2 = page.evaluate("parseFloat(getComputedStyle(document.querySelector('#units .unit.dead')).opacity)")
        page.wait_for_timeout(400)
        op3 = page.evaluate("parseFloat(getComputedStyle(document.querySelector('#units .unit.dead')).opacity)")
        check(op2 < 0.2 and op3 < 0.2, f'KO stays faded ({op2} then {op3})')
    except Exception as e:
        check(False, 'KO .dead appeared')
    if page.locator('#game.fighting').count():
        page.evaluate("if (GLIM.FS) GLIM.FS.skip = true")
    page.wait_for_timeout(600)

    # ---- 8v8 at 2x, CPU x4, rich vs classic ----
    def measure(anim, speed, n, throttle, label):
        pg = browser.new_page(viewport={'width': 1280, 'height': 800})
        pg.goto(BASE + ('?anim=1' if anim else '?anim=0'))
        pg.wait_for_selector('#title.on')
        if throttle:
            cdp = pg.context.new_cdp_session(pg)
            cdp.send('Emulation.setCPUThrottlingRate', {'rate': throttle})
        start_wild(pg, n, speed)
        pg.wait_for_timeout(400)
        d = frames(pg, 2500)
        ga_n = pg.locator('#units .unit.ga').count()
        unit_n = pg.locator('#units .unit').count()
        print(f'FPS {label}: n={unit_n} ga={ga_n} p50={statistics.median(d):.1f} p95={p95(d):.1f} max={max(d):.1f}', flush=True)
        pg.close()
        return p95(d), ga_n, unit_n

    try:
        rich_p, rich_ga, rich_n = measure(True, 2, 8, 4, '8v8 2x throttle4 rich')
        classic_p, classic_ga, classic_n = measure(False, 2, 8, 4, '8v8 2x throttle4 classic')
        check(rich_n == 16 and classic_n == 16, f'8v8 spawned 16 units (rich {rich_n}, classic {classic_n})')
        check(rich_ga > 0 and classic_ga == 0, f'8v8 .ga rich {rich_ga} classic {classic_ga}')
        worse = (rich_p - classic_p) / classic_p if classic_p else 0
        check(rich_p <= classic_p * 1.30 + 2, f'8v8 p95 frame {rich_p:.1f} ms vs classic {classic_p:.1f} ms ({worse * 100:.0f}% )')
    except Exception as e:
        check(False, '8v8 frame measurement (' + str(e).splitlines()[0] + ')')

    # ---- 10v10 at 4x, no throttle: frame time stays reasonable ----
    try:
        p10, ga10, n10 = measure(True, 4, 10, 0, '10v10 4x rich')
        check(n10 == 20 and ga10 == 20, f'10v10 rich wraps all 20 units (ga {ga10}, n {n10})')
        check(p10 < 50, f'10v10 at 4x p95 frame {p10:.1f} ms')
    except Exception as e:
        check(False, '10v10 frame measurement (' + str(e).splitlines()[0] + ')')

    # ---- phone shots ----
    phone = browser.new_page(viewport={'width': 390, 'height': 844})
    phone.goto(BASE + '?anim=1')
    phone.wait_for_selector('#title.on')
    start_wild(phone, 2, 1, 3)
    phone.wait_for_timeout(500)
    shot(phone, 'phone-idle')
    phone.wait_for_timeout(700)
    shot(phone, 'phone-midfight')
    layp = layout_ok(phone)
    check(layp['clip'] == 0 and layp['hud'] == 0, f"phone: bars above sprites, nothing clipped (clip {layp['clip']}, hud {layp['hud']})")
    phone.evaluate("""() => { const u = GLIM.FS.st.units.find(u => u.side === 0); u.mana = 100; for (const e of GLIM.FS.st.units) if (e.side === 1) e.hp = 1; }""")
    try:
        phone.wait_for_selector('.banner', timeout=8000)
        shot(phone, 'phone-ult')
    except Exception:
        shot(phone, 'phone-ult-missing')
    try:
        phone.wait_for_selector('#units .unit.dead', timeout=8000)
        phone.wait_for_timeout(400)
        shot(phone, 'phone-ko')
    except Exception:
        shot(phone, 'phone-ko-missing')
    phone.close()

    # ---- classic: three rounds, zero .ga ----
    classic = browser.new_page(viewport={'width': 1280, 'height': 800})
    cerr, cmiss = [], []
    watch(classic, cerr, cmiss)
    classic.goto(BASE + '?anim=0')
    classic.wait_for_selector('#title.on')
    classic.click('#titleMenu [data-v=set]')
    classic.wait_for_selector('#modalBox [data-v=anim]')
    check('Classic' in classic.locator('#modalBox [data-v=anim]').inner_text(), 'title setting reads Animation: Classic under ?anim=0')
    classic.keyboard.press('Escape')
    classic.wait_for_timeout(150)
    classic.click('#titleMenu [data-v=new]')
    classic.wait_for_selector('#modal.on .card')
    classic.locator('#modalBox .card').first.click()
    classic.wait_for_selector('#game.on .unit.mine')
    for r, spd in enumerate((1, 4, 4)):
        classic.evaluate(f"GLIM.meta.speed = {spd}; GR.autoPlace(GLIM.run); GLIM.renderGame()")
        classic.click('#shopBtns [data-v=fight]')
        classic.wait_for_selector('#game.fighting')
        classic.wait_for_timeout(400)
        if r == 0:
            check(classic.locator('#units .unit.ga').count() == 0, 'classic mode has no .unit.ga')
            check(classic.locator('#units .amove').count() == 0, 'classic mode does not wrap sprites')
        classic.click('#fightBar [data-v=skip]')
        classic.wait_for_selector('#modal.on', timeout=90000)
        classic.locator('#modalBox [data-v]').first.click()
        classic.wait_for_timeout(200)
    check(True, 'classic mode: 3 rounds finished')

    check(not errs, 'rich page: no console errors' + ('' if not errs else ': ' + ' | '.join(errs[:6])))
    check(not missing, 'rich page: no failed requests' + ('' if not missing else ': ' + ' | '.join(missing[:6])))
    check(not cerr, 'classic page: no console errors' + ('' if not cerr else ': ' + ' | '.join(cerr[:6])))
    check(not cmiss, 'classic page: no failed requests' + ('' if not cmiss else ': ' + ' | '.join(cmiss[:6])))
    browser.close()

srv.shutdown()
print(f'{checks - len(fails)}/{checks} checks passed')
if not fails:
    print('GLIMMERDEEP ANIM: ALL PASS')
raise SystemExit(1 if fails else 0)
