/* =====================================================================
   FISHING REBUILD — the living scene and the real fight
   ---------------------------------------------------------------------
   This module OVERRIDES parts of the fisherman's dock. It is injected
   into the same script, after the original definitions: later `function`
   declarations win, so everything here replaces its namesake cleanly
   while the painting, the shop, the cast, the photos and the result flow
   stay byte-identical.

   What changes, and why:

   THE SCENE was a beautiful postcard — one painting, one light, forever
   noon. Liveliness is motion, light and surprise, so the rebuild adds:
   · a real clock: a full day passes in eight minutes, and the painting
     is colour-graded through dawn, day, golden hour, dusk and night
   · weather: clear, overcast, drizzle, fog, storm — with rain that rings
     the water, rolling fog, and lightning that whitens the whole sky
   · a sun and a moon that actually cross it, each laying a shimmer
     column on the water; stars that come out
   · ambient life: gulls that land, float and take off again; fish
     jumping in the distance; a boat crossing the horizon; dragonflies
     at golden hour; fireflies after dark; reeds that answer the wind
   · anticipation: a shadow slides under the bobber a beat before the
     bite, so the scene itself tells you to get ready

   THE FIGHT was a tap frenzy. Now it's a duel: HOLD to reel, RELEASE to
   give line. Each species archetype fights differently — darts, runs,
   dives, sulks, and (for the legends) leaps clear of the water — and the
   fish has stamina you wear down. Keep tension out of the red, don't
   leave the line slack, and reel when it tires. The whole fight core is
   a pure function so every archetype's landability is proven headlessly.
   ===================================================================== */

/* --------------------- 0 · SOUND ------------------------------------
   WebAudio over the uploaded SFX pack (FE_SFX data URIs). Buffers decode
   lazily, the context unlocks on the first pointer down, loops are
   declarative (the reel crank runs exactly while you hold), and every
   sound respects the mute chip. */
let feAC = null, feBuf = {}, feLoops = {}, feLastPlay = {};
function feAudioCtx(){
  if(!feAC){ try{ feAC = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} }
  return feAC;
}
function feAudioUnlock(){ const c = feAudioCtx(); if(c && c.state === "suspended") c.resume().catch(()=>{}); }
/* ---- SOUND SETTINGS (batch 117). The game's only audio path is this
   module, so the fishing chips used to mute the whole game. Now: the
   Settings menu owns master on/off and volume for effects and music
   (state.settings.sfxOff/musicOff/sfxVol/musicVol); the fishing chips and
   mixer are QUIET-ON-THE-WATER controls that apply only while the fishing
   tab is up. Effects run through a bus (lowpass + gentle compressor), the
   loud and bright samples carry trims, the bright ones an extra lowpass,
   and the pack/market keys a rate limit, so nothing barks or stacks. */
function feGlobalSfxOff(){ try{ return !!(state.settings && state.settings.sfxOff); }catch(e){ return false; } }
function feGlobalMusicOff(){ try{ return !!(state.settings && state.settings.musicOff); }catch(e){ return false; } }
function feGlobalVol(k, d){ try{ const v = state.settings && state.settings[k]; return v === undefined ? d : v; }catch(e){ return d; } }
function feInFishing(){ const t = document.getElementById("tab-fishing"); return !!t && t.style.display !== "none"; }
function feMuted(){ if(feGlobalSfxOff()) return true; try{ return feInFishing() && !!fshInv().sfxMute; }catch(e){ return false; } }
function feMusicMuted(){ if(feGlobalMusicOff()) return true; try{ return !!fshInv().musicMute; }catch(e){ return false; } }
const FE_SFX_TRIM = { treasure:.5, tension_hi:.5, bait:.4, breach:.5, backlash:.5, junk:.5, jump:.6, creak:.5, reward_good:.6,
  train:.5, hookset:.6, splash_big:.6, flop:.5, reel_loop:.6, tension_max:.7, reward_legend:.7, plunk:.7, snag:.7 };
const FE_SFX_GAP  = { treasure:.25, reward_good:.3, equip:.3, box_open:.3, perfect:.3, snag:.3, splash_small:.25, bait:.4, reward_common:.3, reward_rare:.3 };
const FE_SFX_SOFT = new Set(["bait","breach","backlash","junk","jump","creak","reward_good","tension_max","train","hookset","splash_big","land","reward_common","run"]);
let feBus = null;
let feVoices = 0;               /* one-shots sounding right now */
const FE_MAX_VOICES = 4;
function feSfxBus(){
  const c = feAudioCtx(); if(!c) return null;
  if(feBus) return feBus;
  try{
    /* batch 120: the bus is the last word on harshness. Everything not
       music runs through a rumble cut, a much darker lowpass than before
       (4.2kHz - the fizz that made every sample "jarring" lives above it),
       a gentle compressor to even out levels, then a fast limiter so no
       transient ever spikes, and a final trim. */
    const g = c.createGain(); g.gain.value = 1;
    const hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 110; hp.Q.value = 0.5;
    const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 4200; lp.Q.value = 0.5;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 14; comp.ratio.value = 3; comp.attack.value = 0.006; comp.release.value = 0.2;
    const lim = c.createDynamicsCompressor();
    lim.threshold.value = -6; lim.knee.value = 2; lim.ratio.value = 12; lim.attack.value = 0.001; lim.release.value = 0.09;
    /* Web Audio compressors add automatic make-up gain: the first cut of
       this bus came out LOUDER than the old one. Measured offline against
       the batch-117 chain, this trim lands peaks at ~37% (about -9dB) with
       a quarter to a third less energy above 4kHz. */
    const out = c.createGain(); out.gain.value = 0.5;
    g.connect(hp); hp.connect(lp); lp.connect(comp); comp.connect(lim); lim.connect(out); out.connect(c.destination);
    feBus = g;
  }catch(e){ feBus = null; }
  return feBus;
}
/* the Settings menu calls this after any change: volumes re-apply live,
   and a mute stops what is already playing */
function feSoundSettingsChanged(){
  try{
    feApplyVols();
    if(feMuted()) for(const k in feLoops){ if(!feLoops[k].isMus) feLoopStop(k); }
    if(feMusicMuted()) for(const k in feLoops){ if(feLoops[k].isMus) feLoopStop(k); }
  }catch(e){}
}
try{ window.oeSoundSettingsChanged = feSoundSettingsChanged; }catch(e){}   /* the node harness has no window */
function feBuffer(key){
  if(feBuf[key]) return Promise.resolve(feBuf[key] === "pending" ? null : feBuf[key]);
  const c = feAudioCtx();
  if(!c || typeof FE_SFX === "undefined" || !FE_SFX[key]) return Promise.resolve(null);
  feBuf[key] = "pending";
  /* base64 → bytes directly: no fetch(), so no origin/file:// dependency,
     and decodeAudioData gets both promise and old callback forms for
     maximum browser reach */
  let bytes;
  try{
    const b64 = FE_SFX[key].split(",")[1];
    const bin = atob(b64);
    bytes = new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) bytes[i] = bin.charCodeAt(i);
  }catch(e){ delete feBuf[key]; return Promise.resolve(null); }
  return new Promise(res=>{
    const done = buf => { feBuf[key] = buf; res(buf); };
    const fail = () => { delete feBuf[key]; res(null); };
    try{
      const p = c.decodeAudioData(bytes.buffer, done, fail);
      if(p && p.then) p.then(done).catch(fail);
    }catch(e){ fail(); }
  });
}
function feSfxVol(){
  const g = feGlobalVol("sfxVol", 0.7);
  try{ const v = fshInv().sfxVol; return g * (feInFishing() && v !== undefined ? v : 1); }catch(e){ return g; }
}
function feMusVol(){
  const g = feGlobalVol("musicVol", 0.8);
  try{ const v = fshInv().musicVol; return g * (v === undefined ? 1 : v); }catch(e){ return g; }
}
/* batch 126: sound EFFECTS are retired at the playtester's word ("if you
   can't make them good, remove them"). Every call site stays so the game
   reads the same; nothing plays. The beds - the two piano loops and the
   water - remain, on the music switch. */
const FE_BEDS = new Set(["music", "music_night", "amb_water"]);
function feSound(key, opt){
  return;
  opt = opt || {};
  if(feMuted()) return;
  /* rate limit on the wall clock - fshT only ticks while the water is up,
     and a fishing-clock gap froze every repeat outside the tab */
  const gap = opt.gap !== undefined ? opt.gap : (FE_SFX_GAP[key] !== undefined ? FE_SFX_GAP[key] : 0.12);
  if(gap){ const now = performance.now()/1000, last = feLastPlay[key]||-9; if(now - last < gap) return; feLastPlay[key] = now; }
  if(feVoices >= FE_MAX_VOICES) return;      /* a pile-up is noise, not information */
  const c = feAudioCtx(); if(!c) return;
  feBuffer(key).then(buf=>{
    if(!buf || feMuted() || feVoices >= FE_MAX_VOICES) return;
    const src = c.createBufferSource(); src.buffer = buf;
    /* a touch of pitch drift so a repeated sample never machine-guns */
    const rate = (opt.rate || 1) * (0.95 + Math.random()*0.1);
    src.playbackRate.value = rate;
    const peak = (opt.vol !== undefined ? opt.vol : 0.8) * (FE_SFX_TRIM[key] || 1) * feSfxVol();
    /* every one-shot wears an envelope: a 12ms fade-in kills the click at
       the front of a hard-cut sample, and a 90ms fade-out the one at the
       end - those clicks were most of what read as "jarring" (batch 120) */
    const g = c.createGain();
    const t0 = c.currentTime, dur = buf.duration / rate;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + 0.012);
    const fadeAt = Math.max(t0 + 0.02, t0 + dur - 0.09);
    g.gain.setValueAtTime(peak, fadeAt);
    g.gain.linearRampToValueAtTime(0, t0 + dur + 0.005);
    let tail = g;
    if(FE_SFX_SOFT.has(key)){ const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 3000; g.connect(lp); tail = lp; }
    src.connect(g); tail.connect(feSfxBus() || c.destination);
    feVoices++;
    src.onended = ()=>{ feVoices = Math.max(0, feVoices - 1); };
    src.start();
  }).catch(()=>{});
}
function feLoopStart(key, vol){
  if(!FE_BEDS.has(key)) return;            /* the reel loop and every other effect are retired */
  const isMus = true;                       /* every bed answers to the music switch */
  const muted = feMusicMuted();
  if(muted || feLoops[key]) return;
  const c = feAudioCtx(); if(!c) return;
  feLoops[key] = { pending:true };
  feBuffer(key).then(buf=>{
    if(!buf || !feLoops[key] || feLoops[key].src){ return; }
    const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
    const base = (vol !== undefined ? vol : 0.5) * (isMus ? 1 : 0.8);
    const g = c.createGain();
    /* loops swell in over a third of a second - a reel or a tension drone
       that snaps on at full level is a jolt every single cast (batch 120) */
    const target = base * (isMus ? feMusVol() : feSfxVol());
    g.gain.setValueAtTime(0, c.currentTime);
    g.gain.linearRampToValueAtTime(target, c.currentTime + 0.35);
    src.connect(g); g.connect(isMus ? c.destination : (feSfxBus() || c.destination)); src.start();
    feLoops[key] = { src, g, base, isMus };
  }).catch(()=>{ delete feLoops[key]; });
}
function feLoopStop(key){
  const l = feLoops[key]; if(!l) return;
  delete feLoops[key];
  if(l.src){
    try{
      const c = feAudioCtx();
      if(c && l.g){
        l.g.gain.cancelScheduledValues(c.currentTime);
        l.g.gain.setValueAtTime(l.g.gain.value, c.currentTime);
        l.g.gain.linearRampToValueAtTime(0, c.currentTime + 0.25);
        l.src.stop(c.currentTime + 0.27);
      } else l.src.stop();
    }catch(e){ try{ l.src.stop(); }catch(e2){} }
  }
}
function feAllLoopsStop(){ for(const k in feLoops) feLoopStop(k); }
function feApplyVols(){
  for(const k in feLoops){
    const l = feLoops[k];
    if(l && l.g) try{ const c = feAudioCtx(); const v = (l.base||0.5) * (l.isMus ? feMusVol() : feSfxVol());
      if(c){ l.g.gain.cancelScheduledValues(c.currentTime); l.g.gain.setValueAtTime(l.g.gain.value, c.currentTime); l.g.gain.linearRampToValueAtTime(v, c.currentTime + 0.15); }
      else l.g.gain.value = v; }catch(e){}
  }
}

/* ------------------------- 1 · THE CLOCK ---------------------------- */
const FE_DAY_SECONDS = 480;              // one full day in eight minutes
let feEnv = null;

function feEnvInit(){
  const inv = fshInv();
  if(!inv.env) inv.env = { hour: 9.5, weather: "clear", weatherT: 70, blend: 1, prev: "clear" };
  feEnv = inv.env;
  if(feEnv.blend === undefined){ feEnv.blend = 1; feEnv.prev = feEnv.weather; }
}

/* Weather is a small Markov machine. Storms are rare, arrive out of
   overcast rather than from nowhere, and always calm back down. */
const FE_WEATHER_NEXT = {
  clear:    [["clear",2.4],["overcast",3],["fog",1.9],["drizzle",1.7]],
  overcast: [["clear",2.2],["drizzle",2.8],["storm",1.9],["overcast",2]],
  drizzle:  [["overcast",3],["clear",2],["storm",1],["drizzle",1.5]],
  fog:      [["clear",4],["overcast",2],["fog",1]],
  storm:    [["drizzle",4],["overcast",3]],
};
function fePickWeather(cur, rnd){
  const opts = FE_WEATHER_NEXT[cur] || FE_WEATHER_NEXT.clear;
  const total = opts.reduce((a,o)=>a+o[1],0);
  let r = (rnd===undefined ? Math.random() : rnd) * total;
  for(const [w,wt] of opts){ if(r < wt) return w; r -= wt; }
  return "clear";
}
function feEnvTick(dt){
  if(!feEnv) return;
  const h0 = feEnv.hour;
  feEnv.hour = (feEnv.hour + dt * 24 / FE_DAY_SECONDS) % 24;
  if(feEnv.hour < h0 && typeof fshInv === "function"){
    try{ const inv = feBossState(); inv.dayN++; saveState(); }catch(e){}
  }
  feEnv.weatherT -= dt;
  if(feEnv.blend < 1) feEnv.blend = Math.min(1, feEnv.blend + dt / 6);
  if(feEnv.weatherT <= 0){
    feEnv.prev = feEnv.weather;
    feEnv.weather = fePickWeather(feEnv.weather);
    feEnv.weatherT = 55 + Math.random() * 85;
    feEnv.blend = feEnv.weather === feEnv.prev ? 1 : 0;
  }
}

/* ------------------------ 2 · THE PALETTE ---------------------------
   Pure: (hour, weather) -> every number the grade pass needs. Keyframes
   around the clock, circularly interpolated, then weather-modified. The
   tint multiplies the whole painted scene, which is how one bitmap can
   be dawn, noon and midnight without being repainted. */
const FE_KEYS = [
  //  h     tint (multiply rgb + strength)      warm overlay rgba          stars moon sun  fog
  { h: 0.0, tint:[ 46, 68,126,0.78], warm:[255,140, 60,0.00], stars:1.0, moon:1.0, sun:0.0, fog:0.10 },
  { h: 4.0, tint:[ 54, 76,132,0.72], warm:[255,140, 60,0.00], stars:0.9, moon:0.8, sun:0.0, fog:0.16 },
  { h: 5.5, tint:[150,120,150,0.30], warm:[255,120, 90,0.16], stars:0.35,moon:0.3, sun:0.15,fog:0.22 },
  { h: 7.0, tint:[235,205,190,0.10], warm:[255,160, 90,0.14], stars:0.0, moon:0.0, sun:0.5, fog:0.14 },
  { h:10.0, tint:[255,255,255,0.00], warm:[255,200,120,0.00], stars:0.0, moon:0.0, sun:1.0, fog:0.02 },
  { h:15.5, tint:[255,255,255,0.00], warm:[255,200,120,0.00], stars:0.0, moon:0.0, sun:1.0, fog:0.02 },
  { h:17.5, tint:[255,225,190,0.08], warm:[255,170, 70,0.14], stars:0.0, moon:0.0, sun:0.85,fog:0.04 },
  { h:19.0, tint:[225,155,135,0.22], warm:[255,120, 70,0.26], stars:0.1, moon:0.1, sun:0.45,fog:0.07 },
  { h:20.2, tint:[140,110,160,0.40], warm:[250, 90, 90,0.16], stars:0.5, moon:0.5, sun:0.1, fog:0.10 },
  { h:21.5, tint:[ 52, 74,130,0.74], warm:[255,140, 60,0.00], stars:0.9, moon:0.9, sun:0.0, fog:0.10 },
  { h:24.0, tint:[ 46, 68,126,0.78], warm:[255,140, 60,0.00], stars:1.0, moon:1.0, sun:0.0, fog:0.10 },
];
function feLerp(a,b,k){ return a + (b-a)*k; }
function feBasePalette(hour){
  let a = FE_KEYS[0], b = FE_KEYS[FE_KEYS.length-1];
  for(let i=0;i<FE_KEYS.length-1;i++){
    if(hour >= FE_KEYS[i].h && hour <= FE_KEYS[i+1].h){ a = FE_KEYS[i]; b = FE_KEYS[i+1]; break; }
  }
  const k = b.h === a.h ? 0 : (hour - a.h)/(b.h - a.h);
  const mix = (x,y)=>feLerp(x,y,k);
  return {
    tint:[mix(a.tint[0],b.tint[0]), mix(a.tint[1],b.tint[1]), mix(a.tint[2],b.tint[2]), mix(a.tint[3],b.tint[3])],
    warm:[mix(a.warm[0],b.warm[0]), mix(a.warm[1],b.warm[1]), mix(a.warm[2],b.warm[2]), mix(a.warm[3],b.warm[3])],
    stars:mix(a.stars,b.stars), moon:mix(a.moon,b.moon), sun:mix(a.sun,b.sun), fog:mix(a.fog,b.fog),
  };
}
function feWeatherMod(p, weather){
  const q = { tint:p.tint.slice(), warm:p.warm.slice(), stars:p.stars, moon:p.moon, sun:p.sun,
              fog:p.fog, rain:0, cloudX:1, dark:0 };
  if(weather === "overcast"){ q.sun*=0.25; q.moon*=0.5; q.stars*=0.15; q.warm[3]*=0.3;
    q.tint=[q.tint[0]*0.82, q.tint[1]*0.85, q.tint[2]*0.88, Math.max(q.tint[3],0.16)]; q.cloudX=1.8; q.fog+=0.05; }
  else if(weather === "drizzle"){ q.sun*=0.18; q.moon*=0.4; q.stars*=0.1; q.warm[3]*=0.2;
    q.tint=[q.tint[0]*0.78, q.tint[1]*0.83, q.tint[2]*0.9, Math.max(q.tint[3],0.2)]; q.rain=0.45; q.cloudX=2.2; q.fog+=0.08; }
  else if(weather === "storm"){ q.sun=0; q.moon*=0.15; q.stars=0; q.warm[3]=0;
    q.tint=[62,72,96, Math.max(q.tint[3],0.42)]; q.rain=1; q.cloudX=3.4; q.fog+=0.10; q.dark=0.22; }
  else if(weather === "fog"){ q.sun*=0.45; q.moon*=0.5; q.stars*=0.3; q.fog=Math.max(q.fog,0.5); q.cloudX=0.7; }
  return q;
}
function fePalette(hour, weather, prevWeather, blend){
  const cur = feWeatherMod(feBasePalette(hour), weather);
  if(blend === undefined || blend >= 1 || !prevWeather || prevWeather === weather) return cur;
  const old = feWeatherMod(feBasePalette(hour), prevWeather);
  const out = { tint:[], warm:[] };
  for(let i=0;i<4;i++){ out.tint[i]=feLerp(old.tint[i],cur.tint[i],blend); out.warm[i]=feLerp(old.warm[i],cur.warm[i],blend); }
  for(const k of ["stars","moon","sun","fog","rain","cloudX","dark"]) out[k]=feLerp(old[k],cur[k],blend);
  return out;
}
/* Sun and moon ride the same arc twelve hours apart. */
function feSunPos(hour){
  const t = (hour - 6) / 12;               // 0 at 6:00, 1 at 18:00
  /* the tall sky runs to -292 — sun and moon arc through it, clearing
     the painted hills except at rise and set */
  return { x: 60 + t * (FSH_W - 120), y: 130 - Math.sin(Math.max(0,Math.min(1,t)) * Math.PI) * 300, up: t>-0.06 && t<1.06,
           edge: Math.max(0, Math.min(1, Math.min((t+0.06)/0.18, (1.06-t)/0.18))) };
}
function feMoonPos(hour){ return feSunPos((hour + 12) % 24); }

/* ------------------- 3 · AMBIENT LIFE & WEATHER FX ------------------ */
let feStars=null, feRain=null, feRings=null, feAgents=null, feWind=null, feFlash=0, feFlashNext=8;

function feInitAmbient(){
  const rnd = (n)=>{ const v=Math.sin(n*127.1)*43758.5453; return v-Math.floor(v); };
  /* stars keep to the sky: the painted ridge line was sampled from the
     painting itself at build time (FE_RIDGE, one point per 8px) */
  const ridgeAt = x => feRidgeBand(x);
  const off = feBandOff();
  feStars = Array.from({length:110}, (_,i)=>{
    const x = -100 + rnd(i)*(FSH_W+200);   /* a little past both edges: the band may sit shifted sideways */
    const ceil = ridgeAt(Math.max(0, Math.min(FSH_W, x))) - 12;
    /* the sky runs FE_OFF (plus this water's offset) above the band — stars fill all of it */
    return { x, y: -off + 6 + rnd(i+300)*Math.max(8, ceil + off - 6), s: 0.8+rnd(i+600)*1.3, ph: rnd(i+900)*6.28 };
  });
  feRain = Array.from({length:230}, (_,i)=>({ x: -100 + rnd(i+50)*(FSH_W+200), y: -off + rnd(i+80)*1200, sp: 340+rnd(i+30)*160 }));
  feRings = [];
  feWind = { base: 0.5, gust: 0, gustT: 3 };
  const dressGulls = (typeof feSpot === "function" && feSpot().dress && feSpot().dress.gulls) || 3;
  feAgents = {
    gulls: [
      { st:"fly", x: 90, y: 80, s:1.15, spd:13, ph:0.2, t: 8+Math.random()*10 },
      { st:"fly", x:300, y:112, s:0.9,  spd:10, ph:2.1, t: 5+Math.random()*10 },
      { st:"float", x:470, y:FSH_HORIZON+26, s:0.85, spd:0, ph:4.0, t: 6+Math.random()*8 },
    ].slice(0, dressGulls),
    jumpers: [], jumpNext: 2.5,
    boat: null, boatNext: 45 + Math.random()*70,
    flies: Array.from({length:8},(_,i)=>({ x: 40+rnd(i+40)*140, y: 250+rnd(i+70)*60, ph: rnd(i+11)*6.28 })),
    dragons: [ { x: 560, y: 300, tx:560, ty:300, t:0 }, { x: 610, y: 285, tx:610, ty:285, t:0 } ],
    reeds: (()=>{
      const d = (typeof feSpot === "function" && feSpot().dress) || { reeds:8 };
      return Array.from({length:d.reeds||0},(_,i)=>{
        const right = d.both && i%2;
        const x = right ? FSH_W-14-(i>>1)*12-rnd(i)*7 : 10+(i>>1)*12+rnd(i)*7;
        return { x, h: 74+rnd(i+8)*46, ph: rnd(i+20)*6.28 };
      });
    })(),
    lilies: Array.from({length:6},(_,i)=>({
      x: (i<3 ? 40+i*46+rnd(i+31)*20 : FSH_W-60-(i-3)*44-rnd(i+37)*20),
      y: FSH_SURF_END-10-rnd(i+41)*20, r: 8+rnd(i+51)*6, ph: rnd(i+61)*6.28,
      flower: rnd(i+71) < 0.35 })),
    wisps: Array.from({length:3},(_,i)=>({ ph: rnd(i+81)*6.28, x0: 140+i*210+rnd(i+91)*60 })),
  };
}
function feAmbientTick(dt, pal){
  const W = feWind;
  W.gustT -= dt;
  if(W.gustT <= 0){ W.gust = 0.4 + Math.random()*1.4 + pal.rain*1.2; W.gustT = 2.5 + Math.random()*4.5; }
  W.gust *= Math.pow(0.6, dt);
  W.cur = W.base + W.gust + pal.rain*0.8;

  /* gulls: fly a while, splash down, float on the swell, take off again.
     They roost at night — the dark belongs to the fireflies. */
  const daylight = pal.sun > 0.12 || pal.moon < 0.4;
  for(const g of feAgents.gulls){
    g.t -= dt;
    if(g.st === "fly"){
      g.x += g.spd*dt; g.ph += dt*6;
      g.y += Math.sin(g.ph*0.6)*4*dt;
      if(g.x > FSH_W+30){ g.x = -30; g.y = 60+Math.random()*70; }
      if(g.t <= 0 && daylight && Math.random()<0.6 && g.x>60 && g.x<FSH_W-120){
        g.st="dive"; g.ty = FSH_HORIZON + 18 + Math.random()*26;
      } else if(g.t <= 0){ g.t = 6+Math.random()*9; }
    } else if(g.st === "dive"){
      g.x += g.spd*0.6*dt; g.y += 46*dt;
      if(g.y >= g.ty){ g.y=g.ty; g.st="float"; g.t=5+Math.random()*8;
        feRings.push({x:g.x,y:g.y+4,t:0,max:14}); }
    } else if(g.st === "float"){
      g.x += 2*dt; g.ph += dt;
      if(g.t <= 0 || !daylight){ g.st="takeoff"; g.vy=-30; feRings.push({x:g.x,y:g.y+4,t:0,max:10}); }
    } else if(g.st === "takeoff"){
      g.y += g.vy*dt; g.vy -= 40*dt; g.x += 10*dt;
      if(g.y < 70+Math.random()*50){ g.st="fly"; g.spd=9+Math.random()*5; g.t=8+Math.random()*10; }
    }
    if(!daylight && g.st==="fly" && g.x > FSH_W){ g.x=-9999; g.t=99; }   // roosted till morning
    if(daylight && g.x < -1000){ g.x=-30; g.st="fly"; g.t=8; }
  }
  /* distant jumpers — busiest at dawn and dusk, exactly like real water */
  feAgents.gullCry = (feAgents.gullCry===undefined ? 20+Math.random()*35 : feAgents.gullCry) - dt;
  if(feAgents.gullCry <= 0){
    feAgents.gullCry = 25 + Math.random()*40;
    if(fshTabActive && feAgents.gulls.length) feSound("gull", { vol: 0.09 });
  }
  const dress = feSpot().dress || {};
  feAgents.jumpNext -= dt * ((pal.sun>0.2&&pal.sun<0.8)||pal.moon>0.6 ? 2.1 : 1) * (dress.jumpM||1);
  if(feAgents.jumpNext <= 0){
    feAgents.jumpNext = 3.5 + Math.random()*6;
    const x = 80 + Math.random()*(FSH_W-160);
    const y = FSH_HORIZON + 14 + Math.random()*40;
    const big = dress.big;
    const r = Math.random();
    const spr = big ? (r<0.4 ? "shark"+(1+(Math.random()*3|0)) : r<0.55 ? "whale"+(1+(Math.random()*2|0)) : "fish"+(1+(Math.random()*3|0)))
                    : (r<0.12 ? "shark"+(1+(Math.random()*2|0)) : "fish"+(1+(Math.random()*3|0)));
    feAgents.jumpers.push({ x, y, t:0, dir: Math.random()<0.5?-1:1, s: (0.7+Math.random()*0.7)*(big?1.25:1), spr });
    if(fshTabActive) feSound("ripple", { vol: 0.14, gap: 2.5 });
    feRings.push({x, y:y+5, t:-0.1, max:10});
  }
  for(let i=feAgents.jumpers.length-1;i>=0;i--){
    const j=feAgents.jumpers[i]; j.t += dt;
    if(j.t > 0.85){ feAgents.jumpers.splice(i,1); feRings.push({x:j.x+j.dir*16, y:j.y+5, t:0, max:16}); }
  }
  /* the dolphin breach — every few minutes, blink and you miss it */
  feAgents.breachNext = (feAgents.breachNext===undefined ? 70+Math.random()*120 : feAgents.breachNext) - dt;
  if(!feAgents.breach && feAgents.breachNext <= 0){
    feAgents.breach = { x: 120+Math.random()*(FSH_W-260), y: FSH_HORIZON+22+Math.random()*24,
                        t:0, dir: Math.random()<0.5?-1:1, spr: "dolphin"+(2+(Math.random()*2|0)) };
    feRings.push({x:feAgents.breach.x, y:feAgents.breach.y+6, t:0, max:12});
    if(fshTabActive) feSound("breach", { vol: 0.3 });
    feAgents.breachNext = 150 + Math.random()*160;
  }
  if(feAgents.breach){
    feAgents.breach.t += dt;
    if(feAgents.breach.t > 1.35){
      feRings.push({x:feAgents.breach.x+feAgents.breach.dir*78, y:feAgents.breach.y+6, t:0, max:18});
      feAgents.breach = null;
    }
  }
  /* the boat */
  feAgents.boatNext -= dt;
  if(!feAgents.boat && feAgents.boatNext <= 0){
    const dir = Math.random()<0.5?1:-1;
    feAgents.boat = { x: dir>0?-50:FSH_W+50, dir, y: FSH_HORIZON+6 };
    feAgents.boatNext = 90 + Math.random()*90;
  }
  if(feAgents.boat){
    feAgents.boat.x += feAgents.boat.dir * 9 * dt;
    if(feAgents.boat.x < -60 || feAgents.boat.x > FSH_W+60) feAgents.boat = null;
  }
  /* dragonflies hover; they only come out for the golden light */
  for(const d of feAgents.dragons){
    d.t -= dt * (dress.dragonM||1);
    if(d.t<=0){ d.t=0.5+Math.random(); d.tx=520+Math.random()*100; d.ty=270+Math.random()*50; }
    d.x += (d.tx-d.x)*Math.min(1,dt*5); d.y += (d.ty-d.y)*Math.min(1,dt*5);
  }
  /* rain rings + spreading rings decay */
  if(pal.rain > 0){
    const drops = Math.floor(pal.rain * 3 + Math.random()*2);
    for(let i=0;i<drops;i++){
      if(Math.random() < 0.5) feRings.push({ x: Math.random()*FSH_W, y: FSH_HORIZON+6+Math.random()*(FSH_SURF_END-FSH_HORIZON-8), t:0, max:5+Math.random()*4 });
    }
  }
  for(let i=feRings.length-1;i>=0;i--){ feRings[i].t += dt; if(feRings[i].t > 1.1) feRings.splice(i,1); }
  /* lightning */
  if(pal.rain >= 0.9){
    feFlashNext -= dt;
    if(feFlashNext <= 0){ feFlash = 0.9; feFlashNext = 7 + Math.random()*14; }
  }
  feFlash = Math.max(0, feFlash - dt*2.4);
  feVibeTick(dt);
  const rc = document.getElementById("feRecall");
  if(rc){
    const want = (typeof fsh !== "undefined" && fsh && fsh.phase === "waiting") ? "" : "none";
    if(rc.style.display !== want) rc.style.display = want;
  }
}
/* The rod buzzes: a tap on the bite, then pulses through the fight that
   grow longer and closer together the longer the fish stays on. */
/* the marksman's target: a glowing ring on the water each cast — land
   the bobber inside for an instant bite and a payout kiss */
