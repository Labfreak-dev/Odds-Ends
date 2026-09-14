/* Gravemark — 18-assets.js
   The art manifest.

   Every piece of art in the game is named here with its exact dimensions and,
   where it moves, its animation states and frame counts. The game NEVER
   references an image path directly — it asks `GM.art(key)` and gets either
   the real asset or a procedurally drawn placeholder. That means art can be
   replaced wholesale by dropping files into art/ and changing nothing else,
   and it means the art brief is generated from this file rather than written
   by hand and drifting out of date (see tools/art-brief.js). */
"use strict";

GM.ART_DIR = "art/";

/* Animation states every animated actor is expected to provide. `loop` says
   whether it cycles; `fps` is the intended playback rate. A missing state
   falls back to `idle`, so partial art sets still run. */
GM.ANIM_STATES = [
  { id: "idle",   frames: 6,  fps: 8,  loop: true,  note: "breathing / weapon at rest" },
  { id: "walk",   frames: 8,  fps: 12, loop: true,  note: "full stride cycle, contact-down-pass-up x2" },
  { id: "run",    frames: 8,  fps: 16, loop: true,  note: "faster stride, longer extension, more lean" },
  { id: "attack", frames: 8,  fps: 14, loop: false, note: "wind-up, strike on frame 4, recovery" },
  { id: "cast",   frames: 8,  fps: 12, loop: false, note: "gather on 1-4, release on 5, settle" },
  { id: "hit",    frames: 3,  fps: 14, loop: false, note: "flinch back and recover" },
  { id: "death",  frames: 8,  fps: 10, loop: false, note: "collapse; final frame rests on the ground" }
];

/* The character is drawn as a stack of layers in this order. Every equipped
   item contributes one layer, so gear is visible on the body — the paper-doll
   the art brief has to cover slot by slot. */
GM.DOLL_LAYERS = [
  { id: "back",    z: 0,  slot: "offhand", note: "slung shield / tome, behind the body" },
  { id: "body",    z: 10, slot: null,      note: "the bare character; every other layer aligns to this" },
  { id: "boots",   z: 20, slot: "boots" },
  { id: "legs",    z: 25, slot: "body",    note: "lower half of the body armour" },
  { id: "chest",   z: 30, slot: "body",    note: "upper half of the body armour" },
  { id: "belt",    z: 35, slot: "belt" },
  { id: "gloves",  z: 40, slot: "gloves" },
  { id: "helm",    z: 50, slot: "helm" },
  { id: "weapon",  z: 60, slot: "weapon",  note: "held at the grip point; follows the attack arc" },
  { id: "offhand", z: 55, slot: "offhand", note: "when actively held rather than slung" },
  { id: "fx",      z: 70, slot: null,      note: "element tint, crit flash, leech motes" }
];

/* Grip anchors, in fractions of the frame, so a weapon sprite lands in the
   hand regardless of which body art is loaded. */
GM.DOLL_ANCHORS = {
  gripMain: { x: 0.62, y: 0.52 },
  gripOff:  { x: 0.34, y: 0.55 },
  head:     { x: 0.50, y: 0.22 },
  feet:     { x: 0.50, y: 0.96 }
};

GM.ART_SIZES = {
  actor:    { w: 256, h: 256 },  /* character and monsters */
  boss:     { w: 384, h: 320 },
  icon:     { w: 64,  h: 64 },   /* item, rune, resource, tab icons */
  frame:    { w: 96,  h: 96 },   /* rarity frames, socket plates */
  bg:       { w: 1280, h: 720 }, /* realm backdrops */
  button:   { w: 192, h: 56 },
  panel:    { w: 512, h: 512 }   /* nine-slice panel skins */
};

/* ---------- the manifest -------------------------------------------------
   Built programmatically from the game data so it cannot fall out of sync:
   add a monster to 03-data-world.js and its art keys appear here. */
