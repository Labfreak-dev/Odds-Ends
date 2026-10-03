// Glimmerdeep data: elements, species, skills, relics, charms, items, biomes, events.
// Pure data (no DOM) so battle.js and the node sim can share it.
(function (root) {
'use strict';

const EL = {
  ember: { name: 'Ember', col: '#ff7a2a' }, tide: { name: 'Tide', col: '#2fa6ff' },
  bloom: { name: 'Bloom', col: '#4fd35a' }, volt: { name: 'Volt', col: '#ffd21f' },
  stone: { name: 'Stone', col: '#c79459' }, shade: { name: 'Shade', col: '#7d6bff' },
  frost: { name: 'Frost', col: '#8fe3ff' }, gale: { name: 'Gale', col: '#7dffc2' },
  metal: { name: 'Metal', col: '#c8d3df' }, mystic: { name: 'Mystic', col: '#d9a6ff' },
};
const ELS = Object.keys(EL);
// attacker -> defenders it hits for x1.5 (each element beats two, loses to two)
const STRONG = {
  ember: ['bloom', 'shade'], tide: ['ember', 'stone'], bloom: ['tide', 'stone'],
  volt: ['tide', 'shade'], stone: ['ember', 'volt'], shade: ['volt', 'bloom'],
  frost: ['gale', 'bloom'], gale: ['shade', 'mystic'], metal: ['frost', 'stone'], mystic: ['volt', 'metal'],
};
// g6: the four new elements also fit into the old ones' charts
STRONG.ember.push('frost'); STRONG.tide.push('metal'); STRONG.volt.push('gale'); STRONG.shade.push('mystic');
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
  // g8 bosses
  yeti_slam:    { n: 'Glacier Slam', el: 'frost', pow: 75, t: 'foes', fx: { chill: 0.6, stun: 0.2 }, d: '' },
  avalanche:    { n: 'Avalanche', el: 'frost', pow: 45, t: 'foe5', fx: { chill: 0.5 }, d: '' },
  yeti_call:    { n: 'Call the Pack', el: 'frost', t: 'self', fx: { summon: 'frst' }, d: '' },
  thunderhead:  { n: 'Thunderhead', el: 'volt', pow: 80, t: 'foe', rng: 1, fx: { stun: 0.25 }, d: '' },
  cyclone:      { n: 'Cyclone', el: 'gale', pow: 55, t: 'foes', fx: { blind: 0.6 }, d: '' },
  squall_call:  { n: 'Call the Squall', el: 'gale', t: 'self', fx: { summon: 'gash' }, d: '' },
  burrow_strike:{ n: 'Burrow Strike', el: 'stone', pow: 110, t: 'lowfoe', rng: 1, d: '' },
  dune_quake:   { n: 'Dune Quake', el: 'stone', pow: 60, t: 'foes', fx: { blind: 0.5, stun: 0.15 }, d: '' },
  sand_call:    { n: 'Call the Brood', el: 'stone', t: 'self', fx: { summon: 'stsc' }, d: '' },
  death_roll:   { n: 'Death Roll', el: 'bloom', pow: 95, t: 'foe', fx: { root: 0.5 }, d: '' },
  rot_spores:   { n: 'Rot Spores', el: 'bloom', pow: 35, t: 'foes', fx: { poison: 2 }, d: '' },
  croc_call:    { n: 'Call of the Mire', el: 'bloom', t: 'self', fx: { summon: 'tifr' }, d: '' },
  steam_ram:    { n: 'Steam Ram', el: 'metal', pow: 90, t: 'foe', fx: { shred: 0.5 }, d: '' },
  boiler_burst: { n: 'Boiler Burst', el: 'ember', pow: 60, t: 'foes', fx: { burn: 0.6 }, d: '' },
  plate_up:     { n: 'Plate Up', el: 'metal', t: 'self', fx: { shield: 0.2, defUp: 0.3 }, d: '' },
  moonbeam:     { n: 'Moonbeam', el: 'mystic', pow: 85, t: 'foe', rng: 1, fx: { hex: 0.6 }, d: '' },
  galaxy_dust:  { n: 'Galaxy Dust', el: 'mystic', pow: 40, t: 'foe6', fx: { blind: 0.3 }, d: '' },
  moth_call:    { n: 'Call the Moths', el: 'mystic', t: 'self', fx: { summon: 'mydf' }, d: '' },
  // g7 bosses
  queen_gore:   { n: 'Royal Gore', el: 'bloom', pow: 75, t: 'foe', fx: { root: 0.3 }, d: '' },
  thorn_volley: { n: 'Thorn Volley', el: 'bloom', pow: 40, t: 'foe5', fx: { poison: 1 }, d: '' },
  beetle_call:  { n: 'Call the Swarm', el: 'bloom', t: 'self', fx: { summon: 'blbe' }, d: '' },
  roc_talon:    { n: 'Storm Talon', el: 'gale', pow: 70, t: 'foe', rng: 1, fx: { blind: 0.2 }, d: '' },
  hurricane:    { n: 'Hurricane Wing', el: 'gale', pow: 55, t: 'foes', fx: { blind: 0.5 }, d: '' },
  gale_call:    { n: 'Call the Flock', el: 'gale', t: 'self', fx: { summon: 'gahu' }, d: '' },
  anvil_smash:  { n: 'Anvil Smash', el: 'metal', pow: 90, t: 'foe', fx: { shred: 0.5 }, d: '' },
  slag_wave:    { n: 'Slag Wave', el: 'ember', pow: 55, t: 'foes', fx: { burn: 0.5, shred: 0.5 }, d: '' },
  furnace_guard:{ n: 'Furnace Guard', el: 'metal', t: 'self', fx: { shield: 0.2, defUp: 0.3 }, d: '' },
  hydra_bite:   { n: 'Hydra Bite', el: 'ember', pow: 70, t: 'foe', rng: 1, fx: { burn: 0.3 }, d: '' },
  triple_breath:{ n: 'Triple Breath', el: 'ember', pow: 60, t: 'foe3', fx: { burn: 0.6 }, d: '' },
  regrow_heads: { n: 'Regrow Heads', el: 'ember', t: 'self', fx: { heal: 0.15 }, d: '' },
  maw_crunch:   { n: 'Abyss Maw', el: 'tide', pow: 110, t: 'lowfoe', rng: 1, ls: 0.3, d: '' },
  lure_glow:    { n: 'Lantern Lure', el: 'tide', pow: 30, t: 'foes', fx: { blind: 0.7, soak: 1 }, d: '' },
  abyss_call:   { n: 'Call of the Deep', el: 'tide', t: 'self', fx: { summon: 'tijl' }, d: '' },
  frost_fang:   { n: 'Rime Fang', el: 'frost', pow: 75, t: 'foe', rng: 1, fx: { chill: 0.5 }, d: '' },
  glacier_breath:{ n: 'Glacier Breath', el: 'frost', pow: 60, t: 'foes', fx: { chill: 1, soak: 0.5 }, d: '' },
  ice_armor:    { n: 'Ice Armour', el: 'frost', t: 'self', fx: { shield: 0.2 }, d: '' },
  riddle_beam:  { n: 'Riddle Beam', el: 'mystic', pow: 90, t: 'foe', rng: 1, fx: { hex: 1 }, d: '' },
  mirror_storm: { n: 'Mirror Storm', el: 'mystic', pow: 45, t: 'foe5', fx: { hex: 0.4 }, d: '' },
  arcane_ward:  { n: 'Arcane Ward', el: 'mystic', t: 'self', fx: { shield: 0.2, defUp: 0.3 }, d: '' },
  piston_claw:  { n: 'Piston Claw', el: 'metal', pow: 85, t: 'foe', fx: { shred: 0.4 }, d: '' },
  rivet_storm:  { n: 'Rivet Storm', el: 'metal', pow: 35, t: 'foe6', d: '' },
  ant_call:     { n: 'Deploy the Hive', el: 'metal', t: 'self', fx: { summon: 'mean' }, d: '' },
  chimera_maul: { n: 'Chimera Maul', el: 'shade', pow: 85, t: 'foe', fx: { curse: 0.4 }, d: '' },
  three_maws:   { n: 'Three Maws', el: 'shade', pow: 60, t: 'foe3', fx: { curse: 0.5, blind: 0.3 }, d: '' },
  dread_roar:   { n: 'Dread Roar', el: 'shade', pow: 40, t: 'foes', fx: { curse: 1 }, d: '' },
  grave_slam:   { n: 'Grave Slam', el: 'stone', pow: 70, t: 'foes', fx: { stun: 0.25 }, d: '' },
  soul_lanterns:{ n: 'Soul Lanterns', el: 'shade', pow: 40, t: 'foe5', fx: { curse: 0.3 }, d: '' },
  wisp_call:    { n: 'Lantern Call', el: 'shade', t: 'self', fx: { summon: 'wisp' }, d: '' },
  star_crush:   { n: 'Star Crush', el: 'flux', pow: 100, t: 'foe', rng: 1, fx: { hex: 0.5 }, d: '' },
  nebula_nova:  { n: 'Nebula Nova', el: 'flux', pow: 80, t: 'foes', fx: { hex: 1 }, d: '' },
  cosmic_call:  { n: 'Call the Stars', el: 'mystic', t: 'self', fx: { summon: 'mydf' }, d: '' },
  void_fist:    { n: 'Void Fist', el: 'flux', pow: 110, t: 'foe', d: '' },
  singularity:  { n: 'Singularity', el: 'flux', pow: 90, t: 'foes', fx: { stun: 0.25, shred: 0.5 }, d: '' },
  void_armor:   { n: 'Void Armour', el: 'shade', t: 'self', fx: { shield: 0.2 }, d: '' },
};
for (const k in SK) SK[k].id = k;
// skills without a written description (the bosses') get one built from their data
const T_TXT = { foe: 'Hits one foe', lowfoe: 'Hits the weakest foe', foes: 'Hits a wide area', foe3: '3 hits on random foes', foe5: '5 hits on random foes', foe6: '6 hits on random foes', self: 'Self', ally: 'The weakest ally', allies: 'All allies' };
const FX_TXT = { burn: 'Burn', soak: 'Soak', poison: 'Poison', stun: 'Stun', root: 'Root', curse: 'Curse', blind: 'Blind', chill: 'Chill', shred: 'Shred', hex: 'Hex' };
for (const k in SK) {
  const sk = SK[k];
  if (sk.d) continue;
  const fx = sk.fx || {}, bits = [];
  for (const f in FX_TXT) if (fx[f] != null) bits.push(f === 'poison' ? `+${fx[f]} Poison` : fx[f] >= 1 ? FX_TXT[f] + 's' : Math.round(fx[f] * 100) + '% ' + FX_TXT[f]);
  if (fx.summon) bits.push('summons an ally');
  if (fx.heal) bits.push(`heals ${Math.round(fx.heal * 100)}%`);
  if (fx.shield) bits.push(`shield ${Math.round(fx.shield * 100)}%`);
  if (fx.defUp) bits.push(`+${Math.round(fx.defUp * 100)}% DEF`);
  if (sk.ls) bits.push(`drains ${Math.round(sk.ls * 100)}% of the damage`);
  sk.d = (T_TXT[sk.t] || '') + (sk.pow ? ` (power ${sk.pow})` : '') + (bits.length ? ': ' + bits.join(', ') : '') + '.';
}

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
  bramble: { name: 'Mother Bramble', el: 'bloom', art: 'boss_bramble', hp: 5.15, atk: 1.1, def: 1.2, spd: 0.8, sk: ['thorn_whip', 'spore_storm', 'sprout_call', 'heart_bloom'], pd: 'Calls sprouts to her side and heals herself.' },
  cinder:  { name: 'Cinderking', el: 'ember', art: 'boss_cinder', hp: 5.31, atk: 1.25, def: 1.3, spd: 0.75, sk: ['magma_fist', 'eruption', 'molten_armor'], pd: 'Molten armour: shields himself and sets the field alight.' },
  eel:     { name: 'Abyssqueen', el: 'tide', art: 'boss_eel', hp: 7.19, atk: 1.2, def: 1.1, spd: 1.1, sk: ['thunder_fang', 'tidal_coil', 'static_field'], pd: 'Soaks your team, then electrocutes it.' },
  prism:   { name: 'Prism Sentinel', el: 'stone', art: 'boss_prism', hp: 17.34, atk: 1.2, def: 1.5, spd: 0.8, sk: ['shard_volley', 'crystal_beam', 'prism_guard'], passive: { dr: 0.1 }, pd: 'Crystal body: takes 10% less damage.' },
  grim:    { name: 'Grimhoot', el: 'shade', art: 'boss_grim', hp: 4.53, atk: 1.25, def: 1.1, spd: 1.05, sk: ['night_terror', 'hex_gaze', 'soul_drain', 'bat_call'], pd: 'Curses your team and calls bats.' },
  thornqueen: { name: 'Thornback Queen', el: 'bloom', art: 'boss_thornqueen', hp: 3.80, atk: 1.15, def: 1.3, spd: 0.8, sk: ['queen_gore', 'thorn_volley', 'beetle_call'], passive: { thorns: 0.2 }, pd: 'Thorned carapace: reflects 20% of the damage she takes.' },
  tempestroc: { name: 'Tempest Roc', el: 'gale', art: 'boss_tempestroc', hp: 3.11, atk: 1.25, def: 1, spd: 1.15, sk: ['roc_talon', 'hurricane', 'gale_call'], passive: { dodge: 0.2 }, pd: 'Rides the storm: dodges 20% of attacks.' },
  forgeheart: { name: 'Forgeheart Colossus', el: 'metal', art: 'boss_forgeheart', hp: 3.74, atk: 1.2, def: 1.6, spd: 0.7, sk: ['anvil_smash', 'slag_wave', 'furnace_guard'], passive: { dr: 0.2 }, pd: 'Iron hide: takes 20% less damage.' },
  ashhydra: { name: 'Ashen Hydra', el: 'ember', art: 'boss_ashhydra', hp: 3.60, atk: 1.3, def: 1.1, spd: 0.9, sk: ['hydra_bite', 'triple_breath', 'regrow_heads'], passive: { regen: 0.012 }, pd: 'Regrows its heads: heals 1.2% every second.' },
  deepmaw: { name: 'Deepmaw Matriarch', el: 'tide', art: 'boss_deepmaw', hp: 3.69, atk: 1.3, def: 1, spd: 0.85, sk: ['maw_crunch', 'lure_glow', 'abyss_call'], passive: { ls: 0.15 }, pd: 'Endless hunger: heals 15% of the damage she deals.' },
  rimeleviathan: { name: 'Rime Leviathan', el: 'frost', art: 'boss_rimeleviathan', hp: 4.05, atk: 1.2, def: 1.2, spd: 0.95, sk: ['frost_fang', 'glacier_breath', 'ice_armor'], passive: { frostAura: 6 }, pd: 'Frozen sea: Chills your whole team for 6 seconds at the start.' },
  mirrorsphinx: { name: 'Mirror Sphinx', el: 'mystic', art: 'boss_mirrorsphinx', hp: 4.11, atk: 1.15, def: 1.4, spd: 0.85, sk: ['riddle_beam', 'mirror_storm', 'arcane_ward'], passive: { reflect: 0.2 }, pd: 'Mirrored wings: reflects 20% of single hits back at the attacker.' },
  geartyrant: { name: 'Gear Tyrant', el: 'metal', art: 'boss_geartyrant', hp: 3.97, atk: 1.2, def: 1.5, spd: 0.8, sk: ['piston_claw', 'rivet_storm', 'ant_call'], passive: { dr: 0.15 }, pd: 'Riveted plates: takes 15% less damage.' },
  eclipsechimera: { name: 'Eclipse Chimera', el: 'shade', art: 'boss_eclipsechimera', hp: 5.09, atk: 1.3, def: 1.1, spd: 1.05, sk: ['chimera_maul', 'three_maws', 'dread_roar'], passive: { ls: 0.15 }, pd: 'Three hungry heads: heals 15% of the damage it deals.' },
  hollowcolossus: { name: 'Hollow Colossus', el: 'shade', art: 'boss_hollowcolossus', hp: 3.63, atk: 1.2, def: 1.4, spd: 0.75, sk: ['grave_slam', 'soul_lanterns', 'wisp_call'], passive: { thorns: 0.15 }, pd: 'Haunted stone: reflects 15% of the damage it takes.' },
  astralbehemoth: { name: 'Astral Behemoth', el: 'mystic', flux: 1, art: 'boss_astralbehemoth', hp: 2.83, atk: 1.3, def: 1.3, spd: 0.9, sk: ['star_crush', 'nebula_nova', 'cosmic_call'], passive: { regen: 0.008 }, pd: 'Shifts element every 4 seconds; regenerates 0.8% a second.' },
  voidtitan: { name: 'Void Titan', el: 'shade', flux: 1, art: 'boss_voidtitan', hp: 3.33, atk: 1.4, def: 1.3, spd: 0.85, sk: ['void_fist', 'singularity', 'void_armor'], passive: { dr: 0.15 }, pd: 'Shifts element every 4 seconds; takes 15% less damage.' },
  yeti: { name: 'Yeti Monarch', el: 'frost', art: 'boss_yeti', hp: 3.86, atk: 1.25, def: 1.3, spd: 0.85, sk: ['yeti_slam', 'avalanche', 'yeti_call'], passive: { dr: 0.1 }, pd: 'Thick fur: takes 10% less damage; calls ice stoats.' },
  nimbus: { name: 'Stormheart Nimbus', el: 'gale', art: 'boss_nimbus', hp: 4.14, atk: 1.25, def: 1.1, spd: 1.1, sk: ['thunderhead', 'cyclone', 'squall_call'], passive: { dodge: 0.2 }, pd: 'Body of cloud: dodges 20% of attacks.' },
  sandworm: { name: 'Sandworm Tyrant', el: 'stone', art: 'boss_sandworm', hp: 3.90, atk: 1.3, def: 1.3, spd: 0.85, sk: ['burrow_strike', 'dune_quake', 'sand_call'], passive: { thorns: 0.15 }, pd: 'Grinding plates: reflects 15% of the damage it takes.' },
  mirecroc: { name: 'Mirecroc Matriarch', el: 'bloom', art: 'boss_mirecroc', hp: 3.82, atk: 1.3, def: 1.2, spd: 0.85, sk: ['death_roll', 'rot_spores', 'croc_call'], passive: { regen: 0.01 }, pd: 'Swamp-fed: regenerates 1% HP a second.' },
  juggernaut: { name: 'Ironshell Juggernaut', el: 'metal', art: 'boss_juggernaut', hp: 3.04, atk: 1.2, def: 1.6, spd: 0.75, sk: ['steam_ram', 'boiler_burst', 'plate_up'], passive: { dr: 0.2 }, pd: 'Iron shell: takes 20% less damage.' },
  astralmoth: { name: 'Astral Moth Empress', el: 'mystic', art: 'boss_astralmoth', hp: 3.03, atk: 1.25, def: 1.1, spd: 1, sk: ['moonbeam', 'galaxy_dust', 'moth_call'], passive: { ls: 0.12 }, pd: 'Drinks starlight: heals 12% of the damage she deals.' },
  wyrm:    { name: 'The Glimmerwyrm', el: 'ember', flux: 1, art: 'boss_wyrm', hp: 3.73, atk: 1.35, def: 1.35, spd: 1, sk: ['wyrm_bite', 'flux_breath', 'cataclysm', 'crystal_scale'], pd: 'Shifts element every 4 seconds.' },
};

