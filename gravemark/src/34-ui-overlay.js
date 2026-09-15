/* Gravemark — 34-ui-overlay.js
   Everything that is not one of the three columns lives here: the hero sheet,
   the stash and bench, the parish, the passive tree, the gravemarks, ascension
   and the squad settings.

   The tab bar is gone, so these open over the game instead. That keeps the
   three columns permanently visible, which is the whole point of the layout —
   you never stop watching the delves to manage a menu. */
"use strict";

var ovView = null, ovArg = null;

var TABS = [
  { id: "hero",   label: "Hero" },
  { id: "stash",  label: "Stash" },
  { id: "town",   label: "Parish" },
  { id: "tree",   label: "Tree" },
  { id: "graves", label: "Graves" },
  { id: "ascend", label: "Ascend" }
];

GM.ui.openOverlay = function (view, arg) {
  ovView = view; ovArg = arg;
  var wrap = GM.$("#overlayWrap");
  if (wrap) wrap.hidden = false;
  GM.ui.renderOverlay();
};

GM.ui.closeOverlay = function () {
  ovView = null; ovArg = null;
  var wrap = GM.$("#overlayWrap");
  if (wrap) wrap.hidden = true;
};

GM.ui.overlayOpen = function () { return !!ovView; };

/* ---------- shell -------------------------------------------------------- */
GM.ui.renderOverlay = function () {
  if (!ovView) return;
  var ov = GM.$("#overlay");
  if (!ov) return;

  var title = {
    hero: "Hero", stash: "Stash & Bench", town: "The Parish", tree: "Passive Tree",
    graves: "Gravemarks", ascend: "Ascension", squad: "Squad Orders",
    squadstats: "Squad", settings: "Settings", codex: "Codex", manual: "Manual"
  }[ovView] || ovView;

  ov.innerHTML = "";
  var head = GM.el("div", "ovhead");
  head.innerHTML = "<h3>" + GM.esc(title) + "</h3>";
  var tabs = GM.el("div", "ovtabs");
  TABS.forEach(function (t) {
    var b = GM.el("button", "ovtab" + (t.id === ovView ? " on" : ""), t.label);
    GM.on(b, "click", function () { GM.ui.openOverlay(t.id, t.id === "hero" ? ovArg : null); });
    tabs.appendChild(b);
  });
  head.appendChild(tabs);
  var x = GM.el("button", "ovclose", "✕");
  GM.on(x, "click", GM.ui.closeOverlay);
  head.appendChild(x);
  ov.appendChild(head);

  var body = GM.el("div", "ovbody");
  ov.appendChild(body);

  var fn = {
    hero: viewHero, stash: viewStash, town: viewTown, tree: viewTree,
    graves: viewGraves, ascend: viewAscend, squad: viewSquad,
    squadstats: viewSquadStats, settings: viewSettings,
    codex: viewCodex, manual: viewManual
  }[ovView];
  if (fn) fn(body);
  else body.appendChild(GM.el("div", "empty", "Nothing here yet."));
};

function panel(parent, title, sub) {
  var p = GM.el("div", "panel");
  if (title) {
    p.innerHTML = "<h2>" + GM.esc(title) + (sub ? '<span class="sub">' + GM.esc(sub) + "</span>" : "") + "</h2>";
  }
  parent.appendChild(p);
  return p;
}

function act(parent, label, enabled, fn, cls) {
  var b = GM.el("button", "btn sm" + (cls ? " " + cls : ""), label);
  b.disabled = !enabled;
  GM.on(b, "click", fn);
  parent.appendChild(b);
  return b;
}

function report(res) {
  if (!res) return;
  if (res.ok) GM.ui.toast(res.cost ? "Done. −" + GM.fmt(res.cost) + " shards" : "Done.", "good");
  else GM.ui.toast(res.why || "Cannot do that.", "bad");
  GM.ui.markDirty();
  GM.ui.renderOverlay();
}

