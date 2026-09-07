"""The three art layers on the flip: painted file, wiki photo, emoji floor.

The wiki layer is stubbed (this suite must run offline); the painted layer
uses a real temporary file in art/, removed afterwards.

  python3 docs/smoke-cardart.py
"""
import os, pathlib, sys, base64
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
IDX = os.environ.get("OE_INDEX") or str(ROOT / "index.html")
URL = "file://" + IDX
ok = fail = 0
def check(n, c, e=""):
    global ok, fail
    if c: ok += 1; print("  ok   " + n)
    else: fail += 1; print("  FAIL " + n + ("  " + str(e) if e else ""))

# a real 1x1 webp for the painted-art probe
WEBP_1PX = base64.b64decode(
    "UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==")
PNG_URI = ("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAA"
           "fFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")

def tear(pg):
    box = pg.locator("#rzPack").bounding_box()
    pg.mouse.move(box["x"]+8, box["y"]+20); pg.mouse.down()
    for i in range(1,16): pg.mouse.move(box["x"]+8+i*40, box["y"]+20)
    pg.mouse.up(); pg.wait_for_timeout(900)

def open_single(pg, card_expr):
    pg.evaluate("(e)=>{ const c=eval(e); startReveal({name:'Art Probe', key:'artprobe'}, [[c]], 0); }", card_expr)
    pg.wait_for_timeout(400)
    tear(pg)
    sp = pg.locator(".rz-sp").first
    if "down" in (sp.get_attribute("class") or ""):     # a new card waits face-down: turn it first
        sp.locator(".rz-spcard").click(); pg.wait_for_timeout(450)
    sp.locator(".rz-spcard").click(); pg.wait_for_timeout(500)   # then zoom it

