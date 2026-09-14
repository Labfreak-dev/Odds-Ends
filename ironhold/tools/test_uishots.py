import asyncio,sys
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        for W in (420,1100):
            pg=await b.new_page(viewport={'width':W,'height':900},device_scale_factor=1)
            errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.goto('http://localhost:8899/dbg6/index.html'); await pg.wait_for_function('window.__ihBoot===true'); await pg.wait_for_timeout(600)
            await pg.evaluate('''()=>{const D=window.__D;D.redeem('IRON-LABFREAKGODMODE.L99.Y1.T9-OM229W');D.S.auto=false;D.renderAll();}''')
            for tab in ['hero','vault','skills','world','keep']:
                await pg.evaluate('(t)=>{window.__D.showTab(t);window.__D.renderAll();window.scrollTo(0,0)}',tab); await pg.wait_for_timeout(300)
                await pg.screenshot(path=f'/tmp/claude-0/-home-user-Odds-Ends/6256ba04-1a25-565f-b31b-2b72a8b325ad/scratchpad/ui_{W}_{tab}.png',full_page=(W==420))
            print(W,'errs',errs[:2]); await pg.close()
        await b.close()
asyncio.run(main())
