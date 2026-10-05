/* Headless season + fight checks. Run: node iron-league/tools/sim.js */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const context = {
  console: console,
  performance: { now: () => Date.now() },
  Math: Math,
  Date: Date,
  Object: Object,
  Array: Array,
  JSON: JSON,
  Number: Number,
  String: String,
  Error: Error
};
context.window = context;
context.globalThis = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, "js/data.js"), "utf8"), context);
vm.runInContext(fs.readFileSync(path.join(root, "js/arena.js"), "utf8"), context);
const IL = context.IL;

if (IL.FRAMES) throw new Error("frames belong in hero.js");
const frames = (fs.readFileSync(path.join(root, "js/hero.js"), "utf8").match(/\[[0-9.]+,[0-9.]+,[0-9.]+,[0-9.]+,[0-9.]+,[0-9.]+\]/g) || []);
if (frames.length !== 102) {
  console.error("expected 102 frame rects, got", frames.length);
  process.exit(1);
}

let fails = 0;
function check(name, ok) {
  if (!ok) { fails++; console.error("FAIL", name); }
  else console.log("ok", name);
}

const seen = new Set();
for (let t = 0; t <= 2; t += 1 / 12) {
  const f = IL.frameIndex("atk1", t);
  if (IL.CLIPS.atk1.hits.indexOf(f) >= 0) seen.add(f);
}
check("atk1 hit frames visited", seen.has(39) && seen.has(40));
check("die holds last frame", IL.frameIndex("die", 5) === 81);
check("cast loops inside 65-67", [65, 66, 67].indexOf(IL.frameIndex("cast1", 1.4)) >= 0);
check("dash enters loop", IL.frameIndex("dash", 0.5) >= 84 && IL.frameIndex("dash", 0.5) <= 86);

function fight(leftCls, rightCls, seed) {
  const n = Math.max(leftCls.length, rightCls.length);
  const rng = IL.mulberry32(seed);
  const left = [];
  const right = [];
  for (let i = 0; i < n; i++) {
    left.push(IL.randomFighter(rng, leftCls[i % leftCls.length]));
    right.push(IL.randomFighter(rng, rightCls[i % rightCls.length]));
  }
  const m = IL.createMatch({ seed: seed, left: left, right: right, leftName: "Home", rightName: "Away" });
  let steps = 0;
  while (!m.over && steps < 4000) {
    IL.stepMatch(m, 1 / 60);
    m.events.length = 0;
    steps++;
  }
  return m;
}

const samples = [];
const classIds = Object.keys(IL.CLASSES);
for (let i = 0; i < 16; i++) {
  const rng = IL.mulberry32(i * 19 + 4);
  const comp = [0, 1, 2].map(function () { return classIds[Math.floor(rng() * classIds.length)]; });
  const m = fight(comp, comp, 4000 + i);
  samples.push(m);
  m.units.forEach(u => {
    if (!Number.isFinite(u.x) || !Number.isFinite(u.y) || !Number.isFinite(u.hp)) {
      fails++;
      console.error("non finite unit", u.name, u.x, u.y, u.hp);
    }
  });
}
check("all sample fights end", samples.every(m => m.over));
const wins0 = samples.filter(m => m.winner === 0).length;
const wins1 = samples.filter(m => m.winner === 1).length;
check("both sides can win", wins0 > 0 && wins1 > 0);
const avgT = samples.reduce((s, m) => s + m.time, 0) / samples.length;
console.log("avg seconds", avgT.toFixed(1), "wins", wins0, wins1);

const archer = fight(["archer"], ["tank"], 11);
check("archer fires", archer.stats.shots > 0);
check("archer fight dealt damage", archer.stats.hits > 0);

const mage = fight(["mage"], ["warrior"], 12);
check("mage casts", mage.stats.casts > 0);

const rogue = fight(["rogue"], ["warrior"], 13);
check("rogue dashes", rogue.stats.dashes > 0);

let blocked = 0;
for (let i = 0; i < 6; i++) {
  const t = fight(["warrior"], ["tank"], 20 + i);
  blocked += t.stats.blocks;
}
check("tank blocks sometimes", blocked > 0);

const deaths = samples.reduce((s, m) => s + m.stats.deaths, 0);
check("fighters die", deaths > 0);
console.log("deaths in samples", deaths, "tank blocks", blocked);

if (avgT < 8 || avgT > 40) {
  console.error("duration out of band", avgT);
  fails++;
}

if (fails) {
  console.error(fails, "failed");
  process.exit(1);
}
console.log("sim passed");
