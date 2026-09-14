/* Gravemark — 11-stats.js
   The stat pipeline: fold gear, runes, runewords, tree, town, perks, season
   and mutators into one derived block the combat solver can read.

   Everything funnels through `GM.collect()` -> `GM.derive()`. Nothing else in
   the codebase is allowed to read a stat off an item directly, so there is
   exactly one place where "does this affix actually do anything" is answered. */
"use strict";

/* An empty stat bag. Additive stats sum; there are no multiplicative "more"
   modifiers on gear by design — those belong to keystones and mutators, where
   the player can see them all in one list. */
GM.emptyBag = function () {
  return {
    flatPhys: 0, flatFire: 0, flatCold: 0, flatLit: 0, flatVoid: 0,
    incDmg: 0, incPhys: 0, incFire: 0, incCold: 0, incLit: 0, incVoid: 0,
    incAS: 0, critChance: 0, critMulti: 0, pen: 0,
    flatLife: 0, incLife: 0, flatArmour: 0, incArmour: 0, flatEvasion: 0, incEvasion: 0,
    resFire: 0, resCold: 0, resLit: 0, resVoid: 0, resAll: 0,
    regenPct: 0, regenFlat: 0, leechPct: 0,
    findRarity: 0, findQuantity: 0, findGold: 0, findXP: 0,
    epitaphChance: 0, graveHaste: 0,
    craftDiscount: 0, offlineHours: 0, startStage: 0
  };
};

GM.addBag = function (bag, src, scale) {
  if (!src) return bag;
  var k = scale == null ? 1 : scale;
  for (var key in src) {
    if (bag[key] === undefined) continue;   /* ignore unknown keys rather than growing the bag */
    bag[key] += src[key] * k;
  }
  return bag;
};

/* ---------- per-item stats ----------------------------------------------
   Returns the full contribution of one item: base implicit, rolled affixes,
   socketed runes (using the face that matches the slot), and any runeword. */
GM.itemStats = function (item) {
  var bag = GM.emptyBag();
  if (!item) return bag;
  var base = GM.BASE_BY_ID[item.baseId];
  if (!base) return bag;

  /* Base tiers are discrete; the item level it dropped at scales them the rest
     of the way. Percentage implicits are left alone (see GM.ilvlScale). */
  var k = GM.ilvlScale(item.ilvl || 1);

  if (base.implicit) {
    var impDef = GM.STAT_DEFS[base.implicit.stat];
    bag[base.implicit.stat] += base.implicit.value * (impDef && impDef.pct ? 1 : k);
  }
  if (base.armour)  bag.flatArmour  += base.armour  * k;
  if (base.evasion) bag.flatEvasion += base.evasion * k;
  if (base.life)    bag.flatLife    += base.life    * k;

  var i;
  for (i = 0; i < (item.affixes || []).length; i++) {
    var a = item.affixes[i];
    if (bag[a.stat] !== undefined) bag[a.stat] += a.value;
  }

  var pool = base.pool;
  for (i = 0; i < (item.sockets || []).length; i++) {
    var face = GM.runeFace(GM.RUNE_BY_ID[item.sockets[i]], pool);
    if (face) GM.addBag(bag, face);
  }

  var rw = GM.matchRuneword(pool, item.sockets || []);
  if (rw) GM.addBag(bag, rw.stats);

  return bag;
};

/* The weapon's own base damage, routed to its element(s). Elemental weapons
   split their base evenly across fire/cold/storm, which is what lets a wand
   build exist before it finds a single flat-elemental affix. */
GM.weaponBaseDamage = function (item, bag) {
  var base = item && GM.BASE_BY_ID[item.baseId];
  if (!base || base.pool !== "weapon") {
    bag.flatPhys += 2;              /* unarmed */
    return { as: 1.0, crit: 0.05 };
  }
  var dmg = base.dmg * GM.ilvlScale(item.ilvl || 1);
  if (base.elemental) {
    var third = dmg / 3;
    bag.flatFire += third; bag.flatCold += third; bag.flatLit += third;
  } else {
    bag.flatPhys += dmg;
  }
  return { as: base.as, crit: base.crit };
};

/* ---------- collection ---------------------------------------------------
   `ctx` may carry mutators (Alternate Dimension) and a season rule. */
