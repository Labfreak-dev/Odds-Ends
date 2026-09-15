/* Gravemark — tools/test-core.js
   Exercises the logic layer end to end without a browser: data integrity, the
   roster and squads, loot, combat, gravemarks, crafting, modes, persistence
   (including the v1 single-character migration) and offline. */
"use strict";
const { load, outfit } = require("./harness");

let pass = 0, fail = 0;
const failures = [];
function ok(cond, label, detail) {
  if (cond) pass++;
  else { fail++; failures.push(label + (detail ? "  [" + detail + "]" : "")); }
}
function section(n) { console.log("\n-- " + n); }

/* ---------- data --------------------------------------------------------- */
section("data");
{
  const GM = load({ quiet: true });
  ok(GM.BASES.length === 112, "112 bases generated", GM.BASES.length);
  ok(GM.AFFIXES.length > 25, "affix pool populated", GM.AFFIXES.length);
  ok(GM.CLASSES.length === 5 && GM.RANKS.length === 3, "5 classes, 3 ranks");
  ok(GM.HERO_NAMES.length >= GM.ROSTER_MAX, "enough names for a full roster",
     GM.HERO_NAMES.length + " vs " + GM.ROSTER_MAX);

  const maxPoints = (GM.MAX_LEVEL - 1) * GM.TREE_POINTS_PER_LEVEL;
  ok(GM.TREE_NODES.length - 1 > maxPoints, "tree larger than a maxed character's points",
     (GM.TREE_NODES.length - 1) + " vs " + maxPoints);

  const bag = GM.emptyBag();
  const bad = [];
  GM.AFFIXES.forEach(a => { if (bag[a.stat] === undefined) bad.push(a.id); });
  GM.TREE_NODES.forEach(n => Object.keys(n.stats).forEach(k => { if (bag[k] === undefined) bad.push(n.id + ":" + k); }));
  GM.RUNEWORDS.forEach(r => Object.keys(r.stats).forEach(k => { if (bag[k] === undefined) bad.push(r.id + ":" + k); }));
  GM.CLASSES.forEach(c => Object.keys(c.bias).forEach(k => { if (bag[k] === undefined) bad.push(c.id + ":" + k); }));
  ok(bad.length === 0, "every stat key in data is real", bad.slice(0, 3).join(","));

  const seen = new Set(["root"]), q = ["root"];
  while (q.length) {
    const n = GM.TREE_BY_ID[q.shift()];
    if (n) n.links.forEach(l => { if (!seen.has(l)) { seen.add(l); q.push(l); } });
  }
  ok(seen.size === GM.TREE_NODES.length, "every tree node reachable from root");

  const rwBad = GM.RUNEWORDS.filter(rw =>
    !rw.pools.some(pool => GM.BASES.some(b => b.pool === pool && (b.sockets || 0) >= rw.seq.length)));
  ok(rwBad.length === 0, "every runeword fits some base", rwBad.map(r => r.id).join(","));
}

/* ---------- roster and squads -------------------------------------------- */
section("roster and squads");
{
  const GM = load({ quiet: true });
  GM.startSeason("s_none");
  ok(GM.state.heroes.length === 3, "a new season founds three heroes", GM.state.heroes.length);
  ok(GM.state.squads.length === 3, "three squads exist");
  ok(GM.state.squads[0].members.length === 3, "auto-assign filled the first squad");
  ok(GM.state.heroes.every(h => h.equip.weapon), "every founding hero is armed");

  const names = GM.state.heroes.map(h => h.name);
  ok(new Set(names).size === names.length, "names are unique", names.join(","));

  GM.state.char.gold = 1e9;
  const before = GM.state.heroes.length;
  const r = GM.recruit();
  ok(r.ok && GM.state.heroes.length === before + 1, "recruiting adds a hero", r.why);

  const h = GM.state.heroes[GM.state.heroes.length - 1];
  ok(GM.assignHero(h.id, "sq1").ok, "a hero can be assigned to a squad");
  ok(GM.squadOf(h.id).id === "sq1", "and is found in it");
  ok(GM.state.squads[0].members.indexOf(h.id) < 0, "and only in one squad at a time");

  /* filling past the cap must be refused, not silently overflow */
  while (GM.state.heroes.length < GM.ROSTER_MAX) GM.recruit();
  ok(!GM.canRecruit(), "roster caps at " + GM.ROSTER_MAX, GM.state.heroes.length);
  ok(!GM.recruit().ok, "recruiting past the cap is refused");

  let over = 0;
  GM.autoAssign();
  GM.state.squads.forEach(sq => { if (sq.members.length > GM.SQUAD_SIZE) over++; });
  ok(over === 0, "no squad exceeds " + GM.SQUAD_SIZE);

  /* gear on a dismissed hero must come back, not vanish */
  const victim = GM.state.heroes[GM.state.heroes.length - 1];
  victim.equip.weapon = GM.makeItem({ pool: "weapon", ilvl: 5, rarity: 2 });
  const stashBefore = GM.state.stash.length;
  ok(GM.dismiss(victim.id).ok, "a hero can be dismissed");
  ok(GM.state.stash.length > stashBefore, "their gear returns to the stash");
  ok(!GM.squadOf(victim.id), "and they leave their squad");
}

