"""The dollars/credits split: migration, the two pockets, and the counter.

  python3 docs/smoke-economy.py
  OE_INDEX=/path/to/index.html python3 docs/smoke-economy.py
"""
import os, pathlib, sys, json
from playwright.sync_api import sync_playwright

IDX = os.environ.get("OE_INDEX") or str(pathlib.Path(__file__).resolve().parent.parent / "index.html")
URL = "file://" + IDX
SAVE_KEY = "oddsandends_save_v1"
ok = fail = 0
def near(a, b, tol=400):
    """Dollars accrue from mining the whole time the test runs, so a balance is
    only ever compared to within a few seconds of income. Credits are never
    mined, so those stay exact."""
    return abs(a - b) <= tol

def check(n, c, e=""):
    global ok, fail
    if c: ok += 1; print("  ok   " + n)
    else: fail += 1; print("  FAIL " + n + ("  " + str(e) if e else ""))

def fresh_page(pw, seed=None):
    """A page whose localStorage was seeded BEFORE the game ever booted."""
    br = pw.chromium.launch()
    ctx = br.new_context(viewport={"width":430, "height":900})
    # Seed BEFORE any page script runs. Seeding after a goto races the game's
    # own autosave, which writes a fresh state over the seed and makes every
    # migration check silently pass against freshState instead of the save.
    if seed is None:
        ctx.add_init_script("try{ localStorage.clear(); }catch(e){}")
    else:
        ctx.add_init_script(
            "try{ localStorage.clear(); localStorage.setItem(%s, %s); }catch(e){}"
            % (json.dumps(SAVE_KEY), json.dumps(json.dumps(seed))))
    pg = ctx.new_page()
    pg.goto(URL)
    pg.wait_for_timeout(2200)
    return br, pg