let feAim = null;
function feAimNew(){
  feAim = { x: 430 + Math.random()*280, y: 330 + Math.random()*120, ph: Math.random()*6 };
}
let feVibePrev = null, feVibeAcc = 0, feFightT = 0;
function feCanVibe(){
  try{ return !fshInv().vibeOff && typeof navigator !== "undefined" && !!navigator.vibrate; }catch(e){ return false; }
}
function feVibeTick(dt){
  const ph = (typeof fsh !== "undefined" && fsh) ? fsh.phase : null;
  if(ph !== feVibePrev){
    if(ph === "idle") feAimNew();
    if(ph === "waiting"){
      const inv3 = fshInv();
      if((inv3.chumCasts||0) > 0){
        inv3.chumCasts--;
        fsh.chummed = true;
        fsh.waitMs *= 0.45;
      }
    }
    if(ph === "waiting" && feAim && fsh && Math.hypot(fsh.targetX - feAim.x, fsh.targetY - feAim.y) < (((state.upgrades && state.upgrades.wideRing)||0) ? 50 : 36)){
      fsh.aimHit = true;
      fsh.waitMs = Math.min(fsh.waitMs, 700);
      showToast("🎯 Bullseye — something saw it land");
      fbSfxSafe("perfect", 0.35);
    }
    if(ph === "bite" && feCanVibe()) try{ navigator.vibrate(35); }catch(e){}
    if(feVibePrev === "reeling"){ feFightT = 0; feVibeAcc = 0;
      if(feCanVibe()) try{ navigator.vibrate(0); }catch(e){} }   /* the line goes quiet */
    feVibePrev = ph;
  }
  if(ph === "reeling"){
    feFightT += dt; feVibeAcc += dt;
    /* one unbroken tremble, refreshed in overlapping windows; the duty
       cycle climbs with the fight so the rod feels alive in the hand */
    const gap = 0.24;
    if(feVibeAcc >= gap){
      feVibeAcc = 0;
      if(feCanVibe()){
        const p = Math.min(1, feFightT / 14);              /* full fury by 14s on the hook */
        const duty = 0.32 + 0.63 * p;
        const on = Math.round(300 * duty), off = Math.max(8, 300 - on);
        try{ navigator.vibrate([on, off]); }catch(e){}     /* next window lands before this one ends */
      }
    }
  }
}

/* ---- the grade pass: everything the clock and the sky do to the painting ---- */
function feDrawGrade(g, pal, hour){
  /* celestial bodies go UNDER the tint so they belong to the scene */
  const sun = feSunPos(hour), moon = feMoonPos(hour);
  if(pal.sun > 0.02 && sun.up && feBgSpot === "lake"){   /* the paintings carry their own light */
    const r = g.createRadialGradient(sun.x, sun.y, 2, sun.x, sun.y, 90);
    r.addColorStop(0, `rgba(255,240,200,${0.5*pal.sun})`);
    r.addColorStop(0.25, `rgba(255,220,160,${0.22*pal.sun})`);
    r.addColorStop(1, "rgba(255,220,160,0)");
    g.save(); g.globalAlpha = sun.edge; 
    g.fillStyle = r; g.fillRect(sun.x-90, sun.y-90, 180, 180);
    g.restore();
  }
  /* (moon drawn after the tint, below, so night can't dim it) */
  /* each water has its own cast of light laid over the day's */
  const feDress = feSpot().dress || {};
  if(feDress.tint){
    g.globalCompositeOperation = "multiply";
    g.globalAlpha = feDress.tint[3];
    g.fillStyle = `rgb(${feDress.tint[0]},${feDress.tint[1]},${feDress.tint[2]})`;
    g.fillRect(-FSH_W,-feBandOff(),3*FSH_W,1200);
    g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
  }
  /* the multiply tint — the single line that turns noon into midnight */
  if(pal.tint[3] > 0.004){
    g.globalCompositeOperation = "multiply";
    g.globalAlpha = Math.min(0.9, pal.tint[3]);
    g.fillStyle = `rgb(${pal.tint[0]|0},${pal.tint[1]|0},${pal.tint[2]|0})`;
    g.fillRect(-FSH_W,-feBandOff(),3*FSH_W,1200);
    g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
  }
  if(pal.dark > 0){ g.fillStyle = `rgba(10,14,26,${pal.dark})`; g.fillRect(-FSH_W,-feBandOff(),3*FSH_W,1200); }
  /* the other paintings were painted in daylight (the Mark excepted) and
     keep a bright sky under the night tint - a deeper blue-black wash
     scaled by the stars takes them down to night */
  const feNight = feNightAmt();
  if(feBgSpot !== "lake" && feBgSpot !== "midnight" && feNight > 0.01){
    g.fillStyle = `rgba(6,8,24,${(0.45*feNight).toFixed(3)})`; g.fillRect(-FSH_W,-feBandOff(),3*FSH_W,1200);
  }
  /* warm hour overlay, biased to the sky and the water's far band */
  if(pal.warm[3] > 0.004){
    /* the warm wash starts at the true top of the tall sky — starting at
       the band's y0 stamped a hard seam across the dusk */
    const wg = g.createLinearGradient(0,-feBandOff(),0,FSH_SURF_END);
    wg.addColorStop(0, `rgba(${pal.warm[0]|0},${pal.warm[1]|0},${pal.warm[2]|0},${pal.warm[3]})`);
    wg.addColorStop(0.55, `rgba(${pal.warm[0]|0},${pal.warm[1]|0},${pal.warm[2]|0},${pal.warm[3]*0.55})`);
    wg.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = wg; g.fillRect(-FSH_W,-feBandOff(),3*FSH_W,FSH_SURF_END+feBandOff());
  }
  const feRidgeAt = x => feRidgeBand(x);
  const moonOcc = Math.max(0, Math.min(1, (feRidgeAt(moon.x) - 6 - moon.y) / 26));
  if(pal.moon > 0.05 && moon.up && moonOcc > 0.02 && feBgSpot !== "midnight" && feBgSpot === "lake"){   /* the painted skies carry their own night */
    g.save(); g.globalAlpha = moonOcc * (moon.edge !== undefined ? moon.edge : 1);
    /* moonlight lies on the water as a soft glowing pool near the
       horizon, breaking into scattered glints that widen and thin as
       they come toward the shore — a reflection, not a beam */
    const edgeA = moonOcc * (moon.edge !== undefined ? moon.edge : 1);
    const pool = g.createRadialGradient(moon.x, 268, 6, moon.x, 268, 130);
    pool.addColorStop(0, `rgba(222,236,255,${0.20*pal.moon})`);
    pool.addColorStop(0.5, `rgba(222,236,255,${0.08*pal.moon})`);
    pool.addColorStop(1, "rgba(222,236,255,0)");
    g.save(); g.translate(moon.x, 268); g.scale(1, 0.22); g.translate(-moon.x, -268);
    g.fillStyle = pool; g.fillRect(moon.x-140, 138, 280, 260);
    g.restore();
    for(let gi=0; gi<26; gi++){
      const depth = gi/26;
      const gy = 258 + depth*560 + Math.sin(fshT*0.6 + gi*2.7)*6;
      const spread = 26 + depth*150;
      const gx = moon.x + Math.sin(gi*37.7 + fshT*0.25)*spread;
      const gw = (7 + (gi*13)%34) * (0.7 + depth*0.9);
      const tw = 0.5 + 0.5*Math.sin(fshT*(0.9 + (gi%5)*0.14) + gi*1.9);
      g.globalAlpha = edgeA * pal.moon * (0.16 * (1-depth*0.6)) * tw;
      g.fillStyle = "#e8f2ff";
      g.fillRect(gx - gw/2, gy, gw, 1.4 + depth*0.8);
    }
    g.globalAlpha = edgeA;
    const r = g.createRadialGradient(moon.x, moon.y, 8, moon.x, moon.y, 150);
    r.addColorStop(0, `rgba(210,225,255,${0.34*pal.moon})`); r.addColorStop(1, "rgba(210,225,255,0)");
    g.fillStyle = r; g.fillRect(moon.x-150, moon.y-150, 300, 300);
    g.globalAlpha = pal.moon;
    g.fillStyle = "#eef2fa"; g.beginPath(); g.arc(moon.x, moon.y, 30, 0, 7); g.fill();
    g.fillStyle = "rgba(205,216,232,0.5)";
    g.beginPath(); g.arc(moon.x-9, moon.y-6, 5.5, 0, 7); g.fill();
    g.beginPath(); g.arc(moon.x+8, moon.y+9, 4, 0, 7); g.fill();
    g.beginPath(); g.arc(moon.x+11, moon.y-8, 3, 0, 7); g.fill();
    g.restore();
    g.fillStyle = "rgba(205,214,232,0.5)";                    // maria, faint
    g.beginPath(); g.arc(moon.x-3, moon.y+2, 3, 0, 7); g.arc(moon.x+3.5, moon.y-2.5, 2.2, 0, 7); g.fill();
    g.globalAlpha = 1;
  }
  /* stars twinkle above the ridge line only */
  const starA = Math.min(1, pal.stars * (feDress.starM||1));
  if(starA > 0.03){
    for(const s of feStars){
      const tw = 0.55 + 0.45*Math.sin(fshT*1.7 + s.ph);
      g.globalAlpha = starA * tw * 0.9;
      g.fillStyle = "#dfe7ff"; g.fillRect(s.x, s.y, s.s, s.s);
    }
    g.globalAlpha = 1;
  }
  /* shimmer column under whichever light owns the sky */
  const lord = pal.sun >= pal.moon ? {p:sun, a:pal.sun*0.5, c:"255,235,190"} : {p:moon, a:pal.moon*0.42, c:"205,220,250"};
  if(lord.a > 0.03 && lord.p.up && pal.rain < 0.6){
    for(let i=0;i<12;i++){
      const y = FSH_HORIZON + 8 + i*((FSH_SURF_END-FSH_HORIZON-12)/12);
      const sway = Math.sin(fshT*1.4 + i*1.7)*8;
      const w = 16 + i*4.5;
      g.globalAlpha = lord.a * (1 - i/16) * (0.5+0.5*Math.sin(fshT*2.2+i));
      g.fillStyle = `rgba(${lord.c},0.5)`;
      g.fillRect(lord.p.x - w/2 + sway, y, w, 2.2);
    }
    g.globalAlpha = 1;
  }
  /* fog lies on the far water in slow bands */
  const fogA = Math.min(0.85, pal.fog * (feDress.fogM||1));
  if(fogA > 0.05){
    for(let i=0;i<3;i++){
      const y = FSH_HORIZON - 14 + i*16;
      const fg = g.createLinearGradient(0, y-14, 0, y+18);
      fg.addColorStop(0,"rgba(200,212,224,0)");
      fg.addColorStop(0.5,`rgba(202,214,226,${fogA*(0.5-i*0.11)})`);
      fg.addColorStop(1,"rgba(200,212,224,0)");
      g.fillStyle = fg;
      const off = Math.sin(fshT*0.13 + i*2.4)*30;
      g.fillRect(-40+off, y-14, FSH_W+80, 32);
    }
  }
  /* rain: streaks angled by the wind, thin and pale */
  if(pal.rain > 0.03){
    g.strokeStyle = `rgba(200,215,235,${0.28*pal.rain})`; g.lineWidth = 1;
    const slant = (feWind ? feWind.cur : 1) * 3;
    g.beginPath();
    const n = Math.floor(feRain.length * pal.rain);
    for(let i=0;i<n;i++){
      const d = feRain[i];
      d.y += d.sp*0.016; d.x -= slant*0.6;
      if(d.y > 1200-feBandOff()){ d.y = -feBandOff()-8; d.x = -100 + Math.random()*(FSH_W+200); }
      if(d.x < -4) d.x += FSH_W;
      g.moveTo(d.x, d.y); g.lineTo(d.x - slant, d.y + 9 + pal.rain*4);
    }
    g.stroke();
  }
  if(feFlash > 0.02){ g.fillStyle = `rgba(235,242,255,${feFlash*0.55})`; g.fillRect(-FSH_W,-feBandOff(),3*FSH_W,1200); }
  /* a caught lantern earns its keep from dusk on — big, warm, alive */
  if(pal.sun < 0.35 && feProps().lantern > 0){
    const P = FE_PROPS.find(p=>p.key==="lantern");
    const dark = 1 - pal.sun/0.35;
    const flick = 0.85 + 0.15*Math.sin(fshT*7.3) * Math.sin(fshT*3.1);
    const cy = 330 - 15, R = (44 + Math.min(7, feProps().lantern)*3) * flick;
    const gl = g.createRadialGradient(P.x, cy, 2, P.x, cy, R);
    gl.addColorStop(0, `rgba(255,214,130,${0.55*dark})`);
    gl.addColorStop(0.4, `rgba(255,190,100,${0.26*dark})`);
    gl.addColorStop(1, "rgba(255,190,100,0)");
    g.fillStyle = gl; g.fillRect(P.x-R, cy-R, R*2, R*2);
    /* warm pool on the planks */
    g.globalAlpha = 0.3*dark*flick;
    g.fillStyle = "#ffce78";
    g.beginPath(); g.ellipse(P.x, 330, 26, 5, 0, 0, 7); g.fill();
    g.globalAlpha = 1;
    /* the flame itself, over the tint */
    g.globalAlpha = dark;
    g.fillStyle = "#ffe9b0";
    g.beginPath(); g.arc(P.x, cy, 2.4*flick, 0, 7); g.fill();
    g.globalAlpha = 1;
    /* sparks drifting up, deep at night */
    if(pal.stars > 0.3){
      for(let i=0;i<3;i++){
        const ph = (fshT*0.45 + i*0.37) % 1;
        g.globalAlpha = (1-ph) * 0.6 * dark;
        g.fillStyle = "#ffd88f";
        g.beginPath();
        g.arc(P.x + Math.sin((fshT+i*9)*2.1)*4, cy - 6 - ph*22, 1.1, 0, 7);
        g.fill();
      }
      g.globalAlpha = 1;
    }
  }
}

function feDrawAmbient(g, pal){
  /* spreading rings — rain, jumpers, landings all share them */
  for(const r of feRings){
    if(r.t < 0) continue;
    const k = r.t/1.1;
    g.globalAlpha = (1-k)*0.5;
    g.strokeStyle = "#dfe9f2"; g.lineWidth = 1;
    g.beginPath(); g.ellipse(r.x, r.y, r.max*k+2, (r.max*k+2)*0.32, 0, 0, 7); g.stroke();
  }
  g.globalAlpha = 1;
  /* jumping fish: the real sprites now, always nose-first. Source art
     faces LEFT, so rightward travel flips; the leap rotates nose-up on
     the way out and nose-down on re-entry. */
  for(const j of feAgents.jumpers){
    const k = j.t/0.85;
    const x = j.x + j.dir * k * 32 * j.s;
    const y = j.y - Math.sin(k*Math.PI) * 26 * j.s;
    const im = feImg(j.spr);
    g.save(); g.translate(x,y);
    g.scale(j.dir > 0 ? -1 : 1, 1);                 // nose leads the jump
    g.rotate((k*Math.PI - Math.PI/2) * 0.75);       // up, over, down
    if(feImgOk(im)){
      const w = 17*j.s, h = w*(im.naturalHeight/im.naturalWidth);
      g.drawImage(im, -w/2, -h/2, w, h);
    } else {
      g.fillStyle = "rgba(30,50,66,0.9)";
      g.beginPath(); g.ellipse(0,0, 9*j.s, 3.4*j.s, 0, 0, 7); g.fill();
    }
    g.restore();
  }
  /* the dolphin: a rare, unannounced delight far out on the water */
  if(feAgents.breach){
    const b = feAgents.breach, k = b.t/1.35;
    const x = b.x + b.dir * k * 78;
    const y = b.y - Math.sin(k*Math.PI) * 44;
    const im = feImg(b.spr);
    if(feImgOk(im)){
      g.save(); g.translate(x,y);
      g.scale(b.dir > 0 ? -1 : 1, 1);
      g.rotate((k*Math.PI - Math.PI/2) * 0.85);
      g.drawImage(im, -15, -15, 30, 30);
      g.restore();
    }
  }
  /* the boat, hull-down on the horizon, lantern lit after dark */
  if(feAgents.boat){
    const b = feAgents.boat;
    g.fillStyle = "rgba(28,40,54,0.9)";
    g.beginPath(); g.moveTo(b.x-16,b.y); g.lineTo(b.x+16,b.y); g.lineTo(b.x+11,b.y+5); g.lineTo(b.x-11,b.y+5); g.closePath(); g.fill();
    g.fillRect(b.x-1.5, b.y-9, 3, 9);
    if(pal.sun < 0.2){ g.fillStyle = "rgba(255,214,140,0.9)"; g.fillRect(b.x-2.5, b.y-11, 5, 3.5); }
    g.strokeStyle = "rgba(223,233,242,0.25)"; g.lineWidth=1;
    g.beginPath(); g.moveTo(b.x - b.dir*16, b.y+4); g.lineTo(b.x - b.dir*40, b.y+5.5); g.stroke();
  }
  /* gulls in all their states */
  for(const gl of feAgents.gulls){
    if(gl.x < -500) continue;
    if(gl.st === "float"){
      const bob = Math.sin(fshT*2 + gl.ph)*1.6;
      g.fillStyle = "rgba(238,242,248,0.95)";
      g.beginPath(); g.ellipse(gl.x, gl.y+bob, 6.5*gl.s, 3.6*gl.s, 0, 0, 7); g.fill();
      g.beginPath(); g.arc(gl.x+5*gl.s, gl.y+bob-3.5*gl.s, 2.2*gl.s, 0, 7); g.fill();
    } else {
      fshDrawGull(g, gl.x, gl.y, gl.s, Math.sin(fshT*(gl.st==="takeoff"?16:8)+gl.ph));
    }
  }
  /* dragonflies for the golden light, fireflies for the dark */
  const golden = pal.sun > 0.2 && pal.sun < 0.9 && pal.warm[3] > 0.08;
  if(golden){
    for(const d of feAgents.dragons){
      g.strokeStyle = "rgba(150,220,235,0.75)"; g.lineWidth = 1;
      g.beginPath(); g.moveTo(d.x-5,d.y-2); g.lineTo(d.x+5,d.y-2); g.stroke();
      g.beginPath(); g.moveTo(d.x-4,d.y-4); g.lineTo(d.x+4,d.y); g.stroke();
      g.fillStyle = "rgba(70,160,190,0.9)"; g.fillRect(d.x-1, d.y-2, 7, 1.6);
    }
  }
  if(pal.stars > 0.5){
    for(const f of feAgents.flies){
      const glow = Math.max(0, Math.sin(fshT*0.9 + f.ph));
      if(glow < 0.25) continue;
      const x = f.x + Math.sin(fshT*0.5+f.ph)*9, y = f.y + Math.cos(fshT*0.4+f.ph*2)*6;
      g.globalAlpha = glow*0.85;
      g.fillStyle = "#d9f0a0"; g.beginPath(); g.arc(x,y,1.4,0,7); g.fill();
      g.globalAlpha = glow*0.25; g.beginPath(); g.arc(x,y,4,0,7); g.fill();
      g.globalAlpha = 1;
    }
  }
  /* lily pads in the shallows, riding the swell */
  const dressA = feSpot().dress || {};
  if(dressA.lilies && feAgents.lilies){
    for(const L of feAgents.lilies){
      const bob = Math.sin(fshT*1.3 + L.ph)*1.4;
      g.fillStyle = "rgba(48,92,58,0.92)";
      g.beginPath(); g.ellipse(L.x, L.y+bob, L.r, L.r*0.38, 0, 0.35, 6.1); g.fill();
      g.fillStyle = "rgba(74,124,74,0.7)";
      g.beginPath(); g.ellipse(L.x-L.r*0.2, L.y+bob-1, L.r*0.55, L.r*0.2, 0, 0, 7); g.fill();
      if(L.flower){
        g.fillStyle = "rgba(240,214,228,0.95)";
        g.beginPath(); g.arc(L.x+L.r*0.35, L.y+bob-2.5, 2.4, 0, 7); g.fill();
        g.fillStyle = "rgba(255,207,64,0.95)";
        g.beginPath(); g.arc(L.x+L.r*0.35, L.y+bob-2.5, 1, 0, 7); g.fill();
      }
    }
  }
  /* will-o'-wisps over the Mark's dark water — night only */
  if(dressA.wisps && pal.stars > 0.4 && feAgents.wisps){
    for(const w of feAgents.wisps){
      const x = w.x0 + Math.sin(fshT*0.31 + w.ph)*46;
      const y = FSH_HORIZON + 20 + Math.sin(fshT*0.53 + w.ph*2)*12;
      const glow = 0.35 + 0.3*Math.sin(fshT*1.1 + w.ph*3);
      g.globalAlpha = glow * pal.stars;
      g.fillStyle = "#9fd8e8";
      g.beginPath(); g.arc(x, y, 1.8, 0, 7); g.fill();
      g.globalAlpha = glow * pal.stars * 0.3;
      g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill();
      g.globalAlpha = 1;
    }
  }
  /* reeds in the near corner, leaning with the gusts */
  /* rooted at the tall frame's very bottom now — foreground framing,
     not stalks sprouting from open water mid-lake */
  const lean = (feWind ? feWind.cur : 0.6);
  const feBot = 1200 - feBandOff();
  for(const r of feAgents.reeds){
    const sway = Math.sin(fshT*1.9 + r.ph) * 2.6 * lean + lean*3;
    const h = r.h * 1.45;
    g.strokeStyle = "rgba(24,42,32,0.96)"; g.lineWidth = 3.6;
    g.beginPath(); g.moveTo(r.x, feBot+8);
    g.quadraticCurveTo(r.x+sway*0.4, feBot+8-h*0.6, r.x+sway, feBot+8-h);
    g.stroke();
    g.fillStyle = "rgba(52,42,30,0.97)";
    g.beginPath(); g.ellipse(r.x+sway, feBot+4-h, 3, 8.4, sway*0.04, 0, 7); g.fill();
  }
}

/* --------------------- 4 · THE FIGHT, FOR REAL ----------------------
   Pure core. Species archetypes by catch tier — each is a small state
   machine of moods, and each mood changes what the right move is:
     sulk  · low pull — reel hard, this is where you win line
     dart  · quick nips of pull — keep reeling, ride the bumps
     run   · heavy sustained pull — LET GO or the line goes red
     dive  · medium pull, the bobber drags under — ease off near the top
     jump  · the legend leaves the water — release for the spike, then
             punish the slack it lands with
     snag  · treasure doesn't fight, it CATCHES — short brutal wedges
     tired · stamina spent — the reward window, reel like mad
   Hold to reel and build tension; release to give line and shed it.
   Snap at max tension. Leave it slack too long and the hook slips. */
const FE_ARCH = [
  { key:"debris",  moods:{ sulk:[9,0]  },                                  stam: 30, pull:0.55 },
  { key:"darter",  moods:{ sulk:[3,1.2], dart:[2.5,0.55] },                stam: 65, pull:1.0  },
  { key:"runner",  moods:{ sulk:[2.4,1.3], run:[1.6,1.35], dart:[1,0.6] }, stam: 95, pull:1.0  },
  { key:"diver",   moods:{ sulk:[2,1.4], dive:[2.2,1.8], run:[0.8,1.2] },  stam:130, pull:1.05 },
  { key:"brute",   moods:{ sulk:[1.2,1.1], run:[2.2,1.9], dive:[1,1.6] },  stam:180, pull:1.1  },
  { key:"acrobat", moods:{ sulk:[1.9,1.2], run:[2,1.3], jump:[1.2,1.2], dive:[0.8,1.4] }, stam:220, pull:1.15 },
  { key:"anchor",  moods:{ sulk:[3,1.6], snag:[1.6,0.5] },                 stam:150, pull:1.2  },
];
const FE_MOOD_PULL = { sulk:0.45, dart:1.55, run:2.05, dive:1.5, jump:2.6, snag:2.3, tired:0.3 };
const FE_MOOD_DRAIN= { sulk:0.2,  dart:0.8,  run:1.35, dive:0.8, jump:1.0, snag:0.6, tired:0.05 };

function feFightNew(def, st, rng){
  rng = rng || Math.random;
  const arch = FE_ARCH[Math.min(def.tier, FE_ARCH.length-1)];
  return {
    arch: arch.key, def,
    script: def.script || null, scriptIdx: 0,
    mood:"sulk", moodT: 0.8 + rng()*0.8,
    stamina: def.maxStam || arch.stam * def.strain, maxStam: def.maxStam || arch.stam * def.strain,
    winded: 0,                       // times it has tired
    pullBase: def.pull * arch.pull,
    need: def.need,
    progress: 0, tension: 0, slackT: 0, airT: 0, jumpTele: 0,
    t: 0, event: null, over: null,
  };
}
function fePickMood(f, rng){
  /* the legends fight to a SCRIPT — a rotation you can learn */
  if(f.script){
    const m = f.script[f.scriptIdx % f.script.length];
    f.scriptIdx++;
    const arch = FE_ARCH.find(a=>a.key===f.arch);
    const base = (arch.moods[m] && arch.moods[m][1]) || 1.3;
    /* the rotation never changes — but a worn legend can't hold its
       violent moves as long. Same biology as an unscripted fight. */
    const soft = m === "sulk" ? 1 : Math.max(0.45, Math.pow(0.78, f.winded||0));
    return { mood: m, dur: base * soft * (0.9 + rng()*0.35) };
  }
  const arch = FE_ARCH.find(a=>a.key===f.arch);
  const low = f.stamina < f.maxStam*0.3;
  const entries = Object.entries(arch.moods);
  let total = 0;
  const soft = Math.pow(0.76, f.winded||0);      // every time it's been worn
  const w = entries.map(([m,[wt,dur]])=>{        // out, the wildness fades
    let ww = wt;
    if(m==="run"||m==="jump"||m==="dart"){ ww *= soft; if(low) ww *= 0.4; }
    if(m==="sulk"){ ww /= Math.sqrt(soft); if(low) ww *= 1.8; }
    total += ww; return [m, ww, dur*(m==="run"||m==="jump" ? Math.max(0.6, soft) : 1)];
  });
  let r = rng()*total;
  for(const [m,ww,dur] of w){ if(r < ww) return { mood:m, dur: dur*(0.75+rng()*0.6) }; r -= ww; }
  return { mood:"sulk", dur:1.5 };
}
function feFightStep(f, dt, holding, st, rng){
  rng = rng || Math.random;
  if(f.over) return f;
  f.t += dt; f.event = null;

  /* mood machine */
  if(f.mood === "jump"){
    if(f.jumpTele > 0){
      f.jumpTele -= dt;
      if(f.jumpTele <= 0){ f.airT = 0.62; f.event = "airborne"; }
    } else if(f.airT > 0){
      f.airT -= dt;
      if(f.airT <= 0){ f.mood = "slackfall"; f.moodT = 0.55; f.event = "splashdown"; }
    }
  } else {
    f.moodT -= dt;
    if(f.moodT <= 0){
      if(f.mood === "tired"){ f.maxStam *= 0.62; f.stamina = f.maxStam; }   // each recovery is weaker
      const nxt = fePickMood(f, rng);
      f.mood = nxt.mood; f.moodT = nxt.dur;
      /* every transition arms the new mood - the tired path used to skip
         this, so tired -> jump left jumpTele=0, airT=0, moodT frozen: the
         fish sat in a silent heavy run until the 260s failsafe (batch 119) */
      if(f.mood === "jump"){ f.jumpTele = 0.5; f.event = "telegraph"; }
      else if(f.mood === "run") f.event = "run";
      else if(f.mood === "dive") f.event = "dive";
      else if(f.mood === "snag") f.event = "snag";
    }
  }
  const moodKey = f.mood === "slackfall" ? "tired" : (f.mood === "jump" ? (f.airT > 0 ? "jump" : "run") : f.mood);
  const pull = f.pullBase * (FE_MOOD_PULL[moodKey]||1) * (0.92 + 0.08*Math.sin(f.t*7));

  /* tension chases its load; holding piles the reel on top of the fish.
     Giving line caps what the fish can put on you — that's what drag IS —
     so a released line always sheds toward safety. Without the cap a
     running Epic's free pull exceeded mid-tier max tension and the fight
     was unwinnable with perfect play, which the sim caught immediately. */
  const target = holding ? (st.reelLoad + pull*7) : Math.min(pull*3.2, st.maxTension*0.58);
  f.tension += (target - f.tension) * Math.min(1, dt*3.1);
  f.tension -= st.tensionDecay * dt * (holding ? 0.5 : 1.5);
  if(f.mood === "jump" && f.airT > 0 && holding) f.tension += 130*dt;   // never hold a fish in the air
  f.tension = Math.max(0, f.tension);
  if(f.tension >= st.maxTension){ f.over = "snap"; return f; }

  /* line comes in only under load and under control */
  if(holding && f.tension < st.maxTension*0.92){
    f.progress += st.reelPower * dt * (f.mood==="tired" ? 1.8 : f.mood==="slackfall" ? 1.5 : 1);
  }
  const drain = f.pullBase * (FE_MOOD_DRAIN[moodKey]||0.3) * 1.15;
  f.progress = Math.max(0, f.progress - drain*dt);
  if(f.progress >= f.need){ f.over = "landed"; return f; }

  /* stamina: fighting the drag is what wears the fish out */
  if(holding && f.tension > st.maxTension*0.38){
    f.stamina -= (9 + pull*2.8) * dt;
    if(f.stamina <= 0 && f.mood !== "tired"){ f.mood = "tired"; f.moodT = 2.4 + f.winded*0.6; f.winded++; f.event = "tired"; }
  } else {
    f.stamina = Math.min(f.maxStam, f.stamina + 2.5*dt);
  }
  /* a slack line is how hooks fall out */
  if(f.tension < 7){ f.slackT += dt; if(f.slackT > 3.0){ f.over = "slip"; return f; } }
  else f.slackT = Math.max(0, f.slackT - dt*2);

  /* pace checkpoints: the fight has to be going somewhere. Grace period
     first, then rising progress bars — miss one and the fish wins now
     instead of grinding you to the failsafe. Longer grace for the top
     tiers, whose fights are meant to be epics. The ending's copy depends
     on whether your reel was ever up to par (need/28 ≈ line-per-second
     to finish a held fight inside a minute): under par, the honest story
     is "your tackle was outclassed"; at par, it simply beat you. */
  const underPar = st.reelPower < f.need/28;
  const boss = !!f.def.boss;
  const grace = underPar ? 34 : (boss ? 62 : 42 + f.def.tier*5);
  if(f.t > grace){
    const k = (f.t - grace) / (underPar ? 40 : (boss ? 150 : 80 + f.def.tier*6));
    const requires = f.need * Math.min(0.8, 0.12 + k*0.68);
    if(f.progress < requires){
      f.over = underPar ? "overpowered" : "slip";
      return f;
    }
  }

  if(f.t > (f.def.boss ? 260 : 150)){ f.over = "slip"; return f; }   // nothing fights forever — legends just fight longer
  return f;
}
/* The old tap stats, remapped onto hold-to-reel so every rod, line and
   glove the player already bought keeps meaning something. */
function feFightStats(){
  const st = fshStats();
  return {
    reelPower: st.tapPower * 1.55,
    reelLoad: 30 + st.tapPower * 0.75,
    maxTension: st.maxTension,
    tensionDecay: st.tensionDecay,
    calm: st.calm,
  };
}

/* -------------------- 5 · WIRING INTO THE DOCK ---------------------- */
function fshHookSet(){
  if(!fsh || fsh.phase !== "bite") return;
  fsh.phase = "reeling";
  fsh.holding = false;
  fsh.reveal = feCatchSprite(fsh.catch.icon, fsh.catch.def.tier);
  { const sp = feSpot(), d0 = fsh.catch.def;
    const fdef = sp.fight !== 1 ? Object.assign({}, d0, { pull:d0.pull*sp.fight, strain:d0.strain*sp.fight }) : d0;
    fsh.fight = feFightNew(fdef, feFightStats()); }
  fsh.progress = 0; fsh.tension = 0; fsh.fightTime = 0; fsh.taps = 0;
  fsh.shake = 0; fsh.banner = null; fsh.bannerT = 0;
  feSound("hookset", { vol: 0.5 });
  fshFlash("Hooked it!", "#3ddc84");
  fshRenderControls();
}
/* Taps only set the hook now; the fight itself is held, not hammered. */
function fshTap(){
  if(!fsh) return;
  if(fsh.phase === "bite") fshHookSet();
}
function feHold(on){
  if(!fsh) return;
  if(fsh.phase === "bite" && on){ fshHookSet(); fsh.holding = true; return; }
  if(fsh.phase === "reeling"){
    if(fsh.holding && !on) feSound("give_line", { vol: 0.3, gap: 0.35 });
    fsh.holding = on;
  }
}