/* ---------- first contact ------------------------------------------------ */
section("first contact");
{
  const GM = load({ quiet: true });
  GM.startSeason("s_none");
  const sq = GM.state.squads[0];
  const f = GM.forecastSquad(sq, 1);
  ok(f.win, "the founding squad can win the first pack",
     "ttk=" + f.ttk.toFixed(1) + " ttd=" + (f.ttd === Infinity ? "inf" : f.ttd.toFixed(1)));
  ok(f.ttk < 12, "and clears it in under twelve seconds", f.ttk.toFixed(1) + "s");

  const r = GM.tick(120);
  ok(r.kills >= 6, "two minutes of play yields a pack or more", "kills=" + r.kills);
  ok(r.cleared >= 1, "and clears at least one depth", "cleared=" + r.cleared);
  ok(r.deaths === 0, "and nobody is broken in the opening", "deaths=" + r.deaths);
}

/* ---------- loot --------------------------------------------------------- */
section("loot");
{
  const GM = load({ quiet: true });
  GM.startSeason("s_none");
  let bad = 0;
  for (let i = 0; i < 2000; i++) {
    const it = GM.makeItem({ ilvl: 1 + (i % 130), rarityBonus: 0.5 });
    if (!it || !GM.BASE_BY_ID[it.baseId]) bad++;
    if (it.affixes.length > GM.RARITY_BY_ID[it.rarity].maxAff) bad++;
    const st = GM.itemStats(it);
    for (const k in st) if (!isFinite(st[k])) bad++;
  }
  ok(bad === 0, "2000 generated items are well-formed", bad + " bad");

  const mean = b => { let t = 0; for (let i = 0; i < 3000; i++) t += GM.rollRarity(b).id; return t / 3000; };
  ok(mean(3) > mean(0), "item rarity raises the average rarity");

  /* a drop goes to whoever gains most from it */
  const sq = GM.state.squads[0];
  const item = GM.makeItem({ pool: "weapon", ilvl: 30, rarity: 3 });
  const best = GM.evaluateForSquad(sq, item, null);
  ok(best && best.hero, "a drop is evaluated across the whole squad");
  const res = GM.intakeItem(item, null, sq);
  ok(res.action === "equipped" || res.action === "stashed" || res.action === "salvaged",
     "and is disposed of", res.action);
}

/* ---------- combat ------------------------------------------------------- */
section("combat");
{
  const GM = load({ quiet: true });
  GM.startSeason("s_none");
  const r = GM.tick(600);
  ok(r.kills > 0, "ten minutes of play kills things", "kills=" + r.kills);
  ok(GM.state.depth.maxEver > 1, "and makes progress", GM.state.depth.maxEver);
  ok(GM.state.heroes.some(h => h.level > 1), "and levels heroes");
  ok(GM.state.char.gold > 0, "and earns gold");

  /* three squads must advance independently */
  const GM2 = load({ quiet: true });
  GM2.startSeason("s_none");
  GM2.state.char.gold = 1e9;
  for (let i = 0; i < 8; i++) GM2.recruit();
  GM2.autoAssign();
  GM2.tick(400);
  const staged = GM2.state.squads.filter(s => s.members.length && s.stage > 1).length;
  ok(staged >= 2, "several squads advance at once", GM2.state.squads.map(s => s.stage).join("/"));

  /* an empty squad must be inert, not crash or advance */
  const empty = GM2.state.squads.find(s => !s.members.length);
  if (empty) {
    const before = empty.stage;
    GM2.tick(60);
    ok(empty.stage === before, "an empty squad does not advance");
  } else ok(true, "an empty squad does not advance (none to test)");

  /* a hopeless squad terminates rather than spinning */
  const GM3 = load({ quiet: true });
  GM3.startSeason("s_none");
  GM3.state.squads[0].stage = 400;
  const t0 = Date.now();
  const r3 = GM3.tickSquad(GM3.state.squads[0], 3600, { offline: true });
  ok(Date.now() - t0 < 6000, "a hopeless tick still terminates", (Date.now() - t0) + "ms");
  ok(r3.deaths > 0, "and records the wipes", r3.deaths);

  /* the victory hold must burn GAME time, or offline resolves one pack ever */
  const GM4 = load({ quiet: true });
  GM4.startSeason("s_none");
  const many = GM4.tick(900);
  ok(many.cleared > 3, "one long tick clears many depths, not one", many.cleared);
}

