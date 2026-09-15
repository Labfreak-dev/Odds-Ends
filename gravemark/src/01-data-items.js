/* Gravemark — 01-data-items.js
   The item vocabulary: elements, stat keys, rarities, slots, bases, affixes.

   Bases and affix tiers are GENERATED from compact family/curve definitions
   rather than hand-listed. 112 bases and ~30 affixes x 8 tiers written out
   longhand would be 2000 lines nobody can rebalance; here a curve tweak is a
   one-number edit. Nothing below throws at load — a throw here would poison
   every const declared after it in the bundle. */
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
   Every number that can appear on gear, the tree, a building or a perk.
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
  findRarity:   { label: "increased Item Rarity",   pct: true },
  findQuantity: { label: "increased Item Quantity", pct: true },
  findGold:     { label: "increased Gold Found",    pct: true },
  findXP:       { label: "increased Experience",    pct: true },
  /* Gravemark-specific */
  epitaphChance: { label: "chance for an extra Epitaph", pct: true },
  graveHaste:    { label: "increased Gravemark Recovery", pct: true }
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

/* ---------- rarities -----------------------------------------------------
   Affix counts are inclusive ranges of [prefixes+suffixes] total. */
GM.RARITIES = [
  { id: 0, key: "common",    name: "Common",    css: "r0", minAff: 0, maxAff: 0, w: 1000, sockW: 0.20 },
  { id: 1, key: "magic",     name: "Magic",     css: "r1", minAff: 1, maxAff: 2, w:  420, sockW: 0.40 },
  { id: 2, key: "rare",      name: "Rare",      css: "r2", minAff: 3, maxAff: 4, w:  120, sockW: 0.65 },
  { id: 3, key: "epic",      name: "Epic",      css: "r3", minAff: 4, maxAff: 5, w:   28, sockW: 0.85 },
  { id: 4, key: "legendary", name: "Legendary", css: "r4", minAff: 5, maxAff: 6, w:    5, sockW: 1.00 },
  { id: 5, key: "mythic",    name: "Mythic",    css: "r5", minAff: 6, maxAff: 7, w:  0.6, sockW: 1.00 }
];
GM.RARITY_BY_ID = GM.indexById(GM.RARITIES);

/* ---------- slots -------------------------------------------------------- */
GM.SLOTS = [
  { id: "weapon",  name: "Weapon",     order: 0, sockets: 3 },
  { id: "offhand", name: "Off-hand",   order: 1, sockets: 3 },
  { id: "helm",    name: "Helm",       order: 2, sockets: 2 },
  { id: "body",    name: "Body",       order: 3, sockets: 4 },
  { id: "gloves",  name: "Gloves",     order: 4, sockets: 2 },
  { id: "boots",   name: "Boots",      order: 5, sockets: 2 },
  { id: "belt",    name: "Belt",       order: 6, sockets: 2 },
  { id: "amulet",  name: "Amulet",     order: 7, sockets: 2 },
  { id: "ring1",   name: "Ring",       order: 8, sockets: 2, base: "ring" },
  { id: "ring2",   name: "Ring",       order: 9, sockets: 2, base: "ring" }
];
GM.SLOT_IDS = GM.SLOTS.map(function (s) { return s.id; });
GM.SLOT_BY_ID = GM.indexById(GM.SLOTS);

/* The base pool a slot draws from — both rings share the "ring" pool. */
GM.slotPool = function (slotId) {
  var s = GM.SLOT_BY_ID[slotId];
  return s && s.base ? s.base : slotId;
};

GM.ARMOUR_SLOTS = ["helm", "body", "gloves", "boots", "offhand"];
GM.JEWEL_SLOTS  = ["belt", "amulet", "ring"];
GM.ALL_POOLS    = ["weapon", "offhand", "helm", "body", "gloves", "boots", "belt", "amulet", "ring"];

/* ---------- base items ---------------------------------------------------
   Eight tiers per family. Tier t gates at ilvl (t-1)*12, so a fresh character
   sees tier 1-2 bases and the endgame sees tier 8. */
GM.BASE_TIERS = 8;
GM.baseIlvlReq = function (tier) { return (tier - 1) * 12; };

