/* Gravemark — 12-loot.js
   Item generation, naming, scoring, salvage.

   An item is stored as {baseId, ilvl, rarity, affixes[], sockets[]}. Affixes
   are stored rolled rather than re-derived from a seed, because inscription
   (the Epitaph system) edits them after the fact — a seed could not survive
   that. Sockets hold rune ids or null. */
"use strict";

GM.STASH_MAX = 200;

/* ---------- rarity ------------------------------------------------------
   `rarityBonus` (from findRarity) shifts weight up the table rather than
   multiplying a flat chance, so rarity gear makes good items likelier without
   ever making common items impossible. */
GM.rollRarity = function (rarityBonus, floorId) {
  var bonus = Math.max(0, rarityBonus || 0);
  var pool = [];
  for (var i = 0; i < GM.RARITIES.length; i++) {
    var r = GM.RARITIES[i];
    if (floorId != null && r.id < floorId) continue;
    /* Each step up the table gets the full bonus applied once more. */
    pool.push({ r: r, w: r.w * Math.pow(1 + bonus, r.id) });
  }
  if (!pool.length) return GM.RARITIES[0];
  return GM.pickW(pool, function (x) { return x.w; }).r;
};

/* ---------- affix rolling ------------------------------------------------ */
/* Flat rolls scale continuously with the item level they were found at, so a
   tier-8 life roll from depth 120 genuinely beats the same tier from depth 84.
   This is also what makes dying deep worth something: the Epitaph remembers
   the scaled value, not the tier. */
function rollAffixValue(affix, tierEntry, ilvl) {
  var v = GM.randF(tierEntry.min, tierEntry.max);
  if (affix.pct) return Math.round(v * 10000) / 10000;
  return Math.max(1, Math.round(v * GM.ilvlScale(ilvl || 1)));
}

/* Pick `count` affixes of one kind, respecting group exclusivity — an item
   must not roll two different tiers of the same modifier. */
function rollAffixes(pool, ilvl, kind, count, usedGroups) {
  var out = [];
  var candidates = GM.affixesFor(pool, ilvl, kind);
  var guard = 0;
  while (out.length < count && candidates.length && guard++ < 200) {
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
    if (usedGroups[entry.affix.group]) continue;
    usedGroups[entry.affix.group] = true;

    var tierEntry = GM.pickW(entry.tiers, function (t) { return GM.tierWeight(t, ilvl); });
    out.push({
      id: entry.affix.id,
      stat: entry.affix.stat,
      tier: tierEntry.tier,
      displayTier: tierEntry.displayTier,
      value: rollAffixValue(entry.affix, tierEntry, ilvl),
      pct: entry.affix.pct
    });
  }
  return out;
}

/* The affix roller is needed by the crafting bench (augment, rarity upgrade),
   so it is exposed rather than duplicated there. */
GM.rollAffixesPublic = rollAffixes;

/* ---------- sockets ------------------------------------------------------ */
function rollSockets(base, rarity) {
  var max = Math.min(base.sockets || 0, GM.SLOT_BY_ID[base.pool] ? 6 : 6);
  if (max <= 0) return [];
  if (!GM.chance(rarity.sockW)) return [];
  /* Bias toward fewer sockets; a full-socket base is the runeword lottery. */
  var n = 1;
  for (var i = 1; i < max; i++) if (GM.chance(0.42)) n++;
  var out = [];
  for (i = 0; i < n; i++) out.push(null);
  return out;
}

