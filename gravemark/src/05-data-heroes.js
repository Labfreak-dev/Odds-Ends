/* Gravemark — 05-data-heroes.js
   The roster: classes, ranks, the name pool, and how a hero is made.

   The game is no longer one character. It is a WARBAND of up to 22, split
   across three squads that delve simultaneously. A hero owns their own level,
   experience, class and full set of equipment; the passive tree, the parish
   and ascension stay shared, because those are the player's institution rather
   than any one person's. */
"use strict";

GM.ROSTER_MAX = 22;
GM.SQUAD_COUNT = 3;
GM.SQUAD_SIZE = 5;

/* ---------- classes ------------------------------------------------------
   Deliberately the same five identities as the passive tree's clusters, so a
   Reaver on the roster and the Reaver branch of the tree mean the same thing.
   `mod` scales the hero's contribution; `grow` is per-level growth. */
GM.CLASSES = [
  { id: "warden",  name: "Warden",  role: "Front",   icon: "\u{1F6E1}", hue: 140,
    blurb: "Stands where the ground is worst.",
    mod:  { life: 1.55, armour: 1.70, dmg: 0.70, as: 0.90 },
    grow: { life: 1.030, dmg: 1.018 },
    bias: { flatArmour: 40, flatLife: 30 } },

  { id: "reaver",  name: "Reaver",  role: "Strike",  icon: "⚔", hue: 8,
    blurb: "Paid by the swing, not the hour.",
    mod:  { life: 0.90, armour: 0.85, dmg: 1.55, as: 1.10 },
    grow: { life: 1.020, dmg: 1.030 },
    bias: { flatPhys: 8, critChance: 0.02 } },

  { id: "pyre",    name: "Pyre",    role: "Ruin",    icon: "\u{1F525}", hue: 30,
    blurb: "Burns the field, then salts it.",
    mod:  { life: 0.80, armour: 0.65, dmg: 1.70, as: 0.95 },
    grow: { life: 1.018, dmg: 1.032 },
    bias: { flatFire: 6, flatCold: 6, flatLit: 6 } },

  { id: "stalker", name: "Stalker", role: "Flank",   icon: "\u{1F3F9}", hue: 190,
    blurb: "Never where the blow lands.",
    mod:  { life: 0.85, armour: 0.70, dmg: 1.25, as: 1.45 },
    grow: { life: 1.019, dmg: 1.026 },
    bias: { flatEvasion: 45, incAS: 0.05 } },

  { id: "sexton",  name: "Sexton",  role: "Support", icon: "\u{1F5DD}", hue: 268,
    blurb: "Knows which graves are worth opening.",
    mod:  { life: 1.00, armour: 0.95, dmg: 0.85, as: 1.00 },
    grow: { life: 1.024, dmg: 1.020 },
    bias: { findRarity: 0.10, findGold: 0.15, regenFlat: 4 } }
];

GM.CLASS_BY_ID = GM.indexById(GM.CLASSES);

/* ---------- ranks --------------------------------------------------------
   The I / II / III numeral beside a name. A higher rank is flatly stronger and
   levels further, so recruiting is its own progression axis alongside gear. */
GM.RANKS = [
  { id: 1, numeral: "I",   name: "Sworn",    mult: 1.00, maxLevel: 60,  w: 100, css: "rk1" },
  { id: 2, numeral: "II",  name: "Anointed", mult: 1.45, maxLevel: 90,  w: 34,  css: "rk2" },
  { id: 3, numeral: "III", name: "Vigil",    mult: 2.10, maxLevel: 120, w: 9,   css: "rk3" }
];
GM.RANK_BY_ID = GM.indexById(GM.RANKS);

/* ---------- names --------------------------------------------------------
   Thirty, so a full roster of 22 never repeats. */
GM.HERO_NAMES = [
  "Yvain", "Zephan", "Roland", "Hadren", "Brennan", "Severin", "Corvin",
  "Gideon", "Kairn", "Aldric", "Mercer", "Thal", "Osric", "Rowan", "Vance",
  "Emeric", "Dolan", "Garrick", "Isolde", "Maud", "Wren", "Sable", "Alys",
  "Rusk", "Peder", "Cassian", "Nym", "Bellamy", "Orsin", "Faye"
];

/* ---------- making a hero ------------------------------------------------ */
GM.makeHero = function (opts) {
  opts = opts || {};
  var cls = opts.classId ? GM.CLASS_BY_ID[opts.classId] : GM.pick(GM.CLASSES);
  var rank = opts.rank ? GM.RANK_BY_ID[opts.rank] : GM.pickW(GM.RANKS).id;
  if (typeof rank === "number") rank = GM.RANK_BY_ID[rank];

  var used = {};
  (GM.state.heroes || []).forEach(function (h) { used[h.name] = true; });
  var pool = GM.HERO_NAMES.filter(function (n) { return !used[n]; });
  var name = opts.name || (pool.length ? GM.pick(pool) : GM.pick(GM.HERO_NAMES));

  var equip = {};
  for (var i = 0; i < GM.SLOT_IDS.length; i++) equip[GM.SLOT_IDS[i]] = null;

  return {
    id: GM.uid("h"),
    name: name,
    classId: cls.id,
    rank: rank.id,
    level: opts.level || 1,
    xp: 0,
    equip: equip,
    portrait: Math.floor(GM.rng() * 12),   /* which portrait art to use */
    hired: Date.now(),
    /* Per-hero life carries between fights, like the old single character. */
    hp: 1, hpMax: 1
  };
};

