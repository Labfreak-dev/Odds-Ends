#!/usr/bin/env python3
"""Iron League visual QA harness.

Usage:
  python3 /workspace/il_qa/qa.py                       # live site, all viewports
  python3 /workspace/il_qa/qa.py --url http://127.0.0.1:8000/iron-league/
  python3 /workspace/il_qa/qa.py --url /path/to/checkout/iron-league   # serves the dir locally
  python3 /workspace/il_qa/qa.py --viewports 360x740 --serial --out /tmp/qa

Per viewport it starts a new club, captures title/creator, each hub tab (keys 1-7),
market stalls, training panes, the fighter sheet, settings, credits, the versus screen, a mid-fight frame at max
speed, the results overlay and the screen after exiting, running DOM checks on each.
Writes <out>/<viewport>/<screen>.png, <out>/contact_<viewport>.png, <out>/report.md
and <out>/report.json. Exit code: 0 all pass, 1 any FAIL, 2 harness crash.
"""
import argparse, json, os, re, socket, sys, threading, time, traceback
import functools, http.server, socketserver
from concurrent.futures import ProcessPoolExecutor, as_completed

DEFAULT_URL = "https://labfreak-dev.github.io/Odds-Ends/iron-league/"
DEFAULT_VIEWPORTS = ["360x800", "412x915", "1280x800"]
EXIT_RE = re.compile(r"club|continue|back", re.I)

