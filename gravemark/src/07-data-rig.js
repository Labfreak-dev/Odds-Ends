/* Gravemark — 07-data-rig.js
   A small skeletal animation engine.

   This is how Path of Idle moves. A character is painted ONCE as separate
   body parts; a bone hierarchy carries them; the motion is keyframed on the
   bones and the art never changes. One rig and one set of animations then
   drive every humanoid in the game — hero, cultist, mourner, revenant — with
   the same fluid motion.

   Two drawing modes share every animation:
     RIG    — parts art exists for the character: bones carry the parts.
     SPRITE — it does not: the existing whole-figure painting is driven by the
              ROOT bone's motion (lunge, squash, lean, bob). Less than a rig,
              far more than a still, and it works with the art in the repo
              today.

   Angles are degrees. Bind poses are authored in WORLD angles because that is
   how a person thinks about a limb hanging down; the engine converts to
   parent-relative once at rig build. Animation tracks are DELTAS from bind.
   All rigs are authored in a 256-unit space with the feet at (128, 246). */
"use strict";

GM.Rig = {};

/* ---------- easing --------------------------------------------------------- */
function smooth(t) { return t * t * (3 - 2 * t); }
function easeOut(t) { return 1 - (1 - t) * (1 - t); }
function easeIn(t) { return t * t; }
var EASE = { smooth: smooth, out: easeOut, in: easeIn, linear: function (t) { return t; } };

/* ---------- rig templates ---------------------------------------------------
   `part` names the art slot; `z` is draw order (low first); `w` is the drawn
   thickness of the placeholder capsule. Bones with no part are pure pivots. */
var RIGS = {};

RIGS.humanoid = {
  id: "humanoid",
  bones: [
    { id: "root",   parent: null,     x: 128, y: 146, len: 0,  a: 0 },
    /* far side first so it draws behind */
    { id: "thigh_b",  parent: "root",    x: -4,  y: 4,  len: 50, a: 96,  part: "thigh_b",  z: 10, w: 20 },
    { id: "shin_b",   parent: "thigh_b", x: 50,  y: 0,  len: 48, a: 88,  part: "shin_b",   z: 11, w: 16 },
    { id: "uarm_b",   parent: "torso",   x: 50,  y: 6,  len: 32, a: 104, part: "uarm_b",   z: 12, w: 15 },
    { id: "farm_b",   parent: "uarm_b",  x: 32,  y: 0,  len: 30, a: 96,  part: "farm_b",   z: 13, w: 13 },
    { id: "torso",    parent: "root",    x: 0,   y: 0,  len: 58, a: -90, part: "torso",    z: 20, w: 40 },
    { id: "pelvis",   parent: "root",    x: 0,   y: 0,  len: 14, a: 90,  part: "pelvis",   z: 19, w: 36 },
    { id: "head",     parent: "torso",   x: 58,  y: 0,  len: 30, a: -90, part: "head",     z: 30, w: 30 },
    { id: "thigh_f",  parent: "root",    x: 6,   y: 4,  len: 50, a: 84,  part: "thigh_f",  z: 40, w: 21 },
    { id: "shin_f",   parent: "thigh_f", x: 50,  y: 0,  len: 48, a: 92,  part: "shin_f",   z: 41, w: 17 },
    { id: "uarm_f",   parent: "torso",   x: 50,  y: -6, len: 32, a: 76,  part: "uarm_f",   z: 50, w: 16 },
    { id: "farm_f",   parent: "uarm_f",  x: 32,  y: 0,  len: 30, a: 60,  part: "farm_f",   z: 51, w: 14 },
    /* Held low and forward at rest, tip toward the ground, like the standing
       paintings; the swings raise it from there. The painting is drawn along
       the bone (see drawPartImage), so this angle IS the weapon's angle. */
    { id: "weapon",   parent: "farm_f",  x: 30,  y: 0,  len: 70, a: 35, part: "weapon",   z: 52, w: 8 }
  ]
};

