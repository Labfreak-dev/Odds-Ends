/* Gravemark — 04-data-meta.js
   The three progression systems that sit above gear: the passive tree, the
   town, and ascension (with seasons).

   Tree minors are generated on a polar layout; notables and keystones are
   hand-authored because those are the nodes a build is actually planned
   around. Generating the boring 70% keeps the interesting 30% readable. */
"use strict";

/* ---------- passive tree -------------------------------------------------
   Five clusters radiating from a shared root. A node is allocatable when it
   is adjacent to something already allocated, so the tree is a pathing
   puzzle, not a shopping list. */
GM.TREE_CLUSTERS = [
  { id: "warden",  name: "The Warden",  angle: -90, hue: 140, theme: "Life and Armour",
    minor: { flatLife: 26, flatArmour: 34 }, minorAlt: { incLife: 0.03 } },
  { id: "reaver",  name: "The Reaver",  angle: -18, hue: 8,   theme: "Physical and Critical",
    minor: { incPhys: 0.06, critChance: 0.005 }, minorAlt: { critMulti: 0.05 } },
  { id: "pyre",    name: "The Pyre",    angle: 54,  hue: 30,  theme: "Elemental Damage",
    minor: { incFire: 0.05, incCold: 0.05, incLit: 0.05 }, minorAlt: { pen: 0.01 } },
  { id: "stalker", name: "The Stalker", angle: 126, hue: 190, theme: "Evasion and Speed",
    minor: { flatEvasion: 34, incAS: 0.02 }, minorAlt: { incEvasion: 0.04 } },
  { id: "sexton",  name: "The Sexton",  angle: 198, hue: 268, theme: "Spoils and Remembrance",
    minor: { findRarity: 0.04, findGold: 0.06 }, minorAlt: { findQuantity: 0.03 } }
];

/* Notables sit at rings 2, 4 and 6 of their cluster; keystones cap ring 7 and
   always carry a downside, so taking one is a commitment. */
var NOTABLES = {
  warden: [
    { ring: 2, name: "Deep Footings",   stats: { flatLife: 90, incArmour: 0.15 } },
    { ring: 4, name: "Coffin Lid",      stats: { incLife: 0.10, resAll: 0.06, flatArmour: 180 } },
    { ring: 6, name: "Quiet Earth",     stats: { incLife: 0.16, regenFlat: 55, incArmour: 0.30 } }
  ],
  reaver: [
    { ring: 2, name: "Grave Habit",     stats: { incPhys: 0.18, incAS: 0.05 } },
    { ring: 4, name: "Ribsplitter",     stats: { critChance: 0.035, critMulti: 0.25 } },
    { ring: 6, name: "The Long Cut",    stats: { incPhys: 0.35, critMulti: 0.45, leechPct: 0.006 } }
  ],
  pyre: [
    { ring: 2, name: "Kindling",        stats: { incFire: 0.16, incCold: 0.16, incLit: 0.16 } },
    { ring: 4, name: "Sundering",       stats: { pen: 0.06, incDmg: 0.12 } },
    { ring: 6, name: "Unmaking",        stats: { incVoid: 0.40, pen: 0.09, incDmg: 0.18 } }
  ],
  stalker: [
    { ring: 2, name: "Light Tread",     stats: { incEvasion: 0.22, incAS: 0.06 } },
    { ring: 4, name: "Pallbearer's Pace",stats: { incAS: 0.12, flatEvasion: 320 } },
    { ring: 6, name: "The Last Mile",   stats: { incAS: 0.18, incEvasion: 0.45, graveHaste: 0.35 } }
  ],
  sexton: [
    { ring: 2, name: "Tally Book",      stats: { findRarity: 0.18, findXP: 0.10 } },
    { ring: 4, name: "Sexton's Due",    stats: { findGold: 0.45, findQuantity: 0.14 } },
    { ring: 6, name: "Buried Names",    stats: { epitaphChance: 0.12, findRarity: 0.30, graveHaste: 0.25 } }
  ]
};

var KEYSTONES = {
  warden:  { name: "Monument",     stats: { incLife: 0.45, incArmour: 0.60, incAS: -0.25 },
             desc: "Immovable, and slow about it." },
  reaver:  { name: "Nine Bells",   stats: { critMulti: 1.00, critChance: 0.06, incLife: -0.30 },
             desc: "Every ninth swing is the only one that mattered." },
  pyre:    { name: "Cinderfall",   stats: { incFire: 0.60, incCold: 0.60, incLit: 0.60, incVoid: 0.60, incPhys: -0.80 },
             desc: "Physical damage is for people with hands." },
  stalker: { name: "Unlit Lamp",   stats: { incEvasion: 0.90, incAS: 0.25, flatArmour: -99999 },
             desc: "Armour is a promise. Evasion is a habit." },
  sexton:  { name: "The Long Wake", stats: { epitaphChance: 0.30, findRarity: 0.80, findQuantity: 0.35, incDmg: -0.25 },
             desc: "You are not here to fight. You are here to collect." }
};

