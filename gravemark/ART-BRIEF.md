# Gravemark — Art Brief

_Generated from `src/18-assets.js` by `tools/art-brief.js`. Do not hand-edit — regenerate._

**288 assets** · 169 animated sprite sheets · 1288 individual frames · 45 paper-doll gear layers

The game references **no image path directly** — it asks `GM.art(key)` and falls back to a labelled placeholder. Drop a finished file at `art/<key>.png` and it appears. Nothing in the game code changes. Deliver in any order; partial sets work.

---

## 1. The master prompt

Paste this ahead of any individual asset prompt below. Every asset in the pack shares it.

```
Hand-painted 2D game art for "Gravemark", a Lovecraftian gravedigging action-RPG.

STYLE: painterly hand-painted 2D with visible brush texture. Cold, damp, cut stone.
A working graveyard that has been working far too long. Weathered granite, wet earth,
guttering lamplight, sorted bone. NOT vector, NOT pixel art, NOT 3D render, NOT cartoon.

LIGHT: single low warm key source against cold blue-grey ambient fill. Rim light to
separate the figure from the ground.

VALUE: dark overall. Backgrounds 8-20% luminance. Narrow bright range reserved for
bone, metal and lamplight. The silhouette must read clearly at 25% scale.

COLOUR: desaturated blue-grey base (#0c0d10 to #3d4454) with exactly ONE saturated
accent per asset. Bone #e6e0cf is the brightest neutral. Gold #d9b45c is the only
UI accent.

OUTPUT: transparent PNG background (except backdrops). No text, no letters, no numbers,
no watermark, no signature, no logo, no UI frame around the subject, no drop shadow
baked in.
```

## 2. Palette

| role | hex | note |
|---|---|---|
| Ground / panel | `#0c0d10 → #22262f` | near-black blue-grey; all chrome sits in this band |
| Edge / bevel | `#2e3340 → #3d4454` | cut-stone edges, panel borders |
| Bone | `#e6e0cf` | the brightest neutral; bone, parchment, lamplight |
| Gold | `#d9b45c` | the single UI accent; gilding, rank, selection |
| Blood | `#8c2f33 → #c0474c` | player health, wounds, danger |
| Moss | `#5a6b3a → #87a154` | monster health, damp growth |
| Physical | `#b9bfcc` | steel grey |
| Fire | `#e0762f` | ember orange |
| Frost | `#5fb7d1` | pale ice blue |
| Storm | `#e0c53a` | sick yellow |
| Void | `#a45fd1` | wrong purple |

Rarity colours (used on item icons and frames):

| rarity | colour |
|---|---|
| Common | #8b909c grey |
| Magic | #5b8fd6 blue |
| Rare | #d9b45c gold |
| Epic | #a45fd1 purple |
| Legendary | #e0662f orange |
| Mythic | #e03a5f red |

## 3. Technical spec — read before drawing anything animated

**Sprite sheets are a single horizontal strip.** Frame 1 leftmost. No padding, no gaps, no grid. Sheet width = frame width × frame count; sheet height = frame height. The loader slices by `naturalWidth / frames`, so an off-by-one column breaks every frame.

```
  ┌────────┬────────┬────────┬────────┬────────┬────────┬────────┬────────┐
  │  f1    │  f2    │  f3    │  f4    │  f5    │  f6    │  f7    │  f8    │   256px tall
  └────────┴────────┴────────┴────────┴────────┴────────┴────────┴────────┘
    256px    each frame is a fixed 256x256 cell — the figure may not drift between cells
```

- **Facing:** the hero and all gear layers face **RIGHT**. All monsters and bosses face **LEFT**. They meet in the middle.
- **Footing:** the character's feet rest at **96% of frame height**, horizontally centred at 50%. Every frame of every state and every gear layer uses the same footing, or the character bobs when the state changes.
- **Transparency:** true alpha. No matte, no halo, no semi-transparent fringe inside the silhouette.
- **No baked shadow.** The game draws the ground.

