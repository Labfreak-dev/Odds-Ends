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

    def note_console(msg):
        if msg.type != "error":
            return
        text = msg.text or ""
        url = ""
        try:
            url = (msg.location or {}).get("url") or ""
        except Exception:
            url = ""
        errors.append("console: " + text)

    page.on("console", note_console)
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
    check_gear(page, label, shot_dir)
    check_scroll(page, label)
    if label == "desktop":
        check_fit(page)
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
          const flags = window.__ilSmokeFight || (window.__ilSmokeFight = {});
          const units = m.units || [];
          if (units.some(u => u.state === 'roll')) flags.roll = true;
          if (m.stats && m.stats.slashes > 0) flags.slash = true;
          if (m.stats && m.stats.abilities > 0) flags.ability = true;
          if (IL.fx.spawned > 0) flags.fx = true;
          return m.time > 1.2 && flags.roll && flags.slash && flags.ability && flags.fx;
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
    page.wait_for_selector("#lootReveal")
    loot = page.locator("#lootReveal").inner_text().lower()
    if "found" not in loot:
        raise SystemExit(label + " loot reveal missing a find: " + loot)
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
    check_achievements(page, label)
    check_season(page, label, shot_dir)
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
    growth = page.locator("#growth").inner_text().lower()
    if "thick skin" not in growth or "keen eye" not in growth:
        raise SystemExit("perk choices missing: " + growth[:240])
    page.screenshot(path=str(shot_dir / "level-up.png"))
    page.click("[data-boost='hp']")
    perk = page.evaluate(
        """() => {
          const f = JSON.parse(localStorage.getItem('ironleague.v1')).roster[0];
          return f.perks && f.perks[0] && f.perks[0].id;
        }"""
    )
    if perk != "hp":
        raise SystemExit("perk was not saved: " + str(perk))
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


def check_chrome(page, label):
    """9-slice assets, a standings crest, and the gold cursor."""
    report = page.evaluate(
        """async () => {
          const urls = [
            'assets/ui/panels/panel_main.png',
            'assets/ui/buttons/button_primary.png',
            'assets/ui/buttons/button_gold.png',
            'assets/ui/buttons/button_fight.png',
            'assets/ui/tabs/tab_active_glow.png',
            'assets/ui/cursors/cursor_default.png',
            'assets/ui/cursors/cursor_buy_hand.png',
            'assets/ui/cursors/cursor_buy_hand_not.png',
            'assets/ui/backgrounds/hub_backdrop_ember_dark.jpg',
            'assets/ui/backgrounds/reward_burst_radial.jpg'
          ];
          const status = {};
          for (const url of urls) {
            const res = await fetch(url);
            status[url] = res.status;
          }
          const crest = document.querySelector('.board .crest-emblem');
          if (crest && !crest.complete) {
            await new Promise((resolve) => { crest.onload = resolve; crest.onerror = resolve; });
          }
          const btn = document.querySelector('#nextMatch');
          const css = getComputedStyle(document.body).cursor || '';
          const slice = btn ? (getComputedStyle(btn).borderImageSource || '') : '';
          const smooth = crest ? (getComputedStyle(crest).imageRendering || '') : '';
          return {
            status,
            crest: crest ? crest.getAttribute('src') : '',
            width: crest ? crest.naturalWidth : 0,
            cursor: css,
            slice,
            smooth
          };
        }"""
    )
    for url, code in report["status"].items():
        if code != 200:
            raise SystemExit(label + " missing " + url + " (" + str(code) + ")")
    if "emblems_white" not in (report["crest"] or "") or report["width"] < 8:
        raise SystemExit(label + " standings crest missing: " + str(report["crest"]))
    if "cursor_default" not in report["cursor"] and "url(" not in report["cursor"]:
        raise SystemExit(label + " cursor css missing: " + report["cursor"])
    if "button_fight" not in report["slice"]:
        raise SystemExit(label + " fight button is not a 9-slice: " + report["slice"])
    if report["smooth"] == "pixelated":
        raise SystemExit(label + " crest emblem is pixelated")


