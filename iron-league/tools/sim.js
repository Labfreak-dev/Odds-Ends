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
  if (list.length < 6 || list.length > 8) {
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
check("longbow gear wins", IL.weaponKind({ cls: "warrior", gear: { weapon: { key: "longbow" } } }) === "bow");
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
check("relic stall is limited", relicStall.length === 4 && relicStall.every(function (row) { return row.stock === 1 && IL.relicById(row.id) && IL.relicSellPrice(row.id) < row.cost; }));
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
check("two wall pieces wake the set", wallPack.sets.length === 1 && wallPack.sets[0].kind === "def" && wallPack.worn.ada && wallPack.worn.ada.scope === "fighter");
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
const plain = runOut(IL.createMatch({ seed: 77, left: squadOf(1, comp3), right: squadOf(2, comp3) }));
const dflt = runOut(IL.createMatch({ seed: 77, left: squadOf(1, comp3, function (f) { f.ai = IL.normAi({}); }), right: squadOf(2, comp3) }));
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
check("rivals match the club level", [0, 1, 2, 3, 4].every(function (i) { return Math.abs(IL.rivalLevel(lvlSave, i) - 11) <= 1; }));
check("the division floor holds rivals up", IL.rivalLevel({ division: 4, roster: [{ level: 3 }] }, 1) >= 16);
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

if (fails) {
  console.error(fails, "failed");
  process.exit(1);
}
const weaponCheck = require("child_process").spawnSync("python3", [path.join(__dirname, "weapon_check.py")], { stdio: "inherit" });
if (weaponCheck.status !== 0) process.exit(weaponCheck.status || 1);
console.log("sim passed");
