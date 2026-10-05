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
    check_nav(page, label, shot_dir)
    check_settings(page, label)
    page.click("#nextMatch")
    page.wait_for_selector("#versus")
    page.wait_for_selector("#powerBar")
    page.wait_for_selector("#confirmFight")
    page.wait_for_selector("#versusBack")
    if page.locator("#versus canvas").count() < 2:
        raise SystemExit(label + " versus card is missing lineups")
    page.wait_for_function(
        """() => {
          const c = document.querySelector('#versus canvas');
          if (!c) return false;
          const px = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
          for (let i = 0; i < px.length; i += 16) if (px[i + 3] > 0 && (px[i] > 40 || px[i + 1] > 30)) return true;
          return false;
        }""",
        timeout=20000,
    )
    versus = page.locator("#versus").inner_text()
    if "HP" not in versus or "Power" not in versus:
        raise SystemExit(label + " versus card missing health or power")
    page.screenshot(path=str(shot_dir / f"{label}-versus.png"))
    page.click("#versusBack")
    page.wait_for_selector("#nextMatch")
    page.click("#nextMatch")
    page.click("#confirmFight")
    page.wait_for_selector("#arena", timeout=30000)
    page.wait_for_function(
        """() => {
          const IL = window.IL;
          const m = IL && IL.currentMatch;
          if (!m || !IL.fx || !IL.fx.ready()) return false;
          const rolling = m.units.some(u => u.state === 'roll');
          const combat = m.stats.slashes > 0 && rolling && IL.fx.spawned > 0 && m.stats.abilities > 0;
          return m.time > 1.2 && combat;
        }""",
        timeout=35000,
    )
    page.wait_for_timeout(200)
    page.screenshot(path=str(shot_dir / f"{label}-fight.png"))
    caught = {"slash": False, "cast": False, "shot": False, "roll": False}
    for _ in range(80):
        snap = page.evaluate(
            """() => {
              const m = window.IL.currentMatch;
              if (!m) return null;
              return {
                over: m.over,
                slash: m.stats.slashes > 0,
                cast: m.units.some(u => !!u.cast),
                shot: m.shots.length > 0,
                roll: m.units.some(u => u.state === 'roll'),
                rolls: m.stats.rolls,
                slashes: m.stats.slashes,
                abilities: m.stats.abilities,
                spawned: window.IL.fx.spawned
              };
            }"""
        )
        if not snap:
            break
        if snap["slash"] and not caught["slash"]:
            page.screenshot(path=str(shot_dir / f"{label}-slash.png"))
            caught["slash"] = True
        if snap["cast"] and not caught["cast"]:
            page.screenshot(path=str(shot_dir / f"{label}-cast.png"))
            caught["cast"] = True
        if snap["shot"] and not caught["shot"]:
            page.screenshot(path=str(shot_dir / f"{label}-shot.png"))
            caught["shot"] = True
        if snap["roll"] and not caught["roll"]:
            page.screenshot(path=str(shot_dir / f"{label}-roll.png"))
            caught["roll"] = True
        if snap.get("abilities") and not caught.get("ability"):
            page.screenshot(path=str(shot_dir / f"{label}-ability.png"))
            caught["ability"] = True
        if snap["over"] or (caught["roll"] and caught["slash"] and caught.get("ability")):
            break
        page.wait_for_timeout(120)
    if not caught["roll"]:
        raise SystemExit(label + " fight never showed a roll")
    if not caught["slash"]:
        raise SystemExit(label + " fight never showed a slash")
    if label == "desktop" and not caught.get("ability"):
        raise SystemExit(label + " fight never fired an ability")
    page.click("#speed3")
    page.wait_for_function("() => document.querySelector('#speed3') && document.querySelector('#speed3').classList.contains('on')")
    saved_speed = page.evaluate("() => JSON.parse(localStorage.getItem('ironleague.v1')).settings.speed")
    if saved_speed != 3:
        raise SystemExit(label + " speed was not saved: " + str(saved_speed))
    page.click("#pause")
    page.wait_for_function("() => (document.querySelector('#pause') || {}).textContent === 'Resume'")
    page.click("#pause")
    page.click("#skip")
    page.wait_for_selector("#backHub", timeout=10000)
    page.wait_for_selector("#resultTable")
    result_text = page.locator("#result").inner_text().lower()
    for word in ("mvp", "dealt", "taken", "heal"):
        if word not in result_text:
            raise SystemExit(label + " results missing " + word)
    result = page.locator("#result h2").inner_text()
    if "pit" not in result.lower() and "walk" not in result.lower():
        raise SystemExit(label + " unexpected result: " + result)
    page.click("#backHub")
    page.wait_for_selector("#nextMatch, #nextSeason", timeout=10000)
    history = page.locator("#history").inner_text()
    if "MVP" not in history:
        raise SystemExit(label + " history missing a result: " + history)
    gold = page.locator(".purse").inner_text()
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
    if label == "desktop":
        tour(page, shot_dir)


