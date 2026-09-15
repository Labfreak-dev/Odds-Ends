/* Gravemark — 17-offline.js
   While-you-were-away.

   Offline runs the SAME `GM.tick` the live loop runs, just with a much larger
   budget. That is deliberate: an idle game whose offline
   maths is a separate estimate will always drift from its online maths, and
   the player will always notice in the direction that annoys them. */
"use strict";

GM.OFFLINE_MIN_SEC = 45;        /* below this, not worth a report */
GM.OFFLINE_TICK_CAP = 60 * 60 * 48;

/* How long the player is credited for, in seconds. The Lychgate and the Night
   Shift perk both extend the cap; base is two hours. */
GM.offlineCapSeconds = function () {
  var st = GM.playerStats();
  return GM.clamp(st.offlineHours * 3600, 3600, GM.OFFLINE_TICK_CAP);
};

GM.runOffline = function (elapsedSec) {
  var raw = Math.max(0, elapsedSec);
  if (raw < GM.OFFLINE_MIN_SEC) return null;

  var cap = GM.offlineCapSeconds();
  var credited = Math.min(raw, cap);

  /* Away time is worth less than played time — otherwise the optimal way to
     play is to close the tab, which is a strange thing to design toward. */
  var RATE = 0.72;
  var budget = credited * RATE;

  var before = {
    gold: GM.state.char.gold,
    shards: GM.state.char.shards,
    level: GM.warbandLevel(),
    depth: GM.state.depth.current,
    level: GM.warbandLevel(),
    maxEver: GM.state.depth.maxEver,
    epitaphs: GM.state.epitaphs.length
  };

  var report = GM.tick(budget, { offline: true });

  report.awaySeconds = raw;
  report.creditedSeconds = credited;
  report.cappedBy = raw > cap ? cap : 0;
  report.rate = RATE;
  report.levelsGained = GM.warbandLevel() - before.level;
  report.depthGained = GM.state.depth.maxEver - before.maxEver;
  report.goldGained = GM.state.char.gold - before.gold;
  report.shardsGained = GM.state.char.shards - before.shards;
  report.epitaphsGained = GM.state.epitaphs.length - before.epitaphs;

  GM.bus.emit("offline:report", report);
  return report;
};

/* Called once at boot, after the save is loaded and stats are available. */
GM.checkOffline = function () {
  var last = GM.state.lastSeen || Date.now();
  var elapsed = (Date.now() - last) / 1000;
  if (elapsed < GM.OFFLINE_MIN_SEC) return null;
  var r = GM.runOffline(elapsed);
  if (r) {
    GM.log("Away " + GM.fmtTime(r.awaySeconds) + ": " + r.kills + " kills, " +
           GM.fmt(r.goldGained) + " gold.", "offline");
  }
  return r;
};

/* A readable summary for the away panel. Returns an array of {label, value}
   so the UI does no formatting decisions of its own. */
GM.offlineSummary = function (r) {
  if (!r) return [];
  var rows = [
    { label: "Away", value: GM.fmtTime(r.awaySeconds) },
    { label: "Credited", value: GM.fmtTime(r.creditedSeconds) + (r.cappedBy ? " (capped)" : "") },
    { label: "Kills", value: GM.fmt(r.kills) },
    { label: "Depths cleared", value: GM.fmt(r.cleared) },
    { label: "Gold", value: GM.fmt(r.goldGained) },
    { label: "Shards", value: GM.fmt(r.shardsGained) }
  ];
  if (r.levelsGained > 0)   rows.push({ label: "Levels", value: "+" + r.levelsGained });
  if (r.depthGained > 0)    rows.push({ label: "New record", value: "+" + r.depthGained + " depth" });
  if (r.bosses > 0)         rows.push({ label: "Bosses", value: GM.fmt(r.bosses) });
  if (r.epitaphsGained > 0) rows.push({ label: "Epitaphs", value: "+" + r.epitaphsGained });
  if (r.deaths > 0)         rows.push({ label: "Deaths", value: GM.fmt(r.deaths) });
  return rows;
};
