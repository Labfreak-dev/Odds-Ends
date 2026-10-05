// Glimmerdeep real-time arena. Pure logic, no DOM: game.js steps a fight with
// tick() when ?arena=1 is set; sim.js does the same with ARENA=1. chess.js is
// unchanged and still owns the fight when the flag is off.
// Contracts: glimmerdeep/ARENA_SPEC.md
(function (root) {
'use strict';
const G = root.GD;
const GC = root.GC;
const AW = 960, AH = 600, CELL = 120, HZ = 30, DT = 1 / 30, TIME_LIMIT = 60, EV = 2;
const W = 8, H = 5, RADIUS = 26, MISTAKE = 0.08;
if (!G || !GC) {
  root.GArena = { create: function () { throw new Error('GArena needs GD and GC'); } };
  return;
}
function manaCost(id) { return GC.manaCost(id); }
function castables(inst) { return GC.castables(inst); }

const ROLE_TAC = {
  striker: { stance: 'aggressive', spacing: 'close', focus: 'closest', ff: 'calculated', aoe: 'natural' },
  caster: { stance: 'cautious', spacing: 'loose', focus: 'backline', ff: 'avoid', aoe: '2' },
  tank: { stance: 'defensive', spacing: 'tight', focus: 'closest', ff: 'avoid', aoe: 'natural' },
  support: { stance: 'behind', spacing: 'balanced', focus: 'healers', ff: 'avoid', aoe: 'natural' },
  boss: { stance: 'pursue', spacing: 'balanced', focus: 'threat', ff: 'calculated', aoe: '2' },
};
const TAC_OK = {
  stance: ['aggressive', 'pursue', 'balanced', 'cautious', 'behind', 'defensive'],
  spacing: ['tight', 'close', 'balanced', 'loose'],
  focus: ['closest', 'lowest', 'healers', 'backline', 'threat'],
  ff: ['avoid', 'calculated', 'dodge'],
  aoe: ['natural', '2', '3'],
};
function tacticOf(instOrUnit) {
  const inst = instOrUnit && instOrUnit.inst ? instOrUnit.inst : (instOrUnit || {});
  const role = (instOrUnit && instOrUnit.role) || (inst.boss ? 'boss' : (inst.sp && G.SP[inst.sp] ? G.SP[inst.sp].role : 'striker'));
  const d = ROLE_TAC[role] || ROLE_TAC.striker;
  const src = inst.tactic || {};
  const out = {};
  for (const k in TAC_OK) out[k] = TAC_OK[k].indexOf(src[k]) >= 0 ? src[k] : d[k];
  return out;
}

const CIRCLE_IDS = ['magma_surge', 'solar_flare', 'tidal_wave', 'blossom', 'mycelium', 'thunderclap', 'tectonic', 'eclipse', 'spore_storm', 'eruption', 'tidal_coil', 'static_field', 'hex_gaze', 'cyclone', 'dune_quake', 'rot_spores', 'boiler_burst', 'hurricane', 'slag_wave', 'lure_glow', 'glacier_breath', 'dread_roar', 'grave_slam', 'nebula_nova', 'singularity', 'cataclysm', 'flux_breath'];
const DASH_IDS = ['pounce', 'void_rend', 'burrow_strike', 'maw_crunch', 'volt_dash'];
const CHAIN_IDS = ['chain', 'storm_swarm', 'moonveil', 'shard_volley', 'avalanche', 'thorn_volley', 'galaxy_dust', 'triple_breath', 'mirror_storm', 'rivet_storm', 'soul_lanterns', 'prism_barr'];
const LINE_IDS = ['crystal_beam', 'riddle_beam', 'star_crush', 'moonbeam', 'thunderhead'];
const SUMMON_IDS = ['sprout_call', 'yeti_call', 'squall_call', 'sand_call', 'croc_call', 'moth_call', 'beetle_call', 'gale_call', 'bat_call', 'abyss_call', 'ant_call', 'wisp_call', 'cosmic_call'];
const WALL_IDS = ['reef_fort', 'stone_wall', 'bubble_wall'];
const NAMED = {};
CIRCLE_IDS.concat(DASH_IDS, CHAIN_IDS, LINE_IDS, SUMMON_IDS, WALL_IDS).forEach(id => { NAMED[id] = 1; });

function baseShape(sk) {
  const t = sk.t || 'foe';
  const ult = !!sk.ult;
  if (sk.fx && sk.fx.summon) return { shape: 'summon', anchor: 'self', cast: 0.5, channel: 0, cd: 0, friendly: true, telegraph: 0.5 };
  if (t === 'self') return { shape: 'buff', anchor: 'self', cast: 0.4, channel: 0, cd: 0, friendly: true, telegraph: 0.4 };
  if (t === 'ally') return { shape: 'projectile', anchor: 'target', cast: 0.45, channel: 0, cd: 0, speed: 480, radius: 12, pierce: 0, life: 1.8, homing: 1, friendly: true, telegraph: 0.45 };
  if (t === 'allies') return { shape: 'circle', anchor: 'self', cast: ult ? 0.9 : 0.6, channel: 0, cd: 0, aoe: 220, friendly: true, telegraph: ult ? 0.9 : 0.6 };
  if (t === 'lowfoe') return { shape: 'dash', anchor: 'target', cast: 0.35, channel: 0, cd: 0, telegraph: 0.35 };
  if (t === 'foes') return { shape: 'circle', anchor: 'ground', cast: ult ? 1 : 0.65, channel: 0, cd: 0, aoe: ult ? 220 : 150, telegraph: ult ? 1 : 0.65 };
  if (/^foe\d$/.test(t)) return { shape: 'chain', anchor: 'target', cast: ult ? 0.9 : 0.5, channel: 0, cd: 0, hits: +t.slice(3), length: 180, telegraph: ult ? 0.9 : 0.5 };
  if (sk.rng) return { shape: 'projectile', anchor: 'target', cast: ult ? 0.7 : 0.4, channel: 0, cd: 0, speed: 460, radius: 14, pierce: 0, life: 1.6, homing: 0, telegraph: ult ? 0.7 : 0.4 };
  return { shape: 'melee', anchor: 'target', cast: 0.28, channel: 0, cd: 0, telegraph: 0.28 };
}
function roleOfSkill(sk) {
  const id = sk.id || '';
  if (id.slice(-2) === '_u' && G.SP[id.slice(0, -2)]) return G.SP[id.slice(0, -2)].role;
  for (const k in G.SP) {
    const S = G.SP[k];
    if (S.sk && S.sk.indexOf(id) >= 0) return S.role;
  }
  return null;
}
function roleUlt(sk, role) {
  if (role === 'striker') {
    const sp = sk.id.slice(-2) === '_u' ? G.SP[sk.id.slice(0, -2)] : null;
    if (sk.rng || (sp && sp.range > 1)) return { shape: 'projectile', anchor: 'target', cast: 0.7, channel: 0, cd: 0, speed: 500, radius: 16, pierce: 0, life: 1.6, homing: 0, telegraph: 0.7, hand: true };
    return { shape: 'dash', anchor: 'target', cast: 0.7, channel: 0, cd: 0, telegraph: 0.7, hand: true };
  }
  if (role === 'caster') return { shape: 'circle', anchor: 'ground', cast: 1, channel: 0, cd: 0, aoe: 240, telegraph: 1, hand: true };
  if (role === 'tank') return { shape: 'cone', anchor: 'muzzle', cast: 0.85, channel: 0, cd: 0, length: 260, arc: 1.2, telegraph: 0.85, hand: true };
  if (role === 'support') return { shape: 'circle', anchor: 'self', cast: 0.9, channel: 0, cd: 0, aoe: 240, friendly: true, telegraph: 0.9, hand: true };
  return null;
}
function resolveShape(sk) {
  let s = baseShape(sk);
  if (sk.ult && !NAMED[sk.id]) {
    const ru = roleUlt(sk, roleOfSkill(sk));
    if (ru) s = ru;
  }
  if (CIRCLE_IDS.indexOf(sk.id) >= 0) s = { shape: 'circle', anchor: 'ground', cast: 1, channel: 0, cd: 0, aoe: 230, telegraph: 1, hand: true };
  else if (DASH_IDS.indexOf(sk.id) >= 0) s = { shape: 'dash', anchor: 'target', cast: 0.3, channel: 0, cd: 0, telegraph: 0.3, hand: true };
  else if (CHAIN_IDS.indexOf(sk.id) >= 0) s = { shape: 'chain', anchor: 'target', cast: sk.ult ? 0.9 : 0.55, channel: 0, cd: 0, hits: /^foe\d$/.test(sk.t) ? +sk.t.slice(3) : 3, length: 180, telegraph: sk.ult ? 0.9 : 0.55, hand: true };
  else if (LINE_IDS.indexOf(sk.id) >= 0) s = { shape: 'line', anchor: 'muzzle', cast: 0.7, channel: 0, cd: 0, length: 520, width: 28, telegraph: 0.7, hand: true };
  else if (SUMMON_IDS.indexOf(sk.id) >= 0) s = { shape: 'summon', anchor: 'self', cast: 0.5, channel: 0, cd: 0, friendly: true, telegraph: 0.5, hand: true };
  else if (WALL_IDS.indexOf(sk.id) >= 0) s = { shape: 'circle', anchor: 'self', cast: 0.7, channel: 0, cd: 0, aoe: 240, friendly: true, telegraph: 0.7, hand: true };
  s.id = sk.id;
  s.t = sk.t;
  s.channel = s.channel || 0;
  s.cd = s.cd || 0;
  s.hand = !!s.hand;
  return s;
}
const SHAPES = {};
function skillShape(id) {
  if (!SHAPES[id] && G.SK[id]) SHAPES[id] = resolveShape(G.SK[id]);
  return SHAPES[id] || baseShape({ id: id, t: 'foe' });
}
for (const id in G.SK) SHAPES[id] = resolveShape(G.SK[id]);

function nextId(st) {
  let m = 1;
  for (const u of st.units) if (u.id >= m) m = u.id + 1;
  return m;
}
function clampBody(u) {
  const r = u.radius || RADIUS;
  if (!u.pos) u.pos = { x: AW / 2, y: AH / 2 };
  if (!Number.isFinite(u.pos.x) || !Number.isFinite(u.pos.y)) {
    u.pos.x = u.prev && Number.isFinite(u.prev.x) ? u.prev.x : AW / 2;
    u.pos.y = u.prev && Number.isFinite(u.prev.y) ? u.prev.y : AH / 2;
    if (u.vel) u.vel.x = u.vel.y = 0;
  }
  if (u.pos.x < r) u.pos.x = r;
  if (u.pos.y < r) u.pos.y = r;
  if (u.pos.x > AW - r) u.pos.x = AW - r;
  if (u.pos.y > AH - r) u.pos.y = AH - r;
}
function dress(st, u) {
  const jx = (st.jitter() - 0.5) * 36;
  const jy = (st.jitter() - 0.5) * 36;
  u.pos = { x: (u.x + 0.5) * CELL + jx, y: (u.y + 0.5) * CELL + jy };
  u.prev = { x: u.pos.x, y: u.pos.y };
  u.vel = { x: 0, y: 0 };
  u.facing = u.side === 0 ? 1 : -1;
  u.radius = RADIUS * (u.boss ? 1.35 : (u.star >= 3 ? 1.12 : 1));
  u.state = 'idle';
  u.tactic = tacticOf(u);
  u.threat = u.threat || 0;
  u.castCd = u.castCd || 0;
  clampBody(u);
}
function create(o) {
  const st = GC.create(o || {});
  st.jitter = GC.mkRng((((o && o.seed) || 1) ^ 0xA11A5EED) >>> 0);
  st.projs = [];
  st.telegraphs = [];
  st.n = 0;
  st.evVer = EV;
  st.engine = 'arena';
  st.pid = 1;
  for (const u of st.units) dress(st, u);
  return st;
}

const alive = (st, side) => st.units.filter(u => u.alive && u.side === side);
const byId = (st, id) => st.units.find(u => u.id === id);
const pct = u => u.hp / u.maxHp;
const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
function euclid(a, b) {
  const dx = a.pos.x - b.pos.x, dy = a.pos.y - b.pos.y;
  return Math.hypot(dx, dy);
}

// ---- combat math ported from chess.js (hit/damage/status/traits/perks/relics) ----
function buffV(u, k) { const s = u.st[k]; return s ? s.v : 0; }
function occupied(st, x, y) { return st.units.some(u => u.alive && u.x === x && u.y === y); }
function effAtk(st, u) {
  const b = st.bonus[u.side];
  let a = u.b.atk * (1 + buffV(u, 'atkUp') + (b.kin || 0));
  if (u.front && b.frontAtk) a *= 1 + b.frontAtk;
  if (b.shieldAtk && u.shield > 0) a *= 1 + b.shieldAtk;
  if (u.elite === 'enraged' && pct(u) < 0.5) a *= 1.35;
  if (b.openAtk && st.t < 5) a *= 1 + b.openAtk;
  if (b.lastStand && alive(st, u.side).length === 1) a *= 1 + b.lastStand;
  return a;
}
function effDef(st, u) {
  const b = st.bonus[u.side];
  let d = u.b.def * (1 + buffV(u, 'defUp') + (b.kin || 0) + (b.defMul2 || 0));
  if (u.front && b.frontDef) d *= 1 + b.frontDef;
  if (b.voltDef && u.el === 'volt') d *= 1 + b.voltDef;
  if (u.st.shred) d *= 0.75;
  return d;
}
// Gale Feather and the Storm set store SPD as spdMul. Cap the bonus at +100%; attack rate itself stays at most 3.
function spdBonus(b) {
  const n = b && +b.spdMul;
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(1, n);
}
function effAS(st, u) {
  const b = st.bonus[u.side];
  let s = u.b.as * (1 + buffV(u, 'spdUp') + (b.asMul || 0) + spdBonus(b) + (b.kin || 0) + (st.tempoUntil > st.t && u.side === 0 ? 0.3 : 0) + (u.enraged ? 0.5 : 0));
  if (u.st.chill) s *= 0.7;
  return Math.min(3, s);
}
function manaNeed(st, u) {
  const b = st.bonus[u.side];
  const mag = st.haz === 'magnetic' && u.side === 0 && u.el !== 'metal' && !b.immune_magnetic ? 1.25 : 1;
  return manaCost(u.skill) * Math.max(0.5, 1 - (b.manaDisc || 0) - u.b.manaDisc) * (u.st.hex ? 1.25 : 1) * mag;
}
function gainMana(st, u, v) {
  if (!u.alive) return;
  u.mana = Math.min(150, u.mana + v * u.b.od * (1 + (st.bonus[u.side].odRate || 0)));
}

// ---- targeting and movement -------------------------------------------------------------------
function acquire(st, u) {
  const foes = alive(st, 1 - u.side);
  if (!foes.length) return null;
  const taunt = foes.filter(e => e.st.taunt && dist(u, e) <= u.range + 2);
  if (taunt.length) return taunt.sort((a, b) => dist(u, a) - dist(u, b))[0];
  const cur = u.tgt && byId(st, u.tgt);
  if (cur && cur.alive && dist(u, cur) <= u.range) return cur;
  let best = null, bv = 1e9;
  for (const e of foes) {
    const v = dist(u, e) * 10 + pct(e) * 3 + st.rnd();
    if (v < bv) { bv = v; best = e; }
  }
  u.tgt = best.id;
  return best;
}
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
// one step along a shortest path to any free cell within range of the target
function step(st, u, t, ev) {
  const key = (x, y) => x + ',' + y;
  const seen = new Set([key(u.x, u.y)]);
  let q = [[u.x, u.y, null]];
  while (q.length) {
    const nq = [];
    for (const [x, y, first] of q) {
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy, k = key(nx, ny);
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen.has(k)) continue;
        seen.add(k);
        if (occupied(st, nx, ny)) continue;
        const f = first || [nx, ny];
        if (Math.max(Math.abs(nx - t.x), Math.abs(ny - t.y)) <= u.range) { moveTo(u, f[0], f[1], ev); return true; }
        nq.push([nx, ny, f]);
      }
    }
    q = nq;
  }
  // boxed in: shuffle toward the target if any neighbour gets closer
  let best = null, bd = dist(u, t);
  for (const [dx, dy] of DIRS) {
    const nx = u.x + dx, ny = u.y + dy;
    if (nx < 0 || ny < 0 || nx >= W || ny >= H || occupied(st, nx, ny)) continue;
    const d = Math.max(Math.abs(nx - t.x), Math.abs(ny - t.y));
    if (d < bd) { bd = d; best = [nx, ny]; }
  }
  if (best) { moveTo(u, best[0], best[1], ev); return true; }
  return false;
}
function moveTo(u, x, y, ev) {
  if (u.pos) {
    u.pos.x += (x - u.x) * CELL;
    u.pos.y += (y - u.y) * CELL;
  }
  u.x = x; u.y = y;
  ev.push({ k: 'move', u: u.id, x, y });
}
function freeCellNear(st, x, y) {
  for (let r = 1; r < 8; r++) {
    const opts = [];
    for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
      const nx = x + dx, ny = y + dy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || nx < 0 || ny < 0 || nx >= W || ny >= H || occupied(st, nx, ny)) continue;
      opts.push([nx, ny]);
    }
    if (opts.length) return opts[Math.floor(st.rnd() * opts.length)];
  }
  return null;
}