def tour(page, shot_dir):
    """Market, growth pick, relics, and cup bracket on the club just founded."""
    page.evaluate(
        """() => {
          const raw = JSON.parse(localStorage.getItem("ironleague.v1"));
          const f = raw.roster[0];
          f.xp = 80;
          f.level = 3;
          f.pendingPicks = 1;
          raw.relics = ["band", "edge", "plate"];
          raw.equipped = ["band"];
          localStorage.setItem("ironleague.v1", JSON.stringify(raw));
        }"""
    )
    page.reload(wait_until="domcontentloaded")
    page.click("#continue")
    page.wait_for_selector("#openGrowth")
    page.click("#openGrowth")
    page.wait_for_selector("#growth")
    page.screenshot(path=str(shot_dir / "level-up.png"))
    page.click("[data-boost='hp']")
    page.wait_for_selector("#market")
    page.click("#market")
    page.wait_for_selector("#marketCards .hire")
    page.wait_for_function(
        """() => {
          const c = document.querySelector("#marketCards canvas");
          if (!c) return false;
          const px = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
          for (let i = 0; i < px.length; i += 16) if (px[i + 3] > 0 && (px[i] > 40 || px[i + 1] > 30)) return true;
          return false;
        }""",
        timeout=20000,
    )
    page.screenshot(path=str(shot_dir / "market.png"))
    page.click("#relics")
    page.wait_for_selector("[data-equip='band']")
    page.screenshot(path=str(shot_dir / "relics.png"))
    page.click("#cup")
    page.click("#enterCup")
    page.wait_for_selector(".bracket")
    page.wait_for_selector("#bracketBoard")
    bracket = page.locator("#bracketBoard").inner_text().lower()
    if "smoke yard" not in bracket or "semi" not in bracket:
        raise SystemExit("bracket missing the club or semis: " + bracket)
    page.screenshot(path=str(shot_dir / "cup.png"))
    check_empty_bench(page)
    print("tour screenshots", shot_dir)


def check_nav(page, label, shot_dir):
    """Tab bar, keyboard, and the fighter sheet open and close."""
    page.wait_for_selector("#tabbar")
    tabs = page.locator("#tabbar [role='tab']")
    if tabs.count() != 5:
        raise SystemExit(label + " tab bar has " + str(tabs.count()))
    joined = " ".join(tabs.all_inner_texts()).lower()
    for word in ("club", "fighter", "market", "cup", "relic"):
        if word not in joined:
            raise SystemExit(label + " tab missing " + word + " in " + joined)
    selected = page.locator("#tabbar [role='tab'][aria-selected='true']").inner_text().lower()
    if "club" not in selected:
        raise SystemExit(label + " club tab was not active: " + selected)
    bar = page.evaluate(
        """() => {
          const el = document.querySelector('#tabbar');
          const r = el.getBoundingClientRect();
          return {
            position: getComputedStyle(el).position,
            bottom: r.bottom,
            inner: window.innerHeight
          };
        }"""
    )
    if label == "phone":
        if bar["position"] != "fixed" or abs(bar["bottom"] - bar["inner"]) > 3:
            raise SystemExit(label + " tab bar not pinned " + str(bar))
    elif bar["position"] == "fixed":
        raise SystemExit(label + " tab bar should sit in the page on a wide screen")
    page.keyboard.press("2")
    page.wait_for_selector("#fighterList")
    if page.locator("#nextMatch").count():
        raise SystemExit(label + " fighters tab still shows the match button")
    page.locator("[data-detail]").first.click()
    page.wait_for_selector("#fighterSheet")
    page.wait_for_function(
        """() => {
          const c = document.querySelector('#detailPreview');
          if (!c) return false;
          const px = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
          for (let i = 0; i < px.length; i += 16) if (px[i + 3] > 0 && (px[i] > 40 || px[i + 1] > 30)) return true;
          return false;
        }""",
        timeout=20000,
    )
    sheet = page.locator("#fighterSheet").inner_text()
    for word in ("XP", "HP", "ATK", "DEF", "SPD", "Abilities", "Always on", "Rename", "Captain stays", "Record"):
        if word not in sheet:
            raise SystemExit(label + " sheet missing " + word + ": " + sheet[:240])
    if page.locator("#releaseAsk").count():
        raise SystemExit(label + " captain sheet offered release")
    page.screenshot(path=str(shot_dir / f"{label}-sheet.png"))
    page.click("#sheetClose")
    page.wait_for_selector("#fighterSheet", state="detached")
    page.keyboard.press("Escape")
    page.keyboard.press("1")
    page.wait_for_selector("#nextMatch")
    if page.locator("#fighterSheet").count():
        raise SystemExit(label + " sheet stayed open")


def check_settings(page, label):
    page.click("#settings")
    page.wait_for_selector("#settingsSheet")
    text = page.locator("#settingsSheet").inner_text().lower()
    for word in ("sound", "music", "fight speed", "screen shake", "reset save"):
        if word not in text:
            raise SystemExit(label + " settings missing " + word)
    page.click("#speedPick3")
    page.wait_for_selector("#speedPick3.on")
    page.click("#shakeToggle")
    page.click("#resetAsk")
    page.wait_for_selector("#resetBox")
    page.click("#resetNo")
    page.click("#speedPick1")
    page.click("#settingsClose")
    page.wait_for_selector("#settingsSheet", state="detached")
    flags = page.evaluate(
        """() => {
          const s = JSON.parse(localStorage.getItem('ironleague.v1')).settings;
          return { speed: s.speed, shake: s.shake };
        }"""
    )
    if flags["speed"] != 1 or flags["shake"] is not False:
        raise SystemExit(label + " settings did not stick " + str(flags))
    page.click("#settings")
    page.click("#shakeToggle")
    page.click("#settingsClose")


def check_empty_bench(page):
    page.evaluate(
        """() => {
          const raw = JSON.parse(localStorage.getItem('ironleague.v1'));
          const ids = raw.lineup || [];
          raw.roster = raw.roster.filter(f => ids.indexOf(f.id) >= 0);
          raw.round = 5;
          localStorage.setItem('ironleague.v1', JSON.stringify(raw));
        }"""
    )
    page.reload(wait_until="domcontentloaded")
    page.click("#continue")
    page.keyboard.press("2")
    page.wait_for_selector("#benchList .empty-state")
    text = page.locator("#benchList .empty-state").inner_text().lower()
    if "bench" not in text or "empty" not in text:
        raise SystemExit("empty bench copy: " + text)


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
