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
    pg.wait_for_timeout(900)          # the cap tumbles off for 620ms first

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
    # resource-load failures are expected here by design: the art layer PROBES
    # art/<slug>.webp (404s on purpose until a painting lands) and calls the
    # wiki, which sandboxes may block. The game absorbs both silently, so only
    # real console errors count - never "Failed to load resource".
    pg.on("console", lambda m: errs.append("console:" + m.text)
          if m.type == "error" and "Failed to load resource" not in m.text else None)
    pg.goto(URL)
    pg.wait_for_timeout(2500)
    # start from a FRESH save: file:// localStorage persists between runs, so
    # without this the suite inherits whatever mining rate the last run built
    # up - and a hot enough rate drips dollars faster than any wait tolerates
    pg.evaluate("()=>localStorage.clear()")
    pg.reload(); pg.wait_for_timeout(2200)
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
    check("the pack renders its 3D art, both halves",
          pg.locator(".rz-cap").count() == 1 and pg.locator(".rz-body").count() == 1)
    check("the art actually decodes",
          pg.evaluate("""()=>{
            const el = document.querySelector('.rz-body');
            const src = getComputedStyle(el).backgroundImage;
            if(!src.startsWith('url(')) return false;
            return new Promise(r=>{ const i=new Image();
              i.onload=()=>r(i.naturalWidth>0); i.onerror=()=>r(false);
              i.src = src.slice(5,-2); });
          }"""))
    # layout offsets, not bounding rects: the pack sways +/-1.6deg, which makes
    # the two halves' rotated rects overlap even though they sit flush.
    check("the cap sits flush above the body, so the slice line is real",
          pg.evaluate("""()=>{ const c=document.querySelector('.rz-cap'),
                                     b=document.querySelector('.rz-body');
            return c.offsetTop === 0 && b.offsetTop === c.offsetHeight; }"""))
    # the day's dealt tasks come from a hash over a shrinking pool, so a
    # "pack" task is not guaranteed to be on today's board - when it is,
    # it must count; when it is not, the wrapper-order check above already
    # proved the counting chain is intact
    if lg0 is not None:
        check("ledger counted the pack", packtask() > lg0, f"{lg0} -> {packtask()}")
    else:
        check("no pack task dealt today (wrapper chain proven above)", True)

    name_line = pg.locator(".rz-packname").inner_text()
    pulls = int(name_line.split("\u00b7")[-1].strip().split()[0])
    owned1 = pg.evaluate("()=>Object.values(state.owned||{}).reduce((a,b)=>a+(b||0),0)")
    check("pulls applied exactly once", owned1 - owned0 == pulls, f"owned +{owned1-owned0} for {pulls} pulls")

    # ---- stage 2: tearing ---------------------------------------------
    tear(pg)
    check("dragging tore the foil open", pg.locator(".rz-spread").count() == 1)
    cells = pg.locator(".rz-sp").count()
    check("the whole pack lands in the spread, every card its own cell",
          cells == pulls, (cells, pulls))
    # only a NEW card or a Legendary+ waits face-down; everything else is up
    check("new and big pulls wait face-down, the rest are face up",
          pg.evaluate("""()=>{ const R=window.oeRipState();
            return R.pulls.every((c,i)=> (!!c._wasNew || c.rarity>=14) === !!R.down[i]); }"""))
    check("face-down cells wear the card back, face-up cells their frame",
          pg.evaluate("""()=>[...document.querySelectorAll('.rz-sp')].every(el=>{
            const img = el.querySelector(el.classList.contains('down') ? '.rz-spback' : '.rz-spframe');
            return img && img.complete && img.naturalWidth > 0; })"""))
    check("face-down cells carry no ship button",
          pg.locator(".rz-sp.down .rz-sps").count() == 0)
    check("no error while tearing", not errs, errs[:3])

    # ---- stage 3: turn a card, zoom it, and SHIP it -------------------
    down0 = pg.locator(".rz-sp.down").count()
    first = pg.locator(".rz-sp").first
    if "down" in (first.get_attribute("class") or ""):
        first.locator(".rz-spcard").click(); pg.wait_for_timeout(450)
        check("tapping a face-down card turns it over where it lies",
              pg.locator(".rz-sp.down").count() == down0 - 1 and "down" not in first.get_attribute("class"))
    else:
        check("the first card was already face up", True)
    first.locator(".rz-spcard").click(); pg.wait_for_timeout(450)
    check("tapping a face-up card zooms it", pg.locator(".rz-card").count() == 1)
    check("it says NEW or DUPLICATE", pg.locator(".rz-b").count() == 1)
    check("it quotes a payout", "$" in pg.locator("#rzShip").inner_text(),
          pg.locator("#rzShip").inner_text())

    snap = pg.evaluate("""()=>{ const o={}; for(const k in state.owned) o[k]=state.owned[k];
        return {owned:o, cr:state.dollars, mb:state.miningBonus}; }""")
    pg.locator("#rzShip").click(); pg.wait_for_timeout(500)
    post = pg.evaluate("""()=>{ const o={}; for(const k in state.owned) o[k]=state.owned[k];
        return {owned:o, cr:state.dollars, mb:state.miningBonus}; }""")
    diffs = [k for k in snap["owned"] if snap["owned"][k] != post["owned"].get(k, 0)]
    check("SHIP removed exactly one card id", len(diffs) == 1, diffs)
    if diffs:
        check("...and exactly one copy of it", snap["owned"][diffs[0]] - post["owned"].get(diffs[0], 0) == 1)
    check("SHIP paid out", post["cr"] > snap["cr"], f"{snap['cr']} -> {post['cr']}")
    check("mining bonus recomputed, not left stale", post["mb"] is not None)
    check("SHIP drops back onto the spread with the card marked",
          pg.locator(".rz-spread").count() == 1 and pg.locator(".rz-sp.sold").count() == 1)

    # ---- a shipped card can be taken back at the same price ----------
    # the exact payout, not the pocket delta - mining drips into the pocket
    # during the 500ms wait above and would put the refund off by a few dollars
    pay = pg.evaluate("()=>window.oeRipState().shipped")
    pg.locator(".rz-sp.sold .rz-spk").first.click(); pg.wait_for_timeout(60)
    back = pg.evaluate("""()=>{ const o={}; for(const k in state.owned) o[k]=state.owned[k];
        return {owned:o, cr:state.dollars}; }""")
    check("undo puts the copy back in the binder",
          all(back["owned"].get(k, 0) == snap["owned"][k] for k in snap["owned"]))
    # the ledger, not the pocket delta: mining drips dollars in between the
    # two reads and put a 55 refund at 52.5 (batch 126 flake)
    check("...and takes the same money back",
          pg.evaluate("()=>window.oeRipState().shipped") == 0 and back["cr"] < post["cr"], (pay, post["cr"] - back["cr"]))
    check("nothing marked shipped after the undo", pg.locator(".rz-sp.sold").count() == 0)

    # ---- the cell's own ship button pays without the zoom -------------
    if pulls > 1:
        cell = pg.locator(".rz-sp:not(.down)").nth(1) if pg.locator(".rz-sp:not(.down)").count() > 1 else None
        if cell is None:
            pg.locator(".rz-sp.down .rz-spcard").first.click(); pg.wait_for_timeout(450)
            cell = pg.locator(".rz-sp:not(.down)").nth(1)
        cr = pg.evaluate("()=>state.dollars")
        cell.locator(".rz-sps").click(); pg.wait_for_timeout(60)
        check("the cell's SHIP button pays straight from the spread", pg.evaluate("()=>state.dollars") > cr + 1)
        check("...and marks that cell", "sold" in (cell.get_attribute("class") or ""))

    # ---- KEEP costs and gives nothing ---------------------------------
    if pg.locator(".rz-sp:not(.down):not(.sold)").count():
        pg.locator(".rz-sp:not(.down):not(.sold) .rz-spcard").first.click(); pg.wait_for_timeout(450)
        shipped = pg.evaluate("()=>window.oeRipState().shipped")
        own = pg.evaluate("()=>JSON.stringify(state.owned)")
        # the shipped ledger, not the pocket: mining drips dollars into the
        # pocket between any two reads and made this check flaky at 60ms
        pg.locator("#rzKeep").click(); pg.wait_for_timeout(60)
        check("KEEP pays nothing", pg.evaluate("()=>window.oeRipState().shipped") == shipped)
        pg.wait_for_timeout(300)
        check("KEEP leaves the binder alone", pg.evaluate("()=>JSON.stringify(state.owned)") == own)
        check("KEEP returns to the spread", pg.locator(".rz-spread").count() == 1)

    # ---- turn the rest over, all at once ------------------------------
    if pg.locator("#rzRevealAll").count():
        pg.locator("#rzRevealAll").click(); pg.wait_for_timeout(500)
        check("turn-the-rest-over leaves nothing face-down", pg.locator(".rz-sp.down").count() == 0)

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
