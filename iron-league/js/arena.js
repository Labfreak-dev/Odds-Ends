/* Iron League — arena autobattler. Pure step(); no DOM.
   The floor is a fixed 16:9 field in sprite pixels. A fighter's opaque
   body is BODY_H, and the short side is 12 bodies: fourteen would be
   420px, which cannot sit at 1x across a 360-wide phone once the floor
   is turned. 12 is the large end of the 1/12–1/16 band. Squads spawn
   on the far edges. The renderer shows the whole floor. */
(function (root) {
  const IL = root.IL = root.IL || {};

  const BODY_H = 30;
  const BODY_W = 24;
  const WORLD = { w: 640, h: 360, left: 20, right: 620, top: 24, bottom: 336 };
  /* v66 pace. Fights played too fast: a melee swing every ~0.7s, fighters
     crossing the pit in four seconds, rolls every seven. Eslabong's basic
     attack runs on about a one-second cooldown; these knobs bring the pit
     near that. One place to tune the whole tempo. */
  /* v67: the pit itself plays slower. tempo is the clock: at 1x the sim
     runs at 0.8 of real time, so walks, swings, casts, rolls, projectiles
     and their animations all move slower on screen. It only touches the
     live view, so fight balance is exactly the sim's. Tried slowing walk,
     turn and cast speed inside the sim instead: casters (druid, summoner)
     fell out of the win band, so the clock does it. */
  const PACE = {
    tempo: 0.8,         /* sim seconds per real second at 1x */
    move: 0.7,          /* walk and run speed (sim units) */
    turn: 820,          /* steering acceleration */
    roll: 1,            /* roll travel speed */
    castTime: 1,        /* cast wind-up scale */
    meleeRecover: 0.62, /* after a melee swing (was 0.18) */
    kiteRecover: 1.0,   /* after a shot (was 0.55) */
    castRecover: 1.5,   /* after a cast (was 1.15) */
    abilityCd: 1.2,     /* every move's cooldown */
    rollCd: 4.2,        /* between rolls (was 2.7) */
    rollChance: 0.55,   /* share of seen threats that get a roll (was 0.8) */
    dash: 0.8           /* dash speed */
  };

  function kitOf(cls) {
    return IL.CLASSES[cls] || IL.CLASSES.warrior;
  }

  function hangsBack(role) {
    return role === "kite" || role === "cast" || role === "support";
  }

  /* v97 front and back are the distance from the left edge; gap is the
     spacing down the line. "line" matches placeUnit's default. */
  const FORMATIONS = {
    line: { name: "Line", front: 68, back: 18, gap: 36, blurb: "The usual rank: front line a step ahead, back line on the edge." },
    spear: { name: "Spearhead", front: 120, back: 18, gap: 30, blurb: "The front line starts 52 px further forward and reaches the enemy first. The back line is left more open." },
    spread: { name: "Spread", front: 68, back: 18, gap: 70, blurb: "Twice the spacing down the line, so area moves catch fewer of you." },
    wall: { name: "Shield wall", front: 44, back: 6, gap: 26, blurb: "A tight rank, the front line close in front of the back line to guard it." }
  };

  function scaleFoe(u, mul) {
    u.maxHp = Math.round(u.maxHp * mul);
    u.hp = u.maxHp;
    u.atk = Math.round(u.atk * mul);
  }

  function placeUnit(team, slot, n, teams, role) {
    const midY = (WORLD.top + WORLD.bottom) / 2;
    const midX = (WORLD.left + WORLD.right) / 2;
    const spanX = WORLD.right - WORLD.left;
    const spanY = WORLD.bottom - WORLD.top;
    if (!teams || teams <= 2) {
      /* Melee steps off the edge. Ranged, casters, and supports stay on it.
         The line is a tight rank, not three lanes, so the front actually
         stands between the back line and the other team. */
      const depth = hangsBack(role) ? 18 : 68;
      const x = team === 0 ? WORLD.left + depth : WORLD.right - depth;
      const yGap = 36;
      let y = midY + (slot - (n - 1) / 2) * yGap;
      if (y < WORLD.top + 10) y = WORLD.top + 10;
      if (y > WORLD.bottom - 10) y = WORLD.bottom - 10;
      return { x: x, y: y };
    }
    const ang = -Math.PI / 2 + (team / teams) * Math.PI * 2;
    return {
      x: midX + Math.cos(ang) * spanX * 0.46 + (slot - (n - 1) / 2) * 20,
      y: midY + Math.sin(ang) * spanY * 0.42 + (slot - (n - 1) / 2) * 14
    };
  }

  /* Distance between team centers along the long axis, as a fraction of it. */
  function teamSpread(units) {
    const buckets = {};
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      if (!u || u.summon) continue;
      if (!buckets[u.team]) buckets[u.team] = { n: 0, x: 0 };
      buckets[u.team].n += 1;
      buckets[u.team].x += u.x;
    }
    const means = [];
    Object.keys(buckets).forEach(function (k) {
      if (buckets[k].n) means.push(buckets[k].x / buckets[k].n);
    });
    if (means.length < 2) return 1;
    means.sort(function (a, b) { return a - b; });
    return (means[means.length - 1] - means[0]) / WORLD.w;
  }

  function scaledStats(fighter, kit) {
    const lv = fighter.level || 1;
    const b = fighter.boosts || {};
    /* Per-level growth stays 8% health and 6% attack: flatter rates broke the
       class win band. v65 slows growth through the xp curve instead. */
    /* v94 growth grades scale each stat's growth per level: Balanced x1.0,
       Good x1.3, Excellent x1.6. Defense and speed only grow when graded. */
    const gm = IL.gradeMul || function () { return 1; };
    const gDef = { B: 0, G: 0.12, E: 0.24 }[(IL.gradeOf ? IL.gradeOf(fighter, "def") : "B")] || 0;
    const gSpd = { B: 0, G: 0.003, E: 0.006 }[(IL.gradeOf ? IL.gradeOf(fighter, "spd") : "B")] || 0;
    let hp = kit.hp * (1 + (lv - 1) * 0.08 * gm(fighter, "hp")) * (1 + (b.hp || 0) * 0.08);
    let atk = kit.atk * (1 + (lv - 1) * 0.06 * gm(fighter, "atk")) * (1 + (b.dmg || 0) * 0.08);
    let def = kit.def + (b.def || 0) * 2 + (lv - 1) * gDef;
    let speed = kit.speed * (1 + (b.spd || 0) * 0.06) * (1 + (lv - 1) * gSpd);
    if (fighter.champion) { hp *= 1.14; atk *= 1.12; }
    if (fighter.shiny) { hp *= 1.2; atk *= 1.2; }
    const rarityStat = { common: 1, uncommon: 1.04, rare: 1.08, legendary: 1.12 }[fighter.rarity];
    if (rarityStat) { hp *= rarityStat; atk *= rarityStat; }
    const spec = IL.combatSpecialty ? IL.combatSpecialty(fighter) : (IL.specialtyOf && fighter.specialty ? IL.specialtyOf(fighter.specialty) : null);
    if (spec) {
      hp += spec.hp || 0;
      atk += spec.atk || 0;
      def += spec.def || 0;
      speed += spec.spd || 0;
    }
    /* v110 later masteries stack on top of the first. */
    (Array.isArray(fighter.masteries) ? fighter.masteries : []).forEach(function (id) {
      const mm = IL.masteryOf ? IL.masteryOf(id) : null;
      if (!mm) return;
      hp += mm.hp || 0; atk += mm.atk || 0; def += mm.def || 0; speed += mm.spd || 0;
    });
    const mastery = IL.masteryOf && fighter.mastery ? IL.masteryOf(fighter.mastery) : null;
    if (mastery) {
      hp += mastery.hp || 0;
      atk += mastery.atk || 0;
      def += mastery.def || 0;
      speed += mastery.spd || 0;
    }
    const drills = IL.drillBonus ? IL.drillBonus(fighter) : null;
    if (drills) {
      hp += drills.hp || 0;
      atk += drills.atk || 0;
      def += drills.def || 0;
      speed += drills.spd || 0;
    }
    const gear = IL.gearBonus ? IL.gearBonus(fighter) : null;
    if (gear) {
      hp += gear.hp || 0;
      atk += gear.atk || 0;
      def += gear.def || 0;
      speed += gear.spd || 0;
    }
    const rolls = fighter.rolls;
    if (rolls && IL.ROLL_VALUE) {
      hp += kit.hp * IL.ROLL_VALUE.hp * (rolls.hp || 0);
      atk += kit.atk * IL.ROLL_VALUE.atk * (rolls.atk || 0);
      def += IL.ROLL_VALUE.def * (rolls.def || 0);
      speed += kit.speed * IL.ROLL_VALUE.spd * (rolls.spd || 0);
    }
    (fighter.talents || []).forEach(function (t) {
      if (!IL.talentValue) return;
      if (t.id === "ironhide") def += IL.talentValue(t.id, t.tier);
      if (t.id === "fleet") speed *= 1 + IL.talentValue(t.id, t.tier) / 100;
    });
    const tire = IL.staminaMul ? IL.staminaMul(fighter) : 1;
    if (tire < 1) { hp *= tire; atk *= tire; }
    if (fighter.injury && fighter.injury.weeks > 0) { hp *= 0.85; atk *= 0.85; }
    return {
      hp: Math.round(hp),
      atk: Math.round(atk),
      def: def,
      speed: speed
    };
  }

  function makeUnit(fighter, team, slot, n, teams) {
    const kit = kitOf(fighter.cls);
    const lv = fighter.level || 1;
    const stats = scaledStats(fighter, kit);
    const pos = placeUnit(team, slot, n, teams, kit.role);
    const u = {
      id: fighter.id || ("u" + team + slot),
      name: fighter.name || "Fighter",
      cls: kit.id,
      team: team,
      parts: fighter.parts,
      level: lv,
      champion: !!fighter.champion,
      personality: fighter.personality || "bold",
      tactic: fighter.tactic || "strike",
      ai: IL.aiFor ? IL.aiFor(fighter) : IL.normAi ? IL.normAi(fighter.ai) : { target: "near", range: "kit", ult: "ready", retreat: "never", evade: "normal" },
      captain: !!fighter.captain,
      ranks: fighter.ranks && typeof fighter.ranks === "object" ? fighter.ranks : {},
      specs: fighter.specs && typeof fighter.specs === "object" ? fighter.specs : {},
      thorns: 0,
      bloodlust: 0,
      vuln: 0,
      vulnAmt: 0,
      tgtId: null,
      x: pos.x,
      y: pos.y,
      homeX: pos.x,
      homeY: pos.y,
      vx: 0,
      vy: 0,
      z: 0,
      vz: 0,
      facing: team === 0 ? 1 : -1,
      hp: stats.hp,
      maxHp: stats.hp,
      boss: !!fighter.boss,
      atk: stats.atk,
      def: stats.def,
      speed: stats.speed,
      radius: kit.radius,
      bossPhase: fighter.boss ? 1 : 0,
      range: kit.range,
      role: kit.role,
      attacks: (kit.attacks || ["atk1"]).slice(),
      airs: (kit.airs || []).slice(),
      casts: (kit.casts || ["cast1"]).slice(),
      leaps: !!kit.leaps,
      castTime: (kit.castTime || 0.95) * PACE.castTime,
      castRadius: kit.castRadius || 74,
      atkCursor: 0,
      castCursor: 0,
      state: "idle",
      anim: kit.idle || "idle",
      animT: slot * 0.17,
      actT: 0,
      cool: 0.2 + slot * 0.08,
      dashCd: 0.55,
      rollCd: 0.7 + slot * 0.15,
      sawThreat: false,
      leapCd: 1.1 + slot * 0.25,
      blockCd: 0.7 + slot * 0.15,
      hurtCd: 0,
      iframe: 0,
      flash: 0,
      didHit: false,
      didSlash: false,
      fxT: 0,
      leapPhase: null,
      trail: null,
      cast: null,
      alive: true,
      abilityCd: 0.9 + slot * 0.12,
      abilityCdMul: 1,
      cds: {},
      stun: 0,
      buff: 0,
      buffAtk: 1,
      summon: !!fighter.summon,
      taunt: 0,
      rage: 0,
      slow: 0,
      bleed: null,
      shield: 0,
      crit: 0,
      critNext: false,
      riposte: false,
      pierce: kit.pierce || 0,
      regen: 0,
      bounty: 0,
      wind: false,
      windUsed: false,
      cleave: false,
      volley: 0,
      dashDmg: 1,
      guardZone: false,
      kos: 0,
      dmgDealt: 0,
      dmgTaken: 0,
      healing: 0
    };
    (fighter.talents || []).forEach(function (t) {
      if (!IL.talentValue) return;
      const v = IL.talentValue(t.id, t.tier);
      if (t.id === "keen") u.crit += v / 100;
      else if (t.id === "vigor") u.regen += v;
      else if (t.id === "thorns") u.thorns += v / 100;
      else if (t.id === "bloodlust") u.bloodlust += v / 100;
    });
    u.weaponKind = IL.weaponKind ? IL.weaponKind(fighter) : null;
    const pass = IL.gearPassives ? IL.gearPassives(fighter) : null;
    if (pass) {
      if (pass.crit) u.crit += pass.crit;
      if (pass.shield) u.shield += pass.shield;
      if (pass.regen) u.regen += pass.regen;
    }
    const abs = kit.abilities || (kit.ability ? [kit.ability] : []);
    if (!fighter.summon && IL.ensureMoves) IL.ensureMoves(fighter);
    u.loadout = fighter.summon ? [] : (fighter.loadout || []).slice();
    u.learned = fighter.summon ? [] : (fighter.learned || []).slice();
    u.motion = null;
    const byAb = {};
    for (let i = 0; i < abs.length; i++) if (abs[i] && abs[i].id) byAb[abs[i].id] = abs[i];
    const seedIds = u.loadout.length
      ? u.loadout
      : abs.filter(function (ab) { return ab && ab.unlock && ab.unlock <= 7; }).map(function (ab) { return ab.id; });
    for (let i = 0; i < seedIds.length; i++) {
      const ab = byAb[seedIds[i]];
      if (ab && ab.id) u.cds[ab.id] = 0.45 + slot * 0.12 + i * 0.2;
    }
    if (fighter.tonic && IL.tonicShield) {
      u.shield += IL.tonicShield(fighter.tonic);
      fighter.tonic = null;
    }
    /* v88 class passive numbers (kits.js PASSIVE_FX). Summons get none. */
    u.pv = (!fighter.summon && kit.passive && kit.passive.fx) || {};
    /* v94: a champion also carries a second class's passive. */
    if (!fighter.summon && fighter.champPassive) {
      const extra = Object.keys(IL.CLASSES).map(function (id) { return IL.CLASSES[id].passive; }).filter(function (p) { return p && p.id === fighter.champPassive && p.fx; })[0];
      if (extra) u.pv = Object.assign({}, extra.fx, u.pv);
    }
    if (u.pv.range) u.range *= 1 + u.pv.range;
    if (u.pv.cdCut) u.abilityCdMul *= 1 - u.pv.cdCut;
    u.feintT = 0;
    u.firstShotDone = false;
    /* v111 a champion's signature move, an extra move at rank 4. */
    const champMove = !fighter.summon && IL.championMove ? IL.championMove(fighter) : null;
    if (champMove) {
      u.grantAbs = (u.grantAbs || []).concat([champMove]);
      u.cds[champMove.id] = 3;
      u.ranks = Object.assign({}, u.ranks);
      u.ranks[champMove.id] = 4;
    }
    /* v113 Hall of Legends and Tower foes carry a strength multiplier. */
    if (fighter.hallMul && fighter.hallMul !== 1) { u.maxHp = Math.round(u.maxHp * fighter.hallMul); u.hp = u.maxHp; u.atk = Math.round(u.atk * fighter.hallMul); }
    /* v109 personality passives. */
    const persona = !fighter.summon && IL.PERSONAS && IL.PERSONAS[u.personality];
    u.persona = persona ? persona.fx : {};
    u.mRushT = 4;
    if (u.persona.hp) { u.maxHp = Math.round(u.maxHp * (1 + u.persona.hp)); u.hp = u.maxHp; }
    if (u.persona.atk) u.atk = Math.round(u.atk * (1 + u.persona.atk));
    if (u.persona.def) u.def = Math.max(0, u.def + u.persona.def);
    if (u.persona.crit) u.crit += u.persona.crit;
    if (u.persona.cd) u.abilityCdMul *= 1 - u.persona.cd;
    /* v96 evolved moves: { moveId: "root" | "drain" | "chain" | "silence" | "lasting" | "shared" }. */
    u.evos = !fighter.summon && fighter.evos && typeof fighter.evos === "object" ? Object.assign({}, fighter.evos) : null;
    return u;
  }

  /* v95 numbers come from IL.relicNums (meta.js), the same table the
     relic text reads. */
  function applyRelics(u, relics) {
    for (let i = 0; i < relics.length; i++) {
      const r = relics[i];
      if (!r) continue;
      const n = IL.relicNums ? IL.relicNums(r) : {};
      if (r.kind === "hp") {
        u.maxHp = Math.round(u.maxHp * (1 + n.hp / 100));
        u.hp = u.maxHp;
      } else if (r.kind === "crit") u.crit += n.crit / 100;
      else if (r.kind === "shield") u.shield += Math.round(u.maxHp * n.shield / 100);
      else if (r.kind === "haste") {
        u.castTime *= (1 - n.cast / 100);
        u.abilityCdMul *= (1 - n.cd / 100);
      } else if (r.kind === "bounty") u.bounty += n.gold;
      else if (r.kind === "regen") u.regen += n.regen;
      else if (r.kind === "pierce") u.pierce += n.pierce;
      else if (r.kind === "wind") u.wind = Math.max(u.wind || 0, n.heal / 100);
      else if (r.kind === "speed") u.speed *= (1 + n.spd / 100);
      else if (r.kind === "glass") {
        u.atk = Math.round(u.atk * (1 + n.atk / 100));
        u.def = Math.max(0, u.def - n.def);
      } else if (r.kind === "sand") u.abilityCdMul *= (1 - n.cd / 100);
      else if (r.kind === "atk") u.atk = Math.round(u.atk * (1 + n.atk / 100));
      else if (r.kind === "def") u.def += n.def;
      else if (r.kind === "revive") u.revive = Math.max(u.revive || 0, n.hp / 100);
      else if (r.kind === "lifesteal") u.lifesteal = (u.lifesteal || 0) + n.pct / 100;
      else if (r.kind === "reflect") u.reflect = (u.reflect || 0) + n.pct / 100;
      else if (r.kind === "blink") u.blink = { left: n.n, cd: 0, gap: n.cd, at: n.at / 100, dist: n.dist, guard: n.guard };
      else if (r.kind === "grant" && !u.summon && IL.grantAbility) {
        const g = IL.grantAbility(n.grant);
        if (!g) continue;
        if (!u.grantAbs) u.grantAbs = [];
        const mine = (kitOf(u.cls).abilities || []).some(function (ab) { return ab && ab.id === g.ab.id; });
        if (mine || u.grantAbs.some(function (ab) { return ab.id === g.ab.id; })) continue;
        u.grantAbs.push(g.ab);
        u.cds[g.ab.id] = 2 + u.grantAbs.length;
      }
    }
  }

  function unitSource(opts, unit) {
    const lists = [];
    if (opts.sides) {
      opts.sides.forEach(function (side) { (side.fighters || []).forEach(function (f) { lists.push(f); }); });
    } else {
      (opts.left || []).forEach(function (f) { lists.push(f); });
      (opts.right || []).forEach(function (f) { lists.push(f); });
    }
    for (let i = 0; i < lists.length; i++) if (lists[i] && lists[i].id === unit.id) return lists[i];
    return null;
  }

  function applyWaveMod(units, mod) {
    if (!mod) return;
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      if (mod.id === "glass") {
        u.atk = Math.round(u.atk * 1.12);
        u.def = Math.max(0, u.def - 2);
      } else if (mod.id === "haste") {
        u.speed *= 1.1;
      } else if (mod.id === "bulwark") {
        u.def += 3;
      } else if (mod.id === "hunger" && u.team !== 0) {
        u.maxHp = Math.round(u.maxHp * 1.15);
        u.hp = u.maxHp;
      } else if (mod.id === "gold" && u.team === 0) {
        u.bounty += 8;
      } else if (mod.id === "giant") {
        u.maxHp = Math.round(u.maxHp * 1.3);
        u.hp = u.maxHp;
        u.radius = (u.radius || 16) + 6;
        u.atk = Math.round(u.atk * 1.06);
        u.giant = true;
      }
    }
  }

  function tickBoss(m) {
    if (m.mode !== "boss" || !m.bossAdds) return;
    for (let i = 0; i < m.units.length; i++) {
      const u = m.units[i];
      if (!u.boss || u.hp <= 0) continue;
      const frac = u.maxHp ? u.hp / u.maxHp : 1;
      const phase = frac <= 0.34 ? 3 : frac <= 0.67 ? 2 : 1;
      if ((u.bossPhase || 1) >= phase) continue;
      u.bossPhase = phase;
      u.atk = Math.round(u.atk * 1.12);
      const tmpl = m.bossAdds[phase - 2];
      if (!tmpl) continue;
      const add = makeUnit(tmpl, u.team, 1, 1, m.teams || 2);
      if (m.foeMul && m.foeMul !== 1 && add.team !== 0) scaleFoe(add, m.foeMul);
      add.maxHp = Math.round(add.maxHp * 0.6);
      add.hp = add.maxHp;
      if (m.hazard) applyWaveMod([add], { id: m.hazard });
      add.x = u.x + (phase === 2 ? -50 : 50);
      add.y = u.y + 36;
      if (m.spriteMap && tmpl.parts && IL.hero && IL.hero.keyOf) add.sprite = m.spriteMap[IL.hero.keyOf(tmpl.parts)];
      m.units.push(add);
    }
  }

  function tryNextWave(m) {
    const pack = m.horde || m.king;
    if (!pack || pack.done) return false;
    if (!living(m, 0).length || living(m, 1).length) return false;
    pack.cleared = (pack.cleared || 0) + 1;
    if (pack.next >= (pack.waves || []).length) {
      pack.done = true;
      return false;
    }
    const list = pack.waves[pack.next];
    pack.next += 1;
    m.units = m.units.filter(function (u) { return u.team !== 1 || u.hp > 0; });
    (list || []).forEach(function (f, i) {
      const add = makeUnit(f, 1, i, list.length, m.teams || 2);
      if (m.foeMul && m.foeMul !== 1) scaleFoe(add, m.foeMul);
      if (m.hazard) applyWaveMod([add], { id: m.hazard });
      if (m.spriteMap && f.parts && IL.hero && IL.hero.keyOf) add.sprite = m.spriteMap[IL.hero.keyOf(f.parts)];
      m.units.push(add);
    });
    return true;
  }

  function applySideRelics(units, team, relics, worn) {
    const list = relics || [];
    const map = worn || {};
    if (!list.length && !Object.keys(map).length) return;
    for (let i = 0; i < units.length; i++) {
      if (units[i].team !== team) continue;
      const pack = list.slice();
      const one = map[units[i].id];
      if (Array.isArray(one)) one.forEach(function (r) { if (r) pack.push(r); });
      else if (one) pack.push(one);
      if (pack.length) applyRelics(units[i], pack);
    }
  }

  function createMatch(opts) {
    const units = [];
    let teams = 2;
    let names = [opts.leftName || "Your club", opts.rightName || "Rivals"];
    if (opts.sides && opts.sides.length >= 2) {
      teams = opts.sides.length;
      names = opts.sides.map(function (s) { return s.name || "Club"; });
      opts.sides.forEach(function (side, team) {
        const list = side.fighters || [];
        list.forEach(function (f, i) { units.push(makeUnit(f, team, i, list.length, teams)); });
      });
    } else {
      const left = opts.left || [];
      const right = opts.right || [];
      left.forEach(function (f, i) { units.push(makeUnit(f, 0, i, left.length, 2)); });
      right.forEach(function (f, i) { units.push(makeUnit(f, 1, i, right.length, 2)); });
    }
    /* v97 formations for the left team (two-team fights): where each
       fighter starts, which is also where it falls back to. */
    if (opts.formation && teams <= 2 && FORMATIONS[opts.formation]) {
      const fm = FORMATIONS[opts.formation];
      const mine = units.filter(function (u) { return u.team === 0; });
      const midY = (WORLD.top + WORLD.bottom) / 2;
      mine.forEach(function (u, i) {
        const back = hangsBack(u.role);
        const x = WORLD.left + (back ? fm.back : fm.front);
        let y = midY + (i - (mine.length - 1) / 2) * fm.gap;
        y = Math.max(WORLD.top + 10, Math.min(WORLD.bottom - 10, y));
        u.x = x; u.y = y; u.homeX = x; u.homeY = y;
      });
    }
    /* v107 difficulty: rivals' HP and ATK, and a captain bonus in autobattle. */
    if (opts.foeMul && opts.foeMul !== 1) units.forEach(function (u) { if (u.team !== 0) scaleFoe(u, opts.foeMul); });
    if (opts.capBonus > 0) units.forEach(function (u) {
      if (u.team !== 0 || !u.captain) return;
      u.maxHp = Math.round(u.maxHp * (1 + opts.capBonus)); u.hp = u.maxHp; u.atk = Math.round(u.atk * (1 + opts.capBonus));
    });
    /* v101 Captain Coach staff. */
    if (opts.captainBoost > 0) {
      units.forEach(function (u) {
        if (u.team !== 0 || !u.captain) return;
        u.maxHp = Math.round(u.maxHp * (1 + opts.captainBoost));
        u.hp = u.maxHp;
        u.atk = Math.round(u.atk * (1 + opts.captainBoost));
      });
    }
    if (opts.foeFormation && teams <= 2 && FORMATIONS[opts.foeFormation]) {
      const ff = FORMATIONS[opts.foeFormation];
      const theirs = units.filter(function (u) { return u.team === 1; });
      const midY2 = (WORLD.top + WORLD.bottom) / 2;
      theirs.forEach(function (u, i) {
        const x = WORLD.right - (hangsBack(u.role) ? ff.back : ff.front);
        let y = midY2 + (i - (theirs.length - 1) / 2) * ff.gap;
        y = Math.max(WORLD.top + 10, Math.min(WORLD.bottom - 10, y));
        u.x = x; u.y = y; u.homeX = x; u.homeY = y;
      });
    }
    const relics = (opts.relics || []).slice();
    (opts.setRelics || []).forEach(function (r) { if (r) relics.push(r); });
    applySideRelics(units, 0, relics, opts.wornRelics || {});
    applySideRelics(units, 1, opts.foeRelics || [], opts.foeWorn || {});
    /* v93 season modifiers ride on league, cup and Champions Cup matches. */
    const mods = {};
    (opts.mods || []).forEach(function (id) { mods[id] = true; });
    units.forEach(function (u) {
      if (mods.iron) u.def += 3;
      if (mods.swift) u.speed *= 1.12;
      if (mods.keen) u.crit += 0.06;
      if (mods.storm) u.stormCd = 0.8;
    });
    /* v88 team passives: set once at the start, for the whole fight. */
    units.forEach(function (src) {
      if (!src.pv || (!src.pv.teamDmg && !src.pv.teamRegen)) return;
      units.forEach(function (ally) {
        if (ally.team !== src.team) return;
        if (src.pv.teamDmg) ally.teamDmg = (ally.teamDmg || 0) + src.pv.teamDmg;
        if (src.pv.teamRegen) ally.regen = (ally.regen || 0) + src.pv.teamRegen;
      });
    });
    applySynergy(units);
    if (opts.mod) applyWaveMod(units, opts.mod);
    for (let i = 0; i < units.length; i++) {
      const src = unitSource(opts, units[i]);
      if (src && src.boss) {
        units[i].boss = true;
        units[i].bossPhase = 1;
        units[i].maxHp = Math.round(units[i].maxHp * 2.6);
        units[i].hp = units[i].maxHp;
        units[i].atk = Math.round(units[i].atk * 1.18);
        units[i].radius = (units[i].radius || 16) + 8;
      }
      if (src && typeof src.hpFrac === "number") {
        const frac = Math.max(0, Math.min(1, src.hpFrac));
        units[i].hp = Math.max(1, Math.round(units[i].maxHp * frac));
      }
    }
    const kills = [];
    for (let t = 0; t < teams; t++) kills.push(0);
    return {
      foeMul: opts.foeMul || 1,
      seed: opts.seed >>> 0,
      rng: IL.mulberry32(opts.seed >>> 0 || 1),
      leftName: names[0],
      rightName: names[1] || "Rivals",
      names: names,
      teams: teams,
      mode: opts.mode || "league",
      hazard: (opts.mod && opts.mod.id) || "",
      hazardName: (opts.mod && opts.mod.name) || "",
      hazardBlurb: (opts.mod && opts.mod.blurb) || "",
      horde: opts.horde || null,
      king: opts.king || null,
      bossAdds: opts.bossAdds || null,
      mods: mods,
      suddenAt: mods.fuse ? 30 : SUDDEN_AT,
      units: units,
      shots: [],
      events: [],
      time: 0,
      engage: 0.3,
      engageMax: 0.3,
      spawnSpread: teamSpread(units),
      pit: (opts.seed >>> 0) % 5,
      zoom: 0,
      cheer: 0,
      slowmo: 0,
      hitstop: 0,
      ending: false,
      endDelay: 0,
      over: false,
      winner: null,
      kills: kills,
      stats: {
        hits: 0, shots: 0, casts: 0, cast2: 0, blocks: 0, dashes: 0,
        rolls: 0, dodges: 0, leaps: 0, airs: 0, slashes: 0, deaths: 0, whiffs: 0,
        abilities: 0, heals: 0, cleaves: 0, bleeds: 0, bounty: 0
      }
    };
  }

  function living(m, team) {
    return m.units.filter(u => u.team === team && u.hp > 0 && !u.summon);
  }

  function applySynergy(units) {
    const traits = IL.TRAITS || {};
    const teams = {};
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      if (u.summon) continue;
      if (!teams[u.team]) teams[u.team] = [];
      teams[u.team].push(u);
    }
    Object.keys(teams).forEach(function (key) {
      const side = teams[key];
      const counts = {};
      side.forEach(function (u) {
        const id = kitOf(u.cls).trait;
        if (id) counts[id] = (counts[id] || 0) + 1;
      });
      function on(id) {
        const def = traits[id];
        return def && (counts[id] || 0) >= (def.need || 2);
      }
      if (on("arcane")) side.forEach(function (u) {
        if (u.role === "cast" || u.role === "hybrid") u.atk = Math.round(u.atk * 1.08);
      });
      if (on("guardian")) side.forEach(function (u) {
        u.shield += Math.round(u.maxHp * 0.08);
      });
      if (on("blade")) side.forEach(function (u) {
        if (u.role === "melee" || u.role === "dash" || u.role === "tank") u.atk = Math.round(u.atk * 1.06);
      });
      if (on("mark")) side.forEach(function (u) {
        if (u.role === "kite") u.range += 18;
      });
      if (on("wild")) side.forEach(function (u) { u.regen += 1.1; });
      if (on("oath")) side.forEach(function (u) { u.oath = true; });
    });
  }

  function nearest(m, u, plain) {
    let best = null;
    let bestD = 1e9;
    let taunter = null;
    let tauntD = 1e9;
    for (let i = 0; i < m.units.length; i++) {
      const e = m.units[i];
      if (e.team === u.team || e.hp <= 0) continue;
      const d = Math.hypot(e.x - u.x, e.y - u.y);
      if (e.taunt > 0 && d < tauntD) { tauntD = d; taunter = e; }
      if (d < bestD) { bestD = d; best = e; }
    }
    if (u.tactic === "cover") {
      let ward = null;
      let wardHp = 1e9;
      for (let i = 0; i < m.units.length; i++) {
        const a = m.units[i];
        if (a.team !== u.team || a.hp <= 0 || a === u) continue;
        if (a.hp / a.maxHp < wardHp) { wardHp = a.hp / a.maxHp; ward = a; }
      }
      if (ward) {
        const foe = nearestEnemyOf(m, ward, u.team);
        if (foe) return foe;
      }
    }
    if (taunter && u.tactic !== "hold" && tauntD < bestD * 1.85) return taunter;
    const pref = preferred(m, u);
    if (pref) return pref;
    return (!plain && smartPick(m, u, best, bestD)) || best;
  }

  /* v92 autobattle targeting, after Eslabong's tactics defaults. Among the
     enemies not much farther than the nearest, prefer one the team is
     already hitting (focus fire), one nearly down (finish it), a caster
     mid-spell (interrupt it), and, for front-liners, whoever is on top of
     our back line (peel). Summons come last. A personality's mistake
     chance sometimes skips all this and takes the nearest. */
  function smartPick(m, u, nearestFoe, nearD) {
    if (!nearestFoe || u.summon) return null;
    if (mistake(m, u)) return null;
    const front = u.role === "tank" || u.role === "melee" || u.role === "hybrid";
    const diver = u.role === "dash";
    let pick = null;
    let score = -1e9;
    for (let i = 0; i < m.units.length; i++) {
      const e = m.units[i];
      if (e.team === u.team || e.hp <= 0) continue;
      const d = Math.hypot(e.x - u.x, e.y - u.y);
      if (d > nearD + 120) continue;
      let sc = -d;
      let focus = 0;
      for (let j = 0; j < m.units.length; j++) {
        const a = m.units[j];
        if (a !== u && a.team === u.team && a.hp > 0 && a.tgtId === e.id) focus++;
      }
      sc += Math.min(2, focus) * 34;
      if (e.hp / e.maxHp < 0.3) sc += 46;
      if (e.state === "cast") sc += front || diver ? 34 : 14;
      /* Rogues dive the back line. */
      if (diver && (e.role === "support" || e.role === "cast" || e.role === "kite")) sc += 50;
      if (front) {
        for (let j = 0; j < m.units.length; j++) {
          const a = m.units[j];
          if (a.team !== u.team || a.hp <= 0 || a.summon || a === u) continue;
          if (!(a.role === "support" || a.role === "cast" || a.role === "kite")) continue;
          if (Math.hypot(e.x - a.x, e.y - a.y) < 110) { sc += 60; break; }
        }
      }
      if (e.summon) sc -= 70;
      if (sc > score) { score = sc; pick = e; }
    }
    return pick;
  }

  /* Hidden mistake chance by personality (Eslabong: Tactician 2% ...
     Reckless 25%). Bold fighters slip the most. */
  const MISTAKE = { bold: 0.1, wary: 0.05, patient: 0.03 };
  function mistake(m, u) {
    const pe = IL.PERSONAS && IL.PERSONAS[u.personality];
    const p = pe ? pe.mistake : MISTAKE[u.personality] != null ? MISTAKE[u.personality] : 0.05;
    return m.rng() < p * 0.25;
  }

  /* An enemy spell is about to land where this fighter stands: the centre
     to walk away from, or null. */
  function castDanger(m, u) {
    for (let i = 0; i < m.units.length; i++) {
      const e = m.units[i];
      if (e.team === u.team || e.hp <= 0 || !e.cast || e.state !== "cast") continue;
      const c = e.cast;
      if (c.kind === "mend" || !c.ability) continue;
      const d = Math.hypot(u.x - c.x, u.y - c.y);
      if (d <= (c.r || 70) + u.radius * 0.4 + 10) return { x: c.x, y: c.y, d: d, r: c.r || 70 };
    }
    return null;
  }

  /* Enemies inside r of a point. */
  function crowdAt(m, u, x, y, r) {
    let n = 0;
    for (let i = 0; i < m.units.length; i++) {
      const e = m.units[i];
      if (e.team === u.team || e.hp <= 0 || e.summon) continue;
      if (Math.hypot(e.x - x, e.y - y) <= r + (e.radius || 12) * 0.4) n++;
    }
    return n;
  }

  function foesLeft(m, u) {
    let n = 0;
    for (let i = 0; i < m.units.length; i++) {
      const e = m.units[i];
      if (e.team !== u.team && e.hp > 0 && !e.summon) n++;
    }
    return n;
  }

  function unitById(m, id) {
    if (!id) return null;
    for (let i = 0; i < m.units.length; i++) if (m.units[i].id === id) return m.units[i];
    return null;
  }

  /* The sheet's Target row. "near" returns null so nearest() keeps the
     old pick and an untouched fighter fights exactly as before. */
  function preferred(m, u) {
    const want = u.ai && u.ai.target;
    if (!want || want === "near") return null;
    if (want === "captain") {
      if (m.pilot && !m.pilot.auto && m.pilot.targetId && u.team === 0) {
        const pt = unitById(m, m.pilot.targetId);
        if (pt && pt.hp > 0 && pt.team !== u.team) return pt;
      }
      for (let i = 0; i < m.units.length; i++) {
        const c = m.units[i];
        if (c === u || c.team !== u.team || !c.captain || c.hp <= 0) continue;
        const ct = unitById(m, c.tgtId);
        if (ct && ct.hp > 0 && ct.team !== u.team) return ct;
      }
      return null;
    }
    let pick = null;
    let score = -1e9;
    for (let i = 0; i < m.units.length; i++) {
      const e = m.units[i];
      if (e.team === u.team || e.hp <= 0) continue;
      const d = Math.hypot(e.x - u.x, e.y - u.y);
      let sc;
      if (want === "weak") sc = -e.hp - d * 0.05;
      else if (want === "strong") sc = (e.atk || 0) * 10 - d * 0.05;
      else if (want === "back") sc = (hangsBack(e.role) ? 1000 : 0) - d;
      else return null;
      if (e.summon) sc -= 2000;
      if (sc > score) { score = sc; pick = e; }
    }
    return pick;
  }

  function nearestEnemyOf(m, u, team) {
    let best = null;
    let bestD = 1e9;
    for (let i = 0; i < m.units.length; i++) {
      const e = m.units[i];
      if (e.team === team || e.hp <= 0) continue;
      const d = Math.hypot(e.x - u.x, e.y - u.y);
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }

  /* v109 healing priority: Most wounded (default), Front line or Damage dealers. */
  function lowestAlly(m, u) {
    const pri = (u.ai && u.ai.heal) || "lowest";
    let best = null;
    let score = 1e9;
    for (let i = 0; i < m.units.length; i++) {
      const a = m.units[i];
      if (a.team !== u.team || a.hp <= 0) continue;
      const r = a.hp / a.maxHp;
      if (r >= 0.92) continue;
      let v = r;
      if (pri === "front" && !hangsBack(a.role)) v -= 0.25;
      if (pri === "carry") v -= Math.min(0.3, (a.atk || 0) / 400);
      if (v < score) { score = v; best = a; }
    }
    return best;
  }

  function face(u, t) {
    if (t) u.facing = t.x >= u.x ? 1 : -1;
  }

  function idleClip(u) {
    const kit = kitOf(u.cls);
    return kit.idle || "idle";
  }
  function runClip(u) {
    const kit = kitOf(u.cls);
    return kit.run || "run";
  }
  function moveSpeed(u) {
    /* Locomotion only. Damage, cooldowns, and cast times are untouched.
       Both fronts already close the gap in a couple of seconds at kit speed. */
    let s = u.speed * PACE.move;
    if (u.root > 0) return 0;
    if (u.ai && u.ai.open === "rush" && u.mRushT > 0) s *= 1.15;
    if (u.slow > 0) s *= 0.62;
    if (u.rage > 0) s *= 1.08;
    return s;
  }

  function meleeReach(u, t) {
    return (u.range || 36) + ((t && t.radius) || 14);
  }

  function standAt(u, t) {
    const reach = meleeReach(u, t);
    const bodies = (u.radius || 14) + ((t && t.radius) || 14) + 4;
    const gap = Math.min(reach, bodies);
    const dx = u.x - t.x;
    const dy = u.y - t.y;
    const d = Math.hypot(dx, dy) || 1;
    return { x: t.x + (dx / d) * gap, y: t.y + (dy / d) * gap };
  }

  function steer(u, tx, ty, speed, dt) {
    const dx = tx - u.x;
    const dy = ty - u.y;
    const d = Math.hypot(dx, dy) || 1;
    const wantX = dx / d * speed;
    const wantY = dy / d * speed;
    const acc = PACE.turn * dt;
    const ax = wantX - u.vx;
    const ay = wantY - u.vy;
    const am = Math.hypot(ax, ay);
    if (am <= acc) { u.vx = wantX; u.vy = wantY; }
    else { u.vx += ax / am * acc; u.vy += ay / am * acc; }
  }

  function damp(u, k) {
    u.vx *= k;
    u.vy *= k;
  }

  function setMoveAnim(u, dt) {
    const sp = Math.hypot(u.vx, u.vy);
    if (sp > 16) {
      u.state = "run";
      u.anim = runClip(u);
    } else {
      u.state = "idle";
      u.anim = idleClip(u);
    }
    u.animT += dt;
    u.trail = null;
    u.z = 0;
  }

  function pushTrail(u) {
    if (!u.trail) u.trail = [];
    u.trail.push({ x: u.x, y: u.y });
    if (u.trail.length > 8) u.trail.shift();
  }

  function fx(m, kind, x, y, opt) {
    const e = { type: "fx", kind: kind, x: x, y: y };
    if (opt) {
      if (opt.size) e.size = opt.size;
      if (opt.facing) e.facing = opt.facing;
      if (opt.rot) e.rot = opt.rot;
      if (opt.ground) e.ground = true;
      if (opt.team != null) e.team = opt.team;
    }
    m.events.push(e);
  }

  function cue(m, id, opt) {
    if (!m || !id) return;
    opt = opt || {};
    const e = { type: "cue", id: id };
    if (typeof opt.gain === "number") e.gain = opt.gain;
    if (opt.layer) e.layer = opt.layer;
    m.events.push(e);
  }

  function weaponOf(u) {
    if (!u) return "sword";
    return u.weaponKind || (IL.CLASS_WEAPON && IL.CLASS_WEAPON[u.cls]) || "sword";
  }

  function swingName(kind) {
    if (kind === "axe") return "swing_heavy";
    if (kind === "mace") return "swing_blunt";
    if (kind === "dagger" || kind === "fist" || kind === "claw") return "swing_light";
    return "swing_blade";
  }

  function hitName(kind) {
    if (kind === "axe") return "hit_axe";
    if (kind === "spear") return "hit_spear";
    if (kind === "dagger") return "hit_dagger";
    if (kind === "mace") return "hit_blunt";
    if (kind === "fist" || kind === "claw") return "hit_fist";
    if (kind === "bow" || kind === "crossbow") return "hit_arrow";
    if (kind === "gun") return "hit_bullet";
    if (kind === "staff" || kind === "wand" || kind === "book") return "hit_blunt";
    return "hit_sword";
  }

  function impactId(src, opt) {
    opt = opt || {};
    if (opt.spell) return opt.spell;
    if (opt.snd) return opt.snd;
    if (opt.dot) return "hit_dagger";
    return hitName(weaponOf(src));
  }

  function castSchool(u, kind) {
    const cls = u && u.cls;
    if (kind === "fireball" || kind === "cast2") return cls === "battlemage" ? "lightning" : "fire";
    if (kind === "bolt" || kind === "arc") return "lightning";
    if (kind === "nova") return cls === "druid" ? "nature" : "ice";
    if (kind === "mend" || kind === "heal") return "holy";
    if (cls === "druid") return "nature";
    if (cls === "alchemist") return "poison";
    if (cls === "warlock" || cls === "necromancer" || cls === "summoner") return "shadow";
    if (cls === "healer" || cls === "paladin") return "holy";
    if (cls === "battlemage") return "lightning";
    if (cls === "bard") return "arcane";
    if (kind === "frost" || kind === "cast1") return "ice";
    return "arcane";
  }

  function queueSwing(u) {
    const kind = weaponOf(u);
    if (kind === "gun") u.swingCue = "";
    else if (kind === "bow") u.swingCue = "bow_draw";
    else u.swingCue = swingName(kind);
  }

  function startAttack(u, clip, target) {
    face(u, target);
    const use = u.rowClip || clip;
    u.state = "attack";
    u.anim = use;
    u.animT = 0;
    u.actT = Math.max(IL.clipDur(use), u.rowHold || 0);
    u.didHit = false;
    u.didSlash = false;
    u.z = 0;
    u.trail = null;
    u.motion = u.wantMotion || null;
    u.rowClip = null;
    u.rowHold = 0;
    u.wantMotion = null;
    queueSwing(u);
    if (IL.attackOf) {
      const atk = IL.attackOf(u.cls);
      if (atk) raiseBanner(u, atk.name, false);
    }
    if (u.role !== "kite" && !u.forceShot) {
      u.vx = u.facing * 16;
      u.vy *= 0.2;
    }
    u.swingTag = (u.summon && u.bookTag) ? u.bookTag : basicTag(u);
  }

  function startCast(m, u, target) {
    face(u, target);
    let casts = u.casts.length ? u.casts.slice() : ["cast1"];
    if ((u.level || 1) < 4) casts = casts.filter(function (c) { return c !== "cast2"; });
    if (!casts.length) casts = ["cast1"];
    const clip = casts[u.castCursor % casts.length];
    u.castCursor++;
    const hot = clip === "cast2";
    const dur = hot ? u.castTime * 0.78 : u.castTime;
    const r = hot ? Math.round(u.castRadius * 0.64) : u.castRadius;
    u.state = "cast";
    u.anim = clip;
    u.animT = 0;
    u.actT = dur;
    u.motion = "magic";
    u.vx = 0;
    u.vy = 0;
    u.z = 0;
    u.cast = {
      x: target.x,
      y: target.y,
      r: r,
      t: 0,
      dur: dur,
      kind: clip
    };
    const chant = chantAb(u, clip);
    u.swingTag = chant ? { id: chant.id, name: chant.name } : basicTag(u);
    if (chant) raiseBanner(u, chant.name, false, dur + 0.35, chant.id);
    else if (IL.attackOf) {
      const atk = IL.attackOf(u.cls);
      if (atk) raiseBanner(u, atk.name, false, dur + 0.35);
    }
  }

  function chantAb(u, clip) {
    const kit = kitOf(u.cls);
    const chants = (kit.abilities || []).filter(function (ab) { return ab && !ab.cd && ab.name; });
    if (!chants.length) return null;
    if (clip === "cast2" && chants.length > 1) return chants[1];
    return chants[0];
  }

  /* Cast clips with no cooldown are the class chants: frost, then fireball. */
  function chantName(u, clip) {
    const ab = chantAb(u, clip);
    return ab ? ab.name : "";
  }

  function startDash(m, u, target) {
    const dx = target.x - u.x;
    const dy = target.y - u.y;
    const d = Math.hypot(dx, dy) || 1;
    u.state = "dash";
    u.anim = "dash";
    u.animT = 0;
    u.actT = 0.34;
    u.facing = dx >= 0 ? 1 : -1;
    u.vx = dx / d * 430 * PACE.dash;
    u.vy = dy / d * 430 * PACE.dash;
    u.z = 0;
    u.didHit = false;
    u.dashCd = 2.15;
    u.fxT = 0;
    u.trail = [];
    m.stats.dashes++;
    fx(m, "dash", u.x, u.y - 16, { facing: u.facing, size: 150 });
  }

  function startRoll(m, u, dx, dy) {
    const d = Math.hypot(dx, dy) || 1;
    u.state = "roll";
    u.anim = "roll";
    u.animT = 0;
    u.actT = IL.clipDur("roll");
    u.facing = dx >= 0 ? 1 : -1;
    u.vx = dx / d * 340 * PACE.roll;
    u.vy = dy / d * 280 * PACE.roll;
    u.z = 0;
    u.vz = 0;
    u.iframe = 0.42;
    u.rollCd = PACE.rollCd;
    u.fxT = 0;
    u.cast = null;
    u.trail = [];
    m.stats.rolls++;
    fx(m, "smoke", u.x, u.y + 4, { size: 120, ground: true });
  }

  function startLeap(m, u, target) {
    face(u, target);
    const dx = target.x - u.x;
    const dy = target.y - u.y;
    const d = Math.hypot(dx, dy) || 1;
    const hop = Math.min(d * 0.82, 128);
    u.state = "leap";
    u.leapPhase = "jump";
    u.anim = "jump";
    u.animT = 0;
    u.actT = IL.clipDur("jump");
    u.z = 0;
    u.vz = 300;
    u.vx = dx / d * (hop / 0.62);
    u.vy = dy / d * (hop / 0.62);
    u.didHit = false;
    u.didSlash = false;
    u.leapCd = 2.85;
    u.trail = null;
    m.stats.leaps++;
    cue(m, weaponOf(u) === "axe" ? "swing_heavy" : swingName(weaponOf(u)));
  }

  function startBlock(m, u) {
    u.state = "block";
    u.anim = "block";
    u.animT = 0;
    u.actT = 0.58;
    u.vx = 0;
    u.vy = 0;
    u.z = 0;
    u.blockCd = 2.9;
    m.stats.blocks++;
    cue(m, "shield_up");
  }

  function basicTag(u) {
    const atk = u && IL.attackOf && IL.attackOf(u.cls);
    return { id: "basic", name: (atk && atk.name) || "Attack" };
  }

  function noteBook(src, kind, n, tag) {
    if (!src || !n) return;
    if (!src.byAb) src.byAb = {};
    const t = tag || src.swingTag || basicTag(src);
    if (!t || !t.id) return;
    const row = src.byAb[t.id] || (src.byAb[t.id] = { id: t.id, name: t.name || t.id, dmg: 0, heal: 0 });
    row[kind] = (row[kind] || 0) + n;
  }

  function deal(m, src, dst, raw, opt) {
    opt = opt || {};
    if (!dst || dst.hp <= 0) return;
    if (dst.iframe > 0) {
      m.stats.dodges++;
      m.events.push({ type: "dodge", x: dst.x, y: dst.y - 34, team: dst.team });
      fx(m, "smoke", dst.x, dst.y - 6, { size: 96, ground: true });
      return;
    }
    if (m.hazard === "fog" && !opt.dot && m.rng() < 0.16) {
      m.stats.dodges++;
      m.events.push({ type: "dodge", x: dst.x, y: dst.y - 34, team: dst.team });
      fx(m, "smoke", dst.x, dst.y - 6, { size: 96, ground: true });
      return;
    }
    const blocked = dst.state === "block";
    if (blocked && dst.team === 0) dst.blocks = (dst.blocks || 0) + 1;
    let amount = raw;
    let spec = null;
    if (src) {
      const rid = (opt.tag && opt.tag.id) || (src.swingTag && src.swingTag.id);
      if (rid) amount *= rankMul(src, rid) * specPow(src, rid);
      if (!opt.dot) spec = specOf(src, rid);
    }
    if (dst.vuln > 0 && dst.vulnAmt) amount *= 1 + dst.vulnAmt;
    if (dst.bleed && dst.bleed.hex) amount *= 1 + dst.bleed.hex;
    if (src && src.pv && src.pv.vsSlowed && dst.slow > 0) amount *= 1 + src.pv.vsSlowed;
    if (src && src.teamDmg && !opt.dot) amount *= 1 + src.teamDmg;
    if (src && src.persona && src.team !== dst.team && !opt.dot) {
      const px = src.persona;
      if (px.lowHp && dst.hp < dst.maxHp * 0.5) amount *= 1 + px.lowHp;
      if (px.grudge && src.lastHitBy === dst.id) amount *= 1 + px.grudge;
      if (px.alone) {
        let near = false;
        for (let i = 0; i < m.units.length; i++) { const a = m.units[i]; if (a !== src && a.team === src.team && a.hp > 0 && Math.hypot(a.x - src.x, a.y - src.y) < 120) { near = true; break; } }
        if (!near) amount *= 1 + px.alone;
      }
    }
    if (src && src.team !== dst.team) dst.lastHitBy = src.id;
    if (m.hazard === "sudden" && m.time > 18 && !opt.dot) amount *= 1.4;
    /* v92 sudden death for every fight, after Eslabong: from 45 s hits
       climb 5% a second, to three times at 85 s. */
    const sAt = m.suddenAt || SUDDEN_AT;
    if (m.time > sAt) amount *= Math.min(3, 1 + (m.time - sAt) * 0.05);
    if (m.mods && m.mods.rush && m.time < 10) amount *= 1.25;
    if (src && !opt.dot) {
      if (src.rage > 0) amount *= 1.28;
      if (src.buff > 0 && src.buffAtk) amount *= src.buffAtk;
      if (src.cls === "berserker" && src.hp < src.maxHp * 0.45) amount *= 1.14;
      if (src.cls === "duelist") {
        let foes = 0;
        for (let i = 0; i < m.units.length; i++) if (m.units[i].team !== src.team && m.units[i].hp > 0) foes++;
        if (foes <= 1) amount *= 1.18;
      }
      let crit = false;
      if (src.riposte) { amount *= 1.2; src.riposte = false; }
      if (src.critNext) { crit = true; src.critNext = false; }
      else if (src.crit && m.rng() < src.crit) crit = true;
      if (crit) {
        amount *= (src.pv && src.pv.critMul) || 1.55;
        opt.crit = true;
        if (src.team === 0) src.critsLanded = (src.critsLanded || 0) + 1;
      }
    }
    let dmg = amount - dst.def * 0.35;
    if (blocked) dmg *= (dst.guardZone ? 0.32 : 0.4) * (1 - ((dst.pv && dst.pv.blockCut) || 0));
    dmg = Math.max(1, Math.round(dmg));
    if (dst.shield > 0) {
      const eff = m.mods && m.mods.glass ? 0.6 : 1;
      const absorb = Math.min(dst.shield * eff, dmg);
      dst.shield = Math.max(0, dst.shield - absorb / eff);
      dmg -= absorb;
      fx(m, "orbit", dst.x, dst.y - 20, { size: 100 });
      if (dmg <= 0) {
        m.events.push({ type: "dmg", x: dst.x, y: dst.y - 40 - (dst.z || 0), n: "ward", blocked: true, team: dst.team });
        cue(m, "block_parry");
        return;
      }
    }
    if (opt.nonLethal && dmg >= dst.hp) dmg = Math.max(0, dst.hp - 1);
    dst.hp -= dmg;
    dst.dmgTaken = (dst.dmgTaken || 0) + dmg;
    if (m.mods && m.mods.vamp && src && src.hp > 0 && src.team !== dst.team && !opt.dot) src.hp = Math.min(src.maxHp, src.hp + dmg * 0.06);
    if (spec && IL.modValue && src && src.team !== dst.team) {
      const v = IL.modValue(spec.mod, spec.tier);
      const tag = (opt.tag && opt.tag.id) ? opt.tag : src.swingTag;
      if (spec.mod === "vampiric" && src.hp > 0) healUnit(m, src, src, dmg * v / 100);
      else if (spec.mod === "chilling") dst.slow = Math.max(dst.slow || 0, v);
      else if (spec.mod === "sundering") { dst.vuln = 3; dst.vulnAmt = Math.max(dst.vuln > 0 ? dst.vulnAmt || 0 : 0, v / 100); }
      else if (spec.mod === "searing") dst.bleed = { t: 3, acc: 0, dmg: Math.max(1, Math.round(dmg * v / 100 / 3.5)), src: src.id, tag: tag ? { id: tag.id, name: tag.name } : null };
    }
    /* v96 evolved moves add their effect to every hit the move lands. */
    if (src && src.evos && src.team !== dst.team && !opt.dot && !opt.evoed && !opt.reflected) {
      const erid = (opt.tag && opt.tag.id) || (src.swingTag && src.swingTag.id);
      const evo = erid && src.evos[erid];
      if (evo === "root") dst.root = Math.max(dst.root || 0, 1.2);
      else if (evo === "silence") silenceUnit(m, dst, 1.5);
      else if (evo === "drain" && src.hp > 0) {
        const was = src.hp;
        src.hp = Math.min(src.maxHp, src.hp + dmg * 0.3 * (m.time > (m.suddenAt || SUDDEN_AT) ? 0.5 : 1));
        src.healing = (src.healing || 0) + (src.hp - was);
      } else if (evo === "chain") {
        const skip = {};
        skip[dst.id] = true;
        const e = nextFoe(m, src.team, dst, 140, skip);
        if (e) {
          m.events.push({ type: "beam", x: dst.x, y: dst.y - 18, x2: e.x, y2: e.y - 18, kind: "bolt" });
          deal(m, src, e, dmg * 0.5 + e.def * 0.35, { tag: { id: erid }, evoed: true, silent: true });
        }
      }
    }
    if (!opt.dot && src && dst.thorns > 0 && src.hp > 0 && !opt.spell && Math.hypot(src.x - dst.x, src.y - dst.y) < 90) {
      deal(m, dst, src, dmg * dst.thorns, { dot: true, silent: true });
    }
    if (src && src.team !== dst.team) {
      src.dmgDealt = (src.dmgDealt || 0) + dmg;
      noteBook(src, "dmg", dmg, opt.tag);
      if (!dst.hitBy) dst.hitBy = {};
      dst.hitBy[src.id] = m.time;
      /* v95 relics: lifesteal heals the hitter, reflect hits back. */
      if (src.lifesteal > 0 && src.hp > 0 && !opt.reflected) {
        const back = dmg * src.lifesteal * (m.time > (m.suddenAt || SUDDEN_AT) ? 0.5 : 1);
        const was = src.hp;
        src.hp = Math.min(src.maxHp, src.hp + back);
        src.healing = (src.healing || 0) + (src.hp - was);
      }
      if (dst.reflect > 0 && src.hp > 0 && src !== dst && !opt.reflected && !opt.dot) {
        deal(m, dst, src, dmg * dst.reflect + src.def * 0.35, { dot: true, silent: true, reflected: true });
      }
    }
    dst.flash = 0.14;
    const big = !!opt.crit || dmg >= 26;
    m.hitstop = blocked ? 0.02 : (big ? 0.07 : 0.035);
    m.cheer = 1;
    if (src && !opt.dot && src !== dst) {
      const dx = dst.x - src.x;
      const dy = dst.y - src.y;
      const dist = Math.hypot(dx, dy) || 1;
      const push = blocked ? 4 : (big ? 22 : 11);
      dst.x += (dx / dist) * push;
      dst.y += (dy / dist) * push * 0.35;
      if (big && !blocked) {
        dst.vz = 150;
        dst.z = Math.max(dst.z || 0, 8);
      }
    }
    m.stats.hits++;
    m.events.push({ type: "dmg", x: dst.x, y: dst.y - 40 - (dst.z || 0), n: dmg, blocked: blocked, crit: !!opt.crit, team: dst.team });
    if (blocked) cue(m, "block_parry");
    else if (opt.crit) cue(m, "hit_crit");
    else if (!opt.silent) cue(m, impactId(src, opt), typeof opt.gain === "number" ? { gain: opt.gain } : null);
    fx(m, "spark", dst.x, dst.y - 22 - (dst.z || 0), { size: blocked ? 60 : 72 });
    if (!opt.dot) {
      const hx = src ? dst.x - src.x : 0;
      const hy = src ? dst.y - src.y : 0;
      const hd = Math.hypot(hx, hy) || 1;
      m.events.push({
        type: "hit", x: dst.x, y: dst.y - 18 - (dst.z || 0), fy: dst.y,
        dx: src ? hx / hd : (dst.team === 0 ? -1 : 1), dy: src ? hy / hd : 0,
        crit: !!opt.crit, blocked: blocked, big: big,
        school: opt.spell ? String(opt.spell).replace(/^spell_|_impact$/g, "") : "",
        team: dst.team
      });
    }
    if (blocked) fx(m, "orbit", dst.x + dst.facing * 8, dst.y - 22, { size: 130 });
    if (dst.hp <= 0 && dst.revive > 0 && !dst.revived && !dst.summon) {
      dst.revived = true;
      dst.hp = Math.max(1, Math.round(dst.maxHp * dst.revive));
      dst.iframe = Math.max(dst.iframe || 0, 0.8);
      dst.bleed = null;
      m.events.push({ type: "heal", x: dst.x, y: dst.y - 48, n: "Revive", team: dst.team });
      cue(m, "heal_chime");
      fx(m, "plasma", dst.x, dst.y - 16, { size: 160 });
      fx(m, "boom", dst.x, dst.y - 18, { size: 120 });
      return;
    }
    if (dst.hp <= 0) {
      m.events.push({ type: "die", x: dst.x, y: dst.y, team: dst.team });
      if (src && src.bloodlust > 0 && src.hp > 0 && src.team !== dst.team) src.hp = Math.min(src.maxHp, src.hp + src.maxHp * src.bloodlust);
      dst.hp = 0;
      dst.alive = false;
      if (dst.summon) {
        dst.state = "dead";
        dst.anim = "die";
        dst.animT = 0;
        dst.vx = 0;
        dst.vy = 0;
        dst.cast = null;
        fx(m, "smoke", dst.x, dst.y - 10, { size: 120 });
        return;
      }
      dst.state = "dead";
      dst.anim = "die";
      dst.animT = 0;
      dst.vx = 0;
      dst.vy = 0;
      dst.z = 0;
      dst.iframe = 0;
      dst.cast = null;
      dst.trail = null;
      const killerTeam = src ? (src.team === dst.team ? -1 : src.team) : 0;
      if (killerTeam >= 0) {
        if (m.kills[killerTeam] == null) m.kills[killerTeam] = 0;
        m.kills[killerTeam]++;
      }
      if (src && src.team !== dst.team) src.kos = (src.kos || 0) + 1;
      /* v97 K/D/A: an assist is damage on the fallen in the last 6 s, or a
         heal or shield on the killer in the last 6 s. */
      if (!dst.summon) dst.deaths = (dst.deaths || 0) + 1;
      if (src && src.team !== dst.team) {
        const helpers = {};
        Object.keys(dst.hitBy || {}).forEach(function (id) { if (m.time - dst.hitBy[id] <= 6) helpers[id] = true; });
        Object.keys(src.helpedBy || {}).forEach(function (id) { if (m.time - src.helpedBy[id] <= 6) helpers[id] = true; });
        delete helpers[src.id];
        for (let i = 0; i < m.units.length; i++) {
          const a = m.units[i];
          if (helpers[a.id] && a.team === src.team) a.assists = (a.assists || 0) + 1;
        }
      }
      if (src && src.bounty) m.stats.bounty = (m.stats.bounty || 0) + src.bounty;
      m.stats.deaths++;
      m.events.push({ type: "death", id: dst.id, team: dst.team, by: src ? src.id : "", byTeam: src ? src.team : -1 });
      cue(m, "ko_stinger", { layer: dst.team === 0 ? "crowd_gasp" : "crowd_cheer" });
      fx(m, "boom", dst.x, dst.y - 18, { size: 168 });
      return;
    }
    const bl = dst.blink;
    if (bl && bl.left > 0 && bl.cd <= 0 && src && src !== dst && dst.hp > 0 && dst.hp < dst.maxHp * bl.at) {
      bl.left -= 1;
      bl.cd = bl.gap;
      const ax = dst.x - src.x;
      const ay = dst.y - src.y;
      const ad = Math.hypot(ax, ay) || 1;
      fx(m, "smoke", dst.x, dst.y - 6, { size: 110, ground: true });
      dst.x += (ax / ad) * bl.dist;
      dst.y += (ay / ad) * bl.dist * 0.5;
      dst.iframe = Math.max(dst.iframe || 0, bl.guard);
      dst.cast = null;
      m.events.push({ type: "dmg", x: dst.x, y: dst.y - 40, n: "Blink", team: dst.team });
      fx(m, "orbit", dst.x, dst.y - 20, { size: 120 });
    }
    if (dst.wind && !dst.windUsed && dst.hp > 0 && dst.hp < dst.maxHp * 0.32) {
      dst.windUsed = true;
      const heal = Math.round(dst.maxHp * (dst.wind === true ? 0.22 : dst.wind));
      dst.hp = Math.min(dst.maxHp, dst.hp + heal);
      dst.healing = (dst.healing || 0) + heal;
      m.events.push({ type: "heal", x: dst.x, y: dst.y - 48, n: heal, team: dst.team });
      cue(m, "heal_chime");
      fx(m, "plasma", dst.x, dst.y - 16, { size: 120 });
    }
    if (src && !opt.dot && kitOf(src.cls).bleed) {
      dst.bleed = { t: 3.1, acc: 0.4, dmg: Math.max(2, Math.round(src.atk * 0.18)), src: src.id, tag: src.swingTag || basicTag(src) };
      m.stats.bleeds++;
    }
    if (dst.cls === "duelist" && !opt.dot && dst.hp > 0) dst.riposte = true;
    if (dst.hurtCd <= 0 && (dst.state === "idle" || dst.state === "run")) {
      dst.state = "hurt";
      dst.anim = "hurt";
      dst.animT = 0;
      dst.actT = 0.26;
      dst.vx *= 0.2;
      dst.vy *= 0.2;
      dst.hurtCd = 0.55;
    }
  }

  function healUnit(m, src, dst, raw) {
    if (!dst || dst.hp <= 0) return;
    let rawN = raw;
    if (m.time > (m.suddenAt || SUDDEN_AT)) rawN *= 0.5;
    if (m.mods && m.mods.mercy) rawN *= 1.25;
    if (src && src.oath) rawN *= 1.12;
    if (src && src.pv && src.pv.healMul) rawN *= 1 + src.pv.healMul;
    if (src && src.pv && src.pv.triage && dst.hp < dst.maxHp * (src.pv.triageAt || 0.4)) rawN *= 1 + src.pv.triage;
    if (src && src.swingTag && src.swingTag.id) rawN *= rankMul(src, src.swingTag.id);
    const n = Math.max(1, Math.round(rawN));
    dst.hp = Math.min(dst.maxHp, dst.hp + n);
    if (src) {
      src.healing = (src.healing || 0) + n;
      noteBook(src, "heal", n, null);
      if (src !== dst) { if (!dst.helpedBy) dst.helpedBy = {}; dst.helpedBy[src.id] = m.time; }
    }
    m.stats.heals++;
    m.events.push({ type: "heal", x: dst.x, y: dst.y - 46, n: n, team: dst.team });
    cue(m, "heal_chime");
    fx(m, "plasma", dst.x, dst.y - 18, { size: 130 });
    if (src) m.stats.abilities++;
  }

  function onSwingFrame(u) {
    const clip = IL.CLIPS[u.anim];
    if (!clip || !clip.hits) return false;
    const f = IL.frameIndex(u.anim, u.animT);
    return clip.hits.indexOf(f) >= 0;
  }

  function meleeVictim(m, u) {
    let best = null;
    let bestD = 1e9;
    const bonus = (u.z || 0) > 8 ? 20 : 0;
    for (let i = 0; i < m.units.length; i++) {
      const e = m.units[i];
      if (e.team === u.team || e.hp <= 0) continue;
      const dx = e.x - u.x;
      const dy = e.y - u.y;
      if (dx * u.facing < -10) continue;
      const dist = Math.hypot(dx, dy);
      if (dist > meleeReach(u, e) + bonus) continue;
      if (dist < bestD) { bestD = dist; best = e; }
    }
    return best;
  }

  function swingMult(anim) {
    if (anim === "atk2") return 1.12;
    if (anim === "atk3") return 1.06;
    if (anim === "air1") return 1.1;
    if (anim === "air2") return 1.18;
    return 1;
  }

  function tryMelee(m, u) {
    if (!onSwingFrame(u)) return;
    if (!u.didSlash) {
      u.didSlash = true;
      m.stats.slashes++;
      /* The swing arc is drawn by render.js (vector, full resolution). */
      m.events.push({
        type: "swing",
        x: u.x, y: u.y - 16 - (u.z || 0), fy: u.y,
        facing: u.facing, team: u.team,
        wk: weaponOf(u) || "sword",
        heavy: u.anim === "atk2" || u.anim === "air2" || !!u.cleave,
        thrust: u.anim === "atk3"
      });
    }
    if (u.didHit) return;
    const e = meleeVictim(m, u);
    if (!e) return;
    u.didHit = true;
    deal(m, u, e, u.atk * swingMult(u.anim));
    if (u.cleave) {
      u.cleave = false;
      m.stats.cleaves++;
      for (let i = 0; i < m.units.length; i++) {
        const o = m.units[i];
        if (o === e || o.team === u.team || o.hp <= 0) continue;
        if (Math.hypot(o.x - u.x, o.y - u.y) <= u.range + o.radius + 28) {
          deal(m, u, o, u.atk * 0.55);
          fx(m, "slash", o.x, o.y - 16, { facing: u.facing, size: 120, team: u.team });
        }
      }
    }
  }

  /* A shot flies in the floor plane lifted to body height. Keep the lift
     (from the shooter's feet at launch, to the aim point at the end) so a
     turned phone floor can draw it from the hand the sprite shows. */
  function liftShot(p, u, endX, endY, dist) {
    if (!p || !u) return;
    p.sx = p.x; p.sy = p.y;
    p.l0x = p.x - u.x; p.l0y = p.y - u.y;
    p.l1x = endX; p.l1y = endY;
    p.sd = Math.max(1, dist || Math.hypot(p.vx, p.vy) * (p.life || 1));
  }

  function tryShot(m, u) {
    if (!onSwingFrame(u) || u.didHit) return;
    u.didHit = true;
    const t = nearest(m, u);
    face(u, t);
    const aimX = t ? t.x + t.vx * 0.14 : u.x + u.facing * 240;
    const aimY = t ? t.y - 14 + t.vy * 0.14 : u.y - 14;
    /* Sprites are drawn at one world unit per pixel (render SCALE 1; a
       giant 1.15), so the bow hand is too. It was 4, which put the arrow
       four times too far out from the archer. */
    const hand = IL.weapons && IL.weapons.worldHand ? IL.weapons.worldHand(u, u.giant ? 1.15 : 1) : null;
    const ox = hand ? hand.x : u.x + u.facing * 18;
    const oy = hand ? hand.y : u.y - (u.z || 0) - 18;
    const bullet = (u.weaponKind || (IL.CLASS_WEAPON && IL.CLASS_WEAPON[u.cls])) === "gun";
    const dx = aimX - ox;
    const dy = aimY - oy;
    const d = Math.hypot(dx, dy) || 1;
    const sp = 470;
    const volley = u.volley || 1;
    u.volley = 0;
    let shotMul = 1;
    if (u.pv && u.pv.feint && u.feintT > 0) { shotMul *= 1 + u.pv.feint; u.feintT = 0; }
    if (u.pv && u.pv.firstShot && !u.firstShotDone) { shotMul *= 1 + u.pv.firstShot; }
    u.firstShotDone = true;
    if (bullet) {
      cue(m, "gunshot");
      if (volley > 1) u.needReload = true;
    } else cue(m, "bow_release");
    for (let k = 0; k < volley; k++) {
      const spread = (k - (volley - 1) / 2) * 0.16;
      const cs = Math.cos(spread);
      const sn = Math.sin(spread);
      const vx = dx / d * sp;
      const vy = dy / d * sp;
      m.shots.push({
        x: ox, y: oy,
        vx: vx * cs - vy * sn,
        vy: vx * sn + vy * cs,
        team: u.team, dmg: Math.round((volley > 1 ? u.atk * 0.72 : u.atk) * shotMul),
        r: 8, life: 1.15, src: u.id,
        trail: [], drop: volley > 1 ? 18 : 42,
        pierce: (u.pierce || 0) + (u.pierceBoost || 0),
        hit: {},
        bullet: bullet,
        snd: bullet ? "hit_bullet" : "hit_arrow",
        srcTag: u.swingTag ? { id: u.swingTag.id, name: u.swingTag.name } : null
      });
      liftShot(m.shots[m.shots.length - 1], u, 0, -14, d);
      m.stats.shots++;
    }
    u.pierceBoost = 0;
    fx(m, "spark", ox, oy, { size: volley > 1 ? 110 : 72 });
    if (volley > 1) fx(m, "shot", ox + u.facing * 10, oy, { size: 80, facing: u.facing });
  }

  function stepAttack(m, u, dt) {
    if (u.swingCue) {
      const swing = u.swingCue;
      u.swingCue = "";
      cue(m, swing);
    }
    u.animT += dt;
    u.actT -= dt;
    damp(u, 0.9);
    u.x += u.vx * dt;
    u.y += u.vy * dt;
    if (u.role === "kite" || u.forceShot) tryShot(m, u);
    else tryMelee(m, u);
    if (u.actT <= 0) {
      if (u.needReload) {
        u.needReload = false;
        cue(m, "reload");
      }
      u.cleave = false;
      u.forceShot = false;
      u.motion = null;
      u.state = "idle";
      u.anim = idleClip(u);
      u.cool = u.role === "kite" ? PACE.kiteRecover : PACE.meleeRecover;
    }
  }

  function stepCast(m, u, dt) {
    if (u.pv && u.pv.castSpeed) dt /= 1 - u.pv.castSpeed;
    if (u.cast && !u.cast.voiced) {
      u.cast.voiced = true;
      cue(m, "spell_" + castSchool(u, u.cast.kind) + "_cast");
      if (u.swingTag && u.swingTag.id) {
        paintSignature(m, u, { x: u.cast.x, y: u.cast.y }, u.swingTag);
      }
    }
    u.animT += dt;
    u.actT -= dt;
    if (u.cast) u.cast.t += dt;
    if (u.actT > 0) return;
    const c = u.cast;
    if (c) {
      if (c.kind === "nova" || c.kind === "bolt") {
        resolveNovaBolt(m, u, c);
      } else if (c.kind === "mend") {
        const ally = m.units.filter(function (e) { return e.id === c.targetId; })[0];
        const amt = Math.round((ally || u).maxHp * 0.2 + u.atk * 0.35);
        healUnit(m, u, ally || u, amt);
        if (c.abId) evoSupport(m, u, ally || u, { id: c.abId }, amt, "heal");
        fx(m, "plasma", c.x, c.y, { size: 150 });
      } else {
        m.stats.casts++;
        m.stats.abilities++;
        if (c.kind === "cast2") m.stats.cast2++;
        const bolt = c.kind === "fireball" || (c.kind === "cast2" && kitOf(u.cls).boltCast);
        const mul = c.kind === "cast2" || c.kind === "fireball" ? 1.3 : (c.kind === "arc" ? 0.95 : 1.15);
        const mark = c.kind === "fireball" || c.kind === "cast2" ? "fireball" : (c.kind === "frost" || c.kind === "cast1" ? "frost" : c.kind);
        if (bolt) m.events.push({ type: "beam", x: u.x, y: u.y - 22, x2: c.x, y2: c.y - 16, kind: "fireball" });
        else m.events.push({ type: "ring", x: c.x, y: c.y, r: c.r, kind: mark });
        const school = castSchool(u, c.kind);
        m.events.push({ type: "boom", x: c.x, y: c.y, r: c.r, kind: c.kind, school: school });
        fx(m, c.kind === "cast2" ? "bolt" : "boom", c.x, c.y, { size: Math.round(c.r * 2.35) });
        if (c.kind === "cast1" || c.kind === "arc") fx(m, "plasma", c.x, c.y, { size: Math.round(c.r * 1.7) });
        if (c.kind === "cast2") fx(m, "spark", c.x, c.y, { size: Math.round(c.r * 1.5) });
        if (!bolt) {
          cue(m, "spell_" + school + "_impact");
          for (let i = 0; i < m.units.length; i++) {
            const e = m.units[i];
            if (e.hp <= 0 || e === u) continue;
            if (e.team === u.team) {
              if (c.ability && c.kind !== "arc" && m.ff !== false && Math.hypot(e.x - c.x, e.y - c.y) <= c.r + e.radius * 0.45) friendlyHit(m, u, e, Math.round(u.atk * mul));
              continue;
            }
            const d = Math.hypot(e.x - c.x, e.y - c.y);
            if (d <= c.r + e.radius * 0.45) {
              deal(m, u, e, Math.round(u.atk * mul), { silent: true, tag: u.swingTag });
              if (c.kind === "cast1") e.slow = Math.max(e.slow, 2.1);
            }
          }
          wardUp(u);
        } else {
          const dx = c.x - u.x;
          const dy = c.y - u.y;
          const d = Math.hypot(dx, dy) || 1;
          m.shots.push({
            x: u.x + u.facing * 16, y: u.y - 16,
            vx: dx / d * 420, vy: dy / d * 420,
            team: u.team, dmg: Math.round(u.atk * 1.15), r: 10, life: 1.3, src: u.id,
            trail: [], drop: 0, pierce: (u.pierce || 0) + 1, hit: {}, bolt: true,
            spell: "spell_" + school + "_impact",
            srcTag: u.swingTag ? { id: u.swingTag.id, name: u.swingTag.name } : null
          });
          liftShot(m.shots[m.shots.length - 1], u, u.facing * 16, -16);
          m.stats.shots++;
          fx(m, "bolt", u.x + u.facing * 20, u.y - 16, { size: 140, facing: u.facing });
        }
      }
    }
    u.cast = null;
    u.motion = null;
    u.state = "idle";
    u.anim = idleClip(u);
    u.cool = PACE.castRecover;
  }

  /* v105 an ally caught in your blast takes 40%, never from full to dead. */
  function friendlyHit(m, u, e, raw) {
    const before = e.hp;
    deal(m, u, e, raw * 0.4, { silent: true, dot: true, friendly: true, nonLethal: before >= e.maxHp * 0.5 });
    u.ffDealt = (u.ffDealt || 0) + Math.max(0, before - Math.max(0, e.hp));
  }

  function resolveNovaBolt(m, u, c) {
    m.stats.casts++;
    m.stats.abilities++;
    const mul = c.power || 1;
    const paint = c.fx || (c.kind === "bolt" ? "bolt" : "plasma");
    const school = castSchool(u, c.kind);
    if (c.kind === "bolt") {
      const dx = c.x - u.x;
      const dy = c.y - u.y;
      const d = Math.hypot(dx, dy) || 1;
      m.shots.push({
        x: u.x + u.facing * 16, y: u.y - 16,
        vx: dx / d * 400, vy: dy / d * 400,
        team: u.team, dmg: Math.round(u.atk * mul), r: 10, life: 1.2, src: u.id,
        trail: [], drop: 0, pierce: u.pierce || 0, hit: {}, bolt: true,
        spell: "spell_" + school + "_impact",
        srcTag: u.swingTag ? { id: u.swingTag.id, name: u.swingTag.name } : null
      });
      liftShot(m.shots[m.shots.length - 1], u, u.facing * 16, -16);
      m.stats.shots++;
      fx(m, paint, u.x + u.facing * 18, u.y - 16, { size: 150, facing: u.facing });
      return;
    }
    fx(m, paint, c.x, c.y, { size: Math.round((c.r || 70) * 2.1) });
    fx(m, "boom", c.x, c.y, { size: Math.round((c.r || 70) * 1.5) });
    m.events.push({ type: "boom", x: c.x, y: c.y, r: c.r || 70, kind: c.kind, school: school });
    cue(m, "spell_" + school + "_impact");
    for (let i = 0; i < m.units.length; i++) {
      const e = m.units[i];
      if (e.hp <= 0 || e === u) continue;
      if (e.team === u.team && !(c.ability && m.ff !== false)) continue;
      if (Math.hypot(e.x - c.x, e.y - c.y) <= (c.r || 70) + e.radius * 0.4) {
        if (e.team === u.team) { friendlyHit(m, u, e, Math.round(u.atk * mul)); continue; }
        deal(m, u, e, Math.round(u.atk * mul), { silent: true, tag: u.swingTag });
        if (c.slow) e.slow = Math.max(e.slow || 0, c.slow);
      }
    }
    wardUp(u);
  }

  function wardUp(u) {
    if (u.pv && u.pv.wardShield && u.hp > 0) u.shield += Math.round(u.maxHp * u.pv.wardShield);
  }

  function stepDash(m, u, dt) {
    u.animT += dt;
    u.actT -= dt;
    u.x += u.vx * dt;
    u.y += u.vy * dt;
    pushTrail(u);
    u.fxT -= dt;
    if (u.fxT <= 0) {
      u.fxT = 0.045;
      fx(m, "dash", u.x, u.y - 14, { facing: u.facing, size: 140, ground: true });
    }
    if (!u.didHit) {
      for (let i = 0; i < m.units.length; i++) {
        const e = m.units[i];
        if (e.team === u.team || e.hp <= 0) continue;
        if (Math.hypot(e.x - u.x, e.y - u.y) <= u.radius + e.radius + 8) {
          u.didHit = true;
          deal(m, u, e, Math.round(u.atk * 0.55 * (u.dashDmg || 1)));
          if ((u.dashDmg || 1) > 1) fx(m, "slash", e.x, e.y - 18, { facing: u.facing, size: 140, team: u.team });
          break;
        }
      }
    }
    if (u.actT > 0) return;
    const t = nearest(m, u);
    const dist = t ? Math.hypot(t.x - u.x, t.y - u.y) : 999;
    u.trail = null;
    u.dashDmg = 1;
    u.guardZone = false;
    if (u.pv && u.pv.feint) u.feintT = u.pv.feintTime || 1.5;
    if (t && dist <= u.range + t.radius + 10) startAttack(u, "atk3", t);
    else {
      u.state = "idle";
      u.cool = 0.08;
    }
  }

  function stepRoll(m, u, dt) {
    u.animT += dt;
    u.actT -= dt;
    u.vx *= 0.992;
    u.vy *= 0.992;
    u.x += u.vx * dt;
    u.y += u.vy * dt;
    pushTrail(u);
    u.fxT -= dt;
    if (u.fxT <= 0) {
      u.fxT = 0.06;
      fx(m, "smoke", u.x - u.vx * 0.02, u.y + 2, { size: 100, ground: true });
    }
    if (u.actT > 0) return;
    u.state = "idle";
    u.anim = idleClip(u);
    u.cool = 0.06;
    u.trail = null;
    if (u.pv && u.pv.feint) u.feintT = u.pv.feintTime || 1.5;
  }

  function beginFall(u) {
    if (u.leapPhase === "fall" || u.leapPhase === "land") return;
    u.leapPhase = "fall";
    u.anim = "fall";
    u.animT = 0;
    u.actT = 0.45;
    if (u.vz > -40) u.vz = -40;
  }

  function stepLeap(m, u, dt) {
    u.animT += dt;
    u.actT -= dt;
    if (u.leapPhase !== "land") {
      u.x += u.vx * dt;
      u.y += u.vy * dt;
      u.z = Math.max(0, u.z + u.vz * dt);
    }
    if (u.leapPhase === "jump") {
      u.vz -= 640 * dt;
      if (u.actT <= 0 || u.z > 52) {
        const t = nearest(m, u);
        const dist = t ? Math.hypot(t.x - u.x, t.y - u.y) : 999;
        if (t && u.airs.length && dist < u.range + t.radius + 40) {
          u.leapPhase = "air";
          m.stats.airs++;
          u.anim = u.airs[u.atkCursor % u.airs.length];
          u.atkCursor++;
          u.animT = 0;
          u.actT = IL.clipDur(u.anim);
          u.didHit = false;
          u.didSlash = false;
          face(u, t);
          u.vx *= 0.45;
          u.vy *= 0.45;
        } else beginFall(u);
      }
    } else if (u.leapPhase === "air") {
      u.vz -= 260 * dt;
      tryMelee(m, u);
      if (u.actT <= 0 || u.z < 4) beginFall(u);
    } else if (u.leapPhase === "fall") {
      u.vz -= 760 * dt;
      if (u.z <= 0) {
        u.z = 0;
        u.vz = 0;
        u.vx *= 0.3;
        u.vy *= 0.3;
        u.leapPhase = "land";
        u.anim = "land";
        u.animT = 0;
        u.actT = 0.12;
      }
    } else {
      u.z = 0;
      if (u.actT <= 0) {
        u.state = "idle";
        u.anim = idleClip(u);
        u.leapPhase = null;
        u.cool = 0.14;
      }
    }
  }

  function stepBlock(m, u, dt) {
    u.animT += dt;
    u.actT -= dt;
    if (u.actT > 0) return;
    u.guardZone = false;
    u.state = "idle";
    u.anim = idleClip(u);
  }

  function stepHurt(m, u, dt) {
    u.animT += dt;
    u.actT -= dt;
    damp(u, 0.8);
    u.x += u.vx * dt;
    u.y += u.vy * dt;
    if (u.actT > 0) return;
    u.state = "idle";
    u.anim = idleClip(u);
  }

  function evadeDir(u, px, py) {
    const d = Math.hypot(px, py) || 1;
    const ax = px / d;
    const ay = py / d;
    function room(dx, dy) {
      const nx = u.x + dx * 110;
      const ny = u.y + dy * 110;
      return Math.min(nx - WORLD.left, WORLD.right - nx, ny - WORLD.top, WORLD.bottom - ny);
    }
    const forward = { x: ax, y: ay };
    const back = { x: -ax, y: -ay };
    const gap = room(ax, ay) - room(-ax, -ay);
    if (gap > 8) return forward;
    if (gap < -8) return back;
    /* Tied for space. Prefer world +y so a mirror pair dodges the same way.
       A purely sideways tie steps apart, left toward the left wall. */
    function prefer(a, b) {
      if (Math.abs(a.y - b.y) > 0.05) return a.y > b.y ? a : b;
      const want = u.team === 0 ? -1 : 1;
      return a.x * want >= b.x * want ? a : b;
    }
    return prefer(forward, back);
  }

  function incomingThreat(m, u) {
    let best = null;
    let score = 0;
    function consider(sc, x, y, kind) {
      if (sc > score) {
        score = sc;
        best = { x: x, y: y, kind: kind, score: sc };
      }
    }
    for (let i = 0; i < m.units.length; i++) {
      const e = m.units[i];
      if (e.team === u.team || e.hp <= 0) continue;
      const swinging = e.state === "attack" || (e.state === "leap" && e.leapPhase === "air") || e.state === "dash";
      if (swinging) {
        const dx = u.x - e.x;
        const dy = u.y - e.y;
        const dist = Math.hypot(dx, dy);
        const reach = (e.range || 40) + u.radius + 30;
        if (dist < reach + 36 && dx * e.facing > -12) {
          const clip = IL.CLIPS[e.anim];
          const f = IL.frameIndex(e.anim, e.animT);
          const hits = clip && clip.hits;
          const first = hits && hits.length ? hits[0] : 999;
          const last = hits && hits.length ? hits[hits.length - 1] : 0;
          const windup = !hits || f <= last;
          if (windup && !(e.didHit && f > last)) {
            const side = evadeDir(u, -dy, dx);
            const imminent = hits ? (f >= first - 1) : e.state === "dash";
            consider((imminent ? 88 : 58) + (reach - dist), side.x, side.y, "melee");
          }
        }
      }
      if (e.cast) {
        const c = e.cast;
        const dx = u.x - c.x;
        const dy = u.y - c.y;
        const dist = Math.hypot(dx, dy);
        const p = c.dur > 0 ? c.t / c.dur : 1;
        if (p >= 0.4 && dist <= c.r + u.radius + 12) {
          const outX = dist < 1 ? -(u.facing || 1) : dx / dist;
          const outY = dist < 1 ? 0 : dy / dist;
          const side = evadeDir(u, -outY, outX);
          consider(64 + p * 48 + (c.r - dist) * 0.3, outX * 0.75 + side.x * 0.65, outY * 0.75 + side.y * 0.65, "cast");
        }
      }
    }
    for (let i = 0; i < m.shots.length; i++) {
      const p = m.shots[i];
      if (p.team === u.team || p.dead) continue;
      const dx = u.x - p.x;
      const dy = (u.y - 16) - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 210 || dist < 6) continue;
      const closing = p.vx * dx + p.vy * dy;
      if (closing <= 30) continue;
      const sp = Math.hypot(p.vx, p.vy) || 1;
      const eta = dist / sp;
      if (eta > 0.38) continue;
      const nx = -p.vy / sp;
      const ny = p.vx / sp;
      const lateral = Math.abs(dx * nx + dy * ny);
      if (lateral > u.radius + p.r + 14) continue;
      const side = evadeDir(u, nx, ny);
      consider(96 - eta * 140, side.x, side.y, "shot");
    }
    return best;
  }

  function maybeRoll(m, u, dist) {
    if (u.summon || u.rollCd > 0 || u.iframe > 0) {
      return false;
    }
    const th = incomingThreat(m, u);
    const pr = IL.PERSONAS && IL.PERSONAS[u.personality];
    let need = pr ? pr.roll : u.personality === "bold" ? 98 : u.personality === "wary" ? 66 : 78;
    if (u.tactic === "hold") need -= 8;
    if (u.ai && u.ai.evade === "often") need -= 16;
    else if (u.ai && u.ai.evade === "rarely") need += 18;
    if (!th || th.score < need) {
      u.sawThreat = false;
      return false;
    }
    if (u.sawThreat) return false;
    u.sawThreat = true;
    if (u.role === "tank" && th.kind === "melee" && u.blockCd <= 0 && dist < 110) return false;
    const trader = u.role === "melee" || u.role === "dash" || u.role === "tank";
    if (th.kind === "melee" && trader && u.cool <= 0 && dist <= u.range + 16 && th.score < 112) return false;
    if (m.rng() > PACE.rollChance) return false;
    startRoll(m, u, th.x, th.y);
    return true;
  }

  function arm(u, cd) {
    u.abilityCd = cd * (u.abilityCdMul || 1) * PACE.abilityCd;
  }

  function startMend(m, u, ally) {
    face(u, ally);
    u.state = "cast";
    u.anim = "cast1";
    u.animT = 0;
    u.actT = 0.62;
    u.vx = 0;
    u.vy = 0;
    u.z = 0;
    u.cast = { x: ally.x, y: ally.y, r: 40, t: 0, dur: 0.62, kind: "mend", targetId: ally.id };
    arm(u, kitOf(u.cls).ability.cd || 6.5);
  }

  function startShadow(m, u, target) {
    const behind = -(target.facing || 1);
    u.x = target.x + behind * 48;
    u.y = target.y + (m.rng() - 0.5) * 28;
    u.facing = target.x >= u.x ? 1 : -1;
    u.state = "dash";
    u.anim = "dash";
    u.animT = 0;
    u.actT = 0.22;
    u.vx = u.facing * 70;
    u.vy = 0;
    u.z = 0;
    u.didHit = false;
    u.dashDmg = 0.35;
    u.iframe = 0.18;
    u.critNext = true;
    u.dashCd = 2.3;
    u.trail = [];
    arm(u, kitOf(u.cls).ability.cd || 7);
    m.stats.dashes++;
    m.stats.abilities++;
    fx(m, "dash", u.x, u.y - 12, { facing: u.facing, size: 130 });
    fx(m, "smoke", u.x, u.y + 4, { size: 110, ground: true });
    cue(m, "spell_shadow_cast");
    cue(m, "summon");
  }

  function startCharge(m, u, target) {
    u.dashDmg = 1.7 * (1 + ((u.pv && u.pv.chargeMul) || 0));
    startDash(m, u, target);
    cue(m, "swing_blade");
    arm(u, kitOf(u.cls).ability.cd || 7);
    m.stats.abilities++;
    fx(m, "slash", u.x + u.facing * 20, u.y - 16, { facing: u.facing, size: 150, team: u.team });
  }

  /* Level-up ranks: +8% power and -6% cooldown per rank above I. */
  function rankMul(u, id) {
    const r = id && u && u.ranks ? (u.ranks[id] | 0) : 0;
    return r > 1 ? 1 + (IL.RANK_POW || 0.08) * (Math.min(5, r) - 1) : 1;
  }

  function rankCd(u, id) {
    const r = id && u && u.ranks ? (u.ranks[id] | 0) : 0;
    return r > 1 ? Math.max(0.5, 1 - (IL.RANK_CD || 0.06) * (Math.min(5, r) - 1)) : 1;
  }

  /* Specializations from level-up v2. */
  function specOf(u, id) {
    return id && u && u.specs ? u.specs[id] : null;
  }

  function specCd(u, id) {
    const sp = specOf(u, id);
    return sp && sp.mod === "swift" && IL.modValue ? 1 - IL.modValue("swift", sp.tier) / 100 : 1;
  }

  function specPow(u, id) {
    const sp = specOf(u, id);
    return sp && sp.mod === "heavy" && IL.modValue ? 1 + IL.modValue("heavy", sp.tier) / 100 : 1;
  }

  function spend(u, ab) {
    if (!u.cds) u.cds = {};
    const cost = abCost(ab);
    if (cost && !u.summon) u[cost.pool] = Math.max(0, (u[cost.pool] == null ? 100 : u[cost.pool]) - cost.n);
    u.cds[ab.id] = (ab.cd || 6.5) * (u.abilityCdMul || 1) * rankCd(u, ab.id) * specCd(u, ab.id) * PACE.abilityCd * (u.stormCd || 1);
    if (ab && ab.id) {
      u.swingTag = { id: ab.id, name: ab.name };
      if (!u.byAb) u.byAb = {};
      const row = u.byAb[ab.id] || (u.byAb[ab.id] = { id: ab.id, name: ab.name, dmg: 0, heal: 0 });
      row.used = true;
      row.uses = (row.uses || 0) + 1;
      if (!row.name) row.name = ab.name;
    }
    arm(u, ab.cd || 6.5);
  }

  /* v105 ability costs, after Eslabong: spells, items and skills spend
     mana; swings, thrusts, shots and dashes spend stamina. Both pools are
     100 and refill every second. */
  const MANA_ROWS = { spell: 1, item: 1, skill: 1 };
  function abCost(ab) {
    if (!ab || !ab.cd) return null;
    return { pool: MANA_ROWS[ab.row] ? "mana" : "sta", n: Math.round(6 + ab.cd * 1.6) };
  }
  function readyAb(u, ab) {
    if (!ab || !ab.kind || !ab.cd) return false;
    const left = u.cds && u.cds[ab.id];
    if (left > 0) return false;
    const c = abCost(ab);
    if (c && !u.summon && (u[c.pool] == null ? 100 : u[c.pool]) < c.n) return false;
    return true;
  }

  function unlockedAbs(u) {
    if (u.summon) return [];
    const kit = kitOf(u.cls);
    const by = {};
    (kit.abilities || []).forEach(function (ab) { if (ab && ab.id) by[ab.id] = ab; });
    const ids = u.loadout && u.loadout.length
      ? u.loadout
      : (kit.abilities || []).filter(function (ab) { return ab && ab.unlock && ab.unlock <= 7; }).map(function (ab) { return ab.id; });
    const learned = u.learned || [];
    const lv = u.level || 1;
    const list = ids.map(function (id) { return by[id]; }).filter(function (ab) {
      if (!ab) return false;
      if (learned.indexOf(ab.id) >= 0) return true;
      return (ab.unlock || 1) <= lv;
    });
    return u.grantAbs && u.grantAbs.length ? list.concat(u.grantAbs) : list;
  }

  function missileMotion(u) {
    const sheet = u.parts && u.parts.sheet;
    if (IL.sheetHasGun && IL.sheetHasGun(sheet)) return "gun";
    if (IL.sheetHasBow && IL.sheetHasBow(sheet)) return "bow";
    return "atk1";
  }

  function armRow(u, ab) {
    const spec = (IL.ABILITY_ROWS && IL.ABILITY_ROWS[ab.row]) || { clip: "atk2", hold: 0.4 };
    u.rowClip = spec.clip;
    u.rowHold = spec.hold + ((IL.hashStr(ab.id) % 5) * 0.04);
    u.forceShot = !!spec.shot;
    u.wantMotion = spec.shot ? missileMotion(u) : (ab.row === "spell" ? "magic" : (spec.motion || null));
  }

  function pose(u, ab) {
    const spec = (IL.ABILITY_ROWS && IL.ABILITY_ROWS[ab.row]) || { clip: "atk2", hold: 0.4 };
    const held = weaponOf(u);
    const ranged = held === "bow" || held === "gun" || held === "crossbow";
    const clip = spec.shot && !ranged ? "cast1" : spec.clip;
    u.state = "attack";
    u.anim = clip;
    u.animT = 0;
    u.actT = Math.max(IL.clipDur(clip), spec.hold + ((IL.hashStr(ab.id) % 5) * 0.04));
    u.didHit = true;
    u.didSlash = true;
    u.forceShot = false;
    u.motion = spec.shot ? (ranged ? missileMotion(u) : "magic") : (ab.row === "spell" ? "magic" : (spec.motion || null));
    u.vx = 0;
    u.vy = 0;
  }

  function posed(u, ab) {
    pose(u, ab);
    return "go";
  }

  function summonPet(m, u, ab) {
    let live = 0;
    for (let i = 0; i < m.units.length; i++) {
      const e = m.units[i];
      if (e.summon && e.summoner === u.id && e.hp > 0) live++;
    }
    if (live >= 1) return false;
    const pet = makeUnit({
      id: u.id + ":pet:" + Math.floor(m.time * 10),
      name: ab.pet || "Familiar",
      cls: "warrior",
      level: 1,
      parts: u.parts,
      personality: "bold",
      tactic: "strike",
      summon: true
    }, u.team, 0, 1, m.teams);
    pet.summon = true;
    pet.summoner = u.id;
    pet.sprite = u.sprite;
    const pv = u.pv || {};
    pet.life = (ab.life || 6) * (1 + (pv.petLife || 0));
    pet.hp = Math.max(18, Math.round(u.maxHp * (ab.petHp || 0.26) * (1 + (pv.petHp || 0))));
    pet.maxHp = pet.hp;
    pet.atk = Math.max(6, Math.round(u.atk * (ab.petAtk || 0.4) * (1 + (pv.petAtk || 0))));
    pet.range = 36;
    pet.role = "melee";
    pet.radius = 12;
    pet.leaps = false;
    pet.x = u.x + u.facing * 40;
    pet.y = u.y + 18;
    pet.cds = {};
    pet.abilities = null;
    pet.bookTag = { id: ab.id, name: ab.name };
    m.units.push(pet);
    cue(m, "summon");
    fx(m, ab.fx || "smoke", pet.x, pet.y - 12, { size: 140 });
    return true;
  }

  function throwVial(m, u, t, ab) {
    const ox = u.x + u.facing * 16;
    const oy = u.y - 16;
    const dx = t.x - ox;
    const dy = (t.y - 14) - oy;
    const d = Math.hypot(dx, dy) || 1;
    const flask = weaponOf(u) !== "gun";
    if (flask) cue(m, "spell_poison_cast");
    else cue(m, "gunshot");
    m.shots.push({
      x: ox, y: oy,
      vx: dx / d * 420, vy: dy / d * 420,
      team: u.team, dmg: Math.round(u.atk * (ab.power || 0.85) * (1 + ((u.pv && u.pv.vialMul) || 0))),
      r: 9, life: 1.1, src: u.id, trail: [], drop: 20, pierce: 0,       hit: {},
      spell: flask ? "spell_poison_impact" : null,
      snd: flask ? null : "hit_bullet",
      srcTag: { id: ab.id, name: ab.name }
    });
    liftShot(m.shots[m.shots.length - 1], u, 0, -14, d);
    m.stats.shots++;
    fx(m, ab.fx || "boom", ox, oy, { size: 90, facing: u.facing });
  }

  /* id marks a real ability (drawn as its icon over the head); basic
     attacks raise a banner without one and draw nothing. */
  function raiseBanner(u, name, ult, life, id) {
    if (!u || !name) return;
    u.banner = { name: String(name), t: 0, life: life || (ult ? 1.15 : 0.85), ult: !!ult, id: id || "" };
  }

  function beginCine(m, u, ab) {
    if (!m || !ab || !ab.ult) return;
    if (m.cine && m.cine.t < m.cine.dur) return;
    m.cine = { name: ab.name, who: u && u.name, t: 0, dur: 0.95 };
  }

  function paintKind(m, u, t, ab) {
    const k = ab.kind;
    const x2 = t ? t.x : u.x + u.facing * 90;
    const y2 = t ? t.y - 16 : u.y - 16;
    const rings = { cleave: 1, nova: 1, zone: 1, arc: 1, frost: 1, fireball: 1, rage: 1, buff: 1, summon: 1 };
    const beams = { bolt: 1, pierce: 1 };
    if (rings[k]) {
      const atCaster = k === "cleave" || k === "rage" || k === "buff" || k === "summon";
      m.events.push({
        type: "ring",
        x: atCaster ? u.x + (k === "summon" ? u.facing * 36 : 0) : x2,
        y: atCaster ? u.y : (t ? t.y : u.y),
        r: ab.radius || (k === "summon" ? 40 : 72),
        kind: k
      });
    } else if (beams[k]) {
      m.events.push({ type: "beam", x: u.x, y: u.y - 22, x2: x2, y2: y2, kind: k });
    } else if ((k === "debuff" || k === "dot" || k === "vial") && t && Math.hypot(t.x - u.x, t.y - u.y) > 80) {
      m.events.push({ type: "beam", x: u.x, y: u.y - 22, x2: x2, y2: y2, kind: k });
    }
    if (k === "shield") fx(m, "orbit", u.x, u.y - 18, { size: 156 });
    else if (k === "summon") fx(m, "plasma", u.x + u.facing * 36, u.y - 8, { size: 160 });
    else if (k === "heal" || k === "mend") fx(m, "plasma", x2, y2, { size: 140 });
    else if (k === "charge" || k === "shadowstep" || k === "skirmish" || k === "lunge") {
      fx(m, "dash", u.x, u.y - 12, { facing: u.facing, size: 150 });
    } else if (k === "multishot" || k === "vial") {
      fx(m, "shot", u.x + u.facing * 18, u.y - 16, { facing: u.facing, size: 96 });
    } else if (k === "buff") fx(m, "spark", u.x, u.y - 30, { size: 130 });
    else if (k === "debuff" || k === "dot" || k === "stun" || k === "taunt" || k === "knock") {
      fx(m, k === "dot" ? "smoke" : "spark", x2, y2, { size: 124 });
    }
  }

  function noteAbility(m, u, t, ab) {
    if (ab && ab.id) u.swingTag = { id: ab.id, name: ab.name };
    const life = u && u.cast && u.cast.dur ? u.cast.dur + 0.35 : 0;
    raiseBanner(u, ab.name, !!ab.ult, life, ab.id);
    paintKind(m, u, t, ab);
    beginCine(m, u, ab);
    if (!u || u.state !== "cast") paintSignature(m, u, t, ab);
  }

  /* Events and a sound only. No damage, no cooldown, no fight rng. */
  function paintSignature(m, u, t, ab) {
    if (!m || !u || !ab || !ab.id || !IL.SIGNATURES) return;
    const spec = IL.SIGNATURES[u.cls + ":" + ab.id] || IL.SIGNATURES[ab.id];
    if (!spec) return;
    if (u._sigId === ab.id && u._sigT === m.time) return;
    u._sigId = ab.id;
    u._sigT = m.time;
    let ax = u.x;
    let ay = u.y;
    if (spec.anchor === "ally") {
      const ally = lowestAlly(m, u) || u;
      ax = ally.x;
      ay = ally.y;
    } else if (spec.anchor === "pet") {
      ax = u.x + (u.facing || 1) * 40;
      ay = u.y + 12;
    } else if (spec.anchor === "foe") {
      ax = t ? t.x : u.x + (u.facing || 1) * 80;
      ay = t ? t.y : u.y;
    }
    const ev = {
      type: "sig",
      style: spec.style,
      mark: spec.mark || "",
      rgb: spec.rgb,
      r: spec.r || 64,
      sheet: spec.sheet || "",
      facing: u.facing || 1,
      team: u.team || 0,
      life: spec.life || 0.6,
      size: spec.size || 160,
      hop: 0
    };
    if (spec.style === "chain") {
      ev.x = u.x;
      ev.y = u.y - 18;
      ev.x2 = ax;
      ev.y2 = ay - 16;
      ev.x3 = ax;
      ev.y3 = ay - 16;
      let best = null;
      let bestD = 180;
      for (let i = 0; i < m.units.length; i++) {
        const e = m.units[i];
        if (!e || e.hp <= 0 || e.team === u.team) continue;
        const d = Math.hypot(e.x - ax, e.y - ay);
        if (d < 12 || d >= bestD) continue;
        bestD = d;
        best = e;
      }
      if (best) {
        ev.hop = 1;
        ev.x3 = best.x;
        ev.y3 = best.y - 16;
      }
    } else if (spec.style === "trail") {
      ev.x = u.x + (u.facing || 1) * 16;
      ev.y = u.y - 18;
      ev.x2 = ax;
      ev.y2 = ay - 14;
    } else {
      ev.x = ax;
      ev.y = ay;
      ev.x2 = u.x;
      ev.y2 = u.y;
    }
    m.events.push(ev);
    if (spec.cue) cue(m, spec.cue);
  }

  /* forced: a move the player ordered (or a scripted cast); the
     autobattle judgment below (wait for a group, redirect to a caster)
     never overrides it. */
  /* v96 shared helpers for the new mechanics. */
  function silenceUnit(m, e, time) {
    e.silence = Math.max(e.silence || 0, time);
    if (e.cast && e.cast.ability) {
      e.cast = null;
      e.state = "idle";
      e.anim = idleClip(e);
      e.actT = 0;
      m.events.push({ type: "dmg", x: e.x, y: e.y - 52, n: "Silenced", team: e.team });
    }
  }
  function pullUnit(m, u, e, gap) {
    const dx = e.x - u.x;
    const dy = e.y - u.y;
    const d = Math.hypot(dx, dy) || 1;
    const stop = (u.radius || 14) + (e.radius || 14) + (gap || 10);
    if (d <= stop + 4) return;
    e.pullTo = { x: u.x + dx / d * stop, y: u.y + dy / d * stop, t: 0.45 };
    e.stun = Math.max(e.stun || 0, 0.3);
    e.cast = e.cast && e.cast.ability ? null : e.cast;
    m.events.push({ type: "beam", x: u.x, y: u.y - 22, x2: e.x, y2: e.y - 18, kind: "pull" });
  }
  function nextFoe(m, team, from, r, skip) {
    let best = null;
    let bd = r;
    for (let i = 0; i < m.units.length; i++) {
      const e = m.units[i];
      if (e.team === team || e.hp <= 0 || skip[e.id]) continue;
      const d = Math.hypot(e.x - from.x, e.y - from.y);
      if (d <= bd) { bd = d; best = e; }
    }
    return best;
  }
  function evoSupport(m, u, ally, ab, amount, kind) {
    const evo = u.evos && u.evos[ab.id];
    if (!evo || !ally) return;
    if (evo === "lasting") ally.hot = { t: 3, rate: ally.maxHp * 0.04 };
    else if (evo === "shared") {
      let best = null;
      let ratio = 1.01;
      for (let i = 0; i < m.units.length; i++) {
        const a = m.units[i];
        if (a.team !== u.team || a.hp <= 0 || a === ally) continue;
        const r = a.hp / a.maxHp;
        if (r < ratio) { ratio = r; best = a; }
      }
      if (!best) return;
      if (kind === "shield") {
        best.shield += Math.round(amount * 0.5);
        fx(m, "orbit", best.x, best.y - 18, { size: 120 });
      } else healUnit(m, u, best, amount * 0.5);
    }
  }

  function fireOne(m, u, t, dist, ab, forced) {
    if (!u.pv) u.pv = {};
    const reach = u.range + (t ? t.radius : 0);
    const paint = ab.fx || "spark";
    function finish(code) {
      if (code !== "skip") noteAbility(m, u, t, ab);
      return code;
    }
    /* v92: an area move waits for two targets while two or more stand. */
    const need = u.ai && u.ai.aoe === "any" ? 1 : u.ai && u.ai.aoe === "three" ? 3 : 2;
    const lone = forced || foesLeft(m, u) < need || (ab.ult && m.time > 20);
    if (!lone && (ab.kind === "cleave") && t && crowdAt(m, u, u.x, u.y, u.range + 40) < need && !mistake(m, u)) return "skip";
    if (!lone && (ab.kind === "nova" || ab.kind === "frost" || ab.kind === "arc") && t && crowdAt(m, u, t.x, t.y, ab.radius || 68) < need && !mistake(m, u)) return "skip";
    /* v105 friendly fire: blasts hurt allies in the area too. */
    if (!forced && (ab.kind === "nova" || ab.kind === "frost") && t) {
      const r = ab.radius || 68;
      let mates = 0;
      for (let i = 0; i < m.units.length; i++) {
        const a = m.units[i];
        if (a.team === u.team && a !== u && a.hp > 0 && Math.hypot(a.x - t.x, a.y - t.y) <= r + 10) mates++;
      }
      const ff = (u.ai && u.ai.ff) || "avoid";
      if (mates > 0 && ff === "avoid" && !mistake(m, u)) return "skip";
      if (mates > 0 && ff === "calc" && crowdAt(m, u, t.x, t.y, r) <= mates) return "skip";
    }
    if (!forced && (ab.kind === "stun" || ab.kind === "knock")) {
      const r0 = ab.reach || (reach + 12);
      for (let i = 0; i < m.units.length; i++) {
        const e = m.units[i];
        if (e.team === u.team || e.hp <= 0 || e.state !== "cast" || e === t) continue;
        const de = Math.hypot(e.x - u.x, e.y - u.y);
        if (de <= r0) { t = e; dist = de; break; }
      }
    }
    if (ab.kind === "cleave" && t && dist <= reach + 6 && u.cool <= 0) {
      u.cleave = true;
      spend(u, ab);
      m.stats.abilities++;
      armRow(u, ab);
      startAttack(u, "atk2", t);
      fx(m, paint, u.x + u.facing * 20, u.y - 16, { facing: u.facing, size: 150, team: u.team });
      return finish("go");
    }
    if (ab.kind === "lunge" && t && dist <= reach + 28 && u.cool <= 0) {
      u.critNext = true;
      spend(u, ab);
      m.stats.abilities++;
      armRow(u, ab);
      startAttack(u, "atk3", t);
      fx(m, paint, u.x + u.facing * 24, u.y - 20, { facing: u.facing, size: 160, team: u.team });
      return finish("go");
    }
    if ((ab.kind === "multishot" || ab.kind === "pierce") && t && dist <= u.range + 8 && dist >= 70 && u.cool <= 0) {
      u.volley = ab.kind === "multishot" ? 3 : 1;
      if (ab.kind === "pierce") u.pierceBoost = 1;
      spend(u, ab);
      m.stats.abilities++;
      armRow(u, ab);
      startAttack(u, "atk1", t);
      return finish("go");
    }
    if (ab.kind === "taunt" && dist < 220) {
      u.taunt = 3.2;
      spend(u, ab);
      m.stats.abilities++;
      cue(m, "shield_up");
      fx(m, paint, u.x, u.y - 18, { size: 160 });
      return finish(posed(u, ab));
    }
    if (ab.kind === "zone" && dist < 120) {
      startBlock(m, u);
      u.guardZone = true;
      u.actT = 0.82 * (1 + ((u.pv && u.pv.zoneTime) || 0));
      spend(u, ab);
      m.stats.abilities++;
      fx(m, paint, u.x, u.y - 10, { size: 180, ground: true });
      for (let i = 0; i < m.units.length; i++) {
        const e = m.units[i];
        if (e.team === u.team || e.hp <= 0) continue;
        if (Math.hypot(e.x - u.x, e.y - u.y) <= 78) deal(m, u, e, Math.round(u.atk * 0.35));
      }
      return finish("go");
    }
    if (ab.kind === "rage" && u.hp < u.maxHp * 0.72) {
      u.rage = 4;
      spend(u, ab);
      m.stats.abilities++;
      fx(m, paint, u.x, u.y - 20, { size: 150 });
      return finish(posed(u, ab));
    }
    if (ab.kind === "mend" || ab.kind === "heal") {
      const ally = lowestAlly(m, u);
      if (!ally) return "skip";
      if (ab.kind === "heal") {
        u.swingTag = { id: ab.id, name: ab.name };
        const amt = Math.round(ally.maxHp * (ab.power || 0.16) + u.atk * 0.25);
        healUnit(m, u, ally, amt);
        evoSupport(m, u, ally, ab, amt, "heal");
        fx(m, paint, ally.x, ally.y - 16, { size: 140 });
        spend(u, ab);
        return finish(posed(u, ab));
      }
      startMend(m, u, ally, ab.cd);
      if (u.cast) u.cast.abId = ab.id;
      spend(u, ab);
      return finish("go");
    }
    if (ab.kind === "shadowstep" && t && dist > 80 && dist < 460) {
      startShadow(m, u, t);
      spend(u, ab);
      return finish("go");
    }
    if (ab.kind === "charge" && t && dist > 60 && dist < 360) {
      startCharge(m, u, t);
      spend(u, ab);
      return finish("go");
    }
    if (ab.kind === "skirmish" && t && dist > 90 && dist < 280) {
      u.dashDmg = 0.45;
      startDash(m, u, t);
      u.actT = 0.24;
      spend(u, ab);
      m.stats.abilities++;
      fx(m, paint, u.x, u.y - 12, { facing: u.facing, size: 120 });
      return finish("go");
    }
    if (ab.kind === "arc" && t && dist < u.range + 90 && u.cool <= 0) {
      startCast(m, u, t);
      if (u.cast) { u.cast.kind = "arc"; u.cast.ability = true; }
      spend(u, ab);
      return finish("go");
    }
    if ((ab.kind === "nova" || ab.kind === "bolt") && t && dist < (ab.reach || u.range + 80)) {
      startCast(m, u, t);
      if (u.cast) {
        u.cast.kind = ab.kind;
        u.cast.ability = ab.kind !== "bolt";
        u.cast.r = ab.radius || (ab.kind === "bolt" ? 24 : 68);
        u.cast.power = ab.power || 0.9;
        u.cast.fx = paint;
        u.cast.slow = ab.slow || 0;
        u.actT = 0.55 + ((IL.hashStr(ab.id) % 5) * 0.04);
        u.motion = "magic";
      }
      spend(u, ab);
      return finish("go");
    }
    if (ab.kind === "dot" && t && dist <= (ab.reach || reach + 8)) {
      t.bleed = { t: ab.dot || 3.2, acc: 0, dmg: Math.max(2, Math.round(u.atk * (ab.power || 0.25) * (1 + (u.pv.dotMul || 0)))), src: u.id, tag: { id: ab.id, name: ab.name }, hex: u.pv.hexVuln || 0 };
      m.stats.bleeds++;
      spend(u, ab);
      m.stats.abilities++;
      fx(m, paint, t.x, t.y - 16, { size: 120 });
      deal(m, u, t, Math.round(u.atk * 0.35));
      return finish(posed(u, ab));
    }
    if (ab.kind === "shield") {
      let ally = u;
      if (!ab.self) ally = lowestAlly(m, u) || u;
      const sh = Math.round(ally.maxHp * (ab.power || 0.1) * (1 + (u.pv.shieldMul || 0)));
      ally.shield += sh;
      if (ally !== u) { if (!ally.helpedBy) ally.helpedBy = {}; ally.helpedBy[u.id] = m.time; }
      evoSupport(m, u, ally, ab, sh, "shield");
      spend(u, ab);
      m.stats.abilities++;
      cue(m, "shield_up");
      fx(m, paint, ally.x, ally.y - 18, { size: 140 });
      return finish(posed(u, ab));
    }
    if (ab.kind === "buff") {
      const targets = ab.team ? m.units.filter(function (e) { return e.team === u.team && e.hp > 0 && !e.summon; }) : [u];
      for (let i = 0; i < targets.length; i++) {
        targets[i].buff = Math.max(targets[i].buff || 0, (ab.time || 3.5) * (1 + (u.pv.buffTime || 0)));
        targets[i].buffAtk = Math.max(targets[i].buffAtk || 1, 1 + (ab.power || 0.12));
      }
      spend(u, ab);
      m.stats.abilities++;
      fx(m, paint, u.x, u.y - 20, { size: 150 });
      return finish(posed(u, ab));
    }
    if (ab.kind === "debuff" && t && dist <= (ab.reach || 220)) {
      t.slow = Math.max(t.slow || 0, ab.time || 2.2);
      spend(u, ab);
      m.stats.abilities++;
      fx(m, paint, t.x, t.y - 16, { size: 130 });
      return finish(posed(u, ab));
    }
    if (ab.kind === "stun" && t && dist <= (ab.reach || reach + 12)) {
      t.stun = Math.max(t.stun || 0, (ab.stun || 0.55) * (1 + (u.pv.stunTime || 0)));
      t.state = "hurt";
      t.anim = "hurt";
      t.animT = 0;
      t.actT = t.stun;
      t.vx = 0;
      t.vy = 0;
      spend(u, ab);
      m.stats.abilities++;
      fx(m, paint, t.x, t.y - 18, { size: 140 });
      deal(m, u, t, Math.round(u.atk * (ab.power || 0.4)));
      return finish(posed(u, ab));
    }
    if (ab.kind === "knock" && t && dist <= (ab.reach || reach + 16)) {
      const dx = t.x - u.x;
      const dy = t.y - u.y;
      const d = Math.hypot(dx, dy) || 1;
      const push = (ab.force || 240) * (1 - ((t.pv && t.pv.knockResist) || 0));
      t.vx = dx / d * push;
      t.vy = dy / d * push;
      spend(u, ab);
      m.stats.abilities++;
      fx(m, paint, t.x, t.y - 14, { facing: u.facing, size: 140, team: u.team });
      deal(m, u, t, Math.round(u.atk * (ab.power || 0.35)));
      return finish(posed(u, ab));
    }
    if ((ab.kind === "frost" || ab.kind === "fireball") && t && dist < (ab.reach || (u.range || 180) + 48)) {
      startCast(m, u, t);
      if (u.cast) {
        u.cast.kind = ab.kind;
        u.cast.ability = ab.kind === "frost";
        u.cast.r = ab.kind === "fireball" ? 28 : (ab.radius || u.cast.r || 70);
        u.cast.fx = paint;
        u.cast.slow = ab.kind === "frost" ? 2.1 : 0;
        u.anim = ab.kind === "fireball" ? "cast2" : "cast1";
        u.motion = "magic";
      }
      if (ab.cd) spend(u, ab);
      return finish("go");
    }
    if (ab.kind === "summon") {
      if (!summonPet(m, u, ab)) return "skip";
      spend(u, ab);
      m.stats.abilities++;
      return finish(posed(u, ab));
    }
    if (ab.kind === "vial" && t && dist <= (ab.reach || 220) && dist >= 48) {
      throwVial(m, u, t, ab);
      spend(u, ab);
      m.stats.abilities++;
      return finish(posed(u, ab));
    }
    /* v96 new mechanics. Pull prefers an enemy caster, archer or support. */
    if (ab.kind === "pull") {
      let e = t;
      let best = -1;
      for (let i = 0; i < m.units.length; i++) {
        const c = m.units[i];
        if (c.team === u.team || c.hp <= 0 || c.summon) continue;
        const d = Math.hypot(c.x - u.x, c.y - u.y);
        if (d < 90 || d > (ab.reach || 280)) continue;
        const back = c.role === "cast" || c.role === "kite" || c.role === "support" ? 100 : 0;
        const v = back - d * 0.1;
        if (v > best) { best = v; e = c; }
      }
      if (!e || best < -1e8 || Math.hypot(e.x - u.x, e.y - u.y) < 90 || Math.hypot(e.x - u.x, e.y - u.y) > (ab.reach || 280)) return "skip";
      spend(u, ab);
      m.stats.abilities++;
      u.swingTag = { id: ab.id, name: ab.name };
      pullUnit(m, u, e, 10);
      deal(m, u, e, Math.round(u.atk * (ab.power || 0.3)), { tag: u.swingTag });
      fx(m, paint, e.x, e.y - 16, { size: 130 });
      return finish(posed(u, ab));
    }
    if (ab.kind === "root" && t && dist <= (ab.reach || 220)) {
      t.root = Math.max(t.root || 0, ab.time || 1.6);
      spend(u, ab);
      m.stats.abilities++;
      u.swingTag = { id: ab.id, name: ab.name };
      deal(m, u, t, Math.round(u.atk * (ab.power || 0.2)), { tag: u.swingTag });
      m.events.push({ type: "dmg", x: t.x, y: t.y - 52, n: "Rooted", team: t.team });
      fx(m, "smoke", t.x, t.y - 4, { size: 120, ground: true });
      return finish(posed(u, ab));
    }
    if (ab.kind === "silence" && t) {
      let e = null;
      for (let i = 0; i < m.units.length; i++) {
        const c = m.units[i];
        if (c.team === u.team || c.hp <= 0 || !c.cast || !c.cast.ability) continue;
        if (Math.hypot(c.x - u.x, c.y - u.y) <= (ab.reach || 260)) { e = c; break; }
      }
      if (!e && dist <= (ab.reach || 260) && (t.role === "cast" || t.role === "support" || t.role === "hybrid")) e = t;
      if (!e && !forced && m.time < 18) return "skip";
      e = e || (dist <= (ab.reach || 260) ? t : null);
      if (!e) return "skip";
      spend(u, ab);
      m.stats.abilities++;
      u.swingTag = { id: ab.id, name: ab.name };
      silenceUnit(m, e, ab.time || 2.5);
      deal(m, u, e, Math.round(u.atk * (ab.power || 0.15)), { tag: u.swingTag });
      fx(m, paint, e.x, e.y - 30, { size: 120 });
      return finish(posed(u, ab));
    }
    if (ab.kind === "chain" && t && dist <= (ab.reach || u.range + 60)) {
      spend(u, ab);
      m.stats.abilities++;
      u.swingTag = { id: ab.id, name: ab.name };
      const hit = {};
      let from = u;
      let cur = t;
      let mul = ab.power || 0.6;
      for (let j = 0; j <= (ab.jumps || 2) && cur; j++) {
        m.events.push({ type: "beam", x: from.x, y: from.y - 22, x2: cur.x, y2: cur.y - 18, kind: "bolt" });
        fx(m, "bolt", cur.x, cur.y - 16, { size: 120 });
        hit[cur.id] = true;
        deal(m, u, cur, Math.round(u.atk * mul), { tag: u.swingTag, spell: "spell_lightning_impact", silent: j > 0 });
        from = cur;
        cur = nextFoe(m, u.team, cur, 150, hit);
        mul *= 0.75;
      }
      cue(m, "spell_lightning_impact");
      return finish(posed(u, ab));
    }
    if (ab.kind === "drain" && t && dist <= (ab.reach || 220)) {
      spend(u, ab);
      m.stats.abilities++;
      u.swingTag = { id: ab.id, name: ab.name };
      const before = t.hp;
      deal(m, u, t, Math.round(u.atk * (ab.power || 0.55)), { tag: u.swingTag, spell: "spell_shadow_impact" });
      const took = Math.max(0, before - Math.max(0, t.hp));
      if (took > 0) healUnit(m, u, u, took);
      m.events.push({ type: "beam", x: t.x, y: t.y - 18, x2: u.x, y2: u.y - 22, kind: "drain" });
      return finish(posed(u, ab));
    }
    if (ab.kind === "revive") {
      if (u.raised) return "skip";
      let e = null;
      for (let i = 0; i < m.units.length; i++) {
        const c = m.units[i];
        if (c.team === u.team && c !== u && c.hp <= 0 && !c.summon && !c.wasRaised) { e = c; break; }
      }
      if (!e) return "skip";
      u.raised = true;
      e.wasRaised = true;
      e.hp = Math.max(1, Math.round(e.maxHp * (ab.power || 0.3)));
      e.alive = true;
      e.state = "idle";
      e.anim = idleClip(e);
      e.animT = 0;
      e.actT = 0;
      e.iframe = 1;
      e.bleed = null;
      e.stun = 0;
      e.root = 0;
      e.silence = 0;
      spend(u, ab);
      m.stats.abilities++;
      u.healing = (u.healing || 0) + e.hp;
      m.events.push({ type: "heal", x: e.x, y: e.y - 48, n: "Raised", team: e.team });
      m.events.push({ type: "beam", x: u.x, y: u.y - 22, x2: e.x, y2: e.y - 18, kind: "revive" });
      cue(m, "heal_chime");
      fx(m, "plasma", e.x, e.y - 16, { size: 170 });
      return finish(posed(u, ab));
    }
    if (ab.kind === "homing" && t && dist <= (ab.reach || 320) && dist >= 60) {
      spend(u, ab);
      m.stats.abilities++;
      u.swingTag = { id: ab.id, name: ab.name };
      const dx = t.x - u.x;
      const dy = t.y - u.y;
      const d = Math.hypot(dx, dy) || 1;
      const spell = ab.row === "spell";
      m.shots.push({
        x: u.x + u.facing * 16, y: u.y - 18,
        vx: -dy / d * 140 + dx / d * 230, vy: dx / d * 140 * (u.facing || 1) * 0.6 + dy / d * 230,
        team: u.team, dmg: Math.round(u.atk * (ab.power || 1)),
        r: 9, life: 2.4, src: u.id, trail: [], drop: 0, pierce: 0, hit: {},
        home: t.id, speed: 360, bolt: spell,
        spell: spell ? "spell_arcane_impact" : null,
        snd: spell ? null : "hit_arrow",
        srcTag: { id: ab.id, name: ab.name }
      });
      m.stats.shots++;
      cue(m, spell ? "spell_arcane_cast" : "bow_release");
      return finish(posed(u, ab));
    }
    return "skip";
  }

  /* The sheet's Ultimate row. A held ultimate still fires once the match
     is late, so a fighter never walks out with it unspent. */
  function ultWanted(m, u, t) {
    const want = u.ai && u.ai.ult;
    if (!want || want === "ready" || !t) return true;
    if (m.time > 26) return true;
    if (want === "finish") return t.hp / t.maxHp < 0.5;
    if (want === "crowd") {
      let near = 0;
      for (let i = 0; i < m.units.length; i++) {
        const e = m.units[i];
        if (e.team === u.team || e.hp <= 0) continue;
        if (Math.hypot(e.x - t.x, e.y - t.y) <= 96) near++;
      }
      return near >= 2;
    }
    return true;
  }

  function tryClassAbility(m, u, t, dist) {
    if (u.summon) return false;
    if (u.silence > 0) return false;
    const list = unlockedAbs(u);
    for (let i = list.length - 1; i >= 0; i--) {
      const ab = list[i];
      if (!readyAb(u, ab)) continue;
      if (ab.ult && !ultWanted(m, u, t)) continue;
      const result = fireOne(m, u, t, dist, ab);
      if (result === "skip") continue;
      return result === "go";
    }
    return false;
  }

  function think(m, u, dt) {
    if (u.stun > 0) {
      damp(u, 0.8);
      u.x += u.vx * dt;
      u.y += u.vy * dt;
      return;
    }
    const spd = moveSpeed(u);
    const t = nearest(m, u);
    if (!t) {
      damp(u, 0.85);
      u.x += u.vx * dt;
      u.y += u.vy * dt;
      setMoveAnim(u, dt);
      return;
    }
    face(u, t);
    u.tgtId = t.id;
    const dist = Math.hypot(t.x - u.x, t.y - u.y);
    if (maybeRoll(m, u, dist)) return;
    /* v92: step out of a marked spell instead of standing in it. */
    if (!u.summon && !(u.ai && u.ai.evade === "rarely")) {
      const zone = castDanger(m, u);
      if (zone && !u.dodgeSlip) {
        if (u.dodgeSlip == null) u.dodgeSlip = mistake(m, u);
        if (!u.dodgeSlip) {
          const ox = zone.d < 1 ? -(u.facing || 1) : (u.x - zone.x) / zone.d;
          const oy = zone.d < 1 ? 0.3 : (u.y - zone.y) / zone.d;
          steer(u, u.x + ox * 160, u.y + oy * 160, spd, dt);
          u.x += u.vx * dt;
          u.y += u.vy * dt;
          setMoveAnim(u, dt);
          return;
        }
      }
      if (!zone) u.dodgeSlip = null;
    }
    /* v99 live orders: Hold keeps the line, Regroup gathers on the captain. */
    const order = m.orders && m.orders[u.team];
    if (order === "hold" || order === "regroup") {
      const strike = (u.role === "kite" || u.role === "cast" || u.role === "support") ? (u.range || 200) + 8 : meleeReach(u, t) + 14;
      let ax = u.homeX != null ? u.homeX : u.x;
      let ay = u.homeY != null ? u.homeY : u.y;
      if (order === "regroup") {
        let cap = null;
        for (let i = 0; i < m.units.length; i++) {
          const c = m.units[i];
          if (c.team === u.team && c.hp > 0 && !c.summon && (c.captain || (m.pilot && c.id === m.pilot.id))) { cap = c; break; }
        }
        if (!cap) {
          let n = 0; ax = 0; ay = 0;
          for (let i = 0; i < m.units.length; i++) { const c = m.units[i]; if (c.team === u.team && c.hp > 0 && !c.summon) { ax += c.x; ay += c.y; n++; } }
          ax /= n || 1; ay /= n || 1;
        } else if (cap === u) { ax = u.x; ay = u.y; }
        else { ax = cap.x - (u.team === 0 ? 34 : -34); ay = cap.y + (u.y > cap.y ? 26 : -26); }
      }
      if (dist > strike) {
        if (tryClassAbility(m, u, t, dist)) return;
        if (Math.hypot(ax - u.x, ay - u.y) > (order === "regroup" ? 60 : 24)) {
          steer(u, ax, ay, spd, dt);
          u.x += u.vx * dt;
          u.y += u.vy * dt;
        } else damp(u, 0.8);
        setMoveAnim(u, dt);
        return;
      }
    }
    /* v109 Opening: Hold keeps the start line for 2 s unless a foe comes close. */
    if (u.ai && u.ai.open === "hold" && m.time < 2 && dist > meleeReach(u, t) + 40 && !u.summon) {
      if (tryClassAbility(m, u, t, dist)) return;
      damp(u, 0.8);
      setMoveAnim(u, dt);
      return;
    }
    /* v109 Protect: stay near the captain or the nearest back-liner. */
    const guardOn = u.ai && u.ai.guard && u.ai.guard !== "none" && !u.summon && order !== "engage";
    if (guardOn) {
      let ward = null, wd = 1e9;
      for (let i = 0; i < m.units.length; i++) {
        const a = m.units[i];
        if (a === u || a.team !== u.team || a.hp <= 0 || a.summon) continue;
        if (u.ai.guard === "captain" ? !a.captain : !hangsBack(a.role)) continue;
        const d = Math.hypot(a.x - u.x, a.y - u.y);
        if (d < wd) { wd = d; ward = a; }
      }
      if (ward && wd > 110 && dist > meleeReach(u, t) + 20) {
        if (tryClassAbility(m, u, t, dist)) return;
        steer(u, ward.x + (u.team === 0 ? 30 : -30), ward.y, spd, dt);
        u.x += u.vx * dt;
        u.y += u.vy * dt;
        setMoveAnim(u, dt);
        return;
      }
    }
    if (tryClassAbility(m, u, t, dist)) return;
    const reach = meleeReach(u, t);
    if (fallingBack(u) && u.role !== "tank" && order !== "engage") {
      /* Back off toward home and only swing at what follows. */
      const hx = u.homeX != null ? u.homeX : u.x;
      const hy = u.homeY != null ? u.homeY : u.y;
      if (dist <= (u.role === "kite" || u.role === "cast" ? u.range : reach) && u.cool <= 0) {
        if (u.role === "cast") startCast(m, u, t);
        else startAttack(u, u.attacks[u.atkCursor++ % u.attacks.length], t);
        return;
      }
      steer(u, hx, hy, spd, dt);
      u.x += u.vx * dt;
      u.y += u.vy * dt;
      setMoveAnim(u, dt);
      return;
    }
    const space = order === "engage" ? "close" : (u.ai && u.ai.range) || "kit";
    const kiteMin = space === "close" ? 78 : space === "far" ? 168 : 118;
    const castStop = space === "close" ? 0.48 : space === "far" ? 0.92 : 0.7;

    if (u.role === "melee") {
      const spot = standAt(u, t);
      if (dist <= reach && u.cool <= 0) {
        const clip = u.attacks[u.atkCursor % u.attacks.length];
        u.atkCursor++;
        startAttack(u, clip, t);
        return;
      }
      if (u.tactic !== "hold" && u.leaps && u.leapCd <= 0 && dist > reach + 6 && dist < reach + 150 && m.rng() < 0.04) {
        startLeap(m, u, t);
        return;
      }
      steer(u, spot.x, spot.y, spd, dt);
    } else if (u.role === "kite") {
      if (dist < kiteMin) steer(u, u.x - (t.x - u.x), u.y - (t.y - u.y), spd, dt);
      else if (dist > u.range - 16) steer(u, t.x, t.y, spd, dt);
      else {
        const dx = t.x - u.x;
        const dy = t.y - u.y;
        const d = Math.hypot(dx, dy) || 1;
        const wobble = (Math.floor(m.time * 0.7) % 2 === 0) ? 1 : -1;
        const side = (u.team === 0 ? 1 : -1) * wobble;
        steer(u, u.x + (-dy / d) * side * 120, u.y + (dx / d) * side * 120, spd * 0.72, dt);
      }
      if (dist <= u.range + 12 && dist >= 78 && u.cool <= 0) {
        const clip = u.attacks[u.atkCursor % u.attacks.length];
        u.atkCursor++;
        startAttack(u, clip, t);
        return;
      }
    } else if (u.role === "cast") {
      if (dist <= u.range && u.cool <= 0) {
        startCast(m, u, t);
        return;
      }
      const stop = u.range * castStop;
      if (dist > stop) steer(u, t.x, t.y, spd, dt);
      else damp(u, 0.7);
    } else if (u.role === "tank") {
      const tankSpot = standAt(u, t);
      if (dist < 96 && u.blockCd <= 0 && m.rng() < 0.5) {
        startBlock(m, u);
        return;
      }
      if (dist <= reach && u.cool <= 0) {
        const clip = u.attacks[u.atkCursor % u.attacks.length];
        u.atkCursor++;
        startAttack(u, clip, t);
        return;
      }
      steer(u, tankSpot.x, tankSpot.y, spd, dt);
    } else if (u.role === "dash") {
      if (u.dashCd <= 0 && dist > 78 && dist < 460) {
        startDash(m, u, t);
        return;
      }
      if (dist <= reach && u.cool <= 0) {
        const clip = u.attacks[u.atkCursor % u.attacks.length];
        u.atkCursor++;
        startAttack(u, clip, t);
        return;
      }
      if (u.leaps && u.leapCd <= 0 && dist > reach + 4 && dist < reach + 120 && m.rng() < 0.03) {
        startLeap(m, u, t);
        return;
      }
      const dashSpot = standAt(u, t);
      steer(u, dashSpot.x, dashSpot.y, spd, dt);
    } else if (u.role === "support") {
      let company = false;
      for (let i = 0; i < m.units.length; i++) {
        const a = m.units[i];
        if (a !== u && a.team === u.team && a.hp > 0 && !a.summon) company = true;
      }
      const ally = company ? lowestAlly(m, u) : null;
      if (!company) {
        const solo = standAt(u, t);
        if (dist <= reach && u.cool <= 0) {
          startAttack(u, "atk1", t);
          return;
        }
        steer(u, solo.x, solo.y, spd, dt);
      } else if (dist <= reach + 8 && u.cool <= 0 && !ally) {
        startAttack(u, "atk1", t);
        return;
      } else if (ally) {
        /* Stand just behind the wounded ally, on the home side of them. */
        const bx = ally.x + (u.team === 0 ? -28 : 28);
        steer(u, bx, ally.y, spd * 0.9, dt);
      } else {
        /* Hold the edge. Walking backward only piles them on the wall. */
        const hx = u.homeX != null ? u.homeX : u.x;
        const hy = u.homeY != null ? u.homeY : u.y;
        steer(u, hx, hy, spd * 0.9, dt);
      }
    } else if (u.role === "hybrid") {
      const hy = standAt(u, t);
      if (dist <= reach && u.cool <= 0) {
        const clip = u.attacks[u.atkCursor % u.attacks.length];
        u.atkCursor++;
        startAttack(u, clip, t);
        return;
      }
      steer(u, hy.x, hy.y, spd, dt);
    }

    u.x += u.vx * dt;
    u.y += u.vy * dt;
    setMoveAnim(u, dt);
  }

  function fallingBack(u) {
    const want = u.ai && u.ai.retreat;
    if (!want || want === "never") return false;
    const r = u.hp / u.maxHp;
    return want === "low" ? r < 0.3 : r < 0.5;
  }

  /* ---------- captain control ----------
     m.pilot = { id, mx, my, goX, goY, focusId, ab, abT, roll, auto }.
     The page writes intent; the step reads it. With no pilot the match
     is the same pure autobattle the sim checks. */
  function pilotUnit(m) {
    const P = m.pilot;
    if (!P || P.auto) return null;
    let u = unitById(m, P.id);
    if (!u || u.hp <= 0 || u.team !== 0) {
      u = null;
      for (let i = 0; i < m.units.length; i++) {
        const a = m.units[i];
        if (a.team === 0 && !a.summon && a.hp > 0) { u = a; break; }
      }
      if (u) {
        P.id = u.id;
        m.events.push({ type: "pilot", id: u.id, name: u.name });
      }
    }
    return u;
  }

  function pilotAbs(u) {
    return unlockedAbs(u);
  }

  function pilotAttack(m, u, t, dist) {
    if (u.cool > 0) return false;
    const reach = meleeReach(u, t);
    if (u.role === "cast") {
      if (dist > u.range) return false;
      startCast(m, u, t);
      return true;
    }
    if (u.role === "kite") {
      if (dist > u.range + 12) return false;
      startAttack(u, u.attacks[u.atkCursor++ % u.attacks.length], t);
      return true;
    }
    if (u.role === "support") {
      if (dist > reach + 8) return false;
      startAttack(u, "atk1", t);
      return true;
    }
    if (dist > reach) return false;
    startAttack(u, u.attacks[u.atkCursor++ % u.attacks.length], t);
    return true;
  }

  function pilotThink(m, u, dt) {
    const P = m.pilot;
    if (u.stun > 0) {
      damp(u, 0.8);
      u.x += u.vx * dt;
      u.y += u.vy * dt;
      return;
    }
    const spd = moveSpeed(u);
    let t = unitById(m, P.focusId);
    if (!t || t.hp <= 0 || t.team === u.team) {
      P.focusId = null;
      t = nearest(m, u, true);
    }
    P.targetId = t ? t.id : null;
    u.tgtId = P.targetId;
    const dist = t ? Math.hypot(t.x - u.x, t.y - u.y) : 1e9;
    const mx = P.mx || 0;
    const my = P.my || 0;
    const steering = mx !== 0 || my !== 0;
    if (P.ab != null) {
      const ab = pilotAbs(u)[P.ab];
      P.abT = (P.abT || 0) - dt;
      if (!ab || !readyAb(u, ab)) {
        P.ab = null;
      } else {
        if (t) face(u, t);
        const code = fireOne(m, u, t, dist, ab, true);
        if (code !== "skip") {
          P.ab = null;
          P.chase = false;
          if (u.state !== "idle" && u.state !== "run") return;
        } else if (P.abT <= 0) {
          m.events.push({ type: "pilotNo", name: ab.name });
          P.ab = null;
        }
      }
    }
    if (steering) {
      P.goX = null;
      P.chase = false;
      const len = Math.hypot(mx, my) || 1;
      steer(u, u.x + mx / len * 120, u.y + my / len * 120, spd, dt);
      if (Math.abs(u.vx) > 10) u.facing = u.vx > 0 ? 1 : -1;
    } else if (P.goX != null) {
      const d = Math.hypot(P.goX - u.x, P.goY - u.y);
      if (d < 6) {
        P.goX = null;
        damp(u, 0.6);
      } else {
        steer(u, P.goX, P.goY, spd, dt);
        if (Math.abs(u.vx) > 10) u.facing = u.vx > 0 ? 1 : -1;
      }
    } else if (t && (P.chase || P.ab != null)) {
      const want = (u.role === "kite" || u.role === "cast") ? u.range * 0.85 : meleeReach(u, t) - 2;
      if (dist > want) {
        const spot = (u.role === "kite" || u.role === "cast") ? { x: t.x, y: t.y } : standAt(u, t);
        steer(u, spot.x, spot.y, spd, dt);
      } else damp(u, 0.6);
      face(u, t);
    } else {
      damp(u, 0.6);
      if (t) face(u, t);
    }
    if (t && !steering && P.goX == null) {
      if (pilotAttack(m, u, t, dist)) return;
      /* On the way to a chosen foe, swing at whoever is already in reach. */
      const near = P.focusId ? nearestEnemyOf(m, u, u.team) : null;
      if (near && near !== t && pilotAttack(m, u, near, Math.hypot(near.x - u.x, near.y - u.y))) return;
    }
    u.x += u.vx * dt;
    u.y += u.vy * dt;
    setMoveAnim(u, dt);
  }

  function pilotRoll(m, u) {
    const P = m.pilot;
    if (!P || !P.roll) return;
    P.roll = false;
    if (u.rollCd > 0 || u.stun > 0) {
      m.events.push({ type: "pilotNo", name: "Roll" });
      return;
    }
    if (u.state === "roll" || u.state === "leap" || u.state === "dash") return;
    let dx = P.mx || 0;
    let dy = P.my || 0;
    if (!dx && !dy) {
      const t = unitById(m, P.targetId);
      if (t) { dx = u.x - t.x; dy = u.y - t.y; }
      else dx = -(u.facing || 1);
    }
    startRoll(m, u, dx, dy);
  }

  function separate(m) {
    const list = m.units;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (a.hp <= 0 || (a.z || 0) > 12) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (b.hp <= 0 || (b.z || 0) > 12) continue;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.hypot(dx, dy);
        const gap = Math.max(a.radius + b.radius, 1.2 * BODY_W);
        if (dist >= gap) continue;
        if (dist < 0.001) {
          dx = b.x === a.x ? ((b.team - a.team) || 1) : (b.x > a.x ? 1 : -1);
          dy = 0;
          dist = 1;
        }
        const slip = (a.state === "roll" || b.state === "roll" || a.state === "dash" || b.state === "dash") ? 0.16 : 0.55;
        const push = (gap - dist) * slip;
        const nx = dx / dist;
        const ny = dy / dist;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
      }
    }
  }

  function clampUnit(u) {
    if (u.x < WORLD.left) { u.x = WORLD.left; u.vx = Math.abs(u.vx) * 0.4; }
    if (u.x > WORLD.right) { u.x = WORLD.right; u.vx = -Math.abs(u.vx) * 0.4; }
    if (u.y < WORLD.top) { u.y = WORLD.top; u.vy = Math.abs(u.vy) * 0.4; }
    if (u.y > WORLD.bottom) { u.y = WORLD.bottom; u.vy = -Math.abs(u.vy) * 0.4; }
  }

  function stepShots(m, dt) {
    for (let i = 0; i < m.shots.length; i++) {
      const p = m.shots[i];
      if (!p.trail) p.trail = [];
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > 8) p.trail.shift();
      if (p.home) {
        let tgt = null;
        for (let j = 0; j < m.units.length; j++) if (m.units[j].id === p.home && m.units[j].team !== p.team && m.units[j].hp > 0) tgt = m.units[j];
        if (!tgt) {
          tgt = nextFoe(m, p.team, p, 9999, {});
          if (tgt) p.home = tgt.id;
        }
        if (tgt) {
          const want = Math.atan2(tgt.y - 16 - p.y, tgt.x - p.x);
          const have = Math.atan2(p.vy, p.vx);
          let diff = want - have;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const turn = Math.max(-7 * dt, Math.min(7 * dt, diff));
          const sp = p.speed || 360;
          p.vx = Math.cos(have + turn) * sp;
          p.vy = Math.sin(have + turn) * sp;
        }
      }
      p.vy += (p.drop || 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0 || p.x < -40 || p.x > WORLD.w + 40 || p.y < -40 || p.y > WORLD.h + 40) {
        m.stats.whiffs++;
        fx(m, "spark", p.x, p.y, { size: 64 });
        p.dead = true;
        continue;
      }
      for (let j = 0; j < m.units.length; j++) {
        const e = m.units[j];
        if (e.team === p.team || e.hp <= 0) continue;
        const bodyY = e.y - 16 - Math.min(18, e.z || 0);
        if (!p.hit) p.hit = {};
        if (p.hit[e.id]) continue;
        if (Math.hypot(e.x - p.x, bodyY - p.y) <= e.radius + p.r) {
          const src = m.units.filter(function (u) { return u.id === p.src; })[0] || null;
          deal(m, src, e, p.dmg, { snd: p.snd, spell: p.spell, tag: p.srcTag });
          p.hit[e.id] = true;
          if (p.bolt) fx(m, "bolt", e.x, e.y - 16, { size: 120 });
          if (p.pierce > 0) p.pierce -= 1;
          else p.dead = true;
          break;
        }
      }
    }
    if (m.shots.length) m.shots = m.shots.filter(function (p) { return !p.dead; });
  }

  function teamScore(m, team) {
    return m.units.filter(function (u) { return u.team === team && !u.summon; })
      .reduce(function (s, u) { return s + Math.max(0, u.hp) / u.maxHp; }, 0);
  }

  function decide(m) {
    const teams = m.teams || 2;
    let aliveId = null;
    let aliveCount = 0;
    for (let t = 0; t < teams; t++) {
      if (living(m, t).length) { aliveCount++; aliveId = t; }
    }
    if (aliveCount === 1) return aliveId;
    let win = 0;
    let best = -1;
    for (let t = 0; t < teams; t++) {
      const s = teamScore(m, t);
      if (s > best + 1e-9) { best = s; win = t; }
    }
    return win;
  }

  /* v102 final placings, first to last: the winner, then any team still
     standing by health left, then the fallen, last out ranked highest. */
  function placings(m) {
    const teams = m.teams || 2;
    const out = (m.outOrder || []).slice();
    const standing = [];
    for (let t = 0; t < teams; t++) if (out.indexOf(t) < 0) standing.push(t);
    standing.sort(function (a, b) { return teamScore(m, b) - teamScore(m, a); });
    if (m.winner != null && standing.indexOf(m.winner) > 0) { standing.splice(standing.indexOf(m.winner), 1); standing.unshift(m.winner); }
    return standing.concat(out.reverse());
  }

  function stepBody(m, u, dt) {
    if (m.pilot && m.pilot.roll && !m.pilot.auto && m.pilot.id === u.id && u.team === 0 && !m.scripted) pilotRoll(m, u);
    if (u.state !== "leap" && ((u.z || 0) > 0 || u.vz)) {
      u.vz = (u.vz || 0) - 720 * dt;
      u.z = Math.max(0, (u.z || 0) + u.vz * dt);
      if (u.z === 0) u.vz = 0;
    }
    if (u.state === "attack") stepAttack(m, u, dt);
    else if (u.state === "cast") stepCast(m, u, dt);
    else if (u.state === "dash") stepDash(m, u, dt);
    else if (u.state === "roll") stepRoll(m, u, dt);
    else if (u.state === "leap") stepLeap(m, u, dt);
    else if (u.state === "block") stepBlock(m, u, dt);
    else if (u.state === "hurt") stepHurt(m, u, dt);
    else if (m.scripted) setMoveAnim(u, dt);
    else if (m.pilot && !m.pilot.auto && m.pilot.id === u.id && u.team === 0) pilotThink(m, u, dt);
    else think(m, u, dt);
  }

  const SUDDEN_AT = 45;

  function stepMatch(m, dt) {
    if (!m || m.over) return;
    dt = Math.max(0, Math.min(0.05, dt));
    if (m.hitstop > 0) {
      m.hitstop -= dt;
      return;
    }
    if (m.cine) {
      m.cine.t += dt;
      if (m.cine.t >= m.cine.dur) m.cine = null;
    }
    if (m.slowmo > 0) {
      m.slowmo -= dt;
      dt *= 0.38;
    }
    m.time += dt;
    if (m.hazard === "fire") {
      m.fireAcc = (m.fireAcc || 0) + dt;
      if (m.fireAcc >= 1.25) {
        m.fireAcc -= 1.25;
        for (let i = 0; i < m.units.length; i++) {
          if (m.units[i].hp > 0) deal(m, null, m.units[i], 3, { dot: true, silent: true });
        }
      }
    }
    if (m.zoom > 0) m.zoom = Math.max(0, m.zoom - dt * 2.8);
    if (m.cheer > 0) m.cheer = Math.max(0, m.cheer - dt * 0.8);
    if ((m.stats.abilities || 0) > (m.abSeen || 0)) {
      m.abSeen = m.stats.abilities;
      m.zoom = 1;
      m.cheer = 1;
    }

    if (m.engage > 0) {
      const span = m.engageMax || 1.15;
      const k = m.engage / span;
      m.engage -= dt;
      for (let i = 0; i < m.units.length; i++) {
        const u = m.units[i];
        if (u.homeX == null) { u.homeX = u.x; u.homeY = u.y; }
        const side = u.facing > 0 ? -1 : 1;
        u.x = u.homeX + side * 16 * Math.max(0, k);
        u.y = u.homeY;
        u.anim = k > 0.12 ? "run" : idleClip(u);
        u.animT += dt;
      }
      return;
    }

    if (m.pilot && !m.pilot.auto) pilotUnit(m);
    /* Keep each pet with its squad. Pets pushed at the end of the list
       otherwise always swing after both fighters, and the one summoned
       first lands the last hit on every mirror. */
    m.units.sort(function (a, b) {
      if (a.team !== b.team) return a.team - b.team;
      if (!!a.summon !== !!b.summon) return a.summon ? 1 : -1;
      return 0;
    });
    const aliveAtStart = m.units.map(function (u) { return u.hp > 0; });
    const order = [];
    for (let i = 0; i < m.units.length; i++) order.push(i);
    /* Alternate which squad steps first. Seed parity flips the opening
       frame so the right side does not always land the first blow.
       stepFlip overrides that bit when a mirror sim wants the same rng. */
    const flipBit = m.stepFlip == null ? (m.seed & 1) : (m.stepFlip & 1);
    if (((m.time * 60 | 0) + flipBit) % 2 === 1) order.reverse();
    for (let n = 0; n < order.length; n++) {
      const i = order[n];
      const u = m.units[i];
      u.cool = Math.max(0, u.cool - dt);
      u.dashCd = Math.max(0, u.dashCd - dt);
      u.rollCd = Math.max(0, u.rollCd - dt);
      u.leapCd = Math.max(0, u.leapCd - dt);
      u.blockCd = Math.max(0, u.blockCd - dt);
      u.hurtCd = Math.max(0, u.hurtCd - dt);
      u.iframe = Math.max(0, u.iframe - dt);
      if (u.blink && u.blink.cd > 0) u.blink.cd = Math.max(0, u.blink.cd - dt);
      u.flash = Math.max(0, u.flash - dt);
      u.abilityCd = Math.max(0, u.abilityCd - dt);
      u.stun = Math.max(0, (u.stun || 0) - dt);
      if (u.buff > 0) u.buff = Math.max(0, u.buff - dt);
      else u.buffAtk = 1;
      if (u.cds) {
        const keys = Object.keys(u.cds);
        for (let k = 0; k < keys.length; k++) u.cds[keys[k]] = Math.max(0, u.cds[keys[k]] - dt);
      }
      if (u.summon && u.hp > 0) {
        u.life = (u.life || 0) - dt;
        if (u.life <= 0) {
          u.hp = 0;
          u.alive = false;
          u.state = "dead";
          u.anim = "die";
          u.animT = 0;
        }
      }
      u.taunt = Math.max(0, u.taunt - dt);
      if (u.banner) {
        u.banner.t += dt;
        if (u.banner.t >= u.banner.life) u.banner = null;
      }
      u.rage = Math.max(0, u.rage - dt);
      u.slow = Math.max(0, u.slow - dt);
      if (u.root > 0) u.root = Math.max(0, u.root - dt);
      if (u.mRushT > 0 && !m.engage) u.mRushT = Math.max(0, u.mRushT - dt);
      if (u.mana == null) u.mana = 100;
      if (u.sta == null) u.sta = 100;
      u.mana = Math.min(100, u.mana + (u.role === "cast" || u.role === "support" ? 16 : 12) * dt);
      u.sta = Math.min(100, u.sta + (u.role === "cast" || u.role === "support" ? 14 : 18) * dt);
      if (u.silence > 0) u.silence = Math.max(0, u.silence - dt);
      if (u.pullTo) {
        const px = u.pullTo.x - u.x;
        const py = u.pullTo.y - u.y;
        const pd = Math.hypot(px, py);
        const step = 900 * dt;
        u.pullTo.t -= dt;
        if (pd <= step || u.pullTo.t <= 0 || u.hp <= 0) { if (pd <= step) { u.x = u.pullTo.x; u.y = u.pullTo.y; } u.pullTo = null; }
        else { u.x += px / pd * step; u.y += py / pd * step; u.vx = 0; u.vy = 0; }
      }
      if (u.hot && u.hp > 0) {
        u.hot.t -= dt;
        u.hp = Math.min(u.maxHp, u.hp + u.hot.rate * dt * (m.time > (m.suddenAt || SUDDEN_AT) ? 0.5 : 1));
        if (u.hot.t <= 0) u.hot = null;
      }
      if (u.vuln > 0) u.vuln = Math.max(0, u.vuln - dt);
      if (u.feintT > 0) u.feintT = Math.max(0, u.feintT - dt);
      if (u.hp > 0 && u.regen) u.hp = Math.min(u.maxHp, u.hp + u.regen * dt);
      if (u.hp > 0 && u.bleed) {
        u.bleed.t -= dt;
        u.bleed.acc += dt;
        if (u.bleed.acc >= 0.85) {
          u.bleed.acc = 0;
          const srcId = u.bleed.src;
          const src = m.units.filter(function (o) { return o.id === srcId; })[0] || null;
          deal(m, src, u, u.bleed.dmg, { dot: true, tag: u.bleed.tag });
        }
        if (u.bleed && u.bleed.t <= 0) u.bleed = null;
      }
      if (!aliveAtStart[i]) {
        u.animT += dt;
        continue;
      }
      /* A killing blow earlier in this frame must not erase a swing that
         already started. Otherwise the left squad always lands the last hit. */
      if (u.hp <= 0) {
        if (u.state === "attack") stepAttack(m, u, dt);
        else if (u.state === "cast") stepCast(m, u, dt);
        else u.animT += dt;
        continue;
      }
      stepBody(m, u, dt);
    }

    separate(m);
    for (let i = 0; i < m.units.length; i++) clampUnit(m.units[i]);
    stepShots(m, dt);

    const teamCount = m.teams || 2;
    let aliveTeams = 0;
    if (!m.outOrder) m.outOrder = [];
    for (let t = 0; t < teamCount; t++) {
      if (living(m, t).length) aliveTeams++;
      else if (m.outOrder.indexOf(t) < 0) m.outOrder.push(t);
    }
    tickBoss(m);
    if (!m.ending && (m.horde || m.king) && tryNextWave(m)) aliveTeams = 2;
    let cap = teamCount > 2 ? 46 : 62;
    if (m.mode === "boss" || m.horde || m.king) cap = 105;
    if (!m.scripted && (aliveTeams <= 1 || m.time > cap)) {
      if (!m.ending) {
        m.ending = true;
        m.endDelay = aliveTeams <= 1 ? 1.25 : 0.85;
        if (aliveTeams <= 1) m.slowmo = Math.max(m.slowmo || 0, 1.05);
      }
      m.endDelay -= dt;
      if (m.endDelay <= 0) {
        m.over = true;
        m.winner = decide(m);
      }
    }
  }

  function showcase(cls, which) {
    const kit = kitOf(cls);
    const rng = IL.mulberry32(IL.hashStr(cls + ":" + which) >>> 0);
    const caster = IL.randomFighter(rng, cls);
    caster.level = 10;
    caster.name = kit.name;
    if (IL.ensureMoves) IL.ensureMoves(caster);
    const foeF = IL.randomFighter(rng, "tank");
    foeF.name = "Target";
    foeF.level = 10;
    const m = createMatch({
      seed: 1,
      left: [caster],
      right: [foeF],
      leftName: kit.name,
      rightName: "Target",
      mode: "showcase"
    });
    m.scripted = true;
    m.engage = 0;
    const u = m.units.filter(function (unit) { return unit.team === 0 && !unit.summon; })[0];
    const foe = m.units.filter(function (unit) { return unit.team === 1 && !unit.summon; })[0];
    u.hp = Math.max(1, Math.round(u.maxHp * 0.5));
    foe.hp = foe.maxHp;
    u.cool = 0;
    u.cds = {};
    const starters = (kit.abilities || []).filter(function (ab) { return ab && ab.unlock && ab.unlock <= 7; }).slice(0, 3);
    const ab = which === "basic" ? null : starters[which | 0];
    let dist = 42;
    if (!ab) dist = (u.role === "kite" || u.role === "cast") ? 180 : 40;
    else if (ab.kind === "multishot" || ab.kind === "pierce" || ab.kind === "vial") {
      if (u.range < 120) u.range = 220;
      dist = 140;
    } else if (ab.kind === "charge") dist = 140;
    else if (ab.kind === "shadowstep" || ab.kind === "skirmish") dist = 160;
    else if (ab.kind === "bolt" || ab.kind === "dot" || ab.kind === "debuff" || ab.kind === "arc" || ab.kind === "nova" || ab.kind === "frost" || ab.kind === "fireball") {
      dist = Math.max(70, Math.min(u.range || 180, 170));
    }
    const midX = (WORLD.left + WORLD.right) / 2;
    const midY = (WORLD.top + WORLD.bottom) / 2;
    const gap = Math.min(dist, (WORLD.right - WORLD.left) - 48);
    u.x = midX - gap / 2;
    u.y = midY;
    foe.x = midX + gap / 2;
    foe.y = midY;
    u.facing = 1;
    foe.facing = -1;
    if (!ab) {
      if (u.role === "cast") {
        startCast(m, u, foe);
        const atk = IL.attackOf(u.cls);
        if (atk) raiseBanner(u, atk.name, false, (u.cast && u.cast.dur ? u.cast.dur : 0.8) + 0.35);
      } else {
        if (u.role === "kite") {
          u.forceShot = true;
          u.wantMotion = missileMotion(u);
        }
        startAttack(u, (u.attacks && u.attacks[0]) || "atk1", foe);
      }
    } else {
      const code = fireOne(m, u, foe, dist, ab, true);
      if (code === "skip") {
        posed(u, ab);
        noteAbility(m, u, foe, ab);
      }
    }
    return m;
  }

  IL.showcase = showcase;
  IL.BODY_H = BODY_H;
  IL.BODY_W = BODY_W;
  IL.teamSpread = teamSpread;
  IL.WORLD = WORLD;
  IL.scaledStats = scaledStats;
  IL.createMatch = createMatch;
  IL.placings = placings;
  /* v99 live orders for a team: plan (each follows its own behavior), engage, regroup, hold. */
  IL.ORDERS = ["plan", "engage", "regroup", "hold"];
  IL.setOrder = function (m, team, order) {
    if (!m) return;
    if (!m.orders) m.orders = {};
    m.orders[team] = IL.ORDERS.indexOf(order) >= 0 ? order : "plan";
    m.events.push({ type: "order", team: team, order: m.orders[team] });
  };
  IL.FORMATIONS = FORMATIONS;
  IL.stepMatch = stepMatch;
  IL._deal = deal; /* tools/sim.js only */
  IL._fire = fireOne; /* tools/sim.js only */
  IL._ready = readyAb; /* tools/sim.js only */
  IL.PACE = PACE;
  IL.SUDDEN_AT = SUDDEN_AT;
  IL.pilotAbs = pilotAbs;
})(typeof window !== "undefined" ? window : globalThis);
