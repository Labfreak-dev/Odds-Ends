/* Real-time throne room for the final Death fight.
   Lazy-loaded by index.html only after a Death fight starts. Fight rules stay
   in the page; this file only watches run/view and draws. If WebGL or an asset
   fails, boot() reports live:false and the painted arena keeps drawing. */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { DEATH3D_MANIFEST } from './manifest.js';
import { makeTextures, buildDeath, buildHeroes, buildThrone, buildRoom } from './placeholders.js';

const UP = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
/* One clock for robe wind, flame sheets, and the dissolve. */
const SHARED_TIME = { value: 0 };
const NO_DISSOLVE = { value: 0 };
/* Phones and software GL skip the custom rim shader. Materials stay
   MeshStandard so the packed normal, roughness and metal maps still show. */
let D3D_FAST = false;

/* The fight class puts the 3D view full-screen and packs the reels into a
   bottom strip. Removing it restores the crawl exactly. */
function markDeathLayout(canvas, on) {
  const wrap = canvas && canvas.parentElement;
  if (wrap) wrap.classList.toggle('death3d', !!on);
  const game = typeof document !== 'undefined' && document.getElementById('game');
  if (game) {
    game.classList.toggle('death3d', !!on);
    if (!on) game.style.removeProperty('--death-strip');
  }
  if (on && typeof window !== 'undefined') {
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  }
}

export async function boot(canvas) {
  const api = {
    live: false,
    failed: false,
    shown: false,
    reason: '',
    tick() {},
    stop() {},
    resize() {},
    status() { return { live: false, failed: api.failed, reason: api.reason }; },
  };
  try {
    const arena = new Arena(canvas, api);
    const ok = arena.init();
    if (!ok) {
      api.failed = true;
      api.reason = api.reason || 'no-webgl';
      window.LDDeath3D = api;
      return api;
    }
    await arena.start();
    window.LDDeath3D = api;
    return api;
  } catch (err) {
    console.warn('Death 3D failed; painted arena stays.', err);
    api.failed = true;
    api.live = false;
    api.reason = 'exception';
    markDeathLayout(canvas, false);
    window.LDDeath3D = api;
    return api;
  }
}

class Arena {
  constructor(canvas, api) {
    this.canvas = canvas;
    this.api = api;
    this.manifest = DEATH3D_MANIFEST;
    this.fightId = 0;
    this.phase = 1;
    this.prevHurt = 0;
    this.prevLunge = 0;
    this.prevFlash = 0;
    this.won = false;
    this.downed = false;
    this.fallT = 0;
    this.crumbleT = 0;
    this.cineOn = false;
    this.cineT = 0;
    this.attackT = -1;
    this.flinchT = 0;
    this.dodgeT = 0;
    this.lastCue = '';
    this.glb = 0;
    this.pack = false;
    this.stand = null;
    this.heroPending = {};
    this.activeHero = 'knight';
    this.uTime = SHARED_TIME;
  }

