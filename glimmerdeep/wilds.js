// Glimmerdeep: The Wilds. Explore floors of connected rooms (Binding of Isaac style), walk into wild
// creatures to battle them on the auto-chess board, and unlock every species you beat for good.
// DOM + canvas. Fights reuse game.js through window.GLIM.wildBattle.
(function () {
'use strict';
const G = window.GD, C = window.GC, R = window.GR, U = window.GLIM;
const $ = s => document.querySelector(s);
const IMG = k => 'img/' + k + '.webp';
const SAVE = 'glimmerdeep.wilds.v1';
const { FLOORS, SQUAD_START, SQUAD_MAX, XP_STAR, rng, pick, key, placeSide } = window.GW;
const genFloor = (f, b, seed) => window.GW.genFloor(f, b, seed, unlocked);
const RW = 16, RH = 9;                     // room size in world units (the room art is 16:9)
const IN = { x0: 1.35, x1: 14.65, y0: 1.3, y1: 7.7 };   // walkable floor inside the walls
const DOOR = { n: [8, 0.72, 0], s: [8, 8.28, Math.PI], w: [0.72, 4.5, -Math.PI / 2], e: [15.28, 4.5, Math.PI / 2] };
const DIRS = window.GW.DIRS, OPP = { n: 's', s: 'n', e: 'w', w: 'e' };
const EARLY = ['verdant', 'grotto', 'magma', 'crypt'];
const ELC = { ember: '#ff7a2a', tide: '#2fa6ff', bloom: '#4fd35a', volt: '#ffd21f', stone: '#e0a860', shade: '#9d8bff', frost: '#8fe3ff', gale: '#7dffc2', metal: '#d8e2ee', mystic: '#d9a6ff' };

let W = null;        // the expedition (saved)
let V = null;        // the live view: canvas, input, positions (not saved)
const imgs = {};
function img(k) { if (!imgs[k]) { const i = new Image(); i.src = IMG(k); imgs[k] = i; } return imgs[k]; }
const ready = i => i.complete && i.naturalWidth > 0;

// ---- save ---------------------------------------------------------------------------------------
function save() { try { localStorage.setItem(SAVE, JSON.stringify(W)); } catch (e) { /* storage blocked */ } }
function load() { try { return JSON.parse(localStorage.getItem(SAVE) || 'null'); } catch (e) { return null; } }
function clearSave() { try { localStorage.removeItem(SAVE); } catch (e) { /* storage blocked */ } }
const meta = () => U.meta;
const unlocked = sp => !!meta().unlocked[sp];

// ---- doors and the map (layouts come from wgen.js) --------------------------------------------
function doorOf(room, d) {
  const o = W.rooms[key(room.x + DIRS[d][0], room.y + DIRS[d][1])];
  if (!o) return null;
  if (o.type === 'secret' || room.type === 'secret') return (o.type === 'secret' ? o : room).found ? 'open' : 'crack';
  if (o.type === 'locked' || room.type === 'locked') return (o.type === 'locked' ? o : room).unlocked ? 'open' : 'lock';
  return 'open';
}
function markSeen() {
  const a = W.rooms[W.cur];
  a.visited = true; a.seen = true;
  for (const d in DIRS) { const o = W.rooms[key(a.x + DIRS[d][0], a.y + DIRS[d][1])]; if (o && (o.type !== 'secret' || o.found)) o.seen = true; }
  if (a.mon) meta().dex[a.mon.sp] = Math.max(meta().dex[a.mon.sp] || 0, 1);
}

// ---- expedition lifecycle -------------------------------------------------------------------
function squadInst(m) {
  const inst = { uid: m.uid, sp: m.sp, star: m.star, muts: [], charm: null, el2: null, skill: null, shiny: !!m.shiny, hpFrac: m.hp };
  inst.skill = C.defaultSkill(inst);
  return inst;
}
function newFloor(floor) {
  const pickFrom = floor === FLOORS ? ['core'] : (floor === 1 ? EARLY : Object.keys(G.BIOMES).filter(k => k !== 'core')).filter(k => !W.biomes.includes(k));
  const biome = pick(Math.random, pickFrom.length ? pickFrom : ['verdant']);
  W.biomes.push(biome);
  Object.assign(W, { floor, biome }, genFloor(floor, biome, (W.seed + floor * 7919) >>> 0));
  markSeen();
}
function startExpedition(sps) {
  W = { v: 1, seed: (Date.now() ^ (Math.random() * 1e9)) >>> 0, floor: 1, biomes: [], keys: 0, shards: 0, nextUid: 1, wins: 0, found: [],
    squad: sps.map(sp => ({ uid: 0, sp, star: 1, xp: 0, hp: 1, shiny: false })) };
  for (const m of W.squad) m.uid = W.nextUid++;
  newFloor(1);
  save();
}
async function endExpedition(why) {
  const m = meta();
  const bonus = why === 'done' ? 50 : 0;
  m.shards += bonus;
  const found = W.found.map(sp => `<div class="wfound"><img src="${IMG('cr_' + sp + '1')}" alt=""><div>${G.SP[sp].names[0]}</div></div>`).join('');
  const title = why === 'done' ? 'Expedition complete!' : why === 'left' ? 'Back to camp' : 'Your squad fainted';
  clearSave(); W = null; stopView(); U.save();
  await U.ask(title, `<p style="text-align:center">${found ? 'Unlocked this expedition:' : 'No new creatures this time.'}</p><div class="wfounds">${found}</div>
    ${bonus ? `<p style="text-align:center;color:var(--gold)">+${bonus} Glimmer Shards for clearing all ${FLOORS} floors!</p>` : ''}
    <p class="muted small" style="text-align:center">Unlocked creatures now appear in the Auto Chess shop and as starters.</p>`, U.btn('ok', 'Continue', 'green'));
  U.renderTitle();
}

// ---- screens --------------------------------------------------------------------------------
async function open() {
  const saved = load();
  if (saved && saved.v === 1) {
    const v = await U.ask('The Wilds', `<p style="text-align:center">You have an expedition in progress on floor ${saved.floor}/${FLOORS}.</p>`, U.btn('go', 'Continue', 'green') + U.btn('new', 'Start over', 'ghost sm') + U.btn('x', 'Back', 'ghost sm'));
    if (v === 'x') return;
    if (v === 'go') { W = saved; return enter(); }
    clearSave();
  }
  prep();
}
function prep() {
  const m = meta();
  const list = Object.keys(G.SP).filter(unlocked).sort((a, b) => G.TIER[a] - G.TIER[b] || G.SP[a].el.localeCompare(G.SP[b].el));
  const sel = [];
  const n = Object.keys(m.unlocked).length, tot = Object.keys(G.SP).length;
  const host = $('#wilds');
  host.querySelector('.wprep').innerHTML = `<div class="gtop"><button class="iconbtn" data-w="home">◀</button><div class="grow"><div class="title">The Wilds</div><div class="small muted">${n}/${tot} creatures unlocked</div></div></div>
    <div class="wprepbody"><p class="muted" style="text-align:center;margin:4px 8px 10px">Explore ${FLOORS} floors of rooms. Walk into a wild creature to battle it. Beat it to <b>unlock it for good</b>: it joins the Auto Chess shop and can join your squad. Pick up to ${SQUAD_START} creatures to bring.</p>
    <div class="wpick">${list.map(sp => { const S = G.SP[sp]; return `<div class="wcard el-${S.el}" data-sp="${sp}"><img src="${IMG('cr_' + sp + '1')}" alt=""><div class="n">${S.names[0]}</div><div class="small muted">${U.ROLE_N[S.role]} · T${G.TIER[sp]}</div></div>`; }).join('')}</div></div>
    <div class="wprepbar"><span class="small muted" id="wSel">Choose 1-${SQUAD_START}</span>${U.btn('go', 'Set out!', 'green')}</div>`;
  host.classList.remove('exploring');
  U.show('wilds');
  host.querySelector('.wpick').onclick = e => {
    const c = e.target.closest('[data-sp]'); if (!c) return;
    const sp = c.dataset.sp, i = sel.indexOf(sp);
    if (i >= 0) sel.splice(i, 1); else if (sel.length < SQUAD_START) sel.push(sp); else return U.toast(`Up to ${SQUAD_START} creatures.`);
    U.SFX.click();
    c.classList.toggle('on', i < 0);
    $('#wSel').textContent = sel.length ? sel.map(k => G.SP[k].names[0]).join(', ') : `Choose 1-${SQUAD_START}`;
  };
  host.querySelector('.wprepbar').onclick = e => {
    if (!e.target.closest('[data-v=go]')) return;
    if (!sel.length) return U.toast('Pick at least one creature.');
    U.SFX.lvl();
    startExpedition(sel.slice());
    enter();
  };
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-w]'); if (!b) return;
  U.SFX.click();
  if (b.dataset.w === 'home') { stopView(); U.renderTitle(); }
  else if (b.dataset.w === 'leave') leave();
});
async function leave() {
  V.pause = true;
  const v = await U.ask('Leave the Wilds?', '<p style="text-align:center">Head back to camp. Creatures you unlocked stay unlocked, and so do your shards.</p>', U.btn('y', 'Leave', 'ghost') + U.btn('n', 'Keep exploring', 'green'));
  if (v === 'y') return endExpedition('left');
  V.pause = false; V.last = performance.now();
}