var WEAPON_FAMILIES = [
  { id: "dagger", pool: "weapon", label: "Dagger", dmg: 0.62, as: 1.75, crit: 0.09, sockets: 2,
    names: ["Shiv", "Bone Shiv", "Gravebite", "Ribsplitter", "Whisperfang", "Nightglass Kris", "Sorrow's Tooth", "Epitaph"] },
  { id: "sword", pool: "weapon", label: "Sword", dmg: 1.00, as: 1.20, crit: 0.06, sockets: 3,
    names: ["Rusted Blade", "Sexton's Sabre", "Mourner's Edge", "Pale Falchion", "Cairnsteel", "Wake", "Lament", "Dirge"] },
  { id: "maul", pool: "weapon", label: "Maul", dmg: 1.70, as: 0.72, crit: 0.04, sockets: 3,
    names: ["Cudgel", "Gravedigger's Spade", "Headstone Maul", "Barrow Hammer", "Tombreaver", "Deadweight", "Monument", "Obelisk"] },
  { id: "wand", pool: "weapon", label: "Wand", dmg: 0.70, as: 1.40, crit: 0.07, sockets: 2, elemental: true,
    names: ["Reed Wand", "Ashen Rod", "Reliquary Wand", "Censer", "Ossuary Sceptre", "Vigil", "Hollow Crook", "Requiem"] },
  { id: "scythe", pool: "weapon", label: "Scythe", dmg: 1.32, as: 0.95, crit: 0.05, sockets: 3,
    names: ["Sickle", "Reaper's Hook", "Harvest Scythe", "Mortis", "Gleaner", "Pale Crescent", "Last Harvest", "Threnody"] }
];

var ARMOUR_FAMILIES = [
  { id: "shield", pool: "offhand", label: "Shield", arm: 1.30, eva: 0.25, life: 0.9, sockets: 3,
    names: ["Plank", "Coffin Lid", "Bone Aegis", "Headstone", "Barrow Ward", "Ossuary Bulwark", "Monument Guard", "Vigil's Wall"] },
  { id: "tome", pool: "offhand", label: "Tome", arm: 0.20, eva: 0.20, life: 0.4, sockets: 2, elemental: true,
    names: ["Ledger", "Parish Register", "Book of Wakes", "Mourner's Missal", "Obituary", "Necrologue", "Book of Vigils", "The Long Roll"] },
  { id: "helm", pool: "helm", label: "Helm", arm: 0.85, eva: 0.55, life: 0.7, sockets: 2,
    names: ["Hood", "Mourner's Veil", "Bone Mask", "Sexton's Helm", "Death Mask", "Reliquary Crown", "Pallbearer's Casque", "Crown of Vigils"] },
  { id: "body", pool: "body", label: "Body", arm: 1.60, eva: 1.00, life: 1.4, sockets: 4,
    names: ["Shroud", "Grave Wrappings", "Boneplate", "Mourner's Coat", "Ossuary Mail", "Cairn Harness", "Tomb Regalia", "Monument Plate"] },
  { id: "gloves", pool: "gloves", label: "Gloves", arm: 0.55, eva: 0.50, life: 0.5, sockets: 2,
    names: ["Rags", "Digger's Mitts", "Bone Gauntlets", "Embalmer's Gloves", "Grasping Hands", "Reliquary Gauntlets", "Pallbearer's Grip", "Hands of Vigil"] },
  { id: "boots", pool: "boots", label: "Boots", arm: 0.55, eva: 0.70, life: 0.5, sockets: 2,
    names: ["Wraps", "Gravewalkers", "Bone Greaves", "Sexton's Boots", "Mourner's Tread", "Cairnstriders", "Pallbearer's Sabatons", "Last Mile"] }
];

