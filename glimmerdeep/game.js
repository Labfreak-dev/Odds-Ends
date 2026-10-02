// Glimmerdeep UI: title, auto-chess planning (shop, bench, board, drag and drop), live fight playback, rewards, camp.
(function () {
'use strict';
const G = window.GD, C = window.GC, R = window.GR;
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
    if (s && s.run && s.run.v === 2) run = s.run;
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

// ---- title / new run -------------------------------------------------------------------------
function renderTitle() {
  stopFight();
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
  if (v === 'cont') renderGame();
  else if (v === 'new') {
    if (run && await ask('Abandon run?', '<p style="text-align:center">Your current run will be lost.</p>', btn('y', 'Abandon', 'ghost') + btn('n', 'Keep it', 'green')) !== 'y') return;
    newRunFlow();
  }
  else if (v === 'camp') renderCamp();
  else if (v === 'dex') showDex();
  else if (v === 'how') showHow();
  else if (v === 'snd') { meta.sound = !meta.sound; save(); renderTitle(); }
});
document.addEventListener('click', e => { const g = e.target.closest('[data-go]'); if (g && !M.contains(g)) { SFX.click(); if (g.dataset.go === 'title') renderTitle(); } });

async function newRunFlow() {
  let depth = 0;
  if (meta.depthMax) {
    let d = '';
    for (let i = 0; i <= meta.depthMax; i++) d += btn('d' + i, i ? 'Depth ' + i : 'Normal', i ? 'ghost sm' : 'green sm');
    const v = await ask('Difficulty', '<p class="muted" style="text-align:center">Each Depth makes enemies 8% stronger and pays more shards.</p>', d);
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
  toast('Drag creatures onto your half of the board, then press FIGHT!');
}

// ---- the game screen -------------------------------------------------------------------------
const ROLE_N = { striker: 'Striker', caster: 'Caster', tank: 'Guardian', support: 'Support', boss: 'Boss' };
const KIND_N = { wild: 'Wild', elite: 'Elite', boss: 'BOSS' };
const unitsEl = $('#units'), benchEl = $('#bench'), boardEl = $('#board'), fxEl = $('#fx');
let phase = 'plan';
function starsTxt(n) { return '★'.repeat(n); }
const SIZE = [0, 70, 94, 120];
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
  const boss = kind === 'boss' ? ' · ' + G.BOSSES[bi.boss].name : '';
  return `<button class="iconbtn" data-top="menu">☰</button>
    <div class="grow"><div class="title">Round ${run.round}/${G.ROUNDS} · <span style="color:${kind === 'boss' ? '#ff7b8f' : kind === 'elite' ? '#ffd65a' : 'inherit'}">${KIND_N[kind]}${boss}</span></div><div class="small muted">${bi.name}${run.depth ? ' · Depth ' + run.depth : ''}${run.streak > 1 ? ' · win streak ' + run.streak : run.streak < -1 ? ' · loss streak ' + -run.streak : ''}</div></div>
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
    return `<div class="scard t${t} ${run.gold < t ? 'poor' : ''} ${owned.has(sp) ? 'have' : ''}" data-buy="${i}" title="${esc(G.SK[S.sk[1]].n + ': ' + G.SK[S.sk[1]].d)}">
      <div class="els">${elBadge(S.el)}</div><span class="cost">${t}</span><img class="m" src="${IMG('cr_' + sp + '1')}" alt=""><div class="nm">${S.names[0]}</div><div class="role">${ROLE_N[S.role]} · R${G.RANGE[sp]}</div></div>`;
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
  SFX.click();
  const v = b.dataset.v;
  if (v === 'reroll') { if (!R.reroll(run)) toast('Not enough gold.'); renderGame(); }
  else if (v === 'xp') { const lv = run.tlv; if (!R.buyXp(run)) toast('Not enough gold.'); else if (run.tlv > lv) { SFX.lvl(); toast(`Tamer level ${run.tlv}: room for ${run.tlv} creatures on the board.`); } renderGame(); }
  else if (v === 'lock') { run.locked = !run.locked; renderShop(); save(); }
  else if (v === 'fight') startFight();
});
// merges after anything that adds copies, with a mutation pick for each
async function afterChange() {
  const ups = R.merges(run);
  renderGame();
  for (const u of ups) {
    SFX.lvl();
    await evolveFlow(u);
    const more = R.merges(run);
    ups.push(...more);
    renderGame();
  }
}
// the evolution sequence: glow, flickering silhouettes, light rays, a white flash, the reveal
const EVO_EL = { ember: '#ff7a2a', tide: '#2fa6ff', bloom: '#4fd35a', volt: '#ffd21f', stone: '#e0a860', shade: '#8d7bff' };
async function evoCinematic(u) {
  const S = G.SP[u.sp], c = EVO_EL[S.el] || '#fff';
  const oldArt = IMG('cr_' + u.sp + (u.star - 1)), newArt = IMG(C.art(u));
  const before = C.stats(Object.assign({}, u, { star: u.star - 1 }), R.bonus(run)), after = C.stats(u, R.bonus(run));
  // make sure the new form is decoded before the reveal
  await new Promise(res => { const i = new Image(); i.onload = i.onerror = res; i.src = newArt; setTimeout(res, 1500); });
  const ov = document.createElement('div');
  ov.className = 'evo';
  ov.style.setProperty('--c', c);
  ov.innerHTML = `<div class="evo-bg"></div><div class="evo-rays"></div><div class="evo-halo"></div>
    <div class="evo-mon"><img class="evo-old${u.shiny ? ' shiny' : ''}" src="${oldArt}" alt=""><img class="evo-new${u.shiny ? ' shiny' : ''}" src="${newArt}" alt=""></div>
    <div class="evo-sparks"></div><div class="evo-ring"></div><div class="evo-flash"></div>
    <div class="evo-text"><div class="evo-top">What? ${S.names[u.star - 2]} is evolving!</div><div class="evo-name"></div><div class="evo-stats"></div><div class="evo-tap">tap to continue</div></div>`;
  $('#app').appendChild(ov);
  let skip = false;
  ov.addEventListener('pointerdown', () => { skip = true; });
  const wait = ms => skip ? Promise.resolve() : sleep(ms);
  const old = ov.querySelector('.evo-old'), nw = ov.querySelector('.evo-new'), mon = ov.querySelector('.evo-mon');
  requestAnimationFrame(() => ov.classList.add('on'));
  SFX.ult();
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
    tone(300 + i * 60, 0.12, 'triangle', 0.05);
    await wait(gap); gap = Math.max(70, gap * 0.8);
  }
  // flash and reveal
  ov.classList.add('flash');
  tone(880, 0.6, 'sawtooth', 0.06, 0.5); tone(1320, 0.5, 'triangle', 0.05);
  await wait(260);
  old.style.opacity = 0; nw.style.opacity = 1; mon.style.transform = '';
  ov.classList.remove('charge'); ov.classList.add('reveal');
  ov.querySelector('.evo-name').innerHTML = `${S.names[u.star - 2]} evolved into <b>${S.names[u.star - 1]}</b>! <span class="evo-stars">${starsTxt(u.star)}</span>`;
  ov.querySelector('.evo-stats').innerHTML = [['HP', before.hp, after.hp], ['ATK', Math.round(before.atk), Math.round(after.atk)], ['DEF', Math.round(before.def), Math.round(after.def)]]
    .map(([k, a, b]) => `<span>${k} ${a} → <b>${b}</b></span>`).join('') + (u.star === 2 ? `<span class="evo-new-skill">New ultimate: <b>${G.SK[S.sk[3]].n}</b></span>` : '');
  SFX.lvl();
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
  const ult = u.star === 2 ? `<p style="text-align:center">New power available: <b>${G.SK[S.sk[3]].n}</b> — ${G.SK[S.sk[3]].d}</p>` : '<p style="text-align:center">Its final form. Its stats nearly double again.</p>';
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
  if (d.ghost) d.ghost.remove();
  $('#sellZone').classList.remove('on', 'hot');
  document.querySelectorAll('.hot').forEach(x => x.classList.remove('hot'));
  if (!d.moved) { unitDetail(d.uid); return; }
  const t = dropTarget(e.clientX, e.clientY);
  if (!t) return renderGame();
  if (t.sell) { const iu = run.units.find(z => z.uid === d.uid); const v = R.sell(run, d.uid); SFX.coin(); toast(`Sold ${C.name(iu)} for ${v} gold.`); }
  else if (t.slot != null) R.placeBench(run, d.uid, t.slot);
  else if (!R.placeBoard(run, d.uid, t.x, t.y)) toast(`Board full: Tamer level ${run.tlv} allows ${R.cap(run)} creatures. Buy XP to raise it.`);
  else SFX.click();
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
async function unitDetail(uid) {
  for (;;) {
    const u = run.units.find(z => z.uid === uid); if (!u) return;
    const S = G.SP[u.sp];
    const body = `<div class="detail"><div class="big el-${S.el}">${monImg(u)}</div><div>
      <div class="row wrap">${elBadge(S.el)}${u.el2 ? elBadge(u.el2) + '<span class="small muted">Dual</span>' : ''}<span class="tag">${ROLE_N[S.role]}</span><span class="tag" style="color:#ffd65a">${starsTxt(u.star)}</span><span class="tag">Tier ${G.TIER[u.sp]}</span>${u.shiny ? '<span class="tag" style="background:#6a5bff">Shiny +10%</span>' : ''}</div>
      ${statBlock(u)}
      <div class="small muted" style="margin-top:4px">${u.star < 3 ? `${R.copiesNeeded(run, u.star)} copies of ★${u.star} merge into ${S.names[u.star]} ★${u.star + 1}.` : 'Final form.'}</div>
      ${u.muts.length ? `<div class="small" style="margin-top:4px">Mutations: ${u.muts.map(m => `<b>${G.MUTS[m].n}</b> (${G.MUTS[m].d})`).join(', ')}</div>` : ''}
      <div class="li" style="margin-top:8px">${u.charm ? `<img class="ic" src="${IMG('ch_' + u.charm)}" alt=""><div class="grow"><div class="t">${G.CHARMS[u.charm].n}</div><div class="small">${G.CHARMS[u.charm].d}</div></div>` : '<div class="grow muted">No charm held</div>'}<button class="btn sm ghost" data-v="charm">Change</button></div>
      </div></div><h3 style="margin:10px 0 4px">Power <span class="small muted">(tap one: it casts automatically when its mana fills)</span></h3>${skillRows(u, true)}`;
    const acts = (u.at === 'b' ? btn('bench', 'To bench', 'ghost sm') : btn('board', 'To board', 'ghost sm')) + btn('sell', `Sell ${R.sellValue(u)}g`, 'ghost sm') + btn('close', 'Done', 'green sm');
    const v = await modal(`${starsTxt(u.star)} ${esc(C.name(u))}`, body, acts);
    closeModal();
    if (v === 'close') break;
    if (v.startsWith('sk:')) { u.skill = v.slice(3); save(); continue; }
    if (v === 'sell') { const g = R.sell(run, u.uid); SFX.coin(); toast(`Sold for ${g} gold.`); break; }
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
    <div class="row wrap">${elBadge(C.elOf(inst))}<span class="tag">${ROLE_N[C.roleOf(inst)]}</span></div>${statBlock(inst)}</div></div><h3 style="margin:10px 0 4px">Skills</h3>${skillRows(inst, false)}`, btn('ok', 'Close', 'green sm'));
}

