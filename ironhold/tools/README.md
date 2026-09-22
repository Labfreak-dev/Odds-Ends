# Ironhold tools

Headless test and simulation harness for `ironhold/index.html`. Everything here drives the real page with Playwright (`pip install playwright==1.56.0`; Chromium is preinstalled in the web session).

- `mkdbg.sh` builds a debug copy of the game with `dbg_hook.txt` spliced in before the closing `})();` — the hook exposes the game's internals as `window.__D` — into the scratchpad's `srv/dbg6/`. `ensure_srv.sh` serves that folder on port 8899. Both scripts carry the scratchpad path of the session that wrote them; adjust the paths for a new session.
- `test_*.py` are the regression suites: each prints PASS/FAIL lines and a final `FAILS n`. `test_bite` covers the realm scaling, boss chests, unique rates, buildings, the Pretender and the Sovereign harness; `test_wyrm` the Wyrm tally; `test_restless2` the Restless Dead bound (needs a late-realm save); the rest cover sets, the Mimic, deeds, gear, the away report, the laboratory, the Quartermaster, the combat log, layout fit and the champion looks.
- `playthrough.py TARGET SPEED [SAVE HOURS]` is the efficient-player bot: it plays a fresh save (or resumes `SAVE` at `HOURS` on the clock) with every Coach automation on, wears and forges what drops, buys buildings, companions and kit, feeds the Mimic, marches at a 40% hit chance, farms the Wyrm's tally where it hits 70%, and ascends the moment it can. `SPEED 1` lets it use double time once the Coach unlocks it. It prints an `ASCEND {...}` record per realm and saves each ascension state, and dumps a `STALL` record with diagnostics and a save if nothing moves for 120 sim-hours. The balance of b193 to b201 was measured with it.

- `test_intro.py` — the boot curtain: cold, warm (Cache API), slow road (Enter button), missing art.
- `test_catch.py` — the sliced catch-up: fidelity against the old fixed step, the 24 h boot, the report, the fight after.
- `test_step.py` — kill rate and speed by sim step (0.6, adaptive, 1.2) over six hours from a save.
- `test_relic.py` — relics and chests: the field chest (open, tap, stow, timeout), the reveal, the hold, pity, the Superior floor, the hoard, the drop rate over two hours in two areas.
