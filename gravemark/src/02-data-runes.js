/* Gravemark — 02-data-runes.js
   Runes, and the ordered sequences that turn a socketed base into a runeword.

   A rune gives DIFFERENT stats in a weapon than in armour, which is the whole
   reason a rune hoard is interesting: the same Vael is a damage rune in a
   sword and a resistance rune in a shield, so every drop has two homes. */
"use strict";

/* Sixteen runes, ascending. `ilvl` is the earliest depth one drops at; the
   drop weight falls off sharply with tier so high runes stay the trophy. */
var R = [
  { id: "mor",   name: "Mor",   tier: 1,  ilvl: 1,   wep: { flatPhys: 3 },        arm: { flatLife: 16 } },
  { id: "ith",   name: "Ith",   tier: 2,  ilvl: 6,   wep: { incAS: 0.05 },        arm: { flatEvasion: 22 } },
  { id: "kesh",  name: "Kesh",  tier: 3,  ilvl: 12,  wep: { flatFire: 5 },        arm: { resFire: 0.09 } },
  { id: "dol",   name: "Dol",   tier: 4,  ilvl: 18,  wep: { flatCold: 5 },        arm: { resCold: 0.09 } },
  { id: "var",   name: "Var",   tier: 5,  ilvl: 24,  wep: { flatLit: 5 },         arm: { resLit: 0.09 } },
  { id: "sesh",  name: "Sesh",  tier: 6,  ilvl: 30,  wep: { critChance: 0.03 },   arm: { flatArmour: 48 } },
  { id: "rhen",  name: "Rhen",  tier: 7,  ilvl: 36,  wep: { incDmg: 0.10 },       arm: { incLife: 0.06 } },
  { id: "ebb",   name: "Ebb",   tier: 8,  ilvl: 42,  wep: { leechPct: 0.006 },    arm: { regenFlat: 22 } },
  { id: "tor",   name: "Tor",   tier: 9,  ilvl: 48,  wep: { critMulti: 0.14 },    arm: { resAll: 0.05 } },
  { id: "nara",  name: "Nara",  tier: 10, ilvl: 54,  wep: { flatVoid: 12 },       arm: { resVoid: 0.12 } },
  { id: "quell", name: "Quell", tier: 11, ilvl: 60,  wep: { pen: 0.05 },          arm: { incArmour: 0.18 } },
  { id: "sarn",  name: "Sarn",  tier: 12, ilvl: 66,  wep: { incAS: 0.11 },        arm: { incEvasion: 0.18 } },
  { id: "hark",  name: "Hark",  tier: 13, ilvl: 72,  wep: { incDmg: 0.20 },       arm: { flatLife: 160 } },
  { id: "umbra", name: "Umbra", tier: 14, ilvl: 80,  wep: { critMulti: 0.26 },    arm: { incLife: 0.12 } },
  { id: "vael",  name: "Vael",  tier: 15, ilvl: 90,  wep: { incDmg: 0.30 },       arm: { resAll: 0.10 } },
  { id: "zil",   name: "Zil",   tier: 16, ilvl: 100, wep: { pen: 0.10, incDmg: 0.14 }, arm: { incLife: 0.16, resAll: 0.07 } }
];

GM.RUNES = R;
GM.RUNE_BY_ID = GM.indexById(R);
GM.RUNE_ORDER = R.map(function (r) { return r.id; });

/* Which face of a rune applies in a given slot. */
GM.runeFace = function (rune, pool) {
  if (!rune) return null;
  return pool === "weapon" ? rune.wep : rune.arm;
};

/* Runes that can drop at a depth, steeply weighted toward the low end. */
GM.runesFor = function (ilvl) {
  var out = [];
  for (var i = 0; i < R.length; i++) {
    if (R[i].ilvl > ilvl) continue;
    out.push({ rune: R[i], w: Math.pow(0.62, R.length - 1 - i) * 100 });
  }
  return out.length ? out : [{ rune: R[0], w: 1 }];
};

/* ---------- runewords ----------------------------------------------------
   A runeword fires when a base of a legal pool holds EXACTLY the listed runes
   in EXACTLY that order, filling every socket. Order mattering is what makes
   socketing a decision instead of a dump. Its stats are granted on top of the
   individual runes' own stats, so a runeword base is strictly better than the
   sum of its runes — that is the reward for hitting the recipe. */