function fshTick(dt){
  fshT += dt;
  feEnvTick(dt);
  const pal = fePalette(feEnv.hour, feEnv.weather, feEnv.prev, feEnv.blend);
  feAmbientTick(dt, pal);
  if(!fsh) return;
  if(fsh.toastT > 0) fsh.toastT -= dt;
  if(fsh.lock > 0){
    fsh.lock -= dt;
    if(fsh.lock <= 0){ fsh.lock = 0; fshUnlockConfirm(); }
    else fshUpdateLockFill();
  }
  if(fsh.castGuard > 0) fsh.castGuard -= dt;
  if(fsh.bannerT > 0) fsh.bannerT -= dt;
  if(fePropFx){
    if(fePropFx.t < 0){ if(fsh.phase !== "result") fePropFx.t = 0; }
    else { fePropFx.t += dt; if(fePropFx.t > 2.6) fePropFx = null; }
  }
  feShadowTick(dt);
  /* sound follows the phase machine */
  if(fsh._sfxPhase !== fsh.phase){
    const from = fsh._sfxPhase, to = fsh.phase;
    fsh._sfxPhase = to;
    if(to === "bite") feSound("bite", { vol: 0.55 });
    if(from === "bite" && to !== "reeling") feSound("miss", { vol: 0.4 });
    if(to === "waiting") fsh.nibbled = false;
  }
  if(fsh.phase === "waiting" && fsh.shadow > 0 && !fsh.nibbled){
    fsh.nibbled = true; feSound("nibble", { vol: 0.35 });
  }
  /* the reel crank runs exactly while you hold in a fight */
  if(fsh.phase === "reeling" && fsh.holding) feLoopStart("reel_loop", 0.28);
  else feLoopStop("reel_loop");
  /* the soundtrack of the afternoon: a soothing pad (own 🎵 chip) and a
     faint water bed, both only while the tab lives and audio is awake */
  const ctxLive = feAC && feAC.state === "running" && fshTabActive;
  /* the piano keeps the hours too: layered Calm by day, Dreams in Blue
     after dark — one loop at a time, swapped at the light change */
  const track = feNight() ? "music_night" : "music";
  const other = track === "music" ? "music_night" : "music";
  feLoopStop(other);
  if(ctxLive && !feMusicMuted()) feLoopStart(track, track === "music" ? 0.3 : 0.24);
  else feLoopStop(track);
  if(ctxLive && !feMusicMuted()) feLoopStart("amb_water", 0.10); else feLoopStop("amb_water");
  if(fsh.shake > 0) fsh.shake = Math.max(0, fsh.shake - dt*3.2);

  for(let i=fsh.ripples.length-1;i>=0;i--){ fsh.ripples[i].t += dt; if(fsh.ripples[i].t > 1.5) fsh.ripples.splice(i,1); }
  for(let i=fsh.splash.length-1;i>=0;i--){
    const s = fsh.splash[i]; s.t += dt; s.x += s.vx*dt; s.y += s.vy*dt; s.vy += 240*dt;
    if(s.t > 0.9) fsh.splash.splice(i,1);
  }

  if(fsh.phase === "charging"){
    fsh.power += fsh.powerDir * 108 * dt;
    if(fsh.power >= 100){ fsh.power = 100; fsh.powerDir = -1; }
    if(fsh.power <= 0){ fsh.power = 0; fsh.powerDir = 1; }
  }
  else if(fsh.phase === "casting"){
    fsh.castAnim += dt/0.75;
    const k = Math.min(1, fsh.castAnim);
    const rodTipX = 400, rodTipY = 236;
    fsh.bobX = rodTipX + (fsh.targetX-rodTipX)*k;
    fsh.bobY = rodTipY + (fsh.targetY-rodTipY)*k - Math.sin(k*Math.PI)*72;
    if(k >= 1){ fsh.bobX = fsh.targetX; fsh.bobY = fsh.targetY; fshLandCast(); }
  }
  else if(fsh.phase === "waiting"){
    fsh.waitTimer += dt*1000;
    /* the shadow: something big slides toward the bobber just before it hits */
    const lead = fsh.waitMs - fsh.waitTimer;
    fsh.shadow = (lead < 950 && lead > 0) ? 1 - lead/950 : 0;
    if(fsh.waitTimer >= fsh.waitMs){ fsh.shadow = 0; fshBite(); }
  }
  else if(fsh.phase === "bite"){
    fsh.biteTimer -= dt;
    if(fsh.biteTimer <= 0) fshMissed();
  }
  else if(fsh.phase === "reeling"){
    const f = fsh.fight;
    if(!f){ fshLost(); return; }
    fsh.fightTime += dt;
    feFightStep(f, dt, !!fsh.holding, feFightStats());
    fsh.progress = f.progress;                     // the old bars read these
    fsh.tension  = f.tension;

    if(f.event){
      const B = {
        telegraph:["❗ IT'S GOING AIRBORNE","#ffd35c"], airborne:["LET IT FLY — GIVE LINE!","#ff8c5c"],
        splashdown:["It's down — REEL the slack!","#3ddc84"], run:["🌊 IT'S RUNNING — let go!","#ff8c5c"],
        dive:["It's sounding — ease off near the red","#5cc8ff"], snag:["It's wedged — short pulls","#c98cff"],
        tired:["It's spent — REEL NOW!","#3ddc84"],
      }[f.event];
      if(B){ fsh.banner = B[0]; fsh.bannerColor = B[1]; fsh.bannerT = 1.6; }
      const EV_SFX = { run:["run",0.6], airborne:["jump",0.8], splashdown:["splash_big",0.7],
                       dive:["dive",0.6], snag:["snag",0.6] };
      if(EV_SFX[f.event]) feSound(EV_SFX[f.event][0], { vol: EV_SFX[f.event][1] });
      if(f.event === "run" || f.event === "airborne") fsh.shake = 1;
      if(f.event === "airborne"){
        for(let i=0;i<14;i++) fsh.splash.push({ x:fsh.bobX, y:fsh.bobY, t:0,
          vx:(Math.random()*2-1)*90, vy:-70-Math.random()*130 });
      }
      if(f.event === "splashdown"){
        fsh.ripples.push({x:fsh.bobX, y:fsh.bobY, t:0});
        for(let i=0;i<10;i++) fsh.splash.push({ x:fsh.bobX, y:fsh.bobY, t:0,
          vx:(Math.random()*2-1)*70, vy:-50-Math.random()*90 });
      }
    }
    /* the bobber tells the fight's story */
    const k = Math.min(1, f.progress/f.need);
    const home = fshBobberTarget(fsh.castT);
    let bx = home.x + (400-home.x)*k*0.72;
    let by = home.y + (336-home.y)*k*0.72;
    if(f.mood === "run") bx += Math.sin(fshT*22)*6 - 10;
    if(f.mood === "dive") by += 7 + Math.sin(fshT*9)*2;
    if(f.mood === "jump" && f.airT > 0) by -= 26*Math.sin((0.62-f.airT)/0.62*Math.PI);
    if(f.mood === "dart") bx += Math.sin(fshT*30)*3;
    fsh.bobX = bx; fsh.bobY = by;

    const stx = feFightStats();
    const tratio = f.tension / stx.maxTension;
    if(tratio > 0.85) feSound("tension_max", { vol: 0.38, gap: 2.2 });
    else if(tratio > 0.6) feSound("tension_hi", { vol: 0.28, gap: 2.8 });
    if(tratio > 0.7) feSound("creak", { vol: 0.32, gap: 3.4 });
    if(f.over === "snap"){ fshSnap(); return; }
    if(f.over === "overpowered"){ feOverpowered(); return; }
    if(f.over === "slip"){ fshLost(); return; }
    if(f.over === "landed"){ fshLand(); return; }
  }
}

function fshDraw(){
  const cv = document.getElementById("fshCanvas");
  if(!cv) return;
  const g = cv.getContext("2d");
  feApplySpotBg();
  if(!feEnv) feEnvInit();
  if(!feStars) feInitAmbient();
  const pal = fePalette(feEnv.hour, feEnv.weather, feEnv.prev, feEnv.blend);

  g.setTransform(2,0,0,2,0,0);
  g.save();
  /* the fight rattles the whole view when the fish runs */
  if(fsh && fsh.shake > 0){
    g.translate((Math.random()*2-1)*2.4*fsh.shake, (Math.random()*2-1)*1.8*fsh.shake);
  }
  g.textAlign = "center"; g.textBaseline = "middle";

  fshDrawSky(g);
  fshDrawClouds(g);
  fshDrawWater(g);
  fshDrawUnderwater(g);
  feSceneWater(g, pal);      /* what makes this water look like somewhere */
  fshDrawReflection(g);
  fshDrawFishSchool(g);
  fshDrawFoamLine(g);
  /* the pre-bite shadow, gliding in under the bobber */
  if(fsh && fsh.shadow > 0){
    const k = fsh.shadow;
    const sx = fsh.bobX + (1-k)*70*(fsh.bobX>FSH_W/2?1:-1);
    g.globalAlpha = 0.34*k;
    g.fillStyle = "#14242f";
    g.beginPath(); g.ellipse(sx, fsh.bobY+9, 22, 6, 0, 0, 7); g.fill();
    g.globalAlpha = 1;
  }
  feDrawAmbient(g, pal);
  feShadowDraw(g, pal);
  fshDrawDock(g);
  feDrawProps(g);
  feSceneFore(g, pal);
  const grip = fshDrawFisherman(g);
  const tip = fshDrawRod(g, grip);
  fshDrawLineAndBobber(g, tip);
  /* the airborne reveal: when it jumps, you SEE what you're fighting */
  if(fsh && fsh.phase === "reeling" && fsh.fight && fsh.fight.mood === "jump" && fsh.fight.airT > 0 && fsh.reveal){
    const im = feImg(fsh.reveal.key);
    if(feImgOk(im)){
      const k = (0.62 - fsh.fight.airT)/0.62;
      const w = FE_REVEAL_SIZE[fsh.reveal.cls] || 20;
      const h = w * (im.naturalHeight/im.naturalWidth);
      g.save(); g.translate(fsh.bobX, fsh.bobY - 7);
      g.rotate((k*Math.PI - Math.PI/2) * 0.7);
      g.drawImage(im, -w/2, -h/2, w, h);
      g.restore();
    }
  }
  feDrawGrade(g, pal, feEnv.hour);
  feDrawPropFx(g);
  feSceneArrive(g);          /* the moment you step ashore somewhere new */

  /* tension ring around the bobber during the fight — eyes on the water */
  if(fsh && fsh.phase === "reeling" && fsh.fight){
    const st = feFightStats();
    const t = Math.min(1, fsh.fight.tension/st.maxTension);
    g.strokeStyle = t > 0.75 ? "#ff5c5c" : t > 0.45 ? "#ffd35c" : "#5cc8ff";
    g.lineWidth = 3;
    g.globalAlpha = 0.9;
    g.beginPath(); g.arc(fsh.bobX, fsh.bobY, 15, -Math.PI/2, -Math.PI/2 + t*Math.PI*2); g.stroke();
    g.globalAlpha = 0.25;
    g.beginPath(); g.arc(fsh.bobX, fsh.bobY, 15, 0, 7); g.stroke();
    g.globalAlpha = 1;
  }
  /* fight banner over the water */
  if(fsh && fsh.bannerT > 0 && fsh.banner){
    g.globalAlpha = Math.min(1, fsh.bannerT/0.4);
    g.font = "bold 15px system-ui";
    const w = g.measureText(fsh.banner).width;
    g.fillStyle = "rgba(8,20,32,.72)";
    fshRound(g, FSH_W/2 - w/2 - 16, 64, w + 32, 30, 9); g.fill();
    g.fillStyle = fsh.bannerColor || "#fff";
    g.fillText(fsh.banner, FSH_W/2, 79);
    g.globalAlpha = 1;
  }

  if(fsh && fsh.phase === "charging"){
    const mx = 430, my = FSH_H-52, mw = 300, mh = 20;
    g.fillStyle = "rgba(8,20,32,.72)";
    fshRound(g, mx-4, my-4, mw+8, mh+8, 8); g.fill();
    g.fillStyle = "rgba(255,255,255,.12)"; g.fillRect(mx, my, mw, mh);
    g.fillStyle = "rgba(61,220,132,.42)";
    g.fillRect(mx + mw*FSH_SWEET_LO/100, my, mw*(FSH_SWEET_HI-FSH_SWEET_LO)/100, mh);
    const inSweet = fsh.power >= FSH_SWEET_LO && fsh.power <= FSH_SWEET_HI;
    g.fillStyle = inSweet ? "#3ddc84" : "#ffd35c";
    g.fillRect(mx, my, mw*fsh.power/100, mh);
    g.strokeStyle = "rgba(255,255,255,.5)"; g.lineWidth = 1.5;
    g.strokeRect(mx, my, mw, mh);
    g.fillStyle = "#fff"; g.font = "bold 12px system-ui";
    g.fillText("RELEASE IN THE GREEN", mx+mw/2, my+mh/2+1);
  }
  if(fsh && fsh.toastT > 0 && fsh.toast){
    g.globalAlpha = Math.min(1, fsh.toastT/0.5);
    g.fillStyle = "rgba(8,20,32,.7)";
    const w = g.measureText(fsh.toast).width;
    fshRound(g, FSH_W/2 - w/2 - 18, 24, w + 36, 34, 10); g.fill();
    g.fillStyle = fsh.toastColor; g.font = "bold 17px system-ui";
    g.fillText(fsh.toast, FSH_W/2, 42);
    g.globalAlpha = 1;
  }
  if(fsh && fsh.phase === "result"){
    g.fillStyle = "rgba(6,14,24,.55)"; g.fillRect(-FSH_W,-feBandOff(),3*FSH_W,1200);
  }
  g.restore();
}

/* A tap (power < 8) cancels back to idle instead of flopping a dud cast
   that would burn bait. Everything else is the original release. */
function fshRelease(){
  if(!fsh || fsh.phase !== "charging") return;
  if(fsh.power < 8){
    fsh.phase = "idle"; fsh.power = 0; fsh.castGuard = 0.25;
    fshFlash("Hold to charge — let go in the green", "#ffd35c");
    fshRenderControls();
    return;
  }
  const st = fshStats();
  fsh.sweet = fsh.power >= FSH_SWEET_LO && fsh.power <= FSH_SWEET_HI;
  fsh.backlash = fsh.power > FSH_SWEET_HI;
  fsh.castT = Math.min(1, (fsh.power/100) * st.castBonus * (fsh.backlash ? 0.5 : 1));
  const tgt = fshBobberTarget(fsh.castT);
  fsh.targetX = tgt.x; fsh.targetY = tgt.y;
  fsh.phase = "casting"; fsh.castAnim = 0;
  feSound(fsh.sweet ? "cast_sweet" : fsh.backlash ? "backlash" : "cast", { vol: 0.7 });
  if(!state.fishing) state.fishing = defaultFishing();
  state.fishing.casts = (state.fishing.casts||0) + 1;
  fshConsumeOnCast();
  fshFlash(fsh.sweet ? "Perfect cast!" : fsh.backlash ? "Backlash — bird's nest in the reel." : "",
           fsh.sweet ? "#3ddc84" : "#ff8f5c");
}

/* The honest loss: your gear was never going to win this one. */
function feOverpowered(){
  const c = fsh.catch;
  if(!state.fishing) state.fishing = defaultFishing();
  state.fishing.lost = (state.fishing.lost||0) + 1;
  saveState();
  const pct = Math.round(Math.min(100, fsh.progress/c.def.need*100));
  feAllLoopsStop(); feSound("overpowered", { vol: 0.7 });
  fshEnterResult({ failed:true, title:"It was too strong.", kind:"lost",
    tag:c.def.label, tagColor:c.def.color,
    sub:`That ${c.def.label} ${c.name} outclassed your tackle — ${pct}% in was the best you could do.`,
    tip:"A stronger reel and Reeling Strength training bring in more line per second — enough to out-pull a fish this size.",
    spriteKey: (c.boss ? c.boss.art : null) || (c.boxNeed ? "chest"+c.boxNeed : null) || feSpeciesArt(c.name) || feCatchSprite(c.icon, c.def.tier).key,
    chips:[], color:"#ff8f5c", icon:"🐟" });
  fshRenderLog();
}

/* Hold-to-reel wiring: pointer down anywhere useful = reel; up = give line. */
function fshBindCanvas(){
  const cv = document.getElementById("fshCanvas");
  if(!cv || cv.dataset.bound) return;
  cv.dataset.bound = "1";
  cv.addEventListener("pointerdown", e=>{
    feAudioUnlock();
    /* during the fight the canvas owns the pointer — a wobbling thumb
       must not become a scroll that silently gives line. Any other
       time, the touch passes through so the page can scroll. */
    if(!fsh || (fsh.phase !== "bite" && fsh.phase !== "reeling")) return;
    e.preventDefault();
    try{ cv.setPointerCapture(e.pointerId); }catch(_){}
    feHold(true);
  });
  const up = e=>{ feHold(false); };
  cv.addEventListener("pointerup", up);
  cv.addEventListener("pointercancel", up);
  cv.addEventListener("pointerleave", up);
  cv.style.touchAction = "pan-y";
}
function fshBindCastButton(){
  const b = document.getElementById("fshCastBtn");
  if(!b || b.dataset.bound) return;
  b.dataset.bound = "1";
  const down = e=>{
    e.preventDefault();
    feAudioUnlock();
    if(!fsh) return;
    try{ if(e.pointerId !== undefined) b.setPointerCapture(e.pointerId); }catch(_){}
    if(fsh.phase === "idle") fshStartCharge();
    else feHold(true);
  };
  const up = e=>{
    e.preventDefault();
    if(!fsh) return;
    if(fsh.phase === "charging") fshRelease();
    else feHold(false);
  };
  b.addEventListener("pointerdown", down);
  b.addEventListener("pointerup", up);
  b.addEventListener("pointerleave", up);
  b.addEventListener("pointercancel", up);
  b.style.touchAction = "none";   // a held cast is never a scroll
  document.addEventListener("keydown", e=>{
    if(e.code !== "Space" || !fshTabActive || e.repeat) return;
    e.preventDefault(); down(e);
  });
  document.addEventListener("keyup", e=>{
    if(e.code !== "Space" || !fshTabActive) return;
    e.preventDefault(); up(e);
  });
}

function fshRenderControls(){
  if(!fsh) return;
  feRenderSpots();
  const btn = document.getElementById("fshCastBtn");
  const hint = document.getElementById("fshHint");
  const bars = document.getElementById("fshBars");
  if(!btn) return;

  const labels = {
    idle:     ["🎣 Hold to Cast", "Hold the button (or Space), watch the meter, and let go in the green band for a perfect cast."],
    charging: ["…let go!", "Release in the green for a longer cast and better water."],
    casting:  ["Casting…", "Nice arc."],
    waiting:  ["Waiting…", "Watch the water. When a shadow slides in, be ready."],
    bite:     ["❗ SET THE HOOK", "Press anything — quick!"],
    reeling:  ["🎣 HOLD to reel", "Hold to reel and build tension. Let go when it runs or jumps. Never leave it slack."],
    result:   ["— see your catch above —", "Read it over, then hit Cast Again on the card."],
  };
  const [label, tip] = labels[fsh.phase] || labels.idle;
  btn.textContent = fsh.phase === "reeling" && fsh.holding ? "🌀 REELING…" : label;
  btn.className = "btn fsh-cast" + (fsh.phase === "bite" ? " urgent" : fsh.phase === "reeling" ? " reeling" : "");
  btn.disabled = (fsh.phase === "result");
  if(hint) hint.textContent = tip;

  if(bars){
    if(fsh.phase === "reeling" && fsh.fight){
      const f = fsh.fight, st = feFightStats();
      const p = Math.min(100, f.progress/f.need*100);
      const t = Math.min(100, f.tension/st.maxTension*100);
      const s = Math.max(0, f.stamina/f.maxStam*100);
      const moodTxt = {
        sulk:"…it's sulking — reel", dart:"it's darting — keep on it", run:"🌊 IT'S RUNNING — let go!",
        dive:"it's sounding — ease off", jump: f.airT>0 ? "IT'S AIRBORNE — give line!" : "❗ it's about to jump",
        slackfall:"reel the slack!", snag:"it's wedged — short pulls", tired:"✅ IT'S SPENT — reel now!",
      }[f.mood] || "";
      const hot = f.mood==="run" || (f.mood==="jump");
      bars.style.display = "block";
      bars.innerHTML = `
        <div class="fsh-bar-row">
          <span class="k">Line in</span>
          <div class="fsh-bar"><i style="width:${p}%; background:linear-gradient(90deg,#3ddc84,#8fe36a)"></i></div>
          <b>${Math.round(p)}%</b>
        </div>
        <div class="fsh-bar-row">
          <span class="k">Tension</span>
          <div class="fsh-bar ${t>75?"danger":""}"><i style="width:${t}%; background:${t>75?"linear-gradient(90deg,#ff5c5c,#ff8f5c)":t>45?"linear-gradient(90deg,#ffd35c,#ffb45c)":"linear-gradient(90deg,#5cc8ff,#6c8cff)"}"></i></div>
          <b>${Math.round(t)}%</b>
        </div>
        <div class="fsh-bar-row">
          <span class="k">Its fight</span>
          <div class="fsh-bar"><i style="width:${s}%; background:linear-gradient(90deg,#c98cff,#8c6cff)"></i></div>
          <b>${Math.round(s)}%</b>
        </div>
        <div class="fsh-surge ${hot?"on":""}">${moodTxt} · ${fsh.catch.def.label} on the line</div>`;
    } else if(fsh.phase === "waiting" || fsh.phase === "bite"){
      bars.style.display = "block";
      const biting = fsh.phase === "bite";
      bars.innerHTML = `<div class="fsh-surge ${biting?"on":""}">${
        biting ? "❗ Something took it — set the hook!" : "🎣 Line's in the water…"}</div>`;
    } else { bars.style.display = "none"; bars.innerHTML = ""; }
  }
}

/* Full replacement of the enter hook — a wrapper can't work here, since
   function declarations hoist last-wins and would capture themselves. */
/* The shore sections live behind journal-style pop-ups now: one labeled
   chip each, a fixed top-layer card when opened. The panels themselves
   are re-parented into the modals once, so the host's render functions
   keep hitting the same ids without knowing anything moved. */
const FE_SECTIONS = [
  { key:"stats",  icon:"📊", title:"Angler Stats", find:"#fshStatsBar" },
  { key:"bucket", icon:"🪣", title:"The Bucket",   find:"#fshLog" },
  { key:"equip",  icon:"🧰", title:"Equipment",    find:"#fshEquip" },
];
function feSectionModals(){
  const tab = document.getElementById("tab-fishing");
  if(!tab || document.getElementById("feSecWrap")) return;
  const wrap = document.createElement("div");
  wrap.id = "feSecWrap";
  for(const d of FE_SECTIONS){
    const el = tab.querySelector(d.find);
    if(!el) continue;
    const panel = el.closest(".panel");
    if(!panel) continue;
    const m = document.createElement("div");
    m.className = "fe-secmodal";
    m.id = "feSec_" + d.key;
    m.innerHTML = `<div class="fej-head"><b>${d.icon} ${d.title}</b>
      <button class="fe-secx" data-x="1">✕</button></div>
      <div class="fe-secbody"></div>`;
    panel.classList.remove("panel");
    /* the modal head already names the section — the panel's old bold
       title would just say it twice */
    const t = panel.querySelector(':scope > div[style*="font-weight:800"]');
    if(t) t.style.display = "none";
    m.querySelector(".fe-secbody").appendChild(panel);
    wrap.appendChild(m);
  }
  (document.fullscreenElement || document.body).appendChild(wrap);
  wrap.addEventListener("click", e => {
    if(e.target.closest("[data-x]")) feSecOpen(null);
  });
}
function feChumOpen(){
  let m = document.getElementById("feChum");
  if(m){ m.remove(); return; }
  const inv = fshInv();
  m = document.createElement("div");
  m.id = "feChum";
  const paint = ()=>{
    m.innerHTML = `<div class="fej-head"><b>🪱 The Chum Grinder</b><button class="fe-secx" id="feChX">✕</button></div>
      <div class="fb-sub">Commons and uncommons you land feed the grinder. Five scrap fish make a jar. Jars chum the water.</div>
      <div class="fb-row"><span>🐟 Scrap fish banked</span><b>${inv.chumFish||0}</b></div>
      <div class="fb-row"><span>🪱 Chum jars</span><b>${inv.chum||0}</b></div>
      <button class="fe-secbtn" id="feChGrind" ${(inv.chumFish||0) >= 5 ? "" : "disabled"}>⚙️ Grind 5 → 1 jar</button>
      <button class="fe-secbtn" id="feChUse" ${(inv.chum||0) > 0 && !(inv.chumCasts>0) ? "" : "disabled"}>
        ${inv.chumCasts > 0 ? `🌊 Water's chummed — ${inv.chumCasts} casts left` : "🌊 Chum the water (next 4 casts)"}</button>`;
    m.querySelector("#feChX").onclick = ()=> m.remove();
    m.querySelector("#feChGrind").onclick = ()=>{
      if((inv.chumFish||0) < 5) return;
      inv.chumFish -= 5; inv.chum = (inv.chum||0) + 1;
      fbSfxSafe("equip", 0.4); saveState(); paint();
    };
    m.querySelector("#feChUse").onclick = ()=>{
      if(!(inv.chum > 0) || inv.chumCasts > 0) return;
      inv.chum--; inv.chumCasts = 4 + 2*Math.min(2,((state.upgrades && state.upgrades.chumBarrels)||0));
      fbSfxSafe("bait", 0.45); saveState(); paint();
      showToast("🪱 The water clouds — fast bites, fat payouts, four casts");
    };
  };
  paint();
  (document.fullscreenElement || document.body).appendChild(m);
}
function feMixerOpen(){
  let m = document.getElementById("feMixer");
  if(m){ m.remove(); return; }
  const inv = fshInv();
  m = document.createElement("div");
  m.id = "feMixer";
  m.innerHTML = `<div class="fej-head"><b>🎚️ Sound on the water</b><button class="fe-secx" id="feMixX">✕</button></div>
    <div style="font:600 10px system-ui; color:#5f7288; margin:-4px 0 2px;">shapes the fishing tab · master music lives in Settings</div>
    <label>🎵 Music <input id="feMixMus" type="range" min="0" max="100" value="${Math.round((inv.musicVol===undefined?1:inv.musicVol)*100)}"></label>
    <button id="feMixVibe" class="fe-secbtn">${inv.vibeOff ? "📳 Vibration: off" : "📳 Vibration: on"}</button>`;
  (document.fullscreenElement || document.body).appendChild(m);
  document.getElementById("feMixX").onclick = ()=> m.remove();
  document.getElementById("feMixMus").oninput = e => { inv.musicVol = e.target.value/100; feApplyVols(); saveState(); };
  document.getElementById("feMixVibe").onclick = e => {
    inv.vibeOff = !inv.vibeOff; saveState();
    e.target.textContent = inv.vibeOff ? "📳 Vibration: off" : "📳 Vibration: on";
    if(!inv.vibeOff && feCanVibe()) try{ navigator.vibrate(25); }catch(err){}
  };
}
function feSecOpen(key){
  document.querySelectorAll(".fe-secmodal").forEach(m =>
    m.classList.toggle("show", m.id === "feSec_" + key));
  if(key && typeof feSound === "function"){ feAudioUnlock(); feSound("box_open",{vol:0.3}); }
}

let feSkyLift = false;
function feDockControls(){
  /* the cast button and the fight bars float at the scene's foot, so the
     action never needs a perfect scroll position */
  if(document.getElementById("feCtl")) return;
  const stage = document.querySelector("#tab-fishing .fsh-stage");
  const btn = document.getElementById("fshCastBtn");
  const bars = document.getElementById("fshBars");
  if(!stage || !btn || !bars) return;
  const ctl = document.createElement("div");
  ctl.id = "feCtl";
  const recall = document.createElement("button");
  recall.id = "feRecall";
  recall.textContent = "↩️ Reel it in";
  recall.style.display = "none";
  recall.onclick = ()=>{
    if(!fsh || fsh.phase !== "waiting") return;
    feAudioUnlock(); feSound("land",{vol:0.4}); feSound("splash_big",{vol:0.22});
    fsh = fshNew();
    showToast("Reeled in — line's free for another cast");
  };
  ctl.appendChild(bars); ctl.appendChild(recall); ctl.appendChild(btn);
  stage.appendChild(ctl);
}
function fshOnEnterTab(){
  feSectionModals();
  feDockControls();
  fshTabActive = true;
  if(!fshGulls) fshInitScene();
  feEnvInit();
  if(!feStars) feInitAmbient();
  if(!fsh) fsh = fshNew();
  /* clouds and gulls were born in the old letterboxed sky — lift them
     into the painting's tall one, once per page life */
  if(!feSkyLift){
    feSkyLift = true;
    try{ for(const c of (fshClouds||[])) if(typeof c.y === "number") c.y -= 205; }catch(e){}
    try{ for(const gl of (fshGulls||[])){ if(typeof gl.y === "number") gl.y -= 215; if(typeof gl.baseY === "number") gl.baseY -= 215; } }catch(e){}
  }
  fshStartLoop();
}

/* Failure copy rewritten for the new fight — the old lines coached a tap
   frenzy ("ease off during a surge", "that clock is 26 seconds") that no
   longer exists. Counters and payouts unchanged. */
function fshSnap(){
  const c = fsh.catch;
  const consolation = Math.round(c.def.cr[0]*0.12*fshStats().lootMult);
  state.credits += consolation;
  if(!state.fishing) state.fishing = defaultFishing();
  state.fishing.snapped = (state.fishing.snapped||0) + 1;
  saveState(); renderHeader();
  feAllLoopsStop(); feSound("snap", { vol: 0.65 });
  fshEnterResult({ failed:true, title:"The line snapped!", kind:"snap",
    tag:c.def.label, tagColor:c.def.color,
    sub:`That ${c.name} was too much for your ${(fshEquippedItem("line")||{name:"bare line"}).name}.`,
    tip:"Let go the moment it runs or leaves the water — tension you shed is line you keep.",
    spriteKey: (c.boss ? c.boss.art : null) || (c.boxNeed ? "chest"+c.boxNeed : null) || feSpeciesArt(c.name) || feCatchSprite(c.icon, c.def.tier).key,
    chips:[`🪙 ${consolation.toLocaleString()} salvaged`], color:"#ff5c5c", icon:"💔" });
  fshRenderLog();
}
function fshLost(){
  const c = fsh.catch;
  if(!state.fishing) state.fishing = defaultFishing();
  state.fishing.lost = (state.fishing.lost||0) + 1;
  saveState();
  const pct = Math.round(Math.min(100, fsh.progress/c.def.need*100));
  feAllLoopsStop(); feSound("slip", { vol: 0.7 });
  fshEnterResult({ failed:true, title:"It shook the hook.", kind:"lost",
    tag:c.def.label, tagColor:c.def.color,
    sub:`The ${c.name} slipped away with ${pct}% of the line in.`,
    tip:"A slack line is how hooks fall out — keep a little tension on even while it rests.",
    spriteKey: (c.boss ? c.boss.art : null) || (c.boxNeed ? "chest"+c.boxNeed : null) || feSpeciesArt(c.name) || feCatchSprite(c.icon, c.def.tier).key,
    chips:[], color:"#ff8f5c", icon:"🌊" });
  fshRenderLog();
}

/* Carry the fight's own numbers into the result. */
function fshEnterResult(res){
  fsh.phase = "result";
  fsh.holding = false;
  fsh.lock = FSH_RESULT_LOCK;
  res.castYards = fsh.castYards || 0;
  res.taps = fsh.taps || 0;
  res.winded = fsh.fight ? fsh.fight.winded : undefined;
  res.fightTime = fsh.fightTime || 0;
  fsh.result = res;
  fshRenderResult();
  fshRenderControls();
}