// ---- biomes and hazards ---------------------------------------------------------
const BIOMES = {
  verdant: { name: 'Verdant Hollow', bg: 'bg_verdant', els: ['bloom', 'volt', 'tide', 'ember', 'gale', 'bloom'], boss: 'bramble', bosses: ['bramble', 'thornqueen', 'tempestroc'], haz: 'spores',
    hazName: 'Spore Haze', hazDesc: 'Every 3 seconds your non-Bloom creatures gain 1 Poison.', counter: 'Bloom creatures, Purifying Incense, cleanses' },
  magma:   { name: 'Magma Forge', bg: 'bg_magma', els: ['ember', 'stone', 'ember', 'volt', 'metal', 'metal'], boss: 'cinder', bosses: ['cinder', 'forgeheart', 'ashhydra'], haz: 'heat',
    hazName: 'Scorching Heat', hazDesc: 'Your creatures that are not Ember or Stone lose 1.2% HP every second (Tide: half).', counter: 'Tide creatures (2× vs Ember), Frostcore, healers' },
  grotto:  { name: 'Sunken Grotto', bg: 'bg_grotto', els: ['tide', 'volt', 'tide', 'bloom', 'frost', 'gale'], boss: 'eel', bosses: ['eel', 'deepmaw', 'rimeleviathan'], haz: 'flood',
    hazName: 'Rising Flood', hazDesc: 'Everyone is permanently Soaked: Volt hits Electrocute, Ember deals 40% less.', counter: 'Volt and Bloom creatures, Gill Pearl' },
  spire:   { name: 'Crystal Spire', bg: 'bg_spire', els: ['stone', 'volt', 'stone', 'frost', 'metal', 'mystic'], boss: 'prism', bosses: ['prism', 'mirrorsphinx', 'geartyrant'], haz: 'reflect',
    hazName: 'Prismatic Echo', hazDesc: 'Foes reflect 20% of single-target damage back at the attacker.', counter: 'Hit-all skills, Prism Lens, lifesteal' },
  crypt:   { name: 'Shadow Crypt', bg: 'bg_crypt', els: ['shade', 'ember', 'shade', 'mystic', 'frost', 'gale'], boss: 'grim', bosses: ['grim', 'eclipsechimera', 'hollowcolossus'], haz: 'dark',
    hazName: 'Pitch Darkness', hazDesc: 'Your non-Shade creatures miss 25% of attacks. An Ember hit lights the room for 2 seconds.', counter: 'Shade and Ember creatures, Lumen Moth' },
  tundra:  { name: 'Frozen Tundra', bg: 'bg_tundra', els: ['frost', 'frost', 'tide', 'metal', 'gale', 'stone'], boss: 'yeti', bosses: ['yeti', 'rimeleviathan', 'hollowcolossus'], haz: 'blizzard',
    hazName: 'Blizzard', hazDesc: 'Every 4 seconds your non-Frost creatures are Chilled for 2 seconds.', counter: 'Frost and Ember creatures, Hearthstone' },
  skyisles: { name: 'Sky Isles', bg: 'bg_skyisles', els: ['gale', 'gale', 'volt', 'mystic', 'bloom', 'tide'], boss: 'nimbus', bosses: ['nimbus', 'tempestroc', 'astralbehemoth'], haz: 'gusts',
    hazName: 'Howling Gusts', hazDesc: 'Every 5 seconds a gust may blow each of your creatures one cell back.', counter: 'Gale, Metal and Stone creatures, Anchor Stone, ranged teams' },
  dunes:   { name: 'Sunscorched Dunes', bg: 'bg_dunes', els: ['stone', 'stone', 'ember', 'metal', 'gale', 'shade'], boss: 'sandworm', bosses: ['sandworm', 'ashhydra', 'prism'], haz: 'sandstorm',
    hazName: 'Sandstorm', hazDesc: 'Every 5 seconds your non-Stone creatures are Blinded for 2 seconds.', counter: 'Stone and Gale creatures, Desert Veil' },
  mire:    { name: 'Gloomwater Mire', bg: 'bg_mire', els: ['bloom', 'bloom', 'shade', 'tide', 'frost', 'mystic'], boss: 'mirecroc', bosses: ['mirecroc', 'thornqueen', 'deepmaw'], haz: 'bog',
    hazName: 'Sucking Bog', hazDesc: 'Your creatures move at half speed and start Rooted for 2 seconds.', counter: 'Ranged teams, Bloom and Gale creatures, Marsh Charm' },
  foundry: { name: 'Iron Foundry', bg: 'bg_foundry', els: ['metal', 'metal', 'ember', 'volt', 'stone', 'frost'], boss: 'juggernaut', bosses: ['juggernaut', 'forgeheart', 'geartyrant'], haz: 'magnetic',
    hazName: 'Magnetic Field', hazDesc: "Your creatures' skills cost 25% more mana (Metal creatures are immune).", counter: 'Metal and Mystic creatures, Grounding Rod, basic-attack teams' },
  observatory: { name: 'Starfall Observatory', bg: 'bg_observatory', els: ['mystic', 'mystic', 'shade', 'gale', 'volt', 'frost'], boss: 'astralmoth', bosses: ['astralmoth', 'mirrorsphinx', 'eclipsechimera'], haz: 'starfall',
    hazName: 'Starfall', hazDesc: 'Every 6 seconds a falling star strikes one of your creatures for 8% of its HP.', counter: 'Healers and shields, Star Ward' },
  core:    { name: 'The Glimmer Core', bg: 'bg_core', els: ['ember', 'tide', 'bloom', 'volt', 'stone', 'shade', 'frost', 'gale', 'metal', 'mystic'], boss: 'wyrm', bosses: ['wyrm', 'astralbehemoth', 'voidtitan'], haz: 'flux',
    hazName: 'Elemental Flux', hazDesc: 'Foes change element every 4 seconds. A mixed team copes best.', counter: 'A mixed team, Kinship Knot' },
};
const ACTS = [['verdant'], ['magma', 'grotto'], ['spire', 'crypt'], ['core']];   // pre-g8 route, kept for reference
// g8: six stages. Stage 1 is the Verdant Hollow, the last is the Glimmer Core; in between you
// pick one of two biomes you have not visited yet.
const MID_BIOMES = ['magma', 'grotto', 'spire', 'crypt', 'tundra', 'skyisles', 'dunes', 'mire', 'foundry', 'observatory'];
const ACT_LV = [[2, 5, 7], [8, 12, 14], [14, 18, 20], [20, 22, 25]];   // floor-1 level, last-floor level, boss level

