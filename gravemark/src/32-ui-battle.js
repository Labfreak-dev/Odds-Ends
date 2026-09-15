/* Gravemark — 32-ui-battle.js
   The centre column: one panel per squad, all three live at once.

   Panel chrome is built ONCE and then only its numbers are written each frame.
   Rebuilding three panels of DOM at 60fps would spend the whole frame budget
   in layout; the canvas is the only thing that redraws wholesale. */
"use strict";

var panels = {};        /* squadId -> { root, refs..., ctx, floaters } */

/* ---------- construction ------------------------------------------------- */
function buildPanel(sq) {
  var root = GM.el("div", "bpanel");
  root.dataset.squad = sq.id;

  var stage = GM.el("div", "bstage");
  var canvas = GM.el("canvas");
  stage.appendChild(canvas);

  var head = GM.el("div", "bhead");
  head.innerHTML =
    '<span class="flag"><span class="pin">⚑</span><span class="fname">—</span></span>' +
    '<button class="bsound" title="Mute this squad">\u{1F50A}</button>' +
    '<span class="bhp"><span class="f"></span></span>' +
    '<span class="bctl">' +
      '<label class="bauto"><input type="checkbox" checked>Auto</label>' +
      '<button class="btn sm pink bset">Settings</button>' +
      '<button class="btn sm bstats">Stats</button>' +
    "</span>";

  var foot = GM.el("div", "bfoot");
  foot.innerHTML =
    '<span class="squadbar">' +
      '<span class="sb"><span class="f"></span></span>' +
      '<span class="pips"></span>' +
    "</span>" +
    '<button class="btn sm bretreat">Retreat ⤷</button>';

  stage.appendChild(head);
  stage.appendChild(foot);
  root.appendChild(stage);

  var refs = {
    root: root, stage: stage, canvas: canvas, ctx: canvas.getContext("2d"),
    fname: GM.$(".fname", head),
    packFill: GM.$(".bhp .f", head),
    auto: GM.$(".bauto input", head),
    sound: GM.$(".bsound", head),
    setBtn: GM.$(".bset", head),
    statBtn: GM.$(".bstats", head),
    sqFill: GM.$(".squadbar .sb .f", foot),
    pips: GM.$(".pips", foot),
    retreat: GM.$(".bretreat", foot),
    vic: null,
    floaters: [],
    lastHp: {}
  };

  GM.on(refs.auto, "change", function () {
    sq.running = refs.auto.checked;
    GM.bus.emit("squads:changed");
  });
  GM.on(refs.retreat, "click", function () { GM.manualRetreat(sq); });
  GM.on(refs.setBtn, "click", function () { GM.ui.openOverlay("squad", sq.id); });
  GM.on(refs.statBtn, "click", function () { GM.ui.openOverlay("squadstats", sq.id); });
  GM.on(refs.sound, "click", function () {
    sq.muted = !sq.muted;
    refs.sound.textContent = sq.muted ? "\u{1F507}" : "\u{1F50A}";
  });

  panels[sq.id] = refs;
  return root;
}

GM.ui.buildBattles = function () {
  var host = GM.$("#battles");
  if (!host) return;
  host.innerHTML = "";
  panels = {};
  (GM.state.squads || []).forEach(function (sq) {
    host.appendChild(buildPanel(sq));
  });
};

