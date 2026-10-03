// Goals & achievements. Tracks counters on meta (glimmerdeep.v1) and opens a themed screen.
// Event hooks elsewhere are one line: window.AX && AX.ev(name, n, extra).
(function () {
'use strict';
if (typeof window === 'undefined') return;
const G = window.GD;
const $ = s => document.querySelector(s);

const ST0 = {
  v: 0, fights: 0, wins: 0, kills: 0, bosses: 0, rounds: 0, merges: 0, evos: 0, ascends: 0,
  runsWon: 0, runsLost: 0, bestRound: 0, wildsRuns: 0, wildsWins: 0, trainers: 0, floors: 0,
  secrets: 0, relics: 0, shinies: 0, shards: 0, streakBest: 0, streakCur: 0, tonics: 0, lairs: 0,
  den: 0, setCount: 0, fuses: 0, legends: 0, perfect: 0, speedClears: 0, keys: 0, hazardWins: 0,
};
const PAY = [20, 40, 80];

function dexN(m) {
  let n = 0;
  const d = m.dex || {};
  for (const k in d) if (G.SP[k] && d[k] >= 1) n++;
  return n;
}
function cardsN(m) {
  return Object.keys(m.trCards || {}).filter(c => c !== 'rival' && G.TRAINERS[c]).length;
}
const SPECIES_N = Object.keys(G.SP).length;

const ACH = [
  { id: 'first_blood', cat: 'fight', n: 'First Blood', d: 'Win a fight.', goal: 1, ic: '✨', get: m => m.st.wins, reward: { shards: 10 } },
  { id: 'win25', cat: 'fight', n: 'Warmed Up', d: 'Win 25 fights.', goal: 25, ic: '🥊', get: m => m.st.wins, reward: { shards: 20 } },
  { id: 'win100', cat: 'fight', n: 'Veteran Fights', d: 'Win 100 fights.', goal: 100, ic: '🏅', get: m => m.st.wins, reward: { shards: 60, cosm: 'title:veteran' } },
  { id: 'win500', cat: 'fight', n: 'Battleworn', d: 'Win 500 fights.', goal: 500, ic: '🏆', get: m => m.st.wins, reward: { shards: 200 } },
  { id: 'kills100', cat: 'fight', n: 'Hundred Down', d: 'Knock out 100 foes.', goal: 100, ic: '💥', get: m => m.st.kills, reward: { shards: 25 } },
  { id: 'kills1000', cat: 'fight', n: 'Thousand Down', d: 'Knock out 1,000 foes.', goal: 1000, ic: '🩸', get: m => m.st.kills, reward: { shards: 80, cosm: 'palette:crimson' } },
  { id: 'kills5000', cat: 'fight', n: 'Relentless', d: 'Knock out 5,000 foes.', goal: 5000, ic: '☠️', get: m => m.st.kills, reward: { shards: 250 } },
  { id: 'round10', cat: 'run', n: 'Into the Deep', d: 'Reach round 10 in a run.', goal: 10, ic: '🔟', get: m => m.st.bestRound, reward: { shards: 15 } },
  { id: 'round20', cat: 'run', n: 'Halfway', d: 'Reach round 20 in a run.', goal: 20, ic: '🧭', get: m => m.st.bestRound, reward: { shards: 30 } },
  { id: 'round30', cat: 'run', n: 'Core Clear', d: 'Win a run (clear round 30).', goal: 1, ic: '💎', get: m => m.st.runsWon, reward: { shards: 80 } },
  { id: 'depth1', cat: 'run', n: 'Deeper', d: 'Unlock Depth 1.', goal: 1, ic: '🌊', get: m => m.depthMax || 0, reward: { shards: 40 } },
  { id: 'depth5', cat: 'run', n: 'Depth Five', d: 'Unlock Depth 5.', goal: 5, ic: '🌊', get: m => m.depthMax || 0, reward: { shards: 100, cosm: ['theme:frost', 'frame:frame_02'] } },
  { id: 'depth10', cat: 'run', n: 'Depth Ten', d: 'Unlock Depth 10.', goal: 10, ic: '🌌', get: m => m.depthMax || 0, reward: { shards: 300, cosm: 'theme:starfield' } },
  { id: 'boss1', cat: 'fight', n: 'Boss Breaker', d: 'Win an elite or boss fight.', goal: 1, ic: '👑', get: m => m.st.bosses, reward: { shards: 15 } },
  { id: 'boss10', cat: 'fight', n: 'Boss Hunter', d: 'Win 10 elite or boss fights.', goal: 10, ic: '👑', get: m => m.st.bosses, reward: { shards: 40, cosm: 'theme:ember' } },
  { id: 'boss50', cat: 'fight', n: 'Slayer', d: 'Win 50 elite or boss fights.', goal: 50, ic: '🗡️', get: m => m.st.bosses, reward: { shards: 120, cosm: ['title:slayer', 'frame:frame_03'] } },
  { id: 'streak3', cat: 'fight', n: 'On a Roll', d: 'Win 3 fights in a row.', goal: 3, ic: '🔥', get: m => m.st.streakBest, reward: { shards: 15 } },
  { id: 'streak7', cat: 'fight', n: 'Hot Streak', d: 'Win 7 fights in a row.', goal: 7, ic: '🔥', get: m => m.st.streakBest, reward: { shards: 40 } },
  { id: 'streak12', cat: 'fight', n: 'Unbroken', d: 'Win 12 fights in a row.', goal: 12, ic: '🌟', get: m => m.st.streakBest, reward: { shards: 80, cosm: ['palette:emberglow', 'frame:frame_06'] } },
  { id: 'run1', cat: 'run', n: 'Champion', d: 'Win a run.', goal: 1, ic: '🎉', get: m => m.st.runsWon, reward: { shards: 40 } },
  { id: 'run10', cat: 'run', n: 'Ten Clears', d: 'Win 10 runs.', goal: 10, ic: '🎉', get: m => m.st.runsWon, reward: { shards: 40, cosm: ['palette:sunset', 'frame:frame_01'] } },
  { id: 'run25', cat: 'run', n: 'Seasoned', d: 'Win 25 runs.', goal: 25, ic: '📜', get: m => m.st.runsWon, reward: { shards: 80 } },
  { id: 'run50', cat: 'run', n: 'Legend of the Core', d: 'Win 50 runs.', goal: 50, ic: '🏯', get: m => m.st.runsWon, reward: { shards: 150 } },
  { id: 'merge10', cat: 'run', n: 'First Merges', d: 'Merge creatures 10 times.', goal: 10, ic: '🔗', get: m => m.st.merges, reward: { shards: 15 } },
  { id: 'merge50', cat: 'run', n: 'Merger', d: 'Merge creatures 50 times.', goal: 50, ic: '🔗', get: m => m.st.merges, reward: { shards: 40 } },
  { id: 'merge250', cat: 'run', n: 'Fusion Habit', d: 'Merge creatures 250 times.', goal: 250, ic: '🧪', get: m => m.st.merges, reward: { shards: 100, cosm: 'palette:mint' } },
  { id: 'evo10', cat: 'run', n: 'Evolving', d: 'Evolve creatures 10 times.', goal: 10, ic: '🌱', get: m => m.st.evos, reward: { shards: 20 } },
  { id: 'evo50', cat: 'run', n: 'Evolver', d: 'Evolve creatures 50 times.', goal: 50, ic: '🌿', get: m => m.st.evos, reward: { shards: 60, cosm: 'title:evolver' } },
  { id: 'ascend1', cat: 'run', n: 'Ascended', d: 'Ascend a creature to ★4.', goal: 1, ic: '◆', get: m => m.st.ascends, reward: { shards: 30 } },
  { id: 'ascend5', cat: 'run', n: 'Apex Path', d: 'Ascend 5 creatures.', goal: 5, ic: '◆', get: m => m.st.ascends, reward: { shards: 80 } },
  { id: 'ascend15', cat: 'run', n: 'Apex Garden', d: 'Ascend 15 creatures.', goal: 15, ic: '◆', get: m => m.st.ascends, reward: { shards: 200, cosm: 'theme:aurora' } },
  { id: 'dex25', cat: 'collection', n: 'Field Notes', d: 'See 25 species.', goal: 25, ic: '📖', get: dexN, reward: { shards: 20 } },
  { id: 'dex50', cat: 'collection', n: 'Half the Book', d: 'See 50 species.', goal: 50, ic: '📖', get: dexN, reward: { shards: 40 } },
  { id: 'dex100', cat: 'collection', n: 'Scholar', d: 'See 100 species.', goal: 100, ic: '📚', get: dexN, reward: { shards: 80, cosm: 'frame:frame_04' } },
  { id: 'dex150', cat: 'collection', n: 'Archivist', d: 'See 150 species.', goal: 150, ic: '📚', get: dexN, reward: { shards: 120 } },
  { id: 'dex172', cat: 'collection', n: 'Glim Master', d: 'See every species.', goal: SPECIES_N, ic: '📕', get: dexN, reward: { shards: 200, cosm: ['title:glim_master', 'frame:frame_05'] } },
  { id: 'apex5', cat: 'collection', n: 'Apex Sighted', d: 'See 5 Apex forms.', goal: 5, ic: '👁️', get: m => Object.keys(m.apexSeen || {}).length, reward: { shards: 40 } },
  { id: 'shiny1', cat: 'collection', n: 'Sparkle', d: 'Catch a shiny.', goal: 1, ic: '✦', get: m => m.st.shinies, reward: { shards: 20 } },
  { id: 'shiny5', cat: 'collection', n: 'Shiny Case', d: 'Catch 5 shinies.', goal: 5, ic: '✦', get: m => m.st.shinies, reward: { shards: 50, cosm: 'palette:duskrose' } },
  { id: 'shiny20', cat: 'collection', n: 'Shiny Hunter', d: 'Catch 20 shinies.', goal: 20, ic: '✦', get: m => m.st.shinies, reward: { shards: 120, cosm: 'title:shiny_hunter' } },
  { id: 'relic10', cat: 'collection', n: 'Relic Finder', d: 'Find 10 relics.', goal: 10, ic: '🔮', get: m => m.st.relics, reward: { shards: 20 } },
  { id: 'relic50', cat: 'collection', n: 'Relic Collector', d: 'Find 50 relics.', goal: 50, ic: '🔮', get: m => m.st.relics, reward: { shards: 50 } },
  { id: 'relic150', cat: 'collection', n: 'Relic Hoarder', d: 'Find 150 relics.', goal: 150, ic: '🏦', get: m => m.st.relics, reward: { shards: 100, cosm: 'title:hoarder' } },
  { id: 'set1', cat: 'collection', n: 'Set Complete', d: 'Complete a relic tag set.', goal: 1, ic: '🧩', get: m => m.st.setCount, reward: { shards: 30 } },
  { id: 'fuse1', cat: 'collection', n: 'Forged', d: 'Forge a legendary relic.', goal: 1, ic: '⚒️', get: m => m.st.fuses, reward: { shards: 40 } },
  { id: 'legend3', cat: 'collection', n: 'Three Legends', d: 'Forge 3 legendary relics.', goal: 3, ic: '⚒️', get: m => m.st.legends, reward: { shards: 80 } },
  { id: 'wild1', cat: 'wilds', n: 'First Expedition', d: 'Start an expedition in the Wilds.', goal: 1, ic: '🥾', get: m => m.st.wildsRuns, reward: { shards: 15 } },
  { id: 'wild10', cat: 'wilds', n: 'Trail Regular', d: 'Start 10 expeditions.', goal: 10, ic: '🥾', get: m => m.st.wildsRuns, reward: { shards: 40, cosm: 'palette:vine' } },
  { id: 'floors25', cat: 'wilds', n: 'Floor by Floor', d: 'Enter 25 Wilds floors.', goal: 25, ic: '🪜', get: m => m.st.floors, reward: { shards: 40 } },
  { id: 'trainer10', cat: 'wilds', n: 'Trainer Route', d: 'Beat 10 trainers.', goal: 10, ic: '🎓', get: m => m.st.trainers, reward: { shards: 30 } },
  { id: 'trainer50', cat: 'wilds', n: 'Ace Route', d: 'Beat 50 trainers.', goal: 50, ic: '🎓', get: m => m.st.trainers, reward: { shards: 100 } },
  { id: 'rival3', cat: 'wilds', n: 'Rival Beater', d: 'Earn all 3 Rival Badges.', goal: 3, ic: '🥊', get: m => m.badges || 0, reward: { shards: 60, cosm: 'title:rival_beater' } },
  { id: 'den1', cat: 'wilds', n: 'Den Champion', d: 'Clear the Rival\'s Den.', goal: 1, ic: '🏚️', get: m => (m.den ? 1 : (m.st && m.st.den) || 0), reward: { shards: 80, cosm: 'title:den_champ' } },
  { id: 'lair25', cat: 'wilds', n: 'Lair Breaker', d: 'Clear 25 lairs.', goal: 25, ic: '🐉', get: m => m.st.lairs, reward: { shards: 50 } },
  { id: 'secret1', cat: 'wilds', n: 'Cracked Wall', d: 'Find a secret room.', goal: 1, ic: '🚪', get: m => m.st.secrets, reward: { shards: 20 } },
  { id: 'secret10', cat: 'wilds', n: 'Wall Whisperer', d: 'Find 10 secret rooms.', goal: 10, ic: '🤫', get: m => m.st.secrets, reward: { shards: 60, cosm: 'title:wall_whisperer' } },
  { id: 'tonic10', cat: 'wilds', n: 'Well Supplied', d: 'Use 10 Glim Tonics.', goal: 10, ic: '🧪', get: m => m.st.tonics, reward: { shards: 25 } },
  { id: 'shards1000', cat: 'meta', n: 'Shard Pouch', d: 'Earn 1,000 Glimmer Shards in total.', goal: 1000, ic: '💠', get: m => m.st.shards, reward: { shards: 20 } },
  { id: 'shards10000', cat: 'meta', n: 'Shard Vault', d: 'Earn 10,000 Glimmer Shards in total.', goal: 10000, ic: '💠', get: m => m.st.shards, reward: { shards: 100 } },
  { id: 'perfect', cat: 'run', n: 'Perfect Run', d: 'Win a run without losing a fight.', goal: 1, ic: '💯', get: m => m.st.perfect, reward: { shards: 150 } },
  { id: 'cards6', cat: 'wilds', n: 'Full Card Case', d: 'Collect all six trainer cards.', goal: 6, ic: '🃏', get: cardsN, reward: { shards: 40 } },
  { id: 'daily1', cat: 'meta', n: 'Daily Done', d: 'Finish a day of daily goals.', goal: 1, ic: '📅', get: m => (m.daily && m.daily.stamps) || 0, reward: { shards: 15 } },
  { id: 'daily7', cat: 'meta', n: 'Week Streak', d: 'Finish daily goals 7 days in a row.', goal: 7, ic: '📅', get: m => (m.daily && m.daily.streak) || 0, reward: { shards: 70, cosm: 'theme:candy' } },
  { id: 'daily30', cat: 'meta', n: 'Daily Devotee', d: 'Collect 30 daily stamps.', goal: 30, ic: '🗓️', get: m => (m.daily && m.daily.stamps) || 0, reward: { shards: 200, cosm: 'title:devotee' } },
  { id: 'speed1', cat: 'run', n: 'Speedrunner', d: 'Win a run in under 20 minutes.', goal: 1, ic: '⏱️', get: m => m.st.speedClears, reward: { shards: 60 } },
  { id: 'keys10', cat: 'wilds', n: 'Key Master', d: 'Open 10 vault doors in the Wilds.', goal: 10, ic: '🗝️', get: m => m.st.keys, reward: { shards: 40 } },
  { id: 'hazard10', cat: 'fight', n: 'Hazard Survivor', d: 'Win 10 fights in a hazard biome without a hazard relic.', goal: 10, ic: '🛡️', get: m => m.st.hazardWins, reward: { shards: 40 } },
];
const ACH_BADGES = {
  first_blood: 'badges/badge_01', win25: 'badges/badge_01', win100: 'badges/badge_17', win500: 'badges/badge_24',
  kills100: 'badges/badge_17', kills1000: 'badges/badge_17', kills5000: 'badges/badge_24',
  round10: 'badges/badge_23', round20: 'badges/badge_23', round30: 'badges/badge_23',
  depth1: 'badges/badge_12', depth5: 'badges/badge_12', depth10: 'badges/badge_12',
  boss1: 'badges/badge_02', boss10: 'badges/badge_02', boss50: 'badges/badge_02',
  streak3: 'badges/badge_16', streak7: 'badges/badge_16', streak12: 'badges/badge_07',
  run1: 'badges/badge_01', run10: 'badges/badge_17', run25: 'badges/badge_24', run50: 'badges/badge_24',
  merge10: 'badges/badge_08', merge50: 'badges/badge_08', merge250: 'badges/badge_08',
  evo10: 'badges/badge_08', evo50: 'badges/badge_08',
  ascend1: 'badges/badge_09', ascend5: 'badges/badge_09', ascend15: 'badges/badge_09',
  dex25: 'badges/badge_03', dex50: 'badges/badge_03', dex100: 'badges/badge_03', dex150: 'badges/badge_11', dex172: 'badges/badge_24',
  apex5: 'badges/badge_09', shiny1: 'badges/badge_13', shiny5: 'badges/badge_13', shiny20: 'badges/badge_13',
  relic10: 'badges/badge_15', relic50: 'badges/badge_05', relic150: 'badges/badge_15',
  set1: 'badges/badge_11', fuse1: 'badges/badge_22', legend3: 'badges/badge_22',
  wild1: 'badges/badge_04', wild10: 'badges/badge_04', floors25: 'badges/badge_04',
  trainer10: 'badges/badge_17', trainer50: 'badges/badge_17', rival3: 'badges/badge_17',
  den1: 'badges/badge_23', lair25: 'badges/badge_02', secret1: 'badges/badge_10', secret10: 'badges/badge_10',
  tonic10: 'badges/badge_18', shards1000: 'badges/badge_14', shards10000: 'badges/badge_14',
  perfect: 'badges/badge_07', cards6: 'badges/badge_03', daily1: 'badges/badge_19', daily7: 'badges/badge_19', daily30: 'badges/badge_24',
  speed1: 'badges/badge_06', keys10: 'badges/badge_20', hazard10: 'badges/badge_21'
};
// Shown only when the badge metal is not the achievement's difficulty.
const ACH_CHIP = {
  kills100: 'I', round10: 'I', round20: 'II', depth1: 'I', depth10: 'III', boss1: 'I', boss50: 'III',
  streak3: 'I', merge10: 'I', merge50: 'II', evo10: 'I', ascend1: 'II', dex50: 'II', dex100: 'III',
  shiny5: 'II', shiny20: 'III', relic150: 'III', set1: 'II', legend3: 'III', wild1: 'I',
  trainer10: 'I', rival3: 'III', secret1: 'I', shards10000: 'III', cards6: 'II', daily7: 'II'
};
for (const a of ACH) {
  if (ACH_BADGES[a.id]) a.badge = ACH_BADGES[a.id];
  if (ACH_CHIP[a.id]) a.chip = ACH_CHIP[a.id];
  if (!(a.badge && window.GD_ICON_MANIFEST && GD_ICON_MANIFEST[a.badge])) window.gdIcon && gdIcon('ach_' + a.id, a.ic);
}

const CATS = [['all', 'All'], ['fight', 'Fights'], ['run', 'Runs'], ['collection', 'Collection'], ['wilds', 'Wilds'], ['meta', 'Misc']];
const TEMPLATES = [
  { id: 'win', tiers: [5, 10, 20], n: 'Win fights', text: g => 'Win ' + g + ' fights' },
  { id: 'ko', tiers: [30, 80, 150], n: 'Knock outs', text: g => 'Knock out ' + g + ' foes' },
  { id: 'merge', tiers: [2, 4, 7], n: 'Merges', text: g => 'Merge ' + g + ' times' },
  { id: 'round', tiers: [6, 10, 14], max: 1, n: 'Push a run', text: g => 'Reach round ' + g + ' in a run' },
  { id: 'boss', tiers: [1, 1, 2], n: 'Boss', text: g => 'Win ' + g + ' boss fight' + (g > 1 ? 's' : '') },
  { id: 'wfight', tiers: [2, 4, 6], n: 'Wild fights', text: g => 'Win ' + g + ' Wilds fights' },
  { id: 'trainer', tiers: [1, 1, 2], n: 'Trainers', text: g => 'Beat ' + g + ' trainer' + (g > 1 ? 's' : '') },
  { id: 'relic', tiers: [1, 1, 2], n: 'Relics', text: g => 'Find ' + g + ' relic' + (g > 1 ? 's' : '') },
  { id: 'element', tiers: [1, 1, 1], n: 'Element', text: (g, el) => 'Win a fight with a ' + ((G.EL[el] && G.EL[el].name) || el) + ' creature' },
  { id: 'clean', tiers: [1, 1, 1], n: 'Clean win', text: () => 'Win a fight without losing a creature' },
  { id: 'evo', tiers: [1, 2, 3], n: 'Evolve', text: g => 'Evolve ' + g + ' creature' + (g > 1 ? 's' : '') },
  { id: 'secret', tiers: [1, 1, 1], n: 'Secret', text: () => 'Find a secret room' },
  { id: 'tonic', tiers: [1, 2, 3], n: 'Tonic', text: g => 'Use ' + g + ' Glim Tonic' + (g > 1 ? 's' : '') },
  { id: 'ascend', tiers: [1, 1, 1], hardOnly: 1, n: 'Ascend', text: () => 'Ascend a creature' },
];
const TPL = {};
for (const t of TEMPLATES) TPL[t.id] = t;

let meta = null;
let tab = 'daily';
const queue = [];
let showing = false;
let burst = [];
let burstT = 0;
let saveT = 0;

function metaOf() { return meta || (window.GLIM && GLIM.meta) || null; }
function today() {
  try { return new Date().toLocaleDateString('en-CA'); } catch (e) { return '1970-01-01'; }
}
function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function prevDate(key) {
  const p = key.split('-');
  const d = new Date(+p[0], +p[1] - 1, +p[2], 12);
  d.setDate(d.getDate() - 1);
  const z = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate());
}
function hasApex(m) {
  const a = m.apex || {};
  for (const k in a) if (a[k] > 0) return true;
  return false;
}
function esc(s) { return window.GLIM && GLIM.esc ? GLIM.esc(s) : String(s); }

function rollDaily(arg, force) {
  let m = meta;
  if (arg && typeof arg === 'object') m = arg;
  else if (arg) force = arg;
  if (!m) return;
  const key = today();
  if (!force && m.daily && m.daily.date === key && m.daily.goals && m.daily.goals.length === 3) return;
  const rng = mulberry32(hash(key));
  const used = {};
  const goals = [];
  for (let tier = 0; tier < 3; tier++) {
    let choices = TEMPLATES.filter(t => !used[t.id]);
    if (tier < 2) choices = choices.filter(t => !t.hardOnly);
    if (tier === 2 && !hasApex(m)) choices = choices.filter(t => t.id !== 'ascend');
    if (!choices.length) choices = TEMPLATES.filter(t => !used[t.id]);
    const t = choices[Math.floor(rng() * choices.length)];
    used[t.id] = 1;
    const g = { id: t.id, g: t.tiers[tier], p: 0, done: 0, claimed: 0, tier: tier, pay: PAY[tier] };
    if (t.id === 'element') g.el = G.ELS[Math.floor(rng() * G.ELS.length)];
    goals.push(g);
  }
  const prev = m.daily || {};
  m.daily = { date: key, goals: goals, streak: prev.streak || 0, last: prev.last || '', stamps: prev.stamps || 0 };
}

function init(m) {
  meta = m || metaOf();
  if (!meta) return;
  meta.ach = meta.ach || {};
  meta.st = Object.assign({}, ST0, meta.st || {});
  if (!meta.st.v) {
    meta.st.runsWon = Math.max(meta.st.runsWon || 0, meta.wins || 0);
    if ((meta.wins || 0) > 0) meta.st.bestRound = Math.max(meta.st.bestRound || 0, 30);
    meta.st.wins = Math.max(meta.st.wins || 0, meta.wins || 0);
    meta.st.shinies = Math.max(meta.st.shinies || 0, Object.keys(meta.shinies || {}).length);
    meta.st.trainers = Math.max(meta.st.trainers || 0, Object.keys(meta.trCards || {}).length);
    meta.st.den = Math.max(meta.st.den || 0, meta.den ? 1 : 0);
    meta.st.shards = Math.max(meta.st.shards || 0, meta.shards || 0);
    meta.st.v = 1;
  }
  meta.cosm = meta.cosm || { own: {}, sel: { skin: meta.skin || 'classic', title: '', frame: '', theme: '' } };
  meta.cosm.own = meta.cosm.own || {};
  meta.cosm.sel = Object.assign({ skin: meta.skin || 'classic', title: '', frame: '', theme: '' }, meta.cosm.sel || {});
  if (!meta.daily || meta.daily.date !== today()) rollDaily(meta);
  check();
}

function noteSets() {
  const run = window.GLIM && GLIM.run;
  if (!run || !window.GC) return;
  const c = GC.relicTagCounts(run.relics);
  meta.st.sets = meta.st.sets || {};
  for (const t in c) if (c[t] >= 3 && G.SETS[t] && !meta.st.sets[t]) {
    meta.st.sets[t] = 1;
    meta.st.setCount = (meta.st.setCount || 0) + 1;
  }
}
function bumpGoals(name, n, ex) {
  const goals = (meta.daily && meta.daily.goals) || [];
  for (const g of goals) {
    if (g.done) continue;
    let add = 0, set = -1;
    if (g.id === 'win' && name === 'fight' && ex.win) add = 1;
    else if (g.id === 'ko' && (name === 'fight' || name === 'kos')) add = ex.kills || 0;
    else if (g.id === 'merge' && name === 'merge') add = n || 1;
    else if (g.id === 'round' && name === 'fight' && ex.round) set = ex.round;
    else if (g.id === 'boss' && name === 'fight' && ex.win && (ex.boss || ex.kind === 'boss')) add = 1;
    else if (g.id === 'wfight' && name === 'wildsFight') add = 1;
    else if (g.id === 'trainer' && name === 'trainer') add = 1;
    else if (g.id === 'relic' && name === 'relic') add = 1;
    else if (g.id === 'element' && name === 'fight' && ex.win && ex.els && ex.els.indexOf(g.el) >= 0) add = 1;
    else if (g.id === 'clean' && name === 'fight' && ex.clean) add = 1;
    else if (g.id === 'evo' && name === 'evo') add = n || 1;
    else if (g.id === 'secret' && name === 'secret') add = 1;
    else if (g.id === 'tonic' && name === 'tonic') add = 1;
    else if (g.id === 'ascend' && name === 'ascend') add = 1;
    if (set >= 0) g.p = Math.max(g.p || 0, set);
    else if (add) g.p = (g.p || 0) + add;
    if (g.p >= g.g) { g.p = g.g; g.done = 1; claimGoal(g); }
  }
}
function claimGoal(g) {
  if (!g || g.claimed || !g.done) return 0;
  g.claimed = 1;
  const pay = g.pay || PAY[g.tier] || 20;
  meta.shards = (meta.shards || 0) + pay;
  meta.st.shards = (meta.st.shards || 0) + pay;
  const goals = meta.daily.goals;
  if (goals.every(x => x.done) && meta.daily.stamped !== meta.daily.date) {
    meta.daily.stamped = meta.daily.date;
    meta.daily.stamps = (meta.daily.stamps || 0) + 1;
    const y = prevDate(meta.daily.date);
    meta.daily.streak = meta.daily.last === y ? (meta.daily.streak || 0) + 1 : 1;
    meta.daily.last = meta.daily.date;
    queueToast({ n: 'Daily goals complete', d: 'Stamp ' + meta.daily.stamps + ' · streak ' + meta.daily.streak, ic: '📅', reward: { shards: 0 } });
  }
  return pay;
}
function applyEv(name, n, ex) {
  const st = meta.st;
  n = n || 1;
  ex = ex || {};
  if (name === 'fight') {
    st.fights += 1;
    st.rounds += 1;
    if (ex.round) st.bestRound = Math.max(st.bestRound || 0, ex.round);
    if (ex.kills) st.kills += ex.kills;
    if (ex.win) {
      st.wins += 1;
      st.streakCur = (st.streakCur || 0) + 1;
      st.streakBest = Math.max(st.streakBest || 0, st.streakCur);
      if (ex.boss || ex.elite || ex.kind === 'boss' || ex.kind === 'elite') st.bosses += 1;
      if (ex.hazard) st.hazardWins = (st.hazardWins || 0) + 1;
    } else st.streakCur = 0;
  } else if (name === 'merge') st.merges += n;
  else if (name === 'evo') st.evos += n;
  else if (name === 'ascend') st.ascends += n;
  else if (name === 'runEnd') {
    if (ex.won) {
      st.runsWon += 1;
      if (!ex.lost) st.perfect += 1;
      if (ex.ms != null && ex.ms >= 0 && ex.ms <= 20 * 60 * 1000) st.speedClears = (st.speedClears || 0) + 1;
    } else st.runsLost += 1;
    if (ex.round) st.bestRound = Math.max(st.bestRound || 0, ex.round);
    st.streakCur = 0;
  } else if (name === 'relic') { st.relics += n; noteSets(); }
  else if (name === 'fuse') { st.fuses += n; st.legends += n; }
  else if (name === 'shiny') st.shinies += n;
  else if (name === 'wildsStart') st.wildsRuns += 1;
  else if (name === 'wildsFight') st.wildsWins += 1;
  else if (name === 'trainer') st.trainers += n;
  else if (name === 'lair') st.lairs += n;
  else if (name === 'floor') st.floors += n;
  else if (name === 'secret') st.secrets += n;
  else if (name === 'tonic') st.tonics += n;
  else if (name === 'den') st.den = 1;
  else if (name === 'shards') st.shards += n;
  else if (name === 'key') st.keys = (st.keys || 0) + n;
  else if (name === 'kos') { if (ex.kills) st.kills += ex.kills; }
  bumpGoals(name, n, ex);
}
// Player knockouts from the battle report when it is loaded; otherwise foes still down.
function fightKills(st) {
  if (window.FightStats && st && st.fs && FightStats.snapshot) {
    const snap = FightStats.snapshot(st);
    let n = 0;
    for (const r of snap.rows || []) if (r.side === 0) n += r.kills || 0;
    return n;
  }
  if (!st || !st.units) return 0;
  return st.units.filter(u => u.side === 1 && !u.alive).length;
}

function grant(def) {
  const rw = def.reward || {};
  if (rw.shards) {
    meta.shards = (meta.shards || 0) + rw.shards;
    meta.st.shards = (meta.st.shards || 0) + rw.shards;
  }
  for (const id of cosmList(rw.cosm)) {
    meta.cosm = meta.cosm || { own: {}, sel: { skin: (meta.skin || 'classic'), title: '', frame: '', theme: '' } };
    meta.cosm.own[id] = 1;
    if (window.COSM && COSM.grant) COSM.grant(id);
  }
}
function check() {
  if (!meta || !meta.ach || !meta.st) return [];
  const fresh = [];
  for (let pass = 0; pass < 3; pass++) {
    for (const def of ACH) {
      if (meta.ach[def.id]) continue;
      const p = def.get(meta) || 0;
      if (p >= def.goal) {
        meta.ach[def.id] = Date.now();
        grant(def);
        fresh.push(def);
        queueToast(def);
      }
    }
  }
  if (fresh.length) scheduleSave();
  return fresh;
}
function scheduleSave() {
  clearTimeout(saveT);
  saveT = setTimeout(() => { if (window.GLIM && GLIM.save) GLIM.save(); }, 500);
}
function ev(name, n, extra) {
  if (!meta) init(metaOf());
  if (!meta) return;
  if (meta.daily && meta.daily.date !== today()) rollDaily(meta);
  applyEv(name, n, extra || {});
  check();
  scheduleSave();
}

function cosmList(cosm) { return !cosm ? [] : (Array.isArray(cosm) ? cosm : [cosm]); }
function rewardText(rw) {
  if (!rw) return '';
  const bits = [];
  if (rw.shards) bits.push('+' + rw.shards + ' shards');
  for (const id of cosmList(rw.cosm)) bits.push(window.COSM && COSM.label ? COSM.label(id) : id);
  return bits.join(' · ');
}
function queueToast(def) {
  burst.push(def);
  clearTimeout(burstT);
  burstT = setTimeout(flushBurst, 40);
}
function flushBurst() {
  const list = burst.splice(0, burst.length);
  if (!list.length) return;
  if (list.length === 1) enqueue(list[0]);
  else enqueue({
    n: list.length + ' achievements',
    d: list.slice(0, 3).map(x => x.n).join(', ') + (list.length > 3 ? '…' : ''),
    ic: '🏆',
    reward: { shards: list.reduce((s, x) => s + ((x.reward && x.reward.shards) || 0), 0) },
  });
}
function enqueue(def) { queue.push(def); pump(); }
function busy() {
  return !!($('#modal.on') || $('#game.fighting'));
}
function pump() {
  if (showing || !queue.length || busy()) return;
  const def = queue.shift();
  const el = $('#achToast');
  if (!el) return;
  showing = true;
  const rw = rewardText(def.reward);
  const icon = def.badge && window.gdIcon ? '<img class="achbadge" src="' + gdIcon(def.badge, def.ic) + '" alt="">' : (def.ic || '🏆');
  el.innerHTML = '<b>' + icon + ' ' + esc(def.n) + '</b><div class="small">' + esc(def.d || '') + (rw ? ' · ' + esc(rw) : '') + '</div>';
  el.classList.add('on');
  setTimeout(() => {
    el.classList.remove('on');
    showing = false;
    setTimeout(pump, 280);
  }, 3000);
}
setInterval(() => { if (!busy()) pump(); }, 500);

function goalText(g) {
  const t = TPL[g.id];
  return t ? t.text(g.g, g.el) : g.id;
}
function bar(p, goal) {
  const w = Math.max(0, Math.min(100, goal ? (100 * p / goal) : 0));
  return '<div class="bar"><i style="width:' + w.toFixed(1) + '%"></i></div>';
}
function achIcon(def) {
  const key = def.badge || ('ach_' + def.id);
  return window.gdIcon ? gdIcon(key, def.ic) : '';
}
function achRow(def) {
  const p = Math.min(def.get(meta) || 0, def.goal);
  const done = !!meta.ach[def.id];
  const rw = rewardText(def.reward);
  const chip = def.chip ? '<span class="achtier">' + def.chip + '</span>' : '';
  return '<div class="li achrow' + (done ? '' : ' locked') + '"><span class="achbadgewrap"><img class="ic achbadge" src="' + achIcon(def) + '" alt="">' + chip + '</span>' +
    '<div class="grow"><div class="t">' + esc(def.n) + (done ? ' <span class="tag">done</span>' : '') + '</div>' +
    '<div class="small muted">' + esc(def.d) + '</div>' + bar(p, def.goal) +
    '<div class="small">' + p + ' / ' + def.goal + (rw ? ' · <span style="color:var(--gold)">' + esc(rw) + '</span>' : '') + '</div></div></div>';
}
function dailyHtml() {
  const d = meta.daily;
  const rows = (d.goals || []).map(g => {
    const claim = g.done && !g.claimed ? '<button class="btn sm green" data-v="claim:' + g.id + '">Claim</button>' : '';
    return '<div class="li achrow"><div class="grow"><div class="t">' + esc(goalText(g)) + (g.done ? ' <span class="tag">done</span>' : '') + '</div>' +
      bar(g.p || 0, g.g) + '<div class="small">' + (g.p || 0) + ' / ' + g.g + ' · <span style="color:var(--gold)">+' + (g.pay || PAY[g.tier] || 20) + ' shards</span>' +
      (g.claimed ? ' · claimed' : '') + '</div></div>' + claim + '</div>';
  }).join('');
  return '<p class="small muted" style="text-align:center">Today · streak ' + (d.streak || 0) + ' · stamps ' + (d.stamps || 0) + '</p>' +
    '<div class="list">' + rows + '</div>' +
    '<p class="small muted" style="text-align:center">Finish all three for a stamp. A stamp the day after the last one extends the streak.</p>';
}
function achHtml() {
  const list = ACH.filter(a => tab === 'all' || a.cat === tab);
  const done = ACH.filter(a => meta.ach[a.id]).length;
  const shards = ACH.reduce((s, a) => s + (meta.ach[a.id] && a.reward && a.reward.shards ? a.reward.shards : 0), 0);
  return '<p class="small" style="text-align:center"><b>' + done + ' / ' + ACH.length + '</b> unlocked · <span style="color:var(--gold)">' + shards + ' shards</span> earned from achievements</p>' +
    '<div class="list">' + list.map(achRow).join('') + '</div>';
}
function screenHtml() {
  const tabs = '<div class="achtabs">' +
    '<button class="btn sm' + (tab === 'daily' ? ' green' : ' ghost') + '" data-v="tab:daily">Daily</button>' +
    CATS.map(([id, n]) => '<button class="btn sm' + (tab === id ? ' green' : ' ghost') + '" data-v="tab:' + id + '">' + n + '</button>').join('') +
    '</div>';
  return tabs + (tab === 'daily' ? dailyHtml() : achHtml());
}
async function open() {
  if (!meta) init(metaOf());
  if (meta.daily && meta.daily.date !== today()) rollDaily(meta);
  tab = 'daily';
  for (;;) {
    const v = await GLIM.ask('Goals & Achievements', screenHtml(), GLIM.btn('x', 'Done', 'green'), 'x');
    if (v == null || v === 'x') break;
    if (v.indexOf('tab:') === 0) { tab = v.slice(4); continue; }
    if (v.indexOf('claim:') === 0) {
      const id = v.slice(6);
      const g = (meta.daily.goals || []).find(x => x.id === id);
      claimGoal(g);
      check();
      scheduleSave();
      continue;
    }
    break;
  }
  if (window.GLIM && GLIM.renderTitle && document.querySelector('#title.on')) GLIM.renderTitle();
}

function has(id) { return !!(meta && meta.ach && meta.ach[id]); }
function progress(id) {
  const def = ACH.find(a => a.id === id);
  if (!def || !meta) return null;
  const p = def.get(meta) || 0;
  return { p: Math.min(p, def.goal), goal: def.goal, done: has(id) };
}

window.AX = { ev, has, progress, init, check, open, rollDaily, ACH, claimGoal, fightKills };
if (window.GLIM && GLIM.meta) init(GLIM.meta);
})();