// ---- element team traits (count on the field at battle start) -----------------------
const TRAITS = {
  ember: ['Burns last 1 more turn, +25% burn damage', 'Burns last 2 more turns, +60% burn damage'],
  tide:  ['Soak every foe at the start', 'Soak every foe at the start; allies heal 1% a second'],
  bloom: ['Allies regenerate 1% HP a second', 'Allies regenerate 2% a second, healing +20%'],
  volt:  ['+12% attack speed for all allies', '+25% attack speed, Volt hits +10% Stun'],
  stone: ['Front column +25% DEF', 'All allies +30% DEF; front column starts with a 15% shield'],
  shade: ['+10% crit, crits Curse', '+20% crit, crits Curse, +20% crit damage'],
  frost: ['Foes start Chilled for 4 seconds', 'Foes start Chilled for 8 seconds; +15% damage to Chilled foes'],
  gale:  ['Allies dodge 12% of attacks', 'Allies dodge 22% of attacks and attack 15% faster'],
  metal: ['Allies take 10% less damage', 'Allies take 20% less damage and reflect 10% of it'],
  mystic: ['Allies gain 30% more mana', 'Allies gain 60% more mana and start with 30'],
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
  frost_shard: { n: 'Frost Shard', tags: ['status'], r: 1, b: { el_frost: 0.2 }, d: 'Frost attacks +20% damage.' },
  wind_bell: { n: 'Wind Bell', tags: ['swift'], r: 1, b: { el_gale: 0.2 }, d: 'Gale attacks +20% damage.' },
  iron_core: { n: 'Iron Core', tags: ['shield'], r: 1, b: { el_metal: 0.2 }, d: 'Metal attacks +20% damage.' },
  moon_charm: { n: 'Moon Charm', tags: ['overdrive'], r: 1, b: { el_mystic: 0.2 }, d: 'Mystic attacks +20% damage.' },
  hearthstone: { n: 'Hearthstone', tags: ['hazard'], r: 1, b: { immune_blizzard: 1 }, d: 'Ignore the Blizzard; your creatures cannot be Chilled.' },
  anchor_stone: { n: 'Anchor Stone', tags: ['hazard'], r: 1, b: { immune_gusts: 1, defMul: 0.05 }, d: 'Ignore Howling Gusts; +5% DEF.' },
  desert_veil: { n: 'Desert Veil', tags: ['hazard'], r: 1, b: { immune_sandstorm: 1 }, d: 'Ignore the Sandstorm.' },
  marsh_charm: { n: 'Marsh Charm', tags: ['hazard'], r: 1, b: { immune_bog: 1 }, d: 'Ignore the Sucking Bog.' },
  grounding_rod: { n: 'Grounding Rod', tags: ['hazard'], r: 1, b: { immune_magnetic: 1 }, d: 'Ignore the Magnetic Field.' },
  star_ward: { n: 'Star Ward', tags: ['hazard'], r: 1, b: { immune_starfall: 1 }, d: 'Ignore Starfall.' },
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
  icecube: { n: 'Ever-Ice', b: { el: 'frost' }, d: 'Frost attacks +25%.' },
  galeleaf: { n: 'Gale Leaf', b: { el: 'gale' }, d: 'Gale attacks +25%.' },
  ingot: { n: 'Steel Ingot', b: { el: 'metal' }, d: 'Metal attacks +25%.' },
  moonstone: { n: 'Moonstone', b: { el: 'mystic' }, d: 'Mystic attacks +25%.' },
};
for (const k in CHARMS) CHARMS[k].id = k;

