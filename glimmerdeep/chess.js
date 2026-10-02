// Glimmerdeep auto-chess combat. Pure logic, no DOM: game.js steps a fight with tick()
// and animates the events it returns; sim.js runs whole runs headless.
// Board: 8 columns x 5 rows. The player owns columns 0-3, the enemy 4-7.
(function (root) {
'use strict';
const G = root.GD;
const W = 8, H = 5, DT = 0.1, TIME_LIMIT = 60;

function mkRng(seed) {
  let a = (seed >>> 0) || 1;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---- team bonus: relics + set bonuses + perks folded into one object ----------
function addB(dst, b) { for (const k in b) dst[k] = (dst[k] || 0) + b[k]; }
function relicTagCounts(relics) {
  const c = {};
  for (const id of relics || []) for (const t of (G.RELICS[id] ? G.RELICS[id].tags : [])) c[t] = (c[t] || 0) + 1;
  return c;
}
function teamBonus(relics, perks) {
  const b = {};
  for (const id of relics || []) if (G.RELICS[id]) addB(b, G.RELICS[id].b);
  const c = relicTagCounts(relics);
  for (const t in c) if (c[t] >= 3 && G.SETS[t]) addB(b, G.SETS[t].b);
  perks = perks || {};
  if (perks.rally) addB(b, { atkMul: 0.1 });
  if (perks.bulwark) addB(b, { defMul: 0.1, hpMul: 0.1 });
  if (perks.tactician) addB(b, { startOd: 25 });
  return b;
}

// ---- creature stats --------------------------------------------------------------
function instMods(inst) {
  const m = {};
  for (const k of inst.muts || []) if (G.MUTS[k]) addB(m, G.MUTS[k].b);
  if (inst.charm && G.CHARMS[inst.charm]) {
    const cb = G.CHARMS[inst.charm].b;
    for (const k in cb) if (k !== 'el') m[k] = (m[k] || 0) + cb[k];
  }
  return m;
}
const STAR_HP = [0, 1, 1.8, 3.2], STAR_DEF = [0, 1, 1.25, 1.5];
const TIER_MUL = [1, 1, 1.12, 1.25, 1.42, 1.62];
function stats(inst, bonus) {
  bonus = bonus || {};
  const m = instMods(inst);
  let base, as, range, mul;
  if (inst.boss) {
    const Bo = G.BOSSES[inst.boss], r = G.ROLE.striker;
    base = { hp: r.hp * Bo.hp, atk: r.atk * Bo.atk, def: r.def * Bo.def, spd: Bo.spd };
    as = 0.75 * Bo.spd; range = G.BOSS_RANGE[inst.boss] || 1; mul = 1;
  } else {
    const S = G.SP[inst.sp], r = G.ROLE[S.role];
    base = { hp: r.hp * (S.mod.hp || 1), atk: r.atk * (S.mod.atk || 1), def: r.def * (S.mod.def || 1), spd: S.mod.spd || 1 };
    as = G.ROLE_AS[S.role] * base.spd; range = G.RANGE[inst.sp]; mul = TIER_MUL[G.TIER[inst.sp]];
  }
  const star = inst.boss ? 1 : (inst.star || 1);   // a boss' power comes from its scale
  const k = mul * (inst.shiny ? 1.1 : 1) * (inst.scale || 1);
  return {
    hp: Math.round(base.hp * 3.5 * k * STAR_HP[star] * (1 + (m.hp || 0) + (bonus.hpMul || 0))),
    atk: base.atk * k * STAR_HP[star] * (1 + (m.atk || 0) + (bonus.atkMul || 0)),
    def: base.def * k * STAR_DEF[star] * (1 + (m.def || 0) + (bonus.defMul || 0)),
    as: as * (1 + (m.spd || 0)) * (1 + 0.05 * (star - 1)), range,
    crit: 0.05 + (m.crit || 0), critDmg: 0.5 + (m.critDmg || 0), ls: m.ls || 0, regen: (m.regen || 0) * 0.4,
    thorns: m.thorns || 0, od: 1 + (m.od || 0), manaDisc: (m.cd || 0) * 0.15, reach: m.reach || 0, grit: m.grit || 0,
    sure: m.sureStatus || 0,
  };
}
function name(inst) { return inst.boss ? G.BOSSES[inst.boss].name : G.SP[inst.sp].names[(inst.star || 1) - 1]; }
function art(inst) { return inst.boss ? G.BOSSES[inst.boss].art : 'cr_' + inst.sp + (inst.star || 1); }
function elOf(inst) { return inst.boss ? G.BOSSES[inst.boss].el : G.SP[inst.sp].el; }
function roleOf(inst) { return inst.boss ? 'boss' : G.SP[inst.sp].role; }
// the skills a creature can carry as its auto-cast power
function castables(inst) {
  if (inst.boss) return G.BOSSES[inst.boss].sk.slice(1);
  const S = G.SP[inst.sp];
  return (inst.star || 1) >= 2 ? [S.sk[1], S.sk[2], S.sk[3]] : [S.sk[1], S.sk[2]];
}
function defaultSkill(inst) { const c = castables(inst); return inst.star >= 2 && !inst.boss ? c[2] : c[0]; }
function basicOf(inst) { return inst.boss ? G.BOSSES[inst.boss].sk[0] : G.SP[inst.sp].sk[0]; }
function manaCost(id) { const sk = G.SK[id]; return sk.ult ? 100 : sk.cd >= 3 ? 80 : 60; }

// ---- traits ------------------------------------------------------------------------
// element traits count different species; role traits likewise
function traitCounts(insts) {
  const el = {}, role = {}, seenE = {}, seenR = {};
  for (const i of insts) {
    if (i.boss) continue;
    const S = G.SP[i.sp];
    const ke = S.el + ':' + i.sp;
    if (!seenE[ke]) { seenE[ke] = 1; el[S.el] = (el[S.el] || 0) + 1; }
    if (i.el2 && !seenE[i.el2 + ':' + i.sp]) { seenE[i.el2 + ':' + i.sp] = 1; el[i.el2] = (el[i.el2] || 0) + 1; }
    if (!seenR[i.sp]) { seenR[i.sp] = 1; role[S.role] = (role[S.role] || 0) + 1; }
  }
  return { el, role };
}
function traitTiers(insts) {
  const c = traitCounts(insts), t = { el: {}, role: {}, c };
  for (const e of G.ELS) t.el[e] = (c.el[e] || 0) >= G.EL_AT[1] ? 1 : (c.el[e] || 0) >= G.EL_AT[0] ? 0 : -1;
  for (const r in G.ROLE_TRAITS) { const at = G.ROLE_TRAITS[r].at, n = c.role[r] || 0; t.role[r] = n >= (at[1] || 99) ? 1 : n >= at[0] ? 0 : -1; }
  return t;
}
function applyTraits(b, T) {
  const E = T.el, Ro = T.role;
  if (E.volt >= 0) { b.asMul = (b.asMul || 0) + (E.volt ? 0.25 : 0.12); if (E.volt) b.stunPlus = (b.stunPlus || 0) + 0.1; }
  if (E.shade >= 0) { b.crit = (b.crit || 0) + (E.shade ? 0.2 : 0.1); b.critCurse = 1; if (E.shade) b.critDmg = (b.critDmg || 0) + 0.2; }
  if (E.bloom >= 0) { b.regen = (b.regen || 0) + (E.bloom ? 0.02 : 0.01); if (E.bloom) b.healAmp = (b.healAmp || 0) + 0.2; }
  if (E.tide >= 0) b.startSoak = 1;
  if (E.tide >= 1) b.regen = (b.regen || 0) + 0.01;
  if (E.ember >= 0) { b.burnTurns = (b.burnTurns || 0) + (E.ember ? 2 : 1); b.burnAmp = (b.burnAmp || 0) + (E.ember ? 0.6 : 0.25); }
  if (E.stone >= 0) { b.frontDef = E.stone ? 0 : 0.25; if (E.stone) { b.defMul2 = 0.3; b.frontShield = 0.15; } }
  if (E.frost >= 0) { b.startChill = E.frost ? 8 : 4; if (E.frost) b.chillAmp = 0.15; }
  if (E.gale >= 0) { b.dodge = (b.dodge || 0) + (E.gale ? 0.22 : 0.12); if (E.gale) b.asMul = (b.asMul || 0) + 0.15; }
  if (E.metal >= 0) { b.dr = (b.dr || 0) + (E.metal ? 0.2 : 0.1); if (E.metal) b.reflectAll = 0.1; }
  if (E.mystic >= 0) { b.odRate = (b.odRate || 0) + (E.mystic ? 0.6 : 0.3); if (E.mystic) b.startOd = (b.startOd || 0) + 30; }
  if (Ro.striker >= 0) b.asMul = (b.asMul || 0) + (Ro.striker ? 0.4 : 0.15);
  if (Ro.caster >= 0) { b.skillAmp = (b.skillAmp || 0) + (Ro.caster ? 0.45 : 0.2); if (Ro.caster) b.manaDisc = (b.manaDisc || 0) + 0.15; }
  if (Ro.tank >= 0) { b.tankShield = Ro.tank ? 0.4 : 0.2; if (Ro.tank) b.defMul2 = (b.defMul2 || 0) + 0.2; }
  if (Ro.support >= 0) { b.healAmp = (b.healAmp || 0) + 0.3; b.shieldAmp = (b.shieldAmp || 0) + 0.3; b.startOd = (b.startOd || 0) + 20; }
}

// ---- setup -----------------------------------------------------------------------------
let UID = 1;
function makeUnit(st, inst, side, x, y) {
  const b = st.bonus[side], s = stats(inst, b);
  const u = {
    id: UID++, side, x, y, inst, name: name(inst), art: art(inst), el: elOf(inst), el2: inst.el2 || null, role: roleOf(inst),
    star: inst.boss ? 3 : (inst.star || 1), boss: inst.boss || null, elite: inst.elite || null, shiny: !!inst.shiny,
    maxHp: s.hp, hp: s.hp, b: s, range: s.range, basic: basicOf(inst), skill: inst.skill && castables(inst).includes(inst.skill) ? inst.skill : defaultSkill(inst),
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
  // boss passives
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
  if (side === 1 && st.depth) { const d = 1 + 0.08 * st.depth; u.maxHp = Math.round(u.maxHp * d); u.hp = u.maxHp; u.b.atk *= d; }
  return u;
}
// o: {board:[{inst,x,y}], enemies:[{inst,x,y}], relics, perks, biome, seed, depth, mods:{bomb, elixir}}
function create(o) {
  const st = {
    units: [], t: 0, biome: o.biome || 'verdant', haz: G.BIOMES[o.biome || 'verdant'].haz, over: 0, ev: [],
    rnd: mkRng(o.seed || (Math.random() * 1e9)), depth: o.depth || 0, litUntil: 0,
    bonus: [teamBonus(o.relics, o.perks), {}], phoenix: [false, false], nextSec: 1, goldBonus: 0,
  };
  st.traits = [traitTiers(o.board.map(p => p.inst)), traitTiers(o.enemies.map(p => p.inst))];
  applyTraits(st.bonus[0], st.traits[0]);
  applyTraits(st.bonus[1], st.traits[1]);
  for (const p of o.board) st.units.push(makeUnit(st, p.inst, 0, p.x, p.y));
  for (const p of o.enemies) st.units.push(makeUnit(st, p.inst, 1, p.x, p.y));
  for (const side of [0, 1]) {
    const mine = alive(st, side), b = st.bonus[side];
    const ec = {};
    for (const u of mine) ec[u.el] = (ec[u.el] || 0) + 1;
    if (b.kinship) b.kin = b.kinship * Object.keys(ec).length;
    if (b.mono && Math.max(0, ...Object.values(ec)) >= 4) b.monoOn = b.mono;
    // front column: the one closest to the enemy that holds a unit
    const fx = side === 0 ? Math.max(...mine.map(u => u.x)) : Math.min(...mine.map(u => u.x));
    const bx = side === 0 ? Math.min(...mine.map(u => u.x)) : Math.max(...mine.map(u => u.x));
    for (const u of mine) { u.front = u.x === fx; u.back = u.x === bx && fx !== bx; }
  }
  const ev = st.ev;
  for (const u of st.units) {
    const b = st.bonus[u.side];
    if (b.startShield) giveShield(st, u, u, b.startShield, ev, true);
    if (b.frontShield && u.front) giveShield(st, u, u, b.frontShield, ev, true);
    if (b.tankShield && u.role === 'tank') giveShield(st, u, u, b.tankShield, ev, true);
  }
  for (const side of [0, 1]) if (st.bonus[side].startSoak) for (const e of alive(st, 1 - side)) applyStatus(st, null, e, 'soak', ev, 5);
  for (const u of st.units) if (u.frostAura) for (const e of alive(st, 1 - u.side)) applyStatus(st, null, e, 'chill', ev, u.frostAura);
  for (const side of [0, 1]) if (st.bonus[side].startChill) for (const e of alive(st, 1 - side)) applyStatus(st, null, e, 'chill', ev, st.bonus[side].startChill);
  if (st.haz === 'flood') for (const u of st.units) if (!(u.side === 0 && st.bonus[0].immune_flood)) u.st.wet = { t: 1e9 };
  if (o.mods && o.mods.bomb) for (const e of alive(st, 1)) e.hp = Math.round(e.hp * 0.8);
  if (o.mods && o.mods.elixir) for (const u of alive(st, 0)) u.mana = Math.min(99, u.mana + 60);
  return st;
}

// ---- helpers ------------------------------------------------------------------------------
const alive = (st, side) => st.units.filter(u => u.alive && u.side === side);
const byId = (st, id) => st.units.find(u => u.id === id);
const pct = u => u.hp / u.maxHp;
const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
function buffV(u, k) { const s = u.st[k]; return s ? s.v : 0; }
function occupied(st, x, y) { return st.units.some(u => u.alive && u.x === x && u.y === y); }
function effAtk(st, u) {
  const b = st.bonus[u.side];
  let a = u.b.atk * (1 + buffV(u, 'atkUp') + (b.kin || 0));
  if (u.front && b.frontAtk) a *= 1 + b.frontAtk;
  if (b.shieldAtk && u.shield > 0) a *= 1 + b.shieldAtk;
  if (u.elite === 'enraged' && pct(u) < 0.5) a *= 1.35;
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
function effAS(st, u) {
  const b = st.bonus[u.side];
  let s = u.b.as * (1 + buffV(u, 'spdUp') + (b.asMul || 0) + (b.kin || 0) + (st.tempoUntil > st.t && u.side === 0 ? 0.3 : 0) + (u.enraged ? 0.5 : 0));
  if (u.st.chill) s *= 0.7;
  return Math.min(3, s);
}
function manaNeed(st, u) {
  const b = st.bonus[u.side];
  return manaCost(u.skill) * Math.max(0.5, 1 - (b.manaDisc || 0) - u.b.manaDisc) * (u.st.hex ? 1.25 : 1);
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
function moveTo(u, x, y, ev) { u.x = x; u.y = y; ev.push({ k: 'move', u: u.id, x, y }); }
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
    t.st.burn = { t: dur, v: Math.max(dmg, t.st.burn ? t.st.burn.v : 0) };
  } else if (key === 'poison') {
    const add = (n || 1) + (sb.poisonPlus || 0);
    const per = Math.max(1, Math.round((src ? effAtk(st, src) : t.maxHp * 0.015) * 0.1));
    const cur = t.st.poison || { n: 0, v: per };
    t.st.poison = { n: Math.min(10, cur.n + add), v: Math.max(cur.v, per) };
  } else if (key === 'stun') {
    if (tb.stunImmune || t.st.stunImm) return;
    t.st.stun = { t: t.boss ? 0.75 : 1.5 };
    t.st.stunImm = { t: (t.boss ? 0.75 : 1.5) + 2 };
  } else if (key === 'blind') {
    if (t.side === 0 && tb.immune_dark) return;
    t.st.blind = { t: 3 + extra };
  } else if (key === 'soak') t.st.soak = { t: (secs || 4) + extra };
  else if (key === 'root') t.st.root = { t: 2.5 + extra };
  else if (key === 'chill') t.st.chill = { t: (secs || 3) + extra };
  else if (key === 'shred') t.st.shred = { t: 4 + extra };
  else if (key === 'hex') t.st.hex = { t: 5 + extra };
  else if (key === 'curse') t.st.curse = { t: 5 + extra };
  else return;
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
  const dodge = buffV(d, 'dodge') + (db.dodge || 0) + (d.el === 'shade' ? (db.shadeDodge || 0) : 0);
  if (!o.noMiss && st.rnd() < miss + dodge * (1 - miss)) {
    ev.push({ k: 'miss', t: d.id, a: a.id, dodge: dodge > miss });
    return 0;
  }
  if (el === 'ember' && st.haz === 'dark') st.litUntil = st.t + 2;
  const A = effAtk(st, a), D = effDef(st, d);
  const pow = o.basic ? 1 : (sk.pow || 0) / 100 * 1.6 * (o.powMul || 1) * (1 + (ab.skillAmp || 0));
  let dmg = A * pow * (A / (A + 0.65 * D));
  const ef = G.eff(el, d.el);
  dmg *= ef;
  if (el === a.el || el === a.el2) dmg *= 1.2;
  dmg *= 1 + (ab['el_' + el] || 0) + (a.charmEl === el ? 0.25 : 0) + (ab.dmgMul || 0) + (ab.monoOn || 0) + (sk.ult ? (ab.ultAmp || 0) : 0);
  if (d.st.curse) dmg *= 1.15 + (ab.curseAmp || 0);
  if (d.st.chill && ab.chillAmp) dmg *= 1 + ab.chillAmp;
  if (db.dr) dmg *= 1 - db.dr;
  if (d.bossDR) dmg *= 1 - d.bossDR;
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
      for (const e of alive(st, d.side)) if (e !== d && dist(e, d) <= 1) { e.st.burn = { t: burn.t, v: Math.max(burn.v, e.st.burn ? e.st.burn.v : 0) }; ev.push({ k: 'status', t: e.id, s: 'burn' }); }
    } else if (el === 'ember' && d.st.soak && !d.st.wet) {
      react = 'Fizzle'; dmg *= 0.7; delete d.st.soak;
    } else if (el === 'shade' && d.st.curse && pct(d) < 0.25 && !d.boss) {
      react = 'Doom'; doom = true;
    }
    if (react) ev.push({ k: 'react', t: d.id, name: react });
  }
  const cc = a.b.crit + (sk.crit || 0) + (ab.crit || 0) + buffV(a, 'critUp');
  const crit = forceCrit || (ab.firstCrit && a.firstAtk) || st.rnd() < cc;
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
  const toShield = Math.min(d.shield, v);
  d.shield -= toShield;
  const rest = v - toShield;
  if (toShield > 0 && st.bonus[d.side].thorns && a && a.alive && !info.thorn)
    damage(st, d, a, Math.max(1, Math.round(toShield * st.bonus[d.side].thorns)), ev, { thorn: 1 });
  d.hp -= rest;
  if (d.hp <= 0 && d.b.grit && !d.gritUsed) { d.hp = 1; d.gritUsed = true; ev.push({ k: 'react', t: d.id, name: 'Grit!' }); }
  ev.push({ k: 'dmg', t: d.id, a: a ? a.id : null, v, crit: !!info.crit, eff: info.eff || 1, hp: Math.max(0, d.hp), sh: d.shield,
    dot: info.dot || null, thorn: !!info.thorn, basic: !!info.basic });
  if (a && a !== d && !info.dot && !info.thorn) gainMana(st, d, Math.min(15, 3 + 15 * v / d.maxHp));
  if (d.boss && !d.enraged && d.hp > 0 && d.hp < d.maxHp / 2) {
    d.enraged = true; d.st.atkUp = { v: 0.15, t: 1e9 };
    ev.push({ k: 'react', t: d.id, name: 'ENRAGED' }, { k: 'text', v: d.name + ' is enraged: much faster attacks!' });
  }
  if (d.hp <= 0) ko(st, a, d, ev);
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
    const ab = st.bonus[a.side];
    if (ab.killHeal) heal(st, a, a, ab.killHeal, ev);
  }
  if (d.st.curse && st.bonus[1 - d.side].curseSpread) for (const e of alive(st, d.side)) applyStatus(st, a, e, 'curse', ev);
}

// ---- attacks and casts ------------------------------------------------------------------------------
function basicAttack(st, u, t, ev) {
  const sk = G.SK[u.basic];
  ev.push({ k: 'atk', a: u.id, t: t.id, rng: u.range > 1, el: sk.el === 'flux' ? u.el : sk.el });
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
}
const TSEC = { atkUp: 6, defUp: 6, spdUp: 6, critUp: 6 };
function cast(st, u, ev) {
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
  for (const u of st.units.slice()) {
    if (!u.alive) continue;
    const b = st.bonus[u.side];
    if (u.st.burn) damage(st, null, u, u.st.burn.v, ev, { dot: 'burn' });
    if (u.alive && u.st.poison) { damage(st, null, u, u.st.poison.v * u.st.poison.n, ev, { dot: 'poison' }); if (u.st.poison) { u.st.poison.n--; if (u.st.poison.n <= 0) delete u.st.poison; } }
    if (!u.alive) continue;
    if (st.t >= 40) damage(st, null, u, Math.max(1, Math.round(u.maxHp * 0.015 * (st.t - 39))), ev, { dot: 'quake' });
    if (!u.alive) continue;
    if (u.side === 0) {
      if (st.haz === 'heat' && !b.immune_heat && u.el !== 'ember' && u.el !== 'stone') damage(st, null, u, Math.max(1, Math.round(u.maxHp * (u.el === 'tide' ? 0.006 : 0.012))), ev, { dot: 'heat' });
      if (st.haz === 'spores' && !b.immune_spores && u.el !== 'bloom' && u.el2 !== 'bloom' && u.alive && sec % 3 === 0) {
        const cur = u.st.poison || { n: 0, v: Math.max(1, Math.round(u.maxHp * 0.01)) };
        u.st.poison = { n: Math.min(10, cur.n + 1), v: cur.v };
        ev.push({ k: 'status', t: u.id, s: 'poison', haz: 1 });
      }
      if (b.immune_spores && sec % 5 === 0) cleanse(u, ev);
    }
    if (!u.alive) continue;
    const rg = (u.st.regen ? u.st.regen.v : 0) + (b.regen || 0) + u.b.regen;
    if (rg > 0 && u.hp < u.maxHp) heal(st, u, u, rg, ev, null, true);
  }
}
function tick(st) {
  const ev = [];
  if (st.over) return ev;
  st.t = Math.round((st.t + DT) * 10) / 10;
  if (st.t >= st.nextSec) { st.nextSec += 1; everySecond(st, ev); checkOver(st, ev); }
  // alternate which side moves first so neither gets a systematic edge
  const order = st.units.filter(u => u.alive);
  if (Math.round(st.t * 10) % 2) order.reverse();
  for (const u of order) {
    if (!u.alive || st.over) continue;
    for (const k in u.st) { const s = u.st[k]; if (s && s.t != null) { s.t -= DT; if (s.t <= 0) delete u.st[k]; } }
    if (u.st.stun) continue;
    if (u.mana >= manaNeed(st, u) && alive(st, 1 - u.side).length) {
      cast(st, u, ev); u.atkCd = Math.max(u.atkCd, 0.35); checkOver(st, ev); continue;
    }
    const t = acquire(st, u);
    if (!t) continue;
    if (dist(u, t) <= u.range) {
      u.atkCd -= DT;
      if (u.atkCd <= 0) { basicAttack(st, u, t, ev); u.atkCd += 1 / effAS(st, u); if (u.atkCd < 0) u.atkCd = 0; }
    } else if (!u.st.root) {
      u.moveCd -= DT;
      if (u.moveCd <= 0) { step(st, u, t, ev); u.moveCd = 0.45; u.atkCd = Math.max(u.atkCd, 0.15); }
    }
    checkOver(st, ev);
  }
  if (!st.over && st.t >= TIME_LIMIT) { st.over = 2; ev.push({ k: 'end', win: false, timeout: true }); }
  for (const e of ev) st.ev.push(e);
  return ev;
}
function checkOver(st, ev) {
  if (st.over) return;
  if (!alive(st, 0).length) { st.over = 2; ev.push({ k: 'end', win: false }); }   // a double knockout is a loss
  else if (!alive(st, 1).length) { st.over = 1; ev.push({ k: 'end', win: true }); }
  else if (false) { st.over = 2; ev.push({ k: 'end', win: false }); }
}
// run a fight to the end (sim and the Skip button)
function resolve(st) { let n = 0; while (!st.over && n++ < TIME_LIMIT / DT + 5) tick(st); return st; }

root.GC = { W, H, DT, TIME_LIMIT, mkRng, teamBonus, relicTagCounts, stats, name, art, elOf, roleOf, castables, defaultSkill, basicOf,
  manaCost, traitCounts, traitTiers, create, tick, resolve, alive, byId, dist, pct, manaNeed, effAS };
})(typeof window !== 'undefined' ? window : globalThis);