/* ---------- per-frame numbers -------------------------------------------- */
GM.ui.renderBattles = function () {
  (GM.state.squads || []).forEach(function (sq) {
    var p = panels[sq.id];
    if (!p) return;
    var heroes = GM.squadHeroes(sq);
    var empty = heroes.length === 0;
    p.root.classList.toggle("empty", empty);

    var stage = GM.squadStage(sq);
    var realm = GM.realmInfo(GM.realmOf(stage));
    var modeDef = GM.MODE_BY_ID[sq.mode];
    var label = realm.name + "-" + GM.floorOf(stage);
    if (sq.mode === "tower") label = "Divine Tower-" + (sq.towerRun || 1);
    if (sq.mode === "finality") label = "Finality-" + (sq.wave || 1);
    if (sq.mode === "vigil") label = "Vigil-" + stage;
    if (empty) label = sq.name + " · no one assigned";
    else if (sq.holding) label += " · holding";
    else if (sq.push) label += " · pushing";
    p.fname.textContent = label;

    if (p.auto.checked !== !!sq.running) p.auto.checked = !!sq.running;

    /* The top bar is progress through the DEPTH, not the current pack: the
       pack already has its own life bars under each monster, and what the
       player actually wants to know is how close the squad is to advancing. */
    var per = GM.CURVE.packsPerStage;
    var prog = sq.mode === "expedition" ? ((sq.clears || 0) / per) : 0;
    if (sq.mode !== "expedition") {
      var alive = 0, maxHp = 0;
      for (var i = 0; i < (sq.monsters || []).length; i++) {
        alive += Math.max(0, sq.monsters[i].hp);
        maxHp += sq.monsters[i].hpMax;
      }
      prog = maxHp > 0 ? 1 - alive / maxHp : 0;
    }
    p.packFill.style.width = (GM.clamp(prog, 0, 1) * 100).toFixed(1) + "%";

    p.sqFill.style.width = sq.hpMax > 0 ? (GM.clamp(sq.hp / sq.hpMax, 0, 1) * 100).toFixed(1) + "%" : "0%";

    /* class pips: one per member, coloured by class, dimmed if the squad is
       in trouble. Cheap to rebuild because a squad is at most five. */
    var want = heroes.map(function (h) { return h.id; }).join(",");
    if (p.pipKey !== want) {
      p.pipKey = want;
      p.pips.innerHTML = "";
      heroes.forEach(function (h) {
        var cls = GM.heroClass(h);
        var letter = { warden: "w", reaver: "r", pyre: "p", stalker: "s", sexton: "x" }[cls.id] || "w";
        var pip = GM.el("span", "pip " + letter, h.name.charAt(0));
        pip.dataset.tip = "hero:" + h.id;
        p.pips.appendChild(pip);
      });
    }

    syncVictory(sq, p);
  });
};

function syncVictory(sq, p) {
  if (sq.victory) {
    if (!p.vic) {
      p.vic = GM.el("div", "vic");
      p.stage.appendChild(p.vic);
    }
    var v = sq.victory;
    var haul = v.haul || {};
    p.vic.innerHTML =
      "<h3>The squad holds the ground.</h3>" +
      '<div class="vicrow"><span>Time used <b>' + GM.fmtTime(v.time) + "</b></span>" +
      "<span>Killed <b>" + GM.fmt(v.kills) + "</b></span>" +
      "<span>Depth <b>" + v.stage + "</b></span></div>" +
      '<div class="vicloot">' +
        lootCell("◉", haul.gold) + lootCell("◆", haul.shards) +
      "</div>";
    var b = GM.el("button", "btn primary", "Leave (" + Math.max(0, Math.ceil(v.hold)) + ")");
    GM.on(b, "click", function () { GM.leaveVictory(sq); });
    p.vic.appendChild(b);
  } else if (p.vic) {
    p.vic.parentNode.removeChild(p.vic);
    p.vic = null;
  }
}

function lootCell(glyph, n) {
  if (!n) return "";
  return '<span class="lootcell"><i>' + glyph + "</i>" + GM.fmt(n) + "</span>";
}

/* ---------- the canvas ---------------------------------------------------
   Every figure on a panel is an ACTOR: an animator plus a little state (swing
   timer, flash, facing). Actors are created lazily and thrown away when the
   pack they belong to is gone, so a panel never accumulates ghosts.

   Two drawing modes, chosen per actor every frame:
     RIG    — the character has a complete set of parts in art/; bones carry
              them. Also forced by GM.RIG_DEBUG, which draws capsule bones so
              the motion can be judged before any parts exist.
     SPRITE — otherwise. The whole-figure painting is driven by the root bone
              (lunge, squash, lean, bob). Same animations, less fidelity. */
