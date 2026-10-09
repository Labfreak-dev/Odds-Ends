"""Clip audit: open every screen, tab, pane and popup at several widths and
report text that does not fit its box: text past the content box (into a
button's arrow art), text cut off by an ancestor that clips, and text off
the screen. Run with the repo served on :8765. Exit 1 on any finding."""
import json, os, sys
from playwright.sync_api import sync_playwright

URL = os.environ.get("IL_SMOKE_URL", "http://127.0.0.1:8765/iron-league/")
SIZES = [(360, 740), (412, 915), (768, 1024), (1280, 800)]
if os.environ.get("IL_CLIP_WIDTHS"):  # e.g. IL_CLIP_WIDTHS=360,1280 for a quick pass
    SIZES = [s for s in SIZES if str(s[0]) in os.environ["IL_CLIP_WIDTHS"].split(",")]

PROBE = r"""
(scope) => {
  const out = [];
  const root = scope ? document.querySelector(scope) : document.body;
  if (!root) return out;
  const vw = innerWidth, vh = innerHeight;
  function label(el) {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    else if (el.className && typeof el.className === 'string') s += '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.');
    return s;
  }
  function textRects(el) {
    const rs = [];
    for (const n of el.childNodes) {
      if (n.nodeType !== 3 || !n.nodeValue.trim()) continue;
      const r = document.createRange(); r.selectNodeContents(n);
      for (const rr of r.getClientRects()) if (rr.width > 0 && rr.height > 0) rs.push(rr);
    }
    return rs;
  }
  function visible(el) {
    const shut = el.closest('details:not([open])');
    if (shut && !el.closest('summary')) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    let e = el;
    while (e && e !== document.body) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) return false;
      e = e.parentElement;
    }
    return true;
  }
  const els = root.querySelectorAll('button, a, .chip, .ctl, h1, h2, h3, h4, p, td, th, li, label, b, strong, em, small, span, dt, dd, summary, .tab');
  for (const el of els) {
    if (!visible(el)) continue;
    if (el.closest('canvas, svg')) continue;
    const own = [...el.childNodes].some(n => n.nodeType === 3 && n.nodeValue.trim());
    if (!own) continue;
    const text = el.textContent.trim().replace(/\s+/g, ' ').slice(0, 40);
    if (!text) continue;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const bl = parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft);
    const br = parseFloat(cs.borderRightWidth) + parseFloat(cs.paddingRight);
    const bt = parseFloat(cs.borderTopWidth);
    const bb = parseFloat(cs.borderBottomWidth);
    const box = { l: r.left + bl - 1, r: r.right - br + 1, t: r.top + bt - 1, b: r.bottom - bb + 1 };
    const trs = textRects(el).filter(t => el.contains(document.elementFromPoint(Math.min(vw - 1, Math.max(0, t.left + 1)), Math.min(vh - 1, Math.max(0, t.top + t.height / 2)))) || true);
    let why = '';
    // ellipsis or hidden overflow on the element itself
    if ((cs.overflowX !== 'visible' || cs.textOverflow === 'ellipsis') && el.scrollWidth > el.clientWidth + 1 && cs.whiteSpace.indexOf('nowrap') >= 0) why = 'cut (scroll ' + el.scrollWidth + ' > ' + el.clientWidth + ')';
    // own text past the content box (border-image arrows count as border)
    if (!why) for (const t of trs) {
      if (!el.contains(document.elementFromPoint(Math.min(vw - 1, Math.max(0, t.left + t.width / 2)), Math.min(vh - 1, Math.max(0, t.top + t.height / 2))))) continue;
      if (t.left < box.l - 1 || t.right > box.r + 1) { why = 'past box x ' + Math.round(Math.max(box.l - t.left, t.right - box.r)) + 'px'; break; }
      if (cs.borderImageSource && cs.borderImageSource !== 'none' && (t.top < box.t - 1 || t.bottom > box.b + 1)) { why = 'past box y'; break; }
      // a filled label (pill, tag, chip): text below or above its own fill
      const filled = cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent';
      if (filled && cs.overflowY === 'visible' && (t.top < r.top - 1 || t.bottom > r.bottom + 1)) { why = 'past its fill y ' + Math.round(Math.max(r.top - t.top, t.bottom - r.bottom)) + 'px'; break; }
    }
    // cut by a clipping ancestor; once inside a scroller on an axis, text
    // beyond its edge is just scrolled out of view, not clipped
    let inX = false, inY = false;
    if (!why) {
      let a = el.parentElement;
      while (a && a !== document.body) {
        const acs = getComputedStyle(a);
        const scrollsX = (acs.overflowX === 'auto' || acs.overflowX === 'scroll') && a.scrollWidth > a.clientWidth + 1;
        const scrollsY = (acs.overflowY === 'auto' || acs.overflowY === 'scroll') && a.scrollHeight > a.clientHeight + 1;
        if (acs.overflowX !== 'visible' || acs.overflowY !== 'visible') {
          const ar = a.getBoundingClientRect();
          for (const t of trs) {
            if (!scrollsX && !inX && (t.left < ar.left - 1 || t.right > ar.right + 1)) { why = 'clipped x by ' + label(a); break; }
            if (!scrollsY && !inY && (t.top < ar.top - 1 || t.bottom > ar.bottom + 1) && t.bottom > ar.top && t.top < ar.bottom) { why = 'clipped y by ' + label(a); break; }
          }
          if (why) break;
        }
        if (scrollsX) inX = true;
        if (scrollsY) inY = true;
        a = a.parentElement;
      }
    }
    // text spilling out of the button or framed card around it (it may
    // not be clipped, but it lands on whatever sits next to the box)
    if (!why && cs.position !== 'absolute' && cs.position !== 'fixed') {
      let a = el.parentElement, inScroll = false;
      while (a && a !== document.body) {
        const acs = getComputedStyle(a);
        if (acs.overflowX === 'auto' || acs.overflowX === 'scroll' || acs.overflowY === 'auto' || acs.overflowY === 'scroll') { inScroll = true; break; }
        const framed = a.tagName === 'BUTTON' || (parseFloat(acs.borderTopWidth) >= 1 && acs.borderTopStyle !== 'none' && parseFloat(acs.borderLeftWidth) >= 1 && acs.borderLeftStyle !== 'none');
        if (framed) {
          const ar = a.getBoundingClientRect();
          for (const t of trs) {
            const dx = Math.max(ar.left - t.left, t.right - ar.right), dy = Math.max(ar.top - t.top, t.bottom - ar.bottom);
            if (dx > 2) { why = 'spills x ' + Math.round(dx) + 'px out of ' + label(a); break; }
            if (dy > 2) { why = 'spills y ' + Math.round(dy) + 'px out of ' + label(a); break; }
          }
          break;
        }
        a = a.parentElement;
      }
    }
    // text squeezed into a sliver: three or more lines, each a letter or two wide
    if (!why && trs.length >= 3) {
      const fs = parseFloat(cs.fontSize) || 14;
      const avg = trs.reduce(function (n, t) { return n + t.width; }, 0) / trs.length;
      if (avg < fs * 1.8) why = 'text stacked in a ' + Math.round(avg) + 'px column (' + trs.length + ' lines)';
    }
    // a one-line button label with under 10% to spare clips on wider phone fonts (Roboto)
    // (a shrink-to-fit button grows with its label, so only a squeezed one counts)
    if (!why && (el.tagName === 'BUTTON' || el.classList.contains('btn')) && cs.whiteSpace.indexOf('nowrap') >= 0 && trs.length === 1) {
      const tw = trs[0].width, had = el.style.width, now = el.getBoundingClientRect().width;
      el.style.width = 'max-content';
      const natural = el.getBoundingClientRect().width;
      el.style.width = had;
      if (natural > now + 1 && tw * 1.1 > box.r - box.l) why = 'tight label (' + Math.round(tw) + 'px in ' + Math.round(box.r - box.l) + ')';
    }
    // text in a sideways scroller can sit off screen until it is scrolled to
    if (!why && !inX) for (const t of trs) { if (t.right > vw + 1 || t.left < -1) { why = 'off screen x'; break; } }
    if (why) out.push(label(el) + ' "' + text + '": ' + why);
  }
  // icons: each pixel icon sits inside the framed box it belongs to
  for (const ic of root.querySelectorAll('img.pixel-icon, .item-icon:not([hidden])')) {
    if (!visible(ic)) continue;
    const r = ic.getBoundingClientRect();
    let a = ic.parentElement;
    while (a && a !== document.body) {
      const acs = getComputedStyle(a);
      if (acs.overflowX === 'auto' || acs.overflowY === 'auto' || acs.overflowX === 'scroll' || acs.overflowY === 'scroll') break;
      if (parseFloat(acs.borderTopWidth) >= 1 && acs.borderTopStyle !== 'none' && parseFloat(acs.borderLeftWidth) >= 1 && acs.borderLeftStyle !== 'none') {
        const ar = a.getBoundingClientRect();
        const dx = Math.max(ar.left - r.left, r.right - ar.right), dy = Math.max(ar.top - r.top, r.bottom - ar.bottom);
        if (dx > 1 || dy > 1) out.push('icon in ' + label(a) + ': spills ' + Math.round(Math.max(dx, dy)) + 'px out of its box');
        break;
      }
      a = a.parentElement;
    }
  }
  // a pill or badge label (round ends) wrapping onto two lines
  for (const el of els) {
    if (!visible(el)) continue;
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    const rad = parseFloat(cs.borderTopLeftRadius) || 0;
    if (rad < 10 || rad < r.height / 3) continue;
    const lines = new Set(textRects(el).map(t => Math.round(t.top)));
    if (lines.size > 1) out.push(label(el) + ' "' + el.textContent.trim().slice(0, 30) + '": pill label wraps to ' + lines.size + ' lines');
  }
  return [...new Set(out)];
}
"""

