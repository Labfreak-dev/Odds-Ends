/* Gravemark — tools/grok-animation.js
   Generates GROK-ANIMATION.md: a self-contained, paste-ready request for the
   animation frames the game is missing.

   Separate from grok-prompts.js because the animation ask has a completely
   different shape. Static art is one prompt, one image. Animation is several
   images that must agree with each other, and every delivery so far has failed
   on exactly that point.

       node tools/grok-animation.js > GROK-ANIMATION.md
*/
"use strict";
const fs = require("fs");
const path = require("path");
const { load } = require("./harness");

const GM = load({ quiet: true });
GM.startSeason("s_none");

const ART = path.join(__dirname, "..", "art");
function frameCount(spec) {
  try {
    const buf = fs.readFileSync(path.join(ART, spec.key + ".png"));
    return Math.max(1, Math.round(buf.readUInt32BE(16) / spec.w));  /* PNG IHDR width */
  } catch (e) { return 0; }          /* 0 = file absent */
}
const still = k => { const n = frameCount(k); return n === 1; };

const out = [];
const W = s => out.push(s);

/* ---------- per-action frame scripts ------------------------------------ */
const ACTION = {
  attack: { frames: 3, beats: [
    "**wind-up** — weapon drawn fully back, weight loaded on the back foot, body coiled",
    "**the strike** — weapon at the point of contact, arms extended, whole body committed forward",
    "**recovery** — weapon followed through and dropping, weight settling back to neutral"
  ]},
  cast: { frames: 3, beats: [
    "**gather** — hands drawn in toward the chest, a small cold light forming between them",
    "**release** — arms thrown forward, the light leaving the hands, sleeves snapping back",
    "**settle** — arms lowering, the last of the light guttering out"
  ]},
  walk: { frames: 3, beats: [
    "**contact** — forward foot planted heel-first, rear foot toe-off, arms opposed",
    "**passing** — legs together directly under the body, at the highest point of the stride",
    "**opposite contact** — the mirror of frame 1, other foot forward"
  ]},
  run: { frames: 3, beats: [
    "**drive** — hard forward lean, rear leg fully extended behind, opposite arm driving",
    "**airborne** — both feet clear of the ground, body at full extension",
    "**opposite drive** — the mirror of frame 1, other leg extended"
  ]},
  idle: { frames: 2, beats: [
    "**settled** — standing at rest, weight on one hip, weapon lowered",
    "**breath** — chest and shoulders lifted maybe two percent, head a fraction higher. Barely different on purpose; this is a breathing loop, not a pose change"
  ]},
  hit: { frames: 2, beats: [
    "**flinch** — head snapped back, torso recoiling, arms thrown wide off balance",
    "**recover** — pulling back upright, still off-centre, about to reset"
  ]},
  death: { frames: 3, beats: [
    "**the buckle** — legs giving way, one knee down, body folding",
    "**falling** — fully off balance and going down, arms loose, no longer resisting",
    "**down** — collapsed on the ground, still, flat within the lower third of the frame"
  ]},
  special: { frames: 3, beats: [
    "**the gather** — drawing power in, arms wide, the ground reacting",
    "**the release** — the signature move at its peak, the most dramatic single frame of this character",
    "**the aftermath** — spent, settling, the effect dispersing"
  ]}
};

const MON = {
  shambler:  "a corpse risen out of habit rather than malice — grave-dirt, slack limbs, no weapon",
  gravedog:  "a long starved dog, too many ribs showing, soil packed under its claws",
  digger:    "a living body-snatcher in an oilcloth apron with a spade and a sack",
  bonepile:  "a heap of sorted bones assembled wrong — too many femurs, one skull on top",
  mourner:   "a veiled figure in soaked black crepe, hands empty, drifting just above the ground",
  chill:     "a barrow-cold shape, more frost-rime outline than body, pale ice blue",
  drowned:   "a choirboy long underwater, robes heavy with silt, mouth open on an endless note",
  bellwright:"a hunched bell-founder carrying a cracked bronze bell",
  ashwalker: "a body still burning as it walks, ash sloughing off with every step",
  pyrecult:  "a robed cultist with a censer of live coals, face masked in beaten copper",
  stonewake: "a grave marker turned to face you, granite limbs grinding",
  reliquary: "an open empty reliquary casket walking on brass legs, void-purple glow inside",
  vigilant:  "a tall watcher in funeral dress carrying a lantern that gives no light",
  unnamed:   "a figure whose face will not hold still, features sliding off",
  threshold: "an enormous armoured gate-warden of fused stone and bone, barring the way"
};

