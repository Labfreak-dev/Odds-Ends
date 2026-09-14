/* Gravemark — 32-ui-gear.js
   The gear view (doll, stash, runes) and the bench (sockets, rerolls,
   runewords, Epitaph inscription). */
"use strict";

var benchId = null;

function benchItem() { return benchId ? GM.ui.findItem(benchId) : null; }

/* ---------- gear view ---------------------------------------------------- */
GM.ui.renderGear = function () {
  var box = GM.$("#equipSlots");
  if (box) {
    box.innerHTML = "";
    GM.SLOTS.forEach(function (sl) {
      var it = GM.state.equip[sl.id];
      if (!it) {
        var e = GM.el("div", "slot empty");
        e.innerHTML = '<div class="ico"></div><div class="nm"><span class="sl">' +
                      GM.esc(sl.name) + '</span><span class="faint">empty</span></div>';
        box.appendChild(e);
        return;
      }
      var cell = GM.ui.itemCell(it);
      cell.dataset.slot = sl.id;
      cell.dataset.where = "equip";
      box.appendChild(cell);
    });
  }

  var st = GM.stats({});
  var gs = GM.$("#gearSub");
  if (gs) gs.textContent = GM.fmt(st.dps) + " dps · " + GM.fmt(st.life) + " life";

  var grid = GM.$("#stashGrid");
  if (grid) {
    grid.innerHTML = "";
    if (!GM.state.stash.length) {
      grid.appendChild(GM.el("div", "empty", "Nothing stashed."));
    } else {
      /* Best first, so the useful thing is never below the fold. */
      var sorted = GM.state.stash.slice().sort(function (a, b) {
        if (b.rarity !== a.rarity) return b.rarity - a.rarity;
        return b.ilvl - a.ilvl;
      });
      sorted.forEach(function (it) {
        var c = GM.ui.itemCell(it);
        c.dataset.where = "stash";
        grid.appendChild(c);
      });
    }
  }
  var ss = GM.$("#stashSub");
  if (ss) ss.textContent = GM.state.stash.length + " / " + GM.STASH_MAX;

  var ae = GM.$("#optAutoEquip"), as = GM.$("#optAutoSalvage");
  if (ae) ae.checked = !!GM.state.opts.autoEquip;
  if (as) as.checked = !!GM.state.opts.autoSalvage;

  var rg = GM.$("#runeGrid");
  if (rg) {
    rg.innerHTML = "";
    var any = false;
    GM.RUNES.forEach(function (r) {
      var n = GM.runeCount(r.id);
      if (!n) return;
      any = true;
      var c = GM.el("div", "card");
      c.dataset.tip = "rune:" + r.id;
      c.innerHTML = "<h4>" + GM.esc(r.name) + ' <span class="lvl">×' + n + "</span></h4>" +
        '<div class="small faint">Weapon: ' + GM.esc(gearStatsInline(r.wep)) + "</div>" +
        '<div class="small faint">Armour: ' + GM.esc(gearStatsInline(r.arm)) + "</div>";
      rg.appendChild(c);
    });
    if (!any) rg.appendChild(GM.el("div", "empty", "No runes yet. They surface from elites and bosses."));
  }
};

function gearStatsInline(bag) {
  var out = [];
  for (var k in bag) out.push(GM.statLine(k, bag[k]));
  return out.join(", ");
}

GM.ui.tipProvider("rune", function (id) {
  var r = GM.RUNE_BY_ID[id];
  if (!r) return "";
  return '<div class="tname gold">' + GM.esc(r.name) + "</div>" +
    '<div class="tbase">Rune tier ' + r.tier + " · from depth " + r.ilvl + "</div>" +
    '<div class="tstat">In a weapon: ' + GM.esc(gearStatsInline(r.wep)) + "</div>" +
    '<div class="tstat">In armour: ' + GM.esc(gearStatsInline(r.arm)) + "</div>";
});

