// Glimmerdeep UI: title, auto-chess planning (shop, bench, board, drag and drop), live fight playback, rewards, camp.
(function () {
'use strict';
const G = window.GD, C = window.GC, R = window.GR;
const $ = (s, r) => (r || document).querySelector(s);
const IMG = k => (window.GD_ICON_MANIFEST && GD_ICON_MANIFEST[k]) ? ('img/' + k + '.webp') : ((window.ICON_PH && ICON_PH[k]) || ('img/' + k + '.webp'));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SAVE = 'glimmerdeep.v1';
const GLIM_VER = 'v' + '2026-10-03c';

// ---- save ---------------------------------------------------------------------------
let meta = { shards: 0, up: {}, caught: {}, dex: {}, apex: {}, apexSeen: {}, unlocked: {}, runs: 0, wins: 0, depthMax: 0, auto: false, speed: 1, sound: true, music: true, vol: 70, anim: 1 };
let run = null;
let saveStale = false;
let droppedRun = false;
let damagedBoot = false;
// meta.vol is the 0–100 settings percent. Playback gains derived from it stay in [0,1].
function clampPct(v, d) {
  const n = +v;
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : d;
}
function num0(v) {
  const n = +v;
  return Number.isFinite(n) && n >= 0 ? n : 0;
}
function int0(v, max) {
  const n = Math.floor(num0(v));
  return max == null ? n : Math.min(max, n);
}
function plain(v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : null; }
function numMap(v) {
  const o = plain(v), out = {};
  if (!o) return out;
  for (const k in o) {
    const n = +o[k];
    if (Number.isFinite(n) && n >= 0) out[k] = Math.floor(n);
  }
  return out;
}
function flagMap(v) {
  const o = plain(v), out = {};
  if (!o) return out;
  for (const k in o) if (o[k]) out[k] = 1;
  return out;
}
function saneSt(v) {
  const src = plain(v), out = {};
  if (!src) return out;
  for (const k in src) {
    if (k === 'sets') { out.sets = flagMap(src.sets); continue; }
    if (k === 'v') { out.v = src.v ? 1 : 0; continue; }
    const n = +src[k];
    if (Number.isFinite(n) && n >= 0) out[k] = n;
  }
  return out;
}
function saneCosm(v, skin) {
  const c = plain(v) || {};
  const own = flagMap(c.own);
  const sel0 = plain(c.sel) || {};
  const str = x => typeof x === 'string' ? x : '';
  return { own, sel: { skin: str(sel0.skin) || skin || 'classic', title: str(sel0.title), frame: str(sel0.frame), theme: str(sel0.theme) } };
}
function saneDaily(v) {
  const d = plain(v);
  if (!d || typeof d.date !== 'string' || !Array.isArray(d.goals)) return null;
  const goals = [];
  for (const g of d.goals) {
    if (!g || typeof g !== 'object' || typeof g.id !== 'string') continue;
    goals.push({
      id: g.id,
      g: int0(g.g) || 1,
      p: int0(g.p),
      done: g.done ? 1 : 0,
      claimed: g.claimed ? 1 : 0,
      tier: int0(g.tier),
      pay: int0(g.pay),
      el: typeof g.el === 'string' ? g.el : undefined,
    });
  }
  if (goals.length !== 3) return null;
  const out = { date: d.date, goals, streak: int0(d.streak), last: typeof d.last === 'string' ? d.last : '', stamps: int0(d.stamps) };
  if (typeof d.stamped === 'string') out.stamped = d.stamped;
  return out;
}
function wipeMeta() {
  for (const k of Object.keys(meta)) delete meta[k];
  Object.assign(meta, {
    shards: 0, up: {}, caught: {}, dex: {}, apex: {}, apexSeen: {}, unlocked: {},
    runs: 0, wins: 0, depthMax: 0, auto: false, speed: 1, sound: true, music: true, vol: 70, anim: 1,
    tokens: 0, badges: 0, shinies: {}, lures: {}, wstar: {}, shinyBoost: {}, skin: 'classic',
    apexLock: false, den: false, trCards: {}, skinsSeen: {}, ach: {}, st: {},
    cosm: { own: {}, sel: { skin: 'classic', title: '', frame: '', theme: '' } },
  });
}
function applyMeta(src) {
  const s = plain(src) || {};
  meta.shards = int0(s.shards);
  meta.runs = int0(s.runs);
  meta.wins = int0(s.wins);
  meta.depthMax = int0(s.depthMax, 10);
  meta.tokens = int0(s.tokens);
  meta.badges = int0(s.badges, 3);
  meta.vol = clampPct(s.vol, 70);
  meta.speed = (+s.speed === 2 || +s.speed === 4) ? +s.speed : 1;
  meta.sound = s.sound !== false;
  meta.music = s.music !== false;
  meta.auto = s.auto === true;
  meta.anim = s.anim == null ? 1 : (s.anim ? 1 : 0);
  meta.up = numMap(s.up);
  meta.dex = numMap(s.dex);
  meta.apex = numMap(s.apex);
  meta.caught = flagMap(s.caught);
  meta.unlocked = flagMap(s.unlocked);
  meta.apexSeen = flagMap(s.apexSeen);
  meta.shinies = flagMap(s.shinies);
  meta.lures = numMap(s.lures);
  meta.shinyBoost = flagMap(s.shinyBoost);
  meta.skinsSeen = flagMap(s.skinsSeen);
  meta.trCards = flagMap(s.trCards);
  meta.wstar = {};
  const stars = plain(s.wstar);
  if (stars) for (const k in stars) {
    const n = Math.floor(+stars[k]);
    if (n >= 1 && n <= 3) meta.wstar[k] = n;
  }
  meta.skin = typeof s.skin === 'string' && s.skin ? s.skin : 'classic';
  meta.apexLock = s.apexLock === true;
  meta.den = s.den ? 1 : 0;
  meta.ach = numMap(s.ach);
  meta.st = saneSt(s.st);
  meta.cosm = saneCosm(s.cosm, meta.skin);
  const daily = saneDaily(s.daily);
  if (daily) meta.daily = daily; else delete meta.daily;
}
function sealMeta() {
  if (!plain(meta.unlocked)) meta.unlocked = {};
  if (!plain(meta.dex)) meta.dex = {};
  if (!plain(meta.apex)) meta.apex = {};
  if (!plain(meta.apexSeen)) meta.apexSeen = {};
  if (!plain(meta.up)) meta.up = {};
  if (!Number.isFinite(+meta.shards) || +meta.shards < 0) meta.shards = 0;
  else meta.shards = Math.floor(+meta.shards);
  if (!Number.isFinite(+meta.wins) || +meta.wins < 0) meta.wins = 0;
  meta.vol = clampPct(meta.vol, 70);
  if (meta.anim == null) meta.anim = 1;
  for (const k of G.BASE_SPECIES) meta.unlocked[k] = 1;
  if (run && run.pool) for (const k in G.SP) if (run.pool[k] == null) run.pool[k] = meta.unlocked[k] ? G.POOL[G.TIER[k]] : 0;
}
function runOk(r) {
  if (!r || typeof r !== 'object' || r.v !== 2) return false;
  if (!Array.isArray(r.units) || !Array.isArray(r.shop) || !Array.isArray(r.charms)) return false;
  if (!r.pool || typeof r.pool !== 'object' || Array.isArray(r.pool)) return false;
  if (!r.perks || typeof r.perks !== 'object' || Array.isArray(r.perks)) return false;
  if (!r.biome || !G.BIOMES[r.biome]) return false;
  for (const u of r.units) if (!u || typeof u !== 'object' || !G.SP[u.sp]) return false;
  for (const sp of r.shop) if (sp != null && !G.SP[sp]) return false;
  return true;
}
function load() {
  droppedRun = false;
  damagedBoot = false;
  let raw = null;
  try {
    raw = localStorage.getItem(SAVE);
    const s = JSON.parse(raw || 'null');
    // a parsed non-object (or a string that is not JSON) cannot be repaired field by field
    if (raw && (s == null || typeof s !== 'object' || Array.isArray(s))) throw new Error('shape');
    applyMeta(s && s.meta);
    // a stub or a run with a missing board, an unknown biome, or a bad species cannot Continue
    if (s && s.run && typeof s.run === 'object') {
      if (runOk(s.run)) run = s.run;
      else { run = null; droppedRun = true; }
    } else run = null;
  } catch (e) {
    run = null;
    wipeMeta();
    if (raw) damagedBoot = true;
  }
  try { sealMeta(); }
  catch (e) { wipeMeta(); damagedBoot = true; try { sealMeta(); } catch (e2) { /* title still has to render */ } }
}
function save() {
  if (saveStale) return;
  if (run && run.seen) for (const k in run.seen) meta.dex[k] = Math.max(meta.dex[k] || 0, run.seen[k]);
  try { localStorage.setItem(SAVE, JSON.stringify({ meta, run: run && !run.over ? run : null }, (k, v) => k === 'rnd' ? undefined : v)); } catch (e) { /* storage blocked */ }
}
function markStale() {
  if (saveStale) return;
  saveStale = true;
  let el = document.getElementById('tabNote');
  if (!el) {
    el = document.createElement('div');
    el.id = 'tabNote';
    el.className = 'tabnote';
    el.setAttribute('role', 'status');
    el.textContent = 'Game updated in another tab, reload';
    document.body.appendChild(el);
  }
  el.classList.add('on');
}
window.addEventListener('storage', e => {
  if (e && (e.key === SAVE || e.key === 'glimmerdeep.wilds.v1')) markStale();
});

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

// ---- sound files (audio.js) with the old synth kept as the fallback ------------------------------------
const SYNTH = Object.assign({}, SFX);            // the old synth cues: used before the first tap, on file:, or when a file fails to load
Object.assign(SYNTH, {                           // quiet, low synth stand-ins for the new cues (no upward slides, nothing bright)
  shield: () => tone(330, 0.25, 'sine', 0.05, 0.8), fightstart: () => { tone(110, 0.5, 'triangle', 0.08, 0.7); },
  merge: () => [392, 330].forEach((f, i) => setTimeout(() => tone(f, 0.2, 'triangle', 0.05), i * 90)),
  relic: () => { tone(392, 0.3, 'sine', 0.05, 0.9); }, summon: () => tone(260, 0.3, 'sine', 0.05, 0.6), bossbanner: () => tone(98, 0.8, 'triangle', 0.08, 0.7),
  reroll: () => tone(300, 0.1, 'triangle', 0.04, 0.7), lock: () => tone(220, 0.06, 'triangle', 0.05), pickup: () => tone(440, 0.07, 'triangle', 0.04, 0.8), drop: () => tone(200, 0.07, 'triangle', 0.05, 0.7),
  wdoor: () => tone(200, 0.12, 'triangle', 0.04, 0.7), wspike: () => tone(150, 0.1, 'triangle', 0.06, 0.6), wkey: () => tone(500, 0.12, 'triangle', 0.04, 0.8),
  wvault: () => tone(330, 0.3, 'sine', 0.05, 0.9), wsecret: () => tone(240, 0.4, 'triangle', 0.05, 0.6), whint: () => tone(1180, 0.05, 'sine', 0.018, 0.8), wberry: () => tone(520, 0.1, 'sine', 0.05, 0.8),
  wchest: () => [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'triangle', 0.05), i * 90)), wshrine: () => tone(330, 0.5, 'sine', 0.05, 0.9),
  wencounter: () => tone(150, 0.3, 'triangle', 0.06, 0.6), wcatch: () => [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'triangle', 0.05), i * 90)),
  wshiny: () => [440, 392, 330].forEach((f, i) => setTimeout(() => tone(f, 0.2, 'sine', 0.04), i * 100)), wdescend: () => tone(180, 0.6, 'triangle', 0.05, 0.5), wdone: () => tone(262, 0.5, 'triangle', 0.06, 0.9),
});
if (window.GAUDIO) GAUDIO.init(meta, () => save(), SYNTH);   // save() is a function declaration, so this is safe here
// EVERY cue exists on SFX whether or not audio.js loaded, so the new calls (SFX.fightstart(), SFX.stinger(), U.SFX.wdoor()...) can never throw
for (const k of Object.keys(SYNTH)) SFX[k] = window.GAUDIO ? () => GAUDIO.sfx(k) : SYNTH[k];
SFX.stinger = n => window.GAUDIO ? GAUDIO.stinger(n) : SYNTH[n === 'lose' ? 'ko' : 'lvl']();
const mus = k => { if (window.GAUDIO) GAUDIO.music(k); };   // music key -> play it (no-op if it is already playing)
// element-aware spell cues (sfx2/). SFX.el(kind, element, {v}) with kind cast | hit | ult; each falls back to the first-pack cue, and to the synth without audio.js
SFX.el = (kind, el, o) => window.GAUDIO ? GAUDIO.el(kind, el, o) : SYNTH[{ cast: 'react', hit: 'hit', ult: 'ult' }[kind]]();
SFX.reaction = name => window.GAUDIO ? GAUDIO.react(name) : SYNTH.react();
SFX.heal = () => window.GAUDIO ? GAUDIO.heal() : SYNTH.heal();       // 2 new heal variants
SFX.shield = () => window.GAUDIO ? GAUDIO.shield() : SYNTH.shield();

// ---- small renderers ---------------------------------------------------------------------
function show(id) { document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id)); }
function toast(msg, cls) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('on', 'low');
  if (cls) t.classList.add(cls);
  void t.offsetWidth;
  t.classList.add('on');
}
const elBadge = (el, cls) => `<img class="${cls || 'badge'}" src="${IMG('el_' + el)}" alt="${G.EL[el] ? G.EL[el].name : ''}">`;
function monImg(inst, cls) { return `<img class="${cls || ''}${inst.shiny ? ' shiny' : ''}" src="${IMG(C.art(inst))}" alt="">`; }
function hpClass(p) { return p < 0.3 ? 'low' : p < 0.6 ? 'mid' : ''; }
function bar(p, cls) { p = Math.max(0, Math.min(1, p)); return `<div class="bar ${cls || ''}"><i class="${cls ? '' : hpClass(p)}" style="width:${(p * 100).toFixed(1)}%"></i></div>`; }
function skillTag(sk) {
  const t = { foe: 'Single', lowfoe: 'Weakest', foes: 'All foes', foe3: '3 hits', foe5: '5 hits', foe6: '6 hits', ally: 'Heal ally', allies: 'Team', self: 'Self' }[sk.t];
  return (sk.ult ? 'ULT · ' : '') + t + (sk.pow ? ' · ' + sk.pow : '') + (sk.cd ? ' · CD ' + sk.cd : '') + (sk.rng ? ' · Ranged' : '');
}

