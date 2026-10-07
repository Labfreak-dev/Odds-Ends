/* Iron League — pixel combat FX (v68).
   Modeled on Eslabong's store footage: hits burst into chunky square
   pixels (blood, sparks, dust), spells bloom as soft glows, fire leaves a
   scorch crater, lightning drops as a jagged bolt from the sky, dashes
   leave afterimages, and an AoE is marked by one thin circle. No stacked
   ellipse rings, no boxed sprite strips.

   Every effect is anchored to a world point (ax, ay) on the floor plus a
   screen-space offset (ox, oy) in world units. "Up" is always up on the
   screen, so a turned phone floor draws the same burst as a laptop. */
(function (root) {
  const IL = root.IL = root.IL || {};

  const CAP = 1100;
  /* Pixel size and count multipliers: Eslabong's bursts are chunky. */
  const SZ = 1.55;
  const NUM = 1.4;
  const R = Math.random;

  const PAL = {
    blood: ["120,10,18", "176,20,28", "214,36,40", "240,70,56"],
    spark: ["255,255,255", "255,244,200", "255,214,120"],
    steel: ["255,255,255", "214,230,255", "160,196,255"],
    dust: ["236,228,218", "206,198,188", "176,166,156"],
    smoke: ["58,50,46", "84,76,70", "40,34,32"],
    fire: ["255,244,170", "255,196,80", "255,132,40", "214,70,28"],
    ice: ["240,252,255", "176,228,255", "112,192,248"],
    lightning: ["255,255,255", "255,250,190", "196,226,255"],
    shadow: ["226,182,255", "176,104,244", "112,58,196"],
    holy: ["255,252,226", "255,230,150", "255,204,96"],
    nature: ["226,255,186", "156,236,112", "84,190,72"],
    poison: ["224,255,150", "172,236,80", "112,182,50"],
    arcane: ["244,226,255", "214,172,255", "164,120,250"]
  };
  const CORE = {
    fire: "255,150,50", ice: "140,214,255", lightning: "255,246,170", shadow: "176,110,255",
    holy: "255,222,130", nature: "140,230,110", poison: "170,236,80", arcane: "200,160,255"
  };

  let spawned = 0;

  function turned() {
    return !!(IL.pitCam && IL.pitCam.portrait);
  }

  /* Screen offset -> world point. A portrait floor maps screen x to world
     y and screen y to world x (render.js swaps the axes). */
  function at(ax, ay, ox, oy, turn) {
    return turn ? [ax + oy, ay + ox] : [ax + ox, ay + oy];
  }

  /* A world direction as a screen angle. */
  function screenAngle(dx, dy, turn) {
    return turn ? Math.atan2(dx, dy) : Math.atan2(dy, dx);
  }

  function bag(fx) {
    if (!fx.pfx) {
      fx.pfx = { parts: [], glows: [], decals: [], bolts: [], arcs: [], rings: [], spikes: [], streaks: [], ghosts: [] };
    }
    return fx.pfx;
  }

  function pick(list) {
    return list[(R() * list.length) | 0];
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function range(r, fallback) {
    if (r == null) return fallback;
    if (typeof r === "number") return r;
    return lerp(r[0], r[1], R());
  }

  /* ---------- primitives ---------- */

  /* Square pixel particles. o.dir is a screen angle (null = all round). */
  function burst(fx, x, y, lift, o) {
    const b = bag(fx);
    const pal = PAL[o.pal] || o.pal || PAL.spark;
    const n = Math.round((o.n || 8) * NUM);
    for (let i = 0; i < n; i++) {
      const ang = o.dir == null ? R() * Math.PI * 2 : o.dir + (R() - 0.5) * (o.spread == null ? 1.4 : o.spread);
      const sp = range(o.speed, [50, 140]);
      b.parts.push({
        ax: x, ay: y,
        ox: (R() - 0.5) * (o.jitter || 4),
        oy: -lift + (R() - 0.5) * (o.jitter || 4),
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - (o.up || 0),
        g: o.g == null ? 240 : o.g,
        drag: o.drag == null ? 2.6 : o.drag,
        size: range(o.size, [1.4, 2.6]) * SZ,
        rgb: pick(pal),
        t: -(o.delay || 0) * (0.6 + R() * 0.8),
        life: range(o.life, [0.3, 0.55]),
        add: !!o.add,
        shape: o.shape || "sq",
        floor: o.floor == null ? lift + 3 : o.floor
      });
    }
    spawned += n;
    if (b.parts.length > CAP) b.parts.splice(0, b.parts.length - CAP);
  }

  function glow(fx, x, y, lift, r, rgb, life, hot) {
    bag(fx).glows.push({ ax: x, ay: y, oy: -lift, r: r, rgb: rgb, t: 0, life: life || 0.3, hot: hot == null ? 1 : hot });
    spawned++;
  }

  function decal(fx, x, y, r, kind, life) {
    const b = bag(fx);
    const splats = [];
    const n = kind === "blood" ? 7 : kind === "scorch" ? 10 : 6;
    for (let i = 0; i < n; i++) {
      const a = R() * Math.PI * 2;
      const d = R() * r * 0.8;
      splats.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, s: (kind === "blood" ? 1.2 : 2) + R() * (kind === "blood" ? 2.4 : 3) });
    }
    /* Craters show once the flash has burned off. */
    b.decals.push({ x: x, y: y, r: r, kind: kind, t: kind === "scorch" ? -0.18 : 0, life: life || 3, splats: splats, seed: R() * 10 });
    if (b.decals.length > 40) b.decals.shift();
    spawned++;
  }

  function jag(x1, y1, x2, y2, segs, amp) {
    const pts = [[x1, y1]];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const d = Math.hypot(dx, dy) || 1;
    const nx = -dy / d;
    const ny = dx / d;
    for (let i = 1; i < segs; i++) {
      const t = i / segs;
      const w = (R() - 0.5) * 2 * amp * Math.sin(t * Math.PI) + (i % 2 ? amp * 0.35 : -amp * 0.35);
      pts.push([x1 + dx * t + nx * w, y1 + dy * t + ny * w]);
    }
    pts.push([x2, y2]);
    return pts;
  }

  /* A bolt between two screen-offset points around one anchor. sky=true
     drops it from high above the target. */
  function bolt(fx, o) {
    const b = bag(fx);
    const e = {
      ax: o.ax, ay: o.ay,
      x1: o.x1, y1: o.y1, x2: o.x2, y2: o.y2,
      rgb: o.rgb || "255,250,190",
      t: 0, life: o.life || 0.3, k: 0,
      segs: o.segs || 9, amp: o.amp || 9, width: o.width || 1.6,
      branch: o.branch == null ? 2 : o.branch,
      strands: o.strands || 2
    };
    e.paths = shapeBolt(e);
    b.bolts.push(e);
    spawned++;
  }

  function shapeBolt(e) {
    const paths = [];
    for (let s = 0; s < e.strands; s++) {
      paths.push(jag(e.x1 + (R() - 0.5) * 6, e.y1, e.x2, e.y2, e.segs, e.amp * (s ? 0.7 : 1)));
    }
    const main = paths[0];
    for (let k = 0; k < e.branch; k++) {
      const i = 2 + ((R() * (main.length - 4)) | 0);
      const p = main[i];
      if (!p) continue;
      const side = R() < 0.5 ? -1 : 1;
      paths.push(jag(p[0], p[1], p[0] + side * (10 + R() * 16), p[1] + 8 + R() * 14, 3, 4));
    }
    return paths;
  }

  /* One crisp crescent, Eslabong's melee swoosh. spin=true is a full turn. */
  function slash(fx, x, y, lift, face, r, rgb, opt) {
    opt = opt || {};
    bag(fx).arcs.push({
      ax: x, ay: y, oy: -lift, face: face < 0 ? -1 : 1, r: r, rgb: rgb || "255,255,255",
      t: 0, life: opt.life || (opt.spin ? 0.26 : 0.14), spin: !!opt.spin, heavy: !!opt.heavy, thrust: !!opt.thrust
    });
    spawned++;
  }

  function ring(fx, x, y, lift, r, rgb, life, width) {
    bag(fx).rings.push({ ax: x, ay: y, oy: -lift, r: r, rgb: rgb, t: 0, life: life || 0.3, w: width || 1.4 });
    spawned++;
  }

  /* Radial blades flying out of a point (nova, thorns). */
  function spikes(fx, x, y, lift, r, rgb, n) {
    const b = bag(fx);
    const count = n || 12;
    const off = R() * Math.PI;
    for (let i = 0; i < count; i++) {
      b.spikes.push({ ax: x, ay: y, oy: -lift, ang: off + (i / count) * Math.PI * 2 + (R() - 0.5) * 0.2, r: r * (0.75 + R() * 0.35), rgb: rgb, t: 0, life: 0.34 + R() * 0.1 });
    }
    spawned += count;
  }

  /* Straight streaks from one point to another (multi-strike, beams). */
  function streaks(fx, o) {
    const b = bag(fx);
    const n = o.n || 3;
    for (let i = 0; i < n; i++) {
      const spread = (i - (n - 1) / 2) * (o.gap || 3.5);
      b.streaks.push({
        ax: o.ax, ay: o.ay, x1: o.x1, y1: o.y1 + spread, x2: o.x2, y2: o.y2 + spread * 0.4,
        rgb: o.rgb || "240,70,56", t: -i * (o.stagger || 0.025), life: o.life || 0.16, w: o.w || 1.6
      });
    }
    spawned += n;
  }

  /* Afterimage of a fighter mid-dash. The renderer calls this. */
  function ghost(fx, u, frame, gy, scale) {
    const b = bag(fx);
    const last = b.ghosts.length ? b.ghosts[b.ghosts.length - 1] : null;
    const now = fx.t || 0;
    if (last && last.id === u.id && now - last.born < 0.035) return;
    b.ghosts.push({ id: u.id, sprite: u.sprite, frame: frame, x: u.x, gy: gy, scale: scale, facing: u.facing, cls: u.cls, kind: u.weaponKind, born: now, t: 0, life: 0.26 });
    if (b.ghosts.length > 60) b.ghosts.shift();
  }

  /* ---------- composed effects ---------- */

  function screenDir(e, turn) {
    if (e.dx == null && e.dy == null) return null;
    return screenAngle(e.dx || 0, e.dy || 0, turn);
  }

  function hit(fx, e) {
    const turn = turned();
    const x = e.x;
    const y = e.fy != null ? e.fy : e.y;
    const lift = e.fy != null ? Math.max(0, e.fy - e.y) : 0;
    const dir = screenDir(e, turn);
    if (e.blocked) {
      burst(fx, x, y, lift, { pal: "steel", n: 9, dir: dir == null ? null : dir + Math.PI, spread: 2.2, speed: [70, 170], g: 120, life: [0.16, 0.3], size: [1.2, 2], add: true });
      glow(fx, x, y, lift, 10, "200,220,255", 0.1);
      return;
    }
    if (e.school) {
      const pal = PAL[e.school] ? e.school : "arcane";
      burst(fx, x, y, lift, { pal: pal, n: e.big ? 16 : 11, dir: dir, spread: 2.4, speed: [40, 130], g: 60, life: [0.3, 0.6], size: [1.4, 2.8], add: true, up: 20 });
      glow(fx, x, y, lift, e.big ? 20 : 14, CORE[pal] || CORE.arcane, 0.18);
      if (e.school === "fire") burst(fx, x, y, lift, { pal: "smoke", n: 4, speed: [10, 30], g: -40, life: [0.5, 0.8], size: [2, 3.2], delay: 0.1 });
      return;
    }
    const n = e.crit ? 22 : e.big ? 15 : 10;
    burst(fx, x, y, lift, { pal: "blood", n: n, dir: dir, spread: e.crit ? 1.6 : 1.1, speed: e.crit ? [80, 220] : [60, 170], g: 300, life: [0.3, 0.6], size: e.crit ? [1.6, 3.2] : [1.3, 2.6] });
    burst(fx, x, y, lift, { pal: "spark", n: e.crit ? 7 : 4, dir: dir, spread: 1.8, speed: [90, 200], g: 80, life: [0.1, 0.2], size: [1, 1.6], add: true });
    glow(fx, x, y, lift, e.crit ? 16 : 9, e.crit ? "255,170,80" : "255,240,220", e.crit ? 0.14 : 0.08);
  }

  function die(fx, e) {
    const x = e.x;
    const y = e.y;
    burst(fx, x, y, 14, { pal: "blood", n: 30, speed: [50, 190], g: 280, life: [0.4, 0.8], size: [1.5, 3.2], up: 40 });
    burst(fx, x, y, 2, { pal: "dust", n: 12, speed: [20, 60], g: -30, life: [0.5, 0.9], size: [2, 3.4] });
    decal(fx, x, y, 14, "blood", 5);
  }

  /* A spell lands on the floor at (x, y) with radius r. */
  function boom(fx, e) {
    const x = e.x;
    const y = e.y;
    const r = e.r || 60;
    const school = e.school || (e.kind === "cast2" || e.kind === "fireball" ? "fire" : "arcane");
    if (school === "fire") {
      glow(fx, x, y, 0, r * 1.15, "255,150,60", 0.42, 1.2);
      glow(fx, x, y, 4, r * 0.5, "255,240,190", 0.16, 1.2);
      burst(fx, x, y, 4, { pal: "fire", n: 30, speed: [60, 210], g: 140, life: [0.3, 0.7], size: [1.6, 3.2], add: true, up: 40 });
      burst(fx, x, y, 6, { pal: "smoke", n: 10, speed: [10, 40], g: -50, life: [0.7, 1.2], size: [2.6, 4.2], delay: 0.16 });
      decal(fx, x, y, r * 0.62, "scorch", 4.5);
    } else if (school === "lightning") {
      sky(fx, x, y, "255,250,190");
      glow(fx, x, y, 0, r * 0.8, "255,246,170", 0.24);
      burst(fx, x, y, 2, { pal: "lightning", n: 18, speed: [70, 190], g: 120, life: [0.2, 0.45], size: [1.2, 2.2], add: true, up: 30 });
      decal(fx, x, y, r * 0.3, "scorch", 2.5);
    } else if (school === "ice") {
      glow(fx, x, y, 0, r * 0.5, "150,214,255", 0.22, 0.8);
      burst(fx, x, y, 4, { pal: "ice", n: 22, speed: [50, 170], g: 160, life: [0.35, 0.7], size: [1.4, 2.8], shape: "shard", up: 30 });
      ring(fx, x, y, 0, r, "200,236,255", 0.28, 1.2);
      decal(fx, x, y, r * 0.6, "frost", 1.4);
    } else {
      const pal = PAL[school] ? school : "arcane";
      glow(fx, x, y, 0, r * 0.5, CORE[pal] || CORE.arcane, 0.26, 0.85);
      burst(fx, x, y, 4, { pal: pal, n: 24, speed: [50, 170], g: 40, life: [0.35, 0.7], size: [1.4, 2.8], add: true, up: 20 });
      ring(fx, x, y, 0, r, CORE[pal] || CORE.arcane, 0.3, 1.2);
    }
  }

  /* Lightning from the sky onto a floor point. */
  function sky(fx, x, y, rgb) {
    bolt(fx, { ax: x, ay: y, x1: (R() - 0.5) * 30, y1: -190, x2: 0, y2: 0, rgb: rgb, life: 0.3, segs: 11, amp: 12, width: 1.8, branch: 3, strands: 2 });
    burst(fx, x, y, 0, { pal: "lightning", n: 8, speed: [60, 150], g: 140, life: [0.15, 0.3], size: [1, 1.8], add: true, up: 40 });
  }

  function chain(fx, x1, y1, l1, x2, y2, l2, rgb) {
    const turn = turned();
    const p1 = turn ? [y1 - y2, x1 - x2] : [x1 - x2, y1 - y2];
    bolt(fx, { ax: x2, ay: y2, x1: p1[0], y1: p1[1] - l1, x2: 0, y2: -l2, rgb: rgb, life: 0.32, segs: 8, amp: 8, width: 1.5, branch: 1, strands: 2 });
    burst(fx, x2, y2, l2, { pal: [rgb, "255,255,255"], n: 8, speed: [40, 120], g: 80, life: [0.15, 0.35], size: [1, 1.8], add: true });
    glow(fx, x2, y2, l2, 12, rgb, 0.16);
  }

  function heal(fx, x, y, lift, rgb) {
    const b = bag(fx);
    for (let i = 0; i < 9; i++) {
      b.parts.push({
        ax: x, ay: y, ox: (R() - 0.5) * 22, oy: -lift + (R() - 0.3) * 14,
        vx: (R() - 0.5) * 10, vy: -26 - R() * 26, g: 0, drag: 0.6,
        size: (1.2 + R() * 0.7) * SZ, rgb: R() < 0.5 ? "214,255,190" : (rgb || "130,230,110"), t: -R() * 0.25, life: 0.7 + R() * 0.4,
        add: true, shape: "plus", floor: 999
      });
    }
    glow(fx, x, y, lift * 0.5, 16, rgb || "130,230,110", 0.4, 0.7);
    spawned += 9;
  }

  function shield(fx, x, y, lift, rgb) {
    ring(fx, x, y, lift, 17, rgb || "170,206,255", 0.5, 1.6);
    burst(fx, x, y, lift, { pal: "steel", n: 8, speed: [20, 60], g: 0, life: [0.3, 0.55], size: [1, 1.6], add: true });
  }

  function summon(fx, x, y, rgb) {
    const b = bag(fx);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      b.parts.push({
        ax: x, ay: y, ox: Math.cos(a) * 14, oy: Math.sin(a) * 6,
        vx: -Math.sin(a) * 30, vy: -30 - R() * 40, g: 0, drag: 1.2,
        size: (1.4 + R()) * SZ, rgb: R() < 0.4 ? "255,255,255" : (rgb || "176,110,255"), t: -R() * 0.2, life: 0.6 + R() * 0.3,
        add: true, shape: "sq", floor: 999
      });
    }
    glow(fx, x, y, 6, 20, rgb || "176,110,255", 0.45, 0.8);
    spawned += 16;
  }

  function dust(fx, x, y, n, dirX) {
    const turn = turned();
    const dir = dirX == null ? null : (turn ? (dirX > 0 ? Math.PI / 2 : -Math.PI / 2) : (dirX > 0 ? 0 : Math.PI));
    burst(fx, x, y, 0, { pal: "dust", n: n || 6, dir: dir == null ? null : dir + Math.PI, spread: 1.6, speed: [12, 45], g: -18, drag: 3, life: [0.35, 0.6], size: [1.6, 3], floor: 999 });
  }

  /* Map an arena "fx" event (the old sprite-strip kinds) to pixels. */
  function legacy(fx, e, lift) {
    const k = e.kind;
    const x = e.x;
    const y = e.fy != null ? e.fy : e.y;
    const l = lift || 0;
    if (k === "smoke") dust(fx, x, y, 6, e.facing);
    else if (k === "dash") dust(fx, x, y + (e.ground ? 0 : 0), 8, e.facing);
    else if (k === "orbit") shield(fx, x, y, l, "170,206,255");
    else if (k === "plasma") {
      burst(fx, x, y, l, { pal: "arcane", n: 10, speed: [20, 70], g: 0, life: [0.3, 0.6], size: [1.2, 2.2], add: true, up: 10 });
      glow(fx, x, y, l, 14, CORE.arcane, 0.26, 0.8);
    } else if (k === "slash") {
      slash(fx, x, y, l, e.facing || 1, 22, "255,255,255", { heavy: true });
    } else if (k === "shot") {
      burst(fx, x, y, l, { pal: "spark", n: 5, dir: turned() ? ((e.facing || 1) > 0 ? Math.PI / 2 : -Math.PI / 2) : ((e.facing || 1) > 0 ? 0 : Math.PI), spread: 0.8, speed: [60, 140], g: 40, life: [0.08, 0.16], size: [1, 1.6], add: true });
    } else if (k === "spark") {
      if ((e.size || 0) > 90) burst(fx, x, y, l, { pal: "spark", n: 8, speed: [40, 110], g: 80, life: [0.12, 0.25], size: [1, 1.8], add: true });
    } else if (k === "bolt") {
      sky(fx, x, y, "255,250,190");
    } else if (k === "boom") {
      glow(fx, x, y, l, 16, "255,200,140", 0.18);
    }
  }

  /* An arena "sig" (signature ability) event. */
  function sig(fx, e, lift) {
    const rgb = e.rgb || "244,210,150";
    const sheet = e.sheet || "";
    const x = e.x;
    const y = e.y;
    if (e.style === "ring") {
      if (e.mark === "band") {
        if (sheet === "sig-ice") {
          boom(fx, { x: x, y: y, r: e.r * 0.8, school: "ice" });
        } else {
          slash(fx, x, y, 12, e.facing || 1, Math.max(26, e.r * 0.42), "255,255,255", { spin: true });
          burst(fx, x, y, 0, { pal: sheet === "sig-fire" ? "fire" : "dust", n: 14, speed: [50, 130], g: -10, life: [0.3, 0.55], size: [1.6, 2.8], add: sheet === "sig-fire", floor: 999 });
          if (sheet === "sig-fire") decal(fx, x, y, e.r * 0.4, "scorch", 3);
        }
      } else if (e.mark === "soft") {
        heal(fx, x, y, 14, rgb);
      } else if (e.mark === "spin") {
        if (sheet === "sig-crack") boom(fx, { x: x, y: y, r: e.r, school: "lightning" });
        else {
          glow(fx, x, y, 14, 18, rgb, 0.2);
          burst(fx, x, y, 14, { pal: [rgb, "255,255,255"], n: 16, speed: [60, 170], g: 120, life: [0.2, 0.45], size: [1.4, 2.4], add: true });
          ring(fx, x, y, 0, e.r * 0.6, rgb, 0.22, 1.2);
        }
      } else if (e.mark === "spike") {
        spikes(fx, x, y, 0, e.r * 0.9, rgb, 14);
        burst(fx, x, y, 2, { pal: [rgb, "255,255,255"], n: 14, speed: [60, 170], g: 40, life: [0.3, 0.55], size: [1.4, 2.4], add: true });
        glow(fx, x, y, 0, e.r * 0.5, rgb, 0.26);
      } else {
        burst(fx, x, y, 4, { pal: [rgb], n: 14, speed: [40, 120], g: 60, life: [0.3, 0.5], size: [1.4, 2.4], add: true });
      }
    } else if (e.style === "chain") {
      chain(fx, e.x, e.y + 18, 18, e.x2, e.y2 + 16, 16, rgb);
      if (e.hop) chain(fx, e.x2, e.y2 + 16, 16, e.x3, e.y3 + 16, 16, rgb);
    } else if (e.style === "trail") {
      const turn = turned();
      const fyA = e.y + 18;
      const fyB = e.y2 + 14;
      const p1 = turn ? [fyA - fyB, e.x - e.x2] : [e.x - e.x2, fyA - fyB];
      if (e.mark === "slash" || e.mark === "streak" || e.mark === "arrow") {
        streaks(fx, { ax: e.x2, ay: fyB, x1: p1[0], y1: p1[1] - 18, x2: 0, y2: -14, rgb: e.mark === "slash" ? "240,70,56" : rgb, n: e.mark === "arrow" ? 2 : 3, life: 0.18 });
      } else if (e.mark === "smoke") {
        dust(fx, e.x, fyA, 10);
        dust(fx, e.x2, fyB, 10);
        burst(fx, e.x2, fyB, 16, { pal: "shadow", n: 12, speed: [30, 90], g: 0, life: [0.3, 0.6], size: [1.4, 2.4], add: true });
      } else if (e.mark === "flask") {
        burst(fx, e.x2, fyB, 4, { pal: [rgb, "255,255,255"], n: 18, speed: [40, 130], g: 160, life: [0.3, 0.6], size: [1.4, 2.6], add: true, up: 40 });
        glow(fx, e.x2, fyB, 4, 18, rgb, 0.3);
        decal(fx, e.x2, fyB, 12, rgb.indexOf("220,70") >= 0 ? "frost" : "scorch", 2.4);
      } else {
        streaks(fx, { ax: e.x2, ay: fyB, x1: p1[0], y1: p1[1] - 18, x2: 0, y2: -14, rgb: rgb, n: 2, gap: 2, life: 0.22, w: 2.2 });
        glow(fx, e.x2, fyB, 14, 14, rgb, 0.2);
      }
    } else if (e.style === "summon") {
      summon(fx, x, y, rgb);
    } else if (e.style === "shield") {
      shield(fx, x, y, 18, rgb);
      if (e.mark === "cross") heal(fx, x, y, 14, rgb);
    } else {
      dust(fx, x, y, 12, e.mark === "back" ? -(e.facing || 1) : (e.facing || 1));
      if (e.mark === "slash") slash(fx, x, y, 14, e.facing || 1, 24, "240,70,56", { heavy: true });
    }
  }

  /* Swing event from the arena: one swoosh, thrusts become a jab line. */
  function swing(fx, e) {
    const heavy = !!e.heavy || e.wk === "axe" || e.wk === "hammer" || e.wk === "mace";
    const y = e.fy != null ? e.fy : e.y + 16;
    const lift = Math.max(0, y - e.y - 2);
    const thrust = !!e.thrust || e.wk === "spear";
    slash(fx, e.x + (e.facing || 1) * 4, y, lift, e.facing || 1, heavy ? 22 : e.wk === "dagger" ? 13 : 18, "255,255,255", { heavy: heavy, thrust: thrust });
  }

  /* ---------- step ---------- */

  function step(fx, dt) {
    const b = fx.pfx;
    if (!b) return;
    for (let i = b.parts.length - 1; i >= 0; i--) {
      const p = b.parts[i];
      p.t += dt;
      if (p.t >= p.life) { b.parts.splice(i, 1); continue; }
      if (p.t < 0) continue;
      const k = Math.exp(-p.drag * dt);
      p.vx *= k;
      p.vy = p.vy * k + p.g * dt;
      p.ox += p.vx * dt;
      p.oy += p.vy * dt;
      /* Land on the floor: pixels that fall settle and slide to a stop. */
      if (p.oy > p.floor - 0) {
        p.oy = p.floor;
        p.vy = 0;
        p.vx *= 0.5;
        p.g = 0;
      }
    }
    age(b.glows, dt);
    age(b.decals, dt);
    age(b.arcs, dt);
    age(b.rings, dt);
    age(b.spikes, dt);
    age(b.streaks, dt);
    age(b.ghosts, dt);
    for (let i = b.bolts.length - 1; i >= 0; i--) {
      const e = b.bolts[i];
      e.t += dt;
      e.k += dt;
      if (e.t >= e.life) { b.bolts.splice(i, 1); continue; }
      if (e.k > 0.055) { e.k = 0; e.paths = shapeBolt(e); }
    }
  }

  function age(list, dt) {
    for (let i = list.length - 1; i >= 0; i--) {
      list[i].t += dt;
      if (list[i].t >= list[i].life) list.splice(i, 1);
    }
  }

  /* ---------- draw ---------- */

  const glowCache = {};
  function glowSprite(rgb) {
    if (glowCache[rgb]) return glowCache[rgb];
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,255,255,1)");
    gr.addColorStop(0.12, "rgba(" + rgb + ",0.9)");
    gr.addColorStop(0.34, "rgba(" + rgb + ",0.32)");
    gr.addColorStop(0.7, "rgba(" + rgb + ",0.07)");
    gr.addColorStop(1, "rgba(" + rgb + ",0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    glowCache[rgb] = c;
    return c;
  }

  /* Floor layer: decals and ghosts sit under the fighters. */
  function drawGround(ctx, fx) {
    const b = fx.pfx;
    if (!b) return;
    const turn = turned();
    ctx.save();
    for (let i = 0; i < b.decals.length; i++) {
      const d = b.decals[i];
      if (d.t < 0) continue;
      const p = d.t / d.life;
      const a = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
      if (d.kind === "scorch") {
        const g = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r);
        g.addColorStop(0, "rgba(10,6,4," + (0.85 * a) + ")");
        g.addColorStop(0.55, "rgba(26,14,8," + (0.62 * a) + ")");
        g.addColorStop(1, "rgba(30,16,10,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
        /* Embers cool from orange to dark along the crater rim. */
        const heat = Math.max(0, 1 - p * 1.8);
        if (heat > 0) {
          ctx.globalCompositeOperation = "lighter";
          for (let k = 0; k < d.splats.length; k++) {
            const s = d.splats[k];
            const flick = 0.6 + 0.4 * Math.sin((fx.t || 0) * 9 + k * 1.7 + d.seed);
            ctx.fillStyle = "rgba(255," + (110 + k * 8) + ",40," + (0.75 * heat * flick) + ")";
            ctx.fillRect(Math.round(d.x + s.x) - 1, Math.round(d.y + s.y * 0.8) - 1, Math.ceil(s.s * 0.7), Math.ceil(s.s * 0.7));
          }
          ctx.globalCompositeOperation = "source-over";
        }
      } else if (d.kind === "frost") {
        /* A few twinkling ice glints, no patch. */
        for (let k = 0; k < d.splats.length; k++) {
          const s = d.splats[k];
          const tw = 0.5 + 0.5 * Math.sin((fx.t || 0) * 7 + k * 2.1 + d.seed);
          ctx.fillStyle = "rgba(170,225,255," + (0.7 * a * tw) + ")";
          ctx.fillRect(Math.round(d.x + s.x) - 0.5, Math.round(d.y + s.y * 0.7) - 0.5, 1.5, 1.5);
        }
      } else {
        ctx.fillStyle = "rgba(110,10,16," + (0.7 * a) + ")";
        for (let k = 0; k < d.splats.length; k++) {
          const s = d.splats[k];
          ctx.fillRect(Math.round(d.x + s.x), Math.round(d.y + s.y * 0.6), Math.ceil(s.s), Math.ceil(s.s * 0.8));
        }
      }
    }
    ctx.restore();
    if (b.ghosts.length && IL.hero && IL.hero.draw) {
      ctx.save();
      for (let i = 0; i < b.ghosts.length; i++) {
        const g = b.ghosts[i];
        if (!g.sprite) continue;
        ctx.globalAlpha = 0.32 * (1 - g.t / g.life);
        IL.hero.draw(ctx, g.sprite, g.frame, g.x, g.gy, g.scale, g.facing, g.cls, null, g.kind);
      }
      ctx.restore();
    }
    void turn;
  }

  function stroke(ctx, pts, ax, ay, turn) {
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const w = at(ax, ay, pts[i][0], pts[i][1], turn);
      if (i === 0) ctx.moveTo(w[0], w[1]); else ctx.lineTo(w[0], w[1]);
    }
    ctx.stroke();
  }

  function arcPts(cx, cy, r, a0, a1, n) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const a = lerp(a0, a1, i / n);
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    return pts;
  }

  /* Air layer: everything over the fighters. */
  function drawAir(ctx, fx) {
    const b = fx.pfx;
    if (!b) return;
    const turn = turned();
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalCompositeOperation = "lighter";

    for (let i = 0; i < b.glows.length; i++) {
      const g = b.glows[i];
      const p = g.t / g.life;
      const spr = glowSprite(g.rgb);
      if (!spr) continue;
      /* The sprite's bright body is its inner third, so draw it wide. */
      const r = g.r * 1.5 * (0.7 + p * 0.5);
      const w = at(g.ax, g.ay, 0, g.oy, turn);
      ctx.globalAlpha = Math.min(1, g.hot) * (1 - p) * (p < 0.4 ? 1 : (1 - p) / 0.6);
      if (g.hot > 1) { ctx.drawImage(spr, w[0] - r * 0.6, w[1] - r * 0.6, r * 1.2, r * 1.2); }
      ctx.drawImage(spr, w[0] - r, w[1] - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;

    for (let i = 0; i < b.rings.length; i++) {
      const rg = b.rings[i];
      const p = rg.t / rg.life;
      const w = at(rg.ax, rg.ay, 0, rg.oy, turn);
      ctx.strokeStyle = "rgba(" + rg.rgb + "," + (0.9 * (1 - p)) + ")";
      ctx.lineWidth = rg.w * (1 - p * 0.5);
      ctx.beginPath();
      ctx.arc(w[0], w[1], rg.r * (0.55 + p * 0.5), 0, Math.PI * 2);
      ctx.stroke();
    }

    for (let i = 0; i < b.spikes.length; i++) {
      const s = b.spikes[i];
      const p = s.t / s.life;
      const reach = s.r * Math.min(1, 0.3 + p * 1.6);
      const len = s.r * 0.32 * (1 - p * 0.6);
      const ca = Math.cos(s.ang);
      const sa = Math.sin(s.ang);
      const tip = [ca * reach, s.oy + sa * reach];
      const tail = [ca * (reach - len), s.oy + sa * (reach - len)];
      const side = [-sa * 1.6, ca * 1.6];
      ctx.fillStyle = "rgba(" + s.rgb + "," + (1 - p) + ")";
      ctx.beginPath();
      let w = at(s.ax, s.ay, tip[0], tip[1], turn);
      ctx.moveTo(w[0], w[1]);
      w = at(s.ax, s.ay, tail[0] + side[0], tail[1] + side[1], turn);
      ctx.lineTo(w[0], w[1]);
      w = at(s.ax, s.ay, tail[0] - side[0], tail[1] - side[1], turn);
      ctx.lineTo(w[0], w[1]);
      ctx.closePath();
      ctx.fill();
    }

    for (let i = 0; i < b.streaks.length; i++) {
      const s = b.streaks[i];
      if (s.t < 0) continue;
      const p = s.t / s.life;
      const head = Math.min(1, p * 3);
      const tail = Math.max(0, p * 1.6 - 0.4);
      const x1 = lerp(s.x1, s.x2, tail);
      const y1 = lerp(s.y1, s.y2, tail);
      const x2 = lerp(s.x1, s.x2, head);
      const y2 = lerp(s.y1, s.y2, head);
      ctx.strokeStyle = "rgba(" + s.rgb + "," + (1 - p * 0.6) + ")";
      ctx.lineWidth = s.w;
      stroke(ctx, [[x1, y1], [x2, y2]], s.ax, s.ay, turn);
      ctx.strokeStyle = "rgba(255,240,220," + (0.8 * (1 - p)) + ")";
      ctx.lineWidth = s.w * 0.45;
      stroke(ctx, [[x1, y1], [x2, y2]], s.ax, s.ay, turn);
    }

    for (let i = 0; i < b.arcs.length; i++) {
      const a = b.arcs[i];
      const p = a.t / a.life;
      const fade = 1 - p;
      if (a.thrust) {
        const len = a.r * (0.8 + p * 0.9);
        const pts = [[a.face * 6, a.oy], [a.face * (6 + len), a.oy]];
        ctx.strokeStyle = "rgba(" + a.rgb + "," + (0.95 * fade) + ")";
        ctx.lineWidth = 1.4;
        stroke(ctx, pts, a.ax, a.ay, turn);
        continue;
      }
      let a0;
      let a1;
      if (a.spin) {
        a0 = -Math.PI / 2;
        a1 = a0 + a.face * Math.PI * 2 * Math.min(1, p * 1.8);
      } else {
        const sweep = a.heavy ? 2.2 : 1.8;
        const mid = a.face > 0 ? 0 : Math.PI;
        const grow = Math.min(1, p * 3 + 0.2);
        a0 = mid - a.face * sweep * 0.5;
        a1 = a0 + a.face * sweep * grow;
      }
      const cy = a.oy;
      const r = a.r;
      /* Crescent: a thin bright edge over a slightly wider soft body. */
      ctx.strokeStyle = "rgba(" + a.rgb + "," + (0.35 * fade) + ")";
      ctx.lineWidth = a.heavy || a.spin ? 4 : 3;
      stroke(ctx, arcPts(0, cy, r - 1.5, a0, a1, 14), a.ax, a.ay, turn);
      ctx.strokeStyle = "rgba(255,255,255," + (0.95 * fade) + ")";
      ctx.lineWidth = 1.2;
      stroke(ctx, arcPts(0, cy, r, a0, a1, 14), a.ax, a.ay, turn);
    }

    for (let i = 0; i < b.bolts.length; i++) {
      const e = b.bolts[i];
      const p = e.t / e.life;
      const flick = (Math.floor(e.t * 40) % 3 === 1) ? 0.55 : 1;
      const a = (1 - p * p) * flick;
      for (let k = 0; k < e.paths.length; k++) {
        const main = k === 0;
        ctx.strokeStyle = "rgba(" + e.rgb + "," + (0.45 * a) + ")";
        ctx.lineWidth = e.width * (main ? 3.2 : 1.8);
        stroke(ctx, e.paths[k], e.ax, e.ay, turn);
        ctx.strokeStyle = "rgba(255,255,255," + (0.95 * a) + ")";
        ctx.lineWidth = e.width * (main ? 0.9 : 0.6);
        stroke(ctx, e.paths[k], e.ax, e.ay, turn);
      }
    }

    /* Pixels: additive ones first, then solid ones (blood, dust, smoke). */
    for (let pass = 0; pass < 2; pass++) {
      ctx.globalCompositeOperation = pass === 0 ? "lighter" : "source-over";
      for (let i = 0; i < b.parts.length; i++) {
        const p = b.parts[i];
        if (p.t < 0 || p.add !== (pass === 0)) continue;
        const k = p.t / p.life;
        const a = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
        const s = p.size * (p.shape === "plus" ? 1 : (1 - k * 0.35));
        const w = at(p.ax, p.ay, p.ox, p.oy, turn);
        const x = Math.round(w[0] * 2) / 2;
        const y = Math.round(w[1] * 2) / 2;
        ctx.fillStyle = "rgba(" + p.rgb + "," + a + ")";
        if (p.shape === "plus") {
          ctx.fillRect(x - s * 1.5, y - s * 0.5, s * 3, s);
          ctx.fillRect(x - s * 0.5, y - s * 1.5, s, s * 3);
        } else if (p.shape === "shard") {
          ctx.fillRect(x - s * 0.5, y - s, s, s * 2);
        } else {
          ctx.fillRect(x - s * 0.5, y - s * 0.5, s, s);
        }
      }
    }
    ctx.restore();
  }

  /* A cast in progress: one thin circle on the floor in the caster's team
     color, with a bright sweep that fills as the chant runs, plus a glow
     gathering in the caster's hands. */
  function drawTelegraph(ctx, u, fx, teamRgb) {
    const c = u.cast;
    if (!c) return;
    const turn = turned();
    const p = Math.max(0, Math.min(1, c.t / c.dur));
    const r = c.r * 0.85;
    ctx.save();
    ctx.fillStyle = "rgba(" + teamRgb + "," + (0.05 + p * 0.07) + ")";
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(" + teamRgb + "," + (0.5 + p * 0.3) + ")";
    ctx.lineWidth = 1;
    ctx.stroke();
    /* Four small notches on the rim, like a target. */
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(c.x + Math.cos(a) * (r - 4), c.y + Math.sin(a) * (r - 4));
      ctx.lineTo(c.x + Math.cos(a) * (r + 3), c.y + Math.sin(a) * (r + 3));
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = "rgba(255,255,255," + (0.35 + 0.5 * p) + ")";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
    ctx.stroke();
    const hand = at(u.x, u.y, (u.facing || 1) * (turn ? 0 : 7), -20, turn);
    const spr = glowSprite(teamRgb);
    if (spr) {
      const gr = 6 + p * 8 + Math.sin((fx.t || 0) * 18) * 1.2;
      ctx.globalAlpha = 0.5 + p * 0.5;
      ctx.drawImage(spr, hand[0] - gr, hand[1] - gr, gr * 2, gr * 2);
    }
    ctx.restore();
  }

  IL.pfx = {
    PAL: PAL,
    burst: burst,
    glow: glow,
    decal: decal,
    bolt: bolt,
    sky: sky,
    slash: slash,
    ring: ring,
    spikes: spikes,
    streaks: streaks,
    ghost: ghost,
    hit: hit,
    die: die,
    boom: boom,
    chain: chain,
    heal: heal,
    shield: shield,
    summon: summon,
    dust: dust,
    swing: swing,
    sig: sig,
    legacy: legacy,
    step: step,
    drawGround: drawGround,
    drawAir: drawAir,
    drawTelegraph: drawTelegraph,
    get spawned() { return spawned; }
  };
})(typeof window !== "undefined" ? window : globalThis);