/* The result card, with one honest change: the fight is measured in what
   it now is — held seconds and how many times you wore the fish out —
   not taps. Everything else byte-identical to the original. */
function fshRenderResult(){
  const el = document.getElementById("fshResult");
  if(!el || !fsh) return;
  if(fsh.phase !== "result" || !fsh.result){
    el.classList.remove("show");
    el.innerHTML = "";
    return;
  }
  const r = fsh.result;
  const locked = (fsh.lock||0) > 0;
  el.classList.add("show");
  el.innerHTML = `
    <div class="fsh-card">
      <div class="rPhoto" id="fshResultPhoto"><div class="rIcon">${
        r.spriteKey && FE_IMG[r.spriteKey] ? `<img class="rSpr" src="${FE_IMG[r.spriteKey]}" alt="">` : (r.icon || "🎣")
      }</div></div>
      <div class="rTitle" style="color:${r.color}">${r.title}</div>
      <div class="rMeta">
        ${r.tag ? `<span class="rTag" style="color:${r.tagColor}; border-color:${r.tagColor}66; background:${r.tagColor}14;">${r.tag}</span>` : ""}
        ${r.weight ? `<span class="rWeight">${r.weight} lb</span>` : ""}
      </div>
      ${r.best ? `<div class="rBest">★ New personal best</div>` : ""}
      ${r.failed ? `<div class="rSub">${r.sub}</div>` : ""}
      ${r.chips.length ? `<div class="rChips">${r.chips.map((c,i)=>`<span style="animation-delay:${0.08+i*0.07}s">${c}</span>`).join("")}</div>` : ""}
      <div class="rStats">
        <div>Cast<b>${r.castYards} yd</b></div>
        <div>Worn out<b>${r.winded !== undefined ? r.winded + "×" : "—"}</b></div>
        <div>Fight<b>${r.fightTime.toFixed(1)}s</b></div>
      </div>
      ${r.tip ? `<div class="rTip">💡 ${r.tip}</div>` : ""}
      <div class="fsh-actions">
        <button class="fsh-confirm ${locked ? "locked" : ""}" id="fshConfirmBtn">
          <i class="lockfill" style="width:${locked ? (1-fsh.lock/FSH_RESULT_LOCK)*100 : 100}%"></i>
          <span class="lbl">${locked ? "…" : "🎣 Cast Again"}</span>
        </button>
        <button class="fsh-done ${locked ? "locked" : ""}" id="fshDoneBtn">Done for now</button>
      </div>
      <button class="fsh-shop" id="fshShopBtn">🧰 Spend it at the Tackle Shop →</button>
      <button class="fsh-x" id="fshCloseBtn" aria-label="Close">✕</button>
    </div>`;
  const arm = (id, fn)=>{
    const el = document.getElementById(id);
    if(el && !locked) el.addEventListener("click", e=>{ e.preventDefault(); e.stopPropagation(); fn(); });
  };
  arm("fshConfirmBtn", fshReset);
  arm("fshDoneBtn", fshDismiss);
  arm("fshCloseBtn", fshDismiss);
  arm("fshShopBtn", ()=>{ fshDismiss(); const b = document.querySelector('nav button[data-tab="market"]'); if(b) b.click(); });
  fshLoadResultPhoto(r);
}

/* ----------------- 5b · SPRITES: THE UPLOADED ART -------------------
   Tiered painterly sets (poles, fish, sharks, whales, squid, crabs,
   chests, bags, gems, medallions, dolphins…) live in FE_IMG as data
   URIs, scaled and quantized at build time. */
const feImgs = {};
function feImg(key){
  if(feImgs[key]) return feImgs[key];
  const src = FE_IMG[key];
  if(!src) return null;
  const im = new Image(); im.src = src;
  feImgs[key] = im;
  return im;
}
function feImgOk(im){ return im && im.complete && im.naturalWidth > 0; }

/* what kind of thing is on the hook, judged by its icon */
const FE_CLASS_BY_EMOJI = {
  "🦈":"shark", "🐳":"whale", "🐋":"whale", "🦑":"squid", "🐙":"squid",
  "🦀":"crab", "🦞":"crab", "🦐":"crab",
  "🧰":"chest", "💰":"bag", "🪙":"bag", "📿":"bag",
  "💎":"gem", "💍":"gem", "☄️":"gem",
  "👑":"medal", "🏆":"medal", "⌚":"medal", "🗿":"medal", "🧭":"medal",
  "🔭":"medal", "🎭":"medal", "🗡️":"medal", "🔱":"medal", "🔮":"medal",
  "🏺":"medal", "🍾":"medal", "🔔":"medal", "🗺️":"medal", "🦪":"medal",
};
const FE_ASSET_TIER = [1,1,2,4,5,7,6];   // catch tier -> sprite tier
const FE_REVEAL_SIZE = { fish:20, shark:27, whale:31, squid:24, crab:20,
                         chest:22, bag:20, gem:16, medal:18 };
function feCatchSprite(icon, tier){
  const cls = FE_CLASS_BY_EMOJI[icon] || "fish";
  return { key: cls + FE_ASSET_TIER[tier], cls };
}

/* ------------------- 6 · SPOTS: WHERE YOU CAST ----------------------
   Four waters, each an honest trade the card states out loud. Odds are
   per-tier multipliers on the base catch table — visible reasoning,
   never hidden math. The Midnight Mark is the clock made into gameplay:
   its legendary water only truly opens after dark. */
const FE_SPOTS = [
  { id:"dock", name:"The Old Dock", icon:"🪵", cost:0,
    line:"Where it all started. A fair spread of everything.",
    odds:[1,1,1,1,1,1,1], bite:1, fight:1,
    dress:{ reeds:8, gulls:3, jumpM:1 } },
  { id:"shallows", name:"Reedy Shallows", icon:"🌾", cost:120000,
    line:"Quick bites in the weeds. Half of it is junk — and things wash up close to shore.",
    odds:[1.6,1.3,1,0.7,0.5,0.35,1.6], bite:0.75, fight:0.95,
    dress:{ tint:[128,186,118,0.11], reeds:17, both:true, gulls:3, jumpM:1.8, lilies:true, dragonM:2.2 } },
  { id:"ledge", name:"Deepwater Ledge", icon:"🪨", cost:900000,
    line:"Cold, deep, patient. Rare and Epic water — but everything down there fights harder.",
    odds:[0.5,0.7,1,1.8,1.9,1.15,0.8], bite:1.25, fight:1.12,
    dress:{ tint:[78,102,158,0.15], reeds:0, gulls:1, jumpM:0.55, big:true, fogM:1.7 } },
  { id:"midnight", name:"The Midnight Mark", icon:"🌙", cost:5000000,
    line:"A spot old-timers only whisper about. Legendary water — far more so after dark.",
    odds:[0.6,0.7,0.9,1.1,1.3,1.6,1], bite:1.15, fight:1.08, nightLegend:2.6,
    dress:{ tint:[116,88,164,0.12], reeds:5, gulls:2, jumpM:0.85, wisps:true, starM:1.3 } },
  { id:"reef", name:"The Coral Shelf", icon:"🪸", cost:25000000,
    line:"Warm turquoise water over living coral. Fish found nowhere else — and stranger things.",
    odds:[0.6,0.8,1.5,1.6,1.3,0.9,1.4], bite:0.95, fight:1.05,
    dress:{ tint:[92,208,196,0.13], reeds:0, gulls:2, jumpM:1.5, dragonM:1.6 } },
  { id:"confluence", name:"The Confluence", icon:"🌀", cost:0, gate:"legends",
    line:"Where all five waters meet. Everything swims here — and something that rules them all.",
    odds:[0.3,0.5,0.9,1.5,1.7,1.9,1.2], bite:1.1, fight:1.22,
    dress:{ tint:[110,140,190,0.10], reeds:6, gulls:2, jumpM:1.4, wisps:true, fogM:1.3, starM:1.2, big:true } }
];
function feSpots(){
  const inv = fshInv();
  if(!inv.spots) inv.spots = { cur:"dock", open:["dock"] };
  return inv.spots;
}
function feSpot(){ return FE_SPOTS.find(s=>s.id===feSpots().cur) || FE_SPOTS[0]; }
function feNight(){ return feEnv ? (feEnv.hour >= 21.5 || feEnv.hour < 4.5) : false; }

/* Catch odds pick up the spot's multipliers (and the Mark's night water). */
function fshRollCatch(castT, sweet){
  if(fsh && fsh.bossHook){
    const b = fsh.bossHook;
    const def = feBossDef(b);
    const sizeRoll = 0.95 + Math.random()*0.15;
    return { def, name:b.name, icon:b.icon, sizeRoll, valueMult:1, boss:b,
             weightLb: +(b.wLo + Math.random()*(b.wHi-b.wLo)).toFixed(1) };
  }
  const st = fshStats();
  const sp = feSpot();
  const score = castT*0.25 + (sweet?0.35:0) + st.luck*0.06;
  const weights = FSH_BASE_WEIGHTS.map((w,i)=> i===0 ? w/(1+score*3.0) : w*(1 + score*FSH_WEIGHT_SLOPE[i]*1.15));
  for(let i=0;i<weights.length;i++) weights[i] *= (sp.odds[i]||1);
  if(fsh && fsh.sightBias) for(const b of fsh.sightBias) weights[b] *= 2.4;
  if(sp.nightLegend && feNight()){ weights[5] *= sp.nightLegend; weights[6] *= 1.4; }
  const total = weights.reduce((a,b)=>a+b,0);
  let roll = Math.random()*total;
  let idx = 0;
  for(let i=0;i<weights.length;i++){ if(roll < weights[i]){ idx = i; break; } roll -= weights[i]; }
  const def = FSH_CATCH[idx];
  /* the world's habits gate what bites: conditional species only take
     when their hour/weather/water lines up; each tier keeps enough
     unconditional species that the water is never empty */
  const conds = feConds();
  let pool = def.items.filter(it=>feCondOk(conds[it[0]]));
  if(!pool.length) pool = def.items.filter(it=>!conds[it[0]]);
  if(!pool.length) pool = def.items;
  const item = pool[Math.floor(Math.random()*pool.length)];
  const boxNeed = item[0] === "Locked Strongbox" ? 1 + Math.floor(Math.random()*6) : 0;
  const sizeRoll = 0.75 + Math.random()*0.5;
  const valueMult = item[2] || 1;
  const wf = item[3] !== undefined ? item[3] : 1;
  return { def, name:item[0], icon:item[1], sizeRoll, valueMult, boxNeed,
           weightLb: Math.max(0.1, +((0.4 + def.tier*3.4) * sizeRoll * (0.6+Math.random()) * wf).toFixed(1)) };
}
/* Bite speed picks up the spot too. */
function fshLandCast(){
  const st = fshStats();
  fsh.phase = "waiting";
  fsh.castYards = Math.round(12 + fsh.castT*68);
  fsh.waitMs = (2000 + Math.random()*8000) * st.biteMult * feSpot().bite;
  fsh.waitTimer = 0;
  fsh.sightBias = null; fsh.bossHook = null;
  for(const sh of feShadows){
    if(Math.hypot(sh.x - fsh.bobX, sh.y - fsh.bobY) < sh.sz + (sh.bossOf ? 44 : 34)){
      if(sh.bossOf){
        const inv = feBossState();
        fsh.bossHook = sh.bossOf;
        feCineFramesLoad();
        inv.bossDay[sh.bossOf.spot] = inv.dayN;   // the attempt is spent on the hook
        saveState();
        fsh.waitMs = 750;
        feShadows = feShadows.filter(x=>x!==sh);
        fshFlash("Something ENORMOUS turned toward it…", "#ff5c8a");
        feSound("dive", { vol: 0.7 });
      } else {
        fsh.sightBias = sh.band; sh.hit = 1;
        fshFlash("Right on its nose!", "#ffd35c");
      }
      break;
    }
  }
  feSound("plunk", { vol: 0.55 });
  fsh.ripples.push({ x:fsh.bobX, y:fsh.bobY, t:0 });
  fsh.splash.push(...Array.from({length:9},(_,i)=>({
    x:fsh.bobX, y:fsh.bobY, vx:(Math.random()-0.5)*90, vy:-40-Math.random()*70, t:0
  })));
}

/* ---------------- 7 · TIDE & TACKLE: THE CATCH CARDS ----------------
   Every landed catch can pull a card from the 1,000-card Tide & Tackle
   line — and when your catch has its own subject in the set (catch a
   Rainbow Trout, pull a Rainbow Trout print), it usually does. Legendary
   catches after dark can reach the mythic plates (t13–15). */
/* Species whose Tide & Tackle subject goes by another name — only honest
   identities (a Steelhead IS a rainbow trout; a Tiger Muskie IS a muskellunge). */
const FE_TT_ALIAS = {
  "Pumpkinseed":"Pumpkinseed Sunfish", "River Roach":"Roach", "Common Dace":"Dace",
  "Arctic Grayling":"Grayling", "Brown Bullhead":"Bullhead Catfish",
  "Yellow Bullhead":"Bullhead Catfish", "Blue Catfish":"Channel Catfish",
  "Tiger Muskie":"Muskellunge", "Lake Muskie":"Muskellunge",
  "Tangled Seaweed":"Drifting Seaweed", "Steelhead":"Rainbow Trout",
};
const FE_TT_CHANCE = [0.05, 0.10, 0.20, 0.50, 1, 1, 1];         // by catch tier
/* Bands start at t2 because tiers 0-1 of the set are all bait and
   tackle — which the aquatic rule below removes from the pool. */
const FE_TT_BAND   = [[2,2],[2,3],[2,5],[4,7],[6,9],[9,12],[8,11]];
/* Only fish and things of the water come up on the line. Bait, tackle,
   boats, buildings and shore gear stay in the packs where they belong.
   Sunken artifacts and sea-myths count as things of the water. */
const FE_TT_BLOCK = new Set(["Dough Ball","Nightcrawler","Cricket","Corn Kernel Bait",
  "Bobber","Garden Worm","Tangled Line","Split Shot Sinker","Leech","Bent Pin Hook",
  "Barrel Swivel","Old Boot","Rusted Can","Snapped Leader","Fillet Knife","Rubber Waders",
  "Landing Net","Polarized Glasses","Bucket Hat","Wicker Creel","Cork Float","Minnow Bucket",
  "Tackle Tray","Chum Bucket","Crankbait","Muddler Minnow","Lead Jig","Soft Plastic Worm",
  "Spoon Lure","Thermos of Coffee","Elk Hair Caddis","Popper Lure","Spinnerbait","Woolly Bugger",
  "Jerkbait","Fishing Vest","Royal Coachman","Clouser Minnow","Ice Hut","Farm Pond","Trout Stream",
  "Jon Boat","Rowboat","Boathouse","Canoe","Wooden Dock","Split-Cane Fly Rod","Brass Fly Reel",
  "Center-Pin Reel","Fly-Tying Vise","Tournament Drag Reel","Bamboo Tenkara Rod","Hand-Carved Lure Box",
  "Carbon Surf Rod","The Old Lighthouse","Fisherman's Knot","The First Cast","The Endless Net"]);
let feTT = null;
function feTTInit(){
  if(feTT) return feTT;
  feTT = { all:[], bySubject:new Map(), byTier:[] };
  for(const c of cards){
    if(c.category !== "Tide & Tackle") continue;
    if(FE_TT_BLOCK.has(c.name.split(" — ")[0])) continue;
    feTT.all.push(c);
    const subj = c.name.split(" — ")[0];
    if(!feTT.bySubject.has(subj)) feTT.bySubject.set(subj, []);
    feTT.bySubject.get(subj).push(c);
    (feTT.byTier[c.rarity] = feTT.byTier[c.rarity] || []).push(c);
  }
  return feTT;
}
function feTTOwned(){
  const tt = feTTInit();
  let n = 0;
  for(const c of tt.all) if((state.owned[c.id]||0) > 0) n++;
  return n;
}
function feGrantCard(c){
  const owned = state.owned[c.id] || 0;
  if(owned === 0) state.miningBonus = (state.miningBonus||0) + MINE_BONUS_BY_TIER[c.rarity];
  state.owned[c.id] = owned + 1;
  return c;
}
function fePickFrom(list, lo, hi, rng){
  rng = rng || Math.random;
  let pool = list.filter(c=>c.rarity>=lo && c.rarity<=hi);
  /* if the band is empty, widen it one tier at a time — never leap to
     the whole pool, or a junk catch could hand over a mythic */
  for(let grow=1; !pool.length && grow<16; grow++){
    const a = Math.max(0, lo-grow), b = Math.min(15, hi+grow);
    pool = list.filter(c=>c.rarity>=a && c.rarity<=b);
  }
  if(!pool.length) pool = list.slice();
  /* one-of-a-kind tiers respect ownership, same rule the packs play by */
  const openPool = pool.filter(c=>!(UNIQUE_TIERS.has(c.rarity) && (state.owned[c.id]||0) > 0));
  if(openPool.length) pool = openPool;
  else pool = list.filter(c=>c.rarity < 11).length ? list.filter(c=>c.rarity < 11) : pool;
  /* lean toward the low end of the band so the top stays special */
  pool = pool.slice().sort((a,b)=>a.rarity-b.rarity);
  const k = Math.pow(rng(), 1.6);
  return pool[Math.min(pool.length-1, Math.floor(k*pool.length))];
}
function feAwardTT(catchObj, def, rng, force){
  rng = rng || Math.random;
  const tt = feTTInit();
  if(!tt.all.length) return null;
  if(!force && rng() >= FE_TT_CHANCE[def.tier]) return null;
  let [lo, hi] = FE_TT_BAND[def.tier];
  /* the mythic window: a legendary landed in the dark */
  if(def.tier === 5 && feNight()){
    const p = feSpot().id === "midnight" ? 0.06 : 0.03;
    if(rng() < p){ lo = 13; hi = 15; }
  }
  /* the mythic window ignores the subject line — the dark water gives
     you something beyond your catch, from the plates themselves */
  if(lo >= 13) return feGrantCard(fePickFrom(tt.all, lo, hi, rng));
  const line = tt.bySubject.get(FE_TT_ALIAS[catchObj.name] || catchObj.name);
  if(line && line.length && rng() < 0.65) return feGrantCard(fePickFrom(line, lo, hi, rng));
  return feGrantCard(fePickFrom(tt.all, lo, hi, rng));
}

/* fshLand, re-based on the original, with the Tide & Tackle award in
   place of the generic pull — payouts, counters, log all unchanged. */
/* ============== THE BOUNTY BOARD & THE OLD TIMER ==================== */
function feHash32(str){ let h=2166136261; for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619); } return (h>>>0); }
function feSpeciesPool(minT, maxT){
  const out = [];
  try{ for(let t=minT; t<=maxT; t++) for(const it of (FSH_CATCH[t].items||[])) out.push({ name: Array.isArray(it) ? it[0] : it.name, tier: t }); }catch(e){}
  return out;
}
const FE_RIVALS = ["Old Pete", "Marla Deeplines", "Cutbait Charlie", "Granny Sinker", "The Ferryman"];
function feBountyState(){
  const inv = fshInv();
  const day = new Date().toDateString();
  if(!inv.bounty || inv.bounty.day !== day){
    const pool = feSpeciesPool(2, 4);
    const mk = (i)=>{
      const h = feHash32(day + "#" + i);
      const kind = ["species","tier","quality","weather"][h % 4];
      if(kind === "species" && pool.length){
        const sp = pool[(h>>>3) % pool.length];
        const lb = 2 + ((h>>>7) % 18);
        return { kind, sp: sp.name, lb, txt: `Land a ${sp.name} over ${lb} lb`, cr: 1500 + i*1200, sc: 3 + i*2 };
      }
      if(kind === "tier"){
        const t = 3 + ((h>>>5) % 3);
        return { kind, t, txt: `Land any ${["","","","Rare","Epic","Legendary"][t]}${t<5?" or better":""} fish`, cr: 1200 + i*1200, sc: 3 + i*2 };
      }
      if(kind === "quality") return { kind, txt: "Land a ✨ Fine-or-better quality fish", cr: 1600 + i*1200, sc: 4 + i*2 };
      const wx = ["rain","fog","overcast"][(h>>>6) % 3];
      return { kind:"weather", wx, txt: `Land any fish in the ${wx === "overcast" ? "grey" : wx}`, cr: 1400 + i*1200, sc: 3 + i*2 };
    };
    const nB = 3 + (((state.upgrades && state.upgrades.boardPins)||0) ? 1 : 0);
    inv.bounty = { day, items: Array.from({length:nB}, (_,i)=>i).map(i => Object.assign(mk(i), { done:false, claimed:false })) };
  }
  const wk = (d => { const o=new Date(d.getFullYear(),0,1); return d.getFullYear()+"-W"+Math.ceil(((d-o)/864e5+o.getDay()+1)/7); })(new Date());
  if(!inv.week || inv.week.id !== wk){
    const h = feHash32(wk);
    const pool = feSpeciesPool(4, 5);
    const sp = pool.length ? pool[(h>>>4) % pool.length] : { name:"Bull Shark" };
    inv.week = { id: wk, rival: FE_RIVALS[h % FE_RIVALS.length], rivalFish: sp.name,
                 rivalLb: +(24 + (h % 460)/10).toFixed(1), best: null, claimed: false };
  }
  return inv;
}
function feBountyCheck(c, d){
  try{
    const inv = feBountyState();
    let struck = false;
    for(const b of inv.bounty.items){
      if(b.done) continue;
      const hit =
        (b.kind === "species" && c.name === b.sp && c.weightLb >= b.lb) ||
        (b.kind === "tier"    && d.tier >= b.t) ||
        (b.kind === "quality" && (c.q||0) >= 1) ||
        (b.kind === "weather" && typeof feEnv !== "undefined" && feEnv.weather === b.wx);
      if(hit){ b.done = true; struck = true; }
    }
    if(struck){ showToast("📜 Bounty struck — claim it at the board!"); fbSfxSafe("reward_good", 0.4);
      try{ window.feLedgerBump && feLedgerBump("fbounty"); }catch(e){} }
    if(!c.boss && d.tier >= 3){
      if(!inv.week.best || c.weightLb > inv.week.best.lb)
        inv.week.best = { name: c.name, lb: c.weightLb };
    }
  }catch(e){}
}
function feBountyBadge(){
  try{
    const inv = feBountyState();
    return inv.bounty.items.some(b => b.done && !b.claimed) ||
           (!inv.week.claimed && inv.week.best && inv.week.best.lb > inv.week.rivalLb);
  }catch(e){ return false; }
}
function feBountyOpen(){
  let m = document.getElementById("feBounty");
  if(m){ m.remove(); return; }
  const inv = feBountyState();
  m = document.createElement("div");
  m.id = "feBounty";
  const rows = inv.bounty.items.map((b,i)=>{
    const st = b.claimed ? `<span class="fb-done">✔ claimed</span>`
      : b.done ? `<button class="fe-secbtn fb-claim" data-claim="${i}">CLAIM 🪙${b.cr.toLocaleString()} · ♻️${b.sc}</button>`
      : `<span class="fb-wait">🪙${b.cr.toLocaleString()} · ♻️${b.sc}</span>`;
    return `<div class="fb-row ${b.done&&!b.claimed?"hot":""}"><span>${b.txt}</span>${st}</div>`;
  }).join("");
  const W = inv.week;
  const beat = W.best && W.best.lb > W.rivalLb;
  const wkRow = W.claimed
    ? `<div class="fb-row"><span>🏆 Record beaten this week — the water remembers.</span><span class="fb-done">✔</span></div>`
    : `<div class="fb-row ${beat?"hot":""}">
        <span>🏆 <b>${W.rival}</b> posted a <b>${W.rivalLb} lb ${W.rivalFish}</b>.<br>
        <i>Your best: ${W.best ? `${W.best.lb} lb ${W.best.name}` : "— nothing on the board yet"}</i></span>
        ${beat ? `<button class="fe-secbtn fb-claim" data-wk="1">CLAIM 🪙6,000 · ♻️12</button>` : `<span class="fb-wait">beat it</span>`}</div>`;
  m.innerHTML = `<div class="fej-head"><b>📜 The Bounty Board</b><button class="fe-secx" id="feBX">✕</button></div>
    <div class="fb-sub">Three marks a day. A rival record a week. The board resets with the sun.</div>
    ${rows}<div class="fb-div"></div>${wkRow}`;
  (document.fullscreenElement || document.body).appendChild(m);
  document.getElementById("feBX").onclick = ()=> m.remove();
  m.querySelectorAll("[data-claim]").forEach(el => el.onclick = ()=>{
    const b = inv.bounty.items[+el.dataset.claim];
    if(!b.done || b.claimed) return;
    b.claimed = true;
    state.credits += b.cr; state.fishing.totalCredits = (state.fishing.totalCredits||0) + b.cr;
    state.scrap = (state.scrap||0) + Math.round(b.sc * (1 + 0.12*((state.upgrades && state.upgrades.scrapMagnet)||0)));
    fbSfxSafe("finish", 0.5); saveState();
    try{ renderHeader(); }catch(e){}
    showToast(`📜 Bounty paid — 🪙${b.cr.toLocaleString()}`);
    m.remove(); feBountyOpen();
  });
  const wb = m.querySelector("[data-wk]");
  if(wb) wb.onclick = ()=>{
    if(inv.week.claimed) return;
    inv.week.claimed = true;
    const rp = ((state.upgrades && state.upgrades.rivalPurse)||0) ? 2 : 1;
    state.credits += 6000*rp; state.scrap = (state.scrap||0) + Math.round(12*rp*(1 + 0.12*((state.upgrades && state.upgrades.scrapMagnet)||0)));
    fbSfxSafe("perfect", 0.5); saveState();
    try{ renderHeader(); }catch(e){}
    showToast(`🏆 ${inv.week.rival} tips his hat. 🪙${(6000*(((state.upgrades && state.upgrades.rivalPurse)||0)?2:1)).toLocaleString()}`);
    m.remove(); feBountyOpen();
  };
}

/* heal saves poisoned by a NaN-credits log entry (NaN -> null in JSON) */
try{
  const fl = state && state.fishing && state.fishing.log;
  if(fl){
    let healed = false;
    for(const l of fl){
      if(!Number.isFinite(l.credits)){ l.credits = 0; healed = true; }
      if(!(l.tier >= 0 && l.tier <= 6)){ l.tier = 1; healed = true; }
    }
    if(healed){
      /* the host may have drawn (and banner'd) before this script ran —
         re-render clean and take the warning down */
      try{ saveState(); }catch(e){}
      try{ fshRenderLog(); renderFishingStats(); }catch(e){}
      try{
        window.__renderFails = (window.__renderFails||[]).filter(x=>!/fishing/.test(x));
        const w = document.getElementById("renderWarn");
        if(w && !window.__renderFails.length) w.remove();
      }catch(e){}
    }
  }
}catch(e){}
let FE_TEST_EVERY5 = false;  /* retired at the playtester's word, batch 122 */   /* TESTING: every fifth landed fish becomes
                                  the Rooster King's true-form fight.
                                  Flip to false to retire the test hook. */
function fshLand(){
  /* landing the Rooster King is not the end — it is the reveal */
  let c0 = fsh && fsh.catch;
  if(FE_TEST_EVERY5 && c0 && !c0.boss && !c0.boxNeed){
    const inv = fshInv();
    inv.testN = (inv.testN || 0) + 1;
    if(inv.testN % 5 === 0){
      const roster = [
        { name:"The Rooster King", art:"sp_rooster" },
        { name:"Old Ironjaw", art:"sp_ironjaw" },
        { name:"The Black Phantom", art:"sp_phantom" },
        { name:"The Marsh King", art:"sp_marsh" },
        { name:"The Pale Hunter", art:"sp_pale" },
      ];
      roster.push({ name:"The Drowned King", art:null });
      let cycle = ((inv.testN / 5) | 0) % 6;
      /* never the same Legend twice in a row, whatever the save state */
      if(roster[cycle].name === inv.lastCineBoss) cycle = (cycle + 1) % 6;
      const which = roster[cycle];
      inv.lastCineBoss = which.name;
      const bd = FE_BOSSES.find(b => b.name === which.name);
      fsh.catch = c0 = { name: which.name,
        boss: { name: which.name, art: which.art },
        def: FSH_CATCH[5], icon: "🐟", sizeRoll: 1.25, valueMult: 1,
        weightLb: +(bd ? bd.wLo + Math.random()*(bd.wHi - bd.wLo)
                       : 42 + Math.random()*44).toFixed(1) };
      showToast("⚡ The line goes HEAVY…");
    }
  }
  if(c0 && c0.boss && FE_CINE_BOSSES[c0.name] && !c0._trueForm){
    c0._trueForm = 1;
    /* park the underlying fight: with phase left at "reeling" and
       over="landed", fshTick called fshLand again next frame and the catch
       was recorded and paid BEHIND the cinematic, then paid again on the
       win (batch 119). feCineEnd restores the phase before landing. */
    fsh.phase = "cine";
    feCineStart(c0.name);
    return;
  }
  const c = fsh.catch, d = c.def, st = fshStats();
  const firstCatch = c.boss ? false : feJournalRecord(c.name, c.weightLb);
  if(c.boss){
    feBossRecord(c.name, c.weightLb);
    setTimeout(()=>feSound("finish", { vol: 0.6 }), 1000);
    setTimeout(()=>feSound("perfect", { vol: 0.5 }), 1500);
  }
  if(!state.fishing) state.fishing = defaultFishing();
  const wasBest = !state.fishing.best || c.weightLb > state.fishing.best.weightLb;

  const roll = (a,b)=> a + Math.random()*(b-a);
  let credits = Math.round(roll(d.cr[0], d.cr[1]) * c.sizeRoll * st.lootMult * (c.valueMult||1));
  const scrap = Math.round(roll(d.scrap[0], d.scrap[1]) * st.lootMult);
  const rep = Math.round(d.rep * c.sizeRoll * st.lootMult);
  /* the quality roll: every fish has a finish. Perfect ones shimmer. */
  if(((state.upgrades && state.upgrades.masterwork)||0) && !c.boxNeed) credits = Math.round(credits * 1.10);
  if(!c.boss && !c.boxNeed){
    const qr = Math.random();
    c.q = qr < 0.01 ? 3 : qr < 0.08 ? 2 : qr < 0.30 ? 1 : 0;
    credits = Math.round(credits * [1, 1.35, 1.9, 3][c.q]);
  }
  const chips = [`🪙 ${credits.toLocaleString()} Credits`];
  if(fsh.aimHit && !c.boxNeed){
    const bm = ((state.upgrades && state.upgrades.wideRing)||0) ? 1.25 : 1.15;
    credits = Math.round(credits * bm); chips.push("🎯 Bullseye ×" + bm);
  }
  if(fsh.chummed && !c.boxNeed){ credits = Math.round(credits * 1.2); chips.push("🪱 Chummed water ×1.2"); }
  if(c.q) chips.push(["","✨ FINE quality ×1.35","�a PRISTINE ×1.9","🌟 PERFECT ×3 — it shimmers"][c.q].replace("�a","💎"));
  if(c.q && state.fishing.journal[c.name]){
    const J = state.fishing.journal[c.name];
    if(!(J.q >= c.q)) J.q = c.q;
  }

  state.credits += credits;
  if(firstCatch) setTimeout(()=>feSound("perfect", { vol: 0.5 }), 650);
  if(d.tier >= 5 || wasBest) setTimeout(()=>feSound("finish", { vol: 0.5 }), 950);
  if(firstCatch){
    const bonus = Math.round(d.cr[1] * 1.2);
    state.credits += bonus;
    chips.push(`📖 New species! +🪙 ${bonus.toLocaleString()} · Journal ${feJournalCount()}/${feSpeciesTotal()}`);
    showToast(`📖 ${c.name} — new to the journal!`);
  }
  state.scrap = (state.scrap||0) + scrap;
  chips.push(`♻️ ${scrap.toLocaleString()} Scrap`);
  /* the Empire is gone; reputation rests */

  let boxChip = null;
  if(c.name === "Locked Strongbox"){
    const need = c.boxNeed || (1 + Math.floor(Math.random()*6));
    const key = feBestKeyFor(need);
    if(key){
      const r = feOpenStrongbox(need, key);
      boxChip = `🗝️ Opened with a T${key} key — 🪙 ${r.credits.toLocaleString()}${r.cardLine}`;
    } else {
      feKeys().strongboxes.push({ need });
      boxChip = `🔒 Locked tight — needs a T${need}+ key. It's in your hold.`;
    }
  }
  const keyT = feKeyRoll(d.tier);
  const card = feAwardTT(c, d);
  if(c.boss) chips.unshift(`👑 A LEGEND OF THE WATER — ${c.name} enters the journal`);
  if(boxChip) chips.push(boxChip);
  if(keyT) chips.push(`🗝️ A T${keyT} key came up with the line!`);
  if(card){
    chips.push(`🃏 ${card.emoji} ${card.name}`);
    chips.push(`🎴 Tide & Tackle ${feTTOwned()}/1000`);
  }
  if(d.xp){ grantBonusXP(d.xp); chips.push(`⭐ ${d.xp} XP`); }

  feAllLoopsStop();
  /* the landing stinger — a little theater, scaled to the moment:
     thunk → (big fish: heavy slam) → tier fanfare → (first catch: the
     perfect sting) → (legendary/treasure/new best: the full finish) */
  feSound("land", { vol: 0.55 });
  if(d.tier >= 3) setTimeout(()=>feSound("heavy", { vol: 0.5 }), 160);
  const FANFARE = ["junk","reward_common","reward_common","reward_good","reward_rare","reward_legend","treasure"];
  setTimeout(()=>feSound(FANFARE[d.tier]||"reward_common", { vol: 0.6 }), 340);
  const f = state.fishing;
  f.catches = (f.catches||0) + 1;
  const prop = feAwardProp(f.catches);
  if(prop){
    const n = feProps()[prop.key];
    chips.push(`${prop.icon} ${prop.name} ×${n} hauled up — ${prop.line}, permanent`);
    showToast(`${prop.icon} ${prop.name} joins the dock!`);
    setTimeout(()=>feSound("treasure", { vol: 0.6 }), 750);
  }
  f.byTier = f.byTier || {};
  f.byTier[d.tier] = (f.byTier[d.tier]||0) + 1;
  f.totalCredits = (f.totalCredits||0) + credits;
  if(!f.best || c.weightLb > f.best.weightLb) f.best = { name:c.name, icon:c.icon, weightLb:c.weightLb, tier:d.tier };
  f.log = f.log || [];
  f.log.unshift({ name:c.name, icon:c.icon, tier:d.tier, lb:c.weightLb,
                  credits: (Number.isFinite(credits) ? credits : 0) });
  feBountyCheck(c, d);
  try{
    if(!c.boss && !c.boxNeed && window.feLedgerBump){
      feLedgerBump("fish");
      if(d.tier >= 3) feLedgerBump("rarefish");
    }
  }catch(e){}
  if(!c.boss && !c.boxNeed && d.tier >= 1 && d.tier <= 2){
    const inv2 = fshInv();
    inv2.chumFish = (inv2.chumFish || 0) + 1;
    if(inv2.chumFish % 5 === 0) showToast("🪱 The grinder's ready — 5 scrap fish banked");
  }
  if(f.log.length > 12) f.log.pop();

  recomputePlayerXP();
  saveState(); renderHeader(); renderMiningStats();

  fshEnterResult({ failed:false, title:c.name, kind:"land", icon:c.icon, color:d.color,
    tag:d.label, tagColor:d.color, weight:c.weightLb, best:wasBest,
    spriteKey: (c.boss ? c.boss.art : null) || (c.boxNeed ? "chest"+c.boxNeed : null) || feSpeciesArt(c.name) || feCatchSprite(c.icon, d.tier).key,
    sub:`${c.weightLb} lb`, chips, card });
  fshRenderLog(); renderFishingStats();
}

