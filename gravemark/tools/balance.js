/* Gravemark — tools/balance.js
   Measures pacing. For a range of depths it outfits a plausible player and
   reports time-to-kill and time-to-die against BOTH a normal pack monster and
   that realm's boss.

   Sampling note: every stage that is a multiple of 10 is a boss stage, so a
   depth list of round numbers measures nothing but bosses. The normal column
   forces `noBoss` and averages several spawns to smooth the 12% elite roll.

   Targets
     normal ttk : 0.8s - 6s        (a kill is a beat, not a chore)
     boss   ttk : 5s - 90s         (an event, but not an afternoon)
     margin     : > 1.3 normal     (survivable with room to misplay)
*/
"use strict";
const { load, outfit } = require("./harness");

const DEPTHS = [1, 4, 8, 14, 22, 31, 43, 55, 67, 79, 91, 104, 117, 130];
const SAMPLES = 12;

function measure(GM, depth, ctx) {
  let ttk = 0, ttd = 0, wins = 0, n = 0;
  for (let i = 0; i < SAMPLES; i++) {
    const f = GM.forecast(depth, ctx);
    if (!isFinite(f.ttk)) return { ttk: Infinity, ttd: 0, winRate: 0 };
    ttk += f.ttk;
    ttd += isFinite(f.ttd) ? f.ttd : 1e9;
    if (f.win) wins++;
    n++;
  }
  return { ttk: ttk / n, ttd: ttd / n, winRate: wins / n };
}

function fmtT(t) {
  if (!isFinite(t)) return "never";
  if (t >= 1e8) return "immortal";
  return t < 100 ? t.toFixed(2) + "s" : Math.round(t) + "s";
}

function run(label, opts) {
  console.log("\n=== " + label + " ===");
  console.log(
    "depth".padStart(5), "| norm ttk".padStart(11), "norm ttd".padStart(11), "margin".padStart(8),
    "| boss ttk".padStart(11), "boss win".padStart(9),
    "| dps".padStart(10), "ehp".padStart(10), " verdict"
  );

  const issues = [];
  for (const d of DEPTHS) {
    const GM = load({ quiet: true });
    GM.startSeason("s_none");
    outfit(GM, d, opts);
    const st = GM.stats({});

    const norm = measure(GM, d, { noBoss: true });
    const bossDepth = GM.realmOf(d) * GM.STAGES_PER_REALM;
    const boss = measure(GM, bossDepth, {});

    const margin = norm.ttd > 0 ? norm.ttd / Math.max(0.001, norm.ttk) : 0;

    let verdict = "ok";
    if (norm.winRate < 1)        { verdict = "DEATH";   issues.push([d, "normal unwinnable"]); }
    else if (margin < 1.3)       { verdict = "thin";    issues.push([d, "margin " + margin.toFixed(2)]); }
    else if (norm.ttk > 6)       { verdict = "slow";    issues.push([d, "normal ttk " + norm.ttk.toFixed(1) + "s"]); }
    else if (norm.ttk < 0.35)    { verdict = "trivial"; }
    if (verdict === "ok" && boss.winRate < 1) { verdict = "boss wall"; issues.push([d, "boss unwinnable"]); }
    else if (verdict === "ok" && boss.ttk > 90) { verdict = "boss slog"; issues.push([d, "boss ttk " + Math.round(boss.ttk) + "s"]); }

    console.log(
      String(d).padStart(5),
      "|", fmtT(norm.ttk).padStart(9), fmtT(norm.ttd).padStart(11),
      (margin > 1e6 ? "inf" : margin.toFixed(1) + "x").padStart(8),
      "|", fmtT(boss.ttk).padStart(9), (Math.round(boss.winRate * 100) + "%").padStart(9),
      "|", GM.fmt(st.dps).padStart(8), GM.fmt(GM.effectiveLife(st, d)).padStart(10),
      " " + verdict
    );
  }
  return issues;
}

const PROFILES = [
  ["farming: rare gear at depth, tree only", {}],
  ["developed: + town 12, perks 3", { town: 12, perks: 3 }],
  ["invested: epic gear, town 25, perks 8", { rarity: 3, tries: 10, town: 25, perks: 8 }],
  /* The real test: fighting ahead of your gear is what a player actually does
     between upgrades, and it is where a wall shows up first. */
  ["PUSHING 15 ahead of gear", { behind: 15, town: 8, perks: 2 }],
  ["PUSHING 30 ahead of gear", { behind: 30, town: 8, perks: 2 }]
];

let allIssues = 0;
for (const [label, opts] of PROFILES) {
  const issues = run(label, opts);
  allIssues += issues.length;
}

console.log("\n" + "-".repeat(78));
console.log(allIssues === 0
  ? "PACING OK across all profiles and depths."
  : "pacing issues flagged: " + allIssues);
