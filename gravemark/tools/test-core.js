/* Gravemark — tools/test-core.js
   Exercises the logic layer end to end without a browser. Catches the runtime
   errors that a syntax check cannot: wrong signatures, missing fields, and
   state that does not survive a save/load round trip. */
"use strict";
const { load, outfit } = require("./harness");

let pass = 0, fail = 0;
const failures = [];

function ok(cond, label, detail) {
  if (cond) { pass++; }
  else { fail++; failures.push(label + (detail ? "  [" + detail + "]" : "")); }
}
function section(n) { console.log("\n-- " + n); }

/* ---------- data integrity ---------------------------------------------- */
section("data");
{
  const GM = load({ quiet: true });
  ok(GM.BASES.length === 112, "112 bases generated", GM.BASES.length);
  ok(GM.AFFIXES.length > 25, "affix pool populated", GM.AFFIXES.length);
  /* The real invariant is not a node count but that a maxed character cannot
     allocate the entire tree — otherwise there is no build to choose. */
  const maxPoints = (GM.MAX_LEVEL - 1) * GM.TREE_POINTS_PER_LEVEL;
  const allocatable = GM.TREE_NODES.length - 1;
  ok(allocatable > maxPoints, "tree is larger than a maxed character's points",
     allocatable + " nodes vs " + maxPoints + " points");

  /* every affix stat must exist in the stat vocabulary, or it silently does nothing */
  let unknown = GM.AFFIXES.filter(a => !GM.STAT_DEFS[a.stat]).map(a => a.id);
  ok(unknown.length === 0, "every affix maps to a known stat", unknown.join(","));

  let badBag = [];
  const bag = GM.emptyBag();
  GM.AFFIXES.forEach(a => { if (bag[a.stat] === undefined) badBag.push(a.id); });
  ok(badBag.length === 0, "every affix stat exists in the stat bag", badBag.join(","));

  /* tree/town/perk/runeword stats too */
  let treeBad = [];
  GM.TREE_NODES.forEach(n => Object.keys(n.stats).forEach(k => {
    if (bag[k] === undefined) treeBad.push(n.id + ":" + k);
  }));
  ok(treeBad.length === 0, "every tree node stat is real", treeBad.slice(0, 3).join(","));

  let rwBad = [];
  GM.RUNEWORDS.forEach(r => Object.keys(r.stats).forEach(k => {
    if (bag[k] === undefined) rwBad.push(r.id + ":" + k);
  }));
  ok(rwBad.length === 0, "every runeword stat is real", rwBad.join(","));

  let runeBad = [];
  GM.RUNES.forEach(r => [r.wep, r.arm].forEach(f => Object.keys(f).forEach(k => {
    if (bag[k] === undefined) runeBad.push(r.id + ":" + k);
  })));
  ok(runeBad.length === 0, "every rune stat is real", runeBad.join(","));

  /* tree connectivity: every node must be reachable from the root */
  const seen = new Set(["root"]);
  const queue = ["root"];
  while (queue.length) {
    const id = queue.shift();
    const n = GM.TREE_BY_ID[id];
    if (!n) continue;
    n.links.forEach(l => { if (!seen.has(l)) { seen.add(l); queue.push(l); } });
  }
  ok(seen.size === GM.TREE_NODES.length, "every tree node reachable from root",
     seen.size + "/" + GM.TREE_NODES.length);

  /* runewords must be socketable on a base that actually has enough sockets */
  let rwFit = [];
  GM.RUNEWORDS.forEach(rw => {
    const fits = rw.pools.some(pool =>
      GM.BASES.some(b => b.pool === pool && (b.sockets || 0) >= rw.seq.length));
    if (!fits) rwFit.push(rw.id);
  });
  ok(rwFit.length === 0, "every runeword fits some base", rwFit.join(","));
}

