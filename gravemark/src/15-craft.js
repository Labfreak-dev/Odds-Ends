/* Gravemark — 15-craft.js
   The bench: sockets, runes, rerolls, and Epitaph inscription.

   Two halves that deliberately pull against each other. Shards buy RANDOM
   outcomes (reroll, augment, upgrade) and are plentiful. Epitaphs buy an
   EXACT outcome and are scarce, because each one cost you a death. A player
   who hates gambling can play almost entirely on the epitaph side; a player
   who likes it can burn shards forever. */
"use strict";

/* All costs run through here so the Forge discount applies in exactly one
   place and can never be forgotten at a call site. */
GM.craftCost = function (raw) {
  var st = GM.stats();
  return Math.max(1, Math.ceil(raw * (1 - st.craftDiscount)));
};

GM.maxAffixes = function (item) {
  var r = GM.RARITY_BY_ID[item.rarity];
  return r ? r.maxAff : 0;
};

GM.baseOf = function (item) { return GM.BASE_BY_ID[item.baseId]; };

/* ---------- sockets ------------------------------------------------------ */
GM.maxSockets = function (item) {
  var b = GM.baseOf(item);
  return b ? (b.sockets || 0) : 0;
};

GM.addSocketCost = function (item) {
  var b = GM.baseOf(item);
  var have = (item.sockets || []).length;
  return GM.craftCost(18 * Math.pow(2.1, have) * (b ? b.tier : 1));
};

GM.addSocket = function (item) {
  if (!item.sockets) item.sockets = [];
  if (item.sockets.length >= GM.maxSockets(item)) return { ok: false, why: "This base holds no more." };
  var cost = GM.addSocketCost(item);
  if (!GM.spendShards(cost)) return { ok: false, why: "Not enough shards." };
  item.sockets.push(null);
  GM.afterCraft(item);
  return { ok: true, cost: cost };
};

GM.socketRune = function (item, index, runeId) {
  if (!item.sockets || index < 0 || index >= item.sockets.length) {
    return { ok: false, why: "No such socket." };
  }
  if (item.sockets[index]) return { ok: false, why: "That socket is full." };
  if (GM.runeCount(runeId) <= 0) return { ok: false, why: "You have no " + (GM.RUNE_BY_ID[runeId] || {}).name + "." };
  GM.addRune(runeId, -1);
  item.sockets[index] = runeId;
  var rw = GM.matchRuneword(item.pool || (GM.baseOf(item) || {}).pool, item.sockets);
  GM.afterCraft(item);
  if (rw) GM.log("The runes settle. " + rw.name + ". “" + rw.flavour + "”", "runeword");
  return { ok: true, runeword: rw };
};

/* Pulling a rune costs shards but RETURNS the rune. Destroying it would make
   every socket decision terrifying, which is not the kind of tension worth
   having in a game that plays itself. */
GM.pullRuneCost = function (item, index) {
  var id = item.sockets[index];
  var r = GM.RUNE_BY_ID[id];
  return GM.craftCost(12 * (r ? r.tier : 1));
};

GM.pullRune = function (item, index) {
  if (!item.sockets || !item.sockets[index]) return { ok: false, why: "Nothing in that socket." };
  var cost = GM.pullRuneCost(item, index);
  if (!GM.spendShards(cost)) return { ok: false, why: "Not enough shards." };
  var id = item.sockets[index];
  item.sockets[index] = null;
  GM.addRune(id, 1);
  GM.afterCraft(item);
  return { ok: true, rune: id, cost: cost };
};

/* ---------- random crafting ---------------------------------------------- */
GM.rerollCost = function (item) {
  return GM.craftCost(20 * (item.rarity + 1) * (1 + item.ilvl / 14));
};

