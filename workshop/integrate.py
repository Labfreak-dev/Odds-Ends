import io, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
# output dir: --out <dir> (default: <script dir>/build)
OUTDIR = os.path.abspath(sys.argv[sys.argv.index("--out")+1]) if "--out" in sys.argv else os.path.join(HERE, "build")
SRC = os.path.join(HERE, "source-pristine.html")
OUT = os.path.join(OUTDIR, "index.html")
src = io.open(SRC, encoding="utf-8").read()
orig = len(src)
edits = []

def read(p): return io.open(os.path.join(HERE, p), encoding="utf-8").read()

def once(hay, needle, rep, label):
    n = hay.count(needle)
    if n != 1:
        print(f"  ABORT [{label}] anchor matched {n} times, expected 1"); sys.exit(1)
    edits.append(label)
    return hay.replace(needle, rep, 1)

# ---- 1. styles -------------------------------------------------------
css = "\n".join(["\n/* ===== ADDED MODES ===== */",
                 read("provenance.css"), read("press.css"), read("puzzles.css"), read("logic.css"), read("arcade.css"), read("fishing2.css"), read("mining2.css"), read("ledger.css"), read("grading.css"), read("market2.css"), read("casino2.css"), read("keep.css"), read("hunt.css"), read("ripship.css")])
src = once(src, "</style>", css + "\n</style>", "css")

# ---- 2. tab sections -------------------------------------------------
sections = """
  <section id="tab-provenance" style="display:none;">
    <div class="panel"><div class="pv-stage" id="pvStage"></div></div>
  </section>

  <section id="tab-press" style="display:none;">
    <div class="panel"><div class="pr-stage" id="prStage"></div></div>
  </section>

  <section id="tab-connections" style="display:none;">
    <div class="panel"><div class="cx-stage" id="cxStage"></div></div>
  </section>

  <section id="tab-showcase" style="display:none;">
    <div class="panel"><div class="cs-stage" id="csStage"></div></div>
  </section>

  <section id="tab-oddone" style="display:none;">
    <div class="panel"><div class="oo-stage" id="ooStage"></div></div>
  </section>

"""
src = once(src, '<section id="tab-collection" style="display:none;">',
  """  <section id="tab-keep" style="display:none;">
    <div class="panel"><div id="kpStage"></div></div>
  </section>

  <section id="tab-hunt" style="display:none;">
    <div class="panel"><div id="huStage"></div></div>
  </section>

<section id="tab-collection" style="display:none;">""", "keep section")
anchor = '<section id="tab-collection" style="display:none;">'
src = once(src, anchor, sections + "  " + anchor, "sections")

# ---- 3. modules ------------------------------------------------------
MODULE_FILES = ["fishing-assets.module.js", "fishing-sfx.module.js",
    "provenance.catalogue.js", "provenance.module.js",
    "press.module.js", "connections.module.js",
    "case.module.js", "oddone.module.js",
    "fishing2.module.js", "mining2.module.js", "ripship.module.js", "ledger.module.js", "grading.module.js",
    "market2.module.js", "casino2.module.js", "keep.module.js", "hunt.module.js"]
def sent(name): return "\n/*@@SPLIT:" + name + "@@*/\n"
modparts = ["\n/* ===================== ADDED MODES ===================== */"]
for mf in MODULE_FILES:
    nm = mf.replace(".module.js","").replace(".js","").replace(".","-")
    modparts.append(sent(nm) + read(mf))
modparts.append(sent("tail") + "/* =================== END ADDED MODES =================== */\n")
modules = "\n".join(modparts)
src = once(src, "const UI_GAMES = [", modules + "\nconst UI_GAMES = [", "modules")

# ---- 3b. fishing copy: retire the tap-era language -------------------
# The banner panel ("An Afternoon Off" + blurb) is gone entirely — plain
# text that served no purpose once the scene could speak for itself.
# ---- the 2:3 canvas + the tall painting ----
src = once(src, 'width="1600" height="1120"></canvas>', 'width="1600" height="2400"></canvas>', "tall canvas")
i = src.index('FSH_BG_URL = "') + len('FSH_BG_URL = "')
j = src.index('"', i)
BG2X3 = os.path.join(HERE, "assets", "bg2x3.txt")
if not os.path.exists(BG2X3):
    print("  ABORT [bg swap] missing asset:", BG2X3); sys.exit(1)
