# Gravemark

A standalone browser idle ARPG served by GitHub Pages at `/Odds-Ends/gravemark/`.
It shares nothing with the card game at the repo root or with `ironhold/`, and
is exempt from the root's generated-file rule.

Built in the shape of **Path of Idle: Old Gods Rising** — auto-battle, a loot
treadmill, sockets and runewords, a passive tree, a town, five adventure modes,
seasons and prestige — with one system of its own bolted through the middle of
it.

## The spin: death is the crafting system

Path of Idle's most common complaint is that the endgame collapses into an
RNG-fest for equipment stats. Gravemark's answer:

- Dying does **not** take your gear. It takes a **rubbing** of it, and plants a
  **gravemark** at the depth where you died recording every affix you wore.
- Kill at or below that depth to recover the gravemark. It pays out an
  **Epitaph**: one of those exact rolls, at its exact tier and its exact value.
- An Epitaph can be **inscribed** onto any legal item — deterministically. No
  roll, no range, no second attempt.
- Leave a gravemark too long and it stands up as a **Revenant** wearing your old
  kit, scaled by how good that kit was. Beat it to claim double epitaphs and a
  guaranteed high-rarity item.

So the endgame is "die in good gear, remember the good rolls, put them where you
want them" rather than "reroll until the dice are kind". Shards still buy random
outcomes and are plentiful; epitaphs buy exact outcomes and are scarce, because
each one cost a death.

## Files

```
index.html          the shell; script tags in load order
css/main.css        every colour is a token on :root — retheme here
src/00-18-*.js      logic layer (no DOM)
src/30-34,99-*.js   UI layer and boot
tools/              harness, tests, balance, art brief
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
node tools/test-core.js                          # 64 logic checks
node tools/balance.js                            # pacing across depths
python3 tools/smoke.py                           # 36 checks, real page headless
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

`tools/balance.js` outfits a plausible character at a range of depths and
reports time-to-kill against time-to-die, for a normal monster and for that
realm's boss separately. Sampling only round-numbered depths measures nothing
but bosses, since every tenth stage is one.

The intended shape, and what it currently reports:

| profile | expected |
|---|---|
| farming at your own depth | safe; you idle without dying |
| pushing ~15 ahead of gear | fights lengthen, bosses become real events |
| pushing ~30 ahead of gear | **bosses wall you** |

Bosses are the gate. Dying is what plants gravemarks, so the difficulty curve
feeds the crafting system.

All scaling constants live in `GM.CURVE` in `src/03-data-world.js` and nowhere
else. `itemScale` is load-bearing: base tiers are discrete and run out at ilvl
84, so without continuous per-ilvl scaling on flat stats the game walls
permanently around depth 90. Change it and re-run `balance.js`.

`GM.LEECH_CAP` is the other load-bearing number. Leech capped as a fraction of
maximum life per second, not of damage dealt — uncapped, leech scales with dps
while incoming damage scales with depth, and past a point every build is
immortal.

## Art

The game references **no image path directly**. It asks `GM.art(key)` and gets
either the real asset or a procedurally drawn, labelled placeholder, so it is
fully playable with zero image files. Backdrops resolve to `.jpg` (no alpha,
a tenth the bytes); everything else to `.png`.

`src/18-assets.js` is the manifest: 288 keys, including 169 animated sprite
sheets and 45 paper-doll gear layers. It is built programmatically from the game
data, so adding a monster to `03-data-world.js` adds its art keys automatically
and the brief cannot drift out of date.

**Current coverage: 158 of 288 painted.** `ART-REMAINING.md` lists the rest.
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