// ---- effects ------------------------------------------------------------------------------------
function giveShield(st, src, t, frac, ev, silent) {
  const amp = 1 + (st.bonus[src.side].shieldAmp || 0);
  const v = Math.round(t.maxHp * frac * amp);
  t.shield = Math.min(t.maxHp, t.shield + v);
  if (st.fs) root.FightStats.shield(st, src, t, v);
  if (!silent) ev.push({ k: 'shield', t: t.id, v, sh: t.shield });
}
function heal(st, src, t, frac, ev, flat, quiet) {
  if (!t.alive) return 0;
  const b = st.bonus[t.side];
  let v = flat != null ? flat : t.maxHp * frac * (1 + (b.healAmp || 0));
  if (t.st.burn) v *= 0.5;
  v = Math.round(v);
  if (v <= 0) return 0;
  const room = t.maxHp - t.hp, got = Math.min(room, v);
  t.hp += got;
  if (v > room && b.overheal) t.shield = Math.min(t.maxHp, t.shield + (v - room));
  if (st.fs && (got > 0 || v > room)) root.FightStats.heal(st, src, t, got, Math.max(0, v - room));
  if (got > 0 || !quiet) ev.push({ k: 'heal', t: t.id, v: got, hp: t.hp, sh: t.shield, quiet: !!quiet });
  return got;
}
const DEBUFFS = ['burn', 'poison', 'soak', 'stun', 'root', 'curse', 'blind', 'chill', 'shred', 'hex'];
function cleanse(t, ev) {
  let any = false;
  for (const k of DEBUFFS) if (t.st[k]) { delete t.st[k]; any = true; }
  if (any) ev.push({ k: 'cleanse', t: t.id });
}
// durations are seconds
function applyStatus(st, src, t, key, ev, secs, n) {
  if (!t.alive) return;
  const sb = src ? st.bonus[src.side] : {}, tb = st.bonus[t.side];
  const extra = (sb.statusTurns || 0) * 1.5;
  if (key === 'burn') {
    let dur = 4 + (sb.burnTurns || 0) * 1.5 + extra;
    if (tb.immune_heat) dur = 1.5;
    const dmg = Math.max(1, Math.round((src ? effAtk(st, src) : t.maxHp * 0.03) * 0.3 * (1 + (sb.burnAmp || 0))));
    t.st.burn = { t: dur, v: Math.max(dmg, t.st.burn ? t.st.burn.v : 0), src: src ? src.id : null };
  } else if (key === 'poison') {
    const add = (n || 1) + (sb.poisonPlus || 0);
    const per = Math.max(1, Math.round((src ? effAtk(st, src) : t.maxHp * 0.015) * 0.1));
    const cur = t.st.poison || { n: 0, v: per };
    t.st.poison = { n: Math.min(10, cur.n + add), v: Math.max(cur.v, per), src: src ? src.id : null };
  } else if (key === 'stun') {
    if (tb.stunImmune || t.st.stunImm) return;
    t.st.stun = { t: t.boss ? 0.75 : 1.5 };
    t.st.stunImm = { t: (t.boss ? 0.75 : 1.5) + 2 };
  } else if (key === 'blind') {
    if (t.side === 0 && tb.immune_dark) return;
    t.st.blind = { t: (secs || 3) + extra };
  } else if (key === 'soak') t.st.soak = { t: (secs || 4) + extra };
  else if (key === 'root') t.st.root = { t: 2.5 + extra };
  else if (key === 'chill') { if (t.side === 0 && tb.immune_blizzard) return; t.st.chill = { t: (secs || 3) + extra }; }
  else if (key === 'shred') t.st.shred = { t: 4 + extra };
  else if (key === 'hex') t.st.hex = { t: 5 + extra };
  else if (key === 'curse') t.st.curse = { t: 5 + extra };
  else return;
  if (src && src.perk && src.perk.kind === 'venom' && t.st[key] && t.st[key].t != null && t.st[key].t < 1e8) t.st[key].t *= src.perk.l > 1 ? 2 : 1.5;
  if (st.fs) root.FightStats.status(st, src, t, key, t.st[key] && t.st[key].t);
  ev.push({ k: 'status', t: t.id, s: key });
}
const STATUS_KEYS = ['burn', 'poison', 'soak', 'stun', 'root', 'curse', 'blind', 'chill', 'shred', 'hex'];

