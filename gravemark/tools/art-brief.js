/* Gravemark — tools/art-brief.js
   Generates ART-BRIEF.md from the live asset manifest, so the brief can never
   drift out of date with the game. Run after changing data or the manifest:

       node tools/art-brief.js > ART-BRIEF.md
*/
"use strict";
const { load } = require("./harness");
const GM = load({ quiet: true });
GM.startSeason("s_none");

const out = [];
const W = s => out.push(s);

const STYLE = `**Gravemark** is a Lovecraftian gravedigging ARPG. The mood is *cold, damp, cut stone* — a working graveyard that has been working for far too long. Not gore, not neon, not cartoon. Think weathered granite, wet earth, guttering lamplight, bone that has been sorted and catalogued by someone methodical.

- **Rendering:** hand-painted 2D with visible brush texture, readable at small sizes. Painterly, not vector, not pixel art, not 3D render.
- **Value:** dark overall (backgrounds sit at 8–20% luminance) with a narrow bright range reserved for lamplight, bone and metal. Silhouette must read at 25% scale.
- **Light:** single low, warm key source (a lantern, a pyre) against cold ambient blue-grey fill. Rim light separates figures from the ground.
- **Palette discipline:** desaturated base with ONE saturated accent per asset. The accent carries the element (see palette below).
- **Never:** bright saturated backgrounds, lens flare, chromatic aberration, modern typography baked into art, watermark, signature, text of any kind.`;

const PALETTE = [
  ["Ground / panel", "#0c0d10 → #22262f", "near-black blue-grey; all chrome sits in this band"],
  ["Edge / bevel",   "#2e3340 → #3d4454", "cut-stone edges, panel borders"],
  ["Bone",           "#e6e0cf",           "the brightest neutral; bone, parchment, lamplight"],
  ["Gold",           "#d9b45c",           "the single UI accent; gilding, rank, selection"],
  ["Blood",          "#8c2f33 → #c0474c",  "player health, wounds, danger"],
  ["Moss",           "#5a6b3a → #87a154",  "monster health, damp growth"],
  ["Physical",       "#b9bfcc", "steel grey"],
  ["Fire",           "#e0762f", "ember orange"],
  ["Frost",          "#5fb7d1", "pale ice blue"],
  ["Storm",          "#e0c53a", "sick yellow"],
  ["Void",           "#a45fd1", "wrong purple"],
];

const RARITY_COLOURS = {
  common: "#8b909c grey", magic: "#5b8fd6 blue", rare: "#d9b45c gold",
  epic: "#a45fd1 purple", legendary: "#e0662f orange", mythic: "#e03a5f red"
};

/* ------------------------------------------------------------------ */
W("# Gravemark — Art Brief");
W("");
W("_Generated from `src/18-assets.js` by `tools/art-brief.js`. Do not hand-edit — regenerate._");
W("");
const st = GM.artStats();
W(`**${st.total} assets** · ${st.byKind.sheet || 0} animated sprite sheets · ` +
  `${GM.ART.filter(a => a.kind === "sheet").reduce((s, a) => s + (a.frames || 1), 0)} individual frames · ` +
  `${GM.ART.filter(a => a.key.startsWith("doll/")).length} paper-doll gear layers`);
W("");
W("The game references **no image path directly** — it asks `GM.art(key)` and falls back to a labelled placeholder. Drop a finished file at `art/<key>.png` and it appears. Nothing in the game code changes. Deliver in any order; partial sets work.");
W("");

W("---");
W("");
W("## 1. The master prompt");
W("");
W("Paste this ahead of any individual asset prompt below. Every asset in the pack shares it.");
W("");
W("```");
W(`Hand-painted 2D game art for "Gravemark", a Lovecraftian gravedigging action-RPG.

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
baked in.`);
W("```");
W("");

W("## 2. Palette");
W("");
W("| role | hex | note |");
W("|---|---|---|");
PALETTE.forEach(p => W(`| ${p[0]} | \`${p[1]}\` | ${p[2]} |`));
W("");
W("Rarity colours (used on item icons and frames):");
W("");
W("| rarity | colour |");
W("|---|---|");
GM.RARITIES.forEach(r => W(`| ${r.name} | ${RARITY_COLOURS[r.key]} |`));
W("");