GM.RIG_DEBUG = false;

var lastFrame = 0;

function fit(p) {
  var r = p.stage.getBoundingClientRect();
  var dpr = Math.min(2, window.devicePixelRatio || 1);
  var w = Math.max(1, Math.floor(r.width * dpr));
  var h = Math.max(1, Math.floor(r.height * dpr));
  if (p.canvas.width !== w || p.canvas.height !== h) { p.canvas.width = w; p.canvas.height = h; }
}

function ensurePanelState(p) {
  if (!p.vfx) p.vfx = new GM.Vfx.Panel();
  if (!p.actors) p.actors = {};
  if (!p.monActors) p.monActors = {};
}

function heroActor(p, hero, now) {
  var a = p.actors[hero.id];
  if (!a) {
    a = p.actors[hero.id] = {
      id: hero.id, kind: "hero", facing: "right",
      anim: new GM.Rig.Animator("hero"),
      swingT: GM.rng() * 0.8, flashUntil: 0, hue: GM.heroClass(hero).hue
    };
    a.anim.onEvent = function (name) { onHeroEvent(p, a, name); };
  }
  a.hero = hero;
  a.hue = GM.heroClass(hero).hue;
  /* which parts set and weapon the rig wears: fixed by the class */
  a.weaponFam = GM.classWeapon(hero).fam;
  a.partsId = GM.heroPartsId(hero);
  a.spriteKey = (function () {
    var look = GM.heroLookKey(hero);
    return (look && GM.artReady(look)) ? look : "actor/hero-idle";
  })();
  return a;
}

function monActor(p, mon, index, now) {
  var key = index + ":" + mon.id + ":" + (mon.hpMax | 0);
  var a = p.monActors[key];
  if (!a) {
    var charId = mon.kind === "revenant" ? "revenant" : mon.id.replace(/_c\d+$/, "");
    a = p.monActors[key] = {
      id: key, kind: "mon", facing: "left", charId: charId, partsId: charId,
      anim: new GM.Rig.Animator(charId),
      swingT: GM.rng() * 1.2, cadence: 1.05 + (GM.hash(key) % 60) / 100,
      flashUntil: 0, hue: 0, diedAt: 0
    };
    a.anim.onEvent = function (name) { onMonEvent(p, a, name); };
    a.spriteKey = mon.kind === "revenant" ? "actor/revenant-idle"
                : mon.kind === "boss" ? "boss/" + charId + "-idle"
                : "mon/" + charId + "-idle";
    if (!GM.ART_BY_KEY[a.spriteKey]) a.spriteKey = "mon/shambler-idle";
  }
  a.mon = mon;
  return a;
}

/* ---------- events: where the feel lives --------------------------------- */
function onHeroEvent(p, a, name) {
  if (name !== "hit") return;
  var sq = p.sq, st = a.hero ? GM.heroStats(a.hero, GM.squadCtx(sq)) : null;
  var front = null, fi = -1;
  for (var i = 0; i < (sq.monsters || []).length; i++) {
    if (sq.monsters[i].hp > 0) { front = sq.monsters[i]; fi = i; break; }
  }
  if (!front || !st) return;

  /* Per-swing damage is this hero's share of the squad's rate against this
     monster's resistances — an honest number, not a random one. */
  var sst = GM.squadStats(sq, GM.squadCtx(sq));
  var ratio = sst.dps > 0 ? GM.dpsAgainst(sst, front) / sst.dps : 1;
  var perHit = st.dps / Math.max(0.2, st.attackSpeed) * ratio / Math.max(1e-6, st.critFactor);
  var crit = GM.chance(st.crit);
  if (crit) perHit *= st.critMulti;

  var m = p.monActors[fi + ":" + front.id + ":" + (front.hpMax | 0)];
  var pos = m && m.pos ? m.pos : { x: p.canvas.width * 0.6, y: p.canvas.height * 0.5 };
  p.vfx.number(pos.x, pos.y - p.canvas.height * 0.25, GM.fmt(perHit), crit ? "crit" : "");
  p.vfx.burst(pos.x, pos.y - p.canvas.height * 0.28, "hit", crit ? 16 : 9);
  p.vfx.flashShake(crit ? p.canvas.height * 0.018 : p.canvas.height * 0.008);
  if (m) {
    m.flashUntil = performance.now() + 90;
    if (!m.anim.dead && m.anim.clip === "idle") m.anim.play("hit");
  }
}

