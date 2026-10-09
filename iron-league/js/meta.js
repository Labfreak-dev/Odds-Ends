/* Iron League — renown, market, relics, cups. No DOM. */
(function (root) {
  const IL = root.IL = root.IL || {};

  const RELICS = [
    { id: "band", name: "Iron Band", kind: "hp", scope: "club", rarity: "common", set: "wall", blurb: "Fielded fighters have more health." },
    { id: "edge", name: "Keen Edge", kind: "crit", scope: "club", rarity: "common", set: "edge", blurb: "Cuts land as criticals more often." },
    { id: "plate", name: "Warden Plate", kind: "shield", scope: "club", rarity: "common", set: "wall", blurb: "Each fighter starts with a small shield." },
    { id: "sigil", name: "Quick Sigil", kind: "haste", scope: "club", rarity: "common", set: "haste", blurb: "Casts and abilities come back sooner." },
    { id: "purse", name: "Purse Hook", kind: "bounty", scope: "club", rarity: "common", set: "purse", blurb: "A downed rival pays a little gold." },
    { id: "thread", name: "Mender's Thread", kind: "regen", scope: "club", rarity: "common", set: "mend", blurb: "Slow mending during the fight." },
    { id: "quill", name: "Piercing Quill", kind: "pierce", scope: "club", rarity: "common", set: "mark", blurb: "Shots pass through one extra body." },
    { id: "wind", name: "Second Wind", kind: "wind", scope: "club", rarity: "common", set: "breath", blurb: "Once, at a low ebb, they catch a breath." },
    { id: "banner", name: "Yard Banner", kind: "speed", scope: "club", rarity: "common", set: "haste", blurb: "The squad moves a little faster." },
    { id: "glass", name: "Glass Charm", kind: "glass", scope: "club", rarity: "common", set: "glass", blurb: "More damage. Less armor." },
    { id: "ring", name: "Cup Ring", kind: "renown", scope: "club", rarity: "common", set: "purse", blurb: "Wins on the board pay extra renown." },
    { id: "clock", name: "Sand Clock", kind: "sand", scope: "club", rarity: "common", set: "haste", blurb: "Abilities cool down faster." },
    { id: "brace", name: "Yard Brace", kind: "def", scope: "fighter", rarity: "rare", set: "wall", blurb: "That fighter stands a little firmer." },
    { id: "oath", name: "Oath Nail", kind: "shield", scope: "fighter", rarity: "legendary", set: "wall", blurb: "That fighter opens the fight behind a shield." },
    { id: "hone", name: "Honing Stone", kind: "atk", scope: "fighter", rarity: "uncommon", set: "edge", blurb: "That fighter's cuts sit heavier." },
    { id: "fang", name: "Fang Charm", kind: "crit", scope: "club", rarity: "rare", set: "edge", blurb: "Criticals come more often for the club." },
    { id: "lastcut", name: "Last Cut", kind: "atk", scope: "fighter", rarity: "legendary", set: "edge", blurb: "That fighter's last cut lands harder." },
    { id: "salve", name: "Green Salve", kind: "regen", scope: "fighter", rarity: "uncommon", set: "mend", blurb: "That fighter mends a little during the fight." },
    { id: "stitch", name: "Stitching Kit", kind: "hp", scope: "club", rarity: "rare", set: "mend", blurb: "The party has more health." },
    { id: "chalice", name: "Well Chalice", kind: "regen", scope: "fighter", rarity: "legendary", set: "mend", blurb: "That fighter mends through the fight." },
    { id: "spur", name: "Spurred Boot", kind: "speed", scope: "fighter", rarity: "legendary", set: "haste", blurb: "That fighter crosses the pit faster." },
    { id: "shard", name: "Mirror Shard", kind: "atk", scope: "fighter", rarity: "uncommon", set: "glass", blurb: "That fighter hits harder." },
    { id: "lens", name: "Cracked Lens", kind: "glass", scope: "club", rarity: "rare", set: "glass", blurb: "The club hits harder and wears less armor." },
    { id: "heart", name: "Glass Heart", kind: "atk", scope: "fighter", rarity: "legendary", set: "glass", blurb: "That fighter hits much harder." },
    { id: "coin", name: "Lucky Coin", kind: "bounty", scope: "fighter", rarity: "rare", set: "purse", blurb: "A rival that fighter drops pays gold." },
    { id: "ledger", name: "Tithe Ledger", kind: "renown", scope: "fighter", rarity: "legendary", set: "purse", blurb: "Wins pay extra renown while they wear it." },
    { id: "fletch", name: "Fletching Wax", kind: "pierce", scope: "fighter", rarity: "uncommon", set: "mark", blurb: "That fighter's shots pass one more body." },
    { id: "sight", name: "Hawk Sight", kind: "pierce", scope: "club", rarity: "rare", set: "mark", blurb: "Shots from the club pass one more body." },
    { id: "star", name: "Falling Star", kind: "pierce", scope: "fighter", rarity: "legendary", set: "mark", blurb: "That fighter's shot keeps traveling." },
    { id: "lung", name: "Deep Lung", kind: "hp", scope: "fighter", rarity: "uncommon", set: "breath", blurb: "That fighter has more health." },
    { id: "bell", name: "Rally Bell", kind: "wind", scope: "club", rarity: "rare", set: "breath", blurb: "The party can catch a breath, once." },
    { id: "ash", name: "Ash Breath", kind: "wind", scope: "fighter", rarity: "legendary", set: "breath", blurb: "That fighter can catch a breath, once." },
    { id: "rivet", name: "Rivet Cap", kind: "def", scope: "club", rarity: "common", blurb: "The party stands a little firmer." },
    { id: "cloak", name: "Warm Cloak", kind: "hp", scope: "fighter", rarity: "common", blurb: "That fighter has a little more health." },
    { id: "whistle", name: "Tin Whistle", kind: "haste", scope: "club", rarity: "common", blurb: "Casts and abilities come back a little sooner." },
    { id: "nail", name: "Rust Nail", kind: "atk", scope: "fighter", rarity: "common", blurb: "That fighter hits a little harder." },
    { id: "buckle", name: "Oak Buckle", kind: "shield", scope: "club", rarity: "common", blurb: "The party opens behind a small shield." },
    { id: "wrap", name: "Soft Wrap", kind: "regen", scope: "fighter", rarity: "common", blurb: "That fighter mends, slowly." },
    { id: "pebble", name: "Pebble Charm", kind: "crit", scope: "club", rarity: "uncommon", blurb: "Cuts land as criticals a little more often." },
    { id: "ferry", name: "Ferry Token", kind: "bounty", scope: "fighter", rarity: "uncommon", blurb: "A rival that fighter drops pays a little gold." },
    { id: "bluethread", name: "Blue Thread", kind: "regen", scope: "club", rarity: "uncommon", blurb: "The party mends a little during the fight." },
    { id: "fuse", name: "Short Fuse", kind: "haste", scope: "fighter", rarity: "uncommon", blurb: "That fighter's abilities come back sooner." },
    { id: "stud", name: "Copper Stud", kind: "def", scope: "club", rarity: "uncommon", blurb: "The party wears the hit a little better." },
    { id: "wren", name: "Wren Feather", kind: "speed", scope: "fighter", rarity: "uncommon", blurb: "That fighter moves a little faster." },
    { id: "salt", name: "Salt Vial", kind: "pierce", scope: "club", rarity: "uncommon", blurb: "Shots pass through one extra body." },
    { id: "oil", name: "Night Oil", kind: "crit", scope: "fighter", rarity: "rare", blurb: "That fighter's cuts land as criticals more often." },
    { id: "clasp", name: "Heavy Clasp", kind: "shield", scope: "club", rarity: "rare", blurb: "The party opens behind a thicker shield." },
    { id: "redwrap", name: "Red Wrap", kind: "regen", scope: "fighter", rarity: "rare", blurb: "That fighter mends through the fight." },
    { id: "storm", name: "Storm Bead", kind: "haste", scope: "club", rarity: "rare", blurb: "Casts and abilities come back sooner." },
    { id: "dice", name: "Bone Dice", kind: "bounty", scope: "fighter", rarity: "rare", blurb: "A rival that fighter drops pays gold." },
    { id: "ironstud", name: "Iron Stud", kind: "def", scope: "club", rarity: "rare", blurb: "The party stands firmer." },
    { id: "cord", name: "Swift Cord", kind: "speed", scope: "fighter", rarity: "rare", blurb: "That fighter crosses the pit faster." },
    { id: "pin", name: "Long Pin", kind: "pierce", scope: "club", rarity: "rare", blurb: "Shots from the club pass one more body." },
    { id: "mask", name: "Pale Mask", kind: "glass", scope: "fighter", rarity: "rare", blurb: "That fighter hits harder and wears less armor." },
    { id: "crown", name: "Crown Nail", kind: "atk", scope: "club", rarity: "legendary", blurb: "The party's cuts land harder." },
    { id: "knot", name: "Saint's Knot", kind: "hp", scope: "fighter", rarity: "legendary", blurb: "That fighter has much more health." },
    { id: "echo", name: "Echo Bell", kind: "sand", scope: "club", rarity: "legendary", blurb: "Abilities cool down faster." },
    { id: "thorn", name: "Thorn Ring", kind: "crit", scope: "fighter", rarity: "legendary", blurb: "That fighter's cuts land as criticals." },
    { id: "goldthread", name: "Gold Thread", kind: "bounty", scope: "club", rarity: "legendary", blurb: "A downed rival pays more gold." },
    { id: "whiteash", name: "White Ash", kind: "wind", scope: "fighter", rarity: "legendary", blurb: "That fighter can catch a breath, once." },
    { id: "broad", name: "Broad Plate", kind: "shield", scope: "club", rarity: "uncommon", blurb: "The party opens behind a shield." },
    { id: "keenpin", name: "Keen Pin", kind: "atk", scope: "fighter", rarity: "rare", blurb: "That fighter's cuts sit heavier." },
    { id: "cup", name: "Mender's Cup", kind: "regen", scope: "club", rarity: "rare", blurb: "The party mends during the fight." },
    { id: "lastbell", name: "Last Bell", kind: "haste", scope: "fighter", rarity: "legendary", blurb: "That fighter's casts come back much sooner." },
    /* v95 named legendaries, lesser kin, and relics that grant a move. */
    { id: "phoenix", name: "Phoenix Feather", kind: "revive", scope: "fighter", rarity: "legendary", named: true, blurb: "Rise once from a killing blow." },
    { id: "bloodvine", name: "Bloodvine Ring", kind: "lifesteal", scope: "fighter", rarity: "legendary", named: true, blurb: "Drinks from every hit." },
    { id: "aegis", name: "Mirror Aegis", kind: "reflect", scope: "fighter", rarity: "legendary", named: true, blurb: "Sends hits back." },
    { id: "blinkstone", name: "Blink Stone", kind: "blink", scope: "fighter", rarity: "legendary", named: true, blurb: "Steps out of danger." },
    { id: "leech", name: "Leech Tooth", kind: "lifesteal", scope: "fighter", rarity: "rare", blurb: "Drinks a little from every hit." },
    { id: "bramble", name: "Bramble Mail", kind: "reflect", scope: "fighter", rarity: "rare", blurb: "Sends a little back." },
    { id: "emberidol", name: "Ember Idol", kind: "grant", grant: "m-flare", scope: "fighter", rarity: "rare", blurb: "Teaches Flare." },
    { id: "warhorn", name: "War Horn", kind: "grant", grant: "rally", scope: "fighter", rarity: "rare", blurb: "Teaches Rally." },
    { id: "salvebead", name: "Salve Bead", kind: "grant", grant: "h-salve", scope: "fighter", rarity: "uncommon", blurb: "Teaches Salve." },
    { id: "wardprism", name: "Ward Prism", kind: "grant", grant: "m-ward", scope: "fighter", rarity: "uncommon", blurb: "Teaches Ward." }
  ];

  /* v95 one table of relic numbers, read by the arena and by the text,
     so what a relic says is what it does. Scale by rarity, then by the
     relic's own roll (85% to 115%). */
  const RELIC_SCALE = { common: 1, uncommon: 1.1, rare: 1.25, legendary: 1.45 };
  const RELIC_SLOT2_LV = 10;
  function r1(n) { return Math.round(n * 10) / 10; }
  function relicNums(r) {
    if (!r) return {};
    const s = (RELIC_SCALE[r.rarity] || 1) * (typeof r.roll === "number" ? r.roll : 1);
    switch (r.kind) {
      case "hp": return { hp: r1(12 * s) };
      case "crit": return { crit: r1(14 * s) };
      case "shield": return { shield: r1(14 * s) };
      case "haste": return { cast: r1(18 * s), cd: r1(15 * s) };
      case "bounty": return { gold: Math.max(1, Math.round(6 * s)) };
      case "regen": return { regen: r1(2.4 * s) };
      case "pierce": return { pierce: r.rarity === "common" ? 1 : 2 };
      case "wind": return { at: 32, heal: Math.round(22 * s) };
      case "speed": return { spd: r1(10 * s) };
      case "glass": return { atk: r1(15 * s), def: Math.max(1, Math.round(2 * s)) };
      case "sand": return { cd: r1(22 * s) };
      case "atk": return { atk: r1(8 * s) };
      case "def": return { def: r1(2 * s) };
      case "renown": return { renown: 25 };
      case "revive": return { hp: Math.round(24 * s) };
      case "lifesteal": return { pct: r1(10 * s) };
      case "reflect": return { pct: r1(14 * s) };
      case "blink": return { n: 2, at: 50, cd: 8, dist: 150, guard: r1(0.42 * s) };
      case "grant": return { grant: r.grant };
      default: return {};
    }
  }
  function grantAbility(id) {
    const ids = Object.keys(IL.CLASSES || {});
    for (let i = 0; i < ids.length; i++) {
      const abs = IL.CLASSES[ids[i]].abilities || [];
      for (let j = 0; j < abs.length; j++) if (abs[j] && abs[j].id === id) return { ab: abs[j], cls: ids[i] };
    }
    return null;
  }
  function relicText(r) {
    if (!r) return "";
    const n = relicNums(r);
    const who = r.setBonus || r.scope !== "fighter" ? "Every fielded fighter: " : "The wearer: ";
    let t = "";
    switch (r.kind) {
      case "hp": t = "+" + n.hp + "% max HP."; break;
      case "crit": t = "+" + n.crit + "% critical hit chance."; break;
      case "shield": t = "starts each fight behind a shield worth " + n.shield + "% of max HP."; break;
      case "haste": t = "casts " + n.cast + "% faster, and abilities cool down " + n.cd + "% faster."; break;
      case "bounty": t = "each rival they knock out pays " + n.gold + " gold."; break;
      case "regen": t = "regains " + n.regen + " HP a second."; break;
      case "pierce": t = "shots pass through " + n.pierce + " more " + (n.pierce === 1 ? "enemy" : "enemies") + "."; break;
      case "wind": t = "once a fight, on dropping below " + n.at + "% HP, heals " + n.heal + "% of max HP."; break;
      case "speed": t = "+" + n.spd + "% move speed."; break;
      case "glass": t = "+" + n.atk + "% ATK, -" + n.def + " DEF."; break;
      case "sand": t = "abilities cool down " + n.cd + "% faster."; break;
      case "atk": t = "+" + n.atk + "% ATK."; break;
      case "def": t = "+" + n.def + " DEF."; break;
      case "renown": return "League and cup matches pay 25% more renown (once, however many you wear).";
      case "revive": t = "once a fight, a killing blow leaves them standing at " + n.hp + "% HP."; break;
      case "lifesteal": t = "heals " + n.pct + "% of the damage they deal."; break;
      case "reflect": t = "returns " + n.pct + "% of the damage they take to the attacker."; break;
      case "blink": t = "twice a fight (8s apart), when hit below " + n.at + "% HP, blinks " + n.dist + " px away from the attacker and dodges every hit for " + n.guard + "s."; break;
      case "grant": {
        const g = grantAbility(r.grant);
        return g ? "The wearer learns " + g.ab.name + " (a " + (IL.CLASSES[g.cls].name || g.cls) + " move) as an extra move, on top of their three." : r.blurb;
      }
      default: return r.blurb || "";
    }
    return who + t;
  }
  function relicScore(r) {
    if (!r) return 0;
    const base = { common: 1, uncommon: 1.3, rare: 1.7, legendary: 2.4 }[r.rarity] || 1;
    const econ = r.kind === "bounty" || r.kind === "renown" ? 0.55 : 1;
    return base * econ * (typeof r.roll === "number" ? r.roll : 1);
  }
  function relicRoll(save, id) {
    if (!save || !id) return 1;
    if (!save.relicRolls || typeof save.relicRolls !== "object") save.relicRolls = {};
    let v = save.relicRolls[id];
    if (typeof v !== "number" || !(v >= 0.85 && v <= 1.15)) {
      const h = IL.hashStr ? IL.hashStr(String(save.clubName || "") + ":" + id + ":" + (save.relicSalt || 0)) : 0;
      v = Math.round((0.85 + ((h >>> 0) % 1000) / 1000 * 0.3) * 100) / 100;
      save.relicRolls[id] = v;
    }
    return v;
  }
  function rolledRelic(save, r) {
    return r ? Object.assign({}, r, { roll: relicRoll(save, r.id) }) : null;
  }
  function wornIds(f) {
    const out = [];
    if (f && f.relic) out.push(f.relic);
    if (f && f.relic2 && (f.level || 1) >= RELIC_SLOT2_LV) out.push(f.relic2);
    return out;
  }

  const SETS = [
    { id: "wall", name: "Iron Wall", kind: "def", need: 2, blurb: "Two pieces of the wall raise defense for the party." },
    { id: "edge", name: "Keen Line", kind: "crit", need: 2, blurb: "Two pieces of the line make cuts land as criticals." },
    { id: "mend", name: "Mender's Circle", kind: "regen", need: 2, blurb: "Two pieces of the circle mend the party during the fight." },
    { id: "haste", name: "Quick Step", kind: "haste", need: 2, blurb: "Two pieces of the step bring casts back sooner." },
    { id: "glass", name: "Glass Pact", kind: "glass", need: 2, blurb: "Two pieces of the pact hit harder and wear less armor." },
    { id: "purse", name: "Purse Guild", kind: "bounty", need: 2, blurb: "Two pieces of the guild pay gold when a rival falls." },
    { id: "mark", name: "Quill Mark", kind: "pierce", need: 2, blurb: "Two pieces of the mark let a shot pass one more body." },
    { id: "breath", name: "Second Breath", kind: "wind", need: 2, blurb: "Two pieces of the breath catch the party once, at a low ebb." }
  ];

  const RELIC_BY = {};
  RELICS.forEach(function (r) { RELIC_BY[r.id] = r; });

  function relicById(id) { return RELIC_BY[id] || null; }

  const SET_BY = {};
  SETS.forEach(function (s) { SET_BY[s.id] = s; });

  function setById(id) { return SET_BY[id] || null; }

  function equippedRelics(save) {
    const ids = (save && save.equipped) || [];
    const out = [];
    for (let i = 0; i < ids.length; i++) {
      const r = relicById(ids[i]);
      if (r && r.scope !== "fighter") out.push(r);
    }
    return out;
  }

  /* Club slots plus relics worn by the fielded party. Two pieces of a set wake one club-wide bonus. */
  function relicPack(save, party) {
    const club = equippedRelics(save).map(function (r) { return rolledRelic(save, r); });
    const owned = (save && save.relics) || [];
    const worn = {};
    const active = club.slice();
    (party || []).forEach(function (f) {
      if (!f) return;
      wornIds(f).forEach(function (id) {
        const r = relicById(id);
        if (!r || r.scope !== "fighter") return;
        if (owned.indexOf(r.id) < 0) return;
        const rr = rolledRelic(save, r);
        (worn[f.id] = worn[f.id] || []).push(rr);
        active.push(rr);
      });
    });
    const counts = {};
    active.forEach(function (r) {
      if (r.set) counts[r.set] = (counts[r.set] || 0) + 1;
    });
    const sets = [];
    SETS.forEach(function (set) {
      if ((counts[set.id] || 0) >= set.need) {
        sets.push({
          id: "set-" + set.id,
          name: set.name,
          kind: set.kind,
          rarity: "common",
          blurb: set.blurb,
          setBonus: true
        });
      }
    });
    return { club: club, worn: worn, sets: sets };
  }

  const RARITY_MULT = { common: 1, uncommon: 1.28, rare: 1.75, legendary: 2.4 };
  const RARITY_NAME = { common: "Common", uncommon: "Uncommon", rare: "Rare", legendary: "Legendary" };
  const SPECIALTIES = [
    { id: "duelist", name: "Duelist", blurb: "A measured cut.", atk: 1 },
    { id: "berserker", name: "Berserker", blurb: "Swings a little harder.", atk: 1 },
    { id: "warden", name: "Warden", blurb: "Stands in the hit.", def: 1 },
    { id: "scout", name: "Scout", blurb: "First into the gap.", spd: 3 },
    { id: "medic", name: "Medic", blurb: "A little more to give.", hp: 5 },
    { id: "marksman", name: "Marksman", blurb: "Shots sit heavier.", atk: 1 }
  ];
  const WEEK_MS = 604800000;
  const DEAL_REROLL = 40;
  const CHEST_COST = 48;

  const MASTERIES = [
    { id: "execution", name: "Execution", blurb: "The last cut lands harder.", atk: 2 },
    { id: "bulwark", name: "Bulwark", blurb: "They wear the hit.", def: 2 },
    { id: "tempo", name: "Tempo", blurb: "They cross the pit quicker.", spd: 5 },
    { id: "grit", name: "Grit", blurb: "More left in the tank.", hp: 14 }
  ];
  const TASKS = [
    { id: "crits", name: "Land 20 crits", blurb: "Crits your party lands.", goal: 20, points: 1 },
    { id: "flawless", name: "Win without losing a fighter", blurb: "A win with the whole party still standing.", goal: 1, points: 1 },
    { id: "rivals", name: "Drop 10 rivals", blurb: "KOs your party scores.", goal: 10, points: 1 },
    { id: "blocks", name: "Block 15 hits", blurb: "Hits your party catches on a guard.", goal: 15, points: 1 }
  ];
  const FOCUS_COST = 1;
  const MASTERY_COST = 2;

  function specialtyOf(id) {
    for (let i = 0; i < SPECIALTIES.length; i++) if (SPECIALTIES[i].id === id) return SPECIALTIES[i];
    return null;
  }

  function masteryOf(id) {
    for (let i = 0; i < MASTERIES.length; i++) if (MASTERIES[i].id === id) return MASTERIES[i];
    return null;
  }

  function combatSpecialty(fighter) {
    if (!fighter) return null;
    if (fighter.focus) return specialtyOf(fighter.focus);
    return specialtyOf(fighter.specialty);
  }

  function spendSpec(payer, cost) {
    if (!payer) return true;
    if ((payer.specPoints || 0) < cost) return false;
    payer.specPoints -= cost;
    return true;
  }

  function chooseFocus(fighter, id, payer) {
    if (!fighter || (fighter.level || 1) < 5 || !specialtyOf(id)) return false;
    if (!spendSpec(payer, FOCUS_COST)) return false;
    fighter.focus = id;
    fighter.pendingFocus = false;
    return true;
  }

  function chooseMastery(fighter, id, payer) {
    if (!fighter || (fighter.level || 1) < 10 || !masteryOf(id)) return false;
    if (!spendSpec(payer, MASTERY_COST)) return false;
    fighter.mastery = id;
    fighter.pendingMastery = false;
    return true;
  }

  function noteTasks(save, match, win) {
    if (!save) return 0;
    if (!save.taskProg || typeof save.taskProg !== "object") save.taskProg = {};
    if (!save.taskDone || typeof save.taskDone !== "object") save.taskDone = {};
    let crits = 0;
    let kos = 0;
    let blocks = 0;
    let down = 0;
    (match && match.units || []).forEach(function (u) {
      if (!u || u.team !== 0 || u.summon) return;
      crits += u.critsLanded || 0;
      kos += u.kos || 0;
      blocks += u.blocks || 0;
      if (u.hp <= 0) down++;
    });
    const add = {
      crits: crits,
      rivals: kos,
      blocks: blocks,
      flawless: win && down === 0 ? 1 : 0
    };
    let gained = 0;
    TASKS.forEach(function (task) {
      if (save.taskDone[task.id]) return;
      const next = (save.taskProg[task.id] || 0) + (add[task.id] || 0);
      save.taskProg[task.id] = next;
      if (next >= task.goal) {
        save.taskDone[task.id] = true;
        save.specPoints = (save.specPoints || 0) + task.points;
        gained += task.points;
      }
    });
    return gained;
  }

  function rarityName(id) { return RARITY_NAME[id] || "Common"; }

  /* v114 the Legendary Expert and Shiny Catcher lean on every recruit
     roll; staffBoost(save) copies their stars in before the market rolls. */
  const BOOST = { legend: 0, shiny: 0 };
  function staffBoost(save) {
    BOOST.legend = staffStars(save, "expert");
    BOOST.shiny = staffStars(save, "shiny");
    return BOOST;
  }
  function rollRarity(rng) {
    const x = rng();
    if (x < 0.05 * (1 + 0.2 * BOOST.legend)) return "legendary";
    if (x < 0.18 + 0.03 * BOOST.legend) return "rare";
    if (x < 0.46) return "uncommon";
    return "common";
  }

  /* v94, after Eslabong: every recruit rolls a growth grade on each stat
     (Balanced, Good, Excellent: x1.0 / x1.3 / x1.6 on that stat's growth),
     better odds the rarer it is; one in 250 is Shiny (+20% base stats and
     at least one Excellent); a champion carries a second class's passive. */
  const GRADE_ODDS = { common: [0.18, 0.04], uncommon: [0.25, 0.07], rare: [0.32, 0.12], legendary: [0.4, 0.2] };
  const GRADE_MUL = { B: 1, G: 1.3, E: 1.6 };
  const SHINY_ODDS = 1 / 250;
  function rollGrades(rng, rarity, champion, shiny) {
    const odds = GRADE_ODDS[rarity] || GRADE_ODDS.common;
    const g = {};
    ["hp", "atk", "def", "spd"].forEach(function (k) {
      const x = rng();
      const ex = odds[1] + (champion ? 0.08 : 0);
      const gd = odds[0] + (champion ? 0.1 : 0);
      g[k] = x < ex ? "E" : x < ex + gd ? "G" : "B";
    });
    if (shiny && !["hp", "atk", "def", "spd"].some(function (k) { return g[k] === "E"; })) g[["hp", "atk", "def", "spd"][Math.floor(rng() * 4)]] = "E";
    return g;
  }
  function gradeOf(f, k) { return (f && f.grades && f.grades[k]) || "B"; }
  function gradeMul(f, k) { return GRADE_MUL[gradeOf(f, k)] || 1; }
  /* Potential: 1 to 5 stars from grades, rarity, champion and shiny. */
  function potentialOf(f) {
    if (!f) return 1;
    let pts = 0;
    ["hp", "atk", "def", "spd"].forEach(function (k) { const g = gradeOf(f, k); pts += g === "E" ? 2 : g === "G" ? 1 : 0; });
    pts += ({ common: 0, uncommon: 1, rare: 2, legendary: 3 })[f.rarity] || 0;
    if (f.champion) pts += 1;
    if (f.shiny) pts += 2;
    return Math.max(1, Math.min(5, 1 + Math.floor(pts / 2)));
  }
  function stampRecruit(fighter, rng, rarity) {
    fighter.rarity = rarity || rollRarity(rng);
    fighter.specialty = IL.pick(rng, SPECIALTIES).id;
    if (!fighter.shiny && rng() < SHINY_ODDS * (1 + 0.1 * BOOST.shiny)) fighter.shiny = true;
    if (!fighter.injuryRisk) { const ir = rng(); fighter.injuryRisk = ir < 0.3 ? "low" : ir < 0.8 ? "medium" : "high"; }
    fighter.grades = rollGrades(rng, fighter.rarity, !!fighter.champion, !!fighter.shiny);
    if (fighter.champion && !fighter.champPassive) {
      const own = IL.CLASSES[fighter.cls] && IL.CLASSES[fighter.cls].passive;
      const others = Object.keys(IL.CLASSES).map(function (id) { return IL.CLASSES[id].passive; }).filter(function (p) {
        return p && p.fx && (!own || p.id !== own.id);
      });
      if (others.length) fighter.champPassive = others[Math.floor(rng() * others.length)].id;
    }
    return fighter;
  }
  /* Recruit price and market value lean on potential. */
  function potentialMul(f) {
    return (1 + 0.08 * (potentialOf(f) - 1)) * (f && f.shiny ? 1.5 : 1);
  }

  function recruitCost(cls, rarity, champion) {
    let cost = Math.round(IL.hireCost(cls) * (RARITY_MULT[rarity] || 1));
    if (champion) cost = Math.round(cost * 1.65);
    return Math.max(22, cost);
  }

  function gearRefund(f) {
    if (!f || !IL.salvageValue) return 0;
    let n = 0;
    const gear = f.gear || {};
    ["weapon", "armor", "trinket"].forEach(function (slot) {
      if (gear[slot]) n += IL.salvageValue(gear[slot]);
    });
    if (f.tonic) n += IL.salvageValue(f.tonic);
    return Math.round(n * 0.35);
  }

  function sellValue(f) {
    const base = IL.hireCost(f.cls);
    const champ = f.champion ? 0.7 : 0.45;
    const rarityPay = { common: 1, uncommon: 1.08, rare: 1.2, legendary: 1.4 }[f.rarity] || 1;
    const levelPay = ((f.level || 1) - 1) * 8;
    return Math.max(22, Math.round(base * champ * rarityPay + levelPay) + gearRefund(f));
  }

  /* v72, after Eslabong: a performance score from the fighter's record,
     and a market value built on it. Score is 0-999: knockouts, damage,
     healing and wins per match, scaled by level. */
  function perfScore(f) {
    if (!f) return 0;
    const played = (f.wins || 0) + (f.losses || 0);
    if (!played) return 0;
    const c = f.career || {};
    const lv = Math.max(1, f.level || 1);
    const impact = ((c.dealt || 0) + (c.heal || 0) * 0.8) / played / (18 + lv * 4) +
      (f.kos || 0) / played * 0.7 + (f.wins || 0) / played * 0.9 + (f.mvps || 0) / played * 0.6;
    return Math.max(0, Math.min(999, Math.round(impact * 230)));
  }

  function perfLabel(score) {
    if (score >= 600) return "Excellent";
    if (score >= 450) return "Great";
    if (score >= 300) return "Good";
    if (score >= 150) return "Fair";
    return score > 0 ? "Poor" : "Unproven";
  }

  function marketValue(f) {
    if (!f) return 0;
    const base = IL.hireCost(f.cls) * (RARITY_MULT[f.rarity] || 1) * (f.champion ? 1.65 : 1) * potentialMul(f);
    const lv = Math.max(1, f.level || 1);
    let v = base * (1 + (lv - 1) * 0.2);
    v *= 1 + 0.05 * ((f.talents || []).length + Object.keys(f.specs || {}).length);
    const score = perfScore(f);
    if (score) v *= 0.85 + Math.min(0.95, score / 600 * 0.6);
    if (IL.staminaOf && IL.staminaOf(f) < 50) v *= 0.9;
    v += gearRefund(f);
    v += 100 * (f.allStars || 0);
    return Math.max(20, Math.round(v / 5) * 5);
  }

  const RELIC_COST = { common: 48, uncommon: 86, rare: 140, legendary: 210 };

  function relicPrice(id) {
    const relic = relicById(id);
    return RELIC_COST[(relic && relic.rarity) || "common"] || 48;
  }

  function relicSellPrice(id, save) {
    return Math.max(20, Math.round(relicPrice(id) * 0.4 * (staffSpec(save, "appraiser") ? 1.25 : 1)));
  }

  /* v95 five relics a week, each with its roll shown before you buy.
     Unowned relics first; the first slot is always rare or better. */
  function rollRelicStock(rng, save) {
    const owned = (save && save.relics) || [];
    const fresh = RELICS.filter(function (r) { return owned.indexOf(r.id) < 0; });
    const pool = (fresh.length >= 5 ? fresh : RELICS).slice();
    const out = [];
    const top = pool.filter(function (r) { return r.rarity === "rare" || r.rarity === "legendary"; });
    function take(relic) {
      pool.splice(pool.indexOf(relic), 1);
      const roll = Math.round((0.85 + rng() * 0.3) * 100) / 100;
      out.push({ id: relic.id, roll: roll, cost: Math.max(20, Math.round(relicPrice(relic.id) * (0.55 + 0.45 * roll) * (1 - 0.04 * staffStars(save, "hunter")) / 5) * 5), stock: 1 });
    }
    if (top.length) take(top[Math.floor(rng() * top.length)]);
    while (out.length < 5 && pool.length) take(pool[Math.floor(rng() * pool.length)]);
    return out;
  }
  function restockRelics(save, rng) {
    const key = (save.season || 1) * 100 + (save.round || 0);
    if (save.relicWeek === key && Array.isArray(save.relicStock) && save.relicStock.length) return false;
    save.relicWeek = key;
    save.relicStock = rollRelicStock(rng, save);
    return true;
  }

  /* v95 auto-equip: best club relics into the club slots, then the
     fielded party's slots by fit (front line: health, armor, reflect,
     revive; back line: damage, crits, haste, blink). Bench fighters
     hand theirs back. */
  const FRONT_ROLES = { melee: 1, tank: 1, hybrid: 1 };
  const FIT = {
    front: { hp: 1.3, def: 1.3, shield: 1.25, reflect: 1.4, revive: 1.4, lifesteal: 1.3, wind: 1.2, regen: 1.15, atk: 1, crit: 0.95, glass: 0.7, speed: 0.9, haste: 0.85, sand: 0.85, pierce: 0.3, blink: 0.8, grant: 1 },
    back: { atk: 1.3, crit: 1.25, glass: 1.2, haste: 1.25, sand: 1.25, blink: 1.4, speed: 1.1, revive: 1.2, lifesteal: 1.1, hp: 1, shield: 1, wind: 1, regen: 0.9, def: 0.85, reflect: 0.7, grant: 1, pierce: 1 }
  };
  function autoRelics(save, party) {
    if (!save) return 0;
    const owned = save.relics || [];
    const all = owned.map(function (id) { return rolledRelic(save, relicById(id)); }).filter(Boolean);
    const before = JSON.stringify([save.equipped, (save.roster || []).map(function (f) { return [f.relic, f.relic2]; })]);
    const clubs = all.filter(function (r) { return r.scope !== "fighter"; }).sort(function (a, b) { return relicScore(b) - relicScore(a); });
    const slots = IL.clubRelicSlots ? IL.clubRelicSlots(save) : 2;
    save.equipped = clubs.slice(0, slots).map(function (r) { return r.id; });
    (save.roster || []).forEach(function (f) { if (f) { f.relic = null; f.relic2 = null; } });
    const free = all.filter(function (r) { return r.scope === "fighter"; });
    const team = (party || []).filter(Boolean).slice().sort(function (a, b) { return (b.level || 1) - (a.level || 1); });
    [1, 2].forEach(function (slot) {
      team.forEach(function (f) {
        if (slot === 2 && (f.level || 1) < RELIC_SLOT2_LV) return;
        const kit = IL.CLASSES[f.cls] || {};
        const fit = FIT[FRONT_ROLES[kit.role] ? "front" : "back"];
        const have = wornIds(f).map(function (id) { return relicById(id); });
        let best = -1, bestV = 0;
        free.forEach(function (r, i) {
          if (r.kind === "pierce" && kit.role !== "kite") return;
          let v = relicScore(r) * (fit[r.kind] || 1);
          if (have.some(function (h) { return h && h.kind === r.kind; })) v *= 0.6;
          if (v > bestV) { bestV = v; best = i; }
        });
        if (best < 0) return;
        const r = free.splice(best, 1)[0];
        if (slot === 1) f.relic = r.id; else f.relic2 = r.id;
      });
    });
    const after = JSON.stringify([save.equipped, (save.roster || []).map(function (f) { return [f.relic, f.relic2]; })]);
    return before === after ? 0 : 1;
  }

  function weekIndex(now) { return Math.floor((now || 0) / WEEK_MS); }

  function msUntilWeek(now) {
    const t = now || 0;
    return Math.max(0, (weekIndex(t) + 1) * WEEK_MS - t);
  }

  function formatRemain(ms) {
    const left = Math.max(0, ms || 0);
    const d = Math.floor(left / 86400000);
    const h = Math.floor((left % 86400000) / 3600000);
    const m = Math.floor((left % 3600000) / 60000);
    if (d > 0) return d + "d " + h + "h";
    if (h > 0) return h + "h " + m + "m";
    return Math.max(1, m) + "m";
  }

  function rollDeals(rng, renown, week) {
    const open = IL.unlockedIds(renown);
    const all = Object.keys(IL.CLASSES);
    const champs = IL.CHAMPIONS.filter(function (c) { return IL.classUnlocked(c.cls, renown); });
    let fighter;
    if (champs.length && rng() < 0.7) {
      const champ = IL.pick(rng, champs);
      fighter = IL.randomFighter(rng, champ.cls);
      fighter.champion = true;
      fighter.name = champ.name;
    } else {
      fighter = IL.randomFighter(rng, IL.pick(rng, open.length ? open : all));
    }
    stampRecruit(fighter, rng, "legendary");
    const full = recruitCost(fighter.cls, "legendary", !!fighter.champion);
    const relics = [];
    const bag = RELICS.slice();
    while (relics.length < 2 && bag.length) {
      relics.push(bag.splice(Math.floor(rng() * bag.length), 1)[0].id);
    }
    const bundle = relics.reduce(function (n, id) { return n + relicPrice(id); }, 0);
    return {
      week: week,
      offers: [
        { kind: "fighter", fighter: fighter, cost: Math.max(40, Math.round(full * 0.72)), stock: 1 },
        { kind: "bundle", relics: relics, cost: Math.max(40, Math.round(bundle * 0.7)), stock: 1 },
        { kind: "chest", cost: CHEST_COST, stock: 1 }
      ].concat(dealExtras(week))
    };
  }

  function dealExtras(week) {
    const rng = IL.mulberry32((((week || 0) >>> 0) * 9176 + 11) >>> 0);
    const gear = IL.makeItem(rng, { bag: "stock" });
    const tome = IL.makeTome(rng, { bag: "stock" });
    const gearCost = IL.gearPrice ? IL.gearPrice(gear) : 20;
    const tomeCost = IL.gearPrice ? IL.gearPrice(tome) : 24;
    return [
      { kind: "gear", item: gear, cost: Math.max(8, Math.round(gearCost * 0.75)), stock: 1 },
      { kind: "tome", item: tome, cost: Math.max(8, Math.round(tomeCost * 0.8)), stock: 1 }
    ];
  }

  function openChest(rng, owned, save) {
    const have = owned || [];
    const gold = Math.round((24 + Math.floor(rng() * 46)) * (staffSpec(save, "lucky") ? 1.25 : 1));
    const missing = RELICS.filter(function (r) { return have.indexOf(r.id) < 0; });
    if (missing.length && rng() < 0.4 + 0.06 * staffStars(save, "hunter")) {
      return { gold: gold, relic: missing[Math.floor(rng() * missing.length)].id, item: null };
    }
    return { gold: gold, relic: null, item: IL.rollLoot ? IL.rollLoot(rng, "chest") : null };
  }

  function rollMarket(rng, renown, avoid) {
    const open = IL.unlockedIds(renown);
    const all = Object.keys(IL.CLASSES);
    const n = 4 + Math.floor(rng() * 3);
    const board = [];
    for (let i = 0; i < n; i++) {
      const championRoll = rng() < 0.14;
      let fighter;
      let cost;
      if (championRoll) {
        const pool = IL.CHAMPIONS.filter(function (c) { return IL.classUnlocked(c.cls, renown); });
        const champ = pool.length ? IL.pick(rng, pool) : null;
        if (champ) {
          fighter = IL.randomFighter(rng, champ.cls);
          fighter.champion = true;
          fighter.name = champ.name;
          const rarity = rollRarity(rng);
          stampRecruit(fighter, rng, (rarity === "common" || rarity === "uncommon") ? "rare" : rarity);
          cost = Math.round(recruitCost(champ.cls, fighter.rarity, true) * potentialMul(fighter));
        }
      }
      if (!fighter) {
        const cls = IL.pick(rng, open.length ? open : all);
        fighter = IL.randomFighter(rng, cls);
        stampRecruit(fighter, rng);
        cost = Math.round(recruitCost(cls, fighter.rarity, false) * potentialMul(fighter));
      }
      board.push({ fighter: fighter, cost: cost });
    }
    /* One locked preview, when anything is still locked, so the board teaches the gate. */
    const locked = all.filter(function (id) { return !IL.classUnlocked(id, renown); });
    if (locked.length && rng() < 0.85) {
      const cls = IL.pick(rng, locked);
      const fighter = IL.randomFighter(rng, cls);
      stampRecruit(fighter, rng);
      board.push({
        fighter: fighter,
        cost: recruitCost(cls, fighter.rarity, false),
        locked: true,
        need: IL.CLASSES[cls].renown || 0
      });
    }
    const people = board.map(function (row) { return row.fighter; });
    if (IL.dedupeNames) IL.dedupeNames(people);
    if (IL.separateNames) IL.separateNames(people, avoid && avoid.names);
    if (IL.separateLooks) IL.separateLooks(people, avoid && avoid.sheets);
    return board;
  }

  function grantXp(fighter, amount) {
    const prev = fighter.xp || 0;
    const next = prev + amount;
    const g = IL.growthFromXp(prev, next);
    fighter.xp = next;
    /* A level is never taken back, even if an old save sits off the curve. */
    const before = Math.max(fighter.level || 1, IL.xpLevel(prev));
    g.level = Math.max(before, g.level);
    fighter.level = g.level;
    /* One level-up pick per level gained (kits.js levelOffer). */
    if (g.level > before) fighter.pendingLevels = (fighter.pendingLevels || 0) + (g.level - before);
    if (before < 5 && g.level >= 5 && !fighter.focus) fighter.pendingFocus = true;
    if (before < 10 && g.level >= 10 && !fighter.mastery) fighter.pendingMastery = true;
    if (!fighter.boosts) fighter.boosts = { hp: 0, dmg: 0, spd: 0, def: 0 };
    return Math.max(0, g.level - before);
  }

  function applyBoost(fighter, key) {
    if (!fighter.boosts) fighter.boosts = { hp: 0, dmg: 0, spd: 0, def: 0 };
    if (!fighter.pendingPicks) return false;
    if (key !== "hp" && key !== "dmg" && key !== "spd" && key !== "def") return false;
    fighter.boosts[key] = (fighter.boosts[key] || 0) + 1;
    fighter.pendingPicks -= 1;
    if (!Array.isArray(fighter.perks)) fighter.perks = [];
    fighter.perks.push({ id: key, level: fighter.level || 1 });
    return true;
  }

  const SCHEMA = 2;

  function freshClubFields(seed) {
    return {
      schema: SCHEMA,
      renown: 0,
      tokens: 1,
      relics: [],
      equipped: [],
      relicSeason: 0,
      cup: null,
      market: null,
      history: [],
      division: 0,
      xpCurve: 2,
      settings: { speed: 1, shake: true, sound: 80, music: 60, crowd: 70 }
    };
  }

  function migrate(data) {
    if (!data || typeof data !== "object") return data;
    if (typeof data.renown !== "number") data.renown = 0;
    if (typeof data.tokens !== "number") data.tokens = 1;
    if (!Array.isArray(data.relics)) data.relics = [];
    if (!Array.isArray(data.equipped)) data.equipped = [];
    if (!Array.isArray(data.offers)) data.offers = [];
    data.equipped = data.equipped.filter(function (id) {
      const relic = relicById(id);
      return relic && relic.scope !== "fighter" && data.relics.indexOf(id) >= 0;
    }).slice(0, IL.clubRelicSlots ? IL.clubRelicSlots(data) : 2);
    if (typeof data.relicSeason !== "number") data.relicSeason = 0;
    if (!data.cup) data.cup = null;
    if (!Array.isArray(data.relicStock)) data.relicStock = [];
    data.relicStock = data.relicStock.filter(function (row) {
      return row && relicById(row.id) && typeof row.cost === "number" && row.cost > 0;
    });
    data.relicStock.forEach(function (row) { row.stock = row.stock > 0 ? 1 : 0; });
    if (!data.deals || typeof data.deals !== "object" || typeof data.deals.week !== "number" || !Array.isArray(data.deals.offers)) {
      data.deals = null;
    } else {
      data.deals.offers = data.deals.offers.filter(function (o) {
        return o && (o.kind === "fighter" || o.kind === "bundle" || o.kind === "chest" || o.kind === "gear" || o.kind === "tome") && typeof o.cost === "number";
      });
      if (data.deals.offers.length < 3) data.deals = null;
      else if (data.deals.offers.length < 5) {
        dealExtras(data.deals.week).forEach(function (row) {
          if (data.deals.offers.length < 5) data.deals.offers.push(row);
        });
      }
    }
    if (!data.endless || typeof data.endless !== "object") data.endless = { best: 0, board: [] };
    if (typeof data.endless.best !== "number") data.endless.best = 0;
    if (!Array.isArray(data.endless.board)) data.endless.board = [];
    data.endless.board = data.endless.board.filter(function (row) { return row && typeof row.wave === "number"; }).slice(0, 5);
    if (data.endlessRun && typeof data.endlessRun.wave !== "number") data.endlessRun = null;
    if (!data.daily || typeof data.daily !== "object") data.daily = { day: -1, cleared: false };
    if (typeof data.daily.day !== "number") data.daily.day = -1;
    if (typeof data.daily.cleared !== "boolean") data.daily.cleared = false;
    if (!data.weekClear || typeof data.weekClear.week !== "number" || typeof data.weekClear.id !== "string") data.weekClear = null;
    if (data.gauntlet && (!Array.isArray(data.gauntlet.fights) || data.gauntlet.fights.length !== 5)) data.gauntlet = null;
    if (!Array.isArray(data.history)) data.history = [];
    data.history = data.history.slice(0, 10);
    if (!data.settings || typeof data.settings !== "object") {
      data.settings = { speed: 1, shake: true, sound: 80, music: 60, crowd: 70 };
    } else {
      if (data.settings.speed !== 1 && data.settings.speed !== 2 && data.settings.speed !== 3) data.settings.speed = 1;
      if (typeof data.settings.shake !== "boolean") data.settings.shake = true;
      if (typeof data.settings.sound !== "number") data.settings.sound = 80;
      if (typeof data.settings.music !== "number") data.settings.music = 60;
      if (typeof data.settings.crowd !== "number") data.settings.crowd = 70;
    }
    if (!data.achieved || typeof data.achieved !== "object") data.achieved = {};
    ["bouts", "flawless", "cupsWon", "cupsEntered", "draftsWon", "draftsEntered", "watchSigned", "trainsDone", "salvaged", "chaosWins", "hires", "tonicsUsed", "seasonTitles", "unbeaten", "ceremonyPaid"].forEach(function (key) {
      if (typeof data[key] !== "number") data[key] = 0;
    });
    if (typeof data.goldPeak !== "number") data.goldPeak = data.gold || 0;
    if (typeof data.schema !== "number" || data.schema < SCHEMA) data.schema = SCHEMA;
    if (typeof data.tutored !== "boolean") {
      data.tutored = (data.bouts > 0) || (data.season > 1) || (data.round > 0) || (data.history && data.history.length > 0);
    }
    if (typeof data.crest !== "number" || data.crest < 1 || data.crest > 16) {
      data.crest = (IL.hashStr(data.clubName || "iron") % 16) + 1;
    }
    if (typeof data.plate !== "number" || data.plate < 0 || data.plate > 15) {
      data.plate = Math.max(0, (data.crest || 1) - 1);
    }
    if (typeof data.clubWins !== "number" || typeof data.clubLosses !== "number") {
      const hist = data.history || [];
      if ((data.bouts || 0) > 0 && hist.length === data.bouts) {
        data.clubWins = hist.filter(function (row) { return row && row.win; }).length;
        data.clubLosses = hist.length - data.clubWins;
      } else {
        const you = youRow(data);
        data.clubWins = you ? (you.w || 0) : 0;
        data.clubLosses = you ? (you.l || 0) : 0;
      }
    }
    const clubPool = (IL.CLUBS || []).filter(function (name) { return name && name !== data.clubName; });
    const nemesisKnown = data.nemesis && typeof data.nemesis === "object" && clubPool.indexOf(data.nemesis.name) >= 0;
    if (!nemesisKnown) {
      const prev = data.nemesis && typeof data.nemesis === "object" ? data.nemesis : {};
      const picked = clubPool.length ? clubPool[IL.hashStr(data.clubName || "iron") % clubPool.length] : "Red Kettle";
      data.nemesis = {
        name: picked,
        wins: typeof prev.wins === "number" ? prev.wins : 0,
        losses: typeof prev.losses === "number" ? prev.losses : 0,
        grudge: typeof prev.grudge === "number" ? prev.grudge : 0
      };
    }
    if (typeof data.nemesis.wins !== "number") data.nemesis.wins = 0;
    if (typeof data.nemesis.losses !== "number") data.nemesis.losses = 0;
    if (typeof data.nemesis.grudge !== "number") data.nemesis.grudge = 0;
    data.nemesis.grudge = Math.max(0, Math.min(3, data.nemesis.grudge | 0));
    if (!Array.isArray(data.seenClasses)) {
      const seen = {};
      (data.roster || []).forEach(function (f) { if (f && f.cls) seen[f.cls] = true; });
      data.seenClasses = Object.keys(seen);
    }
    if (!Array.isArray(data.roster)) return data;
    const oldCurve = data.xpCurve !== 2;
    data.xpCurve = 2;
    if (typeof data.division !== "number") {
      /* Seat an existing club by the level it has already reached. */
      const lvs = data.roster.map(function (f) { return (f && f.level) || 1; }).sort(function (a, b) { return b - a; }).slice(0, 3);
      const avg = lvs.length ? lvs.reduce(function (a, b) { return a + b; }, 0) / lvs.length : 1;
      data.division = avg >= 16 ? 4 : avg >= 12 ? 3 : avg >= 8 ? 2 : avg >= 4 ? 1 : 0;
    }
    data.roster.forEach(function (f) {
      if (!f.boosts) f.boosts = { hp: 0, dmg: 0, spd: 0, def: 0 };
      if (typeof f.pendingPicks !== "number") f.pendingPicks = 0;
      if (!f.personality) f.personality = "bold";
      if (!f.tactic) f.tactic = "strike";
      if (typeof f.champion !== "boolean") f.champion = false;
      if (typeof f.level !== "number") f.level = oldCurve ? 1 + Math.floor((f.xp || 0) / 40) : IL.xpLevel(f.xp || 0);
      if (typeof f.wins !== "number") f.wins = 0;
      if (typeof f.losses !== "number") f.losses = 0;
      if (typeof f.kos !== "number") f.kos = 0;
      if (!f.season || typeof f.season !== "object") f.season = { dealt: 0, taken: 0, heal: 0, kos: 0 };
      else {
        if (typeof f.season.dealt !== "number") f.season.dealt = 0;
        if (typeof f.season.taken !== "number") f.season.taken = 0;
        if (typeof f.season.heal !== "number") f.season.heal = 0;
        if (typeof f.season.kos !== "number") f.season.kos = 0;
      }
      if (!f.career || typeof f.career !== "object") {
        f.career = {
          dealt: f.season.dealt || 0,
          taken: f.season.taken || 0,
          heal: f.season.heal || 0,
          kos: f.season.kos || 0,
          moves: {}
        };
      } else {
        if (typeof f.career.dealt !== "number") f.career.dealt = f.season.dealt || 0;
        if (typeof f.career.taken !== "number") f.career.taken = f.season.taken || 0;
        if (typeof f.career.heal !== "number") f.career.heal = f.season.heal || 0;
        if (typeof f.career.kos !== "number") f.career.kos = f.season.kos || 0;
        if (!f.career.moves || typeof f.career.moves !== "object") f.career.moves = {};
      }
      if (!Array.isArray(f.perks)) f.perks = [];
      /* v65: move the flat 40-a-level xp onto the new curve, keeping the
         level and the share of it already earned. Runs once per save. */
      if (oldCurve && IL.xpFloor) {
        const lv = Math.max(1, f.level || (1 + Math.floor((f.xp || 0) / 40)));
        const into = Math.max(0, Math.min(0.99, ((f.xp || 0) - (lv - 1) * 40) / 40));
        f.level = lv;
        f.xp = IL.xpFloor(lv) + Math.round(into * IL.xpNeed(lv));
      }
      /* v62: older stat picks and level moves fold into one queue. */
      if (typeof f.pendingLevels !== "number" || f.pendingLevels < 0) f.pendingLevels = 0;
      if (f.pendingPicks > 0 || f.pendingMoves > 0) {
        f.pendingLevels += (f.pendingPicks > 0 ? f.pendingPicks : 0) + (f.pendingMoves > 0 ? f.pendingMoves : 0);
        f.pendingPicks = 0;
        f.pendingMoves = 0;
      }
      if (!f.ranks || typeof f.ranks !== "object") f.ranks = {};
      if (typeof f.pendingMoves !== "number") f.pendingMoves = 0;
      if (f.focus && !specialtyOf(f.focus)) f.focus = null;
      if (f.mastery && !masteryOf(f.mastery)) f.mastery = null;
      f.pendingFocus = (f.level || 1) >= 5 && !f.focus;
      f.pendingMastery = (f.level || 1) >= 10 && !f.mastery;
      if (!f.drillRanks || typeof f.drillRanks !== "object") f.drillRanks = {};
      if (IL.ensureMoves) IL.ensureMoves(f);
    });
    const wornOnce = {};
    data.roster.forEach(function (f) {
      if (!f) return;
      const worn = typeof f.relic === "string" ? relicById(f.relic) : null;
      const owned = worn && data.relics.indexOf(worn.id) >= 0;
      if (!worn || worn.scope !== "fighter" || !owned || wornOnce[worn.id]) f.relic = null;
      else wornOnce[worn.id] = true;
    });
    data.roster.forEach(function (f) {
      if (!f) return;
      const worn = typeof f.relic2 === "string" ? relicById(f.relic2) : null;
      const owned = worn && data.relics.indexOf(worn.id) >= 0;
      if (!worn || worn.scope !== "fighter" || !owned || wornOnce[worn.id]) f.relic2 = null;
      else wornOnce[worn.id] = true;
    });
    if (!data.relicRolls || typeof data.relicRolls !== "object") data.relicRolls = {};
    function stampMoves(f) {
      if (f && IL.ensureMoves) IL.ensureMoves(f);
    }
    (data.market || []).forEach(function (row) { if (row) stampMoves(row.fighter); });
    if (data.deals && data.deals.offers) {
      data.deals.offers.forEach(function (o) { if (o) stampMoves(o.fighter); });
    }
    (data.clubs || []).forEach(function (c) { (c.fighters || []).forEach(stampMoves); });
    if (data.cup && data.cup.slots) {
      data.cup.slots.forEach(function (s) { (s.fighters || []).forEach(stampMoves); });
    }
    if (typeof data.specPoints !== "number" || data.specPoints < 0) data.specPoints = 0;
    if (!data.taskProg || typeof data.taskProg !== "object") data.taskProg = {};
    if (!data.taskDone || typeof data.taskDone !== "object") data.taskDone = {};
    if (!data.specSeeded) {
      (data.roster || []).forEach(function (f) {
        if (!f) return;
        if ((f.level || 1) >= 5 && !f.focus) data.specPoints += FOCUS_COST;
        if ((f.level || 1) >= 10 && !f.mastery) data.specPoints += MASTERY_COST;
      });
      data.specSeeded = true;
    }
    if (!data.facilities || typeof data.facilities !== "object") data.facilities = {};
    (IL.FACILITIES || []).forEach(function (def) {
      const n = data.facilities[def.id];
      data.facilities[def.id] = typeof n === "number" && n > 0 ? Math.min(def.max, n | 0) : 0;
    });
    normalizeLineup(data);
    adoptSheets(data);
    if (IL.normalizeGear) IL.normalizeGear(data);
    if (IL.dedupeNames) {
      IL.dedupeNames(data.roster);
      (data.clubs || []).forEach(function (c) { IL.dedupeNames(c && c.fighters); });
      IL.dedupeNames((data.market || []).map(function (row) { return row && row.fighter; }));
      if (data.deals && data.deals.offers) {
        IL.dedupeNames(data.deals.offers.map(function (o) { return o && o.fighter; }));
      }
    }
    return data;
  }

  /* Captain, then level, then xp. Used only when a save has no lineup yet. */
  function legacyOrder(roster) {
    const cap = roster.filter(function (f) { return f.captain; })[0] || roster[0];
    const rest = roster.filter(function (f) { return f !== cap; }).slice().sort(function (a, b) {
      return ((b.level || 1) - (a.level || 1)) || ((b.xp || 0) - (a.xp || 0));
    });
    const ordered = [];
    if (cap) ordered.push(cap);
    for (let i = 0; i < rest.length; i++) ordered.push(rest[i]);
    return ordered;
  }

  function fielded(roster, lineup, n) {
    const byId = {};
    const list = roster || [];
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      if (f && f.id) byId[f.id] = f;
    }
    const out = [];
    const ids = lineup || [];
    const want = n > 0 ? n : 0;
    let hurt = 0;
    for (let i = 0; i < ids.length && out.length < want; i++) {
      const f = byId[ids[i]];
      if (!f || out.indexOf(f) >= 0) continue;
      /* v100 an injured fighter sits out; the best healthy bench fighter covers. */
      if (isInjured(f)) { hurt++; continue; }
      out.push(f);
    }
    if (hurt > 0) {
      const bench = list.filter(function (f) { return f && !isInjured(f) && out.indexOf(f) < 0 && ids.indexOf(f.id) < 0; })
        .sort(function (a, b) { return (b.level || 1) - (a.level || 1); });
      for (let i = 0; i < bench.length && hurt > 0 && out.length < want; i++, hurt--) out.push(bench[i]);
      /* Too few healthy fighters: the injured play hurt (85% HP and ATK) rather than leave a hole. */
      for (let i = 0; i < ids.length && hurt > 0 && out.length < want; i++) {
        const f = byId[ids[i]];
        if (f && isInjured(f) && out.indexOf(f) < 0) { out.push(f); hurt--; }
      }
    }
    return out;
  }

  /* ---------- v101 staff ----------
     Hired from a weekly staff market, one of each role. Stars (1 to 5)
     scale the effect. Slots: one, plus one a Club House rank. */
  const STAFF_ROLES = {
    trainer: { name: "Trainer", per: 4, text: function (n) { return "Match XP +" + n * 4 + "%."; } },
    medic: { name: "Medic", per: 1, text: function (n) { return "Injury chance -" + n + "% a knockout, healing " + n * 8 + "% cheaper."; } },
    scout: { name: "Scout", per: 25, text: function (n) { return "Champion approaches come " + n * 25 + "% more often, auctions " + n * 20 + "% more often."; } },
    coach: { name: "Captain Coach", per: 3, text: function (n) { return "Your captain fights with +" + n * 3 + "% HP and ATK."; } },
    treasurer: { name: "Treasurer", per: 4, text: function (n) { return "League and cup gold +" + n * 4 + "%."; } },
    hunter: { name: "Treasure Hunter", per: 6, text: function (n) { return "Chests find a relic " + n * 6 + "% more often; the relic stall is " + n * 4 + "% cheaper."; } },
    expert: { name: "Legendary Expert", per: 20, text: function (n) { return "Recruits roll legendary " + n * 20 + "% more often, and rare a little more often."; } },
    shiny: { name: "Shiny Catcher", per: 10, text: function (n) { return "Shiny recruits " + n * 10 + "% more often."; } }
  };
  /* v114 every hire carries one specialization on top of its role. */
  const STAFF_SPECS = [
    { id: "thrifty", name: "Thrifty", text: "Drills cost 3 gold less." },
    { id: "drillmaster", name: "Drillmaster", text: "Drills teach 3 more XP." },
    { id: "restful", name: "Restful", text: "The bench rests 4 more stamina a week." },
    { id: "appraiser", name: "Appraiser", text: "Relics sell for 25% more." },
    { id: "negotiator", name: "Negotiator", text: "Healing an injury costs 10% less." },
    { id: "lucky", name: "Lucky", text: "Chests hold 25% more gold." },
    { id: "scholar", name: "Scholar", text: "Match XP +3%." },
    { id: "bookkeeper", name: "Bookkeeper", text: "League and cup gold +3%." }
  ];
  function staffSpec(save, id) {
    const list = (save && save.staff) || [];
    for (let i = 0; i < list.length; i++) if (list[i] && list[i].spec === id) return true;
    return false;
  }
  function specById(id) { return STAFF_SPECS.filter(function (x) { return x.id === id; })[0] || null; }
  const STAFF_COST = [40, 80, 140, 230, 360];
  function staffSlots(save) {
    const n = save && save.facilities && typeof save.facilities.clubhouse === "number" ? Math.min(4, save.facilities.clubhouse | 0) : 0;
    return 1 + n;
  }
  function staffStars(save, role) {
    const list = (save && save.staff) || [];
    for (let i = 0; i < list.length; i++) if (list[i] && list[i].role === role) return Math.max(1, Math.min(5, list[i].stars | 0));
    return 0;
  }
  function rollStaff(rng, season) {
    const roles = Object.keys(STAFF_ROLES);
    const out = [];
    for (let i = 0; i < 3; i++) {
      const r = rng();
      const stars = r < 0.35 ? 1 : r < 0.65 ? 2 : r < 0.85 ? 3 : r < 0.96 ? 4 : 5;
      const role = roles[Math.floor(rng() * roles.length)];
      const name = IL.pick(rng, IL.FIRST) + " " + IL.pick(rng, IL.LAST);
      const spec = STAFF_SPECS[Math.floor(rng() * STAFF_SPECS.length)].id;
      out.push({ id: "st" + Math.floor(rng() * 1e9).toString(36), role: role, stars: stars, name: name, spec: spec,
        cost: Math.round(STAFF_COST[stars - 1] * (1 + 0.1 * Math.min(10, Math.max(0, (season || 1) - 1))) / 5) * 5 });
    }
    return out;
  }
  function restockStaff(save, rng) {
    const key = (save.season || 1) * 100 + (save.round || 0);
    if (save.staffWeek === key && Array.isArray(save.staffMarket) && save.staffMarket.length) return false;
    save.staffWeek = key;
    save.staffMarket = rollStaff(rng, save.season);
    return true;
  }
  function hireStaff(save, index) {
    const row = (save.staffMarket || [])[index];
    if (!row || (save.gold || 0) < row.cost) return false;
    if (!Array.isArray(save.staff)) save.staff = [];
    const same = save.staff.filter(function (s) { return s.role === row.role; })[0];
    if (!same && save.staff.length >= staffSlots(save)) return false;
    save.gold -= row.cost;
    if (same) save.staff.splice(save.staff.indexOf(same), 1);
    save.staff.push({ id: row.id, role: row.role, stars: row.stars, name: row.name, spec: row.spec || null });
    staffBoost(save);
    save.staffMarket.splice(index, 1);
    return true;
  }
  function fireStaff(save, id) {
    const before = (save.staff || []).length;
    save.staff = (save.staff || []).filter(function (s) { return s.id !== id; });
    staffBoost(save);
    return save.staff.length < before;
  }

  /* ---------- v100 injuries ----------
     A fighter knocked out in a league, cup or Champions Cup match may be
     injured for 1 to 3 league weeks, by its injury risk. The Medical Bay
     cuts the chance and the cost of healing. */
  const INJURY_RISK = { low: 0.06, medium: 0.12, high: 0.2 };
  const INJURY_NAME = { low: "Low", medium: "Medium", high: "High" };
  function injuryRiskOf(f) {
    if (f && INJURY_RISK[f.injuryRisk]) return f.injuryRisk;
    const h = IL.hashStr ? (IL.hashStr(String((f && f.id) || "f") + ":injury") >>> 0) % 10 : 5;
    return h < 3 ? "low" : h < 8 ? "medium" : "high";
  }
  function isInjured(f) { return !!(f && f.injury && f.injury.weeks > 0); }
  function bayRank(save) { return save && save.facilities ? (save.facilities.infirmary | 0) : 0; }
  function injuryChance(save, f) {
    return Math.max(0.01, INJURY_RISK[injuryRiskOf(f)] - 0.03 * bayRank(save) - 0.01 * staffStars(save, "medic"));
  }
  function rollInjury(save, f, rng) {
    if (!f || isInjured(f) || (save && save.settings && save.settings.injuries === false)) return 0;
    if (rng() >= injuryChance(save, f)) return 0;
    const r = rng();
    const weeks = r < 0.6 ? 1 : r < 0.9 ? 2 : 3;
    f.injury = { weeks: weeks, season: save ? save.season : 1 };
    return weeks;
  }
  function tickInjuries(save) {
    const healed = [];
    (save.roster || []).forEach(function (f) {
      if (!isInjured(f)) return;
      f.injury.weeks -= 1;
      if (f.injury.weeks <= 0) { f.injury = null; healed.push(f.name); }
    });
    return healed;
  }
  function healCost(save, f) {
    if (!isInjured(f)) return 0;
    const div = IL.DIVISIONS && save ? IL.DIVISIONS[IL.divisionOf(save)] : null;
    const mul = div && div.purse ? div.purse : 1;
    return Math.max(10, Math.round(45 * f.injury.weeks * mul * (1 - 0.25 * bayRank(save)) * (1 - 0.08 * staffStars(save, "medic")) * (staffSpec(save, "negotiator") ? 0.9 : 1) / 5) * 5);
  }
  function healInjury(save, f) {
    const cost = healCost(save, f);
    if (!cost || (save.gold || 0) < cost) return false;
    save.gold -= cost;
    f.injury = null;
    return true;
  }

  function normalizeLineup(data) {
    const roster = data.roster || [];
    const known = {};
    for (let i = 0; i < roster.length; i++) {
      if (roster[i] && roster[i].id) known[roster[i].id] = true;
    }
    const cap = IL.PARTY_CAP || 3;
    if (!Array.isArray(data.lineup)) {
      data.lineup = legacyOrder(roster).slice(0, cap).map(function (f) { return f.id; });
      return;
    }
    const seen = {};
    const next = [];
    for (let i = 0; i < data.lineup.length && next.length < cap; i++) {
      const id = data.lineup[i];
      if (!known[id] || seen[id]) continue;
      seen[id] = true;
      next.push(id);
    }
    data.lineup = next;
  }

  /* Layered Heroes99 parts become one Time Fantasy sheet. The same old
     loadout always lands on the same sheet, so a reload does not reshuffle. */
  function adoptSheet(f) {
    if (!f || typeof f !== "object") return;
    if (!IL.CLASSES[f.cls]) f.cls = "warrior";
    const id = f.parts && f.parts.sheet;
    if (typeof id === "string" && IL.sheetKnown(id)) {
      f.parts = { sheet: id };
      return;
    }
    const pool = IL.looksFor(f.cls);
    const seed = IL.hashStr(String(f.id || "") + "|" + (f.parts ? JSON.stringify(f.parts) : ""));
    f.parts = { sheet: pool[seed % pool.length] };
  }

  function adoptSheets(data) {
    (data.roster || []).forEach(adoptSheet);
    (data.clubs || []).forEach(function (c) { (c.fighters || []).forEach(adoptSheet); });
    (data.market || []).forEach(function (row) { if (row && row.fighter) adoptSheet(row.fighter); });
    if (data.cup && data.cup.slots) {
      data.cup.slots.forEach(function (s) { (s.fighters || []).forEach(adoptSheet); });
    }
  }

  function unownedRelics(save, rng) {
    const have = {};
    (save.relics || []).forEach(function (id) { have[id] = true; });
    const left = RELICS.filter(function (r) { return !have[r.id]; });
    if (!left.length) return null;
    return IL.pick(rng, left);
  }

  function offerRelic(save, rng) {
    const relic = unownedRelics(save, rng);
    if (!relic) return null;
    save.relics.push(relic.id);
    return relic;
  }

  function makeRivalSide(rng, name, n, data) {
    const fighters = [];
    const slot = Math.floor(rng() * RIVAL_SWING.length);
    for (let i = 0; i < n; i++) {
      const fighter = IL.themedFighter ? IL.themedFighter(rng, name) : IL.randomFighter(rng);
      if (IL.dressRival) IL.dressRival(fighter, rng, data ? divisionOf(data) : 0);
      if (data) growRival(fighter, rng, rivalLevel(data, slot, i));
      fighters.push(fighter);
    }
    if (IL.dedupeNames) IL.dedupeNames(fighters);
    if (IL.separateLooks) IL.separateLooks(fighters);
    return { id: "r" + Math.floor(rng() * 1e9).toString(36), name: name, you: false, fighters: fighters };
  }

  function startCup(save, rng, size) {
    const n = Math.max(1, Math.min(3, size | 0 || 2));
    const you = {
      id: "you",
      name: save.clubName,
      you: true,
      fighters: null
    };
    const pool = IL.CLUBS.filter(function (name) { return name !== save.clubName; });
    const rivals = [];
    while (rivals.length < 3 && pool.length) {
      const name = pool.splice(Math.floor(rng() * pool.length), 1)[0];
      rivals.push(makeRivalSide(rng, name, n, save));
    }
    const slots = [you].concat(rivals);
    return {
      size: n,
      round: 0,
      slots: slots,
      pairing: [[0, 1], [2, 3]],
      winners: [null, null],
      champion: null,
      claimed: false,
      tree: rivals.length >= 3 ? {
        semis: [
          { a: sideSnap(slots[0]), b: sideSnap(slots[1]), winner: null },
          { a: sideSnap(slots[2]), b: sideSnap(slots[3]), winner: null }
        ],
        final: { a: null, b: null, winner: null }
      } : null
    };
  }

  /* v76 Champions Cup, after Eslabong: when the league closes, its top
     four play 3v3 knockouts, 1st vs 4th and 2nd vs 3rd, then a final.
     A club that missed the top four sees it played out on its own. */
  function startChampionsCup(save, table) {
    const top = (table || []).slice(0, 4);
    if (top.length < 4) return null;
    function side(c) {
      return c.you
        ? { id: "you", name: save.clubName, you: true, fighters: null }
        : { id: c.id, name: c.name, you: false, fighters: (c.fighters || []).slice() };
    }
    const seeds = [top[0], top[3], top[1], top[2]].map(side);
    return {
      kind: "champions",
      season: save.season,
      size: 3,
      round: 0,
      slots: seeds,
      pairing: [[0, 1], [2, 3]],
      winners: [null, null],
      champion: null,
      claimed: false,
      tree: {
        semis: [
          { a: sideSnap(seeds[0]), b: sideSnap(seeds[1]), winner: null },
          { a: sideSnap(seeds[2]), b: sideSnap(seeds[3]), winner: null }
        ],
        final: { a: null, b: null, winner: null }
      }
    };
  }

  /* Play every tie that does not need you, round by round. */
  function settleCup(cup, roster, rng) {
    let guard = 0;
    while (cup && !cup.champion && guard < 4) {
      resolveOtherPairs(cup, roster, rng);
      if (cupOpponent(cup)) break;
      advanceCup(cup);
      guard++;
    }
    return cup;
  }

  function sideSnap(side) {
    if (!side) return null;
    return { id: side.id, name: side.name, you: !!side.you };
  }

  function stampTree(cup, pairIndex, winnerId) {
    if (!cup || !cup.tree) return;
    if ((cup.round || 0) >= 1) {
      if (cup.tree.final) cup.tree.final.winner = winnerId;
      return;
    }
    if (cup.tree.semis && cup.tree.semis[pairIndex]) cup.tree.semis[pairIndex].winner = winnerId;
  }

  function cupOpponent(cup) {
    if (!cup || cup.champion) return null;
    const pairs = cup.pairing || [];
    for (let i = 0; i < pairs.length; i++) {
      const a = cup.slots[pairs[i][0]];
      const b = cup.slots[pairs[i][1]];
      if (!a || !b) continue;
      if (a.you) return { pair: i, foe: b, you: a };
      if (b.you) return { pair: i, foe: a, you: b };
    }
    return null;
  }

  /* Strength proxy so the other semi does not need a full pit. */
  function sideStr(side, roster) {
    const list = side.you ? roster : (side.fighters || []);
    let s = 0;
    const n = Math.max(1, list.length);
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      const kit = IL.CLASSES[f.cls] || IL.CLASSES.warrior;
      s += (kit.hp / 140) + (kit.atk / 18) + ((f.level || 1) - 1) * 0.15 + (f.champion ? 0.35 : 0);
      if (IL.gearBonus) {
        const g = IL.gearBonus(f);
        s += (g.hp || 0) / 140 + (g.atk || 0) / 18;
      }
    }
    return s / n;
  }

  function resolveOtherPairs(cup, roster, rng) {
    const pairs = cup.pairing || [];
    for (let i = 0; i < pairs.length; i++) {
      if (cup.winners[i]) continue;
      const a = cup.slots[pairs[i][0]];
      const b = cup.slots[pairs[i][1]];
      if (!a || !b) continue;
      if (a.you || b.you) continue;
      const sa = sideStr(a, roster);
      const sb = sideStr(b, roster);
      const p = Math.max(0.2, Math.min(0.8, 0.5 + (sa - sb) * 0.35));
      cup.winners[i] = rng() < p ? a.id : b.id;
      stampTree(cup, i, cup.winners[i]);
    }
  }

  function noteCupResult(cup, pairIndex, winnerId) {
    cup.winners[pairIndex] = winnerId;
    stampTree(cup, pairIndex, winnerId);
  }

  function cupRoundReady(cup) {
    const pairs = cup.pairing || [];
    for (let i = 0; i < pairs.length; i++) if (!cup.winners[i]) return false;
    return true;
  }

  function advanceCup(cup) {
    if (!cupRoundReady(cup)) return cup;
    if (cup.round >= 1) {
      cup.champion = cup.winners[0];
      return cup;
    }
    if (cup.tree) {
      const fa = (cup.slots || []).filter(function (s) { return s.id === cup.winners[0]; })[0];
      const fb = (cup.slots || []).filter(function (s) { return s.id === cup.winners[1]; })[0];
      cup.tree.final = { a: sideSnap(fa), b: sideSnap(fb), winner: cup.tree.final && cup.tree.final.winner };
    }
    const next = [];
    for (let i = 0; i < cup.winners.length; i++) {
      const id = cup.winners[i];
      for (let s = 0; s < cup.slots.length; s++) if (cup.slots[s].id === id) next.push(cup.slots[s]);
    }
    if (next.length < 2) {
      cup.champion = next.length ? next[0].id : null;
      return cup;
    }
    cup.slots = next;
    cup.pairing = [[0, 1]];
    cup.winners = [null];
    cup.round = 1;
    return cup;
  }

  /* ---------- watchlist ----------
     A watched recruit stays on the board when it turns over. The board
     turns over for free after every league and cup match. A watched
     price drifts each turn, and another club may sign them first. */
  const WATCH_CAP = 3;
  const WATCH_SIGN = 0.14;

  function watchCount(save) {
    return (save.market || []).filter(function (r) { return r && r.watch && !r.locked; }).length;
  }

  function rollBoard(save, rng, avoid, kept) {
    const names = ((avoid && avoid.names) || []).slice();
    const sheets = ((avoid && avoid.sheets) || []).slice();
    kept.forEach(function (r) {
      names.push(String(r.fighter.name || "").split(" ")[0]);
      if (r.fighter.parts && r.fighter.parts.sheet) sheets.push(r.fighter.parts.sheet);
    });
    const fresh = rollMarket(rng, save.renown || 0, { names: names, sheets: sheets });
    const want = save.scout && IL.CLASSES[save.scout] ? save.scout : null;
    let found = false;
    if (want) {
      found = fresh.some(function (r) { return r.fighter.cls === want; });
      /* Scouting adds the wanted class on a little under half the turns. */
      if (!found && rng() < (IL.scoutOdds ? IL.scoutOdds(save) : 0.45)) {
        const fighter = IL.randomFighter(rng, want);
        stampRecruit(fighter, rng);
        if (IL.separateNames) IL.separateNames([fighter], names.concat(fresh.map(function (r) { return String(r.fighter.name).split(" ")[0]; })));
        if (IL.classUnlocked(want, save.renown || 0)) {
          fresh.unshift({ fighter: fighter, cost: recruitCost(want, fighter.rarity, false), scouted: true });
        } else {
          fresh.unshift({ fighter: fighter, cost: recruitCost(want, fighter.rarity, false), locked: true, need: IL.CLASSES[want].renown || 0, scouted: true });
        }
        found = true;
      }
    }
    /* v78: a rival club lists one of its own now and then, at its level
       and a little over value. */
    const lister = (save.clubs || []).filter(function (c) { return c && !c.you; });
    if (lister.length && rng() < 0.65) {
      const club = lister[Math.floor(rng() * lister.length)];
      const listing = rivalListing(save, rng, club.name, names.concat(fresh.map(function (r) { return String(r.fighter.name).split(" ")[0]; })));
      if (listing) fresh.push(listing);
    }
    save.market = kept.concat(fresh);
    return want && found ? IL.CLASSES[want].name : "";
  }

  function rivalListing(save, rng, clubName, avoidNames) {
    const fighter = IL.themedFighter ? IL.themedFighter(rng, clubName) : IL.randomFighter(rng);
    if (!fighter) return null;
    stampRecruit(fighter, rng);
    if (IL.dressRival) IL.dressRival(fighter, rng, divisionOf(save));
    growRival(fighter, rng, rivalLevel(save, Math.floor(rng() * RIVAL_SWING.length), Math.floor(rng() * 3)));
    if (IL.separateNames) IL.separateNames([fighter], avoidNames || []);
    if (!IL.classUnlocked(fighter.cls, save.renown || 0)) return null;
    const cost = Math.max(30, Math.round(marketValue(fighter) * 1.2 / 5) * 5);
    return { fighter: fighter, cost: cost, from: clubName };
  }

  /* v78 offers: after a league or cup week a rival may bid for one of your
     fighters, above market value. An offer lasts one week. */
  function rollOffers(save, rng) {
    const notes = [];
    if (!Array.isArray(save.offers)) save.offers = [];
    save.offers = save.offers.filter(function (o) { return o && o.season === save.season && (save.round || 0) - (o.round || 0) <= 1; });
    const rivals = (save.clubs || []).filter(function (c) { return c && !c.you; });
    const pool = (save.roster || []).filter(function (f) {
      return f && !f.captain && ((f.level || 1) >= 2 || (f.wins || 0) > 0) && !save.offers.some(function (o) { return o.fid === f.id; });
    });
    if (!rivals.length || !pool.length || save.offers.length >= 2 || rng() > 0.4) return notes;
    const f = pool[Math.floor(rng() * pool.length)];
    const club = rivals[Math.floor(rng() * rivals.length)];
    const gold = Math.max(40, Math.round(marketValue(f) * (1.15 + rng() * 0.55) / 5) * 5);
    save.offers.push({ id: "o" + save.season + "-" + (save.round || 0) + "-" + f.id, fid: f.id, fname: f.name, club: club.name, gold: gold, season: save.season, round: save.round || 0 });
    notes.push(club.name + " bid " + gold + " gold for " + f.name + ".");
    return notes;
  }

  function refreshBoard(save, rng, avoid) {
    const kept = (save.market || []).filter(function (r) { return r && r.watch && !r.locked; });
    return rollBoard(save, rng, avoid, kept);
  }

  function turnMarket(save, rng, avoid) {
    const notes = [];
    staffBoost(save);
    const kept = [];
    const rivals = IL.CLUBS.filter(function (n) { return n !== save.clubName; });
    (save.market || []).forEach(function (row) {
      if (!row || !row.watch || row.locked) return;
      if (rng() < WATCH_SIGN) {
        notes.push(IL.pick(rng, rivals) + " signed " + row.fighter.name + " off your watchlist.");
        return;
      }
      if (!row.base) row.base = row.cost;
      const was = row.cost;
      row.cost = Math.max(22, Math.round(row.base * (0.82 + rng() * 0.34)));
      if (row.cost < was) notes.push(row.fighter.name + " dropped to " + row.cost + " gold.");
      else if (row.cost > was) notes.push(row.fighter.name + " now asks " + row.cost + " gold.");
      kept.push(row);
    });
    const scouted = rollBoard(save, rng, avoid, kept);
    if (scouted) notes.push("Your scout found a " + scouted + ".");
    rollOffers(save, rng).forEach(function (n) { notes.push(n); });
    stepAuction(save, rng).forEach(function (n) { notes.push(n); });
    rollApproach(save, rng).forEach(function (n) { notes.push(n); });
    if (restockRelics(save, rng)) notes.push("The relic stall has new stock this week.");
    restockStaff(save, rng);
    return notes;
  }

  /* v94 champion approach: now and then a champion asks to join, at a
     price, for two weeks. */
  function makeStar(save, rng, shinyOnly) {
    const renown = save.renown || 0;
    const champs = (IL.CHAMPIONS || []).filter(function (c) { return IL.classUnlocked(c.cls, renown); });
    let f;
    if (!shinyOnly && champs.length) {
      const c = IL.pick(rng, champs);
      f = IL.randomFighter(rng, c.cls);
      f.champion = true;
      f.name = c.name;
      stampRecruit(f, rng, rng() < 0.4 ? "legendary" : "rare");
    } else {
      const open = IL.unlockedIds(renown);
      f = IL.randomFighter(rng, IL.pick(rng, open.length ? open : Object.keys(IL.CLASSES)));
      f.shiny = true;
      stampRecruit(f, rng, "legendary");
    }
    if (IL.growRival) growRival(f, rng, Math.max(1, clubLevel(save) - 1));
    return f;
  }
  function rollApproach(save, rng) {
    const notes = [];
    if (save.approach && (save.round || 0) - (save.approach.round || 0) > 2) save.approach = null;
    if (save.approach || (save.settings && save.settings.noChampions) || rng() > 0.12 * (1 + 0.25 * staffStars(save, "scout")) || (save.roster || []).length >= (IL.rosterCap ? IL.rosterCap(save) : 8)) return notes;
    const f = makeStar(save, rng, false);
    const cost = Math.max(80, Math.round(marketValue(f) * 0.9 / 5) * 5);
    save.approach = { fighter: f, cost: cost, round: save.round || 0, season: save.season };
    notes.push(f.name + ", a champion, asks to join for " + cost + " gold.");
    return notes;
  }

  /* v94 auction: one star a time (a champion, or a shiny), bid on over
     two league weeks against rival clubs. The highest bid when it closes
     signs; gold leaves only then. */
  function stepAuction(save, rng) {
    const notes = [];
    const a = save.auction;
    if (a && a.season === save.season) {
      if ((save.round || 0) >= a.closes) {
        if (a.leader === "you") {
          const room = (save.roster || []).length < (IL.rosterCap ? IL.rosterCap(save) : 8);
          if (room && (save.gold || 0) >= a.bid) {
            save.gold -= a.bid;
            a.fighter.lv0 = a.fighter.level || 1;
            a.fighter.lv0Season = save.season;
            save.roster.push(a.fighter);
            if (IL.dedupeNames) IL.dedupeNames(save.roster);
            notes.push("You won the auction: " + a.fighter.name + " joins for " + a.bid + " gold.");
          } else notes.push("The auction for " + a.fighter.name + " fell through: " + (room ? "not enough gold" : "no room on the roster") + ".");
        } else notes.push(a.leader + " won the auction for " + a.fighter.name + " at " + a.bid + " gold.");
        save.auction = null;
        return notes;
      }
      /* Rivals raise once or twice a week, less as the price climbs. */
      const cap = a.value * (1.3 + rng() * 0.5);
      for (let i = 0; i < 2; i++) {
        if (a.bid * 1.1 > cap || rng() > (a.leader === "you" ? 0.7 : 0.35)) break;
        const rivals = (save.clubs || []).filter(function (c) { return c && !c.you; });
        if (!rivals.length) break;
        a.bid = Math.round(a.bid * 1.1 / 5) * 5;
        a.leader = IL.pick(rng, rivals).name;
        notes.push(a.leader + " bids " + a.bid + " gold for " + a.fighter.name + ".");
      }
      return notes;
    }
    if (rng() > Math.min(0.9, 0.35 * (1 + 0.2 * staffStars(save, "scout")))) return notes;
    const f = makeStar(save, rng, rng() < 0.3);
    const value = marketValue(f);
    save.auction = { fighter: f, value: value, bid: Math.max(60, Math.round(value * 0.6 / 5) * 5), leader: "Opening bid", closes: (save.round || 0) + 2, season: save.season };
    notes.push("Auction: " + f.name + (f.shiny ? " (shiny)" : " (champion)") + " opens at " + save.auction.bid + " gold.");
    return notes;
  }
  function auctionBid(save) {
    const a = save.auction;
    if (!a || a.leader === "you") return false;
    const next = a.leader === "Opening bid" ? a.bid : Math.round(a.bid * 1.1 / 5) * 5;
    if ((save.gold || 0) < next) return false;
    a.bid = next;
    a.leader = "you";
    return true;
  }

  /* ---------- draft cup ----------
     Pick three mercenaries one at a time from offers of three, then
     run a four-club bracket at 3 vs 3. The roster stays home. Rivals
     draft from the same pool at the same level. A champion signs one
     of their three for free. */
  const DRAFT_COST = 40;
  const DRAFT_PICKS = 3;

  function draftLevel(save) {
    const levels = (save.roster || []).map(function (f) { return f.level || 1; }).sort(function (a, b) { return b - a; });
    const top = levels.slice(0, 3);
    if (!top.length) return 1;
    return Math.max(1, Math.round(top.reduce(function (a, b) { return a + b; }, 0) / top.length));
  }

  function draftFighter(rng, cls, level) {
    const fighter = IL.randomFighter(rng, cls);
    stampRecruit(fighter, rng);
    if (IL.dressRival) IL.dressRival(fighter, rng);
    growRival(fighter, rng, level);
    fighter.drafted = true;
    return fighter;
  }

  function draftOffer(rng, draft) {
    const ids = Object.keys(IL.CLASSES);
    const takenCls = draft.picks.map(function (f) { return f.cls; });
    const pool = ids.filter(function (id) { return takenCls.indexOf(id) < 0; });
    const offer = [];
    while (offer.length < 3 && pool.length) {
      const cls = pool.splice(Math.floor(rng() * pool.length), 1)[0];
      offer.push(draftFighter(rng, cls, draft.level));
    }
    const taken = draft.picks.map(function (f) { return String(f.name).split(" ")[0]; });
    if (IL.dedupeNames) IL.dedupeNames(offer);
    if (IL.separateNames) IL.separateNames(offer, taken);
    if (IL.separateLooks) IL.separateLooks(offer, draft.picks.map(function (f) { return f.parts && f.parts.sheet; }));
    return offer;
  }

  function startDraft(save, rng) {
    const draft = { stage: "pick", level: draftLevel(save), picks: [], offer: [], rerolls: 1, cup: null, signed: null };
    draft.offer = draftOffer(rng, draft);
    return draft;
  }

  function rerollDraft(draft, rng) {
    if (!draft || draft.stage !== "pick" || !(draft.rerolls > 0)) return false;
    draft.rerolls -= 1;
    draft.offer = draftOffer(rng, draft);
    return true;
  }

  function draftPick(save, draft, i, rng) {
    if (!draft || draft.stage !== "pick") return false;
    const f = draft.offer[i];
    if (!f) return false;
    draft.picks.push(f);
    if (draft.picks.length < DRAFT_PICKS) {
      draft.offer = draftOffer(rng, draft);
      return true;
    }
    draft.offer = [];
    draft.stage = "bracket";
    const you = { id: "you", name: save.clubName, you: true, fighters: null };
    const pool = IL.CLUBS.filter(function (name) { return name !== save.clubName; });
    const rivals = [];
    while (rivals.length < 3 && pool.length) {
      const name = pool.splice(Math.floor(rng() * pool.length), 1)[0];
      const ids = Object.keys(IL.CLASSES);
      const fighters = [];
      for (let k = 0; k < DRAFT_PICKS; k++) fighters.push(draftFighter(rng, IL.pick(rng, ids), draft.level));
      if (IL.dedupeNames) IL.dedupeNames(fighters);
      if (IL.separateLooks) IL.separateLooks(fighters);
      rivals.push({ id: "d" + Math.floor(rng() * 1e9).toString(36), name: name, you: false, fighters: fighters });
    }
    const slots = [you].concat(rivals);
    draft.cup = {
      size: DRAFT_PICKS,
      round: 0,
      slots: slots,
      pairing: [[0, 1], [2, 3]],
      winners: [null, null],
      champion: null,
      tree: {
        semis: [
          { a: sideSnap(slots[0]), b: sideSnap(slots[1]), winner: null },
          { a: sideSnap(slots[2]), b: sideSnap(slots[3]), winner: null }
        ],
        final: { a: null, b: null, winner: null }
      }
    };
    return true;
  }

  /* ---------- v114 relic tools ----------
     Reroll a relic's numbers for renown, lock it against selling, or
     trade it in for an unowned relic of the same rarity. */
  const RELIC_REROLL = 250;
  const RELIC_TRADE = 40;
  function relicLocked(save, id) { return !!(save && save.relicLocks && save.relicLocks[id]); }
  function lockRelic(save, id, on) {
    if (!save || (save.relics || []).indexOf(id) < 0) return false;
    if (!save.relicLocks || typeof save.relicLocks !== "object") save.relicLocks = {};
    if (on) save.relicLocks[id] = true; else delete save.relicLocks[id];
    return true;
  }
  function rerollRelic(save, id, rng) {
    if (!save || (save.relics || []).indexOf(id) < 0 || (save.renown || 0) < RELIC_REROLL) return 0;
    save.renown -= RELIC_REROLL;
    relicRoll(save, id);
    save.relicRolls[id] = Math.round((0.85 + rng() * 0.3) * 100) / 100;
    return save.relicRolls[id];
  }
  function dropRelic(save, id) {
    save.relics = (save.relics || []).filter(function (rid) { return rid !== id; });
    save.equipped = (save.equipped || []).filter(function (rid) { return rid !== id; });
    (save.roster || []).forEach(function (f) {
      if (f && f.relic === id) f.relic = null;
      if (f && f.relic2 === id) f.relic2 = null;
    });
    if (save.relicRolls) delete save.relicRolls[id];
    if (save.relicLocks) delete save.relicLocks[id];
  }
  function tradeTargets(save, id) {
    const r = relicById(id);
    if (!r) return [];
    const owned = save.relics || [];
    return RELICS.filter(function (x) { return x.rarity === r.rarity && x.id !== id && owned.indexOf(x.id) < 0; });
  }
  function tradeRelic(save, id, rng) {
    if (!save || (save.relics || []).indexOf(id) < 0 || relicLocked(save, id) || (save.renown || 0) < RELIC_TRADE) return null;
    const pool = tradeTargets(save, id);
    if (!pool.length) return null;
    const got = pool[Math.floor(rng() * pool.length)];
    save.renown -= RELIC_TRADE;
    dropRelic(save, id);
    save.relics.push(got.id);
    if (!save.relicRolls || typeof save.relicRolls !== "object") save.relicRolls = {};
    save.relicRolls[got.id] = Math.round((0.85 + rng() * 0.3) * 100) / 100;
    return got;
  }

  /* ---------- v114 Development Plans ----------
     Standing orders the club runs after each league or cup week: spend
     move upgrades and masteries, fill the academy, dress the party in
     relics, and heal the injured while the purse allows. */
  const PLAN_KEYS = ["upgrades", "masteries", "academy", "relics", "heal"];
  const HEAL_RESERVE = 150;
  function plansOf(save) {
    if (!save.plans || typeof save.plans !== "object") save.plans = {};
    return save.plans;
  }
  function planMastery(f) {
    const kit = IL.CLASSES[f.cls] || {};
    const front = kit.role === "melee" || kit.role === "tank" || kit.role === "hybrid";
    const want = front ? { hp: 1 / 14, def: 0.7 / 2, atk: 0.5 / 2, spd: 0.2 / 5 } : { atk: 1 / 2, spd: 0.5 / 5, hp: 0.45 / 14, def: 0.2 / 2 };
    const have = {};
    (f.masteries || []).forEach(function (id) { have[id] = (have[id] || 0) + 1; });
    let best = null, bestV = -1;
    MASTERIES.forEach(function (m) {
      const v = ((m.hp || 0) * want.hp + (m.atk || 0) * want.atk + (m.def || 0) * want.def + (m.spd || 0) * want.spd) * Math.pow(0.5, have[m.id] || 0);
      if (v > bestV) { bestV = v; best = m; }
    });
    return best;
  }
  function runPlans(save, rng, party) {
    const p = plansOf(save);
    const notes = [];
    const roster = save.roster || [];
    if (p.upgrades && IL.upgradesPending) {
      let n = 0;
      roster.forEach(function (f) {
        let guard = 20;
        while (guard-- > 0 && IL.upgradesPending(f) > 0) {
          const moves = (f.loadout || []).filter(function (id) { return IL.rankOf(f, id) < IL.RANK_MAX; });
          if (!moves.length) break;
          moves.sort(function (a, b) { return IL.rankOf(f, a) - IL.rankOf(f, b); });
          if (!IL.upgradeMove(f, moves[0])) break;
          n++;
        }
      });
      if (n) notes.push("Development Plan: " + n + " move upgrade" + (n === 1 ? "" : "s") + " spent.");
    }
    if (p.masteries && IL.masteriesPending) {
      let n = 0;
      roster.forEach(function (f) {
        let guard = 10;
        while (guard-- > 0 && IL.masteriesPending(f) > 0) {
          const m = planMastery(f);
          if (!m || !IL.addMastery(f, m.id)) break;
          n++;
        }
      });
      if (n) notes.push("Development Plan: " + n + " master" + (n === 1 ? "y" : "ies") + " picked.");
    }
    if (p.academy && save.academy && save.academy.season === save.season) {
      const busy = {};
      (party || []).forEach(function (f) { if (f) busy[f.id] = true; });
      const pool = roster.filter(function (f) { return academyEligible(f) && !busy[f.id] && save.academy.ids.indexOf(f.id) < 0 && !f.loan; })
        .sort(function (a, b) { return (a.level || 1) - (b.level || 1); });
      let n = 0;
      while (save.academy.ids.length < ACADEMY_SQUAD && pool.length) { if (setAcademy(save, pool.shift().id, true)) n++; }
      if (n) notes.push("Development Plan: " + n + " fighter" + (n === 1 ? "" : "s") + " sent to the academy.");
    }
    if (p.heal) {
      let n = 0;
      roster.filter(isInjured).sort(function (a, b) { return (b.level || 1) - (a.level || 1); }).forEach(function (f) {
        if ((save.gold || 0) - healCost(save, f) >= HEAL_RESERVE && healInjury(save, f)) n++;
      });
      if (n) notes.push("Development Plan: " + n + " fighter" + (n === 1 ? "" : "s") + " healed.");
    }
    if (p.relics && (save.relics || []).length && autoRelics(save, party || [])) notes.push("Development Plan: relics re-dressed.");
    return notes;
  }

  /* ---------- v115 club history ----------
     Season reviews saved at each ceremony, a cup history written once
     when each bracket closes, and lifetime numbers for every fighter who
     ever played for the club, gone or not. A profile that reaches
     Season 15 turns Veteran: every class opens and the Codex is whole. */
  const VETERAN_SEASON = 15;
  const REVIEWS_KEEP = 40;
  const CUPS_KEEP = 80;
  const ALLTIME_KEEP = 120;
  function noteSeasonReview(save, rev) {
    if (!Array.isArray(save.reviews)) save.reviews = [];
    if (save.reviews.some(function (r) { return r.season === rev.season; })) return false;
    save.reviews.unshift(rev);
    if (save.reviews.length > REVIEWS_KEEP) save.reviews.length = REVIEWS_KEEP;
    return true;
  }
  function noteCup(save, cup, name, champion, won) {
    if (!cup || cup.logged) return false;
    cup.logged = true;
    if (!Array.isArray(save.cupHistory)) save.cupHistory = [];
    save.cupHistory.unshift({ season: save.season, round: save.round || 0, cup: name, champion: champion || "—", won: !!won });
    if (save.cupHistory.length > CUPS_KEEP) save.cupHistory.length = CUPS_KEEP;
    return true;
  }
  function trackAlltime(save) {
    if (!save.alltime || typeof save.alltime !== "object") save.alltime = {};
    const book = save.alltime;
    const here = {};
    (save.roster || []).forEach(function (f) {
      if (!f || !f.id) return;
      here[f.id] = true;
      const c = f.career || {};
      book[f.id] = {
        name: f.name, cls: f.cls, level: f.level || 1,
        kos: f.kos || 0, dealt: Math.round(c.dealt || 0), heal: Math.round(c.heal || 0),
        mvps: f.mvps || 0, awards: f.awards || 0, games: (f.wins || 0) + (f.losses || 0), wins: f.wins || 0,
        seen: save.season || 1, gone: false
      };
    });
    Object.keys(book).forEach(function (id) { if (!here[id]) book[id].gone = true; });
    const ids = Object.keys(book);
    if (ids.length > ALLTIME_KEEP) {
      ids.filter(function (id) { return book[id].gone; })
        .sort(function (a, b) { return (book[a].games || 0) - (book[b].games || 0); })
        .slice(0, ids.length - ALLTIME_KEEP).forEach(function (id) { delete book[id]; });
    }
    return book;
  }
  function alltimeBoard(save, key, n) {
    const book = save.alltime || {};
    return Object.keys(book).map(function (id) { return Object.assign({ id: id }, book[id]); })
      .filter(function (r) { return (r[key] || 0) > 0; })
      .sort(function (a, b) { return (b[key] || 0) - (a[key] || 0); })
      .slice(0, n || 5);
  }

  /* v110 Rebirth: re-roll a fighter's growth grades for renown. */
  function rebirthCost(f) { return 150 + 75 * ((f && f.rebirths) || 0); }
  function rebirth(save, f, rng) {
    const cost = rebirthCost(f);
    if (!f || (save.renown || 0) < cost) return false;
    save.renown -= cost;
    f.grades = rollGrades(rng, f.rarity || "common", !!f.champion, !!f.shiny);
    f.rebirths = (f.rebirths || 0) + 1;
    return true;
  }

  /* ---------- v108 transfers: buy, swap and loan with rival clubs ----------
     A rival's fighter costs 25% over market value (leaders are never for
     sale). The club signs a replacement so it always keeps four. A bench
     fighter can be loaned in for two league weeks for 12% of value; your
     own bench can go out on loan for 8% a week and comes back with XP. */
  const LOAN_WEEKS = 2;
  function askingPrice(f) {
    if (!f || f.leader) return 0;
    return Math.max(40, Math.round(marketValue(f) * 1.25 / 5) * 5);
  }
  function clubOf(save, id) { return (save.clubs || []).filter(function (c) { return c && c.id === id; })[0] || null; }
  function rivalBench(club) {
    const starters = rivalPick(club, 3);
    return (club.fighters || []).filter(function (f) { return starters.indexOf(f) < 0; });
  }
  function refill(save, club, rng) {
    while ((club.fighters || []).length < 4) {
      const f = makeRivalSide(rng, club.name, 1, save).fighters[0];
      if (f) club.fighters.push(f); else break;
    }
    if (IL.dedupeNames) IL.dedupeNames(club.fighters);
  }
  function joinRoster(save, f) {
    f.lv0 = f.level || 1;
    f.lv0Season = save.season;
    f.captain = false;
    f.leader = false;
    save.roster.push(f);
    if (IL.dedupeNames) IL.dedupeNames(save.roster);
  }
  function roomFor(save) { return (save.roster || []).length < (IL.rosterCap ? IL.rosterCap(save) : 8); }
  function buyFromRival(save, clubId, fid, rng) {
    const club = clubOf(save, clubId);
    const f = club && (club.fighters || []).filter(function (x) { return x.id === fid; })[0];
    const cost = askingPrice(f);
    if (!f || !cost || (save.gold || 0) < cost || !roomFor(save)) return false;
    save.gold -= cost;
    club.fighters.splice(club.fighters.indexOf(f), 1);
    joinRoster(save, f);
    refill(save, club, rng);
    return cost;
  }
  function swapTopUp(f, yours) {
    return Math.max(0, askingPrice(f) - Math.round(marketValue(yours) * 0.9 / 5) * 5);
  }
  function swapWithRival(save, clubId, fid, yourId, rng) {
    const club = clubOf(save, clubId);
    const f = club && (club.fighters || []).filter(function (x) { return x.id === fid; })[0];
    const yours = (save.roster || []).filter(function (x) { return x.id === yourId; })[0];
    if (!f || !yours || yours.captain || yours.loan || !askingPrice(f)) return false;
    const top = swapTopUp(f, yours);
    if ((save.gold || 0) < top) return false;
    save.gold -= top;
    save.roster.splice(save.roster.indexOf(yours), 1);
    save.lineup = (save.lineup || []).filter(function (x) { return x !== yours.id; });
    club.fighters.splice(club.fighters.indexOf(f), 1, yours);
    joinRoster(save, f);
    return { top: top, gone: yours };
  }
  function loanFee(f) { return Math.max(10, Math.round(marketValue(f) * 0.12 / 5) * 5); }
  function loanIn(save, clubId, fid) {
    const club = clubOf(save, clubId);
    const f = club && rivalBench(club).filter(function (x) { return x.id === fid; })[0];
    const fee = loanFee(f);
    if (!f || f.leader || (save.gold || 0) < fee || !roomFor(save)) return false;
    save.gold -= fee;
    club.fighters.splice(club.fighters.indexOf(f), 1);
    f.loan = { club: club.id, weeks: LOAN_WEEKS };
    joinRoster(save, f);
    return fee;
  }
  function loanOutFee(f) { return Math.max(5, Math.round(marketValue(f) * 0.08 / 5) * 5) * LOAN_WEEKS; }
  function loanOut(save, fid, rng) {
    const f = (save.roster || []).filter(function (x) { return x.id === fid; })[0];
    const takers = (save.clubs || []).filter(function (c) { return c && !c.you; });
    if (!f || f.captain || f.loan || !takers.length) return false;
    const club = takers[Math.floor(rng() * takers.length)];
    const fee = loanOutFee(f);
    save.gold = (save.gold || 0) + fee;
    save.roster.splice(save.roster.indexOf(f), 1);
    save.lineup = (save.lineup || []).filter(function (x) { return x !== f.id; });
    if (!Array.isArray(save.loansOut)) save.loansOut = [];
    save.loansOut.push({ fighter: f, club: club.name, weeks: LOAN_WEEKS });
    return { fee: fee, club: club.name };
  }
  /* Once a league week. onLeave(f) runs before a loaned-in fighter goes home. */
  function tickLoans(save, onLeave) {
    const notes = [];
    (save.roster || []).slice().forEach(function (f) {
      if (!f.loan) return;
      f.loan.weeks -= 1;
      if (f.loan.weeks > 0) return;
      const club = clubOf(save, f.loan.club);
      if (onLeave) onLeave(f);
      save.roster.splice(save.roster.indexOf(f), 1);
      save.lineup = (save.lineup || []).filter(function (x) { return x !== f.id; });
      delete f.loan;
      if (club) club.fighters.push(f);
      notes.push(f.name + "'s loan ends; back to " + (club ? club.name : "their club") + ".");
    });
    save.loansOut = (save.loansOut || []).filter(function (row) {
      row.weeks -= 1;
      if (IL.grantXp) IL.grantXp(row.fighter, 25);
      if (row.weeks > 0) return true;
      save.roster.push(row.fighter);
      notes.push(row.fighter.name + " is back from loan at " + row.club + ".");
      return false;
    });
    return notes;
  }

  /* ---------- v107 difficulty ----------
     Rivals' HP and ATK in every fight but friend fights, a captain bonus
     in autobattle, gold, and season modifiers. Infernus adds 4% threat a
     season, to +60%. */
  const DIFFICULTY = {
    relaxed: { name: "Relaxed", foe: 0.85, cap: 0.15, gold: 1, mods: 2, blurb: "Rivals have 15% less HP and ATK, and your captain fights 15% stronger in autobattle." },
    normal: { name: "Normal", foe: 1, cap: 0, gold: 1, mods: 2, blurb: "The game as balanced." },
    hard: { name: "Hard", foe: 1.12, cap: 0, gold: 1.15, mods: 3, blurb: "Rivals have 12% more HP and ATK. Matches pay 15% more gold. Three season modifiers." },
    infernus: { name: "Infernus", foe: 1.2, cap: 0, gold: 1.3, mods: 4, blurb: "Rivals have 20% more HP and ATK, plus 4% threat a season (up to +60%). Matches pay 30% more gold. Four season modifiers." }
  };
  function difficultyOf(save) {
    const d = save && save.settings && save.settings.difficulty;
    return DIFFICULTY[d] ? d : "normal";
  }
  function foeMulOf(save) {
    const d = DIFFICULTY[difficultyOf(save)];
    const threat = difficultyOf(save) === "infernus" ? Math.min(0.6, 0.04 * Math.max(0, (save.season || 1) - 1)) : 0;
    return Math.round(d.foe * (1 + threat) * 1000) / 1000;
  }

  /* ---------- v106 named rival teams ----------
     Handcrafted clubs with a leader, a style, fixed classes and a
     signature move each. They enter the league by division and season. */
  const NAMED_TEAMS = [
    { name: "The Hooked Chain", leader: "Grend the Hook", style: "Grab and drag: they haul your back line into their front.", classes: ["tank", "lancer", "berserker", "warrior"], sig: { tank: "t-haul", lancer: "x-lancer-hook" }, ai: { target: "back" }, formation: "spear", minDiv: 0, minSeason: 1, relic: "aegis" },
    { name: "Choir of Embers", leader: "Mother Vell", style: "Sustain: a healer who raises the fallen behind a holy wall.", classes: ["healer", "paladin", "bard", "druid"], sig: { healer: "h-raise" }, ai: { retreat: "low" }, formation: "wall", minDiv: 0, minSeason: 1, relic: "phoenix" },
    { name: "Seekers of the Glass Eye", leader: "Oracle Venn", style: "Homing barrage: bolts and arrows that turn to follow.", classes: ["mage", "archer", "ranger", "gunslinger"], sig: { mage: "m-seek", archer: "a-seek" }, ai: { range: "far" }, formation: "spread", minDiv: 0, minSeason: 2, relic: "lens" },
    { name: "Rootbound", leader: "Elder Sorrel", style: "Root and punish: pinned in place, then picked apart.", classes: ["druid", "ranger", "monk", "archer"], sig: { druid: "dr-root", ranger: "n-root" }, ai: {}, formation: "line", minDiv: 0, minSeason: 2, relic: "chalice" },
    { name: "Hushwatch", leader: "Silent Marta", style: "Silence the casters, then cut them down.", classes: ["bard", "mage", "assassin", "rogue"], sig: { bard: "bd-hush", mage: "x-mage-silence" }, ai: { target: "back" }, formation: "spear", minDiv: 1, minSeason: 1, relic: "blinkstone" },
    { name: "Stormfront Legion", leader: "Captain Aster", style: "Chain lightning through a packed line.", classes: ["battlemage", "elementalist", "warrior", "shieldbearer"], sig: { battlemage: "bm-chain" }, ai: { aoe: "any", ff: "calc" }, formation: "line", minDiv: 1, minSeason: 2, relic: "echo" },
    { name: "Night Tithe", leader: "Count Morrow", style: "Drain: every hit feeds them.", classes: ["warlock", "necromancer", "assassin", "tank"], sig: { warlock: "wl-leech", necromancer: "x-necromancer-drain" }, ai: {}, formation: "line", minDiv: 1, minSeason: 3, relic: "bloodvine" },
    { name: "Iron Phalanx", leader: "Strategos Hale", style: "A shield wall that never breaks rank.", classes: ["shieldbearer", "spearmaiden", "paladin", "archer"], sig: {}, ai: { retreat: "never" }, formation: "wall", minDiv: 2, minSeason: 1, relic: "oath" },
    { name: "Red Dune Raiders", leader: "Kesh the Quick", style: "Dive: they go for your casters first.", classes: ["rogue", "assassin", "skirmisher", "duelist"], sig: {}, ai: { target: "back" }, formation: "spear", minDiv: 2, minSeason: 2, relic: "spur" },
    { name: "Beast Court", leader: "Warden Fang", style: "Summons: hounds, bones and spirits on every side.", classes: ["beastmaster", "summoner", "necromancer", "druid"], sig: {}, ai: {}, formation: "spread", minDiv: 2, minSeason: 3, relic: "knot" },
    { name: "Twin Blade School", leader: "Master Ren", style: "Duelists: clean cuts, one foe at a time.", classes: ["samurai", "duelist", "monk", "lancer"], sig: {}, ai: { target: "weak" }, formation: "line", minDiv: 3, minSeason: 2, relic: "thorn" },
    { name: "The Long Fuse", leader: "Pyra Gale", style: "Bombs and blasts, and they do not mind friendly fire.", classes: ["alchemist", "gunslinger", "elementalist", "mage"], sig: {}, ai: { aoe: "any", ff: "natural" }, formation: "spread", minDiv: 3, minSeason: 3, relic: "heart" }
  ];
  function namedTeam(name) { for (let i = 0; i < NAMED_TEAMS.length; i++) if (NAMED_TEAMS[i].name === name) return NAMED_TEAMS[i]; return null; }
  function eligibleNamed(save) {
    const tier = divisionOf(save);
    return NAMED_TEAMS.filter(function (t) { return t.minDiv <= tier && t.minSeason <= (save.season || 1) && t.name !== save.clubName; });
  }
  /* Four fighters; the first is the leader: a champion, captain and a
     level up, with the team's named relic. */
  function namedFighters(save, team, rng, levelOf) {
    const out = team.classes.map(function (cls, k) {
      const f = IL.randomFighter(rng, cls);
      if (IL.dressRival) IL.dressRival(f, rng, divisionOf(save));
      growRival(f, rng, k === 0 ? Math.max(levelOf(k), Math.min(levelOf(k) + 2, rivalRange(save)[1])) : levelOf(k));
      if (IL.ensureMoves) IL.ensureMoves(f);
      const sig = team.sig[cls];
      if (sig && IL.abilityById && IL.abilityById(sig)) {
        if (f.known.indexOf(sig) < 0) f.known.push(sig);
        if (f.learned.indexOf(sig) < 0) f.learned.push(sig);
        if (f.loadout.indexOf(sig) < 0) f.loadout[Math.min(1, f.loadout.length - 1)] = sig;
      }
      f.ai = Object.assign({}, team.ai);
      if (k === 0) {
        f.name = team.leader;
        f.champion = true;
        f.captain = true;
        f.rarity = "legendary";
        f.leader = true;
        if (team.relic && relicById(team.relic) && relicById(team.relic).scope === "fighter") f.relic = team.relic;
      }
      return f;
    });
    if (IL.separateLooks) IL.separateLooks(out);
    return out;
  }
  /* v106 rivals rest tired fighters and wear relics. */
  function rivalPick(club, size) {
    const list = ((club && club.fighters) || []).slice();
    list.sort(function (a, b) {
      const ta = IL.staminaOf && IL.staminaOf(a) < 50 ? 1 : 0;
      const tb = IL.staminaOf && IL.staminaOf(b) < 50 ? 1 : 0;
      return ta - tb || (b.leader ? 1 : 0) - (a.leader ? 1 : 0) || (b.level || 1) - (a.level || 1);
    });
    return list.slice(0, size);
  }
  function rivalTire(club, used) {
    const ids = {};
    (used || []).forEach(function (f) { if (f) ids[f.id] = true; });
    ((club && club.fighters) || []).forEach(function (f) {
      const was = IL.staminaOf ? IL.staminaOf(f) : 100;
      f.stamina = ids[f.id] ? Math.max(0, was - (IL.STAMINA_COST || 20)) : Math.min(IL.STAMINA_MAX || 100, was + (IL.STAMINA_REST || 34));
    });
  }
  function dressRivalRelics(club, rng, tier) {
    const clubs = RELICS.filter(function (r) { return r.scope !== "fighter" && (r.rarity !== "legendary" || tier >= 2) && r.kind !== "renown" && r.kind !== "bounty"; });
    const n = tier >= 3 ? 2 : tier >= 1 ? 1 : (rng() < 0.5 ? 1 : 0);
    club.equipped = [];
    for (let i = 0; i < n && clubs.length; i++) club.equipped.push(clubs.splice(Math.floor(rng() * clubs.length), 1)[0].id);
    const wear = RELICS.filter(function (r) { return r.scope === "fighter" && (r.rarity !== "legendary" || tier >= 2) && r.kind !== "renown" && r.kind !== "bounty"; });
    (club.fighters || []).forEach(function (f) {
      if (f.relic || rng() > 0.25 + 0.12 * tier || !wear.length) return;
      f.relic = wear.splice(Math.floor(rng() * wear.length), 1)[0].id;
    });
  }
  /* v106 Rival preparations: named teams, and every club from the Bronze
     Division up, read your last three league lineups and counter them. */
  function rivalPrep(save, club) {
    if (!club || (!club.named && divisionOf(save) < 2)) return null;
    const recent = (save.recentRoles || []).slice(0, 3);
    if (!recent.length) return null;
    let back = 0, front = 0, all = 0, heal = 0;
    recent.forEach(function (roles) {
      roles.forEach(function (r) { all++; if (r === "kite" || r === "cast" || r === "support") back++; else front++; if (r === "support") heal++; });
    });
    if (!all) return null;
    if (back / all >= 0.5) return { ai: { target: "back" }, formation: "spear", text: "They studied your last " + recent.length + " matches and will dive your back line." };
    if (heal >= recent.length) return { ai: { target: "back" }, formation: "line", text: "They studied your last " + recent.length + " matches and will go for your healer." };
    return { ai: { range: "far", aoe: "any" }, formation: "spread", text: "They studied your last " + recent.length + " matches and will spread out and keep away from your front line." };
  }

  /* ---------- v113 new modes ---------- */
  /* Alliance rounds (the second Thunder Cup): each round you team up with
     one rival club, rotating, against the other two. The winning pair
     scores 2 points each. */
  function allianceSides(save) {
    const t = save.thunder;
    if (!t || t.done || t.format !== "alliance") return null;
    const yours = fielded(save.roster, save.lineup, t.size);
    if (yours.length < t.size) return null;
    const ally = 1 + (t.round % 3);
    const foes = [1, 2, 3].filter(function (i) { return i !== ally; });
    return {
      ally: ally,
      left: yours.concat(t.clubs[ally].fighters.slice(0, t.size)),
      right: t.clubs[foes[0]].fighters.slice(0, t.size).concat(t.clubs[foes[1]].fighters.slice(0, t.size)),
      allyName: t.clubs[ally].name,
      foeName: t.clubs[foes[0]].name + " & " + t.clubs[foes[1]].name
    };
  }
  function scoreAlliance(save, win) {
    const t = save.thunder;
    if (!t || t.done) return null;
    const ally = 1 + (t.round % 3);
    t.clubs.forEach(function (c, i) {
      const onYours = i === 0 || i === ally;
      const won = onYours === !!win;
      if (won) c.pts += 2;
      c.places.push(won ? 1 : 2);
    });
    t.round += 1;
    if (t.round >= THUNDER_ROUNDS) {
      t.done = true;
      t.finish = thunderTable(t).indexOf(t.clubs[0]) + 1;
    }
    return t;
  }

  /* Hall of Legends: four handcrafted challenges, three threat levels,
     4v4 against your best four. Each fielded fighter spends 15 stamina.
     The first clear of each threat pays. */
  const HALL = [
    { id: "leaders", name: "Council of Leaders", blurb: "Four named-team leaders, together for once.", classes: ["tank", "healer", "mage", "rogue"], champ: true },
    { id: "wardens", name: "The Gate Wardens", blurb: "Three giants of the Iron Gate and their keeper.", classes: ["tank", "berserker", "shieldbearer", "warlock"], giant: true },
    { id: "storm", name: "The Storm Choir", blurb: "Blasts on every side, and they fire through each other.", classes: ["battlemage", "elementalist", "mage", "bard"], ai: { aoe: "any", ff: "natural" } },
    { id: "blades", name: "Hall of Blades", blurb: "Four masters of the cut.", classes: ["samurai", "duelist", "frostknight", "assassin"], ai: { target: "weak" } }
  ];
  const HALL_SIZE = 4;
  function hallFoes(save, id, threat, rng) {
    const h = HALL.filter(function (x) { return x.id === id; })[0];
    if (!h) return [];
    const lv = Math.min(IL.LEVEL_CAP || 100, clubAverage(save) + 2 + threat * 3);
    return h.classes.map(function (cls, i) {
      const f = IL.randomFighter(rng, cls);
      if (IL.dressRival) IL.dressRival(f, rng, Math.min(4, divisionOf(save) + threat));
      growRival(f, rng, lv);
      f.id = "hall-" + id + "-" + i;
      if (h.champ) { f.champion = true; f.rarity = "legendary"; }
      if (h.ai) f.ai = Object.assign({}, h.ai);
      f.hallMul = 1 + 0.15 * threat + (h.giant ? 0.35 : 0);
      return f;
    });
  }
  function hallPay(save, id, threat) {
    const key = id + ":" + threat;
    if (!save.hall || typeof save.hall !== "object") save.hall = {};
    const first = !save.hall[key];
    save.hall[key] = (save.hall[key] || 0) + 1;
    return first ? { gold: 120 * threat, renown: 18 * threat, first: true } : { gold: 15 * threat, renown: 2 * threat, first: false };
  }

  /* Tournament Center: every four league weeks a different 1v1 event; you
     enter one eligible fighter, who must win three straight bouts. */
  const TOURNEYS = [
    { id: "front", name: "Front-line Open", roles: ["melee", "tank", "dash"], blurb: "Melee fighters, tanks and duelists only." },
    { id: "marks", name: "Marksman's Cup", roles: ["kite"], blurb: "Bows and guns only." },
    { id: "spell", name: "Spell Duel", roles: ["cast", "support", "hybrid"], blurb: "Casters, supports and hybrids only." },
    { id: "rookie", name: "Rookie Development Cup", maxLevel: 12, blurb: "Fighters of level 12 or less." }
  ];
  const TOURNEY_FEE = 30;
  function tourneyNow(save) {
    const slot = Math.floor((save.round || 0) / 4);
    return { def: TOURNEYS[(slot + (save.season || 1)) % TOURNEYS.length], key: (save.season || 1) * 100 + slot };
  }
  function tourneyEligible(save, f) {
    const t = tourneyNow(save).def;
    const kit = IL.CLASSES[f.cls] || {};
    if (t.maxLevel) return (f.level || 1) <= t.maxLevel;
    return t.roles.indexOf(kit.role) >= 0;
  }
  function tourneyFoe(save, stage, rng) {
    const t = tourneyNow(save).def;
    const open = Object.keys(IL.CLASSES).filter(function (c) { return t.maxLevel || t.roles.indexOf(IL.CLASSES[c].role) >= 0; });
    const f = IL.randomFighter(rng, IL.pick(rng, open));
    const yours = (save.roster || []).filter(function (x) { return save.tourney && x.id === save.tourney.fid; })[0];
    const base = yours ? yours.level || 1 : clubAverage(save);
    growRival(f, rng, Math.max(1, Math.min(t.maxLevel || (IL.LEVEL_CAP || 100), base - 1 + stage)));
    f.id = "tour-" + stage;
    return f;
  }

  /* Challenge Tower (offline): a ladder of generated teams, normalized to
     level 30 on both sides, with an Elo-style rating from 1500. */
  const TOWER_LV = 30;
  function towerOf(save) {
    if (!save.tower || typeof save.tower !== "object") save.tower = { rating: 1500, floor: 1, best: 0, wins: 0, losses: 0 };
    return save.tower;
  }
  function towerFoes(floor) {
    const rng = IL.mulberry32((floor * 7919 + 13) >>> 0);
    const ids = Object.keys(IL.CLASSES);
    return [0, 1, 2].map(function (i) {
      const f = IL.randomFighter(rng, IL.pick(rng, ids));
      growRival(f, rng, TOWER_LV);
      f.id = "tw-" + floor + "-" + i;
      f.hallMul = 1 + Math.min(0.6, floor * 0.02);
      return f;
    });
  }
  function towerRating(floor) { return 1400 + floor * 30; }
  function towerCopy(f) {
    const c = JSON.parse(JSON.stringify(f));
    c.level = TOWER_LV;
    c.xp = IL.xpFloor ? IL.xpFloor(TOWER_LV) : 0;
    c.stamina = 100;
    c.injury = null;
    return c;
  }
  function towerResult(save, win) {
    const t = towerOf(save);
    const e = 1 / (1 + Math.pow(10, (towerRating(t.floor) - t.rating) / 400));
    const delta = Math.round(32 * ((win ? 1 : 0) - e));
    t.rating += delta;
    if (win) { t.wins++; t.floor++; } else t.losses++;
    const newBest = win && t.floor - 1 > t.best;
    if (newBest) t.best = t.floor - 1;
    return { delta: delta, newBest: newBest };
  }

  /* All-Star match: once a season, from week 14, your three highest-Impact
     fighters against the league's three highest-level rivals. */
  function allStarOpen(save) {
    return (save.round || 0) >= 13 && save.allStarSeason !== save.season;
  }
  function allStarSides(save) {
    const mine = (save.roster || []).filter(function (f) { return !isInjured(f); }).slice().sort(function (a, b) {
      return ((b.season && b.season.impact) || 0) - ((a.season && a.season.impact) || 0) || (b.level || 1) - (a.level || 1);
    }).slice(0, 3);
    const theirs = [];
    (save.clubs || []).forEach(function (c) { if (c && !c.you) (c.fighters || []).forEach(function (f) { theirs.push(f); }); });
    theirs.sort(function (a, b) { return (b.level || 1) - (a.level || 1); });
    return { left: mine, right: theirs.slice(0, 3) };
  }

  /* ---------- v103 Academy ----------
     Up to four fighters of level 20 or less train in the academy. Once a
     league week they play a 3v3 academy fixture that does not advance the
     week or cost stamina. Wins earn Development Tomes; a tome lifts a
     low-level fighter to the club's average level (two a season). */
  const ACADEMY_MAX_LV = 20;
  const ACADEMY_SQUAD = 4;
  const ACADEMY_SIZE = 3;
  const TOMES_A_SEASON = 2;
  function weekKey(save) { return (save.season || 1) * 100 + (save.round || 0); }
  function ensureAcademy(save, rng) {
    const a = save.academy;
    if (a && a.season === save.season && Array.isArray(a.table)) return a;
    const rivals = (save.clubs || []).filter(function (c) { return c && !c.you; }).map(function (c) { return c.name; });
    const names = [];
    while (names.length < 5 && rivals.length) names.push(rivals.splice(Math.floor(rng() * rivals.length), 1)[0]);
    while (names.length < 5) names.push(IL.pick(rng, IL.CLUBS.filter(function (n) { return n !== save.clubName && names.indexOf(n) < 0; })));
    save.academy = {
      season: save.season,
      ids: (a && Array.isArray(a.ids)) ? a.ids : [],
      table: [{ name: save.clubName, you: true, w: 0, l: 0, pts: 0 }].concat(names.map(function (n) { return { name: n, w: 0, l: 0, pts: 0 }; })),
      played: null,
      tomesUsed: 0
    };
    return save.academy;
  }
  function academyEligible(f) { return !!f && !f.captain && (f.level || 1) <= ACADEMY_MAX_LV; }
  function setAcademy(save, id, on) {
    const a = save.academy;
    if (!a) return false;
    const f = (save.roster || []).filter(function (r) { return r.id === id; })[0];
    if (!f) return false;
    const at = a.ids.indexOf(id);
    if (!on) { if (at >= 0) a.ids.splice(at, 1); return at >= 0; }
    if (at >= 0 || !academyEligible(f) || a.ids.length >= ACADEMY_SQUAD) return false;
    a.ids.push(id);
    return true;
  }
  function academySquad(save) {
    const a = save.academy;
    if (!a) return [];
    return (save.roster || []).filter(function (f) { return a.ids.indexOf(f.id) >= 0 && academyEligible(f) && !isInjured(f); })
      .sort(function (x, y) { return (y.level || 1) - (x.level || 1); }).slice(0, ACADEMY_SIZE);
  }
  function academyReady(save) {
    const a = save.academy;
    return !!a && a.played !== weekKey(save) && academySquad(save).length > 0;
  }
  function academyOpponent(save, rng) {
    const a = save.academy;
    const squad = academySquad(save);
    const rivals = a.table.slice(1);
    const foe = rivals[(save.round || 0) % rivals.length];
    const n = Math.max(1, squad.length);
    const lv = Math.max(1, Math.round(squad.reduce(function (t, f) { return t + (f.level || 1); }, 0) / n));
    const side = makeRivalSide(rng, foe.name + " Academy", n);
    side.fighters.forEach(function (f, i) { growRival(f, rng, Math.max(1, lv + (i === 0 ? 1 : i === 1 ? 0 : -1))); });
    return { name: foe.name + " Academy", club: foe.name, fighters: side.fighters };
  }
  function recordAcademy(save, foeClub, win, rng) {
    const a = save.academy;
    if (!a) return 0;
    a.played = weekKey(save);
    const you = a.table[0];
    const them = a.table.filter(function (c) { return c.name === foeClub; })[0];
    if (win) { you.w++; you.pts += 3; if (them) them.l++; } else { you.l++; if (them) { them.w++; them.pts += 3; } }
    const rest = a.table.slice(1).filter(function (c) { return c !== them; });
    for (let i = 0; i + 1 < rest.length; i += 2) {
      const aw = rng() < 0.5;
      const x = rest[i], y = rest[i + 1];
      if (aw) { x.w++; x.pts += 3; y.l++; } else { y.w++; y.pts += 3; x.l++; }
    }
    if (win) save.devTomes = (save.devTomes || 0) + 1;
    return win ? 1 : 0;
  }
  function clubAverage(save) {
    const lv = (save.roster || []).map(function (f) { return f.level || 1; }).sort(function (a, b) { return b - a; }).slice(0, 5);
    return lv.length ? Math.round(lv.reduce(function (t, n) { return t + n; }, 0) / lv.length) : 1;
  }
  function useTome(save, f) {
    const a = save.academy;
    if (!f || (save.devTomes || 0) < 1 || !a || (a.tomesUsed || 0) >= TOMES_A_SEASON) return false;
    const target = clubAverage(save);
    if ((f.level || 1) >= target || !IL.xpFloor || !IL.grantXp) return false;
    IL.grantXp(f, Math.max(0, IL.xpFloor(target) - (f.xp || 0)));
    save.devTomes -= 1;
    a.tomesUsed = (a.tomesUsed || 0) + 1;
    return true;
  }

  /* ---------- v102 Chaos Thunder Cup ----------
     Twice a season: four clubs in one pit, free for all, three rounds.
     A round's placings score 3, 2, 1 and 0. The first cup (after week 4)
     is 2v2v2v2, the second (after week 10) 3v3v3v3. */
  const THUNDER_AT = [{ round: 4, size: 2 }, { round: 10, size: 3 }];
  const THUNDER_ROUNDS = 3;
  const THUNDER_POINTS = [3, 2, 1, 0];
  const THUNDER_PAY = [{ gold: 180, renown: 30, xp: 40 }, { gold: 100, renown: 18, xp: 26 }, { gold: 55, renown: 10, xp: 16 }, { gold: 25, renown: 4, xp: 10 }];
  function openThunder(save, rng) {
    if (!save || (save.thunder && save.thunder.season === save.season && !save.thunder.done)) return null;
    const done = (save.thunderDone && save.thunderDone.season === save.season) ? save.thunderDone.slots : [];
    for (let i = 0; i < THUNDER_AT.length; i++) {
      const at = THUNDER_AT[i];
      if ((save.round || 0) < at.round || done.indexOf(i) >= 0) continue;
      const pool = (save.clubs || []).filter(function (c) { return c && !c.you; }).map(function (c) { return c.name; });
      const names = [];
      while (names.length < 3 && pool.length) names.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
      while (names.length < 3) names.push(IL.pick(rng, IL.CLUBS.filter(function (n) { return n !== save.clubName && names.indexOf(n) < 0; })));
      save.thunder = {
        season: save.season, slot: i, size: at.size, round: 0, done: false, format: i === 1 ? "alliance" : "ffa",
        clubs: [{ name: save.clubName, you: true, pts: 0, places: [] }].concat(names.map(function (n) {
          const side = makeRivalSide(rng, n, at.size, save);
          return { name: n, you: false, pts: 0, places: [], fighters: side.fighters };
        }))
      };
      if (!save.thunderDone || save.thunderDone.season !== save.season) save.thunderDone = { season: save.season, slots: [] };
      save.thunderDone.slots.push(i);
      return save.thunder;
    }
    return null;
  }
  function thunderSides(save) {
    const t = save.thunder;
    if (!t || t.done || t.format === "alliance") return null;
    const yours = fielded(save.roster, save.lineup, t.size);
    if (yours.length < t.size) return null;
    return [{ name: save.clubName, fighters: yours }].concat(t.clubs.slice(1).map(function (c) { return { name: c.name, fighters: c.fighters }; }));
  }
  /* order: team indices first to last (IL.placings). Returns the cup. */
  function scoreThunder(save, order) {
    const t = save.thunder;
    if (!t || t.done) return null;
    order.forEach(function (team, place) {
      const c = t.clubs[team];
      if (!c) return;
      c.pts += THUNDER_POINTS[place] || 0;
      c.places.push(place + 1);
    });
    t.round += 1;
    if (t.round >= THUNDER_ROUNDS) {
      t.done = true;
      const table = thunderTable(t);
      t.finish = table.indexOf(t.clubs[0]) + 1;
    }
    return t;
  }
  function thunderTable(t) {
    return t.clubs.slice().sort(function (a, b) {
      return (b.pts - a.pts) || (a.places.reduce(function (n, p) { return n + p; }, 0) - b.places.reduce(function (n, p) { return n + p; }, 0));
    });
  }

  function startChaos(save, rng) {
    const picked = fielded(save.roster, save.lineup, 1);
    const yours = picked[0] || (save.roster || [])[0];
    const pool = IL.CLUBS.filter(function (name) { return name !== save.clubName; });
    const a = makeRivalSide(rng, pool.length ? pool.splice(Math.floor(rng() * pool.length), 1)[0] : "North Wharf", 1);
    const b = makeRivalSide(rng, pool.length ? pool.splice(Math.floor(rng() * pool.length), 1)[0] : "Salt Stair", 1);
    return {
      size: 1,
      sides: [
        { name: save.clubName, fighters: [yours] },
        { name: a.name, fighters: a.fighters },
        { name: b.name, fighters: b.fighters }
      ]
    };
  }

  function rivalBump(season) {
    return Math.min(3, Math.max(0, (season || 1) - 1));
  }

  function seasonAwards(roster) {
    function best(key) {
      let top = null;
      (roster || []).forEach(function (f) {
        if (!f) return;
        const n = f.season && typeof f.season[key] === "number" ? f.season[key] : 0;
        if (!top || n > top.n) top = { fighter: f, n: n };
      });
      return top ? top.fighter : null;
    }
    return { mvp: best("dealt"), kos: best("kos"), wall: best("taken"), healer: best("heal") };
  }

  /* ---------- v93 season rules, after Eslabong ----------
     Season modifiers: two rules a season from this pool, on every league,
     cup and Champions Cup match (not events, daily or friendly fights). */
  const SEASON_MODS = [
    { id: "glass", name: "Glass Shields", blurb: "Shields absorb 40% less." },
    { id: "vamp", name: "Vampiric Moon", blurb: "Every hit heals its dealer for 6% of the damage." },
    { id: "rush", name: "Opening Rush", blurb: "The first 10 seconds of a fight deal 25% more damage." },
    { id: "storm", name: "Mana Storm", blurb: "Ability cooldowns are 20% shorter." },
    { id: "iron", name: "Iron Season", blurb: "Every fighter has +3 defense." },
    { id: "swift", name: "Swift Feet", blurb: "Every fighter moves 12% faster." },
    { id: "fuse", name: "Short Fuse", blurb: "Sudden death starts at 30 seconds instead of 45." },
    { id: "mercy", name: "Mercy", blurb: "Heals are 25% stronger." },
    { id: "keen", name: "Keen Edges", blurb: "Every fighter has +6% critical chance." },
    { id: "purse", name: "Rich Purses", blurb: "League matches pay 30% more gold." },
    { id: "lean", name: "Lean Year", blurb: "League matches pay 20% less gold and 25% more XP." }
  ];
  function seasonModById(id) {
    for (let i = 0; i < SEASON_MODS.length; i++) if (SEASON_MODS[i].id === id) return SEASON_MODS[i];
    return null;
  }
  function pickSeasonMods(rng, n) {
    const pool = SEASON_MODS.map(function (m) { return m.id; });
    const out = [];
    while (out.length < (n || 2) && pool.length) {
      const id = pool.splice(Math.floor(rng() * pool.length), 1)[0];
      if ((id === "purse" && out.indexOf("lean") >= 0) || (id === "lean" && out.indexOf("purse") >= 0)) continue;
      out.push(id);
    }
    return out;
  }

  /* Season objectives: five a season, each paying gold and renown (by
     division) the moment it is met. */
  const SEASON_GOALS = [
    { id: "top3", text: "Finish in the top three", need: 1, gold: 160, renown: 16 },
    { id: "wins", text: "Win 8 league matches", need: 8, gold: 120, renown: 12 },
    { id: "midcup", text: "Win the MidCup", need: 1, gold: 140, renown: 14 },
    { id: "kos", text: "Land 30 knockouts", need: 30, gold: 90, renown: 9 },
    { id: "streak", text: "Win 4 league matches in a row", need: 4, gold: 110, renown: 11 },
    { id: "levels", text: "Gain 10 fighter levels", need: 10, gold: 80, renown: 8 },
    { id: "champs", text: "Reach the Champions Cup", need: 1, gold: 120, renown: 12 },
    { id: "gate", text: "Clear 5 Iron Gate floors in one run", need: 5, gold: 100, renown: 10 }
  ];
  function pickSeasonGoals(rng) {
    const pool = SEASON_GOALS.slice();
    const out = [];
    while (out.length < 5 && pool.length) out.push({ id: pool.splice(Math.floor(rng() * pool.length), 1)[0].id, paid: false });
    return out;
  }
  /* How far along a goal is, from the save (nothing extra to keep). */
  function goalProgress(save, id, ctx) {
    const c = ctx || {};
    const you = (save.clubs || []).filter(function (x) { return x.you; })[0] || { w: 0 };
    if (id === "wins") return you.w || 0;
    if (id === "kos") return (save.roster || []).reduce(function (n, f) { return n + ((f.season && f.season.kos) || 0); }, 0);
    if (id === "streak") return save.streakSeason === save.season ? (save.streakBest || 0) : 0;
    if (id === "levels") {
      return (save.roster || []).reduce(function (n, f) {
        return n + (f.lv0Season === save.season ? Math.max(0, (f.level || 1) - (f.lv0 || 1)) : 0);
      }, 0);
    }
    if (id === "midcup") return save.midWon === save.season ? 1 : 0;
    if (id === "champs") return save.champs && save.champs.season === save.season && (save.champs.slots || []).some(function (s) { return s.you; }) ? 1 : 0;
    if (id === "top3") return c.place != null && c.place <= 2 ? 1 : 0;
    if (id === "gate") return save.gateSeason === save.season ? (save.gateSeasonBest || 0) : 0;
    return 0;
  }

  /* The season-end chest, by finishing place (0 = first) and division. */
  function seasonChest(place, tier, rng) {
    const mul = DIVISIONS[Math.max(0, Math.min(4, tier | 0))].purse;
    const GOLD = [420, 280, 220, 160, 130, 110, 90, 80];
    const RENOWN = [42, 28, 22, 16, 13, 11, 9, 8];
    const p = Math.max(0, Math.min(GOLD.length - 1, place | 0));
    const items = [];
    const nItems = p === 0 ? 3 : p <= 2 ? 2 : p <= 4 ? 1 : 0;
    for (let tries = 0; items.length < nItems && tries < 20 && IL.makeItem; tries++) {
      const it = IL.makeItem(rng, { bag: p <= 2 ? "cup" : "win" });
      if (IL.itemSlot && IL.itemSlot(it) === "tome") continue;
      items.push(it);
    }
    return {
      gold: Math.round(GOLD[p] * mul),
      renown: Math.round(RENOWN[p] * mul),
      items: items,
      relic: p === 0 || (p <= 2 && rng() < 0.5)
    };
  }

  function seasonPurse(place, tier) {
    const mul = DIVISIONS[Math.max(0, Math.min(4, tier | 0))].purse;
    const base = place <= 0 ? { gold: 80, renown: 12 } : place === 1 ? { gold: 48, renown: 7 } : { gold: 28, renown: 4 };
    return { gold: Math.round(base.gold * mul), renown: Math.round(base.renown * mul) };
  }

  /* ---------- divisions (v65) ----------
     Five tiers. The top two clubs go up and the bottom two go down at the
     end of a season. A tier sets the lowest level a rival can be, how
     well rivals are dressed, and the size of every league purse. */
  const DIVISIONS = [
    { id: "sand", roman: "V", name: "Sand Division", floor: 1, purse: 1 },
    { id: "iron", roman: "IV", name: "Iron Division", floor: 4, purse: 1.25 },
    { id: "bronze", roman: "III", name: "Bronze Division", floor: 8, purse: 1.5 },
    { id: "silver", roman: "II", name: "Silver Division", floor: 12, purse: 1.8 },
    { id: "crown", roman: "I", name: "Crown Division", floor: 16, purse: 2.2 }
  ];

  function divisionOf(data) {
    const t = data && typeof data.division === "number" ? data.division : 0;
    return Math.max(0, Math.min(DIVISIONS.length - 1, t | 0));
  }

  /* The club's level is the mean of its three highest fighters. */
  function clubLevel(data) {
    const lv = ((data && data.roster) || []).map(function (f) { return (f && f.level) || 1; }).sort(function (a, b) { return b - a; }).slice(0, 3);
    if (!lv.length) return 1;
    return Math.max(1, Math.round(lv.reduce(function (a, b) { return a + b; }, 0) / lv.length));
  }

  /* Rivals track the club level. Each rival club sits on its own swing
     and its fighters vary one either way around it; never under the
     division floor. slot = the club, k = the fighter.
     v86: the swing grows with the club. A young club meets rivals one
     level either way; the full six under to six over opens at level 24
     (one more step every four levels), and the per-fighter wobble at 12. */
  const RIVAL_SWING = [-6, -4, -2, 0, 2, 4, 6];
  const RIVAL_JITTER = [0, -1, 1];
  /* The division floor lifts a young club's rivals, but by two levels at
     most: a level 6 club promoted into Bronze (floor 8) meets level 8,
     not 8 plus the swing. */
  function rivalBase(data) {
    const club = clubLevel(data);
    return Math.max(club, Math.min(DIVISIONS[divisionOf(data)].floor, club + 2));
  }
  function swingCap(base) {
    return Math.max(1, Math.min(6, Math.floor(base / 4)));
  }
  function rivalLevel(data, slot, k) {
    const base = rivalBase(data);
    const swing = Math.round(RIVAL_SWING[Math.abs(slot | 0) % RIVAL_SWING.length] * swingCap(base) / 6);
    const jitter = base >= 12 ? RIVAL_JITTER[Math.abs(k | 0) % RIVAL_JITTER.length] : 0;
    return Math.max(1, Math.min(IL.LEVEL_CAP || 100, base + swing + jitter));
  }
  function rivalRange(data) {
    const base = rivalBase(data);
    const cap = IL.LEVEL_CAP || 100;
    const reach = swingCap(base) + (base >= 12 ? 1 : 0);
    return [Math.max(1, Math.min(cap, base - reach)), Math.max(1, Math.min(cap, base + reach))];
  }

  /* A rival takes the same level-ups a player fighter does: a stat roll
     every level and one skill card, picked by its own seeded hand. */
  function growRival(fighter, rng, level) {
    if (!fighter) return fighter;
    const from = Math.max(1, fighter.level | 0);
    const lv = Math.max(from, level | 0);
    fighter.level = lv;
    fighter.xp = IL.xpFloor ? IL.xpFloor(lv) : (lv - 1) * 40;
    if (IL.ensureMoves) IL.ensureMoves(fighter);
    if (!IL.levelOffer || !IL.applyLevelPick || lv <= from) {
      if (IL.autoEvos) IL.autoEvos(fighter, rng);
      autoMilestones(fighter, rng);
      return fighter;
    }
    fighter.pendingLevels = lv - from;
    let guard = 0;
    while (fighter.pendingLevels > 0 && guard < (IL.LEVEL_CAP || 100) + 5) {
      const offer = IL.levelOffer(fighter);
      const n = offer.cards.length;
      if (!n) { fighter.pendingLevels = 0; break; }
      const best = offer.cards.reduce(function (bi, c, i, arr) { return c.tier > arr[bi].tier ? i : bi; }, 0);
      IL.applyLevelPick(fighter, rng() < 0.5 ? best : Math.floor(rng() * n));
      guard++;
    }
    fighter.pendingLevels = 0;
    if (IL.autoEvos) IL.autoEvos(fighter, rng);
    autoMilestones(fighter, rng);
    return fighter;
  }
  /* v110 rivals claim their ability upgrades and masteries on their own. */
  function autoMilestones(f, rng) {
    let guard = 0;
    while (IL.upgradesPending && IL.upgradesPending(f) > 0 && guard++ < 20) {
      const open = (f.loadout || []).filter(function (id) { return IL.rankOf && IL.rankOf(f, id) < (IL.RANK_MAX || 5); });
      if (!open.length || !IL.upgradeMove(f, open[Math.floor(rng() * open.length)])) break;
    }
    guard = 0;
    while (IL.masteriesPending && IL.masteriesPending(f) > 0 && guard++ < 10) {
      if (!IL.addMastery(f, MASTERIES[Math.floor(rng() * MASTERIES.length)].id)) break;
    }
  }

  /* Rival clubs level with the club through the season: whenever the club's
     level rises, each rival fighter catches up to its own target (never
     down). Seeded by fighter and level, so a reload gives the same picks. */
  function keepRivalsUp(data) {
    let grew = 0;
    let slot = 0;
    ((data && data.clubs) || []).forEach(function (c) {
      if (!c || c.you || !Array.isArray(c.fighters)) return;
      const s = c.swing == null ? slot : c.swing;
      slot++;
      c.fighters.forEach(function (f, k) {
        if (!f) return;
        const want = rivalLevel(data, s, k);
        /* v86: a rival made under the old, wider swing (or before the club
           lost a strong fighter) sits well over its target. Rebuild its
           growth from level 1 at the target; name, look and gear stay. */
        if ((f.level || 1) > want + 2) {
          ["known", "learned", "loadout", "rolls", "specs", "talents", "growth", "ranks", "levelsTaken", "pendingLevels", "statRerolls", "skillRerolls", "pendingMoves"].forEach(function (key) { delete f[key]; });
          f.level = 1;
          f.xp = 0;
        }
        if ((f.level || 1) >= want) return;
        let h = 2166136261;
        const key = String(f.id || f.name || k) + ":" + want;
        for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
        growRival(f, IL.mulberry32(h >>> 0), want);
        grew++;
      });
    });
    return grew;
  }

  function youRow(data) {
    const clubs = (data && data.clubs) || [];
    for (let i = 0; i < clubs.length; i++) if (clubs[i] && clubs[i].you) return clubs[i];
    return null;
  }

  function sumOf(data, key) {
    let n = 0;
    (data.roster || []).forEach(function (f) { n += (f && f[key]) || 0; });
    return n;
  }

  function maxLevel(data) {
    let n = 0;
    (data.roster || []).forEach(function (f) { if (f && (f.level || 1) > n) n = f.level || 1; });
    return n;
  }

  function countRarity(data, rarity) {
    let n = 0;
    function see(item) { if (item && item.rarity === rarity) n++; }
    (data.items || []).forEach(see);
    (data.roster || []).forEach(function (f) {
      const g = (f && f.gear) || {};
      see(g.weapon);
      see(g.armor);
      see(g.trinket);
    });
    return n;
  }

  function kitted(data) {
    return (data.roster || []).some(function (f) {
      const g = f && f.gear;
      return !!(g && g.weapon && g.armor && g.trinket);
    });
  }

  const ACHIEVEMENTS = [
    { id: "first-bout", name: "First bell", blurb: "Finish a match.", gold: 10, icon: "bw_sword_01_steel",
      progress: function (d) { return { current: d.bouts || 0, goal: 1 }; } },
    { id: "first-win", name: "First win", blurb: "Win a match.", gold: 15, icon: "bw_sword_05_gold",
      progress: function (d) { const you = youRow(d); return { current: you ? you.w : 0, goal: 1 }; } },
    { id: "five-wins", name: "Five wins", blurb: "Win five matches.", gold: 25, icon: "bw_gold_coins",
      progress: function (d) { const you = youRow(d); return { current: you ? you.w : 0, goal: 5 }; } },
    { id: "flawless", name: "Flawless", blurb: "Win without your side taking a hit.", gold: 20, icon: "bw_old_shield",
      progress: function (d) { return { current: d.flawless || 0, goal: 1 }; } },
    { id: "ten-kos", name: "Ten KOs", blurb: "Land ten knockouts.", gold: 20, icon: "bw_dagger_01_steel",
      progress: function (d) { return { current: sumOf(d, "kos"), goal: 10 }; } },
    { id: "forty-kos", name: "Forty KOs", blurb: "Land forty knockouts.", gold: 35, icon: "bw_poison_dagger",
      progress: function (d) { return { current: sumOf(d, "kos"), goal: 40 }; } },
    { id: "legendary", name: "A legend", blurb: "Own a legendary piece.", gold: 30, icon: "bw_diamond",
      progress: function (d) { return { current: countRarity(d, "legendary"), goal: 1 }; } },
    { id: "epic-gear", name: "Epic steel", blurb: "Own an epic piece.", gold: 12, icon: "bw_fire_gem",
      progress: function (d) { return { current: countRarity(d, "epic"), goal: 1 }; } },
    { id: "cup-enter", name: "Cup entry", blurb: "Enter the cup.", gold: 8, icon: "bw_token_golden_medallion",
      progress: function (d) { return { current: d.cupsEntered || 0, goal: 1 }; } },
    { id: "cup-win", name: "Cup winner", blurb: "Win the cup.", gold: 40, renown: 6, icon: "bw_token_golden_medallion",
      progress: function (d) { return { current: d.cupsWon || 0, goal: 1 }; } },
    { id: "draft-win", name: "Draft champion", blurb: "Win a draft cup.", gold: 30, renown: 6, icon: "bw_token_golden_medallion",
      progress: function (d) { return { current: d.draftsWon || 0, goal: 1 }; } },
    { id: "watch-sign", name: "Patient eye", blurb: "Hire a fighter off your watchlist.", gold: 15, icon: "bw_old_helm",
      progress: function (d) { return { current: d.watchSigned || 0, goal: 1 }; } },
    { id: "all-classes", name: "Every kit", blurb: "Hire every class.", gold: 40, renown: 8, icon: "bw_old_helm",
      progress: function (d) {
        const goal = IL.CLASSES ? Object.keys(IL.CLASSES).length : 15;
        return { current: (d.seenClasses || []).length, goal: goal };
      } },
    { id: "full-house", name: "Full house", blurb: "Fill the roster.", gold: 18, icon: "bw_gauntlet_01_red",
      progress: function (d) { return { current: (d.roster || []).length, goal: IL.ROSTER_CAP || 8 }; } },
    { id: "first-hire", name: "New blood", blurb: "Hire a fighter.", gold: 10, icon: "bw_green_gem",
      progress: function (d) { return { current: d.hires || 0, goal: 1 }; } },
    { id: "drilled", name: "First drill", blurb: "Train a benched fighter.", gold: 8, icon: "bw_gauntlet_05_gold",
      progress: function (d) { return { current: d.trainsDone || 0, goal: 1 }; } },
    { id: "kitted", name: "Fully dressed", blurb: "Fill weapon, armor, and trinket on one fighter.", gold: 15, icon: "bw_old_leather_armor",
      progress: function (d) { return { current: kitted(d) ? 1 : 0, goal: 1 }; } },
    { id: "scrapped", name: "Scrapped", blurb: "Salvage a piece.", gold: 8, icon: "bw_broken_shield",
      progress: function (d) { return { current: d.salvaged || 0, goal: 1 }; } },
    { id: "season-title", name: "Season title", blurb: "Finish a season in first.", gold: 25, renown: 4, icon: "bw_gem_ruby",
      progress: function (d) { return { current: d.seasonTitles || 0, goal: 1 }; } },
    { id: "third-season", name: "Third season", blurb: "Open a third season.", gold: 15, icon: "bw_staff_02_steel",
      progress: function (d) { return { current: d.season || 1, goal: 3 }; } },
    { id: "renown-40", name: "Known name", blurb: "Hold 40 renown.", gold: 12, icon: "bw_gem_ruby",
      progress: function (d) { return { current: d.renown || 0, goal: 40 }; } },
    { id: "chaos-win", name: "Pit king", blurb: "Win a chaos pit.", gold: 18, icon: "bw_flail_08_red",
      progress: function (d) { return { current: d.chaosWins || 0, goal: 1 }; } },
    { id: "level-6", name: "Level 6", blurb: "Raise a fighter to level 6.", gold: 16, icon: "bw_bow_07_gold",
      progress: function (d) { return { current: maxLevel(d), goal: 6 }; } },
    { id: "level-9", name: "Level 9", blurb: "Raise a fighter to level 9.", gold: 28, icon: "bw_bow_09_purple",
      progress: function (d) { return { current: maxLevel(d), goal: 9 }; } },
    { id: "sipped", name: "A sip", blurb: "Give a fighter a tonic.", gold: 8, icon: "cs_potion_01_green",
      progress: function (d) { return { current: d.tonicsUsed || 0, goal: 1 }; } },
    { id: "purse", name: "Heavy purse", blurb: "Hold 200 gold.", gold: 12, icon: "bw_gold_coins",
      progress: function (d) { return { current: d.goldPeak || 0, goal: 200 }; } },
    { id: "unbeaten", name: "Unbeaten", blurb: "Finish a season without a loss.", gold: 35, icon: "bw_old_shield",
      progress: function (d) { return { current: d.unbeaten || 0, goal: 1 }; } },
    { id: "five-bouts", name: "Five bells", blurb: "Finish five matches.", gold: 18, icon: "bw_sword_01_steel",
      progress: function (d) { return { current: d.bouts || 0, goal: 5 }; } },
    { id: "rival-win", name: "First grudge", blurb: "Beat your rival.", gold: 16, icon: "bw_flail_08_red",
      progress: function (d) { return { current: (d.nemesis && d.nemesis.wins) || 0, goal: 1 }; } },
    { id: "rival-three", name: "Settled score", blurb: "Beat your rival three times.", gold: 24, icon: "bw_sword_05_gold",
      progress: function (d) { return { current: (d.nemesis && d.nemesis.wins) || 0, goal: 3 }; } },
    { id: "two-relics", name: "Paired relics", blurb: "Equip two club relics.", gold: 14, icon: "bw_gem_ruby",
      progress: function (d) { return { current: (d.equipped && d.equipped.length) || 0, goal: 2 }; } },
    { id: "set-awake", name: "Set awake", blurb: "Wake a set bonus.", gold: 20, icon: "bw_diamond",
      progress: function (d) {
        const pack = relicPack(d, d.roster || []);
        return { current: pack.sets && pack.sets.length ? 1 : 0, goal: 1 };
      } },
    { id: "wave-five", name: "Fifth wave", blurb: "Reach endless wave 5.", gold: 18, icon: "bw_staff_02_steel",
      progress: function (d) { return { current: (d.endless && d.endless.best) || 0, goal: 5 }; } },
    { id: "week-clear", name: "Week cleared", blurb: "Clear the weekly event.", gold: 16, icon: "bw_token_golden_medallion",
      progress: function (d) { return { current: d.weekClear ? 1 : 0, goal: 1 }; } },
    { id: "renown-70", name: "Far renown", blurb: "Hold 70 renown.", gold: 18, icon: "bw_gold_coins",
      progress: function (d) { return { current: d.renown || 0, goal: 70 }; } }
  ];

  function claimAchievements(data) {
    if (!data) return [];
    if (!data.achieved || typeof data.achieved !== "object") data.achieved = {};
    const fresh = [];
    for (let pass = 0; pass < 4; pass++) {
      if ((data.gold || 0) > (data.goldPeak || 0)) data.goldPeak = data.gold;
      let hit = false;
      for (let i = 0; i < ACHIEVEMENTS.length; i++) {
        const row = ACHIEVEMENTS[i];
        if (data.achieved[row.id]) continue;
        const prog = row.progress(data);
        if ((prog.current || 0) < prog.goal) continue;
        data.achieved[row.id] = true;
        data.gold = (data.gold || 0) + (row.gold || 0);
        data.renown = (data.renown || 0) + (row.renown || 0);
        fresh.push(row);
        hit = true;
      }
      if (!hit) break;
    }
    return fresh;
  }

  function achievementBoard(data) {
    return ACHIEVEMENTS.map(function (row) {
      const prog = row.progress(data || {});
      return {
        id: row.id,
        name: row.name,
        blurb: row.blurb,
        gold: row.gold || 0,
        renown: row.renown || 0,
        icon: row.icon,
        current: prog.current || 0,
        goal: prog.goal,
        done: !!(data && data.achieved && data.achieved[row.id])
      };
    });
  }

  const EVENTS = [
    { id: "boss", name: "Boss Brawl", blurb: "One giant with three phases. An add joins at each break.", reward: "A heavy purse, and a chance at a relic." },
    { id: "gauntlet", name: "Gauntlet", blurb: "Five fights. Nobody is healed between them.", reward: "Gold climbs with each fight you finish." },
    { id: "horde", name: "Horde", blurb: "Three waves in one pit.", reward: "Gear if you clear the last wave." },
    { id: "king", name: "King of the Pit", blurb: "One fighter. Six waves, or until they fall.", reward: "Renown for every wave you clear." },
    { id: "mirror", name: "Mirror Match", blurb: "Your party, under the other crest.", reward: "Renown, win or lose." }
  ];
  const FIGHT_EVENTS = [
    { id: "fog", name: "Fog", blurb: "The pit hazes. Swings and shots miss more often." },
    { id: "fire", name: "Fire floor", blurb: "The sand burns. Everyone takes a little damage over time." },
    { id: "gold", name: "Gold rush", blurb: "Your kills pay extra gold." },
    { id: "sudden", name: "Sudden death", blurb: "After a short while, hits land much harder." },
    { id: "giant", name: "Giant mode", blurb: "Bodies grow. Health and reach go up." }
  ];
  const ENDLESS_MODS = [
    { id: "glass", name: "Glass", blurb: "Hits land harder. Armor thins." },
    { id: "haste", name: "Haste", blurb: "Everyone is quicker." },
    { id: "bulwark", name: "Bulwark", blurb: "Armor thickens." },
    { id: "hunger", name: "Hunger", blurb: "The wave comes in heavier." }
  ].concat(FIGHT_EVENTS);

  function classIds() { return Object.keys(IL.CLASSES); }

  function squadOf(rng, n, level) {
    const ids = classIds();
    const list = [];
    const count = Math.max(1, n || 1);
    for (let i = 0; i < count; i++) {
      const fighter = IL.randomFighter(rng, IL.pick(rng, ids));
      fighter.level = Math.max(1, level || 1);
      list.push(fighter);
    }
    if (IL.uniqueName) {
      const taken = [];
      list.forEach(function (f) {
        f.name = IL.uniqueName(rng, taken);
        taken.push(f.name);
      });
    }
    return list;
  }

  function activeEvent(now) {
    return EVENTS[weekIndex(now || 0) % EVENTS.length];
  }

  function dayIndex(now) { return Math.floor((now || 0) / 86400000); }

  function dailySquad(day, season) {
    const rng = IL.mulberry32(((day || 0) * 9973 + 17) >>> 0);
    return squadOf(rng, 2, 1 + Math.max(0, (season || 1) - 1));
  }

  function startGauntlet(rng, n, level) {
    const fights = [];
    const size = Math.max(1, Math.min(3, n || 1));
    const base = Math.max(1, level || 1);
    for (let i = 0; i < 5; i++) fights.push(squadOf(rng, size, base + i));
    return { step: 0, wins: 0, hp: {}, fights: fights };
  }

  function makeBoss(rng, level) {
    const fighter = IL.randomFighter(rng, IL.pick(rng, classIds()));
    fighter.boss = true;
    fighter.champion = true;
    fighter.level = Math.max(3, level || 3);
    fighter.name = "Pit Warden";
    return fighter;
  }

  function bossAdds(rng, level) {
    return squadOf(rng, 2, Math.max(1, level || 1));
  }

  /* v79 Iron Gate, after Eslabong: eight floors, bosses on 5, 7 and 8.
     Health carries floor to floor; a chest pays out at every boss. One
     run a week. Foes rise from the club's level. */
  const GATE_FLOORS = 8;
  const GATE_BOSSES = { 5: "Gate Warden", 7: "Iron Jailer", 8: "The Gatekeeper" };

  function gateFloor(save, rng, floor) {
    const base = Math.max(1, (IL.clubLevel ? IL.clubLevel(save) : 1) + Math.floor((floor - 1) / 2));
    if (GATE_BOSSES[floor]) {
      const boss = makeBoss(rng, base + 1);
      boss.name = GATE_BOSSES[floor];
      boss.level = 1;  /* growRival levels up from where the fighter stands */
      if (IL.growRival) IL.growRival(boss, rng, base + 1);
      boss.boss = true;
      return { boss: boss, adds: squadOf(rng, floor === 8 ? 2 : 1, base) };
    }
    return { foes: squadOf(rng, Math.min(3, 1 + Math.floor(floor / 2)), base) };
  }

  function gateChest(save, rng, floor) {
    const c = openChest(rng, save.relics || [], save);
    c.gold = Math.round(c.gold * (1 + floor * 0.15));
    return c;
  }

  function endlessMod(wave) {
    if (!wave || wave % 5 !== 0) return null;
    return ENDLESS_MODS[(Math.floor(wave / 5) - 1) % ENDLESS_MODS.length];
  }

  function weekFightEvent(now) {
    return FIGHT_EVENTS[weekIndex(now || 0) % FIGHT_EVENTS.length];
  }

  function relicChoices(save, rng) {
    const have = (save && save.relics) || [];
    const pool = RELICS.filter(function (r) { return have.indexOf(r.id) < 0; });
    const picks = [];
    while (picks.length < 3 && pool.length) {
      picks.push(pool.splice(Math.floor(rng() * pool.length), 1)[0].id);
    }
    while (picks.length < 3) picks.push("gold");
    return picks;
  }

  function noteEndless(save, wave) {
    if (!save.endless) save.endless = { best: 0, board: [] };
    const cleared = Math.max(0, wave || 0);
    if (cleared > save.endless.best) save.endless.best = cleared;
    const board = save.endless.board || [];
    board.push({ wave: cleared, club: save.clubName || "Club", at: Date.now() });
    board.sort(function (a, b) { return b.wave - a.wave; });
    save.endless.board = board.slice(0, 5);
  }

  IL.EVENTS = EVENTS;
  IL.FIGHT_EVENTS = FIGHT_EVENTS;
  IL.ENDLESS_MODS = ENDLESS_MODS;
  IL.weekFightEvent = weekFightEvent;
  IL.squadOf = squadOf;
  IL.activeEvent = activeEvent;
  IL.dayIndex = dayIndex;
  IL.dailySquad = dailySquad;
  IL.startGauntlet = startGauntlet;
  IL.makeBoss = makeBoss;
  IL.bossAdds = bossAdds;
  IL.endlessMod = endlessMod;
  IL.relicChoices = relicChoices;
  IL.noteEndless = noteEndless;
  const RELIC_ICON = {
    phoenix: "cs_fire_symbol_05",
    bloodvine: "cs_spell_016_red",
    aegis: "cs_water_symbol_03",
    blinkstone: "cs_spell_021_blue",
    leech: "bw_orb_01_red",
    bramble: "bw_grass_gem",
    emberidol: "cs_fire_symbol_01",
    warhorn: "bw_orb_10_orange",
    salvebead: "cs_spell_004_green",
    wardprism: "bw_diamond",
    band: "bw_ancient_golden_ring",
    edge: "bw_ninja_star",
    plate: "bw_token_golden_medallion",
    sigil: "cs_spell_014_purple",
    purse: "bw_gold_coins",
    thread: "bw_green_gem",
    quill: "cs_spell_012_blue",
    wind: "cs_water_symbol_01",
    banner: "bw_orb_10_orange",
    glass: "bw_diamond",
    ring: "bw_ancient_golden_ring",
    clock: "bw_orb_05_purple",
    brace: "bw_diamond",
    oath: "bw_orb_04_gold",
    hone: "bw_fire_gem",
    fang: "bw_gem_ruby",
    lastcut: "cs_fire_symbol_05",
    salve: "cs_water_symbol_02",
    stitch: "bw_grass_gem",
    chalice: "cs_water_symbol_03",
    spur: "bw_orb_10_orange",
    shard: "bw_diamond",
    lens: "bw_orb_05_purple",
    heart: "bw_gem_ruby",
    coin: "bw_gold_coins",
    ledger: "bw_token_golden_medallion",
    fletch: "bw_ninja_star",
    sight: "cs_spell_021_blue",
    star: "cs_spell_008_pink",
    lung: "bw_green_gem",
    bell: "bw_orb_04_gold",
    ash: "cs_fire_symbol_01",
    rivet: "bw_token_golden_medallion",
    cloak: "bw_grass_gem",
    whistle: "cs_spell_006_orange",
    nail: "bw_fire_gem",
    buckle: "bw_orb_04_gold",
    wrap: "cs_spell_004_green",
    pebble: "bw_gem_ruby",
    ferry: "bw_gold_coins",
    bluethread: "cs_water_symbol_02",
    fuse: "cs_spell_007_orange",
    stud: "bw_diamond",
    wren: "cs_spell_022_orange",
    salt: "cs_spell_040_steel",
    oil: "cs_fire_symbol_03",
    clasp: "bw_token_golden_medallion",
    redwrap: "cs_spell_016_red",
    storm: "bw_orb_01_red",
    dice: "bw_gold_coins",
    ironstud: "bw_orb_04_gold",
    cord: "bw_orb_10_orange",
    pin: "bw_ninja_star",
    mask: "cs_spell_014_purple",
    crown: "cs_fire_symbol_05",
    knot: "bw_green_gem",
    echo: "bw_orb_05_purple",
    thorn: "bw_ancient_golden_ring",
    goldthread: "bw_gold_coins",
    whiteash: "cs_water_symbol_01",
    broad: "bw_token_golden_medallion",
    keenpin: "bw_fire_gem",
    cup: "cs_water_symbol_03",
    lastbell: "cs_spell_002_red"
  };

  function relicIcon(id) { return RELIC_ICON[id] || ""; }

  /* Challenge codes are base64url of a slim party. No btoa: the sim has none. */
  const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

  function utf8ToB64url(str) {
    const bytes = [];
    for (let i = 0; i < str.length; i++) {
      let c = str.charCodeAt(i);
      if (c < 0x80) bytes.push(c);
      else if (c < 0x800) bytes.push(0xC0 | (c >> 6), 0x80 | (c & 0x3F));
      else if (c >= 0xD800 && c <= 0xDBFF && i + 1 < str.length) {
        const c2 = str.charCodeAt(++i);
        const u = 0x10000 + ((c & 0x3FF) << 10) + (c2 & 0x3FF);
        bytes.push(0xF0 | (u >> 18), 0x80 | ((u >> 12) & 0x3F), 0x80 | ((u >> 6) & 0x3F), 0x80 | (u & 0x3F));
      } else bytes.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 0x3F), 0x80 | (c & 0x3F));
    }
    let out = "";
    for (let i = 0; i < bytes.length; i += 3) {
      const a = bytes[i];
      const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
      const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
      const n = ((a << 16) | (b << 8) | c) >>> 0;
      out += B64[(n >>> 18) & 63] + B64[(n >>> 12) & 63];
      if (i + 1 < bytes.length) out += B64[(n >>> 6) & 63];
      if (i + 2 < bytes.length) out += B64[n & 63];
    }
    return out;
  }

  function b64urlToUtf8(str) {
    if (typeof str !== "string" || !str.length || str.length % 4 === 1) return null;
    const bytes = [];
    for (let i = 0; i < str.length; i += 4) {
      const c0 = B64.indexOf(str.charAt(i));
      const c1 = i + 1 < str.length ? B64.indexOf(str.charAt(i + 1)) : -1;
      if (c0 < 0 || c1 < 0) return null;
      const has2 = i + 2 < str.length;
      const has3 = i + 3 < str.length;
      const c2 = has2 ? B64.indexOf(str.charAt(i + 2)) : 0;
      const c3 = has3 ? B64.indexOf(str.charAt(i + 3)) : 0;
      if ((has2 && c2 < 0) || (has3 && c3 < 0)) return null;
      const n = ((c0 << 18) | (c1 << 12) | (c2 << 6) | c3) >>> 0;
      bytes.push((n >>> 16) & 255);
      if (has2) bytes.push((n >>> 8) & 255);
      if (has3) bytes.push(n & 255);
    }
    let out = "";
    for (let i = 0; i < bytes.length; i++) {
      const a = bytes[i];
      if (a < 0x80) out += String.fromCharCode(a);
      else if ((a & 0xE0) === 0xC0 && i + 1 < bytes.length) {
        out += String.fromCharCode(((a & 31) << 6) | (bytes[++i] & 63));
      } else if ((a & 0xF0) === 0xE0 && i + 2 < bytes.length) {
        out += String.fromCharCode(((a & 15) << 12) | ((bytes[++i] & 63) << 6) | (bytes[++i] & 63));
      } else if ((a & 0xF8) === 0xF0 && i + 3 < bytes.length) {
        const u = ((a & 7) << 18) | ((bytes[++i] & 63) << 12) | ((bytes[++i] & 63) << 6) | (bytes[++i] & 63);
        const c = u - 0x10000;
        out += String.fromCharCode(0xD800 + ((c >> 10) & 0x3FF), 0xDC00 + (c & 0x3FF));
      } else return null;
    }
    return out;
  }

  function slimBoosts(b) {
    const src = b || {};
    function n(k) {
      const v = src[k];
      if (typeof v !== "number" || !(v >= 0)) return 0;
      return Math.min(30, Math.round(v));
    }
    return { hp: n("hp"), dmg: n("dmg"), spd: n("spd"), def: n("def") };
  }

  function slimFighter(f) {
    return {
      name: String(f.name || "Fighter").slice(0, 22),
      cls: f.cls,
      level: f.level || 1,
      sheet: f.parts && f.parts.sheet,
      tactic: f.tactic || "strike",
      personality: f.personality || "bold",
      rarity: f.rarity || "common",
      specialty: f.specialty || null,
      focus: f.focus || null,
      mastery: f.mastery || null,
      boosts: slimBoosts(f.boosts),
      relic: f.relic || null,
      relic2: f.relic2 || null,
      loadout: Array.isArray(f.loadout) ? f.loadout.slice(0, 3) : [],
      learned: Array.isArray(f.learned) ? f.learned.slice() : [],
      evos: f.evos && typeof f.evos === "object" ? Object.assign({}, f.evos) : undefined,
      ai: IL.aiCustom && IL.aiCustom(f.ai) ? IL.normAi(f.ai) : undefined
    };
  }

  function exportChallenge(save) {
    const party = fielded(save.roster, save.lineup, IL.PARTY_CAP || 3);
    const equipped = (save.equipped || []).filter(function (id) {
      const relic = relicById(id);
      return relic && relic.scope !== "fighter";
    }).slice(0, 2);
    const pack = {
      v: 1,
      name: String(save.clubName || "Club").slice(0, 24),
      crest: save.crest || 1,
      equipped: equipped,
      fighters: party.map(slimFighter)
    };
    return "ILC1." + utf8ToB64url(JSON.stringify(pack));
  }

  function challengeFault(code) {
    const rawCode = String(code || "").trim();
    if (!rawCode) return "Paste a code first.";
    if (rawCode.indexOf("ILC1.") !== 0) return "Codes start with ILC1.";
    const text = b64urlToUtf8(rawCode.slice(5));
    if (!text) return "That code is cut off or damaged.";
    let pack;
    try { pack = JSON.parse(text); } catch (e) { return "That code is cut off or damaged."; }
    if (!pack || !Array.isArray(pack.fighters) || !pack.fighters.length) return "That code has no fighters.";
    const known = pack.fighters.some(function (raw) { return raw && IL.CLASSES[raw.cls]; });
    if (!known) return "That code has no fighters this club can face.";
    return "";
  }

  function importChallenge(code) {
    const rawCode = String(code || "").trim();
    if (rawCode.indexOf("ILC1.") !== 0) return null;
    const text = b64urlToUtf8(rawCode.slice(5));
    if (!text) return null;
    let pack;
    try { pack = JSON.parse(text); } catch (e) { return null; }
    if (!pack || !Array.isArray(pack.fighters) || !pack.fighters.length) return null;
    const fighters = [];
    pack.fighters.slice(0, IL.PARTY_CAP || 3).forEach(function (raw, i) {
      if (!raw || !IL.CLASSES[raw.cls]) return;
      const sheet = typeof raw.sheet === "string" && IL.sheetKnown(raw.sheet) ? raw.sheet : IL.defaultSheet(raw.cls);
      const personality = IL.PERSONALITIES && IL.PERSONALITIES.indexOf(raw.personality) >= 0 ? raw.personality : "bold";
      const tactic = IL.TACTICS && IL.TACTICS.indexOf(raw.tactic) >= 0 ? raw.tactic : "strike";
      const worn = raw.relic && relicById(raw.relic);
      const worn2 = raw.relic2 && relicById(raw.relic2);
      const f = {
        id: "ch" + i,
        name: String(raw.name || "Fighter").slice(0, 22),
        cls: raw.cls,
        parts: { sheet: sheet },
        level: Math.max(1, Math.min(IL.LEVEL_CAP || 100, raw.level | 0)),
        tactic: tactic,
        personality: personality,
        rarity: raw.rarity || "common",
        specialty: raw.specialty && IL.specialtyOf && IL.specialtyOf(raw.specialty) ? raw.specialty : null,
        focus: raw.focus && IL.specialtyOf && IL.specialtyOf(raw.focus) ? raw.focus : null,
        mastery: raw.mastery && IL.masteryOf && IL.masteryOf(raw.mastery) ? raw.mastery : null,
        boosts: slimBoosts(raw.boosts),
        relic: worn && worn.scope === "fighter" ? worn.id : null,
        relic2: worn2 && worn2.scope === "fighter" && (!worn || worn2.id !== worn.id) ? worn2.id : null,
        captain: false,
        xp: IL.xpFloor ? IL.xpFloor(Math.max(1, raw.level | 0)) : Math.max(0, ((raw.level | 0) - 1) * 40),
        gear: IL.blankGear ? IL.blankGear() : { weapon: null, armor: null, trinket: null }
      };
      if (Array.isArray(raw.loadout)) f.loadout = raw.loadout.slice(0, 3);
      if (Array.isArray(raw.learned)) f.learned = raw.learned.slice();
      if (raw.evos && typeof raw.evos === "object") {
        f.evos = {};
        Object.keys(raw.evos).slice(0, 2).forEach(function (id) { if (IL.EVOS && IL.EVOS[raw.evos[id]]) f.evos[id] = raw.evos[id]; });
      }
      if (raw.ai && IL.normAi) f.ai = IL.normAi(raw.ai);
      if (IL.ensureMoves) IL.ensureMoves(f);
      fighters.push(f);
    });
    if (!fighters.length) return null;
    const equipped = (pack.equipped || []).filter(function (id) {
      const relic = relicById(id);
      return relic && relic.scope !== "fighter";
    }).slice(0, 2);
    return {
      name: String(pack.name || "Visitors").slice(0, 24),
      crest: typeof pack.crest === "number" ? pack.crest : 1,
      equipped: equipped,
      fighters: fighters
    };
  }

  IL.RELICS = RELICS;
  IL.SETS = SETS;
  IL.relicById = relicById;
  IL.setById = setById;
  IL.relicIcon = relicIcon;
  IL.equippedRelics = equippedRelics;
  IL.relicPack = relicPack;
  IL.rebirthCost = rebirthCost;
  IL.rebirth = rebirth;
  IL.LOAN_WEEKS = LOAN_WEEKS;
  IL.askingPrice = askingPrice;
  IL.rivalBench = rivalBench;
  IL.buyFromRival = buyFromRival;
  IL.swapTopUp = swapTopUp;
  IL.swapWithRival = swapWithRival;
  IL.loanFee = loanFee;
  IL.loanIn = loanIn;
  IL.loanOutFee = loanOutFee;
  IL.loanOut = loanOut;
  IL.tickLoans = tickLoans;
  IL.DIFFICULTY = DIFFICULTY;
  IL.difficultyOf = difficultyOf;
  IL.foeMulOf = foeMulOf;
  IL.NAMED_TEAMS = NAMED_TEAMS;
  IL.namedTeam = namedTeam;
  IL.eligibleNamed = eligibleNamed;
  IL.namedFighters = namedFighters;
  IL.rivalPick = rivalPick;
  IL.rivalTire = rivalTire;
  IL.dressRivalRelics = dressRivalRelics;
  IL.rivalPrep = rivalPrep;
  IL.allianceSides = allianceSides;
  IL.scoreAlliance = scoreAlliance;
  IL.HALL = HALL;
  IL.HALL_SIZE = HALL_SIZE;
  IL.hallFoes = hallFoes;
  IL.hallPay = hallPay;
  IL.TOURNEYS = TOURNEYS;
  IL.TOURNEY_FEE = TOURNEY_FEE;
  IL.tourneyNow = tourneyNow;
  IL.tourneyEligible = tourneyEligible;
  IL.tourneyFoe = tourneyFoe;
  IL.TOWER_LV = TOWER_LV;
  IL.towerOf = towerOf;
  IL.towerFoes = towerFoes;
  IL.towerRating = towerRating;
  IL.towerCopy = towerCopy;
  IL.towerResult = towerResult;
  IL.allStarOpen = allStarOpen;
  IL.allStarSides = allStarSides;
  IL.ACADEMY_MAX_LV = ACADEMY_MAX_LV;
  IL.ACADEMY_SQUAD = ACADEMY_SQUAD;
  IL.TOMES_A_SEASON = TOMES_A_SEASON;
  IL.ensureAcademy = ensureAcademy;
  IL.academyEligible = academyEligible;
  IL.setAcademy = setAcademy;
  IL.academySquad = academySquad;
  IL.academyReady = academyReady;
  IL.academyOpponent = academyOpponent;
  IL.recordAcademy = recordAcademy;
  IL.clubAverage = clubAverage;
  IL.useTome = useTome;
  IL.THUNDER_AT = THUNDER_AT;
  IL.THUNDER_ROUNDS = THUNDER_ROUNDS;
  IL.THUNDER_POINTS = THUNDER_POINTS;
  IL.THUNDER_PAY = THUNDER_PAY;
  IL.openThunder = openThunder;
  IL.thunderSides = thunderSides;
  IL.scoreThunder = scoreThunder;
  IL.thunderTable = thunderTable;
  IL.STAFF_ROLES = STAFF_ROLES;
  IL.STAFF_SPECS = STAFF_SPECS;
  IL.VETERAN_SEASON = VETERAN_SEASON;
  IL.noteSeasonReview = noteSeasonReview;
  IL.noteCup = noteCup;
  IL.trackAlltime = trackAlltime;
  IL.alltimeBoard = alltimeBoard;
  IL.RELIC_REROLL = RELIC_REROLL;
  IL.RELIC_TRADE = RELIC_TRADE;
  IL.relicLocked = relicLocked;
  IL.lockRelic = lockRelic;
  IL.rerollRelic = rerollRelic;
  IL.tradeRelic = tradeRelic;
  IL.tradeTargets = tradeTargets;
  IL.PLAN_KEYS = PLAN_KEYS;
  IL.HEAL_RESERVE = HEAL_RESERVE;
  IL.plansOf = plansOf;
  IL.runPlans = runPlans;
  IL.staffSpec = staffSpec;
  IL.specById = specById;
  IL.staffBoost = staffBoost;
  IL.rollRecruitRarity = rollRarity;
  IL.staffSlots = staffSlots;
  IL.staffStars = staffStars;
  IL.rollStaff = rollStaff;
  IL.restockStaff = restockStaff;
  IL.hireStaff = hireStaff;
  IL.fireStaff = fireStaff;
  IL.INJURY_RISK = INJURY_RISK;
  IL.INJURY_NAME = INJURY_NAME;
  IL.injuryRiskOf = injuryRiskOf;
  IL.isInjured = isInjured;
  IL.injuryChance = injuryChance;
  IL.rollInjury = rollInjury;
  IL.tickInjuries = tickInjuries;
  IL.healCost = healCost;
  IL.healInjury = healInjury;
  IL.relicNums = relicNums;
  IL.relicText = relicText;
  IL.relicRoll = relicRoll;
  IL.rolledRelic = rolledRelic;
  IL.relicScore = relicScore;
  IL.grantAbility = grantAbility;
  IL.wornIds = wornIds;
  IL.autoRelics = autoRelics;
  IL.restockRelics = restockRelics;
  IL.RELIC_SLOT2_LV = RELIC_SLOT2_LV;
  IL.SPECIALTIES = SPECIALTIES;
  IL.MASTERIES = MASTERIES;
  IL.specialtyOf = specialtyOf;
  IL.masteryOf = masteryOf;
  IL.combatSpecialty = combatSpecialty;
  IL.chooseFocus = chooseFocus;
  IL.chooseMastery = chooseMastery;
  IL.TASKS = TASKS;
  IL.noteTasks = noteTasks;
  IL.FOCUS_COST = FOCUS_COST;
  IL.MASTERY_COST = MASTERY_COST;
  IL.rarityName = rarityName;
  IL.RARITY_MULT = RARITY_MULT;
  IL.sellValue = sellValue;
  IL.GATE_FLOORS = GATE_FLOORS;
  IL.GATE_BOSSES = GATE_BOSSES;
  IL.gateFloor = gateFloor;
  IL.gateChest = gateChest;
  IL.rollOffers = rollOffers;
  IL.potentialOf = potentialOf;
  IL.gradeOf = gradeOf;
  IL.gradeMul = gradeMul;
  IL.rollGrades = rollGrades;
  IL.stepAuction = stepAuction;
  IL.auctionBid = auctionBid;
  IL.rollApproach = rollApproach;
  IL.SHINY_ODDS = SHINY_ODDS;
  IL.rivalListing = rivalListing;
  IL.startChampionsCup = startChampionsCup;
  IL.settleCup = settleCup;
  IL.perfScore = perfScore;
  IL.perfLabel = perfLabel;
  IL.marketValue = marketValue;
  IL.rollMarket = rollMarket;
  IL.relicPrice = relicPrice;
  IL.relicSellPrice = relicSellPrice;
  IL.rollRelicStock = rollRelicStock;
  IL.weekIndex = weekIndex;
  IL.msUntilWeek = msUntilWeek;
  IL.formatRemain = formatRemain;
  IL.rollDeals = rollDeals;
  IL.openChest = openChest;
  IL.DEAL_REROLL = DEAL_REROLL;
  IL.CHEST_COST = CHEST_COST;
  IL.grantXp = grantXp;
  IL.applyBoost = applyBoost;
  IL.SCHEMA = SCHEMA;
  IL.freshClubFields = freshClubFields;
  IL.migrate = migrate;
  IL.exportChallenge = exportChallenge;
  IL.importChallenge = importChallenge;
  IL.challengeFault = challengeFault;
  IL.fielded = fielded;
  IL.offerRelic = offerRelic;
  IL.startCup = startCup;
  IL.cupOpponent = cupOpponent;
  IL.resolveOtherPairs = resolveOtherPairs;
  IL.noteCupResult = noteCupResult;
  IL.DIVISIONS = DIVISIONS;
  IL.divisionOf = divisionOf;
  IL.clubLevel = clubLevel;
  IL.rivalLevel = rivalLevel;
  IL.growRival = growRival;
  IL.rivalRange = rivalRange;
  IL.keepRivalsUp = keepRivalsUp;
  IL.WATCH_CAP = WATCH_CAP;
  IL.watchCount = watchCount;
  IL.turnMarket = turnMarket;
  IL.refreshBoard = refreshBoard;
  IL.DRAFT_COST = DRAFT_COST;
  IL.DRAFT_PICKS = DRAFT_PICKS;
  IL.draftLevel = draftLevel;
  IL.startDraft = startDraft;
  IL.rerollDraft = rerollDraft;
  IL.draftPick = draftPick;
  IL.advanceCup = advanceCup;
  IL.startChaos = startChaos;
  IL.sideStr = sideStr;
  IL.rivalBump = rivalBump;
  IL.seasonAwards = seasonAwards;
  IL.seasonPurse = seasonPurse;
  IL.SEASON_MODS = SEASON_MODS;
  IL.seasonModById = seasonModById;
  IL.pickSeasonMods = pickSeasonMods;
  IL.SEASON_GOALS = SEASON_GOALS;
  IL.pickSeasonGoals = pickSeasonGoals;
  IL.goalProgress = goalProgress;
  IL.seasonChest = seasonChest;
  IL.ACHIEVEMENTS = ACHIEVEMENTS;
  IL.claimAchievements = claimAchievements;
  IL.achievementBoard = achievementBoard;
})(typeof window !== "undefined" ? window : globalThis);