def check_yard(page, label):
    """The club yard draws, the sprites move, and a click opens the sheet."""
    fetched = page.evaluate(
        """async () => {
          const png = await fetch('assets/yard/atlas.png');
          const json = await fetch('assets/yard/atlas.json');
          return { png: png.status, json: json.status };
        }"""
    )
    if fetched["png"] != 200 or fetched["json"] != 200:
        raise SystemExit(label + " yard atlas failed " + str(fetched))
    page.wait_for_selector("#clubYard")
    page.evaluate("() => { window.__yardHash = 0; window.__yardAt = 0; }")
    page.wait_for_function(
        """() => {
          const c = document.querySelector('#clubYard');
          if (!c || c.dataset.ready !== '1' || !window.IL || !IL.yardActors || !IL.yardActors.length) return false;
          const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
          let h = 2166136261;
          for (let i = 0; i < data.length; i += 64) {
            h ^= data[i] + data[i + 1] * 3 + data[i + 2] * 7;
            h = Math.imul(h, 16777619);
          }
          h >>>= 0;
          if (!window.__yardHash) {
            window.__yardHash = h;
            window.__yardAt = performance.now();
            return false;
          }
          if (performance.now() - window.__yardAt < 280) return false;
          return h !== window.__yardHash;
        }""",
        timeout=8000,
    )
    box = page.evaluate(
        """() => {
          const c = document.querySelector('#clubYard');
          const a = IL.yardActors[0];
          const r = c.getBoundingClientRect();
          return {
            x: r.left + a.x * (r.width / c.width),
            y: r.top + (a.y - 28) * (r.height / c.height)
          };
        }"""
    )
    page.mouse.click(box["x"], box["y"])
    page.wait_for_selector("#fighterSheet", timeout=8000)
    page.click("#sheetClose")
    page.wait_for_selector("#fighterSheet", state="detached")


def check_nav(page, label, shot_dir):
    """Tab bar, keyboard, and the fighter sheet open and close."""
    check_chrome(page, label)
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
    ink = page.evaluate(
        """() => [...document.querySelectorAll('#tabbar .tab')].filter(t => t.getAttribute('aria-selected') !== 'true').map(t => getComputedStyle(t).color)"""
    )
    if any(c != "rgb(243, 217, 176)" for c in ink):
        raise SystemExit(label + " inactive tab ink " + str(ink))
    check_yard(page, label)
    page.keyboard.press("2")
    page.wait_for_selector("#fighterList")
    if page.locator("#nextMatch").count():
        raise SystemExit(label + " fighters tab still shows the match button")
    if label == "desktop":
        wide = page.evaluate(
            """() => {
              const rows = [...document.querySelectorAll('#fighterList .roster-row')];
              if (!rows.length) return 'no rows';
              for (const row of rows) {
                const w = row.getBoundingClientRect().width;
                if (w < 300) return 'narrow ' + Math.round(w);
                if (row.getBoundingClientRect().height > 80) return 'tall ' + Math.round(row.getBoundingClientRect().height);
                for (const el of row.querySelectorAll('h3, .kit-line span, .fine')) {
                  if (el.scrollWidth > el.clientWidth + 1) return 'cut ' + el.textContent.trim();
                }
              }
              return '';
            }"""
        )
        if wide:
            raise SystemExit(label + " roster tiles " + wide)
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