GM.collect = function (ctx) {
  var s = GM.state;
  var bag = GM.emptyBag();
  var wep = s.equip.weapon;

  /* Weapon base first so its damage is in the bag before increases apply. */
  var wepInfo = GM.weaponBaseDamage(wep, bag);

  for (var i = 0; i < GM.SLOT_IDS.length; i++) {
    GM.addBag(bag, GM.itemStats(s.equip[GM.SLOT_IDS[i]]));
  }

  for (i = 0; i < s.tree.spent.length; i++) {
    var node = GM.TREE_BY_ID[s.tree.spent[i]];
    if (node) GM.addBag(bag, node.stats);
  }

  for (i = 0; i < GM.BUILDINGS.length; i++) {
    var b = GM.BUILDINGS[i];
    var lv = GM.townLevel(b.id);
    if (lv) GM.addBag(bag, b.per, lv);
  }

  for (i = 0; i < GM.PERKS.length; i++) {
    var p = GM.PERKS[i];
    var pl = GM.perkLevel(p.id);
    if (pl) GM.addBag(bag, p.per, pl);
  }

  /* resAll is a convenience roll; fold it into the four real resistances so
     downstream code only ever reads resFire/resCold/resLit/resVoid. */
  if (bag.resAll) {
    bag.resFire += bag.resAll; bag.resCold += bag.resAll;
    bag.resLit  += bag.resAll; bag.resVoid += bag.resAll;
    bag.resAll = 0;
  }

  return { bag: bag, weapon: wepInfo, ctx: ctx || {} };
};

/* ---------- derivation ---------------------------------------------------
   Turns the raw bag into the numbers the solver and the UI actually use. */
GM.derive = function (collected) {
  var s = GM.state;
  var bag = collected.bag;
  var wep = collected.weapon;
  var ctx = collected.ctx || {};
  var mut = ctx.mutators || [];
  var rule = GM.seasonRule();

  /* Mutator and season multipliers on the player side. */
  var mDmg = 1, mLife = 1, mAS = 1, mEva = 1, mArm = 1;
  var noRegen = false, noLeech = false;
  for (var i = 0; i < mut.length; i++) {
    var m = GM.MUTATOR_BY_ID[mut[i]];
    if (!m || !m.you) continue;
    if (m.you.dmg)  mDmg  *= m.you.dmg;
    if (m.you.life) mLife *= m.you.life;
    if (m.you.as)   mAS   *= m.you.as;
    if (m.you.eva)  mEva  *= m.you.eva;
    if (m.you.arm)  mArm  *= m.you.arm;
    if (m.you.noRegen) noRegen = true;
    if (m.you.noLeech) noLeech = true;
  }
  if (rule.playerDmg) mDmg *= rule.playerDmg;

  /* --- offence --- */
  var elemHit = {};
  var totalHit = 0;
  var incByElem = {
    phys: bag.incPhys, fire: bag.incFire, cold: bag.incCold,
    lit: bag.incLit, void: bag.incVoid
  };
  for (i = 0; i < GM.ELEMENTS.length; i++) {
    var e = GM.ELEMENTS[i];
    var flat = bag["flat" + e.charAt(0).toUpperCase() + e.slice(1)];
    var inc = 1 + bag.incDmg + (incByElem[e] || 0);
    var v = Math.max(0, flat) * Math.max(0.05, inc) * mDmg;
    elemHit[e] = v;
    totalHit += v;
  }

  var crit = GM.clamp(wep.crit + bag.critChance, 0, 0.95);
  var critMulti = GM.CRIT_BASE_MULTI + bag.critMulti;
  var attackSpeed = Math.max(0.1, wep.as * (1 + bag.incAS) * mAS);
  var critFactor = 1 + crit * (critMulti - 1);
  var dps = totalHit * critFactor * attackSpeed;

  /* --- defence --- */
  var baseLife = 60 + 14 * s.char.level;
  var life = Math.max(1, (baseLife + bag.flatLife) * Math.max(0.05, 1 + bag.incLife) * mLife);
  var armour = Math.max(0, bag.flatArmour * Math.max(0, 1 + bag.incArmour) * mArm);
  var evasion = Math.max(0, bag.flatEvasion * Math.max(0, 1 + bag.incEvasion) * mEva);

  var res = {
    phys: 0,
    fire: GM.clamp(bag.resFire, -1, GM.RES_CAP),
    cold: GM.clamp(bag.resCold, -1, GM.RES_CAP),
    lit:  GM.clamp(bag.resLit,  -1, GM.RES_CAP),
    void: GM.clamp(bag.resVoid, -1, GM.RES_CAP)
  };

  var regen = noRegen ? 0 : (bag.regenFlat + life * bag.regenPct);
  var leech = noLeech ? 0 : bag.leechPct;

  /* --- find / utility --- */
  var findQ = bag.findQuantity, findR = bag.findRarity, findG = bag.findGold;
  var epi = bag.epitaphChance;
  for (i = 0; i < mut.length; i++) {
    var mm = GM.MUTATOR_BY_ID[mut[i]];
    if (!mm || !mm.find) continue;
    if (mm.find.gold)    findG += mm.find.gold;
    if (mm.find.qty)     findQ += mm.find.qty;
    if (mm.find.rarity)  findR += mm.find.rarity;
    if (mm.find.epitaph) epi   += mm.find.epitaph;
  }
  if (rule.gold)      findG = (1 + findG) * rule.gold - 1;
  if (rule.quantity)  findQ = (1 + findQ) * rule.quantity - 1;
  if (rule.epitaph)   epi   = epi * rule.epitaph;

  return {
    /* offence */
    dps: dps, hit: totalHit, elemHit: elemHit, critFactor: critFactor,
    crit: crit, critMulti: critMulti, attackSpeed: attackSpeed, pen: bag.pen,
    /* defence */
    life: life, armour: armour, evasion: evasion, res: res,
    regen: regen, leech: leech,
    /* utility */
    findRarity: findR, findQuantity: findQ, findGold: findG, findXP: bag.findXP,
    epitaphChance: epi, graveHaste: bag.graveHaste,
    craftDiscount: GM.clamp(bag.craftDiscount, 0, 0.75),
    offlineHours: 2 + bag.offlineHours,
    startStage: Math.floor(bag.startStage),
    raw: bag
  };
};

