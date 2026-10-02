// Glimmerdeep auto-chess run: shop, pool, bench and board, merges, income, Tamer XP,
// enemy boards for each round, rewards. No DOM, so sim.js can play whole runs.
(function (root) {
'use strict';
const G = root.GD, C = root.GC;
const SPS = Object.keys(G.SP);
const BENCH = 9, PW = 4;                  // bench slots; the player's board is columns 0..3
const KIN_CHANCE = 0.25;                  // chance a shop slot offers a species you own below 3 stars
// boss power by stage; each boss' own HP is calibrated on top (fitted from sim.js fight logs)
const BOSS_SCALE = [1.36, 2.22, 3.36, 4.39, 8.10, 8.64];

function R(run) { return run.rnd || (run.rnd = C.mkRng((run.seed + run.step * 7919) >>> 0)); }
function rint(run, n) { return Math.floor(R(run)() * n); }
function pick(run, arr) { return arr[rint(run, arr.length)]; }
function shuffle(run, arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rint(run, i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
// camp upgrades with a fight bonus stack per rank
function campBonus(up) {
  const b = {};
  for (const k in up || {}) { const m = G.META[k]; if (m && m.cb) for (const s in m.cb) b[s] = (b[s] || 0) + m.cb[s] * up[k]; }
  return b;
}
const bonus = run => C.teamBonus(run.relics, run.perks, run.campB);

// ---- run setup --------------------------------------------------------------------------
function newRun(meta, seed, depth) {
  meta = meta || {};
  const up = meta.up || {};
  const run = {
    v: 2, seed: seed >>> 0, step: 0, nextUid: 1, round: 1, stage: 0, biome: 'verdant',
    hp: 100 + 10 * (up.hide || 0), maxHp: 100 + 10 * (up.hide || 0), gold: 3 + 2 * (up.gold || 0),
    tlv: 1 + (up.starter || 0), txp: 0, units: [], shop: [], locked: false, pool: {},
    relics: [], charms: [], items: {}, perks: {}, streak: 0, depth: depth || 0, over: 0, mods: {},
    stats: { won: 0, lost: 0, merges: 0, bosses: 0 }, seen: {}, visited: ['verdant'], shopShiny: [],
    meta: { choices: up.choices || 0, heal: up.heal || 0, shiny: up.shiny ? 3 : 1, kin: 0.08 * (up.kindred || 0), hoard: 0.1 * (up.hoard || 0) },
    campB: campBonus(up),
  };
  for (const k of SPS) run.pool[k] = G.POOL[G.TIER[k]];
  if (up.evo) run.items.evo = 1;
  for (let i = 0; i < (up.relic || 0); i++) run.relics.push(pick(run, Object.keys(G.RELICS).filter(k => G.RELICS[k].r === 1 && !G.RELICS[k].tags.includes('hazard') && !run.relics.includes(k))));
  return run;
}
function starterChoices(meta, seed) {
  const tmp = { seed, step: 1 };
  const owned = SPS.filter(k => G.TIER[k] === 1 || (meta.caught || {})[k] && G.TIER[k] <= 2);
  return shuffle(tmp, owned).slice(0, 3);
}
function mkInst(run, sp, star, o) {
  o = o || {};
  const inst = { uid: run.nextUid++, sp, star: star || 1, muts: [], charm: null, el2: null, skill: null,
    shiny: o.shiny != null ? !!o.shiny : !o.noShiny && R(run)() < run.meta.shiny / 64, at: null, x: 0, y: 0, slot: 0 };
  inst.skill = C.defaultSkill(inst);
  run.seen[sp] = Math.max(run.seen[sp] || 0, inst.star);
  return inst;
}
function giveStarter(run, sp) {
  run.pool[sp]--;
  const i = mkInst(run, sp, 1);
  i.at = 'b'; i.x = 2; i.y = 2;
  run.units.push(i);
  rollShop(run, true);
}

// ---- board and bench ------------------------------------------------------------------------
const onBoard = run => run.units.filter(u => u.at === 'b');
const onBench = run => run.units.filter(u => u.at === 'n');
const unitAt = (run, x, y) => run.units.find(u => u.at === 'b' && u.x === x && u.y === y);
const benchAt = (run, i) => run.units.find(u => u.at === 'n' && u.slot === i);
function freeBench(run) { for (let i = 0; i < BENCH; i++) if (!benchAt(run, i)) return i; return -1; }
function cap(run) { return run.tlv; }
// move a unit to a board cell (swapping with whoever is there)
function placeBoard(run, uid, x, y) {
  const u = run.units.find(z => z.uid === uid); if (!u || x < 0 || x >= PW || y < 0 || y >= C.H) return false;
  const other = unitAt(run, x, y);
  if (other === u) return true;
  if (!other && u.at !== 'b' && onBoard(run).length >= cap(run)) return false;
  if (other) { if (u.at === 'b') { other.x = u.x; other.y = u.y; } else { other.at = 'n'; other.slot = u.slot; } }
  u.at = 'b'; u.x = x; u.y = y;
  return true;
}
function placeBench(run, uid, i) {
  const u = run.units.find(z => z.uid === uid); if (!u || i < 0 || i >= BENCH) return false;
  const other = benchAt(run, i);
  if (other === u) return true;
  if (other) { if (u.at === 'b') { other.at = 'b'; other.x = u.x; other.y = u.y; } else other.slot = u.slot; }
  u.at = 'n'; u.slot = i;
  return true;
}
// fill empty board space from the bench: melee up front, ranged behind
function autoPlace(run) {
  const bench = onBench(run).sort((a, b) => b.star - a.star || G.TIER[b.sp] - G.TIER[a.sp]);
  for (const u of bench) {
    if (onBoard(run).length >= cap(run)) break;
    const rng = G.RANGE[u.sp];
    const cols = rng === 1 ? [3, 2, 1, 0] : rng === 2 ? [2, 1, 3, 0] : [0, 1, 2, 3];
    let done = false;
    for (const x of cols) { for (const y of [2, 1, 3, 0, 4]) if (!unitAt(run, x, y)) { placeBoard(run, u.uid, x, y); done = true; break; } if (done) break; }
  }
}

// ---- shop ------------------------------------------------------------------------------------
function shopSize(run) { return run.perks.collector ? 6 : 5; }
function rollTier(run) {
  const o = G.ODDS[Math.min(9, run.tlv)];
  let t = R(run)() * 100;
  for (let i = 0; i < 5; i++) { t -= o[i] || 0; if (t < 0) return i + 1; }
  return 1;
}
function rollShop(run, free) {
  run.step++; run.rnd = null;
  // give the old offers back to the pool
  for (const sp of run.shop) if (sp) run.pool[sp]++;
  const owned = Array.from(new Set(run.units.map(u => u.sp)));
  const kin = Array.from(new Set(run.units.filter(u => u.star < 3).map(u => u.sp)));
  const o = G.ODDS[Math.min(9, run.tlv)], maxTier = o.reduce((m, v, i) => v > 0 ? i + 1 : m, 1);
  const out = [], shiny = [];
  for (let i = 0; i < shopSize(run); i++) {
    let sp = null;
    if (run.mods.lure && owned.length) {
      const opts = owned.filter(k => run.pool[k] > 0); if (opts.length) sp = pick(run, opts);
    }
    // kin attraction: with 72 species, a slot sometimes offers a species you are still merging
    if (!sp && kin.length && R(run)() < KIN_CHANCE + (run.meta.kin || 0)) {
      const opts = kin.filter(k => run.pool[k] > 0 && G.TIER[k] <= maxTier); if (opts.length) sp = pick(run, opts);
    }
    for (let tries = 0; !sp && tries < 20; tries++) {
      const t = rollTier(run);
      const opts = SPS.filter(k => G.TIER[k] === t && run.pool[k] > 0);
      if (opts.length) sp = pick(run, opts);
    }
    if (sp) run.pool[sp]--;
    out.push(sp);
    shiny.push(!!sp && R(run)() < run.meta.shiny / 64);
  }
  run.shopShiny = shiny;
  run.mods.lure = false;
  run.shop = out;
  return out;
}
function rerollCost(run) { const b = bonus(run); return Math.max(0, 2 - (b.rerollDisc || 0) - (run.perks.haggler ? 1 : 0)); }
function reroll(run) {
  const c = rerollCost(run);
  if (run.gold < c) return false;
  run.gold -= c; rollShop(run); return true;
}
function copiesNeeded(run, star) { return star === 1 && bonus(run).merge2 ? 2 : 3; }
// can buy if there is bench room, or the buy completes a merge
function canBuy(run, i) {
  const sp = run.shop[i]; if (!sp) return false;
  if (run.gold < G.TIER[sp]) return false;
  if (freeBench(run) >= 0) return true;
  const have = run.units.filter(u => u.sp === sp && u.star === 1).length;
  return have + 1 >= copiesNeeded(run, 1);
}
function buy(run, i) {
  if (!canBuy(run, i)) return null;
  const sp = run.shop[i];
  run.gold -= G.TIER[sp];
  run.shop[i] = null;
  const u = mkInst(run, sp, 1, { shiny: (run.shopShiny || [])[i] });
  if (run.shopShiny) run.shopShiny[i] = false;
  const slot = freeBench(run);
  if (slot >= 0) { u.at = 'n'; u.slot = slot; } else { u.at = 'n'; u.slot = -1; }
  run.units.push(u);
  return u;
}
function sellValue(u) { const c = G.TIER[u.sp]; return u.star === 1 ? c : u.star === 2 ? c * 3 - 1 : c * 9 - 2; }
function sell(run, uid) {
  const u = run.units.find(z => z.uid === uid); if (!u) return 0;
  const v = sellValue(u);
  run.gold += v;
  run.pool[u.sp] += u.star === 1 ? 1 : u.star === 2 ? 3 : 9;
  if (u.charm) run.charms.push(u.charm);
  run.units = run.units.filter(z => z !== u);
  return v;
}
// merge sets of copies; returns the upgraded units (each wants a mutation pick)
function merges(run) {
  const done = [];
  let again = true;
  while (again) {
    again = false;
    for (const star of [1, 2]) {
      const need = copiesNeeded(run, star);
      const groups = {};
      for (const u of run.units) if (u.star === star) (groups[u.sp] = groups[u.sp] || []).push(u);
      for (const sp in groups) {
        const g = groups[sp];
        if (g.length < need) continue;
        // keep a copy that is on the board, else the best-equipped one
        g.sort((a, b) => (b.at === 'b') - (a.at === 'b') || (!!b.charm) - (!!a.charm) || b.muts.length - a.muts.length);
        const keep = g[0], eat = g.slice(1, need);
        for (const e of eat) {
          if (e.charm) { if (!keep.charm) keep.charm = e.charm; else run.charms.push(e.charm); }
          if (e.shiny) keep.shiny = true;
          for (const m of e.muts) if (!keep.muts.includes(m) && keep.muts.length < star) keep.muts.push(m);
        }
        run.units = run.units.filter(u => !eat.includes(u));
        const wasDefault = keep.skill === C.defaultSkill(keep);
        keep.star++;
        if (wasDefault || !C.castables(keep).includes(keep.skill)) keep.skill = C.defaultSkill(keep);
        if (keep.at === 'n' && keep.slot < 0) { const f = freeBench(run); keep.slot = f; }
        run.seen[keep.sp] = Math.max(run.seen[keep.sp] || 0, keep.star);
        run.stats.merges++;
        done.push(keep);
        again = true;
        break;
      }
      if (again) break;
    }
  }
  // a unit bought into a full bench that did not merge (should not happen) gets dropped back
  for (const u of run.units.slice()) if (u.at === 'n' && u.slot < 0) { const f = freeBench(run); if (f >= 0) u.slot = f; else sell(run, u.uid); }
  return done;
}
function mutOptions(run, u) {
  const keys = Object.keys(G.MUTS).filter(k => !u.muts.includes(k));
  const rr = C.mkRng((run.seed ^ (u.uid * 7331 + u.star * 17)) >>> 0);
  const a = keys.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rr() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, 2 + (bonus(run).mutChoice || 0));
}
function applyMut(run, u, m) {
  if (!m || u.muts.includes(m)) return;
  u.muts.push(m);
  if (m === 'dual') { const opts = G.ELS.filter(e => e !== G.SP[u.sp].el); u.el2 = opts[(u.uid * 13 + u.star) % opts.length]; }
}

// ---- tamer level ------------------------------------------------------------------------------
function addXp(run, n) {
  run.txp += n;
  let ups = 0;
  while (run.tlv < 9 && run.txp >= G.TXP[run.tlv]) { run.txp -= G.TXP[run.tlv]; run.tlv++; ups++; }
  if (run.tlv >= 9) run.txp = 0;
  return ups;
}
function buyXp(run) { if (run.gold < 4 || run.tlv >= 9) return false; run.gold -= 4; addXp(run, 4); return true; }

// ---- rounds -------------------------------------------------------------------------------------
function stageOf(round) { return Math.floor((round - 1) / G.STAGE_LEN); }
function roundIn(round) { return (round - 1) % G.STAGE_LEN + 1; }
function roundKind(round) { const r = roundIn(round); return r === G.STAGE_LEN ? 'boss' : r === 3 ? 'elite' : 'wild'; }
function enemyBoard(run) {
  if (run.enemy && run.enemy.round === run.round) return run.enemy.units;
  const round = run.round, kind = roundKind(round), stage = stageOf(round);
  const rr = C.mkRng((run.seed ^ (round * 7919 + 13)) >>> 0);
  const els = G.BIOMES[run.biome].els;
  const pool = SPS.filter(k => els.includes(G.SP[k].el));
  const scale = (0.9 + 0.013 * Math.min(round, 24) + 0.005 * Math.max(0, round - 24)) * (1 + 0.08 * run.depth);
  const lv = Math.min(9, 1 + Math.floor(round * 0.36));
  const tierPick = () => { const o = G.ODDS[lv]; let t = rr() * 100; for (let i = 0; i < 5; i++) { t -= o[i] || 0; if (t < 0) return i + 1; } return 1; };
  const species = t => { const a = pool.filter(k => G.TIER[k] === t); const b = a.length ? a : SPS.filter(k => G.TIER[k] === t); return b[Math.floor(rr() * b.length)]; };
  const p2 = Math.max(0, Math.min(0.65, (round - 4) / 20)), p3 = Math.max(0, Math.min(0.25, (round - 16) / 28));
  const out = [];
  const add = inst => out.push(inst);
  if (kind === 'boss') {
    const bk = bossOf(run);
    add({ uid: -1, boss: bk, star: 3, muts: [], scale: BOSS_SCALE[stage] * (1 + 0.08 * run.depth) });
    const minions = [1, 2, 2, 3, 3, 4][stage];
    for (let i = 0; i < minions; i++) add({ uid: -2 - i, sp: species(tierPick()), star: rr() < p3 ? 3 : rr() < p2 ? 2 : 1, muts: [], scale });
  } else {
    let n = round === 1 ? 1 : round === 2 ? 2 : Math.min(9, 2 + Math.floor(round * 0.26));
    if (kind === 'elite') n = Math.min(9, n + 1);
    for (let i = 0; i < n; i++) {
      const star = rr() < p3 ? 3 : rr() < p2 + (kind === 'elite' ? 0.15 : 0) ? 2 : 1;
      add({ uid: -10 - i, sp: species(tierPick()), star, muts: [], scale: round <= 2 ? scale * 0.8 : scale });
    }
    if (kind === 'elite') { out.sort((a, b) => b.star - a.star); out[0].elite = ['vampiric', 'thorned', 'hasty', 'shielded', 'enraged'][Math.floor(rr() * 5)]; }
  }
  for (const i of out) { const c = C.castables(i); i.skill = c[Math.floor(rr() * c.length)]; if (i.star >= 2 && !i.boss && rr() < 0.6) i.skill = c[c.length - 1]; }
  // place: melee in front (col 4), mid range next, casters at the back; bosses in the middle
  const used = new Set();
  const placed = [];
  const order = out.slice().sort((a, b) => rangeOf(a) - rangeOf(b));
  for (const inst of order) {
    const r = rangeOf(inst);
    const cols = inst.boss ? [5, 6, 4] : r === 1 ? [4, 5, 6, 7] : r === 2 ? [5, 4, 6, 7] : [7, 6, 5, 4];
    let cell = null;
    for (const x of cols) { for (const y of [2, 1, 3, 0, 4]) if (!used.has(x + ',' + y)) { cell = [x, y]; break; } if (cell) break; }
    if (!cell) continue;
    used.add(cell.join(','));
    placed.push({ inst, x: cell[0], y: cell[1] });
  }
  run.enemy = { round, units: placed };
  return placed;
}
// each stage's boss is drawn from its biome's pool of three, fixed per run
function bossOf(run, biome) {
  const bi = biome || run.biome, pool = G.BIOMES[bi].bosses || [G.BIOMES[bi].boss];
  run.bossPick = run.bossPick || {};
  if (!run.bossPick[bi]) {
    const used = Object.values(run.bossPick), free = pool.filter(b => !used.includes(b)), opts = free.length ? free : pool;
    const rr = C.mkRng((run.seed ^ (bi.length * 7177 + bi.charCodeAt(0) * 131)) >>> 0);
    run.bossPick[bi] = opts[Math.floor(rr() * opts.length)];
  }
  return run.bossPick[bi];
}
function rangeOf(inst) { return inst.boss ? G.BOSS_RANGE[inst.boss] : G.RANGE[inst.sp]; }
function fightOpts(run, seed) {
  return { board: onBoard(run).map(u => ({ inst: u, x: u.x, y: u.y })), enemies: enemyBoard(run), relics: run.relics, perks: run.perks,
    biome: run.biome, seed, depth: run.depth, camp: run.campB, mods: { bomb: run.mods.bomb, elixir: run.mods.elixir } };
}
function hpLoss(run, st) {
  const surv = C.alive(st, 1);
  let v = Math.round(0.75 * (2 + Math.round(1.6 * stageOf(run.round)) + surv.reduce((s, u) => s + (u.boss ? 8 : (G.TIER[u.inst.sp] || 1) + u.star - 1), 0)));
  if (run.perks.medic) v = Math.round(v * 0.7);
  return v;
}
// returns a summary the UI shows; run.pending lists rewards to pick (relics, perk, biome)
function endRound(run, st) {
  const win = st.over === 1, kind = roundKind(run.round);
  const out = { win, kind, round: run.round, loss: 0, gold: 0, xp: 0, drops: [] };
  if (win) { run.stats.won++; run.streak = run.streak > 0 ? run.streak + 1 : 1; }
  else {
    run.stats.lost++; run.streak = run.streak < 0 ? run.streak - 1 : -1;
    out.loss = run.mods.smoke ? 0 : hpLoss(run, st);
    run.hp -= out.loss;
  }
  run.mods.bomb = run.mods.elixir = run.mods.smoke = false;
  run.gold += st.goldBonus || 0;
  if (run.hp <= 0) { run.hp = 0; run.over = 2; return out; }
  // rewards
  run.pending = [];
  if (win && kind === 'elite') run.pending.push({ k: 'relic', opts: relicChoices(run, 3) });
  if (kind === 'boss') {
    if (win) {
      run.stats.bosses++;
      run.pending.push({ k: 'relic', opts: relicChoices(run, 3, 1) }, { k: 'perk', opts: perkChoices(run) });
      if (run.meta.heal) run.hp = Math.min(run.maxHp, run.hp + 15);
      if (run.round >= G.ROUNDS) { run.over = 1; return out; }
    } else if (run.round >= G.ROUNDS) {
      // the final boss must be beaten: try again next round
      out.retry = true;
    }
    if (run.round < G.ROUNDS) { const next = nextBiomes(run); if (next.length) run.pending.push({ k: 'biome', opts: next }); }
  }
  if (win && kind === 'wild' && R(run)() < 0.35) {
    if (R(run)() < 0.5) { const c = pick(run, Object.keys(G.CHARMS)); run.charms.push(c); out.drops.push({ k: 'charm', id: c }); }
    else { const it = pick(run, Object.keys(G.ITEMS)); run.items[it] = (run.items[it] || 0) + 1; out.drops.push({ k: 'item', id: it }); }
  }
  // income
  const b = bonus(run);
  const interest = Math.min(5 + (b.interestCap || 0), Math.floor(run.gold / 10));
  const s = Math.abs(run.streak);
  const streak = s >= 6 ? 3 : s >= 4 ? 2 : s >= 2 ? 1 : 0;
  out.gold = 5 + interest + (streak ? streak + (run.perks.scout ? 1 : 0) : 0) + (win ? 1 : 0) + (b.goldRound || 0) + (run.perks.pockets ? 2 : 0);
  out.interest = interest; out.streak = streak;
  run.gold += out.gold;
  out.xp = 2 + (b.xpRound || 0) + (run.perks.coach ? 2 : 0);
  out.lvUp = addXp(run, out.xp);
  if (!out.retry) run.round++;
  run.enemy = null;
  if (!run.locked) rollShop(run); else run.locked = false;
  return out;
}
// after each boss: two biomes you have not visited yet (the last stage is always the Glimmer Core)
function nextBiomes(run) {
  const stage = stageOf(run.round) + 1;
  if (stage >= G.STAGES) return [];
  if (stage === G.STAGES - 1) return ['core'];
  const left = G.MID_BIOMES.filter(b => !(run.visited || []).includes(b));
  const rr = C.mkRng((run.seed ^ (stage * 4099 + 77)) >>> 0);
  const a = left.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rr() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, 2);
}
function relicChoices(run, n, rare) {
  n += (bonus(run).relicChoice || 0) + run.meta.choices;
  const map = { heat: 'frostcore', dark: 'lumen_moth', flood: 'gill_pearl', spores: 'incense', reflect: 'prism_lens', blizzard: 'hearthstone',
    gusts: 'anchor_stone', sandstorm: 'desert_veil', bog: 'marsh_charm', magnetic: 'grounding_rod', starfall: 'star_ward' };
  const want = [map[G.BIOMES[run.biome].haz]];
  for (const bi of nextBiomes(run)) want.push(map[G.BIOMES[bi].haz]);
  const pool = Object.keys(G.RELICS).filter(k => !G.RELICS[k].leg && !run.relics.includes(k));
  const c = C.relicTagCounts(run.relics);
  const w = k => {
    const r = G.RELICS[k];
    let v = r.r === 1 ? (rare ? 30 : 60) : (rare ? 60 : 28);
    if (r.tags.includes('hazard')) v = want.includes(k) ? 70 : 3;
    for (const t of r.tags) if (c[t]) v *= 1.25;
    return v;
  };
  const out = [], left = pool.slice();
  while (out.length < n && left.length) {
    const tot = left.reduce((s, k) => s + w(k), 0);
    let t = R(run)() * tot;
    for (let i = 0; i < left.length; i++) { t -= w(left[i]); if (t < 0) { out.push(left[i]); left.splice(i, 1); break; } }
  }
  return out;
}
function perkChoices(run) { return shuffle(run, Object.keys(G.PERKS).filter(k => !run.perks[k])).slice(0, 3); }
function takePerk(run, k) { run.perks[k] = 1; if (k === 'pockets') run.gold += 10; }
function addRelic(run, id) { if (id && !run.relics.includes(id)) run.relics.push(id); }
function fusionsAvailable(run) { return G.FUSIONS.filter(([a, b, c]) => run.relics.includes(a) && run.relics.includes(b) && !run.relics.includes(c)); }
function fuse(run, f) { run.relics = run.relics.filter(k => k !== f[0] && k !== f[1]); run.relics.push(f[2]); }
function setBiome(run, bi) { run.biome = bi; run.enemy = null; (run.visited = run.visited || []).push(bi); }
function equipCharm(run, uid, charm) {
  const u = run.units.find(x => x.uid === uid); if (!u) return;
  if (u.charm) run.charms.push(u.charm);
  u.charm = null;
  if (charm) { const i = run.charms.indexOf(charm); if (i >= 0) { run.charms.splice(i, 1); u.charm = charm; } }
}
// consumables, used between rounds
function useItem(run, item, uid) {
  if (!run.items[item]) return null;
  let r = null;
  if (item === 'berry' && run.hp < run.maxHp) { run.hp = Math.min(run.maxHp, run.hp + 10); r = {}; }
  else if (item === 'revive' && run.hp < run.maxHp) { run.hp = Math.min(run.maxHp, run.hp + 25); r = {}; }
  else if (item === 'candy' && run.tlv < 9) { addXp(run, 4); r = {}; }
  else if (item === 'evo') {
    const u = run.units.find(x => x.uid === uid);
    if (u && u.star === 1) { const wasDefault = u.skill === C.defaultSkill(u); u.star = 2; if (wasDefault) u.skill = C.defaultSkill(u); run.seen[u.sp] = Math.max(run.seen[u.sp] || 0, 2); r = { merged: [u] }; }
  }
  else if (item === 'bomb' && !run.mods.bomb) { run.mods.bomb = true; r = {}; }
  else if (item === 'elixir' && !run.mods.elixir) { run.mods.elixir = true; r = {}; }
  else if (item === 'smoke' && !run.mods.smoke) { run.mods.smoke = true; r = {}; }
  else if (item === 'lure' && !run.mods.lure) { run.mods.lure = true; rollShop(run); r = {}; }
  if (r) { run.items[item]--; if (!run.items[item]) delete run.items[item]; }
  return r;
}
function shardsFor(run, won) {
  return Math.round((run.round * 1.5 + run.stats.bosses * 8 + (won ? 25 : 0) + run.stats.merges + run.depth * 5 * (won ? 1 : 0)) * (1 + 0.1 * run.depth + (run.meta.hoard || 0)));
}

root.GR = { BENCH, PW, newRun, starterChoices, giveStarter, mkInst, onBoard, onBench, unitAt, benchAt, freeBench, cap, placeBoard, placeBench,
  autoPlace, rollShop, rerollCost, reroll, canBuy, buy, sellValue, sell, merges, mutOptions, applyMut, addXp, buyXp, stageOf, roundIn,
  roundKind, enemyBoard, fightOpts, endRound, relicChoices, perkChoices, takePerk, addRelic, fusionsAvailable, fuse, setBiome,
  equipCharm, useItem, shardsFor, bonus, bossOf, nextBiomes, shopSize, copiesNeeded, pick };
})(typeof window !== 'undefined' ? window : globalThis);