// ---- the live room view ---------------------------------------------------------------------
function enter() {
  const host = $('#wilds');
  host.classList.add('exploring');
  U.show('wilds');
  if (!V) {
    const cv = host.querySelector('#wCv');
    V = { cv, ctx: cv.getContext('2d'), keys: {}, joy: null, px: 8, py: 4.5, fx: 1, walk: 0, mons: [], raf: 0, last: performance.now(),
      inv: 0, push: { d: null, t: 0 }, slide: null, pause: false, msgT: 0, parts: [] };
    bindInput();
  }
  V.pause = false;
  host.querySelector('.whint').textContent = matchMedia('(pointer: coarse)').matches ? 'Drag anywhere to move' : 'WASD / arrow keys, or drag anywhere to move';
  placeRoom(null);
  hud();
  if (!V.raf) { V.last = performance.now(); V.raf = requestAnimationFrame(frame); }
}
function stopView() { if (V && V.raf) cancelAnimationFrame(V.raf); if (V) V.raf = 0; }
function room() { return W.rooms[W.cur]; }
// spawn the player at the door they came through, and the room's creature somewhere away from it
function placeRoom(from) {
  const a = room();
  if (from) { const p = DOOR[from]; V.px = p[0] + (from === 'w' ? 1.3 : from === 'e' ? -1.3 : 0); V.py = p[1] + (from === 'n' ? 1.3 : from === 's' ? -1.3 : 0); }
  else { V.px = 8; V.py = 5.6; }
  V.mons = [];
  if (a.mon && !a.mon.beaten) {
    const lair = a.type === 'lair';
    let mx = lair ? 8 : 4 + Math.random() * 8, my = lair ? 4 : 2.6 + Math.random() * 3.8;
    if (!lair && Math.hypot(mx - V.px, my - V.py) < 4.5) { mx = 16 - V.px; my = 9 - V.py; mx = Math.min(IN.x1 - 1, Math.max(IN.x0 + 1, mx)); my = Math.min(IN.y1 - .5, Math.max(IN.y0 + .5, my)); }
    V.mons.push({ x: mx, y: my, tx: mx, ty: my, t: 0, sz: lair ? 1.8 : 1.3, lair, bob: Math.random() * 6 });
  }
  V.inv = 1.0;
  markSeen();
  save();
}
function hud() {
  const a = room(), host = $('#wilds');
  host.querySelector('.wtop').innerHTML = `<button class="iconbtn" data-w="leave">◀</button><div class="grow"><div class="title">Floor ${W.floor}/${FLOORS} · ${G.BIOMES[W.biome].name}</div>
    <div class="small muted">${a.type === 'start' ? 'Entrance' : a.type === 'lair' ? 'Lair' : a.type === 'locked' ? 'Vault' : a.type === 'secret' ? 'Secret room' : a.type === 'treasure' ? 'Treasure room' : a.type === 'shrine' ? 'Shrine' : 'Wild room'}${a.mon && !a.mon.beaten ? ' · ' + G.SP[a.mon.sp].names[a.mon.star - 1] + (unlocked(a.mon.sp) ? '' : ' <span style="color:var(--gold)">NEW!</span>') : ''}</div></div>
    <span class="pill">🔑 ${W.keys}</span><span class="pill"><img src="${IMG('ui_shard')}" alt="">${meta().shards}</span>`;
  host.querySelector('.wsquad').innerHTML = W.squad.map(m => {
    const S = G.SP[m.sp], next = XP_STAR[m.star];
    return `<div class="wmem ${m.hp <= 0 ? 'out' : ''}"><img src="${IMG('cr_' + m.sp + m.star)}" alt=""><div class="st">${'★'.repeat(m.star)}</div>
      <div class="bar"><i class="${m.hp < 0.3 ? 'low' : m.hp < 0.6 ? 'mid' : ''}" style="width:${Math.max(0, m.hp) * 100}%"></i></div>${next ? `<div class="bar xp"><i style="width:${Math.min(100, 100 * m.xp / next)}%"></i></div>` : ''}<div class="nm">${S.names[m.star - 1]}</div></div>`;
  }).join('');
  minimap();
}
function minimap() {
  const cv = $('#wMap'), ctx = cv.getContext('2d'), s = 20, pad = 3;
  const rs = Object.values(W.rooms).filter(a => a.seen);
  const xs = rs.map(a => a.x), ys = rs.map(a => a.y);
  const x0 = Math.min(...xs), y0 = Math.min(...ys), w = Math.max(...xs) - x0 + 1, h = Math.max(...ys) - y0 + 1;
  cv.width = (w * (s + pad) + pad) * 2; cv.height = (h * (s * 0.7 + pad) + pad) * 2;
  cv.style.width = cv.width / 2 + 'px';
  ctx.scale(2, 2);
  const sh = s * 0.7;
  for (const a of rs) {
    const x = pad + (a.x - x0) * (s + pad), y = pad + (a.y - y0) * (sh + pad);
    ctx.fillStyle = key(a.x, a.y) === W.cur ? '#ffffff' : a.visited ? '#8a7fd0' : '#3b3566';
    ctx.globalAlpha = a.visited ? 1 : 0.8;
    ctx.fillRect(x, y, s, sh);
    ctx.globalAlpha = 1;
    const c = a.type === 'lair' ? '#ff5a6e' : a.type === 'treasure' ? '#ffd65a' : a.type === 'shrine' ? '#6bff8f' : a.type === 'locked' ? '#ffb02e' : a.type === 'secret' ? '#d9a6ff' : null;
    if (c) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x + s / 2, y + sh / 2, 2.6, 0, 6.3); ctx.fill(); }
    else if (a.visited && a.mon && !a.mon.beaten) { ctx.fillStyle = ELC[G.SP[a.mon.sp].el]; ctx.beginPath(); ctx.arc(x + s / 2, y + sh / 2, 2.4, 0, 6.3); ctx.fill(); }
    if (a.item === 'key' && a.visited && !a.used) { ctx.fillStyle = '#ffd65a'; ctx.fillRect(x + s - 4, y + 1, 3, 3); }
  }
}

