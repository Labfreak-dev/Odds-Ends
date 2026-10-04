/* arena-render.js — pixel fight view for the arena sim (flag ?arena=1).
 *
 * One DPR-aware canvas: painted biome, tiled floor, depth-sorted fighters,
 * projectiles, telegraphs, bars, pixel damage numbers, HUD. Classic scripts,
 * no imports. Draws from GArena.view() plus the events tick() already returns.
 * Creatures with an atlas JSON use that sheet. Everyone else is the existing
 * img/ render, baked down to ~48px and drawn nearest-neighbour with a 1px
 * outline, posed with the glim-anim archetypes.
 *
 *   GArenaView.mount(boardEl, opts) / .frame(view, opt) / .push(events) / .unmount()
 *   GArenaView.loadAtlas(def) / .frameIndex(id, clip, elapsed, hitAt)
 *   GArenaView.makeDemoAtlas() / .bind(canvas) / .playDemo(name) / .bench(ms)
 */
(function (root) {
  'use strict';

  const AW = 960, AH = 600, OBL = 0.70;
  const PAL = {
    ember: ['#ff7a2a', '#ffd36b', '#ff3d1f'], tide: ['#2fa6ff', '#a6e8ff', '#ffffff'], bloom: ['#4fd35a', '#c2ff6b', '#ffe36b'],
    volt: ['#ffd21f', '#fff7b0', '#7fd8ff'], stone: ['#e0a860', '#a8743f', '#f6dcb0'], shade: ['#a08bff', '#6a3cd6', '#f0c6ff'],
    frost: ['#8fe3ff', '#ffffff', '#5fb8ff'], gale: ['#7dffc2', '#eafff6', '#3fd6a8'], metal: ['#dfe8f2', '#ffffff', '#93a8be'],
    mystic: ['#d9a6ff', '#ff9be8', '#fff2a8'], gold: ['#ffd65a', '#fff3b8', '#ff9f2a'], heal: ['#6bff8f', '#d6ffb8', '#ffffff'],
    shield: ['#7fd0ff', '#d8f3ff', '#ffffff'], blood: ['#ff4d6d', '#ffb0c0', '#ff1f4b'],
  };
  const BIOME = {
    verdant: '#163222', magma: '#3a120c', grotto: '#0c2436', spire: '#221636', crypt: '#120a1c',
    tundra: '#1a2834', skyisles: '#162844', dunes: '#3a2810', mire: '#121e16', foundry: '#241810',
    observatory: '#101628', core: '#2a1020',
  };
  const pal = el => PAL[el] || PAL.mystic;
  const hex = el => pal(el)[0];

  // glim-anim archetypes, ported so the canvas poses match the DOM ones.
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
  const ROLE_GUESS = { striker: 'quad', tank: 'heavy', caster: 'floater', support: 'round' };

  function archOf(sp, role, boss) {
    const GA = root.GlimAnim;
    if (GA && GA.params) {
      try { return GA.params(sp, role, boss); } catch (e) { /* table missing a key */ }
    }
    const name = boss ? 'heavy' : (ROLE_GUESS[role] || 'round');
    return Object.assign({ name }, ARCH[name] || ARCH.round, boss ? { mass: 2.2, amp: 0.7 } : null);
  }

  // 3×5 pixel glyphs, row-major. Enough for numbers, the countdown, and short banners.
  const FONT = {
    '0': '111101101101111', '1': '010010010010010', '2': '111001111100111', '3': '111001111001111',
    '4': '101101111001001', '5': '111100111001111', '6': '111100111101111', '7': '111001001001001',
    '8': '111101111101111', '9': '111101111001111',
    A: '111101111101101', B: '110101110101110', C: '111100100100111', D: '110101101101110',
    E: '111100111100111', F: '111100111100100', G: '111100101101111', H: '101101111101101',
    I: '111010010010111', J: '001001001101111', K: '101101110101101', L: '100100100100111',
    M: '101111101101101', N: '110101101101101', O: '111101101101111', P: '111101111100100',
    Q: '111101101111011', R: '111101110101101', S: '111100111001111', T: '111010010010010',
    U: '101101101101111', V: '101101101101010', W: '101101101111101', X: '101101010101101',
    Y: '101101010010010', Z: '111001010100111',
    '+': '000010111010000', '-': '000000111000000', '!': '010010010000010', '?': '111001010000010',
    ':': '000010000010000', '.': '000000000000010', ' ': '000000000000000', "'": '010010000000000',
  };

  function glyph(ch) { return FONT[String(ch).toUpperCase()] || FONT[' ']; }
  function textWidth(str, scale) { return str.length * (3 * scale + scale) - scale; }
  function drawText(ctx, str, x, y, scale, color, align) {
    const w = textWidth(str, scale);
    let cx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    const s = scale;
    ctx.fillStyle = 'rgba(0,0,0,.75)';
    for (let i = 0; i < str.length; i++) {
      const g = glyph(str[i]);
      for (let p = 0; p < 15; p++) if (g[p] === '1') ctx.fillRect(cx + (p % 3) * s + s, y + ((p / 3) | 0) * s + s, s, s);
      cx += 4 * s;
    }
    cx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    ctx.fillStyle = color;
    for (let i = 0; i < str.length; i++) {
      const g = glyph(str[i]);
      for (let p = 0; p < 15; p++) if (g[p] === '1') ctx.fillRect(cx + (p % 3) * s, y + ((p / 3) | 0) * s, s, s);
      cx += 4 * s;
    }
  }

  // ---- caches -----------------------------------------------------------------------
  const atlases = new Map();
  const arts = new Map();
  const floors = new Map();
  const images = new Map();
  let iconSheet = null;
  let shadowBlob = null;
  let scratch = null;
  let vignette = null;
  let vignetteKey = '';

  function loadImage(url) {
    if (!url) return Promise.reject(new Error('no url'));
    let rec = images.get(url);
    if (rec) return rec.promise;
    rec = {};
    rec.promise = new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => { rec.img = img; resolve(img); };
      img.onerror = () => reject(new Error('image ' + url));
      img.src = url;
    });
    images.set(url, rec);
    return rec.promise;
  }

  function bakeShadow() {
    if (shadowBlob || typeof document === 'undefined') return;
    const c = document.createElement('canvas');
    c.width = 48; c.height = 20;
    const g = c.getContext('2d');
    const rg = g.createRadialGradient(24, 10, 2, 24, 10, 22);
    rg.addColorStop(0, 'rgba(0,0,0,.55)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, 48, 20);
    shadowBlob = c;
  }

  function ensureScratch(w, h) {
    if (!scratch) {
      scratch = document.createElement('canvas');
      scratch._g = scratch.getContext('2d', { willReadFrequently: true });
    }
    if (scratch.width !== w || scratch.height !== h) { scratch.width = w; scratch.height = h; }
    return scratch._g;
  }

  // Trim empty margins, draw the creature into ~48px, then a 1px dark outline.
  function bakeArt(img) {
    const sw = img.naturalWidth || img.width, sh = img.naturalHeight || img.height;
    const scan = document.createElement('canvas');
    const maxScan = 220;
    const sc = Math.min(1, maxScan / Math.max(sw, sh));
    scan.width = Math.max(1, Math.round(sw * sc));
    scan.height = Math.max(1, Math.round(sh * sc));
    const sg = scan.getContext('2d', { willReadFrequently: true });
    sg.imageSmoothingEnabled = true;
    sg.drawImage(img, 0, 0, scan.width, scan.height);
    const data = sg.getImageData(0, 0, scan.width, scan.height).data;
    let x0 = scan.width, y0 = scan.height, x1 = 0, y1 = 0;
    for (let y = 0; y < scan.height; y++) for (let x = 0; x < scan.width; x++) {
      if (data[(y * scan.width + x) * 4 + 3] > 28) {
        if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y;
      }
    }
    if (x1 < x0) { x0 = 0; y0 = 0; x1 = scan.width - 1; y1 = scan.height - 1; }
    const cropW = x1 - x0 + 1, cropH = y1 - y0 + 1;
    const maxH = 48, maxW = 56;
    const aspect = cropW / cropH;
    let dw, dh;
    if (aspect > maxW / maxH) { dw = maxW; dh = Math.max(8, Math.round(maxW / aspect)); }
    else { dh = maxH; dw = Math.max(8, Math.round(maxH * aspect)); }
    const pad = 1;
    const c = document.createElement('canvas');
    c.width = dw + pad * 2; c.height = dh + pad * 2;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    const sx0 = x0 / sc, sy0 = y0 / sc, sx1 = (x1 + 1) / sc, sy1 = (y1 + 1) / sc;
    g.drawImage(img, sx0, sy0, sx1 - sx0, sy1 - sy0, pad, pad, dw, dh);
    const id = g.getImageData(0, 0, c.width, c.height);
    const W = c.width, H = c.height, d = id.data;
    // Snap to a short palette so the downscale reads as pixels, not a blurry photo.
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] <= 30) continue;
      d[i] = d[i] & 0xf0;
      d[i + 1] = d[i + 1] & 0xf0;
      d[i + 2] = d[i + 2] & 0xf0;
    }
    const src = new Uint8ClampedArray(d);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (src[i + 3] > 30) continue;
      let hit = false;
      for (let n = 0; n < 4; n++) {
        const xx = x + (n === 0 ? 1 : n === 1 ? -1 : 0);
        const yy = y + (n === 2 ? 1 : n === 3 ? -1 : 0);
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        if (src[(yy * W + xx) * 4 + 3] > 80) { hit = true; break; }
      }
      if (hit) { d[i] = 18; d[i + 1] = 10; d[i + 2] = 28; d[i + 3] = 230; }
    }
    g.putImageData(id, 0, 0);
    return {
      canvas: c, w: c.width, h: c.height,
      feet: [(pad + dw * 0.5) / c.width, (pad + dh - 0.5) / c.height],
    };
  }

  function prepareArt(key, url) {
    if (!key || !url) return Promise.resolve(null);
    let rec = arts.get(key);
    if (rec && rec.url === url && (rec.baked || rec.promise)) return rec.promise || Promise.resolve(rec.baked);
    rec = { url, baked: null, promise: null };
    arts.set(key, rec);
    rec.promise = loadImage(url).then(img => {
      rec.baked = bakeArt(img);
      rec.img = img;
      return rec.baked;
    }).catch(() => { rec.baked = null; return null; });
    return rec.promise;
  }

  function normalizeAtlas(data) {
    const clips = data.clips || {};
    const need = ['idle', 'run', 'attack', 'cast', 'hit', 'death'];
    for (let i = 0; i < need.length; i++) if (!clips[need[i]]) clips[need[i]] = null;
    return {
      id: data.id,
      image: data.image,
      facing: data.facing || 'right',
      feet: data.feet || [0.5, 0.92],
      radius: data.radius || 26,
      muzzle: data.muzzle || null,
      clips,
    };
  }

  function clipOf(atlas, name) {
    const c = atlas.clips[name];
    if (c && c.frames && c.frames.length) return c;
    if (name === 'death') {
      const hit = atlas.clips.hit;
      if (hit && hit.frames && hit.frames.length) return { fps: hit.fps || 10, loop: false, frames: [hit.frames[hit.frames.length - 1]], hit: 0 };
    }
    const idle = atlas.clips.idle;
    if (idle && idle.frames && idle.frames.length) return idle;
    return null;
  }

  // Frame shown at `elapsed` seconds. When hitAt is set, frame `hit` lands on that time.
  function frameIndex(atlasOrId, name, elapsed, hitAt) {
    const atlas = typeof atlasOrId === 'string' ? atlases.get(atlasOrId) : atlasOrId;
    if (!atlas) return 0;
    const clip = clipOf(atlas, name);
    if (!clip) return 0;
    const n = clip.frames.length;
    const fps = clip.fps || 8;
    const hit = clip.hit != null ? clip.hit : (name === 'attack' ? 3 : name === 'cast' ? 4 : null);
    let idx;
    if (hit != null && hitAt > 0 && (name === 'attack' || name === 'cast')) {
      const h = Math.max(0, Math.min(n - 1, hit));
      if (elapsed <= hitAt) idx = Math.min(h, Math.floor((elapsed / hitAt) * h));
      else idx = Math.min(n - 1, h + Math.floor((elapsed - hitAt) * fps));
    } else {
      idx = Math.floor(Math.max(0, elapsed) * fps);
      if (clip.loop) idx = ((idx % n) + n) % n;
      else idx = Math.min(n - 1, idx);
    }
    return Math.max(0, Math.min(n - 1, idx));
  }

  function loadAtlas(def) {
    const data = typeof def === 'string' ? null : normalizeAtlas(def);
    const job = (typeof def === 'string')
      ? fetch(def).then(r => { if (!r.ok) throw new Error('atlas ' + def); return r.json(); }).then(normalizeAtlas)
      : Promise.resolve(data);
    return job.then(atlas => loadImage(atlas.image).then(img => {
      atlas.img = img;
      atlases.set(atlas.id, atlas);
      return atlas;
    }));
  }

  function makeDemoAtlas() {
    const fw = 32, fh = 32, cols = 4;
    const order = ['idle', 'run', 'attack', 'cast', 'hit', 'death'];
    const sheet = document.createElement('canvas');
    sheet.width = fw * cols; sheet.height = fh * order.length;
    const g = sheet.getContext('2d');
    function pix(x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }
    order.forEach((name, row) => {
      for (let f = 0; f < cols; f++) {
        const ox = f * fw, oy = row * fh;
        const bob = name === 'idle' ? (f % 2 ? -1 : 0) : 0;
        const step = name === 'run' ? (f % 2 ? 2 : -1) : 0;
        const lunge = name === 'attack' ? (f === 3 ? 6 : f === 2 ? 2 : f === 1 ? -2 : 0) : 0;
        const rise = name === 'cast' ? (f >= 2 ? -4 : 1) : 0;
        const flinch = name === 'hit' ? (f === 0 ? 0 : -3) : 0;
        const fall = name === 'death' ? f * 3 : 0;
        const y = oy + 6 + bob + rise + fall;
        pix(ox + 10 + lunge + flinch, y + 8, 12, 10, '#e07048');
        pix(ox + 8 + lunge + flinch, y + 14, 16, 10, '#c05030');
        pix(ox + 20 + lunge, y + 16, f === 3 && name === 'attack' ? 8 : 4, 3, f === 3 && name === 'attack' ? '#ffe36b' : '#e07048');
        pix(ox + 12 + step, y + 22 + (name === 'death' ? 2 : 0), 4, name === 'death' && f > 1 ? 2 : 6, '#5a2418');
        pix(ox + 18 - step, y + 22, 4, name === 'run' && f % 2 ? 4 : 6, '#5a2418');
        pix(ox + 13 + lunge + flinch, y + 11, 2, 2, '#fff8e8');
        pix(ox + 17 + lunge + flinch, y + 11, 2, 2, '#fff8e8');
        if (name === 'attack' && f === 3) pix(ox + 26, y + 14, 4, 4, '#fff3b0');
      }
    });
    const frames = (row) => [0, 1, 2, 3].map(i => ({ x: i * fw, y: row * fh, w: fw, h: fh }));
    const def = {
      id: 'demo_hero',
      image: sheet.toDataURL('image/png'),
      facing: 'right',
      feet: [0.5, 0.92],
      radius: 26,
      muzzle: [0.84, 0.55],
      clips: {
        idle: { fps: 8, loop: true, frames: frames(0) },
        run: { fps: 12, loop: true, frames: frames(1) },
        attack: { fps: 14, loop: false, hit: 3, frames: frames(2) },
        cast: { fps: 12, loop: false, hit: 2, frames: frames(3) },
        hit: { fps: 12, loop: false, frames: frames(4) },
        death: { fps: 10, loop: false, frames: frames(5) },
      },
    };
    return loadAtlas(def);
  }

  // 16×16 status icons, one strip.
  const ICON_NAMES = ['burn', 'poison', 'soak', 'stun', 'root', 'curse', 'blind', 'chill', 'shred', 'hex', 'atkUp', 'defUp', 'spdUp', 'critUp', 'dodge', 'regen', 'taunt'];
  function bakeIcons() {
    if (iconSheet || typeof document === 'undefined') return;
    const c = document.createElement('canvas');
    c.width = 16 * ICON_NAMES.length; c.height = 16;
    const g = c.getContext('2d');
    function px(ox, x, y, w, h, col) { g.fillStyle = col; g.fillRect(ox + x, y, w, h); }
    ICON_NAMES.forEach((name, i) => {
      const o = i * 16;
      if (name === 'burn') { px(o, 7, 1, 2, 2, '#fff3b0'); px(o, 6, 3, 4, 3, '#ffd36b'); px(o, 5, 6, 6, 4, '#ff7a2a'); px(o, 6, 10, 4, 4, '#ff3d1f'); px(o, 3, 8, 2, 3, '#ff7a2a'); px(o, 11, 8, 2, 3, '#ff7a2a'); }
      else if (name === 'poison') { px(o, 4, 3, 8, 6, '#7d5cff'); px(o, 6, 1, 4, 3, '#b9a0ff'); px(o, 5, 9, 6, 4, '#4a2a88'); px(o, 6, 5, 1, 2, '#1a1028'); px(o, 9, 5, 1, 2, '#1a1028'); }
      else if (name === 'soak') { px(o, 7, 1, 2, 3, '#d8f6ff'); px(o, 5, 4, 6, 4, '#2fa6ff'); px(o, 4, 7, 8, 5, '#1f7fd6'); px(o, 6, 12, 4, 2, '#2fa6ff'); px(o, 6, 5, 2, 2, '#fff'); }
      else if (name === 'stun') { px(o, 7, 1, 2, 14, '#ffd21f'); px(o, 1, 7, 14, 2, '#ffd21f'); px(o, 3, 3, 3, 3, '#fff7b0'); px(o, 10, 3, 3, 3, '#fff7b0'); px(o, 3, 10, 3, 3, '#fff7b0'); px(o, 10, 10, 3, 3, '#fff7b0'); }
      else if (name === 'root') { px(o, 7, 8, 2, 6, '#6a4a28'); px(o, 4, 11, 3, 2, '#6a4a28'); px(o, 9, 12, 3, 2, '#6a4a28'); px(o, 5, 2, 6, 4, '#4fd35a'); px(o, 4, 5, 3, 3, '#2f9a3a'); px(o, 9, 4, 3, 3, '#c2ff6b'); }
      else if (name === 'curse') { px(o, 4, 2, 8, 7, '#d9a6ff'); px(o, 6, 4, 1, 2, '#1a1028'); px(o, 9, 4, 1, 2, '#1a1028'); px(o, 5, 8, 6, 2, '#6a3cd6'); px(o, 3, 11, 10, 3, '#2a1848'); }
      else if (name === 'blind') { px(o, 2, 6, 5, 4, '#ddd'); px(o, 9, 6, 5, 4, '#ddd'); px(o, 4, 7, 2, 2, '#222'); px(o, 11, 7, 2, 2, '#222'); px(o, 2, 3, 12, 2, '#ff5468'); px(o, 3, 11, 10, 2, '#ff5468'); }
      else if (name === 'chill') { px(o, 7, 1, 2, 14, '#fff'); px(o, 1, 7, 14, 2, '#8fe3ff'); px(o, 4, 4, 8, 2, '#d8f6ff'); px(o, 4, 10, 8, 2, '#8fe3ff'); px(o, 7, 4, 2, 8, '#fff'); }
      else if (name === 'shred') { px(o, 2, 3, 3, 3, '#f2f6fb'); px(o, 6, 2, 3, 3, '#dfe8f2'); px(o, 10, 3, 3, 3, '#f2f6fb'); px(o, 3, 6, 2, 8, '#93a8be'); px(o, 7, 5, 2, 9, '#dfe8f2'); px(o, 11, 6, 2, 8, '#93a8be'); }
      else if (name === 'hex') { px(o, 4, 1, 8, 2, '#ff9be8'); px(o, 2, 4, 2, 8, '#d9a6ff'); px(o, 12, 4, 2, 8, '#d9a6ff'); px(o, 4, 13, 8, 2, '#ff9be8'); px(o, 6, 6, 4, 4, '#fff2a8'); }
      else if (name === 'atkUp') { px(o, 7, 1, 2, 6, '#ffd65a'); px(o, 4, 4, 3, 2, '#ffd65a'); px(o, 9, 4, 3, 2, '#ffd65a'); px(o, 6, 8, 4, 6, '#fff'); px(o, 4, 12, 8, 2, '#c8d3df'); }
      else if (name === 'defUp') { px(o, 3, 2, 10, 3, '#d8f3ff'); px(o, 2, 5, 12, 6, '#7fd0ff'); px(o, 4, 11, 8, 3, '#2f8bff'); px(o, 7, 6, 2, 4, '#fff'); }
      else if (name === 'spdUp') { px(o, 3, 8, 6, 3, '#7dffc2'); px(o, 8, 6, 5, 3, '#eafff6'); px(o, 5, 11, 4, 2, '#3fd6a8'); px(o, 9, 9, 3, 2, '#3fd6a8'); px(o, 2, 4, 4, 2, '#fff'); px(o, 1, 6, 3, 1, '#fff'); }
      else if (name === 'critUp') { px(o, 7, 1, 2, 4, '#ffe36b'); px(o, 7, 11, 2, 4, '#ffe36b'); px(o, 1, 7, 4, 2, '#ffe36b'); px(o, 11, 7, 4, 2, '#ffe36b'); px(o, 6, 6, 4, 4, '#fff'); }
      else if (name === 'dodge') { px(o, 2, 7, 5, 2, '#eafff6'); px(o, 6, 5, 4, 2, '#7dffc2'); px(o, 9, 3, 4, 2, '#fff'); px(o, 8, 8, 5, 2, '#3fd6a8'); px(o, 4, 10, 6, 2, '#3fd6a8'); }
      else if (name === 'regen') { px(o, 6, 2, 4, 12, '#6bff8f'); px(o, 2, 6, 12, 4, '#d6ffb8'); px(o, 7, 3, 2, 10, '#fff'); px(o, 3, 7, 10, 2, '#fff'); }
      else if (name === 'taunt') { px(o, 6, 1, 4, 8, '#ffd65a'); px(o, 4, 8, 8, 3, '#ff9f2a'); px(o, 7, 11, 2, 3, '#ff9f2a'); px(o, 5, 3, 2, 2, '#3a1d00'); px(o, 9, 3, 2, 2, '#3a1d00'); }
    });
    iconSheet = c;
  }
  function iconIndex(name) { return ICON_NAMES.indexOf(name); }

  function floorFor(biome) {
    const key = biome || 'verdant';
    if (floors.has(key)) return floors.get(key);
    const S = 128;
    const c = document.createElement('canvas');
    c.width = S; c.height = S;
    const g = c.getContext('2d');
    g.fillStyle = BIOME[key] || '#161222';
    g.fillRect(0, 0, S, S);
    const tile = 16;
    for (let y = 0; y < S; y += tile) for (let x = 0; x < S; x += tile) {
      const alt = ((x / tile + y / tile) & 1);
      g.fillStyle = alt ? 'rgba(255,255,255,.045)' : 'rgba(0,0,0,.22)';
      g.fillRect(x, y, tile, tile);
      g.fillStyle = 'rgba(0,0,0,.45)';
      g.fillRect(x, y, tile, 1);
      g.fillRect(x, y, 1, tile);
      g.fillStyle = 'rgba(255,255,255,.05)';
      g.fillRect(x + 1, y + 1, tile - 2, 1);
    }
    for (let i = 0; i < 90; i++) {
      g.fillStyle = (i & 1) ? 'rgba(0,0,0,.35)' : 'rgba(255,255,255,.06)';
      g.fillRect((i * 47) % S, (i * 29) % S, 1, 1);
    }
    floors.set(key, c);
    return c;
  }
  let floorPat = null, floorPatKey = '';
  function floorPattern(g) {
    const key = biome || 'verdant';
    if (!floorPat || floorPatKey !== key) {
      floorPatKey = key;
      floorPat = g.createPattern(floorFor(key), 'repeat');
    }
    return floorPat;
  }
  function artKeyOf(u, extra) {
    return (u && u.art) || (extra && extra.art) || '';
  }

  // ---- pose -------------------------------------------------------------------------
  function lerpKeys(frames, t) {
    const n = frames.length;
    const tt = Math.max(0, Math.min(frames[n - 1][0], t));
    let i = 0;
    while (i < n - 2 && frames[i + 1][0] < tt) i++;
    const a = frames[i], b = frames[i + 1];
    const span = (b[0] - a[0]) || 1;
    let k = (tt - a[0]) / span;
    k = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    return {
      x: a[1] + (b[1] - a[1]) * k, y: a[2] + (b[2] - a[2]) * k,
      sx: a[3] + (b[3] - a[3]) * k, sy: a[4] + (b[4] - a[4]) * k,
      r: a[5] + (b[5] - a[5]) * k, sk: a[6] + (b[6] - a[6]) * k,
      sh: a[7] + (b[7] - a[7]) * k, a: a[8] + (b[8] - a[8]) * k,
    };
  }
  const REST = [0, 0, 0, 1, 1, 0, 0, 1, 1];
  function idlePose(P, age) {
    const a = P.amp, w = (age / P.per) * Math.PI * 2, k = P.tilt;
    const o = { x: 0, y: 0, sx: 1, sy: 1, r: 0, sk: 0, sh: 1, a: 1 };
    if (P.idle === 'hover') { o.y = -0.06 * a * (0.5 + 0.5 * Math.sin(w)); o.r = 1.6 * k * Math.sin(w); o.sy = 1 + 0.02 * a * Math.sin(w); o.sh = 0.75 + 0.12 * Math.sin(w); }
    else if (P.idle === 'flutter') { o.y = -0.05 * a - 0.03 * a * Math.sin(w * 2); o.r = Math.sin(w * 2) * 2 * k; o.sy = 1 + 0.03 * Math.abs(Math.sin(w * 2)); o.sh = 0.7; }
    else if (P.idle === 'sway') { o.r = Math.sin(w) * 2.4 * a * k; o.sk = Math.sin(w) * 0.08 * a; o.sy = 1 + 0.02 * Math.sin(w); }
    else if (P.idle === 'coil') { o.sk = Math.sin(w) * 0.12 * a; o.sy = 1 + 0.035 * (0.5 + 0.5 * Math.sin(w)); }
    else if (P.idle === 'twitch') {
      const f = (age % P.per) / P.per;
      if (f > 0.62 && f < 0.86) { o.r = Math.sin(f * 80) * 3 * k; o.y = -0.02 * a; }
    } else {
      const s = Math.sin(w);
      o.sy = 1 + 0.035 * a * s; o.sx = 1 - 0.028 * a * s;
    }
    return o;
  }
  function attackKeys(P, ranged, strike) {
    const s = Math.max(0.25, Math.min(0.8, strike));
    const D = 0.36 * P.reach;
    const style = ranged ? P.ranged : P.melee;
    if (ranged) {
      if (style === 'rear') return [REST, [s * 0.7, -0.06, -0.06, 0.92, 1.16, -10 * P.tilt, 0, 0.9, 1], [s, 0.1, 0, 1.12, 0.88, 8, 0, 1.05, 1], [1, 0, 0, 1, 1, 0, 0, 1, 1]];
      if (style === 'pulse' || style === 'hover') return [REST, [s * 0.7, 0, -0.04, 1.14, 1.12, 0, 0, 0.85, 1], [s, 0.06, 0, 0.9, 0.9, 0, 0, 1.05, 1], [1, 0, 0, 1, 1, 0, 0, 1,1, 1]];
      return [REST, [s * 0.55, -0.1, 0, 0.96, 1.08, -9 * P.tilt, 0, 1, 1], [s, 0.12, 0, 1.14, 0.86, 8, 0, 1.05, 1], [1, 0, 0, 1.02, 0.98, 0, 0, 1, 1]];
    }
    if (style === 'pounce') return [REST, [s * 0.4, -D * 0.2, 0.03, 1.14, 0.8, 0, 0, 1.1, 1], [s * 0.75, D * 0.45, -0.2, 0.94, 1.1, 12 * P.tilt, 0, 0.6, 1], [s, D, 0.02, 1.18, 0.8, 6, 0, 1.15, 1], [1, 0, 0, 1, 1, 0, 0, 1,1, 1]];
    if (style === 'slam') return [REST, [s * 0.55, -0.06, -0.1, 0.92, 1.18, -8 * P.tilt, 0, 0.8, 1], [s, D * 0.55, 0.04, 1.22, 0.76, 8, 0, 1.25, 1], [1, 0, 0, 1.02, 0.98, 0, 0, 1,1, 1]];
    if (style === 'ram') return [REST, [s * 0.65, -D * 0.35, 0.02, 1.1, 0.88, -4, 0, 1.05, 1], [s, D, 0, 1.16, 0.9, 6 * P.tilt, 0, 1, 1], [1, 0, 0, 1,1, 1, 0, 0, 1,1, 1]];
    if (style === 'peck') return [REST, [0.3, D * 0.8, 0, 1.08, 0.94, 10, 0, 1,1, 1], [0.45, D * 0.2, 0, 1,1, 1, 0, 0, 1,1, 1], [0.65, D * 0.85, 0, 1.08, 0.94, 12, 0, 1,1, 1], [1, 0, 0, 1,1, 1, 0, 0, 1,1, 1]];
    if (style === 'lash') return [REST, [s * 0.6, -D * 0.2, 0, 0.9, 1.1, 0, -0.15, 1, 1], [s, D * 1.05, 0, 1.28, 0.88, 6, 0.18, 1, 1], [1, 0, 0, 1,1, 1, 0, 0, 1,1, 1]];
    if (style === 'dive') return [REST, [s * 0.5, -D * 0.3, -0.16, 0.94, 1.08, -14 * P.tilt, 0, 0.55, 1], [s, D, 0.02, 1.12, 0.9, 18 * P.tilt, 0, 1.1, 1], [1, 0, -0.04, 1, 1, 0, 0, 0.8, 1]];
    if (style === 'bump') return [REST, [s * 0.5, -D * 0.15, -0.03, 1.14, 0.86, 0, 0, 1.05, 1], [s, D * 0.7, 0, 0.9, 1.12, 8, 0, 1,1, 1], [Math.min(0.85, s + 0.15), D * 0.4, 0, 1.12, 0.88, 0, 0, 1.1, 1], [1, 0, 0, 1,1, 1, 0, 0, 1,1, 1]];
    return [REST, [s * 0.45, -D * 0.28, 0.02, 1.12, 0.84, -4, 0, 1.08, 1], [s, D, -0.01, 0.92, 1.12, 11 * P.tilt, 0, 0.9, 1], [Math.min(0.9, s + 0.12), D * 0.55, 0.02, 1.14, 0.84, 3, 0, 1.12, 1], [1, 0, 0, 1,1, 1, 0, 0, 1,1, 1]];
  }
  function walkKeys(P) {
    const lean = 5 * P.tilt;
    switch (P.walk) {
      case 'bound': return [[0, 0, 0, 1.04, 0.96, lean * 0.4, 0, 1, 1], [0.25, 0, -0.08, 1.02, 1, lean, 0, 0.75, 1], [0.5, 0, 0, 1.06, 0.92, lean * 0.3, 0, 1.1, 1], [0.75, 0, -0.08, 1.02, 1, lean, 0, 0.75, 1], [1, 0, 0, 1.04, 0.96, 0, 0, 1,1, 1]];
      case 'waddle': return [[0, 0, 0, 1, 1, 6, 0, 1,1, 1], [0.5, 0, -0.03, 1.04, 0.96, -6, 0, 1,1, 1], [1, 0, 0, 1,1, 1, 6, 0, 1,1, 1]];
      case 'stomp': return [[0, 0, 0, 1, 1, 0, 0, 1,1, 1], [0.2, 0, -0.06, 0.98, 1.05, lean * 0.4, 0, 0.85, 1], [0.38, 0, 0.01, 1.12, 0.86, 0, 0, 1.2, 1], [0.7, 0, -0.06, 0.98, 1.04, -lean * 0.3, 0, 0.85, 1], [0.88, 0, 0.01, 1.12, 0.86, 0, 0, 1.2, 1], [1, 0, 0, 1,1, 1, 0, 0, 1,1, 1]];
      case 'glide': return [[0, 0, -0.04, 1.02, 0.98, lean, 0, 0.7, 1], [0.5, 0, -0.07, 1.03, 0.98, lean * 1.2, 0, 0.62, 1], [1, 0, -0.04, 1.02, 0.98, lean, 0, 0.7, 1]];
      case 'slither': return [[0, 0, 0, 1.06, 0.97, 0, 0.14, 1, 1], [0.5, 0, 0, 1.04, 0.98, 0, -0.14, 1, 1], [1, 0, 0, 1.06, 0.97, 0, 0.14, 1, 1]];
      case 'skitter': return [[0, 0, 0, 1, 1, lean, 0, 1,1, 1], [0.25, 0, -0.05, 1, 1, -lean, 0, 0.9, 1], [0.5, 0, 0, 1,1, 1, lean, 0, 1.1, 1], [0.75, 0, -0.05, 1,1, 1, -lean, 0, 0.9, 1], [1, 0, 0, 1,1, 1, lean, 0, 1,1, 1]];
      case 'fly': return [[0, 0, -0.1, 0.98, 1.04, lean * 1.4, 0, 0.55, 1], [0.5, 0, -0.16, 0.97, 1.06, lean * 1.6, 0, 0.45, 1], [1, 0, -0.1, 0.98, 1.04, lean * 1.4, 0, 0.55, 1]];
      case 'wiggle': return [[0, 0, 0, 1,1, 1, 6, 0.06, 1,1, 1], [0.5, 0, 0, 1,1, 1, -6, -0.06, 1,1, 1], [1, 0, 0, 1,1, 1, 6, 0.06, 1,1, 1]];
      default: return [[0, 0, 0, 1.08, 0.9, 0, 0, 1.08, 1], [0.45, 0, -0.16, 0.95, 1.08, lean * 0.4, 0, 0.7, 1], [0.78, 0, 0.01, 1.12, 0.86, 0, 0, 1.18, 1], [1, 0, 0, 1.08, 0.9, 0, 0, 1.08, 1]];
    }
  }
  function castKeys(ult) {
    const y = ult ? -0.22 : -0.14;
    return [REST, [0.22, 0, 0.03, 1.12, 0.84, 0, 0, 1.1, 1], [0.62, 0, y, 0.96, 1.16, 0, 0, 0.62, 1], [0.84, 0, y, 1.06, 1.08, ult ? 6 : 0, 0, 0.66, 1], [1, 0, 0.02, 1.1, 0.9, 0, 0, 1.05, 1]];
  }
  function hitKeys() {
    return [REST, [0.18, -0.14, 0, 0.9, 1.1, -12, 0, 1,1, 1], [0.4, -0.1, 0, 0.96, 1.04, -6, 0, 1,1, 1], [1, 0, 0, 1.04, 0.98, 0, 0, 1,1, 1]];
  }
  function deathKeys(P) {
    const style = P.faint;
    if (style === 'collapse') return [REST, [0.12, 0.04, 0, 0.94, 1.08, 0, 0, 1,1, 1], [0.55, 0.06, 0.08, 1.24, 0.5, 0, 0, 1.3, 1], [1, 0.06, 0.1, 1.34, 0.36, 0, 0, 1.35, 0.7]];
    if (style === 'deflate') return [REST, [0.15, 0, -0.08, 1.16, 1.16, 0, 0, 0.7, 1], [0.7, 0, 0.06, 0.35, 0.3, 0, 0, 0.4, 0.9], [1, 0, 0.08, 0.16, 0.14, 0, 0, 0.3, 0.45]];
    if (style === 'fall') return [REST, [0.15, 0.05, -0.06, 1, 1, -20, 0, 0.7, 1], [0.6, 0.22, 0.08, 0.9, 0.9, 200, 0, 1.1, 0.9], [1, 0.28, 0.12, 0.75, 0.75, 320, 0, 1.15, 0.55]];
    if (style === 'flip') return [REST, [0.3, 0.08, -0.28, 1, 1, 160, 0, 0.5, 1], [0.55, 0.14, 0.02, 1.12, 0.88, 180, 0, 1.2, 1], [1, 0.14, 0.02, 1,1, 1, 180, 0, 1.15, 0.6]];
    if (style === 'roll') return [REST, [0.4, 0.08, -0.1, 1,1, 1, 140, 0, 0.75, 1], [1, 0.1, -0.2, 1,1, 1, 200, 0, 0.45, 0.4]];
    return [REST, [0.12, 0.05, 0, 0.95, 1.06, -8, 0, 1,1, 1], [0.5, 0.16, 0.1, 1.04, 0.92, 70, 0, 1.2, 1], [0.7, 0.2, 0.14, 1.06, 0.88, 84, 0, 1.2, 0.95], [1, 0.2, 0.15, 1.05, 0.86, 86, 0, 1.2, 0.72]];
  }
  function poseFor(P, state, t, info) {
    info = info || {};
    if (state === 'dead') return lerpKeys(deathKeys(P), Math.min(1, t / (0.62 + 0.12 * P.mass)));
    if (state === 'hit') return lerpKeys(hitKeys(), Math.min(1, t / 0.28));
    if (state === 'cast') return lerpKeys(castKeys(!!info.ult), Math.min(0.999, (info.castDur > 0 ? t / info.castDur : t / 0.45)));
    if (state === 'attack') {
      const wind = info.wind || 0.22, rec = info.recover || 0.16;
      const strike = wind / (wind + rec);
      return lerpKeys(attackKeys(P, info.ranged, strike), Math.min(0.999, t / (wind + rec)));
    }
    if (state === 'run' || state === 'dash') {
      const cyc = (P.walk === 'skitter' ? 0.22 : 0.36) * Math.max(0.7, P.mass);
      const o = lerpKeys(walkKeys(P), (t % cyc) / cyc);
      if (state === 'dash') { o.sx *= 1.18; o.sy *= 0.9; o.sh *= 0.65; }
      return o;
    }
    return idlePose(P, (info.age || 0) + (info.phase || 0));
  }

  // ---- particles --------------------------------------------------------------------
  const PMAX = 400;
  const pool = [];
  for (let i = 0; i < PMAX; i++) pool.push({ on: 0 });
  let pCursor = 0;
  let pCap = PMAX;

  function spawn(o) {
    let slot = -1;
    for (let k = 0; k < pCap; k++) {
      const i = (pCursor + k) % pCap;
      if (!pool[i].on) { slot = i; break; }
    }
    if (slot < 0) slot = pCursor % pCap;
    pCursor = (slot + 1) % pCap;
    const p = pool[slot];
    p.on = 1; p.t = 0; p.life = o.life || 0.4; p.k = o.k || 'dot';
    p.x = o.x; p.y = o.y; p.vx = o.vx || 0; p.vy = o.vy || 0;
    p.g = o.g || 0; p.drag = o.drag == null ? 2.2 : o.drag;
    p.r = o.r || 3; p.c = o.c || '#fff'; p.c2 = o.c2 || '#fff';
    p.rot = o.rot || 0; p.vr = o.vr || 0; p.ground = !!o.ground;
    p.x2 = o.x2; p.y2 = o.y2; p.ang = o.ang || 0;
    return p;
  }
  function clearFx() {
    for (let i = 0; i < PMAX; i++) pool[i].on = 0;
    pCursor = 0;
  }
  function burst(x, y, el, power, crit) {
    const c = pal(el), n = Math.round((crit ? 16 : 9) * (power || 1) * (pCap < 200 ? 0.55 : 1));
    spawn({ k: 'ring', x, y, r: crit ? 18 : 10, c: c[0], c2: c[1], life: crit ? 0.32 : 0.22, ground: 1 });
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.2832, v = (crit ? 90 : 60) * (0.4 + Math.random());
      const spark = el === 'volt' || el === 'metal' || el === 'frost' || crit;
      spawn({
        k: spark ? 'spark' : (el === 'bloom' ? 'leaf' : el === 'stone' || el === 'frost' ? 'shard' : 'dot'),
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (el === 'ember' ? 40 : 10),
        g: el === 'stone' ? 280 : el === 'tide' ? 160 : 40, r: 2 + Math.random() * 2,
        c: c[i % c.length], life: 0.25 + Math.random() * 0.35, rot: Math.random() * 6, vr: Math.random() * 8 - 4,
      });
    }
    if (crit) spawn({ k: 'star', x, y, r: 10, c: '#fff3b0', life: 0.28 });
  }
  function stepPool(dt) {
    if (dt <= 0) return;
    for (let i = 0; i < pCap; i++) {
      const p = pool[i];
      if (!p.on) continue;
      p.t += dt;
      if (p.t >= p.life) { p.on = 0; continue; }
      if (p.vx || p.vy || p.g) {
        const d = Math.exp(-(p.drag || 0) * dt);
        p.vx *= d; p.vy = p.vy * d + (p.g || 0) * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.rot += (p.vr || 0) * dt;
      }
    }
  }

  // ---- view state -------------------------------------------------------------------
  const vis = new Map();
  const trails = new Map();
  const ghosts = [];
  const numbers = [];
  let banner = null;
  let shakes = 0, shakeT = 0;
  let intro = 0, introOn = false;
  let focusId = 0, focusTargetId = 0;
  let cam = { x: AW / 2, y: AH / 2, z: 0.8 };
  let cv = null, ctx = null, board = null, dpr = 1, cssW = 1, cssH = 1;
  let biome = 'verdant', bgUrl = '', artUrl = null, onHold = null;
  let tier = 'full', autoDropped = false;
  let fpsWindow = [], tierLocked = '';
  let lastWall = 0;
  let resizeObs = null;
  let bound = false;
  const pending = [];

  function tierCap() { return tier === 'lite' ? 160 : PMAX; }

  function decideTier(opt) {
    if (tierLocked === 'full' || tierLocked === 'lite') { tier = tierLocked; pCap = tierCap(); return; }
    if (opt && (opt.tier === 'full' || opt.tier === 'lite')) { tier = opt.tier; pCap = tierCap(); return; }
    let lite = false;
    try {
      const meta = root.GLIM && GLIM.meta;
      if (meta && (meta.autoClassic || meta.anim === 0)) lite = true;
    } catch (e) { /* no game */ }
    try {
      const cores = navigator.hardwareConcurrency || 8;
      const narrow = root.matchMedia && matchMedia('(max-width: 560px)').matches;
      if (narrow && cores <= 4) lite = true;
    } catch (e) { /* no window */ }
    if (autoDropped) lite = true;
    tier = lite ? 'lite' : 'full';
    pCap = tierCap();
  }

  function noteFrame(ms) {
    if (tierLocked || tier !== 'full') return;
    fpsWindow.push(ms);
    if (fpsWindow.length < 45) return;
    let sum = 0;
    for (let i = 0; i < fpsWindow.length; i++) sum += fpsWindow[i];
    const avg = sum / fpsWindow.length;
    fpsWindow.length = 0;
    if (avg > 34) {
      autoDropped = true;
      tier = 'lite';
      pCap = tierCap();
      try {
        if (root.GLIM && GLIM.meta && !GLIM.meta.autoClassic && GLIM.meta.anim !== 0 && !GLIM.meta.fpsOptOut && GLIM.setAutoClassic) GLIM.setAutoClassic(true);
      } catch (e) { /* settings UI owns the toast */ }
    }
  }

  function resetVis() {
    vis.clear(); trails.clear(); ghosts.length = 0; numbers.length = 0;
    banner = null; shakes = 0; pending.length = 0; clearFx(); focusId = 0;
    intro = (typeof navigator !== 'undefined' && navigator.webdriver) ? 0.36 : 1.26;
    introOn = true;
  }

  function push(ev) {
    if (!ev) return;
    for (let i = 0; i < ev.length; i++) {
      const e = ev[i];
      pending.push(e);
      if (e.k === 'dmg' && e.crit) { shakes = Math.max(shakes, 5); if (onHold) onHold(0.07); }
      if ((e.k === 'cast_start' || e.k === 'cast') && e.ult) {
        shakes = Math.max(shakes, 8);
        if (e.k === 'cast_start' && onHold) onHold(0.1);
        banner = { text: (e.n || 'ULT').toUpperCase(), el: e.el || 'mystic', ult: 1, t: 0, life: 1.15 };
      }
      if (e.k === 'dash') ghosts.push({ id: e.u, x: e.x, y: e.y, t: 0 });
    }
  }

  function resolvePending(view) {
    const by = new Map();
    for (let i = 0; i < view.units.length; i++) by.set(view.units[i].id, view.units[i]);
    for (let i = 0; i < pending.length; i++) {
      const e = pending[i];
      const t = e.t != null ? by.get(e.t) : e.u != null ? by.get(e.u) : e.a != null ? by.get(e.a) : null;
      if (e.k === 'dmg' && t) {
        const el = e.dot === 'burn' ? 'ember' : e.dot === 'poison' ? 'shade' : e.dot === 'bleed' ? 'blood' : (e.el || (t && t.el) || 'mystic');
        if (!e.dot || e.crit) burst(t.x, t.y, el, e.crit ? 1.4 : e.dot ? 0.4 : 1, !!e.crit);
        const label = e.crit ? String(e.v) + '!' : String(e.v);
        if (!e.dot || e.v >= 2) numbers.push({ x: t.x, y: t.y, oy: 0, text: label, life: 0.7, t: 0, crit: !!e.crit, kind: e.dot ? 'dot' : 'dmg' });
        const v = vis.get(t.id);
        if (v) v.flash = e.crit ? 1 : 0.75;
      } else if (e.k === 'heal' && t && !e.quiet && e.v > 0) {
        numbers.push({ x: t.x, y: t.y, oy: 0, text: '+' + e.v, life: 0.7, t: 0, kind: 'heal' });
        for (let n = 0; n < (tier === 'lite' ? 3 : 6); n++) spawn({ k: 'plus', x: t.x + (Math.random() - 0.5) * 20, y: t.y, vy: -36 - Math.random() * 30, c: pal('heal')[n % 3], r: 4, life: 0.55 });
      } else if (e.k === 'shield' && t) {
        numbers.push({ x: t.x, y: t.y, oy: -8, text: '+' + e.v, life: 0.6, t: 0, kind: 'shield' });
        spawn({ k: 'dome', x: t.x, y: t.y, r: (t.r || 26) + 8, c: '#7fd0ff', life: 0.5 });
      } else if (e.k === 'miss' && t) {
        numbers.push({ x: t.x, y: t.y, oy: 0, text: e.dodge ? 'DODGE' : 'MISS', life: 0.55, t: 0, kind: 'miss' });
      } else if (e.k === 'ko' && t) {
        burst(t.x, t.y, t.el || 'mystic', 1.3, false);
        for (let n = 0; n < 5; n++) spawn({ k: 'puff', x: t.x, y: t.y, vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 40, c: pal(t.el)[1], r: 5, life: 0.6 });
      } else if (e.k === 'attack_hit') {
        const a = by.get(e.a), d = by.get(e.t);
        if (a && d) {
          const ang = Math.atan2(d.y - a.y, d.x - a.x);
          spawn({ k: 'slash', x: d.x, y: d.y, ang, r: 16, c: hex(e.el || a.el), c2: '#fff', life: 0.18 });
        }
        const vv = vis.get(e.a);
        if (vv) vv.hitMark = 0.08;
      } else if (e.k === 'cast_start') {
        const a = by.get(e.a);
        if (a) {
          spawn({ k: 'ring', x: a.x, y: a.y + 8, r: e.ult ? 34 : 22, c: hex(e.el), c2: '#fff', life: Math.min(0.8, e.cast || 0.45), ground: 1 });
          if (tier === 'full') for (let n = 0; n < 8; n++) {
            const ang = n / 8 * 6.2832;
            spawn({ k: 'dot', x: a.x + Math.cos(ang) * 28, y: a.y + Math.sin(ang) * 16, vx: -Math.cos(ang) * 40, vy: -Math.sin(ang) * 24, c: pal(e.el)[n % 3], r: 2, life: 0.4, ground: 1 });
          }
        }
      } else if (e.k === 'knock' && t) {
        const v = vis.get(t.id) || {};
        v.lean = Math.max(-1, Math.min(1, (e.vx || 0) / 400));
        vis.set(t.id, v);
      } else if (e.k === 'react' && t) {
        numbers.push({ x: t.x, y: t.y, oy: -10, text: String(e.name || '').toUpperCase().slice(0, 12), life: 0.8, t: 0, kind: 'react' });
      }
    }
    pending.length = 0;
  }

  // ---- camera / project -------------------------------------------------------------
  function project(x, y) {
    return {
      x: cssW * 0.5 + (x - cam.x) * cam.z,
      y: cssH * 0.58 + (y - cam.y) * cam.z * OBL,
    };
  }
  function unproject(sx, sy) {
    return {
      x: cam.x + (sx - cssW * 0.5) / cam.z,
      y: cam.y + (sy - cssH * 0.58) / (cam.z * OBL),
    };
  }
  function aimCamera(units, dt) {
    let minX = AW, maxX = 0, minY = AH, maxY = 0, n = 0;
    let sx = 0, sy = 0;
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      if (!u.alive && u.state === 'dead') continue;
      if (u.x < minX) minX = u.x; if (u.x > maxX) maxX = u.x;
      if (u.y < minY) minY = u.y; if (u.y > maxY) maxY = u.y;
      sx += u.x; sy += u.y; n++;
    }
    if (!n) { minX = 80; maxX = AW - 80; minY = 70; maxY = AH - 70; sx = AW / 2; sy = AH / 2; n = 1; }
    const pad = 150;
    const needW = Math.max(220, maxX - minX + pad * 2);
    const needH = Math.max(160, maxY - minY + pad * 2);
    let z = Math.min(cssW / needW, cssH / (needH * OBL));
    const phone = cssW < 520;
    const minZ = phone ? 0.62 : 0.48;
    const maxZ = phone ? 1.05 : 1.35;
    if (z < minZ) z = minZ;
    if (z > maxZ) z = maxZ;
    const tx = n ? sx / n : (minX + maxX) / 2;
    const ty = n ? sy / n : (minY + maxY) / 2;
    const k = 1 - Math.exp(-dt * 4.5);
    cam.x += (tx - cam.x) * k;
    cam.y += (ty - cam.y) * k;
    cam.z += (z - cam.z) * k;
  }

  // ---- draw pieces ------------------------------------------------------------------
  function arenaPoly(g) {
    const corners = [[10, 10], [AW - 10, 10], [AW - 10, AH - 10], [10, AH - 10]];
    g.beginPath();
    for (let i = 0; i < 4; i++) {
      const p = project(corners[i][0], corners[i][1]);
      if (i) g.lineTo(p.x, p.y); else g.moveTo(p.x, p.y);
    }
    g.closePath();
  }
  function drawBackdrop(g) {
    const bgRec = bgUrl && images.get(bgUrl);
    g.imageSmoothingEnabled = true;
    g.fillStyle = BIOME[biome] || '#100c18';
    g.fillRect(0, 0, cssW, cssH);
    if (bgRec && bgRec.img) {
      g.save();
      g.globalAlpha = 0.55;
      const iw = bgRec.img.naturalWidth || 1280, ih = bgRec.img.naturalHeight || 720;
      const s = Math.max(cssW / iw, cssH / ih);
      const dw = iw * s, dh = ih * s;
      g.drawImage(bgRec.img, (cssW - dw) / 2, (cssH - dh) / 2, dw, dh);
      g.restore();
    }
    g.fillStyle = 'rgba(6,4,14,.5)';
    g.fillRect(0, 0, cssW, cssH);
  }
  function drawTiles(g) {
    g.imageSmoothingEnabled = false;
    g.save();
    arenaPoly(g);
    g.clip();
    g.translate(cssW * 0.5, cssH * 0.58);
    g.scale(cam.z, cam.z * OBL);
    g.translate(-cam.x, -cam.y);
    g.fillStyle = floorPattern(g);
    g.globalAlpha = 0.9;
    g.fillRect(-40, -40, AW + 80, AH + 80);
    g.restore();
    arenaPoly(g);
    g.lineWidth = 2;
    g.strokeStyle = 'rgba(255,244,220,.32)';
    g.stroke();
    g.globalAlpha = 1;
  }

  function drawTelegraph(g, tel) {
    const dur = tel.dur || 0.01;
    const prog = Math.max(0, Math.min(1, 1 - (tel.left || 0) / dur));
    const c = hex(tel.el);
    g.save();
    g.translate(cssW * 0.5, cssH * 0.58);
    g.scale(cam.z, cam.z * OBL);
    g.translate(-cam.x, -cam.y);
    g.lineWidth = 3 / Math.max(0.4, cam.z);
    g.strokeStyle = c;
    g.fillStyle = c;
    if (tel.shape === 'line') {
      const x = tel.x, y = tel.y, x2 = tel.x2, y2 = tel.y2;
      const ang = Math.atan2(y2 - y, x2 - x), len = Math.hypot(x2 - x, y2 - y) || 1;
      g.translate(x, y); g.rotate(ang);
      g.globalAlpha = 0.28;
      g.fillRect(0, -10, len, 20);
      g.globalAlpha = 0.55;
      g.fillRect(0, -10, len * prog, 20);
      g.globalAlpha = 0.9;
      g.strokeRect(0, -10, len, 20);
    } else if (tel.shape === 'cone') {
      const a0 = (tel.ang || 0) - (tel.arc || 1) / 2;
      const a1 = (tel.ang || 0) + (tel.arc || 1) / 2;
      const r = tel.r || 80;
      g.globalAlpha = 0.22;
      g.beginPath(); g.moveTo(tel.x, tel.y); g.arc(tel.x, tel.y, r, a0, a1); g.closePath(); g.fill();
      g.globalAlpha = 0.5;
      g.beginPath(); g.moveTo(tel.x, tel.y); g.arc(tel.x, tel.y, r * prog, a0, a1); g.closePath(); g.fill();
      g.globalAlpha = 0.95;
      g.beginPath(); g.moveTo(tel.x, tel.y); g.arc(tel.x, tel.y, r, a0, a1); g.closePath(); g.stroke();
    } else if (tel.shape === 'ring') {
      const r = tel.r || 70;
      g.globalAlpha = 0.2 + 0.35 * prog;
      g.beginPath(); g.arc(tel.x, tel.y, r, 0, 6.2832); g.arc(tel.x, tel.y, r * 0.62, 0, 6.2832, true); g.fill();
      g.globalAlpha = 0.9;
      g.beginPath(); g.arc(tel.x, tel.y, r, 0, 6.2832); g.stroke();
    } else {
      const r = tel.r || 48;
      g.globalAlpha = 0.16;
      g.beginPath(); g.arc(tel.x, tel.y, r, 0, 6.2832); g.fill();
      g.globalAlpha = 0.45;
      g.beginPath(); g.moveTo(tel.x, tel.y); g.arc(tel.x, tel.y, r, -1.5708, -1.5708 + prog * 6.2832); g.closePath(); g.fill();
      g.globalAlpha = 0.95;
      g.beginPath(); g.arc(tel.x, tel.y, r, 0, 6.2832); g.stroke();
    }
    g.restore();
  }

  function drawParticle(g, p) {
    const q = project(p.x, p.y);
    const f = p.t / p.life;
    const a = 1 - f;
    const x = Math.round(q.x), y = Math.round(q.y);
    g.globalAlpha = Math.max(0, a);
    if (p.k === 'dot') {
      g.fillStyle = p.c;
      const r = Math.max(1, Math.round(p.r * (1 - f * 0.4)));
      g.fillRect(x - r, y - r, r * 2, r * 2);
    } else if (p.k === 'spark') {
      g.strokeStyle = p.c;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(Math.round(x - p.vx * 0.03), Math.round(y - p.vy * 0.03));
      g.stroke();
    } else if (p.k === 'shard' || p.k === 'leaf') {
      g.save();
      g.translate(x, y); g.rotate(p.rot);
      g.fillStyle = p.c;
      if (p.k === 'leaf') g.fillRect(-3, -1, 6, 3);
      else { g.beginPath(); g.moveTo(4, 0); g.lineTo(-2, 3); g.lineTo(-3, -2); g.fill(); }
      g.restore();
    } else if (p.k === 'plus') {
      g.fillStyle = p.c;
      g.fillRect(x - 3, y - 1, 7, 3);
      g.fillRect(x - 1, y - 3, 3, 7);
    } else if (p.k === 'star') {
      g.fillStyle = p.c;
      g.fillRect(x - 1, y - Math.round(p.r), 2, Math.round(p.r) * 2);
      g.fillRect(x - Math.round(p.r), y - 1, Math.round(p.r) * 2, 2);
    } else if (p.k === 'ring') {
      const r = (p.r || 12) * (0.4 + f);
      g.strokeStyle = p.c;
      g.lineWidth = 2;
      g.beginPath(); g.ellipse(x, y, r, r * OBL, 0, 0, 6.2832); g.stroke();
    } else if (p.k === 'slash') {
      g.strokeStyle = p.c2;
      g.lineWidth = 3;
      g.beginPath();
      const R = (p.r || 14) * (0.7 + f);
      for (let i = 0; i <= 5; i++) {
        const ang = p.ang - 0.9 + i / 5 * 1.8;
        const px = x + Math.cos(ang) * R, py = y + Math.sin(ang) * R * OBL;
        if (i) g.lineTo(px, py); else g.moveTo(px, py);
      }
      g.stroke();
      g.strokeStyle = p.c;
      g.lineWidth = 1;
      g.stroke();
    } else if (p.k === 'dome') {
      g.strokeStyle = p.c;
      g.lineWidth = 2;
      g.beginPath(); g.arc(x, y - 6, (p.r || 20) * (0.85 + f * 0.2), Math.PI, 0); g.stroke();
    } else if (p.k === 'puff') {
      g.fillStyle = p.c;
      const r = Math.max(1, Math.round((p.r || 4) * (1 + f)));
      g.globalAlpha = a * 0.7;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    g.globalAlpha = 1;
  }

  function drawProj(g, p, now) {
    const q = project(p.x, p.y);
    let tr = trails.get(p.id);
    if (!tr) { tr = []; trails.set(p.id, tr); }
    tr.push(q.x, q.y);
    if (tr.length > 12) tr.splice(0, tr.length - 12);
    const c = pal(p.el);
    g.imageSmoothingEnabled = false;
    for (let i = 0; i < tr.length; i += 2) {
      const k = i / (tr.length || 1);
      const s = 1 + ((i / 2) % 2);
      g.globalAlpha = k * 0.55;
      g.fillStyle = c[0];
      g.fillRect(Math.round(tr[i]) - s, Math.round(tr[i + 1]) - s, s * 2, s * 2);
    }
    g.globalAlpha = 1;
    const x = Math.round(q.x), y = Math.round(q.y);
    const spin = now * (p.el === 'gale' ? 14 : 8) + p.id;
    g.save();
    g.translate(x, y);
    const ang = Math.atan2(p.vy || 0, p.vx || 1);
    g.rotate(p.el === 'stone' || p.el === 'gale' ? spin : ang);
    g.fillStyle = c[1];
    if (p.el === 'volt') {
      g.strokeStyle = '#fff'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(-8, 0); g.lineTo(-2, -3); g.lineTo(1, 2); g.lineTo(8, -1); g.stroke();
      g.strokeStyle = c[0]; g.lineWidth = 1; g.stroke();
    } else if (p.el === 'frost' || p.el === 'metal') {
      g.fillStyle = c[0];
      g.beginPath(); g.moveTo(8, 0); g.lineTo(-4, 3); g.lineTo(-2, 0); g.lineTo(-4, -3); g.fill();
      g.fillStyle = '#fff'; g.fillRect(0, -1, 3, 2);
    } else if (p.el === 'stone') {
      g.fillStyle = c[0];
      g.beginPath();
      for (let i = 0; i < 6; i++) { const a = i / 6 * 6.2832, rr = i % 2 ? 4 : 6; const px = Math.cos(a) * rr, py = Math.sin(a) * rr; if (i) g.lineTo(px, py); else g.moveTo(px, py); }
      g.closePath(); g.fill();
    } else if (p.el === 'bloom') {
      g.fillStyle = c[0]; g.fillRect(-4, -2, 8, 4); g.fillStyle = c[1]; g.fillRect(-1, -3, 2, 6);
    } else if (p.el === 'gale') {
      g.strokeStyle = c[1]; g.lineWidth = 2;
      g.beginPath(); g.arc(0, 0, 5, spin, spin + 4); g.stroke();
    } else {
      g.fillStyle = c[0]; g.fillRect(-4, -4, 8, 8); g.fillStyle = '#fff'; g.fillRect(-2, -2, 3, 3);
      if (p.friendly) { g.strokeStyle = '#d6ffb8'; g.strokeRect(-5, -5, 10, 10); }
    }
    g.restore();
    if (tier === 'full' && (p.id + Math.floor(now * 20)) % 2 === 0) {
      spawn({ k: 'dot', x: p.x, y: p.y, vx: -(p.vx || 0) * 0.05, vy: -(p.vy || 0) * 0.05, c: c[2] || c[0], r: 2, life: 0.18, drag: 4 });
    }
  }

  function drawBars(g, u, x, y, top) {
    const w = u.boss ? 48 : 36;
    const h = 3;
    const bx = Math.round(x - w / 2), by = Math.round(top);
    const hpF = u.maxHp ? Math.max(0, Math.min(1, u.hp / u.maxHp)) : 0;
    g.fillStyle = '#140c14';
    g.fillRect(bx - 1, by - 1, w + 2, h + 2);
    g.fillStyle = !u.alive ? '#444' : hpF > 0.5 ? (u.side === 0 ? '#3dde7a' : '#ff5d6c') : hpF > 0.28 ? '#ffd23f' : '#ff5468';
    g.fillRect(bx, by, Math.round(w * hpF), h);
    if (u.shield > 0 && u.maxHp) {
      const sw = Math.round(w * Math.min(1, u.shield / u.maxHp));
      const sx = bx + Math.max(0, Math.round(w * hpF) - sw);
      g.fillStyle = '#d8f3ff';
      g.fillRect(sx, by, sw, h);
    }
    const need = u.manaNeed || 100;
    const mf = Math.max(0, Math.min(1, (u.mana || 0) / need));
    g.fillStyle = '#140c14';
    g.fillRect(bx - 1, by + h + 1, w + 2, 3);
    g.fillStyle = '#3fe0ff';
    g.fillRect(bx, by + h + 2, Math.round(w * mf), 1);
    if (u.star) {
      g.fillStyle = u.boss ? '#fff6d0' : '#ffd65a';
      const n = Math.min(4, u.star || 0);
      for (let i = 0; i < n; i++) g.fillRect(Math.round(x - (n * 3) / 2 + i * 3), by - 4, 2, 2);
    }
  }

  function drawStatus(g, list, x, y) {
    if (!iconSheet || !list || !list.length) return;
    bakeIcons();
    const show = list.slice(0, 3);
    const sz = 16;
    const gap = 1;
    const total = show.length * sz + (show.length - 1) * gap;
    let sx = Math.round(x - total / 2);
    g.imageSmoothingEnabled = false;
    for (let i = 0; i < show.length; i++) {
      const idx = iconIndex(show[i]);
      if (idx < 0) continue;
      g.drawImage(iconSheet, idx * 16, 0, 16, 16, sx, Math.round(y), sz, sz);
      sx += sz + gap;
    }
  }

  function drawSprite(g, img, sw, sh, sx, sy, dw, dh, feet, face, flip, pose, flash, shiny, srcX, srcY) {
    srcX = srcX || 0; srcY = srcY || 0;
    g.imageSmoothingEnabled = false;
    g.save();
    g.translate(Math.round(sx), Math.round(sy));
    // Pose offsets follow facing. The bitmap flips separately: atlases face right,
    // boss paintings face left (same convention as the chess sprites).
    g.translate((pose.x || 0) * dh * face, (pose.y || 0) * dh);
    g.rotate((pose.r || 0) * face * Math.PI / 180);
    const sk = Math.max(-0.6, Math.min(0.6, (pose.sk || 0) * face));
    g.transform(pose.sx || 1, 0, sk, pose.sy || 1, 0, 0);
    g.scale(flip ? -1 : 1, 1);
    const dx = -dw * feet[0], dy = -dh * feet[1];
    if (shiny && tier === 'full') g.filter = 'hue-rotate(150deg) saturate(1.35)';
    g.drawImage(img, srcX, srcY, sw, sh, dx, dy, dw, dh);
    g.filter = 'none';
    if (flash > 0.04) {
      const sg = ensureScratch(Math.ceil(dw) + 2, Math.ceil(dh) + 2);
      sg.setTransform(1, 0, 0, 1, 0, 0);
      sg.clearRect(0, 0, sg.canvas.width, sg.canvas.height);
      sg.imageSmoothingEnabled = false;
      sg.drawImage(img, srcX, srcY, sw, sh, 1, 1, dw, dh);
      sg.globalCompositeOperation = 'source-atop';
      sg.fillStyle = 'rgba(255,255,255,' + Math.min(0.85, flash) + ')';
      sg.fillRect(0, 0, sg.canvas.width, sg.canvas.height);
      sg.globalCompositeOperation = 'source-over';
      g.drawImage(sg.canvas, dx - 1, dy - 1);
    }
    g.restore();
  }

  function drawGhost(g, gh) {
    const q = project(gh.x, gh.y);
    const rec = gh.art && arts.get(gh.art);
    const b = rec && rec.baked;
    const atlas = gh.art && atlases.get(gh.art);
    g.globalAlpha = (1 - gh.t / 0.18) * 0.4;
    g.imageSmoothingEnabled = false;
    if (atlas && atlas.img) {
      const clip = clipOf(atlas, 'run') || clipOf(atlas, 'idle');
      const fr = clip && clip.frames && clip.frames[0];
      if (fr) {
        const dh = Math.max(28, (gh.r || 26) * 2.2 * cam.z);
        const dw = dh * (fr.w / fr.h);
        const face = (gh.facing || 1) < 0 ? -1 : 1;
        g.save();
        g.translate(Math.round(q.x), Math.round(q.y));
        g.scale(face < 0 ? -1 : 1, 1);
        g.drawImage(atlas.img, fr.x, fr.y, fr.w, fr.h, -dw * (atlas.feet ? atlas.feet[0] : 0.5), -dh * (atlas.feet ? atlas.feet[1] : 0.92), dw, dh);
        g.restore();
        g.globalAlpha = 1;
        return;
      }
    }
    if (b) {
      const dh = Math.max(28, (gh.r || 26) * 2.2 * cam.z) * (b.h / 48);
      const dw = dh * (b.w / b.h);
      const face = (gh.facing || 1) < 0 ? -1 : 1;
      const flip = gh.boss ? face > 0 : face < 0;
      g.save();
      g.translate(Math.round(q.x), Math.round(q.y));
      g.scale(flip ? -1 : 1, 1);
      g.drawImage(b.canvas, -dw * b.feet[0], -dh * b.feet[1], dw, dh);
      g.restore();
    } else {
      g.fillStyle = hex(gh.el || 'mystic');
      g.fillRect(Math.round(q.x - 8), Math.round(q.y - 22), 16, 18);
    }
    g.globalAlpha = 1;
  }

  function unitPose(u, extra, motionDt) {
    let v = vis.get(u.id);
    if (!v) {
      v = { state: u.state, t: 0, age: (u.id * 1.37) % 3, flash: 0, lean: 0, hitMark: 0 };
      vis.set(u.id, v);
    }
    if (v.state !== u.state) { v.state = u.state; v.t = 0; }
    const clock = extra && u.state === 'attack' && extra.atkT != null ? extra.atkT
      : extra && u.state === 'cast' && extra.castT != null ? extra.castT : null;
    if (clock != null) v.t = clock;
    else v.t += motionDt;
    v.age += motionDt > 0 ? motionDt : 0;
    if (v.flash > 0) v.flash = Math.max(0, v.flash - (motionDt > 0 ? motionDt : 0.016) * 6);
    if (v.lean) v.lean *= Math.exp(-6 * Math.max(0.016, motionDt || 0.016));
    return v;
  }

  function drawUnit(g, u, extra, motionDt) {
    const v = unitPose(u, extra, motionDt);
    const P = archOf(extra && extra.sp, extra && extra.role, u.boss);
    const ranged = extra && extra.range > 1;
    const pose = poseFor(P, u.state === 'dead' ? 'dead' : (u.state || 'idle'), v.t, {
      wind: extra && extra.wind, recover: extra && extra.recover, ranged,
      castDur: extra && extra.castDur, ult: extra && extra.ult, age: v.age, phase: u.id,
    });
    if (v.lean) pose.r += v.lean * 14;
    const artKey = artKeyOf(u, extra);
    const atlas = atlases.get(artKey) || atlases.get(extra && extra.sp);
    const useAtlas = !!(atlas && atlas.img);
    const feet = project(u.x, u.y);
    const h = Math.max(30, (useAtlas ? (atlas.radius || u.r || 26) : (u.r || 26)) * 2.35 * cam.z);
    let img, sw, sh, dw, dh, feetN, srcX = 0, srcY = 0;
    if (useAtlas) {
      const clipName = u.state === 'dead' ? 'death' : u.state === 'dash' ? 'run' : (u.state || 'idle');
      const clip = clipOf(atlas, clipName) || clipOf(atlas, 'idle');
      if (!clip || !clip.frames || !clip.frames.length) { img = null; sw = sh = dw = dh = 0; feetN = [0.5, 0.92]; }
      else {
      const hitAt = clipName === 'attack' ? (extra && extra.wind) || 0.22 : clipName === 'cast' ? (extra && extra.castDur) || 0.45 : 0;
      const idx = frameIndex(atlas, clipName, v.t, hitAt);
      const fr = clip.frames[idx];
      img = atlas.img; sw = fr.w; sh = fr.h; srcX = fr.x; srcY = fr.y;
      dh = h; dw = h * (fr.w / fr.h);
      feetN = atlas.feet || [0.5, 0.92];
      // Atlas frames already contain the action. Keep a whisper of squash so hits still read.
      if (u.state === 'attack' || u.state === 'run' || u.state === 'cast' || u.state === 'dead') {
        pose.x = 0; pose.y = 0; pose.r = 0; pose.sk = 0;
        if (u.state !== 'dead') { pose.sx = 1; pose.sy = 1; }
      }
      }
    } else {
      const baked = artKey && arts.get(artKey);
      const b = baked && baked.baked;
      if (!b) {
        // Deliberate stand-in while the painting loads: a small pixel body, not a labelled circle.
        const q = feet;
        g.fillStyle = 'rgba(0,0,0,.35)';
        g.beginPath(); g.ellipse(q.x, q.y, 14, 5, 0, 0, 6.28); g.fill();
        g.fillStyle = hex(u.el);
        g.fillRect(Math.round(q.x - 8), Math.round(q.y - 26), 16, 18);
        g.fillStyle = '#fff';
        g.fillRect(Math.round(q.x - 4), Math.round(q.y - 20), 2, 2);
        g.fillRect(Math.round(q.x + 2), Math.round(q.y - 20), 2, 2);
        drawBars(g, u, q.x, q.y, q.y - 34);
        return;
      }
      img = b.canvas; sw = b.w; sh = b.h;
      dh = h * (b.h / 48); dw = dh * (b.w / b.h);
      feetN = b.feet;
    }
    if (!img) return;
    const shx = feet.x, shy = feet.y;
    if (shadowBlob && pose.a > 0.2) {
      const sc = (0.55 + 0.5 * (P.shadow || 1)) * (pose.sh || 1) * (1 + Math.min(0, pose.y || 0));
      const swid = dw * 0.7 * Math.max(0.35, sc);
      g.globalAlpha = 0.85 * Math.min(1, pose.a + 0.2);
      g.drawImage(shadowBlob, Math.round(shx - swid / 2), Math.round(shy - swid * 0.18), Math.round(swid), Math.round(swid * 0.42));
      g.globalAlpha = 1;
    }
    g.save();
    g.globalAlpha = Math.max(0, Math.min(1, pose.a == null ? 1 : pose.a));
    if (!u.alive) g.globalAlpha *= 0.95;
    const face = (u.facing || 1) < 0 ? -1 : 1;
    const flip = useAtlas ? face < 0 : (u.boss ? face > 0 : face < 0);
    drawSprite(g, img, sw, sh, shx, shy, dw, dh, feetN, face, flip, pose, v.flash || 0, extra && extra.shiny, srcX, srcY);
    g.restore();
    if (extra && extra.stun) {
      const bob = Math.sin(v.age * 6);
      g.fillStyle = '#ffd21f';
      for (let i = 0; i < 3; i++) {
        const ang = v.age * 3 + i * 2.1;
        g.fillRect(Math.round(shx + Math.cos(ang) * 12 - 1), Math.round(shy - dh * 0.82 + Math.sin(ang) * 3 + bob), 3, 3);
      }
    }
    if (focusId && (u.id === focusId || u.id === focusTargetId)) {
      g.strokeStyle = u.id === focusId ? '#ffe7a3' : 'rgba(255,231,163,.75)';
      g.lineWidth = u.id === focusId ? 2 : 1;
      g.beginPath();
      g.ellipse(shx, shy + 2, dw * 0.38, 6, 0, 0, 6.2832);
      g.stroke();
    }
    const top = shy - dh * (feetN[1] || 0.9) - 8;
    if (extra && extra.statuses && extra.statuses.length) drawStatus(g, extra.statuses, shx, top - 18);
    drawBars(g, u, shx, shy, extra && extra.statuses && extra.statuses.length ? top : top);
  }

  function drawNumber(g, n) {
    const q = project(n.x, n.y);
    const f = n.t / n.life;
    const pop = f < 0.12 ? 0.6 + f / 0.12 * 0.7 : 1.15 - (f - 0.12) * 0.2;
    const scale = (n.crit ? 3 : n.kind === 'react' ? 2 : 2) * Math.max(0.8, pop);
    const col = n.kind === 'heal' ? '#6bff8f' : n.kind === 'shield' ? '#d8f3ff' : n.kind === 'miss' ? '#ddd' : n.crit ? '#ffe34d' : n.kind === 'dot' ? '#ffb38a' : '#fff';
    g.globalAlpha = f > 0.65 ? Math.max(0, 1 - (f - 0.65) / 0.35) : 1;
    drawText(g, n.text, q.x, q.y - 28 - n.oy, scale, col, 'center');
    g.globalAlpha = 1;
  }

  function drawVignette(g) {
    const key = cssW + 'x' + cssH;
    if (vignetteKey !== key) {
      vignetteKey = key;
      vignette = g.createRadialGradient(cssW / 2, cssH * 0.55, Math.min(cssW, cssH) * 0.2, cssW / 2, cssH * 0.5, Math.max(cssW, cssH) * 0.72);
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, 'rgba(0,0,0,.58)');
    }
    g.fillStyle = vignette;
    g.fillRect(0, 0, cssW, cssH);
  }

  function drawHud(g, view) {
    drawVignette(g);
    const clock = view && view.t ? view.t : 0;
    const sec = Math.floor(clock);
    const label = Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
    drawText(g, label, cssW / 2, 8, 2, '#fff6e8', 'center');
    if (banner) {
      const f = banner.t / banner.life;
      const a = f < 0.12 ? f / 0.12 : f > 0.75 ? Math.max(0, 1 - (f - 0.75) / 0.25) : 1;
      g.globalAlpha = a;
      const tw = textWidth(banner.text, 3);
      const bw = tw + 28, bh = 28;
      const bx = Math.round(cssW / 2 - bw / 2), by = Math.round(cssH * 0.2);
      g.fillStyle = 'rgba(8,4,16,.82)';
      g.fillRect(bx, by, bw, bh);
      g.fillStyle = hex(banner.el);
      g.fillRect(bx, by, bw, 2);
      g.fillRect(bx, by + bh - 2, bw, 2);
      if (banner.ult) drawText(g, 'ULT', cssW / 2, by - 12, 1, hex(banner.el), 'center');
      drawText(g, banner.text, cssW / 2, by + 7, 3, '#fff', 'center');
      g.globalAlpha = 1;
    }
    if (introOn && intro > 0) {
      const beat = (typeof navigator !== 'undefined' && navigator.webdriver) ? 0.12 : 0.42;
      const idx = Math.min(2, Math.floor((beat * 3 - intro) / beat));
      const n = String(3 - idx);
      g.fillStyle = 'rgba(0,0,0,.35)';
      g.fillRect(cssW / 2 - 28, cssH / 2 - 36, 56, 48);
      drawText(g, n, cssW / 2, cssH / 2 - 28, 6, '#fff6d0', 'center');
    }
  }

  function resize() {
    if (!cv || !board && !bound) return;
    const rect = board ? board.getBoundingClientRect() : cv.getBoundingClientRect();
    cssW = Math.max(2, rect.width);
    cssH = Math.max(2, rect.height);
    const cap = tier === 'lite' ? 1.5 : 2;
    dpr = Math.min(cap, (root.devicePixelRatio || 1));
    const w = Math.round(cssW * dpr), h = Math.round(cssH * dpr);
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; vignette = null; }
  }

  function frame(view, opt) {
    if (!ctx || !view) return;
    opt = opt || {};
    const wall0 = root.performance ? performance.now() : 0;
    decideTier(opt);
    const wallDt = Math.max(0, Math.min(0.05, opt.wallDt == null ? 0.016 : opt.wallDt));
    const motionDt = Math.max(0, Math.min(0.08, opt.motionDt == null ? wallDt : opt.motionDt));
    if (introOn) {
      if (!opt.paused) intro -= wallDt;
      if (intro <= 0) { intro = 0; introOn = false; }
    }
    aimCamera(view.units, Math.max(wallDt, 0.016));
    shakeT += wallDt;
    if (shakes > 0) shakes *= Math.exp(-wallDt * 7);
    if (shakes < 0.15) shakes = 0;
    const shx = shakes ? Math.sin(shakeT * 52) * shakes : 0;
    const shy = shakes ? Math.cos(shakeT * 41) * shakes * 0.65 : 0;
    resolvePending(view);
    stepPool(motionDt);
    if (banner) { banner.t += wallDt; if (banner.t >= banner.life) banner = null; }
    for (let i = numbers.length - 1; i >= 0; i--) {
      const n = numbers[i];
      n.t += motionDt;
      n.oy += 22 * motionDt;
      if (n.t >= n.life) numbers.splice(i, 1);
    }
    const extras = opt.extras || null;
    const exBy = new Map();
    if (extras) for (let i = 0; i < extras.length; i++) exBy.set(extras[i].id, extras[i]);
    if (!focusId) {
      for (let i = 0; i < view.units.length; i++) if (view.units[i].side === 0 && view.units[i].alive) { focusId = view.units[i].id; break; }
    }
    focusTargetId = (exBy.get(focusId) && exBy.get(focusId).focus) || 0;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    drawBackdrop(ctx);
    ctx.setTransform(dpr, 0, 0, dpr, shx * dpr, shy * dpr);
    drawTiles(ctx);
    for (let i = 0; i < view.telegraphs.length; i++) drawTelegraph(ctx, view.telegraphs[i]);
    ctx.setTransform(dpr, 0, 0, dpr, shx * dpr, shy * dpr);
    ctx.imageSmoothingEnabled = false;
    for (let i = 0; i < pCap; i++) if (pool[i].on && pool[i].ground) drawParticle(ctx, pool[i]);
    const order = view.units.slice().sort((a, b) => a.y - b.y || a.id - b.id);
    if (tier === 'full') {
      for (let i = 0; i < order.length; i++) {
        const u = order[i];
        if (u.state !== 'dash') continue;
        const v = vis.get(u.id);
        if (!v || v.t - (v.ghostAt || 0) < 0.045) continue;
        v.ghostAt = v.t;
        ghosts.push({ id: u.id, x: u.x, y: u.y, art: artKeyOf(u, exBy.get(u.id)), facing: u.facing, el: u.el, r: u.r, boss: u.boss, t: 0 });
      }
    }
    for (let i = ghosts.length - 1; i >= 0; i--) {
      const gh = ghosts[i];
      gh.t += wallDt;
      if (gh.t > 0.18) { ghosts.splice(i, 1); continue; }
      drawGhost(ctx, gh);
    }
    for (let i = 0; i < order.length; i++) {
      const u = order[i];
      const ex = exBy.get(u.id);
      const key = artKeyOf(u, ex);
      if (key) prepareArt(key, artUrl ? artUrl(key) : ('img/' + key + '.webp'));
      drawUnit(ctx, u, ex, motionDt);
    }
    const now = (view.t || 0) + (opt.alpha || 0);
    for (let i = 0; i < view.projs.length; i++) drawProj(ctx, view.projs[i], now);
    // drop trails whose projectile is gone
    if (trails.size) {
      const live = new Set();
      for (let i = 0; i < view.projs.length; i++) live.add(view.projs[i].id);
      for (const id of trails.keys()) if (!live.has(id)) trails.delete(id);
    }
    for (let i = 0; i < pCap; i++) if (pool[i].on && !pool[i].ground) drawParticle(ctx, pool[i]);
    for (let i = 0; i < numbers.length; i++) drawNumber(ctx, numbers[i]);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawHud(ctx, view);
    if (!view._bossShown && view.units.some(u => u.boss)) {
      const b = view.units.find(u => u.boss);
      if (b && !banner) banner = { text: String(b.name || 'BOSS').toUpperCase(), el: b.el, ult: 0, t: 0, life: 1.3 };
      view._bossShown = 1;
    }
    if (wall0 && opt.sample !== false) noteFrame((root.performance ? performance.now() : wall0) - wall0);
  }

  function mount(boardEl, opts) {
    opts = opts || {};
    unmount();
    board = boardEl;
    biome = opts.biome || 'verdant';
    bgUrl = opts.bg || '';
    artUrl = opts.art || null;
    onHold = opts.onHold || null;
    tierLocked = opts.tier || '';
    bound = false;
    bakeShadow();
    bakeIcons();
    if (bgUrl) loadImage(bgUrl).catch(() => {});
    cv = document.createElement('canvas');
    cv.id = 'arenaCv';
    cv.setAttribute('aria-hidden', 'true');
    cv.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;z-index:8;border-radius:14px;touch-action:manipulation;';
    board.classList.add('arena-on');
    board.appendChild(cv);
    ctx = cv.getContext('2d');
    resetVis();
    cam = { x: AW / 2, y: AH / 2, z: 0.8 };
    resize();
    if (root.ResizeObserver) { resizeObs = new ResizeObserver(resize); resizeObs.observe(board); }
    cv.addEventListener('pointerdown', onPointer);
  }

  function onPointer(e) {
    if (!cv) return;
    const r = cv.getBoundingClientRect();
    const w = unproject(e.clientX - r.left, e.clientY - r.top);
    let best = 0, bestD = 46 * 46;
    vis.forEach((v, id) => {
      const u = v._last;
      if (!u) return;
      const dx = u.x - w.x, dy = u.y - w.y, d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = id; }
    });
    focusId = best || 0;
  }

  function unmount() {
    if (resizeObs) { try { resizeObs.disconnect(); } catch (e) { /* gone */ } resizeObs = null; }
    if (!bound && cv && cv.parentNode) cv.parentNode.removeChild(cv);
    if (board) board.classList.remove('arena-on');
    cv = null; ctx = null; board = null; bound = false;
    onHold = null;
    resetVis();
  }

  function bind(canvas) {
    unmount();
    cv = canvas;
    ctx = canvas.getContext('2d');
    bound = true;
    board = null;
    bakeShadow();
    bakeIcons();
    resetVis();
    introOn = false; intro = 0;
    resize();
  }

  function holding() { return introOn && intro > 0; }
  function skipIntro() { intro = 0; introOn = false; }

  function remember(view) {
    if (!view) return;
    for (let i = 0; i < view.units.length; i++) {
      const u = view.units[i];
      let v = vis.get(u.id);
      if (!v) { v = { state: u.state, t: 0, age: u.id, flash: 0, lean: 0 }; vis.set(u.id, v); }
      v._last = u;
    }
  }

  function wrappedFrame(view, opt) {
    remember(view);
    // Boss banner once per mount, not once per view object.
    if (view && view.units) {
      for (let i = 0; i < view.units.length; i++) if (view.units[i].boss && !wrappedFrame.boss) {
        wrappedFrame.boss = true;
        if (!banner) banner = { text: String(view.units[i].name || 'BOSS').toUpperCase(), el: view.units[i].el, t: 0, life: 1.3 };
      }
    }
    const opt2 = Object.assign({ sample: true }, opt);
    // Prevent frame() from also queuing a boss banner via a fresh view flag.
    if (view) view._bossShown = 1;
    frame(view, opt2);
  }
  wrappedFrame.boss = false;

  // ---- preview / bench --------------------------------------------------------------
  function blankView(units, projs, tels) {
    return { ev: 2, t: 0, alpha: 0, over: 0, aw: AW, ah: AH, units: units || [], projs: projs || [], telegraphs: tels || [] };
  }
  function demoUnit(o) {
    return Object.assign({
      id: 1, side: 0, x: 280, y: 300, facing: 1, r: 26, hp: 80, maxHp: 100, shield: 0,
      mana: 40, manaNeed: 100, state: 'idle', name: '', el: 'ember', boss: false, star: 1, alive: true,
    }, o);
  }

  const DEMOS = {
    melee() {
      return {
        biome: 'verdant', bg: 'img/bg_verdant.webp',
        units: [
          demoUnit({ id: 1, x: 300, y: 340, art: 'cr_cind1', el: 'ember', state: 'attack', name: 'Cind', star: 2, hp: 70 }),
          demoUnit({ id: 2, x: 390, y: 330, facing: -1, side: 1, art: 'cr_shel1', el: 'stone', state: 'hit', name: 'Shel', hp: 54, shield: 18 }),
          demoUnit({ id: 3, x: 230, y: 250, art: 'cr_sprt1', el: 'bloom', state: 'idle', name: 'Sprt', star: 1, hp: 90 }),
          demoUnit({ id: 4, x: 520, y: 280, facing: -1, side: 1, art: 'cr_bubb1', el: 'tide', state: 'run', name: 'Bubb', hp: 40 }),
        ],
        extras: [
          { id: 1, art: 'cr_cind1', sp: 'cind', role: 'striker', range: 1, wind: 0.22, recover: 0.16, atkT: 0.22, statuses: ['atkUp'] },
          { id: 2, art: 'cr_shel1', sp: 'shel', role: 'tank', range: 1, statuses: ['defUp'], focus: 1 },
          { id: 3, art: 'cr_sprt1', sp: 'sprt', role: 'support', range: 2, statuses: ['regen'] },
          { id: 4, art: 'cr_bubb1', sp: 'bubb', role: 'caster', range: 2 },
        ],
        seek(t) {
          this.units[0].atkT = 0.22; this.extras[0].atkT = Math.min(0.38, t);
          this.units[1].state = t > 0.2 ? 'hit' : 'idle';
        },
        kick() {
          burst(390, 330, 'ember', 1, false);
          spawn({ k: 'slash', x: 390, y: 330, ang: 0.1, r: 18, c: hex('ember'), c2: '#fff', life: 0.22 });
          numbers.push({ x: 390, y: 320, oy: 0, text: '12', life: 0.75, t: 0.05, kind: 'dmg' });
        },
      };
    },
    ranged() {
      return {
        biome: 'grotto', bg: 'img/bg_grotto.webp',
        units: [
          demoUnit({ id: 1, x: 240, y: 300, art: 'cr_bubb1', el: 'tide', state: 'attack', name: 'Bubb' }),
          demoUnit({ id: 2, x: 620, y: 280, facing: -1, side: 1, art: 'cr_cind1', el: 'ember', state: 'idle', hp: 66 }),
        ],
        extras: [
          { id: 1, art: 'cr_bubb1', sp: 'bubb', role: 'caster', range: 2, wind: 0.22, recover: 0.16, atkT: 0.34 },
          { id: 2, art: 'cr_cind1', sp: 'cind', role: 'striker', range: 1 },
        ],
        projs: [{ id: 9, x: 460, y: 292, vx: 520, vy: -20, r: 10, el: 'tide', friendly: false }],
        kick() {},
        seek(t) {
          this.projs[0].x = 280 + t * 280;
          this.projs[0].y = 300 - Math.sin(t * 3) * 16;
          this.extras[0].atkT = 0.3;
        },
      };
    },
    aoe() {
      return {
        biome: 'magma', bg: 'img/bg_magma.webp',
        units: [
          demoUnit({ id: 1, x: 470, y: 250, art: 'boss_cinder', el: 'ember', state: 'cast', boss: true, name: 'CINDERKING', r: 34, star: 3, hp: 200, maxHp: 240 }),
          demoUnit({ id: 2, x: 400, y: 380, side: 1, facing: -1, art: 'cr_sprt1', el: 'bloom', hp: 40 }),
          demoUnit({ id: 3, x: 560, y: 400, side: 1, facing: -1, art: 'cr_shel1', el: 'stone', hp: 77 }),
        ],
        extras: [
          { id: 1, art: 'boss_cinder', sp: '', role: 'boss', range: 2, castT: 0.55, castDur: 1, ult: 1, statuses: ['taunt'] },
          { id: 2, art: 'cr_sprt1', sp: 'sprt', role: 'support', range: 2 },
          { id: 3, art: 'cr_shel1', sp: 'shel', role: 'tank', range: 1, statuses: ['burn'] },
        ],
        tels: [{ id: 1, shape: 'circle', x: 480, y: 390, r: 120, el: 'ember', left: 0.45, dur: 1 }],
        kick() {
          banner = { text: 'ERUPTION', el: 'ember', ult: 1, t: 0.05, life: 1.4 };
        },
        seek(t) {
          this.tels[0].left = Math.max(0.05, 1 - t);
          this.extras[0].castT = Math.min(0.95, t);
        },
      };
    },
    death() {
      return {
        biome: 'crypt', bg: 'img/bg_crypt.webp',
        units: [
          demoUnit({ id: 1, x: 420, y: 320, art: 'cr_cind1', el: 'ember', state: 'dead', alive: false, hp: 0, side: 1, facing: -1 }),
          demoUnit({ id: 2, x: 300, y: 300, art: 'cr_sprt1', el: 'bloom', state: 'idle', hp: 88 }),
        ],
        extras: [
          { id: 1, art: 'cr_cind1', sp: 'cind', role: 'striker', range: 1 },
          { id: 2, art: 'cr_sprt1', sp: 'sprt', role: 'support', range: 2 },
        ],
        kick() { burst(420, 320, 'ember', 1.2, false); },
        seek(t) {
          const v = vis.get(1) || { state: 'dead', t: 0, age: 0, flash: 0, lean: 0 };
          v.state = 'dead'; v.t = Math.min(0.7, t); vis.set(1, v);
        },
      };
    },
    crit() {
      return {
        biome: 'spire', bg: 'img/bg_spire.webp',
        units: [
          demoUnit({ id: 1, x: 340, y: 310, art: 'cr_cind1', el: 'ember', state: 'attack', star: 3 }),
          demoUnit({ id: 2, x: 450, y: 300, facing: -1, side: 1, art: 'cr_bubb1', el: 'tide', state: 'hit', hp: 22, shield: 10 }),
        ],
        extras: [
          { id: 1, art: 'cr_cind1', sp: 'cind', role: 'striker', range: 1, wind: 0.22, recover: 0.16, atkT: 0.22 },
          { id: 2, art: 'cr_bubb1', sp: 'bubb', role: 'caster', range: 2 },
        ],
        kick() {
          shakes = 6;
          burst(450, 300, 'ember', 1.5, true);
          numbers.push({ x: 450, y: 280, oy: 4, text: '48!', life: 0.9, t: 0.02, crit: 1, kind: 'dmg' });
          const v = vis.get(2); if (v) v.flash = 1;
        },
        seek(t) { shakes = Math.max(shakes, 4 * Math.max(0, 1 - t * 2)); },
      };
    },
  };

  let demo = null;
  function playDemo(canvas, name) {
    bind(canvas);
    introOn = false;
    const spec = (DEMOS[name] || DEMOS.melee)();
    biome = spec.biome;
    bgUrl = spec.bg || '';
    if (bgUrl) loadImage(bgUrl).catch(() => {});
    artUrl = k => 'img/' + k + '.webp';
    spec.units.forEach(u => prepareArt(u.art, artUrl(u.art)));
    demo = spec;
    if (spec.kick) spec.kick();
    const view = blankView(spec.units, spec.projs || [], spec.tels || []);
    wrappedFrame(view, { extras: spec.extras, wallDt: 0.016, motionDt: 0, sample: false });
    return {
      seek(t) {
        if (spec.seek) spec.seek(t);
        const view2 = blankView(spec.units, spec.projs || [], spec.tels || []);
        view2.t = t;
        wrappedFrame(view2, { extras: spec.extras, wallDt: 0.016, motionDt: 0.016, sample: false, alpha: 0 });
      },
    };
  }

  function bench(canvas, ms) {
    bind(canvas);
    introOn = false;
    tierLocked = 'full';
    tier = 'full';
    pCap = PMAX;
    biome = 'verdant';
    bgUrl = 'img/bg_verdant.webp';
    loadImage(bgUrl).catch(() => {});
    artUrl = k => 'img/' + k + '.webp';
    const artsK = ['cr_cind1', 'cr_bubb1', 'cr_sprt1', 'cr_shel1'];
    artsK.forEach(k => prepareArt(k, artUrl(k)));
    const units = [];
    const extras = [];
    for (let i = 0; i < 16; i++) {
      const art = artsK[i % artsK.length];
      units.push(demoUnit({
        id: i + 1, side: i < 8 ? 0 : 1, facing: i < 8 ? 1 : -1,
        x: 80 + (i % 8) * 100, y: 120 + ((i / 8) | 0) * 200 + (i % 3) * 30,
        art, el: ['ember', 'tide', 'bloom', 'stone'][i % 4],
        state: i % 5 === 0 ? 'attack' : i % 5 === 1 ? 'run' : 'idle',
        hp: 50 + (i * 7) % 50, shield: i % 4 === 0 ? 20 : 0,
      }));
      extras.push({ id: i + 1, art, sp: art.slice(3, 7), role: 'striker', range: i % 2 ? 2 : 1, wind: 0.22, recover: 0.16, atkT: 0.1, statuses: i % 6 === 0 ? ['burn'] : [] });
    }
    const projs = [];
    for (let i = 0; i < 40; i++) projs.push({ id: 100 + i, x: 40 + (i * 23) % 900, y: 40 + (i * 37) % 540, vx: 200, vy: 40, r: 10, el: ['ember', 'tide', 'volt', 'frost'][i % 4], friendly: false });
    for (let i = 0; i < 400; i++) spawn({ k: 'dot', x: (i * 17) % AW, y: (i * 13) % AH, vx: (i % 7) - 3, vy: -20, c: pal('ember')[i % 3], r: 2, life: 2.5, drag: 0.2 });
    const tels = [{ id: 1, shape: 'circle', x: 480, y: 300, r: 140, el: 'ember', left: 0.4, dur: 1 }, { id: 2, shape: 'cone', x: 200, y: 400, r: 160, ang: 0.4, arc: 1.1, el: 'volt', left: 0.5, dur: 1 }];
    return new Promise(resolve => {
      let frames = 0;
      const t0 = performance.now();
      function loop(now) {
        frames++;
        const view = blankView(units, projs, tels);
        view.t = (now - t0) / 1000;
        for (let i = 0; i < projs.length; i++) {
          projs[i].x += projs[i].vx * 0.016;
          if (projs[i].x > AW) projs[i].x = 20;
        }
        wrappedFrame(view, { extras, wallDt: 0.016, motionDt: 0.016, tier: 'full', sample: false });
        if (now - t0 < ms) requestAnimationFrame(loop);
        else {
          const fps = frames / ((now - t0) / 1000);
          resolve({ fps, frames, particles: pool.filter(p => p.on).length, tier });
        }
      }
      requestAnimationFrame(loop);
    });
  }

  function paintClip(canvas, opt) {
    bind(canvas);
    introOn = false;
    biome = 'crypt';
    const atlas = opt.atlasId && atlases.get(opt.atlasId);
    const u = demoUnit({
      id: 1, x: AW / 2, y: AH * 0.62, art: opt.art || (atlas && atlas.id) || 'demo_hero',
      state: opt.clip || 'idle', facing: opt.facing || 1, el: opt.el || 'ember', name: '',
      boss: !!opt.boss, r: opt.boss ? 34 : 26,
    });
    const extra = { id: 1, art: u.art, sp: opt.sp || '', role: opt.role || 'striker', range: opt.range || 1, wind: 0.22, recover: 0.16, atkT: opt.time || 0, castT: opt.time || 0, castDur: 0.5 };
    if (!atlas && opt.art) prepareArt(opt.art, opt.url || ('img/' + opt.art + '.webp'));
    const v = vis.get(1) || { state: u.state, t: 0, age: opt.time || 0, flash: 0, lean: 0 };
    v.state = u.state; v.t = opt.time || 0; v.age = opt.time || 0; vis.set(1, v);
    const view = blankView([u]);
    wrappedFrame(view, { extras: [extra], wallDt: 0, motionDt: 0, sample: false });
  }

  const api = {
    mount(boardEl, opts) { wrappedFrame.boss = false; mount(boardEl, opts); },
    unmount, resize,
    push, holding, skipIntro,
    frame: wrappedFrame,
    loadAtlas, makeDemoAtlas, prepareArt, frameIndex,
    bind, playDemo, bench, paintClip,
    get tier() { return tier; },
    set tier(v) { tierLocked = v === 'full' || v === 'lite' ? v : ''; decideTier(); },
    get focus() { return focusId; },
    set focus(id) { focusId = id || 0; },
    atlas(id) { return atlases.get(id) || null; },
    artInfo(key) { const r = arts.get(key); return r && r.baked ? { w: r.baked.w, h: r.baked.h, feet: r.baked.feet } : null; },
    bakeURL(key) { const r = arts.get(key); return r && r.baked ? r.baked.canvas.toDataURL() : ''; },
  };
  root.GArenaView = api;
})(typeof window !== 'undefined' ? window : globalThis);
