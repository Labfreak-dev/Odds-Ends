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
        lootCell("❖", haul.items) + lootCell("ᛞ", haul.runes) +
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

/* ---------- the canvas --------------------------------------------------- */
function fit(p) {
  var r = p.stage.getBoundingClientRect();
  var dpr = Math.min(2, window.devicePixelRatio || 1);
  var w = Math.max(1, Math.floor(r.width * dpr));
  var h = Math.max(1, Math.floor(r.height * dpr));
  if (p.canvas.width !== w || p.canvas.height !== h) { p.canvas.width = w; p.canvas.height = h; }
}

GM.ui.drawBattles = function (now) {
  (GM.state.squads || []).forEach(function (sq) {
    var p = panels[sq.id];
    if (!p || !p.ctx) return;
    fit(p);
    var ctx = p.ctx, w = p.canvas.width, h = p.canvas.height;
    ctx.clearRect(0, 0, w, h);

    var stage = GM.squadStage(sq);
    var bgKey = sq.mode === "tower" ? "bg/tower"
              : sq.mode === "dimension" ? "bg/dimension"
              : sq.mode === "finality" ? "bg/finality"
              : sq.mode === "vigil" ? "bg/graveyard"
              : "bg/realm-" + Math.min(GM.realmOf(stage), GM.REALMS.length);
    GM.drawSprite(ctx, bgKey, 0, 0, 0, w, h, { label: false, dark: true });

    /* ground shelf, so figures read as standing rather than floating */
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = "#04060a";
    ctx.fillRect(0, h * 0.84, w, h * 0.16);
    ctx.restore();

    var ground = h * 0.87;
    /* Sized off the SHORTER dimension as well as the height, so a wide short
       panel does not draw figures taller than it is. */
    var size = Math.min(h * 0.52, w * 0.15);

    /* The squad, left, facing right. Each hero is tinted to their class and
       jittered in size and footing from a hash of their id, so five copies of
       one sprite still read as five different people. Deterministic, so nobody
       shuffles between frames. */
    var heroes = GM.squadHeroes(sq);
    for (var i = 0; i < heroes.length; i++) {
      var hero = heroes[i];
      var cls = GM.heroClass(hero);
      var jitter = GM.hash(hero.id);
      var scale = 0.90 + ((jitter % 17) / 17) * 0.20;       /* 0.90 - 1.10 */
      var lift = ((jitter >>> 5) % 7) / 7 * (h * 0.03);
      var hs = size * scale;
      var hx = w * 0.05 + i * size * 0.60;
      var look = GM.heroLookKey(hero);
      var key = (look && GM.artReady(look)) ? look : "actor/hero-idle";
      GM.drawTinted(ctx, key, cls.hue, 0, hx, ground - hs + lift, hs, hs,
                    { label: false, strength: 0.26 });
    }

    /* the pack, right, facing left */
    var mons = sq.monsters || [];
    for (i = 0; i < mons.length; i++) {
      var m = mons[i];
      if (m.hp <= 0) continue;
      var big = m.kind === "boss" ? 1.3 : m.kind === "revenant" ? 1.15 : 1;
      var mx = w * 0.52 + i * size * 0.56;
      if (mx > w - size * 0.75) mx = w - size * 0.75;
      var mkey = m.kind === "revenant" ? "actor/revenant-idle"
               : m.kind === "boss" ? "boss/" + m.id.replace(/_c\d+$/, "") + "-idle"
               : "mon/" + m.id + "-idle";
      if (!GM.ART_BY_KEY[mkey]) mkey = "mon/shambler-idle";
      GM.drawSprite(ctx, mkey, 0, mx, ground - size * big, size * big, size * big, { label: true });

      /* a slim life bar under anything still up */
      var frac = GM.clamp(m.hp / m.hpMax, 0, 1);
      var bw = size * 0.42, bx = mx + size * 0.05, by = ground + 3;
      ctx.fillStyle = "rgba(0,0,0,.72)";
      ctx.fillRect(bx, by, bw, 4);
      ctx.fillStyle = m.kind === "boss" ? "#c8474c" : "#87b14e";
      ctx.fillRect(bx, by, bw * frac, 4);
    }

    drawFloaters(p, ctx, w, h, now);
  });
};

function drawFloaters(p, ctx, w, h, now) {
  for (var i = p.floaters.length - 1; i >= 0; i--) {
    var f = p.floaters[i];
    var age = (now - f.born) / 1200;
    if (age >= 1) { p.floaters.splice(i, 1); continue; }
    ctx.save();
    ctx.globalAlpha = 1 - age;
    ctx.font = "600 " + Math.max(11, h * 0.07) + "px ui-monospace,Menlo,monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = f.cls === "crit" ? "#e0c53a" : f.cls === "bad" ? "#e0666b" : "#e8e2d1";
    ctx.fillText(f.text, w * f.x, h * (0.55 - age * 0.22));
    ctx.restore();
  }
}

GM.ui.battleFloater = function (squadId, text, cls) {
  var p = panels[squadId];
  if (!p) return;
  p.floaters.push({ text: text, cls: cls || "", born: performance.now(), x: 0.62 + (GM.rng() - 0.5) * 0.18 });
  if (p.floaters.length > 18) p.floaters.shift();
};

/* ---------- feedback ----------------------------------------------------- */
GM.bus.on("combat:progress", function (rep) {
  for (var id in rep.bySquad) {
    var r = rep.bySquad[id];
    if (r.deaths) GM.ui.battleFloater(id, "BROKEN", "bad");
    else if (r.equipped) GM.ui.battleFloater(id, "upgrade", "crit");
    if (r.epitaphs) GM.ui.battleFloater(id, "+" + r.epitaphs + " epitaph", "crit");
  }
});

GM.ui.initBattles = function () {
  GM.ui.buildBattles();
  GM.ui.region("battles", GM.ui.renderBattles);
  GM.bus.on("roster:changed", function () { GM.ui.markDirty("battles"); });
};
