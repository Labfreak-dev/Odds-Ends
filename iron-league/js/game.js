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
  let hubTab = "club";
  let detailId = null;
  let settingsOpen = false;
  let pendingSpec = null;
  let paused = false;
  let gearPreview = null;
  let tonicPick = null;
  let tomePick = null;
  let loadoutSlot = 0;
  let creditsOpen = false;
  let armorySlot = "all";
  let armoryRarity = "all";
  let armorySort = "rarity";
  let fighterFilter = "all";
  let marketPane = "fighters";
  const HUB_TABS = ["club", "fighters", "market", "cup", "relics"];

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
    const bump = IL.rivalBump ? IL.rivalBump(save.season) : 0;
    rivals.forEach(function (name, i) {
      const fighters = [0, 1, 2].map(function () {
        const fighter = IL.themedFighter ? IL.themedFighter(rng, name) : IL.randomFighter(rng);
        fighter.level = 1 + bump;
        fighter.xp = bump * 40;
        if (IL.dressRival) IL.dressRival(fighter, rng);
        return fighter;
      });
      const str = fighters.reduce(function (s, f) {
        return s + (f.cls === "tank" ? 1.12 : f.cls === "mage" ? 1.06 : 1);
      }, 0) / 3;
      clubs.push({ id: "c" + i, name: name, you: false, w: 0, l: 0, pts: 0, pf: 0, pa: 0, str: str, fighters: fighters });
    });
    save.clubs = clubs;
    save.round = 0;
    save.fixtures = roundRobin(clubs.map(function (c) { return c.id; }));
    if (!keepGold) save.gold = IL.START_GOLD;
    if (IL.rollGearStock) save.gearStock = IL.rollGearStock(rng);
    save.trainsLeft = IL.TRAIN_CAP || 2;
    save.trainRound = 0;
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
    if (!on) return false;
    if (!Array.isArray(save.lineup)) save.lineup = [];
    const at = save.lineup.indexOf(id);
    if (at >= 0) save.lineup.splice(at, 1);
    else if (save.lineup.length < IL.PARTY_CAP) save.lineup.push(id);
    else return false;
    persist();
    refreshHub();
    return true;
  }

  function coinIcon(kind) {
    const frame = IL.CURRENCY_ICON && IL.CURRENCY_ICON[kind];
    const extra = frame ? ' data-frame="' + esc(frame) + '" data-icon-size="24"' : "";
    return '<i class="ico ico-' + kind + ' item-icon"' + extra + ' aria-hidden="true"></i>';
  }

  const CREST_FILES = [
    "crest_01_emblem41.png", "crest_02_emblem16.png", "crest_03_emblem05.png", "crest_04_emblem22.png",
    "crest_05_emblem42.png", "crest_06_emblem01.png", "crest_07_emblem12.png", "crest_08_emblem17.png",
    "crest_09_emblem20.png", "crest_10_emblem25.png", "crest_11_emblem31.png", "crest_12_emblem37.png",
    "crest_13_emblem44.png", "crest_14_emblem46.png", "crest_15_emblem49.png", "crest_16_emblem03.png"
  ];
  const CREST_TINTS = [
    "#e08a3a", "#c0392b", "#d4af37", "#3a7bd5", "#2e8b57", "#8e44ad", "#e6e6e6", "#16a085",
    "#b5651d", "#f1c40f", "#5d6d7e", "#ff6f61", "#6b8e23", "#1f3a93", "#a93226", "#95a5a6"
  ];
  const CLASS_GLYPH = {
    warrior: "sword", archer: "bow", mage: "wizards_cap", tank: "shield", rogue: "preparing_for_an_attack",
    lancer: "sword", berserker: "swords", healer: "healing_magic", assassin: "skull_demon", ranger: "bow",
    battlemage: "battle_magic", shieldbearer: "shield", skirmisher: "preparing_for_an_attack",
    duelist: "swords", elementalist: "battle_magic",
    monk: "preparing_for_an_attack", necromancer: "skull_demon", paladin: "shield",
    druid: "healing_magic", bard: "healing_magic", gunslinger: "bow", warlock: "wizards_cap",
    samurai: "swords", spearmaiden: "sword", summoner: "battle_magic", alchemist: "battle_magic",
    beastmaster: "swords"
  };
  const NAV_GLYPH = { club: "shield", fighters: "swords", market: "cargo_bag", cup: "chest", relics: "necklace" };
  const STAT_GLYPH = { HP: "drop_water_or_blood", ATK: "sword", DEF: "armor_1_body", SPD: "shoes" };

  function crestIndexOf(name) {
    return (IL.hashStr(name || "iron") % 16) + 1;
  }

  function crestHtml(name, size, index) {
    let n = index | 0;
    if (n < 1 || n > 16) n = crestIndexOf(name);
    const file = CREST_FILES[n - 1];
    const tint = CREST_TINTS[n - 1];
    const folder = size === "lg" ? "emblems_white_128" : "emblems_white_64";
    return '<span class="crest-mark crest-' + size + '" style="--club:' + tint + '">' +
      '<span class="crest-plate"></span>' +
      '<span class="crest-frame"></span>' +
      '<img class="crest-emblem" alt="" src="assets/ui/crests/' + folder + '/' + file + '">' +
    '</span>';
  }

  function clubCrest(club) {
    if (club && club.you) return save && save.crest;
    return crestIndexOf(club && club.name);
  }

  function uiGlyph(file, extra) {
    return '<img class="ui-glyph' + (extra ? " " + extra : "") + '" alt="" src="assets/ui/glyphs/orange_32/' + file + '.png">';
  }

  function classBadge(cls) {
    return uiGlyph(CLASS_GLYPH[cls] || "sword", "class-badge");
  }

  function portraitWrap(canvasAttrs, round, fighter) {
    let attrs = canvasAttrs;
    if (fighter && fighter.cls) {
      const kind = IL.weaponKind ? IL.weaponKind(fighter) : "";
      attrs += ' data-cls="' + esc(fighter.cls) + '" data-kind="' + esc(kind) + '"';
    }
    return '<span class="portrait-frame' + (round ? " round" : "") + '"><canvas ' + attrs + '></canvas></span>';
  }

  function purseHtml() {
    const eq = IL.equippedRelics(save);
    const tokens = save.tokens || 0;
    return '<div class="purse">' +
      '<span class="coin">' + coinIcon("gold") + '<b>' + save.gold + '</b> gold</span>' +
      '<span class="coin">' + coinIcon("renown") + '<b>' + (save.renown || 0) + '</b> renown</span>' +
      '<span class="coin">' + coinIcon("token") + '<b>' + tokens + '</b> cup ' + (tokens === 1 ? "token" : "tokens") + '</span>' +
      '<span class="coin"><i class="ico ico-roster" aria-hidden="true"></i><b>' + (save.roster || []).length + "/" + IL.ROSTER_CAP + '</b> roster</span>' +
      '<span class="coin"><i class="ico ico-relic" aria-hidden="true"></i><b>' + eq.length + "/2</b> relics" + (eq.length ? " · " + esc(eq.map(function (r) { return r.name; }).join(", ")) : "") + '</span>' +
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
    hubBed();
    const cont = save
      ? '<button type="button" class="btn ghost" id="continue">Continue — ' + esc(save.clubName) + '</button>'
      : '<button type="button" class="btn ghost" id="continue" disabled>Continue</button>';
    app.innerHTML =
      '<main class="title-screen">' +
        '<p class="eyebrow">Mercenary pit</p>' +
        '<h1>Iron League</h1>' +
        '<p class="lede">Raise a club. Send them into the sand. A season, a cup, then the board is read aloud.</p>' +
        '<div class="title-actions">' +
          '<button type="button" class="btn gold" id="newClub">New club</button>' +
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
    hubBed();
    const rng = IL.mulberry32((Date.now() ^ (Math.floor(Math.random() * 1e9))) >>> 0);
    const renownNow = mode === "captain" ? 0 : ((save && save.renown) || 0);
    const openIds = IL.unlockedIds(renownNow);
    const cls = mode === "captain" ? "warrior" : IL.pick(rng, openIds.length ? openIds : Object.keys(IL.CLASSES));
    draft = {
      mode: mode,
      clubName: save && save.clubName ? save.clubName : "",
      crest: (save && save.crest) || 1,
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
      return '<button type="button" class="class-card' + (open ? "" : " locked") + '" data-class="' + id + '"' + (open ? "" : " disabled") + '>' + classBadge(id) + '<strong>' + esc(c.name) + '</strong><span>' + esc(note) + '</span></button>';
    }).join("");
    const crestPick = mode === "captain"
      ? '<div class="field"><span>Crest</span><div class="crest-pick" id="crestPick">' +
        CREST_FILES.map(function (_, i) {
          return '<button type="button" data-crest="' + (i + 1) + '" aria-label="Crest ' + (i + 1) + '">' + crestHtml("", "sm", i + 1) + '</button>';
        }).join("") + '</div></div>'
      : "";
    const clubField = mode === "captain"
      ? '<label class="field"><span>Club name</span><input id="clubName" maxlength="24" autocomplete="off" placeholder="Ashveil Company" value="' + esc(draft.clubName) + '"></label>' + crestPick
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
              '<button type="button" class="btn ' + (mode === "captain" ? "gold" : "primary") + '" id="confirm">' + confirmLabel + '</button>' +
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
      if (t.dataset.crest) {
        draft.crest = +t.dataset.crest;
        syncPicker();
      } else if (t.dataset.sheet) {
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
    const crests = app.querySelectorAll("[data-crest]");
    for (let i = 0; i < crests.length; i++) {
      const on = +crests[i].dataset.crest === (draft.crest || 1);
      crests[i].classList.toggle("on", on);
      crests[i].setAttribute("aria-pressed", on ? "true" : "false");
    }
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
        IL.hero.draw(ctx, atlas, 1, 24, 52, 1, 1, draft.fighter.cls, null, IL.weaponKind ? IL.weaponKind(draft.fighter) : "");
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
        const kind = IL.weaponKind ? IL.weaponKind(draft.fighter) : "";
        IL.hero.draw(ctx, atlas, IL.frameIndex(idleClip, t), 180, 214, 4, 1, kit.id, null, kind);
        IL.hero.draw(ctx, atlas, IL.frameIndex(strike, t % Math.max(0.05, IL.clipDur(strike))), 460, 214, 4, 1, kit.id, null, kind);
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
      if (IL.ensureMoves) IL.ensureMoves(captain);
      captain.gear = IL.blankGear();
      captain.gear.armor = IL.makeItem(rng, { key: "mail", rarity: "common" });
      const recruits = ["archer", "mage", "tank"].map(function (cls) {
        const f = IL.randomFighter(rng, cls);
        return f;
      });
      save = Object.assign({
        v: 1,
        clubName: clubName,
        crest: draft.crest || 1,
        gold: IL.START_GOLD,
        season: 1,
        rngSeed: seed,
        roster: [captain].concat(recruits)
      }, IL.freshClubFields(seed));
      buildSeason(false);
      save.market = IL.rollMarket(takeRng(), 0);
      save.items = [IL.makeItem(takeRng(), { key: "cloak", rarity: "common" })];
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
      pitSound("error");
      if (err) err.textContent = "Not enough gold.";
      return;
    }
    if (save.roster.length >= IL.ROSTER_CAP) {
      btn.disabled = false;
      pitSound("error");
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
      pitSound("purchase");
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

  function pendingMoveFighters() {
    return (save.roster || []).filter(function (f) { return (f.pendingMoves || 0) > 0; });
  }

  function ensureMarket() {
    IL.migrate(save);
    if (!save.market || !save.market.length) {
      save.market = IL.rollMarket(takeRng(), save.renown || 0);
      persist();
    }
    const week = IL.weekIndex(Date.now());
    if (!save.deals || save.deals.week !== week) {
      save.deals = IL.rollDeals(takeRng(), save.renown || 0, week);
      persist();
    }
    if (!save.relicStock || !save.relicStock.length) {
      save.relicStock = IL.rollRelicStock(takeRng());
      persist();
    }
  }

  const ABILITY_COPY = {
    cleave: "A wide swing that catches everyone in front.",
    multishot: "Three shots loosed in one breath.",
    frost: "A ring of cold that slows whoever it reaches.",
    fireball: "A bolt that bursts on the first body it meets.",
    taunt: "Nearby rivals turn their attention this way.",
    shadowstep: "A blink behind the target, then a sharper cut.",
    charge: "A rush that carries through the gap.",
    rage: "Hits land harder for a few seconds while health is low.",
    mend: "Restores health to the most wounded ally in reach.",
    pierce: "A shot that punches through the first body.",
    arc: "A short burst of force at close range.",
    zone: "Plants a guard and clips anyone standing in it.",
    skirmish: "A dash in, a shot, and back out.",
    lunge: "A long step into one heavy cut.",
    nova: "A tight ring of cold around the caster.",
    bolt: "A fast bolt at the nearest rival.",
    footing: "Harder to shove off the line.",
    aim: "Shots hold their line a little farther.",
    focus: "Casts come out cleaner.",
    guard: "A raised guard blunts the next hit.",
    bleed: "Cuts keep hurting after the swing.",
    reach: "The charge starts from farther out.",
    fury: "Damage climbs as health falls.",
    triage: "The mend prefers the most wounded ally.",
    trail: "A marked target takes the next shot harder.",
    ward: "A thin shield follows a close burst.",
    wall: "The planted guard holds a little longer.",
    feint: "The shot after a dash is harder to read.",
    riposte: "A hit taken is answered at once.",
    cycle: "The next cast follows sooner."
  };

  function abilityBlurb(id) {
    return ABILITY_COPY[id] || "A trick of this kit.";
  }

  function cdText(ab) {
    if (!ab || !ab.cd) return "With each cast";
    const n = Math.round(ab.cd * 10) / 10;
    return n + "s";
  }

  function fighterById(id) {
    return (save.roster || []).filter(function (f) { return f.id === id; })[0] || null;
  }

  function emptyState(title, fine) {
    return '<div class="empty-state"><p>' + esc(title) + '</p>' +
      (fine ? '<p class="fine">' + esc(fine) + '</p>' : '') + '</div>';
  }

  function statBar(label, value, cap) {
    const shown = Math.round(value);
    const pct = Math.max(6, Math.min(100, Math.round(100 * shown / Math.max(1, cap))));
    const glyph = STAT_GLYPH[label] ? uiGlyph(STAT_GLYPH[label]) : "";
    return '<div class="stat"><span class="stat-label">' + glyph + label + '</span><b>' + shown + '</b><div class="track"><div class="fill" style="width:' + pct + '%"></div></div></div>';
  }

  function moveMeta(ab, level, learned) {
    const learnedMove = learned && learned.indexOf(ab.id) >= 0;
    const unlock = ab.unlock || 1;
    const locked = !learnedMove && unlock > (level || 1) && unlock <= 7;
    const tags = (ab.tags || []).join(" · ");
    const row = ab.row ? ab.row.charAt(0).toUpperCase() + ab.row.slice(1) : "";
    const when = locked ? ("Level " + unlock) : cdText(ab);
    return { locked: locked, line: [when, row, tags].filter(Boolean).join(" · "), tags: ab.tags || [], row: row };
  }

  function abilityItem(ab, level, learned) {
    const frame = IL.abilityIcon ? IL.abilityIcon(ab.id) : "";
    const icon = frame ? iconTag(frame, 32) : "";
    const meta = moveMeta(ab, level, learned);
    const blurb = ab.blurb || abilityBlurb(ab.id);
    const tags = meta.tags.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join("");
    return '<li' + (meta.locked ? ' class="locked"' : '') + '>' + icon + '<strong>' + esc(ab.name) + '</strong><span>' + esc(meta.line) + '</span><p>' + tags + (meta.row ? ' <span class="row-name">' + esc(meta.row) + '</span>' : '') + '</p><p>' + esc(blurb) + '</p></li>';
  }

  function synergyLine(fighters, id) {
    if (!IL.traitSummary) return "";
    const rows = IL.traitSummary(fighters);
    if (!rows.length) return "";
    const bits = rows.map(function (row) {
      return '<span class="trait' + (row.active ? " on" : "") + '">' + esc(row.name) + " " + row.count + "/" + row.need +
        (row.active ? " · " + esc(row.blurb) : "") + "</span>";
    }).join("");
    return '<p class="synergy" id="' + id + '">' + bits + "</p>";
  }

  function syncMix() {
    if (!IL.sfx || !IL.sfx.setMix) return;
    const s = (save && save.settings) || {};
    IL.sfx.setMix({
      music: (typeof s.music === "number" ? s.music : 60) / 100,
      sfx: (typeof s.sound === "number" ? s.sound : 80) / 100,
      crowd: (typeof s.crowd === "number" ? s.crowd : 70) / 100
    });
  }

  function pitSound(kind) {
    if (!IL.sfx) return;
    syncMix();
    if (IL.sfx.unlock) IL.sfx.unlock();
    IL.sfx.play(kind);
  }

  function hubBed() {
    syncMix();
    if (!IL.sfx || !IL.sfx.bed) return;
    IL.sfx.bed("hub");
    if (IL.sfx.crowdBed) IL.sfx.crowdBed(false);
  }

  function fightBed(spec) {
    if (spec.mode === "chaos") return "endless";
    const people = [];
    (spec.left || []).forEach(function (f) { people.push(f); });
    (spec.right || []).forEach(function (f) { people.push(f); });
    if (spec.sides) spec.sides.forEach(function (s) { (s.fighters || []).forEach(function (f) { people.push(f); }); });
    for (let i = 0; i < people.length; i++) if (people[i] && people[i].champion) return "boss";
    if (spec.mode === "cup" && save.cup && (save.cup.round || 0) >= 1) return "boss";
    return "fight";
  }

  function matchSize() {
    return save && save.round < 5 ? IL.SEASON_SIZES[save.round] : 0;
  }

  function inThePit(f) {
    if (!f) return false;
    const size = matchSize();
    const slot = (save.lineup || []).indexOf(f.id);
    if (slot < 0) return false;
    if (!size) return false;
    return slot < size;
  }

  function trainControl(f, sheet) {
    const cost = IL.TRAIN_COST || 16;
    const left = save.trainsLeft || 0;
    const pit = inThePit(f);
    const broke = save.gold < cost;
    const spent = left <= 0;
    const why = pit ? "In the pit today" : (spent ? "Drills spent" : (broke ? "Need " + cost + " gold" : "Train — " + cost + " gold"));
    const off = pit || spent || broke ? " disabled" : "";
    if (sheet) {
      return '<button type="button" class="btn ghost" id="trainBtn"' + off + '>' + esc(why) + '</button>' +
        '<p class="fine">Drills left today: ' + left + '. Bench only. ' + (IL.TRAIN_XP || 12) + ' xp.</p>';
    }
    return '<button type="button" class="chip train" data-train="' + esc(f.id) + '"' + off + ' title="' + esc(why) + '">Train</button>';
  }

  function lineupControl(f, size) {
    const slot = (save.lineup || []).indexOf(f.id);
    const fighting = slot >= 0 && (!size || slot < size);
    const held = slot >= 0 && size > 0 && slot >= size;
    const partyFull = (save.lineup || []).length >= IL.PARTY_CAP;
    let lineLabel = "Add";
    let lineClass = "chip lineup";
    if (fighting && size) {
      lineLabel = "Pit " + (slot + 1);
      lineClass += " on";
    } else if (held) {
      lineLabel = "Held " + (slot + 1);
      lineClass += " held";
    } else if (slot >= 0) {
      lineLabel = "Party " + (slot + 1);
      lineClass += " on";
    } else if (partyFull) lineLabel = "Full";
    const lineOff = slot < 0 && partyFull ? " disabled" : "";
    return '<button type="button" class="' + lineClass + '" data-line="' + esc(f.id) + '" aria-pressed="' + (slot >= 0 ? "true" : "false") + '"' + lineOff + '>' + esc(lineLabel) + '</button>';
  }

  function glyphSvg(glyph) {
    const paths = {
      sword: '<path d="M8 28 L20 8 M14 14 L22 22 M6 26 L10 30" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square"/>',
      wand: '<path d="M10 26 L22 8 M18 8 H26 M22 4 V12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square"/>',
      bow: '<path d="M10 6 Q4 16 10 26 M10 10 H22 M10 22 H20 M18 6 L24 16 L18 26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square"/>',
      shield: '<path d="M16 4 L26 8 V16 C26 22 16 28 16 28 C16 28 6 22 6 16 V8 Z" fill="none" stroke="currentColor" stroke-width="2"/>',
      cloak: '<path d="M8 8 H24 L22 26 L16 22 L10 26 Z" fill="none" stroke="currentColor" stroke-width="2"/>',
      ring: '<circle cx="16" cy="16" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 6 V10 M16 22 V26" stroke="currentColor" stroke-width="2"/>',
      gem: '<path d="M16 4 L26 12 L16 28 L6 12 Z" fill="none" stroke="currentColor" stroke-width="2"/>'
    };
    return '<svg viewBox="0 0 32 32" aria-hidden="true">' + (paths[glyph] || paths.gem) + '</svg>';
  }

  function glyphHtml(glyph, rarity) {
    return '<span class="glyph rarity-' + esc(rarity || "common") + '">' + glyphSvg(glyph) + '</span>';
  }

  /* Atlas frame when it loaded. The glyph stays until then, and if the frame is missing. */
  function itemFaceHtml(item) {
    const rarity = (item && item.rarity) || "common";
    const icon = IL.itemIcon ? IL.itemIcon(item) : "";
    const glyph = IL.itemGlyph(item);
    if (!icon) return glyphHtml(glyph, rarity);
    return '<span class="glyph rarity-' + esc(rarity) + '">' +
      '<i class="item-icon" data-frame="' + esc(icon) + '" data-icon-size="48" hidden></i>' +
      glyphSvg(glyph) +
    '</span>';
  }

  function iconTag(frame, size) {
    if (!frame) return "";
    if (String(frame).indexOf("/") >= 0) {
      return '<img class="pixel-icon" src="' + esc(frame) + '" width="' + size + '" height="' + size + '" alt="">';
    }
    return '<i class="item-icon" data-frame="' + esc(frame) + '" data-icon-size="' + size + '" hidden></i>';
  }

  const iconAtlas = { ready: false, failed: false, frames: {}, w: 0, h: 0, url: "assets/icons/atlas.png" };

  function placeFrame(el) {
    if (!iconAtlas.ready || !el || !el.getAttribute) return;
    const frame = iconAtlas.frames[el.getAttribute("data-frame")];
    const size = Number(el.getAttribute("data-icon-size") || 48);
    if (!frame || !frame.w) return;
    const scale = size / frame.w;
    el.style.backgroundImage = "url(\"" + iconAtlas.url + "\")";
    el.style.backgroundRepeat = "no-repeat";
    el.style.backgroundPosition = (-frame.x * scale) + "px " + (-frame.y * scale) + "px";
    el.style.backgroundSize = (iconAtlas.w * scale) + "px " + (iconAtlas.h * scale) + "px";
    el.style.width = size + "px";
    el.style.height = size + "px";
    el.hidden = false;
    const svg = el.parentNode && el.parentNode.querySelector("svg");
    if (svg && el.parentNode.classList.contains("glyph")) svg.style.display = "none";
  }

  function mountIcons(scope) {
    const root = scope && scope.querySelectorAll ? scope : document;
    const nodes = root.querySelectorAll("[data-frame]");
    for (let i = 0; i < nodes.length; i++) placeFrame(nodes[i]);
  }

  function loadIconAtlas() {
    const img = new Image();
    const dataP = fetch("assets/icons/atlas.json").then(function (r) { if (!r.ok) throw new Error("atlas"); return r.json(); });
    const imgP = new Promise(function (resolve, reject) {
      img.onload = function () { resolve(img); };
      img.onerror = reject;
      img.src = "assets/icons/atlas.png";
    });
    Promise.all([dataP, imgP]).then(function (pair) {
      iconAtlas.ready = true;
      iconAtlas.frames = pair[0].frames || {};
      iconAtlas.w = pair[0].w || img.width;
      iconAtlas.h = pair[0].h || img.height;
      iconAtlas.url = pair[0].image || "assets/icons/atlas.png";
      IL.iconsReady = true;
      mountIcons(document);
    }).catch(function () { iconAtlas.failed = true; });
  }

  function bonusLine(item) {
    const b = IL.itemBonus(item);
    const bits = [];
    if (b.hp) bits.push("+" + b.hp + " HP");
    if (b.atk) bits.push("+" + b.atk + " ATK");
    if (b.def) bits.push("+" + b.def + " DEF");
    if (b.spd) bits.push("+" + b.spd + " SPD");
    const passive = IL.passiveOf(item);
    if (passive) bits.push(IL.itemBlurb(item));
    if (IL.itemSlot(item) === "tome") {
      const ab = item.teach && IL.abilityById ? IL.abilityById(item.teach) : null;
      return ab ? ("Teaches " + ab.name + ". Study it on a fighter of that kit.") : "Teaches a move from one kit.";
    }
    if (!bits.length && IL.itemSlot(item) === "tonic") return "One match. A little shield, then the bottle is empty.";
    return bits.join(" · ") || "No bonus";
  }

  function rarityLabel(rarity) {
    if (rarity === "uncommon") return "Uncommon";
    if (rarity === "rare") return "Rare";
    if (rarity === "epic") return "Epic";
    if (rarity === "legendary") return "Legendary";
    return "Common";
  }

  function slotLabel(slot) {
    if (slot === "weapon") return "Weapon";
    if (slot === "armor") return "Armor";
    if (slot === "tonic") return "Tonic";
    if (slot === "tome") return "Tome";
    return "Trinket";
  }

  function allGear() {
    const rows = [];
    (save.items || []).forEach(function (item) {
      if (item) rows.push({ item: item, owner: null, slot: IL.itemSlot(item) });
    });
    (save.roster || []).forEach(function (f) {
      const gear = f.gear || {};
      ["weapon", "armor", "trinket"].forEach(function (slot) {
        if (gear[slot]) rows.push({ item: gear[slot], owner: f, slot: slot });
      });
      if (f.tonic) rows.push({ item: f.tonic, owner: f, slot: "tonic" });
    });
    return rows;
  }

  function filteredGear() {
    const rows = allGear().filter(function (row) {
      if (armorySlot !== "all" && row.slot !== armorySlot) return false;
      if (armoryRarity !== "all" && row.item.rarity !== armoryRarity) return false;
      return true;
    });
    rows.sort(function (a, b) {
      if (armorySort === "name") return IL.itemName(a.item).localeCompare(IL.itemName(b.item));
      if (armorySort === "slot") return a.slot.localeCompare(b.slot) || IL.itemName(a.item).localeCompare(IL.itemName(b.item));
      return (IL.rarityRank(b.item.rarity) - IL.rarityRank(a.item.rarity)) || IL.itemName(a.item).localeCompare(IL.itemName(b.item));
    });
    return rows;
  }

  function armoryCard(row) {
    const item = row.item;
    const where = row.owner ? ("On " + row.owner.name) : "In the bag";
    const drink = row.slot === "tonic";
    const tome = row.slot === "tome";
    const actions = row.owner
      ? '<button type="button" class="btn ghost" data-unequip-from="' + esc(row.owner.id) + '" data-unequip-slot="' + esc(row.slot) + '">' + (drink ? "Pour back" : "Unequip") + '</button>'
      : (drink
        ? '<button type="button" class="btn ghost" data-arm-tonic="' + esc(item.uid) + '">Give</button>'
        : tome
          ? '<button type="button" class="btn ghost" data-arm-tome="' + esc(item.uid) + '">Study</button>'
          : '<button type="button" class="btn ghost" data-arm-equip="' + esc(item.uid) + '">Equip</button>') +
        '<button type="button" class="btn ghost" data-salvage="' + esc(item.uid) + '">Salvage — ' + IL.salvageValue(item) + ' gold</button>';
    const pickingGear = !row.owner && !drink && !tome && gearPreview && gearPreview.uid === item.uid;
    const pickingTonic = !row.owner && drink && tonicPick && tonicPick.uid === item.uid;
    const pickingTome = !row.owner && tome && tomePick && tomePick.uid === item.uid;
    const pick = (pickingGear || pickingTonic || pickingTome)
      ? '<div class="armory-pick">' + (save.roster || []).map(function (f) {
        if (pickingTonic) return '<button type="button" class="btn ghost" data-give-on="' + esc(f.id) + '" data-give-item="' + esc(item.uid) + '">' + esc(f.name) + '</button>';
        if (pickingTome) return '<button type="button" class="btn ghost" data-study-on="' + esc(f.id) + '" data-study-item="' + esc(item.uid) + '">' + esc(f.name) + '</button>';
        return '<button type="button" class="btn ghost" data-arm-on="' + esc(f.id) + '" data-arm-item="' + esc(item.uid) + '">' + esc(f.name) + '</button>';
      }).join("") + '</div>'
      : "";
    return '<article class="gear-card rarity-' + esc(item.rarity) + '">' +
      itemFaceHtml(item) +
      '<h3>' + esc(IL.itemName(item)) + '</h3>' +
      '<p>' + esc(rarityLabel(item.rarity)) + " · " + esc(slotLabel(row.slot)) + '</p>' +
      '<p class="fine">' + esc(bonusLine(item)) + '</p>' +
      '<p class="fine">' + esc(where) + '</p>' +
      actions + pick +
    '</article>';
  }

  function armoryHtml() {
    const rows = filteredGear();
    const slotOpts = [["all", "All slots"], ["weapon", "Weapon"], ["armor", "Armor"], ["trinket", "Trinket"], ["tonic", "Tonic"], ["tome", "Tome"]];
    const rareOpts = [["all", "All rarities"], ["common", "Common"], ["rare", "Rare"], ["epic", "Epic"], ["legendary", "Legendary"]];
    const sortOpts = [["rarity", "Rarity"], ["slot", "Slot"], ["name", "Name"]];
    function opts(list, current) {
      return list.map(function (pair) {
        return '<option value="' + pair[0] + '"' + (pair[0] === current ? " selected" : "") + '>' + pair[1] + '</option>';
      }).join("");
    }
    return '<section class="panel-frame" id="armory">' +
      '<header class="panel-head"><p class="eyebrow">Armory</p><h3>Gear</h3></header>' +
      '<div class="armory-tools">' +
        '<label>Slot <select id="filterSlot">' + opts(slotOpts, armorySlot) + '</select></label>' +
        '<label>Rarity <select id="filterRarity">' + opts(rareOpts, armoryRarity) + '</select></label>' +
        '<label>Sort <select id="sortGear">' + opts(sortOpts, armorySort) + '</select></label>' +
      '</div>' +
      '<div class="armory-grid">' + (rows.map(armoryCard).join("") || emptyState("The armory is empty.", "Matches, the cup, and the stall fill it.")) + '</div>' +
    '</section>';
  }

  function findItem(uid) {
    let found = null;
    (save.items || []).some(function (item) {
      if (item && item.uid === uid) { found = { item: item, owner: null }; return true; }
      return false;
    });
    if (found) return found;
    (save.roster || []).some(function (f) {
      const gear = f.gear || {};
      return ["weapon", "armor", "trinket"].some(function (slot) {
        if (gear[slot] && gear[slot].uid === uid) { found = { item: gear[slot], owner: f, slot: slot }; return true; }
        return false;
      });
    });
    return found;
  }

  function takeFromOwner(found) {
    if (!found || !found.owner) return found && found.item;
    found.owner.gear[found.slot] = null;
    return found.item;
  }

  function equipItem(fighter, item) {
    if (!fighter || !item) return false;
    if (IL.itemSlot(item) === "tonic" || IL.itemSlot(item) === "tome") return false;
    if (!fighter.gear) fighter.gear = IL.blankGear();
    const slot = IL.itemSlot(item);
    const found = findItem(item.uid);
    if (!found) return false;
    takeFromOwner(found);
    save.items = (save.items || []).filter(function (it) { return it.uid !== item.uid; });
    const previous = fighter.gear[slot];
    if (previous && previous.uid !== item.uid) save.items.push(previous);
    fighter.gear[slot] = item;
    return true;
  }

  function unequipSlot(fighter, slot) {
    if (slot === "tonic") return dropTonic(fighter);
    if (!fighter || !fighter.gear || !fighter.gear[slot]) return false;
    if (!Array.isArray(save.items)) save.items = [];
    save.items.push(fighter.gear[slot]);
    fighter.gear[slot] = null;
    return true;
  }

  function giveTonic(fighter, item) {
    if (!fighter || !item || IL.itemSlot(item) !== "tonic") return false;
    const found = findItem(item.uid);
    if (!found || found.owner) return false;
    if (!Array.isArray(save.items)) save.items = [];
    if (fighter.tonic && fighter.tonic.uid !== item.uid) save.items.push(fighter.tonic);
    save.items = save.items.filter(function (it) { return it.uid !== item.uid; });
    fighter.tonic = item;
    tonicPick = null;
    save.tonicsUsed = (save.tonicsUsed || 0) + 1;
    return true;
  }

  function studyTome(fighter, item) {
    if (!fighter || !item || IL.itemSlot(item) !== "tome") return false;
    if (!IL.teachMove || !IL.teachMove(fighter, item.teach)) return false;
    save.items = (save.items || []).filter(function (it) { return it.uid !== item.uid; });
    tomePick = null;
    return true;
  }

  function dropTonic(fighter) {
    if (!fighter || !fighter.tonic) return false;
    if (!Array.isArray(save.items)) save.items = [];
    save.items.push(fighter.tonic);
    fighter.tonic = null;
    return true;
  }

  function returnGear(fighter) {
    if (!fighter) return;
    if (fighter.gear) ["weapon", "armor", "trinket"].forEach(function (slot) { unequipSlot(fighter, slot); });
    dropTonic(fighter);
  }

  function diffHtml(f, item) {
    const kit = IL.CLASSES[f.cls] || IL.CLASSES.warrior;
    const now = IL.scaledStats(f, kit);
    const slot = IL.itemSlot(item);
    const gear = {
      weapon: f.gear && f.gear.weapon,
      armor: f.gear && f.gear.armor,
      trinket: f.gear && f.gear.trinket
    };
    gear[slot] = item;
    const next = IL.scaledStats(Object.assign({}, f, { gear: gear }), kit);
    const rows = [
      ["HP", now.hp, next.hp],
      ["ATK", now.atk, next.atk],
      ["DEF", now.def, next.def],
      ["SPD", now.speed, next.speed]
    ].map(function (row) {
      const d = Math.round(row[2]) - Math.round(row[1]);
      if (!d) return "<li>" + row[0] + " " + Math.round(row[1]) + "</li>";
      const cls = d > 0 ? "diff-up" : "diff-down";
      return '<li class="' + cls + '">' + row[0] + " " + Math.round(row[1]) + " <b>" + (d > 0 ? "+" : "") + d + "</b></li>";
    }).join("");
    return '<div id="equipDiff"><p class="eyebrow">If you equip ' + esc(IL.itemName(item)) + '</p><ul class="diff">' + rows + '</ul>' +
      '<p class="fine">' + esc(bonusLine(item)) + '</p>' +
      '<button type="button" class="btn primary" id="confirmEquip">Equip</button>' +
      '<button type="button" class="btn ghost" id="cancelEquip">Cancel</button></div>';
  }

  function fighterCard(f, size, onBench) {
    const slot = (save.lineup || []).indexOf(f.id);
    const fighting = slot >= 0 && (!size || slot < size);
    const kit = IL.CLASSES[f.cls] || IL.CLASSES.warrior;
    const stats = IL.scaledStats(f, kit);
    const anim = kit.idle || "idle";
    const champ = f.champion ? " <em>Champion</em>" : "";
    const cap = f.captain ? " <em>Captain</em>" : "";
    return '<article class="card roster-row' + (fighting ? " playing" : " bench") + '" data-role="' + esc(kit.role) + '">' +
      '<button type="button" class="portrait" data-detail="' + esc(f.id) + '" aria-label="Open ' + esc(f.name) + '">' +
        portraitWrap('width="72" height="64" data-key="' + esc(IL.hero.keyOf(f.parts)) + '" data-anim="' + anim + '" data-scale="2" data-foot="6"', f.captain, f) +
      '</button>' +
      '<div class="row-main">' +
        '<h3>' + esc(f.name) + cap + champ + '</h3>' +
        '<p class="kit-line">' + classBadge(f.cls) + '<span>' + esc(kit.name) + " · Lv " + f.level + '</span></p>' +
        '<p class="fine">HP ' + Math.round(stats.hp) + " · ATK " + Math.round(stats.atk) + '</p>' +
      '</div>' +
      '<div class="row-actions">' +
        lineupControl(f, size) +
        (onBench ? trainControl(f, false) : "") +
      '</div>' +
    '</article>';
  }

  function rosterColumns(size) {
    const slotOf = {};
    (save.lineup || []).forEach(function (id, i) { slotOf[id] = i; });
    const ordered = save.roster.slice().sort(function (a, b) {
      const sa = Object.prototype.hasOwnProperty.call(slotOf, a.id) ? slotOf[a.id] : 99;
      const sb = Object.prototype.hasOwnProperty.call(slotOf, b.id) ? slotOf[b.id] : 99;
      return sa - sb;
    });
    const pit = [];
    const bench = [];
    ordered.forEach(function (f) {
      const slot = Object.prototype.hasOwnProperty.call(slotOf, f.id) ? slotOf[f.id] : -1;
      const fighting = slot >= 0 && (!size || slot < size);
      (fighting ? pit : bench).push(fighterCard(f, size, !fighting));
    });
    return { pit: pit, bench: bench };
  }

  function rosterHtml(size, pitTitle, filter) {
    const cols = rosterColumns(size);
    const showPit = filter !== "bench";
    const showBench = filter !== "party";
    let html = '<div id="yourCards">';
    if (showPit) {
      html += '<section class="roster-block"><h3 class="section">' + pitTitle + '</h3>' +
        '<div class="cards roster-grid">' + (cols.pit.join("") || emptyState("Nobody is walking in.", "Add fighters from the bench.")) + '</div></section>';
    }
    if (showBench) {
      html += '<section class="roster-block"><h3 class="section">Bench</h3>' +
        '<div class="cards roster-grid" id="benchList">' + (cols.bench.join("") || emptyState("The bench is empty.", "The whole club is in the party.")) + '</div></section>';
    }
    html += '</div>';
    return html;
  }

  function filterBar(kind, current, options) {
    return '<div class="subtabs" role="tablist">' + options.map(function (pair) {
      const on = pair[0] === current;
      return '<button type="button" class="chip' + (on ? " on" : "") + '" data-filter-kind="' + kind + '" data-filter="' + pair[0] + '" aria-pressed="' + (on ? "true" : "false") + '">' + pair[1] + '</button>';
    }).join("") + '</div>';
  }

  function tabBar(active) {
    const labels = [
      ["club", "Club", "1", "tab-club"],
      ["fighters", "Fighters", "2", "tab-fighters"],
      ["market", "Market", "3", "market"],
      ["cup", "Cup", "4", "cup"],
      ["relics", "Relics", "5", "relics"]
    ];
    return '<nav class="tabbar" id="tabbar" role="tablist" aria-label="Club sections">' +
      labels.map(function (row) {
        const on = row[0] === active;
        const glyph = NAV_GLYPH[row[0]];
        const idle = '<img class="ui-glyph glyph-idle" alt="" src="assets/ui/glyphs/orange_32/' + glyph + '.png">';
        const hot = '<img class="ui-glyph glyph-on" alt="" src="assets/ui/glyphs/white_32/' + glyph + '.png">';
        return '<button type="button" class="tab" role="tab" id="' + row[3] + '" data-tab="' + row[0] + '" aria-selected="' + (on ? "true" : "false") + '" aria-keyshortcuts="' + row[2] + '">' + idle + hot + '<b>' + row[1] + '</b><small>' + row[2] + '</small></button>';
      }).join("") +
    '</nav>';
  }

  function gearSheetHtml(f) {
    const gear = f.gear || IL.blankGear();
    const slots = ["weapon", "armor", "trinket"].map(function (slot) {
      const item = gear[slot];
      const body = item
        ? itemFaceHtml(item) +
          '<span><b>' + esc(IL.itemName(item)) + '</b><small>' + esc(rarityLabel(item.rarity)) + " · " + esc(bonusLine(item)) + '</small></span>' +
          '<button type="button" class="btn ghost" data-unequip-slot="' + slot + '">Unequip</button>'
        : glyphHtml(slot === "weapon" ? "sword" : slot === "armor" ? "shield" : "gem", "common") +
          '<span><b>Empty ' + esc(slotLabel(slot).toLowerCase()) + '</b><small>Nothing worn</small></span>';
      return '<div class="gear-slot">' + body + '</div>';
    }).join("");
    const drink = f.tonic;
    const tonic = '<h3 class="section">Tonic</h3><div class="gear-slot">' + (drink
      ? itemFaceHtml(drink) +
        '<span><b>' + esc(IL.itemName(drink)) + '</b><small>' + esc(rarityLabel(drink.rarity)) + " · " + esc(bonusLine(drink)) + '</small></span>' +
        '<button type="button" class="btn ghost" data-tonic-drop="1">Pour back</button>'
      : '<span><b>No tonic</b><small>A drink from the bag lasts one match.</small></span>') + '</div>';
    const bag = (save.items || []).map(function (item) {
      if (IL.itemSlot(item) === "tonic") {
        return '<button type="button" class="gear-offer" data-tonic="' + esc(item.uid) + '">' +
          itemFaceHtml(item) +
          '<span><b>' + esc(IL.itemName(item)) + '</b><small>Tonic · ' + esc(bonusLine(item)) + '</small></span>' +
        '</button>';
      }
      return '<button type="button" class="gear-offer" data-preview-item="' + esc(item.uid) + '">' +
        itemFaceHtml(item) +
        '<span><b>' + esc(IL.itemName(item)) + '</b><small>' + esc(rarityLabel(item.rarity)) + " · " + esc(slotLabel(IL.itemSlot(item))) + " · " + esc(bonusLine(item)) + '</small></span>' +
      '</button>';
    }).join("");
    const preview = gearPreview && findItem(gearPreview.uid);
    const diff = preview ? diffHtml(f, preview.item) : "";
    return '<h3 class="section">Gear</h3><div class="gear-slots">' + slots + '</div>' +
      tonic +
      '<h3 class="section">In the bag</h3>' +
      (bag || '<p class="fine">Nothing waiting. The armory and the stall keep the rest.</p>') +
      diff;
  }

  function gearStallHtml() {
    const rows = save.gearStock || [];
    const cards = rows.map(function (row, i) {
      const item = row.item;
      if (!item || IL.itemSlot(item) === "tome") return "";
      const broke = save.gold < row.cost;
      const afford = broke ? " cant-afford" : " buyable";
      return '<article class="gear-card rarity-' + esc(item.rarity) + afford + '">' +
        itemFaceHtml(item) +
        '<h3>' + esc(IL.itemName(item)) + '</h3>' +
        '<p>' + esc(rarityLabel(item.rarity)) + " · " + esc(slotLabel(IL.itemSlot(item))) + '</p>' +
        '<p class="fine">' + esc(bonusLine(item)) + '</p>' +
        '<button type="button" class="btn primary' + afford + '" data-buy-gear="' + i + '"' + (broke ? " disabled" : "") + '>Buy — ' + row.cost + ' gold</button>' +
      '</article>';
    }).join("");
    const cost = IL.GEAR_REROLL || 20;
    return '<section class="panel-frame" id="gearStock"><h3 class="section">Gear stall</h3>' +
      '<p class="fine">The stall turns over after each league match. A reroll spends ' + cost + ' gold.</p>' +
      '<div class="hub-actions"><button type="button" class="btn ghost' + (save.gold < cost ? " cant-afford" : " buyable") + '" id="rerollGear"' + (save.gold < cost ? " disabled" : "") + '>Reroll stall — ' + cost + ' gold</button></div>' +
      '<div class="armory-grid">' + (cards || emptyState("The stall is bare.", "Reroll it, or wait for the next match.")) + '</div></section>' +
      tomeStallHtml();
  }

  function tomeStallHtml() {
    const rows = save.gearStock || [];
    const cards = rows.map(function (row, i) {
      const item = row.item;
      if (!item || IL.itemSlot(item) !== "tome") return "";
      const broke = save.gold < row.cost;
      const afford = broke ? " cant-afford" : " buyable";
      return '<article class="gear-card rarity-' + esc(item.rarity) + afford + '">' +
        itemFaceHtml(item) +
        '<h3>' + esc(IL.itemName(item)) + '</h3>' +
        '<p>' + esc(rarityLabel(item.rarity)) + " · Tome</p>" +
        '<p class="fine">Study it on a fighter who can learn the move.</p>' +
        '<button type="button" class="btn primary' + afford + '" data-buy-gear="' + i + '"' + (broke ? " disabled" : "") + '>Buy — ' + row.cost + ' gold</button>' +
      '</article>';
    }).join("");
    return '<section class="panel-frame" id="tomeStock"><h3 class="section">Tomes</h3>' +
      '<p class="fine">One move each. The gear stall reroll turns these over too.</p>' +
      '<div class="armory-grid">' + (cards || emptyState("No tomes on the stall.", "Open Gear and reroll the stall.")) + '</div></section>';
  }

  function sheetHtml(f) {
    const kit = IL.CLASSES[f.cls] || IL.CLASSES.warrior;
    const stats = IL.scaledStats(f, kit);
    const into = (f.xp || 0) % 40;
    const xpPct = Math.round(100 * into / 40);
    if (IL.ensureMoves) IL.ensureMoves(f);
    const byAb = {};
    (kit.abilities || []).forEach(function (ab) { if (ab && ab.id) byAb[ab.id] = ab; });
    const attack = IL.attackOf ? IL.attackOf(f.cls) : { name: "Melee combo", blurb: "A chain of swings." };
    const passive = kit.passive || {};
    const passiveBlurb = passive.blurb || abilityBlurb(passive.id);
    const loadout = (f.loadout || []).map(function (id, i) {
      const ab = byAb[id];
      if (!ab) return "";
      return '<div class="loadout-slot' + (loadoutSlot === i ? " on" : "") + '" data-slot="' + i + '"><ul class="abilities">' + abilityItem(ab, f.level || 1, f.learned) + '</ul></div>';
    }).join("");
    const picks = (f.known || []).map(function (id) {
      const ab = byAb[id];
      if (!ab) return "";
      const on = (f.loadout || []).indexOf(id) >= 0;
      const meta = moveMeta(ab, f.level || 1, f.learned);
      return '<button type="button" class="chip' + (on ? " on" : "") + '" data-fill="' + esc(id) + '"><b>' + esc(ab.name) + '</b><small>' + esc(meta.line) + '</small></button>';
    }).join("");
    const unlearned = (kit.abilities || []).filter(function (ab) {
      return ab && (f.known || []).indexOf(ab.id) < 0;
    }).map(function (ab) { return abilityItem(ab, 1, []); }).join("");
    const tomes = (save.items || []).filter(function (it) { return it && IL.itemSlot(it) === "tome"; });
    const tomeList = tomes.length
      ? '<h3 class="section">Tomes</h3><ul class="abilities">' + tomes.map(function (it) {
        const ab = it.teach && IL.abilityById ? IL.abilityById(it.teach) : null;
        const mine = ab && byAb[ab.id] && (f.known || []).indexOf(ab.id) < 0;
        return '<li><strong>' + esc(IL.itemName(it)) + '</strong>' +
          (mine
            ? '<button type="button" class="btn ghost" data-study="' + esc(it.uid) + '">Study</button>'
            : '<span>' + (ab && (f.known || []).indexOf(ab.id) >= 0 ? "Already known" : "Not for this kit") + '</span>') +
          '</li>';
      }).join("") + '</ul>'
      : "";
    const eq = IL.equippedRelics(save);
    const relics = eq.length
      ? '<ul class="relic-list">' + eq.map(function (r) {
        return '<li><strong>' + esc(r.name) + '</strong><p>' + esc(r.blurb) + '</p></li>';
      }).join("") + '</ul>'
      : emptyState("No relics equipped.", "Win a cup or close a season, then equip them on the Relics tab.");
    const slot = (save.lineup || []).indexOf(f.id);
    const full = slot < 0 && (save.lineup || []).length >= IL.PARTY_CAP;
    const lineLabel = slot >= 0 ? "Remove from lineup" : (full ? "Party full" : "Add to lineup");
    const anim = kit.idle || "idle";
    const kos = f.kos || 0;
    return '<div class="sheet-back" id="sheetBack"></div>' +
      '<aside class="sheet" id="fighterSheet" role="dialog" aria-modal="true" aria-labelledby="sheetTitle">' +
        '<header class="sheet-head"><div><p class="eyebrow">' + esc(kit.name) + (f.captain ? " · Captain" : "") + '</p>' +
          '<h2 id="sheetTitle">' + esc(f.name) + '</h2></div>' +
          '<button type="button" class="btn close-x" id="sheetClose" aria-label="Close">Close</button></header>' +
        '<div class="detail-stage">' + portraitWrap('id="detailPreview" width="280" height="248" data-key="' + esc(IL.hero.keyOf(f.parts)) + '" data-anim="' + anim + '" data-scale="5" data-foot="18"', f.captain, f) + '</div>' +
        '<p>Level ' + (f.level || 1) + ' · ' + esc(personalityLabel(f.personality)) + (f.rarity ? " · " + esc(rarityLabel(f.rarity)) : "") + (f.specialty && IL.specialtyOf && IL.specialtyOf(f.specialty) ? " · " + esc(IL.specialtyOf(f.specialty).name) : "") + (f.champion ? " · Champion" : "") + '</p>' +
        '<h3 class="section">Tactic</h3>' + tacticChips(f) +
        '<div class="xp"><span>XP</span><div class="track"><div class="fill" style="width:' + xpPct + '%"></div></div><b>' + into + '/40</b></div>' +
        statBar("HP", stats.hp, 320) +
        statBar("ATK", stats.atk, 40) +
        statBar("DEF", stats.def, 16) +
        statBar("SPD", stats.speed, 180) +
        gearSheetHtml(f) +
        '<h3 class="section">Abilities</h3>' +
        '<p class="loadout-style"><strong>' + esc(attack.name) + '</strong> ' + esc(attack.blurb) + '</p>' +
        '<p class="loadout-style"><strong>Passive · ' + esc(passive.name || "Passive") + '</strong> ' + esc(passiveBlurb) + '</p>' +
        '<h3 class="section">Loadout</h3><div class="loadout">' + loadout + '</div>' +
        '<p class="fine">Equip three. Level 4, a tome, or a drop teaches the rest.</p>' +
        '<div class="loadout-picks" id="loadoutPicks">' + picks + '</div>' +
        (unlearned ? '<h3 class="section">Still to learn</h3><ul class="abilities">' + unlearned + '</ul>' : '') +
        tomeList +
        perkList(f) +
        '<h3 class="section">Relics with the party</h3>' + relics +
        '<h3 class="section">Record</h3>' +
        '<p class="record"><span><b>W</b> ' + (f.wins || 0) + '</span><span><b>L</b> ' + (f.losses || 0) + '</span><span><b>KO</b> ' + kos + '</span></p>' +
        '<div class="sheet-actions">' +
          '<form class="rename-row" id="renameForm"><input id="renameInput" maxlength="22" autocomplete="off" aria-label="Fighter name" value="' + esc(f.name) + '">' +
            '<button type="submit" class="btn ghost">Rename</button></form>' +
          '<p class="fine" id="renameError" hidden>Name them something.</p>' +
          trainControl(f, true) +
          '<button type="button" class="btn ghost" id="setCaptain"' + (f.captain ? " disabled" : "") + '>' + (f.captain ? "Captain" : "Set as captain") + '</button>' +
          '<button type="button" class="btn primary" id="sheetLine"' + (full ? " disabled" : "") + '>' + esc(lineLabel) + '</button>' +
          (f.captain
            ? '<button type="button" class="btn ghost" disabled>Captain stays</button>'
            : '<button type="button" class="btn danger" id="releaseAsk">Release</button>' +
              '<div id="releaseBox" hidden><p>Release ' + esc(f.name) + '? They leave the club.</p>' +
                '<button type="button" class="btn danger" id="releaseYes">Release</button>' +
                '<button type="button" class="btn ghost" id="releaseNo">Keep them</button></div>') +
        '</div>' +
      '</aside>';
  }

  function tacticChips(f) {
    const order = IL.TACTICS || ["strike", "cover", "hold"];
    return '<div class="chips" id="tacticChips">' + order.map(function (id) {
      const on = (f.tactic || "strike") === id;
      return '<button type="button" class="chip' + (on ? " on" : "") + '" data-tactic="' + esc(id) + '">' + esc(tacticLabel(id)) + '</button>';
    }).join("") + '</div>';
  }

  function perkList(f) {
    const rows = (f && f.perks) || [];
    if (!rows.length) return "";
    return '<h3 class="section">Perks</h3><ul class="abilities">' + rows.map(function (p) {
      const copy = (IL.PERK_COPY && IL.PERK_COPY[p.id]) || { name: p.id };
      return '<li><strong>' + esc(copy.name) + '</strong><span>Level ' + (p.level || 1) + '</span><p>Kept on this fighter.</p></li>';
    }).join("") + '</ul>';
  }

  function achievementsHtml() {
    const rows = IL.achievementBoard ? IL.achievementBoard(save) : [];
    const done = rows.filter(function (r) { return r.done; }).length;
    const body = rows.map(function (r) {
      const pct = Math.max(0, Math.min(100, Math.round(100 * (r.current || 0) / Math.max(1, r.goal))));
      const reward = "+" + r.gold + " gold" + (r.renown ? " · +" + r.renown + " renown" : "");
      return '<article class="achieve-row' + (r.done ? " done" : "") + '">' +
        iconTag(r.icon, 24) +
        '<div><strong>' + esc(r.name) + '</strong><p class="fine">' + esc(r.blurb) + " · " + esc(reward) + '</p>' +
        '<div class="track"><div class="fill" style="width:' + pct + '%"></div></div></div>' +
        '<b>' + Math.min(r.current || 0, r.goal) + "/" + r.goal + '</b></article>';
    }).join("");
    return '<section class="panel-frame" id="achievements"><h3 class="section">Achievements</h3>' +
      '<p class="fine">' + done + " of " + rows.length + ".</p>" + body + "</section>";
  }

  function takeAchievements() {
    if (!save || !IL.claimAchievements) return [];
    if ((save.gold || 0) > (save.goldPeak || 0)) save.goldPeak = save.gold;
    const fresh = IL.claimAchievements(save);
    if (fresh.length) persist();
    return fresh;
  }

  let toastTimer = 0;
  function showToasts(list) {
    if (!list || !list.length) return;
    let box = document.getElementById("achieveToast");
    if (!box) {
      box = document.createElement("div");
      box.id = "achieveToast";
      document.body.appendChild(box);
    }
    box.hidden = false;
    box.innerHTML = list.map(function (row) {
      const pay = "+" + (row.gold || 0) + " gold" + (row.renown ? " · +" + row.renown + " renown" : "");
      return '<p class="toast"><strong>' + esc(row.name) + '</strong> ' + esc(pay) + '</p>';
    }).join("");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { box.hidden = true; }, 4200);
  }

  function payCeremony() {
    if ((save.round || 0) < 5) return null;
    if (save.ceremonyPaid === save.season) return null;
    const sorted = sortedClubs();
    const place = sorted.findIndex(function (c) { return c.you; });
    const purse = IL.seasonPurse(place < 0 ? 99 : place);
    save.gold += purse.gold;
    save.renown = (save.renown || 0) + purse.renown;
    save.ceremonyPaid = save.season;
    if (place === 0) save.seasonTitles = (save.seasonTitles || 0) + 1;
    const you = place >= 0 ? sorted[place] : null;
    if (you && you.w >= 5 && you.l === 0) save.unbeaten = (save.unbeaten || 0) + 1;
    return purse;
  }

  function startNextSeason() {
    save.season += 1;
    save.gold += 30;
    (save.roster || []).forEach(function (f) {
      f.season = { dealt: 0, taken: 0, heal: 0, kos: 0 };
    });
    buildSeason(true);
    persist();
    showHub("club");
  }

  function showSeasonEnd() {
    stopLoops();
    hubBed();
    app.onclick = null;
    save = save || load();
    if (!save) { showTitle(); return; }
    IL.migrate(save);
    const purse = payCeremony();
    const fresh = takeAchievements();
    persist();
    const awards = IL.seasonAwards(save.roster);
    const sorted = sortedClubs();
    const place = Math.max(0, sorted.findIndex(function (c) { return c.you; }));
    const table = sorted.map(function (c, i) {
      const played = c.w + c.l;
      return '<tr class="' + (c.you ? "you" : "") + '"><td>' + (i + 1) + '</td><td class="club-cell">' + crestHtml(c.name, "sm", clubCrest(c)) + '<span class="club-name">' + esc(c.name) + '</span></td><td>' + played + '</td><td>' + c.w + '</td><td>' + c.l + '</td><td>' + c.pts + '</td></tr>';
    }).join("");
    function awardCard(label, fighter) {
      if (!fighter) return '<article class="award"><p class="eyebrow">' + esc(label) + '</p><h3>No one yet</h3></article>';
      return '<article class="award"><p class="eyebrow">' + esc(label) + '</p>' +
        portraitWrap('width="120" height="100" data-key="' + esc(IL.hero.keyOf(fighter.parts)) + '" data-anim="cheer"', false, fighter) +
        '<h3>' + esc(fighter.name) + '</h3></article>';
    }
    const cup = save.cup;
    let cupNote = "You sat out the cup.";
    if (cup && cup.champion === "you") cupNote = "You won the cup.";
    else if (cup && cup.champion) cupNote = "The cup went elsewhere.";
    else if (cup) cupNote = "The cup is still open.";
    const paidLine = purse
      ? "+" + purse.gold + " gold · +" + purse.renown + " renown"
      : "Season rewards are already in the purse.";
    app.innerHTML =
      '<main class="hub" id="seasonEnd">' +
        '<header class="hub-head"><div><p class="eyebrow">Season ' + save.season + '</p><h2>The yard closes</h2></div></header>' +
        '<p class="banner">' + esc(save.clubName) + " finishes " + (place + 1) + ".</p>" +
        '<section class="panel-frame"><h3 class="section">Final standings</h3>' +
          '<table class="board" id="finalTable"><thead><tr><th></th><th>Club</th><th>P</th><th>W</th><th>L</th><th>Pts</th></tr></thead><tbody>' + table + '</tbody></table></section>' +
        '<section class="panel-frame" id="awards"><h3 class="section">Awards</h3><div class="awards">' +
          awardCard("MVP", awards.mvp) +
          awardCard("Most KOs", awards.kos) +
          awardCard("Iron wall", awards.wall) +
          awardCard("Top healer", awards.healer) +
        '</div></section>' +
        '<p id="seasonRewards">' + esc(paidLine) + '</p>' +
        '<p id="cupNote">' + esc(cupNote) + '</p>' +
        '<div class="hub-actions">' +
          (save.relicSeason !== save.season ? '<button type="button" class="btn gold" id="claimRelic">Take the yard relic</button>' : '') +
          '<button type="button" class="btn gold" id="startSeason">Start season ' + (save.season + 1) + '</button>' +
          '<button type="button" class="btn ghost" id="backFromSeason">Back to the club</button>' +
        '</div></main>';
    root.scrollTo(0, 0);
    bootCards();
    showToasts(fresh);
    const start = document.getElementById("startSeason");
    if (start) start.onclick = startNextSeason;
    const back = document.getElementById("backFromSeason");
    if (back) back.onclick = function () { showHub("club"); };
    const claim = document.getElementById("claimRelic");
    if (claim) claim.onclick = function () {
      const relic = IL.offerRelic(save, takeRng());
      save.relicSeason = save.season;
      if (relic && save.equipped.length < 2) save.equipped.push(relic.id);
      persist();
      showSeasonEnd();
    };
  }

  function clubPanel() {
    const rival = nextRival();
    const size = save.round < 5 ? IL.SEASON_SIZES[save.round] : 0;
    const yours = size ? fielded(save.roster, size) : [];
    const theirs = rival && size ? rival.fighters.slice(0, size) : [];
    const partyReady = !size || yours.length >= size;
    const done = save.round >= 5;
    const table = sortedClubs().map(function (c, i) {
      const played = c.w + c.l;
      return '<tr class="' + (c.you ? "you" : "") + '"><td>' + (i + 1) + '</td><td class="club-cell">' + crestHtml(c.name, "sm", clubCrest(c)) + '<span class="club-name">' + esc(c.name) + '</span></td><td>' + played + '</td><td>' + c.w + '</td><td>' + c.l + '</td><td>' + c.pts + '</td></tr>';
    }).join("");
    const youNames = yours.length ? yours.map(function (f) { return f.name; }).join(" · ") : "Nobody slotted";
    const themNames = theirs.map(function (f) { return f.name; }).join(" · ");
    const preview = (!done && rival)
      ? '<section class="preview-board" id="matchPreview">' +
          '<div class="preview-side"><div>' + crestHtml(save.clubName, "md", save.crest) + '<p class="eyebrow">Your party</p><h3>' + esc(youNames) + '</h3>' +
          '<p class="fine">' + yours.length + ' of ' + size + ' walking in</p></div></div>' +
          '<p class="vs">vs</p>' +
          '<div class="preview-side"><div>' + crestHtml(rival.name, "md", clubCrest(rival)) + '<p class="eyebrow">Next opponent</p><h3>' + esc(rival.name) + '</h3>' +
          '<p class="fine">Record ' + (rival.w || 0) + '–' + (rival.l || 0) + (themNames ? ' · sends ' + esc(themNames) : '') + '</p></div></div>' +
          '<button type="button" class="btn fight" id="nextMatch"' + (partyReady ? "" : " disabled") + '>' +
            (partyReady ? "Send them in" : ("Choose " + size)) + '</button>' +
        '</section>'
      : "";
    const yard = '<section class="panel-frame" id="clubYardWrap">' +
      '<h3 class="section">Club yard</h3>' +
      '<p class="fine">The roster walks the yard. Click a fighter to open their sheet.</p>' +
      '<canvas id="clubYard" width="480" height="168" aria-label="Club yard"></canvas></section>';
    return (pendingGrowth().length
        ? '<p class="banner">Someone grew in the pit. <button type="button" class="btn gold" id="openGrowth">Choose a perk</button></p>'
        : '') +
      (pendingMoveFighters().length
        ? '<p class="banner">A new trick is waiting. <button type="button" class="btn gold" id="openMoves">Choose a move</button></p>'
        : '') +
      (done
        ? '<p class="banner">Season closed. ' + esc(sortedClubs()[0].name) + ' leads the board. <button type="button" class="btn gold" id="openSeasonBanner">Open the ceremony</button></p>'
        : '<p class="banner">Match ' + (save.round + 1) + ' of 5 · ' + size + ' vs ' + size + ' against <strong>' + esc(rival ? rival.name : "—") + '</strong></p>') +
      (size && yours.length < size
        ? '<p class="banner">The pit wants ' + size + '. ' + yours.length + ' chosen — add ' + (size - yours.length) + ' more from the bench.</p>'
        : '') +
      preview +
      synergyLine(yours, "partySynergy") +
      '<div class="hub-split">' +
        '<div class="hub-main">' +
          rosterHtml(size, size ? "In the pit" : "Party", "all") +
        '</div>' +
        '<div class="pane" id="clubPane">' +
          yard +
          '<section class="panel-frame"><h3 class="section">Standings</h3>' +
            '<table class="board"><thead><tr><th></th><th>Club</th><th>P</th><th>W</th><th>L</th><th>Pts</th></tr></thead><tbody>' + table + '</tbody></table>' +
          '</section>' +
          historyHtml() +
          achievementsHtml() +
        '</div>' +
      '</div>';
  }

  function fightersPanel() {
    const size = save.round < 5 ? IL.SEASON_SIZES[save.round] : 0;
    return '<div id="fighterList">' +
      filterBar("fighters", fighterFilter, [["all", "All"], ["party", "Party"], ["bench", "Bench"]]) +
      '<div class="hub-split">' +
        '<div class="hub-main">' +
          rosterHtml(size, size ? "In the pit" : "Party", fighterFilter) +
        '</div>' +
        '<div class="pane" id="armoryPane">' + armoryHtml() + '</div>' +
      '</div>' +
    '</div>';
  }

  function recruitTags(f, kit) {
    const spec = IL.specialtyOf ? IL.specialtyOf(f.specialty) : null;
    const trait = kit && kit.trait && IL.TRAITS ? IL.TRAITS[kit.trait] : null;
    return [rarityLabel(f.rarity), spec && spec.name, trait && trait.name].filter(Boolean).join(" · ");
  }

  function marketPanel() {
    if (marketPane === "recruits") marketPane = "fighters";
    const cards = (save.market || []).map(function (row, i) {
      const f = row.fighter;
      const kit = IL.CLASSES[f.cls] || IL.CLASSES.warrior;
      const locked = !!row.locked;
      const champ = f.champion ? " · Champion" : "";
      const price = locked ? (row.need + " renown") : (row.cost + " gold");
      const cant = locked || save.gold < row.cost || save.roster.length >= IL.ROSTER_CAP;
      return '<article class="card roster-row' + (cant ? " cant-afford" : " buyable") + '" data-role="' + esc(kit.role) + '">' +
        portraitWrap('width="72" height="64" data-key="' + esc(IL.hero.keyOf(f.parts)) + '" data-anim="' + (kit.idle || "idle") + '" data-scale="2" data-foot="6"', false, f) +
        '<div class="row-main">' +
          '<h3>' + esc(f.name) + champ + '</h3>' +
          '<p class="kit-line">' + classBadge(f.cls) + '<span>' + esc(kit.name) + ' · ' + esc(recruitTags(f, kit)) + '</span></p>' +
          '<p class="fine">' + esc(price) + (kit.ability ? " · " + esc(kit.ability.name) : "") + '</p>' +
        '</div>' +
        '<button type="button" class="btn primary hire' + (cant ? " cant-afford" : " buyable") + '" data-hire="' + i + '"' + (cant ? " disabled" : "") + '>' + (locked ? "Locked" : "Hire") + '</button>' +
      '</article>';
    }).join("");
    const bench = save.roster.filter(function (f) { return !f.captain; }).map(function (f) {
      const kit = IL.CLASSES[f.cls] || IL.CLASSES.warrior;
      const inParty = (save.lineup || []).indexOf(f.id) >= 0;
      return '<article class="card roster-row" data-role="' + esc(kit.role) + '">' +
        '<button type="button" class="portrait" data-detail="' + esc(f.id) + '" aria-label="Open ' + esc(f.name) + '">' +
          portraitWrap('width="72" height="64" data-key="' + esc(IL.hero.keyOf(f.parts)) + '" data-anim="' + (kit.idle || "idle") + '" data-scale="2" data-foot="6"', false, f) +
        '</button>' +
        '<div class="row-main">' +
          '<h3>' + esc(f.name) + '</h3>' +
          '<p class="kit-line">' + classBadge(f.cls) + '<span>' + esc(kit.name) + " · Lv " + f.level + (inParty ? " · party" : "") + '</span></p>' +
          '<p class="fine">' + IL.sellValue(f) + ' gold · gear returns to the bag</p>' +
        '</div>' +
        '<button type="button" class="btn ghost buyable" data-sell="' + esc(f.id) + '">Sell</button>' +
      '</article>';
    }).join("");
    const captain = save.roster.filter(function (f) { return f.captain; })[0];
    const brokeRefresh = save.gold < IL.REFRESH_COST;
    const recruits = '<section class="roster-block"><h3 class="section">For hire</h3>' +
      '<p class="fine">Rarity, specialty, and trait sit on the card. A refresh spends ' + IL.REFRESH_COST + ' gold.</p>' +
      '<div class="hub-actions"><button type="button" class="btn ghost' + (brokeRefresh ? " cant-afford" : " buyable") + '" id="refreshMarket"' + (brokeRefresh ? " disabled" : "") + '>Refresh fighters — ' + IL.REFRESH_COST + ' gold</button></div>' +
      '<div class="cards roster-grid" id="marketCards">' + cards + '</div></section>';
    const selling = '<section class="roster-block"><h3 class="section">Sell from the bench</h3>' +
      '<p class="fine">' + (captain ? esc(captain.name) + " is captain and stays." : "The captain stays.") + '</p>' +
      '<div class="cards roster-grid">' + (bench || emptyState("The bench is empty.", "Hire someone before there is anyone to sell.")) + '</div></section>';
    const body = marketPane === "gear" ? gearStallHtml()
      : marketPane === "relics" ? relicStallHtml()
      : marketPane === "deals" ? dealsHtml()
      : marketPane === "sell" ? selling
      : recruits;
    return filterBar("market", marketPane, [["gear", "Gear"], ["fighters", "Fighters"], ["relics", "Relics"], ["deals", "Deals"], ["sell", "Sell"]]) +
      '<p class="banner">Roster ' + save.roster.length + ' of ' + IL.ROSTER_CAP + '. Hire onto the bench, then slot them from the club.</p>' +
      (marketPane === "deals" ? dealsHead() : "") +
      '<div class="pane" id="marketPane">' + body + '</div>';
  }

  function dealsHead() {
    const left = IL.formatRemain(IL.msUntilWeek(Date.now()));
    const cost = IL.DEAL_REROLL || 40;
    const broke = save.gold < cost;
    return '<p class="fine" id="dealClock">Turns over in ' + esc(left) + '. A reroll spends ' + cost + ' gold and restocks the board.</p>' +
      '<div class="hub-actions"><button type="button" class="btn ghost' + (broke ? " cant-afford" : " buyable") + '" id="rerollDeals"' + (broke ? " disabled" : "") + '>Reroll deals — ' + cost + ' gold</button></div>';
  }

  function relicStallHtml() {
    const rows = save.relicStock || [];
    const cards = rows.map(function (row, i) {
      const relic = IL.relicById(row.id);
      if (!relic) return "";
      const owned = (save.relics || []).indexOf(row.id) >= 0;
      const gone = row.stock < 1;
      const broke = save.gold < row.cost;
      const cant = owned || gone || broke;
      const label = owned ? "Owned" : (gone ? "Sold" : ("Buy — " + row.cost + " gold"));
      return '<article class="card stall-card' + (cant ? " cant-afford" : " buyable") + '">' +
        '<h3>' + esc(relic.name) + '</h3>' +
        '<p>' + esc(relic.blurb) + '</p>' +
        '<p class="fine">' + (gone ? "Out of stock" : "1 in stock") + '</p>' +
        '<button type="button" class="btn primary" data-buy-relic="' + i + '"' + (cant ? " disabled" : "") + '>' + label + '</button>' +
      '</article>';
    }).join("");
    const owned = (save.relics || []).map(function (id) {
      const relic = IL.relicById(id);
      if (!relic) return "";
      const pay = IL.relicSellPrice(id);
      return '<article class="card stall-card">' +
        '<h3>' + esc(relic.name) + '</h3>' +
        '<p class="fine">Sell for ' + pay + ' gold. An equipped copy leaves the party.</p>' +
        '<button type="button" class="btn ghost" data-sell-relic="' + esc(id) + '">Sell — ' + pay + ' gold</button>' +
      '</article>';
    }).join("");
    const cost = IL.REFRESH_COST;
    const broke = save.gold < cost;
    return '<section class="panel-frame" id="relicStall"><h3 class="section">Relic stall</h3>' +
      '<p class="fine">One of each. Refresh spends ' + cost + ' gold. Equip what you own on the Relics tab.</p>' +
      '<div class="hub-actions"><button type="button" class="btn ghost' + (broke ? " cant-afford" : " buyable") + '" id="refreshRelics"' + (broke ? " disabled" : "") + '>Refresh relics — ' + cost + ' gold</button></div>' +
      '<div class="armory-grid">' + (cards || emptyState("The stall is bare.", "Refresh it.")) + '</div>' +
      '<h3 class="section">Yours to sell</h3>' +
      '<div class="armory-grid">' + (owned || emptyState("No relics in the chest.", "Buy one here, or win a cup.")) + '</div></section>';
  }

  function dealsHtml() {
    const deals = save.deals || { offers: [] };
    const cards = (deals.offers || []).map(function (offer, i) {
      const gone = offer.stock < 1;
      const broke = save.gold < offer.cost;
      if (offer.kind === "fighter") {
        const f = offer.fighter;
        const kit = IL.CLASSES[f.cls] || IL.CLASSES.warrior;
        const full = save.roster.length >= IL.ROSTER_CAP;
        const cant = gone || broke || full;
        return '<article class="card roster-row' + (cant ? " cant-afford" : " buyable") + '">' +
          portraitWrap('width="72" height="64" data-key="' + esc(IL.hero.keyOf(f.parts)) + '" data-anim="' + (kit.idle || "idle") + '" data-scale="2" data-foot="6"', false, f) +
          '<div class="row-main">' +
            '<h3>' + esc(f.name) + (f.champion ? " · Champion" : "") + '</h3>' +
            '<p class="kit-line">' + classBadge(f.cls) + '<span>' + esc(kit.name) + ' · ' + esc(recruitTags(f, kit)) + '</span></p>' +
            '<p class="fine">' + offer.cost + ' gold · 1 in stock</p>' +
          '</div>' +
          '<button type="button" class="btn primary" data-deal="' + i + '"' + (cant ? " disabled" : "") + '>' + (gone ? "Sold" : "Hire") + '</button>' +
        '</article>';
      }
      if (offer.kind === "bundle") {
        const names = (offer.relics || []).map(function (id) {
          const relic = IL.relicById(id);
          return relic ? relic.name : id;
        }).join(" and ");
        const haveAll = (offer.relics || []).every(function (id) { return (save.relics || []).indexOf(id) >= 0; });
        const cant = gone || broke || haveAll;
        return '<article class="card stall-card' + (cant ? " cant-afford" : " buyable") + '">' +
          '<h3>Relic bundle</h3>' +
          '<p>' + esc(names) + '</p>' +
          '<p class="fine">Both, at a discount. You keep any you already own. 1 in stock.</p>' +
          '<button type="button" class="btn primary" data-deal="' + i + '"' + (cant ? " disabled" : "") + '>' + (haveAll ? "Owned" : (gone ? "Sold" : ("Buy — " + offer.cost + " gold"))) + '</button>' +
        '</article>';
      }
      const opened = offer.opened;
      let result = "Gold, plus a relic or a piece of gear. 1 in stock.";
      if (opened) {
        const bits = [];
        if (opened.gold) bits.push(opened.gold + " gold");
        if (opened.relic && IL.relicById(opened.relic)) bits.push(IL.relicById(opened.relic).name);
        if (opened.itemName) bits.push(opened.itemName);
        result = "Opened: " + bits.join(", ") + ".";
      }
      const cant = gone || broke;
      return '<article class="card stall-card' + (cant ? " cant-afford" : " buyable") + '">' +
        '<h3>Mystery chest</h3>' +
        '<p class="fine">' + esc(result) + '</p>' +
        '<button type="button" class="btn primary" data-deal="' + i + '"' + (cant ? " disabled" : "") + '>' + (gone ? "Opened" : ("Open — " + offer.cost + " gold")) + '</button>' +
      '</article>';
    }).join("");
    return '<section id="dealsBoard"><h3 class="section">This week</h3>' +
      '<div class="deals-stack">' + cards + '</div></section>';
  }

  function relicsPanel() {
    const owned = {};
    (save.relics || []).forEach(function (id) { owned[id] = true; });
    const list = IL.RELICS.map(function (r) {
      const have = !!owned[r.id];
      const on = (save.equipped || []).indexOf(r.id) >= 0;
      const status = on ? "Riding with the party" : (have ? "In the chest" : "Buy one on the market, or win a cup");
      return '<article class="card relic' + (on ? " playing" : "") + '">' +
        '<img class="relic-slot" alt="" src="assets/ui/slots/slot_diamond.png">' +
        '<h3>' + esc(r.name) + '</h3>' +
        '<p>' + esc(r.blurb) + '</p>' +
        '<p class="fine">' + status + '</p>' +
        (have
          ? '<button type="button" class="btn ' + (on ? "primary" : "ghost") + '" data-equip="' + r.id + '">' + (on ? "Equipped" : "Equip") + '</button>'
          : '<p class="fine">Not in the yard yet.</p>') +
      '</article>';
    }).join("");
    return '<header class="panel-head"><p class="eyebrow">Club relics</p><h3>The yard chest</h3>' +
      '<p class="fine">' + (save.equipped || []).length + ' of 2 equipped · ' + (save.relics || []).length + ' owned</p></header>' +
      '<p class="banner">Two relics ride with everyone you field. Buy them on the market, or win a cup, or close a season.</p>' +
      '<div class="cards relic-grid">' + list + '</div>';
  }

  function historyHtml() {
    const rows = (save.history || []).slice(0, 10);
    const body = rows.length
      ? '<ol class="history">' + rows.map(function (h) {
        return '<li><b>' + (h.win ? "W" : "L") + '</b><span>' + esc(h.opponent || "Rival") + '</span><span>' + esc(h.score || "") + '</span><em>MVP ' + esc(h.mvp || "—") + '</em></li>';
      }).join("") + '</ol>'
      : emptyState("No results yet.", "Send the party in. The last ten stay here.");
    return '<section class="panel-frame" id="history"><h3 class="section">Recent results</h3>' + body + '</section>';
  }

  function tieCard(tie) {
    if (!tie || !tie.a) return '<div class="tie pending"><span>Waiting on the semis</span></div>';
    const winName = tie.winner
      ? ((tie.a && tie.a.id === tie.winner) ? tie.a.name : (tie.b && tie.b.name))
      : "";
    const mark = function (side) {
      if (!side) return "";
      const through = tie.winner && side.id === tie.winner ? " through" : "";
      const you = side.you ? " you" : "";
      const idx = side.you ? (save && save.crest) : crestIndexOf(side.name);
      return '<span class="club-line' + you + through + '">' + crestHtml(side.name, "sm", idx) + esc(side.name) + '</span>';
    };
    const yours = (tie.a && tie.a.you) || (tie.b && tie.b.you);
    return '<div class="tie' + (yours ? " yours" : "") + '">' + mark(tie.a) + mark(tie.b) +
      '<em>' + (winName ? esc(winName) + " through" : "Yet to fight") + '</em></div>';
  }

  function cupMarkup(cup) {
    if (!cup) return "";
    const champName = cup.champion
      ? ((cup.slots || []).filter(function (s) { return s.id === cup.champion; })[0] || {}).name || cup.champion
      : "";
    const champ = champName ? ("<p class='banner'>Cup champion: " + esc(champName) + "</p>") : "";
    if (cup.tree && cup.tree.semis) {
      return '<div class="bracket" id="bracketBoard">' +
        '<div class="bracket-col"><p class="eyebrow">Semi</p>' + cup.tree.semis.map(tieCard).join("") + '</div>' +
        '<div class="bracket-col"><p class="eyebrow">Final</p>' + tieCard(cup.tree.final) + '</div>' +
      '</div>' + champ;
    }
    const rows = (cup.pairing || []).map(function (pair, i) {
      const a = cup.slots[pair[0]];
      const b = cup.slots[pair[1]];
      const win = cup.winners[i];
      const label = (a ? a.name : "?") + " vs " + (b ? b.name : "?");
      const mark = win ? (" · " + (cup.slots.filter(function (s) { return s.id === win; })[0] || {}).name + " through") : "";
      return "<li>" + esc(label + mark) + "</li>";
    }).join("");
    return '<div class="bracket" id="bracketBoard"><ol>' + rows + '</ol></div>' + champ;
  }

  function cupPanel() {
    const cup = save.cup;
    const opp = cup ? IL.cupOpponent(cup) : null;
    const cupSize = cup ? cup.size : 2;
    const sent = fielded(save.roster, cupSize);
    const sentNames = sent.map(function (f) { return f.name; }).join(" · ") || "nobody yet";
    const cupReady = !cup || sent.length >= cup.size;
    const fightBtn = opp
      ? '<button type="button" class="btn fight" id="cupFight"' + (cupReady ? "" : " disabled") + '>Fight ' + esc(opp.foe.name) + '</button>'
      : "";
    const enter = (!cup || cup.champion)
      ? '<button type="button" class="btn gold" id="enterCup"' + ((save.tokens || 0) < 1 ? " disabled" : "") + '>Enter cup — 1 token</button>'
      : fightBtn;
    return '<header class="panel-head"><p class="eyebrow">Single elimination</p><h3>The cup</h3></header>' +
      '<div class="hub-actions">' + enter + '</div>' +
      '<p class="banner">Four clubs. You send ' + esc(sentNames) + '. The other semi is called from the yard. Win the final for gold, renown, and a shot at a relic.</p>' +
      (opp && !cupReady ? '<p class="banner">Set ' + cup.size + ' fighters in the lineup on the club tab before this tie.</p>' : '') +
      (cup ? cupMarkup(cup) : '<p class="fine">No bracket yet.</p>');
  }

  function captureScroll() {
    const panes = [];
    document.querySelectorAll(".pane, #fighterSheet, #creditsSheet, #settingsSheet").forEach(function (el) {
      if (el.id) panes.push({ id: el.id, top: el.scrollTop });
    });
    return {
      y: window.scrollY || document.documentElement.scrollTop || 0,
      panes: panes
    };
  }

  function restoreScroll(snap) {
    if (!snap) return;
    window.scrollTo(0, snap.y);
    snap.panes.forEach(function (row) {
      const el = document.getElementById(row.id);
      if (el) el.scrollTop = row.top;
    });
  }

  function refreshHub() {
    showHub(hubTab, true);
  }

  function showHub(tab, keep) {
    stopLoops();
    app.onclick = null;
    save = save || load();
    if (!save) { showTitle(); return; }
    IL.migrate(save);
    ensureMarket();
    const freshAchieve = takeAchievements();
    const next = (typeof tab === "string" && HUB_TABS.indexOf(tab) >= 0) ? tab : hubTab;
    const switching = next !== hubTab;
    const snap = keep && !switching ? captureScroll() : null;
    if (switching) {
      if (next === "market") marketPane = "fighters";
      if (next === "fighters") fighterFilter = "all";
    }
    hubTab = next;
    hubBed();
    if (detailId && !fighterById(detailId)) detailId = null;
    persist();
    const chaosReady = fielded(save.roster, 1).length >= 1;
    const done = save.round >= 5;
    const panel = hubTab === "fighters" ? fightersPanel()
      : hubTab === "market" ? marketPanel()
      : hubTab === "cup" ? cupPanel()
      : hubTab === "relics" ? relicsPanel()
      : clubPanel();
    const fighter = detailId ? fighterById(detailId) : null;
    app.innerHTML =
      '<main class="hub">' +
        '<div class="hub-sticky">' +
          '<header class="hub-head">' +
            crestHtml(save.clubName, "md", save.crest) +
            '<div><p class="eyebrow">Season ' + save.season + '</p><h2>' + esc(save.clubName) + '</h2></div>' +
            '<div class="hub-actions">' +
              (done ? '<button type="button" class="btn gold" id="openSeason">Season ceremony</button>' : '') +
              '<button type="button" class="btn fight" id="chaos"' + (chaosReady ? "" : " disabled") + '>Chaos pit</button>' +
              '<button type="button" class="text-btn" id="credits">Credits</button>' +
              '<button type="button" class="icon-btn" id="settings" aria-label="Settings">⚙</button>' +
              '<button type="button" class="text-btn" id="toTitle">Title</button>' +
            '</div>' +
          '</header>' +
          purseHtml() +
          tabBar(hubTab) +
        '</div>' +
        '<div class="hub-panel" id="hubPanel">' + panel + '</div>' +
      '</main>' +
      (creditsOpen ? creditsHtml() : '') +
      (settingsOpen && !creditsOpen ? settingsHtml() : '') +
      (!settingsOpen && !creditsOpen && fighter ? sheetHtml(fighter) : '');
    if (snap) {
      restoreScroll(snap);
      requestAnimationFrame(function () {
        restoreScroll(snap);
        requestAnimationFrame(function () { restoreScroll(snap); });
      });
    } else {
      root.scrollTo(0, 0);
    }
    bindHub();
    const extra = [];
    if (hubTab === "market") {
      (save.market || []).forEach(function (row) { if (row && row.fighter) extra.push(row.fighter.parts); });
      ((save.deals && save.deals.offers) || []).forEach(function (o) { if (o && o.fighter) extra.push(o.fighter.parts); });
    }
    bootCards(extra);
    showToasts(freshAchieve);
  }

  function creditsHtml() {
    return '<div class="sheet-back" id="creditsBack"></div>' +
      '<aside class="sheet" id="creditsSheet" role="dialog" aria-modal="true" aria-labelledby="creditsTitle">' +
        '<header class="sheet-head"><div><p class="eyebrow">Club</p><h2 id="creditsTitle">Credits</h2></div>' +
          '<button type="button" class="btn close-x" id="creditsClose" aria-label="Close">Close</button></header>' +
        '<h3 class="section">Additional art assets</h3>' +
        '<p>Ricardo Machado (Beowulf). Mini Weapons and Mini Monster Drops.</p>' +
        '<p>CaptainSkolot.</p>' +
        '<p>DreamingOfLight888 (7T4E).</p>' +
        '<p>finalbossblues (Time Fantasy and Time Elements).</p>' +
        '<p>Weapon sprites by Final Boss Blues and Wenrexa</p>' +
        '<p>Sound and music generated with ElevenLabs; additional sound design by the Iron League team.</p>' +
        '<p>AU_pixel (Heroes99).</p>' +
        '<p>PizzaDoggy (BitFX).</p>' +
        '<p>Wenrexa. UI kit, cursors, and backgrounds are CC0. Glyph icons are CC BY 4.0. Emblems are CC BY-ND 4.0, shown white and unmodified.</p>' +
        '<p class="fine">These pictures stay inside the game. They are not offered as a separate pack.</p>' +
      '</aside>';
  }

  function bindCredits() {
    if (!document.getElementById("creditsSheet")) return;
    const close = function () {
      creditsOpen = false;
      refreshHub();
    };
    const back = document.getElementById("creditsBack");
    if (back) back.onclick = close;
    const closeBtn = document.getElementById("creditsClose");
    if (closeBtn) closeBtn.onclick = close;
  }

  function settingsHtml() {
    const s = save.settings || { speed: 1, shake: true, sound: 80, music: 60, crowd: 70 };
    const picks = [1, 2, 3].map(function (n) {
      return '<button type="button" class="btn ghost' + (s.speed === n ? " on" : "") + '" id="speedPick' + n + '" data-speed="' + n + '">' + n + '×</button>';
    }).join("");
    return '<div class="sheet-back" id="settingsBack"></div>' +
      '<aside class="sheet" id="settingsSheet" role="dialog" aria-modal="true" aria-labelledby="settingsTitle">' +
        '<header class="sheet-head"><div><p class="eyebrow">Club</p><h2 id="settingsTitle">Settings</h2></div>' +
          '<button type="button" class="btn close-x" id="settingsClose" aria-label="Close">Close</button></header>' +
        '<label class="field">SFX<input id="soundVol" type="range" min="0" max="100" value="' + s.sound + '"></label>' +
        '<label class="field">Music<input id="musicVol" type="range" min="0" max="100" value="' + s.music + '"></label>' +
        '<label class="field">Crowd<input id="crowdVol" type="range" min="0" max="100" value="' + (typeof s.crowd === "number" ? s.crowd : 70) + '"></label>' +
        '<p class="fine">SFX is the fight and menu sound. Music is the bed under the club and the pit. Crowd is the stands.</p>' +
        '<p class="eyebrow">Fight speed</p>' +
        '<div class="chips" id="speedPicks">' + picks + '</div>' +
        '<label class="shake-row"><input type="checkbox" id="shakeToggle"' + (s.shake ? " checked" : "") + '> Screen shake</label>' +
        '<button type="button" class="btn danger" id="resetAsk">Reset save</button>' +
        '<div id="resetBox" hidden><p>Erase this club from the browser? This cannot be undone.</p>' +
          '<button type="button" class="btn danger" id="resetYes">Erase</button>' +
          '<button type="button" class="btn ghost" id="resetNo">Keep the club</button></div>' +
      '</aside>';
  }

  function bindSettings() {
    if (!document.getElementById("settingsSheet")) return;
    const close = function () {
      settingsOpen = false;
      refreshHub();
    };
    const back = document.getElementById("settingsBack");
    if (back) back.onclick = close;
    const closeBtn = document.getElementById("settingsClose");
    if (closeBtn) closeBtn.onclick = close;
    function touch() { persist(); }
    const sound = document.getElementById("soundVol");
    if (sound) sound.oninput = function () { save.settings.sound = +sound.value; syncMix(); touch(); };
    const music = document.getElementById("musicVol");
    if (music) music.oninput = function () { save.settings.music = +music.value; syncMix(); touch(); };
    const crowd = document.getElementById("crowdVol");
    if (crowd) crowd.oninput = function () { save.settings.crowd = +crowd.value; syncMix(); touch(); };
    const picks = document.getElementById("speedPicks");
    if (picks) picks.onclick = function (ev) {
      const btn = ev.target.closest("[data-speed]");
      if (!btn) return;
      save.settings.speed = +btn.dataset.speed;
      touch();
      const all = picks.querySelectorAll("[data-speed]");
      for (let i = 0; i < all.length; i++) all[i].classList.toggle("on", all[i] === btn);
    };
    const shake = document.getElementById("shakeToggle");
    if (shake) shake.onchange = function () { save.settings.shake = !!shake.checked; touch(); };
    const ask = document.getElementById("resetAsk");
    const box = document.getElementById("resetBox");
    if (ask && box) ask.onclick = function () { box.hidden = false; ask.hidden = true; };
    const no = document.getElementById("resetNo");
    if (no && box && ask) no.onclick = function () { box.hidden = true; ask.hidden = false; };
    const yes = document.getElementById("resetYes");
    if (yes) yes.onclick = function () {
      try { localStorage.removeItem(SAVE_KEY); } catch (err) { /* still leave the club screen */ }
      save = null;
      settingsOpen = false;
      detailId = null;
      pendingSpec = null;
      showTitle();
    };
  }

  function squadPower(list) {
    let s = 0;
    (list || []).forEach(function (f) {
      const kit = IL.CLASSES[f.cls] || IL.CLASSES.warrior;
      const st = IL.scaledStats(f, kit);
      s += st.hp + st.atk * 8 + st.def * 12;
    });
    return Math.max(1, Math.round(s));
  }

  function versusCard(f) {
    const kit = IL.CLASSES[f.cls] || IL.CLASSES.warrior;
    const st = IL.scaledStats(f, kit);
    const trait = IL.TRAITS && IL.TRAITS[kit.trait];
    return '<article class="card versus-card" data-role="' + esc(kit.role) + '">' +
      portraitWrap('width="140" height="120" data-key="' + esc(IL.hero.keyOf(f.parts)) + '" data-anim="' + (kit.idle || "idle") + '"', false, f) +
      '<h3>' + esc(f.name) + '</h3>' +
      '<p class="kit-line">' + classBadge(f.cls) + '<span>' + esc(kit.name) + " · Lv " + (f.level || 1) + '</span></p>' +
      (trait ? '<p class="trait-line">' + esc(trait.name) + '</p>' : '') +
      '<p class="fine">HP ' + Math.round(st.hp) + '</p>' +
    '</article>';
  }

  function openVersus(spec) {
    pendingSpec = spec;
    stopLoops();
    app.onclick = null;
    const left = spec.left || [];
    const right = spec.right || [];
    const youP = squadPower(left);
    const themP = squadPower(right);
    const share = Math.max(8, Math.min(92, Math.round(100 * youP / (youP + themP))));
    app.innerHTML =
      '<main class="hub versus-screen" id="versus">' +
        '<header class="hub-head versus-head">' +
          crestHtml(spec.leftName || save.clubName, "md", save.crest) +
          '<div><p class="eyebrow">Before the pit</p><h2>' + esc(spec.leftName || save.clubName) + ' vs ' + esc(spec.rightName || "Rivals") + '</h2></div>' +
          crestHtml(spec.rightName || "Rivals", "md", crestIndexOf(spec.rightName)) +
        '</header>' +
        '<div class="versus-grid">' +
          '<section class="panel-frame"><h3 class="section">Your party</h3>' + synergyLine(left, "yourSynergy") + '<div class="cards">' + left.map(versusCard).join("") + '</div></section>' +
          '<section class="panel-frame"><h3 class="section">They send</h3>' + synergyLine(right, "theirSynergy") + '<div class="cards">' + right.map(versusCard).join("") + '</div></section>' +
        '</div>' +
        '<div class="power-compare" id="powerBar">' +
          '<div class="power-track"><div class="power-you" style="width:' + share + '%"></div></div>' +
          '<p>Power ' + youP + ' · ' + themP + '</p>' +
        '</div>' +
        '<div class="versus-actions">' +
          '<button type="button" class="btn ghost" id="versusBack">Back</button>' +
          '<button type="button" class="btn fight" id="confirmFight">Fight</button>' +
        '</div>' +
      '</main>';
    root.scrollTo(0, 0);
    document.getElementById("versusBack").onclick = function () {
      pendingSpec = null;
      showHub(spec.returnTab || "club");
    };
    document.getElementById("confirmFight").onclick = confirmPending;
    bootCards(right.map(function (f) { return f && f.parts; }));
  }

  function confirmPending() {
    const spec = pendingSpec;
    if (!spec) return;
    const btn = document.getElementById("confirmFight");
    if (btn) { btn.disabled = true; btn.textContent = "Opening the pit…"; }
    launchMatch(spec).catch(function (e) {
      if (btn) { btn.disabled = false; btn.textContent = "Fight"; }
      const banner = document.querySelector(".banner");
      if (banner) banner.textContent = e.message;
    });
  }

  function showMarket() { showHub("market", true); }
  function showRelics() { showHub("relics"); }
  function showCup() { showHub("cup"); }

  function bindHub() {
    const nm = document.getElementById("nextMatch");
    if (nm) nm.onclick = function () { startFight(); };
    const openSeason = document.getElementById("openSeason");
    if (openSeason) openSeason.onclick = function () { showSeasonEnd(); };
    const openSeasonBanner = document.getElementById("openSeasonBanner");
    if (openSeasonBanner) openSeasonBanner.onclick = function () { showSeasonEnd(); };
    const chaosBtn = document.getElementById("chaos");
    if (chaosBtn) chaosBtn.onclick = function () { startChaosFight(); };
    const growthBtn = document.getElementById("openGrowth");
    if (growthBtn) growthBtn.onclick = function () { showGrowth(); };
    const movesBtn = document.getElementById("openMoves");
    if (movesBtn) movesBtn.onclick = function () { showMoves(); };
    const claimBtn = document.getElementById("claimRelic");
    if (claimBtn) claimBtn.onclick = function () {
      const relic = IL.offerRelic(save, takeRng());
      save.relicSeason = save.season;
      if (relic && save.equipped.length < 2) save.equipped.push(relic.id);
      persist();
      refreshHub();
    };
    const titleBtn = document.getElementById("toTitle");
    if (titleBtn) titleBtn.onclick = showTitle;
    const creditsBtn = document.getElementById("credits");
    if (creditsBtn) creditsBtn.onclick = function () {
      detailId = null;
      gearPreview = null;
      tonicPick = null;
      tomePick = null;
      settingsOpen = false;
      creditsOpen = true;
      refreshHub();
    };
    bindCredits();
    const gear = document.getElementById("settings");
    if (gear) gear.onclick = function () {
      detailId = null;
      creditsOpen = false;
      settingsOpen = true;
      refreshHub();
    };
    bindSettings();
    const refreshBtn = document.getElementById("refreshMarket");
    if (refreshBtn) refreshBtn.onclick = function () {
      if (save.gold < IL.REFRESH_COST) return;
      save.gold -= IL.REFRESH_COST;
      save.market = IL.rollMarket(takeRng(), save.renown || 0);
      persist();
      showHub("market", true);
    };
    const enterBtn = document.getElementById("enterCup");
    if (enterBtn) enterBtn.onclick = function () {
      if ((save.tokens || 0) < 1) return;
      save.tokens -= 1;
      save.cupsEntered = (save.cupsEntered || 0) + 1;
      save.cup = IL.startCup(save, takeRng());
      persist();
      showHub("cup", true);
    };
    const cupFight = document.getElementById("cupFight");
    if (cupFight) cupFight.onclick = function () { startCupFight(); };
    const tabs = document.getElementById("tabbar");
    if (tabs) tabs.onclick = function (ev) {
      const t = ev.target.closest("[data-tab]");
      if (!t) return;
      if (t.dataset.tab === hubTab && !detailId && !gearPreview && !creditsOpen) return;
      detailId = null;
      gearPreview = null;
      tonicPick = null;
      tomePick = null;
      creditsOpen = false;
      showHub(t.dataset.tab, t.dataset.tab === hubTab);
    };
    const panel = document.getElementById("hubPanel");
    if (panel) panel.onclick = function (ev) {
      const filt = ev.target.closest("[data-filter-kind]");
      if (filt) {
        if (filt.dataset.filterKind === "fighters") fighterFilter = filt.dataset.filter;
        if (filt.dataset.filterKind === "market") marketPane = filt.dataset.filter;
        refreshHub();
        return;
      }
      const detail = ev.target.closest("[data-detail]");
      if (detail) {
        settingsOpen = false;
        detailId = detail.dataset.detail;
        refreshHub();
        return;
      }
      const line = ev.target.closest("[data-line]");
      if (line && !line.disabled) { toggleLineup(line.dataset.line); return; }
      const tactic = ev.target.closest("[data-fid]");
      if (tactic) { cycleTactic(tactic.dataset.fid); return; }
      const hire = ev.target.closest("[data-hire]");
      if (hire) { hireFromMarket(+hire.dataset.hire); return; }
      const sell = ev.target.closest("[data-sell]");
      if (sell) { sellFighter(sell.dataset.sell); return; }
      const equip = ev.target.closest("[data-equip]");
      if (equip) { toggleEquip(equip.dataset.equip); return; }
      const train = ev.target.closest("[data-train]");
      if (train && !train.disabled) { trainFighter(train.dataset.train); return; }
      const salvage = ev.target.closest("[data-salvage]");
      if (salvage) { salvageItem(salvage.dataset.salvage); return; }
      const buy = ev.target.closest("[data-buy-gear]");
      if (buy) { buyGear(+buy.dataset.buyGear); return; }
      const buyRelic = ev.target.closest("[data-buy-relic]");
      if (buyRelic) { buyRelicStock(+buyRelic.dataset.buyRelic); return; }
      const sellRelic = ev.target.closest("[data-sell-relic]");
      if (sellRelic) { sellRelicId(sellRelic.dataset.sellRelic); return; }
      const deal = ev.target.closest("[data-deal]");
      if (deal) { takeDeal(+deal.dataset.deal); return; }
      const armEquip = ev.target.closest("[data-arm-equip]");
      if (armEquip) {
        tonicPick = null;
        gearPreview = { uid: armEquip.dataset.armEquip };
        showHub("fighters", true);
        return;
      }
      const armTonic = ev.target.closest("[data-arm-tonic]");
      if (armTonic) {
        gearPreview = null;
        tomePick = null;
        tonicPick = { uid: armTonic.dataset.armTonic };
        showHub("fighters", true);
        return;
      }
      const armTome = ev.target.closest("[data-arm-tome]");
      if (armTome) {
        gearPreview = null;
        tonicPick = null;
        tomePick = { uid: armTome.dataset.armTome };
        showHub("fighters");
        return;
      }
      const studyOn = ev.target.closest("[data-study-on]");
      if (studyOn) {
        const found = findItem(studyOn.dataset.studyItem);
        if (found && studyTome(fighterById(studyOn.dataset.studyOn), found.item)) persist();
        showHub("fighters");
        return;
      }
      const giveOn = ev.target.closest("[data-give-on]");
      if (giveOn) {
        const found = findItem(giveOn.dataset.giveItem);
        if (found && giveTonic(fighterById(giveOn.dataset.giveOn), found.item)) persist();
        showHub("fighters", true);
        return;
      }
      const armOn = ev.target.closest("[data-arm-on]");
      if (armOn) {
        gearPreview = { uid: armOn.dataset.armItem };
        detailId = armOn.dataset.armOn;
        showHub("fighters", true);
        return;
      }
      const unequipFrom = ev.target.closest("[data-unequip-from]");
      if (unequipFrom) {
        unequipSlot(fighterById(unequipFrom.dataset.unequipFrom), unequipFrom.dataset.unequipSlot);
        persist();
        refreshHub();
      }
    };
    bindArmory();
    bindSheet();
    const reroll = document.getElementById("rerollGear");
    if (reroll) reroll.onclick = rerollGear;
    const refreshRelics = document.getElementById("refreshRelics");
    if (refreshRelics) refreshRelics.onclick = refreshRelicStall;
    const rerollDealsBtn = document.getElementById("rerollDeals");
    if (rerollDealsBtn) rerollDealsBtn.onclick = rerollDeals;
  }

  function bindArmory() {
    const slot = document.getElementById("filterSlot");
    const rarity = document.getElementById("filterRarity");
    const sort = document.getElementById("sortGear");
    if (slot) slot.onchange = function () { armorySlot = slot.value; showHub("fighters", true); };
    if (rarity) rarity.onchange = function () { armoryRarity = rarity.value; showHub("fighters", true); };
    if (sort) sort.onchange = function () { armorySort = sort.value; showHub("fighters", true); };
  }

  function bindSheet() {
    const back = document.getElementById("sheetBack");
    if (back) back.onclick = closeSheet;
    const closeBtn = document.getElementById("sheetClose");
    if (closeBtn) closeBtn.onclick = closeSheet;
    const form = document.getElementById("renameForm");
    if (form) form.onsubmit = function (ev) {
      ev.preventDefault();
      const input = document.getElementById("renameInput");
      const name = ((input && input.value) || "").trim().slice(0, 22);
      const err = document.getElementById("renameError");
      if (!name) {
        if (err) err.hidden = false;
        return;
      }
      const f = fighterById(detailId);
      if (!f) return;
      f.name = name;
      persist();
      refreshHub();
    };
    const cap = document.getElementById("setCaptain");
    if (cap) cap.onclick = function () { setCaptain(detailId); };
    const line = document.getElementById("sheetLine");
    if (line && !line.disabled) line.onclick = function () { toggleLineup(detailId); };
    const ask = document.getElementById("releaseAsk");
    const box = document.getElementById("releaseBox");
    if (ask && box) ask.onclick = function () { box.hidden = false; ask.hidden = true; };
    const no = document.getElementById("releaseNo");
    if (no && box && ask) no.onclick = function () { box.hidden = true; ask.hidden = false; };
    const yes = document.getElementById("releaseYes");
    if (yes) yes.onclick = function () { releaseFighter(detailId); };
    const train = document.getElementById("trainBtn");
    if (train && !train.disabled) train.onclick = function () { trainFighter(detailId); };
    const sheet = document.getElementById("fighterSheet");
    if (sheet) sheet.onclick = function (ev) {
      const tactic = ev.target.closest("[data-tactic]");
      if (tactic) { setTactic(detailId, tactic.dataset.tactic); return; }
      const preview = ev.target.closest("[data-preview-item]");
      if (preview) {
        gearPreview = { uid: preview.dataset.previewItem };
        refreshHub();
        return;
      }
      const drink = ev.target.closest("[data-tonic]");
      if (drink) {
        const found = findItem(drink.dataset.tonic);
        if (found && giveTonic(fighterById(detailId), found.item)) {
          persist();
          refreshHub();
        }
        return;
      }
      const slotPick = ev.target.closest("[data-slot]");
      if (slotPick && !ev.target.closest("[data-fill]")) {
        loadoutSlot = +slotPick.dataset.slot;
        showHub(hubTab);
        return;
      }
      const fill = ev.target.closest("[data-fill]");
      if (fill) {
        const fighter = fighterById(detailId);
        if (fighter && IL.equipMove && IL.equipMove(fighter, loadoutSlot, fill.dataset.fill)) {
          persist();
          showHub(hubTab);
        }
        return;
      }
      const study = ev.target.closest("[data-study]");
      if (study) {
        const found = findItem(study.dataset.study);
        if (found && studyTome(fighterById(detailId), found.item)) {
          persist();
          showHub(hubTab);
        }
        return;
      }
      const pour = ev.target.closest("[data-tonic-drop]");
      if (pour) {
        if (dropTonic(fighterById(detailId))) {
          persist();
          refreshHub();
        }
        return;
      }
      const drop = ev.target.closest("[data-unequip-slot]");
      if (drop) {
        unequipSlot(fighterById(detailId), drop.dataset.unequipSlot);
        gearPreview = null;
        persist();
        refreshHub();
      }
    };
    const confirm = document.getElementById("confirmEquip");
    if (confirm) confirm.onclick = function () {
      const f = fighterById(detailId);
      const found = gearPreview && findItem(gearPreview.uid);
      if (f && found && equipItem(f, found.item)) {
        gearPreview = null;
        persist();
        refreshHub();
      }
    };
    const cancel = document.getElementById("cancelEquip");
    if (cancel) cancel.onclick = function () {
      gearPreview = null;
      refreshHub();
    };
  }

  function closeSheet() {
    if (!detailId && !gearPreview) return;
    detailId = null;
    gearPreview = null;
    tonicPick = null;
    refreshHub();
  }

  function trainFighter(id) {
    const f = fighterById(id);
    if (!f || inThePit(f)) return;
    const cost = IL.TRAIN_COST || 16;
    if ((save.trainsLeft || 0) <= 0 || save.gold < cost) return;
    save.gold -= cost;
    save.trainsLeft -= 1;
    save.trainsDone = (save.trainsDone || 0) + 1;
    IL.grantXp(f, IL.TRAIN_XP || 12);
    persist();
    refreshHub();
  }

  function salvageItem(uid) {
    const found = findItem(uid);
    if (!found || found.owner) return;
    pitSound("sell");
    save.gold += IL.salvageValue(found.item);
    save.salvaged = (save.salvaged || 0) + 1;
    save.items = (save.items || []).filter(function (it) { return it.uid !== uid; });
    if (gearPreview && gearPreview.uid === uid) gearPreview = null;
    persist();
    refreshHub();
  }

  function buyGear(index) {
    const row = (save.gearStock || [])[index];
    if (!row || save.gold < row.cost) { pitSound("error"); return; }
    save.gold -= row.cost;
    pitSound("purchase");
    if (!Array.isArray(save.items)) save.items = [];
    save.items.push(row.item);
    save.gearStock.splice(index, 1);
    persist();
    showHub("market", true);
  }

  function rerollGear() {
    const cost = IL.GEAR_REROLL || 20;
    if (save.gold < cost) { pitSound("error"); return; }
    save.gold -= cost;
    pitSound("purchase");
    save.gearStock = IL.rollGearStock(takeRng());
    persist();
    showHub("market", true);
  }

  function refreshRelicStall() {
    if (save.gold < IL.REFRESH_COST) { pitSound("error"); return; }
    save.gold -= IL.REFRESH_COST;
    pitSound("purchase");
    save.relicStock = IL.rollRelicStock(takeRng());
    persist();
    showHub("market", true);
  }

  function rerollDeals() {
    const cost = IL.DEAL_REROLL || 40;
    if (save.gold < cost) { pitSound("error"); return; }
    save.gold -= cost;
    pitSound("purchase");
    const week = save.deals && typeof save.deals.week === "number" ? save.deals.week : IL.weekIndex(Date.now());
    save.deals = IL.rollDeals(takeRng(), save.renown || 0, week);
    persist();
    showHub("market", true);
  }

  function buyRelicStock(index) {
    const row = (save.relicStock || [])[index];
    if (!row || row.stock < 1) { pitSound("error"); return; }
    if ((save.relics || []).indexOf(row.id) >= 0 || save.gold < row.cost) { pitSound("error"); return; }
    save.gold -= row.cost;
    pitSound("purchase");
    if (!Array.isArray(save.relics)) save.relics = [];
    save.relics.push(row.id);
    row.stock = 0;
    persist();
    showHub("market", true);
  }

  function sellRelicId(id) {
    if (!id || (save.relics || []).indexOf(id) < 0) return;
    pitSound("sell");
    save.gold += IL.relicSellPrice(id);
    save.relics = save.relics.filter(function (rid) { return rid !== id; });
    save.equipped = (save.equipped || []).filter(function (rid) { return rid !== id; });
    persist();
    showHub("market", true);
  }

  function takeDeal(index) {
    const offer = save.deals && save.deals.offers && save.deals.offers[index];
    if (!offer || offer.stock < 1 || save.gold < offer.cost) { pitSound("error"); return; }
    if (offer.kind === "fighter") {
      if (save.roster.length >= IL.ROSTER_CAP) { pitSound("error"); return; }
      const fighter = offer.fighter;
      IL.hero.compose(fighter.parts).then(function () {
        save.gold -= offer.cost;
        pitSound("purchase");
        save.hires = (save.hires || 0) + 1;
        if (!Array.isArray(save.seenClasses)) save.seenClasses = [];
        if (fighter.cls && save.seenClasses.indexOf(fighter.cls) < 0) save.seenClasses.push(fighter.cls);
        save.roster.push(fighter);
        offer.stock = 0;
        persist();
        showHub("market", true);
      }).catch(function () { showHub("market", true); });
      return;
    }
    if (offer.kind === "bundle") {
      const ids = offer.relics || [];
      if (ids.every(function (id) { return (save.relics || []).indexOf(id) >= 0; })) { pitSound("error"); return; }
      save.gold -= offer.cost;
      pitSound("purchase");
      if (!Array.isArray(save.relics)) save.relics = [];
      ids.forEach(function (id) { if (save.relics.indexOf(id) < 0) save.relics.push(id); });
      offer.stock = 0;
      persist();
      showHub("market", true);
      return;
    }
    if (offer.kind === "chest") {
      const prize = IL.openChest(takeRng(), save.relics || []);
      save.gold -= offer.cost;
      save.gold += prize.gold || 0;
      pitSound("purchase");
      if (prize.relic) {
        if (!Array.isArray(save.relics)) save.relics = [];
        if (save.relics.indexOf(prize.relic) < 0) save.relics.push(prize.relic);
      }
      if (prize.item) {
        if (!Array.isArray(save.items)) save.items = [];
        save.items.push(prize.item);
      }
      offer.stock = 0;
      offer.opened = {
        gold: prize.gold || 0,
        relic: prize.relic || "",
        itemName: prize.item && IL.itemName ? IL.itemName(prize.item) : ""
      };
      persist();
      showHub("market", true);
    }
  }

  function setTactic(id, tactic) {
    const f = fighterById(id);
    if (!f) return;
    const order = IL.TACTICS || [];
    if (order.indexOf(tactic) < 0) return;
    f.tactic = tactic;
    persist();
    refreshHub();
  }

  function cycleTactic(id) {
    const f = fighterById(id);
    if (!f) return;
    const order = IL.TACTICS;
    const i = order.indexOf(f.tactic);
    f.tactic = order[(i + 1) % order.length] || "strike";
    persist();
    refreshHub();
  }

  function setCaptain(id) {
    const f = fighterById(id);
    if (!f || f.captain) return;
    save.roster.forEach(function (r) { r.captain = r.id === id; });
    persist();
    refreshHub();
  }

  function releaseFighter(id) {
    const f = fighterById(id);
    if (!f || f.captain) return;
    returnGear(f);
    save.roster = save.roster.filter(function (r) { return r !== f; });
    save.lineup = (save.lineup || []).filter(function (fid) { return fid !== f.id; });
    detailId = null;
    gearPreview = null;
    persist();
    refreshHub();
  }

  function toggleEquip(id) {
    if ((save.relics || []).indexOf(id) < 0) return;
    const eq = save.equipped || (save.equipped = []);
    const at = eq.indexOf(id);
    if (at >= 0) eq.splice(at, 1);
    else if (eq.length < 2) eq.push(id);
    else eq.splice(0, 1, id);
    persist();
    showHub("relics", true);
  }

  /* Club yard. Time Elements chibis, precomposited in assets/yard/. */
  let yardImg = null;
  let yardMeta = null;
  let yardPeople = [];
  let yardStamp = -1;

  function ensureYard() {
    if (yardMeta) return;
    yardMeta = { loading: true };
    fetch("assets/yard/atlas.json").then(function (res) {
      if (!res.ok) throw new Error("yard atlas");
      return res.json();
    }).then(function (meta) {
      const img = new Image();
      img.onload = function () {
        yardImg = img;
        yardMeta = meta;
      };
      img.onerror = function () { yardMeta = { failed: true }; };
      img.src = meta.image || "assets/yard/atlas.png";
    }).catch(function () { yardMeta = { failed: true }; });
  }

  function yardLookName(f) {
    const cls = f.cls || "warrior";
    let family = "sword";
    if (cls === "archer" || cls === "ranger" || cls === "skirmisher" || cls === "gunslinger") family = "bow";
    else if (cls === "mage" || cls === "healer" || cls === "battlemage" || cls === "elementalist" || cls === "necromancer" || cls === "warlock" || cls === "summoner" || cls === "alchemist" || cls === "bard" || cls === "druid") family = "wand";
    else if (cls === "lancer" || cls === "spearmaiden") family = "spear";
    else if (cls === "berserker" || cls === "beastmaster") family = "axe";
    else if (cls === "tank" || cls === "shieldbearer" || cls === "paladin") family = "shield";
    return family + "-" + (IL.hashStr(f.id || cls) % 2);
  }

  function yardKoId(roster) {
    const last = save.history && save.history[0];
    if (!last || last.win !== false || !roster.length) return null;
    let best = roster[0];
    let bestTaken = (best.season && best.season.taken) || 0;
    for (let i = 1; i < roster.length; i++) {
      const f = roster[i];
      const taken = (f.season && f.season.taken) || 0;
      if (taken > bestTaken || (taken === bestTaken && IL.hashStr(f.id) < IL.hashStr(best.id))) {
        best = f;
        bestTaken = taken;
      }
    }
    return best.id;
  }

  function paintYard(ctx, w, h) {
    ctx.fillStyle = "#1a120e";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#2c1e16";
    ctx.fillRect(0, 0, w, 36);
    ctx.fillStyle = "#3d2a1c";
    for (let x = 2; x < w; x += 22) {
      ctx.fillRect(x, 6, 18, 10);
      ctx.fillRect(x + 10, 20, 18, 10);
    }
    ctx.fillStyle = "#120c0a";
    ctx.fillRect(0, 34, w, 4);
    for (let y = 40; y < h; y += 8) {
      ctx.fillStyle = ((y / 8) & 1) ? "#4a3422" : "#3e2c1c";
      ctx.fillRect(0, y, w, 7);
      ctx.fillStyle = "#2a1c12";
      ctx.fillRect(0, y + 7, w, 1);
    }
    ctx.fillStyle = "#24160f";
    for (let x = 4; x < w; x += 32) ctx.fillRect(x, 40, 1, h - 40);
    ctx.fillStyle = "#6a4a28";
    ctx.fillRect(8, h - 38, 22, 16);
    ctx.fillStyle = "#8a6234";
    ctx.fillRect(10, h - 36, 18, 4);
    ctx.fillStyle = "#3a2818";
    ctx.fillRect(8, h - 24, 22, 3);
    const post = w - 36;
    const foot = h - 16;
    ctx.fillStyle = "#5c3e24";
    ctx.fillRect(post, foot - 52, 6, 52);
    ctx.fillStyle = "#c4a060";
    ctx.fillRect(post - 12, foot - 46, 30, 20);
    ctx.fillStyle = "#8a3030";
    ctx.fillRect(post - 4, foot - 40, 14, 8);
    ctx.fillStyle = "#3a2414";
    ctx.fillRect(post - 10, foot - 2, 26, 4);
  }

  function syncYard(canvas) {
    if (!yardImg || !yardMeta || !yardMeta.looks) return false;
    if (yardStamp === token) return true;
    yardStamp = token;
    const roster = (save.roster || []).slice();
    const koId = yardKoId(roster);
    const archers = [];
    const melee = [];
    roster.forEach(function (f) {
      if (f.id === koId) return;
      if (yardLookName(f).indexOf("bow") === 0) archers.push(f);
      else melee.push(f);
    });
    const spar = melee.length >= 2 ? melee.slice(0, 2) : [];
    const sparIds = {};
    spar.forEach(function (f) { sparIds[f.id] = true; });
    const w = canvas.width;
    const h = canvas.height;
    const foot = h - 16;
    const people = [];
    const walkers = melee.filter(function (f) { return !sparIds[f.id]; });
    const rival = nextRival();
    const keys = Object.keys(yardMeta.visitors || {});
    let nVis = 0;
    if (rival && save.round < 5 && keys.length) {
      nVis = Math.min(keys.length, koId ? 1 : (walkers.length ? 2 : 3));
    }
    let cursor = koId ? 100 : 28;
    if (koId) {
      const f = roster.filter(function (r) { return r.id === koId; })[0];
      people.push({ id: f.id, look: yardLookName(f), mode: "ko", dir: -1, x: 58, y: foot, phase: 0, speed: 0 });
    }
    for (let i = 0; i < nVis; i++) {
      const x = cursor + 30;
      people.push({
        id: null, look: keys[i], visitor: true, mode: "visit", dir: i % 2 ? -1 : 1,
        x: x, y: foot, phase: i * 0.3, speed: 12, lo: x - 8, hi: x + 8
      });
      cursor += 68;
    }
    const sparLeft = Math.max(cursor + 44, 188);
    if (spar.length === 2) {
      people.push({ id: spar[0].id, look: yardLookName(spar[0]), mode: "spar", dir: 1, x: sparLeft, y: foot, phase: 0, speed: 0 });
      people.push({ id: spar[1].id, look: yardLookName(spar[1]), mode: "spar", dir: -1, x: sparLeft + 74, y: foot, phase: 0.45, speed: 0 });
      cursor = sparLeft + 74;
    }
    const archerXs = archers.map(function (f, i) { return w - 84 - i * 48; });
    const rightLimit = archerXs.length ? Math.min.apply(null, archerXs) - 44 : w - 70;
    const leftLimit = cursor + 42;
    walkers.forEach(function (f, i) {
      const n = IL.hashStr(f.id || "walk");
      const span = Math.max(16, rightLimit - leftLimit);
      const x = leftLimit + (n % span);
      people.push({
        id: f.id, look: yardLookName(f), mode: "walk",
        dir: (n & 1) ? 1 : -1,
        x: Math.min(x, rightLimit),
        y: foot - i * 2,
        phase: (n % 10) / 10,
        speed: 14 + (n % 8),
        lo: leftLimit,
        hi: Math.max(leftLimit + 16, rightLimit)
      });
    });
    archers.forEach(function (f, i) {
      people.push({
        id: f.id, look: yardLookName(f), mode: "bow", dir: 1,
        x: archerXs[i], y: foot, phase: i * 0.35, speed: 0
      });
    });
    yardPeople = people;
    return true;
  }

  function yardBook(actor) {
    if (!yardMeta) return null;
    if (actor.visitor) return yardMeta.visitors && yardMeta.visitors[actor.look];
    return (yardMeta.looks && (yardMeta.looks[actor.look] || yardMeta.looks["sword-0"])) || null;
  }

  function yardFrame(actor, t) {
    const book = yardBook(actor);
    if (!book) return 0;
    let key = actor.dir < 0 ? "walkW" : "walkE";
    let fps = 6;
    if (actor.mode === "ko") key = actor.dir < 0 ? "koW" : "koE";
    else if (actor.mode === "spar") { key = actor.dir < 0 ? "atkW" : "atkE"; fps = 8; }
    else if (actor.mode === "bow") { key = actor.dir < 0 ? "bowW" : "bowE"; fps = 5; }
    else if (actor.visitor) key = actor.dir < 0 ? "walkW" : "walkE";
    const frames = book[key] || book.walkE || book.walkW || [0];
    if (actor.mode === "ko") return frames[0];
    return frames[Math.floor(t * fps + actor.phase * frames.length) % frames.length];
  }

  function stepYard(actor, dt, w) {
    if (actor.mode !== "walk" && actor.mode !== "visit") return;
    const lo = actor.lo != null ? actor.lo : 36;
    const hi = actor.hi != null ? actor.hi : w - 36;
    actor.x += actor.dir * actor.speed * dt;
    if (actor.x < lo) { actor.x = lo; actor.dir = 1; }
    if (actor.x > hi) { actor.x = hi; actor.dir = -1; }
  }

  function onYardClick(ev) {
    const canvas = ev.currentTarget;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = (ev.clientX - rect.left) * (canvas.width / rect.width);
    const y = (ev.clientY - rect.top) * (canvas.height / rect.height);
    const list = (IL.yardActors || []).slice().sort(function (a, b) { return b.y - a.y; });
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (!a.id) continue;
      if (Math.abs(x - a.x) <= 32 && y <= a.y + 10 && y >= a.y - 68) {
        detailId = a.id;
        pitSound("click");
        showHub(hubTab);
        return;
      }
    }
  }

  function drawYard(canvas, dt, t) {
    if (!canvas.isConnected) return;
    if (canvas.dataset.bound !== "1") {
      canvas.dataset.bound = "1";
      canvas.addEventListener("click", onYardClick);
    }
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    paintYard(ctx, canvas.width, canvas.height);
    if (!syncYard(canvas)) return;
    const fw = yardMeta.fw || 48;
    const fh = yardMeta.fh || 48;
    const cols = yardMeta.cols || 22;
    const scale = 2;
    const drawList = yardPeople.slice().sort(function (a, b) { return a.y - b.y; });
    for (let i = 0; i < drawList.length; i++) {
      const actor = drawList[i];
      stepYard(actor, dt, canvas.width);
      const frame = yardFrame(actor, t);
      const col = frame % cols;
      const row = (frame / cols) | 0;
      const dw = fw * scale;
      const dh = fh * scale;
      ctx.drawImage(
        yardImg,
        col * fw, row * fh, fw, fh,
        Math.round(actor.x - dw / 2), Math.round(actor.y - 32 * scale), dw, dh
      );
    }
    const rank = { bow: 0, spar: 1, ko: 2, walk: 3, visit: 4 };
    IL.yardActors = yardPeople.filter(function (a) { return a.id; }).slice().sort(function (a, b) {
      const ar = rank[a.mode];
      const br = rank[b.mode];
      return (ar == null ? 9 : ar) - (br == null ? 9 : br);
    }).map(function (a) {
      return { id: a.id, x: Math.round(a.x), y: Math.round(a.y) };
    });
    if (IL.yardActors.length) canvas.dataset.ready = "1";
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
        const scale = Number(c.dataset.scale || 3);
        const foot = c.dataset.foot != null && c.dataset.foot !== "" ? Number(c.dataset.foot) : 10;
        IL.hero.draw(ctx, atlas, IL.frameIndex(clip, t + i * 0.2), c.width / 2, c.height - foot, scale, 1, c.dataset.cls || "", null, c.dataset.kind || "");
      }
      const yard = document.getElementById("clubYard");
      if (yard) drawYard(yard, dt, t);
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
  }

  function hireFromMarket(index) {
    const row = save.market[index];
    if (!row || row.locked) { pitSound("error"); return; }
    if (save.gold < row.cost || save.roster.length >= IL.ROSTER_CAP) { pitSound("error"); return; }
    const fighter = row.fighter;
    IL.hero.compose(fighter.parts).then(function () {
      save.gold -= row.cost;
      pitSound("purchase");
      save.hires = (save.hires || 0) + 1;
      if (!Array.isArray(save.seenClasses)) save.seenClasses = [];
      if (fighter.cls && save.seenClasses.indexOf(fighter.cls) < 0) save.seenClasses.push(fighter.cls);
      save.roster.push(fighter);
      save.market.splice(index, 1);
      if (!save.market.length) save.market = IL.rollMarket(takeRng(), save.renown || 0);
      persist();
      showHub("market", true);
    }).catch(function () { showHub("market", true); });
  }

  function sellFighter(id) {
    const f = save.roster.filter(function (r) { return r.id === id && !r.captain; })[0];
    if (!f) return;
    pitSound("sell");
    save.gold += IL.sellValue(f);
    returnGear(f);
    save.roster = save.roster.filter(function (r) { return r !== f; });
    save.lineup = (save.lineup || []).filter(function (fid) { return fid !== f.id; });
    if (detailId === f.id) detailId = null;
    persist();
    showHub("market", true);
  }


  function showGrowth() {
    stopLoops();
    const queue = pendingGrowth();
    if (!queue.length) { showHub(); return; }
    hubBed();
    pitSound("level");
    const f = queue[0];
    const choices = IL.boostChoices(f);
    const buttons = choices.map(function (key) {
      const copy = (IL.PERK_COPY && IL.PERK_COPY[key]) || { name: IL.BOOST_LABEL[key] || key, blurb: "One step, kept on this fighter." };
      return '<button type="button" class="class-card" data-boost="' + key + '"><strong>' + esc(copy.name) + '</strong><span>' + esc(copy.blurb) + '</span></button>';
    }).join("");
    app.innerHTML =
      '<main class="creator" id="growth">' +
        '<header class="creator-head"><h2>A perk for ' + esc(f.name) + '</h2></header>' +
        '<p class="banner">Level ' + f.level + '. ' + f.pendingPicks + ' choice' + (f.pendingPicks === 1 ? "" : "s") + ' waiting. Pick one of three.</p>' +
        '<div class="class-grid" id="growthChoices">' + buttons + '</div>' +
        '<footer class="growth-actions"><button type="button" class="btn ghost" id="backHub">Back to club</button></footer>' +
      '</main>';
    document.getElementById("backHub").onclick = function () { showHub(); };
    document.getElementById("growthChoices").onclick = function (ev) {
      const btn = ev.target.closest("[data-boost]");
      if (!btn) return;
      IL.applyBoost(f, btn.dataset.boost);
      persist();
      if (pendingGrowth().length) showGrowth();
      else if (pendingMoveFighters().length) showMoves();
      else if ((save.round || 0) >= 5) showSeasonEnd();
      else showHub();
    };
  }

  function showMoves() {
    stopLoops();
    const queue = pendingMoveFighters();
    if (!queue.length) { showHub(); return; }
    hubBed();
    const f = queue[0];
    if (IL.ensureMoves) IL.ensureMoves(f);
    const choices = IL.moveChoices ? IL.moveChoices(f) : [];
    if (!choices.length) {
      f.pendingMoves = 0;
      persist();
      if (pendingMoveFighters().length) showMoves();
      else showHub();
      return;
    }
    const buttons = choices.map(function (ab) {
      const meta = moveMeta(ab, f.level || 1, f.learned);
      return '<button type="button" class="class-card" data-move="' + esc(ab.id) + '"><strong>' + esc(ab.name) + '</strong><span>' + esc(meta.line) + '</span><span>' + esc(ab.blurb || abilityBlurb(ab.id)) + '</span></button>';
    }).join("");
    app.innerHTML =
      '<main class="creator" id="moveGrowth">' +
        '<header class="creator-head"><h2>A move for ' + esc(f.name) + '</h2></header>' +
        '<p class="banner">Level ' + (f.level || 1) + '. ' + f.pendingMoves + ' move' + (f.pendingMoves === 1 ? "" : "s") + ' waiting. Equip it on the sheet.</p>' +
        '<div class="class-grid" id="moveChoices">' + buttons + '</div>' +
        '<footer class="growth-actions"><button type="button" class="btn ghost" id="backHub">Back to club</button></footer>' +
      '</main>';
    document.getElementById("backHub").onclick = function () { showHub(); };
    document.getElementById("moveChoices").onclick = function (ev) {
      const btn = ev.target.closest("[data-move]");
      if (!btn) return;
      IL.learnFromLevel(f, btn.dataset.move);
      persist();
      if (pendingMoveFighters().length) showMoves();
      else if ((save.round || 0) >= 5) showSeasonEnd();
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
      syncMix();
      if (IL.sfx && IL.sfx.bed) {
        if (IL.sfx.unlock) IL.sfx.unlock();
        IL.sfx.bed(fightBed(spec));
        if (IL.sfx.crowdBed) IL.sfx.crowdBed(true);
      }
      const tok = token;
      const savedSpeed = save && save.settings && save.settings.speed;
      speed = savedSpeed === 2 || savedSpeed === 3 ? savedSpeed : 1;
      paused = false;
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
    openVersus({
      mode: "league",
      left: left,
      right: right,
      leftName: save.clubName,
      rightName: rival.name,
      rival: rival,
      size: size,
      seed: (save.rngSeed ^ (save.season * 997) ^ ((save.round + 1) * 131)) >>> 0,
      returnTab: "club"
    });
  }

  function startCupFight() {
    const cup = save.cup;
    const opp = cup && IL.cupOpponent(cup);
    if (!opp) return;
    const left = fielded(save.roster, cup.size);
    if (left.length < cup.size) return;
    openVersus({
      mode: "cup",
      left: left,
      right: opp.foe.fighters.slice(0, cup.size),
      leftName: save.clubName,
      rightName: opp.foe.name,
      size: cup.size,
      seed: (save.rngSeed ^ (save.season * 811) ^ ((cup.round + 1) * 17)) >>> 0,
      returnTab: "cup"
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
        '<div class="hud-strip" id="liveYou"></div>' +
        '<div class="fight-layout">' +
          '<div class="stage"><canvas id="arena" width="1440" height="900"></canvas><div id="result" class="result" hidden></div></div>' +
        '</div>' +
        '<div class="hud-strip" id="liveThem"></div>' +
        '<footer class="fight-controls">' +
          speedButtons() +
          '<button type="button" class="btn ghost" id="pause">Pause</button>' +
          '<button type="button" class="btn primary" id="skip">Skip</button>' +
        '</footer>' +
      '</main>';
    document.getElementById("leftName").innerHTML = crestHtml(match.leftName, "sm", save.crest) + '<span class="club-name">' + esc(match.leftName) + '</span>';
    const rightLabel = (match.teams || 2) > 2
      ? (match.names || []).slice(1).join(" · ")
      : match.rightName;
    const rightCrest = (match.teams || 2) > 2 ? "" : crestHtml(rightLabel, "sm", crestIndexOf(rightLabel));
    document.getElementById("rightName").innerHTML = rightCrest + '<span class="club-name">' + esc(rightLabel) + '</span>';
    [1, 2, 3].forEach(function (n) {
      const btn = document.getElementById("speed" + n);
      if (btn) btn.onclick = function () { setFightSpeed(n); };
    });
    document.getElementById("pause").onclick = togglePause;
    document.getElementById("skip").onclick = function () { skipFight(); };
    const youRows = [];
    const themRows = [];
    match.units.forEach(function (u, i) {
      if (u.summon) return;
      const kit = IL.CLASSES[u.cls] || IL.CLASSES.warrior;
      const side = u.team === 0 ? "you" : "them";
      const byLive = {};
      (kit.abilities || []).forEach(function (ab) { if (ab && ab.id) byLive[ab.id] = ab; });
      const learned = u.learned || [];
      const marks = (u.loadout || []).map(function (id) { return byLive[id]; }).filter(function (ab) {
        if (!ab) return false;
        if (learned.indexOf(ab.id) >= 0) return true;
        return (ab.unlock || 1) <= (u.level || 1);
      }).map(function (ab) {
        return IL.abilityIcon ? iconTag(IL.abilityIcon(ab.id), 32) : "";
      }).join("");
      const row = '<div class="live ' + side + '" data-i="' + i + '"><b>' + esc(u.name) + marks + '</b><span class="hp-num"></span><small>' + esc(kit.name) + '</small><div class="track"><div class="fill"></div></div></div>';
      (u.team === 0 ? youRows : themRows).push(row);
    });
    document.getElementById("liveYou").innerHTML = '<p class="eyebrow">Your side</p>' + youRows.join("");
    document.getElementById("liveThem").innerHTML = '<p class="eyebrow">Their side</p>' + themRows.join("");
  }

  function speedButtons() {
    return [1, 2, 3].map(function (n) {
      return '<button type="button" class="btn ghost' + (speed === n ? " on" : "") + '" id="speed' + n + '">' + n + '×</button>';
    }).join("");
  }

  function setFightSpeed(n) {
    speed = n;
    if (!save.settings) save.settings = { speed: n, shake: true, sound: 80, music: 60, crowd: 70 };
    save.settings.speed = n;
    persist();
    markSpeed();
  }

  function togglePause() {
    paused = !paused;
    const btn = document.getElementById("pause");
    if (!btn) return;
    btn.textContent = paused ? "Resume" : "Pause";
    btn.classList.toggle("on", paused);
  }

  function markSpeed() {
    [1, 2, 3].forEach(function (n) {
      const el = document.getElementById("speed" + n);
      if (el) el.classList.toggle("on", speed === n);
    });
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
      if (!match.over && !paused) {
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
        if (typeof e.n === "number" && shakeOn()) fx.shake = Math.min(7, fx.shake + (e.blocked ? 1.5 : 3.2));
      } else if (e.type === "heal") {
        fx.nums.push({ x: e.x, y: e.y, n: e.n, heal: true, t: 0, life: 0.7 });
      } else if (e.type === "dodge") {
        fx.nums.push({ x: e.x, y: e.y, dodge: true, t: 0, life: 0.45 });
      } else if (e.type === "boom") {
        fx.booms.push({ x: e.x, y: e.y, r: e.r, kind: e.kind, t: 0, life: 0.48 });
        if (shakeOn()) fx.shake = Math.min(8, fx.shake + 4);
      } else if (e.type === "cue" && e.id) {
        if (IL.sfx) {
          syncMix();
          IL.sfx.play(e.id, { gain: e.gain, layer: e.layer });
        }
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
    if (!shakeOn()) fx.shake = 0;
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
    const rows = document.querySelectorAll(".fight-screen .live");
    for (let i = 0; i < rows.length; i++) {
      const u = match.units[+rows[i].dataset.i];
      if (!u) continue;
      const fill = rows[i].querySelector(".fill");
      if (fill) fill.style.width = Math.max(0, u.hp / u.maxHp * 100) + "%";
      const num = rows[i].querySelector(".hp-num");
      if (num) num.textContent = Math.max(0, Math.round(u.hp)) + "/" + Math.round(u.maxHp);
    }
  }

  function shakeOn() {
    return !save || !save.settings || save.settings.shake !== false;
  }

  function skipFight() {
    if (!fight || fight.match.over) return;
    paused = false;
    const match = fight.match;
    let n = 0;
    while (!match.over && n < 4000) {
      IL.stepMatch(match, 1 / 60);
      match.events.length = 0;
      n++;
    }
    finishFight();
  }

  function resultFace(u) {
    const kit = IL.CLASSES[u.cls] || IL.CLASSES.warrior;
    if (!u.parts || !IL.hero || !IL.hero.keyOf) return "";
    return portraitWrap(
      'width="48" height="40" data-key="' + esc(IL.hero.keyOf(u.parts)) +
      '" data-anim="' + esc(kit.idle || "idle") + '" data-scale="1" data-foot="4"',
      false,
      u
    );
  }

  function resultTable(match, xpBefore, lvBefore) {
    const yours = match.units.filter(function (u) { return u.team === 0; });
    let mvp = null;
    let best = -1;
    yours.forEach(function (u) {
      const score = (u.dmgDealt || 0) + (u.healing || 0) * 1.25 + (u.kos || 0) * 50;
      if (score > best) { best = score; mvp = u; }
    });
    function bits(u) {
      const prev = xpBefore[u.id] || 0;
      const f = fighterById(u.id);
      const now = f ? (f.xp || 0) : prev;
      const lv = f ? (f.level || 1) : (u.level || 1);
      const up = f && lv > (lvBefore[u.id] || u.level || 1);
      return {
        prev: prev,
        now: now,
        up: up,
        lv: lv,
        isMvp: !!(mvp && mvp.id === u.id)
      };
    }
    const rows = yours.map(function (u) {
      const b = bits(u);
      return '<tr' + (b.isMvp ? ' class="mvp"' : '') + '>' +
        '<td>' + esc(u.name) + (b.isMvp ? ' <em class="mvp-badge">MVP</em>' : '') +
          (b.up ? ' <em class="level-call">Level ' + b.lv + '</em>' : '') + '</td>' +
        '<td>' + (u.dmgDealt || 0) + '</td>' +
        '<td>' + (u.dmgTaken || 0) + '</td>' +
        '<td>' + (u.healing || 0) + '</td>' +
        '<td>' + (u.kos || 0) + '</td>' +
        '<td><div class="xp result-xp" data-xp-from="' + b.prev + '" data-xp-to="' + b.now + '"><div class="track"><div class="fill" style="width:' + Math.round(((b.prev % 40) / 40) * 100) + '%"></div></div></div></td>' +
      '</tr>';
    }).join("");
    const cards = yours.map(function (u) {
      const b = bits(u);
      return '<article class="result-row' + (b.isMvp ? " mvp" : "") + '">' +
        '<div class="result-who">' +
          resultFace(u) +
          '<span class="result-name">' + esc(u.name) + "</span>" +
          (b.isMvp ? '<em class="mvp-badge">MVP</em>' : "") +
          (b.up ? '<em class="level-call">Level ' + b.lv + "</em>" : "") +
        "</div>" +
        '<p class="result-chips">Dealt ' + (u.dmgDealt || 0) +
          " · Taken " + (u.dmgTaken || 0) +
          " · Heal " + (u.healing || 0) +
          " · KOs " + (u.kos || 0) + "</p>" +
        '<div class="xp result-xp" data-xp-from="' + b.prev + '" data-xp-to="' + b.now + '"><div class="track"><div class="fill" style="width:' + Math.round(((b.prev % 40) / 40) * 100) + '%"></div></div></div>' +
      "</article>";
    }).join("");
    return {
      mvp: mvp,
      html: '<div id="resultTable" class="result-board">' +
        '<table class="board result-grid"><thead><tr><th>Fighter</th><th>Dealt</th><th>Taken</th><th>Heal</th><th>KOs</th><th>XP</th></tr></thead><tbody>' +
        rows + "</tbody></table>" +
        '<div class="result-rows">' + cards + "</div></div>"
    };
  }

  function animateXpBars() {
    const bars = document.querySelectorAll("[data-xp-from]");
    const start = performance.now();
    function frame(now) {
      const t = Math.min(1, (now - start) / 800);
      for (let i = 0; i < bars.length; i++) {
        const el = bars[i];
        if (!el.isConnected) return;
        const from = +el.dataset.xpFrom;
        const to = +el.dataset.xpTo;
        const xp = from + (to - from) * t;
        const fill = el.querySelector(".fill");
        if (fill) fill.style.width = ((xp % 40) / 40 * 100) + "%";
      }
      if (t < 1) requestAnimationFrame(frame);
    }
    if (bars.length) requestAnimationFrame(frame);
  }

  function pushHistory(match, win, mvpName) {
    if (!Array.isArray(save.history)) save.history = [];
    let foe = 0;
    const teams = match.teams || 2;
    for (let t = 1; t < teams; t++) foe += match.kills[t] || 0;
    const opponent = teams > 2 ? "Chaos pit" : (match.rightName || "Rival");
    save.history.unshift({
      mode: (fight && fight.mode) || "league",
      opponent: opponent,
      score: (match.kills[0] || 0) + "–" + foe,
      win: !!win,
      mvp: mvpName || "—"
    });
    save.history = save.history.slice(0, 10);
  }

  function noteRecords(match, win) {
    const byId = {};
    (save.roster || []).forEach(function (f) { if (f && f.id) byId[f.id] = f; });
    match.units.forEach(function (u) {
      if (!u || u.team !== 0) return;
      const f = byId[u.id];
      if (!f) return;
      if (win) f.wins = (f.wins || 0) + 1;
      else f.losses = (f.losses || 0) + 1;
      f.kos = (f.kos || 0) + (u.kos || 0);
      if (!f.season) f.season = { dealt: 0, taken: 0, heal: 0, kos: 0 };
      f.season.dealt += u.dmgDealt || 0;
      f.season.taken += u.dmgTaken || 0;
      f.season.heal += u.healing || 0;
      f.season.kos += u.kos || 0;
    });
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
        save.cupsWon = (save.cupsWon || 0) + 1;
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
      if (win) save.chaosWins = (save.chaosWins || 0) + 1;
    } else {
      if (win) save.tokens = (save.tokens || 0) + 1;
      recordRound(win, pf, pa);
    }
    if (IL.equippedRelics(save).some(function (r) { return r.kind === "renown"; })) {
      renown = Math.round(renown * 1.25);
    }
    gold += match.stats.bounty || 0;
    noteRecords(match, win);
    save.bouts = (save.bouts || 0) + 1;
    if (win) {
      let taken = 0;
      match.units.forEach(function (u) { if (u.team === 0) taken += u.dmgTaken || 0; });
      if (taken <= 0) save.flawless = (save.flawless || 0) + 1;
    }
    const before = {};
    const xpBefore = {};
    fight.left.forEach(function (f) {
      if (!f) return;
      before[f.id] = f.level;
      xpBefore[f.id] = f.xp || 0;
      IL.grantXp(f, xp);
    });
    const tally = resultTable(match, xpBefore, before);
    pushHistory(match, win, tally.mvp ? tally.mvp.name : "");
    save.gold += gold;
    save.renown = (save.renown || 0) + renown;
    let loot = null;
    if (mode === "league" || mode === "chaos" || (mode === "cup" && win)) {
      const bag = mode === "cup" ? "cup" : (win ? "win" : "loss");
      loot = IL.rollLoot(takeRng(), bag);
      if (!Array.isArray(save.items)) save.items = [];
      save.items.push(loot);
    }
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
    box.classList.toggle("victory", win);
    box.classList.toggle("defeat", !win);
    box.innerHTML =
      '<div class="result-scroll">' +
        '<p class="eyebrow">' + (win ? "Victory" : "Defeat") + '</p>' +
        '<h2>' + headline + '</h2>' +
        tally.html +
        (ups.length ? '<p class="level-call">Level up: ' + esc(ups.join(", ")) + '</p>' : '') +
        (pendingGrowth().length ? '<p class="level-call">A perk is waiting.</p>' : '') +
        (loot ? lootRevealHtml(loot) : '') +
        '<ul class="payout" id="rewards">' +
          '<li>+' + gold + ' gold</li>' +
          '<li>+' + renown + ' renown</li>' +
          '<li>' + xp + ' xp for each fighter you sent</li>' +
          (relicNote ? '<li>' + esc(relicNote.trim()) + '</li>' : '') +
        '</ul>' +
        '<p>' + (stood.length ? "Still standing: " + esc(stood.join(", ")) + "." : "") +
          (fell.length ? (stood.length ? " " : "") + "Down: " + esc(fell.join(", ")) + "." : "") + '</p>' +
        '<p class="fine">' + esc(nextLine) + '</p>' +
      '</div>' +
      '<div class="result-actions">' +
        (pendingGrowth().length ? '<button type="button" class="btn gold" id="pickPerk">Choose a perk</button>' : '') +
        '<button type="button" class="btn primary" id="backHub">Back to club</button>' +
      '</div>';
    animateXpBars();
    if (IL.sfx && IL.sfx.crowdBed) IL.sfx.crowdBed(false);
    pitSound(win ? "victory" : "defeat");
    if (loot) pitSound("chest");
    const skip = document.getElementById("skip");
    if (skip) skip.disabled = true;
    const pickPerk = document.getElementById("pickPerk");
    if (pickPerk) pickPerk.onclick = function () {
      IL.currentMatch = null;
      showGrowth();
    };
    document.getElementById("backHub").onclick = function () {
      IL.currentMatch = null;
      if (mode === "league" && save.round >= 5) showSeasonEnd();
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
    save.trainsLeft = IL.TRAIN_CAP || 2;
    save.trainRound = save.round;
    if (IL.rollGearStock) save.gearStock = IL.rollGearStock(takeRng());
  }

  function lootRevealHtml(item) {
    const rarity = item.rarity || "common";
    const chest = IL.lootFrame ? IL.lootFrame("chest", rarity) : "";
    const bag = IL.lootFrame ? IL.lootFrame("bag", rarity) : "";
    return '<div id="lootReveal" class="loot-reveal rarity-' + esc(rarity) + '">' +
      '<div class="loot-faces">' + iconTag(chest, 48) + iconTag(bag, 48) + itemFaceHtml(item) + '</div>' +
      '<div><p class="eyebrow">Found</p><h3>' + esc(IL.itemName(item)) + '</h3>' +
      '<p>' + esc(rarityLabel(item.rarity)) + " · " + esc(slotLabel(IL.itemSlot(item))) + " · " + esc(bonusLine(item)) + '</p></div></div>';
  }

  function onHubKey(ev) {
    const tag = ev.target && ev.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || ev.metaKey || ev.ctrlKey || ev.altKey) return;
    const backHub = document.getElementById("backHub");
    const resultBox = document.getElementById("result");
    if (backHub && resultBox && !resultBox.hidden && (ev.key === "Escape" || ev.key === "Enter")) {
      ev.preventDefault();
      backHub.click();
      return;
    }
    if (ev.key === "Escape" && document.getElementById("versus")) {
      ev.preventDefault();
      const back = pendingSpec && pendingSpec.returnTab;
      pendingSpec = null;
      showHub(back || hubTab);
      return;
    }
    if (!document.getElementById("tabbar")) return;
    if (ev.key === "Escape") {
      if (document.getElementById("settingsSheet")) {
        ev.preventDefault();
        settingsOpen = false;
        refreshHub();
        return;
      }
      if (document.getElementById("creditsSheet")) {
        ev.preventDefault();
        creditsOpen = false;
        refreshHub();
        return;
      }
      if (!detailId && !gearPreview && !tonicPick) return;
      ev.preventDefault();
      detailId = null;
      gearPreview = null;
      tonicPick = null;
      refreshHub();
      return;
    }
    if (ev.key < "1" || ev.key > "5") return;
    ev.preventDefault();
    pitSound("tab");
    detailId = null;
    gearPreview = null;
    tonicPick = null;
    creditsOpen = false;
    const nextTab = HUB_TABS[ev.key.charCodeAt(0) - 49];
    showHub(nextTab, nextTab === hubTab);
  }
  document.addEventListener("keydown", onHubKey);
  document.addEventListener("click", function (ev) {
    const button = ev.target && ev.target.closest && ev.target.closest("button");
    if (!button || button.disabled) return;
    if (button.dataset && button.dataset.tab) pitSound("tab");
    else pitSound("click");
  }, true);

  IL.screenApi = { showTitle: showTitle };
  if (IL.fx && IL.fx.load) IL.fx.load();
  const iconWatch = new MutationObserver(function () { mountIcons(document); });
  iconWatch.observe(document.body, { childList: true, subtree: true });
  loadIconAtlas();
  ensureYard();
  showTitle();
})(typeof window !== "undefined" ? window : globalThis);