function onMonEvent(p, a, name) {
  if (name !== "hit") return;
  var sq = p.sq;
  var sst = GM.squadStats(sq, GM.squadCtx(sq));
  var per = GM.incomingDps(sst, a.mon) * a.cadence;
  if (per < 0.5) return;
  var hx = p.canvas.width * 0.16, hy = p.canvas.height * 0.45;
  p.vfx.number(hx, hy, "-" + GM.fmt(per), "bad");
  p.vfx.flashShake(p.canvas.height * 0.006);
  for (var id in p.actors) {
    var h = p.actors[id];
    h.flashUntil = performance.now() + 70;
    if (!h.anim.dead && h.anim.clip === "idle" && GM.chance(0.35)) h.anim.play("hit");
  }
}

/* ---------- drawing an actor --------------------------------------------- */
function drawCapsule(ctx, x1, y1, x2, y2, width, hue, dark) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineWidth = width;
  ctx.strokeStyle = dark ? "hsl(" + hue + ",30%,18%)" : "hsl(" + hue + ",40%,38%)";
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.lineWidth = Math.max(1, width - 4);
  ctx.strokeStyle = dark ? "hsl(" + hue + ",34%,26%)" : "hsl(" + hue + ",46%,52%)";
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.restore();
}

/* One painted part hung from its bone: translate to the pivot, rotate by the
   bone's delta from rest, draw with the manifest pivot at the origin. Shared
   by rig mode and by the weapon overlay in sprite mode. */
function drawPartImage(ctx, b, partKey, scale, flash) {
  var spec = GM.ART_BY_KEY[partKey], img = GM.art(partKey);
  var px = (b.x - 128) * scale, py = (b.y - 246) * scale;
  var rad = (b.angle - b.bone.a) * Math.PI / 180;
  var w = spec.w / 2 * scale, h = spec.h / 2 * scale;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(rad);
  ctx.scale(b.sx, b.sy);
  ctx.drawImage(img, -spec.pivot.x * w, -spec.pivot.y * h, w, h);
  if (flash) {
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.7;
    ctx.drawImage(img, -spec.pivot.x * w, -spec.pivot.y * h, w, h);
  }
  ctx.restore();
}

/* The weapon key for a humanoid actor: the hero's equipped family, sword by
   default. Shared parts, so not keyed by character. */
function weaponKey(a) {
  return "parts/weapon/" + (a.weaponFam || "sword");
}