/* ---------- hero --------------------------------------------------------- */
function viewHero(body) {
  var hero = ovArg ? GM.heroById(ovArg) : (GM.state.heroes || [])[0];
  if (!hero) { body.appendChild(GM.el("div", "empty", "No one on the roster.")); return; }

  var cls = GM.heroClass(hero), rank = GM.heroRank(hero);
  var st = GM.heroStats(hero, null);
  var sq = GM.squadOf(hero.id);

  var p = panel(body, hero.name + " · " + rank.name + " " + cls.name,
                "Level " + hero.level + " / " + GM.heroMaxLevel(hero));
  var head = GM.el("div", "row");
  head.innerHTML = '<div class="flavour" style="flex:1">' + GM.esc(cls.blurb) + "</div>";
  p.appendChild(head);

  var xpNeed = GM.heroXpToLevel(hero);
  var bar = GM.el("div", "bar slim");
  bar.style.margin = "6px 0";
  bar.innerHTML = '<div class="fill mhp" style="width:' +
    (hero.level >= GM.heroMaxLevel(hero) ? 100 : (hero.xp / xpNeed * 100)).toFixed(1) +
    '%"></div><div class="txt">' +
    (hero.level >= GM.heroMaxLevel(hero) ? "MAX" : GM.fmt(hero.xp) + " / " + GM.fmt(xpNeed) + " xp") + "</div>";
  p.appendChild(bar);

  var row = GM.el("div", "row");
  (GM.state.squads || []).forEach(function (s) {
    act(row, (sq === s ? "✓ " : "") + s.name + " (" + s.members.length + "/" + GM.SQUAD_SIZE + ")",
      sq !== s, function () {
        var r = GM.assignHero(hero.id, s.id);
        if (!r.ok) GM.ui.toast(r.why, "bad");
        GM.ui.markDirty(); GM.ui.renderOverlay();
      }, sq === s ? "primary" : "");
  });
  act(row, "Bench", !!sq, function () {
    GM.assignHero(hero.id, null);
    GM.ui.markDirty(); GM.ui.renderOverlay();
  });
  act(row, "Dismiss", true, function () {
    var r = GM.dismiss(hero.id);
    GM.ui.toast(r.ok ? hero.name + " released." : r.why, r.ok ? "" : "bad");
    if (r.ok) GM.ui.openOverlay("hero", null);
    GM.ui.markDirty();
  }, "danger");
  p.appendChild(row);

  var sp = panel(body, "Statistics");
  var stats = GM.el("div", "stats");
  [["Damage", GM.fmt(st.dps) + " dps"], ["Attack speed", st.attackSpeed.toFixed(2) + "/s"],
   ["Crit", GM.pct(st.crit, 1) + " ×" + st.critMulti.toFixed(2)],
   ["Penetration", GM.pct(st.pen, 0)], ["Life", GM.fmt(st.life)],
   ["Regen", GM.fmt(st.regen) + "/s"], ["Armour", GM.fmt(st.armour)],
   ["Evasion", GM.fmt(st.evasion)],
   ["Fire res", GM.pct(st.res.fire, 0)], ["Frost res", GM.pct(st.res.cold, 0)],
   ["Storm res", GM.pct(st.res.lit, 0)], ["Void res", GM.pct(st.res.void, 0)],
   ["Item rarity", "+" + GM.pct(st.findRarity, 0)], ["Gold find", "+" + GM.pct(st.findGold, 0)]
  ].forEach(function (r) { stats.appendChild(GM.ui.statRow(r[0], r[1])); });
  sp.appendChild(stats);

  var gp = panel(body, "Equipped", GM.fmt(st.dps) + " dps · " + GM.fmt(st.life) + " life");
  var slots = GM.el("div", "slots");
  GM.SLOTS.forEach(function (sl) {
    var it = hero.equip[sl.id];
    if (!it) {
      var e = GM.el("div", "slot empty");
      e.innerHTML = '<div class="ico"></div><div class="nm"><span class="sl">' +
                    GM.esc(sl.name) + '</span><span class="faint">empty</span></div>';
      slots.appendChild(e);
      return;
    }
    var cell = GM.ui.itemCell(it, hero);
    cell.dataset.where = "equip";
    cell.dataset.slot = sl.id;
    cell.dataset.heroId = hero.id;
    slots.appendChild(cell);
  });
  gp.appendChild(slots);
}

/* ---------- stash & bench ------------------------------------------------ */
var benchId = null;

