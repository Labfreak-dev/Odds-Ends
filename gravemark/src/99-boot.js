/* Gravemark — 99-boot.js
   Wiring: the game loop, season switching, autosave, and first-run setup. */
"use strict";

GM.TICK_MS = 100;          /* ten logic ticks a second */
GM.MAX_FRAME_SEC = 0.5;    /* a backgrounded tab must not resolve an hour at once */

var lastTick = 0;
var lastSave = 0;
var running = false;

GM.switchSeason = function (seasonId) {
  GM.save();
  GM.startSeason(seasonId);
  GM.invalidateStats();
  GM.fight.monster = null;
  var st = GM.stats({});
  GM.fight.php = GM.fight.phpMax = st.life;
  GM.ui.closeModal();
  GM.ui.renderTop();
  GM.ui.markDirty();
  GM.ui.toast("Season: " + (GM.SEASON_BY_ID[seasonId] || {}).name, "good");
};

function loop(now) {
  if (!running) return;
  var dt = (now - lastTick) / 1000;
  lastTick = now;

  /* A hidden tab throttles rAF to ~1Hz; clamping here keeps each resolved
     slice honest and lets the offline pass handle real absences. */
  if (dt > GM.MAX_FRAME_SEC) dt = GM.MAX_FRAME_SEC;
  if (dt > 0) {
    GM.state.tally.playtime += dt;
    try {
      GM.tick(dt);
    } catch (e) {
      /* One bad tick must not kill the loop and strand the player. */
      console.error("[GM] tick failed", e);
    }
  }

  if (GM.ui.currentView() === "delve") GM.ui.renderFight();
  GM.ui.renderTop();

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
    html += '<p class="flavour" style="margin-top:8px">Your away time is capped at ' +
      GM.fmtTime(r.creditedSeconds) + ". Raise the Lychgate in the parish, or take the Night Shift perk, to extend it.</p>";
  }
  GM.ui.modal("While you were away", html, [{ label: "Carry on", cls: "primary" }]);
}

function boot() {
  var season = GM.lastSeason();
  GM.startSeason(season);

  GM.ui.init();
  GM.ui.initFight();
  GM.ui.initGear();
  GM.ui.initTree();
  GM.ui.initMeta();

  GM.invalidateStats();
  var st = GM.stats({});
  GM.fight.phpMax = st.life;
  GM.fight.php = st.life;

  /* Offline is resolved before the first frame so the opening screen already
     reflects the away gains rather than briefly showing stale numbers. */
  var report = null;
  try {
    report = GM.checkOffline();
  } catch (e) {
    console.error("[GM] offline pass failed", e);
  }

  GM.ui.renderTop();
  GM.ui.show("delve");
  GM.ui.markDirty();

  running = true;
  lastTick = performance.now();
  lastSave = lastTick;
  requestAnimationFrame(loop);

  if (report) showOfflineReport(report);

  if (!GM.storageOK) {
    GM.ui.toast("Storage is blocked — progress will not be saved.", "bad");
  }

  /* Save on the way out. `visibilitychange` fires on mobile where `unload`
     does not, so both are bound. */
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