const BOSS = {
  b_pauper: "a corpse crowned with bent wire and bottle glass",
  b_sexton: "a gaunt records-keeper with a ledger chained to his wrist",
  b_ossuary:"a meticulous figure of perfectly arranged bone",
  b_barrow: "a vast frost-caked matriarch rising out of a burial mound",
  b_drowned:"an immense bronze bell with a drowned figure fused inside it",
  b_ashfall:"a magistrate of cinders in scorched judicial robes",
  b_turning:"a monolith that is never facing the way you left it",
  b_hollow: "a negative space in the shape of a saint",
  b_wake:   "the chief mourner, twelve feet of black crepe and folded hands",
  b_cairn:  "the spire itself uprooted and walking",
  b_vault:  "the seal from the inside of a door, now standing up",
  b_thresh: "the first of the vigils — armoured, patient, older than the ground"
};

const HERO_BASE = "the gravedigger-warrior: wiry, weather-beaten, hooded, oilcloth and leather, face in shadow";
const WEAPON = {
  dagger: "a short curved dagger in a reverse grip — a fast low stab, body stays compact, minimal follow-through",
  sword:  "a straight single-handed sword — a diagonal shoulder-to-hip cut with a clean recovery",
  maul:   "a heavy two-handed maul — a full overhead swing, the whole body committed, a heavy settle after",
  wand:   "a slender wand — no swing at all: a gathering gesture and a release, weight stays back",
  scythe: "a long scythe — a wide horizontal sweep that carries the body around with it"
};

function actionOf(key) {
  /* A wand does not swing. Its "attack" is the cast script: gather, release,
     settle. Every other weapon family uses the swing script. */
  if (/-attack-wand$/.test(key)) return "cast";
  const m = key.match(/-(attack|cast|walk|run|idle|hit|death|special)(-\w+)?$/);
  return m ? m[1] : "idle";
}

/* ---------- document --------------------------------------------------- */
W("# Gravemark — animation request");
W("");
W("_Generated by `tools/grok-animation.js` from a live scan of `art/`. Regenerate after every delivery._");
W("");

const stills = GM.ART.filter(a => a.kind === "sheet" && still(a));
W(`**${stills.length} animations are currently a single still frame.** They load, they play, and nothing moves.`);
W("");

W("## Read this first — it is the whole reason eight packs produced no animation");
W("");
W("Every previous delivery asked for *\"an 8-frame sprite sheet\"* and returned **the same pose copied eight times**. That is not a quality problem, it is a format problem: an image generator makes one picture per prompt and cannot lay out a strip.");
W("");
W("So do not ask for a sheet. **Ask for one pose at a time, numbered.**");
W("");
W("The game reads frame count from each image's own width, so a **3-frame animation is completely valid art**. Three real key poses beat eight identical ones. Deliver separate files:");
W("");
W("```");
W("actor/hero-attack-sword-1.png      wind-up");
W("actor/hero-attack-sword-2.png      the strike");
W("actor/hero-attack-sword-3.png      recovery");
W("```");
W("");
W("They get stitched into the strip the game wants with one command, which also keys out the background:");
W("");
W("```bash");
W("python3 tools/make-sheet.py <folder>");
W("```");
W("");
W("### The rule that makes or breaks every one of these");
W("");
W("> **Every frame of an action must be the same character, at the same size, at the same distance, with its feet in the same place. ONLY the pose changes.**");
W("");
W("When prompting frame 2, **attach frame 1 as a reference image** and say:");
W("");
W("```");
W("Identical character, identical art style, identical camera distance and scale,");
W("feet in exactly the same place in frame. Change ONLY the pose, to: <beat>.");
W("```");
W("");
W("Without that they come back as three different drawings of a similar character and the animation strobes instead of moving. This is the single most important instruction in this document.");
W("");

W("## The style block — paste this above every prompt");
W("");
W("```");
W(`Hand-painted 2D game sprite for "Gravemark", a Lovecraftian gravedigging action-RPG.

STYLE: painterly hand-painted 2D with visible brush texture. Cold, damp, cut stone.
NOT vector, NOT pixel art, NOT 3D render, NOT cartoon, NOT anime.

LIGHT: one low warm key source against cold blue-grey ambient fill, rim light to
separate the figure from the ground.

VALUE: dark overall. Narrow bright range kept for bone, metal and lamplight.
The silhouette must read clearly at 25% scale.

COLOUR: desaturated blue-grey base (#0c0d10 to #3d4454), exactly ONE saturated accent.
Bone #e6e0cf is the brightest neutral.

FRAMING: full body, the whole figure inside the frame, feet near the bottom edge,
nothing cropped. Square image.

BACKGROUND: flat solid magenta #FF00FF, edge to edge. No gradient, no shadow cast
onto it, no vignette, no border, no ground line.

NO text, letters, numbers, watermark, signature or logo anywhere in the image.`);
W("```");
W("");

