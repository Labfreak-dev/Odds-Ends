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

GM.setMode = function (id, cfg) {
  if (!GM.modeUnlocked(id)) return { ok: false, why: (GM.MODE_BY_ID[id] || {}).unlockText || "Locked." };
  var m = GM.state.mode;
  m.id = id;
  if (cfg) GM.assign(m, cfg);

  if (id === "exploration" && !m.target) m.target = GM.state.depth.maxEver;
  if (id === "dimension" && !m.dim) m.dim = GM.rollDimension(Math.max(1, GM.state.depth.maxEver - 5));
  if (id === "tower") m.towerRun = GM.towerCheckpoint();
  if (id === "finality" && !m.wave) m.wave = 1;

  /* A mode switch always ends the current encounter — otherwise the player
     carries a half-killed Expedition monster into the Tower. */
  GM.fight.monster = null;
  GM.bus.emit("mode:changed", m);
  return { ok: true };
};

/* ---------- depth -------------------------------------------------------- */
GM.towerStage = function (floor) {
  return Math.max(1, Math.floor(GM.state.depth.maxEver * 0.6) + floor);
};
GM.towerCheckpoint = function () {
  return Math.floor(GM.state.depth.towerFloor / 5) * 5 + 1;
};
GM.finalityStage = function (wave) {
  return Math.max(1, GM.state.depth.maxEver + wave * 2);
};

GM.modeStage = function () {
  var m = GM.state.mode;
  switch (m.id) {
    case "exploration": return GM.clamp(m.target || 1, 1, GM.state.depth.maxEver);
    case "tower":       return GM.towerStage(m.towerRun || 1);
    case "dimension":   return (m.dim && m.dim.stage) || 1;
    case "finality":    return GM.finalityStage(m.wave || 1);
    case "vigil":       var g = GM.graveById(m.graveId); return g ? g.stage : GM.state.depth.current;
    default:            return GM.state.depth.current;
  }
};

/* ---------- context ------------------------------------------------------
   Multipliers handed to the spawner and the drop roller. */
GM.modeCtx = function () {
  var m = GM.state.mode;
  switch (m.id) {
    case "exploration":
      /* The farming mode: more and better drops, no record progress. */
      return { rewardMult: 1, dropMult: 1.6, runeMult: 1.5, noProgress: true };

    case "tower": {
      var f = m.towerRun || 1;
      return {
        rewardMult: 1 + f * 0.04,
        hpMult: 1.6 * Math.pow(1.05, f),
        dmgMult: 1.25 * Math.pow(1.03, f),
        resAdd: Math.min(0.60, 0.02 * f),
        dropMult: 1.2,
        noBoss: true, single: true
      };
    }

    case "dimension": {
      var d = m.dim;
      if (!d) return {};
      return { mutators: d.mutators, rewardMult: d.reward, dropMult: 1.3, runeMult: 1.4 };
    }

    case "finality": {
      var w = m.wave || 1;
      return {
        rewardMult: 2 + w * 0.25,
        hpMult: Math.pow(1.34, w),
        dmgMult: Math.pow(1.18, w),
        resAdd: Math.min(0.70, 0.03 * w),
        dropMult: 2.2, runeMult: 2.5,
        floorRarity: 2, noBoss: true
      };
    }

    case "vigil": {
      var g = GM.graveById(m.graveId);
      return g ? { revenant: g.id, single: true, noBoss: true } : {};
    }

    default:
      return { rewardMult: 1 };
  }
};

/* The vigil replaces the spawn entirely with the revenant. */
var _baseSpawn = GM.spawn;
GM.spawn = function (stage, ctx) {
  if (ctx && ctx.revenant) {
    var g = GM.graveById(ctx.revenant);
    if (g) return GM.revenantMonster(g);
  }
  return _baseSpawn(stage, ctx);
};

