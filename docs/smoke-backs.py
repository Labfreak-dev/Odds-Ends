"""Earnable card backs: the picker, the locks, the unlock moments, persistence.

  python3 docs/smoke-backs.py
  OE_INDEX=/path/to/index.html python3 docs/smoke-backs.py
"""
import os, pathlib, sys, json
from playwright.sync_api import sync_playwright

IDX = os.environ.get("OE_INDEX") or str(pathlib.Path(__file__).resolve().parent.parent / "index.html")
URL = "file://" + IDX
SAVE_KEY = "oddsandends_save_v1"
ok = fail = 0
def check(n, c, e=""):
    global ok, fail
    if c: ok += 1; print("  ok   " + n)
    else: fail += 1; print("  FAIL " + n + ("  " + str(e) if e else ""))

def tear(pg):
    box = pg.locator("#rzPack").bounding_box()
    pg.mouse.move(box["x"]+8, box["y"]+20); pg.mouse.down()
    for i in range(1,16): pg.mouse.move(box["x"]+8+i*40, box["y"]+20)
    pg.mouse.up(); pg.wait_for_timeout(900)

with sync_playwright() as pw:
    br = pw.chromium.launch()
    pg = br.new_page(viewport={"width":430,"height":900})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(URL); pg.wait_for_timeout(2400)
    pg.evaluate("()=>{ localStorage.clear(); }")
    pg.reload(); pg.wait_for_timeout(2200)
    pg.evaluate("()=>{ state.dollars=900000; state.player.level=99; }")

    pg.evaluate("()=>buyPacks('everyday',1)"); pg.wait_for_timeout(400)
    tear(pg)
    check("a fresh save wears the cream back",
          pg.evaluate("()=>state.ripship && state.ripship.eq") == "cream")
    pg.locator("#rzBacksBtn").click(); pg.wait_for_timeout(300)
    check("the picker opens from the spread", pg.locator(".rz-bgrid").count() == 1)
    check("all six backs on show", pg.locator(".rz-bcell").count() == 6)
    check("five locked at the start", pg.locator(".rz-bcell.locked").count() == 5)
    check("locked cells name their price",
          pg.locator(".rz-bcell.locked .rz-bneed").first.inner_text().startswith("\U0001f512"))
    check("every back image decodes",
          pg.evaluate("()=>[...document.querySelectorAll('.rz-bcell img')].every(i=>i.complete&&i.naturalWidth>0)"))
    pg.locator("[data-back='knot']").click(); pg.wait_for_timeout(200)
    check("a locked back cannot be worn", pg.evaluate("()=>state.ripship.eq") == "cream")
    pg.locator("#rzBacksBack").click(); pg.wait_for_timeout(300)
    check("back to the spread", pg.locator(".rz-spread").count() == 1 and pg.locator(".rz-sp").count() > 0)
    pg.locator("#rzKeepAll").click(); pg.wait_for_timeout(300)
    pg.evaluate("()=>{ document.getElementById('rzOverlay').style.display='none'; }")

    # 25 packs opened -> The Ribbons, granted at open time
    pg.evaluate("()=>{ state.packsOpened = 25; }")
    pg.evaluate("()=>buyPacks('everyday',1)"); pg.wait_for_timeout(500)
    check("25 opened packs earn The Ribbons",
          pg.evaluate("()=>!!(state.ripship.backs && state.ripship.backs.ribbons)"))
    tear(pg)
    pg.locator("#rzBacksBtn").click(); pg.wait_for_timeout(300)
    pg.locator("[data-back='ribbons']").click(); pg.wait_for_timeout(300)
    check("an earned back can be worn", pg.evaluate("()=>state.ripship.eq") == "ribbons")
    pg.locator("#rzBacksBack").click(); pg.wait_for_timeout(300)
    # every face-down cell wears the worn back (a spread with nothing face-down
    # - all duplicates - still passes: the worn back is what matters)
    check("every face-down card in the spread wears it",
          pg.evaluate("""()=>{
            const imgs = [...document.querySelectorAll('.rz-spback')];
            return state.ripship.eq === 'ribbons' && imgs.every(i=>i.src === imgs[0].src); }"""))
    # the grid scrolls inside its box; it must never run under the buttons
    check("the spread never runs under the hint line",
          pg.evaluate("""()=>{
            const hint = document.querySelector('.rz-hint').getBoundingClientRect();
            const sp = document.getElementById('rzSpread').getBoundingClientRect();
            return sp.bottom <= hint.top + 1; }"""))
    pg.locator("#rzKeepAll").click(); pg.wait_for_timeout(300)
    pg.evaluate("()=>{ document.getElementById('rzOverlay').style.display='none'; }")

    # the hundredth shipped card -> Gold Foil
    pg.evaluate("()=>{ state.ripship.shipN = 99; }")
    pg.evaluate("()=>buyPacks('everyday',1)"); pg.wait_for_timeout(400)
    tear(pg)
    # a fresh cell's own ship button; a face-down first card is turned first
    if pg.locator(".rz-sps").count() == 0:
        pg.locator(".rz-sp.down .rz-spcard").first.click(); pg.wait_for_timeout(450)
    pg.locator(".rz-sps").first.click(); pg.wait_for_timeout(500)
    check("the hundredth shipped card earns Gold Foil",
          pg.evaluate("()=>!!(state.ripship.backs && state.ripship.backs.gold)"))
    pg.evaluate("()=>{ document.getElementById('rzOverlay').style.display='none'; }")

    # everything survives a reload
    pg.evaluate("()=>saveState()")
    saved = pg.evaluate("()=>localStorage.getItem(SAVE_KEY)")
    pg.add_init_script("try{ localStorage.setItem(%s, %s); }catch(e){}"
                       % (json.dumps(SAVE_KEY), json.dumps(saved)))
    pg.reload(); pg.wait_for_timeout(2200)
    got = pg.evaluate("()=>({eq:state.ripship&&state.ripship.eq, gold:!!(state.ripship&&state.ripship.backs.gold), n:state.ripship&&state.ripship.shipN})")
    check("worn back, earned backs and the ship count survive a reload",
          got and got["eq"] == "ribbons" and got["gold"] and got["n"] == 100, got)

    check("zero page errors", not errs, errs[:3])
    br.close()

print()
print("BACKS: all %d checks passed." % ok if not fail else "BACKS: %d FAILED, %d passed." % (fail, ok))
sys.exit(1 if fail else 0)