**Anchor points** (fractions of the frame) — weapons are drawn at the grip, so the hand must be here in every frame:

| anchor | x | y | meaning |
|---|---|---|---|
| `gripMain` | 0.62 | 0.52 | main hand — weapon pivots here |
| `gripOff` | 0.34 | 0.55 | off hand — shield/tome |
| `head` | 0.5 | 0.22 | helm sits here |
| `feet` | 0.5 | 0.96 | ground contact |

### Animation states

| state | frames | fps | loops | what it is |
|---|---|---|---|---|
| `idle` | 6 | 8 | yes | breathing / weapon at rest |
| `walk` | 8 | 12 | yes | full stride cycle, contact-down-pass-up x2 |
| `run` | 8 | 16 | yes | faster stride, longer extension, more lean |
| `attack` | 8 | 14 | no | wind-up, strike on frame 4, recovery |
| `cast` | 8 | 12 | no | gather on 1-4, release on 5, settle |
| `hit` | 3 | 14 | no | flinch back and recover |
| `death` | 8 | 10 | no | collapse; final frame rests on the ground |

**Attack timing is load-bearing.** The game plays `attack` once per swing at the character's real attack speed, so the strike must land on **frame 4 of 8**. Frames 1–3 are wind-up, 4 is contact, 5–8 are recovery. A swing that peaks late reads as lag.

**Walk and run must loop seamlessly** — frame 8 flows into frame 1 with no hitch. Standard 8-frame stride: contact, down, pass, up, contact (opposite), down, pass, up.

## 4. Paper-doll gear — every equipped item is visible on the character

This is the largest and most important part of the pack. The character is drawn as a **stack of layers**, one per equipped slot, composited in z-order. Every gear layer is its own sprite sheet that must align **frame-for-frame** with the body sheets: gloves layer frame 4 must match body frame 4 exactly, or the hand detaches mid-swing.

| z | layer | slot | note |
|---|---|---|---|
| 0 | `back` | offhand | slung shield / tome, behind the body |
| 10 | `body` | — | the bare character; every other layer aligns to this |
| 20 | `boots` | boots |  |
| 25 | `legs` | body | lower half of the body armour |
| 30 | `chest` | body | upper half of the body armour |
| 35 | `belt` | belt |  |
| 40 | `gloves` | gloves |  |
| 50 | `helm` | helm |  |
| 55 | `offhand` | offhand | when actively held rather than slung |
| 60 | `weapon` | weapon | held at the grip point; follows the attack arc |
| 70 | `fx` | — | element tint, crit flash, leech motes |

**Rules for every gear layer:**

1. Draw it *on* a copy of the base body so the fit is right, then delete the body and export only the gear.
2. Same 256×256 cells, same footing, same frame count as the body state it accompanies.
3. Only the parts the slot covers. A `gloves` layer is two hands and forearms — nothing else.
4. Gear must read at three tier bands: **low** (rusted, lashed, improvised), **mid** (forged, fitted, ornamented), **high** (reliquary-grade, gilded, carved with names).

---

## 5. The asset list, by category

### Hero — body  _(12 assets)_

Prompt: `A lone gravedigger-warrior, wiry and weather-beaten, wrapped in oilcloth and leather, face shadowed under a hood. Neutral undyed clothing — this is the naked base that all gear layers paint over, so keep it plain and keep the silhouette narrow. Facing right. [STATE].`

Draw the generic `hero-attack` first, then the five weapon-specific swings — a maul does not move like a dagger:

- `dagger` — short, fast, low stab; body stays compact, minimal follow-through
- `sword` — diagonal shoulder-to-hip cut with a clean recovery
- `maul` — full overhead, whole body committed, heavy settle afterwards
- `wand` — no swing: a gathering gesture and a release; weight stays back
- `scythe` — wide horizontal sweep that carries the body around

