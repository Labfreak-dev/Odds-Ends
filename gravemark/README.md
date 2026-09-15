# Gravemark

A standalone browser idle ARPG served by GitHub Pages at `/Odds-Ends/gravemark/`.
It shares nothing with the card game at the repo root or with `ironhold/`, and
is exempt from the root's generated-file rule.

Built in the shape of **Path of Idle: Old Gods Rising** — auto-battle, a
warband, a passive tree, a town, five adventure modes, seasons and prestige —
with two decisions of its own: **there are no items**, and **death is the
crafting system**.

## The shape of it

Three columns, all visible at once, so you never stop watching the game to
manage a menu:

```
  the parish          three live delves        the warband
  ----------          -----------------        -----------
  painted scene       squad 1 fighting         22-hero roster
  building markers    squad 2 fighting         portraits, ranks,
  currencies          squad 3 fighting         levels, squad
  charter strip       each with its own        assignment
                      depth and orders
```

A **warband** of up to 22 heroes, split across **three squads that delve
simultaneously**. Each squad has its own depth, its own orders and its own life
pool; each hero has their own class, rank, level and traits. The passive tree,
the parish and ascension are shared, because those are the player's
institution rather than any one person's.

Everything that used to be a tab — hero, names, tree, parish, gravemarks,
ascension — opens as an overlay over the three columns.

## A hero is a whole unit

Hire a Reaver and you get a Reaver: sword, scarred leathers, the lot. There is
nothing to equip and nothing to take off. Each class fixes a **weapon** (family,
damage factor, attack speed, crit) and a **kit** (armour, evasion, life
multipliers on one shared curve); the **level** grows the kit along
`GM.CURVE.kitG`; the **rank** (I / II / III) multiplies the whole hero, raises
the level cap and adds a trait slot; and **anointing** (shards) raises the
rank of a hero you already have. The only thing ever *added* to a hero is a
trait — an epitaph cut in after a death.

That is the whole of a hero's progression: level, rank, names. No drops, no
stash, no bench, no runes. Gold hires and builds; shards cut names and anoint.

## The spin: death is the crafting system

Path of Idle's most common complaint is that the endgame collapses into an
RNG-fest for equipment stats. Gravemark's answer:

- A squad that is broken loses **nothing**. It leaves a **gravemark** at that
  depth naming everyone who fell: every trait they carried, and one thing each
  of them *learned* dying there — a roll for their class at that depth (two if
  a boss did it). A green squad's first death is still worth something.
- Kill at or below that depth to recover it. It pays an **Epitaph**: one of
  those exact rolls, at its exact tier and its exact value.
- An Epitaph can be **inscribed** onto any hero whose class can carry it —
  deterministically. No roll, no range, no second attempt. A same-group name
  replaces the weaker one; a full hero (two names at rank I, four at III)
  needs one cut away.
- Leave a gravemark too long and it stands up as a **Revenant** of the squad
  that fell. Beat it to claim double epitaphs and a purse of shards.

So the endgame is "die deep, remember what it taught you, cut it into the hero
who needs it" rather than "reroll until the dice are kind". The vocabulary
lives in `src/01-data-kit.js`; every name says which classes can learn it.

## Files

```
index.html          the three-column shell; script tags in load order
css/main.css        every colour is a token on :root — retheme here
src/00-18-*.js      logic layer (no DOM)
src/30-ui.js        shell core: currencies, tooltips, render router
src/31-ui-hub.js    left column: the parish
src/32-ui-battle.js centre column: three live battle panels
src/33-ui-roster.js right column: the warband
src/34-ui-overlay.js everything that used to be a tab
src/99-boot.js      the game loop
tools/              harness, tests, balance, art tooling
art/                drop real art here; absent art draws as placeholders
```

Classic scripts, no build step, no bundler, no dependencies. Open `index.html`
and it runs.

### Load order matters

The files are plain `<script>` tags sharing **one global scope**. Two files
declaring the same top-level name silently clobber each other — this already
happened once (`_cache` in both the stat cache and the art cache, so
invalidating stats nulled the art cache). `tools/check-globals.js` fails on any
duplicate; run it after adding a file.