with sync_playwright() as pw:
    br = pw.chromium.launch()
    pg = br.new_page(viewport={"width":430,"height":900})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(URL); pg.wait_for_timeout(2400)
    pg.evaluate("()=>localStorage.clear()")
    pg.reload(); pg.wait_for_timeout(2200)
    pg.evaluate("()=>{ state.dollars=9e6; state.player.level=99; }")

    # THE TEMP FILE MUST NEVER SHADOW A REAL PAINTING. This test once targeted
    # 'the first Mythic' - fine while nothing was painted, but the day the real
    # vacuum-tube-radio.webp landed, the temp write-then-unlink DELETED it, the
    # deletion shipped, and the suite ate the restored copy twice more while
    # being fixed. Always find a slug with no file, and refuse to run if the
    # chosen path somehow exists.
    painted = {f.stem for f in (ROOT/"art").glob("*.webp")}
    # Two DISTINCT unpainted cards: layer 1 temporarily paints the first one,
    # and layers 2/3 use the second. Reusing one card for all three layers let
    # Chromium's memory cache serve the unlinked temp painting into layer 2/3
    # (the intermittent 2-fail flake: batches 79, 85, 86).
    probes = pg.evaluate("""(have)=>{
      const strip = s=>s.split(" \u2014 ")[0].toLowerCase().normalize("NFKD")
        .replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
      const out=[], seen=new Set();
      for(const c of cards){
        const sl=strip(c.name);
        if(c.rarity>=9 && !have.includes(sl) && !seen.has(sl)){
          seen.add(sl); out.push({ i: cards.indexOf(c), slug: sl });
          if(out.length===2) break; } }
      return out; }""", sorted(painted))
    check("an unpainted high-tier card exists to test with", len(probes) == 2)
    probe, probe2 = probes
    art_file = ROOT / "art" / (probe["slug"] + ".webp")
    assert not art_file.exists(), "refusing to shadow a real painting"
    assert not (ROOT / "art" / (probe2["slug"] + ".webp")).exists()

    # ---- layer 1: a painted file wins ----
    art_file.write_bytes(WEBP_1PX)
    try:
        open_single(pg, f"cards[{probe['i']}]")
        got = pg.evaluate("()=>{ const i=document.querySelector('#rzArt img'); return i ? i.src : null; }")
        check("a painted file replaces the emoji",
              got and got.endswith(f"art/{probe['slug']}.webp"), got)
    finally:
        art_file.unlink(missing_ok=True)
    pg.evaluate("()=>{ document.getElementById('rzOverlay').style.display='none'; }")

    # ---- layer 2: no file -> the wiki photo (stubbed) fills in ----
    # probe2, never painted this run, so no stale browser cache for its slug
    unpainted = probe2["i"]
    pg.evaluate("(u)=>{ ciLookup = async(s)=>({ img:u, title:s }); }", PNG_URI)
    open_single(pg, f"cards[{unpainted}]")
    got = pg.evaluate("()=>{ const i=document.querySelector('#rzArt img'); return i ? i.src.slice(0,30) : null; }")
    check("with no painting, the wiki photo fills in", got and got.startswith("data:image/png"), got)
    pg.evaluate("()=>{ document.getElementById('rzOverlay').style.display='none'; }")

    # ---- low tiers go straight to the wiki, never probe art/ ----
    open_single(pg, "cards.find(x=>x.rarity===0)")
    got = pg.evaluate("()=>{ const i=document.querySelector('#rzArt img'); return i ? i.src.slice(0,30) : null; }")
    check("a Common goes straight to the wiki photo", got and got.startswith("data:image/png"), got)
    pg.evaluate("()=>{ document.getElementById('rzOverlay').style.display='none'; }")

    # ---- layer 3: both miss -> the emoji stays ----
    pg.evaluate("()=>{ ciLookup = async(s)=>null; }")
    open_single(pg, f"cards[{unpainted}]")
    got = pg.evaluate("()=>{ const h=document.getElementById('rzArt'); return {img: !!h.querySelector('img'), txt: h.textContent.trim().length>0}; }")
    check("when everything misses, the emoji holds the frame", got and not got["img"] and got["txt"], got)

    # the framed layout: the art window sits under the frame image, inside the card
    geo = pg.evaluate("""()=>{
      const card=document.querySelector('.rz-card'), win=document.getElementById('rzArt'),
            fr=document.querySelector('.rz-fframe');
      if(!card||!win||!fr) return null;
      const cb=card.getBoundingClientRect(), wb=win.getBoundingClientRect();
      return { frOk: fr.complete && fr.naturalWidth>0,
               inside: wb.left>=cb.left && wb.right<=cb.right && wb.top>=cb.top && wb.bottom<=cb.bottom,
               size: wb.width>80 && wb.height>80,
               under: +getComputedStyle(win).zIndex < +getComputedStyle(fr).zIndex }; }""")
    check("the frame renders with the window inside the card",
          geo and geo["frOk"] and geo["inside"] and geo["size"] and geo["under"], geo)
    # different rarity bands wear different frames
    lo = pg.evaluate("()=>document.querySelector('.rz-fframe').src.length")
    pg.evaluate("()=>{ document.getElementById('rzOverlay').style.display='none'; }")
    open_single(pg, "cards.find(x=>x.rarity===15)")
    hi = pg.evaluate("()=>document.querySelector('.rz-fframe').src.length")
    check("a Legendary and a Mythic wear different frames", lo != hi, (lo, hi))

    # ---- the frames travel: collection grid and the market visitor ----
    pg.evaluate("()=>{ const o=document.getElementById('rzOverlay'); if(o) o.style.display='none'; }")
    pg.evaluate("""()=>{
      for(const t of [0,9,15]){ const c=cards.find(x=>x.rarity===t); state.owned[c.id]=1; }
      state.miningBonus = computeMiningBonusFromOwned(state.owned); saveState();
    }""")
    pg.click("[data-tab='collection']"); pg.wait_for_timeout(900)
    # Filter to owned-only first: the grid is paginated by subject group, so the
    # three cards owned above are not guaranteed to land on page 1. (This check
    # used to pass by accident - the layer probes' open_single applied pulls to
    # state.owned, and the probe subjects happened to sit on page 1. Once every
    # non-Raid-Gear card was painted, the probes became Raid Gear, which the
    # collection filters out, and the accidental frames vanished.)
    pg.evaluate("""()=>{ document.getElementById('ownedFilter').value='owned'; onFilterChange(); }""")
    pg.wait_for_timeout(500)
    got = pg.evaluate("""()=>{
      const f=[...document.querySelectorAll('.mini-card.framed')];
      return { framed: f.length,
               bg: f.every(e=>getComputedStyle(e).backgroundImage.startsWith('url("data:image/webp')) }; }""")
    check("owned collection cards wear their frames", got["framed"] >= 3 and got["bg"], got)
    pg.evaluate("""()=>{ document.getElementById('ownedFilter').value='all'; onFilterChange(); }""")
    pg.wait_for_timeout(500)
    got = pg.evaluate("""()=>({ lockedPlain: [...document.querySelectorAll('.mini-card.locked')]
      .every(e=>!e.classList.contains('framed')),
      lockedN: document.querySelectorAll('.mini-card.locked').length })""")
    check("undiscovered cards keep their mystery", got["lockedPlain"] and got["lockedN"] > 0)

    pg.click("[data-tab='market']"); pg.wait_for_timeout(1300)
    saw = False
    for i in range(14):
        if pg.evaluate("()=>document.querySelectorAll('.mthumb').length") > 0: saw=True; break
        pg.evaluate("()=>{ const b=document.getElementById('m2Pass'); if(b) b.click(); }")
        pg.wait_for_timeout(300)
    check("a market visitor presents a framed card", saw)
    check("the market prices in dollars",
          pg.evaluate("()=>{ const e=document.querySelector('.m2-price'); return e ? e.textContent.trim().startsWith('$') : true; }"))

    # ---- the card-info panel: framed, and the frame survives the foil fx ----
    pg.evaluate("()=>{ const c=cards.find(x=>x.rarity===15); state.owned[c.id]=2; openCardInfo(c.id); }")
    pg.wait_for_timeout(500)
    got = pg.evaluate("""()=>{
      const e=document.getElementById('ciCard');
      return { framed: e.classList.contains('framed'),
               fx: [...e.classList].some(c=>c.startsWith('fx-')),
               bg: getComputedStyle(e).backgroundImage.startsWith('url("data:image/webp') }; }""")
    check("the info panel card wears its frame under the foil fx",
          got and got["framed"] and got["fx"] and got["bg"], got)
    pg.evaluate("()=>document.getElementById('cardInfoOverlay').classList.remove('show')")

    check("zero page errors", not errs, errs[:3])
    br.close()

print()
print("CARD ART: all %d checks passed." % ok if not fail else "CARD ART: %d FAILED, %d passed." % (fail, ok))
sys.exit(1 if fail else 0)