// ---- damage ---------------------------------------------------------------------------------------
// o: {basic, single, powMul, el, noReact, noMiss, exec, chained}
function hit(st, a, d, sk, ev, o) {
  o = o || {};
  if (!d.alive || !a.alive) return 0;
  const ab = st.bonus[a.side], db = st.bonus[d.side];
  const el = o.el || (sk.el === 'flux' ? a.el : sk.el);
  let miss = 0;
  if (a.st.blind) miss += 0.35;
  if (st.haz === 'dark' && a.side === 0 && a.el !== 'shade' && !ab.immune_dark && st.litUntil < st.t) miss += 0.25;
  const dodge = buffV(d, 'dodge') + (db.dodge || 0) + (d.auraDodge || 0) + (d.el === 'shade' ? (db.shadeDodge || 0) : 0);
  if (!o.noMiss && st.rnd() < miss + dodge * (1 - miss)) {
    ev.push({ k: 'miss', t: d.id, a: a.id, dodge: dodge > miss });
    if (st.fs && dodge > miss) root.FightStats.dodge(st, d);
    return 0;
  }
  if (el === 'ember' && st.haz === 'dark') st.litUntil = st.t + 2;
  const A = effAtk(st, a), D = effDef(st, d);
  const pow = o.basic ? (o.powMul || 1) : (sk.pow || 0) / 100 * 1.6 * (o.powMul || 1) * (1 + (ab.skillAmp || 0));
  let dmg = A * pow * (A / (A + 0.65 * D));
  const ef = G.eff(el, d.el);
  dmg *= ef;
  if (el === a.el || el === a.el2) dmg *= 1.2;
  dmg *= 1 + (ab['el_' + el] || 0) + (a.charmEl === el ? 0.25 : 0) + (ab.dmgMul || 0) + (ab.monoOn || 0) + (sk.ult ? (ab.ultAmp || 0) : 0);
  if (d.st.curse) dmg *= 1.15 + (ab.curseAmp || 0);
  if (d.st.chill && ab.chillAmp) dmg *= 1 + ab.chillAmp;
  if (db.dr) dmg *= 1 - db.dr;
  if (d.bossDR) dmg *= 1 - d.bossDR;
  if (d.auraDR) dmg *= 1 - d.auraDR;
  if (a.perk && a.perk.kind === 'executioner' && pct(d) < 0.4) dmg *= a.perk.l > 1 ? 1.5 : 1.3;
  if (a.perk && a.perk.kind === 'hunter' && a.kills) dmg *= 1 + Math.min(5, a.kills) * (a.perk.l > 1 ? 0.15 : 0.08);
  { let g = 0; for (const m of st.units) if (m.alive && m !== d && m.side === d.side && m.perk && m.perk.kind === 'guardian' && dist(m, d) <= 1) g = Math.max(g, m.perk.l > 1 ? 0.2 : 0.1); if (g) dmg *= 1 - g; }
  const soaked = d.st.soak || d.st.wet;
  if (soaked && ab.soakAmp) dmg *= 1 + ab.soakAmp;
  if (el === 'ember' && st.haz === 'flood' && a.st.wet) dmg *= 0.6;
  let react = null, forceCrit = false, blight = 0, doom = false;
  if (!o.noReact) {
    if (el === 'volt' && soaked) {
      react = 'Electrocute'; dmg *= 1.5 * (1 + (ab.electroAmp || 0));
      if (d.st.soak) delete d.st.soak;
      if (st.rnd() < (d.st.wet ? 0.25 : 0.5) * (d.boss ? 0.5 : 1)) applyStatus(st, a, d, 'stun', ev);
    } else if (el === 'tide' && d.st.burn) {
      react = 'Steam'; dmg *= 1.3; delete d.st.burn; applyStatus(st, a, d, 'blind', ev);
      if (ab.steamHeal) for (const f of alive(st, a.side)) heal(st, a, f, ab.steamHeal, ev);
    } else if (el === 'ember' && d.st.poison) {
      react = 'Blight Burst'; blight = d.st.poison.n; delete d.st.poison;
    } else if (el === 'stone' && d.st.root) {
      react = 'Shatter'; forceCrit = true; dmg *= 1.3 * (1 + (ab.shatterAmp || 0)); delete d.st.root;
    } else if (el === 'frost' && soaked) {
      react = 'Freeze'; dmg *= 1.3; if (d.st.soak) delete d.st.soak;
      applyStatus(st, a, d, 'stun', ev); applyStatus(st, a, d, 'chill', ev, 4);
    } else if (el === 'gale' && d.st.burn) {
      react = 'Firestorm'; dmg *= 1.3;
      const burn = d.st.burn;
      for (const e of alive(st, d.side)) if (e !== d && dist(e, d) <= 1) { e.st.burn = { t: burn.t, v: Math.max(burn.v, e.st.burn ? e.st.burn.v : 0), src: burn.src }; ev.push({ k: 'status', t: e.id, s: 'burn' }); }
    } else if (el === 'ember' && d.st.soak && !d.st.wet) {
      react = 'Fizzle'; dmg *= 0.7; delete d.st.soak;
    } else if (el === 'shade' && d.st.curse && pct(d) < 0.25 && !d.boss) {
      react = 'Doom'; doom = true;
    }
    if (react) ev.push({ k: 'react', t: d.id, name: react });
  }
  const cc = a.b.crit + (sk.crit || 0) + (ab.crit || 0) + buffV(a, 'critUp');
  const crit = forceCrit || o.crit || (ab.firstCrit && a.firstAtk) || st.rnd() < cc;
  a.firstAtk = false;
  if (crit) dmg *= 1 + a.b.critDmg + (ab.critDmg || 0);
  dmg *= 0.92 + st.rnd() * 0.16;
  if (d.back && db.backDR) dmg *= 1 - db.backDR;
  if (o.exec && pct(d) < o.exec && !d.boss) doom = true;
  dmg = Math.max(1, Math.round(dmg));
  if (doom) dmg = Math.max(dmg, d.hp + d.shield);
  if (o.single && db.mirror && st.rnd() < db.mirror && !o.noReact && !o.basic) {
    ev.push({ k: 'react', t: d.id, name: 'Mirrored' });
    return damage(st, d, a, dmg, ev, { crit, eff: 1 });
  }
  const dealt = damage(st, a, d, dmg, ev, { crit, eff: ef, el, basic: o.basic });
  if (crit && ab.critCurse) applyStatus(st, a, d, 'curse', ev);
  if (crit && ab.critGold && a.side === 0 && st.goldBonus < 5) st.goldBonus += ab.critGold;
  const ls = a.b.ls + (ab.lifesteal || 0) + (sk.ls || 0);
  if (ls > 0 && dealt > 0) heal(st, a, a, 0, ev, dealt * ls, true);
  if (ab.tideHeal && el === 'tide' && dealt > 0) {
    const w = alive(st, a.side).sort((x, y) => pct(x) - pct(y))[0];
    if (w) heal(st, a, w, 0, ev, dealt * ab.tideHeal, true);
  }
  if (d.b.thorns > 0 && dealt > 0 && a.alive) damage(st, d, a, Math.max(1, Math.round(dealt * d.b.thorns)), ev, { thorn: 1 });
  if (d.reflect && o.single && dealt > 0 && a.alive) damage(st, d, a, Math.max(1, Math.round(dealt * d.reflect)), ev, { thorn: 1, reflect: 1 });
  if (db.reflectAll && dealt > 0 && a.alive) damage(st, d, a, Math.max(1, Math.round(dealt * db.reflectAll)), ev, { thorn: 1 });
  if (o.single && st.haz === 'reflect' && d.side === 1 && a.side === 0 && !ab.immune_reflect && dealt > 0 && a.alive)
    damage(st, d, a, Math.max(1, Math.round(dealt * 0.2)), ev, { thorn: 1, reflect: 1 });
  if (blight) {
    const per = (1 + (ab.blightAmp || 0)) * 0.04;
    for (const e of alive(st, d.side)) damage(st, a, e, Math.max(1, Math.round(e.maxHp * per * blight * (e.boss ? 0.35 : 1))), ev, { dot: 'blight' });
  }
  if (ab.voltChain && el === 'volt' && o.single && !o.chained) {
    const other = alive(st, d.side).filter(e => e !== d && dist(e, d) <= 2)[0];
    if (other) { ev.push({ k: 'zap', a: d.id, t: other.id }); hit(st, a, other, sk, ev, Object.assign({}, o, { powMul: (o.powMul || 1) * ab.voltChain, chained: true, noReact: true, noMiss: true })); }
  }
  return dealt;
}
function damage(st, a, d, v, ev, info) {
  if (!d.alive) return 0;
  info = info || {};
  const hp0 = d.hp;
  const toShield = Math.min(d.shield, v);
  d.shield -= toShield;
  const rest = v - toShield;
  if (toShield > 0 && st.bonus[d.side].thorns && a && a.alive && !info.thorn)
    damage(st, d, a, Math.max(1, Math.round(toShield * st.bonus[d.side].thorns)), ev, { thorn: 1 });
  d.hp -= rest;
  let fsAtk = null;
  if (st.fs) {
    const hpLoss = Math.min(rest, Math.max(0, hp0));
    const eff = toShield + hpLoss;
    if (a && info.basic && !info.dot && !info.thorn) {
      fsAtk = a;
      root.FightStats.basicHit(st, a, d, eff, v - eff, hpLoss, toShield);
    } else {
      fsAtk = a || (info.src == null ? null : root.FightStats.by(st, info.src));
      root.FightStats.dmg(st, fsAtk, d, eff, v - eff, toShield, hpLoss, !!info.basic, info.dot || null, !!info.thorn);
    }
  }
  if (d.hp <= 0 && d.b.grit && !d.gritUsed) { d.hp = 1; d.gritUsed = true; ev.push({ k: 'react', t: d.id, name: 'Grit!' }); }
  ev.push({ k: 'dmg', t: d.id, a: a ? a.id : null, v, crit: !!info.crit, eff: info.eff || 1, hp: Math.max(0, d.hp), sh: d.shield,
    dot: info.dot || null, thorn: !!info.thorn, basic: !!info.basic, el: info.el || null });
  if (a && d && a !== d && !info.dot && !info.thorn) a.threat = (a.threat || 0) + v;
  if (d.hp > 0 && d.hp < d.maxHp * 0.3 && !d.swUsed && st.bonus[d.side].lowHeal) {
    d.swUsed = true;
    heal(st, d, d, st.bonus[d.side].lowHeal, ev);
  }
  if (a && a !== d && !info.dot && !info.thorn) gainMana(st, d, Math.min(15, 3 + 15 * v / d.maxHp));
  if (d.perk && d.perk.kind === 'bulwark' && !d.bulwarkUsed && d.hp > 0 && d.hp < d.maxHp / 2) {
    d.bulwarkUsed = true; giveShield(st, d, d, d.perk.l > 1 ? 0.4 : 0.25, ev); ev.push({ k: 'perk', a: d.id, t: d.id, n: 'Last Stand', el: d.el });
  }
  if (d.boss && !d.enraged && d.hp > 0 && d.hp < d.maxHp / 2) {
    d.enraged = true; d.st.atkUp = { v: 0.15, t: 1e9 };
    ev.push({ k: 'react', t: d.id, name: 'ENRAGED' }, { k: 'text', v: d.name + ' is enraged: much faster attacks!' });
  }
  if (d.hp <= 0) {
    ko(st, a, d, ev);
    if (st.fs) { if (!d.alive) root.FightStats.ko(st, fsAtk, d); else root.FightStats.revive(st, d); }
  }
  return v;
}
function ko(st, a, d, ev) {
  d.hp = 0; d.alive = false; d.shield = 0;
  ev.push({ k: 'ko', t: d.id });
  const db = st.bonus[d.side];
  if (db.phoenix && !st.phoenix[d.side]) {
    st.phoenix[d.side] = true; d.alive = true; d.hp = Math.round(d.maxHp * db.phoenix); d.st = {};
    ev.push({ k: 'revive', t: d.id, hp: d.hp, name: 'Phoenix Plume' });
    return;
  }
  if (a && a.alive && a.side !== d.side) {
    gainMana(st, a, 10);
    a.kills = (a.kills || 0) + 1;
    if (a.perk && a.perk.kind === 'reaper') { gainMana(st, a, a.perk.l > 1 ? 60 : 30); ev.push({ k: 'perk', a: a.id, t: a.id, n: 'Soul Harvest', el: a.el }); }
    if (a.perk && a.perk.kind === 'hunter' && a.kills <= 5) ev.push({ k: 'perk', a: a.id, t: a.id, n: 'Bloodlust', el: a.el });
    const ab = st.bonus[a.side];
    if (ab.killHeal) heal(st, a, a, ab.killHeal, ev);
    if (a.side === 0 && ab.koGold && (st.koGoldN || 0) < 2 && st.goldBonus < 5) { st.koGoldN = (st.koGoldN || 0) + 1; st.goldBonus += Math.min(ab.koGold, 1); }
  }
  if (d.st.curse && st.bonus[1 - d.side].curseSpread) for (const e of alive(st, d.side)) applyStatus(st, a, e, 'curse', ev);
}

