/* Iron League — arena autobattler. Pure step(); no DOM.
   The pit is wider than the old 960×600 well. A camera in render.js
   follows the squads; units roam WORLD.left/right/top/bottom. */
(function (root) {
  const IL = root.IL = root.IL || {};

  const WORLD = { w: 1680, h: 1080, left: 150, right: 1530, top: 220, bottom: 920 };

  function kitOf(cls) {
    return IL.CLASSES[cls] || IL.CLASSES.warrior;
  }

  function placeUnit(team, slot, n, teams) {
    const midY = (WORLD.top + WORLD.bottom) / 2;
    const midX = (WORLD.left + WORLD.right) / 2;
    if (!teams || teams <= 2) {
      const spanY = n === 1 ? [0] : n === 2 ? [-150, 150] : [-210, 0, 210];
      const spanX = WORLD.right - WORLD.left;
      const x = team === 0 ? WORLD.left + spanX * 0.36 : WORLD.left + spanX * 0.64;
      return { x: x + (team === 0 ? -1 : 1) * (slot * 22), y: midY + (spanY[slot] || 0) };
    }
    const ang = -Math.PI / 2 + (team / teams) * Math.PI * 2;
    return {
      x: midX + Math.cos(ang) * 240 + (slot - (n - 1) / 2) * 28,
      y: midY + Math.sin(ang) * 180 + (slot - (n - 1) / 2) * 16
    };
  }

  function scaledStats(fighter, kit) {
    const lv = fighter.level || 1;
    const b = fighter.boosts || {};
    let hp = kit.hp * (1 + (lv - 1) * 0.08) * (1 + (b.hp || 0) * 0.08);
    let atk = kit.atk * (1 + (lv - 1) * 0.06) * (1 + (b.dmg || 0) * 0.08);
    let def = kit.def + (b.def || 0) * 2;
    let speed = kit.speed * (1 + (b.spd || 0) * 0.06);
    if (fighter.champion) { hp *= 1.14; atk *= 1.12; }
    const gear = IL.gearBonus ? IL.gearBonus(fighter) : null;
    if (gear) {
      hp += gear.hp || 0;
      atk += gear.atk || 0;
      def += gear.def || 0;
      speed += gear.spd || 0;
    }
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
    const pos = placeUnit(team, slot, n, teams);
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
      x: pos.x,
      y: pos.y,
      vx: 0,
      vy: 0,
      z: 0,
      vz: 0,
      facing: team === 0 ? 1 : -1,
      hp: stats.hp,
      maxHp: stats.hp,
      atk: stats.atk,
      def: stats.def,
      speed: stats.speed,
      radius: kit.radius,
      range: kit.range,
      role: kit.role,
      attacks: (kit.attacks || ["atk1"]).slice(),
      airs: (kit.airs || []).slice(),
      casts: (kit.casts || ["cast1"]).slice(),
      leaps: !!kit.leaps,
      castTime: kit.castTime || 0.95,
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
    return u;
  }

  function applyRelics(u, relics) {
    for (let i = 0; i < relics.length; i++) {
      const r = relics[i];
      if (!r) continue;
      if (r.kind === "hp") {
        u.maxHp = Math.round(u.maxHp * 1.12);
        u.hp = u.maxHp;
      } else if (r.kind === "crit") u.crit += 0.14;
      else if (r.kind === "shield") u.shield = Math.round(u.maxHp * 0.14);
      else if (r.kind === "haste") { u.castTime *= 0.82; u.abilityCdMul *= 0.85; }
      else if (r.kind === "bounty") u.bounty += 6;
      else if (r.kind === "regen") u.regen += 2.4;
      else if (r.kind === "pierce") u.pierce += 1;
      else if (r.kind === "wind") u.wind = true;
      else if (r.kind === "speed") u.speed *= 1.1;
      else if (r.kind === "glass") { u.atk = Math.round(u.atk * 1.15); u.def = Math.max(0, u.def - 2); }
      else if (r.kind === "sand") u.abilityCdMul *= 0.78;
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
    const relics = opts.relics || [];
    if (relics.length) {
      for (let i = 0; i < units.length; i++) if (units[i].team === 0) applyRelics(units[i], relics);
    }
    applySynergy(units);
    const kills = [];
    for (let t = 0; t < teams; t++) kills.push(0);
    return {
      seed: opts.seed >>> 0,
      rng: IL.mulberry32(opts.seed >>> 0 || 1),
      leftName: names[0],
      rightName: names[1] || "Rivals",
      names: names,
      teams: teams,
      mode: opts.mode || "league",
      units: units,
      shots: [],
      events: [],
      time: 0,
      engage: 0.65,
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

  function nearest(m, u) {
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
    return best;
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

  function lowestAlly(m, u) {
    let best = null;
    let ratio = 0.92;
    for (let i = 0; i < m.units.length; i++) {
      const a = m.units[i];
      if (a.team !== u.team || a.hp <= 0) continue;
      const r = a.hp / a.maxHp;
      if (r < ratio) { ratio = r; best = a; }
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
    let s = u.speed;
    if (u.slow > 0) s *= 0.62;
    if (u.rage > 0) s *= 1.08;
    return s;
  }

  function steer(u, tx, ty, speed, dt) {
    const dx = tx - u.x;
    const dy = ty - u.y;
    const d = Math.hypot(dx, dy) || 1;
    const wantX = dx / d * speed;
    const wantY = dy / d * speed;
    const acc = 820 * dt;
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
    if (u.role !== "kite" && !u.forceShot) {
      u.vx = u.facing * 42;
      u.vy *= 0.2;
    }
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
    u.vx = dx / d * 430;
    u.vy = dy / d * 430;
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
    u.vx = dx / d * 340;
    u.vy = dy / d * 280;
    u.z = 0;
    u.vz = 0;
    u.iframe = 0.42;
    u.rollCd = 2.7;
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
    const blocked = dst.state === "block";
    let amount = raw;
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
        amount *= 1.55;
        m.events.push({ type: "dmg", x: dst.x, y: dst.y - 56 - (dst.z || 0), n: "crit", crit: true, team: dst.team });
      }
    }
    let dmg = amount - dst.def * 0.35;
    if (blocked) dmg *= dst.guardZone ? 0.32 : 0.4;
    dmg = Math.max(1, Math.round(dmg));
    if (dst.shield > 0) {
      const absorb = Math.min(dst.shield, dmg);
      dst.shield -= absorb;
      dmg -= absorb;
      fx(m, "orbit", dst.x, dst.y - 20, { size: 100 });
      if (dmg <= 0) {
        m.events.push({ type: "dmg", x: dst.x, y: dst.y - 40 - (dst.z || 0), n: "ward", blocked: true, team: dst.team });
        return;
      }
    }
    dst.hp -= dmg;
    dst.dmgTaken = (dst.dmgTaken || 0) + dmg;
    if (src && src.team !== dst.team) src.dmgDealt = (src.dmgDealt || 0) + dmg;
    dst.flash = 0.14;
    m.hitstop = blocked ? 0.03 : 0.04;
    m.stats.hits++;
    m.events.push({ type: "dmg", x: dst.x, y: dst.y - 40 - (dst.z || 0), n: dmg, blocked: blocked, team: dst.team });
    fx(m, "spark", dst.x, dst.y - 22 - (dst.z || 0), { size: blocked ? 90 : 128 });
    if (blocked) fx(m, "orbit", dst.x + dst.facing * 8, dst.y - 22, { size: 130 });
    if (dst.hp <= 0) {
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
      const killerTeam = src ? src.team : 0;
      if (m.kills[killerTeam] == null) m.kills[killerTeam] = 0;
      m.kills[killerTeam]++;
      if (src && src.team !== dst.team) src.kos = (src.kos || 0) + 1;
      if (src && src.bounty) m.stats.bounty = (m.stats.bounty || 0) + src.bounty;
      m.stats.deaths++;
      m.events.push({ type: "death", id: dst.id, team: dst.team });
      fx(m, "boom", dst.x, dst.y - 18, { size: 168 });
      return;
    }
    if (dst.wind && !dst.windUsed && dst.hp > 0 && dst.hp < dst.maxHp * 0.32) {
      dst.windUsed = true;
      const heal = Math.round(dst.maxHp * 0.22);
      dst.hp = Math.min(dst.maxHp, dst.hp + heal);
      dst.healing = (dst.healing || 0) + heal;
      m.events.push({ type: "heal", x: dst.x, y: dst.y - 48, n: heal, team: dst.team });
      fx(m, "plasma", dst.x, dst.y - 16, { size: 120 });
    }
    if (src && !opt.dot && kitOf(src.cls).bleed) {
      dst.bleed = { t: 3.1, acc: 0.4, dmg: Math.max(2, Math.round(src.atk * 0.18)), src: src.id };
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
    if (src && src.oath) rawN *= 1.12;
    const n = Math.max(1, Math.round(rawN));
    dst.hp = Math.min(dst.maxHp, dst.hp + n);
    if (src) src.healing = (src.healing || 0) + n;
    m.stats.heals++;
    m.events.push({ type: "heal", x: dst.x, y: dst.y - 46, n: n, team: dst.team });
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
      if (dist > u.range + bonus + e.radius) continue;
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
      const reach = (u.anim === "atk3" || u.anim === "air2") ? 150 : 188;
      fx(m, "slash", u.x + u.facing * 28, u.y - 26 - (u.z || 0), {
        facing: u.facing,
        size: reach,
        team: u.team
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

  function tryShot(m, u) {
    if (!onSwingFrame(u) || u.didHit) return;
    u.didHit = true;
    const t = nearest(m, u);
    face(u, t);
    const aimX = t ? t.x + t.vx * 0.14 : u.x + u.facing * 240;
    const aimY = t ? t.y - 14 + t.vy * 0.14 : u.y - 14;
    const ox = u.x + u.facing * 18;
    const oy = u.y - 18;
    const dx = aimX - ox;
    const dy = aimY - oy;
    const d = Math.hypot(dx, dy) || 1;
    const sp = 470;
    const volley = u.volley || 1;
    u.volley = 0;
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
        team: u.team, dmg: volley > 1 ? Math.round(u.atk * 0.72) : u.atk,
        r: 8, life: 1.15, src: u.id,
        trail: [], drop: volley > 1 ? 18 : 42,
        pierce: (u.pierce || 0) + (u.pierceBoost || 0),
        hit: {}
      });
      m.stats.shots++;
    }
    u.pierceBoost = 0;
    fx(m, "spark", ox, oy, { size: volley > 1 ? 110 : 72 });
    if (volley > 1) fx(m, "shot", ox + u.facing * 10, oy, { size: 80, facing: u.facing });
  }

  function stepAttack(m, u, dt) {
    u.animT += dt;
    u.actT -= dt;
    damp(u, 0.9);
    u.x += u.vx * dt;
    u.y += u.vy * dt;
    if (u.role === "kite" || u.forceShot) tryShot(m, u);
    else tryMelee(m, u);
    if (u.actT <= 0) {
      u.cleave = false;
      u.forceShot = false;
      u.motion = null;
      u.state = "idle";
      u.anim = idleClip(u);
      u.cool = u.role === "kite" ? 0.55 : 0.18;
    }
  }

  function stepCast(m, u, dt) {
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
        healUnit(m, u, ally || u, Math.round((ally || u).maxHp * 0.2 + u.atk * 0.35));
        fx(m, "plasma", c.x, c.y, { size: 150 });
      } else {
        m.stats.casts++;
        m.stats.abilities++;
        if (c.kind === "cast2") m.stats.cast2++;
        const bolt = c.kind === "cast2" && kitOf(u.cls).boltCast;
        const mul = c.kind === "cast2" ? 1.3 : (c.kind === "arc" ? 0.95 : 1.15);
        m.events.push({ type: "boom", x: c.x, y: c.y, r: c.r, kind: c.kind });
        fx(m, c.kind === "cast2" ? "bolt" : "boom", c.x, c.y, { size: Math.round(c.r * 2.35) });
        if (c.kind === "cast1" || c.kind === "arc") fx(m, "plasma", c.x, c.y, { size: Math.round(c.r * 1.7) });
        if (c.kind === "cast2") fx(m, "spark", c.x, c.y, { size: Math.round(c.r * 1.5) });
        if (!bolt) {
          for (let i = 0; i < m.units.length; i++) {
            const e = m.units[i];
            if (e.team === u.team || e.hp <= 0) continue;
            const d = Math.hypot(e.x - c.x, e.y - c.y);
            if (d <= c.r + e.radius * 0.45) {
              deal(m, u, e, Math.round(u.atk * mul));
              if (c.kind === "cast1") e.slow = Math.max(e.slow, 2.1);
            }
          }
        } else {
          const dx = c.x - u.x;
          const dy = c.y - u.y;
          const d = Math.hypot(dx, dy) || 1;
          m.shots.push({
            x: u.x + u.facing * 16, y: u.y - 16,
            vx: dx / d * 420, vy: dy / d * 420,
            team: u.team, dmg: Math.round(u.atk * 1.15), r: 10, life: 1.3, src: u.id,
            trail: [], drop: 0, pierce: (u.pierce || 0) + 1, hit: {}, bolt: true
          });
          m.stats.shots++;
          fx(m, "bolt", u.x + u.facing * 20, u.y - 16, { size: 140, facing: u.facing });
        }
      }
    }
    u.cast = null;
    u.motion = null;
    u.state = "idle";
    u.anim = idleClip(u);
    u.cool = 1.15;
  }

  function resolveNovaBolt(m, u, c) {
    m.stats.casts++;
    m.stats.abilities++;
    const mul = c.power || 1;
    const paint = c.fx || (c.kind === "bolt" ? "bolt" : "plasma");
    if (c.kind === "bolt") {
      const dx = c.x - u.x;
      const dy = c.y - u.y;
      const d = Math.hypot(dx, dy) || 1;
      m.shots.push({
        x: u.x + u.facing * 16, y: u.y - 16,
        vx: dx / d * 400, vy: dy / d * 400,
        team: u.team, dmg: Math.round(u.atk * mul), r: 10, life: 1.2, src: u.id,
        trail: [], drop: 0, pierce: u.pierce || 0, hit: {}, bolt: true
      });
      m.stats.shots++;
      fx(m, paint, u.x + u.facing * 18, u.y - 16, { size: 150, facing: u.facing });
      return;
    }
    fx(m, paint, c.x, c.y, { size: Math.round((c.r || 70) * 2.1) });
    fx(m, "boom", c.x, c.y, { size: Math.round((c.r || 70) * 1.5) });
    for (let i = 0; i < m.units.length; i++) {
      const e = m.units[i];
      if (e.team === u.team || e.hp <= 0) continue;
      if (Math.hypot(e.x - c.x, e.y - c.y) <= (c.r || 70) + e.radius * 0.4) {
        deal(m, u, e, Math.round(u.atk * mul));
        if (c.slow) e.slow = Math.max(e.slow || 0, c.slow);
      }
    }
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
    let need = u.personality === "bold" ? 98 : u.personality === "wary" ? 66 : 78;
    if (u.tactic === "hold") need -= 8;
    if (!th || th.score < need) {
      u.sawThreat = false;
      return false;
    }
    if (u.sawThreat) return false;
    u.sawThreat = true;
    if (u.role === "tank" && th.kind === "melee" && u.blockCd <= 0 && dist < 110) return false;
    const trader = u.role === "melee" || u.role === "dash" || u.role === "tank";
    if (th.kind === "melee" && trader && u.cool <= 0 && dist <= u.range + 16 && th.score < 112) return false;
    if (m.rng() > 0.8) return false;
    startRoll(m, u, th.x, th.y);
    return true;
  }

  function arm(u, cd) {
    u.abilityCd = cd * (u.abilityCdMul || 1);
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
  }

  function startCharge(m, u, target) {
    u.dashDmg = 1.7;
    startDash(m, u, target);
    arm(u, kitOf(u.cls).ability.cd || 7);
    m.stats.abilities++;
    fx(m, "slash", u.x + u.facing * 20, u.y - 16, { facing: u.facing, size: 150, team: u.team });
  }

  function spend(u, ab) {
    if (!u.cds) u.cds = {};
    u.cds[ab.id] = (ab.cd || 6.5) * (u.abilityCdMul || 1);
    arm(u, ab.cd || 6.5);
  }

  function readyAb(u, ab) {
    if (!ab || !ab.kind || !ab.cd) return false;
    const left = u.cds && u.cds[ab.id];
    return !(left > 0);
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
    return ids.map(function (id) { return by[id]; }).filter(function (ab) {
      if (!ab) return false;
      if (learned.indexOf(ab.id) >= 0) return true;
      return (ab.unlock || 1) <= lv;
    });
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
    u.state = "attack";
    u.anim = spec.clip;
    u.animT = 0;
    u.actT = Math.max(IL.clipDur(spec.clip), spec.hold + ((IL.hashStr(ab.id) % 5) * 0.04));
    u.didHit = true;
    u.didSlash = true;
    u.forceShot = false;
    u.motion = spec.shot ? missileMotion(u) : (ab.row === "spell" ? "magic" : (spec.motion || null));
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
    pet.life = ab.life || 6;
    pet.hp = Math.max(18, Math.round(u.maxHp * (ab.petHp || 0.26)));
    pet.maxHp = pet.hp;
    pet.atk = Math.max(6, Math.round(u.atk * (ab.petAtk || 0.4)));
    pet.range = 36;
    pet.role = "melee";
    pet.radius = 12;
    pet.leaps = false;
    pet.x = u.x + u.facing * 40;
    pet.y = u.y + 18;
    pet.cds = {};
    pet.abilities = null;
    m.units.push(pet);
    fx(m, ab.fx || "smoke", pet.x, pet.y - 12, { size: 140 });
    return true;
  }

  function throwVial(m, u, t, ab) {
    const ox = u.x + u.facing * 16;
    const oy = u.y - 16;
    const dx = t.x - ox;
    const dy = (t.y - 14) - oy;
    const d = Math.hypot(dx, dy) || 1;
    m.shots.push({
      x: ox, y: oy,
      vx: dx / d * 420, vy: dy / d * 420,
      team: u.team, dmg: Math.round(u.atk * (ab.power || 0.85)),
      r: 9, life: 1.1, src: u.id, trail: [], drop: 20, pierce: 0, hit: {}
    });
    m.stats.shots++;
    fx(m, ab.fx || "boom", ox, oy, { size: 90, facing: u.facing });
  }

  function fireOne(m, u, t, dist, ab) {
    const reach = u.range + (t ? t.radius : 0);
    const paint = ab.fx || "spark";
    if (ab.kind === "cleave" && t && dist <= reach + 6 && u.cool <= 0) {
      u.cleave = true;
      spend(u, ab);
      m.stats.abilities++;
      armRow(u, ab);
      startAttack(u, "atk2", t);
      fx(m, paint, u.x + u.facing * 20, u.y - 16, { facing: u.facing, size: 150, team: u.team });
      return "go";
    }
    if (ab.kind === "lunge" && t && dist <= reach + 28 && u.cool <= 0) {
      u.critNext = true;
      spend(u, ab);
      m.stats.abilities++;
      armRow(u, ab);
      startAttack(u, "atk3", t);
      fx(m, paint, u.x + u.facing * 24, u.y - 20, { facing: u.facing, size: 160, team: u.team });
      return "go";
    }
    if ((ab.kind === "multishot" || ab.kind === "pierce") && t && dist <= u.range + 8 && dist >= 70 && u.cool <= 0) {
      u.volley = ab.kind === "multishot" ? 3 : 1;
      if (ab.kind === "pierce") u.pierceBoost = 1;
      spend(u, ab);
      m.stats.abilities++;
      armRow(u, ab);
      startAttack(u, "atk1", t);
      return "go";
    }
    if (ab.kind === "taunt" && dist < 220) {
      u.taunt = 3.2;
      spend(u, ab);
      m.stats.abilities++;
      fx(m, paint, u.x, u.y - 18, { size: 160 });
      return posed(u, ab);
    }
    if (ab.kind === "zone" && dist < 120) {
      startBlock(m, u);
      u.guardZone = true;
      u.actT = 0.82;
      spend(u, ab);
      m.stats.abilities++;
      fx(m, paint, u.x, u.y - 10, { size: 180, ground: true });
      for (let i = 0; i < m.units.length; i++) {
        const e = m.units[i];
        if (e.team === u.team || e.hp <= 0) continue;
        if (Math.hypot(e.x - u.x, e.y - u.y) <= 78) deal(m, u, e, Math.round(u.atk * 0.35));
      }
      return "go";
    }
    if (ab.kind === "rage" && u.hp < u.maxHp * 0.72) {
      u.rage = 4;
      spend(u, ab);
      m.stats.abilities++;
      fx(m, paint, u.x, u.y - 20, { size: 150 });
      return posed(u, ab);
    }
    if (ab.kind === "mend" || ab.kind === "heal") {
      const ally = lowestAlly(m, u);
      if (!ally) return "skip";
      if (ab.kind === "heal") {
        healUnit(m, u, ally, Math.round(ally.maxHp * (ab.power || 0.16) + u.atk * 0.25));
        fx(m, paint, ally.x, ally.y - 16, { size: 140 });
        spend(u, ab);
        return posed(u, ab);
      }
      startMend(m, u, ally, ab.cd);
      spend(u, ab);
      return "go";
    }
    if (ab.kind === "shadowstep" && t && dist > 80 && dist < 460) {
      startShadow(m, u, t);
      spend(u, ab);
      return "go";
    }
    if (ab.kind === "charge" && t && dist > 60 && dist < 360) {
      startCharge(m, u, t);
      spend(u, ab);
      return "go";
    }
    if (ab.kind === "skirmish" && t && dist > 90 && dist < 280) {
      u.dashDmg = 0.45;
      startDash(m, u, t);
      u.actT = 0.24;
      spend(u, ab);
      m.stats.abilities++;
      fx(m, paint, u.x, u.y - 12, { facing: u.facing, size: 120 });
      return "go";
    }
    if (ab.kind === "arc" && t && dist < u.range + 90 && u.cool <= 0) {
      startCast(m, u, t);
      if (u.cast) u.cast.kind = "arc";
      spend(u, ab);
      return "go";
    }
    if ((ab.kind === "nova" || ab.kind === "bolt") && t && dist < (ab.reach || u.range + 80)) {
      startCast(m, u, t);
      if (u.cast) {
        u.cast.kind = ab.kind;
        u.cast.r = ab.radius || (ab.kind === "bolt" ? 24 : 68);
        u.cast.power = ab.power || 0.9;
        u.cast.fx = paint;
        u.cast.slow = ab.slow || 0;
        u.actT = 0.55 + ((IL.hashStr(ab.id) % 5) * 0.04);
        u.motion = "magic";
      }
      spend(u, ab);
      return "go";
    }
    if (ab.kind === "dot" && t && dist <= (ab.reach || reach + 8)) {
      t.bleed = { t: ab.dot || 3.2, acc: 0, dmg: Math.max(2, Math.round(u.atk * (ab.power || 0.25))), src: u.id };
      m.stats.bleeds++;
      spend(u, ab);
      m.stats.abilities++;
      fx(m, paint, t.x, t.y - 16, { size: 120 });
      deal(m, u, t, Math.round(u.atk * 0.35));
      return posed(u, ab);
    }
    if (ab.kind === "shield") {
      let ally = u;
      if (!ab.self) ally = lowestAlly(m, u) || u;
      ally.shield += Math.round(ally.maxHp * (ab.power || 0.1));
      spend(u, ab);
      m.stats.abilities++;
      fx(m, paint, ally.x, ally.y - 18, { size: 140 });
      return posed(u, ab);
    }
    if (ab.kind === "buff") {
      const targets = ab.team ? m.units.filter(function (e) { return e.team === u.team && e.hp > 0 && !e.summon; }) : [u];
      for (let i = 0; i < targets.length; i++) {
        targets[i].buff = Math.max(targets[i].buff || 0, ab.time || 3.5);
        targets[i].buffAtk = Math.max(targets[i].buffAtk || 1, 1 + (ab.power || 0.12));
      }
      spend(u, ab);
      m.stats.abilities++;
      fx(m, paint, u.x, u.y - 20, { size: 150 });
      return posed(u, ab);
    }
    if (ab.kind === "debuff" && t && dist <= (ab.reach || 220)) {
      t.slow = Math.max(t.slow || 0, ab.time || 2.2);
      spend(u, ab);
      m.stats.abilities++;
      fx(m, paint, t.x, t.y - 16, { size: 130 });
      return posed(u, ab);
    }
    if (ab.kind === "stun" && t && dist <= (ab.reach || reach + 12)) {
      t.stun = Math.max(t.stun || 0, ab.stun || 0.55);
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
      return posed(u, ab);
    }
    if (ab.kind === "knock" && t && dist <= (ab.reach || reach + 16)) {
      const dx = t.x - u.x;
      const dy = t.y - u.y;
      const d = Math.hypot(dx, dy) || 1;
      t.vx = dx / d * (ab.force || 240);
      t.vy = dy / d * (ab.force || 240);
      spend(u, ab);
      m.stats.abilities++;
      fx(m, paint, t.x, t.y - 14, { facing: u.facing, size: 140, team: u.team });
      deal(m, u, t, Math.round(u.atk * (ab.power || 0.35)));
      return posed(u, ab);
    }
    if (ab.kind === "summon") {
      if (!summonPet(m, u, ab)) return "skip";
      spend(u, ab);
      m.stats.abilities++;
      return posed(u, ab);
    }
    if (ab.kind === "vial" && t && dist <= (ab.reach || 220) && dist >= 48) {
      throwVial(m, u, t, ab);
      spend(u, ab);
      m.stats.abilities++;
      return posed(u, ab);
    }
    return "skip";
  }

  function tryClassAbility(m, u, t, dist) {
    if (u.summon) return false;
    const list = unlockedAbs(u);
    for (let i = list.length - 1; i >= 0; i--) {
      const ab = list[i];
      if (!readyAb(u, ab)) continue;
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
    const dist = Math.hypot(t.x - u.x, t.y - u.y);
    if (maybeRoll(m, u, dist)) return;
    if (tryClassAbility(m, u, t, dist)) return;
    const reach = u.range + t.radius;

    if (u.role === "melee") {
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
      steer(u, t.x - u.facing * 8, t.y, spd, dt);
    } else if (u.role === "kite") {
      if (dist < 118) steer(u, u.x - (t.x - u.x), u.y - (t.y - u.y), spd, dt);
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
      const stop = u.range * 0.7;
      if (dist > stop) steer(u, t.x, t.y, spd, dt);
      else damp(u, 0.7);
    } else if (u.role === "tank") {
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
      steer(u, t.x, t.y, spd, dt);
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
      steer(u, t.x, t.y, spd, dt);
    } else if (u.role === "support") {
      let company = false;
      for (let i = 0; i < m.units.length; i++) {
        const a = m.units[i];
        if (a !== u && a.team === u.team && a.hp > 0 && !a.summon) company = true;
      }
      const ally = company ? lowestAlly(m, u) : null;
      if (!company) {
        if (dist <= reach && u.cool <= 0) {
          startAttack(u, "atk1", t);
          return;
        }
        steer(u, t.x, t.y, spd, dt);
      } else if (dist <= reach + 8 && u.cool <= 0 && !ally) {
        startAttack(u, "atk1", t);
        return;
      } else if (dist < 78) {
        steer(u, u.x - (t.x - u.x), u.y - (t.y - u.y), spd, dt);
      } else {
        const anchor = ally || u;
        steer(u, anchor.x + (u.x >= t.x ? 36 : -36), anchor.y, spd * 0.9, dt);
      }
    } else if (u.role === "hybrid") {
      if (dist <= reach && u.cool <= 0) {
        const clip = u.attacks[u.atkCursor % u.attacks.length];
        u.atkCursor++;
        startAttack(u, clip, t);
        return;
      }
      steer(u, t.x, t.y, spd, dt);
    }

    u.x += u.vx * dt;
    u.y += u.vy * dt;
    setMoveAnim(u, dt);
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
        const min = a.radius + b.radius;
        if (dist >= min) continue;
        if (dist < 0.001) {
          dx = b.x === a.x ? ((b.team - a.team) || 1) : (b.x > a.x ? 1 : -1);
          dy = 0;
          dist = 1;
        }
        const slip = (a.state === "roll" || b.state === "roll" || a.state === "dash" || b.state === "dash") ? 0.16 : 0.45;
        const push = (min - dist) * slip;
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
          deal(m, src, e, p.dmg);
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

  function stepBody(m, u, dt) {
    if (u.state === "attack") stepAttack(m, u, dt);
    else if (u.state === "cast") stepCast(m, u, dt);
    else if (u.state === "dash") stepDash(m, u, dt);
    else if (u.state === "roll") stepRoll(m, u, dt);
    else if (u.state === "leap") stepLeap(m, u, dt);
    else if (u.state === "block") stepBlock(m, u, dt);
    else if (u.state === "hurt") stepHurt(m, u, dt);
    else think(m, u, dt);
  }

  function stepMatch(m, dt) {
    if (!m || m.over) return;
    dt = Math.max(0, Math.min(0.05, dt));
    if (m.hitstop > 0) {
      m.hitstop -= dt;
      return;
    }
    m.time += dt;

    if (m.engage > 0) {
      m.engage -= dt;
      for (let i = 0; i < m.units.length; i++) {
        const u = m.units[i];
        u.anim = idleClip(u);
        u.animT += dt;
      }
      return;
    }

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
      u.rage = Math.max(0, u.rage - dt);
      u.slow = Math.max(0, u.slow - dt);
      if (u.hp > 0 && u.regen) u.hp = Math.min(u.maxHp, u.hp + u.regen * dt);
      if (u.hp > 0 && u.bleed) {
        u.bleed.t -= dt;
        u.bleed.acc += dt;
        if (u.bleed.acc >= 0.85) {
          u.bleed.acc = 0;
          const srcId = u.bleed.src;
          const src = m.units.filter(function (o) { return o.id === srcId; })[0] || null;
          deal(m, src, u, u.bleed.dmg, { dot: true });
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
    for (let t = 0; t < teamCount; t++) if (living(m, t).length) aliveTeams++;
    const cap = teamCount > 2 ? 34 : 46;
    if (aliveTeams <= 1 || m.time > cap) {
      if (!m.ending) { m.ending = true; m.endDelay = 0.85; }
      m.endDelay -= dt;
      if (m.endDelay <= 0) {
        m.over = true;
        m.winner = decide(m);
      }
    }
  }

  IL.WORLD = WORLD;
  IL.scaledStats = scaledStats;
  IL.createMatch = createMatch;
  IL.stepMatch = stepMatch;
})(typeof window !== "undefined" ? window : globalThis);