RIGS.quadruped = {
  id: "quadruped",
  bones: [
    { id: "root",    parent: null,    x: 128, y: 190, len: 0,  a: 0 },
    { id: "leg_bb",  parent: "root",  x: -44, y: 6,  len: 52, a: 96,  part: "leg_bb", z: 10, w: 13 },
    { id: "leg_fb",  parent: "root",  x: 40,  y: 6,  len: 52, a: 84,  part: "leg_fb", z: 11, w: 13 },
    { id: "body",    parent: "root",  x: -50, y: 0,  len: 100, a: 0,  part: "body",   z: 20, w: 46 },
    { id: "tail",    parent: "root",  x: -50, y: -6, len: 40, a: 160, part: "tail",   z: 19, w: 8 },
    { id: "neck",    parent: "root",  x: 46,  y: -8, len: 30, a: -40, part: "neck",   z: 30, w: 22 },
    { id: "head",    parent: "neck",  x: 30,  y: 0,  len: 38, a: 5,   part: "head",   z: 31, w: 26 },
    { id: "leg_bf",  parent: "root",  x: -36, y: 8,  len: 52, a: 100, part: "leg_bf", z: 40, w: 14 },
    { id: "leg_ff",  parent: "root",  x: 48,  y: 8,  len: 52, a: 80,  part: "leg_ff", z: 41, w: 14 }
  ]
};

RIGS.blob = {
  id: "blob",
  bones: [
    { id: "root",  parent: null,   x: 128, y: 170, len: 0,  a: 0 },
    { id: "body",  parent: "root", x: 0,   y: 0,   len: 90, a: -90, part: "body", z: 20, w: 110 },
    { id: "crown", parent: "body", x: 90,  y: 0,   len: 30, a: -90, part: "crown", z: 30, w: 44 }
  ]
};

/* Convert authored world bind angles to parent-relative, and index. */
function buildRig(tpl) {
  var byId = {};
  tpl.bones.forEach(function (b) { byId[b.id] = b; });
  tpl.bones.forEach(function (b) {
    var p = b.parent ? byId[b.parent] : null;
    b.local = p ? b.a - p.a : b.a;      /* bind angle relative to parent */
  });
  tpl.byId = byId;
  tpl.order = tpl.bones.slice().sort(function (a, b) { return (a.z || 0) - (b.z || 0); });
  return tpl;
}
for (var rk in RIGS) buildRig(RIGS[rk]);

GM.Rig.templates = RIGS;

/* ---------- parts -----------------------------------------------------------
   What the artist paints, per rig. Each part is painted UPRIGHT, exactly as it
   appears on the reference figure in its resting pose, cropped to this canvas
   with the named joint at the pivot. The engine rotates the part by
   (world angle - bind angle), so at rest nothing is rotated at all — which is
   what makes "paint it as it looks on the reference" a sufficient instruction.
   Sizes are in the 256-unit rig space; pivots are fractions of the canvas.
   Canvases run deliberately LARGER than the bones they hang on: a part is
   fitted to its canvas on install, so a bigger canvas is a chunkier limb
   that overlaps its neighbour at the joint — the Path of Idle build. */