// ---- attacks and casts ------------------------------------------------------------------------------
function basicAttack(st, u, t, ev) {
  const sk = G.SK[u.basic];
  const dealt = hit(st, u, t, sk, ev, { basic: true, single: true });
  // the basic skill's status rides on every basic attack
  const fx = sk.fx || {};
  for (const k of STATUS_KEYS) if (fx[k] != null && t.alive) {
    if (k === 'poison') applyStatus(st, u, t, 'poison', ev, 0, fx[k]);
    else {
      let ch = u.b.sure ? 1 : fx[k];
      if (k === 'stun') ch = (ch + ((sk.el === 'volt') ? (st.bonus[u.side].stunPlus || 0) : 0)) * (t.boss ? 0.5 : 1);
      if (st.rnd() < ch) applyStatus(st, u, t, k, ev);
    }
  }
  if (sk.ls && dealt > 0) heal(st, u, u, 0, ev, dealt * sk.ls, true);
  gainMana(st, u, 10);
  if (u.perk && u.alive) {
    const P = u.perk, el = sk.el === 'flux' ? u.el : sk.el;
    u.atkN++;
    if (P.kind === 'flurry' && u.atkN % 3 === 0 && t.alive) { ev.push({ k: 'perk', a: u.id, t: t.id, n: 'Frenzy', el }); hit(st, u, t, sk, ev, { basic: true, single: true, crit: P.l > 1 }); }
    if (P.kind === 'cleave') {
      const near = alive(st, 1 - u.side).filter(e => e !== t && dist(e, t) <= 1);
      if (near.length) ev.push({ k: 'perk', a: u.id, t: t.id, n: 'Cleave', el, aoe: 1 });
      for (const e of near) hit(st, u, e, sk, ev, { basic: true, powMul: P.l > 1 ? 0.6 : 0.35, noReact: true, noMiss: true });
    }
    if (P.kind === 'pierce') {
      const dx = Math.sign(t.x - u.x) || (u.side ? -1 : 1), dy = Math.sign(t.y - u.y);
      const b = alive(st, 1 - u.side).find(e => e.x === t.x + dx && e.y === t.y + (dx ? 0 : dy));
      if (b) { ev.push({ k: 'perk', a: t.id, t: b.id, n: 'Pierce', el }); hit(st, u, b, sk, ev, { basic: true, powMul: P.l > 1 ? 0.7 : 0.4, noReact: true, noMiss: true }); }
    }
  }
}
const TSEC = { atkUp: 6, defUp: 6, spdUp: 6, critUp: 6 };
function castGrid(st, u, ev) {
  const sk = G.SK[u.skill];
  const fx = sk.fx || {}, ab = st.bonus[u.side];
  const el = sk.el === 'flux' ? u.el : sk.el;
  const foes = alive(st, 1 - u.side), allies = alive(st, u.side);
  let tg = [];
  const primary = () => { const t = acquire(st, u); return t; };
  if (sk.t === 'self') tg = [u];
  else if (sk.t === 'ally') tg = [allies.slice().sort((x, y) => pct(x) - pct(y))[0]];
  else if (sk.t === 'allies') tg = allies;
  else if (sk.t === 'lowfoe') {
    const t = foes.slice().sort((x, y) => pct(x) - pct(y))[0];
    if (t) {
      tg = [t];
      // melee assassins leap next to their mark
      if (u.range === 1 && dist(u, t) > 1) { const c = adjacentFree(st, t); if (c) { u.x = c[0]; u.y = c[1]; ev.push({ k: 'blink', u: u.id, x: c[0], y: c[1] }); u.tgt = t.id; } }
    }
  } else if (sk.t === 'foes') {
    const p = primary();
    if (p) tg = foes.filter(e => dist(e, p) <= (sk.ult ? 3 : 2));
  } else if (/^foe\d$/.test(sk.t)) tg = [];
  else { const p = primary(); if (p) tg = [p]; }
  ev.push({ k: 'cast', a: u.id, sk: sk.id, n: sk.n, ult: !!sk.ult, el, tg: tg.map(t => t.id), aoe: sk.t === 'foes' || sk.t === 'allies' });
  if (st.fs) root.FightStats.cast(st, u, !!sk.ult);
  const onTarget = t => {
    for (const k of STATUS_KEYS) if (fx[k] != null && t.alive && t.side !== u.side) {
      if (k === 'poison') applyStatus(st, u, t, 'poison', ev, 0, fx[k]);
      else {
        let ch = fx[k];
        if (k === 'stun') ch = (ch + (el === 'volt' ? (ab.stunPlus || 0) : 0)) * (t.boss ? 0.5 : 1);
        if (st.rnd() < ch) applyStatus(st, u, t, k, ev);
      }
    }
    if (sk.ult && ab.ultBurn && t.side !== u.side) applyStatus(st, u, t, 'burn', ev);
    if (fx.heal && sk.t !== 'foe') heal(st, u, t, fx.heal, ev);
    if (fx.shield) giveShield(st, u, t, fx.shield, ev);
    if (fx.cleanse) cleanse(t, ev);
    if (fx.regen) { t.st.regen = { v: fx.regen * 0.5, t: 5 }; ev.push({ k: 'status', t: t.id, s: 'regen' }); }
    for (const k of ['atkUp', 'defUp', 'spdUp', 'critUp']) if (fx[k]) { t.st[k] = { v: fx[k], t: TSEC[k] }; ev.push({ k: 'status', t: t.id, s: k }); }
    if (fx.dodge) { t.st.dodge = { v: fx.dodge, t: 4 }; ev.push({ k: 'status', t: t.id, s: 'dodge' }); }
    if (fx.taunt) { t.st.taunt = { t: fx.taunt * 2 }; ev.push({ k: 'status', t: t.id, s: 'taunt' }); }
    if (fx.od) { gainMana(st, t, fx.od); ev.push({ k: 'mana', t: t.id, v: t.mana }); }
  };
  if (/^foe\d$/.test(sk.t)) {
    const n = +sk.t.slice(3);
    for (let i = 0; i < n; i++) {
      const fs = alive(st, 1 - u.side);
      if (!fs.length || !u.alive) break;
      const taunt = fs.filter(e => e.st.taunt);
      const pool = taunt.length && st.rnd() < 0.5 ? taunt : fs;
      const t = pool[Math.floor(st.rnd() * pool.length)];
      ev.push({ k: 'aim', a: u.id, t: t.id, el });
      hit(st, u, t, sk, ev, {});
      onTarget(t);
    }
  } else {
    for (const t of tg) {
      if (sk.pow && t.side !== u.side) hit(st, u, t, sk, ev, { single: tg.length === 1 && sk.t !== 'foes', exec: sk.exec });
      onTarget(t);
    }
  }
  if (fx.allyHeal) for (const f of alive(st, u.side)) heal(st, u, f, fx.allyHeal, ev);
  if (u.alive) {
    if (fx.selfDodge) { u.st.dodge = { v: fx.selfDodge, t: 4 }; ev.push({ k: 'status', t: u.id, s: 'dodge' }); }
    if (fx.selfSpdUp) { u.st.spdUp = { v: fx.selfSpdUp, t: 6 }; ev.push({ k: 'status', t: u.id, s: 'spdUp' }); }
    if (fx.selfDefUp) { u.st.defUp = { v: fx.selfDefUp, t: 6 }; ev.push({ k: 'status', t: u.id, s: 'defUp' }); }
    if (fx.selfShield) giveShield(st, u, u, fx.selfShield, ev);
    if (fx.selfTaunt) { u.st.taunt = { t: 3 }; ev.push({ k: 'status', t: u.id, s: 'taunt' }); }
  }
  if (fx.summon) summon(st, u, fx.summon, ev);
  u.mana = 0;
  if (u.perk && u.alive) {
    const P = u.perk;
    if (P.kind === 'echo') { ev.push({ k: 'perk', a: u.id, t: u.id, n: 'Echo', el: u.el, ring: 1 }); for (const f of alive(st, u.side)) if (f !== u && dist(f, u) <= 2) { gainMana(st, f, P.l > 1 ? 30 : 15); ev.push({ k: 'mana', t: f.id, v: f.mana }); } }
    if (P.kind === 'surge') { u.st.spdUp = { v: P.l > 1 ? 0.4 : 0.2, t: 4 }; ev.push({ k: 'status', t: u.id, s: 'spdUp' }, { k: 'perk', a: u.id, t: u.id, n: 'Surge', el: u.el }); }
    if (P.kind === 'aegis') { const w = alive(st, u.side).sort((x, y) => pct(x) - pct(y))[0]; if (w) { ev.push({ k: 'perk', a: u.id, t: w.id, n: 'Aegis', el: u.el, heal: 1 }); giveShield(st, u, w, P.l > 1 ? 0.2 : 0.1, ev); } }
  }
  if (u.boss) { const c = castables(u.inst); u.skill = c[(c.indexOf(u.skill) + 1) % c.length]; }
  if (sk.ult && ab.echo) for (const f of alive(st, u.side)) if (f !== u) { gainMana(st, f, ab.echo); ev.push({ k: 'mana', t: f.id, v: f.mana }); }
  ev.push({ k: 'mana', t: u.id, v: 0 });
}
function adjacentFree(st, t) {
  const opts = [];
  for (const [dx, dy] of DIRS) { const x = t.x + dx, y = t.y + dy; if (x >= 0 && y >= 0 && x < W && y < H && !occupied(st, x, y)) opts.push([x, y]); }
  return opts.length ? opts[Math.floor(st.rnd() * opts.length)] : null;
}
function summon(st, a, sp, ev) {
  if (alive(st, a.side).length >= 10) return;
  const c = freeCellNear(st, a.x, a.y); if (!c) return;
  const inst = { sp, star: 1, summoned: 1, scale: (a.inst.scale || 1) * 0.9 };
  const u = makeUnit(st, inst, a.side, c[0], c[1]);
  st.units.push(u);
  if (st.fs) root.FightStats.row(st, u);
  ev.push({ k: 'summon', u: u.id });
}