// ---- modal flows ----------------------------------------------------------------------------
const M = $('#modal'), MB = $('#modalBox');
let modalHandler = null;
let modalCancel = null;   // set only for dismissible modals; backdrop and Escape resolve with this value
function dismissModal() {
  if (!modalHandler || modalCancel == null) return;
  SFX.click();
  modalHandler(modalCancel);
}
M.addEventListener('click', e => {
  const t = e.target.closest('[data-v]');
  if (t && MB.contains(t) && modalHandler) { SFX.click(); modalHandler(t.dataset.v, t); return; }
  if (e.target === M) dismissModal();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') dismissModal(); });
function modal(title, body, acts, cancel) {
  MB.innerHTML = `<h2>${title}</h2><div class="body">${body || ''}</div>${acts ? `<div class="acts">${acts}</div>` : ''}`;
  M.classList.add('on');
  modalCancel = cancel == null ? null : cancel;
  return new Promise(res => { modalHandler = v => { res(v); }; });
}
function closeModal() { M.classList.remove('on'); modalHandler = null; modalCancel = null; MB.innerHTML = ''; }
async function ask(title, body, acts, cancel) { const v = await modal(title, body, acts, cancel); closeModal(); return v; }
const btn = (v, label, cls) => `<button class="btn ${cls || ''}" data-v="${esc(v)}">${label}</button>`;
const ICO = {
  dex: '<svg class="bico" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 5.2A2.2 2.2 0 0 1 6.2 3H19v15H6.2A2.2 2.2 0 0 0 4 20.2V5.2zM6.2 16H17V5H6.2c-.7 0-1.2.5-1.2 1.2V16c.4-.6 1-.9 1.2-1z"/><path fill="currentColor" d="M8 7h7v2H8zm0 3h7v2H8z"/></svg>',
  how: '<svg class="bico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path fill="currentColor" d="M11.2 16.8h1.6v-1.6h-1.6v1.6zM12 6.2a3.4 3.4 0 0 0-3.4 3.4h1.7a1.7 1.7 0 1 1 2.1 1.6c-.9.4-1.4 1-1.4 2.1v.6h1.6v-.5c0-.4.2-.6.7-.8A3.4 3.4 0 0 0 12 6.2z"/></svg>',
  about: '<svg class="bico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="8" r="1.25" fill="currentColor"/><path fill="currentColor" d="M11 10.6h2V17h-2z"/></svg>',
  gear: '<svg class="bico" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M19.4 13.5a7.7 7.7 0 0 0 .1-1.5 7.7 7.7 0 0 0-.1-1.5l2-1.6-2-3.4-2.4 1a7.4 7.4 0 0 0-2.6-1.5l-.4-2.6h-4l-.4 2.6a7.4 7.4 0 0 0-2.6 1.5l-2.4-1-2 3.4 2 1.6a7.7 7.7 0 0 0 0 3l-2 1.6 2 3.4 2.4-1a7.4 7.4 0 0 0 2.6 1.5l.4 2.6h4l.4-2.6a7.4 7.4 0 0 0 2.6-1.5l2.4 1 2-3.4-2-1.6zM12 15.2A3.2 3.2 0 1 1 12 8.8a3.2 3.2 0 0 1 0 6.4z"/></svg>',
};
M.addEventListener('input', e => {
  const r = e.target.closest('[data-vol]');
  if (!r || !window.GAUDIO) return;
  GAUDIO.setVol(+r.value);
  const lab = r.parentElement && r.parentElement.querySelector('.volpct');
  if (lab) lab.textContent = meta.vol + '%';
});

// ---- title / new run -------------------------------------------------------------------------
function renderTitle() {
  stopFight();
  const m = $('#titleMenu');
  const tn = window.COSM && COSM.titleName ? COSM.titleName() : '';
  const fr = window.COSM && COSM.frameImg ? COSM.frameImg() : '';
  const titleBit = fr
    ? `<span class="avwrap titleframe"><img class="frameov" src="${fr}" alt=""><span class="avin">${esc(tn || 'Tamer')}</span></span>`
    : (tn ? `<span class="costitle">${esc(tn)}</span>` : '');
  m.innerHTML = (run ? btn('cont', 'Continue Run', 'green') : '') + btn('new', 'New Run') + btn('wilds', 'The Wilds', 'wild') + btn('camp', 'Camp & Upgrades', 'blue') +
    `<div class="title-sub">${btn('dex', ICO.dex + 'Glimdex', 'mid blue')}${btn('how', ICO.how + 'How to Play', 'mid')}</div>` +
    `<div class="title-sub">${btn('ach', '🏆 Goals', 'mid wild')}${btn('wardrobe', '👕 Wardrobe', 'mid')}</div>` +
    `<div class="title-sub">${btn('set', ICO.gear + 'Settings', 'mid wild')}${btn('about', ICO.about + 'About', 'mid')}</div>` +
    `<div class="pill" style="margin-top:6px">${titleBit}<img src="${IMG('ui_shard')}" alt="">${meta.shards} shards · ${meta.wins} wins · ${Object.keys(meta.unlocked).length}/${Object.keys(G.SP).length} creatures</div>`;
  show('title');
  mus('title');
  window.AX && AX.check();
}
$('#titleMenu').addEventListener('click', async e => {
  const t = e.target.closest('[data-v]'); if (!t) return;
  SFX.click();
  const v = t.dataset.v;
  if (v === 'cont') {
    try {
      if (!runOk(run)) throw new Error('run');
      renderGame();
    } catch (err) {
      run = null;
      save();
      renderTitle();
      toast('Save damaged: start fresh.');
    }
  }
  else if (v === 'new') {
    if (run && await ask('Abandon run?', '<p style="text-align:center">Your current run will be lost.</p>', btn('y', 'Abandon', 'ghost') + btn('n', 'Keep it', 'green')) !== 'y') return;
    newRunFlow();
  }
  else if (v === 'camp') renderCamp();
  else if (v === 'wilds') window.WILDS.open();
  else if (v === 'dex') showDex();
  else if (v === 'how') showHow();
  else if (v === 'set') settingsScreen();
  else if (v === 'about') showAbout();
  else if (v === 'ach') window.AX && AX.open();
  else if (v === 'wardrobe') window.COSM && COSM.open();
});
document.addEventListener('click', e => { const g = e.target.closest('[data-go]'); if (g && !M.contains(g)) { SFX.click(); if (g.dataset.go === 'title') renderTitle(); } });

async function newRunFlow() {
  let depth = 0;
  if (meta.depthMax) {
    let d = '';
    for (let i = 0; i <= meta.depthMax; i++) d += btn('d' + i, i ? 'Depth ' + i : 'Normal', i ? 'ghost sm' : 'green sm');
    const v = await ask('Difficulty', '<p class="muted" style="text-align:center">Each Depth makes enemies 8% stronger and pays 10% more shards.</p>', d);
    depth = +v.slice(1) || 0;
  }
  const seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
  const opts = R.starterChoices(meta, seed);
  run = R.newRun(meta, seed, depth);
  meta.runs++;
  show('game'); renderGame();
  const v = await ask('Choose your first creature', `<p class="muted" style="text-align:center">Buy more from the shop each round. Three copies of a creature merge and evolve it.</p><div class="cards">${opts.map(sp => {
    const S = G.SP[sp], sk = G.SK[S.sk[1]];
    return `<div class="card el-${S.el}" data-v="${sp}"><div class="art"><img src="${IMG('cr_' + sp + '1')}" alt=""></div><h3>${S.names[0]}</h3>
      <div class="row center" style="margin-top:4px">${elBadge(S.el)}<span class="tag">${ROLE_N[S.role]}</span><span class="tag">Range ${G.RANGE[sp]}</span></div><p><b>${sk.n}</b>: ${sk.d}</p></div>`;
  }).join('')}</div>`);
  R.giveStarter(run, v);
  meta.caught[v] = 1;
  SFX.lvl(); save(); renderGame();
  toast('Drag creatures onto your half of the board, then press FIGHT!', 'low');
}

// ---- the game screen -------------------------------------------------------------------------
const ROLE_N = { striker: 'Striker', caster: 'Caster', tank: 'Guardian', support: 'Support', boss: 'Boss' };
const KIND_N = { wild: 'Wild', elite: 'Elite', boss: 'BOSS' };
const unitsEl = $('#units'), benchEl = $('#bench'), boardEl = $('#board'), fxEl = $('#fx');
// Rich fight motion (glim-anim.js). Classic (?anim=0 or the setting) leaves this null-checked and uses the keyframes below.
const GA = window.GlimAnim && GlimAnim.enabled !== false ? GlimAnim : null;
if (GA) {
  try { if (new URLSearchParams(location.search).get('debug') === '1') GA.debug = true; } catch (e) { /* no location */ }
  GA.observe(unitsEl);   // bench stays unwrapped: idle there is optional and costs a phone frame
}
const animMiss = Object.create(null);
function noteAnim(u) {
  if (!GA || !GA.debug || !u || !u.art) return;
  const m = /cr_([a-z0-9]{4})/.exec(u.art), id = m && m[1];
  if (id && !GA.SPECIES[id] && !animMiss[id]) { animMiss[id] = 1; console.info('anim: no archetype for', id); }
}
// ?anim=0 / ?anim=1 forces classic or rich for this page load only. It does not write meta.anim.
let animLive = null;
function animNow() {
  if (animLive != null) return !!animLive;
  if (meta.autoClassic) return false;             // low-fps fallback; the saved Animation choice stays in meta.anim
  return meta.anim !== 0;
}
function readAnimQuery() {
  try {
    const q = new URLSearchParams(location.search).get('anim');
    if (q === '0' || q === '1') animLive = q === '1' ? 1 : 0;
  } catch (e) { /* no location */ }
}
function setAnimPref(on) {
  meta.anim = on ? 1 : 0;
  meta.autoClassic = false;
  if (on) meta.fpsOptOut = true;                  // they picked Rich; don't auto-switch them again
  animLive = meta.anim;
  applyAnim();
  save();
}
// Classic for this device only. Does not write meta.anim unless the player confirms on the toast.
function setAutoClassic(on) {
  meta.autoClassic = !!on;
  if (!on) meta.fpsOptOut = true;
  if (animLive == null) applyAnim();
  save();
}
function confirmClassic() {
  meta.anim = 0;
  meta.autoClassic = false;
  animLive = 0;
  applyAnim();
  save();
}
function applyAnim() {
  if (!GA) return;
  GA.enabled = animNow();
  if (GA.enabled) { GA.scan(unitsEl); GA.pauseIdle(false); }
  else {
    GA.pauseIdle(true);
    document.querySelectorAll('.unit.ga').forEach(el => el.classList.remove('ga'));
  }
}
function syncGaSpeed() {
  if (!GA || !FS) return;
  GA.speed = FS.speed;
  const fxOn = FS.speed < 4 && FS.st.units.length <= 14;   // ghosts and dust off at 4x or on a crowded board
  GA.ghosts = fxOn; GA.dust = fxOn;
}
// GlimAnim returns wall-clock ms (already divided by its speed). later() and LAST.dly stay in 1x milliseconds, which is what the hit sounds use.
function ga1x(ms) { return typeof ms === 'number' && ms > 0 && FS ? ms * (FS.speed || 1) : 0; }
VFX.init(boardEl);
let phase = 'plan';
function starsTxt(n) { return '★'.repeat(n); }
const SIZE = [0, 70, 94, 114, 134];
function unitHtml(key, o) {
  const pos = o.bench ? '' : `left:${o.x * 12.5}%;top:${o.y * 20}%;`;
  const sz = o.boss ? 175 : SIZE[o.star || 1];
  const face = o.side === 1 ? 'faceL' : 'faceR';
  return `<div class="unit side${o.side} ${face} s${o.boss ? 0 : o.star || 1} ${o.mine ? 'mine' : ''} ${o.boss ? 'boss' : ''} ${o.elite ? 'elite' : ''} ${o.preview ? 'preview' : ''}" data-k="${key}" ${o.uid != null ? `data-uid="${o.uid}"` : ''} style="${pos}--sz:${sz}%">
    <div class="uhud">${o.bench ? '' : `<div class="bar hp"><i style="width:${100 * (o.hp == null ? 1 : o.hp / o.maxHp)}%"></i><i class="sh" style="width:0%"></i></div><div class="bar mp"><i style="width:${o.mana || 0}%"></i></div>`}
      <div class="stars">${o.boss ? '♛' : starsTxt(o.star || 1)}</div><div class="sts"></div></div>
    <div class="rig"><img class="spr${o.shiny ? ' shiny' : ''}" src="${IMG(o.art)}" alt=""></div><div class="shadow"></div></div>`;
}
function topHtml() {
  const kind = R.roundKind(run.round);
  const bi = G.BIOMES[run.biome];
  const boss = kind === 'boss' ? ' · ' + G.BOSSES[R.bossOf(run)].name : '';
  return `<button class="iconbtn" data-top="menu">☰</button>
    <div class="grow"><div class="title">Round ${run.round}/${G.ROUNDS} · <span style="color:${kind === 'boss' ? '#ff7b8f' : kind === 'elite' ? '#ffd65a' : 'inherit'}">${KIND_N[kind]}${boss}</span></div><div class="small muted">Stage ${R.stageOf(run.round) + 1}/${G.STAGES} · ${bi.name}${run.depth ? ' · Depth ' + run.depth : ''}${run.streak > 1 ? ' · win streak ' + run.streak : run.streak < -1 ? ' · loss streak ' + -run.streak : ''}</div></div>
    <span class="pill hp-pill">♥ ${run.hp}</span><span class="pill"><img src="${IMG('ui_gold')}" alt="">${run.gold}</span>
    <button class="iconbtn" data-top="bag" title="Relics, charms and items"><img src="${IMG('node_treasure')}" alt=""></button>`;
}
function traitsHtml(insts) {
  const c = C.traitCounts(insts.filter(i => !i.boss));
  const bi = G.BIOMES[run.biome];
  let h = `<span class="trait haz" data-tr="haz">⚠ ${bi.hazName}</span>`;
  const items = [];
  for (const e of G.ELS) if (c.el[e]) items.push({ k: 'el:' + e, on: c.el[e] >= G.EL_AT[0], html: `<span class="trait el-${e} ${c.el[e] >= G.EL_AT[0] ? 'on' : ''}" data-tr="el:${e}">${elBadge(e)}${G.EL[e].name} ${c.el[e]}/${c.el[e] >= G.EL_AT[0] ? G.EL_AT[1] : G.EL_AT[0]}</span>` });
  for (const r in G.ROLE_TRAITS) if (c.role[r]) {
    const T = G.ROLE_TRAITS[r], n = c.role[r], next = T.at.find(a => a > n) || T.at[T.at.length - 1];
    items.push({ k: 'role:' + r, on: n >= T.at[0], html: `<span class="trait role ${n >= T.at[0] ? 'on' : ''}" data-tr="role:${r}">${T.n} ${n}/${next}</span>` });
  }
  items.sort((a, b) => b.on - a.on);
  return h + items.map(i => i.html).join('');
}
$('#gTraits').addEventListener('click', e => {
  const t = e.target.closest('[data-tr]'); if (!t) return;
  const k = t.dataset.tr;
  if (k === 'haz') { const bi = G.BIOMES[run.biome]; return toast(`${bi.hazName}: ${bi.hazDesc} Counter: ${bi.counter}.`); }
  const [kind, id] = k.split(':');
  if (kind === 'el') toast(`${G.EL[id].name} (${G.EL_AT.join('/')} different species): ${G.TRAITS[id].join(' · ')}`);
  else { const T = G.ROLE_TRAITS[id]; toast(`${T.n} (${T.at.join('/')}): ${T.d.join(' · ')}`); }
});
function renderCells() {
  let h = '';
  for (let y = 0; y < C.H; y++) for (let x = 0; x < C.W; x++) h += `<div class="cell ${x < R.PW ? 'a' : 'f'} ${(x + y) % 2 ? 'alt' : ''}" data-x="${x}" data-y="${y}"></div>`;
  $('#cells').innerHTML = h;
}
function renderGame() {
  if (!run) return renderTitle();
  stopFight();
  phase = 'plan';
  mus('plan');
  $('#game').classList.remove('fighting');
  boardEl.classList.remove('ult');
  show('game');
  $('#gBg').style.backgroundImage = `url(${IMG(G.BIOMES[run.biome].bg)})`;
  $('#gTop').innerHTML = topHtml();
  const board = R.onBoard(run);
  $('#gTraits').innerHTML = traitsHtml(board);
  if (!$('#cells').children.length) renderCells();
  // my board + the next enemy board
  let h = board.map(u => unitHtml('p' + u.uid, { uid: u.uid, x: u.x, y: u.y, star: u.star, side: 0, mine: true, art: C.art(u), shiny: u.shiny })).join('');
  R.enemyBoard(run).forEach((p, i) => { h += unitHtml('e' + i, { x: p.x, y: p.y, star: p.inst.star, side: 1, boss: p.inst.boss, elite: p.inst.elite, art: C.art(p.inst), preview: true }); });
  unitsEl.innerHTML = h;
  fxEl.innerHTML = '';
  VFX.clear();
  let b = '';
  for (let i = 0; i < R.BENCH; i++) {
    const u = R.benchAt(run, i);
    b += `<div class="bslot" data-slot="${i}">${u ? unitHtml('p' + u.uid, { uid: u.uid, bench: true, star: u.star, side: 0, mine: true, art: C.art(u), shiny: u.shiny }) : ''}</div>`;
  }
  benchEl.innerHTML = b;
  renderShop();
  save();
}
function renderShop() {
  // OWNED marks a card that would merge with something: a ★3 is final, so only lower forms count
  const owned = new Set(run.units.filter(u => u.star < 3).map(u => u.sp));
  const n = R.shopSize(run);
  $('#shop').style.setProperty('--n', n);
  $('#shop').innerHTML = run.shop.slice(0, n).map((sp, i) => {
    if (!sp) return '<div class="scard empty"></div>';
    const S = G.SP[sp], t = G.TIER[sp];
    const shiny = (run.shopShiny || [])[i];
    return `<div class="scard t${t} ${run.gold < t ? 'poor' : ''} ${owned.has(sp) ? 'have' : ''} ${shiny ? 'shinycard' : ''}" data-buy="${i}" title="${esc((shiny ? 'SHINY! +10% stats. ' : '') + G.SK[S.sk[1]].n + ': ' + G.SK[S.sk[1]].d)}">
      <div class="els">${elBadge(S.el)}</div><span class="cost">${t}</span>${shiny ? '<span class="shinytag">✦ SHINY</span>' : ''}<img class="m${shiny ? ' shiny' : ''}" decoding="async" src="${IMG('cr_' + sp + '1')}" alt=""><div class="nm">${S.names[0]}</div><div class="role">${ROLE_N[S.role]} · R${G.RANGE[sp]}</div></div>`;
  }).join('');
  const nb = R.onBoard(run).length, cap = R.cap(run);
  const need = run.tlv < 9 ? G.TXP[run.tlv] : 1;
  $('#shopBtns').innerHTML = `${btn('reroll', `Reroll ${R.rerollCost(run)}g`, 'blue sm')}
    <button class="btn sm ghost" data-v="xp" ${run.tlv >= 9 ? 'disabled' : ''}>Buy XP 4g</button>
    <div class="lv"><span>Tamer Lv ${run.tlv}</span>${bar(run.tlv >= 9 ? 1 : run.txp / need, 'xp')}<span class="small muted">${run.tlv >= 9 ? 'MAX' : run.txp + '/' + need + ' XP'}</span></div>
    <button class="btn sm ${run.locked ? 'green' : 'ghost'}" data-v="lock" title="Keep this shop for next round">${run.locked ? 'Locked' : 'Lock'}</button>
    <span class="cap ${nb === cap ? 'full' : nb > cap ? 'over' : ''}">Board ${nb}/${cap}</span><span class="grow"></span>
    ${btn('fight', 'FIGHT!', 'green')}`;
}
$('#shop').addEventListener('click', async e => {
  const c = e.target.closest('[data-buy]'); if (!c || phase !== 'plan') return;
  const i = +c.dataset.buy;
  if (!R.canBuy(run, i)) { toast(run.gold < G.TIER[run.shop[i]] ? 'Not enough gold.' : 'Your bench is full.'); return; }
  const u = R.buy(run, i);
  SFX.coin();
  meta.caught[u.sp] = 1;
  await afterChange();
});
$('#shopBtns').addEventListener('click', async e => {
  const b = e.target.closest('[data-v]'); if (!b || phase !== 'plan') return;
  const v = b.dataset.v;
  if (v !== 'reroll' && v !== 'lock') SFX.click();
  if (v === 'reroll') { if (!R.reroll(run)) { SFX.click(); toast('Not enough gold.'); } else SFX.reroll(); renderGame(); }
  else if (v === 'xp') { const lv = run.tlv; if (!R.buyXp(run)) toast('Not enough gold.'); else if (run.tlv > lv) { SFX.lvl(); toast(`Tamer level ${run.tlv}: room for ${run.tlv} creatures on the board.`); } renderGame(); }
  else if (v === 'lock') { run.locked = !run.locked; SFX.lock(); renderShop(); save(); }
  else if (v === 'fight') startFight();
});
// merges after anything that adds copies, with a mutation pick for each
async function afterChange() {
  const ups = R.merges(run);
  renderGame();
  for (const u of ups) {
    SFX.merge();
    window.AX && AX.ev('merge');
    await evolveFlow(u);
    window.AX && AX.ev('evo');
    const more = R.merges(run);
    ups.push(...more);
    renderGame();
  }
}
// the evolution sequence: glow, flickering silhouettes, light rays, a white flash, the reveal
const EVO_EL = { ember: '#ff7a2a', tide: '#2fa6ff', bloom: '#4fd35a', volt: '#ffd21f', stone: '#e0a860', shade: '#8d7bff', frost: '#8fe3ff', gale: '#7dffc2', metal: '#d8e2ee', mystic: '#d9a6ff' };
async function evoCinematic(u) {
  const S = G.SP[u.sp], apex = u.star === 4, c = apex ? '#fff4c8' : (EVO_EL[S.el] || '#fff');
  const nmOld = S.names[u.star - 2] || S.names[Math.max(0, S.names.length - 2)];
  const nmNew = S.names[u.star - 1] || S.names[S.names.length - 1];
  const oldArt = IMG('cr_' + u.sp + (u.star - 1)), newArt = IMG(C.art(u));
  const bns = run ? R.bonus(run) : {};
  const before = C.stats(Object.assign({}, u, { star: u.star - 1 }), bns), after = C.stats(u, bns);
  // make sure the new form is decoded before the reveal
  await new Promise(res => { const i = new Image(); i.onload = i.onerror = res; i.src = newArt; setTimeout(res, 1500); });
  const ov = document.createElement('div');
  ov.className = 'evo';
  ov.style.setProperty('--c', c);
  ov.innerHTML = `<div class="evo-bg"></div><div class="evo-rays"></div><div class="evo-halo"></div>
    <div class="evo-mon"><img class="evo-old${u.shiny ? ' shiny' : ''}" src="${oldArt}" alt=""><img class="evo-new${u.shiny ? ' shiny' : ''}" src="${newArt}" alt=""></div>
    <div class="evo-sparks"></div><div class="evo-ring"></div><div class="evo-flash"></div>
    <div class="evo-text"><div class="evo-top">${apex ? 'Apex form!' : `What? ${nmOld} is evolving!`}</div><div class="evo-name"></div><div class="evo-stats"></div><div class="evo-tap">tap to continue</div></div>`;
  $('#app').appendChild(ov);
  let skip = false;
  ov.addEventListener('pointerdown', () => { skip = true; });
  const wait = ms => skip ? Promise.resolve() : sleep(ms);
  const old = ov.querySelector('.evo-old'), nw = ov.querySelector('.evo-new'), mon = ov.querySelector('.evo-mon');
  requestAnimationFrame(() => ov.classList.add('on'));
  SFX.stinger('evolve');
  await wait(700);
  // sparks rush in while the creature glows and grows
  const sp = ov.querySelector('.evo-sparks');
  for (let i = 0; i < 28; i++) {
    const d = document.createElement('i'), ang = Math.random() * Math.PI * 2, r = 38 + Math.random() * 18;
    d.style.setProperty('--x', Math.cos(ang) * r + 'vmin'); d.style.setProperty('--y', Math.sin(ang) * r + 'vmin');
    d.style.animationDelay = (Math.random() * 1.4) + 's';
    sp.appendChild(d);
  }
  ov.classList.add('charge');
  // flicker between the two silhouettes, faster and faster
  let gap = 300;
  for (let i = 0; i < 12 && !skip; i++) {
    const showNew = i % 2 === 1;
    old.style.opacity = showNew ? 0 : 1; nw.style.opacity = showNew ? 1 : 0;
    mon.style.transform = `scale(${1 + i * 0.035})`;
    await wait(gap); gap = Math.max(70, gap * 0.8);
  }
  // flash and reveal
  ov.classList.add('flash');
  await wait(260);
  old.style.opacity = 0; nw.style.opacity = 1; mon.style.transform = '';
  ov.classList.remove('charge'); ov.classList.add('reveal');
  ov.querySelector('.evo-name').innerHTML = apex
    ? `Apex form! <b>${nmNew}</b>${S.title4 ? ' — ' + S.title4 : ''} <span class="evo-stars">${starsTxt(u.star)}</span>`
    : `${nmOld} evolved into <b>${nmNew}</b>! <span class="evo-stars">${starsTxt(u.star)}</span>`;
  ov.querySelector('.evo-stats').innerHTML = [['HP', before.hp, after.hp], ['ATK', Math.round(before.atk), Math.round(after.atk)], ['DEF', Math.round(before.def), Math.round(after.def)]]
    .map(([k, a, b]) => `<span>${k} ${a} → <b>${b}</b></span>`).join('') + (u.star === 2 ? `<span class="evo-new-skill">New ultimate: <b>${G.SK[S.sk[3]].n}</b></span>` : '')
    + (S.perk ? `<span class="evo-new-skill evo-perk">${u.star === 2 ? 'Merge perk unlocked' : 'Perk empowered + aura'}: <b>✦ ${S.perk.name}</b></span>` : '');
  await sleep(500);
  skip = false;
  await new Promise(res => { ov.addEventListener('pointerdown', res, { once: true }); setTimeout(res, 6000); });
  ov.classList.add('out');
  await sleep(300);
  ov.remove();
}
async function evolveFlow(u) {
  const S = G.SP[u.sp];
  await evoCinematic(u);
  const opts = R.mutOptions(run, u);
  const perk = S.perk ? `<p style="text-align:center;color:#ffe9a8">✦ <b>${S.perk.name}</b>: ${G.perkText(u.sp, u.star)}</p>` : '';
  const ult = (u.star === 4 ? `<p style="text-align:center">Apex form. Its stats nearly double again... ${S.title4}: ${S.desc4}</p>` : u.star === 2 ? `<p style="text-align:center">New power available: <b>${G.SK[S.sk[3]].n}</b> — ${G.SK[S.sk[3]].d}</p>` : '<p style="text-align:center">Its final form. Its stats nearly double again.</p>') + perk;
  const m = await ask(`${starsTxt(u.star)} ${S.names[u.star - 1]}`, `<div class="evo-stage" style="height:190px"><div class="glow"></div><img src="${IMG(C.art(u))}" class="${u.shiny ? 'shiny' : ''}" style="max-height:180px"></div>${ult}<p class="muted" style="text-align:center">Choose a mutation:</p><div class="cards">${opts.map(k => `<div class="card" data-v="${k}"><h3>${G.MUTS[k].n}</h3><p>${G.MUTS[k].d}</p></div>`).join('')}</div>`);
  R.applyMut(run, u, m);
  if (u.el2) toast(`${C.name(u)} also counts as ${G.EL[u.el2].name} now!`);
  meta.dex[u.sp] = Math.max(meta.dex[u.sp] || 0, u.star);
  save();
}

// ---- drag and drop -------------------------------------------------------------------------
let drag = null;
function dropTarget(x, y) {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  if (el.closest('#sellZone')) return { sell: true, el: $('#sellZone') };
  const slot = el.closest('.bslot');
  if (slot) return { slot: +slot.dataset.slot, el: slot };
  const cell = el.closest('.cell');
  if (cell && +cell.dataset.x < R.PW) return { x: +cell.dataset.x, y: +cell.dataset.y, el: cell };
  const u = el.closest('.unit.mine[data-uid]');
  if (u && u.parentElement === unitsEl) { const iu = run.units.find(z => z.uid === +u.dataset.uid); if (iu) return { x: iu.x, y: iu.y, el: $(`.cell[data-x="${iu.x}"][data-y="${iu.y}"]`) }; }
  if (u && u.parentElement.classList.contains('bslot')) return { slot: +u.parentElement.dataset.slot, el: u.parentElement };
  // on the board but over the enemy half or a gap: snap to the nearest cell of my half
  const br = boardEl.getBoundingClientRect();
  if (x >= br.left && x <= br.right && y >= br.top && y <= br.bottom) {
    const cx = Math.min(R.PW - 1, Math.floor((x - br.left) / br.width * C.W)), cy = Math.min(C.H - 1, Math.floor((y - br.top) / br.height * C.H));
    return { x: cx, y: cy, el: $(`.cell[data-x="${cx}"][data-y="${cy}"]`) };
  }
  return null;
}
document.addEventListener('pointerdown', e => {
  if (phase !== 'plan' || M.classList.contains('on')) return;
  const u = e.target.closest('.unit.mine[data-uid]');
  if (u) { drag = { uid: +u.dataset.uid, sx: e.clientX, sy: e.clientY, el: u, moved: false, tgt: null }; e.preventDefault(); return; }
  const p = e.target.closest('.unit.preview');
  if (p) enemyInfo(+p.dataset.k.slice(1));
});
document.addEventListener('pointermove', e => {
  if (!drag) return;
  if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) {
    drag.moved = true;
    SFX.pickup();
    drag.el.classList.add('dragging');
    const iu = run.units.find(z => z.uid === drag.uid);
    drag.ghost = document.createElement('div');
    drag.ghost.className = 'dragghost';
    drag.ghost.innerHTML = `<img src="${IMG(C.art(iu))}" class="${iu.shiny ? 'shiny' : ''}">`;
    document.body.appendChild(drag.ghost);
    const sz = $('#sellZone'); sz.textContent = `Sell for ${R.sellValue(iu)} gold`; sz.classList.add('on');
  }
  if (!drag.moved) return;
  drag.ghost.style.left = e.clientX + 'px'; drag.ghost.style.top = e.clientY + 'px';
  const t = dropTarget(e.clientX, e.clientY);
  if (drag.tgt && drag.tgt.el) drag.tgt.el.classList.remove('hot');
  drag.tgt = t;
  if (t && t.el) t.el.classList.add('hot');
});
document.addEventListener('pointerup', async e => {
  if (!drag) return;
  const d = drag; drag = null;
  // hit-test while the sell overlay is still shown; hiding it first makes the drop miss
  const t = d.moved ? dropTarget(e.clientX, e.clientY) : null;
  if (d.ghost) d.ghost.remove();
  $('#sellZone').classList.remove('on', 'hot');
  document.querySelectorAll('.hot').forEach(x => x.classList.remove('hot'));
  if (!d.moved) { unitDetail(d.uid); return; }
  if (!t) return renderGame();
  if (t.sell) { const iu = run.units.find(z => z.uid === d.uid); if (!(await confirmLastSell(iu))) return renderGame(); const v = R.sell(run, d.uid); SFX.coin(); toast(`Sold ${C.name(iu)} for ${v} gold.`); }
  else if (t.slot != null) R.placeBench(run, d.uid, t.slot);
  else if (!R.placeBoard(run, d.uid, t.x, t.y)) toast(`Board full: Tamer level ${run.tlv} allows ${R.cap(run)} creatures. Buy XP to raise it.`);
  else SFX.drop();
  renderGame();
});
document.addEventListener('pointercancel', () => { if (drag) { if (drag.ghost) drag.ghost.remove(); drag = null; $('#sellZone').classList.remove('on'); renderGame(); } });

// ---- creature detail and loadout ---------------------------------------------------------------
function statBlock(inst) {
  const s = C.stats(inst, R.bonus(run));
  return `<div class="stats"><div>HP<b>${s.hp}</b></div><div>ATK<b>${Math.round(s.atk)}</b></div><div>DEF<b>${Math.round(s.def)}</b></div><div>Speed<b>${s.as.toFixed(2)}</b></div></div>
    <div class="small">Range ${s.range} · ${inst.boss ? '' : `Strong vs ${G.STRONG[C.elOf(inst)].map(e => G.EL[e].name).join(', ')} · Weak to ${G.ELS.filter(e => G.STRONG[e].includes(C.elOf(inst))).map(e => G.EL[e].name).join(', ')}`}</div>`;
}
function skillRows(inst, pickable) {
  const basic = G.SK[C.basicOf(inst)];
  let h = `<div class="skl el-${basic.el === 'flux' ? 'shade' : basic.el}"><span class="t">${basic.n}</span> <span class="small muted">basic attack</span><div class="small">${basic.d || 'Its regular attack.'}</div></div>`;
  const cs = C.castables(inst);
  const all = inst.boss ? cs : G.SP[inst.sp].sk.slice(1);
  for (const id of all) {
    const sk = G.SK[id], has = cs.includes(id), sel = inst.skill === id;
    h += `<div class="skl el-${sk.el === 'flux' ? 'shade' : sk.el} ${has ? '' : 'locked'}" ${pickable && has ? `data-v="sk:${id}" style="cursor:pointer;${sel ? 'box-shadow:inset 3px 0 0 var(--c),0 0 0 2px #fff' : ''}"` : sel ? 'style="box-shadow:inset 3px 0 0 var(--c),0 0 0 2px #fff"' : ''}>
      <span class="t">${sel ? '● ' : pickable && has ? '○ ' : ''}${sk.n}</span> <span class="small muted">${sk.ult ? 'ULTIMATE · ' : ''}${C.manaCost(id)} mana</span><div class="small">${sk.d}${has ? '' : ' <i>(unlocks at ★2)</i>'}</div></div>`;
  }
  return h;
}
// the merge perk: ★2 unlocks it, ★3 upgrades it and adds an aura for same-element or same-role allies
function perkRow(inst) {
  const S = G.SP[inst.sp], P = S && S.perk; if (!P || inst.boss) return '';
  const K = G.PERK_KINDS[P.kind], st = inst.star || 1;
  return `<h3 style="margin:10px 0 4px">Merge perk <span class="small muted">(★2 unlocks · ★3 empowers)</span></h3>
    <div class="skl perkrow el-${S.el} ${st < 2 ? 'locked' : ''}"><span class="t">✦ ${P.name}</span> <span class="small muted">${st >= 3 ? 'EMPOWERED' : st >= 2 ? 'active' : 'locked'}</span>
      <div class="small">${K.d(st >= 3 ? 2 : 1)}${st < 2 ? ' <i>(unlocks at ★2)</i>' : ''}</div>
      <div class="small ${st < 3 ? 'muted' : ''}" style="margin-top:3px">★3: ${st < 3 ? K.d(2) + ' ' : ''}<b>Aura</b> — ${P.aura.d}.</div></div>`;
}
// Selling the only creature would leave nothing that can fight. Warn; the player can still choose to sell.
async function confirmLastSell(u) {
  if (!u || run.units.length > 1) return true;
  const v = await ask('Sell your last creature?', '<p style="text-align:center">The board would stand empty, and FIGHT stays sealed until you buy another. The Glimmer does not start a battle with no one to send.</p>', btn('y', 'Sell anyway', 'ghost') + btn('n', 'Keep them', 'green'));
  return v === 'y';
}
async function unitDetail(uid) {
  for (;;) {
    const u = run.units.find(z => z.uid === uid); if (!u) return;
    const S = G.SP[u.sp];
    const body = `<div class="detail"><div class="big el-${S.el}">${monImg(u)}</div><div>
      <div class="row wrap">${elBadge(S.el)}${u.el2 ? elBadge(u.el2) + '<span class="small muted">Dual</span>' : ''}<span class="tag">${ROLE_N[S.role]}</span><span class="tag" style="color:#ffd65a">${starsTxt(u.star)}</span><span class="tag">Tier ${G.TIER[u.sp]}</span>${u.shiny ? '<span class="tag" style="background:#6a5bff">Shiny +10%</span>' : ''}</div>
      ${statBlock(u)}
      <div class="small muted" style="margin-top:4px">${u.star >= 4 ? 'Apex form' : u.star === 3 ? (((meta.apex || {})[u.sp] || 0) > 0 && S.names[3] ? `Apex ◆ ×${meta.apex[u.sp]} available` : 'Final form.') : `${R.copiesNeeded(run, u.star)} copies of ★${u.star} merge into ${S.names[u.star]} ★${u.star + 1}.`}</div>
      ${u.muts.length ? `<div class="small" style="margin-top:4px">Mutations: ${u.muts.map(m => `<b>${G.MUTS[m].n}</b> (${G.MUTS[m].d})`).join(', ')}</div>` : ''}
      <div class="li" style="margin-top:8px">${u.charm ? `<img class="ic" src="${IMG('ch_' + u.charm)}" alt=""><div class="grow"><div class="t">${G.CHARMS[u.charm].n}</div><div class="small">${G.CHARMS[u.charm].d}</div></div>` : '<div class="grow muted">No charm held</div>'}<button class="btn sm ghost" data-v="charm">Change</button></div>
      </div></div><h3 style="margin:10px 0 4px">Power <span class="small muted">(tap one: it casts automatically when its mana fills)</span></h3>${skillRows(u, true)}${perkRow(u)}`;
    const canAsc = u.star === 3 && ((meta.apex || {})[u.sp] || 0) > 0 && !!S.names[3];
    const acts = (u.at === 'b' ? btn('bench', 'To bench', 'ghost sm') : btn('board', 'To board', 'ghost sm')) + (canAsc ? btn('ascend', 'Ascend ◆', 'green sm') : '') + btn('sell', `Sell ${R.sellValue(u)}g`, 'ghost sm') + btn('close', 'Done', 'green sm');
    const v = await modal(`${starsTxt(u.star)} ${esc(C.name(u))}`, body, acts, 'close');
    closeModal();
    if (v === 'close') break;
    if (v.startsWith('sk:')) { u.skill = v.slice(3); save(); continue; }
    if (v === 'ascend') { const r = R.ascend(run, u.uid, meta); if (r) { window.AX && AX.ev('ascend'); await evoCinematic(u); save(); renderGame(); } break; }
    if (v === 'sell') { if (!(await confirmLastSell(u))) continue; const g = R.sell(run, u.uid); SFX.coin(); toast(`Sold for ${g} gold.`); break; }
    if (v === 'bench') { const f = R.freeBench(run); if (f < 0) toast('Your bench is full.'); else R.placeBench(run, u.uid, f); break; }
    if (v === 'board') {
      let done = false;
      for (let x = R.PW - 1; x >= 0 && !done; x--) for (let y = 0; y < C.H && !done; y++) if (!R.unitAt(run, x, y)) done = R.placeBoard(run, u.uid, x, y);
      if (!done) toast(`Board full: Tamer level ${run.tlv} allows ${R.cap(run)} creatures.`);
      break;
    }
    if (v === 'charm') {
      const c = await ask('Give a charm', `<div class="list">${Array.from(new Set(run.charms)).map(k => `<div class="li click" data-v="${k}"><img class="ic" src="${IMG('ch_' + k)}" alt=""><div class="grow"><div class="t">${G.CHARMS[k].n} ×${run.charms.filter(x => x === k).length}</div><div class="small">${G.CHARMS[k].d}</div></div></div>`).join('') || '<p class="muted" style="text-align:center">No spare charms. Wild rounds sometimes drop them.</p>'}</div>`, (u.charm ? btn('none', 'Take it off', 'ghost sm') : '') + btn('x', 'Cancel', 'sm'));
      if (c === 'none') R.equipCharm(run, u.uid, null); else if (c !== 'x') R.equipCharm(run, u.uid, c);
      save();
    }
  }
  renderGame();
}
async function enemyInfo(i) {
  const p = R.enemyBoard(run)[i]; if (!p) return;
  const inst = p.inst;
  await ask(`${inst.boss ? '♛' : starsTxt(inst.star)} ${esc(C.name(inst))}${inst.elite ? ' · ' + inst.elite : ''}`, `<div class="detail"><div class="big el-${C.elOf(inst)}"><img src="${IMG(C.art(inst))}" alt=""></div><div>
    <div class="row wrap">${elBadge(C.elOf(inst))}<span class="tag">${ROLE_N[C.roleOf(inst)]}</span></div>${statBlock(inst)}${inst.boss && G.BOSSES[inst.boss].pd ? `<div class="small" style="margin-top:6px;color:var(--gold)">♛ ${G.BOSSES[inst.boss].pd} Enrages below half HP.</div>` : ''}</div></div><h3 style="margin:10px 0 4px">Skills</h3>${skillRows(inst, false)}${perkRow(inst)}`, btn('ok', 'Close', 'green sm'), 'ok');
}

// ---- the fight ---------------------------------------------------------------------------------
let FS = null;
function arenaOn() {
  try { return new URLSearchParams(location.search).get('arena') === '1' && !!window.GArena; }
  catch (e) { return false; }
}
function stopFight() {
  if (FS && FS.raf) cancelAnimationFrame(FS.raf);
  if (window.GArenaView) GArenaView.unmount();
  const cv = document.getElementById('arenaCv');
  if (cv) cv.remove();
  if (boardEl) boardEl.classList.remove('arena-on');
  FS = null;
  if (window.GAUDIO) GAUDIO.setSpeed(1);
}
function uEl(id) { return FS && FS.els[id]; }
function startFight() {
  if (phase !== 'plan') return;
  if (!R.onBoard(run).length) { toast('The board is empty. Place a creature before the fight can start.'); return; }
  if (R.onBoard(run).length < R.cap(run) && R.onBench(run).length) toast(`You have room for ${R.cap(run) - R.onBoard(run).length} more on the board.`);
  phase = 'fight';
  const seed = (run.seed * 31 + run.round * 977 + Date.now() % 100000) >>> 0;
  const Eng = arenaOn() ? window.GArena : C;
  const st = Eng.create(R.fightOpts(run, seed));
  FS = { st, eng: Eng, arena: Eng !== C, speed: meta.speed || 1, acc: 0, last: performance.now(), els: {}, ending: false, popN: 0, hold: 0 };
  if (window.GAUDIO) GAUDIO.setSpeed(FS.speed);
  syncGaSpeed();
  VFX.speed = FS.speed; VFX.resize();
  $('#game').classList.add('fighting');
  if (FS.arena) mountArena();
  else {
    unitsEl.innerHTML = st.units.map(u => unitHtml('u' + u.id, { x: u.x, y: u.y, star: u.star, side: u.side, boss: u.boss, elite: u.elite, art: u.art, shiny: u.shiny, hp: u.hp, maxHp: u.maxHp, mana: u.mana })).join('');
    for (const u of st.units) cacheEl(u);
  }
  renderFightBar();
  $('#gTraits').innerHTML = traitsHtml(R.onBoard(run));
  boardEl.style.setProperty('--mv', (0.42 / FS.speed) + 's');
  const kind = R.roundKind(run.round);
  if (kind === 'boss') banner(st.units.find(u => u.boss).name, G.BOSSES[st.units.find(u => u.boss).boss].el);
  const bossId = kind === 'boss' ? R.bossOf(run) : null;           // 'wyrm' only for the Glimmerwyrm
  mus(bossId === 'wyrm' ? 'glimmerwyrm' : kind === 'boss' ? 'boss' : R.stageOf(run.round) >= G.STAGES - 1 ? 'core' : 'fight');
  if (kind === 'boss') SFX.bossbanner(); else SFX.fightstart();    // one start cue at a time: bossbanner (1.4 s) already is the boss start, fightstart would stack on it
  if (FS.arena) handleArena(st.ev.splice(0));
  else handle(st.ev.splice(0));
  FS.raf = requestAnimationFrame(loop);
}
// ---- a live fight outside a run (The Wilds): same board and playback, no shop or bench ----------
// board/enemies: [{inst, x, y}]; resolves with the finished fight state
// extra: a team bonus on top of the camp's (Wilds relics and Wilds upgrades)
function wildBattle(board, enemies, biome, title, extra, foeBonus) {
  return new Promise(res => {
    stopFight();
    phase = 'fight';
    const seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
    const Eng = arenaOn() ? window.GArena : C;
    const st = Eng.create({ board, enemies, relics: [], perks: {}, biome, seed, depth: 0, camp: Object.entries(extra || {}).reduce((b, [k, v]) => (b[k] = (b[k] || 0) + v, b), R.campBonus(meta.up)), foeBonus, noHaz: true, mods: {} });
    FS = { st, eng: Eng, arena: Eng !== C, speed: meta.speed || 1, acc: 0, last: performance.now(), els: {}, ending: false, popN: 0, hold: 0, wild: res };
    if (window.GAUDIO) GAUDIO.setSpeed(FS.speed);
    syncGaSpeed();
    VFX.speed = FS.speed; VFX.clear();
    show('game');
    $('#game').classList.add('fighting', 'wild');
    boardEl.classList.remove('ult');
    $('#gBg').style.backgroundImage = `url(${IMG(G.BIOMES[biome].bg)})`;
    $('#gTop').innerHTML = `<div class="grow"><div class="title">${title}</div><div class="small muted">The Wilds · ${G.BIOMES[biome].name}</div></div>`;
    const c = C.traitCounts(board.map(p => p.inst));
    $('#gTraits').innerHTML = G.ELS.filter(e => c.el[e]).map(e => `<span class="trait el-${e} ${c.el[e] >= G.EL_AT[0] ? 'on' : ''}">${elBadge(e)}${G.EL[e].name} ${c.el[e]}</span>`).join('');
    if (!$('#cells').children.length) renderCells();
    fxEl.innerHTML = '';
    if (FS.arena) mountArena();
    else {
      unitsEl.innerHTML = st.units.map(u => unitHtml('u' + u.id, { x: u.x, y: u.y, star: u.star, side: u.side, boss: u.boss, elite: u.elite, art: u.art, shiny: u.shiny, hp: u.hp, maxHp: u.maxHp, mana: u.mana })).join('');
      for (const u of st.units) cacheEl(u);
    }
    renderFightBar();
    boardEl.style.setProperty('--mv', (0.42 / FS.speed) + 's');
    mus(String(title).includes('\u265b') ? 'wilds_lair' : 'wilds_fight');   // \u265b = the crown glyph wilds.js puts in lair titles
    setTimeout(() => { if (FS) SFX.fightstart(); }, 350);                    // wencounter (0.7 s) started ~380 ms ago in wilds.js battle(); stagger so the two do not stack
    if (FS.arena) handleArena(st.ev.splice(0));
    else handle(st.ev.splice(0));
    FS.raf = requestAnimationFrame(loop);
  });
}
function wildEnd() {
  if (!FS || !FS.wild) return;
  const st = FS.st, res = FS.wild;
  stopFight();
  phase = 'busy';
  $('#game').classList.remove('fighting', 'wild');
  res(st);
}
function cacheEl(u) {
  const el = unitsEl.querySelector(`[data-k="u${u.id}"]`); if (!el) return;
  const bars = el.querySelectorAll('.bar i');
  FS.els[u.id] = { el, hp: bars[0], sh: bars[1], mp: el.querySelector('.bar.mp i'), sts: el.querySelector('.sts'), rig: el.querySelector('.rig'), lastSt: '' };
  noteAnim(u);
}
function renderFightBar() {
  if (FS && FS.arena) {
    const sp = FS.speed;
    const spd = (v, label) => `<button class="btn ghost sm${sp === v ? ' on' : ''}" data-v="spd:${v}" type="button">${label}</button>`;
    $('#fightBar').innerHTML = `<span class="arena-sr" id="arenaTime">0:00</span>${spd(1, '1×')}${spd(1.5, '1.5×')}${spd(2, '2×')}${spd(4, '4×')}${btn(FS.paused ? 'resume' : 'pause', FS.paused ? 'Resume' : 'Pause', 'ghost sm')}${btn('skip', 'Skip', 'ghost sm')}`;
    return;
  }
  $('#fightBar').innerHTML = `<span class="muted fred">Fighting…</span>${btn('speed', (FS ? FS.speed : 1) + '× speed', 'ghost sm')}${btn('skip', 'Skip', 'ghost sm')}`;
}
$('#fightBar').addEventListener('click', e => {
  const b = e.target.closest('[data-v]'); if (!b || !FS) return;
  SFX.click();
  if (FS.arena && b.dataset.v.indexOf('spd:') === 0) {
    FS.speed = +b.dataset.v.slice(4);
    if (FS.speed === 1 || FS.speed === 2 || FS.speed === 4) meta.speed = FS.speed;
    VFX.speed = FS.speed; syncGaSpeed(); if (window.GAUDIO) GAUDIO.setSpeed(FS.speed); boardEl.style.setProperty('--mv', (0.42 / FS.speed) + 's'); renderFightBar();
  } else if (FS.arena && (b.dataset.v === 'pause' || b.dataset.v === 'resume')) { FS.paused = !FS.paused; renderFightBar(); }
  else if (b.dataset.v === 'speed') { FS.speed = FS.speed >= 4 ? 1 : FS.speed * 2; meta.speed = FS.speed; VFX.speed = FS.speed; syncGaSpeed(); if (window.GAUDIO) GAUDIO.setSpeed(FS.speed); boardEl.style.setProperty('--mv', (0.42 / FS.speed) + 's'); renderFightBar(); }
  else if (b.dataset.v === 'skip') { FS.skip = true; if (FS.arena && window.GArenaView) GArenaView.skipIntro(); }
});
function loop(ts) {
  if (!FS) return;
  const st = FS.st;
  const Eng = FS.eng || C;
  const wall = Math.min(0.1, (ts - FS.last) / 1000);
  let dt = wall * FS.speed;
  if (FS.hold > 0) { FS.hold -= wall; dt = 0; }
  if (FS.paused) dt = 0;
  if (FS.arena && window.GArenaView && GArenaView.holding()) dt = 0;
  FS.last = ts;
  if (FS.skip && !st.over) { if (FS.arena && window.GArenaView) GArenaView.skipIntro(); Eng.resolve(st); st.ev.length = 0; if (!FS.arena) resyncAll(); }
  FS.acc += dt;
  if (FS.arena && FS.acc > Eng.DT * 8) FS.acc = Eng.DT * 8;
  while (FS.acc >= Eng.DT && !st.over) { FS.acc -= Eng.DT; const ev = Eng.tick(st); st.ev.length = 0; if (FS.arena) handleArena(ev); else handle(ev); }
  if (FS.arena) drawArena(wall, dt);
  else for (const u of st.units) syncBars(u);
  if (st.over && !FS.ending) { FS.ending = true; setTimeout(FS.wild ? wildEnd : endFight, FS.skip ? 200 : 900 / Math.min(2, FS.speed)); }
  FS.raf = requestAnimationFrame(loop);
}
function mountArena() {
  unitsEl.innerHTML = '';
  VFX.clear();
  const biome = (FS.st && FS.st.biome) || (run && run.biome) || 'verdant';
  const bgKey = G.BIOMES[biome] && G.BIOMES[biome].bg;
  if (window.GArenaView) {
    GArenaView.mount(boardEl, {
      biome, bg: bgKey ? IMG(bgKey) : '', art: IMG,
      onHold(sec) { if (FS && !FS.skip && !FS.paused) FS.hold = Math.max(FS.hold || 0, sec); },
    });
  }
}
function arenaExtras(st) {
  const out = [];
  for (const u of st.units) {
    const sts = [];
    if (u.st) for (const k in u.st) if (u.st[k]) sts.push(k);
    const sk = u.skill && G.SK[u.skill];
    out.push({
      id: u.id, art: u.art, sp: u.inst && u.inst.sp, role: u.role, range: u.range,
      focus: u.focusId || 0, statuses: sts, shiny: !!u.shiny, stun: !!(u.st && u.st.stun),
      wind: u.wind || 0.22, recover: u.recover || 0.16,
      atkT: u.state === 'attack' ? (u.atkT || 0) : null,
      castT: u.state === 'cast' ? (u.castT || 0) : null,
      castDur: (u.castShape && (u.castShape.cast || 0.4)) || 0.4,
      ult: !!(sk && sk.ult && u.state === 'cast'),
    });
  }
  return out;
}
function handleArena(ev) {
  if (window.GArenaView) GArenaView.push(ev);
  for (let i = 0; i < ev.length; i++) {
    const e = ev[i];
    if (e.k === 'text' && e.v) toast(e.v);
    else if (e.k === 'dmg' && !e.dot) {
      if (e.crit) SFX.crit();
      else if (!e.basic || Math.random() < 0.35) SFX.el('hit', e.el, { v: e.basic ? 0.7 : 1 });
    } else if (e.k === 'ko') SFX.ko();
    else if (e.k === 'cast' && e.ult) SFX.el('ult', e.el);
    else if (e.k === 'cast') SFX.el('cast', e.el);
    else if (e.k === 'heal' && !e.quiet && e.v > 0) SFX.heal();
    else if (e.k === 'shield') SFX.shield();
    else if (e.k === 'miss') SFX.miss();
  }
}
function drawArena(wall, motion) {
  if (!FS || !window.GArena || !window.GArenaView) return;
  const step = FS.eng && FS.eng.DT ? FS.eng.DT : 1 / 30;
  const held = FS.hold > 0 || FS.paused || GArenaView.holding();
  const alpha = held ? 0 : Math.max(0, Math.min(0.999, FS.acc / step));
  const view = window.GArena.view(FS.st, alpha);
  GArenaView.frame(view, {
    wallDt: FS.paused ? 0 : (wall || 0),
    motionDt: held ? 0 : (motion || 0),
    paused: !!FS.paused,
    alpha, extras: arenaExtras(FS.st),
  });
  const clock = document.getElementById('arenaTime');
  if (clock) {
    const sec = Math.floor(view.t || 0);
    const label = Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
    if (clock.textContent !== label) clock.textContent = label;
  }
}
function resyncAll() {
  for (const u of FS.st.units) {
    let E = uEl(u.id);
    if (!E) { unitsEl.insertAdjacentHTML('beforeend', unitHtml('u' + u.id, { x: u.x, y: u.y, star: u.star, side: u.side, boss: u.boss, art: u.art })); cacheEl(u); E = uEl(u.id); }
    E.el.style.left = u.x * 12.5 + '%'; E.el.style.top = u.y * 20 + '%';
    E.el.classList.toggle('dead', !u.alive);
  }
}
const ST_LABEL = { burn: 'BRN', poison: 'PSN', soak: 'WET', stun: 'STUN', root: 'ROOT', curse: 'CRS', blind: 'BLD', chill: 'CHL', shred: 'SHR', hex: 'HEX', atkUp: 'ATK', defUp: 'DEF', spdUp: 'SPD', critUp: 'CRT', dodge: 'EVA', regen: 'RGN', taunt: 'TNT' };
function syncBars(u) {
  const E = uEl(u.id); if (!E) return;
  E.hp.style.width = (100 * u.hp / u.maxHp) + '%';
  E.hp.className = hpClass(u.hp / u.maxHp);
  if (E.sh) E.sh.style.width = Math.min(100, 100 * u.shield / u.maxHp) + '%';
  if (E.mp) E.mp.style.width = Math.min(100, 100 * u.mana / C.manaNeed(FS.st, u)) + '%';
  let s = '';
  for (const k in u.st) if (ST_LABEL[k]) s += `<span class="st ${['atkUp', 'defUp', 'spdUp', 'critUp', 'dodge', 'regen'].includes(k) ? 'buff' : k}">${ST_LABEL[k]}${k === 'poison' ? u.st[k].n : ''}</span>`;
  if (s !== E.lastSt) { E.sts.innerHTML = s; E.lastSt = s; }
}
// positions in board percent
function cpos(u) { return { x: (u.x + 0.5) * 12.5, y: (u.y + 0.45) * 20 }; }
function popAt(u, text, cls) {
  if (!u || FS.popN > 26) return;
  const p = document.createElement('div');
  const c = cpos(u);
  p.className = 'pop ' + (cls || '');
  p.textContent = text;
  p.style.left = (c.x + (Math.random() * 4 - 2)) + '%'; p.style.top = (c.y - 6) + '%';
  fxEl.appendChild(p); FS.popN++;
  setTimeout(() => { p.remove(); if (FS) FS.popN--; }, 1000);
}
// projectiles, slashes and impacts are drawn by the canvas layer in fx.js
function orb(a, b, el, ms, o) { if (a && b) VFX.shoot(cpos(a), cpos(b), el, ms, null, o); }
function burst(u, el, big) { if (!u) return; if (big) VFX.shockwave(cpos(u), el); else VFX.impact(cpos(u), el); }
function later(ms, f) { setTimeout(() => { if (FS) f(); }, ms / FS.speed); }
// a crit freezes the fight for a beat so the blow lands
function hitStop(s) { if (FS && !FS.skip) FS.hold = Math.max(FS.hold || 0, s); }
function banner(text, el) {
  const b = document.createElement('div');
  b.className = 'banner' + (el ? ' el-' + el : '');
  b.textContent = text; fxEl.appendChild(b); setTimeout(() => b.remove(), 1150);
}
function face(u, toX) {
  const E = uEl(u.id); if (!E || toX === u.x) return;
  const left = toX < u.x;
  E.el.classList.toggle('faceL', left); E.el.classList.toggle('faceR', !left);
}
const ELC = { ember: '#ff7a2a', tide: '#2fa6ff', bloom: '#4fd35a', volt: '#ffd21f', stone: '#e0a860', shade: '#9d8bff', frost: '#8fe3ff', gale: '#7dffc2', metal: '#d8e2ee', mystic: '#d9a6ff' };
function rig(id, frames, ms, fill) {
  const E = uEl(id); if (!E) return;
  E.rig.animate(frames, { duration: ms / FS.speed, easing: 'ease-in-out', fill: fill || 'none' });
}
function animStrike(a, t, el) {
  const E = uEl(a.id), T = uEl(t.id);
  if (GA && GA.enabled && E && T) return GA.strike(E.el, T.el, { el, rng: 0 });
  const dx = Math.sign(t.x - a.x), dy = Math.sign(t.y - a.y);
  rig(a.id, [{ transform: 'none' }, { transform: `translate(${-8 * dx}%, ${-4 * dy}%) scale(1.08,.88)`, offset: 0.3 },
    { transform: `translate(${34 * dx}%, ${22 * dy - 8}%) rotate(${12 * dx}deg) scale(1.12,.92)`, offset: 0.55 }, { transform: 'none' }], 380);
}
function animShoot(a, t, el) {
  const E = uEl(a.id), T = uEl(t.id);
  if (GA && GA.enabled && E && T) return GA.shoot(E.el, T.el, { el });
  const dx = Math.sign(t.x - a.x) || 1, glow = `drop-shadow(0 0 10px ${ELC[el] || '#fff'})`;
  rig(a.id, [{ transform: 'none', filter: 'none' }, { transform: `translateX(${-8 * dx}%) rotate(${-8 * dx}deg) scale(.96,1.06)`, filter: glow, offset: 0.4 },
    { transform: `translateX(${8 * dx}%) scale(1.08,.94)`, filter: glow, offset: 0.6 }, { transform: 'none', filter: 'none' }], 360);
}
function animCast(u, el, ult) {
  const E = uEl(u.id);
  if (GA && GA.enabled && E) return GA.cast(E.el, { el, ult: !!ult });
  const glow = `drop-shadow(0 0 ${ult ? 18 : 12}px ${ELC[el] || '#fff'}) drop-shadow(0 0 4px #fff)`;
  rig(u.id, [{ transform: 'none', filter: 'none' }, { transform: 'translateY(4%) scale(1.12,.84)', offset: 0.2 },
    { transform: `translateY(-22%) scale(${ult ? 1.3 : 1.12})`, filter: glow, offset: 0.55 }, { transform: 'translateY(2%) scale(1.08,.92)', filter: glow, offset: 0.8 },
    { transform: 'none', filter: 'none' }], ult ? 700 : 520);
}
function animHit(t, a, crit, dot) {
  const T = uEl(t.id);
  if (GA && GA.enabled && T) {
    GA.hit(T.el, { from: a && uEl(a.id) && uEl(a.id).el, crit: !!crit, dot });
    if (crit) boardEl.animate([{ transform: 'none' }, { transform: 'translate(-5px,3px)' }, { transform: 'translate(4px,-3px)' }, { transform: 'none' }], { duration: 260 });
    return;
  }
  const d = a ? Math.sign(t.x - a.x) || (t.side ? 1 : -1) : 0;
  const flash = dot === 'burn' ? 'brightness(1.5) sepia(1) saturate(5) hue-rotate(-25deg)' : dot === 'poison' ? 'brightness(1.3) sepia(1) saturate(4) hue-rotate(230deg)'
    : dot ? 'brightness(1.6)' : 'brightness(3) saturate(0)';
  if (crit) boardEl.animate([{ transform: 'none' }, { transform: 'translate(-5px,3px)' }, { transform: 'translate(4px,-3px)' }, { transform: 'none' }], { duration: 260 });
  if (dot) return rig(t.id, [{ filter: 'none' }, { filter: flash, transform: 'scale(1.05,.94)', offset: 0.3 }, { filter: 'none' }], 300);
  const k = crit ? 22 : 12;
  rig(t.id, [{ transform: 'none', filter: 'none' }, { transform: `translateX(${k * d}%) rotate(${(crit ? 14 : 8) * d}deg) scale(.9,1.06)`, filter: flash, offset: 0.15 },
    { transform: `translateX(${k * 0.5 * d}%) scale(1.05,.94)`, filter: 'none', offset: 0.45 }, { transform: 'none', filter: 'none' }], crit ? 460 : 340);
}
function handle(ev) {
  const st = FS.st, F = id => C.byId(st, id);
  const LAST = FS.lastSk || (FS.lastSk = {});   // per attacker: element + when its hit lands on screen (ms at 1x), so the impact sound lines up with the fx impact
  for (const e of ev) {
    if (e.k === 'move') {
      const u = F(e.u), E = uEl(e.u);
      if (E) { face(u, e.x); E.el.style.left = e.x * 12.5 + '%'; E.el.style.top = e.y * 20 + '%'; if (GA && GA.enabled && FS.speed < 4 && st.units.length <= 14) GA.walk(E.el); }
    }
    else if (e.k === 'blink') { const E = uEl(e.u); if (E) { E.el.style.transition = 'none'; E.el.style.left = e.x * 12.5 + '%'; E.el.style.top = e.y * 20 + '%'; void E.el.offsetWidth; E.el.style.transition = ''; burst(F(e.u), 'shade', true); } }
    else if (e.k === 'atk') {
      const a = F(e.a), t = F(e.t); if (!a || !t) continue;
      face(a, t.x);
      if (e.rng) {
        const leave = ga1x(animShoot(a, t, e.el));                         // module: ms until the projectile leaves; keep 70 when it is already close
        const launch = leave && Math.abs(leave - 70) > 120 ? leave : 70;
        LAST[e.a] = { el: e.el, dly: launch + 230 };                       // flight stays 230 ms; the hit sound uses this
        later(launch, () => orb(a, t, e.el, 230 / FS.speed));
      } else {
        const dly = ga1x(animStrike(a, t, e.el)) || 170;                   // slash lands on the strike's contact frame
        LAST[e.a] = { el: e.el, dly };
        const A = cpos(a), T = cpos(t); later(dly, () => VFX.slash(A, T, e.el));
      }
    }
    else if (e.k === 'cast') {
      const a = F(e.a); if (!a) continue;
      const peak = ga1x(animCast(a, e.el, e.ult));
      let boltAt = 200, ultAt = 260;                                       // pose peak vs bolt launch / ult beam; shift only past 80 ms
      if (peak && e.ult && Math.abs(peak - ultAt) > 80) ultAt = peak;
      else if (peak && !e.ult && Math.abs(peak - boltAt) > 80) boltAt = peak;
      LAST[e.a] = { el: e.el, ult: e.ult, dly: e.ult ? ultAt : boltAt + 240 };
      VFX.cast(cpos(a), e.el, e.ult);
      if (e.ult) { boardEl.classList.add('ult'); banner(e.n, e.el); SFX.el('ult', e.el); setTimeout(() => boardEl.classList.remove('ult'), 650 / FS.speed); hitStop(0.12); }
      else { popAt(a, e.n, 'cast'); SFX.el('cast', e.el); }
      const tgs = e.tg.map(F).filter(Boolean), foes = tgs.filter(t => t.side !== a.side);
      // allies get a link beam; foes get bolts (ult: beams), area spells finish on a ground shockwave
      const linkAt = 220 + (e.ult ? ultAt - 260 : 0), aoeAt = 240 + (e.ult ? ultAt - 260 : boltAt - 200);
      for (const t of tgs) if (t.side === a.side && t !== a) { const A = cpos(a), T = cpos(t); later(linkAt, () => { VFX.beam(A, T, e.el, 0.1, 0.28); VFX.impact(T, e.el, 0.6); }); }
      if (e.aoe && foes.length > 1) {
        const c = { x: foes.reduce((s, t) => s + cpos(t).x, 0) / foes.length, y: foes.reduce((s, t) => s + cpos(t).y, 0) / foes.length };
        later(aoeAt, () => orb(a, { x: (c.x / 12.5) - 0.5, y: c.y / 20 - 0.45 }, e.el, 220 / FS.speed, { big: 1, power: 1.4 }));
        later(aoeAt + 220, () => { VFX.shockwave(c, e.el, e.ult ? 1.5 : 1); for (const t of foes) VFX.impact(cpos(t), e.el, 0.8); });
      } else for (const t of foes) {
        const A = cpos(a), T = cpos(t);
        if (e.ult) later(ultAt, () => { VFX.beam(A, T, e.el, 0.3, 0.42); VFX.impact(T, e.el, 2, true); });
        else later(boltAt, () => orb(a, t, e.el, 240 / FS.speed, { big: 1, power: 1.5 }));
      }
    }
    else if (e.k === 'aim') {
      const a = F(e.a), t = F(e.t);
      if (a && t) {
        const leave = ga1x(animShoot(a, t, e.el));
        const launch = leave && Math.abs(leave) > 120 ? leave : 0;
        LAST[e.a] = { el: e.el, dly: launch + 200 };
        SFX.el('cast', e.el, { v: 0.6 });
        if (launch) later(launch, () => orb(a, t, e.el, 200 / FS.speed, { big: 1 }));
        else orb(a, t, e.el, 200 / FS.speed, { big: 1 });
      }
    }
    else if (e.k === 'zap') { const a = F(e.a), t = F(e.t); if (a && t) orb(a, t, 'volt', 150 / FS.speed); }
    else if (e.k === 'perk') perkFx(e, F(e.a), F(e.t));
    else if (e.k === 'dmg') {
      const t = F(e.t); if (!t) continue;
      const a = e.a != null ? F(e.a) : null;
      animHit(t, a, e.crit, e.dot);
      if (e.crit) { hitStop(0.07); if (!e.basic) VFX.impact(cpos(t), (a && a.el) || 'gold', 1.2, true); }
      else if (e.dot) VFX.impact(cpos(t), e.dot === 'burn' ? 'ember' : e.dot === 'poison' ? 'shade' : e.dot === 'bleed' ? 'blood' : 'frost', 0.35);
      else if (e.thorn) VFX.impact(cpos(t), 'bloom', 0.5);
      if (!e.basic || e.crit || e.v >= t.maxHp * 0.08) popAt(t, (e.crit ? e.v + '!' : e.v), e.crit ? 'crit' : e.dot ? 'dot' : e.basic ? 'small' : '');
      if (!e.dot) {                                                       // element-aware impact, timed to the fx impact (was: SFX.crit() / SFX.hit())
        const L = LAST[e.a] || {}, el = e.el || (e.thorn ? 'bloom' : L.el) || (a && a.el), d = e.thorn ? 0 : L.dly || 0;
        if (e.crit) { SFX.crit(); later(d, () => SFX.el('hit', el, { v: 0.8 })); }
        else if (!e.basic) later(d, () => SFX.el('hit', el, { v: e.thorn || L.ult ? 0.5 : 1 }));   // skill hits always sound; ult beams sit under the ult cue
        else if (Math.random() < 0.35) later(d, () => SFX.el('hit', el, { v: 0.7 }));            // basic attacks: 35 %, a bit softer (as before)
      }
    }
    else if (e.k === 'miss') { popAt(F(e.t), e.dodge ? 'Dodge' : 'Miss', 'miss'); SFX.miss(); }
    else if (e.k === 'heal') { if (!e.quiet && e.v > 0) { popAt(F(e.t), '+' + e.v, 'heal'); SFX.heal(); const t = F(e.t); if (t) VFX.heal(cpos(t)); } }
    else if (e.k === 'shield') { popAt(F(e.t), '+' + e.v, 'shield'); SFX.shield(); const t = F(e.t); if (t) VFX.shield(cpos(t)); }
    else if (e.k === 'react') { popAt(F(e.t), e.name, 'react'); SFX.reaction(e.name); }
    else if (e.k === 'ko') {
      const u = F(e.t), E = uEl(e.t); if (!E) continue;
      SFX.ko();
      VFX.ko(cpos(u), u.el);
      if (GA && GA.enabled) GA.faint(E.el);
      else {
        const d = u.side ? 1 : -1;
        E.rig.animate([{ transform: 'none', filter: 'none' }, { transform: `translateX(${10 * d}%) translateY(12%) rotate(${75 * d}deg) scale(.9)`, filter: 'grayscale(1) brightness(.6)' }], { duration: 450, fill: 'forwards' });
      }
      setTimeout(() => { if (!u.alive) E.el.classList.add('dead'); }, 380);
    }
    else if (e.k === 'revive') {
      const E = uEl(e.t); if (E) {
        E.el.classList.remove('dead');
        if (GA && GA.enabled) GA.revive(E.el); else E.rig.getAnimations().forEach(a => a.cancel());
        popAt(F(e.t), e.name, 'react');
      }
    }
    else if (e.k === 'summon') {
      const u = F(e.u); if (!u) continue;
      unitsEl.insertAdjacentHTML('beforeend', unitHtml('u' + u.id, { x: u.x, y: u.y, star: u.star, side: u.side, art: u.art, hp: u.hp, maxHp: u.maxHp }));
      cacheEl(u); burst(u, u.el, true); popAt(u, 'Summoned!', 'small'); SFX.summon();
    }
    else if (e.k === 'flux') { const E = uEl(e.t); if (E) popAt(F(e.t), '→ ' + G.EL[e.el].name, 'small'); }
    else if (e.k === 'text') toast(e.v);
    else if (e.k === 'pushed') popAt(F(e.t), 'Gust!', 'small');
    else if (e.k === 'star') { const t = F(e.t); if (t) { burst(t, 'mystic', true); popAt(t, 'Starfall!', 'small'); } }
  }
}
// merge-perk procs: each one gets its own look so a build's identity reads at a glance
function perkFx(e, a, t) {
  if (!a) return;
  const A = cpos(a), T = t ? cpos(t) : A, el = e.el || a.el;
  popAt(t && e.n !== 'Pierce' ? (e.heal ? t : a) : a, e.n, 'perk');
  switch (e.n) {
    case 'Frenzy': later(120, () => VFX.slash(A, T, el, { n: 3, crit: true })); break;
    case 'Cleave': later(180, () => VFX.slash(A, T, el, { wide: true, big: 1.7, power: 1.4 })); break;
    case 'Pierce': VFX.beam(A, T, el, 0.14, 0.3); VFX.impact(T, el, 0.9); break;
    case 'Last Stand': VFX.shield(A, true); VFX.aura(A, 'gold'); hitStop(0.06); break;
    case 'Soul Harvest': VFX.aura(A, 'shade'); VFX.speedLines(A, 'mystic'); break;
    case 'Bloodlust': VFX.aura(A, 'blood'); break;
    case 'Mend': VFX.beam(A, T, 'bloom', 0.07, 0.3); break;
    case 'Aegis': VFX.beam(A, T, 'shield', 0.08, 0.3); break;
    case 'Echo': VFX.shockwave(A, el, 1.1); break;
    case 'Surge': VFX.speedLines(A, el); VFX.aura(A, el); break;
    default: VFX.aura(A, el);
  }
}
function apexLines(drops) {
  return (drops || []).filter(d => d.k === 'apex' && G.SP[d.sp]).map(d => {
    const S = G.SP[d.sp], nm = S.names[3] || S.names[S.names.length - 1], prev = S.names[2] || S.names[S.names.length - 1];
    return `<div class="li" style="margin-top:8px"><img class="ic" src="${IMG('cr_' + d.sp + '4')}" alt=""><div class="grow"><div class="t" style="color:var(--gold)">Apex Core: ${esc(nm)}!</div><div class="small">Ascend a ★3 ${esc(prev)} to unlock this form.</div></div></div>`;
  }).join('');
}
async function endFight() {
  if (!FS) return;
  const st = FS.st;
  const kind = R.roundKind(run.round), round = run.round, bossName = kind === 'boss' ? G.BOSSES[R.bossOf(run)].name : '';
  const res = R.endRound(run, st);
  const hazOn = !!(G.BIOMES[run.biome] && G.BIOMES[run.biome].haz);
  const hazRelic = (run.relics || []).some(id => G.RELICS[id] && G.RELICS[id].tags && G.RELICS[id].tags.indexOf('hazard') >= 0);
  const kills = window.AX && AX.fightKills ? AX.fightKills(st) : st.units.filter(u => u.side === 1 && !u.alive).length;
  window.AX && AX.ev('fight', 1, { win: !!res.win, kind: res.kind, round: res.round, boss: res.kind === 'boss', elite: res.kind === 'elite', kills: kills, els: Array.from(new Set(st.units.filter(u => u.side === 0).map(u => u.el))), clean: !!res.win && !st.units.some(u => u.side === 0 && !u.alive && !u.summoned), hazard: !!(res.win && hazOn && !hazRelic) });
  const apex = R.rollApex(run, st, meta); if (apex) res.drops.push({ k: 'apex', sp: apex.sp });
  if (GA && GA.enabled && res.win) for (const u of st.units) if (u.side === 0 && u.alive) { const E = uEl(u.id); if (E) GA.cheer(E.el); }
  stopFight();
  phase = 'busy';
  save();
  SFX.stinger(res.win ? 'win' : 'lose');
  mus(run.over ? 'title' : 'plan');   // audio.js holds the new track until the stinger has finished
  const lines = [];
  if (window.FightStats) res.report = window.FightStats.block(st);
  if (res.loss) lines.push(`<p style="text-align:center;color:var(--bad);font-size:18px">−${res.loss} HP <span class="small muted">(${C.alive(st, 1).length} foes left standing)</span></p>`);
  else if (!res.win) lines.push('<p style="text-align:center">The smoke hid your retreat. No HP lost.</p>');
  if (run.over === 2) return gameOver(false, res);
  if (run.over === 1) return gameOver(true, res);
  lines.push(`<div class="row center wrap" style="gap:8px"><span class="pill"><img src="${IMG('ui_gold')}" alt="">+${res.gold} <span class="small muted">(5 base${res.interest ? ' + ' + res.interest + ' interest' : ''}${res.streak ? ' + streak' : ''}${res.win ? ' + 1 win' : ''})</span></span><span class="pill">+${res.xp} Tamer XP${res.lvUp ? ' · Level ' + run.tlv + '!' : ''}</span></div>`);
  for (const d of res.drops) {
    if (d.k === 'apex') { SFX.lvl(); lines.push(apexLines([d])); }
    else lines.push(`<div class="li" style="margin-top:8px"><img class="ic" src="${IMG((d.k === 'charm' ? 'ch_' : 'it_') + d.id)}" alt=""><div class="grow"><div class="t">Found: ${(d.k === 'charm' ? G.CHARMS : G.ITEMS)[d.id].n}</div><div class="small">${(d.k === 'charm' ? G.CHARMS : G.ITEMS)[d.id].d}</div></div></div>`);
  }
  if (res.retry) lines.push('<p style="text-align:center;color:var(--gold)">The Glimmerwyrm still stands. Strengthen your team and try again!</p>');
  if (res.report) lines.push(res.report);
  await ask(res.win ? (kind === 'boss' ? bossName + ' defeated!' : 'Victory!') : 'Defeat', lines.join(''), btn('ok', 'Continue', 'green'));
  // rewards
  for (const p of run.pending || []) {
    if (p.k === 'relic' && p.opts.length) await relicPick(p.opts, kind === 'boss' ? 'Boss treasure' : 'Elite treasure');
    else if (p.k === 'perk' && p.opts.length) {
      const k = await ask('Tamer perk', `<p class="muted" style="text-align:center">Pick a permanent perk for this run.</p><div class="cards">${p.opts.map(k => `<div class="card" data-v="${k}"><h3>${G.PERKS[k].n}</h3><p>${G.PERKS[k].d}</p></div>`).join('')}</div>`);
      R.takePerk(run, k);
    } else if (p.k === 'biome') {
      const b = p.opts.length === 1 ? p.opts[0] : await ask('Choose the next stage', `<div class="cards">${p.opts.map(k => { const bi = G.BIOMES[k]; return `<div class="card" data-v="${k}"><div class="art" style="height:110px"><img src="${IMG(bi.bg)}" alt="" style="border-radius:12px;max-height:110px"></div><h3>${bi.name}</h3><p><b style="color:var(--gold)">${bi.hazName}</b>: ${bi.hazDesc}</p><p>Counter: ${bi.counter}</p><p>Foes: ${Array.from(new Set(bi.els)).map(e => G.EL[e].name).join(', ')} · Boss: ${G.BOSSES[R.bossOf(run, k)].name}</p></div>`; }).join('')}</div>`);
      R.setBiome(run, b);
      toast('Stage ' + (R.stageOf(run.round) + 1) + ': ' + G.BIOMES[b].name);
    }
  }
  run.pending = [];
  if (R.fusionsAvailable(run).length) await forgeFlow();
  save();
  renderGame();
  void round;
}
function relicLi(id, v) {
  const r = G.RELICS[id];
  return `<div class="li click ${r.leg ? 'leg' : ''}" data-v="${v == null ? id : v}"><img class="ic" src="${IMG(r.ic || ('rl_' + id))}" alt=""><div class="grow"><div class="t">${r.n}</div><div class="small">${r.d}</div><div class="row wrap" style="gap:4px;margin-top:3px">${r.tags.map(t => `<span class="tag">${t}</span>`).join('')}</div></div></div>`;
}
async function relicPick(list, title) {
  const owned = (run && run.relics) || [];
  const c = C.relicTagCounts(owned);
  const hint = list.map(id => G.RELICS[id].tags.filter(t => c[t] === 2 && G.SETS[t]).map(t => `Taking ${G.RELICS[id].n} completes the <b>${G.SETS[t].n}</b> set: ${G.SETS[t].d}`)).flat();
  const fuse = list.map(id => G.FUSIONS.filter(f => (f[0] === id && owned.includes(f[1])) || (f[1] === id && owned.includes(f[0]))).map(f => `${G.RELICS[id].n} can fuse into <b>${G.RELICS[f[2]].n}</b>.`)).flat();
  const v = await ask(title || 'Choose a relic', `<div class="list">${list.map(id => relicLi(id)).join('')}</div>${hint.concat(fuse).map(h => `<p class="small" style="color:var(--gold);margin:8px 4px 0">${h}</p>`).join('')}`, btn('skip', 'Skip', 'ghost sm'));
  if (v !== 'skip' && G.RELICS[v] && run) { R.addRelic(run, v); window.AX && AX.ev('relic'); SFX.relic(); toast('Got ' + G.RELICS[v].n); }
}
async function forgeFlow() {
  const fs = R.fusionsAvailable(run);
  if (!fs.length) return false;
  const v = await ask('Forge a legendary?', `<p class="muted" style="text-align:center">Two of your relics can become one legendary.</p><div class="list">${fs.map((f, i) => `<div class="li click leg" data-v="${i}"><img class="ic" src="${IMG('rl_' + f[2])}" alt=""><div class="grow"><div class="t">${G.RELICS[f[2]].n}</div><div class="small">${G.RELICS[f[2]].d}</div><div class="small muted">Uses ${G.RELICS[f[0]].n} + ${G.RELICS[f[1]].n}</div></div></div>`).join('')}</div>`, btn('x', 'Not now', 'ghost sm'));
  if (v === 'x') return false;
  R.fuse(run, fs[+v]); window.AX && AX.ev('fuse'); SFX.ult(); toast('Forged ' + G.RELICS[fs[+v][2]].n + '!');
  return true;
}

// ---- bag and menu -----------------------------------------------------------------------------
document.addEventListener('click', e => {
  const t = e.target.closest('[data-top]'); if (!t || phase === 'fight') return;
  SFX.click();
  if (t.dataset.top === 'bag') bagScreen(); else if (t.dataset.top === 'menu') menuScreen();
});
async function bagScreen() {
  for (;;) {
    const c = C.relicTagCounts(run.relics);
    const sets = Object.keys(G.SETS).filter(t => c[t]).map(t => `<div class="li"><div class="grow"><span class="t">${G.SETS[t].n}</span> <span class="tag">${t}</span> <b style="color:${c[t] >= 3 ? 'var(--good)' : 'var(--dim)'}">${Math.min(c[t], 3)}/3</b><div class="small ${c[t] >= 3 ? '' : 'muted'}">${G.SETS[t].d}</div></div></div>`).join('');
    const recipes = G.FUSIONS.filter(f => run.relics.includes(f[0]) || run.relics.includes(f[1])).map(f => `<div class="li leg"><img class="ic" src="${IMG('rl_' + f[2])}" alt=""><div class="grow"><div class="t">${G.RELICS[f[2]].n}</div><div class="small">${G.RELICS[f[0]].n} ${run.relics.includes(f[0]) ? '✔' : '✘'} + ${G.RELICS[f[1]].n} ${run.relics.includes(f[1]) ? '✔' : '✘'}</div><div class="small muted">${G.RELICS[f[2]].d}</div></div></div>`).join('');
    const items = Object.keys(run.items).map(k => `<div class="li"><img class="ic" src="${IMG('it_' + k)}" alt=""><div class="grow"><div class="t">${G.ITEMS[k].n} ×${run.items[k]}</div><div class="small">${G.ITEMS[k].d}</div></div><button class="btn sm" data-v="use:${k}">Use</button></div>`).join('');
    const charms = Array.from(new Set(run.charms)).map(k => `<div class="li"><img class="ic" src="${IMG('ch_' + k)}" alt=""><div class="grow"><div class="t">${G.CHARMS[k].n} ×${run.charms.filter(x => x === k).length}</div><div class="small">${G.CHARMS[k].d} Tap a creature to give it a charm.</div></div></div>`).join('');
    const perks = Object.keys(run.perks).map(k => `<span class="tag" title="${esc(G.PERKS[k].d)}">${G.PERKS[k].n}</span>`).join(' ');
    const mods = ['bomb', 'elixir', 'smoke'].filter(k => run.mods[k]).map(k => G.ITEMS[k].n).join(', ');
    const v = await modal('Bag', `<h3>Relics (${run.relics.length})</h3><div class="list" style="margin:6px 0 12px">${run.relics.map(id => relicLi(id, 'r')).join('') || '<p class="muted">None yet. Elite and boss rounds give relics.</p>'}</div>
      ${sets ? `<h3>Set bonuses</h3><p class="small muted" style="margin:2px 0 6px">Three relics with the same tag light up a set.</p><div class="list" style="margin-bottom:12px">${sets}</div>` : ''}
      ${recipes ? `<h3>Fusion recipes</h3><div class="list" style="margin:6px 0 12px">${recipes}</div>` : ''}
      <h3>Items</h3>${mods ? `<p class="small" style="color:var(--gold)">Ready for the next fight: ${mods}</p>` : ''}<div class="list" style="margin:6px 0 12px">${items || '<p class="muted">Empty. Wild rounds sometimes drop items.</p>'}</div>
      <h3>Charms</h3><div class="list" style="margin:6px 0 12px">${charms || '<p class="muted">No spare charms.</p>'}</div>
      <h3>Apex Cores</h3><div class="list" style="margin:6px 0 12px">${Object.keys(meta.apex || {}).filter(sp => meta.apex[sp] > 0 && G.SP[sp]).map(sp => { const S = G.SP[sp]; return `<div class="li"><img class="ic" src="${IMG('cr_' + sp + '4')}" alt=""><div class="grow"><div class="t">${esc(S.names[3] || S.names[0])} ×${meta.apex[sp]}</div><div class="small">Apex Core. Ascend a ★3 ${esc(S.names[2] || S.names[0])}.</div></div></div>`; }).join('') || '<p class="muted">None yet. Defeat a creature for a rare chance at its Apex Core.</p>'}</div>
      ${perks ? `<h3>Tamer perks</h3><div class="row wrap" style="margin-top:6px">${perks}</div>` : ''}`, (R.fusionsAvailable(run).length ? btn('forge', 'Forge', 'blue sm') : '') + btn('ok', 'Close', 'green sm'));
    closeModal();
    if (v === 'ok') break;
    if (v === 'forge') { await forgeFlow(); continue; }
    if (v.startsWith('use:')) {
      const k = v.slice(4);
      let uid = null;
      if (k === 'evo') {
        const ones = run.units.filter(u => u.star === 1);
        if (!ones.length) { toast('No ★1 creature to evolve.'); continue; }
        const p = await ask('Evolve which creature?', `<div class="list">${ones.map(u => `<div class="li click" data-v="${u.uid}">${monImg(u, 'ic')}<div class="grow"><div class="t">${esc(C.name(u))}</div></div></div>`).join('')}</div>`, btn('x', 'Cancel', 'sm'));
        if (p === 'x') continue;
        uid = +p;
      }
      const r = R.useItem(run, k, uid);
      if (!r) toast('That has no effect right now.');
      else { SFX.lvl(); if (r.merged) for (const u of r.merged) await evolveFlow(u); await afterChange(); }
      save();
    }
  }
  renderGame();
}
function swt(on) { return `<span class="swt${on ? ' on' : ''}"></span>`; }
function settingsHtml() {
  return `<div class="settings">
    <button class="setrow" data-v="snd" type="button"><span class="grow">Sound</span>${swt(meta.sound)}</button>
    ${window.GAUDIO ? `<button class="setrow" data-v="mus" type="button"><span class="grow">Music</span>${swt(!!meta.music)}</button>
    <div class="setrow"><span class="grow">Volume</span><input class="volslider" type="range" min="0" max="100" step="5" value="${meta.vol}" data-vol aria-label="Volume"><span class="volpct">${meta.vol}%</span></div>` : ''}
    <button class="setrow" data-v="anim" type="button"><span class="grow">Animation</span><span class="setval">${meta.autoClassic ? 'Classic' : (animNow() ? 'Rich' : 'Classic')}</span>${swt(animNow())}</button>
    ${meta.autoClassic ? `<button class="setrow" data-v="autoclassic" type="button"><span class="grow">Auto Classic</span><span class="setval">On</span>${swt(true)}</button><p class="small muted">A fight stayed under 30 fps, so Classic is on for now. Your saved choice is still ${meta.anim ? 'Rich' : 'Classic'}. Turn this off to switch back.</p>` : ''}
    <button class="setrow" data-v="reset" type="button"><span class="grow">Reset save</span></button>
  </div>`;
}
function resetAll() {
  if (saveStale) return;
  run = null;
  wipeMeta();
  try { sealMeta(); } catch (e) { /* defaults already applied */ }
  try { localStorage.removeItem(SAVE); } catch (e) { /* storage blocked */ }
  if (window.WILDS && WILDS.discard) WILDS.discard();
  if (window.AX) AX.init(meta);
  if (window.COSM) { COSM.init(meta); COSM.apply(); }
  renderTitle();
}
async function settingsScreen() {
  for (;;) {
    const v = await ask('Settings', settingsHtml(), btn('x', 'Done', 'green'), 'x');
    if (v === 'snd') { meta.sound = !meta.sound; save(); continue; }
    if (v === 'mus') { GAUDIO.setMusic(!meta.music); continue; }
    if (v === 'anim') { setAnimPref(!animNow()); continue; }
    if (v === 'autoclassic') { setAutoClassic(false); continue; }
    if (v === 'reset') {
      if (saveStale) { toast('Game updated in another tab, reload'); continue; }
      const y = await ask('Reset save?', '<p style="text-align:center">Erase shards, unlocks, goals, and any run or Wilds expedition on this device?</p>', btn('y', 'Reset save', 'ghost') + btn('n', 'Cancel', 'green'));
      if (y !== 'y') continue;
      resetAll();
      return 'reset';
    }
    break;
  }
}
async function menuScreen() {
  const v = await ask('Menu', '', btn('how', ICO.how + 'How to Play', 'mid') + btn('set', ICO.gear + 'Settings', 'mid wild') + btn('title', 'Save & Quit to Title', 'blue') + btn('give', 'Give up run', 'ghost') + btn('x', 'Back', 'green'), 'x');
  if (v === 'how') return showHow();
  if (v === 'set') { if (await settingsScreen() === 'reset') return; return menuScreen(); }
  if (v === 'title') { save(); renderTitle(); }
  if (v === 'give' && await ask('Give up?', '<p style="text-align:center">You keep the shards you earned so far.</p>', btn('y', 'Give up', 'ghost') + btn('n', 'Keep going', 'green')) === 'y') { SFX.stinger('lose'); gameOver(false); }
}

// ---- end of run, camp, dex, help ----------------------------------------------------------------
async function gameOver(won, res) {
  stopFight();
  const shards = R.shardsFor(run, won);
  meta.shards += shards;
  window.AX && AX.ev('shards', shards);
  for (const k in run.seen) meta.dex[k] = Math.max(meta.dex[k] || 0, run.seen[k]);
  if (won) { meta.wins++; meta.depthMax = Math.max(meta.depthMax, Math.min(10, run.depth + 1)); }
  const team = R.onBoard(run).map(u => `<div style="text-align:center"><img style="height:80px" class="${u.shiny ? 'shiny' : ''}" src="${IMG(C.art(u))}" alt=""><div class="small" style="color:#ffd65a">${starsTxt(u.star)}</div></div>`).join('');
  const cores = apexLines(res && res.drops);
  if (cores) SFX.lvl();
  const r = run; r.over = r.over || 2;
  window.AX && AX.ev('runEnd', 1, { won: !!won, round: r.round, depth: r.depth, lost: r.stats.lost || 0, ms: r.started ? Date.now() - r.started : null });
  run = null; save();
  const qty = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  await ask(won ? 'The Glimmer Core is yours!' : 'Your journey ends...', `<div class="row center wrap" style="gap:6px">${team}</div>
    <p style="text-align:center">Reached round ${r.round} · ${qty(r.stats.won, 'win', 'wins')} · ${qty(r.stats.lost, 'loss', 'losses')} · ${qty(r.stats.merges, 'evolution', 'evolutions')}</p>
    ${(res && res.report) || ''}
    <p style="text-align:center;font-size:18px"><b>+${shards} Glimmer Shards</b></p>${cores}${won ? `<p style="text-align:center;color:var(--gold)">Depth ${meta.depthMax} unlocked! Foes grow stronger on each Depth.</p>` : '<p class="muted" style="text-align:center">Spend shards at camp for permanent upgrades.</p>'}`, btn('ok', 'Back to camp', 'green'));
  renderCamp();
}
function renderCamp() {
  $('#campTop').innerHTML = `<button class="iconbtn" data-go="title">◀</button><div class="grow title">Camp</div><span class="pill"><img src="${IMG('ui_shard')}" alt="">${meta.shards}</span>`;
  $('#campBody').innerHTML = `<p class="muted" style="text-align:center;margin:0 0 10px">Glimmer Shards from every run buy permanent upgrades. Catching a creature adds it to your starter pool.</p>
    ${[['chess', 'Auto Chess'], ['wilds', 'The Wilds']].map(([mode, title]) => `<h3 class="camph">${title}</h3><div class="list" style="max-width:640px;margin:0 auto">${Object.keys(G.META).filter(k => (G.META[k].mode || 'chess') === mode).map(k => {
      const m = G.META[k], rk = meta.up[k] || 0, max = rk >= m.max, cost = m.cost[rk];
      return `<div class="li"><div class="grow"><div class="t">${m.n} <span class="tag">${rk}/${m.max}</span></div><div class="small">${m.d}</div></div>${max ? '<span class="tag" style="background:#2fbf5555">MAX</span>' : `<button class="btn sm ${meta.shards >= cost ? '' : 'ghost'}" data-buy="${k}">${cost} shards</button>`}</div>`;
    }).join('')}</div>`).join('')}
    <div class="row center wrap campacts" style="margin:16px 0">${btn('dex', ICO.dex + 'Glimdex', 'mid blue').replace('data-v', 'data-camp')}${btn('post', `<img class="bico" src="${IMG('wd_badge')}" alt="">Trainer's Post`, 'mid wild').replace('data-v', 'data-camp')}${btn('ach', '🏆 Goals', 'mid wild').replace('data-v', 'data-camp')}${btn('wardrobe', '👕 Wardrobe', 'mid').replace('data-v', 'data-camp')}${btn('play', 'New Run', 'mid green').replace('data-v', 'data-camp')}</div>`;
  show('camp');
  mus('title');
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
  if (c) { SFX.click(); if (c.dataset.camp === 'dex') showDex(); else if (c.dataset.camp === 'post') window.WILDS.post().then(renderCamp); else if (c.dataset.camp === 'ach') window.AX && AX.open(); else if (c.dataset.camp === 'wardrobe') window.COSM && COSM.open(); else newRunFlow(); }
});
async function showAbout() {
  await ask('About', `<div class="how">
    <p style="text-align:center"><b>Glimmerdeep</b></p>
    <p style="text-align:center" class="muted">${GLIM_VER}</p>
    <p><b>Game</b> by Labfreak-dev. A creature auto-chess roguelite: tame, merge, and delve.</p>
    <p><b>Art</b> — original creature, item, and world paintings made for Glimmerdeep.</p>
    <p><b>Sound</b> — original music and effects made for Glimmerdeep.</p>
    <p class="small muted">Type set in Fredoka and Nunito.</p>
  </div>`, btn('ok', 'Close', 'green'), 'ok');
}
async function showDex() {
  const seenOf = sp => Math.max(meta.dex[sp] || 0, run ? run.seen[sp] || 0 : 0);
  const maxOf = sp => { const n = G.SP[sp].names; return n && n.length >= 4 && n[3] ? 4 : 3; };
  let total = 0, seenN = 0;
  for (const sp in G.SP) { const m = maxOf(sp); total += m; seenN += Math.min(seenOf(sp), m); }
  let cur = G.ELS.find(el => Object.keys(G.SP).some(sp => G.SP[sp].el === el && seenOf(sp) > 0)) || 'ember';
  const cell = (sp, stg) => {
    const seen = seenOf(sp) >= stg;
    const label = seen ? (G.SP[sp].names[stg - 1] || '???') : '???';
    const art = seen ? `<img loading="lazy" decoding="async" src="${IMG('cr_' + sp + stg)}" alt="">` : '<div class="ph"></div>';
    let extra = '';
    if (stg === 1) extra += meta.unlocked[sp] ? '<span class="tag" style="background:#2fbf5555">unlocked</span>' : '<span class="tag">🔒 Wilds</span>';
    if (stg === 1 && (meta.shinies || {})[sp]) extra += '<span class="tag wshiny">✦ shiny</span>';
    if (stg === 4 && ((meta.apex || {})[sp] || 0) > 0) extra += `<span class="tag">◆ ×${(meta.apex || {})[sp]}</span>`;
    return `<div class="${seen ? '' : 'unseen'}">${art}<div>${esc(label)}</div>${extra}</div>`;
  };
  const grid = el => Object.keys(G.SP).filter(sp => G.SP[sp].el === el).map(sp => {
    const max = maxOf(sp);
    let cells = '';
    for (let stg = 1; stg <= max; stg++) cells += cell(sp, stg);
    return `<div class="dex" style="grid-template-columns:repeat(${max},minmax(72px,1fr));margin-bottom:8px">${cells}</div>`;
  }).join('');
  const chips = `<div class="dexchips">${G.ELS.map(el => `<button type="button" class="dexchip el-${el}${el === cur ? ' on' : ''}" data-dexel="${el}">${esc(G.EL[el].name)}</button>`).join('')}</div>`;
  const p = modal(`Glimdex · ${seenN}/${total}`, `${chips}<div id="dexGrid">${grid(cur)}</div>${window.WILDS ? WILDS.dexHtml() : ''}`, btn('ok', 'Close', 'green'), 'ok');
  const onClick = e => {
    const b = e.target.closest('[data-dexel]');
    if (!b || !MB.contains(b)) return;
    cur = b.dataset.dexel;
    SFX.click();
    MB.querySelectorAll('[data-dexel]').forEach(x => x.classList.toggle('on', x === b));
    const g = MB.querySelector('#dexGrid');
    if (g) g.innerHTML = grid(cur);
  };
  MB.addEventListener('click', onClick);
  await p;
  MB.removeEventListener('click', onClick);
  closeModal();
}
async function showHow() {
  const v = await ask('How to play', `<div class="how">
  <p><b>The run</b> is 30 rounds across 6 stages of 5. Round 3 of each stage is an elite fight that pays a relic; round 5 is the stage boss (one of three for that biome). After a boss you pick the next biome from two you have not visited (12 biomes, each with its own hazard); the last stage is always the Glimmer Core. You have 100 HP: losing a round costs HP (more for every foe left standing). Beat the Glimmer Core's boss in round 30 to win.</p>
  <p><b>Planning.</b> Buy creatures from the shop (cost = tier: 1-5 gold; tier 4 and 5 creatures appear at higher Tamer levels), drag them from the bench onto your half of the board, and drag them back or onto the shop to sell. Your <b>Tamer level</b> is how many creatures fit on the board: you gain 2 XP a round, and Buy XP gives 4 for 4 gold. Higher levels also roll rarer creatures. <b>Lock</b> keeps a shop for next round.</p>
  <p><b>Merging.</b> Three copies of the same creature at the same star merge and evolve it: ★2 is its second form, ★3 its final form. Each merge offers a <b>mutation</b>. ★4 Apex forms come only from rare Apex Core drops, found by defeating that species, and Ascend a ★3 of the same species.</p>
  <p><b>Gold.</b> 5 a round, +1 for a win, +1 interest per 10 gold you hold (up to 5), and a bonus for win or loss streaks.</p>
  <p><b>Fights</b> play themselves. Creatures walk to the nearest foe, attack at their own range and speed, and fill their blue <b>mana</b> bar by attacking and getting hit. When it is full they cast their <b>power</b>: tap a creature to choose which of its skills that is. ★2 creatures unlock an ultimate. The next enemy board is shown while you plan, so place your team to counter it: melee in front, ranged behind, protect your casters.</p>
  <p><b>Elements.</b> Ember > Bloom, Shade, Frost · Tide > Ember, Stone, Metal · Bloom > Tide, Stone · Volt > Tide, Shade, Gale · Stone > Ember, Volt · Shade > Volt, Bloom, Mystic · Frost > Gale, Bloom · Gale > Shade, Mystic · Metal > Frost, Stone · Mystic > Volt, Metal. Super-effective hits deal 1.5×. Tap a creature to see its matchups.</p>
  <p><b>Reactions</b>: Volt on Soaked = <b>Electrocute</b>. Tide on Burning = <b>Steam</b>. Ember on Poisoned = <b>Blight Burst</b> (the poison explodes onto every foe). Stone on Rooted = <b>Shatter</b>. Shade on a Cursed foe under 25% = <b>Doom</b>. Frost on Soaked = <b>Freeze</b> (stun). Gale on Burning = <b>Firestorm</b> (the burn spreads). Ember on Soaked = Fizzle (weak!).</p>
  <p><b>Synergies</b> (top of the board): 2 or 4 different species of one element, or 2 or 4 of one role (Striker, Caster, Guardian, Support), unlock team bonuses. Tap a chip to read it.</p>
  <p><b>Relics</b> power up your whole team; three with a shared tag light up a <b>set bonus</b>, and certain pairs <b>fuse</b> into legendaries (Bag → Forge). <b>Charms</b> drop from wild rounds: give one to a creature. Each biome has a <b>hazard</b>; some relics counter it.</p>
  <p><b>Between runs</b>, Glimmer Shards buy permanent upgrades at camp. Win to unlock harder Depths.</p>
  <p><b>The Glimdex</b> shows one element at a time. A form you have not seen stays blank until you meet it, and a fourth form is listed only for a species that has one.</p>
  <p><b>The Wilds.</b> Only the original twelve creatures start unlocked. Explore floors of rooms, walk into wild creatures to battle them, and every species you beat is <b>unlocked for good</b>: it joins the Auto Chess shop and the starters. Find the key for the vault, push on cracked walls for secret rooms, and beat each floor's lair to go deeper. Mind the pits, and spike traps chip your squad's HP. A sparkling <b>shiny</b> creature is caught shiny for good: that species turns up shiny far more often in the shop. Every floor has a shrine and a <b>Glim Tonic</b> at the entrance (tap the flask to heal), event rooms offer deals and gambles, and lairs, chests and champions give <b>relics</b> that power your squad until the expedition ends. Camp has Wilds upgrades too.</p>
  <p><b>Trainers.</b> Trainers stand in some rooms and look one way (watch the light cone). If they spot you, the doors seal and they come for a battle; sneak around the cone to avoid them, or walk up to challenge them. Scout their team, pick a lead, and win <b>Trainer Tokens</b> to spend at the Trainer's Post (camp) on lures, starting stars and shiny sense. Floor captains guard the treasure on floors 2 and 4 for rare relics. Beat your rival Jax for Rival Badges and new tamer outfits; with all three, the Rival's Den opens after floor 5.</p></div>`, btn('about', ICO.about + 'About', 'mid blue') + btn('ok', 'Got it', 'green'), 'ok');
  if (v === 'about') await showAbout();
}

