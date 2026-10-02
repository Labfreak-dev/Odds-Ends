// Glimmerdeep UI: screens, map, battle playback, reward flows, shop, team, camp.
(function () {
'use strict';
const G = window.GD, B = window.GB, R = window.GR;
const $ = (s, r) => (r || document).querySelector(s);
const IMG = k => 'img/' + k + '.webp';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SAVE = 'glimmerdeep.v1';

// ---- save ---------------------------------------------------------------------------
let meta = { shards: 0, up: {}, caught: {}, dex: {}, runs: 0, wins: 0, depthMax: 0, auto: false, speed: 1, sound: true };
let run = null;
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE) || 'null');
    if (s && s.meta) Object.assign(meta, s.meta);
    if (s && s.run && s.run.v === 1) run = s.run;
  } catch (e) { /* private mode or bad save: start fresh */ }
}
function save() {
  if (run) for (const k in run.seen) meta.dex[k] = Math.max(meta.dex[k] || 0, run.seen[k]);
  try { localStorage.setItem(SAVE, JSON.stringify({ meta, run: run && !run.over ? run : null }, (k, v) => k === 'rnd' ? undefined : v)); } catch (e) { /* storage blocked */ }
}

// ---- sound (tiny synth) ---------------------------------------------------------------
let AC = null;
function tone(f, d, type, vol, slide) {
  if (!meta.sound) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime;
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t + d);
    g.gain.setValueAtTime(vol || 0.08, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + d);
  } catch (e) { /* no audio */ }
}
const SFX = {
  click: () => tone(660, 0.06, 'triangle', 0.05),
  hit: () => { tone(180, 0.12, 'square', 0.05, 0.5); tone(90, 0.1, 'sine', 0.08, 0.6); },
  crit: () => { tone(260, 0.18, 'sawtooth', 0.06, 0.4); tone(820, 0.08, 'square', 0.04); },
  heal: () => { tone(520, 0.12, 'sine', 0.06, 1.5); setTimeout(() => tone(780, 0.14, 'sine', 0.05, 1.3), 70); },
  ko: () => tone(300, 0.4, 'triangle', 0.08, 0.2),
  ult: () => { tone(220, 0.5, 'sawtooth', 0.05, 3); tone(330, 0.5, 'triangle', 0.05, 2.5); },
  react: () => { tone(880, 0.1, 'square', 0.04); setTimeout(() => tone(1320, 0.14, 'square', 0.04), 60); },
  lvl: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'triangle', 0.06), i * 80)),
  coin: () => { tone(988, 0.08, 'square', 0.04); setTimeout(() => tone(1319, 0.12, 'square', 0.04), 60); },
  miss: () => tone(400, 0.1, 'sine', 0.04, 1.6),
};

// ---- small renderers ---------------------------------------------------------------------
function show(id) { document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id)); }
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.remove('on'); void t.offsetWidth; t.classList.add('on'); }
const elBadge = (el, cls) => `<img class="${cls || 'badge'}" src="${IMG('el_' + el)}" alt="${G.EL[el] ? G.EL[el].name : ''}">`;
function monImg(inst, cls) { return `<img class="${cls || ''}${inst.shiny ? ' shiny' : ''}" src="${IMG(B.instArt(inst))}" alt="">`; }
function hpClass(p) { return p < 0.3 ? 'low' : p < 0.6 ? 'mid' : ''; }
function bar(p, cls) { p = Math.max(0, Math.min(1, p)); return `<div class="bar ${cls || ''}"><i class="${cls ? '' : hpClass(p)}" style="width:${(p * 100).toFixed(1)}%"></i></div>`; }
const ROLE_N = { striker: 'Striker', caster: 'Caster', tank: 'Tank', support: 'Support' };
function skillTag(sk) {
  const t = { foe: 'Single', lowfoe: 'Weakest', foes: 'All foes', foe3: '3 hits', foe5: '5 hits', foe6: '6 hits', ally: 'Heal ally', allies: 'Team', self: 'Self' }[sk.t];
  return (sk.ult ? 'ULT · ' : '') + t + (sk.pow ? ' · ' + sk.pow : '') + (sk.cd ? ' · CD ' + sk.cd : '') + (sk.rng ? ' · Ranged' : '');
}

// ---- modal flows ----------------------------------------------------------------------------
const M = $('#modal'), MB = $('#modalBox');
let modalHandler = null;
M.addEventListener('click', e => {
  const t = e.target.closest('[data-v]');
  if (!t || !MB.contains(t) || !modalHandler) return;
  SFX.click();
  modalHandler(t.dataset.v, t);
});
function modal(title, body, acts) {
  MB.innerHTML = `<h2>${title}</h2><div class="body">${body || ''}</div>${acts ? `<div class="acts">${acts}</div>` : ''}`;
  M.classList.add('on');
  return new Promise(res => { modalHandler = v => { res(v); }; });
}
function closeModal() { M.classList.remove('on'); modalHandler = null; MB.innerHTML = ''; }
async function ask(title, body, acts) { const v = await modal(title, body, acts); closeModal(); return v; }
const btn = (v, label, cls) => `<button class="btn ${cls || ''}" data-v="${esc(v)}">${label}</button>`;

// ---- title / pick ---------------------------------------------------------------------------
function renderTitle() {
  const m = $('#titleMenu');
  m.innerHTML = (run ? btn('cont', 'Continue Run', 'green') : '') + btn('new', 'New Run') + btn('camp', 'Camp & Upgrades', 'blue') +
    `<div class="row">${btn('dex', 'Glimdex', 'ghost sm')}${btn('how', 'How to Play', 'ghost sm')}${btn('snd', meta.sound ? 'Sound: On' : 'Sound: Off', 'ghost sm')}</div>` +
    `<div class="pill" style="margin-top:6px"><img src="${IMG('ui_shard')}" alt="">${meta.shards} shards · ${meta.wins} wins</div>`;
  show('title');
}
$('#titleMenu').addEventListener('click', async e => {
  const t = e.target.closest('[data-v]'); if (!t) return;
  SFX.click();
  const v = t.dataset.v;
  if (v === 'cont') { if (run.pendingBattle != null) { renderMap(); startBattle(R.nodeById(run, run.pendingBattle)); } else renderMap(); }
  else if (v === 'new') {
    if (run && await ask('Abandon run?', '<p style="text-align:center">Your current run will be lost.</p>', btn('y', 'Abandon', 'ghost') + btn('n', 'Keep it', 'green')) !== 'y') return;
    renderPick();
  }
  else if (v === 'camp') renderCamp();
  else if (v === 'dex') showDex();
  else if (v === 'how') showHow();
  else if (v === 'snd') { meta.sound = !meta.sound; save(); renderTitle(); }
});
document.addEventListener('click', e => { const g = e.target.closest('[data-go]'); if (g && !M.contains(g)) { SFX.click(); if (g.dataset.go === 'title') renderTitle(); } });

let pickDepth = 0;
function renderPick() {
  const seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
  const opts = R.starterChoices(meta, seed);
  pickDepth = Math.min(pickDepth, meta.depthMax);
  $('#pickCards').innerHTML = opts.map(sp => {
    const S = G.SP[sp];
    const sks = S.sk.slice(0, 3).map(id => G.SK[id].n).join(' · ');
    return `<div class="card el-${S.el}" data-sp="${sp}"><div class="art"><img src="${IMG('cr_' + sp + '1')}" alt=""></div>
      <h3>${S.names[0]}</h3><div class="row center" style="margin-top:4px">${elBadge(S.el)}<span class="tag">${ROLE_N[S.role]}</span></div>
      <p>${sks}</p><p>Evolves into ${S.names[1]} (L${G.EVO_LV[1]}) and ${S.names[2]} (L${G.EVO_LV[2]})</p></div>`;
  }).join('');
  let d = '';
  for (let i = 0; i <= meta.depthMax; i++) d += `<button class="btn sm ${i === pickDepth ? 'green' : 'ghost'}" data-depth="${i}">${i ? 'Depth ' + i : 'Normal'}</button>`;
  $('#pickDepth').innerHTML = meta.depthMax ? `<span class="muted small">Difficulty:</span>${d}` : '';
  $('#pickCards').dataset.seed = seed;
  show('pick');
}
$('#pickDepth').addEventListener('click', e => { const t = e.target.closest('[data-depth]'); if (t) { pickDepth = +t.dataset.depth; renderPick(); } });
$('#pickCards').addEventListener('click', e => {
  const c = e.target.closest('[data-sp]'); if (!c) return;
  SFX.lvl();
  run = R.newRun(meta, c.dataset.sp, +$('#pickCards').dataset.seed, pickDepth);
  meta.runs++;
  for (const p of run.party) meta.caught[p.sp] = 1;
  save();
  renderMap();
  toast('Welcome to the ' + G.BIOMES[run.biome].name + '!');
});

