/* Gravemark — 15-inscribe.js
   The deterministic half of the economy: epitaphs cut into heroes.

   An epitaph carries a REMEMBERED value, so what you see is exactly what you
   get — no roll, no range, no second attempt needed. The hero is the
   workpiece: a rank I carries two traits, a rank III four, and anointing
   (05-data-heroes) is how you make room for more. Shards pay for the cut. */
"use strict";

/* All costs run through here so the Forge discount applies in exactly one
   place and can never be forgotten at a call site. */
GM.craftCost = function (raw) {
  var st = GM.playerStats();
  return Math.max(1, Math.ceil(raw * (1 - st.craftDiscount)));
};

GM.inscribeCost = function (epitaph, hero) {
  return GM.craftCost(30 * epitaph.tier * (1 + (hero ? hero.level : 1) / 20));
};

/* Can this hero carry this name? Same-group already present is a
   REPLACEMENT, which is legal and is in fact the main use: overwrite a weak
   tier with a remembered strong one. A full hero needs a victim chosen. */
GM.canInscribe = function (hero, epitaph) {
  var def = GM.AFFIX_BY_ID[epitaph.affixId];
  if (!def) return { ok: false, why: "That name has worn away." };
  if (!hero) return { ok: false, why: "Choose a hero." };
  if (def.classes.indexOf(hero.classId) < 0) {
    return { ok: false, why: "A " + GM.heroClass(hero).name + " cannot learn that." };
  }
  var traits = hero.traits || [];
  for (var i = 0; i < traits.length; i++) {
    var d = GM.AFFIX_BY_ID[traits[i].affixId];
    if (d && d.group === def.group) return { ok: true, replaces: traits[i] };
  }
  if (traits.length < GM.heroTraitCap(hero)) return { ok: true, replaces: null };
  return { ok: true, replaces: null, needsVictim: true };
};

GM.inscribe = function (hero, epitaph, victimTrait) {
  var check = GM.canInscribe(hero, epitaph);
  if (!check.ok) return check;
  if (check.needsVictim && !victimTrait) {
    return { ok: false, why: hero.name + " carries all they can. Choose a name to cut away." };
  }

  var cost = GM.inscribeCost(epitaph, hero);
  if (!GM.spendShards(cost)) return { ok: false, why: "Not enough shards." };

  if (!hero.traits) hero.traits = [];
  var replaced = check.replaces || victimTrait || null;
  if (replaced) {
    var idx = hero.traits.indexOf(replaced);
    if (idx >= 0) hero.traits.splice(idx, 1);
  }

  var def = GM.AFFIX_BY_ID[epitaph.affixId];
  hero.traits.push({
    affixId: epitaph.affixId, stat: epitaph.stat, tier: epitaph.tier,
    displayTier: epitaph.displayTier, value: epitaph.value, pct: !!epitaph.pct,
    from: epitaph.from || 0, name: def ? def.name : epitaph.affixId
  });

  GM.consumeEpitaph(epitaph);
  GM.state.tally.inscribed++;
  GM.invalidateStats();
  GM.bus.emit("roster:changed");
  GM.log("Inscribed " + (def ? def.name : epitaph.affixId) + " on " + hero.name + ".", "epitaph");
  return { ok: true, cost: cost, replaced: replaced };
};

/* Heroes who could carry an epitaph right now, best candidate first — the
   one who gains most power from it. Used by the Names overlay. */
GM.inscribeCandidates = function (epitaph) {
  var out = [];
  (GM.state.heroes || []).forEach(function (h) {
    var can = GM.canInscribe(h, epitaph);
    if (!can.ok) return;
    var before = GM.powerScore(GM.heroStats(h, null));
    var after = GM.powerScore(GM.heroStatsWith(h, epitaph, can.replaces));
    out.push({ hero: h, can: can, gain: (after - before) / Math.max(1, before) });
  });
  out.sort(function (a, b) { return b.gain - a.gain; });
  return out;
};
