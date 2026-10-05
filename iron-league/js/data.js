/* Iron League — catalogs, class kits, clip timing. No DOM. */
(function (root) {
  const IL = root.IL = root.IL || {};

  const CLASSES = {
    warrior: {
      id: "warrior", name: "Warrior",
      blurb: "Closes in. Cuts, then a leaping swing.",
      hp: 150, atk: 18, def: 5, speed: 118, radius: 15,
      range: 42, role: "melee", attacks: ["atk1", "atk2", "atk1", "atk3"],
      airs: ["air1", "air2"], leaps: true,
      weapon: 1
    },
    archer: {
      id: "archer", name: "Archer",
      blurb: "Keeps a gap and looses a shot.",
      hp: 98, atk: 15, def: 2, speed: 126, radius: 14,
      range: 268, role: "kite", attacks: ["atk1"],
      weapon: 4
    },
    mage: {
      id: "mage", name: "Mage",
      blurb: "A wide circle, then a hotter one.",
      hp: 88, atk: 28, def: 1, speed: 82, radius: 14,
      range: 214, role: "cast", attacks: ["cast1"],
      casts: ["cast1", "cast2"],
      castTime: 0.95, castRadius: 74,
      weapon: 5
    },
    tank: {
      id: "tank", name: "Tank",
      blurb: "A lot of health. Raises a guard.",
      hp: 236, atk: 13, def: 9, speed: 74, radius: 16,
      range: 40, role: "tank", attacks: ["atk1", "atk2"],
      weapon: 2
    },
    rogue: {
      id: "rogue", name: "Rogue",
      blurb: "Dashes through, rolls clear, then a short cut.",
      hp: 90, atk: 17, def: 2, speed: 148, radius: 13,
      range: 36, role: "dash", attacks: ["atk3", "atk1"],
      airs: ["air2"], leaps: true,
      weapon: 3
    }
  };

  /* Frame numbers are 1-based and match ANIM.md.
     loopFrom: play up to that frame, then loop through `to`.
     once: hold the last frame instead of repeating. */
  const CLIPS = {
    idle:  { from: 1,  to: 6,  fps: 8 },
    idle2: { from: 7,  to: 12, fps: 8 },
    run:   { from: 13, to: 20, fps: 11 },
    run2:  { from: 21, to: 28, fps: 11 },
    jump:  { from: 29, to: 32, fps: 10, once: true },
    fall:  { from: 33, to: 35, fps: 10 },
    land:  { from: 36, to: 36, fps: 10, once: true },
    atk1:  { from: 37, to: 42, fps: 12, once: true, hits: [39, 40] },
    atk2:  { from: 43, to: 48, fps: 12, once: true, hits: [45, 46] },
    atk3:  { from: 49, to: 52, fps: 14, once: true, hits: [51, 52] },
    air1:  { from: 53, to: 58, fps: 12, once: true, hits: [55, 56] },
    air2:  { from: 59, to: 62, fps: 12, once: true, hits: [61, 62] },
    cast1: { from: 63, to: 67, fps: 10, loopFrom: 65 },
    cast2: { from: 68, to: 72, fps: 10, loopFrom: 70 },
    hurt:  { from: 73, to: 76, fps: 12, once: true },
    die:   { from: 77, to: 81, fps: 8,  once: true },
    dash:  { from: 82, to: 89, fps: 14, loopFrom: 84, loopTo: 86 },
    block: { from: 90, to: 94, fps: 10 },
    roll:  { from: 95, to: 102, fps: 12, once: true }
  };

  function frameIndex(name, time) {
    const c = CLIPS[name] || CLIPS.idle;
    const i = Math.max(0, Math.floor((time || 0) * c.fps));
    if (c.loopFrom) {
      const intro = c.loopFrom - c.from;
      if (i < intro) return c.from + i;
      const loopEnd = c.loopTo || c.to;
      const loopLen = loopEnd - c.loopFrom + 1;
      return c.loopFrom + ((i - intro) % loopLen);
    }
    const len = c.to - c.from + 1;
    if (i >= len) return c.once ? c.to : c.from + (i % len);
    return c.from + i;
  }

  function clipDur(name) {
    const c = CLIPS[name] || CLIPS.idle;
    return (c.to - c.from + 1) / c.fps;
  }

  const HAIR = [];
  for (let i = 1; i <= 14; i++) HAIR.push("m" + i);
  for (let i = 1; i <= 9; i++) HAIR.push("f" + i);

  const WEAPONS = [
    { id: 1, name: "Sideblade" },
    { id: 2, name: "Hatchet" },
    { id: 3, name: "Knife" },
    { id: 4, name: "Longarm" },
    { id: 5, name: "Focus", colors: 4 }
  ];

  /* Swatches are chest/hair medians sampled from the sheets, for the picker.
     The preview canvas is the real composite. */
  const SKIN_COLORS = ["#b98963", "#5e3319", "#4a824c", "#447e72", "#812a2f", "#7bac87"];
  const HAIR_COLORS = ["#7e2639", "#345755", "#855044", "#454c82", "#4f4176", "#924766", "#452836", "#724545", "#44333c", "#6c6890"];
  const CLOTH_COLORS = ["#5a1c35", "#423989", "#0f4637", "#402c71", "#3e3b3b", "#884d15", "#3b2762", "#787da1"];
  const FOCUS_COLORS = ["#7d3929", "#555329", "#55534c", "#7d394c"];

  const FIRST = ["Ada", "Bram", "Cass", "Dorrin", "Ede", "Fenn", "Gal", "Hester", "Ivo", "Joss", "Kett", "Lumen", "Marrow", "Ness", "Osric", "Pell", "Quill", "Rho", "Sable", "Tor", "Una", "Vesper", "Wynn", "Yarrow", "Zeke", "Briar", "Holt", "Nim", "Sedge", "Vail"];
  const LAST = ["Ash", "Barrow", "Cole", "Dusk", "Elm", "Flint", "Grey", "Holt", "Irons", "Keel", "Lark", "Moss", "Nye", "Pike", "Quinn", "Reed", "Slate", "Thorn", "Vale", "Wick", "Harrow", "Cinder", "Lowell", "Peck"];
  const CLUBS = ["Ashveil Company", "Red Kettle", "Lowmarket Blades", "Cinder Pact", "North Wharf", "Glass Orchard", "Mudgate Crew", "Harrow and Coil", "Salt Stair", "Penny Standard", "Bright Rust", "Hollow Lantern", "Copper Warden", "Mile End", "Soot Choir", "Gutter Saint", "Amber Yoke", "Third Bell"];

  /* Five-match season. Sizes cover 1v1, 2v2 and 3v3. */
  const SEASON_SIZES = [3, 2, 3, 1, 3];

  const HIRE_COST = 70;
  const START_GOLD = 100;

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function rng() {
      a |= 0;
      a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function hashStr(str) {
    let h = 2166136261;
    const s = String(str);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function pick(rng, arr) {
    return arr[Math.floor(rng() * arr.length)];
  }

  function irand(rng, n) {
    return 1 + Math.floor(rng() * n);
  }

  function randomParts(rng) {
    const weapon = irand(rng, 5);
    return {
      skin: irand(rng, 6),
      face: irand(rng, 7),
      hair: pick(rng, HAIR),
      hairColor: irand(rng, 10),
      cloth: irand(rng, 17),
      clothColor: irand(rng, 8),
      weapon: weapon,
      weaponColor: irand(rng, 4)
    };
  }

  function randomFighter(rng, clsId) {
    const ids = Object.keys(CLASSES);
    const cls = clsId || pick(rng, ids);
    const parts = randomParts(rng);
    parts.weapon = CLASSES[cls].weapon;
    return {
      id: "f" + Math.floor(rng() * 1e9).toString(36),
      name: pick(rng, FIRST) + " " + pick(rng, LAST),
      cls: cls,
      parts: parts,
      xp: 0,
      level: 1,
      captain: false
    };
  }

  function xpLevel(xp) {
    return 1 + Math.floor((xp || 0) / 40);
  }

  IL.CLASSES = CLASSES;
  IL.CLIPS = CLIPS;
  IL.frameIndex = frameIndex;
  IL.clipDur = clipDur;
  IL.HAIR = HAIR;
  IL.WEAPONS = WEAPONS;
  IL.SKIN_COLORS = SKIN_COLORS;
  IL.HAIR_COLORS = HAIR_COLORS;
  IL.CLOTH_COLORS = CLOTH_COLORS;
  IL.FOCUS_COLORS = FOCUS_COLORS;
  IL.FIRST = FIRST;
  IL.LAST = LAST;
  IL.CLUBS = CLUBS;
  IL.SEASON_SIZES = SEASON_SIZES;
  IL.HIRE_COST = HIRE_COST;
  IL.START_GOLD = START_GOLD;
  IL.mulberry32 = mulberry32;
  IL.hashStr = hashStr;
  IL.pick = pick;
  IL.randomParts = randomParts;
  IL.randomFighter = randomFighter;
  IL.xpLevel = xpLevel;
})(typeof window !== "undefined" ? window : globalThis);