// ---- map ------------------------------------------------------------------------------------
const NODE_ICON = { battle: 'node_battle', elite: 'node_elite', den: 'node_den', shop: 'node_shop', rest: 'node_rest', event: 'node_event', treasure: 'node_treasure', boss: 'node_boss' };
const NODE_N = { battle: 'Wild battle', elite: 'Elite battle', den: 'Creature den', shop: 'Shop', rest: 'Campfire', event: 'Mystery', treasure: 'Treasure', boss: 'Boss' };
function topbar(where) {
  const bi = G.BIOMES[run.biome];
  return `<button class="iconbtn" data-top="menu">☰</button><div class="grow"><div class="title">${bi.name}</div><div class="small muted">Act ${run.act + 1} of 4${run.depth ? ' · Depth ' + run.depth : ''}</div></div>
    <span class="pill"><img src="${IMG('ui_gold')}" alt="">${run.gold}</span>
    <button class="iconbtn" data-top="bag" title="Relics, charms and items"><img src="${IMG('node_treasure')}" alt=""></button>
    <button class="iconbtn" data-top="team" title="Team"><img src="${IMG(B.instArt(run.party[0]))}" alt=""></button>`;
}
function renderMap() {
  if (!run) return renderTitle();
  const m = run.map, bi = G.BIOMES[run.biome];
  $('#mapBg').style.backgroundImage = `url(${IMG(bi.bg)})`;
  $('#mapTop').innerHTML = topbar();
  $('#mapHaz').innerHTML = `<div class="grow"><div class="hz">Hazard: ${bi.hazName}</div><div class="small">${bi.hazDesc}</div><div class="small muted">Counter: ${bi.counter}</div></div>`;
  const rowH = 92, H = (m.rows + 1) * rowH + 70;
  const can = new Set(R.reachable(run));
  const pos = n => ({ x: n.type === 'boss' ? 50 : (n.c + 0.5) * 25, y: H - 50 - n.r * rowH });
  let svg = `<svg viewBox="0 0 100 ${H}" preserveAspectRatio="none">`;
  for (const n of m.nodes) for (const id of n.next) {
    const a = pos(n), b = pos(R.nodeById(run, id));
    const lit = m.done.includes(n.id) && (m.done.includes(id) || can.has(id));
    svg += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${lit ? '#ffd65a' : 'rgba(255,255,255,.35)'}" stroke-width="${lit ? 0.9 : 0.6}" stroke-dasharray="${lit ? '' : '1.4 1.4'}" vector-effect="non-scaling-stroke" style="stroke-width:${lit ? 4 : 3}px"/>`;
  }
  svg += '</svg>';
  let html = svg;
  for (const n of m.nodes) {
    const p = pos(n);
    const cls = ['node', n.type === 'boss' ? 'boss' : '', m.done.includes(n.id) ? 'done' : '', m.cur === n.id ? 'cur' : '', can.has(n.id) ? 'can' : ''].join(' ');
    let pv = '';
    if ((run.perks.scout || n.r === 0 || can.has(n.id)) && n.preview) pv = `<div class="pv">${n.preview.map(sp => elBadge(G.SP[sp].el)).join('')}</div>`;
    html += `<div class="${cls}" data-node="${n.id}" style="left:${p.x}%;top:${p.y}px" title="${NODE_N[n.type]}"><img src="${IMG(NODE_ICON[n.type])}" alt="${NODE_N[n.type]}">${pv}</div>`;
  }
  const inner = $('#mapInner');
  inner.style.height = H + 'px';
  inner.innerHTML = html;
  renderPartyBar();
  show('map');
  // keep the current position in view
  const cur = m.cur != null ? pos(R.nodeById(run, m.cur)).y : H;
  const w = $('#mapWrap');
  requestAnimationFrame(() => { w.scrollTop = Math.max(0, cur - w.clientHeight * 0.6); });
}
function renderPartyBar() {
  $('#mapParty').innerHTML = run.party.map((p, i) => `<div class="pm ${i >= 4 ? 'bench' : ''} ${p.hpPct <= 0 ? 'ko' : ''}" data-uid="${p.uid}">
    ${R.canEvolve(run, p) ? '<span class="evo">EVO</span>' : ''}${monImg(p)}<div class="lv">${esc(B.instName(p))} L${p.lvl}</div>${bar(p.hpPct)}</div>`).join('');
}
$('#mapParty').addEventListener('click', e => { const t = e.target.closest('[data-uid]'); if (t) { SFX.click(); teamDetail(+t.dataset.uid); } });
document.addEventListener('click', e => {
  const t = e.target.closest('[data-top]'); if (!t) return;
  SFX.click();
  const v = t.dataset.top;
  if (v === 'bag') bagScreen(); else if (v === 'team') teamScreen(); else if (v === 'menu') menuScreen();
});
$('#mapInner').addEventListener('click', e => {
  const t = e.target.closest('.node.can'); if (!t || busyMap) return;
  SFX.click();
  enter(+t.dataset.node);
});
let busyMap = false;
async function enter(id) {
  busyMap = true;
  try {
    const node = R.enterNode(run, id);
    save();
    if (node.type === 'battle' || node.type === 'elite' || node.type === 'boss') { busyMap = false; return startBattle(node); }
    if (node.type === 'treasure') await treasure();
    else if (node.type === 'rest') await rest();
    else if (node.type === 'shop') await shop();
    else if (node.type === 'event') { if (await eventNode(node) === 'battle') return; }
    else if (node.type === 'den') await den(node);
    save();
    renderMap();
  } finally { busyMap = false; }
}

