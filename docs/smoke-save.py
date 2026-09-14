"""Headless proof of Backup & Restore (Settings): the backup text round-trips a
save through the paste box and the real Restore button (batch 134)."""
import sys, pathlib, json
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
    errs = []; dialogs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("dialog", lambda d: (dialogs.append(d.message), d.accept()))
    pg.goto(URL); pg.wait_for_timeout(2400)
    pg.evaluate("()=>localStorage.clear()"); pg.reload(); pg.wait_for_timeout(2200)
    # a save worth keeping
    pg.evaluate("()=>{ state.dollars=123456; state.credits=777; state.scrap=42; state.owned[5]=3; state.owned[999]=1; state.player.level=7; state.settings.musicVol=0.33; saveState(); }")
    text = pg.evaluate("()=>buildBackup()")
    check("the backup is JSON that carries the save", (lambda d: isinstance(d, dict) and ("main" in d or "credits" in d))(json.loads(text)))
    check("the backup remembers the pocket and the binder", '"dollars":123456' in text.replace(" ", "") and '"999":1' in text.replace(" ", ""))
    # wipe, then restore through the real panel
    pg.evaluate("()=>{ state.dollars=0; state.credits=0; state.scrap=0; state.owned={}; state.player.level=1; saveState(); renderAll(); }")
    check("the wipe took", pg.evaluate("()=>state.dollars===0 && Object.keys(state.owned).length===0"))
    pg.evaluate("()=>{ uiEnterSection('account'); document.querySelectorAll('main > section').forEach(s=>s.style.display='none'); document.getElementById('tab-account').style.display='block'; }"); pg.wait_for_timeout(300)
    check("the Backup & Restore panel is on the Settings tab", pg.locator("#savePasteBox").count()==1 and pg.locator("#saveFileInput").count()==1)
    pg.evaluate("(t)=>{ const b=document.getElementById('savePasteBox'); b.closest('details').open=true; b.value=t; }", text)
    pg.evaluate("()=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Restore Pasted Backup')).click()"); pg.wait_for_timeout(600)
    check("restoring asks before replacing progress", any("Replace ALL" in d for d in dialogs), dialogs)
    got = pg.evaluate("()=>({d:state.dollars, c:state.credits, s:state.scrap, o5:state.owned[5], o999:state.owned[999], lvl:state.player.level, mv:state.settings.musicVol, msg:document.getElementById('saveIoResult').textContent})")
    # the pocket drifts up by mining income between reads - allow a little
    check("the pocket, binder, level and settings come back", 123456 <= got["d"] < 123456+2000 and got["c"]==777 and got["s"]==42 and got["o5"]==3 and got["o999"]==1 and got["lvl"]==7 and abs(got["mv"]-0.33)<1e-9, got)
    check("the panel says Restored.", got["msg"]=="Restored.", got["msg"])
    # survives a reload
    pg.reload(); pg.wait_for_timeout(2200)
    check("the restored save survives a reload", pg.evaluate("()=>state.dollars>=123456 && state.dollars<125456 && state.owned[999]===1"))
    # garbage is refused without touching the save
    pg.evaluate("()=>{ uiEnterSection('account'); document.querySelectorAll('main > section').forEach(s=>s.style.display='none'); document.getElementById('tab-account').style.display='block'; }"); pg.wait_for_timeout(300)
    n0 = len(dialogs)
    pg.evaluate("()=>{ const b=document.getElementById('savePasteBox'); b.closest('details').open=true; b.value='not a backup'; }")
    pg.evaluate("()=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Restore Pasted Backup')).click()"); pg.wait_for_timeout(300)
    check("garbage is refused with a message and no prompt", len(dialogs)==n0 and "isn't a backup" in pg.evaluate("()=>document.getElementById('saveIoResult').textContent") and 123456 <= pg.evaluate("()=>state.dollars") < 125456)
    check("zero page errors", not errs, errs[:3])
    br.close()
print()
if fail == 0: print("SAVE: all %d checks passed." % ok)
else: print("SAVE: %d FAILED, %d passed." % (fail, ok))
sys.exit(1 if fail else 0)
