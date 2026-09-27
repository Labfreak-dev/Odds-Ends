/* =====================================================================
   SOUND — the one-shot player, eager at startup
   ---------------------------------------------------------------------
   Pack, mine, wheel and the rest of the floor need a voice before the
   fishing bundle arrives, so the registry lookup, the bus and feSound
   live here. fishing-sfx.module.js only merges the three beds in later.
   The 90-sound pack (sfx-pack.module.js) Object.assigns into FE_SFX and
   aliases the old key names, so existing feSound("treasure") calls keep
   working.

   Effects are on unless Settings says otherwise (state.settings.sfxOff,
   default false). The early return stays: it is the mute, not a deletion.
   The bus is still the soft one — 110 Hz high-pass, 4.2 kHz low-pass,
   compressor, limiter, then ×0.5. The new samples are already mastered
   soft, so they do not take the old per-key trim or the extra 3 kHz cut.
   ===================================================================== */
let feAC = null, feBuf = {}, feLoops = {}, feLastPlay = {};
function feAudioCtx(){
  if(!feAC){ try{ feAC = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} }
  return feAC;
}
function feAudioUnlock(){ const c = feAudioCtx(); if(c && c.state === "suspended") c.resume().catch(()=>{}); }
function feGlobalSfxOff(){ try{ return !!(state.settings && state.settings.sfxOff); }catch(e){ return false; } }
function feGlobalMusicOff(){ try{ return !!(state.settings && state.settings.musicOff); }catch(e){ return false; } }
function feGlobalVol(k, d){ try{ const v = state.settings && state.settings[k]; return v === undefined ? d : v; }catch(e){ return d; } }
function feInFishing(){ try{ const t = document.getElementById("tab-fishing"); return !!t && t.style.display !== "none"; }catch(e){ return false; } }
function feMuted(){ if(feGlobalSfxOff()) return true; try{ return feInFishing() && typeof fshInv === "function" && !!fshInv().sfxMute; }catch(e){ return false; } }
function feMusicMuted(){ if(feGlobalMusicOff()) return true; try{ return typeof fshInv === "function" && !!fshInv().musicMute; }catch(e){ return false; } }
/* The pack is pre-mastered. Old trims and the extra 3 kHz soft-set would
   muffle it, so both stay empty. The 4.2 kHz bus is the softness. */
const FE_SFX_TRIM = {};
const FE_SFX_GAP  = { treasure:.25, reward_good:.3, equip:.3, box_open:.3, perfect:.3, snag:.3, splash_small:.25, bait:.4, reward_common:.3, reward_rare:.3,
  mg_mining_pick_tap:.25, ui_click:.08 };
