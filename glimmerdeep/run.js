// Glimmerdeep run layer: party, map, encounters, rewards, XP and evolution, shop, events.
// No DOM, so sim.js can drive whole runs headless.
(function (root) {
'use strict';
const G = root.GD, B = root.GB;
const SPS = Object.keys(G.SP);

function R(run) { return run.rnd || (run.rnd = B.mkRng((run.seed + run.step * 7919) >>> 0)); }
function rint(run, n) { return Math.floor(R(run)() * n); }
function pick(run, arr) { return arr[rint(run, arr.length)]; }
function shuffle(run, arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rint(run, i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ---- creature instances ---------------------------------------------------------------
function stageFor(lvl) { return lvl >= G.EVO_LV[2] ? 3 : lvl >= G.EVO_LV[1] ? 2 : 1; }
function mkInst(run, sp, lvl, o) {
  o = o || {};
  const inst = { uid: run.nextUid++, sp, stage: o.stage || stageFor(lvl), lvl, xp: 0, muts: [], charm: null,
    shiny: o.noShiny ? false : R(run)() < 1 / 48, el2: null, hpPct: 1 };
  if (inst.stage >= 2 && o.wild) inst.muts.push(pick(run, ['hardened', 'feral', 'swift', 'ironhide']));
  return inst;
}
const xpNeed = lvl => Math.round(6 + 6 * lvl + 0.3 * lvl * lvl);
const LV_CAP = 30;

// ---- run setup -----------------------------------------------------------------------------
function newRun(meta, starterSp, seed, depth) {
  meta = meta || {};
  const up = meta.up || {};
  const run = {
    v: 1, seed: seed >>> 0, step: 0, nextUid: 1, act: 0, biome: 'verdant', party: [], gold: 60 + 40 * (up.gold || 0),
    relics: [], charms: [], items: { berry: 2 }, perks: {}, floor: 0, depth: depth || 0, map: null, over: 0,
    stats: { battles: 0, kills: 0, caught: 0, floors: 0, bosses: 0 }, benchSlots: 2 + (up.bench || 0), seen: {},
    lure: false, meta: { recruit: up.recruit || 0, choices: up.choices || 0, heal: up.heal || 0 },
  };
  if (up.revive) run.items.revive = up.revive;
  const lv = 5 + (up.starter || 0);
  const s = mkInst(run, starterSp, lv, { noShiny: false });
  run.party.push(s);
  // a second companion of a different element
  const pool = SPS.filter(k => G.SP[k].el !== G.SP[starterSp].el);
  run.party.push(mkInst(run, pick(run, pool), lv - 1));
  if (up.relic) run.relics.push(pick(run, Object.keys(G.RELICS).filter(k => G.RELICS[k].r === 1 && !G.RELICS[k].tags.includes('hazard'))));
  for (const p of run.party) run.seen[p.sp] = 1;
  genMap(run);
  return run;
}
function starterChoices(meta, seed) {
  const owned = SPS.filter(k => (meta.caught || {})[k] || ['cind', 'bubb', 'sprt'].includes(k));
  const run = { seed, step: 99 };
  return shuffle(run, owned).slice(0, 3);
}
function bonus(run) { return B.teamBonus(run.relics, run.perks); }
function active(run) { return run.party.filter(p => p.hpPct > 0).slice(0, 4); }
function partyCap(run) { return 4 + run.benchSlots; }

// ---- map ---------------------------------------------------------------------------------
const ROWS = [7, 7, 7, 3];
function genMap(run) {
  run.step++; run.rnd = null;
  const rows = ROWS[run.act], cols = 4;
  const grid = [];
  for (let r = 0; r < rows; r++) grid.push(new Array(cols).fill(null));
  const edges = new Set();
  const starts = shuffle(run, [0, 1, 2, 3]).slice(0, 3);
  starts.push(starts[0]);
  for (const s of starts) {
    let c = s;
    for (let r = 0; r < rows; r++) {
      grid[r][c] = grid[r][c] || { r, c };
      if (r < rows - 1) {
        const nc = Math.max(0, Math.min(cols - 1, c + rint(run, 3) - 1));
        edges.add(r + ':' + c + '>' + nc); c = nc;
      }
    }
  }
  const nodes = [];
  let id = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (grid[r][c]) { grid[r][c].id = id++; nodes.push(grid[r][c]); }
  for (const n of nodes) n.next = [];
  for (const e of edges) {
    const [rc, nc] = e.split('>'); const [r, c] = rc.split(':').map(Number);
    grid[r][c].next.push(grid[r + 1][+nc].id);
  }
  const boss = { id: id++, r: rows, c: 1.5, type: 'boss', next: [] };
  for (const n of nodes) if (n.r === rows - 1) n.next.push(boss.id);
  nodes.push(boss);
  // node types
  for (const n of nodes) {
    if (n.type) continue;
    if (n.r === 0) n.type = 'battle';
    else if (rows > 3 && n.r === rows - 1) n.type = 'rest';
    else if (rows > 3 && n.r === 3) n.type = R(run)() < 0.7 ? 'treasure' : 'elite';
    else {
      const w = [['battle', 40], ['event', 17], ['elite', n.r >= 2 ? 12 : 0], ['shop', n.r >= 1 ? 10 : 0], ['rest', n.r >= 2 ? 8 : 0], ['den', 10]];
      let t = R(run)() * w.reduce((s, x) => s + x[1], 0);
      for (const [k, v] of w) { t -= v; if (t < 0) { n.type = k; break; } }
    }
  }
  if (run.act === 3) { nodes.filter(n => n.r === 1).forEach(n => n.type = 'rest'); nodes.filter(n => n.r === 2).forEach(n => n.type = 'shop'); }
  run.map = { act: run.act, biome: run.biome, rows, nodes, cur: null, done: [] };
  for (const n of nodes) if (n.type === 'battle' || n.type === 'elite') n.preview = encounter(run, n).map(i => i.sp);
  return run.map;
}
function nodeById(run, id) { return run.map.nodes.find(n => n.id === id); }
function reachable(run) {
  const m = run.map;
  if (m.cur == null) return m.nodes.filter(n => n.r === 0).map(n => n.id);
  return nodeById(run, m.cur).next.slice();
}
function enterNode(run, id) {
  run.map.cur = id; run.map.done.push(id); run.step++; run.rnd = null;
  run.stats.floors++;
  return nodeById(run, id);
}

// ---- encounters ---------------------------------------------------------------------------
function floorLevel(run, node) {
  const [a, b] = G.ACT_LV[run.act];
  const t = run.map.rows > 1 ? node.r / (run.map.rows - 1) : 0;
  return Math.round(a + (b - a) * t);
}
function biomeSpecies(run) {
  const els = G.BIOMES[run.biome].els;
  const pool = [];
  for (const e of els) for (const k of SPS) if (G.SP[k].el === e) pool.push(k);
  return pool;
}
function encounter(run, node) {
  if (node.enc) return node.enc;
  const rr = B.mkRng((run.seed ^ (run.act * 977 + node.id * 131)) >>> 0);
  const pool = biomeSpecies(run);
  const pk = () => pool[Math.floor(rr() * pool.length)];
  const lv = node.type === 'boss' ? G.ACT_LV[run.act][2] : floorLevel(run, node);
  const out = [];
  const tmp = { nextUid: 100000, seed: 1, step: 1, rnd: rr };
  const wild = [0.74, 0.85, 0.92, 0.97][run.act];
  if (node.type === 'boss') {
    const bk = G.BIOMES[run.biome].boss;
    out.push({ uid: 90000, boss: bk, lvl: lv, stage: 3, muts: [], hpPct: 1 });
    const minions = run.act === 0 ? 0 : 2;
    for (let i = 0; i < minions; i++) out.unshift(Object.assign(mkInst(tmp, pk(), Math.max(1, lv - 3), { wild: 1, noShiny: 1 }), { scale: wild }));
    out[out.length - 1].scale = [0.85, 0.92, 0.97, 1][run.act];
  } else {
    let n = node.type === 'elite' ? (run.act === 0 ? 2 : 3) : run.act === 0 && node.r < 3 ? 2 : (rr() < 0.45 + node.r * 0.06 ? 3 : 2);
    if (run.act >= 1 && rr() < 0.3 && node.type !== 'elite') n = Math.min(4, n + 1);
    for (let i = 0; i < n; i++) {
      const l = Math.max(1, lv + Math.floor(rr() * 3) - 1 + (node.type === 'elite' ? 2 : 0));
      out.push(Object.assign(mkInst(tmp, pk(), l, { wild: 1, noShiny: 1 }), { scale: wild }));
    }
    if (node.type === 'elite') {
      out.sort((x, y) => y.lvl - x.lvl);
      out[0].elite = ['vampiric', 'thorned', 'hasty', 'shielded', 'enraged'][Math.floor(rr() * 5)];
    }
    // tanks up front
    out.sort((x, y) => (G.SP[y.sp].role === 'tank') - (G.SP[x.sp].role === 'tank'));
  }
  node.enc = out;
  return out;
}
function battleOpts(run, enemies, seed) {
  return { party: active(run), enemies, relics: run.relics, perks: run.perks, biome: run.biome, seed, depth: run.depth };
}

// ---- rewards --------------------------------------------------------------------------------
function rewards(run, st, node) {
  const b = bonus(run);
  const foes = st.f.filter(f => f.side === 1 && !f.summoned);
  const lvSum = foes.reduce((s, f) => s + f.lvl, 0);
  const avg = lvSum / Math.max(1, foes.length);
  const mul = node.type === 'boss' ? 3 : node.type === 'elite' ? 2 : 1;
  let gold = Math.round((12 + 2.2 * avg) * mul * (1 + (b.goldMul || 0)) * (node.type === 'elite' && run.perks.scout ? 1.5 : 1)) + (st.goldBonus || 0);
  const xpMul = (1 + (b.xpMul || 0) + (run.perks.coach ? 0.25 : 0)) * (node.type === 'boss' ? 1.8 : node.type === 'elite' ? 1.4 : 1);
  const xp = Math.round((run.act === 0 ? 6 : 5) * lvSum * xpMul);
  const out = { gold, xp, recruit: [], relics: [], perk: null };
  if (node.type !== 'boss') {
    let ch = 0.42 + 0.1 * run.meta.recruit + (run.perks.collector ? 0.21 : 0);
    if (node.type === 'elite') ch += 0.25;
    if (st.lure || R(run)() < ch) {
      const n = 1 + (run.perks.collector ? 1 : 0) + (node.type === 'elite' ? 1 : 0);
      const opts = shuffle(run, foes).slice(0, n);
      for (const f of opts) {
        const lvl = Math.max(1, f.lvl - 1);
        out.recruit.push(mkInst(run, f.inst.sp, lvl));
      }
    }
  }
  if (node.type === 'elite') out.relics = relicChoices(run, 3);
  if (node.type === 'boss') { out.relics = relicChoices(run, 3, 1); out.perk = perkChoices(run); }
  return out;
}
function relicChoices(run, n, rare) {
  const b = bonus(run);
  n += (b.relicChoice || 0) + run.meta.choices;
  const next = nextHazards(run);
  const pool = Object.keys(G.RELICS).filter(k => !G.RELICS[k].leg && !run.relics.includes(k));
  const w = k => {
    const r = G.RELICS[k];
    let v = r.r === 1 ? (rare ? 30 : 60) : (rare ? 60 : 28);
    if (r.tags.includes('hazard')) v = next.includes(k) ? 90 : 4;
    // nudge toward sets you are building
    const c = B.relicTagCounts(run.relics);
    for (const t of r.tags) if (c[t]) v *= 1.25;
    return v;
  };
  const out = [];
  const left = pool.slice();
  while (out.length < n && left.length) {
    const tot = left.reduce((s, k) => s + w(k), 0);
    let t = R(run)() * tot;
    for (let i = 0; i < left.length; i++) { t -= w(left[i]); if (t < 0) { out.push(left[i]); left.splice(i, 1); break; } }
  }
  return out;
}
// hazard counters worth offering for the current and next acts
function nextHazards(run) {
  const map = { heat: 'frostcore', dark: 'lumen_moth', flood: 'gill_pearl', spores: 'incense', reflect: 'prism_lens' };
  const out = [];
  const add = bi => { const h = G.BIOMES[bi].haz; if (map[h]) out.push(map[h]); };
  add(run.biome);
  for (const bi of (G.ACTS[run.act + 1] || [])) add(bi);
  return out;
}
function perkChoices(run) {
  return shuffle(run, Object.keys(G.PERKS).filter(k => !run.perks[k])).slice(0, 3);
}
function takePerk(run, k) {
  run.perks[k] = 1;
  if (k === 'pockets') { run.benchSlots++; run.gold += 60; }
}
function addRelic(run, id) {
  if (!run.relics.includes(id)) run.relics.push(id);
}
function fusionsAvailable(run) {
  return G.FUSIONS.filter(([a, b, c]) => run.relics.includes(a) && run.relics.includes(b) && !run.relics.includes(c));
}
function fuse(run, recipe) {
  const [a, b, c] = recipe;
  run.relics = run.relics.filter(k => k !== a && k !== b);
  run.relics.push(c);
}

// ---- XP, levels, evolution ---------------------------------------------------------------------
// returns [{uid, from, to}] level changes; marks run.pendingEvo
function grantXp(run, xp, fought) {
  const b = bonus(run);
  const out = [];
  for (const p of run.party) {
    const share = fought.includes(p.uid) ? 1 : (b.benchXp ? 1 : 0.5);
    const got = Math.round(xp * share * (p.hpPct > 0 || fought.includes(p.uid) ? 1 : 0.5));
    out.push(Object.assign({ uid: p.uid, xp: got }, addXp(run, p, got)));
  }
  return out;
}
function addXp(run, p, got) {
  const from = p.lvl;
  p.xp += got;
  while (p.lvl < LV_CAP && p.xp >= xpNeed(p.lvl)) { p.xp -= xpNeed(p.lvl); p.lvl++; }
  if (p.lvl >= LV_CAP) p.xp = 0;
  return { from, to: p.lvl, evo: canEvolve(run, p) };
}
function levelUp(run, p, n) {
  const from = p.lvl;
  for (let i = 0; i < n && p.lvl < LV_CAP; i++) { p.lvl++; p.xp = 0; }
  return { from, to: p.lvl, evo: canEvolve(run, p) };
}
function canEvolve(run, p) { return p.stage < 3 && p.lvl >= B.evoLevel(p.stage, bonus(run)); }
function mutOptions(run, p) {
  const b = bonus(run);
  const keys = Object.keys(G.MUTS).filter(k => !p.muts.includes(k));
  const rr = B.mkRng((run.seed ^ (p.uid * 7331 + p.stage * 17)) >>> 0);
  const a = keys.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rr() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, 2 + (b.mutChoice || 0));
}
function evolve(run, p, mut) {
  p.stage++;
  if (mut) {
    p.muts.push(mut);
    if (mut === 'dual') {
      const opts = G.ELS.filter(e => e !== G.SP[p.sp].el);
      p.el2 = opts[(p.uid * 13 + p.stage) % opts.length];
    }
  }
  run.seen[p.sp] = Math.max(run.seen[p.sp] || 0, p.stage);
  return p;
}

// ---- after a battle ------------------------------------------------------------------------------
function afterBattle(run, st) {
  B.writeBack(st);
  run.stats.battles++;
  run.stats.kills += st.f.filter(f => f.side === 1 && !f.alive).length;
  // creatures shake it off after a win: survivors +20%, the fallen get up at 15%
  if (st.over === 1) for (const p of run.party) p.hpPct = p.hpPct > 0 ? Math.min(1, p.hpPct + 0.2) : 0.15;
  if (run.perks.medic) for (const p of run.party) if (p.hpPct > 0) p.hpPct = Math.min(1, p.hpPct + 0.12);
  for (const f of st.f) if (f.side === 1 && f.inst.sp) run.seen[f.inst.sp] = Math.max(run.seen[f.inst.sp] || 0, f.stage);
}
function partyWiped(run) { return !run.party.some(p => p.hpPct > 0); }
function recruit(run, inst, releaseUid) {
  if (releaseUid != null) run.party = run.party.filter(p => p.uid !== releaseUid);
  if (run.party.length >= partyCap(run)) return false;
  inst.hpPct = 1;
  run.party.push(inst);
  run.stats.caught++;
  run.seen[inst.sp] = Math.max(run.seen[inst.sp] || 0, inst.stage);
  return true;
}
function release(run, uid) {
  const p = run.party.find(x => x.uid === uid);
  if (!p || run.party.length <= 1) return;
  if (p.charm) run.charms.push(p.charm);
  run.party = run.party.filter(x => x.uid !== uid);
}
function bossCleared(run) {
  run.stats.bosses++;
  if (run.meta.heal) for (const p of run.party) p.hpPct = 1;
  else for (const p of run.party) p.hpPct = p.hpPct > 0 ? Math.min(1, p.hpPct + 0.5) : 0.3;
}
function nextAct(run, biome) {
  run.act++;
  run.biome = biome;
  genMap(run);
}

// ---- rest / shop ----------------------------------------------------------------------------------
function restHeal(run) { for (const p of run.party) p.hpPct = p.hpPct > 0 ? Math.min(1, p.hpPct + 0.5) : 0.5; }
function shopStock(run, disc) {
  const b = bonus(run);
  const d = (1 - (b.shopDisc || 0)) * (run.perks.haggler ? 0.85 : 1) * (1 - (disc || 0));
  const price = v => Math.max(5, Math.round(v * d * (1 + run.act * 0.1)));
  const relics = relicChoices(run, 3).map(k => ({ kind: 'relic', id: k, price: price(G.RELICS[k].r === 1 ? 85 : 135) }));
  const charms = shuffle(run, Object.keys(G.CHARMS)).slice(0, 3).map(k => ({ kind: 'charm', id: k, price: price(60) }));
  const items = shuffle(run, Object.keys(G.ITEMS)).slice(0, 4).map(k => ({ kind: 'item', id: k, price: price(G.ITEMS[k].price) }));
  const lv = Math.max(2, G.ACT_LV[run.act][0] + 1);
  const egg = { kind: 'egg', inst: mkInst(run, pick(run, SPS), lv), price: price(95) };
  return { items: [...relics, ...charms, ...items, egg], heal: price(30), reroll: price(20), d };
}
function buy(run, it) {
  if (run.gold < it.price || it.sold) return false;
  if (it.kind === 'egg' && run.party.length >= partyCap(run)) return false;
  run.gold -= it.price; it.sold = 1;
  if (it.kind === 'relic') addRelic(run, it.id);
  else if (it.kind === 'charm') run.charms.push(it.id);
  else if (it.kind === 'item') run.items[it.id] = (run.items[it.id] || 0) + 1;
  else if (it.kind === 'egg') recruit(run, it.inst);
  return true;
}
function useItemOutside(run, item, uid) {
  const p = run.party.find(x => x.uid === uid);
  if (!p || !run.items[item]) return null;
  let r = null;
  if (item === 'berry' && p.hpPct > 0 && p.hpPct < 1) { p.hpPct = Math.min(1, p.hpPct + 0.5); r = {}; }
  else if (item === 'revive' && p.hpPct <= 0) { p.hpPct = 0.5; r = {}; }
  else if (item === 'candy' && p.lvl < LV_CAP) r = levelUp(run, p, 1);
  else if (item === 'evo' && p.stage < 3 && p.lvl >= B.evoLevel(p.stage, bonus(run)) - 3) {
    if (p.lvl < B.evoLevel(p.stage, bonus(run))) p.lvl = B.evoLevel(p.stage, bonus(run));
    r = { evo: true };
  }
  if (r) { run.items[item]--; if (!run.items[item]) delete run.items[item]; }
  return r;
}
function equipCharm(run, uid, charm) {
  const p = run.party.find(x => x.uid === uid);
  if (!p) return;
  if (p.charm) run.charms.push(p.charm);
  p.charm = null;
  if (charm) { const i = run.charms.indexOf(charm); if (i >= 0) { run.charms.splice(i, 1); p.charm = charm; } }
}

// ---- dens and events ---------------------------------------------------------------------------------
function denChoices(run, node) {
  const lv = floorLevel(run, node);
  const pool = biomeSpecies(run).concat(SPS);
  const sp = shuffle(run, Array.from(new Set(shuffle(run, pool)))).slice(0, 3);
  return sp.map(k => mkInst(run, k, Math.max(1, lv - 1)));
}
function eventFor(run, node) {
  const keys = Object.keys(G.EVENTS).filter(k => !(k === 'forge' && run.relics.length < 2));
  return keys[(run.seed + node.id * 31 + run.act * 7) % keys.length];
}

// meta: shards for a finished run
function shardsFor(run, won) {
  return Math.round(run.stats.floors * 1 + run.stats.bosses * 10 + (won ? 25 : 0) + run.stats.caught * 1 + run.depth * 5 * (won ? 1 : 0));
}

root.GR = { newRun, starterChoices, bonus, active, partyCap, genMap, nodeById, reachable, enterNode, encounter, battleOpts,
  rewards, relicChoices, perkChoices, takePerk, addRelic, fusionsAvailable, fuse, grantXp, addXp, levelUp, canEvolve,
  mutOptions, evolve, afterBattle, partyWiped, recruit, release, bossCleared, nextAct, restHeal, shopStock, buy,
  useItemOutside, equipCharm, denChoices, eventFor, shardsFor, mkInst, xpNeed, floorLevel, pick, rint, shuffle, LV_CAP, stageFor };
})(typeof window !== 'undefined' ? window : globalThis);