# --------------------------------------------------------------------------- JS
CHECKS_JS = r"""
(opts) => {
  const out = {};
  const de = document.documentElement;
  const W = window.innerWidth, H = window.innerHeight;
  const TOL = 1, CAP = opts.cap || 30;

  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1) return false;
    if (el.checkVisibility && !el.checkVisibility({checkOpacity: true, checkVisibilityCSS: true})) return false;
    return true;
  };
  const sel = (el) => {
    const parts = [];
    let e = el;
    for (let i = 0; e && e.nodeType === 1 && i < 4; i++, e = e.parentElement) {
      let s = e.tagName.toLowerCase();
      if (e.id) { parts.unshift(s + '#' + e.id); break; }
      const cls = (typeof e.className === 'string' ? e.className : '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
      if (cls.length) s += '.' + cls.join('.');
      else if (e.parentElement) {
        const sib = [...e.parentElement.children].filter(c => c.tagName === e.tagName);
        if (sib.length > 1) s += ':nth-of-type(' + (sib.indexOf(e) + 1) + ')';
      }
      parts.unshift(s);
    }
    return parts.join(' > ');
  };
  const snip = (el) => {
    let t = '';
    for (const n of el.childNodes) if (n.nodeType === 3) t += n.textContent;
    t = t.trim() || (el.innerText || '').trim() || el.getAttribute('aria-label') || el.getAttribute('alt') || '';
    t = t.replace(/\s+/g, ' ');
    return t.length > 40 ? t.slice(0, 40) + '…' : t;
  };
  const textRect = (el) => {
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity, any = false;
    for (const n of el.childNodes) {
      if (n.nodeType !== 3 || !n.textContent.trim()) continue;
      const rg = document.createRange(); rg.selectNodeContents(n);
      for (const q of rg.getClientRects()) {
        if (q.width < 0.5 || q.height < 0.5) continue;
        any = true; l = Math.min(l, q.left); t = Math.min(t, q.top); r = Math.max(r, q.right); b = Math.max(b, q.bottom);
      }
    }
    return any ? {left: l, top: t, right: r, bottom: b} : null;
  };
  const isFramed = (cs) => {
    if (cs.borderImageSource && cs.borderImageSource !== 'none') return true;
    for (const s of ['Top', 'Right', 'Bottom', 'Left']) {
      const st = cs['border' + s + 'Style'];
      if (st !== 'none' && st !== 'hidden' && parseFloat(cs['border' + s + 'Width']) > 0) return true;
    }
    return false;
  };
  const padBox = (el, cs) => {
    const r = el.getBoundingClientRect();
    return {left: r.left + parseFloat(cs.borderLeftWidth), top: r.top + parseFloat(cs.borderTopWidth),
            right: r.right - parseFloat(cs.borderRightWidth), bottom: r.bottom - parseFloat(cs.borderBottomWidth)};
  };
  const over = (r, p) => {
    const d = {left: p.left - r.left, right: r.right - p.right, top: p.top - r.top, bottom: r.bottom - p.bottom};
    let side = null, px = 0;
    for (const k in d) if (d[k] > px) { px = d[k]; side = k; }
    return {px, side, d};
  };
  const isScroller = (cs) => /(auto|scroll)/.test(cs.overflowX + ' ' + cs.overflowY);
  const clips = (cs) => /(hidden|clip)/.test(cs.overflowX + ' ' + cs.overflowY);

  // 1. horizontal page overflow
  out.hOverflow = {scrollWidth: de.scrollWidth, clientWidth: de.clientWidth, fail: de.scrollWidth > de.clientWidth};
  // 2. vertical page scroll + speed controls (evaluated everywhere, judged on fight screens)
  out.vScroll = {scrollHeight: de.scrollHeight, innerHeight: H, fail: de.scrollHeight > H + 2};
  const speedEls = [...document.querySelectorAll('button')].filter(b => visible(b) &&
      (/^speed\d$/.test(b.id) || /^\s*\d\s*[×x]\s*$/i.test(b.innerText || '')) && !b.closest('[role=dialog]'));
  out.speed = speedEls.map(b => {
    const r = b.getBoundingClientRect();
    return {id: b.id, text: (b.innerText || '').trim(), rect: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)],
            inView: r.left >= -1 && r.top >= -1 && r.right <= W + 1 && r.bottom <= H + 1};
  });

  // 3. element/text overflow vs framed ancestor padding box; text clipping
  // If a modal dialog (sheet) is open, judge only its contents, not the page behind it.
  const modals = [...document.querySelectorAll('[role=dialog][aria-modal=true], dialog[open]')].filter(visible);
  const scope = modals.length ? modals[modals.length - 1] : document.body;
  out.scope = modals.length ? sel(scope) : 'page';
  const all = [...scope.querySelectorAll('*')];
  const csCache = new Map();
  const CS = (e) => { let c = csCache.get(e); if (!c) { c = getComputedStyle(e); csCache.set(e, c); } return c; };
  const boxIssues = [], clipIssues = [];
  for (const el of all) {
    const tag = el.tagName;
    if (/^(SCRIPT|STYLE|TEMPLATE|NOSCRIPT|HTML|BODY|OPTION|BR)$/.test(tag)) continue;
    const isCtl = /^(BUTTON|IMG|INPUT|SELECT|TEXTAREA)$/.test(tag);
    let rect = null;
    if (isCtl) { if (!visible(el)) continue; rect = el.getBoundingClientRect(); }
    else {
      let hasText = false;
      for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) { hasText = true; break; }
      if (!hasText || !visible(el)) continue;
      rect = textRect(el); if (!rect) continue;
    }
    const ecs = CS(el);
    if (ecs.position === 'fixed') continue;
    let worst = null, clipHit = null;
    for (let a = el.parentElement; a && a !== document.body && a !== de; a = a.parentElement) {
      const cs = CS(a);
      if (isScroller(cs) && (a.scrollHeight > a.clientHeight + 1 || a.scrollWidth > a.clientWidth + 1)) break; // scrolled content is reachable
      if (isFramed(cs)) {
        const o = over(rect, padBox(a, cs));
        if (o.px > TOL && (!worst || o.px > worst.px)) worst = {px: o.px, side: o.side, anc: a};
      }
      if (!clipHit && clips(cs)) {
        const o = over(rect, padBox(a, cs));
        if (o.px > TOL) clipHit = {px: o.px, side: o.side, anc: a};
      }
      if (cs.position === 'fixed') break;
    }
    if (worst) boxIssues.push({sel: sel(el), text: snip(el), px: Math.round(worst.px * 10) / 10, side: worst.side, frame: sel(worst.anc)});
    // own ellipsis / clipping of text
    if (!isCtl && clips(ecs) && (el.scrollWidth > el.clientWidth + TOL) && el.clientWidth > 0) {
      clipIssues.push({sel: sel(el), text: snip(el), px: el.scrollWidth - el.clientWidth, side: 'right', by: 'self' + (ecs.textOverflow === 'ellipsis' ? ' (ellipsis)' : '')});
    } else if (clipHit) {
      clipIssues.push({sel: sel(el), text: snip(el), px: Math.round(clipHit.px * 10) / 10, side: clipHit.side, by: sel(clipHit.anc)});
    }
  }
  // group repeats (e.g. every row of a table column) into one line with a count
  const group = (arr) => {
    const m = new Map();
    for (const i of arr) {
      const k = i.sel.replace(/:nth-of-type\(\d+\)/g, '') + '|' + i.side + '|' + Math.round(i.px);
      const g = m.get(k); if (g) g.n++; else m.set(k, Object.assign({n: 1}, i));
    }
    return [...m.values()].sort((a, b) => b.px - a.px);
  };
  const gb = group(boxIssues), gc = group(clipIssues);
  out.boxOverflow = {count: boxIssues.length, groups: gb.length, items: gb.slice(0, CAP)};
  out.textClip = {count: clipIssues.length, groups: gc.length, items: gc.slice(0, CAP)};

  // 4. rotation over a table
  const tables = [...document.querySelectorAll('table,[role=table],[role=grid]')].filter(visible);
  const rotated = new Map();
  const angleOf = (t) => {
    if (!t || t === 'none') return 0;
    const m = t.match(/matrix\(([^)]+)\)/);
    if (m) { const v = m[1].split(',').map(parseFloat); return Math.atan2(v[1], v[0]) * 180 / Math.PI; }
    const m3 = t.match(/matrix3d\(([^)]+)\)/);
    if (m3) { const v = m3[1].split(',').map(parseFloat); return Math.atan2(v[1], v[0]) * 180 / Math.PI; }
    return 0;
  };
  if (tables.length) {
    for (const an of document.getAnimations()) {
      if (an.playState !== 'running' || !an.effect || !an.effect.target) continue;
      let kf = [];
      try { kf = an.effect.getKeyframes(); } catch (e) {}
      const rot = kf.some(k => (k.transform && /rotate|matrix/i.test(k.transform) && !/^none$/.test(k.transform)) || (k.rotate && k.rotate !== 'none'));
      if (rot) rotated.set(an.effect.target, {anim: true, why: 'running animation ' + (an.animationName || an.id || '') + (an.effect.pseudoElement ? ' on ' + an.effect.pseudoElement : '')});
    }
    for (const el of all) {
      if (rotated.has(el)) continue;
      const cs = CS(el);
      let a = angleOf(cs.transform);
      if (Math.abs(a) < 0.5 && cs.rotate && cs.rotate !== 'none') a = parseFloat(cs.rotate) || 0;
      if (Math.abs(a) >= 0.5) { rotated.set(el, {why: 'transform rotate ' + a.toFixed(1) + 'deg'}); continue; }
      for (const ps of ['::before', '::after']) {
        const pcs = getComputedStyle(el, ps);
        if (pcs.content === 'none' || pcs.content === 'normal') continue;
        const pa = angleOf(pcs.transform);
        if (Math.abs(pa) >= 0.5) { rotated.set(el, {why: 'transform rotate ' + pa.toFixed(1) + 'deg on ' + ps}); break; }
      }
    }
  }
  const rotIssues = [];
  for (const [el, info] of rotated) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    for (const t of tables) {
      if (!info.anim && t.contains(el)) continue;  // static rotated glyphs inside cells are part of the table
      const q = t.getBoundingClientRect();
      const ix = Math.min(r.right, q.right) - Math.max(r.left, q.left), iy = Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top);
      if (ix > 2 && iy > 2) { rotIssues.push({sel: sel(el), text: snip(el), why: info.why, table: sel(t), overlap: Math.round(ix) + 'x' + Math.round(iy)}); break; }
    }
  }
  out.rotateTable = {count: rotIssues.length, items: rotIssues.slice(0, CAP)};

  // 5. visible exit (judged on results screen): a hit-testable button in the viewport
  const exits = [...document.querySelectorAll('button,a,[role=button]')].filter(b => /club|continue|back/i.test((b.innerText || b.getAttribute('aria-label') || '').trim()) && !b.disabled);
  const res = [...document.querySelectorAll('#result,.result')].find(visible);
  out.resultInfo = res ? {cls: res.className, buttons: [...res.querySelectorAll('button')].map(b => (b.innerText || '').trim())} : null;
  out.exit = exits.map(b => {
    const r = b.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const inView = r.width > 1 && r.height > 1 && cx >= 0 && cy >= 0 && cx <= W && cy <= H;
    const hit = inView ? document.elementFromPoint(cx, cy) : null;
    let clipBy = null;
    for (let a = b.parentElement; a && a !== document.body; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (/(hidden|clip|auto|scroll)/.test(cs.overflowX + cs.overflowY)) {
        const o = over(r, padBox(a, cs));
        if (o.px > TOL) { clipBy = sel(a) + ' (overflow ' + cs.overflowY + ', button ' + Math.round(o.px) + 'px past its ' + o.side + ' edge' + (/(auto|scroll)/.test(cs.overflowY) ? ', box scrollHeight ' + a.scrollHeight + ' vs clientHeight ' + a.clientHeight : '') + ')'; break; }
      }
    }
    return {sel: sel(b), text: (b.innerText || '').trim().slice(0, 30), rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
            visible: visible(b), inView, hittable: !!hit && (hit === b || b.contains(hit)), topEl: hit ? sel(hit) : null, clipBy};
  });
  return out;
}
"""