function viewStash(body) {
  var p = panel(body, "Stash", GM.state.stash.length + " / " + GM.STASH_MAX);
  var row = GM.el("div", "row");
  row.style.marginBottom = "7px";
  act(row, "Salvage unlocked", true, function () {
    var n = 0, sh = 0;
    GM.state.stash.slice().forEach(function (it) {
      if (it.locked) return;
      var v = GM.salvage(it); n++; sh += v.shards;
    });
    GM.ui.toast(n ? "Salvaged " + n + " · +" + GM.fmt(sh) + " shards" : "Nothing to salvage.", n ? "good" : "bad");
    GM.ui.renderOverlay(); GM.ui.markDirty();
  });
  act(row, "Re-equip everyone", true, function () {
    var swaps = 0, guard = 0, changed = true;
    while (changed && guard++ < 10) {
      changed = false;
      GM.state.stash.slice().forEach(function (it) {
        var best = null;
        (GM.state.heroes || []).forEach(function (h) {
          var r = GM.evaluateForHero(h, it, null);
          if (r && r.gain > 0.001 && (!best || r.gain > best.gain)) best = { hero: h, slot: r.slot, gain: r.gain };
        });
        if (best) {
          var prev = GM.equipOn(best.hero, it, best.slot);
          if (prev) GM.stashItem(prev);
          swaps++; changed = true;
        }
      });
    }
    GM.ui.toast(swaps ? "Swapped " + swaps + " pieces." : "Already optimal.", swaps ? "good" : "");
    GM.ui.renderOverlay(); GM.ui.markDirty();
  });
  var ae = GM.el("label", "opt");
  ae.innerHTML = '<input type="checkbox"' + (GM.state.opts.autoEquip ? " checked" : "") + "> Auto-equip";
  GM.on(GM.$("input", ae), "change", function (e) { GM.state.opts.autoEquip = e.target.checked; });
  row.appendChild(ae);
  var as = GM.el("label", "opt");
  as.innerHTML = '<input type="checkbox"' + (GM.state.opts.autoSalvage ? " checked" : "") + "> Auto-salvage";
  GM.on(GM.$("input", as), "change", function (e) { GM.state.opts.autoSalvage = e.target.checked; });
  row.appendChild(as);
  p.appendChild(row);

  var grid = GM.el("div", "stash");
  if (!GM.state.stash.length) grid.appendChild(GM.el("div", "empty", "Nothing stashed."));
  GM.state.stash.slice().sort(function (a, b) {
    if (b.rarity !== a.rarity) return b.rarity - a.rarity;
    return b.ilvl - a.ilvl;
  }).forEach(function (it) {
    var c = GM.ui.itemCell(it, null, { cls: it.id === benchId ? "sel" : "" });
    c.dataset.where = "stash";
    grid.appendChild(c);
  });
  p.appendChild(grid);

  /* --- bench --- */
  var it = benchId ? (GM.ui.findItem(benchId) || {}).item : null;
  var bp = panel(body, "Bench", it ? GM.itemName(it) : "no workpiece");
  if (!it) {
    bp.appendChild(GM.el("div", "empty", "Click an item to work on it."));
  } else {
    var tip = GM.el("div", "small");
    tip.innerHTML = GM.ui.itemTipHTML(it, null);
    bp.appendChild(tip);
    var acts = GM.el("div", "row");
    acts.style.marginTop = "7px";
    var c = GM.state.char;
    act(acts, "Add socket (" + GM.fmt(GM.addSocketCost(it)) + "s)",
      (it.sockets || []).length < GM.maxSockets(it) && c.shards >= GM.addSocketCost(it),
      function () { report(GM.addSocket(it)); });
    act(acts, "Reroll (" + GM.fmt(GM.rerollCost(it)) + "s)",
      it.rarity >= 1 && c.shards >= GM.rerollCost(it), function () { report(GM.reroll(it)); });
    act(acts, "Augment (" + GM.fmt(GM.augmentCost(it)) + "s)",
      it.affixes.length < GM.maxAffixes(it) && c.shards >= GM.augmentCost(it),
      function () { report(GM.augment(it)); });
    act(acts, "Upgrade rarity (" + GM.fmt(GM.upgradeCost(it)) + "s)",
      it.rarity < GM.RARITIES.length - 1 && c.shards >= GM.upgradeCost(it),
      function () { report(GM.upgradeRarity(it)); });
    act(acts, it.locked ? "Unlock" : "Lock", true, function () {
      it.locked = !it.locked; GM.ui.renderOverlay();
    });
    (it.sockets || []).forEach(function (r, i) {
      act(acts, r ? (GM.RUNE_BY_ID[r] || {}).name + " ✖" : "socket " + (i + 1), true, function () {
        if (r) report(GM.pullRune(it, i));
        else pickRune(it, i);
      });
    });
    bp.appendChild(acts);
  }

  /* --- epitaphs --- */
  var ep = panel(body, "Epitaphs", GM.state.epitaphs.length + " held · " + GM.fmt(GM.state.char.shards) + " shards");
  ep.appendChild(GM.el("p", "flavour",
    "Recovered from your own graves. An epitaph remembers one exact roll — inscribing it is certain, not a gamble."));
  if (!GM.state.epitaphs.length) {
    ep.appendChild(GM.el("div", "empty", "None. Recover a gravemark to earn one."));
  } else {
    var eg = GM.el("div", "grid g3");
    GM.state.epitaphs.slice().sort(function (a, b) { return b.tier - a.tier; }).forEach(function (e) {
      var card = GM.el("div", "card");
      var can = it ? GM.canInscribe(it, e) : { ok: false, why: "Pick a workpiece." };
      card.innerHTML = "<h4>" + GM.esc(e.name) + ' <span class="lvl">T' + (e.displayTier || e.tier) + "</span></h4>" +
        '<div class="small">' + GM.esc(GM.statLine(e.stat, e.value)) + "</div>" +
        '<div class="small faint">from depth ' + e.from + "</div>";
      var b = GM.el("button", "btn sm" + (can.ok ? " primary" : ""),
        can.ok ? "Inscribe (" + GM.fmt(GM.inscribeCost(e, it)) + "s)" : (can.why || "—"));
      b.disabled = !can.ok || !it || GM.state.char.shards < GM.inscribeCost(e, it);
      b.style.marginTop = "5px";
      GM.on(b, "click", function () {
        report(GM.inscribe(it, e, can.needsVictim ? it.affixes[it.affixes.length - 1] : null));
      });
      card.appendChild(b);
      eg.appendChild(card);
    });
    ep.appendChild(eg);
  }

  /* --- runes --- */
  var rp = panel(body, "Runes");
  var rg = GM.el("div", "grid g3");
  var any = false;
  GM.RUNES.forEach(function (r) {
    var n = GM.runeCount(r.id);
    if (!n) return;
    any = true;
    var card = GM.el("div", "card");
    card.innerHTML = "<h4>" + GM.esc(r.name) + ' <span class="lvl">×' + n + "</span></h4>" +
      '<div class="small faint">Weapon: ' + GM.esc(inline(r.wep)) + "</div>" +
      '<div class="small faint">Armour: ' + GM.esc(inline(r.arm)) + "</div>";
    rg.appendChild(card);
  });
  if (!any) rg.appendChild(GM.el("div", "empty", "No runes yet."));
  rp.appendChild(rg);
}

function inline(bag, mult) {
  var out = [];
  for (var k in bag) out.push(GM.statLine(k, bag[k] * (mult == null ? 1 : mult)));
  return out.join(", ");
}

function pickRune(item, index) {
  var held = GM.RUNES.filter(function (r) { return GM.runeCount(r.id) > 0; });
  if (!held.length) { GM.ui.toast("You hold no runes.", "bad"); return; }
  var body = GM.$("#overlay .ovbody");
  var p = panel(body, "Socket a rune");
  var g = GM.el("div", "grid g3");
  held.forEach(function (r) {
    act(g, r.name + " ×" + GM.runeCount(r.id), true, function () {
      report(GM.socketRune(item, index, r.id));
    });
  });
  p.appendChild(g);
  p.scrollIntoView({ block: "nearest" });
}

