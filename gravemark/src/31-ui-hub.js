/* Gravemark — 31-ui-hub.js
   The left column: the parish itself.

   A painted scene with a labelled marker on every building, the currency bar
   above and the charter strip below. Markers are DOM rather than drawn into
   the canvas so they stay crisp, clickable and screen-reader-visible while
   the scene behind them is just a picture. */
"use strict";

/* Where each building sits on the scene, in percentages of the panel. Laid
   out to read as a settlement rather than a list: the shrine and the forge
   near the road, the vault and library up the slope, the gate at the bottom. */
var MARKS = {
  gravehouse: { x: 40, y: 37 },
  watchtower: { x: 63, y: 28 },
  library:    { x: 73, y: 50 },
  whetstone:  { x: 18, y: 57 },
  memorial:   { x: 50, y: 69 },
  vault:      { x: 81, y: 65 },
  forge:      { x: 17, y: 79 },
  lychgate:   { x: 71, y: 89 }
};

var hubCanvas = null, hubCtx = null;

function fitCanvas() {
  if (!hubCanvas) return;
  var r = hubCanvas.parentNode.getBoundingClientRect();
  var dpr = Math.min(2, window.devicePixelRatio || 1);
  var w = Math.max(1, Math.floor(r.width * dpr));
  var h = Math.max(1, Math.floor(r.height * dpr));
  if (hubCanvas.width !== w || hubCanvas.height !== h) {
    hubCanvas.width = w; hubCanvas.height = h;
  }
}

function drawHub() {
  if (!hubCtx) return;
  fitCanvas();
  var w = hubCanvas.width, h = hubCanvas.height;
  hubCtx.clearRect(0, 0, w, h);
  GM.drawSprite(hubCtx, "bg/town", 0, 0, 0, w, h, { label: false, dark: true });

  /* A vignette so the markers and the charter strip stay legible over whatever
     the backdrop happens to be. */
  var g = hubCtx.createRadialGradient(w / 2, h * 0.45, h * 0.2, w / 2, h * 0.55, h * 0.95);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.72)");
  hubCtx.fillStyle = g;
  hubCtx.fillRect(0, 0, w, h);
}

/* ---------- markers ------------------------------------------------------ */
GM.ui.renderHubMarkers = function () {
  var host = GM.$("#hubMarkers");
  if (!host) return;
  host.innerHTML = "";

  GM.BUILDINGS.forEach(function (b) {
    var pos = MARKS[b.id];
    if (!pos) return;
    var lv = GM.townLevel(b.id);
    var cost = GM.buildingCost(b, lv);
    var afford = GM.state.char.gold >= cost && lv < b.max;

    var m = GM.el("div", "marker" + (lv === 0 ? " locked" : ""));
    m.style.left = pos.x + "%";
    m.style.top = pos.y + "%";
    m.dataset.building = b.id;
    m.dataset.tip = "building:" + b.id;
    m.innerHTML = '<span class="lv">' + lv + '</span><span class="nm">' +
                  GM.esc(b.name) + (afford ? " ▲" : "") + "</span>";
    host.appendChild(m);
  });
};

GM.ui.tipProvider("building", function (id) {
  var b = GM.BUILDING_BY_ID[id];
  if (!b) return "";
  var lv = GM.townLevel(id);
  var cost = GM.buildingCost(b, lv);
  var out = ['<div class="tname gold">' + b.icon + " " + GM.esc(b.name) + "</div>"];
  out.push('<div class="tbase">Level ' + lv + " of " + b.max + "</div>");
  out.push('<div class="flavour">' + GM.esc(b.blurb) + "</div>");
  var now = [], next = [];
  for (var k in b.per) {
    if (lv) now.push(GM.statLine(k, b.per[k] * lv));
    next.push(GM.statLine(k, b.per[k]));
  }
  if (now.length) out.push('<div class="tstat" style="margin-top:4px">Now: ' + GM.esc(now.join(", ")) + "</div>");
  out.push('<div class="tstat faint">Next: ' + GM.esc(next.join(", ")) + "</div>");
  out.push('<div class="tcmp">' + (lv >= b.max ? "Complete."
    : (GM.state.char.gold >= cost ? "Click to raise · " : "Needs ") + GM.fmt(cost) + " gold") + "</div>");
  return out.join("");
});

/* ---------- charter strip ------------------------------------------------ */
GM.ui.renderQuest = function () {
  var q = GM.state.quest;
  if (!q) return;
  var def = GM.questDef();
  var done = Math.min(q.done, q.need);
  var complete = GM.questComplete();
  var scale = 1 + GM.state.depth.maxEver / 25;

  function set(id, v) { var e = GM.$(id); if (e) e.textContent = v; }
  set("#questName", def.text);
  set("#questDone", GM.fmt(done));
  set("#questNeed", GM.fmt(q.need));
  set("#qrGold", GM.fmt(Math.round(def.gold * scale)));
  set("#qrShards", GM.fmt(Math.round(def.shards * scale)));
  set("#qrIchor", GM.fmt(def.ichor || 0));

  var fill = GM.$("#questFill");
  if (fill) fill.style.width = (done / q.need * 100).toFixed(1) + "%";

  var btn = GM.$("#questClaim");
  if (btn) {
    btn.disabled = !complete;
    btn.textContent = complete ? "Claim" : "Not Completed";
    btn.className = "btn sm" + (complete ? " primary" : "");
  }
};

/* ---------- wiring ------------------------------------------------------- */
GM.ui.initHub = function () {
  hubCanvas = GM.$("#hubCanvas");
  if (hubCanvas) hubCtx = hubCanvas.getContext("2d");
  drawHub();
  GM.on(window, "resize", function () { drawHub(); });
  /* The scene is painted once rather than every frame, so it has to be told
     when its backdrop finishes loading or it stays empty for the session. */
  GM.bus.on("art:index", drawHub);
  GM.bus.on("art:loaded", function (key) { if (key === "bg/town") drawHub(); });

  GM.delegate(GM.$("#hubMarkers"), "click", "[data-building]", function (e, node) {
    var id = node.dataset.building;
    var r = GM.buyBuilding(id);
    if (r.ok) {
      GM.ui.toast(GM.BUILDING_BY_ID[id].name + " → " + GM.townLevel(id), "good");
    } else {
      /* Not affordable is not an error worth a red toast on every click —
         open the parish overlay so the player can see the whole town. */
      GM.ui.openOverlay("town");
    }
    GM.ui.markDirty();
  });

  GM.delegate(GM.$("#hubSide"), "click", "[data-open]", function (e, node) {
    GM.ui.openOverlay(node.dataset.open);
  });

  var claim = GM.$("#questClaim");
  if (claim) GM.on(claim, "click", function () {
    var r = GM.claimQuest();
    if (r.ok) {
      GM.ui.toast("Charter paid: +" + GM.fmt(r.gold) + " gold, +" + GM.fmt(r.shards) + " shards", "good");
    }
    GM.ui.markDirty();
  });

  GM.ui.region("hub", function () {
    GM.ui.renderCurrencies();
    GM.ui.renderHubMarkers();
    GM.ui.renderQuest();
  });
};

/* The scene itself only needs repainting on resize or when art lands, so it is
   deliberately outside the dirty-render loop. */
GM.ui.redrawHub = drawHub;