RESULTS_JS = r"""
() => {
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1 && (!e.checkVisibility || e.checkVisibility({checkVisibilityCSS: true})); };
  const res = [...document.querySelectorAll('#result,.result,[class*=result-overlay],[id*=results]')].find(vis);
  if (res && /victory|defeat|draw|win|lose|lost/i.test(res.innerText || '')) return true;
  const sk = document.querySelector('#skip');
  return !!(sk && sk.disabled && [...document.querySelectorAll('button')].some(b => vis(b) && /continue/i.test(b.innerText || '')));
}
"""

HUB_JS = r"""() => [...document.querySelectorAll('[role=tab]')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1; }).length >= 3"""

# ------------------------------------------------------------------- local serve
def maybe_serve(url):
    """If url is a local path, serve it over http and return (http_url, server)."""
    if re.match(r"^(https?|file)://", url):
        if url.startswith("file://"):
            url = url[7:]
        else:
            return url, None
    path = os.path.abspath(url)
    if os.path.isdir(path):
        root, page = path, ""
    elif os.path.isfile(path):
        root, page = os.path.dirname(path), os.path.basename(path)
    else:
        raise SystemExit(f"--url {url!r}: not a URL and not an existing path")
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a, **k):
            pass
    handler = functools.partial(Quiet, directory=root)
    srv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), handler)
    srv.daemon_threads = True
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return f"http://127.0.0.1:{srv.server_address[1]}/{page}", srv

