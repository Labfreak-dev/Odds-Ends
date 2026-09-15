/* Gravemark — 14-graves.js
   The system the game is named after.

   Dying does NOT strip your gear — an idle game that confiscates equipment on
   death stops being idle. What death does is take a RUBBING of what you were
   wearing and plant it at that depth as a gravemark. Recover the gravemark and
   it gives back an Epitaph: one of those exact affix rolls, at its exact tier
   and value, which can then be inscribed onto any item deterministically.

   So the endgame is not "reroll until the dice are kind". It is "die in good
   gear, remember the good rolls, and put them where you want them". Leave a
   gravemark too long and it stands up as a Revenant wearing your old kit,
   which you have to beat to claim what it is holding. */
"use strict";

GM.GRAVE_MAX = 6;            /* beyond this, the oldest rises */
GM.GRAVE_BASE_KILLS = 60;    /* kills needed to recover, before graveHaste */
GM.EPITAPH_MAX = 60;

/* ---------- planting ----------------------------------------------------- */
GM.plantGrave = function (sq, stage, killer) {
  var s = GM.state;

  /* Record the affixes worn by the whole squad that fell, with their rolled
     values. A gravemark of a naked squad is worth nothing, which is correct. */
  var recorded = [];
  var heroes = sq ? GM.squadHeroes(sq) : [];
  for (var h = 0; h < heroes.length; h++) {
    for (var i = 0; i < GM.SLOT_IDS.length; i++) {
      var it = heroes[h].equip[GM.SLOT_IDS[i]];
      if (!it || !it.affixes) continue;
      for (var j = 0; j < it.affixes.length; j++) {
        var a = it.affixes[j];
        var def = GM.AFFIX_BY_ID[a.id];
        if (!def) continue;
        recorded.push({
          affixId: a.id, stat: a.stat, tier: a.tier,
          displayTier: a.displayTier, value: a.value, pct: !!a.pct
        });
      }
    }
  }

  var haste = (sq ? GM.squadStats(sq, null).graveHaste : 0) || 0;
  var required = Math.max(8, Math.round(GM.GRAVE_BASE_KILLS / (1 + haste)));

  var grave = {
    id: GM.uid("gv"),
    stage: stage,
    at: Date.now(),
    killer: killer ? killer.name : "something",
    squad: sq ? sq.name : "",
    realm: GM.realmInfo(GM.realmOf(stage)).name,
    recorded: recorded,
    state: "buried",          /* buried -> revenant -> (claimed) */
    progress: 0,
    required: required,
    level: GM.warbandLevel()
  };

  s.graves.push(grave);
  GM.log("A gravemark is cut at depth " + stage + ". " + recorded.length + " names on it.", "grave");

  /* Oldest buried grave rises once we are over the limit. */
  while (s.graves.length > GM.GRAVE_MAX) {
    var oldest = null;
    for (i = 0; i < s.graves.length; i++) {
      if (s.graves[i].state !== "buried") continue;
      if (!oldest || s.graves[i].at < oldest.at) oldest = s.graves[i];
    }
    if (oldest) { GM.riseRevenant(oldest); }
    else {
      /* All of them are already revenants — drop the oldest outright rather
         than growing the save without bound. */
      s.graves.shift();
    }
    if (s.graves.length > GM.GRAVE_MAX + 3) s.graves.shift();
    if (!oldest) break;
  }

  GM.bus.emit("graves:changed");
  return grave;
};

/* ---------- recovery -----------------------------------------------------
   Progress accrues on kills at or below the gravemark's depth: you have to go
   back for it. Kills deeper than the grave count double — clearing past where
   you died is the strongest way to settle old business. */
GM.graveOnKill = function (sq, st, report, ctx) {
  var s = GM.state;
  if (!s.graves.length) return;
  var here = GM.squadStage(sq);

  for (var i = 0; i < s.graves.length; i++) {
    var g = s.graves[i];
    if (g.state !== "buried") continue;
    if (here < g.stage - 12) continue;              /* too shallow to matter */
    g.progress += here >= g.stage ? 2 : 1;
    if (g.progress >= g.required) {
      var got = GM.recoverGrave(g, st);
      if (report) report.epitaphs = (report.epitaphs || 0) + got.length;
    }
  }
};

/* Turn a recovered gravemark into epitaphs. The player gets the BEST recorded
   roll guaranteed, plus extras on epitaphChance — so a death in good gear is
   always worth something specific, never a lottery ticket. */
GM.recoverGrave = function (g, st) {
  var s = GM.state;
  st = st || GM.playerStats();
  var out = [];

  if (!g.recorded.length) {
    GM.log("The gravemark at depth " + g.stage + " is blank. You were wearing nothing worth remembering.", "grave");
  } else {
    var sorted = g.recorded.slice().sort(function (a, b) {
      /* Highest real tier first; ties broken by value. */
      if (b.tier !== a.tier) return b.tier - a.tier;
      return b.value - a.value;
    });

    var count = 1;
    var extra = st.epitaphChance || 0;
    while (extra > 0) {
      if (GM.chance(Math.min(1, extra))) count++;
      extra -= 1;
    }
    count = Math.min(count, sorted.length);

    for (var i = 0; i < count; i++) out.push(GM.makeEpitaph(sorted[i], g));
    GM.questProgress("grave", 1);
    GM.log("Recovered the gravemark at depth " + g.stage + ": " +
           out.map(function (e) { return e.label; }).join(", ") + ".", "epitaph");
  }

  var idx = s.graves.indexOf(g);
  if (idx >= 0) s.graves.splice(idx, 1);
  GM.bus.emit("graves:changed");
  GM.bus.emit("epitaphs:changed");
  return out;
};

