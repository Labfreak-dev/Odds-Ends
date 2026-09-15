/* Gravemark — 16-modes.js
   The five adventure modes, the vigil (revenant duel), and ascension.

   Combat does not know what mode it is in. It asks three questions —
   what depth, what context, what happens on a kill or a death — and every
   mode answers them its own way. Adding a sixth mode touches this file only. */
"use strict";

GM.MODE_DEFS = [
  {
    id: "expedition", name: "Expedition", icon: "⚒",
    blurb: "Push deeper. The only mode that raises your record.",
    unlock: function () { return true; }
  },
  {
    id: "exploration", name: "Exploration", icon: "\u{1F50D}",
    blurb: "Farm any depth you have already cleared. More drops, no progress.",
    unlock: function () { return GM.state.depth.maxEver >= 5; },
    unlockText: "Clear depth 5."
  },
  {
    id: "tower", name: "Divine Tower", icon: "\u{1F5FC}",
    blurb: "One elite per floor, resistances climbing. Pays Marks.",
    unlock: function () { return GM.state.depth.maxEver >= 30; },
    unlockText: "Clear depth 30."
  },
  {
    id: "dimension", name: "Alternate Dimension", icon: "\u{1F300}",
    blurb: "Three random rules, one payout multiplier. Pays Dust.",
    unlock: function () { return GM.state.depth.maxEver >= 50; },
    unlockText: "Clear depth 50."
  },
  {
    id: "finality", name: "Finality", icon: "\u{1F480}",
    blurb: "Endless waves past the end of the world. Mythics or nothing.",
    unlock: function () { return GM.state.depth.maxEver >= 110; },
    unlockText: "Clear depth 110."
  },
  {
    id: "vigil", name: "Vigil", icon: "\u{1FAA6}",
    blurb: "Put down one of your own Revenants.",
    hidden: true,
    unlock: function () { return GM.revenants().length > 0; }
  }
];

GM.MODE_BY_ID = GM.indexById(GM.MODE_DEFS);

GM.modeUnlocked = function (id) {
  var d = GM.MODE_BY_ID[id];
  return !!(d && d.unlock());
};

/* ---------- a squad's depth ---------------------------------------------- */
GM.squadStage = function (sq) {
  switch (sq.mode) {
    case "exploration": return GM.clamp(sq.target || 1, 1, Math.max(1, sq.max));
    case "tower":       return GM.towerStage(sq.towerRun || 1);
    case "dimension":   return (sq.dim && sq.dim.stage) || 1;
    case "finality":    return GM.finalityStage(sq.wave || 1);
    case "vigil":       var g = GM.graveById(sq.graveId); return g ? g.stage : sq.stage;
    default:            return sq.stage;
  }
};

GM.towerStage = function (floor) {
  return Math.max(1, Math.floor(GM.state.depth.maxEver * 0.6) + floor);
};
GM.towerCheckpoint = function (sq) {
  return Math.floor((sq.towerBest || 0) / 5) * 5 + 1;
};
GM.finalityStage = function (wave) {
  return Math.max(1, GM.state.depth.maxEver + wave * 2);
};

/* ---------- a squad's context -------------------------------------------- */
GM.squadCtx = function (sq) {
  switch (sq.mode) {
    case "exploration":
      return { rewardMult: 1, dropMult: 1.6, runeMult: 1.5, noProgress: true };

    case "tower": {
      var f = sq.towerRun || 1;
      return {
        rewardMult: 1 + f * 0.04,
        hpMult: 1.6 * Math.pow(1.05, f),
        dmgMult: 1.25 * Math.pow(1.03, f),
        resAdd: Math.min(0.60, 0.02 * f),
        dropMult: 1.2, noBoss: true, single: true
      };
    }

    case "dimension": {
      if (!sq.dim) return {};
      return { mutators: sq.dim.mutators, rewardMult: sq.dim.reward,
               dropMult: 1.3, runeMult: 1.4 };
    }

    case "finality": {
      var w = sq.wave || 1;
      return {
        rewardMult: 2 + w * 0.25,
        hpMult: Math.pow(1.34, w),
        dmgMult: Math.pow(1.18, w),
        resAdd: Math.min(0.70, 0.03 * w),
        dropMult: 2.2, runeMult: 2.5, floorRarity: 2, noBoss: true
      };
    }

    case "vigil":
      return sq.graveId ? { revenant: sq.graveId, single: true, noBoss: true } : {};

    default:
      return { rewardMult: 1 };
  }
};