# ------------------------------------------------------------------- per viewport
class Run:
    def __init__(self, vp, url, out, deadline, cap, max_fights=3):
        self.vp, self.url, self.out, self.deadline, self.cap = vp, url, out, deadline, cap
        self.max_fights = max_fights
        self.w, self.h = map(int, vp.split("x"))
        self.dir = os.path.join(out, vp)
        os.makedirs(self.dir, exist_ok=True)
        self.screens = []          # ordered list of dicts
        self.errors = []           # console/page errors {screen, kind, text}
        self.current = "load"
        self.log = []

    def note(self, msg):
        self.log.append(f"[{self.vp}] {msg}")
        print(f"[{self.vp}] {msg}", flush=True)

    def left(self):
        return self.deadline - time.time()

    # -- screen capture + checks
    def capture(self, page, name, kind="hub", full_page=False, extra=None):
        self.current = name
        scr = {"name": name, "kind": kind, "checks": {}, "png": None, "notes": []}
        self.screens.append(scr)
        try:
            data = page.evaluate(CHECKS_JS, {"cap": self.cap})
        except Exception as e:
            scr["checks"]["harness"] = ("FAIL", [f"checks JS failed: {e}"])
            data = None
        if data:
            self.judge(scr, data, kind)
        if extra:
            for k, v in extra.items():
                scr["checks"][k] = v
        png = os.path.join(self.dir, f"{name}.png")
        try:
            page.screenshot(path=png, full_page=full_page, timeout=15000)
            scr["png"] = png
        except Exception as e:
            try:
                page.screenshot(path=png, full_page=False, timeout=10000)
                scr["png"] = png
            except Exception as e2:
                scr["checks"]["harness"] = ("FAIL", [f"screenshot failed: {e2}"])
        self.note(f"captured {name}: " + ", ".join(f"{k}={v[0]}" for k, v in scr["checks"].items()))
        return scr

    def judge(self, scr, d, kind):
        c = scr["checks"]
        ho = d["hOverflow"]
        c["h-overflow"] = ("FAIL" if ho["fail"] else "PASS",
                           [f"scrollWidth {ho['scrollWidth']} > clientWidth {ho['clientWidth']} (+{ho['scrollWidth'] - ho['clientWidth']}px)"] if ho["fail"] else [])
        if kind in ("fight", "results"):
            vs = d["vScroll"]
            c["v-scroll"] = ("FAIL" if vs["fail"] else "PASS",
                             [f"scrollHeight {vs['scrollHeight']} > innerHeight {vs['innerHeight']}+2 (+{vs['scrollHeight'] - vs['innerHeight']}px)"] if vs["fail"] else [])
        if kind == "fight":
            sp = d["speed"]
            if not sp:
                c["speed-in-view"] = ("FAIL", ["no speed controls found"])
            else:
                bad = [s for s in sp if not s["inView"]]
                c["speed-in-view"] = ("FAIL" if bad else "PASS",
                                      [f"{s['text'] or s['id']} at rect {s['rect']} outside viewport {self.w}x{self.h}" for s in bad])
        bo = d["boxOverflow"]
        c["box-overflow"] = ("FAIL" if bo["count"] else "PASS",
                             ([f"{bo['count']} element(s) in {bo['groups']} group(s) overflow a framed parent (scope: {d.get('scope')})"] if bo["count"] else []) +
                             [f"`{i['sel']}` \"{i['text']}\"{' ×' + str(i['n']) if i['n'] > 1 else ''} overflows {i['side']} by {i['px']}px (frame `{i['frame']}`)" for i in bo["items"]])
        tc = d["textClip"]
        c["text-clip"] = ("FAIL" if tc["count"] else "PASS",
                          ([f"{tc['count']} element(s) in {tc['groups']} group(s) truncated/clipped (scope: {d.get('scope')})"] if tc["count"] else []) +
                          [f"`{i['sel']}` \"{i['text']}\"{' ×' + str(i['n']) if i['n'] > 1 else ''} clipped {i['side']} by {i['px']}px (by {i['by']})" for i in tc["items"]])
        rt = d["rotateTable"]
        c["rotate-over-table"] = ("FAIL" if rt["count"] else "PASS",
                                  [f"`{i['sel']}` ({i['why']}) overlaps table `{i['table']}` {i['overlap']}px" for i in rt["items"]])
        if kind == "results":
            ex = d["exit"]
            ok = [e for e in ex if e["hittable"]]
            if ok:
                c["results-exit"] = ("PASS", [f"visible exit: \"{ok[0]['text']}\""])
            else:
                det = ["no hit-testable 'club/continue/back' button inside the viewport"]
                for e in ex[:5]:
                    det.append(f"candidate `{e['sel']}` \"{e['text']}\" rect {e['rect']} inView={e['inView']} covered by `{e['topEl']}`" + (f"; clipped by `{e['clipBy']}`" if e.get('clipBy') else ""))
                ri = d.get("resultInfo")
                if ri:
                    det.append(f"results overlay `.{ri['cls'].replace(' ', '.')}` buttons: {ri['buttons']}")
                c["results-exit"] = ("FAIL", det)
        scr["raw"] = {k: d.get(k) for k in ("hOverflow", "vScroll", "speed", "scope", "resultInfo")}
        if kind == "results" and d.get("resultInfo"):
            cls = d["resultInfo"]["cls"]
            scr["outcome"] = "victory" if "victory" in cls else ("defeat" if "defeat" in cls else cls)

    def step_fail(self, name, kind, msg):
        self.current = name
        self.screens.append({"name": name, "kind": kind, "png": None, "notes": [],
                             "checks": {"harness": ("FAIL", [msg])}})
        self.note(f"STEP FAILED {name}: {msg}")

    # -- helpers
    def click_first(self, page, candidates, timeout=4000):
        for c in candidates:
            try:
                loc = c(page) if callable(c) else page.locator(c)
                loc = loc.first
                if loc.count() and loc.is_visible():
                    loc.click(timeout=timeout)
                    return True
            except Exception:
                continue
        return False

    def close_overlay(self, page):
        try:
            done = page.evaluate("""() => { const b = [...document.querySelectorAll('[role=dialog] button[aria-label=Close], .close-x, [id$=Close]')]
                .find(e => { const r = e.getBoundingClientRect(); return r.width > 1 && e.checkVisibility && e.checkVisibility(); });
                if (b) { b.click(); return true; } return false; }""")
        except Exception:
            done = False
        if not done:
            page.keyboard.press("Escape")
        page.wait_for_timeout(450)

    def go_tab(self, page, key, tabid):
        page.keyboard.press(key)
        page.wait_for_timeout(500)
        try:
            sel = page.evaluate(f"() => {{ const t = document.querySelector('[data-tab={tabid}]'); return t ? t.getAttribute('aria-selected') : null; }}")
            if sel == "false":
                page.click(f"[data-tab={tabid}]", timeout=3000)
                page.wait_for_timeout(500)
        except Exception:
            pass
        page.evaluate("() => window.scrollTo(0, 0)")

    # -- flow
    def run(self, pw):
        browser = None
        launch_err = None
        for kwargs in (
            {"args": ["--disable-dev-shm-usage"]},
            {"channel": "chrome", "args": ["--disable-dev-shm-usage"]},
        ):
            try:
                browser = pw.chromium.launch(**kwargs)
                break
            except Exception as e:
                launch_err = e
        if browser is None:
            raise launch_err
        is_mobile = self.w < 800
        ctx = browser.new_context(viewport={"width": self.w, "height": self.h},
                                  device_scale_factor=1, is_mobile=is_mobile, has_touch=is_mobile)
        page = ctx.new_page()
        page.set_default_timeout(6000)
        def add(kind, text):
            self.errors.append({"screen": self.current, "seq": len(self.screens), "kind": kind, "text": text[:400]})
        page.on("console", lambda m: m.type == "error" and add("console", m.text + (f" [{m.location.get('url', '')}]" if m.location and m.location.get('url') else "")))
        page.on("pageerror", lambda e: add("pageerror", str(e)))
        page.on("requestfailed", lambda r: add("requestfailed", f"{r.url} ({r.failure})") if not r.url.startswith("data:") else None)
        try:
            self.flow(page)
        finally:
            try:
                browser.close()
            except Exception:
                pass

    def flow(self, page):
        try:
            page.goto(self.url, wait_until="networkidle", timeout=30000)
        except Exception:
            try:
                page.goto(self.url, wait_until="load", timeout=20000)
            except Exception as e:
                self.step_fail("title", "hub", f"could not load {self.url}: {e}")
                return
        page.wait_for_timeout(800)
        self.capture(page, "00_title", full_page=True)

        # new club
        if not self.click_first(page, ["#newClub", lambda p: p.get_by_text("New club", exact=False)]):
            self.step_fail("01_creator", "hub", "'New club' not found"); return
        page.wait_for_timeout(800)
        self.capture(page, "01_creator", full_page=True)
        if not self.click_first(page, ["#confirm", lambda p: p.get_by_role("button", name="Found the club")]):
            self.step_fail("02_hub_club", "hub", "'Found the club' not found"); return
        try:
            page.wait_for_function(HUB_JS, timeout=8000)
        except Exception:
            self.step_fail("02_hub_club", "hub", "hub tabs did not appear after founding the club"); return
        page.wait_for_timeout(700)

        for i, (key, tab) in enumerate([
            ("1", "club"), ("2", "fighters"), ("3", "market"), ("4", "cup"),
            ("5", "relics"), ("6", "events"), ("7", "train"),
        ]):
            name = f"{2 + i:02d}_hub_{tab}"
            try:
                self.go_tab(page, key, tab)
                self.capture(page, name, full_page=True)
                extra = []
                if tab == "market":
                    extra = [("gear", "gear"), ("fighters", "fighters"), ("relics", "relics"), ("deals", "deals"), ("sell", "sell")]
                elif tab == "train":
                    extra = [("drills", "drills"), ("specs", "specs"), ("tasks", "tasks"), ("facilities", "facilities")]
                elif tab == "events":
                    extra = [("endless", "endless"), ("daily", "daily"), ("friend", "friend")]
                for filt, label in extra:
                    sel = f"[data-filter-kind={tab}][data-filter={filt}]"
                    if not self.click_first(page, [sel]):
                        self.step_fail(f"{name}_{label}", "hub", f"missing {sel}")
                        continue
                    page.wait_for_timeout(400)
                    self.capture(page, f"{name}_{label}", full_page=True)
            except Exception as e:
                self.step_fail(name, "hub", f"tab {tab}: {e}")

        # fighter sheet
        try:
            self.go_tab(page, "1", "club")
            if not self.click_first(page, ["[data-detail]"]):
                self.go_tab(page, "2", "fighters")
                if not self.click_first(page, ["[data-detail]"]):
                    raise RuntimeError("no [data-detail] element")
            page.wait_for_timeout(700)
            self.capture(page, "07_fighter_sheet", kind="sheet")
            self.close_overlay(page)
        except Exception as e:
            self.step_fail("07_fighter_sheet", "sheet", str(e))

        for name, cands in [("08_settings", ["#settings", "[aria-label=Settings]"]),
                            ("09_credits", ["#credits", lambda p: p.get_by_role("button", name="Credits")])]:
            try:
                if not self.click_first(page, cands):
                    raise RuntimeError("button not found")
                page.wait_for_timeout(600)
                self.capture(page, name, kind="sheet")
                self.close_overlay(page)
            except Exception as e:
                self.step_fail(name, "sheet", str(e))
                self.close_overlay(page)

        # fights: the first one gets mid-fight/results/after-exit; extra fights (only while no
        # victory has been seen, budget permitting) capture results + after-exit, because the
        # victory overlay differs (starburst, overflow:hidden) from the defeat overlay.
        for idx in range(1, self.max_fights + 1):
            need = 40 if idx == 1 else 55
            if self.left() < need:
                if idx == 1:
                    self.step_fail("11_fight_mid", "fight", f"skipped: time budget exhausted ({self.left():.0f}s left)")
                else:
                    self.note(f"skipping extra fight {idx}: {self.left():.0f}s left")
                return
            outcome = self.fight(page, idx)
            if outcome in (None, "victory", "stuck"):
                return

    def fight(self, page, idx):
        sfx = "" if idx == 1 else f"_f{idx}"
        base = 10 if idx == 1 else 10 + 4 * (idx - 1)
        self.go_tab(page, "1", "club")
        if not self.click_first(page, ["#nextMatch", lambda p: p.get_by_role("button", name="Send them in")]):
            self.step_fail(f"{base:02d}_versus{sfx}", "hub", "'Send them in' not found"); return None
        page.wait_for_timeout(1000)
        if page.locator("#confirmFight").count() and page.locator("#confirmFight").is_visible():
            if idx == 1:
                page.evaluate("() => window.scrollTo(0, 0)")
                self.capture(page, f"{base:02d}_versus", full_page=True)
            self.click_first(page, ["#confirmFight", lambda p: p.get_by_role("button", name="Fight", exact=True)])
        try:
            page.wait_for_selector("#speed1, #speed15, .fight-controls", state="attached", timeout=8000)
        except Exception:
            pass
        page.wait_for_timeout(600)
        # max speed without scrolling the page (JS click keeps the viewport where the game put it)
        spd = page.evaluate("""() => { const bs = [...document.querySelectorAll('button')].filter(b => /^speed\\d$/.test(b.id) || /^\\s*\\d\\s*[×x]\\s*$/i.test(b.innerText||''))
              .filter(b => !b.closest('[role=dialog]') && b.getBoundingClientRect().width > 0);
              if (!bs.length) return null;
              const n = b => parseInt((b.id.match(/\\d/)||(b.innerText||'').match(/\\d/)||['0'])[0]);
              bs.sort((a, b) => n(b) - n(a)); bs[0].click(); return (bs[0].innerText||bs[0].id).trim(); }""")
        t_start = time.time()
        if idx == 1:
            page.wait_for_timeout(2500)
            mid = self.capture(page, f"{base + 1:02d}_fight_mid", kind="fight")
            mid["notes"].append(f"speed set to {spd}" if spd else "no speed control found to click")
            fit = page.evaluate("""() => {
              const c = document.getElementById('arena');
              const boxes = (window.IL && IL.pitBoxes) || [];
              if (!c || !boxes.length) return { ok: false, why: 'no fighter boxes', bad: [] };
              const w = c.clientWidth, h = c.clientHeight;
              const tol = 3;
              const bad = [];
              for (const b of boxes) {
                if (b.l < -tol || b.t < -tol || b.r > w + tol || b.b > h + tol)
                  bad.push((b.name || '?') + ' ' + [b.l, b.t, b.r, b.b].map(n => Math.round(n)).join(','));
              }
              return { ok: bad.length === 0, why: bad.slice(0, 6).join('; '), w, h, n: boxes.length, bad };
            }""")
            if not fit or not fit.get("ok"):
                why = (fit or {}).get("why") or "fighter boxes missing"
                mid["checks"]["fighters"] = ("FAIL", [why])
                self.note(f"fighters outside the pit: {why}")
            else:
                mid["checks"]["fighters"] = ("PASS", [])
                self.note(f"fighters inside the pit ({fit['n']})")
            floor = page.evaluate("""() => {
              const de = document.documentElement;
              const floor = (window.IL && IL.pitFloor) || null;
              const bodies = (window.IL && IL.pitBodies) || [];
              const scroll = de.scrollHeight > window.innerHeight + 2 || de.scrollWidth > window.innerWidth + 1;
              if (!floor || !bodies.length) return { ok: false, why: 'no floor' };
              const canvas = document.getElementById('arena');
              const cr = canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0, right: 0, bottom: 0 };
              const l = cr.left + floor.l, t = cr.top + floor.t, r = cr.left + floor.r, b = cr.top + floor.b;
              const inside = l >= -1 && t >= -1 && r <= window.innerWidth + 1 && b <= window.innerHeight + 1;
              let h = 0;
              for (const box of bodies) h += (box.b - box.t);
              h /= bodies.length;
              const shortSide = Math.min(floor.w, floor.h);
              const ratio = h / shortSide;
              const spread = (window.IL && IL.pitSpawn) || 0;
              const overlap = (window.IL && IL.pitOverlap) || { worst: 0 };
              const scale = (window.IL && IL.pitScale) || 0;
              return {
                ok: true, ratio, shortSide, h, spread, scale,
                worst: overlap.worst || 0,
                inside, scroll,
                portrait: !!(window.IL && IL.pitCam && IL.pitCam.portrait),
                fw: floor.w, fh: floor.h
              };
            }""")
            notes = []
            fails = []
            if not floor or not floor.get("ok"):
                fails.append((floor or {}).get("why") or "floor missing")
            else:
                ratio = floor.get("ratio") or 0
                notes.append(
                    f"fighter {floor.get('h'):.1f}px / short side {floor.get('shortSide'):.0f}px = 1/{(1/ratio) if ratio else 0:.1f}"
                    f" scale {floor.get('scale')} {'portrait' if floor.get('portrait') else 'landscape'}"
                    f" floor {floor.get('fw'):.0f}x{floor.get('fh'):.0f}"
                )
                if not (1/16 - 0.004 <= ratio <= 1/12 + 0.004):
                    fails.append(f"fighter/floor ratio {ratio:.4f} outside 1/16–1/12")
                if not floor.get("inside") or floor.get("scroll"):
                    fails.append("floor is outside the viewport or the page scrolls")
                if (floor.get("spread") or 0) < 0.7:
                    fails.append(f"spawn spread {floor.get('spread')} < 0.70 of the long axis")
                if (floor.get("worst") or 0) > 0.55:
                    fails.append(f"bodies overlapped >30% for {floor.get('worst'):.2f}s")
                if (floor.get("scale") or 0) < 1:
                    fails.append(f"sprite scale {floor.get('scale')} is below 1x")
            mid["checks"]["floor"] = ("FAIL" if fails else "PASS", fails)
            for n in notes:
                mid["notes"].append(n)
                self.note(n)
        else:
            self.current = f"fight{idx}"

        budget = max(20, min(75, self.left() - 25))
        ended = False
        try:
            page.wait_for_function(RESULTS_JS, timeout=int(budget * 1000), polling=500)
            ended = True
        except Exception:
            self.note(f"fight {idx} not over after {budget:.0f}s, trying Skip")
            try:
                page.evaluate("() => { if (window.IL && IL.finishNow && IL.currentMatch && !IL.currentMatch.over) IL.finishNow(); }")
                page.wait_for_function(RESULTS_JS, timeout=12000, polling=500)
                ended = True
            except Exception:
                pass
        if not ended:
            self.step_fail(f"{base + 2:02d}_results{sfx}", "results", f"results overlay never appeared ({time.time() - t_start:.0f}s)"); return "stuck"
        fight_secs = time.time() - t_start
        page.wait_for_timeout(1500)  # let the overlay animate in
        res = self.capture(page, f"{base + 2:02d}_results{sfx}", kind="results")
        outcome = res.get("outcome", "?")
        res["notes"].append(f"fight {idx}: {outcome}, ~{fight_secs:.0f}s at {spd}")

        # exit back to hub
        how = None
        cand = page.locator("button:visible, a:visible, [role=button]:visible").filter(has_text=EXIT_RE)
        try:
            n = cand.count()
            order = sorted(range(n), key=lambda i: 0 if re.search(r"continue|club", cand.nth(i).inner_text(), re.I) else 1)
            for i in order:
                b = cand.nth(i)
                txt = b.inner_text().strip()
                try:
                    b.click(timeout=4000)
                except Exception:
                    b.click(timeout=3000, force=True)
                page.wait_for_timeout(900)
                if page.evaluate(HUB_JS):
                    how = f"button \"{txt}\""
                    break
        except Exception as e:
            self.note(f"exit button attempt: {e}")
        if not how:
            page.keyboard.press("Escape")
            page.wait_for_timeout(900)
            if page.evaluate(HUB_JS):
                how = "Esc key"
        page.evaluate("() => window.scrollTo(0, 0)")
        extra = {"exit-to-hub": ("PASS", [f"returned via {how}"]) if how else
                 ("FAIL", ["could not return to the hub via a club/continue/back button or Esc"] +
                  ([f"results overlay buttons: {res.get('raw', {}).get('resultInfo', {}).get('buttons')}"] if (res.get('raw') or {}).get('resultInfo') else []))}
        self.capture(page, f"{base + 3:02d}_after_exit{sfx}", kind="hub", full_page=True, extra=extra)
        if not how:
            return "stuck"
        # close anything the exit opened (e.g. a perk chooser) so the next fight can start
        for _ in range(2):
            if page.locator("[role=dialog][aria-modal=true]:visible").count():
                self.close_overlay(page)
        return outcome


