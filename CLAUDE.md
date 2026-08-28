# Odds & Ends — Workshop Guide

Browser card/idle game at labfreak-dev.github.io/Odds-Ends/. This repo holds BOTH
the deployed game (repo root) and the workshop that builds it (`workshop/`).

## THE GOLDEN RULE
**Never edit files in the repo root** (`index.html`, `oe-*.js`, `modes/`) — they are
GENERATED. All changes happen in `workshop/`, then rebuild:

```bash
python3 workshop/integrate.py --out .
```

That regenerates `index.html` + all `oe-NN-*.js` at the repo root and refreshes
`modes/`. Commit and push everything the build touched, together. GitHub Pages
serves the root; the site URL never changes.

## Architecture
- `workshop/source-pristine.html` — the host: page shell, css, core game
  (cards/packs/collection/upgrades/market host code). Single source of truth.
- `workshop/*.module.js` + `*.css` — one file per game mode (fishing2, mining2,
  ledger, grading, market2, casino2, keep, hunt, + puzzle modes). Modules are
  self-contained IIFEs/consts appended into the host script at build time.
- `workshop/integrate.py` — the build. It splices css, tab sections, and modules
  into the host string via labeled `once()` replacements, then EXPLODES the result
  into multi-file form: slim `index.html` + ordered `oe-NN-name.js` scripts
  (split on `/*@@SPLIT:name@@*/` sentinels). Top-level const/let in classic
  scripts are visible across files, so module boundaries are safe splits.

## Hard-won rules (violate these and the build WILL break)
1. `once()` is ATOMIC per script run: it asserts the anchor appears exactly once
   and the run aborts without writing on failure — re-apply ALL edits together.
2. Anchor on FULL statements, never bare `}` (dies inside template literals).
3. NEVER blind-regex the build script or the host — corrupts string payloads.
4. integrate.py's hook lists are Python implicit string concats ending `+ anchor`;
   deleting the last line strands the concat and SyntaxErrors the build itself.
5. `false && {...}` in an array literal KEEPS a falsy element — excise entries
   by brace-walking instead. A load-time throw TDZ-poisons every later const.
6. Card ids are ARRAY INDICES into `cards` — never remove card entries; hide them.
7. `>>>` not `>>` for unsigned hashes.
8. Asset readiness is EVENTED, never time-boxed (see kimg/kitDirty in hunt).
9. Deleting UI? grep every renderer that writes into it first.
10. State objects captured at module load: probes/tools must `Object.assign` into
    `state.x`, never replace it.

## Verify before any deploy
```bash
for f in oe-*.js; do node --check "$f"; done          # every split file parses
node docs/test-fishing.js                              # fight-engine invariants
python3 docs/smoke-fishing.py && python3 docs/smoke-spots.py   # needs playwright
```
The smokes drive the real page headless; if playwright is unavailable, at minimum
run the node checks + test-fishing and open index.html for a manual boot check
(no console errors, all Play cards present).

## Deploy
Commit the regenerated root files (index.html + oe-*.js + modes/) and push to the
default branch. Pages redeploys in ~1-2 min. Never ship index.html without its
oe-*.js siblings from the SAME build.

## Docs
`docs/fishing.md` is the batch-by-batch build log — append an entry for every
change (what, why, lessons). It is the project's memory; keep it current.