var JEWEL_FAMILIES = [
  { id: "belt", pool: "belt", label: "Belt", sockets: 2,
    implicit: "flatLife", impV: 14, impMult: 1.55,
    names: ["Cord", "Rope Belt", "Bone Girdle", "Embalmer's Sash", "Grave Cinch", "Reliquary Belt", "Pallbearer's Strap", "Cerement"] },
  { id: "amulet", pool: "amulet", label: "Amulet", sockets: 2,
    implicit: "incDmg", impV: 0.05, impMult: 1.30, pctImplicit: true,
    names: ["Charm", "Bone Pendant", "Mourning Locket", "Reliquary", "Soulglass", "Ossuary Talisman", "Memento Mori", "Vigil Stone"] },
  { id: "ring", pool: "ring", label: "Ring", sockets: 2,
    implicit: "resAll", impV: 0.03, impMult: 1.26, pctImplicit: true,
    names: ["Band", "Bone Ring", "Signet of Dust", "Mourner's Ring", "Gravegold", "Reliquary Band", "Ossuary Loop", "Circle of Vigils"] }
];

/* Build the flat base list. */
GM.BASES = (function () {
  var out = [];

  function push(b) { out.push(b); }

  WEAPON_FAMILIES.forEach(function (f) {
    for (var t = 1; t <= GM.BASE_TIERS; t++) {
      var scale = Math.pow(1.62, t - 1);
      var dmg = Math.max(1, Math.round(5 * f.dmg * scale));
      var b = {
        id: f.id + "_t" + t, family: f.id, pool: "weapon", tier: t,
        name: f.names[t - 1], kindLabel: f.label,
        ilvlReq: GM.baseIlvlReq(t), sockets: f.sockets,
        dmg: dmg, as: f.as, crit: f.crit,
        /* Wands and tomes convert their base damage to an element instead of
           physical, which is what makes an elemental build viable at all. */
        dmgElem: f.elemental ? null : "phys", elemental: !!f.elemental
      };
      push(b);
    }
  });

  ARMOUR_FAMILIES.forEach(function (f) {
    for (var t = 1; t <= GM.BASE_TIERS; t++) {
      var scale = Math.pow(1.60, t - 1);
      push({
        id: f.id + "_t" + t, family: f.id, pool: f.pool, tier: t,
        name: f.names[t - 1], kindLabel: f.label,
        ilvlReq: GM.baseIlvlReq(t), sockets: f.sockets,
        armour: Math.round(14 * f.arm * scale),
        evasion: Math.round(14 * f.eva * scale),
        life: Math.round(8 * f.life * scale),
        elemental: !!f.elemental
      });
    }
  });

  JEWEL_FAMILIES.forEach(function (f) {
    for (var t = 1; t <= GM.BASE_TIERS; t++) {
      var v = f.impV * Math.pow(f.impMult, t - 1);
      push({
        id: f.id + "_t" + t, family: f.id, pool: f.pool, tier: t,
        name: f.names[t - 1], kindLabel: f.label,
        ilvlReq: GM.baseIlvlReq(t), sockets: f.sockets,
        implicit: { stat: f.implicit, value: f.pctImplicit ? Math.round(v * 1000) / 1000 : Math.round(v) }
      });
    }
  });

  return out;
})();

GM.BASE_BY_ID = GM.indexById(GM.BASES);

/* Bases a given pool can roll at an item level, weighted so the newest legal
   tier is common and ancient tiers fade out rather than vanishing. */
GM.basesFor = function (pool, ilvl) {
  var out = [];
  for (var i = 0; i < GM.BASES.length; i++) {
    var b = GM.BASES[i];
    if (b.pool !== pool) continue;
    if (b.ilvlReq > ilvl) continue;
    var behind = Math.floor((ilvl - b.ilvlReq) / 12);
    out.push({ base: b, w: 1 / (1 + behind * behind * 0.55) });
  }
  /* Below the first gate nothing qualifies; hand back tier 1 so loot never
     comes back empty. */
  if (!out.length) {
    for (var j = 0; j < GM.BASES.length; j++) {
      if (GM.BASES[j].pool === pool && GM.BASES[j].tier === 1) out.push({ base: GM.BASES[j], w: 1 });
    }
  }
  return out;
};

/* ---------- affixes ------------------------------------------------------
   Each entry is a curve, not a table. `v1` is the tier-1 midpoint, `mult` the
   per-tier growth, `tiers` how many exist. Rolled values land in
   [0.76, 1.00] x the tier midpoint, so two copies of the same tier still
   differ — that variance is what makes a "good roll" mean something. */