GM.ART = (function () {
  var out = [];

  function add(key, kind, size, meta) {
    out.push(GM.assign({ key: key, kind: kind, w: size.w, h: size.h }, meta || {}));
  }

  /* --- UI chrome --- */
  ["panel", "panel-inset", "panel-raised", "header-bar", "footer-bar"].forEach(function (k) {
    add("ui/" + k, "nineslice", GM.ART_SIZES.panel, { nineslice: 24 });
  });
  ["normal", "hover", "pressed", "disabled"].forEach(function (st) {
    add("ui/button-" + st, "nineslice", GM.ART_SIZES.button, { nineslice: 16, state: st });
  });
  ["progress-track", "progress-fill-hp", "progress-fill-mhp", "progress-fill-xp"].forEach(function (k) {
    add("ui/" + k, "nineslice", { w: 256, h: 32 }, { nineslice: 8 });
  });

  /* --- resource and stat icons --- */
  ["gold", "shards", "ichor", "marks", "dust", "epitaph", "rune", "level", "depth"]
    .forEach(function (k) { add("icon/res-" + k, "icon", GM.ART_SIZES.icon); });

  GM.ELEMENTS.forEach(function (e) {
    add("icon/elem-" + e, "icon", GM.ART_SIZES.icon, { label: GM.ELEM_META[e].label });
  });

  /* --- tabs --- */
  ["delve", "gear", "bench", "tree", "town", "graves", "modes", "ascend"]
    .forEach(function (k) { add("icon/tab-" + k, "icon", GM.ART_SIZES.icon); });

  /* --- rarity frames and sockets --- */
  GM.RARITIES.forEach(function (r) {
    add("frame/rarity-" + r.key, "nineslice", GM.ART_SIZES.frame, { nineslice: 12, label: r.name });
  });
  add("frame/socket-empty", "icon", { w: 32, h: 32 });
  add("frame/socket-filled", "icon", { w: 32, h: 32 });

  /* --- item icons: one per base family per tier band (low/mid/high) --- */
  var families = {};
  GM.BASES.forEach(function (b) { families[b.family] = b; });
  Object.keys(families).forEach(function (fam) {
    ["low", "mid", "high"].forEach(function (band) {
      add("item/" + fam + "-" + band, "icon", GM.ART_SIZES.icon, {
        label: families[fam].kindLabel + " (" + band + " tier)",
        pool: families[fam].pool
      });
    });
  });

  /* --- rune glyphs --- */
  GM.RUNES.forEach(function (r) {
    add("rune/" + r.id, "icon", { w: 48, h: 48 }, { label: r.name + " rune" });
  });

  /* --- the character: body + every animation state --- */
  GM.ANIM_STATES.forEach(function (a) {
    add("actor/hero-" + a.id, "sheet", GM.ART_SIZES.actor, {
      frames: a.frames, fps: a.fps, loop: a.loop, note: a.note, facing: "right"
    });
  });
  /* Weapon-specific attack swings — a maul does not swing like a dagger. */
  ["dagger", "sword", "maul", "wand", "scythe"].forEach(function (fam) {
    add("actor/hero-attack-" + fam, "sheet", GM.ART_SIZES.actor, {
      frames: 8, fps: 14, loop: false, facing: "right",
      note: "attack swing specific to the " + fam + " family"
    });
  });

  /* --- paper-doll gear layers: every slot, every family, every tier band --- */
  GM.DOLL_LAYERS.forEach(function (layer) {
    if (!layer.slot) return;
    var pool = GM.slotPool(layer.slot);
    var fams = {};
    GM.BASES.forEach(function (b) { if (b.pool === pool) fams[b.family] = b; });
    Object.keys(fams).forEach(function (fam) {
      ["low", "mid", "high"].forEach(function (band) {
        add("doll/" + layer.id + "-" + fam + "-" + band, "sheet", GM.ART_SIZES.actor, {
          frames: 8, fps: 14, loop: false, layer: layer.id, z: layer.z, slot: layer.slot,
          note: "gear layer, must align frame-for-frame with actor/hero-* sheets"
        });
      });
    });
  });

  /* --- monsters --- */
  GM.MONSTERS.forEach(function (m) {
    ["idle", "attack", "hit", "death"].forEach(function (st) {
      var a = GM.byId(GM.ANIM_STATES, st) || { frames: 6, fps: 10, loop: true };
      add("mon/" + m.id + "-" + st, "sheet", GM.ART_SIZES.actor, {
        frames: a.frames, fps: a.fps, loop: a.loop, facing: "left", label: m.name,
        elem: m.elem
      });
    });
  });

  /* --- bosses --- */
  GM.BOSSES.forEach(function (b) {
    ["idle", "attack", "special", "death"].forEach(function (st) {
      add("boss/" + b.id + "-" + st, "sheet", GM.ART_SIZES.boss, {
        frames: st === "special" ? 12 : 8, fps: 12, loop: st === "idle",
        facing: "left", label: b.name, elem: b.elem
      });
    });
  });

  /* --- the revenant: the player's own corpse, wearing their old kit --- */
  ["idle", "attack", "hit", "death"].forEach(function (st) {
    add("actor/revenant-" + st, "sheet", GM.ART_SIZES.actor, {
      frames: 8, fps: 11, loop: st === "idle", facing: "left",
      note: "silhouette must read as the hero, corrupted"
    });
  });

  /* --- backdrops --- */
  GM.REALMS.forEach(function (r) {
    add("bg/realm-" + r.n, "image", GM.ART_SIZES.bg, { label: r.name, flavour: r.flavour });
  });
  ["town", "tower", "dimension", "finality", "graveyard", "title"].forEach(function (k) {
    add("bg/" + k, "image", GM.ART_SIZES.bg);
  });

  return out;
})();