GM.Rig.PARTS = {
  humanoid: {
    head:    { w: 64,  h: 72,  px: 0.50, py: 0.92, joint: "the base of the neck",   desc: "head and hood, from the crown down to and including the neck" },
    torso:   { w: 92,  h: 96,  px: 0.50, py: 0.95, joint: "the hips",               desc: "chest and shoulders from the collarbone down to the waist, no arms, no head" },
    pelvis:  { w: 72,  h: 44,  px: 0.50, py: 0.10, joint: "the hips",               desc: "belt and hips only, from the waist to the top of the thighs" },
    uarm_f:  { w: 42,  h: 56,  px: 0.50, py: 0.08, joint: "the shoulder",           desc: "the NEAR upper arm, shoulder to elbow" },
    farm_f:  { w: 38,  h: 56,  px: 0.50, py: 0.08, joint: "the elbow",              desc: "the NEAR forearm, elbow to fingertips, hand included, hand open" },
    uarm_b:  { w: 42,  h: 56,  px: 0.50, py: 0.08, joint: "the shoulder",           desc: "the FAR upper arm, shoulder to elbow (a little darker: it is further from the light)" },
    farm_b:  { w: 38,  h: 56,  px: 0.50, py: 0.08, joint: "the elbow",              desc: "the FAR forearm, elbow to fingertips, hand included" },
    thigh_f: { w: 48,  h: 72,  px: 0.50, py: 0.06, joint: "the hip",                desc: "the NEAR thigh, hip to knee" },
    shin_f:  { w: 44,  h: 72,  px: 0.50, py: 0.06, joint: "the knee",               desc: "the NEAR shin, knee to sole, boot included" },
    thigh_b: { w: 48,  h: 72,  px: 0.50, py: 0.06, joint: "the hip",                desc: "the FAR thigh, hip to knee (a little darker)" },
    shin_b:  { w: 44,  h: 72,  px: 0.50, py: 0.06, joint: "the knee",               desc: "the FAR shin, knee to sole, boot included" },
    weapon:  { w: 52,  h: 150, px: 0.50, py: 0.82, joint: "the grip",               desc: "the weapon alone, no hand, painted vertically with the grip near the bottom and the business end at the top" }
  },
  quadruped: {
    body:   { w: 128, h: 64,  px: 0.05, py: 0.50, joint: "the rear of the body", desc: "the torso from haunches to shoulders, no legs, no neck, no tail" },
    neck:   { w: 48,  h: 40,  px: 0.10, py: 0.60, joint: "the base of the neck", desc: "the neck only, from the shoulders to the base of the skull" },
    head:   { w: 56,  h: 48,  px: 0.08, py: 0.50, joint: "the base of the skull",desc: "the head, jaw included, facing forward" },
    tail:   { w: 56,  h: 24,  px: 0.05, py: 0.50, joint: "the base of the tail", desc: "the tail alone" },
    leg_ff: { w: 28,  h: 64,  px: 0.50, py: 0.06, joint: "the shoulder joint",   desc: "the NEAR front leg, shoulder to paw" },
    leg_fb: { w: 28,  h: 64,  px: 0.50, py: 0.06, joint: "the shoulder joint",   desc: "the FAR front leg, shoulder to paw (a little darker)" },
    leg_bf: { w: 28,  h: 64,  px: 0.50, py: 0.06, joint: "the hip joint",        desc: "the NEAR hind leg, hip to paw" },
    leg_bb: { w: 28,  h: 64,  px: 0.50, py: 0.06, joint: "the hip joint",        desc: "the FAR hind leg, hip to paw (a little darker)" }
  },
  blob: {
    body:   { w: 128, h: 112, px: 0.50, py: 0.95, joint: "the base, where it meets the ground", desc: "the whole mass, everything except the topmost feature" },
    crown:  { w: 64,  h: 48,  px: 0.50, py: 0.90, joint: "where it sits on the body",          desc: "the topmost feature alone: the skull on the bone pile, the lid of the casket, the head of the marker" }
  }
};

/* Which characters get parts, and what armour band they are painted in. The
   hero exists at three bands so equipped gear is visible on the rig; that is
   the point of the whole exercise. Monsters and bosses get one set each. */
GM.Rig.CHARS = [
  /* One shared hero set, tinted per class until each class has its own. */
  { id: "hero",    rig: "humanoid", ref: "actor/hero-idle", label: "the hero: the hooded figure of the reference painting, cleanly forged steel, fitted leather, carved bone" },
  { id: "warden",  rig: "humanoid", ref: "actor/look-warden",  label: "the Warden: heavy plate, tower shield slung, the maul-bearer of the line" },
  { id: "reaver",  rig: "humanoid", ref: "actor/look-reaver",  label: "the Reaver: scarred leathers, a sword and no shield, built to trade blows" },
  { id: "pyre",    rig: "humanoid", ref: "actor/look-pyre",    label: "the Pyre: ash-grey robes, bone wand, ember light in the hood" },
  { id: "stalker", rig: "humanoid", ref: "actor/look-stalker", label: "the Stalker: wrapped in shadow-cloth, twin daggers, hood low" },
  { id: "sexton",  rig: "humanoid", ref: "actor/look-sexton",  label: "the Sexton: a gravedigger's coat and a long scythe, lantern at the belt" },
  { id: "revenant",  rig: "humanoid", ref: "actor/revenant-idle", label: "the revenant: the hero's silhouette, drowned-pale and wrong, still wearing the gear it died in" }
];

/* Which rig a character uses. Anything not listed is a humanoid. */
var RIG_FOR = {
  gravedog: "quadruped",
  bonepile: "blob", stonewake: "blob", reliquary: "blob",
  b_drowned: "blob", b_turning: "blob", b_cairn: "blob", b_vault: "blob", b_hollow: "blob"
};
GM.Rig.forChar = function (charId) {
  return RIGS[RIG_FOR[charId] || "humanoid"];
};

/* ---------- animations ------------------------------------------------------
   tracks: boneId -> [ {t, a, x, y, sx, sy, e} ]. Every field optional; t is
   0..1 of `dur`. `ev` fires named events at times — "hit" marks the strike,
   which is what the VFX and the damage number key off. Keys must be in t order. */
var ANIMS = {};

function anim(name, dur, loop, tracks, ev) {
  ANIMS[name] = { name: name, dur: dur, loop: !!loop, tracks: tracks, ev: ev || [] };
}

