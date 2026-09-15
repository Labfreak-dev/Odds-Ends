import http.server, socketserver, threading, functools, sys, os
ROOT=os.path.abspath(sys.argv[1]); OUT=sys.argv[2]; PORT=8765
handler=functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
socketserver.TCPServer.allow_reuse_address=True
httpd=socketserver.TCPServer(("127.0.0.1",PORT),handler); threading.Thread(target=httpd.serve_forever,daemon=True).start()
from playwright.sync_api import sync_playwright
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1500,"height":880})
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(f"http://127.0.0.1:{PORT}/", wait_until="load")
    pg.wait_for_function("typeof GM!=='undefined' && !!GM.state && !!GM.state.heroes", timeout=10000)
    pg.wait_for_timeout(2500)
    print("weapon parts ready:", pg.evaluate("['dagger','sword','maul','wand','scythe'].map(w=>GM.artReady('parts/weapon/'+w))"))
    # freeze every hero mid-swing on a different weapon
    pg.evaluate("""() => {
      const fams=['sword','maul','scythe','dagger','wand'];
      const ps=Object.values(GM.ui._panels()); let i=0;
      for (const p of ps) for (const id in (p.actors||{})) { const a=p.actors[id]; a.weaponFam=fams[i++%5]; a.anim.play('attack_'+a.weaponFam); a.anim.update(0.42); a.anim.update=function(){}; }
    }""")
    pg.wait_for_timeout(200)
    pg.locator("#battles").screenshot(path=OUT)
    print("errors:", errs)
    b.close()