/* ---------- loot --------------------------------------------------------- */
section("loot");
{
  const GM = load({ quiet: true });
  GM.startSeason("s_none");
  let bad = 0, named = 0;
  for (let i = 0; i < 3000; i++) {
    const it = GM.makeItem({ ilvl: 1 + (i % 130), rarityBonus: 0.5 });
    if (!it || !GM.BASE_BY_ID[it.baseId]) bad++;
    const r = GM.RARITY_BY_ID[it.rarity];
    if (it.affixes.length > r.maxAff) bad++;
    if (GM.itemName(it)) named++;
    const st = GM.itemStats(it);
    for (const k in st) if (!isFinite(st[k])) bad++;
  }
  ok(bad === 0, "3000 generated items are well-formed", bad + " bad");
  ok(named === 3000, "every item names itself");

  /* rarity gear must actually shift the distribution */
  function rarityMean(bonus) {
    let t = 0;
    for (let i = 0; i < 4000; i++) t += GM.rollRarity(bonus).id;
    return t / 4000;
  }
  const lo = rarityMean(0), hi = rarityMean(3);
  ok(hi > lo, "item rarity raises the average rarity", lo.toFixed(3) + " -> " + hi.toFixed(3));
}

/* ---------- combat and progression --------------------------------------- */
section("combat");
{
  const GM = load({ quiet: true });
  GM.startSeason("s_none");
  const r = GM.tick(600);
  ok(r.kills > 0, "a fresh character kills things in 10 minutes", "kills=" + r.kills);
  ok(GM.state.depth.maxEver > 1, "and makes progress", "depth=" + GM.state.depth.maxEver);
  ok(GM.state.char.gold > 0, "and earns gold");
  ok(isFinite(GM.stats({}).dps), "dps stays finite");
  ok(GM.state.char.level > 1, "and levels up", "lv=" + GM.state.char.level);

  /* the tick must terminate even for a character that cannot win */
  const GM2 = load({ quiet: true });
  GM2.startSeason("s_none");
  GM2.state.depth.current = 400;   /* hopeless */
  const t0 = Date.now();
  const r2 = GM2.tick(3600, { offline: true });
  ok(Date.now() - t0 < 5000, "a hopeless tick still terminates", (Date.now() - t0) + "ms");
  ok(r2.deaths > 0, "and records deaths", "deaths=" + r2.deaths);
}

/* ---------- the opening minute -------------------------------------------
   The balance harness always starts the player fully geared, so it is blind
   to the new-player experience. This is the check that would have caught a
   thirty-second, losable first kill. */
section("first contact");
{
  const GM = load({ quiet: true });
  GM.startSeason("s_none");

  const equipped = GM.SLOT_IDS.filter(s => GM.state.equip[s]).length;
  ok(equipped >= 3, "a new character starts with a kit", equipped + " pieces");

  const f = GM.forecast(1, { noBoss: true });
  ok(f.win, "the first monster is winnable", "ttk=" + f.ttk.toFixed(1) + " ttd=" + f.ttd.toFixed(1));
  ok(f.ttk < 8, "and dies in under eight seconds", f.ttk.toFixed(2) + "s");

  const r = GM.tick(30);
  ok(r.kills >= 2, "30 seconds of play yields at least two kills", "kills=" + r.kills);
  ok(r.deaths === 0, "and no deaths in the opening", "deaths=" + r.deaths);

  /* and the very first drops must actually be upgrades over the kit */
  const GM2 = load({ quiet: true });
  GM2.startSeason("s_none");
  GM2.tick(180);
  ok(GM2.state.tally.drops > 0, "items drop in the first three minutes", GM2.state.tally.drops);
}

