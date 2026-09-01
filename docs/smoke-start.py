"""The start screen and the illustrated chrome.

The title overlay is skipped for automation (navigator.webdriver), so this
suite forces it with ?start=1, then checks the crest, the rain of real cards,
the tap-to-dismiss, and that the menu plates / play tiles / gold buttons
landed on the page underneath.

  python3 docs/smoke-start.py
"""
import os, pathlib, sys, json
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
IDX = os.environ.get("OE_INDEX") or str(ROOT / "index.html")
URL = "file://" + IDX
ok = fail = 0
def check(n, c, e=""):
    global ok, fail
    if c: ok += 1; print("  ok   " + n)
    else: fail += 1; print("  FAIL " + n + ("  " + str(e) if e else ""))

with sync_playwright() as pw:
    br = pw.chromium.launch()
    for W, H, tag in [(430, 900, "phone"), (1100, 820, "desktop")]:
        pg = br.new_page(viewport={"width": W, "height": H}); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(URL + "?start=1"); pg.wait_for_timeout(2400)
        st = pg.evaluate("""()=>{
          const s=document.getElementById('oeStart'), lg=document.querySelector('.oe-start-logo');
          const falls=[...document.querySelectorAll('.oe-fall')];
          const imgs=falls.map(f=>f.querySelector('img')).filter(Boolean);
          const frames=new Set(falls.map(f=>getComputedStyle(f).backgroundImage.slice(0,60)));
          return { up: !!s && getComputedStyle(s).display!=='none' && +getComputedStyle(s).zIndex>=1000,
            logo: !!lg && lg.complete && lg.naturalWidth>0 && lg.getBoundingClientRect().width>200,
            falls: falls.length,
            framed: falls.filter(f=>getComputedStyle(f).backgroundImage.startsWith('url("data:image/webp')).length,
            loaded: imgs.filter(i=>i.complete && i.naturalWidth>0).length,
            bands: frames.size, anim: falls[0] && getComputedStyle(falls[0]).animationName,
            tap: (document.querySelector('.oe-start-tap')||{}).textContent,
            tapAnim: getComputedStyle(document.querySelector('.oe-start-tap')).animationName,
            y: falls.slice(0,6).map(f=>f.getBoundingClientRect().top) }; }""")
        check(f"[{tag}] the start screen covers the page", st["up"], st)
        check(f"[{tag}] the crest loads and sits large", st["logo"])
        check(f"[{tag}] a rain of at least ten framed cards", st["falls"] >= 10 and st["framed"] == st["falls"], st)
        check(f"[{tag}] the cards carry real paintings", st["loaded"] >= st["falls"] - 2, (st["loaded"], st["falls"]))
        check(f"[{tag}] more than one frame band in the rain", st["bands"] >= 2, st["bands"])
        check(f"[{tag}] 'Tap to Start' pulses under the crest",
              st["tap"] == "Tap to Start" and st["tapAnim"] not in (None, "none"), (st["tap"], st["tapAnim"]))
        pg.wait_for_timeout(700)
        y2 = pg.evaluate("()=>[...document.querySelectorAll('.oe-fall')].slice(0,6).map(f=>f.getBoundingClientRect().top)")
        check(f"[{tag}] the cards are falling", st["anim"] == "oeFall" and any(abs(a-b) > 5 for a, b in zip(st["y"], y2)))
        # tap dead centre, where the Pack Shelf's buy buttons sit underneath
        before = pg.evaluate("()=>({ d: state.dollars, open: !!document.querySelector('#rzOverlay') && getComputedStyle(document.querySelector('#rzOverlay')).display!=='none' })")
        pg.mouse.move(W // 2, H // 2); pg.mouse.down(); pg.wait_for_timeout(80); pg.mouse.up(); pg.wait_for_timeout(150)
        mid = pg.evaluate("()=>{ const s=document.getElementById('oeStart'); return s ? getComputedStyle(s).pointerEvents : 'gone'; }")
        check(f"[{tag}] the overlay keeps swallowing input while it fades", mid == "auto", mid)
        pg.wait_for_timeout(800)
        check(f"[{tag}] one tap takes the screen down", not pg.evaluate("()=>!!document.getElementById('oeStart')"))
        after = pg.evaluate("()=>({ d: state.dollars, open: !!document.querySelector('#rzOverlay') && getComputedStyle(document.querySelector('#rzOverlay')).display!=='none', tab: document.querySelector('nav button.active').dataset.tab })")
        check(f"[{tag}] the tap never reaches the shelf underneath",
              after["d"] >= before["d"] and not after["open"] and after["tab"] == "packs", (before, after))  # mining ticks up; a pack would drop it by 750+
        ch = pg.evaluate("""()=>{
          const plates=[...document.querySelectorAll('nav button i')];
          const bg=e=>e?getComputedStyle(e).backgroundColor:null;
          return { plates: plates.length,
            plated: plates.filter(i=>getComputedStyle(i).backgroundImage.startsWith('url("data:image/webp') && getComputedStyle(i).fontSize==='0px').length,
            navBtn: Math.round(document.querySelector('nav button').getBoundingClientRect().height),
            primary: bg(document.querySelector('button.btn:not(.secondary):not(.btn-ghost):not(.btn-brass):not(.gold):not(.danger)')),
            ghost: bg(document.querySelector('button.btn.btn-ghost')),
            brass: bg(document.querySelector('button.btn.btn-brass')) }; }""")
        check(f"[{tag}] six illustrated menu plates, emoji hidden", ch["plates"] == 6 and ch["plated"] == 6, ch)
        check(f"[{tag}] menu buttons are at least a 44px touch target", ch["navBtn"] >= 44, ch["navBtn"])
        check(f"[{tag}] primary buttons are gold, ghost stays clear, brass stays brass",
              ch["primary"] == "rgb(217, 166, 63)" and ch["ghost"] == "rgba(0, 0, 0, 0)" and ch["brass"] == "rgb(212, 162, 74)", ch)
        pg.click("[data-tab='play']"); pg.wait_for_timeout(600)
        pl = pg.evaluate("""()=>{ const p=[...document.querySelectorAll('.play-card .pi')];
          return { n:p.length, tiled:p.filter(e=>getComputedStyle(e).backgroundImage.startsWith('url("data:image/webp') && getComputedStyle(e).fontSize==='0px').length }; }""")
        check(f"[{tag}] every Play card wears its illustrated tile", pl["n"] >= 9 and pl["tiled"] == pl["n"], pl)
        check(f"[{tag}] zero page errors", not errs, errs[:3])
        pg.close()
    pg = br.new_page(viewport={"width": 430, "height": 900})
    pg.goto(URL); pg.wait_for_timeout(1500)
    check("automation never sees the start screen", not pg.evaluate("()=>!!document.getElementById('oeStart')"))
    pg.goto(URL + "?nostart=1"); pg.wait_for_timeout(1200)
    check("?nostart skips it too", not pg.evaluate("()=>!!document.getElementById('oeStart')"))
    br.close()

print()
print("START SCREEN: all %d checks passed." % ok if not fail else "START SCREEN: %d FAILED, %d passed." % (fail, ok))
sys.exit(1 if fail else 0)