// ---- consumables --------------------------------------------------------------------
const ITEMS = {
  berry: { n: 'Heal Berry', price: 3, d: 'Heal 10 HP.' },
  revive: { n: 'Revive Seed', price: 6, d: 'Heal 25 HP.' },
  candy: { n: 'Glimmer Candy', price: 4, d: '+4 Tamer XP.' },
  evo: { n: 'Evo Crystal', price: 8, d: 'Upgrade a ★1 creature to ★2 on the spot.' },
  bomb: { n: 'Fizz Bomb', price: 3, d: 'Next fight: every foe starts at 80% HP.' },
  elixir: { n: 'Clear Elixir', price: 3, d: 'Next fight: your creatures start with 60 mana.' },
  lure: { n: 'Lure Orb', price: 3, d: 'Your next shop shows only species you already own.' },
  smoke: { n: 'Smoke Puff', price: 4, d: 'Next fight: if you lose, you lose no HP.' },
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
  medic: { n: 'Field Medic', d: 'Lose 30% less HP from lost fights.' },
  coach: { n: 'Coach', d: '+2 Tamer XP every round.' },
  haggler: { n: 'Haggler', d: 'Rerolls cost 1 gold less.' },
  tactician: { n: 'Tactician', d: 'Your creatures start every fight with 25 mana.' },
  collector: { n: 'Collector', d: 'Your shop shows 6 creatures.' },
  rally: { n: 'Rallying Cry', d: '+10% ATK for all creatures.' },
  bulwark: { n: 'Bulwark', d: '+10% DEF and max HP for all creatures.' },
  pockets: { n: 'Deep Pockets', d: '+2 gold every round and 10 gold now.' },
  scout: { n: 'Streaker', d: 'Win and loss streaks pay 1 extra gold.' },
};

