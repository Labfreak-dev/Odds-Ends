# Labfreak Legends

A Hearthstone-style card battler built from every Labfreak game: Glimmerdeep, Dead Man's Pull,
Thankless, Odds & Ends, and the Labfreak Series 1–3 and Multiverse card packs.

No build step. Open `index.html` from any static host (GitHub Pages works; drop this folder in as
`/legends/`). Opening the file straight from disk won't work in most browsers because of
the scripts, so use a local server: `python3 -m http.server`, then visit http://localhost:8000.

| Path | What it is |
|---|---|
| `index.html` | Page shell and all CSS |
| `js/engine.js` | Rules engine, pure logic with no DOM. Runs in Node for headless bot-vs-bot games |
| `js/ui.js` | Menus, collection and deck builder, battle board, animation, sound |
| `data/cards.js` | GENERATED: 2,318 cards, tokens, heroes, atlas index (`window.LL_DATA`) |
| `img/a00–a36.webp` | GENERATED: card art atlases, 8×8 cells of 192 px |
| `img/fx.webp`, `img/bg_*.webp` | Spell effects and battle boards |
| `sfx/` | Copied from `glimmerdeep/sfx` and `glimmerdeep/music` |
| `tools_gen_cards.py` | The generator that wrote `data/` and `img/` from the repo art |

Progress saves in the player's browser (localStorage): decks `ll_decks`, owned cards `ll_owned`, gold `ll_gold`, plus `ll_chosen`, `ll_sound`, `ll_tips`.

Packs and prices live in the `PACKS` list in `js/ui.js`; battle rewards are in `gameOver()`.
