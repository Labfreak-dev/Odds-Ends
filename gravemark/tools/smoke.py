#!/usr/bin/env python3
"""Gravemark - tools/smoke.py

Drives the real page headless and checks it actually plays: every tab renders,
the fight loop makes progress, gear and tree respond to clicks, and the save
survives a reload. Console errors and uncaught exceptions fail the run.

    pip install playwright==1.56.0     # pinned; see the repo CLAUDE.md
    python3 tools/smoke.py
"""
import http.server, socketserver, threading, functools, sys, os, time, json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8731

checks, failures = [], []

def ok(cond, label, detail=""):
    checks.append(cond)
    mark = "✓" if cond else "✗"
    print(f"  {mark} {label}" + (f"   [{detail}]" if detail and not cond else ""))
    if not cond:
        failures.append(label + (f"  [{detail}]" if detail else ""))

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
        page = browser.new_page(viewport={"width": 1200, "height": 900})
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)

        print("\n-- boot")
        page.goto(f"http://127.0.0.1:{PORT}/", wait_until="load")
        page.wait_for_function("typeof GM !== 'undefined' && !!GM.state && !!GM.state.char", timeout=10000)
        ok(True, "page loads and GM initialises")

        stamp = page.inner_text("#buildStamp")
        ok(GM_BUILD in stamp, "build stamp is rendered", stamp)

        ok(page.eval_on_selector_all("#tabs .tab", "els => els.length") == 8, "eight tabs present")

        print("\n-- the fight loop runs")
        before = page.evaluate("GM.state.tally.kills")
        page.wait_for_timeout(4000)
        after = page.evaluate("GM.state.tally.kills")
        ok(after > before, "kills accumulate while idling", f"{before} -> {after}")
        ok(page.evaluate("GM.state.char.gold") > 0, "gold accumulates")
        ok(page.evaluate("isFinite(GM.stats({}).dps) && GM.stats({}).dps > 0"), "dps is finite and positive")

        mon = page.inner_text("#monName")
        ok(mon and mon != "—", "a monster is on the stage", mon)
        w = page.eval_on_selector("#monBar", "e => e.style.width")
        ok(w.endswith("%"), "the monster health bar is driven", w)

        print("\n-- every tab renders")
        for view in ["gear", "bench", "tree", "town", "graves", "modes", "ascend", "delve"]:
            page.click(f'#tabs .tab[data-view="{view}"]')
            page.wait_for_timeout(220)
            vis = page.eval_on_selector(f"#view-{view}", "e => !e.hidden")
            html = page.eval_on_selector(f"#view-{view}", "e => e.innerHTML.length")
            ok(vis and html > 80, f"{view} renders", f"visible={vis} html={html}")

        print("\n-- gear")
        page.click('#tabs .tab[data-view="gear"]')
        page.wait_for_timeout(300)
        slots = page.eval_on_selector_all("#equipSlots .slot", "e => e.length")
        ok(slots == 10, "ten equipment slots", str(slots))
        equipped = page.evaluate("GM.SLOT_IDS.filter(s => GM.state.equip[s]).length")
        ok(equipped > 0, "auto-equip has filled some slots", f"{equipped}/10")

        # tooltip
        cell = page.query_selector("#equipSlots .slot[data-item]")
        if cell:
            cell.hover()
            page.wait_for_timeout(250)
            ok(page.eval_on_selector("#tip", "e => e.classList.contains('on')"), "item tooltip opens")
            ok(page.eval_on_selector("#tip", "e => e.innerText.length") > 10, "and has content")
        else:
            ok(False, "an equipped item cell exists to hover")

        print("\n-- tree")
        page.click('#tabs .tab[data-view="tree"]')
        page.wait_for_timeout(300)
        ok(page.eval_on_selector("#treeCanvas", "e => e.width > 0 && e.height > 0"), "tree canvas is sized")
        page.evaluate("GM.state.tree.points = 5")
        spent_before = page.evaluate("GM.state.tree.spent.length")
        # allocate the first legal node through the real API path
        page.evaluate("""() => {
            const n = GM.TREE_NODES.find(n => GM.canAllocate(n.id).ok);
            if (n) GM.allocate(n.id);
        }""")
        spent_after = page.evaluate("GM.state.tree.spent.length")
        ok(spent_after == spent_before + 1, "a tree node allocates", f"{spent_before} -> {spent_after}")

        print("\n-- town and modes")
        page.click('#tabs .tab[data-view="town"]')
        page.wait_for_timeout(250)
        ok(page.eval_on_selector_all("#townGrid .card", "e => e.length") == 8, "eight buildings listed")
        page.evaluate("GM.state.char.gold = 1e7")
        page.evaluate("GM.buyBuilding('gravehouse')")
        ok(page.evaluate("GM.townLevel('gravehouse')") > 0, "a building can be raised")

        page.click('#tabs .tab[data-view="modes"]')
        page.wait_for_timeout(250)
        ok(page.eval_on_selector_all("#modeGrid .card", "e => e.length") >= 5, "modes listed")

        print("\n-- gravemarks")
        page.evaluate("GM.plantGrave(GM.state.depth.current, {name:'Smoke Test'})")
        page.click('#tabs .tab[data-view="graves"]')
        page.wait_for_timeout(250)
        ok(page.eval_on_selector_all("#graveList .grave", "e => e.length") >= 1, "a gravemark renders")
        ok(page.eval_on_selector("#graveBadge", "e => !e.hidden"), "the graves tab badges")

        print("\n-- persistence")
        page.evaluate("GM.state.char.gold = 424242; GM.save();")
        depth = page.evaluate("GM.state.depth.maxEver")
        page.reload(wait_until="load")
        page.wait_for_function("typeof GM !== 'undefined' && !!GM.state.char", timeout=10000)
        page.wait_for_timeout(600)
        gold = page.evaluate("GM.state.char.gold")
        ok(gold >= 424242, "gold survives a reload", str(gold))
        ok(page.evaluate("GM.state.depth.maxEver") >= depth, "depth survives a reload")

        print("\n-- cleanliness")
        real_errors = [e for e in console_errors if "favicon" not in e.lower()]
        ok(not errors, "no uncaught page exceptions", " | ".join(errors[:3]))
        ok(not real_errors, "no console errors", " | ".join(real_errors[:3]))

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

GM_BUILD = "b001"
if __name__ == "__main__":
    sys.exit(main())
