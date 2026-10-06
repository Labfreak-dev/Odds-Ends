# Iron League

A mercenary club and a pit. Hire a roster, send a squad of one to three into a real-time autobattle, and play a five-match season. Fighters are Time Fantasy side-view battlers, packed into `assets/timefantasy/`.

Play: https://labfreak-dev.github.io/Odds-Ends/iron-league/

No build step. `index.html` loads the classic scripts in order.

| File | What it is |
|---|---|
| `index.html` | Page shell. |
| `css/game.css` | Layout for the title, creator, club hub, and pit. |
| `js/data.js` | Classes, clip timing, names, hire price, seeded RNG. No DOM. |
| `js/meta.js` | Renown gates, market, relics, cup bracket, save migration. No DOM. |
| `js/hero.js` | Battler sheets, foot anchor, clip-to-motion draw. One atlas per sheet id. |
| `js/arena.js` | The fight. `createMatch` / `stepMatch`, no DOM. |
| `js/fx.js` | Pixel FX strips in `assets/fx/`. Frame advance, additive draw. |
| `js/render.js` | Canvas: wide pit, camera, sprites, FX, shots, bars. |
| `js/game.js` | Title, creator, hub, season, save, fight loop. |
| `ANIM.md` | Time Fantasy sheet layout, and the clip table. |

The save key is `ironleague.v1` in `localStorage`.

The Train tab holds six drills (Strength, Footwork, Archery, Arcana, Endurance, Tactics), tasks that grant specialty points, a focus at level 5, a mastery at level 10, and three facilities that add drills, xp, or a lower price. Party synergy sits on the match card so the chips stay inside the club panel.

The Events tab rotates one special fight each week: a phased boss, a five-fight gauntlet with no healing, a horde, King of the Pit, or a mirror of your own party. Endless climbs in waves, with a modifier and a relic pick every fifth wave, and keeps a best-wave list on this device. The daily challenge is the same seeded fight until the day turns. A hire or buy that cannot go through says why.

Battler sheets are packed from Time Fantasy side-view singleframes (48×48, three frames a motion). The game code is original. Public text does not use anyone else's title. The older layered sheets in `assets/heroes99/` are unused.

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
python3 iron-league/tools/check-clothes.py # battler sheets, bow and gun columns
python3 iron-league/tools/smoke.py
```

`smoke.py` drives the real page in headless Chromium (desktop 1280×800 and phone 430×932): title, create a captain, fight once, skip to a result, reload, continue. It needs `playwright==1.56.0` when the image expects that pin.

## What a match is

Classes decide the kit. The costume is a battler sheet from that class's pool: the creator and the market pick one, and Archer and Ranger shoot with the bow frames. Fifteen kits. The first five are free. Renown from wins opens the rest on the market.

- **Warrior** — cleave, then a leaping swing.
- **Archer** — a shot, sometimes a multishot.
- **Mage** — frost nova, then a fireball.
- **Tank** — taunt, then a guard.
- **Rogue** — bleed and a shadowstep.
- **Lancer, Skirmisher, Healer, Shieldbearer** — 15 renown.
- **Berserker, Ranger, Battlemage** — 40 renown.
- **Assassin, Duelist, Elementalist** — 70 renown.

Each fighter has a personality (Bold, Wary, Patient) and a tactic you set on the hub: Strike, Cover, or Hold. On the club hub, the party and the bench are separate. A match card shows who walks in against the next opponent before you send them in. The next match takes as many as that round allows, in the order you chose, and the list stays in the save. Gold, renown, cup tokens, and equipped relics sit in the header. The hub is tabbed — Club, Team, Market, Cup, Relics, Events, Train — and keys 1–7 switch them. Panels, buttons, tabs, and bars use Wenrexa's painted frames, scaled smooth. Each club shows a white emblem, unmodified, on a coloured plate. The Club tab opens on a yard of Time Elements chibis. Arena fighters stay Time Fantasy battlers. There are more than twenty classes. Each kit keeps a pool of six to eight abilities. A fighter equips three of them, keeps one attack style (a melee combo, a ranged shot, or a spell bolt) and one passive. Levels 4, 7, and 10 offer a new move, and tomes from the stall or a drop teach the rest. Two fighters who share a trait — Arcane, Guardian, Blade, Mark, Wild, or Oath — show that synergy on the hub and on the versus card. Rival clubs send a themed roster. A fighter's portrait opens their sheet: stats, abilities, relics, and record. Weapon, armor, and trinket slots take gear from the armory; the sheet shows green and red stat changes before you confirm. Each piece names a frame in the packed icon atlas under `assets/icons/`. A glyph tile shows only if that atlas does not load. Header coins, ability rows, and the loot chest use the same sheet. Credits names the artists. A finished season opens a ceremony: standings, awards, and the next season with a slightly tougher yard. The club tab keeps achievements. Levels 3, 6, and 9 offer one of three perks, saved on that fighter. Matches and cup wins drop a piece, the market stall rotates after each league match, and a benched fighter can drill for xp twice a day. Send them in opens a versus card first. The pit remembers 1×, 2×, or 3×, and can pause. Hits, crits, and the result sting follow the sound and music sliders. The result lists damage, healing, KOs, and an MVP, and the club keeps the last ten. A gear in the header holds fight speed, screen shake, and a reset. Every third level offers a stat step: health, damage, and either speed or defense.

The market stalls are Gear, Fighters, Relics, Deals, and Sell. Tomes sit on the gear stall. Fighters show a rarity, a specialty, and a trait. Selling pays for level and for the gear they wore, and those pieces go back to the bag. Deals turn over each week: a discounted legendary, a relic bundle, and a mystery chest, each with one in stock. A reroll spends gold. Renown unlocks kits. Cup tokens enter a four-club bracket. A finished season keeps the roster and pays a relic. The chest holds more than sixty relics, each with a rarity. The Relics tab is a dense icon grid; a tap opens the effect, the set progress, and equip or sell. Two club relics ride with everyone you field, and each fighter can wear one more. Eight sets wake a bonus when two of their pieces are active. Chaos pit is a three-club free-for-all.

Anyone can roll to evade a swing, an arrow, or a filling circle. The roll has a short invulnerable window and a cooldown. The pit is larger than the screen; the camera eases toward the squads.

Each class shows its attack and its three equipped moves with their own motion: a swing, a shot, a bolt, a ring, a beam, a dash, a leap, a summon, or a shield. The move's name pops over the caster. A chant fills a cast bar. The third move, the ultimate, puts that name on a short banner. `?debug=classes` walks every class through those moves. A Meter button during the fight lists damage, and the result names each move that landed. Battlers are drawn larger, and a melee fighter holds at weapon reach instead of standing inside the other sprite. Pixel effects (slash, ember, cast sigil, shield ring, dash crack, roll smoke, arrow glint, lightning) live in `assets/fx/` as horizontal frame strips. The full BitFX packs are not copied into this game. Procedural strokes still draw underneath, and they stand in if a sheet fails to load.

Win gold, renown, and xp. Lose a smaller purse. A season is five matches against generated clubs; the other fixtures on the board resolve on their own. After the fifth, open another season with the same roster.

The save key is still `ironleague.v1`. Older saves gain renown, tokens, relics, gear slots, an empty armory, and a club crest without wiping the roster. The save stamps schema 2 on load. A new club can skip a short first visit. Settings copies a challenge code of the fielded party, and a bug report, for a friend to paste and fight.

## Not in this build

Direct captain control is left for later. Clip usage is in `ANIM.md`.
