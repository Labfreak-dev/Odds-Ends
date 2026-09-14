/* Gravemark — 30-ui.js
   UI core: tabs, the top bar, tooltips, toasts, modals, the chronicle, and
   the item-tooltip builder every other panel reuses.

   Panels register a render function with `GM.ui.panel(view, fn)`; the router
   calls only the visible one, so a 200-item stash is not rebuilt while the
   player is looking at the tree. */
"use strict";

GM.ui = GM.ui || {};

var VIEWS = ["delve", "gear", "bench", "tree", "town", "graves", "modes", "ascend"];
var renderers = {};
var current = "delve";
var dirty = {};

GM.ui.panel = function (view, fn) { renderers[view] = fn; };

GM.ui.markDirty = function (view) {
  if (view) dirty[view] = true;
  else VIEWS.forEach(function (v) { dirty[v] = true; });
  if (dirty[current]) GM.ui.renderCurrent();
};

GM.ui.renderCurrent = function () {
  var fn = renderers[current];
  if (!fn) return;
  dirty[current] = false;
  try { fn(); }
  catch (e) { console.error("[GM.ui] render " + current + " failed", e); }
};

GM.ui.show = function (view) {
  if (VIEWS.indexOf(view) < 0) return;
  current = view;
  VIEWS.forEach(function (v) {
    var el = GM.$("#view-" + v);
    if (el) el.hidden = v !== view;
  });
  GM.$$(".tab").forEach(function (t) { t.classList.toggle("on", t.dataset.view === view); });
  GM.ui.renderCurrent();
  GM.bus.emit("view:changed", view);
};

GM.ui.currentView = function () { return current; };

