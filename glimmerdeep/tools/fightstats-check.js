// Determinism, conservation and perf for the battle report.
//   node glimmerdeep/tools/fightstats-check.js
// Outcomes of GC.resolve must match with fightstats.js loaded and without it.
const path = require('path');
const root = path.join(__dirname, '..');
require(path.join(root, 'species2.js'));
require(path.join(root, 'data.js'));
require(path.join(root, 'chess.js'));
require(path.join(root, 'crun.js'));
require(path.join(root, 'fightstats.js'));

const G = globalThis.GD, C = globalThis.GC;
const FS = globalThis.FightStats;
const KEYS = Object.keys(G.SP);
const BIOMES = Object.keys(G.BIOMES);
let fail = 0;
function bad(msg) { fail++; console.error('FAIL ' + msg); }

function lineup(seed, side) {
  const rng = C.mkRng((seed * 17 + side * 7919 + 3) >>> 0);
  const xs = side === 0 ? [0, 1, 2, 3] : [7, 6, 5, 4];
  const cells = [];
  for (const x of xs) for (let y = 0; y < 5; y++) cells.push([x, y]);
  const out = [];
  for (let i = 0; i < 10; i++) {
    const sp = KEYS[Math.floor(rng() * KEYS.length)];
    const inst = { sp, star: 1 + Math.floor(rng() * 3), muts: [] };
    inst.skill = C.defaultSkill(inst);
    out.push({ inst, x: cells[i][0], y: cells[i][1] });
  }
  return out;
}
function make(seed) {
  return C.create({
    board: lineup(seed, 0), enemies: lineup(seed, 1),
    relics: [], perks: {}, biome: BIOMES[seed % BIOMES.length],
    seed: seed >>> 0, depth: seed % 5, camp: {}, mods: {},
  });
}
function fp(st) {
  return JSON.stringify({
    t: st.t, over: st.over, ev: st.ev.length,
    u: st.units.map(u => [u.hp, u.alive ? 1 : 0, u.kills || 0]),
  });
}
function play(seed) {
  const st = make(seed);
  C.resolve(st);
  return st;
}

function dotOf(r) {
  let s = 0;
  for (const k in r.dot || {}) s += r.dot[k] || 0;
  return s;
}
function checkSnap(st, label) {
  const snap = FS.snapshot(st);
  const rows = snap.rows;
  const sum = (side, fn) => rows.filter(r => r.side === side).reduce((s, r) => s + fn(r), 0);
  const d0 = sum(0, r => r.dealt), d1 = sum(1, r => r.dealt);
  const t0 = sum(0, r => r.taken + r.absorbed), t1 = sum(1, r => r.taken + r.absorbed);
  if (d0 + (snap.haz[1] || 0) !== t1) bad(label + ' dealt0+haz1 ' + (d0 + snap.haz[1]) + ' != taken1 ' + t1);
  if (d1 + (snap.haz[0] || 0) !== t0) bad(label + ' dealt1+haz0 ' + (d1 + snap.haz[0]) + ' != taken0 ' + t0);
  const kills = sum(0, r => r.kills) + sum(1, r => r.kills);
  const deaths = sum(0, r => r.deaths) + sum(1, r => r.deaths);
  const unk = (snap.unkill[0] || 0) + (snap.unkill[1] || 0);
  if (kills + unk !== deaths) bad(label + ' kills ' + kills + ' + unkill ' + unk + ' != deaths ' + deaths);
  let burn = 0, heal = 0;
  for (const r of rows) {
    for (const k of ['dealt', 'dealtBasic', 'dealtSkill', 'overkill', 'taken', 'absorbed', 'thornsDealt', 'dodged', 'heal', 'healSelf', 'healOver', 'shield', 'ccSec', 'ccN', 'kills', 'deaths', 'casts', 'ults']) {
      const v = r[k] || 0;
      if (!isFinite(v) || v < 0) bad(label + ' bad ' + k + '=' + v + ' on ' + r.name);
    }
    const parts = (r.dealtBasic || 0) + (r.dealtSkill || 0) + dotOf(r);
    if (Math.abs(parts - (r.dealt || 0)) > 1e-6) bad(label + ' dealt split ' + parts + ' != ' + r.dealt + ' ' + r.name);
    if ((r.healSelf || 0) > (r.heal || 0) + 1e-6) bad(label + ' self heal > heal');
    burn += (r.dot && r.dot.burn) || 0;
    burn += (r.dotN && r.dotN.burn) || 0;
    heal += r.heal || 0;
  }
  const html = FS.block(st);
  if (!html.includes('Battle report') || !html.includes('data-fs-tab')) bad(label + ' report markup missing');
  if (/data-v\s*=/.test(html)) bad(label + ' report used data-v');
  return { burn, heal, rows: rows.length };
}

