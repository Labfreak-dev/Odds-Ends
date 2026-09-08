# Ironhold Idle

A standalone browser idle RPG served by GitHub Pages at `/Odds-Ends/ironhold/`. It shares nothing with the card game at the repo root and is exempt from the root's generated-file rule.

## Files
- `index.html` — the whole game: page, css, code, the item icons. About 2 MB.
- `art.js` — the art: every sprite frame, the nine area paintings, the laboratory stage. About 13 MB. `index.html` fetches it after its first paint, so the page shows in a second or two and the art fills in behind it; until it arrives monsters, companions and the champion draw in outline. If it never arrives the chronicle says so and the game plays on.
- `stamp-art.py` — writes the hash of `art.js` into `index.html` (`ART_V`) so a changed art file busts the browser cache. **Run it after any change to `art.js`, before committing.**
- `make-code.py` — the redeem-code generator.

## Shipping
1. Edit `index.html` and/or `art.js`.
2. `python3 ironhold/stamp-art.py` if `art.js` changed.
3. `node --check` every `<script>` block of `index.html` and `art.js` itself.
4. Bump `const BUILD='bNNN-name'` in `index.html`; the stamp shows under the title so a deploy can be confirmed.
5. Commit both files together and push to main. Pages redeploys in a minute or two.

## Adding art
Sprite entries live in `art.js` under `SPR_SRC`: `{"key_idle":{"sc":1.0,"f":[{"src":"data:image/webp;base64,..."}]}}`. Monsters are 256×192 facing left at `sc` 1.0; champion looks 256×192 at 0.67 with a grip point `g` (melee) or two hands `g`/`h` and an angle `a` (ranged, magic); the Ascended and Risen forms 256×256 at 0.64; companions 256×192 at 0.5–1.05 facing right. A look with many frames plays them all: idles loop, attacks run their length over the lunge. Grok deliveries often ship with a broken matte (half-alpha pixels inside the figure): rebuild the silhouette by flood-filling from the border and restoring alpha inside before encoding.
