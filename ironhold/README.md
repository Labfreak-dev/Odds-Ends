# Ironhold Idle

A standalone browser idle RPG served by GitHub Pages at `/Odds-Ends/ironhold/`. It shares nothing with the card game at the repo root and is exempt from the root's generated-file rule.

## Files
- `index.html` — the whole game: page, css, code, the item icons. About 2 MB.
- `art.js` — the art: every sprite frame, the nine area paintings, the laboratory stage. About 13 MB. A small loader at the top of `index.html`'s head starts fetching it before the rest of the page has arrived, and an intro curtain (title, crest, progress bar) covers the boot until every frame has decoded. The loader keeps a copy in the browser's Cache API under the version stamp, so a return visit reads it from disk and never touches the network. On a slow road an Enter button appears after twelve seconds and the art keeps landing behind the game; until it does, monsters, companions and the champion draw in outline. If it never arrives the curtain says so, lifts, and the chronicle records it.
- `stamp-art.py` — writes the hash and byte size of `art.js` into `index.html` (`ART_V`, `ART_BYTES`) so a changed art file busts both caches and the progress bar knows its total. **Run it after any change to `art.js`, before committing.**
- `make-code.py` — the redeem-code generator.

## Shipping
1. Edit `index.html` and/or `art.js`.
2. `python3 ironhold/stamp-art.py` if `art.js` changed.
3. `node --check` every `<script>` block of `index.html` and `art.js` itself.
4. Bump `const BUILD='bNNN-name'` in `index.html`; the stamp shows under the title so a deploy can be confirmed.
5. Commit both files together and push to main. Pages redeploys in a minute or two.

## Adding art
Sprite entries live in `art.js` under `SPR_SRC`: `{"key_idle":{"sc":1.0,"f":[{"src":"data:image/webp;base64,..."}]}}`. Monsters are 256×192 facing left at `sc` 1.0; champion looks 256×192 at 0.67 with a grip point `g` (melee) or two hands `g`/`h` and an angle `a` (ranged, magic); the Ascended and Risen forms 256×256 at 0.64; companions 256×192 at 0.5–1.05 facing right. A look with many frames plays them all: idles loop, attacks run their length over the lunge. Grok deliveries often ship with a broken matte (half-alpha pixels inside the figure): rebuild the silhouette by flood-filling from the border and restoring alpha inside before encoding.