/* ---------- naming ------------------------------------------------------- */
GM.itemName = function (item) {
  var base = GM.BASE_BY_ID[item.baseId];
  if (!base) return "Unknown";
  if (item.customName) return item.customName;

  var rw = GM.matchRuneword(base.pool, item.sockets || []);
  if (rw) return rw.name;

  if (item.rarity <= 0) return base.name;

  if (item.rarity === 1) {
    var pre = null, suf = null;
    for (var i = 0; i < item.affixes.length; i++) {
      var def = GM.AFFIX_BY_ID[item.affixes[i].id];
      if (!def) continue;
      if (def.kind === "prefix" && !pre) pre = def.name;
      if (def.kind === "suffix" && !suf) suf = def.name;
    }
    return (pre ? pre + " " : "") + base.name + (suf ? " " + suf : "");
  }

  /* Rare and better get a generated title, seeded off the item so the name is
     stable across reloads and re-renders. */
  var h = GM.hash(item.id + "|" + item.baseId + "|" + item.ilvl);
  var head = GM.RARE_HEADS[h % GM.RARE_HEADS.length];
  var tail = GM.RARE_TAILS[(h >>> 5) % GM.RARE_TAILS.length];
  if (item.rarity >= 4) {
    return head + tail + " " + GM.RARE_EPITHETS[(h >>> 11) % GM.RARE_EPITHETS.length];
  }
  return head + tail;
};

/* ---------- generation --------------------------------------------------- */
GM.makeItem = function (opts) {
  opts = opts || {};
  var pool = opts.pool || GM.pick(GM.ALL_POOLS);
  var ilvl = Math.max(1, Math.floor(opts.ilvl || 1));
  var rarity = opts.rarity != null
    ? GM.RARITY_BY_ID[opts.rarity]
    : GM.rollRarity(opts.rarityBonus || 0, opts.floorRarity);

  var baseChoices = GM.basesFor(pool, ilvl);
  var base = GM.pickW(baseChoices, function (x) { return x.w; }).base;

  var total = GM.randInt(rarity.minAff, rarity.maxAff);
  /* Split between prefixes and suffixes, at most 4 of either. */
  var nPre = Math.min(4, Math.ceil(total / 2) + (GM.chance(0.5) ? 0 : -1));
  nPre = GM.clamp(nPre, 0, Math.min(4, total));
  var nSuf = Math.min(4, total - nPre);

  var usedGroups = {};
  var affixes = rollAffixes(base.pool, ilvl, "prefix", nPre, usedGroups)
          .concat(rollAffixes(base.pool, ilvl, "suffix", nSuf, usedGroups));

  var item = {
    id: GM.uid("it"),
    baseId: base.id,
    pool: base.pool,
    ilvl: ilvl,
    rarity: rarity.id,
    affixes: affixes,
    sockets: rollSockets(base, rarity),
    inscribed: [],      /* affix ids added by Epitaph, for the tooltip mark */
    locked: false,
    foundAt: GM.state.depth ? GM.state.depth.current : 1
  };
  item.name = GM.itemName(item);
  return item;
};

/* ---------- starting kit -------------------------------------------------
   A brand new character is otherwise unarmed: 2 base damage against a stage-1
   monster's 15 life and 6 armour is a thirty-second first kill that it can
   lose. Nobody should meet an idle game that way. Three common tier-1 pieces
   put the opening fight at a couple of seconds and leave every upgrade after
   it still feeling like an upgrade. */
GM.grantStartingKit = function () {
  var kit = [
    { pool: "weapon", family: "sword" },
    { pool: "body",   family: "body"  },
    { pool: "boots",  family: "boots" }
  ];
  /* Every founding hero, not just one — a squad where two of three are unarmed
     reads as broken rather than as a starting point. */
  var heroes = GM.state.heroes || [];
  for (var h = 0; h < heroes.length; h++) {
    for (var i = 0; i < kit.length; i++) {
      var spec = kit[i];
      var famWanted = spec.family;
      /* Give each class a weapon that suits it, so the roster does not open
         with five identical swords. */
      if (spec.pool === "weapon") {
        var byClass = { warden: "maul", reaver: "sword", pyre: "wand",
                        stalker: "dagger", sexton: "scythe" };
        famWanted = byClass[heroes[h].classId] || "sword";
      }
      var base = null;
      for (var j = 0; j < GM.BASES.length; j++) {
        if (GM.BASES[j].family === famWanted && GM.BASES[j].tier === 1) { base = GM.BASES[j]; break; }
      }
      if (!base) continue;
      var item = {
        id: GM.uid("it"), baseId: base.id, pool: base.pool, ilvl: 1, rarity: 0,
        affixes: [], sockets: [], inscribed: [], locked: false, foundAt: 1
      };
      item.name = GM.itemName(item);
      heroes[h].equip[base.pool] = item;
    }
  }
  GM.invalidateStats();
  GM.bus.emit("gear:changed");
};