  init() {
    const canvas = this.canvas;
    this.low = lowEnd();
    let gl = null;
    let softwareGuess = false;
    try {
      const probe = document.createElement('canvas');
      const pgl = probe.getContext('webgl2', { antialias: false, failIfMajorPerformanceCaveat: false });
      if (pgl) {
        softwareGuess = glIsSoftware(pgl);
        const lose = pgl.getExtension('WEBGL_lose_context');
        if (lose) lose.loseContext();
      }
    } catch (e) { /* ignore */ }
    const aa = !this.low && !softwareGuess && (window.devicePixelRatio || 1) < 1.5;
    try {
      gl = canvas.getContext('webgl2', {
        alpha: false,
        antialias: aa,
        powerPreference: 'high-performance',
        failIfMajorPerformanceCaveat: false,
      });
    } catch (e) { gl = null; }
    if (!gl) {
      this.api.reason = 'no-webgl';
      return false;
    }
    const renderer = new THREE.WebGLRenderer({ canvas, context: gl, alpha: false, antialias: aa });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.AgXToneMapping;
    /* +0.3 EV (1.23) is the mock's start. 1.5 lifts the midtones to that
       frame once three.js is shading without volumetric scatter. */
    renderer.toneMappingExposure = 1.5;
    const bootBg = new THREE.Color();
    bootBg.setRGB(0.006, 0.008, 0.007);
    renderer.setClearColor(bootBg, 1);
    /* SwiftShader (and a phone) cannot afford a shadow map or a bloom pass.
       A real GPU keeps one small spotlight shadow and a tight bloom. */
    this.gpuName = glRendererName(gl);
    this.software = glIsSoftware(gl);
    this.budget = this.low || this.software;
    renderer.shadowMap.enabled = !this.budget;
    /* r186 removed PCFSoftShadowMap (it warns and falls back). Softness is
       the spotlight's shadow.radius on PCFShadowMap. */
    renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.scene.background = bootBg;
    this.scene.fog = new THREE.FogExp2(0x374838, 0.034);
    const cam = this.manifest.layout.camera;
    this.camera = new THREE.PerspectiveCamera(cam.fov, 1, 0.08, 40);
    this.baseCam = new THREE.Vector3().fromArray(cam.pos);
    this.baseLook = new THREE.Vector3().fromArray(cam.look);
    this.pushCam = new THREE.Vector3(-0.3, 2.2, -0.1);
    this.pushLook = new THREE.Vector3(0, 3.1, 6.75);
    this.camPos = this.baseCam.clone();
    this.lookPos = this.baseLook.clone();
    this.director = new CameraDirector(this);

    this.tex = makeTextures();
    this._buildLights();
    this.room = buildRoom(this.tex);
    this.throne = buildThrone();
    this.deathBuilt = buildDeath();
    this.heroes = buildHeroes();
    this.scene.add(this.room.group);

    this.throneAnchor = new THREE.Group();
    this.throneAnchor.position.fromArray(this.manifest.layout.throne);
    this.throneAnchor.add(this.throne.group);
    this.scene.add(this.throneAnchor);

    this.deathAnchor = new THREE.Group();
    this.deathAnchor.position.fromArray(this.manifest.layout.deathSeat);
    /* Placeholder is built facing +Z. Turn that mesh toward the hero.
       The anchor itself stays unrotated so a GLB's `facing` is the only yaw. */
    this.deathBuilt.group.rotation.y = Math.PI;
    this.deathBuilt.group.scale.setScalar(1.08);
    this.deathAnchor.add(this.deathBuilt.group);
    this.throneAnchor.add(this.deathAnchor);

    this.heroAnchor = new THREE.Group();
    this.heroAnchor.position.fromArray(this.manifest.layout.hero);
    for (const id of Object.keys(this.heroes)) {
      this.heroes[id].group.visible = id === 'knight';
      this.heroAnchor.add(this.heroes[id].group);
    }
    this.scene.add(this.heroAnchor);

    this.deathActor = new Actor(this.deathBuilt, this.deathAnchor);
    this.heroActors = {};
    for (const id of Object.keys(this.heroes)) this.heroActors[id] = new Actor(this.heroes[id], this.heroAnchor);

    this._buildVfx();
    this._placeLights();
    if (!this.budget) this._setupEnv();
    flagShadows(this.room.group);
    flagShadows(this.throne.group);
    flagShadows(this.deathBuilt.group);
    for (const id of Object.keys(this.heroes)) flagShadows(this.heroes[id].group);
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.api.live = false;
      this.api.failed = true;
      this.api.reason = 'context-lost';
      this.api.shown = false;
      markDeathLayout(canvas, false);
      console.warn('Death 3D lost the WebGL context; painted arena stays.');
    }, { once: true });
    return true;
  }

  async start() {
    this._mountApi();
    await this._loadAssets();
    markDeathLayout(this.canvas, true);
    await new Promise(r => requestAnimationFrame(r));
    this.resize();
    if (!this.canvas.clientWidth || !this.canvas.clientHeight) {
      this.api.reason = 'no-size';
      this.api.failed = true;
      return;
    }
    this._ensureComposer();
    this.director.start('intro');
    this.director.apply(0, motionScale(), null);
    this._skipEvt = (e) => {
      if (!this.api.shown || !this.director) return;
      const id = e.target && e.target.id;
      if (id === 'scene' || id === 'scene3d') this.director.skip();
    };
    window.addEventListener('pointerdown', this._skipEvt);
    this._render();
    markDeathLayout(this.canvas, true);
    this.api.shown = true;
    this.api.live = true;
  }

  _mountApi() {
    const self = this;
    const api = this.api;
    api.tick = (dt) => self.tick(dt);
    api.stop = () => self.stop();
    api.resize = () => self.resize();
    api.status = () => self.status();
  }

  resize() {
    const c = this.canvas;
    const w = c.clientWidth, h = c.clientHeight;
    if (!w || !h || !this.renderer) return;
    let pr = Math.min(pixelCap(), window.devicePixelRatio || 1);
    /* SwiftShader's fill rate is the frame. A slightly smaller buffer is
       what gets a phone near the old 24 fps and a desktop near 14. */
    /* MeshStandard with the packed maps costs more than the old Lambert hall.
       A slightly smaller buffer keeps software GL near the old frame rate. */
    if (this.software) pr = Math.min(pr, this.low ? 0.45 : 0.42);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    if (this.composer) {
      this.composer.setPixelRatio(pr);
      this.composer.setSize(w, h);
    }
    this.camera.aspect = w / h;
    const aspect = w / h;
    let framed = this.pack ? framePack(aspect) : frameShot(aspect, this.manifest.layout.hero);
    if (this.pack) {
      const fit = this._solveFit(aspect);
      if (fit) {
        framed = fit;
        this._fitKey = this.activeHero + '@' + aspect.toFixed(3);
      } else this._fitKey = '';
    }
    this.camera.fov = framed.fov;
    this.camera.far = this.pack ? 90 : 40;
    this.baseCam.copy(framed.pos);
    this.baseLook.copy(framed.look);
    if (this.pack) {
      /* A short push. The fitted shot already fills the frame, so a long
         dolly would crop the hero the moment a phase starts. */
      this.pushCam.copy(framed.pos).add(new THREE.Vector3(0.04, 0.1, -0.4));
      this.pushLook.copy(framed.look).add(new THREE.Vector3(0, 0.12, -0.08));
    } else {
      this.pushCam.copy(framed.pos).add(new THREE.Vector3(0.06, 0.4, 0.95));
      this.pushLook.copy(framed.look).add(new THREE.Vector3(0, 0.85, 0));
    }
    this.camera.updateProjectionMatrix();
    const pts = this.vfx && this.vfx.pool && this.vfx.pool.mat.uniforms;
    if (pts && pts.uDpr) {
      pts.uDpr.value = pr;
      pts.uMax.value = 56 * pr;
    }
  }

  stop() {
    this.api.shown = false;
    markDeathLayout(this.canvas, false);
  }

  show() {
    if (this.api.shown) return;
    markDeathLayout(this.canvas, true);
    this.api.shown = true;
    this.resize();
  }

  tick(dt) {
    /* Wall-clock delta. The page caps the value it passes at 0.05s, which
       stretches a 2.6s intro past ten seconds when the frame rate is low.
       0.5s still refuses to skip a whole shot on a hitch. */
    const nowMs = performance.now();
    let clockDt = this._clockMs ? (nowMs - this._clockMs) / 1000 : (dt || 0);
    this._clockMs = nowMs;
    if (!(clockDt > 0)) clockDt = 0;
    dt = clockDt > 0.5 ? 0.5 : clockDt;
    if (!this.api.live || !window.LD || !window.LD.run || !window.LD.run.death) return;
    this.show();
    const run = window.LD.run;
    const view = window.LD.view || {};
    const death = (run.objs || []).find(o => o.t === 'death');
    if (!death) return;
    if (death.id !== this.fightId) this._newFight(death);
    const heroId = this.heroes[run.hero] ? run.hero : 'knight';
    if (heroId !== this.activeHero || (this.pack && !this.heroActors[heroId].model && !this.heroPending[heroId])) {
      this._showHero(heroId);
    }
    const motion = motionScale();
    const t = performance.now() / 1000;
    this.uTime.value = t;
    const hurt = view.hurt || 0;
    const lunge = view.lunge || 0;
    const flash = death.flash || 0;
    const hurtRose = hurt > this.prevHurt + 0.12;
    const lungeRose = lunge > this.prevLunge + 0.25;
    const flashRose = flash > this.prevFlash + 0.2;
    this.prevHurt = hurt;
    this.prevLunge = lunge;
    this.prevFlash = flash;

    const cues = view.dcues || [];
    if (view.dcues) view.dcues = [];
    for (const c of cues) {
      if (c && t - (c.now || 0) / 1000 < 1.6) this._cue(c, hurtRose, motion);
    }
    if ((death.phase || 1) !== this.phase) this._phase(death.phase || 1, motion);

    if (lungeRose) {
      this.attackT = 0;
      this.heroActors[this.activeHero].play('attack');
      this.director.start('hero');
    }
    if (flashRose) {
      this.flinchT = motion.reduced ? 0.12 : 0.32;
      this.deathActor.play('hit');
      this.vfx.sparks(this._anchorWorld(this.deathActor, 'chest'), flash);
      this.hitLight.color.set(0xffe2b0);
      const calm = motion.reduced || reduceFlashing();
      this.hitLight.intensity = calm ? 2.2 : 8;
      this.hitLight.position.copy(this._anchorWorld(this.deathActor, 'chest'));
      if (this.director.mode !== 'hero') this.director.start('flinch');
    }
    if (hurtRose) {
      this.heroActors[this.activeHero].play('hit');
      this.hitLight.color.set(0xff3030);
      const calm = motion.reduced || reduceFlashing();
      this.hitLight.intensity = Math.max(this.hitLight.intensity, calm ? 1.6 : 6);
      this.hitLight.position.copy(this.heroAnchor.position).y += 1.1;
      this.director.start('blast');
    }
    if (run.hp <= 0 && !this.downed && !this.won) {
      this.downed = true;
      this.fallT = 0;
      this.heroActors[this.activeHero].play('death');
      this.director.start('loss');
    } else if (run.hp > 0 && this.downed) {
      this.downed = false;
      this.fallT = 0;
      this.heroActors[this.activeHero].play('idle');
      if (this.director.mode === 'loss') this.director.start('rest');
    }
    if (death.gone && !this.won) this._win();

    if (this.attackT >= 0) {
      this.attackT += dt / (0.78 * motion.k);
      if (this.attackT > 1) this.attackT = -1;
    }
    if (this.flinchT > 0) this.flinchT = Math.max(0, this.flinchT - dt);
    if (this.dodgeT > 0) this.dodgeT = Math.max(0, this.dodgeT - dt);

    this.deathActor.update(dt);
    this.heroActors[this.activeHero].update(dt);
    if (this.tex.fire && this.tex.fire.userData._sheet) advanceSheet(this.tex.fire, dt);
    if (this.flameSprites) {
      for (const sp of this.flameSprites) {
        const base = sp.userData.base || 0.4;
        sp.scale.setScalar(base * (0.92 + Math.sin(t * 13 + sp.position.x * 4) * 0.08));
      }
    }
    this._pose(dt, t, death, lunge, hurt, motion);
    this._maybeFit();
    this._lights(t, motion);
    this._camera(dt, view, motion);
    this.vfx.update(dt, t, this);
    this._render();
  }

  _newFight(death) {
    this.fightId = death.id;
    this.phase = death.phase || 1;
    this.won = false;
    this.downed = false;
    this.fallT = 0;
    this.crumbleT = 0;
    this.cineOn = false;
    this.cineT = 0;
    this.attackT = -1;
    this.flinchT = 0;
    this.dodgeT = 0;
    const viewNow = (window.LD && window.LD.view) || {};
    this.prevHurt = viewNow.hurt || 0;
    this.prevLunge = viewNow.lunge || 0;
    this.prevFlash = death.flash || 0;
    this.deathActor.play('idle');
    this.heroActors[this.activeHero].play('idle');
    if (this.director) this.director.start('intro');
    this.vfx.clear();
    for (const m of this.deathActor.mats || []) {
      if (m.userData._op0 != null) m.opacity = m.userData._op0;
      m.transparent = !!m.userData._tr0;
    }
  }

  _cue(c, hurtRose, motion) {
    this.lastCue = c.kind || '';
    const big = (c.phase || this.phase) >= 3 || (c.v || 0) >= 10;
    if (c.kind === 'atk') {
      this.director.start('blast');
      const fire = () => {
        if (big) this.vfx.playBeam(this, !hurtRose, motion);
        else this.vfx.playBlast(this, !hurtRose, motion);
      };
      if (this.deathActor.mixer) {
        /* Windup, then the right-hand sweep that releases the shot. */
        this.deathActor.play('cast', {
          timeScale: 3,
          then: { name: 'attack', timeScale: 1.7, fire },
        });
      } else {
        this.deathActor.play(big ? 'attack' : 'cast');
        fire();
      }
    } else if (c.kind === 'drain') {
      this.deathActor.play('cast');
      this.vfx.drain(this, motion);
    } else if (c.kind === 'curse' || c.kind === 'jam' || c.kind === 'jamwheel') {
      this.vfx.playSigil(c.kind, this, motion);
    } else if (c.kind === 'grow') {
      this.deathActor.play('cast');
      this.vfx.heal(this, motion);
    } else if (c.kind === 'phase') {
      this._phase(c.phase || this.phase, motion);
    } else if (c.kind === 'win') {
      this._win();
    }
    if ((c.kind === 'atk' || c.kind === 'drain') && !hurtRose) {
      this.dodgeT = 0.45 * motion.k;
      this.heroActors[this.activeHero].play('dodge');
    }
  }

  _phase(ph, motion) {
    ph = ph || 1;
    if (ph === this.phase && this.cineOn) return;
    if (ph < this.phase) { this.phase = ph; return; }
    this.phase = ph;
    this.cineOn = true;
    this.cineT = 0;
    if (this.director) this.director.start('phase');
    if (ph >= 2) this.deathActor.play('cast');
  }

  _win() {
    if (this.won) return;
    this.won = true;
    this.crumbleT = 0;
    this.deathActor.play('defeat');
    this.heroActors[this.activeHero].play('victory');
    if (this.director) this.director.start('win');
  }

  _pose(dt, t, death, lunge, hurt, motion) {
    const amp = motion.reduced ? 0.35 : 1;
    const hero = this.heroActors[this.activeHero];
    const base = this.stand ? this.stand.hero : this.manifest.layout.hero;
    const sign = this.stand ? this.stand.lungeSign : 1;
    /* Step in, hold through the strike, then come back. view.lunge still
       drives the placeholder, which has no clip timing of its own. */
    let lungeZ;
    if (this.pack && this.attackT >= 0) {
      const u = this.attackT;
      let k = u < 0.28 ? u / 0.28 : (u < 0.62 ? 1 : Math.max(0, 1 - (u - 0.62) / 0.38));
      k = k * k * (3 - 2 * k);
      lungeZ = sign * 2.05 * k;
    } else {
      const snap = Math.min(1, lunge * 1.6);
      const reach = hero.driving === 'clip' ? 1.15 : 2.6;
      lungeZ = sign * reach * Math.pow(snap, 0.38);
    }
    this.heroAnchor.position.set(base[0] + Math.sin(this.dodgeT * 9) * this.dodgeT * 0.55, base[1] - this.fallT * 0.55, base[2] + lungeZ);
    if (hero.group.visible) poseHero(hero, t, {
      attack: this.attackT < 0 ? 0 : this.attackT,
      hurt: Math.min(1, hurt) * amp,
      dodge: this.dodgeT,
      dead: this.fallT,
      amp,
    });
    for (const m of hero.sway || []) if (m.userData.sway) m.userData.sway(t, amp);

    const d = this.deathActor;
    const fl = Math.min(1, this.flinchT / 0.32);
    if (d.group.visible) poseDeath(d, t, { pose: Math.min(1, death.pose || 0), flinch: fl, phase: this.phase, amp, won: this.won ? this.crumbleT : 0 });
    for (const m of d.sway || []) if (m.userData.sway) m.userData.sway(t, (this.phase >= 3 ? 1.7 : 1) * amp);

    if (this.won) {
      this.crumbleT += dt;
      const k = Math.min(1, this.crumbleT / 2.4);
      /* A real mesh dissolves. Fast materials have no dissolve shader, so they fade. */
      if (!d.dissolve || D3D_FAST) {
        const mats = d.model ? collectMats(d.model) : (d.mats || []);
        for (const m of mats) {
          if (m.userData._op0 == null) { m.userData._op0 = m.opacity == null ? 1 : m.opacity; m.userData._tr0 = !!m.transparent; }
          m.transparent = true;
          m.opacity = (1 - k) * m.userData._op0;
        }
      }
      if (d.group.visible && d.bones.head) d.bones.head.position.y += 0.004 * k;
      if (Math.random() < 0.55) this.vfx.puff(this._anchorWorld(d, 'chest'), 'soul', 2);
    }
    if (this.downed) this.fallT = Math.min(1, this.fallT + dt * 0.65);
    if (d.dissolve) d.dissolve.value = this.won ? Math.min(1, this.crumbleT / 2.2) : 0;
  }

  _lights(t, motion) {
    const calm = motion.reduced || reduceFlashing();
    const flick = calm ? 0 : (Math.sin(t * 9.0) * 0.5 + Math.sin(t * 23.0) * 0.35 + Math.sin(t * 47.0) * 0.15);
    const torch = 1 + flick * 0.14;
    if (this.flameLights) {
      for (let i = 0; i < this.flameLights.length; i++) {
        const L = this.flameLights[i];
        const base = L.userData.base || 1;
        const wobble = calm ? 0 : Math.sin(t * (L.userData.brazier ? 11 : 8) + i * 1.7) * (L.userData.brazier ? 0.12 : 0.08);
        L.intensity = base * (1 + wobble);
      }
    } else if (this.brazierL) {
      this.brazierL[0].intensity = 3.2 * torch;
      this.brazierL[1].intensity = 2.6 * (1 + (calm ? 0 : Math.cos(t * 11.0) * 0.12));
    }
    const ph = this.phase;
    if (this.rim) this.rim.intensity = (this.rimBase || this.rim.intensity) * (this.won ? 0.45 : 1);
    if (this.daisLight) {
      const breathe = 0.92 + (calm ? 0 : 0.08 * Math.sin(t * 2.4));
      this.daisLight.intensity = (this.daisLight.userData.base || 17.5) * breathe * (this.won ? 0.55 : 1);
    }
    const eyePos = this._anchorWorld(this.deathActor, 'eyes');
    if (this.cheapSprite) {
      this.cheapSprite.position.copy(eyePos);
      this.cheapSprite.material.opacity = 0.28 + (ph - 1) * 0.08;
    }
    if (this.throne.crackMat) this.throne.crackMat.emissiveIntensity = 0.15 + (ph - 1) * 1.35;
    for (const c of this.throne.cracks) {
      const want = ph >= c.userData.phase ? 1 : 0.001;
      c.scale.y += (want - c.scale.y) * 0.08;
    }
    for (const f of this.fires) {
      const on = ph >= f.userData.phase && !this.won;
      f.visible = on;
      if (on) {
        const s = 0.85 + Math.sin(t * 14 + f.position.x) * 0.2;
        f.scale.setScalar(s * (0.7 + ph * 0.25));
      }
    }
    if (this.soulSprites) {
      for (const s of this.soulSprites) {
        const base = s.userData.base || 0.5;
        s.scale.setScalar(base * (0.92 + Math.sin(t * 2.2 + s.position.y) * 0.08));
      }
    }
    if (this.hitLight.intensity > 0.05) this.hitLight.intensity *= motion.reduced ? 0.7 : 0.82;
    else this.hitLight.intensity = 0;
    for (const d of this.room.dice) d.rotation.y += d.userData.spin * 0.016;
    for (const c of this.room.candles) {
      const sp = c.userData.sprite;
      if (sp) sp.scale.setScalar(0.16 + Math.sin(t * 11 + c.position.x * 4) * 0.035);
    }
  }

  _camera(dt, view, motion) {
    if (this.cineOn) {
      const dur = motion.reduced ? 0.35 : 1.5;
      this.cineT += dt / dur;
      if (this.cineT >= 1) { this.cineT = 1; this.cineOn = false; }
    }
    if (this.director) this.director.apply(dt, motion, view);
  }

  _anchorWorld(actor, name) {
    const a = actor.anchors && actor.anchors[name];
    if (a) {
      a.updateWorldMatrix(true, false);
      return a.getWorldPosition(_v).clone();
    }
    if (actor.model) return actor.model.getWorldPosition(_w).clone();
    return actor.anchor.getWorldPosition(_w).clone();
  }

  _render() {
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  _buildLights() {
    const scene = this.scene;
    /* A trace of sky/ground so the placeholder room is not black. The pack
       replaces this with the mock's sun, braziers and green spots. */
    const hemi = new THREE.HemisphereLight(0x243028, 0x14110e, 0.15);
    scene.add(hemi);
    this.hemi = hemi;
    this.rim = null;
    this.key = null;
    this.soulLight = null;
    /* Placeholder flames, removed once the hall GLB's sockets take over. */
    this.brazierL = [new THREE.PointLight(0xff5c24, 2.2, 6, 2), new THREE.PointLight(0xff5c24, 1.8, 6, 2)];
    this.brazierL.forEach(l => scene.add(l));
    this.hitLight = new THREE.PointLight(0xffe2b0, 0, 4.5, 2);
    scene.add(this.hitLight);
    this.candleL = new THREE.PointLight(0xffb067, 0.6, 2.4, 2);
    scene.add(this.candleL);
  }

  /* Phones skip the bloom pass. A soft additive halo stands in for it. */
  _cheapGlow() {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.tex.soul,
      color: 0xb8ffe4,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      opacity: 0.32,
      toneMapped: false,
    }));
    s.scale.setScalar(0.42);
    s.material.opacity = 0.28;
    this.scene.add(s);
    this.cheapSprite = s;
  }

  _setupEnv() {
    try {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      const room = new RoomEnvironment();
      const tex = pmrem.fromScene(room, 0.04).texture;
      this.scene.environment = tex;
      this.envMap = tex;
      room.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach(m => m.dispose && m.dispose());
        }
      });
      pmrem.dispose();
    } catch (err) {
      console.warn('Death 3D environment map failed; lights still shade the room.', err);
    }
  }

  _ensureComposer() {
    if (this.budget || this.low || this.composer || this._composerFailed || !this.renderer) return;
    try {
      const composer = new EffectComposer(this.renderer);
      composer.addPass(new RenderPass(this.scene, this.camera));
      const size = new THREE.Vector2(this.canvas.clientWidth || 256, this.canvas.clientHeight || 256);
      /* Threshold sits above lit bone. Only flames, eyes and soul sprites,
         which are drawn un-tone-mapped, cross it. */
      /* Artist mock: strength 0.6, radius 0.8, threshold 0.7, before OutputPass. */
      const bloom = new UnrealBloomPass(size, 0.6, 0.8, 0.7);
      composer.addPass(bloom);
      composer.addPass(new OutputPass());
      this.composer = composer;
      this.bloom = bloom;
      this.resize();
    } catch (err) {
      console.warn('Death 3D bloom unavailable; lighting stays.', err);
      this._composerFailed = true;
      this.composer = null;
    }
  }

  _placeLights() {
    const b = this.room.braziers;
    this.brazierL[0].position.set(b[0].position.x, 1.7, b[0].position.z);
    this.brazierL[1].position.set(b[1].position.x, 1.7, b[1].position.z);
    this.candleL.position.set(0, 2.4, 4.2);
    const flame = (parent, y, scale, tex, color) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, color, blending: THREE.AdditiveBlending, transparent: true,
        depthWrite: false, toneMapped: false,
      }));
      s.position.y = y;
      s.scale.setScalar(scale);
      parent.add(s);
      return s;
    };
    for (const br of this.room.braziers) flame(br, br.userData.flameY, 0.28, this.tex.fire, 0xffaa66);
    for (const c of this.room.candles) c.userData.sprite = flame(c, c.userData.flameY, 0.18, this.tex.fire, 0xffd9a0);
    const eye = this.deathActor.anchors.eyes;
    [-1, 1].forEach(s => {
      const h = flame(eye, 0, 0.22, this.tex.soul, 0x0c4a3c);
      h.position.set(s * 0.078, 0, 0.01);
      h.scale.setScalar(0.1);
      h.material.opacity = 0.85;
    });
    this.fires = this.throne.fires.map(a => {
      const s = flame(a, 0.15, 0.55, this.tex.soul, 0x9dffdf);
      s.userData.phase = a.userData.phase;
      s.visible = false;
      return s;
    });
  }

  _buildVfx() {
    this.vfx = new VFX(this.scene, this.tex);
  }

  async _loadAssets() {
    const man = this.manifest;
    const runHero = window.LD && window.LD.run && window.LD.run.hero;
    if (runHero && this.heroes[runHero]) this.activeHero = runHero;
    const wantGltf = Object.entries(man.assets).some(([k, slot]) => k !== 'vfx' && slot && slot.url);
    if (wantGltf) {
      const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
      const { DRACOLoader } = await import('three/addons/loaders/DRACOLoader.js');
      const { MeshoptDecoder } = await import('three/addons/libs/meshopt_decoder.module.js');
      if (MeshoptDecoder.ready) await MeshoptDecoder.ready;
      this.gltfLoader = new GLTFLoader();
      this.draco = new DRACOLoader();
      this.draco.setDecoderPath('vendor/three/addons/libs/draco/gltf/');
      this.gltfLoader.setDRACOLoader(this.draco);
      this.gltfLoader.setMeshoptDecoder(MeshoptDecoder);
    }
    const vfx = man.assets.vfx || {};
    const texJobs = Object.keys(vfx).map(key => {
      if (!vfx[key]) return null;
      return new THREE.TextureLoader().loadAsync(resolveUrl(vfx[key])).then(tex => {
        tex.colorSpace = THREE.SRGBColorSpace;
        this.tex[key] = tex;
        this.vfx.setMap(key, tex);
      }).catch(err => console.warn('Death 3D texture failed, keeping procedural:', vfx[key], err));
    });
    const [envG, throneG, deathG] = await Promise.all([
      this._fetchGltf(man.assets.environment),
      this._fetchGltf(man.assets.throne),
      this._fetchGltf(man.assets.death),
      ...texJobs,
    ]);
    if (want1k()) {
      if (envG) downscaleMaps(envG.scene, 1024);
      if (throneG) downscaleMaps(throneG.scene, 1024);
      if (deathG) downscaleMaps(deathG.scene, 1024);
    }
    if (envG && throneG && deathG) this._engagePack(envG, throneG, deathG);
    else console.warn('Death 3D kept the placeholder room; a GLB failed to load.');
    await this._loadOneHero(this.activeHero);
    this._showHero(this.activeHero);
  }

  async _fetchGltf(slot) {
    if (!slot || !slot.url || !this.gltfLoader) return null;
    try {
      const gltf = await this.gltfLoader.loadAsync(resolveUrl(slot.url));
      this.glb++;
      return gltf;
    } catch (err) {
      console.warn('Death 3D asset failed, keeping the placeholder:', slot.url, err);
      return null;
    }
  }

  _engagePack(envG, throneG, deathG) {
    this.pack = true;
    D3D_FAST = !!this.budget;
    this.packRoot = new THREE.Group();
    this.scene.add(this.packRoot);
    const env = envG.scene;
    prepMeshes(env, { rim: 0 });
    this.packRoot.add(env);
    const seat = new THREE.Group();
    const seatScale = (this.manifest.pack && this.manifest.pack.scale) || 1;
    seat.scale.setScalar(seatScale);
    this.packRoot.add(seat);
    this.seat = seat;
    const throne = throneG.scene;
    prepMeshes(throne, { rim: 0.04 });
    seat.add(throne);
    this.renderer.toneMapping = THREE.AgXToneMapping;
    /* Tuned up from the mock's +0.3 EV so the throne reads at the PNG's level. */
    this.renderer.toneMappingExposure = 1.5;
    this.room.group.visible = false;
    this.throne.group.visible = false;
    this.packThrone = throne;
    flagShadows(env, !this.budget);
    flagShadows(throne, !this.budget);
    this.deathActor.bindGltf(deathG, this.manifest.assets.death, seat);
    if (this.deathActor.model) flagShadows(this.deathActor.model, !this.budget);
    this._eyeGlow(this.deathActor.model);
    this._seatDeath(this.deathActor);
    this._bindScythe(this.deathActor);
    const marker = env.getObjectByName('Marker_Hero');
    const p = new THREE.Vector3(0, 0, 6.5);
    if (marker) marker.getWorldPosition(p);
    this.stand = { hero: [p.x, p.y, p.z], lungeSign: -1 };
    this.heroAnchor.position.set(p.x, p.y, p.z);
    this.heroAnchor.rotation.y = Math.PI;
    this.scene.fog = new THREE.FogExp2(0x374838, 0.034);
    const bg = new THREE.Color();
    bg.setRGB(0.006, 0.008, 0.007);
    this.scene.background = bg;
    this.renderer.setClearColor(bg, 1);
    if (this.hemi) this.hemi.intensity = 0.05;
    /* Only a phone hides the near braziers. Software still draws them so the
       screenshot can match the mock; it just skips their shadows. */
    hideFarDressing(env, this.low);
    this._flames(env);
    this._mockLights();
    this._soulGlow(this.deathActor.model);
    /* Placeholder lights would still occupy shader slots at intensity 0. */
    dropLight(this.brazierL && this.brazierL[0]);
    dropLight(this.brazierL && this.brazierL[1]);
    dropLight(this.candleL);
    this.brazierL = null;
    this.candleL = null;
    this.resize();
  }

  _showHero(id) {
    if (!this.heroes[id]) id = 'knight';
    this.activeHero = id;
    for (const k of Object.keys(this.heroes)) {
      const actor = this.heroActors[k];
      const on = k === id;
      if (actor.model) actor.model.visible = on;
      this.heroes[k].group.visible = on && !actor.model;
    }
    if (this.pack && !this.heroActors[id].model && !this.heroPending[id]) this._loadOneHero(id);
  }

  async _loadOneHero(id) {
    if (!this.heroes[id] || this.heroActors[id].model || this.heroPending[id]) return;
    const slot = this.manifest.assets['hero_' + id];
    if (!slot || !slot.url) return;
    this.heroPending[id] = true;
    const gltf = await this._fetchGltf(slot);
    this.heroPending[id] = false;
    if (!gltf) return;
    if (want1k()) downscaleMaps(gltf.scene, 1024);
    this.heroActors[id].bindGltf(gltf, slot, this.heroAnchor);
    if (this.heroActors[id].model) flagShadows(this.heroActors[id].model, !this.budget);
    if (id === this.activeHero) this.heroes[id].group.visible = false;
    else if (this.heroActors[id].model) this.heroActors[id].model.visible = false;
  }

  /* Grow Death relative to the throne, then put his hips back in the seat. */
  _seatDeath(actor) {
    const rel = (this.manifest.pack && this.manifest.pack.deathScale) || 1;
    const model = actor && actor.model;
    if (!model || !rel || rel === 1) return;
    if (actor.mixer) actor.mixer.update(0);
    model.updateWorldMatrix(true, true);
    const hips = model.getObjectByName('Hips') || model.getObjectByName('mixamorigHips');
    const ref = hips || actor.anchors.chest || actor.anchors.eyes;
    const before = new THREE.Vector3();
    if (ref) ref.getWorldPosition(before);
    model.scale.setScalar(rel);
    model.updateWorldMatrix(true, true);
    if (ref) {
      const after = new THREE.Vector3();
      ref.getWorldPosition(after);
      const parentScale = new THREE.Vector3(1, 1, 1);
      if (model.parent) model.parent.getWorldScale(parentScale);
      const s = parentScale.x || 1;
      model.position.x += (before.x - after.x) / s;
      model.position.y += (before.y - after.y) / s;
      model.position.z += (before.z - after.z) / s;
    }
    actor.seatY = model.position.y;
    model.updateWorldMatrix(true, true);
  }

  _maybeFit() {
    if (!this.pack) return;
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    const aspect = w / h;
    const key = this.activeHero + '@' + aspect.toFixed(3);
    if (key === this._fitKey && this._fitDebug) return;
    const fit = this._solveFit(aspect);
    if (!fit) return;
    this._fitKey = key;
    this.camera.fov = fit.fov;
    this.camera.updateProjectionMatrix();
    this.baseCam.copy(fit.pos);
    this.baseLook.copy(fit.look);
    this.pushCam.copy(fit.pos).add(new THREE.Vector3(0.04, 0.1, -0.4));
    this.pushLook.copy(fit.look).add(new THREE.Vector3(0, 0.12, -0.08));
  }

  _solveFit(aspect) {
    const hero = this.heroActors[this.activeHero];
    if (!hero || !hero.model || !this.deathActor.model || !this.packThrone) return null;
    const markers = measurePack(hero, this.deathActor, this.packThrone);
    if (!markers) return null;
    const fit = solvePackFrame(aspect, markers);
    if (fit) this._fitDebug = fit.debug;
    return fit;
  }

  _eyeGlow(model) {
    const socket = model && model.getObjectByName('Socket_Eyes');
    if (!socket) return;
    const map = this.tex.soul;
    const big = !!this.low;
    [-1, 1].forEach(s => {
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map, color: 0x7dffc4, blending: THREE.AdditiveBlending, transparent: true,
        depthWrite: false, toneMapped: false, opacity: big ? 0.9 : 0.75,
      }));
      halo.scale.set(big ? 0.16 : 0.12, big ? 0.09 : 0.07, 1);
      halo.position.set(s * 0.058, 0.02, 0.07);
      const core = new THREE.Sprite(new THREE.SpriteMaterial({
        map, color: 0xf3fff8, blending: THREE.AdditiveBlending, transparent: true,
        depthWrite: false, toneMapped: false, opacity: 1,
      }));
      core.scale.set(big ? 0.09 : 0.06, big ? 0.06 : 0.045, 1);
      core.position.set(s * 0.058, 0.02, 0.09);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshStandardMaterial({
        color: 0x06281c,
        emissive: 0x9dffc8,
        emissiveIntensity: big ? 2.4 : 2.8,
        roughness: 0.2,
        metalness: 0,
        toneMapped: false,
      }));
      ball.position.set(s * 0.055, 0.02, 0.08);
      socket.add(halo, core, ball);
    });
  }

  /* Visible green energy around Death. Bloom picks it up on desktop; on a
     phone the additive sprites are the glow. */
  _soulGlow(model) {
    const socket = (model && model.getObjectByName('Socket_Chest')) || (model && model.getObjectByName('Socket_Eyes'));
    if (!socket || !this.tex.soul) return;
    const make = (scale, opacity, y, z) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.tex.soul, color: 0xb8ffe4, blending: THREE.AdditiveBlending,
        transparent: true, depthWrite: false, toneMapped: false, opacity,
      }));
      s.scale.setScalar(scale);
      s.position.set(0, y, z);
      s.userData.base = scale;
      socket.add(s);
      return s;
    };
    /* Low on the ribs. A sprite at the face was covering the skull. */
    this.soulSprites = [
      make(0.26, 0.32, -0.12, 0.1),
      make(0.14, 0.22, 0.02, 0.16),
    ];
  }

  /* The file parents mesh Scythe to bone Scythe_Grip at identity. Clips
     move that bone, including the drop in Defeat_Slump. Do not offset it. */
  _bindScythe(actor) {
    const model = actor && actor.model;
    if (!model) return;
    const grip = model.getObjectByName('Scythe_Grip');
    const mesh = model.getObjectByName('Scythe');
    this.scythe = { embedded: !!(grip && mesh), external: false };
    const slot = this.manifest.assets && this.manifest.assets.scythe;
    if (grip && slot && slot.url) this._loadExternalScythe(slot, grip, mesh);
  }

  async _loadExternalScythe(slot, grip, mesh) {
    const gltf = await this._fetchGltf(slot);
    if (!gltf || !grip.parent) return;
    const root = gltf.scene;
    prepMeshes(root, { rim: 0, dissolve: (this.deathActor && this.deathActor.dissolve) || NO_DISSOLVE });
    flagShadows(root, !this.budget);
    root.position.set(0, 0, 0);
    root.rotation.set(0, 0, 0);
    root.quaternion.identity();
    root.scale.set(1, 1, 1);
    grip.add(root);
    if (mesh) mesh.visible = false;
    this.scythe = { embedded: false, external: true };
  }

  /* Phone fakes the green column with a sprite. A real GPU gets the spot. */
  _greenShaft() {
    const map = this.tex.soul;
    if (!map) return;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map, color: 0x8dffc0, blending: THREE.AdditiveBlending,
      transparent: true, depthWrite: false, toneMapped: false, opacity: 0.16,
    }));
    s.position.set(0, 5.6, -0.35);
    s.scale.set(2.2, 6.2, 1);
    this.scene.add(s);
    this.shaftSprite = s;
  }

  /* Mock lighting. Intensities are watts/4π. A phone, and software GL, keep
     the two throne-side braziers, the dais and a sun. Sprites stand in for
     the candles, the near braziers and the green column. A real GPU adds the
     spot rig from the mock. */
  _mockLights() {
    const scene = this.scene;
    const phone = !!this.low;
    const software = !!this.software;
    const shadows = !this.budget;
    const lin = (r, g, b) => new THREE.Color().setRGB(r, g, b);
    const sun = new THREE.DirectionalLight(lin(0.6, 0.7, 0.8), 0.35);
    sun.position.set(-3, 10, 8);
    scene.add(sun);
    const daisI = 17.5;
    const dais = new THREE.PointLight(lin(0.45, 1.0, 0.7), daisI, 0, 2);
    dais.position.set(0, 1.3, 2.2);
    dais.userData.base = daisI;
    scene.add(dais);
    this.daisLight = dais;
    if (phone || software) {
      const wash = new THREE.DirectionalLight(lin(0.5, 0.95, 0.72), phone ? 0.55 : 0.95);
      wash.position.set(0, 11, 4);
      scene.add(wash);
      this._greenShaft();
    }
    /* Real GPU only. Phone and software stay at the brazier points plus the dais. */
    if (!phone && !software) {
      const fillI = phone ? 10 : 12.7;
      const fill = new THREE.PointLight(lin(0.8, 0.9, 1.0), fillI, 0, 2);
      fill.position.set(0, 3.4, 1.6);
      fill.userData.base = fillI;
      scene.add(fill);
      this.fillLight = fill;
    }
    if (phone || software) return;
    const top = new THREE.SpotLight(lin(0.55, 0.9, 0.75), 199, 0, 25 * Math.PI / 180, 0.15, 2);
    top.position.set(0, 11, 4);
    top.target.position.set(0, 2, 0);
    top.castShadow = shadows;
    if (shadows) {
      top.shadow.mapSize.set(512, 512);
      top.shadow.bias = -0.00045;
      top.shadow.normalBias = 0.06;
      top.shadow.camera.near = 1;
      top.shadow.camera.far = 28;
    }
    scene.add(top);
    scene.add(top.target);
    const back = new THREE.SpotLight(lin(0.35, 0.9, 0.6), 143, 0, 0.9, 0.55, 2);
    back.position.set(0, 4.2, -2.6);
    back.target.position.set(0, 2, 1);
    scene.add(back);
    scene.add(back.target);
    this.keyBase = 557;
    const key = new THREE.SpotLight(lin(0.75, 0.85, 1.0), this.keyBase, 0, 8 * Math.PI / 180, 0.15, 2);
    key.position.set(1.5, 6.5, 6.5);
    key.target.position.set(0, 2.04, 0.45);
    scene.add(key);
    scene.add(key.target);
    this.key = key;
    this.rimBase = 38;
    const rim = new THREE.SpotLight(lin(1.0, 0.7, 0.5), this.rimBase, 0, 0.5, 0.45, 2);
    rim.position.set(2.2, 3.2, 9.5);
    rim.target.position.set(0, 1.2, 6.5);
    scene.add(rim);
    scene.add(rim.target);
    this.rim = rim;
  }

  _flames(env) {
    const fire = this.tex.fire;
    if (fire) prepSheet(fire, 4, 4, 20);
    this.flameSprites = [];
    this.flameLights = [];
    const sockets = [];
    env.traverse(obj => {
      if (!obj.name) return;
      const brazier = obj.name.indexOf('Socket_Flame_Brazier') === 0;
      const candle = obj.name.indexOf('Socket_Candles') === 0;
      if (!brazier && !candle) return;
      let hidden = false;
      let p = obj;
      while (p) { if (p.visible === false) { hidden = true; break; } p = p.parent; }
      if (hidden) return;
      obj.updateWorldMatrix(true, false);
      const at = new THREE.Vector3();
      obj.getWorldPosition(at);
      sockets.push({ obj, brazier, at, name: obj.name });
    });
    const lit = new Set();
    const braziers = sockets.filter(s => s.brazier).sort((a, b) => a.at.z - b.at.z);
    /* Phone: the two throne-side braziers only. Candles stay sprites.
       Desktop lights every brazier. 260 W → 20.7 cd. */
    /* Phone and software: two throne-side braziers. A real GPU lights all four. */
    const cap = (this.low || this.software) ? 2 : braziers.length;
    for (const s of braziers) {
      if (lit.size >= cap) break;
      lit.add(s);
    }
    for (const s of sockets) {
      if (!fire) continue;
      if (s.at.z > 10.2) continue;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: fire, blending: THREE.AdditiveBlending, transparent: true,
        depthWrite: false, toneMapped: false, color: s.brazier ? 0xffc080 : 0xffd7a4,
      }));
      const base = s.brazier ? 0.68 : 0.28;
      sp.scale.setScalar(base);
      sp.userData.base = base;
      sp.position.y = s.brazier ? 0.3 : 0.15;
      s.obj.add(sp);
      this.flameSprites.push(sp);
    }
    const warm = new THREE.Color().setRGB(1, 0.45, 0.15);
    for (const s of lit) {
      const intensity = 20.7;
      const light = new THREE.PointLight(warm, intensity, 0, 2);
      light.position.y = 0.35;
      light.castShadow = false;
      light.userData.base = intensity;
      light.userData.brazier = true;
      s.obj.add(light);
      this.flameLights.push(light);
    }
  }

  status() {
    const info = this.renderer ? this.renderer.info.render : { triangles: 0, calls: 0 };
    return {
      live: !!this.api.live,
      failed: !!this.api.failed,
      reason: this.api.reason || '',
      triangles: info.triangles,
      calls: info.calls,
      hero: this.activeHero,
      phase: this.phase,
      won: this.won,
      downed: this.downed,
      lastCue: this.lastCue,
      mode: this.glb ? 'glb' : 'placeholder',
      shown: !!this.api.shown,
      pack: !!this.pack,
      deathGlb: !!this.deathActor.model,
      heroGlb: !!(this.heroActors[this.activeHero] && this.heroActors[this.activeHero].model),
      deathClip: this.deathActor.clipLogical || '',
      heroClip: (this.heroActors[this.activeHero] && this.heroActors[this.activeHero].clipLogical) || '',
      deathDrive: this.deathActor.driving,
      heroDrive: this.heroActors[this.activeHero] ? this.heroActors[this.activeHero].driving : '',
      dpr: this.renderer ? this.renderer.getPixelRatio() : 0,
      low: !!this.low,
      fit: this._fitDebug || null,
      cam: this.director ? this.director.mode : '',
      bloom: !!this.composer,
      shadows: !!(this.renderer && this.renderer.shadowMap && this.renderer.shadowMap.enabled),
      budget: !!this.budget,
      software: !!this.software,
      gpu: this.gpuName || '',
      points: countLights(this.scene, 'isPointLight'),
      spots: countLights(this.scene, 'isSpotLight'),
      scythe: this.scythe ? (this.scythe.external ? 'file' : (this.scythe.embedded ? 'bone' : '')) : '',
      tone: this.renderer ? this.renderer.toneMapping : 0,
      exposure: this.renderer ? Math.round(this.renderer.toneMappingExposure * 100) / 100 : 0,
      camFov: this.camera ? Math.round(this.camera.fov * 10) / 10 : 0,
      camPos: this.camera ? [this.camera.position.x, this.camera.position.y, this.camera.position.z].map(v => Math.round(v * 100) / 100) : null,
    };
  }
}

