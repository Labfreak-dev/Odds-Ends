/* Gravemark — 01-data-kit.js
   The stat vocabulary and the epitaph vocabulary.

   There are no items. A hero is a whole unit: the class decides the weapon
   and the armour, the level grows them, the rank multiplies them, and the
   only thing that is ever ADDED to a hero is an epitaph — a remembered roll
   recovered from a gravemark and inscribed as a permanent trait.

   The epitaph pool below is generated from compact curves, the way the old
   affix table was: a curve tweak is a one-number edit. Nothing here throws at
   load — a throw would poison every const declared after it in the bundle. */
"use strict";

/* ---------- elements ----------------------------------------------------- */
GM.ELEMENTS = ["phys", "fire", "cold", "lit", "void"];

GM.ELEM_META = {
  phys: { label: "Physical", short: "Phys", css: "e-phys" },
  fire: { label: "Fire",     short: "Fire", css: "e-fire" },
  cold: { label: "Frost",    short: "Cold", css: "e-cold" },
  lit:  { label: "Storm",    short: "Lit",  css: "e-lit"  },
  void: { label: "Void",     short: "Void", css: "e-void" }
};

/* ---------- stat vocabulary ---------------------------------------------
   Every number that can appear on a trait, the tree, a building or a perk.
   `pct:true` means the stored value is a fraction rendered as a percentage. */
GM.STAT_DEFS = {
  /* offence — flat added damage */
  flatPhys:   { label: "Added Physical Damage" },
  flatFire:   { label: "Added Fire Damage" },
  flatCold:   { label: "Added Frost Damage" },
  flatLit:    { label: "Added Storm Damage" },
  flatVoid:   { label: "Added Void Damage" },
  /* offence — multipliers */
  incDmg:     { label: "increased Damage",          pct: true },
  incPhys:    { label: "increased Physical Damage", pct: true },
  incFire:    { label: "increased Fire Damage",     pct: true },
  incCold:    { label: "increased Frost Damage",    pct: true },
  incLit:     { label: "increased Storm Damage",    pct: true },
  incVoid:    { label: "increased Void Damage",     pct: true },
  incAS:      { label: "increased Attack Speed",    pct: true },
  critChance: { label: "Critical Chance",           pct: true },
  critMulti:  { label: "Critical Damage",           pct: true },
  pen:        { label: "Resistance Penetration",    pct: true },
  /* defence */
  flatLife:    { label: "Maximum Life" },
  incLife:     { label: "increased Maximum Life", pct: true },
  flatArmour:  { label: "Armour" },
  incArmour:   { label: "increased Armour",   pct: true },
  flatEvasion: { label: "Evasion" },
  incEvasion:  { label: "increased Evasion",  pct: true },
  resFire:     { label: "Fire Resistance",  pct: true },
  resCold:     { label: "Frost Resistance", pct: true },
  resLit:      { label: "Storm Resistance", pct: true },
  resVoid:     { label: "Void Resistance",  pct: true },
  resAll:      { label: "All Resistances",  pct: true },
  regenPct:    { label: "Life Regenerated per second", pct: true },
  regenFlat:   { label: "Life Regenerated per second" },
  leechPct:    { label: "Damage Leeched as Life",      pct: true },
  /* utility */
  findShards:   { label: "increased Shards Found",  pct: true },
  findGold:     { label: "increased Gold Found",    pct: true },
  findXP:       { label: "increased Experience",    pct: true },
  /* Gravemark-specific */
  epitaphChance: { label: "chance for an extra Epitaph", pct: true },
  graveHaste:    { label: "increased Gravemark Recovery", pct: true },
  craftDiscount: { label: "cheaper Inscription",          pct: true }
};

/* Resistances are capped; without this, stacking res trivialises the game. */
GM.RES_CAP = 0.75;
GM.CRIT_BASE_MULTI = 1.5;

GM.statLabel = function (key) {
  var d = GM.STAT_DEFS[key];
  return d ? d.label : key;
};

