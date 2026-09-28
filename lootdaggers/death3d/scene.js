/* Real-time throne room for the final Death fight.
   Lazy-loaded by index.html only after a Death fight starts. Fight rules stay
   in the page; this file only watches run/view and draws. If WebGL or an asset
   fails, boot() reports live:false and the painted arena keeps drawing. */
import * as THREE from 'three';
import { DEATH3D_MANIFEST } from './manifest.js';
import { makeTextures, buildDeath, buildHeroes, buildThrone, buildRoom } from './placeholders.js';

const UP = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
/* One clock for robe wind, flame sheets, and the dissolve. */
const SHARED_TIME = { value: 0 };
const NO_DISSOLVE = { value: 0 };

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
    const wrap = canvas && canvas.parentElement;
    if (wrap) wrap.classList.remove('death3d');
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
    const aa = !this.low && (window.devicePixelRatio || 1) < 1.5;
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
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setClearColor(0x07060b, 1);
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x07060b);
    this.scene.fog = new THREE.FogExp2(0x100e12, 0.028);
    const cam = this.manifest.layout.camera;
    this.camera = new THREE.PerspectiveCamera(cam.fov, 1, 0.08, 40);
    this.baseCam = new THREE.Vector3().fromArray(cam.pos);
    this.baseLook = new THREE.Vector3().fromArray(cam.look);
    this.pushCam = new THREE.Vector3(-0.3, 2.2, -0.1);
    this.pushLook = new THREE.Vector3(0, 3.1, 6.75);
    this.camPos = this.baseCam.clone();
    this.lookPos = this.baseLook.clone();

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
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.api.live = false;
      this.api.failed = true;
      this.api.reason = 'context-lost';
      this.api.shown = false;
      const wrap = canvas.parentElement;
      if (wrap) wrap.classList.remove('death3d');
      console.warn('Death 3D lost the WebGL context; painted arena stays.');
    }, { once: true });
    return true;
  }

  async start() {
    this._mountApi();
    await this._loadAssets();
    await new Promise(r => requestAnimationFrame(r));
    this.resize();
    if (!this.canvas.clientWidth || !this.canvas.clientHeight) {
      this.api.reason = 'no-size';
      this.api.failed = true;
      return;
    }
    this._render();
    const wrap = this.canvas.parentElement;
    if (wrap) wrap.classList.add('death3d');
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
    const pr = Math.min(pixelCap(), window.devicePixelRatio || 1);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    const framed = this.pack ? framePack(w / h) : frameShot(w / h, this.manifest.layout.hero);
    this.camera.fov = framed.fov;
    this.camera.far = this.pack ? 90 : 40;
    this.baseCam.copy(framed.pos);
    this.baseLook.copy(framed.look);
    if (this.pack) {
      this.pushCam.copy(framed.pos).add(new THREE.Vector3(0, 0.2, -1.05));
      this.pushLook.copy(framed.look).add(new THREE.Vector3(0, 0.35, -0.35));
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
    const wrap = this.canvas.parentElement;
    if (wrap) wrap.classList.remove('death3d');
  }

  show() {
    if (this.api.shown) return;
    const wrap = this.canvas.parentElement;
    if (wrap) wrap.classList.add('death3d');
    this.api.shown = true;
    this.resize();
  }

  tick(dt) {
    dt = Math.min(0.05, dt || 0);
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
    }
    if (flashRose) {
      this.flinchT = motion.reduced ? 0.12 : 0.32;
      this.deathActor.play('hit');
      this.vfx.sparks(this._anchorWorld(this.deathActor, 'chest'), flash);
      this.hitLight.color.set(0xffe2b0);
      this.hitLight.intensity = motion.reduced ? 4 : 16;
      this.hitLight.position.copy(this._anchorWorld(this.deathActor, 'chest'));
    }
    if (hurtRose) {
      this.heroActors[this.activeHero].play('hit');
      this.hitLight.color.set(0xff3030);
      this.hitLight.intensity = Math.max(this.hitLight.intensity, motion.reduced ? 3 : 10);
      this.hitLight.position.copy(this.heroAnchor.position).y += 1.1;
    }
    if (run.hp <= 0 && !this.downed && !this.won) {
      this.downed = true;
      this.fallT = 0;
      this.heroActors[this.activeHero].play('death');
    } else if (run.hp > 0 && this.downed) {
      this.downed = false;
      this.fallT = 0;
      this.heroActors[this.activeHero].play('idle');
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
    this.prevHurt = 0;
    this.prevLunge = 0;
    this.prevFlash = 0;
    this.deathActor.play('idle');
    this.heroActors[this.activeHero].play('idle');
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
    if (ph >= 2) this.deathActor.play('cast');
  }

  _win() {
    if (this.won) return;
    this.won = true;
    this.crumbleT = 0;
    this.deathActor.play('defeat');
    this.heroActors[this.activeHero].play('victory');
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
      /* A real mesh dissolves. The placeholder has no shader, so it fades. */
      if (!d.dissolve) {
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
    /* Attack_Sweep and Defeat_Slump sink the robe into the dais. Lift him clear. */
    if (this.pack && d.model) {
      const logical = d.clipLogical;
      const lift = (logical === 'attack' || logical === 'defeat') ? 0.13 : 0;
      d.model.position.y += (lift - d.model.position.y) * Math.min(1, dt * 8);
    }
    if (d.dissolve) d.dissolve.value = this.won ? Math.min(1, this.crumbleT / 2.2) : 0;
  }

  _lights(t, motion) {
    const flick = motion.reduced ? 0 : (Math.sin(t * 9.0) * 0.5 + Math.sin(t * 23.0) * 0.35);
    this.brazierL[0].intensity = 18 + flick * 5;
    this.brazierL[1].intensity = 16 + Math.cos(t * 11.0) * 4;
    const ph = this.phase;
    this.rim.intensity = (6.5 + (ph - 1) * 1.4) * (this.won ? 0.45 : 1);
    const eyePos = this._anchorWorld(this.deathActor, 'eyes');
    this.soulLight.position.copy(eyePos);
    this.soulLight.position.z -= 0.55;
    this.soulLight.intensity = (ph === 1 ? 0.9 : ph === 2 ? 2.4 : 4.5) * (0.85 + 0.15 * Math.sin(t * 3));
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
    const bump = motion.reduced ? 0 : Math.sin(Math.min(1, this.cineT) * Math.PI);
    this.camPos.copy(this.baseCam).lerp(this.pushCam, bump * 0.9);
    this.lookPos.copy(this.baseLook).lerp(this.pushLook, bump);
    if (!motion.reduced) this.camPos.y += Math.sin(performance.now() / 1000 * 0.8) * 0.012;
    if (this.downed) {
      const f = this.fallT * this.fallT;
      this.camPos.y -= f * 0.7;
      this.lookPos.y -= f * 1.35;
    }
    const sh = Math.min(view.shake || 0, 16) * 0.0032 * motion.shake;
    if (sh) {
      this.camPos.x += (Math.random() - 0.5) * sh;
      this.camPos.y += (Math.random() - 0.5) * sh;
    }
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.lookPos);
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
    this.renderer.render(this.scene, this.camera);
  }

  _buildLights() {
    const scene = this.scene;
    scene.add(new THREE.HemisphereLight(0x4a5c6c, 0x1a100c, 1.35));
    const fill = new THREE.DirectionalLight(0xffe2c4, 2.6);
    fill.position.set(-0.8, 3.2, -3.5);
    scene.add(fill);
    /* Cold rim from behind Death, aimed at his chest so the hood reads. */
    this.rim = new THREE.DirectionalLight(0x9af6ea, 6.5);
    this.rim.position.set(0.3, 6.2, 12.5);
    this.rim.target.position.set(0, 3.1, 6.6);
    scene.add(this.rim);
    scene.add(this.rim.target);
    const side = new THREE.DirectionalLight(0x7ee0ff, 2.2);
    side.position.set(-4.5, 4.2, 8.5);
    side.target.position.set(0, 3.0, 6.5);
    scene.add(side);
    scene.add(side.target);
    this.soulLight = new THREE.PointLight(0x62ffd8, 6, 5.5, 2);
    scene.add(this.soulLight);
    this.brazierL = [new THREE.PointLight(0xff7a3a, 18, 7.5, 2), new THREE.PointLight(0xff6828, 16, 7.5, 2)];
    this.brazierL.forEach(l => scene.add(l));
    this.heroRim = new THREE.DirectionalLight(0x9af6ea, 0.85);
    this.heroRim.position.set(1.4, 2.6, -2.4);
    this.heroRim.target.position.set(-0.1, 1.15, 0.4);
    scene.add(this.heroRim);
    scene.add(this.heroRim.target);
    this.hitLight = new THREE.PointLight(0xffe2b0, 0, 5, 2);
    scene.add(this.hitLight);
    this.candleL = new THREE.PointLight(0xffc48a, 6, 4.5, 2);
    scene.add(this.candleL);
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
    const shadow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.tex.shadow, transparent: true, depthWrite: false, opacity: 0.8,
    }));
    shadow.position.y = 0.02;
    shadow.scale.set(1.1, 0.55, 1);
    this.heroAnchor.add(shadow);
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
    if (want1k()) downscaleMaps(deathG.scene, 1024);
    /* Baked albedo. Film tone-mapping would crush it a second time. */
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.room.group.visible = false;
    this.throne.group.visible = false;
    this.deathActor.bindGltf(deathG, this.manifest.assets.death, seat);
    this._eyeGlow(this.deathActor.model);
    const marker = env.getObjectByName('Marker_Hero');
    const p = new THREE.Vector3(0, 0, 6.5);
    if (marker) marker.getWorldPosition(p);
    this.stand = { hero: [p.x, p.y, p.z], lungeSign: -1 };
    this.heroAnchor.position.set(p.x, p.y, p.z);
    this.heroAnchor.rotation.y = Math.PI;
    this.scene.fog = new THREE.FogExp2(0x141c18, 0.012);
    this.scene.background = new THREE.Color(0x070a09);
    this._flames(env);
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
    if (id === this.activeHero) this.heroes[id].group.visible = false;
    else if (this.heroActors[id].model) this.heroActors[id].model.visible = false;
  }

  _eyeGlow(model) {
    const socket = model && model.getObjectByName('Socket_Eyes');
    if (!socket) return;
    const map = this.tex.soul;
    [-1, 1].forEach(s => {
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map, color: 0x7dffc4, blending: THREE.AdditiveBlending, transparent: true,
        depthWrite: false, toneMapped: false, opacity: 0.7,
      }));
      halo.scale.set(0.2, 0.11, 1);
      halo.position.set(s * 0.058, 0.02, 0.07);
      const core = new THREE.Sprite(new THREE.SpriteMaterial({
        map, color: 0xf3fff8, blending: THREE.AdditiveBlending, transparent: true,
        depthWrite: false, toneMapped: false, opacity: 1,
      }));
      core.scale.set(0.055, 0.04, 1);
      core.position.set(s * 0.058, 0.02, 0.09);
      socket.add(halo, core);
    });
  }

  _flames(env) {
    const fire = this.tex.fire;
    if (fire) prepSheet(fire, 4, 4, 20);
    this.flameSprites = [];
    env.traverse(obj => {
      if (!obj.name) return;
      const brazier = obj.name.indexOf('Socket_Flame_Brazier') === 0;
      const candle = obj.name.indexOf('Socket_Candles') === 0;
      if (!brazier && !candle) return;
      obj.updateWorldMatrix(true, false);
      const at = new THREE.Vector3();
      obj.getWorldPosition(at);
      const nearCam = at.z > 7.5;
      if (fire) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({
          map: fire, blending: THREE.AdditiveBlending, transparent: true,
          depthWrite: false, toneMapped: false, color: 0xffb060,
        }));
        const base = brazier ? (nearCam ? 0.26 : 0.58) : 0.2;
        sp.scale.setScalar(base);
        sp.userData.base = base;
        sp.position.y = brazier ? 0.08 : 0.02;
        obj.add(sp);
        this.flameSprites.push(sp);
      }
      if (brazier && !nearCam && !this.low) {
        const light = new THREE.PointLight(0xff8a3a, 4.5, 5.5, 2);
        light.position.y = 0.05;
        obj.add(light);
      }
    });
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
    this.ringGeo = new THREE.RingGeometry(0.18, 0.28, 32);
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
    const haloMap = this.tex.orb || this.tex.flare || coreMap;
    const group = new THREE.Group();
    const halo = this._sprite(haloMap, 1.7, 0x4ee0c4, 0.5);
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
    const ring = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({
      color: whiff ? 0x88aacc : 0xb8fff0, transparent: true, opacity: 0.85, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }));
    ring.position.copy(pos);
    if (camPos) ring.lookAt(camPos);
    ring.userData.t = 0;
    ring.userData.dur = 0.42;
    this.scene.add(ring);
    this.rings.push(ring);
    if (this.tex.impact) {
      const map = this.tex.impact.clone();
      map.colorSpace = THREE.SRGBColorSpace;
      map.needsUpdate = true;
      prepSheet(map, 4, 4, 24);
      map.userData._sheet.loop = false;
      const burst = this._sprite(map, whiff ? 1.15 : 1.7, 0xffffff, 1);
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

function toUnlit(mat) {
  if (!mat || mat.isMeshBasicMaterial || mat.isSpriteMaterial || mat.isShaderMaterial) return mat;
  const map = mat.map || mat.emissiveMap || null;
  if (map) {
    map.colorSpace = THREE.SRGBColorSpace;
    map.needsUpdate = true;
  }
  const basic = new THREE.MeshBasicMaterial({
    map,
    color: mat.map && mat.color ? mat.color.clone() : new THREE.Color(0xffffff),
    transparent: !!mat.transparent,
    opacity: mat.opacity == null ? 1 : mat.opacity,
    alphaTest: mat.alphaTest || 0,
    side: mat.side,
  });
  basic.name = mat.name || '';
  return basic;
}

function styleMaterial(mat, opts) {
  const basic = toUnlit(mat);
  const rim = opts.rim || 0;
  const wind = opts.wind ? 1 : 0;
  const dissolve = opts.dissolve || NO_DISSOLVE;
  basic.onBeforeCompile = (shader) => {
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
  outgoingLight += vec3(0.55, 0.86, 0.8) * d3rim * uRim;
  float d3hash = fract(sin(dot(vD3Pos.xz, vec2(127.1, 311.7))) * 43758.5453);
  if (uDissolve > 0.001 && d3hash < uDissolve) discard;
  if (uDissolve > 0.001 && d3hash < uDissolve + 0.08) outgoingLight = vec3(0.55, 1.0, 0.86);
}
#include <opaque_fragment>`);
  };
  basic.customProgramCacheKey = () => 'oe-d3d-ink2';
  return basic;
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
      for (const key of ['map', 'emissiveMap']) {
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

/* Pack shot. Vertical fov is three.js's fov, so a wide short strip opens
   a huge horizontal view unless the lens tightens. Look at the skull.
   Numbers assume pack.scale 1.28 (Death and the throne grow together). */
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

function motionScale() {
  let reduced = false;
  try { reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { reduced = false; }
  const fast = !!(window.LD && window.LD.S && window.LD.S.fast);
  return { reduced, fast, k: fast ? 0.55 : 1, shake: reduced ? 0.15 : 1 };
}
