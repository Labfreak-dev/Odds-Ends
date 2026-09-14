"""Headless proof of set completion rewards (batch 135): crossing a quarter of
a set pays once, the shelf names the next milestone, and nothing pays twice."""
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
    pg = br.new_page(viewport={"width":1100,"height":1000})
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(URL); pg.wait_for_timeout(2400)
    pg.evaluate("()=>localStorage.clear()"); pg.reload(); pg.wait_for_timeout(2200)
    pg.evaluate("()=>{ state.dollars=0; state.owned={}; state.setMilestones={}; state.player.level=99; }")
    info = pg.evaluate("()=>{ const p=PACKS.find(x=>x.key==='everyday'); const pr=packSetProgress(p); return {count:pr.count, have:pr.have, pay25:setMilestonePay(pr.count,1)}; }")
    check("the everyday set counts its cards", info["count"] > 50 and info["have"] == 0, info)
    # own a quarter of the set
    pg.evaluate("()=>{ const p=PACKS.find(x=>x.key==='everyday'); const pool=packSetPool(p); const n=Math.ceil(pool.length*0.25); for(let i=0;i<n;i++) state.owned[pool[i].id]=1; saveState(); }"); pg.wait_for_timeout(400)
    got = pg.evaluate("()=>({d:Math.round(state.dollars), m:state.setMilestones.everyday, toast:[...document.querySelectorAll('.mine-toast')].map(t=>t.textContent)})")
    check("a quarter of the set pays the 25% milestone once", got["m"] and got["m"].get("25") and not got["m"].get("50") and abs(got["d"]-info["pay25"]) < 50, got)
    check("...with a toast naming the set", any("Everyday Items 25%" in t for t in got["toast"]), got["toast"])
    d1 = pg.evaluate("()=>state.dollars")
    pg.evaluate("()=>{ saveState(); saveState(); checkSetMilestones(true); }"); pg.wait_for_timeout(100)
    check("saving again never pays twice", abs(pg.evaluate("()=>state.dollars") - d1) < 50)
    pg.evaluate("()=>{ uiEnterSection('packs'); renderPackShelf(); }"); pg.wait_for_timeout(200)
    line = pg.evaluate("()=>{ const el=[...document.querySelectorAll('.pack')].find(e=>e.dataset.pack==='everyday'); return el && el.querySelector('.pack-next') && el.querySelector('.pack-next').textContent; }")
    check("the shelf names the next milestone", line and line.startswith("next: 50%"), line)
    # complete the set: 50, 75 and 100 land together
    pg.evaluate("()=>{ const p=PACKS.find(x=>x.key==='everyday'); for(const c of packSetPool(p)) state.owned[c.id]=1; saveState(); }"); pg.wait_for_timeout(400)
    m = pg.evaluate("()=>state.setMilestones.everyday")
    check("finishing the set claims every remaining milestone", all(str(k) in m for k in (25,50,75,100)), m)
    pg.evaluate("()=>renderPackShelf()"); pg.wait_for_timeout(200)
    check("the shelf marks the set complete", pg.evaluate("()=>{ const el=[...document.querySelectorAll('.pack')].find(e=>e.dataset.pack==='everyday'); return el && /SET COMPLETE/.test(el.textContent); }"))
    check("the Mega Booster is not a set", pg.evaluate("()=>packSetProgress(PACKS.find(x=>x.key==='mega'))===null"))
    # the milestone survives a reload
    pg.evaluate("()=>saveState()"); pg.reload(); pg.wait_for_timeout(2200)
    check("claimed milestones persist", pg.evaluate("()=>!!(state.setMilestones && state.setMilestones.everyday && state.setMilestones.everyday[100])"))
    check("zero page errors", not errs, errs[:3])
    br.close()
print()
if fail == 0: print("SETS: all %d checks passed." % ok)
else: print("SETS: %d FAILED, %d passed." % (fail, ok))
sys.exit(1 if fail else 0)
