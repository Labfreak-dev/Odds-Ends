/* Gravemark — 03-data-world.js
   Realms, monster archetypes, bosses, and the mutator pool.

   Every scaling constant lives at the top of this file and nowhere else, so
   rebalancing is one edit and `tools/balance.js` can re-measure the pacing
   without hunting numbers through the combat code. */
"use strict";

/* ---------- scaling constants -------------------------------------------
   Stages are a single global index (1, 2, 3, ... unbounded). Realm and floor
   are derived from it, never stored, so an endless mode needs no new data. */
GM.STAGES_PER_REALM = 10;

GM.CURVE = {
  /* The hero's KIT is fixed by class and grows with level: there are no
     items. `kit*0` are the level-1 numbers a class multiplies, `kitG` the
     per-level growth. Epitaph flats scale by `depthScale` per depth learned.
     Change any of these and the monster curve below MUST be re-measured with
     tools/balance.js. */
  kitDmg0:  5.0,   kitArm0:  26,   kitEva0:  14,   kitLife0: 18,
  kitG:     1.078,  /* per-level growth of every kit number */
  early0:   0.18,   /* monster strength at depth 1, as a fraction of the curve; ramps to 1 by 25 */
  depthScale: 1.035, /* per-depth multiplier on flat epitaph values */

  /* Measured, not guessed (tools/balance.js): a levelling squad's damage
     grows about 1.11 per depth and its life 1.08 — until its rank's level cap,
     after which only traits and the tree move. These sit between the two, so
     the mid-game keeps pace and the post-cap depths tighten into an endgame
     that anointing, deeper epitaphs and ascension are meant to carry. */
  monHp0:   245,   monHpG:   1.1000,   /* monster life at stage 1, and per-stage growth */
  monDmg0:  22,    monDmgG:  1.0750,   /* monster damage per second */
  deepFrom: 60,    deepG:    1.018,    /* extra per-depth growth past deepFrom: the endgame tightens */
  monArm0:  30,    monArmG:  1.0900,   /* monster armour, reduces incoming physical */
  monAcc0:  90,    monAccG:  1.0800,   /* accuracy, fought against player evasion */
  bossHp:   8.0,   bossDmg:  2.0,      /* stage-10 boss multipliers */
  eliteHp:  2.6,   eliteDmg: 1.35,     /* random elite multipliers */
  xp0:      6,     xpG:      1.0760,
  gold0:    4,     goldG:    1.0790,
  packSize: 6,                         /* monsters in a normal pack */

  /* Packs cleared before the depth counter moves. This is the single most
     load-bearing pacing number in the game. At one pack per depth the squad
     gained a depth every ~15 seconds, so difficulty compounded 1.10x per
     quarter-minute while three level-1 heroes split experience three ways —
     it out-climbed its own power and wiped inside two minutes, every time.
     Three packs per depth lets levels and gear keep up. */
  packsPerStage: 3
};

GM.realmOf = function (stage) { return Math.floor((stage - 1) / GM.STAGES_PER_REALM) + 1; };
GM.floorOf = function (stage) { return ((stage - 1) % GM.STAGES_PER_REALM) + 1; };
GM.isBossStage = function (stage) { return GM.floorOf(stage) === GM.STAGES_PER_REALM; };

/* Continuous depth scaling for the flat half of an epitaph. Tiers are
   discrete and run out at depth 84; without this a depth-120 death teaches
   nothing a depth-84 one did not. FLAT stats only — percentages are already
   multiplicative and inflating them too would compound twice. */
GM.depthScale = function (depth) { return Math.pow(GM.CURVE.depthScale, Math.max(0, depth - 1)); };

/* The class kit's growth with level: one curve for every kit number. */
GM.kitScale = function (level) { return Math.pow(GM.CURVE.kitG, Math.max(0, level - 1)); };

/* The opening is the one place a single curve cannot serve.

   A squad that has farmed its depth is a few times stronger than the three
   heroes a new save starts with, so a constant tuned for the steady state
   makes the first pack a slog. This ramps the first depths down and reaches
   full strength by depth 25. With a smooth kit curve (no gear tiers to jump
   through) the ramp has to be gentle — 0.10 at depth 1 made depths 22-55 a
   valley the warband could not climb out of; 0.18 keeps the opening brisk
   without stealing the mid-game. */
GM.earlyScale = function (s) {
  var e0 = GM.CURVE.early0;
  return GM.clamp(e0 + (1 - e0) * ((s - 1) / 24), e0, 1);
};

/* Past `deepFrom` the world hardens a little faster than a levelling warband
   grows, so ranks, names and ascension are what carry it — a hundred depths
   of the same ratio would be a hundred depths of the same fight. */
