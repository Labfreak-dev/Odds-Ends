/* Gravemark — 00-util.js
   Namespace, RNG, number formatting, DOM helpers, event bus.
   Classic script, no import/export. Everything hangs off the single global GM. */
"use strict";

var GM = window.GM || (window.GM = {});

GM.BUILD = "b003-bosses";
GM.TITLE = "Gravemark";

/* ---------- RNG ---------------------------------------------------------
   mulberry32: small, fast, seedable. Seedable matters because a dropped item
   is stored as (seed, ilvl, baseId) and re-rolled on load rather than being
   persisted affix-by-affix — saves stay small even with a 400-slot stash. */
GM.rngFrom = function (seed) {
  var a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    var t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/* Ambient stream, reseeded at boot from the save. */
GM.rng = GM.rngFrom((Date.now() ^ 0x9e3779b9) >>> 0);

GM.rand    = function () { return GM.rng(); };
GM.randInt = function (lo, hi) { return lo + Math.floor(GM.rng() * (hi - lo + 1)); };
GM.randF   = function (lo, hi) { return lo + GM.rng() * (hi - lo); };
GM.pick    = function (arr) { return arr[Math.floor(GM.rng() * arr.length)]; };
GM.chance  = function (p) { return GM.rng() < p; };

/* Weighted pick. `weightOf` defaults to reading `.w` (absent == 1). */
GM.pickW = function (arr, weightOf, rnd) {
  var f = weightOf || function (x) { return x.w == null ? 1 : x.w; };
  var r01 = rnd || GM.rng;
  var total = 0, i;
  for (i = 0; i < arr.length; i++) total += f(arr[i]);
  if (total <= 0) return arr[0];
  var r = r01() * total;
  for (i = 0; i < arr.length; i++) {
    r -= f(arr[i]);
    if (r <= 0) return arr[i];
  }
  return arr[arr.length - 1];
};

/* Deterministic 32-bit FNV-1a. Unsigned shifts only — a signed >> here would
   flip high-bit hashes negative and collide seeds. */
GM.hash = function (str) {
  var h = 2166136261 >>> 0;
  for (var i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
};

GM.uid = (function () {
  var n = 0;
  return function (prefix) {
    return (prefix || "i") + (++n).toString(36) + "_" + ((GM.rng() * 1e9) >>> 0).toString(36);
  };
})();

/* ---------- numbers -----------------------------------------------------
   Idle numbers run away fast; short-scale suffixes, then exponential. */
var SUFFIX = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc", "Ud", "Dd"];

GM.fmt = function (n, places) {
  if (n == null || !isFinite(n)) return "—";
  var neg = n < 0;
  n = Math.abs(n);
  if (n < 1000) {
    var p = places == null ? (n < 10 && n % 1 !== 0 ? 1 : 0) : places;
    return (neg ? "-" : "") + n.toFixed(p).replace(/\.0+$/, "");
  }
  var tier = Math.floor(Math.log10(n) / 3);
  if (tier >= SUFFIX.length) {
    return (neg ? "-" : "") + n.toExponential(2).replace("e+", "e");
  }
  var s = n / Math.pow(10, tier * 3);
  return (neg ? "-" : "") + s.toFixed(s < 10 ? 2 : s < 100 ? 1 : 0) + SUFFIX[tier];
};

GM.pct  = function (x, p) { return (x * 100).toFixed(p == null ? 1 : p) + "%"; };
GM.sign = function (n) { return (n >= 0 ? "+" : "") + GM.fmt(n); };

GM.fmtTime = function (sec) {
  if (!isFinite(sec) || sec < 0) return "—";
  if (sec < 1)  return sec.toFixed(2) + "s";
  if (sec < 60) return sec.toFixed(1) + "s";
  var m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  if (m < 60) return m + "m " + s + "s";
  var h = Math.floor(m / 60); m %= 60;
  if (h < 24) return h + "h " + m + "m";
  var d = Math.floor(h / 24); h %= 24;
  return d + "d " + h + "h";
};

GM.clamp = function (x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; };
GM.lerp  = function (a, b, t) { return a + (b - a) * t; };

var ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV"];
GM.roman = function (n) { return ROMAN[n] || String(n); };

GM.ordinal = function (n) {
  var s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

/* ---------- DOM ---------------------------------------------------------- */
GM.$  = function (sel, root) { return (root || document).querySelector(sel); };
GM.$$ = function (sel, root) {
  return Array.prototype.slice.call((root || document).querySelectorAll(sel));
};

GM.el = function (tag, cls, text) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

GM.esc = function (s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
};

GM.on = function (node, evt, fn, opts) {
  if (node) node.addEventListener(evt, fn, opts || false);
  return fn;
};

/* Delegated listener. The stash and the tree redraw constantly; binding per
   element would leak handlers on every repaint. */
GM.delegate = function (root, evt, sel, fn) {
  if (!root) return;
  GM.on(root, evt, function (e) {
    var t = e.target && e.target.closest ? e.target.closest(sel) : null;
    if (t && root.contains(t)) fn.call(t, e, t);
  });
};

GM.show = function (node, on) { if (node) node.hidden = !on; };

/* ---------- event bus ---------------------------------------------------- */
GM.bus = (function () {
  var map = {};
  return {
    on: function (name, fn) { (map[name] || (map[name] = [])).push(fn); return fn; },
    off: function (name, fn) {
      var a = map[name];
      if (!a) return;
      var i = a.indexOf(fn);
      if (i >= 0) a.splice(i, 1);
    },
    emit: function (name, payload) {
      var a = map[name];
      if (!a) return;
      for (var i = 0; i < a.length; i++) {
        /* One bad listener must not stop the tick loop or the others. */
        try { a[i](payload); }
        catch (err) { console.error("[GM.bus] " + name + " listener threw", err); }
      }
    }
  };
})();

/* ---------- misc --------------------------------------------------------- */
GM.deepClone = function (o) { return JSON.parse(JSON.stringify(o)); };

/* Merge into an existing object rather than replacing it — modules capture
   state objects at load time, so `state.x = {...}` would orphan their handle. */
GM.assign = function (dst, src) {
  for (var k in src) if (Object.prototype.hasOwnProperty.call(src, k)) dst[k] = src[k];
  return dst;
};

GM.sumBy = function (arr, f) {
  var t = 0;
  for (var i = 0; i < arr.length; i++) t += f(arr[i]) || 0;
  return t;
};

GM.byId = function (arr, id) {
  for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i];
  return null;
};

/* Index an array of {id,...} into a lookup map. */
GM.indexById = function (arr) {
  var m = Object.create(null);
  for (var i = 0; i < arr.length; i++) m[arr[i].id] = arr[i];
  return m;
};
