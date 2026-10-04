// Post-fight Battle report. Loaded after chess.js. Tracking is off unless this
// file sets window.FightStats before GC.create(); the combat sim never calls it.
(function (root) {
'use strict';

const ELC = { ember: '#ff7a2a', tide: '#2fa6ff', bloom: '#4fd35a', volt: '#ffd21f', stone: '#e0a860', shade: '#9d8bff', frost: '#8fe3ff', gale: '#7dffc2', metal: '#d8e2ee', mystic: '#d9a6ff' };
const CC_KEYS = { stun: 1, root: 1, chill: 1, blind: 1, hex: 1, curse: 1, shred: 1 };
const CC_LAB = { stun: 'STUN', root: 'ROOT', chill: 'CHILL', blind: 'BLIND', hex: 'HEX', curse: 'CURSE', shred: 'SHRED', soak: 'SOAKED' };
const DOT_LAB = { burn: 'burn', poison: 'poison', quake: 'quake', heat: 'heat', star: 'star', blight: 'blight' };
const NUMS = ['dealt', 'dealtBasic', 'dealtSkill', 'overkill', 'taken', 'absorbed', 'thornsDealt', 'dodged', 'heal', 'healSelf', 'healOver', 'shield', 'ccSec', 'ccN', 'kills', 'deaths', 'revived', 'casts', 'ults', 'hpEnd', 'maxHp'];

let seq = 0, bound = false;
const reports = new Map();
const anims = new Map();
const meta = new WeakMap();

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmt(n) {
  n = +n;
  if (!isFinite(n) || n < 0) n = 0;
  if (Math.abs(n - Math.round(n)) < 0.05) return String(Math.round(n));
  return (Math.round(n * 10) / 10).toFixed(1);
}
function artSrc(art) {
  return 'img/' + String(art || '').replace(/[^a-z0-9_\-]/gi, '') + '.webp';
}
function elName(el) {
  const E = root.GD && root.GD.EL && root.GD.EL[el];
  return E && E.name ? E.name : (el || '');
}
function elImg(el) {
  const k = String(el || '').replace(/[^a-z]/g, '');
  if (!k) return '';
  return `<img class="badge" src="img/el_${k}.webp" alt="${esc(elName(el))}">`;
}
function stars(r) {
  if (r.summ) return '';
  if (r.boss) return '<span class="fs-star" aria-label="boss">♛</span>';
  const n = Math.max(0, Math.min(6, r.star | 0));
  return n ? `<span class="fs-star" aria-label="${n} star">${'★'.repeat(n)}</span>` : '';
}
function dotSum(r) {
  let s = 0;
  for (const k in r.dot) s += r.dot[k] || 0;
  return s;
}
function blank() {
  return {
    dealt: 0, dealtBasic: 0, dealtSkill: 0, overkill: 0, taken: 0, absorbed: 0, thornsDealt: 0, dodged: 0,
    heal: 0, healSelf: 0, healOver: 0, shield: 0,
    cc: {}, ccSec: 0, ccN: 0, dot: {}, dotN: {},
    kills: 0, deaths: 0, revived: 0, casts: 0, ults: 0, maxHp: 0, hpEnd: 0, aliveEnd: true,
  };
}
function row(st, u) {
  const fs = st.fs;
  let r = fs[u.id];
  if (r) return r;
  r = fs[u.id] = blank();
  r.id = u.id;
  r.side = u.side;
  r.name = u.name;
  r.art = u.art;
  r.el = u.el;
  r.star = u.star;
  r.role = u.role;
  r.boss = !!u.boss;
  r.summ = !!u.summoned;
  r.shiny = !!u.shiny;
  r.uid = u.inst && u.inst.uid;
  r.maxHp = u.maxHp;
  r.hpEnd = u.hp;
  r.aliveEnd = !!u.alive;
  const m = meta.get(fs);
  if (m) m.ix[u.id] = u;
  return r;
}
function init(st) {
  const fs = Object.create(null);
  meta.set(fs, { haz: [0, 0], unkill: [0, 0], ix: Object.create(null) });
  st.fs = fs;
  for (let i = 0; i < st.units.length; i++) row(st, st.units[i]);
  return fs;
}
function by(st, id) {
  const m = meta.get(st.fs);
  return m && m.ix[id] || null;
}
function basicHit(st, a, d, eff, over, hpLoss, absorbed) {
  const fs = st.fs, vr = fs[d.id], ar = fs[a.id];
  vr.taken += hpLoss;
  vr.absorbed += absorbed;
  ar.dealt += eff;
  ar.dealtBasic += eff;
  if (over > 0) ar.overkill += over;
}
function dmg(st, a, d, eff, over, absorbed, hpLoss, basic, dot, thorn) {
  const fs = st.fs;
  const vr = fs[d.id] || row(st, d);
  vr.taken += hpLoss;
  vr.absorbed += absorbed;
  if (!a) { meta.get(fs).haz[d.side] += hpLoss + absorbed; return; }
  const ar = fs[a.id] || row(st, a);
  ar.dealt += eff;
  if (over > 0) ar.overkill += over;
  if (dot) ar.dot[dot] = (ar.dot[dot] || 0) + eff;
  else if (basic) ar.dealtBasic += eff;
  else ar.dealtSkill += eff;
  if (thorn) ar.thornsDealt += eff;
}
function heal(st, src, t, got, over) {
  if (!src) return;
  const r = st.fs[src.id] || row(st, src);
  r.heal += got;
  if (src === t) r.healSelf += got;
  if (over > 0) r.healOver += over;
}
function shield(st, src, t, v) {
  if (!src || !v) return;
  const r = st.fs[src.id] || row(st, src);
  if (r) r.shield += v;
}
function status(st, src, t, key, dur) {
  if (!src) return;
  const r = st.fs[src.id] || row(st, src);
  if (!r) return;
  const secs = (typeof dur === 'number' && isFinite(dur) && dur < 1e8 && dur > 0) ? dur : 0;
  if (CC_KEYS[key]) {
    const c = r.cc[key] || (r.cc[key] = { n: 0, sec: 0 });
    c.n++; c.sec += secs; r.ccN++; r.ccSec += secs;
  } else if (key === 'burn' || key === 'poison') {
    r.dotN[key] = (r.dotN[key] || 0) + 1;
  } else if (key === 'soak') {
    const c = r.cc.soak || (r.cc.soak = { n: 0, sec: 0 });
    c.n++;
  }
}
function ko(st, a, d) {
  const vr = row(st, d);
  if (!vr) return;
  vr.deaths++;
  vr.aliveEnd = false;
  if (a && a.side !== d.side) {
    const ar = row(st, a);
    if (ar) ar.kills++;
  } else {
    const m = meta.get(st.fs);
    if (m) m.unkill[d.side]++;
  }
}
function revive(st, d) {
  const vr = row(st, d);
  if (!vr) return;
  vr.revived++;
  vr.aliveEnd = true;
}
function dodge(st, d) {
  const r = row(st, d);
  if (r) r.dodged++;
}
function cast(st, u, ult) {
  const r = row(st, u);
  if (!r) return;
  r.casts++;
  if (ult) r.ults++;
}

function copyRow(r) {
  const o = blank();
  for (const k in r) if (k !== 'cc' && k !== 'dot' && k !== 'dotN') o[k] = r[k];
  o.cc = {};
  for (const k in r.cc) o.cc[k] = { n: r.cc[k].n, sec: r.cc[k].sec };
  o.dot = Object.assign({}, r.dot);
  o.dotN = Object.assign({}, r.dotN);
  return o;
}
function addInto(g, r) {
  g.n = (g.n || 0) + 1;
  for (const k of NUMS) g[k] += r[k] || 0;
  for (const k in r.cc) {
    const c = g.cc[k] || (g.cc[k] = { n: 0, sec: 0 });
    c.n += r.cc[k].n || 0; c.sec += r.cc[k].sec || 0;
  }
  for (const k in r.dot) g.dot[k] = (g.dot[k] || 0) + r.dot[k];
  for (const k in r.dotN) g.dotN[k] = (g.dotN[k] || 0) + r.dotN[k];
  if (r.aliveEnd) { g.aliveEnd = true; g.up = (g.up || 0) + 1; }
  if ((r.dealt || 0) >= (g._top || 0)) { g._top = r.dealt || 0; g.art = r.art; g.el = r.el; g.shiny = !!r.shiny; }
}
function best(rows, score, prefer) {
  let b = null, bv = 0;
  for (const r of rows) {
    const v = score(r);
    if (!(v > 0)) continue;
    if (!b || v > bv || (v === bv && prefer && prefer(r) && !prefer(b))) { b = r; bv = v; }
  }
  return b;
}
function snapshot(st) {
  const empty = { win: false, dur: 0, rows: [], mvp: {}, crown: null, haz: [0, 0], unkill: [0, 0] };
  if (!st || !st.fs) return empty;
  for (const u of st.units) {
    const r = row(st, u);
    if (!r) continue;
    r.hpEnd = u.hp; r.aliveEnd = !!u.alive; r.maxHp = u.maxHp;
    r.el = u.el; r.name = u.name; r.art = u.art; r.star = u.star; r.role = u.role;
    r.boss = !!u.boss; r.summ = !!u.summoned; r.shiny = !!u.shiny;
    r.uid = u.inst && u.inst.uid;
  }
  const rows = [];
  const groups = [null, null];
  for (const k in st.fs) {
    if (k[0] === '_') continue;
    const r = st.fs[k];
    if (!r || r.side == null) continue;
    if (r.summ) {
      let g = groups[r.side];
      if (!g) {
        g = groups[r.side] = blank();
        g.id = 's' + r.side; g.side = r.side; g.summ = true; g.name = 'Summons';
        g.art = r.art; g.el = r.el; g.role = 'summon'; g.aliveEnd = false; g.n = 0; g.up = 0;
        rows.push(g);
      }
      addInto(g, r);
    } else rows.push(copyRow(r));
  }
  for (const g of groups) if (g) {
    g.name = g.n > 1 ? 'Summons ×' + g.n : 'Summons';
    delete g._top;
  }
  const players = rows.filter(r => r.side === 0);
  const mvp = {
    dmg: (best(players, r => r.dealt) || {}).id,
    heal: (best(players, r => (r.heal || 0) + (r.shield || 0)) || {}).id,
    cc: null,
    tank: (best(players, r => (r.taken || 0) + (r.absorbed || 0), r => r.role === 'tank') || {}).id,
  };
  let ccS = 0, ccN = -1, ccR = null;
  for (const r of players) {
    const s = r.ccSec || 0;
    if (s > ccS || (s === ccS && s > 0 && (r.ccN || 0) > ccN)) { ccS = s; ccN = r.ccN || 0; ccR = r; }
  }
  if (ccS > 0 && ccR) mvp.cc = ccR.id;
  let crown = null, cd = 0;
  for (const r of rows) if (r.side === 1 && r.dealt > cd) { cd = r.dealt; crown = r.id; }
  const m = meta.get(st.fs) || { haz: [0, 0], unkill: [0, 0] };
  return { win: st.over === 1, dur: st.t || 0, rows, mvp, crown, haz: m.haz.slice(), unkill: m.unkill.slice() };
}

function metric(r, tab) {
  if (tab === 'heal') return (r.heal || 0) + (r.shield || 0);
  if (tab === 'cc') return r.ccSec || 0;
  if (tab === 'taken') return (r.taken || 0) + (r.absorbed || 0);
  return r.dealt || 0;
}
function tint(hex, t) {
  const n = parseInt(String(hex || '#d9a6ff').slice(1), 16);
  if (!isFinite(n)) return '#d9a6ff';
  const ch = (c, i) => {
    const v = (n >> (16 - 8 * i)) & 255;
    const x = t >= 0 ? v + (255 - v) * t : v * (1 + t);
    return Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0');
  };
  return '#' + ch(0, 0) + ch(0, 1) + ch(0, 2);
}
function grad(parts) {
  const total = parts.reduce((s, p) => s + Math.max(0, p[0]), 0);
  if (total <= 0) return 'transparent';
  let acc = 0;
  const stops = [];
  for (const [v, c] of parts) {
    const a = acc / total * 100;
    acc += Math.max(0, v);
    stops.push(c + ' ' + a.toFixed(2) + '%', c + ' ' + (acc / total * 100).toFixed(2) + '%');
  }
  return 'linear-gradient(90deg,' + stops.join(',') + ')';
}
function barHtml(pctWidth, background, mode) {
  const w = mode === 'zero' ? 0 : pctWidth;
  return `<div class="fs-track"><i class="fs-fill" data-fs-w="${pctWidth.toFixed(2)}" style="width:${w.toFixed(2)}%;background:${background}"></i></div>`;
}
function numHtml(n, mode, title) {
  const t = title ? ` title="${esc(title)}"` : '';
  return `<span data-fs-n="${+n || 0}"${t}>${mode === 'zero' ? '0' : fmt(n)}</span>`;
}
function legend(tab) {
  if (tab === 'dmg') return `<div class="fs-leg"><span><i style="background:${tint(ELC.ember, 0.28)}"></i>Basic</span><span><i style="background:${ELC.ember}"></i>Skill</span><span><i style="background:${tint(ELC.ember, -0.38)}"></i>DoT</span><span class="fs-note">Tints follow each creature. Numbers are effective damage.</span></div>`;
  if (tab === 'heal') return `<div class="fs-leg"><span><i style="background:var(--good)"></i>Self</span><span><i style="background:#1f8a45"></i>Allies</span><span><i style="background:var(--shield)"></i>Shields</span></div>`;
  if (tab === 'taken') return `<div class="fs-leg"><span><i style="background:var(--bad)"></i>HP lost</span><span><i style="background:var(--shield)"></i>Absorbed</span></div>`;
  return `<div class="fs-leg"><span class="fs-note">Seconds of stun, root, chill, blind, hex, curse and shred applied. Soaked is a count only.</span></div>`;
}
function badgeHtml(r, snap, side) {
  const m = snap.mvp || {};
  if (side === 1) return String(r.id) === String(snap.crown) ? '<span class="fs-badge" title="Top damage">👑</span>' : '';
  let s = '';
  if (String(r.id) === String(m.dmg)) s += '<span class="fs-badge" title="MVP Damage">🗡</span>';
  if (String(r.id) === String(m.heal)) s += '<span class="fs-badge" title="Top Healer (healing + shields)">💚</span>';
  if (String(r.id) === String(m.cc)) s += '<span class="fs-badge" title="Top Control">🌀</span>';
  if (String(r.id) === String(m.tank)) s += '<span class="fs-badge" title="Tank">🛡</span>';
  return s;
}
function rowHtml(r, tab, max, mode, snap) {
  const dead = !r.aliveEnd;
  const col = ELC[r.el] || '#d9a6ff';
  const m = metric(r, tab);
  const width = max > 0 ? Math.max(0, Math.min(100, 100 * m / max)) : 0;
  let background = col, value = r.dealt || 0, title = 'effective damage', sub = '', valHtml = '';
  if (tab === 'dmg') {
    const basic = r.dealtBasic || 0, skill = r.dealtSkill || 0, dots = dotSum(r);
    background = grad([[basic, tint(col, 0.28)], [skill, col], [dots, tint(col, -0.38)]]);
    value = r.dealt || 0;
    if (r.kills) sub = numHtml(r.kills, mode) + ' K';
  } else if (tab === 'heal') {
    const self = r.healSelf || 0, got = r.heal || 0, other = Math.max(0, got - self), sh = r.shield || 0;
    background = grad([[self, 'var(--good)'], [other, '#1f8a45'], [sh, 'var(--shield)']]);
    value = got + sh;
    title = 'healing plus shields';
    valHtml = value > 0 ? 'Heal ' + numHtml(got, mode) + ' · Shield ' + numHtml(sh, mode) : '';
    if (r.healOver) sub = 'over ' + numHtml(r.healOver, mode);
  } else if (tab === 'cc') {
    background = col;
    value = r.ccSec || 0;
    title = 'seconds of control applied';
    const chips = [];
    for (const k in CC_LAB) if (r.cc[k] && r.cc[k].n) chips.push(`<span class="fs-mini">${CC_LAB[k]} ${numHtml(r.cc[k].n, mode)}</span>`);
    const dots = [];
    for (const k in r.dot) if (r.dot[k] > 0) dots.push((DOT_LAB[k] || k) + ' ' + numHtml(r.dot[k], mode));
    sub = chips.join('') + (dots.length ? `<span class="fs-dots">${dots.join(' · ')}</span>` : '');
  } else {
    background = grad([[r.taken || 0, 'var(--bad)'], [r.absorbed || 0, 'var(--shield)']]);
    value = r.taken || 0;
    title = 'HP lost';
    const bits = [];
    if (r.absorbed) bits.push('🛡 ' + numHtml(r.absorbed, mode));
    if (r.dodged) bits.push('dodged ' + numHtml(r.dodged, mode));
    sub = bits.join(' · ');
  }
  const kd = dead ? `<span class="fs-kd">${fmt(r.kills)}/${fmt(r.deaths)}</span>` : '';
  return `<button type="button" class="fs-row${dead ? ' fs-dead' : ''}" data-fs-row="${esc(r.id)}" aria-expanded="false">
      <img class="fs-spr${r.shiny ? ' shiny' : ''}" src="${artSrc(r.art)}" alt="">
      <span class="fs-mid">
        <span class="fs-name">${dead ? '<span class="fs-x" aria-hidden="true">✕</span>' : ''}<span class="nm">${esc(r.name)}</span>${stars(r)}${elImg(r.el)}${badgeHtml(r, snap, r.side)}${kd}</span>
        ${barHtml(width, background, mode)}
        ${sub ? `<span class="fs-sub">${sub}</span>` : ''}
      </span>
      <span class="fs-val${valHtml ? ' fs-pair' : ''}">${valHtml || numHtml(value, mode, title)}${tab === 'cc' ? '<span class="fs-unit">s</span>' : ''}</span>
    </button>`;
}
function detailHtml(r, mode) {
  const cell = (lab, n, extra) => `<div><span class="fs-k">${lab}</span> ${numHtml(n, mode)}${extra || ''}</div>`;
  const cc = [];
  for (const k in CC_LAB) if (r.cc[k] && r.cc[k].n) {
    const sec = r.cc[k].sec ? ` <span class="fs-k">(${numHtml(r.cc[k].sec, mode)}s)</span>` : '';
    cc.push(`<div>${CC_LAB[k]} ${numHtml(r.cc[k].n, mode)}${sec}</div>`);
  }
  const dots = [];
  for (const k in r.dot) if (r.dot[k] > 0) dots.push(`<div>${esc(DOT_LAB[k] || k)} ${numHtml(r.dot[k], mode)}</div>`);
  for (const k in r.dotN) if (r.dotN[k] > 0 && !(r.dot[k] > 0)) dots.push(`<div>${esc(DOT_LAB[k] || k)} applied ${numHtml(r.dotN[k], mode)}</div>`);
  const ally = Math.max(0, (r.heal || 0) - (r.healSelf || 0));
  return `<div class="fs-detail">
    ${cell('Basic', r.dealtBasic)}${cell('Skill', r.dealtSkill)}
    ${cell('DoT', dotSum(r))}${cell('Thorns', r.thornsDealt)}
    ${cell('Kills', r.kills)}${cell('Deaths', r.deaths)}
    ${r.revived ? cell('Revived', r.revived) : ''}${cell('Casts', r.casts)}
    ${cell('Ults', r.ults)}${cell('Taken', r.taken)}
    ${cell('Absorbed', r.absorbed)}${cell('Dodged', r.dodged)}
    ${cell('Healing', r.heal)}${cell('Self heal', r.healSelf)}
    ${cell('Ally heal', ally)}${cell('Overheal', r.healOver)}
    ${cell('Shields', r.shield)}${r.overkill ? cell('Overkill', r.overkill) : '<div></div>'}
    ${r.summ ? `<div class="fs-span">${fmt(r.up || 0)} of ${fmt(r.n || 0)} summons still standing</div>` : ''}
    ${cc.join('')}${dots.join('')}
  </div>`;
}
function bodyHtml(rec, mode) {
  const snap = rec.snap, tab = rec.tab, side = rec.side;
  const list = snap.rows.filter(r => r.side === side).sort((a, b) => metric(b, tab) - metric(a, tab) || String(a.name).localeCompare(String(b.name)));
  const max = list.reduce((m, r) => Math.max(m, metric(r, tab)), 0);
  const tabs = [['dmg', 'Damage'], ['heal', 'Healing'], ['cc', 'Control'], ['taken', 'Taken']];
  const rows = list.map(r => {
    const open = rec.open != null && String(rec.open) === String(r.id);
    const btn = rowHtml(r, tab, max, mode, snap).replace('aria-expanded="false"', open ? 'aria-expanded="true"' : 'aria-expanded="false"');
    return `<div class="fs-item">${btn}${open ? detailHtml(r, mode) : ''}</div>`;
  }).join('');
  const haz = snap.haz && snap.haz[1 - side] > 0 && (tab === 'dmg' || tab === 'taken')
    ? `<p class="fs-foot" title="Damage from weather, the cave, and other effects with no attacker">Hazards: ${fmt(snap.haz[1 - side])}</p>` : '';
  return `<div class="fs-sides" role="tablist" aria-label="Whose stats">
      <button type="button" role="tab" data-fs-side="0" aria-selected="${side === 0 ? 'true' : 'false'}">Your team</button>
      <button type="button" role="tab" data-fs-side="1" aria-selected="${side === 1 ? 'true' : 'false'}">Enemies</button>
    </div>
    <div class="fs-tabs" role="tablist" aria-label="Battle stat">
      ${tabs.map(([id, lab]) => `<button type="button" role="tab" data-fs-tab="${id}" aria-selected="${tab === id ? 'true' : 'false'}">${lab}</button>`).join('')}
    </div>
    ${legend(tab)}
    <div class="fs-rows">${rows || '<p class="fs-foot">No creatures.</p>'}</div>
    ${haz}`;
}
function chipSummary(snap) {
  const m = snap.mvp || {};
  const bits = [];
  if (m.dmg != null) bits.push('<span class="fs-chip">🗡 MVP Damage</span>');
  if (m.heal != null) bits.push('<span class="fs-chip" title="Most healing plus shields">💚 Top Healer</span>');
  if (m.cc != null) bits.push('<span class="fs-chip">🌀 Top Control</span>');
  if (m.tank != null) bits.push('<span class="fs-chip">🛡 Tank</span>');
  return bits.join('');
}
function shell(id, rec, mode) {
  const dur = (Math.round((rec.snap.dur || 0) * 10) / 10).toFixed(1);
  return `<details class="fsum" data-fs-id="${id}"><summary><span class="fs-title">Battle report</span><span class="fs-dur">${dur}s</span>${chipSummary(rec.snap)}</summary><div class="fs-body">${bodyHtml(rec, mode)}</div></details>`;
}

function reduced() {
  try { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
}
function richAnim() {
  if (typeof document === 'undefined') return false;
  if (reduced()) return false;
  let q = null;
  try { q = new URLSearchParams(root.location.search).get('anim'); } catch (e) { /* no location */ }
  if (q === '0') return false;
  if (q === '1') return true;
  const meta = root.GLIM && root.GLIM.meta;
  if (meta && (meta.autoClassic || meta.anim === 0)) return false;
  return true;
}
function modalOn() {
  const m = typeof document !== 'undefined' && document.getElementById('modal');
  return !m || m.classList.contains('on');
}
function shouldAnimate(rec) {
  if (!richAnim() || !modalOn()) return false;
  const now = (root.performance && performance.now) ? performance.now() : Date.now();
  if (rec.animAt && now - rec.animAt < 1000) return false;
  return true;
}
function fillFinal(det) {
  det.querySelectorAll('[data-fs-n]').forEach(n => { n.textContent = fmt(+n.getAttribute('data-fs-n')); });
  det.querySelectorAll('[data-fs-w]').forEach(n => { n.style.width = (+n.getAttribute('data-fs-w') || 0) + '%'; });
}
function startAnim(det, rec) {
  const id = det.getAttribute('data-fs-id');
  if (anims.has(id)) cancelAnimationFrame(anims.get(id));
  const now0 = (root.performance && performance.now) ? performance.now() : Date.now();
  rec.animAt = now0;
  const nodes = Array.prototype.slice.call(det.querySelectorAll('[data-fs-n], [data-fs-w]'));
  const step = (now) => {
    if (!det.isConnected) { anims.delete(id); return; }
    const p = Math.min(1, (now - now0) / 600);
    const e = 1 - Math.pow(1 - p, 3);
    for (const n of nodes) {
      if (n.hasAttribute('data-fs-n')) n.textContent = fmt((+n.getAttribute('data-fs-n') || 0) * e);
      if (n.hasAttribute('data-fs-w')) n.style.width = ((+n.getAttribute('data-fs-w') || 0) * e) + '%';
    }
    if (p < 1) anims.set(id, requestAnimationFrame(step));
    else anims.delete(id);
  };
  anims.set(id, requestAnimationFrame(step));
}
function paint(det, rec, animate) {
  const id = det.getAttribute('data-fs-id');
  if (anims.has(id)) { cancelAnimationFrame(anims.get(id)); anims.delete(id); }
  const go = !!(animate && shouldAnimate(rec));
  const body = det.querySelector('.fs-body');
  if (!body) return;
  body.innerHTML = bodyHtml(rec, go ? 'zero' : 'final');
  if (go) startAnim(det, rec);
}
function onClick(e) {
  const t = e.target && e.target.closest ? e.target : null;
  if (!t || !t.closest) return;
  const det = t.closest('details.fsum');
  if (!det) return;
  const sideB = t.closest('[data-fs-side]');
  const tabB = t.closest('[data-fs-tab]');
  const rowB = t.closest('[data-fs-row]');
  if (!sideB && !tabB && !rowB) return;
  const rec = reports.get(+det.getAttribute('data-fs-id'));
  if (!rec) return;
  if (sideB) { rec.side = +sideB.getAttribute('data-fs-side') === 1 ? 1 : 0; rec.open = null; paint(det, rec, true); }
  else if (tabB) { rec.tab = tabB.getAttribute('data-fs-tab') || 'dmg'; rec.open = null; paint(det, rec, true); }
  else {
    const rid = rowB.getAttribute('data-fs-row');
    rec.open = rec.open != null && String(rec.open) === String(rid) ? null : rid;
    paint(det, rec, false);
  }
}
function onToggle(e) {
  const det = e.target;
  if (!det || !det.classList || !det.classList.contains('fsum') || !det.open) return;
  const rec = reports.get(+det.getAttribute('data-fs-id'));
  if (!rec) return;
  if (shouldAnimate(rec)) startAnim(det, rec);
  else fillFinal(det);
}
function bind() {
  if (bound || typeof document === 'undefined') return;
  bound = true;
  document.addEventListener('click', onClick);
  document.addEventListener('toggle', onToggle, true);
}
function ensureCss() {
  if (typeof document === 'undefined' || document.getElementById('fsStyles')) return;
  const s = document.createElement('style');
  s.id = 'fsStyles';
  s.textContent = `
.fsum { margin: 10px 0 2px; max-width: 100%; color: var(--ink); }
.fsum summary { min-height: 44px; display: flex; align-items: center; flex-wrap: wrap; gap: 6px; padding: 8px 10px; cursor: pointer; border-radius: 12px; background: rgba(255,255,255,.06); list-style: none; }
.fsum summary::-webkit-details-marker { display: none; }
.fsum summary::before { content: '▸'; font-family: Fredoka, Nunito, sans-serif; color: var(--gold); }
.fsum[open] summary::before { content: '▾'; }
.fs-title { font-family: Fredoka, Nunito, sans-serif; font-size: 16px; font-weight: 700; }
.fs-dur { color: var(--dim); font-size: 13px; }
.fs-chip, .fs-badge { font: 700 12px/1.2 Fredoka, Nunito, sans-serif; color: #3a1d00; background: linear-gradient(180deg, #ffe58a, #ffc93c); border-radius: 99px; padding: 3px 7px; }
.fs-badge { padding: 1px 5px; }
.fs-body { padding-top: 8px; max-width: 100%; }
.fs-sides, .fs-tabs { display: grid; gap: 6px; margin: 0 0 6px; }
.fs-sides { grid-template-columns: 1fr 1fr; }
.fs-tabs { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.fs-sides button, .fs-tabs button { min-height: 44px; border-radius: 12px; background: rgba(255,255,255,.08); color: var(--ink); box-shadow: inset 0 0 0 2px rgba(255,255,255,.2); font-family: Fredoka, Nunito, sans-serif; font-size: 14px; font-weight: 700; padding: 6px 4px; line-height: 1.15; }
.fs-sides button[aria-selected="true"], .fs-tabs button[aria-selected="true"] { background: linear-gradient(180deg, #ffd65a, #ff9f1c); color: #3a1d00; box-shadow: inset 0 0 0 2px var(--gold), 0 3px 0 #b4600a; }
.fs-leg { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; font-size: 12px; color: var(--dim); margin: 0 0 6px; }
.fs-leg i { display: inline-block; width: 12px; height: 12px; border-radius: 3px; margin-right: 4px; vertical-align: -1px; }
.fs-note { flex: 1 1 140px; }
.fs-item { max-width: 100%; }
.fs-row { display: flex; align-items: center; gap: 8px; width: 100%; min-height: 44px; margin-top: 6px; padding: 4px 8px; border-radius: 12px; background: rgba(255,255,255,.06); color: var(--ink); text-align: left; }
.fs-spr { width: 40px; height: 40px; flex: 0 0 40px; object-fit: contain; }
.fs-mid { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.fs-name { display: flex; align-items: center; flex-wrap: wrap; gap: 4px; font-family: Fredoka, Nunito, sans-serif; font-size: 14px; min-width: 0; }
.fs-name .nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
.fs-star { color: var(--gold); letter-spacing: -1px; }
.fs-x { color: var(--bad); font-weight: 800; }
.fs-kd { color: var(--dim); font-size: 12px; }
.fs-row.fs-dead .nm { color: var(--dim); }
.fs-row.fs-dead .fs-spr { filter: grayscale(.85); opacity: .75; }
.fs-track { height: 12px; border-radius: 99px; background: rgba(0,0,0,.35); overflow: hidden; min-width: 0; }
.fs-fill { display: block; height: 100%; width: 0; }
.fs-sub { display: flex; flex-wrap: wrap; gap: 4px 8px; font-size: 12px; color: var(--dim); min-width: 0; }
.fs-mini { font-size: 11px; font-weight: 800; letter-spacing: .3px; color: var(--ink); background: rgba(0,0,0,.35); border-radius: 99px; padding: 1px 6px; }
.fs-dots { color: var(--dim); }
.fs-val { flex: 0 1 auto; font-weight: 800; font-variant-numeric: tabular-nums; text-align: right; min-width: 2.4em; max-width: 11em; line-height: 1.15; }
.fs-pair { font-size: 12px; font-weight: 700; }
.fs-unit { color: var(--dim); font-weight: 700; margin-left: 1px; }
.fs-detail { display: grid; grid-template-columns: 1fr 1fr; gap: 3px 12px; padding: 4px 8px 8px 52px; font-size: 13px; }
.fs-k { color: var(--dim); }
.fs-span { grid-column: 1 / -1; color: var(--dim); }
.fs-foot { margin: 6px 2px 0; font-size: 12px; color: var(--dim); }
.fsum button:focus-visible, .fsum summary:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
.fsum .badge { width: 18px; height: 18px; max-width: 18px; max-height: 18px; }
@media (max-width: 560px) {
  .fs-detail { padding-left: 8px; }
  .fs-tabs button, .fs-sides button { font-size: 13px; }
}
`;
  document.head.appendChild(s);
}
function block(st, tab) {
  const snap = snapshot(st);
  const id = ++seq;
  const rec = { snap, side: 0, tab: tab || 'dmg', open: null, animAt: 0 };
  reports.set(id, rec);
  while (reports.size > 3) reports.delete(reports.keys().next().value);
  ensureCss();
  bind();
  return shell(id, rec, richAnim() ? 'zero' : 'final');
}

root.FightStats = { init, row, dmg, basicHit, heal, shield, status, ko, revive, dodge, cast, by, snapshot, block, bind };
})(typeof window !== 'undefined' ? window : globalThis);