var AFF = [
  /* --- prefixes: damage ------------------------------------------------- */
  { id: "p_phys",  kind: "prefix", group: "flatPhys", name: "Heavy",    stat: "flatPhys", pools: ["weapon", "ring", "amulet", "gloves"], v1: 2.2,  mult: 1.72, tiers: 8 },
  { id: "p_fire",  kind: "prefix", group: "flatFire", name: "Smoulderi", nameFull: "Smouldering", stat: "flatFire", pools: ["weapon", "ring", "amulet", "gloves"], v1: 2.0, mult: 1.74, tiers: 8 },
  { id: "p_cold",  kind: "prefix", group: "flatCold", name: "Gravecold", stat: "flatCold", pools: ["weapon", "ring", "amulet", "gloves"], v1: 2.0,  mult: 1.74, tiers: 8 },
  { id: "p_lit",   kind: "prefix", group: "flatLit",  name: "Stormbit",  stat: "flatLit",  pools: ["weapon", "ring", "amulet", "gloves"], v1: 1.8,  mult: 1.78, tiers: 8 },
  { id: "p_void",  kind: "prefix", group: "flatVoid", name: "Hollow",    stat: "flatVoid", pools: ["weapon", "ring", "amulet"], v1: 2.6, mult: 1.80, tiers: 7, minIlvl: 24 },
  { id: "p_inc",   kind: "prefix", group: "incDmg",   name: "Vicious",   stat: "incDmg",   pools: ["weapon", "amulet", "offhand"], v1: 0.08, mult: 1.30, tiers: 8, pct: true },
  { id: "p_incph", kind: "prefix", group: "incElem",  name: "Brutal",    stat: "incPhys",  pools: ["weapon", "gloves"], v1: 0.12, mult: 1.32, tiers: 7, pct: true },
  { id: "p_incfi", kind: "prefix", group: "incElem",  name: "Pyre",      stat: "incFire",  pools: ["weapon", "offhand", "amulet"], v1: 0.12, mult: 1.32, tiers: 7, pct: true },
  { id: "p_incco", kind: "prefix", group: "incElem",  name: "Frostbound",stat: "incCold",  pools: ["weapon", "offhand", "amulet"], v1: 0.12, mult: 1.32, tiers: 7, pct: true },
  { id: "p_inclt", kind: "prefix", group: "incElem",  name: "Thundering",stat: "incLit",   pools: ["weapon", "offhand", "amulet"], v1: 0.12, mult: 1.32, tiers: 7, pct: true },
  { id: "p_incvo", kind: "prefix", group: "incElem",  name: "Unmaking",  stat: "incVoid",  pools: ["weapon", "offhand", "amulet"], v1: 0.14, mult: 1.34, tiers: 6, pct: true, minIlvl: 36 },
  /* --- prefixes: defence ------------------------------------------------ */
  { id: "p_life",  kind: "prefix", group: "flatLife", name: "Stout",     stat: "flatLife", pools: ["helm", "body", "gloves", "boots", "belt", "amulet", "ring"], v1: 12, mult: 1.58, tiers: 8 },
  { id: "p_inclf", kind: "prefix", group: "incLife",  name: "Enduring",  stat: "incLife",  pools: ["body", "belt", "amulet"], v1: 0.06, mult: 1.28, tiers: 7, pct: true },
  { id: "p_arm",   kind: "prefix", group: "flatArm",  name: "Plated",    stat: "flatArmour",  pools: ["helm", "body", "gloves", "boots", "offhand", "belt"], v1: 16, mult: 1.60, tiers: 8 },
  { id: "p_eva",   kind: "prefix", group: "flatEva",  name: "Shrouded",  stat: "flatEvasion", pools: ["helm", "body", "gloves", "boots", "offhand"], v1: 16, mult: 1.60, tiers: 8 },
  { id: "p_incarm",kind: "prefix", group: "incDef",   name: "Fortified", stat: "incArmour",   pools: ["body", "offhand", "helm"], v1: 0.10, mult: 1.30, tiers: 7, pct: true },
  { id: "p_inceva",kind: "prefix", group: "incDef",   name: "Fleeting",  stat: "incEvasion",  pools: ["body", "boots", "helm"], v1: 0.10, mult: 1.30, tiers: 7, pct: true },

  /* --- suffixes: offence ------------------------------------------------ */
  { id: "s_as",    kind: "suffix", group: "incAS",   name: "of Haste",     stat: "incAS",      pools: ["weapon", "gloves", "ring", "boots"], v1: 0.05, mult: 1.24, tiers: 8, pct: true },
  { id: "s_crit",  kind: "suffix", group: "crit",    name: "of Cruelty",   stat: "critChance", pools: ["weapon", "gloves", "amulet", "ring"], v1: 0.015, mult: 1.26, tiers: 7, pct: true },
  { id: "s_cmul",  kind: "suffix", group: "critM",   name: "of Ruin",      stat: "critMulti",  pools: ["weapon", "amulet", "offhand"], v1: 0.08, mult: 1.24, tiers: 7, pct: true },
  { id: "s_pen",   kind: "suffix", group: "pen",     name: "of Sundering", stat: "pen",        pools: ["weapon", "amulet"], v1: 0.03, mult: 1.24, tiers: 6, pct: true, minIlvl: 36 },
  /* --- suffixes: defence ------------------------------------------------ */
  { id: "s_rfire", kind: "suffix", group: "resFire", name: "of the Ember",  stat: "resFire", pools: ["helm", "body", "gloves", "boots", "offhand", "belt", "amulet", "ring"], v1: 0.05, mult: 1.22, tiers: 7, pct: true },
  { id: "s_rcold", kind: "suffix", group: "resCold", name: "of the Cairn",  stat: "resCold", pools: ["helm", "body", "gloves", "boots", "offhand", "belt", "amulet", "ring"], v1: 0.05, mult: 1.22, tiers: 7, pct: true },
  { id: "s_rlit",  kind: "suffix", group: "resLit",  name: "of the Gale",   stat: "resLit",  pools: ["helm", "body", "gloves", "boots", "offhand", "belt", "amulet", "ring"], v1: 0.05, mult: 1.22, tiers: 7, pct: true },
  { id: "s_rvoid", kind: "suffix", group: "resVoid", name: "of the Hollow", stat: "resVoid", pools: ["helm", "body", "offhand", "amulet", "ring"], v1: 0.04, mult: 1.24, tiers: 6, pct: true, minIlvl: 24 },
  { id: "s_rall",  kind: "suffix", group: "resAll",  name: "of Warding",    stat: "resAll",  pools: ["amulet", "ring", "belt"], v1: 0.025, mult: 1.22, tiers: 6, pct: true, minIlvl: 24 },
  { id: "s_regen", kind: "suffix", group: "regen",   name: "of Mending",    stat: "regenFlat", pools: ["helm", "body", "belt", "amulet", "ring"], v1: 3, mult: 1.52, tiers: 8 },
  { id: "s_leech", kind: "suffix", group: "leech",   name: "of the Ghoul",  stat: "leechPct",  pools: ["weapon", "gloves", "amulet", "ring"], v1: 0.004, mult: 1.26, tiers: 6, pct: true, minIlvl: 24 },
  /* --- suffixes: utility ------------------------------------------------ */
  { id: "s_rar",   kind: "suffix", group: "find",    name: "of Plenty",     stat: "findRarity",   pools: ["helm", "gloves", "boots", "ring", "amulet"], v1: 0.06, mult: 1.24, tiers: 7, pct: true },
  { id: "s_qua",   kind: "suffix", group: "findQ",   name: "of Spoils",     stat: "findQuantity", pools: ["helm", "gloves", "boots", "belt"], v1: 0.05, mult: 1.22, tiers: 6, pct: true },
  { id: "s_gold",  kind: "suffix", group: "findG",   name: "of Avarice",    stat: "findGold",     pools: ["belt", "ring", "gloves"], v1: 0.10, mult: 1.26, tiers: 6, pct: true },
  { id: "s_xp",    kind: "suffix", group: "findX",   name: "of Study",      stat: "findXP",       pools: ["helm", "amulet"], v1: 0.05, mult: 1.22, tiers: 6, pct: true },
  /* --- suffixes: Gravemark ---------------------------------------------- */
  { id: "s_epi",   kind: "suffix", group: "epitaph", name: "of Remembrance", stat: "epitaphChance", pools: ["amulet", "ring", "helm"], v1: 0.03, mult: 1.26, tiers: 5, pct: true, minIlvl: 48 },
  { id: "s_ghaste",kind: "suffix", group: "grave",   name: "of the Vigil",   stat: "graveHaste",    pools: ["boots", "belt", "amulet"], v1: 0.08, mult: 1.24, tiers: 5, pct: true, minIlvl: 48 }
];

