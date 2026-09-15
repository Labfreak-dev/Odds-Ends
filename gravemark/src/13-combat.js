/* Gravemark — 13-combat.js
   The encounter solver, now for three squads at once.

   Each squad delves independently: its own depth, its own pack, its own life
   pool. `GM.tick(dt)` advances all three, so one tick function still serves
   both live play and offline catch-up and the two cannot drift apart.

   A squad fights as one body. Its damage focuses the front monster; the whole
   surviving pack hits back into a pooled life bar. That is why the panel can
   show six monsters and one green bar without lying about the maths. */
"use strict";

GM.ELITE_CHANCE = 0.12;
GM.VICTORY_HOLD = 2.6;         /* seconds the "victorious" banner sits */

/* ---------- spawning ----------------------------------------------------- */
GM.spawnOne = function (stage, ctx) {
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
    var eliteChance = GM.ELITE_CHANCE * GM.clamp((stage - 2) / 8, 0, 1);
    kind = GM.chance(eliteChance) ? "elite" : "normal";
    if (kind === "elite") {
      hpMult = GM.CURVE.eliteHp;
      dmgMult = GM.CURVE.eliteDmg;
      resAdd = 0.10;
    }
    name = (kind === "elite" ? "Risen " : "") + arch.name;
  }

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

  var hp = GM.monHp(stage) * (arch.hp || 1) * hpMult;
  return {
    id: arch.id, name: name, kind: kind, elem: arch.elem, res: res,
    hp: hp, hpMax: hp,
    dmg: GM.monDmg(stage) * (arch.dmg || 1) * dmgMult,
    armour: GM.monArmour(stage) * armMult,
    acc: GM.monAcc(stage) * accMult,
    stage: stage
  };
};

/* A whole pack. Boss stages are a single large enemy; everything else is a
   line of them, which is what the panel draws. */
GM.spawnPack = function (stage, ctx) {
  ctx = ctx || {};
  if (ctx.revenant) {
    var g = GM.graveById(ctx.revenant);
    if (g) return [GM.revenantMonster(g)];
  }
  if (GM.isBossStage(stage) && !ctx.noBoss) return [GM.spawnOne(stage, ctx)];
  var n = ctx.single ? 1 : GM.CURVE.packSize;
  var out = [];
  for (var i = 0; i < n; i++) out.push(GM.spawnOne(stage, ctx));
  return out;
};

/* ---------- the two rates ------------------------------------------------ */
GM.dpsAgainst = function (st, mon) {
  var total = 0;
  for (var i = 0; i < GM.ELEMENTS.length; i++) {
    var e = GM.ELEMENTS[i];
    var hit = st.elemHit[e] || 0;
    if (hit <= 0) continue;
    var r = (mon.res && mon.res[e]) || 0;
    var eff = GM.clamp(r - st.pen, -1, 0.95);
    if (e === "phys") {
      var red = mon.armour / (mon.armour + 8 * Math.max(1, hit));
      eff = GM.clamp(eff + red * (1 - eff), -1, 0.95);
    }
    total += hit * (1 - eff);
  }
  return total * st.critFactor * st.attackSpeed;
};

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

/* Everything still alive in the pack hits back at once. */
GM.packIncoming = function (st, pack) {
  var t = 0;
  for (var i = 0; i < pack.length; i++) {
    if (pack[i].hp > 0) t += GM.incomingDps(st, pack[i]);
  }
  return t;
};

GM.LEECH_CAP = 0.20;
GM.leechRate = function (st, pdps) {
  return Math.min(pdps * st.leech, st.life * GM.LEECH_CAP);
};

GM.netLifeRate = function (st, incoming, pdps) {
  return st.regen + GM.leechRate(st, pdps) - incoming;
};

/* Read-only verdict for the UI: can this squad hold this depth? */
GM.forecastSquad = function (sq, stage) {
  var ctx = GM.squadCtx(sq);
  var st = GM.squadStats(sq, ctx);
  if (!st.count) return { win: false, empty: true, ttk: Infinity, ttd: 0 };
  var pack = GM.spawnPack(stage == null ? sq.stage : stage, ctx);
  var totalHp = 0, i;
  for (i = 0; i < pack.length; i++) totalHp += pack[i].hp;
  var pdps = GM.dpsAgainst(st, pack[0]);
  var incoming = GM.packIncoming(st, pack);
  var net = GM.netLifeRate(st, incoming, pdps);
  var ttk = pdps > 0 ? totalHp / pdps : Infinity;
  var ttd = net >= 0 ? Infinity : st.life / -net;
  return { ttk: ttk, ttd: ttd, win: ttk < ttd, dps: pdps, pack: pack };
};

/* ---------- per-squad fight state ---------------------------------------- */
GM.ensureSquadFight = function (sq, ctx) {
  var st = GM.squadStats(sq, ctx);
  if (!st.count) return null;

  if (sq.hpMax !== st.life) {
    var frac = sq.hpMax > 0 ? sq.hp / sq.hpMax : 1;
    sq.hpMax = st.life;
    sq.hp = st.life * GM.clamp(frac, 0, 1);
  }
  if (!sq.monsters || !sq.monsters.length) {
    sq.monsters = GM.spawnPack(GM.squadStage(sq), ctx);
    sq.packMax = sq.monsters.length;
    sq.startedAt = Date.now();
    sq.packKills = 0;
  }
  return st;
};