def fresh(page, cls="warrior"):
    page.goto(URL, wait_until="domcontentloaded")
    page.evaluate("() => localStorage.clear()")
    page.goto(URL, wait_until="domcontentloaded")
    page.wait_for_selector("#newClub")
    page.click("#newClub")
    page.fill("#clubName", "Labfreak Company Long")
    page.fill("#fighterName", "Labfreak Prime")
    page.click('[data-class="' + cls + '"]')
    page.click("#confirm")
    page.wait_for_selector("#nextMatch", timeout=30000)

def seed(page, js):
    page.evaluate("(src) => { const raw = JSON.parse(localStorage.getItem('ironleague.v1')); (new Function('raw', src))(raw); localStorage.setItem('ironleague.v1', JSON.stringify(raw)); }", js)
    page.reload(wait_until="domcontentloaded")
    page.click("#continue")
    page.wait_for_selector("#tabbar")

RICH = """
raw.tutored = true; raw.gold = 34593; raw.renown = 4690; raw.season = 9;
raw.roster.forEach((f, i) => { f.level = 18 + i * 3; f.wins = 9; f.losses = 3; f.kos = 14; f.mvps = 2; f.pendingLevels = i < 2 ? 2 : 0; });
raw.history = [0,1,2,3,4,5].map(i => ({ mode: 'league', opponent: 'Copper Warden of the Long Name', score: '2–0', win: i % 2 === 0, mvp: 'Labfreak Prime' }));
raw.marketNews = ['Your scout found a Elementalist.', 'Cass Cinder joined Red Kettle for 222 gold.'];
raw.offers = [{ id: 'o1', fid: raw.roster[1].id, fname: raw.roster[1].name, club: 'Lowmarket Blades', gold: 1220, season: raw.season, round: raw.round }];
raw.roster[raw.roster.length - 1].injury = { weeks: 2 }; raw.roster[1].injury = { weeks: 3 };
raw.staff = [{ id: 'sx1', role: 'trainer', stars: 4, name: 'Ottoline Barrowmere-Vale' }];
raw.thunder = { season: raw.season, slot: 0, size: 2, round: 1, done: false, clubs: [{ name: raw.clubName, you: true, pts: 3, places: [1] }, { name: 'Lowmarket Blades of the Far Reach', pts: 2, places: [2], fighters: raw.roster.slice(0, 2) }, { name: 'Salt Stair', pts: 1, places: [3], fighters: raw.roster.slice(0, 2) }, { name: 'Cinder Pact', pts: 0, places: [4], fighters: raw.roster.slice(0, 2) }] };
raw.devTomes = 2; raw.academy = { season: raw.season, ids: [raw.roster[raw.roster.length - 1].id], table: [{ name: raw.clubName, you: true, w: 2, l: 1, pts: 6 }, { name: 'Lowmarket Blades of the Far Reach', w: 1, l: 2, pts: 3 }, { name: 'Salt Stair', w: 0, l: 0, pts: 0 }, { name: 'Cinder Pact', w: 0, l: 0, pts: 0 }, { name: 'North Wharf', w: 0, l: 0, pts: 0 }, { name: 'Red Kettle', w: 0, l: 0, pts: 0 }], played: null, tomesUsed: 0 };
raw.roster[0].shiny = true; raw.roster[0].grades = { hp: 'E', atk: 'G', def: 'B', spd: 'E' };
raw.auction = { fighter: Object.assign({}, raw.roster[2], { id: 'auc1', name: 'Seraphine Longname of the Copper Vale', champion: true, shiny: true, rarity: 'legendary', grades: { hp: 'E', atk: 'E', def: 'G', spd: 'G' } }), value: 900, bid: 1240, leader: 'Lowmarket Blades of the Far Reach', closes: raw.round + 2, season: raw.season };
raw.approach = { fighter: Object.assign({}, raw.roster[3] || raw.roster[1], { id: 'apr1', name: 'Brannoch the Unbending', champion: true, rarity: 'rare' }), cost: 865, round: raw.round, season: raw.season };
"""

