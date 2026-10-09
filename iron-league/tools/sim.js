/* Headless season + fight checks. Run: node iron-league/tools/sim.js */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const context = {
  console: console,
  performance: { now: () => Date.now() },
  Math: Math,
  Date: Date,
  Object: Object,
  Array: Array,
  JSON: JSON,
  Number: Number,
  String: String,
  Error: Error
};
context.window = context;
context.globalThis = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, "js/data.js"), "utf8"), context);
vm.runInContext(fs.readFileSync(path.join(root, "js/kits.js"), "utf8"), context);
vm.runInContext(fs.readFileSync(path.join(root, "js/gear.js"), "utf8"), context);
vm.runInContext(fs.readFileSync(path.join(root, "js/meta.js"), "utf8"), context);
vm.runInContext(fs.readFileSync(path.join(root, "js/weapons.js"), "utf8"), context);
vm.runInContext(fs.readFileSync(path.join(root, "js/arena.js"), "utf8"), context);
const IL = context.IL;

if (IL.FRAMES) throw new Error("frames belong in hero.js");
const heroSrc = fs.readFileSync(path.join(root, "js/hero.js"), "utf8");
if (!/assets\/timefantasy\//.test(heroSrc) || /heroes99/.test(heroSrc)) {
  console.error("fighters must draw Time Fantasy sheets, not layered composites");
  process.exit(1);
}
if (!/const MOTIONS = \["idle1", "idle2", "walk", "atk1", "atk2", "bow", "gun", "hit", "crouch", "magic", "cheer", "dead"\]/.test(heroSrc)) {
  console.error("sheet column order drifted from the packer");
  process.exit(1);
}
if (!/ctx\.scale\(facing < 0 \? 1 : -1, 1\)/.test(heroSrc)) {
  console.error("sheets face -x; mirror a fighter when facing is not negative");
  process.exit(1);
}
const renderSrc = fs.readFileSync(path.join(root, "js/render.js"), "utf8");
const shakeScale = renderSrc.match(/const SHAKE_SCALE = ([0-9.]+)/);
if (!shakeScale || !(Number(shakeScale[1]) > 0) || Number(shakeScale[1]) > 0.1 || renderSrc.indexOf("(fx.shake || 0) * SHAKE_SCALE") < 0) {
  console.error("screen shake must use one SHAKE_SCALE at or under 0.1");
  process.exit(1);
}

let fails = 0;
function check(name, ok) {
  if (!ok) { fails++; console.error("FAIL", name); }
  else console.log("ok", name);
}