/* -------------------- 8 · THE SPOT PICKER (UI) ---------------------- */

/* ---- SCENERY: what makes each water look like somewhere. ------------------
   The painting is one lake; the dress tints it. This layer adds the things
   the map promises - weed and murk in the Shallows, a cliff and cold swells
   at the Ledge, purple water with a glow and a shape beneath at the Mark,
   coral, caustics and darting fish at the Shelf, the five-colour whirlpool
   at the Confluence - and an arrival: when the water changes (not on the
   first frame after load), the view dims and a plank names where you are.
   The dock is left as painted; it is home, and the fishing suite samples
   it. Drawn in the scene's logical 800x560 space, between the water and
   the fisherman, then above the props, then over everything. */
const feScene = { id:null, t:0, last:0, arrive:0, bits:[], name:"" };
/* the scene space: the band is 800x560 but the canvas runs FE_OFF above it
   and on down to 1200-FE_OFF; the cast plank covers the last ~95px */
function feSceneBot(){ return 1200 - feBandOff(); }
function feSceneFloor(){ return 1200 - feBandOff() - 95; }
function feSceneTick(){
  const now = performance.now();
  const dt = feScene.last ? Math.min(0.05, (now - feScene.last)/1000) : 0.016;
  feScene.last = now; feScene.t += dt;
  const sp = feSpot(), id = sp.id;
  if(feScene.id !== id){
    const first = feScene.id === null;
    feScene.id = id; feScene.bits = feSceneSeed(id);
    if(!first){ feScene.arrive = 1.5; feScene.name = sp.icon + " " + sp.name; }
  }
  if(feScene.arrive > 0) feScene.arrive = Math.max(0, feScene.arrive - dt);
}
function feSceneSeed(id){
  const rnd = (n)=>{ const v = Math.sin(n*311.7 + id.length*13.1)*43758.5453; return v - Math.floor(v); };
  const n = { reef:24, midnight:18 }[id] || 0;
  return Array.from({length:n}, (_,i)=>({
    x: rnd(i)*FSH_W, y: FSH_SURF_END + 24 + rnd(i+50)*(feSceneFloor() - FSH_SURF_END - 60),
    s: 2 + rnd(i+90)*6, p: rnd(i+130)*6.28 }));
}
function feSceneWater(g, pal){
  feSceneTick();
  const id = feScene.id, t = feScene.t;
  if(id === "dock") return;
  g.save();
  if(id === "ledge"){
    /* long cold swells on the painted deep water */
    g.strokeStyle = "rgba(170,200,240,.12)"; g.lineWidth = 2;
    for(let i=0;i<5;i++){
      g.beginPath();
      const y = FSH_SURF_END + 20 + i*90 + Math.sin(t*0.5 + i)*5;
      for(let x=0; x<=FSH_W; x+=16){ const yy = y + Math.sin(x*0.02 + t*0.9 + i)*4; x ? g.lineTo(x, yy) : g.moveTo(x, yy); }
      g.stroke();
    }
  } else if(id === "midnight"){
    /* motes over the dark water and something long passing beneath */
    for(const b of feScene.bits){
      const a = 0.2 + 0.5*(0.5 + 0.5*Math.sin(t*2 + b.p));
      g.fillStyle = `rgba(220,200,255,${a.toFixed(2)})`;
      g.beginPath(); g.arc(b.x + Math.sin(t*0.4 + b.p)*20, b.y - 60 + Math.cos(t*0.3 + b.p)*20, 1.4, 0, 7); g.fill();
    }
    g.fillStyle = "rgba(6,2,18,.35)";
    g.beginPath(); g.ellipse(FSH_W*0.55 + Math.sin(t*0.35)*110, FSH_SURF_END + 150 + Math.sin(t*0.7)*10, 90, 14, Math.sin(t*0.35)*0.2, 0, 7); g.fill();
  } else if(id === "reef"){
    /* caustics and darting reef fish over the painted coral */
    g.strokeStyle = "rgba(220,255,250,.14)"; g.lineWidth = 1.5;
    for(let i=0;i<6;i++){
      g.beginPath();
      for(let x=0; x<=FSH_W; x+=14){
        const y = FSH_SURF_END + 30 + i*70 + Math.sin(x*0.05 + t*1.6 + i*1.3)*6 + Math.sin(x*0.013 - t + i)*5;
        x ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.stroke();
    }
    for(const b of feScene.bits){
      b.x += Math.sin(t*0.8 + b.p)*0.6*(b.s > 4 ? 1 : -1);
      if(b.x < -10) b.x = FSH_W + 10; if(b.x > FSH_W + 10) b.x = -10;
      const y = b.y + Math.sin(t*2 + b.p)*3, dir = b.s > 4 ? 1 : -1;
      g.fillStyle = b.s > 5 ? "#ff9a5c" : b.s > 3 ? "#ffd35c" : "#7ad0ff";
      g.beginPath(); g.ellipse(b.x, y, 5, 2.2, 0, 0, 7); g.fill();
      g.beginPath(); g.moveTo(b.x - 5*dir, y); g.lineTo(b.x - 9*dir, y - 3); g.lineTo(b.x - 9*dir, y + 3); g.closePath(); g.fill();
    }
  } else if(id === "confluence"){
    /* a slow sheen turning over the painted whirlpool (its eye, in band coords) */
    const cx = 536, cy = 363;
    g.save(); g.translate(cx, cy); g.scale(1, 0.5); g.globalAlpha = 0.16; g.strokeStyle = "#ffffff"; g.lineWidth = 3;
    for(let i=0;i<3;i++){ g.rotate(-t*0.35 + i*2.1); g.beginPath(); g.arc(0, 0, 70 + i*60, 0, 2.4); g.stroke(); }
    g.restore();
  }
  g.restore();
}
function feSceneFore(g, pal){
  const id = feScene.id, t = feScene.t;
  if(id === "shallows"){
    /* a low marsh mist lying on the painted water */
    g.save();
    const a = 0.14 + 0.06*Math.sin(t*0.7);
    const gr = g.createLinearGradient(0, FSH_HORIZON + 20, 0, FSH_HORIZON + 90);
    gr.addColorStop(0, "rgba(210,225,190,0)"); gr.addColorStop(0.5, `rgba(210,225,190,${a.toFixed(3)})`); gr.addColorStop(1, "rgba(210,225,190,0)");
    g.fillStyle = gr; g.fillRect(-FSH_W, FSH_HORIZON + 20, 3*FSH_W, 70);
    g.restore();
  }
}
function feSceneArrive(g){
  const k = feScene.arrive;
  if(k <= 0) return;
  const a = k > 1.2 ? (1.5 - k)/0.3 : Math.min(1, k/0.7);   /* in fast, hold, out slow */
  g.save();
  g.fillStyle = `rgba(4,8,16,${(0.55*a).toFixed(3)})`; g.fillRect(-FSH_W, -feBandOff(), 3*FSH_W, 1200);
  const w = 320, h = 56, x = FSH_W/2 - w/2, y = FSH_HORIZON - 96;   /* over the far shore, clear of the angler */
  g.globalAlpha = a;
  g.fillStyle = "#3a2614"; g.strokeStyle = "#b08a4a"; g.lineWidth = 2;
  g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, 10) : g.rect(x, y, w, h); g.fill(); g.stroke();
  g.fillStyle = "#f1d27b"; g.font = "bold 21px Georgia, 'Times New Roman', serif";
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(feScene.name, FSH_W/2, y + h/2);
  g.font = "bold 11px system-ui"; g.fillStyle = "#cfc9ba";
  g.fillText("you have arrived", FSH_W/2, y + h + 14);
  g.restore();
}

/* ---- THE MAP: the means of travel. The SPOTS shield and the sign open a
   painted chart of the six waters; every water is a pin at its place on
   the painting, wearing its Legend's name, and a boat sails from where you
   stand to the pin you tap before the spot actually changes. Locked waters
   are bought from the pin the same way the chips used to (feSpotTap). */
const FE_MAP_POS = { dock:[20,28], midnight:[44,13], ledge:[80,26], confluence:[52,45], shallows:[23,73], reef:[75,78] };
let feMapBusy = false;
function feMapEnsure(){
  let ov = document.getElementById("feSpotMap");
  if(ov) return ov;
  ov = document.createElement("div");
  ov.id = "feSpotMap";
  ov.innerHTML = `<div class="fsm-sheet" role="dialog" aria-label="The waters">
      <div class="fsm-head"><span class="fsm-title">The Waters</span>
        <button type="button" class="fsm-close" aria-label="Close">✕</button></div>
      <div class="fsm-map"><div class="fsm-pins"></div><div class="fsm-boat" aria-hidden="true">⛵</div></div>
      <div class="fsm-foot">tap a water to sail there · a locked water names its price</div>
    </div>`;
  document.body.appendChild(ov);
  ov.querySelector(".fsm-close").onclick = feMapClose;
  ov.addEventListener("click", e=>{ if(e.target === ov) feMapClose(); });
  window.addEventListener("keydown", e=>{ if(e.key === "Escape" && ov.classList.contains("open")) feMapClose(); });
  return ov;
}
function feMapPaint(){
  const ov = feMapEnsure(), box = ov.querySelector(".fsm-pins"), boat = ov.querySelector(".fsm-boat");
  const sp = feSpots();
  box.innerHTML = FE_SPOTS.map(d=>{
    const open = sp.open.includes(d.id), here = d.id === sp.cur, pos = FE_MAP_POS[d.id] || [50,50];
    const boss = FE_BOSSES.find(b=>b.spot === d.id);
    const lock = open ? "" : (d.gate === "legends" ? `<i>🔒 the five</i>`
      : `<i>🔒 ${d.cost>=1e6 ? (d.cost/1e6)+"M" : (d.cost/1e3)+"k"}</i>`);
    return `<button type="button" class="fsm-pin${here?" here":""}${open?"":" locked"}" data-spot="${d.id}"
        style="left:${pos[0]}%; top:${pos[1]}%">
        <b>${d.icon} ${d.name}</b><small>${boss ? boss.name : d.line}</small>${lock}${here ? `<em>you are here</em>` : ""}
      </button>`;
  }).join("");
  box.querySelectorAll(".fsm-pin").forEach(b=>{ b.onclick = ()=> feMapTravel(b.dataset.spot); });
  const cur = FE_MAP_POS[sp.cur] || [50,50];
  boat.style.transition = "none"; boat.style.left = cur[0]+"%"; boat.style.top = (cur[1]+9)+"%";
  void boat.offsetWidth; boat.style.transition = "";
}
function feMapOpen(e){
  if(e && e.preventDefault) e.preventDefault();
  feMapPaint();
  feMapEnsure().classList.add("open");
  try{ feAudioUnlock(); }catch(_){}
}
function feMapClose(){ const ov = document.getElementById("feSpotMap"); if(ov) ov.classList.remove("open"); feMapBusy = false; }
function feMapTravel(id){
  if(feMapBusy) return;
  const sp = feSpots(), d = FE_SPOTS.find(x=>x.id===id);
  if(!d) return;
  if(id === sp.cur){ feMapClose(); return; }
  const wasOpen = sp.open.includes(id);
  /* a locked water is bought first; the tap explains itself if it cannot be */
  if(!wasOpen && !feSpotTap(id)){ feMapPaint(); return; }
  /* an open water: sail there, then step ashore */
  const ov = feMapEnsure(), boat = ov.querySelector(".fsm-boat"), to = FE_MAP_POS[id] || [50,50];
  feMapBusy = true;
  boat.classList.add("sailing");
  boat.style.left = to[0]+"%"; boat.style.top = (to[1]+9)+"%";
  setTimeout(()=>{
    boat.classList.remove("sailing");
    if(wasOpen) feSpotTap(id);   /* switch happens on arrival; a purchase already switched */
    feMapPaint();
    setTimeout(feMapClose, 260);
  }, 780);
}
let feSpotHtml = "";
function feRenderSpots(){
  const bars = document.getElementById("fshBars");
  if(!bars) return;
  let row = document.getElementById("feSpotRow");
  if(!row){
    row = document.createElement("div");
    row.id = "feSpotRow";
    bars.parentNode.insertBefore(row, bars.nextSibling);   // spots live BELOW the fight bars
  }
  const sp = feSpots(), cur = feSpot();
  const busy = fsh && fsh.phase !== "idle" && fsh.phase !== "result";
  /* mid-cast the picker gets out of the way entirely — on a phone the
     tension and stamina bars need every pixel under your thumb */
  row.style.display = busy ? "none" : "block";
  if(busy) return;
  const night = feNight();
  const chips = FE_SPOTS.map(d=>{
    const open = sp.open.includes(d.id);
    const active = d.id === sp.cur;
    const cls = "fe-spot" + (active?" active":"") + (open?"":" locked") + (busy?" busy":"");
    const cost = open ? "" : (d.gate === "legends"
      ? `<i>🔒 the five</i>`
      : `<i>🔒 ${d.cost>=1e6 ? (d.cost/1e6)+"M" : (d.cost/1e3)+"k"}</i>`);
    return `<button class="${cls}" data-spot="${d.id}">${d.icon} ${d.name}${cost}</button>`;
  }).join("");
  const special = cur.nightLegend
    ? (night ? ` · 🌙 <b style="color:#ffcf40">the dark water is open — Legendary ×${cur.nightLegend}</b>`
             : ` · 🌙 Legendary ×${cur.nightLegend} after dark`)
    : "";
  /* the HUD plates: the SPOTS shield heads the picker and the wooden sign
     names where you are standing (its baked-in text was painted out) */
  const html = `<div class="fe-hud-head">
      <span class="fe-shield" aria-hidden="true"></span>
      <span class="fe-sign" title="Open the map"><b>${cur.icon} ${cur.name}</b></span>
      <span class="fe-mapcue">🗺️ tap the sign to sail</span>
    </div>
    <div class="fe-spots">${chips}</div>
    <div class="fe-spot-line">${cur.line}${special} · 🎴 ${feTTOwned()}/1000
      <button id="feMusicChip" class="fe-sfx">${fshInv().musicMute ? "🎵̸" : "🎵"}</button>
      <button id="feMixChip" class="fe-sfx">🎚️</button>
      <button id="feFullChip" class="fe-sfx" title="full screen">⛶</button>
      <button id="feChumChip" class="fe-sfx" title="chum">🪱</button>
      <button id="feTackleChip" class="fe-sfx" title="tackle shop">🧰</button>
      </div>
    <div class="fe-secrow">
      <button id="feJournalBtn" class="fe-secbtn">📖 Journal <i>${feJournalCount()}/${feSpeciesTotal()}</i></button>
      <button id="feBountyBtn" class="fe-secbtn">📜 Bounties${feBountyBadge() ? " <b class=\"fb-dot\">●</b>" : ""}</button>
      <button class="fe-secbtn" data-sec="stats">📊 Stats</button>
      <button class="fe-secbtn" data-sec="bucket">🪣 Bucket</button>
      <button class="fe-secbtn" data-sec="equip">🧰 Equipment</button>
    </div>`;
  if(html !== feSpotHtml){
    feSpotHtml = html;
    row.innerHTML = html;
    const bBtn = row.querySelector("#feBountyBtn");
    if(bBtn) bBtn.onclick = ()=>{ feAudioUnlock(); feBountyOpen(); };
    const jBtn = row.querySelector("#feJournalBtn");
    if(jBtn) jBtn.onclick = ()=>{ feAudioUnlock(); feSound("box_open",{vol:0.35}); feJournalOpen = !feJournalOpen; feRenderJournal(); };
    row.querySelectorAll("[data-sec]").forEach(b => b.onclick = ()=> feSecOpen(b.dataset.sec));
    const mixBtn = row.querySelector("#feMixChip");
    if(mixBtn) mixBtn.onclick = feMixerOpen;
    const chBtn = row.querySelector("#feChumChip");
    if(chBtn) chBtn.onclick = feChumOpen;
    const tkBtn = row.querySelector("#feTackleChip");
    if(tkBtn) tkBtn.onclick = ()=>{
      feAudioUnlock();
      let m = document.getElementById("feTackle");
      if(m){ m.remove(); return; }
      m = document.createElement("div");
      m.id = "feTackle";
      m.innerHTML = `<div class="fej-head"><b>🧰 The Tackle Shop</b><button class="fe-secx" id="feTkX">✕</button></div>
        <div class="fb-sub">Rods, reels, line, hooks, lures and clothes. Bait burns a piece per cast; charms run a set count.</div>
        <div id="tackleShop"></div>`;
      (document.fullscreenElement || document.body).appendChild(m);
      document.getElementById("feTkX").onclick = ()=> m.remove();
      try{ renderTackleShop(); }catch(e){}
    };
    const fsBtn = row.querySelector("#feFullChip");
    if(fsBtn) fsBtn.onclick = ()=>{
      const stage = document.querySelector("#tab-fishing .fsh-stage");
      const host = stage && stage.parentElement;   /* stage + controls travel together */
      try{
        if(document.fullscreenElement){ document.exitFullscreen(); }
        else if(host && host.requestFullscreen){ host.classList.add("fe-fs-host"); host.requestFullscreen({ navigationUI:"hide" }).catch(()=>{ host.classList.remove("fe-fs-host"); }); }
        else if(host && host.webkitRequestFullscreen){ host.classList.add("fe-fs-host"); host.webkitRequestFullscreen(); }
      }catch(e){}
    };
    if(!window.__feFsWatch){
      window.__feFsWatch = true;
      document.addEventListener("fullscreenchange", ()=>{
        if(!document.fullscreenElement){
          document.querySelectorAll(".fe-fs-host").forEach(el => el.classList.remove("fe-fs-host"));
          document.querySelectorAll(".fe-fs-exit").forEach(el => el.remove());
        } else {
          const host = document.fullscreenElement;
          if(host.classList && host.classList.contains("fe-fs-host") && !host.querySelector(".fe-fs-exit")){
            const x = document.createElement("button");
            x.className = "fe-fs-exit"; x.textContent = "✕";
            x.onclick = ()=>{ try{ document.exitFullscreen(); }catch(e){} };
            host.appendChild(x);
          }
        }
      });
    }
    const mChip = row.querySelector("#feMusicChip");
    if(mChip) mChip.onclick = ()=>{
      feAudioUnlock();
      fshInv().musicMute = !fshInv().musicMute;
      if(fshInv().musicMute){ feLoopStop("music"); feLoopStop("music_night"); feLoopStop("amb_water"); }
      saveState(); feSpotHtml=""; feRenderSpots();
    };
    row.querySelectorAll(".fe-spot").forEach(b=>{ b.onclick = ()=> feSpotTap(b.dataset.spot); });
    /* the SPOTS shield and the sign open the map - the means of travel */
    const sh = row.querySelector(".fe-shield"), sg = row.querySelector(".fe-sign");
    if(sh) sh.onclick = feMapOpen;
    if(sg) sg.onclick = feMapOpen;
  }
}
/* One tap on a water, from a chip or a map pin: switch to it if it is open,
   buy it if it is for sale, or explain the gate. Returns true when the
   player is now standing on it. */
function feSpotTap(id){
        const d = FE_SPOTS.find(x=>x.id===id);
        if(!d) return false;
        const spx = feSpots();
        if(fsh && fsh.phase !== "idle" && fsh.phase !== "result"){
          fshFlash("Finish this cast first", "#ffd35c"); return false;
        }
        if(spx.open.includes(d.id)){
          if(spx.cur !== d.id){ spx.cur = d.id; saveState(); showToast(`${d.icon} ${d.name}`);
            feSound("spot", { vol: 0.4 });
            feInitAmbient();                          // the water changes with the spot
            feSpotHtml=""; feRenderSpots(); }
          return true;
        }
        if(d.gate === "legends"){
          const BJ = (typeof feBossState === "function" ? feBossState().bossJournal : {}) || {};
          const five = ["Old Ironjaw","The Marsh King","The Black Phantom","The Pale Hunter","The Rooster King"];
          const slain = five.filter(n => BJ[n]).length;
          if(slain < 5){ showToast(`🌀 The Confluence answers only to those who've bested all five Legends (${slain}/5)`); return false; }
          spx.open.push(d.id); spx.cur = d.id;
          saveState(); feInitAmbient();
          showToast("🌀 THE FIVE WATERS PART — The Confluence is yours");
          fbSfxSafe("treasure", 0.6);
          feSpotHtml=""; feRenderSpots();
          return true;
        }
        if(state.credits < d.cost){ showToast(`Need 🪙 ${d.cost.toLocaleString()} for ${d.name}`); return false; }
        state.credits -= d.cost;
        spx.open.push(d.id); spx.cur = d.id;
        saveState(); renderHeader(); feInitAmbient();
        showToast(`${d.icon} ${d.name} unlocked!`);
        feSpotHtml=""; feRenderSpots();
        return true;
}

/* The rod is now the uploaded pole art — tier follows your equipped rod
   (bare hands t1 … Heirloom t6, and t7 for a maxed rod in mastered
   hands). The sprite is pre-rotated onto a horizontal strip once, then
   drawn in 12 slices along the live bend curve, so the art itself flexes
   under tension. Slice half-width tapers toward the tip to shed the
   sprite's painted dangling line. */
let feRodStrips = {};
function feRodTier(){
  const q = fshEqQ("rod");
  if(q === 5 && typeof fshSkillTier === "function" && fshSkillTier("rod") >= 5) return 7;
  return q + 1;
}
function feRodStrip(tier){
  if(feRodStrips[tier]) return feRodStrips[tier];
  const im = feImg("pole"+tier);
  if(!feImgOk(im)) return null;
  const [x0,y0,x1,y1] = FE_ROD_AXIS[tier];
  const AL = Math.hypot(x1-x0, y1-y0), ang = Math.atan2(y1-y0, x1-x0);
  const HW = 46;
  const cv = fshCv(Math.ceil(AL), HW*2);
  const c = cv.getContext("2d");
  c.translate(0, HW); c.rotate(-ang); c.translate(-x0, -y0);
  c.drawImage(im, 0, 0);
  feRodStrips[tier] = { cv, AL, HW };
  return feRodStrips[tier];
}
function feDrawRodSprite(g, b0x, b0y, cx, cy, tipX, tipY, strip){
  /* The pole art is a chunky icon; a rod on the water is a sliver. So the
     along-axis scale fits the gameplay length, while the perpendicular
     scale is squashed to 0.42 of it — at 15px nobody misses the reel's
     roundness, and the rod stops reading as a shouldered log. The first
     4% of the source (the butt cap) is trimmed so the grip sits in his
     hands, not across his chest. */
  const N = 12, SOFF = strip.AL*0.04, SLEN = strip.AL - SOFF;
  const Q = (t,a,c,b)=> (1-t)*(1-t)*a + 2*(1-t)*t*c + t*t*b;
  const len = Math.hypot(tipX-b0x, tipY-b0y);
  const scale = len/SLEN * 1.03;
  const perp = scale * 0.42;
  for(let i=0;i<N;i++){
    const t0=i/N, tm=(i+0.5)/N;
    const x = Q(tm,b0x,cx,tipX), y = Q(tm,b0y,cy,tipY);
    const dx = 2*(1-tm)*(cx-b0x) + 2*tm*(tipX-cx);
    const dy = 2*(1-tm)*(cy-b0y) + 2*tm*(tipY-cy);
    const th = Math.atan2(dy,dx);
    const segSrc = SLEN/N;
    const hw = 12 + 22*Math.max(0, 1 - tm/0.45);
    g.save(); g.translate(x,y); g.rotate(th);
    g.drawImage(strip.cv, SOFF + t0*SLEN, strip.HW-hw, segSrc, hw*2,
                -segSrc*scale/2 - 0.7, -hw*perp, segSrc*scale + 1.4, hw*2*perp);
    g.restore();
  }
  /* the reel itself, drawn whole and unsquashed at its true place on the
     blank — it's the piece that actually LOOKS upgraded tier to tier,
     and the perpendicular squash was cropping it out entirely */
  if(feDrawRodSprite._reel){
    const R = feDrawRodSprite._reel, im = feDrawRodSprite._img;
    const tm = R[4];
    const x = Q(tm,b0x,cx,tipX), y = Q(tm,b0y,cy,tipY);
    const dx = 2*(1-tm)*(cx-b0x) + 2*tm*(tipX-cx);
    const dy = 2*(1-tm)*(cy-b0y) + 2*tm*(tipY-cy);
    const th = Math.atan2(dy,dx);
    const w = 18, h = w * R[3]/R[2];
    g.save(); g.translate(x,y); g.rotate(th);
    g.drawImage(im, R[0], R[1], R[2], R[3], -w*0.3, -2, w, h);
    g.restore();
  }
}
function fshDrawRod(g, grip){
  let bend;
  if(fsh && fsh.phase === "reeling" && fsh.fight){
    const t = fsh.fight.tension / Math.max(1, feFightStats().maxTension);
    bend = 14 + t*46 + Math.sin(fshT*9)*(3 + t*6);
  } else {
    bend = (fsh && fsh.phase === "reeling") ? 26 + Math.sin(fshT*9)*7
         : (fsh && fsh.phase === "bite") ? 9 : (fsh && fsh.phase === "charging") ? -8 - fsh.power*0.14 : 3;
  }
  const bx = grip.gripX, by = grip.gripY;
  const sprite = fshBgReady && fshManReady;
  const st = FSH_ROD_STYLES[fshEqQ("rod")] || FSH_ROD_STYLES[0];
  const L = st.len;
  const tipX = bx + L, tipY = by - Math.round(L*0.56) + bend;
  const cx = bx + L*0.44, cy = by - L*0.37 + bend*0.35;
  const feTier = feRodTier();
  const strip = feRodStrip(feTier);
  if(strip){
    feDrawRodSprite._reel = FE_ROD_REEL[feTier];
    feDrawRodSprite._img = feImg("pole"+feTier);
    feDrawRodSprite(g, bx-6, by+10, cx, cy, tipX, tipY, strip);
    return { x:tipX, y:tipY };
  }
  g.strokeStyle = st.c2; g.lineWidth = st.w;
  g.beginPath(); g.moveTo(bx-14, by+18); g.quadraticCurveTo(cx, cy, tipX, tipY); g.stroke();
  g.strokeStyle = st.c1; g.lineWidth = Math.max(1.6, st.w*0.4);
  g.beginPath(); g.moveTo(bx-14, by+18); g.quadraticCurveTo(cx, cy, tipX, tipY); g.stroke();
  if(st.wraps){
    g.strokeStyle = st.wraps; g.lineWidth = 2.4;
    for(const t of [0.10, 0.16]){
      const qx = (1-t)*(1-t)*(bx-14) + 2*(1-t)*t*cx + t*t*tipX;
      const qy = (1-t)*(1-t)*(by+18) + 2*(1-t)*t*cy + t*t*tipY;
      g.beginPath(); g.moveTo(qx-1.5, qy-2.5); g.lineTo(qx+1.5, qy+2.5); g.stroke();
    }
    g.lineWidth = 1.3;
    for(let i=1; i<=st.guides; i++){
      const t = 0.25 + i*(0.68/st.guides);
      const qx = (1-t)*(1-t)*(bx-14) + 2*(1-t)*t*cx + t*t*tipX;
      const qy = (1-t)*(1-t)*(by+18) + 2*(1-t)*t*cy + t*t*tipY;
      g.strokeStyle = st.brass ? "#d4af37" : st.wraps;
      g.beginPath(); g.arc(qx, qy+2.2, 2.0, 0, 7); g.stroke();
    }
  }
  if(!sprite){
    g.strokeStyle = "#c9a06a"; g.lineWidth = 7;
    g.beginPath(); g.moveTo(bx-14, by+18); g.lineTo(bx+4, by+7); g.stroke();
    g.fillStyle = "#43506b"; g.beginPath(); g.arc(bx+9, by+11, 6.5, 0, 7); g.fill();
    g.strokeStyle = "#8fa2c9"; g.lineWidth = 1.6;
    const spin = (fsh && fsh.phase === "reeling") ? fshT*14 : fshT*0.6;
    g.beginPath(); g.moveTo(bx+9, by+11); g.lineTo(bx+9+Math.cos(spin)*5, by+11+Math.sin(spin)*5); g.stroke();
  }
  return { x:tipX, y:tipY };
}