// ---- input ------------------------------------------------------------------------------------
function bindInput() {
  const k = e => { const c = { ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd', ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r' }[e.code]; if (!c || !$('#wilds.on')) return; V.keys[c] = e.type === 'keydown'; e.preventDefault(); };
  addEventListener('keydown', k); addEventListener('keyup', k);
  addEventListener('blur', () => { V.keys = {}; V.joy = null; });
  const cv = V.cv;
  const pos = e => { const b = cv.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); const [x, y] = pos(e); V.joy = { id: e.pointerId, x0: x, y0: y, x, y }; });
  cv.addEventListener('pointermove', e => { if (V.joy && V.joy.id === e.pointerId) { const [x, y] = pos(e); V.joy.x = x; V.joy.y = y; } });
  const up = e => { if (V.joy && V.joy.id === e.pointerId) V.joy = null; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
}
function inputVec() {
  let x = (V.keys.r ? 1 : 0) - (V.keys.l ? 1 : 0), y = (V.keys.d ? 1 : 0) - (V.keys.u ? 1 : 0);
  if (V.joy) {
    const dx = V.joy.x - V.joy.x0, dy = V.joy.y - V.joy.y0, d = Math.hypot(dx, dy), r = 46;
    if (d > 8) { const k = Math.min(1, d / r) / d; x = dx * k; y = dy * k; }
  }
  const l = Math.hypot(x, y);
  return l > 1 ? [x / l, y / l] : [x, y];
}

