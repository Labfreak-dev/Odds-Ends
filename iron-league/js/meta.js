/* Iron League — renown, market, relics, cups. No DOM. */
(function (root) {
  const IL = root.IL = root.IL || {};

  const RELICS = [
    { id: "band", name: "Iron Band", kind: "hp", blurb: "Fielded fighters have more health." },
    { id: "edge", name: "Keen Edge", kind: "crit", blurb: "Cuts land as criticals more often." },
    { id: "plate", name: "Warden Plate", kind: "shield", blurb: "Each fighter starts with a small shield." },
    { id: "sigil", name: "Quick Sigil", kind: "haste", blurb: "Casts and abilities come back sooner." },
    { id: "purse", name: "Purse Hook", kind: "bounty", blurb: "A downed rival pays a little gold." },
    { id: "thread", name: "Mender's Thread", kind: "regen", blurb: "Slow mending during the fight." },
    { id: "quill", name: "Piercing Quill", kind: "pierce", blurb: "Shots pass through one extra body." },
    { id: "wind", name: "Second Wind", kind: "wind", blurb: "Once, at a low ebb, they catch a breath." },
    { id: "banner", name: "Yard Banner", kind: "speed", blurb: "The squad moves a little faster." },
    { id: "glass", name: "Glass Charm", kind: "glass", blurb: "More damage. Less armor." },
    { id: "ring", name: "Cup Ring", kind: "renown", blurb: "Wins on the board pay extra renown." },
    { id: "clock", name: "Sand Clock", kind: "sand", blurb: "Abilities cool down faster." }
  ];

  const RELIC_BY = {};
  RELICS.forEach(function (r) { RELIC_BY[r.id] = r; });

  function relicById(id) { return RELIC_BY[id] || null; }

  function equippedRelics(save) {
    const ids = (save && save.equipped) || [];
    const out = [];
    for (let i = 0; i < ids.length; i++) {
      const r = relicById(ids[i]);
      if (r) out.push(r);
    }
    return out;
  }

  function sellValue(f) {
    const base = IL.hireCost(f.cls);
    const champ = f.champion ? 0.7 : 0.45;
    return Math.max(22, Math.round(base * champ + ((f.level || 1) - 1) * 8));
  }

  function rollMarket(rng, renown) {
    const open = IL.unlockedIds(renown);
    const all = Object.keys(IL.CLASSES);
    const n = 4 + Math.floor(rng() * 3);
    const board = [];
    for (let i = 0; i < n; i++) {
      const championRoll = rng() < 0.14;
      let fighter;
      let cost;
      if (championRoll) {
        const pool = IL.CHAMPIONS.filter(function (c) { return IL.classUnlocked(c.cls, renown); });
        const champ = pool.length ? IL.pick(rng, pool) : null;
        if (champ) {
          fighter = IL.randomFighter(rng, champ.cls);
          fighter.champion = true;
          fighter.name = champ.name;
          cost = Math.round(IL.hireCost(champ.cls) * 1.65);
        }
      }
      if (!fighter) {
        const cls = IL.pick(rng, open.length ? open : all);
        fighter = IL.randomFighter(rng, cls);
        cost = IL.hireCost(cls);
      }
      board.push({ fighter: fighter, cost: cost });
    }
    /* One locked preview, when anything is still locked, so the board teaches the gate. */
    const locked = all.filter(function (id) { return !IL.classUnlocked(id, renown); });
    if (locked.length && rng() < 0.85) {
      const cls = IL.pick(rng, locked);
      const fighter = IL.randomFighter(rng, cls);
      board.push({
        fighter: fighter,
        cost: IL.hireCost(cls),
        locked: true,
        need: IL.CLASSES[cls].renown || 0
      });
    }
    return board;
  }

  function grantXp(fighter, amount) {
    const prev = fighter.xp || 0;
    const next = prev + amount;
    const g = IL.growthFromXp(prev, next);
    fighter.xp = next;
    fighter.level = g.level;
    fighter.pendingPicks = (fighter.pendingPicks || 0) + g.picks;
    if (!fighter.boosts) fighter.boosts = { hp: 0, dmg: 0, spd: 0, def: 0 };
    return g.picks;
  }

  function applyBoost(fighter, key) {
    if (!fighter.boosts) fighter.boosts = { hp: 0, dmg: 0, spd: 0, def: 0 };
    if (!fighter.pendingPicks) return false;
    if (key !== "hp" && key !== "dmg" && key !== "spd" && key !== "def") return false;
    fighter.boosts[key] = (fighter.boosts[key] || 0) + 1;
    fighter.pendingPicks -= 1;
    if (!Array.isArray(fighter.perks)) fighter.perks = [];
    fighter.perks.push({ id: key, level: fighter.level || 1 });
    return true;
  }

  function freshClubFields(seed) {
    return {
      renown: 0,
      tokens: 1,
      relics: [],
      equipped: [],
      relicSeason: 0,
      cup: null,
      market: null,
      history: [],
      settings: { speed: 1, shake: true, sound: 80, music: 60 }
    };
  }

  function migrate(data) {
    if (!data || typeof data !== "object") return data;
    if (typeof data.renown !== "number") data.renown = 0;
    if (typeof data.tokens !== "number") data.tokens = 1;
    if (!Array.isArray(data.relics)) data.relics = [];
    if (!Array.isArray(data.equipped)) data.equipped = [];
    data.equipped = data.equipped.filter(function (id) { return data.relics.indexOf(id) >= 0; }).slice(0, 2);
    if (typeof data.relicSeason !== "number") data.relicSeason = 0;
    if (!data.cup) data.cup = null;
    if (!Array.isArray(data.history)) data.history = [];
    data.history = data.history.slice(0, 10);
    if (!data.settings || typeof data.settings !== "object") {
      data.settings = { speed: 1, shake: true, sound: 80, music: 60 };
    } else {
      if (data.settings.speed !== 1 && data.settings.speed !== 2 && data.settings.speed !== 3) data.settings.speed = 1;
      if (typeof data.settings.shake !== "boolean") data.settings.shake = true;
      if (typeof data.settings.sound !== "number") data.settings.sound = 80;
      if (typeof data.settings.music !== "number") data.settings.music = 60;
    }
    if (!data.achieved || typeof data.achieved !== "object") data.achieved = {};
    ["bouts", "flawless", "cupsWon", "cupsEntered", "trainsDone", "salvaged", "chaosWins", "hires", "tonicsUsed", "seasonTitles", "unbeaten", "ceremonyPaid"].forEach(function (key) {
      if (typeof data[key] !== "number") data[key] = 0;
    });
    if (typeof data.goldPeak !== "number") data.goldPeak = data.gold || 0;
    if (typeof data.crest !== "number" || data.crest < 1 || data.crest > 16) {
      data.crest = (IL.hashStr(data.clubName || "iron") % 16) + 1;
    }
    if (!Array.isArray(data.seenClasses)) {
      const seen = {};
      (data.roster || []).forEach(function (f) { if (f && f.cls) seen[f.cls] = true; });
      data.seenClasses = Object.keys(seen);
    }
    if (!Array.isArray(data.roster)) return data;
    data.roster.forEach(function (f) {
      if (!f.boosts) f.boosts = { hp: 0, dmg: 0, spd: 0, def: 0 };
      if (typeof f.pendingPicks !== "number") f.pendingPicks = 0;
      if (!f.personality) f.personality = "bold";
      if (!f.tactic) f.tactic = "strike";
      if (typeof f.champion !== "boolean") f.champion = false;
      if (typeof f.level !== "number") f.level = IL.xpLevel(f.xp || 0);
      if (typeof f.wins !== "number") f.wins = 0;
      if (typeof f.losses !== "number") f.losses = 0;
      if (typeof f.kos !== "number") f.kos = 0;
      if (!f.season || typeof f.season !== "object") f.season = { dealt: 0, taken: 0, heal: 0, kos: 0 };
      else {
        if (typeof f.season.dealt !== "number") f.season.dealt = 0;
        if (typeof f.season.taken !== "number") f.season.taken = 0;
        if (typeof f.season.heal !== "number") f.season.heal = 0;
        if (typeof f.season.kos !== "number") f.season.kos = 0;
      }
      if (!Array.isArray(f.perks)) f.perks = [];
    });
    normalizeLineup(data);
    adoptSheets(data);
    if (IL.normalizeGear) IL.normalizeGear(data);
    return data;
  }

  /* Captain, then level, then xp. Used only when a save has no lineup yet. */
  function legacyOrder(roster) {
    const cap = roster.filter(function (f) { return f.captain; })[0] || roster[0];
    const rest = roster.filter(function (f) { return f !== cap; }).slice().sort(function (a, b) {
      return ((b.level || 1) - (a.level || 1)) || ((b.xp || 0) - (a.xp || 0));
    });
    const ordered = [];
    if (cap) ordered.push(cap);
    for (let i = 0; i < rest.length; i++) ordered.push(rest[i]);
    return ordered;
  }

  function fielded(roster, lineup, n) {
    const byId = {};
    const list = roster || [];
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      if (f && f.id) byId[f.id] = f;
    }
    const out = [];
    const ids = lineup || [];
    const want = n > 0 ? n : 0;
    for (let i = 0; i < ids.length && out.length < want; i++) {
      const f = byId[ids[i]];
      if (f && out.indexOf(f) < 0) out.push(f);
    }
    return out;
  }

  function normalizeLineup(data) {
    const roster = data.roster || [];
    const known = {};
    for (let i = 0; i < roster.length; i++) {
      if (roster[i] && roster[i].id) known[roster[i].id] = true;
    }
    const cap = IL.PARTY_CAP || 3;
    if (!Array.isArray(data.lineup)) {
      data.lineup = legacyOrder(roster).slice(0, cap).map(function (f) { return f.id; });
      return;
    }
    const seen = {};
    const next = [];
    for (let i = 0; i < data.lineup.length && next.length < cap; i++) {
      const id = data.lineup[i];
      if (!known[id] || seen[id]) continue;
      seen[id] = true;
      next.push(id);
    }
    data.lineup = next;
  }

  /* Layered Heroes99 parts become one Time Fantasy sheet. The same old
     loadout always lands on the same sheet, so a reload does not reshuffle. */
  function adoptSheet(f) {
    if (!f || typeof f !== "object") return;
    if (!IL.CLASSES[f.cls]) f.cls = "warrior";
    const id = f.parts && f.parts.sheet;
    if (typeof id === "string" && IL.sheetKnown(id)) {
      f.parts = { sheet: id };
      return;
    }
    const pool = IL.looksFor(f.cls);
    const seed = IL.hashStr(String(f.id || "") + "|" + (f.parts ? JSON.stringify(f.parts) : ""));
    f.parts = { sheet: pool[seed % pool.length] };
  }

  function adoptSheets(data) {
    (data.roster || []).forEach(adoptSheet);
    (data.clubs || []).forEach(function (c) { (c.fighters || []).forEach(adoptSheet); });
    (data.market || []).forEach(function (row) { if (row && row.fighter) adoptSheet(row.fighter); });
    if (data.cup && data.cup.slots) {
      data.cup.slots.forEach(function (s) { (s.fighters || []).forEach(adoptSheet); });
    }
  }

  function unownedRelics(save, rng) {
    const have = {};
    (save.relics || []).forEach(function (id) { have[id] = true; });
    const left = RELICS.filter(function (r) { return !have[r.id]; });
    if (!left.length) return null;
    return IL.pick(rng, left);
  }

  function offerRelic(save, rng) {
    const relic = unownedRelics(save, rng);
    if (!relic) return null;
    save.relics.push(relic.id);
    return relic;
  }

  function makeRivalSide(rng, name, n) {
    const fighters = [];
    for (let i = 0; i < n; i++) {
      const fighter = IL.randomFighter(rng);
      if (IL.dressRival) IL.dressRival(fighter, rng);
      fighters.push(fighter);
    }
    return { id: "r" + Math.floor(rng() * 1e9).toString(36), name: name, you: false, fighters: fighters };
  }

  function startCup(save, rng) {
    const n = 2;
    const you = {
      id: "you",
      name: save.clubName,
      you: true,
      fighters: null
    };
    const pool = IL.CLUBS.filter(function (name) { return name !== save.clubName; });
    const rivals = [];
    while (rivals.length < 3 && pool.length) {
      const name = pool.splice(Math.floor(rng() * pool.length), 1)[0];
      rivals.push(makeRivalSide(rng, name, n));
    }
    const slots = [you].concat(rivals);
    return {
      size: n,
      round: 0,
      slots: slots,
      pairing: [[0, 1], [2, 3]],
      winners: [null, null],
      champion: null,
      claimed: false,
      tree: rivals.length >= 3 ? {
        semis: [
          { a: sideSnap(slots[0]), b: sideSnap(slots[1]), winner: null },
          { a: sideSnap(slots[2]), b: sideSnap(slots[3]), winner: null }
        ],
        final: { a: null, b: null, winner: null }
      } : null
    };
  }

  function sideSnap(side) {
    if (!side) return null;
    return { id: side.id, name: side.name, you: !!side.you };
  }

  function stampTree(cup, pairIndex, winnerId) {
    if (!cup || !cup.tree) return;
    if ((cup.round || 0) >= 1) {
      if (cup.tree.final) cup.tree.final.winner = winnerId;
      return;
    }
    if (cup.tree.semis && cup.tree.semis[pairIndex]) cup.tree.semis[pairIndex].winner = winnerId;
  }

  function cupOpponent(cup) {
    if (!cup || cup.champion) return null;
    const pairs = cup.pairing || [];
    for (let i = 0; i < pairs.length; i++) {
      const a = cup.slots[pairs[i][0]];
      const b = cup.slots[pairs[i][1]];
      if (!a || !b) continue;
      if (a.you) return { pair: i, foe: b, you: a };
      if (b.you) return { pair: i, foe: a, you: b };
    }
    return null;
  }

  /* Strength proxy so the other semi does not need a full pit. */
  function sideStr(side, roster) {
    const list = side.you ? roster : (side.fighters || []);
    let s = 0;
    const n = Math.max(1, list.length);
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      const kit = IL.CLASSES[f.cls] || IL.CLASSES.warrior;
      s += (kit.hp / 140) + (kit.atk / 18) + ((f.level || 1) - 1) * 0.15 + (f.champion ? 0.35 : 0);
      if (IL.gearBonus) {
        const g = IL.gearBonus(f);
        s += (g.hp || 0) / 140 + (g.atk || 0) / 18;
      }
    }
    return s / n;
  }

  function resolveOtherPairs(cup, roster, rng) {
    const pairs = cup.pairing || [];
    for (let i = 0; i < pairs.length; i++) {
      if (cup.winners[i]) continue;
      const a = cup.slots[pairs[i][0]];
      const b = cup.slots[pairs[i][1]];
      if (!a || !b) continue;
      if (a.you || b.you) continue;
      const sa = sideStr(a, roster);
      const sb = sideStr(b, roster);
      const p = Math.max(0.2, Math.min(0.8, 0.5 + (sa - sb) * 0.35));
      cup.winners[i] = rng() < p ? a.id : b.id;
      stampTree(cup, i, cup.winners[i]);
    }
  }

  function noteCupResult(cup, pairIndex, winnerId) {
    cup.winners[pairIndex] = winnerId;
    stampTree(cup, pairIndex, winnerId);
  }

  function cupRoundReady(cup) {
    const pairs = cup.pairing || [];
    for (let i = 0; i < pairs.length; i++) if (!cup.winners[i]) return false;
    return true;
  }

  function advanceCup(cup) {
    if (!cupRoundReady(cup)) return cup;
    if (cup.round >= 1) {
      cup.champion = cup.winners[0];
      return cup;
    }
    if (cup.tree) {
      const fa = (cup.slots || []).filter(function (s) { return s.id === cup.winners[0]; })[0];
      const fb = (cup.slots || []).filter(function (s) { return s.id === cup.winners[1]; })[0];
      cup.tree.final = { a: sideSnap(fa), b: sideSnap(fb), winner: cup.tree.final && cup.tree.final.winner };
    }
    const next = [];
    for (let i = 0; i < cup.winners.length; i++) {
      const id = cup.winners[i];
      for (let s = 0; s < cup.slots.length; s++) if (cup.slots[s].id === id) next.push(cup.slots[s]);
    }
    if (next.length < 2) {
      cup.champion = next.length ? next[0].id : null;
      return cup;
    }
    cup.slots = next;
    cup.pairing = [[0, 1]];
    cup.winners = [null];
    cup.round = 1;
    return cup;
  }

  function startChaos(save, rng) {
    const picked = fielded(save.roster, save.lineup, 1);
    const yours = picked[0] || (save.roster || [])[0];
    const pool = IL.CLUBS.filter(function (name) { return name !== save.clubName; });
    const a = makeRivalSide(rng, pool.length ? pool.splice(Math.floor(rng() * pool.length), 1)[0] : "North Wharf", 1);
    const b = makeRivalSide(rng, pool.length ? pool.splice(Math.floor(rng() * pool.length), 1)[0] : "Salt Stair", 1);
    return {
      size: 1,
      sides: [
        { name: save.clubName, fighters: [yours] },
        { name: a.name, fighters: a.fighters },
        { name: b.name, fighters: b.fighters }
      ]
    };
  }

  function rivalBump(season) {
    return Math.min(3, Math.max(0, (season || 1) - 1));
  }

  function seasonAwards(roster) {
    function best(key) {
      let top = null;
      (roster || []).forEach(function (f) {
        if (!f) return;
        const n = f.season && typeof f.season[key] === "number" ? f.season[key] : 0;
        if (!top || n > top.n) top = { fighter: f, n: n };
      });
      return top ? top.fighter : null;
    }
    return { mvp: best("dealt"), kos: best("kos"), wall: best("taken"), healer: best("heal") };
  }

  function seasonPurse(place) {
    if (place <= 0) return { gold: 80, renown: 12 };
    if (place === 1) return { gold: 48, renown: 7 };
    return { gold: 28, renown: 4 };
  }

  function youRow(data) {
    const clubs = (data && data.clubs) || [];
    for (let i = 0; i < clubs.length; i++) if (clubs[i] && clubs[i].you) return clubs[i];
    return null;
  }

  function sumOf(data, key) {
    let n = 0;
    (data.roster || []).forEach(function (f) { n += (f && f[key]) || 0; });
    return n;
  }

  function maxLevel(data) {
    let n = 0;
    (data.roster || []).forEach(function (f) { if (f && (f.level || 1) > n) n = f.level || 1; });
    return n;
  }

  function countRarity(data, rarity) {
    let n = 0;
    function see(item) { if (item && item.rarity === rarity) n++; }
    (data.items || []).forEach(see);
    (data.roster || []).forEach(function (f) {
      const g = (f && f.gear) || {};
      see(g.weapon);
      see(g.armor);
      see(g.trinket);
    });
    return n;
  }

  function kitted(data) {
    return (data.roster || []).some(function (f) {
      const g = f && f.gear;
      return !!(g && g.weapon && g.armor && g.trinket);
    });
  }

  const ACHIEVEMENTS = [
    { id: "first-bout", name: "First bell", blurb: "Finish a match.", gold: 10, icon: "bw_sword_01_steel",
      progress: function (d) { return { current: d.bouts || 0, goal: 1 }; } },
    { id: "first-win", name: "First win", blurb: "Win a match.", gold: 15, icon: "bw_sword_05_gold",
      progress: function (d) { const you = youRow(d); return { current: you ? you.w : 0, goal: 1 }; } },
    { id: "five-wins", name: "Five wins", blurb: "Win five matches.", gold: 25, icon: "bw_gold_coins",
      progress: function (d) { const you = youRow(d); return { current: you ? you.w : 0, goal: 5 }; } },
    { id: "flawless", name: "Flawless", blurb: "Win without your side taking a hit.", gold: 20, icon: "bw_old_shield",
      progress: function (d) { return { current: d.flawless || 0, goal: 1 }; } },
    { id: "ten-kos", name: "Ten KOs", blurb: "Land ten knockouts.", gold: 20, icon: "bw_dagger_01_steel",
      progress: function (d) { return { current: sumOf(d, "kos"), goal: 10 }; } },
    { id: "forty-kos", name: "Forty KOs", blurb: "Land forty knockouts.", gold: 35, icon: "bw_poison_dagger",
      progress: function (d) { return { current: sumOf(d, "kos"), goal: 40 }; } },
    { id: "legendary", name: "A legend", blurb: "Own a legendary piece.", gold: 30, icon: "bw_diamond",
      progress: function (d) { return { current: countRarity(d, "legendary"), goal: 1 }; } },
    { id: "epic-gear", name: "Epic steel", blurb: "Own an epic piece.", gold: 12, icon: "bw_fire_gem",
      progress: function (d) { return { current: countRarity(d, "epic"), goal: 1 }; } },
    { id: "cup-enter", name: "Cup entry", blurb: "Enter the cup.", gold: 8, icon: "bw_token_golden_medallion",
      progress: function (d) { return { current: d.cupsEntered || 0, goal: 1 }; } },
    { id: "cup-win", name: "Cup winner", blurb: "Win the cup.", gold: 40, renown: 6, icon: "bw_token_golden_medallion",
      progress: function (d) { return { current: d.cupsWon || 0, goal: 1 }; } },
    { id: "all-classes", name: "Every kit", blurb: "Hire every class.", gold: 40, renown: 8, icon: "bw_old_helm",
      progress: function (d) {
        const goal = IL.CLASSES ? Object.keys(IL.CLASSES).length : 15;
        return { current: (d.seenClasses || []).length, goal: goal };
      } },
    { id: "full-house", name: "Full house", blurb: "Fill the roster.", gold: 18, icon: "bw_gauntlet_01_red",
      progress: function (d) { return { current: (d.roster || []).length, goal: IL.ROSTER_CAP || 8 }; } },
    { id: "first-hire", name: "New blood", blurb: "Hire a fighter.", gold: 10, icon: "bw_green_gem",
      progress: function (d) { return { current: d.hires || 0, goal: 1 }; } },
    { id: "drilled", name: "First drill", blurb: "Train a benched fighter.", gold: 8, icon: "bw_gauntlet_05_gold",
      progress: function (d) { return { current: d.trainsDone || 0, goal: 1 }; } },
    { id: "kitted", name: "Fully dressed", blurb: "Fill weapon, armor, and trinket on one fighter.", gold: 15, icon: "bw_old_leather_armor",
      progress: function (d) { return { current: kitted(d) ? 1 : 0, goal: 1 }; } },
    { id: "scrapped", name: "Scrapped", blurb: "Salvage a piece.", gold: 8, icon: "bw_broken_shield",
      progress: function (d) { return { current: d.salvaged || 0, goal: 1 }; } },
    { id: "season-title", name: "Season title", blurb: "Finish a season in first.", gold: 25, renown: 4, icon: "bw_gem_ruby",
      progress: function (d) { return { current: d.seasonTitles || 0, goal: 1 }; } },
    { id: "third-season", name: "Third season", blurb: "Open a third season.", gold: 15, icon: "bw_staff_02_steel",
      progress: function (d) { return { current: d.season || 1, goal: 3 }; } },
    { id: "renown-40", name: "Known name", blurb: "Hold 40 renown.", gold: 12, icon: "bw_gem_ruby",
      progress: function (d) { return { current: d.renown || 0, goal: 40 }; } },
    { id: "chaos-win", name: "Pit king", blurb: "Win a chaos pit.", gold: 18, icon: "bw_flail_08_red",
      progress: function (d) { return { current: d.chaosWins || 0, goal: 1 }; } },
    { id: "level-6", name: "Level 6", blurb: "Raise a fighter to level 6.", gold: 16, icon: "bw_bow_07_gold",
      progress: function (d) { return { current: maxLevel(d), goal: 6 }; } },
    { id: "level-9", name: "Level 9", blurb: "Raise a fighter to level 9.", gold: 28, icon: "bw_bow_09_purple",
      progress: function (d) { return { current: maxLevel(d), goal: 9 }; } },
    { id: "sipped", name: "A sip", blurb: "Give a fighter a tonic.", gold: 8, icon: "cs_potion_01_green",
      progress: function (d) { return { current: d.tonicsUsed || 0, goal: 1 }; } },
    { id: "purse", name: "Heavy purse", blurb: "Hold 200 gold.", gold: 12, icon: "bw_gold_coins",
      progress: function (d) { return { current: d.goldPeak || 0, goal: 200 }; } },
    { id: "unbeaten", name: "Unbeaten", blurb: "Finish a season without a loss.", gold: 35, icon: "bw_old_shield",
      progress: function (d) { return { current: d.unbeaten || 0, goal: 1 }; } }
  ];

  function claimAchievements(data) {
    if (!data) return [];
    if (!data.achieved || typeof data.achieved !== "object") data.achieved = {};
    const fresh = [];
    for (let pass = 0; pass < 4; pass++) {
      if ((data.gold || 0) > (data.goldPeak || 0)) data.goldPeak = data.gold;
      let hit = false;
      for (let i = 0; i < ACHIEVEMENTS.length; i++) {
        const row = ACHIEVEMENTS[i];
        if (data.achieved[row.id]) continue;
        const prog = row.progress(data);
        if ((prog.current || 0) < prog.goal) continue;
        data.achieved[row.id] = true;
        data.gold = (data.gold || 0) + (row.gold || 0);
        data.renown = (data.renown || 0) + (row.renown || 0);
        fresh.push(row);
        hit = true;
      }
      if (!hit) break;
    }
    return fresh;
  }

  function achievementBoard(data) {
    return ACHIEVEMENTS.map(function (row) {
      const prog = row.progress(data || {});
      return {
        id: row.id,
        name: row.name,
        blurb: row.blurb,
        gold: row.gold || 0,
        renown: row.renown || 0,
        icon: row.icon,
        current: prog.current || 0,
        goal: prog.goal,
        done: !!(data && data.achieved && data.achieved[row.id])
      };
    });
  }

  IL.RELICS = RELICS;
  IL.relicById = relicById;
  IL.equippedRelics = equippedRelics;
  IL.sellValue = sellValue;
  IL.rollMarket = rollMarket;
  IL.grantXp = grantXp;
  IL.applyBoost = applyBoost;
  IL.freshClubFields = freshClubFields;
  IL.migrate = migrate;
  IL.fielded = fielded;
  IL.offerRelic = offerRelic;
  IL.startCup = startCup;
  IL.cupOpponent = cupOpponent;
  IL.resolveOtherPairs = resolveOtherPairs;
  IL.noteCupResult = noteCupResult;
  IL.advanceCup = advanceCup;
  IL.startChaos = startChaos;
  IL.sideStr = sideStr;
  IL.rivalBump = rivalBump;
  IL.seasonAwards = seasonAwards;
  IL.seasonPurse = seasonPurse;
  IL.ACHIEVEMENTS = ACHIEVEMENTS;
  IL.claimAchievements = claimAchievements;
  IL.achievementBoard = achievementBoard;
})(typeof window !== "undefined" ? window : globalThis);
