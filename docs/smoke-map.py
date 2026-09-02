"""The fishing map: the shield and the sign open a painted chart, pins wear
their Legend, a boat sails to the tapped water, locked waters are bought
from their pin, the chips are gone from view.

  python3 docs/smoke-map.py
"""
import os, pathlib, sys
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
    for W, H, tag in [(430, 900, "phone"), (1100, 900, "desktop")]:
        pg = br.new_page(viewport={"width": W, "height": H}); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(URL); pg.wait_for_timeout(2000)
        pg.evaluate("()=>localStorage.clear()"); pg.reload(); pg.wait_for_timeout(2000)
        pg.click("[data-tab='play']"); pg.wait_for_timeout(300)
        pg.click(".play-card[data-game='fishing']"); pg.wait_for_timeout(1400)
        check(f"[{tag}] the spot chips are off the page", pg.evaluate("()=>getComputedStyle(document.querySelector('.fe-spots')).display==='none'"))
        pg.click(".fe-sign"); pg.wait_for_timeout(300)
        st = pg.evaluate("""()=>{ const ov=document.getElementById('feSpotMap'); if(!ov) return null;
          const pins=[...document.querySelectorAll('.fsm-pin')]; const map=document.querySelector('.fsm-map').getBoundingClientRect();
          return { open: ov.classList.contains('open'), pins: pins.length, here: (document.querySelector('.fsm-pin.here')||{}).dataset?.spot,
            locked: document.querySelectorAll('.fsm-pin.locked').length,
            bosses: pins.map(p=>p.querySelector('small').textContent), inside: pins.every(p=>{ const r=p.getBoundingClientRect();
              return r.left>=map.left-2 && r.right<=map.right+2 && r.top>=map.top-2 && r.bottom<=map.bottom+2; }),
            img: getComputedStyle(document.querySelector('.fsm-map')).backgroundImage.includes('fish-map'),
            boat: !!document.querySelector('.fsm-boat'), sheetH: document.querySelector('.fsm-sheet').getBoundingClientRect().height }; }""")
        check(f"[{tag}] the sign opens the map with six pins on the painting", st and st["open"] and st["pins"] == 6 and st["img"], st)
        check(f"[{tag}] you are here at the dock, five waters locked", st and st["here"] == "dock" and st["locked"] == 5, st)
        check(f"[{tag}] every pin wears its Legend", st and set(st["bosses"]) == {"Old Ironjaw","The Marsh King","The Pale Hunter","The Black Phantom","The Rooster King","The Drowned King"}, st and st["bosses"])
        check(f"[{tag}] the pins sit inside the map and the sheet fits the screen", st and st["inside"] and st["boat"] and st["sheetH"] <= H, st and (st["inside"], st["sheetH"]))
        # too poor: the pin explains and nothing moves
        pg.evaluate("()=>{ state.credits=5; }")
        pg.click(".fsm-pin[data-spot='shallows']"); pg.wait_for_timeout(400)
        check(f"[{tag}] a locked pin you cannot afford stays locked, map stays open",
              pg.evaluate("()=>!fshInv().spots.open.includes('shallows') && document.getElementById('feSpotMap').classList.contains('open')"))
        # buy it from the pin
        pg.evaluate("()=>{ state.credits=10000000; }")
        pg.click(".fsm-pin[data-spot='shallows']"); pg.wait_for_timeout(1300)
        check(f"[{tag}] buying from the pin unlocks it and steps ashore, then the map closes",
              pg.evaluate("()=>fshInv().spots.open.includes('shallows') && feSpot().id==='shallows' && !document.getElementById('feSpotMap').classList.contains('open')"))
        check(f"[{tag}] the sign now names the new water", pg.evaluate("()=>document.querySelector('.fe-sign').textContent.includes('Reedy Shallows')"))
        # sail back: the boat moves before the spot changes
        pg.click(".fe-shield"); pg.wait_for_timeout(250)
        b0 = pg.evaluate("()=>document.querySelector('.fsm-boat').getBoundingClientRect().top")
        pg.click(".fsm-pin[data-spot='dock']"); pg.wait_for_timeout(300)
        mid = pg.evaluate("()=>({ top: document.querySelector('.fsm-boat').getBoundingClientRect().top, cur: feSpot().id, sailing: document.querySelector('.fsm-boat').classList.contains('sailing') })")
        check(f"[{tag}] the boat sails toward the dock before you step ashore", abs(mid["top"] - b0) > 20 and mid["cur"] == "shallows" and mid["sailing"], (b0, mid))
        pg.wait_for_timeout(1000)
        check(f"[{tag}] arrival switches the water and closes the map",
              pg.evaluate("()=>feSpot().id==='dock' && !document.getElementById('feSpotMap').classList.contains('open')"))
        # escape and backdrop close it
        pg.click(".fe-shield"); pg.wait_for_timeout(200); pg.keyboard.press("Escape"); pg.wait_for_timeout(150)
        esc = pg.evaluate("()=>!document.getElementById('feSpotMap').classList.contains('open')")
        pg.click(".fe-shield"); pg.wait_for_timeout(200); pg.mouse.click(5, H - 5); pg.wait_for_timeout(150)
        bd = pg.evaluate("()=>!document.getElementById('feSpotMap').classList.contains('open')")
        check(f"[{tag}] Escape and the backdrop close the map", esc and bd, (esc, bd))
        check(f"[{tag}] zero page errors", not errs, errs[:3])
        pg.close()
    br.close()
print()
print("MAP: all %d checks passed." % ok if not fail else "MAP: %d FAILED, %d passed." % (fail, ok))
sys.exit(1 if fail else 0)