/* --- shared --- */
anim("idle", 2.6, true, {
  root:  [{ t: 0, y: 0 }, { t: 0.5, y: -2.2 }, { t: 1, y: 0 }],
  torso: [{ t: 0, a: 0 }, { t: 0.5, a: -1.8 }, { t: 1, a: 0 }],
  head:  [{ t: 0, a: 0 }, { t: 0.5, a: 2.5 }, { t: 1, a: 0 }],
  uarm_f:[{ t: 0, a: 0 }, { t: 0.5, a: 2 }, { t: 1, a: 0 }],
  body:  [{ t: 0, sy: 1 }, { t: 0.5, sy: 1.03 }, { t: 1, sy: 1 }]
});

anim("hit", 0.38, false, {
  root:  [{ t: 0, x: 0, sx: 1, sy: 1 }, { t: 0.25, x: -16, sx: 0.93, sy: 1.06, e: "out" }, { t: 1, x: 0, sx: 1, sy: 1 }],
  torso: [{ t: 0, a: 0 }, { t: 0.25, a: -14 }, { t: 1, a: 0 }],
  head:  [{ t: 0, a: 0 }, { t: 0.2, a: -22 }, { t: 1, a: 0 }],
  uarm_f:[{ t: 0, a: 0 }, { t: 0.25, a: -40 }, { t: 1, a: 0 }],
  uarm_b:[{ t: 0, a: 0 }, { t: 0.25, a: 35 }, { t: 1, a: 0 }],
  body:  [{ t: 0, sx: 1 }, { t: 0.25, sx: 0.9 }, { t: 1, sx: 1 }]
});

anim("death", 1.1, false, {
  root:   [{ t: 0, y: 0, x: 0 }, { t: 0.35, y: 10, x: -6 }, { t: 0.8, y: 78, x: -22, e: "in" }, { t: 1, y: 78, x: -22 }],
  torso:  [{ t: 0, a: 0 }, { t: 0.35, a: 20 }, { t: 0.8, a: 82 }, { t: 1, a: 84 }],
  head:   [{ t: 0, a: 0 }, { t: 0.5, a: 30 }, { t: 1, a: 40 }],
  uarm_f: [{ t: 0, a: 0 }, { t: 0.8, a: 70 }, { t: 1, a: 74 }],
  uarm_b: [{ t: 0, a: 0 }, { t: 0.8, a: -60 }, { t: 1, a: -62 }],
  thigh_f:[{ t: 0, a: 0 }, { t: 0.8, a: -50 }, { t: 1, a: -52 }],
  thigh_b:[{ t: 0, a: 0 }, { t: 0.8, a: -30 }, { t: 1, a: -32 }],
  body:   [{ t: 0, sy: 1, a: 0 }, { t: 0.8, sy: 0.4, a: 12 }, { t: 1, sy: 0.35, a: 12 }],
  neck:   [{ t: 0, a: 0 }, { t: 0.8, a: 60 }, { t: 1, a: 60 }]
});

anim("walk", 0.72, true, {
  root:   [{ t: 0, y: 0 }, { t: 0.25, y: -3 }, { t: 0.5, y: 0 }, { t: 0.75, y: -3 }, { t: 1, y: 0 }],
  thigh_f:[{ t: 0, a: -26 }, { t: 0.5, a: 26 }, { t: 1, a: -26 }],
  shin_f: [{ t: 0, a: 8 }, { t: 0.25, a: 34 }, { t: 0.5, a: 4 }, { t: 0.75, a: 18 }, { t: 1, a: 8 }],
  thigh_b:[{ t: 0, a: 26 }, { t: 0.5, a: -26 }, { t: 1, a: 26 }],
  shin_b: [{ t: 0, a: 4 }, { t: 0.25, a: 18 }, { t: 0.5, a: 8 }, { t: 0.75, a: 34 }, { t: 1, a: 4 }],
  uarm_f: [{ t: 0, a: 22 }, { t: 0.5, a: -22 }, { t: 1, a: 22 }],
  uarm_b: [{ t: 0, a: -22 }, { t: 0.5, a: 22 }, { t: 1, a: -22 }],
  torso:  [{ t: 0, a: 4 }, { t: 1, a: 4 }],
  leg_ff: [{ t: 0, a: -24 }, { t: 0.5, a: 24 }, { t: 1, a: -24 }],
  leg_fb: [{ t: 0, a: 24 }, { t: 0.5, a: -24 }, { t: 1, a: 24 }],
  leg_bf: [{ t: 0, a: 24 }, { t: 0.5, a: -24 }, { t: 1, a: 24 }],
  leg_bb: [{ t: 0, a: -24 }, { t: 0.5, a: 24 }, { t: 1, a: -24 }]
});