W("## 3. Technical spec — read before drawing anything animated");
W("");
W("**Sprite sheets are a single horizontal strip.** Frame 1 leftmost. No padding, no gaps, no grid. Sheet width = frame width × frame count; sheet height = frame height. The loader slices by `naturalWidth / frames`, so an off-by-one column breaks every frame.");
W("");
W("```");
W(`  ┌────────┬────────┬────────┬────────┬────────┬────────┬────────┬────────┐
  │  f1    │  f2    │  f3    │  f4    │  f5    │  f6    │  f7    │  f8    │   256px tall
  └────────┴────────┴────────┴────────┴────────┴────────┴────────┴────────┘
    256px    each frame is a fixed 256x256 cell — the figure may not drift between cells`);
W("```");
W("");
W("- **Facing:** the hero and all gear layers face **RIGHT**. All monsters and bosses face **LEFT**. They meet in the middle.");
W("- **Footing:** the character's feet rest at **96% of frame height**, horizontally centred at 50%. Every frame of every state and every gear layer uses the same footing, or the character bobs when the state changes.");
W("- **Transparency:** true alpha. No matte, no halo, no semi-transparent fringe inside the silhouette.");
W("- **No baked shadow.** The game draws the ground.");
W("");
W("**Anchor points** (fractions of the frame) — weapons are drawn at the grip, so the hand must be here in every frame:");
W("");
W("| anchor | x | y | meaning |");
W("|---|---|---|---|");
Object.keys(GM.DOLL_ANCHORS).forEach(k => {
  const a = GM.DOLL_ANCHORS[k];
  W(`| \`${k}\` | ${a.x} | ${a.y} | ${k === "gripMain" ? "main hand — weapon pivots here" : k === "gripOff" ? "off hand — shield/tome" : k === "head" ? "helm sits here" : "ground contact"} |`);
});
W("");

W("### Animation states");
W("");
W("| state | frames | fps | loops | what it is |");
W("|---|---|---|---|---|");
GM.ANIM_STATES.forEach(a => {
  W(`| \`${a.id}\` | ${a.frames} | ${a.fps} | ${a.loop ? "yes" : "no"} | ${a.note} |`);
});
W("");
W("**Attack timing is load-bearing.** The game plays `attack` once per swing at the character's real attack speed, so the strike must land on **frame 4 of 8**. Frames 1–3 are wind-up, 4 is contact, 5–8 are recovery. A swing that peaks late reads as lag.");
W("");
W("**Walk and run must loop seamlessly** — frame 8 flows into frame 1 with no hitch. Standard 8-frame stride: contact, down, pass, up, contact (opposite), down, pass, up.");
W("");

/* ---- 4. paper doll ---- */
W("## 4. Paper-doll gear — every equipped item is visible on the character");
W("");
W("This is the largest and most important part of the pack. The character is drawn as a **stack of layers**, one per equipped slot, composited in z-order. Every gear layer is its own sprite sheet that must align **frame-for-frame** with the body sheets: gloves layer frame 4 must match body frame 4 exactly, or the hand detaches mid-swing.");
W("");
W("| z | layer | slot | note |");
W("|---|---|---|---|");
GM.DOLL_LAYERS.slice().sort((a, b) => a.z - b.z).forEach(L => {
  W(`| ${L.z} | \`${L.id}\` | ${L.slot || "—"} | ${L.note || ""} |`);
});
W("");
W("**Rules for every gear layer:**");
W("");
W("1. Draw it *on* a copy of the base body so the fit is right, then delete the body and export only the gear.");
W("2. Same 256×256 cells, same footing, same frame count as the body state it accompanies.");
W("3. Only the parts the slot covers. A `gloves` layer is two hands and forearms — nothing else.");
W("4. Gear must read at three tier bands: **low** (rusted, lashed, improvised), **mid** (forged, fitted, ornamented), **high** (reliquary-grade, gilded, carved with names).");
W("");

/* helper to list a section */
function section(title, prefix, extra) {
  const rows = GM.ART.filter(a => a.key.startsWith(prefix));
  if (!rows.length) return;
  W("### " + title + "  _(" + rows.length + " assets)_");
  W("");
  if (extra) { W(extra); W(""); }
  W("| key | size | frames | subject |");
  W("|---|---|---|---|");
  rows.forEach(a => {
    W(`| \`${a.key}\` | ${a.w}×${a.h} | ${a.kind === "sheet" ? a.frames : "—"} | ${a.label || a.note || ""} |`);
  });
  W("");
}