// ---- simulation -------------------------------------------------------------------------------
function collideRocks(o, rad) {
  for (const [rx, ry, rr] of room().rocks) {
    const dx = o.x - rx, dy = o.y - ry, d = Math.hypot(dx, dy), m = rr + rad;
    if (d < m && d > 0.001) { o.x = rx + dx / d * m; o.y = ry + dy / d * m; }
  }
}
function msg(t) { if (V.msgT > 0) return; V.msgT = 1.6; U.toast(t); }
function frame(ts) {
  if (!V || !W) return;
  const dt = Math.min(0.05, (ts - V.last) / 1000); V.last = ts;
  if (!V.pause && $('#wilds.on')) step(dt);
  draw();
  V.raf = requestAnimationFrame(frame);
}
function step(dt) {
  V.msgT -= dt; V.inv -= dt;
  for (const p of V.parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 4 * dt; }
  V.parts = V.parts.filter(p => p.t < p.life);
  if (V.slide) { V.slide.t += dt / 0.32; if (V.slide.t >= 1) { V.slide = null; } return; }
  const a = room();
  const [ix, iy] = inputVec();
  const sp = 5.2;
  const o = { x: V.px + ix * sp * dt, y: V.py + iy * sp * dt };
  if (ix) V.fx = ix > 0 ? 1 : -1;
  V.walk = ix || iy ? V.walk + dt * 10 : 0;
  // walls, with gaps where there are open doors
  const gapX = Math.abs(o.x - 8) < 0.8, gapY = Math.abs(o.y - 4.5) < 0.8;
  const dn = doorOf(a, 'n'), ds = doorOf(a, 's'), dw = doorOf(a, 'w'), de = doorOf(a, 'e');
  const tryDoor = (d, st) => {
    if (st === 'lock') { if (W.keys > 0) { W.keys--; const t = W.rooms[key(a.x + DIRS[d][0], a.y + DIRS[d][1])]; (t.type === 'locked' ? t : a).unlocked = true; U.SFX.coin(); U.toast('Unlocked the vault!'); burst(DOOR[d][0], DOOR[d][1], '#ffd65a'); save(); minimap(); } else msg('Locked. Find a key on this floor.'); }
    if (st === 'crack') {
      V.push.d === d ? V.push.t += dt : (V.push = { d, t: 0 });
      if (V.push.t > 0.55) { const t = W.rooms[key(a.x + DIRS[d][0], a.y + DIRS[d][1])]; (t.type === 'secret' ? t : a).found = true; U.SFX.ko(); U.toast('A secret room!'); burst(DOOR[d][0], DOOR[d][1], '#d9a6ff'); markSeen(); save(); minimap(); }
      else msg('This wall looks cracked… keep pushing.');
    }
  };
  if (o.y < IN.y0) { if (gapX && dn === 'open') { if (o.y < 0.35) return go('n'); o.x = Math.max(7.25, Math.min(8.75, o.x)); } else { if (gapX && dn) tryDoor('n', dn); o.y = IN.y0; } }
  if (o.y > IN.y1) { if (gapX && ds === 'open') { if (o.y > RH - 0.35) return go('s'); o.x = Math.max(7.25, Math.min(8.75, o.x)); } else { if (gapX && ds) tryDoor('s', ds); o.y = IN.y1; } }
  if (o.x < IN.x0) { if (gapY && dw === 'open') { if (o.x < 0.35) return go('w'); o.y = Math.max(3.75, Math.min(5.25, o.y)); } else { if (gapY && dw) tryDoor('w', dw); o.x = IN.x0; } }
  if (o.x > IN.x1) { if (gapY && de === 'open') { if (o.x > RW - 0.35) return go('e'); o.y = Math.max(3.75, Math.min(5.25, o.y)); } else { if (gapY && de) tryDoor('e', de); o.x = IN.x1; } }
  collideRocks(o, 0.38);
  V.px = o.x; V.py = o.y;
  // pickups
  const near = (x, y, r) => Math.hypot(V.px - x, V.py - y) < r;
  if (a.item && !a.used && near(8, 4.5, 0.9) && !(a.mon && !a.mon.beaten)) pickup(a);
  if (a.type === 'lair' && a.mon && a.mon.beaten && near(8, 4.5, 0.8)) return descend();
  // wild creatures wander, then come at you when you are close
  for (const m of V.mons) {
    m.t -= dt; m.bob += dt * 4;
    const d = Math.hypot(V.px - m.x, V.py - m.y);
    if (!m.lair && d < 3.6) { m.tx = V.px; m.ty = V.py; m.t = 0.3; }
    else if (m.t <= 0) { m.tx = m.lair ? 8 + (Math.random() - 0.5) * 2 : IN.x0 + 1 + Math.random() * (IN.x1 - IN.x0 - 2); m.ty = m.lair ? 4 + (Math.random() - 0.5) * 1.4 : IN.y0 + 0.6 + Math.random() * (IN.y1 - IN.y0 - 1.2); m.t = 1.5 + Math.random() * 2; }
    const dx = m.tx - m.x, dy = m.ty - m.y, l = Math.hypot(dx, dy), v = (d < 3.6 && !m.lair ? 2.3 : 1.2) * dt;
    if (l > 0.05) { const q = { x: m.x + dx / l * Math.min(v, l), y: m.y + dy / l * Math.min(v, l) }; collideRocks(q, 0.45); m.x = q.x; m.y = q.y; m.fx = dx > 0 ? 1 : -1; }
    if (d < (m.lair ? 1.25 : 0.95) && V.inv <= 0) return battle(a, m);
  }
}
function burst(x, y, c) { for (let i = 0; i < 22; i++) { const an = Math.random() * 6.3, v = 1 + Math.random() * 3; V.parts.push({ x, y, vx: Math.cos(an) * v, vy: Math.sin(an) * v - 1.5, t: 0, life: 0.5 + Math.random() * 0.4, c }); } }
function go(d) {
  const a = room(), nk = key(a.x + DIRS[d][0], a.y + DIRS[d][1]);
  V.slide = { d, t: 0, from: W.cur };
  W.cur = nk;
  U.tone(300, 0.08, 'triangle', 0.04, 1.5);
  placeRoom(OPP[d]);
  hud();
}
function pickup(a) {
  a.used = true;
  const m = meta();
  if (a.item === 'key') { W.keys++; U.SFX.coin(); U.toast('Found a key! It opens this floor\'s vault.'); }
  else if (a.item === 'berry') { for (const s of W.squad) if (s.hp > 0) s.hp = Math.min(1, s.hp + 0.35); U.SFX.heal(); U.toast('Glimberries! Your squad recovers 35% HP.'); }
  else if (a.item === 'chest') { const g = 10 + 6 * W.floor; m.shards += g; W.shards += g; if (Math.random() < 0.5) for (const s of W.squad) if (s.hp > 0) s.hp = Math.min(1, s.hp + 0.25); U.SFX.lvl(); U.toast(`Treasure! +${g} Glimmer Shards.`); }
  else if (a.item === 'shrine') { for (const s of W.squad) s.hp = s.hp > 0 ? 1 : 0.5; U.SFX.heal(); U.toast('The shrine restores your squad, and revives the fainted.'); }
  burst(8, 4.5, a.item === 'shrine' ? '#6bff8f' : '#ffd65a');
  save(); U.save(); hud();
}

