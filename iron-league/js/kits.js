/* Iron League — extra kits, three abilities a class, traits, themed rivals.
   Loaded after data.js. Arena fighters stay Time Fantasy battlers. */
(function (root) {
  const IL = root.IL = root.IL || {};
  const CLASSES = IL.CLASSES;

  function A(id, name, kind, cd, fx, unlock, blurb, extra) {
    const row = { id: id, name: name, kind: kind, cd: cd, fx: fx, unlock: unlock, blurb: blurb };
    if (extra) {
      const keys = Object.keys(extra);
      for (let i = 0; i < keys.length; i++) row[keys[i]] = extra[keys[i]];
    }
    return row;
  }

  function give(id, trait, second, third) {
    const kit = CLASSES[id];
    kit.ability.unlock = 1;
    if (!kit.ability.blurb) kit.ability.blurb = kit.blurb;
    second.unlock = 4;
    third.unlock = 7;
    kit.abilities = [kit.ability, second, third];
    kit.trait = trait;
  }

  function giveCast(id, trait, third) {
    const kit = CLASSES[id];
    kit.ability.unlock = 1;
    kit.ability2.unlock = 4;
    if (!kit.ability.blurb) kit.ability.blurb = kit.blurb;
    if (!kit.ability2.blurb) kit.ability2.blurb = "The second chant.";
    third.unlock = 7;
    kit.abilities = [kit.ability, kit.ability2, third];
    kit.trait = trait;
  }

  const EXTRA = {
    monk: {
      id: "monk", name: "Monk", renown: 15, trait: "oath",
      blurb: "Short steps, open hands. A stun, then a mend.",
      hp: 124, atk: 16, def: 4, speed: 132, radius: 13,
      range: 34, role: "melee", attacks: ["atk1", "atk3", "atk2"],
      airs: ["air1"], leaps: true, weapon: 5, run: "run2",
      ability: A("palm", "Palm", "stun", 8.2, "spark", 1, "A short stun on the fighter in front.", { stun: 0.55, power: 0.45 })
    },
    necromancer: {
      id: "necromancer", name: "Necromancer", renown: 70, trait: "arcane",
      blurb: "A spiteful bolt and a bone that stands back up.",
      hp: 90, atk: 18, def: 1, speed: 78, radius: 14,
      range: 200, role: "cast", attacks: ["cast1"],
      casts: ["cast1"], castTime: 1.05, castRadius: 58, weapon: 5, run: "run",
      ability: A("spite", "Spite", "dot", 7.6, "smoke", 1, "A cut that keeps bleeding.", { power: 0.28, dot: 3.4, reach: 210 })
    },
    paladin: {
      id: "paladin", name: "Paladin", renown: 15, trait: "guardian",
      blurb: "Holds the line and mends the nearest wound.",
      hp: 196, atk: 14, def: 8, speed: 76, radius: 16,
      range: 40, role: "tank", attacks: ["atk1", "atk2"], weapon: 1,
      idle: "idle2", run: "run",
      ability: A("aegis", "Aegis", "shield", 9.5, "orbit", 1, "A shield on the most wounded ally.", { power: 0.1 })
    },
    druid: {
      id: "druid", name: "Druid", renown: 40, trait: "wild",
      blurb: "Thorns up close. A slow mend after.",
      hp: 112, atk: 14, def: 3, speed: 96, radius: 14,
      range: 42, role: "support", attacks: ["atk1"], weapon: 5, run: "run",
      ability: A("thorns", "Thorns", "nova", 8.4, "plasma", 1, "A ring of thorns around the druid.", { power: 0.7, radius: 62, slow: 1.2 })
    },
    bard: {
      id: "bard", name: "Bard", renown: 40, trait: "wild",
      blurb: "A song that lifts the party, then a sour note.",
      hp: 100, atk: 12, def: 2, speed: 108, radius: 14,
      range: 36, role: "support", attacks: ["atk1"], weapon: 5, run: "run",
      ability: A("anthem", "Anthem", "buff", 10, "spark", 1, "The party hits harder.", { power: 0.16, time: 4, team: true })
    },
    gunslinger: {
      id: "gunslinger", name: "Gunslinger", renown: 40, trait: "mark",
      blurb: "Fans the hammer, then a single heavy shot.",
      hp: 94, atk: 15, def: 2, speed: 128, radius: 13,
      range: 236, role: "kite", attacks: ["atk1"], weapon: 3, run: "run2",
      ability: A("fanfire", "Fanfire", "multishot", 8.6, "shot", 1, "Three shots, a little lighter.")
    },
    warlock: {
      id: "warlock", name: "Warlock", renown: 70, trait: "arcane",
      blurb: "A curse, then a bolt that travels.",
      hp: 88, atk: 21, def: 1, speed: 82, radius: 14,
      range: 208, role: "cast", attacks: ["cast1"],
      casts: ["cast1"], castTime: 0.92, castRadius: 60, weapon: 5, run: "run",
      ability: A("curse", "Curse", "dot", 7.2, "smoke", 1, "The target bleeds for a few beats.", { power: 0.32, dot: 3.6, reach: 230 })
    },
    samurai: {
      id: "samurai", name: "Samurai", renown: 70, trait: "blade",
      blurb: "One clean draw. The reply is a step through.",
      hp: 116, atk: 20, def: 3, speed: 134, radius: 14,
      range: 40, role: "melee", attacks: ["atk1", "atk3", "atk2"],
      airs: ["air1"], leaps: true, weapon: 1, run: "run2",
      ability: A("drawcut", "Draw Cut", "lunge", 7.4, "slash", 1, "A harder lunge at the fighter in front.")
    },
    spearmaiden: {
      id: "spearmaiden", name: "Spearmaiden", renown: 15, trait: "blade",
      blurb: "A long point and a charge that starts early.",
      hp: 136, atk: 18, def: 4, speed: 122, radius: 15,
      range: 52, role: "melee", attacks: ["atk3", "atk1", "atk2"],
      airs: ["air1"], leaps: true, weapon: 1, run: "run",
      ability: A("drive", "Drive", "charge", 8, "dash", 1, "A charge that hits harder on the way in.")
    },
    summoner: {
      id: "summoner", name: "Summoner", renown: 70, trait: "arcane",
      blurb: "Calls a familiar, then shields it.",
      hp: 86, atk: 15, def: 1, speed: 76, radius: 14,
      range: 188, role: "cast", attacks: ["cast1"],
      casts: ["cast1"], castTime: 1.1, castRadius: 52, weapon: 5, run: "run",
      ability: A("familiar", "Familiar", "summon", 13, "plasma", 1, "A familiar fights beside them for a few seconds.", { pet: "Familiar", petHp: 0.26, petAtk: 0.42, life: 6.5 })
    },
    alchemist: {
      id: "alchemist", name: "Alchemist", renown: 40, trait: "wild",
      blurb: "Throws a vial. The next one burns.",
      hp: 98, atk: 14, def: 2, speed: 104, radius: 14,
      range: 46, role: "hybrid", attacks: ["atk1"], weapon: 5, run: "run",
      ability: A("vial", "Vial", "vial", 6.8, "boom", 1, "A thrown flask.", { reach: 220, power: 0.85 })
    },
    beastmaster: {
      id: "beastmaster", name: "Beastmaster", renown: 70, trait: "wild",
      blurb: "Whistles a hound in, then hits with the pack.",
      hp: 134, atk: 15, def: 3, speed: 114, radius: 15,
      range: 40, role: "melee", attacks: ["atk1", "atk2"],
      weapon: 2, run: "run",
      ability: A("hound", "Hound", "summon", 14, "smoke", 1, "A hound joins the fight for a few seconds.", { pet: "Hound", petHp: 0.3, petAtk: 0.4, life: 6 })
    }
  };

  Object.keys(EXTRA).forEach(function (id) { CLASSES[id] = EXTRA[id]; });

  give("warrior", "blade",
    A("brace", "Brace", "shield", 11, "orbit", 4, "A small shield when the line bends.", { power: 0.1 }),
    A("rally", "Rally", "buff", 13, "spark", 7, "Hits land harder for a few seconds.", { power: 0.14, time: 4 }));
  give("archer", "mark",
    A("pin", "Pinning Shot", "debuff", 9.5, "shot", 4, "The target slows.", { reach: 280, time: 2.2 }),
    A("deadeye", "Deadeye", "pierce", 11, "shot", 7, "One shot that keeps going."));
  giveCast("mage", "arcane",
    A("mana-shield", "Mana Shield", "shield", 12, "plasma", 7, "A shield after the chants.", { power: 0.12 }));
  give("tank", "guardian",
    A("shove", "Shove", "knock", 9, "slash", 4, "Knocks the nearest fighter back.", { force: 240, power: 0.35 }),
    A("bulwark", "Bulwark", "shield", 12, "orbit", 7, "A thicker shield on themselves.", { power: 0.14, self: true }));
  give("rogue", "blade",
    A("nick", "Nick", "dot", 8, "slash", 4, "A cut that keeps bleeding.", { power: 0.22, dot: 3, reach: 48 }),
    A("vanish", "Vanish", "shadowstep", 10, "smoke", 7, "Steps behind and the next cut bites."));
  give("lancer", "blade",
    A("brace-point", "Brace Point", "knock", 9.2, "slash", 4, "The point shoves them off.", { force: 260, power: 0.4, reach: 64 }),
    A("sweep", "Sweep", "cleave", 11, "slash", 7, "A wide cut at the end of the charge."));
  give("berserker", "blade",
    A("howl", "Howl", "buff", 10, "spark", 4, "A short burst of harder hits.", { power: 0.12, time: 3.5 }),
    A("wreck", "Wreck", "cleave", 11, "slash", 7, "A heavy cleave when they are in range."));
  give("healer", "oath",
    A("shelter", "Shelter", "shield", 10, "plasma", 4, "A shield on the most wounded ally.", { power: 0.1 }),
    A("chorus", "Chorus", "buff", 12, "spark", 7, "The party hits a little harder.", { power: 0.1, time: 4, team: true }));
  give("assassin", "blade",
    A("poison", "Poison", "dot", 7.5, "smoke", 4, "The cut keeps working.", { power: 0.26, dot: 3.2, reach: 46 }),
    A("execute", "Execute", "lunge", 10, "slash", 7, "A deeper lunge from behind."));
  give("ranger", "mark",
    A("snare", "Snare", "debuff", 9, "shot", 4, "A shot that slows.", { reach: 260, time: 2.4 }),
    A("triple", "Triple", "multishot", 12, "shot", 7, "Three arrows, lighter than a single shot."));
  give("battlemage", "arcane",
    A("ward-step", "Ward Step", "shield", 10, "plasma", 4, "A thin shield after the burst.", { power: 0.1 }),
    A("overload", "Overload", "nova", 12, "bolt", 7, "A hotter burst up close.", { power: 0.85, radius: 64 }));
  give("shieldbearer", "guardian",
    A("bash", "Bash", "stun", 10, "orbit", 4, "The shield rings. They stop for a beat.", { stun: 0.5, power: 0.3, reach: 52 }),
    A("anchor", "Anchor", "shield", 12, "orbit", 7, "A shield while the guard is planted.", { power: 0.12, self: true }));
  give("skirmisher", "mark",
    A("snap", "Snap Shot", "vial", 7.5, "shot", 4, "A quick shot on the way out.", { reach: 220, power: 0.7 }),
    A("fade", "Fade", "shadowstep", 11, "dash", 7, "A short step off the line."));
  give("duelist", "blade",
    A("riposte-cut", "Reply", "lunge", 8.5, "slash", 4, "The answer is a sharper cut."),
    A("flourish", "Flourish", "buff", 12, "spark", 7, "A brief run of harder hits.", { power: 0.12, time: 3.5 }));
  giveCast("elementalist", "arcane",
    A("prism", "Prism", "shield", 12, "plasma", 7, "The cycle leaves a shield.", { power: 0.12 }));

  CLASSES.monk.abilities = [
    CLASSES.monk.ability,
    A("inner", "Inner Fire", "heal", 9, "plasma", 4, "Mends the most wounded ally.", { power: 0.16 }),
    A("whirl", "Whirl", "cleave", 11, "slash", 7, "A spinning cut at anyone in reach.")
  ];
  CLASSES.necromancer.abilities = [
    CLASSES.necromancer.ability,
    A("bone", "Bone", "summon", 14, "smoke", 4, "A bone stands up for a few seconds.", { pet: "Bone", petHp: 0.24, petAtk: 0.38, life: 6 }),
    A("grasp", "Grasp", "debuff", 10, "plasma", 7, "Slows whoever is in the chant.", { reach: 220, time: 2.4 })
  ];
  CLASSES.paladin.abilities = [
    CLASSES.paladin.ability,
    A("lay-on", "Lay On", "heal", 8.5, "plasma", 4, "Mends the most wounded ally.", { power: 0.18 }),
    A("rebuke", "Rebuke", "stun", 11, "orbit", 7, "A stun on the fighter in front.", { stun: 0.5, power: 0.35, reach: 52 })
  ];
  CLASSES.druid.abilities = [
    CLASSES.druid.ability,
    A("regrowth", "Regrowth", "heal", 8, "plasma", 4, "A mend that prefers the worst wound.", { power: 0.2 }),
    A("entangle", "Entangle", "debuff", 11, "smoke", 7, "Roots the target for a moment.", { reach: 180, time: 2.2 })
  ];
  CLASSES.bard.abilities = [
    CLASSES.bard.ability,
    A("discord", "Discord", "debuff", 9, "spark", 4, "A sour note that slows.", { reach: 200, time: 2.2 }),
    A("encore", "Encore", "heal", 11, "plasma", 7, "A small mend on the worst wound.", { power: 0.16 })
  ];
  CLASSES.gunslinger.abilities = [
    CLASSES.gunslinger.ability,
    A("roll-shot", "Roll Shot", "skirmish", 8, "dash", 4, "Steps in, fires, steps out."),
    A("bullseye", "Bullseye", "pierce", 11, "shot", 7, "One shot that keeps going.")
  ];
  CLASSES.warlock.abilities = [
    CLASSES.warlock.ability,
    A("hexbolt", "Hex Bolt", "bolt", 9, "bolt", 4, "A bolt that travels.", { power: 1.05, reach: 240 }),
    A("dread", "Dread", "debuff", 12, "smoke", 7, "They move slower under the hex.", { reach: 230, time: 2.6 })
  ];
  CLASSES.samurai.abilities = [
    CLASSES.samurai.ability,
    A("step-through", "Step Through", "charge", 9, "dash", 4, "A short charge through the gap."),
    A("iaijutsu", "Iai", "buff", 12, "spark", 7, "The next cuts are cleaner.", { power: 0.14, time: 3.5 })
  ];
  CLASSES.spearmaiden.abilities = [
    CLASSES.spearmaiden.ability,
    A("vault", "Vault", "lunge", 8.6, "slash", 4, "A leaping point."),
    A("phalanx", "Phalanx", "shield", 12, "orbit", 7, "A shield after the charge.", { power: 0.1, self: true })
  ];
  CLASSES.summoner.abilities = [
    CLASSES.summoner.ability,
    A("link", "Link", "shield", 10, "plasma", 4, "A shield shared with the familiar.", { power: 0.1 }),
    A("bolt-call", "Call Bolt", "bolt", 11, "bolt", 7, "A bolt while the familiar holds them.", { power: 0.95, reach: 220 })
  ];
  CLASSES.alchemist.abilities = [
    CLASSES.alchemist.ability,
    A("acid", "Acid", "dot", 8.2, "smoke", 4, "The flask keeps burning.", { power: 0.24, dot: 3.2, reach: 200 }),
    A("tonic-toss", "Tonic", "heal", 11, "plasma", 7, "A thrown tonic on the worst wound.", { power: 0.18 })
  ];
  CLASSES.beastmaster.abilities = [
    CLASSES.beastmaster.ability,
    A("maul", "Maul", "cleave", 9, "slash", 4, "A wide hit beside the hound."),
    A("pack-howl", "Pack Howl", "buff", 12, "spark", 7, "The pack hits harder for a moment.", { power: 0.12, time: 4 })
  ];

  const NEW_PASSIVE = {
    monk: { id: "open-hand", name: "Open Hand", blurb: "A short stun lasts a little longer." },
    necromancer: { id: "grave-cold", name: "Grave Cold", blurb: "Bleeds they start tick a little harder." },
    paladin: { id: "oath-arm", name: "Oath Arm", blurb: "The guard they raise is a little thicker." },
    druid: { id: "green-blood", name: "Green Blood", blurb: "Their mends take a little better." },
    bard: { id: "encore-note", name: "Encore", blurb: "A song they start hangs on a little longer." },
    gunslinger: { id: "quick-draw", name: "Quick Draw", blurb: "The first shot comes out cleaner." },
    warlock: { id: "hex-mark", name: "Hex Mark", blurb: "A curse they lay bites a little deeper." },
    samurai: { id: "still-blade", name: "Still Blade", blurb: "The draw cut is a little sharper." },
    spearmaiden: { id: "long-point", name: "Long Point", blurb: "The charge reaches a step farther." },
    summoner: { id: "tether", name: "Tether", blurb: "The familiar stays up a little longer." },
    alchemist: { id: "steady-hand", name: "Steady Hand", blurb: "A thrown flask lands a little harder." },
    beastmaster: { id: "pack-sense", name: "Pack Sense", blurb: "The hound hits a little harder." }
  };

  /* Packed Time Fantasy columns these rows play. item and evade reuse crouch and walk. */
  const ABILITY_ROWS = {
    swing: { clip: "atk1", hold: 0.5 },
    thrust: { clip: "atk3", hold: 0.3 },
    missile: { clip: "atk1", hold: 0.44, shot: true },
    skill: { clip: "atk2", hold: 0.4 },
    spell: { clip: "cast1", hold: 0.7 },
    item: { clip: "block", hold: 0.46 },
    evade: { clip: "dash", hold: 0.32 }
  };
  const KIND_ROW = {
    cleave: "swing", lunge: "thrust", multishot: "missile", pierce: "missile", vial: "missile",
    taunt: "skill", zone: "skill", rage: "skill", buff: "skill",
    mend: "item", heal: "item", shield: "item",
    shadowstep: "evade", charge: "evade", skirmish: "evade",
    arc: "spell", nova: "spell", bolt: "spell", frost: "spell", fireball: "spell",
    dot: "thrust", debuff: "skill", stun: "thrust", knock: "thrust", summon: "spell"
  };
  const KIND_TAGS = {
    cleave: ["AoE"], nova: ["AoE"], arc: ["AoE"], zone: ["AoE"], frost: ["AoE"], fireball: ["AoE"],
    multishot: ["AoE"], rage: ["AoE"],
    dot: ["DoT"],
    mend: ["Heal"], heal: ["Heal"], shield: ["Heal"], buff: ["Heal"],
    stun: ["CC"], knock: ["CC"], debuff: ["CC"], taunt: ["CC"],
    shadowstep: ["Mobility"], charge: ["Mobility"], skirmish: ["Mobility"], lunge: ["Mobility"],
    summon: ["Summon"],
    pierce: ["AoE"], bolt: ["AoE"], vial: ["AoE"]
  };

  function stampMove(ab) {
    if (!ab || !ab.id) return ab;
    if (!ab.row) ab.row = KIND_ROW[ab.kind] || "skill";
    if (!ab.tags || !ab.tags.length) ab.tags = KIND_TAGS[ab.kind] || ["AoE"];
    if (ab.unlock === 7) ab.ult = true;
    const spec = ABILITY_ROWS[ab.row] || ABILITY_ROWS.skill;
    ab.wind = spec.hold + (IL.hashStr(ab.id) % 5) * 0.04;
    return ab;
  }

  function M(id, name, kind, cd, fx, row, tags, blurb, extra) {
    const ab = A(id, name, kind, cd, fx, 99, blurb, extra);
    ab.row = row;
    ab.tags = tags;
    return stampMove(ab);
  }

  /* Four more moves per kit. Unlock 99 means learned, not given at level 1. */
  const MORE = {
    warrior: [
      M("w-guard-cut", "Guard Cut", "cleave", 9.6, "slash", "swing", ["AoE"], "A second wide cut."),
      M("w-shoulder", "Shoulder", "knock", 10.2, "slash", "thrust", ["CC"], "Shoves the nearest fighter off the line.", { force: 200, power: 0.3 }),
      M("w-wind", "Second Wind", "heal", 12, "plasma", "item", ["Heal"], "A breath when the line bends.", { power: 0.12 }),
      M("w-rush", "Rush", "charge", 11, "dash", "evade", ["Mobility"], "Closes the gap.")
    ],
    archer: [
      M("a-split", "Split", "multishot", 10, "shot", "missile", ["AoE"], "A wider pair of arrows."),
      M("a-hobble", "Hobble", "debuff", 9.2, "shot", "missile", ["CC"], "The arrow slows them.", { reach: 280, time: 2 }),
      M("a-cover", "Cover", "shadowstep", 11, "dash", "evade", ["Mobility"], "A step back off the line."),
      M("a-mark", "Mark", "pierce", 10.5, "shot", "missile", ["AoE"], "One arrow that keeps going.")
    ],
    mage: [
      M("m-shard", "Shard", "bolt", 9, "bolt", "spell", ["AoE"], "A quick bolt between chants.", { power: 0.8, reach: 220 }),
      M("m-rime", "Rime", "debuff", 10, "plasma", "spell", ["CC"], "The air slows whoever it touches.", { reach: 200, time: 2 }),
      M("m-ward", "Ward", "shield", 11, "plasma", "item", ["Heal"], "A thin shield after the chant.", { power: 0.1, self: true }),
      M("m-flare", "Flare", "nova", 12, "boom", "spell", ["AoE"], "A short burst up close.", { power: 0.7, radius: 60 })
    ],
    tank: [
      M("t-bell", "Bell", "stun", 11, "orbit", "skill", ["CC"], "The shield rings. They stop.", { stun: 0.45, power: 0.25, reach: 52 }),
      M("t-plant", "Plant", "zone", 12, "orbit", "item", ["AoE"], "A short guard planted at their feet."),
      M("t-haul", "Haul", "knock", 9.4, "slash", "thrust", ["CC"], "Pulls the fight back a step.", { force: 180, power: 0.25 }),
      M("t-iron", "Iron", "shield", 11, "orbit", "item", ["Heal"], "A thicker shield on themselves.", { power: 0.12, self: true })
    ],
    rogue: [
      M("r-slice", "Slice", "dot", 8.4, "slash", "thrust", ["DoT"], "A quick cut that keeps working.", { power: 0.2, dot: 2.6, reach: 46 }),
      M("r-flip", "Flip", "skirmish", 9, "dash", "evade", ["Mobility"], "In, a nick, and out."),
      M("r-smoke", "Smoke", "debuff", 10, "smoke", "item", ["CC"], "They lose a step in the smoke.", { reach: 160, time: 1.8 }),
      M("r-kidney", "Kidney", "stun", 11, "slash", "thrust", ["CC"], "A short stop up close.", { stun: 0.4, power: 0.3, reach: 42 })
    ],
    lancer: [
      M("l-jab", "Jab", "lunge", 8.2, "slash", "thrust", ["Mobility"], "A short point."),
      M("l-pin", "Pin", "debuff", 9.5, "slash", "thrust", ["CC"], "The point holds them.", { reach: 70, time: 1.8 }),
      M("l-line", "Line", "knock", 10, "slash", "swing", ["CC"], "The shaft shoves a crowd back.", { force: 220, power: 0.3, reach: 64 }),
      M("l-banner", "Banner", "buff", 12, "spark", "skill", ["Heal"], "The line hits a little harder.", { power: 0.1, time: 3.5 })
    ],
    berserker: [
      M("b-rend", "Rend", "dot", 8.6, "slash", "swing", ["DoT"], "A tear that keeps bleeding.", { power: 0.22, dot: 2.8, reach: 48 }),
      M("b-roar", "Roar", "taunt", 10, "spark", "skill", ["CC"], "They turn to the roar."),
      M("b-crash", "Crash", "cleave", 11, "slash", "swing", ["AoE"], "A heavy cut at anyone close."),
      M("b-leap", "Leap", "charge", 10, "dash", "evade", ["Mobility"], "A jump into the pack.")
    ],
    healer: [
      M("h-salve", "Salve", "heal", 8, "plasma", "item", ["Heal"], "A quick mend.", { power: 0.14 }),
      M("h-veil", "Veil", "shield", 10, "plasma", "spell", ["Heal"], "A veil on the most wounded.", { power: 0.1 }),
      M("h-calm", "Calm", "debuff", 9.5, "spark", "skill", ["CC"], "The next step is slower.", { reach: 180, time: 2 }),
      M("h-hymn", "Hymn", "buff", 12, "spark", "spell", ["Heal"], "The party hits a little harder.", { power: 0.08, time: 3.5, team: true })
    ],
    assassin: [
      M("s-needle", "Needle", "dot", 7.8, "smoke", "thrust", ["DoT"], "A thin poison.", { power: 0.24, dot: 3, reach: 44 }),
      M("s-slip", "Slip", "shadowstep", 9.4, "smoke", "evade", ["Mobility"], "Another step behind."),
      M("s-garrote", "Garrote", "stun", 11, "slash", "thrust", ["CC"], "They stop for a beat.", { stun: 0.4, power: 0.28, reach: 40 }),
      M("s-fan", "Fan", "vial", 8.8, "shot", "missile", ["AoE"], "A thrown knife.", { reach: 200, power: 0.7 })
    ],
    ranger: [
      M("n-fork", "Fork", "multishot", 10.5, "shot", "missile", ["AoE"], "Two arrows, lighter."),
      M("n-root", "Root", "debuff", 9, "shot", "missile", ["CC"], "The shot pins their feet.", { reach: 260, time: 2.2 }),
      M("n-step", "Step Aside", "skirmish", 9.2, "dash", "evade", ["Mobility"], "A sidestep and a shot."),
      M("n-heart", "Heart", "pierce", 11, "shot", "missile", ["AoE"], "One heavy arrow.")
    ],
    battlemage: [
      M("bm-spark", "Spark", "bolt", 8.8, "bolt", "spell", ["AoE"], "A close bolt.", { power: 0.75, reach: 140 }),
      M("bm-shell", "Shell", "shield", 10, "plasma", "item", ["Heal"], "A shell after the burst.", { power: 0.1, self: true }),
      M("bm-lash", "Lash", "cleave", 9.5, "slash", "swing", ["AoE"], "The staff comes around."),
      M("bm-blink", "Blink", "shadowstep", 11, "plasma", "evade", ["Mobility"], "A short blink off the line.")
    ],
    shieldbearer: [
      M("sb-wall", "Wall", "shield", 10, "orbit", "item", ["Heal"], "A wall on themselves.", { power: 0.12, self: true }),
      M("sb-shove", "Shove", "knock", 9, "orbit", "thrust", ["CC"], "The shield pushes.", { force: 200, power: 0.28, reach: 52 }),
      M("sb-taunt", "Call", "taunt", 10, "orbit", "skill", ["CC"], "They have to answer."),
      M("sb-brace", "Brace", "zone", 12, "orbit", "skill", ["AoE"], "A wider plant.")
    ],
    skirmisher: [
      M("k-pop", "Pop", "vial", 7.2, "shot", "missile", ["AoE"], "A snap shot.", { reach: 210, power: 0.65 }),
      M("k-roll", "Roll", "skirmish", 8.4, "dash", "evade", ["Mobility"], "Through and out."),
      M("k-net", "Net", "debuff", 9.4, "shot", "missile", ["CC"], "The shot slows.", { reach: 200, time: 2 }),
      M("k-fan", "Fan", "multishot", 11, "shot", "missile", ["AoE"], "A short fan of shots.")
    ],
    duelist: [
      M("d-feint", "Feint", "lunge", 8, "slash", "thrust", ["Mobility"], "A lighter reply."),
      M("d-bind", "Bind", "debuff", 9.2, "slash", "skill", ["CC"], "The blade checks their step.", { reach: 48, time: 1.6 }),
      M("d-riposte", "Riposte", "stun", 11, "slash", "thrust", ["CC"], "The answer stops them.", { stun: 0.35, power: 0.3, reach: 44 }),
      M("d-salute", "Salute", "buff", 12, "spark", "skill", ["Heal"], "A cleaner run of cuts.", { power: 0.1, time: 3 })
    ],
    elementalist: [
      M("e-cinder", "Cinder", "dot", 8.4, "boom", "spell", ["DoT"], "The spark keeps burning.", { power: 0.22, dot: 2.8, reach: 200 }),
      M("e-gust", "Gust", "knock", 9.6, "plasma", "spell", ["CC"], "A shove of air.", { force: 200, power: 0.25, reach: 180 }),
      M("e-prism", "Lens", "shield", 11, "plasma", "item", ["Heal"], "The cycle leaves a lens.", { power: 0.1, self: true }),
      M("e-storm", "Storm", "nova", 12, "bolt", "spell", ["AoE"], "A tight storm.", { power: 0.75, radius: 64 })
    ],
    monk: [
      M("mk-palm2", "Echo Palm", "stun", 9, "spark", "thrust", ["CC"], "A second palm.", { stun: 0.4, power: 0.35, reach: 40 }),
      M("mk-kick", "Kick", "knock", 8.8, "slash", "swing", ["CC"], "A kick that sends them back.", { force: 210, power: 0.32, reach: 46 }),
      M("mk-breath", "Breath", "heal", 10, "plasma", "item", ["Heal"], "A breath for the worst wound.", { power: 0.14 }),
      M("mk-step", "Still Step", "shadowstep", 10, "dash", "evade", ["Mobility"], "A step through the gap.")
    ],
    necromancer: [
      M("nc-bite", "Bite", "dot", 8, "smoke", "spell", ["DoT"], "A second bite.", { power: 0.26, dot: 3, reach: 200 }),
      M("nc-wail", "Wail", "debuff", 9.5, "plasma", "spell", ["CC"], "The wail slows them.", { reach: 210, time: 2.2 }),
      M("nc-bone2", "Second Bone", "summon", 14, "smoke", "spell", ["Summon"], "Another bone, if the first has fallen.", { pet: "Bone", petHp: 0.22, petAtk: 0.34, life: 5.5 }),
      M("nc-shroud", "Shroud", "shield", 11, "smoke", "item", ["Heal"], "A shroud on themselves.", { power: 0.1, self: true })
    ],
    paladin: [
      M("p-smite", "Smite", "stun", 10, "orbit", "swing", ["CC"], "A smite that stops them.", { stun: 0.45, power: 0.32, reach: 50 }),
      M("p-mend2", "Mercy", "heal", 8.2, "plasma", "item", ["Heal"], "A second mend.", { power: 0.16 }),
      M("p-charge", "Charge", "charge", 10, "dash", "evade", ["Mobility"], "A short charge in."),
      M("p-aura", "Aura", "buff", 12, "spark", "skill", ["Heal"], "The party hits a little harder.", { power: 0.08, time: 3.5, team: true })
    ],
    druid: [
      M("dr-bark", "Bark", "shield", 9.5, "plasma", "item", ["Heal"], "Bark on the worst wound.", { power: 0.1 }),
      M("dr-swarm", "Swarm", "dot", 8.6, "smoke", "spell", ["DoT"], "Thorns that keep working.", { power: 0.2, dot: 2.6, reach: 150 }),
      M("dr-root", "Root", "stun", 11, "smoke", "spell", ["CC"], "Roots hold them.", { stun: 0.45, power: 0.25, reach: 160 }),
      M("dr-form", "Form", "buff", 12, "spark", "skill", ["Heal"], "A short wilder strength.", { power: 0.12, time: 3.5 })
    ],
    bard: [
      M("bd-note", "Sour Note", "debuff", 8.6, "spark", "skill", ["CC"], "Another sour note.", { reach: 190, time: 2 }),
      M("bd-chord", "Chord", "heal", 9, "plasma", "spell", ["Heal"], "A chord for the worst wound.", { power: 0.14 }),
      M("bd-jig", "Jig", "buff", 11, "spark", "skill", ["Mobility"], "The next steps hit harder.", { power: 0.1, time: 3.5 }),
      M("bd-shout", "Shout", "taunt", 10, "spark", "skill", ["CC"], "They look at the song.")
    ],
    gunslinger: [
      M("g-hip", "Hip Shot", "vial", 7, "shot", "missile", ["AoE"], "A fast hip shot.", { reach: 220, power: 0.62 }),
      M("g-fan2", "Second Fan", "multishot", 10, "shot", "missile", ["AoE"], "Another three, lighter."),
      M("g-dive", "Dive", "skirmish", 8.5, "dash", "evade", ["Mobility"], "A dive and a shot."),
      M("g-brand", "Brand", "dot", 9, "boom", "missile", ["DoT"], "A shot that keeps burning.", { power: 0.2, dot: 2.4, reach: 220 })
    ],
    warlock: [
      M("wl-leech", "Leech", "dot", 8, "smoke", "spell", ["DoT"], "A deeper curse.", { power: 0.28, dot: 3.2, reach: 220 }),
      M("wl-fear", "Fear", "debuff", 10, "smoke", "spell", ["CC"], "They move slower.", { reach: 220, time: 2.4 }),
      M("wl-imp", "Imp", "summon", 14, "plasma", "spell", ["Summon"], "A small imp, briefly.", { pet: "Imp", petHp: 0.22, petAtk: 0.36, life: 5.5 }),
      M("wl-pact", "Pact", "shield", 11, "plasma", "item", ["Heal"], "The pact leaves a shield.", { power: 0.1, self: true })
    ],
    samurai: [
      M("sm-draw2", "Second Draw", "lunge", 8, "slash", "thrust", ["Mobility"], "Another draw."),
      M("sm-cut", "Cross Cut", "cleave", 10, "slash", "swing", ["AoE"], "A crossing cut."),
      M("sm-guard", "Guard", "shield", 11, "orbit", "item", ["Heal"], "The sheath comes up.", { power: 0.1, self: true }),
      M("sm-pace", "Pace", "charge", 9.5, "dash", "evade", ["Mobility"], "A measured step through.")
    ],
    spearmaiden: [
      M("sp-thrust", "Thrust", "lunge", 8, "slash", "thrust", ["Mobility"], "A longer point."),
      M("sp-sweep", "Sweep", "cleave", 10, "slash", "swing", ["AoE"], "The spear comes around."),
      M("sp-brace", "Brace", "knock", 9.4, "slash", "thrust", ["CC"], "The butt of the spear.", { force: 220, power: 0.3, reach: 60 }),
      M("sp-cry", "Cry", "buff", 12, "spark", "skill", ["Heal"], "A cry that steadies the cut.", { power: 0.1, time: 3 })
    ],
    summoner: [
      M("su-second", "Second Call", "summon", 14, "plasma", "spell", ["Summon"], "Calls again once the first is gone.", { pet: "Familiar", petHp: 0.24, petAtk: 0.38, life: 6 }),
      M("su-bolt", "Dart", "bolt", 9, "bolt", "spell", ["AoE"], "A dart while they hold.", { power: 0.85, reach: 210 }),
      M("su-ward", "Ward", "shield", 10, "plasma", "item", ["Heal"], "A ward on themselves.", { power: 0.1, self: true }),
      M("su-slow", "Bind", "debuff", 10, "plasma", "spell", ["CC"], "The call slows them.", { reach: 200, time: 2.2 })
    ],
    alchemist: [
      M("al-burn", "Burn", "dot", 8, "boom", "missile", ["DoT"], "A flask that keeps burning.", { power: 0.22, dot: 2.8, reach: 200 }),
      M("al-smoke", "Smoke Flask", "debuff", 9, "smoke", "item", ["CC"], "Smoke that slows.", { reach: 190, time: 2 }),
      M("al-draught", "Draught", "heal", 10, "plasma", "item", ["Heal"], "A draught for the worst wound.", { power: 0.16 }),
      M("al-bang", "Bang", "nova", 11, "boom", "spell", ["AoE"], "The mix pops.", { power: 0.7, radius: 58 })
    ],
    beastmaster: [
      M("bt-whistle", "Whistle", "summon", 14, "smoke", "skill", ["Summon"], "Another hound if the first is down.", { pet: "Hound", petHp: 0.26, petAtk: 0.36, life: 5.5 }),
      M("bt-lunge", "Lunge", "lunge", 8.4, "slash", "thrust", ["Mobility"], "In beside the hound."),
      M("bt-snare", "Snare", "debuff", 9.2, "slash", "skill", ["CC"], "A snare on the nearest.", { reach: 70, time: 2 }),
      M("bt-hide", "Hide", "shield", 11, "orbit", "item", ["Heal"], "A hide on themselves.", { power: 0.1, self: true })
    ]
  };

  Object.keys(MORE).forEach(function (id) {
    const kit = CLASSES[id];
    if (!kit || !kit.abilities) return;
    kit.abilities = kit.abilities.concat(MORE[id]);
  });

  Object.keys(CLASSES).forEach(function (id) {
    const kit = CLASSES[id];
    if (kit.role === "kite") kit.attack = "shot";
    else if (kit.role === "cast") kit.attack = "bolt";
    else kit.attack = "combo";
    if (!kit.passive && NEW_PASSIVE[id]) kit.passive = NEW_PASSIVE[id];
    (kit.abilities || []).forEach(stampMove);
  });

  const byId = {};
  Object.keys(CLASSES).forEach(function (id) {
    const list = CLASSES[id].abilities || [];
    list.forEach(function (ab) { if (ab && ab.id) byId[ab.id] = ab; });
  });

  const TRAITS = {
    arcane: { id: "arcane", name: "Arcane", need: 2, blurb: "Spells hit harder." },
    guardian: { id: "guardian", name: "Guardian", need: 2, blurb: "The party starts with a shield." },
    blade: { id: "blade", name: "Blade", need: 2, blurb: "Cuts land harder." },
    mark: { id: "mark", name: "Mark", need: 2, blurb: "Shots reach a little farther." },
    wild: { id: "wild", name: "Wild", need: 2, blurb: "The party mends a little between hits." },
    oath: { id: "oath", name: "Oath", need: 2, blurb: "Mends and guards land stronger." }
  };

  const CLUB_THEMES = {
    "Ashveil Company": ["warrior", "shieldbearer", "paladin"],
    "Red Kettle": ["berserker", "warrior", "samurai"],
    "Lowmarket Blades": ["rogue", "assassin", "duelist"],
    "Cinder Pact": ["mage", "warlock", "elementalist"],
    "North Wharf": ["archer", "ranger", "gunslinger"],
    "Glass Orchard": ["bard", "healer", "druid"],
    "Mudgate Crew": ["skirmisher", "rogue", "alchemist"],
    "Harrow and Coil": ["necromancer", "summoner", "warlock"],
    "Salt Stair": ["lancer", "spearmaiden", "warrior"],
    "Penny Standard": ["tank", "shieldbearer", "monk"],
    "Bright Rust": ["gunslinger", "skirmisher", "alchemist"],
    "Hollow Lantern": ["necromancer", "mage", "bard"],
    "Copper Warden": ["paladin", "tank", "healer"],
    "Mile End": ["beastmaster", "druid", "ranger"],
    "Soot Choir": ["bard", "warlock", "elementalist"],
    "Gutter Saint": ["assassin", "rogue", "monk"],
    "Amber Yoke": ["spearmaiden", "lancer", "shieldbearer"],
    "Third Bell": ["monk", "healer", "paladin"]
  };

  function traitSummary(fighters) {
    const counts = {};
    (fighters || []).forEach(function (f) {
      if (!f) return;
      const kit = CLASSES[f.cls] || CLASSES.warrior;
      const id = kit.trait;
      if (!id || !TRAITS[id]) return;
      counts[id] = (counts[id] || 0) + 1;
    });
    return Object.keys(counts).map(function (id) {
      const def = TRAITS[id];
      return {
        id: id,
        name: def.name,
        count: counts[id],
        need: def.need,
        active: counts[id] >= def.need,
        blurb: def.blurb
      };
    });
  }

  function themedFighter(rng, clubName) {
    const theme = CLUB_THEMES[clubName];
    const cls = theme && theme.length ? theme[Math.floor(rng() * theme.length)] : null;
    return IL.randomFighter(rng, cls);
  }

  function abilitiesFor(cls, level) {
    const kit = CLASSES[cls] || CLASSES.warrior;
    const lv = level || 1;
    return (kit.abilities || []).filter(function (ab) { return ab && ab.unlock && ab.unlock <= lv && ab.unlock <= 7; });
  }

  function poolOf(cls) {
    const kit = CLASSES[cls] || CLASSES.warrior;
    return kit.abilities || [];
  }

  function starterIds(cls) {
    return poolOf(cls).filter(function (ab) { return ab && ab.unlock && ab.unlock <= 7; }).map(function (ab) { return ab.id; });
  }

  function ensureMoves(f) {
    if (!f || !f.cls) return f;
    const pool = poolOf(f.cls).map(function (ab) { return ab.id; });
    const starters = starterIds(f.cls);
    if (!Array.isArray(f.known)) f.known = starters.slice();
    f.known = f.known.filter(function (id) { return pool.indexOf(id) >= 0; });
    starters.forEach(function (id) {
      if (f.known.indexOf(id) < 0) f.known.push(id);
    });
    if (!Array.isArray(f.learned)) f.learned = [];
    f.learned = f.learned.filter(function (id) { return pool.indexOf(id) >= 0 && starters.indexOf(id) < 0; });
    f.learned.forEach(function (id) {
      if (f.known.indexOf(id) < 0) f.known.push(id);
    });
    if (!Array.isArray(f.loadout)) f.loadout = starters.slice(0, 3);
    f.loadout = f.loadout.filter(function (id) { return f.known.indexOf(id) >= 0; });
    starters.forEach(function (id) {
      if (f.loadout.length < 3 && f.loadout.indexOf(id) < 0) f.loadout.push(id);
    });
    f.loadout = f.loadout.slice(0, 3);
    if (typeof f.pendingMoves !== "number" || f.pendingMoves < 0) f.pendingMoves = 0;
    return f;
  }

  function teachMove(f, id) {
    ensureMoves(f);
    const pool = poolOf(f.cls).map(function (ab) { return ab.id; });
    if (pool.indexOf(id) < 0 || f.known.indexOf(id) >= 0) return false;
    f.known.push(id);
    if (f.learned.indexOf(id) < 0) f.learned.push(id);
    return true;
  }

  function learnFromLevel(f, id) {
    if (!f || !(f.pendingMoves > 0)) return false;
    if (!teachMove(f, id)) return false;
    f.pendingMoves -= 1;
    return true;
  }

  function moveChoices(f) {
    ensureMoves(f);
    const unknown = poolOf(f.cls).filter(function (ab) { return ab && f.known.indexOf(ab.id) < 0; });
    return unknown.slice(0, 3);
  }

  function equipMove(f, slot, id) {
    ensureMoves(f);
    if (f.known.indexOf(id) < 0) return false;
    const cur = f.loadout.slice();
    while (cur.length < 3) {
      const fill = f.known.filter(function (k) { return cur.indexOf(k) < 0; })[0];
      if (!fill) break;
      cur.push(fill);
    }
    const at = cur.indexOf(id);
    const i = slot === 0 || slot === 1 || slot === 2 ? slot : 0;
    if (at >= 0) {
      const tmp = cur[i];
      cur[i] = cur[at];
      cur[at] = tmp;
    } else cur[i] = id;
    f.loadout = cur.slice(0, 3);
    return true;
  }

  function attackOf(cls) {
    const kit = CLASSES[cls] || CLASSES.warrior;
    const weapon = (IL.CLASS_WEAPON && IL.CLASS_WEAPON[cls]) || "sword";
    if (kit.attack === "shot") {
      const gun = weapon === "gun";
      return { id: "shot", name: gun ? "Gunshot" : "Bow shot", blurb: gun ? "A shot from the gun." : "A shot from the bow." };
    }
    if (kit.attack === "bolt") return { id: "bolt", name: "Spell bolt", blurb: "A bolt at the end of the chant." };
    const named = {
      spear: "Spear thrust",
      dagger: "Dagger cut",
      axe: "Axe swing",
      mace: "Mace blow",
      fist: "Open hand",
      claw: "Claw rake",
      katana: "Draw cut",
      scythe: "Scythe sweep",
      staff: "Staff strike",
      wand: "Wand flick",
      book: "Page strike",
      sword: "Sword swing"
    };
    return { id: "combo", name: named[weapon] || "Melee combo", blurb: "A chain of swings." };
  }

  function tomeIds() {
    const ids = [];
    Object.keys(CLASSES).forEach(function (cid) {
      poolOf(cid).forEach(function (ab) {
        if (ab && ab.unlock >= 99 && ids.indexOf(ab.id) < 0) ids.push(ab.id);
      });
    });
    return ids;
  }

  const origRandom = IL.randomFighter;
  IL.randomFighter = function (rng, clsId) {
    return ensureMoves(origRandom(rng, clsId));
  };

  IL.CHAMPIONS.push(
    { name: "Brother Cal", cls: "monk" },
    { name: "Vesper Coil", cls: "necromancer" },
    { name: "Dame Holt", cls: "paladin" },
    { name: "Yarrow Moss", cls: "druid" },
    { name: "Lark Quinn", cls: "bard" },
    { name: "Nim Flint", cls: "gunslinger" },
    { name: "Old Hex", cls: "warlock" },
    { name: "Lord Reed", cls: "samurai" },
    { name: "Pike Una", cls: "spearmaiden" },
    { name: "Moth Glass", cls: "summoner" },
    { name: "Sable Vial", cls: "alchemist" },
    { name: "Houndmaster Grey", cls: "beastmaster" }
  );

  /* Presentation only. One signature move per class. Combat numbers stay put. */
  IL.SIGNATURES = {
    cleave: { style: "ring", mark: "band", sheet: "sig-shock", rgb: "232,148,72", cue: "swing_heavy", anchor: "self", r: 84, life: 0.7, size: 190 },
    multishot: { style: "trail", mark: "arrow", sheet: "sig-ice", rgb: "186,214,245", cue: "bow_draw", anchor: "foe", r: 14, life: 0.48, size: 110 },
    frost: { style: "ring", mark: "band", sheet: "sig-ice", rgb: "170,220,245", cue: "spell_ice_impact", anchor: "foe", r: 92, life: 0.72, size: 200 },
    fireball: { style: "trail", mark: "bolt", sheet: "sig-fire", rgb: "255,140,50", cue: "spell_fire_impact", anchor: "foe", r: 16, life: 0.5, size: 140 },
    shove: { style: "dust", mark: "forward", sheet: "sig-smoke", rgb: "196,168,120", cue: "swing_blunt", anchor: "foe", r: 36, life: 0.7, size: 150 },
    "rogue:shadowstep": { style: "trail", mark: "smoke", sheet: "sig-smoke", rgb: "176,130,220", cue: "spell_shadow_impact", anchor: "foe", r: 18, life: 0.46, size: 130 },
    charge: { style: "dust", mark: "back", sheet: "sig-shock", rgb: "220,200,160", cue: "hit_spear", anchor: "self", r: 40, life: 0.48, size: 160 },
    wreck: { style: "ring", mark: "band", sheet: "sig-fire", rgb: "255,70,36", cue: "swing_heavy", anchor: "self", r: 100, life: 0.74, size: 210 },
    mend: { style: "ring", mark: "soft", sheet: "sig-bloom", rgb: "140,210,120", cue: "spell_holy_cast", anchor: "ally", r: 54, life: 0.7, size: 170 },
    "assassin:shadowstep": { style: "dust", mark: "slash", sheet: "sig-hex", rgb: "140,60,80", cue: "hit_dagger", anchor: "self", r: 34, life: 0.46, size: 140 },
    pierce: { style: "trail", mark: "arrow", sheet: "sig-spark", rgb: "120,200,110", cue: "bow_release", anchor: "foe", r: 10, life: 0.55, size: 100 },
    arc: { style: "ring", mark: "spin", sheet: "sig-crack", rgb: "170,140,255", cue: "spell_lightning_impact", anchor: "foe", r: 64, life: 0.6, size: 170 },
    zone: { style: "shield", mark: "orbit", sheet: "sig-crack", rgb: "150,190,255", cue: "shield_up", anchor: "self", r: 74, life: 0.8, size: 180 },
    skirmish: { style: "trail", mark: "streak", sheet: "sig-spark", rgb: "255,200,90", cue: "gunshot", anchor: "foe", r: 12, life: 0.42, size: 110 },
    snap: { style: "trail", mark: "flask", sheet: "sig-fire", rgb: "255,210,80", cue: "hit_bullet", anchor: "foe", r: 14, life: 0.5, size: 120 },
    lunge: { style: "trail", mark: "slash", sheet: "sig-shock", rgb: "255,230,200", cue: "swing_blade", anchor: "foe", r: 22, life: 0.42, size: 150 },
    nova: { style: "ring", mark: "spike", sheet: "sig-bloom", rgb: "210,160,255", cue: "spell_arcane_impact", anchor: "foe", r: 76, life: 0.68, size: 190 },
    bolt: { style: "chain", mark: "warm", sheet: "sig-bolt", rgb: "255,180,80", cue: "spell_lightning_cast", anchor: "foe", r: 0, life: 0.68, size: 180 },
    palm: { style: "ring", mark: "spin", sheet: "sig-shock", rgb: "255,210,120", cue: "hit_fist", anchor: "foe", r: 50, life: 0.55, size: 150 },
    bone: { style: "summon", mark: "sigil", sheet: "sig-hex", rgb: "160,110,200", cue: "spell_shadow_cast", anchor: "pet", r: 48, life: 0.9, size: 170 },
    "lay-on": { style: "shield", mark: "cross", sheet: "sig-bloom", rgb: "255,220,140", cue: "spell_holy_cast", anchor: "ally", r: 56, life: 0.8, size: 160 },
    thorns: { style: "ring", mark: "spike", sheet: "sig-bloom", rgb: "70,170,70", cue: "spell_nature_impact", anchor: "foe", r: 68, life: 0.66, size: 180 },
    encore: { style: "ring", mark: "soft", sheet: "sig-spark", rgb: "255,170,200", cue: "spell_arcane_cast", anchor: "self", r: 90, life: 0.75, size: 190 },
    fanfire: { style: "trail", mark: "bolt", sheet: "sig-fire", rgb: "255,150,50", cue: "gunshot", anchor: "foe", r: 20, life: 0.45, size: 130 },
    hexbolt: { style: "chain", mark: "cold", sheet: "sig-bolt", rgb: "150,90,255", cue: "spell_lightning_cast", anchor: "foe", r: 0, life: 0.72, size: 190 },
    drawcut: { style: "trail", mark: "slash", sheet: "sig-crack", rgb: "255,244,220", cue: "swing_blade", anchor: "foe", r: 26, life: 0.4, size: 160 },
    drive: { style: "dust", mark: "back", sheet: "sig-ice", rgb: "180,210,230", cue: "hit_spear", anchor: "self", r: 42, life: 0.48, size: 150 },
    familiar: { style: "summon", mark: "sigil", sheet: "sig-hex", rgb: "120,180,255", cue: "spell_arcane_cast", anchor: "pet", r: 52, life: 0.9, size: 180 },
    vial: { style: "trail", mark: "flask", sheet: "sig-fire", rgb: "110,220,70", cue: "spell_poison_impact", anchor: "foe", r: 14, life: 0.66, size: 130 },
    hound: { style: "summon", mark: "beast", sheet: "sig-smoke", rgb: "180,130,70", cue: "spell_nature_cast", anchor: "pet", r: 50, life: 0.85, size: 170 }
  };

  IL.TRAITS = TRAITS;
  IL.CLUB_THEMES = CLUB_THEMES;
  IL.ABILITY_ROWS = ABILITY_ROWS;
  IL.abilityById = function (id) { return byId[id] || null; };
  IL.traitSummary = traitSummary;
  IL.themedFighter = themedFighter;
  IL.abilitiesFor = abilitiesFor;
  IL.ensureMoves = ensureMoves;
  IL.teachMove = teachMove;
  IL.learnFromLevel = learnFromLevel;
  IL.moveChoices = moveChoices;
  IL.equipMove = equipMove;
  IL.attackOf = attackOf;
  IL.tomeIds = tomeIds;
  IL.poolOf = poolOf;
})(typeof window !== "undefined" ? window : globalThis);