function drawRigMode(ctx, p, a, scale, now) {
  var posed = a.anim.pose();
  var flash = a.flashUntil > now;
  for (var i = 0; i < posed.length; i++) {
    var b = posed[i], bone = b.bone;
    if (!bone.part) continue;
    var px = (b.x - 128) * scale, py = (b.y - 246) * scale;
    var rad = (b.angle - bone.a) * Math.PI / 180;
    var partKey = bone.id === "weapon" ? weaponKey(a) : "parts/" + a.partsId + "/" + bone.id;
    var spec = GM.ART_BY_KEY[partKey];

    if (spec && GM.artReady(partKey)) {
      drawPartImage(ctx, b, partKey, scale, flash);
    } else {
      /* placeholder bone: a capsule from pivot along the bone */
      var arad = b.angle * Math.PI / 180;
      var ex = px + Math.cos(arad) * bone.len * scale * b.sx;
      var ey = py + Math.sin(arad) * bone.len * scale * b.sx;
      var dark = /_b$|bb$|fb$/.test(bone.id);
      if (bone.id === "head") {
        ctx.save();
        ctx.fillStyle = "hsl(" + a.hue + ",40%,44%)";
        ctx.beginPath(); ctx.arc((px + ex) / 2, (py + ey) / 2, bone.w * scale * 0.5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      } else {
        drawCapsule(ctx, px, py, ex, ey, (bone.w || 10) * scale, a.hue, dark);
      }
      if (flash) {
        ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.5;
        drawCapsule(ctx, px, py, ex, ey, (bone.w || 10) * scale, 0, false);
        ctx.restore();
      }
    }
  }
  return GM.Rig.tip(posed, a.anim.rig.id === "humanoid" ? "weapon" : "head");
}

/* If a delivered sheet exists for this clip (actor/hero-attack-sword with
   three real poses, say), pick the frame by clip progress. The root motion
   still applies on top, so delivered key poses and the engine's lunge and
   squash compound rather than compete. */
function sheetFor(a) {
  var clip = a.anim.clip;
  var base = a.kind === "hero" ? "actor/hero-" : null;
  if (!base) return null;
  var key = base + clip.replace("_", "-");
  if (!GM.ART_BY_KEY[key] || !GM.artReady(key)) return null;
  var img = GM.art(key), spec = GM.ART_BY_KEY[key];
  var n = Math.max(1, Math.round(img.naturalWidth / spec.w));
  if (n < 2) return null;
  return { key: key, frame: Math.min(n - 1, Math.floor(Math.min(0.999, a.anim.t) * n)) };
}

function drawSpriteMode(ctx, p, a, size, scale, now) {
  var m = a.anim.spriteMotion();
  var sheet = sheetFor(a);
  var key = sheet ? sheet.key : a.spriteKey;
  var frame = sheet ? sheet.frame : 0;
  ctx.save();
  ctx.translate(m.x * scale, m.y * scale);
  /* a delivered death pose already lies down; do not also tip it over */
  ctx.rotate((sheet && a.anim.clip === "death" ? 0 : m.lean * 0.6) * Math.PI / 180);
  ctx.scale(m.sx, m.sy);
  var x = -size / 2, y = -size * 0.96;
  if (a.kind === "hero" && key.indexOf("actor/look-") !== 0) {
    /* the shared hero painting is tinted to the class; a class's own look is
       already the class and is drawn as painted */
    GM.drawTinted(ctx, key, a.hue, frame, x, y, size, size, { label: false, strength: 0.26 });
  } else {
    GM.drawSprite(ctx, key, frame, x, y, size, size, { label: true });
  }
  if (a.flashUntil > now) GM.Vfx.drawFlash(ctx, key, frame, x, y, size, size);
  ctx.restore();
  /* The rig runs whether or not it is drawn, so the weapon tip is always
     known — that is what makes the trail arc even on a flat painting. */
  var posed = a.anim.pose();
  /* A delivered weapon rides the invisible rig's hand over the painting, so
     the swing the trail already follows carries the real blade too. Only
     while a swing is in flight: at rest the painting's own hands hold it. */
  if (a.anim.rig.id === "humanoid" && /^attack/.test(a.anim.clip) && GM.artReady(weaponKey(a))) {
    for (var i = 0; i < posed.length; i++) {
      if (posed[i].bone.id === "weapon") { drawPartImage(ctx, posed[i], weaponKey(a), scale, a.flashUntil > now); break; }
    }
  }
  return GM.Rig.tip(posed, a.anim.rig.id === "humanoid" ? "weapon" : "head");
}

function drawActor(ctx, p, a, fx, fy, size, now) {
  var scale = size / 256;
  /* Paintings are stored facing the way their manifest entry says (heroes
     right, monsters left); the rig is authored facing right. Flip only when
     what is drawn faces the other way from where the actor looks. */
  var rigMode = GM.RIG_DEBUG || GM.partsReady(a.partsId, a.anim.rig.id);
  var artFacing = rigMode ? "right" : ((GM.ART_BY_KEY[a.spriteKey] || {}).facing || "right");
  var left = a.facing !== artFacing;
  ctx.save();
  ctx.translate(fx, fy);
  if (left) ctx.scale(-1, 1);
  var tip = rigMode ? drawRigMode(ctx, p, a, scale, now) : drawSpriteMode(ctx, p, a, size, scale, now);
  ctx.restore();

  /* remember where this actor stands, for numbers and bursts */
  a.pos = { x: fx, y: fy };

  /* trail only while swinging */
  if (tip && /^attack/.test(a.anim.clip)) {
    var tx = rigMode ? (tip.x - 128) * scale : (tip.x - 128) * scale;
    var ty = rigMode ? (tip.y - 246) * scale : (tip.y - 246) * scale;
    p.vfx.trail(a.id, fx + (left ? -tx : tx), fy + ty, now);
  }
}

/* ---------- the per-frame pass ------------------------------------------- */
GM.ui.drawBattles = function (now) {
  var dt = lastFrame ? Math.min(0.05, (now - lastFrame) / 1000) : 1 / 60;
  lastFrame = now;

  (GM.state.squads || []).forEach(function (sq) {
    var p = panels[sq.id];
    if (!p || !p.ctx) return;
    p.sq = sq;
    ensurePanelState(p);
    fit(p);
    var ctx = p.ctx, w = p.canvas.width, h = p.canvas.height;
    ctx.clearRect(0, 0, w, h);

    var stage = GM.squadStage(sq);
    var bgKey = sq.mode === "tower" ? "bg/tower"
              : sq.mode === "dimension" ? "bg/dimension"
              : sq.mode === "finality" ? "bg/finality"
              : sq.mode === "vigil" ? "bg/graveyard"
              : "bg/realm-" + Math.min(GM.realmOf(stage), GM.REALMS.length);

    var shake = p.vfx.shakeOffset(now);
    ctx.save();
    ctx.translate(shake.x, shake.y);

    GM.drawCover(ctx, bgKey, -4, -4, w + 8, h + 8, 1, { label: false, dark: true });
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = "#04060a";
    ctx.fillRect(-4, h * 0.84, w + 8, h * 0.2);
    ctx.restore();

    var ground = h * 0.9;
    /* Figures are the point of the panel: as tall as the stage allows, capped
       by width so five heroes and six monsters still fit across it. */
    var size = Math.min(h * 0.8, w * 0.21);
    var ctxm = GM.squadCtx(sq);

    /* pack change => monster actors are stale */
    if (p.packRef !== sq.monsters) { p.packRef = sq.monsters; p.monActors = {}; }

    /* revive heroes after a wipe once the death has played out */
    if (p.reviveAt && now > p.reviveAt) {
      p.reviveAt = 0;
      for (var hid in p.actors) p.actors[hid].anim = new GM.Rig.Animator("hero"),
        p.actors[hid].anim.onEvent = (function (a) { return function (n) { onHeroEvent(p, a, n); }; })(p.actors[hid]);
    }

    var heroes = GM.squadHeroes(sq);
    var frontAlive = (sq.monsters || []).some(function (m) { return m.hp > 0; });

    /* --- heroes --- */
    for (var i = 0; i < heroes.length; i++) {
      var hero = heroes[i];
      var a = heroActor(p, hero, now);
      var st = GM.heroStats(hero, ctxm);
      var jitter = GM.hash(hero.id);
      var hs = size * (0.90 + ((jitter % 17) / 17) * 0.20);
      var hx = w * 0.06 + i * size * 0.60 + hs / 2;
      var hy = ground + ((jitter >>> 5) % 7) / 7 * (h * 0.03);

      if (!a.anim.dead) {
        a.swingT += dt;
        var period = 1 / Math.max(0.2, st.attackSpeed);
        if (frontAlive && sq.running && !sq.victory && a.swingT >= period && a.anim.clip === "idle") {
          a.swingT = 0;
          var clip = GM.Rig.attackFor("hero", a.weaponFam);
          var dur = GM.Rig.anims[clip].dur;
          a.anim.play(clip, Math.max(1, dur / period));
        }
      }
      a.anim.update(dt);
      drawActor(ctx, p, a, hx, hy, hs, now);
    }

    /* --- the pack --- */
    var mons = sq.monsters || [];
    for (i = 0; i < mons.length; i++) {
      var m = mons[i];
      var ma = monActor(p, m, i, now);
      var big = m.kind === "boss" ? 1.3 : m.kind === "revenant" ? 1.15 : 1;
      var ms = size * big;
      var mx = w * 0.52 + i * size * 0.56 + ms / 2;
      if (mx > w - ms * 0.35) mx = w - ms * 0.35;

      if (m.hp <= 0) {
        if (!ma.anim.dead) {
          ma.anim.play("death");
          ma.diedAt = now;
          p.vfx.burst(mx, ground - ms * 0.3, "death");
        }
        /* linger on the ground, then fade out of the draw */
        if (ma.anim.done && now - ma.diedAt > 1800) continue;
      } else if (!ma.anim.dead && sq.running && !sq.victory && heroes.length) {
        ma.swingT += dt;
        if (ma.swingT >= ma.cadence && ma.anim.clip === "idle") {
          ma.swingT = 0;
          ma.anim.play(GM.Rig.attackFor(ma.charId));
        }
      }
      ma.anim.update(dt);

      if (ma.anim.done) { ctx.save(); ctx.globalAlpha = Math.max(0, 1 - (now - ma.diedAt - 1000) / 800); }
      drawActor(ctx, p, ma, mx, ground, ms, now);
      if (ma.anim.done) ctx.restore();

      if (m.hp > 0) {
        var frac = GM.clamp(m.hp / m.hpMax, 0, 1);
        var bw = ms * 0.42, bx = mx - bw / 2, by = ground + 3;
        ctx.fillStyle = "rgba(0,0,0,.72)";
        ctx.fillRect(bx, by, bw, 4);
        ctx.fillStyle = m.kind === "boss" ? "#c8474c" : "#87b14e";
        ctx.fillRect(bx, by, bw * frac, 4);
      }
    }

    p.vfx.draw(ctx, w, h, now, dt);
    ctx.restore();
  });
};

/* ---------- feedback from combat ----------------------------------------- */
GM.bus.on("combat:progress", function (rep) {
  for (var id in rep.bySquad) {
    var r = rep.bySquad[id];
    var p = panels[id];
    if (!p || !p.vfx) continue;
    if (r.deaths) {
      for (var hid in p.actors) if (!p.actors[hid].anim.dead) p.actors[hid].anim.play("death");
      p.reviveAt = performance.now() + 1500;
      p.vfx.number(p.canvas.width * 0.18, p.canvas.height * 0.3, "BROKEN", "bad");
      p.vfx.flashShake(p.canvas.height * 0.03);
    }
    if (r.epitaphs) p.vfx.number(p.canvas.width * 0.18, p.canvas.height * 0.36, "+" + r.epitaphs + " epitaph", "crit");
  }
});

/* Debug hook: lets tools freeze and inspect actors. Not used by the game. */
GM.ui._panels = function () { return panels; };

GM.ui.initBattles = function () {
  GM.ui.buildBattles();
  GM.ui.region("battles", GM.ui.renderBattles);
  GM.bus.on("roster:changed", function () { GM.ui.markDirty("battles"); });
};