GM.deepScale = function (s) { return Math.pow(GM.CURVE.deepG, Math.max(0, s - GM.CURVE.deepFrom)); };
GM.monHp    = function (s) { return GM.CURVE.monHp0  * Math.pow(GM.CURVE.monHpG,  s - 1) * GM.earlyScale(s) * GM.deepScale(s); };
GM.monDmg   = function (s) { return GM.CURVE.monDmg0 * Math.pow(GM.CURVE.monDmgG, s - 1) * GM.earlyScale(s) * Math.sqrt(GM.deepScale(s)); };
GM.monArmour= function (s) { return GM.CURVE.monArm0 * Math.pow(GM.CURVE.monArmG, s - 1); };
GM.monAcc   = function (s) { return GM.CURVE.monAcc0 * Math.pow(GM.CURVE.monAccG, s - 1); };
GM.xpFor    = function (s) { return GM.CURVE.xp0     * Math.pow(GM.CURVE.xpG,     s - 1); };
GM.goldFor  = function (s) { return GM.CURVE.gold0   * Math.pow(GM.CURVE.goldG,   s - 1); };

/* Level curve. Levels hand out tree points, which are the warband's shared
   growth running alongside each hero's own kit. */
GM.MAX_LEVEL = 120;
GM.xpToLevel = function (level) { return Math.round(40 * Math.pow(1.128, level - 1)); };
GM.TREE_POINTS_PER_LEVEL = 1;

/* ---------- realms -------------------------------------------------------
   `elem` biases which monsters spawn and which resistance the realm punishes,
   so a build that ignored one element hits a wall it can read and fix. */
GM.REALMS = [
  { n: 1,  name: "The Paupers' Field",   elem: "phys", flavour: "Unmarked, unbilled, unvisited. The cheapest ground in the world and the busiest." },
  { n: 2,  name: "Sexton's Row",         elem: "phys", flavour: "Someone kept these records. Someone stopped." },
  { n: 3,  name: "The Ossuary",          elem: "cold", flavour: "Sorted by bone, not by name. Tidier than it has any right to be." },
  { n: 4,  name: "Barrowmoor",           elem: "cold", flavour: "The mounds are older than the language that named them." },
  { n: 5,  name: "The Drowned Cloister",  elem: "lit",  flavour: "They rang the bells underwater for a hundred years. Something answered." },
  { n: 6,  name: "Ashfall Necropolis",    elem: "fire", flavour: "A city built to burn its dead, which eventually burned itself." },
  { n: 7,  name: "The Turning Stones",    elem: "lit",  flavour: "They face a different way each time you count them. Stop counting." },
  { n: 8,  name: "Hollow Reliquary",      elem: "void", flavour: "Every casket here is open, and every one of them is empty." },
  { n: 9,  name: "The Long Wake",         elem: "void", flavour: "The mourners never left. Neither did the mourned." },
  { n: 10, name: "Cairnspire",            elem: "fire", flavour: "Stacked stone, stacked centuries, stacked debts." },
  { n: 11, name: "The Unlit Vault",       elem: "void", flavour: "It was sealed from the inside. Consider what that means." },
  { n: 12, name: "Threshold of Vigils",   elem: "void", flavour: "Past this the ground stops pretending to be ground." }
];

/* Beyond the authored realms the world keeps going, cycling names with a
   numbered suffix — endless progression with no data cliff. */
GM.realmInfo = function (n) {
  if (n <= GM.REALMS.length) return GM.REALMS[n - 1];
  var base = GM.REALMS[(n - 1) % GM.REALMS.length];
  var cycle = Math.floor((n - 1) / GM.REALMS.length);
  return {
    n: n, name: base.name + " " + GM.roman(cycle + 1), elem: base.elem,
    flavour: base.flavour, deeper: true
  };
};

/* ---------- monster archetypes -------------------------------------------
   `res` is resistance to the player's damage; `elem` is what the monster
   deals. A monster resistant to what you stack is the game telling you to
   diversify, which is the entire point of having five elements. */