/* ---------- advancing and retreating ------------------------------------- */
GM.squadAdvance = function (sq) {
  var s = GM.state;
  switch (sq.mode) {
    case "expedition":
      /* A depth takes several packs. The panel's top bar is this counter. */
      sq.clears = (sq.clears || 0) + 1;
      if (sq.clears < GM.CURVE.packsPerStage) return;
      sq.clears = 0;
      sq.stage++;
      if (sq.stage > sq.max) sq.max = sq.stage;
      if (sq.stage > s.depth.maxEver) {
        s.depth.maxEver = sq.stage;
        if (GM.floorOf(sq.stage) === 1) {
          GM.log(sq.name + " reaches " + GM.realmInfo(GM.realmOf(sq.stage)).name + ".", "realm");
        }
      }
      break;

    case "exploration":
      break;                                  /* farming: nothing advances */

    case "tower":
      sq.towerRun = (sq.towerRun || 1) + 1;
      if (sq.towerRun - 1 > (sq.towerBest || 0)) {
        sq.towerBest = sq.towerRun - 1;
        var marks = Math.max(1, Math.round(Math.pow(sq.towerBest, 1.25)));
        s.char.marks += marks;
        GM.log(sq.name + " clears tower floor " + sq.towerBest + ". " + marks + " Marks.", "tower");
      }
      break;

    case "dimension": {
      var dust = Math.max(1, Math.round(sq.dim.reward * 4 * Math.pow(1.04, sq.dim.stage)));
      s.char.dust += dust;
      sq.dim.stage++;
      GM.log(sq.name + " folds deeper. " + dust + " Dust.", "dimension");
      break;
    }

    case "finality":
      sq.wave = (sq.wave || 1) + 1;
      if (sq.wave - 1 > s.depth.finality) s.depth.finality = sq.wave - 1;
      break;

    case "vigil": {
      var g = GM.graveById(sq.graveId);
      if (g) GM.claimRevenant(g);
      sq.graveId = null;
      GM.setSquadMode(sq, "expedition");
      break;
    }
  }
  GM.bus.emit("depth:changed");
};

GM.squadRetreat = function (sq) {
  var s = GM.state;
  switch (sq.mode) {
    case "expedition": {
      var realm = GM.realmOf(sq.stage);
      var floor1 = (realm - 1) * GM.STAGES_PER_REALM + 1;
      sq.stage = Math.max(1, floor1);
      sq.clears = 0;
      break;
    }
    case "tower":
      sq.towerRun = GM.towerCheckpoint(sq);
      GM.log(sq.name + " is thrown from the Tower.", "tower");
      break;
    case "dimension":
      sq.dim = null;
      GM.setSquadMode(sq, "expedition");
      break;
    case "finality":
      sq.wave = 1;
      break;
    case "vigil": {
      var g = GM.graveById(sq.graveId);
      if (g) GM.reburyRevenant(g);
      sq.graveId = null;
      GM.setSquadMode(sq, "expedition");
      break;
    }
  }
  GM.bus.emit("depth:changed");
};

/* Manual retreat from the panel button: back to the realm floor, no gravemark
   (you left under your own power). */
GM.manualRetreat = function (sq) {
  sq.victory = null;
  sq.monsters = [];
  sq.hp = sq.hpMax;
  GM.squadRetreat(sq);
  GM.log(sq.name + " withdraws.", "info");
  GM.bus.emit("squads:changed");
};

/* ---------- squad mode switching ----------------------------------------- */
GM.setSquadMode = function (sq, id, cfg) {
  if (!GM.modeUnlocked(id)) {
    return { ok: false, why: (GM.MODE_BY_ID[id] || {}).unlockText || "Locked." };
  }
  sq.mode = id;
  if (cfg) GM.assign(sq, cfg);
  if (id === "exploration" && !sq.target) sq.target = sq.max;
  if (id === "dimension" && !sq.dim) sq.dim = GM.rollDimension(Math.max(1, GM.state.depth.maxEver - 5));
  if (id === "tower") sq.towerRun = GM.towerCheckpoint(sq);
  if (id === "finality" && !sq.wave) sq.wave = 1;
  sq.monsters = [];
  sq.victory = null;
  GM.bus.emit("mode:changed", sq);
  return { ok: true };
};

GM.rerollDimension = function (sq) {
  sq.dim = GM.rollDimension(Math.max(1, GM.state.depth.maxEver - 5));
  sq.monsters = [];
  GM.bus.emit("mode:changed", sq);
  return sq.dim;
};

GM.setExplorationTarget = function (sq, stage) {
  sq.target = GM.clamp(Math.floor(stage), 1, Math.max(1, sq.max));
  sq.monsters = [];
  GM.bus.emit("mode:changed", sq);
};

GM.beginVigil = function (sq, graveId) {
  var g = GM.graveById(graveId);
  if (!g || g.state !== "revenant") return { ok: false, why: "Nothing is standing." };
  sq.graveId = graveId;
  return GM.setSquadMode(sq, "vigil");
};

GM.toggleSquad = function (sq) {
  sq.running = !sq.running;
  GM.bus.emit("squads:changed");
  return sq.running;
};

