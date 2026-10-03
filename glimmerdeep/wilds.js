// Glimmerdeep: The Wilds. Explore floors of connected rooms (Binding of Isaac style), walk into wild
// creatures to battle them on the auto-chess board, and unlock every species you beat for good.
// DOM + canvas. Fights reuse game.js through window.GLIM.wildBattle.
(function () {
'use strict';
const G = window.GD, C = window.GC, R = window.GR, U = window.GLIM;
const $ = s => document.querySelector(s);
const IMG = k => (window.GD_ICON_MANIFEST && GD_ICON_MANIFEST[k]) ? ('img/' + k + '.webp?v=w4') : ((window.ICON_PH && ICON_PH[k]) || ('img/' + k + '.webp?v=w4'));
const SAVE = 'glimmerdeep.wilds.v1';
const { FLOORS, SQUAD_START, SQUAD_MAX, XP_STAR, rng, pick, key, placeSide } = window.GW;
// shinies: 1 in 20 wild creatures, 3 in 20 with the camp's Shiny Charm
const genFloor = (f, b, seed) => window.GW.genFloor(f, b, seed, unlocked, { shiny: (meta().up.shiny ? 3 : 1) / 20,
  lure: W.lure || null, shinyBoost: meta().shinyBoost || {},
  rival: W.rivalFloor === f ? { pool: Object.keys(meta().unlocked), level: meta().badges || 0 } : null });
const { TC, TR, tileXY, tileAt, solid } = window.GW;
const RW = 16, RH = 9;                     // room size in world units (the room art is 16:9)
const IN = { x0: 1.35, x1: 14.65, y0: 1.3, y1: 7.7 };   // walkable floor inside the walls
const DOOR = { n: [8, 0.72, 0], s: [8, 8.28, Math.PI], w: [0.72, 4.5, -Math.PI / 2], e: [15.28, 4.5, Math.PI / 2] };
const DOORW = 2.7;   // v2 gate sprites are square, drawn unrotated
const DOORA = { n: [0.5, 0.5395], s: [0.5, 0.4605], w: [0.5395, 0.5], e: [0.4605, 0.5] };   // door centre inside each file
const DOORSKIN = { verdant: 1, magma: 1, tundra: 1, core: 1, grotto: 1, spire: 1, crypt: 1, skyisles: 1, dunes: 1, mire: 1, foundry: 1, observatory: 1 };
const SECRETSKIN = { verdant: 1, grotto: 1, magma: 1, crypt: 1, tundra: 1, spire: 1, skyisles: 1, dunes: 1, mire: 1, foundry: 1, observatory: 1, core: 1 };   // biomes shipping wd_secret_* / wd_secretopen_* (v4). Set one to 0 to fall back to the plain wall.
const SECRET_FAR_A = 0;   // camouflage weight beyond the hint range. 0 = plain wall from afar; the sprite fades in only as you approach.
const WALK_CYCLE = 1.3;   // world units for one 8-frame stride
const VWALK = { up: 8, down: 8 };   // frame counts; wd_tamer_<dir>_1..n (v4 art)
const LEGHACK = false;              // side-view feet under the front/back still; leave off (perspective clash)
const TAMER_H = 1.13;               // visible tamer height, world units (content of the 1.3 square)
const TRAINER_H = 1.1 * TAMER_H;    // room trainers, about 1.1x the tamer, natural aspect
const TAMER_FR = ['wd_tamer', 'wd_tamer_up', 'wd_tamer_down', 'wd_tamer_hurt_1', 'wd_tamer_hurt_2',
  'wd_tamer_idle_1', 'wd_tamer_idle_2', 'wd_tamer_idle_3', 'wd_tamer_idle_4',
  'wd_tamer_walk_1', 'wd_tamer_walk_2', 'wd_tamer_walk_3', 'wd_tamer_walk_4',
  'wd_tamer_walk_5', 'wd_tamer_walk_6', 'wd_tamer_walk_7', 'wd_tamer_walk_8'];
for (const dir of ['up', 'down']) for (let i = 1; i <= VWALK[dir]; i++) TAMER_FR.push('wd_tamer_' + dir + '_' + i);
const DIRS = window.GW.DIRS, OPP = { n: 's', s: 'n', e: 'w', w: 'e' };
const EARLY = ['verdant', 'grotto', 'magma', 'crypt'];
const ELC = { ember: '#ff7a2a', tide: '#2fa6ff', bloom: '#4fd35a', volt: '#ffd21f', stone: '#e0a860', shade: '#9d8bff', frost: '#8fe3ff', gale: '#7dffc2', metal: '#d8e2ee', mystic: '#d9a6ff' };

let W = null;        // the expedition (saved)
let LASTFS = '';     // HTML for the fight that just ended (battle report)
let V = null;        // the live view: canvas, input, positions (not saved)
const imgs = {};
function img(k) { if (!imgs[k]) { const i = new Image(); i.src = IMG(k); imgs[k] = i; } return imgs[k]; }
const ready = i => !!i && (i instanceof HTMLCanvasElement || (i.complete && i.naturalWidth > 0));
// fetch and decode ahead of the first draw, so a new frame is never a blank
function warm(k) { const i = img(k); if (typeof i.decode === 'function') i.decode().catch(() => {}); return i; }
function tamerKey(k) {
  const id = meta().skin, sk = G.SKINS[id];
  if (sk && sk.folder && skinOpen(id)) return sk.folder + '/' + k;
  return k;
}
function preloadTamer() {
  noteTamerSkin();
  for (const k of TAMER_FR) {
    const key = tamerKey(k);
    if (key !== k && !(window.GD_ICON_MANIFEST && GD_ICON_MANIFEST[key])) continue;
    const im = warm(key);
    if (im instanceof HTMLImageElement && !ready(im) && !im._rimArm) {
      im._rimArm = true;
      im.addEventListener('load', () => { im._rimArm = false; pumpTamerRims(); }, { once: true });
    }
  }
  pumpTamerRims();
}
function preloadDoors() {
  if (!W || !W.biome) return;
  for (const kind of ['door', 'lock', 'crack']) for (const d of ['n', 's', 'w', 'e']) {
    warm('wd_' + kind + '_' + d);
    if (DOORSKIN[W.biome]) warm('wd_' + kind + '_' + d + '_' + W.biome);
  }
  warm('wd_pit_' + W.biome); warm('wd_spikes_' + W.biome);
  if (SECRETSKIN[W.biome]) for (const d of ['n', 's', 'w', 'e']) { warm('wd_secret_' + d + '_' + W.biome); warm('wd_secretopen_' + d + '_' + W.biome); }
  warm('wd_chest'); warm('wd_key'); warm('wd_berry'); warm('wd_shrine'); warm('wd_stairs');
}

// ---- save ---------------------------------------------------------------------------------------
function save() {
  if (U.saveBlocked && U.saveBlocked()) return;
  try { localStorage.setItem(SAVE, JSON.stringify(W)); } catch (e) { /* storage blocked */ }
}
function knownSp(sp) { return !!(sp && G.SP[sp]); }
function expeditionOk(s) {
  if (!s || s.v !== 1 || !s.rooms || typeof s.rooms !== 'object' || Array.isArray(s.rooms)) return false;
  if (!s.cur || !s.rooms[s.cur]) return false;
  if (!Object.keys(s.rooms).length) return false;
  if (!s.biome || !G.BIOMES[s.biome]) return false;
  if (!Array.isArray(s.squad) || !s.squad.length) return false;
  for (const m of s.squad) if (!m || !knownSp(m.sp)) return false;
  for (const a of Object.values(s.rooms)) {
    if (!a || typeof a !== 'object') return false;
    if (a.mon && !a.mon.beaten && !knownSp(a.mon.sp)) return false;
    if (a.mon && Array.isArray(a.mon.escorts)) for (const sp of a.mon.escorts) if (!knownSp(sp)) return false;
  }
  return true;
}
let wildsDamaged = false;
function load() {
  wildsDamaged = false;
  try {
    const raw = localStorage.getItem(SAVE);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!expeditionOk(s)) { wildsDamaged = true; clearSave(); return null; }
    if (s.keys == null || !Number.isFinite(+s.keys)) s.keys = 0;
    return s;
  } catch (e) { wildsDamaged = true; clearSave(); return null; }
}
function clearSave() { try { localStorage.removeItem(SAVE); } catch (e) { /* storage blocked */ } }
function discard() { W = null; clearSave(); stopView(); }
function dropExpedition() {
  W = null; clearSave(); stopView();
  U.toast('Save damaged: start fresh.');
  U.renderTitle();
}
const meta = () => U.meta;
const unlocked = sp => !!meta().unlocked[sp];
const up = k => meta().up[k] || 0;

// ---- relics, tonics and camp upgrades for the descent --------------------------------------
const WR = G.WILD_RELICS;
const rw = k => (W.relics || []).reduce((t, id) => t + ((WR[id].w || {})[k] || 0), 0);
const xpStar = () => up('w_mentor') ? [0, 3, 9] : XP_STAR;
const shardMul = () => 1 + rw('shardMul');
function fightBonus() {
  const b = {};
  const add = o => { for (const k in o || {}) b[k] = (b[k] || 0) + o[k]; };
  for (const id of W.relics || []) add(WR[id].b);
  for (const k in G.META) if (G.META[k].wb) for (let i = 0; i < up(k); i++) add(G.META[k].wb);
  return b;
}
function healFit(v) { for (const s of W.squad) if (s.hp > 0) s.hp = Math.min(1, s.hp + v); }
function gainXp(s, n, evos) { s.xp += n; const T = xpStar(); while (s.star < 3 && s.xp >= T[s.star]) { s.star++; s.hp = Math.min(1, s.hp + 0.3); if (evos) evos.push(s); } }
function relicLi(id) { const r = WR[id]; return `<div class="li click" data-v="${id}"><img class="ic" src="${IMG(r.ic)}" alt=""><div class="grow"><div class="t">${r.n}</div><div class="small">${r.d}</div></div></div>`; }
// offer n relics you do not have yet; resolves with the one taken (or null)
async function offerRelics(n, title, skip, rare) {
  let left = Object.keys(WR).filter(k => !(W.relics || []).includes(k));
  if (rare && left.filter(k => WR[k].rare).length >= 2) left = left.filter(k => WR[k].rare);   // captains draw from the rare pool
  const pool = left.sort(() => Math.random() - 0.5).slice(0, n);
  if (!pool.length) { U.toast('You already carry every relic!'); return null; }
  const v = await U.ask(title || 'A relic!', `<p class="muted small" style="text-align:center">Relics last until this expedition ends.</p><div class="list">${pool.map(relicLi).join('')}</div>`, skip ? U.btn('skip', 'Leave it', 'ghost sm') : '');
  if (!WR[v]) return null;
  W.relics.push(v); window.AX && AX.ev('relic'); U.SFX.relic(); U.toast('Got ' + WR[v].n + '!');
  if (WR[v].w && WR[v].w.map) revealMap(2);
  hud();
  return v;
}
function revealMap(rank) {
  for (const a of Object.values(W.rooms)) {
    if (a.type !== 'secret' || rank >= 2) a.seen = true;
    if (a.type === 'secret' && rank >= 2) a.hint = true;   // full crack; minimap already uses seen
  }
  if (V) minimap();
}
async function useTonic() {
  if (!W || V.pause) return;
  if (!(W.tonics > 0)) return U.toast('No Glim Tonics. Every floor has one at its entrance.');
  if (!W.squad.some(s => s.hp > 0 && s.hp < 1)) return U.toast('Your squad is already at full health.');
  W.tonics--;
  window.AX && AX.ev('tonic');
  healFit(0.4 + rw('tonic'));
  U.SFX.wshrine(); burst(V.px, V.py - 0.4, '#6bff8f'); U.toast(`Glim Tonic: +${Math.round(100 * (0.4 + rw('tonic')))}% HP for your squad.`);
  save(); hud();
}

// ---- doors and the map (layouts come from wgen.js) --------------------------------------------
function doorOf(room, d) {
  const o = W.rooms[key(room.x + DIRS[d][0], room.y + DIRS[d][1])];
  if (!o) return null;
  if (V && V.sealed && room === W.rooms[W.cur]) return 'sealed';
  if (o.type === 'secret' || room.type === 'secret') return (o.type === 'secret' ? o : room).found ? 'open' : 'crack';
  if (o.type === 'locked' || room.type === 'locked') return (o.type === 'locked' ? o : room).unlocked ? 'open' : 'lock';
  return 'open';
}
function secretEnds(room, d) {
  const o = W.rooms[key(room.x + DIRS[d][0], room.y + DIRS[d][1])];
  if (!o) return null;
  if (o.type === 'secret') return o;
  if (room.type === 'secret') return room;
  return null;
}
// how close the hidden seam starts to show. Brief F's Dowsing Rod adds units via rw('dowse') (0 when absent).
function secretHintRange() { return 3.2 + (rw('dowse') || 0); }
// 0 plain wall, 1 searched (soft glow), 2 map reveal (full crack). 'crack' stays the logic state.
function secretLevel(room, d) {
  const s = secretEnds(room, d);
  if (!s || s.found) return 0;
  if (s.hint) return 2;
  if (room.whint && room.whint[d]) return 1;
  return 0;
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
  if (floor > FLOORS) {   // the Rival's Den
    const F = window.GW.genDen((W.seed + 999) >>> 0, { pool: Object.keys(meta().unlocked) });
    Object.assign(W, { floor, biome: 'crypt', rooms: F.rooms, cur: F.cur });
    markSeen(); preloadDoors();
    window.AX && AX.ev('floor');
    return;
  }
  const pickFrom = floor === FLOORS ? ['core'] : (floor === 1 ? EARLY : Object.keys(G.BIOMES).filter(k => k !== 'core')).filter(k => !W.biomes.includes(k));
  const biome = pick(Math.random, pickFrom.length ? pickFrom : ['verdant']);
  W.biomes.push(biome);
  const F = genFloor(floor, biome, (W.seed + floor * 7919) >>> 0);
  Object.assign(W, { floor, biome, rooms: F.rooms, cur: F.cur });
  if (F.freeKey) W.keys++;
  if (rw('keyPlus')) W.keys += rw('keyPlus');
  W.relics = W.relics || []; if (W.tonics == null) W.tonics = 0;
  const mapRank = Math.max(up('w_map'), rw('map'));
  if (mapRank) revealMap(mapRank);
  markSeen();
  preloadDoors();
  window.AX && AX.ev('floor');
}
function startExpedition(sps, opts) {
  W = { v: 1, seed: (Date.now() ^ (Math.random() * 1e9)) >>> 0, floor: 1, biomes: [], keys: 0, shards: 0, nextUid: 1, wins: 0, found: [],
    relics: [], tonics: up('w_medic'), phoenixUsed: false,
    rivalFloor: 2 + Math.floor(Math.random() * 3), lure: opts && opts.lure || null,
    squad: sps.map(sp => { const st = (meta().wstar || {})[sp] || 1; return { uid: 0, sp, star: st, xp: st > 1 ? xpStar()[st - 1] : 0, hp: 1, shiny: false }; }) };
  if (up('w_relic')) W.relics.push(pick(Math.random, Object.keys(WR)));
  for (const m of W.squad) m.uid = W.nextUid++;
  newFloor(1);
  window.AX && AX.ev('wildsStart');
  save();
}
async function endExpedition(why, apex) {
  const m = meta();
  const bonus = why === 'done' ? 50 : 0;
  m.shards += bonus;
  if (bonus) window.AX && AX.ev('shards', bonus);
  const found = W.found.map(sp => `<div class="wfound"><img src="${IMG('cr_' + sp + '1')}" alt=""><div>${G.SP[sp].names[0]}</div></div>`).join('')
    + (W.shinies || []).map(sp => `<div class="wfound"><img class="shiny" src="${IMG('cr_' + sp + '1')}" alt=""><div>✦ ${G.SP[sp].names[0]}</div></div>`).join('');
  const title = why === 'champion' ? 'Champion of the Wilds!' : why === 'done' ? 'Expedition complete!' : why === 'left' ? 'Back to camp' : 'Your squad fainted';
  if (why === 'champion') { m.shards += 150; window.AX && AX.ev('shards', 150); why = 'done'; }
  // a wipe never reaches the Defeat modal; LASTFS outlives W = null. Wild and trainer both land here.
  const report = why === 'fainted' ? LASTFS : '';
  clearSave(); W = null; stopView(); U.save();
  if (why === 'done') U.SFX.wdone(); else if (why === 'fainted') U.SFX.stinger('lose');   // 'left' (player chose to leave) stays silent
  if (window.GAUDIO) GAUDIO.music('title');   // held until a stinger has finished
  await U.ask(title, `<p style="text-align:center">${found ? 'Unlocked this expedition:' : 'No new creatures this time.'}</p><div class="wfounds">${found}</div>
    ${bonus ? `<p style="text-align:center;color:var(--gold)">+${bonus} Glimmer Shards for clearing all ${FLOORS} floors!</p>` : ''}
    ${apexLine(apex)}
    ${report}
    <p class="muted small" style="text-align:center">Unlocked creatures now appear in the Auto Chess shop and as starters.</p>`, U.btn('ok', 'Continue', 'green'));
  LASTFS = '';
  U.renderTitle();
}

// ---- screens --------------------------------------------------------------------------------
async function open() {
  if (window.GAUDIO) GAUDIO.load('wilds');
  const saved = load();
  if (wildsDamaged) { dropExpedition(); return; }
  if (saved && saved.v === 1) {
    const v = await U.ask('The Wilds', `<p style="text-align:center">You have an expedition in progress on floor ${saved.floor}/${FLOORS}.</p>`, U.btn('go', 'Continue', 'green') + U.btn('new', 'Start over', 'ghost sm') + U.btn('x', 'Back', 'ghost sm'));
    if (v === 'x') return;
    if (v === 'go') {
      try {
        const again = load();
        if (wildsDamaged || !again) { dropExpedition(); return; }
        W = again;
        return enter();
      } catch (err) { dropExpedition(); return; }
    }
    clearSave();
  }
  prep();
}
function prep() {
  const m = meta();
  const list = Object.keys(G.SP).filter(unlocked).sort((a, b) => G.TIER[a] - G.TIER[b] || G.SP[a].el.localeCompare(G.SP[b].el));
  const sel = [], SQ = SQUAD_START + up('w_pack');
  const n = Object.keys(m.unlocked).length, tot = Object.keys(G.SP).length;
  const host = $('#wilds');
  host.querySelector('.wprep').innerHTML = `<div class="gtop"><button class="iconbtn" data-w="home">◀</button><div class="grow"><div class="title">The Wilds</div><div class="small muted">${n}/${tot} creatures unlocked</div></div></div>
    <div class="wprepbody"><p class="muted" style="text-align:center;margin:4px 8px 10px">Explore ${FLOORS} floors of rooms. Walk into a wild creature to battle it. Beat it to <b>unlock it for good</b>: it joins the Auto Chess shop and can join your squad. Pick up to ${SQ} creatures to bring.</p>
    <div class="wpick">${list.map(sp => { const S = G.SP[sp], st = (m.wstar || {})[sp] || 1; return `<div class="wcard el-${S.el}" data-sp="${sp}"><img decoding="async" src="${IMG('cr_' + sp + st)}" alt=""><div class="n">${S.names[st - 1]}${st > 1 ? ' ' + '★'.repeat(st) : ''}</div><div class="small muted">${U.ROLE_N[S.role]} · T${G.TIER[sp]}</div></div>`; }).join('')}</div>
    <h3 class="camph">Outfit</h3><div class="wskins">${Object.keys(G.SKINS).map(k => `<div class="wskin ${skinOpen(k) ? '' : 'locked'} ${(m.skin || 'classic') === k ? 'on' : ''}" data-skin="${k}" title="${G.SKINS[k].d}"><img src="${skinOpen(k) ? skinThumb(k) : IMG('wd_tamer_idle_1')}" alt=""><div>${skinOpen(k) ? G.SKINS[k].n : '🔒'}</div></div>`).join('')}</div>
    ${Object.values(m.lures || {}).some(n => n > 0) ? `<h3 class="camph">Lure <span class="small muted">(its element shows up 4× as often; used up when you set out)</span></h3><div class="row wrap center wlures" style="gap:6px"><button class="btn sm on" data-lure="">None</button>${Object.keys(m.lures).filter(e => m.lures[e] > 0).map(e => `<button class="btn sm ghost" data-lure="${e}">${U.elBadge(e)} ${G.EL[e].name} ×${m.lures[e]}</button>`).join('')}</div>` : ''}
    <div class="row center" style="margin:12px 0">${U.btn('post', `Trainer's Post · ${m.tokens || 0} tokens`, 'wild sm')}</div></div>
    <div class="wprepbar"><span class="small muted" id="wSel">Choose 1-${SQ}</span>${U.btn('go', 'Set out!', 'green')}</div>`;
  host.classList.remove('exploring');
  U.show('wilds');
  if (window.GAUDIO) GAUDIO.music('wilds_explore');
  host.querySelector('.wpick').onclick = e => {
    const c = e.target.closest('[data-sp]'); if (!c) return;
    const sp = c.dataset.sp, i = sel.indexOf(sp);
    if (i >= 0) sel.splice(i, 1); else if (sel.length < SQ) sel.push(sp); else return U.toast(`Up to ${SQ} creatures.`);
    U.SFX.click();
    c.classList.toggle('on', i < 0);
    $('#wSel').textContent = sel.length ? sel.map(k => G.SP[k].names[0]).join(', ') : `Choose 1-${SQ}`;
  };
  let lure = '';
  host.querySelector('.wprepbody').addEventListener('click', async e => {
    const sk = e.target.closest('[data-skin]'), lu = e.target.closest('[data-lure]');
    if (sk) { if (!skinOpen(sk.dataset.skin)) return U.toast(G.SKINS[sk.dataset.skin].d); m.skin = sk.dataset.skin; if (m.cosm && m.cosm.sel) m.cosm.sel.skin = m.skin; preloadTamer(); U.save(); U.SFX.click(); host.querySelectorAll('.wskin').forEach(x => x.classList.toggle('on', x === sk)); }
    if (lu) { lure = lu.dataset.lure; U.SFX.click(); host.querySelectorAll('[data-lure]').forEach(x => { x.classList.toggle('ghost', x !== lu); x.classList.toggle('on', x === lu); }); }
    if (e.target.closest('[data-v=post]')) { await post(); prep(); }
  });
  host.querySelector('.wprepbar').onclick = e => {
    if (!e.target.closest('[data-v=go]')) return;
    if (!sel.length) return U.toast('Pick at least one creature.');
    U.SFX.lvl();
    if (lure && m.lures[lure] > 0) m.lures[lure]--; else lure = '';
    startExpedition(sel.slice(), { lure: lure || null });
    enter();
  };
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-w]'); if (!b) return;
  U.SFX.click();
  if (b.dataset.w === 'home') { stopView(); U.renderTitle(); }
  else if (b.dataset.w === 'leave') leave();
  else if (b.dataset.w === 'tonic') useTonic();
  else if (b.dataset.w.startsWith('relic:')) { const r = WR[b.dataset.w.slice(6)]; if (r) U.toast(r.n + ': ' + r.d); }
});
document.addEventListener('click', async e => {
  const b = e.target.closest('.wsquad [data-asc]'); if (!b || !W || !V || V.pause) return;
  const m = W.squad.find(s => s.uid === +b.dataset.asc); if (!m || m.star !== 3) return;
  const S = G.SP[m.sp]; if (!S.names[3] || !((meta().apex || {})[m.sp] > 0)) return;
  V.pause = true;
  const v = await U.ask('Ascend?', `<p style="text-align:center">Uses 1 Apex Core. ${S.names[2]} becomes ★4 for this expedition; the Glimdex keeps the form forever.</p>`, U.btn('go', 'Ascend ◆', 'green') + U.btn('x', 'Not now', 'ghost sm'));
  if (v === 'go' && U.ascendMember(m)) await U.evoCinematic({ sp: m.sp, star: 4, shiny: !!m.shiny });
  save(); U.save(); hud();
  V.pause = false; V.last = performance.now();
});
function apexLine(apex) {
  if (!apex || !G.SP[apex.sp]) return '';
  const S = G.SP[apex.sp], nm = S.names[3] || S.names[S.names.length - 1], prev = S.names[2] || S.names[S.names.length - 1];
  return `<p style="text-align:center;color:var(--gold)">◆ Apex Core: <b>${nm}</b>! Ascend a ★3 ${prev} to unlock this form.</p>`;
}
function noteApex(apex) {
  if (!apex) return;
  U.SFX.wshiny();
}
async function leave() {
  V.pause = true;
  const v = await U.ask('Leave the Wilds?', '<p style="text-align:center">Head back to camp. Creatures you unlocked stay unlocked, and so do your shards.</p>', U.btn('y', 'Leave', 'ghost') + U.btn('n', 'Keep exploring', 'green'));
  if (v === 'y') return endExpedition('left');
  V.pause = false; V.last = performance.now();
}

// ---- the live room view ---------------------------------------------------------------------
function enter() {
  try { enterNow(); }
  catch (err) { dropExpedition(); }
}
function enterNow() {
  if (!expeditionOk(W)) throw new Error('expedition');
  const host = $('#wilds');
  host.classList.add('exploring');
  U.show('wilds');
  if (window.GAUDIO) GAUDIO.music('wilds_explore');
  preloadTamer();
  if (!V) {
    const cv = host.querySelector('#wCv');
    V = { cv, ctx: cv.getContext('2d'), keys: {}, joy: null, px: 8, py: 4.5, fx: 1, step: 0, vstep: 0, going: 0, vert: 0, bob: 0, flinch: 0, shown: '', mons: [], raf: 0, last: performance.now(),
      inv: 0, push: { d: null, t: 0 }, slide: null, pause: false, msgT: 0, parts: [], reveal: null, glintT: {}, hintAt: {}, idleNear: null };
    bindInput();
  }
  W.relics = W.relics || []; if (W.tonics == null) W.tonics = 0;
  if (W.keys == null || !Number.isFinite(+W.keys)) W.keys = 0;
  V.pause = false;
  host.querySelector('.whint').textContent = matchMedia('(pointer: coarse)').matches ? 'Drag anywhere to move' : 'WASD / arrow keys, or drag anywhere to move';
  placeRoom(null);
  hud();
  if (!V.raf) { V.last = performance.now(); V.raf = requestAnimationFrame(frame); }
}
function stopView() { if (V && V.raf) cancelAnimationFrame(V.raf); if (V) V.raf = 0; }
function room() { return W.rooms[W.cur]; }
// the room's creature and its escorts only (never a whole floor)
function prefetchRoom(a) {
  const mon = a && a.mon;
  if (!mon) return;
  const keys = ['cr_' + mon.sp + (mon.star || 1)].concat((mon.escorts || []).map(sp => 'cr_' + sp + (mon.escStar || 1)));
  const go = () => { for (const k of keys) { const i = new Image(); i.src = IMG(k); } };
  if (typeof requestIdleCallback === 'function') requestIdleCallback(go, { timeout: 400 });
  else setTimeout(go, 40);
}
// spawn the player at the door they came through, and the room's creature somewhere away from it
function placeRoom(from) {
  const a = room();
  if (from) { const p = DOOR[from]; V.px = p[0] + (from === 'w' ? 1.3 : from === 'e' ? -1.3 : 0); V.py = p[1] + (from === 'n' ? 1.3 : from === 's' ? -1.3 : 0); }
  else { V.px = 8; V.py = 5.6; }
  V.mons = [];
  V.grid = a.tiles ? a.tiles.split('|') : null;
  V.flow = null; V.flowAt = '';
  V.going = 0; V.vert = 0; V.bob = 0; V.vstep = 0; V.reveal = null; V.idleNear = null;
  if (V.push) { V.push.d = null; V.push.t = 0; }   // a leftover push must not light the next room's secret
  spawnMon(a);
  spawnTrainer(a);
  V.inv = 1.0;
  preloadDoors();
  markSeen();
  prefetchRoom(a);
  save();
}
function spawnTrainer(a) {
  V.tr = null; V.sealed = false;
  if (!a.tr || a.tr.beaten) return;
  const T = a.tr;
  V.tr = { x: T.x, y: T.y, x0: T.x, y0: T.y, face: T.face, cur: T.face, turn: T.turn, t: 0, spotted: false, bang: 0, fx: T.face === 'e' ? 1 : -1, cool: 0.8 };
}
function spawnMon(a) {
  if (a.mon && !a.mon.beaten) {
    const lair = a.type === 'lair';
    let mx = 8, my = 4;
    if (!lair) {
      // a free tile well away from the door you came in by
      const free = [];
      for (let y = 1; y <= 5; y++) for (let c = 1; c < TC - 1; c++) { const [x, yy] = tileXY(c, y); if (tile(c, y) !== '.' ) continue; if (Math.hypot(x - V.px, yy - V.py) > 4.5) free.push([x, yy]); }
      [mx, my] = free.length ? free[Math.floor(Math.random() * free.length)] : [16 - V.px, 9 - V.py];
    }
    V.mons.push({ x: mx, y: my, tx: mx, ty: my, t: 0, sz: lair ? 1.8 : 1.3, lair, bob: Math.random() * 6, shiny: !!a.mon.shiny });
  }
}
function hud() {
  const a = room(), host = $('#wilds');
  host.querySelector('.wtop').innerHTML = `<button class="iconbtn" data-w="leave">◀</button><div class="grow"><div class="title">${W.floor > FLOORS ? 'The Rival\'s Den' : `Floor ${W.floor}/${FLOORS} · ${G.BIOMES[W.biome].name}`}</div>
    <div class="small muted">${a.tr && !a.tr.beaten ? (a.tr.captain ? 'Floor captain · ' : a.tr.den ? 'The Rival\'s Den · ' : '') + G.TRAINERS[a.tr.arch].n : a.type === 'event' ? EV_N[a.event] : a.type === 'start' ? 'Entrance' : a.type === 'lair' ? 'Lair' : a.type === 'locked' ? 'Vault' : a.type === 'secret' && a.found ? 'Secret room' : a.type === 'treasure' ? 'Treasure room' : a.type === 'shrine' ? 'Shrine' : 'Wild room'}${a.mon && !a.mon.beaten ? ' · ' + G.SP[a.mon.sp].names[a.mon.star - 1] + (a.mon.shiny ? ' <span class="wshiny">✦ SHINY</span>' : '') + (unlocked(a.mon.sp) ? '' : ' <span style="color:var(--gold)">NEW!</span>') : ''}</div></div>
    <button class="pill wbtn" data-w="tonic" title="Glim Tonic: heal your squad"><img src="${IMG('wd_tonic')}" alt="">${W.tonics || 0}</button><span class="pill">🔑 ${W.keys}</span><span class="pill" title="Trainer Tokens"><img src="${IMG('wd_token')}" alt="">${meta().tokens || 0}</span><span class="pill"><img src="${IMG('ui_shard')}" alt="">${meta().shards}</span>
    ${(W.relics || []).length ? `<div class="wrelics">${W.relics.map(id => `<button class="wrel" data-w="relic:${id}" title="${WR[id].n}"><img src="${IMG(WR[id].ic)}" alt=""></button>`).join('')}</div>` : ''}`;
  host.querySelector('.wsquad').innerHTML = W.squad.map(m => {
    const S = G.SP[m.sp], next = xpStar()[m.star];
    const cores = (meta().apex || {})[m.sp] || 0, can = m.star === 3 && cores > 0 && !!S.names[3];
    const nm = S.names[m.star - 1] || S.names[S.names.length - 1];
    return `<div class="wmem ${m.hp <= 0 ? 'out' : ''}" ${can ? `data-asc="${m.uid}"` : ''}><img class="${m.shiny ? 'shiny' : ''}" decoding="async" src="${IMG('cr_' + m.sp + m.star)}" alt=""><div class="st">${'★'.repeat(m.star)}</div>
      ${can ? `<button type="button" class="wasc" data-asc="${m.uid}" title="Ascend ◆">◆</button>` : ''}
      <div class="bar"><i class="${m.hp < 0.3 ? 'low' : m.hp < 0.6 ? 'mid' : ''}" style="width:${Math.max(0, m.hp) * 100}%"></i></div>${next ? `<div class="bar xp"><i style="width:${Math.min(100, 100 * m.xp / next)}%"></i></div>` : ''}<div class="nm">${nm}</div></div>`;
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
    const c = a.type === 'lair' ? '#ff5a6e' : a.type === 'treasure' ? '#ffd65a' : a.type === 'shrine' ? '#6bff8f' : a.type === 'locked' ? '#ffb02e' : a.type === 'secret' ? '#d9a6ff' : a.type === 'event' && !a.used ? '#6fd3ff' : a.tr && !a.tr.beaten && a.visited ? '#ff9f43' : null;
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
// obstacle tiles (and the loose boulders of saves made before g12)
function tile(c, y) { return V.grid && y >= 0 && y < TR && c >= 0 && c < TC ? V.grid[y][c] : '.'; }
function collideRocks(o, rad) {
  for (const [rx, ry, rr] of room().rocks || []) {
    const dx = o.x - rx, dy = o.y - ry, d = Math.hypot(dx, dy), m = rr + rad;
    if (d < m && d > 0.001) { o.x = rx + dx / d * m; o.y = ry + dy / d * m; }
  }
  if (!V.grid) return;
  const [c0, y0] = tileAt(o.x, o.y);
  for (let y = y0 - 1; y <= y0 + 1; y++) for (let c = c0 - 1; c <= c0 + 1; c++) {
    const ch = tile(c, y); if (!solid(ch)) continue;
    const [tx, ty] = tileXY(c, y), h = ch === 'R' ? 0.44 : 0.4;
    const qx = Math.max(tx - h, Math.min(tx + h, o.x)), qy = Math.max(ty - h, Math.min(ty + h, o.y));
    let dx = o.x - qx, dy = o.y - qy, d = Math.hypot(dx, dy);
    if (d >= rad) continue;
    if (d < 0.001) {   // centre inside the tile: shove out along the shallower axis
      const px = o.x - tx, py = o.y - ty;
      if (Math.abs(px) > Math.abs(py)) o.x = tx + (Math.sign(px) || 1) * (h + rad); else o.y = ty + (Math.sign(py) || 1) * (h + rad);
      continue;
    }
    o.x += dx / d * (rad - d); o.y += dy / d * (rad - d);
  }
}
// distance field from the tamer's tile, so creatures path around pits and rocks
function flowField() {
  const [pc, py] = tileAt(V.px, V.py), k = pc + ',' + py;
  if (V.flow && V.flowAt === k) return V.flow;
  const f = {}, q = [[pc, py]]; f[k] = 0;
  while (q.length) {
    const [c, y] = q.shift(), d = f[c + ',' + y];
    for (const [dc, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const c2 = c + dc, y2 = y + dy, k2 = c2 + ',' + y2;
      if (c2 < 0 || y2 < 0 || c2 >= TC || y2 >= TR || f[k2] != null || solid(tile(c2, y2))) continue;
      f[k2] = d + 1; q.push([c2, y2]);
    }
  }
  V.flow = f; V.flowAt = k;
  return f;
}
function chaseStep(m) {
  const [mc, my] = tileAt(m.x, m.y), f = flowField(), here = f[mc + ',' + my];
  if (!V.grid || here == null || here <= 1) return [V.px, V.py];
  let best = null, bd = here;
  for (const [dc, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const d = f[(mc + dc) + ',' + (my + dy)]; if (d != null && d < bd) { bd = d; best = [mc + dc, my + dy]; } }
  return best ? tileXY(best[0], best[1]) : [V.px, V.py];
}
function hurt() {
  // spikes: chip the squad, never below 10%, with a moment of safety after
  V.hurtT = 1.1;
  V.flinch = 0.52;   // hurt_1 then hurt_2; shorter than the spike cooldown
  for (const s of W.squad) if (s.hp > 0) s.hp = Math.max(0.1, s.hp - 0.06);
  U.SFX.wspike(); burst(V.px, V.py, '#ff5a6e');
  if (!W.spikeTip) { W.spikeTip = 1; U.toast('Spikes! Each one chips 6% HP off your squad.'); }
  V.shake = 0.25;
  hud();
}
function msg(t) { if (V.msgT > 0) return; V.msgT = 1.6; U.toast(t); }
function frame(ts) {
  if (!V || !W) return;
  const dt = Math.min(0.05, (ts - V.last) / 1000); V.last = ts;
  if (V.flinch > 0) V.flinch = Math.max(0, V.flinch - dt);   // ticks through the pre-battle flash too
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
  let [ix, iy] = inputVec();
  if (V.tr && V.tr.spotted) ix = iy = 0;   // spotted: the trainer walks over, you wait
  const sp = 5.2 * (1 + (rw('speed') || 0));
  const x0 = V.px, y0 = V.py;
  const o = { x: V.px + ix * sp * dt, y: V.py + iy * sp * dt };
  if (ix) V.fx = ix > 0 ? 1 : -1;
  // walls, with gaps where there are open doors
  const gapX = Math.abs(o.x - 8) < 0.8, gapY = Math.abs(o.y - 4.5) < 0.8;
  const dn = doorOf(a, 'n'), ds = doorOf(a, 's'), dw = doorOf(a, 'w'), de = doorOf(a, 'e');
  let pushingCrack = false;
  const tryDoor = (d, st) => {
    if (st === 'sealed') return msg('The doors slammed shut. Win the trainer battle first!');
    if (st === 'lock') { if (W.keys > 0 || rw('skeleton')) { if (!rw('skeleton')) W.keys--; const t = W.rooms[key(a.x + DIRS[d][0], a.y + DIRS[d][1])]; (t.type === 'locked' ? t : a).unlocked = true; U.SFX.wvault(); U.toast('Unlocked the vault!'); burst(DOOR[d][0], DOOR[d][1], '#ffd65a'); save(); minimap(); window.AX && AX.ev('key'); } else msg('Locked. Find a key on this floor.'); }
    if (st === 'crack') {
      pushingCrack = true;
      if (!V.push) V.push = { d: null, t: 0 };
      V.push.d === d ? V.push.t += dt : (V.push = { d, t: 0 });
      if (V.push.t > 0.9) {
        const t = W.rooms[key(a.x + DIRS[d][0], a.y + DIRS[d][1])];
        (t.type === 'secret' ? t : a).found = true;
        V.reveal = { d, t: 0, k: key(a.x, a.y) };
        V.shake = 0.25;
        U.SFX.wsecret(); U.toast('A secret room!');
        burst(DOOR[d][0], DOOR[d][1], '#d9a6ff');
        for (let i = 0; i < 12; i++) { const an = Math.random() * 6.3, v = 0.5 + Math.random() * 2; V.parts.push({ x: DOOR[d][0], y: DOOR[d][1], vx: Math.cos(an) * v, vy: Math.sin(an) * v - 0.6, t: 0, life: 0.4 + Math.random() * 0.35, c: '#b7b7c4' }); }
        window.AX && AX.ev('secret');   // Brief F achievement hook
        markSeen(); save(); minimap();
      } else if (V.push.t > 0.3) msg('The wall feels hollow…');
    }
  };
  if (o.y < IN.y0) { if (gapX && dn === 'open') { if (o.y < 0.35) return go('n'); o.x = Math.max(7.25, Math.min(8.75, o.x)); } else { if (gapX && dn) tryDoor('n', dn); o.y = IN.y0; } }
  if (o.y > IN.y1) { if (gapX && ds === 'open') { if (o.y > RH - 0.35) return go('s'); o.x = Math.max(7.25, Math.min(8.75, o.x)); } else { if (gapX && ds) tryDoor('s', ds); o.y = IN.y1; } }
  if (o.x < IN.x0) { if (gapY && dw === 'open') { if (o.x < 0.35) return go('w'); o.y = Math.max(3.75, Math.min(5.25, o.y)); } else { if (gapY && dw) tryDoor('w', dw); o.x = IN.x0; } }
  if (o.x > IN.x1) { if (gapY && de === 'open') { if (o.x > RW - 0.35) return go('e'); o.y = Math.max(3.75, Math.min(5.25, o.y)); } else { if (gapY && de) tryDoor('e', de); o.x = IN.x1; } }
  if (!pushingCrack && V.push && V.push.t) { V.push.d = null; V.push.t = 0; }   // letting go must not leave the crack at full brightness
  collideRocks(o, 0.38);
  // stride from the distance that actually happened, so a wall or rock stops the feet
  const dx = o.x - x0, dy = o.y - y0, dist = Math.hypot(dx, dy);
  if (dist > 1e-4) {
    const vert = Math.abs(dx) < 1e-3 || Math.abs(dx) < Math.abs(dy) * 0.25;
    if (vert) { V.going = 2; V.vert = dy >= 0 ? 1 : -1; V.vstep += dist; }
    else { V.going = 1; V.vert = 0; V.bob = 0; V.step += dist; }
  } else { V.going = 0; V.vert = 0; V.bob = 0; V.vstep = 0; }
  V.px = o.x; V.py = o.y;
  V.hurtT = (V.hurtT || 0) - dt; V.shake = Math.max(0, (V.shake || 0) - dt);
  if (V.reveal) { V.reveal.t += dt; if (V.reveal.t >= 0.7) V.reveal = null; }
  { const [c, y] = tileAt(V.px, V.py), [tx, ty] = tileXY(c, y); if (tile(c, y) === 'S' && !rw('spikeproof') && Math.abs(V.px - tx) < 0.42 && Math.abs(V.py - ty) < 0.42 && V.hurtT <= 0 && !V.slide) hurt(); }
  // hidden secret walls: glint and a quiet tick up close; standing still searches the stone
  {
    let held = false;
    for (const d in DOOR) {
      if (doorOf(a, d) !== 'crack') continue;
      const d2 = Math.hypot(V.px - DOOR[d][0], V.py - DOOR[d][1]), lv = secretLevel(a, d);
      if (d2 < 2.2 && lv < 2) {
        V.glintT[d] = (V.glintT[d] || 0) + dt;
        if (V.glintT[d] >= 0.7) {
          V.glintT[d] = 0;
          V.parts.push({ x: DOOR[d][0] + (Math.random() - 0.5) * 0.25, y: DOOR[d][1], vx: (Math.random() - 0.5) * 0.35, vy: -0.45 - Math.random() * 0.4, t: 0, life: 0.55, c: '#ffe9a8', star: 1 });
        }
        const now = performance.now();
        if (now - (V.hintAt[d] || 0) > 4000) { V.hintAt[d] = now; U.SFX.whint(); }
      }
      if (dist < 1e-3 && d2 < 1.6 && lv < 1) {
        held = true;
        if (!V.idleNear || V.idleNear.d !== d) V.idleNear = { d, t: 0 };
        V.idleNear.t += dt;
        if (V.idleNear.t >= 2) { a.whint = a.whint || {}; a.whint[d] = 1; }
      }
    }
    if (!held) V.idleNear = null;
  }
  // pickups
  const near = (x, y, r) => Math.hypot(V.px - x, V.py - y) < r;
  if (a.item && !a.used && near(8, 4.5, 0.9 + (rw('reach') || 0)) && !(a.mon && !a.mon.beaten)) {
    if (a.tr && !a.tr.beaten) msg(G.TRAINERS[a.tr.arch].n + ' guards this treasure.'); else pickup(a);
  }
  if (V.tr && trainerStep(a, dt)) return;
  if (a.type === 'lair' && a.mon && a.mon.beaten && near(8, 4.5, 0.8)) return descend();
  // wild creatures wander, then come at you when you are close
  for (const m of V.mons) {
    m.t -= dt; m.bob += dt * 4;
    const d = Math.hypot(V.px - m.x, V.py - m.y);
    if (!m.lair && d < 3.6) { [m.tx, m.ty] = chaseStep(m); m.t = 0.3; }
    else if (m.t <= 0) {
      if (m.lair) { m.tx = 8 + (Math.random() - 0.5) * 2; m.ty = 4 + (Math.random() - 0.5) * 1.4; }
      else { const c = 1 + Math.floor(Math.random() * (TC - 2)), y = 1 + Math.floor(Math.random() * 5); if (!solid(tile(c, y))) [m.tx, m.ty] = tileXY(c, y); }
      m.t = 1.5 + Math.random() * 2;
    }
    if (m.shiny && Math.random() < dt * 5) V.parts.push({ x: m.x + (Math.random() - 0.5) * 0.9, y: m.y - 0.3 - Math.random() * 0.9, vx: 0, vy: -0.6, t: 0, life: 0.7, c: Math.random() < 0.5 ? '#fff6b0' : '#ffffff', star: 1 });
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
  U.SFX.wdoor();
  placeRoom(OPP[d]);
  hud();
}
function pickup(a) {
  a.used = true;
  const m = meta();
  if (a.item === 'key') { W.keys++; U.SFX.wkey(); U.toast('Found a key! It opens this floor\'s vault.'); }
  else if (a.item === 'berry') { for (const s of W.squad) if (s.hp > 0) s.hp = Math.min(1, s.hp + 0.35); U.SFX.wberry(); U.toast('Glimberries! Your squad recovers 35% HP.'); }
  else if (a.item === 'chest') {
    const g = Math.round((10 + 6 * W.floor) * (1 + 0.5 * up('w_luck') + rw('shardMul'))); m.shards += g; W.shards += g;
    if (Math.random() < 0.5) healFit(0.25);
    U.SFX.wchest(); U.toast(`Treasure! +${g} Glimmer Shards.`);
    if (Math.random() < 0.35 + 0.2 * up('w_luck') + (rw('chestRelic') || 0)) { V.pause = true; save(); offerRelics(2, 'A relic in the chest!').then(() => { V.pause = false; V.last = performance.now(); save(); }); }
    window.AX && AX.ev('shards', g);
  }
  else if (a.item === 'tonic') { W.tonics = (W.tonics || 0) + 1; U.SFX.wberry(); U.toast('A Glim Tonic! Tap the flask at the top any time to heal your squad.'); }
  else if (a.item === 'event') { a.used = false; return runEvent(a); }
  else if (a.item === 'shrine') { for (const s of W.squad) s.hp = s.hp > 0 ? 1 : 0.5; U.SFX.wshrine(); U.toast('The shrine restores your squad, and revives the fainted.'); }
  burst(8, 4.5, a.item === 'shrine' ? '#6bff8f' : '#ffd65a');
  save(); U.save(); hud();
}

// ---- event rooms ------------------------------------------------------------------------------
const EV_N = { merchant: 'Wandering Merchant', egg: 'Mysterious Egg', altar: 'Blood Altar', well: 'Wishing Well', dummy: 'Sparring Dummy', pool: 'Glimmer Pool', explorer: 'Lost Explorer', challenge: 'Champion\'s Challenge' };
const EV_IMG = { merchant: 'wd_merchant', egg: 'wd_egg', altar: 'wd_altar', well: 'wd_well', dummy: 'wd_dummy', pool: 'wd_pool', explorer: 'wd_explorer', challenge: 'wd_banner' };
const evArt = e => `<div class="evo-stage" style="height:130px"><div class="glow"></div><img src="${IMG(EV_IMG[e])}" style="max-height:120px" alt=""></div>`;
function backOff() { V.py = Math.min(IN.y1, 4.5 + 1.6); V.inv = Math.max(V.inv, 0.6); }
async function runEvent(a) {
  V.pause = true;
  const m = meta(), f = W.floor, t = `<p style="text-align:center">`, done = () => { a.used = true; };
  const fit = W.squad.filter(s => s.hp > 0);
  let v;
  switch (a.event) {
    case 'merchant': {
      const pt = 30, pr = 70 + 20 * f;
      v = await U.ask(EV_N.merchant, evArt('merchant') + `${t}"Wares for the brave! Paid in Glimmer Shards, of course." You have <b>${m.shards}</b>.</p>`,
        U.btn('tonic', `Glim Tonic · ${pt}`, m.shards >= pt ? 'green sm' : 'ghost sm') + U.btn('relic', `A relic (pick 1 of 2) · ${pr}`, m.shards >= pr ? 'sm' : 'ghost sm') + U.btn('x', 'Just looking', 'ghost sm'));
      if (v === 'tonic' && m.shards >= pt) { m.shards -= pt; W.tonics = (W.tonics || 0) + 1; U.SFX.coin(); U.toast('Bought a Glim Tonic.'); }
      else if (v === 'relic' && m.shards >= pr) { m.shards -= pr; await offerRelics(2, 'The merchant\'s relics'); done(); }
      else if (v !== 'x') U.toast('Not enough shards.');
      break;
    }
    case 'egg': {
      v = await U.ask(EV_N.egg, evArt('egg') + `${t}A warm egg sits alone in a nest. Something inside taps back.</p>`, U.btn('hatch', 'Keep it warm', 'green') + U.btn('x', 'Leave it', 'ghost sm'));
      if (v !== 'hatch') break;
      done();
      const els = Array.from(new Set(G.BIOMES[W.biome].els)), tmax = Math.min(5, f + 1);
      const pool = Object.keys(G.SP).filter(k => G.TIER[k] <= tmax && els.includes(G.SP[k].el));
      const locked = pool.filter(k => !unlocked(k));
      const sp = locked.length && Math.random() < 0.4 ? pick(Math.random, locked) : pick(Math.random, pool);
      const fresh = !unlocked(sp);
      m.unlocked[sp] = 1; m.caught[sp] = 1; m.dex[sp] = Math.max(m.dex[sp] || 0, 1);
      if (fresh) W.found.push(sp);
      const room = W.squad.length < SQUAD_MAX;
      if (room) W.squad.push({ uid: W.nextUid++, sp, star: 1, xp: 0, hp: 1, shiny: false });
      U.SFX.wcatch();
      await U.ask('It hatched!', `<div class="evo-stage" style="height:150px"><div class="glow"></div><img src="${IMG('cr_' + sp + '1')}" style="max-height:140px" alt=""></div>${t}A baby <b>${G.SP[sp].names[0]}</b>${fresh ? ' — <b style="color:var(--gold)">NEW!</b> unlocked for good' : ''}. ${room ? 'It joins your squad.' : 'Your squad is full, so it scampers home to camp.'}</p>`, U.btn('ok', 'Hello!', 'green'));
      break;
    }
    case 'altar': {
      v = await U.ask(EV_N.altar, evArt('altar') + `${t}The crystal hums. It asks for a share of your squad's strength in return for a relic.</p><p class="small muted" style="text-align:center">Every standing creature loses 25% HP (never below 10%).</p>`, U.btn('give', 'Offer it', '') + U.btn('x', 'Walk away', 'ghost sm'));
      if (v !== 'give' || !fit.length) break;
      for (const s of fit) s.hp = Math.max(0.1, s.hp - 0.25);
      U.SFX.hit(); done();
      await offerRelics(2, 'The altar\'s gift');
      break;
    }
    case 'well': {
      v = await U.ask(EV_N.well, evArt('well') + `${t}Coins glitter at the bottom of a glowing well.</p>`, U.btn('toss', 'Toss in 20 shards (60%: a relic)', m.shards >= 20 ? '' : 'ghost') + U.btn('drink', 'Drink (heal 20%)', 'green sm') + U.btn('x', 'Leave', 'ghost sm'));
      if (v === 'toss' && m.shards >= 20) { m.shards -= 20; done(); if (Math.random() < 0.6) { const id = pick(Math.random, Object.keys(WR).filter(k => !W.relics.includes(k))); if (id) { W.relics.push(id); window.AX && AX.ev('relic'); if (WR[id].w && WR[id].w.map) revealMap(2); U.SFX.relic(); await U.ask('Your wish came true!', `<div class="list">${relicLi(id)}</div>`, U.btn('ok', 'Wonderful', 'green')); } } else { U.SFX.miss(); U.toast('Plink… nothing happens.'); } }
      else if (v === 'toss') U.toast('Not enough shards.');
      else if (v === 'drink') { healFit(0.2); done(); U.SFX.wshrine(); }
      break;
    }
    case 'dummy': {
      if (!fit.length) break;
      v = await U.ask(EV_N.dummy, evArt('dummy') + `${t}Train one creature hard: <b>+2 XP</b>, but it loses 30% HP (never below 10%).</p><div class="list">${fit.map(s => `<div class="li click" data-v="${s.uid}"><img class="ic" src="${IMG('cr_' + s.sp + s.star)}" alt=""><div class="grow"><div class="t">${G.SP[s.sp].names[s.star - 1]} ${'★'.repeat(s.star)}</div><div class="small">${Math.round(s.hp * 100)}% HP · ${s.star < 3 ? s.xp + '/' + xpStar()[s.star] + ' XP' : 'final form'}</div></div></div>`).join('')}</div>`, U.btn('x', 'Not now', 'ghost sm'));
      const s = W.squad.find(x => String(x.uid) === v); if (!s) break;
      const evos = []; gainXp(s, 2, evos); s.hp = Math.max(0.1, s.hp - 0.3); done(); if (evos.length) U.SFX.lvl(); else U.SFX.hit();
      U.toast(evos.length ? `${G.SP[s.sp].names[s.star - 2]} evolved into ${G.SP[s.sp].names[s.star - 1]}!` : `${G.SP[s.sp].names[s.star - 1]} trained hard: +2 XP.`);
      break;
    }
    case 'pool': {
      const out = W.squad.filter(s => s.hp <= 0).length;
      v = await U.ask(EV_N.pool, evArt('pool') + `${t}Liquid light swirls in the basin. It can do one thing for you.</p>`, U.btn('revive', `Revive the fainted at 50%${out ? ` (${out})` : ''}`, out ? 'green' : 'ghost') + U.btn('heal', 'Heal everyone 40%', 'green sm') + U.btn('x', 'Leave', 'ghost sm'));
      if (v === 'revive' && out) { for (const s of W.squad) if (s.hp <= 0) s.hp = 0.5; done(); U.SFX.wshrine(); }
      else if (v === 'heal') { healFit(0.4); done(); U.SFX.wshrine(); }
      break;
    }
    case 'explorer': {
      const g = Math.round((12 + 4 * f) * shardMul());
      await U.ask(EV_N.explorer, evArt('explorer') + `${t}A lost explorer shares her map of this floor, secret rooms included, and a pouch of <b>${g} shards</b>.</p>`, U.btn('ok', 'Thank you!', 'green'));
      revealMap(2); m.shards += g; W.shards += g; done(); U.SFX.wchest();
      break;
    }
    case 'challenge': {
      const c = a.cmon, S = G.SP[c.sp];
      v = await U.ask(EV_N.challenge, `<div class="evo-stage" style="height:150px"><div class="glow"></div><img src="${IMG('cr_' + c.sp + c.star)}" style="max-height:140px" alt=""></div>${t}A champion <b>${S.names[c.star - 1]}</b> ${'★'.repeat(c.star)} and ${c.escorts.length} followers challenge you. Win for a relic (pick 1 of 3).</p>`, U.btn('fight', 'Accept the challenge', '') + U.btn('x', 'Not yet', 'ghost sm'));
      if (v !== 'fight') break;
      a.mon = c; a.item = null; a.used = true;
      spawnMon(a); V.mons[0].x = 8; V.mons[0].y = 3.2; V.inv = 1.2;
      break;
    }
  }
  save(); U.save(); hud();
  if (!a.used) backOff();
  V.pause = false; V.last = performance.now();
}