GM.reroll = function (item) {
  if (item.rarity < 1) return { ok: false, why: "Common items have nothing to reroll." };
  var cost = GM.rerollCost(item);
  if (!GM.spendShards(cost)) return { ok: false, why: "Not enough shards." };

  var fresh = GM.makeItem({ pool: item.pool, ilvl: item.ilvl, rarity: item.rarity });
  /* Keep identity, sockets and runes; swap only the rolled affixes. */
  item.affixes = fresh.affixes;
  item.inscribed = [];
  GM.afterCraft(item);
  return { ok: true, cost: cost };
};

GM.augmentCost = function (item) {
  return GM.craftCost(45 * (item.affixes.length + 1) * (1 + item.ilvl / 12));
};

GM.augment = function (item) {
  if (item.affixes.length >= GM.maxAffixes(item)) {
    return { ok: false, why: "No room for another modifier." };
  }
  var cost = GM.augmentCost(item);
  if (!GM.spendShards(cost)) return { ok: false, why: "Not enough shards." };

  var used = {};
  for (var i = 0; i < item.affixes.length; i++) {
    var d = GM.AFFIX_BY_ID[item.affixes[i].id];
    if (d) used[d.group] = true;
  }
  var kind = GM.chance(0.5) ? "prefix" : "suffix";
  var rolled = GM.rollAffixesPublic(item.pool, item.ilvl, kind, 1, used);
  if (!rolled.length) rolled = GM.rollAffixesPublic(item.pool, item.ilvl, kind === "prefix" ? "suffix" : "prefix", 1, used);
  if (!rolled.length) {
    GM.state.char.shards += cost;   /* refund: nothing legal was left to add */
    return { ok: false, why: "Nothing new will take on this base." };
  }
  item.affixes.push(rolled[0]);
  GM.afterCraft(item);
  return { ok: true, cost: cost, affix: rolled[0] };
};

GM.upgradeCost = function (item) {
  return GM.craftCost(140 * Math.pow(2.4, item.rarity) * (1 + item.ilvl / 10));
};

GM.upgradeRarity = function (item) {
  if (item.rarity >= GM.RARITIES.length - 1) return { ok: false, why: "Nothing is rarer than Mythic." };
  var cost = GM.upgradeCost(item);
  if (!GM.spendShards(cost)) return { ok: false, why: "Not enough shards." };
  item.rarity++;
  /* Upgrading grants the affixes the new rarity guarantees, no more. */
  var target = GM.RARITY_BY_ID[item.rarity].minAff;
  var guard = 0;
  while (item.affixes.length < target && guard++ < 10) {
    var r = GM.augmentFree(item);
    if (!r) break;
  }
  GM.afterCraft(item);
  return { ok: true, cost: cost };
};

/* Internal: add one affix with no shard cost, used by rarity upgrades. */
GM.augmentFree = function (item) {
  var used = {};
  for (var i = 0; i < item.affixes.length; i++) {
    var d = GM.AFFIX_BY_ID[item.affixes[i].id];
    if (d) used[d.group] = true;
  }
  var kind = GM.chance(0.5) ? "prefix" : "suffix";
  var rolled = GM.rollAffixesPublic(item.pool, item.ilvl, kind, 1, used);
  if (!rolled.length) rolled = GM.rollAffixesPublic(item.pool, item.ilvl, kind === "prefix" ? "suffix" : "prefix", 1, used);
  if (!rolled.length) return null;
  item.affixes.push(rolled[0]);
  return rolled[0];
};

/* ---------- Epitaph inscription -----------------------------------------
   The deterministic half. An epitaph carries a REMEMBERED value, so what you
   see is exactly what you get — no roll, no range, no second attempt needed. */
GM.inscribeCost = function (epitaph, item) {
  return GM.craftCost(30 * epitaph.tier * (1 + (item ? item.ilvl : 1) / 20));
};

