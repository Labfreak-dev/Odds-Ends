/* Iron League — arena autobattler. Pure step(); no DOM.
   The pit is wider than the old 960×600 well. A camera in render.js
   follows the squads; units roam WORLD.left/right/top/bottom. */
(function (root) {
  const IL = root.IL = root.IL || {};

  const WORLD = { w: 1680, h: 1080, left: 150, right: 1530, top: 220, bottom: 920 };

  function kitOf(cls) {
    return IL.CLASSES[cls] || IL.CLASSES.warrior;
  }

  function makeUnit(fighter, team, slot, n) {
    const kit = kitOf(fighter.cls);
    const lv = fighter.level || 1;
    const spanY = n === 1 ? [0] : n === 2 ? [-150, 150] : [-210, 0, 210];
    const midY = (WORLD.top + WORLD.bottom) / 2;
    const spanX = WORLD.right - WORLD.left;
    const x = team === 0 ? WORLD.left + spanX * 0.36 : WORLD.left + spanX * 0.64;
    return {
      id: fighter.id || ("u" + team + slot),
      name: fighter.name || "Fighter",
      cls: kit.id,
      team: team,
      parts: fighter.parts,
      level: lv,
      x: x + (team === 0 ? -1 : 1) * (slot * 22),
      y: midY + (spanY[slot] || 0),
      vx: 0,
      vy: 0,
      z: 0,
      vz: 0,
      facing: team === 0 ? 1 : -1,
      hp: Math.round(kit.hp * (1 + (lv - 1) * 0.08)),
      maxHp: Math.round(kit.hp * (1 + (lv - 1) * 0.08)),
      atk: Math.round(kit.atk * (1 + (lv - 1) * 0.06)),
      def: kit.def,
      speed: kit.speed,
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
      anim: kit.id === "tank" ? "idle2" : "idle",
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
      engage: 0.65,
      hitstop: 0,
      ending: false,
      endDelay: 0,
      over: false,
      winner: null,
      kills: [0, 0],
      stats: {
        hits: 0, shots: 0, casts: 0, cast2: 0, blocks: 0, dashes: 0,
        rolls: 0, dodges: 0, leaps: 0, airs: 0, slashes: 0, deaths: 0, whiffs: 0
      }
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
    u.state = "attack";
    u.anim = clip;
    u.animT = 0;
    u.actT = IL.clipDur(clip);
    u.didHit = false;
    u.didSlash = false;
    u.z = 0;
    u.trail = null;
    if (u.role !== "kite") {
      u.vx = u.facing * 42;
      u.vy *= 0.2;
    }
  }

  function startCast(m, u, target) {
    face(u, target);
    const casts = u.casts.length ? u.casts : ["cast1"];
    const clip = casts[u.castCursor % casts.length];
    u.castCursor++;
    const hot = clip === "cast2";
    const dur = hot ? u.castTime * 0.78 : u.castTime;
    const r = hot ? Math.round(u.castRadius * 0.64) : u.castRadius;
    u.state = "cast";
    u.anim = clip;
    u.animT = 0;
    u.actT = dur;
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

  function deal(m, src, dst, raw) {
    if (!dst || dst.hp <= 0) return;
    if (dst.iframe > 0) {
      m.stats.dodges++;
      m.events.push({ type: "dodge", x: dst.x, y: dst.y - 34, team: dst.team });
      fx(m, "smoke", dst.x, dst.y - 6, { size: 96, ground: true });
      return;
    }
    const blocked = dst.state === "block";
    let dmg = raw - dst.def * 0.35;
    if (blocked) dmg *= 0.4;
    dmg = Math.max(1, Math.round(dmg));
    dst.hp -= dmg;
    dst.flash = 0.14;
    m.hitstop = blocked ? 0.03 : 0.04;
    m.stats.hits++;
    m.events.push({ type: "dmg", x: dst.x, y: dst.y - 40 - (dst.z || 0), n: dmg, blocked: blocked, team: dst.team });
    fx(m, "spark", dst.x, dst.y - 22 - (dst.z || 0), { size: blocked ? 90 : 128 });
    if (blocked) fx(m, "orbit", dst.x + dst.facing * 8, dst.y - 22, { size: 130 });
    if (dst.hp <= 0) {
      dst.hp = 0;
      dst.alive = false;
      dst.state = "dead";
      dst.anim = "die";
      dst.animT = 0;
      dst.vx = 0;
      dst.vy = 0;
      dst.z = 0;
      dst.iframe = 0;
      dst.cast = null;
      dst.trail = null;
      m.kills[src ? src.team : (1 - dst.team)]++;
      m.stats.deaths++;
      m.events.push({ type: "death", id: dst.id, team: dst.team });
      fx(m, "boom", dst.x, dst.y - 18, { size: 168 });
      return;
    }
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
    m.shots.push({
      x: ox, y: oy, vx: dx / d * sp, vy: dy / d * sp,
      team: u.team, dmg: u.atk, r: 8, life: 1.15, src: u.id,
      trail: [], drop: 42
    });
    m.stats.shots++;
    fx(m, "spark", ox, oy, { size: 72 });
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
      m.stats.casts++;
      if (c.kind === "cast2") m.stats.cast2++;
      const mul = c.kind === "cast2" ? 1.3 : 1.15;
      m.events.push({ type: "boom", x: c.x, y: c.y, r: c.r, kind: c.kind });
      fx(m, c.kind === "cast2" ? "bolt" : "boom", c.x, c.y, { size: Math.round(c.r * 2.35) });
      if (c.kind === "cast2") fx(m, "spark", c.x, c.y, { size: Math.round(c.r * 1.5) });
      for (let i = 0; i < m.units.length; i++) {
        const e = m.units[i];
        if (e.team === u.team || e.hp <= 0) continue;
        const d = Math.hypot(e.x - c.x, e.y - c.y);
        if (d <= c.r + e.radius * 0.45) deal(m, u, e, Math.round(u.atk * mul));
      }
    }
    u.cast = null;
    u.state = "idle";
    u.anim = idleClip(u);
    u.cool = 1.15;
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
          deal(m, u, e, Math.round(u.atk * 0.55));
          break;
        }
      }
    }
    if (u.actT > 0) return;
    const t = nearest(m, u);
    const dist = t ? Math.hypot(t.x - u.x, t.y - u.y) : 999;
    u.trail = null;
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
    if (room(ax, ay) >= room(-ax, -ay)) return { x: ax, y: ay };
    return { x: -ax, y: -ay };
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
          const outX = dist < 1 ? 1 : dx / dist;
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
    if (u.rollCd > 0 || u.iframe > 0) {
      return false;
    }
    const th = incomingThreat(m, u);
    if (!th || th.score < 78) {
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
    if (maybeRoll(m, u, dist)) return;
    const reach = u.range + t.radius;

    if (u.role === "melee") {
      if (dist <= reach && u.cool <= 0) {
        const clip = u.attacks[u.atkCursor % u.attacks.length];
        u.atkCursor++;
        startAttack(u, clip, t);
        return;
      }
      if (u.leaps && u.leapCd <= 0 && dist > reach + 6 && dist < reach + 150 && m.rng() < 0.04) {
        startLeap(m, u, t);
        return;
      }
      steer(u, t.x - u.facing * 8, t.y, u.speed, dt);
    } else if (u.role === "kite") {
      if (dist < 118) steer(u, u.x - (t.x - u.x), u.y - (t.y - u.y), u.speed, dt);
      else if (dist > u.range - 16) steer(u, t.x, t.y, u.speed, dt);
      else {
        const dx = t.x - u.x;
        const dy = t.y - u.y;
        const d = Math.hypot(dx, dy) || 1;
        const side = ((u.id.charCodeAt(u.id.length - 1) + Math.floor(m.time * 0.7)) % 2 === 0) ? 1 : -1;
        steer(u, u.x + (-dy / d) * side * 120, u.y + (dx / d) * side * 120, u.speed * 0.72, dt);
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
      if (dist > stop) steer(u, t.x, t.y, u.speed, dt);
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
      steer(u, t.x, t.y, u.speed, dt);
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
      if (a.hp <= 0 || (a.z || 0) > 12) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (b.hp <= 0 || (b.z || 0) > 12) continue;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.hypot(dx, dy);
        const min = a.radius + b.radius;
        if (dist >= min) continue;
        if (dist < 0.001) { dx = 1; dy = 0; dist = 1; }
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
        if (Math.hypot(e.x - p.x, bodyY - p.y) <= e.radius + p.r) {
          const src = m.units.filter(function (u) { return u.id === p.src; })[0] || null;
          deal(m, src, e, p.dmg);
          p.dead = true;
          break;
        }
      }
    }
    if (m.shots.length) m.shots = m.shots.filter(function (p) { return !p.dead; });
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
    /* Alternate which squad steps first so rolls don't always favor one side. */
    if ((m.time * 60 | 0) % 2 === 1) order.reverse();
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

    const alive0 = living(m, 0).length > 0;
    const alive1 = living(m, 1).length > 0;
    if (!alive0 || !alive1 || m.time > 46) {
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
