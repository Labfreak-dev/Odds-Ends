/* Gravemark — 30-ui.js
   UI core for the three-column shell: the currency bar, tooltips, toasts, the
   overlay host, and the render router.

   Each column registers a renderer. Only what is dirty repaints, so three live
   battle panels at 60fps do not drag the 22-row roster along with them. */
"use strict";

GM.ui = GM.ui || {};

var renderers = {};
var dirty = {};

GM.ui.region = function (name, fn) { renderers[name] = fn; dirty[name] = true; };

GM.ui.markDirty = function (name) {
  if (name) dirty[name] = true;
  else for (var k in renderers) dirty[k] = true;
};

/* Called once per frame by the boot loop. */
GM.ui.flush = function () {
  for (var k in renderers) {
    if (!dirty[k]) continue;
    dirty[k] = false;
    try { renderers[k](); }
    catch (e) { console.error("[GM.ui] render " + k + " failed", e); }
  }
};

/* ---------- currency bar ------------------------------------------------- */
GM.ui.renderCurrencies = function () {
  var c = GM.state.char;
  function set(id, v) { var e = GM.$(id); if (e) e.textContent = v; }
  set("#cGold", GM.fmt(c.gold));
  set("#cShards", GM.fmt(c.shards));
  set("#cIchor", GM.fmt(c.ichor));
  set("#cMarks", GM.fmt(c.marks));
  set("#cDust", GM.fmt(c.dust));
  GM.show(GM.$("#cMarksWrap"), c.marks > 0);
  GM.show(GM.$("#cDustWrap"), c.dust > 0);
};

/* ---------- toasts ------------------------------------------------------- */
GM.ui.toast = function (text, kind) {
  var wrap = GM.$("#toasts");
  if (!wrap) return;
  var t = GM.el("div", "toast" + (kind ? " " + kind : ""), text);
  wrap.appendChild(t);
  setTimeout(function () {
    t.style.opacity = "0";
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 220);
  }, 2600);
  while (wrap.children.length > 5) wrap.removeChild(wrap.firstChild);
};

/* ---------- tooltips ----------------------------------------------------- */
var tipEl = null;
var tipProviders = {};

GM.ui.tipProvider = function (name, fn) { tipProviders[name] = fn; };

GM.ui.showTip = function (html, x, y) {
  if (!tipEl) tipEl = GM.$("#tip");
  if (!tipEl || !html) return;
  tipEl.innerHTML = html;
  tipEl.classList.add("on");
  var r = tipEl.getBoundingClientRect();
  tipEl.style.left = Math.max(6, Math.min(x + 16, window.innerWidth - r.width - 10)) + "px";
  tipEl.style.top  = Math.max(6, Math.min(y + 16, window.innerHeight - r.height - 10)) + "px";
};

GM.ui.hideTip = function () {
  if (!tipEl) tipEl = GM.$("#tip");
  if (tipEl) tipEl.classList.remove("on");
};

GM.ui.bindTips = function (root) {
  GM.on(root, "mousemove", function (e) {
    var node = e.target && e.target.closest ? e.target.closest("[data-tip]") : null;
    if (!node) { GM.ui.hideTip(); return; }
    var raw = node.dataset.tip;
    var i = raw.indexOf(":");
    var fn = tipProviders[i < 0 ? raw : raw.slice(0, i)];
    if (!fn) { GM.ui.hideTip(); return; }
    GM.ui.showTip(fn(i < 0 ? "" : raw.slice(i + 1), node), e.clientX, e.clientY);
  });
  GM.on(root, "mouseleave", GM.ui.hideTip);
};

GM.ui.tipProvider("txt", function (s) { return "<div>" + GM.esc(s) + "</div>"; });

GM.ui.tipProvider("cur", function (which) {
  var T = {
    gold:   ["Gold", "Raises the parish and respecs the tree."],
    shards: ["Shards", "Cut names into heroes, and anoint them."],
    ichor:  ["Ichor", "Won by ascending. Buys permanent warband perks."],
    marks:  ["Marks", "Cleared floors of the Divine Tower."],
    dust:   ["Dust", "Folded out of Alternate Dimensions."]
  }[which];
  if (!T) return "";
  return '<div class="tname gold">' + T[0] + "</div><div>" + GM.esc(T[1]) + "</div>";
});