/* ---------- drops --------------------------------------------------------
   Called once per kill. Quantity raises the number of rolls; rarity raises
   what each roll can become. */
GM.DROP_BASE = 0.30;
GM.RUNE_DROP_BASE = 0.035;

GM.rollDrops = function (stage, st, opts) {
  opts = opts || {};
  var out = { items: [], runes: [], gold: 0, shards: 0 };

  var qty = 1 + Math.max(0, st.findQuantity);
  var rolls = Math.floor(qty);
  if (GM.chance(qty - rolls)) rolls++;
  var chance = GM.DROP_BASE * (opts.dropMult || 1);

  for (var i = 0; i < rolls; i++) {
    if (!GM.chance(chance)) continue;
    out.items.push(GM.makeItem({
      ilvl: stage,
      rarityBonus: st.findRarity,
      floorRarity: opts.floorRarity
    }));
  }

  if (GM.chance(GM.RUNE_DROP_BASE * (opts.runeMult || 1) * (1 + st.findQuantity * 0.5))) {
    var pick = GM.pickW(GM.runesFor(stage), function (x) { return x.w; });
    out.runes.push(pick.rune.id);
  }

  out.gold = Math.max(1, Math.round(GM.goldFor(stage) * (1 + st.findGold) * (opts.goldMult || 1)));
  /* Shards are the deterministic side of the economy: a guaranteed trickle so
     crafting is never gated purely on luck. */
  out.shards = GM.chance(0.18 * (opts.shardMult || 1)) ? GM.randInt(1, 3) : 0;

  return out;
};

/* ---------- comparison and auto-equip ------------------------------------ */
GM.slotsForItem = function (item) {
  var base = GM.BASE_BY_ID[item.baseId];
  if (!base) return [];
  if (base.pool === "ring") return ["ring1", "ring2"];
  return [base.pool];
};

/* Best placement of `item` on ONE hero: {slot, gain} or null. */
GM.evaluateForHero = function (hero, item, ctx) {
  if (!hero) return null;
  var slots = GM.slotsForItem(item);
  if (!slots.length) return null;
  var current = GM.powerScore(GM.heroStats(hero, ctx));
  var best = null;
  for (var i = 0; i < slots.length; i++) {
    var slot = slots[i];
    var worn = hero.equip[slot];
    if (worn && worn.locked) continue;
    var score = GM.powerScore(GM.heroStatsWith(hero, slot, item, ctx));
    var gain = (score - current) / Math.max(1, current);
    if (!best || gain > best.gain) best = { slot: slot, gain: gain, score: score };
  }
  return best;
};

/* Best placement across a whole squad. A drop belongs to whoever gains most
   from it, which is the only sane rule once loot is shared by five people. */
GM.evaluateForSquad = function (sq, item, ctx) {
  var heroes = GM.squadHeroes(sq);
  var best = null;
  for (var i = 0; i < heroes.length; i++) {
    var r = GM.evaluateForHero(heroes[i], item, ctx);
    if (r && (!best || r.gain > best.gain)) {
      best = { hero: heroes[i], slot: r.slot, gain: r.gain };
    }
  }
  return best;
};

GM.equipOn = function (hero, item, slot) {
  if (!hero) return null;
  var slots = GM.slotsForItem(item);
  if (!slot) slot = slots[0];
  if (slots.indexOf(slot) < 0) return null;
  var prev = hero.equip[slot] || null;
  hero.equip[slot] = item;
  var idx = GM.state.stash.indexOf(item);
  if (idx >= 0) GM.state.stash.splice(idx, 1);
  GM.bus.emit("gear:changed", { hero: hero, slot: slot, item: item, replaced: prev });
  return prev;
};

