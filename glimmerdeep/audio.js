// glimmerdeep/audio.js  (NEW FILE; load it BEFORE game.js:  <script src="audio.js?v=1"></script>)
// Sound files + synth fallback + music for Glimmerdeep, in the style of Ironhold's sfxWake / SFX_BUF / <audio id="bgm">.
// UNTESTED in a browser: written and syntax-checked with `node --check` only.
(function () {
'use strict';
const VER = window.GLIM_AUDIO_V || '1';          // bump to bust the cache (appended as ?v= to every audio URL)
const ROOT = '';                                 // files sit next to audio.js: music/ sfx/ wilds/ (glimmerdeep/music, glimmerdeep/sfx, glimmerdeep/wilds)
const GAPLESS = false;                          // true = music through a looping WebAudio buffer (sample-exact loop); false = <audio loop>
const q = f => ROOT + f + '.mp3?v=' + VER;

// cue -> file(s). Several files = random variant per play.
const FILES = {
  click: ['sfx/click'], hit: ['sfx/hit1', 'sfx/hit2', 'sfx/hit3'], crit: ['sfx/crit'], heal: ['sfx/heal'], ko: ['sfx/ko'], ult: ['sfx/ult'],
  react: ['sfx/react'], lvl: ['sfx/lvl'], coin: ['sfx/coin'], miss: ['sfx/miss'], shield: ['sfx/shield'], fightstart: ['sfx/fightstart'],
  merge: ['sfx/merge'], reroll: ['sfx/reroll'], lock: ['sfx/lock'], pickup: ['sfx/pickup'], drop: ['sfx/drop'], summon: ['sfx/summon'],
  bossbanner: ['sfx/bossbanner'], relic: ['sfx/relic'],
  wdoor: ['wilds/wdoor'], wspike: ['wilds/wspike'], wkey: ['wilds/wkey'], wvault: ['wilds/wvault'], wsecret: ['wilds/wsecret'],
  wberry: ['wilds/wberry'], wchest: ['wilds/wchest'], wshrine: ['wilds/wshrine'], wencounter: ['wilds/wencounter'],
  wcatch: ['wilds/wcatch'], wshiny: ['wilds/wshiny'], wdescend: ['wilds/wdescend'], wdone: ['wilds/wdone'],
};
const STING = { win: 'music/stinger_win', lose: 'music/stinger_lose', evolve: 'music/stinger_evolve' };
const MUSIC = { title: 'music/title', plan: 'music/plan', fight: 'music/fight', boss: 'music/boss', core: 'music/core', glimmerwyrm: 'music/glimmerwyrm',
  wilds_explore: 'wilds/wilds_explore', wilds_fight: 'wilds/wilds_fight', wilds_lair: 'wilds/wilds_lair' };

// per-file playback gain (README "volume map"; measured so every cue lands at about the same loudness; never > 1)
const VOL = { click: 0.44, hit1: 0.5, hit2: 0.89, hit3: 0.81, crit: 1, heal: 0.9, ko: 0.57, ult: 0.72, react: 0.68, lvl: 0.89, coin: 0.6, miss: 0.55,
  shield: 0.57, fightstart: 0.54, merge: 0.69, reroll: 0.61, lock: 0.52, pickup: 0.54, drop: 0.68, summon: 1, bossbanner: 0.79, relic: 1,
  wdoor: 0.62, wspike: 1, wkey: 0.65, wvault: 1, wsecret: 1, wberry: 0.67, wchest: 0.97, wshrine: 0.81, wencounter: 1, wcatch: 0.91, wshiny: 1,
  wdescend: 1, wdone: 1, stinger_win: 0.8, stinger_lose: 0.8, stinger_evolve: 0.8 };
// throttling: min ms between two plays of the same cue; THIN = chance to keep the cue at speed 2x / 4x; LOW cues are dropped when too many voices play
const GAP = { click: 45, hit: 60, crit: 80, react: 80, ko: 90, miss: 80, heal: 120, shield: 120, coin: 60, pickup: 60, drop: 60, wspike: 300 };
const THIN = { hit: [0.75, 0.5], react: [0.8, 0.55], ko: [1, 0.8], miss: [0.8, 0.6] };
const JITTER = { click: 0.04, hit: 0.05, react: 0.04, ko: 0.04, miss: 0.04 };   // +-playbackRate
const LOW = { click: 1, hit: 1, react: 1, miss: 1, pickup: 1, drop: 1 };
const MAXV = 6, MGAIN = 0.55;                   // max simultaneous low-priority voices; music loudness relative to the volume setting

// ---- sfx_v2: element-aware spell cues (folder sfx2/). Keys: <element>_cast, <element>_hit (2 variants), <element>_ult, generic_ult, heal2, shield2, r_<reaction> ------------------
const EL10 = ['ember', 'tide', 'bloom', 'volt', 'stone', 'shade', 'frost', 'gale', 'metal', 'mystic'];
const REACT = { Electrocute: 'r_electrocute', Steam: 'r_steam', 'Blight Burst': 'r_blight', Shatter: 'r_shatter', Freeze: 'r_freeze', Firestorm: 'r_firestorm', Fizzle: 'r_fizzle', Doom: 'r_doom', Mirrored: 'r_mirror' };
const V2 = { generic_ult: ['sfx2/generic_ult'], heal2: ['sfx2/heal1', 'sfx2/heal2'], shield2: ['sfx2/shield2'] };
for (const e of EL10) { V2[e + '_cast'] = ['sfx2/' + e + '_cast']; V2[e + '_hit'] = ['sfx2/' + e + '_hit1', 'sfx2/' + e + '_hit2']; V2[e + '_ult'] = ['sfx2/' + e + '_ult']; }
for (const k in REACT) V2[REACT[k]] = ['sfx2/' + REACT[k]];
Object.assign(FILES, V2);
Object.assign(VOL, { bloom_cast: 0.67, bloom_hit1: 0.87, bloom_hit2: 0.9, bloom_ult: 0.88, ember_cast: 0.7, ember_hit1: 0.77, ember_hit2: 0.9, ember_ult: 0.97, frost_cast: 0.66, frost_hit1: 0.85, frost_hit2: 0.77, frost_ult: 0.91, gale_cast: 0.49, gale_hit1: 0.84, gale_hit2: 0.71, gale_ult: 0.65, generic_ult: 0.99, heal1: 0.65, heal2: 0.72, metal_cast: 0.63, metal_hit1: 0.58, metal_hit2: 0.67, metal_ult: 0.94, mystic_cast: 0.64, mystic_hit1: 0.7, mystic_hit2: 0.88, mystic_ult: 0.89, r_blight: 0.79, r_doom: 0.72, r_electrocute: 0.67, r_firestorm: 0.6, r_fizzle: 0.73, r_freeze: 0.76, r_mirror: 0.74, r_shatter: 0.78, r_steam: 0.53, shade_cast: 0.69, shade_hit1: 0.82, shade_hit2: 0.81, shade_ult: 0.96, shield2: 0.58, stone_cast: 0.48, stone_hit1: 0.73, stone_hit2: 0.78, stone_ult: 0.85, tide_cast: 0.69, tide_hit1: 0.81, tide_hit2: 0.78, tide_ult: 0.75, volt_cast: 0.53, volt_hit1: 0.83, volt_hit2: 0.78, volt_ult: 0.92 });                     // per-file playback gain (level match inside each class x class weight; README table)
const OLD = { cast: 'react', hit: 'hit', ult: 'ult' };   // the first-pack cue each new one falls back to
for (const k in V2) {
  const hit = /_hit$/.test(k), cast = /_cast$/.test(k), ult = /_ult$/.test(k), re = k[0] === 'r' && k[1] === '_';
  GAP[k] = hit || cast ? 80 : ult ? 250 : 120;                       // max 1 per cue key (= per element and kind) per 80 ms
  if (hit) { THIN[k] = [0.7, 0.4]; JITTER[k] = 0.05; } else if (cast) { THIN[k] = [0.8, 0.55]; JITTER[k] = 0.05; } else if (re) THIN[k] = [0.9, 0.7];
  if (hit || cast) LOW[k] = 1;                                      // dropped first when many voices play
}
const maxVoices = () => GA.speed >= 4 ? 3 : GA.speed >= 2 ? 4 : MAXV;   // fewer simultaneous low-priority cues at 2x / 4x
const groupOf = k => V2[k] ? 'v2' : (k[0] === 'w' && k !== 'win') ? 'wilds' : 'main';


const GA = { ctx: null, master: null, buf: {}, mbuf: {}, meta: null, save: () => {}, synth: {}, speed: 1, want: null, unlocked: false };
let last = {}, lastVar = {}, voices = 0, el = null, fadeT = 0, cur = null, holdUntil = 0, gcur = null;

// init(meta, save, synth): meta = game.js's meta object (adds meta.music, meta.vol; meta.sound stays the SFX toggle); synth = the old SFX table (fallback)
GA.init = (meta, save, synth) => {
  GA.meta = meta; GA.save = save || GA.save; GA.synth = synth || {};
  if (meta.music === undefined) meta.music = true;
  if (meta.vol === undefined) meta.vol = 70;
};
const sfxOn = () => !GA.meta || GA.meta.sound !== false;
const musicOn = () => !GA.meta || GA.meta.music !== false;
const clamp01 = n => { const x = +n; return Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0; };
// meta.vol is a percent. The gain the graph uses is always a finite number in [0,1].
const vol = () => {
  const raw = GA.meta && GA.meta.vol != null ? +GA.meta.vol : 70;
  const pct = Number.isFinite(raw) ? Math.max(0, Math.min(100, raw)) : 70;
  return clamp01(pct / 100);
};
const base = f => f.split('/').pop();
const MASTER = 0.7, LIM_T = -7;                 // SFX/stinger bus trim, and the limiter threshold in dB (see ctx()). The limiter's automatic make-up gain is about +4 dB, so 0.7 keeps ordinary cues at roughly their old loudness
const mgain = () => vol() * MASTER;

function ctx() {
  if (GA.ctx) return GA.ctx;
  try {
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
    const c = new C(), comp = c.createDynamicsCompressor(), lim = c.createDynamicsCompressor(), m = c.createGain();
    comp.threshold.value = -12; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.15;   // tames stacked hits
    lim.threshold.value = LIM_T; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.1;   // last stage: limiter-style, keeps the busiest fights under full scale
    m.gain.value = mgain(); m.connect(comp); comp.connect(lim); lim.connect(c.destination);
    GA.ctx = c; GA.master = m;
  } catch (e) { return null; }
  return GA.ctx;
}
// load('main') at the first tap; load('wilds') when the Wilds screen opens. Skipped on file: (fetch is blocked there; synth fallback is used).
GA.loaded = {};
GA.load = group => {
  group = group || 'main';
  if (GA.loaded[group] || location.protocol === 'file:') return GA.loaded[group];
  const c = ctx(); if (!c) return;
  const names = [];
  for (const k in FILES) if (groupOf(k) === group) names.push(...FILES[k]);
  if (group === 'main') names.push(...Object.values(STING));
  GA.loaded[group] = Promise.all(names.map(n => fetch(q(n)).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
    .then(ab => new Promise((ok, no) => c.decodeAudioData(ab, ok, no))).then(b => { GA.buf[n] = b; }).catch(() => { /* missing file: synth fallback */ })));
  return GA.loaded[group];
};

GA.sfx = (name, v) => {
  if (!sfxOn()) return;
  const now = performance.now();
  if (now - (last[name] || -1e9) < (GAP[name] || 0)) return;
  const th = THIN[name];
  if (th && GA.speed > 1 && Math.random() > (GA.speed >= 4 ? th[1] : th[0])) return;
  const c = GA.ctx, files = (FILES[name] || []).filter(f => GA.buf[f]);
  if (!c || !files.length) { const f = GA.synth[name]; if (f) { last[name] = now; f(); } return; }   // not loaded / missing: old synth
  if (LOW[name] && voices >= maxVoices()) return;
  last[name] = now;
  let i = files.length > 1 ? Math.floor(Math.random() * files.length) : 0;
  if (files.length > 1 && i === lastVar[name]) i = (i + 1) % files.length;
  lastVar[name] = i;
  const f = files[i], s = c.createBufferSource(), g = c.createGain();
  s.buffer = GA.buf[f];
  if (JITTER[name]) s.playbackRate.value = 1 - Math.random() * JITTER[name];   // 0.95-1.00 only: never pitched up
  g.gain.value = clamp01((VOL[base(f)] == null ? 1 : VOL[base(f)]) * (v == null ? 1 : v));
  const low = !!LOW[name]; s.connect(g); g.connect(GA.master); if (low) voices++;
  s.onended = () => { if (low) voices--; try { g.disconnect(); } catch (e) { /* gone */ } };
  s.start();
};

// ---- element-aware calls (sfx2). Every one falls back to the first-pack cue (and then to the old synth) when its file is missing / not yet loaded ----------
const has = k => (FILES[k] || []).some(f => GA.buf[f]);
GA.el = (kind, el, o) => {                      // kind: 'cast' | 'hit' | 'ult';  el: ember|tide|bloom|volt|stone|shade|frost|gale|metal|mystic;  o.v: extra gain 0..1
  const v = o && o.v;
  let key = el + '_' + kind;
  if (!has(key) && kind === 'ult' && has('generic_ult')) key = 'generic_ult';
  if (has(key)) return GA.sfx(key, v);
  GA.sfx(OLD[kind], v);
};
GA.heal = () => GA.sfx(has('heal2') ? 'heal2' : 'heal');
GA.shield = () => GA.sfx(has('shield2') ? 'shield2' : 'shield');
GA.react = name => { const k = REACT[name]; GA.sfx(k && has(k) ? k : 'react'); };   // 'Grit!', 'ENRAGED' etc. keep the old react cue


// ---- music ----------------------------------------------------------------------------------
function ensureEl() {
  if (el) return el;
  el = new Audio(); el.loop = true; el.preload = 'none'; el.volume = 0;
  el.addEventListener('error', () => { GA.musicFail = true; cur = null; });   // 404 etc.: stay silent, game keeps working
  return el;
}
const mvol = () => Math.min(1, vol() * MGAIN);
let fadingIn = false;
function fade(to, ms, done) {
  clearInterval(fadeT);
  const a = ensureEl(), from = a.volume, t0 = performance.now();
  const destOf = typeof to === 'function' ? to : () => to;
  fadingIn = destOf() > 0.02;
  fadeT = setInterval(() => {
    const k = Math.min(1, (performance.now() - t0) / ms);
    const d = Math.max(0, Math.min(1, destOf()));
    a.volume = Math.max(0, Math.min(1, from + (d - from) * k));
    if (k >= 1) { clearInterval(fadeT); fadeT = 0; fadingIn = false; a.volume = Math.max(0, Math.min(1, destOf())); if (done) done(); }
  }, 30);
}
GA.music = name => {                            // name: key of MUSIC, or null to stop
  GA.want = name;
  if (!name || !MUSIC[name]) return GA.stopMusic();
  if (!GA.unlocked || !musicOn() || document.hidden) return;   // GA.wake() / the toggle / visibilitychange will call us again
  const now = performance.now();
  if (now < holdUntil) { setTimeout(() => GA.music(GA.want), holdUntil - now + 60); return; }   // a stinger is playing
  if (cur === name) return;
  GAPLESS ? gaplessStart(name) : elStart(name);
};
function elStart(name) {
  const a = ensureEl();
  const go = () => { cur = name; a.src = q(MUSIC[name]); a.currentTime = 0; const p = a.play(); if (p && p.catch) p.catch(() => { cur = null; }); fade(mvol, 600); };
  if (cur && !a.paused) fade(0, 350, go); else go();
}
function gaplessStart(name) {
  const c = ctx(); if (!c) return;
  const key = MUSIC[name], out = gcur;
  const go = () => {
    if (GA.want !== name) return;
    const s = c.createBufferSource(), g = c.createGain();
    s.buffer = GA.mbuf[key]; s.loop = true; g.gain.value = 0; s.connect(g); g.connect(GA.master); s.start();
    g.gain.linearRampToValueAtTime(MGAIN, c.currentTime + 0.6);
    if (out) { out.g.gain.cancelScheduledValues(c.currentTime); out.g.gain.setValueAtTime(out.g.gain.value, c.currentTime); out.g.gain.linearRampToValueAtTime(0, c.currentTime + 0.35); setTimeout(() => { try { out.s.stop(); } catch (e) { /* ended */ } }, 450); }
    gcur = { s, g, name }; cur = name;
  };
  cur = name;                                    // claim it so repeated calls do not start twice
  if (GA.mbuf[key]) return go();
  fetch(q(key)).then(r => r.arrayBuffer()).then(ab => new Promise((ok, no) => c.decodeAudioData(ab, ok, no)))
    .then(b => { GA.mbuf[key] = b; go(); }).catch(() => { GA.musicFail = true; cur = null; });
}
GA.stopMusic = ms => {
  cur = null;
  if (gcur) { const o = gcur, c = GA.ctx; gcur = null; o.g.gain.cancelScheduledValues(c.currentTime); o.g.gain.setValueAtTime(o.g.gain.value, c.currentTime); o.g.gain.linearRampToValueAtTime(0, c.currentTime + 0.3); setTimeout(() => { try { o.s.stop(); } catch (e) { /* ended */ } }, 400); }
  if (el && !el.paused) fade(0, ms || 300, () => el.pause());
};
// win / lose / evolve stingers: music ducks out, the stinger plays, music (GA.want) resumes after it
GA.stinger = name => {
  const b = GA.buf[STING[name]], c = GA.ctx;
  if (!sfxOn()) return;
  if (!b || !c) { const f = GA.synth[name === 'lose' ? 'ko' : 'lvl']; if (f) f(); return; }
  GA.stopMusic(250);
  const s = c.createBufferSource(), g = c.createGain();
  s.buffer = b; g.gain.value = clamp01(VOL['stinger_' + name] || 0.8); s.connect(g); g.connect(GA.master); s.start(c.currentTime + 0.12);
  holdUntil = performance.now() + (b.duration + 0.12) * 1000 - 400;
  s.onended = () => { if (GA.want) GA.music(GA.want); };
};
GA.setMusic = on => {
  GA.meta.music = !!on; GA.save();
  if (on) GA.music(GA.want); else GA.stopMusic(250);
};
GA.setVol = n => {
  const x = +n;
  GA.meta.vol = Number.isFinite(x) ? Math.max(0, Math.min(100, Math.round(x))) : 70; GA.save();
  if (GA.master) GA.master.gain.value = mgain();
  if (el && cur && !GAPLESS) {
    if (fadingIn) { el.volume = mvol(); fade(mvol, 80); }   // a fade-in was heading for the old volume
    else if (!fadeT) el.volume = mvol();
  }
};
GA.setSpeed = n => { GA.speed = n || 1; };       // call from game.js whenever FS.speed / meta.speed changes (1, 2, 4)

// first user gesture: resume the AudioContext, load the SFX, start the pending music (autoplay policy)
GA.wake = () => {
  if (GA.unlocked) return;
  GA.unlocked = true;
  const c = ctx(); if (c && c.state === 'suspended') c.resume();
  const p = GA.load('main');
  if (p) p.then(() => GA.load('v2'));          // sfx2/ loads in the background after the first pack
  for (const ev of ['pointerup', 'click', 'keydown', 'touchend']) removeEventListener(ev, GA.wake);
  if (GA.want) (GAPLESS && p ? p : Promise.resolve()).then(() => GA.music(GA.want));
};
for (const ev of ['pointerup', 'click', 'keydown', 'touchend']) addEventListener(ev, GA.wake, { passive: true });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (el) el.pause(); if (GA.ctx && GA.ctx.state === 'running') GA.ctx.suspend(); }
  else { if (GA.ctx) GA.ctx.resume(); if (el && cur && musicOn() && !GAPLESS) { const p = el.play(); if (p && p.catch) p.catch(() => {}); } }
});
window.GAUDIO = GA;
})();
