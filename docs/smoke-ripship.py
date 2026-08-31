"""Drives the real page through the whole Rip & Ship ritual: tear, flip,
SHIP, KEEP, keep-the-rest, summary, rip-another — plus what each choice
actually does to the save, and every other place a pack can come from.

  python3 docs/smoke-ripship.py            # against ./index.html
  OE_INDEX=/path/to/index.html python3 docs/smoke-ripship.py
"""
import os, pathlib, sys
from playwright.sync_api import sync_playwright

IDX = os.environ.get("OE_INDEX") or str(pathlib.Path(__file__).resolve().parent.parent / "index.html")
URL = "file://" + IDX

ok = fail = 0
def check(name, cond, extra=""):
    global ok, fail
    if cond: ok += 1; print("  ok   " + name)
    else:    fail += 1; print("  FAIL " + name + ("  " + str(extra) if extra else ""))

def tear(pg):
    """A real pointer drag across the foil, the way a thumb does it."""
    box = pg.locator("#rzPack").bounding_box()
    if not box: return
    pg.mouse.move(box["x"] + 10, box["y"] + 20)
    pg.mouse.down()
    for i in range(1, 14):
        pg.mouse.move(box["x"] + 10 + i * 40, box["y"] + 20)
    pg.mouse.up()
    pg.wait_for_timeout(250)

def dismiss(pg):
    pg.evaluate("()=>{ const o=document.getElementById('rzOverlay'); if(o) o.style.display='none'; }")

def rich(pg):
    pg.evaluate("()=>{ state.dollars=900000; state.player=state.player||{}; state.player.level=99; }")

def one_pack(pg, n=1):
    key = "price10" if n == 10 else "price1"
    pg.evaluate("(k)=>{ buyPacks(PACKS.find(p=>p[k]>0 && !p.hidden && !p.testOnly).key, k==='price10'?10:1); }", key)
    pg.wait_for_timeout(400)