def check_gear(page, label, shot_dir):
    """Armory filters, equip diff, a bench drill, and a paid stall reroll."""
    page.keyboard.press("2")
    page.wait_for_selector("#armory")
    fetched = page.evaluate(
        """async () => {
          const png = await fetch('assets/icons/atlas.png');
          const json = await fetch('assets/icons/atlas.json');
          return { png: png.status, json: json.status };
        }"""
    )
    if fetched["png"] != 200 or fetched["json"] != 200:
        raise SystemExit(label + " icon atlas failed " + str(fetched))
    page.wait_for_function(
        """() => {
          if (!window.IL || !window.IL.iconsReady) return false;
          const face = document.querySelector('#armory .item-icon');
          const gold = document.querySelector('.ico-gold');
          if (!face || face.hidden || !gold || gold.hidden) return false;
          const bg = face.style.backgroundImage || '';
          const coin = gold.style.backgroundImage || '';
          if (bg.indexOf('atlas.png') < 0 || coin.indexOf('atlas.png') < 0) return false;
          const mode = getComputedStyle(face).imageRendering;
          if (mode !== 'pixelated' && mode !== 'crisp-edges') return false;
          const tile = face.closest('.glyph');
          const svg = tile && tile.querySelector('svg');
          return !svg || getComputedStyle(svg).display === 'none';
        }""",
        timeout=15000,
    )
    page.wait_for_selector("#filterSlot")
    page.wait_for_selector("#filterRarity")
    page.wait_for_selector("#sortGear")
    if page.locator("#armory [data-salvage]").count() < 1:
        raise SystemExit(label + " armory has nothing to salvage")
    if page.locator("#armory [data-arm-equip]").count() < 1:
        raise SystemExit(label + " armory has nothing to equip")
    page.select_option("#filterSlot", "weapon")
    page.wait_for_function("() => document.querySelector('#filterSlot') && document.querySelector('#filterSlot').value === 'weapon'")
    filtered = page.locator("#armory").inner_text().lower()
    if "dust gauntlets" in filtered or "old leather" in filtered:
        raise SystemExit(label + " slot filter kept armor")
    page.select_option("#filterSlot", "armor")
    page.wait_for_function(
        """() => {
          const box = document.querySelector('#armory');
          return box && box.innerText.toLowerCase().indexOf('leather') >= 0;
        }"""
    )
    page.screenshot(path=str(shot_dir / f"{label}-armory.png"))
    page.locator("[data-detail]").first.click()
    page.wait_for_function(
        """() => {
          const icon = document.querySelector('#fighterSheet .gear-slot .item-icon');
          if (!icon || icon.hidden) return false;
          const tile = icon.closest('.glyph');
          if (!tile || getComputedStyle(tile).gridColumnStart !== '1') return false;
          const svg = tile.querySelector('svg');
          return !svg || getComputedStyle(svg).display === 'none';
        }"""
    )
    page.wait_for_selector("#fighterSheet [data-preview-item]")
    page.click("#fighterSheet [data-preview-item]")
    page.wait_for_selector("#equipDiff .diff-up")
    page.wait_for_selector("#equipDiff .diff-down")
    page.screenshot(path=str(shot_dir / f"{label}-equip.png"))
    page.click("#cancelEquip")
    page.wait_for_selector("#equipDiff", state="detached")
    page.click("#sheetClose")
    page.wait_for_selector("#fighterSheet", state="detached")
    before = page.evaluate(
        """() => {
          const raw = JSON.parse(localStorage.getItem('ironleague.v1'));
          const bench = raw.roster.filter(f => (raw.lineup || []).indexOf(f.id) < 0)[0];
          return bench ? { id: bench.id, xp: bench.xp || 0, left: raw.trainsLeft } : null;
        }"""
    )
    if not before:
        raise SystemExit(label + " expected a benched fighter to train")
    page.locator("#benchList [data-train]").first.click()
    page.wait_for_selector("#achieveToast")
    toast = page.locator("#achieveToast").inner_text().lower()
    if "drill" not in toast:
        raise SystemExit(label + " training toast missing: " + toast)
    page.wait_for_function(
        """(id) => {
          const raw = JSON.parse(localStorage.getItem('ironleague.v1'));
          const f = raw.roster.filter(r => r.id === id)[0];
          return f && (f.xp || 0) >= 12 && raw.trainsLeft === 1;
        }""",
        arg=before["id"],
    )
    page.click("#market")
    page.click("[data-filter='gear']")
    page.wait_for_selector("#gearStock")
    page.wait_for_selector("#rerollGear:not([disabled])")
    uids = page.evaluate(
        """() => JSON.parse(localStorage.getItem('ironleague.v1')).gearStock.map(r => r.item.uid).join('|')"""
    )
    page.click("#rerollGear")
    page.wait_for_function(
        """(prev) => {
          const raw = JSON.parse(localStorage.getItem('ironleague.v1'));
          const now = (raw.gearStock || []).map(r => r.item.uid).join('|');
          return now && now !== prev;
        }""",
        arg=uids,
    )
    page.screenshot(path=str(shot_dir / f"{label}-stall.png"))
    page.keyboard.press("1")
    page.wait_for_selector("#nextMatch")
    page.click("#credits")
    page.wait_for_selector("#creditsSheet")
    credits = page.locator("#creditsSheet").inner_text().lower()
    for phrase in ("ricardo machado", "captainskolot", "finalbossblues", "time elements", "pizzadoggy", "additional art assets", "wenrexa"):
        if phrase not in credits:
            raise SystemExit(label + " credits missing " + phrase)
    if "beowulf" not in credits:
        raise SystemExit(label + " credits missing beowulf")
    if "dreamingoflight888" not in credits and "7t4e" not in credits:
        raise SystemExit(label + " credits missing chest artist")
    if "au_pixel" not in credits and "heroes99" not in credits:
        raise SystemExit(label + " credits missing heroes credit")
    page.screenshot(path=str(shot_dir / f"{label}-credits.png"))
    page.click("#creditsClose")
    page.wait_for_selector("#creditsSheet", state="detached")
    page.wait_for_selector("#nextMatch")