// ---- battle ---------------------------------------------------------------------------------
let BS = null;
const arena = $('#arena');
function slotPos(f, st) {
  const bossFight = st.f.some(x => x.side === 1 && x.boss);
  if (f.boss) return { x: 80, b: 14, w: 33, z: 8 };
  const P = [[31, 34], [35, 6], [12, 38], [15, 9]];
  let [x, b] = P[f.slot];
  if (f.side === 1) {
    x = 100 - x;
    if (bossFight) [x, b] = [[61, 34], [64, 5], [49, 36], [51, 6]][f.slot];
  }
  const far = b > 20;
  const w = (f.stage === 3 ? 18.5 : f.stage === 2 ? 16 : 13.5) * (far ? 0.9 : 1);
  return { x, b, w, z: far ? 9 : 11 };
}
function monHtml(f, st) {
  const p = slotPos(f, st);
  return `<div class="mon side${f.side} ${f.alive ? '' : 'dead'} ${f.elite ? 'elite' : ''} ${f.boss ? 'boss' : ''}" data-id="${f.id}" style="left:${p.x}%;bottom:${p.b}%;--w:${p.w}%;z-index:${p.z}">
    <div class="hud"><div class="nm">${elBadge(f.el)}<span>${esc(f.name)} ${f.boss ? '' : 'L' + f.lvl}</span></div>
      <div class="bar hp"><i class="${hpClass(f.hp / f.maxHp)}" style="width:${100 * f.hp / f.maxHp}%"></i><i class="sh" style="width:${Math.min(100, 100 * f.shield / f.maxHp)}%"></i></div>
      ${f.side === 0 || f.boss ? `<div class="bar od"><i style="width:${f.od}%"></i></div>` : ''}<div class="sts"></div></div>
    <div class="rig"><img class="spr${f.shiny ? ' shiny' : ''}" src="${IMG(f.art)}" alt=""></div><div class="shadow"></div></div>`;
}
function monEl(id) { return arena.querySelector(`.mon[data-id="${id}"]`); }
const ST_LABEL = { burn: 'BRN', poison: 'PSN', soak: 'WET', wet: 'WET', stun: 'STUN', root: 'ROOT', curse: 'CURSE', blind: 'BLIND', atkUp: 'ATK▲', defUp: 'DEF▲', spdUp: 'SPD▲', critUp: 'CRIT▲', dodge: 'EVA▲', regen: 'REGEN', taunt: 'TAUNT' };
function stsHtml(f) {
  let s = '';
  for (const k in f.st) {
    if (!ST_LABEL[k]) continue;
    const cls = ['atkUp', 'defUp', 'spdUp', 'critUp', 'dodge', 'regen'].includes(k) ? 'buff' : k;
    s += `<span class="st ${cls}">${ST_LABEL[k]}${k === 'poison' ? '×' + f.st[k].n : ''}</span>`;
  }
  if (f.elite) s += `<span class="st taunt">${f.elite.toUpperCase()}</span>`;
  return s;
}
function syncMon(f) {
  const el = monEl(f.id); if (!el) return;
  el.classList.toggle('dead', !f.alive);
  setHud(f, f.hp, f.shield);
  const od = el.querySelector('.bar.od i'); if (od) od.style.width = f.od + '%';
  el.querySelector('.sts').innerHTML = stsHtml(f);
  el.querySelector('.nm img').src = IMG('el_' + f.el);
  el.classList.toggle('focus', BS && BS.st.focus === f.id);
}
function renderArena() {
  const st = BS.st;
  const bi = G.BIOMES[st.biome];
  arena.style.backgroundImage = `url(${IMG(bi.bg)})`;
  const T = st.traits[0];
  let traits = '';
  for (const e of G.ELS) if (T[e] >= 0) traits += `<span class="trait el-${e}" title="${G.TRAITS[e][T[e]]}">${G.EL[e].name} ×${T._c[e]}</span>`;
  arena.innerHTML = `<div class="dim"></div><div class="info"><span class="pill" title="${esc(bi.hazDesc)}">⚠ ${bi.hazName}</span>${traits}</div>
    <div class="turn pill" id="turnPill">Turn ${st.turn + 1}</div>` + st.f.map(f => monHtml(f, st)).join('');
  st.f.forEach(syncMon);
}
function pop(id, text, cls, dy) {
  const el = monEl(id); if (!el) return;
  const a = arena.getBoundingClientRect(), r = el.getBoundingClientRect();
  const p = document.createElement('div');
  p.className = 'pop ' + (cls || '');
  p.textContent = text;
  p.style.left = ((r.left + r.width / 2 - a.left) / a.width * 100) + '%';
  p.style.top = ((r.top + r.height * 0.35 - a.top) / a.height * 100 + (dy || 0)) + '%';
  arena.appendChild(p);
  setTimeout(() => p.remove(), 1300);
}
function center(id) {
  const el = monEl(id); if (!el) return null;
  const a = arena.getBoundingClientRect(), r = el.getBoundingClientRect();
  return { x: (r.left + r.width / 2 - a.left) / a.width * 100, y: (r.top + r.height * 0.55 - a.top) / a.height * 100, px: r.left + r.width / 2, py: r.top + r.height / 2 };
}
function fxBurst(id, el) {
  const c = center(id); if (!c) return;
  const b = document.createElement('div');
  b.className = 'burst el-' + el;
  b.style.left = c.x + '%'; b.style.top = c.y + '%';
  arena.appendChild(b); setTimeout(() => b.remove(), 500);
}
function fxOrb(from, to, el, ms) {
  const a = center(from), b = center(to); if (!a || !b) return Promise.resolve();
  const o = document.createElement('div');
  o.className = 'orb el-' + el;
  o.style.left = a.x + '%'; o.style.top = a.y + '%';
  arena.appendChild(o);
  const an = o.animate([{ left: a.x + '%', top: a.y + '%' }, { left: b.x + '%', top: b.y + '%' }], { duration: ms, easing: 'ease-in' });
  return an.finished.then(() => o.remove(), () => o.remove());
}
function lunge(from, to, ms) {
  const el = monEl(from), a = center(from), b = center(to); if (!el || !a || !b) return Promise.resolve();
  const dx = (b.px - a.px) * 0.55, dy = (b.py - a.py) * 0.4;
  el.classList.add('actor');
  // body travel: hang back during the wind-up, dash in, hop back
  const an = el.animate([{ transform: 'translate(-50%,0)' }, { transform: `translate(calc(-50% + ${-dx * 0.08}px), 0)`, offset: 0.25 },
    { transform: `translate(calc(-50% + ${dx}px), ${dy}px)`, offset: 0.5 }, { transform: `translate(calc(-50% + ${dx * 0.9}px), ${dy * 0.9}px)`, offset: 0.62 },
    { transform: 'translate(-50%,0)' }], { duration: ms, easing: 'ease-in-out' });
  return an.finished.then(() => el.classList.remove('actor'), () => {});
}
// ---- creature rig animations (the inner .rig layer, so the idle bob keeps running) ----------
function rigOf(id) { const el = monEl(id); return el && el.querySelector('.rig'); }
function faceOf(id) { const f = BS && B.byId(BS.st, id); return f && f.side === 1 ? -1 : 1; }
const ELC = { ember: '#ff7a2a', tide: '#2fa6ff', bloom: '#4fd35a', volt: '#ffd21f', stone: '#e0a860', shade: '#9d8bff' };
function animRig(id, frames, ms, easing, fill) {
  const r = rigOf(id); if (!r) return Promise.resolve();
  return r.animate(frames, { duration: ms, easing: easing || 'ease-out', fill: fill || 'none' }).finished.catch(() => {});
}
// kind: melee | ranged | buff | ult
function animAttack(id, kind, el, ms) {
  const d = faceOf(id), c = ELC[el] || '#fff', glow = `drop-shadow(0 0 14px ${c}) drop-shadow(0 0 4px #fff)`, none = 'drop-shadow(0 0 0 transparent)';
  if (kind === 'melee') return animRig(id, [
    { transform: 'none' },
    { transform: `translateX(${-6 * d}%) rotate(${-8 * d}deg) scale(1.08, .86)`, offset: 0.25 },          // crouch and coil
    { transform: `translateX(${6 * d}%) translateY(-10%) rotate(${10 * d}deg) scale(.92, 1.12)`, offset: 0.45 }, // leap
    { transform: `translateX(${10 * d}%) rotate(${14 * d}deg) scale(1.16, .9)`, offset: 0.55 },             // strike
    { transform: `rotate(${-3 * d}deg) scale(.97, 1.03)`, offset: 0.8 },
    { transform: 'none' }], ms, 'ease-in-out');
  if (kind === 'ranged') return animRig(id, [
    { transform: 'none', filter: none },
    { transform: `translateX(${-7 * d}%) rotate(${-10 * d}deg) scale(.95, 1.08)`, filter: glow, offset: 0.4 },   // rear back, charge
    { transform: `translateX(${7 * d}%) rotate(${6 * d}deg) scale(1.1, .94)`, filter: glow, offset: 0.55 },      // fire
    { transform: `translateX(${-3 * d}%) scale(.98, 1.02)`, filter: none, offset: 0.78 },                          // recoil
    { transform: 'none', filter: none }], ms, 'ease-in-out');
  if (kind === 'ult') return animRig(id, [
    { transform: 'none', filter: none },
    { transform: 'translateY(4%) scale(1.15, .8)', filter: glow, offset: 0.2 },
    { transform: `translateY(-16%) rotate(${-6 * d}deg) scale(1.2)`, filter: glow, offset: 0.5 },
    { transform: `translateY(-12%) rotate(${6 * d}deg) scale(1.25)`, filter: glow, offset: 0.7 },
    { transform: 'translateY(2%) scale(1.1, .9)', filter: none, offset: 0.88 },
    { transform: 'none', filter: none }], ms, 'ease-in-out');
  return animRig(id, [                                                                             // buff / heal / shield
    { transform: 'none', filter: none },
    { transform: 'translateY(3%) scale(1.12, .85)', offset: 0.2 },
    { transform: 'translateY(-14%) scale(.94, 1.1)', filter: glow, offset: 0.5 },
    { transform: 'translateY(2%) scale(1.1, .9)', filter: glow, offset: 0.75 },
    { transform: 'none', filter: none }], ms, 'ease-in-out');
}
// knocked away from the attacker; crits hit harder and shake the arena
function animHit(id, attackerId, crit, dot) {
  const d = attackerId != null ? (faceOf(attackerId) || 1) : -faceOf(id);
  const k = crit ? 16 : 8;
  const flash = dot === 'burn' ? 'brightness(1.6) sepia(1) saturate(5) hue-rotate(-25deg)' : dot === 'poison' ? 'brightness(1.3) sepia(1) saturate(4) hue-rotate(230deg)'
    : dot ? 'brightness(1.8)' : 'brightness(3) saturate(0)';
  if (crit) arena.animate([{ transform: 'none' }, { transform: 'translate(-7px,4px)' }, { transform: 'translate(6px,-4px)' }, { transform: 'translate(-3px,2px)' }, { transform: 'none' }], { duration: 300 });
  if (dot) return animRig(id, [{ transform: 'none', filter: 'none' }, { transform: 'scale(1.05, .93)', filter: flash, offset: 0.3 }, { transform: 'scale(.98, 1.02)', filter: 'none', offset: 0.7 }, { transform: 'none', filter: 'none' }], 320);
  return animRig(id, [
    { transform: 'none', filter: 'none' },
    { transform: `translateX(${k * d}%) rotate(${(crit ? 16 : 9) * d}deg) scale(.9, 1.06)`, filter: flash, offset: 0.12 },
    { transform: `translateX(${k * 0.9 * d}%) rotate(${6 * d}deg) scale(1.06, .92)`, filter: 'none', offset: 0.35 },
    { transform: `translateX(${-2 * d}%) rotate(${-3 * d}deg)`, offset: 0.7 },
    { transform: 'none', filter: 'none' }], crit ? 520 : 400);
}
function animDodge(id, attackerId) {
  const d = attackerId != null ? faceOf(attackerId) : -faceOf(id);
  return animRig(id, [{ transform: 'none', opacity: 1 }, { transform: `translateX(${14 * d}%) translateY(-8%) rotate(${-8 * d}deg)`, opacity: 0.6, offset: 0.35 }, { transform: 'none', opacity: 1 }], 380, 'ease-in-out');
}
function animKO(id) {
  const d = -faceOf(id);   // topples backwards
  return animRig(id, [{ transform: 'none', filter: 'none' }, { transform: `translateY(-6%) rotate(${-10 * d}deg)`, filter: 'brightness(2)', offset: 0.2 },
    { transform: `translateX(${10 * d}%) translateY(12%) rotate(${75 * d}deg) scale(.9)`, filter: 'grayscale(1) brightness(.6)' }], 520, 'ease-in', 'forwards');
}
function animHeal(id) {
  return animRig(id, [{ transform: 'none', filter: 'none' }, { transform: 'translateY(-6%) scale(1.04)', filter: 'drop-shadow(0 0 12px #6bff8f) brightness(1.25)', offset: 0.4 }, { transform: 'none', filter: 'none' }], 420);
}
function banner(text, el) {
  const b = document.createElement('div');
  b.className = 'banner' + (el ? ' el-' + el : '');
  b.textContent = text; arena.appendChild(b); setTimeout(() => b.remove(), 1150);
}