Everything hangs off the single global `GM`.

## Verify before any deploy

```bash
for f in src/*.js; do node --check "$f"; done   # every file parses
node tools/check-globals.js                      # no top-level collisions
node tools/test-core.js                          # 123 logic checks
node tools/balance.js                            # pacing across depths
python3 tools/smoke.py                           # 37 checks, real page headless
python3 tools/art-check.py art                   # delivered art matches the manifest
```

`smoke.py` needs playwright **pinned**:

```bash
pip install playwright==1.56.0     # NOT plain `pip install playwright`
```

The image ships chromium revision 1194 and 1.56.0 is the release that wants
exactly that. Installing the newest demands a revision that is not on disk and
then tells you to run `playwright install` — don't; it re-downloads browsers
that are already there.

## Balance

`tools/balance.js` outfits a plausible SQUAD at a range of depths and reports
time-to-clear-the-pack against time-to-be-broken, for a normal pack and for that
realm's boss separately. Sampling only round-numbered depths measures nothing but
bosses, since every tenth stage is one.

All scaling constants live in `GM.CURVE` in `src/03-data-world.js` and nowhere
else. These are load-bearing and were measured rather than guessed:

| constant | why it is what it is |
|---|---|
| `kitDmg0`, `kitArm0`, `kitEva0`, `kitLife0`, `kitG` | The class kit at level 1 and its per-level growth. With class growth on top a levelling squad's damage grows ~1.10 per depth, matching `monHpG`; the tree, ranks and names are the edge. |
| `monHpG` / `monDmgG` | 1.100 and 1.075. Life grows a shade faster than damage so a warband gains ground on offence before it needs every defensive name. |
| `deepFrom` / `deepG` | Past depth 60 the world hardens 1.8% a depth faster. Without it a rank III warband with a full tree made depth 100+ a half-second pack; with it the endgame tightens and anointing, deep epitaphs and ascension carry it. |
| `early0` | Monster strength at depth 1 as a fraction of the curve, ramping to 1 by 25. With gear tiers gone the kit is a smooth curve, and a 0.10 start made depths 22–55 a valley the warband could not climb out of. 0.18 keeps the opening brisk without stealing the mid-game. |
| `depthScale` | The flat half of an epitaph scales 1.035 per depth it was learned at, so a depth-120 lesson genuinely beats a depth-84 one of the same tier. |
| `packsPerStage` | The single most important pacing number. At one pack per depth a squad gained a depth every ~15s, so difficulty compounded 1.10× per quarter-minute while three level-1 heroes split experience three ways. It out-climbed its own power and wiped inside two minutes, every time. |

One bug found while re-measuring is worth recording: `GM.squadStats` used to
sum each member's raw *hit* and then declare the squad's attack speed and crit
factor to be 1, so a squad fought at roughly half the damage its sheet showed
and every speed or crit node on the tree did nothing in combat. The squad's
`elemHit` is now damage per second by element; against an unresisting target
it equals the members' summed dps exactly, and the suite checks that it does.

Two behaviours keep a squad from grinding itself to death on Auto:

- **The advance gate.** A squad holds at the deepest depth it can survive and
  only advances once the next one looks winnable with room to spare. The check
  is sampled five times and judged on the WORST roll, because elites are 2.6x
  life and a pack that rolls three of them is a different fight from the mean.
  Turning `push` on removes the brake for a player who wants the gravemarks.
- **The wipe ceiling.** A broken squad remembers the depth that broke it and
  will not climb straight back into it. Without these two, five hours of
  unattended play produced 126 wipes; with them, 69, and the same depth.

`GM.LEECH_CAP` matters just as much: leech is capped as a fraction of maximum
life per second, not of damage dealt. Uncapped, leech scales with damage while
incoming scales with depth, and past a point every squad is immortal.

Change any of these and re-run `balance.js`.

## Art

