/* The main crawl's characters in 3D. The dungeon painting, props, effects
   and all the UI stay on the 2D canvases; this is a transparent layer in
   between that draws the hero and every foe and boss as rigged Meshy models
   using the shared animation library. The camera is orthographic and locked
   to the 2D camera (one 3D unit = one 2D world pixel), so a model stands on
   exactly the tile its sprite would. index.html feeds it the same numbers the
   2D renderer uses; if anything throws, index.html goes back to sprites. */
import * as THREE from 'three';
import { Stage, FOE3D } from './slayer3d.js';

const PXM = 62;            // 2D world pixels per meter
const YAW = 1.0;           // characters turn this far from profile toward the camera (radians from +Z)

export async function boot(canvas) {
  const s = new Crawl(canvas);
  await s.load();
  return s;
}

class Crawl extends Stage {
  constructor(canvas) {
    super(canvas, { overlay: true });
    this.camera = new THREE.OrthographicCamera(0, 1, 1, 0, -4000, 4000);
    this.flash.distance = 420;
    this.keyLight.position.set(-2, 5, 8);
    this.rimLight.position.set(3, 4, -6);
    // the painted dungeon is dark; keep the models in its light instead of a showroom's
    this.renderer.toneMappingExposure = 0.95;
    this.scene.environmentIntensity = 0.3;
    this.keyLight.intensity = 1.5;
    this.keyLight.color.setHex(0xffd2a0);
    this.rimLight.intensity = 1.5;
    this.scene.traverse(o => { if (o.isHemisphereLight) { o.intensity = 0.65; o.color.setHex(0x8a9aa6); } });
    this.enemy = new Map();     // game object -> actor (or null while loading)
    this.prev = { lunge: 0, hurt: 0, arrow: null, boom: null };
    this.swing = 0;
  }

  _scaleActor(a, maxPx, wantM) {
    let k = PXM;
    if (wantM) k = (wantM * PXM) / a.height;
    if (maxPx && a.height * k > maxPx) k = maxPx / a.height;
    a.holder.scale.setScalar(k);
    a.k = k;
    a.px = a.height * k;
    a.blob.rotation.x = 0;          // side-on camera: the shadow is an upright ellipse at the feet
    a.blob.scale.set(a.width * k * 1.1, a.width * k * 0.22, 1);
  }

  async _heroFor(id) {
    if (this.heroId === id || this._heroLoading) return;
    this._heroLoading = true;
    try {
      const g = await this._gltf('death3d/assets/models/hero_' + id + '.glb');
      if (this.hero) { this.scene.remove(this.hero.holder); this.scene.remove(this.hero.blob); }
      this.hero = this._makeActor(g, { hero: true });
      this._scaleActor(this.hero, 128);
      this.heroId = id;
      this.skinId = undefined;
      this._play(this.hero, 'Combat_Stance');
    } finally { this._heroLoading = false; }
  }

  _modelOf(o) { return o.t === 'labfreak' && o.mutated ? 'labfreak2' : o.t; }

  async _enemyActor(o) {
    const t = this._modelOf(o);
    const spec = FOE3D[t];
    let a = null;
    if (spec) {
      try {
        const g = await this._gltf('models3d/foes/' + t + '.glb');
        a = this._makeActor(g, { foe: true, spec });
      } catch (e) { a = null; }
    }
    if (!a) return null;
    a.model = t;
    const want = a.mixer ? null : ({ rat: 0.75, slime: 1.1, mimic: 1.0, brainjar: 1.3, wraith: 2.0, bandit: 2.6 })[t] || 1.8;
    this._scaleActor(a, o.boss ? 168 : o.big ? 150 : 138, want);
    if (a.mixer) this._play(a, 'Combat_Stance', { from: Math.random() * 2 });
    return a;
  }

  /* Top of a foe's head in 2D world y, for its life bar and intent. */
  enemyTop(o, GY) {
    const a = this.enemy.get(o);
    return a ? GY - a.px - 4 : null;
  }
  hasEnemy(o) { return !!this.enemy.get(o); }