/* ---------- parish ------------------------------------------------------- */
function viewTown(body) {
  var total = 0;
  GM.BUILDINGS.forEach(function (b) { total += GM.townLevel(b.id); });
  panel(body, "The Parish", total + " levels · " + GM.fmt(GM.state.char.gold) + " gold")
    .appendChild(GM.el("p", "flavour", "Gold buried in the parish comes back as something that outlives you."));
  var g = GM.el("div", "grid g2");
  GM.BUILDINGS.forEach(function (b) {
    var lv = GM.townLevel(b.id), cost = GM.buildingCost(b, lv);
    var maxed = lv >= b.max, afford = GM.state.char.gold >= cost;
    var card = GM.el("div", "card");
    card.innerHTML = "<h4>" + b.icon + " " + GM.esc(b.name) + ' <span class="lvl">' + lv + " / " + b.max + "</span></h4>" +
      '<div class="flavour">' + GM.esc(b.blurb) + "</div>" +
      '<div class="small" style="margin-top:4px">Now: ' +
      (lv ? GM.esc(inline(b.per, lv)) : '<span class="faint">nothing yet</span>') + "</div>" +
      '<div class="small faint">Next: ' + GM.esc(inline(b.per, 1)) + "</div>";
    act(card, maxed ? "Complete" : "Build · " + GM.fmt(cost) + "g", !maxed && afford, function () {
      var r = GM.buyBuilding(b.id);
      GM.ui.toast(r.ok ? b.name + " → " + GM.townLevel(b.id) : r.why, r.ok ? "good" : "bad");
      GM.ui.renderOverlay(); GM.ui.markDirty();
    }, afford && !maxed ? "primary" : "");
    g.appendChild(card);
  });
  body.appendChild(g);
}

/* ---------- graves ------------------------------------------------------- */
function viewGraves(body) {
  panel(body, "Gravemarks",
    GM.buriedGraves().length + " buried · " + GM.revenants().length + " standing")
    .appendChild(GM.el("p", "flavour",
      "Every squad that falls cuts a stone where it happened, recording what they wore. Kill at or below that depth to recover it. Neglect one and it stands up."));

  if (!GM.state.graves.length) {
    body.appendChild(GM.el("div", "empty", "No gravemarks. Nobody has died yet."));
    return;
  }
  GM.state.graves.slice().sort(function (a, b) { return b.stage - a.stage; }).forEach(function (g) {
    var p = GM.el("div", "panel grave" + (g.state === "revenant" ? " rev" : ""));
    var best = g.recorded.slice().sort(function (a, b) { return b.tier - a.tier; })[0];
    var html = "<h2>Depth " + g.stage + " · " + GM.esc(g.realm) +
      '<span class="sub">' + (g.state === "revenant" ? "REVENANT" : "buried") + "</span></h2>" +
      '<div class="flavour">' + GM.esc(g.squad || "A squad") + " killed by " + GM.esc(g.killer) +
      ". " + g.recorded.length + " modifiers recorded.</div>";
    if (best) {
      html += '<div class="small" style="margin-top:4px">Best held: <span class="gold">' +
        GM.esc((GM.AFFIX_BY_ID[best.affixId] || {}).name || best.affixId) +
        " T" + (best.displayTier || best.tier) + "</span> — " +
        GM.esc(GM.statLine(best.stat, best.value)) + "</div>";
    }
    if (g.state === "buried") {
      var f = GM.clamp(g.progress / g.required, 0, 1);
      html += '<div class="bar slim" style="margin-top:6px"><div class="fill mhp" style="width:' +
        (f * 100).toFixed(1) + '%"></div><div class="txt">' +
        Math.min(g.progress, g.required) + " / " + g.required + " kills</div></div>";
    } else {
      html += '<div class="small" style="color:var(--bad);margin-top:5px">Standing. Power ×' +
        g.power.toFixed(2) + ".</div>";
    }
    p.innerHTML = html;
    if (g.state === "revenant") {
      var row = GM.el("div", "row");
      row.style.marginTop = "6px";
      (GM.state.squads || []).forEach(function (sq) {
        act(row, "Send " + sq.name, sq.members.length > 0, function () {
          var r = GM.beginVigil(sq, g.id);
          GM.ui.toast(r.ok ? "The vigil begins." : r.why, r.ok ? "" : "bad");
          GM.ui.closeOverlay(); GM.ui.markDirty();
        }, "danger");
      });
      p.appendChild(row);
    }
    body.appendChild(p);
  });
}