/* ---------- hero tooltip ------------------------------------------------- */
GM.ui.tipProvider("hero", function (id) {
  var h = GM.heroById(id);
  if (!h) return "";
  var cls = GM.heroClass(h), rank = GM.heroRank(h);
  var st = GM.heroStats(h, null);
  var sq = GM.squadOf(h.id);
  var out = ['<div class="tname" style="color:hsl(' + cls.hue + ',55%,65%)">' +
             GM.esc(h.name) + ' <span class="' + rank.css + '">' + rank.numeral + "</span></div>"];
  out.push('<div class="tbase">' + GM.esc(rank.name) + " " + GM.esc(cls.name) +
           " · " + GM.esc(cls.role) + " · level " + h.level + " / " + GM.heroMaxLevel(h) + "</div>");
  out.push('<div class="tstat">' + GM.fmt(st.dps) + " dps · " + GM.fmt(st.life) + " life</div>");
  out.push('<div class="tstat faint">' + GM.fmt(st.armour) + " armour · " +
           GM.fmt(st.evasion) + " evasion · " + st.attackSpeed.toFixed(2) + " atk/s</div>");
  out.push('<div class="tstat faint">' + GM.esc(sq ? sq.name : "Benched") + "</div>");
  (h.traits || []).forEach(function (t) {
    out.push('<div class="tstat tinscribed">' + GM.esc(GM.statLine(t.stat, t.value)) +
             ' <span class="tt">T' + (t.displayTier || t.tier) + "</span></div>");
  });
  out.push('<div class="flavour" style="margin-top:4px">' + GM.esc(cls.blurb) + "</div>");
  out.push('<div class="tcmp">Click to inspect.</div>');
  return out.join("");
});

/* ---------- epitaph tooltip ---------------------------------------------- */
GM.ui.epitaphTipHTML = function (e) {
  var def = GM.AFFIX_BY_ID[e.affixId];
  var h = ['<div class="tname gold">' + GM.esc(e.name) + ' <span class="tt">T' + (e.displayTier || e.tier) + "</span></div>"];
  h.push('<div class="tstat">' + GM.esc(GM.statLine(e.stat, e.value)) + "</div>");
  h.push('<div class="tbase">from depth ' + e.from + (e.who ? ", " + GM.esc(e.who) : "") + "</div>");
  if (def) h.push('<div class="tstat faint">' + GM.esc(def.classes.map(function (c) {
    return (GM.CLASS_BY_ID[c] || {}).name || c;
  }).join(", ")) + "</div>");
  return h.join("");
};

GM.ui.tipProvider("epitaph", function (id) {
  var e = GM.byId(GM.state.epitaphs, id);
  return e ? GM.ui.epitaphTipHTML(e) : "";
});

/* ---------- shared bits -------------------------------------------------- */
GM.ui.statRow = function (k, v) {
  var d = GM.el("div", "stat");
  d.innerHTML = '<span class="k">' + GM.esc(k) + '</span><span class="v">' + GM.esc(v) + "</span>";
  return d;
};

GM.ui.init = function () {
  GM.ui.bindTips(document.body);
  /* Phone layout: one column, one section at a time, switched by the bottom
     tabs. On a wide screen the tabs are hidden and all three columns show. */
  GM.delegate(GM.$("#mobileTabs"), "click", "[data-view]", function (e, node) {
    var app = GM.$("#app");
    if (app) app.dataset.view = node.dataset.view;
    GM.$$("#mobileTabs button").forEach(function (b) { b.classList.toggle("on", b === node); });
    GM.ui.markDirty();
    GM.ui.redrawHub();
    window.dispatchEvent(new Event("resize"));
  });
  GM.on(document, "keydown", function (e) {
    if (e.key === "Escape") GM.ui.closeOverlay();
  });
  ["tree:changed", "town:changed", "perks:changed",
   "graves:changed", "epitaphs:changed", "roster:changed", "squads:changed",
   "depth:changed", "mode:changed", "ascend", "quest:changed", "level:changed"
  ].forEach(function (evt) {
    GM.bus.on(evt, function () { GM.ui.markDirty(); });
  });
};