  /* f: numbers from index.html's frame(): r (run), view, cam, sx, sy, VWd, VHd,
     VH, GY, T, dt, moving, heroX (2D world x), offX(o) (lunge + knockback). */
  render(f) {
    const r = f.r, view = f.view, dt = f.dt;
    this.clock += dt;
    const w = this.canvas.clientWidth || 1, h = this.canvas.clientHeight || 1;
    if (this._w !== w || this._h !== h) { this._w = w; this._h = h; this.renderer.setSize(w, h, false); }
    const cam = this.camera;
    cam.left = 0; cam.right = f.VWd;
    cam.top = f.GY - f.VH + f.VHd; cam.bottom = f.GY - f.VH;
    cam.position.set(f.cam - f.sx, f.sy, 1000);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();

    if (this.heroId !== r.hero) this._heroFor(r.hero);
    if (this.hero) this._hero(f);
    this._enemies(f);
    this._crawlFx(f);
    this.renderer.render(this.scene, cam);
  }

  _hero(f) {
    const h = this.hero, r = f.r, v = f.view;
    this._applySkin({ hero: r.hero });
    const x = f.heroX;
    h.holder.position.set(x, 0, 0);
    h.holder.rotation.y = YAW;
    h.blob.position.set(x, 0.5, -30);
    // a new blow: the arrow, the bomb, or a blade swing picks the clip
    const lungeRose = v.lunge > this.prev.lunge + 0.25;
    const slashNew = v.slash && v.slash !== this.prev.slash;
    const arrowNew = v.arrow && v.arrow !== this.prev.arrow;
    const boomNew = v.boom && v.boom !== this.prev.boom;
    const hurtRose = v.hurt > this.prev.hurt + 0.2;
    this.prev.lunge = v.lunge; this.prev.hurt = v.hurt; this.prev.arrow = v.arrow; this.prev.boom = v.boom; this.prev.slash = v.slash;
    // a one-shot clip plays only its strike, then hands back; walking cuts it short
    const now = this.clock;
    const once = (name, speed, from, len) => { this._play(h, name, { once: true, speed, from, fade: 0.08 }); h.until = now + len; };
    if (r.hp <= 0) { if (h.curName !== 'Dead') this._play(h, 'Dead', { once: true }); }
    else if (boomNew) once('Charged_Ground_Slam', 1.6, 0.5, 0.9);
    else if (arrowNew) once(r.hero === 'ranger' ? 'Archery_Shot' : 'Charged_Spell_Cast', 1.6, 0.3, 0.8);
    else if (slashNew || (lungeRose && v.slash)) once('Attack', 1.35, 0.2, 0.7);         // one clean sword strike
    else if (lungeRose) once('Standard_Forward_Charge', 1.8, 0.1, 0.4);                   // a boots shove: shoulder in, no swing
    else if (hurtRose) once('Hit_Reaction', 1.5, 0, 0.5);
    else {
      const busy = h.cur && h.cur.loop === THREE.LoopOnce && h.cur.isRunning() && now < (h.until || 0) && !(f.moving && h.curName !== 'Hit_Reaction');
      if (!busy) this._play(h, f.moving ? 'Walk_Fight_Forward' : 'Combat_Stance', { fade: 0.2, speed: f.moving ? 1.25 : 1 });
    }
    if (h.mixer) h.mixer.update(f.dt);
    this._tint(h, 0, v.hurt > 0.6 ? 0.5 : 0);
  }

