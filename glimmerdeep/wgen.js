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
const LURE = { el: null };   // set per floor by genFloor
function species(r, els, tmin, tmax, used, unlocked) {
  const all = Object.keys(G.SP).filter(k => G.TIER[k] >= tmin && G.TIER[k] <= tmax);
  let pool = all.filter(k => els.includes(G.SP[k].el) || k === LURE.el || G.SP[k].el === LURE.el);
  if (pool.length < 3) pool = all;
  // a lure (Trainer's Post) makes its element four times as likely, even outside the biome
  // locked species get likelier as the collection fills, so the last few are not a slog
  const frac = Object.keys(G.SP).filter(unlocked).length / Object.keys(G.SP).length, lockW = 3 + 9 * frac * frac;
  return weighted(r, pool, k => (unlocked(k) ? 1 : lockW) * (used[k] ? 0.25 : 1) * (G.SP[k].el === LURE.el ? 4 : 1));
}
// difficulty knobs, fitted with wsim.js (index = floor - 1)
const TUNE = {
  scale: [0.9, 1.4, 1.65, 1.8, 1.95],          // wild stat multiplier per floor
  wildEsc: [0, 2, 2, 2, 3], wild2: [0, 0.2, 0.4, 0.6, 0.8], wildEscStar: [1, 1, 1, 2, 2],
  trSize: [3, 3, 4, 4, 5], trStar2: [0.15, 0.3, 0.45, 0.6, 0.75], trScale: [0.75, 1.0, 1.3, 1.35, 1.5],
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
// ---- room obstacles: a 13x7 tile grid over the floor (Isaac-style layouts) ----------------
// tile (c, r) is centred at (2 + c, 1.5 + r); '.' floor, 'R' rock, 'P' pit, 'S' spikes.
// Rows 0 and 6 sit half in the wall and stay clear, and so do the door lanes and the middle.
const TC = 13, TR = 7;
const EVENTS = ['merchant', 'egg', 'altar', 'well', 'dummy', 'pool', 'explorer', 'challenge'];
const tileXY = (c, r) => [2 + c, 1.5 + r];
const tileAt = (x, y) => [Math.floor(x - 1.5), Math.floor(y - 1)];
const KEEP = [[6, 3], [6, 2], [6, 4], [5, 3], [7, 3], [6, 0], [6, 1], [6, 5], [6, 6], [0, 3], [1, 3], [11, 3], [12, 3]];
const solid = ch => ch === 'R' || ch === 'P';
// each template draws into the left half (c <= 6); the room is then mirrored left-right
const LAYOUTS = {
  pillars: (g, r) => { g(2, 1, 'R'); g(2, 5, 'R'); if (r() < 0.5) { g(4, 2, 'R'); g(4, 4, 'R'); } },
  scatter: (g, r) => { for (let i = 0; i < 2 + Math.floor(r() * 3); i++) g(1 + Math.floor(r() * 5), 1 + Math.floor(r() * 5), 'R'); },
  pitcorners: (g, r) => { g(0, 1, 'P'); g(1, 1, 'P'); g(0, 5, 'P'); g(1, 5, 'P'); if (r() < 0.5) { g(0, 2, 'P'); g(0, 4, 'P'); } },
  pitlines: (g, r) => { const c = 3 + Math.floor(r() * 2); for (const y of [1, 2, 4, 5]) g(c, y, 'P'); },
  moat: (g, r) => { for (let c = 4; c <= 6; c++) { g(c, 1, 'P'); g(c, 5, 'P'); } g(4, 2, 'P'); g(4, 4, 'P'); },
  spikefield: (g, r) => { for (let c = 2; c <= 5; c++) for (const y of [1, 5]) if ((c + y) % 2 === 0 || r() < 0.3) g(c, y, 'S'); },
  spikering: (g, r) => { g(5, 2, 'S'); g(5, 4, 'S'); g(4, 3, 'S'); if (r() < 0.5) { g(2, 2, 'R'); g(2, 4, 'R'); } },
  gauntlet: (g, r) => { for (const y of [1, 2, 4, 5]) g(3, y, 'R'); g(5, 2, 'S'); g(5, 4, 'S'); g(1, 1, 'S'); g(1, 5, 'S'); },
  mixed: (g, r) => { g(2, 2, 'R'); g(2, 4, 'P'); g(4, 1, 'S'); g(4, 5, 'S'); if (r() < 0.5) g(1, 5, 'P'); },
  open: () => {},
};
const LAYOUT_W = [
  // weights by floor: early floors are mostly rocks, deeper ones add pits and traps
  { pillars: 3, scatter: 4, pitcorners: 1, spikering: 1, open: 3 },
  { pillars: 3, scatter: 3, pitcorners: 2, pitlines: 1, spikefield: 2, spikering: 2, mixed: 1, open: 2 },
  { pillars: 2, scatter: 2, pitcorners: 2, pitlines: 2, moat: 2, spikefield: 2, spikering: 2, gauntlet: 2, mixed: 2, open: 1 },
];
function layout(r, floor, type) {
  const W = LAYOUT_W[Math.min(2, floor - 1)];
  const pool = type === 'lair' ? ['pillars', 'pitcorners', 'open'] : Object.keys(W);
  const name = type === 'lair' ? pick(r, pool) : weighted(r, pool, k => W[k]);
  const g = Array.from({ length: TR }, () => Array(TC).fill('.'));
  LAYOUTS[name]((c, y, ch) => { if (c >= 0 && c <= 6 && y >= 1 && y <= 5) { g[y][c] = ch; g[y][TC - 1 - c] = ch; } }, r);
  for (const [c, y] of KEEP) g[y][c] = '.';
  // every door lane must reach the middle; drop blocking tiles until it does
  for (let guard = 0; guard < 40 && !connected(g); guard++) {
    const blocks = [];
    for (let y = 0; y < TR; y++) for (let c = 0; c < TC; c++) if (solid(g[y][c])) blocks.push([c, y]);
    const [c, y] = pick(r, blocks); g[y][c] = '.'; g[y][TC - 1 - c] = '.';
  }
  return g.map(row => row.join('')).join('|');
}
function connected(g) {
  const seen = {}, q = [[6, 3]]; seen['6,3'] = 1;
  while (q.length) {
    const [c, y] = q.shift();
    for (const [dc, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const c2 = c + dc, y2 = y + dy;
      if (c2 < 0 || y2 < 0 || c2 >= TC || y2 >= TR || seen[c2 + ',' + y2] || solid(g[y2][c2])) continue;
      seen[c2 + ',' + y2] = 1; q.push([c2, y2]);
    }
  }
  return [[6, 0], [6, 6], [0, 3], [12, 3]].every(([c, y]) => seen[c + ',' + y]);
}
// ---- trainers (g14) ----------------------------------------------------------------------------
const ARCH = ['hiker', 'firebrand', 'tidecaller', 'bugcatcher', 'mystic', 'ace'];
// where a trainer stands and which way it looks (a second facing makes it turn every few seconds)
const TR_SPOTS = [[8, 2.5, 's', 'e'], [3.5, 4.5, 'e', 's'], [12.5, 4.5, 'w', 'n'], [8, 6.5, 'n', 'w']];
function makeTrainer(r, floor, arch, o) {
  o = o || {};
  const T = G.TRAINERS[arch], f = Math.min(4, floor - 1), K = TUNE;
  const tmax = Math.max(1, TMAX[f] + (T.tmaxOff || 0)), tmin = Math.max(1, TMIN[f] - 1);
  const all = Object.keys(G.SP);
  const fits = (k, el, role) => G.TIER[k] >= tmin && G.TIER[k] <= tmax && (!el || !T.els || T.els.includes(G.SP[k].el)) && (!role || !T.roles || T.roles.includes(G.SP[k].role));
  let pool;
  if (o.pool && o.pool.length) {   // the rival: built from the creatures you have unlocked, best tiers first
    const best = o.pool.filter(k => G.TIER[k] <= tmax + 1);
    pool = (best.length >= 3 ? best : o.pool).slice().sort((a, b) => G.TIER[b] - G.TIER[a]).slice(0, 10);
  } else {
    pool = all.filter(k => fits(k, 1, 1));
    if (pool.length < 3) pool = all.filter(k => fits(k, 1, 0));
    if (pool.length < 3) pool = all.filter(k => fits(k, 0, 0));
  }
  const n = (T.size ? T.size[f] : K.trSize[f]) + (o.extra || 0), bag = pool.slice().sort(() => r() - 0.5), team = [];
  for (let i = 0; i < n; i++) {
    let star = T.size ? (floor >= 4 && r() < 0.4 ? 2 : 1) : r() < K.trStar2[f] ? 2 : 1;
    if (T.allStar2 || o.captain || o.den) star = Math.max(2, star);
    if ((T.allStar2 || o.captain || o.rival) && floor >= 4 && r() < 0.3) star = 3;
    if (o.den && r() < 0.5) star = 3;
    team.push({ sp: bag[i % bag.length], star });
  }
  const battle = Object.keys(G.WILD_RELICS).filter(k => G.WILD_RELICS[k].b).sort(() => r() - 0.5);
  const relics = battle.slice(0, T.relics || (o.captain || o.den ? 2 : 1));
  const scale = K.trScale[f] * (o.captain ? 1.02 : 1) * (o.rival ? 1 + 0.06 * (o.level || 0) : 1) * (o.den ? 1.12 : 1);
  return { arch, team, relics, scale: +scale.toFixed(3), beaten: false, captain: !!o.captain, rival: !!o.rival, den: !!o.den };
}
// stand the trainer on one of the spots, clearing its tile so it never sits in a pit
function standTrainer(r, a) {
  const [x, y, face, turn] = pick(r, TR_SPOTS);
  Object.assign(a.tr, { x, y, face, turn: r() < 0.5 ? turn : null });
  if (!a.tiles) return;
  const g = a.tiles.split('|').map(row => row.split('')), c = Math.floor(x - 1.5), yy = Math.floor(y - 1);
  if (g[yy] && g[yy][c]) g[yy][c] = '.';
  a.tiles = g.map(row => row.join('')).join('|');
}
// floor 6, the Rival's Den: a short hall, a shrine, then Jax at full strength
function genDen(seed, o) {
  const r = rng(seed), c = Math.floor(GRID / 2), rooms = {};
  const mk = (x, y, type, extra) => (rooms[key(x, y)] = Object.assign({ x, y, type, visited: false, seen: true, mon: null, item: null, used: false, rocks: [], tiles: null }, extra));
  mk(c, c, 'start', { item: 'tonic', visited: true });
  mk(c, c - 1, 'shrine', { item: 'shrine', tiles: layout(r, 3, 'shrine') });
  const den = mk(c, c - 2, 'trainer', { tiles: layout(r, 3, 'lair') });
  den.tr = makeTrainer(r, 5, 'rival', { rival: 1, den: 1, pool: o.pool, level: 3, extra: 2 });
  Object.assign(den.tr, { x: 8, y: 2.5, face: 's', turn: null });
  return { rooms, cur: key(c, c), freeKey: false };
}
function genFloor(floor, biome, seed, unlocked, o) {
  o = o || {};
  LURE.el = o.lure || null;
  const r = rng(seed);
  const n = Math.min(14, 8 + floor);   // room for the specials, events and a trainer   // room for the specials, two events and the wild rooms
  const rooms = {};
  const nb = (x, y) => Object.keys(DIRS).filter(d => rooms[key(x + DIRS[d][0], y + DIRS[d][1])]);
  const add = (x, y, type) => (rooms[key(x, y)] = { x, y, type, visited: false, seen: false, mon: null, item: null, used: false, rocks: [], tiles: null });
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
  // event rooms: one or two a floor, in spare dead ends first, then in quiet rooms
  const spare = dead.slice(4).filter(a => a.type === 'normal'), quiet = normal.filter(a => !a.mon && !a.item);
  const evs = EVENTS.slice().sort(() => r() - 0.5);
  for (let i = 0, n = 1 + (r() < 0.35 + 0.12 * floor ? 1 : 0); i < n; i++) {
    const a = spare.shift() || quiet.shift() || normal.filter(x => x.type === 'normal' && !x.item).slice(-1)[0];
    if (!a) break;
    Object.assign(a, { type: 'event', event: evs[i], item: 'event', mon: null });
    if (a.event === 'challenge') { a.cmon = makeMon(r, floor, els, 'lair', used, unlocked); a.cmon.scale = +(a.cmon.scale * 0.95).toFixed(3); }
  }
  // a trainer on every floor, floor captains (2 and 4) guarding the treasure, and the rival once an expedition
  const plain = () => normal.filter(a => a.type === 'normal' && !a.item);
  const trRoom = () => { const q = plain(); const t = q.find(a => !a.mon) || q[q.length - 1] || normal.find(a => a.type === 'normal' && a.item === 'berry'); if (t) t.item = null; return t; };
  const archs = ARCH.slice().sort(() => r() - 0.5);
  { const a = trRoom(); if (a) Object.assign(a, { type: 'trainer', mon: null, tr: makeTrainer(r, floor, archs[0]) }); }
  if (o.rival) { const a = trRoom(); if (a) Object.assign(a, { type: 'trainer', mon: null, tr: makeTrainer(r, floor, 'rival', { rival: 1, pool: o.rival.pool, level: o.rival.level, extra: 1 }) }); }
  if ((floor === 2 || floor === 4) && dead[2] && dead[2].type === 'treasure') dead[2].tr = makeTrainer(r, floor, archs[1], { captain: 1 });
  // every floor has at least one way to heal: a shrine, and a Glim Tonic to carry
  if (!Object.values(rooms).some(a => a.item === 'shrine')) {
    const all = Object.values(rooms), plain = normal.filter(a => a.type === 'normal');
    const sh = plain.find(a => !a.item && !a.mon) || plain.find(a => !a.item) || plain.find(a => a.item === 'berry')
      || all.find(a => a.type === 'treasure') || all.filter(a => a.type === 'event').pop();
    if (sh) Object.assign(sh, { type: 'shrine', item: 'shrine', mon: null, event: null, cmon: null });
  }
  rooms[key(c, c)].item = 'tonic';
  // the vault's key goes in a plain room; on a crowded floor it replaces berries, else you start with it
  let freeKey = false;
  if (dead[1]) {
    let spots = normal.filter(a => a.type === 'normal' && !a.item);
    if (!spots.length) spots = normal.filter(a => a.type === 'normal' && a.item === 'berry');
    if (spots.length) pick(r, spots).item = 'key'; else freeKey = true;
  }
  for (const a of Object.values(rooms)) if (a.mon) a.mon.shiny = r() < (o.shiny || 0) * ((o.shinyBoost || {})[a.mon.sp] ? 4 : 1);
  for (const a of Object.values(rooms)) if (a.type !== 'start') a.tiles = layout(r, floor, a.type === 'lair' ? 'lair' : a.type);
  for (const a of Object.values(rooms)) if (a.tr) standTrainer(r, a);
  rooms[key(c, c)].visited = true;
  return { rooms, cur: key(c, c), freeKey };
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
root.GW = { ARCH, makeTrainer, genDen, EVENTS, makeMon, TC, TR, tileXY, tileAt, solid, layout, TUNE, FLOORS, SQUAD_START, SQUAD_MAX, GRID, XP_STAR, DIRS, rng, pick, key, genFloor, placeSide };
})(typeof window !== 'undefined' ? window : globalThis);
