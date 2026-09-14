"""Headless proof of the Hunt as a lazy bundle (batch 136): the tab loads it,
the stage builds, and the ember mine-rate bonus applies without the tab."""
import sys, pathlib
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = (ROOT / "index.html").as_uri()
ok = fail = 0
def check(name, cond, detail=""):
    global ok, fail
    if cond: ok += 1; print(f"  ok   {name}")
    else: fail += 1; print(f"  FAIL {name}  {detail}")
with sync_playwright() as pw:
    br = pw.chromium.launch()
    pg = br.new_page(viewport={"width":900,"height":1000})
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(URL + "?nostart"); pg.wait_for_timeout(1800)
    check("the hunt is not in the page at boot", pg.evaluate("()=>!oeBundleReady('hunt') && typeof HU_KIT==='undefined'"))
    base = pg.evaluate("()=>{ state.hunt = state.hunt || {}; state.hunt.embers = 0; return currentMineRatePerMin(); }")
    with10 = pg.evaluate("()=>{ state.hunt.embers = 10; return currentMineRatePerMin(); }")
    check("ten embers warm the mine rate by 5% with the hunt unloaded", abs(with10/base - 1.05) < 1e-6, (base, with10))
    pg.evaluate("()=>{ uiOpenGame('hunt'); }")
    pg.wait_for_function("oeBundleReady('hunt')", timeout=30000); pg.wait_for_timeout(800)
    check("opening the tab fetched the bundle and built the stage", pg.evaluate("()=>typeof HU_KIT!=='undefined' && document.getElementById('huStage').children.length > 0"))
    check("the loading note is gone", pg.evaluate("()=>document.getElementById('huLazyNote').style.display==='none'"))
    with10b = pg.evaluate("()=>currentMineRatePerMin()")
    check("the ember bonus is applied once, not twice, after the load", abs(with10b - with10) < 1e-6, (with10, with10b))
    check("zero page errors", not errs, errs[:3])
    br.close()
print()
if fail == 0: print("HUNT: all %d checks passed." % ok)
else: print("HUNT: %d FAILED, %d passed." % (fail, ok))
sys.exit(1 if fail else 0)
