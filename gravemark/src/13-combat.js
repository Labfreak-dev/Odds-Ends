/* Gravemark — 13-combat.js
   The encounter solver.

   ONE tick function serves both live play and offline catch-up: `GM.tick(dt)`
   loops internally until `dt` is spent, resolving as many encounters as fit.
   Live play passes ~1/30s; offline passes hours. Online and offline therefore
   cannot drift apart, which is the usual source of "my away gains were wrong"
   bug reports in idle games. */
"use strict";

/* The live encounter. Player life carries between fights; monster life does
   not. Both are plain numbers so the whole thing survives a save. */
GM.fight = {
  monster: null,
  mhp: 0, mhpMax: 0,
  php: 1, phpMax: 1,
  elapsed: 0,
  stage: 1
};

/* ---------- spawning ----------------------------------------------------- */
GM.ELITE_CHANCE = 0.12;

GM.spawn = function (stage, ctx) {
  ctx = ctx || {};
  var realm = GM.realmOf(stage);
  var boss = GM.isBossStage(stage) && !ctx.noBoss;
  var arch, kind, hpMult = 1, dmgMult = 1, resAdd = 0, name;

  if (boss) {
    var b = GM.bossFor(realm);
    arch = { id: b.id, name: b.name, elem: b.elem, res: b.res, hp: 1, dmg: 1 };
    kind = "boss";
    hpMult = GM.CURVE.bossHp;
    dmgMult = GM.CURVE.bossDmg;
    name = b.name;
  } else {
    var pool = GM.monstersFor(realm);
    arch = GM.pickW(pool);
    /* Elites are 2.6x life and 1.35x damage. Rolling one in the opening
       minute, before the player has found anything, reads as the game being
       broken rather than as a challenge — so they ramp in over the first
       realm instead of appearing immediately. */
    var eliteChance = GM.ELITE_CHANCE * GM.clamp((stage - 2) / 8, 0, 1);
    kind = GM.chance(eliteChance) ? "elite" : "normal";
    if (kind === "elite") {
      hpMult = GM.CURVE.eliteHp;
      dmgMult = GM.CURVE.eliteDmg;
      resAdd = 0.10;
    }
    name = (kind === "elite" ? "Risen " : "") + arch.name;
  }

  /* Mutators and the season rule layer on top of the archetype. */
  var accMult = 1, armMult = 1;
  var mut = ctx.mutators || [];
  for (var i = 0; i < mut.length; i++) {
    var m = GM.MUTATOR_BY_ID[mut[i]];
    if (!m || !m.mon) continue;
    if (m.mon.hp)  hpMult  *= m.mon.hp;
    if (m.mon.dmg) dmgMult *= m.mon.dmg;
    if (m.mon.res) resAdd  += m.mon.res;
    if (m.mon.acc) accMult *= m.mon.acc;
    if (m.mon.arm) armMult *= m.mon.arm;
  }
  var rule = GM.seasonRule();
  if (rule.monDmg) dmgMult *= rule.monDmg;
  if (rule.deepScale && realm > 6) hpMult *= Math.pow(1 + rule.deepScale, realm - 6);
  if (ctx.hpMult)  hpMult  *= ctx.hpMult;
  if (ctx.dmgMult) dmgMult *= ctx.dmgMult;
  if (ctx.resAdd)  resAdd  += ctx.resAdd;

  var res = {};
  for (var k in arch.res) res[k] = arch.res[k];
  if (resAdd) {
    for (var j = 0; j < GM.ELEMENTS.length; j++) {
      var e = GM.ELEMENTS[j];
      res[e] = (res[e] || 0) + resAdd;
    }
  }

  return {
    id: arch.id, name: name, kind: kind, elem: arch.elem, res: res,
    hp: GM.monHp(stage) * (arch.hp || 1) * hpMult,
    dmg: GM.monDmg(stage) * (arch.dmg || 1) * dmgMult,
    armour: GM.monArmour(stage) * armMult,
    acc: GM.monAcc(stage) * accMult,
    stage: stage
  };
};

/* ---------- the two rates ------------------------------------------------
   Everything about whether a fight is winnable comes down to these. */

/* Player damage per second against THIS monster's resistances. */
GM.dpsAgainst = function (st, mon) {
  var total = 0;
  for (var i = 0; i < GM.ELEMENTS.length; i++) {
    var e = GM.ELEMENTS[i];
    var hit = st.elemHit[e] || 0;
    if (hit <= 0) continue;
    var r = (mon.res && mon.res[e]) || 0;
    /* Penetration reduces resistance but cannot push it below -100%. */
    var eff = GM.clamp(r - st.pen, -1, 0.95);
    if (e === "phys") {
      /* Physical is additionally reduced by monster armour, diminishing. */
      var red = mon.armour / (mon.armour + 8 * Math.max(1, hit));
      eff = GM.clamp(eff + red * (1 - eff), -1, 0.95);
    }
    total += hit * (1 - eff);
  }
  return total * st.critFactor * st.attackSpeed;
};