GM.heroClass = function (h) { return GM.CLASS_BY_ID[h.classId] || GM.CLASSES[0]; };
GM.heroRank  = function (h) { return GM.RANK_BY_ID[h.rank] || GM.RANKS[0]; };
GM.heroMaxLevel = function (h) { return GM.heroRank(h).maxLevel; };

GM.heroById = function (id) {
  var hs = GM.state.heroes || [];
  for (var i = 0; i < hs.length; i++) if (hs[i].id === id) return hs[i];
  return null;
};

/* Experience to reach the next level. Higher ranks cost more per level, which
   is what stops a rank III from simply being a free head start. */
GM.heroXpToLevel = function (h) {
  return Math.round(40 * Math.pow(1.128, h.level - 1) * GM.heroRank(h).mult);
};

/* ---------- recruiting ---------------------------------------------------
   Gold buys a roll; the rank is the lottery. Cost climbs with roster size so
   a full warband is a real investment rather than an afternoon's income. */
GM.recruitCost = function () {
  var n = (GM.state.heroes || []).length;
  return Math.ceil(400 * Math.pow(1.34, n));
};

GM.canRecruit = function () {
  return (GM.state.heroes || []).length < GM.ROSTER_MAX;
};

GM.recruit = function () {
  if (!GM.canRecruit()) return { ok: false, why: "The warband is full." };
  var cost = GM.recruitCost();
  if (!GM.spendGold(cost)) return { ok: false, why: "Not enough gold." };
  var h = GM.makeHero({});
  GM.state.heroes.push(h);
  GM.log(h.name + " takes the oath. " + GM.heroRank(h).name + " " +
         GM.heroClass(h).name + ".", "recruit");
  GM.bus.emit("roster:changed");
  return { ok: true, hero: h, cost: cost };
};

/* Dismissing returns a fraction of what was paid and frees the name. Gear on
   a dismissed hero goes to the stash rather than vanishing. */
GM.dismiss = function (heroId) {
  var hs = GM.state.heroes;
  var idx = -1;
  for (var i = 0; i < hs.length; i++) if (hs[i].id === heroId) idx = i;
  if (idx < 0) return { ok: false, why: "No such hero." };
  if (hs.length <= 1) return { ok: false, why: "Someone has to hold the lantern." };

  var h = hs[idx];
  for (var j = 0; j < GM.SLOT_IDS.length; j++) {
    var it = h.equip[GM.SLOT_IDS[j]];
    if (it) GM.stashItem(it);
  }
  hs.splice(idx, 1);
  /* Pull them out of whatever squad they were in. */
  (GM.state.squads || []).forEach(function (sq) {
    var k = sq.members.indexOf(heroId);
    if (k >= 0) sq.members.splice(k, 1);
  });
  GM.log(h.name + " is released from the oath.", "recruit");
  GM.bus.emit("roster:changed");
  return { ok: true };
};

/* ---------- squads ------------------------------------------------------- */
GM.SQUAD_NAMES = ["First Vigil", "Second Vigil", "Third Vigil"];

GM.blankSquad = function (i) {
  return {
    id: "sq" + i,
    name: GM.SQUAD_NAMES[i] || ("Vigil " + (i + 1)),
    members: [],
    stage: 1,
    max: 1,
    kills: 0,
    auto: true,
    running: true,
    mode: "expedition",
    target: 1,
    dim: null,
    /* live encounter */
    monsters: [],
    packMax: 0,
    victory: null      /* set when a stage clears, for the banner */
  };
};

GM.squadById = function (id) {
  var sq = GM.state.squads || [];
  for (var i = 0; i < sq.length; i++) if (sq[i].id === id) return sq[i];
  return null;
};

GM.squadOf = function (heroId) {
  var sq = GM.state.squads || [];
  for (var i = 0; i < sq.length; i++) {
    if (sq[i].members.indexOf(heroId) >= 0) return sq[i];
  }
  return null;
};

GM.squadHeroes = function (sq) {
  var out = [];
  for (var i = 0; i < sq.members.length; i++) {
    var h = GM.heroById(sq.members[i]);
    if (h) out.push(h);
  }
  return out;
};

/* Assign a hero to a squad, removing them from any other. Passing null for
   squadId benches them. */
GM.assignHero = function (heroId, squadId) {
  var sqs = GM.state.squads || [];
  for (var i = 0; i < sqs.length; i++) {
    var k = sqs[i].members.indexOf(heroId);
    if (k >= 0) sqs[i].members.splice(k, 1);
  }
  if (squadId) {
    var target = GM.squadById(squadId);
    if (!target) return { ok: false, why: "No such squad." };
    if (target.members.length >= GM.SQUAD_SIZE) {
      return { ok: false, why: target.name + " is full." };
    }
    target.members.push(heroId);
  }
  GM.bus.emit("roster:changed");
  GM.bus.emit("squads:changed");
  return { ok: true };
};

/* Fill empty squad slots with the strongest benched heroes. Used on a fresh
   save and by the roster's "auto-assign" button. */
GM.autoAssign = function () {
  var assignedIds = {};
  (GM.state.squads || []).forEach(function (sq) {
    sq.members.forEach(function (id) { assignedIds[id] = true; });
  });
  var bench = (GM.state.heroes || []).filter(function (h) { return !assignedIds[h.id]; });
  bench.sort(function (a, b) {
    return (GM.heroRank(b).mult * b.level) - (GM.heroRank(a).mult * a.level);
  });

  var moved = 0;
  (GM.state.squads || []).forEach(function (sq) {
    while (sq.members.length < GM.SQUAD_SIZE && bench.length) {
      sq.members.push(bench.shift().id);
      moved++;
    }
  });
  if (moved) {
    GM.bus.emit("roster:changed");
    GM.bus.emit("squads:changed");
  }
  return moved;
};