// --- determinism: same 200 seeds, tracker off then on ---
const N = 200;
globalThis.FightStats = null;
const off = [];
for (let i = 1; i <= N; i++) off.push(fp(play(i)));
globalThis.FightStats = FS;
let detDiff = 0;
for (let i = 1; i <= N; i++) {
  const st = play(i);
  const got = fp(st);
  if (got !== off[i - 1]) { detDiff++; if (detDiff < 4) bad('seed ' + i + '\n off ' + off[i - 1] + '\n on  ' + got); }
}
if (!detDiff) console.log('determinism: ' + N + '/' + N + ' seeds match (t, over, hp, alive, kills, ev.length)');

// skip mid-fight equals a full resolve, and the report matches
globalThis.FightStats = FS;
let skipBad = 0;
for (let i = 1; i <= 20; i++) {
  const a = make(i); C.resolve(a);
  const b = make(i);
  for (let k = 0; k < 7; k++) C.tick(b);
  C.resolve(b);
  if (fp(a) !== fp(b)) { skipBad++; bad('skip replay state seed ' + i); continue; }
  const norm = st => JSON.stringify(FS.snapshot(st).rows.map(r => {
    const o = Object.assign({}, r); delete o.id; return o;
  }).sort((x, y) => (x.side - y.side) || String(x.name).localeCompare(String(y.name)) || (x.dealt - y.dealt) || (x.taken - y.taken) || (x.heal - y.heal)));
  if (norm(a) !== norm(b)) { skipBad++; if (skipBad < 3) bad('skip replay report seed ' + i); }
}
if (!skipBad) console.log('skip: 20 mid-fight resolves match a full replay, report included');

// conservation + a burn-heavy fight
globalThis.FightStats = FS;
let sawBurn = 0, sawHeal = 0;
for (let i = 1; i <= N; i++) {
  const st = play(1000 + i);
  const c = checkSnap(st, 'seed ' + (1000 + i));
  if (c.burn > 0) sawBurn++;
  if (c.heal > 0) sawHeal++;
}
const ember = KEYS.filter(k => G.SP[k].el === 'ember');
function fixed(seed, sps, side) {
  const xs = side === 0 ? [0, 1, 2, 3] : [7, 6, 5, 4];
  const cells = [];
  for (const x of xs) for (let y = 0; y < 5; y++) cells.push([x, y]);
  return sps.slice(0, 10).map((sp, i) => {
    const inst = { sp, star: 2, muts: [] };
    inst.skill = C.defaultSkill(inst);
    return { inst, x: cells[i][0], y: cells[i][1] };
  });
}
if (ember.length >= 10) {
  const st = C.create({ board: fixed(1, ember, 0), enemies: fixed(2, ember, 1), relics: [], perks: {}, biome: 'verdant', seed: 42, depth: 0, camp: {}, mods: {} });
  C.resolve(st);
  const c = checkSnap(st, 'ember');
  if (!(c.burn > 0)) bad('ember mirror did not apply or deal burn');
  else sawBurn++;
  console.log('ember mirror: burn credited, ' + c.rows + ' report rows');
} else bad('not enough ember species');
if (!sawBurn) bad('no burn credit in the sample');
else console.log('conservation: ' + N + ' random fights + ember mirror, burn fights ' + sawBurn + ', fights with healing ' + sawHeal);
if (!fail) console.log('markup: Battle report HTML has data-fs-* and no data-v');

// perf: interleaved batches so JIT does not favour one side
const PER_N = 1000, WARM = 30;
function bench(on, salt) {
  globalThis.FightStats = on ? FS : null;
  for (let i = 0; i < WARM; i++) play(50000 + salt + i);
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < PER_N; i++) play(80000 + salt * 100000 + i);
  return Number(process.hrtime.bigint() - t0) / 1e6;
}
const ratios = [];
for (let p = 0; p < 4; p++) {
  const o = bench(false, p * 2 + 1), n = bench(true, p * 2 + 2);
  ratios.push(n / o - 1);
  console.log('perf pair ' + (p + 1) + ': off ' + o.toFixed(0) + ' ms, on ' + n.toFixed(0) + ' ms, ' + ((n / o - 1) * 100).toFixed(2) + '%');
}
ratios.sort((a, b) => a - b);
const slow = ((ratios[1] + ratios[2]) / 2) * 100;
console.log('perf: median slowdown ' + slow.toFixed(2) + '% over ' + PER_N + ' 10v10 fights x4 pairs');
if (slow >= 3) bad('slowdown ' + slow.toFixed(2) + '% >= 3%');

if (fail) { console.error(fail + ' failure(s)'); process.exit(1); }
console.log('FIGHTSTATS CHECK: ALL PASS');