| key | size | frames | subject |
|---|---|---|---|
| `actor/hero-idle` | 256×256 | 6 | breathing / weapon at rest |
| `actor/hero-walk` | 256×256 | 8 | full stride cycle, contact-down-pass-up x2 |
| `actor/hero-run` | 256×256 | 8 | faster stride, longer extension, more lean |
| `actor/hero-attack` | 256×256 | 8 | wind-up, strike on frame 4, recovery |
| `actor/hero-cast` | 256×256 | 8 | gather on 1-4, release on 5, settle |
| `actor/hero-hit` | 256×256 | 3 | flinch back and recover |
| `actor/hero-death` | 256×256 | 8 | collapse; final frame rests on the ground |
| `actor/hero-attack-dagger` | 256×256 | 8 | attack swing specific to the dagger family |
| `actor/hero-attack-sword` | 256×256 | 8 | attack swing specific to the sword family |
| `actor/hero-attack-maul` | 256×256 | 8 | attack swing specific to the maul family |
| `actor/hero-attack-wand` | 256×256 | 8 | attack swing specific to the wand family |
| `actor/hero-attack-scythe` | 256×256 | 8 | attack swing specific to the scythe family |

### Revenant — the player's own corpse  _(4 assets)_

Prompt: `The same gravedigger silhouette as the hero, but drowned-pale and wrong: jaw slack, eyes lamplit from inside, still wearing the gear it died in, hanging off it. Must be instantly recognisable as the hero — same proportions, same hood — and instantly wrong. Void purple #a45fd1 accent. Facing left.`

| key | size | frames | subject |
|---|---|---|---|
| `actor/revenant-idle` | 256×256 | 8 | silhouette must read as the hero, corrupted |
| `actor/revenant-attack` | 256×256 | 8 | silhouette must read as the hero, corrupted |
| `actor/revenant-hit` | 256×256 | 8 | silhouette must read as the hero, corrupted |
| `actor/revenant-death` | 256×256 | 8 | silhouette must read as the hero, corrupted |

### Paper-doll gear layers  _(45 assets)_

Each key is `doll/<layer>-<family>-<band>`. Bands: `low` rusted/improvised, `mid` forged/fitted, `high` reliquary-grade/gilded. Must align frame-for-frame with the hero sheets (8 frames, 256×256, footing at 96%).