/* The water's fiction stays fiction: named legends and invented species
   must never be sent to the encyclopedia — the Rooster King came back a
   rugby player. Bosses and pure inventions keep their portraits with no
   lookup at all; half-real names alias to their true species. */
const FE_PIC_SKIP = new Set([
  "Old Ironjaw","The Marsh King","The Pale Hunter","The Rooster King","The Black Phantom",
  "The Old Man of the Lake","Silverscale Leviathan","Locked Strongbox","Crowned Seahorse",
]);
const FE_PIC_ALIAS2 = {
  "Moonlit Eel":"Electric eel","Thunderfin Marlin":"Atlantic blue marlin",
  "Rainbow Serpent Eel":"Moray eel","Frost Whale Calf":"Beluga whale",
  "Abyssal Anglerfish":"Anglerfish","Kraken Hatchling":"Giant squid",
  "Megalodon Pup":"Megalodon","Ghost Koi":"Koi","Golden Koi":"Koi",
  "Reef Seahorse":"Seahorse","Coral Grouper":"Roving coral grouper",
  "Peacock Flounder":"Peacock flounder","Blue Tilapia":"Blue tilapia",
  "Queen Angelfish":"Queen angelfish","Damselfish":"Damselfish","Fusilier":"Fusilier fish",
  "Napoleon Wrasse":"Humphead wrasse","Roosterfish":"Roosterfish","Permit":"Permit (fish)",
  "Clownfish":"Clownfish","Blue Tang":"Paracanthurus","Parrotfish":"Parrotfish",
  "Peacock Bass":"Peacock bass",
};
function fshPicSubject(name){
  return FE_PIC_ALIAS2[name] || FSH_PIC_ALIAS[name] || name;
}
function fshPrefetchPic(name){
  if(FE_PIC_SKIP.has(name)) return;
  try{ ciLookup(fshPicSubject(name)); }catch(e){}
}

/* The photo loader, with a voice: when the wiki lookup comes back empty
   the card SAYS so instead of silently showing the sprite forever —
   if the caption appears with the internet up, something in the player's
   setup is blocking wikipedia.org and now they can tell us. */
function fshLoadResultPhoto(r){
  if(r.failed || !r.title) return;
  if(FE_PIC_SKIP.has(r.title)) return;      // legends keep their portraits
  const token = ++fshPicToken;
  ciLookup(fshPicSubject(r.title)).then(entry=>{
    if(token !== fshPicToken) return;
    const ph = document.getElementById("fshResultPhoto");
    if(!ph) return;
    if(!entry || !entry.img){
      if(!ph.querySelector(".rNoPhoto")){
        const cap = document.createElement("span");
        cap.className = "rNoPhoto";
        cap.textContent = "📷 no photo — offline or wikipedia blocked";
        ph.appendChild(cap);
      }
      return;
    }
    ph.innerHTML = `<img src="${entry.img}" alt="${r.title}">
      <span class="rPhotoIcon">${r.icon || ""}</span>`;
    const im = ph.querySelector("img");
    if(im) im.addEventListener("error", ()=>{
      ph.innerHTML = `<div class="rIcon">${r.icon || "🎣"}</div>`;
    });
  });
}

/* Per-species art from the two uploaded fish packs: the RESULT CARD and
   the JOURNAL show each species' own portrait (the painted scene keeps
   its tiered class art — pixel fish leaping from painted water clashed,
   the same reason the Beowulf pack sat out). */
function feSpeciesArt(name){
  return (typeof FE_SPECIES_ART !== "undefined" && FE_SPECIES_ART[name]) || null;
}

/* ============ THE TALL WATER: 2:3 full-screen conversion ============
   The new painting is 800x1200 logical. Waterlines were aligned so the
   whole legacy scene (casts, fights, dock, props, stars) runs unchanged
   in its 800x560 space, translated FE_OFF down onto the band where the
   action lives. Sky above and deep water below come straight from the
   painting. */
const FE_OFF = 292;
/* ---- one painting per water (batch 111). Every painting puts its pier
   somewhere else, so the whole gameplay band - casts, fights, angler, props,
   tints, stars - is translated by that painting's offset (FE_SPOT_BAND) on
   top of FE_OFF, and the far-shore ridge for the stars comes from that
   painting's own sample (FE_SPOT_RIDGE). The dock keeps the original
   painting with its painted angler, cover and sun-cover machinery; on the
   other waters the angler is that same painted man, cut out by his matte
   and stamped onto the new pier. */
let feBgSpot = "lake";   /* "lake" = the host's original painting, shown only until the dock painting decodes */
const feBgCache = {};
function feBandInfo(){
  const id = (typeof feSpot === "function" && feSpot().id) || "dock";
  return (typeof FE_SPOT_BAND !== "undefined" && FE_SPOT_BAND[id]) || { dx:0, dy:0 };
}
function feBandOff(){ return FE_OFF + feBandInfo().dy; }
function feBandDx(){ return feBandInfo().dx; }
/* how much night is on the painted skies: ramps in over dusk (20.2-21.5)
   and out over dawn (4.8-6.3), the same edges the dock's sun-cover uses */
function feNightAmt(){
  if(!feEnv) return 0;
  const h = feEnv.hour;
  if(h >= 20.2) return Math.min(1, (h - 20.2)/1.3);
  if(h < 4.8) return 1;
  if(h < 6.3) return 1 - (h - 4.8)/1.5;
  return 0;
}
/* the painted planks end at band x 320 on every water (that is what the
   offset aligns); a pier that starts closer to that end scales the deck
   furniture toward it so nothing hangs over the water */
function feDeckX(x){ const k = Math.min(1, (320 + feBandDx())/320); return 320 - (320 - x)*k; }
/* ridge in band coordinates for the current water */
function feRidgeBand(x){
  const id = (typeof feSpot === "function" && feSpot().id) || "dock";
  const k = Math.max(0, Math.min(100, Math.round(x/8)));
  if(typeof FE_SPOT_RIDGE !== "undefined" && FE_SPOT_RIDGE[id]) return FE_SPOT_RIDGE[id][k] - feBandOff();
  return (typeof FE_RIDGE !== "undefined") ? FE_RIDGE[k] : 200;
}
function feApplySpotBg(){
  if(fshBgImg && !feBgCache.lake && feBgSpot === "lake") feBgCache.lake = fshBgImg;
  const id = (typeof feSpot === "function" && feSpot().id) || "dock";
  const want = (typeof FE_SPOT_BG !== "undefined" && FE_SPOT_BG[id]) ? id : "lake";
  if(want === feBgSpot) return;
  if(want === "lake"){
    if(feBgCache.lake){ fshBgImg = feBgCache.lake; fshBgReady = !!(fshBgImg.complete && fshBgImg.naturalWidth); feBgSpot = "lake"; }
    return;
  }
  let im = feBgCache[want];
  if(!im){ im = new Image(); im.src = FE_SPOT_BG[want]; feBgCache[want] = im; }
  if(im.complete && im.naturalWidth){ fshBgImg = im; fshBgReady = true; feBgSpot = want; }
  else im.onload = ()=>{ feApplySpotBg(); };   /* the old painting stays up until the new one has decoded */
}
/* decode the five paintings early so the first sail is not a blank */
try{ if(typeof FE_SPOT_BG !== "undefined") for(const k in FE_SPOT_BG){ const im = new Image(); im.src = FE_SPOT_BG[k]; feBgCache[k] = im; } }catch(e){}
function fshBobberTarget(t){
  return { x: 380 + t*366, y: 470 - t*160 };
}
function fshDrawSky(g){
  if(fshBgReady){
    g.save(); g.setTransform(2,0,0,2,0,0);
    g.drawImage(fshBgImg, 0, 0, FSH_W, 1200);
    /* the painted sun cannot be dimmed away — at night it is painted
       OVER with clean sky borrowed from the sun-free left, faded in
       with the dark */
    const nAmt = (function(){
      if(!feEnv) return 0;
      const h = feEnv.hour;
      if(h >= 20.2 || h < 4.8){ return Math.min(1, h >= 20.2 ? (h-20.2)/1.3 : 1); }
      return 0;
    })();
    if(nAmt > 0.01 && feBgSpot === "lake"){
      if(!fshDrawSky._sunCover){
        try{
          const sc = document.createElement("canvas");
          sc.width = 360; sc.height = 380;
          const scg = sc.getContext("2d");
          const fx3 = fshBgImg.naturalWidth/800, fy3 = fshBgImg.naturalHeight/1200;
          scg.drawImage(fshBgImg, 30*fx3, 0, 340*fx3, 370*fy3, 0, 0, 360, 380);
          scg.globalCompositeOperation = "destination-out";
          const el = scg.createLinearGradient(0, 0, 44, 0);
          el.addColorStop(0, "rgba(0,0,0,1)"); el.addColorStop(1, "rgba(0,0,0,0)");
          scg.fillStyle = el; scg.fillRect(0, 0, 44, 380);
          const eb2 = scg.createLinearGradient(0, 336, 0, 380);
          eb2.addColorStop(0, "rgba(0,0,0,0)"); eb2.addColorStop(1, "rgba(0,0,0,1)");
          scg.fillStyle = eb2; scg.fillRect(0, 336, 360, 44);
          fshDrawSky._sunCover = sc;
        }catch(e){ fshDrawSky._sunCover = "failed"; }
      }
      if(fshDrawSky._sunCover !== "failed"){
        g.globalAlpha = nAmt;
        g.drawImage(fshDrawSky._sunCover, 452, 0);
        g.globalAlpha = 1;
      }
    }
    g.restore();
    if(feBgSpot === "lake") feCoverAndBoat(g);
  } else if(typeof fshBackdrop !== "undefined" && fshBackdrop){ g.drawImage(fshBackdrop, 0, 0); }
  /* ambient ripples — the water moves everywhere, thickest around the
     dock legs and the moored boat */
  if(!fshDrawSky._rip) fshDrawSky._rip = [];
  const RIP = fshDrawSky._rip;
  if(Math.random() < 0.045){
    const zone = Math.random();
    let rx, ry;
    if(zone < 0.4){ rx = 30 + Math.random()*190; ry = 700 + Math.random()*80; }       /* dock legs */
    else if(zone < 0.75){ rx = 60 + Math.random()*250; ry = 990 + Math.random()*110; } /* the boat */
    else { rx = 380 + Math.random()*380; ry = 620 + Math.random()*420; }               /* open water */
    RIP.push({ x: rx, y: ry, t: 0, max: 2.2 + Math.random()*1.4, big: zone >= 0.75 });
  }
  g.save(); g.setTransform(2,0,0,2,0,0);
  for(const q of RIP){
    q.t += 1/60;
    const lt = q.t/q.max;
    if(lt >= 1) continue;
    g.globalAlpha = (1-lt) * 0.16;
    g.strokeStyle = "#dceefc"; g.lineWidth = 1.1;
    const rr2 = 4 + lt * (q.big ? 52 : 34);
    g.beginPath(); g.ellipse(q.x, q.y, rr2, rr2*0.32, 0, 0, 7); g.stroke();
    g.globalAlpha = 1;
  }
  fshDrawSky._rip = RIP.filter(q => q.t < q.max);
  g.restore();
  /* the animated streak field ends at the old band floor — these keep
     the deep water alive all the way down */
  if(!fshDrawSky._drift){
    fshDrawSky._drift = Array.from({length:24},(_,i)=>({
      x: (i*127.3)%800, y: 575 + (i*331.7)%560, w: 26+(i*53)%64, sp: 3+(i*29)%11 }));
  }
  g.save(); g.setTransform(2,0,0,2,0,0);
  g.strokeStyle = "rgba(255,255,255,0.10)"; g.lineWidth = 1.6;
  for(const d of fshDrawSky._drift){
    const ox = Math.sin(fshT*0.12 + d.y)*14;
    const dx0 = ((d.x+fshT*d.sp)%860)-30+ox;
    if(dx0 < 440 && d.y > 875 && d.y < 1075){ continue; }  /* keep off the boat */
    g.beginPath(); g.moveTo(dx0, d.y);
    g.lineTo(dx0+d.w, d.y);
    g.stroke();
  }
  g.restore();
  /* everything after the sky lives on the band */
  g.translate(feBandDx(), feBandOff());
  /* the marksman's ring, while the cast is still yours to make */
  if(feAim && fsh && (fsh.phase === "idle" || fsh.phase === "charging" || fsh.phase === "casting")){
    const pu = 0.6 + 0.4*Math.sin(fshT*3 + feAim.ph);
    g.globalAlpha = 0.5 * pu;
    g.strokeStyle = "#ffd35c"; g.lineWidth = 2;
    g.beginPath(); g.ellipse(feAim.x, feAim.y, ((state.upgrades && state.upgrades.wideRing)||0) ? 46 : 34, ((state.upgrades && state.upgrades.wideRing)||0) ? 17 : 13, 0, 0, 7); g.stroke();
    g.globalAlpha = 0.3 * pu;
    g.beginPath(); g.ellipse(feAim.x, feAim.y, 20, 7.6, 0, 0, 7); g.stroke();
    g.globalAlpha = 1;
  }
}
function fshDrawReflection(g){ /* the painting carries its own mirror */ }
let feCoverCv = null;
function feSampleBg(x, y){
  if(!feSampleBg._cv){
    const c = document.createElement("canvas");
    c.width = 800; c.height = 1200;
    c.getContext("2d").drawImage(fshBgImg, 0, 0, 800, 1200);
    feSampleBg._cv = c;
  }
  const d = feSampleBg._cv.getContext("2d").getImageData(x, y, 1, 1).data;
  return `rgb(${d[0]},${d[1]},${d[2]})`;
}
function feCoverAndBoat(g){
  /* The painted reflection under the dock carried the old clutter and a
     few stray stalks. Per the playtester's call: no patched mirrors —
     a soft-edged cover in the painting's own water colors, and a moored
     rowboat rocking over it. */
  if(!feCoverCv){
    try{
      const c = document.createElement("canvas");
      c.width = 330; c.height = 400;   /* covers logical (0,820)-(330,1220) */
      const cg = c.getContext("2d");
      const vg = cg.createLinearGradient(0, 0, 0, 400);
      vg.addColorStop(0, feSampleBg(350, 826));
      vg.addColorStop(0.35, feSampleBg(350, 960));
      vg.addColorStop(1, feSampleBg(340, 1195));
      cg.fillStyle = vg; cg.fillRect(0, 0, 330, 400);
      /* the painting's water is alive with soft horizontal strokes and
         faint light shafts — a flat gradient reads as a blur patch, so
         the same texture is rebuilt here, seeded */
      const rr = (n)=>{ const v = Math.sin(n*127.1+311.7)*43758.5453; return v-Math.floor(v); };
      for(let i=0;i<64;i++){
        const sy = rr(i)*392+4, sx = rr(i+90)*300, sw = 18+rr(i+180)*88;
        cg.strokeStyle = `rgba(235,248,255,${0.035+rr(i+270)*0.075})`;
        cg.lineWidth = 1 + rr(i+360)*1.4;
        cg.beginPath(); cg.moveTo(sx, sy); cg.lineTo(sx+sw, sy); cg.stroke();
      }
      for(let i=0;i<7;i++){
        const bx = 20+rr(i+500)*290, bw = 16+rr(i+560)*30;
        const sg = cg.createLinearGradient(bx, 0, bx+bw*1.6, 400);
        sg.addColorStop(0, "rgba(220,240,255,0.05)");
        sg.addColorStop(0.5, "rgba(220,240,255,0.028)");
        sg.addColorStop(1, "rgba(220,240,255,0)");
        cg.fillStyle = sg;
        cg.save(); cg.translate(bx, 0); cg.transform(1, 0, -0.22, 1, 0, 0);
        cg.fillRect(0, 0, bw, 400); cg.restore();
      }
      /* the stalks climb higher on the far left — a narrow tongue reaches
         up for them, feathered on its own edges */
      const tg = cg.createLinearGradient(0, -130, 0, -80);
      /* (drawn into main canvas space below via a second fill) */
      cg.globalCompositeOperation = "destination-out";
      const er = cg.createLinearGradient(252, 0, 330, 0);
      er.addColorStop(0, "rgba(0,0,0,0)"); er.addColorStop(1, "rgba(0,0,0,1)");
      cg.fillStyle = er; cg.fillRect(252, 0, 78, 400);
      const et = cg.createLinearGradient(0, 0, 0, 34);
      et.addColorStop(0, "rgba(0,0,0,1)"); et.addColorStop(1, "rgba(0,0,0,0)");
      cg.fillStyle = et; cg.fillRect(0, 0, 380, 34);
      const eb = cg.createLinearGradient(0, 366, 0, 400);
      eb.addColorStop(0, "rgba(0,0,0,0)"); eb.addColorStop(1, "rgba(0,0,0,1)");
      cg.fillStyle = eb; cg.fillRect(0, 366, 380, 34);
      feCoverCv = c;
    }catch(e){ feCoverCv = "failed"; }
  }
  if(feCoverCv && feCoverCv !== "failed"){
    g.drawImage(feCoverCv, 0, 820);
    if(!feCoverCv.tongue){
      const t2 = document.createElement("canvas");
      t2.width = 100; t2.height = 150;
      const tg2 = t2.getContext("2d");
      const vg2 = tg2.createLinearGradient(0, 0, 0, 140);
      vg2.addColorStop(0, feSampleBg(140, 696));
      vg2.addColorStop(1, feSampleBg(120, 836));
      tg2.fillStyle = vg2; tg2.fillRect(0, 0, 100, 150);
      const r3 = (n)=>{ const v = Math.sin(n*91.3+77.7)*24634.62; return v-Math.floor(v); };
      for(let i=0;i<14;i++){
        const sy = r3(i)*144+3, sx = r3(i+40)*80, sw = 12+r3(i+80)*36;
        tg2.strokeStyle = `rgba(235,248,255,${0.04+r3(i+120)*0.06})`;
        tg2.lineWidth = 1 + r3(i+160)*1.2;
        tg2.beginPath(); tg2.moveTo(sx, sy); tg2.lineTo(sx+sw, sy); tg2.stroke();
      }
      tg2.globalCompositeOperation = "destination-out";
      const te = tg2.createLinearGradient(74, 0, 100, 0);
      te.addColorStop(0, "rgba(0,0,0,0)"); te.addColorStop(1, "rgba(0,0,0,1)");
      tg2.fillStyle = te; tg2.fillRect(74, 0, 26, 150);
      const tt = tg2.createLinearGradient(0, 0, 0, 30);
      tt.addColorStop(0, "rgba(0,0,0,1)"); tt.addColorStop(1, "rgba(0,0,0,0)");
      tg2.fillStyle = tt; tg2.fillRect(0, 0, 100, 30);
      feCoverCv.tongue = t2;
    }
    g.drawImage(feCoverCv.tongue, 0, 686);
  }
  /* the rowboat, moored and rocking */
  const t = fshT || 0;
  const rock = Math.sin(t*0.7)*0.045, bob = Math.sin(t*0.7+1.1)*3.4;
  g.save();
  /* nearer than the dock — so bigger than the man, not smaller */
  g.translate(178, 948 + bob); g.rotate(rock); g.scale(2.6, 2.6);
  /* mooring rope up to the dock */
  g.strokeStyle = "rgba(70,52,34,0.9)"; g.lineWidth = 1.8;
  g.beginPath(); g.moveTo(-58, -8);
  g.quadraticCurveTo(-72, -34, -64, -62 - bob*0.4);
  g.stroke();
  /* hull */
  const hull = g.createLinearGradient(0, -14, 0, 18);
  hull.addColorStop(0, "#8a6242"); hull.addColorStop(0.5, "#6e4b2f"); hull.addColorStop(1, "#4e3320");
  g.fillStyle = hull;
  g.beginPath();
  g.moveTo(-66, -10);
  g.quadraticCurveTo(-70, 10, -46, 16);
  g.lineTo(48, 16);
  g.quadraticCurveTo(72, 10, 66, -10);
  g.quadraticCurveTo(30, -4, 0, -4);
  g.quadraticCurveTo(-30, -4, -66, -10);
  g.fill();
  /* rim light + plank lines */
  g.strokeStyle = "#caa06c"; g.lineWidth = 2;
  g.beginPath(); g.moveTo(-66, -10); g.quadraticCurveTo(-30, -4, 0, -4);
  g.quadraticCurveTo(30, -4, 66, -10); g.stroke();
  g.strokeStyle = "rgba(40,26,15,0.5)"; g.lineWidth = 1;
  for(const yy of [2, 8, 13]){ g.beginPath(); g.moveTo(-58+yy*2, yy); g.lineTo(56-yy*2, yy); g.stroke(); }
  /* bench */
  g.fillStyle = "#5d3f27"; g.fillRect(-14, -6, 28, 5);
  /* oars laid across the gunwales */
  g.strokeStyle = "#7a5a3a"; g.lineWidth = 2.6;
  g.beginPath(); g.moveTo(-44, -8); g.lineTo(40, -16); g.stroke();
  g.beginPath(); g.moveTo(-38, -6); g.lineTo(46, -12); g.stroke();
  g.fillStyle = "#8f6a44";
  g.beginPath(); g.ellipse(43, -16.5, 8, 3, -0.1, 0, 7); g.fill();
  g.beginPath(); g.ellipse(49, -12.4, 8, 3, -0.07, 0, 7); g.fill();
  /* waterline shadow under the hull */
  g.fillStyle = "rgba(8,20,32,0.30)";
  g.beginPath(); g.ellipse(0, 17, 66, 7, 0, 0, 7); g.fill();
  g.restore();
}
/* ---- THE ANGLER (batch 113): a two-layer sprite, body over legs, on a
   332x600 canvas rendered from the Meshy model. Frame in band coords: he
   sits with the front of his seat just behind the plank end (band x 320)
   on the deck surface (band y 330), which is what every painting's band offset
   aligns. The legs swing around the hip, the body breathes and sways,
   reeling pumps the rod; the rod is drawn from the returned grip. The
   painted-man matte and patch are gone. */
/* 314x600 three-quarter render, 170 band px tall (15% down from the first
   cut); seat line 68% / hip 40%,58% / hands 85%,45% of the canvas, the
   front of his seat set 14px back from the plank end so the thighs rest
   on the planks and only the shins hang */
const FE_MAN = { x:263, y:214, w:89, h:170, ax:299, ay:313, gripX:335, gripY:283, hipX:299, hipY:313 };   /* grip lifted into his hands */
const feManBody = new Image(), feManLegs = new Image();
try{ if(typeof FE_MAN_BODY !== "undefined"){ feManBody.src = FE_MAN_BODY; feManLegs.src = FE_MAN_LEGS; } }catch(e){}
function feManReady(){ return feManBody.complete && feManBody.naturalWidth > 0 && feManLegs.complete && feManLegs.naturalWidth > 0; }
function fshDrawFisherman(g){
  const M = FE_MAN;
  if(!feManReady()) return { gripX: M.gripX, gripY: M.gripY };   /* the grip must ALWAYS return */
  const t = (typeof fshT === "number") ? fshT : 0;
  const snap = v => Math.round(v*2)/2;
  const reeling = fsh && fsh.phase === "reeling", charging = fsh && fsh.phase === "charging";
  const bob = snap(Math.sin(t*1.25)*1.0 + Math.sin(t*0.31)*0.5);
  let ang = Math.sin(t*0.55)*0.011;
  const breathe = 1 + Math.sin(t*1.25 + 0.7)*0.006;
  let crankX = 0, crankY = 0;
  if(reeling){
    const p = t*2*Math.PI*1.9, heave = Math.pow(Math.max(0, Math.sin(p)), 1.5);
    ang += -0.030*heave + 0.006*Math.sin(p*2);
    crankX = Math.cos(p*2)*1.1; crankY = Math.sin(p*2)*1.1;
  } else if(charging){ ang -= 0.020 + ((fsh.power||0)/100)*0.022; }
  const legAng = (Math.sin(t*1.05)*0.030 + Math.sin(t*0.63 + 1.3)*0.013)*(reeling ? 0.3 : 1) + (reeling ? -0.018 : 0);
  /* contact shadow on the planks, under his seat */
  g.save(); g.globalAlpha = 0.22; g.fillStyle = "#101820";
  g.beginPath(); g.ellipse(M.x + M.w*0.28, 329, M.w*0.24, 3.2, 0, 0, 7); g.fill(); g.restore();
  g.save(); g.translate(M.hipX, M.hipY + bob); g.rotate(legAng); g.translate(-M.hipX, -M.hipY);
  g.drawImage(feManLegs, M.x, M.y, M.w, M.h); g.restore();
  g.save(); g.translate(M.ax, M.ay + bob); g.rotate(ang); g.scale(1, breathe); g.translate(-M.ax, -M.ay);
  g.drawImage(feManBody, M.x, M.y, M.w, M.h); g.restore();
  const ca = Math.cos(ang), sa = Math.sin(ang), rx = M.gripX - M.ax, ry = M.gripY - M.ay;
  return { gripX: M.ax + crankX + rx*ca - ry*sa, gripY: M.ay + bob + crankY + (rx*sa + ry*ca)*breathe };
}

/* -------------- 8b · DOCK COMFORTS: CAUGHT, KEPT, STACKED ----------
   Five props live on the dock. Fish one up and it replaces the painted
   original with the tiered art — and grants a small PERMANENT boost.
   They can be caught again and again: every catch stacks the boost and
   raises the displayed tier (art caps at tier 7; the boost never caps). */
/* The dock is REDRAWN as one piece the moment the first comfort lands:
   feRedrawDockBand tiles clean slices of the painting itself (narrow
   verticals — the water's horizontal banding makes tiling invisible)
   across the whole item shelf, sweeping away every painted original
   (tackle box included). The comforts then sit on one shared baseline
   with contact shadows, so they belong to the dock instead of floating
   over it. */
const FE_PROPS = [
  { key:"bucket",  spr:"bucketp",  name:"Bail Bucket",     icon:"🪣", x:75,  y:296, w:36,
    stat:"loot",    per:1,    line:"+1% catch value per bucket" },
  { key:"flask",   spr:"flaskp",   name:"Warming Flask",   icon:"🫗", x:116, y:296, w:24,
    stat:"recover", per:0.5,  line:"+0.5/s tension recovery per flask" },
  { key:"lantern", spr:"lanternp", name:"Dock Lantern",    icon:"🏮", x:153, y:296, w:32,
    stat:"luck",    per:0.06, line:"+0.06 catch luck per lantern" },
  { key:"barrel",  spr:"barrelp",  name:"Catch Barrel",    icon:"🛢️", x:205, y:296, w:44,
    stat:"tension", per:2,    line:"+2 max tension per barrel" },
  { key:"bedroll", spr:"bedrollp", name:"Dockside Bedroll",icon:"🛏️", x:26,  y:296, w:40,
    stat:"speed",   per:1,    line:"−1% bite wait per bedroll" },
];
function feProps(){
  const inv = fshInv();
  if(!inv.props) inv.props = { bucket:0, flask:0, lantern:0, barrel:0, bedroll:0 };
  if(inv.propGrants === undefined){
    /* players who already fished up comforts under the old random system
       start the schedule from where they stand */
    inv.propGrants = Object.values(inv.props).reduce((a,b)=>a+(b||0),0);
  }
  return inv.props;
}
/* The dock fills on a SCHEDULE now, not a dice roll: grant #k arrives at
   round(5·k^1.25) total catches — 5, 12, 20, 28, 37 … the full 35-grant
   dock lands around 420 catches, and the trickle never stops (boosts
   stack forever past tier 7). The order is fixed and readable: lantern
   first, then bucket, flask, bedroll, barrel — one lap per tier. At most
   one grant per landed catch, so old saves catch up one dock piece at a
   time instead of a chip avalanche. */
const FE_PROP_ORDER = ["lantern","bucket","flask","bedroll","barrel"];
function fePropSchedule(k){ return Math.round(5 * Math.pow(k, 1.25)); }
function feNextProp(){
  const inv = fshInv(); feProps();
  const k = inv.propGrants + 1;
  const key = FE_PROP_ORDER[(k-1) % FE_PROP_ORDER.length];
  return { k, at: fePropSchedule(k), def: FE_PROPS.find(p=>p.key===key), tier: Math.ceil(k/FE_PROP_ORDER.length) };
}
let fePropFx = null;
function feAwardProp(totalCatches){
  const inv = fshInv();
  const pr = feProps();
  const nxt = feNextProp();
  if(totalCatches < nxt.at) return null;
  inv.propGrants++;
  pr[nxt.def.key] = (pr[nxt.def.key]||0) + 1;
  /* the celebration is armed now and plays the moment the dock is back
     in view — escalating with the tier it just reached */
  fePropFx = { key: nxt.def.key, tier: Math.min(7, pr[nxt.def.key]), t: -1 };
  return nxt.def;
}
/* The celebration proper — drawn AFTER the day/night grade so it blazes
   even at midnight. Escalates with the tier just reached:
   t1 the pop+shake alone · t2+ a shine ring · t3+ golden sparks (more
   per tier) · t5+ turning light beams · t7 a full golden starburst. */
