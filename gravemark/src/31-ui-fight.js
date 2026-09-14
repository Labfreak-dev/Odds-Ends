/* Gravemark — 31-ui-fight.js
   The delve view: the animated stage, the bars, and the character sheet.

   The stage draws the hero as a STACK of paper-doll layers (one per equipped
   slot) against the realm backdrop, with the monster facing in from the right.
   Until real art exists every layer draws as a labelled placeholder, so the
   composition and the animation timing can be judged before a single sprite
   is commissioned. */
"use strict";

var canvas = null, ctx = null;
var t0 = performance.now();
var floaters = [];
var heroState = "idle", heroUntil = 0;
var monState = "idle", monUntil = 0;
var lastMonHp = 1;

function anim(id) { return GM.byId(GM.ANIM_STATES, id) || { frames: 6, fps: 8, loop: true }; }

function frameFor(state, startedAt, now) {
  var a = anim(state);
  var elapsed = (now - startedAt) / 1000;
  var f = Math.floor(elapsed * a.fps);
  return a.loop ? f % a.frames : Math.min(f, a.frames - 1);
}

/* The hero's attack cadence is driven by real attack speed, so a fast build
   visibly swings faster — the animation is not decorative timing. */
function tickHeroAnim(now, st) {
  if (now > heroUntil) {
    if (heroState === "attack") { heroState = "idle"; heroUntil = now + 1e9; }
    else {
      var period = 1000 / Math.max(0.1, st.attackSpeed);
      heroState = "attack";
      heroUntil = now + Math.min(period, (anim("attack").frames / anim("attack").fps) * 1000);
    }
  }
}

function weaponFamily() {
  var w = GM.state.equip.weapon;
  var b = w && GM.BASE_BY_ID[w.baseId];
  return b ? b.family : null;
}

function drawHero(now, x, y, w, h) {
  var fam = weaponFamily();
  var key = heroState === "attack" && fam
    ? "actor/hero-attack-" + fam
    : "actor/hero-" + heroState;
  var f = frameFor(heroState, heroUntil - 1000, now);

  /* Body first, then every gear layer in z order, then fx. A missing layer is
     simply skipped, so an unequipped slot draws nothing. */
  /* Labelled on purpose: while the art is placeholder, the caption is how you
     tell which animation state and weapon family is actually playing. */
  GM.drawSprite(ctx, key, f, x, y, w, h);

  var layers = GM.DOLL_LAYERS.slice().sort(function (a, b) { return a.z - b.z; });
  for (var i = 0; i < layers.length; i++) {
    var L = layers[i];
    if (!L.slot) continue;
    var dk = GM.dollKeyFor(L.id, L.slot);
    if (!dk) continue;
    /* Only draw real doll art — 45 stacked placeholders would be mud. */
    if (!GM.artReady(dk)) continue;
    GM.drawSprite(ctx, dk, f, x, y, w, h, { label: false });
  }
}

function drawMonster(now, mon, x, y, w, h) {
  if (!mon) return;
  var key;
  if (mon.kind === "revenant") key = "actor/revenant-" + monState;
  else if (mon.kind === "boss") key = "boss/" + mon.id.replace(/_c\d+$/, "") + "-" + (monState === "hit" ? "idle" : monState);
  else key = "mon/" + mon.id + "-" + monState;

  if (!GM.ART_BY_KEY[key]) key = "mon/shambler-idle";
  var f = frameFor(monState, monUntil - 1000, now);
  GM.drawSprite(ctx, key, f, x, y, w, h, { label: true });
}

function drawBackdrop(stage) {
  var realm = GM.realmOf(stage);
  var m = GM.state.mode.id;
  var key = m === "tower" ? "bg/tower"
          : m === "dimension" ? "bg/dimension"
          : m === "finality" ? "bg/finality"
          : m === "vigil" ? "bg/graveyard"
          : "bg/realm-" + Math.min(realm, GM.REALMS.length);
  GM.drawSprite(ctx, key, 0, 0, 0, canvas.width, canvas.height, { label: false, dark: true });

  /* A ground line so the figures read as standing rather than floating. */
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = "#05070a";
  ctx.fillRect(0, canvas.height * 0.82, canvas.width, canvas.height * 0.18);
  ctx.restore();
}

