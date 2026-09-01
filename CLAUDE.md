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
  ledger, grading, market2, casino2, hunt, + puzzle modes; keep is RETIRED —
  its source stays in workshop/ unwired). Modules are
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

## Adding a new mode
Hand-off from a feature chat is TWO FILES: `workshop/<name>.module.js` and
`workshop/<name>.css`. Everything else is wiring done here. Send whole files,
never diffs — a patch written against a copy rarely applies to the real file,
and a half-applied patch is worse than none.

Write the module to these rules or the build breaks in ways that are hard to
trace back:
- **Classic script, not ESM.** No `import`/`export`. Every module is
  concatenated into one script, then split apart again on the SPLIT sentinels.
- **Namespace every top-level name** with a short prefix (`kpTick`, `KP_TILES`).
  Top-level `const`/`let` are visible ACROSS the split files, so two modes both
  declaring `state` collide at load. 74 two-letter prefixes are already taken —
  most by the host — so check a candidate before committing to it:
  ```bash
  grep -rhoE '^(function|const|let|var) (xx[A-Z_][A-Za-z0-9_]*)' \
    workshop/*.js workshop/source-pristine.html | head    # xx = your prefix
  ```
  Taken by modes: cs cx fb fe ff gr hc hu im ki kp lg mg oo pr pv sc ti. The
  host owns most other pairs; `fsh` is the host's fishing code, `fe`/`fb` are
  fishing2's.
- **Never throw at load time.** A load-time throw TDZ-poisons every `const`
  declared after it — one bad module takes down the whole game, not just its
  own tab (rule 5 above).
- **Name the lifecycle hooks by convention:** `xxOnEnterTab()`,
  `xxOnLeaveTab()`, `renderXx()`. The build splices those names into its hook
  lists; a mismatch fails silently as a dead tab.
- **`Object.assign` into state objects, never replace them** (rule 10 above).

`workshop/ledger.module.js` (6.9KB) is the cleanest template — give a feature
chat that file as the reference shape.

Also state the registry values, which cannot be inferred: **id, display name,
icon emoji, Play-card description, meta line** (e.g. "Daily-style puzzle").

Assets: either base64 data URIs inside the module (what fishing/keep/hunt do)
or separate files committed under `workshop/assets/`. Either way they live IN
THE REPO — an asset that exists only on someone's machine is exactly how the
build became unreproducible (Batch 51).

### The seven wiring points in integrate.py
A new mode touches seven of the eight `once()` splices, in build order:

| # | `once()` label | what to add |
|---|---|---|
| 1 | `css`         | `read("<name>.css")` in the join list |
| 2 | `sections`    | `<section id="tab-<id>">` with the mode's stage div |
| 3 | `modules`     | `"<name>.module.js"` in `MODULE_FILES` |
| 4 | `UI_GAMES`    | the registry entry (id/name/icon/desc/meta) |
| 5 | `leave hooks` | `if(except!=="<id>") xxOnLeaveTab();` |
| 6 | `enter hooks` | `else if(id==="<id>"){ xxOnEnterTab(); }` |
| 7 | `render list` | `safeRender("<id>", renderXx);` |

