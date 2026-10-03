/* glim-anim.js : procedural creature animation for Glimmerdeep (zero art cost, DOM + Web Animations API).
 *
 * Works on the game's EXISTING unit markup, no HTML change needed:
 *   <div class="unit ..."><div class="uhud">..</div><div class="rig"><img class="spr" src="img/cr_cind2.webp"></div><div class="shadow"></div></div>
 * attach() wraps the <img> in two extra layers at runtime:
 *   .rig  (actions: strike / shoot / cast / hit / faint; the game already animates this layer)
 *     .amove  (walk steps)
 *       .abody  (idle: breathe / bob / sway ...  runs forever, desynced per unit)
 *         img.spr
 * and animates .shadow with the hops. Only transform / opacity / (short) filter are animated, so it runs on the
 * compositor; idle costs nothing on the main thread.
 *
 * Everything is driven by ARCHETYPE PARAMETERS (see ARCH): a species key is mapped to an archetype (SPECIES table, else
 * guessed from role/range) so a brand-new species works with zero hand tuning, and any single field can be overridden per species.
 *
 * Public API (all calls are safe: bad input = silent no-op, any exception is swallowed unless GlimAnim.debug):
 *   GlimAnim.scan(rootEl)                       attach to every .unit under rootEl that is not attached yet
 *   GlimAnim.observe(rootEl)                    scan now + MutationObserver (units re-rendered by innerHTML get attached automatically)
 *   GlimAnim.attach(unitEl, {sp, role, rng})    attach one unit (sp/role are read from the img src / GD data when omitted)
 *   GlimAnim.strike(a, t, {el, rng})  -> ms until the blow lands   (a, t = unit elements; call hit(t,{delay}) with that value)
 *   GlimAnim.shoot(a, t, {el})        -> ms until the projectile should leave
 *   GlimAnim.cast(a, {el, ult})       GlimAnim.hit(t, {from, crit, dot, delay})   GlimAnim.faint(t, {from})
 *   GlimAnim.walk(u, {ms, dx, dy})    GlimAnim.cheer(u)   GlimAnim.revive(u)
 *   GlimAnim.speed = 1|2|4            game speed (durations are divided by it)
 *   GlimAnim.enabled = false          instant off switch (falls back to the CSS idle already in the game)
 */