/* --- the hero's five swings ---
   The strike is always the "hit" event; VFX and damage key off it. Root x is
   the lunge, root sx/sy the impact squash, torso the lean. */
anim("attack_sword", 0.62, false, {
  root:   [{ t: 0, x: 0, sx: 1, sy: 1 }, { t: 0.32, x: -10, sx: 0.97, sy: 1.03 }, { t: 0.5, x: 30, sx: 1.06, sy: 0.95, e: "out" }, { t: 0.78, x: 18 }, { t: 1, x: 0, sx: 1, sy: 1 }],
  torso:  [{ t: 0, a: 0 }, { t: 0.32, a: -16 }, { t: 0.5, a: 22 }, { t: 0.78, a: 10 }, { t: 1, a: 0 }],
  head:   [{ t: 0, a: 0 }, { t: 0.32, a: 8 }, { t: 0.5, a: -10 }, { t: 1, a: 0 }],
  uarm_f: [{ t: 0, a: 0 }, { t: 0.32, a: -150 }, { t: 0.5, a: 20, e: "out" }, { t: 0.78, a: 40 }, { t: 1, a: 0 }],
  farm_f: [{ t: 0, a: 0 }, { t: 0.32, a: -60 }, { t: 0.5, a: 30 }, { t: 0.78, a: 20 }, { t: 1, a: 0 }],
  weapon: [{ t: 0, a: 0 }, { t: 0.32, a: -40 }, { t: 0.5, a: 60 }, { t: 0.78, a: 50 }, { t: 1, a: 0 }],
  uarm_b: [{ t: 0, a: 0 }, { t: 0.32, a: 30 }, { t: 0.5, a: -40 }, { t: 1, a: 0 }],
  thigh_f:[{ t: 0, a: 0 }, { t: 0.5, a: -24 }, { t: 1, a: 0 }],
  thigh_b:[{ t: 0, a: 0 }, { t: 0.5, a: 20 }, { t: 1, a: 0 }]
}, [{ t: 0.5, name: "hit" }]);

anim("attack_dagger", 0.42, false, {
  root:   [{ t: 0, x: 0 }, { t: 0.22, x: -6 }, { t: 0.4, x: 34, sx: 1.05, sy: 0.97, e: "out" }, { t: 0.7, x: 12 }, { t: 1, x: 0, sx: 1, sy: 1 }],
  torso:  [{ t: 0, a: 0 }, { t: 0.22, a: -8 }, { t: 0.4, a: 18 }, { t: 1, a: 0 }],
  uarm_f: [{ t: 0, a: 0 }, { t: 0.22, a: -70 }, { t: 0.4, a: -10, e: "out" }, { t: 1, a: 0 }],
  farm_f: [{ t: 0, a: 0 }, { t: 0.22, a: -40 }, { t: 0.4, a: -60 }, { t: 1, a: 0 }],
  weapon: [{ t: 0, a: 0 }, { t: 0.22, a: 10 }, { t: 0.4, a: 40 }, { t: 1, a: 0 }],
  thigh_f:[{ t: 0, a: 0 }, { t: 0.4, a: -30 }, { t: 1, a: 0 }]
}, [{ t: 0.4, name: "hit" }]);

anim("attack_maul", 0.92, false, {
  root:   [{ t: 0, x: 0, sx: 1, sy: 1 }, { t: 0.4, x: -12, sy: 1.04 }, { t: 0.58, x: 24, sx: 1.12, sy: 0.88, e: "out" }, { t: 0.72, x: 22, sx: 1.0, sy: 1.0 }, { t: 1, x: 0 }],
  torso:  [{ t: 0, a: 0 }, { t: 0.4, a: -26 }, { t: 0.58, a: 38 }, { t: 0.72, a: 34 }, { t: 1, a: 0 }],
  head:   [{ t: 0, a: 0 }, { t: 0.4, a: 14 }, { t: 0.58, a: -16 }, { t: 1, a: 0 }],
  uarm_f: [{ t: 0, a: 0 }, { t: 0.4, a: -190 }, { t: 0.58, a: 30, e: "out" }, { t: 0.72, a: 40 }, { t: 1, a: 0 }],
  farm_f: [{ t: 0, a: 0 }, { t: 0.4, a: -30 }, { t: 0.58, a: 20 }, { t: 1, a: 0 }],
  uarm_b: [{ t: 0, a: 0 }, { t: 0.4, a: 170 }, { t: 0.58, a: -30 }, { t: 0.72, a: -40 }, { t: 1, a: 0 }],
  farm_b: [{ t: 0, a: 0 }, { t: 0.4, a: 30 }, { t: 0.58, a: -20 }, { t: 1, a: 0 }],
  weapon: [{ t: 0, a: 0 }, { t: 0.4, a: -30 }, { t: 0.58, a: 70 }, { t: 0.72, a: 74 }, { t: 1, a: 0 }],
  thigh_f:[{ t: 0, a: 0 }, { t: 0.58, a: -34 }, { t: 1, a: 0 }],
  thigh_b:[{ t: 0, a: 0 }, { t: 0.58, a: 26 }, { t: 1, a: 0 }]
}, [{ t: 0.58, name: "hit" }]);