/* ---------- ascension ---------------------------------------------------- */
function viewAscend(body) {
  var can = GM.canAscend();
  var p = panel(body, "Ascension", GM.fmt(GM.state.char.ichor) + " Ichor · " +
    GM.state.tally.ascensions + " ascensions");
  p.appendChild(GM.el("p", "flavour",
    "Give up the warband. Keep the parish, the perks, the runes and every epitaph you recovered."));
  var r = GM.el("div", "row");
  r.style.marginTop = "7px";
  act(r, "Ascend", can, function () {
    var res = GM.ascend();
    GM.ui.toast(res.ok ? "+" + res.gained + " Ichor" : res.why, res.ok ? "good" : "bad");
    GM.ui.renderOverlay(); GM.ui.markDirty();
  }, "primary danger");
  r.appendChild(GM.el("span", "faint small", can
    ? "Yields " + GM.ascendPreview() + " Ichor from depth " + GM.state.depth.maxEver + "."
    : "Reach depth " + GM.ASCEND_MIN_STAGE + ". You are at " + GM.state.depth.maxEver + "."));
  p.appendChild(r);

  var g = GM.el("div", "grid g2");
  GM.PERKS.forEach(function (pk) {
    var lv = GM.perkLevel(pk.id), cost = GM.perkCost(pk, lv);
    var maxed = lv >= pk.max, afford = GM.state.char.ichor >= cost;
    var card = GM.el("div", "card");
    card.innerHTML = "<h4>" + GM.esc(pk.name) + ' <span class="lvl">' + lv + " / " + pk.max + "</span></h4>" +
      '<div class="flavour">' + GM.esc(pk.blurb) + "</div>" +
      '<div class="small faint" style="margin-top:4px">Next: ' + GM.esc(inline(pk.per, 1)) + "</div>";
    act(card, maxed ? "Maxed" : "Buy · " + cost + " Ichor", !maxed && afford, function () {
      var res = GM.buyPerk(pk.id);
      GM.ui.toast(res.ok ? pk.name + " → " + GM.perkLevel(pk.id) : res.why, res.ok ? "good" : "bad");
      GM.ui.renderOverlay(); GM.ui.markDirty();
    }, afford && !maxed ? "primary" : "");
    g.appendChild(card);
  });
  body.appendChild(g);

  var sp = panel(body, "Seasons");
  sp.appendChild(GM.el("p", "flavour", "A season is a separate save with one rule. Nothing carries across."));
  var sg = GM.el("div", "grid g2");
  GM.seasonSlots().forEach(function (slot) {
    var on = GM.state.season === slot.season.id;
    var card = GM.el("div", "card" + (on ? " sel" : ""));
    card.innerHTML = "<h4>" + GM.esc(slot.season.name) + (on ? ' <span class="lvl">✓ current</span>' : "") + "</h4>" +
      '<div class="flavour">' + GM.esc(slot.season.blurb) + "</div>" +
      '<div class="small faint" style="margin-top:3px">' +
      (slot.exists ? "level " + slot.level + " · best depth " + slot.maxEver : "no save") + "</div>";
    if (!on) act(card, slot.exists ? "Resume" : "Begin", true, function () {
      GM.switchSeason(slot.season.id);
      GM.ui.closeOverlay();
    });
    sg.appendChild(card);
  });
  sp.appendChild(sg);

  var tp = panel(body, "Record");
  var t = GM.el("div", "stats");
  var y = GM.state.tally;
  [["Kills", GM.fmt(y.kills)], ["Bosses", GM.fmt(y.bosses)], ["Squad wipes", GM.fmt(y.deaths)],
   ["Items found", GM.fmt(y.drops)], ["Salvaged", GM.fmt(y.salvaged)],
   ["Inscribed", GM.fmt(y.inscribed)], ["Revenants", GM.fmt(y.revenants)],
   ["Recruited", GM.fmt(y.recruited || 0)], ["Ascensions", GM.fmt(y.ascensions)],
   ["Best depth", GM.fmt(GM.state.depth.maxEver)], ["Playtime", GM.fmtTime(y.playtime)]
  ].forEach(function (rw) { t.appendChild(GM.ui.statRow(rw[0], rw[1])); });
  tp.appendChild(t);
}

/* ---------- squad orders ------------------------------------------------- */
function viewSquad(body) {
  var sq = GM.squadById(ovArg) || (GM.state.squads || [])[0];
  if (!sq) return;
  var p = panel(body, sq.name, "depth " + GM.squadStage(sq) + (sq.holding ? " · holding" : ""));

  var pushRow = GM.el("div", "row");
  pushRow.style.marginBottom = "8px";
  var lab = GM.el("label", "opt");
  lab.innerHTML = '<input type="checkbox"' + (sq.push ? " checked" : "") + "> Push past the ceiling";
  GM.on(GM.$("input", lab), "change", function () {
    GM.togglePush(sq);
    GM.ui.renderOverlay(); GM.ui.markDirty();
  });
  pushRow.appendChild(lab);
  pushRow.appendChild(GM.el("span", "faint small", sq.push
    ? "Advancing regardless. Expect wipes — and gravemarks."
    : "Holds at the deepest depth it can survive, farming until it outgrows it."));
  p.appendChild(pushRow);

  var g = GM.el("div", "grid g2");
  GM.MODE_DEFS.forEach(function (m) {
    if (m.hidden && !m.unlock()) return;
    var on = sq.mode === m.id, open = m.unlock();
    var card = GM.el("div", "card" + (on ? " sel" : ""));
    card.innerHTML = "<h4>" + m.icon + " " + GM.esc(m.name) + "</h4>" +
      '<div class="flavour">' + GM.esc(m.blurb) + "</div>" +
      (open ? "" : '<div class="small" style="color:var(--bad)">' + GM.esc(m.unlockText || "Locked") + "</div>");
    if (open && !on) act(card, "Order", true, function () {
      var r = GM.setSquadMode(sq, m.id);
      GM.ui.toast(r.ok ? sq.name + " → " + m.name : r.why, r.ok ? "" : "bad");
      GM.ui.renderOverlay(); GM.ui.markDirty();
    }, "primary");
    else if (on) card.appendChild(GM.el("div", "small gold", "✓ current orders"));
    g.appendChild(card);
  });
  p.appendChild(g);

  if (sq.mode === "exploration") {
    var ep = panel(body, "Farming depth");
    var lab = GM.el("div", "small", "Depth " + (sq.target || 1) + " of " + sq.max + " cleared");
    var sl = GM.el("input");
    sl.type = "range"; sl.min = 1; sl.max = Math.max(1, sq.max); sl.value = sq.target || 1;
    GM.on(sl, "input", function () { lab.textContent = "Depth " + sl.value + " of " + sq.max + " cleared"; });
    GM.on(sl, "change", function () { GM.setExplorationTarget(sq, +sl.value); GM.ui.markDirty(); });
    ep.appendChild(lab); ep.appendChild(sl);
  } else if (sq.mode === "dimension" && sq.dim) {
    var dp = panel(body, "This dimension", "payout ×" + sq.dim.reward.toFixed(2));
    sq.dim.mutators.forEach(function (id) {
      var mu = GM.MUTATOR_BY_ID[id];
      if (!mu) return;
      var d = GM.el("div", "small faint", mu.name + ": " + mu.desc);
      dp.appendChild(d);
    });
    act(dp, "Roll a new dimension", true, function () {
      GM.rerollDimension(sq); GM.ui.renderOverlay(); GM.ui.markDirty();
    });
  }
}