/* Render one stat line the way an ARPG tooltip would. */
GM.statLine = function (key, value) {
  var d = GM.STAT_DEFS[key];
  if (!d) return key + " " + value;
  if (d.pct) return (value >= 0 ? "+" : "") + (value * 100).toFixed(1).replace(/\.0$/, "") + "% " + d.label;
  return (value >= 0 ? "+" : "") + GM.fmt(Math.round(value)) + " " + d.label;
};

/* ---------- the epitaph vocabulary ---------------------------------------
   Each entry is a curve, not a table. `v1` is the tier-1 midpoint, `mult` the
   per-tier growth, `tiers` how many exist. Rolled values land in
   [0.76, 1.00] x the tier midpoint, so two copies of the same tier still
   differ — that variance is what makes a "good roll" mean something.

   `classes` is who can carry it. A Pyre never learns to swing harder; a
   Warden never learns to burn. "any" is legal on everyone. */
var ANY = ["warden", "reaver", "pyre", "stalker", "sexton"];
var AFF = [
  /* --- offence ---------------------------------------------------------- */
  { id: "p_phys",  kind: "prefix", group: "flatPhys", name: "Heavy",       stat: "flatPhys", classes: ["warden", "reaver", "stalker", "sexton"], v1: 2.2,  mult: 1.72, tiers: 8 },
  { id: "p_fire",  kind: "prefix", group: "flatFire", name: "Smouldering", stat: "flatFire", classes: ["pyre", "sexton"],   v1: 2.0,  mult: 1.74, tiers: 8 },
  { id: "p_cold",  kind: "prefix", group: "flatCold", name: "Gravecold",   stat: "flatCold", classes: ["pyre", "sexton"],   v1: 2.0,  mult: 1.74, tiers: 8 },
  { id: "p_lit",   kind: "prefix", group: "flatLit",  name: "Stormbit",    stat: "flatLit",  classes: ["pyre", "stalker"],  v1: 1.8,  mult: 1.78, tiers: 8 },
  { id: "p_void",  kind: "prefix", group: "flatVoid", name: "Hollow",      stat: "flatVoid", classes: ANY,                  v1: 2.6,  mult: 1.80, tiers: 7, minDepth: 24 },
  { id: "p_inc",   kind: "prefix", group: "incDmg",   name: "Vicious",     stat: "incDmg",   classes: ANY,                  v1: 0.08, mult: 1.30, tiers: 8, pct: true },
  { id: "p_incph", kind: "prefix", group: "incElem",  name: "Brutal",      stat: "incPhys",  classes: ["warden", "reaver", "stalker"], v1: 0.12, mult: 1.32, tiers: 7, pct: true },
  { id: "p_incfi", kind: "prefix", group: "incElem",  name: "Pyre",        stat: "incFire",  classes: ["pyre"],             v1: 0.12, mult: 1.32, tiers: 7, pct: true },
  { id: "p_incco", kind: "prefix", group: "incElem",  name: "Frostbound",  stat: "incCold",  classes: ["pyre"],             v1: 0.12, mult: 1.32, tiers: 7, pct: true },
  { id: "p_inclt", kind: "prefix", group: "incElem",  name: "Thundering",  stat: "incLit",   classes: ["pyre"],             v1: 0.12, mult: 1.32, tiers: 7, pct: true },
  { id: "p_incvo", kind: "prefix", group: "incElem",  name: "Unmaking",    stat: "incVoid",  classes: ANY,                  v1: 0.14, mult: 1.34, tiers: 6, pct: true, minDepth: 36 },
  /* --- defence ---------------------------------------------------------- */
  { id: "p_life",  kind: "prefix", group: "flatLife", name: "Stout",       stat: "flatLife",    classes: ANY,                 v1: 12,   mult: 1.58, tiers: 8 },
  { id: "p_inclf", kind: "prefix", group: "incLife",  name: "Enduring",    stat: "incLife",     classes: ANY,                 v1: 0.06, mult: 1.28, tiers: 7, pct: true },
  { id: "p_arm",   kind: "prefix", group: "flatArm",  name: "Plated",      stat: "flatArmour",  classes: ["warden", "reaver", "sexton"], v1: 16, mult: 1.60, tiers: 8 },
  { id: "p_eva",   kind: "prefix", group: "flatEva",  name: "Shrouded",    stat: "flatEvasion", classes: ["stalker", "pyre", "sexton"],  v1: 16, mult: 1.60, tiers: 8 },
  { id: "p_incarm",kind: "prefix", group: "incDef",   name: "Fortified",   stat: "incArmour",   classes: ["warden", "reaver"], v1: 0.10, mult: 1.30, tiers: 7, pct: true },
  { id: "p_inceva",kind: "prefix", group: "incDef",   name: "Fleeting",    stat: "incEvasion",  classes: ["stalker", "pyre"],  v1: 0.10, mult: 1.30, tiers: 7, pct: true },

  /* --- suffixes: offence ------------------------------------------------ */
  { id: "s_as",    kind: "suffix", group: "incAS",   name: "of Haste",     stat: "incAS",      classes: ANY,                  v1: 0.05,  mult: 1.24, tiers: 8, pct: true },
  { id: "s_crit",  kind: "suffix", group: "crit",    name: "of Cruelty",   stat: "critChance", classes: ["reaver", "stalker", "pyre"], v1: 0.015, mult: 1.26, tiers: 7, pct: true },
  { id: "s_cmul",  kind: "suffix", group: "critM",   name: "of Ruin",      stat: "critMulti",  classes: ["reaver", "stalker", "pyre"], v1: 0.08,  mult: 1.24, tiers: 7, pct: true },
  { id: "s_pen",   kind: "suffix", group: "pen",     name: "of Sundering", stat: "pen",        classes: ["pyre", "reaver"],   v1: 0.03,  mult: 1.24, tiers: 6, pct: true, minDepth: 36 },
  /* --- suffixes: defence ------------------------------------------------ */
  { id: "s_rfire", kind: "suffix", group: "resFire", name: "of the Ember",  stat: "resFire",   classes: ANY, v1: 0.05,  mult: 1.22, tiers: 7, pct: true },
  { id: "s_rcold", kind: "suffix", group: "resCold", name: "of the Cairn",  stat: "resCold",   classes: ANY, v1: 0.05,  mult: 1.22, tiers: 7, pct: true },
  { id: "s_rlit",  kind: "suffix", group: "resLit",  name: "of the Gale",   stat: "resLit",    classes: ANY, v1: 0.05,  mult: 1.22, tiers: 7, pct: true },
  { id: "s_rvoid", kind: "suffix", group: "resVoid", name: "of the Hollow", stat: "resVoid",   classes: ANY, v1: 0.04,  mult: 1.24, tiers: 6, pct: true, minDepth: 24 },
  { id: "s_rall",  kind: "suffix", group: "resAll",  name: "of Warding",    stat: "resAll",    classes: ["warden", "sexton"], v1: 0.025, mult: 1.22, tiers: 6, pct: true, minDepth: 24 },
  { id: "s_regen", kind: "suffix", group: "regen",   name: "of Mending",    stat: "regenFlat", classes: ["warden", "sexton"], v1: 3,     mult: 1.52, tiers: 8 },
  { id: "s_leech", kind: "suffix", group: "leech",   name: "of the Ghoul",  stat: "leechPct",  classes: ["reaver", "stalker"], v1: 0.004, mult: 1.26, tiers: 6, pct: true, minDepth: 24 },
  /* --- suffixes: utility ------------------------------------------------ */
  { id: "s_shard", kind: "suffix", group: "findS",   name: "of Plenty",     stat: "findShards", classes: ["sexton", "stalker"], v1: 0.06, mult: 1.24, tiers: 7, pct: true },
  { id: "s_gold",  kind: "suffix", group: "findG",   name: "of Avarice",    stat: "findGold",   classes: ["sexton", "stalker"], v1: 0.10, mult: 1.26, tiers: 6, pct: true },
  { id: "s_xp",    kind: "suffix", group: "findX",   name: "of Study",      stat: "findXP",     classes: ANY,                   v1: 0.05, mult: 1.22, tiers: 6, pct: true },
  /* --- suffixes: Gravemark ---------------------------------------------- */
  { id: "s_epi",   kind: "suffix", group: "epitaph", name: "of Remembrance", stat: "epitaphChance", classes: ["sexton"],      v1: 0.03, mult: 1.26, tiers: 5, pct: true, minDepth: 48 },
  { id: "s_ghaste",kind: "suffix", group: "grave",   name: "of the Vigil",   stat: "graveHaste",    classes: ["sexton", "warden"], v1: 0.08, mult: 1.24, tiers: 5, pct: true, minDepth: 48 }
];