// ---- meta upgrades (Camp, bought with Glimmer Shards between runs) --------------------
// Ranks past the first few get steep on purpose: they are the long-term chase for Depth runs.
// cb: the per-rank bonus fed into every fight (chess.js teamBonus keys)
const META = {
  gold: { n: 'Nest Egg', d: '+2 starting gold per rank.', max: 5, cost: [20, 40, 70, 160, 280] },
  hide: { n: 'Thick Hide', d: '+10 max HP per rank.', max: 5, cost: [40, 90, 180, 300, 450] },
  relic: { n: 'Heirloom', d: 'Start each run with a random common relic (rank 2: two).', max: 2, cost: [50, 320] },
  drill: { n: 'Training Drills', d: 'Your creatures get +2% HP and ATK per rank.', max: 5, cost: [90, 160, 260, 400, 600], cb: { hpMul: 0.02, atkMul: 0.02 } },
  scales: { n: 'Hardened Scales', d: 'Your creatures get +3% DEF per rank.', max: 3, cost: [80, 170, 300], cb: { defMul: 0.03 } },
  focus: { n: 'Focus Crystal', d: 'Your creatures start each fight with +5 mana per rank.', max: 3, cost: [100, 200, 340], cb: { startOd: 5 } },
  instinct: { n: 'Killer Instinct', d: '+2% crit chance per rank.', max: 3, cost: [90, 190, 320], cb: { crit: 0.02 } },
  jar: { n: 'Savings Jar', d: 'Interest cap +1 per rank (you can earn up to 7 interest).', max: 2, cost: [150, 300], cb: { interestCap: 1 } },
  study: { n: 'Field Notes', d: '+1 Tamer XP every round.', max: 1, cost: [350], cb: { xpRound: 1 } },
  kindred: { n: 'Kindred Call', d: 'Shop slots offer a species you own 8% more often per rank.', max: 2, cost: [140, 280] },
  lucky: { n: 'Lucky Coin', d: 'Rerolls cost 1 gold less.', max: 1, cost: [500], cb: { rerollDisc: 1 } },
  hoard: { n: 'Glimmer Hoard', d: '+10% Glimmer Shards from runs per rank.', max: 3, cost: [120, 240, 400] },
  // The Wilds (mode: 'wilds'): wb is a per-rank bonus for Wilds battles only
  w_pack: { mode: 'wilds', n: 'Bigger Pack', d: 'Bring 1 more creature on an expedition per rank.', max: 2, cost: [150, 350] },
  w_medic: { mode: 'wilds', n: 'Medic Kit', d: 'Start each expedition with 1 more Glim Tonic per rank.', max: 3, cost: [70, 150, 260] },
  w_ration: { mode: 'wilds', n: 'Trail Rations', d: 'Your squad gets +4% HP and ATK per rank in Wilds battles.', max: 5, cost: [90, 160, 250, 370, 520], wb: { hpMul: 0.04, atkMul: 0.04 } },
  w_mentor: { mode: 'wilds', n: 'Field Mentor', d: 'Your squad evolves faster: ★2 at 3 wins, ★3 at 9.', max: 1, cost: [260] },
  w_map: { mode: 'wilds', n: 'Cartographer', d: 'See each floor\'s layout when you arrive (rank 2: secret rooms too).', max: 2, cost: [120, 280] },
  w_relic: { mode: 'wilds', n: 'Relic Hunter', d: 'Start each expedition with a random Wilds relic.', max: 1, cost: [300] },
  w_luck: { mode: 'wilds', n: 'Treasure Sense', d: 'Chests hold 50% more shards per rank, and are likelier to hold a relic.', max: 2, cost: [100, 220] },
  w_spring: { mode: 'wilds', n: 'Deep Springs', d: 'Going down the stairs heals 15% more per rank.', max: 2, cost: [90, 200] },
  evo: { n: 'Seed Pouch', d: 'Start each run with an Evo Crystal.', max: 1, cost: [35] },
  shiny: { n: 'Shiny Charm', d: 'Shiny creatures turn up 3× as often, in the shop and in the Wilds.', max: 1, cost: [30] },
  starter: { n: 'Head Start', d: 'Begin at Tamer level 2, then 3.', max: 2, cost: [30, 70] },
  choices: { n: 'Keen Eye', d: 'Relic rewards offer 1 more choice.', max: 1, cost: [60] },
  heal: { n: 'Second Wind', d: 'Heal 15 HP after each boss you beat.', max: 1, cost: [45] },
};

