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
check("pit is wider than 960", IL.WORLD.w >= 1440 && IL.WORLD.right - IL.WORLD.left > 1200);
check("twenty four or more classes", Object.keys(IL.CLASSES).length >= 24);
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
  const extra = IL.poolOf("warrior").filter(function (ab) { return ab.unlock >= 99; })[0];
  const taught = extra && IL.teachMove(fighter, extra.id) && IL.equipMove(fighter, 0, extra.id) && fighter.loadout[0] === extra.id;
  check("teach and equip a tome move", !!taught);
  const foe = IL.randomFighter(function () { return 0.3; }, "mage");
  foe.level = 7;
  fighter.level = 7;
  const bout = IL.createMatch({ seed: 3, left: [fighter], right: [foe], leftName: "A", rightName: "B" });
  let steps = 0;
  while (!bout.over && steps < 4000) { IL.stepMatch(bout, 1 / 60); steps++; }
  check("loadout fight ends", bout.over === true);
})();
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
const grew = IL.growthFromXp(0, 80);
check("level 3 offers a pick", grew.level === 3 && grew.picks === 1);
check("level 2 offers none", IL.growthFromXp(0, 40).picks === 0);
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
check("achievement board has a range of goals", IL.achievementBoard(achSave).length >= 15 && IL.achievementBoard(achSave).length <= 25);
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
const thrustWind = IL.weapons.handAnchor("spear", "atk1", 0);
const thrustHit = IL.weapons.handAnchor("spear", "atk1", 2);
check("spear thrust reaches forward", thrustHit.x < thrustWind.x - 4);
check("cast raises the staff", IL.weapons.handAnchor("staff", "magic", 1).y < IL.weapons.handAnchor("staff", "idle1", 0).y - 6);
check("ko drops the weapon", IL.weapons.handAnchor("sword", "dead", 0).y > 38);
check("bow release steps forward", IL.weapons.handAnchor("bow", "bow", 2).x < IL.weapons.handAnchor("bow", "bow", 1).x);
check("lancer keeps a spear", IL.CLASS_WEAPON.lancer === "spear" && IL.weaponKind({ cls: "lancer" }) === "spear");
check("monk uses fists", IL.CLASS_WEAPON.monk === "fist");
check("necromancer keeps a scythe", IL.CLASS_WEAPON.necromancer === "scythe");
check("samurai keeps a katana", IL.CLASS_WEAPON.samurai === "katana");
check("axe chop uses the heavy row", IL.visualMotion("atk1", "tank", IL.defaultSheet("tank"), "axe") === "atk2");
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
check("weekly deals are three limited offers", deals.week === 3 && deals.offers.length === 3 && deals.offers.every(function (o) { return o.stock === 1; }));
check("legendary deal is discounted", dealFighter.kind === "fighter" && dealFighter.fighter.rarity === "legendary" && dealFighter.cost < fullLegendary);
check("deals include a bundle and a chest", deals.offers[1].kind === "bundle" && deals.offers[1].relics.length === 2 && deals.offers[2].kind === "chest");
check("week clock moves", IL.weekIndex(0) === 0 && IL.weekIndex(604800000) === 1 && IL.msUntilWeek(0) === 604800000);
check("events rotate each week", IL.EVENTS.length === 5 && IL.activeEvent(0).id !== IL.activeEvent(8 * 604800000).id);
const dayA = IL.dailySquad(40, 2);
const dayB = IL.dailySquad(40, 2);
check("daily squad is seeded", dayA.length === 2 && dayA[0].name === dayB[0].name && dayA[0].cls === dayB[0].cls && IL.dailySquad(41, 2)[0].name !== dayA[0].name);
const gauntlet = IL.startGauntlet(IL.mulberry32(5), 2, 3);
check("gauntlet is five fights", gauntlet.fights.length === 5 && gauntlet.fights[0].length === 2 && gauntlet.fights[4][0].level >= 3);
check("endless modifier every fifth wave", !IL.endlessMod(4) && IL.endlessMod(5).id === "glass" && IL.endlessMod(10).id === "haste");
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
IL.grantXp(pupil, 160);
check("level 5 opens a focus", pupil.level >= 5 && pupil.pendingFocus === true && IL.chooseFocus(pupil, "warden") && pupil.focus === "warden" && !pupil.pendingFocus);
IL.grantXp(pupil, 200);
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
IL.grantXp(f, 80);
check("grant queues a pick", f.level === 3 && f.pendingPicks === 1);
check("boost spends a pick", IL.applyBoost(f, "hp") && f.boosts.hp === 1 && f.pendingPicks === 0);

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
  while (!m.over && steps < 4000) {
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
  while (!m.over && steps < 4000) {
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
  while (!m.over && steps < 4000) {
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
      while (!m.over && steps < 4000) {
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
check("bad challenge code is empty", IL.importChallenge("nope") === null && IL.importChallenge("") === null);
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
const dupClub = IL.migrate({
  clubName: "Dup",
  roster: [
    { id: "a", cls: "warrior", name: "Quill Ash" },
    { id: "b", cls: "mage", name: "Quill Vale" },
    { id: "c", cls: "archer", name: "Rho Pike" }
  ]
});
check("duplicate first names gain a suffix", dupClub.roster[0].name.split(" ")[0] === "Quill" && dupClub.roster[1].name.split(" ")[0] !== "Quill" && dupClub.roster[2].name.split(" ")[0] === "Rho");
let galBroke = 0;
Object.keys(IL.CLASSES).forEach(function (id) {
  const basic = IL.showcase(id, "basic");
  const ult = IL.showcase(id, 2);
  if (!basic || !basic.units[0].banner) galBroke++;
  if (!ult || !ult.units[0].banner || !ult.cine) galBroke++;
});
check("every class can preview its moves", galBroke === 0);
check("the third starter is an ultimate", !!(IL.CLASSES.warrior.abilities.filter(function (ab) { return ab.unlock === 7; })[0] || {}).ult);

if (fails) {
  console.error(fails, "failed");
  process.exit(1);
}
console.log("sim passed");
