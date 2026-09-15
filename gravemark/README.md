# Gravemark

A standalone browser idle ARPG served by GitHub Pages at `/Odds-Ends/gravemark/`.
It shares nothing with the card game at the repo root or with `ironhold/`, and
is exempt from the root's generated-file rule.

Built in the shape of **Path of Idle: Old Gods Rising** — auto-battle, a loot
treadmill, sockets and runewords, a passive tree, a town, five adventure modes,
seasons and prestige — with one system of its own bolted through the middle of
it.

## The shape of it

Three columns, all visible at once, so you never stop watching the game to
manage a menu:

```
  the parish          three live delves        the warband
  ----------          -----------------        -----------
  painted scene       squad 1 fighting         22-hero roster
  building markers    squad 2 fighting         portraits, ranks,
  currencies          squad 3 fighting         levels, squad
  charter strip       each with its own        assignment
                      depth and orders
```

A **warband** of up to 22 heroes, split across **three squads that delve
simultaneously**. Each squad has its own depth, its own orders and its own life
pool; each hero has their own class, rank, level and full set of equipment. The
passive tree, the parish and ascension are shared, because those are the
player's institution rather than any one person's kit.

Everything that used to be a tab — gear, bench, tree, parish, gravemarks,
ascension — opens as an overlay over the three columns.

## The spin: death is the crafting system

Path of Idle's most common complaint is that the endgame collapses into an
RNG-fest for equipment stats. Gravemark's answer:

- A squad that is broken does **not** lose its gear. It leaves a **gravemark**
  at that depth recording every affix the whole squad wore.
- Kill at or below that depth to recover it. It pays an **Epitaph**: one of
  those exact rolls, at its exact tier and its exact value.
- An Epitaph can be **inscribed** onto any legal item — deterministically. No
  roll, no range, no second attempt.
- Leave a gravemark too long and it stands up as a **Revenant** wearing the old
  kit. Beat it to claim double epitaphs and a guaranteed high-rarity item.

So the endgame is "die in good gear, remember the good rolls, put them where you
want them" rather than "reroll until the dice are kind". Shards still buy random
outcomes and are plentiful; epitaphs buy exact outcomes and are scarce, because
each one cost a wipe.

## Files

```
index.html          the three-column shell; script tags in load order
css/main.css        every colour is a token on :root — retheme here
src/00-18-*.js      logic layer (no DOM)
src/30-ui.js        shell core: currencies, tooltips, render router
src/31-ui-hub.js    left column: the parish
src/32-ui-battle.js centre column: three live battle panels
src/33-ui-roster.js right column: the warband
src/34-ui-overlay.js everything that used to be a tab
src/99-boot.js      the game loop
tools/              harness, tests, balance, art tooling
art/                drop real art here; absent art draws as placeholders
```

Classic scripts, no build step, no bundler, no dependencies. Open `index.html`
and it runs.

### Load order matters

The files are plain `<script>` tags sharing **one global scope**. Two files
declaring the same top-level name silently clobber each other — this already
happened once (`_cache` in both the stat cache and the art cache, so
invalidating stats nulled the art cache). `tools/check-globals.js` fails on any
duplicate; run it after adding a file.

Everything hangs off the single global `GM`.

## Verify before any deploy

```bash
for f in src/*.js; do node --check "$f"; done   # every file parses
node tools/check-globals.js                      # no top-level collisions
node tools/test-core.js                          # 88 logic checks
node tools/balance.js                            # pacing across depths
python3 tools/smoke.py                           # 37 checks, real page headless
python3 tools/art-check.py art                   # delivered art matches the manifest
```

`smoke.py` needs playwright **pinned**:

```bash
pip install playwright==1.56.0     # NOT plain `pip install playwright`
```

The image ships chromium revision 1194 and 1.56.0 is the release that wants
exactly that. Installing the newest demands a revision that is not on disk and
then tells you to run `playwright install` — don't; it re-downloads browsers
that are already there.

## Balance

`tools/balance.js` outfits a plausible SQUAD at a range of depths and reports
time-to-clear-the-pack against time-to-be-broken, for a normal pack and for that
realm's boss separately. Sampling only round-numbered depths measures nothing but
bosses, since every tenth stage is one.

All scaling constants live in `GM.CURVE` in `src/03-data-world.js` and nowhere
else. Four of them are load-bearing and were measured rather than guessed:

| constant | why it is what it is |
|---|---|
| `monHpG` / `monDmgG` | A geared squad's damage grows 1.111 per depth and its life 1.082 — **until levels cap**, after which damage growth falls to ~1.087 (item scaling alone). These sit between the two, so the mid-game keeps pace and the post-cap depths tighten into an endgame instead of a wall. |
| `itemScale` | Base tiers are discrete and run out at ilvl 84. Without continuous per-ilvl scaling on flat stats the game walls permanently around depth 90. |
| `packsPerStage` | The single most important pacing number. At one pack per depth a squad gained a depth every ~15s, so difficulty compounded 1.10× per quarter-minute while three level-1 heroes split experience three ways. It out-climbed its own power and wiped inside two minutes, every time. |
| `GM.earlyScale` | A farmed squad is ~9× stronger than the three heroes a new save starts with, so one constant cannot serve both. This ramps the first 25 depths down. |

