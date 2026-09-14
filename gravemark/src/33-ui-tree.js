/* Gravemark — 33-ui-tree.js
   The passive tree: a pan/zoom canvas with click-to-allocate.

   Drawn rather than DOM'd because ~110 nodes and their links as elements
   makes every repaint a layout thrash, and because pan/zoom on a canvas is
   one transform instead of a hundred style writes. */
"use strict";

var tc = null, tctx = null, wrap = null;
var view = { x: 0, y: 0, z: 0.78 };
var dragging = false, dragMoved = false, lastPt = null;
var hover = null;
var userAdjusted = false;   /* once the player pans or zooms, stop auto-fitting */

/* The outermost ring sits 496px from the root, so a fixed default zoom clips
   the bottom clusters on short viewports. Fit to whatever space there is. */
function fitZoom() {
  if (!wrap) return;
  var r = wrap.getBoundingClientRect();
  if (!r.width || !r.height) return;
  var outer = 540;                       /* ring 7 radius plus node radius */
  view.x = 0; view.y = 0;
  view.z = GM.clamp(Math.min(r.width, r.height) / (2 * outer), 0.3, 2.4);
}

function clusterHue(id) {
  var c = GM.byId(GM.TREE_CLUSTERS, id);
  return c ? c.hue : 40;
}

function resize() {
  if (!tc || !wrap) return;
  if (!userAdjusted) fitZoom();
  var r = wrap.getBoundingClientRect();
  var dpr = window.devicePixelRatio || 1;
  tc.width = Math.max(1, Math.floor(r.width * dpr));
  tc.height = Math.max(1, Math.floor(r.height * dpr));
  tc.style.width = r.width + "px";
  tc.style.height = r.height + "px";
  if (tctx) tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawTree();
}

function toScreen(n) {
  var r = wrap.getBoundingClientRect();
  return {
    x: r.width / 2 + (n.x + view.x) * view.z,
    y: r.height / 2 + (n.y + view.y) * view.z
  };
}

function nodeRadius(n) {
  return n.kind === "keystone" ? 17 : n.kind === "notable" ? 12 : n.kind === "root" ? 14 : 7;
}

function nodeAt(px, py) {
  for (var i = GM.TREE_NODES.length - 1; i >= 0; i--) {
    var n = GM.TREE_NODES[i];
    var s = toScreen(n);
    var rad = (nodeRadius(n) + 5) * view.z;
    var dx = px - s.x, dy = py - s.y;
    if (dx * dx + dy * dy <= rad * rad) return n;
  }
  return null;
}

function drawTree() {
  if (!tctx || !wrap) return;
  var r = wrap.getBoundingClientRect();
  tctx.clearRect(0, 0, r.width, r.height);

  /* links first, so nodes sit on top */
  tctx.lineWidth = Math.max(1, 2 * view.z);
  var drawn = {};
  GM.TREE_NODES.forEach(function (n) {
    n.links.forEach(function (lid) {
      var key = n.id < lid ? n.id + "|" + lid : lid + "|" + n.id;
      if (drawn[key]) return;
      drawn[key] = true;
      var o = GM.TREE_BY_ID[lid];
      if (!o) return;
      var a = toScreen(n), b = toScreen(o);
      var both = GM.hasNode(n.id) && GM.hasNode(o.id);
      var either = GM.hasNode(n.id) || GM.hasNode(o.id) || n.id === "root" || o.id === "root";
      tctx.strokeStyle = both ? "rgba(217,180,92,.65)"
                       : either ? "rgba(140,150,175,.26)"
                                : "rgba(90,100,125,.13)";
      tctx.beginPath();
      tctx.moveTo(a.x, a.y);
      tctx.lineTo(b.x, b.y);
      tctx.stroke();
    });
  });

  GM.TREE_NODES.forEach(function (n) {
    var s = toScreen(n);
    var rad = nodeRadius(n) * view.z;
    if (s.x < -40 || s.y < -40 || s.x > r.width + 40 || s.y > r.height + 40) return;

    var has = GM.hasNode(n.id) || n.kind === "root";
    var can = !has && GM.canAllocate(n.id).ok;
    var hue = n.cluster ? clusterHue(n.cluster) : 45;

    tctx.beginPath();
    tctx.arc(s.x, s.y, rad, 0, Math.PI * 2);
    tctx.fillStyle = has ? "hsl(" + hue + ",58%,52%)"
                   : can ? "hsl(" + hue + ",34%,26%)"
                         : "hsl(" + hue + ",14%,15%)";
    tctx.fill();

    tctx.lineWidth = (n === hover ? 3 : n.kind === "minor" ? 1 : 2) * Math.max(0.6, view.z);
    tctx.strokeStyle = n === hover ? "#e6e0cf"
                     : has ? "hsl(" + hue + ",70%,72%)"
                     : can ? "hsl(" + hue + ",42%,46%)"
                           : "rgba(120,130,155,.22)";
    tctx.stroke();

    /* Keystones and notables get a mark so the eye can find them while panning. */
    if (n.kind === "keystone" || n.kind === "notable") {
      tctx.fillStyle = has ? "#12140f" : "rgba(230,224,207,.5)";
      tctx.font = "600 " + Math.max(8, 10 * view.z) + "px ui-monospace,monospace";
      tctx.textAlign = "center";
      tctx.textBaseline = "middle";
      tctx.fillText(n.kind === "keystone" ? "✦" : "◆", s.x, s.y);
    }
  });

  var hud = GM.$("#treeHud");
  if (hud) {
    hud.textContent = GM.state.tree.points + " point" + (GM.state.tree.points === 1 ? "" : "s") +
      " · " + GM.state.tree.spent.length + " allocated";
  }
}

