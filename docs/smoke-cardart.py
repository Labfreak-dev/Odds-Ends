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
    pg.locator("#rzStack").click(); pg.wait_for_timeout(500)

with sync_playwright() as pw:
    br = pw.chromium.launch()
    pg = br.new_page(viewport={"width":430,"height":900})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(URL); pg.wait_for_timeout(2400)
    pg.evaluate("()=>localStorage.clear()")
    pg.reload(); pg.wait_for_timeout(2200)
    pg.evaluate("()=>{ state.dollars=9e6; state.player.level=99; }")

    # pick a real Mythic and derive its slug exactly as the module does
    subj = pg.evaluate("()=>{ const c=cards.find(x=>x.rarity===15); return {i:cards.indexOf(c), name:c.name}; }")
    slug = pg.evaluate("""(n)=>n.split(" \\u2014 ")[0].toLowerCase()
      .normalize("NFKD").replace(/[\\u0300-\\u036f]/g,"")
      .replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"")""", subj["name"])
    art_file = ROOT / "art" / (slug + ".webp")

    # ---- layer 1: a painted file wins ----
    art_file.write_bytes(WEBP_1PX)
    try:
        open_single(pg, f"cards[{subj['i']}]")
        got = pg.evaluate("()=>{ const i=document.querySelector('#rzArt img'); return i ? i.src : null; }")
        check("a painted file replaces the emoji on a Mythic",
              got and got.endswith(f"art/{slug}.webp"), got)
    finally:
        art_file.unlink(missing_ok=True)
    pg.evaluate("()=>{ document.getElementById('rzOverlay').style.display='none'; }")

    # ---- layer 2: no file -> the wiki photo (stubbed) fills in ----
    pg.evaluate("(u)=>{ ciLookup = async(s)=>({ img:u, title:s }); }", PNG_URI)
    open_single(pg, "cards.find(x=>x.rarity===15 && x !== cards.find(y=>y.rarity===15))")
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
    open_single(pg, "cards.find(x=>x.rarity===14)")
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
    got = pg.evaluate("""()=>{
      const f=[...document.querySelectorAll('.mini-card.framed')];
      return { framed: f.length,
               bg: f.every(e=>e.style.backgroundImage.startsWith('url(')),
               lockedPlain: [...document.querySelectorAll('.mini-card.locked')]
                 .every(e=>!e.classList.contains('framed')) }; }""")
    check("owned collection cards wear their frames", got["framed"] >= 3 and got["bg"], got)
    check("undiscovered cards keep their mystery", got["lockedPlain"])

    pg.click("[data-tab='market']"); pg.wait_for_timeout(1300)
    saw = False
    for i in range(14):
        if pg.evaluate("()=>document.querySelectorAll('.mthumb').length") > 0: saw=True; break
        pg.evaluate("()=>{ const b=document.getElementById('m2Pass'); if(b) b.click(); }")
        pg.wait_for_timeout(300)
    check("a market visitor presents a framed card", saw)
    check("the market prices in dollars",
          pg.evaluate("()=>{ const e=document.querySelector('.m2-price'); return e ? e.textContent.trim().startsWith('$') : true; }"))

    check("zero page errors", not errs, errs[:3])
    br.close()

print()
print("CARD ART: all %d checks passed." % ok if not fail else "CARD ART: %d FAILED, %d passed." % (fail, ok))
sys.exit(1 if fail else 0)