GM.RUNEWORDS = [
  { id: "rw_wake", name: "Wake", pools: ["weapon"], seq: ["mor", "ith"],
    stats: { incDmg: 0.18, incAS: 0.08 },
    flavour: "The first word spoken over the first grave." },

  { id: "rw_pall", name: "Pall", pools: ["helm", "body", "offhand"], seq: ["mor", "kesh"],
    stats: { flatLife: 70, resFire: 0.12 },
    flavour: "A cloth laid over what should not be looked at." },

  { id: "rw_cinder", name: "Cinderfall", pools: ["weapon"], seq: ["kesh", "var", "rhen"],
    stats: { incFire: 0.45, flatFire: 24, pen: 0.05 },
    flavour: "Burn the field, then salt it." },

  { id: "rw_gravebind", name: "Gravebind", pools: ["body", "offhand"], seq: ["dol", "sesh", "rhen"],
    stats: { incLife: 0.16, flatArmour: 220, resAll: 0.08 },
    flavour: "The earth holds what it is given." },

  { id: "rw_dirge", name: "Dirge", pools: ["weapon"], seq: ["ebb", "tor", "sesh"],
    stats: { critChance: 0.06, critMulti: 0.40, leechPct: 0.010 },
    flavour: "Sung slow, so the dying can keep up." },

  { id: "rw_unlit", name: "Unlit Lamp", pools: ["helm"], seq: ["nara", "quell"],
    stats: { resVoid: 0.20, findRarity: 0.35, epitaphChance: 0.08 },
    flavour: "It shows you nothing. You see anyway." },

  { id: "rw_longmile", name: "Long Mile", pools: ["boots"], seq: ["ith", "sarn"],
    stats: { incEvasion: 0.40, incAS: 0.09, graveHaste: 0.30 },
    flavour: "Walked once by everyone, and only once." },

  { id: "rw_sexton", name: "Sexton's Due", pools: ["belt", "ring", "amulet"], seq: ["ebb", "hark"],
    stats: { findGold: 0.80, flatLife: 180, regenFlat: 30 },
    flavour: "Paid in coin, settled in soil." },

  { id: "rw_ninebells", name: "Nine Bells", pools: ["weapon"], seq: ["hark", "umbra", "tor"],
    stats: { incDmg: 0.55, critMulti: 0.55, pen: 0.08 },
    flavour: "Nine for a soul that will not stay put." },

  { id: "rw_monument", name: "Monument", pools: ["body"], seq: ["quell", "hark", "vael", "umbra"],
    stats: { incLife: 0.30, incArmour: 0.60, resAll: 0.14, flatLife: 420 },
    flavour: "Outlasts the name it was cut for." },

  { id: "rw_lastword", name: "Last Word", pools: ["weapon"], seq: ["vael", "zil", "umbra"],
    stats: { incDmg: 0.85, pen: 0.14, critMulti: 0.60, leechPct: 0.014 },
    flavour: "There is no argument after it." },

  { id: "rw_vigil", name: "Vigil Eternal", pools: ["amulet", "ring"], seq: ["zil", "vael"],
    stats: { incLife: 0.20, resAll: 0.16, epitaphChance: 0.15, graveHaste: 0.50 },
    flavour: "Someone is always awake. It is not always you." }
];

GM.RUNEWORD_BY_ID = GM.indexById(GM.RUNEWORDS);

/* Does this socket layout spell a runeword? Sockets must be full and ordered. */
GM.matchRuneword = function (pool, socketIds) {
  if (!socketIds || !socketIds.length) return null;
  for (var i = 0; i < socketIds.length; i++) if (!socketIds[i]) return null;
  for (var r = 0; r < GM.RUNEWORDS.length; r++) {
    var rw = GM.RUNEWORDS[r];
    if (rw.seq.length !== socketIds.length) continue;
    if (rw.pools.indexOf(pool) < 0) continue;
    var ok = true;
    for (var s = 0; s < rw.seq.length; s++) {
      if (rw.seq[s] !== socketIds[s]) { ok = false; break; }
    }
    if (ok) return rw;
  }
  return null;
};

/* Runewords the player could still be working toward, for the recipe panel. */
GM.runewordsForPool = function (pool) {
  return GM.RUNEWORDS.filter(function (rw) { return rw.pools.indexOf(pool) >= 0; });
};
