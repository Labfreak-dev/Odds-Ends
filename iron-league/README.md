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
python3 iron-league/tools/clipaudit.py      # text that does not fit, 4 widths
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

## Pixel hits (v68)

The v64 effects drew every cast as stacked flat ellipse rings (the rune, the boom rings, the signature rings) with boxed sprite strips on top. v68 replaces all of it with `js/pfx.js`, modeled on Eslabong's Steam footage:

| Moment | Look |
|---|---|
| Melee hit | Chunky red pixels sprayed along the blow, falling to the floor; a few white sparks; the target blinks pure white |
| Crit | A bigger, faster spray and an orange flash |
| Blocked | Cold steel sparks thrown back |
| Swing | One thin white crescent (a jab line for spears) |
| Fire spell | A bright bloom, embers and smoke, then a scorch crater that cools over 4 s |
| Lightning | A jagged bolt dropped from the sky, flickering, with a small burn mark |
| Ice | Shards, one thin ring, a faint frost patch |
| Nova / thorns | Radial blades flying out of the point |
| Heal / buff | Green or gold plus signs rising |
| Chain bolt | A jagged arc between the two fighters |
| Dash / roll / leap | Fading afterimages and pixel dust |
| Death | A big blood burst, dust, and a stain left on the floor |
| Cast wind-up | One thin circle on the floor (blue for yours, red for theirs) with a white sweep filling as the chant runs |

Every effect is anchored to a floor point plus a screen-space offset, so "up" is up on a turned phone floor too. `fx.js` still loads but no longer spawns strips in the pit. Draw cost stays under 5 ms at the 95th percentile while flooding the pit with effects.

## Clearer fights (v69)

- **Team rings** under every fighter: green for yours, red for theirs. Shadows and rings turn with the phone floor.
- **Calmer floor**: the baked pit art gets a 36% wash of its own base color, so cracks and the center circle read as texture, not as attacks.
- **Overheads**: the level badge is gone (levels live in Info). Bars that would overlap in a clump step up a row. Status effects are drawn as glyphs: stun stars, slow snowflake, bleed drop, buff arrow, rage flame, vulnerable cracked shield.
- **Ability pop**: when a fighter uses a real move, its icon pops over their head with a thin bar (cast progress while chanting), like Eslabong. Basic attacks show nothing.
- **Wind-up glint**: a star gathers on the weapon before each swing lands.
- **Kill feed**: top left of the floor, killer then fallen, in team colors.
- **Kill beat**: a kill slows the live view to 35% for 0.38 s and shakes the pit. Only the view clock changes; the sim does not.
- **Damage numbers**: a little larger; crits are orange with "!".
- **No camera zoom**: Eslabong keeps the whole arena in view, so Iron League does too.

## Forged-plate buttons (v117)

Every button in the game now uses one custom CSS style: a plate with cut corners, a 1px metal rim that follows the cuts, a lit top edge and a soft lower shade. The buttons used to be stretched PNG frames (`assets/ui/buttons/*`). Those smeared at most widths, grew spiky arrow ends whose shape changed with the label, and gave Skip, Fight and Next Match three different outlines. Next to them sat a second, flat style for Menu, Daily, Events and the chips.

- **One build:**
  - The rim is the button's own background.
  - The face is a `::before` layer inset 1px and cut the same way.
  - The colours come from CSS variables (`--plate-rim`, `--plate-f1..3`, `--plate-ink`, `--plate-rivet`), so each variant is only a few lines.
- **Variants:**
  - ghost: dark iron;
  - primary: copper;
  - gold, and the "on" state: gold leaf;
  - **fight:** an ember plate, uppercase, with a deeper cut;
  - danger: oxblood.
  
  Only Fight and the big Next Match button carry rivets.
- **The small controls** use the same plate with a 5px cut: chips, the segmented `.ctl` controls, sub-tabs, the dock's Daily and Events, Menu and Later.
- **States:** hover brightens the plate and press sinks it 1px. Keyboard focus lights the rim, because an outline would be clipped away. Disabled turns the plate to dull, unlit iron.
- **Badges** (the Events count and the filter counts) now sit inside their plate, because the cut corners would clip anything hanging outside.
- **Tests:** `smoke.py` now checks that the Fight button is a forged plate rather than a 9-slice image. Since v116 made rolls rare, the smoke tour uses a test-only `IL._roll` hook to ask for one, so the roll animation still has to draw.

## Combat engine (v116)

This batch comes from a 12-minute recording of Eslabong that the playtester sent: four fights, studied frame by frame. Eslabong's camera is as far out as ours. The difference is in the fight itself. One clash there pops about 20 small numbers in two seconds, and the front lines pile into one moving knot within two seconds of the start. Ours landed about 2 hits a second across all ten fighters, and they wandered. A headless probe ran 12 seeded 5v5 fights before and after the change:

| | v115 | v116 |
|---|---|---|
| Hits a second, whole pit | 1.85 | 3.96 |
| Target switches a second, per fighter | 0.55 | 0.19 |
| Melee fighters in reach of a foe | 35% | 45% |
| Tanks in reach of a foe | 20% | 28% |
| Tank's first contact | 11.9 s | 5.8 s |
| Fight length | 48 s | 31 s |

- **Faster attacks, lighter basic hits.** Swing animations play 1.7× faster. Recovery after a melee swing drops from 0.62 s to 0.12 s, after a shot from 1.0 s to 0.38 s, and after a cast from 1.5 s to 0.6 s. Basic attacks and summons' swings deal half damage each to keep the pace fair. Abilities keep their full weight and cool down 30% sooner.
- **Commitment.** A fighter keeps its target for 3 s unless it dies, a taunt calls, or another foe is right on top of it. A front-liner fights whoever is already in its face instead of running past them.
- **The scrum.** Foes may press into each other, so bodies overlap the way Eslabong's do. Zone of control halves the walk of anyone with an enemy melee fighter in their face, so a chaser that arrives can pin its target.
- **No more dancing.** Normal hits shove 4 px instead of 11. Front-liners walk through arrows and only roll from big marked spells. Tanks stop blocking on the approach. Archers backpedal at 70% speed and stand their ground when pinned to a wall. Healers hover behind their own front line instead of at the wall.
- **Feedback.** Only crits and heavy hits freeze the pit or shake the screen. Damage numbers live longer, rise less and pile up over a scrum. An ultimate's name floats over its caster, like any other call-out, instead of a bar across the whole pit.
- **From the playtester's transcript** ("10 things the game doesn't tell you"):
  - the stat choice is one shared quality roll (Poor, Fair, Good or Great), the same on every stat;
  - the bench always earns 10% of the lineup's match XP, and Barracks adds 15% a rank;
  - a fighter below the club average gains 8% more XP for each level behind, up to +60%;
  - auto-equip leaves locked relics where they are.