def run_viewport(vp, url, out, deadline, cap, max_fights=3):
    from playwright.sync_api import sync_playwright
    r = Run(vp, url, out, deadline, cap, max_fights)
    crash = None
    try:
        with sync_playwright() as pw:
            r.run(pw)
    except Exception:
        crash = traceback.format_exc()
        r.step_fail("harness", "hub", "crash: " + crash.strip().splitlines()[-1])
    # attach js-errors per screen: errors raised while a screen was current belong to it;
    # errors from in-between steps (loading, fighting) go to the next captured screen.
    names = [s["name"] for s in r.screens]
    for e in r.errors:
        if e["screen"] not in names and r.screens:
            e["screen"] = names[min(e["seq"], len(names) - 1)]
    for s in r.screens:
        errs = [e for e in r.errors if e["screen"] == s["name"]]
        s["checks"]["js-errors"] = ("FAIL" if errs else "PASS", [f"{e['kind']}: {e['text']}" for e in errs])
    return {"viewport": vp, "screens": r.screens, "errors": r.errors, "crash": crash}

# ------------------------------------------------------------------- outputs
CHECK_ORDER = ["harness", "h-overflow", "v-scroll", "speed-in-view", "floor", "box-overflow", "text-clip",
               "rotate-over-table", "results-exit", "exit-to-hub", "js-errors"]