`GM.LEECH_CAP` matters just as much: leech is capped as a fraction of maximum
life per second, not of damage dealt. Uncapped, leech scales with damage while
incoming scales with depth, and past a point every squad is immortal.

Change any of these and re-run `balance.js`.

## Art

The game references **no image path directly**. It asks `GM.art(key)` and gets
either the real asset or a procedurally drawn, labelled placeholder, so it is
fully playable with zero image files. Backdrops resolve to `.jpg` (no alpha,
a tenth the bytes); everything else to `.png`.

`src/18-assets.js` is the manifest: 311 keys, including 169 animated sprite
sheets and 45 paper-doll gear layers. It is built programmatically from the game
data, so adding a monster to `03-data-world.js` adds its art keys automatically
and the brief cannot drift out of date.

**Current coverage: 158 of 311 painted.** `ART-REMAINING.md` lists the rest.
All twelve bosses, all fifteen monsters, the hero, and seventeen of eighteen
backdrops are in. Outstanding: the paper-doll gear, most item and rune icons,
and the UI chrome and rarity frames (neither of which the renderer consumes
yet — the UI is CSS).

**Nothing delivered so far is animated.** Every painted sheet arrived with all
frames identical, and all twelve hero states are byte-for-byte the same image —
so the hero renders as one pose and never changes. The renderer derives frame
count from each image's own width rather than from the manifest, so these ship
collapsed to a single frame and a genuinely animated replacement drops in later
with no code change.

### Installing an art delivery

```bash
node tools/art-manifest.js > /tmp/manifest.json
python3 tools/art-install.py <unzipped-art-dir>      # writes art/
python3 tools/art-check.py art --remaining ART-REMAINING.md
```

`art-install.py` does three things that matter:

1. **Installs only what is actually painted.** Deliveries ship on-spec filler
   for unfinished keys. A placeholder file on disk *loads successfully*, and the
   renderer then composites it — 45 doll layers of captioned boxes over the
   hero. A file that is ABSENT falls back to the game's own placeholder, which
   is what we want, so filler is detected and left out.
2. **Repairs mattes.** Figures frequently arrive pasted on a light card rather
   than cut out, which on a dark backdrop reads as a bright rectangle. Detection
   samples the opaque bounding-box perimeter (a card has a uniform opaque ring;
   a cut-out sprite's is mostly transparent), then region-grows from inside the
   card. Seeding from the frame border does not work: the card's own boundary is
   a hard edge the flood cannot cross.
3. **Collapses static sheets** to a single frame.
4. **Refuses wrong-sized assets.** One that installs quietly is worse than one
   that is missing, because it only breaks when that key is finally wired up.

`--exclude <prefix>` skips a category. The `doll/` layers delivered so far need
this: they arrived as standalone item illustrations on white cards rather than
body-aligned gear layers, so compositing them puts a picture of a sword across
the hero's chest. Verify any doll delivery by compositing it over
`actor/hero-idle` before installing.

Deliver art at `art/<key>.png` — e.g. `art/mon/shambler-idle.png`. Sprite sheets
are a single horizontal strip of frames.

```bash
node tools/art-brief.js    > ART-BRIEF.md    # the full brief, all 303 keys
node tools/grok-prompts.js > GROK-PROMPTS.md # one prompt per MISSING asset
```

### Hero looks — the paper-doll fallback

Layered gear needs every piece drawn over the same body at the same footing.
Three deliveries of `doll/` came back as item illustrations on cards instead,
because a text-to-image tool cannot register a layer to a body it cannot see.

So `actor/hero-look-<weapon>-<band>` exists: **one finished figure already
wearing a whole kit**, picked by weapon family and average armour tier. Fifteen
images instead of forty-five aligned layers, and any single one is useful the
day it arrives. `GM.heroLookKey()` resolves the current kit to a look; when the
art is present the renderer draws it *instead of* the body-plus-layers stack,
and falls back automatically when it is not. The `doll/` path stays for a
delivery that genuinely aligns.

### Backgrounds on delivered art

Ask for a **flat magenta `#FF00FF`** background, never "transparent" — requests
for transparency come back as a white card, and a white card on a dark backdrop
is a bright rectangle. `art-install.py` keys magenta out on install (verified:
55k background pixels removed, 3 survivors, figure untouched).

## Deploy

Commit and push; Pages redeploys in a minute or two. The build stamp under the
title (`GM.BUILD` in `src/00-util.js`) is how a deploy gets confirmed — bump it
with any shipped change, because a player on a stale cached page sees the old
game with no error of any kind.
