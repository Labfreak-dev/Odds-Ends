"""The directional pack tear: where the swipe starts picks the cut, progress
follows the cut's own axis, and the foil splits along the line when it gives.

  python3 docs/smoke-tear.py
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

def fresh(pg):
    pg.evaluate("()=>{ const o=document.getElementById('rzOverlay'); if(o) o.style.display='none'; }")
    pg.evaluate("()=>{ const c=cards.find(x=>x.rarity===9); startReveal({name:'Tear Probe', key:'basic'}, [[c]], 0); }")
    pg.wait_for_timeout(350)
    return pg.locator("#rzPack").bounding_box()

def drag(pg, pts, settle=120):
    pg.mouse.move(*pts[0]); pg.mouse.down()
    for p in pts[1:]: pg.mouse.move(*p)
    pg.mouse.up(); pg.wait_for_timeout(settle)

def state(pg):
    return pg.evaluate("""()=>{ const RZ=window.oeRipState(); const pk=document.getElementById('rzPack'); if(!pk) return { gone:true, sliced:true, stage: RZ && RZ.stage, split: RZ && RZ.split || null, halves:-1, clip:[], capHidden:null };
      return { kind: pk.dataset.tear||null, tear: RZ ? +RZ.tear.toFixed(2) : null, stage: RZ && RZ.stage, split: RZ && RZ.split || null,
        sliced: pk.classList.contains('sliced'), halves: pk.querySelectorAll('.rz-half').length,
        clip: [...pk.querySelectorAll('.rz-half')].map(h=>h.style.clipPath.startsWith('polygon(')),
        capHidden: getComputedStyle(pk.querySelector('.rz-cap')).visibility==='hidden',
        line: pk.querySelector('.rz-tearline').getBoundingClientRect(),
        hint: document.querySelector('.rz-hint').textContent }; }""")

with sync_playwright() as pw:
    br = pw.chromium.launch()
    pg = br.new_page(viewport={"width": 430, "height": 900}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(URL); pg.wait_for_timeout(2000)
    pg.evaluate("()=>localStorage.clear()"); pg.reload(); pg.wait_for_timeout(2000)
    pg.evaluate("()=>{ state.dollars=9e6; state.player.level=99; }")

    # ---- the classic: a swipe across the top band slices the cap, no split ----
    b = fresh(pg); x, y, w, h = b["x"], b["y"], b["width"], b["height"]
    drag(pg, [(x+10, y+20), (x+60, y+20)])
    st = state(pg)
    check("a swipe in the top band is the classic cap slice", st["kind"] == "top" and 0.2 <= st["tear"] < 1, st)
    check("the hint names the cut", "cap" in st["hint"], st["hint"])
    drag(pg, [(x+60, y+20)] + [(x+60+i*40, y+20) for i in range(1, 15)], 200)
    st = state(pg)
    check("the cap slice finishes with the cap flying and no split", st["sliced"] and not st["split"] and st["halves"] in (0,-1), st)
    pg.wait_for_timeout(700)

    # ---- bottom band: peel the footer ----
    b = fresh(pg); x, y, w, h = b["x"], b["y"], b["width"], b["height"]
    drag(pg, [(x+10, y+h*0.92), (x+40, y+h*0.92)])
    st = state(pg)
    check("a swipe along the bottom band peels the footer", st["kind"] == "bottom" and st["tear"] > 0.1, st)
    check("the tear line sits down at the footer", st["line"]["y"] > y + h*0.85, st["line"])
    drag(pg, [(x+40, y+h*0.92)] + [(x+40+i*40, y+h*0.92) for i in range(1, 15)], 80)
    st = state(pg)
    check("the footer comes away as a clipped strip", st["sliced"] and st["split"] and st["split"]["kind"] == "bottom" and (st["halves"] == -1 or (st["halves"] == 2 and all(st["clip"]) and st["capHidden"])), st)
    pg.wait_for_timeout(700)

    # ---- left edge: zipper, and only vertical travel counts ----
    b = fresh(pg); x, y, w, h = b["x"], b["y"], b["width"], b["height"]
    drag(pg, [(x+w*0.06, y+h*0.3), (x+w*0.06, y+h*0.34)])
    st = state(pg); t0 = st["tear"]
    check("a swipe down the left edge is a zipper", st["kind"] == "left" and 0 < t0 < 1, st)
    drag(pg, [(x+w*0.06, y+h*0.34)] + [(x+w*0.06+i*20, y+h*0.34) for i in range(1, 9)])
    st = state(pg)
    check("scrubbing sideways does not zip", abs(st["tear"] - t0) < 0.03, (t0, st["tear"]))
    check("the zipper line runs down the side", st["line"]["width"] < 8 and st["line"]["x"] < x + w*0.12, st["line"])
    drag(pg, [(x+w*0.06, y+h*0.3)] + [(x+w*0.06, y+h*0.3+i*40) for i in range(1, 14)], 80)
    st = state(pg)
    check("the zipper finishes with the strip peeling off", st["sliced"] and st["split"] and st["split"]["kind"] == "left", st)
    pg.wait_for_timeout(700)

    # ---- right edge ----
    b = fresh(pg); x, y, w, h = b["x"], b["y"], b["width"], b["height"]
    drag(pg, [(x+w*0.94, y+h*0.3)] + [(x+w*0.94, y+h*0.3+i*40) for i in range(1, 14)], 80)
    st = state(pg)
    check("a swipe down the right edge zips that side and splits", st["sliced"] and st["split"] and st["split"]["kind"] == "right", st)
    pg.wait_for_timeout(700)

    # ---- slash: the line locks to the finger's direction and starts under it ----
    b = fresh(pg); x, y, w, h = b["x"], b["y"], b["width"], b["height"]
    sx, sy = x+w*0.24, y+h*0.28
    drag(pg, [(sx, sy), (sx+4, sy+3), (sx+30, sy+24), (sx+60, sy+48)])
    st = state(pg)
    ang = pg.evaluate("()=>window.oeRipState().cut.ang")
    check("a swipe from the open foil is a slash", st["kind"] == "slash" and 0 < st["tear"] < 1, st)
    check("the slash locks to the drag direction, roughly 39 degrees", 30 < ang < 48, ang)
    check("the slash starts under the finger", abs(st["line"]["x"] - sx) < 14 and abs(st["line"]["y"] - sy) < 14, (st["line"], sx, sy))
    drag(pg, [(sx+60, sy+48)] + [(sx+60+i*30, sy+48+i*24) for i in range(1, 16)], 80)
    st = state(pg)
    check("the slash throws both halves apart", st["sliced"] and st["split"] and st["split"]["kind"] == "slash", st)
    pg.wait_for_timeout(700)

    # ---- pinch: work the middle, any direction counts ----
    b = fresh(pg); x, y, w, h = b["x"], b["y"], b["width"], b["height"]
    cx, cy = x+w/2, y+h/2
    drag(pg, [(cx, cy), (cx+25, cy-10)])
    st = state(pg)
    check("a press in the middle is a pinch", st["kind"] == "pinch" and st["tear"] > 0, st)
    pts = [(cx, cy)]
    for i in range(1, 30): pts.append((cx + (35 if i % 2 else -35), cy + (20 if i % 4 < 2 else -20)))
    drag(pg, pts, 80)
    st = state(pg)
    check("the pinch bursts the pack into two halves", st["sliced"] and st["split"] and st["split"]["kind"] == "pinch", st)
    pg.wait_for_timeout(800)
    check("the deal still follows every cut", pg.evaluate("()=>{ const RZ=window.oeRipState(); return RZ && RZ.stage; }") == "cards")
    check("zero page errors", not errs, errs[:3])
    br.close()
print()
print("TEAR: all %d checks passed." % ok if not fail else "TEAR: %d FAILED, %d passed." % (fail, ok))
sys.exit(1 if fail else 0)
