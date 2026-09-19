# Thankless — Survivors of the Worst Party

A standalone browser game served by GitHub Pages at `/Odds-Ends/thankless/`.
It shares nothing with the card game at the repo root and is exempt from the
root's generated-file rule: edit `index.html` directly.

The premise is *Master Healer Kale with useless party* played as a Vampire
Survivors run. You control only the healer, Wren. You cannot attack. Your
party fights on its own terms: Brom the tank falls asleep mid-fight, Pip the
archer shoots "the big one" and hits Brom, Vex the mage will not walk and
casts straight through you. Keep three idiots alive for ten minutes and the
Demon King comes to you.

## Files
- `index.html` — the whole game: page, css, code. No art assets; every sprite
  is drawn with canvas primitives, so the page is a single small file.
- `tools/playthrough.py` — a headless bot run (needs `playwright==1.56.0`,
  see the root CLAUDE.md for the pin). Prints the party's state on an
  interval and the run's result; `--tree` runs with every training rank
  bought, `--circle N` picks a circle, `--shots` saves screenshots.

## The loop
- **Mend** casts itself on the most wounded ally inside Wren's range, at a
  mana cost. Mana regenerates slowly; the motes enemies drop refill it, so
  the healer has to move toward the fight to keep healing.
- Four spells on `1`–`4` (or the buttons): **Surge** (big heal), **Ward**
  (shield everyone in range), **Rouse** (wake Brom, calm Pip, scare nearby
  enemies), **Revive** (raise a fallen ally at half HP).
- Kills your party makes earn XP for you. Level-ups offer three cards: heal
  power, mana, range, party damage and HP, and the healer's only offense —
  overhealing that burns enemies, blessed allies that scorch attackers.
- Enemies that get within reach of a healer forget everything else. Brom
  (awake or asleep) draws them otherwise.
- A Demon Knight arrives at 5:00, the Demon King at 10:00. Killing the King
  wins the run and opens the next **Circle** (+35% enemy HP, +20% damage,
  ×1.5 gold per circle).
- Gold from a run buys permanent **Training** ranks on the menu — four
  branches, one per party member. Save lives in `localStorage` under
  `thankless-save-v1`.

## Shipping
1. Edit `index.html`.
2. `node --check` the script block (the playthrough script or a quick
   `python3 -c` extraction works), then `python3 thankless/tools/playthrough.py`.
3. Bump `const BUILD='bNNN-name'`; the stamp shows bottom-left so a deploy can
   be confirmed.
4. Commit and push to main. Pages redeploys in a minute or two.

## Balance notes
Tuned with the bot at 8× speed. An untrained save should wipe somewhere past
four minutes; a fully trained one should reach the King. Enemy HP scales
`1 + t/150`, damage `1 + t/360`; the party's damage grows 10% per healer
level so the run snowballs the way a survivors game should.