GM.ui.floater = function (text, cls) {
  floaters.push({ text: text, cls: cls || "", born: performance.now(), x: 0.5 + (GM.rng() - 0.5) * 0.2 });
  if (floaters.length > 22) floaters.shift();
};

function drawFloaters(now) {
  for (var i = floaters.length - 1; i >= 0; i--) {
    var f = floaters[i];
    var age = (now - f.born) / 1300;
    if (age >= 1) { floaters.splice(i, 1); continue; }
    ctx.save();
    ctx.globalAlpha = 1 - age;
    ctx.font = "600 15px ui-monospace,Menlo,monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = f.cls === "crit" ? "#e0c53a" : f.cls === "bad" ? "#e0666b" : "#e6e0cf";
    ctx.fillText(f.text, canvas.width * f.x, canvas.height * (0.55 - age * 0.24));
    ctx.restore();
  }
}

function draw() {
  if (!ctx) return;
  var now = performance.now();
  var stage = GM.modeStage();
  var st = GM.stats(GM.modeCtx());
  var f = GM.fight;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackdrop(stage);

  tickHeroAnim(now, st);
  if (now > monUntil && monState !== "idle") { monState = "idle"; monUntil = now + 1e9; }

  var H = canvas.height * 0.62;
  var W = H;
  drawHero(now, canvas.width * 0.14, canvas.height * 0.82 - H, W, H);

  if (f.monster) {
    var bs = f.monster.kind === "boss" ? 1.28 : f.monster.kind === "revenant" ? 1.12 : 1;
    drawMonster(now, f.monster, canvas.width * 0.62, canvas.height * 0.82 - H * bs, W * bs, H * bs);
  }

  drawFloaters(now);
  requestAnimationFrame(draw);
}

/* ---------- HUD ---------------------------------------------------------- */
function setBar(fillId, txtId, frac, text) {
  var fill = GM.$(fillId), txt = GM.$(txtId);
  if (fill) fill.style.width = (GM.clamp(frac, 0, 1) * 100).toFixed(1) + "%";
  if (txt) txt.textContent = text;
}

GM.ui.renderFight = function () {
  var s = GM.state, f = GM.fight;
  var stage = GM.modeStage();
  var ctxm = GM.modeCtx();
  var st = GM.stats(ctxm);
  var realm = GM.realmInfo(GM.realmOf(stage));
  var modeDef = GM.MODE_BY_ID[s.mode.id];

  var tag = GM.$("#stageTag");
  if (tag) tag.textContent = realm.name + " · depth " + stage +
    (GM.isBossStage(stage) && !ctxm.noBoss ? " · BOSS" : "");
  var md = GM.$("#stageMode");
  if (md) md.textContent = (modeDef ? modeDef.name : "") +
    (s.mode.id === "tower" ? " · floor " + (s.mode.towerRun || 1) : "") +
    (s.mode.id === "finality" ? " · wave " + (s.mode.wave || 1) : "");

  var mn = GM.$("#monName"), mk = GM.$("#monKind");
  if (f.monster) {
    if (mn) mn.textContent = f.monster.name;
    if (mk) mk.textContent = GM.ELEM_META[f.monster.elem].label + " · " + f.monster.kind;
    setBar("#monBar", "#monBarTxt", f.mhpMax ? f.mhp / f.mhpMax : 0,
           GM.fmt(Math.max(0, f.mhp)) + " / " + GM.fmt(f.mhpMax));
  } else {
    if (mn) mn.textContent = "—";
    if (mk) mk.textContent = "—";
    setBar("#monBar", "#monBarTxt", 0, "");
  }

  setBar("#youBar", "#youBarTxt", f.phpMax ? f.php / f.phpMax : 1,
         GM.fmt(Math.max(0, f.php)) + " / " + GM.fmt(f.phpMax));

  var need = GM.xpToLevel(s.char.level);
  setBar("#xpBar", "#xpBarTxt", s.char.level >= GM.MAX_LEVEL ? 1 : s.char.xp / need,
         s.char.level >= GM.MAX_LEVEL ? "MAX" : GM.fmt(s.char.xp) + " / " + GM.fmt(need) + " xp");

  var dpsEl = GM.$("#fightDps");
  if (dpsEl) dpsEl.textContent = GM.fmt(st.dps) + " dps · " + st.attackSpeed.toFixed(2) + " atk/s";

  var pack = GM.$("#packTxt");
  if (pack) {
    if (s.mode.id === "expedition") {
      var req = GM.isBossStage(s.depth.current) ? 1 : GM.CURVE.packSize;
      pack.textContent = "Pack " + Math.min(s.depth.kills, req) + " / " + req;
    } else if (s.mode.id === "exploration") {
      pack.textContent = "Farming depth " + stage;
    } else {
      pack.textContent = modeDef ? modeDef.name : "";
    }
  }

  var fc = GM.$("#forecastTxt");
  if (fc) {
    var pdps = f.monster ? GM.dpsAgainst(st, f.monster) : 0;
    var net = f.monster ? GM.netLifeRate(st, f.monster, pdps) : 0;
    if (!f.monster) fc.textContent = "—";
    else if (net >= 0) fc.textContent = "kill in " + GM.fmtTime(f.mhp / Math.max(0.001, pdps)) + " · safe";
    else {
      var ttd = f.php / -net, ttk = f.mhp / Math.max(0.001, pdps);
      fc.textContent = "kill " + GM.fmtTime(ttk) + " vs death " + GM.fmtTime(ttd) +
        (ttk < ttd ? " · winning" : " · LOSING");
      fc.className = "small " + (ttk < ttd ? "faint" : "bad");
    }
  }

  GM.ui.renderStats(st);
  GM.ui.renderLog();
};

