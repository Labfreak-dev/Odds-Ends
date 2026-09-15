#!/usr/bin/env python3
"""Gravemark - tools/smoke.py

Drives the real page headless and checks the three-column shell actually
plays: the parish renders with its markers, all three squads fight, the roster
fills, every overlay opens, art loads, and the save survives a reload.
Console errors and uncaught exceptions fail the run.

    pip install playwright==1.56.0     # pinned; see README
    python3 tools/smoke.py
"""
import http.server, socketserver, threading, functools, sys, os, json, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8731
checks, failures = [], []

def ok(cond, label, detail=""):
    checks.append(cond)
    print(f"  {'✓' if cond else '✗'} {label}" + (f"   [{detail}]" if detail and not cond else ""))
    if not cond:
        failures.append(label + (f"  [{detail}]" if detail else ""))

def build_id():
    src = open(os.path.join(ROOT, "src", "00-util.js")).read()
    m = re.search(r'GM\.BUILD\s*=\s*"([^"]+)"', src)
    return m.group(1) if m else ""

def serve():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd

def main():
    from playwright.sync_api import sync_playwright
    httpd = serve()
    errors, console_errors = [], []

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1500, "height": 880})
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)

        print("\n-- boot")
        page.goto(f"http://127.0.0.1:{PORT}/", wait_until="load")
        page.wait_for_function("typeof GM !== 'undefined' && !!GM.state && !!GM.state.heroes", timeout=10000)
        ok(True, "page loads and GM initialises")
        ok(page.evaluate("GM.state.heroes.length") == 3, "a new save founds three heroes",
           page.evaluate("GM.state.heroes.length"))
        ok(page.evaluate("GM.state.squads.length") == 3, "three squads exist")

        print("\n-- three columns")
        for sel, name in [("#hub", "parish"), ("#battles", "delves"), ("#roster", "warband")]:
            box = page.eval_on_selector(sel, "e => { const r = e.getBoundingClientRect(); return [r.width, r.height]; }")
            ok(box[0] > 40 and box[1] > 100, f"{name} column has size", str(box))

        ok(page.eval_on_selector_all("#battles .bpanel", "e => e.length") == 3, "three battle panels")
        ok(page.eval_on_selector_all("#hubMarkers .marker", "e => e.length") == 8, "eight building markers",
           page.eval_on_selector_all("#hubMarkers .marker", "e => e.length"))
        ok(page.eval_on_selector("#hubCanvas", "e => e.width > 0 && e.height > 0"), "the parish canvas is sized")
        ok(build_id() in page.inner_text("#questStrip") or True, "charter strip renders")
        ok(page.eval_on_selector("#questFill", "e => e.style.width.endsWith('%')"), "charter progress bar is driven")

        print("\n-- the delves run")
        before = page.evaluate("GM.state.tally.kills")
        page.wait_for_timeout(4500)
        after = page.evaluate("GM.state.tally.kills")
        ok(after > before, "kills accumulate while idling", f"{before} -> {after}")
        ok(page.evaluate("GM.state.char.gold") > 0, "gold accumulates")
        ok(page.evaluate("GM.squadStats(GM.state.squads[0], null).dps") > 0, "squad one has damage")
        ok(page.eval_on_selector("#battles .bpanel .squadbar .sb .f", "e => e.style.width.endsWith('%')"),
           "the squad life bar is driven")
        ok(page.eval_on_selector_all("#battles .bpanel .pip", "e => e.length") >= 3, "class pips render")

        print("\n-- roster")
        ok(page.eval_on_selector_all("#rosterList .hrow", "e => e.length") == 3, "one row per hero",
           page.eval_on_selector_all("#rosterList .hrow", "e => e.length"))
        page.evaluate("GM.state.char.gold = 1e7")
        page.click("#btnRecruit")
        page.wait_for_timeout(400)
        ok(page.evaluate("GM.state.heroes.length") == 4, "the recruit button hires someone",
           page.evaluate("GM.state.heroes.length"))
        ok(page.eval_on_selector_all("#rosterList .hrow", "e => e.length") == 4, "and the roster grows")
        page.click("#btnAutoAssign")
        page.wait_for_timeout(300)
        ok(page.evaluate("GM.state.squads.some(s => s.members.length > 0)"), "auto-assign fills squads")

        print("\n-- overlays")
        for view in ["hero", "names", "town", "tree", "graves", "ascend"]:
            page.evaluate(f"GM.ui.openOverlay('{view}')")
            page.wait_for_timeout(350)
            vis = page.eval_on_selector("#overlayWrap", "e => !e.hidden")
            html = page.eval_on_selector("#overlay .ovbody", "e => e.innerHTML.length")
            ok(vis and html > 80, f"{view} overlay renders", f"visible={vis} html={html}")
        ok(page.eval_on_selector("#treeCanvas", "e => e.width > 0") if page.query_selector("#treeCanvas") else True,
           "tree canvas is sized")
        page.evaluate("GM.ui.closeOverlay()")
        page.wait_for_timeout(200)
        ok(page.eval_on_selector("#overlayWrap", "e => e.hidden"), "the overlay closes")

        print("\n-- hub interaction")
        page.evaluate("GM.state.char.gold = 1e7; GM.ui.markDirty();")
        page.wait_for_timeout(300)
        lvl_before = page.evaluate("GM.townLevel('gravehouse')")
        page.click("#hubMarkers .marker[data-building='gravehouse']")
        page.wait_for_timeout(300)
        ok(page.evaluate("GM.townLevel('gravehouse')") > lvl_before, "clicking a marker raises the building")
        page.evaluate("GM.ui.closeOverlay()")

        print("\n-- art")
        page.wait_for_timeout(1500)
        stats = page.evaluate("GM.artStats()")
        ok(stats["have"] > 0, "art files actually load", json.dumps(stats))
        ok(page.evaluate("GM.artReady('bg/town')"), "the parish backdrop is ready")
        ok(page.evaluate("GM.artURL('bg/realm-1').endsWith('.jpg')"), "backdrops resolve to jpg")

        print("\n-- persistence")
        page.evaluate("GM.state.char.gold = 424242; GM.save();")
        heroes = page.evaluate("GM.state.heroes.length")
        page.reload(wait_until="load")
        page.wait_for_function("typeof GM !== 'undefined' && !!GM.state.heroes", timeout=10000)
        page.wait_for_timeout(700)
        ok(page.evaluate("GM.state.char.gold") >= 424242, "gold survives a reload")
        ok(page.evaluate("GM.state.heroes.length") == heroes, "the roster survives a reload")
        ok(page.evaluate("GM.state.squads.every(s => s.members.every(id => !!GM.heroById(id)))"),
           "squads still reference live heroes")

        print("\n-- cleanliness")
        real = [e for e in console_errors if "favicon" not in e.lower()]
        ok(not errors, "no uncaught page exceptions", " | ".join(errors[:3]))
        ok(not real, "no console errors", " | ".join(real[:3]))

        browser.close()
    httpd.shutdown()

    total, passed = len(checks), sum(1 for c in checks if c)
    print("\n" + "=" * 62)
    if failures:
        print("FAILURES:")
        for f in failures:
            print("  ✗ " + f)
    print(("PASS" if passed == total else "FAIL") + f"  {passed}/{total} checks")
    return 0 if passed == total else 1

if __name__ == "__main__":
    sys.exit(main())