def states(page):
    """Yield (name, scope) after driving the page into each state."""
    k = page.keyboard
    yield "hub overview", None
    k.press("2"); yield "matches league", None
    page.click("[data-pane='matches:cups']"); yield "matches cups", None
    if page.locator("#enterCup").count() and page.locator("#enterCup:not([disabled])").count():
        page.click("#enterCup"); yield "matches cups bracket", None
    page.click("[data-pane='matches:history']"); yield "matches history", None
    k.press("3"); yield "roster first team", None
    page.locator("#partyCards [data-party-gear]").first.click(); page.wait_for_selector("#partyGear"); yield "party gear drawer", None
    page.locator("#partyCards [data-party-swap]").first.click(); yield "party swap picked", None
    page.locator("#partyCards [data-party-swap]").first.click()
    page.click("[data-pane='roster:gear']"); yield "roster gear", None
    if page.locator("#armory [data-arm-equip]").count():
        page.locator("#armory [data-arm-equip]").first.click(); page.wait_for_selector("#armory .armory-pick"); yield "armory pick", None
    page.click("[data-pane='roster:relics']"); yield "roster relics", None
    page.locator("[data-relic-open]").first.click(); page.wait_for_selector("#relicSheet"); yield "relic sheet", "#relicSheet"
    page.click("#relicSheetClose"); page.wait_for_selector("#relicSheet", state="detached")
    k.press("4"); yield "club home", None
    page.locator("[data-pane='club:events']").first.click(); yield "club events week", None
    for pane in ("endless", "daily", "friend"):
        page.click("[data-filter-kind='events'][data-filter='" + pane + "']"); yield "club events " + pane, None
    k.press("4"); page.locator("[data-pane='club:staff']").first.click(); yield "club staff", None
    k.press("4"); page.locator("[data-pane='club:academy']").first.click(); yield "club academy", None
    k.press("4"); page.locator("[data-pane='club:halls']").first.click(); yield "club halls", None
    k.press("4"); page.locator("[data-pane^='club:train']").first.click(); yield "club train", None
    for pane in ("specs", "tasks", "facilities"):
        page.click("[data-filter-kind='train'][data-filter='" + pane + "']"); yield "club train " + pane, None
    k.press("5"); yield "market fighters", None
    for pane in ("rivals", "relics", "gear", "deals", "sell"):
        page.click("[data-filter-kind='market'][data-filter='" + pane + "']"); yield "market " + pane, None
    k.press("6"); yield "intel stats", None
    page.click("[data-pane='intel:rosters']"); yield "intel rosters", None
    page.click("[data-pane='intel:archive']"); yield "intel archive classes", None
    for pane in ("clubs", "champions", "relics", "systems"):
        page.click("[data-archive='" + pane + "']"); yield "intel archive " + pane, None
    page.click("[data-archive='classes']"); page.locator("[data-codex]").first.click(); page.wait_for_selector("#codexSheet"); yield "codex sheet", "#codexSheet"
    page.click("#codexClose")
    page.click("[data-pane='intel:goals']"); yield "intel goals", None
    k.press("1")
    page.click("#dockInbox"); page.wait_for_selector("#inboxSheet"); yield "events inbox", "#inboxSheet"
    page.click("#inboxClose")
    page.click("#settings"); page.wait_for_selector("#settingsSheet"); yield "settings", "#settingsSheet"
    page.click("#credits"); page.wait_for_selector("#creditsSheet"); yield "credits", "#creditsSheet"
    page.click("#creditsClose")
    page.click("#clubIdentity"); page.wait_for_selector("#identitySheet"); yield "identity", "#identitySheet"
    page.click("#identityClose")
    k.press("3"); page.locator("[data-detail]").first.click(); page.wait_for_selector("#fighterSheet"); yield "fighter sheet", "#fighterSheet"
    page.click("#sheetClose")
    k.press("1"); page.click("#dockFight"); page.wait_for_selector("#fightMenu"); yield "fight menu", "#fightMenu"
    page.click("#fightGo"); page.wait_for_selector("#versus"); yield "versus", None
    page.click("#confirmFight"); page.wait_for_selector("#arena"); page.wait_for_timeout(1200); yield "fight hud", None
    page.evaluate("() => IL.finishNow()"); page.wait_for_selector("#backHub", timeout=15000); page.wait_for_timeout(600); yield "results", "#result"
    page.click("#backHub"); page.wait_for_selector("#tabbar, #statChoices, #growthChoices", timeout=10000)
    page.evaluate("() => { const raw = JSON.parse(localStorage.getItem('ironleague.v1')); raw.roster[0].pendingLevels = 2; localStorage.setItem('ironleague.v1', JSON.stringify(raw)); }")
    page.reload(); page.click("#continue"); page.wait_for_selector("#openGrowth"); page.click("#openGrowth"); page.wait_for_selector("#statChoices"); yield "level up stat", None
    page.locator("[data-stat]").first.click(); page.wait_for_selector("#growthChoices"); yield "level up skill", None
    page.click("#backHub")
    # the new-move slot screen: level until a skill pick offers a move to learn
    page.evaluate("() => { const raw = JSON.parse(localStorage.getItem('ironleague.v1')); raw.roster[0].pendingLevels = 12; localStorage.setItem('ironleague.v1', JSON.stringify(raw)); }")
    page.reload(); page.click("#continue"); page.wait_for_selector("#openGrowth"); page.click("#openGrowth")
    for _ in range(12):
        page.wait_for_selector("#statChoices [data-stat], #growthChoices [data-pick], #growthChoices [data-slot], #tabbar")
        if page.locator("#growthChoices [data-slot]").count() or page.locator("#tabbar").count(): break
        if page.locator("#statChoices [data-stat]").count(): page.locator("[data-stat]").first.click(); continue
        learn = page.locator("#growthChoices [data-kind='learn']")
        (learn if learn.count() else page.locator("#growthChoices [data-pick]")).first.click()
    if page.locator("#growthChoices [data-slot]").count():
        yield "new move slots", None
        page.click("#backHub")
    else:
        raise SystemExit("never offered a new move to slot")
    page.wait_for_selector("#tabbar, #statChoices, #growthChoices", timeout=10000)
    # season end with the Champions Cup pending, then the ceremony
    seed(page, "raw.round = raw.fixtures.length; raw.champs = null; raw.clubs.forEach(c => { c.pts = c.you ? 99 : 0; });")
    yield "champions pending overview", None
    k.press("2"); page.click("[data-pane='matches:cups']"); yield "champions cups pane", None
    seed(page, "raw.round = raw.fixtures.length; raw.champs = { kind: 'champions', season: raw.season, champion: 'c0', slots: [], pairing: [], winners: [], round: 1 };")
    yield "season closed overview", None
    page.click("#openSeason"); page.wait_for_selector("#seasonEnd"); yield "season ceremony", None