bg2x3 = read(os.path.join("assets", "bg2x3.txt")).strip()
src = src[:i] + bg2x3 + src[j:]
print("  bg swapped ->", (j-i)//1024, "KB out,", len(bg2x3)//1024, "KB in")

src = once(src,
  """<div class="panel fsh-banner">
      <div style="font-size:38px;">🎣</div>
      <div style="font-weight:800; font-size:16px; margin-top:6px;" id="fshTitle">An Afternoon Off</div>
      <div style="color:var(--muted); font-size:13px; margin-top:4px; line-height:1.6;">
        The empire can run itself for an hour. Hold to cast, wait for the <b>!</b>, then tap like mad to bring it in.
        Better gear from the <b>Tackle Shop</b> in the Market means longer casts, faster bites and bigger things on the end of the line.
      </div>
    </div>

    """,
  "",
  "banner removed")
src = once(src,
  "stat:(t)=>`+${(t*2.2).toFixed(1)} reel power per tap` }",
  "stat:(t)=>`+${(t*2.2).toFixed(1)} reel power` }",
  "reel skill stat")
src = once(src,
  "stat:(t)=>`+${(t*3.5).toFixed(1)} tension recovery \u00b7 \u2212${(t*0.22).toFixed(2)} tension per tap` }",
  "stat:(t)=>`+${(t*3.5).toFixed(1)} tension recovery \u00b7 softer hands on the reel` }",
  "gloves skill stat")
src = once(src,
  'blurb:"How much line comes in per tap."',
  'blurb:"How much line comes in while you hold."',
  "reel skill blurb")
src = once(src,
  "strain:v=>`\u2212${v}% tension per tap`",
  "strain:v=>`\u2212${v}% reel strain`",
  "strain stat line")
src = once(src,
  "<span>Reel power <b>${st.tapPower.toFixed(1)}</b>/tap</span>",
  "<span>Reel power <b>${(st.tapPower*1.55).toFixed(1)}</b>/s held</span>",
  "reel power label")
src = once(src,
  "<span>Strain <b>${st.tensionPerTap.toFixed(1)}</b>/tap</span>",
  "<span>Drag load <b>${(30 + st.tapPower*0.75).toFixed(0)}</b> held</span>",
  "strain label")

# ---- 3c. wiki photos: never let a bad connection poison the cache ----
# A fetch failure used to cache a 90-day miss, so one offline/flaky
# session permanently killed catch photos for every species caught in it.
# Misses now expire in 2 hours (heals already-poisoned caches on their
# next catch), and hard network failures cache nothing at all.
src = once(src,
  "  if(hit && hit.t && (Date.now() - hit.t) < 1000*60*60*24*90) return hit.miss ? null : hit;",
  "  if(!subject) return null;\n"
  "  if(hit && hit.t && (Date.now() - hit.t) < ((hit.miss || !hit.img) ? 1000*60*60*2 : 1000*60*60*24*90)) return hit.miss ? null : hit;",
  "ci miss ttl")
src = once(src,
  "      if(j && j.extract && j.type !== \"disambiguation\" && ciSafe(j)) return j;\n    }catch(e){}",
  "      if(j && j.extract && j.type !== \"disambiguation\" && ciSafe(j)) return j;\n    }catch(e){ ciNetFail = true; }",
  "ci summary netfail")
src = once(src,
  "  let entry = null;\n  try{\n    let j = null;",
  "  let entry = null, ciNetFail = false;\n  try{\n    let j = null;",
  "ci netfail flag")
src = once(src,
  "}catch(e){ /* offline or blocked \u2014 fall through to the lore fallback */ }",
  "}catch(e){ ciNetFail = true; /* offline or blocked \u2014 don't cache a miss for that */ }",
  "ci outer netfail")
src = once(src,
  "  cache[subject] = { t: Date.now(), miss:true }; ciSaveCache();",
  "  if(!ciNetFail){ cache[subject] = { t: Date.now(), miss:true }; ciSaveCache(); }",
  "ci no-miss-on-netfail")
src = once(src,
  "function fshPrefetchPic(name){ try{ ciLookup(fshPicSubject(name)); }catch(e){} }",
  "function fshPrefetchPic(name){ if(!name) return; try{ ciLookup(fshPicSubject(name)); }catch(e){} }",
  "prefetch guard")

# ---- 4. registry -----------------------------------------------------
anchor = '  /* Runeshard entry removed - it ships as its own build. */\n];'
entries = """  { id:"provenance",  name:"Provenance",   icon:"\U0001F5C3\uFE0F", desc:"An archive record with the name struck out. Four cards. Name the thing.", meta:"1,215 subjects" },
  { id:"connections", name:"Connections",  icon:"\U0001F9E9", desc:"Sixteen cards, four groups of four. Everything you need is on the cards.", meta:"Daily-style puzzle" },
  { id:"showcase",    name:"The Case",     icon:"\U0001F5C4\uFE0F", desc:"Five slots, each with a rule. Twelve cards. Make them fit.", meta:"Constraint puzzle" },
  { id:"oddone",      name:"Odd One Out",  icon:"\U0001F440", desc:"Three belong together, one doesn't. Ten seconds.", meta:"Fast rounds" },
  { id:"press",       name:"The Press",    icon:"\u2699\uFE0F", desc:"Spare prints in, one good print out. Merge tiers until the plate jams.", meta:"Duplicate sink" },
  /* Runeshard entry removed - it ships as its own build. */
];"""
src = once(src, anchor, entries, "UI_GAMES")

# ---- 5. leave hooks --------------------------------------------------
anchor = '  if(except!=="siege") sgOnLeaveTab();'
src = once(src, anchor,
  '  if(except!=="provenance") pvOnLeaveTab();\n'
  '  if(except!=="press") prOnLeaveTab();\n'
  '  if(except!=="connections") cxOnLeaveTab();\n'
  '  if(except!=="showcase") csOnLeaveTab();\n'
  '  if(except!=="oddone") ooOnLeaveTab();\n' + anchor, "leave hooks")

# ---- 6. enter hooks --------------------------------------------------
anchor = '  else if(id==="dungeon"){ renderDungeon(); }'
src = once(src, anchor,
  '  else if(id==="provenance"){ pvOnEnterTab(); }\n'
  '  else if(id==="press"){ prOnEnterTab(); }\n'
  '  else if(id==="connections"){ cxOnEnterTab(); }\n'
  '  else if(id==="showcase"){ csOnEnterTab(); }\n'
  '  else if(id==="oddone"){ ooOnEnterTab(); }\n' + anchor, "enter hooks")

# ---- 7. render list --------------------------------------------------
anchor = '  safeRender("play",       renderPlayLobby);'
src = once(src, anchor,
  '  safeRender("provenance",  renderProvenance);\n'
  '  safeRender("press",       renderPress);\n'
  '  safeRender("connections", renderConnections);\n'
  '  safeRender("showcase",    renderCase);\n'
  '  safeRender("oddone",      renderOddOne);\n' + anchor, "render list")

# ---- 8. poker rush: WASD ---------------------------------------------
# The handler already guards on pkTabActive, so these can't leak into
# other tabs — The Press keeps its own WASD behind #tab-press visibility.
old_keys = """  if(k === "arrowleft"){ pk.cur.x = Math.max(0, pk.cur.x-1); e.preventDefault(); }
  else if(k === "arrowright"){ pk.cur.x = Math.min(PK_COLS-2, pk.cur.x+1); e.preventDefault(); }
  else if(k === "arrowup"){ pk.cur.y = Math.min(PK_ROWS-1, pk.cur.y+1); e.preventDefault(); }
  else if(k === "arrowdown"){ pk.cur.y = Math.max(0, pk.cur.y-1); e.preventDefault(); }"""
new_keys = """  if(k === "arrowleft" || k === "a"){ pk.cur.x = Math.max(0, pk.cur.x-1); e.preventDefault(); }
  else if(k === "arrowright" || k === "d"){ pk.cur.x = Math.min(PK_COLS-2, pk.cur.x+1); e.preventDefault(); }
  else if(k === "arrowup" || k === "w"){ pk.cur.y = Math.min(PK_ROWS-1, pk.cur.y+1); e.preventDefault(); }
  else if(k === "arrowdown" || k === "s"){ pk.cur.y = Math.max(0, pk.cur.y-1); e.preventDefault(); }"""
src = once(src, old_keys, new_keys, "poker wasd")

# and say so in the lobby, since no binding was documented anywhere
old_help = 'Chain ×3 or every 5,000 points drops a wild <b>Joker</b>.<br>Survive the rise.</div>'
new_help = ('Chain ×3 or every 5,000 points drops a wild <b>Joker</b>.<br>Survive the rise.<br>'
            '<span style="font-size:11.5px;color:var(--muted);">WASD or arrows move the cursor · '
            'Space, X or Z swaps · hold R to raise the stack · or just drag.</span></div>')
src = once(src, old_help, new_help, "poker help text")

os.makedirs(os.path.dirname(OUT), exist_ok=True)
# ---- MULTI-FILE EXPLOSION: split script blocks into oe-*.js ----------
import re as _re, glob as _glob, hashlib as _hashlib
outdir = os.path.dirname(OUT)
for stale in _glob.glob(os.path.join(outdir, "oe-*.js")): os.remove(stale)
manifest = []
def _explode(m):
    body = m.group(1)
    n = len(manifest)
    tags = []
    if "@@SPLIT:" in body:
        pieces = _re.split(r"/\*@@SPLIT:([\w-]+)@@\*/", body)
        # pieces = [core, name1, text1, name2, text2, ...]
        chunks = [("core", pieces[0])]
        for i in range(1, len(pieces), 2):
            chunks.append((pieces[i], pieces[i+1]))
    else:
        chunks = [("boot" + str(n), body)]
    for name, text in chunks:
        fn = "oe-%02d-%s.js" % (len(manifest), name)
        io.open(os.path.join(outdir, fn), "w", encoding="utf-8").write(text)
        manifest.append((fn, len(text)))
        # Cache-bust per file, by its OWN content. Without this a returning
        # player keeps whatever javascript their browser cached and simply
        # never sees the deploy - the page loads, the game works, the new
        # thing is silently absent. Hashing each file separately means an
        # unchanged file keeps its url and stays cached.
        ver = _hashlib.sha1(text.encode("utf-8")).hexdigest()[:10]
        tags.append('<script src="%s?v=%s"></script>' % (fn, ver))
    return "\n".join(tags)
html = _re.sub(r"<script>(.*?)</script>", _explode, src, flags=_re.S)
# Stamp the build into the header chip. Without a visible build id there is no
# way to answer "am I actually on the new version, or looking at a cached one?"
# - which is exactly the question a stale index.html makes impossible to settle.
_stamp = _hashlib.sha1("".join(fn for fn, _ in manifest).encode()
                       + str(sum(n for _, n in manifest)).encode()).hexdigest()[:6]
_chip = '<span class="tag">Prototype v0.1</span>'
if html.count(_chip) == 1:
    html = html.replace(_chip, '<span class="tag">Prototype v0.1 · %s</span>' % _stamp, 1)
    print("  build stamp:", _stamp)
else:
    print("  NOTE: header chip not found, build stamp skipped")
io.open(OUT, "w", encoding="utf-8").write(html)
# keep the node harness fed
modesdir = os.path.join(outdir, "modes")
os.makedirs(modesdir, exist_ok=True)
import shutil as _sh
for mf in MODULE_FILES: _sh.copy(os.path.join(HERE, mf), os.path.join(modesdir, mf))
print("  multi-file: index.html %dKB + %d script files" % (len(html)//1024, len(manifest)))
for fn, ln in manifest: print("    %-32s %7.1f KB" % (fn, ln/1024))
print(f"  applied: {', '.join(edits)}")
print(f"  {orig:,} -> {len(src):,} bytes (+{len(src)-orig:,})")
print("  modes: provenance, connections, showcase, oddone, press — culls removed dig/resto/breaker/skywatch/arena/storm; siege+raids retired host-side")