GM.ui.renderStats = function (st) {
  var box = GM.$("#statList");
  if (!box) return;
  st = st || GM.stats(GM.modeCtx());
  box.innerHTML = "";
  var rows = [
    ["Damage", GM.fmt(st.dps) + " dps"],
    ["Attack speed", st.attackSpeed.toFixed(2) + "/s"],
    ["Crit", GM.pct(st.crit, 1) + " ×" + st.critMulti.toFixed(2)],
    ["Penetration", GM.pct(st.pen, 0)],
    ["Life", GM.fmt(st.life)],
    ["Regen", GM.fmt(st.regen) + "/s"],
    ["Leech cap", GM.fmt(st.life * GM.LEECH_CAP) + "/s"],
    ["Armour", GM.fmt(st.armour)],
    ["Evasion", GM.fmt(st.evasion)],
    ["Fire res", GM.pct(st.res.fire, 0)],
    ["Frost res", GM.pct(st.res.cold, 0)],
    ["Storm res", GM.pct(st.res.lit, 0)],
    ["Void res", GM.pct(st.res.void, 0)],
    ["Item rarity", "+" + GM.pct(st.findRarity, 0)],
    ["Item quantity", "+" + GM.pct(st.findQuantity, 0)],
    ["Gold find", "+" + GM.pct(st.findGold, 0)],
    ["Experience", "+" + GM.pct(st.findXP, 0)],
    ["Epitaph chance", "+" + GM.pct(st.epitaphChance, 0)],
    ["Away cap", GM.fmtTime(st.offlineHours * 3600)]
  ];
  rows.forEach(function (r) { box.appendChild(GM.ui.statRow(r[0], r[1])); });

  var sub = GM.$("#statSub");
  if (sub) {
    var byE = [];
    GM.ELEMENTS.forEach(function (e) {
      if (st.elemHit[e] > 0.01) byE.push(GM.ELEM_META[e].short + " " + GM.fmt(st.elemHit[e]));
    });
    sub.textContent = byE.join(" · ");
  }
};

/* Combat feedback: floating numbers and hit reactions. */
GM.bus.on("combat:progress", function (r) {
  if (r.kills) {
    monState = "death";
    monUntil = performance.now() + 400;
  }
  if (r.deaths) GM.ui.floater("DIED", "bad");
  if (r.equipped) GM.ui.floater("upgrade", "");
  if (r.epitaphs) GM.ui.floater("+" + r.epitaphs + " epitaph", "crit");
});

GM.ui.panel("delve", GM.ui.renderFight);

GM.ui.initFight = function () {
  canvas = GM.$("#fightCanvas");
  if (!canvas) return;
  ctx = canvas.getContext("2d");
  lastMonHp = 1;
  heroUntil = performance.now();
  monUntil = performance.now() + 1e9;
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(draw);
};
