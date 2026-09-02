"""The fishing HUD plates: plank cast button, SPOTS shield, the named sign,
the wood/brass chips, and the BAIT/TACKLE plates on their chips and modals.

  python3 docs/smoke-fishhud.py
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
def bgs(pg, sel):
    return pg.evaluate("(s)=>{ const e=document.querySelector(s); return e? getComputedStyle(e).backgroundImage : null; }", sel)

with sync_playwright() as pw:
    br = pw.chromium.launch()
    for W, H, tag in [(430, 900, "phone"), (1100, 900, "desktop")]:
        pg = br.new_page(viewport={"width": W, "height": H}); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(URL); pg.wait_for_timeout(2000)
        pg.evaluate("()=>localStorage.clear()"); pg.reload(); pg.wait_for_timeout(2000)
        pg.click("[data-tab='play']"); pg.wait_for_timeout(300)
        pg.click(".play-card[data-game='fishing']"); pg.wait_for_timeout(1400)
        cast = bgs(pg, "#feCtl .btn.fsh-cast")
        check(f"[{tag}] the cast button is the three-slice plank",
              cast and cast.count("fish-cast-") == 3, (cast or "")[:120])
        st = pg.evaluate("""()=>{ const b=document.querySelector('#feCtl .btn.fsh-cast'); const r=b.getBoundingClientRect();
          const cs=getComputedStyle(b); return { h:Math.round(r.height), w:Math.round(r.width), up:cs.textTransform, font:cs.fontFamily,
            loaded: [...document.images].length>=0 }; }""")
        check(f"[{tag}] the plank stands 60px tall with a serif capital label",
              st["h"] >= 58 and st["up"] == "uppercase" and "Georgia" in st["font"], st)
        # the module rewrites the button's className every frame, so add the
        # class and read the style in the same tick
        ur = pg.evaluate("""()=>{ const b=document.querySelector('#feCtl .btn.fsh-cast'); b.classList.add('urgent');
          const cs=getComputedStyle(b); const r={ bg:cs.backgroundImage, flt:cs.filter }; b.classList.remove('urgent'); return r; }""")
        check(f"[{tag}] a bite tints the wood instead of repainting it", ur["bg"] == cast and "hue-rotate" in ur["flt"], ur["flt"])
        head = pg.evaluate("""()=>{ const sh=document.querySelector('.fe-shield'), sg=document.querySelector('.fe-sign');
          if(!sh||!sg) return null; const b=sg.getBoundingClientRect();
          return { shield:getComputedStyle(sh).backgroundImage.includes('fish-spots'),
                   sign:getComputedStyle(sg).backgroundImage.split('fish-sign-').length-1,
                   name:sg.textContent.trim(), want:feSpot().icon+' '+feSpot().name,
                   w:Math.round(b.width), h:Math.round(b.height), fits: b.right <= innerWidth }; }""")
        check(f"[{tag}] the SPOTS shield heads the picker", head and head["shield"], head)
        check(f"[{tag}] the sign is three slices and names the current spot",
              head and head["sign"] == 3 and head["name"] == head["want"] and head["fits"], head)
        # walk to another spot and the sign follows
        pg.evaluate("""()=>{ const sp=feSpots(); if(!sp.open.includes('shallows')) sp.open.push('shallows'); sp.cur='shallows';
          feSpotHtml=''; }""")
        # the chips are hidden now (the map is the way); walk through the same handler
        pg.evaluate("()=>feSpotTap('dock')"); pg.wait_for_timeout(400)
        pg.evaluate("()=>feSpotTap('shallows')"); pg.wait_for_timeout(600)
        nm = pg.evaluate("()=>({ sign: document.querySelector('.fe-sign').textContent.trim(), cur: feSpot().name })")
        check(f"[{tag}] the sign follows the walk to a new spot", nm["cur"] in nm["sign"] and "Shallows" in nm["sign"], nm)
        chips = pg.evaluate("""()=>{ const c=document.getElementById('feChumChip'), t=document.getElementById('feTackleChip');
          return { bait: getComputedStyle(c).backgroundImage.includes('fish-bait') && getComputedStyle(c).fontSize==='0px',
                   tackle: getComputedStyle(t).backgroundImage.includes('fish-tackle') && Math.round(t.getBoundingClientRect().width)>=50,
                   spot: getComputedStyle(document.querySelector('.fe-spot')).fontFamily.includes('Georgia'),
                   sec: getComputedStyle(document.querySelector('.fe-secbtn')).backgroundImage.includes('linear-gradient') }; }""")
        check(f"[{tag}] BAIT tin and TACKLE plate replace the chum and tackle chips", chips["bait"] and chips["tackle"], chips)
        check(f"[{tag}] spot tags and shore buttons are wood and brass", chips["spot"] and chips["sec"], chips)
        pg.click("#feTackleChip"); pg.wait_for_timeout(500)
        mod = pg.evaluate("""()=>{ const b=document.querySelector('#feTackle .fej-head b'); if(!b) return null;
          const cs=getComputedStyle(b,'::before'); return { img: cs.backgroundImage.includes('fish-tackle'), w: parseFloat(cs.width) }; }""")
        check(f"[{tag}] the Tackle Shop header wears the TACKLE plate", mod and mod["img"] and mod["w"] >= 60, mod)
        pg.evaluate("()=>{ const x=document.getElementById('feTkX'); if(x) x.click(); }"); pg.wait_for_timeout(200)
        pg.click("#feChumChip"); pg.wait_for_timeout(500)
        mod = pg.evaluate("""()=>{ const b=document.querySelector('#feChum .fej-head b'); if(!b) return null;
          return { img: getComputedStyle(b,'::before').backgroundImage.includes('fish-bait') }; }""")
        check(f"[{tag}] the Chum Grinder header wears the BAIT tin", mod and mod["img"], mod)
        imgs = pg.evaluate("""async()=>{ const urls=['fish-cast-l','fish-cast-m','fish-cast-r','fish-sign-l','fish-sign-m','fish-sign-r','fish-spots','fish-bait','fish-tackle'];
          const r=await Promise.all(urls.map(u=>new Promise(res=>{ const i=new Image(); i.onload=()=>res(1); i.onerror=()=>res(0); i.src='art/ui/'+u+'.webp'; })));
          return r.reduce((a,b)=>a+b,0); }""")
        check(f"[{tag}] all nine plate files load", imgs == 9, imgs)
        check(f"[{tag}] zero page errors", not errs, errs[:3])
        pg.close()
    br.close()
print()
print("FISH HUD: all %d checks passed." % ok if not fail else "FISH HUD: %d FAILED, %d passed." % (fail, ok))
sys.exit(1 if fail else 0)
