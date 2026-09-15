/* Gravemark — tools/balance.js
   Measures pacing for a SQUAD. For a range of depths it outfits a plausible
   squad (levelled for the depth, optionally carrying names cut from
   gravemarks) and reports time-to-clear-the-pack against time-to-be-broken,
   for a normal pack and for that realm's boss.

   Targets
     pack ttk : 2s - 14s      (a stage is a beat, not a chore)
     boss ttk : 8s - 120s     (an event)
     margin   : > 1.3         (survivable with room to misplay)
*/
"use strict";
const { load, outfit } = require("./harness");

const DEPTHS = [1, 4, 8, 14, 22, 31, 43, 55, 67, 79, 91, 104, 117, 130];
const SAMPLES = 8;

function measure(GM, sq, depth, boss) {
  let ttk = 0, ttd = 0, wins = 0;
  for (let i = 0; i < SAMPLES; i++) {
    const ctx = boss ? {} : { noBoss: true };
    const st = GM.squadStats(sq, ctx);
    const pack = GM.spawnPack(depth, ctx);
    let hp = 0;
    for (const m of pack) hp += m.hp;
    const pdps = GM.dpsAgainst(st, pack[0]);
    const incoming = GM.packIncoming(st, pack);
    const net = GM.netLifeRate(st, incoming, pdps);
    const k = pdps > 0 ? hp / pdps : Infinity;
    const d = net >= 0 ? Infinity : st.life / -net;
    if (!isFinite(k)) return { ttk: Infinity, ttd: 0, winRate: 0 };
    ttk += k; ttd += isFinite(d) ? d : 1e9;
    if (k < d) wins++;
  }
  return { ttk: ttk / SAMPLES, ttd: ttd / SAMPLES, winRate: wins / SAMPLES };
}

const fmtT = t => !isFinite(t) ? "never" : t >= 1e8 ? "immortal" : t < 100 ? t.toFixed(2) + "s" : Math.round(t) + "s";

function run(label, opts) {
  console.log("\n=== " + label + " ===");
  console.log("depth".padStart(5), "| pack ttk".padStart(11), "pack ttd".padStart(11), "margin".padStart(8),
              "| boss ttk".padStart(11), "boss win".padStart(9), "| sq dps".padStart(10), "sq life".padStart(10), " verdict");
  const issues = [];
  for (const d of DEPTHS) {
    const GM = load({ quiet: true });
    GM.startSeason("s_none");
    const st = outfit(GM, d, opts);
    const sq = GM.state.squads[0];

    const norm = measure(GM, sq, d, false);
    const boss = measure(GM, sq, GM.realmOf(d) * GM.STAGES_PER_REALM, true);
    const margin = norm.ttd > 0 ? norm.ttd / Math.max(0.001, norm.ttk) : 0;

    let verdict = "ok";
    if (norm.winRate < 1)     { verdict = "DEATH";   issues.push(d + " unwinnable"); }
    else if (margin < 1.3)    { verdict = "thin";    issues.push(d + " margin " + margin.toFixed(2)); }
    else if (norm.ttk > 14)   { verdict = "slow";    issues.push(d + " pack " + norm.ttk.toFixed(1) + "s"); }
    else if (norm.ttk < 1.2)  { verdict = "trivial"; issues.push(d + " pack " + norm.ttk.toFixed(2) + "s"); }
    if (verdict === "ok" && boss.winRate < 1) { verdict = "boss wall"; issues.push(d + " boss wall"); }
    else if (verdict === "ok" && boss.ttk > 120) { verdict = "boss slog"; issues.push(d + " boss " + Math.round(boss.ttk) + "s"); }

    console.log(String(d).padStart(5), "|", fmtT(norm.ttk).padStart(9), fmtT(norm.ttd).padStart(11),
      (margin > 1e6 ? "inf" : margin.toFixed(1) + "x").padStart(8), "|",
      fmtT(boss.ttk).padStart(9), (Math.round(boss.winRate * 100) + "%").padStart(9), "|",
      GM.fmt(st.dps).padStart(8), GM.fmt(st.life).padStart(10), " " + verdict);
  }
  return issues;
}

const PROFILES = [
  ["levelling: no names cut", {}],
  ["developed: 2 names each, town 12, perks 3", { names: 2, town: 12, perks: 3 }],
  ["PUSHING 20 ahead of level", { behind: 20, names: 1, town: 8, perks: 2 }],
  ["thin squad of 3", { size: 3 }]
];

let all = 0;
for (const [label, opts] of PROFILES) all += run(label, opts).length;
console.log("\n" + "-".repeat(84));
console.log(all === 0 ? "PACING OK across all profiles and depths." : "pacing issues flagged: " + all);