def contact_sheet(res, out):
    from PIL import Image, ImageDraw, ImageFont
    vp = res["viewport"]
    w = int(vp.split("x")[0])
    tw = 230 if w < 800 else 420
    cols = 7 if w < 800 else 4
    maxh = int(tw * 2.6) if w < 800 else int(tw * 1.25)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 13)
        small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 11)
    except Exception:
        font = small = ImageFont.load_default()
    tiles = []
    for s in res["screens"]:
        fails = [k for k, v in s["checks"].items() if v[0] == "FAIL"]
        if s.get("png") and os.path.exists(s["png"]):
            im = Image.open(s["png"]).convert("RGB")
            h = int(im.height * tw / im.width)
            im = im.resize((tw, h), Image.LANCZOS)
            if h > maxh:
                im = im.crop((0, 0, tw, maxh))
                d = ImageDraw.Draw(im)
                d.rectangle((0, maxh - 16, tw, maxh), fill=(0, 0, 0))
                d.text((4, maxh - 15), f"… cropped ({h}px tall)", font=small, fill=(220, 220, 220))
        else:
            im = Image.new("RGB", (tw, 120), (40, 40, 40))
            ImageDraw.Draw(im).text((8, 50), "no screenshot", font=font, fill=(220, 120, 120))
        tiles.append((s["name"], fails, im))
    if not tiles:
        return None
    lab = 38
    rows = [tiles[i:i + cols] for i in range(0, len(tiles), cols)]
    pad = 8
    rh = [max(t[2].height for t in row) + lab for row in rows]
    W = cols * (tw + pad) + pad
    H = sum(rh) + pad * (len(rows) + 1) + 30
    sheet = Image.new("RGB", (W, H), (18, 18, 22))
    d = ImageDraw.Draw(sheet)
    d.text((pad, 8), f"Iron League QA · {vp}", font=font, fill=(240, 240, 240))
    y = 30 + pad
    for row, h in zip(rows, rh):
        x = pad
        for name, fails, im in row:
            col = (170, 40, 40) if fails else (40, 130, 60)
            d.rectangle((x, y, x + tw, y + lab), fill=col)
            d.text((x + 4, y + 3), name, font=font, fill=(255, 255, 255))
            d.text((x + 4, y + 20), ("FAIL: " + ", ".join(fails))[:int(tw / 6.2)] if fails else "PASS", font=small, fill=(255, 255, 255))
            sheet.paste(im, (x, y + lab))
            x += tw + pad
        y += h + pad
    p = os.path.join(out, f"contact_{vp}.png")
    sheet.save(p, optimize=True)
    return p