class Actor {
  constructor(built, anchor) {
    this.group = built.group;
    this.mats = built.mats || [];
    this.bones = built.bones || {};
    this.anchors = built.anchors || {};
    this.sway = built.sway || [];
    this.applyRest = built.applyRest;
    this.anchor = anchor;
    this.proc = 'idle';
    this.procT = 0;
    this.driving = 'proc';
    this.mixer = null;
    this.clips = [];
    this.clipMap = {};
    this.action = null;
    this.clipLogical = '';
    this.model = null;
  }

  bindGltf(gltf, cfg, anchor) {
    const model = gltf.scene;
    cfg = cfg || {};
    if (cfg.fit === false) {
      model.position.set(0, 0, 0);
      model.rotation.set(0, 0, 0);
      model.scale.set(1, 1, 1);
      if (cfg.facing) model.rotation.y = cfg.facing;
    } else fitModel(model, cfg);
    const dissolve = { value: 0 };
    prepMeshes(model, { wind: !!cfg.wind, rim: cfg.rim || 0, dissolve });
    this.dissolve = dissolve;
    anchor.add(model);
    this.model = model;
    this.group.visible = false;
    const sockets = cfg.sockets || {};
    const names = {
      eyes: sockets.eyes || 'Socket_Eyes',
      cast: sockets.cast || 'Socket_RightHand',
      chest: sockets.chest || 'Socket_Chest',
      back: sockets.back || 'Socket_Chest',
      head: sockets.head || 'Socket_Head',
      off: sockets.off || 'Socket_LeftHand',
    };
    this.anchors = Object.assign({}, this.anchors);
    for (const key of Object.keys(names)) {
      const node = model.getObjectByName(names[key]);
      if (node) this.anchors[key] = node;
    }
    this.mixer = new THREE.AnimationMixer(model);
    this.clips = gltf.animations || [];
    this.clipMap = cfg.clips || {};
    this.queue = null;
    this.lockXZ = false;
    this.hips = null;
    this.hipHome = null;
    this.mixer.addEventListener('finished', (e) => {
      if (e.action !== this.action) return;
      if (this.queue) {
        const q = this.queue;
        this.queue = null;
        this.play(q.name, q);
        if (q.fire) q.fire();
        return;
      }
      if (this.clipLogical === 'idle' || this.clipLogical === 'defeat' || this.clipLogical === 'death') return;
      this.play('idle');
    });
    this.play('idle');
    if (cfg.lockRoot) {
      this.mixer.update(0);
      const hips = model.getObjectByName('Hips') || model.getObjectByName('mixamorigHips');
      if (hips) {
        this.hips = hips;
        this.hipHome = { x: hips.position.x, z: hips.position.z };
        this.lockXZ = true;
      }
    }
  }