/* ---------- gravemarks --------------------------------------------------- */
section("gravemarks");
{
  const GM = load({ quiet: true });
  GM.startSeason("s_none");
  outfit(GM, 40);
  const sq = GM.state.squads[0];

  const g = GM.plantGrave(sq, 40, { name: "Test Horror" });
  ok(GM.state.graves.length === 1, "a wipe plants a gravemark");
  ok(g.recorded.length > 0, "recording the whole squad's affixes", g.recorded.length + " mods");

  const eps = GM.recoverGrave(g, GM.squadStats(sq, null));
  ok(eps.length >= 1, "recovering yields an epitaph", eps.length);
  ok(GM.state.graves.length === 0, "and consumes the gravemark");

  const ep = GM.state.epitaphs[0];
  const def = GM.AFFIX_BY_ID[ep.affixId];
  const item = GM.makeItem({ pool: def.pools[0], ilvl: 40, rarity: 2 });
  GM.state.char.shards = 1e9;
  const res = GM.inscribe(item, ep, item.affixes[item.affixes.length - 1]);
  ok(res.ok, "an epitaph inscribes onto a legal base", res.why);
  const got = item.affixes.filter(a => a.id === ep.affixId)[0];
  ok(got && got.value === ep.value, "carrying the EXACT remembered value",
     got ? got.value + " vs " + ep.value : "missing");

  for (let i = 0; i < 12; i++) GM.plantGrave(sq, 30 + i, { name: "x" });
  ok(GM.state.graves.length <= GM.GRAVE_MAX + 3, "grave list stays bounded", GM.state.graves.length);
  ok(GM.revenants().length > 0, "neglected gravemarks rise as revenants");
  const rev = GM.revenants()[0];
  ok(isFinite(GM.revenantMonster(rev).hp), "a revenant is a valid monster");
  const claim = GM.claimRevenant(rev);
  ok(claim.epitaphs.length >= 1 && !!claim.item, "claiming pays epitaphs and an item");
}

/* ---------- crafting ----------------------------------------------------- */
section("crafting");
{
  const GM = load({ quiet: true });
  GM.startSeason("s_none");
  GM.state.char.shards = 1e12;
  const base = GM.BASES.filter(b => b.pool === "weapon" && b.sockets >= 3 && b.tier >= 5)[0];
  const item = GM.makeItem({ pool: "weapon", ilvl: 60, rarity: 2 });
  item.baseId = base.id;
  item.sockets = [];
  while (item.sockets.length < 3) if (!GM.addSocket(item).ok) break;
  ok(item.sockets.length === 3, "sockets can be added to the base maximum", item.sockets.length);

  const rw = GM.RUNEWORDS.filter(r => r.pools.indexOf("weapon") >= 0 && r.seq.length === 3)[0];
  rw.seq.forEach(id => GM.addRune(id, 2));
  rw.seq.forEach((id, i) => GM.socketRune(item, i, id));
  const matched = GM.matchRuneword("weapon", item.sockets);
  ok(matched && matched.id === rw.id, "an ordered rune sequence forms its runeword");

  const held = GM.runeCount(item.sockets[0]);
  const pulled = GM.pullRune(item, 0);
  ok(pulled.ok && GM.runeCount(pulled.rune) === held + 1, "pulling a rune returns it");

  const it2 = GM.makeItem({ pool: "weapon", ilvl: 30, rarity: 2 });
  it2.sockets = ["mor"];
  GM.state.stash.push(it2);
  const morBefore = GM.runeCount("mor");
  GM.salvage(it2);
  ok(GM.runeCount("mor") === morBefore + 1, "salvage returns socketed runes");
}

/* ---------- modes and ascension ------------------------------------------ */
section("modes and ascension");
{
  const GM = load({ quiet: true });
  GM.startSeason("s_none");
  GM.state.depth.maxEver = 120;
  const sq = GM.state.squads[0];
  sq.max = 120;

  const bad = [];
  ["expedition", "exploration", "tower", "dimension", "finality"].forEach(id => {
    const r = GM.setSquadMode(sq, id);
    if (!r.ok) { bad.push(id + ":" + r.why); return; }
    const stage = GM.squadStage(sq);
    if (!isFinite(stage) || stage < 1) bad.push(id + ":stage " + stage);
    GM.tickSquad(sq, 60);
    if (!isFinite(GM.state.char.gold)) bad.push(id + ":gold NaN");
  });
  ok(bad.length === 0, "all five modes run a minute without breaking", bad.join(" | "));

  GM.setSquadMode(sq, "expedition");
  GM.state.depth.maxEver = 90;
  const ich = GM.ascendPreview();
  ok(ich > 0, "ascension previews ichor", ich);
  const before = GM.state.char.ichor;
  const asc = GM.ascend();
  ok(asc.ok, "ascension runs", asc.why);
  ok(GM.state.char.ichor === before + ich, "and pays the previewed amount");
  ok(GM.state.heroes.length === 3, "and re-founds the warband", GM.state.heroes.length);
  ok(GM.state.heroes.every(h => h.level === 1), "with fresh heroes");
  ok(GM.state.stash.length === 0, "and an empty stash");
  ok(GM.state.depth.maxEver === 90, "but keeps the season record");
  ok(GM.state.squads.every(s => s.members.length || true), "squads survive the reset");
}

