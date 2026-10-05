/* Iron League — screens, save, and the fight loop. */
(function (root) {
  const IL = root.IL = root.IL || {};
  const SAVE_KEY = "ironleague.v1";
  const app = document.getElementById("app");

  let save = null;
  let token = 0;
  let raf = 0;
  let draft = null;
  let speed = 1;
  let fight = null;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || data.v !== 1 || !Array.isArray(data.roster) || !data.roster.length) return null;
      if (!Array.isArray(data.clubs) || !Array.isArray(data.fixtures)) return null;
      return IL.migrate(data);
    } catch (err) {
      return null;
    }
  }

  function persist() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    } catch (err) {
      /* private mode or a full disk — the match still played */
    }
  }

  function stopLoops() {
    token++;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    fight = null;
  }

  function alive(tok) { return tok === token; }

  function takeRng() {
    const rng = IL.mulberry32(save.rngSeed >>> 0 || 1);
    const n = Math.floor(rng() * 1e9);
    save.rngSeed = (n + 1) >>> 0;
    return rng;
  }

  function roundRobin(ids) {
    const list = ids.slice();
    const rounds = [];
    for (let r = 0; r < ids.length - 1; r++) {
      const pairs = [];
      for (let i = 0; i < list.length / 2; i++) pairs.push([list[i], list[list.length - 1 - i]]);
      rounds.push(pairs);
      const fixed = list[0];
      const rest = list.slice(1);
      rest.unshift(rest.pop());
      list.length = 0;
      list.push.apply(list, [fixed].concat(rest));
    }
    return rounds;
  }

  function buildSeason(keepGold) {
    const rng = takeRng();
    const pool = IL.CLUBS.filter(function (n) { return n !== save.clubName; });
    const rivals = [];
    while (rivals.length < 5 && pool.length) {
      rivals.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
    }
    const clubs = [{ id: "you", name: save.clubName, you: true, w: 0, l: 0, pts: 0, pf: 0, pa: 0, str: 1 }];
    rivals.forEach(function (name, i) {
      const fighters = [0, 1, 2].map(function () { return IL.randomFighter(rng); });
      const str = fighters.reduce(function (s, f) {
        return s + (f.cls === "tank" ? 1.12 : f.cls === "mage" ? 1.06 : 1);
      }, 0) / 3;
      clubs.push({ id: "c" + i, name: name, you: false, w: 0, l: 0, pts: 0, pf: 0, pa: 0, str: str, fighters: fighters });
    });
    save.clubs = clubs;
    save.round = 0;
    save.fixtures = roundRobin(clubs.map(function (c) { return c.id; }));
    if (!keepGold) save.gold = IL.START_GOLD;
  }

  function clubById(id) {
    for (let i = 0; i < save.clubs.length; i++) if (save.clubs[i].id === id) return save.clubs[i];
    return null;
  }

  function nextRival() {
    if (!save || save.round >= 5) return null;
    const pairs = save.fixtures[save.round] || [];
    for (let i = 0; i < pairs.length; i++) {
      const p = pairs[i];
      if (p[0] === "you") return clubById(p[1]);
      if (p[1] === "you") return clubById(p[0]);
    }
    return null;
  }

  function fielded(roster, n) {
    return IL.fielded(roster, save && save.lineup, n);
  }

  function toggleLineup(id) {
    const on = (save.roster || []).some(function (f) { return f.id === id; });
    if (!on) return;
    if (!Array.isArray(save.lineup)) save.lineup = [];
    const at = save.lineup.indexOf(id);
    if (at >= 0) save.lineup.splice(at, 1);
    else if (save.lineup.length < IL.PARTY_CAP) save.lineup.push(id);
    persist();
    showHub();
  }

  function purseHtml() {
    const eq = IL.equippedRelics(save);
    const tokens = save.tokens || 0;
    return '<div class="purse">' +
      '<span class="coin"><b>' + save.gold + '</b> gold</span>' +
      '<span class="coin"><b>' + (save.renown || 0) + '</b> renown</span>' +
      '<span class="coin"><b>' + tokens + '</b> cup ' + (tokens === 1 ? "token" : "tokens") + '</span>' +
      '<span class="coin"><b>' + (save.roster || []).length + "/" + IL.ROSTER_CAP + '</b> roster</span>' +
      '<span class="coin"><b>' + eq.length + "/2</b> relics" + (eq.length ? " · " + esc(eq.map(function (r) { return r.name; }).join(", ")) : "") + '</span>' +
    '</div>';
  }

  function sortedClubs() {
    return save.clubs.slice().sort(function (a, b) {
      return (b.pts - a.pts) || ((b.pf - b.pa) - (a.pf - a.pa)) || (b.pf - a.pf);
    });
  }

  function blankParts(cls) {
    return { sheet: IL.defaultSheet(cls || "warrior") };
  }

  /* ---------- title ---------- */
  function showTitle() {
    stopLoops();
    app.onclick = null;
    save = load();
    const cont = save
      ? '<button type="button" class="btn ghost" id="continue">Continue — ' + esc(save.clubName) + '</button>'
      : '<button type="button" class="btn ghost" id="continue" disabled>Continue</button>';
    app.innerHTML =
      '<main class="title-screen">' +
        '<p class="eyebrow">Mercenary pit</p>' +
        '<h1>Iron League</h1>' +
        '<p class="lede">Raise a club. Send them into the sand. A season, a cup, then the board is read aloud.</p>' +
        '<div class="title-actions">' +
          '<button type="button" class="btn primary" id="newClub">New club</button>' +
          cont +
        '</div>' +
        '<p class="fine">Saved on this browser only.</p>' +
      '</main>';
    document.getElementById("newClub").onclick = function () { showCreator("captain"); };
    const c = document.getElementById("continue");
    if (save) c.onclick = function () { showHub(); };
  }

  /* ---------- creator ---------- */
  function showCreator(mode) {
    stopLoops();
    const rng = IL.mulberry32((Date.now() ^ (Math.floor(Math.random() * 1e9))) >>> 0);
    const renownNow = mode === "captain" ? 0 : ((save && save.renown) || 0);
    const openIds = IL.unlockedIds(renownNow);
    const cls = mode === "captain" ? "warrior" : IL.pick(rng, openIds.length ? openIds : Object.keys(IL.CLASSES));
    draft = {
      mode: mode,
      clubName: save && save.clubName ? save.clubName : "",
      fighter: {
        name: IL.pick(rng, IL.FIRST) + " " + IL.pick(rng, IL.LAST),
        cls: cls,
        parts: mode === "hire" ? IL.randomParts(rng, cls) : blankParts(cls)
      }
    };

    const classes = Object.keys(IL.CLASSES).map(function (id) {
      const c = IL.CLASSES[id];
      const open = IL.classUnlocked(id, renownNow);
      const note = open ? c.blurb : ("Locked · " + c.renown + " renown");
      return '<button type="button" class="class-card' + (open ? "" : " locked") + '" data-class="' + id + '"' + (open ? "" : " disabled") + '><strong>' + esc(c.name) + '</strong><span>' + esc(note) + '</span></button>';
    }).join("");
    const clubField = mode === "captain"
      ? '<label class="field"><span>Club name</span><input id="clubName" maxlength="24" autocomplete="off" placeholder="Ashveil Company" value="' + esc(draft.clubName) + '"></label>'
      : "";
    const warn = mode === "captain" && load()
      ? '<p class="warn">Founding a new club replaces the one saved in this browser.</p>'
      : "";
    const confirmLabel = mode === "captain"
      ? (load() ? "Replace and found the club" : "Found the club")
      : "Sign them — " + IL.HIRE_COST + " gold";

    app.innerHTML =
      '<main class="creator">' +
        '<header class="creator-head"><button type="button" class="text-btn" id="backTitle">' + (mode === "captain" ? "Back" : "Cancel") + '</button>' +
        '<h2>' + (mode === "captain" ? "Name your captain" : "A new recruit") + '</h2></header>' +
        warn +
        '<div class="creator-grid">' +
          '<div class="stage-card">' +
            '<canvas id="preview" width="640" height="250"></canvas>' +
            '<p class="fine" id="previewNote">Idle and a strike, from the same sheet.</p>' +
          '</div>' +
          '<div class="picker">' +
            clubField +
            '<label class="field"><span>Fighter name</span><input id="fighterName" maxlength="22" autocomplete="off" value="' + esc(draft.fighter.name) + '"></label>' +
            '<div class="row looks-row"><span>Look</span><div class="looks" id="looks"></div></div>' +
            '<div class="class-grid">' + classes + '</div>' +
            '<div class="creator-actions">' +
              '<button type="button" class="btn ghost" id="randomize">Randomize</button>' +
              '<button type="button" class="btn primary" id="confirm">' + confirmLabel + '</button>' +
            '</div>' +
            '<p class="fine" id="creatorError"></p>' +
          '</div>' +
        '</div>' +
      '</main>';

    document.getElementById("backTitle").onclick = function () {
      if (mode === "captain") showTitle();
      else showHub();
    };
    const clubInput = document.getElementById("clubName");
    if (clubInput) clubInput.addEventListener("input", function () { draft.clubName = clubInput.value; });
    const nameInput = document.getElementById("fighterName");
    nameInput.addEventListener("input", function () { draft.fighter.name = nameInput.value; });
    document.getElementById("randomize").onclick = function () {
      const r = IL.mulberry32((Date.now() ^ (Math.floor(Math.random() * 1e9))) >>> 0);
      const id = IL.pick(r, openIds.length ? openIds : Object.keys(IL.CLASSES));
      draft.fighter.cls = id;
      draft.fighter.parts = IL.randomParts(r, id);
      draft.fighter.name = IL.pick(r, IL.FIRST) + " " + IL.pick(r, IL.LAST);
      nameInput.value = draft.fighter.name;
      syncPicker();
    };
    document.getElementById("confirm").onclick = onConfirm;
    app.onclick = function (ev) {
      const t = ev.target.closest("button");
      if (!t) return;
      if (t.dataset.sheet) {
        draft.fighter.parts.sheet = t.dataset.sheet;
        syncPicker();
      } else if (t.dataset.class) {
        if (!IL.classUnlocked(t.dataset.class, renownNow)) return;
        draft.fighter.cls = t.dataset.class;
        const pool = IL.looksFor(draft.fighter.cls);
        if (pool.indexOf(draft.fighter.parts.sheet) < 0) draft.fighter.parts.sheet = pool[0];
        syncPicker();
      }
    };
    syncPicker();
    startPreview();
  }

  function syncPicker() {
    const p = draft.fighter.parts;
    paintLooks();
    mark("[data-sheet]", p.sheet);
    mark("[data-class]", draft.fighter.cls);
  }

  function paintLooks() {
    const box = document.getElementById("looks");
    if (!box) return;
    const pool = IL.looksFor(draft.fighter.cls);
    const sig = pool.join(",");
    if (box.dataset.pool === sig) return;
    box.dataset.pool = sig;
    box.innerHTML = pool.map(function (id, i) {
      return '<button type="button" class="look" data-sheet="' + id + '" aria-label="Look ' + (i + 1) + ' of ' + pool.length + '"><canvas width="48" height="56"></canvas></button>';
    }).join("");
    const buttons = box.querySelectorAll("button");
    pool.forEach(function (id, i) {
      const cv = buttons[i].querySelector("canvas");
      IL.hero.compose({ sheet: id }).then(function (atlas) {
        if (!cv || box.dataset.pool !== sig) return;
        const ctx = cv.getContext("2d");
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, cv.width, cv.height);
        IL.hero.draw(ctx, atlas, 1, 24, 52, 1, 1, draft.fighter.cls);
      }).catch(function () {});
    });
  }

  function mark(sel, value) {
    const nodes = app.querySelectorAll(sel);
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const on = (n.dataset.sheet || n.dataset.class) === value;
      n.classList.toggle("on", on);
      if (n.classList.contains("look") || n.classList.contains("chip") || n.classList.contains("class-card")) {
        n.setAttribute("aria-pressed", on ? "true" : "false");
      }
    }
  }

  function startPreview() {
    const tok = token;
    const canvas = document.getElementById("preview");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let atlas = null;
    let key = "";
    let last = performance.now();
    let t = 0;
    function loop(now) {
      if (!alive(tok)) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      const k = IL.hero.keyOf(draft.fighter.parts);
      if (k !== key) {
        key = k;
        atlas = null;
        IL.hero.compose(draft.fighter.parts).then(function (c) {
          if (alive(tok) && IL.hero.keyOf(draft.fighter.parts) === k) atlas = c;
        }).catch(function (err) {
          const note = document.getElementById("previewNote");
          if (note) note.textContent = err.message;
        });
      }
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = "#1a1612";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "rgba(224,176,122,0.25)";
      ctx.beginPath();
      ctx.moveTo(40, 214);
      ctx.lineTo(600, 214);
      ctx.stroke();
      ctx.fillStyle = "#e7d3b0";
      ctx.font = "16px Palatino, Georgia, serif";
      ctx.textAlign = "center";
      const kit = IL.CLASSES[draft.fighter.cls] || IL.CLASSES.warrior;
      const strike = (kit.attacks && kit.attacks[0]) || "atk1";
      const rightLabel = kit.role === "cast" ? "Cast" : (kit.role === "kite" ? "Shot" : "Strike");
      ctx.fillText("Idle", 180, 32);
      ctx.fillText(rightLabel, 460, 32);
      if (atlas) {
        const idleClip = kit.idle || "idle";
        IL.hero.draw(ctx, atlas, IL.frameIndex(idleClip, t), 180, 214, 4, 1, kit.id);
        IL.hero.draw(ctx, atlas, IL.frameIndex(strike, t % Math.max(0.05, IL.clipDur(strike))), 460, 214, 4, 1, kit.id);
      }
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
  }

  function onConfirm() {
    const err = document.getElementById("creatorError");
    const btn = document.getElementById("confirm");
    const name = (draft.fighter.name || "").trim() || (IL.pick(IL.mulberry32(Date.now() >>> 0), IL.FIRST) + " " + IL.pick(IL.mulberry32((Date.now() + 3) >>> 0), IL.LAST));
    draft.fighter.name = name.slice(0, 22);
    btn.disabled = true;
    if (err) err.textContent = "Sharpening blades…";

    if (draft.mode === "captain") {
      const clubName = (draft.clubName || "").trim().slice(0, 24) || "Unnamed Company";
      const seed = IL.hashStr(clubName + ":" + Date.now());
      const captain = Object.assign(IL.blankFighterFields(IL.mulberry32(seed)), {
        id: "cap" + seed.toString(36),
        name: draft.fighter.name,
        cls: draft.fighter.cls,
        parts: Object.assign({}, draft.fighter.parts),
        captain: true
      });
      const rng = IL.mulberry32(seed);
      const recruits = ["archer", "mage", "tank"].map(function (cls) {
        const f = IL.randomFighter(rng, cls);
        return f;
      });
      save = Object.assign({
        v: 1,
        clubName: clubName,
        gold: IL.START_GOLD,
        season: 1,
        rngSeed: seed,
        roster: [captain].concat(recruits)
      }, IL.freshClubFields(seed));
      buildSeason(false);
      save.market = IL.rollMarket(takeRng(), 0);
      save.lineup = save.roster.slice(0, IL.PARTY_CAP).map(function (f) { return f.id; });
      const rival = nextRival();
      const jobs = save.roster.map(function (f) { return IL.hero.compose(f.parts); });
      if (rival) rival.fighters.forEach(function (f) { jobs.push(IL.hero.compose(f.parts)); });
      Promise.all(jobs).then(function () {
        persist();
        showHub();
      }).catch(function (e) {
        btn.disabled = false;
        if (err) err.textContent = e.message;
      });
      return;
    }

    if (save.gold < IL.HIRE_COST) {
      btn.disabled = false;
      if (err) err.textContent = "Not enough gold.";
      return;
    }
    if (save.roster.length >= IL.ROSTER_CAP) {
      btn.disabled = false;
      if (err) err.textContent = "The bench is full.";
      return;
    }
    const fighter = Object.assign(IL.blankFighterFields(IL.mulberry32(Date.now() >>> 0)), {
      id: "h" + Date.now().toString(36),
      name: draft.fighter.name,
      cls: draft.fighter.cls,
      parts: Object.assign({}, draft.fighter.parts),
      captain: false
    });
    IL.hero.compose(fighter.parts).then(function () {
      save.gold -= IL.HIRE_COST;
      save.roster.push(fighter);
      persist();
      showHub();
    }).catch(function (e) {
      btn.disabled = false;
      if (err) err.textContent = e.message;
    });
  }

  /* ---------- hub ---------- */
  function tacticLabel(id) {
    if (id === "cover") return "Cover";
    if (id === "hold") return "Hold";
    return "Strike";
  }

  function personalityLabel(id) {
    if (id === "wary") return "Wary";
    if (id === "patient") return "Patient";
    return "Bold";
  }

  function pendingGrowth() {
    return (save.roster || []).filter(function (f) { return (f.pendingPicks || 0) > 0; });
  }

  function ensureMarket() {
    IL.migrate(save);
    if (!save.market || !save.market.length) {
      save.market = IL.rollMarket(takeRng(), save.renown || 0);
      persist();
    }
  }

  function showHub() {
    stopLoops();
    app.onclick = null;
    save = save || load();
    if (!save) { showTitle(); return; }
    IL.migrate(save);
    ensureMarket();
    persist();
    const rival = nextRival();
    const size = save.round < 5 ? IL.SEASON_SIZES[save.round] : 0;
    const yours = size ? fielded(save.roster, size) : [];
    const theirs = rival && size ? rival.fighters.slice(0, size) : [];
    const partyReady = !size || yours.length >= size;
    const chaosReady = fielded(save.roster, 1).length >= 1;
    const done = save.round >= 5;
    const table = sortedClubs().map(function (c, i) {
      const played = c.w + c.l;
      return '<tr class="' + (c.you ? "you" : "") + '"><td>' + (i + 1) + '</td><td>' + esc(c.name) + '</td><td>' + played + '</td><td>' + c.w + '</td><td>' + c.l + '</td><td>' + c.pts + '</td></tr>';
    }).join("");
    const slotOf = {};
    (save.lineup || []).forEach(function (id, i) { slotOf[id] = i; });
    const partyFull = (save.lineup || []).length >= IL.PARTY_CAP;
    const ordered = save.roster.slice().sort(function (a, b) {
      const sa = Object.prototype.hasOwnProperty.call(slotOf, a.id) ? slotOf[a.id] : 99;
      const sb = Object.prototype.hasOwnProperty.call(slotOf, b.id) ? slotOf[b.id] : 99;
      return sa - sb;
    });
    const pitCards = [];
    const benchCards = [];
    ordered.forEach(function (f) {
      const slot = Object.prototype.hasOwnProperty.call(slotOf, f.id) ? slotOf[f.id] : -1;
      const fighting = slot >= 0 && (!size || slot < size);
      const held = slot >= 0 && size > 0 && slot >= size;
      const kit = IL.CLASSES[f.cls] || IL.CLASSES.warrior;
      const anim = kit.idle || "idle";
      const champ = f.champion ? ' <em>Champion</em>' : "";
      let lineLabel = "Sit out";
      let lineClass = "chip lineup";
      if (fighting && size) {
        lineLabel = "Fighting · " + (slot + 1);
        lineClass += " on";
      } else if (held) {
        lineLabel = "Held · " + (slot + 1);
        lineClass += " held";
      } else if (slot >= 0) {
        lineLabel = "In the party · " + (slot + 1);
        lineClass += " on";
      } else if (partyFull) lineLabel = "Party full";
      const lineOff = slot < 0 && partyFull ? " disabled" : "";
      const html = '<article class="card' + (fighting ? " playing" : " bench") + '">' +
        '<canvas width="140" height="120" data-key="' + esc(IL.hero.keyOf(f.parts)) + '" data-anim="' + anim + '"></canvas>' +
        '<h3>' + esc(f.name) + (f.captain ? ' <em>Captain</em>' : '') + champ + '</h3>' +
        '<p>' + esc(kit.name) + ' · Lv ' + f.level + ' · ' + esc(personalityLabel(f.personality)) + '</p>' +
        '<p class="fine">' + esc(kit.ability ? kit.ability.name : "") + (kit.ability2 ? " · " + esc(kit.ability2.name) : "") + '</p>' +
        '<button type="button" class="' + lineClass + '" data-line="' + esc(f.id) + '" aria-pressed="' + (slot >= 0 ? "true" : "false") + '"' + lineOff + '>' + esc(lineLabel) + '</button>' +
        '<button type="button" class="chip tactic" data-fid="' + esc(f.id) + '">' + esc(tacticLabel(f.tactic)) + '</button>' +
      '</article>';
      if (fighting) pitCards.push(html);
      else benchCards.push(html);
    });
    const youNames = yours.length ? yours.map(function (f) { return f.name; }).join(" · ") : "Nobody slotted";
    const themNames = theirs.map(function (f) { return f.name; }).join(" · ");
    const relicCount = IL.equippedRelics(save).length;
    const cupLabel = (save.cup && !save.cup.champion)
      ? "Cup in progress"
      : ("Cup · " + (save.tokens || 0) + ((save.tokens || 0) === 1 ? " token" : " tokens"));
    const preview = (!done && rival)
      ? '<section class="preview-board" id="matchPreview">' +
          '<div><p class="eyebrow">Your party</p><h3>' + esc(youNames) + '</h3>' +
          '<p class="fine">' + yours.length + " of " + size + " walking in</p></div>" +
          '<p class="vs">vs</p>' +
          '<div><p class="eyebrow">Next opponent</p><h3>' + esc(rival.name) + '</h3>' +
          '<p class="fine">Record ' + (rival.w || 0) + "–" + (rival.l || 0) + (themNames ? " · sends " + esc(themNames) : "") + '</p></div>' +
          '<button type="button" class="btn primary" id="nextMatch"' + (partyReady ? "" : " disabled") + '>' +
            (partyReady ? "Send them in" : ("Choose " + size)) + '</button>' +
        '</section>'
      : "";
    const rivalCards = theirs.map(function (f) {
      return '<article class="card rival">' +
        '<canvas width="140" height="120" data-key="' + esc(IL.hero.keyOf(f.parts)) + '" data-anim="idle"></canvas>' +
        '<h3>' + esc(f.name) + '</h3>' +
        '<p>' + esc(IL.CLASSES[f.cls].name) + '</p>' +
      '</article>';
    }).join("");

    app.innerHTML =
      '<main class="hub">' +
        '<header class="hub-head">' +
          '<canvas class="crest" id="crest" width="64" height="64"></canvas>' +
          '<div><p class="eyebrow">Season ' + save.season + '</p><h2>' + esc(save.clubName) + '</h2>' +
          '</div>' +
          '<div class="hub-actions">' +
            (done ? '<button type="button" class="btn primary" id="nextSeason">Open next season</button>' : '') +
            '<button type="button" class="btn ghost" id="market">Market</button>' +
            '<button type="button" class="btn ghost" id="relics">Relics · ' + relicCount + '/2</button>' +
            '<button type="button" class="btn ghost" id="cup">' + esc(cupLabel) + '</button>' +
            '<button type="button" class="btn ghost" id="chaos"' + (chaosReady ? "" : " disabled") + '>Chaos pit</button>' +
            '<button type="button" class="text-btn" id="toTitle">Title</button>' +
          '</div>' +
        '</header>' +
        purseHtml() +
        (pendingGrowth().length
          ? '<p class="banner">Someone grew in the pit. <button type="button" class="btn primary" id="openGrowth">Choose a growth</button></p>'
          : '') +
        (done && save.relicSeason !== save.season
          ? '<p class="banner">Season closed. ' + esc(sortedClubs()[0].name) + ' leads the board. <button type="button" class="btn primary" id="claimRelic">Take the yard relic</button></p>'
          : (done
            ? '<p class="banner">Season closed. ' + esc(sortedClubs()[0].name) + ' leads the board. Roster, renown, and relics carry forward.</p>'
            : '<p class="banner">Match ' + (save.round + 1) + ' of 5 · ' + size + ' vs ' + size + ' against <strong>' + esc(rival ? rival.name : "—") + '</strong></p>')) +
        (size && yours.length < size
          ? '<p class="banner">The pit wants ' + size + '. ' + yours.length + ' chosen — add ' + (size - yours.length) + ' more from the bench.</p>'
          : '') +
        preview +
        '<div id="yourCards">' +
          '<section><h3 class="section">' + (size ? "In the pit" : "Party") + '</h3>' +
            '<p class="fine">First chosen is slot 1. Tap a card to take them out.</p>' +
            '<div class="cards">' + (pitCards.join("") || '<p class="fine">Nobody is walking in.</p>') + '</div></section>' +
          '<section><h3 class="section">Bench</h3>' +
            '<p class="fine">Tap Sit out to put them in the party. The list holds ' + IL.PARTY_CAP + '.</p>' +
            '<div class="cards">' + (benchCards.join("") || '<p class="fine">The whole club is in the party.</p>') + '</div></section>' +
        '</div>' +
        (theirs.length ? '<section><h3 class="section">They send</h3><div class="cards">' + rivalCards + '</div></section>' : '') +
        '<section><h3 class="section">Standings</h3>' +
          '<table class="board"><thead><tr><th></th><th>Club</th><th>P</th><th>W</th><th>L</th><th>Pts</th></tr></thead><tbody>' + table + '</tbody></table>' +
        '</section>' +
      '</main>';
    root.scrollTo(0, 0);

    drawCrest(document.getElementById("crest"), save.clubName);
    const nm = document.getElementById("nextMatch");
    if (nm) nm.onclick = function () { startFight(); };
    const ns = document.getElementById("nextSeason");
    if (ns) ns.onclick = function () {
      save.season += 1;
      save.gold += 30;
      buildSeason(true);
      persist();
      showHub();
    };
    const marketBtn = document.getElementById("market");
    if (marketBtn) marketBtn.onclick = function () { showMarket(); };
    const relicsBtn = document.getElementById("relics");
    if (relicsBtn) relicsBtn.onclick = function () { showRelics(); };
    const cupBtn = document.getElementById("cup");
    if (cupBtn) cupBtn.onclick = function () { showCup(); };
    const chaosBtn = document.getElementById("chaos");
    if (chaosBtn) chaosBtn.onclick = function () { startChaosFight(); };
    const growthBtn = document.getElementById("openGrowth");
    if (growthBtn) growthBtn.onclick = function () { showGrowth(); };
    const claimBtn = document.getElementById("claimRelic");
    if (claimBtn) claimBtn.onclick = function () {
      const relic = IL.offerRelic(save, takeRng());
      save.relicSeason = save.season;
      if (relic && save.equipped.length < 2) save.equipped.push(relic.id);
      persist();
      showHub();
    };
    document.getElementById("toTitle").onclick = showTitle;
    const cards = document.getElementById("yourCards");
    if (cards) cards.onclick = function (ev) {
      const line = ev.target.closest("[data-line]");
      if (line) { toggleLineup(line.dataset.line); return; }
      const btn = ev.target.closest("[data-fid]");
      if (!btn) return;
      const f = save.roster.filter(function (r) { return r.id === btn.dataset.fid; })[0];
      if (!f) return;
      const order = IL.TACTICS;
      const i = order.indexOf(f.tactic);
      f.tactic = order[(i + 1) % order.length] || "strike";
      persist();
      showHub();
    };
    bootCards();
  }

  function drawCrest(canvas, name) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const h = IL.hashStr(name || "iron");
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#2a2118";
    ctx.fillRect(0, 0, 64, 64);
    ctx.strokeStyle = "#c4622d";
    ctx.lineWidth = 3;
    ctx.strokeRect(4, 4, 56, 56);
    ctx.beginPath();
    const sides = 3 + (h % 3);
    for (let i = 0; i < sides; i++) {
      const a = -Math.PI / 2 + (i / sides) * Math.PI * 2 + ((h >> 4) % 5) * 0.05;
      const rr = 16 + ((h >> (i * 2)) & 3);
      const x = 32 + Math.cos(a) * rr;
      const y = 34 + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = "#e7d3b0";
    ctx.fill();
  }

  function bootCards(extraParts) {
    const tok = token;
    const canvases = Array.prototype.slice.call(app.querySelectorAll("canvas[data-key]"));
    const ready = {};
    const pending = {};
    save.roster.forEach(function (f) { pending[IL.hero.keyOf(f.parts)] = f.parts; });
    (extraParts || []).forEach(function (parts) { if (parts) pending[IL.hero.keyOf(parts)] = parts; });
    const rival = nextRival();
    if (rival && save.round < 5) {
      const n = IL.SEASON_SIZES[save.round];
      rival.fighters.slice(0, n).forEach(function (f) { pending[IL.hero.keyOf(f.parts)] = f.parts; });
    }
    Object.keys(pending).forEach(function (k) {
      IL.hero.compose(pending[k]).then(function (c) { if (alive(tok)) ready[k] = c; }).catch(function () {});
    });
    let last = performance.now();
    let t = 0;
    function loop(now) {
      if (!alive(tok)) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      for (let i = 0; i < canvases.length; i++) {
        const c = canvases[i];
        if (!c.isConnected) continue;
        const atlas = ready[c.dataset.key];
        const ctx = c.getContext("2d");
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = "#241c16";
        ctx.fillRect(0, 0, c.width, c.height);
        if (!atlas) continue;
        const clip = c.dataset.anim || "idle";
        IL.hero.draw(ctx, atlas, IL.frameIndex(clip, t + i * 0.2), c.width / 2, c.height - 10, 3, 1);
      }
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
  }

  /* ---------- market, relics, cup ---------- */
  function showMarket() {
    stopLoops();
    save = save || load();
    if (!save) { showTitle(); return; }
    ensureMarket();
    const cards = save.market.map(function (row, i) {
      const f = row.fighter;
      const kit = IL.CLASSES[f.cls] || IL.CLASSES.warrior;
      const locked = !!row.locked;
      const champ = f.champion ? " · Champion" : "";
      const price = locked ? (row.need + " renown") : (row.cost + " gold");
      return '<article class="card">' +
        '<canvas width="140" height="120" data-key="' + esc(IL.hero.keyOf(f.parts)) + '" data-anim="' + (kit.idle || "idle") + '"></canvas>' +
        '<h3>' + esc(f.name) + champ + '</h3>' +
        '<p>' + esc(kit.name) + ' · ' + esc(personalityLabel(f.personality)) + '</p>' +
        '<p class="fine">' + esc(kit.ability ? kit.ability.name : "") + '</p>' +
        '<button type="button" class="btn primary hire" data-hire="' + i + '"' + (locked || save.gold < row.cost || save.roster.length >= IL.ROSTER_CAP ? " disabled" : "") + '>' + (locked ? "Locked" : "Hire") + ' — ' + esc(price) + '</button>' +
      '</article>';
    }).join("");
    const bench = save.roster.filter(function (f) { return !f.captain; }).map(function (f) {
      const kit = IL.CLASSES[f.cls] || IL.CLASSES.warrior;
      const inParty = (save.lineup || []).indexOf(f.id) >= 0;
      return '<article class="card">' +
        '<canvas width="140" height="120" data-key="' + esc(IL.hero.keyOf(f.parts)) + '" data-anim="' + (kit.idle || "idle") + '"></canvas>' +
        '<h3>' + esc(f.name) + '</h3>' +
        '<p>' + esc(kit.name) + ' · Lv ' + f.level + (inParty ? " · in the party" : "") + '</p>' +
        '<button type="button" class="btn ghost" data-sell="' + esc(f.id) + '">Sell — ' + IL.sellValue(f) + ' gold</button>' +
      '</article>';
    }).join("");
    const captain = save.roster.filter(function (f) { return f.captain; })[0];
    app.innerHTML =
      '<main class="hub" id="market">' +
        '<header class="hub-head"><button type="button" class="text-btn" id="backHub">Back to the club</button>' +
        '<div><p class="eyebrow">Hire board</p><h2>Market</h2></div>' +
        '<div class="hub-actions"><button type="button" class="btn ghost" id="refreshMarket"' + (save.gold < IL.REFRESH_COST ? " disabled" : "") + '>Refresh — ' + IL.REFRESH_COST + ' gold</button></div></header>' +
        purseHtml() +
        '<p class="banner">Hire a name onto the bench, then slot them from the club hub. A champion costs more. Locked kits open with renown. Roster ' + save.roster.length + ' of ' + IL.ROSTER_CAP + '.</p>' +
        '<h3 class="section">For hire</h3>' +
        '<div class="cards" id="marketCards">' + cards + '</div>' +
        '<h3 class="section">Sell from the bench</h3>' +
        '<p class="fine">' + (captain ? esc(captain.name) + " is captain and stays." : "The captain stays.") + '</p>' +
        '<div class="cards">' + (bench || '<p class="fine">Hire someone before there is a bench to sell.</p>') + '</div>' +
      '</main>';
    root.scrollTo(0, 0);
    document.getElementById("backHub").onclick = function () { showHub(); };
    document.getElementById("refreshMarket").onclick = function () {
      if (save.gold < IL.REFRESH_COST) return;
      save.gold -= IL.REFRESH_COST;
      save.market = IL.rollMarket(takeRng(), save.renown || 0);
      persist();
      showMarket();
    };
    app.onclick = function (ev) {
      const hire = ev.target.closest("[data-hire]");
      const sell = ev.target.closest("[data-sell]");
      if (hire) hireFromMarket(+hire.dataset.hire);
      else if (sell) sellFighter(sell.dataset.sell);
    };
    bootCards(save.market.map(function (row) { return row.fighter.parts; }));
  }

  function hireFromMarket(index) {
    const row = save.market[index];
    if (!row || row.locked) return;
    if (save.gold < row.cost || save.roster.length >= IL.ROSTER_CAP) return;
    const fighter = row.fighter;
    IL.hero.compose(fighter.parts).then(function () {
      save.gold -= row.cost;
      save.roster.push(fighter);
      save.market.splice(index, 1);
      if (!save.market.length) save.market = IL.rollMarket(takeRng(), save.renown || 0);
      persist();
      showMarket();
    }).catch(function () { showMarket(); });
  }

  function sellFighter(id) {
    const f = save.roster.filter(function (r) { return r.id === id && !r.captain; })[0];
    if (!f) return;
    save.gold += IL.sellValue(f);
    save.roster = save.roster.filter(function (r) { return r !== f; });
    save.lineup = (save.lineup || []).filter(function (fid) { return fid !== f.id; });
    persist();
    showMarket();
  }

  function showRelics() {
    stopLoops();
    save = save || load();
    if (!save) { showTitle(); return; }
    IL.migrate(save);
    const owned = {};
    (save.relics || []).forEach(function (id) { owned[id] = true; });
    const list = IL.RELICS.map(function (r) {
      const have = !!owned[r.id];
      const on = (save.equipped || []).indexOf(r.id) >= 0;
      const status = on ? "Riding with the party" : (have ? "In the chest" : "Won from a cup or a finished season");
      return '<article class="card relic' + (on ? " playing" : "") + '">' +
        '<h3>' + esc(r.name) + '</h3>' +
        '<p>' + esc(r.blurb) + '</p>' +
        '<p class="fine">' + status + '</p>' +
        (have
          ? '<button type="button" class="btn ' + (on ? "primary" : "ghost") + '" data-equip="' + r.id + '">' + (on ? "Equipped" : "Equip") + '</button>'
          : '<p class="fine">Not in the yard yet.</p>') +
      '</article>';
    }).join("");
    app.innerHTML =
      '<main class="hub" id="relics">' +
        '<header class="hub-head"><button type="button" class="text-btn" id="backHub">Back</button>' +
        '<div><p class="eyebrow">Club relics</p><h2>The yard chest</h2>' +
        '<p class="meta">' + (save.equipped || []).length + ' of 2 equipped · ' + (save.relics || []).length + ' owned</p></div></header>' +
        purseHtml() +
        '<p class="banner">Two relics ride with everyone you field. Win a cup or close a season to add one. Equip them here, then send the party from the club hub.</p>' +
        '<div class="cards">' + list + '</div>' +
      '</main>';
    root.scrollTo(0, 0);
    document.getElementById("backHub").onclick = function () { showHub(); };
    app.onclick = function (ev) {
      const btn = ev.target.closest("[data-equip]");
      if (!btn) return;
      const id = btn.dataset.equip;
      const eq = save.equipped || (save.equipped = []);
      const at = eq.indexOf(id);
      if (at >= 0) eq.splice(at, 1);
      else if (eq.length < 2) eq.push(id);
      else eq.splice(0, 1, id);
      persist();
      showRelics();
    };
  }

  function cupMarkup(cup) {
    if (!cup) return "";
    const rows = (cup.pairing || []).map(function (pair, i) {
      const a = cup.slots[pair[0]];
      const b = cup.slots[pair[1]];
      const win = cup.winners[i];
      const label = (a ? a.name : "?") + " vs " + (b ? b.name : "?");
      const mark = win ? (" · " + (cup.slots.filter(function (s) { return s.id === win; })[0] || {}).name + " through") : "";
      return "<li>" + esc(label + mark) + "</li>";
    }).join("");
    const champ = cup.champion ? ("<p class='banner'>Cup champion: " + esc((cup.slots.filter(function (s) { return s.id === cup.champion; })[0] || {}).name || cup.champion) + "</p>") : "";
    return "<ol class='bracket'>" + rows + "</ol>" + champ;
  }

  function showCup() {
    stopLoops();
    save = save || load();
    if (!save) { showTitle(); return; }
    const cup = save.cup;
    const opp = cup ? IL.cupOpponent(cup) : null;
    const cupSize = cup ? cup.size : 2;
    const sent = fielded(save.roster, cupSize);
    const sentNames = sent.map(function (f) { return f.name; }).join(" · ") || "nobody yet";
    const cupReady = !cup || sent.length >= cup.size;
    const fightBtn = opp
      ? '<button type="button" class="btn primary" id="cupFight"' + (cupReady ? "" : " disabled") + '>Fight ' + esc(opp.foe.name) + '</button>'
      : "";
    const enter = (!cup || cup.champion)
      ? '<button type="button" class="btn primary" id="enterCup"' + ((save.tokens || 0) < 1 ? " disabled" : "") + '>Enter cup — 1 token</button>'
      : fightBtn;
    app.innerHTML =
      '<main class="hub" id="cup">' +
        '<header class="hub-head"><button type="button" class="text-btn" id="backHub">Back to the club</button>' +
        '<div><p class="eyebrow">Single elimination</p><h2>The cup</h2></div>' +
        '<div class="hub-actions">' + enter + '</div></header>' +
        purseHtml() +
        '<p class="banner">Four clubs. You send ' + esc(sentNames) + '. The other semi is called from the yard. Win the final for gold, renown, and a shot at a relic.</p>' +
        (opp && !cupReady ? '<p class="banner">Set ' + cup.size + ' fighters in the lineup on the club hub before this tie.</p>' : '') +
        (cup ? cupMarkup(cup) : '<p class="fine">No bracket yet.</p>') +
      '</main>';
    root.scrollTo(0, 0);
    document.getElementById("backHub").onclick = function () { showHub(); };
    const enterBtn = document.getElementById("enterCup");
    if (enterBtn) enterBtn.onclick = function () {
      if ((save.tokens || 0) < 1) return;
      save.tokens -= 1;
      save.cup = IL.startCup(save, takeRng());
      persist();
      showCup();
    };
    const fight = document.getElementById("cupFight");
    if (fight) fight.onclick = function () { startCupFight(); };
  }

  function showGrowth() {
    stopLoops();
    const queue = pendingGrowth();
    if (!queue.length) { showHub(); return; }
    const f = queue[0];
    const choices = IL.boostChoices(f);
    const buttons = choices.map(function (key) {
      return '<button type="button" class="class-card" data-boost="' + key + '"><strong>' + esc(IL.BOOST_LABEL[key] || key) + '</strong><span>One step, kept on this fighter.</span></button>';
    }).join("");
    app.innerHTML =
      '<main class="creator" id="growth">' +
        '<header class="creator-head"><h2>A growth for ' + esc(f.name) + '</h2></header>' +
        '<p class="banner">Level ' + f.level + '. ' + f.pendingPicks + ' choice' + (f.pendingPicks === 1 ? "" : "s") + ' waiting. Pick one.</p>' +
        '<div class="class-grid" id="growthChoices">' + buttons + '</div>' +
      '</main>';
    document.getElementById("growthChoices").onclick = function (ev) {
      const btn = ev.target.closest("[data-boost]");
      if (!btn) return;
      IL.applyBoost(f, btn.dataset.boost);
      persist();
      if (pendingGrowth().length) showGrowth();
      else showHub();
    };
  }

  /* ---------- fight ---------- */
  function launchMatch(spec) {
    const people = [];
    if (spec.sides) {
      spec.sides.forEach(function (s) { (s.fighters || []).forEach(function (f) { if (f) people.push(f); }); });
    } else {
      spec.left.forEach(function (f) { people.push(f); });
      spec.right.forEach(function (f) { people.push(f); });
    }
    const jobs = {};
    people.forEach(function (f) { if (f && f.parts) jobs[IL.hero.keyOf(f.parts)] = f.parts; });
    const keys = Object.keys(jobs);
    const fxReady = IL.fx && IL.fx.load ? IL.fx.load() : Promise.resolve();
    return Promise.all(keys.map(function (k) { return IL.hero.compose(jobs[k]); }).concat([fxReady])).then(function (canvases) {
      const map = {};
      keys.forEach(function (k, i) { map[k] = canvases[i]; });
      stopLoops();
      const tok = token;
      speed = 1;
      const relics = IL.equippedRelics(save);
      const match = spec.sides
        ? IL.createMatch({ seed: spec.seed, sides: spec.sides, relics: relics, mode: spec.mode })
        : IL.createMatch({
          seed: spec.seed,
          left: spec.left,
          right: spec.right,
          leftName: spec.leftName,
          rightName: spec.rightName,
          relics: relics,
          mode: spec.mode
        });
      match.units.forEach(function (u) { u.sprite = map[IL.hero.keyOf(u.parts)]; });
      fight = {
        match: match,
        left: spec.left || (spec.sides && spec.sides[0].fighters) || [],
        right: spec.right || [],
        rival: spec.rival || null,
        size: spec.size || 1,
        mode: spec.mode || "league",
        tok: tok
      };
      IL.currentMatch = match;
      mountFight(match);
      runFight(tok);
    });
  }

  function startFight() {
    const rival = nextRival();
    if (!rival) return;
    const size = IL.SEASON_SIZES[save.round];
    const left = fielded(save.roster, size);
    if (left.length < size) return;
    const right = rival.fighters.slice(0, size);
    const btn = document.getElementById("nextMatch");
    if (btn) { btn.disabled = true; btn.textContent = "Opening the pit…"; }
    launchMatch({
      mode: "league",
      left: left,
      right: right,
      leftName: save.clubName,
      rightName: rival.name,
      rival: rival,
      size: size,
      seed: (save.rngSeed ^ (save.season * 997) ^ ((save.round + 1) * 131)) >>> 0
    }).catch(function (e) {
      if (btn) { btn.disabled = false; btn.textContent = "Next match"; }
      const banner = document.querySelector(".banner");
      if (banner) banner.textContent = e.message;
    });
  }

  function startCupFight() {
    const cup = save.cup;
    const opp = cup && IL.cupOpponent(cup);
    if (!opp) return;
    const left = fielded(save.roster, cup.size);
    if (left.length < cup.size) return;
    const btn = document.getElementById("cupFight");
    if (btn) { btn.disabled = true; btn.textContent = "Opening the pit…"; }
    launchMatch({
      mode: "cup",
      left: left,
      right: opp.foe.fighters.slice(0, cup.size),
      leftName: save.clubName,
      rightName: opp.foe.name,
      size: cup.size,
      seed: (save.rngSeed ^ (save.season * 811) ^ ((cup.round + 1) * 17)) >>> 0
    }).catch(function (e) {
      if (btn) btn.disabled = false;
      const banner = document.querySelector(".banner");
      if (banner) banner.textContent = e.message;
    });
  }

  function startChaosFight() {
    if (fielded(save.roster, 1).length < 1) return;
    const chaos = IL.startChaos(save, takeRng());
    persist();
    const btn = document.getElementById("chaos");
    if (btn) { btn.disabled = true; btn.textContent = "Opening the pit…"; }
    launchMatch({
      mode: "chaos",
      sides: chaos.sides,
      left: chaos.sides[0].fighters,
      size: 1,
      seed: (save.rngSeed ^ 0xC4A05) >>> 0
    }).catch(function (e) {
      if (btn) btn.disabled = false;
      const banner = document.querySelector(".banner");
      if (banner) banner.textContent = e.message;
    });
  }

  function mountFight(match) {
    app.onclick = null;
    app.innerHTML =
      '<main class="fight-screen">' +
        '<header class="bar">' +
          '<div class="side you"><strong id="leftName"></strong><span id="leftHp"></span></div>' +
          '<div class="timer" id="timer">0:00</div>' +
          '<div class="side them"><strong id="rightName"></strong><span id="rightHp"></span></div>' +
        '</header>' +
        '<div class="fight-layout">' +
          '<div class="stage"><canvas id="arena" width="1440" height="900"></canvas><div id="result" class="result" hidden></div></div>' +
          '<aside id="liveList"></aside>' +
        '</div>' +
        '<footer class="fight-controls">' +
          '<button type="button" class="btn ghost on" id="speed1">Speed 1×</button>' +
          '<button type="button" class="btn ghost" id="speed2">Speed 2×</button>' +
          '<button type="button" class="btn primary" id="skip">Skip</button>' +
        '</footer>' +
      '</main>';
    document.getElementById("leftName").textContent = match.leftName;
    document.getElementById("rightName").textContent = (match.teams || 2) > 2
      ? (match.names || []).slice(1).join(" · ")
      : match.rightName;
    document.getElementById("speed1").onclick = function () { speed = 1; markSpeed(); };
    document.getElementById("speed2").onclick = function () { speed = 2; markSpeed(); };
    document.getElementById("skip").onclick = function () { skipFight(); };
    const list = document.getElementById("liveList");
    list.innerHTML = match.units.map(function (u, i) {
      const kit = IL.CLASSES[u.cls] || IL.CLASSES.warrior;
      const side = u.team === 0 ? "you" : "them";
      return '<div class="live ' + side + '" data-i="' + i + '"><b>' + esc(u.name) + '</b><small>' + esc(kit.name) + (kit.ability ? " · " + esc(kit.ability.name) : "") + '</small><div class="track"><div class="fill"></div></div></div>';
    }).join("");
  }

  function markSpeed() {
    const a = document.getElementById("speed1");
    const b = document.getElementById("speed2");
    if (a) a.classList.toggle("on", speed === 1);
    if (b) b.classList.toggle("on", speed === 2);
  }

  function teamHp(match, team) {
    let hp = 0;
    let max = 0;
    match.units.forEach(function (u) {
      if (u.team !== team) return;
      hp += Math.max(0, u.hp);
      max += u.maxHp;
    });
    return max ? Math.round(100 * hp / max) : 0;
  }

  function runFight(tok) {
    const canvas = document.getElementById("arena");
    const ctx = canvas.getContext("2d");
    const fx = { shake: 0, nums: [], booms: [], sprites: [], t: 0, cam: null };
    let last = performance.now();
    let acc = 0;
    function frame(now) {
      if (!alive(tok) || !fight) return;
      const match = fight.match;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      fx.t += dt;
      if (!match.over) {
        acc += dt * speed;
        let guard = 0;
        while (acc >= 1 / 60 && !match.over && guard < 8) {
          IL.stepMatch(match, 1 / 60);
          consume(match, fx);
          acc -= 1 / 60;
          guard++;
        }
      }
      ageFx(fx, dt);
      IL.drawArena(ctx, match, fx);
      paintHud(match);
      if (match.over) { finishFight(); return; }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
  }

  function consume(match, fx) {
    for (let i = 0; i < match.events.length; i++) {
      const e = match.events[i];
      if (e.type === "dmg") {
        fx.nums.push({ x: e.x, y: e.y, n: e.n, blocked: e.blocked, crit: e.crit, t: 0, life: 0.7 });
        /* Amplitude is IL.SHAKE_SCALE in render.js. These stay in raw units. */
        if (typeof e.n === "number") fx.shake = Math.min(7, fx.shake + (e.blocked ? 1.5 : 3.2));
      } else if (e.type === "heal") {
        fx.nums.push({ x: e.x, y: e.y, n: e.n, heal: true, t: 0, life: 0.7 });
      } else if (e.type === "dodge") {
        fx.nums.push({ x: e.x, y: e.y, dodge: true, t: 0, life: 0.45 });
      } else if (e.type === "boom") {
        fx.booms.push({ x: e.x, y: e.y, r: e.r, kind: e.kind, t: 0, life: 0.48 });
        fx.shake = Math.min(8, fx.shake + 4);
      } else if (e.type === "fx" && IL.fx) {
        IL.fx.spawn(fx.sprites, e.kind, e.x, e.y, {
          size: e.size,
          facing: e.facing,
          rot: e.rot,
          ground: e.ground,
          team: e.team
        });
      }
    }
    match.events.length = 0;
  }

  function ageFx(fx, dt) {
    fx.shake *= Math.pow(0.04, dt);
    if (fx.shake < 0.15) fx.shake = 0;
    fx.nums = fx.nums.filter(function (n) { n.t += dt; return n.t < n.life; });
    fx.booms = fx.booms.filter(function (b) { b.t += dt; return b.t < b.life; });
    if (IL.fx) IL.fx.step(fx.sprites, dt);
  }

  function paintHud(match) {
    const timer = document.getElementById("timer");
    if (timer) {
      const s = Math.floor(match.time);
      timer.textContent = Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
    }
    const lh = document.getElementById("leftHp");
    const rh = document.getElementById("rightHp");
    if (lh) lh.textContent = teamHp(match, 0) + "%";
    if (rh) rh.textContent = teamHp(match, 1) + "%";
    const rows = document.querySelectorAll("#liveList .live");
    for (let i = 0; i < rows.length; i++) {
      const u = match.units[i];
      if (!u) continue;
      const fill = rows[i].querySelector(".fill");
      if (fill) fill.style.width = Math.max(0, u.hp / u.maxHp * 100) + "%";
    }
  }

  function skipFight() {
    if (!fight || fight.match.over) return;
    const match = fight.match;
    let n = 0;
    while (!match.over && n < 4000) {
      IL.stepMatch(match, 1 / 60);
      match.events.length = 0;
      n++;
    }
    finishFight();
  }

  function finishFight() {
    if (!fight || fight.settled) return;
    const match = fight.match;
    if (!match.over) {
      match.over = true;
      match.winner = 0;
    }
    fight.settled = true;
    const win = match.winner === 0;
    const pf = match.kills[0] || 0;
    const pa = match.units.filter(function (u) { return u.team === 0 && u.hp <= 0; }).length;
    const mode = fight.mode || "league";
    let gold = win ? 40 + 10 * fight.size : 16;
    let renown = win ? 6 + fight.size : 2;
    let xp = win ? 22 : 8;
    let headline = win ? "The pit is yours" : "They walk out";
    let relicNote = "";
    if (mode === "cup") {
      const cup = save.cup;
      const opp = cup && IL.cupOpponent(cup);
      const wasFinal = cup && cup.round >= 1;
      if (opp) IL.noteCupResult(cup, opp.pair, win ? "you" : opp.foe.id);
      if (cup) {
        IL.resolveOtherPairs(cup, save.roster, takeRng());
        IL.advanceCup(cup);
        let guard = 0;
        while (save.cup && !save.cup.champion && !IL.cupOpponent(save.cup) && guard < 3) {
          IL.resolveOtherPairs(save.cup, save.roster, takeRng());
          IL.advanceCup(save.cup);
          guard++;
        }
      }
      if (!win) {
        gold = wasFinal ? 55 : 24;
        renown = wasFinal ? 10 : 4;
        headline = wasFinal ? "The final slips away" : "Out of the cup";
      } else if (cup && cup.champion === "you") {
        gold = 90;
        renown = 18;
        xp = 30;
        save.tokens = (save.tokens || 0) + 1;
        headline = "The cup is yours";
        if (takeRng()() < 0.7) {
          const relic = IL.offerRelic(save, takeRng());
          if (relic) {
            relicNote = " Relic: " + relic.name + ".";
            if (save.equipped.length < 2) save.equipped.push(relic.id);
          }
        }
      } else {
        gold = 20;
        renown = 5;
        headline = "Through to the final";
      }
    } else if (mode === "chaos") {
      gold = win ? 32 : 12;
      renown = win ? 7 : 2;
      headline = win ? "The pit is yours" : "They walk out";
    } else {
      if (win) save.tokens = (save.tokens || 0) + 1;
      recordRound(win, pf, pa);
    }
    if (IL.equippedRelics(save).some(function (r) { return r.kind === "renown"; })) {
      renown = Math.round(renown * 1.25);
    }
    gold += match.stats.bounty || 0;
    const before = {};
    fight.left.forEach(function (f) {
      if (!f) return;
      before[f.id] = f.level;
      IL.grantXp(f, xp);
    });
    save.gold += gold;
    save.renown = (save.renown || 0) + renown;
    persist();
    const ups = fight.left.filter(function (f) { return f && f.level > before[f.id]; }).map(function (f) { return f.name; });
    const stood = match.units.filter(function (u) { return u.team === 0 && u.hp > 0; }).map(function (u) { return u.name; });
    const fell = match.units.filter(function (u) { return u.team === 0 && u.hp <= 0; }).map(function (u) { return u.name; });
    let nextLine = "";
    if (mode === "league") {
      if (save.round >= 5) nextLine = "The season board is closed.";
      else {
        const nxt = nextRival();
        const nsize = IL.SEASON_SIZES[save.round];
        nextLine = "Next is match " + (save.round + 1) + " of 5 · " + nsize + " vs " + nsize + (nxt ? " against " + nxt.name : "") + ".";
      }
    } else if (mode === "cup") {
      nextLine = save.cup && save.cup.champion ? "The bracket is finished." : "The bracket is waiting on the cup screen.";
    } else {
      nextLine = "The club hub is ready when you are.";
    }
    const box = document.getElementById("result");
    if (!box) return;
    box.hidden = false;
    box.innerHTML =
      '<p class="eyebrow">' + (win ? "Victory" : "Defeat") + '</p>' +
      '<h2>' + headline + '</h2>' +
      '<ul class="payout">' +
        '<li>+' + gold + ' gold</li>' +
        '<li>+' + renown + ' renown</li>' +
        '<li>' + xp + ' xp for each fighter you sent</li>' +
        (ups.length ? '<li>Level up: ' + esc(ups.join(", ")) + '</li>' : '') +
        (relicNote ? '<li>' + esc(relicNote.trim()) + '</li>' : '') +
      '</ul>' +
      '<p>' + (stood.length ? "Still standing: " + esc(stood.join(", ")) + "." : "") +
        (fell.length ? (stood.length ? " " : "") + "Down: " + esc(fell.join(", ")) + "." : "") + '</p>' +
      '<p class="fine">' + esc(nextLine) + '</p>' +
      '<button type="button" class="btn primary" id="backHub">' + (pendingGrowth().length ? "Choose a growth" : "Back to the club") + '</button>';
    const skip = document.getElementById("skip");
    if (skip) skip.disabled = true;
    document.getElementById("backHub").onclick = function () {
      IL.currentMatch = null;
      if (pendingGrowth().length) showGrowth();
      else if (mode === "cup") showCup();
      else showHub();
    };
    paintHud(match);
    const canvas = document.getElementById("arena");
    if (canvas) {
      const fx = { shake: 0, nums: [], booms: [], sprites: [], t: 0, cam: null };
      IL.drawArena(canvas.getContext("2d"), match, fx);
    }
  }

  function recordRound(win, pf, pa) {
    const pairs = save.fixtures[save.round] || [];
    pairs.forEach(function (pair) {
      const a = clubById(pair[0]);
      const b = clubById(pair[1]);
      if (!a || !b) return;
      if (a.you || b.you) {
        const you = a.you ? a : b;
        const them = a.you ? b : a;
        if (win) {
          you.w++; you.pts += 3; you.pf += pf; you.pa += pa;
          them.l++; them.pf += pa; them.pa += pf;
        } else {
          them.w++; them.pts += 3; them.pf += pa; them.pa += pf;
          you.l++; you.pf += pf; you.pa += pa;
        }
      } else {
        const rng = takeRng();
        const p = Math.max(0.22, Math.min(0.78, 0.5 + (a.str - b.str) * 0.3));
        const awin = rng() < p;
        const gf = 1 + Math.floor(rng() * 3);
        const ga = Math.floor(rng() * gf);
        if (awin) { a.w++; a.pts += 3; a.pf += gf; a.pa += ga; b.l++; b.pf += ga; b.pa += gf; }
        else { b.w++; b.pts += 3; b.pf += ga; b.pa += gf; a.l++; a.pf += gf; a.pa += ga; }
      }
    });
    save.round += 1;
  }

  IL.screenApi = { showTitle: showTitle };
  if (IL.fx && IL.fx.load) IL.fx.load();
  showTitle();
})(typeof window !== "undefined" ? window : globalThis);
