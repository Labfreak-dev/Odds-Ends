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
const vol = () => Math.max(0, Math.min(100, GA.meta && GA.meta.vol != null ? GA.meta.vol : 70)) / 100;
const base = f => f.split('/').pop();

function ctx() {
  if (GA.ctx) return GA.ctx;
  try {
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
    const c = new C(), comp = c.createDynamicsCompressor(), m = c.createGain();
    comp.threshold.value = -12; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.15;   // tames stacked hits
    m.gain.value = vol(); m.connect(comp); comp.connect(c.destination);
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
  for (const k in FILES) if ((k[0] === 'w' && k !== 'win') === (group === 'wilds')) names.push(...FILES[k]);
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
  if (LOW[name] && voices >= MAXV) return;
  last[name] = now;
  let i = files.length > 1 ? Math.floor(Math.random() * files.length) : 0;
  if (files.length > 1 && i === lastVar[name]) i = (i + 1) % files.length;
  lastVar[name] = i;
  const f = files[i], s = c.createBufferSource(), g = c.createGain();
  s.buffer = GA.buf[f];
  if (JITTER[name]) s.playbackRate.value = 1 - Math.random() * JITTER[name];   // 0.95-1.00 only: never pitched up
  g.gain.value = (VOL[base(f)] == null ? 1 : VOL[base(f)]) * (v == null ? 1 : v);
  const low = !!LOW[name]; s.connect(g); g.connect(GA.master); if (low) voices++;
  s.onended = () => { if (low) voices--; try { g.disconnect(); } catch (e) { /* gone */ } };
  s.start();
};

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
  s.buffer = b; g.gain.value = VOL['stinger_' + name] || 0.8; s.connect(g); g.connect(GA.master); s.start(c.currentTime + 0.12);
  holdUntil = performance.now() + (b.duration + 0.12) * 1000 - 400;
  s.onended = () => { if (GA.want) GA.music(GA.want); };
};
GA.setMusic = on => {
  GA.meta.music = !!on; GA.save();
  if (on) GA.music(GA.want); else GA.stopMusic(250);
};
GA.setVol = n => {
  GA.meta.vol = Math.max(0, Math.min(100, Math.round(n))); GA.save();
  if (GA.master) GA.master.gain.value = vol();
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
