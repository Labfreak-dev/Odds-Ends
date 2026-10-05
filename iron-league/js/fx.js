/* Iron League — pixel FX strips from the combat packs.
   Each sheet is a horizontal row of square frames, played left to right.
   Nearest-neighbour, usually additive. If a sheet never loads, render.js
   falls back to procedural strokes for that kind. */
(function (root) {
  const IL = root.IL = root.IL || {};

  const SHEETS = {
    slash:  { src: "assets/fx/slash.png",  size: 96,  frames: 24 },
    spark:  { src: "assets/fx/spark.png",  size: 128, frames: 24 },
    boom:   { src: "assets/fx/boom.png",   size: 96,  frames: 16 },
    plasma: { src: "assets/fx/plasma.png", size: 128, frames: 24 },
    orbit:  { src: "assets/fx/orbit.png",  size: 128, frames: 24 },
    smoke:  { src: "assets/fx/smoke.png",  size: 96,  frames: 24 },
    dash:   { src: "assets/fx/dash.png",   size: 128, frames: 24 },
    shot:   { src: "assets/fx/shot.png",   size: 96,  frames: 16 },
    bolt:   { src: "assets/fx/bolt.png",   size: 128, frames: 24 }
  };

  /* Defaults keep the strips readable on the pit. Callers may override size. */
  const PRESET = {
    slash:  { fps: 32, size: 176 },
    spark:  { fps: 30, size: 132 },
    boom:   { fps: 22, size: 210 },
    plasma: { fps: 14, size: 200 },
    orbit:  { fps: 18, size: 120 },
    smoke:  { fps: 16, frames: 12, size: 108, ground: true },
    dash:   { fps: 30, frames: 14, size: 132, ground: true },
    shot:   { fps: 20, size: 64 },
    bolt:   { fps: 28, size: 220 }
  };

  const images = {};
  const failed = {};
  let loading = null;
  let spawned = 0;
  let readyFlag = false;

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      const img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error("fx " + src)); };
      img.src = src;
    });
  }

  function load() {
    if (loading) return loading;
    const jobs = Object.keys(SHEETS).map(function (id) {
      return loadImage(SHEETS[id].src).then(function (img) {
        images[id] = img;
      }).catch(function () {
        failed[id] = true;
      });
    });
    loading = Promise.all(jobs).then(function () {
      readyFlag = true;
      return loadedCount();
    });
    return loading;
  }

  function has(id) { return !!images[id]; }

  function loadedCount() { return Object.keys(images).length; }

  function spawn(list, kind, x, y, opt) {
    const spec = SHEETS[kind];
    if (!spec) return null;
    opt = opt || {};
    const preset = PRESET[kind] || {};
    const frames = opt.frames || preset.frames || spec.frames;
    const fps = opt.fps || preset.fps || 24;
    const item = {
      kind: kind,
      x: x,
      y: y,
      t: 0,
      fps: fps,
      frames: frames,
      life: opt.life || frames / fps,
      size: opt.size || preset.size || spec.size,
      rot: opt.rot || 0,
      facing: opt.facing == null ? 1 : opt.facing,
      alpha: opt.alpha == null ? 1 : opt.alpha,
      loop: !!opt.loop,
      additive: opt.additive !== false,
      ground: opt.ground != null ? opt.ground : !!preset.ground,
      team: opt.team || 0
    };
    list.push(item);
    spawned++;
    return item;
  }

  function step(list, dt) {
    if (!list) return;
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      s.t += dt;
      if (s.t >= s.life) s.dead = true;
    }
    let w = 0;
    for (let i = 0; i < list.length; i++) if (!list[i].dead) list[w++] = list[i];
    list.length = w;
  }

  function frameOf(s) {
    const spec = SHEETS[s.kind];
    const n = s.frames || (spec ? spec.frames : 1);
    let i = Math.floor(s.t * (s.fps || 24));
    if (i < 0) i = 0;
    if (s.loop) i = i % n;
    else if (i >= n) i = n - 1;
    return i;
  }

  function drawOne(ctx, s) {
    const img = images[s.kind];
    const spec = SHEETS[s.kind];
    if (!img || !spec) return false;
    const fw = spec.size;
    const fi = frameOf(s);
    let fade = 1;
    if (!s.loop && s.life > 0) {
      const p = s.t / s.life;
      fade = p < 0.75 ? 1 : Math.max(0, 1 - (p - 0.75) / 0.25);
    }
    ctx.save();
    ctx.translate(Math.round(s.x), Math.round(s.y));
    if (s.rot) ctx.rotate(s.rot);
    ctx.scale(s.facing < 0 ? -1 : 1, 1);
    ctx.globalAlpha = Math.max(0, Math.min(1, s.alpha * fade));
    if (s.additive) ctx.globalCompositeOperation = "lighter";
    ctx.imageSmoothingEnabled = false;
    const d = s.size;
    ctx.drawImage(img, fi * fw, 0, fw, fw, Math.round(-d / 2), Math.round(-d / 2), d, d);
    ctx.restore();
    return true;
  }

  /* State-tied loop: cast sigils, block rings, the arrowhead glint. */
  function drawLoop(ctx, kind, x, y, size, time, opt) {
    if (!images[kind]) return false;
    opt = opt || {};
    const spec = SHEETS[kind];
    const preset = PRESET[kind] || {};
    return drawOne(ctx, {
      kind: kind,
      x: x,
      y: y,
      t: time || 0,
      fps: opt.fps || preset.fps || 16,
      frames: spec.frames,
      life: 1e9,
      size: size || preset.size || spec.size,
      rot: opt.rot || 0,
      facing: opt.facing == null ? 1 : opt.facing,
      alpha: opt.alpha == null ? 0.92 : opt.alpha,
      loop: true,
      additive: opt.additive !== false,
      ground: true,
      team: 0
    });
  }

  function drawList(ctx, list, ground) {
    if (!list) return;
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      if (!!s.ground !== !!ground) continue;
      drawOne(ctx, s);
    }
  }

  IL.fx = {
    SHEETS: SHEETS,
    load: load,
    has: has,
    loadedCount: loadedCount,
    ready: function () { return readyFlag && loadedCount() >= 6; },
    spawn: spawn,
    step: step,
    drawOne: drawOne,
    drawLoop: drawLoop,
    drawList: drawList,
    get spawned() { return spawned; }
  };
})(typeof window !== "undefined" ? window : globalThis);
