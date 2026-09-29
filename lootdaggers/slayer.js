/* Reel Slayer (prototype). A semi-real-time side-scroller where the slot
   machine is the only control. Tap the reels to pull; tap each reel to stop
   it. The order you stop them is the order your hero acts. While you plan,
   the world is frozen and every foe shows how long until it strikes; then
   the combo plays out in real time and the foes move and strike with it.
   Loaded on demand by index.html (openSlayer). Uses the page's globals:
   S, save, artImg, canvasH, HEROES, SYM, sfx, music, showHub, alt, hskinFor. */
(function () {
'use strict';

/* ---------- moves ---------- */
// t: seconds the move takes. Damage is scaled by level and Frenzy at use.
const MOVES = {
  sword:  { n: 'Slash',   t: 0.65, pose: 'attack' },
  boots:  { n: 'Leap',    t: 0.95, pose: 'attack' },
  shield: { n: 'Parry',   t: 0.6,  pose: 'idle' },
  bow:    { n: 'Shot',    t: 0.6,  pose: 'attack' },
  bomb:   { n: 'Blast',   t: 0.85, pose: 'attack' },
  potion: { n: 'Heal',    t: 0.7,  pose: 'idle' },
  coin:   { n: 'Coins',   t: 0.45, pose: 'idle' },
  skull:  { n: 'Cursed',  t: 0.8,  pose: 'attack' },
  key:    { n: 'Backstep',t: 0.45, pose: 'walk' },
};
const MOVE_KEYS = Object.keys(MOVES);
/* Three of a kind: the whole combo becomes that symbol's signature move (double damage, wider reach). */
const ULTS = {
  sword: 'BLADE STORM', bomb: 'METEOR FALL', bow: 'ARROW RAIN', skull: 'SOUL REAP', boots: 'SKYFALL',
  shield: 'IRON WALL', potion: 'BLOOD MOON', coin: 'JACKPOT', key: 'PHANTOM STEP',
};
const CRIT = 0.12;
// The hero walks up to the nearest foe on his own and stops at ENGAGE to plan; he walks
// again after a combo only if every foe ended up past ENGAGE + SLACK (knocked back, backstep).
const ENGAGE = 95, SLACK = 70, ADVANCE_SPD = 150;
const LEAP_HIT = 0.45;          // the boots leap lands (and hits) this far into the move

/* ---------- foes ---------- */
// range in world units; wind: seconds of telegraph; cd: rest after a strike
const FOES = {
  rat:    { hp: 6,  dmg: 2, spd: 70, range: 55,  wind: 0.8, cd: 0.9 },
  skel:   { hp: 11, dmg: 3, spd: 50, range: 60,  wind: 1.0, cd: 1.1 },
  slime:  { hp: 15, dmg: 2, spd: 35, range: 55,  wind: 1.2, cd: 1.2 },
  archer: { hp: 8,  dmg: 3, spd: 40, range: 300, wind: 1.1, cd: 1.4, shoot: true },
  wraith: { hp: 12, dmg: 3, spd: 55, range: 120, wind: 1.0, cd: 1.2, shoot: true },
  orc:    { hp: 24, dmg: 6, spd: 40, range: 70,  wind: 1.5, cd: 1.5 },
  mirror: { hp: 16, dmg: 4, spd: 45, range: 60,  wind: 1.1, cd: 1.2 },
  ironclad:{hp: 30, dmg: 5, spd: 30, range: 70,  wind: 1.6, cd: 1.6 },
};
const BOSSES = [
  { t: 'boneking', hp: 70,  dmg: 7, spd: 35, range: 80,  wind: 1.4, cd: 1.3, boss: true, n: 'The Bone King' },
  { t: 'lich',     hp: 90,  dmg: 6, spd: 30, range: 320, wind: 1.2, cd: 1.3, boss: true, shoot: true, n: 'The Dice Lich' },
  { t: 'bandit',   hp: 120, dmg: 8, spd: 35, range: 85,  wind: 1.3, cd: 1.2, boss: true, n: 'One-Armed Bandit' },
];
function wavePool(w) {
  const p = ['rat', 'skel', 'slime'];
  if (w >= 2) p.push('archer');
  if (w >= 3) p.push('wraith', 'skel');
  if (w >= 4) p.push('orc', 'mirror');
  if (w >= 7) p.push('ironclad', 'orc');
  return p;
}

/* ---------- state ---------- */
let st = null, cv = null, cx = null, root = null, raf = 0, last = 0;
let cv3 = null, S3 = null, s3tried = false, frameDt = 0.016;
const U3 = 0.0155;   // slayer3d.js meters per world unit
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function heroStrip(h) {
  const c = Object.assign({}, HEROES[h].strip);
  if (S.mods && S.mods.wild) c.star = (c.star || 0) + 1;
  const out = [];
  for (const k in c) for (let i = 0; i < c[k]; i++) out.push(k);
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
function reelCountFor() { return 3 + (S.mods && S.mods.reel4 ? 1 : 0) + (S.mods && S.mods.reel5 ? 1 : 0); }

function newRun(hero) {
  const h = HEROES[hero];
  const maxHp = h.hp + (alt('vit') || 0) * 5;
  st = {
    mode: 'plan', hero, maxHp, hp: maxHp, coins: h.coins, wave: 0, kills: 0,
    x: 0, face: 1, cam: -200, foes: [], shots: [], fx: [], fl: [],
    reels: [], order: [], combo: [], queue: [], cur: null, frenzy: false,
    hurtT: 0, invT: 0, parryT: 0, parryPerfect: 0, flash: 0, shake: 0, over: false,
    edge: alt('edge') || 0, banner: null, walkT: 0, spun: 0,
    ev: [], stopT: 0, slowT: 0, hits: 0, hitsT: 0, ult: null, hy: 0,
  };
  const n = reelCountFor();
  for (let i = 0; i < n; i++) st.reels.push({ strip: heroStrip(hero), pos: rnd(0, 20), v: 0, stop: null, done: true, res: null });
  nextWave();
  st.mode = 'advance';
}
/* Distance to the nearest live foe (Infinity when none). */
function gap() { const nf = nearest(); return nf ? Math.abs(nf.x - st.x) : Infinity; }

function nextWave() {
  st.wave++;
  const w = st.wave;
  const lvl = 1 + 0.18 * (w - 1);
  if (w % 5 === 0) {
    const B = BOSSES[Math.min(BOSSES.length - 1, Math.floor(w / 5) - 1)];
    spawn(Object.assign({}, B), st.x + 420, lvl);
    st.banner = { t: 0, txt: B.n.toUpperCase() };
    if (w >= 10) spawn(Object.assign({ t: 'skel' }, FOES.skel), st.x + 560, lvl);
  } else {
    const n = Math.min(6, 2 + Math.floor(w / 2));
    const pool = wavePool(w);
    for (let i = 0; i < n; i++) { const t = pick(pool); spawn(Object.assign({ t }, FOES[t]), st.x + 330 + i * rnd(80, 130), lvl); }
    st.banner = { t: 0, txt: 'WAVE ' + w };
  }
}
function spawn(def, x, lvl) {
  const hp = Math.round(def.hp * lvl);
  st.foes.push(Object.assign({}, def, {
    x, hp, max: hp, dmg: Math.round(def.dmg + Math.floor((st.wave - 1) / 3)),
    state: 'walk', wT: 0, cdT: rnd(0.2, 0.8), flash: 0, stun: 0, dead: false, deadT: 0, lunge: 0,
  }));
}

/* ---------- geometry ---------- */
function layout() {
  const W = cv.clientWidth, H = cv.clientHeight;
  const reelTop = Math.round(H * 0.68);
  const ground = Math.round(H * 0.6);
  const k = Math.max(0.6, Math.min(ground * 0.27 / 118, W / 400));
  return { W, H, reelTop, ground, k, viewW: W / k };
}
function reelRects(L) {
  const n = st.reels.length, pad = 12, gap = 8;
  const w = Math.min(120, (Math.min(L.W, 620) - pad * 2 - gap * (n - 1)) / n);
  const h = Math.min(L.H - L.reelTop - 70, w * 1.25);
  const total = n * w + (n - 1) * gap, x0 = (L.W - total) / 2, y = L.reelTop + 34;
  return st.reels.map((R, i) => ({ x: x0 + i * (w + gap), y, w, h }));
}

/* ---------- reels ---------- */
function spin() {
  if (st.mode !== 'plan' || st.over) return;
  if (st.coins < 1) { endRun('broke'); return; }
  st.coins--; st.spun++;
  st.order = []; st.combo = []; st.frenzy = false;
  for (const R of st.reels) { R.v = rnd(14, 19); R.stop = null; R.done = false; R.res = null; }
  st.mode = 'spin';
  try { sfx.spin(); } catch (e) { /* audio is optional */ }
}
function stopReel(i) {
  const R = st.reels[i];
  if (!R || R.done || R.stop != null) return;
  R.stop = Math.ceil(R.pos) + 2;           // decelerate onto a whole symbol
  st.order.push(i);
  try { sfx.stop(); } catch (e) { /* ignore */ }
}
function reelSym(R, off) { const n = R.strip.length; return R.strip[((Math.round(R.pos) + off) % n + n) % n]; }
function updateReels(dt) {
  for (const R of st.reels) {
    if (R.done) continue;
    if (R.stop == null) { R.pos += R.v * dt; continue; }
    const left = R.stop - R.pos;
    const v = Math.max(2.2, Math.min(R.v, left * 6));
    R.pos += v * dt;
    if (R.pos >= R.stop) { R.pos = R.stop; R.done = true; R.res = reelSym(R, 0); }
  }
  if (st.mode === 'spin' && st.reels.every(R => R.done)) buildCombo();
}
function buildCombo() {
  const syms = st.order.map(i => st.reels[i].res);
  const combo = [];
  for (let i = 0; i < syms.length; i++) {
    let s = syms[i];
    if (s === 'star') s = combo.length ? combo[combo.length - 1] : (syms.find(x => x !== 'star' && MOVES[x]) || 'sword');
    if (!MOVES[s]) s = 'sword';
    combo.push(s);
  }
  const res = st.reels.map(R => R.res);
  const first = res.find(s => s !== 'star');
  st.frenzy = !!first && res.every(s => s === first || s === 'star');
  st.ult = st.frenzy ? (MOVES[first] ? first : 'sword') : null;
  st.hits = 0;
  st.combo = combo;
  st.queue = combo.slice();
  st.mode = 'act';
  st.actT = 0;
  if (st.frenzy) {
    st.banner = { t: 0, txt: ULTS[st.ult] || 'FRENZY ×2', ult: true };
    st.ev.push({ k: 'ult', sym: st.ult, name: ULTS[st.ult] });
    st.slowT = 0.45;                       // the world drops into slow motion as the ultimate starts
    if (st.ult === 'shield') st.invT = 9;  // IRON WALL: nothing gets through this combo
    try { sfx.jackpot(); } catch (e) { /* ignore */ }
  }
  nextMove();
}

/* ---------- hero moves ---------- */
function power(base) { return Math.round((base + st.edge + Math.floor((st.wave - 1) / 4)) * (st.frenzy ? 2 : 1)); }
function liveFoes() { return st.foes.filter(f => !f.dead); }
function nearest() {
  let best = null;
  for (const f of liveFoes()) if (!best || Math.abs(f.x - st.x) < Math.abs(best.x - st.x)) best = f;
  return best;
}
function nextMove() {
  const m = st.queue.shift();
  if (!m) { st.cur = null; endAct(); return; }
  const nf = nearest();
  if (nf && m !== 'key') st.face = nf.x >= st.x ? 1 : -1;
  st.cur = { m, t: 0, dur: MOVES[m].t, hit: false, from: st.x };
  if (m === 'boots') {
    // leap onto the nearest foe (or a short hop forward), landing just in front of it
    st.invT = MOVES.boots.t + 0.05;
    st.cur.to = nf ? nf.x - st.face * 55 : st.x + st.face * 80;
    if (Math.abs(st.cur.to - st.x) < 20) st.cur.to = st.x;
  }
  if (m === 'key') st.invT = 0.25;
  if (m === 'shield') { st.parryT = MOVES.shield.t; st.parryPerfect = 0.3; }
}
function doMove(dt) {
  const c = st.cur;
  if (!c) return;
  c.t += dt;
  const p = c.t / c.dur;
  const m = c.m;
  if (m === 'sword') {
    const nf = nearest();
    if (!c.hit && nf && p < 0.3) {          // lunge in if the foe is just out of reach
      const gap = Math.abs(nf.x - st.x) - 60;
      if (gap > 0 && gap < 150) st.x += Math.sign(nf.x - st.x) * Math.min(gap, 520 * dt);
    }
    if (!c.hit && p >= 0.3) {
      c.hit = true;
      let n = 0;
      for (const f of liveFoes()) {
        const dx = (f.x - st.x) * st.face;
        if (dx > (st.ult === 'sword' ? -150 : -10) && dx < (st.ult === 'sword' ? 170 : 85)) { hitFoe(f, power(5), 'sword'); n++; }
      }
      addFx('slash', st.x + st.face * 45, 0.25);
      try { n ? sfx.hit() : sfx.step(); } catch (e) { /* ignore */ }
    }
  } else if (m === 'boots') {
    // an arc up and onto the foe, a slam on landing, then the hero holds there
    const k = Math.min(1, p / LEAP_HIT);
    st.x = c.from + (c.to - c.from) * (1 - Math.pow(1 - k, 2));
    st.hy = p < LEAP_HIT ? Math.sin(Math.PI * k) * 90 : 0;
    if (!c.hit && p >= LEAP_HIT) {
      c.hit = true;
      const reach = st.ult === 'boots' ? 170 : 80;
      const nf = nearest();
      for (const f of liveFoes()) {
        if (Math.abs(f.x - st.x) > reach + 40) continue;
        hitFoe(f, power(f === nf || st.ult === 'boots' ? (st.ult === 'boots' ? 7 : 5) : 2), 'leap');
      }
      st.ev.push({ k: 'land', x: st.x + st.face * 30, big: st.ult === 'boots' });
      addFx('boom', st.x + st.face * 30, 0.35);
      st.shake = Math.max(st.shake, 12);
      try { sfx.boom(); } catch (e) { /* ignore */ }
    }
  } else if (m === 'key') {
    st.x -= st.face * 120 * dt / c.dur;
  } else if (m === 'bow' && !c.hit && p >= 0.4) {
    c.hit = true;
    if (st.ult === 'bow') { for (const f of liveFoes()) if (Math.abs(f.x - st.x) < 420) hitFoe(f, power(4), 'bow'); }   // ARROW RAIN: every foe in sight
    else st.shots.push({ x: st.x + st.face * 30, y: 70, v: st.face * 620, dmg: power(4), mine: true, life: 1.2 });
    try { sfx.arrow(); } catch (e) { /* ignore */ }
  } else if (m === 'bomb' && !c.hit && p >= 0.45) {
    c.hit = true;
    for (const f of liveFoes()) if (Math.abs(f.x - st.x) < (st.ult === 'bomb' ? 260 : 110)) hitFoe(f, power(7), 'bomb');
    addFx('boom', st.x + st.face * 20, 0.5);
    st.shake = 10;
    try { sfx.boom(); } catch (e) { /* ignore */ }
  } else if (m === 'skull' && !c.hit && p >= 0.4) {
    c.hit = true;
    for (const f of liveFoes()) if (Math.abs(f.x - st.x) < (st.ult === 'skull' ? 280 : 140)) hitFoe(f, power(10), 'skull');
    hurtHero(3, true);
    addFx('curse', st.x, 0.6);
    st.shake = 12;
  } else if (m === 'potion' && !c.hit && p >= 0.5) {
    c.hit = true;
    const h = Math.min(st.maxHp - st.hp, 6 + Math.floor(st.wave / 3));
    st.hp += h; floater('+' + h, '#8cff96', st.x, 150);
    try { sfx.heal(); } catch (e) { /* ignore */ }
  } else if (m === 'coin' && !c.hit && p >= 0.5) {
    c.hit = true;
    const g = st.frenzy ? 3 : 1;
    st.coins += g; floater('+' + g + ' 🪙', '#e8c77a', st.x, 150);
    try { sfx.coin(); } catch (e) { /* ignore */ }
  }
  if (c.t >= c.dur) nextMove();
}
function hitFoe(f, dmg, how) {
  if (f.dead) return;
  if (f.t === 'ironclad' && how === 'sword' && !st.frenzy) dmg = Math.ceil(dmg / 3);
  const crit = (how === 'sword' || how === 'bow' || how === 'leap') && Math.random() < CRIT;
  if (crit) dmg = Math.round(dmg * 1.5);
  const heavy = crit || st.frenzy || how === 'bomb' || how === 'skull' || how === 'parry' || how === 'leap';
  // knockback away from the hero; heavy blows launch
  const dir = Math.sign(f.x - st.x) || st.face;
  f.kv = dir * (f.boss ? 90 : heavy ? 300 : 140);
  if (heavy && !f.boss) f.air = Math.max(f.air || 0, 0.55);
  st.stopT = Math.max(st.stopT, heavy ? 0.1 : 0.055);      // hit-stop: the world holds on the impact
  st.shake = Math.max(st.shake, heavy ? 10 : 5);
  st.hits++; st.hitsT = 1.4;
  st.ev.push({ k: 'hit', f, dmg, how, crit, heavy, x: f.x });
  if (crit) floater('CRIT!', '#ffd27a', f.x, 205);
  f.hp -= dmg; f.flash = 1; f.stun = Math.max(f.stun, how === 'bomb' || how === 'skull' ? 0.5 : 0.2);
  if (f.state === 'wind' && (how === 'bomb' || how === 'skull' || how === 'parry')) { f.state = 'walk'; f.cdT = f.cd; floater('INTERRUPT', '#9fd6ff', f.x, 175); }
  floater((crit ? '' : '-') + dmg + (crit ? '!' : ''), crit ? '#ffd27a' : how === 'parry' ? '#9fd6ff' : '#fff', f.x, 150);
  if (f.hp <= 0) {
    f.dead = true; f.deadT = 0; st.kills++;
    f.air = Math.max(f.air || 0, 0.7); f.kv = dir * (f.boss ? 160 : 380);
    st.ev.push({ k: 'kill', f, boss: !!f.boss, x: f.x });
    if (f.boss || !liveFoes().length) st.slowT = Math.max(st.slowT, 0.9);   // last foe or a boss: slow-motion finish
    st.stopT = Math.max(st.stopT, 0.12);
    const g = f.boss ? 8 : (Math.random() < 0.6 ? 1 : 0);
    if (g) {
    st.coins += g; floater('+' + g + ' 🪙', '#e8c77a', f.x, 190); }
    try { sfx.kill ? sfx.kill() : sfx.hit(); } catch (e) { /* ignore */ }
  }
}
function hurtHero(dmg, self) {
  if (st.over) return;
  st.hp -= dmg; st.hurtT = 0.35; st.flash = 0.6; st.shake = Math.max(st.shake, 6);
  floater('-' + dmg, self ? '#b07cf0' : '#e0605a', st.x, 160);
  try { sfx.hurt(); } catch (e) { /* ignore */ }
  if (st.hp <= 0) { st.hp = 0; endRun('slain'); }
}
function strikeHero(f, dmg) {
  if (st.invT > 0) { floater('dodged', '#9fd6ff', st.x, 170); return; }
  if (st.parryT > 0) {
    const perfect = st.parryPerfect > 0;
    floater(perfect ? 'PERFECT PARRY' : 'blocked', '#9fd6ff', st.x, 180);
    addFx('parry', st.x + st.face * 20, 0.3);
    try { sfx.block(); } catch (e) { /* ignore */ }
    if (f && perfect) { st.ev.push({ k: 'parry' }); hitFoe(f, power(6), 'parry'); }
    else if (!perfect) hurtHero(Math.floor(dmg / 3), false);
    return;
  }
  hurtHero(dmg, false);
}
function endAct() {
  st.mode = 'plan';
  st.parryT = 0; st.invT = 0; st.ult = null; st.hy = 0;
  if (!liveFoes().length && !st.over) { st.mode = 'walk'; st.walkT = 1.1; st.coins += 3; floater('WAVE CLEAR +3 🪙', '#e8c77a', st.x, 200); }
  else if (st.coins < 1 && !st.over) endRun('broke');
  else if (!st.over && gap() > ENGAGE + SLACK) st.mode = 'advance';
}

/* ---------- foes (only move while the combo plays) ---------- */
function updateFoes(dt) {
  for (const f of st.foes) {
    if (f.dead) { f.deadT += dt; if (f.kv) { f.x += f.kv * dt; f.kv *= Math.pow(0.01, dt); } if (f.air) f.air = Math.max(0, f.air - dt); continue; }
    f.flash = Math.max(0, f.flash - dt * 4);
    if (f.kv) { f.x += f.kv * dt; f.kv *= Math.pow(0.004, dt); if (Math.abs(f.kv) < 4) f.kv = 0; }
    if (f.air) f.air = Math.max(0, f.air - dt);
    f.lunge = Math.max(0, f.lunge - dt * 3);
    if (f.stun > 0) { f.stun -= dt; continue; }
    const d = st.x - f.x, dist = Math.abs(d);
    if (f.state === 'wind') {
      f.wT -= dt;
      if (f.wT <= 0) {
        f.state = 'walk'; f.cdT = f.cd; f.lunge = 1;
        if (f.shoot) st.shots.push({ x: f.x - Math.sign(f.x - st.x) * 20, y: 85, v: Math.sign(d) * 380, dmg: f.dmg, from: f, life: 2 });
        else if (dist <= f.range + 25) strikeHero(f, f.dmg);
        else floater('miss', '#948978', f.x, 150);
      }
      continue;
    }
    f.cdT -= dt;
    if (dist > f.range) {
      const others = st.foes.filter(o => o !== f && !o.dead && Math.sign(st.x - o.x) === Math.sign(d) && Math.abs(st.x - o.x) < dist && dist - Math.abs(st.x - o.x) < 45);
      if (!others.length) f.x += Math.sign(d) * f.spd * dt;
    } else if (f.cdT <= 0) {
      f.state = 'wind'; f.wT = f.wind;
    }
  }
  st.foes = st.foes.filter(f => !f.dead || f.deadT < 0.8);
  for (const s of st.shots) {
    s.x += s.v * dt; s.life -= dt;
    if (s.mine) {
      for (const f of liveFoes()) if (Math.abs(f.x - s.x) < 22) { hitFoe(f, s.dmg, 'bow'); s.life = 0; break; }
    } else if (Math.abs(s.x - st.x) < 18) { strikeHero(s.from && !s.from.dead ? s.from : null, s.dmg); s.life = 0; }
  }
  st.shots = st.shots.filter(s => s.life > 0);
}
/* Seconds until each foe strikes, as it stands right now (shown while planning). */
function strikeIn(f) {
  if (f.dead) return null;
  const dist = Math.abs(st.x - f.x);
  if (f.state === 'wind') return f.wT + (f.stun > 0 ? f.stun : 0);
  const walk = Math.max(0, dist - f.range) / f.spd;
  return Math.max(walk, f.cdT) + f.wind + (f.stun > 0 ? f.stun : 0);
}

/* ---------- fx ---------- */
function addFx(k, x, dur) { st.fx.push({ k, x, t: 0, dur, face: st.face }); }
function floater(txt, col, x, y) { st.fl.push({ txt, col, x, y, t: 0 }); }

/* ---------- drawing ---------- */
function img(k) { try { return artImg(k); } catch (e) { return null; } }
function sprite(k, fallback, wx, L, flip, alpha, tint) {
  const im = img(k) || (fallback && img(fallback));
  const key = img(k) ? k : fallback;
  const sx = (wx - st.cam) * L.k, sy = L.ground;
  if (!im) {
    cx.font = Math.round(60 * L.k) + 'px serif'; cx.textAlign = 'center';
    cx.fillText('?', sx, sy - 10);
    return;
  }
  let hUnits = 118;
  try { hUnits = canvasH(key); } catch (e) { /* default */ }
  const meta = (window.LD_ART_META || {})[key];
  const f = meta ? hUnits / (meta[0] * meta[1]) : hUnits / im.naturalHeight;
  const w = im.naturalWidth * f * L.k, h = im.naturalHeight * f * L.k;
  cx.save();
  cx.globalAlpha = alpha == null ? 1 : alpha;
  cx.translate(sx, sy + 6 * L.k);
  if (flip) cx.scale(-1, 1);
  if (tint) cx.filter = tint;
  cx.drawImage(im, -w / 2, -h, w, h);
  cx.restore();
  return h;
}
function heroKey(pose) {
  let skin = null;
  try { skin = hskinFor(st.hero); } catch (e) { skin = null; }
  if (skin) { const k = 'hero_' + st.hero + '_' + skin.sid + '_' + pose; if (img(k)) return k; }
  return 'hero_' + st.hero + '_' + pose;
}
function tile(k, L, y, h, par, alpha) {
  const im = img(k);
  if (!im) return false;
  const w = im.naturalWidth * (h / im.naturalHeight);
  let x0 = -((st.cam * L.k * par) % w);
  if (x0 > 0) x0 -= w;
  cx.globalAlpha = alpha == null ? 1 : alpha;
  for (let x = x0; x < L.W; x += w) cx.drawImage(im, x, y, w + 1, h);
  cx.globalAlpha = 1;
  return true;
}
function draw() {
  const L = layout();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== Math.round(L.W * dpr) || cv.height !== Math.round(L.H * dpr)) { cv.width = Math.round(L.W * dpr); cv.height = Math.round(L.H * dpr); }
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sh = st.shake > 0 ? (Math.random() - 0.5) * st.shake : 0;
  if (S3) {
    if (S3.ready()) cx.clearRect(0, 0, L.W, L.H);
    cv3.style.transform = sh ? 'translateX(' + sh.toFixed(1) + 'px)' : '';
    try { S3.follow(st.x); S3.render(st, frameDt, { w: L.W, h: L.reelTop, dt: st.rdt || frameDt }); }
    catch (e) { console.warn('Reel Slayer 3D stopped; 2D stays.', e); S3 = null; cv3.style.display = 'none'; }
  }
  if (S3 && S3.ready()) { draw3dOverlay(L); drawAfter(L); return; }
  if (st.ev.length) st.ev.length = 0;        // 2D: the events are only for the 3D stage
  cx.fillStyle = '#0a0709'; cx.fillRect(0, 0, L.W, L.H);
  cx.save(); cx.translate(sh, 0);
  // backdrop
  const g = cx.createLinearGradient(0, 0, 0, L.ground);
  g.addColorStop(0, '#07090b'); g.addColorStop(1, '#1a1417');
  cx.fillStyle = g; cx.fillRect(0, 0, L.W, L.ground);
  const wallH = Math.max(220 * L.k, L.ground + 10);
  if (!tile('bg_wall', L, L.ground - wallH, wallH, 0.6, 1)) tile('bg_far', L, 0, L.ground, 0.2, 0.55);
  const vg = cx.createLinearGradient(0, 0, 0, L.ground);
  vg.addColorStop(0, 'rgba(6,5,8,.75)'); vg.addColorStop(0.45, 'rgba(6,5,8,.15)'); vg.addColorStop(1, 'rgba(6,5,8,0)');
  cx.fillStyle = vg; cx.fillRect(0, 0, L.W, L.ground);
  tile('bg_floor', L, L.ground - 4 * L.k, 90 * L.k, 1);
  if (!img('bg_floor')) { cx.fillStyle = '#231b1c'; cx.fillRect(0, L.ground, L.W, 80); }
  cx.fillStyle = 'rgba(0,0,0,.35)'; cx.fillRect(0, L.ground + 70 * L.k, L.W, L.reelTop - L.ground);
  // foes
  const planning = st.mode === 'plan' || st.mode === 'spin';
  for (const f of st.foes) {
    const flip = f.x > st.x;
    const base = f.boss ? 'boss_' + f.t : 'enemy_' + f.t;
    const atk = f.boss ? 'boss_attack_' + f.t : 'enemy_attack_' + f.t;
    const k = (f.state === 'wind' || f.lunge > 0.2) ? atk : base;
    const lx = f.x + (f.lunge > 0 ? Math.sign(st.x - f.x) * f.lunge * 18 : 0);
    const tint = f.flash > 0 ? 'brightness(' + (1 + f.flash * 1.5) + ')' : (f.stun > 0 ? 'saturate(.3) brightness(.8)' : null);
    const h = sprite(k, base, lx, L, flip, f.dead ? Math.max(0, 1 - f.deadT / 0.8) : 1, tint) || 100 * L.k;
    if (f.dead) continue;
    const sx = (f.x - st.cam) * L.k, top = L.ground - h - 10;
    // life bar
    const bw = (f.boss ? 90 : 46) * L.k;
    cx.fillStyle = '#000'; cx.fillRect(sx - bw / 2 - 1, top - 9, bw + 2, 6);
    cx.fillStyle = f.boss ? '#e0605a' : '#c9a0ff'; cx.fillRect(sx - bw / 2, top - 8, bw * clamp(f.hp / f.max, 0, 1), 4);
    // telegraph: a ring that fills as the strike comes, and its seconds while you plan
    const tIn = strikeIn(f);
    if (f.state === 'wind' || (planning && tIn != null && tIn < 3)) {
      const frac = f.state === 'wind' ? 1 - f.wT / f.wind : 0;
      const r = 13 * L.k + 4, cyy = top - 26;
      cx.lineWidth = 3; cx.strokeStyle = 'rgba(0,0,0,.6)'; cx.beginPath(); cx.arc(sx, cyy, r, 0, 7); cx.stroke();
      cx.strokeStyle = f.state === 'wind' ? '#ff5a4a' : '#e8c77a';
      cx.beginPath(); cx.arc(sx, cyy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac); cx.stroke();
      cx.fillStyle = '#fff'; cx.font = 'bold ' + Math.round(11 + 2 * L.k) + 'px ui-monospace,monospace'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
      cx.fillText(planning ? tIn.toFixed(1) : '!', sx, cyy + 1);
      cx.textBaseline = 'alphabetic';
    }
  }
  // hero
  const c = st.cur;
  const pose = st.hurtT > 0 ? 'hurt' : c ? MOVES[c.m].pose : (st.mode === 'walk' || st.mode === 'advance' ? 'walk' : 'idle');
  const dodgeLook = st.invT > 0 && !(c && c.m === 'boots');     // the leap stays solid
  const tint = c && c.m === 'skull' ? 'hue-rotate(250deg) saturate(1.6)' : (dodgeLook ? 'brightness(1.4) saturate(.6)' : null);
  cx.save(); cx.translate(0, -(st.hy || 0) * L.k);
  sprite(heroKey(pose), 'hero_' + st.hero + '_idle', st.x, L, st.face < 0, dodgeLook ? 0.7 : 1, tint);
  cx.restore();
  const hx = (st.x - st.cam) * L.k;
  if (st.parryT > 0) {
    cx.strokeStyle = st.parryPerfect > 0 ? 'rgba(160,230,255,.95)' : 'rgba(120,170,220,.6)'; cx.lineWidth = 4;
    cx.beginPath(); cx.arc(hx + st.face * 18 * L.k, L.ground - 60 * L.k, 46 * L.k, -1.1, 1.1); cx.stroke();
  }
  // shots
  for (const s of st.shots) {
    const x = (s.x - st.cam) * L.k, y = L.ground - s.y * L.k;
    cx.strokeStyle = s.mine ? '#e8d7a8' : '#b07cf0'; cx.lineWidth = 3;
    cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x - Math.sign(s.v) * 26, y); cx.stroke();
  }
  // fx
  for (const e of st.fx) {
    const p = e.t / e.dur, x = (e.x - st.cam) * L.k, y = L.ground - 60 * L.k;
    cx.save(); cx.globalAlpha = 1 - p;
    if (e.k === 'slash') { cx.strokeStyle = '#fff4d6'; cx.lineWidth = 5; cx.beginPath(); cx.arc(x, y, 50 * L.k, e.face > 0 ? -1.3 + p : Math.PI - 0.3 - p, e.face > 0 ? 0.6 + p : Math.PI + 1.6 - p); cx.stroke(); }
    else if (e.k === 'boom') { const r = (30 + 100 * p) * L.k; const gr = cx.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,220,120,.95)'); gr.addColorStop(1, 'rgba(255,90,30,0)'); cx.fillStyle = gr; cx.beginPath(); cx.arc(x, y, r, 0, 7); cx.fill(); }
    else if (e.k === 'curse') { const r = (40 + 120 * p) * L.k; cx.strokeStyle = '#b07cf0'; cx.lineWidth = 6; cx.beginPath(); cx.arc(x, y, r, 0, 7); cx.stroke(); }
    else if (e.k === 'parry') { cx.fillStyle = '#bfe8ff'; cx.beginPath(); cx.arc(x, y, (14 + 30 * p) * L.k, 0, 7); cx.fill(); }
    else if (e.k === 'after') { sprite(heroKey('walk'), 'hero_' + st.hero + '_idle', e.x, L, e.face < 0, 0.3 * (1 - p), 'brightness(2) saturate(0)'); }
    cx.restore();
  }
  // floaters
  cx.textAlign = 'center';
  for (const f of st.fl) {
    cx.globalAlpha = Math.max(0, 1 - f.t / 1.1);
    cx.font = 'bold ' + Math.round(13 + 3 * L.k) + 'px ui-monospace,monospace';
    cx.fillStyle = '#000'; cx.fillText(f.txt, (f.x - st.cam) * L.k + 1, L.ground - f.y * L.k - f.t * 40 + 1);
    cx.fillStyle = f.col; cx.fillText(f.txt, (f.x - st.cam) * L.k, L.ground - f.y * L.k - f.t * 40);
  }
  cx.globalAlpha = 1;
  cx.restore();
  drawAfter(L);
}
function drawAfter(L) {
  const planning = st.mode === 'plan' || st.mode === 'spin';
  if (st.flash > 0) { cx.fillStyle = 'rgba(200,40,30,' + (st.flash * 0.35) + ')'; cx.fillRect(0, 0, L.W, L.H); }
  if (planning) { cx.fillStyle = 'rgba(20,30,40,.18)'; cx.fillRect(0, 0, L.W, L.reelTop); }
  drawHud(L);
  drawHits(L);
  drawReels(L);
  if (st.banner && st.banner.ult) {
    // an ultimate's name slams in over a dark band
    const p = st.banner.t / 1.6, y = L.H * 0.28;
    const a = p < 0.08 ? p / 0.08 : Math.max(0, 1 - (p - 0.7) / 0.3);
    const sc = p < 0.12 ? 2.2 - (p / 0.12) * 1.2 : 1;
    cx.save(); cx.globalAlpha = a;
    const band = cx.createLinearGradient(0, 0, L.W, 0);
    band.addColorStop(0, 'rgba(0,0,0,0)'); band.addColorStop(0.2, 'rgba(10,2,2,.78)'); band.addColorStop(0.8, 'rgba(10,2,2,.78)'); band.addColorStop(1, 'rgba(0,0,0,0)');
    cx.fillStyle = band; cx.fillRect(0, y - 42, L.W, 60);
    cx.translate(L.W / 2, y); cx.scale(sc, sc);
    cx.font = Math.round(40 + 10 * L.k) + "px 'Pirata One',Georgia,serif"; cx.textAlign = 'center';
    cx.shadowColor = '#ff5a1a'; cx.shadowBlur = 24;
    const g = cx.createLinearGradient(0, -40, 0, 4); g.addColorStop(0, '#fff3c8'); g.addColorStop(0.5, '#ffb24a'); g.addColorStop(1, '#c2361a');
    cx.lineWidth = 6; cx.strokeStyle = '#1a0500'; cx.strokeText(st.banner.txt, 0, 0);
    cx.fillStyle = g; cx.fillText(st.banner.txt, 0, 0);
    cx.restore();
  } else if (st.banner) {
    const p = st.banner.t / 1.6;
    cx.globalAlpha = p < 0.15 ? p / 0.15 : Math.max(0, 1 - (p - 0.6) / 0.4);
    cx.font = Math.round(34 + 8 * L.k) + "px 'Pirata One',Georgia,serif"; cx.textAlign = 'center';
    cx.fillStyle = '#000'; cx.fillText(st.banner.txt, L.W / 2 + 2, L.H * 0.3 + 2);
    cx.fillStyle = '#e8c77a'; cx.fillText(st.banner.txt, L.W / 2, L.H * 0.3);
    cx.globalAlpha = 1;
  }
}
/* 3D mode: the world is drawn by slayer3d.js; this adds bars, strike timers
   and floating numbers at the characters' projected screen positions. */
function draw3dOverlay(L) {
  const planning = st.mode === 'plan' || st.mode === 'spin';
  cx.textAlign = 'center';
  for (const f of st.foes) {
    if (f.dead) continue;
    const top = S3.project(f.x, S3.heightOf(f) + 0.12);
    const sx = top.x, t0 = top.y;
    const bw = f.boss ? 90 : 46;
    cx.fillStyle = '#000'; cx.fillRect(sx - bw / 2 - 1, t0 - 9, bw + 2, 6);
    cx.fillStyle = f.boss ? '#e0605a' : '#c9a0ff'; cx.fillRect(sx - bw / 2, t0 - 8, bw * clamp(f.hp / f.max, 0, 1), 4);
    const tIn = strikeIn(f);
    if (f.state === 'wind' || (planning && tIn != null && tIn < 3)) {
      const frac = f.state === 'wind' ? 1 - f.wT / f.wind : 0;
      const r = 15, cyy = t0 - 26;
      cx.lineWidth = 3; cx.strokeStyle = 'rgba(0,0,0,.6)'; cx.beginPath(); cx.arc(sx, cyy, r, 0, 7); cx.stroke();
      cx.strokeStyle = f.state === 'wind' ? '#ff5a4a' : '#e8c77a';
      cx.beginPath(); cx.arc(sx, cyy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac); cx.stroke();
      cx.fillStyle = '#fff'; cx.font = 'bold 13px ui-monospace,monospace'; cx.textBaseline = 'middle';
      cx.fillText(planning ? tIn.toFixed(1) : '!', sx, cyy + 1);
      cx.textBaseline = 'alphabetic';
    }
  }
  for (const f of st.fl) {
    const p = S3.project(f.x, f.y * U3);
    cx.globalAlpha = Math.max(0, 1 - f.t / 1.1);
    cx.font = 'bold 16px ui-monospace,monospace';
    cx.fillStyle = '#000'; cx.fillText(f.txt, p.x + 1, p.y - f.t * 40 + 1);
    cx.fillStyle = f.col; cx.fillText(f.txt, p.x, p.y - f.t * 40);
  }
  cx.globalAlpha = 1;
}
/* The combo counter: climbs with every blow that lands this combo. */
function drawHits(L) {
  if (st.hits < 2) return;
  const pop = Math.max(0, st.hitsT - 1.15) * 4, a = Math.min(1, st.hitsT / 0.4);
  cx.save();
  cx.globalAlpha = a;
  cx.translate(L.W - 18, 70);
  cx.scale(1 + pop * 0.5, 1 + pop * 0.5);
  cx.textAlign = 'right';
  cx.font = "46px 'Pirata One',Georgia,serif";
  cx.lineWidth = 5; cx.strokeStyle = '#000';
  cx.strokeText(String(st.hits), 0, 0);
  const g = cx.createLinearGradient(0, -40, 0, 0); g.addColorStop(0, '#fff1c4'); g.addColorStop(1, st.ult ? '#ff7a3a' : '#e8b04a');
  cx.fillStyle = g; cx.fillText(String(st.hits), 0, 0);
  cx.font = "16px 'Pirata One',Georgia,serif"; cx.lineWidth = 3;
  cx.strokeText('HITS', 0, 18); cx.fillStyle = '#e8c77a'; cx.fillText('HITS', 0, 18);
  cx.restore();
}
function drawHud(L) {
  const top = 14;
  const bw = Math.min(260, L.W * 0.5), x0 = 56;
  cx.fillStyle = '#000'; cx.fillRect(x0 - 2, top - 2, bw + 4, 18);
  cx.fillStyle = '#3a1512'; cx.fillRect(x0, top, bw, 14);
  cx.fillStyle = '#c0453a'; cx.fillRect(x0, top, bw * clamp(st.hp / st.maxHp, 0, 1), 14);
  cx.font = 'bold 12px ui-monospace,monospace'; cx.textAlign = 'center'; cx.fillStyle = '#fff';
  cx.fillText(Math.ceil(st.hp) + '/' + st.maxHp, x0 + bw / 2, top + 11);
  cx.textAlign = 'left'; cx.fillStyle = '#e8c77a';
  cx.fillText('🪙 ' + st.coins + '   WAVE ' + st.wave + '   ☠ ' + st.kills, x0, top + 34);
}
function symImg(k) { return img('sym_' + k); }
function drawSym(k, x, y, s, alpha) {
  const im = symImg(k);
  cx.globalAlpha = alpha == null ? 1 : alpha;
  if (im) cx.drawImage(im, x - s / 2, y - s / 2, s, s);
  else { cx.font = Math.round(s * 0.8) + 'px serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillStyle = '#fff'; cx.fillText((SYM[k] && SYM[k].e) || '?', x, y); cx.textBaseline = 'alphabetic'; }
  cx.globalAlpha = 1;
}
function drawReels(L) {
  const g = cx.createLinearGradient(0, L.reelTop, 0, L.H);
  g.addColorStop(0, '#1b1315'); g.addColorStop(1, '#0c0a0b');
  cx.fillStyle = g; cx.fillRect(0, L.reelTop, L.W, L.H - L.reelTop);
  cx.fillStyle = '#000'; cx.fillRect(0, L.reelTop, L.W, 3);
  // combo bar: the moves in the order you stopped the reels
  const slots = st.reels.length, bs = 26;
  const bx0 = L.W / 2 - (slots * (bs + 6)) / 2;
  const shown = st.mode === 'act' ? st.combo : st.order.map(i => st.reels[i].done ? st.reels[i].res : null);
  const played = st.mode === 'act' ? st.combo.length - st.queue.length - (st.cur ? 1 : 0) : 0;
  for (let i = 0; i < slots; i++) {
    const x = bx0 + i * (bs + 6), y = L.reelTop + 6;
    cx.fillStyle = st.mode === 'act' && i === played ? 'rgba(232,199,122,.35)' : 'rgba(255,255,255,.06)';
    cx.fillRect(x, y, bs, bs);
    cx.strokeStyle = 'rgba(232,199,122,.4)'; cx.lineWidth = 1; cx.strokeRect(x + 0.5, y + 0.5, bs - 1, bs - 1);
    const k = shown[i];
    if (k) drawSym(k, x + bs / 2, y + bs / 2, bs - 4, st.mode === 'act' && i < played ? 0.35 : 1);
  }
  const rects = reelRects(L);
  st.reels.forEach((R, i) => {
    const r = rects[i];
    cx.fillStyle = '#e2d9c5'; cx.fillRect(r.x, r.y, r.w, r.h);
    cx.save(); cx.beginPath(); cx.rect(r.x, r.y, r.w, r.h); cx.clip();
    const cell = r.h / 3, frac = R.pos - Math.floor(R.pos);
    for (let j = -2; j <= 2; j++) {
      const n = R.strip.length, idx = ((Math.floor(R.pos) + j) % n + n) % n;
      const y = r.y + r.h / 2 + (j - frac) * cell * -1;
      drawSym(R.strip[idx], r.x + r.w / 2, y, cell * 0.78);
    }
    const sh = cx.createLinearGradient(0, r.y, 0, r.y + r.h);
    sh.addColorStop(0, 'rgba(0,0,0,.45)'); sh.addColorStop(0.3, 'rgba(0,0,0,0)'); sh.addColorStop(0.7, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.45)');
    cx.fillStyle = sh; cx.fillRect(r.x, r.y, r.w, r.h);
    cx.restore();
    cx.strokeStyle = '#000'; cx.lineWidth = 3; cx.strokeRect(r.x, r.y, r.w, r.h);
    cx.strokeStyle = 'rgba(201,118,58,.85)'; cx.lineWidth = 2; cx.strokeRect(r.x + 3, r.y + r.h / 3, r.w - 6, r.h / 3);
    const ord = st.order.indexOf(i);
    if (ord >= 0) {
      cx.fillStyle = '#cfa75c'; cx.beginPath(); cx.arc(r.x + r.w - 12, r.y + 12, 10, 0, 7); cx.fill();
      cx.fillStyle = '#1a1008'; cx.font = 'bold 12px ui-monospace,monospace'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
      cx.fillText(String(ord + 1), r.x + r.w - 12, r.y + 13); cx.textBaseline = 'alphabetic';
    }
  });
  const last = rects[rects.length - 1];
  cx.font = '12px ui-monospace,monospace'; cx.textAlign = 'center'; cx.fillStyle = '#cdb68a';
  const tip = st.over ? '' : st.mode === 'plan' ? (st.coins > 0 ? 'Tap the reels to pull · 🪙1' : 'Out of coins') :
    st.mode === 'spin' ? 'Tap each reel to stop it. Stop order = move order' :
    st.mode === 'act' ? (st.frenzy ? 'FRENZY: double damage' : st.combo.map(m => MOVES[m].n).join(' → ')) : '';
  cx.fillText(tip, L.W / 2, Math.min(L.H - 10, last.y + last.h + 20));
}

/* ---------- loop ---------- */
function tick(now) {
  raf = requestAnimationFrame(tick);
  const rdt = Math.min(0.05, (now - (last || now)) / 1000);
  last = now;
  if (!st) return;
  updateReels(rdt);
  // hit-stop freezes the fight for a few frames; slow motion runs it at a third
  let dt = rdt;
  if (st.stopT > 0) { st.stopT = Math.max(0, st.stopT - rdt); dt = 0; }
  else if (st.slowT > 0) { st.slowT = Math.max(0, st.slowT - rdt); dt = rdt * 0.35; }
  frameDt = dt; st.rdt = rdt;
  if (st.hitsT > 0) { st.hitsT -= rdt; if (st.hitsT <= 0) st.hits = 0; }
  const running = st.mode === 'act' || st.mode === 'walk' || st.mode === 'advance';
  if (st.mode === 'act') {
    st.invT = Math.max(0, st.invT - dt);
    st.parryT = Math.max(0, st.parryT - dt);
    st.parryPerfect = Math.max(0, st.parryPerfect - dt);
    doMove(dt);
    updateFoes(dt);
  } else if (st.mode === 'walk') {
    st.walkT -= dt; st.face = 1; st.x += 110 * dt;
    if (st.walkT <= 0) { nextWave(); st.mode = 'advance'; }
  } else if (st.mode === 'advance') {
    // walk up to the nearest foe, then stop and wait for a pull
    const nf = nearest();
    if (!nf) st.mode = 'plan';
    else {
      st.face = nf.x >= st.x ? 1 : -1;
      const d = Math.abs(nf.x - st.x) - ENGAGE;
      if (d <= 0) st.mode = 'plan';
      else st.x += st.face * Math.min(d, ADVANCE_SPD * dt);
    }
  }
  if (running || st.over) {
    st.hurtT = Math.max(0, st.hurtT - dt);
    for (const e of st.fx) e.t += dt;
    st.fx = st.fx.filter(e => e.t < e.dur);
  }
  st.flash = Math.max(0, st.flash - rdt * 2);
  st.shake = Math.max(0, st.shake - rdt * 30);
  for (const f of st.fl) f.t += rdt;
  st.fl = st.fl.filter(f => f.t < 1.1);
  if (st.banner) { st.banner.t += rdt; if (st.banner.t > 1.6) st.banner = null; }
  const L = layout();
  const want = st.x - L.viewW * 0.3;
  st.cam += (want - st.cam) * Math.min(1, dt * 4);
  draw();
}

/* ---------- screens ---------- */
function endRun(why) {
  if (st.over) return;
  st.over = true; st.mode = 'over';
  const souls = st.kills + st.wave * 3;
  S.souls += souls;
  S.slayer = S.slayer || { best: 0, runs: 0 };
  S.slayer.runs++; const best = st.wave > S.slayer.best; if (best) S.slayer.best = st.wave;
  try { save(); } catch (e) { /* ignore */ }
  setTimeout(() => {
    panel(`<h2>${why === 'broke' ? 'Out of coins' : 'Slain'}</h2>
      <p>Wave <b>${st.wave}</b> · ${st.kills} kills · ${st.spun} pulls${best ? ' · <b style="color:#e8c77a">new best</b>' : ''}</p>
      <p>Banked <b style="color:#9fd6ff">💠 ${souls} souls</b></p>
      <button data-sl="again">Pull again</button><button data-sl="exit">Back to the hub</button>`);
  }, 900);
}
function panel(html) {
  let p = root.querySelector('.slPanel');
  if (!p) { p = document.createElement('div'); p.className = 'slPanel'; root.appendChild(p); }
  p.innerHTML = html; p.style.display = 'block';
}
function hidePanel() { const p = root.querySelector('.slPanel'); if (p) p.style.display = 'none'; }
function pickHero() {
  const owned = Object.keys(HEROES).filter(h => S.heroes && S.heroes[h]);
  panel(`<h2>Reel Slayer <small>prototype</small></h2>
    <p class="slSub">No buttons. Tap the reels to pull, then tap each reel to stop it: the order you stop them is the order your hero strikes. Your hero walks up to the next foe on his own, and the world waits while you plan; every foe shows how many seconds until it strikes.</p>
    <p class="slSub">🗡 Slash · 🥾 Leap (jump attack, dodges) · 🛡 Parry (on time = counter) · 🏹 Shot · 💣 Blast · 🧪 Heal · 🪙 Coins · 💀 Cursed strike (hurts you too) · 🗝 Backstep · ⭐ copies the move before it. Three of a kind: an ultimate, double damage.</p>
    ${S.slayer && S.slayer.best ? `<p class="slSub">Best: wave ${S.slayer.best}</p>` : ''}
    ${owned.map(h => `<button data-sl="hero:${h}">${HEROES[h].e} ${HEROES[h].n} <small>❤${HEROES[h].hp + (alt('vit') || 0) * 5} · 🪙${HEROES[h].coins}</small></button>`).join('')}
    <button data-sl="exit">Back</button>`);
}
function onPanel(e) {
  const b = e.target.closest('[data-sl]');
  if (!b) return;
  const [a, arg] = b.dataset.sl.split(':');
  if (a === 'exit') return close();
  if (a === 'again') { hidePanel(); pickHero(); return; }
  if (a === 'hero') { hidePanel(); newRun(arg); }
}
function onTap(e) {
  if (!st || st.over) return;
  const r = cv.getBoundingClientRect();
  const x = e.clientX - r.left, y = e.clientY - r.top;
  const L = layout();
  if (st.mode === 'plan') { if (y > L.reelTop - 40) spin(); return; }
  if (st.mode === 'spin') {
    const rects = reelRects(L);
    let hit = rects.findIndex(q => x >= q.x - 4 && x <= q.x + q.w + 4 && y >= q.y - 30 && y <= q.y + q.h + 30);
    if (hit < 0 && y > L.reelTop) {       // a tap near the reels stops the next spinning one
      hit = st.reels.findIndex(R => !R.done && R.stop == null);
    }
    if (hit >= 0) stopReel(hit);
  }
}
function open() {
  if (!root) {
    root = document.createElement('div');
    root.id = 'slayer';
    root.innerHTML = '<canvas class="sl3"></canvas><canvas class="sl2"></canvas><button class="slX" aria-label="Leave">✕</button>';
    document.body.appendChild(root);
    cv3 = root.querySelector('.sl3');
    cv = root.querySelector('.sl2'); cx = cv.getContext('2d');
    cv.addEventListener('pointerdown', onTap);
    root.addEventListener('click', onPanel);
    root.querySelector('.slX').addEventListener('click', () => { if (!st || st.over || confirm('Leave this run? Souls are only banked when a run ends.')) close(); });
  }
  root.style.display = 'block';
  document.documentElement.classList.add('slOpen');
  boot3d();
  st = null;
  newRun(Object.keys(HEROES).find(h => S.heroes && S.heroes[h]) || 'knight');
  st.mode = 'menu';
  pickHero();
  try { music.play('boss'); } catch (e) { /* ignore */ }
  last = 0;
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(tick);
}
/* The 3D stage is optional: no WebGL, a failed load or ?flat in the URL keeps the 2D sprites. */
function boot3d() {
  if (s3tried) return;
  s3tried = true;
  if (/[?&]flat\b/.test(location.search)) return;
  try { const t = document.createElement('canvas'); if (!(t.getContext('webgl2') || t.getContext('webgl'))) return; } catch (e) { return; }
  import('./slayer3d.js').then(m => m.boot(cv3)).then(stage => { S3 = stage; cv3.style.display = 'block'; })
    .catch(e => { console.warn('Reel Slayer 3D unavailable; 2D sprites stay.', e); S3 = null; });
}
function close() {
  cancelAnimationFrame(raf);
  if (root) root.style.display = 'none';
  document.documentElement.classList.remove('slOpen');
  hidePanel();
  st = null;
  try { showHub('main'); } catch (e) { /* ignore */ }
}
window.Slayer = { open, close, get state() { return st; }, get stage() { return S3; }, _stop: stopReel, _spin: spin,
  _wave(n) { if (!st) return; st.wave = n - 1; st.foes = []; nextWave(); st.mode = 'advance'; },
  _force(syms) { if (!st || st.mode !== 'plan') return; st.order = syms.map((x, i) => i); st.reels.forEach((R, i) => { R.res = syms[i] || syms[0]; R.done = true; }); st.mode = 'spin'; buildCombo(); } };
})();