def write_report(results, out, url, started, elapsed, sheets):
    lines = []
    any_fail = any(v[0] == "FAIL" for r in results for s in r["screens"] for v in s["checks"].values())
    nfail = sum(1 for r in results for s in r["screens"] for v in s["checks"].values() if v[0] == "FAIL")
    npass = sum(1 for r in results for s in r["screens"] for v in s["checks"].values() if v[0] == "PASS")
    lines += [f"# Iron League visual QA — {'FAIL' if any_fail else 'PASS'}", "",
              f"- URL: {url}", f"- Run: {time.strftime('%Y-%m-%d %H:%M %Z', time.localtime(started))} ({elapsed:.0f}s)",
              f"- Checks: {npass} PASS, {nfail} FAIL", ""]
    for p in sheets:
        if p:
            lines.append(f"- Contact sheet: `{p}`")
    lines.append("")
    lines += ["Checks: **h-overflow** page scrollWidth>clientWidth · **v-scroll** page scrollHeight>innerHeight+2 (fight/results) · "
              "**speed-in-view** speed buttons inside viewport (fight) · **box-overflow** text/button/img outside a bordered/border-image parent's padding box (>1px) · "
              "**text-clip** text truncated/clipped by overflow (ellipsis or hidden) · **rotate-over-table** rotating/rotated element overlapping a table · "
              "**results-exit** hit-testable club/continue/back button in viewport on results · **exit-to-hub** could leave results to the hub · "
              "**js-errors** console errors / page errors while on that screen · **harness** step could not be performed.", ""]
    # one line per failing (viewport, screen, check): first concrete detail
    summ = []
    for r in results:
        for s in r["screens"]:
            for k, v in s["checks"].items():
                if v[0] != "FAIL":
                    continue
                det = [d for d in v[1] if not re.match(r"^\d+ element", d)]
                cnt = next((d.split(" ")[0] for d in v[1] if re.match(r"^\d+ element", d)), None)
                summ.append(f"- {r['viewport']} · {s['name']} · **{k}**" + (f" ({cnt} items)" if cnt else "") +
                            (f": {det[0]}" if det else ""))
    if summ:
        lines += ["## Failure summary", ""] + summ + [""]
    outcomes = [f"{r['viewport']}: " + ", ".join(f"{s['name']}={s['outcome']}" for s in r["screens"] if s.get("outcome")) for r in results]
    lines += ["Fight outcomes — " + " · ".join(outcomes), ""]
    for r in results:
        vp = r["viewport"]
        lines += [f"## {vp}", ""]
        cols = [c for c in CHECK_ORDER if any(c in s["checks"] for s in r["screens"])]
        lines.append("| screen | " + " | ".join(cols) + " |")
        lines.append("|---|" + "---|" * len(cols))
        for s in r["screens"]:
            cells = []
            for c in cols:
                v = s["checks"].get(c)
                cells.append("—" if not v else ("**FAIL**" if v[0] == "FAIL" else "PASS"))
            lines.append(f"| {s['name']} | " + " | ".join(cells) + " |")
        lines.append("")
        for s in r["screens"]:
            fails = [(k, v) for k, v in s["checks"].items() if v[0] == "FAIL"]
            notes = s.get("notes") or []
            if not fails and not notes:
                continue
            lines.append(f"### {vp} · {s['name']}" + (f"  (`{s['png']}`)" if s.get("png") else ""))
            for n in notes:
                lines.append(f"- note: {n}")
            for k, v in fails:
                lines.append(f"- **{k}** FAIL")
                for d in v[1]:
                    lines.append(f"  - {d}")
            lines.append("")
        if r.get("crash"):
            lines += ["```", r["crash"], "```", ""]
    with open(os.path.join(out, "report.md"), "w") as f:
        f.write("\n".join(lines))
    with open(os.path.join(out, "report.json"), "w") as f:
        json.dump({"url": url, "overall": "FAIL" if any_fail else "PASS", "results": results}, f, indent=1, default=str)
    return any_fail