GM.canInscribe = function (item, epitaph) {
  var def = GM.AFFIX_BY_ID[epitaph.affixId];
  if (!def) return { ok: false, why: "That name has worn away." };
  var pool = item.pool || (GM.baseOf(item) || {}).pool;
  if (def.pools.indexOf(pool) < 0) {
    return { ok: false, why: "This modifier does not belong on a " + (GM.baseOf(item) || {}).kindLabel + "." };
  }
  /* Same group already present is a REPLACEMENT, which is legal and is in
     fact the main use: overwrite a bad tier with a remembered good one. */
  for (var i = 0; i < item.affixes.length; i++) {
    var d = GM.AFFIX_BY_ID[item.affixes[i].id];
    if (d && d.group === def.group) return { ok: true, replaces: item.affixes[i] };
  }
  if (item.affixes.length < GM.maxAffixes(item)) return { ok: true, replaces: null };
  return { ok: true, replaces: null, needsVictim: true };
};

GM.inscribe = function (item, epitaph, victimAffix) {
  var check = GM.canInscribe(item, epitaph);
  if (!check.ok) return check;
  if (check.needsVictim && !victimAffix) {
    return { ok: false, why: "The item is full. Choose a modifier to cut away." };
  }

  var cost = GM.inscribeCost(epitaph, item);
  if (!GM.spendShards(cost)) return { ok: false, why: "Not enough shards." };

  var def = GM.AFFIX_BY_ID[epitaph.affixId];
  var replaced = check.replaces || victimAffix || null;
  if (replaced) {
    var idx = item.affixes.indexOf(replaced);
    if (idx >= 0) item.affixes.splice(idx, 1);
  }

  item.affixes.push({
    id: epitaph.affixId,
    stat: epitaph.stat,
    tier: epitaph.tier,
    displayTier: epitaph.displayTier,
    value: epitaph.value,
    pct: epitaph.pct
  });
  if (!item.inscribed) item.inscribed = [];
  if (item.inscribed.indexOf(epitaph.affixId) < 0) item.inscribed.push(epitaph.affixId);

  GM.consumeEpitaph(epitaph);
  GM.state.tally.inscribed++;
  GM.afterCraft(item);
  GM.log("Inscribed " + (def ? def.name : epitaph.affixId) + " onto " + GM.itemName(item) + ".", "epitaph");
  return { ok: true, cost: cost, replaced: replaced };
};

/* ---------- shared plumbing ---------------------------------------------- */
GM.afterCraft = function (item) {
  item.name = GM.itemName(item);
  GM.invalidateStats();
  GM.bus.emit("gear:changed", { slot: null, item: item });
  GM.bus.emit("stash:changed");
};

/* Is this item currently equipped, and where? */
GM.equippedSlotOf = function (item) {
  for (var i = 0; i < GM.SLOT_IDS.length; i++) {
    if (GM.state.equip[GM.SLOT_IDS[i]] === item) return GM.SLOT_IDS[i];
  }
  return null;
};

/* Runewords the player could complete on this item right now, given the runes
   in hand and the sockets available. Shown on the bench so hoarded runes have
   a visible purpose. */
GM.runewordProgress = function (item) {
  var pool = item.pool || (GM.baseOf(item) || {}).pool;
  var socks = (item.sockets || []).length;
  return GM.runewordsForPool(pool).map(function (rw) {
    var need = {}, i;
    for (i = 0; i < rw.seq.length; i++) need[rw.seq[i]] = (need[rw.seq[i]] || 0) + 1;
    var missing = [];
    for (var id in need) {
      var have = GM.runeCount(id);
      /* Runes already sitting in this item's sockets count as held. */
      for (i = 0; i < (item.sockets || []).length; i++) if (item.sockets[i] === id) have++;
      if (have < need[id]) missing.push({ rune: id, short: need[id] - have });
    }
    return {
      rw: rw,
      fits: socks === rw.seq.length,
      socketsNeeded: rw.seq.length,
      missing: missing,
      ready: socks === rw.seq.length && missing.length === 0
    };
  });
};