def check_scroll(page, label):
    """Train the third benched fighter without jumping back to the top."""
    saved = page.evaluate("() => localStorage.getItem('ironleague.v1')")
    size = page.viewport_size
    page.evaluate(
        """() => {
          const raw = JSON.parse(localStorage.getItem('ironleague.v1'));
          const captain = raw.roster.filter(f => f.captain)[0] || raw.roster[0];
          raw.lineup = [captain.id];
          raw.gold = Math.max(raw.gold || 0, 500);
          raw.trainsLeft = 2;
          localStorage.setItem('ironleague.v1', JSON.stringify(raw));
        }"""
    )
    page.reload(wait_until="domcontentloaded")
    page.click("#continue")
    page.keyboard.press("2")
    page.wait_for_selector("#benchList [data-train]")
    page.set_viewport_size({"width": size["width"], "height": 480})
    ready = page.evaluate(
        """() => {
          const buttons = document.querySelectorAll('#benchList [data-train]:not([disabled])');
          if (buttons.length < 3) return { ok: false, n: buttons.length };
          const btn = buttons[2];
          const height = btn.getBoundingClientRect().height || 32;
          const docTop = btn.getBoundingClientRect().top + window.scrollY;
          const sticky = document.querySelector('.hub-sticky');
          const cover = sticky ? sticky.getBoundingClientRect().height + 8 : 8;
          const tab = document.querySelector('#tabbar');
          const tabFixed = tab && getComputedStyle(tab).position === 'fixed';
          const limit = tabFixed ? tab.getBoundingClientRect().top - 4 : window.innerHeight - 4;
          const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
          let y = Math.min(max, Math.max(40, docTop - cover - 24));
          window.scrollTo(0, y);
          let rect = btn.getBoundingClientRect();
          if (rect.top < cover || rect.bottom > limit) {
            y = Math.min(max, Math.max(0, docTop - cover - 12));
            window.scrollTo(0, y);
            rect = btn.getBoundingClientRect();
          }
          return {
            ok: buttons.length >= 3 && window.scrollY >= 30 && rect.top >= cover - 1 && rect.bottom <= limit,
            n: buttons.length,
            y: window.scrollY,
            top: rect.top,
            bottom: rect.bottom,
            cover: cover,
            limit: limit,
            max: max,
            scrollHeight: document.documentElement.scrollHeight
          };
        }"""
    )
    if not ready["ok"]:
        raise SystemExit(label + " could not scroll to the third train " + str(ready))
    before = ready["y"]
    before_height = ready["scrollHeight"]
    page.evaluate(
        """() => {
          const btn = document.querySelectorAll('#benchList [data-train]:not([disabled])')[2];
          btn.click();
        }"""
    )
    page.wait_for_function(
        """() => JSON.parse(localStorage.getItem('ironleague.v1')).trainsLeft === 1"""
    )
    page.wait_for_timeout(80)
    after_state = page.evaluate(
        """() => ({ y: window.scrollY, h: document.documentElement.scrollHeight })"""
    )
    after = after_state["y"]
    if abs(after - before) > 2:
        raise SystemExit(
            label + " scroll jumped " + str(before) + " -> " + str(after)
            + " height " + str(before_height) + " -> " + str(after_state["h"])
        )
    page.set_viewport_size({"width": size["width"], "height": size["height"]})
    page.evaluate("(raw) => localStorage.setItem('ironleague.v1', raw)", saved)
    page.reload(wait_until="domcontentloaded")
    page.click("#continue")
    page.keyboard.press("1")
    page.wait_for_selector("#nextMatch")