function viewSquadStats(body) {
  var sq = GM.squadById(ovArg) || (GM.state.squads || [])[0];
  if (!sq) return;
  var st = GM.squadStats(sq, GM.squadCtx(sq));
  var p = panel(body, sq.name, st.count + " / " + GM.SQUAD_SIZE + " assigned");
  var t = GM.el("div", "stats");
  [["Squad damage", GM.fmt(st.dps) + " dps"], ["Squad life", GM.fmt(st.life)],
   ["Armour", GM.fmt(st.armour)], ["Evasion", GM.fmt(st.evasion)],
   ["Regen", GM.fmt(st.regen) + "/s"], ["Leech cap", GM.fmt(st.life * GM.LEECH_CAP) + "/s"],
   ["Item rarity", "+" + GM.pct(st.findRarity, 0)], ["Item quantity", "+" + GM.pct(st.findQuantity, 0)],
   ["Gold find", "+" + GM.pct(st.findGold, 0)], ["Epitaph chance", "+" + GM.pct(st.epitaphChance, 0)]
  ].forEach(function (r) { t.appendChild(GM.ui.statRow(r[0], r[1])); });
  p.appendChild(t);

  var f = GM.forecastSquad(sq);
  var verdict = f.empty ? "No one assigned."
    : f.win ? "Holding: kill in " + GM.fmtTime(f.ttk) + (f.ttd === Infinity ? ", unkillable here." : ", broken in " + GM.fmtTime(f.ttd) + ".")
            : "LOSING: killed in " + GM.fmtTime(f.ttd) + " before clearing.";
  p.appendChild(GM.el("div", "small " + (f.win ? "gold" : ""), verdict));

  var mp = panel(body, "Members");
  var g = GM.el("div", "grid g2");
  st.members.forEach(function (m) {
    var cls = GM.heroClass(m.hero), rank = GM.heroRank(m.hero);
    var card = GM.el("div", "card");
    card.dataset.hero = m.hero.id;
    card.innerHTML = "<h4>" + cls.icon + " " + GM.esc(m.hero.name) +
      ' <span class="' + rank.css + '">' + rank.numeral + "</span>" +
      ' <span class="lvl">L' + m.hero.level + "</span></h4>" +
      '<div class="small faint">' + GM.esc(cls.name) + " · " + GM.fmt(m.st.dps) +
      " dps · " + GM.fmt(m.st.life) + " life</div>";
    GM.on(card, "click", function () { GM.ui.openOverlay("hero", m.hero.id); });
    g.appendChild(card);
  });
  if (!st.members.length) g.appendChild(GM.el("div", "empty", "Assign heroes from the roster."));
  mp.appendChild(g);
}

/* ---------- settings / codex / manual ------------------------------------ */
function viewSettings(body) {
  var p = panel(body, "Settings");
  var o = GM.state.opts;
  [["autoEquip", "Auto-equip upgrades as they drop"],
   ["autoSalvage", "Auto-salvage what nobody wants"],
   ["showLog", "Keep the chronicle"]
  ].forEach(function (pair) {
    var l = GM.el("label", "opt");
    l.innerHTML = '<input type="checkbox"' + (o[pair[0]] ? " checked" : "") + "> " + GM.esc(pair[1]);
    GM.on(GM.$("input", l), "change", function (e) { o[pair[0]] = e.target.checked; });
    p.appendChild(l);
  });
  var r = GM.el("div", "row");
  r.style.marginTop = "8px";
  act(r, "Save now", true, function () {
    GM.ui.toast(GM.save() ? "Saved." : "Could not save.", GM.save() ? "good" : "bad");
  });
  act(r, "Wipe this season", true, function () {
    GM.wipeSeason(GM.state.season);
    GM.startSeason(GM.state.season);
    GM.ui.closeOverlay();
    GM.ui.toast("Season wiped.", "");
    GM.ui.markDirty();
  }, "danger");
  p.appendChild(r);

  var lp = panel(body, "Chronicle");
  var log = GM.el("div");
  log.id = "log";
  log.innerHTML = GM.state.log.slice(-60).map(function (x) {
    return '<div class="k-' + GM.esc(x.kind) + '">' + GM.esc(x.text) + "</div>";
  }).join("");
  lp.appendChild(log);
  log.scrollTop = log.scrollHeight;
}

function viewCodex(body) {
  var p = panel(body, "Realms");
  GM.REALMS.forEach(function (r) {
    var reached = GM.state.depth.maxEver >= (r.n - 1) * GM.STAGES_PER_REALM + 1;
    var card = GM.el("div", "card");
    card.style.marginBottom = "4px";
    card.innerHTML = "<h4>" + r.n + ". " + GM.esc(reached ? r.name : "— sealed —") + "</h4>" +
      '<div class="flavour">' + GM.esc(reached ? r.flavour : "You have not been this deep.") + "</div>";
    p.appendChild(card);
  });

  var bp = panel(body, "Runewords");
  GM.RUNEWORDS.forEach(function (rw) {
    var seq = rw.seq.map(function (id) { return (GM.RUNE_BY_ID[id] || {}).name; }).join(" · ");
    var card = GM.el("div", "card");
    card.style.marginBottom = "4px";
    card.innerHTML = "<h4>" + GM.esc(rw.name) + ' <span class="lvl">' + GM.esc(seq) + "</span></h4>" +
      '<div class="small faint">' + GM.esc(inline(rw.stats)) + "</div>" +
      '<div class="flavour">"' + GM.esc(rw.flavour) + '"</div>';
    bp.appendChild(card);
  });
}