/* ---------- kill and death hooks ----------------------------------------- */
GM.modeOnKill = function (mon, report, ctx) {
  var s = GM.state;
  var m = s.mode;

  switch (m.id) {
    case "expedition": {
      s.depth.kills++;
      var need = GM.isBossStage(s.depth.current) ? 1 : GM.CURVE.packSize;
      if (s.depth.kills >= need) {
        s.depth.kills = 0;
        s.depth.current++;
        if (s.depth.current > s.depth.max) s.depth.max = s.depth.current;
        if (s.depth.current > s.depth.maxEver) {
          s.depth.maxEver = s.depth.current;
          if (GM.floorOf(s.depth.current) === 1) {
            GM.log("You reach " + GM.realmInfo(GM.realmOf(s.depth.current)).name + ".", "realm");
          }
        }
        report.cleared++;
        GM.bus.emit("depth:changed");
      }
      break;
    }

    case "exploration":
      /* Nothing advances. That is the deal. */
      break;

    case "tower": {
      s.depth.kills = 0;
      m.towerRun = (m.towerRun || 1) + 1;
      if (m.towerRun - 1 > s.depth.towerFloor) {
        s.depth.towerFloor = m.towerRun - 1;
        var marks = Math.max(1, Math.round(Math.pow(s.depth.towerFloor, 1.25)));
        s.char.marks += marks;
        GM.log("Tower floor " + s.depth.towerFloor + " cleared. " + marks + " Marks.", "tower");
      }
      report.cleared++;
      GM.bus.emit("depth:changed");
      break;
    }

    case "dimension": {
      s.depth.kills++;
      if (s.depth.kills >= GM.CURVE.packSize) {
        s.depth.kills = 0;
        var dust = Math.max(1, Math.round(m.dim.reward * 4 * Math.pow(1.04, m.dim.stage)));
        s.char.dust += dust;
        report.cleared++;
        /* Each clear pushes the dimension one depth deeper until it kills you. */
        m.dim.stage++;
        GM.log("The dimension folds deeper. " + dust + " Dust.", "dimension");
        GM.bus.emit("depth:changed");
      }
      break;
    }

    case "finality": {
      m.wave = (m.wave || 1) + 1;
      if (m.wave - 1 > s.depth.finality) {
        s.depth.finality = m.wave - 1;
        GM.log("Finality wave " + s.depth.finality + " survived.", "finality");
      }
      report.cleared++;
      GM.bus.emit("depth:changed");
      break;
    }

    case "vigil": {
      var g = GM.graveById(m.graveId);
      if (g) {
        GM.claimRevenant(g);
        report.cleared++;
      }
      GM.setMode("expedition");
      break;
    }
  }
};

GM.modeOnDeath = function (mon, report, ctx) {
  var s = GM.state;
  var m = s.mode;

  switch (m.id) {
    case "expedition": {
      /* Back to the first floor of the current realm — losing the realm, not
         the run. Never below where a perk says you start. */
      var realm = GM.realmOf(s.depth.current);
      var floor1 = (realm - 1) * GM.STAGES_PER_REALM + 1;
      var st = GM.stats();
      s.depth.current = Math.max(1, Math.max(floor1, 1 + (st.startStage || 0)));
      s.depth.kills = 0;
      GM.bus.emit("depth:changed");
      break;
    }

    case "exploration":
      s.depth.kills = 0;
      break;

    case "tower":
      m.towerRun = GM.towerCheckpoint();
      GM.log("Thrown from the Tower. Back to floor " + m.towerRun + ".", "tower");
      GM.bus.emit("depth:changed");
      break;

    case "dimension":
      GM.log("The dimension collapses. Roll another.", "dimension");
      m.dim = null;
      GM.setMode("expedition");
      break;

    case "finality":
      m.wave = 1;
      GM.log("Finality resets. It always does.", "finality");
      GM.bus.emit("depth:changed");
      break;

    case "vigil": {
      var g = GM.graveById(m.graveId);
      if (g) GM.reburyRevenant(g);
      GM.setMode("expedition");
      break;
    }
  }
};

/* ---------- mode helpers used by the UI ---------------------------------- */
GM.rerollDimension = function () {
  var m = GM.state.mode;
  m.dim = GM.rollDimension(Math.max(1, GM.state.depth.maxEver - 5));
  GM.fight.monster = null;
  GM.bus.emit("mode:changed", m);
  return m.dim;
};

GM.setExplorationTarget = function (stage) {
  GM.state.mode.target = GM.clamp(Math.floor(stage), 1, GM.state.depth.maxEver);
  GM.fight.monster = null;
  GM.bus.emit("mode:changed", GM.state.mode);
};

GM.beginVigil = function (graveId) {
  var g = GM.graveById(graveId);
  if (!g || g.state !== "revenant") return { ok: false, why: "Nothing is standing." };
  GM.state.mode.graveId = graveId;
  return GM.setMode("vigil");
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
  s.char.level = 1;
  s.char.xp = 0;
  s.char.gold = 0;
  s.char.shards = Math.floor(s.char.shards * 0.25);   /* a little seed capital */

  GM.SLOT_IDS.forEach(function (slot) { s.equip[slot] = null; });
  s.stash = [];
  s.tree = { points: 0, spent: [] };
  s.graves = [];

  var st = GM.derive(GM.collect({}));
  var start = Math.max(1, 1 + (st.startStage || 0));
  s.depth.current = start;
  s.depth.max = start;
  s.depth.kills = 0;

  s.mode = { id: "expedition", target: 1, dim: null };
  GM.fight.monster = null;
  s.tally.ascensions++;

  GM.invalidateStats();
  GM.log("Ascended. " + gained + " Ichor. The ground looks familiar.", "ascend");
  GM.bus.emit("ascend", { gained: gained });
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