// ---- battles ----------------------------------------------------------------------------------
async function battle(a, mv) {
  V.flinch = 0.52;   // the contact that starts the fight
  V.pause = true;
  const mon = a.mon, fit = W.squad.filter(m => m.hp > 0);
  const insts = fit.map(squadInst);
  const foes = [{ uid: -1, sp: mon.sp, star: mon.star, muts: [], scale: mon.scale, shiny: !!mon.shiny }].concat(mon.escorts.map((sp, i) => ({ uid: -2 - i, sp, star: mon.escStar || 1, muts: [], scale: mon.scale * 0.92 })));
  for (const f of foes) { f.skill = C.defaultSkill(f); meta().dex[f.sp] = Math.max(meta().dex[f.sp] || 0, f.star); }
  const S = G.SP[mon.sp], nm = S.names[mon.star - 1];
  U.SFX.wencounter();
  $('#wilds').classList.add('flash');
  await new Promise(r => setTimeout(r, 380));
  $('#wilds').classList.remove('flash');
  const st = await U.wildBattle(placeSide(insts, 0), placeSide(foes, 1), W.biome, `${a.type === 'lair' ? '♛ Lair: ' : a.event === 'challenge' ? '⚔ Champion ' : mon.shiny ? '✦ Shiny ' : 'Wild '}${nm}${mon.escorts.length ? ` <span class="small muted">+${mon.escorts.length}</span>` : ''}`, fightBonus());
  if (window.AX && AX.fightKills) AX.ev('kos', 1, { kills: AX.fightKills(st) });
  LASTFS = window.FightStats ? window.FightStats.block(st) : '';
  const apex = U.rollApexWild(st);
  // carry HP back to the squad
  for (const u of st.units) if (u.side === 0 && !u.summoned) { const m = W.squad.find(s => s.uid === u.inst.uid); if (m) m.hp = u.alive ? Math.max(0.05, u.hp / u.maxHp) : 0; }
  const win = st.over === 1;
  noteApex(apex);
  U.show('wilds');
  if (window.GAUDIO) GAUDIO.music('wilds_explore');
  if (win) await victory(a, mon, fit, apex);
  else {
    if (W.squad.some(m => m.hp > 0)) U.SFX.ko();   // a full wipe plays the lose stinger in endExpedition instead
    else if (rw('phoenix') && !W.phoenixUsed) {
      W.phoenixUsed = true; for (const m of W.squad) m.hp = 0.4;
      U.SFX.wshrine();
      await U.ask('Phoenix Plume!', '<p style="text-align:center">Golden fire sweeps over your fallen squad. Everyone gets back up at 40% HP.</p>', U.btn('ok', 'Back on our feet', 'green'));
    }
    if (!W.squad.some(m => m.hp > 0)) { save(); return endExpedition('fainted', apex); }
    await U.ask('Defeat', `<p style="text-align:center">${nm} drove you back. Fainted creatures sit out until the next floor (or a shrine).</p>${apexLine(apex)}${LASTFS}`, U.btn('ok', 'Regroup', 'green'));
    // back off to the door you came in through
    V.px = Math.min(IN.x1, Math.max(IN.x0, V.px + (V.px - mv.x) * 1.5)); V.py = Math.min(IN.y1, Math.max(IN.y0, V.py + (V.py - mv.y) * 1.5));
    V.inv = 2.2;
  }
  save(); U.save(); hud();
  V.pause = false; V.last = performance.now();
}
async function victory(a, mon, fit, apex) {
  const m = meta(), sp = mon.sp, S = G.SP[sp];
  mon.beaten = true; V.mons = [];
  W.wins++;
  const lair = a.type === 'lair';
  const g = Math.round((lair ? 10 + 6 * W.floor : 2 + W.floor) * shardMul());
  m.shards += g; W.shards += g;
  window.AX && AX.ev('shards', g);
  window.AX && AX.ev('wildsFight');
  if (lair) window.AX && AX.ev('lair');
  if (mon.shiny) window.AX && AX.ev('shiny');
  const fresh = !m.unlocked[sp];
  m.unlocked[sp] = 1; m.caught[sp] = 1;
  if (fresh) W.found.push(sp);
  // a shiny you beat is caught for good: shinier shops in Auto Chess, and a shiny recruit
  m.shinies = m.shinies || {};
  const shinyNew = !!mon.shiny && !m.shinies[sp];
  if (mon.shiny) { m.shinies[sp] = 1; if (!W.shinies) W.shinies = []; if (shinyNew) W.shinies.push(sp); }
  // squad XP, and evolutions mid-expedition
  const evos = [];
  for (const s of fit) gainXp(s, (lair ? 2 : 1) + rw('xp'), evos);
  if (rw('winHeal')) healFit(rw('winHeal'));
  U.SFX[mon.shiny && shinyNew ? 'wshiny' : 'wcatch']();
  const join = W.squad.length < SQUAD_MAX && !W.squad.some(s => s.sp === sp && (s.shiny || !mon.shiny));
  const body = `<div class="evo-stage" style="height:170px"><div class="glow"></div><img class="${mon.shiny ? 'shiny' : ''}" src="${IMG('cr_' + sp + mon.star)}" style="max-height:160px" alt=""></div>
    ${mon.shiny ? `<p style="text-align:center" class="wshinyline">✦ <b>Shiny ${S.names[0]} caught!</b> ${shinyNew ? 'In Auto Chess its shop offers are now 4× as likely to be shiny.' : 'You already had this shiny.'}</p>` : ''}
    <p style="text-align:center">${fresh ? `<b style="color:var(--gold)">NEW!</b> <b>${S.names[0]}</b> is unlocked for good. It now appears in the Auto Chess shop and as a starter.` : `You beat ${S.names[mon.star - 1]} again.`}</p>
    <p class="small" style="text-align:center">+${g} Glimmer Shards${lair ? ' · the way down is open' : ''}</p>
    ${evos.map(s => `<p style="text-align:center;color:#7dff9b">${G.SP[s.sp].names[s.star - 2]} evolved into <b>${G.SP[s.sp].names[s.star - 1]}</b>! ${'★'.repeat(s.star)}</p>`).join('')}
    ${apexLine(apex)}
    ${join ? `<p class="muted small" style="text-align:center">It can join your squad for the rest of this expedition (${W.squad.length}/${SQUAD_MAX}).</p>` : ''}${LASTFS}`;
  const v = await U.ask(mon.shiny && shinyNew ? 'Shiny caught!' : fresh ? 'Creature unlocked!' : 'Victory!', body, (join ? U.btn('join', `Add ${S.names[0]} to the squad`, 'green') + U.btn('no', 'Not now', 'ghost sm') : U.btn('ok', 'Continue', 'green')));
  if (v === 'join') { W.squad.push({ uid: W.nextUid++, sp, star: 1, xp: 0, hp: 1, shiny: !!mon.shiny }); U.toast((mon.shiny ? 'Shiny ' : '') + S.names[0] + ' joined your squad!'); }
  if (lair) await offerRelics(3, 'Lair treasure: take a relic');
  else if (a.event === 'challenge') { a.used = true; await offerRelics(3, 'The champion\'s prize'); }
}
async function descend() {
  V.pause = true;
  if (W.floor >= FLOORS) {
    if ((meta().badges || 0) >= 3 && W.floor === FLOORS) {
      const d = await U.ask('A dark stair…', `<div class="evo-stage" style="height:150px"><div class="glow"></div><img src="${IMG('tr_rival')}" style="max-height:140px" alt=""></div><p style="text-align:center">Three Rival Badges glint in your pack. A dark stair leads to <b>the Rival\'s Den</b>, where Jax waits with his best team.</p>`, U.btn('den', 'Face Jax', '') + U.btn('home', 'Head home', 'green sm'));
      if (d === 'den') { U.SFX.wdescend(); newFloor(FLOORS + 1); placeRoom(null); save(); hud(); U.toast('The Rival\'s Den'); V.pause = false; V.last = performance.now(); return; }
    }
    return endExpedition('done');
  }
  const v = await U.ask('Go deeper?', `<p style="text-align:center">Stairs lead down to floor ${W.floor + 1}/${FLOORS}. Rarer, stronger creatures live deeper.</p><p class="small muted" style="text-align:center">Fainted creatures recover ${40 + 15 * up('w_spring')}% HP on the way down; everyone else heals ${25 + 15 * up('w_spring')}%.</p>`, U.btn('go', 'Descend', 'green') + U.btn('stay', 'Not yet', 'ghost sm'));
  if (v !== 'go') { V.py = Math.min(IN.y1, V.py + 1.4); V.pause = false; V.last = performance.now(); return; }
  const sp = 0.15 * up('w_spring');
  for (const s of W.squad) s.hp = s.hp > 0 ? Math.min(1, s.hp + 0.25 + sp) : 0.4 + sp;
  U.SFX.wdescend();
  newFloor(W.floor + 1);
  placeRoom(null);
  save(); hud();
  U.toast(`Floor ${W.floor}: ${G.BIOMES[W.biome].name}`);
  V.pause = false; V.last = performance.now();
}