// ---- boot --------------------------------------------------------------------------------------
function boot() {
  try {
    load();
    if (window.AX) AX.init(meta);
    if (window.COSM) { COSM.init(meta); COSM.apply(); }
    readAnimQuery();
    applyAnim();
    renderTitle();
  } catch (e) {
    damagedBoot = true;
    run = null;
    try { wipeMeta(); sealMeta(); } catch (e2) { /* keep going */ }
    try { localStorage.removeItem(SAVE); } catch (e2) { /* storage blocked */ }
    try {
      if (window.AX) AX.init(meta);
      if (window.COSM) { COSM.init(meta); COSM.apply(); }
      renderTitle();
    } catch (e2) { /* prompt still opens */ }
  }
  if (damagedBoot) ask('Save damaged: start fresh', '<p style="text-align:center">This save could not be read. A new game is ready.</p>', btn('ok', 'Start fresh', 'green'), 'ok');
  else if (droppedRun) toast('Save damaged: start fresh.');
}
boot();
['bg_verdant', 'ui_gold', 'node_treasure'].forEach(k => { const i = new Image(); i.src = IMG(k); });
function rollApexWild(st) { return R.rollApex(run, st, meta); }
function ascendMember(m) {
  if (!m || m.boss || m.star !== 3) return null;
  meta.apex = meta.apex || {};
  if (!(meta.apex[m.sp] > 0) || meta.apexLock) return null;
  const S = G.SP[m.sp];
  if (!S || !S.names[3]) return null;
  m.star = 4;
  window.AX && AX.ev('ascend');
  m.hp = Math.min(1, (m.hp || 0) + 0.3);
  meta.apex[m.sp]--;
  if (!meta.apex[m.sp]) delete meta.apex[m.sp];
  meta.dex = meta.dex || {};
  meta.dex[m.sp] = Math.max(meta.dex[m.sp] || 0, 4);
  return m;
}
function giveApex(sp, n) {
  meta.apex = meta.apex || {};
  meta.apexSeen = meta.apexSeen || {};
  meta.apex[sp] = (meta.apex[sp] || 0) + (n == null ? 1 : n);
  if (meta.apex[sp] > 0) meta.apexSeen[sp] = 1; else delete meta.apex[sp];
  save();
}
window.GLIM = { get run() { return run; }, get meta() { return meta; }, get FS() { return FS; }, renderGame, renderTitle,
  wildBattle, ask, toast, show, save, saveBlocked: () => saveStale, SFX, tone, btn, esc, elBadge, IMG, ROLE_N,
  animNow, setAutoClassic, confirmClassic,
  evoCinematic, rollApexWild, rollApex: (st, salt) => R.rollApex(run, st, meta), ascendMember, debug: { giveApex, relicPick: (ids, title) => relicPick(ids && ids.length ? ids : ['ruby_ring', 'last_stand', 'pyre_crown', 'rainbow_roster'], title || 'Choose a relic') } };
})();