/* ---------- the tick -----------------------------------------------------
   `budget` is seconds of game time. Each squad gets the full budget; they run
   in parallel, not in turns. */
GM.MAX_STEPS_LIVE = 64;
GM.MAX_STEPS_OFFLINE = 20000;

GM.tick = function (budget, opts) {
  opts = opts || {};
  var report = {
    kills: 0, bosses: 0, deaths: 0, xp: 0, gold: 0, shards: 0,
    items: 0, runes: 0, equipped: 0, cleared: 0, seconds: budget,
    epitaphs: 0, best: null, bySquad: {}
  };
  var squads = GM.state.squads || [];
  for (var i = 0; i < squads.length; i++) {
    var r = GM.tickSquad(squads[i], budget, opts);
    report.bySquad[squads[i].id] = r;
    report.kills += r.kills; report.bosses += r.bosses; report.deaths += r.deaths;
    report.xp += r.xp; report.gold += r.gold; report.shards += r.shards;
    report.items += r.items; report.runes += r.runes;
    report.equipped += r.equipped; report.cleared += r.cleared;
    report.epitaphs += r.epitaphs;
    if (r.best && (!report.best || r.best.rarity >= report.best.rarity)) report.best = r.best;
  }
  if (report.kills || report.deaths || report.cleared) {
    GM.bus.emit("combat:progress", report);
  }
  return report;
};

GM.tickSquad = function (sq, budget, opts) {
  opts = opts || {};
  var report = {
    kills: 0, bosses: 0, deaths: 0, xp: 0, gold: 0, shards: 0,
    items: 0, runes: 0, equipped: 0, cleared: 0, epitaphs: 0, best: null
  };
  if (!sq.running) return report;

  var ctx = GM.squadCtx(sq);
  var maxSteps = opts.offline ? GM.MAX_STEPS_OFFLINE : GM.MAX_STEPS_LIVE;
  var left = budget;
  var steps = 0;

  while (left > 1e-6 && steps++ < maxSteps) {
    /* A cleared stage holds its banner before moving on — the "Leave"
       countdown. The hold burns GAME time, not wall-clock: counting real
       milliseconds would mean a single tick() call could never get past one
       victory, so an eight-hour offline pass would resolve exactly one pack. */
    if (sq.victory) {
      var wait = Math.min(left, sq.victory.hold);
      sq.victory.hold -= wait;
      left -= wait;
      if (sq.victory.hold <= 1e-9) GM.leaveVictory(sq);
      continue;
    }

    var st = GM.ensureSquadFight(sq, ctx);
    if (!st) return report;                 /* empty squad: nothing happens */

    var front = null;
    for (var i = 0; i < sq.monsters.length; i++) {
      if (sq.monsters[i].hp > 0) { front = sq.monsters[i]; break; }
    }
    if (!front) { GM.onStageCleared(sq, report, ctx); continue; }

    var pdps = GM.dpsAgainst(st, front);
    var incoming = GM.packIncoming(st, sq.monsters);
    var net = GM.netLifeRate(st, incoming, pdps);

    var tKill = pdps > 0 ? front.hp / pdps : Infinity;
    var tDie = net < 0 ? sq.hp / -net : Infinity;

    if (tKill === Infinity && tDie === Infinity) {
      report.stalled = true;
      left = 0;
      break;
    }

    var step = Math.min(left, tKill, tDie);
    front.hp -= pdps * step;
    sq.hp = GM.clamp(sq.hp + net * step, 0, sq.hpMax);
    left -= step;

    if (front.hp <= 1e-9) {
      front.hp = 0;
      sq.packKills = (sq.packKills || 0) + 1;
      GM.onSquadKill(sq, front, st, report, ctx);
      /* A breather between kills, so regen builds matter. */
      sq.hp = GM.clamp(sq.hp + st.regen * 0.4, 0, sq.hpMax);
    } else if (sq.hp <= 1e-9) {
      GM.onSquadWipe(sq, front, st, report, ctx);
      /* Keep going: the squad respawns at the realm floor and delves again,
         which is what makes an unattended wipe loop self-correcting rather
         than a dead stop. */
    }
  }
  return report;
};