anim("attack_wand", 0.78, false, {
  root:   [{ t: 0, x: 0 }, { t: 0.35, x: -8 }, { t: 0.5, x: 6, e: "out" }, { t: 1, x: 0 }],
  torso:  [{ t: 0, a: 0 }, { t: 0.35, a: -10 }, { t: 0.5, a: 8 }, { t: 1, a: 0 }],
  uarm_f: [{ t: 0, a: 0 }, { t: 0.35, a: -40 }, { t: 0.5, a: -95, e: "out" }, { t: 0.85, a: -80 }, { t: 1, a: 0 }],
  farm_f: [{ t: 0, a: 0 }, { t: 0.35, a: -70 }, { t: 0.5, a: 20 }, { t: 0.85, a: 10 }, { t: 1, a: 0 }],
  uarm_b: [{ t: 0, a: 0 }, { t: 0.35, a: 40 }, { t: 0.5, a: 20 }, { t: 1, a: 0 }],
  weapon: [{ t: 0, a: 0 }, { t: 0.35, a: 30 }, { t: 0.5, a: 10 }, { t: 1, a: 0 }]
}, [{ t: 0.5, name: "hit" }, { t: 0.5, name: "cast" }]);

anim("attack_scythe", 0.8, false, {
  root:   [{ t: 0, x: 0, sx: 1 }, { t: 0.36, x: -14, sx: 0.96 }, { t: 0.55, x: 26, sx: 1.08, sy: 0.96, e: "out" }, { t: 0.8, x: 16 }, { t: 1, x: 0, sx: 1, sy: 1 }],
  torso:  [{ t: 0, a: 0 }, { t: 0.36, a: -30 }, { t: 0.55, a: 34 }, { t: 0.8, a: 20 }, { t: 1, a: 0 }],
  head:   [{ t: 0, a: 0 }, { t: 0.36, a: 12 }, { t: 0.55, a: -14 }, { t: 1, a: 0 }],
  uarm_f: [{ t: 0, a: 0 }, { t: 0.36, a: -120 }, { t: 0.55, a: 60, e: "out" }, { t: 0.8, a: 70 }, { t: 1, a: 0 }],
  farm_f: [{ t: 0, a: 0 }, { t: 0.36, a: -20 }, { t: 0.55, a: 10 }, { t: 1, a: 0 }],
  uarm_b: [{ t: 0, a: 0 }, { t: 0.36, a: 90 }, { t: 0.55, a: -70 }, { t: 1, a: 0 }],
  weapon: [{ t: 0, a: 0 }, { t: 0.36, a: -60 }, { t: 0.55, a: 40 }, { t: 0.8, a: 50 }, { t: 1, a: 0 }],
  thigh_f:[{ t: 0, a: 0 }, { t: 0.55, a: -28 }, { t: 1, a: 0 }],
  thigh_b:[{ t: 0, a: 0 }, { t: 0.55, a: 24 }, { t: 1, a: 0 }]
}, [{ t: 0.55, name: "hit" }]);

/* --- monsters: a generic claw for humanoids, lunge-bite for quadrupeds,
   heave for blobs. Facing is handled by the drawer, so these are authored
   as if facing right like everything else. --- */