// ---- trainers (g14) -----------------------------------------------------------------------------
const FACE = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
const TOKENS = t => t.den ? 8 : t.rival ? 4 : t.captain ? 3 : 2;
// a view cone that widens with distance, blocked by rocks and pits
function sees(T) {
  const [fx, fy] = FACE[T.cur], rx = V.px - T.x, ry = V.py - T.y;
  const along = rx * fx + ry * fy, side = Math.abs(rx * fy - ry * fx);
  const len = 6.5 * (1 - Math.min(0.75, rw('sight') || 0));
  if (along < 0.2 || along > len || side > 0.65 + along * 0.14) return false;
  const n = Math.ceil(along / 0.25);
  for (let i = 1; i < n; i++) { const x = T.x + rx * i / n, y = T.y + ry * i / n, [c, yy] = tileAt(x, y); if (solid(tile(c, yy))) return false; }
  return true;
}
function trainerStep(a, dt) {
  const T = V.tr;
  T.cool -= dt;
  if (!T.spotted) {
    T.t += dt;
    if (T.turn && T.t > 3) { T.t = 0; T.cur = T.cur === T.face ? T.turn : T.face; if (T.cur === 'e' || T.cur === 'w') T.fx = T.cur === 'e' ? 1 : -1; }
    if (T.cool <= 0 && V.inv <= 0 && sees(T)) { T.spotted = true; T.bang = 0.75; V.sealed = true; U.SFX.wencounter(); minimap(); return false; }
    if (Math.hypot(V.px - T.x, V.py - T.y) < 1.05 && V.inv <= 0) { trainerBattle(a, false); return true; }
    return false;
  }
  if (T.bang > 0) { T.bang -= dt; return false; }
  // walk over around rocks and pits; if anything still blocks the way, the battle starts anyway
  T.walkT = (T.walkT || 0) + dt;
  const [tx, ty] = chaseStep(T), dx = tx - T.x, dy = ty - T.y, l = Math.hypot(dx, dy) || 1;
  if (Math.hypot(V.px - T.x, V.py - T.y) < 1.15 || T.walkT > 2.5) { T.walkT = 0; trainerBattle(a, true); return true; }
  const q = { x: T.x + dx / l * 3.6 * dt, y: T.y + dy / l * 3.6 * dt }; collideRocks(q, 0.4); T.x = q.x; T.y = q.y;
  T.fx = dx > 0 ? 1 : -1; T.walk = (T.walk || 0) + dt * 9;
  return false;
}
function drawCone(ctx, ox, oy, S) {
  const T = V.tr; if (T.spotted) return;
  const [fx, fy] = FACE[T.cur], len = 6.5 * (1 - Math.min(0.75, rw('sight') || 0)), x = ox + T.x * S, y = oy + T.y * S;
  const g = ctx.createLinearGradient(x, y, x + fx * len * S, y + fy * len * S);
  g.addColorStop(0, 'rgba(255,214,90,.22)'); g.addColorStop(1, 'rgba(255,214,90,0)');
  ctx.fillStyle = g; ctx.beginPath();
  const w0 = 0.65, w1 = 0.65 + len * 0.14;
  ctx.moveTo(x - fy * w0 * S, y + fx * w0 * S); ctx.lineTo(x + (fx * len - fy * w1) * S, y + (fy * len + fx * w1) * S);
  ctx.lineTo(x + (fx * len + fy * w1) * S, y + (fy * len - fx * w1) * S); ctx.lineTo(x + fy * w0 * S, y - fx * w0 * S); ctx.fill();
}
function drawTrainer(ctx, ox, oy, S) {
  const T = V.tr, a = room(), art = img(G.TRAINERS[a.tr.arch].art), x = ox + T.x * S, y = oy + T.y * S;
  const H = TRAINER_H * S;
  // trainer art faces left, so mirror it to look right. Captains and the den glow at the same height.
  spriteH(ctx, art, x, y + 0.03 * S, H, -(T.fx || -1), T.spotted && T.bang <= 0 ? Math.abs(Math.sin(T.walk || 0)) * 0.05 : 0, !!(a.tr.captain || a.tr.den), false);
  if (T.spotted && T.bang > 0) {
    const bx = x, by = y - H - 0.3 * S, r = 0.32 * S;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(bx, by, r, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#e8243c'; ctx.font = `900 ${Math.round(r * 1.5)}px Fredoka, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', bx, by + r * 0.05);
  }
}
// scouting: see their team and tactic, pick a lead, then battle
async function trainerBattle(a, spotted) {
  V.pause = true;
  const t = a.tr, T = G.TRAINERS[t.arch], fit = W.squad.filter(s => s.hp > 0);
  const theirEls = t.team.map(x => G.SP[x.sp].el);
  const edge = s => theirEls.filter(e => (G.STRONG[G.SP[s.sp].el] || []).includes(e)).length;
  const title = (t.den ? 'The Rival\'s Den: ' : t.captain ? 'Floor captain ' : '') + T.n;
  const bonus = Object.assign({}, T.tactic.b);
  for (const id of t.relics) for (const k in WR[id].b || {}) bonus[k] = (bonus[k] || 0) + WR[id].b[k];
  const body = `<div class="trhead"><img src="${IMG(T.art)}" alt=""><div><p><i>"${T.line}"</i></p>
      <p class="small"><b style="color:var(--gold)">${T.tactic.n}:</b> ${T.tactic.d}</p>
      <p class="small">Holding: ${t.relics.map(id => `<img class="ri" src="${IMG(WR[id].ic)}" alt="">${WR[id].n}`).join(', ')}</p></div></div>
    <div class="trteam">${t.team.map(x => `<div><img src="${IMG('cr_' + x.sp + x.star)}" alt=""><div>${'★'.repeat(x.star)}</div>${U.elBadge(G.SP[x.sp].el)}</div>`).join('')}</div>
    <p class="muted small" style="text-align:center;margin:6px 0 4px">Pick a lead: it fights up front with +10% HP and ATK. <span style="color:#7dff9b">▲</span> = strong against their team.</p>
    <div class="list">${fit.map(s => `<div class="li click" data-v="lead:${s.uid}"><img class="ic" src="${IMG('cr_' + s.sp + s.star)}" alt=""><div class="grow"><div class="t">${G.SP[s.sp].names[s.star - 1]} ${'★'.repeat(s.star)} ${edge(s) ? `<span style="color:#7dff9b">▲${edge(s)}</span>` : ''}</div><div class="small">${Math.round(s.hp * 100)}% HP</div></div></div>`).join('')}</div>`;
  const v = await U.ask(title, body, U.btn('go', 'Battle!', 'green') + (spotted || t.den ? '' : U.btn('x', 'Not now', 'ghost sm')));
  if (v === 'x') { V.tr.cool = 2.5; V.inv = 1; backOff(); V.pause = false; V.last = performance.now(); return; }
  const lead = v && v.startsWith('lead:') ? +v.slice(5) : null;
  const insts = fit.map(squadInst);
  if (lead != null) { const i = insts.findIndex(x => x.uid === lead); if (i >= 0) { insts[i].scale = 1.1; insts.unshift(insts.splice(i, 1)[0]); } }
  const foes = t.team.map((x, i) => { const f = { uid: -1 - i, sp: x.sp, star: x.star, muts: [], scale: t.scale }; f.skill = C.defaultSkill(f); meta().dex[x.sp] = Math.max(meta().dex[x.sp] || 0, x.star); return f; });
  U.SFX.wencounter();
  $('#wilds').classList.add('flash'); await new Promise(r => setTimeout(r, 380)); $('#wilds').classList.remove('flash');
  const st = await U.wildBattle(placeSide(insts, 0), placeSide(foes, 1), W.biome, '⚔ ' + title, fightBonus(), bonus);
  if (window.AX && AX.fightKills) AX.ev('kos', 1, { kills: AX.fightKills(st) });
  LASTFS = window.FightStats ? window.FightStats.block(st) : '';
  const apex = U.rollApexWild(st);
  if (window.GAUDIO) GAUDIO.music('wilds_explore');
  for (const u of st.units) if (u.side === 0 && !u.summoned) { const m = W.squad.find(s => s.uid === u.inst.uid); if (m) m.hp = u.alive ? Math.max(0.05, u.hp / u.maxHp) : 0; }
  U.show('wilds');
  V.sealed = false;
  noteApex(apex);
  if (st.over === 1) await trainerWin(a, apex);
  else {
    U.SFX.ko();
    if (!W.squad.some(m => m.hp > 0) && rw('phoenix') && !W.phoenixUsed) { W.phoenixUsed = true; for (const m of W.squad) m.hp = 0.4; await U.ask('Phoenix Plume!', '<p style="text-align:center">Golden fire sweeps over your fallen squad. Everyone gets back up at 40% HP.</p>', U.btn('ok', 'Back on our feet', 'green')); }
    if (!W.squad.some(m => m.hp > 0)) { save(); return endExpedition('fainted', apex); }
    await U.ask('Defeat', `<p style="text-align:center">${T.n}: "Come back when you're stronger!" Fainted creatures sit out until the next floor (or a shrine).</p>${apexLine(apex)}${LASTFS}`, U.btn('ok', 'Regroup', 'green'));
    Object.assign(V.tr, { x: V.tr.x0, y: V.tr.y0, spotted: false, bang: 0, cool: 3, cur: V.tr.face });
    backOff(); V.inv = 2;
  }
  save(); U.save(); hud();
  V.pause = false; V.last = performance.now();
}
async function trainerWin(a, apex) {
  const t = a.tr, T = G.TRAINERS[t.arch], m = meta();
  t.beaten = true; V.tr = null; W.wins++;
  const tok = TOKENS(t) + (rw('tokens') || 0), g = Math.round((6 + 3 * Math.min(W.floor, FLOORS)) * shardMul());
  m.tokens = (m.tokens || 0) + tok; m.shards += g; W.shards += g;
  window.AX && AX.ev('shards', g);
  window.AX && AX.ev('trainer');
  const evos = [];
  for (const s of W.squad) if (s.hp > 0) gainXp(s, 2 + rw('xp'), evos);
  if (rw('winHeal')) healFit(rw('winHeal'));
  m.trCards = m.trCards || {};
  const card = !m.trCards[t.arch]; m.trCards[t.arch] = 1;
  const lines = [`+${tok} Trainer Tokens · +${g} Glimmer Shards`];
  if (card) lines.push(`<b style="color:var(--gold)">New trainer card:</b> ${T.n}!`);
  let skin = null;
  if (t.rival && !t.den) { m.badges = Math.min(3, (m.badges || 0) + 1); lines.push(`<img class="ri" src="${IMG('wd_badge')}" alt=""><b style="color:#c9a6ff">Rival Badge ${m.badges}/3!</b>${m.badges >= 3 ? ' The Rival\'s Den opens after floor 5.' : ''}`); }
  if (t.den) { m.den = 1; window.AX && AX.ev('den'); }
  for (const k in G.SKINS) if (skinOpen(k) && !(m.skinsSeen || {})[k] && G.SKINS[k].req) { m.skinsSeen = Object.assign(m.skinsSeen || {}, { [k]: 1 }); skin = k; }
  if (skin) lines.push(`<b style="color:#7dff9b">New tamer outfit: ${G.SKINS[skin].n}!</b> Pick it before your next expedition.`);
  for (const s of evos) lines.push(`<span style="color:#7dff9b">${G.SP[s.sp].names[s.star - 2]} evolved into <b>${G.SP[s.sp].names[s.star - 1]}</b>!</span>`);
  if (apex) { const S = G.SP[apex.sp]; lines.push(`<b style="color:var(--gold)">◆ Apex Core: ${S.names[3] || S.names[S.names.length - 1]}!</b> Ascend a ★3 ${S.names[2] || S.names[S.names.length - 1]} to unlock this form.`); }
  U.SFX.wcatch();
  await U.ask(t.den ? 'Jax is beaten!' : 'Trainer defeated!', `<div class="evo-stage" style="height:150px"><div class="glow"></div><img src="${IMG(T.art)}" style="max-height:140px" alt=""></div>
    <p style="text-align:center"><i>"${t.rival ? 'Tch. Next time, I\'ll be ready.' : 'What a battle! You\'ve earned this.'}"</i></p>${lines.map(l => `<p class="small" style="text-align:center">${l}</p>`).join('')}${LASTFS}`, U.btn('ok', 'Continue', 'green'));
  if (t.captain) await offerRelics(3, 'The captain\'s prize (rare relics)', false, true);
  if (t.den) return endExpedition('champion');
}

// ---- tamer outfits -----------------------------------------------------------------------------
function skinOpen(k) {
  const q = (G.SKINS[k] || {}).req, m = meta();
  if (!q) return true;
  if (q.badges) return (m.badges || 0) >= q.badges;
  if (q.den) return !!m.den;
  if (q.cards) return Object.keys(m.trCards || {}).filter(c => c !== 'rival').length >= q.cards;
  if (q.ach) return !!(window.AX && AX.has(q.ach));
  if (q.stamps) return ((m.daily && m.daily.stamps) || 0) >= q.stamps;
  return false;
}
// recolour the jacket (the art's teal range) at runtime, so outfits follow every tamer frame
const skinCache = {};
function skinImg(im) {
  const k = meta().skin, sk = G.SKINS[k];
  if (sk && sk.folder) return im;
  if (!sk || sk.hue == null || !skinOpen(k) || !ready(im) || im instanceof HTMLCanvasElement) return im;
  const ck = im.src + '|' + k;
  if (skinCache[ck]) return skinCache[ck];
  const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
  const x = c.getContext('2d'); x.drawImage(im, 0, 0);
  try {
    const d = x.getImageData(0, 0, c.width, c.height), p = d.data;
    for (let i = 0; i < p.length; i += 4) {
      if (p[i + 3] < 8) continue;
      const r = p[i] / 255, g = p[i + 1] / 255, b = p[i + 2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, dd = mx - mn;
      if (dd < 0.06) continue;
      const sat = l > 0.5 ? dd / (2 - mx - mn) : dd / (mx + mn);
      let h = mx === r ? ((g - b) / dd) % 6 : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4; h *= 60; if (h < 0) h += 360;
      if (h < 145 || h > 215 || sat < 0.18 || l < 0.08 || l > 0.93) continue;
      const H = ((sk.hue + (h - 180) * 0.5) % 360 + 360) % 360, Sa = Math.min(1, sat * (sk.sat || 1));
      const q2 = l < 0.5 ? l * (1 + Sa) : l + Sa - l * Sa, p2 = 2 * l - q2;
      const hu = t => { t = (t + 1) % 1; return t < 1 / 6 ? p2 + (q2 - p2) * 6 * t : t < 0.5 ? q2 : t < 2 / 3 ? p2 + (q2 - p2) * (2 / 3 - t) * 6 : p2; };
      p[i] = hu(H / 360 + 1 / 3) * 255; p[i + 1] = hu(H / 360) * 255; p[i + 2] = hu(H / 360 - 1 / 3) * 255;
    }
    x.putImageData(d, 0, 0);
  } catch (e) { return im; }
  skinCache[ck] = c;
  return c;
}
function skinThumb(k) {
  const sk = G.SKINS[k];
  if (sk && sk.folder) return IMG(sk.folder + '/wd_tamer_idle_1');
  const im = img('wd_tamer_idle_1'); if (!ready(im)) return IMG('wd_tamer_idle_1');
  const prev = meta().skin; meta().skin = k; const c = skinImg(im); meta().skin = prev;
  return c instanceof HTMLCanvasElement ? c.toDataURL() : IMG('wd_tamer_idle_1');
}

// ---- the Trainer's Post (camp): spend Trainer Tokens -------------------------------------------------
async function post() {
  const m = meta(), TC = G.TOKEN_COST;
  m.wstar = m.wstar || {}; m.lures = m.lures || {}; m.shinyBoost = m.shinyBoost || {};
  for (;;) {
    const tk = m.tokens || 0, list = Object.keys(G.SP).filter(unlocked).sort((a, b) => G.TIER[a] - G.TIER[b]);
    const v = await U.ask('The Trainer\'s Post', `<p class="muted small" style="text-align:center">Beat trainers in the Wilds for <b>Trainer Tokens</b>. You have <b>${tk}</b> <img class="ri" src="${IMG('wd_token')}" alt="">.</p>
      <h3 class="camph">Lures <span class="small muted">(${TC.lure} each; pick one when you set out, and that element shows up 4× as often)</span></h3>
      <div class="row wrap center" style="gap:6px">${G.ELS.map(e => `<button class="btn sm ${tk >= TC.lure ? '' : 'ghost'}" data-v="lure:${e}">${U.elBadge(e)} ${m.lures[e] || 0}</button>`).join('')}</div>
      <h3 class="camph">Training <span class="small muted">(start Wilds expeditions at ★2 for ${TC.star2}, ★3 for ${TC.star3}) · Shiny sense ✦ (${TC.shiny}: 4× shiny odds for that species in the Wilds)</span></h3>
      <div class="list">${list.map(sp => { const st = m.wstar[sp] || 1, nx = st < 3 ? (st === 1 ? TC.star2 : TC.star3) : 0; return `<div class="li"><img class="ic" src="${IMG('cr_' + sp + st)}" alt=""><div class="grow"><div class="t">${G.SP[sp].names[st - 1]} ${'★'.repeat(st)}${m.shinyBoost[sp] ? ' <span class="wshiny">✦</span>' : ''}</div></div>${nx ? `<button class="btn sm ${tk >= nx ? '' : 'ghost'}" data-v="star:${sp}">★${st + 1} · ${nx}</button>` : ''}${m.shinyBoost[sp] ? '' : `<button class="btn sm ghost" data-v="shiny:${sp}">✦ ${TC.shiny}</button>`}</div>`; }).join('')}</div>`,
      U.btn('x', 'Done', 'green'));
    if (!v || v === 'x') break;
    const [kind, id] = v.split(':'), cost = kind === 'lure' ? TC.lure : kind === 'shiny' ? TC.shiny : (m.wstar[id] || 1) === 1 ? TC.star2 : TC.star3;
    if ((m.tokens || 0) < cost) { U.toast('Not enough Trainer Tokens. Beat trainers in the Wilds!'); continue; }
    m.tokens -= cost; U.SFX.coin();
    if (kind === 'lure') m.lures[id] = (m.lures[id] || 0) + 1;
    else if (kind === 'shiny') m.shinyBoost[id] = 1;
    else m.wstar[id] = Math.min(3, (m.wstar[id] || 1) + 1);
    U.save();
  }
}
// trainer cards and outfits for the Glimdex
function dexHtml() {
  const m = meta(), cards = m.trCards || {};
  return `<h3 class="camph">Trainer cards ${Object.keys(cards).length}/${Object.keys(G.TRAINERS).length} · <img class="ri" src="${IMG('wd_badge')}" alt="">Rival Badges ${m.badges || 0}/3</h3>
    <div class="dex trcards">${Object.keys(G.TRAINERS).map(k => `<div class="${cards[k] ? '' : 'unseen'}"><img src="${IMG(G.TRAINERS[k].art)}" alt=""><div>${cards[k] ? G.TRAINERS[k].n : '???'}</div></div>`).join('')}</div>
    <h3 class="camph">Tamer outfits</h3>
    <div class="dex trcards">${Object.keys(G.SKINS).map(k => `<div class="${skinOpen(k) ? '' : 'unseen'}"><img src="${skinOpen(k) ? skinThumb(k) : IMG('wd_tamer_idle_1')}" alt=""><div>${G.SKINS[k].n}</div><div class="small muted">${skinOpen(k) ? '' : G.SKINS[k].d}</div></div>`).join('')}</div>`;
}

// ---- drawing ------------------------------------------------------------------------------------
function draw() {
  const cv = V.cv, b = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
  if (cv.width !== Math.round(b.width * dpr) || cv.height !== Math.round(b.height * dpr)) { cv.width = Math.round(b.width * dpr); cv.height = Math.round(b.height * dpr); }
  // fit the room; on a tall phone screen zoom in to fill the height and follow the tamer
  const ctx = V.ctx, fit = Math.min(cv.width / RW, cv.height / RH), S = Math.max(fit, Math.min(cv.width / 6.5, cv.height / RH));
  const cam = (v, view, size) => view >= size * S ? (view - size * S) / 2 : Math.min(0, Math.max(view - size * S, view / 2 - v * S));
  const sh = V.shake > 0 ? (Math.random() - 0.5) * S * 0.15 : 0;
  const ox = cam(V.px, cv.width, RW) + sh, oy = cam(V.py, cv.height, RH) + sh;
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
  const ents = V.mons.map(m => ({ y: m.y, f: () => spriteH(ctx, img('cr_' + room().mon.sp + room().mon.star), ox + m.x * S, oy + m.y * S, m.sz * S, m.fx || -1, Math.sin(m.bob) * 0.04, m.lair, m.shiny) }));
  for (const [x, y, rr] of rockList(room())) ents.push({ y, f: () => drawRock(ctx, ox, oy, S, x, y, rr) });
  ents.push({ y: V.py, f: () => { if (V.inv > 0 && Math.floor(V.inv * 10) % 2) ctx.globalAlpha = 0.5; const pose = tamerPose(); const o = Object.assign({ rim: 1 }, pose[3] || {}); sprite(ctx, skinImg(tamerImg(pose[0])), ox + V.px * S, oy + V.py * S, 1.3 * S, pose[1], pose[2], false, false, o); ctx.globalAlpha = 1; } });
  if (V.tr) { drawCone(ctx, ox, oy, S); ents.push({ y: V.tr.y, f: () => drawTrainer(ctx, ox, oy, S) }); }
  ents.sort((p, q) => p.y - q.y).forEach(e => e.f());
  for (const p of V.parts) {
    ctx.globalAlpha = 1 - p.t / p.life; ctx.fillStyle = p.c;
    const x = ox + p.x * S, y = oy + p.y * S, r = S * (p.star ? 0.11 : 0.07);
    ctx.beginPath();
    if (p.star) for (let i = 0; i < 8; i++) { const rr = i % 2 ? r * 0.25 : r, an = i * Math.PI / 4; ctx.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr); }
    else ctx.arc(x, y, r, 0, 6.3);
    ctx.fill();
  }
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
    const [x, y, rot] = DOOR[d];
    drawDoor(ctx, a, st, d, x, y, rot, ox, oy, S, live);
  }
  const grid = a.tiles ? a.tiles.split('|') : null;
  const trapImg = kind => { const b = img('wd_' + kind + '_' + W.biome); return ready(b) ? b : img('wd_' + kind); };
  if (grid) for (let y = 0; y < TR; y++) for (let c = 0; c < TC; c++) {
    const ch = grid[y][c]; if (ch !== 'P' && ch !== 'S') continue;
    const [tx, ty] = tileXY(c, y), im = trapImg(ch === 'P' ? 'pit' : 'spikes'), w = (ch === 'P' ? 1.12 : 1.04) * S;
    if (ready(im)) ctx.drawImage(im, ox + tx * S - w / 2, oy + ty * S - w / 2, w, w);
    else { ctx.fillStyle = ch === 'P' ? '#05030c' : '#8a8fa0'; ctx.fillRect(ox + (tx - 0.45) * S, oy + (ty - 0.45) * S, 0.9 * S, 0.9 * S); }
  }
  if (!live) for (const [x, y, rr] of rockList(a)) drawRock(ctx, ox, oy, S, x, y, rr);
  const cx = ox + 8 * S, cy = oy + 4.5 * S;
  if (a.item && !a.used && !(a.mon && !a.mon.beaten)) {
    const evNpc = a.item === 'event' && (a.event === 'merchant' || a.event === 'explorer' || a.event === 'dummy');
    const evProp = a.item === 'event' && !evNpc;
    const k = a.item === 'event' ? EV_IMG[a.event] : { key: 'wd_key', berry: 'wd_berry', chest: 'wd_chest', shrine: 'wd_shrine', tonic: 'wd_tonic' }[a.item], im = img(k);
    const t = performance.now() / 1000, bob = ['key', 'berry', 'tonic'].includes(a.item) ? Math.sin(t * 3) * 0.08 * S : 0;
    const gl = a.item === 'shrine' || a.item === 'tonic' ? '107,255,143' : a.item === 'event' ? '111,211,255' : '255,214,90';
    if (evNpc && ready(im)) spriteH(ctx, im, cx, cy + 0.03 * S, 1.3 * S, 1, 0, false, false);
    else if (evProp && ready(im)) {
      const box = 1.5 * S, ar = im.naturalWidth / im.naturalHeight;
      const w = ar >= 1 ? box : box * ar, h = ar >= 1 ? box / ar : box;
      shadow(ctx, cx, cy + h * 0.35, w * 0.32); glow(ctx, cx, cy - h * 0.15, Math.max(w, h) * 0.7, gl);
      ctx.drawImage(im, cx - w / 2, cy - h * 0.72, w, h);
    } else if (ready(im)) {
      const sz = (a.item === 'shrine' ? 1.6 : a.item === 'chest' ? 1.3 : (a.item === 'key' || a.item === 'berry') ? 1.0 : 0.9) * S;
      shadow(ctx, cx, cy + sz * 0.3, sz * 0.4); glow(ctx, cx, cy - sz * 0.2, sz * 0.75, gl);
      ctx.drawImage(im, cx - sz / 2, cy - sz * 0.75 + bob, sz, sz);
    }
  }
  if (a.type === 'lair' && a.mon && a.mon.beaten) { const im = img('wd_stairs'); if (ready(im)) { glow(ctx, cx, cy, 1.2 * S, '120,200,255'); ctx.drawImage(im, cx - 0.8 * S, cy - 0.8 * S, 1.6 * S, 1.6 * S); } }
  if (!live) return;
}
function rockList(a) {
  const out = (a.rocks || []).slice();
  if (a.tiles) a.tiles.split('|').forEach((row, y) => { for (let c = 0; c < TC; c++) if (row[c] === 'R') { const [x, yy] = tileXY(c, y); out.push([x, yy, 0.5]); } });
  return out;
}
function drawRock(ctx, ox, oy, S, x, y, rr) {
  const im = img('wd_rock'); if (!ready(im)) return;
  shadow(ctx, ox + x * S, oy + (y + rr * 0.55) * S, rr * S);
  ctx.drawImage(im, ox + (x - rr * 1.3) * S, oy + (y - rr * 1.6) * S, rr * 2.6 * S, rr * 2.6 * S);
}
function shadow(ctx, x, y, r) { ctx.fillStyle = 'rgba(0,0,0,.32)'; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.38, 0, 0, 6.3); ctx.fill(); }
// one radial-gradient disc, stretched into the foot ellipse each frame. No shadowBlur, no filter.
let footShade = null;
function footShadeSprite() {
  if (footShade) return footShade;
  const N = 160, c = document.createElement('canvas');
  c.width = N; c.height = N;
  const g = c.getContext('2d'), r = N / 2;
  const grd = g.createRadialGradient(r, r, r * 0.06, r, r, r);
  grd.addColorStop(0, 'rgba(0,0,0,.55)');
  grd.addColorStop(0.42, 'rgba(0,0,0,.24)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.beginPath(); g.arc(r, r, r, 0, Math.PI * 2); g.fill();
  footShade = c;
  return c;
}
// soft contact under the tamer's feet: a feathered ellipse, not a disc behind the whole body
function contactShadow(ctx, x, y, sz, lift) {
  const k = 1 - 0.35 * Math.min(1, (lift || 0) / 0.07);
  const rx = sz * 0.40 * k, ry = sz * 0.14 * k;
  const cy = y + ry * 0.25;
  ctx.drawImage(footShadeSprite(), x - rx, cy - ry, rx * 2, ry * 2);
}
function glow(ctx, x, y, r, rgb) {
  const t = performance.now() / 1000, g = ctx.createRadialGradient(x, y, 0, x, y, r * (1 + Math.sin(t * 3) * 0.06));
  g.addColorStop(0, `rgba(${rgb},.45)`); g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 1.1, 0, 6.3); ctx.fill();
}
// per-wall gate, unrotated. Biome skin, then the grey file, then the old rotated sprite.
// While a per-wall file is still decoding, hold rather than flash the flat cutout.
function gateIm(kind, d) {
  const neu = img('wd_' + kind + '_' + d);
  const skin = DOORSKIN[W.biome] ? img('wd_' + kind + '_' + d + '_' + W.biome) : null;
  if (skin && ready(skin)) return { im: skin, mode: 'gate' };
  if (ready(neu)) return { im: neu, mode: 'gate' };
  if ((skin && !skin.complete) || !neu.complete) return null;
  const im = img(kind === 'door' ? 'wd_door' : kind === 'lock' ? 'wd_lock' : 'wd_crack');
  return ready(im) ? { im, mode: 'rot' } : null;
}
function paintGate(ctx, kind, d, x, y, rot, ox, oy, S) {
  const g = gateIm(kind, d); if (!g) return;
  if (g.mode === 'gate') return drawGate(ctx, g.im, d, x, y, ox, oy, S);
  ctx.save(); ctx.translate(ox + x * S, oy + y * S); ctx.rotate(rot);
  const w = 1.9 * S;   // shared fallback size; the old crack 1.5 split is not in this file
  ctx.drawImage(g.im, -w / 2, -w * 0.62, w, w);
  ctx.restore();
}
// v4 secret art. Returns the image, 'wait' while it is still loading, or null (no file / 404 -> the plain-wall look).
function secretIm(kind, d) {
  if (!SECRETSKIN[W.biome]) return null;
  const im = img('wd_' + kind + '_' + d + '_' + W.biome);
  return ready(im) ? im : (im.complete ? null : 'wait');
}
function paintSecret(ctx, kind, d, x, y, ox, oy, S, alpha) {   // false = no v4 file, caller falls back
  const im = secretIm(kind, d);
  if (im === 'wait') return true;
  if (!im) return false;
  ctx.save(); ctx.globalAlpha *= alpha; drawGate(ctx, im, d, x, y, ox, oy, S); ctx.restore();
  return true;
}
function paintOpenGate(ctx, sec, d, x, y, rot, ox, oy, S) {   // a found secret wall: revealed passage, else the normal open door
  if (sec && paintSecret(ctx, 'secretopen', d, x, y, ox, oy, S, 1)) return;
  paintGate(ctx, 'door', d, x, y, rot, ox, oy, S);
}
function drawDoor(ctx, a, st, d, x, y, rot, ox, oy, S, live) {
  const sec = secretEnds(a, d);                          // the secret room behind this wall, or null
  if (sec && !sec.found && st === 'sealed') st = 'crack';  // a trainer lock must not out a hidden wall
  const revealing = V.reveal && V.reveal.d === d && V.reveal.k === key(a.x, a.y) && V.reveal.t < 0.7;
  if (revealing) {
    const t = V.reveal.t, openA = t < 0.35 ? 0 : (t - 0.35) / 0.35;
    ctx.save(); ctx.globalAlpha = 1 - openA;
    paintSecret(ctx, 'secret', d, x, y, ox, oy, S, 1); paintGate(ctx, 'crack', d, x, y, rot, ox, oy, S);
    ctx.restore();
    if (openA > 0) { ctx.save(); ctx.globalAlpha = openA; paintOpenGate(ctx, sec, d, x, y, rot, ox, oy, S); ctx.restore(); }
    return;
  }
  if (st !== 'crack') {
    if (st === 'open' && sec) return paintOpenGate(ctx, sec, d, x, y, rot, ox, oy, S);   // found secret door
    return paintGate(ctx, st === 'open' ? 'door' : 'lock', d, x, y, rot, ox, oy, S);
  }
  const lv = secretLevel(a, d);
  const R = secretHintRange();
  const d2 = live ? Math.hypot(V.px - DOOR[d][0], V.py - DOOR[d][1]) : 99;
  const near = d2 < R ? Math.min(1, (R - d2) / (R - 1.6)) : 0;
  paintSecret(ctx, 'secret', d, x, y, ox, oy, S, SECRET_FAR_A + (1 - SECRET_FAR_A) * near);   // camouflage; 0 from afar
  if (lv >= 2) return paintGate(ctx, 'crack', d, x, y, rot, ox, oy, S);
  if (!live) return;
  const seam = d2 < R ? (1 - d2 / R) * 0.22 : 0;
  const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 1000 * 4);
  let alpha = seam * pulse;
  if (lv >= 1) alpha = Math.max(alpha, 0.45);
  if (V.push && V.push.d === d && V.push.t > 0) alpha = Math.max(alpha, Math.min(1, V.push.t / 0.9));
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.min(1, alpha);
  paintGate(ctx, 'crack', d, x, y, rot, ox, oy, S);
  ctx.restore();
}
function drawGate(ctx, im, d, x, y, ox, oy, S) {
  const w = DOORW * S, [fx, fy] = DOORA[d];
  ctx.drawImage(im, ox + x * S - w * fx, oy + y * S - w * fy, w, w);
}
// true once every frame of a direction decoded; false for good if any file 404s (then the waddle runs)
const vwalkState = {};
function vwalkOk(dir) {
  const n = VWALK[dir]; if (!n) return false;
  const id = meta().skin, sk = G.SKINS[id];
  // pre-coloured outfits only stride when their own up/down frames shipped
  if (sk && sk.folder && skinOpen(id)) {
    for (let i = 1; i <= n; i++) if (!(window.GD_ICON_MANIFEST && GD_ICON_MANIFEST[sk.folder + '/wd_tamer_' + dir + '_' + i])) return false;
    return true;
  }
  if (vwalkState[dir] !== undefined) return vwalkState[dir];
  let all = true;
  for (let i = 1; i <= n; i++) {
    const im = img('wd_tamer_' + dir + '_' + i);
    if (im.complete && im.naturalWidth === 0) return (vwalkState[dir] = false);
    if (!ready(im)) all = false;
  }
  if (all) vwalkState[dir] = true;
  return all;
}
// hurt flinch, then a side stride (mirrored when facing left). Up/down uses real frames when
// they have decoded, otherwise a distance-driven waddle on the still (lift, lean, mirror).
function tamerPose() {
  if (V.flinch > 0.26) return ['wd_tamer_hurt_1', V.fx || 1, 0];
  if (V.flinch > 0) return ['wd_tamer_hurt_2', V.fx || 1, 0];
  if (V.going === 2) {
    const dir = V.vert > 0 ? 'down' : 'up', n = VWALK[dir];
    // +1e-4: 1.3/8 is not binary-exact, so the last frame of a cycle would otherwise stick
    if (vwalkOk(dir)) return ['wd_tamer_' + dir + '_' + (1 + Math.floor(V.vstep / (WALK_CYCLE / n) + 1e-4) % n), 1, 0];
    const p = V.vstep / (WALK_CYCLE / 2), foot = Math.floor(p) % 2, ph = p % 1;
    const o = { lift: Math.sin(Math.PI * ph) * 0.07, rot: (foot ? 1 : -1) * 0.07, sx: foot ? 1 : -1, sq: 1 - 0.035 * Math.sin(Math.PI * ph) };
    if (LEGHACK) o.leg = 'wd_tamer_walk_' + (foot ? 6 : 2);
    return [dir === 'down' ? 'wd_tamer_down' : 'wd_tamer_up', 1, 0, o];
  }
  if (V.going === 1) return ['wd_tamer_walk_' + (1 + Math.floor(V.step / (WALK_CYCLE / 8)) % 8), V.fx || 1, 0];
  return ['wd_tamer_idle_' + (1 + Math.floor(performance.now() / 260) % 4), V.fx || 1, 0];
}
function tamerImg(k) {
  const key = tamerKey(k);
  const im = img(key);
  if (ready(im)) { V.shown = key; return im; }
  const prev = V.shown && imgs[V.shown];
  if (prev && ready(prev)) return prev;
  const idle = img(tamerKey('wd_tamer_idle_1'));
  if (ready(idle)) return idle;
  return img(tamerKey('wd_tamer'));
}
// a standing sprite anchored at its feet; creature art faces right, so fx -1 mirrors it.
// o (optional): { lift, rot, sx, sq, leg } for the up/down waddle.
// The tamer's light rim is baked into the frame (rimOf). Nothing here sets ctx.filter or shadowBlur.
function sprite(ctx, im, x, y, sz, fx, bob, boss, shiny, o) {
  o = o || {};
  const lift = o.lift || 0;
  if (o.rim) contactShadow(ctx, x, y, sz, lift);
  else shadow(ctx, x, y, sz * 0.32 * (1 - 0.25 * Math.min(1, lift / 0.07)));
  if (boss) glow(ctx, x, y - sz * 0.4, sz * 0.7, '255,90,110');
  if (shiny) glow(ctx, x, y - sz * 0.45, sz * 0.62, '255,246,176');
  if (!ready(im)) return;
  ctx.save();
  ctx.translate(x, y - lift * sz);
  ctx.rotate(o.rot || 0);
  ctx.scale((fx < 0 ? -1 : 1) * (o.sx || 1), (1 + (bob || 0)) * (o.sq || 1));
  if (shiny) ctx.drawImage(shinyImg(im), -sz / 2, -sz * 0.92, sz, sz);
  else if (o.rim) drawRimmed(ctx, im, -sz / 2, -sz * 0.92, sz, sz);
  else ctx.drawImage(im, -sz / 2, -sz * 0.92, sz, sz);
  if (LEGHACK && o.leg) {
    const leg = img(o.leg);
    if (ready(leg)) {
      const sy = leg.naturalHeight * 0.74, sh = leg.naturalHeight * 0.19, dw = sz * 0.45, dh = sz * 0.19;
      ctx.drawImage(leg, 0, sy, leg.naturalWidth, sh, -dw / 2, -sz * 0.92 + sz * 0.74, dw, dh);
    }
  }
  ctx.restore();
}
// same anchor, but the file's own aspect: height H, width from the bitmap (capped at 1.5 H).
function spriteH(ctx, im, x, y, H, fx, bob, boss, shiny, o) {
  o = o || {};
  if (!ready(im)) return;
  const ar = im.naturalWidth / im.naturalHeight;
  let w = H * ar, h = H;
  if (w > 1.5 * h) { w = 1.5 * h; h = w / ar; }
  const lift = o.lift || 0;
  shadow(ctx, x, y, w * 0.38 * (1 - 0.25 * Math.min(1, lift / 0.07)));
  if (boss) glow(ctx, x, y - h * 0.4, h * 0.7, '255,90,110');
  if (shiny) glow(ctx, x, y - h * 0.45, h * 0.62, '255,246,176');
  ctx.save();
  ctx.translate(x, y - lift * h);
  ctx.rotate(o.rot || 0);
  ctx.scale((fx < 0 ? -1 : 1) * (o.sx || 1), (1 + (bob || 0)) * (o.sq || 1));
  ctx.drawImage(shiny ? shinyImg(im) : im, -w / 2, -h, w, h);
  ctx.restore();
}
// ---- tamer rim + shiny colour, baked once (the room canvas never takes a filter) ------------
// Current outfit only: side walk, up/down walk, idle, and the stills. Cleared when the outfit changes.
const RIM_MAX = 40;
const rimCache = new Map();
let rimSkin = '', rimJob = 0, rimSeq = 0;
function noteTamerSkin() {
  const id = meta().skin || 'classic';
  if (id === rimSkin) return;
  rimCache.clear();
  rimSkin = id;
  rimJob++;
}
function tamerSrcSize(im) {
  return [im.naturalWidth || im.width || 0, im.naturalHeight || im.height || 0];
}
// faint light rim plus a short dark drop, painted with offset copies. Pad keeps the feet on the same pixels.
function bakeRim(im) {
  const [W, H] = tamerSrcSize(im);
  if (!W || !H) return null;
  const rad = Math.max(2, Math.round(Math.max(W, H) * 0.015));
  const darkDy = Math.round(rad * 0.9), darkR = Math.round(rad * 1.35);
  const pad = darkR + darkDy + 2;
  const c = document.createElement('canvas');
  c.width = W + pad * 2; c.height = H + pad * 2;
  const g = c.getContext('2d');
  const scratch = document.createElement('canvas');
  scratch.width = c.width; scratch.height = c.height;
  const s = scratch.getContext('2d');
  const stamp = (dx, dy, radius, rgba) => {
    s.setTransform(1, 0, 0, 1, 0, 0);
    s.globalAlpha = 1;
    s.globalCompositeOperation = 'source-over';
    s.clearRect(0, 0, scratch.width, scratch.height);
    s.drawImage(im, pad + dx, pad + dy);
    const n = 8;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      s.drawImage(im, pad + dx + Math.cos(a) * radius, pad + dy + Math.sin(a) * radius);
    }
    s.globalCompositeOperation = 'source-in';
    s.fillStyle = rgba;
    s.fillRect(0, 0, scratch.width, scratch.height);
    g.drawImage(scratch, 0, 0);
  };
  // soft, not a hard stroke: the old drop-shadow blur was only ~1.5% of the sprite
  stamp(0, darkDy, darkR, 'rgba(0,0,0,.16)');
  stamp(0, darkDy, Math.max(1, Math.round(darkR * 0.5)), 'rgba(0,0,0,.26)');
  stamp(0, 0, rad, 'rgba(255,250,240,.20)');
  stamp(0, 0, Math.max(1, Math.round(rad * 0.45)), 'rgba(255,250,240,.42)');
  g.globalCompositeOperation = 'source-over';
  g.drawImage(im, pad, pad);
  return { canvas: c, pad, srcW: W, srcH: H };
}
function rimKey(im) {
  if (im.src) return rimSkin + '|' + im.src;
  if (!im._gdRim) im._gdRim = 'c' + (++rimSeq);
  return rimSkin + '|' + im._gdRim;
}
function rimOf(im) {
  if (!ready(im)) return null;
  noteTamerSkin();
  const key = rimKey(im);
  const hit = rimCache.get(key);
  if (hit) return hit;
  const baked = bakeRim(im);
  if (!baked) return null;
  rimCache.delete(key);
  rimCache.set(key, baked);
  while (rimCache.size > RIM_MAX) rimCache.delete(rimCache.keys().next().value);
  return baked;
}
// draw a baked frame so the original bitmap stays on dx,dy,dw,dh (feet and baseline unchanged)
function drawRimmed(ctx, im, dx, dy, dw, dh) {
  const b = rimOf(im);
  if (!b) { ctx.drawImage(im, dx, dy, dw, dh); return; }
  const px = b.pad * (dw / b.srcW), py = b.pad * (dh / b.srcH);
  ctx.drawImage(b.canvas, dx - px, dy - py, dw + px * 2, dh + py * 2);
}
// hue-rotate + saturate, once per creature image. Same look as the old per-frame SHINY filter.
const shinyCache = new Map();
const SHINY_MAX = 24;
const SHINY_M = (() => {
  const a = 150 * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const hue = [
    0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
    0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.140, 0.072 - c * 0.072 - s * 0.283,
    0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072];
  const sv = 1.3, inv = 1 - sv, lr = 0.213 * inv, lg = 0.715 * inv, lb = 0.072 * inv;
  const sat = [lr + sv, lg, lb, lr, lg + sv, lb, lr, lg, lb + sv];
  const o = [];
  for (let r = 0; r < 3; r++) for (let col = 0; col < 3; col++)
    o.push(sat[r * 3] * hue[col] + sat[r * 3 + 1] * hue[3 + col] + sat[r * 3 + 2] * hue[6 + col]);
  return o;
})();
function shinyImg(im) {
  if (!ready(im)) return im;
  const ck = im.src || '';
  if (!ck) return im;
  const hit = shinyCache.get(ck);
  if (hit) return hit;
  const [W, H] = tamerSrcSize(im);
  if (!W || !H) return im;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(im, 0, 0);
  try {
    const d = x.getImageData(0, 0, W, H), p = d.data, m = SHINY_M;
    for (let i = 0; i < p.length; i += 4) {
      if (p[i + 3] < 1) continue;
      const r = p[i], g = p[i + 1], b = p[i + 2];
      p[i] = Math.max(0, Math.min(255, m[0] * r + m[1] * g + m[2] * b));
      p[i + 1] = Math.max(0, Math.min(255, m[3] * r + m[4] * g + m[5] * b));
      p[i + 2] = Math.max(0, Math.min(255, m[6] * r + m[7] * g + m[8] * b));
    }
    x.putImageData(d, 0, 0);
  } catch (e) { return im; }
  while (shinyCache.size >= SHINY_MAX) shinyCache.delete(shinyCache.keys().next().value);
  shinyCache.set(ck, c);
  return c;
}
// bake a couple of frames per turn so the first stride does not hitch, and so a new outfit replaces the old cache
function pumpTamerRims() {
  const job = ++rimJob, id = rimSkin;
  let i = 0, spins = 0;
  const step = () => {
    if (job !== rimJob || (meta().skin || 'classic') !== id) return;
    const t0 = performance.now();
    let baked = 0;
    for (; i < TAMER_FR.length && performance.now() - t0 < 10 && baked < 2; i++) {
      const k = TAMER_FR[i], key = tamerKey(k);
      if (key !== k && !(window.GD_ICON_MANIFEST && GD_ICON_MANIFEST[key])) continue;
      const im = imgs[key];
      if (!im || !ready(im)) continue;
      const before = rimCache.size;
      rimOf(skinImg(im));
      if (rimCache.size > before) baked++;
    }
    if (i < TAMER_FR.length) { requestAnimationFrame(step); return; }
    if (spins >= 8) return;
    const pending = TAMER_FR.some(k => {
      const key = tamerKey(k);
      if (key !== k && !(window.GD_ICON_MANIFEST && GD_ICON_MANIFEST[key])) return false;
      const im = imgs[key];
      return im && !ready(im);
    });
    if (pending) { spins++; i = 0; setTimeout(() => requestAnimationFrame(step), 80); }
  };
  requestAnimationFrame(step);
}

window.WILDS = { open, post, dexHtml, hud, skinThumb, skinOpen, secretHintRange, preloadTamer, discard, get state() { return W; }, get view() { return V; },
  doors: () => W && Object.keys(DOOR).map(d => [d, doorOf(room(), d), DOOR[d][0], DOOR[d][1]]).filter(x => x[1]),
  secretLevel: d => W && V && secretLevel(room(), d), tamerPose };
})();
