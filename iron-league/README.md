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

## Level ups, rewards, and the club screen (v62)

**Level up.** Each level gained queues one pick (`pendingLevels`). The level-up screen shows the fighter, their stats, and their three equipped moves with ranks, then three cards:
- **Rank up**: a move the fighter can use goes up a rank, I to V. Each rank adds +8% power (damage and healing) and −6% cooldown. The card shows power and cooldown before and after.
- **New move**: a move from the class pool they do not know yet, with its cooldown, tags, and row. It drops into an open slot, or the next screen offers slots 1–3 to replace (or keep the loadout).
- **Training**: health, attack, speed, or defense, showing the stat before and after.

The offer is seeded by fighter and picks taken, so a reload shows the same three. *Decide later* keeps the pick. Older saves fold any waiting stat picks and level moves into the same queue. The fighter sheet gains a **Level up** button, rank numerals on its loadout, and a growth log. Every level still raises health and attack a little on its own. Focus at 5 and mastery at 10 are unchanged.

**Reward screen.** A Victory or Defeat hero shows the mode, both crests, and the KO score. Under it sit tiles for gold, renown, xp each, and the loot find. A level-up strip names who has picks waiting. Each fighter gets a card with bars for damage dealt, damage taken, healing, KOs, the moves that landed, and an xp bar. Stamina, market, and who-stood lines fold into *Match notes*. The way on is **Level up · N** (when picks wait) or **Continue**. The season ceremony uses the same hero and tiles, and the yard relic claim sits in a tile.

