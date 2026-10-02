// Headless balance sim: plays whole runs with simple choices.
//   node glimmerdeep/sim.js [runs=200] [depth=0]
// Prints where runs die, party levels at each boss, and a few engine invariants.
require('./data.js'); require('./battle.js'); require('./run.js');
const G = globalThis.GD, B = globalThis.GB, R = globalThis.GR;

const N = +process.argv[2] || 200, DEPTH = +process.argv[3] || 0;
const deaths = {}, lvAtBoss = [[], [], [], []], rounds = [];
let wins = 0, errors = 0;

function fight(run, node, seed) {
  const enemies = R.encounter(run, node).map(e => Object.assign({}, e));
  const st = B.create(R.battleOpts(run, enemies, seed));
  let n = 0;
  while (!st.over && n < 60) {
    const ev = B.round(st, {});
    for (const e of ev) if (e.k === 'dmg' && !(e.v >= 0)) throw new Error('bad dmg ' + JSON.stringify(e));
    for (const f of st.f) if (f.hp > f.maxHp || f.hp < 0) throw new Error('hp out of range ' + f.name);
    n++;
    // drink a berry when someone is low
    if (!st.over && run.items.berry) {
      const low = B.alive(st, 0).find(f => f.hp / f.maxHp < 0.3);
      if (low) { B.useItem(st, 'berry', low.id); run.items.berry--; }
    }
  }
  rounds.push(n);
  return st;
}

for (let i = 0; i < N; i++) {
  const seed = 1000 + i * 7;
  const starter = ['cind', 'bubb', 'sprt'][i % 3];
  const run = R.newRun({ up: {} }, starter, seed, DEPTH);
  let alive = true;
  try {
    outer: while (true) {
      while (true) {
        const opts = R.reachable(run);
        if (!opts.length) break;
        // prefer battles/elites early, rest when hurt
        const hurt = run.party.reduce((s, p) => s + p.hpPct, 0) / run.party.length < 0.55;
        const nodes = opts.map(id => R.nodeById(run, id));
        let node = nodes.find(n => hurt && n.type === 'rest') || nodes.find(n => n.type === 'boss') || R.pick(run, nodes);
        R.enterNode(run, node.id);
        if (node.type === 'battle' || node.type === 'elite' || node.type === 'boss') {
          if (node.type === 'boss') lvAtBoss[run.act].push(R.active(run).reduce((s, p) => s + p.lvl, 0) / Math.max(1, R.active(run).length));
          const st = fight(run, node, seed + run.step);
          R.afterBattle(run, st);
          if (st.over !== 1) { const k = run.act + ':' + node.type; deaths[k] = (deaths[k] || 0) + 1; alive = false; break outer; }
          const rw = R.rewards(run, st, node);
          run.gold += rw.gold;
          R.grantXp(run, rw.xp, st.f.filter(f => f.side === 0).map(f => f.inst.uid));
          for (const p of run.party) while (R.canEvolve(run, p)) R.evolve(run, p, R.mutOptions(run, p)[0]);
          if (rw.recruit.length && run.party.length < R.partyCap(run)) R.recruit(run, rw.recruit[0]);
          if (rw.relics.length) R.addRelic(run, rw.relics[0]);
          for (const f of R.fusionsAvailable(run)) R.fuse(run, f);
          if (node.type === 'boss') {
            R.takePerk(run, rw.perk[0]);
            R.bossCleared(run);
            if (run.act === 3) { wins++; break outer; }
            R.nextAct(run, R.pick(run, G.ACTS[run.act + 1]));
            continue;
          }
        } else if (node.type === 'rest') R.restHeal(run);
        else if (node.type === 'treasure') R.addRelic(run, R.relicChoices(run, 3)[0]);
        else if (node.type === 'den') { if (run.party.length < R.partyCap(run)) R.recruit(run, R.denChoices(run, node)[0]); }
        else if (node.type === 'shop') {
          const s = R.shopStock(run);
          for (const it of s.items) if (it.kind === 'relic' || it.kind === 'item') R.buy(run, it);
        }
        // equip spare charms
        for (const p of run.party) if (!p.charm && run.charms.length) R.equipCharm(run, p.uid, run.charms[0]);
        // order party: strongest first
        run.party.sort((a, b) => (b.hpPct > 0) - (a.hpPct > 0) || b.lvl - a.lvl);
      }
    }
  } catch (e) { errors++; if (errors < 4) console.error(e.stack); }
}
const avg = a => a.length ? (a.reduce((s, x) => s + x, 0) / a.length).toFixed(1) : '-';
console.log(`runs ${N}  depth ${DEPTH}  wins ${wins} (${(100 * wins / N).toFixed(0)}%)  errors ${errors}`);
console.log('deaths', JSON.stringify(deaths));
console.log('avg active level at boss per act', lvAtBoss.map(avg).join(' / '));
console.log('avg rounds per battle', avg(rounds), ' max', Math.max(...rounds));
process.exit(errors ? 1 : 0);
