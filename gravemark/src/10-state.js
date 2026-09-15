/* Gravemark — 10-state.js
   The save: schema, defaults, persistence, migration, and the activity log.

   One save slot per season, so a season is genuinely separate rather than a
   flag on a shared file. Everything is plain JSON — no class instances, no
   Maps — because the save has to survive JSON.stringify unchanged. */
"use strict";

GM.SAVE_VERSION = 2;
GM.SAVE_PREFIX = "gravemark.save.";
GM.SAVE_META_KEY = "gravemark.meta";
GM.AUTOSAVE_MS = 15000;

/* The live state. Modules capture this object at load, so it is mutated in
   place for the life of the page and never reassigned. */
GM.state = {};

GM.blankSave = function (seasonId) {
  var now = Date.now();
  return {
    v: GM.SAVE_VERSION,
    season: seasonId || "s_none",
    seed: (Math.random() * 0xffffffff) >>> 0,
    createdAt: now,
    lastSeen: now,

    /* The warband. `char` keeps only what the PLAYER owns rather than any one
       hero: currencies and the shared institution. Levels and gear moved onto
       the heroes themselves in save v2. */
    heroes: [],
    squads: [GM.blankSquad(0), GM.blankSquad(1), GM.blankSquad(2)],

    char: {
      level: 1,          /* warband level: the highest level on the roster */
      xp: 0,
      gold: 0,
      shards: 0,      /* crafting */
      ichor: 0,       /* ascension, persists across resets within a season */
      marks: 0,       /* Divine Tower currency */
      dust: 0         /* Alternate Dimension currency */
    },

    depth: {
      current: 1,     /* where the delve is right now */
      max: 1,         /* deepest cleared this ascension */
      maxEver: 1,     /* deepest cleared ever, this season */
      kills: 0,       /* kills banked toward clearing the current stage */
      towerFloor: 0,  /* highest Divine Tower floor cleared */
      finality: 0     /* highest Finality wave cleared */
    },

    mode: { id: "expedition", target: 1, dim: null },

    stash: [],
    runes: {},        /* runeId -> count */

    tree: { points: 0, spent: [] },
    town: {},         /* buildingId -> level */
    perks: {},        /* perkId -> level */

    /* --- the Gravemark systems --- */
    graves: [],       /* see 15-graves.js */
    epitaphs: [],     /* recovered, inscribable affixes */

    opts: {
      autoEquip: true,
      autoSalvage: true,
      salvageBelow: 2,   /* salvage anything under this rarity id */
      showLog: true
    },

    tally: {
      kills: 0, bosses: 0, deaths: 0, drops: 0, salvaged: 0,
      ascensions: 0, inscribed: 0, revenants: 0, playtime: 0, recruited: 0
    },

    /* The quest strip under the hub. */
    quest: { id: "explore", done: 0, need: 30 },

    log: []
  };
};

/* ---------- persistence -------------------------------------------------- */
GM.saveKey = function (seasonId) { return GM.SAVE_PREFIX + (seasonId || "s_none"); };

GM.storageOK = (function () {
  try {
    var k = "__gm_probe";
    window.localStorage.setItem(k, "1");
    window.localStorage.removeItem(k);
    return true;
  } catch (e) {
    return false;
  }
})();

GM.save = function () {
  if (!GM.storageOK) return false;
  var s = GM.state;
  if (!s || !s.season) return false;
  s.lastSeen = Date.now();
  try {
    window.localStorage.setItem(GM.saveKey(s.season), JSON.stringify(s));
    window.localStorage.setItem(GM.SAVE_META_KEY, JSON.stringify({ last: s.season }));
    return true;
  } catch (e) {
    /* Quota, private mode, or a corrupted stash. Say so once rather than
       silently dropping the player's progress. */
    console.error("[GM] save failed", e);
    GM.bus.emit("save:failed", e);
    return false;
  }
};

GM.loadRaw = function (seasonId) {
  if (!GM.storageOK) return null;
  try {
    var txt = window.localStorage.getItem(GM.saveKey(seasonId));
    return txt ? JSON.parse(txt) : null;
  } catch (e) {
    console.error("[GM] load failed for " + seasonId, e);
    return null;
  }
};

