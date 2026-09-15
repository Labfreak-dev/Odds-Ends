# Gravemark — Art Brief

_Generated from `src/18-assets.js` by `tools/art-brief.js`. Do not hand-edit — regenerate._

**493 assets** · 124 animated sprite sheets · 928 individual frames · 304 rig parts

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

## 4. The five classes — a hero is a whole unit

There is no equipment. Hiring a Reaver gives you a Reaver: sword, scarred leathers, the lot, painted once and never changed. Each class needs ONE finished standing figure (`actor/look-<class>`), and the shared hero sheets carry its motion until the class has rig parts of its own.

| class | role | weapon | the look |
|---|---|---|---|
| `warden` | Front | maul | the Warden: heavy plate, tower shield slung, the maul-bearer of the line |
| `reaver` | Strike | sword | the Reaver: scarred leathers, a sword and no shield, built to trade blows |
| `pyre` | Ruin | wand | the Pyre: ash-grey robes, bone wand, ember light in the hood |
| `stalker` | Flank | dagger | the Stalker: wrapped in shadow-cloth, twin daggers, hood low |
| `sexton` | Support | scythe | the Sexton: a gravedigger's coat and a long scythe, lantern at the belt |

---

## 5. The asset list, by category

### Class looks  _(5 assets)_

One finished standing figure per class, facing right, feet at 96% height. See section 4.

| key | size | frames | subject |
|---|---|---|---|
| `actor/look-warden` | 256×256 | — | the Warden, standing: Stands where the ground is worst. |
| `actor/look-reaver` | 256×256 | — | the Reaver, standing: Paid by the swing, not the hour. |
| `actor/look-pyre` | 256×256 | — | the Pyre, standing: Burns the field, then salts it. |
| `actor/look-stalker` | 256×256 | — | the Stalker, standing: Never where the blow lands. |
| `actor/look-sexton` | 256×256 | — | the Sexton, standing: Knows which graves are worth opening. |

### Hero — body  _(12 assets)_

Prompt: `A lone gravedigger-warrior, wiry and weather-beaten, wrapped in oilcloth and leather, face shadowed under a hood. This is the shared body every class wears tinted to its colour until it has a look of its own, so keep the silhouette clean. Facing right. [STATE].`

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

### UI chrome  _(15 assets)_

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
| `ui/marker-plate` | 192×40 | — | parish building marker plate (level chip + name banner) |
| `ui/flag-banner` | 256×40 | — | battle panel depth banner |

### Icons  _(26 assets)_

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
| `icon/class-warden` | 64×64 | — | Warden class badge |
| `icon/class-reaver` | 64×64 | — | Reaver class badge |
| `icon/class-pyre` | 64×64 | — | Pyre class badge |
| `icon/class-stalker` | 64×64 | — | Stalker class badge |
| `icon/class-sexton` | 64×64 | — | Sexton class badge |
| `icon/tab-delve` | 64×64 | — |  |
| `icon/tab-names` | 64×64 | — |  |
| `icon/tab-tree` | 64×64 | — |  |
| `icon/tab-town` | 64×64 | — |  |
| `icon/tab-graves` | 64×64 | — |  |
| `icon/tab-modes` | 64×64 | — |  |
| `icon/tab-ascend` | 64×64 | — |  |

---

## 6. Delivery

- One PNG per key, at the exact pixel dimensions in the tables above.
- Path = the key. `mon/shambler-idle` → `art/mon/shambler-idle.png`.
- Transparent background everywhere except `bg/*`.
- Sheets are one horizontal strip, frame 1 leftmost, no padding.
- **Priority order if delivering in waves:** (1) hero body + attack sheets, (2) the six most common monsters, (3) UI chrome and icons, (4) backdrops for realms 1–3, (5) paper-doll gear low band, (6) everything else.

Check coverage at any time with `GM.artStats()` in the browser console.