GM.MONSTERS = [
  { id: "shambler",  name: "Shambler",         hp: 1.00, dmg: 1.00, elem: "phys", res: {},                         realms: [1, 2, 3], w: 100 },
  { id: "gravedog",  name: "Grave Dog",        hp: 0.70, dmg: 1.30, elem: "phys", res: { cold: 0.10 },             realms: [1, 2, 4], w: 90 },
  { id: "digger",    name: "Body Snatcher",    hp: 1.20, dmg: 0.85, elem: "phys", res: { phys: 0.15 },             realms: [1, 2],    w: 70 },
  { id: "bonepile",  name: "Bone Pile",        hp: 1.60, dmg: 0.70, elem: "phys", res: { phys: 0.30, cold: 0.20 }, realms: [2, 3, 4], w: 80 },
  { id: "mourner",   name: "Hollow Mourner",   hp: 0.90, dmg: 1.15, elem: "cold", res: { cold: 0.25 },             realms: [3, 4, 5], w: 85 },
  { id: "chill",     name: "Barrow Chill",     hp: 0.80, dmg: 1.25, elem: "cold", res: { cold: 0.40, fire: -0.20 },realms: [3, 4, 9], w: 75 },
  { id: "drowned",   name: "Drowned Chorister", hp: 1.15, dmg: 1.05, elem: "lit",  res: { lit: 0.30 },             realms: [5, 7],    w: 80 },
  { id: "bellwright",name: "Bellwright",       hp: 1.40, dmg: 1.10, elem: "lit",  res: { lit: 0.35, phys: 0.10 },  realms: [5, 7, 11],w: 60 },
  { id: "ashwalker", name: "Ash Walker",       hp: 0.95, dmg: 1.30, elem: "fire", res: { fire: 0.35 },             realms: [6, 10],   w: 85 },
  { id: "pyrecult",  name: "Pyre Cultist",     hp: 0.85, dmg: 1.45, elem: "fire", res: { fire: 0.30, cold: -0.15 },realms: [6, 10],   w: 70 },
  { id: "stonewake", name: "Turned Stone",     hp: 2.10, dmg: 0.80, elem: "phys", res: { phys: 0.40, lit: 0.20 },  realms: [7, 8, 10],w: 55 },
  { id: "reliquary", name: "Empty Reliquary",  hp: 1.30, dmg: 1.20, elem: "void", res: { void: 0.30 },             realms: [8, 9],    w: 70 },
  { id: "vigilant",  name: "The Vigilant",     hp: 1.50, dmg: 1.35, elem: "void", res: { void: 0.35, phys: 0.15 }, realms: [9, 11, 12], w: 60 },
  { id: "unnamed",   name: "The Unnamed",      hp: 1.75, dmg: 1.50, elem: "void", res: { void: 0.40, cold: 0.20, fire: 0.20 }, realms: [11, 12], w: 45 },
  { id: "threshold", name: "Threshold Warden", hp: 2.40, dmg: 1.40, elem: "void", res: { phys: 0.25, void: 0.30, lit: 0.25 },  realms: [12], w: 40 }
];

GM.MONSTER_BY_ID = GM.indexById(GM.MONSTERS);

/* Monsters legal in a realm. Past the authored realms the pool cycles with the
   realm name, and every archetype becomes legal so late packs stay varied. */
GM.monstersFor = function (realm) {
  var key = realm <= GM.REALMS.length ? realm : ((realm - 1) % GM.REALMS.length) + 1;
  var out = GM.MONSTERS.filter(function (m) { return m.realms.indexOf(key) >= 0; });
  return out.length ? out : GM.MONSTERS;
};

/* ---------- bosses -------------------------------------------------------
   One per authored realm, at floor 10. Bosses carry a heavier resist profile
   than anything in their realm — a gate you pass by fixing your build, not by
   grinding ten more levels. */
GM.BOSSES = [
  { realm: 1,  id: "b_pauper",  name: "The Pauper King",      elem: "phys", res: { phys: 0.20 } },
  { realm: 2,  id: "b_sexton",  name: "Sexton Ambrose",       elem: "phys", res: { phys: 0.30, cold: 0.15 } },
  { realm: 3,  id: "b_ossuary", name: "The Sorted Man",       elem: "cold", res: { cold: 0.40 } },
  { realm: 4,  id: "b_barrow",  name: "Barrow-Mother",        elem: "cold", res: { cold: 0.45, phys: 0.20 } },
  { realm: 5,  id: "b_drowned", name: "The Ninth Bell",       elem: "lit",  res: { lit: 0.45 } },
  { realm: 6,  id: "b_ashfall", name: "Cinder Magistrate",    elem: "fire", res: { fire: 0.50 } },
  { realm: 7,  id: "b_turning", name: "The Counted Stone",    elem: "lit",  res: { lit: 0.40, phys: 0.35 } },
  { realm: 8,  id: "b_hollow",  name: "What Was Kept Here",   elem: "void", res: { void: 0.45 } },
  { realm: 9,  id: "b_wake",    name: "The Chief Mourner",    elem: "void", res: { void: 0.40, cold: 0.30 } },
  { realm: 10, id: "b_cairn",   name: "Cairnspire Itself",    elem: "fire", res: { fire: 0.45, phys: 0.40 } },
  { realm: 11, id: "b_vault",   name: "The Inside Seal",      elem: "void", res: { void: 0.50, lit: 0.30 } },
  { realm: 12, id: "b_thresh",  name: "First of the Vigils",  elem: "void", res: { void: 0.50, phys: 0.30, fire: 0.25, cold: 0.25 } }
];

