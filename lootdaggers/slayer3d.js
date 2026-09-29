/* Reel Slayer, 3D stage. slayer.js keeps every rule (positions, timers,
   hits); this module only draws that state with rigged Meshy characters,
   the shared animation library (models3d/anims.glb, one clip set that plays
   on every humanoid because they share Meshy's 24-bone rig), and effects.
   World units from slayer.js are mapped to meters with U. If anything here
   fails, slayer.js keeps drawing its 2D sprites. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const U = 0.0155;                       // meters per slayer.js world unit
const ROOT = new URL('./', import.meta.url).href;

/* Which library clip plays each hero move, and where in the clip the blow lands. */
export const MOVE_CLIPS = {
  sword:  { clip: 'Double_Combo_Attack', hit: 0.3, frenzy: 'Triple_Combo_Attack' },
  boots:  { clip: 'Roll_Dodge', hit: 0.5 },
  shield: { clip: 'Sword_Parry', hit: 0.25 },
  bow:    { clip: 'Archery_Shot', hit: 0.55, alt: 'Charged_Spell_Cast' },
  bomb:   { clip: 'Charged_Ground_Slam', hit: 0.55 },
  potion: { clip: 'mage_soell_cast', hit: 0.5 },
  coin:   { clip: 'Chest_Pound_Taunt', hit: 0.4 },
  skull:  { clip: 'Reaping_Swing', hit: 0.45 },
  key:    { clip: 'Step_Back', hit: 0.5 },
};
/* move timing in slayer.js: the fraction of the move where its effect fires */
const MOVE_HIT = { sword: 0.3, boots: 0.5, shield: 0.2, bow: 0.4, bomb: 0.45, potion: 0.5, coin: 0.5, skull: 0.4, key: 0.5 };

/* Foes: model file, rigged or code-animated, clip choices, height (m). */
export const FOE3D = {
  skel:     { attack: 'Attack', hitAt: 0.45, walk: 'Walk_Fight_Forward' },
  archer:   { attack: 'Archery_Shot', hitAt: 0.55 },
  orc:      { attack: 'Heavy_Hammer_Swing', hitAt: 0.5, walk: 'Slow_Orc_Walk' },
  croupier: { attack: 'mage_soell_cast', hitAt: 0.5 },
  taxman:   { attack: 'Side_Shot', hitAt: 0.5 },
  mirror:   { attack: 'Double_Blade_Spin', hitAt: 0.45 },
  ironclad: { attack: 'Heavy_Hammer_Swing', hitAt: 0.5, walk: 'Slow_Orc_Walk' },
  abom:     { attack: 'Heavy_Hammer_Swing', hitAt: 0.5, walk: 'Mummy_Stagger' },
  reaper:   { attack: 'Reaping_Swing', hitAt: 0.45 },
  homunculus: { attack: 'Attack', hitAt: 0.45 },
  boneking: { attack: 'Sword_Judgment', hitAt: 0.5 },
  lich:     { attack: 'Charged_Spell_Cast', hitAt: 0.55 },
  labfreak: { attack: 'mage_soell_cast', hitAt: 0.5 },
  labfreak2:{ attack: 'Charged_Ground_Slam', hitAt: 0.55, walk: 'Mummy_Stagger' },
  // no rig: bob, squash, lunge in code
  rat: { static: true, hover: 0 }, slime: { static: true, hover: 0 }, wraith: { static: true, hover: 0.35 },
  mimic: { static: true, hover: 0 }, brainjar: { static: true, hover: 0 }, bandit: { static: true, hover: 0 },
};

/* A phone is a touch device with a small screen, not just a short laptop screen
   (that misread turned anti-aliasing off on PCs and made the models look jaggy). */
function phoneLike() {
  if (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent || '')) return true;
  const w = Math.min(screen.width || 0, screen.height || 0) || window.innerWidth;
  return (navigator.maxTouchPoints || 0) > 1 && w < 820;
}

/* Heroes carry their weapons as props on the hand bones, gripped for their own
   clips. These library moves map to the hero's own clip when it has one. */
const HERO_OWN = {
  Combat_Stance: 'Combat_Idle', Attack: 'Attack', Double_Combo_Attack: 'Attack', Left_Slash: 'Attack',
  Triple_Combo_Attack: 'Attack_Heavy', Hit_Reaction: 'Hit_React', Dead: 'Death', Roll_Dodge: 'Dodge',
  Sword_Parry: 'Block', Victory_Cheer: 'Victory',
};
const GRIP_BONES = ['LeftHand', 'RightHand'];

export async function boot(canvas) {
  const stage = new Stage(canvas);
  await stage.load();
  return stage;
}

/* Shared by Reel Slayer (a full world) and the main crawl (opts.overlay: a
   transparent layer of characters over the 2D painted scene; see crawl3d.js). */
