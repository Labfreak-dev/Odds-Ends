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

/* Build a plausible player at a given depth: gear rolled at that item level,
   keeping the best of `tries` rolls per slot the way a farming player would,
   plus a level's worth of tree points spent greedily. */
function outfit(GM, depth, opts) {
  opts = opts || {};
  const tries = opts.tries == null ? 6 : opts.tries;
  const rarity = opts.rarity == null ? 2 : opts.rarity;
  /* `behind` models pushing: gear found N depths shallower than where you are
     fighting. Farming at your own depth is the best case and hides the wall. */
  const gearDepth = Math.max(1, depth - (opts.behind || 0));

  GM.state.char.level = Math.min(GM.MAX_LEVEL, Math.max(1, Math.round(gearDepth * 0.95)));
  GM.state.depth.current = depth;
  GM.state.depth.max = depth;
  GM.state.depth.maxEver = depth;

  for (const slot of GM.SLOT_IDS) {
    const pool = GM.slotPool(slot);
    let best = null, bestScore = -Infinity;
    for (let i = 0; i < tries; i++) {
      const it = GM.makeItem({ pool, ilvl: gearDepth, rarity });
      const sc = GM.powerScore(GM.statsWith(slot, it, {}));
      if (sc > bestScore) { bestScore = sc; best = it; }
    }
    GM.state.equip[slot] = best;
  }
  GM.invalidateStats();

  /* Spend tree points greedily on whatever raises power score most. */
  GM.state.tree.points = GM.state.char.level;
  let guard = 0;
  while (GM.state.tree.points > 0 && guard++ < 400) {
    let bestNode = null, bestGain = -Infinity;
    for (const node of GM.TREE_NODES) {
      if (node.kind === "root" || GM.hasNode(node.id)) continue;
      if (!GM.canAllocate(node.id).ok) continue;
      const before = GM.powerScore(GM.stats({}));
      GM.state.tree.spent.push(node.id);
      GM.invalidateStats();
      const after = GM.powerScore(GM.stats({}));
      GM.state.tree.spent.pop();
      GM.invalidateStats();
      const gain = after - before;
      if (gain > bestGain) { bestGain = gain; bestNode = node; }
    }
    if (!bestNode) break;
    GM.state.tree.points--;
    GM.state.tree.spent.push(bestNode.id);
    GM.invalidateStats();
  }

  if (opts.town) {
    for (const b of GM.BUILDINGS) GM.state.town[b.id] = opts.town;
  }
  if (opts.perks) {
    for (const p of GM.PERKS) GM.state.perks[p.id] = opts.perks;
  }
  GM.invalidateStats();
  return GM.stats({});
}

module.exports = { load, outfit, sourceFiles };