// ---- the fight ---------------------------------------------------------------------------------
let FS = null;
function stopFight() { if (FS && FS.raf) cancelAnimationFrame(FS.raf); FS = null; }
function uEl(id) { return FS && FS.els[id]; }
function startFight() {
  if (phase !== 'plan') return;
  if (!R.onBoard(run).length) { toast('Put at least one creature on the board first.'); return; }
  if (R.onBoard(run).length < R.cap(run) && R.onBench(run).length) toast(`You have room for ${R.cap(run) - R.onBoard(run).length} more on the board.`);
  phase = 'fight';
  const seed = (run.seed * 31 + run.round * 977 + Date.now() % 100000) >>> 0;
  const st = C.create(R.fightOpts(run, seed));
  FS = { st, speed: meta.speed || 1, acc: 0, last: performance.now(), els: {}, ending: false, popN: 0 };
  $('#game').classList.add('fighting');
  unitsEl.innerHTML = st.units.map(u => unitHtml('u' + u.id, { x: u.x, y: u.y, star: u.star, side: u.side, boss: u.boss, elite: u.elite, art: u.art, shiny: u.shiny, hp: u.hp, maxHp: u.maxHp, mana: u.mana })).join('');
  for (const u of st.units) cacheEl(u);
  renderFightBar();
  $('#gTraits').innerHTML = traitsHtml(R.onBoard(run));
  boardEl.style.setProperty('--mv', (0.42 / FS.speed) + 's');
  const kind = R.roundKind(run.round);
  if (kind === 'boss') banner(st.units.find(u => u.boss).name, G.BOSSES[st.units.find(u => u.boss).boss].el);
  SFX.ult();
  handle(st.ev.splice(0));
  FS.raf = requestAnimationFrame(loop);
}
function cacheEl(u) {
  const el = unitsEl.querySelector(`[data-k="u${u.id}"]`); if (!el) return;
  const bars = el.querySelectorAll('.bar i');
  FS.els[u.id] = { el, hp: bars[0], sh: bars[1], mp: el.querySelector('.bar.mp i'), sts: el.querySelector('.sts'), rig: el.querySelector('.rig'), lastSt: '' };
}
function renderFightBar() {
  $('#fightBar').innerHTML = `<span class="muted fred">Fighting…</span>${btn('speed', (FS ? FS.speed : 1) + '× speed', 'ghost sm')}${btn('skip', 'Skip', 'ghost sm')}`;
}
$('#fightBar').addEventListener('click', e => {
  const b = e.target.closest('[data-v]'); if (!b || !FS) return;
  SFX.click();
  if (b.dataset.v === 'speed') { FS.speed = FS.speed >= 4 ? 1 : FS.speed * 2; meta.speed = FS.speed; boardEl.style.setProperty('--mv', (0.42 / FS.speed) + 's'); renderFightBar(); }
  else if (b.dataset.v === 'skip') { FS.skip = true; }
});
function loop(ts) {
  if (!FS) return;
  const st = FS.st;
  const dt = Math.min(0.1, (ts - FS.last) / 1000) * FS.speed;
  FS.last = ts;
  if (FS.skip && !st.over) { C.resolve(st); st.ev.length = 0; resyncAll(); }
  FS.acc += dt;
  while (FS.acc >= C.DT && !st.over) { FS.acc -= C.DT; const ev = C.tick(st); st.ev.length = 0; handle(ev); }
  for (const u of st.units) syncBars(u);
  if (st.over && !FS.ending) { FS.ending = true; setTimeout(endFight, FS.skip ? 200 : 900 / Math.min(2, FS.speed)); }
  FS.raf = requestAnimationFrame(loop);
}
function resyncAll() {
  for (const u of FS.st.units) {
    let E = uEl(u.id);
    if (!E) { unitsEl.insertAdjacentHTML('beforeend', unitHtml('u' + u.id, { x: u.x, y: u.y, star: u.star, side: u.side, boss: u.boss, art: u.art })); cacheEl(u); E = uEl(u.id); }
    E.el.style.left = u.x * 12.5 + '%'; E.el.style.top = u.y * 20 + '%';
    E.el.classList.toggle('dead', !u.alive);
  }
}
const ST_LABEL = { burn: 'BRN', poison: 'PSN', soak: 'WET', stun: 'STUN', root: 'ROOT', curse: 'CRS', blind: 'BLD', atkUp: 'ATK', defUp: 'DEF', spdUp: 'SPD', critUp: 'CRT', dodge: 'EVA', regen: 'RGN', taunt: 'TNT' };
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
function orb(a, b, el, ms) {
  const A = cpos(a), Bp = cpos(b);
  const o = document.createElement('div');
  o.className = 'orb el-' + el;
  fxEl.appendChild(o);
  o.animate([{ left: A.x + '%', top: A.y + '%' }, { left: Bp.x + '%', top: Bp.y + '%' }], { duration: ms, easing: 'ease-in', fill: 'forwards' }).finished.then(() => { o.remove(); burst(b, el); }, () => o.remove());
}
function burst(u, el, big) {
  const c = cpos(u);
  const b = document.createElement('div');
  b.className = 'burst el-' + el;
  b.style.left = c.x + '%'; b.style.top = c.y + '%';
  if (big) b.style.width = '30%';
  fxEl.appendChild(b); setTimeout(() => b.remove(), 500);
}
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
const ELC = { ember: '#ff7a2a', tide: '#2fa6ff', bloom: '#4fd35a', volt: '#ffd21f', stone: '#e0a860', shade: '#9d8bff' };
function rig(id, frames, ms, fill) {
  const E = uEl(id); if (!E) return;
  E.rig.animate(frames, { duration: ms / FS.speed, easing: 'ease-in-out', fill: fill || 'none' });
}
function animStrike(a, t, el) {
  const dx = Math.sign(t.x - a.x), dy = Math.sign(t.y - a.y);
  rig(a.id, [{ transform: 'none' }, { transform: `translate(${-8 * dx}%, ${-4 * dy}%) scale(1.08,.88)`, offset: 0.3 },
    { transform: `translate(${34 * dx}%, ${22 * dy - 8}%) rotate(${12 * dx}deg) scale(1.12,.92)`, offset: 0.55 }, { transform: 'none' }], 380);
}
function animShoot(a, t, el) {
  const dx = Math.sign(t.x - a.x) || 1, glow = `drop-shadow(0 0 10px ${ELC[el] || '#fff'})`;
  rig(a.id, [{ transform: 'none', filter: 'none' }, { transform: `translateX(${-8 * dx}%) rotate(${-8 * dx}deg) scale(.96,1.06)`, filter: glow, offset: 0.4 },
    { transform: `translateX(${8 * dx}%) scale(1.08,.94)`, filter: glow, offset: 0.6 }, { transform: 'none', filter: 'none' }], 360);
}
function animCast(u, el, ult) {
  const glow = `drop-shadow(0 0 ${ult ? 18 : 12}px ${ELC[el] || '#fff'}) drop-shadow(0 0 4px #fff)`;
  rig(u.id, [{ transform: 'none', filter: 'none' }, { transform: 'translateY(4%) scale(1.12,.84)', offset: 0.2 },
    { transform: `translateY(-22%) scale(${ult ? 1.3 : 1.12})`, filter: glow, offset: 0.55 }, { transform: 'translateY(2%) scale(1.08,.92)', filter: glow, offset: 0.8 },
    { transform: 'none', filter: 'none' }], ult ? 700 : 520);
}
function animHit(t, a, crit, dot) {
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
  for (const e of ev) {
    if (e.k === 'move') { const u = F(e.u), E = uEl(e.u); if (E) { face(u, e.x); E.el.style.left = e.x * 12.5 + '%'; E.el.style.top = e.y * 20 + '%'; } }
    else if (e.k === 'blink') { const E = uEl(e.u); if (E) { E.el.style.transition = 'none'; E.el.style.left = e.x * 12.5 + '%'; E.el.style.top = e.y * 20 + '%'; void E.el.offsetWidth; E.el.style.transition = ''; burst(F(e.u), 'shade', true); } }
    else if (e.k === 'atk') {
      const a = F(e.a), t = F(e.t); if (!a || !t) continue;
      face(a, t.x);
      if (e.rng) { animShoot(a, t, e.el); orb(a, t, e.el, 220 / FS.speed); } else { animStrike(a, t, e.el); }
    }
    else if (e.k === 'cast') {
      const a = F(e.a); if (!a) continue;
      animCast(a, e.el, e.ult);
      if (e.ult) { boardEl.classList.add('ult'); banner(e.n, e.el); SFX.ult(); setTimeout(() => boardEl.classList.remove('ult'), 650 / FS.speed); }
      else { popAt(a, e.n, 'cast'); SFX.react(); }
      for (const id of e.tg) { const t = F(id); if (t && t.side !== a.side) orb(a, t, e.el, 260 / FS.speed); else if (t) burst(t, e.el); }
      if (e.aoe && e.tg.length > 1) { const t = F(e.tg[0]); if (t && t.side !== a.side) setTimeout(() => FS && burst(t, e.el, true), 260 / FS.speed); }
    }
    else if (e.k === 'aim') { const a = F(e.a), t = F(e.t); if (a && t) { animShoot(a, t, e.el); orb(a, t, e.el, 200 / FS.speed); } }
    else if (e.k === 'zap') { const a = F(e.a), t = F(e.t); if (a && t) orb(a, t, 'volt', 150 / FS.speed); }
    else if (e.k === 'dmg') {
      const t = F(e.t); if (!t) continue;
      const a = e.a != null ? F(e.a) : null;
      animHit(t, a, e.crit, e.dot);
      if (!e.basic || e.crit || e.v >= t.maxHp * 0.08) popAt(t, (e.crit ? e.v + '!' : e.v), e.crit ? 'crit' : e.dot ? 'dot' : e.basic ? 'small' : '');
      if (!e.dot) { if (e.crit) SFX.crit(); else if (!e.basic || Math.random() < 0.35) SFX.hit(); }
    }
    else if (e.k === 'miss') { popAt(F(e.t), e.dodge ? 'Dodge' : 'Miss', 'miss'); }
    else if (e.k === 'heal') { if (!e.quiet && e.v > 0) { popAt(F(e.t), '+' + e.v, 'heal'); SFX.heal(); } }
    else if (e.k === 'shield') { popAt(F(e.t), '+' + e.v, 'shield'); }
    else if (e.k === 'react') { popAt(F(e.t), e.name, 'react'); SFX.react(); }
    else if (e.k === 'ko') {
      const u = F(e.t), E = uEl(e.t); if (!E) continue;
      SFX.ko();
      const d = u.side ? 1 : -1;
      E.rig.animate([{ transform: 'none', filter: 'none' }, { transform: `translateX(${10 * d}%) translateY(12%) rotate(${75 * d}deg) scale(.9)`, filter: 'grayscale(1) brightness(.6)' }], { duration: 450, fill: 'forwards' });
      setTimeout(() => { if (!u.alive) E.el.classList.add('dead'); }, 380);
    }
    else if (e.k === 'revive') { const E = uEl(e.t); if (E) { E.el.classList.remove('dead'); E.rig.getAnimations().forEach(a => a.cancel()); popAt(F(e.t), e.name, 'react'); } }
    else if (e.k === 'summon') {
      const u = F(e.u); if (!u) continue;
      unitsEl.insertAdjacentHTML('beforeend', unitHtml('u' + u.id, { x: u.x, y: u.y, star: u.star, side: u.side, art: u.art, hp: u.hp, maxHp: u.maxHp }));
      cacheEl(u); burst(u, u.el, true); popAt(u, 'Summoned!', 'small');
    }
    else if (e.k === 'flux') { const E = uEl(e.t); if (E) popAt(F(e.t), '→ ' + G.EL[e.el].name, 'small'); }
    else if (e.k === 'text') toast(e.v);
  }
}
async function endFight() {
  if (!FS) return;
  const st = FS.st;
  const kind = R.roundKind(run.round), round = run.round, bossName = kind === 'boss' ? G.BOSSES[G.BIOMES[run.biome].boss].name : '';
  const res = R.endRound(run, st);
  stopFight();
  phase = 'busy';
  save();
  if (res.win) SFX.lvl(); else SFX.ko();
  const lines = [];
  if (res.loss) lines.push(`<p style="text-align:center;color:var(--bad);font-size:18px">−${res.loss} HP <span class="small muted">(${C.alive(st, 1).length} foes left standing)</span></p>`);
  else if (!res.win) lines.push('<p style="text-align:center">The smoke hid your retreat. No HP lost.</p>');
  if (run.over === 2) return gameOver(false);
  if (run.over === 1) return gameOver(true);
  lines.push(`<div class="row center wrap" style="gap:8px"><span class="pill"><img src="${IMG('ui_gold')}" alt="">+${res.gold} <span class="small muted">(5 base${res.interest ? ' + ' + res.interest + ' interest' : ''}${res.streak ? ' + streak' : ''}${res.win ? ' + 1 win' : ''})</span></span><span class="pill">+${res.xp} Tamer XP${res.lvUp ? ' · Level ' + run.tlv + '!' : ''}</span></div>`);
  for (const d of res.drops) lines.push(`<div class="li" style="margin-top:8px"><img class="ic" src="${IMG((d.k === 'charm' ? 'ch_' : 'it_') + d.id)}" alt=""><div class="grow"><div class="t">Found: ${(d.k === 'charm' ? G.CHARMS : G.ITEMS)[d.id].n}</div><div class="small">${(d.k === 'charm' ? G.CHARMS : G.ITEMS)[d.id].d}</div></div></div>`);
  if (res.retry) lines.push('<p style="text-align:center;color:var(--gold)">The Glimmerwyrm still stands. Strengthen your team and try again!</p>');
  await ask(res.win ? (kind === 'boss' ? bossName + ' defeated!' : 'Victory!') : 'Defeat', lines.join(''), btn('ok', 'Continue', 'green'));
  // rewards
  for (const p of run.pending || []) {
    if (p.k === 'relic' && p.opts.length) await relicPick(p.opts, kind === 'boss' ? 'Boss treasure' : 'Elite treasure');
    else if (p.k === 'perk' && p.opts.length) {
      const k = await ask('Tamer perk', `<p class="muted" style="text-align:center">Pick a permanent perk for this run.</p><div class="cards">${p.opts.map(k => `<div class="card" data-v="${k}"><h3>${G.PERKS[k].n}</h3><p>${G.PERKS[k].d}</p></div>`).join('')}</div>`);
      R.takePerk(run, k);
    } else if (p.k === 'biome') {
      const b = p.opts.length === 1 ? p.opts[0] : await ask('Choose the next stage', `<div class="cards">${p.opts.map(k => { const bi = G.BIOMES[k]; return `<div class="card" data-v="${k}"><div class="art" style="height:110px"><img src="${IMG(bi.bg)}" alt="" style="border-radius:12px;max-height:110px"></div><h3>${bi.name}</h3><p><b style="color:var(--gold)">${bi.hazName}</b>: ${bi.hazDesc}</p><p>Counter: ${bi.counter}</p><p>Foes: ${Array.from(new Set(bi.els)).map(e => G.EL[e].name).join(', ')} · Boss: ${G.BOSSES[bi.boss].name}</p></div>`; }).join('')}</div>`);
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
  return `<div class="li click ${r.leg ? 'leg' : ''}" data-v="${v == null ? id : v}"><img class="ic" src="${IMG('rl_' + id)}" alt=""><div class="grow"><div class="t">${r.n}</div><div class="small">${r.d}</div><div class="row wrap" style="gap:4px;margin-top:3px">${r.tags.map(t => `<span class="tag">${t}</span>`).join('')}</div></div></div>`;
}
async function relicPick(list, title) {
  const c = C.relicTagCounts(run.relics);
  const hint = list.map(id => G.RELICS[id].tags.filter(t => c[t] === 2 && G.SETS[t]).map(t => `Taking ${G.RELICS[id].n} completes the <b>${G.SETS[t].n}</b> set: ${G.SETS[t].d}`)).flat();
  const fuse = list.map(id => G.FUSIONS.filter(f => (f[0] === id && run.relics.includes(f[1])) || (f[1] === id && run.relics.includes(f[0]))).map(f => `${G.RELICS[id].n} can fuse into <b>${G.RELICS[f[2]].n}</b>.`)).flat();
  const v = await ask(title || 'Choose a relic', `<div class="list">${list.map(id => relicLi(id)).join('')}</div>${hint.concat(fuse).map(h => `<p class="small" style="color:var(--gold);margin:8px 4px 0">${h}</p>`).join('')}`, btn('skip', 'Skip', 'ghost sm'));
  if (v !== 'skip' && G.RELICS[v]) { R.addRelic(run, v); SFX.coin(); toast('Got ' + G.RELICS[v].n); }
}
async function forgeFlow() {
  const fs = R.fusionsAvailable(run);
  if (!fs.length) return false;
  const v = await ask('Forge a legendary?', `<p class="muted" style="text-align:center">Two of your relics can become one legendary.</p><div class="list">${fs.map((f, i) => `<div class="li click leg" data-v="${i}"><img class="ic" src="${IMG('rl_' + f[2])}" alt=""><div class="grow"><div class="t">${G.RELICS[f[2]].n}</div><div class="small">${G.RELICS[f[2]].d}</div><div class="small muted">Uses ${G.RELICS[f[0]].n} + ${G.RELICS[f[1]].n}</div></div></div>`).join('')}</div>`, btn('x', 'Not now', 'ghost sm'));
  if (v === 'x') return false;
  R.fuse(run, fs[+v]); SFX.ult(); toast('Forged ' + G.RELICS[fs[+v][2]].n + '!');
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
async function menuScreen() {
  const v = await ask('Menu', '', btn('how', 'How to Play', 'ghost') + btn('snd', meta.sound ? 'Sound: On' : 'Sound: Off', 'ghost') + btn('title', 'Save & Quit to Title', 'blue') + btn('give', 'Give up run', 'ghost') + btn('x', 'Back', 'green'));
  if (v === 'how') return showHow();
  if (v === 'snd') { meta.sound = !meta.sound; save(); return menuScreen(); }
  if (v === 'title') { save(); renderTitle(); }
  if (v === 'give' && await ask('Give up?', '<p style="text-align:center">You keep the shards you earned so far.</p>', btn('y', 'Give up', 'ghost') + btn('n', 'Keep going', 'green')) === 'y') gameOver(false);
}

// ---- end of run, camp, dex, help ----------------------------------------------------------------
async function gameOver(won) {
  stopFight();
  const shards = R.shardsFor(run, won);
  meta.shards += shards;
  for (const k in run.seen) meta.dex[k] = Math.max(meta.dex[k] || 0, run.seen[k]);
  if (won) { meta.wins++; meta.depthMax = Math.max(meta.depthMax, Math.min(10, run.depth + 1)); }
  const team = R.onBoard(run).map(u => `<div style="text-align:center"><img style="height:80px" class="${u.shiny ? 'shiny' : ''}" src="${IMG(C.art(u))}" alt=""><div class="small" style="color:#ffd65a">${starsTxt(u.star)}</div></div>`).join('');
  const r = run; r.over = r.over || 2; run = null; save();
  await ask(won ? 'The Glimmer Core is yours!' : 'Your journey ends...', `<div class="row center wrap" style="gap:6px">${team}</div>
    <p style="text-align:center">Reached round ${r.round} · ${r.stats.won} wins · ${r.stats.lost} losses · ${r.stats.merges} evolutions</p>
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
  if (c) { SFX.click(); if (c.dataset.camp === 'dex') showDex(); else newRunFlow(); }
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
  <p><b>The run</b> is 24 rounds across 4 stages. Rounds 3 of each stage are elite fights that pay a relic; every 6th round is a boss. After a boss you choose the next stage's biome. You have 100 HP: losing a round costs HP (more for every foe left standing). Beat the Glimmerwyrm in round 24 to win.</p>
  <p><b>Planning.</b> Buy creatures from the shop (cost = tier: 1-3 gold), drag them from the bench onto your half of the board, and drag them back or onto the shop to sell. Your <b>Tamer level</b> is how many creatures fit on the board: you gain 2 XP a round, and Buy XP gives 4 for 4 gold. Higher levels also roll rarer creatures. <b>Lock</b> keeps a shop for next round.</p>
  <p><b>Merging.</b> Three copies of the same creature at the same star merge and evolve it: ★2 is its second form, ★3 its final form. Each merge offers a <b>mutation</b>.</p>
  <p><b>Gold.</b> 5 a round, +1 for a win, +1 interest per 10 gold you hold (up to 5), and a bonus for win or loss streaks.</p>
  <p><b>Fights</b> play themselves. Creatures walk to the nearest foe, attack at their own range and speed, and fill their blue <b>mana</b> bar by attacking and getting hit. When it is full they cast their <b>power</b>: tap a creature to choose which of its skills that is. ★2 creatures unlock an ultimate. The next enemy board is shown while you plan, so place your team to counter it: melee in front, ranged behind, protect your casters.</p>
  <p><b>Elements.</b> Ember > Bloom, Shade · Tide > Ember, Stone · Bloom > Tide, Stone · Volt > Tide, Shade · Stone > Ember, Volt · Shade > Volt, Bloom. Super-effective hits deal 1.5×.</p>
  <p><b>Reactions</b>: Volt on Soaked = <b>Electrocute</b>. Tide on Burning = <b>Steam</b>. Ember on Poisoned = <b>Blight Burst</b> (the poison explodes onto every foe). Stone on Rooted = <b>Shatter</b>. Shade on a Cursed foe under 25% = <b>Doom</b>. Ember on Soaked = Fizzle (weak!).</p>
  <p><b>Synergies</b> (top of the board): 2 different species of one element, or 2-4 of one role (Striker, Caster, Guardian, Support), unlock team bonuses. Tap a chip to read it.</p>
  <p><b>Relics</b> power up your whole team; three with a shared tag light up a <b>set bonus</b>, and certain pairs <b>fuse</b> into legendaries (Bag → Forge). <b>Charms</b> drop from wild rounds: give one to a creature. Each biome has a <b>hazard</b>; some relics counter it.</p>
  <p><b>Between runs</b>, Glimmer Shards buy permanent upgrades at camp. Win to unlock harder Depths.</p></div>`, btn('ok', 'Got it', 'green'));
}

// ---- boot --------------------------------------------------------------------------------------
load();
renderTitle();
['bg_verdant', 'ui_gold', 'node_treasure'].forEach(k => { const i = new Image(); i.src = IMG(k); });
window.GLIM = { get run() { return run; }, get meta() { return meta; }, get FS() { return FS; }, renderGame };
})();
