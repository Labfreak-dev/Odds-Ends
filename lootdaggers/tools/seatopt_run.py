# Measure and search a hero weapon seat (see tools/README.md). Needs a local server on :8765 at the repo root:
#   python3 lootdaggers/tools/seatopt_run.py brute {"at":0.18,"grip":0.17} 10
import asyncio,sys,json
from playwright.async_api import async_playwright
H=sys.argv[1]; CFG=json.loads(sys.argv[2])
CLIPS=['Combat_Stance','Walk_Fight_Forward','Double_Combo_Attack','Triple_Combo_Attack','Hit_Reaction','Roll_Dodge','Sword_Parry','Sword_Judgment','Heavy_Hammer_Swing','Charged_Spell_Cast','mage_soell_cast','Reaping_Swing','Charged_Ground_Slam','Side_Shot','Standard_Forward_Charge','Double_Blade_Spin','Left_Slash','Step_Back','Chest_Pound_Taunt','Victory_Cheer']
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg=await b.new_page()
        await pg.goto('http://localhost:8765/lootdaggers/'); await pg.wait_for_function('window.LD && LD.S'); await pg.wait_for_timeout(1200)
        await pg.evaluate("()=>showHub('main')"); await pg.click('[data-act=slayer]')
        await pg.wait_for_function('window.Slayer && Slayer.state'); await pg.click(f'[data-sl="hero:{H}"]')
        await pg.wait_for_function('()=>Slayer.stage&&Slayer.stage.ready()',timeout=120000)
        await pg.add_script_tag(path=__file__.replace('seatopt_run.py','seatopt.js'))
        await pg.evaluate("()=>{Slayer.stage._heroAnim=()=>{};const h=Slayer.stage.hero;h.mixer.update=(u=>(window._u=u,(dt)=>{}))(h.mixer.update.bind(h.mixer));h.mixer.update=window._u}")
        r=await pg.evaluate("(o)=>seatOpt(o)",{'cfg':CFG,'clips':CLIPS,'times':[0.2,0.45,0.7],'dirs':int(sys.argv[3]) if len(sys.argv)>3 else 300,'rolls':8,'probe':float(sys.argv[4]) if len(sys.argv)>4 else 0})
        print(json.dumps(r))
        await b.close()
asyncio.run(main())