/* Expand each curve into concrete tiers. Tier n is the strongest and gates
   deepest, matching the ARPG convention where T1 is best — so we store
   ascending internally and expose `displayTier` counting down. */
GM.AFFIXES = AFF.map(function (a) {
  var tiers = [];
  for (var i = 1; i <= a.tiers; i++) {
    var mid = a.v1 * Math.pow(a.mult, i - 1);
    var depth = (a.minDepth || 0) + (i - 1) * 11;
    tiers.push({
      tier: i,
      displayTier: a.tiers - i + 1,
      depth: depth,
      min: a.pct ? Math.round(mid * 0.76 * 10000) / 10000 : Math.max(1, Math.round(mid * 0.76)),
      max: a.pct ? Math.round(mid * 1.00 * 10000) / 10000 : Math.max(1, Math.round(mid))
    });
  }
  return {
    id: a.id, kind: a.kind, group: a.group, name: a.name,
    stat: a.stat, classes: a.classes, pct: !!a.pct, tierCount: a.tiers, tiers: tiers
  };
});

GM.AFFIX_BY_ID = GM.indexById(GM.AFFIXES);

/* Epitaphs a class can learn at a depth, each paired with the tiers that
   depth unlocks. Higher tiers are rarer: weight falls off with tier so a
   fresh T1 roll stays a genuine event. */
