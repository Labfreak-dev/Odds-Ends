/* Gravemark — 10-state.js
   The save: schema, defaults, persistence, migration, and the activity log.

   One save slot per season, so a season is genuinely separate rather than a
   flag on a shared file. Everything is plain JSON — no class instances, no
   Maps — because the save has to survive JSON.stringify unchanged. */
"use strict";

GM.SAVE_VERSION = 1;
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

    char: {
      level: 1,
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

    equip: {
      weapon: null, offhand: null, helm: null, body: null, gloves: null,
      boots: null, belt: null, amulet: null, ring1: null, ring2: null
    },
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
      ascensions: 0, inscribed: 0, revenants: 0, playtime: 0
    },

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

  /* Drop equipped or stashed items whose base no longer exists — a renamed
     base would otherwise crash every stat recalculation. */
  GM.SLOT_IDS.forEach(function (slot) {
    var it = raw.equip[slot];
    if (it && !GM.BASE_BY_ID[it.baseId]) raw.equip[slot] = null;
  });
  raw.stash = (raw.stash || []).filter(function (it) { return it && GM.BASE_BY_ID[it.baseId]; });

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