/* Monster damage per second actually landing on the player. */
GM.incomingDps = function (st, mon) {
  var raw = mon.dmg;
  var dodge = GM.dodgeChance(st.evasion, mon.acc);
  var afterDodge = raw * (1 - dodge);
  var e = mon.elem || "phys";
  if (e === "phys") {
    var red = st.armour / (st.armour + 10 * Math.max(1, raw));
    return afterDodge * (1 - red);
  }
  var res = GM.clamp(st.res[e] || 0, -1, GM.RES_CAP);
  return afterDodge * (1 - res);
};

/* Leech is capped as a fraction of MAXIMUM LIFE per second, not left as a
   flat fraction of damage dealt. Uncapped, leech scales with dps while
   incoming damage scales with depth, so past a certain point every build is
   immortal and defence stops being a decision. The cap is the standard ARPG
   fix and it is the single most load-bearing number in the combat model. */
GM.LEECH_CAP = 0.20;

GM.leechRate = function (st, pdps) {
  return Math.min(pdps * st.leech, st.life * GM.LEECH_CAP);
};

/* Net life change per second while fighting this monster. Positive means the
   player is winning the attrition war and cannot lose the fight. */
GM.netLifeRate = function (st, mon, pdpsIn) {
  var pdps = pdpsIn == null ? GM.dpsAgainst(st, mon) : pdpsIn;
  return st.regen + GM.leechRate(st, pdps) - GM.incomingDps(st, mon);
};

/* A read-only verdict used by the UI to show whether the current stage is
   survivable before the player walks into it. */
GM.forecast = function (stage, ctx) {
  var st = GM.stats(ctx);
  var mon = GM.spawn(stage, GM.assign({ noBoss: false }, ctx || {}));
  var pdps = GM.dpsAgainst(st, mon);
  var net = GM.netLifeRate(st, mon, pdps);
  var ttk = pdps > 0 ? mon.hp / pdps : Infinity;
  var ttd = net >= 0 ? Infinity : st.life / -net;
  return {
    monster: mon, dps: pdps, ttk: ttk, ttd: ttd,
    win: ttk < ttd, margin: ttd === Infinity ? Infinity : ttd / Math.max(0.001, ttk)
  };
};

/* ---------- the tick -----------------------------------------------------
   `budget` is seconds of game time to resolve. `maxSteps` bounds the work so
   a twelve-hour offline catch-up cannot hang the page. */
GM.MAX_STEPS_LIVE = 64;
GM.MAX_STEPS_OFFLINE = 40000;

GM.ensureFight = function (stage, ctx) {
  var f = GM.fight;
  if (!f.monster || f.stage !== stage) {
    f.monster = GM.spawn(stage, ctx);
    f.mhp = f.mhpMax = f.monster.hp;
    f.stage = stage;
    f.elapsed = 0;
  }
  var st = GM.stats(ctx);
  if (f.phpMax !== st.life) {
    /* Keep the damage taken, not the absolute number, when max life changes —
       equipping a life roll mid-fight must not be a free heal. */
    var frac = f.phpMax > 0 ? f.php / f.phpMax : 1;
    f.phpMax = st.life;
    f.php = st.life * GM.clamp(frac, 0, 1);
  }
  return f;
};

GM.tick = function (budget, opts) {
  opts = opts || {};
  var ctx = GM.modeCtx ? GM.modeCtx() : {};
  var maxSteps = opts.offline ? GM.MAX_STEPS_OFFLINE : GM.MAX_STEPS_LIVE;
  var report = {
    kills: 0, bosses: 0, deaths: 0, xp: 0, gold: 0, shards: 0,
    items: 0, runes: 0, equipped: 0, cleared: 0, seconds: 0, epitaphs: 0,
    best: null
  };

  var steps = 0;
  var left = budget;

  while (left > 1e-6 && steps++ < maxSteps) {
    var stage = GM.modeStage ? GM.modeStage() : GM.state.depth.current;
    var f = GM.ensureFight(stage, ctx);
    var st = GM.stats(ctx);
    var mon = f.monster;

    var pdps = GM.dpsAgainst(st, mon);
    var net = GM.netLifeRate(st, mon, pdps);

    /* Time until each side falls over. */
    var tKill = pdps > 0 ? f.mhp / pdps : Infinity;
    var tDie = net < 0 ? f.php / -net : Infinity;

    /* A build that can neither kill nor die would spin the loop forever.
       Treat it as a stall: burn the budget and let the UI say so. */
    if (tKill === Infinity && tDie === Infinity) {
      f.elapsed += left;
      report.seconds += left;
      report.stalled = true;
      left = 0;
      break;
    }

    var step = Math.min(left, tKill, tDie);
    f.mhp -= pdps * step;
    f.php = GM.clamp(f.php + net * step, 0, f.phpMax);
    f.elapsed += step;
    report.seconds += step;
    left -= step;

    if (f.mhp <= 1e-9) {
      GM.onKill(mon, st, report, ctx);
      f.monster = null;                 /* next loop spawns the next one */
      /* Out-of-combat regeneration between packs: a small top-up so a build
         with regen actually benefits from clearing quickly. */
      f.php = GM.clamp(f.php + st.regen * 0.5, 0, f.phpMax);
    } else if (f.php <= 1e-9) {
      GM.onDeath(mon, st, report, ctx);
      f.monster = null;
      f.php = f.phpMax;                 /* you come back whole; you come back poorer */
    }
  }

  if (report.kills || report.deaths || report.cleared) GM.bus.emit("combat:progress", report);
  return report;
};