GM.lastSeason = function () {
  if (!GM.storageOK) return "s_none";
  try {
    var m = JSON.parse(window.localStorage.getItem(GM.SAVE_META_KEY) || "{}");
    return m.last || "s_none";
  } catch (e) { return "s_none"; }
};

/* Which seasons have a save on disk, for the season picker. */
GM.seasonSlots = function () {
  return GM.SEASONS.map(function (se) {
    var raw = GM.loadRaw(se.id);
    return {
      season: se,
      exists: !!raw,
      maxEver: raw && raw.depth ? raw.depth.maxEver : 0,
      level: raw && raw.char ? raw.char.level : 0,
      lastSeen: raw ? raw.lastSeen : 0
    };
  });
};

/* ---------- migration ----------------------------------------------------
   Fill in anything a newer version added, so an old save loads rather than
   being thrown away. Runs field-by-field against a blank, which means adding
   a key to blankSave() is the whole migration for most changes. */
GM.migrate = function (raw) {
  var blank = GM.blankSave(raw.season);

  function fill(dst, src) {
    for (var k in src) {
      if (!Object.prototype.hasOwnProperty.call(src, k)) continue;
      if (dst[k] === undefined) {
        dst[k] = src[k];
      } else if (src[k] && typeof src[k] === "object" && !Array.isArray(src[k]) &&
                 dst[k] && typeof dst[k] === "object" && !Array.isArray(dst[k])) {
        fill(dst[k], src[k]);
      }
    }
  }
  fill(raw, blank);

  /* v1 -> v2: the single character becomes hero one of the warband, keeping
     their level, experience and everything they were wearing. */
  if (!raw.heroes || !raw.heroes.length) {
    raw.heroes = [];
    var first = GM.makeHero({ classId: "reaver", rank: 2, name: "Yvain" });
    first.level = (raw.char && raw.char.level) || 1;
    first.xp = (raw.char && raw.char.xp) || 0;
    if (raw.equip) {
      GM.SLOT_IDS.forEach(function (slot) {
        var it = raw.equip[slot];
        if (it && GM.BASE_BY_ID[it.baseId]) first.equip[slot] = it;
      });
    }
    raw.heroes.push(first);
  }
  delete raw.equip;

  if (!raw.squads || raw.squads.length !== GM.SQUAD_COUNT) {
    raw.squads = [GM.blankSquad(0), GM.blankSquad(1), GM.blankSquad(2)];
  }
  /* The generic field-fill above has already copied blank squads in, so
     "raw.squads is missing" is never true on a v1 save. What actually
     identifies an unmigrated save is squads that exist but hold nobody while
     the roster is populated. */
  var anyAssigned = raw.squads.some(function (sq) {
    return (sq.members || []).length > 0;
  });
  if (!anyAssigned && raw.heroes.length) {
    if (raw.depth) {
      raw.squads[0].stage = raw.depth.current || 1;
      raw.squads[0].max = raw.depth.max || 1;
    }
    raw.squads[0].members = raw.heroes.slice(0, GM.SQUAD_SIZE)
      .map(function (h) { return h.id; });
  }

  /* Drop equipped or stashed items whose base no longer exists — a renamed
     base would otherwise crash every stat recalculation. */
  raw.heroes.forEach(function (h) {
    if (!h.equip) h.equip = {};
    GM.SLOT_IDS.forEach(function (slot) {
      if (h.equip[slot] && !GM.BASE_BY_ID[h.equip[slot].baseId]) h.equip[slot] = null;
      if (h.equip[slot] === undefined) h.equip[slot] = null;
    });
  });
  raw.stash = (raw.stash || []).filter(function (it) { return it && GM.BASE_BY_ID[it.baseId]; });

  /* A squad must never reference a hero who no longer exists. */
  var live = {};
  raw.heroes.forEach(function (h) { live[h.id] = true; });
  raw.squads.forEach(function (sq) {
    sq.members = (sq.members || []).filter(function (id) { return live[id]; });
    if (!sq.monsters) sq.monsters = [];
  });

  /* Same for allocated tree nodes and known runes. */
  raw.tree.spent = (raw.tree.spent || []).filter(function (id) { return !!GM.TREE_BY_ID[id]; });
  var cleanRunes = {};
  for (var rid in raw.runes) if (GM.RUNE_BY_ID[rid]) cleanRunes[rid] = raw.runes[rid];
  raw.runes = cleanRunes;

  raw.v = GM.SAVE_VERSION;
  return raw;
};

