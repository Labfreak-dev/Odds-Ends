#!/usr/bin/env python3
"""Open Iron League, found a club, fight once, reload. Desktop and phone.

    python3 iron-league/tools/smoke.py
"""
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
URL = "http://127.0.0.1:8765/iron-league/"


def run(page, label, shot_dir):
    errors = []
    page.on("pageerror", lambda err: errors.append("pageerror: " + str(err)))
    page.on("console", lambda msg: errors.append("console: " + msg.text) if msg.type == "error" else None)
    page.goto(URL, wait_until="domcontentloaded")
    page.wait_for_selector("#newClub")
    page.click("#newClub")
    page.fill("#clubName", "Smoke Yard")
    page.fill("#fighterName", "Ada Flint")
    page.click('[data-class="warrior"]')
    page.click("#randomize")
    page.wait_for_timeout(400)
    page.screenshot(path=str(shot_dir / f"{label}-creator.png"))
    page.click("#confirm")
    page.wait_for_selector("#nextMatch", timeout=30000)
    page.wait_for_function(
        """() => {
          const c = document.querySelector('canvas[data-key]');
          if (!c) return false;
          const ctx = c.getContext('2d');
          const px = ctx.getImageData(0, 0, c.width, c.height).data;
          for (let i = 0; i < px.length; i += 16) if (px[i+3] > 0 && (px[i] > 40 || px[i+1] > 30)) return true;
          return false;
        }""",
        timeout=20000,
    )
    page.screenshot(path=str(shot_dir / f"{label}-hub.png"))
    page.click("#nextMatch")
    page.wait_for_selector("#arena", timeout=30000)
    page.wait_for_function(
        """() => {
          const m = window.IL && window.IL.currentMatch;
          if (!m) return false;
          const moving = m.units.some(u => u.state === 'run' || u.state === 'attack' || u.state === 'dash' || u.state === 'cast');
          return m.time > 1.2 && (moving || m.stats.hits > 0 || m.stats.shots > 0 || m.stats.casts > 0);
        }""",
        timeout=20000,
    )
    page.wait_for_timeout(350)
    page.screenshot(path=str(shot_dir / f"{label}-fight.png"))
    page.click("#skip")
    page.wait_for_selector("#backHub", timeout=10000)
    result = page.locator("#result h2").inner_text()
    if "pit" not in result.lower() and "walk" not in result.lower():
        raise SystemExit(label + " unexpected result: " + result)
    page.click("#backHub")
    page.wait_for_selector("#nextMatch, #nextSeason", timeout=10000)
    gold = page.locator(".meta").inner_text()
    page.reload(wait_until="domcontentloaded")
    page.wait_for_selector("#continue")
    page.click("#continue")
    page.wait_for_selector("h2")
    title = page.locator(".hub-head h2").inner_text()
    if title != "Smoke Yard":
        raise SystemExit(label + " continue showed " + title)
    if errors:
        print(label, "errors:")
        for e in errors:
            print(" ", e)
        raise SystemExit(label + " console errors")
    print(label, "passed", result, gold)


def main():
    shot = Path("/tmp/il-shots")
    shot.mkdir(exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome")
        desktop = browser.new_page(viewport={"width": 1280, "height": 800})
        run(desktop, "desktop", shot)
        desktop.close()
        phone = browser.new_page(viewport={"width": 430, "height": 932}, device_scale_factor=2, is_mobile=True, has_touch=True)
        run(phone, "phone", shot)
        phone.close()
        browser.close()
    print("smoke passed")
    print("shots", shot)


if __name__ == "__main__":
    sys.exit(main() or 0)