| key | size | frames | subject |
|---|---|---|---|
| `doll/back-shield-low` | 256×256 | 8 | gear layer, must align frame-for-frame with actor/hero-* sheets |
| `doll/back-shield-mid` | 256×256 | 8 | gear layer, must align frame-for-frame with actor/hero-* sheets |
| `doll/back-shield-high` | 256×256 | 8 | gear layer, must align frame-for-frame with actor/hero-* sheets |
| `doll/back-tome-low` | 256×256 | 8 | gear layer, must align frame-for-frame with actor/hero-* sheets |
| `doll/back-tome-mid` | 256×256 | 8 | gear layer, must align frame-for-frame with actor/hero-* sheets |
| `doll/back-tome-high` | 256×256 | 8 | gear layer, must align frame-for-frame with actor/hero-* sheets |
| `doll/boots-boots-low` | 256×256 | 8 | gear layer, must align frame-for-frame with actor/hero-* sheets |
| `doll/boots-boots-mid` | 256×256 | 8 | gear layer, must align frame-for-frame with actor/hero-* sheets |
| `doll/boots-boots-high` | 256×256 | 8 | gear layer, must align frame-for-frame with actor/hero-* sheets |
| `doll/legs-body-low` | 256×256 | 8 | gear layer, must align frame-for-frame with actor/hero-* sheets |
| `doll/legs-body-mid` | 256×256 | 8 | gear layer, must align frame-for-frame with actor/hero-* sheets |
| `doll/legs-body-high` | 256×256 | 8 | gear layer, must align frame-for-frame with actor/hero-* sheets |
| `doll/chest-body-low` | 256×256 | 8 | gear layer, must align frame-for-frame with actor/hero-* sheets |
| `doll/chest-body-mid` | 256×256 | 8 | gear layer, must align frame-for-frame with actor/hero-* sheets |
| `doll/chest-body-high` | 256×256 | 8 | gear layer, must align frame-for-frame with actor/hero-* sheets |
| `doll/belt-belt-low` | 256×256 | 8 | gear layer, must align frame-for-frame with actor/hero-* sheets |
| `doll/belt-belt-mid` | 256×256 | 8 | gear layer, must align frame-for-frame with actor/hero-* sheets |
| `doll/belt-belt-high` | 256×256 | 8 | gear layer, must align frame-for-frame with actor/hero-* sheets |
| `doll/gloves-gloves-low` | 256×256 | 8 | gear layer, must align frame-for-frame with actor/hero-* sheets |
| `doll/gloves-gloves-mid` | 256×256 | 8 | gear layer, must align frame-for-frame with actor/hero-* sheets |
| `doll/gloves-gloves-high` | 256×256 | 8 | gear layer, must align frame-for-frame with actor/hero-* sheets |
| `doll/helm-helm-low` | 256×256 | 8 | gear layer, must align frame-for-frame with actor/hero-* sheets |
| `doll/helm-helm-mid` | 256×256 | 8 | gear layer, must align frame-for-frame with actor/hero-* sheets |
| `doll/helm-helm-high` | 256×256 | 8 | gear layer, must align frame-for-frame with actor/hero-* sheets |
| `doll/weapon-dagger-low` | 256×256 | 8 | gear layer, must align frame-for-frame with actor/hero-* sheets |
| `doll/weapon-dagger-mid` | 256×256 | 8 | gear layer, must align frame-for-frame with actor/hero-* sheets |
| `doll/weapon-dagger-high` | 256×256 | 8 | gear layer, must align frame-for-frame with actor/hero-* sheets |
| `doll/weapon-sword-low` | 256×256 | 8 | gear layer, must align frame-for-frame with actor/hero-* sheets |
| `doll/weapon-sword-mid` | 256×256 | 8 | gear layer, must align frame-for-frame with actor/hero-* sheets |
| `doll/weapon-sword-high` | 256×256 | 8 | gear layer, must align frame-for-frame with actor/hero-* sheets |
| `doll/weapon-maul-low` | 256×256 | 8 | gear layer, must align frame-for-frame with actor/hero-* sheets |
| `doll/weapon-maul-mid` | 256×256 | 8 | gear layer, must align frame-for-frame with actor/hero-* sheets |
| `doll/weapon-maul-high` | 256×256 | 8 | gear layer, must align frame-for-frame with actor/hero-* sheets |
| `doll/weapon-wand-low` | 256×256 | 8 | gear layer, must align frame-for-frame with actor/hero-* sheets |
| `doll/weapon-wand-mid` | 256×256 | 8 | gear layer, must align frame-for-frame with actor/hero-* sheets |
| `doll/weapon-wand-high` | 256×256 | 8 | gear layer, must align frame-for-frame with actor/hero-* sheets |
| `doll/weapon-scythe-low` | 256×256 | 8 | gear layer, must align frame-for-frame with actor/hero-* sheets |
| `doll/weapon-scythe-mid` | 256×256 | 8 | gear layer, must align frame-for-frame with actor/hero-* sheets |
| `doll/weapon-scythe-high` | 256×256 | 8 | gear layer, must align frame-for-frame with actor/hero-* sheets |
| `doll/offhand-shield-low` | 256×256 | 8 | gear layer, must align frame-for-frame with actor/hero-* sheets |
| `doll/offhand-shield-mid` | 256×256 | 8 | gear layer, must align frame-for-frame with actor/hero-* sheets |
| `doll/offhand-shield-high` | 256×256 | 8 | gear layer, must align frame-for-frame with actor/hero-* sheets |
| `doll/offhand-tome-low` | 256×256 | 8 | gear layer, must align frame-for-frame with actor/hero-* sheets |
| `doll/offhand-tome-mid` | 256×256 | 8 | gear layer, must align frame-for-frame with actor/hero-* sheets |
| `doll/offhand-tome-high` | 256×256 | 8 | gear layer, must align frame-for-frame with actor/hero-* sheets |

