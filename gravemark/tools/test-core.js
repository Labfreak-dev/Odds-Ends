/* Gravemark — tools/test-core.js
   Exercises the logic layer end to end without a browser: data integrity, the
   roster and squads, rewards, combat, gravemarks, inscription and anointing,
   modes, persistence (including the v1 and v2 migrations) and offline. */
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
  ok(GM.AFFIXES.length > 25, "epitaph pool populated", GM.AFFIXES.length);
  ok(GM.CLASSES.length === 5 && GM.RANKS.length === 3, "5 classes, 3 ranks");
  ok(GM.CLASSES.every(c => c.weapon && c.kit && GM.Rig.attackFor("hero", c.weapon.fam) === "attack_" + c.weapon.fam),
     "every class has a weapon with its own swing");
  ok(GM.HERO_NAMES.length >= GM.ROSTER_MAX, "enough names for a full roster",
     GM.HERO_NAMES.length + " vs " + GM.ROSTER_MAX);

  const maxPoints = (GM.MAX_LEVEL - 1) * GM.TREE_POINTS_PER_LEVEL;
  ok(GM.TREE_NODES.length - 1 > maxPoints, "tree larger than a maxed character's points",
     (GM.TREE_NODES.length - 1) + " vs " + maxPoints);

  const bag = GM.emptyBag();
  const bad = [];
  GM.AFFIXES.forEach(a => { if (bag[a.stat] === undefined) bad.push(a.id); });
  GM.AFFIXES.forEach(a => a.classes.forEach(c => { if (!GM.CLASS_BY_ID[c]) bad.push(a.id + ":" + c); }));
  GM.TREE_NODES.forEach(n => Object.keys(n.stats).forEach(k => { if (bag[k] === undefined) bad.push(n.id + ":" + k); }));
  GM.BUILDINGS.forEach(b => Object.keys(b.per).forEach(k => { if (bag[k] === undefined) bad.push(b.id + ":" + k); }));
  GM.PERKS.forEach(p => Object.keys(p.per).forEach(k => { if (bag[k] === undefined) bad.push(p.id + ":" + k); }));
  GM.CLASSES.forEach(c => Object.keys(c.bias).forEach(k => { if (bag[k] === undefined) bad.push(c.id + ":" + k); }));
  ok(bad.length === 0, "every stat key in data is real", bad.slice(0, 3).join(","));

  GM.CLASSES.forEach(c => {
    const n = GM.AFFIXES.filter(a => a.classes.indexOf(c.id) >= 0).length;
    if (n < 8) bad.push(c.id + " learns only " + n);
  });
  ok(bad.length === 0, "every class can learn a decent spread of names", bad.join(","));

  const seen = new Set(["root"]), q = ["root"];
  while (q.length) {
    const n = GM.TREE_BY_ID[q.shift()];
    if (n) n.links.forEach(l => { if (!seen.has(l)) { seen.add(l); q.push(l); } });
  }
  ok(seen.size === GM.TREE_NODES.length, "every tree node reachable from root");
  ok(!GM.BASES && !GM.RUNES && !GM.SLOT_IDS, "no item vocabulary survives");
}

