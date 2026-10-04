// Damage parity: GArena.hit must return the same numbers as GC.hit on a fixed seed,
// before either fight takes a step. Also checks a full arena resolve is finite,
// deterministic, and ends by 60s.
//   node glimmerdeep/tools/arena-damage.js
'use strict';
require('../species2.js');
require('../data.js');
require('../relics2.js');
require('../chess.js');
require('../arena.js');
const G = globalThis.GD, C = globalThis.GC, A = globalThis.GArena;

let fails = 0;
function check(ok, what) {
  if (!ok) { fails++; console.error('FAIL', what); }
  else console.log('PASS', what);
}

function opts(seed, extra) {
  extra = extra || {};
  return {
    seed,
    biome: extra.biome || 'verdant',
    relics: extra.relics || [],
    perks: extra.perks || {},
    board: extra.board || [
      { inst: { sp: 'cind', star: 2, muts: ['brittle'], skill: 'flame_lash' }, x: 3, y: 2 },
      { inst: { sp: 'bubb', star: 1, muts: [] }, x: 1, y: 1 },
    ],
    enemies: extra.enemies || [
      { inst: { sp: 'shel', star: 2, muts: [] }, x: 4, y: 2 },
      { inst: { sp: 'pyrp', star: 1, muts: [] }, x: 6, y: 3 },
    ],
    mods: extra.mods || {},
    camp: extra.camp || null,
  };
}

function strike(st, hitFn, sk, o) {
  const a = st.units.find(u => u.side === 0 && !u.summoned);
  const d = st.units.find(u => u.side === 1);
  const ev = [];
  const v = hitFn(st, a, d, sk, ev, o || { basic: true, single: true });
  const dmgs = ev.filter(e => e.k === 'dmg').map(e => e.v + (e.crit ? 'c' : '') + (e.dot || '') + (e.thorn ? 't' : ''));
  const reacts = ev.filter(e => e.k === 'react').map(e => e.name);
  return { v, dmgs, reacts, hp: d.hp, ahp: a.hp };
}

function pair(seed, extra, skId, prep, o) {
  const sc = C.create(opts(seed, extra));
  const sa = A.create(opts(seed, extra));
  if (prep) { prep(sc); prep(sa); }
  const sk = G.SK[skId];
  const rc = strike(sc, C.hit, sk, o);
  const ra = strike(sa, A.hit, sk, o);
  const same = rc.v === ra.v && rc.dmgs.join(',') === ra.dmgs.join(',') && rc.reacts.join(',') === ra.reacts.join(',') && rc.hp === ra.hp && rc.ahp === ra.ahp;
  check(same, `seed ${seed} ${skId} chess ${rc.v} [${rc.dmgs}] ${rc.reacts} vs arena ${ra.v} [${ra.dmgs}] ${ra.reacts}`);
  // a second blow must stay aligned too
  const rc2 = strike(sc, C.hit, sk, o);
  const ra2 = strike(sa, A.hit, sk, o);
  check(rc2.v === ra2.v && rc2.dmgs.join(',') === ra2.dmgs.join(','), `seed ${seed} ${skId} second blow ${rc2.v} vs ${ra2.v}`);
}

for (const seed of [1, 7, 42, 99, 12345, 99991]) {
  pair(seed, null, 'ember_nip');
}
pair(3, { relics: ['loaded_die'], perks: { rally: 1 } }, 'ember_nip');
pair(11, null, 'zap_scratch', st => { st.units.find(u => u.side === 1).st.soak = { t: 5 }; });
pair(12, null, 'riptide', st => { st.units.find(u => u.side === 1).st.burn = { t: 4, v: 3, src: null }; });
pair(13, null, 'magma_fist', st => { const d = st.units.find(u => u.side === 1); d.st.poison = { n: 3, v: 2, src: null }; });
pair(14, { relics: ['phoenix_plume'], camp: { atkMul: 0.1, hpMul: 0.05 } }, 'crystal_claw');

const nSkills = Object.keys(A.SHAPES).length;
check(nSkills >= 123, `shape table covers ${nSkills} skills`);
const missing = Object.keys(G.SK).filter(id => !A.SHAPES[id]);
check(missing.length === 0, 'every skill has a shape' + (missing.length ? ' ' + missing.slice(0, 5).join(',') : ''));
let hand = 0, plain = 0;
for (const id in A.SHAPES) if (A.SHAPES[id].hand) hand++; else plain++;
check(hand > 0 && plain > 0, `shapes hand ${hand} default ${plain}`);

// tactics: missing fields stay at the role default, unknown fields are ignored
const tac = A.tacticOf({ sp: 'bubb', tactic: { stance: 'aggressive', focus: 'nope' } });
check(tac.stance === 'aggressive' && tac.focus === 'healers' && tac.ff === 'avoid', 'tactic defaults fill missing fields');

function fingerprint(st) {
  // ids come from chess.js's process-global counter, so two creates in one
  // process do not share id numbers. Compare the fight, not the ids.
  return [st.over, st.t, st.n].concat(st.units.map(u => [u.side, u.name, u.alive ? 1 : 0, u.hp, Math.round(u.pos.x * 1000), Math.round(u.pos.y * 1000)].join(':'))).join('|');
}
function finite(st) {
  for (const u of st.units) {
    if (!Number.isFinite(u.hp) || !Number.isFinite(u.pos.x) || !Number.isFinite(u.pos.y)) return false;
    if (!Number.isFinite(u.vel.x) || !Number.isFinite(u.vel.y)) return false;
  }
  for (const p of st.projs) if (!Number.isFinite(p.pos.x) || !Number.isFinite(p.pos.y)) return false;
  return true;
}
const lens = [];
for (const seed of [4, 20, 88]) {
  const a = A.create(opts(seed));
  const b = A.create(opts(seed));
  A.resolve(a); A.resolve(b);
  check(a.over === 1 || a.over === 2, `resolve seed ${seed} ends (${a.over}) at ${a.t.toFixed(2)}s`);
  check(a.t <= 60 + 1e-6, `resolve seed ${seed} within 60s (${a.t})`);
  check(finite(a) && finite(b), `resolve seed ${seed} finite positions`);
  check(fingerprint(a) === fingerprint(b), `resolve seed ${seed} deterministic`);
  check(a.ev.some(e => e.k === 'attack_windup') && a.ev.some(e => e.k === 'attack_hit'), `resolve seed ${seed} emits windup and hit frame`);
  check(a.ev.some(e => e.k === 'dmg'), `resolve seed ${seed} dealt damage`);
  const moved = a.units.some(u => Math.abs(u.pos.x - ((u.inst && 0) )) );
  lens.push(a.t);
}
check(lens.every(t => t > 0.5), 'fights take more than a single step');

// a ranged basic must spawn a projectile on a short stepped fight
{
  const st = A.create(opts(5, { board: [{ inst: { sp: 'bubb', star: 1, muts: [] }, x: 3, y: 2 }], enemies: [{ inst: { sp: 'cind', star: 1, muts: [] }, x: 4, y: 2 }] }));
  let saw = false;
  for (let i = 0; i < 90 && !st.over; i++) {
    const ev = A.tick(st);
    if (ev.some(e => e.k === 'proj') || st.projs.length) saw = true;
  }
  check(saw, 'ranged basic spawns a projectile');
  check(finite(st), 'stepped fight stays finite');
}

if (fails) { console.error(fails + ' failed'); process.exit(1); }
console.log('ARENA DAMAGE: ALL PASS');