// ---- battles ----------------------------------------------------------------------------------
async function battle(a, mv) {
  V.pause = true;
  const mon = a.mon, fit = W.squad.filter(m => m.hp > 0);
  const insts = fit.map(squadInst);
  const foes = [{ uid: -1, sp: mon.sp, star: mon.star, muts: [], scale: mon.scale, shiny: false }].concat(mon.escorts.map((sp, i) => ({ uid: -2 - i, sp, star: mon.escStar || 1, muts: [], scale: mon.scale * 0.92 })));
  for (const f of foes) { f.skill = C.defaultSkill(f); meta().dex[f.sp] = Math.max(meta().dex[f.sp] || 0, f.star); }
  const S = G.SP[mon.sp], nm = S.names[mon.star - 1];
  U.tone(200, 0.25, 'sawtooth', 0.05, 2.5);
  $('#wilds').classList.add('flash');
  await new Promise(r => setTimeout(r, 380));
  $('#wilds').classList.remove('flash');
  const st = await U.wildBattle(placeSide(insts, 0), placeSide(foes, 1), W.biome, `${a.type === 'lair' ? '♛ Lair: ' : 'Wild '}${nm}${mon.escorts.length ? ` <span class="small muted">+${mon.escorts.length}</span>` : ''}`);
  // carry HP back to the squad
  for (const u of st.units) if (u.side === 0 && !u.summoned) { const m = W.squad.find(s => s.uid === u.inst.uid); if (m) m.hp = u.alive ? Math.max(0.05, u.hp / u.maxHp) : 0; }
  const win = st.over === 1;
  U.show('wilds');
  if (win) await victory(a, mon, fit);
  else {
    U.SFX.ko();
    if (!W.squad.some(m => m.hp > 0)) { save(); return endExpedition('fainted'); }
    await U.ask('Defeat', `<p style="text-align:center">${nm} drove you back. Fainted creatures sit out until the next floor (or a shrine).</p>`, U.btn('ok', 'Regroup', 'green'));
    // back off to the door you came in through
    V.px = Math.min(IN.x1, Math.max(IN.x0, V.px + (V.px - mv.x) * 1.5)); V.py = Math.min(IN.y1, Math.max(IN.y0, V.py + (V.py - mv.y) * 1.5));
    V.inv = 2.2;
  }
  save(); U.save(); hud();
  V.pause = false; V.last = performance.now();
}
async function victory(a, mon, fit) {
  const m = meta(), sp = mon.sp, S = G.SP[sp];
  mon.beaten = true; V.mons = [];
  W.wins++;
  const lair = a.type === 'lair';
  const g = (lair ? 10 + 6 * W.floor : 2 + W.floor);
  m.shards += g; W.shards += g;
  const fresh = !m.unlocked[sp];
  m.unlocked[sp] = 1; m.caught[sp] = 1;
  if (fresh) W.found.push(sp);
  // squad XP, and evolutions mid-expedition
  const evos = [];
  for (const s of fit) {
    s.xp += lair ? 2 : 1;
    while (s.star < 3 && s.xp >= XP_STAR[s.star]) { s.star++; s.hp = Math.min(1, s.hp + 0.3); evos.push(s); }
  }
  U.SFX.lvl();
  const join = W.squad.length < SQUAD_MAX && !W.squad.some(s => s.sp === sp);
  const body = `<div class="evo-stage" style="height:170px"><div class="glow"></div><img src="${IMG('cr_' + sp + mon.star)}" style="max-height:160px" alt=""></div>
    <p style="text-align:center">${fresh ? `<b style="color:var(--gold)">NEW!</b> <b>${S.names[0]}</b> is unlocked for good. It now appears in the Auto Chess shop and as a starter.` : `You beat ${S.names[mon.star - 1]} again.`}</p>
    <p class="small" style="text-align:center">+${g} Glimmer Shards${lair ? ' · the way down is open' : ''}</p>
    ${evos.map(s => `<p style="text-align:center;color:#7dff9b">${G.SP[s.sp].names[s.star - 2]} evolved into <b>${G.SP[s.sp].names[s.star - 1]}</b>! ${'★'.repeat(s.star)}</p>`).join('')}
    ${join ? `<p class="muted small" style="text-align:center">It can join your squad for the rest of this expedition (${W.squad.length}/${SQUAD_MAX}).</p>` : ''}`;
  const v = await U.ask(fresh ? 'Creature unlocked!' : 'Victory!', body, (join ? U.btn('join', `Add ${S.names[0]} to the squad`, 'green') + U.btn('no', 'Not now', 'ghost sm') : U.btn('ok', 'Continue', 'green')));
  if (v === 'join') { W.squad.push({ uid: W.nextUid++, sp, star: 1, xp: 0, hp: 1, shiny: false }); U.toast(S.names[0] + ' joined your squad!'); }
}
async function descend() {
  V.pause = true;
  if (W.floor >= FLOORS) return endExpedition('done');
  const v = await U.ask('Go deeper?', `<p style="text-align:center">Stairs lead down to floor ${W.floor + 1}/${FLOORS}. Rarer, stronger creatures live deeper.</p><p class="small muted" style="text-align:center">Fainted creatures recover 40% HP on the way down; everyone else heals 25%.</p>`, U.btn('go', 'Descend', 'green') + U.btn('stay', 'Not yet', 'ghost sm'));
  if (v !== 'go') { V.py = Math.min(IN.y1, V.py + 1.4); V.pause = false; V.last = performance.now(); return; }
  for (const s of W.squad) s.hp = s.hp > 0 ? Math.min(1, s.hp + 0.25) : 0.4;
  U.SFX.ult();
  newFloor(W.floor + 1);
  placeRoom(null);
  save(); hud();
  U.toast(`Floor ${W.floor}: ${G.BIOMES[W.biome].name}`);
  V.pause = false; V.last = performance.now();
}

