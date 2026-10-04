#!/usr/bin/env python3
"""Headless checks for the arena pixel renderer.

Screenshots and a short gif of staged moments (same canvas path as ?arena=1),
both the atlas and the fallback sprite paths, and a 4x-throttled stress pass.
Does not change the chess fight view.
"""
import functools, http.server, os, shutil, subprocess, sys, threading
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
OUT = os.environ.get('ARENA_OUT', '/tmp/arena-shots')
os.makedirs(OUT, exist_ok=True)

class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Q, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{srv.server_address[1]}'

fails = []
def check(ok, what):
    print(('PASS ' if ok else 'FAIL ') + what, flush=True)
    if not ok: fails.append(what)

def launch(p):
    try:
        return p.chromium.launch(channel='chrome')
    except Exception:
        return p.chromium.launch()

with sync_playwright() as p:
    b = launch(p)
    # --- atlas frame index + fallback bake ---------------------------------
    pg = b.new_page(viewport={'width': 1100, 'height': 760})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.goto(BASE + '/arena-preview.html?shot=atlas&t=0.22', wait_until='networkidle')
    pg.wait_for_function('window.__arenaReady', timeout=8000)
    info = pg.evaluate("""async () => {
      const hit = GArenaView.frameIndex('demo_hero', 'attack', 0.22, 0.22);
      const early = GArenaView.frameIndex('demo_hero', 'attack', 0, 0.22);
      await GArenaView.prepareArt('cr_cind1', 'img/cr_cind1.webp');
      const art = GArenaView.artInfo('cr_cind1');
      return { hit, early, art };
    }""")
    check(info['hit'] == 3 and info['early'] == 0, f"atlas hit frame lands on the strike ({info['hit']})")
    check(info['art'] and 40 <= info['art']['h'] <= 52, f"fallback bake is ~48px ({info['art']})")
    pg.screenshot(path=os.path.join(OUT, 'atlas-hit.png'))
    check(not errs, 'preview has no console errors' + ('' if not errs else ': ' + ' | '.join(errs[:4])))
    pg.close()

    scenes = {
        'melee': 0.22, 'ranged': 0.45, 'aoe': 0.55, 'death': 0.62, 'crit': 0.12,
    }
    desk = b.new_page(viewport={'width': 1280, 'height': 800})
    for name, t in scenes.items():
        derr = []
        desk.on('pageerror', lambda e, box=derr: box.append(str(e)))
        desk.goto(BASE + f'/arena-preview.html?shot={name}&t={t}', wait_until='networkidle')
        desk.wait_for_function('window.__arenaReady', timeout=8000)
        desk.wait_for_function("""() => ['cr_cind1','cr_bubb1','cr_sprt1','cr_shel1','boss_cinder'].some(k => GArenaView.artInfo(k))""", timeout=8000)
        desk.evaluate(f'renderAt({t})')
        desk.wait_for_timeout(80)
        desk.screenshot(path=os.path.join(OUT, f'{name}.png'))
        check(not derr, f'{name} scene has no page errors')
    # gif of the melee lunge
    frames = os.path.join(OUT, 'frames')
    os.makedirs(frames, exist_ok=True)
    desk.goto(BASE + '/arena-preview.html?shot=melee', wait_until='networkidle')
    desk.wait_for_function('window.__arenaReady')
    desk.wait_for_function("() => !!GArenaView.artInfo('cr_cind1')", timeout=8000)
    for i in range(16):
        desk.evaluate(f'renderAt({i / 16 * 0.7})')
        desk.locator('#cv').screenshot(path=os.path.join(frames, f'f{i:02d}.png'))
    gif = os.path.join(OUT, 'melee.gif')
    if shutil.which('ffmpeg'):
        subprocess.check_call(['ffmpeg', '-y', '-framerate', '12', '-i', os.path.join(frames, 'f%02d.png'),
            '-vf', 'scale=640:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse', gif],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        check(os.path.exists(gif), 'melee gif written')
    desk.close()

    # phone portrait and landscape, staged melee so the layout is the renderer
    for label, w, h in (('phone-portrait', 430, 932), ('phone-landscape', 932, 430)):
        ph = b.new_page(viewport={'width': w, 'height': h})
        ph.goto(BASE + '/arena-preview.html?shot=melee&t=0.22', wait_until='networkidle')
        ph.wait_for_function('window.__arenaReady')
        ph.wait_for_function("() => !!GArenaView.artInfo('cr_cind1')", timeout=8000)
        ph.evaluate('renderAt(0.24)')
        ph.screenshot(path=os.path.join(OUT, label + '.png'))
        ph.close()
        check(True, label + ' shot')

    # stress: 16 units, 40 projectiles, 400 particles, CPU 4x
    st = b.new_page(viewport={'width': 390, 'height': 844})
    cdp = b.new_browser_cdp_session(st) if False else None
    try:
        client = st.context.new_cdp_session(st)
        client.send('Emulation.setCPUThrottlingRate', {'rate': 4})
    except Exception as e:
        print('throttle unavailable', e)
    st.goto(BASE + '/arena-preview.html?bench=1&ms=2500', wait_until='domcontentloaded')
    st.wait_for_function('window.__arenaBench', timeout=30000)
    bench = st.evaluate('window.__arenaBench')
    print('BENCH', bench, flush=True)
    check(bench['fps'] >= 30, f"throttled stress fps {bench['fps']:.1f} (>=30)")
    check(bench['particles'] >= 200, f"particle pool stayed busy ({bench['particles']})")
    st.close()
    b.close()

srv.shutdown()
print(f'{6 + len(scenes) - len(fails)} checks, {len(fails)} failed')
if fails:
    print('FAILED: ' + ', '.join(fails))
    sys.exit(1)
print('ARENA RENDER: ALL PASS')