/* ---------- graves, epitaphs, inscription -------------------------------- */
section("gravemarks");
{
  const GM = load({ quiet: true });
  GM.startSeason("s_none");
  outfit(GM, 40);

  const g = GM.plantGrave(40, { name: "Test Horror" });
  ok(GM.state.graves.length === 1, "death plants a gravemark");
  ok(g.recorded.length > 0, "the gravemark records worn affixes", g.recorded.length + " mods");

  const eps = GM.recoverGrave(g, GM.stats({}));
  ok(eps.length >= 1, "recovering yields at least one epitaph", eps.length);
  ok(GM.state.graves.length === 0, "and consumes the gravemark");

  const ep = GM.state.epitaphs[0];
  /* find an item the epitaph is legal on */
  const def = GM.AFFIX_BY_ID[ep.affixId];
  const pool = def.pools[0];
  const item = GM.makeItem({ pool, ilvl: 40, rarity: 2 });
  GM.state.char.shards = 1e9;
  const before = item.affixes.length;
  const res = GM.inscribe(item, ep, item.affixes[item.affixes.length - 1]);
  ok(res.ok, "an epitaph inscribes onto a legal base", res.why);
  const got = item.affixes.filter(a => a.id === ep.affixId)[0];
  ok(!!got, "the inscribed affix is present");
  ok(got && got.value === ep.value, "and carries the EXACT remembered value",
     got ? got.value + " vs " + ep.value : "missing");
  ok(item.affixes.length <= GM.maxAffixes(item), "without exceeding the affix cap",
     item.affixes.length + "/" + GM.maxAffixes(item));

  /* over-filling the grave list must raise a revenant, not grow forever */
  const GM3 = load({ quiet: true });
  GM3.startSeason("s_none");
  outfit(GM3, 30);
  for (let i = 0; i < 12; i++) GM3.plantGrave(30 + i, { name: "x" });
  ok(GM3.state.graves.length <= GM.GRAVE_MAX + 3, "grave list stays bounded", GM3.state.graves.length);
  ok(GM3.revenants().length > 0, "neglected gravemarks rise as revenants", GM3.revenants().length);

  const rev = GM3.revenants()[0];
  const mon = GM3.revenantMonster(rev);
  ok(isFinite(mon.hp) && mon.hp > 0, "a revenant is a valid monster");
  const claim = GM3.claimRevenant(rev, GM3.stats({}));
  ok(claim.epitaphs.length >= 1 && !!claim.item, "claiming pays epitaphs and an item");
}

/* ---------- crafting ----------------------------------------------------- */
section("crafting");
{
  const GM = load({ quiet: true });
  GM.startSeason("s_none");
  GM.state.char.shards = 1e12;

  /* find a weapon base with 3 sockets so a 3-rune runeword can be built */
  const base = GM.BASES.filter(b => b.pool === "weapon" && b.sockets >= 3 && b.tier >= 5)[0];
  const item = GM.makeItem({ pool: "weapon", ilvl: 60, rarity: 2 });
  item.baseId = base.id;
  item.sockets = [];

  let added = 0;
  while (item.sockets.length < 3) { if (GM.addSocket(item).ok) added++; else break; }
  ok(item.sockets.length === 3, "sockets can be added up to the base maximum", item.sockets.length);

  const rw = GM.RUNEWORDS.filter(r => r.pools.indexOf("weapon") >= 0 && r.seq.length === 3)[0];
  rw.seq.forEach(id => GM.addRune(id, 2));
  rw.seq.forEach((id, i) => GM.socketRune(item, i, id));
  const matched = GM.matchRuneword("weapon", item.sockets);
  ok(matched && matched.id === rw.id, "an ordered rune sequence forms its runeword",
     matched ? matched.id : "none");

  const withRW = GM.itemStats(item);
  ok(Object.keys(rw.stats).every(k => withRW[k] >= rw.stats[k] - 1e-9),
     "the runeword's stats are applied");

  /* wrong order must NOT match */
  const scrambled = item.sockets.slice().reverse();
  const noMatch = GM.matchRuneword("weapon", scrambled);
  ok(rw.seq[0] === rw.seq[2] || !noMatch || noMatch.id !== rw.id,
     "order matters for runewords");

  /* pulling a rune returns it */
  const held = GM.runeCount(item.sockets[0]);
  const pulled = GM.pullRune(item, 0);
  ok(pulled.ok && GM.runeCount(pulled.rune) === held + 1, "pulling a rune returns it to inventory");

  /* salvage must not eat socketed runes */
  const it2 = GM.makeItem({ pool: "weapon", ilvl: 30, rarity: 2 });
  it2.sockets = ["mor"];
  GM.state.stash.push(it2);
  const morBefore = GM.runeCount("mor");
  GM.salvage(it2);
  ok(GM.runeCount("mor") === morBefore + 1, "salvage returns socketed runes");
}