// ---- drawing ------------------------------------------------------------------------------------
function draw() {
  const cv = V.cv, b = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
  if (cv.width !== Math.round(b.width * dpr) || cv.height !== Math.round(b.height * dpr)) { cv.width = Math.round(b.width * dpr); cv.height = Math.round(b.height * dpr); }
  // fit the room; on a tall phone screen zoom in to fill the height and follow the tamer
  const ctx = V.ctx, fit = Math.min(cv.width / RW, cv.height / RH), S = Math.max(fit, Math.min(cv.width / 6.5, cv.height / RH));
  const cam = (v, view, size) => view >= size * S ? (view - size * S) / 2 : Math.min(0, Math.max(view - size * S, view / 2 - v * S));
  const ox = cam(V.px, cv.width, RW), oy = cam(V.py, cv.height, RH);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#07051a'; ctx.fillRect(0, 0, cv.width, cv.height);
  if (V.slide) {
    const e = 1 - Math.pow(1 - V.slide.t, 3), [dx, dy] = DIRS[V.slide.d];
    const from = W.rooms[V.slide.from];
    drawRoom(from, ox - dx * e * RW * S, oy - dy * e * RH * S, S, false);
    drawRoom(room(), ox + dx * (1 - e) * RW * S, oy + dy * (1 - e) * RH * S, S, true);
    return;
  }
  drawRoom(room(), ox, oy, S, true);
  // creatures and the tamer, back to front
  const ents = V.mons.map(m => ({ y: m.y, f: () => sprite(ctx, img('cr_' + room().mon.sp + room().mon.star), ox + m.x * S, oy + m.y * S, m.sz * S, m.fx || -1, Math.sin(m.bob) * 0.04, m.lair) }));
  ents.push({ y: V.py, f: () => { if (V.inv > 0 && Math.floor(V.inv * 10) % 2) ctx.globalAlpha = 0.5; sprite(ctx, img('wd_tamer'), ox + V.px * S, oy + V.py * S, 1.15 * S, V.fx, Math.abs(Math.sin(V.walk)) * 0.07, false); ctx.globalAlpha = 1; } });
  ents.sort((p, q) => p.y - q.y).forEach(e => e.f());
  for (const p of V.parts) { ctx.globalAlpha = 1 - p.t / p.life; ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(ox + p.x * S, oy + p.y * S, S * 0.07, 0, 6.3); ctx.fill(); }
  ctx.globalAlpha = 1;
  if (V.joy) {
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 3 * dpr; ctx.beginPath(); ctx.arc(V.joy.x0 * dpr, V.joy.y0 * dpr, 46 * dpr, 0, 6.3); ctx.stroke();
    const dx = V.joy.x - V.joy.x0, dy = V.joy.y - V.joy.y0, d = Math.hypot(dx, dy), k = d > 46 ? 46 / d : 1;
    ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.arc((V.joy.x0 + dx * k) * dpr, (V.joy.y0 + dy * k) * dpr, 20 * dpr, 0, 6.3); ctx.fill();
  }
}
function drawRoom(a, ox, oy, S, live) {
  const ctx = V.ctx, bg = img('rm_' + W.biome);
  if (ready(bg)) ctx.drawImage(bg, ox, oy, RW * S, RH * S); else { ctx.fillStyle = '#2b2550'; ctx.fillRect(ox, oy, RW * S, RH * S); }
  // a soft vignette so the floor reads as lit from the middle
  const g = ctx.createRadialGradient(ox + RW * S / 2, oy + RH * S / 2, RH * S * 0.25, ox + RW * S / 2, oy + RH * S / 2, RW * S * 0.62);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.35)');
  ctx.fillStyle = g; ctx.fillRect(ox, oy, RW * S, RH * S);
  for (const d in DOOR) {
    const st = doorOf(a, d); if (!st) continue;
    const [x, y, rot] = DOOR[d], im = img(st === 'open' ? 'wd_door' : st === 'lock' ? 'wd_lock' : 'wd_crack');
    if (!ready(im)) continue;
    ctx.save(); ctx.translate(ox + x * S, oy + y * S); ctx.rotate(rot);
    const w = (st === 'crack' ? 1.5 : 1.9) * S;
    ctx.drawImage(im, -w / 2, -w * 0.62, w, w);
    ctx.restore();
  }
  for (const [rx, ry, rr] of a.rocks) { const im = img('wd_rock'); if (ready(im)) { shadow(ctx, ox + rx * S, oy + (ry + rr * 0.55) * S, rr * S); ctx.drawImage(im, ox + (rx - rr * 1.3) * S, oy + (ry - rr * 1.6) * S, rr * 2.6 * S, rr * 2.6 * S); } }
  const cx = ox + 8 * S, cy = oy + 4.5 * S;
  if (a.item && !a.used && !(a.mon && !a.mon.beaten)) {
    const k = { key: 'wd_key', berry: 'wd_berry', chest: 'node_treasure', shrine: 'wd_shrine' }[a.item], im = img(k), sz = (a.item === 'shrine' ? 1.6 : a.item === 'chest' ? 1.3 : 0.9) * S;
    const t = performance.now() / 1000, bob = a.item === 'key' || a.item === 'berry' ? Math.sin(t * 3) * 0.08 * S : 0;
    if (ready(im)) { shadow(ctx, cx, cy + sz * 0.3, sz * 0.4); glow(ctx, cx, cy - sz * 0.2, sz * 0.75, a.item === 'shrine' ? '107,255,143' : '255,214,90'); ctx.drawImage(im, cx - sz / 2, cy - sz * 0.75 + bob, sz, sz); }
  }
  if (a.type === 'lair' && a.mon && a.mon.beaten) { const im = img('wd_stairs'); if (ready(im)) { glow(ctx, cx, cy, 1.3 * S, '120,200,255'); ctx.drawImage(im, cx - 0.9 * S, cy - 0.9 * S, 1.8 * S, 1.8 * S); } }
  if (!live) return;
}
function shadow(ctx, x, y, r) { ctx.fillStyle = 'rgba(0,0,0,.32)'; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.38, 0, 0, 6.3); ctx.fill(); }
function glow(ctx, x, y, r, rgb) {
  const t = performance.now() / 1000, g = ctx.createRadialGradient(x, y, 0, x, y, r * (1 + Math.sin(t * 3) * 0.06));
  g.addColorStop(0, `rgba(${rgb},.45)`); g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 1.1, 0, 6.3); ctx.fill();
}
// a standing sprite anchored at its feet; creature art faces right, so fx -1 mirrors it
function sprite(ctx, im, x, y, sz, fx, bob, boss) {
  shadow(ctx, x, y, sz * 0.32);
  if (boss) glow(ctx, x, y - sz * 0.4, sz * 0.7, '255,90,110');
  if (!ready(im)) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(fx < 0 ? -1 : 1, 1 + bob); ctx.drawImage(im, -sz / 2, -sz * 0.92, sz, sz); ctx.restore();
}

window.WILDS = { open, get state() { return W; }, get view() { return V; }, doors: () => W && Object.keys(DOOR).map(d => [d, doorOf(room(), d), DOOR[d][0], DOOR[d][1]]).filter(x => x[1]) };
})();
