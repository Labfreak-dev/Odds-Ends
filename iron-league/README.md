# Iron League

A mercenary club and a pit. Hire a roster, send a squad of one to three into a real-time autobattle, and play a five-match season. Fighters are composited from the Heroes99 modular sprite sheets in `assets/heroes99/`.

Play: https://labfreak-dev.github.io/Odds-Ends/iron-league/

No build step. `index.html` loads the classic scripts in order.

| File | What it is |
|---|---|
| `index.html` | Page shell. |
| `css/game.css` | Layout for the title, creator, club hub, and pit. |
| `js/data.js` | Classes, clip timing, names, hire price, seeded RNG. No DOM. |
| `js/hero.js` | Layer order, measured frame rects, atlas cache. One offscreen composite per loadout. |
| `js/arena.js` | The fight. `createMatch` / `stepMatch`, no DOM. |
| `js/render.js` | Canvas: pit, sprites, telegraphs, shots, bars, numbers. |
| `js/game.js` | Title, creator, hub, season, save, fight loop. |
| `ANIM.md` | How the 102 frames were measured, and the clip table. |

The save key is `ironleague.v1` in `localStorage`.

Sprite sheets are the Heroes99 v1.2 modular character pack (layered 800×680 PNGs). The game code is original. Public text does not use anyone else's title.

## Run locally

From the repo root:

```bash
python3 -m http.server 8765
```

Open `http://127.0.0.1:8765/iron-league/`.

## Verify

```bash
for f in iron-league/js/*.js; do node --check "$f"; done
node iron-league/tools/sim.js
python3 iron-league/tools/smoke.py
```

`smoke.py` drives the real page in headless Chromium (desktop 1280×800 and phone 430×932): title, create a captain, fight once, skip to a result, reload, continue. It needs `playwright==1.56.0` when the image expects that pin.

## What a match is

Classes decide the kit, not the costume. A weapon is a look.

- **Warrior** — walks in, alternates two melee cuts.
- **Archer** — keeps distance, fires a shot on the attack's hit frames.
- **Mage** — roots and fills a ground circle, then the circle pays out.
- **Tank** — more health, slower, sometimes raises a guard.
- **Rogue** — dashes in, then a short cut.

Win gold and xp. Lose a smaller purse. Hire costs 70 gold. A season is five matches against generated clubs; the other fixtures on the board resolve on their own. After the fifth, open another season with the same roster.

## Not in this build

Tactics slates, direct captain control, a wider armory, and cup runs are left for later. See the clip table in `ANIM.md` for jumps, rolls, and the second cast, which the pit does not use yet.