/* ---------- tier builder ------------------------------------------------ */
function block(key, subject, facing) {
  const act = actionOf(key);
  const A = ACTION[act] || ACTION.idle;
  const spec = GM.ART_BY_KEY[key];
  W(`#### \`${key}\` — ${A.frames} frames, ${spec.w}×${spec.h}, facing ${facing}`);
  W("");
  W(`Subject: ${subject}`);
  W("");
  A.beats.forEach((b, i) => W(`${i + 1}. \`${key}-${i + 1}.png\` — ${b}`));
  W("");
}

function tier(n, title, why, keys, subjectFor, facing) {
  const present = keys.filter(k => GM.ART_BY_KEY[k]);
  if (!present.length) return 0;
  const imgs = present.reduce((s, k) => s + (ACTION[actionOf(k)] || ACTION.idle).frames, 0);
  W("---");
  W("");
  W(`## Tier ${n}: ${title}`);
  W("");
  W(`**${present.length} animations, ${imgs} images.** ${why}`);
  W("");
  present.forEach(k => block(k, subjectFor(k), facing));
  return imgs;
}

let total = 0;

/* Tier 1 — the hero's swings. Highest value: they fire on every single hit. */
const heroAttacks = ["dagger", "sword", "maul", "wand", "scythe"]
  .map(f => "actor/hero-attack-" + f).filter(k => still(GM.ART_BY_KEY[k]) || !frameCount(GM.ART_BY_KEY[k]));
total += tier(1, "The hero's attack swings",
  "Do these first. They play on every hit the squad lands, three panels at once — they are by far the most visible motion in the game. Five weapon families, because a maul does not move like a dagger.",
  heroAttacks,
  k => HERO_BASE + ", swinging " + WEAPON[k.split("-").pop()],
  "RIGHT");

/* Tier 2 — the hero's other states */
total += tier(2, "The hero's other states",
  "Idle plays constantly between swings; the rest are cheap once the character is established.",
  ["actor/hero-idle", "actor/hero-hit", "actor/hero-death", "actor/hero-walk", "actor/hero-run", "actor/hero-cast"],
  () => HERO_BASE, "RIGHT");

/* Tier 3 — monsters. Only attack and death are drawn by the game. */
const monKeys = [];
GM.MONSTERS.forEach(m => { monKeys.push("mon/" + m.id + "-attack"); monKeys.push("mon/" + m.id + "-death"); });
total += tier(3, "Monster attack and death",
  "These two states are what the battle panels show when a monster strikes or dies. Fifteen monsters. If this tier has to be cut, do attack for all fifteen before doing any deaths.",
  monKeys,
  k => MON[k.split("/")[1].replace(/-(attack|death)$/, "")] || k,
  "LEFT");

/* Tier 4 — bosses */
const bossKeys = [];
GM.BOSSES.forEach(b => { bossKeys.push("boss/" + b.id + "-attack"); bossKeys.push("boss/" + b.id + "-death"); });
total += tier(4, "Boss attack and death",
  "Bosses are an event — one every tenth depth — so their motion carries more weight per frame than a common monster's, but they are seen far less often.",
  bossKeys,
  k => BOSS[k.split("/")[1].replace(/-(attack|death|special)$/, "")] || k,
  "LEFT");

/* Tier 5 — the revenant, the game's signature enemy */
total += tier(5, "The Revenant",
  "The player's own dead squad, standing up in the gear it died in. It should read as the hero, corrupted — same proportions, same hood, drowned-pale, eyes lamplit from inside, void-purple accent.",
  ["actor/revenant-attack", "actor/revenant-death", "actor/revenant-hit"],
  () => "the hero's silhouette, drowned-pale and wrong, still wearing the gear it died in", "LEFT");

W("---");
W("");
W("## Delivery");
W("");
W(`- **${total} images** across all five tiers. Partial deliveries are genuinely useful — a finished Tier 1 lands in the game the day it arrives.`);
W("- One PNG per frame, named exactly as shown: `<key>-<n>.png`.");
W("- Keep the folder structure: `actor/`, `mon/`, `boss/`.");
W("- Flat magenta `#FF00FF` background — **never** ask for transparency, it comes back as a white card.");
W("- Zip it and send it. I run `make-sheet.py` and it is in the build.");
W("");
W("**If only one thing gets made: `actor/hero-attack-sword`, three frames.** It proves the whole numbered-frame workflow end to end in three images, and I can tell you within a minute of receiving it whether the framing held.");

console.log(out.join("\n"));