ANDROID_FONT = """
addEventListener('DOMContentLoaded', () => {
  const st = document.createElement('style');
  st.textContent = ':root{--ui: Roboto, sans-serif !important}';
  document.head.appendChild(st);
});
"""

def main():
    findings = {}
    with sync_playwright() as p:
        b = p.chromium.launch()
        for w, h in SIZES:
            page = b.new_page(viewport={"width": w, "height": h})
            # measure with the player's Android font (Roboto), which runs wider
            # than the headless default (Inter); serif falls to DejaVu, wider still
            page.add_init_script(ANDROID_FONT)
            name, seen = "start", 0
            try:
                # the title and the club creator, before any save exists
                page.goto(URL, wait_until="domcontentloaded")
                page.evaluate("() => localStorage.clear()")
                page.goto(URL, wait_until="domcontentloaded")
                page.wait_for_selector("#newClub")
                page.evaluate("() => { const d = document.querySelector('.whats-new'); if (d) d.open = true; }")
                for name in ("title", "creator"):
                    if name == "creator": page.click("#newClub"); page.wait_for_selector("#confirm")
                    page.wait_for_timeout(250)
                    for hit in page.evaluate(PROBE, None):
                        findings.setdefault(hit, []).append(f"{w}:{name}")
                    seen += 1
                fresh(page)
                seed(page, RICH)
                for name, scope in states(page):
                    page.wait_for_timeout(250)
                    hits = page.evaluate(PROBE, scope)
                    # then again with every fold opened, so folded text is checked too
                    if page.evaluate("() => { const ds = [...document.querySelectorAll('details:not([open])')]; ds.forEach(d => d.open = true); return ds.length; }"):
                        page.wait_for_timeout(150)
                        hits = hits + page.evaluate(PROBE, scope)
                    seen += 1
                    for hit in hits:
                        findings.setdefault(hit, []).append(f"{w}:{name}")
            except Exception as e:
                findings.setdefault("DRIVER after " + name + ": " + str(e)[:400].replace("\n", " | "), []).append(str(w))
            print(f"{w}x{h}: {seen} screens checked", flush=True)
            page.close()
        b.close()
    for hit, where in sorted(findings.items()):
        print(hit, "  @", ", ".join(sorted(set(where)))[:220])
    print(len(findings), "findings")
    return 1 if findings else 0

if __name__ == "__main__":
    sys.exit(main())
