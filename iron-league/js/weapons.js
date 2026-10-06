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

  /* Fist pixel in the 48×48 cell, measured on sheet 1_1 and checked on all
     80 sheets (tools/hand_probe.py). Characters face left, so smaller x is
     forward. For a non-native sprite, rot is the canvas direction the weapon
     should point: 0 right, PI/2 down, PI left (forward), -PI/2 up. The
     sprite's own angle is added in spinOf and cancels its drawn tilt. */
  function grip(x, y, rot) { return [x, y, rot]; }
  const PI = Math.PI;
  const LEFT = PI;
  const UP = -PI / 2;

  const HAND = {
    idle1: [[16, 34], [16, 34], [16, 33]],
    idle2: [[16, 34], [16, 33], [16, 34]],
    walk: [[20, 34], [19, 34], [20, 35]],
    atk1: [[19, 37], [28, 31], [19, 37]],
    atk2: [[26, 35], [25, 22], [24, 35]],
    bow: [[16, 29], [15, 30], [16, 30]],
    gun: [[17, 33], [17, 33], [16, 33]],
    hit: [[18, 33], [18, 30], [19, 29]],
    crouch: [[19, 38], [18, 37], [19, 38]],
    magic: [[18, 23], [18, 23], [18, 23]],
    cheer: [[30, 23], [30, 29], [31, 25]],
    dead: [[23, 37], [23, 37], [23, 37]]
  };

  /* Back hand, where a staff, spear, or bow also needs a grip. Same cells. */
  const BACK = {
    idle1: [[31, 33], [31, 33], [31, 32]],
    idle2: [[33, 33], [33, 32], [33, 33]],
    walk: [[28, 33], [30, 34], [28, 36]],
    atk1: [[20, 38], [17, 31], [19, 37]],
    atk2: [[24, 26], [25, 35], [22, 26]],
    bow: [[32, 26], [30, 29], [32, 29]],
    gun: [[26, 33], [26, 33], [24, 33]],
    hit: [[30, 33], [33, 30], [34, 29]],
    crouch: [[22, 30], [22, 30], [22, 31]],
    magic: [[31, 23], [31, 23], [31, 23]],
    cheer: [[24, 34], [24, 35], [24, 35]],
    dead: [[32, 39], [32, 39], [32, 39]]
  };

  function pose(rots) {
    const out = {};
    const keys = Object.keys(HAND);
    for (let i = 0; i < keys.length; i++) {
      const motion = keys[i];
      const xy = HAND[motion];
      const r = rots[motion];
      out[motion] = [
        grip(xy[0][0], xy[0][1], r[0]),
        grip(xy[1][0], xy[1][1], r[1]),
        grip(xy[2][0], xy[2][1], r[2])
      ];
    }
    return out;
  }

  /* Low and forward on idle, bobbing on the walk, raised on the wind-up,
     extended toward the foe on the strike. Magic is the empty-hands chop. */
  const SWING = pose({
    idle1: [2.85, 2.7, 2.95],
    idle2: [2.8, 3.0, 2.75],
    walk: [2.7, 3.05, 2.6],
    atk1: [-0.9, -2.2, 2.9],
    atk2: [-0.6, 2.4, 3.0],
    bow: [UP, UP, LEFT],
    gun: [LEFT, LEFT, LEFT],
    hit: [1.5, 1.8, 2.1],
    crouch: [2.9, 3.05, 2.8],
    magic: [-2.05, -2.2, 2.9],
    cheer: [UP, -1.2, -1.8],
    dead: [2.75, 2.75, 2.75]
  });

  /* A spear stands up from the fist. A dagger stays low and forward. */
  const THRUST = pose({
    idle1: [2.95, 3.05, 2.85],
    idle2: [3.0, 2.9, 3.1],
    walk: [2.85, 3.14, 2.7],
    atk1: [-0.5, -1.8, LEFT],
    atk2: [-0.4, 2.2, LEFT],
    bow: [UP, UP, LEFT],
    gun: [LEFT, LEFT, LEFT],
    hit: [1.4, 1.7, 2.0],
    crouch: [2.9, 3.0, 2.8],
    magic: [-1.9, -2.1, 2.9],
    cheer: [-1.4, -1.2, -1.7],
    dead: [2.7, 2.7, 2.7]
  });

  const SPEAR = pose({
    idle1: [-2.15, -2.0, -2.3],
    idle2: [-2.05, -2.25, -1.9],
    walk: [-2.15, -2.35, -2.05],
    atk1: [-0.4, -1.7, LEFT],
    atk2: [-0.3, -1.4, LEFT],
    bow: [UP, UP, UP],
    gun: [LEFT, LEFT, LEFT],
    hit: [1.3, 1.6, 1.9],
    crouch: [-2.0, -1.85, -2.15],
    magic: [-1.3, -1.57, -2.2],
    cheer: [-1.2, -1.5, -1.1],
    dead: [2.6, 2.6, 2.6]
  });

  /* Native bow art already points up. rot is only a small extra tilt. */
  const BOW = pose({
    idle1: [0.04, -0.06, 0.08],
    idle2: [0.02, 0.1, -0.04],
    walk: [0.12, -0.08, 0.04],
    atk1: [0.0, 0.12, 0.0],
    atk2: [0.0, 0.1, 0.0],
    bow: [0.0, 0.16, -0.02],
    gun: [0.0, 0.0, 0.0],
    hit: [0.4, 0.7, 0.9],
    crouch: [0.15, 0.2, 0.1],
    magic: [-0.2, -0.05, 0.1],
    cheer: [-0.15, 0.05, -0.1],
    dead: [-1.5, -1.5, -1.5]
  });

  const GUN = pose({
    idle1: [LEFT, LEFT - 0.08, LEFT + 0.06],
    idle2: [LEFT + 0.04, LEFT - 0.06, LEFT],
    walk: [LEFT + 0.1, LEFT - 0.12, LEFT + 0.02],
    atk1: [LEFT - 0.15, LEFT, LEFT],
    atk2: [LEFT - 0.2, LEFT, LEFT],
    bow: [LEFT, LEFT, LEFT],
    gun: [LEFT - 0.05, LEFT, LEFT],
    hit: [1.6, 1.9, 2.2],
    crouch: [LEFT + 0.15, LEFT + 0.2, LEFT + 0.1],
    magic: [LEFT, LEFT, LEFT],
    cheer: [-1.2, -0.8, -1.4],
    dead: [2.9, 2.9, 2.9]
  });

  /* A staff stands up out of the low fist, and rises with the cast. */
  const STAFF = pose({
    idle1: [-2.15, -2.0, -2.3],
    idle2: [-2.05, -2.25, -1.95],
    walk: [-2.05, -2.25, -1.95],
    atk1: [-1.1, -1.57, -2.35],
    atk2: [-0.9, -1.7, -2.2],
    bow: [UP, UP, UP],
    gun: [LEFT, LEFT, LEFT],
    hit: [1.15, 1.45, 1.75],
    crouch: [-2.0, -1.85, -2.15],
    magic: [-1.9, -2.15, -2.45],
    cheer: [-1.6, -1.3, -1.8],
    dead: [2.7, 2.7, 2.7]
  });

  const BOOK = pose({
    idle1: [-0.35, -0.5, -0.25],
    idle2: [-0.4, -0.25, -0.45],
    walk: [-0.3, -0.55, -0.2],
    atk1: [-0.7, -0.9, -0.5],
    atk2: [-0.6, -0.85, -0.45],
    bow: [-0.2, -0.2, -0.2],
    gun: [0, 0, 0],
    hit: [0.4, 0.6, 0.8],
    crouch: [-0.2, -0.3, -0.15],
    magic: [-0.85, -1.05, -0.7],
    cheer: [-0.6, -0.4, -0.75],
    dead: [0.9, 0.9, 0.9]
  });

  const FIST = pose({
    idle1: [LEFT, LEFT - 0.1, LEFT + 0.08],
    idle2: [LEFT, LEFT + 0.1, LEFT - 0.08],
    walk: [LEFT + 0.1, LEFT - 0.15, LEFT],
    atk1: [-0.6, -1.4, LEFT],
    atk2: [-0.4, 2.2, LEFT],
    bow: [LEFT, LEFT, LEFT],
    gun: [LEFT, LEFT, LEFT],
    hit: [1.2, 1.5, 1.8],
    crouch: [LEFT, LEFT, LEFT],
    magic: [-2.0, -1.8, LEFT],
    cheer: [UP, -1.2, -1.6],
    dead: [2.8, 2.8, 2.8]
  });

  const POSES = {
    sword: SWING,
    katana: SWING,
    axe: SWING,
    mace: SWING,
    scythe: SWING,
    claw: SWING,
    spear: SPEAR,
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
  /* gx, gy is the middle of the handle on the sprite. angle is the drawn
     grip-to-tip direction in degrees (0 right, 90 up). Measured on the png. */
  const SPECS = {
    sword: { w: 13, h: 13, gx: 2, gy: 8, angle: 38 },
    axe: { w: 14, h: 15, gx: 3, gy: 13, angle: 67 },
    mace: { w: 14, h: 16, gx: 6, gy: 13, angle: 76 },
    spear: { w: 7, h: 32, gx: 3, gy: 22, angle: 90 },
    dagger: { w: 14, h: 13, gx: 10, gy: 10, angle: 135 },
    bow: { w: 6, h: 20, gx: 2, gy: 12, angle: 0, native: true },
    crossbow: { w: 18, h: 14, gx: 8, gy: 7, angle: 0, native: true },
    staff: { w: 15, h: 14, gx: 2, gy: 12, angle: 48 },
    staff_wood: { w: 16, h: 16, gx: 2, gy: 13, angle: 48 },
    wand: { w: 8, h: 17, gx: 2, gy: 14, angle: 77 },
    gun: { w: 19, h: 9, gx: 15, gy: 6, angle: 164 },
    fist: { w: 8, h: 7, gx: 3, gy: 3, angle: 0 },
    claw: { w: 14, h: 10, gx: 3, gy: 5, angle: 6 },
    book: { w: 12, h: 14, gx: 6, gy: 12, angle: 0 },
    scythe: { w: 20, h: 16, gx: 2, gy: 13, angle: 38 },
    katana: { w: 20, h: 8, gx: 2, gy: 5, angle: 11 },
    arrow: { w: 11, h: 4, gx: 5, gy: 2, angle: 180, native: true }
  };

  const sprites = {};
  let bundled = null;
  let bundleLeft = 0;
  const bundleWaiters = [];

  function bundleDone() {
    if (bundleLeft > 0) return;
    const waiters = bundleWaiters.splice(0, bundleWaiters.length);
    for (let i = 0; i < waiters.length; i++) waiters[i]();
  }

  function whenReady(fn) {
    if (bundleLeft <= 0) fn();
    else bundleWaiters.push(fn);
  }

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
    if (spec.gx >= 0 && spec.gy >= 0 && spec.gx < spec.w && spec.gy < spec.h) {
      const ink = ctx.getImageData(spec.gx, spec.gy, 1, 1).data;
      if (ink[3] < 40) {
        ctx.fillStyle = "#c4a574";
        ctx.fillRect(spec.gx, spec.gy, 1, 1);
      }
    }
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

  const BAKED_MELEE = { sword: 1, katana: 1, spear: 1, dagger: 1 };

  /* Sword and thrust columns already paint a weapon. Bow and gun columns do
     too, on the sheets that have them. A second sprite stays off. Axe, staff,
     and the other kinds never use those columns: column() sends them to an
     empty-hands row and the class weapon is drawn in the fist. */
  function frameHasWeapon(motion, sheet) {
    if (motion === "bow") return !!(IL.sheetHasBow && IL.sheetHasBow(sheet));
    if (motion === "gun") return !!(IL.sheetHasGun && IL.sheetHasGun(sheet));
    if (motion === "atk1" || motion === "atk2") return !!(sheet && IL.sheetKnown && IL.sheetKnown(sheet));
    return false;
  }

  function column(kind, motion, sheet) {
    if (motion !== "atk1" && motion !== "atk2" && motion !== "bow" && motion !== "gun") return motion || "idle1";
    if ((motion === "atk1" || motion === "atk2") && BAKED_MELEE[kind]) return motion;
    if (kind === "bow" || kind === "crossbow") {
      if (IL.sheetHasBow && IL.sheetHasBow(sheet)) return "bow";
      if (IL.sheetHasGun && IL.sheetHasGun(sheet)) return "gun";
      return "magic";
    }
    if (kind === "gun") {
      if (IL.sheetHasGun && IL.sheetHasGun(sheet)) return "gun";
      if (IL.sheetHasBow && IL.sheetHasBow(sheet)) return "bow";
      return "magic";
    }
    return "magic";
  }

  function shouldPaint(kind, motion, sheet) {
    if (!kind) return false;
    if (debugOn()) return true;
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
    motion = column(kind, motion, sheet);
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
        bundleLeft++;
        img.onload = function () { bundled[kind] = img; bundleLeft--; bundleDone(); };
        img.onerror = function () { bundleLeft--; bundleDone(); };
        img.src = base + manifest.files[kind];
      })(keys[i]);
    }
  }

  function loadManifest(url, base) {
    if (typeof fetch !== "function") return;
    bundleLeft++;
    fetch(url).then(function (res) {
      if (!res.ok) return null;
      return res.json();
    }).then(function (data) {
      if (data) {
        adoptBundle(data, base || url.replace(/[^/]+$/, ""));
        if (data.remote) loadManifest(data.remote, data.remote.replace(/[^/]+$/, ""));
      }
      bundleLeft--;
      bundleDone();
    }).catch(function () { bundleLeft--; bundleDone(); });
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
    whenReady: whenReady,
    column: column,
    shouldPaint: shouldPaint,
    hands: HAND,
    back: BACK,
    specs: SPECS,
    motions: ["idle1", "idle2", "walk", "atk1", "atk2", "bow", "gun", "hit", "crouch", "magic", "cheer", "dead"]
  };

  loadManifest("assets/weapons/manifest.json", "assets/weapons/");
})(typeof window !== "undefined" ? window : globalThis);