/* Build the node graph. Ring r holds `nodesInRing(r)` nodes fanned across the
   cluster's angular slice; each links back to its nearest ring-(r-1) neighbour
   so every cluster is a connected tree from the root outward. */
GM.TREE_RINGS = 7;
GM.TREE_NODES = (function () {
  var nodes = [];
  var RING_R = [0, 78, 148, 214, 282, 350, 420, 496];
  var SPREAD = 30; /* degrees either side of the cluster's axis */

  nodes.push({ id: "root", name: "The Threshold", cluster: null, kind: "root",
               x: 0, y: 0, ring: 0, stats: {}, links: [] });

  /* Node counts per ring. The total must comfortably EXCEED the points a
     maxed character has (level 120 grants 119), or the tree stops being a
     choice and becomes a checklist. 26 nodes + 1 keystone per cluster x 5
     clusters = 135 allocatable against 119 points. */
  var RING_COUNT = [3, 4, 5, 5, 5, 4, 1];
  function nodesInRing(r) { return RING_COUNT[r - 1]; }

  GM.TREE_CLUSTERS.forEach(function (c) {
    var prevRing = [];
    for (var r = 1; r <= GM.TREE_RINGS; r++) {
      var count = nodesInRing(r);
      var notable = (NOTABLES[c.id] || []).filter(function (n) { return n.ring === r; })[0];
      var ring = [];
      for (var i = 0; i < count; i++) {
        var t = count === 1 ? 0.5 : i / (count - 1);
        var deg = c.angle + (t - 0.5) * 2 * SPREAD * (r / GM.TREE_RINGS + 0.35);
        var rad = deg * Math.PI / 180;
        var dist = RING_R[r];
        var isNotable = !!notable && i === Math.floor(count / 2);
        var isKey = r === GM.TREE_RINGS;

        var id = c.id + "_r" + r + "_" + i;
        var stats, name, kind;
        if (isKey) {
          kind = "keystone"; name = KEYSTONES[c.id].name; stats = KEYSTONES[c.id].stats;
        } else if (isNotable) {
          kind = "notable"; name = notable.name; stats = notable.stats;
        } else {
          kind = "minor";
          /* Alternate the two minor flavours so a cluster path isn't monotone. */
          var useAlt = (r + i) % 3 === 2;
          var src = useAlt ? c.minorAlt : c.minor;
          stats = {};
          for (var k in src) stats[k] = src[k] * (1 + (r - 1) * 0.55);
          name = c.name + " " + GM.roman(r);
        }

        var node = {
          id: id, name: name, cluster: c.id, kind: kind, ring: r,
          x: Math.round(Math.cos(rad) * dist),
          y: Math.round(Math.sin(rad) * dist),
          stats: stats, links: [],
          desc: isKey ? KEYSTONES[c.id].desc : null
        };
        nodes.push(node);
        ring.push(node);
      }

      /* Link this ring to the previous one (or the root at ring 1). */
      ring.forEach(function (n) {
        if (r === 1) { n.links.push("root"); return; }
        var best = null, bestD = Infinity;
        prevRing.forEach(function (p) {
          var d = (p.x - n.x) * (p.x - n.x) + (p.y - n.y) * (p.y - n.y);
          if (d < bestD) { bestD = d; best = p; }
        });
        if (best) n.links.push(best.id);
      });
      prevRing = ring;
    }
  });

  /* Links are declared one-way above; make the graph undirected so adjacency
     checks work from either end. */
  var byId = GM.indexById(nodes);
  nodes.forEach(function (n) {
    n.links.forEach(function (l) {
      var other = byId[l];
      if (other && other.links.indexOf(n.id) < 0) other.links.push(n.id);
    });
  });

  return nodes;
})();

GM.TREE_BY_ID = GM.indexById(GM.TREE_NODES);

/* ---------- town ---------------------------------------------------------
   Buildings are a gold sink that converts idle income into permanent power.
   `per` is the effect of ONE level; totals are level * per. */
GM.BUILDINGS = [
  { id: "gravehouse", name: "Gravehouse",  icon: "⚰",
    blurb: "Somewhere to put yourself back together.",
    per: { incLife: 0.04 },          cost0: 60,   costG: 1.42, max: 60 },
  { id: "whetstone",  name: "Whetstone Shrine", icon: "⚒",
    blurb: "The edge remembers what the hand forgets.",
    per: { incDmg: 0.035 },          cost0: 75,   costG: 1.45, max: 60 },
  { id: "vault",      name: "The Vault",   icon: "\u{1FA99}",
    blurb: "Coin buried is coin kept.",
    per: { findGold: 0.09 },         cost0: 90,   costG: 1.38, max: 50 },
  { id: "library",    name: "Ossuary Library", icon: "\u{1F4D6}",
    blurb: "Every bone here is catalogued and cross-referenced.",
    per: { findXP: 0.06 },           cost0: 110,  costG: 1.40, max: 50 },
  { id: "watchtower", name: "Watchtower",  icon: "\u{1F5FC}",
    blurb: "Sees what is worth taking before you get there.",
    per: { findRarity: 0.07 },       cost0: 140,  costG: 1.44, max: 50 },
  { id: "forge",      name: "The Forge",   icon: "\u{1F525}",
    blurb: "Cheapens the work. Never cheapens the result.",
    per: { craftDiscount: 0.015 },   cost0: 200,  costG: 1.48, max: 40 },
  { id: "lychgate",   name: "Lychgate",    icon: "\u{1F6AA}",
    blurb: "The dead keep working while you are away.",
    per: { offlineHours: 0.5 },      cost0: 260,  costG: 1.50, max: 40 },
  { id: "memorial",   name: "The Memorial", icon: "\u{1F5FF}",
    blurb: "Names cut deep enough to outlast the stone.",
    per: { epitaphChance: 0.012, graveHaste: 0.05 }, cost0: 340, costG: 1.52, max: 40 }
];

