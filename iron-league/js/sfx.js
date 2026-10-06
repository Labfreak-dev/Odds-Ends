/* Iron League — file cues. OGG loops through Web Audio. MP3 is only the
   Safari fallback (encoder delay ticks a loop). Music is fetched the first
   time a bed starts. Pitch jitter only goes down. */
(function (root) {
  const IL = root.IL = root.IL || {};

  const CUES = {
    hub_loop: { path:"music/hub_loop", cat:"music", vol:0.5, dur:67.219, loop:true },
    fight_loop: { path:"music/fight_loop", cat:"music", vol:0.5, dur:65.524, loop:true },
    boss_loop: { path:"music/boss_loop", cat:"music", vol:0.5, dur:64.103, loop:true },
    endless_loop: { path:"music/endless_loop", cat:"music", vol:0.5, dur:61.936, loop:true },
    swing_light: { path:"sfx/swing_light", cat:"swing", vol:0.64, dur:0.6, loop:false, alt:"swing_light_2" },
    swing_light_2: { path:"sfx/swing_light_2", cat:"swing", vol:0.6, dur:0.313, loop:false },
    swing_heavy: { path:"sfx/swing_heavy", cat:"swing", vol:0.6, dur:0.376, loop:false },
    swing_blade: { path:"sfx/swing_blade", cat:"swing", vol:0.62, dur:0.266, loop:false },
    swing_blunt: { path:"sfx/swing_blunt", cat:"swing", vol:0.6, dur:0.343, loop:false },
    hit_sword: { path:"sfx/hit_sword", cat:"hit", vol:0.8, dur:0.355, loop:false },
    hit_axe: { path:"sfx/hit_axe", cat:"hit", vol:0.8, dur:0.32, loop:false },
    hit_spear: { path:"sfx/hit_spear", cat:"hit", vol:0.8, dur:0.316, loop:false },
    hit_dagger: { path:"sfx/hit_dagger", cat:"hit", vol:0.8, dur:0.274, loop:false, alt:"hit_dagger_2" },
    hit_dagger_2: { path:"sfx/hit_dagger_2", cat:"hit", vol:1.0, dur:0.25, loop:false },
    hit_blunt: { path:"sfx/hit_blunt", cat:"hit", vol:0.8, dur:0.372, loop:false, alt:"hit_blunt_2" },
    hit_blunt_2: { path:"sfx/hit_blunt_2", cat:"hit", vol:0.8, dur:0.473, loop:false },
    hit_fist: { path:"sfx/hit_fist", cat:"hit", vol:0.85, dur:0.332, loop:false, alt:"hit_fist_2" },
    hit_fist_2: { path:"sfx/hit_fist_2", cat:"hit", vol:0.81, dur:0.288, loop:false },
    hit_arrow: { path:"sfx/hit_arrow", cat:"hit", vol:0.77, dur:0.184, loop:false, alt:"hit_arrow_2" },
    hit_arrow_2: { path:"sfx/hit_arrow_2", cat:"hit", vol:0.78, dur:0.27, loop:false },
    hit_bullet: { path:"sfx/hit_bullet", cat:"hit", vol:0.83, dur:0.203, loop:false, alt:"hit_bullet_2" },
    hit_bullet_2: { path:"sfx/hit_bullet_2", cat:"hit", vol:0.78, dur:0.208, loop:false },
    hit_crit: { path:"sfx/hit_crit", cat:"hit", vol:0.8, dur:0.662, loop:false, alt:"hit_crit_2" },
    hit_crit_2: { path:"sfx/hit_crit_2", cat:"hit", vol:0.8, dur:0.632, loop:false },
    block_parry: { path:"sfx/block_parry", cat:"hit", vol:0.8, dur:0.246, loop:false },
    bow_draw: { path:"sfx/bow_draw", cat:"ranged", vol:0.75, dur:0.803, loop:false },
    bow_release: { path:"sfx/bow_release", cat:"ranged", vol:0.77, dur:0.6, loop:false },
    gunshot: { path:"sfx/gunshot", cat:"ranged", vol:0.75, dur:0.765, loop:false, alt:"gunshot_2" },
    gunshot_2: { path:"sfx/gunshot_2", cat:"ranged", vol:0.75, dur:0.803, loop:false },
    reload: { path:"sfx/reload", cat:"ranged", vol:0.75, dur:0.524, loop:false },
    spell_fire_cast: { path:"sfx/spell_fire_cast", cat:"spell", vol:0.75, dur:0.729, loop:false },
    spell_fire_impact: { path:"sfx/spell_fire_impact", cat:"spell", vol:0.75, dur:0.618, loop:false },
    spell_ice_cast: { path:"sfx/spell_ice_cast", cat:"spell", vol:0.74, dur:0.819, loop:false },
    spell_ice_impact: { path:"sfx/spell_ice_impact", cat:"spell", vol:0.77, dur:0.506, loop:false, alt:"spell_ice_impact_2" },
    spell_ice_impact_2: { path:"sfx/spell_ice_impact_2", cat:"spell", vol:0.77, dur:0.646, loop:false },
    spell_lightning_cast: { path:"sfx/spell_lightning_cast", cat:"spell", vol:0.75, dur:0.787, loop:false },
    spell_lightning_impact: { path:"sfx/spell_lightning_impact", cat:"spell", vol:0.75, dur:0.793, loop:false },
    spell_poison_cast: { path:"sfx/spell_poison_cast", cat:"spell", vol:0.75, dur:0.709, loop:false },
    spell_poison_impact: { path:"sfx/spell_poison_impact", cat:"spell", vol:0.86, dur:0.373, loop:false },
    spell_holy_cast: { path:"sfx/spell_holy_cast", cat:"spell", vol:0.75, dur:0.875, loop:false },
    spell_holy_impact: { path:"sfx/spell_holy_impact", cat:"spell", vol:0.74, dur:0.715, loop:false },
    spell_shadow_cast: { path:"sfx/spell_shadow_cast", cat:"spell", vol:0.75, dur:0.637, loop:false },
    spell_shadow_impact: { path:"sfx/spell_shadow_impact", cat:"spell", vol:0.75, dur:0.612, loop:false },
    spell_nature_cast: { path:"sfx/spell_nature_cast", cat:"spell", vol:0.86, dur:0.656, loop:false },
    spell_nature_impact: { path:"sfx/spell_nature_impact", cat:"spell", vol:0.97, dur:0.478, loop:false },
    spell_arcane_cast: { path:"sfx/spell_arcane_cast", cat:"spell", vol:0.75, dur:0.646, loop:false },
    spell_arcane_impact: { path:"sfx/spell_arcane_impact", cat:"spell", vol:0.77, dur:0.359, loop:false },
    heal_chime: { path:"sfx/heal_chime", cat:"spell", vol:0.75, dur:1.2, loop:false },
    shield_up: { path:"sfx/shield_up", cat:"spell", vol:0.75, dur:1.0, loop:false },
    summon: { path:"sfx/summon", cat:"spell", vol:0.75, dur:0.719, loop:false },
    ko_stinger: { path:"crowd/ko_stinger", cat:"stinger", vol:0.78, dur:0.375, loop:false },
    crowd_cheer: { path:"crowd/crowd_cheer", cat:"crowd", vol:0.61, dur:2.978, loop:false },
    crowd_gasp: { path:"crowd/crowd_gasp", cat:"crowd", vol:0.6, dur:1.696, loop:false },
    click: { path:"ui/click", cat:"ui", vol:0.7, dur:0.135, loop:false },
    tab_switch: { path:"ui/tab_switch", cat:"ui", vol:0.64, dur:0.219, loop:false },
    purchase: { path:"ui/purchase", cat:"ui", vol:0.5, dur:0.9, loop:false },
    sell: { path:"ui/sell", cat:"ui", vol:0.5, dur:0.6, loop:false },
    error_buzz: { path:"ui/error_buzz", cat:"ui", vol:0.5, dur:0.31, loop:false },
    chest_open: { path:"ui/chest_open", cat:"ui", vol:0.48, dur:0.884, loop:false },
    level_up: { path:"ui/level_up", cat:"ui_sting", vol:0.7, dur:2.019, loop:false },
    victory_sting: { path:"ui/victory_sting", cat:"ui_sting", vol:0.7, dur:2.587, loop:false },
    defeat_sting: { path:"ui/defeat_sting", cat:"ui_sting", vol:0.71, dur:2.219, loop:false },
    crowd_loop: { path:"crowd/crowd_loop", cat:"crowd_loop", vol:0.35, dur:10.0, loop:true }
  };

  const LEGACY = {
    click: "click",
    tab: "tab_switch",
    hit: "hit_sword",
    crit: "hit_crit",
    ko: "ko_stinger",
    magic: "spell_arcane_cast",
    victory: "victory_sting",
    defeat: "defeat_sting",
    purchase: "purchase",
    sell: "sell",
    error: "error_buzz",
    chest: "chest_open",
    level: "level_up"
  };

  const BARS = { hub_loop: 2.4, fight_loop: 1.82, boss_loop: 2.0, endless_loop: 1.94 };
  const DUCK = 0.708;

  let preferOgg = true;
  try {
    if (typeof root.Audio === "function") {
      const probe = new root.Audio();
      preferOgg = !!(probe.canPlayType && probe.canPlayType('audio/ogg; codecs="vorbis"'));
    }
  } catch (err) { preferOgg = true; }

  let ctx = null;
  let musicGain = null;
  let sfxGain = null;
  let crowdGain = null;
  let duckGain = null;
  const mix = { music: 0.6, sfx: 0.8, crowd: 0.7 };
  const cache = {};
  const lastAt = {};
  let lastCrit = 0;
  let musicTok = 0;
  let musicNode = null;
  let musicId = null;
  let crowdNode = null;
  let crowdOn = false;

  function clamp01(n) {
    n = Number(n);
    if (!(n > 0)) return 0;
    return n > 1 ? 1 : n;
  }

  function nowMs() {
    return root.performance && root.performance.now ? root.performance.now() : Date.now();
  }

  function applyMix() {
    if (!ctx) return;
    const t = ctx.currentTime;
    musicGain.gain.setValueAtTime(mix.music, t);
    sfxGain.gain.setValueAtTime(mix.sfx, t);
    crowdGain.gain.setValueAtTime(mix.crowd, t);
  }

  function ac() {
    if (ctx) return ctx;
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch (err) { return null; }
    musicGain = ctx.createGain();
    sfxGain = ctx.createGain();
    crowdGain = ctx.createGain();
    duckGain = ctx.createGain();
    duckGain.gain.value = 1;
    musicGain.connect(duckGain);
    duckGain.connect(ctx.destination);
    sfxGain.connect(ctx.destination);
    crowdGain.connect(ctx.destination);
    applyMix();
    return ctx;
  }

  function unlock() {
    const c = ac();
    if (c && c.state === "suspended" && c.resume) c.resume();
  }

  function busFor(cue) {
    if (cue.cat === "music") return musicGain;
    if (cue.cat === "crowd" || cue.cat === "crowd_loop") return crowdGain;
    return sfxGain;
  }

  function load(id) {
    if (cache[id]) return cache[id];
    const cue = CUES[id];
    const c = ac();
    if (!cue || !c || typeof root.fetch !== "function") {
      cache[id] = Promise.reject(new Error("no audio"));
      return cache[id];
    }
    function decode(ext) {
      return root.fetch("assets/audio/" + cue.path + "." + ext).then(function (res) {
        if (!res.ok) throw new Error("http");
        return res.arrayBuffer();
      }).then(function (buf) {
        return c.decodeAudioData(buf);
      }).then(function (buffer) {
        return { buffer: buffer, ext: ext };
      });
    }
    const first = preferOgg ? "ogg" : "mp3";
    const second = preferOgg ? "mp3" : "ogg";
    cache[id] = decode(first).catch(function () { return decode(second); });
    return cache[id];
  }

  function resolve(id) {
    const cue = CUES[id];
    if (!cue) return null;
    if (cue.alt && CUES[cue.alt] && Math.random() < 0.5) return cue.alt;
    return id;
  }

  function hitFamily(id) {
    return id.indexOf("hit_") === 0 && id.indexOf("hit_crit") !== 0;
  }

  function duck(seconds) {
    const c = ac();
    if (!c || !duckGain) return;
    const now = c.currentTime;
    const hold = Math.max(0.2, seconds || 0.4);
    const g = duckGain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(DUCK, now + 0.04);
    g.setValueAtTime(DUCK, now + hold);
    g.linearRampToValueAtTime(1, now + hold + 0.28);
  }

  function spawn(pack, id, bus, vol) {
    const c = ac();
    const cue = CUES[id];
    const src = c.createBufferSource();
    src.buffer = pack.buffer;
    if (cue.loop || cue.cat === "ui" || cue.cat === "ui_sting" || cue.cat === "stinger" || cue.cat === "crowd" || cue.cat === "music" || cue.cat === "crowd_loop") {
      src.playbackRate.value = 1;
    } else {
      src.playbackRate.value = 1 - Math.random() * 0.06;
    }
    if (cue.loop) {
      src.loop = true;
      if (pack.ext === "mp3") {
        src.loopStart = 0;
        src.loopEnd = cue.dur;
      }
    }
    const g = c.createGain();
    g.gain.value = vol;
    src.connect(g);
    g.connect(bus);
    src.start();
    return { src: src, gain: g, id: id };
  }

  function fadeNode(node, to, seconds) {
    const c = ac();
    if (!c || !node) return;
    const now = c.currentTime;
    const g = node.gain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(to, now + Math.max(0.05, seconds));
  }

  function stopNode(node, seconds) {
    if (!node) return;
    const c = ac();
    fadeNode(node, 0, seconds);
    try { node.src.stop(c.currentTime + seconds + 0.06); } catch (err) { /* already stopped */ }
  }

  function fire(id, opt) {
    opt = opt || {};
    const picked = resolve(id);
    const cue = picked && CUES[picked];
    if (!cue || cue.loop) return;
    const c = ac();
    if (!c) return;
    const now = nowMs();
    if (hitFamily(picked) && now - lastCrit < 120) return;
    if (lastAt[picked] && now - lastAt[picked] < 90) return;
    lastAt[picked] = now;
    if (picked.indexOf("hit_crit") === 0) lastCrit = now;
    const vol = typeof opt.gain === "number" ? opt.gain : cue.vol;
    if (!(vol > 0)) return;
    if (cue.cat === "stinger" || cue.cat === "ui_sting") duck(cue.dur);
    load(picked).then(function (pack) {
      spawn(pack, picked, busFor(cue), vol);
    }).catch(function () { /* missing file stays silent */ });
  }

  function play(kind, opt) {
    if (typeof opt === "number") opt = opt > 0 ? {} : { gain: 0 };
    opt = opt || {};
    unlock();
    const id = CUES[kind] ? kind : LEGACY[kind];
    if (!id) return;
    fire(id, opt);
    if (opt.layer) fire(opt.layer, {});
  }

  function bed(name) {
    const id = name ? (CUES[name + "_loop"] ? name + "_loop" : (CUES[name] ? name : null)) : null;
    if (id === musicId) return;
    unlock();
    const tok = ++musicTok;
    const prev = musicNode;
    const prevId = musicId;
    musicNode = null;
    musicId = id;
    if (prev) stopNode(prev, BARS[prevId] || 1.2);
    if (!id || !CUES[id] || !CUES[id].loop) return;
    const bar = BARS[id] || 1.6;
    load(id).then(function (pack) {
      if (tok !== musicTok) return;
      const cue = CUES[id];
      const node = spawn(pack, id, musicGain, 0);
      musicNode = node;
      fadeNode(node, cue.vol, bar);
    }).catch(function () { /* music stays quiet until a later bed */ });
  }

  function crowdBed(on) {
    on = !!on;
    if (on === crowdOn) return;
    crowdOn = on;
    unlock();
    if (!on) {
      const prev = crowdNode;
      crowdNode = null;
      stopNode(prev, 0.35);
      return;
    }
    load("crowd_loop").then(function (pack) {
      if (!crowdOn) return;
      if (crowdNode) return;
      const cue = CUES.crowd_loop;
      const node = spawn(pack, "crowd_loop", crowdGain, 0);
      crowdNode = node;
      fadeNode(node, cue.vol, 0.4);
    }).catch(function () {});
  }

  function setMix(next) {
    if (!next) return;
    if (typeof next.music === "number") mix.music = clamp01(next.music);
    if (typeof next.sfx === "number") mix.sfx = clamp01(next.sfx);
    if (typeof next.crowd === "number") mix.crowd = clamp01(next.crowd);
    applyMix();
  }

  IL.sfx = {
    play: play,
    bed: bed,
    crowdBed: crowdBed,
    setMix: setMix,
    unlock: unlock,
    clips: Object.keys(CUES)
  };
})(typeof window !== "undefined" ? window : globalThis);