The game references **no image path directly**. It asks `GM.art(key)` and gets
either the real asset or a procedurally drawn, labelled placeholder, so it is
fully playable with zero image files. Backdrops resolve to `.jpg` (no alpha,
a tenth the bytes); everything else to `.png`.

`src/18-assets.js` is the manifest: 493 keys, most of them rig parts. It is
built programmatically from the game data, so adding a monster to
`03-data-world.js` adds its art keys automatically and the brief cannot drift
out of date. With items gone there are no item icons, rune glyphs, rarity
frames or paper-doll layers in it; the five **class looks**
(`actor/look-<class>`, one standing figure each) took their place.

**Current coverage: 158 of 493 painted.** `ART-REMAINING.md` lists the rest.
All twelve bosses, all fifteen monsters, the five class looks, the hero, the
five weapons and seventeen of eighteen backdrops are in. Outstanding: the rig
parts, the post-apocalypse backdrops (the current ones are the old night
graveyards), and the UI chrome (which the renderer does not consume yet — the
UI is CSS).

The art direction changed with the class looks: a sun-bleached, colourful
post-apocalypse rather than a graveyard at night. `GROK-CHARACTERS.md` and
`GROK-BACKDROPS.md` are the prompts. Deliveries arrive as tall portraits on
magenta; `tools/fit-figure.py <dir> --out STAGE --mirror a,b` keys them, crops
to the figure, fits each onto its manifest canvas with the feet at 96%, and
mirrors the named ones so every hero file faces right and every monster file
faces left. The renderer flips a painting only when its manifest facing
differs from the way the actor looks, and draws a class look untinted.

Until per-class hero art exists the battle panels and roster portraits tint
each hero toward their class colour (cached per key+hue, not composited per
frame) and jitter their scale and footing from a hash of their id, so five
copies of one sprite still read as five people.

**Nothing delivered so far is animated.** Every painted sheet arrived with all
frames identical, and all twelve hero states are byte-for-byte the same image —
so the hero renders as one pose and never changes. The renderer derives frame
count from each image's own width rather than from the manifest, so these ship
collapsed to a single frame and a genuinely animated replacement drops in later
with no code change.

### Installing an art delivery

```bash
node tools/art-manifest.js > /tmp/manifest.json
python3 tools/art-install.py <unzipped-art-dir>      # writes art/
python3 tools/art-check.py art --remaining ART-REMAINING.md
```

`art-install.py` does three things that matter:

1. **Installs only what is actually painted.** Deliveries ship on-spec filler
   for unfinished keys. A placeholder file on disk *loads successfully*, and the
   renderer then draws it. A file that is ABSENT falls back to the game's own
   placeholder, which is what we want, so filler is detected and left out.
