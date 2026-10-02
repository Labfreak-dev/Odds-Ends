// Headless balance runs for The Wilds: a bot squad walks every floor, fights each wild room and
// the lair, recruits what it beats, and uses berries and shrines. Same generator and engine as the page.
//   node glimmerdeep/wsim.js [expeditions=200]          independent first expeditions (12 unlocked)
//   CAREER=1 node glimmerdeep/wsim.js [players=20]     players keep their unlocks: expeditions to collect all 72
'use strict';
require('./species2.js'); require('./data.js'); require('./chess.js'); require('./crun.js'); require('./wgen.js');
const G = globalThis.GD, C = globalThis.GC, Wg = globalThis.GW;
const N = +process.argv[2] || 200;
const BIOMES = Object.keys(G.BIOMES).filter(k => k !== 'core');
const stat = { floorReached: [0, 0, 0, 0, 0, 0], done: 0, unlocks: 0, fights: [[], [], [], [], []], lair: [[], [], [], [], []] };
function expedition(n, unl) {
  const r = Wg.rng(1000 + n * 31);
  const isU = k => !!unl[k];
  let uid = 1;
  const squad = [];
  // the bot brings its highest-tier unlocked creatures (ties broken at random)
  const base = Object.keys(unl).sort(() => r() - 0.5).sort((a, b) => G.TIER[b] - G.TIER[a]);
  for (const sp of base.slice(0, +process.env.SQUAD || Wg.SQUAD_START)) squad.push({ uid: uid++, sp, star: 1, xp: 0, hp: 1 });
  const before = Object.keys(unl).length;
  let floor = 1, alive = true;
  for (; floor <= Wg.FLOORS && alive; floor++) {
    stat.floorReached[floor]++;
    const biome = floor === Wg.FLOORS ? 'core' : Wg.pick(r, BIOMES);
    const f = Wg.genFloor(floor, biome, 7 + n * 13 + floor, isU);
    const rooms = Object.values(f.rooms);
    // berries, chest heals and the shrine (the bot visits the shrine before the lair)
    const fightRooms = rooms.filter(a => a.mon && a.type !== 'lair' && (a.type !== 'locked'));
    const lair = rooms.find(a => a.type === 'lair');
    const shrine = rooms.some(a => a.item === 'shrine');
    let berries = rooms.filter(a => a.item === 'berry').length;
    for (const a of fightRooms.concat(lair ? [lair] : [])) {
      if (a === lair && shrine) for (const s of squad) s.hp = s.hp > 0 ? 1 : 0.5;
      while (true) {
        const fit = squad.filter(s => s.hp > 0);
        if (!fit.length) { alive = false; break; }
        if (berries && fit.some(s => s.hp < 0.5)) { berries--; for (const s of fit) s.hp = Math.min(1, s.hp + 0.35); }
        const insts = fit.map(m => { const i = { uid: m.uid, sp: m.sp, star: m.star, muts: [], hpFrac: m.hp }; i.skill = C.defaultSkill(i); return i; });
        const mon = a.mon;
        const foes = [{ uid: -1, sp: mon.sp, star: mon.star, muts: [], scale: mon.scale }].concat(mon.escorts.map((sp, i) => ({ uid: -2 - i, sp, star: mon.escStar || 1, muts: [], scale: mon.scale * 0.92 })));
        for (const x of foes) x.skill = C.defaultSkill(x);
        const st = C.create({ board: Wg.placeSide(insts, 0), enemies: Wg.placeSide(foes, 1), relics: [], perks: {}, biome, seed: (n * 977 + floor * 31 + uid++) >>> 0, noHaz: true, mods: {} });
        C.resolve(st);
        for (const u of st.units) if (u.side === 0 && !u.summoned) { const m = squad.find(s => s.uid === u.inst.uid); m.hp = u.alive ? Math.max(0.05, u.hp / u.maxHp) : 0; }
        const win = st.over === 1;
        (a === lair ? stat.lair : stat.fights)[floor - 1].push(win ? 1 : 0);
        if (win) {
          if (!unl[mon.sp]) { unl[mon.sp] = 1; stat.unlocks++; }
          for (const s of fit) { s.xp += a === lair ? 2 : 1; while (s.star < 3 && s.xp >= Wg.XP_STAR[s.star]) { s.star++; s.hp = Math.min(1, s.hp + 0.3); } }
          if (squad.length < Wg.SQUAD_MAX && !squad.some(s => s.sp === mon.sp)) squad.push({ uid: uid++, sp: mon.sp, star: 1, xp: 0, hp: 1 });
          break;
        }
        if (a !== lair) break;            // the bot skips a wild room it lost, but must beat the lair
      }
      if (!alive) break;
    }
    if (!alive) break;
    for (const s of squad) s.hp = s.hp > 0 ? Math.min(1, s.hp + 0.25) : 0.4;
  }
  if (alive) stat.done++;
  return { floor: Math.min(floor, Wg.FLOORS), got: Object.keys(unl).length - before };
}
const base = () => { const u = {}; for (const k of G.BASE_SPECIES) u[k] = 1; return u; };
if (process.env.CAREER) {
  const P = +process.argv[2] || 20, total = Object.keys(G.SP).length, runsTo = [], curve = [];
  for (let p = 0; p < P; p++) {
    const unl = base(); let e = 0;
    while (Object.keys(unl).length < total && e < 60) { const res = expedition(p * 1000 + e, unl); (curve[e] = curve[e] || []).push(res.got); e++; }
    runsTo.push(e);
  }
  runsTo.sort((a, b) => a - b);
  console.log(`players ${P}: expeditions to unlock all ${total}: median ${runsTo[P >> 1]}  (min ${runsTo[0]}, max ${runsTo[P - 1]})`);
  console.log('new unlocks per expedition:', curve.slice(0, 15).map(c => (c.reduce((a, b) => a + b, 0) / c.length).toFixed(1)).join(' '));
  process.exit(0);
}
for (let n = 0; n < N; n++) expedition(n, base());
const pct = a => a.length ? Math.round(100 * a.reduce((x, y) => x + y, 0) / a.length) + '%' : '-';
console.log(`expeditions ${N}  cleared all ${Wg.FLOORS}: ${Math.round(100 * stat.done / N)}%  avg unlocks ${(stat.unlocks / N).toFixed(1)}`);
console.log('reached floor', stat.floorReached.slice(1).map(v => Math.round(100 * v / N) + '%').join(' / '));
console.log('wild fights won', stat.fights.map(pct).join(' / '), '  lair', stat.lair.map(pct).join(' / '));
