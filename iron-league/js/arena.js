/* Iron League — arena autobattler. Pure step(); no DOM. */
(function (root) {
  const IL = root.IL = root.IL || {};

  const WORLD = { w: 960, h: 600, left: 72, right: 888, top: 148, bottom: 508 };

  function kitOf(cls) {
    return IL.CLASSES[cls] || IL.CLASSES.warrior;
  }

  function makeUnit(fighter, team, slot, n) {
    const kit = kitOf(fighter.cls);
    const lv = fighter.level || 1;
    const ys = n === 1 ? [328] : n === 2 ? [230, 426] : [188, 328, 468];
    const x = team === 0 ? 300 : 660;
    return {
      id: fighter.id || ("u" + team + slot),
      name: fighter.name || "Fighter",
      cls: kit.id,
      team: team,
      parts: fighter.parts,
      level: lv,
      x: x + (team === 0 ? -1 : 1) * (slot * 6),
      y: ys[slot] || 328,
      vx: 0,
      vy: 0,
      facing: team === 0 ? 1 : -1,
      hp: Math.round(kit.hp * (1 + (lv - 1) * 0.08)),
      maxHp: Math.round(kit.hp * (1 + (lv - 1) * 0.08)),
      atk: Math.round(kit.atk * (1 + (lv - 1) * 0.06)),
      def: kit.def,
      speed: kit.speed,
      radius: kit.radius,
      range: kit.range,
      role: kit.role,
      attacks: kit.attacks.slice(),
      castTime: kit.castTime || 0.95,
      castRadius: kit.castRadius || 74,
      atkCursor: 0,
      state: "idle",
      anim: kit.id === "tank" ? "idle2" : "idle",
      animT: slot * 0.17,
      actT: 0,
      cool: 0.15 + slot * 0.08,
      dashCd: 0.4,
      blockCd: 0.8 + slot * 0.2,
      hurtCd: 0,
      flash: 0,
      didHit: false,
      cast: null,
      alive: true
    };
  }

  function createMatch(opts) {
    const left = opts.left || [];
    const right = opts.right || [];
    const units = [];
    left.forEach((f, i) => units.push(makeUnit(f, 0, i, left.length)));
    right.forEach((f, i) => units.push(makeUnit(f, 1, i, right.length)));
    return {
      seed: opts.seed >>> 0,
      rng: IL.mulberry32(opts.seed >>> 0 || 1),
      leftName: opts.leftName || "Your club",
      rightName: opts.rightName || "Rivals",
      units: units,
      shots: [],
      events: [],
      time: 0,
      engage: 0.7,
      hitstop: 0,
      ending: false,
      endDelay: 0,
      over: false,
      winner: null,
      kills: [0, 0],
      stats: { hits: 0, shots: 0, casts: 0, blocks: 0, dashes: 0, deaths: 0 }
    };
  }

  function living(m, team) {
    return m.units.filter(u => u.team === team && u.hp > 0);
  }

  function nearest(m, u) {
    let best = null;
    let bestD = 1e9;
    for (let i = 0; i < m.units.length; i++) {
      const e = m.units[i];
      if (e.team === u.team || e.hp <= 0) continue;
      const d = Math.hypot(e.x - u.x, e.y - u.y);
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }

  function face(u, t) {
    if (t) u.facing = t.x >= u.x ? 1 : -1;
  }

  function idleClip(u) { return u.cls === "tank" ? "idle2" : "idle"; }
  function runClip(u) { return (u.cls === "rogue" || u.cls === "archer") ? "run2" : "run"; }

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
  }

  function startAttack(u, clip, target) {
    face(u, target);
    u.state = "attack";
    u.anim = clip;
    u.animT = 0;
    u.actT = IL.clipDur(clip);
    u.didHit = false;
    if (u.role !== "kite") {
      u.vx = u.facing * 36;
      u.vy *= 0.2;
    }
  }

  function startCast(m, u, target) {
    face(u, target);
    u.state = "cast";
    u.anim = "cast1";
    u.animT = 0;
    u.actT = u.castTime;
    u.vx = 0;
    u.vy = 0;
    u.cast = {
      x: target.x,
      y: target.y,
      r: u.castRadius,
      t: 0,
      dur: u.castTime
    };
  }

  function startDash(m, u, target) {
    const dx = target.x - u.x;
    const dy = target.y - u.y;
    const d = Math.hypot(dx, dy) || 1;
    u.state = "dash";
    u.anim = "dash";
    u.animT = 0;
    u.actT = 0.36;
    u.facing = dx >= 0 ? 1 : -1;
    u.vx = dx / d * 370;
    u.vy = dy / d * 370;
    u.dashCd = 2.35;
    m.stats.dashes++;
  }

  function startBlock(m, u) {
    u.state = "block";
    u.anim = "block";
    u.animT = 0;
    u.actT = 0.7;
    u.vx = 0;
    u.vy = 0;
    u.blockCd = 3.3;
    m.stats.blocks++;
  }

  function deal(m, src, dst, raw) {
    if (!dst || dst.hp <= 0) return;
    let blocked = dst.state === "block";
    let dmg = raw - dst.def * 0.35;
    if (blocked) dmg *= 0.32;
    dmg = Math.max(1, Math.round(dmg));
    dst.hp -= dmg;
    dst.flash = 0.14;
    m.hitstop = 0.045;
    m.stats.hits++;
    m.events.push({ type: "dmg", x: dst.x, y: dst.y - 36, n: dmg, blocked: blocked, team: dst.team });
    if (dst.hp <= 0) {
      dst.hp = 0;
      dst.alive = false;
      dst.state = "dead";
      dst.anim = "die";
      dst.animT = 0;
      dst.vx = 0;
      dst.vy = 0;
      dst.cast = null;
      m.kills[src ? src.team : (1 - dst.team)]++;
      m.stats.deaths++;
      m.events.push({ type: "death", id: dst.id, team: dst.team });
      return;
    }
    if (dst.hurtCd <= 0 && (dst.state === "idle" || dst.state === "run")) {
      dst.state = "hurt";
      dst.anim = "hurt";
      dst.animT = 0;
      dst.actT = 0.26;
      dst.vx *= 0.2;
      dst.vy *= 0.2;
      dst.hurtCd = 0.65;
    }
  }

  function meleeVictim(m, u) {
    let best = null;
    let bestD = 1e9;
    for (let i = 0; i < m.units.length; i++) {
      const e = m.units[i];
      if (e.team === u.team || e.hp <= 0) continue;
      const dx = e.x - u.x;
      const dy = e.y - u.y;
      if (dx * u.facing < -8) continue;
      const dist = Math.hypot(dx, dy);
      if (dist > u.range + e.radius) continue;
      if (dist < bestD) { bestD = dist; best = e; }
    }
    return best;
  }

  function tryMelee(m, u) {
    const clip = IL.CLIPS[u.anim];
    if (!clip || !clip.hits || u.didHit) return;
    const f = IL.frameIndex(u.anim, u.animT);
    if (clip.hits.indexOf(f) < 0) return;
    const e = meleeVictim(m, u);
    if (!e) return;
    u.didHit = true;
    const swing = u.anim === "atk3" ? 1.05 : u.anim === "atk2" ? 1.12 : 1;
    deal(m, u, e, u.atk * swing);
  }

  function tryShot(m, u) {
    const clip = IL.CLIPS[u.anim];
    if (!clip || !clip.hits || u.didHit) return;
    const f = IL.frameIndex(u.anim, u.animT);
    if (clip.hits.indexOf(f) < 0) return;
    u.didHit = true;
    const t = nearest(m, u);
    face(u, t);
    const aimX = t ? t.x : u.x + u.facing * 200;
    const aimY = t ? t.y - 8 : u.y - 8;
    const ox = u.x + u.facing * 16;
    const oy = u.y - 16;
    const dx = aimX - ox;
    const dy = aimY - oy;
    const d = Math.hypot(dx, dy) || 1;
    const sp = 380;
    m.shots.push({
      x: ox, y: oy, vx: dx / d * sp, vy: dy / d * sp,
      team: u.team, dmg: u.atk, r: 5, life: 1.15, src: u.id
    });
    m.stats.shots++;
  }

  function stepAttack(m, u, dt) {
    u.animT += dt;
    u.actT -= dt;
    damp(u, 0.9);
    u.x += u.vx * dt;
    u.y += u.vy * dt;
    if (u.role === "kite") tryShot(m, u);
    else tryMelee(m, u);
    if (u.actT <= 0) {
      u.state = "idle";
      u.anim = idleClip(u);
      u.cool = u.role === "kite" ? 0.62 : 0.2;
    }
  }

  function stepCast(m, u, dt) {
    u.animT += dt;
    u.actT -= dt;
    if (u.cast) u.cast.t += dt;
    if (u.actT > 0) return;
    const c = u.cast;
    if (c) {
      m.stats.casts++;
      m.events.push({ type: "boom", x: c.x, y: c.y, r: c.r });
      for (let i = 0; i < m.units.length; i++) {
        const e = m.units[i];
        if (e.team === u.team || e.hp <= 0) continue;
        const d = Math.hypot(e.x - c.x, e.y - c.y);
        if (d <= c.r + e.radius * 0.4) deal(m, u, e, Math.round(u.atk * 1.15));
      }
    }
    u.cast = null;
    u.state = "idle";
    u.anim = idleClip(u);
    u.cool = 1.25;
  }

  function stepDash(m, u, dt) {
    u.animT += dt;
    u.actT -= dt;
    u.x += u.vx * dt;
    u.y += u.vy * dt;
    if (u.actT > 0) return;
    const t = nearest(m, u);
    const dist = t ? Math.hypot(t.x - u.x, t.y - u.y) : 999;
    if (t && dist <= u.range + t.radius + 8) startAttack(u, "atk3", t);
    else {
      u.state = "idle";
      u.cool = 0.1;
    }
  }

  function stepBlock(m, u, dt) {
    u.animT += dt;
    u.actT -= dt;
    if (u.actT > 0) return;
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

  function think(m, u, dt) {
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
    const reach = u.range + t.radius;

    if (u.role === "melee") {
      if (dist <= reach && u.cool <= 0) {
        const clip = u.attacks[u.atkCursor % u.attacks.length];
        u.atkCursor++;
        startAttack(u, clip, t);
        return;
      }
      steer(u, t.x - u.facing * 10, t.y, u.speed, dt);
    } else if (u.role === "kite") {
      if (dist < 128) steer(u, u.x - (t.x - u.x), u.y - (t.y - u.y), u.speed, dt);
      else if (dist > u.range - 10) steer(u, t.x, t.y, u.speed, dt);
      else {
        const dx = t.x - u.x;
        const dy = t.y - u.y;
        const d = Math.hypot(dx, dy) || 1;
        const side = ((u.id.charCodeAt(u.id.length - 1) + Math.floor(m.time)) % 2 === 0) ? 1 : -1;
        steer(u, u.x + (-dy / d) * side * 80, u.y + (dx / d) * side * 80, u.speed * 0.65, dt);
      }
      if (dist <= u.range + 8 && dist >= 70 && u.cool <= 0) {
        startAttack(u, "atk1", t);
        return;
      }
    } else if (u.role === "cast") {
      if (dist <= u.range && u.cool <= 0) {
        startCast(m, u, t);
        return;
      }
      const stop = u.range * 0.72;
      if (dist > stop) steer(u, t.x, t.y, u.speed, dt);
      else damp(u, 0.7);
    } else if (u.role === "tank") {
      if (dist < 86 && u.blockCd <= 0 && m.rng() < 0.55) {
        startBlock(m, u);
        return;
      }
      if (dist <= reach && u.cool <= 0) {
        startAttack(u, "atk1", t);
        return;
      }
      steer(u, t.x, t.y, u.speed, dt);
    } else if (u.role === "dash") {
      if (u.dashCd <= 0 && dist > 62 && dist < 360) {
        startDash(m, u, t);
        return;
      }
      if (dist <= reach && u.cool <= 0) {
        startAttack(u, "atk3", t);
        return;
      }
      steer(u, t.x, t.y, u.speed, dt);
    }

    u.x += u.vx * dt;
    u.y += u.vy * dt;
    setMoveAnim(u, dt);
  }

  function separate(m) {
    const list = m.units;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (a.hp <= 0) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (b.hp <= 0) continue;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.hypot(dx, dy);
        const min = a.radius + b.radius;
        if (dist >= min) continue;
        if (dist < 0.001) { dx = 1; dy = 0; dist = 1; }
        const push = (min - dist) * 0.45;
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
    if (u.x < WORLD.left) u.x = WORLD.left;
    if (u.x > WORLD.right) u.x = WORLD.right;
    if (u.y < WORLD.top) u.y = WORLD.top;
    if (u.y > WORLD.bottom) u.y = WORLD.bottom;
  }

  function stepShots(m, dt) {
    for (let i = 0; i < m.shots.length; i++) {
      const p = m.shots[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0 || p.x < 0 || p.x > WORLD.w || p.y < 0 || p.y > WORLD.h) {
        p.dead = true;
        continue;
      }
      for (let j = 0; j < m.units.length; j++) {
        const e = m.units[j];
        if (e.team === p.team || e.hp <= 0) continue;
        const bodyY = e.y - 14;
        if (Math.hypot(e.x - p.x, bodyY - p.y) <= e.radius + p.r) {
          const src = m.units.filter(u => u.id === p.src)[0] || null;
          deal(m, src, e, p.dmg);
          p.dead = true;
          break;
        }
      }
    }
    if (m.shots.length) m.shots = m.shots.filter(p => !p.dead);
  }

  function decide(m) {
    const a0 = living(m, 0);
    const a1 = living(m, 1);
    if (a0.length && !a1.length) return 0;
    if (a1.length && !a0.length) return 1;
    const sum = function (team) {
      return m.units.filter(function (u) { return u.team === team; })
        .reduce(function (s, u) { return s + u.hp / u.maxHp; }, 0);
    };
    const s0 = sum(0);
    const s1 = sum(1);
    if (Math.abs(s0 - s1) < 1e-9) return m.rng() < 0.5 ? 0 : 1;
    return s0 > s1 ? 0 : 1;
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
    for (let i = 0; i < m.units.length; i++) {
      const u = m.units[i];
      u.cool = Math.max(0, u.cool - dt);
      u.dashCd = Math.max(0, u.dashCd - dt);
      u.blockCd = Math.max(0, u.blockCd - dt);
      u.hurtCd = Math.max(0, u.hurtCd - dt);
      u.flash = Math.max(0, u.flash - dt);
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
      if (u.state === "attack") stepAttack(m, u, dt);
      else if (u.state === "cast") stepCast(m, u, dt);
      else if (u.state === "dash") stepDash(m, u, dt);
      else if (u.state === "block") stepBlock(m, u, dt);
      else if (u.state === "hurt") stepHurt(m, u, dt);
      else think(m, u, dt);
    }

    separate(m);
    for (let i = 0; i < m.units.length; i++) clampUnit(m.units[i]);
    stepShots(m, dt);

    const alive0 = living(m, 0).length > 0;
    const alive1 = living(m, 1).length > 0;
    if (!alive0 || !alive1 || m.time > 48) {
      if (!m.ending) { m.ending = true; m.endDelay = 0.85; }
      m.endDelay -= dt;
      if (m.endDelay <= 0) {
        m.over = true;
        m.winner = decide(m);
      }
    }
  }

  IL.WORLD = WORLD;
  IL.createMatch = createMatch;
  IL.stepMatch = stepMatch;
})(typeof window !== "undefined" ? window : globalThis);