### Monsters  _(15 archetypes × 4 states)_

Each gets `idle` (6f, loops), `attack` (8f, strike on frame 4), `hit` (3f), `death` (8f, final frame rests on the ground). All face **LEFT**.

| archetype | element | prompt seed |
|---|---|---|
| **Shambler** `mon/shambler-*` | Physical | A corpse that has got up out of habit rather than malice. Grave-dirt, slack limbs, no weapon. |
| **Grave Dog** `mon/gravedog-*` | Physical | A long, starved dog with too many ribs showing and soil packed under its claws. |
| **Body Snatcher** `mon/digger-*` | Physical | A living man in an oilcloth apron with a spade and a sack, angry at being interrupted. |
| **Bone Pile** `mon/bonepile-*` | Physical | A heap of sorted bones that has assembled itself wrong — too many femurs, one skull on top. |
| **Hollow Mourner** `mon/mourner-*` | Frost | A veiled figure in soaked black crepe, hands empty, drifting a hand's width above the ground. |
| **Barrow Chill** `mon/chill-*` | Frost | A barrow-cold shape, more frost-rime outline than body, pale ice blue #5fb7d1. |
| **Drowned Chorister** `mon/drowned-*` | Storm | A choirboy long underwater, robes heavy, mouth open in a note that never ends. Storm yellow. |
| **Bellwright** `mon/bellwright-*` | Storm | A hunched bell-founder carrying a cracked bronze bell that rings when it strikes. |
| **Ash Walker** `mon/ashwalker-*` | Fire | A body walking while still burning, ash sloughing off with every step. Ember orange. |
| **Pyre Cultist** `mon/pyrecult-*` | Fire | A robed cultist with a censer of live coals, face masked in beaten copper. |
| **Turned Stone** `mon/stonewake-*` | Physical | A grave marker that has turned to face you, granite limbs grinding as it moves. |
| **Empty Reliquary** `mon/reliquary-*` | Void | An open, empty reliquary casket walking on brass legs. Void purple glow from inside. |
| **The Vigilant** `mon/vigilant-*` | Void | A tall watcher in funeral dress with a lantern that gives no light. Void purple. |
| **The Unnamed** `mon/unnamed-*` | Void | A figure whose face will not hold still — features sliding off. Deeply wrong. Void purple. |
| **Threshold Warden** `mon/threshold-*` | Void | An enormous armoured gate-warden of fused stone and bone, barring the way. Void purple. |

### Bosses  _(12 × 4 states, 384×320)_

Bosses are bigger, slower and read as an *event*. Each gets `idle` (8f, loops), `attack` (8f), `special` (12f — the signature move, more elaborate), `death` (8f). All face **LEFT**.