/* ---------- ascension ----------------------------------------------------
   Reset the run, keep the institution. Town, perks, runes and epitaphs
   survive — they are what makes the next descent faster than the last. */
GM.canAscend = function () {
  return GM.state.depth.maxEver >= GM.ASCEND_MIN_STAGE;
};

GM.ascendPreview = function () {
  return GM.ichorFor(GM.state.depth.maxEver);
};

GM.ascend = function () {
  if (!GM.canAscend()) {
    return { ok: false, why: "Reach depth " + GM.ASCEND_MIN_STAGE + " first." };
  }
  var gained = GM.ascendPreview();
  var s = GM.state;

  s.char.ichor += gained;
  s.char.xp = 0;
  s.char.gold = 0;
  s.char.shards = Math.floor(s.char.shards * 0.25);   /* a little seed capital */

  /* The warband is re-founded: the heroes are new, the parish is not. Keeping
     the roster would make ascension a pure upgrade with no cost at all. */
  GM.foundWarband();
  s.stash = [];
  s.tree = { points: 0, spent: [] };
  s.graves = [];
  if (GM.grantStartingKit) GM.grantStartingKit();

  var st = GM.derive(GM.collect(s.heroes[0], {}));
  var start = Math.max(1, 1 + (st.startStage || 0));
  s.depth.current = start;
  s.depth.max = start;
  s.squads.forEach(function (sq) {
    sq.stage = start; sq.max = start; sq.mode = "expedition";
    sq.monsters = []; sq.victory = null; sq.dim = null;
    sq.hp = 0; sq.hpMax = 0;
  });
  s.char.level = GM.warbandLevel();
  s.tally.ascensions++;

  GM.invalidateStats();
  GM.log("Ascended. " + gained + " Ichor. The ground looks familiar.", "ascend");
  GM.bus.emit("ascend", { gained: gained });
  GM.bus.emit("roster:changed");
  GM.bus.emit("squads:changed");
  GM.bus.emit("gear:changed");
  GM.bus.emit("tree:changed");
  GM.bus.emit("depth:changed");
  GM.save();
  return { ok: true, gained: gained };
};

GM.buyPerk = function (id) {
  var p = GM.PERK_BY_ID[id];
  if (!p) return { ok: false, why: "No such perk." };
  var lv = GM.perkLevel(id);
  if (lv >= p.max) return { ok: false, why: "Already at maximum." };
  var cost = GM.perkCost(p, lv);
  if (!GM.spendIchor(cost)) return { ok: false, why: "Not enough Ichor." };
  GM.state.perks[id] = lv + 1;
  GM.bus.emit("perks:changed");
  return { ok: true, cost: cost };
};

/* ---------- town -------------------------------------------------------- */
GM.buyBuilding = function (id) {
  var b = GM.BUILDING_BY_ID[id];
  if (!b) return { ok: false, why: "No such building." };
  var lv = GM.townLevel(id);
  if (lv >= b.max) return { ok: false, why: "Already at maximum." };
  var cost = GM.buildingCost(b, lv);
  if (!GM.spendGold(cost)) return { ok: false, why: "Not enough gold." };
  GM.state.town[id] = lv + 1;
  GM.bus.emit("town:changed");
  return { ok: true, cost: cost };
};

/* ---------- tree -------------------------------------------------------- */
GM.canAllocate = function (nodeId) {
  var node = GM.TREE_BY_ID[nodeId];
  if (!node) return { ok: false, why: "No such node." };
  if (GM.hasNode(nodeId)) return { ok: false, why: "Already allocated." };
  if (GM.state.tree.points <= 0) return { ok: false, why: "No points to spend." };
  if (node.kind === "root") return { ok: false, why: "The root is free." };
  for (var i = 0; i < node.links.length; i++) {
    if (node.links[i] === "root" || GM.hasNode(node.links[i])) return { ok: true };
  }
  return { ok: false, why: "Not connected to anything you have taken." };
};

GM.allocate = function (nodeId) {
  var check = GM.canAllocate(nodeId);
  if (!check.ok) return check;
  GM.state.tree.points--;
  GM.state.tree.spent.push(nodeId);
  GM.bus.emit("tree:changed");
  return { ok: true };
};

/* Refunding the whole tree at a gold cost — cheaper than an ascension and the
   only way to recover from a keystone that did not work out. */
GM.respecCost = function () {
  return Math.ceil(200 * Math.pow(1.12, GM.state.tree.spent.length));
};

GM.respec = function () {
  var n = GM.state.tree.spent.length;
  if (!n) return { ok: false, why: "Nothing allocated." };
  var cost = GM.respecCost();
  if (!GM.spendGold(cost)) return { ok: false, why: "Not enough gold." };
  GM.state.tree.points += n;
  GM.state.tree.spent = [];
  GM.bus.emit("tree:changed");
  return { ok: true, cost: cost, refunded: n };
};