  findClip(name) {
    if (!this.clips.length) return null;
    const want = (this.clipMap && this.clipMap[name]) || name;
    const list = [want, name];
    for (const n of list) {
      const hit = THREE.AnimationClip.findByName(this.clips, n);
      if (hit) return hit;
    }
    const low = String(want).toLowerCase();
    return this.clips.find(c => c.name.toLowerCase() === low)
      || this.clips.find(c => c.name.toLowerCase().includes(low))
      || null;
  }

  play(name, opts) {
    opts = opts || {};
    this.proc = name;
    this.procT = 0;
    this.queue = opts.then || null;
    if (!this.mixer) { this.driving = 'proc'; return false; }
    const clip = this.findClip(name);
    if (!clip) {
      this.driving = 'proc';
      const q = this.queue;
      this.queue = null;
      if (q && q.fire) q.fire();
      else if (opts.fire) opts.fire();
      return false;
    }
    const next = this.mixer.clipAction(clip);
    if (this.action && this.action !== next) this.action.fadeOut(0.08);
    next.reset().setEffectiveWeight(1).fadeIn(0.06);
    if (name === 'idle') next.setLoop(THREE.LoopRepeat, Infinity);
    else {
      next.setLoop(THREE.LoopOnce, 1);
      next.clampWhenFinished = true;
    }
    let scale = opts.timeScale;
    if (scale == null) {
      if (name === 'attack' || name === 'heavy') scale = Math.min(8, Math.max(1, clip.duration / 0.85));
      else if (name === 'hit' || name === 'dodge') scale = Math.min(4, Math.max(1, clip.duration / 0.5));
      else scale = 1;
    }
    next.setEffectiveTimeScale(scale);
    next.play();
    this.action = next;
    this.clipLogical = name;
    this.driving = 'clip';
    return true;
  }

  update(dt) {
    this.procT += dt;
    if (this.mixer) this.mixer.update(dt);
    if (this.lockXZ && this.hips && this.hipHome) {
      this.hips.position.x = this.hipHome.x;
      this.hips.position.z = this.hipHome.z;
    }
  }
}

function poseDeath(actor, t, s) {
  const b = actor.bones, ar = actor.applyRest;
  if (!b.torso || !ar) return;
  const amp = s.amp == null ? 1 : s.amp;
  const br = Math.sin(t * 1.3) * 0.018 * amp;
  ar(b.torso, br, 0, 0, 0, br * 0.5, 0);
  ar(b.head, Math.sin(t * 0.6) * 0.04 * amp - s.flinch * 0.2, 0, 0);
  const lift = Math.min(1, (s.pose || 0) * 1.4);
  ar(b.armL, -1.35 * lift, 0, 0.15 * lift);
  ar(b.foreL, -0.7 * lift);
  ar(b.chest, -0.1 * s.flinch, 0, (s.phase >= 3 ? (Math.random() - 0.5) * 0.01 : 0), 0, 0, 0.05 * s.flinch);
  if (s.won) {
    ar(b.armR, 0.4 * Math.min(1, s.won), 0, 0.5 * Math.min(1, s.won));
    ar(b.hips, 0.2 * Math.min(1, s.won), 0, 0, 0, -0.15 * Math.min(1, s.won), 0);
  }
}

function poseHero(actor, t, s) {
  const b = actor.bones, ar = actor.applyRest;
  if (!b.torso || !ar) return;
  const amp = s.amp == null ? 1 : s.amp;
  const br = Math.sin(t * 1.7) * 0.02 * amp;
  let tx = br, hx = 0, hz = 0, hy = Math.sin(t * 1.7) * 0.012 * amp;
  let ax = 0, az = 0;
  const atk = s.attack || 0;
  if (atk > 0) {
    const wind = atk < 0.16 ? atk / 0.16 : Math.max(0, 1 - (atk - 0.16) / 0.26);
    const strike = atk < 0.16 ? 0 : Math.min(1, (atk - 0.16) / 0.14);
    tx += -0.4 * wind + 0.35 * strike;
    ax = -1.2 * wind + 0.9 * strike;
  }
  if (s.hurt > 0) { tx += 0.3 * s.hurt; hz -= 0.08 * s.hurt; }
  if (s.dodge > 0) hx += Math.sin(s.dodge * 8) * 0.08;
  if (s.dead > 0) { tx += s.dead * 1.15; hy -= s.dead * 0.45; hz += s.dead * 0.25; }
  ar(b.torso, tx);
  ar(b.hips, 0, 0, 0, hx, hy, hz);
  ar(b.head, -tx * 0.3);
  if (b.armR) ar(b.armR, ax, 0, az);
}