| boss | realm | element | prompt seed |
|---|---|---|---|
| **The Pauper King** `boss/b_pauper-*` | 1 | Physical | A corpse crowned with bent wire and bottle glass, ruling a field of the unmarked. |
| **Sexton Ambrose** `boss/b_sexton-*` | 2 | Physical | A gaunt records-keeper with a ledger chained to his wrist, still writing. |
| **The Sorted Man** `boss/b_ossuary-*` | 3 | Frost | A meticulous figure of perfectly arranged bone, offended by disorder. |
| **Barrow-Mother** `boss/b_barrow-*` | 4 | Frost | A vast frost-caked matriarch rising out of a burial mound, roots and ice trailing. |
| **The Ninth Bell** `boss/b_drowned-*` | 5 | Storm | An immense bronze bell with a drowned figure fused inside it, ringing underwater. |
| **Cinder Magistrate** `boss/b_ashfall-*` | 6 | Fire | A magistrate of cinders in scorched judicial robes, gavel of burning stone. |
| **The Counted Stone** `boss/b_turning-*` | 7 | Storm | A monolith that is never facing the way you left it. Grinding granite, storm yellow seams. |
| **What Was Kept Here** `boss/b_hollow-*` | 8 | Void | Whatever was kept in the reliquary — a negative space in the shape of a saint. |
| **The Chief Mourner** `boss/b_wake-*` | 9 | Void | The chief mourner, twelve feet of black crepe and folded hands, weeping void. |
| **Cairnspire Itself** `boss/b_cairn-*` | 10 | Fire | The spire itself uprooted and walking, centuries of stacked stone and debt. |
| **The Inside Seal** `boss/b_vault-*` | 11 | Void | The seal on the inside of the door, now standing up. Sealed FROM the inside. |
| **First of the Vigils** `boss/b_thresh-*` | 12 | Void | The first of the vigils. Armoured, patient, older than the ground. Final boss energy. |

### Backdrops  _(1280×720, opaque)_

Wide parallax-friendly paintings. The figures stand on a ground line at ~82% height, so keep the lower 18% simple and uncluttered — it is drawn over. No focal detail dead-centre.

| key | place | flavour |
|---|---|---|
| `bg/realm-1` | **The Paupers' Field** | Unmarked, unbilled, unvisited. The cheapest ground in the world and the busiest. |
| `bg/realm-2` | **Sexton's Row** | Someone kept these records. Someone stopped. |
| `bg/realm-3` | **The Ossuary** | Sorted by bone, not by name. Tidier than it has any right to be. |
| `bg/realm-4` | **Barrowmoor** | The mounds are older than the language that named them. |
| `bg/realm-5` | **The Drowned Cloister** | They rang the bells underwater for a hundred years. Something answered. |
| `bg/realm-6` | **Ashfall Necropolis** | A city built to burn its dead, which eventually burned itself. |
| `bg/realm-7` | **The Turning Stones** | They face a different way each time you count them. Stop counting. |
| `bg/realm-8` | **Hollow Reliquary** | Every casket here is open, and every one of them is empty. |
| `bg/realm-9` | **The Long Wake** | The mourners never left. Neither did the mourned. |
| `bg/realm-10` | **Cairnspire** | Stacked stone, stacked centuries, stacked debts. |
| `bg/realm-11` | **The Unlit Vault** | It was sealed from the inside. Consider what that means. |
| `bg/realm-12` | **Threshold of Vigils** | Past this the ground stops pretending to be ground. |
| `bg/town` | The parish above ground: a chapel, a forge, a vault, lamps lit | |
| `bg/tower` | An impossible spire of stacked funeral architecture receding upward | |
| `bg/dimension` | The same graveyard rendered wrong — colours inverted, geometry folded | |
| `bg/finality` | Past the end of the world; the ground stops pretending to be ground | |
| `bg/graveyard` | A field of the player's own gravemarks under low fog | |
| `bg/title` | The title screen: one lantern, one open grave, rain | |

### Item icons  _(42 assets)_

Square inventory icons, three-quarter view, lit from upper left, on transparent background. Tier band drives the material: `low` rusted iron and lashed cord, `mid` clean forged steel and fitted leather, `high` reliquary-grade with gilding and carved names.