const seen = new Set();
for (let t = 0; t <= 2; t += 1 / 12) {
  const f = IL.frameIndex("atk1", t);
  if (IL.CLIPS.atk1.hits.indexOf(f) >= 0) seen.add(f);
}
check("atk1 hit frames visited", seen.has(39) && seen.has(40));
check("die holds last frame", IL.frameIndex("die", 5) === 81);
check("cast loops inside 65-67", [65, 66, 67].indexOf(IL.frameIndex("cast1", 1.4)) >= 0);
check("dash enters loop", IL.frameIndex("dash", 0.5) >= 84 && IL.frameIndex("dash", 0.5) <= 86);
check("roll covers 95-102", IL.frameIndex("roll", 0) === 95 && IL.frameIndex("roll", 0.5) === 101 && IL.frameIndex("roll", 2) === 102);
check("air1 hit frames", IL.CLIPS.air1.hits[0] === 55 && IL.CLIPS.air2.hits[0] === 61);
check("cast2 is wired", IL.CLIPS.cast2.from === 68 && IL.CLASSES.mage.casts.indexOf("cast2") >= 0);
check("floor is 16:9", Math.abs(IL.WORLD.w / IL.WORLD.h - 16 / 9) < 0.02);
check("fighter is within a twelfth and a sixteenth of the floor", (function () {
  const ratio = IL.BODY_H / IL.WORLD.h;
  return ratio <= 1 / 12 + 0.002 && ratio >= 1 / 16 - 0.002;
})());
(function () {
  const squad = ["warrior", "archer", "mage"];
  const left = squad.map(function (cls, i) { return { id: "L" + i, name: "L" + i, cls: cls, level: 1 }; });
  const right = squad.map(function (cls, i) { return { id: "R" + i, name: "R" + i, cls: cls, level: 1 }; });
  const m = IL.createMatch({ seed: 4, left: left, right: right, leftName: "A", rightName: "B" });
  check("teams spawn across most of the floor", m.spawnSpread >= 0.7);
  let contact = false;
  let t = 0;
  while (!m.over && t < 3.2) {
    IL.stepMatch(m, 1 / 60);
    t += 1 / 60;
    const st = m.stats;
    if ((st.hits || 0) + (st.shots || 0) + (st.casts || 0) + (st.slashes || 0) > 0) {
      contact = true;
      break;
    }
  }
  check("a fight is engaged within a few seconds", contact && t <= 3);
  const duel = IL.createMatch({
    seed: 4,
    left: [{ id: "a", name: "A", cls: "warrior", level: 1 }],
    right: [{ id: "b", name: "B", cls: "warrior", level: 1 }],
    leftName: "A",
    rightName: "B"
  });
  let met = false;
  let td = 0;
  while (!duel.over && td < 3.2) {
    IL.stepMatch(duel, 1 / 60);
    td += 1 / 60;
    const a = duel.units[0];
    const b = duel.units[1];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    const reach = (a.range || 36) + (b.radius || 14);
    if (d <= reach + 4) { met = true; break; }
  }
  check("melee meets within a few seconds", met && td <= 3.2);
})();
check("twenty four or more classes", Object.keys(IL.CLASSES).length >= 24);
check("every class has a signature", Object.keys(IL.CLASSES).every(function (id) {
  const list = IL.CLASSES[id].abilities || [];
  return list.some(function (ab) {
    return ab && IL.SIGNATURES && (IL.SIGNATURES[id + ":" + ab.id] || IL.SIGNATURES[ab.id]);
  });
}));
const seenAb = {};
Object.keys(IL.CLASSES).forEach(function (id) {
  const kit = IL.CLASSES[id];
  const list = kit.abilities || [];
  if (list.length < 14 || list.length > 15) {  // v85: 3 starters, a twin, 4 + 6 learnable; v96 adds one to five kits
    fails++;
    console.error("pool size", id, list.length);
  }
  const starters = list.filter(function (ab) { return ab && ab.unlock && ab.unlock <= 7; })
    .map(function (ab) { return ab.unlock; }).slice().sort(function (a, b) { return a - b; }).join(",");
  if (starters !== "1,4,7") {
    fails++;
    console.error("starters", id, starters);
  }
  list.forEach(function (ab) {
    if (!ab || !ab.id || !ab.kind || !ab.name || !ab.row || !ab.tags || !ab.tags.length) {
      fails++;
      console.error("bad ability", id, ab && ab.id);
      return;
    }
    seenAb[ab.id] = true;
    if (!IL.abilityIcon(ab.id)) {
      fails++;
      console.error("ability icon", ab.id);
    }
  });
  if (!kit.trait || !IL.TRAITS[kit.trait]) {
    fails++;
    console.error("trait", id);
  }
});
check("one hundred twenty or more abilities", Object.keys(seenAb).length >= 120);
(function () {
  const fighter = IL.ensureMoves(IL.randomFighter(function () { return 0.2; }, "warrior"));
  const extra = IL.poolOf("warrior").filter(function (ab) {
    return ab.unlock >= 99 && fighter.known.indexOf(ab.id) < 0;
  })[0];
  const taught = extra && IL.teachMove(fighter, extra.id) && IL.equipMove(fighter, 0, extra.id) && fighter.loadout[0] === extra.id;
  check("teach and equip a tome move", !!taught);
  const foe = IL.randomFighter(function () { return 0.3; }, "mage");
  foe.level = 7;
  fighter.level = 7;
  const bout = IL.createMatch({ seed: 3, left: [fighter], right: [foe], leftName: "A", rightName: "B" });
  let steps = 0;
  while (!bout.over && steps < 9000) { IL.stepMatch(bout, 1 / 60); steps++; }
  check("loadout fight ends", bout.over === true);
  let named = false;
  for (let seed = 1; seed <= 8 && !named; seed++) {
    const home = IL.ensureMoves({ id: "book", cls: "warrior", level: 7 });
    if (home.known.indexOf("w-guard-cut") < 0) IL.teachMove(home, "w-guard-cut");
    IL.equipMove(home, 0, "w-guard-cut");
    const away = IL.ensureMoves({ id: "book-foe", cls: "tank", level: 1 });
    const m = IL.createMatch({ seed: seed, left: [home], right: [away], leftName: "A", rightName: "B" });
    let n = 0;
    while (!m.over && n < 9000) { IL.stepMatch(m, 1 / 60); n++; }
    const row = m.units[0] && m.units[0].byAb && m.units[0].byAb["w-guard-cut"];
    if (row && row.name === "Guard Cut" && (row.dmg || 0) > 0) named = true;
  }
  check("a learned move shows in the breakdown", named);
  let twinNamed = false;
  for (let seed = 1; seed <= 8 && !twinNamed; seed++) {
    const home = IL.ensureMoves({ id: "twin-book", cls: "warrior", level: 7 });
    if (home.known.indexOf("z-warrior") < 0) IL.teachMove(home, "z-warrior");
    IL.equipMove(home, 1, "z-warrior");
    const away = IL.ensureMoves({ id: "twin-foe", cls: "tank", level: 1 });
    const m = IL.createMatch({ seed: 20 + seed, left: [home], right: [away], leftName: "A", rightName: "B" });
    let n = 0;
    while (!m.over && n < 9000) { IL.stepMatch(m, 1 / 60); n++; }
    const row = m.units[0] && m.units[0].byAb && m.units[0].byAb["z-warrior"];
    if (row && row.name === "Buckler") twinNamed = true;
  }
  check("a new move shows in the breakdown", twinNamed);
})();
const keptMoves = IL.migrate({
  v: 1,
  clubName: "Old",
  roster: [{
    id: "ada", cls: "warrior", name: "Ada",
    loadout: ["cleave", "brace", "rally"],
    known: ["cleave", "brace", "rally"],
    learned: []
  }]
});
check("old loadout stays equipped", keptMoves.roster[0].loadout.join(",") === "cleave,brace,rally");
const keptExtra = IL.migrate({
  v: 1,
  clubName: "Old",
  roster: [{
    id: "bea", cls: "warrior", name: "Bea",
    loadout: ["w-guard-cut", "brace", "rally"],
    known: ["cleave", "brace", "rally", "w-guard-cut"],
    learned: ["w-guard-cut"]
  }]
});
check("an equipped extra stays on the sheet", keptExtra.roster[0].loadout.join(",") === "w-guard-cut,brace,rally" && keptExtra.roster[0].learned.indexOf("w-guard-cut") >= 0);
let recruitSame = 0;
Object.keys(IL.CLASSES).forEach(function (id) {
  const bags = {};
    const starters = IL.poolOf(id).filter(function (ab) { return ab && ab.unlock && ab.unlock <= 7; });
    const sig = starters[0] && starters[0].id;
    const twin = IL.abilityById("z-" + id);
    const allowed = {};
    starters.forEach(function (ab) { allowed[ab.id] = true; });
    if (twin) allowed[twin.id] = true;
    for (let i = 0; i < 12; i++) {
      const f = IL.randomFighter(IL.mulberry32(3000 + i * 17 + (IL.hashStr(id) % 400)), id);
      const bad = !f.loadout || f.loadout.length !== 3 || f.loadout.indexOf(sig) < 0 || f.loadout.some(function (mid) { return !allowed[mid]; });
      if (bad) {
        fails++;
        console.error("recruit loadout", id, f.loadout);
        return;
      }
    f.loadout.forEach(function (mid) {
      const ab = IL.abilityById(mid);
      if (ab && ab.unlock >= 99 && f.learned.indexOf(mid) < 0) {
        fails++;
        console.error("extra not learned", id, mid);
      }
    });
    bags[f.loadout.join(",")] = true;
  }
  if (Object.keys(bags).length < 2) recruitSame++;
});
check("recruits of one class do not all share a loadout", recruitSame === 0);
IL.CLUBS.forEach(function (name) {
  const theme = IL.CLUB_THEMES[name];
  if (!theme || theme.length < 2) {
    fails++;
    console.error("theme", name);
    return;
  }
  theme.forEach(function (id) {
    if (!IL.CLASSES[id]) {
      fails++;
      console.error("theme class", name, id);
    }
  });
});
check("rival clubs are themed", true);
check("starters are free", ["warrior", "archer", "mage", "tank", "rogue"].every(function (id) { return IL.classUnlocked(id, 0); }));
check("exotic gates", !IL.classUnlocked("assassin", 0) && IL.classUnlocked("assassin", 70) && IL.classUnlocked("lancer", 15));
const grew = IL.growthFromXp(0, IL.xpFloor(3));
check("level 3 offers a pick", grew.level === 3 && grew.picks === 1);
check("level 2 offers none", IL.growthFromXp(0, IL.xpFloor(2)).picks === 0);
check("the xp curve rises per level", IL.xpNeed(1) === 40 && IL.xpNeed(2) > 80 && IL.xpNeed(10) > IL.xpNeed(5) && IL.xpLevel(IL.xpFloor(7)) === 7 && IL.xpLevel(IL.xpFloor(7) - 1) === 6);
const oldSave = { v: 1, roster: [{ id: "a", name: "Ada", cls: "warrior", xp: 10, level: 1, parts: { skin: 1, face: 1, hair: "m1", hairColor: 1, cloth: 4, clothColor: 6, weapon: 1 } }], clubs: [{ fighters: [{ id: "b", cls: "archer", parts: { skin: 2, weapon: 4 } }] }], market: [{ fighter: { id: "c", cls: "ranger", parts: { cloth: 3 } } }], fixtures: [] };
IL.migrate(oldSave);
check("migrate keeps roster", oldSave.roster[0].name === "Ada" && oldSave.renown === 0 && oldSave.tokens === 1 && oldSave.roster[0].boosts);
check("old parts become a sheet", IL.sheetKnown(oldSave.roster[0].parts.sheet) && !oldSave.roster[0].parts.skin);
const again = JSON.parse(JSON.stringify(oldSave));
IL.migrate(again);
check("sheet migrate is stable", again.roster[0].parts.sheet === oldSave.roster[0].parts.sheet);
check("archer save gets a bow", IL.sheetHasBow(oldSave.clubs[0].fighters[0].parts.sheet));
check("ranger save gets a bow", IL.sheetHasBow(oldSave.market[0].fighter.parts.sheet));
check("old save gets a lineup", oldSave.lineup.length === 1 && oldSave.lineup[0] === "a");
const lineRoster = [
  { id: "cap", captain: true, level: 1, xp: 0, cls: "warrior" },
  { id: "hi", captain: false, level: 5, xp: 10, cls: "mage" },
  { id: "mid", captain: false, level: 2, xp: 0, cls: "archer" },
  { id: "low", captain: false, level: 1, xp: 0, cls: "tank" }
];
const seeded = { v: 1, roster: lineRoster.map(function (f) { return Object.assign({}, f); }), clubs: [], fixtures: [] };
IL.migrate(seeded);
check("lineup prefers captain then level", seeded.lineup.join() === "cap,hi,mid");
check("fielded follows the list", IL.fielded(lineRoster, ["low", "hi", "cap"], 2).map(function (f) { return f.id; }).join() === "low,hi");
check("fielded stops at the match size", IL.fielded(lineRoster, ["low", "hi", "cap", "mid"], 3).length === 3);
check("fielded drops unknown ids", IL.fielded(lineRoster, ["nope", "mid"], 3)[0].id === "mid");
const kept = { v: 1, roster: lineRoster.map(function (f) { return Object.assign({}, f); }), lineup: ["low", "gone", "low", "hi", "cap", "mid"], clubs: [], fixtures: [] };
IL.migrate(kept);
check("lineup stays chosen", kept.lineup.join() === "low,hi,cap");
const cleared = { v: 1, roster: lineRoster.map(function (f) { return Object.assign({}, f); }), lineup: [], clubs: [], fixtures: [] };
IL.migrate(cleared);
check("an empty lineup stays empty", cleared.lineup.length === 0);
check("old save record starts at zero", oldSave.roster[0].wins === 0 && oldSave.roster[0].losses === 0 && oldSave.roster[0].kos === 0);
check("old save gains history and settings", Array.isArray(oldSave.history) && oldSave.history.length === 0 && oldSave.settings.speed === 1 && oldSave.settings.shake === true);
check("old save gains empty gear", oldSave.roster[0].gear && oldSave.roster[0].gear.weapon === null && oldSave.roster[0].gear.armor === null && Array.isArray(oldSave.items) && oldSave.items.length === 0);
check("old save gains a crest", oldSave.crest >= 1 && oldSave.crest <= 16);
const keptCrest = { v: 1, clubName: "Smoke Yard", crest: 7, roster: [], clubs: [], fixtures: [] };
IL.migrate(keptCrest);
check("a chosen crest stays", keptCrest.crest === 7);
check("plate follows the crest until chosen", keptCrest.plate === 6);
const keptPlate = { v: 1, clubName: "Smoke Yard", crest: 7, plate: 3, roster: [], clubs: [], fixtures: [] };
IL.migrate(keptPlate);
check("a chosen plate stays", keptPlate.plate === 3 && keptPlate.crest === 7);
const atlas = JSON.parse(fs.readFileSync(path.join(root, "assets/icons/atlas.json"), "utf8"));
function framesOf(row) {
  const ids = [];
  if (row.icon) ids.push(row.icon);
  if (row.icons) Object.keys(row.icons).forEach(function (k) { ids.push(row.icons[k]); });
  return ids;
}
check("every item names an atlas frame", IL.GEAR_CATALOG.length >= 18 && IL.GEAR_CATALOG.every(function (row) {
  const ids = framesOf(row);
  return ids.length >= 4 && ids.every(function (id) { return !!(atlas.frames && atlas.frames[id]); });
}));
check("class weapons cover the yard", ["longbow", "wand", "tome", "dagger", "mace", "flail", "spear", "star", "axe", "cleaver"].every(function (key) {
  return IL.GEAR_CATALOG.some(function (row) { return row.key === key && row.slot === "weapon"; });
}));
check("tonics are drinks", IL.GEAR_CATALOG.filter(function (row) { return row.slot === "tonic"; }).length >= 3);
function abilityArt(id) {
  const frame = IL.abilityIcon(id);
  if (!frame) return false;
  if (String(frame).indexOf("/") >= 0) return fs.existsSync(path.join(root, frame));
  return !!(atlas.frames && atlas.frames[frame]);
}
check("ability and currency frames exist", ["cleave", "multishot", "frost", "fireball", "taunt", "shadowstep", "mend", "pierce", "nova", "bolt"].every(abilityArt) && atlas.frames[IL.CURRENCY_ICON.gold] && atlas.frames[IL.CURRENCY_ICON.renown] && atlas.frames[IL.CURRENCY_ICON.token] && atlas.frames[IL.lootFrame("chest", "common")] && atlas.frames[IL.lootFrame("chest", "legendary")] && atlas.frames[IL.lootFrame("bag", "rare")] && atlas.frames[IL.lootFrame("bag", "epic")]);
check("a tonic is a sip of shield", IL.tonicShield({ rarity: "common" }) === 6 && IL.tonicShield({ rarity: "legendary" }) === 12);
function iconKind(id) {
  const s = String(id || "");
  if (s.indexOf("sword") >= 0) return "sword";
  if (s.indexOf("axe") >= 0) return "axe";
  if (s.indexOf("flail") >= 0) return "flail";
  if (s.indexOf("mace") >= 0) return "mace";
  if (s.indexOf("spear") >= 0) return "spear";
  if (s.indexOf("bow") >= 0) return "bow";
  if (s.indexOf("staff") >= 0) return "staff";
  if (s.indexOf("tome") >= 0 || s.indexOf("book") >= 0) return "tome";
  if (s.indexOf("dagger") >= 0) return "dagger";
  if (s.indexOf("star") >= 0) return "star";
  if (s.indexOf("leather") >= 0) return "leather";
  if (s.indexOf("gauntlet") >= 0) return "gauntlet";
  if (s.indexOf("helm") >= 0 || s.indexOf("helmet") >= 0) return "helm";
  if (s.indexOf("shield") >= 0) return "shield";
  if (s.indexOf("ring") >= 0) return "ring";
  if (s.indexOf("orb") >= 0) return "orb";
  if (s.indexOf("gem") >= 0 || s.indexOf("diamond") >= 0) return "gem";
  if (s.indexOf("potion") >= 0) return "potion";
  return s;
}
const NAME_KIND = {
  cleaver: "sword", axe: "axe", flail: "flail", mace: "mace", spear: "spear",
  longbow: "bow", wand: "staff", tome: "tome", dagger: "dagger", star: "star",
  mail: "leather", cloak: "gauntlet", helm: "helm", guard: "shield", gauntlet: "gauntlet",
  charm: "gem", band: "ring", glass: "orb",
  "tonic-green": "potion", "tonic-blue": "potion", "tonic-red": "potion",
  "ability-tome": "tome"
};
check("item names match their icons", IL.GEAR_CATALOG.every(function (row) {
  const kind = NAME_KIND[row.key];
  if (!kind) return false;
  return framesOf(row).every(function (id) { return iconKind(id) === kind; });
}));
check("dust gauntlets are gauntlets", IL.GEAR_CATALOG.some(function (row) {
  return row.key === "cloak" && row.name === "Dust Gauntlets";
}));
check("rival seasons step up a little", IL.rivalBump(1) === 0 && IL.rivalBump(2) === 1 && IL.rivalBump(8) === 3);
const perkFighter = { id: "p", level: 3, pendingPicks: 1, boosts: { hp: 0, dmg: 0, spd: 0, def: 0 }, perks: [] };
check("a perk is one stat step", IL.applyBoost(perkFighter, "hp") && perkFighter.perks.length === 1 && perkFighter.perks[0].id === "hp" && perkFighter.boosts.hp === 1 && perkFighter.pendingPicks === 0);
const awardRoster = [
  { id: "a", name: "Ada", season: { dealt: 10, taken: 2, heal: 0, kos: 1 } },
  { id: "b", name: "Bram", season: { dealt: 4, taken: 20, heal: 1, kos: 5 } },
  { id: "c", name: "Cass", season: { dealt: 3, taken: 3, heal: 14, kos: 0 } }
];
const awards = IL.seasonAwards(awardRoster);
check("season awards pick the leaders", awards.mvp.name === "Ada" && awards.kos.name === "Bram" && awards.wall.name === "Bram" && awards.healer.name === "Cass");
const achSave = {
  v: 1, gold: 0, renown: 0, bouts: 1, roster: [{ id: "a", cls: "warrior", kos: 0, level: 1 }],
  clubs: [{ id: "you", you: true, w: 0, l: 0 }], items: [], achieved: {}, seenClasses: ["warrior"]
};
IL.migrate(achSave);
const unlocked = IL.claimAchievements(achSave);
check("first bell pays once", unlocked.some(function (row) { return row.id === "first-bout"; }) && achSave.gold >= 10 && IL.claimAchievements(achSave).length === 0);
check("achievement board has a range of goals", IL.achievementBoard(achSave).length >= 30 && IL.achievementBoard(achSave).length <= 40);
check("old save keeps a training day", oldSave.trainsLeft === 2 && oldSave.trainRound === 0);
const messy = { v: 1, roster: [{ id: "a", name: "Ada", cls: "warrior", xp: 0 }], clubs: [], fixtures: [], settings: { speed: 9, shake: "no" } };
IL.migrate(messy);
check("settings migrate clamps speed", messy.settings.speed === 1 && messy.settings.shake === true && messy.settings.sound === 80 && messy.settings.music === 60 && messy.settings.crowd === 70);
const sfxSrc = fs.readFileSync(path.join(root, "js/sfx.js"), "utf8");
vm.runInContext(sfxSrc, context);
check("sfx exposes a player", typeof context.IL.sfx.play === "function" && typeof context.IL.sfx.bed === "function" && typeof context.IL.sfx.setMix === "function" && typeof context.IL.sfx.crowdBed === "function");
context.IL.sfx.setMix({ music: 0, sfx: 0, crowd: 0 });
context.IL.sfx.play("click");
context.IL.sfx.play("ko", { layer: "crowd_gasp" });
context.IL.sfx.bed("hub");
context.IL.sfx.crowdBed(true);
check("sfx loops ogg through web audio", /createBufferSource\(/.test(sfxSrc) && /src\.loop = true/.test(sfxSrc) && /codecs="vorbis"/.test(sfxSrc));
check("pitch jitter stays downward", /playbackRate\.value = 1 - Math\.random\(\) \* 0\.06/.test(sfxSrc) && !/playbackRate\.value = 1 \+/.test(sfxSrc));
check("music files stay lazy", /function bed\(/.test(sfxSrc) && sfxSrc.indexOf("assets/audio/") > 0);
const lowStats = IL.scaledStats({ level: 1, boosts: {}, champion: false }, IL.CLASSES.warrior);
const highStats = IL.scaledStats({ level: 4, boosts: { hp: 1, dmg: 1, spd: 1, def: 1 }, champion: true }, IL.CLASSES.warrior);
check("scaled stats grow", highStats.hp > lowStats.hp && highStats.atk > lowStats.atk && highStats.def > lowStats.def && highStats.speed > lowStats.speed);
Object.keys(IL.CLIPS).forEach(function (name) {
  const c = IL.CLIPS[name];
  const sample = IL.CLIP_SAMPLE[name];
  const len = c.to - c.from + 1;
  if (!IL.CLIP_MOTION[name] || !sample || sample.length !== len || sample.some(function (n) { return n < 0 || n > 2; })) {
    fails++;
    console.error("clip sample", name);
  }
});
check("atk1 hits the strike frame", IL.CLIPS.atk1.hits.every(function (f) {
  return IL.CLIP_SAMPLE.atk1[f - IL.CLIPS.atk1.from] === 2;
}));
check("bow loose sits on the hit frame", IL.CLIPS.atk1.hits.every(function (f) {
  return IL.visualSample("atk1", "bow", f - IL.CLIPS.atk1.from) === 2;
}));
check("gun muzzle sits on the hit frame", IL.visualSample("atk1", "gun", 2) === 2);
check("archer shot is a bow", IL.visualMotion("atk1", "archer", IL.defaultSheet("archer")) === "bow");
check("ranger shot is a bow", IL.visualMotion("atk1", "ranger", IL.defaultSheet("ranger")) === "bow");
check("warrior swing stays a swing", IL.visualMotion("atk1", "warrior", IL.defaultSheet("warrior")) === "atk1");
check("skirmisher fires", IL.visualMotion("atk1", "skirmisher", IL.defaultSheet("skirmisher")) === "gun");
check("gunslinger fires", IL.visualMotion("atk1", "gunslinger", IL.defaultSheet("gunslinger")) === "gun");
check("mage still chants", IL.visualMotion("cast1", "mage", IL.defaultSheet("mage")) === "magic");
check("equipped bow changes the swing", IL.visualMotion("atk1", "warrior", IL.defaultSheet("warrior"), "bow") === "bow");
check("spear thrust stays on the point", IL.visualMotion("atk1", "lancer", IL.defaultSheet("lancer"), "spear") === "atk1");
check("dagger second cut is a thrust", IL.visualMotion("atk3", "rogue", IL.defaultSheet("rogue"), "dagger") === "atk2");
const weaponMotions = IL.weapons.motions;
const weaponKinds = ["sword", "axe", "spear", "bow", "staff", "dagger", "gun", "fist", "claw", "book", "scythe", "mace", "katana", "wand", "crossbow"];
Object.keys(IL.CLASSES).forEach(function (id) {
  if (weaponKinds.indexOf(IL.CLASS_WEAPON[id]) < 0) {
    fails++;
    console.error("class has no weapon", id, IL.CLASS_WEAPON[id]);
  }
});
weaponKinds.forEach(function (kind) {
  weaponMotions.forEach(function (motion) {
    for (let sub = 0; sub < 3; sub++) {
      const a = IL.weapons.handAnchor(kind, motion, sub);
      if (!a || a.x < 0 || a.x > 47 || a.y < 0 || a.y > 47 || typeof a.rot !== "number") {
        fails++;
        console.error("bad anchor", kind, motion, sub);
      }
    }
  });
});
const swingWind = IL.weapons.handAnchor("sword", "atk1", 0);
const swingHit = IL.weapons.handAnchor("sword", "atk1", 2);
check("sword strike rotates off the windup", Math.abs(swingHit.rot - swingWind.rot) > 0.8);
const thrustWind = IL.weapons.handAnchor("spear", "atk1", 1);
const thrustHit = IL.weapons.handAnchor("spear", "atk1", 2);
check("spear thrust reaches forward", thrustHit.x < thrustWind.x - 4);
check("cast raises the staff", IL.weapons.handAnchor("staff", "magic", 1).y < IL.weapons.handAnchor("staff", "idle1", 0).y - 6);
check("ko drops the weapon", IL.weapons.handAnchor("sword", "dead", 0).y >= 36);
check("bow hand is forward of the shoulder", IL.weapons.handAnchor("bow", "bow", 0).x < 22);
check("lancer keeps a spear", IL.CLASS_WEAPON.lancer === "spear" && IL.weaponKind({ cls: "lancer" }) === "spear");
check("monk uses fists", IL.CLASS_WEAPON.monk === "fist");
check("necromancer keeps a scythe", IL.CLASS_WEAPON.necromancer === "scythe");
check("samurai keeps a katana", IL.CLASS_WEAPON.samurai === "katana");
check("axe chop leaves the sword row", IL.visualMotion("atk1", "tank", IL.defaultSheet("tank"), "axe") === "magic");
check("staff strike leaves the sword row", IL.visualMotion("atk1", "mage", IL.defaultSheet("mage"), "staff") === "magic");
check("wand gear is a wand", IL.weaponKind({ cls: "mage", gear: { weapon: { key: "wand" } } }) === "wand");
check("a longbow item on a warrior keeps the sword (v90: melee hands stay melee)", IL.weaponKind({ cls: "warrior", gear: { weapon: { key: "longbow" } } }) === "sword");
check("anchors view is the debug query", /debug=anchors/.test(fs.readFileSync(path.join(root, "js/weapons.js"), "utf8")));
const seenIds = {};
Object.keys(IL.CLASSES).forEach(function (id) {
  const pool = IL.looksFor(id);
  if (!pool.length) { fails++; console.error("no looks", id); }
  pool.forEach(function (sid) {
    if (!IL.sheetKnown(sid)) { fails++; console.error("unknown sheet", id, sid); }
    seenIds[sid] = true;
    if ((id === "archer" || id === "ranger") && !IL.sheetHasBow(sid)) {
      fails++;
      console.error("ranged look has no bow", id, sid);
    }
    if (id === "skirmisher" && !IL.sheetHasGun(sid)) {
      fails++;
      console.error("skirmisher look has no gun", id, sid);
    }
  });
});
let sheetCount = 0;
for (let s = 1; s <= 7; s++) for (let i = 1; i <= 8; i++) if (!seenIds[s + "_" + i]) { fails++; console.error("unlisted", s + "_" + i); }
for (let m = 1; m <= 3; m++) for (let i = 1; i <= 8; i++) {
  sheetCount++;
  if (!seenIds["military" + m + "_" + i]) { fails++; console.error("unlisted", "military" + m + "_" + i); }
}
sheetCount += 56;
check("every sheet is offered", sheetCount === 80 && Object.keys(seenIds).length === 80);
const board = IL.rollMarket(IL.mulberry32(3), 0);
check("market has 4 to 7 names", board.length >= 4 && board.length <= 7);
let champs = 0;
for (let i = 0; i < 40; i++) {
  IL.rollMarket(IL.mulberry32(100 + i), 80).forEach(function (row) { if (row.fighter.champion) champs++; });
}
check("champions appear", champs > 0);
check("recruits carry rarity and a specialty", board.every(function (row) {
  return row.fighter && row.fighter.rarity && IL.specialtyOf(row.fighter.specialty);
}));
const gearedSeller = { cls: "warrior", level: 4, gear: { weapon: { rarity: "rare" } } };
const bareSeller = { cls: "warrior", level: 4 };
check("sell pays for level and gear", IL.sellValue(gearedSeller) > IL.sellValue(bareSeller) && IL.sellValue(bareSeller) > IL.sellValue({ cls: "warrior", level: 1 }));
const deals = IL.rollDeals(IL.mulberry32(4), 0, 3);
const dealFighter = deals.offers[0];
const fullLegendary = Math.round(IL.hireCost(dealFighter.fighter.cls) * IL.RARITY_MULT.legendary * (dealFighter.fighter.champion ? 1.65 : 1));
check("weekly deals are five limited offers", deals.week === 3 && deals.offers.length === 5 && deals.offers.every(function (o) { return o.stock === 1; }));
check("legendary deal is discounted", dealFighter.kind === "fighter" && dealFighter.fighter.rarity === "legendary" && dealFighter.cost < fullLegendary);
check("deals include a bundle and a chest", deals.offers[1].kind === "bundle" && deals.offers[1].relics.length === 2 && deals.offers[2].kind === "chest");
check("deals include gear and a tome", deals.offers[3].kind === "gear" && deals.offers[3].item && deals.offers[4].kind === "tome" && deals.offers[4].item);
check("week clock moves", IL.weekIndex(0) === 0 && IL.weekIndex(604800000) === 1 && IL.msUntilWeek(0) === 604800000);
check("events rotate each week", IL.EVENTS.length === 5 && IL.activeEvent(0).id !== IL.activeEvent(8 * 604800000).id);
const dayA = IL.dailySquad(40, 2);
const dayB = IL.dailySquad(40, 2);
check("daily squad is seeded", dayA.length === 2 && dayA[0].name === dayB[0].name && dayA[0].cls === dayB[0].cls && IL.dailySquad(41, 2)[0].name !== dayA[0].name);
const gauntlet = IL.startGauntlet(IL.mulberry32(5), 2, 3);
check("gauntlet is five fights", gauntlet.fights.length === 5 && gauntlet.fights[0].length === 2 && gauntlet.fights[4][0].level >= 3);
check("endless modifier every fifth wave", !IL.endlessMod(4) && IL.endlessMod(5).id === "glass" && IL.endlessMod(10).id === "haste" && IL.endlessMod(25).id === "fog" && IL.ENDLESS_MODS.length >= 9);
check("fight events name a pit", IL.FIGHT_EVENTS.length === 5 && IL.weekFightEvent(0).id === "fog" && IL.weekFightEvent(604800000).id !== "fog");
const giantLeft = IL.randomFighter(IL.mulberry32(21), "warrior");
const giantRight = IL.randomFighter(IL.mulberry32(22), "mage");
const plainPit = IL.createMatch({ seed: 9, left: [giantLeft], right: [giantRight] });
const giantPit = IL.createMatch({ seed: 9, left: [giantLeft], right: [giantRight], mod: IL.FIGHT_EVENTS[4] });
check("giant mode grows a body", giantPit.hazard === "giant" && giantPit.units[0].maxHp > plainPit.units[0].maxHp && giantPit.units[0].giant);
check("a pit event names its effect", IL.FIGHT_EVENTS.every(function (ev) { return ev.name && ev.blurb && ev.blurb.length > 8; }) && giantPit.hazardName === "Giant mode" && giantPit.hazardBlurb === IL.FIGHT_EVENTS[4].blurb);
const bossF = IL.makeBoss(IL.mulberry32(6), 4);
const bossMatch = IL.createMatch({ seed: 6, left: [IL.randomFighter(IL.mulberry32(7), "rogue")], right: [bossF], mode: "boss" });
const bossUnit = bossMatch.units.filter(function (u) { return u.boss; })[0];
const plainBoss = IL.scaledStats(Object.assign({}, bossF, { boss: false }), IL.CLASSES[bossF.cls]);
check("boss is a larger body", !!bossUnit && bossUnit.maxHp > plainBoss.hp * 2);
const endlessSave = IL.migrate({ clubName: "Pit", relics: [], endless: { best: 1, board: [] } });
IL.noteEndless(endlessSave, 7);
check("endless board keeps the best wave", endlessSave.endless.best === 7 && endlessSave.endless.board[0].wave === 7);
const pupil = IL.randomFighter(IL.mulberry32(11), "warrior");
pupil.specialty = "duelist";
IL.grantXp(pupil, IL.xpFloor(5));
check("level 5 opens a focus", pupil.level >= 5 && pupil.pendingFocus === true && IL.chooseFocus(pupil, "warden") && pupil.focus === "warden" && !pupil.pendingFocus);
IL.grantXp(pupil, IL.xpFloor(10) - pupil.xp);
check("level 10 opens a mastery", pupil.level >= 10 && pupil.pendingMastery === true && IL.chooseMastery(pupil, "bulwark") && pupil.mastery === "bulwark");
const focused = IL.scaledStats(pupil, IL.CLASSES.warrior);
const barePupil = Object.assign({}, pupil, { focus: null, specialty: null, mastery: null });
const bareStats = IL.scaledStats(barePupil, IL.CLASSES.warrior);
check("focus and mastery raise defense", focused.def > bareStats.def);
const yardSave = IL.migrate({ clubName: "Yard", relics: [], facilities: { yard: 2, hall: 1, infirmary: 1 }, roster: [] });
check("facilities change the drills", IL.drillCap(yardSave) === 4 && IL.drillXp(yardSave) > IL.TRAIN_XP && IL.drillCost(yardSave) < IL.TRAIN_COST && IL.drillList(yardSave).length === 6);
const gateW = IL.randomFighter(IL.mulberry32(12), "warrior");
const gateA = IL.randomFighter(IL.mulberry32(13), "archer");
check("archery is class gated", IL.applyDrill(gateW, "archery") === false && IL.applyDrill(gateA, "archery") === true);
const drilled = IL.randomFighter(IL.mulberry32(14), "warrior");
const beforeAtk = IL.scaledStats(drilled, IL.CLASSES.warrior).atk;
IL.applyDrill(drilled, "strength");
check("strength raises attack", IL.scaledStats(drilled, IL.CLASSES.warrior).atk === beforeAtk + 1);
const taskSave = IL.migrate({ clubName: "Tasks", relics: [], roster: [] });
IL.noteTasks(taskSave, { units: [{ team: 0, hp: 0, critsLanded: 20, kos: 0, blocks: 0 }] }, true);
check("crit task grants a specialty point", taskSave.specPoints === 1 && taskSave.taskDone.crits === true);
const relicStall = IL.rollRelicStock(IL.mulberry32(5));
check("relic stall is limited", relicStall.length === 5 && relicStall.every(function (row) { return row.stock === 1 && IL.relicById(row.id) && IL.relicSellPrice(row.id) < row.cost; }));
const relicIds = {};
const iconAtlas = JSON.parse(fs.readFileSync(path.join(root, "assets/icons/atlas.json"), "utf8"));
check("every relic has an atlas icon", IL.RELICS.every(function (r) {
  const frame = IL.relicIcon(r.id);
  return !!(frame && iconAtlas.frames[frame]);
}));
check("sixty relics with rarities", IL.RELICS.length >= 60 && IL.RELICS.every(function (r) {
  if (relicIds[r.id]) return false;
  relicIds[r.id] = true;
  return r.rarity && r.kind && r.blurb && (r.scope === "club" || r.scope === "fighter");
}));
const wallPieces = IL.RELICS.filter(function (r) { return r.set === "wall"; });
const wearerRelic = wallPieces.filter(function (r) { return r.scope === "fighter"; })[0];
const clubPiece = wallPieces.filter(function (r) { return r.scope !== "fighter"; })[0];
const wearer = { id: "ada", cls: "warrior", relic: wearerRelic.id };
const wallPack = IL.relicPack({ relics: [clubPiece.id, wearer.relic], equipped: [clubPiece.id], roster: [wearer] }, [wearer]);
check("iron wall is a set", wallPieces.length >= 4 && IL.setById("wall").need === 2);
check("two wall pieces wake the set", wallPack.sets.length === 1 && wallPack.sets[0].kind === "def" && wallPack.worn.ada && wallPack.worn.ada[0].scope === "fighter");
const oldRelics = IL.migrate({ clubName: "Old", relics: ["band", "brace"], equipped: ["band", "brace"], roster: [{ id: "ada", cls: "warrior", relic: "band" }, { id: "bea", cls: "warrior", relic: "brace" }] });
check("old club relics stay equipped", oldRelics.equipped.length === 1 && oldRelics.equipped[0] === "band" && oldRelics.roster[0].relic === null && oldRelics.roster[1].relic === "brace");
const cup = IL.startCup({ clubName: "Smoke Yard", roster: [IL.randomFighter(IL.mulberry32(1), "warrior")] }, IL.mulberry32(9));
check("cup is four clubs", cup.slots.length === 4 && cup.pairing.length === 2);
const f = IL.randomFighter(IL.mulberry32(2), "warrior");
IL.grantXp(f, IL.xpFloor(3));
check("grant queues a pick per level", f.level === 3 && f.pendingLevels === 2);
const offer = IL.levelOffer(f);
check("a level-up offers four stat cards and three skill cards", offer.cards.length === 3 && offer.stats.length === 4 && offer.stats.every(function (s) { return s.pts >= 2 && s.pts <= 3; }));
check("growth style makes its best stat the biggest card", (function () {
  const b = IL.randomFighter(IL.mulberry32(5), "warrior");
  b.style = "bruiser";
  const st = IL.statOffer(b);
  const hp = st.filter(function (x) { return x.key === "hp"; })[0];
  return hp.pts === 3 && hp.good && st.every(function (x) { return x.pts <= 3; });
})());
check("every skill card has a category", offer.cards.every(function (c) { return !!IL.categoryOf(c); }));
check("the same offer comes back on reload", JSON.stringify(IL.levelOffer(f)) === JSON.stringify(offer));
check("every card has a rarity", offer.cards.every(function (c) { return c.tier >= 0 && c.tier <= 3; }));
const atkCard = offer.stats.filter(function (x) { return x.key === "atk"; })[0];
check("a pick spends the level and banks the chosen stat", !!IL.applyLevelPick(f, 0, "atk") && f.pendingLevels === 1 && f.rolls.atk === atkCard.pts && f.rolls.hp === 0 && f.rolls.def === 0 && f.rolls.spd === 0);

function fight(leftCls, rightCls, seed, level) {
  const n = Math.max(leftCls.length, rightCls.length);
  const rng = IL.mulberry32(seed);
  const left = [];
  const right = [];
  for (let i = 0; i < n; i++) {
    const a = IL.randomFighter(rng, leftCls[i % leftCls.length]);
    const b = IL.randomFighter(rng, rightCls[i % rightCls.length]);
    if (level) { a.level = level; b.level = level; }
    left.push(a);
    right.push(b);
  }
  const m = IL.createMatch({ seed: seed, left: left, right: right, leftName: "Home", rightName: "Away" });
  let steps = 0;
  while (!m.over && steps < 9000) {
    IL.stepMatch(m, 1 / 60);
    m.events.length = 0;
    steps++;
  }
  return m;
}

const samples = [];
const classIds = Object.keys(IL.CLASSES);
for (let i = 0; i < 16; i++) {
  const rng = IL.mulberry32(i * 19 + 4);
  const comp = [0, 1, 2].map(function () { return classIds[Math.floor(rng() * classIds.length)]; });
  const m = fight(comp, comp, 4000 + i);
  samples.push(m);
  m.units.forEach(u => {
    if (!Number.isFinite(u.x) || !Number.isFinite(u.y) || !Number.isFinite(u.hp)) {
      fails++;
      console.error("non finite unit", u.name, u.x, u.y, u.hp);
    }
  });
}
check("all sample fights end", samples.every(m => m.over));
const wins0 = samples.filter(m => m.winner === 0).length;
const wins1 = samples.filter(m => m.winner === 1).length;
check("both sides can win", wins0 > 0 && wins1 > 0);
const avgT = samples.reduce((s, m) => s + m.time, 0) / samples.length;
console.log("avg seconds", avgT.toFixed(1), "wins", wins0, wins1);

const archer = fight(["archer"], ["tank"], 11);
check("archer fires", archer.stats.shots > 0);
check("archer fight dealt damage", archer.stats.hits > 0);
let bookOk = false;
archer.units.forEach(function (u) {
  if (!u.byAb) return;
  let sum = 0;
  Object.keys(u.byAb).forEach(function (id) { sum += u.byAb[id].dmg || 0; });
  if (u.dmgDealt > 0 && sum === u.dmgDealt) bookOk = true;
});
check("damage is split by move", bookOk);

const mage = fight(["mage"], ["warrior"], 12);
check("mage casts", mage.stats.casts > 0);

const rogue = fight(["rogue"], ["warrior"], 13);
check("rogue dashes", rogue.stats.dashes > 0);

let blocked = 0;
for (let i = 0; i < 6; i++) {
  const t = fight(["warrior"], ["tank"], 20 + i);
  blocked += t.stats.blocks;
}
check("tank blocks sometimes", blocked > 0);

const deaths = samples.reduce((s, m) => s + m.stats.deaths, 0);
check("fighters die", deaths > 0);
const koSum = samples.reduce(function (s, m) {
  return s + m.units.reduce(function (a, u) { return a + (u.kos || 0); }, 0);
}, 0);
check("downs credit a killer", koSum > 0 && koSum <= deaths);
const dealt = samples.reduce(function (s, m) {
  return s + m.units.reduce(function (a, u) { return a + (u.dmgDealt || 0); }, 0);
}, 0);
check("damage is credited to a fighter", dealt > 0);
const rolls = samples.reduce((s, m) => s + m.stats.rolls, 0);
const dodges = samples.reduce((s, m) => s + m.stats.dodges, 0);
const leaps = samples.reduce((s, m) => s + m.stats.leaps, 0);
const airs = samples.reduce((s, m) => s + m.stats.airs, 0);
const slashes = samples.reduce((s, m) => s + m.stats.slashes, 0);
check("fighters roll", rolls > 0);
check("rolls slip a hit", dodges > 0);
check("leaps happen", leaps > 0);
check("air attacks play", airs > 0);
check("melee slashes", slashes > 0);
console.log("deaths", deaths, "blocks", blocked, "rolls", rolls, "dodges", dodges, "leaps", leaps, "airs", airs, "slashes", slashes);

const mage2 = fight(["mage", "mage"], ["warrior", "archer"], 77, 4);
check("second cast lands", mage2.stats.cast2 > 0);
const dodgeFight = fight(["warrior", "archer", "rogue"], ["mage", "archer", "warrior"], 91);
check("mixed fight dodges or rolls", dodgeFight.stats.rolls > 0 && (dodgeFight.stats.dodges > 0 || dodgeFight.stats.rolls > 2));

if (avgT < 8 || avgT > 40) {
  console.error("duration out of band", avgT);
  fails++;
}

const nakedW = IL.scaledStats({ level: 1, boosts: {}, champion: false, gear: IL.blankGear() }, IL.CLASSES.warrior);
const stacked = IL.scaledStats({
  level: 1,
  boosts: {},
  champion: false,
  gear: {
    weapon: IL.makeItem(IL.mulberry32(1), { key: "cleaver", rarity: "legendary" }),
    armor: IL.makeItem(IL.mulberry32(2), { key: "mail", rarity: "legendary" }),
    trinket: IL.makeItem(IL.mulberry32(3), { key: "band", rarity: "legendary" })
  }
}, IL.CLASSES.warrior);
check("legendary kit stays a nudge", stacked.hp < nakedW.hp * 1.28 && stacked.atk < nakedW.atk * 1.35 && stacked.hp > nakedW.hp && stacked.atk > nakedW.atk);
console.log("legendary warrior", nakedW.hp, stacked.hp, nakedW.atk, stacked.atk);

function dressedFight(seed) {
  const rng = IL.mulberry32(seed);
  const ids = Object.keys(IL.CLASSES);
  const comp = [0, 1, 2].map(function () { return ids[Math.floor(rng() * ids.length)]; });
  const left = [];
  const right = [];
  for (let i = 0; i < 3; i++) {
    left.push(IL.dressRival(IL.randomFighter(rng, comp[i]), rng));
    right.push(IL.dressRival(IL.randomFighter(rng, comp[i]), rng));
  }
  const m = IL.createMatch({ seed: seed, left: left, right: right, leftName: "Home", rightName: "Away" });
  let steps = 0;
  while (!m.over && steps < 9000) {
    IL.stepMatch(m, 1 / 60);
    m.events.length = 0;
    steps++;
  }
  return m;
}
const geared = [];
for (let i = 0; i < 12; i++) geared.push(dressedFight(7000 + i));
check("geared fights end", geared.every(function (m) { return m.over; }));
const g0 = geared.filter(function (m) { return m.winner === 0; }).length;
const g1 = geared.filter(function (m) { return m.winner === 1; }).length;
check("gear does not pick a winner", g0 > 0 && g1 > 0);
const gAvg = geared.reduce(function (s, m) { return s + m.time; }, 0) / geared.length;
console.log("geared seconds", gAvg.toFixed(1), "wins", g0, g1);
if (gAvg < 8 || gAvg > 40) {
  console.error("geared duration out of band", gAvg);
  fails++;
}

const abilities = samples.reduce(function (s, m) { return s + m.stats.abilities; }, 0);
check("abilities fire", abilities > 0);
console.log("abilities", abilities);

let cleaves = 0;
let heals = 0;
for (let i = 0; i < 8; i++) {
  cleaves += fight(["warrior", "warrior"], ["tank", "rogue"], 300 + i).stats.cleaves;
  heals += fight(["healer", "warrior"], ["archer", "mage"], 500 + i).stats.heals;
}
check("warrior cleaves", cleaves > 0);
check("healer mends", heals > 0);
console.log("cleaves", cleaves, "heals", heals);

function chaos(seed) {
  const rng = IL.mulberry32(seed);
  const sides = [0, 1, 2].map(function (team) {
    return { name: "Side " + team, fighters: [IL.randomFighter(rng)] };
  });
  const m = IL.createMatch({ seed: seed, sides: sides, mode: "chaos" });
  let steps = 0;
  while (!m.over && steps < 9000) {
    IL.stepMatch(m, 1 / 60);
    m.events.length = 0;
    steps++;
  }
  return m;
}
const pits = [0, 1, 2, 3].map(function (i) { return chaos(900 + i); });
check("chaos pits end", pits.every(function (m) { return m.over && m.winner != null && m.teams === 3; }));
const relicMatch = fight(["warrior"], ["archer"], 77);
const boosted = IL.createMatch({
  seed: 42,
  left: [Object.assign(IL.randomFighter(IL.mulberry32(4), "warrior"), { level: 3, boosts: { hp: 2, dmg: 1, spd: 0, def: 0 } })],
  right: [IL.randomFighter(IL.mulberry32(5), "rogue")],
  relics: [{ kind: "hp" }, { kind: "shield" }]
});
check("boosts and relics raise health", boosted.units[0].maxHp > relicMatch.units[0].maxHp);

let classBroke = 0;
Object.keys(IL.CLASSES).forEach(function (id) {
  const m = fight([id], ["warrior"], 12000 + (IL.hashStr(id) % 5000), 7);
  if (!m.over) {
    classBroke++;
    console.error("class fight hung", id);
  }
  m.units.forEach(function (u) {
    if (!Number.isFinite(u.hp) || !Number.isFinite(u.x) || !Number.isFinite(u.y)) {
      classBroke++;
      console.error("class fight nan", id, u.name);
    }
  });
});
check("every class can fight", classBroke === 0);

const hot = [];
const mirrorMoods = ["bold", "wary", "patient"];
Object.keys(IL.CLASSES).forEach(function (id) {
  let leftWins = 0;
  let rightWins = 0;
  const pairs = 16;
  for (let p = 0; p < pairs; p++) {
    for (let par = 0; par < 2; par++) {
      const rng = IL.mulberry32(4000 + p * 19 + (IL.hashStr(id) % 800));
      const left = IL.randomFighter(rng, id);
      const right = IL.randomFighter(rng, id);
      right.loadout = left.loadout.slice();
      right.known = left.known.slice();
      right.learned = (left.learned || []).slice();
      left.level = 7;
      right.level = 7;
      left.personality = right.personality = mirrorMoods[p % mirrorMoods.length];
      left.tactic = right.tactic = "strike";
      const m = IL.createMatch({
        seed: 3000 + p * 8 + (IL.hashStr(id) % 50),
        left: [left],
        right: [right],
        leftName: "L",
        rightName: "R"
      });
      m.stepFlip = par;
      const lane = ((p % 7) - 3) * 32;
      const gap = ((p % 4) - 2) * 20;
      m.units.forEach(function (u) {
        if (u.summon) return;
        u.y += lane;
        u.x += u.team === 0 ? -gap : gap;
      });
      let steps = 0;
      while (!m.over && steps < 9000) {
        IL.stepMatch(m, 1 / 60);
        m.events.length = 0;
        steps++;
      }
      if (!m.over) { hot.push(id + " hung"); break; }
      const scoreL = m.units.filter(function (u) { return u.team === 0 && !u.summon; }).reduce(function (s, u) { return s + Math.max(0, u.hp) / u.maxHp; }, 0);
      const scoreR = m.units.filter(function (u) { return u.team === 1 && !u.summon; }).reduce(function (s, u) { return s + Math.max(0, u.hp) / u.maxHp; }, 0);
      if (Math.abs(scoreL - scoreR) <= 1e-6) continue;
      if (m.winner === 0) leftWins++;
      else rightWins++;
    }
  }
  const decided = leftWins + rightWins;
  const rate = decided ? Math.max(leftWins, rightWins) / decided : 0;
  /* Same kit both sides. Flag a side only when it takes more than 60%
     and the lower 95% bound still beats a coin flip, so a short run
     of 5-3 does not fail the catalog. */
  let low = 0;
  if (decided) {
    const z = 1.96;
    const se = Math.sqrt(rate * (1 - rate) / decided);
    low = rate - z * se;
  }
  if (decided >= 12 && rate > 0.6 && low > 0.5) hot.push(id + " " + rate.toFixed(2) + " (" + leftWins + "-" + rightWins + ")");
});
if (hot.length) console.error("mirror hot", hot.join(", "));
check("no class mirror above 60%", hot.length === 0);

const chalSave = IL.migrate({
  clubName: "Exporters",
  crest: 3,
  relics: ["band"],
  equipped: ["band"],
  lineup: ["ada"],
  roster: [{ id: "ada", cls: "warrior", name: "Ada Vale", level: 4, parts: { sheet: IL.defaultSheet("warrior") }, relic: null }]
});
const chalCode = IL.exportChallenge(chalSave);
const chalBack = IL.importChallenge(chalCode);
check("challenge code roundtrips", !!(chalBack && chalBack.name === "Exporters" && chalBack.fighters.length === 1 && chalBack.fighters[0].cls === "warrior" && chalBack.fighters[0].level === 4 && chalBack.equipped[0] === "band"));
check("challenge keeps the loadout", chalBack.fighters[0].loadout.join(",") === chalSave.roster[0].loadout.join(",") && chalBack.fighters[0].learned.join(",") === (chalSave.roster[0].learned || []).join(","));
check("bad challenge code is empty", IL.importChallenge("nope") === null && IL.importChallenge("") === null);
check("challenge faults stay specific", IL.challengeFault("") === "Paste a code first." && IL.challengeFault("nope") === "Codes start with ILC1." && IL.challengeFault("ILC1.!!!!") === "That code is cut off or damaged." && IL.challengeFault(chalCode) === "");
const chalHome = IL.randomFighter(IL.mulberry32(8), "warrior");
chalHome.level = 5;
const chalAway = chalBack.fighters[0];
const chalHit = IL.createMatch({ seed: 3, left: [chalHome], right: [chalAway], foeRelics: [IL.relicById("band")] });
const chalBare = IL.createMatch({ seed: 3, left: [chalHome], right: [chalAway] });
const chalLeft = chalHit.units.filter(function (u) { return u.team === 0; })[0];
const chalRight = chalHit.units.filter(function (u) { return u.team === 1; })[0];
const bareLeft = chalBare.units.filter(function (u) { return u.team === 0; })[0];
const bareRight = chalBare.units.filter(function (u) { return u.team === 1; })[0];
check("foe relic stays on their side", chalRight.maxHp > bareRight.maxHp && chalLeft.maxHp === bareLeft.maxHp);
check("fresh club is schema 2", IL.freshClubFields(1).schema === 2);
const playedSave = IL.migrate({ clubName: "Old", bouts: 3, roster: [{ id: "a", cls: "warrior", name: "Ada" }] });
check("a played save skips the tour", playedSave.schema === 2 && playedSave.tutored === true);
const newSave = IL.migrate({ clubName: "New", season: 1, round: 0, bouts: 0, history: [], roster: [{ id: "a", cls: "warrior", name: "Ada" }] });
check("a new club still needs the tour", newSave.tutored === false);

/* The class rides with a warrior and a mage. A solo support is not the season. */
const bandFoes = ["warrior", "archer", "mage", "tank"];
const band = [];
Object.keys(IL.CLASSES).forEach(function (id) {
  let wins = 0;
  let games = 0;
  bandFoes.forEach(function (foe, fi) {
    for (let s = 0; s < 4; s++) {
      const m = fight([id, "warrior", "mage"], [foe, "warrior", "mage"], 50000 + s * 17 + fi * 100 + (IL.hashStr(id) % 200), 7);
      if (!m.over || m.winner == null) return;
      games++;
      if (m.winner === 0) wins++;
    }
  });
  const rate = games ? wins / games : 0;
  let low = 0;
  let high = 1;
  if (games) {
    const z = 1.96;
    const se = Math.sqrt(Math.max(0, rate * (1 - rate)) / games);
    low = rate - z * se;
    high = rate + z * se;
  }
  if (games >= 12 && ((rate < 0.15 && high < 0.28) || (rate > 0.85 && low > 0.72))) {
    band.push(id + " " + rate.toFixed(2) + " (" + wins + "/" + games + ")");
  }
});
if (band.length) console.error("balance band", band.join(", "));
check("classes stay in a win band", band.length === 0);

/* v88: every class passive is wired. The same seeded fight is played with
   the passive and without it; a live rule changes what happens. */
function printOf(m) {
  return m.units.map(function (u) { return Math.round(u.dmgDealt || 0) + ":" + Math.round(u.healing || 0) + ":" + Math.round(u.hp); }).join("|") + "@" + m.time.toFixed(2);
}
const inert = [];
Object.keys(IL.CLASSES).forEach(function (id) {
  const p = IL.CLASSES[id].passive;
  if (!p || !p.fx) return;
  let changed = false;
  for (let sd = 0; sd < 4 && !changed; sd++) {
    const seed = 7100 + sd * 31 + (IL.hashStr(id) % 97);
    const on = printOf(fight([id, "warrior", "mage"], ["tank", "archer", "warrior"], seed, 10));
    const keep = p.fx;
    p.fx = null;
    const off = printOf(fight([id, "warrior", "mage"], ["tank", "archer", "warrior"], seed, 10));
    p.fx = keep;
    if (on !== off) changed = true;
  }
  if (!changed) inert.push(id + " (" + p.id + ")");
});
if (inert.length) console.error("passives with no effect:", inert.join(", "));
check("every class passive changes the fight", inert.length === 0);

/* v92 autobattle AI. */
function aiMatch(left, right, seed) {
  const L = left.map(function (c, i) { return IL.growRival(IL.randomFighter(IL.mulberry32(seed + i), c), IL.mulberry32(seed + 50 + i), 8); });
  const R = right.map(function (c, i) { return IL.growRival(IL.randomFighter(IL.mulberry32(seed + 20 + i), c), IL.mulberry32(seed + 70 + i), 8); });
  L.concat(R).forEach(function (f) { f.personality = "patient"; });
  const m = IL.createMatch({ seed: seed, left: L, right: R, leftName: "A", rightName: "B" });
  m.engage = 0;
  m.units.forEach(function (u) { u.homeX = null; u.cool = 0.5; });
  return m;
}
(function () {
  const m = aiMatch(["warrior"], ["mage"], 9100);
  const u = m.units[0], e = m.units[1];
  u.x = 300; u.y = 200; e.x = 520; e.y = 200;
  e.state = "cast"; e.actT = 2; e.cast = { x: 300, y: 200, r: 70, t: 0, dur: 2, kind: "nova", ability: true };
  for (let i = 0; i < 66; i++) { e.actT = 2; e.cast.t = Math.min(1.5, e.cast.t); IL.stepMatch(m, 1 / 60); m.events.length = 0; }
  check("a fighter walks out of a marked spell", Math.hypot(u.x - 300, u.y - 200) > 70 + u.radius * 0.4);
})();
(function () {
  const m = aiMatch(["warrior"], ["warrior", "warrior"], 9200);
  const u = m.units[0], a = m.units[1], b = m.units[2];
  u.x = 300; u.y = 200; a.x = 380; a.y = 200; b.x = 300; b.y = 290; b.hp = Math.round(b.maxHp * 0.15);
  IL.stepMatch(m, 1 / 60);
  check("autobattle finishes the nearly dead enemy over the slightly nearer one", u.tgtId === b.id);
})();
(function () {
  const m = aiMatch(["tank", "mage"], ["warrior", "warrior"], 9300);
  const tk = m.units[0], mg = m.units[1], near = m.units[2], diver = m.units[3];
  tk.x = 300; tk.y = 200; mg.x = 200; mg.y = 300; near.x = 370; near.y = 200; diver.x = 240; diver.y = 310;
  IL.stepMatch(m, 1 / 60);
  check("a tank peels the enemy on its caster", tk.tgtId === diver.id);
})();
const longSolo = [];
Object.keys(IL.CLASSES).forEach(function (id) {
  const f = IL.randomFighter(IL.mulberry32(11), id); f.level = 7;
  const foe = IL.randomFighter(IL.mulberry32(12), "warrior");
  const m = IL.createMatch({ seed: 9, left: [f], right: [foe], leftName: "A", rightName: "B" });
  let st = 0;
  while (!m.over && st < 60 * 90) { IL.stepMatch(m, 1 / 60); m.events.length = 0; st++; }
  if (!m.over) longSolo.push(id);
});
if (longSolo.length) console.error("solo fights past 90 s:", longSolo.join(", "));
check("sudden death ends every class's solo fight inside 90 s", longSolo.length === 0);

/* v93 seasons. */
const modPicks = [];
for (let i = 0; i < 40; i++) modPicks.push(IL.pickSeasonMods(IL.mulberry32(300 + i), 2));
check("two distinct season modifiers, never Rich Purses with Lean Year", modPicks.every(function (p) { return p.length === 2 && p[0] !== p[1] && !(p.indexOf("purse") >= 0 && p.indexOf("lean") >= 0) && p.every(function (id) { return !!IL.seasonModById(id); }); }));
const goalPick = IL.pickSeasonGoals(IL.mulberry32(5));
check("five distinct season goals", goalPick.length === 5 && new Set(goalPick.map(function (g) { return g.id; })).size === 5);
const chests = [0, 1, 2, 4, 7].map(function (pl) { return IL.seasonChest(pl, 0, IL.mulberry32(50 + pl)); });
check("the season chest shrinks down the table and only the top gets a sure relic", chests[0].gold > chests[1].gold && chests[1].gold > chests[3].gold && chests[3].gold > chests[4].gold && chests[0].relic === true && chests[4].items.length === 0 && chests[0].items.length === 3);
check("a higher division fills the chest more", IL.seasonChest(0, 3, IL.mulberry32(1)).gold > IL.seasonChest(0, 0, IL.mulberry32(1)).gold);
const goalSave = { season: 2, clubs: [{ you: true, w: 6 }], roster: [{ level: 9, lv0: 5, lv0Season: 2, season: { kos: 12 } }, { level: 4, lv0: 4, lv0Season: 1, season: { kos: 3 } }], streakSeason: 2, streakBest: 3, midWon: 2 };
check("goal progress reads the save", IL.goalProgress(goalSave, "wins") === 6 && IL.goalProgress(goalSave, "kos") === 15 && IL.goalProgress(goalSave, "levels") === 4 && IL.goalProgress(goalSave, "streak") === 3 && IL.goalProgress(goalSave, "midcup") === 1 && IL.goalProgress(goalSave, "top3", { place: 2 }) === 1 && IL.goalProgress(goalSave, "top3", { place: 3 }) === 0);
(function () {
  const mk = function (mods) { return IL.createMatch({ seed: 4, left: [IL.randomFighter(IL.mulberry32(3), "warrior")], right: [IL.randomFighter(IL.mulberry32(4), "mage")], leftName: "A", rightName: "B", mods: mods }); };
  const plain = mk([]), iron = mk(["iron", "swift", "keen", "fuse", "storm"]);
  check("season modifiers change the fighters and the fight", iron.units[0].def === plain.units[0].def + 3 && Math.abs(iron.units[0].speed - plain.units[0].speed * 1.12) < 0.01 && Math.abs(iron.units[0].crit - plain.units[0].crit - 0.06) < 1e-9 && iron.suddenAt === 30 && plain.suddenAt === 45 && iron.units[0].stormCd === 0.8);
  const a = runOut(mk(["rush", "vamp"])), b = runOut(mk([]));
  check("a fight with Opening Rush and Vampiric Moon plays out differently", a.time !== b.time || a.units[0].hp !== b.units[0].hp);
})();
/* v90: a weapon item never puts a wand in an archer's hands. */
const wrongHands = [];
Object.keys(IL.CLASSES).forEach(function (cls) {
  ["cleaver", "axe", "flail", "mace", "spear", "longbow", "wand", "tome", "dagger", "star"].forEach(function (key) {
    const kind = IL.weaponKind({ cls: cls, gear: { weapon: { key: key } } });
    const own = IL.CLASS_WEAPON[cls];
    const ranged = { bow: "bow", crossbow: "bow", gun: "gun" };
    const cast = { staff: 1, wand: 1, book: 1, scythe: 1 };
    const ok = kind === own || (ranged[own] ? ranged[kind] === ranged[own] : cast[own] ? !!cast[kind] : (own === "fist" || own === "claw") ? false : !ranged[kind] && !cast[kind]);
    if (!ok) wrongHands.push(cls + "+" + key + "=" + kind);
  });
});
if (wrongHands.length) console.error("weapons outside the class family:", wrongHands.join(", "));
check("weapon items stay inside the class's weapon family", wrongHands.length === 0);
check("an archer with a longbow item still draws a bow, a mage with a tome a book", IL.weaponKind({ cls: "archer", gear: { weapon: { key: "longbow" } } }) === "bow" && IL.weaponKind({ cls: "mage", gear: { weapon: { key: "tome" } } }) === "book");
const pvRange = IL.createMatch({ seed: 1, left: [IL.randomFighter(IL.mulberry32(3), "archer")], right: [IL.randomFighter(IL.mulberry32(4), "warrior")], leftName: "A", rightName: "B" });
check("Long Eye adds 12% range", Math.abs(pvRange.units[0].range - IL.CLASSES.archer.range * 1.12) < 0.01);
const pvTeam = IL.createMatch({ seed: 1, left: [IL.randomFighter(IL.mulberry32(5), "druid"), IL.randomFighter(IL.mulberry32(6), "bard")], right: [IL.randomFighter(IL.mulberry32(7), "warrior")], leftName: "A", rightName: "B" });
check("team passives reach every ally and not the foe", pvTeam.units[0].regen >= 3 && pvTeam.units[1].regen >= 3 && pvTeam.units[1].teamDmg === 0.18 && !(pvTeam.units[2].teamDmg) && (pvTeam.units[2].regen || 0) < 3);
check("every passive has text with a number", Object.keys(IL.CLASSES).every(function (id) { const p = IL.CLASSES[id].passive; return p && /\d/.test(p.blurb || ""); }));

const nameRng = IL.mulberry32(9);
const madeNames = [];
for (let i = 0; i < 8; i++) madeNames.push(IL.uniqueName(nameRng, madeNames));
const nameFirsts = madeNames.map(function (n) { return n.split(" ")[0].toLowerCase(); });
check("generated names stay unique", nameFirsts.filter(function (n, i) { return nameFirsts.indexOf(n) !== i; }).length === 0);
const freshBoard = IL.rollMarket(IL.mulberry32(11), 0, { names: ["Zeke Ash", "Pell Slate"], sheets: ["1_1", "2_1"] });
const freshFirsts = freshBoard.map(function (row) { return row.fighter.name.split(" ")[0].toLowerCase(); });
const freshSheets = freshBoard.map(function (row) { return row.fighter.parts && row.fighter.parts.sheet; });
check("market recruits skip roster names", freshFirsts.indexOf("zeke") < 0 && freshFirsts.indexOf("pell") < 0);
check("market recruits keep distinct sheets", freshSheets.filter(function (id, i) { return id && freshSheets.indexOf(id) !== i; }).length === 0);
const trio = [0, 1, 2].map(function (i) {
  return IL.themedFighter(IL.mulberry32(40 + i), "Harrow and Coil");
});
IL.separateLooks(trio);
const trioSheets = trio.map(function (f) { return f.parts.sheet; });
check("a rival trio does not share a sheet", trioSheets[0] !== trioSheets[1] && trioSheets[1] !== trioSheets[2] && trioSheets[0] !== trioSheets[2]);
const dupClub = IL.migrate({
  clubName: "Dup",
  roster: [
    { id: "a", cls: "warrior", name: "Quill Ash" },
    { id: "b", cls: "mage", name: "Quill Vale" },
    { id: "c", cls: "archer", name: "Rho Pike" }
  ]
});
const second = dupClub.roster[1].name.split(" ")[0];
check("duplicate first names take a fresh name", dupClub.roster[0].name.split(" ")[0] === "Quill" && second !== "Quill" && IL.FIRST.indexOf(second) >= 0 && !/\d/.test(second) && dupClub.roster[2].name.split(" ")[0] === "Rho");
const suffixed = IL.migrate({
  clubName: "Dup2",
  roster: [
    { id: "a", cls: "warrior", name: "Quill Ash" },
    { id: "b", cls: "mage", name: "Quill2 Vale" }
  ]
});
const fixed = suffixed.roster[1].name.split(" ")[0];
check("a suffixed duplicate is renamed from the pool", fixed !== "Quill" && fixed !== "Quill2" && IL.FIRST.indexOf(fixed) >= 0);
const keptName = IL.migrate(JSON.parse(JSON.stringify({ clubName: "Dup2", roster: suffixed.roster })));
check("renamed duplicates stay put", keptName.roster[1].name === suffixed.roster[1].name);
let galBroke = 0;
Object.keys(IL.CLASSES).forEach(function (id) {
  const basic = IL.showcase(id, "basic");
  const ult = IL.showcase(id, 2);
  if (!basic || !basic.units[0].banner) galBroke++;
  if (!ult || !ult.units[0].banner || !ult.cine) galBroke++;
});
check("every class can preview its moves", galBroke === 0);
check("the third starter is an ultimate", !!(IL.CLASSES.warrior.abilities.filter(function (ab) { return ab.unlock === 7; })[0] || {}).ult);

/* v59: behavior rows, stamina, captain control. */
function squadOf(seed, cls, edit) {
  const rng = IL.mulberry32(seed);
  return cls.map(function (c) { const f = IL.randomFighter(rng, c); f.level = 6; if (edit) edit(f); return f; });
}
function runOut(m, each) {
  let steps = 0;
  while (!m.over && steps < 9000) {
    if (each) each(m, steps);
    IL.stepMatch(m, 1 / 60);
    m.events.length = 0;
    steps++;
  }
  return m;
}
const comp3 = ["warrior", "archer", "mage"];
/* v109: an unset behavior uses the personality's defaults; Bold has none. */
const boldAll = function (f) { f.personality = "bold"; };
const plain = runOut(IL.createMatch({ seed: 77, left: squadOf(1, comp3, boldAll), right: squadOf(2, comp3, boldAll) }));
const dflt = runOut(IL.createMatch({ seed: 77, left: squadOf(1, comp3, function (f) { f.personality = "bold"; f.ai = IL.normAi({}); }), right: squadOf(2, comp3, boldAll) }));
check("default behavior fights the same as no behavior", plain.time === dflt.time && plain.winner === dflt.winner);
check("normAi drops unknown values", IL.normAi({ target: "moon", range: "far" }).target === "near" && IL.normAi({ range: "far" }).range === "far");
const hunt = runOut(IL.createMatch({ seed: 78, left: squadOf(3, comp3, function (f) { f.ai = { target: "back", retreat: "half", evade: "often", ult: "crowd", range: "far" }; }), right: squadOf(4, comp3) }));
check("a custom behavior squad still finishes", hunt.over && hunt.units.every(function (u) { return Number.isFinite(u.x) && Number.isFinite(u.hp); }));
const fresh = { cls: "warrior", level: 5, stamina: 100 };
const spent = { cls: "warrior", level: 5, stamina: 0 };
const half = { cls: "warrior", level: 5, stamina: 50 };
const sf = IL.scaledStats(fresh, IL.CLASSES.warrior);
const ss = IL.scaledStats(spent, IL.CLASSES.warrior);
check("stamina above half costs nothing", IL.scaledStats(half, IL.CLASSES.warrior).hp === sf.hp);
check("a spent fighter is weaker, but not by much", ss.hp < sf.hp && ss.hp >= Math.floor(sf.hp * 0.87));
check("a fighter with no stamina field is fresh", IL.staminaOf({}) === 100 && IL.staminaMul({}) === 1);
const piloted = IL.createMatch({ seed: 79, left: squadOf(5, comp3), right: squadOf(6, comp3) });
piloted.pilot = { id: piloted.units[0].id, mx: 0, my: 0, goX: null, goY: null, focusId: null, targetId: null, ab: null, abT: 0, roll: false, chase: false, auto: false };
const startX = piloted.units[0].x;
for (let i = 0; i < 70; i++) { piloted.pilot.mx = 1; IL.stepMatch(piloted, 1 / 60); piloted.events.length = 0; }
const pu = piloted.units.filter(function (u) { return u.id === piloted.pilot.id; })[0];
check("the steered fighter walks where the keys say", pu.x > startX + 30);
piloted.pilot.mx = 0;
piloted.pilot.roll = true;
for (let i = 0; i < 2; i++) { IL.stepMatch(piloted, 1 / 60); piloted.events.length = 0; }
check("the steered fighter rolls on request", piloted.stats.rolls > 0);
runOut(piloted, function (m) { if (m.pilot.ab == null && m.time % 2 < 0.02) { m.pilot.ab = 0; m.pilot.abT = 2.6; } });
check("a steered match still ends", piloted.over);
check("the steered fighter landed hits", pu.dmgDealt > 0);

/* v65: rebalance. */
const curveSave = IL.migrate({ clubName: "Old", roster: [{ id: "o1", cls: "warrior", name: "Old Timer", level: 18, xp: 700 }, { id: "o2", cls: "mage", name: "Old Mage", level: 9, xp: 330 }] });
check("an old save keeps every level on the new curve", curveSave.roster[0].level === 18 && IL.xpLevel(curveSave.roster[0].xp) === 18 && curveSave.roster[1].level === 9 && IL.xpLevel(curveSave.roster[1].xp) === 9);
check("an old save keeps its share of the level", IL.xpInto(curveSave.roster[0].xp, 18).frac > 0.45 && IL.xpInto(curveSave.roster[0].xp, 18).frac < 0.55);
const curveAgain = IL.migrate(JSON.parse(JSON.stringify(curveSave)));
check("the xp move runs once", curveAgain.roster[0].xp === curveSave.roster[0].xp);
check("an old high club is seated in a high division", curveSave.division >= 2 && IL.migrate({ clubName: "New", roster: [{ id: "n1", cls: "warrior", name: "New Hand", level: 1, xp: 0 }] }).division === 0);
const lvlSave = { division: 0, roster: [{ level: 12 }, { level: 11 }, { level: 10 }, { level: 2 }] };
const rivalLvls = [];
for (let c = 0; c < 7; c++) for (let k = 0; k < 3; k++) rivalLvls.push(IL.rivalLevel(lvlSave, c, k));
function rivalSpread(lv, division) {
  const d = { division: division || 0, roster: [{ level: lv }, { level: lv }, { level: lv }] };
  const out = [];
  for (let c = 0; c < 7; c++) for (let k = 0; k < 3; k++) out.push(IL.rivalLevel(d, c, k));
  return [Math.min.apply(null, out), Math.max.apply(null, out)];
}
check("rivals track the club level within seven", rivalLvls.every(function (lv) { return Math.abs(lv - 11) <= 7; }));
check("a young club meets rivals one level either way", rivalSpread(6)[0] === 5 && rivalSpread(6)[1] === 7 && rivalSpread(3)[1] <= 4);
check("the swing grows to six each way by level 24", rivalSpread(24)[0] <= 18 && rivalSpread(24)[1] >= 30 && rivalSpread(16)[1] - 16 < 6);
check("the division floor lifts rivals two levels at most", rivalSpread(6, 2)[1] <= 6 + 2 + 2 && IL.rivalLevel({ division: 4, roster: [{ level: 3 }] }, 3, 0) === 5 && IL.rivalLevel({ division: 4, roster: [{ level: 15 }] }, 3, 0) === 16);
check("the level cap is 100", IL.LEVEL_CAP === 100 && IL.xpLevel(IL.xpFloor(100) + 1e6) === 100);
const capSave = { division: 0, roster: [{ level: 100 }, { level: 100 }, { level: 100 }] };
check("rivals of a maxed club stay at the cap", IL.rivalLevel(capSave, 6, 2) === 100 && IL.rivalLevel(capSave, 0, 1) === 93);
const gb = IL.gateFloor({ division: 0, roster: [{ level: 10 }, { level: 10 }, { level: 10 }] }, IL.mulberry32(5), 5).boss;
check("a gate boss takes its level-ups", gb.level >= 11 && (gb.growth || []).length === gb.level - 1);
const tall = IL.growRival(IL.randomFighter(IL.mulberry32(91), "warrior"), IL.mulberry32(92), 60);
check("a rival grows past the old 40-pick guard", tall.level === 60 && tall.pendingLevels === 0 && (tall.growth || []).length === 59);
const keepSave = { division: 0, roster: [{ level: 10 }, { level: 10 }, { level: 10 }], clubs: [{ you: true }] };
for (let c = 0; c < 7; c++) keepSave.clubs.push({ id: "c" + c, swing: c, fighters: [0, 1, 2].map(function (k) { return IL.growRival(IL.randomFighter(IL.mulberry32(500 + c * 3 + k)), IL.mulberry32(600 + c * 3 + k), IL.rivalLevel(keepSave, c, k)); }) });
keepSave.roster.forEach(function (f) { f.level = 20; });
IL.keepRivalsUp(keepSave);
const downSave = { division: 0, roster: [{ level: 6 }, { level: 6 }, { level: 6 }], clubs: [{ you: true }, { id: "c0", swing: 6, fighters: [IL.growRival(IL.randomFighter(IL.mulberry32(41), "warrior"), IL.mulberry32(42), 15)] }] };
const downName = downSave.clubs[1].fighters[0].name;
IL.keepRivalsUp(downSave);
const downF = downSave.clubs[1].fighters[0];
check("an over-levelled rival is rebuilt at its target", downF.level === IL.rivalLevel(downSave, 6, 0) && downF.level <= 7 && downF.name === downName && downF.growth.length === downF.level - 1 && downF.pendingLevels === 0);
check("rivals catch up when the club levels mid-season", keepSave.clubs.slice(1).every(function (c) { return c.fighters.every(function (f, k) { return f.level === IL.rivalLevel(keepSave, c.swing, k) && f.pendingLevels === 0 && (f.growth || []).length === f.level - 1; }); }));
const topA = IL.growRival(IL.randomFighter(IL.mulberry32(701), "archer"), IL.mulberry32(702), 100);
const topB = IL.growRival(IL.randomFighter(IL.mulberry32(703), "warrior"), IL.mulberry32(704), 94);
const topM = runOut(IL.createMatch({ seed: 9, left: [topA], right: [topB], leftName: "A", rightName: "B" }));
check("a level 100 fight still ends", topM.over);
/* v85: every new move fires in a real fight without an error. */
const unfired = [];
Object.keys(IL.CLASSES).forEach(function (cls, ci) {
  IL.CLASSES[cls].abilities.filter(function (ab) { return /^x-/.test(ab.id); }).forEach(function (ab, ai) {
    let used = false;
    for (let seed = 0; seed < 4 && !used; seed++) {
      const me = IL.growRival(IL.randomFighter(IL.mulberry32(900 + ci * 31 + ai * 7 + seed), cls), IL.mulberry32(901 + seed), 12);
      IL.ensureMoves(me);
      if (me.known.indexOf(ab.id) < 0) me.known.push(ab.id);
      if (me.learned.indexOf(ab.id) < 0) me.learned.push(ab.id);
      me.loadout = [ab.id];
      const pal = IL.growRival(IL.randomFighter(IL.mulberry32(950 + seed), "warrior"), IL.mulberry32(951), 12);
      const foes = [0, 1].map(function (k) { return IL.growRival(IL.randomFighter(IL.mulberry32(960 + seed * 3 + k), k ? "archer" : "tank"), IL.mulberry32(962 + k), 12); });
      const m = IL.createMatch({ seed: 70 + seed, left: [me, pal], right: foes, leftName: "A", rightName: "B" });
      const u = m.units.filter(function (x) { return x.team === 0 && x.cls === cls; })[0];
      let steps = 0;
      try {
        while (!m.over && steps < 9000 && !used) {
          IL.stepMatch(m, 1 / 60); m.events.length = 0; steps++;
          if (u && u.banner && u.banner.id === ab.id) used = true;
        }
      } catch (e) { unfired.push(ab.id + " threw " + e.message); used = true; }
    }
    if (!used) unfired.push(ab.id);
  });
});
if (unfired.length) console.error("moves that never fired:", unfired.join(", "));
check("every new move fires in a fight", unfired.length === 0);
check("every class has three skill cards at every level to 100", Object.keys(IL.CLASSES).every(function (cls, ci) {
  const f = IL.randomFighter(IL.mulberry32(800 + ci), cls);
  f.level = 100; f.pendingLevels = 99;
  for (let i = 0; i < 99; i++) {
    if (IL.levelOffer(f).cards.length !== 3) return false;
    if (!IL.applyLevelPick(f, i % 3)) return false;
  }
  return f.pendingLevels === 0 && f.growth.length === 99 && f.talents.every(function (t) { return t.tier <= 3; }) && new Set(f.talents.map(function (t) { return t.id; })).size === f.talents.length;
}));
const grown = IL.growRival(IL.randomFighter(IL.mulberry32(77), "archer"), IL.mulberry32(78), 10);
check("a grown rival took its level-ups", grown.level === 10 && grown.pendingLevels === 0 && (grown.growth || []).length === 9 && Object.keys(grown.rolls).reduce(function (n, k) { return n + grown.rolls[k]; }, 0) >= 18 && Object.keys(grown.rolls).reduce(function (n, k) { return n + grown.rolls[k]; }, 0) <= 27);
check("levels come slower than the old flat 40", IL.xpFloor(10) > 9 * 40 * 2);
const rookieMv = IL.randomFighter(IL.mulberry32(41), "warrior");
const vetMv = Object.assign(JSON.parse(JSON.stringify(rookieMv)), { level: 10, wins: 12, losses: 3, kos: 20, mvps: 4, career: { dealt: 4000, heal: 0, taken: 900, kos: 20, moves: {} } });
check("market value grows with level and a record", IL.marketValue(vetMv) > IL.marketValue(rookieMv) * 2 && IL.marketValue(rookieMv) >= 20);
const ccTable = [0, 1, 2, 3, 4].map(function (i) {
  return i === 2 ? { id: "you", name: "Us", you: true } : { id: "c" + i, name: "Club " + i, you: false, fighters: [0, 1, 2].map(function (k) { return IL.randomFighter(IL.mulberry32(90 + i * 3 + k), "warrior"); }) };
});
const cc = IL.startChampionsCup({ clubName: "Us", season: 3 }, ccTable);
check("champions cup seeds 1v4 and 2v3", cc && cc.size === 3 && cc.slots[0].id === "c0" && cc.slots[1].id === "c3" && cc.slots[2].id === "c1" && cc.slots[3].id === "you" && cc.season === 3);
IL.settleCup(cc, [], IL.mulberry32(5));
check("the tie without you is settled and yours waits", cc.winners[0] && !cc.winners[1] && !cc.champion && IL.cupOpponent(cc).foe.id === "c1");
const ccOut = IL.startChampionsCup({ clubName: "Us", season: 3 }, ccTable.slice(0, 2).concat(ccTable.slice(3)).concat([{ id: "c9", name: "Club 9", you: false, fighters: ccTable[0].fighters }]));
IL.settleCup(ccOut, [], IL.mulberry32(6));
check("a cup without you plays to a champion", !!ccOut.champion && ccOut.champion !== "you");
const offSave = IL.migrate({ clubName: "Off", season: 2, round: 3, roster: [{ id: "cap", cls: "warrior", captain: true, level: 4 }, { id: "b1", cls: "archer", level: 3, wins: 2 }] });
offSave.clubs = [{ id: "you", name: "Off", you: true }, { id: "c0", name: "Red Kettle", you: false, fighters: [] }];
let offerSeen = 0;
for (let k = 0; k < 40; k++) { offSave.offers = []; IL.rollOffers(offSave, IL.mulberry32(300 + k)); if (offSave.offers.length) offerSeen++; }
const anOffer = (function () { for (let k = 0; k < 40; k++) { offSave.offers = []; IL.rollOffers(offSave, IL.mulberry32(300 + k)); if (offSave.offers.length) return offSave.offers[0]; } return null; })();
check("rivals bid for your fighters, never the captain, above value", offerSeen > 5 && offerSeen < 35 && anOffer && anOffer.fid === "b1" && anOffer.gold >= IL.marketValue(offSave.roster[1]));
offSave.round = 5;
IL.rollOffers(offSave, IL.mulberry32(999));
check("an offer lasts one week", (offSave.offers || []).every(function (o) { return offSave.round - o.round <= 1; }));
const listing = IL.rivalListing({ clubName: "Off", renown: 999, division: 1, roster: [{ level: 6 }, { level: 6 }, { level: 6 }] }, IL.mulberry32(7), "Red Kettle", []);
check("a rival listing comes at the club's level and over value", listing && listing.from === "Red Kettle" && listing.fighter.level >= 4 && listing.cost >= IL.marketValue(listing.fighter));
const gateSave = { roster: [{ level: 4 }, { level: 4 }, { level: 4 }], relics: [] };
const gate1 = IL.gateFloor(gateSave, IL.mulberry32(11), 1);
const gate5 = IL.gateFloor(gateSave, IL.mulberry32(12), 5);
const gate8 = IL.gateFloor(gateSave, IL.mulberry32(13), 8);
check("iron gate floors scale and bosses sit on 5, 7 and 8", IL.GATE_FLOORS === 8 && gate1.foes && gate1.foes.length >= 1 && gate5.boss && gate5.boss.boss && gate5.boss.name === "Gate Warden" && gate8.boss.name === "The Gatekeeper" && gate8.adds.length === 2 && !IL.gateFloor(gateSave, IL.mulberry32(14), 6).boss);
check("a gate chest grows with the floor", IL.gateChest(gateSave, IL.mulberry32(3), 8).gold >= IL.gateChest(gateSave, IL.mulberry32(3), 1).gold);
const facSave = { facilities: { hq: 2, barracks: 1, infirmary: 2, scout: 2, treasury: 1 } };
check("facilities scale the club", IL.rosterCap(facSave) === IL.ROSTER_CAP + 4 && Math.abs(IL.benchShare(facSave) - 0.15) < 1e-9 && IL.restBonus(facSave) === 12 && IL.scoutOdds(facSave) === 1 && IL.clubRelicSlots(facSave) === 3 && IL.rosterCap({}) === IL.ROSTER_CAP);
const facMig = IL.migrate({ clubName: "F", roster: [{ id: "a", cls: "warrior" }], facilities: { hq: 9, yard: 5 } });
check("facility ranks clamp to their max", facMig.facilities.hq === 3 && facMig.facilities.yard === 2 && facMig.facilities.treasury === 0);
check("an unplayed fighter is unproven", IL.perfScore(rookieMv) === 0 && IL.perfLabel(0) === "Unproven" && IL.perfScore(vetMv) > 150);
check("higher divisions pay more", IL.seasonPurse(0, 4).gold > IL.seasonPurse(0, 0).gold * 2);
function grownTrio(seed, lv) {
  const r = IL.mulberry32(seed);
  return ["warrior", "archer", "mage"].map(function (c) { return IL.growRival(IL.randomFighter(r, c), r, lv); });
}
let even = 0;
for (let i = 0; i < 20; i++) {
  const mm = runOut(IL.createMatch({ seed: 500 + i, left: grownTrio(600 + i, 10), right: grownTrio(700 + i, 10) }));
  if (mm.winner === 0) even++;
}
console.log("grown level 10 mirror", even, "/ 20");
check("two grown trios of one level split the wins", even >= 5 && even <= 15);
let up = 0;
for (let i = 0; i < 20; i++) {
  const mm = runOut(IL.createMatch({ seed: 800 + i, left: grownTrio(900 + i, 11), right: grownTrio(950 + i, 10) }));
  if (mm.winner === 0) up++;
}
console.log("grown level 11 vs 10", up, "/ 20");
check("one level is an edge, not a wall", up >= 8 && up <= 18);

/* v62: level-up ranks. */
const lvMig = IL.migrate({ clubName: "Mig", roster: [{ id: "m1", cls: "warrior", name: "Old Hand", level: 6, xp: 200, pendingPicks: 1, pendingMoves: 1 }] });
check("old stat picks and moves fold into the level queue", lvMig.roster[0].pendingLevels === 2 && lvMig.roster[0].pendingPicks === 0 && lvMig.roster[0].pendingMoves === 0);
const ranker = IL.randomFighter(IL.mulberry32(41), "warrior");
ranker.level = 8;
ranker.pendingLevels = 8;
IL.ensureMoves(ranker);
const kindsSeen = {};
for (let i = 0; i < 8; i++) {
  const o = IL.levelOffer(ranker);
  o.cards.forEach(function (c) { kindsSeen[c.kind] = true; });
  const pick = o.cards.findIndex(function (c) { return !kindsSeen["took" + c.kind]; });
  const card = IL.applyLevelPick(ranker, pick >= 0 ? pick : 0);
  if (card) kindsSeen["took" + card.kind] = true;
}
check("level picks offer moves, specializations, and talents", kindsSeen.learn && kindsSeen.spec && kindsSeen.talent && ranker.pendingLevels === 0 && ranker.growth.length === 8);
check("a move takes at most one specialization", Object.keys(ranker.specs || {}).every(function (id) { return ranker.loadout.indexOf(id) >= 0 || ranker.known.indexOf(id) >= 0; }));
check("talents are not offered twice", (ranker.talents || []).length === new Set((ranker.talents || []).map(function (t) { return t.id; })).size);
const styled = IL.scaledStats({ cls: "warrior", level: 5, rolls: { hp: 4, atk: 0, def: 0, spd: 0 } }, IL.CLASSES.warrior);
const plainS = IL.scaledStats({ cls: "warrior", level: 5 }, IL.CLASSES.warrior);
check("stat roll points add a little health", styled.hp > plainS.hp && styled.hp - plainS.hp <= Math.ceil(IL.CLASSES.warrior.hp * 0.11));
check("every fighter has a growth style", IL.STYLES[IL.styleOf({ id: "zz" })] && IL.STYLES[IL.styleOf(IL.randomFighter(IL.mulberry32(5)))]);
const rankA = IL.randomFighter(IL.mulberry32(42), "warrior");
rankA.level = 6;
IL.ensureMoves(rankA);
const rankB = JSON.parse(JSON.stringify(rankA));
rankB.ranks = {};
rankB.specs = {};
rankA.loadout.forEach(function (id) { rankB.specs[id] = { mod: "heavy", tier: 3 }; });
const foesR = squadOf(43, ["tank"]);
function dummyDamage(fighter, seed) {
  const m = IL.createMatch({ seed: seed, left: [JSON.parse(JSON.stringify(fighter))], right: JSON.parse(JSON.stringify(foesR)) });
  m.units.forEach(function (u) { if (u.team === 1) { u.hp = u.maxHp = 99999; u.atk = 1; u.def = 0; } });
  for (let i = 0; i < 600; i++) { IL.stepMatch(m, 1 / 60); m.events.length = 0; }
  const me = m.units.filter(function (u) { return u.team === 0; })[0];
  return fighter.loadout.reduce(function (n, id) { return n + ((me.byAb && me.byAb[id] && me.byAb[id].dmg) || 0); }, 0);
}
const seedsR = [90, 91, 92, 93, 94];
const sumOf = function (f) { return seedsR.reduce(function (n, sd) { return n + dummyDamage(f, sd); }, 0); };
check("heavy specializations hit harder", sumOf(rankB) > sumOf(rankA) * 1.2);

/* v60: watchlist and draft cup. */
const wsave = { clubName: "Watchers", renown: 0, roster: [], market: IL.rollMarket(IL.mulberry32(5), 0, { names: [], sheets: [] }) };
wsave.market[0].watch = true;
wsave.market[0].base = wsave.market[0].cost;
const watchedId = wsave.market[0].fighter.id;
IL.refreshBoard(wsave, IL.mulberry32(6), { names: [], sheets: [] });
check("a refresh keeps the watched recruit", wsave.market.some(function (r) { return r.fighter.id === watchedId && r.watch; }));
let wKept = 0;
let wSigned = 0;
for (let i = 0; i < 60; i++) {
  const sv = { clubName: "W", renown: 0, roster: [], market: IL.rollMarket(IL.mulberry32(100 + i), 0, { names: [], sheets: [] }) };
  sv.market[0].watch = true;
  const id = sv.market[0].fighter.id;
  const notes = IL.turnMarket(sv, IL.mulberry32(200 + i), { names: [], sheets: [] });
  const still = sv.market.filter(function (r) { return r.fighter.id === id; })[0];
  if (still) { wKept++; if (!(still.cost >= 22)) fails++; }
  else if (notes.some(function (n) { return n.indexOf("signed") >= 0; })) wSigned++;
  if (sv.market.filter(function (r) { return !r.watch; }).some(function (r) { return r.fighter.id === id; })) fails++;
}
check("a match keeps most watched recruits and loses a few", wKept > 40 && wSigned > 0 && wKept + wSigned === 60);
const scoutSave = { clubName: "S", renown: 99, roster: [], scout: "healer", market: [] };
let scouted = 0;
for (let i = 0; i < 30; i++) { if (IL.turnMarket(scoutSave, IL.mulberry32(300 + i), { names: [], sheets: [] }).some(function (n) { return n.indexOf("Healer") >= 0; })) scouted++; }
check("the scout finds the wanted class on some turns", scouted >= 8);
const dsave = { clubName: "Drafters", roster: [{ level: 4 }, { level: 6 }, { level: 5 }, { level: 1 }] };
const draft = IL.startDraft(dsave, IL.mulberry32(9));
check("a draft offers three distinct classes at the club's level", draft.offer.length === 3 && new Set(draft.offer.map(function (f) { return f.cls; })).size === 3 && draft.level === 5 && draft.offer.every(function (f) { return f.level === 5; }));
IL.draftPick(dsave, draft, 0, IL.mulberry32(10));
check("a later offer skips classes already drafted", draft.offer.every(function (f) { return f.cls !== draft.picks[0].cls; }));
IL.draftPick(dsave, draft, 1, IL.mulberry32(11));
IL.draftPick(dsave, draft, 2, IL.mulberry32(12));
check("three picks open a four-club bracket", draft.stage === "bracket" && draft.cup.slots.length === 4 && draft.cup.slots.slice(1).every(function (side) { return side.fighters.length === 3 && side.fighters.every(function (f) { return f.level === 5; }); }));
const dopp = IL.cupOpponent(draft.cup);
const dm = runOut(IL.createMatch({ seed: 81, left: draft.picks, right: dopp.foe.fighters, mode: "draft" }));
check("a draft tie plays out", dm.over);

/* v94 grades, potential, shiny, champion passive, auction, approach. */
function gradeShare(rarity, champ) {
  let good = 0, ex = 0, n = 0;
  for (let i = 0; i < 400; i++) {
    const g = IL.rollGrades(IL.mulberry32(500 + i), rarity, champ, false);
    ["hp", "atk", "def", "spd"].forEach(function (k) { n++; if (g[k] === "G") good++; if (g[k] === "E") ex++; });
  }
  return { good: good / n, ex: ex / n };
}
const gCommon = gradeShare("common", false);
const gLegend = gradeShare("legendary", false);
const gChamp = gradeShare("legendary", true);
check("rarer fighters roll better growth grades", gLegend.ex > gCommon.ex * 2 && gLegend.good > gCommon.good && gChamp.ex > gLegend.ex);
check("a shiny always has one Excellent grade", [0, 1, 2, 3, 4, 5].every(function (i) {
  const g = IL.rollGrades(IL.mulberry32(900 + i), "common", false, true);
  return ["hp", "atk", "def", "spd"].some(function (k) { return g[k] === "E"; });
}));
const potAll = [];
for (let i = 0; i < 200; i++) {
  const f = IL.randomFighter(IL.mulberry32(700 + i), "warrior");
  f.grades = IL.rollGrades(IL.mulberry32(800 + i), i % 2 ? "legendary" : "common", false, false);
  f.rarity = i % 2 ? "legendary" : "common";
  potAll.push(IL.potentialOf(f));
}
check("potential stays within 1 to 5 stars", potAll.every(function (n) { return n >= 1 && n <= 5 && n === Math.round(n); }) && new Set(potAll).size >= 3);
const gBase = IL.randomFighter(IL.mulberry32(77), "warrior");
gBase.level = 40;
const gB = Object.assign({}, gBase, { grades: { hp: "B", atk: "B", def: "B", spd: "B" }, shiny: false });
const gE = Object.assign({}, gBase, { grades: { hp: "E", atk: "E", def: "E", spd: "E" }, shiny: false });
const gS = Object.assign({}, gB, { shiny: true });
const sB = IL.scaledStats(gB, IL.CLASSES.warrior), sE = IL.scaledStats(gE, IL.CLASSES.warrior), sS = IL.scaledStats(gS, IL.CLASSES.warrior);
check("Excellent growth outgrows Balanced by level 40", sE.hp > sB.hp * 1.15 && sE.atk > sB.atk * 1.1 && sE.def > sB.def);
check("a shiny gets +20% HP and ATK", Math.abs(sS.hp / sB.hp - 1.2) < 0.02 && Math.abs(sS.atk / sB.atk - 1.2) < 0.02);
const cpId = Object.keys(IL.CLASSES).map(function (c) { return IL.CLASSES[c].passive; }).filter(function (p) { return p && p.fx && p.id !== (IL.CLASSES.warrior.passive || {}).id; })[0].id;
const cpF = Object.assign({}, gB, { champion: true, champPassive: cpId });
const cpM = IL.createMatch({ seed: 3, left: [cpF], right: [IL.randomFighter(IL.mulberry32(4), "mage")], mode: "friendly" });
const cpFx = Object.keys(IL.CLASSES).map(function (c) { return IL.CLASSES[c].passive; }).filter(function (p) { return p && p.id === cpId; })[0].fx;
check("a champion carries a second class's passive", Object.keys(cpFx).length > 0 && Object.keys(cpFx).every(function (k) { return cpM.units[0].pv && cpM.units[0].pv[k] !== undefined; }));
const aSave = { clubName: "A", season: 1, round: 0, renown: 40, gold: 5000, roster: [], clubs: [{ name: "A", you: true }, { name: "Rival FC" }] };
let aRng = IL.mulberry32(41);
for (let i = 0; i < 40 && !aSave.auction; i++) IL.stepAuction(aSave, aRng);
check("an auction opens with a star fighter", !!(aSave.auction && aSave.auction.fighter && (aSave.auction.fighter.champion || aSave.auction.fighter.shiny)));
const open0 = aSave.auction.bid;
check("the first bid takes the opening price", IL.auctionBid(aSave) && aSave.auction.bid === open0 && aSave.auction.leader === "you" && !IL.auctionBid(aSave));
const aFighter = aSave.auction.fighter;
const aBid = aSave.auction.bid;
aSave.round = aSave.auction.closes;
IL.stepAuction(aSave, aRng);
check("winning the auction signs the fighter and takes the gold", aSave.auction === null && aSave.roster.indexOf(aFighter) >= 0 && aSave.gold === 5000 - aBid);
const apSave = { clubName: "P", season: 1, round: 0, renown: 40, gold: 0, roster: [] };
let apHits = 0, apGood = true;
for (let i = 0; i < 100; i++) {
  apSave.approach = null;
  IL.rollApproach(apSave, IL.mulberry32(1000 + i));
  if (apSave.approach) { apHits++; if (!apSave.approach.fighter.champion || apSave.approach.cost < 80) apGood = false; }
}
check("a champion approaches on some weeks", apHits >= 4 && apHits <= 25 && apGood);
apSave.approach = { fighter: {}, cost: 100, round: 0, season: 1 };
apSave.round = 3;
IL.rollApproach(apSave, function () { return 0.99; });
check("an unanswered approach expires", apSave.approach === null);

/* v95 relics v2: exact numbers, rolls, two slots, named legendaries, granted moves, weekly stall, auto-equip. */
check("every relic has exact text", IL.RELICS.every(function (r) { const t = IL.relicText(r); return t && t.length > 12 && (r.kind === "grant" || /\d/.test(t)); }));
const rWar = IL.randomFighter(IL.mulberry32(51), "warrior");
rWar.level = 12; rWar.id = "rw";
const rFoe = IL.randomFighter(IL.mulberry32(52), "warrior");
rFoe.level = 12; rFoe.id = "rf";
function relicUnit(relics, roll) {
  const list = relics.map(function (id) { return Object.assign({}, IL.relicById(id), { roll: roll || 1 }); });
  const m = IL.createMatch({ seed: 5, left: [rWar], right: [rFoe], wornRelics: { rw: list }, mode: "friendly" });
  m.engage = 0;
  return { m: m, u: m.units[0], foe: m.units[1] };
}
const rBase = relicUnit([]).u;
const rBand = relicUnit(["band"]).u;
check("a relic does what its text says", Math.abs(rBand.maxHp / rBase.maxHp - (1 + IL.relicNums(IL.relicById("band")).hp / 100)) < 0.01);
check("a higher roll gives bigger numbers", relicUnit(["band"], 1.15).u.maxHp > relicUnit(["band"], 0.85).u.maxHp && IL.relicNums(Object.assign({}, IL.relicById("band"), { roll: 1.15 })).hp > IL.relicNums(IL.relicById("band")).hp);
const rollSave = { clubName: "Rolls", relics: ["band"] };
const rv = IL.relicRoll(rollSave, "band");
check("a relic roll sits between 85% and 115% and sticks", rv >= 0.85 && rv <= 1.15 && IL.relicRoll(rollSave, "band") === rv);
const twoF = { id: "tw", cls: "warrior", level: 10, relic: "oath", relic2: "hone" };
const twoS = { relics: ["oath", "hone"], equipped: [], roster: [twoF] };
check("a level 10 fighter wears two relics", IL.relicPack(twoS, [twoF]).worn.tw.length === 2);
twoF.level = 9;
check("below level 10 only the first slot counts", IL.relicPack(twoS, [twoF]).worn.tw.length === 1 && IL.relicPack(twoS, [twoF]).worn.tw[0].id === "oath");
const rv1 = relicUnit(["phoenix"]);
IL._deal(rv1.m, rv1.foe, rv1.u, 99999, { dot: true });
check("Phoenix Feather survives one killing blow", rv1.u.hp > 0 && rv1.u.revived && Math.abs(rv1.u.hp / rv1.u.maxHp - IL.relicNums(IL.relicById("phoenix")).hp / 100) < 0.02);
check("the revive guards for a moment", rv1.u.iframe > 0);
rv1.u.iframe = 0;
IL._deal(rv1.m, rv1.foe, rv1.u, 99999, { dot: true });
check("but only once", rv1.u.hp <= 0);
const ls = relicUnit(["bloodvine"]);
ls.u.hp = ls.u.maxHp * 0.5;
const lsWas = ls.u.hp;
IL._deal(ls.m, ls.u, ls.foe, 100, { dot: true });
check("Bloodvine Ring heals off damage dealt", ls.u.hp > lsWas);
const rf = relicUnit(["aegis"]);
const rfWas = rf.foe.hp;
IL._deal(rf.m, rf.foe, rf.u, 100, {});
check("Mirror Aegis returns damage to the attacker", rf.foe.hp < rfWas && rf.foe.hp > rfWas - 60);
const bk = relicUnit(["blinkstone"]);
bk.u.hp = bk.u.maxHp * 0.4;
const bx = bk.u.x;
IL._deal(bk.m, bk.foe, bk.u, 10, { dot: true });
check("Blink Stone jumps away and dodges", Math.abs(bk.u.x - bx) > 60 && bk.u.iframe > 0 && bk.u.blink.left === 1);
const gr = relicUnit(["emberidol"]);
check("Ember Idol grants Flare as an extra move", IL.pilotAbs(gr.u).some(function (ab) { return ab.id === "m-flare"; }) && !IL.pilotAbs(relicUnit([]).u).some(function (ab) { return ab.id === "m-flare"; }));
const stockSave = { season: 2, round: 3, relics: [] };
IL.restockRelics(stockSave, IL.mulberry32(8));
const stock1 = JSON.stringify(stockSave.relicStock);
check("the stall holds five rolled relics, the first rare or better", stockSave.relicStock.length === 5 && stockSave.relicStock.every(function (r) { return r.roll >= 0.85 && r.roll <= 1.15; }) && /rare|legendary/.test(IL.relicById(stockSave.relicStock[0].id).rarity));
check("the stall keeps its stock within a week", !IL.restockRelics(stockSave, IL.mulberry32(9)) && JSON.stringify(stockSave.relicStock) === stock1);
stockSave.round = 4;
check("and restocks the next week", IL.restockRelics(stockSave, IL.mulberry32(9)) && JSON.stringify(stockSave.relicStock) !== stock1);
const auTank = { id: "at", cls: "tank", level: 12 };
const auArch = { id: "aa", cls: "archer", level: 12 };
const auSave = { clubName: "Auto", relics: ["aegis", "heart", "knot", "thorn", "band", "crown", "purse"], equipped: [], roster: [auTank, auArch], facilities: {} };
IL.autoRelics(auSave, [auTank, auArch]);
const tankKinds = IL.wornIds(auTank).map(function (id) { return IL.relicById(id).kind; });
const archKinds = IL.wornIds(auArch).map(function (id) { return IL.relicById(id).kind; });
check("auto-equip fills both slots and the club slots", tankKinds.length === 2 && archKinds.length === 2 && auSave.equipped.length >= 2 && auSave.equipped.indexOf("purse") < 0);
check("auto-equip gives the tank defense and the archer damage", tankKinds.some(function (k) { return k === "reflect" || k === "hp"; }) && archKinds.some(function (k) { return k === "atk" || k === "crit"; }));

/* v96 abilities v2: seven new mechanics in real fights, and evolutions. */
function moveFight(cls, id, foes, seed, watch, setup) {
  const f = IL.randomFighter(IL.mulberry32(seed), cls);
  f.id = "mv"; f.level = 14;
  IL.ensureMoves(f);
  if (f.known.indexOf(id) < 0) f.known.push(id);
  if (f.learned.indexOf(id) < 0) f.learned.push(id);
  f.loadout = [id];
  const right = foes.map(function (c, i) { const e = IL.randomFighter(IL.mulberry32(seed + 10 + i), c); e.id = "fo" + i; e.level = 12; return e; });
  const left = [f].concat(setup && setup.ally ? [setup.ally] : []);
  const m = IL.createMatch({ seed: seed, left: left, right: right, mode: "friendly" });
  let seen = false;
  for (let k = 0; k < 2400 && !m.over && !seen; k++) {
    if (setup && setup.each) setup.each(m, k);
    IL.stepMatch(m, 1 / 60);
    if (watch(m)) seen = true;
    m.events.length = 0;
  }
  return seen;
}
["pull", "root", "silence", "chain", "drain", "revive", "homing"].forEach(function (k) {
  check("some kit has a " + k + " move", Object.keys(IL.CLASSES).some(function (c) { return IL.CLASSES[c].abilities.some(function (ab) { return ab.kind === k; }); }));
});
check("Haul pulls an enemy in", moveFight("tank", "t-haul", ["archer", "mage"], 301, function (m) { return m.units.some(function (u) { return u.team === 1 && u.pullTo; }); }));
check("Entangle roots, and a rooted fighter cannot move", (function () {
  let ok = false;
  moveFight("druid", "entangle", ["warrior"], 302, function (m) {
    const e = m.units.filter(function (u) { return u.team === 1 && u.root > 0.2 && !u.pullTo; })[0];
    if (!e) return false;
    const x = e.x, y = e.y;
    for (let q = 0; q < 6; q++) IL.stepMatch(m, 1 / 60);
    ok = Math.hypot(e.x - x, e.y - y) < 8;
    return true;
  });
  return ok;
})());
check("Hush silences, and a silenced fighter casts nothing", moveFight("bard", "bd-hush", ["mage"], 303, function (m) {
  const e = m.units.filter(function (u) { return u.team === 1 && u.silence > 0; })[0];
  return !!e && !(e.cast && e.cast.ability);
}));
function fixedFire(cls, id, foes) {
  const f = IL.randomFighter(IL.mulberry32(400), cls); f.id = "mv"; f.level = 14;
  const right = foes.map(function (c, i) { const e = IL.randomFighter(IL.mulberry32(410 + i), c); e.id = "fo" + i; e.level = 12; return e; });
  const m = IL.createMatch({ seed: 400, left: [f], right: right, mode: "friendly" });
  m.engage = 0;
  const u = m.units[0];
  u.x = 300; u.y = 300; u.cool = 0;
  m.units.slice(1).forEach(function (e, i) { e.x = 460 + i * 60; e.y = 300 + (i % 2) * 30; e.iframe = 0; });
  const t = m.units[1];
  const res = IL._fire(m, u, t, Math.hypot(t.x - u.x, t.y - u.y), IL.abilityById(id), true);
  return { m: m, u: u, res: res };
}
const ch = fixedFire("battlemage", "bm-chain", ["warrior", "warrior", "rogue"]);
check("Chain Lightning jumps between enemies", ch.res === "go" && ch.m.units.slice(1).filter(function (e) { return e.hp < e.maxHp; }).length === 3);
const dr = fixedFire("warlock", "wl-leech", ["warrior"]);
dr.u.hp = dr.u.maxHp * 0.5;
const drWas = dr.u.hp;
const dr2 = IL._fire(dr.m, dr.u, dr.m.units[1], 160, IL.abilityById("wl-leech"), true);
check("Leech heals its caster for the damage dealt", dr.res === "go" && dr.u.hp > drWas && dr.m.units[1].hp < dr.m.units[1].maxHp);
const raiseAlly = IL.randomFighter(IL.mulberry32(77), "warrior");
raiseAlly.id = "ally"; raiseAlly.level = 12;
check("Raise brings a fallen ally back once", moveFight("healer", "h-raise", ["warrior", "warrior"], 306, function (m) {
  const a = m.units.filter(function (u) { return u.id === "ally"; })[0];
  return a && a.wasRaised && a.hp > 0;
}, { ally: raiseAlly, each: function (m, k) { if (k === 30) { const a = m.units.filter(function (u) { return u.id === "ally"; })[0]; a.iframe = 0; IL._deal(m, m.units[2], a, 99999, { dot: true }); } } }));
check("Seeking Bolt turns to follow its target", moveFight("mage", "m-seek", ["rogue"], 307, function (m) {
  return m.shots.some(function (p) { return p.home; }) && m.units[0].byAb && m.units[0].byAb["m-seek"] && m.units[0].byAb["m-seek"].used;
}));
const evoF = IL.randomFighter(IL.mulberry32(91), "warrior");
IL.ensureMoves(evoF);
evoF.level = 19;
check("no evolution before level 20", IL.evoPicks(evoF) === 0);
evoF.level = 20;
const evoMove = evoF.loadout.filter(function (id) { return IL.evoChoices(IL.abilityById(id)).length; })[0];
const evoOpts = IL.evoChoices(IL.abilityById(evoMove));
check("level 20 evolves one move, with two choices", IL.evoPicks(evoF) === 1 && evoOpts.length === 2);
check("an evolution outside the move's two choices is refused", !IL.evolveMove(evoF, evoMove, "lasting"));
check("a valid evolution takes", IL.evolveMove(evoF, evoMove, evoOpts[0]) && evoF.evos[evoMove] === evoOpts[0] && IL.evoPicks(evoF) === 0);
check("the same move cannot evolve twice", (evoF.level = 50, !IL.evolveMove(evoF, evoMove, evoOpts[1]) && IL.evoPicks(evoF) === 1));
const rivalEvo = IL.randomFighter(IL.mulberry32(92), "warrior");
IL.growRival(rivalEvo, IL.mulberry32(93), 55);
check("a rival at level 55 has evolved two moves", Object.keys(rivalEvo.evos || {}).length === 2);
const evoU = relicUnit([]);
evoU.u.evos = { cleave: "root" };
IL._deal(evoU.m, evoU.u, evoU.foe, 20, { tag: { id: "cleave" } });
check("a Rooting move roots on hit", evoU.foe.root > 1);
const evoD = relicUnit([]);
evoD.u.evos = { cleave: "drain" };
evoD.u.hp = evoD.u.maxHp * 0.5;
const evoDWas = evoD.u.hp;
IL._deal(evoD.m, evoD.u, evoD.foe, 60, { tag: { id: "cleave" } });
check("a Draining move heals on hit", evoD.u.hp > evoDWas);

/* v97 K/D/A and formations. */
let kdaOk = true, assistSeen = false;
for (let i = 0; i < 6; i++) {
  const rng = IL.mulberry32(600 + i);
  const L = ["warrior", "archer", "healer"].map(function (c, j) { const f = IL.randomFighter(rng, c); f.id = "l" + j; f.level = 10; return f; });
  const R = ["warrior", "mage", "rogue"].map(function (c, j) { const f = IL.randomFighter(rng, c); f.id = "r" + j; f.level = 10; return f; });
  const m = runOut(IL.createMatch({ seed: 600 + i, left: L, right: R, mode: "friendly" }));
  [0, 1].forEach(function (team) {
    const kills = m.units.filter(function (u) { return u.team === team; }).reduce(function (n, u) { return n + (u.kos || 0); }, 0);
    const deaths = m.units.filter(function (u) { return u.team !== team && !u.summon; }).reduce(function (n, u) { return n + (u.deaths || 0); }, 0);
    if (kills > deaths) kdaOk = false;
  });
  if (m.units.some(function (u) { return (u.assists || 0) > 0; })) assistSeen = true;
}
check("knockouts never outnumber deaths, and assists are counted", kdaOk && assistSeen);
function formed(fm) {
  const rng = IL.mulberry32(700);
  const L = ["warrior", "archer", "mage"].map(function (c, j) { const f = IL.randomFighter(rng, c); f.id = "l" + j; return f; });
  const R = ["warrior", "warrior", "warrior"].map(function (c, j) { const f = IL.randomFighter(rng, c); f.id = "r" + j; return f; });
  return IL.createMatch({ seed: 700, left: L, right: R, mode: "friendly", formation: fm }).units.filter(function (u) { return u.team === 0; });
}
const fLine = formed("line"), fSpear = formed("spear"), fSpread = formed("spread"), fNone = formed(null);
check("Line matches the default start", fLine.every(function (u, i) { return Math.abs(u.x - fNone[i].x) < 1 && Math.abs(u.y - fNone[i].y) < 1; }));
check("Spearhead starts the front line further forward", fSpear[0].x > fLine[0].x + 40 && Math.abs(fSpear[1].x - fLine[1].x) < 1);
check("Spread widens the line, and home moves with it", Math.abs(fSpread[2].y - fSpread[0].y) > Math.abs(fLine[2].y - fLine[0].y) * 1.6 && fSpread[0].homeY === fSpread[0].y);

/* v98 Area moves tactic. */
check("the Area moves row defaults to 2 or more", IL.normAi({}).aoe === "two" && IL.normAi({ aoe: "any" }).aoe === "any" && IL.normAi({ aoe: "bogus" }).aoe === "two");
function aoeFire(aoe) {
  const f = IL.randomFighter(IL.mulberry32(800), "warrior"); f.id = "ao"; f.level = 10; f.ai = { aoe: aoe };
  const foes = ["warrior", "warrior", "warrior"].map(function (c, i) { const e = IL.randomFighter(IL.mulberry32(810 + i), c); e.id = "e" + i; return e; });
  const m = IL.createMatch({ seed: 800, left: [f], right: foes, mode: "friendly" });
  m.engage = 0;
  const u = m.units[0];
  u.x = 300; u.y = 300; u.cool = 0;
  m.units[1].x = 330; m.units[1].y = 300;
  m.units[2].x = 700; m.units[3].x = 760;
  return IL._fire(m, u, m.units[1], 30, IL.abilityById("cleave"));
}
check("Anyone cleaves a lone foe; 2 or more holds", aoeFire("any") === "go" && aoeFire("two") === "skip" && aoeFire("three") === "skip");

/* v99 live orders. */
function orderMatch(order) {
  const rng = IL.mulberry32(900);
  const L = ["warrior", "archer", "mage"].map(function (c, j) { const f = IL.randomFighter(rng, c); f.id = "l" + j; f.level = 10; if (j === 1) f.captain = true; return f; });
  const R = ["warrior", "warrior", "warrior"].map(function (c, j) { const f = IL.randomFighter(rng, c); f.id = "r" + j; f.level = 10; return f; });
  const m = IL.createMatch({ seed: 900, left: L, right: R, mode: "friendly" });
  m.engage = 0;
  if (order) IL.setOrder(m, 0, order);
  for (let k = 0; k < 90; k++) { IL.stepMatch(m, 1 / 60); m.events.length = 0; }
  return m;
}
const oPlan = orderMatch("plan"), oHold = orderMatch("hold");
const homeDrift = function (m) { return m.units.filter(function (u) { return u.team === 0; }).reduce(function (n, u) { return Math.max(n, Math.hypot(u.x - u.homeX, u.y - u.homeY)); }, 0); };
check("Hold keeps the line near its start", homeDrift(oHold) < 40 && homeDrift(oPlan) > homeDrift(oHold) + 30);
const oReg = orderMatch("regroup");
const capR = oReg.units.filter(function (u) { return u.captain; })[0];
const capP = oPlan.units.filter(function (u) { return u.captain; })[0];
const spreadTo = function (m, cap) { return m.units.filter(function (u) { return u.team === 0 && u !== cap; }).reduce(function (n, u) { return n + Math.hypot(u.x - cap.x, u.y - cap.y); }, 0); };
check("Regroup gathers on the captain", spreadTo(oReg, capR) < spreadTo(oPlan, capP));
check("an unknown order falls back to Plan", (function () { const m = orderMatch(null); IL.setOrder(m, 0, "dance"); return m.orders[0] === "plan"; })());

/* v100 injuries. */
const injSave = { season: 1, round: 0, gold: 500, facilities: {}, settings: {}, roster: [] };
const injF = { id: "hurt1", name: "Hurt One", cls: "warrior", level: 5, injuryRisk: "high" };
check("injury chance follows risk and the Medical Bay", IL.injuryChance(injSave, injF) === 0.2 && IL.injuryChance({ facilities: { infirmary: 2 } }, injF) < 0.15 && IL.injuryChance(injSave, { id: "x", injuryRisk: "low" }) === 0.06);
let injN = 0;
const injR = IL.mulberry32(11);
for (let i = 0; i < 1000; i++) { const f = { id: "h" + i, injuryRisk: "medium" }; if (IL.rollInjury(injSave, f, injR)) injN++; }
check("about 12% of knockouts injure a medium-risk fighter", injN > 90 && injN < 150);
check("injuries can be switched off", IL.rollInjury({ settings: { injuries: false } }, { id: "z", injuryRisk: "high" }, function () { return 0; }) === 0);
injF.injury = { weeks: 2 };
const injMate = { id: "mate", name: "Mate", cls: "warrior", level: 9 };
const injBench = { id: "bench", name: "Bench", cls: "warrior", level: 7 };
const injLow = { id: "low", name: "Low", cls: "warrior", level: 3 };
const injParty = IL.fielded([injF, injMate, injBench, injLow], ["hurt1", "mate"], 2);
check("an injured fighter sits out and the best bench fighter covers", injParty.length === 2 && injParty.indexOf(injF) < 0 && injParty.indexOf(injBench) >= 0);
check("with no healthy bench the injured play hurt", IL.fielded([injF, injMate], ["hurt1", "mate"], 2).length === 2 && IL.scaledStats(injF, IL.CLASSES.warrior).hp < IL.scaledStats(Object.assign({}, injF, { injury: null }), IL.CLASSES.warrior).hp);
injSave.roster = [injF];
IL.tickInjuries(injSave);
check("a week passes off the injury", injF.injury.weeks === 1);
const injCost = IL.healCost(injSave, injF);
check("the Medical Bay heals for gold", injCost > 0 && IL.healInjury(injSave, injF) && !IL.isInjured(injF) && injSave.gold === 500 - injCost);

/* v101 staff. */
const stSave = { season: 2, round: 1, gold: 2000, facilities: {}, roster: [], staff: [] };
IL.restockStaff(stSave, IL.mulberry32(21));
check("the staff market offers three, each 1 to 5 stars with a role", stSave.staffMarket.length === 3 && stSave.staffMarket.every(function (r) { return r.stars >= 1 && r.stars <= 5 && IL.STAFF_ROLES[r.role] && r.cost > 0; }));
check("the staff market keeps its faces within a week", !IL.restockStaff(stSave, IL.mulberry32(22)));
stSave.staffMarket = [{ id: "a", role: "medic", stars: 3, name: "A", cost: 100 }, { id: "b", role: "trainer", stars: 2, name: "B", cost: 80 }, { id: "c", role: "medic", stars: 5, name: "C", cost: 300 }];
check("one slot to start: the first hire fits, a second role does not", IL.staffSlots(stSave) === 1 && IL.hireStaff(stSave, 0) && !IL.hireStaff(stSave, 0));
check("a better hire of the same role replaces the old one", IL.hireStaff(stSave, 1) && IL.staffStars(stSave, "medic") === 5 && stSave.staff.length === 1);
stSave.facilities.clubhouse = 2;
check("the Club House adds slots", IL.staffSlots(stSave) === 3);
check("a Medic cuts the injury chance", IL.injuryChance(stSave, { id: "m", injuryRisk: "high" }) < 0.2 - 0.04);
const coachF = IL.randomFighter(IL.mulberry32(31), "warrior"); coachF.id = "cap"; coachF.captain = true;
const coachFoe = IL.randomFighter(IL.mulberry32(32), "warrior");
const plainCap = IL.createMatch({ seed: 3, left: [coachF], right: [coachFoe], mode: "friendly" }).units[0];
const coachedCap = IL.createMatch({ seed: 3, left: [coachF], right: [coachFoe], mode: "friendly", captainBoost: 0.15 }).units[0];
check("a Captain Coach boosts the captain", coachedCap.maxHp > plainCap.maxHp * 1.1 && coachedCap.atk >= plainCap.atk);

/* v102 Chaos Thunder Cup. */
const thRoster = [0, 1, 2, 3].map(function (i) { const f = IL.randomFighter(IL.mulberry32(950 + i), ["warrior", "archer", "mage", "tank"][i]); f.id = "t" + i; f.level = 8; return f; });
const thSave = { clubName: "Thunder FC", season: 1, round: 3, renown: 20, roster: thRoster, lineup: ["t0", "t1", "t2"], clubs: [{ name: "Thunder FC", you: true }, { name: "Red Kettle" }, { name: "Salt Stair" }, { name: "Cinder Pact" }, { name: "North Wharf" }] };
check("no Thunder Cup before week 4", IL.openThunder(thSave, IL.mulberry32(1)) === null);
thSave.round = 4;
const th1 = IL.openThunder(thSave, IL.mulberry32(2));
check("the first Thunder Cup is 2v2v2v2 with four clubs", th1 && th1.size === 2 && th1.clubs.length === 4 && th1.clubs.slice(1).every(function (c) { return c.fighters.length === 2; }));
check("only one cup at a time", IL.openThunder(thSave, IL.mulberry32(3)) === null);
const thSides = IL.thunderSides(thSave);
const thM = runOut(IL.createMatch({ seed: 77, sides: thSides, mode: "thunder" }));
const thOrder = IL.placings(thM);
check("placings rank all four clubs, the winner first", thOrder.length === 4 && new Set(thOrder).size === 4 && thOrder[0] === thM.winner);
IL.scoreThunder(thSave, thOrder);
IL.scoreThunder(thSave, [0, 1, 2, 3]);
IL.scoreThunder(thSave, [0, 2, 1, 3]);
check("three rounds finish the cup and points add up", th1.done && th1.clubs.reduce(function (n, c) { return n + c.pts; }, 0) === 18 && th1.finish >= 1 && th1.finish <= 4);
thSave.round = 10;
const th2 = IL.openThunder(thSave, IL.mulberry32(4));
check("the second Thunder Cup after week 10 is 3v3v3v3", th2 && th2.size === 3);

/* v103 academy. */
const acRoster = [30, 28, 26, 4, 3, 2, 25].map(function (lv, i) { const f = IL.randomFighter(IL.mulberry32(970 + i), "warrior"); f.id = "a" + i; f.level = lv; f.xp = IL.xpFloor(lv); return f; });
acRoster[0].captain = true;
const acSave = { clubName: "Acad FC", season: 1, round: 2, roster: acRoster, lineup: ["a0", "a1", "a3"], clubs: [{ name: "Acad FC", you: true }, { name: "Red Kettle" }, { name: "Salt Stair" }, { name: "Cinder Pact" }, { name: "North Wharf" }, { name: "Glass Orchard" }] };
const acad = IL.ensureAcademy(acSave, IL.mulberry32(1));
check("the academy league has six clubs", acad.table.length === 6 && acad.table[0].you);
check("only level 20 or less, never the captain", !IL.setAcademy(acSave, "a1", true) && !IL.setAcademy(acSave, "a0", true) && IL.setAcademy(acSave, "a3", true));
check("an academy fighter can still play for the first team", acSave.lineup.indexOf("a3") >= 0);
IL.setAcademy(acSave, "a4", true); IL.setAcademy(acSave, "a5", true);
check("the academy fields its best three, once a week", IL.academySquad(acSave).length === 3 && IL.academyReady(acSave));
const acOpp = IL.academyOpponent(acSave, IL.mulberry32(2));
check("rival academies play at the squad's level", acOpp.fighters.length === 3 && acOpp.fighters.every(function (f) { return Math.abs(f.level - 3) <= 1; }));
IL.recordAcademy(acSave, acOpp.club, true, IL.mulberry32(3));
check("a win scores 3 and earns a tome, then the week is spent", acad.table[0].pts === 3 && acSave.devTomes === 1 && !IL.academyReady(acSave));
acSave.round = 3;
check("next week it is ready again", IL.academyReady(acSave));
const acBefore = acRoster[5].level;
const acTarget = IL.clubAverage(acSave);
check("a tome lifts a fighter to the club average", IL.useTome(acSave, acRoster[5]) && acRoster[5].level === acTarget && acRoster[5].level > acBefore && acRoster[5].pendingLevels > 0 && acSave.devTomes === 0);
acSave.devTomes = 5;
IL.useTome(acSave, acRoster[4]);
check("two tomes a season at most", !IL.useTome(acSave, acRoster[3]));

/* v105 ability costs and friendly fire. */
const rsF = IL.randomFighter(IL.mulberry32(990), "mage"); rsF.id = "rs"; rsF.level = 12;
const rsFoe = IL.randomFighter(IL.mulberry32(991), "warrior"); rsFoe.id = "rf2";
const rsM = IL.createMatch({ seed: 9, left: [rsF], right: [rsFoe], mode: "friendly" });
rsM.engage = 0;
const rsU = rsM.units[0];
IL.stepMatch(rsM, 1 / 60);
const flare = IL.abilityById("m-flare");
rsU.x = 300; rsU.y = 300; rsM.units[1].x = 420; rsM.units[1].y = 300; rsU.cool = 0;
rsU.mana = 100;
IL._fire(rsM, rsU, rsM.units[1], 120, flare, true);
check("a spell spends mana", rsU.mana < 100 && rsU.mana > 50);
rsU.mana = 2; rsU.cds = {};
check("without the mana a spell waits", !IL._ready(rsU, flare) && (rsU.mana = 100, IL._ready(rsU, flare)));
function ffMatch(ff) {
  const a = IL.randomFighter(IL.mulberry32(992), "mage"); a.id = "ffm"; a.level = 15; a.ai = { ff: ff };
  const b = IL.randomFighter(IL.mulberry32(993), "warrior"); b.id = "ffa"; b.level = 15;
  const e1 = IL.randomFighter(IL.mulberry32(994), "warrior"); e1.id = "ffe";
  const m = IL.createMatch({ seed: 11, left: [a, b], right: [e1], mode: "friendly" });
  m.engage = 0;
  const u = m.units[0], ally = m.units[1], foe = m.units[2];
  u.x = 200; u.y = 300; ally.x = 400; ally.y = 300; foe.x = 410; foe.y = 310; u.cool = 0; u.mana = 100;
  return { m: m, u: u, ally: ally, foe: foe };
}
const ffA = ffMatch("avoid");
check("Avoid holds a blast with an ally in it", IL._fire(ffA.m, ffA.u, ffA.foe, 210, flare) === "skip");
const ffN = ffMatch("natural");
check("Natural fires anyway", IL._fire(ffN.m, ffN.u, ffN.foe, 210, flare) === "go");
for (let k = 0; k < 200 && ffN.ally.hp === ffN.ally.maxHp; k++) IL.stepMatch(ffN.m, 1 / 60);
check("an ally in your own blast gets hurt", ffN.ally.hp < ffN.ally.maxHp && (ffN.u.ffDealt || 0) > 0);
const ffK = ffMatch("natural");
ffK.ally.hp = ffK.ally.maxHp;
IL._deal(ffK.m, ffK.u, ffK.ally, 999999, { dot: true, friendly: true, nonLethal: true });
check("friendly fire never kills from above half health", ffK.ally.hp >= 1);
ffK.ally.hp = 5; ffK.ally.iframe = 0;
const killsBefore = ffK.m.kills[0] || 0;
IL._deal(ffK.m, ffK.u, ffK.ally, 999999, { dot: true, friendly: true });
check("a friendly kill credits nobody", ffK.ally.hp <= 0 && (ffK.m.kills[0] || 0) === killsBefore);

/* v106 named rivals and smarter clubs. */
const nmSave = { clubName: "N FC", season: 1, division: 0, roster: [] };
const nmTeams = IL.eligibleNamed(nmSave);
check("named teams enter by division and season", nmTeams.length >= 2 && nmTeams.every(function (t) { return t.minDiv === 0 && t.minSeason === 1; }) && IL.eligibleNamed({ season: 4, division: 4 }).length === IL.NAMED_TEAMS.length);
const hook = IL.namedTeam("The Hooked Chain");
const hookF = IL.namedFighters(nmSave, hook, IL.mulberry32(5), function () { return 6; });
check("a named team has four, led by its leader", hookF.length === 4 && hookF[0].name === "Grend the Hook" && hookF[0].champion && hookF[0].captain && hookF[0].level >= 6 && hookF[0].relic === "aegis");
check("named fighters carry the team's signature move", hookF[0].loadout.indexOf("t-haul") >= 0 && hookF[1].loadout.indexOf("x-lancer-hook") >= 0 && hookF[0].ai.target === "back");
const tiredClub = { fighters: hookF.map(function (f, i) { f.id = "nm" + i; return f; }) };
tiredClub.fighters[1].stamina = 20;
const picked3 = IL.rivalPick(tiredClub, 3);
check("a rival rests its tired fighter", picked3.length === 3 && picked3.indexOf(tiredClub.fighters[1]) < 0 && picked3[0].leader);
IL.rivalTire(tiredClub, picked3);
check("a rival's starters tire and the bench rests", picked3.every(function (f) { return f.stamina === 80; }) && tiredClub.fighters[1].stamina === 54);
const relClub = { fighters: [0, 1, 2, 3].map(function (i) { return { id: "rr" + i }; }) };
IL.dressRivalRelics(relClub, IL.mulberry32(6), 4);
check("top-division rivals wear relics", relClub.equipped.length === 2 && relClub.fighters.some(function (f) { return f.relic; }));
const prepSave = { division: 0, recentRoles: [["cast", "kite", "melee"], ["cast", "support", "tank"], ["kite", "cast", "melee"]] };
check("a named team counters a back-line-heavy club", IL.rivalPrep(prepSave, { named: true }).ai.target === "back" && IL.rivalPrep(prepSave, { named: false }) === null);
prepSave.recentRoles = [["melee", "tank", "melee"], ["melee", "melee", "tank"]];
check("and spreads out against a melee club", IL.rivalPrep(Object.assign({}, prepSave, { division: 2 }), {}).formation === "spread");
const fmA = IL.randomFighter(IL.mulberry32(1), "warrior"), fmB = IL.randomFighter(IL.mulberry32(2), "warrior");
const fmM = IL.createMatch({ seed: 1, left: [fmA], right: [fmB], mode: "friendly", foeFormation: "spear" });
const fmD = IL.createMatch({ seed: 1, left: [fmA], right: [fmB], mode: "friendly" });
check("a rival's formation mirrors on its side", fmM.units[1].x < fmD.units[1].x - 40);

/* v107 difficulty. */
check("difficulty defaults to Normal", IL.difficultyOf({}) === "normal" && IL.foeMulOf({}) === 1 && IL.difficultyOf({ settings: { difficulty: "bogus" } }) === "normal");
check("Infernus threat climbs 4% a season to +60%", IL.foeMulOf({ season: 1, settings: { difficulty: "infernus" } }) === 1.2 && IL.foeMulOf({ season: 6, settings: { difficulty: "infernus" } }) === 1.44 && IL.foeMulOf({ season: 40, settings: { difficulty: "infernus" } }) === 1.92);
const dfA = IL.randomFighter(IL.mulberry32(41), "warrior"), dfB = IL.randomFighter(IL.mulberry32(42), "warrior");
dfA.captain = true;
const dfN = IL.createMatch({ seed: 4, left: [dfA], right: [dfB], mode: "friendly" });
const dfH = IL.createMatch({ seed: 4, left: [dfA], right: [dfB], mode: "friendly", foeMul: 1.12, capBonus: 0.15 });
check("Hard makes rivals tougher and Relaxed's captain bonus lands", Math.abs(dfH.units[1].maxHp / dfN.units[1].maxHp - 1.12) < 0.02 && dfH.units[0].maxHp > dfN.units[0].maxHp * 1.1);

/* v108 transfers. */
const trRoster = [0, 1, 2].map(function (i) { const f = IL.randomFighter(IL.mulberry32(1100 + i), "warrior"); f.id = "y" + i; f.level = 6; return f; });
trRoster[0].captain = true;
const trClubF = [0, 1, 2, 3].map(function (i) { const f = IL.randomFighter(IL.mulberry32(1200 + i), "archer"); f.id = "z" + i; f.level = 6 - (i === 3 ? 3 : 0); return f; });
trClubF[0].leader = true;
const trSave = { clubName: "T FC", season: 1, round: 0, renown: 0, gold: 5000, roster: trRoster, lineup: ["y0", "y1", "y2"], facilities: {}, clubs: [{ id: "you", you: true, name: "T FC" }, { id: "c1", name: "Red Kettle", fighters: trClubF }] };
check("leaders are not for sale", IL.askingPrice(trClubF[0]) === 0 && !IL.buyFromRival(trSave, "c1", "z0", IL.mulberry32(1)));
const trAsk = IL.askingPrice(trClubF[1]);
check("buying a rival's fighter costs 25% over value and they refill to four", IL.buyFromRival(trSave, "c1", "z1", IL.mulberry32(2)) === trAsk && trSave.gold === 5000 - trAsk && trSave.roster.some(function (f) { return f.id === "z1"; }) && trSave.clubs[1].fighters.length === 4);
const trBench = IL.rivalBench(trSave.clubs[1]);
check("only a rival's bench can be loaned, for two weeks", trBench.length === 1 && IL.loanIn(trSave, "c1", trBench[0].id) > 0 && trBench[0].loan.weeks === 2);
const trGold = trSave.gold;
const trSwap = IL.swapWithRival(trSave, "c1", trSave.clubs[1].fighters[1].id, "y2", IL.mulberry32(3));
check("a swap trades fighters plus a top-up", trSwap && trSave.clubs[1].fighters.some(function (f) { return f.id === "y2"; }) && trSave.gold === trGold - trSwap.top && trSave.lineup.indexOf("y2") < 0);
check("the captain cannot be swapped or loaned out", !IL.swapWithRival(trSave, "c1", trSave.clubs[1].fighters[2].id, "y0", IL.mulberry32(4)) && !IL.loanOut(trSave, "y0", IL.mulberry32(5)));
const trOut = IL.loanOut(trSave, "z1", IL.mulberry32(6));
check("a loan out pays a fee and takes the fighter away", trOut && trOut.fee > 0 && !trSave.roster.some(function (f) { return f.id === "z1"; }) && trSave.loansOut.length === 1);
const trXp = trSave.loansOut[0].fighter.xp || 0;
IL.tickLoans(trSave); IL.tickLoans(trSave);
check("after two weeks loans end both ways", trSave.roster.some(function (f) { return f.id === "z1"; }) && !trSave.roster.some(function (f) { return f.id === trBench[0].id; }) && trSave.clubs[1].fighters.some(function (f) { return f.id === trBench[0].id && !f.loan; }) && (trSave.roster.filter(function (f) { return f.id === "z1"; })[0].xp || 0) > trXp);

/* v109 personalities and deeper tactics. */
const psSeen = {};
for (let i = 0; i < 300; i++) psSeen[IL.randomFighter(IL.mulberry32(1300 + i), "warrior").personality] = true;
check("recruits roll all eleven personalities, never the old three", IL.PERSONA_ROLL.every(function (p) { return psSeen[p]; }) && !psSeen.bold && !psSeen.wary && !psSeen.patient && IL.PERSONA_ROLL.length === 11);
check("an unset behavior uses the personality's defaults", IL.aiFor({ personality: "hunter" }).target === "weak" && IL.aiFor({ personality: "hunter", ai: IL.normAi({ target: "back" }) }).target === "back");
function psUnit(persona) {
  const f = IL.randomFighter(IL.mulberry32(77), "warrior"); f.id = "ps"; f.personality = persona; f.level = 10;
  const e = IL.randomFighter(IL.mulberry32(78), "warrior"); e.id = "pe";
  return IL.createMatch({ seed: 2, left: [f], right: [e], mode: "friendly" }).units[0];
}
const psBold = psUnit("bold"), psRk = psUnit("reckless"), psSt = psUnit("stoic");
check("personalities change stats: Reckless hits harder, Stoic is firmer", psRk.atk > psBold.atk && psRk.def < psBold.def && psSt.def === psBold.def + 2);
const hpM = (function () {
  const make = function (c, i) { const f = IL.randomFighter(IL.mulberry32(1400 + i), c); f.id = "h" + i; f.level = 10; return f; };
  const healer = make("healer", 0); healer.ai = IL.normAi({ heal: "front" });
  const m = IL.createMatch({ seed: 3, left: [healer, make("tank", 1), make("archer", 2)], right: [make("warrior", 3)], mode: "friendly" });
  m.units[1].hp = m.units[1].maxHp * 0.6; m.units[2].hp = m.units[2].maxHp * 0.5;
  return m;
})();
check("Front line healing picks the tank over a lower archer", (function () {
  const healer = hpM.units[0];
  healer.x = 300; healer.y = 300; healer.cool = 0; healer.mana = 100; healer.cds = {};
  const before = hpM.units[1].hp;
  IL._fire(hpM, healer, hpM.units[3], 300, IL.abilityById("h-salve"), true);
  return hpM.units[1].hp > before;
})());
const opM = (function (open) {
  const f = IL.randomFighter(IL.mulberry32(91), "warrior"); f.id = "op"; f.ai = IL.normAi({ open: open }); f.personality = "bold";
  const e = IL.randomFighter(IL.mulberry32(92), "warrior"); e.id = "oe"; e.personality = "bold";
  const m = IL.createMatch({ seed: 4, left: [f], right: [e], mode: "friendly" });
  m.engage = 0;
  const x0 = m.units[0].x;
  for (let k = 0; k < 60; k++) { IL.stepMatch(m, 1 / 60); m.events.length = 0; }
  return m.units[0].x - x0;
});
check("Hold 2s keeps the start line; Rush gets there first", Math.abs(opM("hold")) < 10 && opM("rush") > opM("go"));

/* v110 milestones, respec, rebirth. */
const msF = IL.randomFighter(IL.mulberry32(1500), "warrior"); IL.ensureMoves(msF); msF.level = 13;
check("no ability upgrade before level 14", IL.upgradesPending(msF) === 0);
msF.level = 30;
check("level 30 holds four upgrades and one later mastery", IL.upgradesPending(msF) === 4 && IL.masteriesPending(msF) === 1);
const msMove = msF.loadout[0];
check("an upgrade ranks a move up", IL.upgradeMove(msF, msMove) && IL.rankOf(msF, msMove) === 2 && IL.upgradesPending(msF) === 3);
const msBase = IL.scaledStats(msF, IL.CLASSES.warrior).hp;
check("a later mastery stacks stats", IL.addMastery(msF, "grit") && IL.scaledStats(msF, IL.CLASSES.warrior).hp > msBase && IL.masteriesPending(msF) === 0);
msF.specs = { cleave: { mod: "heavy", tier: 1 } }; msF.talents = [{ id: "keen", tier: 0 }];
check("respec clears upgrades and offers that many picks", IL.startRespec(msF) === 2 && !Object.keys(msF.specs).length && !msF.talents.length && IL.respecOffer(msF).length >= 1);
IL.applyRespecPick(msF, 0); IL.applyRespecPick(msF, 0);
check("respec picks rebuild until none are left", msF.respecPicks === 0 && IL.respecCount(msF) + 0 >= 1);
const rbSave = { renown: 1000 };
const rbF = { rarity: "legendary", grades: { hp: "B", atk: "B", def: "B", spd: "B" } };
check("rebirth re-rolls growth grades for renown, dearer each time", IL.rebirth(rbSave, rbF, IL.mulberry32(9)) && rbSave.renown === 850 && IL.rebirthCost(rbF) === 225);
const evS = IL.randomFighter(IL.mulberry32(1501), "warrior"); evS.level = 20;
evS.evoSkips = 1;
check("a skipped evolution is gone for good", IL.evoPicks(evS) === 0);
const rvM = IL.randomFighter(IL.mulberry32(1502), "warrior");
IL.growRival(rvM, IL.mulberry32(1503), 40);
check("rivals claim their milestones", IL.upgradesPending(rvM) === 0 && IL.masteriesPending(rvM) === 0 && (rvM.masteries || []).length === 2);

/* v111 new classes and champion moves. */
check("three new classes with a full kit and a real passive", ["templar", "frostknight", "witchhunter"].every(function (c) {
  const k = IL.CLASSES[c];
  return k && k.abilities.length === 14 && k.passive && k.passive.fx && /\d/.test(k.passive.blurb) && k.renown > 0 && IL.CHAMPIONS.some(function (ch) { return ch.cls === c; });
}));
check("every champion has its own move", IL.CHAMPIONS.every(function (c) { const ab = IL.championMove({ champion: true, name: c.name }); return ab && ab.id.indexOf("ch-") === 0 && IL.abilityById(ab.id); }));
const chF = IL.randomFighter(IL.mulberry32(1600), "warrior"); chF.champion = true; chF.name = "Old Marrow"; chF.id = "chm";
const chU = IL.createMatch({ seed: 5, left: [chF], right: [IL.randomFighter(IL.mulberry32(1601), "warrior")], mode: "friendly" }).units[0];
check("a champion fights with its move at rank 4", IL.pilotAbs(chU).some(function (ab) { return ab.id === "ch-old-marrow"; }) && chU.ranks["ch-old-marrow"] === 4 && !(chF.ranks && chF.ranks["ch-old-marrow"]));

/* v113 new modes. */
thSave.thunder = null;
thSave.round = 10;
thSave.thunderDone = { season: thSave.season, slots: [0] };
const thA = IL.openThunder(thSave, IL.mulberry32(31));
const alS = IL.allianceSides(thSave);
check("the second Thunder Cup plays alliance rounds", thA.format === "alliance" && alS && alS.left.length === 6 && alS.right.length === 6 && IL.thunderSides(thSave) === null);
IL.scoreAlliance(thSave, true);
check("the winning pair scores 2 each", thA.clubs[0].pts === 2 && thA.clubs[1].pts === 2 && thA.clubs[2].pts === 0);
IL.scoreAlliance(thSave, false); IL.scoreAlliance(thSave, true);
check("three alliance rounds finish the cup", thA.done && thA.finish >= 1);
const hlSave = { season: 1, division: 0, roster: [{ level: 10 }, { level: 10 }, { level: 10 }, { level: 10 }, { level: 10 }] };
const hlF = IL.hallFoes(hlSave, "wardens", 2, IL.mulberry32(5));
check("Hall foes are four, above the club and stronger", hlF.length === 4 && hlF.every(function (f) { return f.level === 18 && f.hallMul > 1.6; }));
check("a Hall threat pays in full only the first time", IL.hallPay(hlSave, "wardens", 2).first && !IL.hallPay(hlSave, "wardens", 2).first);
const tnSave = { season: 1, round: 0, roster: [] };
const tn0 = IL.tourneyNow(tnSave).def.id; tnSave.round = 4; const tn1 = IL.tourneyNow(tnSave).def.id;
check("the Tournament Center turns over every four weeks", tn0 !== tn1);
tnSave.round = 0;
const tnDef = IL.tourneyNow(tnSave).def;
check("tournament entry follows the event's rule", tnDef.maxLevel ? IL.tourneyEligible(tnSave, { cls: "warrior", level: 5 }) && !IL.tourneyEligible(tnSave, { cls: "warrior", level: 40 }) : IL.tourneyEligible(tnSave, { cls: Object.keys(IL.CLASSES).filter(function (c) { return tnDef.roles.indexOf(IL.CLASSES[c].role) >= 0; })[0], level: 5 }));
const twSave = {};
const tw0 = IL.towerOf(twSave).rating;
const twW = IL.towerResult(twSave, true);
check("a Tower win climbs a floor and lifts the rating", IL.towerOf(twSave).floor === 2 && IL.towerOf(twSave).rating > tw0 && twW.newBest);
IL.towerResult(twSave, false);
check("a Tower loss costs rating, not the floor", IL.towerOf(twSave).floor === 2 && IL.towerOf(twSave).losses === 1);
check("Tower teams are fixed per floor, at level 30", JSON.stringify(IL.towerFoes(5).map(function (f) { return f.cls; })) === JSON.stringify(IL.towerFoes(5).map(function (f) { return f.cls; })) && IL.towerFoes(5).every(function (f) { return f.level === 30; }));
const asF = { id: "as1", cls: "warrior", level: 10, allStars: 2 };
check("All-Star appearances add market value", IL.marketValue(asF) === IL.marketValue(Object.assign({}, asF, { allStars: 0 })) + 200);

if (fails) {
  console.error(fails, "failed");
  process.exit(1);
}
const weaponCheck = require("child_process").spawnSync("python3", [path.join(__dirname, "weapon_check.py")], { stdio: "inherit" });
if (weaponCheck.status !== 0) process.exit(weaponCheck.status || 1);
console.log("sim passed");
