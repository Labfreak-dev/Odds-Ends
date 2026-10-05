/* Iron League — fighter gear, loot, and the stall. No DOM. */
(function (root) {
  const IL = root.IL = root.IL || {};

  const RARITIES = ["common", "rare", "epic", "legendary"];
  const SLOTS = ["weapon", "armor", "trinket"];
  const RARITY_RANK = { common: 0, rare: 1, epic: 2, legendary: 3 };

  /* Flats, not percents. A full legendary set is a nudge, not a second kit. */
  const CATALOG = [
    { key: "cleaver", name: "Yard Cleaver", slot: "weapon", glyph: "sword",
      icon: "assets/icons/weapons/cleaver.png",
      atk: [1, 1, 2, 2],
      passive: { id: "keen", name: "Keen edge", blurb: "Cuts land as criticals a little more often." } },
    { key: "wand", name: "Cinder Wand", slot: "weapon", glyph: "wand",
      icon: "assets/icons/weapons/wand.png",
      atk: [1, 1, 2, 2], spd: [0, 1, 2, 3] },
    { key: "longbow", name: "Ash Longbow", slot: "weapon", glyph: "bow",
      icon: "assets/icons/weapons/longbow.png",
      atk: [1, 1, 2, 2], spd: [1, 2, 2, 3] },
    { key: "mail", name: "Riveted Mail", slot: "armor", glyph: "shield",
      icon: "assets/icons/armor/mail.png",
      hp: [8, 10, 12, 14], def: [1, 1, 1, 2],
      passive: { id: "ward", name: "Thin ward", blurb: "A small shield at the first bell." } },
    { key: "cloak", name: "Dust Cloak", slot: "armor", glyph: "cloak",
      icon: "assets/icons/armor/cloak.png",
      hp: [4, 6, 8, 10], spd: [3, 4, 5, 6] },
    { key: "charm", name: "Mender Charm", slot: "trinket", glyph: "gem",
      icon: "assets/icons/trinkets/charm.png",
      hp: [3, 4, 6, 8],
      passive: { id: "mend", name: "Slow mend", blurb: "A stitch of health across the fight." } },
    { key: "band", name: "Copper Band", slot: "trinket", glyph: "ring",
      icon: "assets/icons/trinkets/band.png",
      atk: [1, 1, 1, 2], def: [0, 1, 1, 1] },
    { key: "glass", name: "Short Glass", slot: "trinket", glyph: "gem",
      icon: "assets/icons/trinkets/glass.png",
      spd: [2, 3, 4, 5], atk: [0, 0, 1, 1] }
  ];

  const BY_KEY = {};
  CATALOG.forEach(function (row) { BY_KEY[row.key] = row; });

  const PRICE = { common: 24, rare: 42, epic: 68, legendary: 110 };
  const SALVAGE = { common: 8, rare: 16, epic: 28, legendary: 48 };
  const TRAIN_COST = 16;
  const TRAIN_XP = 12;
  const TRAIN_CAP = 2;
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
      const pool = CATALOG.filter(function (row) { return !opt.slot || row.slot === opt.slot; });
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
    const tpl = templateOf(item);
    return tpl ? tpl.name : "Oddment";
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
    return tpl && tpl.icon ? tpl.icon : "";
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
    return makeItem(rng, { bag: bag || "win" });
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
    if (typeof data.trainsLeft !== "number" || data.trainsLeft < 0) data.trainsLeft = TRAIN_CAP;
    if (data.trainsLeft > TRAIN_CAP) data.trainsLeft = TRAIN_CAP;
    const round = typeof data.round === "number" ? data.round : 0;
    if (typeof data.trainRound !== "number") data.trainRound = round;
    else if (data.trainRound !== round) {
      data.trainsLeft = TRAIN_CAP;
      data.trainRound = round;
    }
    function fixFighter(f) {
      if (!f || typeof f !== "object") return;
      if (!f.gear || typeof f.gear !== "object") f.gear = blankGear();
      for (let i = 0; i < SLOTS.length; i++) {
        const slot = SLOTS[i];
        if (!validItem(f.gear[slot]) || itemSlot(f.gear[slot]) !== slot) f.gear[slot] = null;
      }
    }
    (data.roster || []).forEach(fixFighter);
    (data.clubs || []).forEach(function (c) { (c.fighters || []).forEach(fixFighter); });
    (data.market || []).forEach(function (row) { if (row && row.fighter) fixFighter(row.fighter); });
    if (data.cup && data.cup.slots) {
      data.cup.slots.forEach(function (s) { (s.fighters || []).forEach(fixFighter); });
    }
    return data;
  }

  IL.RARITIES = RARITIES;
  IL.GEAR_SLOTS = SLOTS;
  IL.GEAR_CATALOG = CATALOG;
  IL.TRAIN_COST = TRAIN_COST;
  IL.TRAIN_XP = TRAIN_XP;
  IL.TRAIN_CAP = TRAIN_CAP;
  IL.GEAR_REROLL = GEAR_REROLL;
  IL.blankGear = blankGear;
  IL.makeItem = makeItem;
  IL.itemBonus = itemBonus;
  IL.passiveOf = passiveOf;
  IL.gearBonus = gearBonus;
  IL.gearPassives = gearPassives;
  IL.itemName = itemName;
  IL.itemSlot = itemSlot;
  IL.itemGlyph = itemGlyph;
  IL.itemIcon = itemIcon;
  IL.itemBlurb = itemBlurb;
  IL.gearPrice = gearPrice;
  IL.salvageValue = salvageValue;
  IL.rollLoot = rollLoot;
  IL.rollGearStock = rollGearStock;
  IL.dressRival = dressRival;
  IL.normalizeGear = normalizeGear;
  IL.rarityRank = rarityIndex;
})(typeof window !== "undefined" ? window : globalThis);