/* ---------- kill, clear, wipe -------------------------------------------- */
GM.onSquadKill = function (sq, mon, st, report, ctx) {
  var s = GM.state;
  var stage = mon.stage;
  var mult = (ctx && ctx.rewardMult) || 1;

  report.kills++;
  s.tally.kills++;
  GM.questProgress("slay", 1);
  if (mon.kind === "boss") {
    report.bosses++; s.tally.bosses++;
    GM.questProgress("boss", 1);
  }

  var xp = GM.xpFor(stage) * (1 + st.findXP) * mult *
           (mon.kind === "boss" ? 6 : mon.kind === "elite" ? 2.2 : 1);
  GM.awardSquadXP(sq, xp);
  report.xp += xp;

  var kindDrop = mon.kind === "boss" ? 3.2 : mon.kind === "elite" ? 1.8 : mon.kind === "revenant" ? 2.5 : 1;
  var kindRune = mon.kind === "boss" ? 4   : mon.kind === "elite" ? 2   : mon.kind === "revenant" ? 3   : 1;
  var kindGold = mon.kind === "boss" ? 5   : mon.kind === "elite" ? 2   : mon.kind === "revenant" ? 3   : 1;
  var ctxFloor = (ctx && ctx.floorRarity) || 0;

  var drops = GM.rollDrops(stage, st, {
    dropMult:  kindDrop * ((ctx && ctx.dropMult) || 1),
    runeMult:  kindRune * ((ctx && ctx.runeMult) || 1),
    goldMult:  mult * kindGold,
    floorRarity: Math.max(mon.kind === "boss" ? 1 : 0, ctxFloor) || null
  });

  s.char.gold += drops.gold;
  s.char.shards += drops.shards;
  report.gold += drops.gold;
  report.shards += drops.shards;

  /* Banked on the squad so the victory banner can show the haul. */
  sq.haul = sq.haul || { gold: 0, shards: 0, items: 0, runes: 0, chests: 0 };
  sq.haul.gold += drops.gold;
  sq.haul.shards += drops.shards;

  for (var i = 0; i < drops.items.length; i++) {
    var it = drops.items[i];
    report.items++;
    sq.haul.items++;
    GM.questProgress("loot", 1);
    var res = GM.intakeItem(it, ctx, sq);
    if (res.action === "equipped") {
      report.equipped++;
      if (!report.best || it.rarity >= report.best.rarity) report.best = it;
      GM.log(res.hero.name + " equips " + GM.itemName(it) + ".", "equip");
    } else if (res.action === "stashed" && it.rarity >= 3) {
      if (!report.best || it.rarity >= report.best.rarity) report.best = it;
      GM.log("Found " + GM.itemName(it) + ".", "rare");
    }
  }

  for (i = 0; i < drops.runes.length; i++) {
    GM.addRune(drops.runes[i], 1);
    report.runes++;
    sq.haul.runes++;
    GM.questProgress("rune", 1);
    GM.log("The " + GM.RUNE_BY_ID[drops.runes[i]].name + " rune surfaces.", "rune");
  }

  if (GM.graveOnKill) GM.graveOnKill(sq, st, report, ctx);
};

GM.onStageCleared = function (sq, report, ctx) {
  report.cleared++;
  var secs = sq.startedAt ? (Date.now() - sq.startedAt) / 1000 : 0;
  sq.victory = {
    time: secs,
    kills: sq.packKills || 0,
    haul: sq.haul || { gold: 0, shards: 0, items: 0, runes: 0 },
    hold: GM.VICTORY_HOLD,
    stage: GM.squadStage(sq)
  };
  sq.haul = null;
  sq.monsters = [];
  GM.questProgress("explore", 1);
  GM.bus.emit("squad:victory", sq);
};

/* Advance past a victory banner — automatically, or from the Leave button. */
GM.leaveVictory = function (sq) {
  if (!sq.victory) return;
  sq.victory = null;
  GM.squadAdvance(sq);
  sq.monsters = [];
  GM.bus.emit("squads:changed");
};

GM.onSquadWipe = function (sq, mon, st, report, ctx) {
  report.deaths++;
  GM.state.tally.deaths++;
  GM.log(sq.name + " is broken at depth " + GM.squadStage(sq) + " by " + mon.name + ".", "death");
  if (GM.plantGrave) GM.plantGrave(sq, GM.squadStage(sq), mon);
  GM.squadRetreat(sq);
  sq.hp = sq.hpMax;
  sq.monsters = [];
  GM.bus.emit("squads:changed");
};

/* ---------- experience ---------------------------------------------------
   Split across the squad. Everyone present learns something; the split means
   a five-strong squad levels slower per head than a lone pair, which is the
   trade for their combined power. */
GM.awardSquadXP = function (sq, amount) {
  var heroes = GM.squadHeroes(sq);
  if (!heroes.length) return;
  var each = amount / heroes.length;
  for (var i = 0; i < heroes.length; i++) GM.heroGainXP(heroes[i], each);
};

GM.heroGainXP = function (hero, amount) {
  hero.xp += amount;
  var cap = GM.heroMaxLevel(hero);
  var guard = 0;
  while (hero.level < cap && hero.xp >= GM.heroXpToLevel(hero) && guard++ < 500) {
    hero.xp -= GM.heroXpToLevel(hero);
    hero.level++;
    GM.state.tree.points += GM.TREE_POINTS_PER_LEVEL;
    GM.log(hero.name + " reaches level " + hero.level + ".", "level");
    GM.bus.emit("level:changed", hero);
  }
  if (hero.level >= cap) hero.xp = 0;
  GM.state.char.level = GM.warbandLevel();
};

/* ---------- quests ------------------------------------------------------- */
GM.questProgress = function (id, n) {
  var q = GM.state.quest;
  if (!q || q.id !== id) return;
  q.done += n;
  GM.bus.emit("quest:changed", q);
};