def check_fit(page):
    """Each hub tab should sit on a 1280x800 screen without a long page scroll."""
    tabs = [
        ("#tab-club", "#nextMatch"),
        ("#tab-fighters", "#armory"),
        ("#market", "#marketCards"),
        ("#relics", ".card.relic"),
        ("#cup", "#enterCup"),
    ]
    for tab, wait in tabs:
        page.click(tab)
        page.wait_for_selector(wait)
        slack = page.evaluate("() => document.documentElement.scrollHeight - window.innerHeight")
        if slack > 48:
            raise SystemExit(tab + " scrolls by " + str(slack) + "px")
    page.click("#tab-club")
    page.wait_for_selector("#nextMatch")


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


def check_achievements(page, label):
    page.keyboard.press("1")
    page.wait_for_selector("#achievements")
    text = page.locator("#achievements").inner_text().lower()
    for word in ("first bell", "first win", "flawless", "ten kos", "cup winner", "every kit"):
        if word not in text:
            raise SystemExit(label + " achievements missing " + word)
    if page.locator("#achievements .track").count() < 15:
        raise SystemExit(label + " achievement list is short")
    if page.locator("#achievements .achieve-row.done").count() < 1:
        raise SystemExit(label + " no achievement unlocked after a match")


def check_season(page, label, shot_dir):
    page.evaluate(
        """() => {
          const raw = JSON.parse(localStorage.getItem('ironleague.v1'));
          raw.round = 5;
          raw.roster.forEach((f, i) => {
            f.season = { dealt: 40 - i, taken: 10 + i * 5, heal: i === 2 ? 18 : 1, kos: i === 0 ? 4 : 1 };
          });
          localStorage.setItem('ironleague.v1', JSON.stringify(raw));
        }"""
    )
    page.reload(wait_until="domcontentloaded")
    page.click("#continue")
    page.click("#openSeason")
    page.wait_for_selector("#seasonEnd")
    page.wait_for_selector("#awards canvas")
    page.wait_for_selector("#finalTable")
    page.wait_for_selector("#startSeason")
    text = page.locator("#seasonEnd").inner_text().lower()
    for word in ("mvp", "iron wall", "healer", "standings", "start season"):
        if word not in text:
            raise SystemExit(label + " season end missing " + word + ": " + text[:240])
    page.wait_for_function(
        """() => {
          const c = document.querySelector('#awards canvas');
          if (!c) return false;
          const px = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
          for (let i = 0; i < px.length; i += 16) if (px[i + 3] > 0 && (px[i] > 40 || px[i + 1] > 30)) return true;
          return false;
        }""",
        timeout=20000,
    )
    page.screenshot(path=str(shot_dir / f"{label}-season.png"))
    before = page.evaluate("() => JSON.parse(localStorage.getItem('ironleague.v1'))")
    names = [f["name"] for f in before["roster"]]
    page.click("#startSeason")
    page.wait_for_selector("#nextMatch")
    after = page.evaluate("() => JSON.parse(localStorage.getItem('ironleague.v1'))")
    if after["season"] != before["season"] + 1 or after["round"] != 0:
        raise SystemExit(label + " next season did not reset the board")
    if [f["name"] for f in after["roster"]] != names:
        raise SystemExit(label + " next season dropped the roster")
    if after["gold"] < before["gold"]:
        raise SystemExit(label + " next season spent gold")
    level = page.evaluate(
        """() => {
          const raw = JSON.parse(localStorage.getItem('ironleague.v1'));
          const foe = raw.clubs.filter(c => !c.you)[0];
          return foe && foe.fighters && foe.fighters[0].level;
        }"""
    )
    if level < 2:
        raise SystemExit(label + " rivals did not scale: " + str(level))


