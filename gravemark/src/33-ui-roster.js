/* Gravemark — 33-ui-roster.js
   The right column: the warband.

   One row per hero — portrait, name, rank numeral, level, and which squad they
   are in. Benched heroes are dimmed and sorted last, so an empty squad is
   visible as a problem rather than hidden in a list. */
"use strict";

var SQUAD_TAG = ["I", "II", "III"];

function portraitInto(canvas, hero) {
  var ctx = canvas.getContext("2d");
  if (!ctx) return;
  var cls = GM.heroClass(hero);
  var w = canvas.width, h = canvas.height;
  /* A class-tinted plate behind whatever art exists, so the roster is
     readable by colour alone before any portrait art is delivered. */
  var g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "hsl(" + cls.hue + ",26%,26%)");
  g.addColorStop(1, "hsl(" + cls.hue + ",30%,13%)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  var look = GM.heroLookKey(hero);
  var key = (look && GM.artReady(look)) ? look
          : GM.artReady("actor/hero-idle") ? "actor/hero-idle" : null;
  if (key) {
    /* Crop the head and shoulders out of the full figure, tinted to the class
       so a roster of identical sprites is still readable at a glance. */
    GM.drawTinted(ctx, key, cls.hue, 0, -w * 0.32, -h * 0.12, w * 1.64, h * 1.64,
                  { label: false, strength: 0.26 });
  } else {
    ctx.fillStyle = "hsla(" + cls.hue + ",50%,70%,.9)";
    ctx.font = "600 " + Math.floor(h * 0.5) + "px ui-monospace,monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(hero.name.charAt(0), w / 2, h / 2 + 1);
  }
}

GM.ui.renderRoster = function () {
  var list = GM.$("#rosterList");
  if (!list) return;

  var heroes = (GM.state.heroes || []).slice();
  heroes.sort(function (a, b) {
    var sa = GM.squadOf(a.id), sb = GM.squadOf(b.id);
    /* assigned first, grouped by squad, then by level */
    var ia = sa ? GM.state.squads.indexOf(sa) : 99;
    var ib = sb ? GM.state.squads.indexOf(sb) : 99;
    if (ia !== ib) return ia - ib;
    return b.level - a.level;
  });

  list.innerHTML = "";
  heroes.forEach(function (h) {
    var cls = GM.heroClass(h), rank = GM.heroRank(h);
    var sq = GM.squadOf(h.id);
    var row = GM.el("div", "hrow" + (sq ? "" : " hbench"));
    row.dataset.hero = h.id;
    row.dataset.tip = "hero:" + h.id;

    var pw = GM.el("div", "hportrait");
    var pc = GM.el("canvas");
    pc.width = pc.height = 34;
    pw.appendChild(pc);
    var badge = GM.el("span", "hbadge", cls.icon);
    pw.appendChild(badge);
    row.appendChild(pw);
    portraitInto(pc, h);

    var info = GM.el("div", "hinfo");
    info.innerHTML =
      '<div class="hname">' + GM.esc(h.name) + "</div>" +
      '<div class="hlvl">Level ' + h.level + "</div>" +
      '<div class="hsq">' + (sq ? GM.esc(sq.name) : "Benched") + "</div>";
    row.appendChild(info);

    row.appendChild(GM.el("div", "hrank " + rank.css, rank.numeral));
    list.appendChild(row);
  });

  var cnt = GM.$("#rosterCount");
  if (cnt) cnt.textContent = heroes.length;
  var max = GM.$("#rosterMax");
  if (max) max.textContent = GM.ROSTER_MAX;

  var rec = GM.$("#btnRecruit");
  if (rec) {
    var cost = GM.recruitCost();
    rec.disabled = !GM.canRecruit();
    rec.dataset.tip = "txt:Recruit · " + GM.fmt(cost) + " gold" +
      (GM.canRecruit() ? "" : " (warband full)");
  }
};

GM.ui.initRoster = function () {
  GM.delegate(GM.$("#rosterList"), "click", "[data-hero]", function (e, node) {
    GM.ui.openOverlay("hero", node.dataset.hero);
  });

  var rec = GM.$("#btnRecruit");
  if (rec) GM.on(rec, "click", function () {
    var r = GM.recruit();
    if (r.ok) {
      GM.state.tally.recruited++;
      GM.autoAssign();
      GM.ui.toast(r.hero.name + " joins · " + GM.heroRank(r.hero).name + " " +
                  GM.heroClass(r.hero).name, "good");
    } else {
      GM.ui.toast(r.why, "bad");
    }
    GM.ui.markDirty();
  });

  var aa = GM.$("#btnAutoAssign");
  if (aa) GM.on(aa, "click", function () {
    var n = GM.autoAssign();
    GM.ui.toast(n ? "Assigned " + n + " to squads." : "Every squad is already full.", n ? "good" : "");
    GM.ui.markDirty();
  });

  var st = GM.$("#btnStash");
  if (st) GM.on(st, "click", function () { GM.ui.openOverlay("stash"); });

  GM.ui.region("roster", GM.ui.renderRoster);
};
