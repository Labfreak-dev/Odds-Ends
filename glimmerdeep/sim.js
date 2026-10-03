// Headless balance sim for the auto-chess run: a simple bot shops, merges, levels and fights.
//   node glimmerdeep/sim.js [runs=200] [depth=0]
require('./species2.js'); require('./data.js'); require('./relics2.js'); require('./chess.js'); require('./crun.js');
const G = globalThis.GD, C = globalThis.GC, R = globalThis.GR;

const bossLog = [];
const TGT = [0.8, 0.62, 0.52, 0.44, 0.36, 0.25];   // boss win-rate targets by stage
const N = +process.argv[2] || 200, DEPTH = +process.argv[3] || 0;
// UP=max plays with every camp upgrade bought, UP=old with only the pre-g10 ones; UPX=key leaves one out
const UP = {};
// BASE=1 plays with only the twelve free species unlocked (a brand-new save)
const BASE = process.env.BASE ? Object.fromEntries(G.BASE_SPECIES.map(k => [k, 1])) : null;
const OLD = { gold: 3, hide: 2, relic: 1, evo: 1, shiny: 1, starter: 2, choices: 1, heal: 1 };
if (process.env.UP) for (const k in G.META) {
  if (k === process.env.UPX) continue;
  const r = process.env.UP === 'max' ? G.META[k].max : OLD[k] || 0;
  if (r) UP[k] = r;
}
let wins = 0, errors = 0;
const deathRound = [], byRound = {}, fightLen = [], bossWins = [0, 0, 0, 0, 0, 0], bossTries = [0, 0, 0, 0, 0, 0], byBoss = {};
const power = u => G.TIER[u.sp] * Math.pow(3, u.star - 1);

function shop(run) {
  const owned = new Set(run.units.map(u => u.sp));
  // 1: copies of what we own
  for (let i = 0; i < run.shop.length; i++) if (run.shop[i] && owned.has(run.shop[i]) && R.canBuy(run, i)) { R.buy(run, i); R.merges(run); }
  // 2: fill the board
  while (R.onBoard(run).length + R.onBench(run).length < R.cap(run) + 1) {
    let best = -1;
    for (let i = 0; i < run.shop.length; i++) if (run.shop[i] && R.canBuy(run, i) && (best < 0 || G.TIER[run.shop[i]] > G.TIER[run.shop[best]])) best = i;
    if (best < 0) break;
    R.buy(run, best); R.merges(run);
  }
  // 3: level up while keeping 10 for interest
  while (run.gold >= 14 && run.tlv < 8) R.buyXp(run);
  // 4: late rerolls for copies
  let rolls = 0;
  while (run.round >= 8 && run.gold >= 22 && rolls++ < 6) {
    R.reroll(run);
    const own = new Set(run.units.map(u => u.sp));
    for (let i = 0; i < run.shop.length; i++) if (run.shop[i] && own.has(run.shop[i]) && R.canBuy(run, i)) { R.buy(run, i); R.merges(run); }
  }
  // bench full: sell the weakest bench units
  while (R.freeBench(run) < 0) { const w = R.onBench(run).sort((a, b) => power(a) - power(b))[0]; R.sell(run, w.uid); }
  // swap stronger bench units onto the board
  for (const b of R.onBench(run).sort((a, c) => power(c) - power(a))) {
    const weakest = R.onBoard(run).sort((a, c) => power(a) - power(c))[0];
    if (weakest && power(b) > power(weakest)) { const x = weakest.x, y = weakest.y; R.placeBench(run, weakest.uid, b.slot); R.placeBoard(run, b.uid, x, y); }
  }
  R.autoPlace(run);
  for (const u of run.units) if (!u.charm && run.charms.length) R.equipCharm(run, u.uid, run.charms[0]);
}

