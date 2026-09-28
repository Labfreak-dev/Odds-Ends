/* Death arena assets. Procedural placeholders stand in if a GLB fails
   to load. Real files live in death3d/assets/. Characters are meshopt,
   the throne and room are Draco. See death3d/README.md. */
export const DEATH3D_MANIFEST = {
  version: 2,
  /* Placeholder layout, used only when the GLBs do not load. +Y up.
     The hero stands near the origin facing +Z. The throne is down +Z. */
  layout: {
    hero: [-0.16, 0, 0.22],
    throne: [0, 0, 6.85],
    deathSeat: [0, 1.78, 0.08],
    camera: {
      fov: 58,
      pos: [-0.88, 2.32, -4.08],
      look: [0, 2.25, 6.75],
    },
  },
  /* Asset-pack layout. Death and the throne share the origin and face +Z.
     The hero stands at Marker_Hero, turned 180° so his back is to the camera. */
  pack: {
    hero: [0, 0, 6.5],
    lungeSign: -1,
    /* Authored sizes from the asset package. Death, the throne and the hall
       keep that relationship; neither is scaled against the others. */
    scale: 1,
    deathScale: 1,
    /* 24 mm on a 36 mm sensor: 45.75° vertical at 16:9. Marker_Camera. */
    camera: {
      fov: 45.75,
      pos: [0.7, 2.45, 11.2],
      look: [-0.1, 2.75, 0.5],
    },
  },
  assets: {
    death: {
      url: 'models/death.glb',
      fit: false,
      facing: 0,
      anchor: 'none',
      wind: true,
      rim: 0.2,
      sockets: { eyes: 'Socket_Eyes', cast: 'Socket_RightHand', chest: 'Socket_Chest', off: 'Socket_LeftHand' },
      clips: { idle: 'Seated_Idle', cast: 'Cast_Windup', attack: 'Attack_Scythe', hit: 'Hit_Flinch', defeat: 'Defeat_Slump' },
    },
    throne: {
      url: 'models/throne.glb',
      fit: false,
      facing: 0,
      anchor: 'none',
    },
    environment: {
      url: 'models/throne_room_env.glb',
      fit: false,
      facing: 0,
      anchor: 'none',
      hide: ['room', 'throne'],
    },
    hero_knight: heroSlot('models/hero_knight.glb', true),
    hero_ranger: heroSlot('models/hero_ranger.glb', false),
    hero_gambler: heroSlot('models/hero_gambler.glb', false),
    hero_brute: heroSlot('models/hero_brute.glb', false),
    hero_duelist: heroSlot('models/hero_duelist.glb', false),
    hero_hexpriest: heroSlot('models/hero_hexpriest.glb', false),
    /* The scythe is already a child of bone Scythe_Grip (under LeftHand)
       at identity. Leave url empty to keep that mesh. Set url to
       'models/scythe.glb' to parent the standalone file to the same bone,
       also at identity, and hide the embedded Scythe. */
    scythe: { url: '', scale: 0 },
    vfx: {
      soul: 'textures/vfx/soul_orb.webp',
      orbLoop: 'textures/vfx/soul_orb_loop_4x4.webp',
      impact: 'textures/vfx/soul_impact_4x4.webp',
      beam: 'textures/vfx/soul_beam_tile.webp',
      flare: 'textures/vfx/soul_flare.webp',
      spark: 'textures/vfx/soul_sparks_2x2.webp',
      wisp: 'textures/vfx/soul_wisps_2x2.webp',
      ghost: 'textures/vfx/soul_ghostfaces_2x2.webp',
      fire: 'textures/vfx/fire_flame_4x4.webp',
    },
  },
};

function heroSlot(url, wind) {
  return {
    url,
    fit: false,
    /* The anchor is yawed 180°. The file itself faces +Z. */
    facing: 0,
    anchor: 'none',
    wind: !!wind,
    rim: 0.08,
    lockRoot: true,
    sockets: { cast: 'Socket_RightHand', chest: 'Socket_Chest', back: 'Socket_Chest', head: 'Socket_Head', off: 'Socket_LeftHand' },
    clips: {
      idle: 'Combat_Idle', attack: 'Attack', hit: 'Hit_React', dodge: 'Dodge',
      victory: 'Victory', death: 'Death', block: 'Block', heavy: 'Attack_Heavy',
    },
  };
}