function viewManual(body) {
  var p = panel(body, "How this works");
  p.innerHTML += [
    "<p class='small'><b>Three squads delve at once.</b> Each panel in the middle is one squad running its own depth. They fight on their own; you decide who is in them and what orders they have.</p>",
    "<p class='small'><b>Death is the crafting system.</b> When a squad is broken it does not lose its gear — it leaves a <b>gravemark</b> recording every modifier it wore. Recover the gravemark and it pays an <b>Epitaph</b>: that exact roll, at that exact value, which you can inscribe onto any item with no dice involved.</p>",
    "<p class='small'><b>Neglect a gravemark and it stands up.</b> A Revenant wears your old kit and has to be put down to claim what it holds.</p>",
    "<p class='small'><b>The parish is permanent.</b> Buildings, ascension perks, runes and epitaphs survive an ascension. Heroes and gear do not.</p>",
    "<p class='small'><b>Shards buy chance; epitaphs buy certainty.</b> That is the whole economy.</p>"
  ].join("");
}

/* ---------- tree --------------------------------------------------------- */
var tv = { x: 0, y: 0, z: 0.7 }, tDrag = false, tMoved = false, tLast = null, tHover = null, tFit = false;
var tCanvas = null, tCtx = null, tWrap = null;

function viewTree(body) {
  var p = panel(body, "Passive Tree",
    GM.state.tree.points + " unspent · " + GM.state.tree.spent.length + " / " + (GM.TREE_NODES.length - 1));
  p.appendChild(GM.el("p", "flavour",
    "Shared by the whole warband. Every level any hero gains adds a point."));
  var wrap = GM.el("div");
  wrap.id = "treeWrap";
  var cv = GM.el("canvas");
  cv.id = "treeCanvas";
  wrap.appendChild(cv);
  var hud = GM.el("div");
  hud.id = "treeHud";
  wrap.appendChild(hud);
  p.appendChild(wrap);

  var row = GM.el("div", "row");
  row.style.marginTop = "7px";
  act(row, "Recentre", true, function () { tFit = false; drawTree(); });
  act(row, "Respec", GM.state.tree.spent.length > 0, function () {
    var r = GM.respec();
    GM.ui.toast(r.ok ? "Refunded " + r.refunded + " points." : r.why, r.ok ? "good" : "bad");
    GM.ui.renderOverlay(); GM.ui.markDirty();
  }, "danger");
  row.appendChild(GM.el("span", "faint small", GM.state.tree.spent.length
    ? "Refund all for " + GM.fmt(GM.respecCost()) + " gold" : ""));
  p.appendChild(row);

  tCanvas = cv; tWrap = wrap; tCtx = cv.getContext("2d");
  bindTree();
  requestAnimationFrame(drawTree);
}

function fitTree() {
  if (!tWrap) return;
  var r = tWrap.getBoundingClientRect();
  if (!r.width || !r.height) return;
  tv.x = 0; tv.y = 0;
  tv.z = GM.clamp(Math.min(r.width, r.height) / (2 * 540), 0.3, 2.4);
  tFit = true;
}

function tScreen(n) {
  var r = tWrap.getBoundingClientRect();
  return { x: r.width / 2 + (n.x + tv.x) * tv.z, y: r.height / 2 + (n.y + tv.y) * tv.z };
}
function tRadius(n) {
  return n.kind === "keystone" ? 16 : n.kind === "notable" ? 11 : n.kind === "root" ? 13 : 6.5;
}
function tNodeAt(px, py) {
  for (var i = GM.TREE_NODES.length - 1; i >= 0; i--) {
    var n = GM.TREE_NODES[i], s = tScreen(n), rad = (tRadius(n) + 5) * tv.z;
    var dx = px - s.x, dy = py - s.y;
    if (dx * dx + dy * dy <= rad * rad) return n;
  }
  return null;
}

function drawTree() {
  if (!tCtx || !tWrap || !tWrap.isConnected) return;
  if (!tFit) fitTree();
  var r = tWrap.getBoundingClientRect();
  var dpr = Math.min(2, window.devicePixelRatio || 1);
  var w = Math.floor(r.width * dpr), h = Math.floor(r.height * dpr);
  if (tCanvas.width !== w || tCanvas.height !== h) { tCanvas.width = w; tCanvas.height = h; }
  tCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  tCtx.clearRect(0, 0, r.width, r.height);

  tCtx.lineWidth = Math.max(1, 1.8 * tv.z);
  var drawn = {};
  GM.TREE_NODES.forEach(function (n) {
    n.links.forEach(function (lid) {
      var key = n.id < lid ? n.id + "|" + lid : lid + "|" + n.id;
      if (drawn[key]) return;
      drawn[key] = true;
      var o = GM.TREE_BY_ID[lid];
      if (!o) return;
      var a = tScreen(n), b = tScreen(o);
      var both = GM.hasNode(n.id) && GM.hasNode(o.id);
      var either = GM.hasNode(n.id) || GM.hasNode(o.id) || n.id === "root" || o.id === "root";
      tCtx.strokeStyle = both ? "rgba(217,180,92,.6)" : either ? "rgba(140,150,175,.24)" : "rgba(90,100,125,.12)";
      tCtx.beginPath(); tCtx.moveTo(a.x, a.y); tCtx.lineTo(b.x, b.y); tCtx.stroke();
    });
  });

  GM.TREE_NODES.forEach(function (n) {
    var s = tScreen(n), rad = tRadius(n) * tv.z;
    if (s.x < -40 || s.y < -40 || s.x > r.width + 40 || s.y > r.height + 40) return;
    var has = GM.hasNode(n.id) || n.kind === "root";
    var can = !has && GM.canAllocate(n.id).ok;
    var hue = n.cluster ? (GM.byId(GM.TREE_CLUSTERS, n.cluster) || {}).hue || 45 : 45;
    tCtx.beginPath(); tCtx.arc(s.x, s.y, rad, 0, Math.PI * 2);
    tCtx.fillStyle = has ? "hsl(" + hue + ",58%,52%)" : can ? "hsl(" + hue + ",34%,26%)" : "hsl(" + hue + ",14%,15%)";
    tCtx.fill();
    tCtx.lineWidth = (n === tHover ? 3 : n.kind === "minor" ? 1 : 2) * Math.max(0.6, tv.z);
    tCtx.strokeStyle = n === tHover ? "#e8e2d1" : has ? "hsl(" + hue + ",70%,72%)"
      : can ? "hsl(" + hue + ",42%,46%)" : "rgba(120,130,155,.2)";
    tCtx.stroke();
  });

  var hud = GM.$("#treeHud");
  if (hud) hud.textContent = GM.state.tree.points + " point" +
    (GM.state.tree.points === 1 ? "" : "s") + " · " + GM.state.tree.spent.length + " allocated";
}