/* ---------- bench -------------------------------------------------------- */
GM.ui.renderBench = function () {
  var it = benchItem();
  var box = GM.$("#benchItem");
  var acts = GM.$("#benchActions");
  var rws = GM.$("#benchRunewords");

  if (!it) {
    if (box) box.innerHTML = '<div class="empty">Choose an item below.</div>';
    if (acts) acts.innerHTML = "";
    if (rws) rws.innerHTML = "";
  } else {
    if (box) {
      box.innerHTML = "";
      box.appendChild(GM.ui.itemCell(it));
      var d = GM.el("div", "small faint");
      d.style.marginTop = "6px";
      d.innerHTML = GM.ui.itemTipHTML(it);
      box.appendChild(d);
    }

    if (acts) {
      acts.innerHTML = "";
      var c = GM.state.char;

      addAct(acts, "Add socket (" + GM.fmt(GM.addSocketCost(it)) + "s)",
        (it.sockets || []).length < GM.maxSockets(it) && c.shards >= GM.addSocketCost(it),
        function () { report(GM.addSocket(it)); });

      addAct(acts, "Reroll affixes (" + GM.fmt(GM.rerollCost(it)) + "s)",
        it.rarity >= 1 && c.shards >= GM.rerollCost(it),
        function () { report(GM.reroll(it)); });

      addAct(acts, "Augment (" + GM.fmt(GM.augmentCost(it)) + "s)",
        it.affixes.length < GM.maxAffixes(it) && c.shards >= GM.augmentCost(it),
        function () { report(GM.augment(it)); });

      addAct(acts, "Upgrade rarity (" + GM.fmt(GM.upgradeCost(it)) + "s)",
        it.rarity < GM.RARITIES.length - 1 && c.shards >= GM.upgradeCost(it),
        function () { report(GM.upgradeRarity(it)); });

      addAct(acts, it.locked ? "Unlock" : "Lock", true, function () {
        it.locked = !it.locked;
        GM.ui.markDirty();
      });

      /* Socket row: click empty to insert, click full to pull. */
      if ((it.sockets || []).length) {
        var row = GM.el("div", "row");
        row.style.width = "100%";
        it.sockets.forEach(function (r, i) {
          var b = GM.el("button", "btn sm", r ? (GM.RUNE_BY_ID[r] || {}).name + " ✖" : "socket " + (i + 1));
          GM.on(b, "click", function () {
            if (r) report(GM.pullRune(it, i));
            else pickRune(it, i);
          });
          row.appendChild(b);
        });
        acts.appendChild(row);
      }
    }

    if (rws) {
      rws.innerHTML = "";
      var prog = GM.runewordProgress(it);
      if (!prog.length) rws.appendChild(GM.el("div", "empty", "No runewords use this base."));
      prog.forEach(function (p) {
        var card = GM.el("div", "card" + (p.ready ? " sel" : ""));
        var seq = p.rw.seq.map(function (r) { return (GM.RUNE_BY_ID[r] || {}).name; }).join(" · ");
        card.innerHTML = "<h4>" + GM.esc(p.rw.name) + ' <span class="lvl">' + GM.esc(seq) + "</span></h4>" +
          '<div class="small faint">' + GM.esc(gearStatsInline(p.rw.stats)) + "</div>" +
          '<div class="small ' + (p.fits ? "faint" : "bad") + '">' +
          (p.fits ? "" : "needs exactly " + p.socketsNeeded + " sockets · ") +
          (p.missing.length
            ? "missing " + p.missing.map(function (m) { return (GM.RUNE_BY_ID[m.rune] || {}).name + " ×" + m.short; }).join(", ")
            : "all runes in hand") + "</div>";
        card.style.marginBottom = "5px";
        rws.appendChild(card);
      });
    }
  }

  /* Epitaphs */
  var el = GM.$("#epiList");
  if (el) {
    el.innerHTML = "";
    if (!GM.state.epitaphs.length) {
      el.appendChild(GM.el("div", "empty", "No epitaphs. Recover a gravemark to earn one."));
    } else {
      GM.state.epitaphs.slice().sort(function (a, b) { return b.tier - a.tier; }).forEach(function (ep) {
        var card = GM.el("div", "card");
        card.style.marginBottom = "5px";
        var can = it ? GM.canInscribe(it, ep) : { ok: false, why: "Choose a workpiece." };
        card.innerHTML = "<h4>" + GM.esc(ep.name) + ' <span class="lvl">T' + (ep.displayTier || ep.tier) + "</span></h4>" +
          '<div class="small">' + GM.esc(GM.statLine(ep.stat, ep.value)) + "</div>" +
          '<div class="small faint">from depth ' + ep.from + "</div>";
        var b = GM.el("button", "btn sm" + (can.ok ? " primary" : ""),
          can.ok ? "Inscribe (" + GM.fmt(GM.inscribeCost(ep, it)) + "s)" : (can.why || "Cannot inscribe"));
        b.disabled = !can.ok || !it || GM.state.char.shards < GM.inscribeCost(ep, it);
        b.style.marginTop = "5px";
        GM.on(b, "click", function () {
          var victim = null;
          if (can.needsVictim) victim = it.affixes[it.affixes.length - 1];
          report(GM.inscribe(it, ep, victim));
        });
        card.appendChild(b);
        el.appendChild(card);
      });
    }
  }
  var es = GM.$("#epiSub");
  if (es) es.textContent = GM.state.epitaphs.length + " held · " + GM.fmt(GM.state.char.shards) + " shards";

  var pick = GM.$("#benchPicker");
  if (pick) {
    pick.innerHTML = "";
    var all = [];
    GM.SLOT_IDS.forEach(function (s) { if (GM.state.equip[s]) all.push(GM.state.equip[s]); });
    all = all.concat(GM.state.stash);
    if (!all.length) pick.appendChild(GM.el("div", "empty", "Nothing to work on."));
    all.forEach(function (i2) {
      var c2 = GM.ui.itemCell(i2, { cls: i2.id === benchId ? "sel" : "" });
      c2.dataset.where = "bench";
      pick.appendChild(c2);
    });
  }
};

