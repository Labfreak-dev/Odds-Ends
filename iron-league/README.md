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

`smoke.py` launches Google Chrome when it is installed and falls back to Playwright's bundled Chromium otherwise.

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

Each fighter has a personality (Bold, Wary, Patient) and a tactic you set on the hub: Strike, Cover, or Hold. On the club hub, the party and the bench are separate. A match card shows who walks in against the next opponent before you send them in. The next match takes as many as that round allows, in the order you chose, and the list stays in the save. Gold, renown, cup tokens, and equipped relics sit in the header. The hub is tabbed — Club, Team, Market, Cup, Relics, Events, Train — and keys 1–7 switch them. Panels, buttons, tabs, and bars use Wenrexa's painted frames, scaled smooth. Each club shows a white emblem, unmodified, on a coloured plate. The Club tab shows the lineup, the roster, and the record together. Arena fighters stay Time Fantasy battlers. There are more than twenty classes. Each kit keeps a pool of eight abilities. A fighter equips three of them. A new recruit keeps the signature and may carry a second version of one other move, so two fighters of one class do not start on the same three. An older save keeps the three it already equipped. Each fighter keeps one attack style (a melee combo, a ranged shot, or a spell bolt) and one passive. Levels 4, 7, and 10 offer a new move, and tomes from the stall or a drop teach the rest. Two fighters who share a trait — Arcane, Guardian, Blade, Mark, Wild, or Oath — show that synergy on the hub and on the versus card. Rival clubs send a themed roster. A fighter's portrait opens their sheet: stats, abilities, relics, and record. Weapon, armor, and trinket slots take gear from the armory; the sheet shows green and red stat changes before you confirm. Each piece names a frame in the packed icon atlas under `assets/icons/`. A glyph tile shows only if that atlas does not load. Header coins, ability rows, and the loot chest use the same sheet. Credits names the artists. A finished season opens a ceremony: standings, awards, and the next season with a slightly tougher field. The club tab keeps achievements, including goals for rival wins, paired relics, a woken set, endless waves, and the weekly event. The record section changes the club emblem and the plate color; an older save keeps the plate that already matches its crest until that color is chosen. The record lists the club's match wins and losses, top fighters, and the moves that dealt the most. Older saves start damage and healing from the season already stored on each fighter. One club is your rival. They return every season, the record names them, and a loss to them raises a grudge. Beating them while that grudge is up pays a little extra gold. Levels 3, 6, and 9 offer one of three perks, saved on that fighter. Matches and cup wins drop a piece, the market stall rotates after each league match, and a benched fighter can drill for xp twice a day. Send them in opens a versus card first. The pit remembers 1×, 2×, or 3×, and can pause. Hits, crits, and the result sting follow the sound and music sliders. The result lists damage, healing, KOs, and an MVP, and the club keeps the last ten. A Settings gear in the header holds fight speed, screen shake, and a reset. The button name is Settings. Fight a friend sits on the Events tab. Every third level offers a stat step: health, damage, and either speed or defense.

The market stalls are Gear, Fighters, Relics, Deals, and Sell. A board of recruits keeps distinct faces, and a recruit does not reuse a first name already on the club. A rival squad does the same with its three fighters. Tomes sit on the gear stall. Fighters show a rarity, a specialty, and a trait. Selling pays for level and for the gear they wore, and those pieces go back to the bag. Deals turn over each week: a discounted legendary, a relic bundle, a mystery chest, a piece of gear, and a tome, each with one in stock. A reroll spends gold. Renown unlocks kits. Cup tokens enter a four-club bracket. A finished season keeps the roster and pays a relic. The chest holds more than sixty relics, each with a rarity. The Relics tab is a dense icon grid; a tap opens the effect, the set progress, and equip or sell. Two club relics ride with everyone you field, and each fighter can wear one more. Eight sets wake a bonus when two of their pieces are active. Chaos pit is a three-club free-for-all.

Anyone can roll to evade a swing, an arrow, or a filling circle. The roll has a short invulnerable window and a cooldown. The pit is a fixed 16:9 floor, shown whole, with no zoom onto the action. A fighter is about a twelfth of that floor's short side, drawn at 1× on a phone and 1.5× or 2× on a desktop, nearest-neighbour, never smaller than the sheet. On a tall phone the same floor turns so the clubs start at the top and the bottom; a wide phone keeps the landscape floor. Squads spawn at the far edges, and ranged fighters hang back while melee meet in the middle. Each theme keeps a textured floor and a thin rim. The frozen ring stays a mid blue so the battlers read. Over a fighter there is a short health bar and a small status mark. The name is on the roster strip, and on the fighter you tap or hover. Damage numbers stay small. A cast darkens the frame only for a short, light moment.

Each class shows its attack and its three equipped moves with their own motion: a swing, a shot, a bolt, a ring, a beam, a dash, a leap, a summon, or a shield. A chant fills a thin cast bar. The move's name stays on the roster and in the result. The third move, the ultimate, still plays its banner across the pit. `?debug=classes` walks every class through those moves. A Meter button during the fight lists damage, and the result names each move that landed. Battlers are drawn larger, and a melee fighter holds at weapon reach instead of standing inside the other sprite. Pixel effects (slash, ember, cast sigil, shield ring, dash crack, roll smoke, arrow glint, lightning) live in `assets/fx/` as horizontal frame strips. A short set of signature strips sits with them. The full BitFX packs are not copied into this game. Procedural strokes still draw underneath, and they stand in if a sheet fails to load. Each class has a signature move: a projectile trail, a ground ring, a chain, a summon sigil, a shield, or a dust burst, with a matching sound. The result still names that move when it deals or heals.