function feDrawPropFx(g){
  if(!fePropFx || fePropFx.t < 0) return;
  const p = FE_PROPS.find(x=>x.key===fePropFx.key);
  if(!p) return;
  const t = fePropFx.t, tier = fePropFx.tier;
  const cx = p.x, cy = p.y - 14;
  if(tier >= 2){
    const k = Math.min(1, t/0.9);
    g.globalAlpha = (1-k) * 0.75;
    g.strokeStyle = "#ffe9b0"; g.lineWidth = 2.5;
    g.beginPath(); g.arc(cx, cy, 8 + k*(20 + tier*5), 0, 7); g.stroke();
    g.globalAlpha = 1;
  }
  if(tier >= 3){
    const n = 6 + tier*3;
    for(let i=0;i<n;i++){
      const a = (i/n)*Math.PI*2 + i*0.7;
      const sp = 34 + (i%5)*9 + tier*3;
      const life = Math.min(1, t/1.5);
      const px = cx + Math.cos(a)*sp*life;
      const py = cy + Math.sin(a)*sp*life*0.8 + 26*life*life;   // gravity
      g.globalAlpha = (1-life) * 0.95;
      g.fillStyle = i%3 ? "#ffd88f" : "#fff6d8";
      g.beginPath(); g.arc(px, py, 1.6 + (i%3)*0.7, 0, 7); g.fill();
    }
    g.globalAlpha = 1;
  }
  if(tier >= 5 && t < 1.3){
    g.globalAlpha = (1 - t/1.3) * 0.5;
    g.strokeStyle = "#fff3c8"; g.lineWidth = 2;
    for(let i=0;i<6;i++){
      const a = t*1.8 + i*Math.PI/3;
      g.beginPath(); g.moveTo(cx + Math.cos(a)*10, cy + Math.sin(a)*10);
      g.lineTo(cx + Math.cos(a)*(30 + tier*4), cy + Math.sin(a)*(30 + tier*4));
      g.stroke();
    }
    g.globalAlpha = 1;
  }
  if(tier >= 7 && t < 0.6){
    const k = t/0.6;
    const r = g.createRadialGradient(cx, cy, 2, cx, cy, 90);
    r.addColorStop(0, `rgba(255,232,160,${(1-k)*0.6})`);
    r.addColorStop(1, "rgba(255,232,160,0)");
    g.fillStyle = r; g.fillRect(cx-90, cy-90, 180, 180);
  }
}
let feDockPatch = null;
function feRedrawDockBand(g){
  if(!fshBgReady) return;
  feDrawTrophies._want = true;
  /* the water shimmer draws across everything in the band — stamp the
     painted dock back on top before dressing it */
  if(!feDockPatch || feDockPatch.spot !== feBgSpot){
    /* cut from THIS water's painting, at the band rect's place in it - the
       band is offset per painting, so (0,250) is not (0,542) everywhere.
       The rect runs from the canvas's left edge to just past the plank end
       (band x 320) and is FEATHERED on its right and bottom: a hard-edged
       stamp erased the shimmer inside a box that showed on open water. */
    const c = document.createElement("canvas");
    const fx = fshBgImg.naturalWidth/800, fyy = fshBgImg.naturalHeight/1200;
    const x0 = -feBandDx(), w = 344 - x0, h = 176;
    c.width = Math.max(1, Math.round(w)); c.height = h;
    const cg = c.getContext("2d");
    cg.drawImage(fshBgImg, 0, (250 + feBandOff())*fyy, w*fx, h*fyy, 0, 0, c.width, h);
    cg.globalCompositeOperation = "destination-in";
    const gx = cg.createLinearGradient(c.width - 34, 0, c.width, 0);
    gx.addColorStop(0, "rgba(0,0,0,1)"); gx.addColorStop(1, "rgba(0,0,0,0)");
    cg.fillStyle = gx; cg.fillRect(0, 0, c.width, h);
    const gy = cg.createLinearGradient(0, h - 56, 0, h);
    gy.addColorStop(0, "rgba(0,0,0,1)"); gy.addColorStop(1, "rgba(0,0,0,0)");
    cg.fillStyle = gy; cg.fillRect(0, 0, c.width, h);
    c.spot = feBgSpot; c.x0 = x0;
    feDockPatch = c;
  }
  g.drawImage(feDockPatch, feDockPatch.x0, 250);
  /* The tall painting brought the old clutter back with it — bucket,
     thermos, box, sandwich painted straight onto the deck. This strip
     repaints the walkway in clean planks matching the painting's wood,
     and the comforts furnish it from bare. */
  const top = 252, deck = 331;
  if(feBgSpot !== "dock") return;   /* the painted piers have their own edges */
  /* the clutter and the plank wall were INPAINTED OUT of the painting
     itself — nothing to cover at runtime, so nothing can billboard */
  /* a slim rail board, nothing more */
  const pg = g.createLinearGradient(0, deck-14, 0, deck+4);
  pg.addColorStop(0, "#8a6a45"); pg.addColorStop(0.6, "#755638"); pg.addColorStop(1, "#5f432a");
  g.fillStyle = pg; g.fillRect(0, deck-14, 240, 18);
  g.strokeStyle = "rgba(52,36,22,0.4)"; g.lineWidth = 1;
  g.beginPath(); g.moveTo(0, deck-7); g.lineTo(240, deck-7); g.stroke();
  g.fillStyle = "#d9b47e"; g.fillRect(0, deck, 240, 2.4);
  g.fillStyle = "rgba(255,235,190,0.3)"; g.fillRect(0, deck, 240, 1);
  g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(0, deck+2.4, 240, 2);
}
let feTrophyCache = null;
function feTrophies(){
  if(feTrophyCache) return feTrophyCache;
  try{
    const J = state.fishing.journal || {};
    feTrophyCache = Object.keys(J)
      .map(n => ({ n, lb: J[n].best || 0 }))
      .filter(x => x.lb >= 8)
      .sort((a,b) => b.lb - a.lb)
      .slice(0, 3);
  }catch(e){ feTrophyCache = []; }
  return feTrophyCache;
}
function feDrawTrophies(g){
  /* the biggest three hang mounted on the dock's front — the wall of
     personal bests every visitor sees first */
  const T = feTrophies();
  if(feBgSpot !== "dock") return;   /* the wall of personal bests hangs at home */
  for(let i=0; i<T.length; i++){
    const x = 34 + i*66, y = 352;
    g.fillStyle = "#5d4128"; 
    g.beginPath(); g.roundRect ? g.roundRect(x-24, y-14, 48, 30, 4) : g.rect(x-24, y-14, 48, 30); g.fill();
    g.strokeStyle = "#8a6a45"; g.lineWidth = 1.4; g.strokeRect(x-22, y-12, 44, 26);
    const art = typeof feSpeciesArt === "function" ? feSpeciesArt(T[i].n) : null;
    const im = art && typeof feImg === "function" ? feImg(art) : null;
    if(im && im.complete && im.naturalWidth){
      const w = 34, h = Math.min(20, w*(im.naturalHeight/im.naturalWidth));
      g.drawImage(im, x-w/2, y-4-h/2, w, h);
    }
    g.fillStyle = "#d9c9a8"; g.font = "700 6.5px system-ui"; g.textAlign = "center";
    g.fillText(T[i].lb + " lb", x, y+12);
  }
  g.textAlign = "left";
}
function feDrawProps(g){
  const pr = feProps();
  /* the redrawn dock is unconditional — the painted clutter is gone for
     good, and the shelf starts bare until the comforts furnish it */
  feRedrawDockBand(g);
  for(const p of FE_PROPS){
    const n = pr[p.key]||0;
    if(!n) continue;
    const tier = Math.min(7, n);
    const im = feImg(p.spr + tier);
    if(!feImgOk(im)) continue;
    /* the lantern is the showpiece — bigger, and it grows with its tier */
    /* the 2:3 scene made everything painted bigger — the comforts keep up */
    let w = (p.key === "lantern" ? p.w + tier*1.4 : p.w) * 1.55;
    let dx = 0, sc = 1;
    if(fePropFx && fePropFx.key === p.key && fePropFx.t >= 0){
      const t = fePropFx.t;
      if(t < 0.55) sc = 1 + Math.sin(Math.min(1, t/0.55)*Math.PI) * 0.45;   // pop!
      if(t < 0.8) dx = Math.sin(t*46) * (0.8-t) * 4.5;                       // and a shake
    }
    w *= sc;
    const h = w * (im.naturalHeight/im.naturalWidth);
    const baseY = 330;                   // bottoms rest right on the deck edge
    /* each sprite's transparent bottom padding (measured at build time)
       is compensated so its VISIBLE base lands exactly on the planks —
       the bedroll alone carries 26% empty rows and used to float */
    const pad = (FE_PROP_PAD[p.spr] ? FE_PROP_PAD[p.spr][tier-1] : 0) * h;
    /* contact shadow first — this is what makes it SIT on the planks */
    g.globalAlpha = 0.3;
    g.fillStyle = "#1c2836";
    const px = feDeckX(p.x);
    g.beginPath(); g.ellipse(px + dx, baseY - 1, w*0.42, 3.2, 0, 0, 7); g.fill();
    g.globalAlpha = 1;
    g.drawImage(im, px - w/2 + dx, baseY - h + pad, w, h);
    if(p.key === "lantern"){
      /* glass glint by day, so it catches the eye even unlit */
      const tw = 0.5 + 0.5*Math.sin(fshT*2.6);
      g.globalAlpha = 0.35 + 0.3*tw;
      g.fillStyle = "#fff8e0";
      g.beginPath(); g.arc(px - w*0.16, p.y - h*0.62, 1.6, 0, 7); g.fill();
      g.globalAlpha = 1;
    }
  }
  feDrawTrophies(g);
}

/* Stats, re-based on the original, with dock comforts stacked in after
   charms — same accumulator keys the whole system already reads. */
function fshStats(){
  const f = fshInv();
  const sk = k => (f.skills && f.skills[k]) || 0;
  const acc = { cast:0, pull:0, tension:0, recover:0, strain:0, window:0, speed:0, luck:0, loot:0, calm:0 };
  const add = (st, mul)=>{ if(!st) return; for(const k in st) if(k in acc) acc[k] += st[k]*(mul===undefined?1:mul); };

  for(const s of FSH_EQ_SLOTS){ const it = fshEquippedItem(s.key); if(it) add(it.stats); }
  const bait = f.activeBait && f.bait[f.activeBait] > 0 ? fshBait(f.activeBait) : null;
  add(bait ? bait.stats : FSH_NO_BAIT);
  for(const id in f.active){ const c = fshCharm(id); if(c) add(c.stats); }
  acc.cast    += sk("rod")*6;
  acc.pull    += sk("rod")*0.6 + sk("reel")*2.2 + sk("outfit")*0.4;
  acc.tension += sk("line")*18;
  acc.window  += sk("hook")*0.3;
  acc.speed   += (1 - Math.pow(0.93, sk("bait")))*100;
  acc.luck    += sk("lure")*0.55 + sk("outfit")*0.1;
  acc.loot    += sk("box")*14 + sk("outfit")*3;
  acc.recover += sk("gloves")*3.5;
  acc.strain  += sk("gloves")*0.22*4.5;
  /* every comfort fished up onto the dock, stacked forever */
  const pr = f.props || {};
  for(const p of FE_PROPS) acc[p.stat] += (pr[p.key]||0) * p.per;

  return {
    raw: acc,
    bait,
    castBonus:    1 + acc.cast/100,
    tapPower:     Math.max(2, 6 + acc.pull),
    maxTension:   Math.max(40, Math.round(100 + acc.tension)),
    tensionDecay: Math.max(6, 16 + acc.recover),
    tensionPerTap:Math.max(2.4, 7.5 * (1 - Math.min(0.75, acc.strain/100))),
    hookWindow:   Math.max(700, 1400 + acc.window*1000),
    biteMult:     Math.max(0.25, 1 - Math.min(0.8, acc.speed/100)),
    luck:         Math.max(0, acc.luck),
    lootMult:     Math.max(0.5, 1 + acc.loot/100),
    calm:         Math.min(1, Math.max(0, acc.calm/100)),
  };
}

/* ------------- 9 · TRAINING LIVES ON THE GEAR IT TRAINS -------------
   Every skill now sits on the item it improves: Casting Technique on the
   rod card, Line Control on the line, Endurance on all three outfit
   pieces, Bait Craft on the bait shelf, Haggling by the ledger. The
   Upgrades tab keeps its copy; this is the same skill, surfaced where
   you actually think about it. Slot cards become divs so a train button
   can live inside them. */
const FE_SKILL_BY_SLOT = { rod:"rod", reel:"reel", line:"line", hook:"hook",
  lure:"lure", gloves:"gloves", hat:"outfit", coat:"outfit", boots:"outfit" };
function feFmtCost(n){ return n>=1e6 ? (n/1e6)+"M" : n>=1e3 ? (n/1e3)+"k" : String(n); }
function feTrainRow(skillKey){
  const sk = fshSkill(skillKey);
  if(!sk) return "";
  const tier = fshSkillTier(skillKey);
  const pips = Array.from({length:FSH_MAX_TIER},(_,i)=>
    `<i class="${i<tier?"on":""}"></i>`).join("");
  let btn;
  if(tier >= FSH_MAX_TIER) btn = `<span class="eq-max">MAX</span>`;
  else {
    const next = tier+1;
    const lvl = (state.player && state.player.level) || 1;
    const cost = fshSkillCost(sk, next);
    if(lvl < FSH_TIER_LEVEL[next]) btn = `<span class="eq-gate">Lv ${FSH_TIER_LEVEL[next]}</span>`;
    else btn = `<button class="eq-train-btn ${state.credits>=cost?"":"poor"}" data-train="${skillKey}"
                  title="${sk.name} — ${sk.effect}">⬆ ${feFmtCost(cost)}</button>`;
  }
  return `<span class="eq-train" title="${sk.name}${tier?` · ${sk.stat(tier)}`:""}">
    <em>${sk.icon}</em><span class="eq-pips">${pips}</span>${btn}</span>`;
}
function renderEquipment(){
  const wrap = document.getElementById("fshEquip");
  if(!wrap) return;
  if(!state.fishing) state.fishing = defaultFishing();
  const f = state.fishing;
  const st = fshStats();

  const slots = FSH_EQ_SLOTS.map(s=>{
    const it = fshEquippedItem(s.key);
    const q = it ? FSH_QUALITY[it.q] : null;
    return `<div class="eq-slot ${it?"filled":""} ${eqPicker===s.key?"open":""}" data-slot="${s.key}"
              ${it?`style="border-color:${q.color}66;"`:""}>
      <span class="eq-si">${it ? it.icon : s.icon}</span>
      <span class="eq-sn">${s.name}</span>
      <span class="eq-sv" ${it?`style="color:${q.color}"`:""}>${it ? it.name : "empty"}</span>
      ${feTrainRow(FE_SKILL_BY_SLOT[s.key])}
    </div>`;
  }).join("");

  let picker = "";
  if(eqPicker){
    const slot = fshEqSlot(eqPicker);
    const owned = FSH_ITEMS.filter(i=>i.slot===eqPicker && fshOwns(i.id));
    picker = `<div class="eq-picker">
      <div class="eq-ph">${slot.icon} ${slot.name} — ${slot.blurb}</div>
      ${owned.length ? owned.map(i=>{
        const q = FSH_QUALITY[i.q], on = fshEquipped(eqPicker)===i.id;
        return `<button class="eq-opt ${on?"on":""}" data-pick="${i.id}">
          <span class="ic">${i.icon}</span>
          <span class="tx"><b style="color:${q.color}">${i.name}</b><br><span class="st">${fshStatLine(i.stats)}</span></span>
          <span class="mk">${on?"✓":""}</span></button>`;
      }).join("") : `<div class="eq-empty">Nothing for this slot yet — the Tackle Shop in the Market sells them.</div>`}
      ${fshEquipped(eqPicker) ? `<button class="eq-opt clear" data-pick="">Take it off</button>` : ""}
    </div>`;
  }

  const baitRows = FSH_BAIT.filter(b=>(f.bait[b.id]||0) > 0).map(b=>{
    const on = f.activeBait === b.id;
    return `<button class="eq-bait ${on?"on":""}" data-bait="${b.id}">
      <span class="ic">${b.icon}</span><span class="nm">${b.name}</span>
      <span class="ct">×${(f.bait[b.id]||0).toLocaleString()}</span>${on?`<span class="on-tag">on the hook</span>`:""}
    </button>`;
  }).join("");

  const charmRows = FSH_CHARMS.map(c=>{
    const have = f.charms[c.id]||0, live = f.active[c.id]||0;
    if(!have && !live) return "";
    return `<div class="eq-charm ${live?"live":""}">
      <span class="ic">${c.icon}</span>
      <span class="tx"><b>${c.name}</b><br><span class="st">${live ? `Active — ${live} cast${live===1?"":"s"} left` : c.blurb}</span></span>
      ${have ? `<button class="btn secondary" data-charm="${c.id}">Use (${have})</button>` : ""}
    </div>`;
  }).join("");

  wrap.innerHTML = `
    <div class="eq-grid">${slots}</div>
    ${picker}
    <div class="eq-sec">🪱 Bait <span class="eq-hint">one used per cast</span>${feTrainRow("bait")}</div>
    ${baitRows || `<div class="eq-empty">No bait. You can still fish, but bites come slower and the good stuff stays away.</div>`}
    ${f.activeBait ? "" : `<div class="eq-warn">⚠️ Fishing a bare hook — ${fshStatLine(FSH_NO_BAIT)}</div>`}
    ${charmRows ? `<div class="eq-sec">🍀 Charms</div>${charmRows}` : ""}
    <div class="eq-sec">🏕️ Dock Comforts <span class="eq-hint">${(()=>{
      const nx = feNextProp(), c = (state.fishing && state.fishing.catches)||0;
      return `every catch counts — next: ${nx.def.icon} ${nx.def.name} at ${nx.at} catches (${c} so far)`;
    })()}</span></div>
    <div class="fe-props">${FE_PROPS.map(p=>{
      const n = (fshInv().props||{})[p.key]||0;
      return `<span class="fe-prop ${n?"got":""}" title="${p.line}">${p.icon} ${p.name} <b>×${n}</b></span>`;
    }).join("")}</div>
    ${(()=>{
      const inv = feKeys();
      const keyBits = [7,6,5,4,3,2,1].filter(t=>inv.keys[t]>0)
        .map(t=>`<span class="fe-key"><img src="${FE_IMG["key"+t]}" alt="">T${t}×${inv.keys[t]}</span>`).join("");
      const boxes = inv.strongboxes.map((b,i)=>{
        const k = feBestKeyFor(b.need);
        return `<span class="fe-box"><img src="${FE_IMG["chest"+b.need]}" alt="">T${b.need}+ ${k?`<img class="fe-boxkey" src="${FE_IMG["key"+k]}" alt=""><button class="eq-train-btn" data-openbox="${i}">Open</button>`:`<i>no key yet</i>`}</span>`;
      }).join("");
      return (keyBits || boxes) ? `<div class="eq-sec">🗝️ Keys & Strongboxes <span class="eq-hint">keys snag on the line — strongboxes wait for them</span></div>
        <div class="fe-props">${keyBits}${boxes}</div>` : "";
    })()}
    <div class="eq-sec">📋 Everything, added up ${feTrainRow("box")}</div>
    <div class="fsh-derived">
      <span>Reel power <b>${(st.tapPower*1.55).toFixed(1)}</b>/s held</span>
      <span>Max tension <b>${st.maxTension}</b></span>
      <span>Recovery <b>${st.tensionDecay.toFixed(1)}</b>/s</span>
      <span>Drag load <b>${(30 + st.tapPower*0.75).toFixed(0)}</b> held</span>
      <span>Bite window <b>${(st.hookWindow/1000).toFixed(2)}s</b></span>
      <span>Wait <b>×${st.biteMult.toFixed(2)}</b></span>
      <span>Cast <b>×${st.castBonus.toFixed(2)}</b></span>
      <span>Luck <b>+${st.luck.toFixed(2)}</b></span>
      <span>Value <b>×${st.lootMult.toFixed(2)}</b></span>
      <span>Fish runs <b>${Math.round((1-st.calm)*100)}%</b> as often</span>
    </div>`;

  wrap.querySelectorAll("[data-slot]").forEach(b=>b.addEventListener("click",()=>{ feAudioUnlock(); feSound("box_open",{vol:0.35}); fshOpenPicker(b.dataset.slot); }));
  wrap.querySelectorAll("[data-pick]").forEach(b=>b.addEventListener("click",()=>{ feSound("equip",{vol:0.4}); fshEquip(eqPicker, b.dataset.pick || null); eqPicker=null; renderEquipment(); }));
  wrap.querySelectorAll("[data-bait]").forEach(b=>b.addEventListener("click",()=>{ feSound("bait",{vol:0.4}); fshSetBait(b.dataset.bait); }));
  wrap.querySelectorAll("[data-charm]").forEach(b=>b.addEventListener("click",()=>fshUseCharm(b.dataset.charm)));
  wrap.querySelectorAll("[data-openbox]").forEach(b=>b.addEventListener("click",e=>{
    e.stopPropagation();
    const inv = feKeys();
    const i = +b.dataset.openbox;
    const box = inv.strongboxes[i];
    if(!box) return;
    const k = feBestKeyFor(box.need);
    if(!k) return;
    inv.strongboxes.splice(i,1);
    const r = feOpenStrongbox(box.need, k);
    showToast(`🗝️ Strongbox opened — 🪙 ${r.credits.toLocaleString()}!`);
    renderEquipment();
  }));
  wrap.querySelectorAll("[data-train]").forEach(b=>b.addEventListener("click",e=>{
    e.stopPropagation();                       // don't open the slot picker underneath
    const before = fshSkillTier(b.dataset.train);
    fshBuySkill(b.dataset.train);
    if(fshSkillTier(b.dataset.train) > before) feSound("train", { vol: 0.42 });
    renderEquipment();
  }));
}

/* Leaving the tab silences every loop — a reel cranking over the Mining
   screen would be absurd. */
function fshOnLeaveTab(){ fshTabActive = false; fshStopLoop(); feAllLoopsStop(); }

/* ---------------- 9b · SIGHT FISHING --------------------------------
   Fish shadows cruise the open water while you're idle or charging.
   Each carries a hidden tier band its size hints at. Land the bobber
   within reach of one and the next roll leans hard toward its band —
   the cast meter becomes an aiming decision. */
let feShadows = [];
function feShadowSpawn(){
  const r = Math.random();
  const band = r < 0.45 ? [1,2] : r < 0.78 ? [2,3] : r < 0.95 ? [3,4] : [4,5];
  const sz = 10 + band[0]*5 + Math.random()*6;
  const dir = Math.random() < 0.5 ? -1 : 1;
  return {
    x: dir === 1 ? 250 - Math.random()*60 : FSH_W + 30,
    y: FSH_HORIZON + 34 + Math.random()*46,
    vx: dir * (7 + Math.random()*8),
    band, sz, ph: Math.random()*6.28, hit: 0,
  };
}
let feBossWait = -1;                 /* seconds until the legend's shadow shows; -1 = not counting */
function feShadowTick(dt){
  const active = fsh && (fsh.phase === "idle" || fsh.phase === "charging" || fsh.phase === "casting" || fsh.phase === "waiting");
  if(active && feShadows.length < 3 && Math.random() < dt*0.25) feShadows.push(feShadowSpawn());
  /* the legend's patrol: if today's boss is unfought, its enormous shadow
     shows itself within 4-10s of the water going quiet, and again on that
     cadence each time it passes out of view. (Was a 0.02/s roll - a mean
     50s wait, and the only route to the fight once the test hook went;
     batch 125.) */
  const hasBoss = feShadows.some(sh=>sh.bossOf);
  if(active && !hasBoss){
    if(feBossWait < 0) feBossWait = 4 + Math.random()*6;
    feBossWait -= dt;
    if(feBossWait <= 0){
      feBossWait = -1;
      const b = feBossAvailable();
      if(b){
        const dir = Math.random() < 0.5 ? -1 : 1;
        feShadows.push({ x: dir===1 ? 240 : FSH_W+40, y: FSH_HORIZON + 46 + Math.random()*22,
          vx: dir * 5.5, band:[5,5], sz: 42, ph: Math.random()*6.28, hit:0, bossOf: b, wake: 0 });
      }
    }
  } else if(hasBoss) feBossWait = -1;
  for(const sh of feShadows){
    sh.x += sh.vx * dt * (sh.hit ? 6 : 1);          // a spooked shadow bolts
    sh.ph += dt * (sh.bossOf ? 1.2 : 3);
    if(sh.hit) sh.hit = Math.max(0, sh.hit - dt);
    if(sh.bossOf){ sh.wake -= dt; if(sh.wake <= 0){ sh.wake = 3 + Math.random()*3; feRings.push({x:sh.x, y:sh.y-4, t:0, max:10}); } }
  }
  feShadows = feShadows.filter(sh=> sh.x > 230 - 60 && sh.x < FSH_W + 60);
}
function feShadowDraw(g, pal){
  if(!feShadows.length) return;
  for(const sh of feShadows){
    const wig = Math.sin(sh.ph) * sh.sz * 0.12;
    g.globalAlpha = sh.bossOf ? 0.44 : 0.3;
    g.fillStyle = sh.bossOf ? "#101d2c" : "#1d3242";
    g.beginPath();
    g.ellipse(sh.x, sh.y + wig, sh.sz, sh.sz*0.3, Math.sin(sh.ph*0.5)*0.08, 0, 7);
    g.fill();
    g.beginPath();                                   // tail
    g.ellipse(sh.x - Math.sign(sh.vx)*sh.sz*0.95, sh.y + wig, sh.sz*0.3, sh.sz*0.2, 0, 0, 7);
    g.fill();
    g.globalAlpha = 1;
    if(sh.hit > 0){
      g.globalAlpha = sh.hit * 0.8;
      g.strokeStyle = "#ffd35c"; g.lineWidth = 2;
      g.beginPath(); g.arc(sh.x, sh.y, sh.sz + 8*(1-sh.hit), 0, 7); g.stroke();
      g.globalAlpha = 1;
    }
  }
}

/* ------------- 10 · CONDITIONS: THE WORLD HAS HABITS -----------------
   About a third of the species keep hours. Iconic ones are hand-picked
   (the Moonlit Eel hunts at night, the Thunderfin rides storms, the
   Coelacanth hides in the deep dark); the rest of the conditional set is
   assigned deterministically by name hash so it's stable save to save.
   Every tier keeps at least 8 species with no conditions, so the water
   is never empty. */
const FE_COND_ICONIC = {
  "Moonlit Eel":{time:"night"}, "Golden Koi":{time:"dawn",weather:"clear"},
  "Ghost Koi":{time:"night",weather:"fog"}, "Thunderfin Marlin":{weather:"storm"},
  "Coelacanth":{spot:"ledge",time:"night"}, "The Old Man of the Lake":{time:"night"},
  "Silverscale Leviathan":{spot:"midnight",time:"night"},
  "Abyssal Anglerfish":{spot:"ledge"}, "Kraken Hatchling":{spot:"midnight"},
  "Frost Whale Calf":{spot:"ledge",weather:"fog"}, "Storm Ray":{weather:"storm"},
  "Rain Runner Shad":{weather:"rain"}, "Mist Carp":{weather:"fog"},
  "Dawn Perch":{time:"dawn"}, "Dusk Darter":{time:"dusk"},
  "Night Crawler Catfish":{time:"night"}, "Marsh Lurker":{spot:"shallows"},
  "Reed Pike":{spot:"shallows"}, "Sun Gar":{time:"day",weather:"clear"},
  "Great White Shark":{spot:"ledge"},
};
function feCondHash(name){
  let h = 0;
  for(let i=0;i<name.length;i++) h = (h*31 + name.charCodeAt(i)) >>> 0;
  return h;
}
let feCondCache = null;
function feConds(){
  if(feCondCache) return feCondCache;
  const out = {};
  const TIMES = ["dawn","day","dusk","night"], WX = ["clear","rain","fog"];
  for(let t=0;t<FSH_CATCH.length;t++){
    const def = FSH_CATCH[t];
    let uncond = 0, pool = [];
    for(const it of def.items){
      const name = it[0];
      if(FE_COND_ICONIC[name]){ out[name] = FE_COND_ICONIC[name]; continue; }
      pool.push(name);
    }
    /* leave at least 8 unconditional per tier; hash-pick ~30% of the rest */
    const keep = Math.max(8, Math.ceil(pool.length*0.7));
    const scored = pool.map(n=>({ n, h: feCondHash(n) })).sort((a,b)=>a.h-b.h);
    for(let i=keep;i<scored.length;i++){
      const h = scored[i].h;
      const c = {};
      if(h % 3 !== 0) c.time = TIMES[h % 4];
      if(h % 3 !== 1) c.weather = WX[(h>>>4) % 3];   // >>> : hashes past 2^31 went negative
      if(c.time || c.weather) out[scored[i].n] = c;
    }
  }
  /* the floor is law: if hand-picked iconics ever leave a tier with
     fewer than 8 unconditional species, conditions are shed (stable
     hash order) until the water is guaranteed never to run empty */
  for(const def of FSH_CATCH){
    const conditional = def.items.map(it=>it[0]).filter(n=>out[n]);
    let uncond = def.items.length - conditional.length;
    if(uncond >= 8 || def.items.length < 8) continue;
    conditional.sort((a,b)=>feCondHash(a)-feCondHash(b));
    while(uncond < 8 && conditional.length){ delete out[conditional.pop()]; uncond++; }
  }
  feCondCache = out;
  return out;
}
function feCondOk(cond){
  if(!cond) return true;
  if(cond.spot && !feSpotSatisfies(cond.spot)) return false;
  if(cond.time){
    const h = feEnv ? feEnv.hour : 12;
    const t = cond.time;
    if(t === "night" && !feNight()) return false;
    if(t === "dawn" && !(h >= 4.5 && h < 8)) return false;
    if(t === "day" && !(h >= 8 && h < 17)) return false;
    if(t === "dusk" && !(h >= 17 && h < 20.5)) return false;
  }
  if(cond.weather){
    const w = feEnv ? feEnv.weather : "clear";
    if(cond.weather === "rain" && w !== "drizzle" && w !== "storm") return false;
    if(cond.weather === "storm" && w !== "storm") return false;
    if(cond.weather === "fog" && w !== "fog") return false;
    if(cond.weather === "clear" && w !== "clear") return false;
  }
  return true;
}
function feCondHint(cond){
  if(!cond) return "";
  const bits = [];
  if(cond.time) bits.push({dawn:"at first light", day:"in broad daylight", dusk:"as the light fails", night:"after dark"}[cond.time]);
  if(cond.weather) bits.push({rain:"when the rain falls", storm:"in a storm", fog:"in the fog", clear:"under clear skies"}[cond.weather]);
  if(cond.spot) bits.push({shallows:"in the Reedy Shallows", ledge:"off the Deepwater Ledge", midnight:"at the Midnight Mark", reef:"over the Coral Shelf"}[cond.spot]);
  const line = bits.filter(Boolean).join(", ");
  return line ? "Bites " + line : "";
}

/* --------------- 11 · THE ANGLER'S JOURNAL --------------------------
   Every species you've ever landed: count, best weight, first-catch
   date. Uncaught species show as dark silhouettes with a condition hint
   — the journal is where the world's habits are discovered. First catch
   of any species pays a bonus. */
function feJournal(){
  const inv = fshInv();
  if(!inv.journal) inv.journal = {};
  return inv.journal;
}
function feJournalCount(){ return Object.keys(feJournal()).length; }
function feSpeciesTotal(){ return FSH_CATCH.reduce((a,d)=>a+d.items.length,0); }
let feJournalOpen = false;
function feRenderJournal(){
  let panel = document.getElementById("feJournal");
  if(!feJournalOpen){ if(panel) panel.remove(); return; }
  if(!panel){
    panel = document.createElement("div");
    panel.id = "feJournal";
    const anchor = document.getElementById("fshResult") || document.getElementById("fshBars");
    anchor.parentNode.insertBefore(panel, anchor);
  }
  const J = feJournal(), conds = feConds();
  let rows = "";
  /* the Legends page comes first — five names, five waters */
  {
    const BJ = feBossState().bossJournal;
    rows += `<div class="fej-tier" style="color:#ff5c8a">Legends of the Water</div><div class="fej-grid">`;
    rows += FE_BOSSES.map(b=>{
      const e = BJ[b.name];
      if(e){
        const art = FE_IMG[b.art] ? `<img class="fej-spr" src="${FE_IMG[b.art]}" alt="">` : `<span class="ic">${b.icon}</span>`;
        return `<div class="fej-card got" style="border-color:#ff5c8a66">${art}<b>${b.name}</b>
          <span class="st">×${e.n} · best ${e.best} lb</span></div>`;
      }
      return `<div class="fej-card"><span class="ic dark">${b.icon}</span><b>???</b>
        <span class="st">${b.line}</span></div>`;
    }).join("");
    rows += `</div>`;
  }
  for(const def of FSH_CATCH){
    rows += `<div class="fej-tier" style="color:${def.color}">${def.label}</div>`;
    rows += `<div class="fej-grid">` + def.items.map(it=>{
      const name = it[0], icon = it[1];
      const e = J[name];
      if(e){
        const art = feSpeciesArt(name);
        const face = art && feImgOk(feImg(art))
          ? `<img class="fej-spr" src="${FE_IMG[art]}" alt="">`
          : `<span class="ic">${icon}</span>`;
        return `<div class="fej-card got" style="border-color:${def.color}44">
          ${face}<b>${name}</b>
          <span class="st">×${e.n} · best ${e.best} lb</span></div>`;
      }
      const hint = feCondHint(conds[name]);
      return `<div class="fej-card"><span class="ic dark">${icon}</span><b>???</b>
        <span class="st">${hint || "Just keep casting"}</span></div>`;
    }).join("") + `</div>`;
  }
  panel.innerHTML = `<div class="fej-head">📖 Angler's Journal
      <span class="fej-prog">${feJournalCount()}/${feSpeciesTotal()} species</span>
      <button class="fej-x" id="fejClose">✕</button></div>
    <div class="fej-body">${rows}</div>`;
  document.getElementById("fejClose").onclick = ()=>{ feJournalOpen = false; feRenderJournal(); };
}
function feJournalRecord(name, weightLb){ feTrophyCache = null;
  const J = feJournal();
  let first = false;
  if(!J[name]){ J[name] = { n:0, best:0, first: Date.now() }; first = true; }
  J[name].n++;
  if(weightLb > J[name].best) J[name].best = weightLb;
  return first;
}

/* ------------- 12 · THE CORAL SHELF ---------------------------------
   A fifth water, and the first with its OWN species: sixteen reef fish
   (plus two seahorses) injected into the catch tables at load, each
   spot-gated so they only bite here — the conditions system was built
   for exactly this. The Peacock Bass sneaks into the Shallows the same
   way. */