GM.makeEpitaph = function (rec, grave) {
  var def = GM.AFFIX_BY_ID[rec.affixId];
  var e = {
    id: GM.uid("ep"),
    affixId: rec.affixId,
    stat: rec.stat,
    tier: rec.tier,
    displayTier: rec.displayTier,
    value: rec.value,
    pct: !!rec.pct,
    from: grave ? grave.stage : 0,
    name: def ? def.name : rec.affixId,
    label: (def ? def.name : rec.affixId) + " T" + (rec.displayTier || rec.tier)
  };
  GM.state.epitaphs.push(e);
  /* Bounded like the log: an unbounded epitaph list is the save's largest
     object after a week of idling. Oldest weakest goes first. */
  if (GM.state.epitaphs.length > GM.EPITAPH_MAX) {
    var worstIdx = 0, worst = Infinity;
    for (var i = 0; i < GM.state.epitaphs.length; i++) {
      var t = GM.state.epitaphs[i].tier;
      if (t < worst) { worst = t; worstIdx = i; }
    }
    GM.state.epitaphs.splice(worstIdx, 1);
  }
  return e;
};

GM.consumeEpitaph = function (ep) {
  var i = GM.state.epitaphs.indexOf(ep);
  if (i >= 0) GM.state.epitaphs.splice(i, 1);
  GM.bus.emit("epitaphs:changed");
};

/* ---------- revenants ----------------------------------------------------
   A neglected gravemark stands up wearing what you left on it. It is fought
   at its own depth with multipliers drawn from how much it is carrying — a
   revenant of a well-geared death is genuinely dangerous, which is the point:
   the thing you have to beat is a snapshot of yourself. */
GM.riseRevenant = function (g) {
  g.state = "revenant";
  g.roseAt = Date.now();
  /* Power scales with how many good rolls it is holding. */
  var weight = 0;
  for (var i = 0; i < g.recorded.length; i++) weight += g.recorded[i].tier;
  g.power = 1 + GM.clamp(weight / 28, 0, 3.2);
  GM.state.tally.revenants++;
  GM.log("The gravemark at depth " + g.stage + " is standing up. It is wearing your things.", "revenant");
  GM.bus.emit("graves:changed");
  return g;
};

GM.revenantMonster = function (g) {
  return {
    id: "revenant", name: "Revenant of Depth " + g.stage, kind: "revenant",
    elem: "void",
    res: { void: 0.30, phys: 0.20, fire: 0.15, cold: 0.15, lit: 0.15 },
    hp: GM.monHp(g.stage) * 14 * g.power,
    dmg: GM.monDmg(g.stage) * 1.9 * g.power,
    armour: GM.monArmour(g.stage) * 2,
    acc: GM.monAcc(g.stage) * 1.3,
    stage: g.stage,
    graveId: g.id
  };
};

/* Claiming a revenant pays double, and hands over a guaranteed high-rarity
   item as the "your old kit, improved" payoff. */
GM.claimRevenant = function (g, st) {
  st = st || GM.playerStats();
  var out = [];
  var sorted = g.recorded.slice().sort(function (a, b) {
    if (b.tier !== a.tier) return b.tier - a.tier;
    return b.value - a.value;
  });
  var count = Math.min(sorted.length, 2 + (GM.chance(st.epitaphChance || 0) ? 1 : 0));
  for (var i = 0; i < count; i++) out.push(GM.makeEpitaph(sorted[i], g));

  var prize = GM.makeItem({
    ilvl: Math.max(1, g.stage),
    rarityBonus: (st.findRarity || 0) + 1.5,
    floorRarity: 3
  });
  GM.intakeItem(prize);

  var idx = GM.state.graves.indexOf(g);
  if (idx >= 0) GM.state.graves.splice(idx, 1);

  GM.log("Put down the Revenant of depth " + g.stage + ". It was carrying " + GM.itemName(prize) + ".", "revenant");
  GM.bus.emit("graves:changed");
  GM.bus.emit("epitaphs:changed");
  return { epitaphs: out, item: prize };
};

/* Losing to a revenant re-buries it with its progress reset — you can try
   again, but the vigil starts over. */
GM.reburyRevenant = function (g) {
  g.state = "buried";
  g.progress = 0;
  g.required = Math.max(8, Math.round(g.required * 1.15));
  GM.log("The Revenant lays back down. It will keep.", "revenant");
  GM.bus.emit("graves:changed");
};

/* ---------- queries for the UI ------------------------------------------- */
GM.buriedGraves = function () {
  return GM.state.graves.filter(function (g) { return g.state === "buried"; });
};
GM.revenants = function () {
  return GM.state.graves.filter(function (g) { return g.state === "revenant"; });
};
GM.graveById = function (id) {
  for (var i = 0; i < GM.state.graves.length; i++) {
    if (GM.state.graves[i].id === id) return GM.state.graves[i];
  }
  return null;
};