| key | size | frames | subject |
|---|---|---|---|
| `item/dagger-low` | 64×64 | — | Dagger (low tier) |
| `item/dagger-mid` | 64×64 | — | Dagger (mid tier) |
| `item/dagger-high` | 64×64 | — | Dagger (high tier) |
| `item/sword-low` | 64×64 | — | Sword (low tier) |
| `item/sword-mid` | 64×64 | — | Sword (mid tier) |
| `item/sword-high` | 64×64 | — | Sword (high tier) |
| `item/maul-low` | 64×64 | — | Maul (low tier) |
| `item/maul-mid` | 64×64 | — | Maul (mid tier) |
| `item/maul-high` | 64×64 | — | Maul (high tier) |
| `item/wand-low` | 64×64 | — | Wand (low tier) |
| `item/wand-mid` | 64×64 | — | Wand (mid tier) |
| `item/wand-high` | 64×64 | — | Wand (high tier) |
| `item/scythe-low` | 64×64 | — | Scythe (low tier) |
| `item/scythe-mid` | 64×64 | — | Scythe (mid tier) |
| `item/scythe-high` | 64×64 | — | Scythe (high tier) |
| `item/shield-low` | 64×64 | — | Shield (low tier) |
| `item/shield-mid` | 64×64 | — | Shield (mid tier) |
| `item/shield-high` | 64×64 | — | Shield (high tier) |
| `item/tome-low` | 64×64 | — | Tome (low tier) |
| `item/tome-mid` | 64×64 | — | Tome (mid tier) |
| `item/tome-high` | 64×64 | — | Tome (high tier) |
| `item/helm-low` | 64×64 | — | Helm (low tier) |
| `item/helm-mid` | 64×64 | — | Helm (mid tier) |
| `item/helm-high` | 64×64 | — | Helm (high tier) |
| `item/body-low` | 64×64 | — | Body (low tier) |
| `item/body-mid` | 64×64 | — | Body (mid tier) |
| `item/body-high` | 64×64 | — | Body (high tier) |
| `item/gloves-low` | 64×64 | — | Gloves (low tier) |
| `item/gloves-mid` | 64×64 | — | Gloves (mid tier) |
| `item/gloves-high` | 64×64 | — | Gloves (high tier) |
| `item/boots-low` | 64×64 | — | Boots (low tier) |
| `item/boots-mid` | 64×64 | — | Boots (mid tier) |
| `item/boots-high` | 64×64 | — | Boots (high tier) |
| `item/belt-low` | 64×64 | — | Belt (low tier) |
| `item/belt-mid` | 64×64 | — | Belt (mid tier) |
| `item/belt-high` | 64×64 | — | Belt (high tier) |
| `item/amulet-low` | 64×64 | — | Amulet (low tier) |
| `item/amulet-mid` | 64×64 | — | Amulet (mid tier) |
| `item/amulet-high` | 64×64 | — | Amulet (high tier) |
| `item/ring-low` | 64×64 | — | Ring (low tier) |
| `item/ring-mid` | 64×64 | — | Ring (mid tier) |
| `item/ring-high` | 64×64 | — | Ring (high tier) |

### Rune glyphs  _(16 assets)_

48×48 carved stone chips, each with ONE incised glyph lit from within. Invented alphabet — angular, chiselled, no resemblance to real letters. The glow colour follows the rune's role. All sixteen must be distinguishable at a glance and feel like one alphabet.

| key | size | frames | subject |
|---|---|---|---|
| `rune/mor` | 48×48 | — | Mor rune |
| `rune/ith` | 48×48 | — | Ith rune |
| `rune/kesh` | 48×48 | — | Kesh rune |
| `rune/dol` | 48×48 | — | Dol rune |
| `rune/var` | 48×48 | — | Var rune |
| `rune/sesh` | 48×48 | — | Sesh rune |
| `rune/rhen` | 48×48 | — | Rhen rune |
| `rune/ebb` | 48×48 | — | Ebb rune |
| `rune/tor` | 48×48 | — | Tor rune |
| `rune/nara` | 48×48 | — | Nara rune |
| `rune/quell` | 48×48 | — | Quell rune |
| `rune/sarn` | 48×48 | — | Sarn rune |
| `rune/hark` | 48×48 | — | Hark rune |
| `rune/umbra` | 48×48 | — | Umbra rune |
| `rune/vael` | 48×48 | — | Vael rune |
| `rune/zil` | 48×48 | — | Zil rune |

### UI chrome  _(13 assets)_

