// Glimmerdeep battle engine. Pure logic, no DOM: game.js animates the event list
// a round returns, and sim.js runs whole runs headless for balance.
(function (root) {
'use strict';
const G = root.GD;

function mkRng(seed) {
  let a = (seed >>> 0) || 1;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---- team bonus: relics + set bonuses + perks folded into one object ----------
function addB(dst, b) { for (const k in b) dst[k] = (dst[k] || 0) + b[k]; }
function relicTagCounts(relics) {
  const c = {};
  for (const id of relics) for (const t of (G.RELICS[id] ? G.RELICS[id].tags : [])) c[t] = (c[t] || 0) + 1;
  return c;
}
function teamBonus(relics, perks) {
  const b = {};
  for (const id of relics || []) if (G.RELICS[id]) addB(b, G.RELICS[id].b);
  const c = relicTagCounts(relics || []);
  for (const t in c) if (c[t] >= 3 && G.SETS[t]) addB(b, G.SETS[t].b);
  perks = perks || {};
  if (perks.rally) addB(b, { atkMul: 0.1 });
  if (perks.bulwark) addB(b, { defMul: 0.1, hpMul: 0.1 });
  if (perks.tactician) addB(b, { startOd: 25 });
  return b;
}

// ---- creature stats ------------------------------------------------------------
function instMods(inst) {
  const m = {};
  for (const k of inst.muts || []) if (G.MUTS[k]) addB(m, G.MUTS[k].b);
  if (inst.charm && G.CHARMS[inst.charm]) {
    const cb = G.CHARMS[inst.charm].b;
    for (const k in cb) if (k !== 'el') m[k] = (m[k] || 0) + cb[k];
  }
  return m;
}
function evoLevel(stage, bonus) {
  const minus = (bonus && bonus.evoMinus) || 0;
  return stage < 3 ? Math.max(2, G.EVO_LV[stage] - minus) : 999;
}
function lvMul(lvl) { return 1 + 0.09 * (lvl - 1); }
// stats of a party/wild creature (bonus = team bonus or null)
function instStats(inst, bonus) {
  bonus = bonus || {};
  const m = instMods(inst);
  let base, smul;
  if (inst.boss) {
    const B = G.BOSSES[inst.boss], r = G.ROLE.striker;
    base = { hp: r.hp * B.hp, atk: r.atk * B.atk, def: r.def * B.def, spd: r.spd * B.spd };
    smul = G.STAGE_MUL[3] * 0.66;
  } else {
    const S = G.SP[inst.sp], r = G.ROLE[S.role];
    base = { hp: r.hp * (S.mod.hp || 1), atk: r.atk * (S.mod.atk || 1), def: r.def * (S.mod.def || 1), spd: r.spd * (S.mod.spd || 1) };
    smul = G.STAGE_MUL[inst.stage];
  }
  const L = lvMul(inst.lvl) * smul * (inst.shiny ? 1.1 : 1) * (inst.scale || 1);
  const s = {
    hp: Math.round(base.hp * L * (1 + (m.hp || 0) + (bonus.hpMul || 0))),
    atk: base.atk * L * (1 + (m.atk || 0) + (bonus.atkMul || 0)),
    def: base.def * L * (1 + (m.def || 0) + (bonus.defMul || 0)),
    // speed barely scales with level so turn order stays readable
    spd: base.spd * (1 + 0.02 * (inst.lvl - 1)) * (1 + 0.06 * (inst.stage - 1)) * (1 + (m.spd || 0) + (bonus.spdMul || 0)),
    crit: 0.05 + (m.crit || 0), critDmg: 0.5 + (m.critDmg || 0), ls: m.ls || 0, regen: m.regen || 0,
    thorns: m.thorns || 0, od: 1 + (m.od || 0), cd: m.cd || 0, reach: m.reach || 0, grit: m.grit || 0,
    sure: m.sureStatus || 0,
  };
  return s;
}
// skills the creature knows right now: [basic, A, B?, ult?]
function knownSkills(inst) {
  if (inst.boss) return G.BOSSES[inst.boss].sk.slice();
  const S = G.SP[inst.sp], out = [S.sk[0], S.sk[1]];
  if (inst.lvl >= G.SKILL_LV[2] || inst.stage > 1) out.push(S.sk[2]);
  if (inst.stage >= 2) out.push(S.sk[3]);
  return out;
}
function instName(inst) {
  if (inst.boss) return G.BOSSES[inst.boss].name;
  return G.SP[inst.sp].names[inst.stage - 1];
}
function instArt(inst) { return inst.boss ? G.BOSSES[inst.boss].art : 'cr_' + inst.sp + inst.stage; }
function instEl(inst) { return inst.boss ? G.BOSSES[inst.boss].el : G.SP[inst.sp].el; }

// ---- battle setup -----------------------------------------------------------------
let UID = 1;
function makeFighter(st, inst, side, slot) {
  const bonus = st.bonus[side];
  const s = instStats(inst, bonus);
  const f = {
    id: UID++, side, slot, inst, name: instName(inst), art: instArt(inst), el: inst.fluxEl || instEl(inst),
    el2: inst.el2 || null, lvl: inst.lvl, stage: inst.boss ? 3 : inst.stage, boss: inst.boss || null,
    elite: inst.elite || null, shiny: !!inst.shiny, maxHp: s.hp, hp: 0, b: s,
    sk: knownSkills(inst), cds: {}, od: 0, st: {}, shield: 0, alive: true, firstAtk: true, gritUsed: false,
    summoned: !!inst.summoned, acts: 1,
  };
  f.hp = side === 0 ? Math.max(0, Math.round(f.maxHp * (inst.hpPct == null ? 1 : inst.hpPct))) : f.maxHp;
  if (f.hp <= 0) f.alive = false;
  f.charmEl = inst.charm && G.CHARMS[inst.charm] && G.CHARMS[inst.charm].b.el || null;
  if (f.elite) {
    f.maxHp = Math.round(f.maxHp * 1.3); f.hp = f.maxHp; f.b.atk *= 1.2;
    if (f.elite === 'vampiric') f.b.ls += 0.25;
    if (f.elite === 'thorned') f.b.thorns += 0.25;
    if (f.elite === 'hasty') f.b.spd *= 1.4;
    if (f.elite === 'shielded') f.shield = Math.round(f.maxHp * 0.4);
  }
  if (side === 1 && st.depth) { const d = 1 + 0.08 * st.depth; f.maxHp = Math.round(f.maxHp * d); f.hp = f.maxHp; f.b.atk *= d; }
  f.od = Math.min(100, (bonus.startOd || 0));
  return f;
}

// opts: {party:[inst], enemies:[inst], relics, perks, biome, seed, depth}
function create(o) {
  const st = {
    f: [], turn: 0, biome: o.biome || 'verdant', haz: G.BIOMES[o.biome || 'verdant'].haz, over: 0,
    rnd: mkRng(o.seed || (Math.random() * 1e9)), depth: o.depth || 0, focus: null, lit: false,
    bonus: [teamBonus(o.relics, o.perks), {}], phoenix: [false, false], log: [], itemUsed: false,
  };
  // the wyrm and the core shift elements; bosses have no team bonus
  (o.party || []).slice(0, 4).forEach((inst, i) => st.f.push(makeFighter(st, inst, 0, i)));
  (o.enemies || []).slice(0, 4).forEach((inst, i) => st.f.push(makeFighter(st, inst, 1, i)));
  // team traits (by element count among living fighters at the start)
  st.traits = [traitTiers(st, 0), traitTiers(st, 1)];
  for (const side of [0, 1]) {
    const T = st.traits[side], b = st.bonus[side];
    if (T.volt >= 0) b.spdMul2 = T.volt ? 0.25 : 0.12;
    if (T.volt >= 1) b.stunPlus = (b.stunPlus || 0) + 0.1;
    if (T.shade >= 0) { b.crit = (b.crit || 0) + (T.shade ? 0.2 : 0.1); b.critCurse = 1; if (T.shade) b.critDmg = (b.critDmg || 0) + 0.2; }
    if (T.bloom >= 0) { b.regen = (b.regen || 0) + (T.bloom ? 0.06 : 0.03); if (T.bloom) b.healAmp = (b.healAmp || 0) + 0.2; }
    if (T.tide >= 0) b.startSoak = 1;
    if (T.tide >= 1) b.tideRegen = 0.04;
    if (T.ember >= 0) { b.burnTurns = (b.burnTurns || 0) + (T.ember ? 2 : 1); b.burnAmp = (b.burnAmp || 0) + (T.ember ? 0.6 : 0.25); }
    if (T.stone >= 0) { b.frontDef = T.stone ? 0 : 0.25; if (T.stone) { b.defMul2 = 0.3; b.frontShield = 0.15; } }
    // kinship / mono
    const els = new Set(alive(st, side).map(f => f.el));
    if (b.kinship) b.kin = b.kinship * els.size;
    if (b.mono && els.size === 1 && alive(st, side).length >= 2) b.monoOn = b.mono;
  }
  const ev = [];
  for (const f of st.f) {
    if (!f.alive) continue;
    const b = st.bonus[f.side];
    if (b.startShield) giveShield(st, f, f, b.startShield, ev, true);
    if (b.frontShield && f.slot < 2) giveShield(st, f, f, b.frontShield, ev, true);
  }
  for (const side of [0, 1]) {
    if (st.bonus[side].startSoak) for (const e of alive(st, 1 - side)) applyStatus(st, null, e, 'soak', 1, ev, 2);
  }
  if (st.haz === 'flood') for (const f of st.f) if (!(f.side === 0 && st.bonus[0].immune_flood)) f.st.wet = 1;
  st.startEv = ev;
  return st;
}
function traitTiers(st, side) {
  const c = {};
  for (const f of alive(st, side)) { c[f.el] = (c[f.el] || 0) + 1; if (f.el2 && f.el2 !== f.el) c[f.el2] = (c[f.el2] || 0) + 1; }
  const t = {};
  for (const e of G.ELS) t[e] = (c[e] || 0) >= 3 ? 1 : (c[e] || 0) >= 2 ? 0 : -1;
  t._c = c;
  return t;
}

// ---- helpers ---------------------------------------------------------------------------
const alive = (st, side) => st.f.filter(f => f.alive && f.side === side);
const byId = (st, id) => st.f.find(f => f.id === id);
const pct = f => f.hp / f.maxHp;
function buffV(f, k) { const s = f.st[k]; return s ? s.v : 0; }
function effAtk(st, f) {
  const b = st.bonus[f.side];
  let a = f.b.atk * (1 + buffV(f, 'atkUp') + (b.kin || 0));
  if (f.slot < 2 && b.frontAtk) a *= 1 + b.frontAtk;
  if (b.shieldAtk && f.shield > 0) a *= 1 + b.shieldAtk;
  if (f.elite === 'enraged' && pct(f) < 0.5) a *= 1.35;
  return a;
}
function effDef(st, f) {
  const b = st.bonus[f.side];
  let d = f.b.def * (1 + buffV(f, 'defUp') + (b.kin || 0) + (b.defMul2 || 0));
  if (f.slot < 2 && b.frontDef) d *= 1 + b.frontDef;
  if (b.voltDef && f.el === 'volt') d *= 1 + b.voltDef;
  return d;
}
function effSpd(st, f) {
  const b = st.bonus[f.side];
  let s = f.b.spd * (1 + buffV(f, 'spdUp') + (b.spdMul2 || 0) + (b.kin || 0) + (st.tempoOn && f.side === 0 ? 0.3 : 0));
  if (f.st.root) s *= 0.6;
  return s;
}
function skillReady(f, id) {
  const sk = G.SK[id];
  if (sk.ult) return f.od >= 100;
  return !(f.cds[id] > 0);
}
function legalFoes(st, a, sk) {
  const foes = alive(st, 1 - a.side);
  const taunt = foes.filter(e => e.st.taunt);
  if (taunt.length && sk.t !== 'foes' && !/^foe\d$/.test(sk.t)) return taunt;
  if (sk.rng || a.b.reach || sk.t === 'lowfoe') return foes;
  const front = foes.filter(e => e.slot < 2);
  return front.length ? front : foes;
}
function skEl(a, sk) { return sk.el === 'flux' ? a.el : sk.el; }

// ---- planning (enemy AI, auto mode, and the player's default pick) ------------------
function expectedValue(st, a, id) {
  const sk = G.SK[id];
  if (!sk.pow) return 0;
  const foes = legalFoes(st, a, sk);
  if (!foes.length) return 0;
  const el = skEl(a, sk);
  const avgEff = foes.reduce((s, e) => s + G.eff(el, e.el), 0) / foes.length;
  const n = sk.t === 'foes' ? alive(st, 1 - a.side).length : /^foe(\d)$/.test(sk.t) ? +sk.t.slice(3) : 1;
  return sk.pow * n * avgEff * (el === a.el ? 1.2 : 1);
}
function autoPlan(st, a) {
  const ready = a.sk.filter(id => skillReady(a, id));
  const allies = alive(st, a.side);
  const ult = ready.find(id => G.SK[id].ult);
  if (ult) return { sk: ult };
  const low = allies.some(f => pct(f) < 0.55);
  for (const id of ready) {
    const sk = G.SK[id], fx = sk.fx || {};
    if (fx.summon && allies.length < 4) return { sk: id };
    if ((fx.heal && sk.t !== 'self' || fx.allyHeal) && low) return { sk: id };
    if (fx.heal && sk.t === 'self' && pct(a) < 0.5) return { sk: id };
    if (fx.shield && sk.t === 'allies' && (st.turn <= 1 || low)) return { sk: id };
    if (fx.shield && sk.t === 'self' && pct(a) < 0.7) return { sk: id };
    if (fx.taunt && a.slot < 2 && allies.length > 1 && !a.st.taunt && pct(a) > 0.4) return { sk: id };
    if ((fx.atkUp || fx.spdUp || fx.critUp) && !a.st.atkUp && st.turn <= 2) return { sk: id };
    if (fx.od && st.turn <= 2) return { sk: id };
    if (fx.dodge && pct(a) < 0.6 && !a.st.dodge) return { sk: id };
  }
  let best = G.SP[a.inst.sp] ? G.SP[a.inst.sp].sk[0] : a.sk[0], bv = -1;
  for (const id of ready) { const v = expectedValue(st, a, id); if (v > bv) { bv = v; best = id; } }
  return { sk: best };
}
// smart single target among legal foes
function pickTarget(st, a, sk, want) {
  const foes = legalFoes(st, a, sk);
  if (!foes.length) return null;
  if (want) { const w = foes.find(f => f.id === want); if (w) return w; }
  if (sk.t === 'lowfoe') return foes.slice().sort((x, y) => pct(x) - pct(y))[0];
  const el = skEl(a, sk);
  let best = foes[0], bv = -1e9;
  for (const e of foes) {
    const v = G.eff(el, e.el) * 2 + (1 - pct(e)) * 1.2 + (e.boss ? 0.3 : 0) + st.rnd() * 0.15;
    if (v > bv) { bv = v; best = e; }
  }
  return best;
}

// ---- effects ----------------------------------------------------------------------------
function giveShield(st, src, t, frac, ev, silent) {
  const amp = 1 + (st.bonus[src.side].shieldAmp || 0);
  const v = Math.round(t.maxHp * frac * amp);
  t.shield = Math.min(t.maxHp, t.shield + v);
  if (!silent) ev.push({ k: 'shield', t: t.id, v, sh: t.shield });
}
function heal(st, src, t, frac, ev, flat) {
  if (!t.alive) return 0;
  const b = st.bonus[t.side];
  let v = flat != null ? flat : t.maxHp * frac * (1 + (b.healAmp || 0));
  if (t.st.burn) v *= 0.5;
  v = Math.round(v);
  if (v <= 0) return 0;
  const room = t.maxHp - t.hp, got = Math.min(room, v);
  t.hp += got;
  if (v > room && b.overheal) t.shield = Math.min(t.maxHp, t.shield + (v - room));
  ev.push({ k: 'heal', t: t.id, v: got, hp: t.hp, sh: t.shield });
  return got;
}
const DEBUFFS = ['burn', 'poison', 'soak', 'stun', 'root', 'curse', 'blind'];
function cleanse(t, ev) {
  let any = false;
  for (const k of DEBUFFS) if (t.st[k]) { delete t.st[k]; any = true; }
  if (any) ev.push({ k: 'cleanse', t: t.id });
}
function applyStatus(st, src, t, key, val, ev, turnsOverride) {
  if (!t.alive) return;
  const sb = src ? st.bonus[src.side] : {}, tb = st.bonus[t.side];
  const extra = (sb.statusTurns || 0);
  if (key === 'burn') {
    let turns = 3 + (sb.burnTurns || 0) + extra;
    if (tb.immune_heat) turns = 1;
    const dmg = Math.max(1, Math.round((src ? effAtk(st, src) : t.maxHp * 0.1) * 0.28 * (1 + (sb.burnAmp || 0))));
    t.st.burn = { t: turns, v: Math.max(dmg, t.st.burn ? t.st.burn.v : 0) };
  } else if (key === 'poison') {
    const n = (val || 1) + (sb.poisonPlus || 0);
    const per = Math.max(1, Math.round((src ? effAtk(st, src) : t.maxHp * 0.05) * 0.12));
    const cur = t.st.poison || { n: 0, v: per };
    t.st.poison = { n: Math.min(10, cur.n + n), v: Math.max(cur.v, per), t: 99 };
  } else if (key === 'stun') {
    if (tb.stunImmune || t.st.stunImm) return;
    t.st.stun = { t: 1 };
  } else if (key === 'blind') {
    if (t.side === 0 && tb.immune_dark) return;
    t.st.blind = { t: 2 + extra };
  } else if (key === 'soak') t.st.soak = { t: (turnsOverride || 2) + extra };
  else if (key === 'root') t.st.root = { t: 2 + extra };
  else if (key === 'curse') t.st.curse = { t: 3 + extra };
  else return;
  ev.push({ k: 'status', t: t.id, s: key });
}
const STATUS_KEYS = ['burn', 'poison', 'soak', 'stun', 'root', 'curse', 'blind'];

// ---- damage --------------------------------------------------------------------------------
function hit(st, a, d, sk, ev, o) {
  o = o || {};
  if (!d.alive || !a.alive) return 0;
  const ab = st.bonus[a.side], db = st.bonus[d.side];
  const el = o.el || skEl(a, sk);
  // misses
  let miss = 0;
  if (a.st.blind) miss += 0.35;
  if (st.haz === 'dark' && a.side === 0 && a.el !== 'shade' && !ab.immune_dark && !st.lit) miss += 0.25;
  let dodge = buffV(d, 'dodge') + (db.dodge || 0) + (d.el === 'shade' ? (db.shadeDodge || 0) : 0);
  if (!o.noMiss && st.rnd() < miss + dodge * (1 - miss)) {
    ev.push({ k: 'miss', t: d.id, a: a.id, dodge: st.rnd() < dodge / (miss + dodge + 1e-9) });
    return 0;
  }
  if (el === 'ember' && st.haz === 'dark') st.lit = true;
  const A = effAtk(st, a), D = effDef(st, d);
  let pow = (sk.pow || 0) * (o.powMul || 1) * (a.stage === 3 && !a.boss ? 1.12 : 1);
  let dmg = A * pow / 100 * (A / (A + 0.65 * D));
  const ef = G.eff(el, d.el);
  dmg *= ef;
  if (el === a.el || el === a.el2) dmg *= 1.2;
  let amp = 1 + (ab['el_' + el] || 0) + (a.charmEl === el ? 0.25 : 0) + (ab.dmgMul || 0) + (ab.monoOn || 0) + (sk.ult ? (ab.ultAmp || 0) : 0);
  dmg *= amp;
  if (d.st.curse) dmg *= 1.15 + (ab.curseAmp || 0);
  const soaked = d.st.soak || d.st.wet;
  if (soaked && ab.soakAmp) dmg *= 1 + ab.soakAmp;
  if (el === 'ember' && st.haz === 'flood' && a.st.wet) dmg *= 0.6;
  // reactions
  let react = null, forceCrit = false;
  if (!o.noReact) {
    if (el === 'volt' && soaked) {
      react = 'Electrocute'; dmg *= 1.5 * (1 + (ab.electroAmp || 0));
      if (d.st.soak) delete d.st.soak;
      if (st.rnd() < (d.st.wet ? 0.3 : 0.6) * (d.boss ? 0.5 : 1)) applyStatus(st, a, d, 'stun', 1, ev);
    } else if (el === 'tide' && d.st.burn) {
      react = 'Steam'; dmg *= 1.3; delete d.st.burn; applyStatus(st, a, d, 'blind', 1, ev);
      if (ab.steamHeal) for (const f of alive(st, a.side)) heal(st, a, f, ab.steamHeal, ev);
    } else if (el === 'ember' && d.st.poison) {
      react = 'Blight Burst';
      const n = d.st.poison.n; delete d.st.poison;
      o.blight = n;
    } else if (el === 'stone' && d.st.root) {
      react = 'Shatter'; forceCrit = true; dmg *= 1.3 * (1 + (ab.shatterAmp || 0)); delete d.st.root;
    } else if (el === 'ember' && d.st.soak && !d.st.wet) {
      react = 'Fizzle'; dmg *= 0.7; delete d.st.soak;
    } else if (el === 'shade' && d.st.curse && pct(d) < 0.25 && !d.boss) {
      react = 'Doom'; o.doom = true;
    }
    if (react) ev.push({ k: 'react', t: d.id, name: react });
  }
  // crit
  let cc = a.b.crit + (sk.crit || 0) + (ab.crit || 0) + buffV(a, 'critUp');
  let crit = forceCrit || (ab.firstCrit && a.firstAtk) || st.rnd() < cc;
  a.firstAtk = false;
  if (crit) dmg *= 1 + a.b.critDmg + (ab.critDmg || 0);
  dmg *= 0.92 + st.rnd() * 0.16;
  if (d.slot >= 2 && db.backDR) dmg *= 1 - db.backDR;
  if (o.exec && pct(d) < o.exec && !d.boss) o.doom = true;
  dmg = Math.max(1, Math.round(dmg));
  if (o.doom) dmg = Math.max(dmg, d.hp + d.shield);
  // single-target bounce (Mirror Pond)
  if (o.single && db.mirror && st.rnd() < db.mirror && !o.noReact) {
    ev.push({ k: 'react', t: d.id, name: 'Mirrored' });
    return damage(st, d, a, dmg, ev, { crit, eff: 1 });
  }
  const dealt = damage(st, a, d, dmg, ev, { crit, eff: ef, el });
  if (crit && ab.critCurse) applyStatus(st, a, d, 'curse', 1, ev);
  if (crit && ab.critGold && a.side === 0) st.goldBonus = (st.goldBonus || 0) + ab.critGold;
  // after-hit
  const ls = a.b.ls + (ab.lifesteal || 0) + (sk.ls || 0);
  if (ls > 0 && dealt > 0) heal(st, a, a, 0, ev, dealt * ls);
  if (ab.tideHeal && el === 'tide' && dealt > 0) {
    const w = alive(st, a.side).sort((x, y) => pct(x) - pct(y))[0];
    if (w) heal(st, a, w, 0, ev, dealt * ab.tideHeal);
  }
  if (d.b.thorns > 0 && dealt > 0 && a.alive) damage(st, d, a, Math.max(1, Math.round(dealt * d.b.thorns)), ev, { thorn: 1 });
  if (o.single && st.haz === 'reflect' && d.side === 1 && a.side === 0 && !ab.immune_reflect && dealt > 0 && a.alive)
    damage(st, d, a, Math.max(1, Math.round(dealt * 0.2)), ev, { thorn: 1, reflect: 1 });
  if (o.blight) {
    const per = (1 + (ab.blightAmp || 0)) * 0.05;
    for (const e of alive(st, d.side)) damage(st, a, e, Math.max(1, Math.round(e.maxHp * per * o.blight * (e.boss ? 0.35 : 1))), ev, { blight: 1 });
  }
  if (ab.voltChain && el === 'volt' && o.single && !o.chained) {
    const other = alive(st, d.side).filter(e => e !== d)[0];
    if (other) hit(st, a, other, sk, ev, { powMul: (o.powMul || 1) * ab.voltChain, chained: true, noReact: true, noMiss: true });
  }
  return dealt;
}
// raw damage through shields; handles knockouts
function damage(st, a, d, v, ev, info) {
  if (!d.alive) return 0;
  info = info || {};
  let toShield = Math.min(d.shield, v);
  d.shield -= toShield;
  const rest = v - toShield;
  if (toShield > 0 && st.bonus[d.side].thorns && a && a.alive && !info.thorn)
    damage(st, d, a, Math.max(1, Math.round(toShield * st.bonus[d.side].thorns)), ev, { thorn: 1 });
  d.hp -= rest;
  if (d.hp <= 0 && d.b.grit && !d.gritUsed) { d.hp = 1; d.gritUsed = true; ev.push({ k: 'react', t: d.id, name: 'Grit!' }); }
  ev.push({ k: 'dmg', t: d.id, a: a ? a.id : null, v, crit: !!info.crit, eff: info.eff || 1, hp: Math.max(0, d.hp), sh: d.shield,
    dot: info.dot || null, thorn: !!info.thorn });
  if (a && a !== d && !info.dot && !info.thorn) d.od = Math.min(100, d.od + 8 * d.b.od);
  if (d.boss && d.acts === 1 && d.hp > 0 && d.hp < d.maxHp / 2) {
    d.acts = 2; d.st.atkUp = { v: 0.15, t: 99 };
    ev.push({ k: 'react', t: d.id, name: 'ENRAGED' }, { k: 'text', v: d.name + ' is enraged and now acts twice!' });
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
    a.od = Math.min(100, a.od + 20 * a.b.od);
    const ab = st.bonus[a.side];
    if (ab.killHeal) heal(st, a, a, ab.killHeal, ev);
  }
  if (d.st.curse && st.bonus[1 - d.side].curseSpread) {
    for (const e of alive(st, d.side)) applyStatus(st, a, e, 'curse', 1, ev);
  }
}

// ---- performing a skill ---------------------------------------------------------------------
function perform(st, a, plan, ev) {
  const sk = G.SK[plan.sk];
  const fx = sk.fx || {};
  const ab = st.bonus[a.side];
  let tg = [];
  const allies = alive(st, a.side);
  if (sk.t === 'self') tg = [a];
  else if (sk.t === 'ally') tg = [allies.slice().sort((x, y) => pct(x) - pct(y))[0]];
  else if (sk.t === 'allies') tg = allies;
  else if (sk.t === 'foes') tg = alive(st, 1 - a.side);
  else if (/^foe\d$/.test(sk.t)) tg = [];
  else { const t = pickTarget(st, a, sk, plan.tgt || (a.side === 0 ? st.focus : null)); if (t) tg = [t]; }
  ev.push({ k: 'act', a: a.id, sk: sk.id, n: sk.n, ult: !!sk.ult, el: skEl(a, sk), tg: tg.map(t => t.id), aoe: sk.t === 'foes' || sk.t === 'allies' });
  const statusCh = (base) => (a.b.sure && sk.id === a.sk[0]) ? 1 : base;
  const onTarget = (t) => {
    for (const k of STATUS_KEYS) if (fx[k] != null && t.alive) {
      if (k === 'poison') applyStatus(st, a, t, 'poison', fx[k], ev);
      else {
        let ch = statusCh(fx[k]);
        if (k === 'stun') ch = (ch + (skEl(a, sk) === 'volt' ? (ab.stunPlus || 0) : 0)) * (t.boss ? 0.5 : 1);
        if (st.rnd() < ch) applyStatus(st, a, t, k, 1, ev);
      }
    }
    if (sk.ult && ab.ultBurn && t.side !== a.side) applyStatus(st, a, t, 'burn', 1, ev);
    if (fx.heal && sk.t !== 'foe') heal(st, a, t, fx.heal, ev);
    if (fx.shield) giveShield(st, a, t, fx.shield, ev);
    if (fx.cleanse) cleanse(t, ev);
    if (fx.regen) { t.st.regen = { v: fx.regen, t: 3 }; ev.push({ k: 'status', t: t.id, s: 'regen' }); }
    for (const k of ['atkUp', 'defUp', 'spdUp', 'critUp']) if (fx[k]) { t.st[k] = { v: fx[k], t: 3 }; ev.push({ k: 'status', t: t.id, s: k }); }
    if (fx.dodge) { t.st.dodge = { v: fx.dodge, t: 2 }; ev.push({ k: 'status', t: t.id, s: 'dodge' }); }
    if (fx.taunt) { t.st.taunt = { t: fx.taunt }; ev.push({ k: 'status', t: t.id, s: 'taunt' }); }
    if (fx.od) { t.od = Math.min(100, t.od + fx.od); ev.push({ k: 'od', t: t.id, v: t.od }); }
  };
  if (/^foe\d$/.test(sk.t)) {
    const n = +sk.t.slice(3);
    for (let i = 0; i < n; i++) {
      const foes = alive(st, 1 - a.side);
      if (!foes.length || !a.alive) break;
      const taunt = foes.filter(e => e.st.taunt);
      const pool = taunt.length && st.rnd() < 0.5 ? taunt : foes;
      const t = pool[Math.floor(st.rnd() * pool.length)];
      ev.push({ k: 'aim', a: a.id, t: t.id });
      hit(st, a, t, sk, ev, {});
      onTarget(t);
    }
  } else {
    for (const t of tg) {
      if (sk.pow && t.side !== a.side) {
        hit(st, a, t, sk, ev, { single: tg.length === 1 && sk.t !== 'foes', exec: sk.exec });
      }
      onTarget(t);
    }
  }
  // once-per-skill effects
  if (fx.allyHeal) for (const f of alive(st, a.side)) heal(st, a, f, fx.allyHeal, ev);
  if (a.alive) {
    if (fx.selfDodge) { a.st.dodge = { v: fx.selfDodge, t: 2 }; ev.push({ k: 'status', t: a.id, s: 'dodge' }); }
    if (fx.selfSpdUp) { a.st.spdUp = { v: fx.selfSpdUp, t: 3 }; ev.push({ k: 'status', t: a.id, s: 'spdUp' }); }
    if (fx.selfDefUp) { a.st.defUp = { v: fx.selfDefUp, t: 3 }; ev.push({ k: 'status', t: a.id, s: 'defUp' }); }
    if (fx.selfShield) giveShield(st, a, a, fx.selfShield, ev);
    if (fx.selfTaunt) { a.st.taunt = { t: fx.selfTaunt + 1 }; ev.push({ k: 'status', t: a.id, s: 'taunt' }); }
  }
  if (fx.summon) summon(st, a, fx.summon, ev);
  // cooldown / overdrive
  if (sk.ult) {
    a.od = 0;
    if (ab.echo) for (const f of alive(st, a.side)) if (f !== a) { f.od = Math.min(100, f.od + ab.echo); ev.push({ k: 'od', t: f.id, v: f.od }); }
  } else {
    if (sk.cd) a.cds[sk.id] = Math.max(1, sk.cd - (ab.cdMinus || 0) - (a.b.cd || 0));
    a.od = Math.min(100, a.od + 15 * a.b.od * (1 + (ab.odRate || 0)));
  }
  ev.push({ k: 'od', t: a.id, v: a.od });
}
function summon(st, a, sp, ev) {
  const used = new Set(alive(st, a.side).map(f => f.slot));
  for (let s = 0; s < 4; s++) {
    if (used.has(s)) continue;
    // replace a dead fighter in that slot
    st.f = st.f.filter(f => !(f.side === a.side && f.slot === s && !f.alive));
    const lvl = Math.max(1, a.lvl - 4);
    const inst = { sp, stage: lvl >= 14 ? 2 : 1, lvl, summoned: 1 };
    const f = makeFighter(st, inst, a.side, s);
    f.cds = {};
    st.f.push(f);
    ev.push({ k: 'summon', f: snap(f) });
    return;
  }
}
function snap(f) {
  return { id: f.id, side: f.side, slot: f.slot, name: f.name, art: f.art, el: f.el, lvl: f.lvl, hp: f.hp, maxHp: f.maxHp, boss: f.boss };
}

// ---- a full round --------------------------------------------------------------------------
// plans: {fighterId: {sk, tgt}} for side 0; anything missing is auto-planned
function round(st, plans) {
  const ev = [];
  if (st.over) return ev;
  st.turn++;
  st.lit = false;
  st.itemUsed = false;
  ev.push({ k: 'turn', n: st.turn });
  const pb = st.bonus[0];
  st.tempoOn = !!(pb.tempo && st.turn % 3 === 0);
  if (st.tempoOn) for (const f of alive(st, 0)) { f.od = Math.min(100, f.od + 25); ev.push({ k: 'od', t: f.id, v: f.od }); }
  // flux: the core's foes (and the wyrm everywhere) change element each turn
  for (const f of alive(st, 1)) {
    if (st.haz === 'flux' || (f.boss && G.BOSSES[f.boss].flux)) {
      const opts = G.ELS.filter(e => e !== f.el);
      f.el = opts[Math.floor(st.rnd() * opts.length)];
      ev.push({ k: 'flux', t: f.id, el: f.el });
    }
  }
  // turn order; bosses get a second, slower action
  const order = [];
  for (const f of st.f) if (f.alive) {
    order.push({ f, s: effSpd(st, f) + st.rnd() * 0.5 });
    if (f.acts > 1) order.push({ f, s: effSpd(st, f) * 0.55 + st.rnd() * 0.5 });
  }
  order.sort((x, y) => y.s - x.s);
  for (const { f } of order) {
    if (st.over) break;
    if (!f.alive) continue;
    if (f.st.stun) {
      delete f.st.stun; f.st.stunImm = { t: 1 };
      ev.push({ k: 'skip', a: f.id, why: 'Stunned' });
      continue;
    }
    let plan = f.side === 0 ? plans && plans[f.id] : null;
    if (!plan || !f.sk.includes(plan.sk) || !skillReady(f, plan.sk)) plan = autoPlan(st, f);
    else plan = Object.assign({}, plan);
    if (f.side === 0 && plans) delete plans[f.id];   // a boss' 2nd action replans
    perform(st, f, plan, ev);
    checkOver(st, ev);
  }
  if (!st.over) endOfRound(st, ev);
  checkOver(st, ev);
  return ev;
}
function endOfRound(st, ev) {
  // fatigue: long fights end; the cave starts to shake after round 20
  if (st.turn >= 20) {
    ev.push({ k: 'text', v: 'The cave rumbles!' });
    for (const f of st.f.slice()) if (f.alive) damage(st, null, f, Math.max(1, Math.round(f.maxHp * 0.04 * (st.turn - 19))), ev, { dot: 'quake' });
  }
  for (const f of st.f.slice()) {
    if (!f.alive) continue;
    const b = st.bonus[f.side];
    if (f.st.burn) { damage(st, null, f, f.st.burn.v, ev, { dot: 'burn' }); }
    if (f.alive && f.st.poison) { damage(st, null, f, f.st.poison.v * f.st.poison.n, ev, { dot: 'poison' }); if (f.st.poison) { f.st.poison.n--; if (f.st.poison.n <= 0) delete f.st.poison; } }
    if (!f.alive) continue;
    // hazards (player side only)
    if (f.side === 0) {
      if (st.haz === 'heat' && !b.immune_heat && f.el !== 'ember' && f.el !== 'stone') damage(st, null, f, Math.max(1, Math.round(f.maxHp * (f.el === 'tide' ? 0.02 : 0.05))), ev, { dot: 'heat' });
      if (st.haz === 'spores' && !b.immune_spores && f.el !== 'bloom' && f.el2 !== 'bloom' && f.alive) {
        const cur = f.st.poison || { n: 0, v: Math.max(1, Math.round(f.maxHp * 0.02)) };
        f.st.poison = { n: Math.min(10, cur.n + 1), v: cur.v, t: 99 };
        ev.push({ k: 'status', t: f.id, s: 'poison', haz: 1 });
      }
      if (b.immune_spores && st.turn % 3 === 0) cleanse(f, ev);
    }
    if (!f.alive) continue;
    let rg = (f.st.regen ? f.st.regen.v : 0) + (b.regen || 0) + f.b.regen + (b.tideRegen || 0);
    if (rg > 0 && f.hp < f.maxHp) heal(st, f, f, rg, ev);
    for (const k in f.st) {
      const s = f.st[k];
      if (k === 'poison' || !s || s.t == null) continue;
      s.t--; if (s.t <= 0) delete f.st[k];
    }
    for (const id in f.cds) if (f.cds[id] > 0) f.cds[id]--;
  }
}
function checkOver(st, ev) {
  if (st.over) return;
  if (!alive(st, 1).length) { st.over = 1; ev.push({ k: 'end', win: true }); }
  else if (!alive(st, 0).length) { st.over = 2; ev.push({ k: 'end', win: false }); }
}

// ---- items in battle (free action, one per turn) --------------------------------------------
function useItem(st, item, targetId) {
  const ev = [];
  const t = byId(st, targetId);
  if (item === 'berry' && t && t.alive) heal(st, t, t, 0.5, ev);
  else if (item === 'revive' && t && !t.alive && t.side === 0) {
    t.alive = true; t.hp = Math.round(t.maxHp * 0.5); t.st = {};
    ev.push({ k: 'revive', t: t.id, hp: t.hp, name: 'Revive Seed' });
  } else if (item === 'bomb') {
    for (const e of alive(st, 1)) damage(st, null, e, Math.max(1, Math.round(e.maxHp * (e.boss ? 0.06 : 0.18))), ev, { dot: 'bomb' });
    checkOver(st, ev);
  } else if (item === 'elixir') {
    for (const f of alive(st, 0)) { cleanse(f, ev); f.od = Math.min(100, f.od + 40); ev.push({ k: 'od', t: f.id, v: f.od }); }
  } else if (item === 'lure') { st.lure = true; ev.push({ k: 'text', v: 'A sweet scent drifts over the foes...' }); }
  else if (item === 'smoke') { st.over = 3; ev.push({ k: 'end', win: false, fled: true }); }
  else return null;
  st.itemUsed = true;
  return ev;
}

// write battle results back into the party instances
function writeBack(st) {
  for (const f of st.f) if (f.side === 0 && !f.summoned) f.inst.hpPct = f.alive ? Math.max(0.01, f.hp / f.maxHp) : 0;
}

root.GB = { mkRng, teamBonus, relicTagCounts, instStats, knownSkills, instName, instArt, instEl, evoLevel, create, round,
  autoPlan, pickTarget, legalFoes, skillReady, useItem, writeBack, alive, byId, effSpd, traitTiers };
})(typeof window !== 'undefined' ? window : globalThis);