2. **Repairs mattes.** Figures frequently arrive pasted on a light card rather
   than cut out, which on a dark backdrop reads as a bright rectangle. Detection
   samples the opaque bounding-box perimeter (a card has a uniform opaque ring;
   a cut-out sprite's is mostly transparent), then region-grows from inside the
   card. Seeding from the frame border does not work: the card's own boundary is
   a hard edge the flood cannot cross.
3. **Collapses static sheets** to a single frame.
4. **Refuses wrong-sized assets.** One that installs quietly is worse than one
   that is missing, because it only breaks when that key is finally wired up.

`--exclude <prefix>` skips a category.

Deliver art at `art/<key>.png` — e.g. `art/mon/shambler-idle.png`. Sprite sheets
are a single horizontal strip of frames.

```bash
node tools/art-brief.js    > ART-BRIEF.md    # the full brief, every key
node tools/grok-prompts.js > GROK-PROMPTS.md # one prompt per MISSING asset
```

### How the characters move

`src/07-data-rig.js` is a small skeletal animator — the way Path of Idle moves.
A character is painted once as separate body parts, a bone hierarchy carries
them, and the motion is keyframed on the bones in code: idle, five weapon
swings, hit, death, walk, plus monster attacks. One rig and one set of clips
drive every humanoid in the game.

Every actor on a battle panel is drawn in one of two modes, chosen per frame:

- **RIG** — the character has a complete set of parts in `art/parts/<char>/`.
  Bones carry the parts. `GM.RIG_DEBUG = true` forces this mode with capsule
  bones so the motion can be judged before any parts exist.
- **SPRITE** — otherwise. The whole-figure painting is driven by the ROOT bone
  (lunge, squash, lean, bob), so it works with the art in the repo today. If a
  delivered multi-frame sheet exists for the clip, its frame is picked by clip
  progress and the root motion applies on top. A delivered weapon part is drawn
  at the invisible rig's hand during a swing, so the real blade follows the
  trail even before the body parts exist (the five weapons are in).

`src/20-vfx.js` is the layer on top of either mode: weapon trails (the rig's
weapon tip is known even when the rig is not drawn, so the trail arcs on a flat
painting), a white hit flash, spark and dust bursts, floating damage numbers
and panel shake. Per-swing damage is the hero's share of the squad's rate
against that monster's resistances — honest numbers, not random ones.

Parts are specified once in `GM.Rig.PARTS` — canvas size, pivot joint, what to
paint — and both the drawer and `tools/grok-parts.js` read that table, so the
brief and the game cannot disagree.

```bash
node tools/grok-parts.js > GROK-PARTS.md     # the parts brief, tiered
```

**Ask for parts as ONE exploded sheet, not eleven crops.** The first delivery
proved a generator asked for "only the forearm" crops a rectangle of cloth out
of the reference — no silhouette, nothing a bone can carry. Asked for a cut-out
puppet sheet (the figure taken apart, pieces laid out with gaps on magenta) it
paints real pieces. `tools/slice-parts.py sheet.png hero --out DIR` finds
the pieces, sorts them into the brief's rows, and places each on its manifest
canvas with the joint on the pivot; `art-install.py DIR` then installs them.
`GROK-TIER1.md` is the current ask. `tools/shot-swing.py . out.png` freezes
every hero mid-swing on a different weapon for a look.

Two installer lessons from that delivery: the index (`art/available.json`) is
rebuilt from what is on disk, never from one run's installs — a five-file
delivery used to shrink it to five keys and unload everything else; and the
filler test accepts a flat-shaded piece when it has a real silhouette, since a
dozen-colour dagger is art, if off-style, not a blank card.

### Getting animation out of a tool that makes single images

Eight deliveries have asked for "an 8-frame sheet" and returned the same pose
copied eight times. Image generators cannot lay out a sprite strip.

The renderer derives frame count from each image's own width, so a **3-frame**
animation is valid art. Ask for numbered single frames instead and stitch them:

```bash
# delivered: actor/hero-attack-sword-1.png, -2.png, -3.png
python3 tools/make-sheet.py <their-folder>
```

It groups by the key before the trailing `-<n>`, orders by that number, keys out
the magenta and writes the strip. The rule that makes it work is that every
frame of an action must be the same character at the same size and footing with
only the pose changed — prompt frame 2 with frame 1 attached as reference.

### Class looks

A hero is a whole unit, so its whole appearance is one painting:
`actor/look-<class>`, a finished standing figure per class. Until a class has
its own, the battle panels and roster portraits tint the shared hero painting
to the class hue. `GM.heroLookKey()` resolves a hero to its look; the rig
prefers `parts/<class>/` when a class's set is complete on disk and falls back
to the shared `parts/hero/` set (`GM.heroPartsId()`), so the Tier 1 parts
delivery animates every class the day it lands.

### Backgrounds on delivered art

Ask for a **flat magenta `#FF00FF`** background, never "transparent" — requests
for transparency come back as a white card, and a white card on a dark backdrop
is a bright rectangle. `art-install.py` keys magenta out on install (verified:
55k background pixels removed, 3 survivors, figure untouched).

## Deploy

Commit and push; Pages redeploys in a minute or two. The build stamp under the
title (`GM.BUILD` in `src/00-util.js`) is how a deploy gets confirmed — bump it
with any shipped change, because a player on a stale cached page sees the old
game with no error of any kind.