const FE_REEF_SPECIES = [
  // [tier, name, icon, valueMult, weightFactor, artKey]
  [2, "Clownfish",        "🐠", 1.2, 0.15, "sp_cc136"],
  [2, "Blue Tang",        "🐠", 1.2, 0.2,  "sp_cc143"],
  [2, "Damselfish",       "🐠", 1.1, 0.12, "sp_cc101"],
  [2, "Fusilier",         "🐠", 1.1, 0.3,  "sp_cc87"],
  [3, "Stoplight Parrotfish","🐠", 1.3, 0.7, "sp_cc131"],
  [3, "Queen Angelfish",  "🐠", 1.4, 0.5,  "sp_cc139"],
  [3, "Permit",           "🐟", 1.3, 1.1,  "sp_cc88"],
  [3, "Peacock Flounder", "🐟", 1.2, 0.8,  "sp_cc49"],
  [3, "Coral Grouper",    "🐟", 1.2, 0.9,  "sp_cc157"],
  [3, "Reef Seahorse",    "🐠", 1.8, 0.05, "seahorse3"],
  [4, "Napoleon Wrasse",  "🐟", 1.6, 1.6,  "sp_cc148"],
  [4, "Roosterfish",      "🐟", 1.5, 1.2,  "sp_cc112"],
  [4, "Blue Tilapia",     "🐟", 1.1, 0.6,  "sp_cc122"],
  [5, "Crowned Seahorse", "🐠", 3.0, 0.06, "seahorse7"],
];
const FE_GUEST_SPECIES = [
  [3, "Peacock Bass", "🐟", 1.3, 0.9, "sp_cc2", { spot:"shallows" }],
];
(function feInjectSpecies(){
  if(FSH_CATCH.__fe2) return;
  FSH_CATCH.__fe2 = true;
  FSH_CATCH[6].items.push(["Locked Strongbox", "🧳", 1.0, 3.0]);
  for(const [tier,name,icon,vm,wf,art] of FE_REEF_SPECIES){
    FSH_CATCH[tier].items.push([name, icon, vm, wf]);
    FE_COND_ICONIC[name] = { spot:"reef" };
    FE_SPECIES_ART[name] = art;
  }
  for(const [tier,name,icon,vm,wf,art,cond] of FE_GUEST_SPECIES){
    FSH_CATCH[tier].items.push([name, icon, vm, wf]);
    FE_COND_ICONIC[name] = cond;
    FE_SPECIES_ART[name] = art;
  }
})();

/* ---------------- 13 · KEYS & STRONGBOXES ---------------------------
   Keys snag on the line now and then (tier follows the catch). The
   treasure tier gains a Locked Strongbox: with a key of its tier or
   better it opens on the spot for a fat payout and a guaranteed card;
   without one it goes in the hold, waiting on the equipment panel until
   the right key comes up. */
function feKeys(){
  const inv = fshInv();
  if(!inv.keys) inv.keys = {};
  if(!inv.strongboxes) inv.strongboxes = [];
  return inv;
}
function feKeyRoll(catchTier, rng){
  rng = rng || Math.random;
  if(catchTier < 1 || rng() >= 0.025) return 0;
  const t = Math.max(1, Math.min(7, catchTier + (rng() < 0.3 ? 1 : 0) + 1));
  const inv = feKeys();
  inv.keys[t] = (inv.keys[t]||0) + 1;
  return t;
}
function feBestKeyFor(need){
  const inv = feKeys();
  for(let t = need; t <= 7; t++) if((inv.keys[t]||0) > 0) return t;
  return 0;
}
function feOpenStrongbox(need, viaKeyTier){
  const inv = feKeys();
  inv.keys[viaKeyTier]--;
  const credits = Math.round((40000 + Math.random()*30000) * (1 + need*0.9) * fshStats().lootMult);
  state.credits += credits;
  let cardLine = "";
  if(typeof feAwardTT === "function"){
    const fakeC = { name:"Sunken Chest", def: FSH_CATCH[6] };
    const card = feAwardTT(fakeC, FSH_CATCH[6], null, true);
    if(card) cardLine = ` · 🃏 ${card.emoji} ${card.name}`;
  }
  /* the box also carries something for the Flooded Arena's armory */
  let armoryLine = "";
  if(typeof fbGrantItemFromChest === "function"){
    const got = fbGrantItemFromChest(need);
    if(got) armoryLine = ` · 🎒 ${got.label}`;
  }
  feSound("box_open", { vol: 0.5 });
  setTimeout(()=>feSound("treasure", { vol: 0.7 }), 400);
  saveState(); renderHeader();
  return { credits, cardLine: cardLine + armoryLine };
}

/* ------------------- 14 · THE FIVE LEGENDS ---------------------------
   One named boss per water. Once per in-game day an enormous shadow
   patrols the surface — land the bobber on it and the legend takes the
   hook. Boss fights follow a SCRIPT (a fixed mood rotation you can
   learn), the attempt is spent on the hook, and the reward is a small
   fortune plus a page in the journal's Legends section. */
/* Retuned in batch 119: the tired->jump freeze had been every legend's only
   real teeth (a perfect bot landed all six once it was fixed), so the four
   mid legends carry 30% more pull and roughly double the stamina, and the
   Drowned King more line to win and 40% more stamina. Bands are held by
   docs/test-fishing.js: every legend 40%+ with maxed gear, at least two
   at 80% or under, the Drowned King between 12 and 60, the entry legend
   near-certain. Stamina is the honest knob - need past ~1300 trips the
   "overpowered" cliff and pull past ~1.6x becomes one-frame snaps. */
const FE_BOSSES = [
  { spot:"dock",     name:"Old Ironjaw",      icon:"🐟", art:"sp_cap21",
    line:"The dock's oldest story. Bent three gaffs, they say.",
    need:580, pull:22, strain:1.7, maxStam:430, wLo:55, wHi:80, cr:220000,
    script:["run","sulk","dive","jump","run","sulk"] },
  { spot:"shallows", name:"The Marsh King",   icon:"🐟", art:"sp_cc13",
    line:"A dragon in the reeds. The lilies part when it passes.",
    need:560, pull:29.3, strain:1.75, maxStam:820, wLo:48, wHi:70, cr:300000,
    script:["jump","run","sulk","run","jump","sulk"] },
  { spot:"ledge",    name:"The Pale Hunter",  icon:"🦈", art:"sp_red9",
    line:"Two colors, no mercy. The gulls go quiet when it's near.",
    need:700, pull:33.2, strain:1.85, maxStam:1040, wLo:400, wHi:700, cr:500000,
    script:["run","sulk","dive","jump","run","sulk"] },
  { spot:"reef",     name:"The Rooster King", icon:"🐟", art:"sp_cc112",
    line:"Its comb breaks the surface like a crown. Bow or reel.",
    need:620, pull:29.9, strain:1.8, maxStam:792, wLo:70, wHi:110, cr:420000,
    script:["jump","run","sulk","run","jump","sulk"] },
  { spot:"midnight", name:"The Black Phantom","icon":"🐟", art:"sp_cap3",
    line:"Older than the Mark itself. Seen only as an absence of stars.",
    need:820, pull:35.1, strain:1.9, maxStam:1073, wLo:90, wHi:140, cr:650000,
    script:["sulk","dive","jump","run","jump","sulk"] },
  { spot:"confluence", name:"The Drowned King", icon:"🐙", art:null,
    line:"A king needs no crown — the water swallowed it long ago. The five Legends were only his heralds.",
    need:874, pull:27, strain:1.95, maxStam:784, wLo:1400, wHi:2400, cr:2500000,
    script:["dive","run","sulk","run","jump","dive","run","sulk","jump","run"] }
];
function feBossFor(spotId){ return FE_BOSSES.find(b=>b.spot===spotId) || null; }
/* at the Confluence, every spot-bound species considers itself home */
function feSpotSatisfies(reqSpot){
  const cur = feSpot().id;
  return cur === reqSpot || cur === "confluence";
}
function feBossState(){
  const inv = fshInv();
  if(!inv.bossDay) inv.bossDay = {};
  if(!inv.bossJournal) inv.bossJournal = {};
  if(inv.dayN === undefined) inv.dayN = 0;
  return inv;
}
function feBossAvailable(){
  const inv = feBossState();
  const b = feBossFor(feSpot().id);
  return b && inv.bossDay[b.spot] !== inv.dayN ? b : null;
}
function feBossDef(b){
  return { tier:5, label:"LEGEND", color:"#ff5c8a", boss:true, script:b.script,
    need:b.need, pull:b.pull, strain:b.strain, maxStam:b.maxStam,
    cr:[b.cr, Math.round(b.cr*1.4)], scrap:[300,600], rep:2500, ttChance:1 };
}
function feBossRecord(name, weightLb){
  const inv = feBossState();
  const J = inv.bossJournal;
  if(!J[name]) J[name] = { n:0, best:0, first: Date.now() };
  /* the cinematic's win path creates the record first, with only `hard` -
     n++ on that was NaN once the catch stopped landing behind it (batch 119) */
  const rec = J[name];
  if(!(rec.n >= 0)) rec.n = 0;
  if(!(rec.best >= 0)) rec.best = 0;
  if(!rec.first) rec.first = Date.now();
  rec.n++;
  if(weightLb > rec.best) rec.best = weightLb;
}


/* ================= THE TRUE FORM: a keyframe cinematic QTE =============
   Land the Rooster King and the water erupts: his true form — a crimson
   storm-devil — thrashes on the line. Shrinking rings; tap the gold band
   to strike. Three slips and he dives. Zero his fury and the crown is
   yours. Frames cut from the playtester's footage. */
/* FE_CINE_IMG lives in fishing-cine.module.js (lazy bundle "fishing-cine", batch 127) */
const FE_CINE_BOSSES = {
  "The Rooster King": { pfx:"", n:16, leapDur:2.7, title:"SOMETHING ANCIENT TAKES THE LINE", sig:"multi" },
  "Old Ironjaw":      { pfx:"ij_", n:14, leapDur:2.5, title:"OLD IRONJAW ANSWERS THE LINE", sig:"mash" },
  "The Black Phantom":{ pfx:"bp_", n:14, leapDur:3.0, title:"THE NIGHT ITSELF TAKES THE HOOK", sig:"vanish" },
  "The Marsh King":   { pfx:"mk_", n:14, leapDur:3.0, title:"THE MARSH ITSELF STANDS UP", sig:"swipe" },
  "The Pale Hunter":  { pfx:"ph_", n:14, leapDur:3.0, title:"SOMETHING PALE RISES FROM THE COLD", sig:"hold" },
  "The Drowned King": { pfx:"dk_", n:14, leapDur:3.4, title:"THE KING OF ALL FIVE WATERS", sig:"gauntlet", hp:150 },
};
let feCine = { active:false };
function feCineImg(k){
  feCine.cache = feCine.cache || {};
  if(typeof FE_CINE_IMG === "undefined"){ feCineFramesLoad(); return null; }   /* frames still on their way */
  if(!feCine.cache[k]){ const im=new Image(); im.src=FE_CINE_IMG[k] || ""; feCine.cache[k]=im; }
  const im=feCine.cache[k];
  return (im.complete && im.naturalWidth) ? im : null;
}
/* the keyframes are a 5MB bundle of their own; fetch them the moment a legend
   is hooked so they are decoded by the time the true form rises */
function feCineFramesLoad(){
  try{ if(typeof oeLoadBundle === "function") oeLoadBundle("fishing-cine"); }catch(e){}
}
function feCineStart(bossName){
  if(feCine.active) return;
  feCineFramesLoad();
  const cfg = FE_CINE_BOSSES[bossName] || FE_CINE_BOSSES["The Rooster King"];
  let hard = 0;
  try{ hard = Math.min(3, (feBossState().bossJournal[bossName] || {}).hard || 0); }catch(e){}
  feAudioUnlock();
  const wrap = document.createElement("div");
  wrap.id = "feCineWrap";
  wrap.innerHTML = `<div style="position:relative;">
    <canvas id="feCineCv" width="470" height="705"></canvas>
    <button id="feCineGo" style="display:none; position:absolute; left:50%; bottom:34px; transform:translateX(-50%);
      padding:13px 34px; border-radius:14px; border:1px solid #ffd35c; cursor:pointer;
      background:rgba(20,14,6,.85); color:#ffd35c; font:800 17px system-ui;">⚔️ FIGHT</button></div>`;
  (document.fullscreenElement || document.body).appendChild(wrap);
  feCine = { active:true, wrap, cfg, hard, boss:bossName, t:0, phase:"leap",
             hp: cfg.hp || 100, hpMax: cfg.hp || 100, stress:0, round:0,
             ring:null, flash:0, shake:0, bolt:0, boltT:0, floats:[], last:0, cache:feCine.cache };
  fbSfxSafe("splash_big", 0.6);
  const cv = document.getElementById("feCineCv");
  const xy = e => {
    const r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) * 470 / r.width, y: (e.clientY - r.top) * 705 / r.height };
  };
  cv.addEventListener("pointerdown", e=>{ e.preventDefault(); try{ cv.setPointerCapture(e.pointerId); }catch(x){} const p2=xy(e); feCineDown(p2.x, p2.y); });
  cv.addEventListener("pointerup",   e=>{ const p2=xy(e); feCineUp(p2.x, p2.y); });
  cv.addEventListener("pointercancel", e=>{ const p2=xy(e); feCineUp(p2.x, p2.y); });
  const go = document.getElementById("feCineGo");
  go.onclick = ()=>{
    if(!feCine.active) return;
    feCine.phase = "fight"; feCine.t = 0; go.style.display = "none";
    feCine.mode = "sig"; feSigNew(feCine);
    feAudioUnlock(); fbSfxSafe("snag", 0.4);
    feCine.last = 0; feCineKick();   /* restart kick */
  };
  feCineKick();
  /* watchdog: preview panes and background tabs can stall RAF — if no
     frame lands for 400ms, kick the chain back to life */
  feCine.dog = setInterval(()=>{
    if(!feCine.active){ clearInterval(feCine.dog); return; }
    if(performance.now() - (feCine.wall||0) > 400){
      feCine.last = 0; feCine.pending = false; feCineKick();
    }
  }, 420);
}
function fbSfxSafe(k,v){ try{ if(typeof FE_SFX!=="undefined" && FE_SFX[k]) feSound(k,{vol:v}); }catch(e){} }
function feSigNew(C){
  let t = C.cfg.sig;
  if(t === "gauntlet"){
    /* he absorbed his heralds — the fight cycles every signature */
    C.sigN = (C.sigN || 0);
    t = ["mash","swipe","hold","multi","vanish"][C.sigN % 5];
    C.sigN++;
  }
  const hm = 1 - 0.12 * (C.hard || 0);
  if(t === "mash")   C.sig = { type:t, bar:0, tl:3.6*hm };
  if(t === "swipe")  C.sig = { type:t, dir:["⬅","➡","⬆","⬇"][(Math.random()*4)|0], tl:3.0*hm, sx:0, sy:0 };
  /* hold scales like the rest (batch 129): less time to start, and the bar
     fills faster so the release window narrows - 0.62s wide at hard 0, 0.39s at hard 3 */
  if(t === "hold")   C.sig = { type:t, v:0, holding:false, tl:6.0*hm, rate:0.42/hm, done:false };
  if(t === "multi")  C.sig = { type:t, next:1, tl:3.4*hm,
    pts:[0,1,2].map(i=>({ n:i+1, x:90+Math.random()*290, y:170+Math.random()*330, hit:false })) };
  if(t === "vanish") C.sig = { type:t, dark:0.9, win:0, hm, x:80+Math.random()*310, y:170+Math.random()*330 };
}
function feCineHit(txt){
  const C = feCine;
  C.hp = Math.max(0, C.hp - 25);
  C.boltT = 0.32; C.flash = 0.5; C.shake = 9;
  C.floats.push({ txt: txt || "-25", t: 0, crit: true });
  fbSfxSafe("snag", 0.55);
  try{ if(!fshInv().vibeOff && navigator.vibrate) navigator.vibrate(70); }catch(e){}
  C.ring = null; C.sig = null;
  if(C.hp <= 0){ C.phase = "defeat"; C.t = 0; fbSfxSafe("finish", 0.6); }
  else { C.mode = (C.mode === "sig") ? "ring" : "sig"; C.t = 0; if(C.mode === "sig") feSigNew(C); }
}
function feCineFail(){
  const C = feCine;
  C.ring = null; C.sig = null;
  feCineMiss();
  if(C.phase === "fight"){ C.mode = (C.mode === "sig") ? "ring" : "sig"; C.t = 0; if(C.mode === "sig") feSigNew(C); }
}
function feCineDown(x, y){
  const C = feCine;
  if(C.phase === "leap"){
    /* the thirtieth viewing has earned a fast-forward */
    C.t = C.cfg.leapDur + 0.01;
    return;
  }
  if(C.phase !== "fight") return;
  if(C.mode === "ring"){
    if(!C.ring) return;
    const r = C.ring.r;
    const lo = 28 + C.hard*2.5, hi = 56 - C.hard*3;
    if(r >= lo && r <= hi) feCineHit();
    else feCineFail();
    return;
  }
  const S = C.sig; if(!S) return;
  if(S.type === "mash"){ S.bar = Math.min(1, S.bar + 0.11); C.shake = Math.max(C.shake, 2.5);
    try{ if(!fshInv().vibeOff && navigator.vibrate) navigator.vibrate(12); }catch(e){}
    if(S.bar >= 1) feCineHit("BROKEN!"); return; }
  if(S.type === "swipe"){ S.sx = x; S.sy = y; return; }
  if(S.type === "hold"){ S.holding = true; return; }
  if(S.type === "multi"){
    const p2 = S.pts.find(q=>q.n === S.next);
    if(p2 && Math.hypot(x-p2.x, y-p2.y) < 52){ p2.hit = true; S.next++;
      fbSfxSafe("give_line", 0.3);
      if(S.next > 3) feCineHit("STORM CUT!"); }
    else feCineFail();
    return; }
  if(S.type === "vanish"){
    if(S.win > 0 && Math.hypot(x-S.x, y-S.y) < 64) feCineHit("FOUND YOU!");
    else feCineFail();
    return; }
}
function feCineUp(x, y){
  const C = feCine;
  if(C.phase !== "fight" || !C.sig) return;
  const S = C.sig;
  if(S.type === "swipe" && S.sx){
    const dx = x - S.sx, dy = y - S.sy;
    if(Math.hypot(dx, dy) < 36) return;
    const want = { "⬅":[-1,0], "➡":[1,0], "⬆":[0,-1], "⬇":[0,1] }[S.dir];
    const ok = (want[0] && Math.sign(dx) === want[0] && Math.abs(dx) > Math.abs(dy)) ||
               (want[1] && Math.sign(dy) === want[1] && Math.abs(dy) > Math.abs(dx));
    if(ok) feCineHit("DODGED!"); else feCineFail();
  }
  if(S.type === "hold" && S.holding){
    S.holding = false;
    if(S.v >= 0.60 && S.v <= 0.86) feCineHit("PERFECT DRAG!");
    else feCineFail();
  }
}
function feCineMiss(){
  const C = feCine;
  C.stress++; C.flash = -0.4; C.shake = 4; C.ring = null;
  C.floats.push({ txt: "SLIPS!", t: 0 });
  fbSfxSafe("slip", 0.5);
  if(C.stress >= 3){ C.phase = "escape"; C.t = 0; }
}
/* one frame chain, ever: every kick goes through here, and a kick while a
   frame is already pending is a no-op. The old code requested a fresh chain
   from the Fight button, the watchdog and the catch handler, and none of
   them ever ended - a few tab switches meant the fight drew N times a frame */
function feCineKick(){
  const C = feCine;
  if(!C.active || C.pending) return;
  C.pending = true;
  requestAnimationFrame(feCineFrame);
}
function feCineFrame(ts){
  const C = feCine;
  C.pending = false;
  if(!C.active) return;
  try{ feCineFrameBody(ts); }catch(e){ feCineKick(); }
}
/* the shrinking-ring mechanic, one frame. Pulled out of the frame body so
   the node harness can step it at 120Hz: the old body clamped C.t to 0.54
   while waiting against a `> 0.55` spawn gate, which only a frame longer
   than 10ms could cross, so any 100Hz+ display sat on the first ring
   forever (batch 119). C.t is reset to 0 by every transition into ring
   mode, so no clamp is needed. */
function feCineRingStep(C, dt){
  if(!C.ring && C.t > 0.55){
    C.round++;
    C.ring = { x: 120 + Math.random()*230, y: 200 + Math.random()*260, r: 130, sp: 96 * (1 + 0.22*(C.hard||0)) };
  }
  if(C.ring){
    C.ring.r -= dt * (C.ring.sp || 96);
    if(C.ring.r < 22) feCineMiss(), C.t = 0;
  }
}
function feCineFrameBody(ts){
  const C = feCine;
  if(!C.last) C.last = ts;
  const dt = Math.min(0.05, (ts - C.last)/1000); C.last = ts;
  C.wall = performance.now();
  C.t += dt;
  C.flash = C.flash > 0 ? Math.max(0, C.flash - dt*2.2) : Math.min(0, C.flash + dt*2.2);
  C.shake = Math.max(0, C.shake - dt*26);
  C.boltT = Math.max(0, C.boltT - dt);
  for(const f of C.floats) f.t += dt;
  C.floats = C.floats.filter(f=>f.t < 1);
  if(C.phase === "leap" && C.t > C.cfg.leapDur){
    C.phase = "ready"; C.t = 0; C.flash = 1.0; C.shake = 10; fbSfxSafe("snag", 0.5);
    const gb = document.getElementById("feCineGo");
    if(gb) gb.style.display = "block";
  }
  if(C.phase === "fight" && C.mode === "sig" && C.sig){
    const S = C.sig;
    if(S.tl !== undefined){ S.tl -= dt; if(S.tl <= 0){ feCineFail(); } }
    if(S && S.type === "mash"){ S.bar = Math.max(0, S.bar - dt*0.34); }
    if(S && S.type === "hold" && S.holding){ S.v += dt*(S.rate || 0.42); if(S.v > 0.97){ S.holding=false; feCineFail(); } }
    if(S && S.type === "vanish"){
      if(S.dark > 0){ S.dark -= dt; if(S.dark <= 0){ S.win = 0.85 * (S.hm || 1); fbSfxSafe("splash_big", 0.3); } }
      else if(S.win > 0){ S.win -= dt; if(S.win <= 0) feCineFail(); }
    }
  }
  if(C.phase === "fight" && C.mode === "ring") feCineRingStep(C, dt);
  if(C.phase === "defeat" && C.t > 2.3) return feCineEnd(true);
  if(C.phase === "escape" && C.t > 1.9) return feCineEnd(false);
  feCineDraw();
  feCineKick();
}
function feCineDraw(){
  const cv = document.getElementById("feCineCv");
  if(!cv) return;
  const g = cv.getContext("2d");
  const C = feCine;
  g.save();
  if(C.shake > 0) g.translate((Math.random()-0.5)*C.shake, (Math.random()-0.5)*C.shake);
  g.fillStyle = "#061019"; g.fillRect(-10,-10,490,725);
  if(C.phase === "leap"){
    /* the pop-out plays smooth: neighbouring frames crossfaded */
    const N = C.cfg.n - 1;
    const f = Math.min(N - 0.001, (C.t/C.cfg.leapDur)*N);
    const a = feCineImg(C.cfg.pfx + "leap" + String(f|0).padStart(2,"0"));
    const b2 = feCineImg(C.cfg.pfx + "leap" + String(Math.min(N,(f|0)+1)).padStart(2,"0"));
    if(a) g.drawImage(a, 0, 0, 470, 705);
    if(b2){ g.globalAlpha = f - (f|0); g.drawImage(b2, 0, 0, 470, 705); g.globalAlpha = 1; }
  } else {
    /* the fury holds one dramatic still; the fight lives in overlays */
    const key = C.cfg.pfx + ((C.phase === "defeat") ? "ko" : "hero");
    const im = feCineImg(key);
    const zm = 1 + 0.014*Math.sin(C.t*1.7);
    if(im){ g.save(); g.translate(235, 352); g.scale(zm, zm); g.drawImage(im, -235, -352, 470, 705); g.restore(); }
    if(C.boltT > 0){
      /* a drawn strike, not a frame swap */
      g.strokeStyle = `rgba(160,220,255,${Math.min(1, C.boltT*3)})`; g.lineWidth = 3.4;
      for(let bi=0; bi<2; bi++){
        g.beginPath(); let bx = 300 + bi*26, by = 90;
        g.moveTo(bx, by);
        for(let sg=0; sg<6; sg++){ bx += (Math.random()-0.5)*70; by += 88; g.lineTo(bx, by); }
        g.stroke();
      }
    }
  }
  if(C.phase === "escape"){ g.fillStyle = "rgba(8,16,28,0.6)"; g.fillRect(0,0,470,705); }
  /* title & bars */
  g.textAlign = "center";
  if(C.phase === "leap"){
    if(C.t < 2.2){
      g.font = "800 21px system-ui"; g.fillStyle = "#ffd35c";
      g.globalAlpha = Math.min(1, C.t*1.6);
      g.fillText(C.cfg.title, 235, 72);
      g.globalAlpha = 1;
    }
    if(C.t > 0.8){
      g.font = "600 11px system-ui"; g.fillStyle = "rgba(255,255,255,0.55)";
      g.fillText("tap to skip", 235, 686);
    }
  } else {
    if(C.hard > 0){
      g.font = "800 12px system-ui"; g.fillStyle = "#ff8a5c"; g.textAlign = "center";
      g.fillText("⚔ HARDENED " + ["","I","II","III"][C.hard], 235, 74);
    }
    g.fillStyle = "rgba(0,0,0,0.55)"; g.fillRect(60, 26, 350, 13);
    g.fillStyle = C.hp > (C.hpMax||100)/2 ? "#ff5c5c" : "#ffd35c";
    g.fillRect(60, 26, 350 * C.hp/(C.hpMax||100), 13);
    g.font = "700 11px system-ui"; g.fillStyle = "#ffe9ec";
    g.fillText("HIS FURY", 235, 56);
    for(let i=0;i<3;i++){
      g.fillStyle = i < C.stress ? "#ff8a5c" : "rgba(255,255,255,0.25)";
      g.beginPath(); g.arc(210 + i*25, 674, 7, 0, 7); g.fill();
    }
    g.font = "700 12px system-ui"; g.fillStyle = "#cfe0ee";
    g.fillText(C.phase === "fight" ? "tap inside the gold band" : "", 235, 650);
  }
  if(C.phase === "fight" && C.mode === "sig" && C.sig){
    const S = C.sig;
    g.textAlign = "center";
    if(S.type === "mash"){
      g.font = "800 20px system-ui"; g.fillStyle = "#ffd35c";
      g.fillText("HE RUNS — TAP! TAP! TAP!", 235, 140);
      g.fillStyle = "rgba(0,0,0,0.6)"; g.fillRect(85, 160, 300, 20);
      g.fillStyle = "#ff8a5c"; g.fillRect(85, 160, 300*S.bar, 20);
      g.strokeStyle = "#ffd35c"; g.lineWidth = 2; g.strokeRect(85, 160, 300, 20);
    }
    if(S.type === "swipe"){
      g.font = "800 20px system-ui"; g.fillStyle = "#ffd35c";
      g.fillText("HIS FIST SWINGS — SWIPE " + S.dir, 235, 140);
      g.font = "800 92px system-ui";
      g.globalAlpha = 0.6 + 0.4*Math.sin(C.t*6);
      g.fillText(S.dir, 235, 380);
      g.globalAlpha = 1;
    }
    if(S.type === "hold"){
      g.font = "800 19px system-ui"; g.fillStyle = "#ffd35c";
      g.fillText("HOLD THE LINE — RELEASE IN THE BAND", 235, 140);
      g.fillStyle = "rgba(0,0,0,0.6)"; g.fillRect(85, 160, 300, 18);
      g.fillStyle = "rgba(255,211,92,0.5)"; g.fillRect(85 + 300*0.60, 160, 300*0.26, 18);
      g.fillStyle = S.v > 0.86 ? "#ff5c5c" : "#9fd8ff"; g.fillRect(85, 160, 300*Math.min(1,S.v), 18);
    }
    if(S.type === "multi"){
      g.font = "800 20px system-ui"; g.fillStyle = "#ffd35c";
      g.fillText("CUT THE LIGHTNING — IN ORDER", 235, 140);
      for(const q of S.pts){
        if(q.hit) continue;
        const on = q.n === S.next;
        g.strokeStyle = on ? "#ffd35c" : "rgba(255,255,255,0.5)"; g.lineWidth = on ? 5 : 3;
        g.beginPath(); g.arc(q.x, q.y, 34, 0, 7); g.stroke();
        g.font = "800 26px system-ui"; g.fillStyle = on ? "#ffd35c" : "#cfe0ee";
        g.fillText(q.n, q.x, q.y + 9);
      }
    }
    if(S.type === "vanish"){
      g.fillStyle = `rgba(3,7,14,${S.dark > 0 ? 0.88 : 0.8})`; g.fillRect(0, 0, 470, 705);
      g.font = "800 20px system-ui"; g.fillStyle = "#9fb2c2";
      g.fillText(S.dark > 0 ? "HE VANISHES…" : "THERE — STRIKE!", 235, 140);
      if(S.dark > 0){
        const rr2 = (0.9 - S.dark) * 60;
        g.strokeStyle = "rgba(159,216,255,0.25)"; g.lineWidth = 1.5;
        g.beginPath(); g.ellipse(S.x, S.y, 10+rr2, (10+rr2)*0.4, 0, 0, 7); g.stroke();
      } else if(S.win > 0){
        g.globalAlpha = 0.65 + 0.35*Math.sin(C.t*14);
        g.font = "800 44px system-ui"; g.fillStyle = "#eef2fa";
        g.fillText("◉ ◉", S.x, S.y + 14);
        g.globalAlpha = 1;
      }
    }
  }
  if(C.ring){
    g.strokeStyle = "rgba(255,255,255,0.85)"; g.lineWidth = 3;
    g.beginPath(); g.arc(C.ring.x, C.ring.y, C.ring.r, 0, 7); g.stroke();
    g.strokeStyle = "rgba(255,211,92,0.9)"; g.lineWidth = 7;
    g.beginPath(); g.arc(C.ring.x, C.ring.y, 42, 0, 7); g.stroke();
  }
  for(const f of C.floats){
    g.globalAlpha = 1 - f.t;
    g.font = f.crit ? "800 34px system-ui" : "800 26px system-ui";
    g.fillStyle = f.txt === "SLIPS!" ? "#ff9d8a" : "#ffd35c";
    g.fillText(f.txt, 235, 330 - f.t*46);
    g.globalAlpha = 1;
  }
  if(C.phase === "defeat"){
    g.font = "800 22px system-ui"; g.fillStyle = "#7dffb5";
    g.fillText("THE STORM BREAKS — HE IS YOURS", 235, 640);
  }
  if(C.phase === "escape"){
    g.font = "800 22px system-ui"; g.fillStyle = "#9fb2c2";
    g.fillText("HE DIVES — GONE INTO THE DEEP", 235, 640);
  }
  if(C.flash > 0){ g.fillStyle = `rgba(255,255,255,${C.flash})`; g.fillRect(0,0,470,705); }
  if(C.flash < 0){ g.fillStyle = `rgba(255,60,40,${-C.flash})`; g.fillRect(0,0,470,705); }
  g.restore();
}
function feCineEnd(won){
  const C = feCine;
  if(C.dog) clearInterval(C.dog);
  if(C.wrap) C.wrap.remove();
  feCine = { active:false, cache:C.cache };
  if(won){
    try{
      const BJ = feBossState().bossJournal;
      const rec = BJ[C.boss] = BJ[C.boss] || {};
      const prev = rec.hard || 0;
      rec.hard = Math.min(3, prev + 1);
      if(fsh && fsh.catch && prev > 0){
        fsh.catch.weightLb = +(fsh.catch.weightLb * (1 + 0.15*prev)).toFixed(1);
      }
    }catch(e){}
    if(fsh && fsh.phase === "cine") fsh.phase = "reeling";
    fshLand();                     /* the flag is set — this time he lands */
  } else {
    if(fsh && fsh.catch) fsh.catch._trueForm = 0;
    fsh = fshNew();
    showToast("👑 The Rooster King dives — the water goes still. He'll rise again.");
  }
}