W("---");
W("");
W("## 5. The asset list, by category");
W("");

section("Hero — body", "actor/hero-",
"Prompt: `A lone gravedigger-warrior, wiry and weather-beaten, wrapped in oilcloth and leather, face shadowed under a hood. Neutral undyed clothing — this is the naked base that all gear layers paint over, so keep it plain and keep the silhouette narrow. Facing right. [STATE].`\n\n" +
"Draw the generic `hero-attack` first, then the five weapon-specific swings — a maul does not move like a dagger:\n\n" +
"- `dagger` — short, fast, low stab; body stays compact, minimal follow-through\n" +
"- `sword` — diagonal shoulder-to-hip cut with a clean recovery\n" +
"- `maul` — full overhead, whole body committed, heavy settle afterwards\n" +
"- `wand` — no swing: a gathering gesture and a release; weight stays back\n" +
"- `scythe` — wide horizontal sweep that carries the body around");

section("Revenant — the player's own corpse", "actor/revenant-",
"Prompt: `The same gravedigger silhouette as the hero, but drowned-pale and wrong: jaw slack, eyes lamplit from inside, still wearing the gear it died in, hanging off it. Must be instantly recognisable as the hero — same proportions, same hood — and instantly wrong. Void purple #a45fd1 accent. Facing left.`");

section("Paper-doll gear layers", "doll/",
"Each key is `doll/<layer>-<family>-<band>`. Bands: `low` rusted/improvised, `mid` forged/fitted, `high` reliquary-grade/gilded. Must align frame-for-frame with the hero sheets (8 frames, 256×256, footing at 96%).");

W("### Monsters  _(" + GM.MONSTERS.length + " archetypes × 4 states)_");
W("");
W("Each gets `idle` (6f, loops), `attack` (8f, strike on frame 4), `hit` (3f), `death` (8f, final frame rests on the ground). All face **LEFT**.");
W("");
W("| archetype | element | prompt seed |");
W("|---|---|---|");
const MON_PROMPTS = {
  shambler: "A corpse that has got up out of habit rather than malice. Grave-dirt, slack limbs, no weapon.",
  gravedog: "A long, starved dog with too many ribs showing and soil packed under its claws.",
  digger: "A living man in an oilcloth apron with a spade and a sack, angry at being interrupted.",
  bonepile: "A heap of sorted bones that has assembled itself wrong — too many femurs, one skull on top.",
  mourner: "A veiled figure in soaked black crepe, hands empty, drifting a hand's width above the ground.",
  chill: "A barrow-cold shape, more frost-rime outline than body, pale ice blue #5fb7d1.",
  drowned: "A choirboy long underwater, robes heavy, mouth open in a note that never ends. Storm yellow.",
  bellwright: "A hunched bell-founder carrying a cracked bronze bell that rings when it strikes.",
  ashwalker: "A body walking while still burning, ash sloughing off with every step. Ember orange.",
  pyrecult: "A robed cultist with a censer of live coals, face masked in beaten copper.",
  stonewake: "A grave marker that has turned to face you, granite limbs grinding as it moves.",
  reliquary: "An open, empty reliquary casket walking on brass legs. Void purple glow from inside.",
  vigilant: "A tall watcher in funeral dress with a lantern that gives no light. Void purple.",
  unnamed: "A figure whose face will not hold still — features sliding off. Deeply wrong. Void purple.",
  threshold: "An enormous armoured gate-warden of fused stone and bone, barring the way. Void purple."
};
GM.MONSTERS.forEach(m => {
  W(`| **${m.name}** \`mon/${m.id}-*\` | ${GM.ELEM_META[m.elem].label} | ${MON_PROMPTS[m.id] || m.name} |`);
});
W("");