async function play(ev) {
  const st = BS.st, sp = () => 1 / BS.speed;
  const F = id => B.byId(st, id);
  const disp = BS.disp;
  for (const e of ev) {
    if (e.k === 'turn') { const t = $('#turnPill'); if (t) t.textContent = 'Turn ' + e.n; }
    else if (e.k === 'act') {
      const a = F(e.a); if (!a) continue;
      const sk = G.SK[e.sk];
      if (e.ult) {
        arena.classList.add('ult'); SFX.ult();
        const el = monEl(e.a); if (el) el.classList.add('actor');
        banner(e.n, e.el);
        await animAttack(e.a, 'ult', e.el, 950 * sp());
        arena.classList.remove('ult'); if (el) el.classList.remove('actor');
      } else pop(e.a, e.n, 'small', -14);
      const foeT = e.tg.filter(id => F(id) && F(id).side !== a.side);
      if (foeT.length && sk.pow) {
        if (!sk.rng && !e.aoe && sk.t === 'foe') {
          // melee: the body dashes in while the rig coils and strikes
          await Promise.all([lunge(e.a, foeT[0], 520 * sp()), e.ult ? null : animAttack(e.a, 'melee', e.el, 520 * sp())]);
        } else {
          // ranged / area: rear back, then the shots leave at the release
          const cast = e.ult ? Promise.resolve() : animAttack(e.a, 'ranged', e.el, 480 * sp());
          await sleep(220 * sp());
          await Promise.all([cast, ...foeT.map(t => fxOrb(e.a, t, e.el, 260 * sp()))]);
        }
        foeT.forEach(t => fxBurst(t, e.el));
      } else if (e.tg.length) {
        if (!e.ult) animAttack(e.a, 'buff', e.el, 460 * sp());
        await sleep(200 * sp());
        e.tg.forEach(t => fxBurst(t, e.el)); await sleep(260 * sp());
      }
      else await sleep(200 * sp());
    }
    else if (e.k === 'aim') { const el = F(e.a) ? F(e.a).el : 'shade'; animAttack(e.a, 'ranged', el, 300 * sp()); await sleep(110 * sp()); await fxOrb(e.a, e.t, el, 180 * sp()); fxBurst(e.t, el); }
    else if (e.k === 'dmg') {
      const f = F(e.t); if (!f) continue;
      animHit(e.t, e.dot ? null : e.a, e.crit, e.dot);
      const cls = e.dot ? 'small' : e.crit ? 'crit' : '';
      pop(e.t, (e.crit ? 'CRIT ' : '') + e.v, cls);
      if (!e.dot && !e.thorn && e.eff > 1) pop(e.t, 'Super effective!', 'eff', 9);
      if (!e.dot && !e.thorn && e.eff < 1) pop(e.t, 'Resisted', 'eff', 9);
      if (e.crit) SFX.crit(); else SFX.hit();
      setHud(f, e.hp, e.sh);
      await sleep((e.dot ? 120 : 200) * sp());
    }
    else if (e.k === 'miss') { pop(e.t, e.dodge ? 'Dodged' : 'Miss', 'miss'); animDodge(e.t, e.a); SFX.miss(); await sleep(200 * sp()); }
    else if (e.k === 'heal') { const f = F(e.t); if (f) { pop(e.t, '+' + e.v, 'heal'); if (e.v > 0) animHeal(e.t); setHud(f, e.hp, e.sh); SFX.heal(); await sleep(130 * sp()); } }
    else if (e.k === 'shield') { const f = F(e.t); if (f) { pop(e.t, '+' + e.v + ' shield', 'shield'); setHud(f, null, e.sh); await sleep(110 * sp()); } }
    else if (e.k === 'status') { const f = F(e.t); if (f) { const el = monEl(e.t); if (el) el.querySelector('.sts').innerHTML = stsHtml(f); if (!e.haz && ST_LABEL[e.s]) pop(e.t, ST_LABEL[e.s], 'small', 6); await sleep(70 * sp()); } }
    else if (e.k === 'react') { pop(e.t, e.name, 'react', -6); SFX.react(); await sleep(380 * sp()); }
    else if (e.k === 'ko') { SFX.ko(); await animKO(e.t); const el = monEl(e.t); if (el) el.classList.add('dead'); await sleep(120 * sp()); }
    else if (e.k === 'revive') { const el = monEl(e.t); const f = F(e.t); if (el) { el.classList.remove('dead'); const r = el.querySelector('.rig'); if (r) r.getAnimations().forEach(a => a.cancel()); animHeal(e.t); } if (f) setHud(f, e.hp, 0); pop(e.t, e.name, 'react'); SFX.heal(); await sleep(400 * sp()); }
    else if (e.k === 'summon') {
      const f = F(e.f.id); if (!f) continue;
      arena.querySelectorAll(`.mon.side${f.side}.dead`).forEach(m => { const o = F(+m.dataset.id); if (!o || o.slot === f.slot) m.remove(); });
      arena.insertAdjacentHTML('beforeend', monHtml(f, st)); syncMon(f);
      pop(f.id, 'Joins the fight!', 'small'); await sleep(320 * sp());
    }
    else if (e.k === 'skip') { pop(e.a, e.why, 'miss'); await sleep(260 * sp()); }
    else if (e.k === 'od') { const el = monEl(e.t); const od = el && el.querySelector('.bar.od i'); if (od) od.style.width = e.v + '%'; }
    else if (e.k === 'flux') { const el = monEl(e.t); if (el) el.querySelector('.nm img').src = IMG('el_' + e.el); pop(e.t, '→ ' + G.EL[e.el].name, 'small', -8); }
    else if (e.k === 'text') { $('#cmdHint').textContent = e.v; }
    else if (e.k === 'cleanse') { pop(e.t, 'Cleansed', 'heal'); const f = F(e.t); const el = monEl(e.t); if (f && el) el.querySelector('.sts').innerHTML = stsHtml(f); }
  }
  void disp;
}
function setHud(f, hp, sh) {
  const el = monEl(f.id); if (!el) return;
  const bars = el.querySelectorAll('.bar.hp i');
  if (hp != null) { bars[0].style.width = (100 * hp / f.maxHp) + '%'; bars[0].className = hpClass(hp / f.maxHp); }
  if (sh != null) bars[1].style.width = Math.min(100, 100 * sh / f.maxHp) + '%';
}

