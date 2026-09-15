/* Gravemark — 14-graves.js
   The system the game is named after.

   Dying does NOT cost a hero anything — an idle game that punishes death
   stops being idle. What death does is cut a gravemark at that depth naming
   everyone who fell: every trait they carried, and one thing each of them
   LEARNED in dying there, rolled for their class at that depth. Recover the
   gravemark and it gives back an Epitaph: one of those exact rolls, at its
   exact tier and value, which can then be inscribed onto a hero as a
   permanent trait — deterministically, no dice.

   So the endgame is not "reroll until the dice are kind". It is "die deep,
   remember what it taught you, and cut it into the hero who needs it". Leave
   a gravemark too long and it stands up as a Revenant of the squad that
   fell, which you have to beat to claim what it remembers. */
"use strict";

GM.GRAVE_MAX = 6;            /* beyond this, the oldest rises */
GM.GRAVE_BASE_KILLS = 60;    /* kills needed to recover, before graveHaste */
GM.EPITAPH_MAX = 60;

/* ---------- planting ----------------------------------------------------- */
GM.plantGrave = function (sq, stage, killer) {
  var s = GM.state;

  /* Record everyone who fell: the traits they carried, and what each of them
     learned dying here — one roll per hero for their class at this depth.
     A boss teaches twice. Even a green squad's first death is worth
     something specific, because the lesson is rolled at the depth, not
     copied from what they had. */
  var recorded = [];
  var heroes = sq ? GM.squadHeroes(sq) : [];
  var lessons = killer && killer.kind === "boss" ? 2 : 1;
  for (var h = 0; h < heroes.length; h++) {
    var hero = heroes[h];
    var traits = hero.traits || [];
    var used = {};
    for (var j = 0; j < traits.length; j++) {
      var t = traits[j];
      var def = GM.AFFIX_BY_ID[t.affixId];
      if (!def) continue;
      used[def.group] = true;
      recorded.push({
        affixId: t.affixId, stat: t.stat, tier: t.tier,
        displayTier: t.displayTier, value: t.value, pct: !!t.pct, who: hero.name
      });
    }
    for (var l = 0; l < lessons; l++) {
      var learned = GM.rollEpitaphRecord(hero.classId, Math.max(1, stage), used);
      if (learned) { learned.who = hero.name; learned.learned = true; recorded.push(learned); }
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
    for (var i = 0; i < s.graves.length; i++) {
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
    GM.log("The gravemark at depth " + g.stage + " is blank. Nobody was there to learn anything.", "grave");
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
    who: rec.who || "",
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
   A neglected gravemark stands up as the squad that fell. It is fought at
   its own depth with multipliers drawn from how much it remembers — a
   revenant of a veteran squad is genuinely dangerous, which is the point:
   the thing you have to beat is a snapshot of yourself. */
GM.riseRevenant = function (g) {
  g.state = "revenant";
  g.roseAt = Date.now();
  /* Power scales with how many good rolls it is holding. */
  var weight = 0;
  for (var i = 0; i < g.recorded.length; i++) weight += g.recorded[i].tier;
  g.power = 1 + GM.clamp(weight / 28, 0, 3.2);
  GM.state.tally.revenants++;
  GM.log("The gravemark at depth " + g.stage + " is standing up. It remembers everything.", "revenant");
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

/* Claiming a revenant pays double, plus a purse of shards to cut the names
   with — the "what it remembered, and the means to keep it" payoff. */
GM.claimRevenant = function (g, st) {
  st = st || GM.playerStats();
  var out = [];
  var sorted = g.recorded.slice().sort(function (a, b) {
    if (b.tier !== a.tier) return b.tier - a.tier;
    return b.value - a.value;
  });
  var count = Math.min(sorted.length, 2 + (GM.chance(st.epitaphChance || 0) ? 1 : 0));
  for (var i = 0; i < count; i++) out.push(GM.makeEpitaph(sorted[i], g));

  var prize = Math.round((40 + g.stage * 3) * (1 + (st.findShards || 0)));
  GM.state.char.shards += prize;

  var idx = GM.state.graves.indexOf(g);
  if (idx >= 0) GM.state.graves.splice(idx, 1);

  GM.log("Put down the Revenant of depth " + g.stage + ". " + prize + " shards, and " +
         out.length + " name" + (out.length === 1 ? "" : "s") + " remembered.", "revenant");
  GM.bus.emit("graves:changed");
  GM.bus.emit("epitaphs:changed");
  return { epitaphs: out, shards: prize };
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
