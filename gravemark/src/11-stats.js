/* Gravemark — 11-stats.js
   The stat pipeline: fold the class kit, the hero's traits, the tree, the
   town, the perks, the season and the mutators into one derived block the
   combat solver can read.

   Everything funnels through `GM.collect()` -> `GM.derive()`. Nothing else in
   the codebase reads a stat off a trait directly, so there is exactly one
   place where "does this epitaph actually do anything" is answered. */
"use strict";

/* An empty stat bag. Additive stats sum; there are no multiplicative "more"
   modifiers on traits by design — those belong to keystones and mutators, where
   the player can see them all in one list. */
GM.emptyBag = function () {
  return {
    flatPhys: 0, flatFire: 0, flatCold: 0, flatLit: 0, flatVoid: 0,
    incDmg: 0, incPhys: 0, incFire: 0, incCold: 0, incLit: 0, incVoid: 0,
    incAS: 0, critChance: 0, critMulti: 0, pen: 0,
    flatLife: 0, incLife: 0, flatArmour: 0, incArmour: 0, flatEvasion: 0, incEvasion: 0,
    resFire: 0, resCold: 0, resLit: 0, resVoid: 0, resAll: 0,
    regenPct: 0, regenFlat: 0, leechPct: 0,
    findShards: 0, findGold: 0, findXP: 0,
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

/* ---------- the class kit -----------------------------------------------
   What a hero of this class wears and swings at this level. One curve, five
   multipliers per class, no items. Returns the weapon's own numbers and adds
   the kit's flats into the bag. */
GM.kitStats = function (hero, bag) {
  var cls = GM.heroClass(hero);
  var k = GM.kitScale(hero.level);
  var w = cls.weapon;
  var dmg = GM.CURVE.kitDmg0 * w.dmg * k;
  if (w.elemental) {
    /* Wands convert their base to the three elements, which is what lets an
       elemental build exist from level one. */
    var third = dmg / 3;
    bag.flatFire += third; bag.flatCold += third; bag.flatLit += third;
  } else {
    bag.flatPhys += dmg;
  }
  bag.flatArmour  += GM.CURVE.kitArm0  * cls.kit.armour  * k;
  bag.flatEvasion += GM.CURVE.kitEva0  * cls.kit.evasion * k;
  bag.flatLife    += GM.CURVE.kitLife0 * cls.kit.life    * k;
  return { as: w.as, crit: w.crit };
};

/* ---------- collection ---------------------------------------------------
   Stats are derived PER HERO. The kit and the traits belong to the hero; the
   passive tree, the parish and ascension perks are shared across the whole
   warband, because those are the player's institution rather than any one
   person's. `extraTrait` / `minusTrait` let the inscription preview ask
   "what if" without touching the hero. */
GM.collect = function (hero, ctx, extraTrait, minusTrait) {
  var bag = GM.emptyBag();
  var i;

  var wepInfo = { as: 1.0, crit: 0.05 };
  if (hero) {
    wepInfo = GM.kitStats(hero, bag);
    var traits = hero.traits || [];
    for (i = 0; i < traits.length; i++) {
      var t = traits[i];
      if (t === minusTrait) continue;
      if (bag[t.stat] !== undefined) bag[t.stat] += t.value;
    }
    if (extraTrait && bag[extraTrait.stat] !== undefined) bag[extraTrait.stat] += extraTrait.value;
    /* The class's own leaning, scaled by level so it stays relevant. */
    var cls = GM.heroClass(hero);
    GM.addBag(bag, cls.bias, 1 + (hero.level - 1) * 0.35);
  }

  var s = GM.state;
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

  return { bag: bag, weapon: wepInfo, ctx: ctx || {}, hero: hero };
};

/* ---------- derivation --------------------------------------------------- */
GM.derive = function (collected) {
  var bag = collected.bag;
  var wep = collected.weapon;
  var ctx = collected.ctx || {};
  var hero = collected.hero;
  var mut = ctx.mutators || [];
  var rule = GM.seasonRule();

  var cls = hero ? GM.heroClass(hero) : { mod: { life: 1, armour: 1, dmg: 1, as: 1 }, grow: { life: 1, dmg: 1 } };
  var rank = hero ? GM.heroRank(hero) : { mult: 1 };
  var level = hero ? hero.level : 1;

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

  /* Class and rank multiply the hero's whole contribution; growth compounds
     with level so a Reaver pulls further ahead on damage as they advance. */
  var clsDmg  = cls.mod.dmg    * Math.pow(cls.grow.dmg,  level - 1) * rank.mult;
  var clsLife = cls.mod.life   * Math.pow(cls.grow.life, level - 1) * rank.mult;
  var clsArm  = cls.mod.armour * rank.mult;
  var clsAS   = cls.mod.as;

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
    var v = Math.max(0, flat) * Math.max(0.05, inc) * mDmg * clsDmg;
    elemHit[e] = v;
    totalHit += v;
  }

  var crit = GM.clamp(wep.crit + bag.critChance, 0, 0.95);
  var critMulti = GM.CRIT_BASE_MULTI + bag.critMulti;
  var attackSpeed = Math.max(0.1, wep.as * (1 + bag.incAS) * mAS * clsAS);
  var critFactor = 1 + crit * (critMulti - 1);
  var dps = totalHit * critFactor * attackSpeed;

  /* --- defence --- */
  var baseLife = 60 + 14 * level;
  var life = Math.max(1, (baseLife + bag.flatLife) * Math.max(0.05, 1 + bag.incLife) * mLife * clsLife);
  var armour = Math.max(0, bag.flatArmour * Math.max(0, 1 + bag.incArmour) * mArm * clsArm);
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

  var findS = bag.findShards, findG = bag.findGold;
  var epi = bag.epitaphChance;
  for (i = 0; i < mut.length; i++) {
    var mm = GM.MUTATOR_BY_ID[mut[i]];
    if (!mm || !mm.find) continue;
    if (mm.find.gold)    findG += mm.find.gold;
    if (mm.find.shards)  findS += mm.find.shards;
    if (mm.find.epitaph) epi   += mm.find.epitaph;
  }
  if (rule.gold)     findG = (1 + findG) * rule.gold - 1;
  if (rule.shards)   findS = (1 + findS) * rule.shards - 1;
  if (rule.epitaph)  epi   = epi * rule.epitaph;

  return {
    dps: dps, hit: totalHit, elemHit: elemHit, critFactor: critFactor,
    crit: crit, critMulti: critMulti, attackSpeed: attackSpeed, pen: bag.pen,
    life: life, armour: armour, evasion: evasion, res: res,
    regen: regen, leech: leech,
    findShards: findS, findGold: findG, findXP: bag.findXP,
    epitaphChance: epi, graveHaste: bag.graveHaste,
    craftDiscount: GM.clamp(bag.craftDiscount, 0, 0.75),
    offlineHours: 2 + bag.offlineHours,
    startStage: Math.floor(bag.startStage),
    raw: bag
  };
};

/* ---------- caching ------------------------------------------------------
   Keyed by hero AND context, because three squads can be under different
   mutators at the same time. Cleared wholesale by anything that can move a
   number; per-hero invalidation would be a bug farm for a cache this cheap. */
var _statCache = Object.create(null);

function cacheKey(hero, ctx) {
  return (hero ? hero.id : "-") + "|" + (ctx && ctx.mutators ? ctx.mutators.join(",") : "");
}

GM.heroStats = function (hero, ctx) {
  var k = cacheKey(hero, ctx);
  var hit = _statCache[k];
  if (hit) return hit;
  var v = GM.derive(GM.collect(hero, ctx));
  _statCache[k] = v;
  return v;
};

GM.invalidateStats = function () { _statCache = Object.create(null); };

["tree:changed", "town:changed", "perks:changed",
 "level:changed", "season:started", "mode:changed", "roster:changed",
 "squads:changed"].forEach(function (evt) {
  GM.bus.on(evt, GM.invalidateStats);
});

/* Warband-wide numbers that do not belong to any hero: the away cap, the
   inscription discount. Derived with no hero so a roster change cannot move them. */
GM.playerStats = function () {
  return GM.heroStats(null, null);
};

/* Legacy shim. A handful of callers just want "some representative stats" —
   the first hero is the honest answer. */
GM.stats = function (ctx) {
  var h = (GM.state.heroes && GM.state.heroes[0]) || null;
  return GM.heroStats(h, ctx);
};

/* ---------- squads -------------------------------------------------------
   A squad fights as one body: damage sums, life sums, and the defensive
   numbers are averaged weighted by each hero's life, so the tank soaking the
   pack actually moves the squad's mitigation. */
GM.squadStats = function (sq, ctx) {
  var heroes = GM.squadHeroes(sq);
  var agg = {
    dps: 0, life: 0, armour: 0, evasion: 0, regen: 0, leech: 0,
    elemHit: { phys: 0, fire: 0, cold: 0, lit: 0, void: 0 },
    res: { phys: 0, fire: 0, cold: 0, lit: 0, void: 0 },
    pen: 0, critFactor: 1, attackSpeed: 1,
    findShards: 0, findGold: 0, findXP: 0,
    epitaphChance: 0, graveHaste: 0,
    count: heroes.length, members: []
  };
  if (!heroes.length) return agg;

  var lifeSum = 0, i, e;
  for (i = 0; i < heroes.length; i++) {
    var st = GM.heroStats(heroes[i], ctx);
    agg.members.push({ hero: heroes[i], st: st });
    agg.dps += st.dps;
    agg.life += st.life;
    agg.regen += st.regen;
    lifeSum += st.life;
    /* Each member's hit is folded in AT THEIR OWN speed and crit, so the
       squad's elemHit is damage per second by element — the solver multiplies
       by the aggregate's unit factors below and gets exactly st.dps back
       against an unresisting target. */
    var rate = st.critFactor * st.attackSpeed;
    for (e in agg.elemHit) agg.elemHit[e] += (st.elemHit[e] || 0) * rate;
  }
  for (i = 0; i < agg.members.length; i++) {
    var m = agg.members[i];
    var w = lifeSum > 0 ? m.st.life / lifeSum : 1 / agg.members.length;
    agg.armour  += m.st.armour * w;
    agg.evasion += m.st.evasion * w;
    agg.pen     += m.st.pen * w;
    agg.leech   += m.st.leech * w;
    agg.critFactor  += (m.st.critFactor - 1) * w;
    agg.attackSpeed += (m.st.attackSpeed - 1) * w;
    for (e in agg.res) agg.res[e] += (m.st.res[e] || 0) * w;
    /* Find stats take the BEST on the team, not the average — one Sexton
       who knows where the shards are should benefit the whole squad's haul. */
    agg.findShards   = Math.max(agg.findShards, m.st.findShards);
    agg.findGold     = Math.max(agg.findGold, m.st.findGold);
    agg.findXP       = Math.max(agg.findXP, m.st.findXP);
    agg.epitaphChance = Math.max(agg.epitaphChance, m.st.epitaphChance);
    agg.graveHaste    = Math.max(agg.graveHaste, m.st.graveHaste);
  }
  /* The squad's elemHit already carries each member's crit and speed, so the
     aggregate must not apply them a second time. */
  agg.critFactor = 1;
  agg.attackSpeed = 1;
  return agg;
};

/* ---------- what a trait would do ---------------------------------------- */
GM.heroStatsWith = function (hero, trait, replacing, ctx) {
  if (!hero) return GM.heroStats(null, ctx);
  return GM.derive(GM.collect(hero, ctx, trait, replacing || null));
};

/* A single number for "is this better". Offence and defence are both needed
   to progress, so neither alone can dominate. */
GM.powerScore = function (st) {
  var off = Math.max(1, st.dps);
  var ehp = Math.max(1, GM.effectiveLife(st));
  return Math.pow(off, 0.58) * Math.pow(ehp, 0.42);
};

GM.effectiveLife = function (st, stage) {
  var s = stage || 1;
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
