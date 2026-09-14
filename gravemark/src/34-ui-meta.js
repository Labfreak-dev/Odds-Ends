/* Gravemark — 34-ui-meta.js
   Town, Graves, Modes, and Ascension/Seasons. */
"use strict";

function metaStatsInline(bag, mult) {
  var out = [];
  for (var k in bag) out.push(GM.statLine(k, bag[k] * (mult == null ? 1 : mult)));
  return out.join(", ");
}

/* ---------- town --------------------------------------------------------- */
GM.ui.renderTown = function () {
  var grid = GM.$("#townGrid");
  if (!grid) return;
  grid.innerHTML = "";

  GM.BUILDINGS.forEach(function (b) {
    var lv = GM.townLevel(b.id);
    var cost = GM.buildingCost(b, lv);
    var maxed = lv >= b.max;
    var afford = GM.state.char.gold >= cost;

    var card = GM.el("div", "card");
    card.innerHTML = "<h4>" + b.icon + " " + GM.esc(b.name) +
      ' <span class="lvl">' + lv + " / " + b.max + "</span></h4>" +
      '<div class="flavour">' + GM.esc(b.blurb) + "</div>" +
      '<div class="small" style="margin-top:5px">Now: ' +
      (lv ? GM.esc(metaStatsInline(b.per, lv)) : '<span class="faint">nothing yet</span>') + "</div>" +
      '<div class="small faint">Next level: ' + GM.esc(metaStatsInline(b.per, 1)) + "</div>";

    var btn = GM.el("button", "btn sm" + (afford && !maxed ? " primary" : ""),
      maxed ? "Complete" : "Build · " + GM.fmt(cost) + "g");
    btn.disabled = maxed || !afford;
    btn.style.marginTop = "6px";
    GM.on(btn, "click", function () {
      var r = GM.buyBuilding(b.id);
      GM.ui.toast(r.ok ? b.name + " raised to " + GM.townLevel(b.id) : r.why, r.ok ? "good" : "bad");
      GM.ui.markDirty(); GM.ui.renderTop();
    });
    card.appendChild(btn);
    grid.appendChild(card);
  });

  var sub = GM.$("#townSub");
  if (sub) {
    var total = 0;
    GM.BUILDINGS.forEach(function (b) { total += GM.townLevel(b.id); });
    sub.textContent = total + " levels raised · " + GM.fmt(GM.state.char.gold) + " gold";
  }
};

/* ---------- graves ------------------------------------------------------- */
GM.ui.renderGraves = function () {
  var list = GM.$("#graveList");
  if (!list) return;
  list.innerHTML = "";

  if (!GM.state.graves.length) {
    list.appendChild(GM.el("div", "empty",
      "No gravemarks. You have not died yet — which means you are not pushing hard enough."));
  }

  GM.state.graves.slice().sort(function (a, b) { return b.stage - a.stage; }).forEach(function (g) {
    var card = GM.el("div", "panel grave" + (g.state === "revenant" ? " rev" : ""));
    var best = g.recorded.slice().sort(function (a, b) { return b.tier - a.tier; })[0];

    var head = "Depth " + g.stage + " · " + GM.esc(g.realm);
    var body = '<div class="flavour">Killed by ' + GM.esc(g.killer) +
      " at level " + g.level + ". " + g.recorded.length + " modifiers recorded.</div>";

    if (best) {
      body += '<div class="small" style="margin-top:5px">Best held: <span class="gold">' +
        GM.esc((GM.AFFIX_BY_ID[best.affixId] || {}).name || best.affixId) +
        " T" + (best.displayTier || best.tier) + "</span> — " +
        GM.esc(GM.statLine(best.stat, best.value)) + "</div>";
    }

    if (g.state === "buried") {
      var pctDone = GM.clamp(g.progress / g.required, 0, 1);
      body += '<div class="bar slim" style="margin-top:7px"><div class="fill mhp" style="width:' +
        (pctDone * 100).toFixed(1) + '%"></div><div class="txt">' +
        Math.min(g.progress, g.required) + " / " + g.required + " kills</div></div>" +
        '<div class="small faint" style="margin-top:4px">Kills at or below depth ' + g.stage +
        " count; deeper kills count double.</div>";
    } else {
      body += '<div class="small bad" style="margin-top:6px">Standing. Power ×' +
        g.power.toFixed(2) + ". Beat it to claim double epitaphs and its gear.</div>";
    }

    card.innerHTML = "<h2>" + head + '<span class="sub">' +
      (g.state === "revenant" ? "REVENANT" : "buried") + "</span></h2>" + body;

    if (g.state === "revenant") {
      var b = GM.el("button", "btn sm danger", "Confront it");
      b.style.marginTop = "7px";
      GM.on(b, "click", function () {
        var r = GM.beginVigil(g.id);
        if (r.ok) { GM.ui.toast("The vigil begins.", ""); GM.ui.show("delve"); }
        else GM.ui.toast(r.why, "bad");
      });
      card.appendChild(b);
    }
    list.appendChild(card);
  });

  var sub = GM.$("#graveSub");
  if (sub) {
    sub.textContent = GM.buriedGraves().length + " buried · " + GM.revenants().length +
      " standing · " + GM.state.epitaphs.length + " epitaphs held";
  }
};

