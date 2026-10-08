/* Iron League — catalogs, class kits, clip timing. No DOM. */
(function (root) {
  const IL = root.IL = root.IL || {};

  /* renown: 0 is free at founding. Higher ranks open on the market. */
  const CLASSES = {
    warrior: {
      id: "warrior", name: "Warrior", renown: 0,
      blurb: "Closes in. A cleave, then a leaping swing.",
      hp: 150, atk: 18, def: 5, speed: 118, radius: 15,
      range: 42, role: "melee", attacks: ["atk1", "atk2", "atk1", "atk3"],
      airs: ["air1", "air2"], leaps: true, weapon: 1, run: "run",
      ability: { id: "cleave", name: "Cleave", kind: "cleave", cd: 7.2, fx: "slash" },
      passive: { id: "footing", name: "Sure Footing" }
    },
    archer: {
      id: "archer", name: "Archer", renown: 0,
      blurb: "Keeps a gap. A shot, sometimes three.",
      hp: 98, atk: 15, def: 2, speed: 126, radius: 14,
      range: 268, role: "kite", attacks: ["atk1"], weapon: 4, run: "run2",
      ability: { id: "multishot", name: "Multishot", kind: "multishot", cd: 8, fx: "shot" },
      passive: { id: "aim", name: "Long Eye" }
    },
    mage: {
      id: "mage", name: "Mage", renown: 0,
      blurb: "Frost nova, then a fireball.",
      hp: 88, atk: 26, def: 1, speed: 82, radius: 14,
      range: 214, role: "cast", attacks: ["cast1"],
      casts: ["cast1", "cast2"], castTime: 0.95, castRadius: 74, weapon: 5, run: "run",
      ability: { id: "frost", name: "Frost Nova", kind: "frost", cd: 0, fx: "plasma" },
      ability2: { id: "fireball", name: "Fireball", kind: "fireball", cd: 0, fx: "bolt" },
      passive: { id: "focus", name: "Still Hands" }
    },
    tank: {
      id: "tank", name: "Tank", renown: 0,
      blurb: "A lot of health. Taunts, then guards.",
      hp: 230, atk: 13, def: 9, speed: 74, radius: 16,
      range: 40, role: "tank", attacks: ["atk1", "atk2"], weapon: 2,
      idle: "idle2", run: "run",
      ability: { id: "taunt", name: "Taunt", kind: "taunt", cd: 8.5, fx: "orbit" },
      passive: { id: "guard", name: "Raised Guard" }
    },
    rogue: {
      id: "rogue", name: "Rogue", renown: 0,
      blurb: "A bleed cut, a shadowstep, a short roll.",
      hp: 90, atk: 17, def: 2, speed: 148, radius: 13,
      range: 36, role: "dash", attacks: ["atk3", "atk1"],
      airs: ["air2"], leaps: true, weapon: 3, run: "run2", bleed: true,
      ability: { id: "shadowstep", name: "Shadowstep", kind: "shadowstep", cd: 7.4, fx: "dash" },
      passive: { id: "bleed", name: "Bleed" }
    },
    lancer: {
      id: "lancer", name: "Lancer", renown: 15,
      blurb: "A long charge, then the point.",
      hp: 140, atk: 20, def: 4, speed: 124, radius: 15,
      range: 48, role: "melee", attacks: ["atk3", "atk1", "atk2"],
      airs: ["air1"], leaps: true, weapon: 1, run: "run",
      ability: { id: "charge", name: "Charge", kind: "charge", cd: 7, fx: "dash" },
      passive: { id: "reach", name: "Long Reach" }
    },
    berserker: {
      id: "berserker", name: "Berserker", renown: 40,
      blurb: "Hits harder as the blood runs.",
      hp: 160, atk: 20, def: 3, speed: 112, radius: 15,
      range: 40, role: "melee", attacks: ["atk2", "atk1", "atk3"],
      airs: ["air2"], leaps: true, weapon: 2, run: "run",
      ability: { id: "rage", name: "Rage", kind: "rage", cd: 9, fx: "spark" },
      passive: { id: "fury", name: "Low-Health Fury" }
    },
    healer: {
      id: "healer", name: "Healer", renown: 15,
      blurb: "Mends the nearest wound. A weak stick if pressed.",
      hp: 104, atk: 11, def: 2, speed: 100, radius: 14,
      range: 36, role: "support", attacks: ["atk1"], weapon: 5, run: "run",
      ability: { id: "mend", name: "Mend", kind: "mend", cd: 6.5, fx: "plasma" },
      passive: { id: "triage", name: "Triage" }
    },
    assassin: {
      id: "assassin", name: "Assassin", renown: 70,
      blurb: "Steps behind. The next cut bites deeper.",
      hp: 84, atk: 21, def: 1, speed: 156, radius: 13,
      range: 34, role: "dash", attacks: ["atk3", "atk1"],
      leaps: true, airs: ["air2"], weapon: 3, run: "run2", bleed: true,
      ability: { id: "shadowstep", name: "Shadowstep", kind: "shadowstep", cd: 6.2, fx: "smoke" },
      passive: { id: "bleed", name: "Bleed" }
    },
    ranger: {
      id: "ranger", name: "Ranger", renown: 40,
      blurb: "A shot that keeps going through the first body.",
      hp: 102, atk: 16, def: 2, speed: 122, radius: 14,
      range: 250, role: "kite", attacks: ["atk1"], weapon: 4, run: "run2", pierce: 1,
      ability: { id: "pierce", name: "Pierce Shot", kind: "pierce", cd: 7.5, fx: "shot" },
      passive: { id: "trail", name: "Marked Trail" }
    },
    battlemage: {
      id: "battlemage", name: "Battlemage", renown: 40,
      blurb: "A short circle, then the blade.",
      hp: 118, atk: 16, def: 3, speed: 96, radius: 14,
      range: 46, role: "hybrid", attacks: ["atk1", "atk2"],
      casts: ["cast1"], castTime: 0.72, castRadius: 58, weapon: 5, run: "run",
      ability: { id: "arc", name: "Arc Burst", kind: "arc", cd: 6.8, fx: "plasma" },
      passive: { id: "ward", name: "Close Ward" }
    },
    shieldbearer: {
      id: "shieldbearer", name: "Shieldbearer", renown: 15,
      blurb: "Plants a guard zone and does not move off it.",
      hp: 210, atk: 14, def: 10, speed: 70, radius: 16,
      range: 40, role: "tank", attacks: ["atk1", "atk2"], weapon: 2,
      idle: "idle2", run: "run",
      ability: { id: "zone", name: "Guard Zone", kind: "zone", cd: 8, fx: "orbit" },
      passive: { id: "wall", name: "Set Shield" }
    },
    skirmisher: {
      id: "skirmisher", name: "Skirmisher", renown: 15,
      blurb: "Darts in, looses one, darts out.",
      hp: 96, atk: 14, def: 2, speed: 138, radius: 13,
      range: 200, role: "kite", attacks: ["atk1"], weapon: 3, run: "run2",
      ability: { id: "skirmish", name: "Skirmish", kind: "skirmish", cd: 6.4, fx: "dash" },
      passive: { id: "feint", name: "Feint" }
    },
    duelist: {
      id: "duelist", name: "Duelist", renown: 70,
      blurb: "Wants one opponent. The reply is sharper.",
      hp: 112, atk: 19, def: 3, speed: 130, radius: 14,
      range: 40, role: "melee", attacks: ["atk1", "atk3", "atk2"],
      airs: ["air1"], leaps: true, weapon: 1, run: "run2",
      ability: { id: "lunge", name: "Lunge", kind: "lunge", cd: 6.6, fx: "slash" },
      passive: { id: "riposte", name: "Riposte" }
    },
    elementalist: {
      id: "elementalist", name: "Elementalist", renown: 70,
      blurb: "A tight nova and a bolt that travels.",
      hp: 86, atk: 24, def: 1, speed: 88, radius: 14,
      range: 230, role: "cast", attacks: ["cast1"],
      casts: ["cast1", "cast2"], castTime: 0.78, castRadius: 62, weapon: 5,
      run: "run", boltCast: true,
      ability: { id: "nova", name: "Nova", kind: "frost", cd: 0, fx: "plasma" },
      ability2: { id: "bolt", name: "Bolt", kind: "fireball", cd: 0, fx: "bolt" },
      passive: { id: "cycle", name: "Cycle" }
    }
  };

  /* Curated Time Fantasy sheets per class. Archer and ranger are bow
     sheets (every set except the gun troops). Skirmisher is the gun line. */
  const LOOKS = {
    warrior: ["1_1", "2_1", "3_1", "4_1", "5_1", "6_1", "7_7", "military1_1"],
    archer: ["1_6", "2_6", "3_6", "4_6", "5_6", "6_6", "7_4", "military1_6"],
    mage: ["1_2", "2_2", "3_2", "4_2", "5_2", "6_2", "7_2", "7_6"],
    tank: ["1_7", "2_7", "3_7", "4_7", "5_7", "6_7", "1_8", "military1_7"],
    rogue: ["2_4", "3_4", "4_4", "5_4", "6_4", "7_8", "7_3", "1_4"],
    lancer: ["1_3", "2_3", "3_3", "4_3", "5_3", "6_3", "military1_3", "military1_8"],
    berserker: ["3_5", "4_5", "5_5", "6_5", "1_8", "2_8", "7_5", "military1_4"],
    healer: ["1_5", "1_8", "2_8", "3_8", "4_8", "5_8", "6_8", "7_1"],
    assassin: ["2_4", "3_4", "5_4", "6_4", "7_8", "7_3", "1_4", "military1_4"],
    ranger: ["1_6", "2_5", "3_6", "4_6", "5_6", "6_6", "7_4", "military1_5"],
    battlemage: ["1_2", "2_2", "4_2", "5_2", "6_2", "7_2", "3_2", "1_7"],
    shieldbearer: ["1_7", "2_7", "4_7", "5_7", "6_7", "1_1", "military1_2", "military1_7"],
    skirmisher: [
      "military2_1", "military2_2", "military2_3", "military2_4",
      "military2_5", "military2_6", "military2_7", "military2_8",
      "military3_1", "military3_2", "military3_3", "military3_4",
      "military3_5", "military3_6", "military3_7", "military3_8"
    ],
    duelist: ["1_1", "2_1", "4_1", "5_1", "6_1", "7_7", "3_1", "military1_1"],
    elementalist: ["1_2", "7_2", "7_6", "5_2", "3_2", "6_2", "2_8", "4_8"],
    monk: ["1_8", "2_8", "3_8", "4_8", "5_8", "6_8", "7_1", "1_5"],
    necromancer: ["7_2", "7_6", "6_2", "5_2", "3_2", "4_2", "1_2", "2_2"],
    paladin: ["1_7", "2_7", "4_7", "military1_1", "military1_2", "1_1", "5_7", "6_7"],
    druid: ["2_5", "3_5", "4_5", "7_5", "6_8", "1_8", "5_8", "2_8"],
    bard: ["1_5", "2_8", "4_8", "6_8", "7_1", "3_8", "5_8", "1_8"],
    gunslinger: ["military2_1", "military2_3", "military2_5", "military2_8", "military3_2", "military3_4", "military3_6", "military3_8"],
    warlock: ["7_6", "7_2", "4_2", "6_2", "1_2", "5_2", "3_2", "2_2"],
    samurai: ["6_1", "6_8", "5_1", "2_1", "4_1", "3_1", "7_7", "1_1"],
    spearmaiden: ["1_3", "2_3", "4_3", "5_3", "6_3", "3_3", "military1_3", "military1_8"],
    summoner: ["7_2", "7_6", "3_2", "2_2", "6_2", "5_2", "4_2", "1_2"],
    alchemist: ["1_5", "3_8", "5_2", "4_2", "2_2", "6_8", "7_6", "1_2"],
    beastmaster: ["3_5", "4_5", "6_5", "2_4", "5_5", "7_5", "military1_4", "3_4"]
  };

  const SHEET_SET = {};
  (function () {
    for (let s = 1; s <= 7; s++) {
      for (let i = 1; i <= 8; i++) SHEET_SET[s + "_" + i] = true;
    }
    for (let m = 1; m <= 3; m++) {
      for (let i = 1; i <= 8; i++) SHEET_SET["military" + m + "_" + i] = true;
    }
  })();

  /* Game clip → Time Fantasy motion. Ranged atk1 is swapped in visualMotion. */
  const CLIP_MOTION = {
    idle: "idle1",
    idle2: "idle2",
    run: "walk",
    run2: "walk",
    jump: "cheer",
    fall: "cheer",
    land: "crouch",
    atk1: "atk1",
    atk2: "atk2",
    atk3: "atk2",
    air1: "atk1",
    air2: "atk2",
    cast1: "magic",
    cast2: "magic",
    hurt: "hit",
    die: "dead",
    dash: "walk",
    block: "crouch",
    roll: "crouch"
  };

  /* Which of the 3 source frames each game frame samples. Index 2 is the
     swing toward the foe (and a bow's loose). Hit frames sample that one. */
  const CLIP_SAMPLE = {
    idle: [0, 1, 2, 0, 1, 2],
    idle2: [0, 1, 2, 0, 1, 2],
    run: [0, 1, 2, 0, 1, 2, 0, 1],
    run2: [1, 2, 0, 1, 2, 0, 1, 2],
    jump: [0, 1, 2, 2],
    fall: [1, 1, 2],
    land: [2],
    atk1: [0, 1, 2, 2, 2, 2],
    atk2: [0, 1, 2, 2, 2, 2],
    atk3: [0, 1, 2, 2],
    air1: [0, 1, 2, 2, 2, 2],
    air2: [0, 1, 2, 2],
    cast1: [0, 0, 0, 1, 2],
    cast2: [0, 0, 0, 1, 2],
    hurt: [0, 1, 2, 2],
    die: [0, 0, 0, 0, 0],
    dash: [0, 1, 2, 0, 1, 2, 0, 1],
    block: [1, 1, 1, 1, 1],
    roll: [0, 1, 2, 0, 1, 2, 1, 0]
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

  const FIRST = ["Ada", "Bram", "Cass", "Dorrin", "Ede", "Fenn", "Gal", "Hester", "Ivo", "Joss", "Kett", "Lumen", "Marrow", "Ness", "Osric", "Pell", "Quill", "Rho", "Sable", "Tor", "Una", "Vesper", "Wynn", "Yarrow", "Zeke", "Briar", "Holt", "Nim", "Sedge", "Vail", "Ansel", "Bex", "Cora", "Dax", "Eira", "Faye", "Hale", "Ivy", "Jory", "Kira", "Leif", "Mira", "Nia", "Orla", "Pax", "Ren", "Shay", "Tess", "Willa", "Wren", "Cade", "Fern", "Otto", "Pip", "Rue", "Gemma", "Nell", "Jor", "Kit", "Bryn"];
  const LAST = ["Ash", "Barrow", "Cole", "Dusk", "Elm", "Flint", "Grey", "Holt", "Irons", "Keel", "Lark", "Moss", "Nye", "Pike", "Quinn", "Reed", "Slate", "Thorn", "Vale", "Wick", "Harrow", "Cinder", "Lowell", "Peck", "Crowe", "Dun", "Heath", "Ives", "Kerr", "Lyle", "Marsh", "Rook", "Tarn", "Voss", "Weld", "Yarn", "Bryce", "Cliff", "Dorn", "Ellis"];
  const CLUBS = ["Ashveil Company", "Red Kettle", "Lowmarket Blades", "Cinder Pact", "North Wharf", "Glass Orchard", "Mudgate Crew", "Harrow and Coil", "Salt Stair", "Penny Standard", "Bright Rust", "Hollow Lantern", "Copper Warden", "Mile End", "Soot Choir", "Gutter Saint", "Amber Yoke", "Third Bell"];

  /* Five-match season. Sizes cover 1v1, 2v2 and 3v3. */
  /* v73: an 8-club league, one round robin, seven weeks. Squad size per
     week; an older save keeps the length of its own fixture list. */
  const SEASON_SIZES = [3, 2, 3, 1, 3, 2, 3];
  const LEAGUE_CLUBS = 8;
  const PARTY_CAP = 3;

  const HIRE_COST = 70;
  const START_GOLD = 120;
  const REFRESH_COST = 25;
  const ROSTER_CAP = 8;
  const CUP_SIZE = 4;

  const PERSONALITIES = ["bold", "wary", "patient"];
  const TACTICS = ["strike", "cover", "hold"];
  /* Behavior rows on the fighter sheet. The first choice of each row is
     the default and reproduces the older AI exactly, so a save without
     an "ai" block fights the way it always did. */
  const AI_ROWS = [
    { key: "target", name: "Target", opts: [
      { id: "near", name: "Nearest", blurb: "Hit whoever is closest." },
      { id: "weak", name: "Weakest", blurb: "Hunt the foe with the least health left." },
      { id: "back", name: "Backline", blurb: "Reach past the front for archers, casters, and healers." },
      { id: "strong", name: "Biggest", blurb: "Lock onto the foe hitting hardest." },
      { id: "captain", name: "Captain's", blurb: "Hit whatever the captain is hitting." }
    ] },
    { key: "range", name: "Spacing", opts: [
      { id: "kit", name: "Class", blurb: "Stand where the class stands." },
      { id: "close", name: "Close", blurb: "Ranged and casters creep in nearer." },
      { id: "far", name: "Far", blurb: "Ranged and casters keep their distance." }
    ] },
    { key: "ult", name: "Ultimate", opts: [
      { id: "ready", name: "When ready", blurb: "Fire the third move as soon as it is up." },
      { id: "crowd", name: "On a crowd", blurb: "Wait until two foes stand close together." },
      { id: "finish", name: "To finish", blurb: "Save it for a foe under half health." }
    ] },
    { key: "retreat", name: "Fall back", opts: [
      { id: "never", name: "Never", blurb: "Stay in until it ends." },
      { id: "low", name: "Under 30%", blurb: "Back off toward home when badly hurt." },
      { id: "half", name: "Under 50%", blurb: "Back off early and fight from the edge." }
    ] },
    { key: "evade", name: "Rolls", opts: [
      { id: "normal", name: "Normal", blurb: "Roll as the personality says." },
      { id: "often", name: "Often", blurb: "Roll away from more threats." },
      { id: "rarely", name: "Rarely", blurb: "Trade blows instead of rolling." }
    ] },
    /* v98, after Eslabong's AOE efficiency setting. */
    { key: "aoe", name: "Area moves", opts: [
      { id: "two", name: "2 or more", blurb: "Hold cleaves and blasts until two foes are in the area, unless one foe is left." },
      { id: "any", name: "Anyone", blurb: "Fire area moves at a single foe as soon as they are up." },
      { id: "three", name: "3 or more", blurb: "Hold area moves for three foes in the area, unless fewer are left." }
    ] }
  ];

  function normAi(raw) {
    const out = {};
    const src = raw && typeof raw === "object" ? raw : {};
    for (let i = 0; i < AI_ROWS.length; i++) {
      const row = AI_ROWS[i];
      const want = src[row.key];
      out[row.key] = row.opts.some(function (o) { return o.id === want; }) ? want : row.opts[0].id;
    }
    return out;
  }

  function aiCustom(raw) {
    const ai = normAi(raw);
    return AI_ROWS.some(function (row) { return ai[row.key] !== row.opts[0].id; });
  }

  /* Growth styles (v64). Each level rolls stat points weighted by style:
     two points a level, one point is +2.5% health, +2.5% attack, +0.5
     defense, or +1.5% speed. Shown when recruiting and on the sheet. */
  const STYLES = {
    balanced: { name: "Balanced", blurb: "A little of everything.", w: { hp: 1, atk: 1, def: 1, spd: 1 } },
    bruiser: { name: "Bruiser", blurb: "Health first, then guard.", w: { hp: 3, atk: 1, def: 2, spd: 0.5 } },
    striker: { name: "Striker", blurb: "Attack first, then speed.", w: { hp: 1, atk: 3, def: 0.5, spd: 1.5 } },
    swift: { name: "Swift", blurb: "Speed first, then attack.", w: { hp: 1, atk: 1.5, def: 0.5, spd: 3 } },
    bulwark: { name: "Bulwark", blurb: "Defense first, then health.", w: { hp: 2, atk: 0.5, def: 3, spd: 0.5 } }
  };
  const STYLE_IDS = Object.keys(STYLES);
  const ROLL_VALUE = { hp: 0.025, atk: 0.025, def: 0.5, spd: 0.015 };

  function styleOf(f) {
    if (f && STYLES[f.style]) return f.style;
    return STYLE_IDS[(hashStr(String((f && f.id) || "f") + ":style") >>> 0) % STYLE_IDS.length];
  }

  /* Stamina. Fielded fighters tire in league and cup matches; the bench
     rests. Under half, health and damage slide a little, down to -12%. */
  const STAMINA_MAX = 100;
  const STAMINA_COST = 20;
  const STAMINA_REST = 34;

  function staminaOf(f) {
    const s = f && typeof f.stamina === "number" ? f.stamina : STAMINA_MAX;
    return Math.max(0, Math.min(STAMINA_MAX, s));
  }

  function staminaMul(f) {
    const s = staminaOf(f);
    if (s >= 50) return 1;
    return 0.88 + 0.12 * (s / 50);
  }

  function staminaLabel(f) {
    const s = staminaOf(f);
    if (s >= 80) return "Fresh";
    if (s >= 50) return "Ready";
    if (s >= 25) return "Tired";
    return "Spent";
  }

  const CHAMPIONS = [
    { name: "Old Marrow", cls: "warrior" },
    { name: "Sister Vellum", cls: "healer" },
    { name: "Pike of the Stair", cls: "lancer" },
    { name: "Red Tess", cls: "assassin" },
    { name: "Bram the Kiln", cls: "berserker" },
    { name: "Quiet Nia", cls: "ranger" },
    { name: "Os the Bell", cls: "shieldbearer" },
    { name: "Ivo Glass", cls: "elementalist" },
    { name: "Hester Quill", cls: "duelist" },
    { name: "Soot Mira", cls: "battlemage" }
  ];

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

  function sheetKnown(id) {
    return !!SHEET_SET[id];
  }

  function sheetHasBow(id) {
    if (!sheetKnown(id)) return false;
    return id.indexOf("military2_") !== 0 && id.indexOf("military3_") !== 0;
  }

  function sheetHasGun(id) {
    if (!sheetKnown(id)) return false;
    return id.indexOf("military2_") === 0 || id.indexOf("military3_") === 0;
  }

  function looksFor(cls) {
    return LOOKS[cls] || LOOKS.warrior;
  }

  function defaultSheet(cls) {
    return looksFor(cls)[0];
  }

  /* Attack clips pick a sheet column in weapons.column so a baked sword is
     not drawn on a mage, an axe, or a staff. Kind overrides the class default
     when a fighter has a weapon equipped. */
  function visualMotion(clip, cls, sheet, kind) {
    const held = kind || (IL.CLASS_WEAPON && IL.CLASS_WEAPON[cls]) || "";
    const base = CLIP_MOTION[clip] || "idle1";
    const attack = clip === "atk1" || clip === "atk2" || clip === "atk3" || clip === "air1" || clip === "air2";
    if (attack && IL.weapons && IL.weapons.column) return IL.weapons.column(held, base, sheet);
    return base;
  }

  /* Bow's third frame is the loose. Sword and gun connect on the middle frame.
     Hit frames stay 39–40; only the bow samples the release there. */
  function visualSample(clip, motion, local) {
    if (motion === "bow" && clip === "atk1") {
      const bow = [0, 1, 2, 2, 2, 2];
      return bow[local] != null ? bow[local] : 2;
    }
    const sample = CLIP_SAMPLE[clip];
    if (!sample || local < 0) return 0;
    return sample[local] != null ? sample[local] : sample[sample.length - 1];
  }

  function randomParts(rng, cls) {
    const pool = looksFor(cls || "warrior");
    return { sheet: pool[Math.floor(rng() * pool.length)] };
  }

  function classUnlocked(id, renown) {
    const kit = CLASSES[id];
    if (!kit) return false;
    return (kit.renown || 0) <= (renown || 0);
  }

  function unlockedIds(renown) {
    return Object.keys(CLASSES).filter(function (id) { return classUnlocked(id, renown); });
  }

  function hireCost(clsId) {
    const kit = CLASSES[clsId] || CLASSES.warrior;
    const tier = kit.renown || 0;
    if (tier >= 70) return 120;
    if (tier >= 40) return 95;
    if (tier >= 15) return 80;
    return HIRE_COST;
  }

  function blankFighterFields(rng) {
    return {
      xp: 0,
      level: 1,
      captain: false,
      boosts: { hp: 0, dmg: 0, spd: 0, def: 0 },
      pendingPicks: 0,
      personality: pick(rng, PERSONALITIES),
      tactic: "strike",
      champion: false,
      wins: 0,
      losses: 0,
      kos: 0,
      gear: { weapon: null, armor: null, trinket: null }
    };
  }

  function firstToken(name) {
    return String(name || "").trim().split(/\s+/)[0].toLowerCase();
  }

  /* A digit stuck on a first name is an old suffix (Quill2), not a person. */
  function suffixedToken(token) {
    const m = /^([a-z]+?)(\d+)$/.exec(token || "");
    if (!m) return false;
    const stem = m[1];
    for (let i = 0; i < FIRST.length; i++) {
      const name = FIRST[i].toLowerCase();
      if (name === stem || name.slice(0, 5) === stem) return true;
    }
    return false;
  }

  function poolName(rng, used) {
    for (let i = 0; i < 80; i++) {
      const first = pick(rng, FIRST);
      if (used[first.toLowerCase()]) continue;
      return first + " " + pick(rng, LAST);
    }
    for (let i = 0; i < FIRST.length; i++) {
      if (!used[FIRST[i].toLowerCase()]) return FIRST[i] + " " + pick(rng, LAST);
    }
    return pick(rng, FIRST) + " " + pick(rng, LAST);
  }

  /* First names on a club card must not repeat. Re-roll from the pool. */
  function uniqueName(rng, taken) {
    const used = {};
    (taken || []).forEach(function (n) {
      const key = firstToken(n);
      if (key) used[key] = true;
    });
    return poolName(rng, used);
  }

  function dedupeNames(list) {
    const used = {};
    (list || []).forEach(function (f) {
      if (!f || typeof f.name !== "string") return;
      let key = firstToken(f.name);
      if (!key || used[key] || suffixedToken(key)) {
        const seed = (hashStr(String(f.id || f.name || "f") + ":" + key) >>> 0) || 1;
        f.name = poolName(mulberry32(seed), used);
        key = firstToken(f.name);
      }
      if (key) used[key] = true;
    });
    return list;
  }

  /* Rename a non-champion whose first name is already taken. A private rng
     keeps the save stream put. Champions keep the name they are known by. */
  function separateNames(list, reserved) {
    const used = {};
    (reserved || []).forEach(function (n) {
      const key = firstToken(n);
      if (key) used[key] = true;
    });
    (list || []).forEach(function (f) {
      if (!f || typeof f.name !== "string") return;
      let key = firstToken(f.name);
      if (f.champion) {
        if (key) used[key] = true;
        return;
      }
      if (!key || used[key]) {
        const seed = (hashStr(String(f.id || "f") + ":name:" + key) >>> 0) || 1;
        f.name = poolName(mulberry32(seed), used);
        key = firstToken(f.name);
      }
      if (key) used[key] = true;
    });
    return list;
  }

  /* Give each fighter a sheet from their own class pool that this group has
     not already used. Falls back to the current sheet when the pool is full. */
  function separateLooks(list, reserved) {
    const used = {};
    (reserved || []).forEach(function (id) { if (id) used[id] = true; });
    (list || []).forEach(function (f) {
      if (!f) return;
      if (!f.parts) f.parts = {};
      const pool = looksFor(f.cls || "warrior");
      const cur = f.parts.sheet;
      if (cur && pool.indexOf(cur) >= 0 && !used[cur]) {
        used[cur] = true;
        return;
      }
      const seed = (hashStr(String(f.id || "f") + ":look") >>> 0) || 1;
      let picked = pool[seed % pool.length];
      for (let i = 0; i < pool.length; i++) {
        const next = pool[(seed + i) % pool.length];
        if (!used[next]) { picked = next; break; }
      }
      f.parts.sheet = picked;
      used[picked] = true;
    });
    return list;
  }

  function randomFighter(rng, clsId) {
    const ids = Object.keys(CLASSES);
    const cls = clsId && CLASSES[clsId] ? clsId : pick(rng, ids);
    const parts = randomParts(rng, cls);
    return Object.assign({
      id: "f" + Math.floor(rng() * 1e9).toString(36),
      name: pick(rng, FIRST) + " " + pick(rng, LAST),
      cls: cls,
      parts: parts
    }, blankFighterFields(rng));
  }

  /* v65 xp curve: level L to L+1 costs 40 × L^1.2 (40, 92, 150, 211, 276 …).
     It was a flat 40. Saves convert once (meta.js migrate) without losing a level. */
  const LEVEL_CAP = 100;  /* v84: was 30; Eslabong runs to 100 */
  const XP_FLOOR = [0, 0];
  function xpNeed(level) {
    return Math.round(40 * Math.pow(Math.max(1, level), 1.2));
  }
  for (let lv = 2; lv <= LEVEL_CAP + 1; lv++) XP_FLOOR[lv] = XP_FLOOR[lv - 1] + xpNeed(lv - 1);
  function xpFloor(level) {
    return XP_FLOOR[Math.max(1, Math.min(LEVEL_CAP + 1, level | 0))] || 0;
  }
  function xpLevel(xp) {
    let lv = 1;
    while (lv < LEVEL_CAP && (xp || 0) >= XP_FLOOR[lv + 1]) lv++;
    return lv;
  }
  function xpInto(xp, level) {
    const lv = Math.max(level || 1, xpLevel(xp));
    const need = xpNeed(lv);
    const into = Math.max(0, Math.min(need, (xp || 0) - xpFloor(lv)));
    return { level: lv, into: Math.round(into), need: need, frac: need ? into / need : 0 };
  }

  /* Every 3rd level crossed by this xp gain offers one stat pick. */
  function growthFromXp(prevXp, nextXp) {
    const a = xpLevel(prevXp || 0);
    const b = xpLevel(nextXp || 0);
    let picks = 0;
    for (let lv = a + 1; lv <= b; lv++) if (lv % 3 === 0) picks++;
    return { level: b, picks: picks };
  }

  function boostChoices(fighter) {
    const third = ((hashStr(fighter.id || "f") + (fighter.level || 1)) % 2 === 0) ? "spd" : "def";
    return ["hp", "dmg", third];
  }

  const BOOST_LABEL = {
    hp: "Heartier — health",
    dmg: "Harder hits — damage",
    spd: "Quicker — speed",
    def: "Thicker guard — defense"
  };

  /* Named perks at levels 3, 6, and 9. Each one is a single existing stat step. */
  const PERK_COPY = {
    hp: { name: "Thick skin", blurb: "A little more health, kept on this fighter." },
    dmg: { name: "Keen eye", blurb: "Hits land a little harder." },
    spd: { name: "Light step", blurb: "A quicker step." },
    def: { name: "Iron side", blurb: "A thicker guard." }
  };

  IL.CLASSES = CLASSES;
  IL.CLIPS = CLIPS;
  IL.CLIP_MOTION = CLIP_MOTION;
  IL.CLIP_SAMPLE = CLIP_SAMPLE;
  IL.frameIndex = frameIndex;
  IL.clipDur = clipDur;
  IL.sheetKnown = sheetKnown;
  IL.sheetHasBow = sheetHasBow;
  IL.sheetHasGun = sheetHasGun;
  IL.looksFor = looksFor;
  IL.defaultSheet = defaultSheet;
  IL.visualMotion = visualMotion;
  IL.visualSample = visualSample;
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
  IL.LEAGUE_CLUBS = LEAGUE_CLUBS;
  IL.PARTY_CAP = PARTY_CAP;
  IL.HIRE_COST = HIRE_COST;
  IL.START_GOLD = START_GOLD;
  IL.REFRESH_COST = REFRESH_COST;
  IL.ROSTER_CAP = ROSTER_CAP;
  IL.CUP_SIZE = CUP_SIZE;
  IL.PERSONALITIES = PERSONALITIES;
  IL.TACTICS = TACTICS;
  IL.AI_ROWS = AI_ROWS;
  IL.normAi = normAi;
  IL.aiCustom = aiCustom;
  IL.STYLES = STYLES;
  IL.STYLE_IDS = STYLE_IDS;
  IL.ROLL_VALUE = ROLL_VALUE;
  IL.styleOf = styleOf;
  IL.STAMINA_MAX = STAMINA_MAX;
  IL.STAMINA_COST = STAMINA_COST;
  IL.STAMINA_REST = STAMINA_REST;
  IL.staminaOf = staminaOf;
  IL.staminaMul = staminaMul;
  IL.staminaLabel = staminaLabel;
  IL.CHAMPIONS = CHAMPIONS;
  IL.mulberry32 = mulberry32;
  IL.hashStr = hashStr;
  IL.pick = pick;
  IL.randomParts = randomParts;
  IL.randomFighter = randomFighter;
  IL.uniqueName = uniqueName;
  IL.dedupeNames = dedupeNames;
  IL.separateNames = separateNames;
  IL.separateLooks = separateLooks;
  IL.firstToken = firstToken;
  IL.blankFighterFields = blankFighterFields;
  IL.xpLevel = xpLevel;
  IL.xpNeed = xpNeed;
  IL.xpFloor = xpFloor;
  IL.xpInto = xpInto;
  IL.LEVEL_CAP = LEVEL_CAP;
  IL.growthFromXp = growthFromXp;
  IL.boostChoices = boostChoices;
  IL.BOOST_LABEL = BOOST_LABEL;
  IL.PERK_COPY = PERK_COPY;
  IL.classUnlocked = classUnlocked;
  IL.unlockedIds = unlockedIds;
  IL.hireCost = hireCost;
})(typeof window !== "undefined" ? window : globalThis);