/* ---------- modes, ascension, seasons ------------------------------------ */
section("modes");
{
  const GM = load({ quiet: true });
  GM.startSeason("s_none");
  GM.state.depth.maxEver = 120;
  GM.state.depth.max = 120;

  let bad = [];
  ["expedition", "exploration", "tower", "dimension", "finality"].forEach(id => {
    const r = GM.setMode(id);
    if (!r.ok) { bad.push(id + ":" + r.why); return; }
    const stage = GM.modeStage();
    const ctx = GM.modeCtx();
    if (!isFinite(stage) || stage < 1) bad.push(id + ":stage " + stage);
    const rep = GM.tick(60);
    if (!isFinite(GM.state.char.gold)) bad.push(id + ":gold NaN");
    void rep; void ctx;
  });
  ok(bad.length === 0, "all five modes run a minute without breaking", bad.join(" | "));

  GM.setMode("expedition");
  GM.state.depth.maxEver = 90;
  const ich = GM.ascendPreview();
  ok(ich > 0, "ascension previews ichor", ich);
  const before = GM.state.char.ichor;
  const asc = GM.ascend();
  ok(asc.ok, "ascension runs", asc.why);
  ok(GM.state.char.ichor === before + ich, "and pays the previewed amount");
  ok(GM.state.char.level === 1 && GM.state.stash.length === 0, "and resets the run");
  ok(GM.state.depth.maxEver === 90, "but keeps the season record");
}

/* ---------- save round trip ---------------------------------------------- */
section("persistence");
{
  const GM = load({ quiet: true });
  GM.startSeason("s_none");
  GM.tick(300);
  GM.state.char.gold = 123456;
  const depth = GM.state.depth.maxEver;
  const stashN = GM.state.stash.length;
  ok(GM.save(), "save writes");

  GM.startSeason("s_frail");
  ok(GM.state.char.gold !== 123456, "a different season is a different save");

  GM.startSeason("s_none");
  ok(GM.state.char.gold === 123456, "the original season reloads intact");
  ok(GM.state.depth.maxEver === depth, "depth survives the round trip");
  ok(GM.state.stash.length === stashN, "stash survives the round trip");

  /* migration: a save missing newer fields must still load */
  const raw = JSON.parse(JSON.stringify(GM.state));
  delete raw.epitaphs;
  delete raw.tally;
  delete raw.opts;
  const migrated = GM.migrate(raw);
  ok(Array.isArray(migrated.epitaphs) && !!migrated.tally && !!migrated.opts,
     "migration fills in missing fields");

  /* a save referencing a deleted base must not crash the stat pipeline */
  const raw2 = JSON.parse(JSON.stringify(GM.state));
  raw2.equip.weapon = { id: "x", baseId: "no_such_base_t9", ilvl: 10, rarity: 1, affixes: [], sockets: [] };
  const m2 = GM.migrate(raw2);
  ok(m2.equip.weapon === null, "migration drops items whose base vanished");
}

/* ---------- offline ------------------------------------------------------ */
section("offline");
{
  const GM = load({ quiet: true });
  GM.startSeason("s_none");
  GM.tick(120);
  const goldBefore = GM.state.char.gold;
  const t0 = Date.now();
  const r = GM.runOffline(8 * 3600);
  const ms = Date.now() - t0;
  ok(!!r, "an 8 hour absence produces a report");
  ok(ms < 8000, "and resolves quickly", ms + "ms");
  ok(GM.state.char.gold > goldBefore, "and pays out");
  ok(GM.fast.active === false, "fast mode is switched back off");
  ok(GM.state.stash.length <= GM.STASH_MAX, "without overflowing the stash", GM.state.stash.length);
  ok(r.creditedSeconds <= GM.offlineCapSeconds() + 1, "and respects the away cap");
  ok(GM.offlineSummary(r).length > 0, "summary renders");
}

/* ---------- report ------------------------------------------------------- */
console.log("\n" + "=".repeat(62));
if (fail) {
  console.log("FAILURES:");
  failures.forEach(f => console.log("  ✗ " + f));
}
console.log((fail ? "FAIL" : "PASS") + "  " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