function startBattle(node, enemiesOverride, onWin) {
  run.pendingBattle = enemiesOverride ? null : node.id;
  save();
  const enemies = (enemiesOverride || R.encounter(run, node)).map(e => JSON.parse(JSON.stringify(e)));
  const seed = (run.seed * 31 + run.step * 977 + Date.now() % 100000) >>> 0;
  const st = B.create(R.battleOpts(run, enemies, seed));
  BS = { st, node, plans: {}, auto: meta.auto, speed: meta.speed || 1, busy: false, disp: {}, onWin };
  show('battle');
  renderArena();
  replan();
  renderCmd();
  const bi = G.BIOMES[st.biome];
  if (node.type === 'boss') banner(st.f.find(f => f.boss).name, G.BOSSES[st.f.find(f => f.boss).boss].el);
  else if (node.type === 'elite') banner('Elite battle!', 'ember');
  $('#cmdHint').textContent = `${bi.hazName}: ${bi.hazDesc}`;
  play(st.startEv).then(() => { if (BS && BS.auto) setTimeout(fight, 600); });
}
function replan() {
  const st = BS.st;
  for (const f of B.alive(st, 0)) {
    const p = BS.plans[f.id];
    if (!p || !B.skillReady(f, p.sk) || !f.sk.includes(p.sk) || BS.auto) BS.plans[f.id] = B.autoPlan(st, f);
  }
}
function renderCmd() {
  const st = BS.st;
  const allies = st.f.filter(f => f.side === 0).sort((a, b) => a.slot - b.slot);
  $('#cmdRows').innerHTML = allies.map(f => {
    const chips = f.sk.map(id => {
      const sk = G.SK[id], ready = B.skillReady(f, id), sel = BS.plans[f.id] && BS.plans[f.id].sk === id;
      const el = sk.el === 'flux' ? f.el : sk.el;
      const cd = !sk.ult && f.cds[id] > 0 ? `<span class="cdn">${f.cds[id]}</span>` : '';
      const sub = sk.ult ? (ready ? 'READY!' : Math.floor(f.od) + '%') : skillTag(sk).replace('ULT · ', '');
      return `<button class="chip el-${el} ${sk.ult ? 'ult' : ''} ${ready ? '' : 'cd'} ${sel ? 'sel' : ''}" data-f="${f.id}" data-sk="${id}">${esc(sk.n)}<small>${sub}</small>${cd}</button>`;
    }).join('');
    return `<div class="crow ${f.alive ? '' : 'dead'}"><div class="who"><img class="${f.shiny ? 'shiny' : ''}" src="${IMG(f.art)}" alt=""><span>${esc(f.name)}</span></div><div class="chips">${chips}</div></div>`;
  }).join('');
  const battleItems = Object.keys(run.items).filter(k => G.ITEMS[k] && G.ITEMS[k].battle && run.items[k] > 0);
  $('#cmdFoot').innerHTML = `<button class="btn ghost sm" data-c="items" ${battleItems.length && !st.itemUsed ? '' : 'disabled'}>Items</button>
    <button class="btn sm ghost toggle ${BS.auto ? 'on' : ''}" data-c="auto">Auto</button>
    <button class="btn sm ghost" data-c="speed">${BS.speed}×</button><div class="grow"></div>
    <button class="btn green" data-c="fight" ${BS.busy ? 'disabled' : ''}>${BS.busy ? '...' : 'FIGHT!'}</button>`;
}
$('#cmdRows').addEventListener('click', e => {
  const c = e.target.closest('.chip'); if (!c || !BS || BS.busy) return;
  SFX.click();
  const f = B.byId(BS.st, +c.dataset.f), sk = G.SK[c.dataset.sk];
  BS.plans[f.id] = { sk: sk.id };
  $('#cmdHint').textContent = `${f.name}: ${sk.n} — ${sk.d}`;
  renderCmd();
});
$('#cmdFoot').addEventListener('click', async e => {
  const c = e.target.closest('[data-c]'); if (!c || !BS) return;
  SFX.click();
  const v = c.dataset.c;
  if (v === 'fight') fight();
  else if (v === 'auto') { BS.auto = !BS.auto; meta.auto = BS.auto; save(); renderCmd(); if (BS.auto && !BS.busy) fight(); }
  else if (v === 'speed') { BS.speed = BS.speed >= 3 ? 1 : BS.speed + 1; meta.speed = BS.speed; save(); renderCmd(); }
  else if (v === 'items' && !BS.busy) battleItem();
});
arena.addEventListener('click', e => {
  const m = e.target.closest('.mon.side1'); if (!m || !BS) return;
  const id = +m.dataset.id;
  BS.st.focus = BS.st.focus === id ? null : id;
  BS.st.f.forEach(syncMon);
  const f = B.byId(BS.st, id);
  $('#cmdHint').textContent = BS.st.focus ? `Focus: single-target attacks aim at ${f.name} when they can reach it.` : 'Focus cleared: your creatures pick their own targets.';
});
async function battleItem() {
  const st = BS.st;
  const ks = Object.keys(run.items).filter(k => G.ITEMS[k] && G.ITEMS[k].battle && run.items[k] > 0);
  const v = await ask('Use an item', `<div class="list">${ks.map(k => `<div class="li click" data-v="${k}"><img class="ic" src="${IMG('it_' + k)}" alt=""><div class="grow"><div class="t">${G.ITEMS[k].n} ×${run.items[k]}</div><div class="small muted">${G.ITEMS[k].d}</div></div></div>`).join('')}</div>`, btn('x', 'Cancel', 'ghost sm'));
  if (v === 'x' || !G.ITEMS[v]) return;
  let tgt = null;
  if (v === 'berry' || v === 'revive') {
    const cand = st.f.filter(f => f.side === 0 && (v === 'revive' ? !f.alive : f.alive && f.hp < f.maxHp));
    if (!cand.length) { toast(v === 'revive' ? 'Nobody needs reviving.' : 'Everyone is healthy.'); return; }
    const t = await ask('On whom?', `<div class="list">${cand.map(f => `<div class="li click" data-v="${f.id}"><img class="ic" src="${IMG(f.art)}" alt=""><div class="grow"><div class="t">${esc(f.name)}</div>${bar(f.hp / f.maxHp)}</div></div>`).join('')}</div>`, btn('x', 'Cancel', 'ghost sm'));
    if (t === 'x') return;
    tgt = +t;
  }
  if (v === 'smoke' && st.f.some(f => f.boss)) { toast('You cannot flee from a boss!'); return; }
  const ev = B.useItem(st, v, tgt);
  if (!ev) return;
  run.items[v]--; if (!run.items[v]) delete run.items[v];
  BS.busy = true; renderCmd();
  await play(ev);
  BS.busy = false;
  if (st.over) return finishBattle();
  st.f.forEach(syncMon); renderCmd();
}
async function fight() {
  if (!BS || BS.busy || BS.st.over) return;
  BS.busy = true; renderCmd();
  const st = BS.st;
  if (BS.auto) replan();
  const ev = B.round(st, Object.assign({}, BS.plans));
  await play(ev);
  st.f.forEach(syncMon);
  BS.busy = false;
  if (st.over) return finishBattle();
  replan();
  renderCmd();
  if (BS.auto) setTimeout(() => { if (BS && BS.auto && !BS.busy) fight(); }, 350 / BS.speed);
}
async function finishBattle() {
  const st = BS.st, node = BS.node, onWin = BS.onWin;
  run.pendingBattle = null;
  await sleep(500);
  if (st.over === 3) { B.writeBack(st); BS = null; save(); renderMap(); toast('You slipped away in the smoke.'); return; }
  R.afterBattle(run, st);
  if (st.over === 2 || R.partyWiped(run)) { BS = null; return gameOver(false); }
  BS = null;
  if (onWin) {
    const rw = R.rewards(run, st, { type: 'battle' });
    run.gold += rw.gold;
    R.grantXp(run, rw.xp, st.f.filter(f => f.side === 0).map(f => f.inst.uid));
    show('map'); renderMap();
    toast(`+${rw.gold} gold · +${rw.xp} XP`);
    await evolutions();
    await onWin(st); save(); return renderMap();
  }
  await victoryFlow(st, node);
}
async function victoryFlow(st, node) {
  const rw = R.rewards(run, st, node);
  run.gold += rw.gold;
  const fought = st.f.filter(f => f.side === 0).map(f => f.inst.uid);
  const before = run.party.map(p => ({ uid: p.uid, lvl: p.lvl, xp: p.xp }));
  const res = R.grantXp(run, rw.xp, fought);
  SFX.coin();
  const rows = run.party.map(p => {
    const r = res.find(x => x.uid === p.uid), b = before.find(x => x.uid === p.uid);
    const up = r && r.to > r.from;
    return `<div class="xprow">${monImg(p)}<div class="grow"><div class="row"><b class="fred">${esc(B.instName(p))}</b><span class="muted small">L${b.lvl}${up ? ' → ' : ''}</span>${up ? `<span class="lvup">L${p.lvl}!</span>` : ''}<span class="grow"></span><span class="small muted">+${r ? r.xp : 0} XP</span></div>${bar(p.xp / R.xpNeed(p.lvl), 'xp')}${bar(p.hpPct)}</div></div>`;
  }).join('');
  if (res.some(r => r.to > r.from)) setTimeout(SFX.lvl, 250);
  show('map'); renderMap();
  await ask(node.type === 'boss' ? 'Boss defeated!' : 'Victory!', `<div class="row center" style="gap:16px;margin-bottom:8px"><span class="pill"><img src="${IMG('ui_gold')}" alt="">+${rw.gold}</span><span class="pill">+${rw.xp} XP</span></div>${rows}`, btn('ok', 'Continue', 'green'));
  await evolutions();
  if (rw.recruit.length) await recruitFlow(rw.recruit, 'A wild creature wants to join!');
  if (rw.relics.length) await relicPick(rw.relics, node.type === 'boss' ? 'Boss treasure' : 'Elite treasure');
  if (node.type === 'boss') {
    R.bossCleared(run);
    if (rw.perk && rw.perk.length) {
      const k = await ask('Tamer perk', `<p class="muted" style="text-align:center">Your own skills grow. Pick one.</p><div class="cards">${rw.perk.map(k => `<div class="card" data-v="${k}"><h3>${G.PERKS[k].n}</h3><p>${G.PERKS[k].d}</p></div>`).join('')}</div>`);
      R.takePerk(run, k);
    }
    if (run.act === 3) return gameOver(true);
    const opts = G.ACTS[run.act + 1];
    const b = opts.length === 1 ? opts[0] : await ask('Choose your path', `<div class="cards">${opts.map(k => { const bi = G.BIOMES[k]; return `<div class="card" data-v="${k}"><div class="art" style="height:110px"><img src="${IMG(bi.bg)}" alt="" style="border-radius:12px;max-height:110px"></div><h3>${bi.name}</h3><p><b style="color:var(--gold)">${bi.hazName}</b>: ${bi.hazDesc}</p><p>Counter: ${bi.counter}</p><p>Foes: ${Array.from(new Set(bi.els)).map(e => G.EL[e].name).join(', ')}</p></div>`; }).join('')}</div>`);
    R.nextAct(run, b);
    save(); renderMap();
    toast('Act ' + (run.act + 1) + ': ' + G.BIOMES[run.biome].name);
    return;
  }
  save(); renderMap();
}
async function evolutions() {
  for (const p of run.party) {
    while (R.canEvolve(run, p)) { const did = await evolveFlow(p); if (!did) break; }
  }
}
async function evolveFlow(p) {
  const S = G.SP[p.sp];
  const go = await ask(`${S.names[p.stage - 1]} is evolving!`, `<div class="evo-stage"><div class="glow"></div>${monImg(p)}</div>`, btn('later', 'Not yet', 'ghost') + btn('go', 'Evolve!', 'green'));
  if (go !== 'go') return false;
  const opts = R.mutOptions(run, p);
  // flash to the new form
  modal('...', `<div class="evo-stage"><div class="glow"></div><img src="${IMG(B.instArt(p))}" class="${p.shiny ? 'shiny' : ''}" style="filter:brightness(5)"></div>`);
  SFX.ult(); await sleep(700);
  const nextArt = 'cr_' + p.sp + (p.stage + 1);
  MB.querySelector('.evo-stage img').src = IMG(nextArt);
  await sleep(500);
  MB.querySelector('.evo-stage img').style.filter = '';
  SFX.lvl(); await sleep(500);
  const ult = p.stage === 1 ? `<p style="text-align:center">New ultimate: <b>${G.SK[S.sk[3]].n}</b> — ${G.SK[S.sk[3]].d}</p>` : '<p style="text-align:center">Every skill hits 12% harder.</p>';
  const m = await ask(`It became ${S.names[p.stage]}!`, `<div class="evo-stage" style="height:200px"><img src="${IMG(nextArt)}" class="${p.shiny ? 'shiny' : ''}" style="max-height:190px"></div>${ult}<p class="muted" style="text-align:center">Choose a mutation:</p><div class="cards">${opts.map(k => `<div class="card" data-v="${k}"><h3>${G.MUTS[k].n}</h3><p>${G.MUTS[k].d}</p></div>`).join('')}</div>`);
  R.evolve(run, p, m);
  meta.dex[p.sp] = Math.max(meta.dex[p.sp] || 0, p.stage);
  if (p.el2) toast(`${B.instName(p)} also counts as ${G.EL[p.el2].name} now!`);
  save();
  return true;
}
function monCard(inst, v, extra) {
  const S = G.SP[inst.sp];
  return `<div class="card el-${S.el}" data-v="${v}"><div class="art">${monImg(inst)}</div><h3>${esc(B.instName(inst))}${inst.shiny ? ' ✦' : ''}</h3>
    <div class="row center" style="margin-top:4px">${elBadge(S.el)}<span class="tag">${ROLE_N[S.role]}</span><span class="tag">L${inst.lvl}</span></div>
    <p>${B.knownSkills(inst).map(id => G.SK[id].n).join(' · ')}</p>${extra || ''}</div>`;
}
async function recruitFlow(list, title) {
  const v = await ask(title, `<div class="cards">${list.map((p, i) => monCard(p, i)).join('')}</div>`, btn('skip', 'No thanks', 'ghost'));
  if (v === 'skip') return;
  const inst = list[+v];
  if (run.party.length >= R.partyCap(run)) {
    const r = await ask('Your party is full', `<p style="text-align:center">Release someone to make room?</p><div class="list">${run.party.map(p => `<div class="li click" data-v="${p.uid}">${monImg(p, 'ic')}<div class="grow"><div class="t">${esc(B.instName(p))} L${p.lvl}</div></div></div>`).join('')}</div>`, btn('x', 'Keep my party', 'ghost'));
    if (r === 'x') return;
    R.release(run, +r);
  }
  R.recruit(run, inst);
  meta.caught[inst.sp] = 1;
  SFX.lvl();
  toast(B.instName(inst) + ' joined your party!');
  save();
}
function relicLi(id, v) {
  const r = G.RELICS[id];
  return `<div class="li click ${r.leg ? 'leg' : ''}" data-v="${v == null ? id : v}"><img class="ic" src="${IMG('rl_' + id)}" alt=""><div class="grow"><div class="t">${r.n}</div><div class="small">${r.d}</div><div class="row wrap" style="gap:4px;margin-top:3px">${r.tags.map(t => `<span class="tag">${t}</span>`).join('')}</div></div></div>`;
}
async function relicPick(list, title) {
  const c = B.relicTagCounts(run.relics);
  const hint = list.map(id => G.RELICS[id].tags.filter(t => c[t] === 2 && G.SETS[t]).map(t => `Taking ${G.RELICS[id].n} completes the <b>${G.SETS[t].n}</b> set: ${G.SETS[t].d}`)).flat();
  const fuse = list.map(id => G.FUSIONS.filter(f => (f[0] === id && run.relics.includes(f[1])) || (f[1] === id && run.relics.includes(f[0]))).map(f => `${G.RELICS[id].n} can fuse into <b>${G.RELICS[f[2]].n}</b> at a campfire or forge.`)).flat();
  const v = await ask(title || 'Choose a relic', `<div class="list">${list.map(id => relicLi(id)).join('')}</div>${hint.concat(fuse).map(h => `<p class="small" style="color:var(--gold);margin:8px 4px 0">${h}</p>`).join('')}`, btn('skip', 'Skip', 'ghost sm'));
  if (v !== 'skip' && G.RELICS[v]) { R.addRelic(run, v); SFX.coin(); toast('Got ' + G.RELICS[v].n); }
}