/* ---------- roster and squads -------------------------------------------- */
section("roster and squads");
{
  const GM = load({ quiet: true });
  GM.startSeason("s_none");
  ok(GM.state.heroes.length === 3, "a new season founds three heroes", GM.state.heroes.length);
  ok(GM.state.squads.length === 3, "three squads exist");
  ok(GM.state.squads[0].members.length === 3, "auto-assign filled the first squad");
  ok(GM.state.heroes.every(h => h.equip === undefined && Array.isArray(h.traits)), "heroes carry traits, not gear");

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

  while (GM.state.heroes.length < GM.ROSTER_MAX) GM.recruit();
  ok(!GM.canRecruit(), "roster caps at " + GM.ROSTER_MAX, GM.state.heroes.length);
  ok(!GM.recruit().ok, "recruiting past the cap is refused");

  let over = 0;
  GM.autoAssign();
  GM.state.squads.forEach(sq => { if (sq.members.length > GM.SQUAD_SIZE) over++; });
  ok(over === 0, "no squad exceeds " + GM.SQUAD_SIZE);

  const victim = GM.state.heroes[GM.state.heroes.length - 1];
  ok(GM.dismiss(victim.id).ok, "a hero can be dismissed");
  ok(!GM.heroById(victim.id) && !GM.squadOf(victim.id), "and is gone from roster and squad");

  /* the kit is the class: same class, same level, same rank => same numbers */
  const a = GM.makeHero({ classId: "reaver", rank: 1 }), b = GM.makeHero({ classId: "reaver", rank: 1 });
  a.level = b.level = 20;
  ok(GM.derive(GM.collect(a, {})).dps === GM.derive(GM.collect(b, {})).dps, "two heroes of one class and level are identical");
  const w = GM.makeHero({ classId: "warden", rank: 1 }); w.level = 20;
  ok(GM.derive(GM.collect(w, {})).life > GM.derive(GM.collect(a, {})).life, "a warden out-lives a reaver");
  ok(GM.derive(GM.collect(a, {})).dps > GM.derive(GM.collect(w, {})).dps, "and a reaver out-hits a warden");
  a.level = 40;
  ok(GM.derive(GM.collect(a, {})).dps > GM.derive(GM.collect(b, {})).dps * 3, "twenty levels is a real step up");
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

/* ---------- rewards ------------------------------------------------------ */
section("rewards");
{
  const GM = load({ quiet: true });
  GM.startSeason("s_none");
  const st = GM.squadStats(GM.state.squads[0], null);
  let gold = 0, shards = 0;
  for (let i = 0; i < 2000; i++) { const r = GM.rollRewards(20, st, {}); gold += r.gold; shards += r.shards; }
  ok(gold > 0 && shards > 0, "kills pay gold and a trickle of shards", gold + "/" + shards);
  let more = 0;
  for (let i = 0; i < 2000; i++) more += GM.rollRewards(20, Object.assign({}, st, { findShards: 2 }), {}).shards;
  ok(more > shards * 1.8, "shards found raises the trickle", more + " vs " + shards);
  ok(GM.rollRewards(60, st, {}).gold > GM.rollRewards(10, st, {}).gold, "deeper pays more gold");
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

  const GM2 = load({ quiet: true });
  GM2.startSeason("s_none");
  GM2.state.char.gold = 1e9;
  for (let i = 0; i < 8; i++) GM2.recruit();
  GM2.autoAssign();
  GM2.tick(400);
  const staged = GM2.state.squads.filter(s => s.members.length && s.stage > 1).length;
  ok(staged >= 2, "several squads advance at once", GM2.state.squads.map(s => s.stage).join("/"));

  const empty = GM2.state.squads.find(s => !s.members.length);
  if (empty) {
    const before = empty.stage;
    GM2.tick(60);
    ok(empty.stage === before, "an empty squad does not advance");
  } else ok(true, "an empty squad does not advance (none to test)");

  const GM3 = load({ quiet: true });
  GM3.startSeason("s_none");
  GM3.state.squads[0].stage = 400;
  const t0 = Date.now();
  const r3 = GM3.tickSquad(GM3.state.squads[0], 3600, { offline: true });
  ok(Date.now() - t0 < 6000, "a hopeless tick still terminates", (Date.now() - t0) + "ms");
  ok(r3.deaths > 0, "and records the wipes", r3.deaths);

  const GM4 = load({ quiet: true });
  GM4.startSeason("s_none");
  const many = GM4.tick(900);
  ok(many.cleared > 3, "one long tick clears many depths, not one", many.cleared);

  /* the squad's damage against an unresisting target IS the sum of its dps */
  const GM5 = load({ quiet: true });
  GM5.startSeason("s_none");
  const sq5 = GM5.state.squads[0], st5 = GM5.squadStats(sq5, null);
  const naked = { res: {}, armour: 0, dmg: 1, acc: 1, elem: "phys", hp: 1 };
  ok(Math.abs(GM5.dpsAgainst(st5, naked) - st5.dps) < 1e-6, "squad dps against nothing equals the members' dps",
     GM5.dpsAgainst(st5, naked).toFixed(2) + " vs " + st5.dps.toFixed(2));
}

/* ---------- gravemarks --------------------------------------------------- */
section("gravemarks");
{
  const GM = load({ quiet: true });
  GM.startSeason("s_none");
  outfit(GM, 40);
  const sq = GM.state.squads[0];

  const g = GM.plantGrave(sq, 40, { name: "Test Horror", kind: "normal" });
  ok(GM.state.graves.length === 1, "a wipe plants a gravemark");
  ok(g.recorded.length === sq.members.length, "a green squad still learns one thing each", g.recorded.length);
  ok(g.recorded.every(r => GM.AFFIX_BY_ID[r.affixId].classes.indexOf(GM.heroById(sq.members.find(id => GM.heroById(id).name === r.who)).classId) >= 0),
     "and each lesson suits the class that learned it");
  const gb = GM.plantGrave(sq, 40, { name: "Boss", kind: "boss" });
  ok(gb.recorded.length === sq.members.length * 2, "a boss teaches twice", gb.recorded.length);

  const eps = GM.recoverGrave(g, GM.squadStats(sq, null));
  ok(eps.length >= 1, "recovering yields an epitaph", eps.length);
  ok(GM.state.graves.length === 1, "and consumes the gravemark");

  const ep = GM.state.epitaphs[0];
  const cands = GM.inscribeCandidates(ep);
  ok(cands.length >= 1, "someone on the roster can learn it");
  const hero = cands[0].hero;
  GM.state.char.shards = 1e9;
  const res = GM.inscribe(hero, ep);
  ok(res.ok, "an epitaph inscribes onto a hero", res.why);
  const got = hero.traits.filter(t => t.affixId === ep.affixId)[0];
  ok(got && got.value === ep.value, "carrying the EXACT remembered value",
     got ? got.value + " vs " + ep.value : "missing");
  ok(GM.state.epitaphs.indexOf(ep) < 0, "and the epitaph is spent");

  for (let i = 0; i < 12; i++) GM.plantGrave(sq, 30 + i, { name: "x" });
  ok(GM.state.graves.length <= GM.GRAVE_MAX + 3, "grave list stays bounded", GM.state.graves.length);
  ok(GM.revenants().length > 0, "neglected gravemarks rise as revenants");
  const rev = GM.revenants()[0];
  ok(isFinite(GM.revenantMonster(rev).hp), "a revenant is a valid monster");
  const shardsBefore = GM.state.char.shards;
  const claim = GM.claimRevenant(rev);
  ok(claim.epitaphs.length >= 1 && GM.state.char.shards > shardsBefore, "claiming pays epitaphs and shards");
}

/* ---------- inscription and anointing ------------------------------------ */
section("inscription and anointing");
{
  const GM = load({ quiet: true });
  GM.startSeason("s_none");
  GM.state.char.shards = 1e9;
  const pyre = GM.makeHero({ classId: "pyre", rank: 1 });
  const reaver = GM.makeHero({ classId: "reaver", rank: 1 });
  GM.state.heroes.push(pyre, reaver);

  const rec = (id, tier, value) => GM.makeEpitaph({ affixId: id, stat: GM.AFFIX_BY_ID[id].stat, tier, displayTier: 1, value, pct: GM.AFFIX_BY_ID[id].pct }, { stage: 30 });
  const heavy = rec("p_phys", 3, 40);
  ok(!GM.canInscribe(pyre, heavy).ok, "a pyre cannot learn Heavy");
  ok(GM.inscribe(reaver, heavy).ok, "a reaver can");

  const heavier = rec("p_phys", 5, 120);
  const c = GM.canInscribe(reaver, heavier);
  ok(c.ok && c.replaces && c.replaces.affixId === "p_phys", "a same-group name replaces rather than stacks");
  GM.inscribe(reaver, heavier);
  ok(reaver.traits.length === 1 && reaver.traits[0].value === 120, "and the stronger roll is what remains");

  GM.inscribe(reaver, rec("s_as", 2, 0.07));
  const full = GM.canInscribe(reaver, rec("p_life", 2, 30));
  ok(full.ok && full.needsVictim, "a full rank I hero needs a victim", JSON.stringify(full));
  ok(!GM.inscribe(reaver, GM.state.epitaphs[GM.state.epitaphs.length - 1]).ok, "and refuses without one");

  const dpsBefore = GM.heroStats(reaver, null).dps;
  const cost = GM.anointCost(reaver);
  const a = GM.anoint(reaver.id);
  ok(a.ok && a.cost === cost && reaver.rank === 2, "anointing raises the rank for its quoted cost", a.why);
  ok(GM.heroStats(reaver, null).dps > dpsBefore, "and the hero is stronger for it");
  ok(GM.heroTraitCap(reaver) === 3, "with room for another name");
  GM.anoint(reaver.id);
  ok(!GM.anoint(reaver.id).ok, "there is nothing above Vigil");
  GM.state.char.shards = 0;
  ok(!GM.anoint(pyre.id).ok, "anointing is refused without shards");
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
  GM.state.epitaphs.push(GM.makeEpitaph({ affixId: "p_life", stat: "flatLife", tier: 2, value: 20 }, { stage: 10 }));
  const held = GM.state.epitaphs.length;
  const asc = GM.ascend();
  ok(asc.ok, "ascension runs", asc.why);
  ok(GM.state.char.ichor === before + ich, "and pays the previewed amount");
  ok(GM.state.heroes.length === 3, "and re-founds the warband", GM.state.heroes.length);
  ok(GM.state.heroes.every(h => h.level === 1 && !h.traits.length), "with fresh heroes");
  ok(GM.state.epitaphs.length === held, "but keeps the epitaphs");
  ok(GM.state.depth.maxEver === 90, "and the season record");
}

/* ---------- the rig ------------------------------------------------------ */
section("rig");
{
  const GM = load({ quiet: true });
  GM.startSeason("s_none");

  let missing = [];
  Object.keys(GM.Rig.templates).forEach(rid => {
    const rig = GM.Rig.templates[rid];
    rig.bones.forEach(b => { if (b.part && !GM.Rig.PARTS[rid][b.part]) missing.push(rid + ":" + b.part); });
  });
  ok(missing.length === 0, "every rigged part has a painting spec", missing.join(","));

  const hero = GM.Rig.forChar("hero");
  const rest = GM.Rig.pose(hero, "idle", 0);
  const torso = rest.find(x => x.bone.id === "torso");
  ok(Math.abs(torso.angle - (-90)) < 0.01, "bind pose reproduces authored world angles", torso.angle);

  const p0 = GM.Rig.pose(hero, "attack_sword", 0);
  const p1 = GM.Rig.pose(hero, "attack_sword", 0.32);
  const f0 = p0.find(x => x.bone.id === "farm_f"), f1 = p1.find(x => x.bone.id === "farm_f");
  ok(Math.hypot(f1.x - f0.x, f1.y - f0.y) > 10, "child bones follow their parents", Math.hypot(f1.x - f0.x, f1.y - f0.y).toFixed(1));

  const strike = GM.Rig.pose(hero, "attack_sword", 0.5);
  ok(strike.root.x > p0.root.x + 20, "the sword strike lunges forward", (strike.root.x - p0.root.x).toFixed(0));
  const t0 = GM.Rig.tip(p0, "weapon"), t1 = GM.Rig.tip(strike, "weapon");
  ok(Math.hypot(t1.x - t0.x, t1.y - t0.y) > 60, "the weapon tip travels on the strike", Math.hypot(t1.x - t0.x, t1.y - t0.y).toFixed(0));

  const bad = Object.keys(GM.Rig.anims).filter(n => /^attack/.test(n))
    .filter(n => GM.Rig.anims[n].ev.filter(e => e.name === "hit").length !== 1);
  ok(bad.length === 0, "every attack clip fires exactly one hit", bad.join(","));

  const fired = [];
  const A = new GM.Rig.Animator("hero", { onEvent: n => fired.push(n) });
  A.play("attack_maul");
  for (let i = 0; i < 40; i++) A.update(1 / 30);
  ok(fired.filter(n => n === "hit").length === 1, "a swing fires hit exactly once", fired.join(","));
  ok(A.clip === "idle", "and returns to idle", A.clip);
  A.play("death");
  for (let i = 0; i < 60; i++) A.update(1 / 30);
  ok(A.dead && A.done && A.clip === "death", "death holds its final frame");
  A.play("attack_sword");
  ok(A.clip === "death", "a dead actor cannot be told to attack");

  ok(GM.Rig.forChar("gravedog").id === "quadruped", "the grave dog is a quadruped");
  ok(GM.Rig.forChar("bonepile").id === "blob", "the bone pile is a mass");
  ok(GM.Rig.attackFor("hero", "wand") === "attack_wand", "the hero's wand casts");
  ok(GM.Rig.attackFor("gravedog") === "attack_bite", "the dog bites");
  ok(GM.Rig.attackFor("shambler") === "attack_claw", "a humanoid monster claws");
  ok(GM.Rig.CHARS.some(c => c.id === "hero") && GM.CLASSES.every(c => GM.Rig.CHARS.some(r => r.id === c.id)),
     "a shared hero parts set plus one per class");
  ok(GM.heroPartsId(GM.state.heroes[0]) === "hero", "a class with no parts of its own wears the shared set");

  let nan = 0;
  Object.keys(GM.Rig.anims).forEach(n => {
    for (let t = 0; t <= 1.0001; t += 0.125) {
      GM.Rig.pose(hero, n, t).forEach(b => { if (![b.x, b.y, b.angle, b.sx, b.sy].every(isFinite)) nan++; });
    }
  });
  ok(nan === 0, "every clip poses finitely at every time", nan);

  const S = new GM.Rig.Animator("hero");
  S.play("attack_maul"); S.t = 0.58;
  const m = S.spriteMotion();
  ok(m.x > 10 && m.sx > 1 && m.sy < 1, "sprite mode gets lunge and squash from the root", JSON.stringify(m));
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
  ok(GM.QUESTS.every(x => ["explore", "slay", "boss", "shard", "level", "grave"].indexOf(x.id) >= 0), "no charter asks for items");
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

  /* v1 -> v3: a single-character save becomes hero one */
  const v1 = {
    v: 1, season: "s_none", seed: 1, createdAt: 1, lastSeen: Date.now(),
    char: { level: 17, xp: 5, gold: 99, shards: 3, ichor: 2, marks: 0, dust: 0 },
    depth: { current: 22, max: 22, maxEver: 22, kills: 0, towerFloor: 0, finality: 0 },
    equip: { weapon: { id: "it1", baseId: "sword_t2", ilvl: 20, rarity: 2, affixes: [], sockets: [] } },
    stash: [], runes: {}, tree: { points: 0, spent: [] }, town: {}, perks: {},
    graves: [], epitaphs: [], log: []
  };
  const m = GM.migrate(v1);
  ok(Array.isArray(m.heroes) && m.heroes.length === 1, "v1 save yields one hero", m.heroes && m.heroes.length);
  ok(m.heroes[0].level === 17, "keeping their level", m.heroes[0] && m.heroes[0].level);
  ok(m.equip === undefined && m.stash === undefined && m.runes === undefined, "and drops the item blocks");
  ok(m.squads.length === 3 && m.squads[0].members.length === 1, "and builds three squads");
  ok(m.v === GM.SAVE_VERSION, "stamped with the current version");

  /* v2 -> v3: geared heroes lose the gear, keep everything else */
  const raw2 = JSON.parse(JSON.stringify(GM.state));
  raw2.v = 2;
  raw2.heroes[0].equip = { weapon: { id: "x", baseId: "sword_t3", ilvl: 10 } };
  delete raw2.heroes[0].traits;
  raw2.stash = [{ id: "y" }]; raw2.runes = { mor: 3 };
  raw2.opts.autoEquip = true;
  raw2.epitaphs = [{ id: "e1", affixId: "p_life", stat: "flatLife", tier: 2, value: 20 },
                   { id: "e2", affixId: "no_such_affix", stat: "flatLife", tier: 2, value: 20 }];
  const m2 = GM.migrate(raw2);
  ok(m2.heroes[0].equip === undefined && Array.isArray(m2.heroes[0].traits), "a v2 hero sheds gear and gains a traits list");
  ok(m2.stash === undefined && m2.runes === undefined && m2.opts.autoEquip === undefined, "the stash, runes and auto-equip are gone");
  ok(m2.epitaphs.length === 1 && m2.epitaphs[0].id === "e1", "epitaphs survive, unknown names are dropped");

  /* a squad referencing a dead hero must be cleaned up */
  const raw3 = JSON.parse(JSON.stringify(GM.state));
  raw3.squads[0].members.push("ghost_hero_id");
  ok(GM.migrate(raw3).squads[0].members.indexOf("ghost_hero_id") < 0, "and squad members who no longer exist");

  /* a trait whose epitaph vanished must not poison the stat pipeline */
  const raw4 = JSON.parse(JSON.stringify(GM.state));
  raw4.heroes[0].traits = [{ affixId: "gone", stat: "flatLife", tier: 1, value: 5 }];
  ok(GM.migrate(raw4).heroes[0].traits.length === 0, "migration drops traits whose name vanished");
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
  ok(GM.offlineSummary(r).length > 0, "summary renders");
}

console.log("\n" + "=".repeat(62));
if (fail) {
  console.log("FAILURES:");
  failures.forEach(f => console.log("  ✗ " + f));
}
console.log((fail ? "FAIL" : "PASS") + "  " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