/* Expand each curve into concrete tiers. Tier n is the strongest and gates
   highest, matching the ARPG convention where T1 is best — so we store
   ascending internally and expose `displayTier` counting down. */
GM.AFFIXES = AFF.map(function (a) {
  var tiers = [];
  for (var i = 1; i <= a.tiers; i++) {
    var mid = a.v1 * Math.pow(a.mult, i - 1);
    var ilvl = (a.minIlvl || 0) + (i - 1) * 11;
    tiers.push({
      tier: i,
      displayTier: a.tiers - i + 1,
      ilvl: ilvl,
      min: a.pct ? Math.round(mid * 0.76 * 10000) / 10000 : Math.max(1, Math.round(mid * 0.76)),
      max: a.pct ? Math.round(mid * 1.00 * 10000) / 10000 : Math.max(1, Math.round(mid))
    });
  }
  return {
    id: a.id, kind: a.kind, group: a.group, name: a.nameFull || a.name,
    stat: a.stat, pools: a.pools, pct: !!a.pct, tierCount: a.tiers, tiers: tiers
  };
});

GM.AFFIX_BY_ID = GM.indexById(GM.AFFIXES);
GM.PREFIXES = GM.AFFIXES.filter(function (a) { return a.kind === "prefix"; });
GM.SUFFIXES = GM.AFFIXES.filter(function (a) { return a.kind === "suffix"; });

