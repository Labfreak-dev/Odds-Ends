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
      hp: 180, atk: 14, def: 7, speed: 76, radius: 16,
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
    A("entangle", "Entangle", "root", 11, "smoke", 7, "Roots the target for a moment.", { reach: 220, time: 2.2, power: 0.2 })
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
    dot: "thrust", debuff: "skill", stun: "thrust", knock: "thrust", summon: "spell",
    pull: "thrust", root: "spell", silence: "skill", chain: "spell", drain: "spell", revive: "item", homing: "missile"
  };
  const KIND_TAGS = {
    cleave: ["AoE"], nova: ["AoE"], arc: ["AoE"], zone: ["AoE"], frost: ["AoE"], fireball: ["AoE"],
    multishot: ["AoE"], rage: ["AoE"],
    dot: ["DoT"],
    mend: ["Heal"], heal: ["Heal"], shield: ["Heal"], buff: ["Heal"],
    stun: ["CC"], knock: ["CC"], debuff: ["CC"], taunt: ["CC"],
    shadowstep: ["Mobility"], charge: ["Mobility"], skirmish: ["Mobility"], lunge: ["Mobility"],
    summon: ["Summon"],
    pierce: ["AoE"], bolt: ["AoE"], vial: ["AoE"],
    pull: ["CC"], root: ["CC"], silence: ["CC"], chain: ["AoE"], drain: ["Heal"], revive: ["Heal"], homing: ["Damage"]
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
      M("a-mark", "Mark", "pierce", 10.5, "shot", "missile", ["AoE"], "One arrow that keeps going."),
      M("a-seek", "Seeker Arrow", "homing", 9.5, "shot", "missile", ["Damage"], "An arrow that turns to follow.", { power: 1.05, reach: 320 })
    ],
    mage: [
      M("m-shard", "Shard", "bolt", 9, "bolt", "spell", ["AoE"], "A quick bolt between chants.", { power: 0.8, reach: 220 }),
      M("m-rime", "Rime", "debuff", 10, "plasma", "spell", ["CC"], "The air slows whoever it touches.", { reach: 200, time: 2 }),
      M("m-ward", "Ward", "shield", 11, "plasma", "item", ["Heal"], "A thin shield after the chant.", { power: 0.1, self: true }),
      M("m-flare", "Flare", "nova", 12, "boom", "spell", ["AoE"], "A short burst up close.", { power: 0.7, radius: 60 }),
      M("m-seek", "Seeking Bolt", "homing", 9, "bolt", "spell", ["Damage"], "A bolt that hunts its mark.", { power: 1, reach: 320 })
    ],
    tank: [
      M("t-bell", "Bell", "stun", 11, "orbit", "skill", ["CC"], "The shield rings. They stop.", { stun: 0.45, power: 0.25, reach: 52 }),
      M("t-plant", "Plant", "zone", 12, "orbit", "item", ["AoE"], "A short guard planted at their feet."),
      M("t-haul", "Haul", "pull", 9.4, "slash", "thrust", ["CC"], "Drags a back-liner to the front.", { power: 0.25, reach: 280 }),
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
      M("h-hymn", "Hymn", "buff", 12, "spark", "spell", ["Heal"], "The party hits a little harder.", { power: 0.08, time: 3.5, team: true }),
      M("h-raise", "Raise", "revive", 26, "plasma", "item", ["Heal"], "Brings a fallen ally back.", { power: 0.3, ult: true })
    ],
    assassin: [
      M("s-needle", "Needle", "dot", 7.8, "smoke", "thrust", ["DoT"], "A thin poison.", { power: 0.24, dot: 3, reach: 44 }),
      M("s-slip", "Slip", "shadowstep", 9.4, "smoke", "evade", ["Mobility"], "Another step behind."),
      M("s-garrote", "Garrote", "stun", 11, "slash", "thrust", ["CC"], "They stop for a beat.", { stun: 0.4, power: 0.28, reach: 40 }),
      M("s-fan", "Fan", "vial", 8.8, "shot", "missile", ["AoE"], "A thrown knife.", { reach: 200, power: 0.7 })
    ],
    ranger: [
      M("n-fork", "Fork", "multishot", 10.5, "shot", "missile", ["AoE"], "Two arrows, lighter."),
      M("n-root", "Root", "root", 9, "shot", "missile", ["CC"], "The shot pins their feet.", { reach: 260, time: 1.5, power: 0.25 }),
      M("n-step", "Step Aside", "skirmish", 9.2, "dash", "evade", ["Mobility"], "A sidestep and a shot."),
      M("n-heart", "Heart", "pierce", 11, "shot", "missile", ["AoE"], "One heavy arrow.")
    ],
    battlemage: [
      M("bm-spark", "Spark", "bolt", 8.8, "bolt", "spell", ["AoE"], "A close bolt.", { power: 0.75, reach: 140 }),
      M("bm-shell", "Shell", "shield", 10, "plasma", "item", ["Heal"], "A shell after the burst.", { power: 0.1, self: true }),
      M("bm-lash", "Lash", "cleave", 9.5, "slash", "swing", ["AoE"], "The staff comes around."),
      M("bm-blink", "Blink", "shadowstep", 11, "plasma", "evade", ["Mobility"], "A short blink off the line."),
      M("bm-chain", "Chain Lightning", "chain", 10, "bolt", "spell", ["AoE"], "Lightning that leaps between them.", { power: 0.6, jumps: 2, reach: 240 })
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
      M("dr-root", "Root", "root", 11, "smoke", "spell", ["CC"], "Roots hold them.", { time: 2, power: 0.25, reach: 200 }),
      M("dr-form", "Form", "buff", 12, "spark", "skill", ["Heal"], "A short wilder strength.", { power: 0.12, time: 3.5 })
    ],
    bard: [
      M("bd-note", "Sour Note", "debuff", 8.6, "spark", "skill", ["CC"], "Another sour note.", { reach: 190, time: 2 }),
      M("bd-chord", "Chord", "heal", 9, "plasma", "spell", ["Heal"], "A chord for the worst wound.", { power: 0.14 }),
      M("bd-jig", "Jig", "buff", 11, "spark", "skill", ["Mobility"], "The next steps hit harder.", { power: 0.1, time: 3.5 }),
      M("bd-shout", "Shout", "taunt", 10, "spark", "skill", ["CC"], "They look at the song."),
      M("bd-hush", "Hush", "silence", 11, "spark", "skill", ["CC"], "A note that stops a spell.", { time: 2.5, power: 0.15, reach: 260 })
    ],
    gunslinger: [
      M("g-hip", "Hip Shot", "vial", 7, "shot", "missile", ["AoE"], "A fast hip shot.", { reach: 220, power: 0.62 }),
      M("g-fan2", "Second Fan", "multishot", 10, "shot", "missile", ["AoE"], "Another three, lighter."),
      M("g-dive", "Dive", "skirmish", 8.5, "dash", "evade", ["Mobility"], "A dive and a shot."),
      M("g-brand", "Brand", "dot", 9, "boom", "missile", ["DoT"], "A shot that keeps burning.", { power: 0.2, dot: 2.4, reach: 220 })
    ],
    warlock: [
      M("wl-leech", "Leech", "drain", 9, "smoke", "spell", ["Heal"], "Drinks their health.", { power: 0.55, reach: 220 }),
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

  /* v85: six more moves a kit, learned on level up. Same kinds and number
     bands as the moves each kit already has. */
  const MORE2 = {
    warrior: [
      M("x-warrior-hew", "Hew", "cleave", 10.4, "slash", null, [], "A wide two-handed hew."),
      M("x-warrior-pommel", "Pommel", "stun", 11, "slash", null, [], "The pommel to the jaw. A short stun.", { stun: 0.4, power: 0.3, reach: 42 }),
      M("x-warrior-war-cry", "War Cry", "buff", 12, "spark", null, [], "The line hits harder for a moment.", { power: 0.1, time: 3.5, team: true }),
      M("x-warrior-shield-slam", "Shield Slam", "knock", 10, "slash", null, [], "A shield slam that throws them back.", { force: 190, power: 0.28 }),
      M("x-warrior-gash", "Gash", "dot", 8.6, "slash", null, [], "A deep cut that keeps bleeding.", { power: 0.2, dot: 2.8, reach: 46 }),
      M("x-warrior-catch-breath", "Catch Breath", "heal", 12, "plasma", null, [], "Breath back and a little health.", { power: 0.12 })
    ],
    archer: [
      M("x-archer-volley", "Volley", "multishot", 10.5, "shot", null, [], "Three arrows into the crowd."),
      M("x-archer-barbed-shot", "Barbed Shot", "dot", 8.8, "shot", null, [], "An arrow that keeps them bleeding.", { power: 0.22, dot: 3, reach: 210 }),
      M("x-archer-long-draw", "Long Draw", "pierce", 11, "shot", null, [], "A full draw that goes through."),
      M("x-archer-hamstring", "Hamstring", "debuff", 9.4, "shot", null, [], "A shot at the legs. They slow down.", { reach: 280, time: 2.2 }),
      M("x-archer-fall-back", "Fall Back", "skirmish", 9.2, "dash", null, [], "A step back and a shot."),
      M("x-archer-blinding-shot", "Blinding Shot", "stun", 11, "shot", null, [], "A flash arrow. A short daze.", { stun: 0.4, power: 0.25, reach: 200 })
    ],
    mage: [
      M("x-mage-arcane-bolt", "Arcane Bolt", "bolt", 9, "bolt", null, [], "A straight bolt of raw mana.", { power: 0.8, reach: 220 }),
      M("x-mage-ember-rain", "Ember Rain", "nova", 12, "boom", null, [], "Embers fall on a cluster.", { power: 0.7, radius: 60 }),
      M("x-mage-slow-field", "Slow Field", "nova", 12.5, "plasma", null, [], "A field that slows whoever stands in it.", { power: 0.55, radius: 62, slow: 1.6 }),
      M("x-mage-blink", "Blink", "shadowstep", 10, "smoke", null, [], "A blink to safer ground."),
      M("x-mage-mana-leech", "Mana Leech", "dot", 8.6, "smoke", null, [], "A thread that drains them.", { power: 0.24, dot: 3, reach: 210 }),
      M("x-mage-silence", "Silence", "silence", 9.6, "spark", null, [], "A word that stalls their next move.", { reach: 260, time: 2.5, power: 0.2 })
    ],
    tank: [
      M("x-tank-bulwark-step", "Bulwark Step", "zone", 12, "orbit", null, [], "Plants and holds the ground."),
      M("x-tank-clang", "Clang", "stun", 11, "orbit", null, [], "The shield rings. Everyone near is dazed.", { stun: 0.45, power: 0.25, reach: 52 }),
      M("x-tank-grit", "Grit", "shield", 11, "plasma", null, [], "A guard on themselves.", { power: 0.1, self: true }),
      M("x-tank-challenge", "Challenge", "taunt", 10, "spark", null, [], "Calls every foe to them."),
      M("x-tank-ram", "Ram", "charge", 11, "dash", null, [], "Runs straight through the line."),
      M("x-tank-iron-shove", "Iron Shove", "knock", 9.6, "slash", null, [], "A shove that clears the front.", { force: 200, power: 0.25 })
    ],
    rogue: [
      M("x-rogue-backstab", "Backstab", "lunge", 8, "slash", null, [], "In behind and a quick stab."),
      M("x-rogue-caltrops", "Caltrops", "debuff", 9.2, "smoke", null, [], "Spikes on the floor. They slow.", { reach: 200, time: 2 }),
      M("x-rogue-hemorrhage", "Hemorrhage", "dot", 8.4, "slash", null, [], "A cut that opens and keeps bleeding.", { power: 0.22, dot: 3, reach: 46 }),
      M("x-rogue-throwing-knife", "Throwing Knife", "vial", 7.6, "shot", null, [], "A knife thrown at range.", { reach: 200, power: 0.65 }),
      M("x-rogue-sap", "Sap", "stun", 11, "slash", null, [], "A blow to the head. A short stun.", { stun: 0.45, power: 0.25, reach: 42 }),
      M("x-rogue-tumble", "Tumble", "skirmish", 9, "dash", null, [], "A roll out of reach.")
    ],
    lancer: [
      M("x-lancer-skewer", "Skewer", "lunge", 8.4, "slash", null, [], "A long thrust at the nearest."),
      M("x-lancer-gallop", "Gallop", "charge", 10.5, "dash", null, [], "A running charge down the line."),
      M("x-lancer-hook", "Hook", "pull", 9.6, "slash", null, [], "Hooks and drags them in.", { power: 0.28, reach: 260 }),
      M("x-lancer-pike-wall", "Pike Wall", "zone", 12, "orbit", null, [], "The spear set against the rush."),
      M("x-lancer-rend-point", "Rend Point", "dot", 8.6, "slash", null, [], "The point twists in the wound.", { power: 0.2, dot: 2.8, reach: 52 }),
      M("x-lancer-rally-horn", "Rally Horn", "buff", 12, "spark", null, [], "The line steps up together.", { power: 0.1, time: 3.5, team: true })
    ],
    berserker: [
      M("x-berserker-frenzy", "Frenzy", "buff", 10, "spark", null, [], "Blood up. They hit harder for a moment.", { power: 0.12, time: 4, self: true }),
      M("x-berserker-cleaver", "Cleaver", "cleave", 9.8, "slash", null, [], "A wild swing through everyone in front."),
      M("x-berserker-headbutt", "Headbutt", "stun", 11, "slash", null, [], "A headbutt. A short stun.", { stun: 0.45, power: 0.3, reach: 42 }),
      M("x-berserker-bloodletting", "Bloodletting", "dot", 8.2, "slash", null, [], "Every cut keeps bleeding.", { power: 0.22, dot: 3, reach: 46 }),
      M("x-berserker-bull-rush", "Bull Rush", "charge", 10.5, "dash", null, [], "Straight in, whatever is in the way."),
      M("x-berserker-stomp", "Stomp", "knock", 10, "slash", null, [], "A stomp that throws them back.", { force: 190, power: 0.3 })
    ],
    healer: [
      M("x-healer-renew", "Renew", "heal", 8, "plasma", null, [], "A quick mend on the worst wound.", { power: 0.14 }),
      M("x-healer-sanctuary", "Sanctuary", "shield", 11, "orbit", null, [], "A guard on the most wounded ally.", { power: 0.1 }),
      M("x-healer-blessing", "Blessing", "buff", 12, "spark", null, [], "The team hits harder for a moment.", { power: 0.1, time: 3.5, team: true }),
      M("x-healer-smite", "Smite", "bolt", 9, "bolt", null, [], "A bolt of light at the nearest foe.", { power: 0.75, reach: 200 }),
      M("x-healer-soothe", "Soothe", "debuff", 9.6, "spark", null, [], "A calm that slows their hands.", { reach: 240, time: 2 }),
      M("x-healer-cleanse", "Cleanse", "heal", 12, "plasma", null, [], "A deep mend.", { power: 0.16 })
    ],
    assassin: [
      M("x-assassin-ambush", "Ambush", "lunge", 8, "slash", null, [], "Out of nowhere, a stab."),
      M("x-assassin-wolfsbane", "Wolfsbane", "dot", 8.4, "smoke", null, [], "A slow poison that keeps biting.", { power: 0.24, dot: 3.4, reach: 48 }),
      M("x-assassin-shuriken", "Shuriken", "vial", 7.4, "shot", null, [], "A star thrown at range.", { reach: 210, power: 0.65 }),
      M("x-assassin-choke", "Choke", "stun", 11, "slash", null, [], "A grip at the throat. A short stun.", { stun: 0.45, power: 0.25, reach: 42 }),
      M("x-assassin-mist-step", "Mist Step", "shadowstep", 9.4, "smoke", null, [], "Gone in a puff of mist."),
      M("x-assassin-mark-for-death", "Mark for Death", "debuff", 9.2, "spark", null, [], "The mark slows them for the kill.", { reach: 260, time: 2.2 })
    ],
    ranger: [
      M("x-ranger-hunter-s-shot", "Hunter's Shot", "pierce", 11, "shot", null, [], "A shot that goes through."),
      M("x-ranger-rain-of-arrows", "Rain of Arrows", "multishot", 10.5, "shot", null, [], "Arrows over the crowd."),
      M("x-ranger-thorn-arrow", "Thorn Arrow", "dot", 8.8, "shot", null, [], "A thorned arrow that keeps cutting.", { power: 0.22, dot: 3, reach: 210 }),
      M("x-ranger-bear-trap", "Bear Trap", "stun", 11, "slash", null, [], "A trap snaps shut. A short stun.", { stun: 0.45, power: 0.25, reach: 200 }),
      M("x-ranger-retreat", "Retreat", "skirmish", 9.2, "dash", null, [], "Back out of reach."),
      M("x-ranger-wolf-call", "Wolf Call", "summon", 14, "smoke", null, [], "A wolf answers the call.", { pet: "Hound", petHp: 0.22, petAtk: 0.34, life: 5.5 })
    ],
    battlemage: [
      M("x-battlemage-thunder-blade", "Thunder Blade", "cleave", 10, "bolt", null, [], "A charged swing through the front."),
      M("x-battlemage-spark-burst", "Spark Burst", "nova", 12, "boom", null, [], "Sparks burst around them.", { power: 0.7, radius: 58 }),
      M("x-battlemage-static-bolt", "Static Bolt", "bolt", 9, "bolt", null, [], "A short bolt of lightning.", { power: 0.75, reach: 160 }),
      M("x-battlemage-rune-guard", "Rune Guard", "shield", 11, "orbit", null, [], "A rune guard on themselves.", { power: 0.1, self: true }),
      M("x-battlemage-jolt", "Jolt", "stun", 11, "bolt", null, [], "A jolt. A short stun.", { stun: 0.4, power: 0.3, reach: 52 }),
      M("x-battlemage-surge", "Surge", "charge", 10.5, "dash", null, [], "A surge forward.")
    ],
    shieldbearer: [
      M("x-shieldbearer-shield-wall", "Shield Wall", "zone", 12, "orbit", null, [], "The wall goes up and holds."),
      M("x-shieldbearer-rim-strike", "Rim Strike", "stun", 11, "slash", null, [], "The shield rim to the face.", { stun: 0.45, power: 0.3, reach: 42 }),
      M("x-shieldbearer-cover", "Cover", "shield", 11, "orbit", null, [], "A guard on the most wounded ally.", { power: 0.1 }),
      M("x-shieldbearer-push-back", "Push Back", "knock", 9.6, "slash", null, [], "A push that buys room.", { force: 200, power: 0.25 }),
      M("x-shieldbearer-hold-fast", "Hold Fast", "taunt", 10, "spark", null, [], "Draws every foe to the shield."),
      M("x-shieldbearer-shield-charge", "Shield Charge", "charge", 11, "dash", null, [], "Runs in behind the shield.")
    ],
    skirmisher: [
      M("x-skirmisher-sling", "Sling", "vial", 7.4, "shot", null, [], "A stone from the sling.", { reach: 210, power: 0.65 }),
      M("x-skirmisher-bola", "Bola", "debuff", 9.2, "shot", null, [], "A bola that slows their legs.", { reach: 260, time: 2.2 }),
      M("x-skirmisher-dart", "Dart", "dot", 8.4, "shot", null, [], "A dart that keeps stinging.", { power: 0.2, dot: 2.8, reach: 200 }),
      M("x-skirmisher-scatter", "Scatter", "multishot", 10.5, "shot", null, [], "A spray of shot."),
      M("x-skirmisher-dodge", "Dodge", "shadowstep", 9.4, "smoke", null, [], "A quick dodge away."),
      M("x-skirmisher-flash-pot", "Flash Pot", "stun", 11, "boom", null, [], "A pot that flashes. A short daze.", { stun: 0.4, power: 0.25, reach: 200 })
    ],
    duelist: [
      M("x-duelist-thrust", "Thrust", "lunge", 8, "slash", null, [], "A fast thrust at the nearest."),
      M("x-duelist-parry", "Parry", "shield", 11, "plasma", null, [], "A parry stance on themselves.", { power: 0.1, self: true }),
      M("x-duelist-disarm", "Disarm", "stun", 11, "slash", null, [], "A twist that knocks the blade away.", { stun: 0.45, power: 0.25, reach: 42 }),
      M("x-duelist-cut-and-run", "Cut and Run", "skirmish", 9, "dash", null, [], "A cut and a step out."),
      M("x-duelist-bleed-out", "Bleed Out", "dot", 8.4, "slash", null, [], "A thin cut that keeps bleeding.", { power: 0.22, dot: 3, reach: 46 }),
      M("x-duelist-bravado", "Bravado", "buff", 10, "spark", null, [], "They hit harder for a moment.", { power: 0.12, time: 3.5, self: true })
    ],
    elementalist: [
      M("x-elementalist-magma", "Magma", "nova", 12, "boom", null, [], "The ground boils under a cluster.", { power: 0.7, radius: 60 }),
      M("x-elementalist-lightning", "Lightning", "bolt", 9, "bolt", null, [], "A bolt from above.", { power: 0.8, reach: 220 }),
      M("x-elementalist-frostbite", "Frostbite", "nova", 12.5, "plasma", null, [], "A cold that slows a cluster.", { power: 0.55, radius: 62, slow: 1.6 }),
      M("x-elementalist-stone-skin", "Stone Skin", "shield", 11, "orbit", null, [], "Stone on themselves.", { power: 0.1, self: true }),
      M("x-elementalist-tremor", "Tremor", "stun", 11, "boom", null, [], "The ground jumps. A short daze.", { stun: 0.4, power: 0.3, reach: 52 }),
      M("x-elementalist-wildfire", "Wildfire", "dot", 8.6, "boom", null, [], "A fire that keeps burning.", { power: 0.24, dot: 3.2, reach: 210 })
    ],
    monk: [
      M("x-monk-flurry", "Flurry", "cleave", 9.6, "slash", null, [], "A flurry of fists through the front."),
      M("x-monk-pressure-point", "Pressure Point", "stun", 11, "spark", null, [], "A finger to the nerve. A short stun.", { stun: 0.5, power: 0.3, reach: 42 }),
      M("x-monk-still-mind", "Still Mind", "shield", 11, "orbit", null, [], "A calm guard on themselves.", { power: 0.1, self: true }),
      M("x-monk-crane-step", "Crane Step", "shadowstep", 9.4, "dash", null, [], "A light step aside."),
      M("x-monk-chi-wave", "Chi Wave", "heal", 10, "plasma", null, [], "A wave that mends the worst wound.", { power: 0.14 }),
      M("x-monk-sweep-kick", "Sweep Kick", "knock", 10, "slash", null, [], "A low sweep that throws them back.", { force: 180, power: 0.28 })
    ],
    necromancer: [
      M("x-necromancer-corpse-fire", "Corpse Fire", "nova", 12, "smoke", null, [], "A green fire bursts among them.", { power: 0.7, radius: 58 }),
      M("x-necromancer-drain", "Drain", "drain", 9, "smoke", null, [], "Takes their life for its own.", { power: 0.5, reach: 210 }),
      M("x-necromancer-skeleton", "Skeleton", "summon", 14, "smoke", null, [], "Another bone stands up.", { pet: "Bone", petHp: 0.22, petAtk: 0.34, life: 5.5 }),
      M("x-necromancer-bone-spear", "Bone Spear", "bolt", 9, "bolt", null, [], "A spear of bone at the nearest.", { power: 0.8, reach: 220 }),
      M("x-necromancer-terror", "Terror", "stun", 11, "smoke", null, [], "A dread that freezes them.", { stun: 0.4, power: 0.25, reach: 200 }),
      M("x-necromancer-bone-armor", "Bone Armor", "shield", 11, "orbit", null, [], "Bone plates on themselves.", { power: 0.1, self: true })
    ],
    paladin: [
      M("x-paladin-holy-strike", "Holy Strike", "cleave", 10, "spark", null, [], "A blessed swing through the front."),
      M("x-paladin-consecrate", "Consecrate", "zone", 12, "orbit", null, [], "Holy ground they will not leave."),
      M("x-paladin-divine-light", "Divine Light", "heal", 10, "plasma", null, [], "Light mends the worst wound.", { power: 0.14 }),
      M("x-paladin-judgment", "Judgment", "bolt", 9, "bolt", null, [], "A bolt of judgment at range.", { power: 0.75, reach: 180 }),
      M("x-paladin-valor", "Valor", "buff", 12, "spark", null, [], "The team hits harder for a moment.", { power: 0.1, time: 3.5, team: true }),
      M("x-paladin-shield-of-faith", "Shield of Faith", "shield", 11, "orbit", null, [], "A guard on the most wounded ally.", { power: 0.1 })
    ],
    druid: [
      M("x-druid-moonfire", "Moonfire", "dot", 8.6, "plasma", null, [], "Moonlight that keeps burning.", { power: 0.22, dot: 3, reach: 210 }),
      M("x-druid-wild-growth", "Wild Growth", "heal", 10, "plasma", null, [], "Leaves close the worst wound.", { power: 0.14 }),
      M("x-druid-starfall", "Starfall", "nova", 12, "bolt", null, [], "Stars fall on a cluster.", { power: 0.7, radius: 60 }),
      M("x-druid-vine-whip", "Vine Whip", "knock", 10, "slash", null, [], "A vine lashes and throws them back.", { force: 180, power: 0.28 }),
      M("x-druid-spirit-bear", "Spirit Bear", "summon", 14, "smoke", null, [], "A bear spirit fights beside them.", { pet: "Familiar", petHp: 0.24, petAtk: 0.36, life: 6 }),
      M("x-druid-oak-skin", "Oak Skin", "shield", 11, "orbit", null, [], "Bark on the most wounded ally.", { power: 0.1 })
    ],
    bard: [
      M("x-bard-ballad", "Ballad", "heal", 10, "plasma", null, [], "A verse that mends the worst wound.", { power: 0.14 }),
      M("x-bard-dirge", "Dirge", "debuff", 9.6, "spark", null, [], "A slow song that drags them.", { reach: 260, time: 2.2 }),
      M("x-bard-crescendo", "Crescendo", "nova", 12, "spark", null, [], "A note that bursts among them.", { power: 0.65, radius: 58 }),
      M("x-bard-lullaby", "Lullaby", "stun", 11, "spark", null, [], "A lullaby. A short sleep.", { stun: 0.45, power: 0.2, reach: 200 }),
      M("x-bard-march", "March", "buff", 12, "spark", null, [], "The team hits harder for a moment.", { power: 0.1, time: 4, team: true }),
      M("x-bard-harmony", "Harmony", "shield", 11, "orbit", null, [], "A guard on the most wounded ally.", { power: 0.1 })
    ],
    gunslinger: [
      M("x-gunslinger-quickshot", "Quickshot", "vial", 7, "shot", null, [], "A fast shot from the hip.", { reach: 210, power: 0.65 }),
      M("x-gunslinger-ricochet", "Ricochet", "multishot", 10.5, "shot", null, [], "Shots that bounce through the crowd."),
      M("x-gunslinger-armor-pierce", "Armor Pierce", "pierce", 11, "shot", null, [], "A round that goes through."),
      M("x-gunslinger-kneecap", "Kneecap", "debuff", 9.2, "shot", null, [], "A shot at the knee. They slow.", { reach: 280, time: 2.2 }),
      M("x-gunslinger-smoke-round", "Smoke Round", "stun", 11, "smoke", null, [], "A round that bursts in smoke. A short daze.", { stun: 0.4, power: 0.25, reach: 200 }),
      M("x-gunslinger-duck-and-cover", "Duck and Cover", "skirmish", 9, "dash", null, [], "Down and out of the line.")
    ],
    warlock: [
      M("x-warlock-shadow-bolt", "Shadow Bolt", "bolt", 9, "bolt", null, [], "A bolt of shadow.", { power: 0.8, reach: 220 }),
      M("x-warlock-agony", "Agony", "dot", 8.4, "smoke", null, [], "A pain that keeps biting.", { power: 0.26, dot: 3.4, reach: 210 }),
      M("x-warlock-hellfire", "Hellfire", "nova", 12, "boom", null, [], "Fire bursts among them.", { power: 0.7, radius: 60 }),
      M("x-warlock-dark-pact", "Dark Pact", "shield", 11, "orbit", null, [], "A dark guard on themselves.", { power: 0.1, self: true }),
      M("x-warlock-fel-imp", "Fel Imp", "summon", 14, "smoke", null, [], "Another imp answers.", { pet: "Imp", petHp: 0.22, petAtk: 0.36, life: 5.5 }),
      M("x-warlock-howl-of-terror", "Howl of Terror", "stun", 11, "smoke", null, [], "A shriek that freezes them.", { stun: 0.4, power: 0.25, reach: 200 })
    ],
    samurai: [
      M("x-samurai-iai-slash", "Iai Slash", "lunge", 8, "slash", null, [], "A draw and cut in one."),
      M("x-samurai-crescent", "Crescent", "cleave", 10, "slash", null, [], "A crescent cut through the front."),
      M("x-samurai-focus", "Focus", "buff", 10, "spark", null, [], "A breath. They hit harder for a moment.", { power: 0.12, time: 3.5, self: true }),
      M("x-samurai-hilt-strike", "Hilt Strike", "stun", 11, "slash", null, [], "The hilt to the jaw. A short stun.", { stun: 0.45, power: 0.25, reach: 42 }),
      M("x-samurai-wind-step", "Wind Step", "shadowstep", 9.4, "dash", null, [], "A step like the wind."),
      M("x-samurai-deep-cut", "Deep Cut", "dot", 8.6, "slash", null, [], "A cut that keeps bleeding.", { power: 0.22, dot: 3, reach: 46 })
    ],
    spearmaiden: [
      M("x-spearmaiden-javelin", "Javelin", "vial", 7.6, "shot", null, [], "A spear thrown at range.", { reach: 210, power: 0.7 }),
      M("x-spearmaiden-whirling-spear", "Whirling Spear", "cleave", 10, "slash", null, [], "The spear spun through the front."),
      M("x-spearmaiden-impale", "Impale", "dot", 8.6, "slash", null, [], "The point stays in the wound.", { power: 0.22, dot: 3, reach: 52 }),
      M("x-spearmaiden-shield-maiden", "Shield Maiden", "shield", 11, "orbit", null, [], "A guard on the most wounded ally.", { power: 0.1 }),
      M("x-spearmaiden-pole-vault", "Pole Vault", "charge", 10.5, "dash", null, [], "Over the line on the spear."),
      M("x-spearmaiden-war-song", "War Song", "buff", 12, "spark", null, [], "The team hits harder for a moment.", { power: 0.1, time: 3.5, team: true })
    ],
    summoner: [
      M("x-summoner-wisp", "Wisp", "summon", 14, "smoke", null, [], "A wisp joins the fight.", { pet: "Familiar", petHp: 0.22, petAtk: 0.34, life: 5.5 }),
      M("x-summoner-spirit-lash", "Spirit Lash", "dot", 8.6, "smoke", null, [], "A spirit that keeps biting.", { power: 0.22, dot: 3, reach: 210 }),
      M("x-summoner-astral-burst", "Astral Burst", "nova", 12, "plasma", null, [], "Light bursts among them.", { power: 0.7, radius: 58 }),
      M("x-summoner-spirit-chains", "Spirit Chains", "stun", 11, "spark", null, [], "Spirit chains. A short hold.", { stun: 0.45, power: 0.2, reach: 200 }),
      M("x-summoner-mend-link", "Mend Link", "heal", 10, "plasma", null, [], "The bond mends the worst wound.", { power: 0.14 }),
      M("x-summoner-phase", "Phase", "shadowstep", 9.4, "smoke", null, [], "A phase out of reach.")
    ],
    alchemist: [
      M("x-alchemist-firebomb", "Firebomb", "nova", 12, "boom", null, [], "A bomb bursts among them.", { power: 0.7, radius: 60 }),
      M("x-alchemist-frost-flask", "Frost Flask", "nova", 12.5, "plasma", null, [], "A flask that slows a cluster.", { power: 0.55, radius: 62, slow: 1.6 }),
      M("x-alchemist-toxic-cloud", "Toxic Cloud", "dot", 8.4, "smoke", null, [], "A cloud that keeps burning.", { power: 0.24, dot: 3.2, reach: 200 }),
      M("x-alchemist-elixir", "Elixir", "heal", 10, "plasma", null, [], "An elixir for the worst wound.", { power: 0.14 }),
      M("x-alchemist-glue-pot", "Glue Pot", "debuff", 9.2, "shot", null, [], "A pot of glue. They slow.", { reach: 240, time: 2.2 }),
      M("x-alchemist-flashbang", "Flashbang", "stun", 11, "boom", null, [], "A bang and a flash. A short daze.", { stun: 0.4, power: 0.25, reach: 200 })
    ],
    beastmaster: [
      M("x-beastmaster-falcon", "Falcon", "summon", 14, "smoke", null, [], "A falcon dives in.", { pet: "Familiar", petHp: 0.2, petAtk: 0.38, life: 5 }),
      M("x-beastmaster-gore", "Gore", "dot", 8.4, "slash", null, [], "A goring cut that keeps bleeding.", { power: 0.22, dot: 3, reach: 46 }),
      M("x-beastmaster-trample", "Trample", "knock", 10, "slash", null, [], "A charge that throws them back.", { force: 200, power: 0.3 }),
      M("x-beastmaster-beast-call", "Beast Call", "buff", 12, "spark", null, [], "The pack hits harder for a moment.", { power: 0.1, time: 3.5, team: true }),
      M("x-beastmaster-pounce", "Pounce", "charge", 10.5, "dash", null, [], "A leap in beside the pack."),
      M("x-beastmaster-roar", "Roar", "stun", 11, "spark", null, [], "A roar that freezes them.", { stun: 0.4, power: 0.25, reach: 52 })
    ]
  };

  Object.keys(MORE2).forEach(function (id) {
    const kit = CLASSES[id];
    if (!kit || !kit.abilities) return;
    kit.abilities = kit.abilities.concat(MORE2[id]);
  });

  /* One more option per class. Same kind, cooldown, and numbers as a move
     the kit already has, so the fight stays in the same band. The name is
     new, and a recruit may equip it instead of the original. */
  const TWIN_NAME = {
    warrior: "Buckler",
    archer: "Snag",
    mage: "Mana Veil",
    tank: "Heave",
    rogue: "Scratch",
    lancer: "Shaft",
    berserker: "Bellow",
    healer: "Pall",
    assassin: "Venom",
    ranger: "Hitch",
    battlemage: "Afterward",
    shieldbearer: "Ring",
    skirmisher: "Flick",
    duelist: "Answer",
    elementalist: "Pane",
    monk: "Warmth",
    necromancer: "Rib",
    paladin: "Hands",
    druid: "Sprout",
    bard: "Dissonance",
    gunslinger: "Slide Shot",
    warlock: "Hex Spark",
    samurai: "Pass",
    spearmaiden: "Leap Point",
    summoner: "Bond",
    alchemist: "Etch",
    beastmaster: "Rake"
  };
  const TWIN_KEYS = ["power", "stun", "dot", "radius", "slow", "reach", "team", "time", "force", "self", "pet", "petHp", "petAtk", "life"];
  const ALT_ROW = { item: "skill", skill: "spell", thrust: "swing", swing: "thrust", spell: "skill", missile: "missile", evade: "evade" };

  Object.keys(CLASSES).forEach(function (id) {
    const kit = CLASSES[id];
    if (!kit || !kit.abilities || !TWIN_NAME[id]) return;
    const starters = kit.abilities.filter(function (ab) { return ab && ab.unlock && ab.unlock <= 7; });
    let src = starters[1] && starters[1].cd ? starters[1] : null;
    if (!src) {
      for (let i = starters.length - 1; i >= 0; i--) {
        if (starters[i] && starters[i].cd) { src = starters[i]; break; }
      }
    }
    if (!src) return;
    const copy = {};
    TWIN_KEYS.forEach(function (k) { if (src[k] != null) copy[k] = src[k]; });
    const row = ALT_ROW[src.row] || src.row || "skill";
    const twin = M("z-" + id, TWIN_NAME[id], src.kind, src.cd, src.fx, row, (src.tags || ["AoE"]).slice(), src.blurb, copy);
    twin.twinOf = src.id;
    kit.abilities.push(twin);
  });

  Object.keys(CLASSES).forEach(function (id) {
    const kit = CLASSES[id];
    if (kit.role === "kite") kit.attack = "shot";
    else if (kit.role === "cast") kit.attack = "bolt";
    else kit.attack = "combo";
    if (!kit.passive && NEW_PASSIVE[id]) kit.passive = NEW_PASSIVE[id];
    (kit.abilities || []).forEach(stampMove);
  });

  /* v88: every class passive is a real rule with a set number. The arena
     reads passive.fx (arena.js, look for u.pv); the sheet shows passive.blurb,
     written from the same numbers. Bleed, fury and riposte were already
     arena rules (kit.bleed, berserker and duelist checks); they get text. */
  const PASSIVE_FX = {
    footing: { knockResist: 0.5 },
    aim: { range: 0.12 },
    focus: { castSpeed: 0.1 },
    guard: { blockCut: 0.25 },
    reach: { range: 0.1 },
    triage: { triage: 0.4, triageAt: 0.5 },
    trail: { vsSlowed: 0.15 },
    ward: { wardShield: 0.06 },
    wall: { zoneTime: 0.5 },
    feint: { feint: 0.25, feintTime: 1.5 },
    cycle: { cdCut: 0.1 },
    "open-hand": { stunTime: 0.3 },
    "grave-cold": { dotMul: 0.2 },
    "oath-arm": { shieldMul: 0.1 },
    "green-blood": { teamRegen: 3 },
    "encore-note": { teamDmg: 0.18 },
    "quick-draw": { firstShot: 0.5 },
    "hex-mark": { hexVuln: 0.05 },
    "still-blade": { critMul: 1.8 },
    "long-point": { chargeMul: 0.25 },
    tether: { petLife: 0.4, petHp: 0.2 },
    "steady-hand": { vialMul: 0.35 },
    "pack-sense": { petAtk: 0.25 }
  };
  function pc(x) { return Math.round(x * 100) + "%"; }
  const PASSIVE_TEXT = {
    footing: function (v) { return "Knockbacks push this fighter " + pc(v.knockResist) + " less far."; },
    aim: function (v) { return "+" + pc(v.range) + " attack range."; },
    focus: function (v) { return "Spells take " + pc(v.castSpeed) + " less time to cast."; },
    guard: function (v) { return "Blocked hits do " + pc(0.4 * (1 - v.blockCut)) + " damage instead of 40%."; },
    reach: function (v) { return "+" + pc(v.range) + " attack range."; },
    bleed: function () { return "Every hit makes the target bleed for 18% ATK every 0.85s for 3.1s (4 ticks)."; },
    fury: function () { return "Below 45% HP, deals 14% more damage."; },
    triage: function (v) { return "Heals on an ally under " + pc(v.triageAt) + " HP are " + pc(v.triage) + " bigger."; },
    trail: function (v) { return "Deals " + pc(v.vsSlowed) + " more damage to slowed enemies."; },
    ward: function (v) { return "After an area spell lands, gains a shield of " + pc(v.wardShield) + " of max HP."; },
    wall: function (v) { return "The planted guard lasts " + pc(v.zoneTime) + " longer."; },
    feint: function (v) { return "The first shot within " + v.feintTime + "s after a dash or roll deals " + pc(v.feint) + " more."; },
    riposte: function () { return "After taking a hit, the next hit deals 20% more. With one enemy left, deals 18% more damage."; },
    cycle: function (v) { return "Ability cooldowns are " + pc(v.cdCut) + " shorter."; },
    "open-hand": function (v) { return "Stuns last " + pc(v.stunTime) + " longer."; },
    "grave-cold": function (v) { return "Damage over time from its moves deals " + pc(v.dotMul) + " more per tick."; },
    "oath-arm": function (v) { return "Shields it gives absorb " + pc(v.shieldMul) + " more."; },
    "green-blood": function (v) { return "Its whole team regains " + v.teamRegen + " HP every second, all fight."; },
    "encore-note": function (v) { return "Its whole team deals " + pc(v.teamDmg) + " more damage, all fight."; },
    "quick-draw": function (v) { return "The first shot of each fight deals " + pc(v.firstShot) + " more."; },
    "hex-mark": function (v) { return "Enemies under its damage over time take " + pc(v.hexVuln) + " more damage from everyone."; },
    "still-blade": function (v) { return "Critical hits deal ×" + v.critMul + " damage instead of ×1.55."; },
    "long-point": function (v) { return "Charges hit " + pc(v.chargeMul) + " harder."; },
    tether: function (v) { return "Summons last " + pc(v.petLife) + " longer and have " + pc(v.petHp) + " more HP."; },
    "steady-hand": function (v) { return "Thrown flasks deal " + pc(v.vialMul) + " more damage."; },
    "pack-sense": function (v) { return "Summons deal " + pc(v.petAtk) + " more damage."; }
  };
  Object.keys(CLASSES).forEach(function (id) {
    const p = CLASSES[id].passive;
    if (!p || !p.id) return;
    p.fx = PASSIVE_FX[p.id] || null;
    if (PASSIVE_TEXT[p.id]) p.blurb = PASSIVE_TEXT[p.id](p.fx || {});
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

  /* New fighters keep the signature and roll one slot between a starter and
     its twin. The hash is the fighter id, so a reload does not reshuffle and
     the fight rng is left alone. A save that already has a loadout never
     reaches this. */
  function recruitLoadout(f) {
    const pool = poolOf(f.cls);
    const starters = pool.filter(function (ab) { return ab && ab.unlock && ab.unlock <= 7; });
    if (starters.length < 3) return starters.map(function (ab) { return ab.id; }).slice(0, 3);
    const ids = [starters[0].id, starters[1].id, starters[2].id];
    const twin = pool.filter(function (ab) { return ab && ab.twinOf; })[0];
    if (!twin) return ids;
    const slot = ids.indexOf(twin.twinOf);
    if (slot < 1) return ids;
    const h = IL.hashStr(String(f.id || f.cls || "f") + ":moves") >>> 0;
    if (h % 2 === 1) ids[slot] = twin.id;
    return ids;
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
    if (!Array.isArray(f.loadout)) {
      f.loadout = recruitLoadout(f);
      f.loadout.forEach(function (id) {
        if (starters.indexOf(id) < 0 && f.learned.indexOf(id) < 0) f.learned.push(id);
      });
    }
    f.learned = f.learned.filter(function (id) { return pool.indexOf(id) >= 0 && starters.indexOf(id) < 0; });
    f.learned.forEach(function (id) {
      if (f.known.indexOf(id) < 0) f.known.push(id);
    });
    f.loadout = f.loadout.filter(function (id) { return f.known.indexOf(id) >= 0; });
    starters.forEach(function (id) {
      if (f.loadout.length < 3 && f.loadout.indexOf(id) < 0) f.loadout.push(id);
    });
    f.loadout = f.loadout.slice(0, 3);
    if (typeof f.pendingMoves !== "number" || f.pendingMoves < 0) f.pendingMoves = 0;
    return f;
  }

  /* ---------- level up ----------
     Every level a fighter gains queues one pick from three cards: rank
     up a move they use (II to V), learn a new move from the class pool,
     or a training step. The offer is seeded by fighter, level, and how
     many picks they have taken, so a reload shows the same three. */
  const RANK_MAX = 5;
  const RANK_POW = 0.08;
  const RANK_CD = 0.06;
  const STAT_STEP = {
    hp: { name: "Conditioning", stat: "Health", blurb: "More health for every fight from here on." },
    dmg: { name: "Weapon drills", stat: "Attack", blurb: "Every hit and move lands harder." },
    spd: { name: "Footwork", stat: "Speed", blurb: "Closes gaps and gets out of trouble faster." },
    def: { name: "Guard work", stat: "Defense", blurb: "Shaves damage off every hit taken." }
  };

  function rankOf(f, id) {
    const r = f && f.ranks && f.ranks[id];
    return Math.max(1, Math.min(RANK_MAX, r | 0 || 1));
  }

  function usable(f, ab) {
    if (!ab) return false;
    if ((f.learned || []).indexOf(ab.id) >= 0) return true;
    return (ab.unlock || 1) <= (f.level || 1);
  }

  /* ---------- level up v2 (v64) ----------
     Each pick is two parts, like the mercenary leagues it borrows from:
     a stat roll weighted by growth style, and one skill from three
     cards with a rarity. A skill is a new move, a specialization that
     changes one equipped move, or a talent. Both parts can be rerolled
     for gold. Everything is seeded so a reload shows the same screen. */
  /* v70: Eslabong-style tier names. ids stay for saves and css. */
  const RARITY = [
    { id: "common", name: "Common", tier: "T1", w: 62 },
    { id: "rare", name: "Uncommon", tier: "T2", w: 28 },
    { id: "epic", name: "Rare", tier: "T3", w: 9 },
    { id: "legendary", name: "Legendary", tier: "T4", w: 1 }
  ];
  /* The category pill on a skill card, from the move's kind. */
  const CATEGORY = {
    cleave: "AoE", nova: "AoE", frost: "AoE", arc: "AoE",
    shield: "Defense", zone: "Defense", taunt: "Taunt",
    buff: "Buff", rage: "Buff", heal: "Heal", mend: "Heal",
    charge: "Mobility", shadowstep: "Mobility", skirmish: "Mobility",
    multishot: "Damage", pierce: "Damage", bolt: "Damage", fireball: "Damage", lunge: "Damage",
    debuff: "Control", stun: "Stun", knock: "Push", dot: "Over time", vial: "Damage",
    summon: "Summon",
    pull: "Pull", root: "Root", silence: "Silence", chain: "Chain", drain: "Drain", revive: "Revive", homing: "Homing"
  };
  function categoryOf(card) {
    if (!card) return "Utility";
    if (card.kind === "talent") return "Passive";
    if (card.kind === "spec") return "Upgrade";
    if (card.kind === "hone") return "Training";
    const ab = IL.abilityById ? IL.abilityById(card.id) : null;
    return (ab && CATEGORY[ab.kind]) || "Utility";
  }
  const MODS = {
    swift: { name: "Swift", vals: [12, 18, 25, 33], unit: "% shorter cooldown", any: true },
    heavy: { name: "Heavy", vals: [15, 22, 30, 40], unit: "% more power", any: true },
    vampiric: { name: "Vampiric", vals: [12, 18, 25, 35], unit: "% of its damage heals the user" },
    chilling: { name: "Chilling", vals: [1, 1.5, 2, 2.5], unit: "s slow on every target hit" },
    searing: { name: "Searing", vals: [15, 22, 30, 40], unit: "% of the hit burns again over 3s" },
    sundering: { name: "Sundering", vals: [8, 12, 16, 22], unit: "% more damage taken by the target for 3s" }
  };
  const TALENTS = {
    keen: { name: "Keen Eye", vals: [3, 5, 7, 10], unit: "% critical chance" },
    ironhide: { name: "Iron Hide", vals: [1, 2, 3, 4], unit: " defense" },
    vigor: { name: "Vigor", vals: [0.6, 1, 1.4, 2], unit: " health a second" },
    thorns: { name: "Thorns", vals: [6, 9, 12, 16], unit: "% of melee damage taken is returned" },
    bloodlust: { name: "Bloodlust", vals: [8, 12, 16, 22], unit: "% health back on a knockout" },
    fleet: { name: "Fleet", vals: [3, 5, 7, 10], unit: "% move speed" }
  };
  const HEAL_KINDS = { mend: 1, heal: 1, shield: 1, buff: 1, taunt: 1, rage: 1, zone: 1, summon: 1 };

  function rollRng(f, salt) {
    return IL.mulberry32((IL.hashStr(String(f.id || "f") + ":" + salt + ":" + (f.levelsTaken || 0)) >>> 0) || 1);
  }

  function pickRarity(rng) {
    let r = rng() * 100;
    for (let i = 0; i < RARITY.length; i++) {
      if (r < RARITY[i].w) return i;
      r -= RARITY[i].w;
    }
    return 0;
  }

  /* v70 stat pick, Eslabong's "Choose stat": four cards, take one. A
     fighter's growth style decides how big each card is: its best stat
     is worth 3 points, its second 2.5, the rest 2. Balanced is 2.5
     everywhere. */
  const STAT_KEYS = ["hp", "atk", "def", "spd"];
  const HONE_PTS = [2, 3, 4, 5];
  function statOffer(f) {
    const w = (IL.STYLES[IL.styleOf(f)] || IL.STYLES.balanced).w;
    const ranked = STAT_KEYS.slice().sort(function (a, b) { return w[b] - w[a]; });
    const flat = w[ranked[0]] === w[ranked[3]];
    return STAT_KEYS.map(function (k) {
      let pts = 2;
      if (flat) pts = 2.5;
      else if (k === ranked[0]) pts = 3;
      else if (k === ranked[1] && w[k] > w[ranked[2]]) pts = 2.5;
      return { key: k, pts: pts, good: !flat && k === ranked[0] };
    });
  }

  function bestStat(f) {
    const offer = statOffer(f);
    return offer.reduce(function (b, s) { return s.pts > b.pts ? s : b; }, offer[0]).key;
  }

  /* The v64 random roll, kept for old growth logs and tools. */
  function statRoll(f) {
    const rng = rollRng(f, "roll" + (f.statRerolls || 0));
    const w = (IL.STYLES[IL.styleOf(f)] || IL.STYLES.balanced).w;
    const keys = ["hp", "atk", "def", "spd"];
    const total = keys.reduce(function (n, k) { return n + w[k]; }, 0);
    const pts = { hp: 0, atk: 0, def: 0, spd: 0 };
    for (let i = 0; i < 2; i++) {
      let r = rng() * total;
      for (let k = 0; k < keys.length; k++) {
        if (r < w[keys[k]]) { pts[keys[k]]++; break; }
        r -= w[keys[k]];
      }
    }
    return pts;
  }

  function skillOffer(f) {
    ensureMoves(f);
    const rng = rollRng(f, "skill" + (f.skillRerolls || 0));
    const pool = poolOf(f.cls);
    const byId = {};
    pool.forEach(function (ab) { if (ab && ab.id) byId[ab.id] = ab; });
    const specs = f.specs || {};
    const owned = {};
    (f.talents || []).forEach(function (t) { owned[t.id] = Math.max(owned[t.id] == null ? -1 : owned[t.id], t.tier | 0); });
    const fresh = pool.filter(function (ab) { return ab && ab.cd && f.known.indexOf(ab.id) < 0; });
    /* v84: an upgraded move or an owned passive comes back a tier higher
       until legendary, and Hone (stat points) never runs out, so a
       fighter has picks all the way to level 100. */
    const specable = f.loadout.map(function (id) { return byId[id]; }).filter(function (ab) {
      return ab && ab.cd && usable(f, ab) && (!specs[ab.id] || (specs[ab.id].tier | 0) < 3);
    });
    const talentIds = Object.keys(TALENTS).filter(function (id) { return owned[id] == null || owned[id] < 3; });
    const cards = [];
    const used = {};
    function addLearn(tier) {
      const open = fresh.filter(function (ab) { return !used["l" + ab.id]; });
      if (!open.length) return false;
      const ab = open[Math.floor(rng() * open.length)];
      used["l" + ab.id] = true;
      cards.push({ kind: "learn", id: ab.id, tier: ab.ult ? Math.max(tier, 2) : tier });
      return true;
    }
    function addSpec(tier) {
      const open = specable.filter(function (ab) { return !used["s" + ab.id]; });
      if (!open.length) return false;
      const ab = open[Math.floor(rng() * open.length)];
      used["s" + ab.id] = true;
      const had = specs[ab.id];
      if (had) { cards.push({ kind: "spec", id: ab.id, mod: had.mod, tier: Math.min(3, (had.tier | 0) + 1), up: true }); return true; }
      const mods = Object.keys(MODS).filter(function (m) { return MODS[m].any || !HEAL_KINDS[ab.kind]; });
      const mod = mods[Math.floor(rng() * mods.length)];
      cards.push({ kind: "spec", id: ab.id, mod: mod, tier: tier });
      return true;
    }
    function addTalent(tier) {
      const open = talentIds.filter(function (id) { return !used["t" + id]; });
      if (!open.length) return false;
      const id = open[Math.floor(rng() * open.length)];
      used["t" + id] = true;
      if (owned[id] != null) { cards.push({ kind: "talent", id: id, tier: Math.min(3, owned[id] + 1), up: true }); return true; }
      cards.push({ kind: "talent", id: id, tier: tier });
      return true;
    }
    function addHone(tier) {
      const open = STAT_KEYS.filter(function (k) { return !used["h" + k]; });
      if (!open.length) return false;
      const k = open[Math.floor(rng() * open.length)];
      used["h" + k] = true;
      cards.push({ kind: "hone", id: k, tier: tier, pts: HONE_PTS[tier] || HONE_PTS[0] });
      return true;
    }
    const order = [addSpec, addLearn, addTalent];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = order[i]; order[i] = order[j]; order[j] = t;
    }
    for (let i = 0; i < 3; i++) {
      const tier = pickRarity(rng);
      if (!order[i](tier)) {
        if (!addSpec(tier) && !addLearn(tier)) addTalent(tier);
      }
    }
    while (cards.length < 3 && addTalent(0)) { /* fill */ }
    while (cards.length < 3 && addHone(pickRarity(rng))) { /* never an empty hand */ }
    return cards.slice(0, 3);
  }

  function levelOffer(f) {
    return { stats: statOffer(f), cards: skillOffer(f) };
  }

  function rerollCost(f, part) {
    const lv = f.level || 1;
    return part === "stat" ? 10 + lv * 4 : 15 + lv * 5;
  }

  /* One level: the stat card picked (statKey, or the style's best when
     none is given, as rivals do) and one skill card. */
  function applyLevelPick(f, index, statKey) {
    if (!f || !(f.pendingLevels > 0)) return null;
    const offer = levelOffer(f);
    const card = offer.cards[index];
    if (!card) return null;
    const key = STAT_KEYS.indexOf(statKey) >= 0 ? statKey : bestStat(f);
    const stat = offer.stats.filter(function (s) { return s.key === key; })[0];
    const roll = { hp: 0, atk: 0, def: 0, spd: 0 };
    roll[key] = stat ? stat.pts : 2;
    offer.roll = roll;
    if (!f.rolls || typeof f.rolls !== "object") f.rolls = { hp: 0, atk: 0, def: 0, spd: 0 };
    Object.keys(roll).forEach(function (k) { f.rolls[k] = (f.rolls[k] || 0) + roll[k]; });
    if (card.kind === "learn") {
      if (!teachMove(f, card.id)) return null;
      if (f.loadout.length < 3) f.loadout.push(card.id);
    } else if (card.kind === "spec") {
      if (!f.specs || typeof f.specs !== "object") f.specs = {};
      f.specs[card.id] = { mod: card.mod, tier: card.tier };
    } else if (card.kind === "talent") {
      if (!Array.isArray(f.talents)) f.talents = [];
      const had = f.talents.filter(function (t) { return t.id === card.id; })[0];
      if (had) had.tier = Math.max(had.tier | 0, card.tier);
      else f.talents.push({ id: card.id, tier: card.tier });
    } else if (card.kind === "hone") {
      f.rolls[card.id] = (f.rolls[card.id] || 0) + (card.pts || 2);
    }
    if (!Array.isArray(f.growth)) f.growth = [];
    f.growth.push({ level: f.level || 1, kind: card.kind, id: card.id, mod: card.mod || null, tier: card.tier, roll: offer.roll });
    f.pendingLevels -= 1;
    f.levelsTaken = (f.levelsTaken || 0) + 1;
    f.statRerolls = 0;
    f.skillRerolls = 0;
    return card;
  }

  /* v96 evolutions: at level 20 and again at 50 a fighter evolves one
     move, choosing one of two new effects for it by the move's family. */
  const EVO_LEVELS = [20, 50];
  const EVOS = {
    root: { name: "Rooting", text: "Its hits also root the target for 1.2s: they cannot move, but can still fight." },
    drain: { name: "Draining", text: "Heals this fighter for 30% of the damage the move deals." },
    chain: { name: "Arcing", text: "Each hit jumps to one more enemy within 140 px for 50% damage." },
    silence: { name: "Hushing", text: "Its hits silence the target for 1.5s: no abilities, and a cast in progress is cut." },
    lasting: { name: "Lasting", text: "The target also regains 4% of max HP a second for 3s." },
    shared: { name: "Shared", text: "The next most wounded ally gets the same at half strength." }
  };
  const EVO_CHOICES = { melee: ["root", "drain"], spell: ["chain", "silence"], missile: ["root", "chain"], support: ["lasting", "shared"] };
  const NO_EVO = { taunt: 1, rage: 1, buff: 1, summon: 1, revive: 1, debuff: 1, shadowstep: 1 };
  function evoFamily(ab) {
    if (!ab || !ab.cd || NO_EVO[ab.kind]) return null;
    if (ab.kind === "heal" || ab.kind === "mend" || ab.kind === "shield") return "support";
    const row = ab.row || KIND_ROW[ab.kind];
    if (row === "spell") return "spell";
    if (row === "missile") return "missile";
    return "melee";
  }
  function evoChoices(ab) {
    const fam = evoFamily(ab);
    return fam ? EVO_CHOICES[fam].slice() : [];
  }
  function evoPicks(f) {
    if (!f) return 0;
    const lv = f.level || 1;
    const earned = EVO_LEVELS.filter(function (l) { return lv >= l; }).length;
    return Math.max(0, earned - Object.keys(f.evos || {}).length - (f.evoSkips || 0));
  }
  function evolveMove(f, abId, evoId) {
    if (!f || evoPicks(f) < 1) return false;
    ensureMoves(f);
    if (f.known.indexOf(abId) < 0) return false;
    if (f.evos && f.evos[abId]) return false;
    const ab = poolOf(f.cls).filter(function (a) { return a && a.id === abId; })[0];
    if (evoChoices(ab).indexOf(evoId) < 0) return false;
    if (!f.evos || typeof f.evos !== "object") f.evos = {};
    f.evos[abId] = evoId;
    return true;
  }
  /* Rivals evolve on their own: a seeded pick among their loadout. */
  function autoEvos(f, rng) {
    let guard = 0;
    while (evoPicks(f) > 0 && guard++ < 4) {
      ensureMoves(f);
      const pool = poolOf(f.cls);
      const open = (f.loadout || []).map(function (id) { return pool.filter(function (a) { return a && a.id === id; })[0]; })
        .filter(function (ab) { return ab && evoChoices(ab).length && !(f.evos && f.evos[ab.id]); });
      if (!open.length) break;
      const ab = open[Math.floor(rng() * open.length)];
      const ch = evoChoices(ab);
      evolveMove(f, ab.id, ch[Math.floor(rng() * ch.length)]);
    }
    return f;
  }

  /* ---------- v110 milestones, respec ----------
     An ability upgrade every five levels from 14 (a move ranks up: +8%
     power, -6% cooldown a rank, to rank 5) and a mastery at 27, 37 ... 97
     on top of the level-10 one. Respec clears a fighter's upgrades and
     passives and rebuilds them one card at a time. */
  const UPGRADE_LEVELS = [];
  for (let l = 14; l <= 84; l += 5) UPGRADE_LEVELS.push(l);
  const MASTERY_LEVELS = [27, 37, 47, 57, 67, 77, 87, 97];
  function upgradesPending(f) {
    const lv = (f && f.level) || 1;
    return Math.max(0, UPGRADE_LEVELS.filter(function (l) { return lv >= l; }).length - ((f && f.upgradesUsed) || 0));
  }
  function masteriesPending(f) {
    const lv = (f && f.level) || 1;
    return Math.max(0, MASTERY_LEVELS.filter(function (l) { return lv >= l; }).length - ((f && f.masteries) || []).length);
  }
  function upgradeMove(f, id) {
    if (!f || upgradesPending(f) < 1) return false;
    ensureMoves(f);
    if (f.known.indexOf(id) < 0 || rankOf(f, id) >= RANK_MAX) return false;
    if (!f.ranks || typeof f.ranks !== "object") f.ranks = {};
    f.ranks[id] = rankOf(f, id) + 1;
    f.upgradesUsed = (f.upgradesUsed || 0) + 1;
    return true;
  }
  function addMastery(f, id) {
    if (!f || masteriesPending(f) < 1 || !IL.masteryOf || !IL.masteryOf(id)) return false;
    if (!Array.isArray(f.masteries)) f.masteries = [];
    f.masteries.push(id);
    return true;
  }
  function respecCost(f) { return 60 + 12 * ((f && f.level) || 1); }
  function respecCount(f) { return Object.keys((f && f.specs) || {}).length + ((f && f.talents) || []).length; }
  function startRespec(f) {
    const n = respecCount(f);
    if (!f || n < 1 || f.respecPicks > 0) return 0;
    f.specs = {};
    f.talents = [];
    f.respecPicks = n;
    f.respecs = (f.respecs || 0) + 1;
    return n;
  }
  function respecOffer(f) {
    if (!f || !(f.respecPicks > 0)) return [];
    const saved = f.skillRerolls;
    f.skillRerolls = 1000 + (f.respecs || 0) * 50 + f.respecPicks;
    const cards = skillOffer(f).filter(function (c) { return c.kind === "spec" || c.kind === "talent" || c.kind === "hone"; });
    f.skillRerolls = saved;
    return cards;
  }
  function applyRespecPick(f, index) {
    const card = respecOffer(f)[index];
    if (!card) return null;
    if (card.kind === "spec") {
      if (!f.specs || typeof f.specs !== "object") f.specs = {};
      f.specs[card.id] = { mod: card.mod, tier: card.tier };
    } else if (card.kind === "talent") {
      if (!Array.isArray(f.talents)) f.talents = [];
      const had = f.talents.filter(function (t) { return t.id === card.id; })[0];
      if (had) had.tier = Math.max(had.tier | 0, card.tier); else f.talents.push({ id: card.id, tier: card.tier });
    } else if (card.kind === "hone") {
      if (!f.rolls || typeof f.rolls !== "object") f.rolls = { hp: 0, atk: 0, def: 0, spd: 0 };
      f.rolls[card.id] = (f.rolls[card.id] || 0) + (card.pts || 2);
    }
    f.respecPicks -= 1;
    return card;
  }

  function modValue(mod, tier) {
    const m = MODS[mod];
    return m ? m.vals[Math.max(0, Math.min(3, tier | 0))] : 0;
  }

  function talentValue(id, tier) {
    const t = TALENTS[id];
    return t ? t.vals[Math.max(0, Math.min(3, tier | 0))] : 0;
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
  IL.RANK_MAX = RANK_MAX;
  IL.RANK_POW = RANK_POW;
  IL.RANK_CD = RANK_CD;
  IL.rankOf = rankOf;
  IL.levelOffer = levelOffer;
  IL.applyLevelPick = applyLevelPick;
  IL.UPGRADE_LEVELS = UPGRADE_LEVELS;
  IL.MASTERY_LEVELS = MASTERY_LEVELS;
  IL.upgradesPending = upgradesPending;
  IL.masteriesPending = masteriesPending;
  IL.upgradeMove = upgradeMove;
  IL.addMastery = addMastery;
  IL.respecCost = respecCost;
  IL.respecCount = respecCount;
  IL.startRespec = startRespec;
  IL.respecOffer = respecOffer;
  IL.applyRespecPick = applyRespecPick;
  IL.EVOS = EVOS;
  IL.EVO_LEVELS = EVO_LEVELS;
  IL.evoChoices = evoChoices;
  IL.evoPicks = evoPicks;
  IL.evolveMove = evolveMove;
  IL.autoEvos = autoEvos;
  IL.statRoll = statRoll;
  IL.rerollCost = rerollCost;
  IL.RARITY = RARITY;
  IL.statOffer = statOffer;
  IL.categoryOf = categoryOf;
  IL.MODS = MODS;
  IL.TALENTS = TALENTS;
  IL.modValue = modValue;
  IL.talentValue = talentValue;
  IL.STAT_STEP = STAT_STEP;
  IL.teachMove = teachMove;
  IL.learnFromLevel = learnFromLevel;
  IL.moveChoices = moveChoices;
  IL.equipMove = equipMove;
  IL.attackOf = attackOf;
  IL.tomeIds = tomeIds;
  IL.poolOf = poolOf;
})(typeof window !== "undefined" ? window : globalThis);