/* Cached because the fight loop asks for this every tick and the UI asks on
   every repaint. Invalidated by anything that can change a stat. */
var _statCache = null;
var _statCacheKey = null;

GM.stats = function (ctx) {
  var key = ctx && ctx.mutators ? ctx.mutators.join(",") : "";
  if (_statCache && _statCacheKey === key) return _statCache;
  _statCache = GM.derive(GM.collect(ctx));
  _statCacheKey = key;
  return _statCache;
};

GM.invalidateStats = function () { _statCache = null; _statCacheKey = null; };

/* Anything that mutates gear, tree, town, perks or level must announce it. */
["gear:changed", "tree:changed", "town:changed", "perks:changed",
 "level:changed", "season:started", "mode:changed"].forEach(function (evt) {
  GM.bus.on(evt, GM.invalidateStats);
});

/* ---------- what an item would do ---------------------------------------
   Used by auto-equip and the compare tooltip: derive stats with `item` in
   `slot` instead of whatever is there, without disturbing real state. */
GM.statsWith = function (slot, item, ctx) {
  var prev = GM.state.equip[slot];
  GM.state.equip[slot] = item;
  var out;
  try {
    out = GM.derive(GM.collect(ctx));
  } finally {
    /* Restore even if derivation throws — a half-swapped equip block would
       corrupt the save on the next autosave. */
    GM.state.equip[slot] = prev;
  }
  return out;
};

/* A single number for "is this better". Offence and defence are both needed
   to progress, so neither alone can dominate: geometric weighting means a
   item that doubles dps but halves life scores flat, which is honest. */
GM.powerScore = function (st) {
  var off = Math.max(1, st.dps);
  var ehp = Math.max(1, GM.effectiveLife(st));
  return Math.pow(off, 0.58) * Math.pow(ehp, 0.42);
};

/* Life scaled by the mitigation that applies to a generic hit. Armour and
   evasion are stage-relative, so this is only meaningful for comparison. */
GM.effectiveLife = function (st, stage) {
  var s = stage || GM.state.depth.current || 1;
  var incoming = GM.monDmg(s);
  var physRed = st.armour / (st.armour + 10 * incoming + 1);
  var dodge = GM.dodgeChance(st.evasion, GM.monAcc(s));
  var avgRes = (st.res.fire + st.res.cold + st.res.lit + st.res.void) / 4;
  var mitig = (1 - physRed * 0.5 - avgRes * 0.5);
  return st.life / Math.max(0.05, mitig) / Math.max(0.05, 1 - dodge);
};

GM.dodgeChance = function (evasion, accuracy) {
  if (evasion <= 0) return 0;
  return GM.clamp(evasion / (evasion + accuracy * 7), 0, 0.75);
};