/* ---------- kill and death ----------------------------------------------- */
GM.onKill = function (mon, st, report, ctx) {
  var s = GM.state;
  var stage = mon.stage;
  var mult = (ctx && ctx.rewardMult) || 1;

  report.kills++;
  s.tally.kills++;
  if (mon.kind === "boss") { report.bosses++; s.tally.bosses++; }

  /* xp and gold */
  var xp = GM.xpFor(stage) * (1 + st.findXP) * mult *
           (mon.kind === "boss" ? 6 : mon.kind === "elite" ? 2.2 : 1);
  GM.gainXP(xp);
  report.xp += xp;

  /* Kind multipliers and mode multipliers stack: a boss inside Finality is
     both. `floorRarity` takes whichever of the two is stricter. */
  var kindDrop = mon.kind === "boss" ? 3.2 : mon.kind === "elite" ? 1.8 : mon.kind === "revenant" ? 2.5 : 1;
  var kindRune = mon.kind === "boss" ? 4   : mon.kind === "elite" ? 2   : mon.kind === "revenant" ? 3   : 1;
  var kindGold = mon.kind === "boss" ? 5   : mon.kind === "elite" ? 2   : mon.kind === "revenant" ? 3   : 1;
  var kindFloor = mon.kind === "boss" ? 1 : null;
  var ctxFloor = (ctx && ctx.floorRarity) || null;

  var drops = GM.rollDrops(stage, st, {
    dropMult:  kindDrop * ((ctx && ctx.dropMult)  || 1),
    runeMult:  kindRune * ((ctx && ctx.runeMult)  || 1),
    goldMult:  mult * kindGold,
    shardMult: (ctx && ctx.shardMult) || 1,
    floorRarity: Math.max(kindFloor || 0, ctxFloor || 0) || null
  });

  s.char.gold += drops.gold;
  s.char.shards += drops.shards;
  report.gold += drops.gold;
  report.shards += drops.shards;

  for (var i = 0; i < drops.items.length; i++) {
    var it = drops.items[i];
    report.items++;
    var res = GM.intakeItem(it, ctx);
    if (res.action === "equipped") {
      report.equipped++;
      if (!report.best || it.rarity >= report.best.rarity) report.best = it;
      GM.log("Equipped " + GM.itemName(it) + ".", "equip");
    } else if (res.action === "stashed" && it.rarity >= 3) {
      if (!report.best || it.rarity >= report.best.rarity) report.best = it;
      GM.log("Found " + GM.itemName(it) + ".", "rare");
    }
  }

  for (i = 0; i < drops.runes.length; i++) {
    GM.addRune(drops.runes[i], 1);
    report.runes++;
    GM.log("The " + GM.RUNE_BY_ID[drops.runes[i]].name + " rune surfaces.", "rune");
  }

  /* A kill is also the chance for a gravemark of YOURS to give something up. */
  if (GM.graveOnKill) GM.graveOnKill(st, report, ctx);

  /* Pack progress. */
  if (GM.modeOnKill) GM.modeOnKill(mon, report, ctx);
};

GM.onDeath = function (mon, st, report, ctx) {
  report.deaths++;
  GM.state.tally.deaths++;
  GM.log("Killed by " + mon.name + " at depth " + mon.stage + ".", "death");
  /* The spin: dying is not purely a loss. It plants a gravemark. */
  if (GM.plantGrave) GM.plantGrave(mon.stage, mon);
  if (GM.modeOnDeath) GM.modeOnDeath(mon, report, ctx);
};

/* ---------- levelling ---------------------------------------------------- */
GM.gainXP = function (amount) {
  var c = GM.state.char;
  c.xp += amount;
  var guard = 0;
  while (c.level < GM.MAX_LEVEL && c.xp >= GM.xpToLevel(c.level) && guard++ < 500) {
    c.xp -= GM.xpToLevel(c.level);
    c.level++;
    GM.state.tree.points += GM.TREE_POINTS_PER_LEVEL;
    GM.log("Level " + c.level + ". A point to spend.", "level");
    GM.bus.emit("level:changed", c.level);
  }
  if (c.level >= GM.MAX_LEVEL) c.xp = 0;
};