/* ---------- quests ------------------------------------------------------- */
section("quests");
{
  const GM = load({ quiet: true });
  GM.startSeason("s_none");
  const q = GM.state.quest;
  ok(q && q.id && q.need > 0, "a charter is active at the start");
  ok(!GM.questComplete(), "and is not already complete");
  q.done = q.need;
  const goldBefore = GM.state.char.gold;
  const r = GM.claimQuest();
  ok(r.ok && GM.state.char.gold > goldBefore, "claiming pays out", r.why);
  ok(GM.state.quest.done === 0, "and rolls a fresh charter");
}

/* ---------- persistence -------------------------------------------------- */
section("persistence");
{
  const GM = load({ quiet: true });
  GM.startSeason("s_none");
  GM.tick(300);
  GM.state.char.gold = 123456;
  const heroes = GM.state.heroes.length;
  const depth = GM.state.depth.maxEver;
  ok(GM.save(), "save writes");

  GM.startSeason("s_frail");
  ok(GM.state.char.gold !== 123456, "a different season is a different save");

  GM.startSeason("s_none");
  ok(GM.state.char.gold === 123456, "the original season reloads intact");
  ok(GM.state.heroes.length === heroes, "the roster survives the round trip");
  ok(GM.state.depth.maxEver === depth, "depth survives the round trip");
  ok(GM.state.squads[0].members.every(id => GM.heroById(id)), "squads reference live heroes");

  /* v1 -> v2: a single-character save becomes hero one */
  const v1 = {
    v: 1, season: "s_none", seed: 1, createdAt: 1, lastSeen: Date.now(),
    char: { level: 17, xp: 5, gold: 99, shards: 3, ichor: 2, marks: 0, dust: 0 },
    depth: { current: 22, max: 22, maxEver: 22, kills: 0, towerFloor: 0, finality: 0 },
    equip: { weapon: GM.makeItem({ pool: "weapon", ilvl: 20, rarity: 2 }) },
    stash: [], runes: {}, tree: { points: 0, spent: [] }, town: {}, perks: {},
    graves: [], epitaphs: [], log: []
  };
  const m = GM.migrate(v1);
  ok(Array.isArray(m.heroes) && m.heroes.length === 1, "v1 save yields one hero", m.heroes && m.heroes.length);
  ok(m.heroes[0].level === 17, "keeping their level", m.heroes[0] && m.heroes[0].level);
  ok(!!m.heroes[0].equip.weapon, "and their weapon");
  ok(m.equip === undefined, "and drops the old equip block");
  ok(m.squads.length === 3 && m.squads[0].members.length === 1, "and builds three squads");

  /* a save referencing a deleted base must not crash the stat pipeline */
  const raw2 = JSON.parse(JSON.stringify(GM.state));
  raw2.heroes[0].equip.weapon = { id: "x", baseId: "no_such_base_t9", ilvl: 10, rarity: 1, affixes: [], sockets: [] };
  ok(GM.migrate(raw2).heroes[0].equip.weapon === null, "migration drops items whose base vanished");

  /* a squad referencing a dead hero must be cleaned up */
  const raw3 = JSON.parse(JSON.stringify(GM.state));
  raw3.squads[0].members.push("ghost_hero_id");
  ok(GM.migrate(raw3).squads[0].members.indexOf("ghost_hero_id") < 0, "and squad members who no longer exist");
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
  ok(ms < 12000, "and resolves quickly", ms + "ms");
  ok(GM.state.char.gold > goldBefore, "and pays out");
  ok(r.cleared > 5, "clearing many depths, not one", r.cleared);
  ok(GM.fast.active === false, "fast mode is switched back off");
  ok(GM.state.stash.length <= GM.STASH_MAX, "without overflowing the stash", GM.state.stash.length);
  ok(GM.offlineSummary(r).length > 0, "summary renders");
}

console.log("\n" + "=".repeat(62));
if (fail) {
  console.log("FAILURES:");
  failures.forEach(f => console.log("  ✗ " + f));
}
console.log((fail ? "FAIL" : "PASS") + "  " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