// ---- the clock -----------------------------------------------------------------------------------
function everySecond(st, ev) {
  const sec = Math.round(st.t);
  if (st.bonus[0].tempo && sec % 6 === 0) {
    st.tempoUntil = st.t + 2;
    for (const u of alive(st, 0)) { gainMana(st, u, 15); ev.push({ k: 'mana', t: u.id, v: u.mana }); }
  }
  if (st.haz === 'flux' && sec % 4 === 0) for (const u of alive(st, 1)) {
    const opts = G.ELS.filter(e => e !== u.el); u.el = opts[Math.floor(st.rnd() * opts.length)]; ev.push({ k: 'flux', t: u.id, el: u.el });
  } else if (sec % 4 === 0) for (const u of alive(st, 1)) if (u.boss && G.BOSSES[u.boss].flux) {
    const opts = G.ELS.filter(e => e !== u.el); u.el = opts[Math.floor(st.rnd() * opts.length)]; ev.push({ k: 'flux', t: u.id, el: u.el });
  }
  if (st.t >= 40) { if (sec === 40) ev.push({ k: 'text', v: 'The cave rumbles! Everyone takes growing damage.' }); }
  if (sec % 4 === 0) for (const u of st.units) if (u.alive && u.perk && u.perk.kind === 'mend') {
    const w = alive(st, u.side).sort((x, y) => pct(x) - pct(y))[0];
    if (w && w.hp < w.maxHp) { ev.push({ k: 'perk', a: u.id, t: w.id, n: 'Mend', el: u.el, heal: 1 }); heal(st, u, w, u.perk.l > 1 ? 0.08 : 0.04, ev); }
  }
  if (st.haz === 'starfall' && sec % 6 === 0 && !st.bonus[0].immune_starfall) {
    const mine = alive(st, 0);
    if (mine.length) { const v = mine[Math.floor(st.rnd() * mine.length)]; ev.push({ k: 'star', t: v.id }); damage(st, null, v, Math.max(1, Math.round(v.maxHp * 0.08)), ev, { dot: 'star' }); }
  }
  for (const u of st.units.slice()) {
    if (!u.alive) continue;
    const b = st.bonus[u.side];
    if (u.st.burn) damage(st, null, u, u.st.burn.v, ev, { dot: 'burn', src: u.st.burn.src });
    if (u.alive && u.st.poison) { damage(st, null, u, u.st.poison.v * u.st.poison.n, ev, { dot: 'poison', src: u.st.poison.src }); if (u.st.poison) { u.st.poison.n--; if (u.st.poison.n <= 0) delete u.st.poison; } }
    if (!u.alive) continue;
    if (st.t >= 40) damage(st, null, u, Math.max(1, Math.round(u.maxHp * 0.015 * (st.t - 39))), ev, { dot: 'quake' });
    if (!u.alive) continue;
    if (u.side === 0) {
      if (st.haz === 'heat' && !b.immune_heat && u.el !== 'ember' && u.el !== 'stone') damage(st, null, u, Math.max(1, Math.round(u.maxHp * (u.el === 'tide' ? 0.006 : 0.012))), ev, { dot: 'heat' });
      if (st.haz === 'spores' && !b.immune_spores && u.el !== 'bloom' && u.el2 !== 'bloom' && u.alive && sec % 3 === 0) {
        const cur = u.st.poison || { n: 0, v: Math.max(1, Math.round(u.maxHp * 0.01)) };
        u.st.poison = { n: Math.min(10, cur.n + 1), v: cur.v, src: cur.src != null ? cur.src : null };
        ev.push({ k: 'status', t: u.id, s: 'poison', haz: 1 });
      }
      if (b.immune_spores && sec % 5 === 0) cleanse(u, ev);
      if (st.haz === 'blizzard' && sec % 4 === 0 && u.el !== 'frost' && u.el2 !== 'frost' && !b.immune_blizzard) applyStatus(st, null, u, 'chill', ev, 2);
      if (st.haz === 'sandstorm' && sec % 5 === 0 && u.el !== 'stone' && u.el2 !== 'stone' && !b.immune_sandstorm) applyStatus(st, null, u, 'blind', ev, 2);
      if (st.haz === 'gusts' && sec % 5 === 0 && !b.immune_gusts && !['gale', 'metal', 'stone'].includes(u.el) && st.rnd() < 0.4 && u.x > 0 && !occupied(st, u.x - 1, u.y)) {
        moveTo(u, u.x - 1, u.y, ev); ev.push({ k: 'pushed', t: u.id });
      }
    }
    if (!u.alive) continue;
    const rg = (u.st.regen ? u.st.regen.v : 0) + (b.regen || 0) + u.b.regen;
    if (rg > 0 && u.hp < u.maxHp) heal(st, u, u, rg, ev, null, true);
  }
}

function makeUnit(st, inst, side, x, y) {
  const b = st.bonus[side], s = GC.stats(inst, b);
  const u = {
    id: nextId(st), side, x, y, inst, name: GC.name(inst), art: GC.art(inst), el: GC.elOf(inst), el2: inst.el2 || null, role: GC.roleOf(inst),
    star: inst.boss ? 3 : (inst.star || 1), boss: inst.boss || null, elite: inst.elite || null, shiny: !!inst.shiny,
    maxHp: s.hp, hp: s.hp, b: s, range: s.range, basic: GC.basicOf(inst), skill: inst.skill && GC.castables(inst).includes(inst.skill) ? inst.skill : GC.defaultSkill(inst),
    mana: Math.min(99, b.startOd || 0), st: {}, shield: 0, alive: true, firstAtk: true, gritUsed: false,
    atkCd: 0.25 + st.rnd() * 0.5, moveCd: st.rnd() * 0.2, tgt: null, summoned: !!inst.summoned, enraged: false, front: false,
    bossCycle: 0,
  };
  u.charmEl = inst.charm && G.CHARMS[inst.charm] && G.CHARMS[inst.charm].b.el || null;
  if (u.elite) {
    u.maxHp = Math.round(u.maxHp * 1.4); u.hp = u.maxHp; u.b.atk *= 1.25;
    if (u.elite === 'vampiric') u.b.ls += 0.25;
    if (u.elite === 'thorned') u.b.thorns += 0.25;
    if (u.elite === 'hasty') u.b.as *= 1.4;
    if (u.elite === 'shielded') u.shield = Math.round(u.maxHp * 0.4);
  }
  if (!inst.boss && !inst.summoned && (inst.star || 1) >= 2 && G.SP[inst.sp] && G.SP[inst.sp].perk) {
    u.perk = { kind: G.SP[inst.sp].perk.kind, l: inst.star >= 3 ? 2 : 1 };
    if (u.perk.kind === 'quick') u.mana = Math.min(99, u.mana + (u.perk.l > 1 ? 70 : 40));
    if (u.perk.kind === 'thornskin') u.b.thorns += u.perk.l > 1 ? 0.3 : 0.15;
  }
  u.atkN = 0; u.kills = 0;
  const P = inst.boss && G.BOSSES[inst.boss].passive;
  if (P) {
    if (P.thorns) u.b.thorns += P.thorns;
    if (P.dodge) u.st.dodge = { v: P.dodge, t: 1e9 };
    if (P.dr) u.bossDR = P.dr;
    if (P.regen) u.b.regen += P.regen;
    if (P.ls) u.b.ls += P.ls;
    if (P.reflect) u.reflect = P.reflect;
    if (P.frostAura) u.frostAura = P.frostAura;
  }
  if (b.lsAll) u.b.ls += b.lsAll;
  if (b.thornsAll) u.b.thorns += b.thornsAll;
  if (inst.hpFrac != null) u.hp = Math.max(1, Math.round(u.maxHp * inst.hpFrac));
  dress(st, u);
  return u;
}

function rangeUnits(u) {
  const table = { 1: 96, 2: 210, 3: 340 };
  return (table[u.range] || 96) + ((u.b && u.b.reach) || 0) * 36;
}
function moveSpeed(st, u) {
  const as = (u.b && u.b.as) || 0.8;
  let s = 230 * Math.max(0.75, Math.min(1.55, as / 0.8));
  if (u.st && u.st.chill) s *= 0.75;
  if (st.haz === 'bog' && u.side === 0 && !(st.bonus[0] && st.bonus[0].immune_bog)) s *= 0.55;
  if (u.enraged) s *= 1.12;
  return s;
}
function skEl(sk, u) { return sk.el === 'flux' ? u.el : sk.el; }
function muzzle(u) { return { x: u.pos.x + u.facing * (u.radius + 10), y: u.pos.y - 8 }; }
function hypot2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }

function pickFocus(st, u) {
  const foes = alive(st, 1 - u.side).filter(e => e.pos);
  if (!foes.length) return null;
  const taunt = foes.filter(e => e.st && e.st.taunt && euclid(u, e) <= rangeUnits(u) + 180);
  if (taunt.length) return taunt.sort((a, b) => euclid(u, a) - euclid(u, b))[0];
  let mode = u.tactic.focus;
  if (st.rnd() < MISTAKE) mode = 'closest';
  if (mode === 'lowest') return foes.slice().sort((a, b) => pct(a) - pct(b) || euclid(u, a) - euclid(u, b))[0];
  if (mode === 'healers') {
    const h = foes.filter(e => e.role === 'support');
    const pool = h.length ? h : foes;
    return pool.slice().sort((a, b) => euclid(u, a) - euclid(u, b))[0];
  }
  if (mode === 'backline') {
    return foes.slice().sort((a, b) => (u.side === 0 ? b.pos.x - a.pos.x : a.pos.x - b.pos.x) || euclid(u, a) - euclid(u, b))[0];
  }
  if (mode === 'threat') return foes.slice().sort((a, b) => (b.threat || 0) - (a.threat || 0) || euclid(u, a) - euclid(u, b))[0];
  return foes.slice().sort((a, b) => euclid(u, a) - euclid(u, b))[0];
}
function focusOf(st, u) {
  if (u.focusId && u.focusUntil > st.t) {
    const c = byId(st, u.focusId);
    if (c && c.alive && c.pos) return c;
  }
  const f = pickFocus(st, u);
  u.focusId = f ? f.id : 0;
  u.focusUntil = st.t + 0.4;
  return f;
}
function goalPoint(st, u, tgt) {
  const tac = u.tactic;
  const dx = tgt.pos.x - u.pos.x, dy = tgt.pos.y - u.pos.y;
  const d = Math.hypot(dx, dy) || 1;
  const space = { tight: 0.65, close: 0.85, balanced: 1, loose: 1.25 }[tac.spacing] || 1;
  let prefer = rangeUnits(u) * (u.range <= 1 ? Math.min(space, 0.85) : space);
  if (u.range <= 1) prefer = Math.min(prefer, 72);
  if (tac.stance === 'aggressive') prefer *= 0.5;
  if (tac.stance === 'pursue') prefer *= 0.35;
  if (tac.stance === 'cautious') prefer = rangeUnits(u) * Math.max(space, 1.05);
  // apply before the goal is built: a long kite distance pins ranged units on the walls
  if (u.range > 1) prefer = Math.min(prefer, 180);
  let gx = tgt.pos.x - (dx / d) * prefer;
  let gy = tgt.pos.y - (dy / d) * prefer;
  if (tac.stance === 'behind') {
    const mates = alive(st, u.side).filter(m => m !== u && m.pos);
    if (mates.length) {
      let cx = 0, cy = 0;
      for (const m of mates) { cx += m.pos.x; cy += m.pos.y; }
      cx /= mates.length; cy /= mates.length;
      gx = cx + (u.side === 0 ? -70 : 70);
      gy = cy;
    }
  }
  if (tac.stance === 'defensive') {
    if (u.side === 0) gx = Math.min(gx, 280);
    else gx = Math.max(gx, AW - 280);
  }
  const m = 80;
  if (gx < m) gx = m; else if (gx > AW - m) gx = AW - m;
  if (gy < m) gy = m; else if (gy > AH - m) gy = AH - m;
  // already against a wall: the goal steps inward so a dodge or kite cannot camp the edge
  if (u.pos.y < 140) gy = Math.max(gy, 170);
  else if (u.pos.y > AH - 140) gy = Math.min(gy, AH - 170);
  if (u.pos.x < 160) gx = Math.max(gx, 190);
  else if (u.pos.x > AW - 160) gx = Math.min(gx, AW - 190);
  return { x: gx, y: gy };
}
function incoming(st, u) {
  for (const p of st.projs) {
    if (!p.pos) continue;
    if (p.a === u.id) continue;
    if (p.side === u.side && (p.friendly || p.ff === 'avoid')) continue;
    const dx = p.pos.x - u.pos.x, dy = p.pos.y - u.pos.y;
    const d = Math.hypot(dx, dy);
    if (d > 8 && d < 160) {
      const closing = (p.vel.x * dx + p.vel.y * dy) / d;
      if (closing < -30) return { x: dx / d, y: dy / d };
    }
  }
  for (const g of st.telegraphs) {
    if (g.a === u.id) continue;
    if (g.side === u.side && g.ff === 'avoid') continue;
    if (g.shape === 'circle' || g.shape === 'ring') {
      const dx = u.pos.x - g.pos.x, dy = u.pos.y - g.pos.y;
      if (dx * dx + dy * dy <= (g.r + u.radius) * (g.r + u.radius)) return { x: dx || 1, y: dy || 0 };
    }
  }
  return null;
}
function steer(st, u, tgt) {
  const goal = goalPoint(st, u, tgt);
  const threat = incoming(st, u);
  if (threat && u.tactic.stance !== 'aggressive' && u.tactic.stance !== 'pursue') {
    if (!u.dodgeT) {
      u.dodgeOk = st.rnd() >= MISTAKE;
      u.dodgeT = 0.32;
      u.dodgeNx = -threat.y;
      u.dodgeNy = threat.x;
    }
  }
  let gx = goal.x, gy = goal.y;
  if (u.dodgeT > 0 && u.dodgeOk) {
    u.dodgeT -= DT;
    const L = Math.hypot(u.dodgeNx || 0, u.dodgeNy || 0) || 1;
    let nx = (u.dodgeNx || 0) / L, ny = (u.dodgeNy || 0) / L;
    if (u.pos.y < 150) ny = Math.abs(ny);
    else if (u.pos.y > AH - 150) ny = -Math.abs(ny);
    if (u.pos.x < 170) nx = Math.abs(nx);
    else if (u.pos.x > AW - 170) nx = -Math.abs(nx);
    gx = u.pos.x + nx * 90;
    gy = u.pos.y + ny * 90;
    if (gx < 80) gx = 80; else if (gx > AW - 80) gx = AW - 80;
    if (gy < 80) gy = 80; else if (gy > AH - 80) gy = AH - 80;
    if (u.dodgeT <= 0) u.dodgeT = 0;
  } else if (!threat) u.dodgeT = 0;
  let vx = gx - u.pos.x, vy = gy - u.pos.y;
  const L = Math.hypot(vx, vy);
  const spd = u.st && u.st.root ? 0 : moveSpeed(st, u);
  if (spd <= 0 || L < 8) {
    u.vel.x = u.vel.y = 0;
    u.state = 'idle';
  } else {
    u.vel.x = vx / L * spd;
    u.vel.y = vy / L * spd;
    u.state = 'run';
    if (Math.abs(u.vel.x) > 12) u.facing = u.vel.x > 0 ? 1 : -1;
  }
  u.pos.x += u.vel.x * DT;
  u.pos.y += u.vel.y * DT;
}

