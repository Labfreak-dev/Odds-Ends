"""Each water looks like somewhere: six spots, six different scenes, and an
arrival plank when you step ashore somewhere new.

  python3 docs/smoke-scenes.py
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
SPOTS = ["dock","shallows","ledge","midnight","reef","confluence"]
HASH = """()=>{ const c=document.getElementById('fshCanvas'), g=c.getContext('2d');
  const d=g.getImageData(0, 1284, 1600, 1000).data;   /* the water band: scene y 350..850, FE_OFF below the top */ let h=0, r=0, gg=0, b=0, n=0;
  for(let i=0;i<d.length;i+=1604){ h=(h*31+d[i]+d[i+1]*7+d[i+2]*13)|0; r+=d[i]; gg+=d[i+1]; b+=d[i+2]; n++; }   /* stride is a multiple of 4: stay on the red byte */
  return { h, r:Math.round(r/n), g:Math.round(gg/n), b:Math.round(b/n) }; }"""
with sync_playwright() as pw:
    br = pw.chromium.launch()
    pg = br.new_page(viewport={"width": 900, "height": 900}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(URL); pg.wait_for_timeout(2000)
    pg.evaluate("()=>localStorage.clear()"); pg.reload(); pg.wait_for_timeout(2000)
    pg.evaluate("()=>{ fshInv().spots.open=['dock','shallows','ledge','midnight','reef','confluence']; }")
    pg.click("[data-tab='play']"); pg.wait_for_timeout(300)
    pg.click(".play-card[data-game='fishing']"); pg.wait_for_timeout(1200)
    # feEnv exists only once the water has drawn; pin it to a clear noon so the scenes compare fairly
    pg.evaluate("()=>{ feEnv.hour=12; feEnv.weather='clear'; feEnv.blend=1; }"); pg.wait_for_timeout(400)
    check("the first frame after load is not an arrival", pg.evaluate("()=>feScene.id==='dock' && feScene.arrive===0"))
    seen = {}
    for sid in SPOTS:
        pg.evaluate(f"()=>feSpotTap('{sid}')"); pg.wait_for_timeout(120)
        if sid != "dock":
            ar = pg.evaluate("()=>({ a: feScene.arrive, name: feScene.name })")
            check(f"stepping ashore at {sid} raises the arrival plank", ar["a"] > 0.9 and sid in ar["name"].lower().replace(" ", "") or (ar["a"] > 0.9 and ar["name"]), ar)
        pg.wait_for_timeout(1900)
        seen[sid] = pg.evaluate(HASH)
        check(f"the arrival at {sid} has faded", pg.evaluate("()=>feScene.arrive===0"))
    check("six waters, six different scenes", len({v["h"] for v in seen.values()}) == 6, {k: v["h"] for k, v in seen.items()})
    d, m, r, s = seen["dock"], seen["midnight"], seen["reef"], seen["shallows"]
    check("the Mark's water shifts purple against the dock (green falls away from red and blue)",
          m["g"]/m["b"] < d["g"]/d["b"] - 0.05 and m["r"]/m["g"] > d["r"]/d["g"] + 0.05, (d, m))
    check("the Shelf's water runs teal-green against the dock", r["g"] > d["g"] - 2 and r["r"] < d["r"] + 8 and r["h"] != d["h"], (d, r))
    check("the Shallows go murky green", s["g"] >= s["b"] or s["r"] > d["r"], (d, s))
    a = pg.evaluate(HASH)["h"]; pg.wait_for_timeout(1300); b = pg.evaluate(HASH)["h"]
    check("the scenery moves on its own", a != b)
    check("zero page errors", not errs, errs[:3])
    br.close()
print()
print("SCENES: all %d checks passed." % ok if not fail else "SCENES: %d FAILED, %d passed." % (fail, ok))
sys.exit(1 if fail else 0)