with sync_playwright() as pw:
    # ---------- 1. an old save converts, once ----------
    br, pg = fresh_page(pw, {"credits": 48250, "scrap": 12, "owned": {}, "packsOpened": 3})
    got = pg.evaluate("()=>({d:state.dollars, c:state.credits, v:state.econV})")
    check("an old balance became dollars, one for one", near(got["d"], 48250), got)
    check("credits restart at zero", got["c"] == 0, got)
    check("the save is stamped v2", got["v"] == 2, got)
    check("the old save kept its other fields",
          pg.evaluate("()=>state.packsOpened") == 3)

    # reload twice more - the balance must not move
    for i in (1, 2):
        # the init script clears storage on every navigation, so persist the
        # live state by hand and let the reload boot against exactly that
        pg.evaluate("()=>saveState()")
        saved = pg.evaluate("()=>localStorage.getItem(SAVE_KEY)")
        pg.add_init_script("try{ localStorage.setItem(%s, %s); }catch(e){}"
                           % (json.dumps(SAVE_KEY), json.dumps(saved)))
        pg.reload(); pg.wait_for_timeout(2000)
        again = pg.evaluate("()=>({d:state.dollars, c:state.credits})")
        check(f"reload {i} did not convert twice", near(again["d"], 48250) and again["c"] == 0, again)
    br.close()

    # ---------- 2. a save that ALREADY has both pockets is left alone ----------
    br, pg = fresh_page(pw, {"credits": 900, "dollars": 7000, "econV": 2, "owned": {}})
    got = pg.evaluate("()=>({d:state.dollars, c:state.credits})")
    check("a v2 save is not touched", near(got["d"], 7000) and got["c"] == 900, got)
    br.close()

    # ---------- 3. a save with a junk balance does not become NaN ----------
    br, pg = fresh_page(pw, {"credits": "not a number", "owned": {}})
    got = pg.evaluate("()=>({d:state.dollars, c:state.credits})")
    check("a junk balance converts to zero, not NaN",
          near(got["d"], 0) and got["c"] == 0, got)
    check("the header still renders a number",
          pg.locator("#dollarCount").inner_text().startswith("$"),
          pg.locator("#dollarCount").inner_text())
    br.close()

    # ---------- 4. a brand-new player ----------
    br, pg = fresh_page(pw)
    got = pg.evaluate("()=>({d:state.dollars, c:state.credits})")
    check("a new player starts with dollars", got["d"] > 0, got)
    check("...and no credits until they change some", got["c"] == 0, got)

    # ---------- 5. the header shows both pockets ----------
    check("header shows a dollar amount", "$" in pg.locator("#dollarCount").inner_text())
    check("header shows a credit count", pg.locator("#creditCount").count() == 1)

    # ---------- 6. the counter ----------
    pg.evaluate("()=>{ state.dollars = 200000; state.credits = 0; renderHeader(); }")
    pg.locator("#hdrCredits").click(); pg.wait_for_timeout(300)
    check("tapping the credit chip opens the counter",
          pg.locator("#exModal").is_visible())
    rows = pg.locator("[data-extier]")
    check("the counter offers every tier", rows.count() == 4, rows.count())
    d0 = pg.evaluate("()=>state.dollars")
    rows.nth(0).click(); pg.wait_for_timeout(250)
    got = pg.evaluate("()=>({d:state.dollars, c:state.credits})")
    check("the base tier is one for one",
          near(got["d"], d0 - 1000) and got["c"] == 1000, got)
    rows.nth(3).click(); pg.wait_for_timeout(250)
    got2 = pg.evaluate("()=>({d:state.dollars, c:state.credits})")
    check("the biggest tier pays its bonus",
          got2["c"] - got["c"] == 120000 and near(got["d"] - got2["d"], 100000), got2)
    check("the header followed the change",
          pg.locator("#creditCount").inner_text().replace(",", "") == str(got2["c"]))

    # a tier you cannot afford is refused, not silently taken
    pg.evaluate("()=>{ state.dollars = 10; renderHeader(); renderExchange(); }")
    before = pg.evaluate("()=>({d:state.dollars, c:state.credits})")
    pg.evaluate("""()=>{ buyCredits(3); }""")
    after = pg.evaluate("()=>({d:state.dollars, c:state.credits})")
    check("a change you cannot cover is refused", before == after, (before, after))
    pg.evaluate("()=>closeExchange()")

    # ---------- 7. the two pockets pay for different things ----------
    pg.evaluate("()=>{ state.dollars = 500000; state.credits = 500000; state.player.level = 99; renderHeader(); }")

    d0 = pg.evaluate("()=>state.dollars"); c0 = pg.evaluate("()=>state.credits")
    pg.evaluate("()=>buyPacks(PACKS.find(p=>p.price1>0&&!p.hidden&&!p.testOnly).key,1)")
    pg.wait_for_timeout(400)
    check("a pack is paid for in dollars", pg.evaluate("()=>state.dollars") < d0)
    check("...and costs no credits", pg.evaluate("()=>state.credits") == c0)

    # ship a card: cash in
    box = pg.locator("#rzPack").bounding_box()
    pg.mouse.move(box["x"]+10, box["y"]+20); pg.mouse.down()
    for i in range(1,14): pg.mouse.move(box["x"]+10+i*40, box["y"]+20)
    pg.mouse.up(); pg.wait_for_timeout(250)
    pg.locator("#rzStack").click(); pg.wait_for_timeout(250)
    d1 = pg.evaluate("()=>state.dollars"); c1 = pg.evaluate("()=>state.credits")
    pg.locator("#rzShip").click(); pg.wait_for_timeout(250)
    check("shipping a card pays dollars", pg.evaluate("()=>state.dollars") > d1)
    check("...and no credits", pg.evaluate("()=>state.credits") == c1)
    pg.evaluate("()=>{ const o=document.getElementById('rzOverlay'); if(o) o.style.display='none'; }")

    # selling a card pays dollars
    pg.evaluate("()=>{ state.owned[cards[0].id] = 5; }")
    d2 = pg.evaluate("()=>state.dollars"); c2 = pg.evaluate("()=>state.credits")
    pg.evaluate("()=>sellCard(cards[0].id, false)")
    check("selling a card pays dollars", pg.evaluate("()=>state.dollars") > d2 + 1, d2)
    check("...and no credits", pg.evaluate("()=>state.credits") == c2)

    # mining pays dollars
    d3 = pg.evaluate("()=>state.dollars"); c3 = pg.evaluate("()=>state.credits")
    pg.evaluate("()=>{ state.lastMineTs = Date.now() - 600000; mineTick(); }")
    pg.wait_for_timeout(1600)
    check("mining income lands in dollars", pg.evaluate("()=>state.dollars") > d3 + 1, d3)
    check("...and not in credits", pg.evaluate("()=>state.credits") == c3)

    # an upgrade is paid for in credits
    d4 = pg.evaluate("()=>state.dollars"); c4 = pg.evaluate("()=>state.credits")
    bought = pg.evaluate("""()=>{
      try{ buyVillageBuilding("watchtower"); return true; }catch(e){ return false; }
    }""")
    if bought:
        check("an upgrade is paid for in credits", pg.evaluate("()=>state.credits") < c4, c4)
        check("...and costs no dollars", near(pg.evaluate("()=>state.dollars"), d4), d4)
    else:
        check("upgrade path reachable", False, "no empire building found")

    br.close()

print()
print("ECONOMY: all %d checks passed." % ok if not fail else "ECONOMY: %d FAILED, %d passed." % (fail, ok))
sys.exit(1 if fail else 0)