function filterFF(u, list) {
  const enemies = list.filter(t => t.side !== u.side);
  const allies = list.filter(t => t.side === u.side && t !== u);
  if (u.tactic.ff === 'avoid') return enemies;
  if (u.tactic.ff === 'calculated') {
    if (allies.length && allies.length >= enemies.length) return null;
    return enemies.concat(allies);
  }
  return enemies.concat(allies);
}
function circleTargets(st, u, shape, aim) {
  const r = shape.aoe || 80;
  const raw = [];
  for (const o of st.units) {
    if (!o.alive || !o.pos || o === u) continue;
    if (hypot2(o.pos.x, o.pos.y, aim.x, aim.y) <= (r + o.radius * 0.25) * (r + o.radius * 0.25)) raw.push(o);
  }
  if (shape.friendly) {
    const allies = raw.filter(t => t.side === u.side);
    return allies.length ? allies : [u];
  }
  return filterFF(u, raw);
}
function chainTargets(st, u, shape) {
  const n = shape.hits || 3;
  const jump = shape.length || 180;
  const first = focusOf(st, u);
  if (!first) return [];
  const out = [first];
  let cur = first;
  while (out.length < n) {
    let best = null, bd = jump + 40;
    for (const e of alive(st, 1 - u.side)) {
      if (out.indexOf(e) >= 0 || !e.pos) continue;
      const d = Math.hypot(e.pos.x - cur.pos.x, e.pos.y - cur.pos.y);
      if (d < bd) { bd = d; best = e; }
    }
    if (!best || bd > jump + best.radius) break;
    out.push(best);
    cur = best;
  }
  return out;
}
function segDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const L2 = dx * dx + dy * dy || 1;
  let t = ((px - x1) * dx + (py - y1) * dy) / L2;
  if (t < 0) t = 0; else if (t > 1) t = 1;
  return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
}
function lineTargets(st, u, shape, aim) {
  const len = shape.length || 520;
  const from = muzzle(u);
  const dx = aim.x - from.x, dy = aim.y - from.y;
  const L = Math.hypot(dx, dy) || 1;
  const x2 = from.x + dx / L * len, y2 = from.y + dy / L * len;
  const width = (shape.width || 28) / 2;
  const raw = [];
  for (const o of st.units) {
    if (!o.alive || !o.pos || o === u) continue;
    if (segDist(o.pos.x, o.pos.y, from.x, from.y, x2, y2) <= width + o.radius) raw.push(o);
  }
  return filterFF(u, raw);
}
function coneTargets(st, u, shape, aim) {
  const ang = Math.atan2(aim.y - u.pos.y, aim.x - u.pos.x);
  const len = shape.length || 260;
  const arc = shape.arc || 1.2;
  const raw = [];
  for (const o of st.units) {
    if (!o.alive || !o.pos || o === u) continue;
    const dx = o.pos.x - u.pos.x, dy = o.pos.y - u.pos.y;
    const d = Math.hypot(dx, dy);
    if (d > len + o.radius) continue;
    let da = Math.atan2(dy, dx) - ang;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    if (Math.abs(da) <= arc / 2 + 0.05) raw.push(o);
  }
  return filterFF(u, raw);
}
function aimOf(st, u, shape, tgt) {
  if (shape.friendly && shape.shape === 'projectile') {
    const w = alive(st, u.side).filter(a => a.pos).sort((a, b) => pct(a) - pct(b))[0] || u;
    return { x: w.pos.x, y: w.pos.y, who: w.id };
  }
  if (shape.anchor === 'self' || shape.shape === 'buff' || shape.shape === 'summon') return { x: u.pos.x, y: u.pos.y, who: u.id };
  if (!tgt || !tgt.pos) return { x: u.pos.x + u.facing * 120, y: u.pos.y, who: 0 };
  return { x: tgt.pos.x, y: tgt.pos.y, who: tgt.id };
}
function preview(st, u, shape, aim, tgt) {
  if (shape.shape === 'buff' || shape.shape === 'summon') return [u];
  if (shape.shape === 'projectile' || shape.shape === 'dash' || shape.shape === 'melee') return tgt ? [tgt] : [];
  if (shape.shape === 'chain') return chainTargets(st, u, shape);
  if (shape.shape === 'line') return lineTargets(st, u, shape, aim);
  if (shape.shape === 'cone') return coneTargets(st, u, shape, aim);
  return circleTargets(st, u, shape, aim);
}
function addTel(st, u, shape, aim, el, ev) {
  const from = (shape.shape === 'line' || shape.shape === 'projectile' || shape.shape === 'dash' || shape.shape === 'cone') ? muzzle(u) : aim;
  const dur = shape.telegraph || shape.cast || 0.3;
  const telShape = shape.shape === 'projectile' || shape.shape === 'line' || shape.shape === 'dash' ? 'line' : shape.shape === 'cone' ? 'cone' : 'circle';
  const g = {
    id: st.pid++, a: u.id, side: u.side, shape: telShape, ff: u.tactic.ff, el,
    pos: { x: from.x, y: from.y }, prev: { x: from.x, y: from.y },
    x2: aim.x, y2: aim.y, r: shape.aoe || shape.radius || shape.width || 36,
    ang: Math.atan2(aim.y - u.pos.y, aim.x - u.pos.x), arc: shape.arc || 0,
    dur, left: dur,
  };
  st.telegraphs.push(g);
  ev.push({ k: 'telegraph', id: g.id, shape: g.shape, a: u.id, x: g.pos.x, y: g.pos.y, x2: g.x2, y2: g.y2, r: g.r, ang: g.ang, arc: g.arc, el, dur });
}
function spawnProj(st, u, o, ev) {
  const p = {
    id: st.pid++, a: u.id, side: u.side,
    pos: { x: o.x, y: o.y }, prev: { x: o.x, y: o.y },
    vel: { x: o.vx, y: o.vy },
    radius: o.r || 12, el: o.el, life: o.life || 1.5, maxLife: o.life || 1.5,
    pierce: o.pierce || 0, ff: u.tactic ? u.tactic.ff : 'avoid', friendly: !!o.friendly,
    skill: o.skill || null, basic: !!o.basic, seen: {},
    homing: o.homing || 0, target: o.target || 0,
  };
  st.projs.push(p);
  ev.push({ k: 'proj', id: p.id, a: u.id, x: p.pos.x, y: p.pos.y, vx: p.vel.x, vy: p.vel.y, r: p.radius, el: p.el, life: p.life, ff: p.ff });
  return p;
}