/* ---------- modes -------------------------------------------------------- */
GM.ui.renderModes = function () {
  var grid = GM.$("#modeGrid");
  if (grid) {
    grid.innerHTML = "";
    GM.MODE_DEFS.forEach(function (m) {
      if (m.hidden && !m.unlock()) return;
      var on = GM.state.mode.id === m.id;
      var open = m.unlock();
      var card = GM.el("div", "card" + (on ? " sel" : "") + (open ? "" : " locked"));
      card.innerHTML = "<h4>" + m.icon + " " + GM.esc(m.name) + "</h4>" +
        '<div class="flavour">' + GM.esc(m.blurb) + "</div>" +
        (open ? "" : '<div class="small bad" style="margin-top:4px">' + GM.esc(m.unlockText || "Locked") + "</div>");
      if (open && !on) {
        var b = GM.el("button", "btn sm primary", "Enter");
        b.style.marginTop = "6px";
        GM.on(b, "click", function () {
          var r = GM.setMode(m.id);
          if (r.ok) { GM.ui.toast("Entered " + m.name, ""); GM.ui.show("delve"); }
          else GM.ui.toast(r.why, "bad");
        });
        card.appendChild(b);
      } else if (on) {
        card.appendChild(GM.el("div", "small gold", "✓ active"));
      }
      grid.appendChild(card);
    });
  }

  var cfg = GM.$("#modeConfig");
  if (cfg) {
    cfg.innerHTML = "";
    var m = GM.state.mode;

    if (m.id === "exploration") {
      cfg.innerHTML = "<h2>Farming depth</h2>";
      var lab = GM.el("div", "small");
      lab.textContent = "Depth " + (m.target || 1) + " of " + GM.state.depth.maxEver + " cleared";
      var sl = GM.el("input");
      sl.type = "range";
      sl.min = 1; sl.max = Math.max(1, GM.state.depth.maxEver); sl.value = m.target || 1;
      GM.on(sl, "input", function () {
        lab.textContent = "Depth " + sl.value + " of " + GM.state.depth.maxEver + " cleared";
      });
      GM.on(sl, "change", function () { GM.setExplorationTarget(+sl.value); });
      cfg.appendChild(lab); cfg.appendChild(sl);

    } else if (m.id === "dimension") {
      cfg.innerHTML = "<h2>This dimension</h2>";
      if (m.dim) {
        var muts = GM.el("div");
        m.dim.mutators.forEach(function (id) {
          var mu = GM.MUTATOR_BY_ID[id];
          if (!mu) return;
          var chip = GM.el("span", "mut", mu.name);
          chip.title = mu.desc;
          muts.appendChild(chip);
        });
        cfg.appendChild(muts);
        var d = GM.el("div", "small");
        d.style.marginTop = "6px";
        d.innerHTML = m.dim.mutators.map(function (id) {
          var mu = GM.MUTATOR_BY_ID[id];
          return mu ? "<div class=\"faint\">" + GM.esc(mu.name) + ": " + GM.esc(mu.desc) + "</div>" : "";
        }).join("") + '<div class="gold" style="margin-top:5px">Payout ×' +
          m.dim.reward.toFixed(2) + " · depth " + m.dim.stage + "</div>";
        cfg.appendChild(d);
      }
      var rb = GM.el("button", "btn sm", "Roll a new dimension");
      rb.style.marginTop = "8px";
      GM.on(rb, "click", function () { GM.rerollDimension(); GM.ui.markDirty("modes"); });
      cfg.appendChild(rb);

    } else if (m.id === "tower") {
      cfg.innerHTML = "<h2>Divine Tower</h2>" +
        '<div class="small">Floor ' + (m.towerRun || 1) + " · best " + GM.state.depth.towerFloor +
        " · " + GM.fmt(GM.state.char.marks) + ' Marks</div><div class="flavour">' +
        "Each floor is one elite, tougher and more resistant than the last. Death drops you to the last checkpoint (every fifth floor).</div>";

    } else if (m.id === "finality") {
      cfg.innerHTML = "<h2>Finality</h2>" +
        '<div class="small">Wave ' + (m.wave || 1) + " · best " + GM.state.depth.finality +
        '</div><div class="flavour">Monster life climbs 34% a wave. There is no top. Die and it starts again at one.</div>';

    } else {
      cfg.innerHTML = "<h2>Expedition</h2><div class=\"flavour\">" +
        "The only mode that raises your record. Clear a pack of " + GM.CURVE.packSize +
        " to advance; every tenth depth is a boss. Die and you fall back to the start of the realm — and leave a gravemark where it happened.</div>";
    }
  }

  var sub = GM.$("#modeSub");
  if (sub) {
    var md = GM.MODE_BY_ID[GM.state.mode.id];
    sub.textContent = (md ? md.name : "") + " · depth " + GM.modeStage();
  }
};