GM.bossFor = function (realm) {
  if (realm <= GM.BOSSES.length) return GM.BOSSES[realm - 1];
  var base = GM.BOSSES[(realm - 1) % GM.BOSSES.length];
  var cycle = Math.floor((realm - 1) / GM.BOSSES.length);
  /* Deeper cycles harden the boss's resists rather than only inflating life —
     inflated life is a longer fight, harder resists is a different fight. */
  var res = {};
  for (var k in base.res) res[k] = Math.min(0.85, base.res[k] + cycle * 0.06);
  return { realm: realm, id: base.id + "_c" + cycle, name: base.name + " " + GM.roman(cycle + 1), elem: base.elem, res: res, deeper: true };
};

/* ---------- mutators -----------------------------------------------------
   Alternate Dimension rolls three of these. `mon` scales the monsters, `you`
   scales the player, `rew` scales the payout — a mutator that hurts more pays
   more, so the mode is a live risk dial instead of flat RNG. */
GM.MUTATORS = [
  { id: "m_thick",   name: "Thickened",     desc: "Monsters have +150% Life.",              mon: { hp: 2.5 },                  rew: 1.35 },
  { id: "m_savage",  name: "Savage",        desc: "Monsters deal +80% Damage.",             mon: { dmg: 1.8 },                 rew: 1.40 },
  { id: "m_warded",  name: "Warded",        desc: "Monsters have +25% all Resistances.",    mon: { res: 0.25 },                rew: 1.45 },
  { id: "m_swift",   name: "Swift",         desc: "Monsters have +60% Accuracy.",           mon: { acc: 1.6 },                 rew: 1.20 },
  { id: "m_armoured",name: "Ironbound",     desc: "Monsters have +200% Armour.",            mon: { arm: 3.0 },                 rew: 1.30 },
  { id: "m_frail",   name: "Brittle",       desc: "Monsters have -40% Life.",               mon: { hp: 0.6 },                  rew: 0.80 },
  { id: "m_glass",   name: "Glass Vigil",   desc: "You deal +100% Damage but have -60% Life.", you: { dmg: 2.0, life: 0.4 },   rew: 1.50 },
  { id: "m_slow",    name: "Leaden",        desc: "You have -35% Attack Speed.",            you: { as: 0.65 },                 rew: 1.25 },
  { id: "m_blind",   name: "Unlit",         desc: "You have -70% Evasion.",                 you: { eva: 0.3 },                 rew: 1.15 },
  { id: "m_naked",   name: "Stripped",      desc: "You have -50% Armour.",                  you: { arm: 0.5 },                 rew: 1.15 },
  { id: "m_rich",    name: "Gilded",        desc: "+120% Gold Found.",                      rew: 1.10, find: { gold: 1.2 } },
  { id: "m_hoard",   name: "Hoarding",      desc: "+80% Shards Found.",                     rew: 1.10, find: { shards: 0.8 } },
  { id: "m_bleak",   name: "Bleak",         desc: "You regenerate no Life.",                you: { noRegen: true },            rew: 1.35 },
  { id: "m_hungry",  name: "Hungry Earth",  desc: "You cannot leech.",                      you: { noLeech: true },            rew: 1.30 },
  { id: "m_restless",name: "Restless",      desc: "Monsters have +40% Life and +40% Damage.", mon: { hp: 1.4, dmg: 1.4 },      rew: 1.45 },
  { id: "m_marked",  name: "Well-Marked",   desc: "+100% chance for Epitaphs.",             rew: 1.05, find: { epitaph: 1.0 } }
];

GM.MUTATOR_BY_ID = GM.indexById(GM.MUTATORS);

/* Roll a dimension: three distinct mutators, payout = product of their rew. */
GM.rollDimension = function (stage) {
  var pool = GM.MUTATORS.slice(), chosen = [], i;
  for (i = 0; i < 3 && pool.length; i++) {
    var idx = Math.floor(GM.rng() * pool.length);
    chosen.push(pool[idx]);
    pool.splice(idx, 1);
  }
  var rew = 1;
  for (i = 0; i < chosen.length; i++) rew *= (chosen[i].rew == null ? 1 : chosen[i].rew);
  return { stage: stage, mutators: chosen.map(function (m) { return m.id; }), reward: Math.round(rew * 100) / 100 };
};