Nine-slice panel skins and buttons in cut granite with a gold inlay edge. The `nineslice` number is the corner inset in pixels — corners must not stretch. Button states: `normal` resting, `hover` gold edge brightening, `pressed` inset by 1px with the highlight flipped, `disabled` desaturated to 35%.

| key | size | frames | subject |
|---|---|---|---|
| `ui/panel` | 512×512 | — |  |
| `ui/panel-inset` | 512×512 | — |  |
| `ui/panel-raised` | 512×512 | — |  |
| `ui/header-bar` | 512×512 | — |  |
| `ui/footer-bar` | 512×512 | — |  |
| `ui/button-normal` | 192×56 | — |  |
| `ui/button-hover` | 192×56 | — |  |
| `ui/button-pressed` | 192×56 | — |  |
| `ui/button-disabled` | 192×56 | — |  |
| `ui/progress-track` | 256×32 | — |  |
| `ui/progress-fill-hp` | 256×32 | — |  |
| `ui/progress-fill-mhp` | 256×32 | — |  |
| `ui/progress-fill-xp` | 256×32 | — |  |

### Icons  _(22 assets)_

64×64 flat-ish symbolic icons, single accent colour each, readable at 24px. Resource icons, element icons, and tab icons.

| key | size | frames | subject |
|---|---|---|---|
| `icon/res-gold` | 64×64 | — |  |
| `icon/res-shards` | 64×64 | — |  |
| `icon/res-ichor` | 64×64 | — |  |
| `icon/res-marks` | 64×64 | — |  |
| `icon/res-dust` | 64×64 | — |  |
| `icon/res-epitaph` | 64×64 | — |  |
| `icon/res-rune` | 64×64 | — |  |
| `icon/res-level` | 64×64 | — |  |
| `icon/res-depth` | 64×64 | — |  |
| `icon/elem-phys` | 64×64 | — | Physical |
| `icon/elem-fire` | 64×64 | — | Fire |
| `icon/elem-cold` | 64×64 | — | Frost |
| `icon/elem-lit` | 64×64 | — | Storm |
| `icon/elem-void` | 64×64 | — | Void |
| `icon/tab-delve` | 64×64 | — |  |
| `icon/tab-gear` | 64×64 | — |  |
| `icon/tab-bench` | 64×64 | — |  |
| `icon/tab-tree` | 64×64 | — |  |
| `icon/tab-town` | 64×64 | — |  |
| `icon/tab-graves` | 64×64 | — |  |
| `icon/tab-modes` | 64×64 | — |  |
| `icon/tab-ascend` | 64×64 | — |  |

### Rarity frames and sockets  _(8 assets)_

Nine-slice item frames, one per rarity, in that rarity's colour. Restrained — the frame surrounds the item icon and must never compete with it. Socket pips are small circular stone settings, empty and filled.

| key | size | frames | subject |
|---|---|---|---|
| `frame/rarity-common` | 96×96 | — | Common |
| `frame/rarity-magic` | 96×96 | — | Magic |
| `frame/rarity-rare` | 96×96 | — | Rare |
| `frame/rarity-epic` | 96×96 | — | Epic |
| `frame/rarity-legendary` | 96×96 | — | Legendary |
| `frame/rarity-mythic` | 96×96 | — | Mythic |
| `frame/socket-empty` | 32×32 | — |  |
| `frame/socket-filled` | 32×32 | — |  |

---

## 6. Delivery

- One PNG per key, at the exact pixel dimensions in the tables above.
- Path = the key. `mon/shambler-idle` → `art/mon/shambler-idle.png`.
- Transparent background everywhere except `bg/*`.
- Sheets are one horizontal strip, frame 1 leftmost, no padding.
- **Priority order if delivering in waves:** (1) hero body + attack sheets, (2) the six most common monsters, (3) UI chrome and icons, (4) backdrops for realms 1–3, (5) paper-doll gear low band, (6) everything else.

Check coverage at any time with `GM.artStats()` in the browser console.