const FE_SFX_SOFT = new Set();
let feBus = null;
let feVoices = 0;
const FE_MAX_VOICES = 4;
function feSfxBus(){
  const c = feAudioCtx(); if(!c) return null;
  if(feBus) return feBus;
  try{
    /* Everything that is not music runs through a rumble cut and a 4.2 kHz
       low-pass — the fizz that made the old samples jarring lives above it —
       then a gentle compressor, a fast limiter, and a final trim. */
    const g = c.createGain(); g.gain.value = 1;
    const hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 110; hp.Q.value = 0.5;
    const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 4200; lp.Q.value = 0.5;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 14; comp.ratio.value = 3; comp.attack.value = 0.006; comp.release.value = 0.2;
    const lim = c.createDynamicsCompressor();
    lim.threshold.value = -6; lim.knee.value = 2; lim.ratio.value = 12; lim.attack.value = 0.001; lim.release.value = 0.09;
    const out = c.createGain(); out.gain.value = 0.5;
    g.connect(hp); hp.connect(lp); lp.connect(comp); comp.connect(lim); lim.connect(out); out.connect(c.destination);
    feBus = g;
  }catch(e){ feBus = null; }
  return feBus;
}
function feSoundSettingsChanged(){
  try{
    feApplyVols();
    if(feMuted()) for(const k in feLoops){ if(!feLoops[k].isMus) feLoopStop(k); }
    if(feMusicMuted()) for(const k in feLoops){ if(feLoops[k].isMus) feLoopStop(k); }
  }catch(e){}
}
try{ window.oeSoundSettingsChanged = feSoundSettingsChanged; }catch(e){}
function feBuffer(key){
  if(feBuf[key]) return Promise.resolve(feBuf[key] === "pending" ? null : feBuf[key]);
  const c = feAudioCtx();
  if(!c || typeof FE_SFX === "undefined" || !FE_SFX[key]) return Promise.resolve(null);
  feBuf[key] = "pending";
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
      const p = c.decodeAudioData(bytes.buffer.slice(0), done, fail);
      if(p && p.then) p.then(done).catch(fail);
    }catch(e){ fail(); }
  });
}
function feSfxVol(){
  const g = feGlobalVol("sfxVol", 0.5);
  try{ const v = fshInv().sfxVol; return g * (feInFishing() && v !== undefined ? v : 1); }catch(e){ return g; }
}
function feMusVol(){
  const g = feGlobalVol("musicVol", 0.7);
  try{ const v = fshInv().musicVol; return g * (v === undefined ? 1 : v); }catch(e){ return g; }
}
const FE_BEDS = new Set(["music", "music_night", "amb_water"]);
function feSound(key, opt){
  /* Settings owns the switch. sfxOff defaults to false, so effects play
     until someone turns them off. Beds never come through here. */
  if(feGlobalSfxOff()) return;
  opt = opt || {};
  if(feMuted()) return;
  const gap = opt.gap !== undefined ? opt.gap : (FE_SFX_GAP[key] !== undefined ? FE_SFX_GAP[key] : 0.12);
  if(gap){ const now = (typeof performance!=="undefined"?performance.now():Date.now())/1000, last = feLastPlay[key]||-9; if(now - last < gap) return; feLastPlay[key] = now; }
  if(feVoices >= FE_MAX_VOICES) return;
  const c = feAudioCtx(); if(!c) return;
  feBuffer(key).then(buf=>{
    if(!buf || feMuted() || feGlobalSfxOff() || feVoices >= FE_MAX_VOICES) return;
    const src = c.createBufferSource(); src.buffer = buf;
    const rate = (opt.rate || 1) * (0.95 + Math.random()*0.1);
    src.playbackRate.value = rate;
    const peak = (opt.vol !== undefined ? opt.vol : 0.8) * (FE_SFX_TRIM[key] || 1) * feSfxVol();
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
    try{ src.start(); }catch(e){ feVoices = Math.max(0, feVoices - 1); return; }
    try{ if(typeof window.__oeSfxTap === "function") window.__oeSfxTap(key); }catch(e){}
  }).catch(()=>{});
}
function feLoopStart(key, vol){
  if(!FE_BEDS.has(key)) return;
  const isMus = true;
  const muted = feMusicMuted();
  if(muted || feLoops[key]) return;
  const c = feAudioCtx(); if(!c) return;
  feLoops[key] = { pending:true };
  feBuffer(key).then(buf=>{
    if(!buf || !feLoops[key] || feLoops[key].src){ return; }
    const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
    const base = (vol !== undefined ? vol : 0.5) * (isMus ? 1 : 0.8);
    const g = c.createGain();
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
/* Guarded one-shot used by every mode. opt may carry rate or gap. */
function fbSfxSafe(k, v, opt){
  try{
    if(typeof FE_SFX!=="undefined" && FE_SFX[k]) feSound(k, Object.assign({vol:v}, opt||{}));
  }catch(e){}
}
/* Rarity chime for a revealed card, then a NEW badge if the pull is new. */
function oeRevealSfx(c){
  try{
    if(!c) return;
    const r = c.rarity|0;
    let key = "collect_common", vol = 0.3;
    if(r >= 15){ key = "collect_mythic"; vol = 0.5; }
    else if(r >= 14){ key = "collect_legendary"; vol = 0.45; }
    else if(r >= 12){ key = "collect_epic"; vol = 0.4; }
    else if(r >= 9){ key = "collect_rare"; vol = 0.38; }
    else if(r >= 6){ key = "collect_fine"; vol = 0.34; }
    else if(r >= 3){ key = "collect_uncommon"; vol = 0.32; }
    feSound(key, {vol:vol});
    if(c._wasNew || c.isNew) feSound("collect_new_card", {vol:0.3, gap:0.05});
  }catch(e){}
}
/* One woodblock under buttons, play-cards and the bottom nav. Specific
   sounds still play on top; the voice cap keeps the stack at four. */
function oeSfxBindClicks(){
  if(oeSfxBindClicks.done) return;
  oeSfxBindClicks.done = true;
  try{
    document.addEventListener("click", function(ev){
      try{
        const t = ev.target && ev.target.closest && ev.target.closest("button, .btn, .play-card");
        if(!t) return;
        feSound("ui_click", {vol:0.25});
      }catch(e){}
    }, true);
  }catch(e){}
}
try{ oeSfxBindClicks(); }catch(e){}
