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
    shards: ["Shards", "The crafting bench: sockets, rerolls, inscription."],
    ichor:  ["Ichor", "Won by ascending. Buys permanent warband perks."],
    marks:  ["Marks", "Cleared floors of the Divine Tower."],
    dust:   ["Dust", "Folded out of Alternate Dimensions."]
  }[which];
  if (!T) return "";
  return '<div class="tname gold">' + T[0] + "</div><div>" + GM.esc(T[1]) + "</div>";
});

/* ---------- item tooltip ------------------------------------------------- */
GM.ui.itemTipHTML = function (item, hero, compareSlot) {
  if (!item) return "";
  var base = GM.BASE_BY_ID[item.baseId];
  var rar = GM.RARITY_BY_ID[item.rarity];
  var h = [];

  h.push('<div class="tname ' + rar.css + '">' + GM.esc(GM.itemName(item)) + "</div>");
  h.push('<div class="tbase">' + GM.esc(base ? base.name : "?") + " · " +
         GM.esc(rar.name) + " · ilvl " + item.ilvl + "</div>");

  if (base && base.pool === "weapon") {
    h.push('<div class="tstat faint">' + Math.round(base.dmg * GM.ilvlScale(item.ilvl)) +
           " base damage · " + base.as.toFixed(2) + " atk/s</div>");
  }
  if (base && base.implicit) {
    var d = GM.STAT_DEFS[base.implicit.stat];
    h.push('<div class="tstat" style="color:var(--r1)">' +
      GM.esc(GM.statLine(base.implicit.stat,
        d && d.pct ? base.implicit.value : base.implicit.value * GM.ilvlScale(item.ilvl))) + "</div>");
  }

  var inscribed = item.inscribed || [];
  (item.affixes || []).forEach(function (a) {
    var ins = inscribed.indexOf(a.id) >= 0;
    h.push('<div class="tstat' + (ins ? " tinscribed" : "") + '">' +
      GM.esc(GM.statLine(a.stat, a.value)) +
      ' <span class="tt">T' + (a.displayTier || a.tier) + (ins ? " ✓" : "") + "</span></div>");
  });

  if ((item.sockets || []).length) {
    h.push('<div class="tstat faint" style="margin-top:3px">Sockets: ' +
      GM.esc(item.sockets.map(function (r) {
        return r ? (GM.RUNE_BY_ID[r] || {}).name || "?" : "○";
      }).join(" · ")) + "</div>");
    var rw = GM.matchRuneword(base ? base.pool : null, item.sockets);
    if (rw) {
      h.push('<div class="trw">' + GM.esc(rw.name));
      for (var k in rw.stats) h.push("<br>" + GM.esc(GM.statLine(k, rw.stats[k])));
      h.push('<br><span class="faint">"' + GM.esc(rw.flavour) + '"</span></div>');
    }
  }

  if (hero) {
    var slot = compareSlot || GM.slotsForItem(item)[0];
    if (slot && hero.equip[slot] !== item) {
      var now = GM.powerScore(GM.heroStats(hero, null));
      var then = GM.powerScore(GM.heroStatsWith(hero, slot, item, null));
      var delta = (then - now) / Math.max(1, now);
      var cls = delta > 0.0005 ? "up" : delta < -0.0005 ? "down" : "faint";
      h.push('<div class="tcmp">on ' + GM.esc(hero.name) + ': <span class="' + cls + '">' +
        (delta > 0 ? "+" : "") + (delta * 100).toFixed(1) + "%</span> power</div>");
    }
  }
  if (item.locked) h.push('<div class="tstat gold">\u{1F512} Locked</div>');
  return h.join("");
};

GM.ui.tipProvider("item", function (id) {
  var f = GM.ui.findItem(id);
  return f ? GM.ui.itemTipHTML(f.item, f.hero) : "";
});

/* Find an item anywhere: worn by any hero, or in the stash. */
GM.ui.findItem = function (id) {
  var hs = GM.state.heroes || [];
  for (var h = 0; h < hs.length; h++) {
    for (var i = 0; i < GM.SLOT_IDS.length; i++) {
      var it = hs[h].equip[GM.SLOT_IDS[i]];
      if (it && it.id === id) return { item: it, hero: hs[h], slot: GM.SLOT_IDS[i] };
    }
  }
  for (i = 0; i < GM.state.stash.length; i++) {
    if (GM.state.stash[i].id === id) return { item: GM.state.stash[i], hero: null };
  }
  return null;
};

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
  out.push('<div class="flavour" style="margin-top:4px">' + GM.esc(cls.blurb) + "</div>");
  out.push('<div class="tcmp">Click to inspect and equip.</div>');
  return out.join("");
});

/* ---------- shared bits -------------------------------------------------- */
GM.ui.itemCell = function (item, hero, opts) {
  opts = opts || {};
  var rar = GM.RARITY_BY_ID[item.rarity];
  var base = GM.BASE_BY_ID[item.baseId];
  var d = GM.el("div", "slot bl" + item.rarity + (opts.cls ? " " + opts.cls : ""));
  d.dataset.tip = "item:" + item.id;
  d.dataset.item = item.id;

  var ico = GM.el("canvas", "ico");
  ico.width = ico.height = 28;
  var c = ico.getContext("2d");
  if (c) GM.drawSprite(c, GM.itemArtKey(item), 0, 0, 0, 28, 28, { label: false, dark: true });
  d.appendChild(ico);

  var nm = GM.el("div", "nm");
  nm.innerHTML = '<span class="sl">' + GM.esc(base ? base.kindLabel : "?") +
                 (item.locked ? " \u{1F512}" : "") + "</span>" +
                 '<span class="' + rar.css + '">' + GM.esc(GM.itemName(item)) + "</span>";
  if ((item.sockets || []).length) {
    var sw = GM.el("div", "socks");
    item.sockets.forEach(function (r) {
      sw.appendChild(GM.el("span", "sock" + (r ? " full" : ""),
        r ? (GM.RUNE_BY_ID[r] || {}).name.charAt(0) : ""));
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

GM.ui.init = function () {
  GM.ui.bindTips(document.body);
  GM.on(document, "keydown", function (e) {
    if (e.key === "Escape") GM.ui.closeOverlay();
  });
  ["gear:changed", "stash:changed", "tree:changed", "town:changed", "perks:changed",
   "graves:changed", "epitaphs:changed", "roster:changed", "squads:changed",
   "depth:changed", "mode:changed", "ascend", "quest:changed", "level:changed"
  ].forEach(function (evt) {
    GM.bus.on(evt, function () { GM.ui.markDirty(); });
  });
};