Win gold, renown, and xp. Lose a smaller purse. A season is five matches against generated clubs; the other fixtures on the board resolve on their own. After the fifth, open another season with the same roster.

The save key is still `ironleague.v1`. Older saves gain renown, tokens, relics, gear slots, an empty armory, and a club crest without wiping the roster. The save stamps schema 2 on load. A new club can skip a short first visit. Settings opens Fight a friend, and a Report a bug button copies a short report. The title screen opens on a dim sand pit. On a phone two battlers stand in the ring, facing each other; a wider screen lines up two against two. A What's new list covers the build. Event fights and the daily challenge carry a pit event — fog, a fire floor, a gold rush, sudden death, or giant mode. The fight opens with a banner that names the event and what it does. Endless still changes the pit every fifth wave, through a longer list. Fight a friend on the Events tab copies the fielded party (the button reads Copied), accepts a pasted code, and can paste from the clipboard when the browser allows it. A bad code says what is wrong. The result names the friend's club.

## Captain control, behavior, and stamina (v59)

**Steer the captain.** The versus card asks *Watch · auto* or *Steer the captain*, and the pit's **Control** button (or `C`) switches mid-fight. The steered fighter wears a gold ring; their target wears a red bracket. WASD or the arrows move, or tap the floor to walk there. Tap a foe to hunt them; on the way the fighter still swings at anyone already in reach. `Q`, `E`, `R` (or `1`–`3`, or the buttons on the ability bar) queue the equipped moves; a queued move walks into range and fires, or says *not yet* if it cannot. `Space` rolls, `Tab` swaps to another fighter on your side. If the steered fighter falls, control passes to the next one standing. Basic attacks fire on their own when you stand still in range. **Skip** hands control back to the AI. On a turned phone floor the keys follow the screen, not the world. The engine reads intent from `match.pilot`; with no pilot a match is the same pure autobattle the sim checks.

**Behavior.** The fighter sheet keeps the Strike / Cover / Hold tactic and adds five rows under *Behavior*: Target (Nearest, Weakest, Backline, Biggest, Captain's), Spacing (Class, Close, Far), Ultimate (When ready, On a crowd, To finish), Fall back (Never, Under 30%, Under 50%), and Rolls (Normal, Often, Rarely). The first chip on each row is the old AI, so an untouched fighter fights exactly as before. A held ultimate still fires late in the match. Behavior travels in Fight a friend codes.

**Stamina.** League and cup matches cost each fielded fighter 20 stamina and rest everyone on the bench by 34. Above half nothing changes; below half health and damage slide to at most −12% at empty. Cards, the sheet, and your versus cards show *Fresh*, *Ready*, *Tired*, or *Spent*. A new season starts everyone fresh. Events, endless, and the daily cost nothing.

## Watchlist and draft cup (v60)

**Watchlist.** The fighter board on the Market tab now turns over for free after every league and cup match. A **☆ Watch** button on each recruit keeps up to three of them on the board through a turnover or a paid refresh. Each turnover a watched price drifts between about −18% and +16% of what they first asked (an arrow on the card shows which way), and there is a 14% chance another club signs them first. **Scout for** picks a class: when a turnover does not already show one, the scout adds one a little under half the time (behind its renown gate if it is still locked). The result screen and the board list what changed. Hiring off the watchlist counts toward the *Patient eye* achievement.

**Draft cup.** It sits under the cup on the Cup tab and costs 40 gold. Your roster stays home. You pick three mercenaries one at a time from offers of three distinct classes. Every class is open, including ones renown has not unlocked yet. Picks come at the average level of your three best fighters, and a class you already drafted is not offered again. One reroll is free. Three other clubs draft at the same level, then a four-club 3 vs 3 bracket plays on the cup's tree. Picks do not tire or pay stamina. Rewards: 20 gold and 3 renown for a semi loss, 18 and 4 for a semi win, 45 and 8 for losing the final, and 80 and 14 for the title. A champion signs one of the three for free (they arrive fresh) or lets them all go. *Draft champion* is an achievement.

## The pit and the way to it (v61)

**Pit.** The floor scales in quarter steps: 1.75× on a 1280×800 or 1366×768 laptop (it was 1.5×), 2.5× at 1920×1080. A short landscape phone drops under 1× instead of cropping the walls. Both clubs and every fighter's health share one header, with the timer in the middle. Fighters who are down dim. The toolbar groups speed (1× 2× 3×) on the left, **Control** in the middle (gold while you steer), and Meter / Pause / Skip on the right.

**Hub.** The Club tab opens on a *next match* card: the fixture, the opponent's crest, both lineups, and a large **Fight** button with how many are ready. *Also open* chips under it point at a waiting cup tie, a draft step, the weekly event, the daily, or an endless run. Every other tab keeps a slim fight bar at the bottom (`#dockFight`). The Cup tab is now **Compete**: league and chaos pit cards on top, then the cup, then the draft cup. The chaos pit left the header. The versus card lists fighters as rows, so both lineups and the power bar fit on a laptop. The action bar reads **Back · Auto | Steer · Fight**, and Fight is the wide one.

## Not in this build

Clip usage is in `ANIM.md`.
