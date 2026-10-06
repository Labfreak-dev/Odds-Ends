/* Iron League — fighter gear, loot, and the stall. No DOM. */
(function (root) {
  const IL = root.IL = root.IL || {};

  const RARITIES = ["common", "rare", "epic", "legendary"];
  const SLOTS = ["weapon", "armor", "trinket"];
  const RARITY_RANK = { common: 0, rare: 1, epic: 2, legendary: 3 };

  /* Flats, not percents. A full legendary set is a nudge, not a second kit. */
  /* icons: common/rare are Beowulf frames; epic/legendary melee and armor use CaptainSkolot. */
  function icons(common, rare, epic, legendary) {
    return { common: common, rare: rare, epic: epic, legendary: legendary };
  }

  const CATALOG = [
    { key: "cleaver", name: "Yard Cleaver", slot: "weapon", glyph: "sword",
      icon: "bw_sword_01_steel",
      icons: icons("bw_sword_01_steel", "bw_sword_05_gold", "cs_sword_v4_01_steel", "cs_sword_v4_07_gold"),
      atk: [1, 1, 2, 2],
      passive: { id: "keen", name: "Keen edge", blurb: "Cuts land as criticals a little more often." } },
    { key: "axe", name: "Kiln Axe", slot: "weapon", glyph: "sword",
      icon: "cs_axe_v1_14_steel",
      icons: icons("cs_axe_v1_14_steel", "cs_axe_v2_01_gold", "cs_axe_v1_11_red", "cs_axe_v2_06_red"),
      atk: [1, 1, 2, 2] },
    { key: "flail", name: "Yard Flail", slot: "weapon", glyph: "sword",
      icon: "bw_flail_10_green",
      icons: icons("bw_flail_10_green", "bw_flail_09_gold", "bw_flail_08_red", "bw_flail_06_dark"),
      atk: [1, 1, 2, 2] },
    { key: "mace", name: "Bell Mace", slot: "weapon", glyph: "sword",
      icon: "bw_mace_02_steel",
      icons: icons("bw_mace_02_steel", "bw_mace_04_gold", "bw_mace_05_green", "bw_mace_01_dark"),
      atk: [1, 1, 2, 2], def: [0, 0, 1, 1] },
    { key: "spear", name: "Stair Pike", slot: "weapon", glyph: "sword",
      icon: "bw_broken_spear",
      icons: icons("bw_broken_spear", "bw_broken_spear", "bw_broken_spear", "bw_broken_spear"),
      atk: [1, 1, 2, 2], spd: [0, 1, 1, 2] },
    { key: "longbow", name: "Ash Bow", slot: "weapon", glyph: "bow",
      icon: "bw_bow_03_steel",
      icons: icons("bw_bow_03_steel", "bw_bow_07_gold", "bw_bow_06_red", "bw_bow_09_purple"),
      atk: [1, 1, 2, 2], spd: [1, 2, 2, 3] },
    { key: "wand", name: "Cinder Staff", slot: "weapon", glyph: "wand",
      icon: "bw_staff_02_steel",
      icons: icons("bw_staff_02_steel", "bw_staff_07_gold", "bw_staff_06_red", "bw_staff_10_dark"),
      atk: [1, 1, 2, 2], spd: [0, 1, 2, 3] },
    { key: "tome", name: "Field Tome", slot: "weapon", glyph: "wand",
      icon: "bw_tome_02_orange",
      icons: icons("bw_tome_02_orange", "bw_tome_07_purple", "cs_magic_book_01_red", "cs_magic_book_09_blue"),
      atk: [0, 1, 1, 2], hp: [2, 3, 4, 6] },
    { key: "dagger", name: "Alley Dagger", slot: "weapon", glyph: "sword",
      icon: "bw_dagger_01_steel",
      icons: icons("bw_dagger_01_steel", "bw_dagger_03_gold", "bw_assassin_s_dagger", "bw_poison_dagger"),
      atk: [1, 1, 2, 2], spd: [1, 2, 2, 3] },
    { key: "star", name: "Throwing Star", slot: "weapon", glyph: "sword",
      icon: "bw_ninja_star",
      icons: icons("bw_ninja_star", "bw_ninja_star", "bw_ninja_star", "bw_ninja_star"),
      atk: [1, 1, 1, 2], spd: [2, 2, 3, 4] },
    { key: "mail", name: "Old Leather", slot: "armor", glyph: "shield",
      icon: "bw_old_leather_armor",
      icons: icons("bw_old_leather_armor", "bw_old_leather_armor", "bw_old_leather_armor", "bw_old_leather_armor"),
      hp: [8, 10, 12, 14], def: [1, 1, 1, 2],
      passive: { id: "ward", name: "Thin ward", blurb: "A small shield at the first bell." } },
    { key: "cloak", name: "Dust Gauntlets", slot: "armor", glyph: "cloak",
      icon: "bw_gauntlet_03_steel",
      icons: icons("bw_gauntlet_03_steel", "bw_gauntlet_05_gold", "bw_gauntlet_10_purple", "bw_gauntlet_06_white"),
      hp: [4, 6, 8, 10], spd: [3, 4, 5, 6] },
    { key: "helm", name: "Old Helm", slot: "armor", glyph: "shield",
      icon: "bw_old_helm",
      icons: icons("bw_old_helm", "bw_bloody_helmet", "bw_broken_helmet", "bw_bloody_helmet"),
      hp: [6, 8, 10, 12], def: [0, 1, 1, 1] },
    { key: "guard", name: "Yard Shield", slot: "armor", glyph: "shield",
      icon: "bw_old_shield",
      icons: icons("bw_old_shield", "bw_broken_shield", "cs_shield_049_gold", "cs_shield_v2_01_steel"),
      hp: [5, 7, 9, 12], def: [1, 1, 1, 2] },
    { key: "gauntlet", name: "Pit Gauntlet", slot: "armor", glyph: "shield",
      icon: "bw_gauntlet_01_red",
      icons: icons("bw_gauntlet_01_red", "bw_gauntlet_08_orange", "bw_gauntlet_04_green", "bw_gauntlet_07_steel"),
      atk: [0, 1, 1, 1], def: [1, 1, 1, 2] },
    { key: "charm", name: "Mender Gem", slot: "trinket", glyph: "gem",
      icon: "bw_green_gem",
      icons: icons("bw_green_gem", "bw_grass_gem", "bw_diamond", "bw_fire_gem"),
      hp: [3, 4, 6, 8],
      passive: { id: "mend", name: "Slow mend", blurb: "A stitch of health across the fight." } },
    { key: "band", name: "Golden Band", slot: "trinket", glyph: "ring",
      icon: "bw_ancient_golden_ring",
      icons: icons("bw_ancient_golden_ring", "bw_ancient_golden_ring", "bw_ancient_golden_ring", "bw_ancient_golden_ring"),
      atk: [1, 1, 1, 2], def: [0, 1, 1, 1] },
    { key: "glass", name: "Glass Orb", slot: "trinket", glyph: "gem",
      icon: "bw_orb_04_gold",
      icons: icons("bw_orb_04_gold", "bw_orb_05_purple", "bw_orb_10_orange", "bw_orb_01_red"),
      spd: [2, 3, 4, 5], atk: [0, 0, 1, 1] },
    { key: "tonic-green", name: "Green Tonic", slot: "tonic", glyph: "gem",
      icon: "cs_potion_01_green",
      icons: icons("cs_potion_01_green", "cs_potion_01_green", "cs_potion_01_green", "cs_potion_01_green") },
    { key: "tonic-blue", name: "Blue Tonic", slot: "tonic", glyph: "gem",
      icon: "cs_potion_04_blue",
      icons: icons("cs_potion_04_blue", "cs_potion_04_blue", "cs_potion_04_blue", "cs_potion_04_blue") },
    { key: "tonic-red", name: "Red Tonic", slot: "tonic", glyph: "gem",
      icon: "cs_potion_09_red",
      icons: icons("cs_potion_09_red", "cs_potion_09_red", "cs_potion_09_red", "cs_potion_09_red") },
    { key: "ability-tome", name: "Ability Tome", slot: "tome", glyph: "wand",
      icon: "bw_tome_02_orange",
      icons: icons("bw_tome_02_orange", "bw_tome_07_purple", "cs_magic_book_01_red", "cs_magic_book_09_blue") }
  ];

  const BY_KEY = {};
  CATALOG.forEach(function (row) { BY_KEY[row.key] = row; });

  const PRICE = { common: 24, rare: 42, epic: 68, legendary: 110 };
  const SALVAGE = { common: 8, rare: 16, epic: 28, legendary: 48 };
  const TRAIN_COST = 16;
  const TRAIN_XP = 12;
  const TRAIN_CAP = 2;
  const FACILITIES = [
    { id: "yard", name: "Training yard", blurb: "One more drill each round.", max: 2, costs: [80, 180] },
    { id: "hall", name: "Lecture hall", blurb: "Each drill teaches a little more.", max: 2, costs: [70, 160] },
    { id: "infirmary", name: "Infirmary", blurb: "Drills cost less gold.", max: 2, costs: [60, 140] }
  ];
  const GEAR_REROLL = 20;
  const STOCK_N = 4;

  const BAGS = {
    loss: [0.78, 0.18, 0.04, 0],
    win: [0.46, 0.36, 0.14, 0.04],
    cup: [0.12, 0.38, 0.36, 0.14],
    stock: [0.52, 0.32, 0.13, 0.03],
    rival: [0.72, 0.24, 0.04, 0]
  };

  function blankGear() {
    return { weapon: null, armor: null, trinket: null };
  }

  function rarityIndex(rarity) {
    const i = RARITY_RANK[rarity];
    return i == null ? 0 : i;
  }

  function templateOf(item) {
    if (!item || !item.key) return null;
    return BY_KEY[item.key] || null;
  }

  function rollRarity(rng, bag) {
    const table = BAGS[bag] || BAGS.win;
    let x = rng();
    for (let i = 0; i < table.length; i++) {
      x -= table[i];
      if (x <= 0) return RARITIES[i];
    }
    return "common";
  }

  function makeItem(rng, opt) {
    opt = opt || {};
    let tpl = opt.key ? BY_KEY[opt.key] : null;
    if (!tpl) {
      const pool = CATALOG.filter(function (row) {
        if (opt.only === "tonic") return row.slot === "tonic";
        if (opt.only === "tome") return row.slot === "tome";
        if (opt.slot) return row.slot === opt.slot;
        return row.slot !== "tonic" && row.slot !== "tome";
      });
      tpl = pool[Math.floor(rng() * pool.length)] || CATALOG[0];
    }
    const rarity = opt.rarity || rollRarity(rng, opt.bag || "win");
    return {
      uid: "g" + Math.floor(rng() * 1e9).toString(36) + Math.floor(rng() * 1e9).toString(36),
      key: tpl.key,
      rarity: RARITIES.indexOf(rarity) >= 0 ? rarity : "common"
    };
  }

  function line(tpl, stat, rarity) {
    const arr = tpl[stat];
    if (!arr) return 0;
    return arr[rarityIndex(rarity)] || 0;
  }

  function itemBonus(item) {
    const tpl = templateOf(item);
    const out = { hp: 0, atk: 0, def: 0, spd: 0 };
    if (!tpl) return out;
    out.hp = line(tpl, "hp", item.rarity);
    out.atk = line(tpl, "atk", item.rarity);
    out.def = line(tpl, "def", item.rarity);
    out.spd = line(tpl, "spd", item.rarity);
    return out;
  }

  function passiveOf(item) {
    const tpl = templateOf(item);
    if (!tpl || !tpl.passive) return null;
    if (rarityIndex(item.rarity) < 1) return null;
    const rank = rarityIndex(item.rarity);
    if (tpl.passive.id === "keen") return { id: "keen", crit: 0.02 + rank * 0.01 };
    if (tpl.passive.id === "ward") return { id: "ward", shield: 2 + rank * 2 };
    if (tpl.passive.id === "mend") return { id: "mend", regen: 0.15 * rank };
    return null;
  }

  function eachPiece(fighter, fn) {
    const gear = fighter && fighter.gear;
    if (!gear) return;
    for (let i = 0; i < SLOTS.length; i++) {
      const item = gear[SLOTS[i]];
      if (item && item.key) fn(item, SLOTS[i]);
    }
  }

  function gearBonus(fighter) {
    const out = { hp: 0, atk: 0, def: 0, spd: 0 };
    eachPiece(fighter, function (item) {
      const b = itemBonus(item);
      out.hp += b.hp;
      out.atk += b.atk;
      out.def += b.def;
      out.spd += b.spd;
    });
    return out;
  }

  function gearPassives(fighter) {
    const out = { crit: 0, shield: 0, regen: 0 };
    eachPiece(fighter, function (item) {
      const p = passiveOf(item);
      if (!p) return;
      if (p.crit) out.crit += p.crit;
      if (p.shield) out.shield += p.shield;
      if (p.regen) out.regen += p.regen;
    });
    return out;
  }

  function itemName(item) {
    if (item && item.teach && IL.abilityById) {
      const ab = IL.abilityById(item.teach);
      if (ab) return "Tome: " + ab.name;
    }
    const tpl = templateOf(item);
    return tpl ? tpl.name : "Oddment";
  }

  function makeTome(rng, opt) {
    opt = opt || {};
    const item = makeItem(rng, { key: "ability-tome", rarity: opt.rarity, bag: opt.bag || "win" });
    const ids = IL.tomeIds ? IL.tomeIds() : [];
    item.teach = opt.teach || (ids.length ? ids[Math.floor(rng() * ids.length)] : "");
    return item;
  }

  function itemSlot(item) {
    const tpl = templateOf(item);
    return tpl ? tpl.slot : "trinket";
  }

  function itemGlyph(item) {
    const tpl = templateOf(item);
    return tpl ? tpl.glyph : "gem";
  }

  function itemIcon(item) {
    const tpl = templateOf(item);
    if (!tpl) return "";
    const table = tpl.icons;
    if (table && item && table[item.rarity]) return table[item.rarity];
    return tpl.icon || "";
  }

  function tonicShield(item) {
    const rank = rarityIndex(item && item.rarity);
    return 6 + rank * 2;
  }

  const ABILITY_ICON = {
    cleave: "assets/ui/abilities/pixel_skill3_05.png",
    multishot: "assets/ui/abilities/pixel_skill3_09.png",
    frost: "assets/ui/abilities/pixel_skill3_03.png",
    fireball: "assets/ui/abilities/pixel_skill3_06.png",
    taunt: "assets/ui/abilities/pixel_skill3_10.png",
    shadowstep: "assets/ui/abilities/pixel_skill3_24.png",
    charge: "assets/ui/abilities/pixel_skill3_22.png",
    rage: "assets/ui/abilities/pixel_skill3_30.png",
    mend: "assets/ui/abilities/pixel_skill3_15.png",
    pierce: "assets/ui/abilities/pixel_skill3_11.png",
    arc: "assets/ui/abilities/pixel_skill3_08.png",
    zone: "assets/ui/abilities/pixel_skill3_13.png",
    skirmish: "assets/ui/abilities/pixel_skill3_17.png",
    lunge: "assets/ui/abilities/pixel_skill3_20.png",
    nova: "assets/ui/abilities/pixel_skill3_14.png",
    bolt: "assets/ui/abilities/pixel_skill3_21.png",
    footing: "assets/ui/abilities/pixel_skill3_27.png",
    aim: "assets/ui/abilities/pixel_skill3_25.png",
    focus: "assets/ui/abilities/pixel_skill3_18.png",
    guard: "assets/ui/abilities/pixel_skill3_28.png",
    bleed: "assets/ui/abilities/pixel_skill3_07.png",
    reach: "assets/ui/abilities/pixel_skill3_26.png",
    fury: "assets/ui/abilities/pixel_skill3_19.png",
    triage: "assets/ui/abilities/pixel_skill3_29.png",
    trail: "assets/ui/abilities/pixel_skill3_25.png",
    ward: "assets/ui/abilities/pixel_skill3_03.png",
    wall: "assets/ui/abilities/pixel_skill3_10.png",
    feint: "assets/ui/abilities/pixel_skill3_24.png",
    riposte: "assets/ui/abilities/pixel_skill3_20.png",
    cycle: "assets/ui/abilities/pixel_skill3_29.png"
  };

  const LOOT_FRAME = {
    chest: { common: "7t4e_chest_tier1", rare: "7t4e_chest_tier3", epic: "7t4e_chest_tier5", legendary: "7t4e_chest_tier7" },
    bag: { common: "7t4e_bag_tier1", rare: "7t4e_bag_tier3", epic: "7t4e_bag_tier5", legendary: "7t4e_bag_tier7" }
  };

  const KIND_ICON = {
    cleave: "assets/ui/abilities/pixel_skill3_05.png",
    multishot: "assets/ui/abilities/pixel_skill3_09.png",
    pierce: "assets/ui/abilities/pixel_skill3_11.png",
    frost: "assets/ui/abilities/pixel_skill3_03.png",
    fireball: "assets/ui/abilities/pixel_skill3_06.png",
    nova: "assets/ui/abilities/pixel_skill3_14.png",
    bolt: "assets/ui/abilities/pixel_skill3_21.png",
    taunt: "assets/ui/abilities/pixel_skill3_10.png",
    shadowstep: "assets/ui/abilities/pixel_skill3_24.png",
    charge: "assets/ui/abilities/pixel_skill3_22.png",
    rage: "assets/ui/abilities/pixel_skill3_30.png",
    mend: "assets/ui/abilities/pixel_skill3_15.png",
    heal: "assets/ui/abilities/pixel_skill3_15.png",
    arc: "assets/ui/abilities/pixel_skill3_08.png",
    zone: "assets/ui/abilities/pixel_skill3_13.png",
    skirmish: "assets/ui/abilities/pixel_skill3_17.png",
    lunge: "assets/ui/abilities/pixel_skill3_20.png",
    shield: "assets/ui/abilities/pixel_skill3_28.png",
    buff: "assets/ui/abilities/pixel_skill3_19.png",
    debuff: "assets/ui/abilities/pixel_skill3_07.png",
    stun: "assets/ui/abilities/pixel_skill3_10.png",
    knock: "assets/ui/abilities/pixel_skill3_26.png",
    summon: "assets/ui/abilities/pixel_skill3_18.png",
    vial: "assets/ui/abilities/pixel_skill3_06.png",
    dot: "assets/ui/abilities/pixel_skill3_07.png"
  };

  function abilityIcon(id) {
    if (ABILITY_ICON[id]) return ABILITY_ICON[id];
    const ab = IL.abilityById ? IL.abilityById(id) : null;
    if (ab && KIND_ICON[ab.kind]) return KIND_ICON[ab.kind];
    return "";
  }

  function lootFrame(kind, rarity) {
    const table = LOOT_FRAME[kind];
    if (!table) return "";
    return table[rarity] || table.common;
  }

  function itemBlurb(item) {
    const tpl = templateOf(item);
    const p = passiveOf(item);
    if (p && tpl && tpl.passive) return tpl.passive.blurb;
    if (tpl && tpl.passive && rarityIndex(item.rarity) < 1) return "The passive wakes at rare.";
    return "";
  }

  function gearPrice(item) {
    return PRICE[item && item.rarity] || PRICE.common;
  }

  function salvageValue(item) {
    return SALVAGE[item && item.rarity] || SALVAGE.common;
  }

  function rollLoot(rng, bag) {
    const pocket = bag || "win";
    if (rng() < 0.16) return makeItem(rng, { only: "tonic", bag: pocket });
    if (rng() < 0.14) return makeTome(rng, { bag: pocket });
    return makeItem(rng, { bag: pocket });
  }

  function rollGearStock(rng) {
    const stock = [];
    const used = {};
    let guard = 0;
    while (stock.length < STOCK_N && guard < 24) {
      guard++;
      const item = makeItem(rng, { bag: "stock" });
      const stamp = item.key + ":" + item.rarity;
      if (used[stamp]) continue;
      used[stamp] = true;
      stock.push({ item: item, cost: gearPrice(item) });
    }
    let tonicAt = -1;
    if (stock.length && rng() < 0.55) {
      const drink = makeItem(rng, { only: "tonic", bag: "stock" });
      tonicAt = stock.length - 1;
      stock[tonicAt] = { item: drink, cost: gearPrice(drink) };
    }
    if (stock.length) {
      let at = 0;
      if (tonicAt === 0) at = stock.length > 1 ? 1 : -1;
      if (at >= 0) {
        const tome = makeTome(rng, { bag: "stock" });
        stock[at] = { item: tome, cost: gearPrice(tome) };
      }
    }
    return stock;
  }

  /* Rivals wear a piece or two, mostly common, so a kitted squad is not a bye. */
  function dressRival(fighter, rng) {
    if (!fighter) return fighter;
    if (!fighter.gear) fighter.gear = blankGear();
    const roll = rng();
    const n = roll < 0.4 ? 0 : roll < 0.84 ? 1 : 2;
    const used = {};
    for (let i = 0; i < n; i++) {
      const item = makeItem(rng, { bag: "rival" });
      const slot = itemSlot(item);
      if (slot === "tome" || slot === "tonic") continue;
      if (used[slot]) continue;
      used[slot] = true;
      fighter.gear[slot] = item;
    }
    return fighter;
  }

  function validItem(item) {
    return !!(item && typeof item.uid === "string" && BY_KEY[item.key] && RARITY_RANK[item.rarity] != null);
  }

  function normalizeGear(data) {
    if (!data || typeof data !== "object") return data;
    if (!Array.isArray(data.items)) data.items = [];
    data.items = data.items.filter(validItem);
    if (!Array.isArray(data.gearStock)) data.gearStock = [];
    data.gearStock = data.gearStock.filter(function (row) { return row && validItem(row.item); });
    if (typeof data.trainsLeft !== "number" || data.trainsLeft < 0) data.trainsLeft = drillCap(data);
    if (data.trainsLeft > drillCap(data)) data.trainsLeft = drillCap(data);
    const round = typeof data.round === "number" ? data.round : 0;
    if (typeof data.trainRound !== "number") data.trainRound = round;
    else if (data.trainRound !== round) {
      data.trainsLeft = drillCap(data);
      data.trainRound = round;
    }
    function fixFighter(f) {
      if (!f || typeof f !== "object") return;
      if (!f.gear || typeof f.gear !== "object") f.gear = blankGear();
      for (let i = 0; i < SLOTS.length; i++) {
        const slot = SLOTS[i];
        if (!validItem(f.gear[slot]) || itemSlot(f.gear[slot]) !== slot) f.gear[slot] = null;
      }
      if (f.tonic && (!validItem(f.tonic) || itemSlot(f.tonic) !== "tonic")) f.tonic = null;
    }
    (data.roster || []).forEach(fixFighter);
    (data.clubs || []).forEach(function (c) { (c.fighters || []).forEach(fixFighter); });
    (data.market || []).forEach(function (row) { if (row && row.fighter) fixFighter(row.fighter); });
    if (data.deals && data.deals.offers) {
      data.deals.offers.forEach(function (o) { if (o && o.fighter) fixFighter(o.fighter); });
    }
    if (data.cup && data.cup.slots) {
      data.cup.slots.forEach(function (s) { (s.fighters || []).forEach(fixFighter); });
    }
    return data;
  }

  IL.RARITIES = RARITIES;
  IL.GEAR_SLOTS = SLOTS;
  IL.GEAR_CATALOG = CATALOG;
  const DRILL_RANK_CAP = 5;
  const DRILL_DEFS = [
    { id: "strength", name: "Strength", blurb: "Raises attack.", stat: "atk", amt: 1 },
    { id: "footwork", name: "Footwork", blurb: "Raises speed.", stat: "spd", amt: 2 },
    { id: "archery", name: "Archery", blurb: "Raises attack for bow and gun classes.", stat: "atk", amt: 1, classes: ["archer", "ranger", "gunslinger", "skirmisher"] },
    { id: "arcana", name: "Arcana", blurb: "Raises attack for spell classes.", stat: "atk", amt: 1, classes: ["mage", "battlemage", "elementalist", "warlock", "necromancer", "druid", "summoner", "alchemist", "bard"] },
    { id: "endurance", name: "Endurance", blurb: "Raises health.", stat: "hp", amt: 4 },
    { id: "tactics", name: "Tactics", blurb: "Raises defense.", stat: "def", amt: 1 }
  ];

  function facilityRank(data, id) {
    const n = data && data.facilities && data.facilities[id];
    if (typeof n !== "number" || n < 0) return 0;
    return Math.min(2, n | 0);
  }

  function drillCap(data) { return TRAIN_CAP + facilityRank(data, "yard"); }
  function drillXp(data) { return TRAIN_XP + facilityRank(data, "hall") * 4; }
  function drillCost(data) { return Math.max(8, TRAIN_COST - facilityRank(data, "infirmary") * 4); }

  function drillList(data) {
    const xp = drillXp(data);
    const cost = drillCost(data);
    return DRILL_DEFS.map(function (def) {
      return {
        id: def.id,
        name: def.name,
        blurb: def.blurb,
        stat: def.stat,
        amt: def.amt,
        classes: def.classes || null,
        xp: xp,
        cost: cost,
        cap: DRILL_RANK_CAP
      };
    });
  }

  function drillById(data, id) {
    const list = drillList(data);
    for (let i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function drillRank(fighter, id) {
    const n = fighter && fighter.drillRanks && fighter.drillRanks[id];
    if (typeof n !== "number" || n <= 0) return 0;
    return Math.min(DRILL_RANK_CAP, n | 0);
  }

  function drillOpen(fighter, id) {
    const def = drillById(null, id);
    if (!def) return false;
    if (!def.classes) return true;
    return !!(fighter && def.classes.indexOf(fighter.cls) >= 0);
  }

  function applyDrill(fighter, id) {
    const def = drillById(null, id);
    if (!fighter || !def || !drillOpen(fighter, id)) return false;
    if (!fighter.drillRanks || typeof fighter.drillRanks !== "object") fighter.drillRanks = {};
    const cur = drillRank(fighter, id);
    if (cur >= DRILL_RANK_CAP) return false;
    fighter.drillRanks[id] = cur + 1;
    return true;
  }

  function drillBonus(fighter) {
    return {
      hp: drillRank(fighter, "endurance") * 4,
      atk: drillRank(fighter, "strength") + drillRank(fighter, "archery") + drillRank(fighter, "arcana"),
      def: drillRank(fighter, "tactics"),
      spd: drillRank(fighter, "footwork") * 2
    };
  }

  function facilityById(id) {
    for (let i = 0; i < FACILITIES.length; i++) if (FACILITIES[i].id === id) return FACILITIES[i];
    return null;
  }

  IL.TRAIN_COST = TRAIN_COST;
  IL.TRAIN_XP = TRAIN_XP;
  IL.TRAIN_CAP = TRAIN_CAP;
  IL.FACILITIES = FACILITIES;
  IL.drillCap = drillCap;
  IL.drillXp = drillXp;
  IL.drillCost = drillCost;
  IL.drillList = drillList;
  IL.drillById = drillById;
  IL.drillRank = drillRank;
  IL.drillOpen = drillOpen;
  IL.applyDrill = applyDrill;
  IL.drillBonus = drillBonus;
  IL.DRILL_RANK_CAP = DRILL_RANK_CAP;
  IL.facilityById = facilityById;
  IL.GEAR_REROLL = GEAR_REROLL;
  IL.blankGear = blankGear;
  IL.makeItem = makeItem;
  IL.makeTome = makeTome;
  IL.itemBonus = itemBonus;
  IL.passiveOf = passiveOf;
  IL.gearBonus = gearBonus;
  IL.gearPassives = gearPassives;
  IL.itemName = itemName;
  IL.itemSlot = itemSlot;
  IL.itemGlyph = itemGlyph;
  IL.itemIcon = itemIcon;
  IL.tonicShield = tonicShield;
  IL.abilityIcon = abilityIcon;
  IL.lootFrame = lootFrame;
  IL.CURRENCY_ICON = { gold: "bw_gold_coins", renown: "bw_gem_ruby", token: "bw_token_golden_medallion" };
  IL.itemBlurb = itemBlurb;
  IL.gearPrice = gearPrice;
  IL.salvageValue = salvageValue;
  IL.rollLoot = rollLoot;
  IL.rollGearStock = rollGearStock;
  IL.dressRival = dressRival;
  IL.normalizeGear = normalizeGear;
  IL.rarityRank = rarityIndex;
})(typeof window !== "undefined" ? window : globalThis);
