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
python3 tools/smoke.py                           # 31 checks, real page headless
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
fully playable with zero image files.

`src/18-assets.js` is the manifest: 288 keys, including 169 animated sprite
sheets (1,288 frames) and 45 paper-doll gear layers. It is built programmatically
from the game data, so adding a monster to `03-data-world.js` adds its art keys
automatically and the brief cannot drift out of date.

```bash
node tools/art-brief.js            # regenerate the full brief from the manifest
```

Drop finished art at `art/<key>.png` — e.g. `art/mon/shambler-idle.png`. Sprite
sheets are a single horizontal strip of frames. Nothing in the game code changes.

## Deploy

Commit and push; Pages redeploys in a minute or two. The build stamp under the
title (`GM.BUILD` in `src/00-util.js`) is how a deploy gets confirmed — bump it
with any shipped change, because a player on a stale cached page sees the old
game with no error of any kind.