(function (root) {
'use strict';
const HAS = typeof document !== 'undefined' && typeof Element !== 'undefined' && !!Element.prototype.animate;
const GA = { enabled: true, speed: 1, debug: false, ghosts: true, dust: true, reduced: false, version: '1.0' };
try { GA.reduced = !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) {}

// ---------------------------------------------------------------- archetypes
// idle: breathe | bob | sway | wobble | hover | flutter | coil | twitch      (amp = strength, per = base seconds)
// walk: hop | bound | waddle | stomp | glide | slither | skitter | fly | wiggle
// melee: lunge | pounce | slam | ram | peck | lash | dive | bump
// ranged: spit | rear | pulse | hover
// faint: topple | collapse | deflate | fall | flip | roll
// mass: 0.6 light .. 2 heavy (windup length, flinch distance, shake)   reach: lunge distance factor   shadow: 0 floats .. 1 grounded
const ARCH = {
  round:   { idle: 'breathe', amp: 1.1, per: 2.2, walk: 'hop',     melee: 'lunge',  ranged: 'spit',  faint: 'topple',   mass: 0.9, reach: 1,   tilt: 1,   shadow: 1 },
  quad:    { idle: 'breathe', amp: 0.9, per: 2.6, walk: 'bound',   melee: 'pounce', ranged: 'spit',  faint: 'topple',   mass: 1.0, reach: 1.1, tilt: 1,   shadow: 1 },
  biped:   { idle: 'sway',    amp: 1.0, per: 2.8, walk: 'waddle',  melee: 'lunge',  ranged: 'rear',  faint: 'topple',   mass: 1.1, reach: 1,   tilt: 1,   shadow: 1 },
  heavy:   { idle: 'breathe', amp: 0.8, per: 3.4, walk: 'stomp',   melee: 'slam',   ranged: 'rear',  faint: 'collapse', mass: 1.8, reach: 0.8, tilt: 0.6, shadow: 1 },
  serpent: { idle: 'coil',    amp: 1.0, per: 2.4, walk: 'slither', melee: 'lash',   ranged: 'rear',  faint: 'collapse', mass: 0.9, reach: 1.25, tilt: 0.8, shadow: 1 },
  winged:  { idle: 'flutter', amp: 1.0, per: 1.3, walk: 'fly',     melee: 'dive',   ranged: 'spit',  faint: 'fall',     mass: 0.7, reach: 1.15, tilt: 1.2, shadow: 0.6 },
  floater: { idle: 'hover',   amp: 1.0, per: 3.0, walk: 'glide',   melee: 'bump',   ranged: 'pulse', faint: 'deflate',  mass: 0.6, reach: 0.9, tilt: 1,   shadow: 0.35 },
  insect:  { idle: 'twitch',  amp: 1.0, per: 1.6, walk: 'skitter', melee: 'peck',   ranged: 'spit',  faint: 'flip',     mass: 0.6, reach: 1,   tilt: 1.2, shadow: 1 },
  aquatic: { idle: 'hover',   amp: 0.9, per: 2.8, walk: 'wiggle',  melee: 'ram',    ranged: 'pulse', faint: 'roll',     mass: 1.2, reach: 1,   tilt: 1,   shadow: 0.7 },
  sprout:  { idle: 'sway',    amp: 1.2, per: 2.2, walk: 'hop',     melee: 'bump',   ranged: 'pulse', faint: 'topple',   mass: 0.8, reach: 0.9, tilt: 1.1, shadow: 1 },
};
// species key -> archetype (+ optional field overrides). Covers the 72 existing species; anything else uses ROLE_GUESS.
const SPECIES = {
  cind: 'quad', pyrp: 'quad', bubb: 'round', shel: 'heavy', sprt: 'round', moss: 'sprout', sprk: 'round', buzz: 'winged', pebb: 'heavy', crys: 'heavy', wisp: 'floater', dusk: 'winged',
  emba: 'quad', emfl: 'insect', emgo: 'heavy', emph: 'winged', emdr: 'winged',
  tifr: 'round', tijl: 'floater', tish: 'aquatic', tisq: 'aquatic', tiwh: ['aquatic', { mass: 2, walk: 'stomp', faint: 'collapse' }],
  blbe: 'insect', blfl: 'quad', blcm: 'quad', bldr: 'quad', blmn: 'insect',
  vosn: ['round', { walk: 'glide', melee: 'bump', mass: 1.2 }], vohu: 'quad', vobi: 'winged', voro: ['quad', { mass: 1.5, melee: 'ram' }], voli: 'quad',
  stmo: 'round', stgo: ['quad', { melee: 'ram' }], stsc: 'insect', stbe: 'heavy', stli: 'quad',
  shra: 'winged', shsp: 'insect', shdo: 'quad', shwr: 'floater', shse: 'serpent',
  frpe: ['round', { walk: 'waddle' }], frst: 'quad', frwa: 'heavy', frow: 'winged', frmm: 'heavy', frfl: 'floater', frsa: 'quad', frdr: 'winged',
  gahu: 'winged', gash: ['round', { walk: 'bound' }], gafe: 'quad', gamt: ['winged', { idle: 'hover', walk: 'glide' }], gagr: 'quad', gadl: 'floater', gaki: 'quad', gase: 'serpent',
  mecr: ['heavy', { walk: 'skitter', mass: 1.4 }], mean: 'insect', mesc: 'insect', mepa: 'heavy', mewf: 'quad', mest: 'insect', mebu: ['quad', { mass: 1.5, melee: 'ram' }],
  myun: 'quad', myor: 'floater', mydf: 'winged', myqi: 'quad', mybe: 'round', mysh: 'floater', mydr: 'winged',
};
// when a species is not in SPECIES (new ones): role/range guess; the plan table can pass an archetype explicitly via GlimAnim.register()
const ROLE_GUESS = { striker: 'quad', tank: 'heavy', caster: 'floater', support: 'round' };
GA.ARCH = ARCH; GA.SPECIES = SPECIES;
GA.register = function (table) { // { key: 'archetype' | ['archetype', {overrides}] }
  for (const k in table) SPECIES[k] = table[k];
};
function params(sp, role, boss) {
  let d = SPECIES[sp];
  if (!d) d = boss ? ['heavy', { mass: 2.4, amp: 0.7 }] : ROLE_GUESS[role] || 'round';
  const name = Array.isArray(d) ? d[0] : d, over = Array.isArray(d) ? d[1] : null;
  return Object.assign({ name }, ARCH[name] || ARCH.round, over || {});
}
GA.params = params;

// ---------------------------------------------------------------- element flavour
const ELC = { ember: '#ff7a2a', tide: '#2fa6ff', bloom: '#4fd35a', volt: '#ffd21f', stone: '#e0a860', shade: '#9d8bff', frost: '#8fe3ff', gale: '#7dffc2', metal: '#d8e2ee', mystic: '#d9a6ff' };
const glow = (el, r) => `drop-shadow(0 0 ${r || 10}px ${ELC[el] || '#fff'}) drop-shadow(0 0 3px #fff)`;
GA.ELC = ELC;

// ---------------------------------------------------------------- helpers
const st = new WeakMap();
const rand = (a, b) => a + Math.random() * (b - a);
const sgn = v => (v < 0 ? -1 : 1);
const dur = ms => Math.max(30, ms / (GA.speed || 1));
function safe(fn) { return function () { if (!HAS || !GA.enabled) return 0; try { return fn.apply(null, arguments) || 0; } catch (e) { if (GA.debug) console.error('[GlimAnim]', e); return 0; } }; }
// one keyframe -> css. fields: x,y (px) r (deg) k (skewX deg) sx,sy (scale) o (opacity) f (filter)
function F(t, p, ease) {
  p = p || {};
  const o = { offset: t, transform: `translate(${(p.x || 0).toFixed(1)}px,${(p.y || 0).toFixed(1)}px) rotate(${(p.r || 0).toFixed(1)}deg) skewX(${(p.k || 0).toFixed(1)}deg) scale(${(p.sx == null ? 1 : p.sx).toFixed(3)},${(p.sy == null ? 1 : p.sy).toFixed(3)})` };
  if (p.o != null) o.opacity = p.o;
  if (p.f != null) o.filter = p.f;
  if (ease) o.easing = ease;
  return o;
}
function dirOf(u) { return u.classList.contains('faceL') ? -1 : 1; }
function center(u) { const r = u.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; }
function sizes(u, s) { return { U: u.offsetWidth || 90, H: (s.rig && s.rig.offsetHeight) || 80 }; }
function vec(a, t, fallbackDir) { // px vector a->t (client space) and unit direction
  if (!t) return { dx: fallbackDir * 90, dy: 0, d: 90, ux: fallbackDir, uy: 0 };
  const A = center(a), T = center(t), dx = T.x - A.x, dy = T.y - A.y, d = Math.hypot(dx, dy) || 1;
  return { dx, dy, d, ux: dx / d, uy: dy / d };
}
// scale pair that stretches along the attack axis
function stretch(v, k) { const ax = Math.abs(v.ux), ay = Math.abs(v.uy); return { sx: 1 + k * ax - k * 0.6 * ay, sy: 1 - k * 0.7 * ax + k * ay }; }
function squash(v, k) { const ax = Math.abs(v.ux), ay = Math.abs(v.uy); return { sx: 1 + k * (0.9 * ax + 0.2 * ay), sy: 1 - k * (0.85 * ax + 0.5 * ay) }; }

// ---------------------------------------------------------------- attach
function attach(u, o) {
  if (!HAS || !u || st.has(u)) return st.get(u) || null;
  const rig = u.querySelector('.rig'), spr = rig && rig.querySelector('img.spr, img');
  if (!rig || !spr) return null;
  o = o || {};
  const src = spr.getAttribute('src') || '';
  let sp = o.sp, star = o.star, boss = u.classList.contains('boss');
  const m = /cr_([a-z0-9]{4})(\d)\.webp/.exec(src);
  if (m) { sp = sp || m[1]; star = star || +m[2]; }
  let role = o.role;
  if (!role && root.GD && root.GD.SP && root.GD.SP[sp]) role = root.GD.SP[sp].role;
  const P = params(sp, role, boss);
  const amove = document.createElement('div'), abody = document.createElement('div');
  amove.className = 'amove'; abody.className = 'abody';
  rig.insertBefore(amove, spr); amove.appendChild(abody); abody.appendChild(spr);
  u.classList.add('ga');
  const s = { u, rig, amove, abody, spr, shadow: u.querySelector('.shadow'), P, sp, star, boss, act: null, wk: null, dead: false, idle: null };
  st.set(u, s);
  startIdle(s);
  return s;
}
GA.attach = safe(function (u, o) { attach(u, o); });
GA.scan = safe(function (rootEl) { (rootEl || document).querySelectorAll('.unit').forEach(u => attach(u)); });
GA.observe = safe(function (rootEl) {
  GA.scan(rootEl);
  if (!root.MutationObserver) return;
  new MutationObserver(() => GA.scan(rootEl)).observe(rootEl, { childList: true, subtree: true });
});
GA.detach = function (u) { const s = st.get(u); if (!s) return; try { s.idle && s.idle.cancel(); } catch (e) {} st.delete(u); };

// ---------------------------------------------------------------- idle
function idleFrames(P, boostMass) {
  const a = P.amp * (GA.reduced ? 0.4 : 1), k = P.tilt;
  switch (P.idle) {
    case 'hover': return [F(0, { y: 0 }), F(.5, { y: -7 * a, r: 1.6 * k, sx: 1 - .01 * a, sy: 1 + .015 * a }), F(1, { y: 0 })];
    case 'flutter': return [F(0, { y: -2 * a, r: -2 * k }), F(.25, { y: -6 * a, r: 1.5 * k, sy: 1.03 }), F(.5, { y: -2 * a, r: 2 * k }), F(.75, { y: -5 * a, r: -1 * k, sy: 1.03 }), F(1, { y: -2 * a, r: -2 * k })];
    case 'sway': return [F(0, { r: -2.2 * a * k, k: 1.2 * a, sx: 1.01, sy: .99 }), F(.5, { r: 2.2 * a * k, k: -1.2 * a, sx: .99, sy: 1.015 }), F(1, { r: -2.2 * a * k, k: 1.2 * a, sx: 1.01, sy: .99 })];
    case 'coil': return [F(0, { k: -6 * a, sy: 1, sx: 1.01 }), F(.5, { k: 6 * a, sy: 1.035, sx: .99 }), F(1, { k: -6 * a, sy: 1, sx: 1.01 })];
    case 'wobble': return [F(0, { sx: 1.05 * a, sy: .95 }), F(.5, { sx: .96, sy: 1.05 * a }), F(1, { sx: 1.05 * a, sy: .95 })];
    case 'twitch': return [F(0), F(.62, { y: 0 }), F(.68, { r: -3.5 * k, y: -1.5 * a, sx: 1.015, sy: .985 }), F(.74, { r: 3 * k, y: 0 }), F(.8, { r: -2 * k }), F(.86, { r: 0 }), F(1)];
    default: return [F(0, { sx: 1 - .018 * a, sy: 1 + .028 * a, y: 0 }), F(.5, { sx: 1 + .035 * a, sy: 1 - .04 * a, y: 0 }), F(1, { sx: 1 - .018 * a, sy: 1 + .028 * a })]; // breathe: grows tall then settles flat
  }
}
function startIdle(s) {
  if (s.idle) try { s.idle.cancel(); } catch (e) {}
  const per = s.P.per * 1000 * rand(0.88, 1.14);
  s.idle = s.abody.animate(idleFrames(s.P), { duration: per, iterations: Infinity, easing: 'ease-in-out' });
  s.idle.currentTime = rand(0, per);
  s.idle.playbackRate = GA.speed > 1 ? Math.min(1.6, 1 + (GA.speed - 1) * 0.2) : 1;
  if (s.shadow && s.P.shadow < 0.8) { // floaters: the shadow breathes with the hover
    s.sidle = s.shadow.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(' + (0.86 + 0.14 * s.P.shadow) + ')', opacity: 0.8 }, { transform: 'scale(1)', opacity: 1 }], { duration: per, iterations: Infinity, easing: 'ease-in-out' });
    s.sidle.currentTime = s.idle.currentTime;
  }
}

// ---------------------------------------------------------------- action runner (rig layer)
function run(s, frames, ms, opts) {
  opts = opts || {};
  if (s.act && !s.dead) { try { s.act.cancel(); } catch (e) {} }
  const a = s.rig.animate(frames, { duration: dur(ms), easing: 'linear', fill: opts.fill || 'none', delay: dur(opts.delay || 0) });
  if (opts.fill !== 'forwards') s.act = a;
  else { s.act = a; }
  return a;
}
function shadowFx(s, frames, ms, delay) {
  if (!s.shadow) return;
  try { s.shadow.animate(frames, { duration: dur(ms), easing: 'linear', delay: dur(delay || 0) }); } catch (e) {}
}
// squash shadow when the body is in the air: y offset -> shadow scale
function shadowFor(ys, ms, s, delay) {
  shadowFx(s, ys.map(([t, y]) => ({ offset: t, transform: `scale(${Math.max(0.45, 1 + y / 120).toFixed(2)})`, opacity: Math.max(0.35, 1 + y / 90) })), ms, delay);
}

// small DOM helpers: afterimage ghosts on fast dashes, dust at the feet. Cheap, creature-attached, short-lived.
function ghost(s, ms, delay) {
  if (!GA.ghosts || GA.reduced) return;
  setTimeout(() => {
    if (!s.u.isConnected) return;
    const g = s.spr.cloneNode(false); g.removeAttribute('class');
    const r = s.spr.getBoundingClientRect(), pr = s.u.getBoundingClientRect();
    g.style.cssText = `position:absolute;pointer-events:none;width:${r.width}px;left:${r.left - pr.left}px;top:${r.top - pr.top}px;opacity:.45;z-index:9;filter:saturate(1.4) brightness(1.3);${s.u.classList.contains('faceL') ? 'transform:scaleX(-1);' : ''}`;
    s.u.appendChild(g);
    const a = g.animate([{ opacity: .45 }, { opacity: 0 }], { duration: dur(ms), easing: 'ease-out' });
    a.onfinish = () => g.remove();
  }, dur(delay));
}
function dust(s, n, delay, spread) {
  if (!GA.dust || GA.reduced) return;
  setTimeout(() => {
    if (!s.u.isConnected) return;
    const { U } = sizes(s.u, s), pr = s.u.getBoundingClientRect(), r = s.rig.getBoundingClientRect();
    for (let i = 0; i < n; i++) {
      const d = document.createElement('i'), side = i % 2 ? 1 : -1, sz = U * rand(0.07, 0.12);
      d.style.cssText = `position:absolute;pointer-events:none;z-index:8;border-radius:50%;width:${sz}px;height:${sz}px;left:${r.left - pr.left + r.width / 2 - sz / 2 + side * (spread || U * 0.25)}px;top:${r.bottom - pr.top - sz * 1.4}px;background:radial-gradient(circle,rgba(255,244,225,.85),rgba(210,190,160,.35) 60%,transparent 72%)`;
      s.u.appendChild(d);
      const a = d.animate([{ transform: 'translate(0,0) scale(.5)', opacity: .9 }, { transform: `translate(${side * U * rand(.1, .22)}px,${-U * rand(.04, .12)}px) scale(1.5)`, opacity: 0 }], { duration: dur(rand(300, 420)), easing: 'ease-out' });
      a.onfinish = () => d.remove();
    }
  }, dur(delay));
}

// ---------------------------------------------------------------- melee
const MELEE = {
  lunge(s, v, M) { // wind up, dart in, squash on contact, spring back
    const D = Math.min(v.d, M.U * 1.6) * 0.62 * s.P.reach, w = 0.13 * s.P.mass * M.U / 100, T = 440 + 60 * (s.P.mass - 1);
    const sq = squash(v, .2), stt = stretch(v, .2);
    ghost(s, 260, T * 0.34); dust(s, 2, T * 0.2);
    return { T, hit: 0.5, frames: [F(0), F(.26, { x: -v.ux * D * .2, y: -v.uy * D * .2 + M.H * .03, sx: 1 + .12 * (1 - Math.abs(v.ux)), sy: .86 }, 'ease-out'), F(.5, { x: v.ux * D, y: v.uy * D, r: 10 * sgn(v.ux) * s.P.tilt, sx: stt.sx, sy: stt.sy }, 'cubic-bezier(.2,.8,.3,1)'),
      F(.58, { x: v.ux * D * .92, y: v.uy * D * .92, r: 7 * sgn(v.ux), sx: sq.sx, sy: sq.sy }), F(.8, { x: -v.ux * D * .08, y: 0, r: -2 * sgn(v.ux), sx: 1.03, sy: .98 }, 'ease-in-out'), F(1)] };
  },
  pounce(s, v, M) { // crouch, leap in an arc, land with a squash
    const D = Math.min(v.d, M.U * 1.6) * 0.66 * s.P.reach, hgt = M.H * 0.42, T = 520;
    const sq = squash(v, .24);
    ghost(s, 300, T * 0.3); dust(s, 3, T * 0.55);
    shadowFor([[0, 0], [.25, 0], [.4, -hgt * .9], [.55, 0], [1, 0]], T, s);
    return { T, hit: 0.55, frames: [F(0), F(.22, { x: -v.ux * D * .12, y: M.H * .04, sx: 1.12, sy: .82 }, 'ease-out'), F(.4, { x: v.ux * D * .5, y: v.uy * D * .5 - hgt, r: 14 * sgn(v.ux) * s.P.tilt, sx: .94, sy: 1.1 }, 'ease-in-out'),
      F(.55, { x: v.ux * D, y: v.uy * D, r: 6 * sgn(v.ux), sx: sq.sx * 1.04, sy: sq.sy }, 'ease-in'), F(.68, { x: v.ux * D, y: v.uy * D, sx: sq.sx, sy: sq.sy }), F(.86, { x: v.ux * D * .15, y: 0, sx: 1.04, sy: .97 }, 'ease-in-out'), F(1)] };
  },
  slam(s, v, M) { // rear up, crash down: heavy creatures
    const D = Math.min(v.d, M.U * 1.4) * 0.34 * s.P.reach, T = 600 + 80 * (s.P.mass - 1);
    dust(s, 4, T * 0.5, M.U * 0.32);
    return { T, hit: 0.52, frames: [F(0), F(.3, { x: -v.ux * M.U * .05, y: -M.H * .07, r: -8 * sgn(v.ux) * s.P.tilt, sx: .94, sy: 1.14 }, 'ease-out'), F(.38, { x: -v.ux * M.U * .04, y: -M.H * .09, r: -10 * sgn(v.ux), sx: .93, sy: 1.16 }),
      F(.52, { x: v.ux * D, y: v.uy * D * .6 + M.H * .02, r: 9 * sgn(v.ux), sx: 1.2, sy: .8 }, 'cubic-bezier(.5,0,1,.6)'), F(.62, { x: v.ux * D, y: v.uy * D * .6, r: 4 * sgn(v.ux), sx: 1.14, sy: .86 }), F(.85, { x: 0, y: 0, sx: 1.03, sy: .98 }, 'ease-in-out'), F(1)] };
  },
  ram(s, v, M) { // slow wind-up, shoulder charge, recoil
    const D = Math.min(v.d, M.U * 1.5) * 0.6 * s.P.reach, T = 560 + 60 * (s.P.mass - 1);
    const stt = stretch(v, .12), sq = squash(v, .16);
    ghost(s, 280, T * 0.4); dust(s, 3, T * 0.25);
    return { T, hit: 0.54, frames: [F(0), F(.36, { x: -v.ux * D * .3, y: M.H * .03, r: -5 * sgn(v.ux), sx: 1.1 * (1 - Math.abs(v.uy) * .1), sy: .88 }, 'ease-in-out'), F(.54, { x: v.ux * D, y: v.uy * D, r: 6 * sgn(v.ux) * s.P.tilt, sx: stt.sx, sy: stt.sy }, 'cubic-bezier(.6,0,.9,.5)'),
      F(.62, { x: v.ux * D * 1.0, y: v.uy * D, sx: sq.sx, sy: sq.sy }), F(.8, { x: -v.ux * D * .06, y: 0, r: -2 * sgn(v.ux), sx: 1.03, sy: .98 }, 'ease-in-out'), F(1)] };
  },
  peck(s, v, M) { // quick double jab
    const D = Math.min(v.d, M.U * 1.5) * 0.5 * s.P.reach, T = 400;
    return { T, hit: 0.38, frames: [F(0), F(.14, { x: -v.ux * D * .15, y: -M.H * .02, r: -6 * sgn(v.ux), sx: .98, sy: 1.05 }, 'ease-out'), F(.3, { x: v.ux * D, y: v.uy * D, r: 12 * sgn(v.ux), sx: 1.06, sy: .95 }, 'cubic-bezier(.2,.8,.3,1)'),
      F(.42, { x: v.ux * D * .3, y: v.uy * D * .3, r: -2 * sgn(v.ux) }, 'ease-in-out'), F(.58, { x: v.ux * D * .95, y: v.uy * D * .95, r: 13 * sgn(v.ux), sx: 1.07, sy: .94 }, 'cubic-bezier(.2,.8,.3,1)'), F(.75, { x: v.ux * D * .1, y: 0, r: 0 }, 'ease-in-out'), F(1)], second: .58 };
  },
  lash(s, v, M) { // serpent: coil back, snap forward with a long stretch, slide back
    const D = Math.min(v.d, M.U * 1.6) * 0.62 * s.P.reach, T = 520;
    ghost(s, 260, T * 0.3);
    return { T, hit: 0.46, frames: [F(0), F(.3, { x: -v.ux * D * .14, k: -10 * sgn(v.ux), sx: .9, sy: 1.1 }, 'ease-out'), F(.46, { x: v.ux * D, y: v.uy * D, k: 12 * sgn(v.ux), r: 6 * sgn(v.ux), sx: 1.28, sy: .9 }, 'cubic-bezier(.1,.9,.3,1)'),
      F(.58, { x: v.ux * D * .9, y: v.uy * D * .9, k: 6 * sgn(v.ux), sx: 1.16, sy: .94 }), F(.82, { x: 0, k: -4 * sgn(v.ux), sx: .98, sy: 1.03 }, 'ease-in-out'), F(1)] };
  },
  dive(s, v, M) { // fliers: rise, swoop on a diagonal, pull up
    const D = Math.min(v.d, M.U * 1.6) * 0.66 * s.P.reach, up = M.H * 0.3, T = 560;
    ghost(s, 300, T * 0.4);
    shadowFor([[0, 0], [.3, -up], [.55, -2], [1, 0]], T, s);
    return { T, hit: 0.55, frames: [F(0), F(.3, { x: -v.ux * D * .25, y: -up, r: -16 * sgn(v.ux) * s.P.tilt, sx: .94, sy: 1.08 }, 'ease-out'), F(.55, { x: v.ux * D, y: v.uy * D, r: 22 * sgn(v.ux) * s.P.tilt, sx: 1.12, sy: .92 }, 'cubic-bezier(.5,0,.9,.6)'),
      F(.68, { x: v.ux * D * .9, y: v.uy * D * .9 - M.H * .05, r: 10 * sgn(v.ux) }), F(.88, { x: 0, y: -M.H * .1, r: -4 * sgn(v.ux) }, 'ease-in-out'), F(1)] };
  },
  bump(s, v, M) { // floaters/sprouts: squeeze, pop forward, bounce
    const D = Math.min(v.d, M.U * 1.5) * 0.5 * s.P.reach, T = 420;
    return { T, hit: 0.5, frames: [F(0), F(.28, { x: -v.ux * D * .15, y: -M.H * .04, sx: 1.12, sy: .88 }, 'ease-out'), F(.5, { x: v.ux * D, y: v.uy * D, r: 8 * sgn(v.ux), sx: .92, sy: 1.1 }, 'cubic-bezier(.2,.8,.3,1)'), F(.6, { x: v.ux * D * .85, y: v.uy * D * .85, sx: 1.14, sy: .88 }), F(.82, { x: v.ux * D * -.05, sx: .97, sy: 1.04 }, 'ease-in-out'), F(1)] };
  },
};
GA.strike = safe(function (a, t, o) {
  const s = st.get(a) || attach(a); if (!s || s.dead) return 0;
  o = o || {};
  const M = sizes(a, s), v = vec(a, t, dirOf(a));
  const style = o.style || s.P.melee, spec = (MELEE[style] || MELEE.lunge)(s, v, M);
  const frames = spec.frames; if (o.el) frames.forEach(f => { if (f.offset > .2 && f.offset < .7) f.filter = glow(o.el, 6); });
  run(s, frames, spec.T);
  return dur(spec.T * spec.hit);
});

// ---------------------------------------------------------------- ranged / cast
// element flavour for the body motion while casting/shooting (adds extra keyframe detail on top of the style)
function elementMod(el, frames, M) {
  const fx = {
    volt: () => frames.forEach((f, i) => { if (f.offset > .35 && f.offset < .7) f.transform = f.transform.replace(/translate\(([-\d.]+)px/, (m, x) => `translate(${(+x + (i % 2 ? 2.5 : -2.5)).toFixed(1)}px`); }),
    shade: () => frames.forEach(f => { if (f.offset > .3 && f.offset < .75) f.opacity = .55; }),
    mystic: () => frames.forEach(f => { if (f.offset > .3 && f.offset < .75) f.transform = f.transform.replace(/translate\(([-\d.]+)px,([-\d.]+)px/, (m, x, y) => `translate(${x}px,${(+y - M.H * .1).toFixed(1)}px`); }),
    gale: () => frames.forEach(f => { if (f.offset > .35 && f.offset < .7) f.transform = f.transform.replace(/rotate\(([-\d.]+)deg/, (m, r) => `rotate(${(+r + 160).toFixed(1)}deg`); }),
    frost: () => frames.forEach((f, i) => { if (f.offset > .15 && f.offset < .45) f.transform = f.transform.replace(/rotate\(([-\d.]+)deg/, (m, r) => `rotate(${(+r + (i % 2 ? 3 : -3)).toFixed(1)}deg`); }),
  }[el];
  if (fx) fx();
  return frames;
}
const RANGED = {
  spit(s, d, M) { // lean back, snap forward and recoil
    const T = 400;
    return { T, hit: .45, frames: [F(0), F(.32, { x: -d * M.U * .07, r: -9 * d * s.P.tilt, sx: .96, sy: 1.08 }, 'ease-out'), F(.5, { x: d * M.U * .06, r: 7 * d, sx: 1.12, sy: .9 }, 'cubic-bezier(.2,.8,.3,1)'), F(.7, { x: -d * M.U * .03, r: -2 * d, sx: 1.02, sy: 1.01 }, 'ease-in-out'), F(1)] };
  },
  rear(s, d, M) { // rise tall, throw forward
    const T = 480;
    return { T, hit: .5, frames: [F(0), F(.4, { x: -d * M.U * .04, y: -M.H * .05, r: -11 * d * s.P.tilt, sx: .92, sy: 1.16 }, 'ease-out'), F(.54, { x: d * M.U * .07, y: 0, r: 8 * d, sx: 1.12, sy: .9 }, 'cubic-bezier(.2,.8,.3,1)'), F(.75, { r: -2 * d, sx: 1.02 }, 'ease-in-out'), F(1)] };
  },
  pulse(s, d, M) { // swell, squeeze out
    const T = 420;
    return { T, hit: .5, frames: [F(0), F(.38, { y: -M.H * .05, sx: 1.14, sy: 1.12 }, 'ease-out'), F(.55, { x: d * M.U * .05, y: -M.H * .02, sx: .9, sy: .92 }, 'cubic-bezier(.2,.8,.3,1)'), F(.8, { sx: 1.04, sy: 1.03 }, 'ease-in-out'), F(1)] };
  },
};
RANGED.hover = RANGED.pulse;
GA.shoot = safe(function (a, t, o) {
  const s = st.get(a) || attach(a); if (!s || s.dead) return 0;
  o = o || {};
  const M = sizes(a, s), v = vec(a, t, dirOf(a)), d = sgn(v.ux);
  const spec = (RANGED[o.style || s.P.ranged] || RANGED.spit)(s, d, M);
  const fr = elementMod(o.el, spec.frames, M); fr.forEach(f => { if (f.offset > .2 && f.offset < .75) f.filter = glow(o.el, 11); });
  run(s, fr, spec.T);
  return dur(spec.T * spec.hit);
});
GA.cast = safe(function (a, o) {
  const s = st.get(a) || attach(a); if (!s || s.dead) return 0;
  o = o || {}; const M = sizes(a, s), ult = !!o.ult, T = ult ? 760 : 540, g = glow(o.el, ult ? 18 : 12);
  const air = s.P.shadow < 0.5;
  const fr = ult
    ? [F(0), F(.2, { y: M.H * .03, sx: 1.14, sy: .82 }, 'ease-out'), F(.5, { y: -M.H * .26, sx: .96, sy: 1.18, f: g }, 'ease-in-out'), F(.62, { y: -M.H * .26, r: 8, sx: 1.06, sy: 1.1, f: g }), F(.76, { y: -M.H * .26, r: -8, sx: 1.06, sy: 1.1, f: g }), F(.88, { y: M.H * .02, sx: 1.1, sy: .9, f: g }, 'ease-in'), F(1)]
    : [F(0), F(.25, { y: M.H * .02, sx: 1.1, sy: .88 }, 'ease-out'), F(.55, { y: -M.H * (air ? .1 : .16), sx: .96, sy: 1.12, f: g }, 'ease-in-out'), F(.8, { y: M.H * .01, sx: 1.07, sy: .93, f: g }), F(1)];
  elementMod(o.el, fr, M);
  shadowFor([[0, 0], [.5, -M.H * .22], [1, 0]], T, s);
  run(s, fr, T);
  return dur(T * .5);
});

// ---------------------------------------------------------------- hit / faint / walk
GA.hit = safe(function (t, o) {
  const s = st.get(t) || attach(t); if (!s || (s.dead && !o.force)) return 0;
  o = o || {};
  const go = () => {
    if (!t.isConnected || s.dead) return;
    const M = sizes(t, s), crit = !!o.crit, dot = o.dot, v = o.from ? vec(o.from, t, -dirOf(t)) : { ux: -dirOf(t), uy: 0 };
    const k = (crit ? 0.3 : 0.16) / Math.sqrt(s.P.mass), X = v.ux * M.U * k, Y = v.uy * M.U * k * .6;
    const flash = dot === 'burn' ? 'brightness(1.5) sepia(1) saturate(5) hue-rotate(-25deg)' : dot === 'poison' ? 'brightness(1.3) sepia(1) saturate(4) hue-rotate(230deg)'
      : dot ? 'brightness(1.6)' : `brightness(${crit ? 3.4 : 2.6}) saturate(0)`;
    if (dot) { run(s, [F(0), F(.3, { sx: 1.05, sy: .94, f: flash }), F(1)], 320); return; }
    const sx = 1 - .1 * Math.abs(v.ux) + .08 * Math.abs(v.uy), sy = 1 + .08 * Math.abs(v.ux);
    run(s, [F(0), F(.12, { x: X, y: Y, r: (crit ? 15 : 8) * v.ux * s.P.tilt, sx: sx * .94, sy: sy, f: flash }, 'ease-out'), F(.3, { x: X * 1.05, y: Y, r: (crit ? 15 : 8) * v.ux, sx, sy, f: crit ? flash : 'none' }, 'ease-out'),
      F(.55, { x: X * -.25, y: 0, r: -3 * v.ux, sx: 1.05, sy: .95 }, 'ease-in-out'), F(.75, { x: X * .06, sx: .99, sy: 1.01 }), F(1)], crit ? 520 : 380);
    if (crit) shake(s);
  };
  if (o.delay) setTimeout(go, dur(o.delay)); else go();
  return 0;
});
function shake(s) { // a quick wobble on the body layer only (cheap) after a crit
  try { s.amove.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(3px)' }, { transform: 'translateX(-2px)' }, { transform: 'none' }], { duration: dur(240) }); } catch (e) {}
}
GA.faint = safe(function (t, o) {
  const s = st.get(t) || attach(t); if (!s || s.dead) return 0;
  o = o || {}; const M = sizes(t, s), v = o.from ? vec(o.from, t, -dirOf(t)) : { ux: -dirOf(t), uy: 0 }, d = sgn(v.ux), gray = 'grayscale(1) brightness(.6)';
  const fl = 'brightness(2.4) saturate(0)';
  let fr, T = 640;
  switch (s.P.faint) {
    case 'collapse': fr = [F(0), F(.12, { x: d * 4, sx: .94, sy: 1.06, f: fl }, 'ease-out'), F(.5, { x: d * M.U * .06, y: M.H * .04, sx: 1.18, sy: .55, f: gray }, 'ease-in'), F(.7, { x: d * M.U * .06, y: M.H * .04, sx: 1.28, sy: .38, f: gray, o: 1 }), F(1, { x: d * M.U * .06, y: M.H * .06, sx: 1.34, sy: .3, f: gray, o: .0 }, 'ease-in')]; dust(s, 4, T * .45, M.U * .3); break;
    case 'deflate': fr = [F(0), F(.1, { sx: 1.1, sy: .9, f: fl }, 'ease-out'), F(.35, { y: -M.H * .1, sx: 1.2, sy: 1.2, f: gray }, 'ease-out'), F(.75, { y: M.H * .05, sx: .35, sy: .3, f: gray, o: .9 }, 'ease-in'), F(1, { y: M.H * .08, sx: .1, sy: .1, f: gray, o: 0 })]; break;
    case 'fall': fr = [F(0), F(.1, { r: -10 * d, f: fl }), F(.4, { x: d * M.U * .15, y: -M.H * .08, r: 120 * d, f: gray }, 'ease-out'), F(.8, { x: d * M.U * .3, y: M.H * .12, r: 330 * d, sx: .8, sy: .8, f: gray, o: .8 }, 'ease-in'), F(1, { x: d * M.U * .34, y: M.H * .14, r: 380 * d, sx: .6, sy: .6, f: gray, o: 0 })]; dust(s, 3, T * .75, M.U * .25); break;
    case 'flip': fr = [F(0), F(.1, { f: fl }), F(.35, { x: d * M.U * .1, y: -M.H * .35, r: 170 * d, f: gray }, 'ease-out'), F(.55, { x: d * M.U * .16, y: M.H * .02, r: 180 * d, sx: 1.1, sy: .9, f: gray }, 'ease-in'), F(.62, { x: d * M.U * .16, y: -M.H * .04, r: 180 * d, f: gray }), F(.7, { x: d * M.U * .16, y: M.H * .02, r: 180 * d, f: gray }), F(1, { x: d * M.U * .16, y: M.H * .02, r: 180 * d, f: gray, o: 0 }, 'ease-in')]; dust(s, 3, T * .5, M.U * .25); break;
    case 'roll': fr = [F(0), F(.1, { f: fl }), F(.5, { x: d * M.U * .08, y: -M.H * .1, r: 180 * d, f: gray }, 'ease-out'), F(.75, { x: d * M.U * .1, y: -M.H * .16, r: 180 * d, sx: 1.05, sy: .95, f: gray, o: .9 }), F(1, { x: d * M.U * .1, y: -M.H * .26, r: 180 * d, f: gray, o: 0 })]; break;
    default: fr = [F(0), F(.1, { x: d * M.U * .04, r: -6 * d, sx: .95, sy: 1.06, f: fl }, 'ease-out'), F(.45, { x: d * M.U * .12, y: M.H * .1, r: 60 * d, f: gray }, 'ease-in'), F(.62, { x: d * M.U * .18, y: M.H * .16, r: 82 * d, sx: 1.06, sy: .9, f: gray }), F(.7, { x: d * M.U * .17, y: M.H * .14, r: 78 * d, f: gray }), F(1, { x: d * M.U * .18, y: M.H * .16, r: 82 * d, sx: 1.04, sy: .9, f: gray, o: 0 }, 'ease-in')]; dust(s, 3, T * .6, M.U * .3);
  }
  s.dead = true;
  try { s.idle && s.idle.pause(); s.sidle && s.sidle.pause(); } catch (e) {}
  run(s, fr, T, { fill: 'forwards' }); s.dead = true;
  return dur(T);
});
GA.revive = safe(function (u) {
  const s = st.get(u); if (!s) return 0;
  s.dead = false;
  try { s.act && s.act.cancel(); s.rig.getAnimations().forEach(a => a.cancel()); s.idle && s.idle.play(); s.sidle && s.sidle.play(); } catch (e) {}
  const M = sizes(u, s);
  run(s, [F(0, { y: M.H * .1, sx: .5, sy: .4, o: 0 }), F(.5, { y: -M.H * .15, sx: 1.12, sy: 1.14, o: 1, f: glow('mystic', 12) }, 'ease-out'), F(1)], 520);
  return 520;
});
GA.walk = safe(function (u, o) {
  const s = st.get(u) || attach(u); if (!s || s.dead) return 0;
  o = o || {}; const M = sizes(u, s), ms = o.ms || 420, d = o.dx ? sgn(o.dx) : dirOf(u), P = s.P, style = o.style || P.walk;
  let fr, n = 1;
  const lean = 4 * d * P.tilt;
  switch (style) {
    case 'hop': fr = [F(0), F(.15, { sx: 1.08, sy: .9 }, 'ease-out'), F(.5, { y: -M.H * .22, r: lean, sx: .95, sy: 1.08 }, 'ease-in-out'), F(.82, { sx: 1.1, sy: .88 }, 'ease-in'), F(1)]; dust(s, 1, ms * .8); shadowFor([[0, 0], [.5, -M.H * .22], [1, 0]], ms, s); break;
    case 'bound': fr = [F(0, { r: lean * .6 }), F(.25, { y: -M.H * .1, r: lean, sx: 1.04, sy: .97 }, 'ease-out'), F(.5, { sx: 1.05, sy: .94, r: lean * .6 }), F(.75, { y: -M.H * .1, r: lean, sx: 1.04, sy: .97 }, 'ease-out'), F(1, { r: 0 })]; shadowFor([[0, 0], [.25, -10], [.5, 0], [.75, -10], [1, 0]], ms, s); break;
    case 'waddle': fr = [F(0), F(.25, { r: 7, y: -M.H * .04, sx: 1.02, sy: .98 }), F(.5, { r: 0, sx: 1.04, sy: .94 }), F(.75, { r: -7, y: -M.H * .04 }), F(1)]; break;
    case 'stomp': fr = [F(0), F(.2, { y: -M.H * .07, r: lean * .5, sx: .98, sy: 1.05 }, 'ease-out'), F(.38, { y: 0, sx: 1.1, sy: .9 }, 'ease-in'), F(.6, { y: -M.H * .07, r: -lean * .3, sx: .98, sy: 1.04 }, 'ease-out'), F(.8, { y: 0, sx: 1.1, sy: .9 }, 'ease-in'), F(1)]; dust(s, 2, ms * .38, M.U * .3); dust(s, 2, ms * .8, M.U * .3); break;
    case 'glide': fr = [F(0), F(.3, { r: lean * 1.4, y: -M.H * .05, sx: 1.03, sy: .98 }), F(.75, { r: lean * 1.2, y: -M.H * .03 }), F(1)]; break;
    case 'slither': fr = [F(0), F(.2, { k: 12, sx: 1.08, sy: .97 }), F(.4, { k: -12, sx: 1.04 }), F(.6, { k: 12, sx: 1.08 }), F(.8, { k: -10, sx: 1.04 }), F(1)]; break;
    case 'skitter': fr = [F(0), F(.12, { y: -M.H * .05, r: lean }), F(.25, { y: 0 }), F(.37, { y: -M.H * .05, r: -lean }), F(.5, { y: 0 }), F(.62, { y: -M.H * .05, r: lean }), F(.75, { y: 0 }), F(.87, { y: -M.H * .05, r: -lean }), F(1)]; break;
    case 'fly': fr = [F(0), F(.3, { y: -M.H * .13, r: lean * 2, sx: .97, sy: 1.04 }), F(.7, { y: -M.H * .09, r: lean * 2 }), F(1)]; shadowFor([[0, 0], [.4, -M.H * .13], [1, 0]], ms, s); break;
    case 'wiggle': fr = [F(0), F(.2, { r: 6, k: 4 }), F(.4, { r: -6, k: -4 }), F(.6, { r: 6, k: 4 }), F(.8, { r: -4, k: -3 }), F(1)]; break;
    default: fr = [F(0), F(.5, { y: -M.H * .1 }), F(1)];
  }
  s.amove.getAnimations().forEach(a => a.cancel());
  s.amove.animate(fr, { duration: dur(ms), easing: 'ease-in-out' });
  return 0;
});
GA.cheer = safe(function (u) {
  const s = st.get(u) || attach(u); if (!s || s.dead) return 0;
  const M = sizes(u, s), j = -M.H * .26;
  run(s, [F(0), F(.1, { sx: 1.1, sy: .86 }), F(.28, { y: j, sx: .94, sy: 1.1 }, 'ease-out'), F(.46, { sx: 1.08, sy: .9 }, 'ease-in'), F(.6, { y: j * .7, sx: .96, sy: 1.08 }, 'ease-out'), F(.8, { sx: 1.08, sy: .9 }, 'ease-in'), F(1)], 900);
  shadowFor([[0, 0], [.28, j], [.46, 0], [.6, j * .7], [.8, 0], [1, 0]], 900, s);
  return 900;
});
// pause/resume all idle loops (e.g. when the tab is hidden or the planning screen is open)
GA.pauseIdle = function (on) { document.querySelectorAll('.unit.ga').forEach(u => { const s = st.get(u); if (s && s.idle && !s.dead) try { on ? s.idle.pause() : s.idle.play(); } catch (e) {} }); };
if (HAS && typeof document !== 'undefined') document.addEventListener('visibilitychange', () => GA.pauseIdle(document.hidden));

// CSS the module needs (injected once, so the patch is JS-only). Disables the game's CSS idle on attached units.
if (typeof document !== 'undefined') {
  const css = document.createElement('style');
  css.textContent = '.unit.ga .spr{animation:none!important}.unit .amove,.unit .abody{transform-origin:50% 100%;will-change:transform}.unit .amove,.unit .abody{display:block;width:100%}';
  document.head.appendChild(css);
}
root.GlimAnim = GA;
if (typeof module !== 'undefined') module.exports = GA;
})(typeof window !== 'undefined' ? window : globalThis);