class VFX {
  constructor(scene, tex) {
    this.scene = scene;
    this.tex = tex;
    this.pool = makePool(160, tex.soul);
    scene.add(this.pool.points);
    this.blasts = [];
    this.beam = makeBeam();
    this.beam.group.visible = false;
    scene.add(this.beam.group);
    this.sigil = makeSigil(tex);
    this.sigil.group.visible = false;
    scene.add(this.sigil.group);
    this.rings = [];
    this.flashes = [];
    this.softDisc = softDiscTexture();
  }

  setMap(key, tex) {
    if (!tex) return;
    if (key === 'soul') this.pool.mat.uniforms.uMap.value = tex;
    if (key === 'beam' && this.beam) {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      this.beam.mat.uniforms.uMap.value = tex;
    }
    this.tex[key] = tex;
  }

  clear() {
    for (const b of this.blasts) b.group.visible = false;
    this.blasts.length = 0;
    this.beam.group.visible = false;
    this.sigil.group.visible = false;
    for (const r of this.rings) r.visible = false;
    for (const f of this.flashes) f.visible = false;
    for (const g of this.riders || []) g.visible = false;
    this.riders = [];
  }

  _sprite(map, scale, color, opacity) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map, color, opacity: opacity == null ? 1 : opacity,
      blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false,
    }));
    s.scale.setScalar(scale);
    return s;
  }

  playBlast(arena, whiff, motion) {
    let coreMap = this.tex.orb || this.tex.soul;
    let sheet = null;
    if (this.tex.orbLoop) {
      coreMap = this.tex.orbLoop.clone();
      coreMap.colorSpace = THREE.SRGBColorSpace;
      coreMap.needsUpdate = true;
      prepSheet(coreMap, 4, 4, 16);
      sheet = coreMap;
    }
    const haloMap = this.softDisc || this.tex.flare || coreMap;
    const group = new THREE.Group();
    const halo = this._sprite(haloMap, 1.15, 0x8cffd8, 0.4);
    const core = this._sprite(coreMap, 0.95, 0xffffff, 0.95);
    const wisps = [0, 1, 2].map(i => {
      const wm = sheetCell(this.tex.wisp, 2, 2, i) || haloMap;
      return this._sprite(wm, 0.52 - i * 0.08, 0xffffff, 0.62 - i * 0.12);
    });
    group.add(halo, core, ...wisps);
    this.scene.add(group);
    this.blasts.push({
      group, halo, core, wisps, sheet, prev: null,
      t: 0, charge: 0.1 * motion.k, fly: 0.44 * motion.k, whiff, kind: 'blast',
    });
  }

  playBeam(arena, whiff, motion) {
    this.beam.t = 0;
    this.beam.dur = 0.78 * motion.k;
    this.beam.whiff = whiff;
    this.beam.group.visible = true;
    this._wisps(arena, 10);
  }

  drain(arena, motion) {
    this._stream(arena, 'drain', 0.95 * motion.k);
    this._riders('ghost', motion);
  }

  heal(arena, motion) {
    this._stream(arena, 'heal', 1.05 * motion.k);
    this._riders('wisp', motion);
  }

  _riders(kind, motion) {
    const src = kind === 'ghost' ? this.tex.ghost : this.tex.wisp;
    if (!src) return;
    this.riders = this.riders || [];
    for (let i = 0; i < 4; i++) {
      const map = sheetCell(src, 2, 2, i);
      if (!map) continue;
      const sp = this._sprite(map, kind === 'ghost' ? 0.42 : 0.36, 0xffffff, 0.85);
      sp.userData.kind = kind;
      sp.userData.i = i;
      sp.userData.t = -i * 0.07;
      sp.userData.dur = (kind === 'ghost' ? 0.95 : 1.05) * motion.k;
      sp.visible = false;
      this.scene.add(sp);
      this.riders.push(sp);
    }
  }

  playSigil(kind, arena, motion) {
    const g = this.sigil;
    g.kind = kind;
    g.t = 0;
    g.dur = 1.15 * motion.k;
    g.group.visible = true;
    g.group.position.copy(arena.heroAnchor.position);
    g.group.position.y = 0.04;
    const curse = kind === 'curse';
    g.disc.material.color.set(curse ? 0x9a78ff : 0x88a0b0);
    g.disc.material.opacity = 0.9;
  }

  sparks(pos, flash) {
    for (let i = 0; i < 14; i++) {
      this.pool.spawn(pos, {
        vx: (Math.random() - 0.5) * 2.4,
        vy: Math.random() * 2.2,
        vz: (Math.random() - 0.5) * 2.4,
        life: 0.25 + Math.random() * 0.25,
        size: 16 + Math.random() * 10,
        color: [1, 0.85 + Math.random() * 0.15, 0.55],
      });
    }
  }

  puff(pos, kind, n) {
    for (let i = 0; i < n; i++) {
      this.pool.spawn(pos, {
        vx: (Math.random() - 0.5) * 0.6,
        vy: 0.8 + Math.random() * 1.4,
        vz: (Math.random() - 0.5) * 0.6,
        life: 0.8 + Math.random() * 0.6,
        size: 14 + Math.random() * 8,
        color: kind === 'soul' ? [0.7, 1, 0.9] : [1, 0.7, 0.4],
      });
    }
  }

  _wisps(arena, n) {
    const a = arena._anchorWorld(arena.deathActor, 'eyes');
    for (let i = 0; i < n; i++) {
      this.pool.spawn(a, {
        vx: (Math.random() - 0.5) * 1.2,
        vy: (Math.random() - 0.4) * 0.8,
        vz: -1.2 - Math.random(),
        life: 0.7,
        size: 14 + Math.random() * 8,
        color: [0.6, 0.9, 1],
      });
    }
  }

  _stream(arena, kind, dur) {
    this.streams = this.streams || [];
    this.streams.push({ kind, t: 0, dur });
  }

  update(dt, t, arena) {
    const hand = arena._anchorWorld(arena.deathActor, 'cast');
    const eyes = arena._anchorWorld(arena.deathActor, 'eyes');
    const heroActor = arena.heroActors[arena.activeHero];
    /* Live upper-back (or chest) each frame. A GLB with no anchor uses a point on the body, not the feet. */
    let hero;
    if (heroActor.anchors && heroActor.anchors.back) hero = arena._anchorWorld(heroActor, 'back');
    else if (heroActor.anchors && heroActor.anchors.chest) hero = arena._anchorWorld(heroActor, 'chest');
    else {
      const root = heroActor.model || heroActor.anchor;
      root.updateWorldMatrix(true, false);
      hero = root.getWorldPosition(_w).clone();
      hero.y += 1.15;
    }
    for (const b of this.blasts) {
      b.t += dt;
      if (b.sheet) advanceSheet(b.sheet, dt);
      const charge = b.charge, fly = b.fly;
      const target = hero.clone();
      if (b.whiff) target.x += 0.38;
      if (b.t < charge) {
        const k = b.t / charge;
        b.group.position.copy(hand);
        b.group.scale.setScalar(0.45 + k * 0.55);
      } else if (b.t < charge + fly) {
        const p = (b.t - charge) / fly;
        const ease = p * p * (3 - 2 * p);
        const prev = b.prev ? b.prev.clone() : hand.clone();
        b.group.position.lerpVectors(hand, target, ease);
        b.group.position.y += Math.sin(p * Math.PI) * 0.28;
        b.group.scale.setScalar(0.95 + Math.sin(p * Math.PI) * 0.12);
        const dir = b.group.position.clone().sub(prev);
        if (dir.lengthSq() < 1e-6) dir.set(0, 0.05, -1);
        dir.normalize();
        b.wisps.forEach((w, i) => {
          const back = 0.4 + i * 0.38;
          w.position.set(-dir.x * back, -dir.y * back + Math.sin(t * 11 + i * 2) * 0.05, -dir.z * back);
          w.material.opacity = 0.45 - i * 0.08;
        });
        b.core.material.opacity = 0.9 + Math.sin(t * 18) * 0.08;
        b.prev = b.group.position.clone();
        for (let n = 0; n < 2; n++) this.pool.spawn(b.group.position, {
          vx: -dir.x * (0.5 + Math.random() * 0.9) + (Math.random() - 0.5) * 0.4,
          vy: -dir.y * 0.4 + (Math.random() - 0.45) * 0.45,
          vz: -dir.z * (0.5 + Math.random() * 0.9) + (Math.random() - 0.5) * 0.4,
          life: 0.32 + Math.random() * 0.22,
          size: 18 + Math.random() * 14,
          color: [0.5 + Math.random() * 0.25, 1, 0.78 + Math.random() * 0.15],
        });
      } else {
        this._impact(target, b.whiff, arena.camera.position);
        b.group.traverse(o => { if (o.material) o.material.dispose(); });
        if (b.sheet) b.sheet.dispose();
        this.scene.remove(b.group);
        b.dead = true;
      }
    }
    this.blasts = this.blasts.filter(b => !b.dead);

    if (this.beam.group.visible) {
      this.beam.t += dt;
      const p = this.beam.t / this.beam.dur;
      const from = eyes;
      const to = hero.clone();
      if (this.beam.whiff) to.x += 0.32;
      aimY(this.beam.group, from, to);
      this.beam.mat.uniforms.uTime.value = t;
      this.beam.mat.uniforms.uScroll.value = -t * 1.8;
      this.beam.mat.uniforms.uHot.value = p < 0.75 ? 1 : Math.max(0, 1 - (p - 0.75) / 0.25);
      if (this.beam.coreMat) this.beam.coreMat.opacity = 0.42 * this.beam.mat.uniforms.uHot.value;
      if (p < 0.85 && Math.random() < 0.18) this.puff(from.clone().lerp(to, Math.random()), 'soul', 1);
      if (p >= 1) {
        this.beam.group.visible = false;
        const hit = hero.clone();
        if (this.beam.whiff) hit.x += 0.32;
        this._impact(hit, this.beam.whiff, arena.camera.position);
      }
    }

    if (this.sigil.group.visible) {
      const g = this.sigil;
      g.t += dt;
      const p = g.t / g.dur;
      g.group.rotation.y += dt * (g.kind === 'jamwheel' ? 2.4 : 0.6);
      g.disc.material.opacity = p < 0.15 ? p / 0.15 : (1 - Math.max(0, p - 0.65) / 0.35);
      for (const c of g.chains) c.rotation.z += dt * 1.4;
      if (p >= 1) g.group.visible = false;
    }

    for (const s of this.streams || []) {
      s.t += dt;
      const from = s.kind === 'heal' ? hero : (s.kind === 'drain' ? hero : eyes);
      const to = s.kind === 'heal' || s.kind === 'drain' ? arena._anchorWorld(arena.deathActor, 'chest') : hero;
      if (s.t < s.dur && Math.random() < 0.35) {
        const p = Math.random();
        const pos = from.clone().lerp(to, p);
        if (s.kind === 'heal') {
          const ang = t * 6 + p * 8;
          pos.x += Math.cos(ang) * (1 - p) * 0.45;
          pos.z += Math.sin(ang) * (1 - p) * 0.45;
        }
        this.pool.spawn(pos, {
          vx: (to.x - pos.x) * 0.6,
          vy: (to.y - pos.y) * 0.6,
          vz: (to.z - pos.z) * 0.6,
          life: 0.45,
          size: 9 + Math.random() * 8,
          color: s.kind === 'heal' ? [0.7, 1, 0.85] : [0.55, 0.85, 1],
        });
      }
    }
    this.streams = (this.streams || []).filter(s => s.t < s.dur);

    const chest = arena._anchorWorld(arena.deathActor, 'chest');
    for (const g of this.riders || []) {
      g.userData.t += dt;
      if (g.userData.t < 0) continue;
      const p = g.userData.t / g.userData.dur;
      if (p >= 1) {
        g.visible = false;
        g.userData.dead = true;
        if (g.material && g.material.map) g.material.map.dispose();
        if (g.material) g.material.dispose();
        this.scene.remove(g);
        continue;
      }
      g.visible = true;
      const from = g.userData.kind === 'heal' ? chest : hero;
      const to = g.userData.kind === 'heal' ? hero : chest;
      g.position.lerpVectors(from, to, p);
      const spin = g.userData.kind === 'heal' ? (1 - p) * 0.7 : 0.22;
      g.position.x += Math.sin(p * 7 + g.userData.i) * spin;
      g.position.y += Math.sin(p * Math.PI) * 0.32 + (g.userData.kind === 'heal' ? Math.cos(p * 8 + g.userData.i) * spin : 0);
      g.material.opacity = p < 0.75 ? 0.85 : (1 - p) / 0.25 * 0.85;
    }
    this.riders = (this.riders || []).filter(g => !g.userData.dead);

    for (const r of this.rings) {
      if (!r.visible) continue;
      r.userData.t += dt;
      const p = r.userData.t / r.userData.dur;
      r.scale.setScalar(0.7 + p * 2.6);
      r.material.opacity = (1 - p) * 0.7;
      if (p >= 1) r.visible = false;
    }
    for (const f of this.flashes) {
      if (!f.visible) continue;
      f.userData.t += dt;
      if (f.userData.sheet) {
        const frame = advanceSheet(f.userData.sheet, dt);
        const sh = f.userData.sheet.userData._sheet;
        const done = sh && frame >= sh.count - 1 && f.userData.t >= (sh.count / sh.fps) - 0.02;
        if (done) {
          f.visible = false;
          if (f.material.map) f.material.map.dispose();
          f.material.dispose();
          this.scene.remove(f);
        }
        continue;
      }
      const p = f.userData.t / f.userData.dur;
      f.scale.setScalar(0.4 + p * 1.3);
      f.material.opacity = (1 - p) * 0.9;
      if (p >= 1) f.visible = false;
    }

    this._motes(t, arena.low);
    this.pool.cam = arena.camera.position;
    this.pool.update(dt);
  }

  _impact(pos, whiff, camPos) {
    const puff = this._sprite(this.softDisc || this.tex.orb || this.tex.soul, whiff ? 0.8 : 1.05, 0xdfffee, 0.5);
    puff.position.copy(pos);
    puff.userData.t = 0;
    puff.userData.dur = 0.34;
    this.scene.add(puff);
    this.flashes.push(puff);
    if (this.tex.impact) {
      const map = this.tex.impact.clone();
      map.colorSpace = THREE.SRGBColorSpace;
      map.needsUpdate = true;
      prepSheet(map, 4, 4, 24);
      map.userData._sheet.loop = false;
      const burst = this._sprite(map, whiff ? 0.72 : 0.95, 0xffffff, 0.8);
      burst.position.copy(pos);
      burst.userData.t = 0;
      burst.userData.sheet = map;
      this.scene.add(burst);
      this.flashes.push(burst);
    } else {
      const flash = this._sprite(this.tex.orb || this.tex.soul, 0.45, 0xe8fff8, 0.95);
      flash.position.copy(pos);
      flash.userData.t = 0;
      flash.userData.dur = 0.26;
      this.scene.add(flash);
      this.flashes.push(flash);
    }
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1.4 + Math.random() * 2.2;
      this.pool.spawn(pos, {
        vx: Math.cos(a) * sp,
        vy: (Math.random() - 0.35) * sp,
        vz: Math.sin(a) * sp,
        life: 0.22 + Math.random() * 0.28,
        size: 14 + Math.random() * 14,
        color: [0.6, 1, 0.86],
      });
    }
  }

  _motes(t, low) {
    if (this._moteInit) return;
    this._moteInit = true;
    for (let i = 0; i < (low ? 4 : 10); i++) {
      this.pool.spawn(new THREE.Vector3((Math.random() - 0.5) * 3.2, 0.8 + Math.random() * 2.4, 3.2 + Math.random() * 4.5), {
        vx: (Math.random() - 0.5) * 0.12,
        vy: 0.08 + Math.random() * 0.12,
        vz: (Math.random() - 0.5) * 0.06,
        life: 6 + Math.random() * 4,
        size: 12 + Math.random() * 8,
        color: [0.45, 0.7, 0.62],
        mote: true,
      });
    }
  }
}

