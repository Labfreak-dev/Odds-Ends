# Loot & Daggers

A standalone browser game served by GitHub Pages at `/Odds-Ends/lootdaggers/`.
Like `thankless/` and `ironhold/`, it shares nothing with the card game at the
repo root and is exempt from the root's generated-file rule: edit `index.html`
directly. No build step.

**The pitch:** *Loot Dungeon* × *Slots & Daggers*. A side-scrolling dungeon
crawl, like Loot Dungeon, where you never press "move" or "attack". You put a
coin in, pull, and stop the reels, and whatever lands on the payline is your
turn.

## Files
- `index.html`: the whole game (page, css, code). Everything has a vector or
  emoji fallback, so it plays with no art at all.
- `art.js`: the art pack, `window.LD_ART = { key: dataURI }`. It ships
  empty. Any key present replaces its fallback: sprites in the scene and
  `sym_*` on the reels.
- `art-prompts.txt`: the art sheet, one `filename | prompt` per image. The
  name before the dot is the key the game looks up.

## The turn
1. **Coin in.** A spin costs 1 coin. The Hourglass relic makes your first spin
   on each floor free.
2. **Stop the reels.** Tap each reel, or STOP, to stop it. The reels spin
   fast, so aiming is a skill and the Oiled Brake mod slows them down. 🤖 turns
   on auto-stop.
3. **Resolve.** Every symbol on every active payline fires, in this order:
   block, heal, coins, skulls, keys, **move**, then daggers, bows and bombs.
   Because boots resolve first, they can carry you into stabbing range.
4. **Matches.** Three of a kind on a line multiplies that symbol by x3 (four
   of a kind x4, five x5). Wilds join the best symbol on their line. Skulls
   never multiply.
5. **Foes act.** Every foe within 6 tiles carries out the intent shown over
   its head. Melee foes walk up to you; archers and wraiths hit from range.

| Symbol | Effect |
|---|---|
| 🗡️ Dagger | Stab the foe or chest directly ahead |
| 🥾 Boots | Step 2 tiles; if something blocks you, shove it for damage |
| 🛡️ Shield | Block until your next spin |
| 🪙 Coin | Pays coins back into the purse |
| 🧪 Potion | Heal |
| 💀 Skull | Hurts you, ignoring block |
| 🏹 Bow | Shoot the nearest foe within 4 tiles |
| 💣 Bomb | Hit everything within 2 tiles |
| 🗝️ Key | Open the nearest chest within 3 tiles (disarms mimics) |
| ⭐ Wild | Joins the best symbol on its line |

## What came from which game
| | Loot Dungeon | Slots & Daggers | Here |
|---|---|---|---|
| View | side-scrolling crawl, walk right | single-screen fights | side-scroller: floors of 13–22 tiles ending in an exit door, a boss every 3rd floor |
| Actions | auto-battler | reels decide the turn | reels decide **movement and** attacks |
| Pressure | the dungeon's timer | enemy intents | **coins are the clock** (every spin costs one) plus readable enemy intents |
| Gear | ARPG loot, 5 rarities, random affixes | symbols are your equipment | ARPG gear whose affixes change your numbers **and weld symbols onto your reels** |
| Relics | perks | passive relics that bend the rules | 22 relics from shrines, bosses and the merchant |
| Shop | — | buy and upgrade symbols | the Coin-Op Merchant sells gear, relics, heals, and adds or removes reel symbols, all priced in the same coins your spins use |
| Meta 1 | death is progress: souls buy stats, heroes, depth | — | **Soul Altar** (8 stat upgrades) and 3 unlockable heroes |
| Meta 2 | — | poker chips buy machine upgrades | **Machine Workbench**: boss chips buy paylines, a 4th and 5th reel, slower reels, a skull filter, a starting wild or relic |
| Meta 3 | keep your loot | — | **Heirloom Vault**: when you die, carry one worn piece home and wear it on a later run |

Running out of coins isn't an instant loss. You can pawn worn gear for coins
until nothing is left.

## Save
`localStorage['lootdaggers_v1']`. A run in progress is saved after every turn,
and the hub offers "Continue run". Settings → Wipe save resets everything.

## Art pipeline
`art-prompts.txt` uses the same conventions as Thankless: sprites face right
and are keyed on a flat magenta (#FF00FF) background; `bg_*` strips tile
horizontally; `sym_*` are square reel icons. To ship art, key out the
magenta, trim, and write each image into `art.js` as a data URI under its
key. Missing keys keep the fallback, so art can arrive in waves.

## Debugging
`window.LD` exposes `S` (save), `run`, `M` (machine), `spin()`, `stats()`,
`stripCounts()` and `evaluate(grid)` for headless tests.

## Build log
- **b001**: first prototype. The full loop: hub → hero → floors → merchant →
  boss every 3rd floor → death → souls, chips and an heirloom → hub. 4 heroes,
  7 enemies, 3 bosses, 10 symbols, 22 relics, gear in 5 rarities with 17 affix
  types, 8 altar upgrades, 9 machine mods. Headless bot: full runs with no
  console errors on phone and desktop layouts, including a 5-reel,
  5-payline machine.
