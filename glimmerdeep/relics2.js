// More relics for Glimmerdeep. Data only: folded into GD.RELICS / GD.WILD_RELICS
// before chess.js and wilds.js read those tables. No DOM.
// Icons: GD_ICON_MANIFEST lists keys that have a real img/<key>.webp.
// Anything else is an emoji placeholder in ICON_PH. Do not probe the network.
(function (root) {
'use strict';
const G = root.GD;
if (!G) return;

root.GD_ICON_MANIFEST = root.GD_ICON_MANIFEST || {};
root.ICON_PH = root.ICON_PH || {};

// v4 art. A key in this list has a real file. Anything else stays an emoji.
const ART_V4 = {
  badges: ["badges/badge_01","badges/badge_02","badges/badge_03","badges/badge_04","badges/badge_05","badges/badge_06","badges/badge_07","badges/badge_08","badges/badge_09","badges/badge_10","badges/badge_11","badges/badge_12","badges/badge_13","badges/badge_14","badges/badge_15","badges/badge_16","badges/badge_17","badges/badge_18","badges/badge_19","badges/badge_20","badges/badge_21","badges/badge_22","badges/badge_23","badges/badge_24"],
  relics2: ["relics2/relic_01","relics2/relic_02","relics2/relic_03","relics2/relic_04","relics2/relic_05","relics2/relic_06","relics2/relic_07","relics2/relic_08","relics2/relic_09","relics2/relic_10","relics2/relic_11","relics2/relic_12","relics2/relic_13","relics2/relic_14","relics2/relic_15","relics2/relic_16","relics2/relic_17","relics2/relic_18","relics2/relic_19","relics2/relic_20","relics2/relic_21","relics2/relic_22","relics2/relic_23","relics2/relic_24","relics2/relic_25","relics2/relic_26","relics2/relic_27","relics2/relic_28","relics2/relic_29","relics2/relic_30","relics2/relic_31","relics2/relic_32","relics2/relic_33","relics2/relic_34","relics2/relic_35","relics2/relic_36","relics2/relic_37","relics2/relic_38","relics2/relic_39","relics2/relic_40"],
  frames: ["frames/frame_01","frames/frame_02","frames/frame_03","frames/frame_04","frames/frame_05","frames/frame_06"],
  tamerFrames: ["wd_tamer","wd_tamer_up","wd_tamer_down","wd_tamer_hurt_1","wd_tamer_hurt_2","wd_tamer_idle_1","wd_tamer_idle_2","wd_tamer_idle_3","wd_tamer_idle_4","wd_tamer_walk_1","wd_tamer_walk_2","wd_tamer_walk_3","wd_tamer_walk_4","wd_tamer_walk_5","wd_tamer_walk_6","wd_tamer_walk_7","wd_tamer_walk_8"],
  tamerFolders: ["tamer_ember_ranger","tamer_frost_walker","tamer_shade_stalker","tamer_bloom_warden","tamer_storm_caller","tamer_tide_diver","tamer_mystic_star","tamer_royal_regalia"]
};
root.ART_V4 = ART_V4;
function noteArt(k) { if (k) root.GD_ICON_MANIFEST[k] = 1; }
ART_V4.badges.forEach(noteArt);
ART_V4.relics2.forEach(noteArt);
ART_V4.frames.forEach(noteArt);
for (const folder of ART_V4.tamerFolders) for (const fr of ART_V4.tamerFrames) noteArt(folder + '/' + fr);

const RELIC_ICONS = {
  ruby_ring: "relics2/relic_16", berserker_mask: "relics2/relic_11", heavy_plate: "relics2/relic_28",
  spiked_collar: "relics2/relic_34", siphon_stone: "relics2/relic_06", hourglass: "relics2/relic_10",
  mana_well: "relics2/relic_08", battery_pack: "relics2/relic_09", wide_banner: "relics2/relic_07",
  bastion_crest: "relics2/relic_33", vanguard_ward: "relics2/relic_14", wardens_charm: "relics2/relic_19",
  executioner_edge: "relics2/relic_23", lucky_coin: "relics2/relic_03", piggy_bank: "relics2/relic_18",
  scholars_lamp: "relics2/relic_01", mutagen_vial: "relics2/relic_12", frostbite_locket: "relics2/relic_27",
  rain_charm: "relics2/relic_20", plague_mask: "relics2/relic_22", pyre_crown: "relics2/relic_39",
  tidal_crown: "relics2/relic_40", thorn_crown: "relics2/relic_25", storm_crown: "relics2/relic_17",
  granite_crown: "relics2/relic_37", second_wind: "relics2/relic_26", opening_gambit: "relics2/relic_24",
  last_stand: "relics2/relic_13", bounty_bell: "relics2/relic_21", rainbow_roster: "relics2/relic_30",
  trail_boots: "relics2/relic_35", magnet_charm: "relics2/relic_36", sneak_cloak: "relics2/relic_02",
  dowsing_rod: "relics2/relic_15", second_key: "relics2/relic_04", trainers_whistle: "relics2/relic_38",
  lucky_foot: "relics2/relic_29", echo_shell: "relics2/relic_05", emberstep: "relics2/relic_32",
  keepsake_locket: "relics2/relic_31"
};

function emojiSvg(emoji) {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">' +
    '<rect width="96" height="96" rx="18" fill="#2e2360"/>' +
    '<text x="48" y="64" text-anchor="middle" font-size="50" font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif">' +
    emoji + '</text></svg>';
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
// Resolve an icon. Manifest hit -> file. Otherwise the emoji placeholder (registered for IMG()).
root.gdIcon = function (key, emoji) {
  if (key && root.GD_ICON_MANIFEST[key]) return 'img/' + key + '.webp';
  if (emoji && key && !root.ICON_PH[key]) root.ICON_PH[key] = emojiSvg(emoji);
  return (key && root.ICON_PH[key]) || (key ? ('img/' + key + '.webp') : '');
};
function ph(key, emoji) { root.gdIcon(key, emoji); }

// b keys the fight engine already reads, plus the five hooks added with this batch.
const BKEYS = {
  asMul: 1, atkMul: 1, defMul: 1, hpMul: 1, dmgMul: 1, crit: 1, critDmg: 1, critGold: 1, firstCrit: 1,
  lifesteal: 1, lsAll: 1, killHeal: 1, overheal: 1, regen: 1, healAmp: 1, thorns: 1, thornsAll: 1,
  startShield: 1, frontShield: 1, tankShield: 1, frontAtk: 1, frontDef: 1, backDR: 1, shieldAtk: 1, shieldAmp: 1,
  kin: 1, kinship: 1, mono: 1, startOd: 1, odRate: 1, manaDisc: 1, ultAmp: 1, echo: 1, skillAmp: 1,
  stunPlus: 1, stunImmune: 1, startChill: 1, chillAmp: 1, startSoak: 1, soakAmp: 1, burnTurns: 1, burnAmp: 1,
  poisonPlus: 1, statusTurns: 1, curseAmp: 1, curseSpread: 1, shatterAmp: 1, electroAmp: 1, blightAmp: 1, steamHeal: 1,
  dodge: 1, shadeDodge: 1, mirror: 1, voltDef: 1, voltChain: 1, tideHeal: 1, tempo: 1, phoenix: 1, reflectAll: 1,
  interestCap: 1, xpRound: 1, mutChoice: 1, goldRound: 1, relicChoice: 1, rerollDisc: 1,
  lowHeal: 1, openAtk: 1, lastStand: 1, koGold: 1, rainbow: 1,
};
const WKEYS = { speed: 1, reach: 1, sight: 1, dowse: 1, keyPlus: 1, tokens: 1, chestRelic: 1, winHeal: 1, map: 1, spikeproof: 1, shardMul: 1, xp: 1, phoenix: 1, tonic: 1, skeleton: 1 };

const RELICS2 = {
  ruby_ring: { n: 'Ruby Ring', tags: ['crit', 'inferno'], r: 1, b: { crit: 0.05, burnAmp: 0.10 }, d: '+5% crit. Burns hurt 10% more.', em: '💍', hook: 'existing' },
  berserker_mask: { n: 'Berserker Mask', tags: ['crit'], r: 2, b: { atkMul: 0.15, defMul: -0.10 }, d: '+15% ATK, −10% DEF.', em: '👹', hook: 'existing' },
  heavy_plate: { n: 'Heavy Plate', tags: ['shield'], r: 1, b: { defMul: 0.10, startShield: 0.06 }, d: '+10% DEF. Allies open with a 6% shield.', em: '🛡️', hook: 'existing' },
  spiked_collar: { n: 'Spiked Collar', tags: ['shield'], r: 1, b: { thornsAll: 0.06 }, d: 'Attackers take 6% of the damage they deal.', em: '🦔', hook: 'existing' },
  siphon_stone: { n: 'Siphon Stone', tags: ['vamp'], r: 1, b: { lsAll: 0.06 }, d: 'Heal 6% of all damage dealt.', em: '🩸', hook: 'existing' },
  hourglass: { n: 'Hourglass', tags: ['swift'], r: 2, b: { asMul: 0.06, manaDisc: 0.06 }, d: '+6% attack speed. Skills cost 6% less mana.', em: '⏳', hook: 'existing' },
  mana_well: { n: 'Mana Well', tags: ['overdrive'], r: 1, b: { startOd: 20 }, d: 'Everyone starts the fight with 20 mana.', em: '🔷', hook: 'existing' },
  battery_pack: { n: 'Battery Pack', tags: ['overdrive'], r: 2, b: { startOd: 15, odRate: 0.08 }, d: '+15 starting mana. Mana charges 8% faster.', em: '🔋', hook: 'existing' },
  wide_banner: { n: 'Wide Banner', tags: ['team'], r: 2, b: { frontAtk: 0.10, backDR: 0.10 }, d: 'Front column +10% ATK. Back column takes 10% less damage.', em: '🚩', hook: 'existing' },
  bastion_crest: { n: 'Bastion Crest', tags: ['team', 'shield'], r: 1, b: { frontDef: 0.20 }, d: 'Front column +20% DEF.', em: '🏰', hook: 'existing' },
  vanguard_ward: { n: 'Vanguard Ward', tags: ['team', 'shield'], r: 1, b: { frontShield: 0.20 }, d: 'Front column opens with a 20% shield.', em: '🔰', hook: 'existing' },
  wardens_charm: { n: "Warden's Charm", tags: ['shield'], r: 1, b: { tankShield: 0.25 }, d: 'Tanks open with a 25% shield.', em: '🧿', hook: 'existing' },
  executioner_edge: { n: "Executioner's Edge", tags: ['crit'], r: 2, b: { critDmg: 0.35, crit: 0.04 }, d: 'Crits deal +35% damage. +4% crit chance.', em: '🪓', hook: 'existing' },
  lucky_coin: { n: 'Lucky Coin', tags: ['greed', 'crit'], r: 1, b: { crit: 0.05, goldRound: 1 }, d: '+5% crit. +1 gold every round.', em: '🪙', hook: 'existing' },
  piggy_bank: { n: 'Piggy Bank', tags: ['greed'], r: 1, b: { interestCap: 3 }, d: 'Interest cap +3.', em: '🐷', hook: 'existing' },
  scholars_lamp: { n: "Scholar's Lamp", tags: ['growth'], r: 1, b: { xpRound: 1, startOd: 10 }, d: '+1 Tamer XP every round. +10 starting mana.', em: '🪔', hook: 'existing' },
  mutagen_vial: { n: 'Mutagen Vial', tags: ['growth'], r: 2, b: { mutChoice: 1 }, d: 'One more mutation to choose from.', em: '🧪', hook: 'existing' },
  frostbite_locket: { n: 'Frostbite Locket', tags: ['status'], r: 2, b: { startChill: 3, chillAmp: 0.10 }, d: 'Foes start Chilled. Chilled foes take 10% more damage.', em: '❄️', hook: 'existing' },
  rain_charm: { n: 'Rain Charm', tags: ['tidal', 'status'], r: 2, b: { startSoak: 1, soakAmp: 0.10 }, d: 'Soak every foe at the start. Soaked foes take 10% more damage.', em: '🌧️', hook: 'existing' },
  plague_mask: { n: 'Plague Mask', tags: ['verdant', 'status'], r: 2, b: { poisonPlus: 1, statusTurns: 1 }, d: 'Poison applies 1 extra stack. Statuses last longer.', em: '😷', hook: 'existing' },
  pyre_crown: { n: 'Pyre Crown', tags: ['inferno'], r: 2, b: { el_ember: 0.35, hpMul: -0.08 }, d: 'Ember attacks +35% damage. −8% max HP.', em: '👑', hook: 'existing' },
  tidal_crown: { n: 'Tidal Crown', tags: ['tidal'], r: 2, b: { el_tide: 0.35, hpMul: -0.08 }, d: 'Tide attacks +35% damage. −8% max HP.', em: '👑', hook: 'existing' },
  thorn_crown: { n: 'Thorn Crown', tags: ['verdant'], r: 2, b: { el_bloom: 0.35, hpMul: -0.08 }, d: 'Bloom attacks +35% damage. −8% max HP.', em: '👑', hook: 'existing' },
  storm_crown: { n: 'Storm Crown', tags: ['storm'], r: 2, b: { el_volt: 0.35, hpMul: -0.08 }, d: 'Volt attacks +35% damage. −8% max HP.', em: '👑', hook: 'existing' },
  granite_crown: { n: 'Granite Crown', tags: ['bedrock'], r: 2, b: { el_stone: 0.35, hpMul: -0.08 }, d: 'Stone attacks +35% damage. −8% max HP.', em: '👑', hook: 'existing' },
  second_wind: { n: 'Second Wind', tags: ['vamp'], r: 2, b: { lowHeal: 0.12 }, d: 'The first time an ally drops under 30% HP, they heal 12% max HP.', em: '🌬️', hook: 'NEW:lowHeal' },
  opening_gambit: { n: 'Opening Gambit', tags: ['swift'], r: 1, b: { openAtk: 0.25 }, d: 'Allies have +25% ATK for the first 5 seconds.', em: '⚔️', hook: 'NEW:openAtk' },
  last_stand: { n: 'Last Stand', tags: ['team'], r: 2, b: { lastStand: 0.40 }, d: 'When only one ally is alive, it gains +40% ATK.', em: '🗡️', hook: 'NEW:lastStand' },
  bounty_bell: { n: 'Bounty Bell', tags: ['greed'], r: 1, b: { koGold: 1 }, d: '+1 gold for each of the first two knockouts in a fight.', em: '🔔', hook: 'NEW:koGold' },
  rainbow_roster: { n: 'Rainbow Roster', tags: ['team'], r: 2, b: { rainbow: 0.04 }, d: '+4% ATK per different species on the board (max 6).', em: '🌈', hook: 'NEW:rainbow' },
};

const WILD_RELICS2 = {
  trail_boots: { n: 'Trail Boots', em: '👢', d: 'Walk 15% faster.', w: { speed: 0.15 } },
  magnet_charm: { n: 'Magnet Charm', em: '🧲', d: 'Pick-ups pull from 1 unit further away.', w: { reach: 1 } },
  sneak_cloak: { n: 'Sneak Cloak', em: '🧥', d: 'Trainers see 25% less far.', w: { sight: 0.25 } },
  dowsing_rod: { n: 'Dowsing Rod', em: '🔮', d: 'Secret walls shimmer from much further away.', w: { dowse: 1 } },
  second_key: { n: 'Second Key', em: '🗝️', d: '+1 key at the start of every floor.', w: { keyPlus: 1 } },
  trainers_whistle: { n: "Trainer's Whistle", em: '🎺', d: '+1 Trainer Token per trainer win.', w: { tokens: 1 }, rare: 1 },
  lucky_foot: { n: 'Lucky Foot', em: '🐇', d: 'Chests are 25% likelier to hold a relic.', w: { chestRelic: 0.25 } },
  echo_shell: { n: 'Echo Shell', em: '🐚', d: 'Your squad starts with 30 mana. Ultimates deal 20% more.', b: { startOd: 30, ultAmp: 0.20 }, rare: 1 },
  emberstep: { n: 'Emberstep Sash', em: '🔥', d: 'Burns hurt 30% more and last longer.', b: { burnAmp: 0.30, burnTurns: 1 }, rare: 1 },
  keepsake_locket: { n: 'Keepsake Locket', em: '📿', d: '+8% HP. Heal 6% after each win.', b: { hpMul: 0.08 }, w: { winHeal: 0.06 } },
};

function keyOk(k) {
  if (BKEYS[k]) return true;
  if (k.indexOf('el_') === 0 && k.length > 3) return true;
  if (k.indexOf('immune_') === 0 && k.length > 8) return true;
  return false;
}
for (const id in RELICS2) {
  const r = RELICS2[id];
  r.id = id;
  r.ic = RELIC_ICONS[id];
  G.RELICS[id] = r;
  ph('rl_' + id, r.em);
}
for (const id in WILD_RELICS2) {
  const r = WILD_RELICS2[id];
  r.id = id;
  r.ic = RELIC_ICONS[id];
  G.WILD_RELICS[id] = r;
  ph('rl_' + id, r.em);
}
G.RELICS2 = RELICS2;
G.WILD_RELICS2 = WILD_RELICS2;

G.relicAudit = function () {
  const err = [];
  const n2 = Object.keys(RELICS2).length, w2 = Object.keys(WILD_RELICS2).length;
  if (n2 !== 30) err.push('RELICS2 count ' + n2);
  if (w2 !== 10) err.push('WILD_RELICS2 count ' + w2);
  for (const id in RELICS2) {
    const r = RELICS2[id];
    if (!r.n || !r.d || !r.em || !r.tags || !r.tags.length || !(r.r >= 1)) err.push('bad chess relic ' + id);
    if (r.r === 2 && r.b.dmgMul > 0.4) err.push('r2 dmgMul ' + id);
    for (const k in r.b) if (!keyOk(k)) err.push('bad b key ' + id + '.' + k);
    if (!r.ic || !root.GD_ICON_MANIFEST[r.ic]) err.push('no icon ' + id);
    if (!root.ICON_PH['rl_' + id]) err.push('no fallback ' + id);
  }
  for (const id in WILD_RELICS2) {
    const r = WILD_RELICS2[id];
    if (!r.n || !r.d || !r.em || !r.ic || !root.GD_ICON_MANIFEST[r.ic]) err.push('bad wild relic ' + id);
    for (const k in r.b || {}) if (!keyOk(k)) err.push('bad wild b ' + id + '.' + k);
    for (const k in r.w || {}) if (!WKEYS[k]) err.push('bad w key ' + id + '.' + k);
  }
  return err;
};
})(typeof window !== 'undefined' ? window : globalThis);