function makePool(n, tex) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const life = new Float32Array(n);
  const size = new Float32Array(n);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aLife', new THREE.BufferAttribute(life, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    uniforms: { uMap: { value: tex }, uMax: { value: 56 }, uDpr: { value: 1 } },
    vertexShader: `
      attribute float aLife;
      attribute float aSize;
      attribute vec3 aColor;
      uniform float uMax;
      uniform float uDpr;
      varying float vLife;
      varying vec3 vColor;
      void main() {
        vLife = aLife;
        vColor = aColor;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float dist = -mv.z;
        float px = aSize * (3.4 / max(dist, 0.35)) * uDpr;
        if (dist < 1.2) px = 0.0;
        gl_PointSize = clamp(px, 0.0, uMax);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform sampler2D uMap;
      varying float vLife;
      varying vec3 vColor;
      void main() {
        if (vLife <= 0.0) discard;
        vec4 t = texture2D(uMap, gl_PointCoord);
        float a = t.a * vLife * 0.55;
        if (a < 0.02) discard;
        gl_FragColor = vec4(vColor * t.rgb, a);
      }
    `,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  const slots = [];
  for (let i = 0; i < n; i++) slots.push({ i, life: 0, max: 1, vx: 0, vy: 0, vz: 0, mote: false });
  return {
    points, pos, col, life, size, slots, geo, mat, cursor: 0,
    spawn(position, o) {
      let s = null;
      for (let k = 0; k < slots.length; k++) {
        const i = (this.cursor + k) % slots.length;
        if (slots[i].life <= 0) { s = slots[i]; this.cursor = i + 1; break; }
      }
      if (!s) return;
      s.life = o.life; s.max = o.life; s.vx = o.vx; s.vy = o.vy; s.vz = o.vz; s.mote = !!o.mote;
      const i3 = s.i * 3;
      pos[i3] = position.x; pos[i3 + 1] = position.y; pos[i3 + 2] = position.z;
      col[i3] = o.color[0]; col[i3 + 1] = o.color[1]; col[i3 + 2] = o.color[2];
      size[s.i] = o.size;
      life[s.i] = 1;
    },
    update(dt) {
      let dirty = false;
      for (const s of slots) {
        if (s.life <= 0) continue;
        dirty = true;
        s.life -= dt;
        const i3 = s.i * 3;
        pos[i3] += s.vx * dt;
        pos[i3 + 1] += s.vy * dt;
        pos[i3 + 2] += s.vz * dt;
        if (s.mote && this.cam) {
          const dx = pos[i3] - this.cam.x, dy = pos[i3 + 1] - this.cam.y, dz = pos[i3 + 2] - this.cam.z;
          if (dx * dx + dy * dy + dz * dz < 4.8 || pos[i3 + 2] < 2.6 || pos[i3 + 1] > 4.2) {
            pos[i3] = (Math.random() - 0.5) * 3;
            pos[i3 + 1] = 0.9 + Math.random() * 2.2;
            pos[i3 + 2] = 3.4 + Math.random() * 4;
          }
        }
        if (s.life <= 0) {
          life[s.i] = 0;
          if (s.mote) {
            s.life = s.max;
            pos[i3] = (Math.random() - 0.5) * 3;
            pos[i3 + 1] = 0.9 + Math.random() * 2.2;
            pos[i3 + 2] = 3.4 + Math.random() * 4;
          }
        } else life[s.i] = Math.max(0, s.life / s.max);
      }
      if (dirty) {
        geo.attributes.position.needsUpdate = true;
        geo.attributes.aLife.needsUpdate = true;
        geo.attributes.aColor.needsUpdate = true;
        geo.attributes.aSize.needsUpdate = true;
      }
    },
  };
}

function makeBeam() {
  const data = new Uint8Array([255, 255, 255, 255]);
  const blank = new THREE.DataTexture(data, 1, 1);
  blank.needsUpdate = true;
  blank.wrapS = THREE.RepeatWrapping;
  blank.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uHot: { value: 1 }, uScroll: { value: 0 }, uMap: { value: blank } },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uHot;
      uniform float uScroll;
      uniform sampler2D uMap;
      varying vec2 vUv;
      void main() {
        vec4 tex = texture2D(uMap, vec2(vUv.y * 4.0 + uScroll, vUv.x));
        float core = pow(smoothstep(0.5, 0.0, abs(vUv.x - 0.5)), 1.35);
        float pulse = 0.75 + 0.25 * sin(uTime * 18.0 - vUv.y * 28.0);
        float ends = smoothstep(0.0, 0.04, vUv.y) * smoothstep(1.0, 0.93, vUv.y);
        vec3 col = tex.rgb * vec3(0.7, 1.0, 0.92) * (0.4 + 0.9 * core) * pulse;
        float a = max(tex.a, 0.25) * (0.35 + 0.65 * core) * ends * uHot * 0.8;
        gl_FragColor = vec4(col, a);
      }
    `,
  });
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0xc8fff4, transparent: true, opacity: 0.4, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  });
  const group = new THREE.Group();
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 1, 8, 1, true), coreMat);
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 1), mat);
  const plane2 = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 1), mat);
  plane2.rotation.y = Math.PI / 2;
  group.add(core, plane, plane2);
  return { group, mat, coreMat, plane, t: 0, dur: 1, whiff: false };
}

function makeSigil(tex) {
  const group = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.9, 28), new THREE.MeshBasicMaterial({
    map: tex.sigil, transparent: true, opacity: 0.9, depthWrite: false, color: 0x9a78ff,
  }));
  disc.rotation.x = -Math.PI / 2;
  group.add(disc);
  const chains = [];
  for (let i = 0; i < 4; i++) {
    const c = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.028, 6, 12), new THREE.MeshStandardMaterial({
      color: 0x2a3138, metalness: 0.8, roughness: 0.35,
    }));
    const a = i / 4 * Math.PI * 2;
    c.position.set(Math.cos(a) * 0.55, 0.35 + (i % 2) * 0.25, Math.sin(a) * 0.35);
    c.rotation.y = a;
    chains.push(c);
    group.add(c);
  }
  return { group, disc, chains, t: 0, dur: 1, kind: 'curse' };
}

function aimY(group, from, to) {
  const dir = _v.subVectors(to, from);
  const len = Math.max(0.05, dir.length());
  group.position.copy(from).addScaledVector(dir, 0.5);
  group.quaternion.setFromUnitVectors(UP, dir.multiplyScalar(1 / len));
  group.scale.set(1, len, 1);
}

function fitModel(root, cfg) {
  root.position.set(0, 0, 0);
  root.rotation.set(0, 0, 0);
  root.scale.set(1, 1, 1);
  if (cfg.up === 'z' || cfg.up === 'Z') root.rotateX(-Math.PI / 2);
  if (cfg.facing) root.rotateY(cfg.facing);
  const s0 = cfg.scale == null ? 1 : cfg.scale;
  root.scale.setScalar(s0);
  root.updateMatrixWorld(true);
  if (cfg.fit === false && !cfg.targetHeight) { nudge(root, cfg); return; }
  let box = new THREE.Box3().setFromObject(root);
  if (box.isEmpty()) return;
  const size = new THREE.Vector3();
  box.getSize(size);
  if (cfg.targetHeight && size.y > 1e-4) {
    root.scale.multiplyScalar(cfg.targetHeight / size.y);
    root.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(root);
    box.getSize(size);
  }
  const center = new THREE.Vector3();
  box.getCenter(center);
  root.position.x -= center.x;
  root.position.z -= center.z;
  if (cfg.anchor === 'seat') {
    const frac = cfg.seatFrac == null ? 0.38 : cfg.seatFrac;
    root.position.y -= box.min.y + size.y * frac;
  } else if (cfg.anchor !== 'none') {
    root.position.y -= box.min.y;
  }
  nudge(root, cfg);
}

function nudge(root, cfg) {
  const o = cfg.offset;
  if (!o) return;
  root.position.x += o[0] || 0;
  root.position.y += o[1] || 0;
  root.position.z += o[2] || 0;
}

function prepMeshes(root, opts) {
  opts = opts || {};
  const dissolve = opts.dissolve || NO_DISSOLVE;
  root.traverse(o => {
    if (o.isSkinnedMesh) o.frustumCulled = false;
    if (!o.isMesh || !o.material) return;
    const wind = !!(opts.wind && o.isSkinnedMesh);
    const list = Array.isArray(o.material) ? o.material : [o.material];
    const styled = list.map(m => {
      const basic = styleMaterial(m, { wind, rim: opts.rim || 0, dissolve });
      if (/backdrop/i.test(o.name || '') || /backdrop/i.test(m.name || '') || /backdrop/i.test((o.parent && o.parent.name) || '')) {
        basic.side = THREE.DoubleSide;
      }
      return basic;
    });
    o.material = Array.isArray(o.material) ? styled : styled[0];
  });
  return dissolve;
}

function styleMaterial(mat, opts) {
  const lit = asLit(mat);
  if (lit.userData._d3dLit) return lit;
  lit.userData._d3dLit = true;
  tunePbr(lit);
  const rim = opts.rim || 0;
  const wind = opts.wind ? 1 : 0;
  const dissolve = opts.dissolve || NO_DISSOLVE;
  /* Stock shader for the hall, and for every mesh on a phone or software GL.
     The rim/wind/dissolve patch is a heavier fragment program. */
  if (D3D_FAST || (rim <= 0 && !wind && dissolve === NO_DISSOLVE)) return lit;
  const prev = lit.onBeforeCompile;
  const prevKey = lit.customProgramCacheKey ? lit.customProgramCacheKey.bind(lit) : null;
  lit.onBeforeCompile = (shader, renderer) => {
    if (prev) prev.call(lit, shader, renderer);
    const vertOk = shader.vertexShader.includes('#include <project_vertex>') && shader.vertexShader.includes('#include <common>');
    const fragOk = shader.fragmentShader.includes('#include <opaque_fragment>') && shader.fragmentShader.includes('#include <common>') && shader.fragmentShader.includes('outgoingLight');
    if (!vertOk || !fragOk) return;
    shader.uniforms.uTime = SHARED_TIME;
    shader.uniforms.uDissolve = dissolve;
    shader.uniforms.uRim = { value: rim };
    shader.uniforms.uWind = { value: wind };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
uniform float uTime;
uniform float uWind;
varying vec3 vD3Pos;
varying vec3 vD3Nrm;`)
      .replace('#include <project_vertex>', `
{
  float hem = smoothstep(1.15, 0.25, transformed.y);
  if (uWind > 0.5) {
    transformed.x += sin(uTime * 1.6 + transformed.y * 4.0 + transformed.z * 2.0) * 0.04 * hem;
    transformed.z += cos(uTime * 1.2 + transformed.x * 3.0) * 0.028 * hem;
  }
  vD3Pos = (modelMatrix * vec4(transformed, 1.0)).xyz;
  #ifdef USE_SKINNING
    vec3 d3n = objectNormal;
  #else
    vec3 d3n = normal;
  #endif
  vD3Nrm = normalize(mat3(modelMatrix) * d3n);
}
#include <project_vertex>`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uRim;
uniform float uDissolve;
varying vec3 vD3Pos;
varying vec3 vD3Nrm;`)
      .replace('#include <opaque_fragment>', `
{
  vec3 d3view = normalize(cameraPosition - vD3Pos);
  float d3ndv = clamp(dot(normalize(vD3Nrm), d3view), 0.0, 1.0);
  float d3ink = smoothstep(0.16, 0.0, d3ndv);
  outgoingLight *= mix(1.0, 0.82, d3ink);
  float d3rim = pow(1.0 - d3ndv, 3.5);
  outgoingLight += vec3(0.45, 0.95, 0.72) * d3rim * uRim;
  float d3hash = fract(sin(dot(vD3Pos.xz, vec2(127.1, 311.7))) * 43758.5453);
  if (uDissolve > 0.001 && d3hash < uDissolve) discard;
  if (uDissolve > 0.001 && d3hash < uDissolve + 0.08) outgoingLight = vec3(0.55, 1.0, 0.86);
}
#include <opaque_fragment>`);
  };
  lit.customProgramCacheKey = () => 'oe-d3d-lit3' + (prevKey ? '|' + prevKey() : '');
  return lit;
}