GM.affixesFor = function (classId, depth, kind) {
  var out = [];
  for (var i = 0; i < GM.AFFIXES.length; i++) {
    var a = GM.AFFIXES[i];
    if (kind && a.kind !== kind) continue;
    if (classId && a.classes.indexOf(classId) < 0) continue;
    var legal = [];
    for (var t = 0; t < a.tiers.length; t++) {
      if (a.tiers[t].depth <= depth) legal.push(a.tiers[t]);
    }
    if (!legal.length) continue;
    out.push({ affix: a, tiers: legal, w: 100 });
  }
  return out;
};

/* Weight for choosing among the legal tiers of one epitaph. */
GM.tierWeight = function (tierEntry, depth) {
  var behind = Math.max(0, Math.floor((depth - tierEntry.depth) / 11));
  return 1 / (1 + behind * 0.85);
};

/* Roll one epitaph record for a class at a depth. Flat rolls scale with the
   depth they were learned at, so a tier-8 life roll from depth 120 genuinely
   beats the same tier from depth 84 — dying deep is worth something. */
GM.rollEpitaphRecord = function (classId, depth, usedGroups) {
  var candidates = GM.affixesFor(classId, depth, null);
  var guard = 0;
  while (candidates.length && guard++ < 50) {
    var pickIdx = -1, total = 0, i;
    for (i = 0; i < candidates.length; i++) total += candidates[i].w;
    var r = GM.rng() * total;
    for (i = 0; i < candidates.length; i++) {
      r -= candidates[i].w;
      if (r <= 0) { pickIdx = i; break; }
    }
    if (pickIdx < 0) pickIdx = candidates.length - 1;
    var entry = candidates[pickIdx];
    candidates.splice(pickIdx, 1);
    if (usedGroups && usedGroups[entry.affix.group]) continue;
    if (usedGroups) usedGroups[entry.affix.group] = true;
    var te = GM.pickW(entry.tiers, function (t) { return GM.tierWeight(t, depth); });
    var v = GM.randF(te.min, te.max);
    var value = entry.affix.pct
      ? Math.round(v * 10000) / 10000
      : Math.max(1, Math.round(v * GM.depthScale(depth)));
    return {
      affixId: entry.affix.id, stat: entry.affix.stat, tier: te.tier,
      displayTier: te.displayTier, value: value, pct: entry.affix.pct
    };
  }
  return null;
};