/* Affixes legal on a pool at an item level, each paired with the highest tier
   that ilvl unlocks. Higher tiers are rarer: weight falls off with tier so a
   fresh T1 roll stays a genuine event. */
GM.affixesFor = function (pool, ilvl, kind) {
  var out = [];
  for (var i = 0; i < GM.AFFIXES.length; i++) {
    var a = GM.AFFIXES[i];
    if (kind && a.kind !== kind) continue;
    if (a.pools.indexOf(pool) < 0) continue;
    var legal = [];
    for (var t = 0; t < a.tiers.length; t++) {
      if (a.tiers[t].ilvl <= ilvl) legal.push(a.tiers[t]);
    }
    if (!legal.length) continue;
    out.push({ affix: a, tiers: legal, w: 100 });
  }
  return out;
};

/* Weight for choosing among the legal tiers of one affix. */
GM.tierWeight = function (tierEntry, ilvl) {
  var behind = Math.max(0, Math.floor((ilvl - tierEntry.ilvl) / 11));
  return 1 / (1 + behind * 0.85);
};

/* ---------- rare naming --------------------------------------------------
   Rares get a generated two-word title instead of prefix+base+suffix. */
GM.RARE_HEADS = [
  "Grave", "Bone", "Ash", "Mourn", "Pall", "Dusk", "Sorrow", "Cairn", "Tomb",
  "Vigil", "Hollow", "Wake", "Dirge", "Shroud", "Barrow", "Requiem", "Ember", "Rot"
];
GM.RARE_TAILS = [
  "song", "bite", "weave", "shard", "bane", "keeper", "wind", "coil", "mark",
  "thorn", "veil", "brand", "husk", "cry", "chain", "wake", "root", "ward"
];
GM.RARE_EPITHETS = [
  "of the Long Wake", "of Nine Graves", "of the Sexton", "of Quiet Earth",
  "of the Last Mile", "of the Unlit Lamp", "of Hollow Years", "of the Pale Hour",
  "of the Turned Stone", "of Buried Names", "of the Cold Vigil", "of Seven Bells"
];
