/* Gravemark — tools/harness.js
   Loads the game's classic scripts into a Node vm with a fake window and
   localStorage, so balance and logic can be tested without a browser.
   Used by tools/balance.js and tools/test-core.js. */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const SRC_DIR = path.join(__dirname, "..", "src");

function sourceFiles() {
  return fs.readdirSync(SRC_DIR)
    .filter(f => f.endsWith(".js"))
    .sort()
    .map(f => path.join(SRC_DIR, f));
}

function makeStorage() {
  const map = new Map();
  return {
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: k => { map.delete(k); },
    clear: () => map.clear(),
    get length() { return map.size; }
  };
}

function load(opts) {
  opts = opts || {};
  const files = sourceFiles();
  const fakeWindow = { localStorage: makeStorage() };

  /* Enough of a DOM that UI files could be loaded too; the logic files below
     18 never touch it. */
  const sandbox = {
    window: fakeWindow,
    localStorage: fakeWindow.localStorage,
    console: opts.quiet ? { log(){}, warn(){}, error(){} } : console,
    Math, Date, JSON, parseInt, parseFloat, isFinite, isNaN,
    setTimeout, clearTimeout, setInterval, clearInterval,
    /* Enough of the browser globals that a UI file loaded with
       logicOnly:false does not die on sight. */
    performance: { now: () => Date.now() },
    requestAnimationFrame: () => 0,
    Image: undefined,
    document: undefined
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  const loaded = [];
  for (const f of files) {
    const name = path.basename(f);
    /* Only the logic layer by default — UI files need a real document.
       The boundary is 30: files 00-18 are logic (18-assets.js included, it is
       the manifest and has no DOM dependency), 30+ are UI. */
    if (opts.logicOnly !== false && /^(3[0-9]|9[0-9])-/.test(name)) continue;
    const code = fs.readFileSync(f, "utf8");
    try {
      vm.runInContext(code, sandbox, { filename: name });
      loaded.push(name);
    } catch (e) {
      throw new Error("Failed loading " + name + ": " + e.message);
    }
  }

  if (!sandbox.GM) throw new Error("GM namespace never appeared");
  sandbox.GM.__loaded = loaded;
  return sandbox.GM;
}

/* Build a plausible SQUAD at a given depth: five heroes of mixed class at
   the level a player farming that depth would have, ranked as high as that
   level needs (rank I caps at 60, II at 90), carrying `names` epitaphs each
   rolled at that depth, plus a level's worth of tree points spent greedily. */
function outfit(GM, depth, opts) {
  opts = opts || {};
  const size = opts.size == null ? GM.SQUAD_SIZE : opts.size;
  const names = opts.names == null ? 0 : opts.names;
  const traitDepth = Math.max(1, depth - (opts.behind || 0));
  const level = Math.min(120, Math.max(1, Math.round(traitDepth * 0.95)));
  const rank = opts.rank || (level > 90 ? 3 : level > 60 ? 2 : 1);

  const sq = GM.state.squads[0];
  GM.state.heroes = [];
  sq.members = [];
  const classes = ["warden", "reaver", "pyre", "stalker", "sexton"];
  for (let i = 0; i < size; i++) {
    const h = GM.makeHero({ classId: classes[i % classes.length], rank });
    h.level = Math.min(level, GM.heroMaxLevel(h));
    GM.state.heroes.push(h);
    sq.members.push(h.id);
  }
  sq.stage = depth; sq.max = depth;
  GM.state.depth.maxEver = depth;

  /* Names: the best of a few rolls per slot, the way a player who picks
     which epitaph to cut would. */
  for (const h of GM.state.heroes) {
    const used = {};
    for (let n = 0; n < Math.min(names, GM.heroTraitCap(h)); n++) {
      let best = null, bestScore = -Infinity;
      for (let t = 0; t < 4; t++) {
        const probe = Object.assign({}, used);
        const rec = GM.rollEpitaphRecord(h.classId, traitDepth, probe);
        if (!rec) continue;
        const sc = GM.powerScore(GM.heroStatsWith(h, rec, null, null));
        if (sc > bestScore) { bestScore = sc; best = rec; }
      }
      if (!best) break;
      used[GM.AFFIX_BY_ID[best.affixId].group] = true;
      h.traits.push(Object.assign({ from: traitDepth, name: GM.AFFIX_BY_ID[best.affixId].name }, best));
    }
  }
  GM.invalidateStats();

  GM.state.tree.points = level;
  let guard = 0;
  const probe = GM.state.heroes[0];
  while (GM.state.tree.points > 0 && guard++ < 400) {
    let bestNode = null, bestGain = -Infinity;
    for (const node of GM.TREE_NODES) {
      if (node.kind === "root" || GM.hasNode(node.id)) continue;
      if (!GM.canAllocate(node.id).ok) continue;
      const before = GM.powerScore(GM.heroStats(probe, null));
      GM.state.tree.spent.push(node.id);
      GM.invalidateStats();
      const after = GM.powerScore(GM.heroStats(probe, null));
      GM.state.tree.spent.pop();
      GM.invalidateStats();
      if (after - before > bestGain) { bestGain = after - before; bestNode = node; }
    }
    if (!bestNode) break;
    GM.state.tree.points--;
    GM.state.tree.spent.push(bestNode.id);
    GM.invalidateStats();
  }

  if (opts.town)  for (const b of GM.BUILDINGS) GM.state.town[b.id] = opts.town;
  if (opts.perks) for (const p of GM.PERKS) GM.state.perks[p.id] = opts.perks;
  GM.invalidateStats();
  return GM.squadStats(sq, null);
}

module.exports = { load, outfit, sourceFiles };
