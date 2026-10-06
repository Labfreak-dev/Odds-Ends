/* Iron League — Time Fantasy battler sheets.
   One 576×144 atlas per character: 12 motions × 3 frames of 48×48.
   See ANIM.md. Heroes99 layers are no longer composited. */
(function (root) {
  const IL = root.IL = root.IL || {};
  const BASE = "assets/timefantasy/";
  const ASSET_V = "8";
  const CELL = 48;
  /* Foot point inside the 48×48 cell. Standing soles end on row 44, so 45
     sits that row on the pit floor. Dead art hangs one pixel lower. */
  const AX = 24;
  const AY = 45;
  const MOTIONS = ["idle1", "idle2", "walk", "atk1", "atk2", "bow", "gun", "hit", "crouch", "magic", "cheer", "dead"];

  const COL = {};
  for (let i = 0; i < MOTIONS.length; i++) COL[MOTIONS[i]] = i;
  const clipNames = Object.keys(IL.CLIPS);

  const images = new Map();
  const atlases = new Map();

  function loadImage(src) {
    if (images.has(src)) return images.get(src);
    const p = new Promise(function (resolve, reject) {
      const img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error("Could not load " + src)); };
      img.src = src;
    });
    images.set(src, p);
    return p;
  }

  function resolveId(parts) {
    const id = parts && parts.sheet;
    if (id && IL.sheetKnown(id)) return id;
    return IL.defaultSheet("warrior");
  }

  function keyOf(parts) {
    return resolveId(parts);
  }

  function compose(parts) {
    const id = resolveId(parts);
    if (atlases.has(id)) return atlases.get(id);
    const job = loadImage(BASE + id + ".png?v=" + ASSET_V).then(function (img) {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0);
      canvas.tfSheet = id;
      return canvas;
    });
    atlases.set(id, job);
    return job;
  }

  function clipNameAt(frame) {
    for (let i = 0; i < clipNames.length; i++) {
      const name = clipNames[i];
      const clip = IL.CLIPS[name];
      if (frame >= clip.from && frame <= clip.to) return name;
    }
    return "idle";
  }

  function draw(ctx, atlas, frame, x, y, scale, facing, cls, motionHint, kind) {
    if (!atlas || !frame) return;
    const name = clipNameAt(frame);
    const clip = IL.CLIPS[name];
    if (!clip) return;
    const sheet = atlas.tfSheet || "";
    let held = kind || "";
    if (!held && cls && IL.weaponKind) held = IL.weaponKind({ cls: cls });
    let motion = IL.visualMotion(name, cls, sheet, held);
    if (motionHint && COL[motionHint] != null) motion = motionHint;
    if (held && IL.weapons && IL.weapons.column) motion = IL.weapons.column(held, motion, sheet);
    const sub = IL.visualSample(name, motion, frame - clip.from);
    const col = COL[motion];
    if (col == null) return;
    const s = scale || 4;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    /* A portrait floor swaps the axes so the long side runs down the
       screen. Swap back around the sprite so the head stays up. */
    if (IL.pitTurn) ctx.transform(0, 1, 1, 0, 0, 0);
    /* Sheets face left. Mirror the left team so they look toward +x.
       The right team (facing < 0) stays as painted and looks toward -x. */
    ctx.scale(facing < 0 ? 1 : -1, 1);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      atlas,
      col * CELL, sub * CELL, CELL, CELL,
      Math.round(-AX * s), Math.round(-AY * s), CELL * s, CELL * s
    );
    if (held && IL.weapons && IL.weapons.paint) IL.weapons.paint(ctx, held, motion, sub, s, sheet, cls);
    ctx.restore();
  }

  IL.hero = {
    keyOf: keyOf,
    compose: compose,
    draw: draw
  };
})(typeof window !== "undefined" ? window : globalThis);