GM.ART_BY_KEY = (function () {
  var m = Object.create(null);
  for (var i = 0; i < GM.ART.length; i++) m[GM.ART[i].key] = GM.ART[i];
  return m;
})();

/* ---------- loading and placeholders -------------------------------------
   Real art is opt-in: anything present in art/ is used, anything missing is
   drawn procedurally. The game is fully playable with zero image files. */
var _artCache = Object.create(null);
var _artMissing = Object.create(null);

GM.artURL = function (key) { return GM.ART_DIR + key + ".png"; };

GM.art = function (key) {
  if (_artCache[key]) return _artCache[key];
  var spec = GM.ART_BY_KEY[key];
  if (!spec) return null;
  if (_artMissing[key]) return null;

  if (typeof Image === "undefined") return null;
  var img = new Image();
  img.onerror = function () {
    /* Record and stop asking — a 404 per frame would flood the console. */
    _artMissing[key] = true;
    delete _artCache[key];
  };
  img.src = GM.artURL(key);
  _artCache[key] = img;
  return img;
};

GM.artReady = function (key) {
  var img = _artCache[key];
  return !!(img && img.complete && img.naturalWidth > 0);
};

/* Deterministic placeholder colour, so the same key is always the same shade
   and the eye can still tell two monsters apart before any art exists. */
GM.placeholderHue = function (key) { return GM.hash(key) % 360; };

/* Draw a labelled placeholder into a 2d context. Used by the fight view and
   the item grid until real art lands. */
GM.drawPlaceholder = function (ctx, key, x, y, w, h, opts) {
  opts = opts || {};
  var hue = GM.placeholderHue(key);
  /* `label` is overloaded: a string overrides the caption, `false` suppresses
     it, and `true`/absent means "use the manifest's own label". Reading it as
     text unconditionally is how every monster ended up captioned "true". */
  var label = typeof opts.label === "string"
    ? opts.label
    : (GM.ART_BY_KEY[key] && GM.ART_BY_KEY[key].label) || key.split("/").pop();

  ctx.save();
  ctx.fillStyle = "hsla(" + hue + ",34%," + (opts.dark ? 18 : 26) + "%,1)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "hsla(" + hue + ",46%,52%,0.85)";
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);

  /* A diagonal hatch so a placeholder never reads as finished art. */
  ctx.globalAlpha = 0.13;
  ctx.beginPath();
  for (var i = -h; i < w; i += 12) {
    ctx.moveTo(x + i, y + h);
    ctx.lineTo(x + i + h, y);
  }
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.globalAlpha = 1;

  if (opts.label !== false && w >= 48) {
    ctx.fillStyle = "hsla(" + hue + ",60%,84%,0.95)";
    ctx.font = Math.max(9, Math.min(13, Math.floor(w / 9))) + "px ui-monospace,Menlo,Consolas,monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    var text = label.length > 18 ? label.slice(0, 17) + "…" : label;
    ctx.fillText(text, x + w / 2, y + h / 2);
  }
  ctx.restore();
};

/* Draw one frame of an animated key, falling back to the placeholder. */
GM.drawSprite = function (ctx, key, frame, x, y, w, h, opts) {
  var spec = GM.ART_BY_KEY[key];
  if (spec && GM.artReady(key)) {
    var img = _artCache[key];
    var n = spec.frames || 1;
    var fw = img.naturalWidth / n;
    var f = ((frame | 0) % n + n) % n;
    ctx.drawImage(img, f * fw, 0, fw, img.naturalHeight, x, y, w, h);
    return true;
  }
  GM.drawPlaceholder(ctx, key, x, y, w, h, opts);
  return false;
};

/* Which tier band a base falls in, for picking an item/doll art key. */
GM.tierBand = function (tier) { return tier <= 3 ? "low" : tier <= 6 ? "mid" : "high"; };

GM.itemArtKey = function (item) {
  var b = GM.BASE_BY_ID[item.baseId];
  if (!b) return "item/sword-low";
  return "item/" + b.family + "-" + GM.tierBand(b.tier);
};

GM.dollKeyFor = function (layerId, slot) {
  var it = GM.state.equip[slot];
  if (!it) return null;
  var b = GM.BASE_BY_ID[it.baseId];
  if (!b) return null;
  return "doll/" + layerId + "-" + b.family + "-" + GM.tierBand(b.tier);
};

/* Coverage, for the art brief and for a quick "how much is left" answer. */
GM.artStats = function () {
  var total = GM.ART.length, have = 0, byKind = {};
  for (var i = 0; i < GM.ART.length; i++) {
    var a = GM.ART[i];
    byKind[a.kind] = (byKind[a.kind] || 0) + 1;
    if (GM.artReady(a.key)) have++;
  }
  return { total: total, have: have, byKind: byKind };
};