function asLit(mat) {
  if (!mat) return mat;
  /* Sheen stays on MeshPhysical. Copying onto Standard keeps the normal,
     roughness, metal and emissive maps, including the eye strength of 4. */
  if (mat.isMeshPhysicalMaterial) {
    const std = new THREE.MeshStandardMaterial();
    std.copy(mat);
    std.name = mat.name || '';
    return std;
  }
  if (mat.isMeshStandardMaterial) return mat;
  if (mat.isSpriteMaterial || mat.isShaderMaterial || mat.isPointsMaterial) return mat;
  const map = mat.map || mat.emissiveMap || null;
  if (map) {
    map.colorSpace = THREE.SRGBColorSpace;
    map.needsUpdate = true;
  }
  return new THREE.MeshStandardMaterial({
    map,
    color: mat.color ? mat.color.clone() : new THREE.Color(0xffffff),
    roughness: 0.58,
    metalness: 0.08,
    transparent: !!mat.transparent,
    opacity: mat.opacity == null ? 1 : mat.opacity,
    alphaTest: mat.alphaTest || 0,
    side: mat.side,
    name: mat.name || '',
  });
}

/* The packed files are roughness 0.85–0.92 and metalness 0, which reads as clay
   once a real light hits them. Pull that into a soft sheen unless a map already
   paints the answer, and leave an emissive backdrop alone. */
function tunePbr(m) {
  if (!m || (!m.isMeshStandardMaterial && !m.isMeshPhysicalMaterial)) return;
  const emissive = m.emissive ? m.emissive.r + m.emissive.g + m.emissive.b : 0;
  const color = m.color ? m.color.r + m.color.g + m.color.b : 1;
  if (emissive > 1.2 && color < 0.2) {
    /* The hall backdrop is a full-white emissive. Left alone it is a teal
       ceiling and it blooms. Keep a dim trace of the painting. */
    m.emissive.setRGB(0.10, 0.16, 0.12);
    m.emissiveIntensity = 0.7;
    m.envMapIntensity = 0.04;
    return;
  }
  const name = (m.name || '').toLowerCase();
  const metalName = /metal|iron|gold|blade|scythe|armor|plate|brazier|coin/.test(name);
  if (!m.roughnessMap && m.roughness >= 0.8) m.roughness = metalName ? 0.38 : 0.82;
  if (!m.metalnessMap && m.metalness < 0.04) m.metalness = metalName ? 0.55 : 0.04;
  m.envMapIntensity = metalName ? 0.45 : 0.22;
}

function flagShadows(root, cast) {
  if (!root) return;
  const on = cast !== false;
  root.traverse(o => {
    if (!o.isMesh) return;
    const name = (o.name || '') + ' ' + ((o.parent && o.parent.name) || '');
    const backdrop = /backdrop/i.test(name);
    o.castShadow = on && !backdrop;
    o.receiveShadow = on;
    o.frustumCulled = o.isSkinnedMesh ? false : o.frustumCulled;
  });
}

function dropLight(light) {
  if (light && light.parent) light.parent.remove(light);
}

/* Pillars and candle clusters behind the rest camera, and on a budget the
   two braziers that sit beside the camera rather than the throne. */
function hideFarDressing(env, budget) {
  const hide = new Set(['Pillar_R3', 'Pillar_L3', 'Candles_5', 'Candles_6']);
  if (budget) {
    hide.add('Brazier_2');
    hide.add('Brazier_3');
    hide.add('Candles_4');
    hide.add('Candles_7');
  }
  env.traverse(obj => {
    if (obj.name && hide.has(obj.name)) obj.visible = false;
  });
}

function prepSheet(tex, cols, rows, fps) {
  if (!tex) return tex;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.userData._sheet = { cols, rows, fps: fps || 0, frame: 0, acc: 0, loop: true, count: cols * rows };
  setFrame(tex, 0);
  return tex;
}

function setFrame(tex, index) {
  const s = tex && tex.userData && tex.userData._sheet;
  if (!s) return;
  const count = s.count || (s.cols * s.rows);
  let i = index;
  if (s.loop) i = ((i % count) + count) % count;
  else i = Math.min(count - 1, Math.max(0, i));
  const col = i % s.cols;
  const row = Math.floor(i / s.cols);
  tex.repeat.set(1 / s.cols, 1 / s.rows);
  tex.offset.set(col / s.cols, 1 - (row + 1) / s.rows);
  s.frame = i;
}

function advanceSheet(tex, dt) {
  const s = tex && tex.userData && tex.userData._sheet;
  if (!s || !s.fps) return s ? s.frame : 0;
  s.acc += dt;
  const step = 1 / s.fps;
  let guard = 0;
  while (s.acc >= step && guard < 8) {
    guard++;
    s.acc -= step;
    const count = s.count || s.cols * s.rows;
    if (!s.loop && s.frame >= count - 1) { s.acc = 0; break; }
    setFrame(tex, s.frame + 1);
  }
  return s.frame;
}

function sheetCell(tex, cols, rows, index) {
  if (!tex) return null;
  const map = tex.clone();
  map.colorSpace = THREE.SRGBColorSpace;
  map.needsUpdate = true;
  prepSheet(map, cols, rows, 0);
  setFrame(map, index);
  return map;
}

function phoneLike() {
  const w = window.innerWidth || 1200;
  if (w <= 900) return true;
  try {
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches && w <= 1100) return true;
  } catch (e) { /* ignore */ }
  return false;
}

function countLights(root, key) {
  let n = 0;
  if (!root) return 0;
  root.traverse(o => {
    if (!o[key] || o.intensity <= 0.02) return;
    let p = o;
    while (p) {
      if (p.visible === false) return;
      p = p.parent;
    }
    n++;
  });
  return n;
}

function softDiscTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,0.95)');
  grd.addColorStop(0.28, 'rgba(255,255,255,0.45)');
  grd.addColorStop(0.62, 'rgba(255,255,255,0.12)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function glRendererName(gl) {
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '') : '';
  } catch (e) { return ''; }
}

function glIsSoftware(gl) {
  return /swiftshader|llvmpipe|softpipe|software|subzero/i.test(glRendererName(gl));
}

function lowEnd() {
  try {
    if (navigator.deviceMemory && navigator.deviceMemory <= 4) return true;
  } catch (e) { /* ignore */ }
  return phoneLike();
}

function want1k() {
  return lowEnd();
}

function pixelCap() {
  if (phoneLike()) return 1.5;
  try {
    if (navigator.deviceMemory && navigator.deviceMemory <= 4) return 1.25;
  } catch (e) { /* ignore */ }
  return 2;
}

function downscaleMaps(root, max) {
  const seen = new Set();
  root.traverse(o => {
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of mats) {
      for (const key of ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap']) {
        const tex = m[key];
        if (!tex || !tex.image || seen.has(tex)) continue;
        seen.add(tex);
        const img = tex.image;
        const w = img.width || 0;
        const h = img.height || 0;
        if (!w || !h || (w <= max && h <= max)) continue;
        const scale = max / Math.max(w, h);
        const cw = Math.max(1, Math.round(w * scale));
        const ch = Math.max(1, Math.round(h * scale));
        const canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext('2d');
        try {
          ctx.drawImage(img, 0, 0, cw, ch);
          tex.image = canvas;
          tex.needsUpdate = true;
        } catch (err) { /* keep the original */ }
      }
    }
  });
}

function resolveUrl(url) {
  if (!url) return url;
  if (/^(https?:|\/|\.\/|\.\.\/)/.test(url)) return url;
  return 'death3d/assets/' + url;
}

function collectMats(root) {
  const out = [];
  root.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => out.push(m)); });
  return out;
}

function findBone(root, re) {
  let hit = null;
  root.traverse(o => { if (!hit && o.isBone && re.test(o.name)) hit = o; });
  return hit;
}

function worldOf(obj, into) {
  obj.updateWorldMatrix(true, false);
  obj.getWorldPosition(into);
  return into;
}

/* Head, shoulders, upper back, Death's skull and chest, and the front
   lip of the throne. The camera is solved from these, per hero. */
function measurePack(hero, death, throne) {
  const headN = hero.anchors.head;
  const chestN = hero.anchors.chest || hero.anchors.back;
  if (!headN || !chestN || !death.model) return null;
  hero.model.updateWorldMatrix(true, true);
  death.model.updateWorldMatrix(true, true);
  const heroHead = worldOf(headN, new THREE.Vector3());
  const heroChest = worldOf(chestN, new THREE.Vector3());
  const box = new THREE.Box3();
  const v = new THREE.Vector3();
  hero.model.traverse(o => { if (o.isBone) { o.getWorldPosition(v); box.expandByPoint(v); } });
  const heroTop = heroHead.clone();
  const above = box.max.y - heroHead.y;
  heroTop.y = heroHead.y + (above > 0.04 && above < 0.55 ? above + 0.04 : 0.26);
  const shL = findBone(hero.model, /left.?shoulder|shoulder.?l|leftarm/i);
  const shR = findBone(hero.model, /right.?shoulder|shoulder.?r|rightarm/i);
  const shoulderL = shL ? worldOf(shL, new THREE.Vector3()) : heroChest.clone();
  const shoulderR = shR ? worldOf(shR, new THREE.Vector3()) : heroChest.clone();
  if (!shL) shoulderL.x -= 0.28;
  if (!shR) shoulderR.x += 0.28;
  /* The hero faces -Z, so his back is toward +Z, the camera side. */
  const heroBack = heroChest.clone();
  heroBack.y -= 0.34;
  heroBack.z += 0.16;
  const eyeN = death.anchors.eyes;
  const dChestN = death.anchors.chest;
  if (!eyeN || !dChestN) return null;
  const deathEyes = worldOf(eyeN, new THREE.Vector3());
  const deathChest = worldOf(dChestN, new THREE.Vector3());
  const deathTop = deathEyes.clone();
  deathTop.y += 0.34;
  const tb = new THREE.Box3().setFromObject(throne);
  const throneBase = new THREE.Vector3((tb.min.x + tb.max.x) * 0.5, tb.min.y + 0.08, tb.max.z - 0.05);
  return { heroTop, heroChest, heroBack, shoulderL, shoulderR, deathTop, deathChest, throneBase };
}

function miss(v, lo, hi) {
  if (v >= lo && v <= hi) return 0;
  const d = v < lo ? lo - v : v - hi;
  return 40 + d * 80;
}

/* Search a camera that puts this hero's upper body in the bottom third,
   left of centre, with Death's skull under the life bar and his torso large.
   A shot that misses those bands always loses to one that hits them. */
function solvePackFrame(aspect, M) {
  const cam = new THREE.PerspectiveCamera(40, aspect, 0.08, 90);
  const ndc = new THREE.Vector3();
  const look = new THREE.Vector3();
  const keys = ['heroTop', 'heroChest', 'heroBack', 'shoulderL', 'shoulderR', 'deathTop', 'deathChest', 'throneBase'];
  function project(p) {
    ndc.copy(p).project(cam);
    return { x: (ndc.x + 1) * 0.5, y: (1 - ndc.y) * 0.5, z: ndc.z };
  }
  let best = null;
  const fovs = [36, 42, 48, 54, 60];
  const backs = [3.2, 4.6, 6.2, 8.0, 10.0, 12.0];
  const camYs = [1.5, 2.1, 2.7, 3.3, 4.0];
  const lookYs = [1.4, 2.0, 2.6, 3.2, 3.8];
  const sides = [0.55, 1.05, 1.6, 2.2];
  for (const fov of fovs) {
    cam.fov = fov;
    cam.aspect = aspect;
    for (const back of backs) {
      for (const camY of camYs) {
        for (const lookY of lookYs) {
          for (const side of sides) {
            cam.position.set(M.heroChest.x + side, camY, M.heroChest.z + back);
            look.set(M.deathChest.x, lookY, M.deathChest.z + 0.2);
            cam.lookAt(look);
            cam.updateProjectionMatrix();
            const pts = {};
            for (const k of keys) pts[k] = project(M[k]);
            let hard = 0;
            for (const k of ['heroTop', 'heroChest', 'heroBack', 'deathTop', 'deathChest']) {
              const p = pts[k];
              if (p.z < 0 || p.z > 1) hard += 50;
            }
            hard += miss(pts.heroTop.y, 0.64, 0.76);
            hard += miss(pts.heroTop.x, 0.26, 0.46);
            hard += miss(pts.heroChest.y, 0.76, 0.92);
            hard += miss(pts.heroBack.y, 0.86, 0.97);
            hard += miss(pts.shoulderL.y, 0.72, 0.97);
            hard += miss(pts.shoulderR.y, 0.72, 0.97);
            hard += miss(Math.min(pts.shoulderL.x, pts.shoulderR.x), 0.06, 0.42);
            hard += miss(pts.deathTop.y, 0.18, 0.34);
            hard += miss(pts.deathTop.x, 0.36, 0.66);
            hard += miss(pts.deathChest.y, 0.36, 0.58);
            if (pts.heroBack.y <= pts.heroChest.y) hard += 40;
            if (pts.throneBase.y > 1.0 || pts.throneBase.y < 0.35 || pts.throneBase.z < 0 || pts.throneBase.z > 1) hard += 40;
            const span = pts.deathChest.y - pts.deathTop.y;
            const cost = hard > 0 ? hard + Math.max(0, 0.12 - span) * 20 : -span;
            if (!best || cost < best.cost) {
              const rounded = {};
              for (const k of keys) rounded[k] = { x: Math.round(pts[k].x * 100) / 100, y: Math.round(pts[k].y * 100) / 100 };
              best = {
                cost,
                fov,
                pos: cam.position.clone(),
                look: look.clone(),
                debug: {
                  cost: Math.round(cost * 100) / 100,
                  span: Math.round(span * 100) / 100,
                  fov,
                  back: Math.round((cam.position.z - M.heroChest.z) * 10) / 10,
                  pts: rounded,
                },
              };
            }
          }
        }
      }
    }
  }
  return best;
}