function applyFx(st, u, t, sk, ev) {
  const fx = sk.fx || {};
  const el = skEl(sk, u);
  const ab = st.bonus[u.side];
  for (const k of STATUS_KEYS) if (fx[k] != null && t.alive && t.side !== u.side) {
    if (k === 'poison') applyStatus(st, u, t, 'poison', ev, 0, fx[k]);
    else {
      let ch = fx[k];
      if (k === 'stun') ch = (ch + (el === 'volt' ? (ab.stunPlus || 0) : 0)) * (t.boss ? 0.5 : 1);
      if (st.rnd() < ch) applyStatus(st, u, t, k, ev);
    }
  }
  if (sk.ult && ab.ultBurn && t.side !== u.side) applyStatus(st, u, t, 'burn', ev);
  if (fx.heal && sk.t !== 'foe') heal(st, u, t, fx.heal, ev);
  if (fx.shield) giveShield(st, u, t, fx.shield, ev);
  if (fx.cleanse) cleanse(t, ev);
  if (fx.regen) { t.st.regen = { v: fx.regen * 0.5, t: 5 }; ev.push({ k: 'status', t: t.id, s: 'regen' }); }
  for (const k of ['atkUp', 'defUp', 'spdUp', 'critUp']) if (fx[k]) { t.st[k] = { v: fx[k], t: TSEC[k] }; ev.push({ k: 'status', t: t.id, s: k }); }
  if (fx.dodge) { t.st.dodge = { v: fx.dodge, t: 4 }; ev.push({ k: 'status', t: t.id, s: 'dodge' }); }
  if (fx.taunt) { t.st.taunt = { t: fx.taunt * 2 }; ev.push({ k: 'status', t: t.id, s: 'taunt' }); }
  if (fx.od) { gainMana(st, t, fx.od); ev.push({ k: 'mana', t: t.id, v: t.mana }); }
}
function knockFrom(src, t, power, ev) {
  if (!t.pos || !src.pos) return;
  const dx = t.pos.x - src.pos.x, dy = t.pos.y - src.pos.y;
  const L = Math.hypot(dx, dy) || 1;
  const sign = power < 0 ? -1 : 1;
  const mag = Math.abs(power);
  t.vel.x = (t.vel.x || 0) + sign * dx / L * mag;
  t.vel.y = (t.vel.y || 0) + sign * dy / L * mag;
  t.pos.x += sign * dx / L * Math.min(70, mag * 0.08);
  t.pos.y += sign * dy / L * Math.min(70, mag * 0.08);
  ev.push({ k: 'knock', t: t.id, x: t.pos.x, y: t.pos.y, vx: t.vel.x, vy: t.vel.y });
}
function finishCast(st, u, sk, ev) {
  const fx = sk.fx || {};
  const ab = st.bonus[u.side];
  if (fx.allyHeal) for (const f of alive(st, u.side)) heal(st, u, f, fx.allyHeal, ev);
  if (u.alive) {
    if (fx.selfDodge) { u.st.dodge = { v: fx.selfDodge, t: 4 }; ev.push({ k: 'status', t: u.id, s: 'dodge' }); }
    if (fx.selfSpdUp) { u.st.spdUp = { v: fx.selfSpdUp, t: 6 }; ev.push({ k: 'status', t: u.id, s: 'spdUp' }); }
    if (fx.selfDefUp) { u.st.defUp = { v: fx.selfDefUp, t: 6 }; ev.push({ k: 'status', t: u.id, s: 'defUp' }); }
    if (fx.selfShield) giveShield(st, u, u, fx.selfShield, ev);
    if (fx.selfTaunt) { u.st.taunt = { t: 3 }; ev.push({ k: 'status', t: u.id, s: 'taunt' }); }
  }
  if (fx.summon) summon(st, u, fx.summon, ev);
  u.mana = 0;
  u.castCd = (u.castShape && u.castShape.cd) || 0;
  u.atkCd = Math.max(u.atkCd || 0, 0.28);
  if (u.perk && u.alive) {
    const P = u.perk;
    if (P.kind === 'echo') {
      ev.push({ k: 'perk', a: u.id, t: u.id, n: 'Echo', el: u.el, ring: 1 });
      for (const f of alive(st, u.side)) if (f !== u && dist(f, u) <= 2) { gainMana(st, f, P.l > 1 ? 30 : 15); ev.push({ k: 'mana', t: f.id, v: f.mana }); }
    }
    if (P.kind === 'surge') { u.st.spdUp = { v: P.l > 1 ? 0.4 : 0.2, t: 4 }; ev.push({ k: 'status', t: u.id, s: 'spdUp' }, { k: 'perk', a: u.id, t: u.id, n: 'Surge', el: u.el }); }
    if (P.kind === 'aegis') {
      const w = alive(st, u.side).slice().sort((x, y) => pct(x) - pct(y))[0];
      if (w) { ev.push({ k: 'perk', a: u.id, t: w.id, n: 'Aegis', el: u.el, heal: 1 }); giveShield(st, u, w, P.l > 1 ? 0.2 : 0.1, ev); }
    }
  }
  if (u.boss) { const c = GC.castables(u.inst); u.skill = c[(c.indexOf(u.skill) + 1) % c.length]; }
  if (sk.ult && ab && ab.echo) for (const f of alive(st, u.side)) if (f !== u) { gainMana(st, f, ab.echo); ev.push({ k: 'mana', t: f.id, v: f.mana }); }
  ev.push({ k: 'mana', t: u.id, v: 0 });
  u.castShape = null;
}
function payTargets(st, u, sk, targets, ev, shape) {
  const el = skEl(sk, u);
  const aoe = !!(shape && (shape.shape === 'circle' || shape.shape === 'cone' || shape.shape === 'line' || sk.t === 'foes' || sk.t === 'allies'));
  ev.push({ k: 'cast', a: u.id, sk: sk.id, n: sk.n, ult: !!sk.ult, el, tg: targets.map(t => t.id), aoe });
  if (st.fs) root.FightStats.cast(st, u, !!sk.ult);
  if (shape && shape.shape === 'chain') for (const t of targets) ev.push({ k: 'aim', a: u.id, t: t.id, el });
  for (const t of targets) {
    if (!t.alive) continue;
    if (sk.pow && t.side !== u.side) hit(st, u, t, sk, ev, { single: targets.length === 1 && sk.t !== 'foes', exec: sk.exec });
    applyFx(st, u, t, sk, ev);
    if (shape && shape.knock && t.side !== u.side) knockFrom(u, t, shape.knock, ev);
  }
  finishCast(st, u, sk, ev);
}
function release(st, u, ev) {
  const sk = G.SK[u.skill];
  const shape = u.castShape || skillShape(u.skill);
  const el = skEl(sk, u);
  const aim = u.castAim || { x: u.pos.x, y: u.pos.y };
  if (shape.shape === 'projectile') {
    const tgt = (shape.friendly && aim.who && byId(st, aim.who)) || byId(st, u.castTarget) || focusOf(st, u);
    if (!tgt || !tgt.pos) { finishCast(st, u, sk, ev); return; }
    const from = muzzle(u);
    const dx = tgt.pos.x - from.x, dy = (tgt.pos.y - 8) - from.y;
    const L = Math.hypot(dx, dy) || 1;
    const sp = shape.speed || 460;
    ev.push({ k: 'cast', a: u.id, sk: sk.id, n: sk.n, ult: !!sk.ult, el, tg: [tgt.id], aoe: false });
    if (st.fs) root.FightStats.cast(st, u, !!sk.ult);
    spawnProj(st, u, { x: from.x, y: from.y, vx: dx / L * sp, vy: dy / L * sp, r: shape.radius || 14, el, life: shape.life || 1.6, pierce: shape.pierce || 0, skill: sk.id, homing: shape.homing || 0, target: tgt.id, friendly: !!shape.friendly }, ev);
    finishCast(st, u, sk, ev);
    return;
  }
  if (shape.shape === 'dash') {
    const tgt = byId(st, u.castTarget) || focusOf(st, u);
    if (!tgt || !tgt.pos) { finishCast(st, u, sk, ev); return; }
    const dx = tgt.pos.x - u.pos.x, dy = tgt.pos.y - u.pos.y;
    const L = Math.hypot(dx, dy) || 1;
    const land = Math.max(0, L - u.radius - tgt.radius - 6);
    const x2 = u.pos.x + dx / L * land, y2 = u.pos.y + dy / L * land;
    ev.push({ k: 'dash', u: u.id, x: u.pos.x, y: u.pos.y, x2, y2, dur: 0.22 });
    u.dashFrom = { x: u.pos.x, y: u.pos.y };
    u.dashTo = { x: x2, y: y2 };
    u.dashT = 0;
    u.dashDur = 0.22;
    u.dashHit = tgt.id;
    u.dashSk = sk.id;
    u.state = 'dash';
    return;
  }
  let targets = [];
  if (shape.shape === 'chain') targets = chainTargets(st, u, shape);
  else if (shape.shape === 'line') targets = lineTargets(st, u, shape, aim) || [];
  else if (shape.shape === 'cone') targets = coneTargets(st, u, shape, aim) || [];
  else if (shape.shape === 'melee') {
    const tgt = byId(st, u.castTarget);
    if (tgt && tgt.alive && tgt.pos && euclid(u, tgt) <= rangeUnits(u) + 18) targets = [tgt];
  } else if (shape.shape === 'buff' || shape.shape === 'summon') targets = [u];
  else {
    const got = circleTargets(st, u, shape, aim);
    targets = got || [];
  }
  payTargets(st, u, sk, targets, ev, shape);
}