/* ---------- ascend ------------------------------------------------------- */
GM.ui.renderAscend = function () {
  var prev = GM.$("#ascPreview");
  var can = GM.canAscend();
  if (prev) {
    prev.textContent = can
      ? "Ascending now yields " + GM.ascendPreview() + " Ichor (from depth " + GM.state.depth.maxEver + ")."
      : "Reach depth " + GM.ASCEND_MIN_STAGE + " to ascend. You are at " + GM.state.depth.maxEver + ".";
  }
  var btn = GM.$("#btnAscend");
  if (btn) btn.disabled = !can;

  var sub = GM.$("#ascSub");
  if (sub) sub.textContent = GM.fmt(GM.state.char.ichor) + " Ichor · " +
    GM.state.tally.ascensions + " ascensions";

  var grid = GM.$("#perkGrid");
  if (grid) {
    grid.innerHTML = "";
    GM.PERKS.forEach(function (p) {
      var lv = GM.perkLevel(p.id);
      var cost = GM.perkCost(p, lv);
      var maxed = lv >= p.max;
      var afford = GM.state.char.ichor >= cost;
      var card = GM.el("div", "card");
      card.innerHTML = "<h4>" + GM.esc(p.name) + ' <span class="lvl">' + lv + " / " + p.max + "</span></h4>" +
        '<div class="flavour">' + GM.esc(p.blurb) + "</div>" +
        '<div class="small" style="margin-top:5px">Now: ' +
        (lv ? GM.esc(metaStatsInline(p.per, lv)) : '<span class="faint">—</span>') + "</div>" +
        '<div class="small faint">Next: ' + GM.esc(metaStatsInline(p.per, 1)) + "</div>";
      var b = GM.el("button", "btn sm" + (afford && !maxed ? " primary" : ""),
        maxed ? "Maxed" : "Buy · " + cost + " Ichor");
      b.disabled = maxed || !afford;
      b.style.marginTop = "6px";
      GM.on(b, "click", function () {
        var r = GM.buyPerk(p.id);
        GM.ui.toast(r.ok ? p.name + " → " + GM.perkLevel(p.id) : r.why, r.ok ? "good" : "bad");
        GM.ui.markDirty(); GM.ui.renderTop();
      });
      card.appendChild(b);
      grid.appendChild(card);
    });
  }

  var sg = GM.$("#seasonGrid");
  if (sg) {
    sg.innerHTML = "";
    GM.seasonSlots().forEach(function (slot) {
      var on = GM.state.season === slot.season.id;
      var card = GM.el("div", "card" + (on ? " sel" : ""));
      card.innerHTML = "<h4>" + GM.esc(slot.season.name) + (on ? ' <span class="lvl">✓ current</span>' : "") + "</h4>" +
        '<div class="flavour">' + GM.esc(slot.season.blurb) + "</div>" +
        '<div class="small faint" style="margin-top:4px">' +
        (slot.exists ? "level " + slot.level + " · best depth " + slot.maxEver : "no save") + "</div>";
      if (!on) {
        var b = GM.el("button", "btn sm", slot.exists ? "Resume" : "Begin");
        b.style.marginTop = "6px";
        GM.on(b, "click", function () {
          GM.ui.modal("Switch season?",
            "<p>Your current season is saved and can be resumed at any time. Nothing is lost.</p>",
            [{ label: "Switch", cls: "primary", onClick: function () { GM.switchSeason(slot.season.id); } },
             { label: "Cancel" }]);
        });
        card.appendChild(b);
      }
      sg.appendChild(card);
    });
  }

  var t = GM.$("#tallyList");
  if (t) {
    t.innerHTML = "";
    var y = GM.state.tally;
    [["Kills", GM.fmt(y.kills)], ["Bosses", GM.fmt(y.bosses)], ["Deaths", GM.fmt(y.deaths)],
     ["Items found", GM.fmt(y.drops)], ["Salvaged", GM.fmt(y.salvaged)],
     ["Inscribed", GM.fmt(y.inscribed)], ["Revenants raised", GM.fmt(y.revenants)],
     ["Ascensions", GM.fmt(y.ascensions)], ["Best depth", GM.fmt(GM.state.depth.maxEver)],
     ["Tower floor", GM.fmt(GM.state.depth.towerFloor)], ["Finality wave", GM.fmt(GM.state.depth.finality)],
     ["Playtime", GM.fmtTime(y.playtime)]
    ].forEach(function (r) { t.appendChild(GM.ui.statRow(r[0], r[1])); });
  }
};

GM.ui.initMeta = function () {
  var a = GM.$("#btnAscend");
  if (a) GM.on(a, "click", function () {
    if (!GM.canAscend()) return;
    GM.ui.modal("Ascend?",
      "<p>You will lose your level, your gear, your stash, your tree and your gravemarks.</p>" +
      "<p>You keep the parish, every ascension perk, every rune and every epitaph &mdash; and gain <b>" +
      GM.ascendPreview() + " Ichor</b>.</p>",
      [{ label: "Ascend", cls: "primary danger", onClick: function () {
          var r = GM.ascend();
          GM.ui.toast(r.ok ? "+" + r.gained + " Ichor" : r.why, r.ok ? "good" : "bad");
          GM.ui.markDirty(); GM.ui.renderTop();
        } },
       { label: "Not yet" }]);
  });
};

GM.ui.panel("town", GM.ui.renderTown);
GM.ui.panel("graves", GM.ui.renderGraves);
GM.ui.panel("modes", GM.ui.renderModes);
GM.ui.panel("ascend", GM.ui.renderAscend);