**Club screen.** The top-left emblem (with a pencil) opens a *Name and colors* popup: rename the club (a rival's name is refused), and pick emblem and plate. The Club tab no longer carries the color picker. Credits, Back to the title, and Name and colors live at the top of Settings. The Club pane shows one view at a time: Standings, Record, History, or Goals.

## Fight menu (v63)

The Club tab no longer opens on a big match card. A slim **Fight** bar shows the fixture, the opponent, and how many other fights are waiting. **Fight** (`#nextMatch`), and the fight bar on every other tab, open a **Ready to fight?** popup. It holds the next league match with synergy and both lineups (class and level), a **To the pit** button (`#fightGo`) that opens the versus card, and an *Also open* list. That list has a waiting cup tie, a draft step, the weekly event, the daily, an endless run, and the chaos pit. Escape or Close dismisses it. On a phone the Club and Team tabs scroll as one page, so the roster, the bench, and the club pane are all reachable.

## Painted pits, combat effects, and level up v2 (v64)

**Fight controls.** Speeds are 1× and 1.5× (`#speed1`, `#speed15`). An older save that stored 2× or 3× plays at 1.5×. Skip is gone from the pit. Tools finish a fight with `IL.finishNow()`. *Meter* is now **Info**.

**Over the heads.** Every fighter carries an Eslabong-style health bar in screen pixels: green for your side and red for theirs, a level badge, a tick every 100 health, a pale strip that trails recent damage, a shield line, and status dots. There is no cast or cooldown bar. The header keeps one bar per club. Damage numbers draw in screen space too, so a turned phone floor no longer mirrors them. They pop and rise, crits are larger and gold with a `!`, heals are green, and numbers that land together stack instead of overprinting.

**Arenas.** Each of the five pits is painted once per screen size at device resolution and copied 1:1 each frame. The painting has tiered stands with a seated crowd and awnings, stone walls with banners and corner towers, a detailed floor (raked sand, frost tiles with cracks, basalt plates on glowing seams, wet cobbles, mossy flagstones), and a shared inlaid seal. Firelight pools, flames (BitFX fire), and drifting motes (dust, snow, embers, fireflies, leaves) animate on top. This runs faster than the old per-frame painter.

**Hits.** The sim emits `swing`, `hit`, and `die` events, which are visual only. The renderer draws swing crescents (thrusts for spears), spark bursts along the hit direction, an impact flash, shock rings on crits, and a dust puff and wisp on a knockout. Arrows are vector shafts at sprite scale with a streak. Spells are glowing orbs with trails. Casts paint a perspective rune on the ground in the school's color, with a progress sweep and a channel from the caster's hands.

**Level up v2.** Following Eslabong's stat rolls and tiered skill offers, each pick has two parts:
- A **stat roll** of two points weighted by the fighter's **growth style** (Balanced, Bruiser, Striker, Swift, or Bulwark). One point is +2.5% health, +2.5% attack, +0.5 defense, or +1.5% speed.
- A **skill** from three cards rolled Common 62%, Rare 28%, Epic 9%, Legendary 1%:
  - **New move**: a move from the class pool.
  - **Specialization**: one per move. Swift (shorter cooldown), Heavy (more power), Vampiric (heals from its damage), Chilling (slows), Searing (burns), or Sundering (the target takes more damage).
  - **Talent**, kept for good: Keen Eye, Iron Hide, Vigor, Thorns, Bloodlust, or Fleet.

Rarity sets the size of the bonus. The stat roll and the skill offer each reroll for gold, and the price rises with level. Growth style shows on recruit cards and the sheet. Rank-ups and training steps are no longer offered. Ranks and boosts that older saves already earned still apply.

## Rebalance and sound (v65)

**Divisions.** There are five tiers: Sand, Iron, Bronze, Silver, and Crown. At the end of a season the top two clubs go up and the bottom two go down. A tier sets the lowest level a rival can be (1, 4, 8, 12, 16), how well rivals are dressed (more pieces, from better bags), and the size of every league and season purse (×1 to ×2.2). The header and standings name the division. The table marks the up and down places. The ceremony says where the club goes next. An existing save is seated by the level of its three best fighters.

**Rivals match you.** League and cup rivals spawn at the club's level (the mean of the three best fighters), one level either way, and never under the division floor. They also take real level-ups. Every level gives them a stat roll and one skill card (move, specialization, or talent), picked by their own seeded hand. In the sim, two grown level-10 trios split their fights, and one level up wins about two in three.

**Slower levels.** Level L to L+1 now costs 40 × L^1.2 xp (40, 92, 150, 211, 276 …), where it used to be a flat 40. An older save converts once. Every fighter keeps their level and the share of it already earned. A flatter per-level stat curve (5% health and 4% attack instead of 8% and 6%) was tried and dropped, because it pushed supports and hard hitters out of the class win band. The slower xp curve and matched rivals do that job instead.

**Sound.** `fight_loop` and `endless_loop` carried a hard hi-hat transient on every beat (61 and 133 clicks a loop). Both are filtered and re-encoded seamlessly, and now measure one click each. Every effect fades in over 4 ms and out over 30 ms, so nothing starts or stops on a pop. Each category (hits, swings, shots, spells) keeps a short gap, at most seven effects sound at once, and the effects bus has a soft top-end roll-off and limiter. The roll whoosh, which fired dozens of times a fight, is gone. Audio URLs carry `?v=65` so a browser fetches the new files.

## Pace (v66)

Fights ran too fast. A melee fighter swung about every 0.7 s, crossed the floor in four seconds, and rolled eight times a minute. Eslabong's basic attack sits on about a one-second cooldown. One `PACE` block at the top of `arena.js` now sets the tempo:

| Knob | Was | Now |
|---|---|---|
| Walk and run speed | kit speed | ×0.7 |
| Recovery after a melee swing | 0.18 s | 0.62 s (a swing about every 1.1–1.5 s) |
| Recovery after a shot | 0.55 s | 1.0 s |
| Recovery after a cast | 1.15 s | 1.5 s |
| Every move's cooldown | ×1 | ×1.2 |
| Roll cooldown | 2.7 s | 4.2 s |
| Share of threats that get a roll | 80% | 55% |
| Dash speed | 430 | 344 |

The fight clock cap rose from 46 s to 62 s (46 s for chaos, 105 s for boss, horde, and king) so slower fights still finish. Class win bands and the grown-rival balance checks still pass.

## Slower on screen (v67)

v66 made actions rarer; on screen fighters still moved and animated at full speed. v67 slows the clock itself: `PACE.tempo` (0.8) is how many sim seconds play per real second at 1×. Walking, swings, cast wind-ups, rolls, dashes, projectiles and the sprite animations all play 20% slower, and 1.5× plays at 1.2× the sim clock. Damage numbers and impact sparks age in real time, so hits stay punchy.

Slowing walk, turning and casts inside the sim instead was tried and dropped: druid and summoner fell out of the class win band. The clock only touches the live view, so every balance number is the sim's, unchanged from v66.

On screen at 1× compared with v65: walking speed is about 56% of what it was, and every swing, cast and roll animation takes 25% longer.

## Not in this build

Clip usage is in `ANIM.md`.