export class Stage {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.overlay = !!opts.overlay;
    this.phone = phoneLike();
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: this.overlay, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.phone ? 1.75 : 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.AgXToneMapping;
    r.toneMappingExposure = 1.4;
    this.renderer = r;
    this.scene = new THREE.Scene();
    if (!this.overlay) {
      this.scene.background = new THREE.Color(0x07080a);
      this.scene.fog = new THREE.Fog(0x07080a, 16, 40);
    }
    // metal and roughness maps need something to reflect, or the models read flat grey
    const pm = new THREE.PMREMGenerator(r);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;
    pm.dispose();
    this.camera = new THREE.PerspectiveCamera(24, 1, 0.1, 80);
    this.loader = new GLTFLoader();
    this.loader.setMeshoptDecoder(MeshoptDecoder);
    this.gltfs = {};          // url -> Promise<gltf>
    this.actors = new Map();  // game object -> actor
    this.fx = [];
    this.clock = 0;
    this.camX = 0;
    this.lastCur = null;
    this.hero = null;
    this.heroId = null;
    this.skinId = null;
    this._buildLights();
    if (!this.overlay) this._buildWorld();
  }

  async load() {
    const [anims, skins] = await Promise.all([
      this._gltf('models3d/anims.glb'),
      fetch(ROOT + 'models3d/skins.json').then(r => r.ok ? r.json() : {}).catch(() => ({})),
    ]);
    this.clips = {};
    for (const c of anims.animations) this.clips[c.name] = c;
    this.skins = skins || {};
  }

  _gltf(path) {
    if (!this.gltfs[path]) this.gltfs[path] = this.loader.loadAsync(ROOT + path);
    return this.gltfs[path];
  }

  /* ---------- world ---------- */
  _buildLights() {
    const S = this.scene;
    S.add(new THREE.HemisphereLight(0x9fb4c4, 0x2a1d18, 1.3));
    const key = new THREE.DirectionalLight(0xffe6c8, 2.2);
    key.position.set(-3, 6, 7);
    S.add(key);
    const rim = new THREE.DirectionalLight(0x6fe0b0, 1.1);
    rim.position.set(4, 3, -5);
    S.add(rim);
    this.keyLight = key;
    this.rimLight = rim;
    // soft blob shadow texture
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    this.blobTex = new THREE.CanvasTexture(c);
    this.glowTex = this._radial('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
    this.flash = new THREE.PointLight(0xffd9a0, 0, 7, 1.5);
    S.add(this.flash);
  }

  _buildWorld() {
    const S = this.scene;
    const art = window.LD_ART || {};
    // tile a painting along a plane of the given size without stretching it
    const texFrom = (k, planeW, planeH) => {
      if (!art[k]) return null;
      const t = new THREE.TextureLoader().load(art[k], tx => {
        const ar = (tx.image.width || 1) / (tx.image.height || 1);
        tx.repeat.set(planeW / (planeH * ar), 1); tx.needsUpdate = true;
      });
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
      return t;
    };
    // floor: a long strip with the painted floor tile
    const floorTex = texFrom('bg_floor', 200, 7);
    if (floorTex) floorTex.wrapT = THREE.RepeatWrapping;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 28),
      new THREE.MeshStandardMaterial({ color: floorTex ? 0xffffff : 0x2a2224, map: floorTex, roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(60, 0, 10.8);
    if (floorTex) floorTex.repeat.y = 4;
    S.add(floor);
    // back wall: the dungeon painting, set back so the characters stand in front of it
    const wallTex = texFrom('bg_wall', 200, 11);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(200, 11),
      new THREE.MeshStandardMaterial({ color: wallTex ? 0xbfbfbf : 0x1d1a1e, map: wallTex, roughness: 1 }));
    wall.position.set(60, 5.3, -3.2);
    S.add(wall);
    this.wall = wall;
    // torches along the wall: a warm light every few meters, flickering flame sprites
    this.torches = [];
    const flameTex = new THREE.TextureLoader().load(ROOT + 'death3d/assets/textures/vfx/fire_flame_4x4.webp');
    flameTex.colorSpace = THREE.SRGBColorSpace;
    flameTex.repeat.set(0.25, 0.25);
    for (let i = 0; i < 26; i++) {
      const x = -6 + i * 5.5;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex.clone(), color: 0xffc080, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      sp.material.map.repeat.set(0.25, 0.25);
      sp.scale.set(0.45, 0.7, 1);
      sp.position.set(x, 2.35, -3.0);
      S.add(sp);
      this.torches.push(sp);
    }
    this.torchLights = [];
    for (let i = 0; i < (this.phone ? 2 : 4); i++) {
      const L = new THREE.PointLight(0xff9a4a, 6, 9, 1.6);
      S.add(L);
      this.torchLights.push(L);
    }
  }

  _radial(a, b) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, a); gr.addColorStop(1, b);
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  /* ---------- actors ---------- */
  _makeActor(gltf, opts) {
    const root = SkeletonUtils.clone(gltf.scene);
    const mats = [];
    root.traverse(o => {
      if (o.isMesh) {
        o.frustumCulled = false;
        const list = Array.isArray(o.material) ? o.material : [o.material];
        const cl = list.map(m => { const n = m.clone(); n.userData.base = { emissive: n.emissive ? n.emissive.clone() : null }; mats.push(n); return n; });
        o.material = Array.isArray(o.material) ? cl : cl[0];
      }
    });
    const holder = new THREE.Group();
    holder.add(root);
    this.scene.add(holder);
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.blobTex, transparent: true, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.01;
    this.scene.add(blob);
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const hips = root.getObjectByName('Hips');
    // Unrigged image-to-3D models are pivoted at their middle: stand them on the
    // floor (lowest point at y 0) and centre them on their spot.
    if (!hips) {
      root.position.y -= box.min.y;
      root.position.x -= (box.min.x + box.max.x) / 2;
      root.position.z -= (box.min.z + box.max.z) / 2;
      root.updateMatrixWorld(true);
      box.setFromObject(root);
    }
    const height = Math.max(0.3, box.max.y - Math.min(0, box.min.y));
    const a = {
      holder, root, blob, mats, height, hips, hipY: hips ? hips.position.y : 0,
      hipX: hips ? hips.position.x : 0, hipZ: hips ? hips.position.z : 0,
      mixer: hips ? new THREE.AnimationMixer(root) : null, actions: {}, cur: null, opts: opts || {},
      own: opts && opts.hero ? Object.fromEntries((gltf.animations || []).map(c => [c.name, c])) : null,
      width: Math.max(0.5, box.max.x - box.min.x),
    };
    blob.scale.set(a.width * 1.2, a.width * 0.6, 1);
    return a;
  }

  /* A library clip, fitted to this actor: root x/z motion removed (the game
     moves the actor) and hip height scaled to this actor's legs. */
  _clip(a, name) {
    if (a.actions[name]) return a.actions[name];
    if (!a.mixer) return null;
    const ownName = a.own && HERO_OWN[name];
    const own = ownName && a.own[ownName];
    const src = own || this.clips[name];
    if (!src) return null;
    const c = src.clone();
    const srcHip = this._srcHip || (this._srcHip = this._sourceHipY());
    const k = own ? 1 : (srcHip > 0 && a.hipY > 0 ? a.hipY / srcHip : 1);
    if (a.own && !own) {
      // a borrowed move: keep the hero's own wrist grip so the weapon stays seated in the hand
      const idle = a.own.Combat_Idle;
      for (const bone of GRIP_BONES) {
        const key = bone + '.quaternion';
        const from = idle && idle.tracks.find(t => t.name === key);
        const i = c.tracks.findIndex(t => t.name === key);
        if (i < 0) continue;
        if (from) c.tracks[i] = new THREE.QuaternionKeyframeTrack(key, [0], Array.from(from.values.slice(0, 4)));
        else c.tracks.splice(i, 1);
      }
    }
    for (const t of c.tracks) {
      if (t.name.endsWith('.position') && t.name.startsWith('Hips')) {
        // keep this actor's own hip x/z (the game moves it); scale the height to its legs
        const v = t.values;
        for (let i = 0; i < v.length; i += 3) { v[i] = a.hipX; v[i + 1] *= k; v[i + 2] = a.hipZ; }
      }
    }
    const act = a.mixer.clipAction(c);
    a.actions[name] = act;
    return act;
  }
  _sourceHipY() {
    const c = this.clips.Combat_Stance;
    const t = c && c.tracks.find(x => x.name === 'Hips.position');
    return t ? t.values[1] : 0;
  }

  _play(a, name, { once = false, speed = 1, fade = 0.15, from = 0 } = {}) {
    const act = this._clip(a, name) || this._clip(a, 'Combat_Stance');
    if (!act) return null;
    if (a.cur === act && !once) { act.timeScale = speed; return act; }
    act.reset();
    act.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    act.clampWhenFinished = once;
    act.timeScale = speed;
    act.time = from;
    act.enabled = true;
    act.play();
    if (a.cur && a.cur !== act) a.cur.crossFadeTo(act, fade, false);
    a.cur = act;
    a.curName = name;
    return act;
  }

  async _ensureHero(st) {
    if (this.heroId === st.hero || this._heroLoading) return;
    this._heroLoading = true;
    try {
      const g = await this._gltf('death3d/assets/models/hero_' + st.hero + '.glb');
      if (this.hero) { this.scene.remove(this.hero.holder); this.scene.remove(this.hero.blob); }
      this.hero = this._makeActor(g, { hero: true });
      this.heroId = st.hero;
      this.skinId = undefined;
      this._play(this.hero, 'Combat_Stance');
    } finally { this._heroLoading = false; }
  }

  _applySkin(st) {
    let sk = null;
    try { sk = window.hskinFor ? window.hskinFor(st.hero) : null; } catch (e) { sk = null; }
    const id = sk ? sk.id : null;
    if (id === this.skinId || !this.hero) return;
    this.skinId = id;
    const parts = id && this.skins[id];
    const tl = new THREE.TextureLoader();
    for (const m of this.hero.mats) {
      const b = m.userData.base;
      if (!b.map) b.map = [m.map, m.normalMap, m.roughnessMap, m.metalnessMap];
      const part = (m.name || '').split('__')[1];
      const key = part === st.hero ? 'body' : part;
      if (!parts || !parts.includes(key)) {
        [m.map, m.normalMap, m.roughnessMap, m.metalnessMap] = b.map; m.needsUpdate = true; continue;
      }
      const pre = ROOT + 'death3d/assets/textures/skins/' + id + '_' + key + '_';
      const ld = (u, srgb) => tl.loadAsync(u).then(t => { t.flipY = false; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; return t; });
      Promise.all([ld(pre + 'base.webp', true), ld(pre + 'normal.webp'), ld(pre + 'mr.webp')]).then(([bc, n, mr]) => {
        if (this.skinId !== id) return;
        m.map = bc; m.normalMap = n; m.roughnessMap = mr; m.metalnessMap = mr; m.needsUpdate = true;
      }).catch(() => { /* keep the base look */ });
    }
  }

  /* No model yet (or it failed): the foe's 2D art as a cut-out standing in the scene. */
  _cardActor(f) {
    const art = window.LD_ART || {};
    const src = art[(f.boss ? 'boss_' : 'enemy_') + f.t];
    if (!src) return null;
    const tex = new THREE.TextureLoader().load(src);
    tex.colorSpace = THREE.SRGBColorSpace;
    const img = new Image(); img.src = src;
    const want = f.boss ? 3.0 : 1.7;
    const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 1 });
    mat.userData.base = { emissive: mat.emissive.clone() };
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    const fit = () => { const ar = (img.naturalWidth || 1) / (img.naturalHeight || 1); plane.scale.set(want * ar, want, 1); plane.position.y = want / 2; };
    img.onload = fit; fit();
    const root = new THREE.Group(); root.add(plane);
    const holder = new THREE.Group(); holder.add(root); this.scene.add(holder);
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.blobTex, transparent: true, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2; blob.scale.set(1.1, 0.5, 1); this.scene.add(blob);
    return { holder, root, blob, mats: [mat], height: want, width: 1, mixer: null, actions: {}, cur: null, card: true, opts: { spec: { static: true, hover: 0 } } };
  }

  async _foeActor(f) {
    const spec = FOE3D[f.t];
    if (!spec) return this._cardActor(f);
    let g;
    try { g = await this._gltf('models3d/foes/' + f.t + '.glb'); }
    catch (e) { return this._cardActor(f); }
    const a = this._makeActor(g, { foe: true, spec });
    // rigged models were built at their real height (meters); the others are sized here
    if (!a.mixer) {
      const want = ({ rat: 0.75, slime: 1.1, mimic: 1.0, brainjar: 1.3, wraith: 2.0, bandit: 2.8, croupier: 1.8 })[f.t] || (f.boss ? 2.8 : 1.8);
      const s = want / a.height;
      a.root.scale.setScalar(s);
      a.height *= s; a.width *= s;
    }
    a.blob.scale.set(a.width * 1.2, a.width * 0.6, 1);
    if (a.mixer) this._play(a, 'Combat_Stance', { from: Math.random() });
    return a;
  }

  /* ---------- per frame ---------- */
  render(st, dt, box) {
    if (!st) return;
    const running = st.mode === 'act' || st.mode === 'walk';
    const adt = running ? dt : 0;          // the world is frozen while you plan
    this.clock += dt;
    this._resize(box);
    if (this.heroId !== st.hero) this._ensureHero(st);
    if (this.hero) {
      this._applySkin(st);
      this._heroAnim(st);
      const h = this.hero;
      h.holder.position.set(st.x * U, 0, 0);
      const want = st.face > 0 ? Math.PI / 2 : -Math.PI / 2;
      h.holder.rotation.y += (want - h.holder.rotation.y) * Math.min(1, dt * 14);
      h.blob.position.set(st.x * U, 0.01, 0);
      if (h.mixer) h.mixer.update(adt);
      this._tint(h, st.cur && st.cur.m === 'skull' ? 0x5a1a7a : st.invT > 0 ? 0x223344 : st.frenzy && st.mode === 'act' ? 0x4a2200 : 0, st.hurtT > 0 ? 0.6 : 0);
    }
    this._foes(st, adt, dt);
    this._shots(st);
    this._flashFrame(st, box.dt || dt);
    this._effects(st, box.dt || dt);
    this._world(st, dt);
    this.renderer.render(this.scene, this.camera);
  }

  _heroAnim(st) {
    const h = this.hero, c = st.cur;
    if (st.over && st.hp <= 0) { if (h.curName !== 'Dead') this._play(h, 'Dead', { once: true }); return; }
    if (c && c !== this.lastCur) {
      this.lastCur = c;
      const spec = MOVE_CLIPS[c.m] || MOVE_CLIPS.sword;
      let name = spec.clip;
      if (c.m === 'sword' && st.frenzy && this.clips[spec.frenzy]) name = spec.frenzy;
      if (c.m === 'sword' && st.ult === 'sword' && this.clips.Double_Blade_Spin) name = 'Double_Blade_Spin';
      if (c.m === 'bow' && st.hero !== 'ranger' && spec.alt) name = spec.alt;
      const clip = this.clips[name];
      if (clip) {
        // land the clip's blow on the move's blow; skip a long wind-up rather than rush it
        const hitT = (MOVE_HIT[c.m] || 0.4) * c.dur;
        const clipHit = spec.hit * clip.duration;
        let speed = 1.25, from = Math.max(0, clipHit - hitT * speed);
        if (from < 0.01) speed = Math.min(2.2, Math.max(0.8, clipHit / Math.max(0.05, hitT)));
        this._play(h, name, { once: true, speed, from, fade: 0.08 });
      }
      if (!this._ultMoveFx(st, c)) this._moveFx(st, c);
      return;
    }
    if (!c) {
      this.lastCur = null;
      if (st.hurtT > 0.25 && h.curName !== 'Hit_Reaction') this._play(h, 'Hit_Reaction', { once: true, speed: 1.4, fade: 0.05 });
      else if (st.mode === 'walk') this._play(h, 'Walk_Fight_Forward', { speed: 1.2 });
      else if (st.hurtT <= 0 && (!h.cur || h.cur.loop === THREE.LoopOnce && !h.cur.isRunning() || h.curName === 'Walk_Fight_Forward')) this._play(h, 'Combat_Stance', { fade: 0.25 });
    }
  }

  _foes(st, adt, dt) {
    const seen = new Set();
    for (const f of st.foes) {
      seen.add(f);
      let a = this.actors.get(f);
      if (a === undefined) {
        this.actors.set(f, null);
        this._foeActor(f).then(x => {
          if (!x) return;
          if (!st.foes.includes(f) && this.stGone(f)) { this._drop(x); return; }
          x.lastX = f.x; this.actors.set(f, x);
        }).catch(() => { /* this foe stays 2D-less; slayer.js keeps its bars */ });
        continue;
      }
      if (!a) continue;
      const spec = a.opts.spec;
      if (a.card) a.root.scale.x = f.x > st.x ? -1 : 1;
      else {
        const facing = st.x >= f.x ? Math.PI / 2 : -Math.PI / 2;
        a.holder.rotation.y += (facing - a.holder.rotation.y) * Math.min(1, dt * 10);
      }
      const moved = Math.abs(f.x - (a.lastX == null ? f.x : a.lastX)) > 0.01;
      a.lastX = f.x;
      let y = 0, sx = 1, sy = 1;
      if (a.mixer) {
        if (f.dead) { if (!a.dying) { a.dying = true; this._play(a, pick(['Dead', 'Knock_Down', 'dying_backwards']), { once: true, speed: 1.3 }); } }
        else if (f.state === 'wind') {
          if (a.curName !== spec.attack || !a.inWind) {
            a.inWind = true;
            const clip = this.clips[spec.attack];
            if (clip) this._play(a, spec.attack, { once: true, speed: Math.max(0.35, (spec.hitAt * clip.duration) / Math.max(0.2, f.wind)), fade: 0.1 });
          }
        } else if (a.inWind) {
          a.inWind = false;
          if (a.cur) a.cur.timeScale = 1.3;          // follow through after the strike
        } else if (f.flash > 0.8 && a.curName !== 'Hit_Reaction' && !a.inWind) {
          this._play(a, 'Hit_Reaction', { once: true, speed: 1.5, fade: 0.05 });
        } else if (!a.cur || (a.cur.loop === THREE.LoopOnce && !a.cur.isRunning())) {
          this._play(a, moved ? (spec.walk || 'Walk_Fight_Forward') : 'Combat_Stance', { fade: 0.2 });
        } else if (a.cur.loop !== THREE.LoopOnce) {
          const want = moved ? (spec.walk || 'Walk_Fight_Forward') : 'Combat_Stance';
          if (a.curName !== want) this._play(a, want, { fade: 0.2 });
        }
        a.mixer.update(adt);
      } else {
        // code-animated: bob, squash on the wind-up, lunge on the strike, topple on death
        a.t = (a.t || Math.random() * 6) + adt;
        const w = f.state === 'wind' ? 1 - f.wT / f.wind : 0;
        y = (spec.hover || 0) + Math.abs(Math.sin(a.t * (moved ? 9 : 2.5))) * (moved ? 0.08 : 0.03) + (spec.hover ? Math.sin(a.t * 1.7) * 0.08 : 0);
        sx = 1 + w * 0.12 + (f.flash || 0) * 0.08; sy = 1 - w * 0.1;
        if (f.dead) { a.dead = (a.dead || 0) + dt; a.root.rotation.z = Math.min(1.4, a.dead * 3) * (st.x > f.x ? 1 : -1); }
      }
      // launched by a heavy blow or a killing one: an arc up and back
      const air = f.air || 0, airT = f.dead ? 0.7 : 0.55;
      if (air > (a.prevAir || 0) + 0.1 && a.mixer && !f.dead && this.clips.BeHit_FlyUp) this._play(a, 'BeHit_FlyUp', { once: true, speed: 1.5, fade: 0.05 });
      a.prevAir = air;
      if (air > 0) {
        const k = Math.min(1, 1 - air / airT);
        y += Math.sin(Math.PI * k) * (f.dead ? 1.2 : 0.75);
        if (!a.mixer && !f.dead) a.root.rotation.z = Math.sin(Math.PI * k) * 0.6 * Math.sign(f.x - st.x);
      } else if (!a.mixer && !f.dead) a.root.rotation.z *= 0.8;
      const lunge = (f.lunge || 0) * 0.35 * Math.sign(st.x - f.x);
      a.holder.position.set(f.x * U + lunge, y, 0);
      a.holder.scale.set(sx, sy, sx);
      a.blob.position.set(f.x * U, 0.01, 0);
      const fade = f.dead ? Math.max(0, 1 - Math.max(0, f.deadT - 0.35) / 0.45) : 1;
      this._fade(a, fade);
      this._tint(a, f.stun > 0 ? 0x1a2a44 : f.state === 'wind' ? 0x3a0808 : 0, f.flash || 0);
    }
    for (const [f, a] of this.actors) if (!seen.has(f)) { if (a) this._drop(a); this.actors.delete(f); }
  }
  stGone() { return true; }
  _drop(a) { this.scene.remove(a.holder); this.scene.remove(a.blob); }

  _tint(a, hex, flash) {
    const k = Math.min(1, flash || 0);
    for (const m of a.mats) {
      if (!m.emissive) continue;
      if (hex) m.emissive.setHex(hex); else if (m.userData.base && m.userData.base.emissive) m.emissive.copy(m.userData.base.emissive);
      if (k > 0.01) m.emissive.lerp(new THREE.Color(0xffffff), k * 0.6);
      m.emissiveIntensity = 1;
    }
  }
  _fade(a, k) {
    if (a.fadeK === k) return;
    a.fadeK = k;
    for (const m of a.mats) { m.transparent = k < 1; m.opacity = k; m.depthWrite = k >= 1; }
    a.blob.material.opacity = k;
  }

  /* ---------- shots and effects ---------- */
  _shots(st) {
    this.shotMeshes = this.shotMeshes || new Map();
    const live = new Set(st.shots);
    for (const s of st.shots) {
      let m = this.shotMeshes.get(s);
      if (!m) {
        if (s.mine) {
          m = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.7, 5), new THREE.MeshBasicMaterial({ color: 0xf0e0b0 }));
          m.rotation.z = Math.PI / 2;
          const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: 0xffd98a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
          glow.scale.set(0.5, 0.2, 1); m.add(glow);
        } else {
          m = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: 0xc08cff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
          m.scale.set(0.45, 0.45, 1);
        }
        this.scene.add(m); this.shotMeshes.set(s, m);
      }
      m.position.set(s.x * U, s.y * U + 0.3, 0.1);
    }
    for (const [s, m] of this.shotMeshes) if (!live.has(s)) { this.scene.remove(m); this.shotMeshes.delete(s); }
  }

  _spriteFx(color, pos, scale, dur, grow) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    sp.position.copy(pos); sp.scale.setScalar(scale);
    this.scene.add(sp);
    this.fx.push({ obj: sp, t: 0, dur, grow: grow || 1, base: scale, kind: 'sprite' });
  }
  _ringFx(color, pos, r0, r1, dur, flat) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), new THREE.MeshBasicMaterial({ color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    if (flat) m.rotation.x = -Math.PI / 2;
    m.position.copy(pos);
    this.scene.add(m);
    this.fx.push({ obj: m, t: 0, dur, r0, r1, kind: 'ring' });
  }
  _arcFx(st, color, r, spin) {
    const g = new THREE.RingGeometry(r * 0.78, r, 40, 1, 0, Math.PI * 1.1);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    m.position.set(st.x * U + st.face * 0.55, 1.15, 0.25);
    m.rotation.z = st.face > 0 ? -1.2 : Math.PI + 1.2 - Math.PI * 1.1;
    this.scene.add(m);
    this.fx.push({ obj: m, t: 0, dur: 0.28, kind: 'arc', spin: (spin || 5) * -st.face });
  }
  _burst(color, pos, n, speed, dur) {
    const geo = new THREE.BufferGeometry();
    const p = new Float32Array(n * 3), v = [];
    for (let i = 0; i < n; i++) { p.set([pos.x, pos.y, pos.z], i * 3); v.push(new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 1.5, (Math.random() - 0.5)).multiplyScalar(speed)); }
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const m = new THREE.Points(geo, new THREE.PointsMaterial({ color, size: 0.09, map: this.glowTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    this.scene.add(m);
    this.fx.push({ obj: m, t: 0, dur, v, kind: 'burst' });
  }

  _moveFx(st, c) {
    const x = st.x * U, at = new THREE.Vector3(x, 1.1, 0.2);
    const m = c.m;
    const delay = (MOVE_HIT[m] || 0.4) * c.dur * 1000;
    const later = fn => setTimeout(fn, delay);
    if (m === 'sword') later(() => { this._arcFx(st, st.frenzy ? 0xff9a50 : 0xfff0d0, 0.9); this._burstAtFoes(st, 0xffe6b0, 110); });
    else if (m === 'boots') { for (let i = 0; i < 5; i++) setTimeout(() => this._spriteFx(0x9fc8ff, new THREE.Vector3(st.x * U, 1, 0), 0.9, 0.3, 1.4), i * 60); }
    else if (m === 'shield') { this._ringFx(0x9fe0ff, new THREE.Vector3(x + st.face * 0.4, 1.1, 0.3), 0.5, 0.9, 0.5); }
    else if (m === 'bomb') later(() => { this._spriteFx(0xffb060, new THREE.Vector3(x + st.face * 0.3, 0.6, 0.3), 1.2, 0.55, 3.2); this._ringFx(0xffa040, new THREE.Vector3(x, 0.05, 0), 0.4, 3.4, 0.5, true); this._burst(0xffc070, new THREE.Vector3(x, 0.5, 0.2), 40, 3, 0.8); this._flash(0xffb070, 18, x); });
    else if (m === 'skull') later(() => { this._ringFx(0xb07cf0, new THREE.Vector3(x, 0.05, 0), 0.5, 4.4, 0.7, true); this._spriteFx(0x9a50ff, new THREE.Vector3(x, 1, 0.2), 1.6, 0.6, 2.2); this._burst(0xc890ff, new THREE.Vector3(x, 0.8, 0.2), 50, 3.4, 0.9); this._flash(0x9a50ff, 14, x); });
    else if (m === 'potion') later(() => this._burst(0x8cff96, new THREE.Vector3(x, 0.4, 0.2), 30, 1.2, 1.1));
    else if (m === 'coin') later(() => this._burst(0xffd060, new THREE.Vector3(x, 1.3, 0.2), 24, 1.6, 0.9));
    else if (m === 'bow') later(() => this._spriteFx(0xffe0a0, new THREE.Vector3(x + st.face * 0.5, 1.3, 0.3), 0.4, 0.2, 2));
  }
  _burstAtFoes(st, color, reach) {
    for (const f of st.foes) {
      if (f.dead) continue;
      const dx = (f.x - st.x) * st.face;
      if (dx > -10 && dx < reach) this._burst(color, new THREE.Vector3(f.x * U, 1.1, 0.3), 14, 2.2, 0.4);
    }
  }
  _flash(color, power, x) {
    this.flash.color.setHex(color); this.flash.intensity = power; this.flash.position.set(x, 1.2, 1.2);
  }

  _effects(st, dt) {
    this.flash.intensity *= Math.pow(0.02, dt);
    // hit sparks when a foe starts flashing, parry flare on a perfect parry
    for (const f of st.foes) {
      if (f.flash > 0.95 && !f._fx3) { f._fx3 = true; this._burst(0xffffff, new THREE.Vector3(f.x * U, 1.1, 0.3), 10, 1.8, 0.35); }
      if (f.flash < 0.5) f._fx3 = false;
    }
    if (st.fl) for (const fl of st.fl) {
      if (fl._fx3) continue; fl._fx3 = true;
      if (/PARRY/.test(fl.txt)) { this._ringFx(0xbfe8ff, new THREE.Vector3(st.x * U + st.face * 0.4, 1.2, 0.35), 0.3, 1.4, 0.35); this._flash(0x9fd6ff, 10, st.x * U); }
      if (/FRENZY/.test(fl.txt)) this._flash(0xff9040, 12, st.x * U);
    }
    const later = [];   // effects spawned by finished ones run after the sweep, or the sweep would drop them
    this.fx = this.fx.filter(e => {
      e.t += dt;
      const p = Math.min(1, e.t / e.dur);
      const o = e.obj;
      if (e.kind === 'sprite') { o.scale.setScalar(e.base * (1 + (e.grow - 1) * p)); o.material.opacity = 1 - p; }
      else if (e.kind === 'ring') { const r = e.r0 + (e.r1 - e.r0) * p; o.scale.set(r, r, r); o.material.opacity = 1 - p; }
      else if (e.kind === 'arc') { o.rotation.z += e.spin * dt; o.material.opacity = 1 - p; }
      else if (e.kind === 'slashX') { o.scale.set(0.4 + p * 1.2, 1 - p * 0.5, 1); o.material.opacity = 1 - p; }
      else if (e.kind === 'fall') { o.position.lerpVectors(e.from, e.to, p * p); if (p >= 1 && e.done) { later.push(e.done); e.done = null; } }
      else if (e.kind === 'burst') {
        const a = o.geometry.attributes.position;
        for (let i = 0; i < e.v.length; i++) { e.v[i].y -= 4 * dt; a.array[i * 3] += e.v[i].x * dt; a.array[i * 3 + 1] += e.v[i].y * dt; a.array[i * 3 + 2] += e.v[i].z * dt; }
        a.needsUpdate = true; o.material.opacity = 1 - p;
      }
      if (p >= 1) { this.scene.remove(o); o.geometry && o.geometry.dispose(); o.material.dispose(); return false; }
      return true;
    });
    for (const fn of later) fn();
  }

  _world(st, dt) {
    // torches flicker; the nearest few carry real lights
    const t = this.clock;
    for (const sp of this.torches) {
      const i = Math.floor(t * 12 + sp.position.x) % 16;
      sp.material.map.offset.set((i % 4) * 0.25, 0.75 - Math.floor(i / 4) * 0.25);
      sp.scale.set(0.45 + Math.sin(t * 11 + sp.position.x) * 0.03, 0.7, 1);
    }
    const cx = this.camX;
    const near = this.torches.map(s => s.position).sort((a, b) => Math.abs(a.x - cx) - Math.abs(b.x - cx));
    this.torchLights.forEach((L, i) => {
      const p = near[i]; if (!p) return;
      L.position.set(p.x, p.y, -2.4);
      L.intensity = 5 + Math.sin(t * 13 + i * 2) * 0.8 + Math.sin(t * 7.3 + i) * 0.6;
    });
  }

  /* ---------- camera and screen mapping ---------- */
  _resize(box) {
    const w = Math.max(1, Math.round(box.w)), h = Math.max(1, Math.round(box.h));
    if (this._w !== w || this._h !== h) {
      this._w = w; this._h = h;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
    // frame about 6.4 m of floor (the 2D view's 400 units) so foes are seen coming;
    // a long lens keeps the side-on look. Hero sits 30% in, the floor low in frame.
    const tanV = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const aspect = this.camera.aspect;
    const halfWWant = aspect < 1 ? 2.9 : Math.min(6.5, 3.1 * aspect);
    const dist = Math.min(26, Math.max(9, halfWWant / (tanV * aspect))) / (this.zoom || 1);
    const halfW = tanV * dist * aspect, halfV = tanV * dist;
    const want = (this._heroX || 0) + halfW * 0.4;
    if (!this._camSet) { this.camX = want; this._camSet = true; }
    this.camX += (want - this.camX) * Math.min(1, (box.dt || 0.016) * 4);
    const lookY = Math.max(1.1, halfV * 0.62);
    const sh = this.shakeK || 0, jx = (Math.random() - 0.5) * sh, jy = (Math.random() - 0.5) * sh;
    this.camera.position.set(this.camX + jx, lookY + 0.35 + jy, dist);
    this.camera.lookAt(this.camX + jx * 0.5, lookY + jy * 0.5, 0);
    this.camera.updateMatrixWorld();
  }
  follow(xUnits) { this._heroX = xUnits * U; }

  /* screen position (css px inside the 3D canvas) of a point xUnits along the
     floor and yMeters up */
  project(xUnits, yMeters) {
    const v = new THREE.Vector3(xUnits * U, yMeters, 0).project(this.camera);
    return { x: (v.x + 1) / 2 * this._w, y: (1 - v.y) / 2 * this._h };
  }
  heightOf(f) { const a = this.actors.get(f); return a ? a.height * (a.holder.scale.y || 1) + (a.opts.spec && a.opts.spec.hover || 0) : 1.9; }
  heroHeight() { return this.hero ? this.hero.height : 1.8; }
  ready() { return !!this.hero; }
}
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

/* ======================================================================
   Flash: the action-game layer on top of the Stage (Reel Slayer only).
   slayer.js pushes events into st.ev (hit, kill, parry, ult) and runs
   hit-stop / slow motion itself; this turns them into weapon trails,
   afterimages, impact slashes, launches, camera punches and ultimates.
   ====================================================================== */
const TRAIL_N = 16;
const ULT_COLOR = { sword: 0xffb24a, bomb: 0xff6a2a, bow: 0xffe08a, skull: 0xb06cff, boots: 0x6fb8ff, shield: 0xffd76a, potion: 0xff3a3a, coin: 0xffd040, key: 0x9fe0ff };

Object.assign(Stage.prototype, {
  _flashInit() {
    if (this._flashReady || !this.hero) return;
    this._flashReady = true;
    this.zoom = 1; this.punchK = 0; this.zoomUlt = 1; this.shakeK = 0;
    // weapon props: plain meshes on the hand bones; the trail runs from 35% of the blade to its tip
    const h = this.hero; h.weapons = [];
    h.root.updateMatrixWorld(true);
    h.root.traverse(o => {
      if (!o.isMesh || o.isSkinnedMesh || !o.geometry) return;
      o.geometry.computeBoundingBox();
      const b = o.geometry.boundingBox, ext = [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z];
      const ax = ext.indexOf(Math.max(...ext)), sorted = ext.slice().sort((p, q) => q - p);
      if (sorted[0] < sorted[1] * 1.8) return;               // a shield, not a blade
      const c = b.getCenter(new THREE.Vector3()), e1 = c.clone(), e2 = c.clone();
      e1.setComponent(ax, b.min.getComponent(ax)); e2.setComponent(ax, b.max.getComponent(ax));
      o.updateMatrix();
      const hand = new THREE.Vector3().applyMatrix4(o.matrix.clone().invert());
      const tip = e1.distanceTo(hand) > e2.distanceTo(hand) ? e1 : e2, grip = tip === e1 ? e2 : e1;
      h.weapons.push({ o, tip, mid: grip.clone().lerp(tip, 0.35) });
    });
    // ribbon trail
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_N * 2 * 3), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(TRAIL_N * 2 * 4), 4));
    const idx = []; for (let i = 0; i < TRAIL_N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    geo.setIndex(idx);
    this.trail = { pts: [], mesh: new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })) };
    this.trail.mesh.frustumCulled = false;
    this.scene.add(this.trail.mesh);
    // afterimages: posed copies of the hero in a flat additive colour
    this.ghosts = [];
    const K = this.phone ? 2 : 4;
    const src = []; h.root.traverse(o => src.push(o));
    for (let i = 0; i < K; i++) {
      const g = SkeletonUtils.clone(h.root);
      const mat = new THREE.MeshBasicMaterial({ color: 0x7fb8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
      g.traverse(o => { if (o.isMesh) { o.material = mat; o.frustumCulled = false; } });
      const holder = new THREE.Group(); holder.add(g); holder.visible = false; this.scene.add(holder);
      const dst = []; g.traverse(o => dst.push(o));
      this.ghosts.push({ holder, mat, src, dst, t: 1 });
    }
    this.ghostI = 0; this.ghostClock = 0;
    this.ultLight = new THREE.PointLight(0xffb24a, 0, 6, 1.4);
    this.scene.add(this.ultLight);
    this.ultObjs = [];
  },

  _ghost(color) {
    if (!this.ghosts || !this.ghosts.length) return;
    const G = this.ghosts[this.ghostI++ % this.ghosts.length];
    for (let i = 0; i < G.dst.length && i < G.src.length; i++) {
      G.dst[i].position.copy(G.src[i].position); G.dst[i].quaternion.copy(G.src[i].quaternion); G.dst[i].scale.copy(G.src[i].scale);
    }
    G.holder.position.copy(this.hero.holder.position); G.holder.rotation.copy(this.hero.holder.rotation);
    G.mat.color.setHex(color); G.t = 0; G.holder.visible = true;
  },

  _punch(k) { this.punchK = Math.max(this.punchK, k); },

  /* called from render() once per frame; rdt is real time (hit-stop and slow motion don't apply) */
  _flashFrame(st, rdt) {
    if (!this.hero) return;
    this._flashInit();
    this._events(st);
    // weapon trail: sample while a blade move (or an ultimate) is swinging
    const c = st.cur, swinging = !!(c && (c.m === 'sword' || c.m === 'skull' || c.m === 'bomb' || (st.ult && st.ult !== 'shield')));
    const T = this.trail;
    if (swinging && this.hero.weapons.length) {
      const w = this.hero.weapons[0];
      w.o.updateMatrixWorld(true);
      T.pts.unshift([w.tip.clone().applyMatrix4(w.o.matrixWorld), w.mid.clone().applyMatrix4(w.o.matrixWorld)]);
      if (T.pts.length > TRAIL_N) T.pts.length = TRAIL_N;
    } else if (T.pts.length) T.pts.length = Math.max(0, T.pts.length - 2);
    const col = new THREE.Color(st.ult ? ULT_COLOR[st.ult] || 0xffb24a : c && c.m === 'skull' ? 0xb06cff : 0xfff0c8);
    const pa = T.mesh.geometry.attributes.position, ca = T.mesh.geometry.attributes.color;
    for (let i = 0; i < TRAIL_N; i++) {
      const p = T.pts[Math.min(i, Math.max(0, T.pts.length - 1))];
      const a = T.pts.length > 1 && i < T.pts.length ? (1 - i / T.pts.length) * 0.85 : 0;
      for (let j = 0; j < 2; j++) {
        const v = p ? p[j] : new THREE.Vector3();
        pa.setXYZ(i * 2 + j, v.x, v.y, v.z);
        ca.setXYZW(i * 2 + j, col.r, col.g, col.b, a * (j ? 0.25 : 1));
      }
    }
    pa.needsUpdate = true; ca.needsUpdate = true;
    // afterimages on dashes and backsteps (and all combo long under SHADOW STEP / PHANTOM STEP)
    this.ghostClock -= rdt;
    const dashing = c && (c.m === 'boots' || c.m === 'key');
    if ((dashing || st.ult === 'boots' || st.ult === 'key') && st.mode === 'act' && this.ghostClock <= 0) {
      this.ghostClock = 0.05;
      this._ghost(st.ult === 'boots' ? 0x9a6cff : 0x7fb8ff);
    }
    for (const G of this.ghosts) {
      if (G.t >= 1) continue;
      G.t += rdt / 0.4; G.mat.opacity = 0.5 * Math.max(0, 1 - G.t);
      if (G.t >= 1) G.holder.visible = false;
    }
    // ultimate aura and props
    this._ultFrame(st, rdt);
    // camera punch decays fast; an ultimate holds a closer frame
    this.punchK = Math.max(0, this.punchK - rdt * 0.9);
    this.shakeK = Math.max(0, this.shakeK - rdt * 0.6);
    const want = Math.max(st.ult && st.mode === 'act' ? 1.2 : 1, 1 + this.punchK);
    this.zoom += (want - this.zoom) * Math.min(1, rdt * (want > this.zoom ? 14 : 3));
  },

  _events(st) {
    const ev = st.ev; if (!ev || !ev.length) return;
    for (const e of ev) {
      if (e.k === 'hit') {
        const a = this.actors.get(e.f), h = a ? a.height * 0.55 : 1;
        const pos = new THREE.Vector3(e.x * U, h, 0.35);
        this._burst(e.crit ? 0xffd27a : 0xffe6c0, pos, e.heavy ? 28 : 14, e.heavy ? 3.4 : 2.2, 0.45);
        this._impactX(pos, e.crit ? 0xffd27a : st.ult ? ULT_COLOR[st.ult] : 0xfff4dc, e.heavy ? 1.1 : 0.75);
        this._flash(e.crit ? 0xffc060 : 0xffe0b0, e.heavy ? 10 : 5, pos.x);
        this._punch(e.crit ? 0.16 : e.heavy ? 0.1 : 0.05);
        this.shakeK = Math.max(this.shakeK, e.heavy ? 0.12 : 0.05);
      } else if (e.k === 'kill') {
        const pos = new THREE.Vector3(e.x * U, 1.1, 0.3);
        this._burst(0xcfa8ff, pos, e.boss ? 80 : 40, 3.2, 1.1);
        this._burst(0xffffff, pos, 18, 4.5, 0.5);
        this._ringFx(0xd8b8ff, new THREE.Vector3(pos.x, 0.05, 0), 0.4, e.boss ? 6 : 3.2, 0.6, true);
        this._flash(0xc8a0ff, e.boss ? 18 : 10, pos.x);
        this._punch(e.boss ? 0.25 : 0.14);
      } else if (e.k === 'parry') {
        const p = new THREE.Vector3(this.hero.holder.position.x, 1.2, 0.4);
        this._ringFx(0xbfe8ff, p, 0.3, 1.8, 0.35);
        this._burst(0xbfe8ff, p, 24, 3, 0.4);
        this._flash(0x9fd6ff, 12, p.x); this._punch(0.12);
      } else if (e.k === 'ult') this._ultStart(e.sym, st);
    }
    ev.length = 0;
  },

  /* two crossed slash strokes at the point of impact */
  _impactX(pos, color, size) {
    for (const r of [0.7, -0.7]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(size * 1.6, size * 0.12), new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, map: this.glowTex }));
      m.position.copy(pos); m.rotation.z = r;
      this.scene.add(m);
      this.fx.push({ obj: m, t: 0, dur: 0.22, kind: 'slashX', base: size });
    }
  },

  _ultStart(sym, st) {
    this._ultEnd();
    this.ult = { sym, t: 0 };
    const col = ULT_COLOR[sym] || 0xffb24a;
    this.ultLight.color.setHex(col);
    const x = this.hero.holder.position.x;
    this._ringFx(col, new THREE.Vector3(x, 0.05, 0), 0.5, 5, 0.8, true);
    this._burst(col, new THREE.Vector3(x, 1, 0.3), 50, 3.5, 1);
    this._flash(col, 16, x); this._punch(0.2);
    if (sym === 'sword') {                         // BLADE STORM: blades orbit the hero
      for (let i = 0; i < 3; i++) {
        const m = new THREE.Mesh(new THREE.RingGeometry(1.05, 1.3, 32, 1, 0, Math.PI * 0.55), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
        m.userData.spin = 7 + i * 2; m.userData.tilt = i * 0.9; m.rotation.x = Math.PI / 2 - 0.3;
        this.scene.add(m); this.ultObjs.push(m);
      }
    } else if (sym === 'shield') {                 // IRON WALL: a golden dome
      const m = new THREE.Mesh(new THREE.SphereGeometry(1.4, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, wireframe: true }));
      this.scene.add(m); this.ultObjs.push(m);
    } else if (sym === 'potion') {                 // BLOOD MOON: a red moon over the fight
      const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: 0xff3a2a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      m.scale.set(3, 3, 1); m.userData.moon = true; this.scene.add(m); this.ultObjs.push(m);
    }
  },

  _ultEnd() {
    for (const o of this.ultObjs || []) { this.scene.remove(o); o.geometry && o.geometry.dispose(); o.material && o.material.dispose(); }
    this.ultObjs = []; this.ult = null;
    if (this.ultLight) this.ultLight.intensity = 0;
  },

  _ultFrame(st, rdt) {
    if (!this.ult) return;
    if (!st.ult || st.mode !== 'act') { this._ultEnd(); return; }
    const u = this.ult; u.t += rdt;
    const hp = this.hero.holder.position;
    this.ultLight.position.set(hp.x, 1.3, 0.8);
    this.ultLight.intensity = 5 + Math.sin(u.t * 12) * 1.5;
    for (const o of this.ultObjs) {
      if (o.userData.spin) { o.position.set(hp.x, 1.0 + Math.sin(u.t * 3 + o.userData.tilt) * 0.25, 0); o.rotation.z += o.userData.spin * rdt; }
      else if (o.userData.moon) o.position.set(hp.x + 1.5, 4.2, -2.6);
      else { o.position.set(hp.x, 0, 0); o.material.opacity = 0.2 + Math.sin(u.t * 8) * 0.08; o.rotation.y += rdt; }
    }
    // a steady rain of the ultimate's colour
    this._ultRain = (this._ultRain || 0) - rdt;
    if (this._ultRain <= 0) {
      this._ultRain = 0.07;
      const s = u.sym;
      if (s === 'coin') this._burst(0xffd040, new THREE.Vector3(hp.x + (Math.random() - 0.5) * 3, 3.5, 0.3), 6, 1.2, 1.1);
      else if (s === 'potion') this._burst(0xff4040, new THREE.Vector3(hp.x + (Math.random() - 0.5) * 2, 0.2, 0.3), 5, 1, 1.2);
    }
  },

  /* ultimate versions of a move's effect; returns true when it replaced the normal one */
  _ultMoveFx(st, c) {
    if (!st.ult) return false;
    const x = st.x * U, delay = (MOVE_HIT[c.m] || 0.4) * c.dur * 1000;
    if (c.m === 'bomb' && st.ult === 'bomb') {      // METEOR FALL
      for (let i = 0; i < 7; i++) setTimeout(() => this._meteor(x + (Math.random() - 0.5) * 7), i * 70);
      return true;
    }
    if (c.m === 'bow' && st.ult === 'bow') {        // ARROW RAIN
      for (let i = 0; i < 26; i++) setTimeout(() => this._arrowDrop(x + st.face * (0.5 + Math.random() * 6)), i * 22);
      return true;
    }
    if (c.m === 'skull' && st.ult === 'skull') {    // SOUL REAP: a giant scything arc
      setTimeout(() => {
        this._arcFx(st, 0xb06cff, 3.2, 7); this._ringFx(0xb06cff, new THREE.Vector3(x, 0.05, 0), 0.5, 8, 0.8, true);
        this._burst(0xd0a0ff, new THREE.Vector3(x, 1.2, 0.3), 70, 4.5, 1.2); this._flash(0x9a50ff, 20, x);
      }, delay);
      return true;
    }
    if (c.m === 'sword' && st.ult === 'sword') {    // BLADE STORM: the arcs come round twice
      setTimeout(() => { this._arcFx(st, 0xffb24a, 1.6, 9); this._arcFx(st, 0xfff0c8, 1.2, -9); }, delay * 0.6);
      return false;
    }
    return false;
  },

  _meteor(tx) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: 0xff8a3a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    sp.scale.set(0.9, 0.9, 1); sp.position.set(tx - 2.5, 7, 0.2); this.scene.add(sp);
    this.fx.push({ obj: sp, t: 0, dur: 0.4, kind: 'fall', from: sp.position.clone(), to: new THREE.Vector3(tx, 0.2, 0.2), done: () => {
      const p = new THREE.Vector3(tx, 0.5, 0.3);
      this._spriteFx(0xffa050, p, 1.4, 0.5, 3); this._ringFx(0xff7a30, new THREE.Vector3(tx, 0.05, 0), 0.3, 2.6, 0.5, true);
      this._burst(0xffc070, p, 24, 3, 0.8); this._flash(0xffa060, 10, tx); this._punch(0.06);
    } });
  },

  _arrowDrop(tx) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.8, 5), new THREE.MeshBasicMaterial({ color: 0xffe0a0 }));
    m.position.set(tx - 1, 6, 0.2); m.rotation.z = 0.2; this.scene.add(m);
    this.fx.push({ obj: m, t: 0, dur: 0.32, kind: 'fall', from: m.position.clone(), to: new THREE.Vector3(tx, 0.3, 0.2), done: () => this._burst(0xffe0a0, new THREE.Vector3(tx, 0.3, 0.3), 5, 1.2, 0.3) });
  },
});