// ---- nodes -------------------------------------------------------------------------------
async function treasure() {
  SFX.coin();
  await relicPick(R.relicChoices(run, 3), 'Treasure!');
}
async function forgeFlow() {
  const fs = R.fusionsAvailable(run);
  if (!fs.length) return false;
  const v = await ask('Forge', `<p class="muted" style="text-align:center">Two relics become one legendary.</p><div class="list">${fs.map((f, i) => `<div class="li click leg" data-v="${i}"><img class="ic" src="${IMG('rl_' + f[2])}" alt=""><div class="grow"><div class="t">${G.RELICS[f[2]].n}</div><div class="small">${G.RELICS[f[2]].d}</div><div class="small muted">Uses ${G.RELICS[f[0]].n} + ${G.RELICS[f[1]].n}</div></div></div>`).join('')}</div>`, btn('x', 'Not now', 'ghost sm'));
  if (v === 'x') return false;
  R.fuse(run, fs[+v]); SFX.ult(); toast('Forged ' + G.RELICS[fs[+v][2]].n + '!');
  return true;
}
async function rest() {
  const canForge = R.fusionsAvailable(run).length > 0;
  const v = await ask('Campfire', `<div class="cards"><div class="card el-ember" data-v="heal"><div class="art"><img class="icon" src="${IMG('node_rest')}"></div><h3>Rest</h3><p>Heal everyone 50% and revive the fallen at 50%.</p></div>
    <div class="card el-volt" data-v="train"><div class="art"><img class="icon" src="${IMG('it_candy')}"></div><h3>Train</h3><p>One creature gains 2 levels.</p></div>
    ${canForge ? `<div class="card el-stone" data-v="forge"><div class="art"><img class="icon" src="${IMG('rl_philosopher')}"></div><h3>Forge</h3><p>Fuse two relics into a legendary.</p></div>` : ''}</div>`);
  if (v === 'heal') { R.restHeal(run); SFX.heal(); toast('Your party feels refreshed.'); }
  else if (v === 'train') {
    const u = await chooseCreature('Who trains?', p => p.lvl < R.LV_CAP);
    if (u != null) { const p = run.party.find(x => x.uid === u); R.levelUp(run, p, 2); SFX.lvl(); toast(B.instName(p) + ' reached L' + p.lvl + '!'); await evolutions(); }
  } else if (v === 'forge') { if (!await forgeFlow()) return rest(); }
}
async function chooseCreature(title, filter) {
  const ps = run.party.filter(filter || (() => true));
  if (!ps.length) { toast('Nobody can do that.'); return null; }
  const v = await ask(title, `<div class="list">${ps.map(p => `<div class="li click" data-v="${p.uid}">${monImg(p, 'ic')}<div class="grow"><div class="t">${esc(B.instName(p))} L${p.lvl}</div>${bar(p.hpPct)}</div></div>`).join('')}</div>`, btn('x', 'Cancel', 'ghost sm'));
  return v === 'x' ? null : +v;
}
async function shop(disc, small) {
  const s = R.shopStock(run, disc);
  if (small) s.items = s.items.filter((_, i) => i % 2 === 0);
  const render = () => {
    const items = s.items.map((it, i) => {
      let img, n, d;
      if (it.kind === 'relic') { img = IMG('rl_' + it.id); n = G.RELICS[it.id].n; d = G.RELICS[it.id].d; }
      else if (it.kind === 'charm') { img = IMG('ch_' + it.id); n = G.CHARMS[it.id].n; d = 'Charm: ' + G.CHARMS[it.id].d; }
      else if (it.kind === 'item') { img = IMG('it_' + it.id); n = G.ITEMS[it.id].n; d = G.ITEMS[it.id].d; }
      else { img = IMG(B.instArt(it.inst)); n = B.instName(it.inst) + ' L' + it.inst.lvl; d = 'A creature for your party.'; }
      return `<div class="shopitem ${it.sold ? 'sold' : ''} ${run.gold < it.price ? 'poor' : ''}" data-v="${i}"><img class="${it.kind === 'egg' ? 'mon' : ''}${it.kind === 'egg' && it.inst.shiny ? ' shiny' : ''}" src="${img}" alt=""><div class="fred">${esc(n)}</div><div class="small muted">${esc(d)}</div><div class="pr">${it.sold ? 'SOLD' : it.price + 'g'}</div></div>`;
    }).join('');
    return `<div class="row center" style="margin-bottom:8px"><span class="pill"><img src="${IMG('ui_gold')}" alt="">${run.gold}</span></div><div class="grid">${items}</div>`;
  };
  const acts = () => btn('heal', `Heal team (${s.heal}g)`, 'blue sm') + (small ? '' : btn('reroll', `Reroll (${s.reroll}g)`, 'ghost sm')) + btn('leave', 'Leave', 'green sm');
  let v;
  while ((v = await modal(small ? 'Caravan' : 'Shop', render(), acts())) !== 'leave') {
    if (v === 'heal') { if (run.gold >= s.heal) { run.gold -= s.heal; for (const p of run.party) p.hpPct = Math.max(p.hpPct, 1); SFX.heal(); toast('Team fully healed.'); } }
    else if (v === 'reroll') { if (run.gold >= s.reroll) { run.gold -= s.reroll; s.reroll += 10; const n = R.shopStock(run, disc); s.items = n.items; } }
    else {
      const it = s.items[+v];
      if (it && it.kind === 'egg' && run.party.length >= R.partyCap(run)) toast('Your party is full.');
      else if (it && R.buy(run, it)) { SFX.coin(); if (it.kind === 'egg') meta.caught[it.inst.sp] = 1; }
      else if (it && !it.sold) toast('Not enough gold.');
    }
  }
  closeModal();
}
async function den(node) {
  await recruitFlow(R.denChoices(run, node), 'A creature den! Pick one to join you');
}
async function eventNode(node) {
  const k = R.eventFor(run, node), E = G.EVENTS[k];
  const v = await ask(E.n, `<p style="text-align:center;font-size:16px">${E.t}</p>`, E.opts.map((o, i) => `<button class="btn ${i ? 'ghost' : ''}" data-v="${i}">${o[0]}${o[1] ? `<br><small style="font:600 12px Nunito">${o[1]}</small>` : ''}</button>`).join(''));
  const o = +v;
  const say = t => ask(E.n, `<p style="text-align:center;font-size:16px">${t}</p>`, btn('ok', 'Continue', 'green'));
  const randRelic = () => { const c = R.relicChoices(run, 1); if (c.length) { R.addRelic(run, c[0]); return c[0]; } return null; };
  if (k === 'shrine' && o === 0) {
    for (const p of run.party) if (p.hpPct > 0) p.hpPct = Math.max(0.01, p.hpPct - 0.2);
    const r = randRelic(); if (r) await ask(E.n, `<p style="text-align:center">The shrine glows. You receive:</p><div class="list">${relicLi(r, 'ok')}</div>`, btn('ok', 'Continue', 'green'));
  } else if (k === 'egg' && o === 0) {
    const lv = Math.max(2, R.floorLevel(run, node) - 1);
    await recruitFlow([R.mkInst(run, R.pick(run, Object.keys(G.SP)), lv)], 'The egg hatches!');
  } else if (k === 'well') {
    if (o === 0) {
      if (run.gold < 30) return say('You do not have 30 gold.');
      run.gold -= 30;
      if (Math.random() < 0.6) { const r = randRelic(); if (r) await ask(E.n, `<p style="text-align:center">Something floats up!</p><div class="list">${relicLi(r, 'ok')}</div>`, btn('ok', 'Continue', 'green')); }
      else await say('The coins sink without a sound.');
    } else { run.gold += 15; SFX.coin(); await say('You fish out 15 gold.'); }
  } else if (k === 'dojo') {
    if (o === 0) {
      const u = await chooseCreature('Who trains?', p => p.hpPct > 0 && p.lvl < R.LV_CAP);
      if (u != null) { const p = run.party.find(x => x.uid === u); R.levelUp(run, p, 2); p.hpPct = Math.max(0.05, p.hpPct - 0.3); SFX.lvl(); await say(`${B.instName(p)} is battered but reached L${p.lvl}!`); await evolutions(); }
    } else { for (const p of run.party) R.addXp(run, p, 25); SFX.lvl(); await say('Everyone learned something. +25 XP each.'); await evolutions(); }
  } else if (k === 'pool') {
    if (o === 0) {
      const u = await chooseCreature('Who drinks?', p => p.muts.length < 4);
      if (u != null) {
        const p = run.party.find(x => x.uid === u);
        const m = R.pick(run, Object.keys(G.MUTS).filter(x => !p.muts.includes(x)));
        p.muts.push(m);
        if (m === 'dual') { const opts = G.ELS.filter(e => e !== G.SP[p.sp].el); p.el2 = R.pick(run, opts); }
        SFX.ult(); await say(`${B.instName(p)} gained <b>${G.MUTS[m].n}</b>: ${G.MUTS[m].d}${p.el2 && m === 'dual' ? ' (' + G.EL[p.el2].name + ')' : ''}`);
      }
    } else { for (const p of run.party) if (p.hpPct > 0) p.hpPct = Math.min(1, p.hpPct + 0.3); SFX.heal(); await say('Everyone feels better.'); }
  } else if (k === 'caravan' && o === 0) await shop(0.25, true);
  else if (k === 'trapped' && o === 0) {
    const lv = R.floorLevel(run, node) + 2;
    const sp = R.pick(run, Object.keys(G.SP));
    const foe = R.mkInst(run, sp, lv, { wild: 1 });
    foe.elite = 'enraged'; foe.scale = 0.9;
    await say(`The ${B.instName(foe)} lashes out!`);
    startBattle(node, [foe], async () => {
      const inst = R.mkInst(run, sp, lv - 1);
      inst.shiny = foe.shiny || Math.random() < 0.1;
      await recruitFlow([inst], 'It calms down and wants to join!');
    });
    return 'battle';
  } else if (k === 'imp' && o === 0) {
    const half = Math.floor(run.gold / 2);
    if (Math.random() < 0.5) { run.gold += half; SFX.coin(); await say(`Heads! You win ${half} gold.`); }
    else { run.gold -= half; SFX.ko(); await say(`Tails. The imp cackles and takes ${half} gold.`); }
  } else if (k === 'library') {
    if (o === 0) {
      if (!run.relics.includes('tome')) { R.addRelic(run, 'tome'); await ask(E.n, `<div class="list">${relicLi('tome', 'ok')}</div>`, btn('ok', 'Continue', 'green')); }
      else { run.gold += 60; SFX.coin(); await say('You find 60 gold tucked between pages.'); }
    } else { for (const p of run.party) if (p.hpPct > 0) p.hpPct = Math.min(1, p.hpPct + 0.2); await say('A good nap. Everyone heals 20%.'); }
  } else if (k === 'forge' && o === 0) {
    if (!await forgeFlow()) {
      if (!run.relics.length) return;
      const g = await ask('Trade a relic', `<p class="muted" style="text-align:center">No recipe fits. Give up a relic to pick from three new ones.</p><div class="list">${run.relics.map(id => relicLi(id)).join('')}</div>`, btn('x', 'Leave', 'ghost sm'));
      if (g !== 'x') { run.relics = run.relics.filter(x => x !== g); await relicPick(R.relicChoices(run, 3, 1), 'The forge offers'); }
    }
  }
}

