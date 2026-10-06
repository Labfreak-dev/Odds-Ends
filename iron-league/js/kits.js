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
      ability: A("anthem", "Anthem", "buff", 10, "spark", 1, "The next blows hit harder.", { power: 0.16, time: 4 })
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
    return (kit.abilities || []).filter(function (ab) { return (ab.unlock || 1) <= lv; });
  }

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

  IL.TRAITS = TRAITS;
  IL.CLUB_THEMES = CLUB_THEMES;
  IL.abilityById = function (id) { return byId[id] || null; };
  IL.traitSummary = traitSummary;
  IL.themedFighter = themedFighter;
  IL.abilitiesFor = abilitiesFor;
})(typeof window !== "undefined" ? window : globalThis);
