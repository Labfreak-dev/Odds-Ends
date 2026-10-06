/* Iron League — class weapons, hand anchors, and a sprite in the hand.
   Time Fantasy attack rows already paint a weapon, so each class uses a
   battler and a row that match (swing, thrust, bow loose, gun). The loose
   sprites in assets/weapons/ sit on idle, walk, cast, and guard, and on an
   attack only when that frame has no weapon. Crossbow, book, claws, katana,
   a real mace, and a real scythe are drawn here. A gun shot adds a muzzle
   flash. ?debug=anchors marks the grip. */
(function (root) {
  const IL = root.IL = root.IL || {};
  const AX = 24;
  const AY = 45;

  const CLASS_WEAPON = {
    warrior: "sword",
    archer: "bow",
    mage: "staff",
    tank: "axe",
    rogue: "dagger",
    lancer: "spear",
    berserker: "axe",
    healer: "staff",
    assassin: "dagger",
    ranger: "bow",
    battlemage: "staff",
    shieldbearer: "mace",
    skirmisher: "gun",
    duelist: "sword",
    elementalist: "staff",
    monk: "fist",
    necromancer: "scythe",
    paladin: "sword",
    druid: "staff",
    bard: "book",
    gunslinger: "gun",
    warlock: "staff",
    samurai: "katana",
    spearmaiden: "spear",
    summoner: "book",
    alchemist: "staff",
    beastmaster: "claw"
  };

  const GEAR_KIND = {
    cleaver: "sword",
    axe: "axe",
    flail: "mace",
    mace: "mace",
    spear: "spear",
    longbow: "bow",
    wand: "wand",
    tome: "book",
    dagger: "dagger",
    star: "dagger"
  };

  /* Grip in the 48×48 cell, rotation in radians. Sprites point along +x
     (a bow is drawn vertical and uses a rotation near 0). PI aims a
     right-pointing blade to the left, which is forward on an unmirrored sheet. */
  function row(a, b, c) { return [a, b, c]; }
  function grip(x, y, rot) { return [x, y, rot]; }

  const SWING = {
    idle1: row(grip(18, 27, 2.55), grip(17, 26, 2.45), grip(18, 28, 2.65)),
    idle2: row(grip(18, 26, 2.5), grip(17, 25, 2.7), grip(18, 28, 2.4)),
    walk: row(grip(18, 25, 2.4), grip(17, 29, 2.7), grip(19, 26, 2.45)),
    atk1: row(grip(26, 16, -0.7), grip(18, 13, -1.8), grip(11, 27, 2.75)),
    atk2: row(grip(24, 14, -0.45), grip(16, 18, 2.15), grip(10, 28, 2.95)),
    bow: row(grip(16, 22, -1.57), grip(18, 22, -1.5), grip(12, 21, -1.57)),
    gun: row(grip(14, 23, 3.14), grip(15, 22, 3.05), grip(10, 22, 3.14)),
    hit: row(grip(22, 30, 2.1), grip(24, 32, 1.7), grip(23, 33, 1.5)),
    crouch: row(grip(16, 32, 2.4), grip(15, 33, 2.55), grip(16, 31, 2.35)),
    magic: row(grip(22, 16, -1.15), grip(20, 12, -1.35), grip(18, 14, -1.05)),
    cheer: row(grip(18, 14, -1.2), grip(16, 12, -1.45), grip(18, 15, -1.1)),
    dead: row(grip(14, 42, 0.55), grip(14, 42, 0.55), grip(14, 42, 0.55))
  };

  function copyPose(src) {
    const out = {};
    const keys = Object.keys(src);
    for (let i = 0; i < keys.length; i++) out[keys[i]] = src[keys[i]];
    return out;
  }

  const THRUST = copyPose(SWING);
  THRUST.idle1 = row(grip(16, 26, 3.05), grip(16, 25, 3.0), grip(17, 27, 3.1));
  THRUST.idle2 = row(grip(16, 25, 3.0), grip(17, 26, 3.08), grip(16, 27, 2.95));
  THRUST.walk = row(grip(17, 25, 2.9), grip(15, 27, 3.14), grip(16, 24, 2.85));
  THRUST.atk1 = row(grip(20, 24, 2.7), grip(14, 23, 3.14), grip(8, 22, 3.14));
  THRUST.atk2 = row(grip(22, 22, 2.5), grip(13, 22, 3.14), grip(7, 22, 3.14));
  THRUST.dead = row(grip(12, 43, 0.3), grip(12, 43, 0.3), grip(12, 43, 0.3));

  const BOW = copyPose(SWING);
  BOW.idle1 = row(grip(15, 24, 0.05), grip(15, 23, -0.06), grip(16, 25, 0.08));
  BOW.idle2 = row(grip(15, 23, 0.02), grip(16, 24, 0.1), grip(15, 25, -0.04));
  BOW.walk = row(grip(16, 23, 0.12), grip(14, 26, -0.08), grip(15, 24, 0.04));
  BOW.bow = row(grip(16, 22, 0.02), grip(19, 22, 0.18), grip(11, 21, -0.02));
  BOW.dead = row(grip(18, 42, 1.2), grip(18, 42, 1.2), grip(18, 42, 1.2));

  const GUN = copyPose(THRUST);
  GUN.idle1 = row(grip(14, 24, 3.05), grip(14, 23, 3.0), grip(15, 25, 3.1));
  GUN.gun = row(grip(16, 23, 2.9), grip(14, 22, 3.14), grip(9, 22, 3.14));

  const STAFF = copyPose(SWING);
  STAFF.idle1 = row(grip(20, 24, -1.45), grip(20, 23, -1.55), grip(19, 25, -1.35));
  STAFF.idle2 = row(grip(20, 23, -1.5), grip(21, 22, -1.35), grip(19, 25, -1.6));
  STAFF.walk = row(grip(20, 22, -1.4), grip(19, 26, -1.6), grip(21, 23, -1.3));
  STAFF.magic = row(grip(22, 18, -1.2), grip(20, 10, -1.45), grip(18, 12, -1.15));
  STAFF.dead = row(grip(16, 43, 0.2), grip(16, 43, 0.2), grip(16, 43, 0.2));

  const BOOK = copyPose(STAFF);
  BOOK.idle1 = row(grip(18, 26, -0.4), grip(18, 25, -0.5), grip(17, 27, -0.3));
  BOOK.magic = row(grip(20, 18, -0.9), grip(18, 12, -1.15), grip(19, 14, -0.8));

  const FIST = copyPose(THRUST);
  FIST.idle1 = row(grip(16, 28, 3.14), grip(17, 27, 3.0), grip(16, 29, 2.9));
  FIST.atk1 = row(grip(20, 26, 2.8), grip(14, 25, 3.14), grip(9, 24, 3.14));
  FIST.atk2 = row(grip(18, 20, -1.2), grip(14, 22, 2.4), grip(10, 26, 3.14));

  const POSES = {
    sword: SWING,
    katana: SWING,
    axe: SWING,
    mace: SWING,
    scythe: SWING,
    claw: SWING,
    spear: THRUST,
    dagger: THRUST,
    gun: GUN,
    bow: BOW,
    crossbow: BOW,
    staff: STAFF,
    wand: STAFF,
    book: BOOK,
    fist: FIST
  };

  /* w/h and grip match the il-weapons-1 sprites. angle is the drawn
     grip-to-tip direction (0 = right, 90 = up). native sprites already
     face the way the pose expects, so their angle is not added again. */
  const SPECS = {
    sword: { w: 13, h: 13, gx: 2, gy: 8, angle: 38 },
    axe: { w: 14, h: 15, gx: 2, gy: 10, angle: 56 },
    mace: { w: 14, h: 14, gx: 2, gy: 10, angle: 0 },
    spear: { w: 7, h: 32, gx: 3, gy: 20, angle: 90 },
    dagger: { w: 14, h: 13, gx: 10, gy: 9, angle: 138 },
    bow: { w: 6, h: 20, gx: 2, gy: 9, angle: 0, native: true },
    crossbow: { w: 18, h: 14, gx: 8, gy: 6, angle: 0, native: true },
    staff: { w: 15, h: 14, gx: 3, gy: 10, angle: 39 },
    staff_wood: { w: 16, h: 16, gx: 2, gy: 13, angle: 43 },
    wand: { w: 8, h: 17, gx: 2, gy: 9, angle: 69 },
    gun: { w: 19, h: 9, gx: 11, gy: 5, angle: 163 },
    fist: { w: 8, h: 7, gx: 2, gy: 3, angle: 0 },
    claw: { w: 14, h: 10, gx: 2, gy: 5, angle: 0 },
    book: { w: 12, h: 14, gx: 6, gy: 11, angle: 0 },
    scythe: { w: 22, h: 16, gx: 3, gy: 12, angle: 0 },
    katana: { w: 20, h: 8, gx: 2, gy: 5, angle: 0 },
    arrow: { w: 11, h: 4, gx: 5, gy: 2, angle: 180, native: true }
  };

  const sprites = {};
  let bundled = null;

  function px(ctx, color, x, y, w, h) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  function paintSprite(kind, ctx) {
    const steel = "#d5dde6";
    const edge = "#8e98a4";
    const wood = "#8a5a32";
    const wrap = "#c4622d";
    const gold = "#e0b07a";
    const dark = "#2c261f";
    if (kind === "sword") {
      px(ctx, steel, 4, 3, 13, 1);
      px(ctx, edge, 4, 4, 12, 1);
      px(ctx, gold, 3, 2, 2, 3);
      px(ctx, wrap, 1, 3, 2, 1);
    } else if (kind === "axe") {
      px(ctx, wood, 1, 6, 10, 2);
      px(ctx, steel, 9, 2, 6, 5);
      px(ctx, edge, 9, 7, 6, 2);
      px(ctx, gold, 8, 5, 2, 4);
    } else if (kind === "mace") {
      px(ctx, wood, 1, 6, 7, 2);
      px(ctx, gold, 7, 6, 2, 2);
      px(ctx, steel, 9, 4, 4, 6);
      px(ctx, edge, 8, 5, 1, 4);
      px(ctx, edge, 13, 5, 1, 4);
      px(ctx, steel, 10, 3, 2, 1);
      px(ctx, steel, 10, 10, 2, 1);
      px(ctx, steel, 11, 2, 1, 1);
      px(ctx, steel, 11, 11, 1, 1);
    } else if (kind === "spear") {
      px(ctx, wood, 1, 2, 15, 1);
      px(ctx, steel, 15, 1, 6, 3);
      px(ctx, edge, 19, 2, 2, 1);
    } else if (kind === "dagger") {
      px(ctx, steel, 3, 2, 8, 1);
      px(ctx, edge, 3, 3, 7, 1);
      px(ctx, wrap, 1, 2, 2, 2);
    } else if (kind === "bow") {
      px(ctx, wood, 2, 1, 2, 14);
      px(ctx, wood, 3, 0, 2, 2);
      px(ctx, wood, 3, 14, 2, 2);
      px(ctx, gold, 5, 1, 1, 14);
      px(ctx, wrap, 3, 7, 2, 2);
    } else if (kind === "staff") {
      px(ctx, wood, 2, 2, 13, 1);
      px(ctx, gold, 15, 1, 3, 3);
      px(ctx, "#7eb6ff", 16, 0, 2, 2);
      px(ctx, wrap, 1, 2, 2, 1);
    } else if (kind === "gun") {
      px(ctx, dark, 2, 2, 12, 2);
      px(ctx, steel, 8, 1, 6, 2);
      px(ctx, wood, 1, 3, 5, 2);
      px(ctx, gold, 13, 2, 2, 1);
    } else if (kind === "fist") {
      px(ctx, "#d7b094", 1, 1, 6, 5);
      px(ctx, "#a67c5d", 1, 5, 6, 1);
      px(ctx, steel, 5, 2, 2, 2);
    } else if (kind === "claw") {
      px(ctx, wrap, 1, 3, 4, 4);
      px(ctx, "#a67c5d", 1, 6, 4, 1);
      px(ctx, steel, 4, 1, 7, 1);
      px(ctx, steel, 5, 3, 8, 1);
      px(ctx, steel, 4, 5, 8, 1);
      px(ctx, steel, 5, 7, 7, 1);
      px(ctx, edge, 11, 0, 2, 1);
      px(ctx, edge, 12, 2, 2, 1);
      px(ctx, edge, 12, 4, 2, 1);
      px(ctx, edge, 11, 6, 2, 1);
    } else if (kind === "book") {
      px(ctx, "#4a2c38", 1, 1, 10, 12);
      px(ctx, "#f4ecdf", 2, 2, 8, 10);
      px(ctx, dark, 6, 2, 1, 10);
      px(ctx, gold, 3, 4, 2, 1);
      px(ctx, gold, 8, 4, 2, 1);
      px(ctx, "#c4622d", 3, 6, 2, 1);
      px(ctx, "#6e8cae", 8, 6, 2, 1);
      px(ctx, "#8a5a32", 1, 12, 10, 1);
    } else if (kind === "scythe") {
      px(ctx, wood, 2, 11, 14, 2);
      px(ctx, wrap, 1, 11, 2, 2);
      px(ctx, steel, 14, 4, 2, 8);
      px(ctx, steel, 15, 2, 4, 3);
      px(ctx, steel, 18, 1, 3, 2);
      px(ctx, edge, 16, 5, 2, 6);
      px(ctx, edge, 19, 3, 2, 2);
      px(ctx, dark, 15, 11, 2, 2);
    } else if (kind === "katana") {
      px(ctx, wrap, 1, 4, 3, 2);
      px(ctx, gold, 3, 3, 2, 4);
      px(ctx, steel, 5, 4, 8, 1);
      px(ctx, steel, 9, 3, 6, 1);
      px(ctx, steel, 13, 2, 5, 1);
      px(ctx, edge, 17, 1, 2, 1);
      px(ctx, dark, 5, 5, 8, 1);
      px(ctx, dark, 10, 4, 5, 1);
    } else if (kind === "arrow") {
      px(ctx, wood, 3, 1, 6, 2);
      px(ctx, steel, 1, 1, 2, 2);
      px(ctx, "#c4622d", 8, 0, 2, 1);
      px(ctx, "#c4622d", 8, 3, 2, 1);
    } else if (kind === "crossbow") {
      px(ctx, wood, 7, 6, 10, 2);
      px(ctx, wood, 14, 5, 3, 1);
      px(ctx, wood, 1, 2, 2, 10);
      px(ctx, wood, 2, 2, 5, 1);
      px(ctx, wood, 2, 11, 5, 1);
      px(ctx, gold, 3, 3, 1, 8);
      px(ctx, steel, 2, 6, 6, 1);
      px(ctx, edge, 1, 6, 2, 1);
    }
  }

  function canvasSprite(kind) {
    if (sprites[kind]) return sprites[kind];
    const spec = SPECS[kind];
    if (!spec || typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = spec.w;
    canvas.height = spec.h;
    const ctx = canvas.getContext("2d");
    paintSprite(kind, ctx);
    sprites[kind] = canvas;
    return canvas;
  }

  function artKey(kind, cls) {
    if (kind === "staff" && cls === "druid") return "staff_wood";
    if (kind === "staff" && cls === "alchemist") return "wand";
    return kind;
  }

  function spriteFor(kind) {
    if (bundled && bundled[kind]) return bundled[kind];
    return canvasSprite(kind);
  }

  function spinOf(spec, rot) {
    if (!spec || spec.native) return rot;
    return rot + (spec.angle || 0) * Math.PI / 180;
  }

  function handAnchor(kind, motion, sub) {
    const table = POSES[kind] || SWING;
    const frames = table[motion] || SWING[motion] || SWING.idle1;
    const i = sub == null ? 0 : sub;
    const pick = frames[i] || frames[frames.length - 1];
    return { x: pick[0], y: pick[1], rot: pick[2] };
  }

  function weaponKind(fighter) {
    if (!fighter) return "sword";
    if (fighter.weaponKind && CLASS_WEAPON[fighter.cls] && !fighter.gear) return fighter.weaponKind;
    const gear = fighter.gear && fighter.gear.weapon;
    const key = gear && (typeof gear === "string" ? gear : gear.key);
    if (key && GEAR_KIND[key]) return GEAR_KIND[key];
    if (fighter.weaponKind) return fighter.weaponKind;
    return CLASS_WEAPON[fighter.cls] || "sword";
  }

  function debugOn() {
    if (IL._debugAnchors != null) return IL._debugAnchors;
    let q = "";
    try { q = (root.location && root.location.search) || ""; } catch (err) { q = ""; }
    IL._debugAnchors = /(?:^|[?&])debug=anchors(?:&|$)/.test(q);
    return IL._debugAnchors;
  }

  const HOLD = { idle1: 1, idle2: 1, walk: 1, magic: 1, crouch: 1, hit: 1, cheer: 1, dead: 1 };

  /* Bow and gun columns are clear on the sheets that lack them. Every
     real melee row already paints a weapon, so a second sprite stays off. */
  function frameHasWeapon(motion, sheet) {
    if (motion === "bow") return !!(IL.sheetHasBow && IL.sheetHasBow(sheet));
    if (motion === "gun") return !!(IL.sheetHasGun && IL.sheetHasGun(sheet));
    if (motion === "atk1" || motion === "atk2") return !!(sheet && IL.sheetKnown && IL.sheetKnown(sheet));
    return false;
  }

  /* Sheets bake a sword into the swing. These kinds are the class weapon,
     so they stay in the hand and follow the swing instead of vanishing. */
  const OVERLAY = {
    katana: 1, scythe: 1, claw: 1, book: 1, mace: 1, staff: 1, wand: 1, fist: 1, crossbow: 1
  };

  function shouldPaint(kind, motion, sheet) {
    if (!kind) return false;
    if (debugOn()) return true;
    if (HOLD[motion]) return true;
    if (OVERLAY[kind]) return true;
    return !frameHasWeapon(motion, sheet);
  }

  function paintFlash(ctx, s) {
    ctx.save();
    ctx.translate((6 - AX) * s, (30 - AY) * s);
    ctx.fillStyle = "#fff6d0";
    ctx.fillRect(-s, -s, s * 3, s * 2);
    ctx.fillStyle = "#ffb45a";
    ctx.fillRect(-s * 4, Math.round(-s * 0.5), s * 3, s);
    ctx.fillStyle = "#fffef8";
    ctx.fillRect(0, 0, s, s);
    ctx.restore();
  }

  function paint(ctx, kind, motion, sub, scale, sheet, cls) {
    if (!kind) return;
    const anchor = handAnchor(kind, motion, sub);
    const s = scale || 4;
    if (debugOn()) {
      ctx.save();
      ctx.translate((anchor.x - AX) * s, (anchor.y - AY) * s);
      ctx.fillStyle = "#ff4fd8";
      ctx.fillRect(-s * 0.35, -1, s * 0.7, 2);
      ctx.fillRect(-1, -s * 0.35, 2, s * 0.7);
      ctx.restore();
    }
    if (kind === "gun" && motion === "gun" && sub === 2) paintFlash(ctx, s);
    if (!shouldPaint(kind, motion, sheet)) return;
    const key = artKey(kind, cls);
    const spec = SPECS[key] || SPECS[kind];
    const spr = spriteFor(key);
    if (!spec || !spr) return;
    ctx.save();
    ctx.translate((anchor.x - AX) * s, (anchor.y - AY) * s);
    ctx.rotate(spinOf(spec, anchor.rot));
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(spr, Math.round(-spec.gx * s), Math.round(-spec.gy * s), spec.w * s, spec.h * s);
    ctx.restore();
  }

  function clipNameAt(frame) {
    const names = Object.keys(IL.CLIPS || {});
    for (let i = 0; i < names.length; i++) {
      const clip = IL.CLIPS[names[i]];
      if (frame >= clip.from && frame <= clip.to) return names[i];
    }
    return "idle";
  }

  function worldHand(u, scale) {
    const s = scale || 4;
    const frame = IL.frameIndex(u.anim || "idle", u.animT || 0);
    const name = clipNameAt(frame);
    const clip = IL.CLIPS[name] || IL.CLIPS.idle;
    const sheet = (u.parts && u.parts.sheet) || (IL.defaultSheet ? IL.defaultSheet(u.cls) : "");
    const kind = u.weaponKind || CLASS_WEAPON[u.cls] || "sword";
    let motion = IL.visualMotion(name, u.cls, sheet, kind);
    if (u.motion && IL.CLIP_MOTION) {
      const hinted = u.state === "attack" || u.state === "cast";
      if (hinted) motion = u.motion;
    }
    const sub = IL.visualSample(name, motion, frame - clip.from);
    const anchor = handAnchor(kind, motion, sub);
    const mirror = u.facing < 0 ? 1 : -1;
    return {
      x: u.x + (anchor.x - AX) * s * mirror,
      y: (u.y - (u.z || 0)) + (anchor.y - AY) * s,
      kind: kind,
      motion: motion,
      sub: sub
    };
  }

  function adoptBundle(manifest, base) {
    if (!manifest || !manifest.files || typeof Image === "undefined") return;
    const keys = Object.keys(manifest.files);
    bundled = bundled || {};
    for (let i = 0; i < keys.length; i++) {
      (function (kind) {
        const img = new Image();
        img.onload = function () { bundled[kind] = img; };
        img.src = base + manifest.files[kind];
      })(keys[i]);
    }
  }

  function loadManifest(url, base) {
    if (typeof fetch !== "function") return;
    fetch(url).then(function (res) {
      if (!res.ok) return null;
      return res.json();
    }).then(function (data) {
      if (!data) return;
      adoptBundle(data, base || url.replace(/[^/]+$/, ""));
      if (data.remote) loadManifest(data.remote, data.remote.replace(/[^/]+$/, ""));
    }).catch(function () {});
  }

  IL.CLASS_WEAPON = CLASS_WEAPON;
  IL.GEAR_KIND = GEAR_KIND;
  IL.weaponKind = weaponKind;
  IL.weapons = {
    handAnchor: handAnchor,
    paint: paint,
    worldHand: worldHand,
    debugOn: debugOn,
    sprite: spriteFor,
    motions: ["idle1", "idle2", "walk", "atk1", "atk2", "bow", "gun", "hit", "crouch", "magic", "cheer", "dead"]
  };

  loadManifest("assets/weapons/manifest.json", "assets/weapons/");
})(typeof window !== "undefined" ? window : globalThis);