// ---- team -----------------------------------------------------------------------------------
async function teamScreen() {
  let v;
  const body = () => `<p class="muted small" style="text-align:center;margin:0 0 8px">The first 4 healthy creatures fight: slots 1-2 are the front row (melee hits them first), 3-4 the back row. Tap a creature to manage it.</p>
    <div class="list">${run.party.map((p, i) => `<div class="li click" data-v="${p.uid}">${monImg(p, 'ic')}<div class="grow"><div class="row"><span class="t">${esc(B.instName(p))}</span>${elBadge(G.SP[p.sp].el)}${p.el2 ? elBadge(p.el2) : ''}<span class="tag">L${p.lvl}</span>${i < 4 ? `<span class="tag" style="background:#2fbf5555">${i < 2 ? 'Front' : 'Back'}</span>` : '<span class="tag">Bench</span>'}${R.canEvolve(run, p) ? '<span class="tag" style="background:#ffc93c;color:#3a1d00">EVOLVE</span>' : ''}</div>${bar(p.hpPct)}</div>${p.charm ? `<img class="ic" style="width:32px;height:32px" src="${IMG('ch_' + p.charm)}" alt="">` : ''}</div>`).join('')}</div>
    <p class="small muted" style="text-align:center">Party ${run.party.length}/${R.partyCap(run)}</p>`;
  while ((v = await modal('Your team', body(), btn('close', 'Close', 'green sm'))) !== 'close') { closeModal(); await teamDetail(+v, true); }
  closeModal();
  if (run && $('#map').classList.contains('on')) renderMap();
}
async function teamDetail(uid, fromList) {
  let p;
  while ((p = run.party.find(x => x.uid === uid))) {
    const S = G.SP[p.sp], s = B.instStats(p, R.bonus(run)), known = B.knownSkills(p);
    const idx = run.party.indexOf(p);
    const skl = S.sk.map((id, i) => {
      const sk = G.SK[id], has = known.includes(id);
      const req = i === 3 ? 'Unlocks when it evolves' : i === 2 ? 'Learned at L' + G.SKILL_LV[2] : '';
      return `<div class="skl el-${sk.el} ${has ? '' : 'locked'}"><span class="t">${sk.n}</span> <span class="small muted">${skillTag(sk)}</span><div class="small">${sk.d}${has ? '' : ' <i>(' + req + ')</i>'}</div></div>`;
    }).join('');
    const nextEvo = p.stage < 3 ? `Evolves into ${S.names[p.stage]} at L${B.evoLevel(p.stage, R.bonus(run))}` : 'Final form';
    const body = `<div class="detail"><div class="big el-${S.el}">${monImg(p)}</div><div>
      <div class="row wrap">${elBadge(S.el)}${p.el2 ? elBadge(p.el2) + '<span class="small muted">Dual</span>' : ''}<span class="tag">${ROLE_N[S.role]}</span><span class="tag">L${p.lvl}</span>${p.shiny ? '<span class="tag" style="background:#6a5bff">Shiny +10%</span>' : ''}<span class="small muted">${nextEvo}</span></div>
      <div style="margin-top:6px">${bar(p.hpPct)}<div class="small muted" style="margin-top:3px">HP ${Math.round(s.hp * p.hpPct)}/${s.hp} · XP ${p.xp}/${R.xpNeed(p.lvl)}</div>${bar(p.xp / R.xpNeed(p.lvl), 'xp')}</div>
      <div class="stats"><div>HP<b>${s.hp}</b></div><div>ATK<b>${Math.round(s.atk)}</b></div><div>DEF<b>${Math.round(s.def)}</b></div><div>SPD<b>${Math.round(s.spd)}</b></div></div>
      <div class="small">Strong vs ${G.STRONG[S.el].map(e => G.EL[e].name).join(', ')} · Weak to ${G.ELS.filter(e => G.STRONG[e].includes(S.el)).map(e => G.EL[e].name).join(', ')}</div>
      ${p.muts.length ? `<div class="small" style="margin-top:4px">Mutations: ${p.muts.map(m => `<b>${G.MUTS[m].n}</b> (${G.MUTS[m].d})`).join(', ')}</div>` : ''}
      <div class="li" style="margin-top:8px">${p.charm ? `<img class="ic" src="${IMG('ch_' + p.charm)}" alt=""><div class="grow"><div class="t">${G.CHARMS[p.charm].n}</div><div class="small">${G.CHARMS[p.charm].d}</div></div>` : '<div class="grow muted">No charm held</div>'}<button class="btn sm ghost" data-v="charm">Change</button></div>
      </div></div><div style="margin-top:10px">${skl}</div>`;
    const acts = (R.canEvolve(run, p) ? btn('evo', 'Evolve!', 'green sm') : '') + (idx > 0 ? btn('up', '▲ Move up', 'ghost sm') : '') + (idx < run.party.length - 1 ? btn('down', '▼ Move down', 'ghost sm') : '') +
      btn('item', 'Use item', 'blue sm') + (run.party.length > 1 ? btn('rel', 'Release', 'ghost sm') : '') + btn('back', fromList ? 'Back' : 'Close', 'sm');
    const v = await modal(esc(B.instName(p)), body, acts);
    closeModal();
    if (v === 'back') break;
    if (v === 'up' || v === 'down') { const j = idx + (v === 'up' ? -1 : 1); [run.party[idx], run.party[j]] = [run.party[j], run.party[idx]]; }
    else if (v === 'evo') await evolveFlow(p);
    else if (v === 'rel') { if (await ask('Release ' + esc(B.instName(p)) + '?', '<p style="text-align:center">It returns to the wild. Its charm goes back to your bag.</p>', btn('n', 'Keep', 'green') + btn('y', 'Release', 'ghost')) === 'y') { R.release(run, p.uid); break; } }
    else if (v === 'charm') {
      const c = await ask('Give a charm', `<div class="list">${Array.from(new Set(run.charms)).map(k => `<div class="li click" data-v="${k}"><img class="ic" src="${IMG('ch_' + k)}" alt=""><div class="grow"><div class="t">${G.CHARMS[k].n} ×${run.charms.filter(x => x === k).length}</div><div class="small">${G.CHARMS[k].d}</div></div></div>`).join('') || '<p class="muted" style="text-align:center">No spare charms. Shops sell them.</p>'}</div>`, (p.charm ? btn('none', 'Take it off', 'ghost sm') : '') + btn('x', 'Cancel', 'sm'));
      if (c === 'none') R.equipCharm(run, p.uid, null); else if (c !== 'x') R.equipCharm(run, p.uid, c);
    } else if (v === 'item') {
      const ks = Object.keys(run.items).filter(k => ['berry', 'revive', 'candy', 'evo'].includes(k));
      const it = await ask('Use an item on ' + esc(B.instName(p)), `<div class="list">${ks.map(k => `<div class="li click" data-v="${k}"><img class="ic" src="${IMG('it_' + k)}" alt=""><div class="grow"><div class="t">${G.ITEMS[k].n} ×${run.items[k]}</div><div class="small">${G.ITEMS[k].d}</div></div></div>`).join('') || '<p class="muted" style="text-align:center">No usable items.</p>'}</div>`, btn('x', 'Cancel', 'sm'));
      if (it !== 'x') {
        const r = R.useItemOutside(run, it, p.uid);
        if (!r) toast('That has no effect right now.');
        else { SFX.lvl(); if (r.evo || r.to) await evolutions(); }
      }
    }
    save();
  }
  save();
  if (!fromList && $('#map').classList.contains('on')) renderMap();
}