anim("attack_claw", 0.66, false, {
  root:   [{ t: 0, x: 0 }, { t: 0.3, x: -10 }, { t: 0.5, x: 28, sx: 1.06, sy: 0.95, e: "out" }, { t: 1, x: 0, sx: 1, sy: 1 }],
  torso:  [{ t: 0, a: 0 }, { t: 0.3, a: -14 }, { t: 0.5, a: 24 }, { t: 1, a: 0 }],
  uarm_f: [{ t: 0, a: 0 }, { t: 0.3, a: -120 }, { t: 0.5, a: 10, e: "out" }, { t: 1, a: 0 }],
  farm_f: [{ t: 0, a: 0 }, { t: 0.3, a: -50 }, { t: 0.5, a: -40 }, { t: 1, a: 0 }],
  uarm_b: [{ t: 0, a: 0 }, { t: 0.3, a: -100 }, { t: 0.55, a: 0 }, { t: 1, a: 0 }],
  head:   [{ t: 0, a: 0 }, { t: 0.5, a: -12 }, { t: 1, a: 0 }]
}, [{ t: 0.5, name: "hit" }]);

anim("attack_bite", 0.6, false, {
  root:  [{ t: 0, x: 0, y: 0 }, { t: 0.3, x: -14, y: 4, sy: 0.92 }, { t: 0.5, x: 40, y: -10, sx: 1.1, sy: 0.96, e: "out" }, { t: 1, x: 0, y: 0, sx: 1, sy: 1 }],
  neck:  [{ t: 0, a: 0 }, { t: 0.3, a: -20 }, { t: 0.5, a: 22 }, { t: 1, a: 0 }],
  head:  [{ t: 0, a: 0 }, { t: 0.3, a: -18 }, { t: 0.5, a: 14 }, { t: 1, a: 0 }],
  leg_ff:[{ t: 0, a: 0 }, { t: 0.5, a: -40 }, { t: 1, a: 0 }],
  leg_bf:[{ t: 0, a: 0 }, { t: 0.5, a: 30 }, { t: 1, a: 0 }],
  tail:  [{ t: 0, a: 0 }, { t: 0.5, a: 30 }, { t: 1, a: 0 }]
}, [{ t: 0.5, name: "hit" }]);

anim("attack_heave", 0.9, false, {
  root:  [{ t: 0, x: 0, sx: 1, sy: 1 }, { t: 0.4, x: -8, sx: 0.92, sy: 1.1 }, { t: 0.6, x: 22, sx: 1.16, sy: 0.86, e: "out" }, { t: 1, x: 0, sx: 1, sy: 1 }],
  body:  [{ t: 0, a: 0 }, { t: 0.4, a: -10 }, { t: 0.6, a: 14 }, { t: 1, a: 0 }],
  crown: [{ t: 0, a: 0 }, { t: 0.4, a: 12 }, { t: 0.6, a: -20 }, { t: 1, a: 0 }]
}, [{ t: 0.6, name: "hit" }]);

GM.Rig.anims = ANIMS;

/* The attack animation for a character, by rig and (for the hero) weapon. */
GM.Rig.attackFor = function (charId, weaponFamily) {
  var rig = GM.Rig.forChar(charId);
  if (rig.id === "quadruped") return "attack_bite";
  if (rig.id === "blob") return "attack_heave";
  if (charId === "hero" && weaponFamily && ANIMS["attack_" + weaponFamily]) return "attack_" + weaponFamily;
  return charId === "hero" ? "attack_sword" : "attack_claw";
};

/* ---------- sampling -------------------------------------------------------- */
function sampleTrack(track, t) {
  /* Returns interpolated {a,x,y,sx,sy}; each field falls back to the nearest
     key that defines it, so a track can leave sx alone and only move a. */
  var out = { a: 0, x: 0, y: 0, sx: 1, sy: 1 };
  if (!track || !track.length) return out;
  var fields = ["a", "x", "y", "sx", "sy"];
  for (var f = 0; f < fields.length; f++) {
    var k = fields[f];
    var prev = null, next = null;
    for (var i = 0; i < track.length; i++) {
      if (track[i][k] === undefined) continue;
      if (track[i].t <= t) prev = track[i];
      if (track[i].t >= t && !next) next = track[i];
    }
    if (!prev && !next) continue;
    if (!prev) { out[k] = next[k]; continue; }
    if (!next || next === prev) { out[k] = prev[k]; continue; }
    var span = next.t - prev.t;
    var u = span > 0 ? (t - prev.t) / span : 1;
    var ease = EASE[next.e || "smooth"] || smooth;
    out[k] = prev[k] + (next[k] - prev[k]) * ease(u);
  }
  return out;
}

/* Compute world transforms for every bone. Returns an array in draw order:
   { bone, x, y, angle, sx, sy } with x,y the pivot in rig space. */