/* ---------- top bar ------------------------------------------------------ */
GM.ui.renderTop = function () {
  var c = GM.state.char, d = GM.state.depth;
  function set(id, v) { var e = GM.$(id); if (e) e.textContent = v; }
  set("#rLevel", c.level);
  set("#rDepth", d.current + (d.maxEver > d.current ? " / " + d.maxEver : ""));
  set("#rGold", GM.fmt(c.gold));
  set("#rShards", GM.fmt(c.shards));
  set("#rIchor", GM.fmt(c.ichor));
  set("#rMarks", GM.fmt(c.marks));
  set("#rDust", GM.fmt(c.dust));
  GM.show(GM.$("#rMarksWrap"), c.marks > 0);
  GM.show(GM.$("#rDustWrap"), c.dust > 0);

  var tb = GM.$("#treeBadge");
  if (tb) { tb.textContent = GM.state.tree.points; GM.show(tb, GM.state.tree.points > 0); }
  var gb = GM.$("#graveBadge");
  if (gb) {
    var n = GM.state.graves.length;
    gb.textContent = n; GM.show(gb, n > 0);
  }
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

/* ---------- modal -------------------------------------------------------- */
GM.ui.modal = function (title, bodyHTML, buttons) {
  var wrap = GM.$("#modalWrap"), box = GM.$("#modal");
  if (!wrap || !box) return;
  box.innerHTML = "<h3>" + GM.esc(title) + "</h3>" + bodyHTML;
  var row = GM.el("div", "row");
  row.style.marginTop = "14px";
  (buttons || [{ label: "Close" }]).forEach(function (b) {
    var btn = GM.el("button", "btn" + (b.cls ? " " + b.cls : ""), b.label);
    GM.on(btn, "click", function () {
      if (b.onClick) b.onClick();
      if (!b.keepOpen) GM.ui.closeModal();
    });
    row.appendChild(btn);
  });
  box.appendChild(row);
  wrap.hidden = false;
};

GM.ui.closeModal = function () {
  var wrap = GM.$("#modalWrap");
  if (wrap) wrap.hidden = true;
};

/* ---------- tooltip ------------------------------------------------------
   One shared node, positioned on hover. Content is built by whoever owns the
   element via a `data-tip` lookup registered here. */
var tipEl = null;
var tipProviders = {};

GM.ui.tipProvider = function (name, fn) { tipProviders[name] = fn; };

GM.ui.showTip = function (html, x, y) {
  if (!tipEl) tipEl = GM.$("#tip");
  if (!tipEl) return;
  tipEl.innerHTML = html;
  tipEl.classList.add("on");
  var r = tipEl.getBoundingClientRect();
  var px = Math.min(x + 16, window.innerWidth - r.width - 10);
  var py = Math.min(y + 16, window.innerHeight - r.height - 10);
  tipEl.style.left = Math.max(6, px) + "px";
  tipEl.style.top = Math.max(6, py) + "px";
};

GM.ui.hideTip = function () {
  if (!tipEl) tipEl = GM.$("#tip");
  if (tipEl) tipEl.classList.remove("on");
};

GM.ui.bindTips = function (root) {
  GM.on(root, "mousemove", function (e) {
    var node = e.target.closest ? e.target.closest("[data-tip]") : null;
    if (!node) { GM.ui.hideTip(); return; }
    var parts = node.dataset.tip.split(":");
    var fn = tipProviders[parts[0]];
    if (!fn) { GM.ui.hideTip(); return; }
    var html = fn(parts.slice(1).join(":"), node);
    if (!html) { GM.ui.hideTip(); return; }
    GM.ui.showTip(html, e.clientX, e.clientY);
  });
  GM.on(root, "mouseleave", GM.ui.hideTip);
  /* Touch: tap shows the tooltip, anywhere else dismisses it. */
  GM.on(root, "touchstart", function (e) {
    var node = e.target.closest ? e.target.closest("[data-tip]") : null;
    if (!node) { GM.ui.hideTip(); return; }
    var parts = node.dataset.tip.split(":");
    var fn = tipProviders[parts[0]];
    if (!fn) return;
    var html = fn(parts.slice(1).join(":"), node);
    var t = e.touches[0];
    if (html && t) GM.ui.showTip(html, t.clientX - 40, t.clientY - 120);
  }, { passive: true });
};

/* ---------- item tooltip ------------------------------------------------- */
GM.ui.itemTipHTML = function (item, compareSlot) {
  if (!item) return "";
  var base = GM.BASE_BY_ID[item.baseId];
  var rar = GM.RARITY_BY_ID[item.rarity];
  var h = [];

  h.push('<div class="tname ' + rar.css + '">' + GM.esc(GM.itemName(item)) + "</div>");
  h.push('<div class="tbase">' + GM.esc(base ? base.name : "?") + " · " +
         GM.esc(rar.name) + " · ilvl " + item.ilvl + "</div>");

  if (base && base.pool === "weapon") {
    var dmg = Math.round(base.dmg * GM.ilvlScale(item.ilvl));
    h.push('<div class="tstat faint">' + dmg + " base damage · " +
           base.as.toFixed(2) + " atk/s · " + GM.pct(base.crit, 0) + " crit</div>");
  }
  if (base && base.implicit) {
    h.push('<div class="tstat" style="color:var(--r1)">' +
           GM.esc(GM.statLine(base.implicit.stat,
             GM.STAT_DEFS[base.implicit.stat] && GM.STAT_DEFS[base.implicit.stat].pct
               ? base.implicit.value
               : base.implicit.value * GM.ilvlScale(item.ilvl))) + "</div>");
  }

  var inscribed = item.inscribed || [];
  (item.affixes || []).forEach(function (a) {
    var isIns = inscribed.indexOf(a.id) >= 0;
    h.push('<div class="tstat' + (isIns ? " tinscribed" : "") + '">' +
           GM.esc(GM.statLine(a.stat, a.value)) +
           ' <span class="tt">T' + (a.displayTier || a.tier) + (isIns ? " ✓" : "") + "</span></div>");
  });

  if ((item.sockets || []).length) {
    var sock = item.sockets.map(function (r) {
      return r ? (GM.RUNE_BY_ID[r] || {}).name || "?" : "○";
    }).join(" · ");
    h.push('<div class="tstat faint" style="margin-top:4px">Sockets: ' + GM.esc(sock) + "</div>");
    var rw = GM.matchRuneword(base ? base.pool : null, item.sockets);
    if (rw) {
      h.push('<div class="trw">' + GM.esc(rw.name));
      for (var k in rw.stats) h.push("<br>" + GM.esc(GM.statLine(k, rw.stats[k])));
      h.push('<br><span class="faint">"' + GM.esc(rw.flavour) + '"</span></div>');
    }
  }

  /* Compare against what is worn. */
  var slots = GM.slotsForItem(item);
  var slot = compareSlot || slots[0];
  if (slot && GM.state.equip[slot] !== item) {
    var now = GM.powerScore(GM.stats({}));
    var then = GM.powerScore(GM.statsWith(slot, item, {}));
    var d = (then - now) / Math.max(1, now);
    var cls = d > 0.0005 ? "up" : d < -0.0005 ? "down" : "faint";
    var sign = d > 0 ? "+" : "";
    h.push('<div class="tcmp">vs equipped: <span class="' + cls + '">' +
           sign + (d * 100).toFixed(1) + "%</span> power</div>");
  }
  if (item.locked) h.push('<div class="tstat gold">\u{1F512} Locked</div>');
  return h.join("");
};

GM.ui.tipProvider("item", function (id) {
  var it = GM.ui.findItem(id);
  return it ? GM.ui.itemTipHTML(it) : "";
});

/* Find an item by id across equipment and stash. */
GM.ui.findItem = function (id) {
  for (var i = 0; i < GM.SLOT_IDS.length; i++) {
    var e = GM.state.equip[GM.SLOT_IDS[i]];
    if (e && e.id === id) return e;
  }
  for (i = 0; i < GM.state.stash.length; i++) {
    if (GM.state.stash[i].id === id) return GM.state.stash[i];
  }
  return null;
};

/* ---------- shared renderers --------------------------------------------- */
GM.ui.itemCell = function (item, opts) {
  opts = opts || {};
  var rar = GM.RARITY_BY_ID[item.rarity];
  var base = GM.BASE_BY_ID[item.baseId];
  var d = GM.el("div", "slot bl" + item.rarity);
  d.dataset.tip = "item:" + item.id;
  d.dataset.item = item.id;
  if (opts.cls) d.className += " " + opts.cls;

  var ico = GM.el("canvas", "ico");
  ico.width = ico.height = 30;
  var c = ico.getContext("2d");
  if (c) GM.drawSprite(c, GM.itemArtKey(item), 0, 0, 0, 30, 30, { label: false, dark: true });
  d.appendChild(ico);

  var nm = GM.el("div", "nm");
  nm.innerHTML = '<span class="sl">' + GM.esc(base ? base.kindLabel : "?") +
                 (item.locked ? " \u{1F512}" : "") + "</span>" +
                 '<span class="' + rar.css + '">' + GM.esc(GM.itemName(item)) + "</span>";
  if ((item.sockets || []).length) {
    var sw = GM.el("div", "socks");
    item.sockets.forEach(function (r) {
      var s = GM.el("span", "sock" + (r ? " full" : ""), r ? (GM.RUNE_BY_ID[r] || {}).name.charAt(0) : "");
      sw.appendChild(s);
    });
    nm.appendChild(sw);
  }
  d.appendChild(nm);
  return d;
};

GM.ui.statRow = function (k, v) {
  var d = GM.el("div", "stat");
  d.innerHTML = '<span class="k">' + GM.esc(k) + '</span><span class="v">' + GM.esc(v) + "</span>";
  return d;
};

/* ---------- chronicle ---------------------------------------------------- */
var logEl = null;
GM.ui.renderLog = function () {
  if (!logEl) logEl = GM.$("#log");
  if (!logEl) return;
  var atBottom = logEl.scrollTop + logEl.clientHeight >= logEl.scrollHeight - 24;
  var rows = GM.state.log.slice(-60);
  logEl.innerHTML = rows.map(function (r) {
    return '<div class="k-' + GM.esc(r.kind) + '">' + GM.esc(r.text) + "</div>";
  }).join("");
  if (atBottom) logEl.scrollTop = logEl.scrollHeight;
};

/* ---------- wiring ------------------------------------------------------- */
GM.ui.init = function () {
  GM.$$(".tab").forEach(function (t) {
    GM.on(t, "click", function () { GM.ui.show(t.dataset.view); });
  });
  GM.ui.bindTips(document.body);
  GM.on(GM.$("#modalWrap"), "click", function (e) {
    if (e.target.id === "modalWrap") GM.ui.closeModal();
  });
  GM.on(document, "keydown", function (e) {
    if (e.key === "Escape") GM.ui.closeModal();
  });

  var stamp = GM.$("#buildStamp");
  if (stamp) stamp.textContent = "v0.1 · " + GM.BUILD;

  GM.bus.on("log", function () { if (current === "delve") GM.ui.renderLog(); });
  ["gear:changed", "stash:changed", "tree:changed", "town:changed", "perks:changed",
   "graves:changed", "epitaphs:changed", "mode:changed", "depth:changed", "ascend"
  ].forEach(function (evt) {
    GM.bus.on(evt, function () { GM.ui.markDirty(); GM.ui.renderTop(); });
  });
};