GM.unequipFrom = function (hero, slot) {
  if (!hero) return null;
  var it = hero.equip[slot];
  if (!it) return null;
  hero.equip[slot] = null;
  GM.stashItem(it);
  GM.bus.emit("gear:changed", { hero: hero, slot: slot, item: null, replaced: it });
  return it;
};

/* ---------- stash and salvage -------------------------------------------- */
GM.salvageValue = function (item) {
  var base = GM.BASE_BY_ID[item.baseId];
  var tier = base ? base.tier : 1;
  var shards = Math.max(1, Math.round((item.rarity + 1) * tier * 0.9));
  var gold = Math.max(1, Math.round(GM.goldFor(item.ilvl) * 0.55 * (item.rarity + 1)));
  return { shards: shards, gold: gold };
};

GM.salvage = function (item) {
  var idx = GM.state.stash.indexOf(item);
  if (idx >= 0) GM.state.stash.splice(idx, 1);
  /* Runes in the sockets come back — losing them to a salvage click would be
     the single most enraging thing in the game. */
  for (var i = 0; i < (item.sockets || []).length; i++) {
    if (item.sockets[i]) GM.addRune(item.sockets[i], 1);
  }
  var v = GM.salvageValue(item);
  GM.state.char.shards += v.shards;
  GM.state.char.gold += v.gold;
  GM.state.tally.salvaged++;
  GM.bus.emit("stash:changed");
  return v;
};

GM.stashItem = function (item) {
  GM.state.stash.push(item);
  if (GM.state.stash.length > GM.STASH_MAX) {
    /* Overflow auto-salvages the worst unlocked item rather than refusing the
       drop — an idle game must never need the player to make room. */
    var worst = null, worstScore = Infinity;
    for (var i = 0; i < GM.state.stash.length; i++) {
      var it = GM.state.stash[i];
      if (it.locked || it === item) continue;
      var sc = it.rarity * 1000 + it.ilvl;
      if (sc < worstScore) { worstScore = sc; worst = it; }
    }
    if (worst) GM.salvage(worst);
  }
  GM.bus.emit("stash:changed");
};

/* Handle one dropped item under the player's automation settings. Returns a
   short verb for the log. */
/* Offline catch-up sets this. Evaluating every drop against a full stat
   derivation is fine at one drop a second and ruinous at twenty thousand on
   boot, so in fast mode only genuinely promising items get the full compare
   and the rest go straight to salvage. */
GM.fast = { active: false, evals: 0, maxEvals: 300 };

GM.intakeItem = function (item, ctx, sq) {
  GM.state.tally.drops++;

  if (GM.fast.active) {
    var worthLooking = item.rarity >= 2 && GM.fast.evals < GM.fast.maxEvals;
    if (!worthLooking) {
      GM.state.stash.push(item);
      return { action: "salvaged", value: GM.salvage(item) };
    }
    GM.fast.evals++;
  }

  if (GM.state.opts.autoEquip && sq) {
    var best = GM.evaluateForSquad(sq, item, ctx);
    if (best && best.gain > 0.0005) {
      var replaced = GM.equipOn(best.hero, item, best.slot);
      if (replaced) {
        if (GM.state.opts.autoSalvage && !replaced.locked) GM.salvage(replaced);
        else GM.stashItem(replaced);
      }
      return { action: "equipped", hero: best.hero, slot: best.slot, gain: best.gain };
    }
  }

  if (GM.state.opts.autoSalvage && item.rarity < GM.state.opts.salvageBelow) {
    GM.state.stash.push(item);
    var v = GM.salvage(item);
    return { action: "salvaged", value: v };
  }
  GM.stashItem(item);
  return { action: "stashed" };
};