GM.Rig.pose = function (rig, animName, t) {
  var a = ANIMS[animName] || ANIMS.idle;
  var world = {};
  var deltas = {};
  for (var i = 0; i < rig.bones.length; i++) {
    var b = rig.bones[i];
    deltas[b.id] = sampleTrack(a.tracks[b.id], t);
  }
  /* Bones are authored in DRAW order (far limbs first), not hierarchy order,
     so a parent can appear after its child. Resolve each bone's world
     transform on demand, memoised, walking up to the root as needed. */
  function solve(id) {
    if (world[id]) return world[id];
    var b = rig.byId[id];
    var d = deltas[id];
    if (!b.parent) {
      world[id] = { x: b.x + d.x, y: b.y + d.y, angle: b.a + d.a, sx: d.sx, sy: d.sy };
      return world[id];
    }
    var p = solve(b.parent);
    var rad = p.angle * Math.PI / 180;
    var ox = (b.x + d.x) * p.sx, oy = (b.y + d.y) * p.sy;
    world[id] = {
      x: p.x + ox * Math.cos(rad) - oy * Math.sin(rad),
      y: p.y + ox * Math.sin(rad) + oy * Math.cos(rad),
      angle: p.angle + b.local + d.a,
      sx: p.sx * d.sx, sy: p.sy * d.sy
    };
    return world[id];
  }
  for (i = 0; i < rig.bones.length; i++) solve(rig.bones[i].id);
  var out = [];
  for (i = 0; i < rig.order.length; i++) {
    b = rig.order[i];
    var w = world[b.id];
    out.push({ bone: b, x: w.x, y: w.y, angle: w.angle, sx: w.sx, sy: w.sy });
  }
  out.root = world.root;
  return out;
};

/* The tip of a bone in rig space — the weapon tip drives the trail. */
GM.Rig.tip = function (posed, boneId) {
  for (var i = 0; i < posed.length; i++) {
    var p = posed[i];
    if (p.bone.id !== boneId) continue;
    var rad = p.angle * Math.PI / 180;
    return { x: p.x + Math.cos(rad) * p.bone.len * p.sx, y: p.y + Math.sin(rad) * p.bone.len * p.sx };
  }
  return null;
};

/* ---------- animator -------------------------------------------------------
   One per actor on screen. Holds the current clip and time, fires events
   once as playback crosses them, and falls back to idle when a one-shot ends. */
GM.Rig.Animator = function (charId, opts) {
  opts = opts || {};
  this.charId = charId;
  this.rig = GM.Rig.forChar(charId);
  this.clip = "idle";
  this.t = 0;
  this.speed = 1;
  this.done = false;
  this.fired = {};
  this.onEvent = opts.onEvent || null;
  this.dead = false;
  /* Desynchronise idles so a squad does not breathe in unison. */
  this.t = GM.rng() * 0.9;
};

GM.Rig.Animator.prototype.play = function (name, speed) {
  if (!ANIMS[name]) name = "idle";
  if (this.dead && name !== "death") return;
  this.clip = name;
  this.t = 0;
  this.speed = speed || 1;
  this.done = false;
  this.fired = {};
  if (name === "death") this.dead = true;
};

GM.Rig.Animator.prototype.update = function (dt) {
  var a = ANIMS[this.clip] || ANIMS.idle;
  if (this.done) return;
  var before = this.t;
  this.t += dt * this.speed / a.dur;
  for (var i = 0; i < a.ev.length; i++) {
    var e = a.ev[i];
    if (!this.fired[e.name + e.t] && before < e.t && this.t >= e.t) {
      this.fired[e.name + e.t] = true;
      if (this.onEvent) this.onEvent(e.name, this);
    }
  }
  if (this.t >= 1) {
    if (a.loop) { this.t -= 1; this.fired = {}; }
    else if (this.clip === "death") { this.t = 1; this.done = true; }
    else { this.clip = "idle"; this.t = GM.rng() * 0.9; this.fired = {}; }
  }
};

GM.Rig.Animator.prototype.pose = function () {
  return GM.Rig.pose(this.rig, this.clip, Math.min(1, this.t));
};

/* Root-only motion for SPRITE mode: what the whole figure does. `lean` is the
   torso (or body) rotation, which sells a swing even on a flat painting. */
GM.Rig.Animator.prototype.spriteMotion = function () {
  var a = ANIMS[this.clip] || ANIMS.idle;
  var t = Math.min(1, this.t);
  var r = sampleTrack(a.tracks.root, t);
  var lean = sampleTrack(a.tracks.torso || a.tracks.body, t).a;
  return { x: r.x, y: r.y, sx: r.sx, sy: r.sy, lean: lean, dead: this.dead, done: this.done };
};
