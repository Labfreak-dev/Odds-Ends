# Labfreak Legends

A Hearthstone-style card battler built from every Labfreak game: Glimmerdeep, Dead Man's Pull,
Thankless, Odds & Ends, Ironhold Idle, and the Labfreak Series 1–3 and Multiverse card packs.

Cards come in sets, Hearthstone-style. The Core Set (2,318 cards) is the original game; each expansion
adds its own pack, a set symbol on its cards and a new keyword:

| Set | Cards | Built from | Brings |
|---|---|---|---|
| Core Set | 2,318 | Glimmerdeep, Dead Man's Pull, Thankless, Odds & Ends, Labfreak series | the five original classes |
| Siege of Ironhold (`ih`) | 190 | Ironhold Idle's art (`ironhold/art.js`, its item icons) | the Champion class; **Frenzy** (acts the first time it survives damage) |
| The Deep Catch (`dc`) | 152 | the Odds & Ends fishing art (`workshop/fishing-*.module.js`) | **Dredge** (look at the bottom 3 cards of your deck, put one on top) |
| Tricks of the Trade (`tt`) | 74 | Ironhold Idle's trinket icons and the Odds & Ends curios | synergy spells and weapons for every class |

Many minions in every set carry synergy abilities (tribe lords, "for each", "if you control", cost cuts, deck tutors). The rules for which cards get them live in `synergize()` in `tools_gen_cards.py`.

No build step. Open `index.html` from any static host (GitHub Pages works; drop this folder in as
`/legends/`). Opening the file straight from disk won't work in most browsers because of
the scripts, so use a local server: `python3 -m http.server`, then visit http://localhost:8000.

| Path | What it is |
|---|---|
| `index.html` | Page shell and all CSS |
| `js/engine.js` | Rules engine, pure logic with no DOM. Runs in Node for headless bot-vs-bot games |
| `js/ui.js` | Menus, collection and deck builder, battle board, campaign and cutscenes, animation, sound |
| `js/campaign.js` | The campaign: six class stories and a finale, every line of dialogue, bosses and rewards (data only) |
| `data/cards.js` | GENERATED: 2,734 cards in four sets, tokens, heroes, atlas index (`window.LL_DATA`) |
| `img/a00–a36.webp` | GENERATED: Core Set art atlases, 8×8 cells of 192 px |
| `img/a37–a42.webp` | GENERATED: expansion art atlases |
| `img/fx.webp`, `img/bg_*.webp` | Spell effects and battle boards |
| `sfx/` | Copied from `glimmerdeep/sfx` and `glimmerdeep/music` |
| `tools_gen_cards.py` | The Core Set generator (writes `data/cards.js` and `img/a00–a36`) |
| `tools_gen_sets.py` | The expansion generator: run it after `tools_gen_cards.py`; it appends both expansions to `data/cards.js` and writes `img/a37+`, reading every asset straight from the repo |
| `tools_gen_packs.py` | Pack foils, reveal sigils, card backs and pack sounds for the Card Shop |

Progress saves in the player's browser (localStorage): decks `ll_decks`, owned cards `ll_owned`, golden copies `ll_golden`, gold `ll_gold`, dust `ll_dust`, campaign progress `ll_camp`, daily quests `ll_quests`, reward-track level `ll_prog`, free packs `ll_free`, cosmetics `ll_cos` (card back, hero portraits), win counts `ll_stats`, plus `ll_chosen`, `ll_sound`, `ll_tips`, `ll_read`, `ll_jseen`.

Economy, in `js/ui.js`: crafting and disenchant costs (`CRAFT`, `DE`, `CRAFT_G`, `DE_G`), golden odds (`GOLD_ODDS`), quests (`QDEF`), the reward track (`trackReward`, `xpNeed`), card backs (`BACKS`, art from Rip & Ship, written to `img/back_*.webp` by `tools_gen_packs.py`) and hero portraits (`PORTS`). Deck codes are `LL1.<class>.<singles>.<doubles>`, five base-36 characters per card (an FNV hash of its id).

Packs and prices live in the `PACKS` list in `js/ui.js`; battle rewards are in `gameOver()`.