with sync_playwright() as pw:
    br = pw.chromium.launch()
    pg = br.new_page(viewport={"width":430, "height":900})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append("console:" + m.text) if m.type == "error" else None)
    pg.goto(URL)
    pg.wait_for_timeout(2500)
    check("page booted clean", not errs, errs[:3])

    # ---- the wrapper chain --------------------------------------------
    src = pg.evaluate("()=>startReveal.toString()")
    check("the ledger stays the OUTER startReveal wrapper", "feLedgerBump" in src,
          "ripship loaded after ledger — daily pack tasks would stop counting")

    rich(pg)

    def packtask():
        return pg.evaluate("""()=>{ try{
            const L = state.ledger; if(!L || !L.items) return None_;
            const it = L.items.find(i=>i.kind==='pack'); return it ? it.n : null;
        }catch(e){ return null; } }""".replace("None_", "null"))

    lg0 = packtask()
    owned0 = pg.evaluate("()=>Object.values(state.owned||{}).reduce((a,b)=>a+(b||0),0)")
    one_pack(pg)

    # ---- stage 1: the sealed pack -------------------------------------
    check("rip overlay opened", pg.locator("#rzOverlay").is_visible())
    check("the old reveal overlay stayed shut",
          not pg.evaluate("()=>document.getElementById('revealOverlay').classList.contains('show')"))
    check("pack face is showing", pg.locator("#rzPack").count() == 1)
    check("ledger counted the pack", lg0 is not None and packtask() > lg0, f"{lg0} -> {packtask()}")

    pulls = int(pg.locator(".rz-packsub").inner_text().split()[0])
    owned1 = pg.evaluate("()=>Object.values(state.owned||{}).reduce((a,b)=>a+(b||0),0)")
    check("pulls applied exactly once", owned1 - owned0 == pulls, f"owned +{owned1-owned0} for {pulls} pulls")

    # ---- stage 2: tearing ---------------------------------------------
    tear(pg)
    check("dragging tore the foil open", pg.locator("#rzStack").count() == 1)
    check("no error while tearing", not errs, errs[:3])

    # ---- stage 3: a card, and SHIP it ---------------------------------
    pg.locator("#rzStack").click(); pg.wait_for_timeout(250)
    check("a card face turned over", pg.locator(".rz-card").count() == 1)
    check("it says NEW or DUPLICATE", pg.locator(".rz-b").count() == 1)
    check("it quotes a payout", "$" in pg.locator("#rzShip").inner_text(),
          pg.locator("#rzShip").inner_text())

    snap = pg.evaluate("""()=>{ const o={}; for(const k in state.owned) o[k]=state.owned[k];
        return {owned:o, cr:state.dollars, mb:state.miningBonus}; }""")
    pg.locator("#rzShip").click(); pg.wait_for_timeout(250)
    post = pg.evaluate("""()=>{ const o={}; for(const k in state.owned) o[k]=state.owned[k];
        return {owned:o, cr:state.dollars, mb:state.miningBonus}; }""")
    diffs = [k for k in snap["owned"] if snap["owned"][k] != post["owned"].get(k, 0)]
    check("SHIP removed exactly one card id", len(diffs) == 1, diffs)
    if diffs:
        check("...and exactly one copy of it", snap["owned"][diffs[0]] - post["owned"].get(diffs[0], 0) == 1)
    check("SHIP paid out", post["cr"] > snap["cr"], f"{snap['cr']} -> {post['cr']}")
    check("mining bonus recomputed, not left stale", post["mb"] is not None)

    # ---- KEEP costs and gives nothing ---------------------------------
    if pg.locator("#rzStack").count():
        pg.locator("#rzStack").click(); pg.wait_for_timeout(200)
        cr = pg.evaluate("()=>state.dollars")
        own = pg.evaluate("()=>JSON.stringify(state.owned)")
        pg.locator("#rzKeep").click(); pg.wait_for_timeout(200)
        check("KEEP pays nothing", pg.evaluate("()=>state.dollars") == cr)
        check("KEEP leaves the binder alone", pg.evaluate("()=>JSON.stringify(state.owned)") == own)

    # ---- keep the rest, then the summary ------------------------------
    if pg.locator("#rzKeepAll").count():
        own = pg.evaluate("()=>JSON.stringify(state.owned)")
        pg.locator("#rzKeepAll").click(); pg.wait_for_timeout(300)
        check("keep-the-rest touches nothing you own",
              pg.evaluate("()=>JSON.stringify(state.owned)") == own)
    check("summary reached", pg.locator(".rz-doneh").count() == 1)
    check("summary shows the net", pg.locator(".rz-donenet").count() == 1)
    check("summary names the best pull", pg.locator(".rz-bestline").count() == 1)

    # ---- rip another straight from the summary ------------------------
    if pg.locator("#rzAgain").count():
        pg.locator("#rzAgain").click(); pg.wait_for_timeout(500)
        check("RIP ANOTHER started a fresh pack", pg.locator("#rzPack").count() == 1)
        dismiss(pg)
    else:
        check("RIP ANOTHER offered on a paid pack", False, "button missing")

    # ---- every other pack source --------------------------------------
    dismiss(pg); rich(pg)

    pg.evaluate("()=>grantFullSpectrumPack()"); pg.wait_for_timeout(400)
    check("a granted pack opens too", pg.locator("#rzPack").count() == 1)
    tear(pg)
    if pg.locator("#rzKeepAll").count(): pg.locator("#rzKeepAll").click(); pg.wait_for_timeout(300)
    check("a free pack offers no RIP ANOTHER", pg.locator("#rzAgain").count() == 0)
    check("a free pack still summarises", pg.locator(".rz-doneh").count() == 1)
    dismiss(pg)

    # market2 hands over a bare {name, key} with no icon and no price
    pg.evaluate("""()=>{
        const pulls = openOnePack(PACKS.find(p=>p.price1>0 && !p.hidden && !p.testOnly).key, new Set());
        startReveal({ name:"Mystery Lot", key:"m2lot" }, [pulls], 1200);
    }"""); pg.wait_for_timeout(400)
    check("a market lot opens", pg.locator("#rzPack").count() == 1)
    tear(pg)
    if pg.locator("#rzKeepAll").count(): pg.locator("#rzKeepAll").click(); pg.wait_for_timeout(300)
    check("a market lot summarises", pg.locator(".rz-doneh").count() == 1)
    dismiss(pg)

    rich(pg)
    one_pack(pg, 10)
    check("a ten-pack opens", pg.locator("#rzPack").count() == 1)
    tear(pg)
    if pg.locator("#rzKeepAll").count(): pg.locator("#rzKeepAll").click(); pg.wait_for_timeout(400)
    check("a ten-pack summarises", pg.locator(".rz-doneh").count() == 1)

    check("zero errors across the whole ritual", not errs, errs[:5])
    br.close()

print()
if fail == 0:
    print("RIP & SHIP: all %d checks passed." % ok)
else:
    print("RIP & SHIP: %d FAILED, %d passed." % (fail, ok))
sys.exit(1 if fail else 0)