// ---- Wilds relics: found on an expedition, kept until it ends ----------------------------------
// b: bonus for Wilds battles (chess.js teamBonus keys); w: an exploration effect handled in wilds.js
const WILD_RELICS = {
  blaze_totem: { n: 'Blaze Totem', ic: 'rl_ember_heart', d: 'Your squad gets +12% ATK.', b: { atkMul: 0.12 } },
  stone_idol: { n: 'Stone Idol', ic: 'rl_stone_idol', d: 'Your squad gets +12% HP and DEF.', b: { hpMul: 0.12, defMul: 0.12 } },
  swift_plume: { n: 'Swift Plume', ic: 'rl_gale_feather', d: 'Your squad attacks 15% faster.', b: { asMul: 0.15 } },
  moon_charm: { n: 'Moon Charm', ic: 'rl_moon_charm', d: 'Your squad starts each battle with +20 mana.', b: { startOd: 20 } },
  four_leaf: { n: 'Four-Leaf Clover', ic: 'rl_clover', d: '+8% crit chance.', b: { crit: 0.08 } },
  vamp_fang: { n: 'Vampire Fang', ic: 'rl_vamp_fang', d: 'Your squad heals for 10% of the damage it deals.', b: { lsAll: 0.1 } },
  bramble_mail: { n: 'Bramble Mail', ic: 'rl_bramble_knot', d: 'Attackers take 15% of the damage they deal back.', b: { thornsAll: 0.15 } },
  bloom_seed: { n: 'Bloom Seed', ic: 'rl_bloom_seed', d: 'After each win your squad heals 12%.', w: { winHeal: 0.12 } },
  lantern: { n: 'Scout\'s Map', ic: 'rl_treasure_map', d: 'Reveals every floor, secret rooms included.', w: { map: 2 } },
  iron_boots: { n: 'Iron Boots', ic: 'rl_ironroot', d: 'Spike traps cannot hurt you.', w: { spikeproof: 1 } },
  lucky_purse: { n: 'Lucky Purse', ic: 'rl_purse', d: '+50% shards from battles and chests.', w: { shardMul: 0.5 } },
  bond_knot: { n: 'Bond Knot', ic: 'rl_kinship_knot', d: 'Your squad gains 1 extra XP per win.', w: { xp: 1 } },
  phoenix: { n: 'Phoenix Plume', ic: 'rl_phoenix_plume', d: 'The first time your whole squad would faint, everyone gets back up at 40% HP.', w: { phoenix: 1 } },
  potion_belt: { n: 'Potion Belt', ic: 'rl_brine_flask', d: 'Glim Tonics heal 65% instead of 40%.', w: { tonic: 0.25 } },
  skeleton_key: { n: 'Skeleton Key', ic: 'wd_key', d: 'Vault doors open without a key.', w: { skeleton: 1 } },
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


// ---- auto chess --------------------------------------------------------------------
// shop tier (= gold cost), attack range in cells, attack speed by role
const TIER = { cind: 1, bubb: 1, sprt: 1, pebb: 1, pyrp: 2, shel: 2, sprk: 2, dusk: 2, moss: 3, buzz: 3, crys: 3, wisp: 3 };
const RANGE = { cind: 1, pyrp: 3, bubb: 3, shel: 1, sprt: 2, moss: 2, sprk: 1, buzz: 3, pebb: 1, crys: 1, wisp: 1, dusk: 3 };
const ROLE_AS = { striker: 0.9, caster: 0.7, tank: 0.6, support: 0.7 };
const BOSS_RANGE = { bramble: 2, cinder: 1, eel: 3, prism: 2, grim: 3, wyrm: 2, thornqueen: 1, tempestroc: 3, forgeheart: 1, ashhydra: 2, deepmaw: 2,
  rimeleviathan: 3, mirrorsphinx: 3, geartyrant: 2, eclipsechimera: 1, hollowcolossus: 1, astralbehemoth: 3, voidtitan: 2,
  yeti: 1, nimbus: 3, sandworm: 2, mirecroc: 1, juggernaut: 1, astralmoth: 3 };
const POOL = [0, 22, 18, 14, 10, 8];               // copies of each species in the shared pool, by tier
// shop odds (tier 1/2/3) by Tamer level 1-9
const ODDS = [null, [100, 0, 0, 0, 0], [100, 0, 0, 0, 0], [75, 25, 0, 0, 0], [55, 30, 15, 0, 0], [45, 33, 20, 2, 0],
  [30, 40, 25, 5, 0], [19, 30, 35, 15, 1], [15, 20, 35, 25, 5], [10, 15, 30, 30, 15]];
const TXP = [0, 2, 2, 6, 10, 20, 36, 56, 80];       // XP to go from level n to n+1
const ROLE_TRAITS = {
  striker: { n: 'Striker', at: [2, 4], d: ['+15% attack speed', '+40% attack speed'] },
  caster: { n: 'Caster', at: [2, 4], d: ['Skills deal 20% more', 'Skills deal 45% more and cost 15% less mana'] },
  tank: { n: 'Guardian', at: [2, 4], d: ['Guardians start with a 20% max-HP shield', 'Guardians start with a 40% shield; all allies +20% DEF'] },
  support: { n: 'Support', at: [2, 4], d: ['Healing and shields 30% stronger; allies start with 20 mana', 'Healing and shields 60% stronger; allies start with 40 mana'] },
};
const EL_AT = [2, 4];   // element traits count different species (a Dual Nature creature counts twice)

// ---- g6: 60 more species (species2.js, generated by tools/species2.py) ----------------
// Each gets four skills from its role's kit; the element sets the status it inflicts and the
// names come from that element's word banks, cycled so neighbours differ.
const ELST = { ember: 'burn', tide: 'soak', bloom: 'poison', volt: 'stun', stone: null, shade: 'curse', frost: 'chill', gale: 'blind', metal: 'shred', mystic: 'hex' };
const ST_WORD = { burn: 'Burn', soak: 'Soak', poison: 'Poison', stun: 'Stun', curse: 'Curse', chill: 'Chill', blind: 'Blind', shred: 'Shred', hex: 'Hex' };
function kitFx(el, ch) {
  const st = ELST[el];
  if (!st) return {};
  if (st === 'poison') return { poison: ch >= 1 ? 2 : 1 };
  return { [st]: st === 'stun' ? Math.round(ch * 40) / 100 : ch };
}
function kitText(el, ch) {
  const st = ELST[el];
  if (!st) return ' +15% crit.';
  if (st === 'poison') return ` +${ch >= 1 ? 2 : 1} Poison.`;
  const c = st === 'stun' ? Math.round(ch * 40) : Math.round(ch * 100);
  return c >= 100 ? ` Always ${ST_WORD[st]}s.` : ` ${c}% ${ST_WORD[st]}.`;
}
function buildKit(sp, i) {
  const { k, el, role } = sp, N = (root.GD_NAMES2 || {})[el] || {};
  const nm = (bank, j) => { const b = N[bank] || ['Strike']; return b[(i + (j || 0)) % b.length]; };
  const crit = ELST[el] ? 0 : 0.15;
  const mk = (id, o) => { SK[id] = Object.assign({ id, el }, o); if (crit && o.pow) SK[id].crit = (SK[id].crit || 0) + crit; return id; };
  const R = sp.range > 1 ? 1 : 0;
  if (role === 'striker') return [
    mk(k + '_b', { n: nm('basic'), pow: 60, t: 'foe', rng: R, fx: kitFx(el, 0.2), d: 'Basic attack.' + kitText(el, 0.2) }),
    mk(k + '_a', { n: nm('single'), pow: 95, t: 'foe', rng: R, cd: 2, fx: kitFx(el, 0.6), d: 'Heavy hit.' + kitText(el, 0.6) }),
    mk(k + '_c', { n: nm('buff'), t: 'self', cd: 3, fx: { atkUp: 0.3, spdUp: 0.2 }, d: 'Self: +30% ATK and +20% speed.' }),
    mk(k + '_u', { n: nm('ult'), pow: 210, t: (el === 'gale' || el === 'shade') ? 'lowfoe' : 'foe', rng: 1, ult: 1, exec: el === 'shade' ? 0.25 : 0, fx: kitFx(el, 1), d: 'ULT: a huge hit' + ((el === 'gale' || el === 'shade') ? ' on the weakest foe.' : '.') + kitText(el, 1) }),
  ];
  if (role === 'caster') return [
    mk(k + '_b', { n: nm('basic'), pow: 55, t: 'foe', rng: 1, fx: kitFx(el, 0.15), d: 'Ranged.' + kitText(el, 0.15) }),
    mk(k + '_a', { n: nm('splash'), pow: 50, t: 'foes', cd: 2, fx: kitFx(el, 0.4), d: 'Hits the target and foes near it.' + kitText(el, 0.4) }),
    mk(k + '_c', { n: nm('volley'), pow: 42, t: 'foe3', cd: 3, fx: kitFx(el, 0.3), d: '3 hits on random foes.' + kitText(el, 0.3) }),
    mk(k + '_u', { n: nm('ult'), pow: 115, t: 'foes', ult: 1, fx: kitFx(el, 1), d: 'ULT: blast a wide area.' + kitText(el, 1) }),
  ];
  if (role === 'tank') return [
    mk(k + '_b', { n: nm('basic'), pow: 55, t: 'foe', fx: kitFx(el, 0.25), d: 'Basic attack.' + kitText(el, 0.25) }),
    mk(k + '_a', { n: nm('taunt'), t: 'self', cd: 3, fx: { taunt: 2, defUp: 0.4 }, d: 'Taunt nearby foes, +40% DEF.' }),
    mk(k + '_c', { n: nm('splash'), pow: 55, t: 'foes', cd: 2, fx: kitFx(el, 0.5), d: 'Hits the target and foes near it.' + kitText(el, 0.5) }),
    mk(k + '_u', { n: nm('ult'), pow: 90, t: 'foes', ult: 1, fx: Object.assign({ selfShield: 0.3 }, ELST[el] === 'stun' ? { stun: 0.5 } : Object.assign({ stun: 0.25 }, kitFx(el, 1))), d: 'ULT: slam a wide area, 25% Stun, shield self 30%.' + (ELST[el] && ELST[el] !== 'stun' ? kitText(el, 1) : '') }),
  ];
  return [   // support
    mk(k + '_b', { n: nm('basic'), pow: 50, t: 'foe', rng: 1, fx: kitFx(el, 0.3), d: 'Ranged.' + kitText(el, 0.3) }),
    mk(k + '_a', { n: nm('heal'), t: 'ally', cd: 2, fx: el === 'mystic' ? { heal: 0.25, od: 25 } : { heal: 0.3, cleanse: 1 }, d: el === 'mystic' ? 'Heal the weakest ally 25% and give it 25 mana.' : 'Heal the weakest ally 30% and cleanse it.' }),
    mk(k + '_c', { n: nm('shield'), t: 'allies', cd: 3, fx: { shield: 0.14 }, d: 'Shield all allies for 14% max HP.' }),
    mk(k + '_u', { n: nm('ult'), pow: 80, t: 'foes', ult: 1, fx: Object.assign({ allyHeal: 0.2 }, kitFx(el, 1)), d: 'ULT: hit a wide area and heal all allies 20%.' + kitText(el, 1) }),
  ];
}
const SP2 = root.GD_SPECIES2 || [];
const perEl = {};
const ROLE_MOD = { striker: { atk: 1.04 }, caster: {}, tank: { hp: 1.04 }, support: {} };
for (const sp of SP2) {
  const i = perEl[sp.el] = (perEl[sp.el] || 0) + 1;
  SP[sp.k] = { el: sp.el, role: sp.role, names: sp.names, sk: buildKit(sp, i - 1), mod: Object.assign({}, ROLE_MOD[sp.role]) };
  TIER[sp.k] = sp.tier; RANGE[sp.k] = sp.range;
}

// ---- g9: merge perks -------------------------------------------------------------------
// Every species has a signature perk that switches on at ★2 and upgrades at ★3, where it
// also starts an aura for allies that share its element or its role.
const PERK_KINDS = {
  flurry: { n: 'Frenzy', d: l => `Every 3rd attack strikes twice${l > 1 ? ', and the second hit always crits' : ''}.` },
  cleave: { n: 'Sweeping Blows', d: l => `Attacks also hit foes next to the target for ${l > 1 ? 60 : 35}%.` },
  hunter: { n: 'Bloodlust', d: l => `Each knockout gives +${l > 1 ? 15 : 8}% ATK for the rest of the fight (up to 5 stacks).` },
  executioner: { n: 'Finisher', d: l => `Deals ${l > 1 ? 50 : 30}% more damage to foes under 40% HP.` },
  pierce: { n: 'Piercing Strikes', d: l => `Attacks also hit the foe behind the target for ${l > 1 ? 70 : 40}%.` },
  echo: { n: 'Resonance', d: l => `After casting, allies within 2 cells gain ${l > 1 ? 30 : 15} mana.` },
  surge: { n: 'Spell Surge', d: l => `After casting, attacks ${l > 1 ? 40 : 20}% faster for 4 seconds.` },
  venom: { n: 'Lingering Hex', d: l => `Statuses it applies last ${l > 1 ? 'twice as long' : '50% longer'}.` },
  reaper: { n: 'Soul Harvest', d: l => `A knockout refills ${l > 1 ? 60 : 30} mana.` },
  bulwark: { n: 'Last Stand', d: l => `Once per fight, dropping under half HP grants a ${l > 1 ? 40 : 25}% max-HP shield.` },
  guardian: { n: 'Protector', d: l => `Adjacent allies take ${l > 1 ? 20 : 10}% less damage.` },
  vanguard: { n: 'Shield Wall', d: l => `Allies in its row start the fight with +${l > 1 ? 25 : 12}% DEF.` },
  thornskin: { n: 'Spiked Hide', d: l => `Reflects ${l > 1 ? 30 : 15}% of the damage it takes.` },
  aegis: { n: 'Warding Light', d: l => `After casting, shields the weakest ally for ${l > 1 ? 20 : 10}% of its max HP.` },
  inspire: { n: 'Battle Hymn', d: l => `Allies in its column start the fight with +${l > 1 ? 25 : 12}% ATK.` },
  quick: { n: 'Quick Start', d: l => `Starts every fight with ${l > 1 ? 70 : 40} mana.` },
  mend: { n: 'Steady Mending', d: l => `Every 4 seconds heals the weakest ally for ${l > 1 ? 8 : 4}% of its max HP.` },
};
const ROLE_PERKS = { striker: ['flurry', 'cleave', 'hunter', 'executioner', 'pierce'], caster: ['echo', 'surge', 'venom', 'reaper', 'pierce'],
  tank: ['bulwark', 'guardian', 'vanguard', 'thornskin'], support: ['aegis', 'inspire', 'echo', 'quick', 'mend'] };
const EL_ADJ = { ember: 'Blazing', tide: 'Tidal', bloom: 'Verdant', volt: 'Static', stone: 'Granite', shade: 'Shadow', frost: 'Glacial', gale: 'Gusting', metal: 'Ironclad', mystic: 'Astral' };
// ★3 auras: allies sharing its element (or its role) gain this
const AURA_EL = { ember: ['atk', 0.12, '+12% ATK'], tide: ['regen', 0.006, '+0.6% HP regen a second'], bloom: ['regen', 0.008, '+0.8% HP regen a second'],
  volt: ['as', 0.12, '+12% attack speed'], stone: ['def', 0.15, '+15% DEF'], shade: ['crit', 0.1, '+10% crit'], frost: ['def', 0.12, '+12% DEF'],
  gale: ['dodge', 0.1, '+10% dodge'], metal: ['dr', 0.08, '8% less damage taken'], mystic: ['od', 0.25, '+25% mana gain'] };
const AURA_ROLE = { striker: ['atk', 0.1, '+10% ATK'], caster: ['od', 0.25, '+25% mana gain'], tank: ['def', 0.15, '+15% DEF'], support: ['regen', 0.006, '+0.6% HP regen a second'] };
const ROLE_PL = { striker: 'Strikers', caster: 'Casters', tank: 'Guardians', support: 'Supports' };
function strHash(t) { let h = 2166136261; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
for (const k in SP) {
  const S = SP[k], pool = ROLE_PERKS[S.role], h = strHash(k);
  const kind = pool[h % pool.length], byEl = (h >>> 8) % 2 === 0;
  const a = byEl ? AURA_EL[S.el] : AURA_ROLE[S.role];
  S.perk = { kind, name: EL_ADJ[S.el] + ' ' + PERK_KINDS[kind].n,
    aura: { by: byEl ? 'el' : 'role', key: byEl ? S.el : S.role, stat: a[0], v: a[1], d: `${byEl ? EL[S.el].name + ' allies' : ROLE_PL[S.role]} gain ${a[2]}` } };
}
function perkText(sp, star) {
  const P = SP[sp] && SP[sp].perk; if (!P) return '';
  return star >= 3 ? PERK_KINDS[P.kind].d(2) + ' Aura: ' + P.aura.d + '.' : PERK_KINDS[P.kind].d(1);
}
// the original twelve are free; every other species is unlocked by beating it in The Wilds
const BASE_SPECIES = ['cind', 'pyrp', 'bubb', 'shel', 'sprt', 'moss', 'sprk', 'buzz', 'pebb', 'crys', 'wisp', 'dusk'];
const ROUNDS = 30, STAGE_LEN = 5, STAGES = 6;
// relic text and numbers that mean something different in real-time fights
const CHESS_RELIC = {
  quickglass: { b: { manaDisc: 0.2 }, d: 'Skills cost 20% less mana.' },
  tempo_drum: { d: 'Every 6 seconds allies gain +30% attack speed for 2 seconds and 15 mana.' },
  tome: { b: { xpRound: 1 }, d: '+1 Tamer XP every round.' },
  sunstone: { b: { merge2: 1 }, d: 'Two copies are enough to merge into ★2.' },
  golden_egg: { b: { goldRound: 1 }, d: '+1 gold every round.' },
  purse: { b: { goldRound: 1, interestCap: 2 }, d: '+1 gold every round; interest cap +2.' },
  bell: { b: { rerollDisc: 1 }, d: 'Rerolls cost 1 gold less.' },
  treasure_map: { d: 'Relic rewards offer 1 more choice.' },
  star_shard: { d: 'Mana charges 30% faster.' },
  echo_chime: { d: 'After any ultimate, all other allies gain 25 mana.' },
  rally_horn: { d: 'Your front column +15% ATK.' },
  guardian_totem: { d: 'Your back column takes 20% less damage.' },
  pure_prism: { d: 'If 4 or more of your creatures share an element: +30% damage.' },
  loaded_die: { d: "Each creature's first attack in a fight always crits." },
  phoenix_plume: { d: 'The first ally to fall each fight revives at 30%.' },
  morning_dew: { b: { regen: 0.01 }, d: 'Allies regenerate 1% HP every second.' },
  frostcore: { d: 'Ignore Scorching Heat; burns on your creatures fade fast.' },
  incense: { d: 'Ignore Spore Haze; cleanse your creatures every 5 seconds.' },
  world_seed: { b: { regen: 0.02, overheal: 1, healAmp: 0.2 }, d: '2% regen per second, healing +20%, overheal becomes shield.' },
  philosopher: { b: { xpRound: 2, merge2: 1, mutChoice: 1 }, d: '+2 Tamer XP a round, two copies merge into ★2, 1 more mutation choice.' },
  jackpot: { b: { crit: 0.12, critGold: 1, goldRound: 1 }, d: '+12% crit; crits pay 1 gold (up to 5 a fight); +1 gold a round.' },
};
for (const k in CHESS_RELIC) {
  if (CHESS_RELIC[k].b) RELICS[k].b = CHESS_RELIC[k].b;
  RELICS[k].d = CHESS_RELIC[k].d;
}
SETS.verdant.b = { regen: 0.01, healAmp: 0.15 }; SETS.verdant.d = '+1% regen per second, healing +15%.';
SETS.swift.b = { startOd: 30 }; SETS.swift.d = 'Start fights with 30 mana.';
SETS.overdrive.b = { startOd: 40 }; SETS.overdrive.d = 'Start fights with 40 mana.';
SETS.status.d = 'Statuses you apply last longer.';
SETS.growth.b = { xpRound: 2 }; SETS.growth.d = '+2 Tamer XP every round.';
SETS.greed.b = { goldRound: 2 }; SETS.greed.d = '+2 gold every round.';

root.GD = { EL, ELS, STRONG, eff, ROLE, STAGE_MUL, EVO_LV, SK, SP, SKILL_LV, BOSSES, BIOMES, ACTS, ACT_LV,
  TRAITS, RELICS, FUSIONS, SETS, CHARMS, ITEMS, MUTS, PERKS, META, EVENTS,
  TIER, RANGE, ROLE_AS, BOSS_RANGE, POOL, ODDS, TXP, ROLE_TRAITS, EL_AT, ROUNDS, STAGE_LEN, STAGES, MID_BIOMES, PERK_KINDS, perkText, BASE_SPECIES, WILD_RELICS };
})(typeof window !== 'undefined' ? window : globalThis);