function tryCast(st, u, ev) {
  const sk = G.SK[u.skill];
  if (!sk) return false;
  const shape = skillShape(sk.id);
  const tgt = (shape.shape === 'buff' || shape.shape === 'summon' || shape.anchor === 'self') ? u : focusOf(st, u);
  if (shape.shape === 'melee') {
    if (!tgt || !tgt.pos || tgt === u || euclid(u, tgt) > rangeUnits(u) + 22) return false;
  }
  if (!shape.friendly && shape.shape !== 'buff' && shape.shape !== 'summon' && shape.shape !== 'circle' && !tgt) return false;
  const aim = aimOf(st, u, shape, tgt && tgt !== u ? tgt : focusOf(st, u));
  const prev = preview(st, u, shape, aim, tgt && tgt !== u ? tgt : null);
  if (prev === null) return false;
  if (!shape.friendly && (shape.shape === 'circle' || shape.shape === 'cone' || shape.shape === 'line' || sk.t === 'foes')) {
    const enemies = (prev || []).filter(t => t.side !== u.side);
    let need = u.tactic.aoe === '3' ? 3 : u.tactic.aoe === '2' ? 2 : 1;
    if (need > 1 && st.rnd() < MISTAKE) need = 1;
    if (enemies.length < need) return false;
  }
  u.state = 'cast';
  u.castT = 0;
  u.castShape = shape;
  u.castAim = aim;
  u.castTarget = tgt && tgt !== u ? tgt.id : (aim.who || 0);
  u.channelLeft = null;
  u.vel.x = u.vel.y = 0;
  ev.push({ k: 'cast_start', a: u.id, sk: sk.id, n: sk.n, ult: !!sk.ult, el: skEl(sk, u), cast: shape.cast || 0.3 });
  addTel(st, u, shape, aim, skEl(sk, u), ev);
  return true;
}
function beginAttack(st, u, tgt, ev) {
  const sk = G.SK[u.basic];
  const el = skEl(sk, u);
  u.state = 'attack';
  u.atkT = 0;
  u.wind = 0.22;
  u.recover = 0.16;
  u.hitDone = false;
  u.atkTarget = tgt.id;
  u.vel.x = u.vel.y = 0;
  u.facing = tgt.pos.x >= u.pos.x ? 1 : -1;
  ev.push({ k: 'attack_windup', a: u.id, t: tgt.id, el, wind: u.wind });
  if (u.range > 1) addTel(st, u, { shape: 'projectile', telegraph: u.wind, cast: u.wind, radius: 10 }, { x: tgt.pos.x, y: tgt.pos.y }, el, ev);
}
function stepAttack(st, u, ev) {
  u.vel.x = u.vel.y = 0;
  u.atkT += DT;
  const tgt = byId(st, u.atkTarget);
  if (tgt && tgt.alive && tgt.pos) u.facing = tgt.pos.x >= u.pos.x ? 1 : -1;
  if (!u.hitDone && u.atkT >= u.wind) {
    u.hitDone = true;
    const sk = G.SK[u.basic];
    const el = skEl(sk, u);
    ev.push({ k: 'attack_hit', a: u.id, t: u.atkTarget, el, frame: 3 });
    ev.push({ k: 'atk', a: u.id, t: u.atkTarget, rng: u.range > 1, el });
    if (tgt && tgt.alive && tgt.pos && u.alive) {
      if (u.range <= 1) {
        if (euclid(u, tgt) <= rangeUnits(u) + 14) basicAttack(st, u, tgt, ev);
      } else {
        const from = muzzle(u);
        const dx = tgt.pos.x - from.x, dy = (tgt.pos.y - 6) - from.y;
        const L = Math.hypot(dx, dy) || 1;
        spawnProj(st, u, { x: from.x, y: from.y, vx: dx / L * 520, vy: dy / L * 520, r: 10, el, life: 1.4, pierce: 0, basic: true }, ev);
      }
    }
  }
  if (u.atkT >= u.wind + u.recover) {
    u.state = 'idle';
    const period = 1 / Math.max(0.25, effAS(st, u));
    u.atkCd = Math.max(0.05, period - u.wind - u.recover);
  }
}
function stepCast(st, u, ev) {
  u.vel.x = u.vel.y = 0;
  u.castT += DT;
  const shape = u.castShape;
  if (shape && shape.channel && u.channelLeft == null && u.castT >= (shape.cast || 0)) u.channelLeft = shape.channel;
  if (u.channelLeft != null) {
    u.channelLeft -= DT;
    const sk = G.SK[u.skill];
    ev.push({ k: 'channel', a: u.id, sk: sk.id, t: u.castT, left: Math.max(0, u.channelLeft) });
    if (u.channelLeft > 0) return;
  } else if (u.castT < (shape && shape.cast || 0.3)) return;
  const sk = G.SK[u.skill];
  ev.push({ k: 'cast_end', a: u.id, sk: sk.id, interrupted: false });
  release(st, u, ev);
  if (u.state === 'cast') u.state = 'idle';
}
function stepDash(st, u, ev) {
  u.dashT += DT;
  const k = Math.min(1, u.dashT / (u.dashDur || 0.22));
  u.pos.x = u.dashFrom.x + (u.dashTo.x - u.dashFrom.x) * k;
  u.pos.y = u.dashFrom.y + (u.dashTo.y - u.dashFrom.y) * k;
  u.vel.x = (u.dashTo.x - u.dashFrom.x) / (u.dashDur || 0.22);
  u.vel.y = (u.dashTo.y - u.dashFrom.y) / (u.dashDur || 0.22);
  u.facing = u.vel.x >= 0 ? 1 : -1;
  if (k < 1) return;
  const tgt = byId(st, u.dashHit);
  const sk = G.SK[u.dashSk];
  syncCell(u, null);
  ev.push({ k: 'blink', u: u.id, x: u.x, y: u.y });
  const tg = tgt && tgt.alive ? [tgt] : [];
  u.dashT = null;
  u.state = 'idle';
  payTargets(st, u, sk, tg, ev, u.castShape || { shape: 'dash' });
}
function interrupt(st, u, ev) {
  if (u.state === 'cast' || u.state === 'dash') {
    const sk = G.SK[u.skill];
    if (sk) ev.push({ k: 'cast_end', a: u.id, sk: sk.id, interrupted: true });
  }
  u.castShape = null;
  u.channelLeft = null;
  u.dashT = null;
  u.state = 'hit';
  u.hitT = 0.18;
  st.telegraphs = st.telegraphs.filter(g => g.a !== u.id);
}
function think(st, u, ev) {
  if (u.castCd > 0) u.castCd -= DT;
  const foes = alive(st, 1 - u.side);
  if (foes.length && u.mana >= manaNeed(st, u) && u.castCd <= 0) {
    if (tryCast(st, u, ev)) return;
  }
  const tgt = focusOf(st, u);
  if (!tgt) { u.state = 'idle'; u.vel.x = u.vel.y = 0; return; }
  const d = euclid(u, tgt);
  const rd = rangeUnits(u);
  if (d <= rd && u.atkCd <= 0) { beginAttack(st, u, tgt, ev); return; }
  if (d <= rd && u.atkCd > 0) u.atkCd -= DT;
  steer(st, u, tgt);
}
function act(st, u, ev) {
  if (!u.alive) { u.state = 'dead'; return; }
  if (!u.pos) return;
  u.prev.x = u.pos.x; u.prev.y = u.pos.y;
  if (u.st && u.st.stun) {
    if (u.state === 'cast' || u.state === 'attack' || u.state === 'dash') interrupt(st, u, ev);
    u.state = 'hit';
    u.vel.x = u.vel.y = 0;
    return;
  }
  if (u.state === 'dash' && u.dashT != null) return stepDash(st, u, ev);
  if (u.state === 'attack') return stepAttack(st, u, ev);
  if (u.state === 'cast') return stepCast(st, u, ev);
  if (u.hitT > 0) {
    u.hitT -= DT;
    u.vel.x = u.vel.y = 0;
    if (u.hitT > 0) return;
  }
  think(st, u, ev);
}
function onProjHit(st, p, u, ev) {
  const a = byId(st, p.a);
  if (!a || !a.alive || !u.alive) return;
  if (p.basic) { basicAttack(st, a, u, ev); return; }
  const sk = G.SK[p.skill];
  if (!sk) return;
  if (p.friendly || u.side === a.side) applyFx(st, a, u, sk, ev);
  else {
    if (sk.pow) hit(st, a, u, sk, ev, { single: true, exec: sk.exec });
    applyFx(st, a, u, sk, ev);
  }
}
function stepProjs(st, ev) {
  for (const p of st.projs) {
    p.prev.x = p.pos.x; p.prev.y = p.pos.y;
    if (p.homing && p.target) {
      const t = byId(st, p.target);
      if (t && t.alive && t.pos) {
        const dx = t.pos.x - p.pos.x, dy = t.pos.y - p.pos.y;
        const L = Math.hypot(dx, dy) || 1;
        const sp = Math.hypot(p.vel.x, p.vel.y) || 420;
        p.vel.x = dx / L * sp; p.vel.y = dy / L * sp;
      }
    }
    p.pos.x += p.vel.x * DT;
    p.pos.y += p.vel.y * DT;
    p.life -= DT;
    if (!Number.isFinite(p.pos.x) || !Number.isFinite(p.pos.y)) { p.life = 0; continue; }
    for (const u of st.units) {
      if (!u.alive || !u.pos || p.seen[u.id] || u.id === p.a) continue;
      if (u.side === p.side && (p.friendly ? false : p.ff === 'avoid')) continue;
      if (hypot2(u.pos.x, u.pos.y, p.pos.x, p.pos.y) <= (u.radius + p.radius) * (u.radius + p.radius)) {
        p.seen[u.id] = 1;
        onProjHit(st, p, u, ev);
        if (p.pierce <= 0) { p.life = 0; break; }
        p.pierce -= 1;
      }
    }
  }
  st.projs = st.projs.filter(p => p.life > 0 && p.pos.x > -80 && p.pos.x < AW + 80 && p.pos.y > -80 && p.pos.y < AH + 80);
}
function separate(st) {
  const us = st.units.filter(u => u.alive && u.pos);
  for (let i = 0; i < us.length; i++) {
    for (let j = i + 1; j < us.length; j++) {
      let dx = us[j].pos.x - us[i].pos.x;
      let dy = us[j].pos.y - us[i].pos.y;
      let d2 = dx * dx + dy * dy;
      const min = us[i].radius + us[j].radius;
      if (d2 === 0) { dx = (i & 1) ? 1 : -1; dy = 0.25; d2 = dx * dx + dy * dy; }
      if (d2 >= min * min) continue;
      const d = Math.sqrt(d2);
      const push = (min - d) * 0.5;
      const nx = dx / d, ny = dy / d;
      us[i].pos.x -= nx * push;
      us[i].pos.y -= ny * push;
      us[j].pos.x += nx * push;
      us[j].pos.y += ny * push;
    }
  }
  for (const u of us) clampBody(u);
}
function syncCell(u, ev) {
  if (!u.pos) return;
  const x = Math.max(0, Math.min(W - 1, Math.floor(u.pos.x / CELL)));
  const y = Math.max(0, Math.min(H - 1, Math.floor(u.pos.y / CELL)));
  if (x !== u.x || y !== u.y) {
    u.x = x; u.y = y;
    if (ev) ev.push({ k: 'move', u: u.id, x, y });
  }
}
function checkOver(st, ev) {
  if (st.over) return;
  if (!alive(st, 0).length) { st.over = 2; ev.push({ k: 'end', win: false }); }
  else if (!alive(st, 1).length) { st.over = 1; ev.push({ k: 'end', win: true }); }
}
function tick(st) {
  const ev = [];
  if (st.over) return ev;
  st.n = (st.n || 0) + 1;
  st.t = st.n / HZ;
  if (st.t + 1e-9 >= st.nextSec) { st.nextSec += 1; everySecond(st, ev); checkOver(st, ev); }
  for (const u of st.units) if (u.alive && u.st) {
    for (const k in u.st) {
      const s = u.st[k];
      if (s && s.t != null) { s.t -= DT; if (s.t <= 0) delete u.st[k]; }
    }
  }
  const order = st.units.filter(u => u.alive).sort((a, b) => a.id - b.id);
  for (const u of order) {
    if (!u.alive || st.over) continue;
    act(st, u, ev);
    checkOver(st, ev);
  }
  if (!st.over) stepProjs(st, ev);
  for (const g of st.telegraphs) g.left -= DT;
  st.telegraphs = st.telegraphs.filter(g => g.left > 0);
  separate(st);
  for (const u of st.units) if (u.pos) { clampBody(u); if (u.alive) syncCell(u, ev); }
  checkOver(st, ev);
  if (!st.over && st.t + 1e-9 >= TIME_LIMIT) { st.over = 2; ev.push({ k: 'end', win: false, timeout: true }); }
  for (const e of ev) st.ev.push(e);
  return ev;
}
function resolve(st) {
  let n = 0;
  const cap = HZ * TIME_LIMIT + 5;
  while (!st.over && n++ < cap) tick(st);
  return st;
}
function lerp(a, b, t) { return a + (b - a) * t; }
function view(st, alpha) {
  alpha = Math.max(0, Math.min(0.999, +alpha || 0));
  return {
    ev: EV, t: st.t, alpha, over: st.over, aw: AW, ah: AH,
    units: st.units.map(u => ({
      id: u.id, side: u.side,
      x: lerp(u.prev ? u.prev.x : u.pos.x, u.pos.x, alpha),
      y: lerp(u.prev ? u.prev.y : u.pos.y, u.pos.y, alpha),
      facing: u.facing, r: u.radius, hp: u.hp, maxHp: u.maxHp, shield: u.shield || 0,
      mana: u.mana, manaNeed: manaNeed(st, u),
      state: u.alive ? (u.state || 'idle') : 'dead',
      name: u.name, el: u.el, boss: !!u.boss, star: u.star, alive: !!u.alive,
    })),
    projs: (st.projs || []).map(p => ({
      id: p.id, x: lerp(p.prev.x, p.pos.x, alpha), y: lerp(p.prev.y, p.pos.y, alpha),
      vx: p.vel.x, vy: p.vel.y, r: p.radius, el: p.el, friendly: !!p.friendly,
    })),
    telegraphs: (st.telegraphs || []).map(g => ({
      id: g.id, shape: g.shape, x: g.pos.x, y: g.pos.y, x2: g.x2, y2: g.y2,
      r: g.r, ang: g.ang || 0, arc: g.arc || 0, el: g.el, left: g.left, dur: g.dur,
    })),
  };
}

root.GArena = {
  W, H, AW, AH, CELL, DT, HZ, TIME_LIMIT, EV, MISTAKE,
  create, tick, resolve, alive, byId, view, hit, skillShape, tacticOf, SHAPES, rangeUnits,
};
})(typeof window !== 'undefined' ? window : globalThis);
