// Glimmerdeep battle VFX: one canvas laid over the board, drawing additive particles.
// The engine and the run layer never touch this; game.js calls VFX.* from its event handler.
// Every point passed in is in BOARD PERCENT ({x: 0..100, y: 0..100}), the same space cpos() returns.
const VFX = (() => {
  'use strict';
  const PAL = {
    ember: ['#ff7a2a', '#ffd36b', '#ff3d1f'], tide: ['#2fa6ff', '#a6e8ff', '#ffffff'], bloom: ['#4fd35a', '#c2ff6b', '#ffe36b'],
    volt: ['#ffd21f', '#fff7b0', '#7fd8ff'], stone: ['#e0a860', '#a8743f', '#f6dcb0'], shade: ['#a08bff', '#6a3cd6', '#f0c6ff'],
    frost: ['#8fe3ff', '#ffffff', '#5fb8ff'], gale: ['#7dffc2', '#eafff6', '#3fd6a8'], metal: ['#dfe8f2', '#ffffff', '#93a8be'],
    mystic: ['#d9a6ff', '#ff9be8', '#fff2a8'], gold: ['#ffd65a', '#fff3b8', '#ff9f2a'], heal: ['#6bff8f', '#d6ffb8', '#ffffff'],
    shield: ['#7fd0ff', '#d8f3ff', '#ffffff'], blood: ['#ff4d6d', '#ffb0c0', '#ff1f4b'],
  };
  const pal = el => PAL[el] || PAL.mystic;
  const P = [];
  const MAX = 900;
  let board = null, cv = null, ctx = null, bw = 1, bh = 1, ox = 0, oy = 0, dpr = 1, raf = 0, last = 0, flash = null;
  let speed = 1, lite = false;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[(Math.random() * a.length) | 0];
  const ease = t => 1 - (1 - t) * (1 - t);

  function init(boardEl) {
    board = boardEl;
    cv = document.createElement('canvas');
    cv.className = 'fxc';
    board.appendChild(cv);
    ctx = cv.getContext('2d');
    lite = (navigator.hardwareConcurrency || 4) <= 4 || matchMedia('(max-width: 560px)').matches;
    if (window.ResizeObserver) new ResizeObserver(resize).observe(board); else addEventListener('resize', resize);
    resize();
  }
  // the canvas overhangs the board (10% each side, 30% above for big sprites, 10% below)
  function resize() {
    if (!board) return;
    bw = board.clientWidth || 1; bh = board.clientHeight || 1;
    ox = bw * 0.1; oy = bh * 0.3;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(bw * 1.2 * dpr); cv.height = Math.round(bh * 1.4 * dpr);
  }
  const X = p => ox + p.x / 100 * bw, Y = p => oy + p.y / 100 * bh;
  const cell = () => bw / 8;
  function add(o) {
    if (P.length >= (lite ? MAX * 0.55 : MAX)) return null;
    o.t = 0; o.life = o.life || 0.5;
    P.push(o);
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
    return o;
  }
  const many = n => Math.max(1, Math.round(n * (lite ? 0.55 : 1)));

  // ---- primitives --------------------------------------------------------------------------
  function dots(x, y, n, el, o) {
    o = o || {};
    const c = pal(el), U = cell();
    for (let i = 0; i < many(n); i++) {
      const a = o.dir != null ? o.dir + rnd(-(o.spread || 0.9), o.spread || 0.9) : rnd(0, Math.PI * 2), v = U * rnd(o.v0 || 1, o.v1 || 4);
      add({ k: o.k || 'dot', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (o.up || 0) * U, g: (o.g || 0) * U, drag: o.drag || 2.2,
        r: U * rnd(o.r0 || 0.03, o.r1 || 0.08), c: pick(c), life: rnd(o.l0 || 0.3, o.l1 || 0.7), rot: rnd(0, 6.3), vr: rnd(-12, 12) });
    }
  }
  function ring(x, y, el, r0, r1, life, w) {
    const U = cell();
    add({ k: 'ring', x, y, r0: r0 * U, r1: r1 * U, w: (w || 0.12) * U, c: pal(el)[0], c2: pal(el)[1], life: life || 0.35 });
  }
  function bolt(x1, y1, x2, y2, el, life, w) {
    add({ k: 'bolt', x: x1, y: y1, x2, y2, c: pal(el)[0], c2: pal(el)[1], w: (w || 0.05) * cell(), life: life || 0.2, seed: 0 });
  }

  // element-flavoured debris for an impact
  function debris(x, y, el, power, dir) {
    const p = power || 1, U = cell();
    switch (el) {
      case 'ember': dots(x, y, 10 * p, el, { up: 2.5, v1: 3.5, r1: 0.1, g: -1.5, l1: 0.8 }); dots(x, y, 6 * p, el, { k: 'spark', v0: 3, v1: 7, l1: 0.35 }); break;
      case 'tide': dots(x, y, 12 * p, el, { up: 3, v1: 4, g: 9, r1: 0.07, drag: 0.6 }); for (let i = 0; i < many(3 * p); i++) add({ k: 'bubble', x: x + rnd(-.3, .3) * U, y: y + rnd(-.2, .2) * U, vx: 0, vy: -U * rnd(.5, 1.2), r: U * rnd(.05, .12), c: '#bff0ff', life: rnd(.5, .9) }); break;
      case 'bloom': for (let i = 0; i < many(8 * p); i++) { const a = rnd(0, 6.3), v = U * rnd(1, 3); add({ k: 'leaf', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - U, g: U * 2, drag: 2, r: U * rnd(.07, .13), c: pick(pal(el)), rot: rnd(0, 6.3), vr: rnd(-10, 10), life: rnd(.5, .9) }); } break;
      case 'volt': dots(x, y, 10 * p, el, { k: 'spark', v0: 4, v1: 9, l1: 0.3 }); for (let i = 0; i < Math.ceil(2 * p); i++) { const a = rnd(0, 6.3); bolt(x, y, x + Math.cos(a) * U * .8, y + Math.sin(a) * U * .8, el, .15, .03); } break;
      case 'stone': for (let i = 0; i < many(7 * p); i++) { const a = rnd(Math.PI, Math.PI * 2), v = U * rnd(2, 4.5); add({ k: 'shard', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: U * 14, drag: .5, r: U * rnd(.06, .13), c: pick(pal(el)), rot: rnd(0, 6.3), vr: rnd(-14, 14), life: rnd(.4, .7), solid: 1 }); } dots(x, y, 6 * p, el, { r0: .1, r1: .2, v1: 1.5, l1: .6 }); break;
      case 'shade': dots(x, y, 10 * p, el, { r0: .08, r1: .18, v1: 2, drag: 3, up: .6, l1: .8 }); add({ k: 'swirl', x, y, r: U * .5, c: pal(el)[0], life: .45, dir: 1 }); break;
      case 'frost': for (let i = 0; i < many(8 * p); i++) { const a = rnd(0, 6.3), v = U * rnd(2, 5); add({ k: 'shard', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: U * 5, drag: 1.5, r: U * rnd(.06, .12), c: pick(pal(el)), rot: a, vr: 0, life: rnd(.35, .6), thin: 1 }); } dots(x, y, 6 * p, el, { k: 'star', r0: .04, r1: .07, v1: 1.5, l1: .8 }); break;
      case 'gale': add({ k: 'swirl', x, y, r: U * .55, c: pal(el)[0], life: .4, dir: dir && dir < 0 ? -1 : 1 }); add({ k: 'swirl', x, y, r: U * .35, c: pal(el)[1], life: .35, dir: dir && dir < 0 ? 1 : -1 }); dots(x, y, 6 * p, el, { k: 'spark', v0: 2, v1: 5 }); break;
      case 'metal': dots(x, y, 12 * p, el, { k: 'spark', v0: 4, v1: 10, g: 10, drag: 1, l1: .4 }); break;
      case 'mystic': dots(x, y, 9 * p, el, { k: 'star', r0: .05, r1: .11, v1: 3, l1: .8 }); break;
      default: dots(x, y, 10 * p, el, {});
    }
  }

  // ---- public effects ----------------------------------------------------------------------
  // a bright flash + ring + debris where a hit lands
  function impact(p, el, power, crit, dir) {
    const x = X(p), y = Y(p), U = cell(), pw = power || 1;
    add({ k: 'glow', x, y, r: U * (crit ? .7 : .42) * Math.sqrt(pw), c: pal(el)[0], life: crit ? .2 : .13 });
    ring(x, y, el, .15, crit ? 1.1 : .7, crit ? .35 : .25, crit ? .14 : .09);
    debris(x, y, el, pw * (crit ? 1.6 : 1), dir);
    if (crit) { add({ k: 'star4', x, y, r: U * .8, c: '#fff', life: .25 }); dots(x, y, 8, 'gold', { k: 'spark', v0: 5, v1: 10, l1: .3 }); }
  }
  // a melee swipe: crescent slashes across the target, angled away from the attacker
  function slash(a, t, el, o) {
    o = o || {};
    const x = X(t), y = Y(t), dir = Math.atan2(Y(t) - Y(a), X(t) - X(a)), U = cell();
    const n = o.n || 1, big = o.big || 1;
    for (let i = 0; i < n; i++) {
      const tilt = n > 1 ? (i - (n - 1) / 2) * 0.5 : rnd(-.35, .35);
      add({ k: 'slash', x: x + Math.cos(dir + 1.57) * U * .12 * (i - (n - 1) / 2), y: y + Math.sin(dir + 1.57) * U * .12 * (i - (n - 1) / 2), ang: dir + tilt, R: U * .55 * big,
        sweep: (o.wide ? 2.6 : 1.7), c: pal(el)[0], c2: pal(el)[1], life: .22, delay: i * 0.06 / Math.max(1, speed * .6) });
    }
    impact(t, el, o.power || 1, o.crit, Math.cos(dir));
  }
  // a projectile that flies from a to t and calls back on arrival
  function shoot(a, t, el, ms, onHit, o) {
    o = o || {};
    const x1 = X(a), y1 = Y(a) - cell() * .1, x2 = X(t), y2 = Y(t), U = cell();
    if (el === 'volt' && !o.comet) { bolt(x1, y1, x2, y2, el, .22, o.big ? .09 : .05); bolt(x1, y1, x2, y2, el, .16, .025); impact(t, el, o.power || 1, o.crit); onHit && onHit(); return; }
    const lob = el === 'stone' || el === 'tide' ? Math.min(1.2, Math.hypot(x2 - x1, y2 - y1) / U * .25) : 0;
    add({ k: 'comet', x: x1, y: y1, x0: x1, y0: y1, x2, y2, lob: lob * U, el, c: pal(el)[0], c2: pal(el)[1], r: U * (o.big ? .2 : .12),
      life: Math.max(.08, ms / 1000) * Math.max(1, speed), cb: () => { impact(t, el, o.power || 1, o.crit); onHit && onHit(); } });
  }
  // a charge-up glyph under the caster; the ult version also floods the board
  function cast(p, el, ult) {
    const x = X(p), y = Y(p) + cell() * .32, U = cell();
    add({ k: 'rune', x, y, r: U * (ult ? .95 : .62), c: pal(el)[0], c2: pal(el)[1], life: ult ? .9 : .6, sides: ult ? 6 : 5 });
    for (let i = 0; i < many(ult ? 22 : 12); i++) {
      const a = rnd(0, 6.3), d = U * rnd(.6, 1.2);
      add({ k: 'gather', x: x + Math.cos(a) * d, y: y - U * .3 + Math.sin(a) * d * .6, tx: x, ty: y - U * .35, r: U * rnd(.03, .07), c: pick(pal(el)), life: rnd(.3, .5), delay: rnd(0, .15) });
    }
    dots(x, y - U * .2, ult ? 14 : 7, el, { up: 2, v0: .2, v1: 1, g: -1, l0: .5, l1: 1 });
    if (ult) { flash = { c: pal(el)[0], t: 0, life: .5 }; ring(x, y - U * .3, el, .2, 3.5, .6, .2); }
  }
  // a ground shockwave for area spells
  function shockwave(p, el, size) {
    const x = X(p), y = Y(p) + cell() * .2, s = size || 1;
    add({ k: 'ellipse', x, y, r0: cell() * .2, r1: cell() * 1.9 * s, c: pal(el)[0], c2: pal(el)[1], life: .45 });
    add({ k: 'ellipse', x, y, r0: cell() * .1, r1: cell() * 1.3 * s, c: pal(el)[1], c2: '#fff', life: .35 });
    debris(x, y - cell() * .2, el, 1.6 * s);
  }
  // a beam between two points (ults, pierce, ally links)
  function beam(a, t, el, w, life) {
    add({ k: 'beam', x: X(a), y: Y(a) - cell() * .1, x2: X(t), y2: Y(t), w: (w || .18) * cell(), c: pal(el)[0], c2: pal(el)[1], life: life || .3 });
  }
  function heal(p) {
    const x = X(p), y = Y(p), U = cell();
    for (let i = 0; i < many(6); i++) add({ k: 'plus', x: x + rnd(-.35, .35) * U, y: y + rnd(-.1, .3) * U, vx: 0, vy: -U * rnd(.8, 1.6), r: U * rnd(.06, .1), c: pick(PAL.heal), life: rnd(.5, .8), delay: rnd(0, .2) });
    add({ k: 'glow', x, y, r: U * .4, c: '#6bff8f', life: .25 });
  }
  function shield(p, gold) {
    add({ k: 'bubble2', x: X(p), y: Y(p) - cell() * .05, r: cell() * .62, c: gold ? '#ffd65a' : '#7fd0ff', life: .55 });
  }
  function ko(p, el) {
    const x = X(p), y = Y(p), U = cell();
    add({ k: 'glow', x, y, r: U * .9, c: '#fff', life: .25 });
    dots(x, y, 16, el, { r0: .05, r1: .12, v1: 3, l1: .9, up: 1 });
    for (let i = 0; i < many(4); i++) add({ k: 'wisp', x: x + rnd(-.2, .2) * U, y, vx: rnd(-.3, .3) * U, vy: -U * rnd(1.2, 2), r: U * rnd(.08, .14), c: pal(el)[1], life: rnd(.7, 1.1), delay: i * .08 });
  }
  function aura(p, el) {
    const x = X(p), y = Y(p) + cell() * .3;
    add({ k: 'ellipse', x, y, r0: cell() * .3, r1: cell() * .9, c: pal(el)[0], c2: pal(el)[1], life: .5 });
    dots(x, y - cell() * .3, 10, el, { up: 2.5, v0: .2, v1: 1, g: -1, l0: .5, l1: .9 });
  }
  function speedLines(p, el) {
    const x = X(p), y = Y(p), U = cell();
    for (let i = 0; i < many(8); i++) add({ k: 'spark', x: x + rnd(-.4, .4) * U, y: y + rnd(0, .4) * U, vx: 0, vy: -U * rnd(3, 5), drag: 3, r: U * .04, c: pick(pal(el)), life: rnd(.25, .4) });
  }
  function clear() { P.length = 0; flash = null; if (ctx) ctx.clearRect(0, 0, cv.width, cv.height); }

  // ---- simulation + drawing ----------------------------------------------------------------
  function frame(ts) {
    const rdt = Math.min(0.05, (ts - last) / 1000); last = ts;
    const dt = rdt * Math.min(2.2, Math.max(1, speed * .7));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (flash) {
      flash.t += dt; const k = 1 - flash.t / flash.life;
      if (k <= 0) flash = null; else { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .28 * k * k; ctx.fillStyle = flash.c; ctx.fillRect(ox, oy, bw, bh); }
    }
    ctx.globalCompositeOperation = 'lighter';
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      if (p.delay > 0) { p.delay -= dt; continue; }
      p.t += dt;
      if (p.t >= p.life) { if (p.cb) p.cb(); P.splice(i, 1); continue; }
      if (p.vx != null) {
        const d = Math.exp(-(p.drag || 0) * dt);
        p.vx *= d; p.vy = p.vy * d + (p.g || 0) * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.vr) p.rot += p.vr * dt;
      }
      draw(p, p.t / p.life);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    if (P.length || flash) raf = requestAnimationFrame(frame); else { raf = 0; ctx.clearRect(0, 0, cv.width, cv.height); }
  }
  function jag(x1, y1, x2, y2, n, amp) {
    const pts = [[x1, y1]], dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
    for (let i = 1; i < n; i++) { const f = i / n, o = rnd(-amp, amp) * Math.sin(f * Math.PI); pts.push([x1 + dx * f + nx * o, y1 + dy * f + ny * o]); }
    pts.push([x2, y2]); return pts;
  }
  function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0.1, r), 0, 6.2832); ctx.fill(); }
  function draw(p, f) {
    const a = 1 - f;
    switch (p.k) {
      case 'dot': ctx.globalAlpha = a * .35; ctx.fillStyle = p.c; circle(p.x, p.y, p.r * 2.4); ctx.globalAlpha = a; circle(p.x, p.y, p.r * (1 - f * .5)); break;
      case 'spark': {
        const l = Math.max(2, Math.hypot(p.vx, p.vy) * .05); const n = Math.hypot(p.vx, p.vy) || 1;
        ctx.globalAlpha = a; ctx.strokeStyle = p.c; ctx.lineWidth = Math.max(1, p.r * .9); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx / n * l, p.y - p.vy / n * l); ctx.stroke(); break;
      }
      case 'star': case 'star4': {
        const r = p.k === 'star4' ? p.r * (0.4 + ease(f)) : p.r * (1 - f * .3);
        ctx.globalAlpha = p.k === 'star4' ? a * .9 : a; ctx.fillStyle = p.c;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot || 0.785 * f);
        ctx.beginPath(); for (let i = 0; i < 8; i++) { const rr = i % 2 ? r * .18 : r, an = i * Math.PI / 4; ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } ctx.fill(); ctx.restore(); break;
      }
      case 'glow': {
        const r = p.r * (0.6 + ease(f) * .6);
        ctx.globalAlpha = a * .3; ctx.fillStyle = p.c; circle(p.x, p.y, r); ctx.globalAlpha = a * .45; ctx.fillStyle = '#fff'; circle(p.x, p.y, r * .3); break;
      }
      case 'ring': { const r = p.r0 + (p.r1 - p.r0) * ease(f); ctx.globalAlpha = a; ctx.strokeStyle = p.c; ctx.lineWidth = Math.max(.5, p.w * a); ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.2832); ctx.stroke(); break; }
      case 'ellipse': {
        const r = p.r0 + (p.r1 - p.r0) * ease(f);
        ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1, .42);
        ctx.globalAlpha = a; ctx.strokeStyle = p.c; ctx.lineWidth = Math.max(1, cell() * .22 * a); ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.2832); ctx.stroke();
        ctx.globalAlpha = a * .25; ctx.fillStyle = p.c2; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.2832); ctx.fill(); ctx.restore(); break;
      }
      case 'slash': {
        // a crescent that sweeps open, then thins out
        const sw = p.sweep, prog = Math.min(1, f * 2.2), fade = f < .45 ? 1 : 1 - (f - .45) / .55;
        const a0 = p.ang - sw / 2, a1 = a0 + sw * ease(prog), R = p.R, th = R * .28 * fade;
        ctx.save(); ctx.translate(p.x - Math.cos(p.ang) * R * .55, p.y - Math.sin(p.ang) * R * .55);
        ctx.globalAlpha = fade; ctx.fillStyle = p.c;
        ctx.beginPath(); ctx.arc(0, 0, R, a0, a1); ctx.arc(Math.cos(p.ang) * th, Math.sin(p.ang) * th, R - th * .2, a1, a0, true); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.globalAlpha = fade * .9;
        ctx.beginPath(); ctx.arc(0, 0, R, a0 + sw * .1, a1); ctx.arc(Math.cos(p.ang) * th * .35, Math.sin(p.ang) * th * .35, R - th * .05, a1, a0 + sw * .1, true); ctx.fill();
        ctx.restore(); break;
      }
      case 'comet': {
        const e = f * f * (3 - 2 * f), nx = p.x0 + (p.x2 - p.x0) * e, ny = p.y0 + (p.y2 - p.y0) * e - Math.sin(e * Math.PI) * p.lob;
        const vx = nx - p.x, vy = ny - p.y; p.x = nx; p.y = ny;
        // trail: shed particles every frame
        if (P.length < MAX) {
          const U = cell();
          if (p.el === 'bloom') add({ k: 'leaf', x: nx, y: ny, vx: rnd(-.3, .3) * U, vy: rnd(-.3, .3) * U, g: U, drag: 2, r: p.r * .7, c: pick(pal(p.el)), rot: rnd(0, 6.3), vr: rnd(-10, 10), life: .35 });
          else if (p.el === 'frost' || p.el === 'mystic') add({ k: 'star', x: nx + rnd(-.05, .05) * U, y: ny + rnd(-.05, .05) * U, vx: 0, vy: 0, r: p.r * rnd(.4, .7), c: pick(pal(p.el)), life: .3, rot: rnd(0, 6.3) });
          else add({ k: 'dot', x: nx + rnd(-.04, .04) * U, y: ny + rnd(-.04, .04) * U, vx: -vx * 3, vy: -vy * 3 - (p.el === 'ember' ? U * .8 : 0), drag: 4, r: p.r * rnd(.4, .8), c: pick(pal(p.el)), life: rnd(.18, .32) });
        }
        const ang = Math.atan2(vy, vx);
        ctx.save(); ctx.translate(nx, ny); ctx.rotate(ang);
        ctx.globalAlpha = .45; ctx.fillStyle = p.c; ctx.beginPath(); ctx.ellipse(-p.r * .9, 0, p.r * 2.6, p.r * 1.1, 0, 0, 6.2832); ctx.fill();
        ctx.globalAlpha = 1; ctx.fillStyle = p.c2;
        if (p.el === 'stone') { ctx.rotate(f * 12); ctx.fillStyle = p.c; ctx.globalCompositeOperation = 'source-over'; ctx.beginPath(); for (let i = 0; i < 6; i++) { const an = i * 1.047, rr = p.r * (i % 2 ? .8 : 1.15); ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } ctx.fill(); ctx.globalCompositeOperation = 'lighter'; }
        else if (p.el === 'frost' || p.el === 'metal') { ctx.beginPath(); ctx.moveTo(p.r * 1.8, 0); ctx.lineTo(-p.r, p.r * .55); ctx.lineTo(-p.r * .5, 0); ctx.lineTo(-p.r, -p.r * .55); ctx.fill(); }
        else if (p.el === 'gale') { ctx.rotate(f * 20); ctx.strokeStyle = p.c2; ctx.lineWidth = p.r * .5; ctx.beginPath(); ctx.arc(0, 0, p.r * 1.2, 0, 4.2); ctx.stroke(); }
        else { circle(p.r * .3, 0, p.r); ctx.fillStyle = '#fff'; circle(p.r * .4, 0, p.r * .5); }
        ctx.restore(); break;
      }
      case 'bolt': {
        if (!p.pts || Math.random() < .5) p.pts = jag(p.x, p.y, p.x2, p.y2, Math.max(4, Math.round(Math.hypot(p.x2 - p.x, p.y2 - p.y) / cell() * 4)), cell() * .22);
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        for (const [w, c, al] of [[p.w * 3, p.c, .35], [p.w, p.c2, 1], [p.w * .4, '#fff', 1]]) {
          ctx.globalAlpha = al * (a > .5 ? 1 : a * 2) * (Math.random() < .2 ? .4 : 1); ctx.strokeStyle = c; ctx.lineWidth = w;
          ctx.beginPath(); p.pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
        }
        break;
      }
      case 'beam': {
        const w = p.w * (f < .2 ? f / .2 : a);
        ctx.lineCap = 'round';
        for (const [k, c, al] of [[2.4, p.c, .35], [1, p.c2, .9], [.35, '#fff', 1]]) { ctx.globalAlpha = al; ctx.strokeStyle = c; ctx.lineWidth = Math.max(.5, w * k); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x2, p.y2); ctx.stroke(); }
        break;
      }
      case 'rune': {
        const r = p.r * (f < .25 ? ease(f / .25) : 1), rot = f * 2.2, fade = f < .7 ? 1 : 1 - (f - .7) / .3;
        ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1, .42);
        ctx.globalAlpha = fade * .25; ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.2832); ctx.fill();
        ctx.globalAlpha = fade; ctx.strokeStyle = p.c2; ctx.lineWidth = Math.max(1, r * .06);
        ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.2832); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, r * .78, 0, 6.2832); ctx.stroke();
        ctx.rotate(rot); ctx.strokeStyle = p.c;
        ctx.beginPath(); for (let i = 0, step = p.sides === 5 ? 2 : 1; i <= p.sides; i++) { const an = i * Math.PI * 2 * step / p.sides; ctx.lineTo(Math.cos(an) * r * .78, Math.sin(an) * r * .78); } ctx.stroke();
        if (p.sides === 6) { ctx.beginPath(); for (let i = 0; i <= 3; i++) { const an = i * 2.0944; ctx.lineTo(Math.cos(an) * r * .78, Math.sin(an) * r * .78); } ctx.stroke(); ctx.beginPath(); for (let i = 0; i <= 3; i++) { const an = i * 2.0944 + 1.0472; ctx.lineTo(Math.cos(an) * r * .78, Math.sin(an) * r * .78); } ctx.stroke(); }
        for (let i = 0; i < 12; i++) { const an = i * .5236; ctx.fillStyle = i % 3 ? p.c : '#fff'; ctx.fillRect(Math.cos(an) * r * .89 - 2, Math.sin(an) * r * .89 - 2, 4, 4); }
        ctx.restore();
        // pillar of light rising from the circle
        ctx.globalAlpha = fade * .22; ctx.fillStyle = p.c; ctx.fillRect(p.x - r * .55, p.y - r * 1.6 * (f < .3 ? f / .3 : 1), r * 1.1, r * 1.6 * (f < .3 ? f / .3 : 1));
        break;
      }
      case 'gather': {
        const e = ease(f); const x = p.x + (p.tx - p.x) * e, y = p.y + (p.ty - p.y) * e;
        ctx.globalAlpha = f < .8 ? 1 : (1 - f) * 5; ctx.fillStyle = p.c; circle(x, y, p.r); ctx.globalAlpha *= .35; circle(x, y, p.r * 2.5); break;
      }
      case 'leaf': {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = a; ctx.fillStyle = p.c;
        ctx.globalCompositeOperation = 'source-over'; ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * .45, 0, 0, 6.2832); ctx.fill();
        ctx.restore(); ctx.globalCompositeOperation = 'lighter'; break;
      }
      case 'shard': {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = a; ctx.fillStyle = p.c;
        if (p.solid) ctx.globalCompositeOperation = 'source-over';
        ctx.beginPath();
        if (p.thin) { ctx.moveTo(p.r * 1.6, 0); ctx.lineTo(0, p.r * .35); ctx.lineTo(-p.r * .8, 0); ctx.lineTo(0, -p.r * .35); }
        else { ctx.moveTo(p.r, 0); ctx.lineTo(-p.r * .3, p.r * .9); ctx.lineTo(-p.r * .9, -p.r * .2); ctx.lineTo(p.r * .1, -p.r * .8); }
        ctx.fill(); ctx.restore(); ctx.globalCompositeOperation = 'lighter'; break;
      }
      case 'bubble': ctx.globalAlpha = a; ctx.strokeStyle = p.c; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x + Math.sin(p.t * 14) * 2, p.y, p.r, 0, 6.2832); ctx.stroke(); break;
      case 'bubble2': {
        const r = p.r * (f < .2 ? .6 + 2 * f : 1), al = f < .2 ? 1 : a / .8;
        ctx.globalAlpha = al * .18; ctx.fillStyle = p.c; circle(p.x, p.y, r);
        ctx.globalAlpha = al; ctx.strokeStyle = p.c; ctx.lineWidth = Math.max(1, cell() * .05); ctx.beginPath();
        for (let i = 0; i <= 6; i++) { const an = i * 1.0472 + .5236; ctx.lineTo(p.x + Math.cos(an) * r, p.y + Math.sin(an) * r); } ctx.stroke();
        ctx.globalAlpha = al * .8; ctx.fillStyle = '#fff'; circle(p.x - r * .35, p.y - r * .4, r * .1); break;
      }
      case 'swirl': {
        ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1, .6); ctx.rotate(f * 7 * p.dir);
        ctx.globalAlpha = a; ctx.strokeStyle = p.c; ctx.lineCap = 'round';
        for (let i = 0; i < 3; i++) { ctx.lineWidth = Math.max(1, cell() * .06 * a); ctx.beginPath(); ctx.arc(0, 0, p.r * (0.5 + f * .7) * (1 - i * .22), i * 2.1, i * 2.1 + 1.6); ctx.stroke(); }
        ctx.restore(); break;
      }
      case 'plus': {
        const r = p.r; ctx.globalAlpha = a; ctx.fillStyle = p.c;
        ctx.fillRect(p.x - r, p.y - r * .3, r * 2, r * .6); ctx.fillRect(p.x - r * .3, p.y - r, r * .6, r * 2); break;
      }
      case 'wisp': ctx.globalAlpha = a * .6; ctx.fillStyle = p.c; circle(p.x + Math.sin(p.t * 9) * p.r, p.y, p.r * (1 + f)); ctx.globalAlpha = a; ctx.fillStyle = '#fff'; circle(p.x + Math.sin(p.t * 9) * p.r, p.y, p.r * .35); break;
    }
  }
  return { init, impact, slash, shoot, cast, shockwave, beam, heal, shield, ko, aura, speedLines, clear, resize, set speed(v) { speed = v || 1; }, get busy() { return P.length; } };
})();
