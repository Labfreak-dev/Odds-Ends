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

## Working with the project chat (feature bench)
Big features, new modes, and asset work happen in a long-running Claude project
chat that has the full workshop on its bench and can build + drive the real page
headlessly (Playwright). That chat DELIVERS ALREADY-INTEGRATED WORK: module,
css, the integrate.py wiring, and a verification pass. This repo is where that
work lands, gets rebuilt, and ships.

### What a handoff looks like
The chat hands over:
1. `<name>.module.js` and `<name>.css` -> drop into `workshop/`
2. A short HANDOFF NOTE containing:
   - registry values: id, display name, icon emoji, Play-card description, meta
   - the exact `integrate.py` wiring lines (css read, module read, tab section,
     UI_GAMES entry, and any hook-list lines)
   - any host (`source-pristine.html`) edit as a before/after snippet
   - what was already verified on the bench
3. Sometimes a full replacement `integrate.py` / `source-pristine.html` when the
   edits are extensive — prefer these over hand-applying snippets.

### What to do with a handoff
```bash
# 1. files are in workshop/ (module, css, plus any replaced build files)
# 2. apply the wiring lines from the note IF integrate.py wasn't replaced
python3 workshop/integrate.py --out .          # 3. rebuild
for f in oe-*.js; do node --check "$f"; done   # 4. verify
node docs/test-fishing.js
# 5. commit ALL regenerated root files together, open a PR
```
Never hand-edit generated root files to "apply" a handoff — always rebuild.

### Mode contract (for anything authored fresh)
- classic script only: no `import`/`export`; top-level `function`/`const`/`let`
- unique 2-3 letter prefix on EVERY top-level name and css class
- hooks by exact name: `xxOnEnterTab()`, `xxOnLeaveTab()`, `renderXx()`
- own stage div (`<div id="xxStage">`), assume no other host DOM
- `Object.assign(state.x, {...})`, never `state.x = {...}`
- `>>>` for unsigned hashes; no load-time throws (they TDZ-poison the bundle);
  assets embedded as data URIs and committed; never reorder the `cards` array
- taken prefixes: any, ap, ar, bj, bk, br, buy, by, ci, cs, cx, dg, et, fb, fe,
  ff, fsh, fx, get, gr, hl, hu, is, key, kp, lg, max, mg, mr, mw, on, oo, pk,
  pr, pv, rd, rep, rip, rs, set, sg, sk, tw, ui, was, xp
  (regenerate: grep top-level declarations in workshop/*.module.js + host)
- smallest complete reference mode: `workshop/ledger.module.js` (~7KB)

## Docs
`docs/fishing.md` is the batch-by-batch build log — append an entry for every
change (what, why, lessons). It is the project's memory; keep it current.