W("### Bosses  _(" + GM.BOSSES.length + " × 4 states, 384×320)_");
W("");
W("Bosses are bigger, slower and read as an *event*. Each gets `idle` (8f, loops), `attack` (8f), `special` (12f — the signature move, more elaborate), `death` (8f). All face **LEFT**.");
W("");
W("| boss | realm | element | prompt seed |");
W("|---|---|---|---|");
const BOSS_PROMPTS = {
  b_pauper: "A corpse crowned with bent wire and bottle glass, ruling a field of the unmarked.",
  b_sexton: "A gaunt records-keeper with a ledger chained to his wrist, still writing.",
  b_ossuary: "A meticulous figure of perfectly arranged bone, offended by disorder.",
  b_barrow: "A vast frost-caked matriarch rising out of a burial mound, roots and ice trailing.",
  b_drowned: "An immense bronze bell with a drowned figure fused inside it, ringing underwater.",
  b_ashfall: "A magistrate of cinders in scorched judicial robes, gavel of burning stone.",
  b_turning: "A monolith that is never facing the way you left it. Grinding granite, storm yellow seams.",
  b_hollow: "Whatever was kept in the reliquary — a negative space in the shape of a saint.",
  b_wake: "The chief mourner, twelve feet of black crepe and folded hands, weeping void.",
  b_cairn: "The spire itself uprooted and walking, centuries of stacked stone and debt.",
  b_vault: "The seal on the inside of the door, now standing up. Sealed FROM the inside.",
  b_thresh: "The first of the vigils. Armoured, patient, older than the ground. Final boss energy."
};
GM.BOSSES.forEach(b => {
  W(`| **${b.name}** \`boss/${b.id}-*\` | ${b.realm} | ${GM.ELEM_META[b.elem].label} | ${BOSS_PROMPTS[b.id] || b.name} |`);
});
W("");

W("### Backdrops  _(1280×720, opaque)_");
W("");
W("Wide parallax-friendly paintings. The figures stand on a ground line at ~82% height, so keep the lower 18% simple and uncluttered — it is drawn over. No focal detail dead-centre.");
W("");
W("| key | place | flavour |");
W("|---|---|---|");
GM.REALMS.forEach(r => W(`| \`bg/realm-${r.n}\` | **${r.name}** | ${r.flavour} |`));
["town|The parish above ground: a chapel, a forge, a vault, lamps lit|",
 "tower|An impossible spire of stacked funeral architecture receding upward|",
 "dimension|The same graveyard rendered wrong — colours inverted, geometry folded|",
 "finality|Past the end of the world; the ground stops pretending to be ground|",
 "graveyard|A field of the player's own gravemarks under low fog|",
 "title|The title screen: one lantern, one open grave, rain|"].forEach(s => {
  const [k, d] = s.split("|");
  W(`| \`bg/${k}\` | ${d} | |`);
});
W("");

section("Item icons", "item/",
"Square inventory icons, three-quarter view, lit from upper left, on transparent background. Tier band drives the material: `low` rusted iron and lashed cord, `mid` clean forged steel and fitted leather, `high` reliquary-grade with gilding and carved names.");

section("Rune glyphs", "rune/",
"48×48 carved stone chips, each with ONE incised glyph lit from within. Invented alphabet — angular, chiselled, no resemblance to real letters. The glow colour follows the rune's role. All sixteen must be distinguishable at a glance and feel like one alphabet.");

section("UI chrome", "ui/",
"Nine-slice panel skins and buttons in cut granite with a gold inlay edge. The `nineslice` number is the corner inset in pixels — corners must not stretch. Button states: `normal` resting, `hover` gold edge brightening, `pressed` inset by 1px with the highlight flipped, `disabled` desaturated to 35%.");

section("Icons", "icon/",
"64×64 flat-ish symbolic icons, single accent colour each, readable at 24px. Resource icons, element icons, and tab icons.");

section("Rarity frames and sockets", "frame/",
"Nine-slice item frames, one per rarity, in that rarity's colour. Restrained — the frame surrounds the item icon and must never compete with it. Socket pips are small circular stone settings, empty and filled.");

W("---");
W("");
W("## 6. Delivery");
W("");
W("- One PNG per key, at the exact pixel dimensions in the tables above.");
W("- Path = the key. `mon/shambler-idle` → `art/mon/shambler-idle.png`.");
W("- Transparent background everywhere except `bg/*`.");
W("- Sheets are one horizontal strip, frame 1 leftmost, no padding.");
W("- **Priority order if delivering in waves:** (1) hero body + attack sheets, (2) the six most common monsters, (3) UI chrome and icons, (4) backdrops for realms 1–3, (5) paper-doll gear low band, (6) everything else.");
W("");
W("Check coverage at any time with `GM.artStats()` in the browser console.");

console.log(out.join("\n"));