def check_phone_fight(browser, width, height, shot_dir, dismiss):
    """A phone fight stays on one screen, then Back to club leaves the results."""
    label = str(width) + "x" + str(height)
    page = browser.new_page(viewport={"width": width, "height": height}, device_scale_factor=2, is_mobile=True, has_touch=True)
    page.goto(URL, wait_until="domcontentloaded")
    page.evaluate("() => localStorage.clear()")
    page.reload(wait_until="domcontentloaded")
    page.click("#newClub")
    page.fill("#clubName", "Labfreak Company")
    page.fill("#fighterName", "Ada Flint")
    page.click('[data-class="warrior"]')
    page.click("#confirm")
    page.wait_for_selector("#nextMatch", timeout=30000)
    page.click("#nextMatch")
    page.click("#confirmFight")
    page.wait_for_selector("#arena", timeout=30000)
    page.wait_for_timeout(400)
    fit = page.evaluate(
        """() => {
          const de = document.documentElement;
          const view = (id) => {
            const el = document.getElementById(id);
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return { top: r.top, left: r.left, right: r.right, bottom: r.bottom, w: r.width, h: r.height };
          };
          const span = document.querySelector('#leftName .club-name');
          const bar = document.querySelector('.bar');
          const sr = span.getBoundingClientRect();
          const br = bar.getBoundingClientRect();
          const arena = document.getElementById('arena').getBoundingClientRect();
          return {
            scrollX: de.scrollWidth - window.innerWidth,
            scrollY: de.scrollHeight - window.innerHeight,
            buttons: ['speed1', 'speed2', 'speed3', 'pause', 'skip'].map(view),
            nameInside: sr.left >= br.left - 1 && sr.right <= br.right + 1 && sr.bottom <= br.bottom + 1,
            clipped: span.scrollWidth - span.clientWidth > 1,
            fullName: span.textContent,
            arenaW: arena.width,
            innerW: window.innerWidth
          };
        }"""
    )
    if fit["scrollX"] > 1 or fit["scrollY"] > 1:
        raise SystemExit(label + " fight page scrolls " + str(fit["scrollX"]) + " " + str(fit["scrollY"]))
    if not fit["nameInside"] or fit["clipped"] or fit["fullName"] != "Labfreak Company":
        raise SystemExit(label + " club name leaves the header " + str(fit))
    if fit["arenaW"] < fit["innerW"] - 32:
        raise SystemExit(label + " pit is narrower than the screen " + str(fit["arenaW"]))
    for box in fit["buttons"]:
        if not box or box["w"] < 8 or box["h"] < 8:
            raise SystemExit(label + " speed control missing " + str(fit["buttons"]))
        if box["top"] < -1 or box["left"] < -1 or box["bottom"] > height + 1 or box["right"] > width + 1:
            raise SystemExit(label + " speed control off screen " + str(box))
    page.screenshot(path=str(shot_dir / ("fight-" + label + ".png")))
    page.click("#speed3")
    page.wait_for_selector("#resultTable", timeout=60000)
    page.wait_for_function("() => document.querySelector('#speed3') && document.querySelector('#speed3').classList.contains('on')")
    overlay = page.evaluate(
        """() => {
          const table = document.querySelector('#resultTable').getBoundingClientRect();
          const box = document.querySelector('#result');
          const before = getComputedStyle(box, '::before');
          const anim = (before.animationName || '') + ' ' + (before.content || '');
          const spinning = /spin|burst/i.test(anim) && before.content !== 'none';
          const btn = document.querySelector('#backHub').getBoundingClientRect();
          const panel = box.getBoundingClientRect();
          let overlap = false;
          document.querySelectorAll('#result, #result *').forEach((el) => {
            const cs = getComputedStyle(el);
            const name = cs.animationName || '';
            if (!/spin|burst/i.test(name)) return;
            const r = el.getBoundingClientRect();
            const hit = r.width > 2 && r.height > 2 && !(r.right < table.left || r.left > table.right || r.bottom < table.top || r.top > table.bottom);
            if (hit) overlap = true;
          });
          return {
            spinning: spinning,
            overlap: overlap,
            label: (document.querySelector('#backHub') || {}).textContent || '',
            btnTop: btn.top,
            btnBottom: btn.bottom,
            btnH: btn.height,
            panelBottom: panel.bottom,
            panelRight: panel.right,
            innerH: window.innerHeight,
            innerW: window.innerWidth
          };
        }"""
    )
    if overlay["spinning"] or overlay["overlap"]:
        raise SystemExit(label + " spinning box covers the results " + str(overlay))
    if "back to club" not in overlay["label"].lower():
        raise SystemExit(label + " results missing Back to club: " + overlay["label"])
    if overlay["btnTop"] < 0 or overlay["btnBottom"] > overlay["innerH"] + 1 or overlay["btnH"] < 40:
        raise SystemExit(label + " Back to club is off screen " + str(overlay))
    if overlay["panelBottom"] > overlay["innerH"] + 1 or overlay["panelRight"] > overlay["innerW"] + 1:
        raise SystemExit(label + " results overlay leaves the screen " + str(overlay))
    page.screenshot(path=str(shot_dir / ("results-" + label + ".png")))
    if width == 360:
        page.set_viewport_size({"width": 360, "height": 640})
        short = page.evaluate(
            """() => {
              const btn = document.querySelector('#backHub').getBoundingClientRect();
              const panel = document.querySelector('#result').getBoundingClientRect();
              return {
                btnBottom: btn.bottom,
                btnH: btn.height,
                panelBottom: panel.bottom,
                panelRight: panel.right,
                h: window.innerHeight,
                w: window.innerWidth,
                scrollY: document.documentElement.scrollHeight - window.innerHeight
              };
            }"""
        )
        if short["scrollY"] > 1 or short["btnBottom"] > short["h"] + 1 or short["btnH"] < 40 or short["panelBottom"] > short["h"] + 1 or short["panelRight"] > short["w"] + 1:
            raise SystemExit(label + " results do not fit 360x640 " + str(short))
    if dismiss == "enter":
        page.keyboard.press("Enter")
    elif dismiss == "escape":
        page.keyboard.press("Escape")
    else:
        page.click("#backHub")
    page.wait_for_selector("#nextMatch, #tabbar", timeout=10000)
    if page.locator("#result").count():
        raise SystemExit(label + " results stayed open")
    title = page.locator(".hub-head h2").inner_text()
    if "Labfreak" not in title:
        raise SystemExit(label + " hub lost the club name: " + title)
    page.close()


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
        check_phone_fight(browser, 360, 740, shot, "click")
        check_phone_fight(browser, 412, 915, shot, "escape")
        browser.close()
    print("smoke passed")
    print("shots", shot)


if __name__ == "__main__":
    sys.exit(main() or 0)