- **Balance.** Basic hits deal 60% of their old damage, and summons' swings 80%. Healing is up 30% to keep pace. In a scrum, each extra body caught by the same blast takes less: 100%, then 80%, 65% and 55%. Divers (the dash role) slip zone of control.
  - A per-class health and attack nudge (`RETUNE` in arena.js, 0.82 to 1.17) pulls each class back toward its v115 standing.
  - Class band, 80 fights a class: v115 ran 0.19–0.61, v116 runs 0.17–0.56.
  - Druid and summoner are the lowest (about 0.17 before a last buff). Healer and beastmaster are about 0.21. They get the next tuning pass.
  - The sim's own band check passes.
- `tools/visual_qa.py` flagged any body overlap over 30% held for 0.55 s. It now flags only a pile that holds for 6 s, because the scrum is deliberate.

## Club history and the Veteran profile (v115)

- **Intel → History**: the new pane holds:
  - your profile;
  - a **Season review** saved at every ceremony (finish, record, champion, MVP, top scorer, cups won, promotion or relegation, chest);
  - a **Cup history** that writes every Cup, Champions Cup, Thunder Cup and Draft Cup once, when it closes;
  - **all-time leaders** for kills, damage, healing, MVPs, season awards and matches. These count every fighter who ever played for the club, and anyone who has left is marked "gone".
- **Codex**: each class page now shows **stat ranges** at levels 1, 25 and 50, from a plain common recruit to a legendary with every grade Excellent. It also shows the **evolution** choices for each move.
- **Veteran profile**: reaching Season 15 marks the browser profile (`ironleague.profile`, kept apart from the save) as Veteran. From then on every class opens without renown and the whole Codex is revealed, in that save and every new one.
- The sim now fails if a script declares the same top-level function twice. While building this batch, a second `historyHtml` silently replaced the first.

## Club tools (v114)

- **Staff**: three new roles. The **Treasure Hunter** finds relics in chests 6% more often a star and cuts relic stall prices 4% a star. The **Legendary Expert** makes legendary recruits 20% more likely a star. The **Shiny Catcher** makes shiny recruits 10% more likely a star. Every hire also rolls one of eight **specializations**: Thrifty, Drillmaster, Restful, Appraiser, Negotiator, Lucky, Scholar or Bookkeeper. The Club House now goes to rank 4, for five staff slots.
- **Club Agenda**: the top of the Club tab lists what wants doing, and each line jumps to its screen. It covers empty staff slots, an understaffed academy, a ready academy fixture, unspent upgrades, masteries and respec picks, injuries, a tired lineup, an empty club relic slot, drills left this week and an open tournament.
- **Development Plans**: five standing orders that run after every league and cup week: spend move upgrades (lowest rank first), pick masteries by role, fill the academy, dress the party in relics, and heal the injured while 150 gold stays in the purse. **Run plans now** runs them at once. Evolutions and respec picks stay manual.
- **Relic tools** on the relic sheet: **Lock** (a locked relic cannot be sold or traded), **Reroll** (new numbers for 250 renown) and **Trade in** (40 renown buys a random unowned relic of the same rarity). Auto-equip and Unequip all were already there.
- Not copied: duplicate relics and an inventory cap. Here each relic is owned once, with one roll, so neither applies.

## New modes (v113)

All but the alliance cup and the free draft live in the new **Halls** pane on the Club tab.

