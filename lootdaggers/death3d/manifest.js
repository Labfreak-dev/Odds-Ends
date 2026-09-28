/* Death arena assets. Procedural placeholders stand in while `url` is null.
   Setting a url (a file in death3d/assets/, or any path relative to lootdaggers/)
   swaps that slot to a GLB. Scale, facing, and up-axis are per asset.
   Clip names are mapped below; a missing clip falls back to procedural motion.
   See death3d/README.md. */
export const DEATH3D_MANIFEST = {
  version: 1,
  /* World layout in meters. +Y up. The hero stands near the origin facing +Z.
     Death's throne is down +Z. The camera sits behind the hero (negative Z)
     and a little above him, looking up the stairs. */
  layout: {
    hero: [-0.48, 0, 0.05],
    throne: [0, 0, 6.85],
    /* Death's seat, in throne-local meters. His pelvis sits on the cushion. */
    deathSeat: [0, 1.78, 0.08],
    camera: {
      fov: 42,
      pos: [0.46, 1.7, -1.48],
      look: [-0.05, 3.15, 6.2],
    },
  },
  assets: {
    death: {
      url: null,
      targetHeight: 3.45,
      /* 'seat' plants `seatFrac` of the bbox height on the seat anchor, so
         legs hang below it. 'feet' plants the bottom of the bbox. */
      anchor: 'seat',
      seatFrac: 0.36,
      scale: 1,
      /* glTF characters face +Z. Death must face the hero, who is at -Z. */
      facing: Math.PI,
      up: 'y',
      offset: [0, 0, 0],
      clips: { idle: 'idle', cast: 'cast', attack: 'attack', hit: 'hit', defeat: 'defeat' },
    },
    throne: {
      url: null,
      targetHeight: 6.4,
      anchor: 'feet',
      scale: 1,
      facing: 0,
      up: 'y',
      offset: [0, 0, 0],
    },
    environment: {
      url: null,
      targetHeight: null,
      anchor: 'feet',
      scale: 1,
      facing: 0,
      up: 'y',
      fit: false,
      offset: [0, 0, 0],
      /* What the procedural set should hide once this file loads. */
      hide: ['room'],
    },
    hero_knight: heroSlot(),
    hero_ranger: heroSlot(),
    hero_gambler: heroSlot(),
    hero_brute: heroSlot(),
    hero_duelist: heroSlot(),
    hero_hexpriest: heroSlot(),
    vfx: {
      soul: null,
      spark: null,
      beam: null,
      sigil: null,
      wisp: null,
    },
  },
};

function heroSlot() {
  return {
    url: null,
    targetHeight: 1.78,
    anchor: 'feet',
    scale: 1,
    /* Heroes face +Z, toward Death. */
    facing: 0,
    up: 'y',
    offset: [0, 0, 0],
    clips: { idle: 'idle', attack: 'attack', hit: 'hit', dodge: 'dodge', victory: 'victory', death: 'death' },
  };
}