function addAct(parent, label, enabled, fn) {
  var b = GM.el("button", "btn sm", label);
  b.disabled = !enabled;
  GM.on(b, "click", fn);
  parent.appendChild(b);
}

function report(res) {
  if (!res) return;
  if (res.ok) GM.ui.toast(res.cost ? "Done. −" + GM.fmt(res.cost) + " shards" : "Done.", "good");
  else GM.ui.toast(res.why || "Cannot do that.", "bad");
  GM.ui.markDirty();
  GM.ui.renderTop();
}

function pickRune(item, index) {
  var held = GM.RUNES.filter(function (r) { return GM.runeCount(r.id) > 0; });
  if (!held.length) { GM.ui.toast("You hold no runes.", "bad"); return; }
  var html = '<div class="grid g3">' + held.map(function (r) {
    return '<button class="btn sm" data-rune="' + r.id + '">' + GM.esc(r.name) +
           " ×" + GM.runeCount(r.id) + "</button>";
  }).join("") + "</div>";
  GM.ui.modal("Socket a rune", html, [{ label: "Cancel" }]);
  GM.$$("#modal [data-rune]").forEach(function (b) {
    GM.on(b, "click", function () {
      report(GM.socketRune(item, index, b.dataset.rune));
      GM.ui.closeModal();
    });
  });
}

/* ---------- interactions ------------------------------------------------- */
GM.ui.initGear = function () {
  var main = GM.$("#main");

  GM.delegate(main, "click", "[data-item]", function (e, node) {
    var it = GM.ui.findItem(node.dataset.item);
    if (!it) return;
    var where = node.dataset.where;
    if (where === "bench") { benchId = it.id; GM.ui.markDirty("bench"); return; }
    if (where === "equip") {
      GM.unequip(node.dataset.slot);
      GM.ui.toast("Unequipped.", "");
      return;
    }
    /* Stash click: equip if it is an upgrade anywhere, else open on the bench. */
    var best = GM.evaluate(it, {});
    if (best && best.gain > 0) {
      var prev = GM.equipItem(it, best.slot);
      if (prev) GM.stashItem(prev);
      GM.ui.toast("Equipped · +" + (best.gain * 100).toFixed(1) + "% power", "good");
    } else {
      benchId = it.id;
      GM.ui.show("bench");
    }
  });

  var sa = GM.$("#btnSalvageAll");
  if (sa) GM.on(sa, "click", function () {
    var n = 0, gold = 0, sh = 0;
    GM.state.stash.slice().forEach(function (it) {
      if (it.locked) return;
      var v = GM.salvage(it);
      n++; gold += v.gold; sh += v.shards;
    });
    GM.ui.toast(n ? "Salvaged " + n + " · +" + GM.fmt(sh) + " shards" : "Nothing to salvage.", n ? "good" : "bad");
    GM.ui.markDirty();
    GM.ui.renderTop();
  });

  var eb = GM.$("#btnEquipBest");
  if (eb) GM.on(eb, "click", function () {
    var swaps = 0, guard = 0;
    /* Repeat until stable: equipping one item changes what counts as an
       upgrade for the others. */
    var changed = true;
    while (changed && guard++ < 12) {
      changed = false;
      GM.state.stash.slice().forEach(function (it) {
        var best = GM.evaluate(it, {});
        if (best && best.gain > 0.001) {
          var prev = GM.equipItem(it, best.slot);
          if (prev) GM.stashItem(prev);
          swaps++; changed = true;
        }
      });
    }
    GM.ui.toast(swaps ? "Swapped " + swaps + " pieces." : "Already optimal.", swaps ? "good" : "");
    GM.ui.markDirty();
  });

  var ae = GM.$("#optAutoEquip");
  if (ae) GM.on(ae, "change", function () { GM.state.opts.autoEquip = ae.checked; });
  var as = GM.$("#optAutoSalvage");
  if (as) GM.on(as, "change", function () { GM.state.opts.autoSalvage = as.checked; });
};

GM.ui.panel("gear", GM.ui.renderGear);
GM.ui.panel("bench", GM.ui.renderBench);
