// Glimmerdeep data: elements, species, skills, relics, charms, items, biomes, events.
// Pure data (no DOM) so battle.js and the node sim can share it.
(function (root) {
'use strict';

const EL = {
  ember: { name: 'Ember', col: '#ff7a2a' }, tide: { name: 'Tide', col: '#2fa6ff' },
  bloom: { name: 'Bloom', col: '#4fd35a' }, volt: { name: 'Volt', col: '#ffd21f' },
  stone: { name: 'Stone', col: '#c79459' }, shade: { name: 'Shade', col: '#7d6bff' },
};
const ELS = Object.keys(EL);
// attacker -> defenders it hits for x1.5 (each element beats two, loses to two)
const STRONG = {
  ember: ['bloom', 'shade'], tide: ['ember', 'stone'], bloom: ['tide', 'stone'],
  volt: ['tide', 'shade'], stone: ['ember', 'volt'], shade: ['volt', 'bloom'],
};
function eff(a, d) {
  if (!a || !d) return 1;
  if (STRONG[a].includes(d)) return 1.5;
  if (STRONG[d].includes(a)) return 0.67;
  return 1;
}

// role base stats (stage 1, level 1)
const ROLE = {
  striker: { hp: 44, atk: 15, def: 8, spd: 12 },
  caster:  { hp: 40, atk: 15, def: 7, spd: 11 },
  tank:    { hp: 62, atk: 10, def: 13, spd: 7 },
  support: { hp: 48, atk: 11, def: 9, spd: 10 },
};
const STAGE_MUL = [0, 1, 1.3, 1.65];
const EVO_LV = [0, 7, 14];          // stage 2 at L7, stage 3 at L14

// ---- skills -----------------------------------------------------------------
// t: target  foe | foes | foe3 (3 random hits) | foe5 | foe6 | ally | allies | self | lowfoe
// fx: effects applied to each target (or self when the key starts with "self")
const SK = {
  // ember
  ember_nip:   { n: 'Ember Nip', el: 'ember', pow: 60, t: 'foe', fx: { burn: 0.2 }, d: 'Bite. 20% Burn.' },
  flame_lash:  { n: 'Flame Lash', el: 'ember', pow: 95, t: 'foe', cd: 2, fx: { burn: 0.6 }, d: 'Heavy hit. 60% Burn.' },
  kindle:      { n: 'Kindle Up', el: 'ember', t: 'self', cd: 3, fx: { atkUp: 0.35, heal: 0.12 }, d: 'Self: +35% ATK for 3 turns, heal 12%.' },
  magma_surge: { n: 'Magma Surge', el: 'ember', pow: 110, t: 'foes', ult: 1, fx: { burn: 1 }, d: 'ULT: hit all foes, Burn all.' },
  cinder_flick:{ n: 'Cinder Flick', el: 'ember', pow: 55, t: 'foe', rng: 1, fx: { burn: 0.15 }, d: 'Ranged. 15% Burn.' },
  fox_fire:    { n: 'Fox Fire', el: 'ember', pow: 45, t: 'foes', cd: 2, fx: { burn: 0.3 }, d: 'Hit all foes. 30% Burn.' },
  heat_mirage: { n: 'Heat Mirage', el: 'ember', pow: 40, t: 'foe', rng: 1, cd: 3, fx: { blind: 1, selfDodge: 0.3 }, d: 'Blind a foe; gain 30% dodge.' },
  solar_flare: { n: 'Solar Flare', el: 'ember', pow: 120, t: 'foes', ult: 1, fx: { blind: 1 }, d: 'ULT: hit all foes, Blind all.' },
  // tide
  bubble_pop:  { n: 'Bubble Pop', el: 'tide', pow: 50, t: 'foe', rng: 1, fx: { soak: 0.4 }, d: 'Ranged. 40% Soak.' },
  spring:      { n: 'Healing Spring', el: 'tide', t: 'ally', cd: 2, fx: { heal: 0.32, cleanse: 1 }, d: 'Heal the weakest ally 32% and cleanse.' },
  bubble_wall: { n: 'Bubble Shield', el: 'tide', t: 'allies', cd: 3, fx: { shield: 0.14 }, d: 'Shield all allies for 14% max HP.' },
  tidal_wave:  { n: 'Tidal Wave', el: 'tide', pow: 90, t: 'foes', ult: 1, fx: { soak: 1, allyHeal: 0.15 }, d: 'ULT: hit all, Soak all, heal allies 15%.' },
  shell_bash:  { n: 'Shell Bash', el: 'tide', pow: 55, t: 'foe', fx: { soak: 0.25 }, d: '25% Soak.' },
  shell_taunt: { n: 'Hunker Down', el: 'tide', t: 'self', cd: 3, fx: { taunt: 2, defUp: 0.4 }, d: 'Taunt for 2 turns, +40% DEF.' },
  riptide:     { n: 'Riptide', el: 'tide', pow: 80, t: 'foe', cd: 2, fx: { soak: 1 }, d: 'Always Soaks.' },
  reef_fort:   { n: 'Reef Fortress', el: 'tide', t: 'allies', ult: 1, fx: { shield: 0.3, defUp: 0.3 }, d: 'ULT: shield all 30% and +30% DEF.' },
  // bloom
  leaf_kick:   { n: 'Leaf Kick', el: 'bloom', pow: 60, t: 'foe', d: 'A quick kick.' },
  sap_mend:    { n: 'Sap Mend', el: 'bloom', t: 'allies', cd: 3, fx: { heal: 0.15, regen: 0.05 }, d: 'Heal all allies 15% and Regen.' },
  snare:       { n: 'Bramble Snare', el: 'bloom', pow: 50, t: 'foe', rng: 1, cd: 2, fx: { root: 1 }, d: 'Ranged. Roots the foe.' },
  blossom:     { n: 'Blossom Storm', el: 'bloom', pow: 75, t: 'foes', ult: 1, fx: { root: 1, allyHeal: 0.25 }, d: 'ULT: hit all, Root all, heal allies 25%.' },
  spore_puff:  { n: 'Spore Puff', el: 'bloom', pow: 40, t: 'foe', rng: 1, fx: { poison: 1 }, d: 'Ranged. +1 Poison.' },
  toxic_cloud: { n: 'Toxic Cloud', el: 'bloom', pow: 20, t: 'foes', cd: 3, fx: { poison: 2 }, d: 'All foes +2 Poison.' },
  rooted_guard:{ n: 'Rooted Guard', el: 'bloom', t: 'self', cd: 3, fx: { taunt: 2, regen: 0.08 }, d: 'Taunt 2 turns, Regen 8%.' },
  mycelium:    { n: 'Mycelium Bloom', el: 'bloom', pow: 30, t: 'foes', ult: 1, fx: { poison: 3, allyHeal: 0.2 }, d: 'ULT: all foes +3 Poison, heal allies 20%.' },
  // volt
  zap_scratch: { n: 'Zap Scratch', el: 'volt', pow: 60, t: 'foe', fx: { stun: 0.08 }, d: '8% Stun.' },
  volt_dash:   { n: 'Volt Dash', el: 'volt', pow: 90, t: 'foe', rng: 1, cd: 2, fx: { selfSpdUp: 0.25 }, d: 'Reaches the back row. +SPD.' },
  static:      { n: 'Static Charge', el: 'volt', t: 'self', cd: 3, fx: { atkUp: 0.25, spdUp: 0.3 }, d: 'Self: +25% ATK, +30% SPD.' },
  thunderclap: { n: 'Thunderclap', el: 'volt', pow: 100, t: 'foes', ult: 1, fx: { stun: 0.3 }, d: 'ULT: hit all, 30% Stun.' },
  stinger:     { n: 'Stinger Spark', el: 'volt', pow: 55, t: 'foe', rng: 1, fx: { stun: 0.12 }, d: 'Ranged. 12% Stun.' },
  chain:       { n: 'Chain Lightning', el: 'volt', pow: 50, t: 'foe3', cd: 2, d: '3 hits on random foes.' },
  pollen:      { n: 'Pollen Charge', el: 'volt', t: 'allies', cd: 3, fx: { od: 20, spdUp: 0.2 }, d: 'All allies +20 Overdrive, +20% SPD.' },
  storm_swarm: { n: 'Storm Swarm', el: 'volt', pow: 45, t: 'foe6', ult: 1, fx: { stun: 0.2 }, d: 'ULT: 6 hits on random foes, 20% Stun.' },
  // stone
  pebble_toss: { n: 'Pebble Toss', el: 'stone', pow: 55, t: 'foe', rng: 1, d: 'Ranged.' },
  stone_wall:  { n: 'Stone Wall', el: 'stone', t: 'allies', cd: 3, fx: { shield: 0.15, selfTaunt: 1 }, d: 'Shield all 15%; taunt 1 turn.' },
  rockslide:   { n: 'Rockslide', el: 'stone', pow: 55, t: 'foes', cd: 2, d: 'Hit all foes.' },
  tectonic:    { n: 'Tectonic Slam', el: 'stone', pow: 100, t: 'foes', ult: 1, fx: { stun: 0.25, selfShield: 0.3 }, d: 'ULT: hit all, 25% Stun, shield self 30%.' },
  crystal_claw:{ n: 'Crystal Claw', el: 'stone', pow: 65, t: 'foe', crit: 0.1, d: '+10% crit chance.' },
  gem_roll:    { n: 'Gem Roll', el: 'stone', pow: 100, t: 'foe', cd: 2, fx: { selfDefUp: 0.3 }, d: 'Heavy hit; +30% DEF.' },
  sharpen:     { n: 'Sharpen', el: 'stone', t: 'self', cd: 3, fx: { critUp: 0.3, atkUp: 0.2 }, d: 'Self: +30% crit, +20% ATK.' },
  prism_barr:  { n: 'Prism Barrage', el: 'stone', pow: 55, t: 'foe5', ult: 1, crit: 0.5, d: 'ULT: 5 hits, +50% crit.' },
  // shade
  shadow_swipe:{ n: 'Shadow Swipe', el: 'shade', pow: 60, t: 'foe', fx: { curse: 0.2 }, d: '20% Curse.' },
  pounce:      { n: 'Phantom Pounce', el: 'shade', pow: 85, t: 'lowfoe', rng: 1, cd: 2, fx: { curse: 1 }, d: 'Leaps on the weakest foe. Curses.' },
  fade:        { n: 'Fade', el: 'shade', t: 'self', cd: 3, fx: { dodge: 0.5 }, d: 'Self: 50% dodge for 2 turns.' },
  void_rend:   { n: 'Void Rend', el: 'shade', pow: 220, t: 'lowfoe', rng: 1, ult: 1, exec: 0.3, d: 'ULT: huge hit on the weakest; executes under 30%.' },
  night_nip:   { n: 'Night Nip', el: 'shade', pow: 50, t: 'foe', rng: 1, ls: 0.4, d: 'Ranged. Heals 40% of damage.' },
  screech:     { n: 'Dread Screech', el: 'shade', pow: 25, t: 'foes', cd: 3, fx: { curse: 1 }, d: 'Curse all foes.' },
  moonveil:    { n: 'Moonveil', el: 'shade', pow: 35, t: 'foe3', cd: 3, fx: { blind: 0.6 }, d: '3 hits, 60% Blind.' },
  eclipse:     { n: 'Total Eclipse', el: 'shade', pow: 90, t: 'foes', ult: 1, ls: 0.3, fx: { curse: 1, blind: 0.5 }, d: 'ULT: hit all, Curse all, drain life.' },
  // bosses
  thorn_whip:  { n: 'Thorn Whip', el: 'bloom', pow: 70, t: 'foe', rng: 1, fx: { root: 0.6 }, d: '' },
  spore_storm: { n: 'Spore Storm', el: 'bloom', pow: 25, t: 'foes', cd: 3, fx: { poison: 2 }, d: '' },
  sprout_call: { n: 'Call the Sprouts', el: 'bloom', t: 'self', cd: 4, fx: { summon: 'sprt' }, d: '' },
  heart_bloom: { n: 'Heart Bloom', el: 'bloom', t: 'self', cd: 4, fx: { heal: 0.12 }, d: '' },
  magma_fist:  { n: 'Magma Fist', el: 'ember', pow: 90, t: 'foe', fx: { burn: 0.7 }, d: '' },
  eruption:    { n: 'Eruption', el: 'ember', pow: 60, t: 'foes', cd: 3, fx: { burn: 0.6 }, d: '' },
  molten_armor:{ n: 'Molten Armor', el: 'ember', t: 'self', cd: 4, fx: { shield: 0.15 }, d: '' },
  tidal_coil:  { n: 'Tidal Coil', el: 'tide', pow: 45, t: 'foes', cd: 2, fx: { soak: 1 }, d: '' },
  thunder_fang:{ n: 'Thunder Fang', el: 'volt', pow: 95, t: 'foe', fx: { stun: 0.2 }, d: '' },
  static_field:{ n: 'Static Field', el: 'volt', pow: 55, t: 'foes', cd: 3, fx: { stun: 0.25 }, d: '' },
  shard_volley:{ n: 'Shard Volley', el: 'stone', pow: 45, t: 'foe5', d: '' },
  prism_guard: { n: 'Prism Guard', el: 'stone', t: 'self', cd: 4, fx: { shield: 0.15, defUp: 0.3 }, d: '' },
  crystal_beam:{ n: 'Crystal Beam', el: 'stone', pow: 130, t: 'foe', rng: 1, cd: 3, d: '' },
  hex_gaze:    { n: 'Hex Gaze', el: 'shade', pow: 30, t: 'foes', cd: 3, fx: { curse: 1 }, d: '' },
  night_terror:{ n: 'Night Terror', el: 'shade', pow: 80, t: 'foe', rng: 1, fx: { blind: 0.6 }, d: '' },
  soul_drain:  { n: 'Soul Drain', el: 'shade', pow: 70, t: 'lowfoe', rng: 1, ls: 1, cd: 2, d: '' },
  bat_call:    { n: 'Call of the Night', el: 'shade', t: 'self', cd: 4, fx: { summon: 'dusk' }, d: '' },
  flux_breath: { n: 'Elemental Breath', el: 'flux', pow: 75, t: 'foes', d: '' },
  crystal_scale:{ n: 'Crystal Scales', el: 'stone', t: 'self', cd: 4, fx: { shield: 0.12 }, d: '' },
  cataclysm:   { n: 'Cataclysm', el: 'flux', pow: 135, t: 'foes', cd: 4, fx: { stun: 0.2 }, d: '' },
  wyrm_bite:   { n: 'Prism Fang', el: 'flux', pow: 100, t: 'foe', d: '' },
};
for (const k in SK) SK[k].id = k;

// ---- species ------------------------------------------------------------------
const SP = {
  cind: { el: 'ember', role: 'striker', names: ['Cindrop', 'Blazelotl', 'Magmalotl'], sk: ['ember_nip', 'flame_lash', 'kindle', 'magma_surge'], mod: { atk: 1.08 } },
  pyrp: { el: 'ember', role: 'caster', names: ['Pyrpup', 'Flarefox', 'Solvixen'], sk: ['cinder_flick', 'fox_fire', 'heat_mirage', 'solar_flare'], mod: { spd: 1.1 } },
  bubb: { el: 'tide', role: 'support', names: ['Bubbo', 'Rippler', 'Tsunotter'], sk: ['bubble_pop', 'spring', 'bubble_wall', 'tidal_wave'], mod: {} },
  shel: { el: 'tide', role: 'tank', names: ['Shellby', 'Coralisk', 'Leviashell'], sk: ['shell_bash', 'shell_taunt', 'riptide', 'reef_fort'], mod: { def: 1.08 } },
  sprt: { el: 'bloom', role: 'support', names: ['Sproutle', 'Thornhare', 'Verdalop'], sk: ['leaf_kick', 'sap_mend', 'snare', 'blossom'], mod: { spd: 1.1 } },
  moss: { el: 'bloom', role: 'tank', names: ['Mossling', 'Fungrove', 'Sporeking'], sk: ['spore_puff', 'toxic_cloud', 'rooted_guard', 'mycelium'], mod: { hp: 1.05 } },
  sprk: { el: 'volt', role: 'striker', names: ['Sparkit', 'Joltquill', 'Stormquill'], sk: ['zap_scratch', 'volt_dash', 'static', 'thunderclap'], mod: { spd: 1.15, hp: 0.94 } },
  buzz: { el: 'volt', role: 'caster', names: ['Buzzlet', 'Amperbee', 'Tempestqueen'], sk: ['stinger', 'chain', 'pollen', 'storm_swarm'], mod: { spd: 1.1 } },
  pebb: { el: 'stone', role: 'tank', names: ['Pebblit', 'Bouldron', 'Titanite'], sk: ['pebble_toss', 'stone_wall', 'rockslide', 'tectonic'], mod: { hp: 1.08, spd: 0.9 } },
  crys: { el: 'stone', role: 'striker', names: ['Crystomp', 'Gemadillo', 'Prismadon'], sk: ['crystal_claw', 'gem_roll', 'sharpen', 'prism_barr'], mod: { def: 1.15, spd: 0.9 } },
  wisp: { el: 'shade', role: 'striker', names: ['Wispurr', 'Gloomcat', 'Umbrapanther'], sk: ['shadow_swipe', 'pounce', 'fade', 'void_rend'], mod: { spd: 1.15, def: 0.9 } },
  dusk: { el: 'shade', role: 'caster', names: ['Batbit', 'Duskwing', 'Eclipsar'], sk: ['night_nip', 'screech', 'moonveil', 'eclipse'], mod: { hp: 1.05 } },
};
// skill unlocks: basic + first skill at L1, second skill at L4, ultimate at stage 2
const SKILL_LV = [1, 1, 4];

const BOSSES = {
  bramble: { name: 'Mother Bramble', el: 'bloom', art: 'boss_bramble', hp: 4.6, atk: 1.1, def: 1.2, spd: 0.8, sk: ['thorn_whip', 'spore_storm', 'sprout_call', 'heart_bloom'] },
  cinder:  { name: 'Cinderking', el: 'ember', art: 'boss_cinder', hp: 6.5, atk: 1.25, def: 1.3, spd: 0.75, sk: ['magma_fist', 'eruption', 'molten_armor'] },
  eel:     { name: 'Abyssqueen', el: 'tide', art: 'boss_eel', hp: 7, atk: 1.2, def: 1.1, spd: 1.1, sk: ['thunder_fang', 'tidal_coil', 'static_field'] },
  prism:   { name: 'Prism Sentinel', el: 'stone', art: 'boss_prism', hp: 8, atk: 1.2, def: 1.5, spd: 0.8, sk: ['shard_volley', 'crystal_beam', 'prism_guard'] },
  grim:    { name: 'Grimhoot', el: 'shade', art: 'boss_grim', hp: 7, atk: 1.25, def: 1.1, spd: 1.05, sk: ['night_terror', 'hex_gaze', 'soul_drain', 'bat_call'] },
  wyrm:    { name: 'The Glimmerwyrm', el: 'ember', flux: 1, art: 'boss_wyrm', hp: 9.5, atk: 1.35, def: 1.35, spd: 1, sk: ['wyrm_bite', 'flux_breath', 'cataclysm', 'crystal_scale'] },
};

// ---- biomes and hazards ---------------------------------------------------------
const BIOMES = {
  verdant: { name: 'Verdant Hollow', bg: 'bg_verdant', els: ['bloom', 'volt', 'tide', 'ember'], boss: 'bramble', haz: 'spores',
    hazName: 'Spore Haze', hazDesc: 'Each turn your non-Bloom creatures gain 1 Poison.', counter: 'Bloom creatures, Purifying Incense, cleanses' },
  magma:   { name: 'Magma Forge', bg: 'bg_magma', els: ['ember', 'stone', 'ember', 'volt'], boss: 'cinder', haz: 'heat',
    hazName: 'Scorching Heat', hazDesc: 'Each turn your creatures that are not Ember or Stone lose 5% HP (Tide: 2%).', counter: 'Tide creatures (2× vs Ember), Frostcore, healers' },
  grotto:  { name: 'Sunken Grotto', bg: 'bg_grotto', els: ['tide', 'volt', 'tide', 'bloom'], boss: 'eel', haz: 'flood',
    hazName: 'Rising Flood', hazDesc: 'Everyone is permanently Soaked: Volt hits Electrocute, Ember deals 40% less.', counter: 'Volt and Bloom creatures, Gill Pearl' },
  spire:   { name: 'Crystal Spire', bg: 'bg_spire', els: ['stone', 'volt', 'stone', 'tide'], boss: 'prism', haz: 'reflect',
    hazName: 'Prismatic Echo', hazDesc: 'Foes reflect 20% of single-target damage back at the attacker.', counter: 'Hit-all skills, Prism Lens, lifesteal' },
  crypt:   { name: 'Shadow Crypt', bg: 'bg_crypt', els: ['shade', 'ember', 'shade', 'bloom'], boss: 'grim', haz: 'dark',
    hazName: 'Pitch Darkness', hazDesc: 'Your non-Shade creatures miss 25% of attacks. An Ember hit lights the room for the turn.', counter: 'Shade and Ember creatures, Lumen Moth' },
  core:    { name: 'The Glimmer Core', bg: 'bg_core', els: ['ember', 'tide', 'bloom', 'volt', 'stone', 'shade'], boss: 'wyrm', haz: 'flux',
    hazName: 'Elemental Flux', hazDesc: 'Foes change element every turn. Read the badges and adapt.', counter: 'A mixed team, Kinship Knot' },
};
const ACTS = [['verdant'], ['magma', 'grotto'], ['spire', 'crypt'], ['core']];
const ACT_LV = [[2, 5, 7], [8, 12, 14], [14, 18, 20], [20, 22, 25]];   // floor-1 level, last-floor level, boss level

// ---- element team traits (count on the field at battle start) -----------------------
const TRAITS = {
  ember: ['Burns last 1 more turn, +25% burn damage', 'Burns last 2 more turns, +60% burn damage'],
  tide:  ['Soak all foes at battle start', 'Soak all foes at start; allies heal 4% each turn'],
  bloom: ['Allies Regen 3% each turn', 'Allies Regen 6% each turn, +20% healing'],
  volt:  ['+12% SPD for all allies', '+25% SPD, Volt hits +10% Stun'],
  stone: ['Front row +25% DEF', 'All allies +30% DEF, front row +15% shield at start'],
  shade: ['+10% crit, crits Curse', '+20% crit, crits Curse, +20% crit damage'],
};

// ---- relics -----------------------------------------------------------------------
// b: bonus keys folded into one team bonus object at battle start (see battle.js)
const RELICS = {
  ember_heart: { n: 'Ember Heart', tags: ['inferno'], r: 1, b: { el_ember: 0.2 }, d: 'Ember attacks +20% damage.' },
  tide_pearl: { n: 'Tide Pearl', tags: ['tidal'], r: 1, b: { el_tide: 0.2 }, d: 'Tide attacks +20% damage.' },
  bloom_seed: { n: 'Evergreen Seed', tags: ['verdant'], r: 1, b: { el_bloom: 0.2 }, d: 'Bloom attacks +20% damage.' },
  volt_coil: { n: 'Volt Coil', tags: ['storm'], r: 1, b: { el_volt: 0.2 }, d: 'Volt attacks +20% damage.' },
  stone_idol: { n: 'Bedrock Idol', tags: ['bedrock'], r: 1, b: { el_stone: 0.2 }, d: 'Stone attacks +20% damage.' },
  shade_orchid: { n: 'Night Orchid', tags: ['umbral'], r: 1, b: { el_shade: 0.2 }, d: 'Shade attacks +20% damage.' },
  kindling: { n: 'Kindling Bundle', tags: ['inferno', 'status'], r: 1, b: { burnTurns: 1, burnAmp: 0.2 }, d: 'Burns last 1 more turn and hurt 20% more.' },
  brine_flask: { n: 'Brine Flask', tags: ['tidal', 'status'], r: 1, b: { soakAmp: 0.15 }, d: 'Soaked foes take 15% more from everything.' },
  toxic_vial: { n: 'Toxic Vial', tags: ['verdant', 'status'], r: 1, b: { poisonPlus: 1 }, d: 'Poison applies 1 extra stack.' },
  storm_jar: { n: 'Bottled Storm', tags: ['storm', 'status'], r: 1, b: { stunPlus: 0.1 }, d: '+10% Stun chance on Volt hits.' },
  hex_doll: { n: 'Hex Doll', tags: ['umbral', 'status'], r: 2, b: { curseAmp: 0.1, curseSpread: 1 }, d: 'Curse +10% stronger; Cursed foes spread it when they fall.' },
  fault_stone: { n: 'Fault Stone', tags: ['bedrock'], r: 1, b: { shatterAmp: 0.5 }, d: 'Shatter reactions deal 50% more.' },
  clover: { n: 'Four-Leaf Clover', tags: ['crit'], r: 1, b: { crit: 0.08 }, d: '+8% crit chance.' },
  hawk_gem: { n: 'Hawk-Eye Gem', tags: ['crit'], r: 1, b: { critDmg: 0.4 }, d: 'Crits deal 40% more.' },
  loaded_die: { n: 'Loaded Die', tags: ['crit', 'greed'], r: 2, b: { firstCrit: 1 }, d: "Each creature's first attack in a battle always crits." },
  bulwark_shell: { n: 'Bulwark Shell', tags: ['shield', 'bedrock'], r: 1, b: { startShield: 0.15 }, d: 'Battle start: shield all allies for 15% max HP.' },
  bramble_knot: { n: 'Bramble Knot', tags: ['shield', 'verdant'], r: 1, b: { thorns: 0.12 }, d: 'Attackers take 12% of the damage they deal to your shields.' },
  ironroot: { n: 'Ironroot', tags: ['shield'], r: 1, b: { defMul: 0.15 }, d: '+15% DEF for all allies.' },
  gale_feather: { n: 'Gale Feather', tags: ['swift'], r: 1, b: { spdMul: 0.1 }, d: '+10% SPD for all allies.' },
  quickglass: { n: 'Quickglass', tags: ['swift'], r: 2, b: { cdMinus: 1 }, d: 'Skill cooldowns are 1 turn shorter.' },
  tempo_drum: { n: 'Tempo Drum', tags: ['swift', 'storm'], r: 2, b: { tempo: 1 }, d: 'Every 3rd turn allies gain +30% SPD and 25 Overdrive.' },
  vamp_fang: { n: 'Vampire Fang', tags: ['vamp', 'umbral'], r: 1, b: { lifesteal: 0.08 }, d: 'All attacks heal 8% of damage dealt.' },
  chalice: { n: 'Crimson Chalice', tags: ['vamp'], r: 1, b: { killHeal: 0.15 }, d: 'A knockout heals the attacker 15% max HP.' },
  heartstone: { n: 'Heartstone', tags: ['vamp', 'shield'], r: 2, b: { overheal: 1 }, d: 'Overhealing becomes shield.' },
  tome: { n: "Trainer's Tome", tags: ['growth'], r: 1, b: { xpMul: 0.25 }, d: '+25% XP.' },
  sunstone: { n: 'Sunstone', tags: ['growth'], r: 2, b: { evoMinus: 2 }, d: 'Creatures evolve 2 levels sooner.' },
  golden_egg: { n: 'Golden Egg', tags: ['growth', 'greed'], r: 1, b: { benchXp: 1 }, d: 'Bench creatures gain full XP (normally half).' },
  purse: { n: 'Lucky Purse', tags: ['greed'], r: 1, b: { goldMul: 0.25 }, d: '+25% gold.' },
  bell: { n: "Merchant's Bell", tags: ['greed'], r: 1, b: { shopDisc: 0.2 }, d: 'Shop prices -20%.' },
  treasure_map: { n: 'Treasure Map', tags: ['greed'], r: 1, b: { relicChoice: 1 }, d: 'Relic rewards offer 1 more choice.' },
  star_shard: { n: 'Star Shard', tags: ['overdrive'], r: 1, b: { odRate: 0.3 }, d: 'Overdrive charges 30% faster.' },
  comet_core: { n: 'Comet Core', tags: ['overdrive'], r: 1, b: { ultAmp: 0.3 }, d: 'Ultimates deal 30% more.' },
  echo_chime: { n: 'Echo Chime', tags: ['overdrive', 'team'], r: 2, b: { echo: 25 }, d: 'After any ultimate, all other allies gain 25 Overdrive.' },
  rally_horn: { n: 'Rally Horn', tags: ['team'], r: 1, b: { frontAtk: 0.15 }, d: 'Front row +15% ATK.' },
  guardian_totem: { n: 'Guardian Totem', tags: ['team', 'shield'], r: 1, b: { backDR: 0.2 }, d: 'Back row takes 20% less damage.' },
  kinship_knot: { n: 'Kinship Knot', tags: ['team'], r: 2, b: { kinship: 0.05 }, d: '+5% all stats per different element on your field.' },
  pure_prism: { n: 'Pure Prism', tags: ['team'], r: 2, b: { mono: 0.3 }, d: 'If every creature on the field shares an element: +30% damage.' },
  thundercloud: { n: 'Thundercloud', tags: ['storm', 'tidal'], r: 2, b: { electroAmp: 0.6 }, d: 'Electrocute deals 60% more.' },
  geyser_stone: { n: 'Geyser Stone', tags: ['tidal', 'inferno'], r: 2, b: { steamHeal: 0.08 }, d: 'Steam reactions heal all allies 8%.' },
  blight_bulb: { n: 'Blight Bulb', tags: ['verdant', 'inferno'], r: 2, b: { blightAmp: 0.5 }, d: 'Blight Burst deals 50% more.' },
  morning_dew: { n: 'Morning Dew', tags: ['verdant'], r: 1, b: { regen: 0.03 }, d: 'Allies Regen 3% each turn.' },
  phoenix_plume: { n: 'Phoenix Plume', tags: ['inferno'], r: 2, b: { phoenix: 0.3 }, d: 'The first ally to fall each battle revives at 30%.' },
  fragile_star: { n: 'Fragile Star', tags: ['crit'], r: 2, b: { dmgMul: 0.25, hpMul: -0.15 }, d: '+25% damage, -15% max HP.' },
  mirror_pond: { n: 'Mirror Pond', tags: ['tidal', 'shield'], r: 1, b: { mirror: 0.12 }, d: '12% chance to bounce a single-target hit back.' },
  lodestone: { n: 'Lodestone', tags: ['bedrock', 'storm'], r: 1, b: { stunImmune: 1, voltDef: 0.15 }, d: 'Allies cannot be Stunned; Volt allies +15% DEF.' },
  moon_pearl: { n: 'Moon Pearl', tags: ['umbral'], r: 1, b: { shadeDodge: 0.15 }, d: 'Shade allies dodge 15% of attacks.' },
  frostcore: { n: 'Frostcore', tags: ['hazard'], r: 1, b: { immune_heat: 1 }, d: 'Ignore Scorching Heat. Burns on allies last 1 turn.' },
  lumen_moth: { n: 'Lumen Moth', tags: ['hazard'], r: 1, b: { immune_dark: 1 }, d: 'Ignore Pitch Darkness; allies cannot be Blinded.' },
  gill_pearl: { n: 'Gill Pearl', tags: ['hazard'], r: 1, b: { immune_flood: 1 }, d: 'Your team is never Soaked by the Rising Flood.' },
  incense: { n: 'Purifying Incense', tags: ['hazard'], r: 1, b: { immune_spores: 1 }, d: 'Ignore Spore Haze; cleanse allies every 3rd turn.' },
  prism_lens: { n: 'Prism Lens', tags: ['hazard'], r: 1, b: { immune_reflect: 1, crit: 0.1 }, d: 'Ignore Prismatic Echo; +10% crit.' },
  // legendary fusions (never offered directly; made at a Forge)
  supernova: { n: 'Supernova', tags: ['inferno', 'overdrive'], r: 3, leg: 1, b: { el_ember: 0.25, ultAmp: 0.3, ultBurn: 1 }, d: 'Ember +25%, ultimates +30% and always Burn every foe.' },
  tempest_engine: { n: 'Tempest Engine', tags: ['storm'], r: 3, leg: 1, b: { el_volt: 0.2, voltChain: 0.5, stunPlus: 0.1 }, d: 'Volt +20%; single Volt hits arc to another foe for 50%.' },
  leviathan_pearl: { n: 'Leviathan Pearl', tags: ['tidal'], r: 3, leg: 1, b: { el_tide: 0.25, tideHeal: 0.25 }, d: 'Tide +25%; Tide hits heal your weakest ally for 25% of the damage.' },
  world_seed: { n: 'World Seed', tags: ['verdant'], r: 3, leg: 1, b: { regen: 0.06, overheal: 1, healAmp: 0.2 }, d: 'Regen 6%, healing +20%, overheal becomes shield.' },
  mountain_heart: { n: 'Mountain Heart', tags: ['bedrock', 'shield'], r: 3, leg: 1, b: { startShield: 0.3, shieldAtk: 0.25 }, d: 'Start shielded 30%; shielded allies +25% ATK.' },
  eclipse_eye: { n: 'Eclipse Eye', tags: ['umbral', 'vamp'], r: 3, leg: 1, b: { lifesteal: 0.12, crit: 0.1, critCurse: 1 }, d: '12% lifesteal, +10% crit, crits Curse.' },
  jackpot: { n: 'Jackpot', tags: ['greed', 'crit'], r: 3, leg: 1, b: { crit: 0.12, critGold: 2, goldMul: 0.25 }, d: '+12% crit; every crit pays 2 gold; +25% gold.' },
  philosopher: { n: "Philosopher's Glimmer", tags: ['growth'], r: 3, leg: 1, b: { xpMul: 0.6, mutChoice: 1, evoMinus: 1 }, d: '+60% XP, evolve 1 level sooner, 1 more mutation choice.' },
};
for (const k in RELICS) RELICS[k].id = k;
const FUSIONS = [
  ['ember_heart', 'comet_core', 'supernova'], ['volt_coil', 'storm_jar', 'tempest_engine'],
  ['tide_pearl', 'mirror_pond', 'leviathan_pearl'], ['bloom_seed', 'morning_dew', 'world_seed'],
  ['stone_idol', 'bulwark_shell', 'mountain_heart'], ['shade_orchid', 'vamp_fang', 'eclipse_eye'],
  ['purse', 'loaded_die', 'jackpot'], ['tome', 'sunstone', 'philosopher'],
];
// three relics sharing a tag light up its set bonus
const SETS = {
  inferno: { n: 'Inferno', b: { burnAmp: 0.5 }, d: 'Burn damage +50%.' },
  tidal: { n: 'Tidal', b: { startSoak: 1 }, d: 'Soak all foes at battle start.' },
  verdant: { n: 'Verdant', b: { regen: 0.03, healAmp: 0.15 }, d: '+3% Regen, healing +15%.' },
  storm: { n: 'Storm', b: { spdMul: 0.15 }, d: '+15% SPD.' },
  bedrock: { n: 'Bedrock', b: { defMul: 0.2 }, d: '+20% DEF.' },
  umbral: { n: 'Umbral', b: { dodge: 0.08 }, d: '+8% dodge for all allies.' },
  status: { n: 'Affliction', b: { statusTurns: 1 }, d: 'Statuses you apply last 1 turn longer.' },
  crit: { n: 'Precision', b: { crit: 0.1 }, d: '+10% crit chance.' },
  shield: { n: 'Aegis', b: { shieldAmp: 0.5 }, d: 'Shields you grant are 50% stronger.' },
  swift: { n: 'Swiftness', b: { startOd: 30 }, d: 'Start battles with 30 Overdrive.' },
  vamp: { n: 'Bloodline', b: { lifesteal: 0.06 }, d: '+6% lifesteal.' },
  greed: { n: 'Hoard', b: { goldMul: 0.3 }, d: '+30% gold.' },
  growth: { n: 'Prodigy', b: { xpMul: 0.3 }, d: '+30% XP.' },
  overdrive: { n: 'Overload', b: { startOd: 40 }, d: 'Start battles with 40 Overdrive.' },
  team: { n: 'Unity', b: { atkMul: 0.1, defMul: 0.1 }, d: '+10% ATK and DEF.' },
};

// ---- charms: one per creature, stat-only (never drawn on the creature) -------------
const CHARMS = {
  fang: { n: 'Sharp Fang', b: { atk: 0.15 }, d: '+15% ATK.' },
  shell: { n: 'Hard Shell', b: { def: 0.2 }, d: '+20% DEF.' },
  plume: { n: 'Swift Plume', b: { spd: 0.15 }, d: '+15% SPD.' },
  acorn: { n: 'Vigor Acorn', b: { hp: 0.2 }, d: '+20% max HP.' },
  leaf: { n: 'Lucky Leaf', b: { crit: 0.12 }, d: '+12% crit.' },
  leech: { n: 'Leech Tooth', b: { ls: 0.12 }, d: '12% lifesteal.' },
  berry: { n: 'Leftover Berry', b: { regen: 0.05 }, d: 'Regen 5% each turn.' },
  lens: { n: 'Focus Lens', b: { cd: 1 }, d: 'Cooldowns 1 turn shorter.' },
  burr: { n: 'Thorn Burr', b: { thorns: 0.2 }, d: 'Reflect 20% of damage taken.' },
  grit: { n: 'Grit Pebble', b: { grit: 1 }, d: 'Survive one knockout at 1 HP per battle.' },
  scope: { n: 'Scope Crystal', b: { reach: 1, atk: 0.05 }, d: 'All attacks reach the back row; +5% ATK.' },
  coal: { n: 'Coal Chunk', b: { el: 'ember' }, d: 'Ember attacks +25%.' },
  seaglass: { n: 'Sea Glass', b: { el: 'tide' }, d: 'Tide attacks +25%.' },
  wildseed: { n: 'Wild Seed', b: { el: 'bloom' }, d: 'Bloom attacks +25%.' },
  magnet: { n: 'Lodestar Magnet', b: { el: 'volt' }, d: 'Volt attacks +25%.' },
  geode: { n: 'Split Geode', b: { el: 'stone' }, d: 'Stone attacks +25%.' },
  spelltag: { n: 'Spell Tag', b: { el: 'shade' }, d: 'Shade attacks +25%.' },
};
for (const k in CHARMS) CHARMS[k].id = k;

// ---- consumables --------------------------------------------------------------------
const ITEMS = {
  berry: { n: 'Heal Berry', price: 25, d: 'Heal a creature 50%. Usable in battle.', battle: 1 },
  revive: { n: 'Revive Seed', price: 45, d: 'Revive a fallen creature at 50%. Usable in battle.', battle: 1 },
  candy: { n: 'Glimmer Candy', price: 50, d: 'A creature gains 1 level.' },
  evo: { n: 'Evo Crystal', price: 90, d: 'Evolve a creature now if it is within 3 levels of evolving.' },
  bomb: { n: 'Fizz Bomb', price: 30, d: 'Battle: deal 18% max HP to every foe.', battle: 1 },
  elixir: { n: 'Clear Elixir', price: 30, d: 'Battle: cleanse your team and give +40 Overdrive.', battle: 1 },
  lure: { n: 'Lure Orb', price: 40, d: 'Battle: the next win guarantees a recruit offer (bosses excluded).', battle: 1 },
  smoke: { n: 'Smoke Puff', price: 35, d: 'Battle: flee a non-boss fight (no rewards).', battle: 1 },
};
for (const k in ITEMS) ITEMS[k].id = k;

// ---- evolution mutations --------------------------------------------------------------
const MUTS = {
  hardened: { n: 'Hardened', d: '+25% max HP.', b: { hp: 0.25 } },
  feral: { n: 'Feral', d: '+20% ATK.', b: { atk: 0.2 } },
  swift: { n: 'Swift', d: '+20% SPD.', b: { spd: 0.2 } },
  ironhide: { n: 'Ironhide', d: '+25% DEF.', b: { def: 0.25 } },
  keen: { n: 'Keen', d: '+10% crit, +30% crit damage.', b: { crit: 0.1, critDmg: 0.3 } },
  vampiric: { n: 'Vampiric', d: '10% lifesteal.', b: { ls: 0.1 } },
  overcharged: { n: 'Overcharged', d: 'Overdrive +35% faster.', b: { od: 0.35 } },
  thorny: { n: 'Thorny', d: 'Reflect 15% of damage taken.', b: { thorns: 0.15 } },
  dual: { n: 'Dual Nature', d: 'Also counts as a second element for team traits, and its attacks of that element get the same-type bonus.', b: {} },
  resonant: { n: 'Resonant', d: 'Its statuses always land (chance 100%) on its basic attack.', b: { sureStatus: 1 } },
};

// ---- tamer perks (picked after each boss) --------------------------------------------
const PERKS = {
  medic: { n: 'Field Medic', d: 'Heal your whole party 12% after every battle.' },
  coach: { n: 'Coach', d: '+25% XP.' },
  haggler: { n: 'Haggler', d: 'Shops are 15% cheaper.' },
  tactician: { n: 'Tactician', d: 'Start every battle with 25 Overdrive.' },
  collector: { n: 'Collector', d: 'Recruit offers are 50% more likely and show 1 more creature.' },
  rally: { n: 'Rallying Cry', d: '+10% ATK for all creatures.' },
  bulwark: { n: 'Bulwark', d: '+10% DEF and max HP for all creatures.' },
  pockets: { n: 'Deep Pockets', d: '+1 bench slot and 60 gold now.' },
  scout: { n: 'Scout', d: 'See every fight’s foes on the map; elites give +50% gold.' },
};

// ---- meta upgrades (Camp, bought with Glimmer Shards between runs) --------------------
const META = {
  gold: { n: 'Nest Egg', d: '+40 starting gold per rank.', max: 3, cost: [20, 40, 70] },
  bench: { n: 'Bigger Backpack', d: '+1 bench slot per rank.', max: 2, cost: [40, 90] },
  relic: { n: 'Heirloom', d: 'Start each run with a random common relic.', max: 1, cost: [50] },
  revive: { n: 'Seed Pouch', d: 'Start with 1 Revive Seed per rank.', max: 2, cost: [25, 50] },
  recruit: { n: 'Friendly Scent', d: '+10% recruit chance per rank.', max: 3, cost: [20, 35, 60] },
  starter: { n: 'Head Start', d: 'Starters begin 1 level higher per rank.', max: 2, cost: [30, 70] },
  choices: { n: 'Keen Eye', d: 'Relic rewards offer 1 more choice.', max: 1, cost: [60] },
  heal: { n: 'Second Wind', d: 'Fully heal your party after each boss.', max: 1, cost: [45] },
};

// ---- events ---------------------------------------------------------------------------
// handled in game.js by id; text lives here
const EVENTS = {
  shrine: { n: 'Mossy Shrine', t: 'A shrine hums with old power. It asks for a little life in return for a gift.',
    opts: [['Offer 20% of every creature’s HP', 'Gain a random relic'], ['Walk past', '']] },
  egg: { n: 'Abandoned Egg', t: 'A warm speckled egg sits alone in a nest of moss. Something inside taps back.',
    opts: [['Take the egg', 'A creature hatches and joins you'], ['Leave it', '']] },
  well: { n: 'Wishing Well', t: 'Coins glitter at the bottom of a glowing well.',
    opts: [['Toss in 30 gold', '60%: a relic. 40%: nothing'], ['Fish out a few coins', '+15 gold']] },
  dojo: { n: 'Sparring Ring', t: 'An old trainer offers to drill one of your creatures. Hard.',
    opts: [['Train hard', 'One creature +2 levels, but loses 30% HP'], ['Watch and learn', 'Every creature gains 25 XP']] },
  pool: { n: 'Glimmer Pool', t: 'A pool of liquid light. Creatures that drink it change.',
    opts: [['Let one drink', 'A creature gains a random mutation'], ['Rest by the pool', 'Heal everyone 30%']] },
  caravan: { n: 'Wandering Caravan', t: 'A merchant with a cart full of oddities waves you over.',
    opts: [['Browse', 'A small shop at 25% off'], ['Wave back', '']] },
  trapped: { n: 'Tangled Creature', t: 'A rare creature is caught in a snare, hissing at anyone near.',
    opts: [['Free it (it may fight)', 'Fight it; win and it joins you'], ['Leave it be', '']] },
  imp: { n: 'Gambling Imp', t: '"Double or nothing, friend?" The imp flips a golden coin.',
    opts: [['Bet half your gold', '50%: double it'], ['No thanks', '']] },
  library: { n: 'Sunken Library', t: 'Waterlogged books on taming fill the shelves.',
    opts: [['Study', 'Gain Trainer’s Tome or 60 gold'], ['Take a nap', 'Heal 20%']] },
  forge: { n: 'Ancient Forge', t: 'An anvil of glowing crystal. Two relics laid on it could become one.',
    opts: [['Use the forge', 'Fuse a known recipe, or trade a relic for a new one'], ['Leave', '']] },
};

root.GD = { EL, ELS, STRONG, eff, ROLE, STAGE_MUL, EVO_LV, SK, SP, SKILL_LV, BOSSES, BIOMES, ACTS, ACT_LV,
  TRAITS, RELICS, FUSIONS, SETS, CHARMS, ITEMS, MUTS, PERKS, META, EVENTS };
})(typeof window !== 'undefined' ? window : globalThis);
