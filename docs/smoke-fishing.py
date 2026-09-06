# Visual + behavioral proof of the fishing rebuild.
import asyncio, sys
from playwright.async_api import async_playwright

import os as _os
# Default to the built index.html at the repo root (this file lives in docs/).
# Override with OE_INDEX=/path/to/index.html or OE_URL=<url>.
_ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))
URL = _os.environ.get("OE_URL") or "file://" + _os.environ.get(
    "OE_INDEX", _os.path.join(_ROOT, "index.html"))
SHOTS="/tmp/fish"
import os; os.makedirs(SHOTS, exist_ok=True)
fails=[]
def check(label, cond, detail=""):
    print(("  ok   " if cond else "  FAIL ")+label+("" if cond or not detail else "  -> "+str(detail)))
    if not cond: fails.append(label)

async def main():
    async with async_playwright() as pw:
        b=await pw.chromium.launch()
        pg=await b.new_page(viewport={"width":1280,"height":900})
        errors=[]
        pg.on("pageerror", lambda e: errors.append(str(e)))
        await pg.goto(URL); await pg.wait_for_timeout(900)

        # into the dock through the real lobby route
        await pg.evaluate("uiEnterSection('fishing'); document.querySelectorAll('main > section').forEach(s=>s.style.display='none'); document.getElementById('tab-fishing').style.display='block';")
        await pg.evaluate("FE_TEST_EVERY5=false")
        await pg.wait_for_timeout(800)
        check("fishing boots with the rebuild live", await pg.evaluate("!!feEnv && !!feStars && typeof feFightStep==='function'"))

        # --- the five skies ---
        scenes=[("dawn",5.9,"fog"),("noon",12.2,"clear"),("golden",18.4,"clear"),("night",0.4,"clear"),("storm",13.0,"storm")]
        for name,hour,weather in scenes:
            await pg.evaluate(f"feEnv.hour={hour}; feEnv.weather='{weather}'; feEnv.prev='{weather}'; feEnv.blend=1; feEnv.weatherT=300;")
            await pg.wait_for_timeout(1400)
            await pg.locator("#fshCanvas").screenshot(path=f"{SHOTS}/{name}.png")
        print("  ok   five skies captured")

        # --- liveliness: the scene must move on its own ---
        a=await pg.evaluate("document.getElementById('fshCanvas').toDataURL().length")
        s1=await pg.evaluate("(()=>{const c=document.getElementById('fshCanvas');const g=c.getContext('2d');const d=g.getImageData(0,0,400,280).data;let h=0;for(let i=0;i<d.length;i+=997)h=(h*31+d[i])|0;return h})()")
        await pg.wait_for_timeout(1300)
        s2=await pg.evaluate("(()=>{const c=document.getElementById('fshCanvas');const g=c.getContext('2d');const d=g.getImageData(0,0,400,280).data;let h=0;for(let i=0;i<d.length;i+=997)h=(h*31+d[i])|0;return h})()")
        check("the water is alive (frames differ over 1.3s)", s1!=s2)

        # --- a full fight, scripted through the real phase machine ---
        await pg.evaluate("feEnv.hour=12; feEnv.weather='clear'; feEnv.blend=1; fshStartCharge(); fsh.power=84; fshRelease();")
        await pg.wait_for_timeout(1000)
        await pg.evaluate("fsh.waitMs=40; fsh.waitTimer=0;")
        await pg.wait_for_timeout(500)
        check("bite arrives", await pg.evaluate("fsh.phase==='bite'"), await pg.evaluate("fsh.phase"))
        # press-and-hold on the water sets the hook and starts reeling
        box=await pg.locator("#fshCanvas").bounding_box()
        await pg.mouse.move(box["x"]+box["width"]*0.6, box["y"]+box["height"]*0.5)
        await pg.mouse.down()
        await pg.wait_for_timeout(350)
        check("hold sets the hook into a real fight", await pg.evaluate("fsh.phase==='reeling' && !!fsh.fight && fsh.holding===true"))
        await pg.evaluate("fsh.catch.def = FSH_CATCH[1]; fsh.fight = feFightNew(FSH_CATCH[1], feFightStats()); fsh.holding=true;")
        p0=await pg.evaluate("fsh.fight.progress")
        await pg.wait_for_timeout(1200)
        p1=await pg.evaluate("fsh.fight.progress")
        check("holding reels line in", p1>p0, f"{p0} -> {p1}")
        await pg.mouse.up()
        await pg.wait_for_timeout(300)
        check("release gives line", await pg.evaluate("fsh.holding===false"))
        await pg.locator("#fshCanvas").screenshot(path=f"{SHOTS}/fight.png")
        # force the two endings
        await pg.evaluate("fsh.fight.tension = 10**6;")
        await pg.wait_for_timeout(400)
        check("max tension snaps the line", await pg.evaluate("fsh.phase==='result' && fsh.result && fsh.result.kind==='snap'"), await pg.evaluate("fsh.phase"))
        await pg.wait_for_timeout(1400)
        await pg.evaluate("fshReset();")
        await pg.wait_for_timeout(300)                       # castGuard swallows an instant recast
        await pg.evaluate("fshStartCharge(); fsh.power=84; fshRelease();")
        await pg.wait_for_timeout(1000)
        await pg.evaluate("fsh.waitMs=40; fsh.waitTimer=0;")
        await pg.wait_for_timeout(500)
        # the every-fifth-catch test hook (FE_TEST_EVERY5) turns a landing into
        # the true-form cinematic, which parks the fight in phase "cine" since
        # batch 119 - pin the counter so THIS landing is an ordinary one
        await pg.evaluate("fshInv().testN = 0;")
        await pg.evaluate("fshHookSet(); fsh.holding=true; fsh.fight.progress = fsh.fight.need - 1;")
        await pg.wait_for_timeout(600)
        landed=await pg.evaluate("fsh.phase==='result' && fsh.result && !fsh.result.failed")
        check("winning the fight lands the catch", landed, await pg.evaluate("JSON.stringify({p:fsh.phase, r: fsh.result && fsh.result.title})"))
        if landed:
            check("result card shows the fight, not taps", await pg.evaluate("document.querySelector('#fshResult .rStats').innerText.includes('Worn out')"))
            await pg.locator("#fshResult").screenshot(path=f"{SHOTS}/result.png")

        # --- mobile: touch hold reels ---
        pg2=await b.new_page(viewport={"width":390,"height":844}, has_touch=True, is_mobile=True)
        await pg2.goto(URL); await pg2.wait_for_timeout(900)
        await pg2.evaluate("uiEnterSection('fishing'); document.querySelectorAll('main > section').forEach(s=>s.style.display='none'); document.getElementById('tab-fishing').style.display='block';")
        await pg2.wait_for_timeout(600)
        await pg2.evaluate("fshStartCharge(); fsh.power=84; fshRelease();")
        await pg2.wait_for_timeout(1000)
        await pg2.evaluate("fsh.waitMs=40; fsh.waitTimer=0;")
        # wait FOR the bite instead of racing the window (re-arm if it lapses)
        await pg2.wait_for_function("""(() => {
          if(fsh.phase==='bite') return true;
          if(fsh.phase==='waiting' && fsh.waitMs > 500){ fsh.waitMs=40; fsh.waitTimer=0; }
          return false;
        })()""", timeout=8000)
        await pg2.evaluate("""(()=>{const cv=document.getElementById('fshCanvas');
          cv.dispatchEvent(new PointerEvent('pointerdown',{pointerType:'touch',bubbles:true}));})()""")
        await pg2.wait_for_timeout(350)
        check("touch hold hooks and reels on mobile", await pg2.evaluate("fsh.phase==='reeling' && fsh.holding===true"))
        await pg2.evaluate("""(()=>{const cv=document.getElementById('fshCanvas');
          cv.dispatchEvent(new PointerEvent('pointerup',{pointerType:'touch',bubbles:true}));})()""")
        await pg2.wait_for_timeout(200)
        check("touch release gives line on mobile", await pg2.evaluate("fsh.holding===false"))

        check("zero page errors end to end", len(errors)==0, errors[:3])
        await b.close()
    print("\n" + ("ALL VISUAL/FIGHT CHECKS PASSED" if not fails else f"{len(fails)} FAILED: {fails}"))
    sys.exit(1 if fails else 0)

asyncio.run(main())