# ------------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--url", default=DEFAULT_URL, help="game URL, or a local dir/file to serve")
    ap.add_argument("--viewports", default=",".join(DEFAULT_VIEWPORTS), help="comma list WxH")
    ap.add_argument("--out", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "out"))
    ap.add_argument("--budget", type=float, default=225, help="total seconds budget (default 225)")
    ap.add_argument("--serial", action="store_true", help="run viewports one after another instead of in parallel")
    ap.add_argument("--cap", type=int, default=30, help="max overflow items reported per screen per check")
    ap.add_argument("--max-fights", type=int, default=3, help="keep fighting (results + exit only) until a victory overlay is seen, up to N fights")
    a = ap.parse_args()

    started = time.time()
    deadline = started + a.budget
    url, srv = maybe_serve(a.url)
    sep = "&" if "?" in url else "?"
    if srv is None and "t=" not in url:
        url = f"{url}{sep}qa={int(started)}"  # bust caches on the live site
    vps = [v.strip() for v in a.viewports.split(",") if v.strip()]
    os.makedirs(a.out, exist_ok=True)
    print(f"QA {url} viewports={vps} out={a.out}", flush=True)

    results = {}
    try:
        if a.serial or len(vps) == 1:
            for vp in vps:
                # give each serial viewport a fair share of the remaining time
                share = time.time() + (deadline - time.time()) / (len(vps) - len(results))
                results[vp] = run_viewport(vp, url, a.out, share, a.cap, a.max_fights)
        else:
            with ProcessPoolExecutor(max_workers=len(vps)) as ex:
                futs = {ex.submit(run_viewport, vp, url, a.out, deadline, a.cap, a.max_fights): vp for vp in vps}
                for f in as_completed(futs, timeout=a.budget + 90):
                    vp = futs[f]
                    try:
                        results[vp] = f.result()
                    except Exception as e:
                        results[vp] = {"viewport": vp, "errors": [], "crash": repr(e),
                                       "screens": [{"name": "harness", "kind": "hub", "png": None, "notes": [],
                                                    "checks": {"harness": ("FAIL", [f"worker crashed: {e}"])}}]}
    except Exception:
        traceback.print_exc()
    for vp in vps:
        results.setdefault(vp, {"viewport": vp, "errors": [], "crash": "did not finish",
                                "screens": [{"name": "harness", "kind": "hub", "png": None, "notes": [],
                                             "checks": {"harness": ("FAIL", ["viewport run did not finish"])}}]})
    ordered = [results[vp] for vp in vps]
    sheets = []
    for r in ordered:
        try:
            sheets.append(contact_sheet(r, a.out))
        except Exception as e:
            print(f"contact sheet {r['viewport']} failed: {e}")
    elapsed = time.time() - started
    any_fail = write_report(ordered, a.out, url, started, elapsed, sheets)
    if srv:
        srv.shutdown()
    print(f"\n{'FAIL' if any_fail else 'PASS'} in {elapsed:.0f}s — report: {os.path.join(a.out, 'report.md')}")
    for p in sheets:
        if p:
            print("contact sheet:", p)
    sys.exit(1 if any_fail else 0)

if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception:
        traceback.print_exc()
        sys.exit(2)