function treeTip(n) {
  if (!n) return "";
  var has = GM.hasNode(n.id), can = GM.canAllocate(n.id);
  var h = ['<div class="tname">' + GM.esc(n.name) + "</div>",
           '<div class="tbase">' + GM.esc(n.kind) + "</div>"];
  for (var k in n.stats) {
    var v = n.stats[k];
    if (k === "flatArmour" && v < -1000) { h.push('<div class="tstat down">Armour is always zero</div>'); continue; }
    h.push('<div class="tstat' + (v < 0 ? " down" : "") + '">' + GM.esc(GM.statLine(k, v)) + "</div>");
  }
  if (n.desc) h.push('<div class="flavour" style="margin-top:3px">' + GM.esc(n.desc) + "</div>");
  h.push('<div class="tcmp">' + (has ? "Allocated" : can.ok ? "Click to allocate" : GM.esc(can.why)) + "</div>");
  return h.join("");
}

function bindTree() {
  GM.on(tWrap, "mousedown", function (e) {
    tDrag = true; tMoved = false; tLast = { x: e.clientX, y: e.clientY };
    tWrap.classList.add("drag");
  });
  GM.on(window, "mouseup", function () { tDrag = false; if (tWrap) tWrap.classList.remove("drag"); });
  GM.on(tWrap, "mousemove", function (e) {
    var r = tWrap.getBoundingClientRect();
    if (tDrag && tLast) {
      var dx = e.clientX - tLast.x, dy = e.clientY - tLast.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) tMoved = true;
      tv.x += dx / tv.z; tv.y += dy / tv.z;
      tLast = { x: e.clientX, y: e.clientY };
      drawTree(); GM.ui.hideTip();
      return;
    }
    var n = tNodeAt(e.clientX - r.left, e.clientY - r.top);
    if (n !== tHover) { tHover = n; drawTree(); }
    if (n) GM.ui.showTip(treeTip(n), e.clientX, e.clientY); else GM.ui.hideTip();
  });
  GM.on(tWrap, "mouseleave", function () { tHover = null; tDrag = false; drawTree(); GM.ui.hideTip(); });
  GM.on(tWrap, "click", function (e) {
    if (tMoved) { tMoved = false; return; }
    var r = tWrap.getBoundingClientRect();
    var n = tNodeAt(e.clientX - r.left, e.clientY - r.top);
    if (!n) return;
    var res = GM.allocate(n.id);
    GM.ui.toast(res.ok ? "Allocated " + n.name : res.why, res.ok ? "good" : "bad");
    drawTree(); GM.ui.markDirty();
  });
  GM.on(tWrap, "wheel", function (e) {
    e.preventDefault();
    tv.z = GM.clamp(tv.z * (e.deltaY < 0 ? 1.12 : 1 / 1.12), 0.3, 2.4);
    drawTree();
  }, { passive: false });
}

/* ---------- item clicks inside the overlay ------------------------------- */
GM.ui.initOverlay = function () {
  var wrap = GM.$("#overlayWrap");
  GM.on(wrap, "click", function (e) { if (e.target.id === "overlayWrap") GM.ui.closeOverlay(); });

  GM.delegate(GM.$("#overlay"), "click", "[data-item]", function (e, node) {
    var found = GM.ui.findItem(node.dataset.item);
    if (!found) return;
    if (node.dataset.where === "equip") {
      GM.unequipFrom(found.hero, node.dataset.slot);
      GM.ui.toast("Unequipped.", "");
      GM.ui.renderOverlay();
      return;
    }
    /* From the stash: equip on whoever gains most, else open it on the bench. */
    var best = null;
    (GM.state.heroes || []).forEach(function (h) {
      var r = GM.evaluateForHero(h, found.item, null);
      if (r && (!best || r.gain > best.gain)) best = { hero: h, slot: r.slot, gain: r.gain };
    });
    if (best && best.gain > 0) {
      var prev = GM.equipOn(best.hero, found.item, best.slot);
      if (prev) GM.stashItem(prev);
      GM.ui.toast(best.hero.name + " equips it · +" + (best.gain * 100).toFixed(1) + "%", "good");
    } else {
      benchId = found.item.id;
    }
    GM.ui.renderOverlay();
    GM.ui.markDirty();
  });
};
