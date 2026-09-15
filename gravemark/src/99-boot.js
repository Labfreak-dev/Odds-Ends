/* Gravemark — 99-boot.js
   Wiring: the game loop, season switching, autosave, first-run setup. */
"use strict";

GM.MAX_FRAME_SEC = 0.5;    /* a backgrounded tab must not resolve an hour at once */

var lastTick = 0;
var lastSave = 0;
var running = false;

GM.switchSeason = function (seasonId) {
  GM.save();
  GM.startSeason(seasonId);
  GM.invalidateStats();
  (GM.state.squads || []).forEach(function (sq) { sq.monsters = []; sq.victory = null; });
  GM.ui.buildBattles();
  GM.ui.markDirty();
  GM.ui.toast("Season: " + (GM.SEASON_BY_ID[seasonId] || {}).name, "good");
};

function loop(now) {
  if (!running) return;
  var dt = (now - lastTick) / 1000;
  lastTick = now;

  /* A hidden tab throttles rAF to ~1Hz; clamping keeps each resolved slice
     honest and leaves real absences to the offline pass. */
  if (dt > GM.MAX_FRAME_SEC) dt = GM.MAX_FRAME_SEC;
  if (dt > 0) {
    GM.state.tally.playtime += dt;
    try { GM.tick(dt); }
    catch (e) { console.error("[GM] tick failed", e); }
  }

  /* Battle panels carry live numbers, so they refresh every frame; the hub and
     roster only repaint when something marks them dirty. */
  GM.ui.renderBattles();
  GM.ui.drawBattles(now);
  GM.ui.renderCurrencies();
  GM.ui.flush();

  if (now - lastSave > GM.AUTOSAVE_MS) {
    lastSave = now;
    GM.save();
  }
  requestAnimationFrame(loop);
}

function showOfflineReport(r) {
  if (!r || (!r.kills && !r.goldGained)) return;
  var rows = GM.offlineSummary(r);
  var html = '<div class="stats">' + rows.map(function (x) {
    return '<div class="stat"><span class="k">' + GM.esc(x.label) +
           '</span><span class="v">' + GM.esc(x.value) + "</span></div>";
  }).join("") + "</div>";
  if (r.cappedBy) {
    html += '<p class="flavour" style="margin-top:8px">Away time is capped at ' +
      GM.fmtTime(r.creditedSeconds) + ". Raise the Lychgate, or take the Night Shift perk, to extend it.</p>";
  }
  GM.ui.openOverlay("away");
  var body = GM.$("#overlay .ovbody");
  if (body) {
    body.innerHTML = '<div class="panel"><h2>While you were away</h2>' + html + "</div>";
    var b = GM.el("button", "btn primary", "Carry on");
    GM.on(b, "click", GM.ui.closeOverlay);
    body.appendChild(b);
  }
}

function boot() {
  GM.startSeason(GM.lastSeason());

  /* Fire-and-forget: tells the art loader which keys exist so it never
     requests the ones that do not. */
  GM.loadArtIndex();

  GM.ui.init();
  GM.ui.initHub();
  GM.ui.initBattles();
  GM.ui.initRoster();
  GM.ui.initOverlay();

  GM.invalidateStats();
  (GM.state.squads || []).forEach(function (sq) {
    var st = GM.squadStats(sq, GM.squadCtx(sq));
    sq.hpMax = st.life || 1;
    if (!sq.hp || sq.hp > sq.hpMax) sq.hp = sq.hpMax;
  });

  /* Offline resolves before the first frame so the opening screen already
     reflects the away gains rather than briefly showing stale numbers. */
  var report = null;
  try { report = GM.checkOffline(); }
  catch (e) { console.error("[GM] offline pass failed", e); }

  GM.ui.markDirty();
  GM.ui.flush();
  GM.ui.redrawHub();

  running = true;
  lastTick = performance.now();
  lastSave = lastTick;
  requestAnimationFrame(loop);

  if (report) showOfflineReport(report);
  if (!GM.storageOK) GM.ui.toast("Storage is blocked — progress will not be saved.", "bad");

  GM.on(window, "beforeunload", function () { GM.save(); });
  GM.on(document, "visibilitychange", function () {
    if (document.visibilityState === "hidden") GM.save();
  });
  GM.bus.on("save:failed", function () {
    GM.ui.toast("Could not save — storage may be full.", "bad");
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