- **Hall of Legends**: four handcrafted 4v4 challenges (Council of Leaders, The Gate Wardens, The Storm Choir, Hall of Blades), each at threat I, II or III. Foes are your club average + 2 + 3 a threat, with +15% strength a threat, and the Wardens are giants. Your four best healthy fighters go in, each spending 15 stamina. The first clear of a threat pays 120/240/360 gold and 18/36/54 renown.
- **Tournament Center**: a different 1v1 event every four league weeks (Front-line Open, Marksman's Cup, Spell Duel, Rookie Development Cup). Enter one eligible fighter for 30 gold and win three straight bouts. It pays 60 for a semi-final, 120 for the final and 240 + 30 renown to win.
- **Challenge Tower** (offline): a ladder of generated teams, fixed per floor, with both sides set to level 30. Your best three go in as copies (no stamina, XP or injuries). Your Elo-style rating starts at 1500, and each floor is rated 1400 + 30 a floor. A new best floor pays renown.
- **All-Star match**: once a season from week 14, your three highest-Impact fighters against the league's three highest-level rivals. Every appearance adds 100 gold to a fighter's market value.
- **Alliance Thunder**: the second Chaos Thunder Cup is now alliance rounds, 3+3 vs 3+3. Each round you team up with a different rival club, and the winning pair scores 2 points each.
- **Free draft**: from week 7, the draft cup is free once a season.

## Bigger league (v112)

- **Ten clubs, home and away**: 18 league weeks, up from 8 clubs and 14 weeks. The week sizes keep their 3-2-3-1-3-2-3 pattern. The MidCup now opens after week 9.
- **Draws**: a match between two other clubs is drawn 12% of the time, for 1 point each. Your own matches are best-of-three series and cannot draw. Tables show W-D-L and form shows D.
- **Disbanding**: when a season closes, the two bottom rival clubs (never a named team) disband. Their two best fighters go on the market (10% over value), they sit out the next season, and two newly founded clubs join the pool. The news goes to the market feed and the Club feed.

## New classes and champion moves (v111)

- **Three new classes**, each with 14 moves (3 starters, a twin, 4 more and 6 extras), a passive with set numbers, a champion, and existing art and weapons that fit:
  - **Templar** (tank, Oath, 40 renown): Sanctify, Smite Rush, Consecrate. *Vigil*: blocked hits do 34%, and the planted guard lasts 30% longer.
  - **Frost Knight** (melee, Blade, 25 renown): Rime Cleave, Frost Grip (a root), Glacier. *Frostbite*: +12% damage to slowed enemies, knockbacks 30% shorter.
  - **Witch Hunter** (bow, Mark, 55 renown): Silver Bolt, Hush Bolt (a silence), Purge (a homing shot). *Silver*: the first shot +25%, +5% range.

  The class band (100 fights each) puts them at 42%, 53% and 48%.
- **Champion moves**: every champion has a signature move of its own, its class's ultimate under the champion's name (e.g. "Brand's Purge"). It is an extra move on top of the three, fought at rank 4 (+24% power, -18% cooldown), and shows on the fighter sheet.

## Milestones, Respec and Rebirth (v110)

- **Ability upgrades**: one every 5 levels from 14 (14, 19 … 84). Pick an equipped move to rank up: +8% power and -6% cooldown a rank, to rank 5. Move ranks existed in the arena before but nothing raised them.
- **More masteries**: at 27, 37 … 97, on top of the level-10 one, stacking their stats.
- **Respec** (60 + 12 gold a level): clears a fighter's move upgrades and passives, then offers that many picks again from fresh cards.
- **Rebirth** (150 renown, +75 each time): re-rolls the growth grades.
- **Skipping**: an evolution can be skipped for good. Level-up picks could already be put off with "Later".
- **Rivals**: they claim their upgrades and masteries on their own.
- **Where to find it**: the fighter sheet, and Events flags a milestone to claim.

## Personalities and deeper tactics (v109)

- **Eleven personalities** (`PERSONAS` in `js/data.js`), each with a hidden mistake chance (Tactician 2% up to Reckless 25%, applied at a quarter), a roll threshold, a small combat passive and default tactics:
  - Tactician: abilities -4% cooldown.
  - Duelist: +4% crit.
  - Stoic: +2 DEF.
  - Hunter: +6% damage to foes under half health.
  - Guardian: +4% HP.
  - Opportunist: +5% crit.
  - Lone Wolf: +8% damage with no ally within 120 px.
  - Cautious: +5% HP.
  - Grudger: +8% damage to whoever hit them last.
  - Berserker: +6% ATK.
  - Reckless: +10% ATK, -2 DEF.

  New recruits roll one. Bold, Wary and Patient stay on older fighters. Until you set a behavior row, a fighter uses its personality's defaults.
- **Three new behavior rows**:
  - **Healing priority**: most wounded, front line, or damage dealers.
  - **Protect**: nobody, the captain, or the back line.
  - **Opening**: go, hold the start line for 2 s, or rush at +15% speed for 4 s.
- **Tactic presets**: save any fighter's behavior as one of five presets and apply it to another in one tap.
- **Balance**: Ranger rose from 53% to 70% with the new personalities (200 fights). HP 102 → 96 and ATK 16 → 15 bring it back to 54%.

## Transfers and loans (v108)

- **Rival rosters** on the Market lists every league club's four fighters.
  - **Buy**: 25% over market value. Named leaders are not for sale, and the club signs a replacement to stay at four.
  - **Swap**: pick one of your fighters (never the captain). 90% of its value counts against the price; you pay the rest. Your fighter's gear returns to the bag.
  - **Loan in**: a rival's bench fighter for 2 league weeks, for 12% of value. They go home when it ends, and any gear you gave them returns to the bag.
- **Loan out**: on the Sell pane, send a bench fighter to a random rival for 2 league weeks. You get 8% of their value a week up front, and they come back with 25 XP a week.
- **Guards**: a loaned-in fighter cannot be sold or released. Loans tick with the league week.

## Difficulty (v107)

- **Four levels** in Settings, changeable any time and applied from the next fight (`DIFFICULTY` in `js/meta.js`):
  - **Relaxed**: rivals -15% HP and ATK, your captain +15% in autobattle.
  - **Normal**: the game as balanced.
  - **Hard**: rivals +12%, matches pay +15% gold, three season modifiers.
  - **Infernus**: rivals +20% plus 4% threat a season (up to +60%), +30% gold, four season modifiers.
- **What it covers**: every fight but friend fights and the shared daily, including wave and boss adds.
- **Options**: *No champion signings* blocks hiring champions from the market and auctions, and stops champion approaches. *No season modifiers* starts the next season without any.

## Named rivals and smarter clubs (v106)

- **Named teams**: twelve handcrafted clubs (`NAMED_TEAMS` in `js/meta.js`), each with a leader, a style, fixed classes, a signature move or two, a formation and a named relic. Two take league places in the Sand Division and three from the Iron Division up. Some arrive only from a later season or a higher division. The leader is a champion and the rival captain, up to two levels higher (never past the rival level range), wearing the team's relic.
- **Benches**: every rival club now has four fighters. They field the freshest (stamina 50 or more first, the leader first, then by level), and their starters tire and their bench rests like yours.
- **Rival relics**: clubs wear club and fighter relics by division (legendaries from the Bronze Division up), and the relics work in the fight.
- **Rival preparations**: named teams, and every club from the Bronze Division up, read your last three league lineups. They dive your back line if half of it is casters, archers and supports, go for your healer if you always field one, or else spread out and keep away from your front line. They also pick a formation to match, mirrored on their side. The scouting report says what they prepared.

## Ability costs and friendly fire (v105)

- **Mana and stamina**: each fighter has a mana pool and a stamina pool of 100. Spells, items and skills spend mana; swings, thrusts, shots and dashes spend stamina. The cost is 6 + 1.6 × the cooldown (a 10 s move costs 22) and shows on every move card. Casters and supports refill 16 mana and 14 stamina a second, everyone else 12 and 18. A move with its cooldown ready still waits for the pool. A thin bar under the health bar shows the pool (blue mana, yellow stamina) while it is below full.
- **Friendly fire**: blast abilities (nova and frost kinds) also hit allies inside them for 40%. Friendly fire can never take an ally from above half health to dead, and a friendly kill credits nobody. Arc bursts and basic casts are exempt.
- **Friendly fire tactic** on the fighter sheet: Avoid (the default; hold a blast while an ally stands in it), Calculated (fire when more foes than allies are in it) or Natural (fire anyway). Results show a fighter's friendly-fire damage.
- **Balance**: the class band at level 7 is unchanged within noise. Arc was exempted after friendly fire cost Battlemage 10 points.

## Match series (v104)

- **Best of three**: league matches are a series, first to two round wins, after Eslabong's multi-round matches. Between rounds a break shows the series score and lets you change the formation. Health and cooldowns reset each round.
- **Results**: they cover the whole series. Damage, healing, K/D/A, Impact and per-move numbers add up across rounds, and the headline and match history show the series score (2–0, 2–1). Pay, XP, stamina and injuries are settled once, at the end.
- **Tests**: `IL.finishNow()` (tools only) now ends the whole series on the current round, and `IL.finishRound()` ends one round.

## Academy (v103)

- **Academy squad** on the Club tab: up to 4 fighters of level 20 or less (never the captain). They can still play for the first team.
- **Weekly fixture**: once a league week the best three healthy squad fighters play a 3v3 against a rival academy at their level (±1). It does not advance the week or cost stamina. It pays 75% of match XP (16 a win, 6 a loss), a small purse, and points in a six-club academy league that resets each season.
- **Development Tomes**: each academy win earns one. A tome lifts a fighter below the club average (the mean level of your top five) straight to it, with every level-up pick on the way. Two a season.

## Chaos Thunder Cup (v102)

- **Twice a season**: after league week 4 a 2v2v2v2 cup opens, and after week 10 a 3v3v3v3 one. You face three league rivals, levelled like league rivals. It shows on Matches · Cups, in the fight menu and in Events.
- **Format**: three free-for-all rounds in one pit. The last club standing places 1st, and the rest place by when they fell, last out highest (`IL.placings` in `js/arena.js`). Places score 3, 2, 1 and 0. Ties break on the sum of placings.
- **Pay**: each round pays 30, 18, 10 or 5 gold by place, times the division purse. The cup pays by final standing: 1st 180 gold, 30 renown and 40 XP; 2nd 100/18/26; 3rd 55/10/16; 4th 25/4/10. Winning counts as a cup won.
- The old one-off Chaos pit stays as is.

## Staff (v101)

- **Staff** on the Club tab. You can hire one of each role, with 1 to 5 stars, from a staff market of three that turns over after each league week:
  - **Trainer**: match XP +4% a star.
  - **Medic**: injury chance -1% a knockout and healing 8% cheaper, a star.
  - **Scout**: champion approaches +25% and auctions +20% more often, a star.
  - **Captain Coach**: the captain fights with +3% HP and ATK a star.
  - **Treasurer**: league and cup gold +4% a star.
- **Slots and cost**: one slot to start. The new **Club House** facility adds a slot a rank (up to three). Hiring the same role replaces the one you have, and the market flags a downgrade. Cost is 40 to 360 gold by stars, +10% a season (up to +100%). Letting someone go is free.

## Injuries (v100)

- **Injury risk**: each fighter has Low, Medium or High risk, shown on the sheet with the chance per knockout. New recruits roll it; older fighters get one from their id.
- **Injuries**: a fighter knocked out in a league, cup or Champions Cup match is injured on a roll: Low 6%, Medium 12%, High 20%, minus 3% per Medical Bay rank. An injury lasts 1 league week (60%), 2 (30%) or 3 (10%), and one week heals per league round.
- **Sitting out**: an injured fighter in the lineup sits out, and the best healthy bench fighter covers. With no one healthy left, the injured play hurt at 85% HP and ATK, so a lineup is never short.
- **Medical Bay**: heals an injury now for 45 gold a week left, times the division purse, 25% cheaper per rank. Use the sheet or the Events entry.
- **Where it shows**: a red ✚ badge on party cards, bench rows and the results screen. The Club feed logs injuries and recoveries. Settings has an Injuries switch; turning it off heals everyone.

## Live orders (v99)

- Four orders for your side during any two-team fight, after Eslabong's F1 to F4. Use the bar at the pit's top-left or the keys F1 to F4.
  - **Plan**: each fighter follows its own behavior (the default).
  - **Attack**: nobody falls back, and ranged fighters close in.
  - **Regroup**: gather on the captain (or the party's middle) and fight only what comes into reach.
  - **Hold**: hold the starting line and fight only what is in reach.
- Fighters still cast their moves while holding or regrouping. A piloted captain ignores orders. The order lasts until you change it (`IL.setOrder` in `js/arena.js`).

## Polish pass (v98)

The last batch of the Eslabong parity plan.

- **Area moves** tactic row on the fighter sheet, after Eslabong's AOE efficiency setting: 2 or more (the default and the old behavior), Anyone, or 3 or more. It applies to cleaves and blasts, and fires anyway once fewer foes are left.
- **Season Impact**: each fighter keeps season Impact, assists, deaths and games played. Intel adds boards for Top Impact, Impact a match and Top assists. Fighter of the week on the Overview shows the MVP's Impact.
- **Evolution marks**: an evolved move's loadout card carries a ★ tag with the evolution's name.
- **Relics**: Unequip all, beside Auto-equip.

## Menus: match preview and breakdown (v97)

Batch 6 of the Eslabong parity plan.

- **Formation**, picked on the versus screen and kept for the next fight. It sets where your party starts, which is also where it falls back to (`FORMATIONS` in `js/arena.js`):
  - Line: the usual rank.
  - Spearhead: the front line starts 52 px further forward.
  - Spread: twice the spacing, so area moves catch fewer of you.
  - Shield wall: a tight rank with the front line close in front of the back line.

  Two-team fights only.
- **Scouting report** on the versus screen: the rival's league place and record, your last three meetings, and each rival fighter's level, HP, ATK, DEF, equipped moves (★ marks an evolved move) and relics.
- **K/D/A and Impact** on the results screen. An assist is damage on the fallen enemy in the 6 s before the kill, or a heal or shield on the killer in that time. Impact is damage dealt + healing + 35% of damage taken + 60 a knockout + 30 an assist − 40 a death. MVP now goes to the highest Impact. The per-move line shows damage, healing and uses (×N). "Their side" opens the same numbers for the rival.
- **Saved lineups**: three slots (A, B, C) on the Party board. Each saves the lineup and its formation and loads both in one tap.
- **Feed filters** in Events: All, Results, Market and Club. The new Club feed logs level-ups, met season goals and evolutions. The feed now keeps the last 10 results.

## Abilities v2 (v96)

Batch 5 of the Eslabong parity plan.

- **Seven new mechanics** in the arena (`fireOne` in `js/arena.js`), each with its real numbers in the move text:
  - **Pull**: drags an enemy 90 to 280 px away to the caster, preferring a caster, archer or support, and holds them 0.3 s. Tank's Haul and Lancer's Hook now pull.
  - **Root**: the target cannot move but can still fight. Druid's Entangle (2.2 s) and Root, and Ranger's Root.
  - **Silence**: no abilities, and a spell being cast is cut off. Mage's Silence now silences for real; Bard has a new move, Hush.
  - **Chain**: Battlemage's new Chain Lightning hits the target, then jumps to 2 more enemies within 150 px, 25% weaker each jump.
  - **Drain**: deals damage and heals the caster for all of it. Warlock's Leech and Necromancer's Drain.
  - **Revive**: Healer's new Raise brings a fallen ally back once a fight, at 30% HP.
  - **Homing**: Mage's Seeking Bolt and Archer's Seeker Arrow turn to follow their target, and find a new one if it falls.
- **Evolutions**: at level 20, and again at 50, a fighter evolves one move, picking one of two new effects by the move's family:
  - melee: Rooting or Draining
  - spells: Arcing or Hushing
  - missiles: Rooting or Arcing
  - heals and shields: Lasting or Shared

  Pick them on the fighter sheet; Events flags a fighter with an evolution to spend. Rivals evolve on their own, and challenge codes carry evolutions.
- New status marks over the health bar for root and silence. Pull, drain and revive draw their own beams.
- Balance: Druid's Entangle went from a 38% slow to a 2.2 s root. Druid holds 32% in the class band (100 fights), the same as before.

## Relics v2 (v95)

Batch 4 of the Eslabong parity plan.

- **Exact text**: every relic states its real numbers ("The wearer: +17.4% max HP."). The arena and the text read one table, `relicNums` in `js/meta.js`, so they cannot drift apart.
- **Rolls**: each relic you own has a roll from 85% to 115% that scales its numbers, shown as a % tag on the tile, the popup and the stall. Selling and finding a relic again rolls it anew.
- **Two fighter slots**: a fighter wears one relic, and a second from level 10. Challenge codes carry both.
- **Named legendaries**: Phoenix Feather (once a fight, a killing blow leaves them at 35% HP, with a 0.8 s guard), Bloodvine Ring (heals 14.5% of damage dealt), Mirror Aegis (returns 20% of damage taken), Blink Stone (twice a fight, 8 s apart, when hit below 50% HP: blinks 150 px away and dodges for 0.6 s). Rare kin: Leech Tooth (lifesteal) and Bramble Mail (reflect).
- **Relics that grant a move**: Ember Idol (Flare), War Horn (Rally), Salve Bead (Salve), Ward Prism (Ward). The move is added on top of the wearer's three.
- **Weekly stall**: five relics, restocked after every league week. Unowned relics come first, and the first slot is always rare or better. Each shows its roll before you buy, and price follows the roll.
- **Auto-equip** on the Relics tab: the best club relics go into the club slots, then the fielded party is dressed by role (front line: health, armor, reflect, revive; back line: damage, crits, haste, blink).
- **Fix**: the Relics page scrolls again on every screen size. The v91 change had stopped the panel scrolling at all, and the smoke tour now checks that the last tile can be reached.

## Fighter rarity and hiring (v94)

Batch 3 of the Eslabong parity plan.

- **Growth grades**: every recruit rolls a grade per stat (HP, ATK, DEF, SPD): Balanced, Good (x1.3 growth per level) or Excellent (x1.6). Rarer fighters roll better (Good/Excellent odds: common 18%/4%, uncommon 25%/7%, rare 32%/12%, legendary 40%/20%; champions +10%/+8%). Defense grows +0.12 a level on Good and +0.24 on Excellent, speed +0.3% and +0.6%.
- **Potential**: 1 to 5 stars from rarity and grades, on the market row, the market detail and the fighter sheet. It raises market price (+8% a star).
- **Shiny**: 1 in 250 recruits. +20% HP and ATK, at least one Excellent grade, a ✦ mark, x1.5 price.
- **Champions with hybrid kits**: a champion also carries a second class's passive, at its set number, shown on the sheet.
- **Auctions**: now and then a star (a champion, or a shiny) goes to auction on the market for two league weeks. Rival clubs raise by 10%. Gold leaves only if you hold the top bid when it closes and have roster room.
- **Champion approaches**: about one week in eight a champion asks to join at 90% of value. Sign or decline under Action required; the offer lapses after two weeks.

## Seasons and rewards (v93)

Batch 2 of the Eslabong parity plan.

- **14 weeks**: the league plays home and away (the round robin, then the same weeks with sides swapped). The week sizes keep their 3-2-3-1-3-2-3 pattern.
- **MidCup**: after week 7 a free cup opens once a season in a random size (1v1, 2v2 or 3v3), on the calendar and in Events. It waits for a token cup already running. Winning pays 150 gold, 28 renown and 45 XP (the token cup: 90, 18, 30).
- **Season modifiers**: two a season from eleven (`SEASON_MODS` in `js/meta.js`), on every league, cup and Champions Cup match: Glass Shields (shields absorb 40% less), Vampiric Moon (hits heal 6%), Opening Rush (+25% damage for 10 s), Mana Storm (cooldowns -20%), Iron Season (+3 defense), Swift Feet (+12% speed), Short Fuse (sudden death at 30 s), Mercy (heals +25%), Keen Edges (+6% crit), Rich Purses (+30% league gold), Lean Year (-20% gold, +25% XP; never with Rich Purses). Shown on the Overview, in the header (desktop) and on the fight.
- **Season goals**: five a season from eight (top three, 8 league wins, the MidCup, 30 knockouts, 4 wins in a row, 10 fighter levels, reach the Champions Cup, 5 Iron Gate floors in a run), each paying gold and renown by division the moment it is met, with progress on the Overview.
- **Season chest** by finish (replaces the small purse): 1st 420 gold, 42 renown, three gear pieces and a relic; 2nd-3rd two pieces and a 50% relic; 4th-5th one piece; down to 80 gold for last, all times the division purse.
- **Awards** (MVP, Most KOs, Iron wall, Top healer) now pay half a level of XP and count on the fighter.

## Combat feel and smarter autobattle (v92)

Batch 1 of the Eslabong parity plan (ROADMAP.md).

- **Warnings**: a spell's floor circle is drawn at its real hit radius (it was 85%, smaller than what lands), fills from the centre as the cast completes and flashes white in the last quarter. A fighter about to cleave shows the ring it will hit; a charge shows a dashed path and arrowhead to its target; a caster has a cast bar under its health bar.
- **Targeting** (the default "Nearest" row): among enemies not much farther than the nearest, fighters prefer one the team is already hitting (focus fire, +34 each, up to two), one under 30% health (+46), one mid-cast (+34 for front-liners), and front-liners prefer an enemy on top of their own caster, archer or support (+60, peel). Summons come last.
- **Dodging**: a fighter standing in an enemy spell's circle walks out (the roll stays for late casts).
- **Area moves wait for a group**: cleave, nova, frost and arc hold while only one enemy is in the area and two or more are standing (an ultimate fires anyway after 20 s).
- **Interrupts**: stuns and knockbacks go to an enemy mid-cast when one is in reach.
- **Mistakes**: each pick or dodge has a small slip chance by personality (bold 2.5%, wary 1.25%, patient 0.75%), after Eslabong's hidden mistake chance.
- Balance after: Warlock's Hex Mark 8% → 5%, Mage's cast speed 15% → 10%, Bard's team damage 15% → 18%. Class band (100 fights each) runs Bard 25% to Warlock 68%.
- **Sudden death** in every fight, after Eslabong: from 45 s hits grow 5% a second (three times at 85 s) and heals halve; a red edge and a banner say so. Smarter play made a few 1v1s with a healer run past a minute.
- Fighters only walk out of ability spells (with cooldowns), not a caster's basic casts, or a melee fighter could dodge a healer forever. Rogues and assassins dive the back line instead of peeling.
- Your own moves in Control mode always fire: the "wait for a group" and "stun the caster" rules are autobattle judgment and never override an order, and a steered fighter's automatic target is the plain nearest.
- Sim checks: walking out of a marked spell, finishing the wounded, a tank peeling for its caster, every class's solo fight ending inside 90 s.

## Fix (v91)

- **Relics page**: the relic list was a fixed-height column with its own scroll box (about 370 px on a phone), inside the scrolling page. It now flows with the page, with bigger tiles (52 px icons in framed cells).
- **Relic popup**: `#relicSheet .btn { width: 100% }` also caught the close cross, which took the whole header and squeezed the title into a 17 px column, one letter a line. The cross is 40 px again and the title gets the rest.
- The clip audit opens the relic popup and now flags text stacked into a sliver (three or more lines, each under two letters wide).

## Fix (v90)

- **Archers holding wands**: a weapon item set the drawn weapon whatever the class, and rivals get random division gear, so an archer with a Wand item drew a wand (and still shot arrows). Now an item only changes the drawn weapon inside the class's family (`fitsClass` in `js/weapons.js`): bows for archers and rangers, guns for gunslingers and skirmishers, staffs, wands and books for casters, blades and hafted weapons for melee; Monk and Beastmaster always keep fists and claws. The item's stats still count. The sim checks every class against every weapon item.

## Party board and one-tap gear (v89)

- **Roster ▸ Party** (was First team): the party cards, then the bench as a list, then a hire list.
  - **Swap**: tap Swap on one fighter, then on another (party or bench). Party and bench trade places; two party fighters trade slots. **Best lineup** fields the highest levels with the captain kept in.
  - **Gear**: opens a gear drawer right under that fighter (party fighters: under the cards; bench: under their row), every slot with what is worn and every spare item for it.
  - **Hire**: the four best market listings you can afford (level first), with Hire right there; the hire lands back on the party board. "Whole market" opens the market tab.
- **One-tap gear**: every spare item shows its stat change (+12 ATK, -1 DEF...) and its own Equip button, in the party drawer and on the fighter sheet. The old flow (tap an item, scroll to the bottom for the comparison and Equip) is gone. On the Gear tab, Equip opens the fighter list inside the card, each name with the change for that fighter, and a tap equips.
- **Paladin** won 62% in the class band; its Oath Arm shields drop to +10% (from +25%), health 196 → 180, defense 8 → 7. Measured after: 49% over 100 fights.

## Class passives (v88)

Only four class passives were arena rules (Rogue and Assassin bleed, Berserker fury, Duelist riposte); the other 23 were text. Each now has a set number in `PASSIVE_FX` (`js/kits.js`), the arena reads it as `u.pv`, and the sheet text is written from the same numbers:

| Class | Passive | Rule |
|---|---|---|
| Warrior | Sure Footing | Knockbacks push 50% less far |
| Archer | Long Eye | +12% attack range |
| Mage | Still Hands | Spells take 10% less time to cast (v92) |
| Tank | Raised Guard | Blocked hits do 30% instead of 40% |
| Rogue, Assassin | Bleed | Every hit bleeds 18% ATK every 0.85s for 3.1s |
| Lancer | Long Reach | +10% attack range |
| Berserker | Low-Health Fury | Below 45% HP, 14% more damage |
| Healer | Triage | Heals on an ally under 50% HP are 40% bigger |
| Ranger | Marked Trail | 15% more damage to slowed enemies |
| Battlemage | Close Ward | Shield of 6% max HP after an area spell |
| Shieldbearer | Set Shield | Planted guard lasts 50% longer |
| Skirmisher | Feint | First shot within 1.5s of a dash or roll: +25% |
| Duelist | Riposte | Next hit after taking one: +20%; last enemy: +18% |
| Elementalist | Cycle | Cooldowns 10% shorter |
| Monk | Open Hand | Stuns last 30% longer |
| Necromancer | Grave Cold | Damage over time +20% a tick |
| Paladin | Oath Arm | Shields it gives +10% (v89) |
| Druid | Green Blood | Team regains 3 HP a second |
| Bard | Encore | Team deals 18% more damage (v92) |
| Gunslinger | Quick Draw | First shot of a fight +50% |
| Warlock | Hex Mark | Its damage-over-time targets take 5% more from everyone (v92) |
| Samurai | Still Blade | Crits ×1.8 instead of ×1.55 |
| Spearmaiden | Long Point | Charges hit 25% harder |
| Summoner | Tether | Summons last 40% longer, 20% more HP |
| Alchemist | Steady Hand | Flasks +35% |
| Beastmaster | Pack Sense | Summons +25% damage |

Bard, Druid, Healer and Alchemist got the larger numbers: with the other passives live, the class win band (sim, 100 fights a class, beside a warrior and a mage) had Bard at 4% and Druid at 9%. Measured after: Bard 26%, Druid 23%, Healer 19%, Alchemist 25% (Paladin is the top at 62%, Tank 46%). The sim plays each class's seeded fights with and without its passive and fails if nothing changes.

## Plain move text (v87)

Skill text was flavor ("A blink to safer ground.", "Always on, for the rest of this fighter's career."). Every move, upgrade and passive now says what it does in numbers, worked out from the arena rules (`moveFacts`, `modFacts`, `talentFacts` in `js/game.js`):

- **Moves** by kind: damage as % ATK and, for a fighter, the ATK value with their rank and Heavy upgrade folded in; areas, bounces, slows (38% slower), stuns, shields (% of max HP), buffs (% more damage, seconds), damage over time (per 0.85 s tick, tick count), summons (HP and ATK share, seconds).
- **Cooldowns** are the real ones: the listed value × 1.2 (PACE), less ranks and a Swift upgrade. The old cards showed the listed value, about 17% short.
- **Upgrades** say the effect on that move (Swift shows the cooldown before and after). **Passives** say the effect in play terms (Iron Hide: each point of defense takes 0.35 off every hit).
- Used on the level-up cards, the new-move screen, the fighter sheet, the Archive codex and the steering bar tooltips.
- The "Damage/Over time" category is now "Over time" (it wrapped out of its pill), and a thrown flask is "Damage". The clip audit now flags text that spills out of a filled label.

## Closer rivals early (v86)

A level 6 club could meet level 12-15 rivals: the full six-level swing applied from the start, plus the division floor (Bronze is 8) added on top. Now:

- **The swing grows with the club**: at most one level either way up to club level 7, then one more step every four levels (±2 at 8, ±3 at 12, ±4 at 16, ±5 at 20) to the full ±6 at 24. The per-fighter ±1 wobble starts at 12.
- **The division floor lifts rivals two levels at most** over the club (a level 6 club in Bronze meets level 8, not 8 plus the swing).
- **Rivals already over target come down**: a rival more than two levels over its target (made under the old rule) is rebuilt from level 1 at the target, keeping its name, look and gear, so a running season fixes itself on the next visit to the hub.
- Fix: Iron Gate bosses take their level-up picks again (v84 grew them from the level they were set to, so they got none).

| Club level | 1-7 | 8-11 | 12-15 | 16-19 | 20-23 | 24+ |
|---|---|---|---|---|---|---|
| Rivals (club swing + fighter wobble) | ±1 | ±2 | ±4 | ±5 | ±6 | ±7 |

## More moves (v85)

Every class learns six more moves, 162 in all (`MORE2` in `js/kits.js`), so a kit holds 14: three starters, a twin, and ten to learn on level up. They use only kinds the arena already plays and that the class family already uses (blades get cleaves, stuns, bleeds, knockbacks and charges; bows and guns get volleys, piercing shots, slows and rolls; casters get bolts, blasts, drains, summons and guards; supports get mends, guards, team buffs and slows), with numbers inside the bands of the moves already there. Icons come from the move's kind.

A fighter now has ten moves to learn before the pool turns to rank-ups and Hone. The sim equips each new move on its own and checks that it fires in a 2v2 without an error.

## Levels to 100, rivals that keep pace (v84)

- **Level cap 100** (was 30), Eslabong's ceiling. The xp curve is unchanged (40 × L^1.2 a level), so the climb past 30 is long.
- **Rival levels**: each rival club in a division has its own swing on the club level: −6, −4, −2, 0, +2, +4 or +6, and each of its fighters goes one either way around that (so −7 to +7 in all). Cup sides and market listings draw a random swing. The division floor still holds the base up. The standings key shows the range ("rivals Lv 4–18").
- **Rivals keep pace**: rivals were levelled once, when the season's clubs were made, and stayed there while the club grew. Now whenever the club level rises, each rival fighter levels to its own target before the hub draws (`IL.keepRivalsUp`, seeded by fighter and level). Rival growth also ran a 40-pick guard, so nothing grew past 41.
- **Picks never run dry**: the skill pool was finite (each move learned once, one upgrade per slotted move, each of six passives once), about 13 picks, after which the level-up screen showed no skill cards and rivals stopped growing stats. Now an upgraded move or an owned passive comes back one tier higher until legendary, and **Hone** (+2 to +5 to one stat, by rarity) fills any hand that is still short.
- Measured in the sim: a one-on-one lasts about 30-38 seconds at every level from 10 to 100, and the fighter six levels up wins 37/40 at level 16 v 10, 30/40 at 36 v 30, 26/40 at 100 v 94.

## Fixes (v84)

- **Archer arrows** start at the bow. The hand point was worked out at 4 world units per sprite pixel while fighters are drawn at 1, so each arrow spawned about four body-widths out. On a phone (the floor turned upright) the shot's body-height lift was also drawn sideways; shots now keep their lift (`liftShot`) and the renderer turns it with the sprite. Mage bolts and thrown vials get the same turn.

## Fixes (v83)

- **New move screen**: after a level-up teaches a move, the "swap it in" slots reused the class names of the level-up loadout strip (38 px boxes), so names and ranks spilled over each other. It now has its own layout: the new move on top, then one full-width row per slot with its icon, name, rank and a Replace button.
- Level-up screen: the three move icons sit centered in their boxes (an old 12 px padding on the same class left a 12 px content box and pushed each icon down and right). The result screen's **Level up** pill stays on one line.
- The clip audit now also opens the title, the creator and this screen, opens every fold before checking, and flags text that spills out of the button or framed card around it, icons outside their box, and pill labels that wrap. Run on the v82 styles it reports each of these bugs; on v83 it is clean at all four widths.

## Progress reset (v82)

Testers had grown far stronger than the game is tuned for, so every save is reset. `WIPE` in `js/game.js` is a save epoch: `persist()` stamps it into the save, and `load()` throws away any save stamped lower and shows a "Fresh start" note on the title. Raise `WIPE` by one to reset everyone again. Friend challenge codes are not saves, so old codes still import.

## Fixes (v81)

- **Hub music tick**: the hub loop carried a hi-hat every 0.300 s, the "constant ticking" in the menus. Each hit is ducked in the band above 1 kHz and the top end is shelved down by half, all on the loop's own circular spectrum so the seam stays seamless (high-band energy −17 dB). `AUDIO_V` 81 refetches it.
- **Events**: feed rows used the class `result`, which the result overlay also uses, so each row became a full-screen panel and pushed Close away. Rows now use `ib-<kind>`. Links open the right page (`events:daily`, `events:week`, `events:endless`, `club:home`) and the popup has a pinned header and a Close at the bottom.
- **Popups** are plain dark panels with a gold rim and a pinned header instead of the scroll frame.
- Captain medallion clips the sprite to its ring; market filter counts sit inside their chips; NEXT MATCH fits on a 360 px phone; the cleared weekly event reads "Cleared ✓".
- Arena: on a phone the floor sits low enough that a fighter at the top wall stays below the HUD, and the hazard banner fades after a few seconds.
- **Clip audit** (`tools/clipaudit.py`): opens 46 screens (every tab, pane, popup, fight, level-up and season-end state) at 360, 412, 768 and 1280 px in Roboto, the Android font, and flags text cut by an ellipsis, past its box (into a button's arrow art), clipped by a parent, or off screen. It found 26 problems, all fixed: the phone header now runs crest + name + Menu, then the week, then purse + Ceremony; club and fighter names wrap instead of "La…"; the dock button wraps a long label ("Champions Cup", "Season ceremony"); standings columns read whole at tablet width. Run it with the repo served on :8765 (`IL_CLIP_WIDTHS=360` for a quick pass); it exits 1 on any finding.

## Iron Gate (v79)

An eight-floor run on the Club tab, after Eslabong's Iron Gate. One run a week (a run in progress carries on into the next week).

- Floors 1-4 and 6 are squads that grow from 1 to 3 fighters; floors 5, 7 and 8 are bosses: **Gate Warden**, **Iron Jailer**, **The Gatekeeper** (with adds). Foes start at the club's level and rise a level every two floors.
- Health carries floor to floor (like the endless pit); the party is the fielded lineup.
- A floor pays 10 + 4×floor gold and 10 + 2×floor XP each. Every boss drops a **chest** (24-69 gold, more on higher floors, and a relic 40% of the time, else an item). Breaking the gate adds 10 renown.
- Best floor is kept (`save.gateBest`); clears count in `save.gateClears`. `IL.gateFloor(save, rng, floor)` and `IL.gateChest`.

## Transfers (v78)

- **Offers**: after a league or cup week, a rival in your division may bid for one of your fighters (never the captain; level 2+ or a win to their name), at 1.15–1.7× market value. At most two offers stand; each lasts a week. They show under Action required on Overview and in the Events inbox with **Accept** / **Decline**. Accepting pays the gold, returns their gear to the bag and posts the transfer to the market news.
- **Rival listings**: when the board turns over, a division rival lists one of its own fighters about two times in three, dressed and levelled like their squad, at 1.2× market value. The row carries the club's crest, the card reads "Listed by …", and a **League** filter shows only these.
- `IL.rollOffers(save, rng)`, `IL.rivalListing(save, rng, club, avoid)`; offers live in `save.offers`.

## Intel (v77)

- **Stats**: club leaders (season kills, damage, healing; impact by performance score; MVPs; career kills), single-match **club records** (most damage, knockouts, healing, damage taken, with who and which season; `save.records`), then the old record panel.
- **Rosters**: every club in the division in table order with its record and three fighters (class and level), so the next rival can be read before the match.
- **Archive**, with its own tabs:
  - Classes: discovered by owning a class or facing it in a fight; tap one for its **codex page** (role, trait, base stats, passive, and the whole move pool with categories and cooldowns).
  - Clubs: met clubs with their crest and class theme.
  - Champions: the ten named champions, marked when signed.
  - Relics: found relics with their blurbs; the rest by rarity only.
  - Systems: how seasons, divisions, level-ups, stamina, market value, facilities and relics work.
- **Goals**: the achievements list.

## Champions Cup (v76)

When the last league week is played, the table's top four play a **Champions Cup**: 3v3 semifinals (1st vs 4th, 2nd vs 3rd) and a final, before the season ceremony.

- If you are in it, Overview leads with the tie and the bottom bar's NEXT MATCH becomes **Champions Cup**; the ceremony waits until you are out or have won. Ties that do not involve you are settled by strength (`IL.settleCup`).
- If you missed the top four, it is played out on its own and the result shows on the calendar, the Cups pane and the ceremony.
- Purse: semifinal win 50g / 9 renown, semifinal loss 40 / 7, final loss 80 / 14, champion 160 / 30, +1 cup token and a relic. Every tie pays 30 XP a fighter for a win (40 for the title) and tires the squad like a league match.
- `save.champs` holds the bracket for the season (`kind: "champions"`), built by `IL.startChampionsCup(save, sortedTable)`.

## Facilities (v75)

Seven facilities, bought a rank at a time with gold (Club tab ▸ Facilities):

| Facility | Ranks | Cost | Effect |
|---|---|---|---|
| Headquarters | 3 | 120 / 260 / 480 | +2 roster slots a rank (8 → 14) |
| Training Grounds | 2 | 80 / 180 | +1 drill a week |
| Time Chamber | 2 | 70 / 160 | +4 xp a drill |
| Barracks | 3 | 90 / 200 / 360 | The bench takes 15% of the lineup's league and cup match XP a rank |
| Medical Bay | 2 | 60 / 140 | Drills 4 gold cheaper and the bench rests 6 more stamina a rank |
| Scouting Office | 2 | 100 / 220 | Scouting finds the wanted class 75%, then 100%, of the time (from 45%) |
| Treasure House | 2 | 150 / 320 | +1 club relic slot a rank (2 → 4) |

The Club tab shows each facility as a tile with its current effect and next rank. The old yard, hall and infirmary keep their saved ranks under the new names. `IL.rosterCap`, `IL.benchShare`, `IL.restBonus`, `IL.scoutOdds`, `IL.clubRelicSlots` read the ranks.

## Market (v74)

- Sub-tabs Fighters (first), Relics, Gear, Deals, Sell, styled like the hub's sub-tabs.
- **Fighters** is now a list and a detail card, after Eslabong's market:
  - Filters: All, Affordable, Watchlist, Champions, Scouted (with counts), plus Refresh and Scout for.
  - A pulse line: listings, roster count, and how the board turns over.
  - The list: sprite, name with move icons, HP/ATK/DEF/SPD, class badge and level, price (renown for a locked class), and a watch star.
  - The card of the picked listing: portrait, class and rarity badges, level, **market value** against the asking price (or renown required), stats, abilities, profile (personality, growth style, specialty, trait), Watch and Hire.
- On a phone the card sits above the list and the class column hides.

## Season calendar (v73)

- A division is now **8 clubs** playing one round robin: **7 league weeks** (squads 3, 2, 3, 1, 3, 2, 3). The top two go up and the bottom two go down, as before.
- Everything reads the length of the season from its fixture list (`seasonWeeks`, `weekSize`, `seasonDone` in game.js), so a save in the middle of an old 5-week season finishes it and starts the new format next season.
- Divisions keep our five tiers but read Eslabong-style in the header: Div V · Sand, IV · Iron, III · Bronze, II · Silver, I · Crown.
- "Unbeaten" now means a full season without a loss, whatever its length.

## Roster (v72)

- **First team**: one card per fielded fighter: name, level (with a ▲ when picks wait), class badge colored by role, stamina bar, HP/ATK/DEF/SPD, the three move icons plus talents, a gear column (weapon, armor, trinket, worn relic), a behavior button (tactic · personality; tap cycles the tactic), and Captain / Set captain plus the lineup chip. Empty slots show for the week's squad size.
- Under the cards: Autobattle / Control (the captain-control default), Gear, Relics, Development.
- **Substitutes**: a strip of sprite tiles with name, class, level, stamina, the lineup chip and Train, padded with Empty tiles up to the roster cap.
- **Gear** moved to its own Roster pane (the armory).
- **Fighter sheet**: a centered detail view. The header has the portrait, name, class and role badges, stamina, level and XP, **market value** and **performance score**. A grid holds Fighter stats (each with its gain since level 1), Abilities (attack, passive, loadout, picks), Profile and behavior (personality, growth style, rarity, specialty, stamina, tactic, behavior rows), Combat summary (battles, MVP, win rate, kills, damage, healing), Gear and Relics. "Still to learn and tomes", "Development" and "Actions" fold away.
- `IL.perfScore(f)` (0-999 from damage, healing, KOs, wins and MVPs per match, scaled by level) with `IL.perfLabel` (Unproven, Poor, Fair, Good, Great, Excellent). `IL.marketValue(f)` builds on hire cost, rarity, champion, level, upgrades, performance, stamina and gear. Fighters now count `mvps`.

## Club hub (v71)

The hub now follows Eslabong's layout (see `ROADMAP.md` for the whole rebuild):

- **Header**: crest and club name, "Season N - Week w/5" with a pip per league week (green won, red lost, gold next) and the division, then gold, renown, cup tokens and **Menu** (settings).
- **Six tabs** (keys 1-6): Overview, Matches, Roster, Club, Market, Intel. Tapping the tab you are on goes back to its first page. Old tab names still route (`TAB_ALIAS`): Team → Roster, Compete → Matches ▸ Cups, Relics → Roster ▸ Relics, Events and Train → Club.
- **Bottom bar**: Daily match (left), NEXT MATCH (center), Events with a badge for actions waiting (right). On a phone it sits on the pinned tab bar.
- **Overview**: the next match card (both crests and places, synergy, lineup readiness with each fighter's stamina), Action required, top four of the table, Fighter of the week (latest winning MVP), and the feed.
- **Matches**: League (standings with W-L, +/-, points and a three-match form strip; season calendar with results and NEXT), Cups (the old Compete tab), History.
- **Roster**: First team (roster and armory) and Relics.
- **Club**: Activities, Facilities and Services tiles; each opens the events or training pane it covers.
- **Intel**: Stats (club record), Archive (class codex: classes you have owned or seen, the rest "Not yet discovered"), Goals.
- **Events inbox**: Action required (level picks, open ties, the ceremony) and the feed (market news, recent results).

The league now logs each of your weeks (`save.leagueLog`) and each club keeps its last five results (`club.form`).

## Level up v3 (v70)

Rebuilt after Eslabong's two-step pick:

1. **Choose a stat**: four tinted cards (HP red, ATK steel, DEF blue, SPD green) with a pixel icon, the exact gain ("+6 HP") and one plain line. The growth style sets the size of each card: the style's best stat is worth 3 roll points and is marked *Growth*, its second 2.5, the rest 2. Balanced is 2.5 everywhere. Point values are unchanged (`ROLL_VALUE`).
2. **Choose a skill**: three cards, each with a category pill (AoE, Damage, Mobility, Defense, Heal, Buff, Control, Stun, Push, Summon, Passive, Upgrade, Utility), a tier line (T1 Common, T2 Uncommon, T3 Rare, T4 Legendary), a big icon, a gold name, and a short description. Reroll costs gold; Later keeps the level waiting.

The chosen stat waits in memory until the skill is taken, and "Change" goes back. The header shows the fighter, class, growth style, level, and their three move slots (with a "+" for an empty slot) and talents. Rivals take their style's best stat (`applyLevelPick(f, i)` with no stat key). Stat rerolls are gone because the stat is now a choice.

## Not in this build

Clip usage is in `ANIM.md`.