  _enemies(f) {
    const r = f.r, seen = new Set();
    for (const o of r.objs) {
      if (o.kind !== 'enemy') continue;
      seen.add(o);
      let a = this.enemy.get(o);
      if (a && a.model !== this._modelOf(o)) { this._drop(a); this.enemy.delete(o); a = undefined; }   // Labfreak mutates
      if (a === undefined) {
        if (o.gone) continue;
        this.enemy.set(o, null);
        this._enemyActor(o).then(x => { if (x) { x.prevLunge = o.lunge || 0; x.prevFlash = o.flash || 0; this.enemy.set(o, x); } else this.enemy.delete(o); }).catch(() => this.enemy.delete(o));
        continue;
      }
      if (!a) continue;
      const spec = a.opts.spec;
      const x = o.dx + f.T / 2 + f.offX(o);
      const visible = x > f.cam - 160 && x < f.cam + f.VWd + 160;
      a.holder.visible = a.blob.visible = visible;
      const behind = o.dx + f.T / 2 < f.heroX;
      a.holder.rotation.y = behind ? YAW : -YAW;
      const moving = Math.abs(o.x * f.T - o.dx) > 2;
      const lungeRose = (o.lunge || 0) > (a.prevLunge || 0) + 0.25;
      const flashRose = (o.flash || 0) > (a.prevFlash || 0) + 0.3;
      a.prevLunge = o.lunge || 0; a.prevFlash = o.flash || 0;
      let y = 0, sx = 1, sy = 1;
      if (o.gone) {
        a.goneT = (a.goneT || 0) + f.dt;
        if (a.mixer && !a.dying) { a.dying = true; this._play(a, ['Dead', 'Knock_Down', 'dying_backwards'][o.id % 3], { once: true, speed: 1.3 }); }
        if (!a.mixer) a.root.rotation.z = Math.min(1.4, a.goneT * 3) * (behind ? -1 : 1);
        this._fade(a, Math.max(0, 1 - Math.max(0, a.goneT - 0.8) / 0.6));
        if (a.goneT > 1.6) { a.holder.visible = a.blob.visible = false; }
      } else if (a.mixer) {
        if (lungeRose && this.clips[spec.attack]) this._play(a, spec.attack, { once: true, speed: 1.5, from: 0.2, fade: 0.08 });
        else if (flashRose) this._play(a, 'Hit_Reaction', { once: true, speed: 1.6, fade: 0.05 });
        else {
          const busy = a.cur && a.cur.loop === THREE.LoopOnce && a.cur.isRunning();
          if (!busy) this._play(a, moving ? (spec.walk || 'Walk_Fight_Forward') : 'Combat_Stance', { fade: 0.2 });
        }
      } else {
        a.t = (a.t || o.id) + f.dt;
        y = (spec.hover || 0) * PXM + Math.abs(Math.sin(a.t * (moving ? 9 : 2.5))) * (moving ? 5 : 2) + (spec.hover ? Math.sin(a.t * 1.7) * 5 : 0);
        sx = 1 + (o.pose > 0 ? 0.1 : 0) + (o.flash || 0) * 0.08; sy = 1 - (o.pose > 0 ? 0.08 : 0);
      }
      if (a.mixer && visible) a.mixer.update(f.dt);
      a.holder.position.set(x, y, 0);
      if (!a.mixer) a.holder.scale.set(a.k * sx, a.k * sy, a.k * sx);
      a.blob.position.set(x, 0.5, -30);
      const tint = o.mutated ? 0x0c3a0c : o.elite ? 0x3a0606 : 0;
      this._tint(a, tint, o.flash || 0);
      if (flashRose && visible) this._burst(0xffe6c0, new THREE.Vector3(x, a.px * 0.55, 40), 12, 90, 0.35);
    }
    for (const [o, a] of this.enemy) if (!seen.has(o)) { if (a) this._drop(a); this.enemy.delete(o); }
  }

  /* A bomb lights the scene for a moment; everything else keeps its 2D effect. */
  _crawlFx(f) {
    const v = f.view;
    if (v.boom && v.boom !== this._boomSeen) { this._boomSeen = v.boom; this._flash(0xffb070, 9, v.boom.x); this.flash.position.set(v.boom.x, 60, 120); }
    this.flash.intensity *= Math.pow(0.03, f.dt);
    this.fx = this.fx.filter(e => {
      e.t += f.dt;
      const p = Math.min(1, e.t / e.dur), o = e.obj;
      if (e.kind === 'burst') {
        const at = o.geometry.attributes.position;
        for (let i = 0; i < e.v.length; i++) { e.v[i].y -= 260 * f.dt; at.array[i * 3] += e.v[i].x * f.dt; at.array[i * 3 + 1] += e.v[i].y * f.dt; at.array[i * 3 + 2] += e.v[i].z * f.dt; }
        at.needsUpdate = true; o.material.opacity = 1 - p;
      }
      if (p >= 1) { this.scene.remove(o); o.geometry && o.geometry.dispose(); o.material.dispose(); return false; }
      return true;
    });
  }

  _burst(color, pos, n, speed, dur) {
    super._burst(color, pos, n, speed, dur);
    const e = this.fx[this.fx.length - 1];
    if (e && e.obj.material) e.obj.material.size = 5;
  }

  ready() { return !!this.hero; }
  hide() { this.canvas.style.display = 'none'; }
  show() { this.canvas.style.display = 'block'; }
}