/* Fallback pack shot, used until the loaded hero's bounds are known.
   Vertical fov is three.js's fov, so a wide short strip opens a huge
   horizontal view unless the lens tightens. */
function framePack(aspect) {
  const t = Math.min(1, Math.max(0, (aspect - 1.15) / (2.6 - 1.15)));
  const fov = 40 + (32 - 40) * t;
  const side = 0.72 + (1.2 - 0.72) * t;
  const camY = 2.0 + (1.7 - 2.0) * t;
  const camZ = 9.55 + (10.0 - 9.55) * t;
  /* Wide strips: look higher so the scythe clears the life-bar label.
     A short canvas spends a bigger share of its height on that label. */
  const lookY = 2.95 + (3.72 - 2.95) * t;
  return {
    fov,
    pos: new THREE.Vector3(side, camY, camZ),
    look: new THREE.Vector3(-0.04, lookY, 0.4),
  };
}

/* Over-the-shoulder framing. Vertical FOV is three.js's fov. The hero's
   head lands in the lower third and Death's head in the upper middle.
   `hero` is the layout feet position. */
function frameShot(aspect, hero) {
  const hx = hero[0], hz = hero[2];
  let fov, back, camY, side, lookY;
  /* Pulled back so the hero is the lower third, with the throne cap under
     the 2D life bar. Wider aspects offset the camera more so he stays left. */
  if (aspect < 0.7) { fov = 60; back = 4.5; camY = 2.35; side = -0.55; lookY = 2.35; }
  else if (aspect < 1.45) { fov = 58; back = 4.3; camY = 2.32; side = -0.72; lookY = 2.25; }
  else if (aspect < 2.1) { fov = 54; back = 4.35; camY = 2.28; side = -0.7; lookY = 2.35; }
  else { fov = 52; back = 5.4; camY = 1.9; side = -1.2; lookY = 3.1; }
  return {
    fov,
    pos: new THREE.Vector3(hx + side, camY, hz - back),
    look: new THREE.Vector3(0, lookY, 6.75),
  };
}

const _shotPos = new THREE.Vector3();
const _shotLook = new THREE.Vector3();
const _mixPos = new THREE.Vector3();
const _mixLook = new THREE.Vector3();

function smooth01(u) {
  const x = Math.max(0, Math.min(1, u));
  return x * x * (3 - 2 * x);
}

function anchorShot(arena, who, name, fallback) {
  const actor = who === 'death' ? arena.deathActor : arena.heroActors[arena.activeHero];
  if (!actor) return fallback.clone();
  try { return arena._anchorWorld(actor, name); }
  catch (e) { return fallback.clone(); }
}

function shotRest(arena) {
  /* Artist camera: (0.7, 2.45, 11.2) looking at (−0.1, 2.75, 0.5).
     24 mm on a 36 mm sensor is 45.75° vertical at 16:9. A narrower frame
     keeps that horizontal field, capped so a phone is not a fisheye. */
  const pos = new THREE.Vector3(0.7, 2.45, 11.2);
  const look = new THREE.Vector3(-0.1, 2.75, 0.5);
  const aspect = Math.max(0.35, arena.camera.aspect || 1);
  const wide = 16 / 9;
  let fov = 45.75;
  if (aspect < wide - 0.02) {
    const h = 2 * Math.atan(Math.tan(45.75 * Math.PI / 360) * wide);
    fov = 2 * Math.atan(Math.tan(h / 2) / aspect) * 180 / Math.PI;
    fov = Math.min(78, fov);
  }
  return { pos, look, fov };
}

function shotIntro(arena) {
  const eyes = anchorShot(arena, 'death', 'eyes', new THREE.Vector3(0, 2.4, 1));
  const pos = eyes.clone();
  pos.y = Math.min(eyes.y - 1.15, 0.85);
  pos.z += 3.6;
  pos.x -= 0.35;
  const look = eyes.clone();
  look.y -= 0.15;
  return { pos, look, fov: 40 };
}

function shotHero(arena) {
  /* From behind the hero, looking up the hall. A face-on reverse looks out
     the open end into empty fog. */
  const hero = anchorShot(arena, 'hero', 'chest', new THREE.Vector3(0, 1.35, 6.5));
  const death = anchorShot(arena, 'death', 'chest', new THREE.Vector3(0, 1.45, 0.4));
  const pos = hero.clone();
  pos.z += 1.35;
  pos.y = Math.max(1.35, hero.y + 0.15);
  pos.x += 0.4;
  const look = death.clone();
  return { pos, look, fov: 40 };
}

function shotFlinch(arena) {
  const eyes = anchorShot(arena, 'death', 'eyes', new THREE.Vector3(0, 2.4, 1));
  const pos = eyes.clone();
  pos.z += 1.45;
  pos.y += 0.02;
  pos.x += 0.32;
  const look = eyes.clone();
  return { pos, look, fov: 24 };
}

function shotBlast(arena) {
  /* Side of the hero, looking across him toward the throne, so the hall
     stays in frame instead of the open end of the room. */
  const hero = anchorShot(arena, 'hero', 'chest', new THREE.Vector3(0, 1.4, 6.5));
  const throne = anchorShot(arena, 'death', 'chest', new THREE.Vector3(0, 1.45, 0.4));
  const pos = hero.clone();
  pos.x += 2.35;
  pos.y = 1.42;
  pos.z += 0.85;
  const look = throne.clone();
  look.y += 0.05;
  return { pos, look, fov: 46 };
}

function shotCast(arena) {
  const eyes = anchorShot(arena, 'death', 'eyes', new THREE.Vector3(0, 2.4, 1));
  const hand = anchorShot(arena, 'death', 'cast', eyes);
  const pos = hand.clone();
  pos.z += 2.1;
  pos.y += 0.15;
  pos.x += 0.8;
  return { pos, look: eyes.clone(), fov: 36 };
}

function shotPhase(arena) {
  const rest = shotRest(arena);
  const eyes = anchorShot(arena, 'death', 'eyes', rest.look);
  const pos = rest.pos.clone().lerp(eyes, 0.28);
  pos.y += 0.2;
  return { pos, look: eyes, fov: Math.max(24, rest.fov - 6) };
}

function shotWin(arena) {
  const eyes = anchorShot(arena, 'death', 'eyes', new THREE.Vector3(0, 2.2, 1));
  const pos = eyes.clone();
  pos.z += 2.15;
  pos.y += 0.45;
  pos.x += 0.2;
  const look = eyes.clone();
  look.y -= 0.2;
  return { pos, look, fov: 28 };
}

function shotLoss(arena) {
  const hero = anchorShot(arena, 'hero', 'chest', new THREE.Vector3(0, 1.2, 6.5));
  const throne = anchorShot(arena, 'death', 'chest', new THREE.Vector3(0, 1.4, 0.4));
  const pos = hero.clone();
  pos.z += 1.55;
  pos.y += 0.85;
  pos.x += 0.7;
  const look = hero.clone().lerp(throne, 0.35);
  look.y -= 0.15;
  return { pos, look, fov: 40 };
}

const SHOTS = {
  rest: shotRest, intro: shotIntro, hero: shotHero, flinch: shotFlinch,
  blast: shotBlast, cast: shotCast, phase: shotPhase, win: shotWin, loss: shotLoss,
};

function mixShots(a, b, k) {
  _mixPos.copy(a.pos).lerp(b.pos, k);
  _mixLook.copy(a.look).lerp(b.look, k);
  return { pos: _mixPos, look: _mixLook, fov: a.fov + (b.fov - a.fov) * k };
}

/* Resting over-the-shoulder shot, plus short sequences on resolve, intro, and the finishers. */
class CameraDirector {
  constructor(arena) {
    this.arena = arena;
    this.mode = 'rest';
    this.t = 0;
    this.dur = 0;
    this.pos = new THREE.Vector3(0, 2, 8);
    this.look = new THREE.Vector3(0, 2, 0);
    this.fov = 36;
    this._ready = false;
  }

  start(name) {
    const motion = motionScale();
    if (name === 'phase' && motion.reduced) return;
    const rank = { rest: 0, phase: 1, intro: 2, hero: 3, flinch: 3, blast: 4, loss: 5, win: 6 };
    const dur = { intro: 2.6, hero: 2.3, flinch: 1.8, blast: 2.5, phase: 1.6, win: 2.8, loss: 2.6, rest: 0 };
    if (this.mode === name && name !== 'rest') return;
    const next = rank[name] == null ? 0 : rank[name];
    const cur = rank[this.mode] == null ? 0 : rank[this.mode];
    if (name !== 'rest' && next < cur && this.t < this.dur) return;
    this.mode = name;
    this.t = 0;
    this.dur = dur[name] || 0;
  }

  skip() {
    if (this.mode === 'rest') return;
    this.mode = 'rest';
    this.t = 0;
    this.dur = 0;
    const s = shotRest(this.arena);
    this.pos.copy(s.pos);
    this.look.copy(s.look);
    this.fov = s.fov;
    this._ready = true;
  }

  apply(dt, motion, view) {
    const soft = !!(motion && (motion.reduced || reduceFlashing()));
    const fast = !!(motion && motion.fast);
    if (this.mode !== 'rest') this.t += dt * (fast ? (1 / Math.max(0.45, motion.k || 1)) : 1);
    const hold = this.mode === 'win' || this.mode === 'loss';
    if (!hold && this.mode !== 'rest' && this.t >= this.dur) {
      this.mode = 'rest';
      this.t = 0;
    }
    if (hold && this.t > this.dur) this.t = this.dur;
    const frame = this._frame(soft);
    const cut = frame.cut && !soft;
    const alpha = cut ? 1 : (1 - Math.exp(-dt * (frame.cut ? 10 : 6)));
    if (!this._ready || cut) {
      this.pos.copy(frame.pos);
      this.look.copy(frame.look);
      this.fov = frame.fov;
      this._ready = true;
    } else {
      this.pos.lerp(frame.pos, Math.min(1, alpha));
      this.look.lerp(frame.look, Math.min(1, alpha));
      this.fov += (frame.fov - this.fov) * Math.min(1, alpha);
    }
    if (this.mode === 'rest' && !soft) this.pos.y += Math.sin(performance.now() / 1000 * 0.8) * 0.012;
    const cam = this.arena.camera;
    cam.position.copy(this.pos);
    if (!soft && view && view.shake) {
      const sh = Math.min(view.shake, 12) * 0.002 * (motion.shake || 1);
      cam.position.x += (Math.random() - 0.5) * sh;
      cam.position.y += (Math.random() - 0.5) * sh;
    }
    cam.lookAt(this.look);
    cam.fov = this.fov;
    cam.updateProjectionMatrix();
  }

  _frame(soft) {
    const t = this.t;
    const dur = this.dur || 1;
    const arena = this.arena;
    const rest = () => SHOTS.rest(arena);
    let shot;
    let cut = false;
    if (this.mode === 'intro') {
      shot = mixShots(SHOTS.intro(arena), rest(), smooth01(t / dur));
    } else if (this.mode === 'hero') {
      if (t < 0.72) { shot = SHOTS.hero(arena); cut = t < 0.06; }
      else if (t < 1.6) { shot = SHOTS.flinch(arena); cut = t < 0.8; }
      else shot = mixShots(SHOTS.flinch(arena), rest(), smooth01((t - 1.6) / (dur - 1.6)));
    } else if (this.mode === 'flinch') {
      if (t < 1.05) { shot = SHOTS.flinch(arena); cut = t < 0.06; }
      else shot = mixShots(SHOTS.flinch(arena), rest(), smooth01((t - 1.05) / (dur - 1.05)));
    } else if (this.mode === 'blast') {
      if (t < 0.32) { shot = SHOTS.cast(arena); cut = t < 0.06; }
      else if (t < 1.7) { shot = SHOTS.blast(arena); cut = t < 0.4; }
      else shot = mixShots(SHOTS.blast(arena), rest(), smooth01((t - 1.7) / (dur - 1.7)));
    } else if (this.mode === 'phase') {
      const k = Math.sin(Math.min(1, t / dur) * Math.PI);
      shot = mixShots(rest(), SHOTS.phase(arena), k);
    } else if (this.mode === 'win') {
      shot = mixShots(rest(), SHOTS.win(arena), smooth01(Math.min(1, t / 1.2)));
    } else if (this.mode === 'loss') {
      shot = mixShots(rest(), SHOTS.loss(arena), smooth01(Math.min(1, t / 1.1)));
    } else shot = rest();
    _shotPos.copy(shot.pos);
    _shotLook.copy(shot.look);
    return { pos: _shotPos, look: _shotLook, fov: shot.fov, cut: cut && !soft };
  }
}

function reduceFlashing() {
  try {
    const S = window.LD && window.LD.S;
    if (S && (S.reduceFlash || S.reduceFlashing || S.noFlash || S.flashing === false)) return true;
  } catch (e) { /* ignore */ }
  return false;
}

function motionScale() {
  let reduced = false;
  try { reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { reduced = false; }
  const fast = !!(window.LD && window.LD.S && window.LD.S.fast);
  return { reduced, fast, k: fast ? 0.55 : 1, shake: reduced ? 0.15 : 1 };
}
