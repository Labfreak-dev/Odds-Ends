// Glimmerdeep: The Wilds, the DOM-free half. Floor layouts, the creatures in each room and fight
// placement, shared by wilds.js (the page) and wsim.js (headless balance runs).
(function (root) {
'use strict';
const G = root.GD;
const FLOORS = 5, SQUAD_START = 4, SQUAD_MAX = 6, GRID = 9;
const XP_STAR = [0, 4, 12];                 // squad XP for ★2 and ★3 during an expedition
const TMAX = [2, 3, 4, 5, 5], TMIN = [1, 1, 2, 3, 3];
const DIRS = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = (r, a) => a[Math.floor(r() * a.length)];
const key = (x, y) => x + ',' + y;

function weighted(r, list, w) {
  let tot = 0; for (const k of list) tot += w(k);
  let t = r() * tot;
  for (const k of list) { t -= w(k); if (t <= 0) return k; }
  return list[list.length - 1];
}
// a species for this floor: biome elements first, locked species far more likely
function species(r, els, tmin, tmax, used, unlocked) {
  const all = Object.keys(G.SP).filter(k => G.TIER[k] >= tmin && G.TIER[k] <= tmax);
  let pool = all.filter(k => els.includes(G.SP[k].el));
  if (pool.length < 3) pool = all;
  return weighted(r, pool, k => (unlocked(k) ? 1 : 3) * (used[k] ? 0.25 : 1));
}
// difficulty knobs, fitted with wsim.js (index = floor - 1)
const TUNE = {
  scale: [0.9, 1.3, 1.5, 1.6, 1.7],          // wild stat multiplier per floor
  wildEsc: [0, 2, 2, 2, 3], wild2: [0, 0.2, 0.4, 0.6, 0.8], wildEscStar: [1, 1, 1, 2, 2],
  lairStar: [2, 2, 2, 3, 3], lairEsc: [2, 2, 3, 3, 4], lairEscStar: [1, 1, 1, 2, 2], lairScale: 1.05,
};
function makeMon(r, floor, els, kind, used, unlocked) {
  const f = floor - 1, T = TUNE;
  let tmax = TMAX[f], tmin = TMIN[f], star = 1, esc = 0, escStar = T.wildEscStar[f], scale = T.scale[f];
  if (kind === 'lair') { tmin = Math.max(tmin, tmax - 1); star = T.lairStar[f]; esc = T.lairEsc[f]; escStar = T.lairEscStar[f]; scale *= T.lairScale; }
  else if (kind === 'rare') { tmax = Math.min(5, tmax + 1); tmin = tmax - 1; esc = T.wildEsc[f] + 1; scale *= 1.05; }
  else { if (r() < T.wild2[f]) star = 2; esc = T.wildEsc[f] + (r() < 0.5 ? 1 : 0); }
  const sp = species(r, els, tmin, tmax, used, unlocked);
  used[sp] = 1;
  const escorts = [];
  const mates = Object.keys(G.SP).filter(k => G.TIER[k] <= Math.max(1, G.TIER[sp]) && G.TIER[k] >= Math.max(1, tmin - 1) && k !== sp);
  const kin = mates.filter(k => G.SP[k].el === G.SP[sp].el);
  for (let i = 0; i < esc; i++) escorts.push(pick(r, kin.length >= 2 && r() < 0.6 ? kin : mates));
  return { sp, star, escorts, escStar, scale: +scale.toFixed(3), beaten: false };
}
function genFloor(floor, biome, seed, unlocked) {
  const r = rng(seed);
  const n = Math.min(12, 6 + floor);
  const rooms = {};
  const nb = (x, y) => Object.keys(DIRS).filter(d => rooms[key(x + DIRS[d][0], y + DIRS[d][1])]);
  const add = (x, y, type) => (rooms[key(x, y)] = { x, y, type, visited: false, seen: false, mon: null, item: null, used: false, rocks: [] });
  const c = Math.floor(GRID / 2);
  add(c, c, 'start');
  for (let tries = 0; Object.keys(rooms).length < n && tries < 2000; tries++) {
    const from = rooms[pick(r, Object.keys(rooms))], d = pick(r, Object.keys(DIRS));
    const x = from.x + DIRS[d][0], y = from.y + DIRS[d][1];
    if (x < 0 || y < 0 || x >= GRID || y >= GRID || rooms[key(x, y)]) continue;
    if (nb(x, y).length > 1) continue;               // no loops: every room hangs off one parent
    if (from.type === 'start' && nb(from.x, from.y).length >= 3 && r() < 0.7) continue;
    add(x, y, 'normal');
  }
  // distance from the start decides the lair, then the other dead ends get the special rooms
  const dist = { [key(c, c)]: 0 }, q = [key(c, c)];
  while (q.length) { const k = q.shift(), a = rooms[k]; for (const d of nb(a.x, a.y)) { const k2 = key(a.x + DIRS[d][0], a.y + DIRS[d][1]); if (dist[k2] == null) { dist[k2] = dist[k] + 1; q.push(k2); } } }
  const dead = Object.values(rooms).filter(a => a.type !== 'start' && nb(a.x, a.y).length === 1).sort((a, b) => dist[key(b.x, b.y)] - dist[key(a.x, a.y)]);
  const els = Array.from(new Set(G.BIOMES[biome].els));
  const used = {};
  if (dead[0]) { dead[0].type = 'lair'; dead[0].mon = makeMon(r, floor, els, 'lair', used, unlocked); }
  if (dead[1]) { dead[1].type = 'locked'; if (r() < 0.7) dead[1].mon = makeMon(r, floor, els, 'rare', used, unlocked); else dead[1].item = 'chest'; }
  if (dead[2]) dead[2].type = 'treasure', dead[2].item = 'chest';
  if (dead[3]) dead[3].type = 'shrine', dead[3].item = 'shrine';
  // a secret room in a gap touching two or more rooms (never next to the lair)
  const gaps = [];
  for (let x = 0; x < GRID; x++) for (let y = 0; y < GRID; y++) if (!rooms[key(x, y)]) {
    const ns = nb(x, y).map(d => rooms[key(x + DIRS[d][0], y + DIRS[d][1])]);
    if (ns.length >= 2 && !ns.some(a => a.type === 'lair' || a.type === 'locked')) gaps.push([x, y]);
  }
  if (gaps.length) { const [x, y] = pick(r, gaps); const s = add(x, y, 'secret'); if (r() < 0.5) s.mon = makeMon(r, floor, els, 'rare', used, unlocked); else s.item = 'chest'; s.found = false; }
  const normal = Object.values(rooms).filter(a => a.type === 'normal');
  for (const a of normal) { if (r() < 0.78) a.mon = makeMon(r, floor, els, 'wild', used, unlocked); else if (r() < 0.6) a.item = 'berry'; }
  if (dead[1]) { const spots = normal.filter(a => !a.item); const k = pick(r, spots.length ? spots : normal); if (k) k.item = 'key'; }
  // a few boulders for cover, away from doors and the middle
  for (const a of Object.values(rooms)) {
    if (a.type === 'start' || a.type === 'lair') continue;
    const m = Math.floor(r() * 4);
    for (let i = 0; i < m; i++) {
      const x = 2.4 + r() * 11.2, y = 2.2 + r() * 4.6;
      if (Math.abs(x - 8) < 2.2 && Math.abs(y - 4.5) < 1.6) continue;
      if (Math.abs(x - 8) < 1.6 && (y < 2.6 || y > 6.4)) continue;
      if (Math.abs(y - 4.5) < 1.4 && (x < 3 || x > 13)) continue;
      a.rocks.push([+x.toFixed(2), +y.toFixed(2), +(0.42 + r() * 0.22).toFixed(2)]);
    }
  }
  rooms[key(c, c)].visited = true;
  return { rooms, cur: key(c, c) };
}
function placeSide(insts, side) {
  const cols = side === 0 ? { tank: 3, striker: 2, caster: 1, support: 0 } : { tank: 4, striker: 5, caster: 6, support: 7 };
  const taken = {}, out = [], rows = [2, 1, 3, 0, 4];
  for (const inst of insts) {
    const role = G.SP[inst.sp].role;
    let c0 = cols[role] != null ? cols[role] : (side ? 5 : 2), done = false;
    for (let off = 0; off < 4 && !done; off++) for (const c of [c0 - off, c0 + off]) {
      if (done || (side === 0 ? c < 0 || c > 3 : c < 4 || c > 7)) continue;
      for (const y of rows) if (!taken[c + ',' + y]) { taken[c + ',' + y] = 1; out.push({ inst, x: c, y }); done = true; break; }
    }
  }
  return out;
}
root.GW = { TUNE, FLOORS, SQUAD_START, SQUAD_MAX, GRID, XP_STAR, DIRS, rng, pick, key, genFloor, placeSide };
})(typeof window !== 'undefined' ? window : globalThis);