// ---- bag ------------------------------------------------------------------------------------
async function bagScreen() {
  const c = B.relicTagCounts(run.relics);
  const sets = Object.keys(G.SETS).filter(t => c[t]).map(t => `<div class="li"><div class="grow"><span class="t">${G.SETS[t].n}</span> <span class="tag">${t}</span> <b style="color:${c[t] >= 3 ? 'var(--good)' : 'var(--dim)'}">${Math.min(c[t], 3)}/3</b><div class="small ${c[t] >= 3 ? '' : 'muted'}">${G.SETS[t].d}</div></div></div>`).join('');
  const recipes = G.FUSIONS.filter(f => run.relics.includes(f[0]) || run.relics.includes(f[1])).map(f => `<div class="li leg"><img class="ic" src="${IMG('rl_' + f[2])}" alt=""><div class="grow"><div class="t">${G.RELICS[f[2]].n}</div><div class="small">${G.RELICS[f[0]].n} ${run.relics.includes(f[0]) ? '✔' : '✘'} + ${G.RELICS[f[1]].n} ${run.relics.includes(f[1]) ? '✔' : '✘'}</div><div class="small muted">${G.RELICS[f[2]].d}</div></div></div>`).join('');
  const items = Object.keys(run.items).map(k => `<div class="li"><img class="ic" src="${IMG('it_' + k)}" alt=""><div class="grow"><div class="t">${G.ITEMS[k].n} ×${run.items[k]}</div><div class="small">${G.ITEMS[k].d}</div></div></div>`).join('');
  const charms = Array.from(new Set(run.charms)).map(k => `<div class="li"><img class="ic" src="${IMG('ch_' + k)}" alt=""><div class="grow"><div class="t">${G.CHARMS[k].n} ×${run.charms.filter(x => x === k).length}</div><div class="small">${G.CHARMS[k].d} Give it to a creature from the team screen.</div></div></div>`).join('');
  const perks = Object.keys(run.perks).map(k => `<span class="tag" title="${esc(G.PERKS[k].d)}">${G.PERKS[k].n}</span>`).join(' ');
  await ask('Bag', `<h3>Relics (${run.relics.length})</h3><div class="list" style="margin:6px 0 12px">${run.relics.map(id => relicLi(id, 'r')).join('') || '<p class="muted">None yet. Elites, bosses, treasure and shops give relics.</p>'}</div>
    ${sets ? `<h3>Set bonuses</h3><p class="small muted" style="margin:2px 0 6px">Three relics with the same tag light up a set.</p><div class="list" style="margin-bottom:12px">${sets}</div>` : ''}
    ${recipes ? `<h3>Fusion recipes</h3><div class="list" style="margin:6px 0 12px">${recipes}</div>` : ''}
    <h3>Items</h3><div class="list" style="margin:6px 0 12px">${items || '<p class="muted">Empty.</p>'}</div>
    <h3>Charms</h3><div class="list" style="margin:6px 0 12px">${charms || '<p class="muted">No spare charms.</p>'}</div>
    ${perks ? `<h3>Tamer perks</h3><div class="row wrap" style="margin-top:6px">${perks}</div>` : ''}`, btn('ok', 'Close', 'green sm'));
}
async function menuScreen() {
  const v = await ask('Menu', '', btn('how', 'How to Play', 'ghost') + btn('snd', meta.sound ? 'Sound: On' : 'Sound: Off', 'ghost') + btn('title', 'Save & Quit to Title', 'blue') + btn('give', 'Give up run', 'ghost') + btn('x', 'Back', 'green'));
  if (v === 'how') return showHow();
  if (v === 'snd') { meta.sound = !meta.sound; save(); return menuScreen(); }
  if (v === 'title') { save(); renderTitle(); }
  if (v === 'give' && await ask('Give up?', '<p style="text-align:center">You keep the shards you earned so far.</p>', btn('y', 'Give up', 'ghost') + btn('n', 'Keep going', 'green')) === 'y') gameOver(false);
}

// ---- end of run, camp, dex, help ----------------------------------------------------------------
async function gameOver(won) {
  const shards = R.shardsFor(run, won);
  meta.shards += shards;
  for (const k in run.seen) meta.dex[k] = Math.max(meta.dex[k] || 0, run.seen[k]);
  if (won) { meta.wins++; meta.depthMax = Math.max(meta.depthMax, Math.min(10, run.depth + 1)); }
  const st = run.stats;
  const team = run.party.map(p => `<div style="text-align:center">${monImg(p)}<div class="small">${esc(B.instName(p))} L${p.lvl}</div></div>`).join('');
  run.over = 1;
  const r = run; run = null; save();
  show('map');
  await ask(won ? 'The Glimmer Core is yours!' : 'Your party fell...', `<div class="row center wrap" style="gap:6px">${team.replace(/<img /g, '<img style="height:80px" ')}</div>
    <p style="text-align:center">Act ${r.act + 1} · ${st.battles} battles · ${st.kills} foes beaten · ${st.caught} recruited</p>
    <p style="text-align:center;font-size:18px"><b>+${shards} Glimmer Shards</b></p>${won ? `<p style="text-align:center;color:var(--gold)">Depth ${meta.depthMax} unlocked! Foes grow stronger on each Depth.</p>` : '<p class="muted" style="text-align:center">Spend shards at camp for permanent upgrades.</p>'}`, btn('ok', 'Back to camp', 'green'));
  renderCamp();
}
function renderCamp() {
  $('#campTop').innerHTML = `<button class="iconbtn" data-go="title">◀</button><div class="grow title">Camp</div><span class="pill"><img src="${IMG('ui_shard')}" alt="">${meta.shards}</span>`;
  $('#campBody').innerHTML = `<p class="muted" style="text-align:center;margin:0 0 10px">Glimmer Shards from every run buy permanent upgrades. Catching a creature adds it to your starter pool.</p>
    <div class="list" style="max-width:640px;margin:0 auto">${Object.keys(G.META).map(k => {
      const m = G.META[k], rk = meta.up[k] || 0, max = rk >= m.max, cost = m.cost[rk];
      return `<div class="li"><div class="grow"><div class="t">${m.n} <span class="tag">${rk}/${m.max}</span></div><div class="small">${m.d}</div></div>${max ? '<span class="tag" style="background:#2fbf5555">MAX</span>' : `<button class="btn sm ${meta.shards >= cost ? '' : 'ghost'}" data-buy="${k}">${cost} shards</button>`}</div>`;
    }).join('')}</div>
    <div class="row center wrap" style="margin:16px 0">${btn('dex', 'Glimdex', 'blue sm').replace('data-v', 'data-camp')}${btn('play', 'New Run', 'green sm').replace('data-v', 'data-camp')}</div>`;
  show('camp');
}
$('#campBody').addEventListener('click', e => {
  const b = e.target.closest('[data-buy]');
  if (b) {
    const k = b.dataset.buy, m = G.META[k], rk = meta.up[k] || 0;
    if (rk < m.max && meta.shards >= m.cost[rk]) { meta.shards -= m.cost[rk]; meta.up[k] = rk + 1; SFX.lvl(); save(); renderCamp(); }
    else toast('Not enough shards.');
    return;
  }
  const c = e.target.closest('[data-camp]');
  if (c) { SFX.click(); if (c.dataset.camp === 'dex') showDex(); else renderPick(); }
});
async function showDex() {
  const cells = Object.keys(G.SP).map(sp => [1, 2, 3].map(stg => {
    const seen = (meta.dex[sp] || 0) >= stg || (run && (run.seen[sp] || 0) >= stg);
    return `<div class="${seen ? '' : 'unseen'}"><img src="${IMG('cr_' + sp + stg)}" alt=""><div>${seen ? G.SP[sp].names[stg - 1] : '???'}</div>${stg === 1 && meta.caught[sp] ? '<span class="tag">caught</span>' : ''}</div>`;
  }).join('')).join('');
  const n = Object.keys(G.SP).reduce((s, sp) => s + Math.max(meta.dex[sp] || 0, run ? run.seen[sp] || 0 : 0), 0);
  await ask(`Glimdex · ${n}/36`, `<div class="dex">${cells}</div>`, btn('ok', 'Close', 'green sm'));
}
async function showHow() {
  await ask('How to play', `<div class="how">
  <p><b>The run.</b> Pick a partner, then delve through 4 acts. Each act is a branching map: choose your path between wild battles, elites, dens, shops, campfires, mysteries and treasure, then beat the boss. After a boss, choose which biome to enter next.</p>
  <p><b>Battles</b> are turn-based auto-battles. Each turn, every creature already has a smart move picked; tap a different skill chip to change it, tap a foe to focus it, then press <b>FIGHT!</b> Turn on <b>Auto</b> to let the round run by itself.</p>
  <p><b>Elements.</b> Ember > Bloom, Shade · Tide > Ember, Stone · Bloom > Tide, Stone · Volt > Tide, Shade · Stone > Ember, Volt · Shade > Volt, Bloom. Super-effective hits deal 1.5×; same-element skills deal 1.2×.</p>
  <p><b>Reactions</b> trigger when an element hits the right status: Volt on Soaked = <b>Electrocute</b> (big hit, may stun). Tide on Burning = <b>Steam</b> (blinds). Ember on Poisoned = <b>Blight Burst</b> (the poison explodes onto every foe). Stone on Rooted = <b>Shatter</b> (sure crit). Shade on a Cursed foe under 25% = <b>Doom</b>. Ember on Soaked = Fizzle (weak!).</p>
  <p><b>Team traits.</b> Two or three creatures of one element on the field unlock a trait (shown at the top of the battle).</p>
  <p><b>Front and back row.</b> Your first two creatures stand in front; melee attacks must hit the front row first. Ranged skills reach anyone.</p>
  <p><b>Overdrive.</b> Acting and taking hits fills the blue bar. Evolved creatures fire their <b>ultimate</b> when it is full.</p>
  <p><b>Growth.</b> Creatures level up from XP, learn a third skill at L4 and evolve at L7 and L14, picking a <b>mutation</b> each time. Give each one a <b>charm</b> for stats.</p>
  <p><b>Relics</b> power up your whole team. Three relics with a shared tag light up a <b>set bonus</b>; certain pairs <b>fuse</b> into legendaries at a campfire or forge. Each biome has a <b>hazard</b>; some relics counter it.</p>
  <p><b>Between runs</b>, Glimmer Shards buy permanent upgrades at camp, and every creature you catch joins your starter pool. Win to unlock harder Depths.</p></div>`, btn('ok', 'Got it', 'green'));
}

// ---- boot --------------------------------------------------------------------------------------
load();
renderTitle();
// warm the art cache for the first screens
['bg_verdant', 'node_battle', 'node_elite', 'node_den', 'node_shop', 'node_rest', 'node_event', 'node_treasure', 'node_boss'].forEach(k => { const i = new Image(); i.src = IMG(k); });
window.GLIM = { get run() { return run; }, get meta() { return meta; }, get BS() { return BS; }, startBattle, renderMap };
})();