(The eighth, `keep section`, is a separate splice hunt uses to sit outside the
puzzle block.) Modes already present in the host's own `UI_GAMES` — fishing,
poker, casino, hunt — skip step 4. (keep and dungeon/Mythic Raids are retired:
not in UI_GAMES, dungeon's tab sealed by the empire/siege/raids CSS rule.)

Remember rule 1: `once()` is atomic per run and aborts the WHOLE build on a bad
anchor, so apply all seven together and rebuild once. And rule 4: those hook
lists are Python implicit string concats ending `+ anchor` — deleting the last
line strands the concat and SyntaxErrors the build itself.

## Playtesting a change before it ships
**Standing instruction: don't. Build, verify, and ship straight to main —
the playtester tests live.** A preview cannot test anything that costs
money, because a save lives in the site's own browser storage and any other
folder or origin starts with no credits. Two rounds were lost to that.
Gate a risky feature behind a flag in the live build instead, the way the
Keep's build mode was, rather than standing up a second copy of the game.

`preview/` remains below for the rare change that genuinely needs a second
pair of eyes before shipping. Do not offer it by default.

`preview/index.html` is a PLAYABLE copy served by Pages at
`/Odds-Ends/preview/`, so a change can be tried on a real phone while the
live game at the root stays untouched. It is generated — never hand-edit it:

```bash
python3 workshop/make-preview.py           # light: preview/index.html only
python3 workshop/make-preview.py --full    # standalone build in preview/
```

Both layer `workshop/preview.css` (preview-only css, never shipped) onto a
normal `integrate.py` build. LIGHT rewrites the script tags to `../oe-*.js`
so the preview runs the ROOT's javascript — 274KB instead of ~33MB, and it
tracks whatever root serves. That also means **light previews cannot show
module changes**; use `--full` for those. Promote a preview by folding the
css into the real mode file and rebuilding root; retire one by deleting the
folder.

## Verify before any deploy
```bash
for f in oe-*.js; do node --check "$f"; done          # every split file parses
node docs/test-fishing.js                              # fight-engine invariants
python3 docs/smoke-start.py                            # start screen + menu chrome (28)
python3 docs/smoke-fishing.py && python3 docs/smoke-spots.py   # needs playwright
```
The smokes drive the real page headless; if playwright is unavailable, at minimum
run the node checks + test-fishing and open index.html for a manual boot check
(no console errors, all Play cards present).

### Playwright in a Claude Code web session
Chromium is preinstalled and `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers` is
already set, but the Python package is NOT. Install it PINNED:

```bash
pip install playwright==1.56.0     # NOT plain `pip install playwright`
```

The pin matters. Each playwright release hardcodes one chromium revision; the
image ships revision **1194**, and 1.56.0 is the release that wants exactly
that. Install the newest instead and it demands a revision that isn't on disk,
then dies with `Executable doesn't exist at .../chromium_headless_shell-<n>`
plus a banner telling you to run `playwright install` — **don't**: it downloads
browsers the image already has. With the pin, both smokes run UNMODIFIED (no
executable_path, no --no-sandbox), which is why neither script carries a
workaround.

If a future image bumps chromium, find the matching release rather than
patching the scripts — `/opt/pw-browsers/chromium` is a stable symlink to the
binary, and a wheel's revision is one command away:

```bash
ls /opt/pw-browsers                                   # e.g. chromium-1194
pip download playwright==X.Y.Z --no-deps -d /tmp/w && \
  unzip -p /tmp/w/*.whl '*/browsers.json' | grep -A2 '"chromium"'
```

Budget time: smoke-fishing takes a couple of minutes, smoke-spots can run past
15. A cut-off mid-run looks like a hang ("retrying click action") but is just
the timeout landing inside playwright's normal actionability retry — give it
room before calling it a failure. Expected: 13 checks (fishing), 80 (spots),
both ending in a pass banner and `exit 0`; the banners only print when zero
checks failed.

## Merging (standing instruction from the playtester)
Do NOT ask for permission to merge when BOTH hold: the change is verified
green by the full suite above, and the outcome is unambiguous — a rebuild, a
docs edit, a fix whose test now passes. Merge it and say so plainly.

Still stop and ask when any of these is true: the suite is red or flaky, the
change is a design or balance call rather than a correctness one, it deletes
or rewrites content that cannot be regenerated, or you are reporting a
problem you could not explain. "Probably fine" is not certainty — a wrong
merge here deploys straight to the live game, which has no staging step.
Use `preview/` (above) for anything that needs a human eye before it ships.

## Deploy
Commit the regenerated root files (index.html + oe-*.js + modes/) and push to the
default branch. Pages redeploys in ~1-2 min. Never ship index.html without its
oe-*.js siblings from the SAME build.

**The build stamp is how a deploy gets confirmed.** integrate.py versions every
script tag by that file's own hash and stamps a six-character build id into the
header chip (`Prototype v0.1 · abc123`). A player on a stale cached index.html
sees the old game with no error of any kind, so "is my change live?" is
otherwise unanswerable — ask which stamp they see. Pages caches html for about
ten minutes; a hard refresh or a private tab settles it sooner.

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