GM.BUILDING_BY_ID = GM.indexById(GM.BUILDINGS);

GM.buildingCost = function (b, level) {
  return Math.ceil(b.cost0 * Math.pow(b.costG, level));
};

/* ---------- ascension ----------------------------------------------------
   Reset gear, level and depth for Ichor, spent on permanent multipliers that
   survive every future reset. Ichor is superlinear in depth, so pushing two
   realms further is worth far more than resetting twice as often. */
GM.ASCEND_MIN_STAGE = 40;

GM.ichorFor = function (maxStage) {
  if (maxStage < GM.ASCEND_MIN_STAGE) return 0;
  return Math.floor(Math.pow((maxStage - GM.ASCEND_MIN_STAGE + 10) / 9, 1.62));
};

GM.PERKS = [
  { id: "a_dmg",    name: "Sharpened Memory", blurb: "The swing you died on, remembered better.",
    per: { incDmg: 0.10 },        cost0: 1,  costG: 1.34, max: 40 },
  { id: "a_life",   name: "Deeper Roots",     blurb: "Harder to put down each time.",
    per: { incLife: 0.09 },       cost0: 1,  costG: 1.34, max: 40 },
  { id: "a_as",     name: "Old Reflexes",     blurb: "The hands learned it. The hands kept it.",
    per: { incAS: 0.04 },         cost0: 2,  costG: 1.40, max: 30 },
  { id: "a_res",    name: "Weathered",        blurb: "Nothing surprises you twice.",
    per: { resAll: 0.02 },        cost0: 2,  costG: 1.38, max: 20 },
  { id: "a_crit",   name: "Practised Cruelty",blurb: "You know where it goes now.",
    per: { critMulti: 0.12 },     cost0: 3,  costG: 1.42, max: 30 },
  { id: "a_find",   name: "Grave Instinct",   blurb: "You can smell a good one through the lid.",
    per: { findRarity: 0.12, findQuantity: 0.05 }, cost0: 3, costG: 1.40, max: 30 },
  { id: "a_xp",     name: "Hard Schooling",   blurb: "Lessons stick when they cost this much.",
    per: { findXP: 0.10 },        cost0: 2,  costG: 1.36, max: 30 },
  { id: "a_start",  name: "Familiar Ground",  blurb: "Begin each descent further down.",
    per: { startStage: 2 },       cost0: 4,  costG: 1.50, max: 25 },
  { id: "a_epi",    name: "Kept Names",       blurb: "More of the dead worth quoting.",
    per: { epitaphChance: 0.04 }, cost0: 5,  costG: 1.46, max: 20 },
  { id: "a_grave",  name: "Short Vigil",      blurb: "Your graves give up their contents faster.",
    per: { graveHaste: 0.15 },    cost0: 4,  costG: 1.44, max: 20 },
  { id: "a_offline",name: "The Night Shift",  blurb: "Longer nights, deeper takings.",
    per: { offlineHours: 1.0 },   cost0: 6,  costG: 1.52, max: 20 }
];

GM.PERK_BY_ID = GM.indexById(GM.PERKS);

GM.perkCost = function (p, level) {
  return Math.ceil(p.cost0 * Math.pow(p.costG, level));
};

/* ---------- seasons ------------------------------------------------------
   A season is a fully separate save slot carrying one global rule. Nothing
   crosses over except bragging rights, which is the point — a clean run under
   a constraint you did not choose. */
GM.SEASONS = [
  { id: "s_none",   name: "Standard",        blurb: "No modifier. The long game.",
    rule: {} },
  { id: "s_frail",  name: "Season of Glass", blurb: "Everything hits twice as hard. You hit three times as hard.",
    rule: { monDmg: 2.0, playerDmg: 3.0 } },
  { id: "s_poor",   name: "Season of Want",  blurb: "Half the gold, double the drops.",
    rule: { gold: 0.5, quantity: 2.0 } },
  { id: "s_deep",   name: "Season of Depth", blurb: "Start at realm 3. Monsters gain 20% life per realm beyond 6.",
    rule: { startStage: 21, deepScale: 0.20 } },
  { id: "s_vigil",  name: "Season of Vigils",blurb: "Gravemarks pay triple. Everything else pays nothing extra.",
    rule: { epitaph: 3.0 } }
];

GM.SEASON_BY_ID = GM.indexById(GM.SEASONS);