for (let n = 0; n < N; n++) {
  const seed = 5000 + n * 11;
  const run = R.newRun({ up: UP, unlocked: BASE }, seed, DEPTH);
  R.giveStarter(run, R.starterChoices({ unlocked: BASE }, seed)[0]);
  if (process.env.RELIC && G.RELICS[process.env.RELIC]) R.addRelic(run, process.env.RELIC);
  if (process.env.ALLNEW) for (const k in (G.RELICS2 || {})) R.addRelic(run, k);
  try {
    while (!run.over) {
      shop(run);
      for (const f of R.fusionsAvailable(run)) R.fuse(run, f);
      const st = C.create(R.fightOpts(run, seed + run.round * 101));
      C.resolve(st);
      for (const u of st.units) if (u.hp > u.maxHp || u.hp < 0 || Number.isNaN(u.hp)) throw new Error('bad hp ' + u.name + ' ' + u.hp);
      fightLen.push(st.t);
      const kind = R.roundKind(run.round), stage = R.stageOf(run.round), round = run.round;
      if (kind === 'boss') { bossTries[stage]++; if (st.over === 1) bossWins[stage]++; if (process.env.BOSSLOG) bossLog.push([R.bossOf(run), stage, st.over === 1 ? 1 : 0]);
        const bk = R.bossOf(run), b = byBoss[bk] = byBoss[bk] || [0, 0, 0]; b[1]++; b[2] += TGT[stage]; if (st.over === 1) b[0]++; }
      const res = R.endRound(run, st);
      const rec = byRound[round] = byRound[round] || { n: 0, win: 0, hp: 0, lv: 0, units: 0, stars: 0 };
      rec.n++; rec.win += res.win ? 1 : 0; rec.hp += run.hp; rec.lv += run.tlv; rec.units += R.onBoard(run).length;
      rec.stars += R.onBoard(run).reduce((s, u) => s + u.star, 0) / Math.max(1, R.onBoard(run).length);
      for (const p of run.pending || []) {
        if (p.k === 'relic') R.addRelic(run, p.opts[0]);
        if (p.k === 'perk') R.takePerk(run, p.opts[0]);
        if (p.k === 'biome') R.setBiome(run, R.pick(run, p.opts));
      }
      run.pending = [];
      for (const u of R.merges(run)) R.applyMut(run, u, R.mutOptions(run, u)[0]);
      if (run.round > 40) throw new Error('runaway run');
    }
    if (run.over === 1) wins++; else deathRound.push(run.round);
  } catch (e) { errors++; if (errors < 4) console.error(e.stack); }
}
const avg = a => a.length ? (a.reduce((s, x) => s + x, 0) / a.length).toFixed(1) : '-';
console.log(`runs ${N}  depth ${DEPTH}  wins ${wins} (${(100 * wins / N).toFixed(0)}%)  errors ${errors}  avg death round ${avg(deathRound)}`);
console.log('boss win rate by stage', bossTries.map((t, i) => t ? (100 * bossWins[i] / t).toFixed(0) + '%' : '-').join(' / '));
console.log('by boss', Object.keys(byBoss).map(k => `${k} ${Math.round(100 * byBoss[k][0] / byBoss[k][1])}% (${byBoss[k][1]}) t${Math.round(100 * byBoss[k][2] / byBoss[k][1])}`).join(', '));
console.log('fight length avg', avg(fightLen) + 's', 'max', Math.max(...fightLen).toFixed(1) + 's');
console.log('round  win%   hp  lv  units  stars');
for (const r of Object.keys(byRound).map(Number).sort((a, b) => a - b)) {
  const x = byRound[r];
  console.log(String(r).padStart(5), String(Math.round(100 * x.win / x.n)).padStart(5), String(Math.round(x.hp / x.n)).padStart(5),
    (x.lv / x.n).toFixed(1).padStart(4), (x.units / x.n).toFixed(1).padStart(6), (x.stars / x.n).toFixed(2).padStart(6), ' n=' + x.n);
}
if (process.env.BOSSLOG) require('fs').writeFileSync(process.env.BOSSLOG, JSON.stringify(bossLog));
process.exit(errors ? 1 : 0);