/* ---------- lifecycle ---------------------------------------------------- */
GM.startSeason = function (seasonId) {
  var raw = GM.loadRaw(seasonId);
  var fresh = !raw;
  var s = raw ? GM.migrate(raw) : GM.blankSave(seasonId);

  /* Replace the CONTENTS of GM.state, never the object itself. */
  for (var k in GM.state) delete GM.state[k];
  GM.assign(GM.state, s);

  /* Reseed the ambient RNG from the save so a reload continues the same
     stream rather than restarting from the clock. */
  GM.rng = GM.rngFrom(GM.state.seed);

  if (fresh) {
    GM.applySeasonStart();
    GM.foundWarband();
    if (GM.grantStartingKit) GM.grantStartingKit();
    GM.log("You arrive at " + GM.realmInfo(1).name + ". Someone has already been digging.", "flavour");
  }

  GM.bus.emit("season:started", { season: seasonId, fresh: fresh });
  return GM.state;
};

/* Season rules that apply once, at creation. */
GM.applySeasonStart = function () {
  var rule = GM.seasonRule();
  if (rule.startStage) {
    GM.state.depth.current = rule.startStage;
    GM.state.depth.max = rule.startStage;
    GM.state.depth.maxEver = rule.startStage;
  }
};

GM.seasonRule = function () {
  var se = GM.SEASON_BY_ID[GM.state.season];
  return (se && se.rule) || {};
};

GM.wipeSeason = function (seasonId) {
  if (!GM.storageOK) return;
  try { window.localStorage.removeItem(GM.saveKey(seasonId)); } catch (e) {}
};

/* ---------- activity log -------------------------------------------------
   A bounded ring buffer. Unbounded it would be the largest thing in the save
   inside a day of idling. */
GM.LOG_MAX = 140;

GM.log = function (text, kind) {
  if (!GM.state.log) GM.state.log = [];
  GM.state.log.push({ t: Date.now(), text: text, kind: kind || "info" });
  if (GM.state.log.length > GM.LOG_MAX) {
    GM.state.log.splice(0, GM.state.log.length - GM.LOG_MAX);
  }
  GM.bus.emit("log", { text: text, kind: kind || "info" });
};

/* A new season opens with three heroes — one per squad is too thin to read as
   a warband, and five is enough to hide how the squad maths works. Three lets
   the first squad fight immediately and leaves the other two visibly empty,
   which is the clearest possible hint that they are waiting for recruits. */
GM.foundWarband = function () {
  GM.state.heroes = [];
  var seed = [
    { classId: "warden", rank: 2, name: "Yvain" },
    { classId: "reaver", rank: 1, name: "Zephan" },
    { classId: "sexton", rank: 1, name: "Roland" }
  ];
  for (var i = 0; i < seed.length; i++) {
    GM.state.heroes.push(GM.makeHero(seed[i]));
  }
  GM.state.squads = [GM.blankSquad(0), GM.blankSquad(1), GM.blankSquad(2)];
  GM.autoAssign();
};

/* The warband's level is the best on the roster — what the header shows. */
GM.warbandLevel = function () {
  var best = 1;
  var hs = GM.state.heroes || [];
  for (var i = 0; i < hs.length; i++) if (hs[i].level > best) best = hs[i].level;
  return best;
};

/* ---------- small accessors used everywhere ------------------------------ */
GM.townLevel = function (id) { return GM.state.town[id] || 0; };
GM.perkLevel = function (id) { return GM.state.perks[id] || 0; };
GM.runeCount = function (id) { return GM.state.runes[id] || 0; };
GM.hasNode   = function (id) { return GM.state.tree.spent.indexOf(id) >= 0; };

GM.addRune = function (id, n) {
  GM.state.runes[id] = (GM.state.runes[id] || 0) + (n == null ? 1 : n);
  if (GM.state.runes[id] <= 0) delete GM.state.runes[id];
};

GM.spendGold = function (n) {
  if (GM.state.char.gold < n) return false;
  GM.state.char.gold -= n;
  return true;
};

GM.spendShards = function (n) {
  if (GM.state.char.shards < n) return false;
  GM.state.char.shards -= n;
  return true;
};

GM.spendIchor = function (n) {
  if (GM.state.char.ichor < n) return false;
  GM.state.char.ichor -= n;
  return true;
};