function nodeTipHTML(n) {
  if (!n) return "";
  var has = GM.hasNode(n.id);
  var can = GM.canAllocate(n.id);
  var h = ['<div class="tname">' + GM.esc(n.name) + "</div>"];
  h.push('<div class="tbase">' + GM.esc(n.kind) +
         (n.cluster ? " · " + GM.esc((GM.byId(GM.TREE_CLUSTERS, n.cluster) || {}).name) : "") + "</div>");
  for (var k in n.stats) {
    var v = n.stats[k];
    /* The Unlit Lamp zeroes armour with a large negative; show intent, not the number. */
    if (k === "flatArmour" && v < -1000) { h.push('<div class="tstat down">Armour is always zero</div>'); continue; }
    h.push('<div class="tstat' + (v < 0 ? " down" : "") + '">' + GM.esc(GM.statLine(k, v)) + "</div>");
  }
  if (n.desc) h.push('<div class="flavour" style="margin-top:4px">' + GM.esc(n.desc) + "</div>");
  h.push('<div class="tcmp">' + (has ? "Allocated" : can.ok ? "Click to allocate" : GM.esc(can.why)) + "</div>");
  return h.join("");
}

GM.ui.renderTree = function () {
  var sub = GM.$("#treeSub");
  if (sub) {
    sub.textContent = GM.state.tree.points + " unspent · " +
      GM.state.tree.spent.length + " / " + (GM.TREE_NODES.length - 1) + " taken";
  }
  var rc = GM.$("#respecCost");
  if (rc) rc.textContent = GM.state.tree.spent.length
    ? "Refund all for " + GM.fmt(GM.respecCost()) + " gold"
    : "";
  resize();
};

GM.ui.initTree = function () {
  tc = GM.$("#treeCanvas");
  wrap = GM.$("#treeWrap");
  if (!tc || !wrap) return;
  tctx = tc.getContext("2d");

  GM.on(window, "resize", resize);

  GM.on(wrap, "mousedown", function (e) {
    dragging = true; dragMoved = false;
    lastPt = { x: e.clientX, y: e.clientY };
    wrap.classList.add("drag");
  });

  GM.on(window, "mouseup", function () {
    dragging = false;
    wrap.classList.remove("drag");
  });

  GM.on(wrap, "mousemove", function (e) {
    var r = wrap.getBoundingClientRect();
    var px = e.clientX - r.left, py = e.clientY - r.top;

    if (dragging && lastPt) {
      var dx = e.clientX - lastPt.x, dy = e.clientY - lastPt.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) dragMoved = true;
      userAdjusted = true;
      view.x += dx / view.z;
      view.y += dy / view.z;
      lastPt = { x: e.clientX, y: e.clientY };
      drawTree();
      GM.ui.hideTip();
      return;
    }

    var n = nodeAt(px, py);
    if (n !== hover) { hover = n; drawTree(); }
    if (n) GM.ui.showTip(nodeTipHTML(n), e.clientX, e.clientY);
    else GM.ui.hideTip();
  });

  GM.on(wrap, "mouseleave", function () {
    hover = null; dragging = false;
    wrap.classList.remove("drag");
    drawTree(); GM.ui.hideTip();
  });

  GM.on(wrap, "click", function (e) {
    if (dragMoved) { dragMoved = false; return; }
    var r = wrap.getBoundingClientRect();
    var n = nodeAt(e.clientX - r.left, e.clientY - r.top);
    if (!n) return;
    var res = GM.allocate(n.id);
    if (res.ok) GM.ui.toast("Allocated " + n.name, "good");
    else GM.ui.toast(res.why, "bad");
    drawTree();
  });

  GM.on(wrap, "wheel", function (e) {
    e.preventDefault();
    userAdjusted = true;
    var f = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    view.z = GM.clamp(view.z * f, 0.3, 2.4);
    drawTree();
  }, { passive: false });

  /* Touch: one finger pans, pinch zooms. */
  var pinch = null;
  GM.on(wrap, "touchstart", function (e) {
    if (e.touches.length === 1) {
      lastPt = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      dragging = true;
    } else if (e.touches.length === 2) {
      dragging = false;
      pinch = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }
  }, { passive: true });

  GM.on(wrap, "touchmove", function (e) {
    if (e.touches.length === 1 && dragging && lastPt) {
      userAdjusted = true;
      view.x += (e.touches[0].clientX - lastPt.x) / view.z;
      view.y += (e.touches[0].clientY - lastPt.y) / view.z;
      lastPt = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      drawTree();
    } else if (e.touches.length === 2 && pinch) {
      var d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      userAdjusted = true;
      view.z = GM.clamp(view.z * (d / pinch), 0.3, 2.4);
      pinch = d;
      drawTree();
    }
  }, { passive: true });

  GM.on(wrap, "touchend", function () { dragging = false; pinch = null; });

  var br = GM.$("#btnTreeReset");
  if (br) GM.on(br, "click", function () { userAdjusted = false; fitZoom(); drawTree(); });

  var rs = GM.$("#btnRespec");
  if (rs) GM.on(rs, "click", function () {
    var res = GM.respec();
    GM.ui.toast(res.ok ? "Refunded " + res.refunded + " points." : res.why, res.ok ? "good" : "bad");
    GM.ui.markDirty();
  });
};

GM.ui.panel("tree", GM.ui.renderTree);
