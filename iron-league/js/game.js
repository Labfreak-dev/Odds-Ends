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
  let meterOn = false;
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
  let eventPane = "week";
  let trainPane = "drills";
  let trainDrill = "strength";
  let relicStatus = "all";
  let relicRarity = "all";
  let relicSet = "all";
  let relicOpen = null;
  let tutorStep = 0;
  const HUB_TABS = ["club", "fighters", "market", "cup", "relics", "events", "train"];
  const TUTOR_STEPS = [
    "Your party is on the card. Send them in when you are ready.",
    "The market hires fighters and sells relics. Two club relics ride with everyone.",
    "Train raises a stat. Events pay a purse."
  ];
  const BUILD = "58";

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
    const pit = document.getElementById("titlePit");
    if (pit) pit.remove();
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
    if (!save.nemesis || !save.nemesis.name || save.nemesis.name === save.clubName) {
      const names = IL.CLUBS.filter(function (n) { return n !== save.clubName; });
      const picked = names.length ? names[IL.hashStr(save.clubName || "iron") % names.length] : "Red Kettle";
      save.nemesis = { name: picked, wins: 0, losses: 0, grudge: 0 };
    }
    const nemesisName = save.nemesis.name;
    if (nemesisName && rivals.indexOf(nemesisName) < 0 && rivals.length) {
      rivals[rivals.length - 1] = nemesisName;
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
      if (IL.dedupeNames) IL.dedupeNames(fighters);
      if (IL.separateLooks) IL.separateLooks(fighters);
      clubs.push({ id: "c" + i, name: name, you: false, w: 0, l: 0, pts: 0, pf: 0, pa: 0, str: str, fighters: fighters });
    });
    save.clubs = clubs;
    save.round = 0;
    save.fixtures = roundRobin(clubs.map(function (c) { return c.id; }));
    if (!keepGold) save.gold = IL.START_GOLD;
    if (IL.rollGearStock) save.gearStock = IL.rollGearStock(rng);
    save.trainsLeft = IL.drillCap ? IL.drillCap(save) : (IL.TRAIN_CAP || 2);
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
  const NAV_GLYPH = { club: "shield", fighters: "swords", market: "cargo_bag", cup: "chest", relics: "necklace", events: "skull_demon", train: "preparing_for_an_attack" };
  const STAT_GLYPH = { HP: "drop_water_or_blood", ATK: "sword", DEF: "armor_1_body", SPD: "shoes" };

  function crestIndexOf(name) {
    return (IL.hashStr(name || "iron") % 16) + 1;
  }

  function crestHtml(name, size, index, plate) {
    let n = index | 0;
    if (n < 1 || n > 16) n = crestIndexOf(name);
    const file = CREST_FILES[n - 1];
    let tint = CREST_TINTS[n - 1];
    if (typeof plate === "number" && plate >= 0 && plate < CREST_TINTS.length) tint = CREST_TINTS[plate | 0];
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
  const TITLE_NEWS = [
    "27 classes, each with six or more moves. Recruits of one class equip different threes.",
    "Market stalls to buy and sell gear, fighters, and relics, plus weekly deals.",
    "64 relics in 8 sets.",
    "Events, Endless mode, and a daily challenge. Pit events include fog, a fire floor, gold rush, sudden death, and giant mode.",
    "Training drills, tasks, and specialties.",
    "A rival club and a club record.",
    "Achievements and club colors.",
    "Fight a friend: copy a code, or paste one, and fight their club."
  ];

  function paintTitlePit(ctx, w, h, t, still) {
    const pit = (IL.PITS && IL.PITS[0]) || {
      sky: ["#24160f", "#4a3020"], floor: "#7a5638", grain: "#3a2616", lite: "#a88458",
      wall: "#3a2a1c", rail: "#c4a06a", stone: "#5a4030",
      crowd: "#140e0a", cloth: ["#6e3030", "#2c4068", "#6a5428", "#3a3028", "#243028"],
      line: "rgba(48,28,14,0.4)"
    };
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, pit.sky[0]);
    sky.addColorStop(0.38, pit.sky[1]);
    sky.addColorStop(1, pit.floor);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    const bandTop = Math.round(h * 0.05);
    const band = Math.max(78, Math.round(h * 0.2));
    ctx.fillStyle = pit.wall;
    ctx.fillRect(0, bandTop, w, band);
    const blocks = Math.ceil(w / 26) + 1;
    for (let i = 0; i < blocks; i++) {
      ctx.fillStyle = i % 2 ? pit.stone : pit.wall;
      ctx.fillRect(i * 26, bandTop, 24, 12);
      ctx.fillStyle = i % 2 ? pit.wall : pit.stone;
      ctx.fillRect(6 + i * 26, bandTop + 14, 24, 11);
    }
    for (let row = 0; row < 3; row++) {
      const y = bandTop + 38 + row * ((band - 44) / 3);
      ctx.fillStyle = pit.crowd;
      ctx.fillRect(0, y, w, 5);
      const n = Math.ceil(w / 18);
      for (let i = 0; i < n; i++) {
        const bounce = still ? 0 : Math.sin(t * 2.2 + i * 0.7 + row) * 1.6;
        const hh = 8 + ((i + row) % 3) * 3;
        const x = 4 + i * 18;
        ctx.fillStyle = pit.cloth[(i + row * 2) % pit.cloth.length];
        ctx.fillRect(x, y - hh + bounce, 7, hh);
        ctx.beginPath();
        ctx.arc(x + 3.5, y - hh - 3 + bounce, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = pit.rail;
    ctx.fillRect(0, bandTop + band - 6, w, 5);
    for (let i = 0; i < 8; i++) {
      const x = 16 + i * (w / 8);
      ctx.fillStyle = pit.cloth[i % pit.cloth.length];
      ctx.beginPath();
      ctx.moveTo(x, bandTop + band);
      ctx.lineTo(x + 10, bandTop + band);
      ctx.lineTo(x + 5, bandTop + band + 18);
      ctx.fill();
    }
    const floorTop = bandTop + band + 10;
    ctx.fillStyle = pit.floor;
    ctx.fillRect(0, floorTop, w, Math.max(0, h - floorTop));
    ctx.fillStyle = pit.grain;
    ctx.globalAlpha = 0.4;
    for (let y = floorTop + 12; y < h; y += 16) ctx.fillRect(0, y, w, 2);
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = pit.lite;
    ctx.beginPath();
    ctx.ellipse(w / 2, floorTop + (h - floorTop) * 0.46, w * 0.4, Math.max(24, (h - floorTop) * 0.26), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = pit.line || "rgba(48,28,14,0.4)";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "rgba(12, 9, 7, 0.46)";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(196, 154, 98, 0.55)";
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  function titleRing(w, h) {
    const bandTop = Math.round(h * 0.05);
    const band = Math.max(78, Math.round(h * 0.2));
    const floorTop = bandTop + band + 10;
    const cy = floorTop + (h - floorTop) * 0.46;
    return {
      cx: w / 2,
      cy: cy,
      rx: w * 0.4,
      ry: Math.max(24, (h - floorTop) * 0.26)
    };
  }

  function startTitlePit() {
    const tok = token;
    const canvas = document.createElement("canvas");
    canvas.id = "titlePit";
    canvas.setAttribute("aria-hidden", "true");
    document.body.appendChild(canvas);
    const atlases = {};
    ["1_1", "2_6", "5_7", "4_2"].forEach(function (id) {
      IL.hero.compose({ sheet: id }).then(function (atlas) {
        if (alive(tok)) atlases[id] = atlas;
      }).catch(function () {});
    });
    const phone = [
      { sheet: "1_1", cls: "warrior", side: -1, face: 1 },
      { sheet: "2_6", cls: "archer", side: 1, face: -1 }
    ];
    const desk = [
      { sheet: "1_1", cls: "warrior", x: 0.07, y: 0.5, face: 1 },
      { sheet: "5_7", cls: "tank", x: 0.15, y: 0.62, face: 1 },
      { sheet: "2_6", cls: "archer", x: 0.85, y: 0.62, face: -1 },
      { sheet: "4_2", cls: "mage", x: 0.93, y: 0.5, face: -1 }
    ];
    const reduce = !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const t0 = (root.performance || Date).now();
    function frame(now) {
      if (!alive(tok)) return;
      const cssW = Math.max(1, root.innerWidth || 360);
      const cssH = Math.max(1, root.innerHeight || 740);
      const narrow = cssW < 700;
      const dpr = Math.min(narrow ? 1 : 2, root.devicePixelRatio || 1);
      const bw = Math.max(1, Math.round(cssW * dpr));
      const bh = Math.max(1, Math.round(cssH * dpr));
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
      }
      canvas.style.width = cssW + "px";
      canvas.style.height = cssH + "px";
      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
      const t = reduce ? 0 : ((now || t0) - t0) / 1000;
      paintTitlePit(ctx, cssW, cssH, t, reduce);
      const ring = titleRing(cssW, cssH);
      const cast = narrow ? phone : desk;
      const scale = narrow ? 4 : 3;
      cast.forEach(function (c, i) {
        const atlas = atlases[c.sheet];
        if (!atlas) return;
        const x = Math.round(narrow ? ring.cx + c.side * ring.rx * 0.55 : cssW * c.x);
        const y = Math.round(narrow ? ring.cy + ring.ry * 0.12 : cssH * c.y);
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.beginPath();
        ctx.ellipse(x, y + 2, 10 * scale, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        IL.hero.draw(ctx, atlas, IL.frameIndex("idle", t + i * 0.2), x, y, scale, c.face, c.cls);
      });
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
  }

  function showTitle() {
    stopLoops();
    app.onclick = null;
    save = load();
    hubBed();
    const cont = save
      ? '<button type="button" class="btn ghost" id="continue">Continue — ' + esc(save.clubName) + '</button>'
      : '<button type="button" class="btn ghost" id="continue" disabled>Continue</button>';
    const narrowTitle = (root.innerWidth || 800) < 700;
    const news = TITLE_NEWS.map(function (line) { return "<li>" + esc(line) + "</li>"; }).join("");
    app.innerHTML =
      '<main class="title-screen">' +
        '<div class="title-copy">' +
          '<p class="eyebrow">Mercenary pit</p>' +
          '<h1>Iron League</h1>' +
          '<p class="lede">Raise a club. Send them into the sand. A season, a cup, then the board is read aloud.</p>' +
          '<div class="title-actions">' +
            '<button type="button" class="btn gold" id="newClub">New club</button>' +
            cont +
          '</div>' +
          '<p class="fine">Saved on this browser only.</p>' +
          '<details class="whats-new"' + (narrowTitle ? "" : " open") + '>' +
            '<summary>What\'s new</summary>' +
            '<ul>' + news + '</ul>' +
          '</details>' +
        '</div>' +
      '</main>';
    document.getElementById("newClub").onclick = function () { showCreator("captain"); };
    const c = document.getElementById("continue");
    if (save) c.onclick = function () { showHub(); };
    startTitlePit();
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
      const takenNames = [captain.name];
      recruits.forEach(function (f) {
        f.name = IL.uniqueName(rng, takenNames);
        takenNames.push(f.name);
      });
      if (IL.separateLooks) IL.separateLooks([captain].concat(recruits));
      save = Object.assign({
        v: 1,
        clubName: clubName,
        crest: draft.crest || 1,
        plate: Math.max(0, (draft.crest || 1) - 1),
        gold: IL.START_GOLD,
        season: 1,
        rngSeed: seed,
        roster: [captain].concat(recruits)
      }, IL.freshClubFields(seed));
      buildSeason(false);
      save.market = IL.rollMarket(takeRng(), 0, rosterAvoid());
      save.items = [IL.makeItem(takeRng(), { key: "cloak", rarity: "common" })];
      save.lineup = save.roster.slice(0, IL.PARTY_CAP).map(function (f) { return f.id; });
      save.schema = IL.SCHEMA || 2;
      save.tutored = false;
      tutorStep = 0;
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
      if (IL.dedupeNames) IL.dedupeNames(save.roster);
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

  function rosterAvoid() {
    const names = [];
    const sheets = [];
    (save.roster || []).forEach(function (f) {
      if (f && f.name) names.push(f.name);
      if (f && f.parts && f.parts.sheet) sheets.push(f.parts.sheet);
    });
    return { names: names, sheets: sheets };
  }

  function ensureMarket() {
    IL.migrate(save);
    if (!save.market || !save.market.length) {
      save.market = IL.rollMarket(takeRng(), save.renown || 0, rosterAvoid());
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
    if (spec.mode === "chaos" || spec.mode === "endless" || spec.mode === "king") return "endless";
    if (spec.mode === "boss") return "boss";
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
    const cost = IL.drillCost ? IL.drillCost(save) : (IL.TRAIN_COST || 16);
    const left = save.trainsLeft || 0;
    const pit = inThePit(f);
    const broke = save.gold < cost;
    const spent = left <= 0;
    const why = pit ? "In the pit today" : (spent ? "Drills spent" : (broke ? "Need " + cost + " gold" : "Train — " + cost + " gold"));
    const off = pit || spent || broke ? " disabled" : "";
    if (sheet) {
      return '<button type="button" class="btn ghost" id="trainBtn"' + off + '>' + esc(why) + '</button>' +
        '<p class="fine">Drills left today: ' + left + '. Bench only. ' + (IL.drillXp ? IL.drillXp(save) : (IL.TRAIN_XP || 12)) + ' xp.</p>';
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
      ["fighters", "Team", "2", "tab-fighters"],
      ["market", "Market", "3", "market"],
      ["cup", "Cup", "4", "cup"],
      ["relics", "Relics", "5", "relics"],
      ["events", "Events", "6", "events"],
      ["train", "Train", "7", "train"]
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
    const wornRelic = f.relic && IL.relicById(f.relic);
    const relicRows = [];
    if (wornRelic) {
      relicRows.push('<li><strong>' + esc(wornRelic.name) + '</strong><p>Worn by this fighter. ' + esc(wornRelic.blurb) + '</p></li>');
    }
    eq.forEach(function (r) {
      relicRows.push('<li><strong>' + esc(r.name) + '</strong><p>' + esc(r.blurb) + '</p></li>');
    });
    const relics = relicRows.length
      ? '<ul class="relic-list">' + relicRows.join("") + '</ul>'
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
        '<p class="fine">Equip three. Recruits of one class start on different threes. A tome teaches the rest.</p>' +
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
  function toastBox() {
    let box = document.getElementById("achieveToast");
    if (!box) {
      box = document.createElement("div");
      box.id = "achieveToast";
      document.body.appendChild(box);
    }
    const purse = document.querySelector(".purse");
    const below = purse ? purse.getBoundingClientRect().bottom : 64;
    box.style.top = Math.round(below + 6) + "px";
    box.classList.toggle("toast-narrow", (root.innerWidth || 800) < 700);
    return box;
  }

  function showToasts(list) {
    if (!list || !list.length) return;
    const box = toastBox();
    box.hidden = false;
    box.innerHTML = list.map(function (row) {
      const pay = "+" + (row.gold || 0) + " gold" + (row.renown ? " +" + row.renown + " renown" : "");
      return '<p class="toast">' + esc(row.name) + " " + esc(pay) + "</p>";
    }).join("");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { box.hidden = true; }, 2500);
  }

  function showNote(text) {
    if (!text) return;
    const box = toastBox();
    const line = '<p class="toast">' + esc(text) + "</p>";
    if (!box.hidden && box.textContent) box.insertAdjacentHTML("beforeend", line);
    else {
      box.hidden = false;
      box.innerHTML = line;
    }
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { box.hidden = true; }, 2500);
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
      const nemesisRow = save.nemesis && c.name === save.nemesis.name;
      return '<tr class="' + (c.you ? "you" : "") + (nemesisRow ? " nemesis" : "") + '"><td>' + (i + 1) + '</td><td class="club-cell">' + crestHtml(c.name, "sm", clubCrest(c), c.you ? save.plate : undefined) + '<span class="club-name">' + esc(c.name) + '</span></td><td>' + played + '</td><td>' + c.w + '</td><td>' + c.l + '</td><td>' + c.pts + '</td></tr>';
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
      holdClubRelic(relic);
      persist();
      showSeasonEnd();
    };
  }

  function colorsHtml() {
    const crest = (save && save.crest) || 1;
    const plate = (save && typeof save.plate === "number") ? (save.plate | 0) : Math.max(0, crest - 1);
    const emblems = CREST_FILES.map(function (_, i) {
      const on = (i + 1) === crest;
      return '<button type="button" data-club-crest="' + (i + 1) + '" class="' + (on ? "on" : "") + '" aria-label="Emblem ' + (i + 1) + '" aria-pressed="' + (on ? "true" : "false") + '">' +
        crestHtml("", "sm", i + 1, plate) + "</button>";
    }).join("");
    const plates = CREST_TINTS.map(function (tint, i) {
      const on = i === plate;
      return '<button type="button" data-club-plate="' + i + '" class="' + (on ? "on" : "") + '" aria-label="Plate ' + (i + 1) + '" aria-pressed="' + (on ? "true" : "false") + '" style="--club:' + tint + '"><span class="plate-swatch"></span></button>';
    }).join("");
    return '<section class="panel-frame" id="clubColors"><h3 class="section">Colors</h3>' +
      '<p class="fine">Emblem and plate. Rivals keep theirs.</p>' +
      '<div class="crest-pick" id="emblemPick">' + emblems + "</div>" +
      '<div class="plate-pick" id="platePick">' + plates + "</div></section>";
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
      const nemesisRow = save.nemesis && c.name === save.nemesis.name;
      return '<tr class="' + (c.you ? "you" : "") + (nemesisRow ? " nemesis" : "") + '"><td>' + (i + 1) + '</td><td class="club-cell">' + crestHtml(c.name, "sm", clubCrest(c), c.you ? save.plate : undefined) + '<span class="club-name">' + esc(c.name) + '</span></td><td>' + played + '</td><td>' + c.w + '</td><td>' + c.l + '</td><td>' + c.pts + '</td></tr>';
    }).join("");
    function previewNames(list) {
      if (!list.length) return '<p class="preview-name">None</p>';
      return '<ul class="preview-names">' + list.map(function (f) {
        const first = String(f.name || "Fighter").trim().split(/\s+/)[0];
        return '<li>' + esc(first) + '</li>';
      }).join("") + '</ul>';
    }
    const partySynergy = synergyLine(yours, "partySynergy");
    const preview = (!done && rival)
      ? '<section class="preview-board" id="matchPreview">' +
          partySynergy +
          '<div class="preview-side">' +
            '<p class="eyebrow">Your party</p>' +
            '<div class="preview-head">' + crestHtml(save.clubName, "sm", save.crest, save.plate) + previewNames(yours) + '</div>' +
          '</div>' +
          '<p class="vs">vs</p>' +
          '<div class="preview-side">' +
            '<p class="eyebrow">Next opponent</p>' +
            '<div class="preview-head">' + crestHtml(rival.name, "sm", clubCrest(rival)) + previewNames(theirs) + '</div>' +
          '</div>' +
        '</section>'
      : "";
    const sendBtn = (!done && rival)
      ? '<button type="button" class="btn fight" id="nextMatch"' + (partyReady ? "" : " disabled") + '>' +
          (partyReady ? "Send them in" : ("Choose " + size)) + '</button>'
      : "";
    return tutorHtml() +
      (pendingGrowth().length
        ? '<p class="banner">Someone grew in the pit. <button type="button" class="btn gold" id="openGrowth">Choose a perk</button></p>'
        : '') +
      (pendingMoveFighters().length
        ? '<p class="banner">A new trick is waiting. <button type="button" class="btn gold" id="openMoves">Choose a move</button></p>'
        : '') +
      (done
        ? '<p class="banner">Season closed. ' + esc(sortedClubs()[0].name) + ' leads the board. <button type="button" class="btn gold" id="openSeasonBanner">Open the ceremony</button></p>'
        : '<p class="banner">Match ' + (save.round + 1) + ' of 5 · ' + size + ' vs ' + size + ' against <strong>' + esc(rival ? rival.name : "—") + '</strong>' + nemesisBanner(rival) + '</p>') +
      (size && yours.length < size
        ? '<p class="banner">The pit wants ' + size + '. ' + yours.length + ' chosen — add ' + (size - yours.length) + ' more from the bench.</p>'
        : '') +
      preview +
      '<div class="hub-split" id="hubSplit">' +
        '<div class="hub-main" id="hubMain">' +
          (preview ? "" : partySynergy) +
          rosterHtml(size, size ? "In the pit" : "Party", "all") +
        '</div>' +
        '<div class="pane" id="clubPane">' +
          colorsHtml() +
          '<section class="panel-frame"><h3 class="section">Standings</h3>' +
            '<table class="board"><thead><tr><th></th><th>Club</th><th>P</th><th>W</th><th>L</th><th>Pts</th></tr></thead><tbody>' + table + '</tbody></table>' +
          '</section>' +
          clubRecordHtml() +
          historyHtml() +
          achievementsHtml() +
        '</div>' +
      '</div>' +
      sendBtn;
  }

  function tutorHtml() {
    if (!save || save.tutored) return "";
    const i = Math.max(0, Math.min(TUTOR_STEPS.length - 1, tutorStep | 0));
    const last = i >= TUTOR_STEPS.length - 1;
    return '<section class="panel-frame tutor-card" id="tutorCard">' +
      '<p class="fine">First visit · ' + (i + 1) + " of " + TUTOR_STEPS.length + "</p>" +
      '<p class="tutor-copy">' + esc(TUTOR_STEPS[i]) + "</p>" +
      '<div class="tutor-actions">' +
        '<button type="button" class="btn ghost" id="tutorSkip">Skip</button>' +
        '<button type="button" class="btn primary" id="tutorNext">' + (last ? "Done" : "Next") + "</button>" +
      "</div></section>";
  }

  function fightersPanel() {
    const size = save.round < 5 ? IL.SEASON_SIZES[save.round] : 0;
    return '<div id="fighterList">' +
      filterBar("fighters", fighterFilter, [["all", "All"], ["party", "Party"], ["bench", "Bench"]]) +
      '<div class="hub-split" id="hubSplit">' +
        '<div class="hub-main" id="hubMain">' +
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
      const full = save.roster.length >= IL.ROSTER_CAP;
      const broke = save.gold < row.cost;
      const cant = locked || broke || full;
      let hireText = "Hire";
      if (locked) hireText = "Need " + row.need + "r";
      else if (full) hireText = "Full";
      else if (broke) hireText = "Need " + row.cost + "g";
      return '<article class="card roster-row' + (cant ? " cant-afford" : " buyable") + '" data-role="' + esc(kit.role) + '">' +
        portraitWrap('width="72" height="64" data-key="' + esc(IL.hero.keyOf(f.parts)) + '" data-anim="' + (kit.idle || "idle") + '" data-scale="2" data-foot="6"', false, f) +
        '<div class="row-main">' +
          '<h3>' + esc(f.name) + champ + '</h3>' +
          '<p class="kit-line">' + classBadge(f.cls) + '<span>' + esc(kit.name) + ' · ' + esc(recruitTags(f, kit)) + '</span></p>' +
          '<p class="fine">' + esc(price) + '</p>' +
        '</div>' +
        '<button type="button" class="btn primary hire' + (cant ? " cant-afford" : " buyable") + '" data-hire="' + i + '"' + (cant ? " disabled" : "") + '>' + hireText + '</button>' +
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
      '<div class="cards dense-grid" id="marketCards">' + cards + '</div></section>';
    const selling = '<section class="roster-block"><h3 class="section">Sell from the bench</h3>' +
      '<p class="fine">' + (captain ? esc(captain.name) + " is captain and stays." : "The captain stays.") + '</p>' +
      '<div class="cards dense-grid">' + (bench || emptyState("The bench is empty.", "Hire someone before there is anyone to sell.")) + '</div></section>';
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
      let label = "Buy — " + row.cost + " gold";
      if (owned) label = "Owned";
      else if (gone) label = "Sold";
      else if (broke) label = "Need " + row.cost + "g";
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
        '<p class="fine">Sell for ' + pay + ' gold. It leaves the party, and anyone wearing it.</p>' +
        '<button type="button" class="btn ghost" data-sell-relic="' + esc(id) + '">Sell — ' + pay + ' gold</button>' +
      '</article>';
    }).join("");
    const cost = IL.REFRESH_COST;
    const broke = save.gold < cost;
    return '<section class="panel-frame" id="relicStall"><h3 class="section">Relic stall</h3>' +
      '<p class="fine">One of each. Refresh spends ' + cost + ' gold. Club relics equip on the Relics tab. A fighter wears one there too.</p>' +
      '<div class="hub-actions"><button type="button" class="btn ghost' + (broke ? " cant-afford" : " buyable") + '" id="refreshRelics"' + (broke ? " disabled" : "") + '>Refresh relics — ' + cost + ' gold</button></div>' +
      '<div class="dense-grid">' + (cards || emptyState("The stall is bare.", "Refresh it.")) + '</div>' +
      '<h3 class="section">Yours to sell</h3>' +
      '<div class="dense-grid">' + (owned || emptyState("No relics in the chest.", "Buy one here, or win a cup.")) + '</div></section>';
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
          '<button type="button" class="btn primary" data-deal="' + i + '"' + (cant ? " disabled" : "") + '>' + (gone ? "Sold" : (full ? "Full" : (broke ? "Need " + offer.cost + "g" : "Hire"))) + '</button>' +
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
          '<button type="button" class="btn primary" data-deal="' + i + '"' + (cant ? " disabled" : "") + '>' + (haveAll ? "Owned" : (gone ? "Sold" : (broke ? "Need " + offer.cost + "g" : ("Buy — " + offer.cost + " gold")))) + '</button>' +
        '</article>';
      }
      if (offer.kind === "gear" || offer.kind === "tome") {
        const item = offer.item;
        const name = item && IL.itemName ? IL.itemName(item) : (offer.kind === "tome" ? "Tome" : "Gear");
        const slot = item && IL.itemSlot ? IL.itemSlot(item) : offer.kind;
        const cant = gone || broke;
        return '<article class="card stall-card' + (cant ? " cant-afford" : " buyable") + '">' +
          '<h3>' + esc(name) + '</h3>' +
          '<p class="fine">' + esc(slot) + ' · discounted this week. 1 in stock.</p>' +
          '<button type="button" class="btn primary" data-deal="' + i + '"' + (cant ? " disabled" : "") + '>' + (gone ? "Sold" : (broke ? "Need " + offer.cost + "g" : ("Buy — " + offer.cost + " gold"))) + '</button>' +
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
        '<button type="button" class="btn primary" data-deal="' + i + '"' + (cant ? " disabled" : "") + '>' + (gone ? "Opened" : (broke ? "Need " + offer.cost + "g" : ("Open — " + offer.cost + " gold"))) + '</button>' +
      '</article>';
    }).join("");
    return '<section id="dealsBoard"><h3 class="section">This week</h3>' +
      '<div class="dense-grid">' + cards + '</div></section>';
  }

  function specLabel(f) {
    const focus = f.focus && IL.specialtyOf ? IL.specialtyOf(f.focus) : null;
    const hired = f.specialty && IL.specialtyOf ? IL.specialtyOf(f.specialty) : null;
    const mastery = f.mastery && IL.masteryOf ? IL.masteryOf(f.mastery) : null;
    const bits = [];
    if (focus) bits.push(focus.name);
    else if (hired) bits.push(hired.name);
    if (mastery) bits.push(mastery.name);
    return bits.join(" · ");
  }

  function drillButtonLabel(f, drill, left) {
    const pit = inThePit(f);
    const open = !IL.drillOpen || IL.drillOpen(f, drill.id);
    const rank = IL.drillRank ? IL.drillRank(f, drill.id) : 0;
    const cap = drill.cap || 5;
    const broke = save.gold < drill.cost;
    const spent = left <= 0;
    if (pit) return { label: "In the pit", cant: true };
    if (!open) return { label: "Not this class", cant: true };
    if (rank >= cap) return { label: "Rank " + cap, cant: true };
    if (spent) return { label: "Spent", cant: true };
    if (broke) return { label: "Need " + drill.cost + "g", cant: true };
    return { label: "Drill — " + drill.cost + "g", cant: false };
  }

  function trainingPanel() {
    const tabs = filterBar("train", trainPane, [["drills", "Drills"], ["specs", "Specialties"], ["tasks", "Tasks"], ["facilities", "Facilities"]]);
    let body = "";
    if (trainPane === "tasks") {
      const points = save.specPoints || 0;
      const cards = (IL.TASKS || []).map(function (task) {
        const done = save.taskDone && save.taskDone[task.id];
        const prog = (save.taskProg && save.taskProg[task.id]) || 0;
        const shown = Math.min(task.goal, prog);
        return '<article class="card stall-card' + (done ? "" : " buyable") + '">' +
          '<h3>' + esc(task.name) + '</h3>' +
          '<p>' + esc(task.blurb) + '</p>' +
          '<p class="fine">' + (done ? "Done · +" + task.points + " specialty point" : (shown + " / " + task.goal + " · +" + task.points + " point")) + '</p>' +
        '</article>';
      }).join("");
      body = '<section id="taskBoard"><h3 class="section">Tasks</h3>' +
        '<p class="fine">Specialty points: ' + points + '. A focus spends ' + (IL.FOCUS_COST || 1) + '. A mastery spends ' + (IL.MASTERY_COST || 2) + '.</p>' +
        '<div class="dense-grid">' + cards + '</div></section>';
    } else if (trainPane === "facilities") {
      const cards = (IL.FACILITIES || []).map(function (def) {
        const lv = (save.facilities && save.facilities[def.id]) || 0;
        const maxed = lv >= def.max;
        const cost = maxed ? 0 : def.costs[lv];
        const broke = !maxed && save.gold < cost;
        const label = maxed ? "Maxed" : (broke ? "Need " + cost + "g" : "Upgrade — " + cost + "g");
        return '<article class="card stall-card' + (maxed || broke ? " cant-afford" : " buyable") + '">' +
          '<h3>' + esc(def.name) + ' · ' + lv + '/' + def.max + '</h3>' +
          '<p>' + esc(def.blurb) + '</p>' +
          '<button type="button" class="btn primary" data-facility="' + def.id + '"' + (maxed || broke ? " disabled" : "") + '>' + label + '</button>' +
        '</article>';
      }).join("");
      body = '<section id="facilityBoard"><h3 class="section">Facilities</h3>' +
        '<p class="fine">The yard adds a drill. The hall adds xp. The infirmary lowers the price.</p>' +
        '<div class="dense-grid">' + cards + '</div></section>';
    } else if (trainPane === "specs") {
      const points = save.specPoints || 0;
      const focusCost = IL.FOCUS_COST || 1;
      const masteryCost = IL.MASTERY_COST || 2;
      const rows = (save.roster || []).map(function (f) {
        const kit = IL.CLASSES[f.cls] || IL.CLASSES.warrior;
        let pick = "";
        if (f.pendingFocus) {
          const can = points >= focusCost;
          pick += '<p class="fine">Level 5. A focus spends ' + focusCost + ' point.</p><div class="chips">' +
            (IL.SPECIALTIES || []).map(function (spec) {
              return '<button type="button" class="chip" data-focus="' + esc(f.id) + '" data-spec="' + spec.id + '"' + (can ? "" : " disabled") + '>' + esc(spec.name) + '</button>';
            }).join("") + '</div>';
          if (!can) pick += '<p class="fine">Need a specialty point from Tasks.</p>';
        } else if ((f.level || 1) < 5) {
          pick += '<p class="fine">A focus opens at level 5.</p>';
        } else {
          pick += '<p class="fine">Focus: ' + esc(specLabel(f).split(" · ")[0] || "—") + '</p>';
        }
        if (f.pendingMastery) {
          const can = points >= masteryCost;
          pick += '<p class="fine">Level 10. A mastery spends ' + masteryCost + ' points.</p><div class="chips">' +
            (IL.MASTERIES || []).map(function (spec) {
              return '<button type="button" class="chip" data-mastery="' + esc(f.id) + '" data-spec="' + spec.id + '"' + (can ? "" : " disabled") + '>' + esc(spec.name) + '</button>';
            }).join("") + '</div>';
          if (!can) pick += '<p class="fine">Need ' + masteryCost + ' specialty points.</p>';
        } else if ((f.level || 1) >= 10 && f.mastery && IL.masteryOf(f.mastery)) {
          pick += '<p class="fine">Mastery: ' + esc(IL.masteryOf(f.mastery).name) + '</p>';
        } else if ((f.level || 1) < 10) {
          pick += '<p class="fine">A mastery opens at level 10.</p>';
        }
        return '<article class="card stall-card">' +
          '<h3>' + esc(f.name) + '</h3>' +
          '<p class="kit-line">' + classBadge(f.cls) + '<span>' + esc(kit.name) + ' · Lv ' + (f.level || 1) + '</span></p>' +
          pick + '</article>';
      }).join("");
      body = '<section id="specBoard"><h3 class="section">Specialties</h3>' +
        '<p class="fine">Specialty points: ' + points + '. A focus replaces the hired specialty. A mastery stacks on top.</p>' +
        '<div class="cards dense-grid">' + (rows || emptyState("The roster is empty.", "Hire someone first.")) + '</div></section>';
    } else {
      const drill = IL.drillById(save, trainDrill) || (IL.drillList(save) || [])[0];
      const left = save.trainsLeft || 0;
      const picks = (IL.drillList(save) || []).map(function (row) {
        const on = row.id === drill.id;
        return '<button type="button" class="chip' + (on ? " on" : "") + '" data-drill-pick="' + row.id + '" aria-pressed="' + (on ? "true" : "false") + '">' + esc(row.name) + '</button>';
      }).join("");
      const rows = (save.roster || []).map(function (f) {
        const kit = IL.CLASSES[f.cls] || IL.CLASSES.warrior;
        const rank = IL.drillRank ? IL.drillRank(f, drill.id) : 0;
        const gate = drill.classes ? " · " + drill.classes.length + " classes" : "";
        const btn = drillButtonLabel(f, drill, left);
        return '<article class="card stall-card' + (btn.cant ? " cant-afford" : " buyable") + '">' +
          '<h3>' + esc(f.name) + '</h3>' +
          '<p class="kit-line">' + classBadge(f.cls) + '<span>' + esc(kit.name) + ' · Lv ' + (f.level || 1) + (specLabel(f) ? " · " + esc(specLabel(f)) : "") + '</span></p>' +
          '<p class="fine">' + esc(drill.name) + ' ' + rank + '/' + (drill.cap || 5) + ' · +' + drill.stat + ' · ' + drill.xp + ' xp' + gate + '</p>' +
          '<button type="button" class="btn primary" data-drill="' + esc(f.id) + '"' + (btn.cant ? " disabled" : "") + '>' + btn.label + '</button>' +
        '</article>';
      }).join("");
      body = '<section id="trainBoard"><h3 class="section">Drills</h3>' +
        '<p class="fine">' + left + ' left this round. ' + esc(drill.blurb) + ' Rank caps at ' + (drill.cap || 5) + '.</p>' +
        '<div class="chips">' + picks + '</div>' +
        '<div class="cards dense-grid">' + rows + '</div></section>';
    }
    return '<div id="trainPane">' + tabs + body + '</div>';
  }

  function weekDone(id) {
    const mark = save.weekClear;
    return !!(mark && mark.week === IL.weekIndex(Date.now()) && mark.id === id);
  }

  function eventParty() {
    const n = Math.min(3, Math.max(1, (save.lineup || []).length || 1));
    let party = fielded(save.roster, n);
    if (!party.length && save.roster && save.roster[0]) party = [save.roster[0]];
    return party;
  }

  function withFractions(list, hp) {
    return (list || []).map(function (f) {
      const copy = Object.assign({}, f);
      if (hp && typeof hp[f.id] === "number") copy.hpFrac = hp[f.id];
      return copy;
    }).filter(function (f) { return !(hp && hp[f.id] <= 0); });
  }

  function hpFractions(match) {
    const map = {};
    (match.units || []).forEach(function (u) {
      if (!u || u.team !== 0 || u.summon) return;
      map[u.id] = u.maxHp ? Math.max(0, u.hp / u.maxHp) : 0;
    });
    return map;
  }

  function eventsPanel() {
    const tabs = filterBar("events", eventPane, [["week", "This week"], ["endless", "Endless"], ["daily", "Daily"], ["friend", "Friend"]]);
    let body = "";
    if (eventPane === "endless") {
      const best = (save.endless && save.endless.best) || 0;
      const board = (save.endless && save.endless.board) || [];
      const rows = board.map(function (row, i) {
        return '<li>' + (i + 1) + '. ' + esc(row.club || "Club") + ' — wave ' + row.wave + '</li>';
      }).join("");
      const running = save.endlessRun && save.endlessRun.wave;
      body = '<section id="endlessBoard">' +
        '<h3 class="section">Endless</h3>' +
        '<p class="fine">Waves scale. Every fifth wave brings the next modifier, then a relic pick. Your best stays on this device.</p>' +
        '<p class="fine">Best wave: ' + best + (running ? ' · Run in progress: wave ' + save.endlessRun.wave : '') + '</p>' +
        '<div class="hub-actions"><button type="button" class="btn fight" id="startEndless">' + (running ? "Resume" : "Enter the pit") + '</button></div>' +
        '<h3 class="section">On this device</h3>' +
        (rows ? '<ol class="payout">' + rows + '</ol>' : '<p class="fine">No runs yet.</p>') +
      '</section>';
    } else if (eventPane === "daily") {
      const day = IL.dayIndex(Date.now());
      const done = save.daily && save.daily.day === day && save.daily.cleared;
      const foes = IL.dailySquad(day, save.season || 1);
      const names = foes.map(function (f) {
        const kit = IL.CLASSES[f.cls] || IL.CLASSES.warrior;
        return f.name + " (" + kit.name + ")";
      }).join(", ");
      body = '<section id="dailyBoard">' +
        '<h3 class="section">Daily challenge</h3>' +
        '<p class="fine">The same pair for every club today. One purse if you win. Pit: ' + esc(IL.weekFightEvent(Date.now()).name) + '.</p>' +
        '<p class="fine">' + esc(names) + '</p>' +
        '<div class="hub-actions"><button type="button" class="btn fight" id="startDaily"' + (done ? " disabled" : "") + '>' + (done ? "Cleared today" : "Fight today") + '</button></div>' +
      '</section>';
    } else if (eventPane === "friend") {
      const code = IL.exportChallenge(save);
      const ready = fielded(save.roster, 1).length > 0;
      body = '<section id="friendBoard">' +
        '<h3 class="section">Fight a friend</h3>' +
        '<p class="fine">Copy the party you field. A friend pastes it and fights your club. The code carries the party, not their gear.</p>' +
        '<textarea id="friendOut" readonly aria-label="Your challenge code">' + esc(code) + '</textarea>' +
        '<div class="hub-actions friend-actions"><button type="button" class="btn" id="copyFriend">Copy code</button></div>' +
        (ready ? '' : '<p class="fine">Field a fighter before you send a code.</p>') +
        '<p class="fine">Paste a friend\'s code, then fight. Paste fills the box from the clipboard when the browser allows it.</p>' +
        '<textarea id="friendIn" aria-label="Paste a challenge code" placeholder="Paste a code"></textarea>' +
        '<div class="hub-actions friend-actions">' +
          '<button type="button" class="btn ghost" id="pasteFriend">Paste</button>' +
          '<button type="button" class="btn fight" id="fightFriend">Fight</button>' +
        '</div>' +
        '<p class="fine" id="friendNote"></p>' +
      '</section>';
    } else {
      const current = IL.activeEvent(Date.now());
      const pit = IL.weekFightEvent(Date.now());
      const cards = IL.EVENTS.map(function (ev) {
        const on = ev.id === current.id;
        const cleared = on && weekDone(ev.id);
        return '<article class="card stall-card' + (on ? " buyable" : "") + '">' +
          '<h3>' + esc(ev.name) + (on ? "" : " · later") + '</h3>' +
          '<p>' + esc(ev.blurb) + '</p>' +
          '<p class="fine">' + esc(ev.reward) + '</p>' +
          (on
            ? '<button type="button" class="btn fight" id="startEvent"' + (cleared ? " disabled" : "") + '>' + (cleared ? "Cleared this week" : "Enter") + '</button>'
            : '<p class="fine">Back on another week.</p>') +
        '</article>';
      }).join("");
      const left = IL.formatRemain ? IL.formatRemain(IL.msUntilWeek(Date.now())) : "";
      body = '<section id="eventsBoard">' +
        '<h3 class="section">This week</h3>' +
        '<p class="fine">One event is open. The board turns in ' + esc(left) + '.</p>' +
        '<p class="fine">This week\'s pit: ' + esc(pit.name) + '. ' + esc(pit.blurb) + '</p>' +
        '<div class="dense-grid">' + cards + '</div>' +
      '</section>';
    }
    return '<div id="eventsPane">' + tabs + body + '</div>';
  }

  function relicFirst(name) {
    const bits = String(name || "Fighter").trim().split(/\s+/);
    return bits[0] || "Fighter";
  }

  function relicVisible(r, owned) {
    const have = !!owned[r.id];
    if (relicStatus === "owned" && !have) return false;
    if (relicStatus === "missing" && have) return false;
    if (relicStatus === "club" && r.scope === "fighter") return false;
    if (relicStatus === "fighter" && r.scope !== "fighter") return false;
    if (relicRarity !== "all" && r.rarity !== relicRarity) return false;
    if (relicSet !== "all" && r.set !== relicSet) return false;
    return true;
  }

  function relicFace(r, size) {
    const frame = IL.relicIcon ? IL.relicIcon(r.id) : "";
    return '<span class="glyph rarity-' + esc(r.rarity || "common") + '">' +
      '<i class="item-icon" data-frame="' + esc(frame) + '" data-icon-size="' + size + '" hidden></i>' +
      glyphSvg("gem") +
    '</span>';
  }

  function selectOptions(current, pairs) {
    return pairs.map(function (pair) {
      return '<option value="' + esc(pair[0]) + '"' + (pair[0] === current ? " selected" : "") + '>' + esc(pair[1]) + '</option>';
    }).join("");
  }

  function setOwnedLine(setId) {
    const set = IL.setById(setId);
    if (!set) return "";
    const pieces = IL.RELICS.filter(function (r) { return r.set === setId; });
    let have = 0;
    pieces.forEach(function (r) { if ((save.relics || []).indexOf(r.id) >= 0) have++; });
    return set.name + " · " + have + "/" + pieces.length;
  }

  function relicCounts() {
    const owned = {};
    (save.relics || []).forEach(function (id) { owned[id] = true; });
    const wearerOf = {};
    (save.roster || []).forEach(function (f) {
      if (f && f.relic) wearerOf[f.relic] = f;
    });
    return { owned: owned, wearerOf: wearerOf };
  }

  function relicsPanel() {
    const bag = relicCounts();
    const list = IL.RELICS.filter(function (r) { return relicVisible(r, bag.owned); }).map(function (r) {
      const have = !!bag.owned[r.id];
      const fighterPiece = r.scope === "fighter";
      const on = !fighterPiece && (save.equipped || []).indexOf(r.id) >= 0;
      const wearer = fighterPiece ? bag.wearerOf[r.id] : null;
      const mark = (on || wearer) ? " riding" : "";
      const miss = have ? "" : " missing";
      return '<button type="button" class="relic-cell' + mark + miss + '" data-relic-open="' + esc(r.id) + '" aria-label="' + esc(r.name) + '">' +
        relicFace(r, 32) +
        '<span class="relic-name">' + esc(r.name) + '</span>' +
      '</button>';
    }).join("");
    const size = save.round < 5 ? IL.SEASON_SIZES[save.round] : IL.PARTY_CAP;
    const party = fielded(save.roster, size || IL.PARTY_CAP);
    const pack = IL.relicPack(save, party);
    const awake = {};
    pack.sets.forEach(function (s) { awake[s.id] = true; });
    const wornCount = Object.keys(bag.wearerOf).length;
    const pills = (IL.SETS || []).map(function (set) {
      const pieces = IL.RELICS.filter(function (r) { return r.set === set.id; });
      let have = 0;
      pieces.forEach(function (r) { if (bag.owned[r.id]) have++; });
      const hot = !!awake["set-" + set.id];
      const on = relicSet === set.id;
      return '<button type="button" class="set-pill' + (on ? " on" : "") + (hot ? " awake" : "") + '" data-set-filter="' + esc(set.id) + '">' +
        esc(set.name) + " " + have + "/" + pieces.length + (hot ? " awake" : "") +
      '</button>';
    }).join("");
    return '<div id="relicPane">' +
      '<p class="fine relic-count">' + (save.equipped || []).length + ' of 2 club slots · ' + wornCount + ' worn · ' + (save.relics || []).length + ' owned</p>' +
      '<div class="relic-filters">' +
        '<select id="relicStatus" aria-label="Status">' + selectOptions(relicStatus, [["all", "All relics"], ["owned", "Owned"], ["missing", "Missing"], ["club", "Club"], ["fighter", "Fighter"]]) + '</select>' +
        '<select id="relicRarity" aria-label="Rarity">' + selectOptions(relicRarity, [["all", "Any rarity"], ["common", "Common"], ["uncommon", "Uncommon"], ["rare", "Rare"], ["legendary", "Legendary"]]) + '</select>' +
        '<select id="relicSet" aria-label="Set">' + selectOptions(relicSet, [["all", "Any set"]].concat((IL.SETS || []).map(function (s) { return [s.id, s.name]; }))) + '</select>' +
      '</div>' +
      '<div class="set-strip" role="list">' + pills + '</div>' +
      '<div class="pane" id="relicGrid">' +
        '<div class="relic-grid">' + (list || '<p class="fine">Nothing in this filter.</p>') + '</div>' +
      '</div></div>';
  }

  function relicSheetHtml() {
    const r = relicOpen && IL.relicById(relicOpen);
    if (!r) return "";
    const bag = relicCounts();
    const have = !!bag.owned[r.id];
    const fighterPiece = r.scope === "fighter";
    const on = !fighterPiece && (save.equipped || []).indexOf(r.id) >= 0;
    const wearer = fighterPiece ? bag.wearerOf[r.id] : null;
    const rarity = IL.rarityName(r.rarity);
    const scope = fighterPiece ? "Fighter" : "Club";
    let setBlock = "";
    if (r.set && IL.setById(r.set)) {
      const set = IL.setById(r.set);
      setBlock = '<p class="fine">' + esc(setOwnedLine(r.set)) + '. ' + esc(set.blurb) + '</p>';
    }
    let status = "Buy one on the market, or win a cup.";
    if (on) status = "Riding with the party.";
    else if (wearer) status = "Worn by " + relicFirst(wearer.name) + ".";
    else if (have) status = "In the chest.";
    let action = "";
    if (have && fighterPiece) {
      const picks = (save.roster || []).map(function (f) {
        const wearing = f.relic === r.id;
        return '<button type="button" class="btn ' + (wearing ? "primary" : "ghost") + '" data-bind-relic="' + esc(r.id) + '" data-bind-fighter="' + esc(f.id) + '">' + esc(relicFirst(f.name)) + (wearing ? " · wearing" : "") + '</button>';
      }).join("");
      const clear = wearer
        ? '<button type="button" class="btn ghost" data-clear-relic="' + esc(r.id) + '">Take it off</button>'
        : "";
      action = '<div class="wear-picks">' + clear + picks + '</div>';
    } else if (have) {
      action = '<button type="button" class="btn ' + (on ? "primary" : "ghost") + '" data-equip="' + esc(r.id) + '">' + (on ? "Equipped" : "Equip") + '</button>';
    }
    if (have) {
      action += '<button type="button" class="btn ghost" data-sell-relic="' + esc(r.id) + '">Sell — ' + IL.relicSellPrice(r.id) + ' gold</button>';
    }
    return '<div class="sheet-back" id="relicSheetBack"></div>' +
      '<aside class="sheet" id="relicSheet" role="dialog" aria-modal="true" aria-labelledby="relicSheetTitle">' +
        '<header class="sheet-head"><div><p class="eyebrow">' + esc(rarity) + " · " + scope + '</p>' +
          '<h2 id="relicSheetTitle">' + esc(r.name) + '</h2></div>' +
          '<button type="button" class="btn close-x" id="relicSheetClose" aria-label="Close">Close</button></header>' +
        '<div class="relic-face">' + relicFace(r, 64) + '</div>' +
        '<p>' + esc(r.blurb) + '</p>' +
        setBlock +
        '<p class="fine">' + esc(status) + '</p>' +
        action +
      '</aside>';
  }

  function nemesisTone(n) {
    const g = (n && n.grudge) || 0;
    if (g >= 3) return "A bitter grudge";
    if (g >= 2) return "A sharp grudge";
    if (g >= 1) return "A grudge";
    return "Your rival";
  }

  function nemesisLine(n) {
    if (!n) return "";
    const w = n.wins || 0;
    const l = n.losses || 0;
    const g = n.grudge || 0;
    if (g >= 3) return "This one is personal.";
    if (g >= 1 && l > w) return "They still hold the last one.";
    if (w > l && w > 0) return "You hold the edge.";
    if (w + l === 0) return "They have your name.";
    return "They are back in the yard.";
  }

  function nemesisBanner(rival) {
    const n = save.nemesis;
    if (!rival || !n || rival.name !== n.name) return "";
    return '<span class="rival-line">' + esc(nemesisTone(n)) + ". " + esc(nemesisLine(n)) + "</span>";
  }

  function nemesisNoteHtml() {
    const n = save.nemesis;
    if (!n || !n.name) return "";
    return '<p class="fine" id="nemesisNote">Rival ' + esc(n.name) + " · " + (n.wins || 0) + "–" + (n.losses || 0) + ". " + esc(nemesisLine(n)) + "</p>";
  }

  function nemesisCardHtml() {
    const n = save.nemesis;
    if (!n || !n.name) return "";
    return '<section class="panel-frame" id="nemesisCard"><h3 class="section">Rival</h3>' +
      '<div class="stat-list">' +
        statLine("Club", n.name) +
        statLine("Against them", (n.wins || 0) + "–" + (n.losses || 0)) +
        statLine("Grudge", nemesisTone(n)) +
      "</div>" +
      '<p class="fine">' + esc(nemesisLine(n)) + "</p></section>";
  }

  function statLine(label, value) {
    return '<p><span>' + esc(label) + '</span><b>' + esc(value) + '</b></p>';
  }

  function clubRecordHtml() {
    const roster = save.roster || [];
    let dealt = 0;
    let heal = 0;
    const moves = {};
    roster.forEach(function (f) {
      if (!f) return;
      const career = f.career || {};
      dealt += career.dealt || 0;
      heal += career.heal || 0;
      const bag = career.moves || {};
      Object.keys(bag).forEach(function (id) {
        const row = bag[id];
        if (!row) return;
        const slot = moves[id] || (moves[id] = { name: row.name || id, dmg: 0, heal: 0 });
        if (row.name) slot.name = row.name;
        slot.dmg += row.dmg || 0;
        slot.heal += row.heal || 0;
      });
    });
    const top = roster.filter(Boolean).slice().sort(function (a, b) {
      const ad = (a.career && a.career.dealt) || 0;
      const bd = (b.career && b.career.dealt) || 0;
      if (bd !== ad) return bd - ad;
      return (b.wins || 0) - (a.wins || 0);
    }).slice(0, 5);
    const best = Object.keys(moves).map(function (id) { return moves[id]; }).filter(function (row) {
      return row.dmg > 0 || row.heal > 0;
    }).sort(function (a, b) {
      return (b.dmg + b.heal) - (a.dmg + a.heal);
    }).slice(0, 5);
    const fighterBody = top.length
      ? top.map(function (f) {
        const n = Math.round(((f.career && f.career.dealt) || 0));
        return '<li><span>' + esc(f.name) + '</span><b>' + (f.wins || 0) + "–" + (f.losses || 0) + " · " + (f.kos || 0) + " KO · " + n + "</b></li>";
      }).join("")
      : '<li><span class="fine">No fighters yet.</span></li>';
    const moveBody = best.length
      ? best.map(function (row) {
        const extra = row.heal > 0 ? (row.dmg > 0 ? " · +" + Math.round(row.heal) : "+" + Math.round(row.heal)) : "";
        return '<li><span>' + esc(row.name) + '</span><b>' + Math.round(row.dmg) + extra + '</b></li>';
      }).join("")
      : '<li><span class="fine">No moves recorded yet.</span></li>';
    const clubWins = save.clubWins || 0;
    const clubLosses = save.clubLosses || 0;
    return nemesisCardHtml() +
      '<section class="panel-frame" id="clubRecord">' +
      '<h3 class="section">Lifetime</h3>' +
      '<p class="fine">Wins and losses are the club’s matches. Damage and healing add up from the season on the save.</p>' +
      '<div class="stat-list">' +
        statLine("Matches", clubWins + clubLosses) +
        statLine("Wins", clubWins) +
        statLine("Losses", clubLosses) +
        statLine("Damage", Math.round(dealt)) +
        statLine("Healing", Math.round(heal)) +
      '</div></section>' +
      '<section class="panel-frame" id="topFighters"><h3 class="section">Top fighters</h3>' +
        '<ul class="stat-list">' + fighterBody + '</ul></section>' +
      '<section class="panel-frame" id="bestMoves"><h3 class="section">Best moves</h3>' +
        '<ul class="stat-list">' + moveBody + '</ul></section>';
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
      return '<span class="club-line' + you + through + '">' + crestHtml(side.name, "sm", idx, side.you ? save.plate : undefined) + esc(side.name) + '</span>';
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
    document.querySelectorAll(".pane, #hubPanel, #hubMain, #hubSplit, #fighterList, #eventsPane, #fighterSheet, #creditsSheet, #settingsSheet").forEach(function (el) {
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
      if (next === "events") eventPane = "week";
      if (next === "train") trainPane = "drills";
      if (next === "relics") { relicStatus = "all"; relicRarity = "all"; relicSet = "all"; relicOpen = null; }
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
      : hubTab === "events" ? eventsPanel()
      : hubTab === "train" ? trainingPanel()
      : clubPanel();
    const fighter = detailId ? fighterById(detailId) : null;
    app.innerHTML =
      '<main class="hub">' +
        '<div class="hub-sticky">' +
          '<header class="hub-head">' +
            crestHtml(save.clubName, "md", save.crest, save.plate) +
            '<div><p class="eyebrow">Season ' + save.season + '</p><h2>' + esc(save.clubName) + '</h2></div>' +
            '<div class="hub-actions">' +
              (done ? '<button type="button" class="btn gold" id="openSeason">Season ceremony</button>' : '') +
              '<button type="button" class="btn fight" id="chaos"' + (chaosReady ? "" : " disabled") + '>Chaos pit</button>' +
              '<button type="button" class="text-btn" id="credits">Credits</button>' +
              '<button type="button" class="icon-btn" id="settings" aria-label="Settings" title="Settings"><span aria-hidden="true">⚙</span></button>' +
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
      (!settingsOpen && !creditsOpen && fighter ? sheetHtml(fighter) : '') +
      (!settingsOpen && !creditsOpen && !fighter && relicOpen && hubTab === "relics" ? relicSheetHtml() : '');
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

  function copyText(text, noteId, okMsg, onDone) {
    const note = document.getElementById(noteId);
    function done(yes) {
      if (note) note.textContent = yes ? okMsg : "Copy failed. Select the text and copy it.";
      if (onDone) onDone(!!yes);
    }
    function fallback() {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      let okCopy = false;
      try { okCopy = document.execCommand("copy"); } catch (e) { okCopy = false; }
      document.body.removeChild(ta);
      done(okCopy);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, fallback);
    } else fallback();
  }

  function bugReport() {
    const roster = (save.roster || []).map(function (f) {
      return (f.name || "?") + " (" + (f.cls || "?") + ") Lv " + (f.level || 1);
    }).join(", ");
    const s = save.settings || {};
    return [
      "Iron League bug report",
      "schema: " + (save.schema || 1),
      "build: " + BUILD,
      "club: " + (save.clubName || ""),
      "season: " + (save.season || 1) + " round: " + (save.round || 0),
      "gold: " + (save.gold || 0) + " renown: " + (save.renown || 0),
      "roster: " + (roster || "none"),
      "equipped: " + ((save.equipped || []).join(", ") || "none"),
      "speed: " + s.speed + " shake: " + !!s.shake + " sound: " + s.sound + " music: " + s.music + " crowd: " + s.crowd,
      "agent: " + (navigator.userAgent || "")
    ].join("\n");
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
        '<div class="settings-block">' +
          '<button type="button" class="btn" id="copyReport">Report a bug</button>' +
          '<p class="fine" id="reportNote"></p>' +
        '</div>' +
        '<p class="fine">Save schema ' + (save.schema || 1) + ".</p>" +
        '<div class="settings-block">' +
          '<p class="eyebrow">Fight a friend</p>' +
          '<p class="fine">Copy your party, or paste a friend\'s code, on the Events tab.</p>' +
          '<button type="button" class="btn" id="openFriend">Fight a friend</button>' +
        "</div>" +
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
    const openFriend = document.getElementById("openFriend");
    if (openFriend) openFriend.onclick = function () {
      settingsOpen = false;
      detailId = null;
      eventPane = "friend";
      hubTab = "events";
      showHub("events");
    };
    const copyRep = document.getElementById("copyReport");
    if (copyRep) copyRep.onclick = function () {
      copyText(bugReport(), "reportNote", "Copied");
    };
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
          crestHtml(spec.leftName || save.clubName, "md", save.crest, save.plate) +
          '<div><p class="eyebrow">Before the pit</p><h2>' + esc(spec.leftName || save.clubName) + ' vs ' + esc(spec.rightName || "Rivals") + '</h2></div>' +
          crestHtml(spec.rightName || "Rivals", "md", crestIndexOf(spec.rightName)) +
        '</header>' +
        (nemesisBanner({ name: spec.rightName }) ? '<p class="banner" id="rivalLine">' + nemesisBanner({ name: spec.rightName }) + '</p>' : '') +
        (spec.mod ? '<p class="banner" id="fightEvent">' + esc(spec.mod.name) + '. ' + esc(spec.mod.blurb) + '</p>' : '') +
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
    const tutorSkip = document.getElementById("tutorSkip");
    if (tutorSkip) tutorSkip.onclick = function () {
      save.tutored = true;
      persist();
      refreshHub();
    };
    const tutorNext = document.getElementById("tutorNext");
    if (tutorNext) tutorNext.onclick = function () {
      if (tutorStep >= TUTOR_STEPS.length - 1) {
        save.tutored = true;
        persist();
      } else tutorStep += 1;
      refreshHub();
    };
    const openSeason = document.getElementById("openSeason");
    if (openSeason) openSeason.onclick = function () { showSeasonEnd(); };
    const openSeasonBanner = document.getElementById("openSeasonBanner");
    if (openSeasonBanner) openSeasonBanner.onclick = function () { showSeasonEnd(); };
    const chaosBtn = document.getElementById("chaos");
    if (chaosBtn) chaosBtn.onclick = function () { startChaosFight(); };
    const startEvent = document.getElementById("startEvent");
    if (startEvent) startEvent.onclick = function () { beginEvent(); };
    const startEndlessBtn = document.getElementById("startEndless");
    if (startEndlessBtn) startEndlessBtn.onclick = function () { beginEndless(); };
    const startDailyBtn = document.getElementById("startDaily");
    if (startDailyBtn) startDailyBtn.onclick = function () { beginDaily(); };
    const copyFriend = document.getElementById("copyFriend");
    if (copyFriend) copyFriend.onclick = function () {
      const note = document.getElementById("friendNote");
      if (!fielded(save.roster, 1).length) {
        if (note) note.textContent = "Field a fighter first.";
        return;
      }
      const code = IL.exportChallenge(save);
      const out = document.getElementById("friendOut");
      if (out) out.value = code;
      copyText(code, "friendNote", "Copied", function (yes) {
        if (!yes) return;
        copyFriend.textContent = "Copied";
        copyFriend.dataset.copied = "1";
      });
    };
    const pasteFriend = document.getElementById("pasteFriend");
    if (pasteFriend) pasteFriend.onclick = function () {
      const box = document.getElementById("friendIn");
      const note = document.getElementById("friendNote");
      function fill(text) {
        if (box) box.value = text || "";
        if (!String(text || "").trim()) {
          if (note) note.textContent = "The clipboard is empty.";
          return;
        }
        fightPasted(text);
      }
      if (navigator.clipboard && navigator.clipboard.readText) {
        navigator.clipboard.readText().then(fill, function () {
          if (note) note.textContent = "Paste into the box, then tap Fight.";
          if (box) box.focus();
        });
      } else {
        if (note) note.textContent = "Paste into the box, then tap Fight.";
        if (box) box.focus();
      }
    };
    const fightFriend = document.getElementById("fightFriend");
    if (fightFriend) fightFriend.onclick = function () {
      const box = document.getElementById("friendIn");
      fightPasted(box ? box.value : "");
    };
    const growthBtn = document.getElementById("openGrowth");
    if (growthBtn) growthBtn.onclick = function () { showGrowth(); };
    const movesBtn = document.getElementById("openMoves");
    if (movesBtn) movesBtn.onclick = function () { showMoves(); };
    const claimBtn = document.getElementById("claimRelic");
    if (claimBtn) claimBtn.onclick = function () {
      const relic = IL.offerRelic(save, takeRng());
      save.relicSeason = save.season;
      holdClubRelic(relic);
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
      save.market = IL.rollMarket(takeRng(), save.renown || 0, rosterAvoid());
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
      const emblem = ev.target.closest("[data-club-crest]");
      if (emblem) {
        const n = +emblem.dataset.clubCrest;
        if (n >= 1 && n <= 16 && save.crest !== n) {
          save.crest = n;
          persist();
          refreshHub();
        }
        return;
      }
      const plateBtn = ev.target.closest("[data-club-plate]");
      if (plateBtn) {
        const n = +plateBtn.dataset.clubPlate;
        if (n >= 0 && n <= 15 && save.plate !== n) {
          save.plate = n;
          persist();
          refreshHub();
        }
        return;
      }
      const filt = ev.target.closest("[data-filter-kind]");
      if (filt) {
        if (filt.dataset.filterKind === "fighters") fighterFilter = filt.dataset.filter;
        if (filt.dataset.filterKind === "market") marketPane = filt.dataset.filter;
        if (filt.dataset.filterKind === "events") eventPane = filt.dataset.filter;
        if (filt.dataset.filterKind === "train") trainPane = filt.dataset.filter;
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
      const openRelic = ev.target.closest("[data-relic-open]");
      if (openRelic) { relicOpen = openRelic.dataset.relicOpen; refreshHub(); return; }
      const setJump = ev.target.closest("[data-set-filter]");
      if (setJump) {
        relicSet = relicSet === setJump.dataset.setFilter ? "all" : setJump.dataset.setFilter;
        refreshHub();
        return;
      }
      const equip = ev.target.closest("[data-equip]");
      if (equip) { toggleEquip(equip.dataset.equip); return; }
      const bindRelic = ev.target.closest("[data-bind-relic]");
      if (bindRelic) { bindFighterRelic(bindRelic.dataset.bindFighter, bindRelic.dataset.bindRelic); return; }
      const clearWorn = ev.target.closest("[data-clear-relic]");
      if (clearWorn) { clearFighterRelic(clearWorn.dataset.clearRelic); return; }
      const train = ev.target.closest("[data-train]");
      if (train && !train.disabled) { trainFighter(train.dataset.train); return; }
      const drillPick = ev.target.closest("[data-drill-pick]");
      if (drillPick) { trainDrill = drillPick.dataset.drillPick; refreshHub(); return; }
      const drill = ev.target.closest("[data-drill]");
      if (drill && !drill.disabled) { trainFighter(drill.dataset.drill, trainDrill); return; }
      const focus = ev.target.closest("[data-focus]");
      if (focus) {
        const who = fighterById(focus.dataset.focus);
        if (who && IL.chooseFocus(who, focus.dataset.spec, save)) { persist(); refreshHub(); }
        return;
      }
      const mastery = ev.target.closest("[data-mastery]");
      if (mastery) {
        const who = fighterById(mastery.dataset.mastery);
        if (who && IL.chooseMastery(who, mastery.dataset.spec, save)) { persist(); refreshHub(); }
        return;
      }
      const facility = ev.target.closest("[data-facility]");
      if (facility && !facility.disabled) { upgradeFacility(facility.dataset.facility); return; }
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
    bindRelicSheet();
    const reroll = document.getElementById("rerollGear");
    if (reroll) reroll.onclick = rerollGear;
    const refreshRelics = document.getElementById("refreshRelics");
    if (refreshRelics) refreshRelics.onclick = refreshRelicStall;
    const rerollDealsBtn = document.getElementById("rerollDeals");
    if (rerollDealsBtn) rerollDealsBtn.onclick = rerollDeals;
  }

  function bindRelicSheet() {
    const status = document.getElementById("relicStatus");
    const rarity = document.getElementById("relicRarity");
    const setSel = document.getElementById("relicSet");
    if (status) status.onchange = function () { relicStatus = status.value; refreshHub(); };
    if (rarity) rarity.onchange = function () { relicRarity = rarity.value; refreshHub(); };
    if (setSel) setSel.onchange = function () { relicSet = setSel.value; refreshHub(); };
    const close = function () { relicOpen = null; refreshHub(); };
    const back = document.getElementById("relicSheetBack");
    if (back) back.onclick = close;
    const closeBtn = document.getElementById("relicSheetClose");
    if (closeBtn) closeBtn.onclick = close;
    const sheet = document.getElementById("relicSheet");
    if (!sheet) return;
    sheet.onclick = function (ev) {
      const equip = ev.target.closest("[data-equip]");
      if (equip) { toggleEquip(equip.dataset.equip); return; }
      const bindRelic = ev.target.closest("[data-bind-relic]");
      if (bindRelic) { bindFighterRelic(bindRelic.dataset.bindFighter, bindRelic.dataset.bindRelic); return; }
      const clearWorn = ev.target.closest("[data-clear-relic]");
      if (clearWorn) { clearFighterRelic(clearWorn.dataset.clearRelic); return; }
      const sellRelic = ev.target.closest("[data-sell-relic]");
      if (sellRelic) { sellRelicId(sellRelic.dataset.sellRelic); return; }
    };
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

  function trainFighter(id, drillId) {
    const f = fighterById(id);
    if (!f || inThePit(f)) return;
    const wanted = drillId || "strength";
    const drill = IL.drillById ? IL.drillById(save, wanted) : null;
    if (!drill) { pitSound("error"); return; }
    const cost = drill.cost;
    const xp = drill.xp;
    if ((save.trainsLeft || 0) <= 0 || save.gold < cost) { pitSound("error"); return; }
    if (IL.applyDrill && !IL.applyDrill(f, drill.id)) { pitSound("error"); return; }
    const lv0 = f.level || 1;
    const moves0 = f.pendingMoves || 0;
    save.gold -= cost;
    save.trainsLeft -= 1;
    save.trainsDone = (save.trainsDone || 0) + 1;
    IL.grantXp(f, xp);
    persist();
    refreshHub();
    const word = { atk: "attack", hp: "health", def: "defense", spd: "speed" }[drill.stat] || "stat";
    let note = f.name + ": " + drill.name + ". +" + drill.amt + " " + word + ", +" + xp + " xp";
    if ((f.level || 1) > lv0) note += ", level " + f.level;
    if ((f.pendingMoves || 0) > moves0) note += ". A new move is open";
    showNote(note + ".");
  }

  function upgradeFacility(id) {
    const def = IL.facilityById && IL.facilityById(id);
    if (!def || !save.facilities) return;
    const lv = save.facilities[id] || 0;
    if (lv >= def.max) return;
    const cost = def.costs[lv];
    if (save.gold < cost) { pitSound("error"); return; }
    save.gold -= cost;
    save.facilities[id] = lv + 1;
    if (id === "yard" && IL.drillCap && (save.trainsLeft || 0) < IL.drillCap(save)) save.trainsLeft += 1;
    pitSound("purchase");
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
    (save.roster || []).forEach(function (f) { if (f && f.relic === id) f.relic = null; });
    const fromSheet = relicOpen === id;
    if (fromSheet) relicOpen = null;
    persist();
    showHub(fromSheet ? "relics" : "market", true);
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
        if (IL.dedupeNames) IL.dedupeNames(save.roster);
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
    if (offer.kind === "gear" || offer.kind === "tome") {
      if (!offer.item) { pitSound("error"); return; }
      save.gold -= offer.cost;
      pitSound("purchase");
      if (!Array.isArray(save.items)) save.items = [];
      save.items.push(offer.item);
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

  function holdClubRelic(relic) {
    if (!relic || relic.scope === "fighter") return;
    if (!Array.isArray(save.equipped)) save.equipped = [];
    if (save.equipped.indexOf(relic.id) >= 0) return;
    if (save.equipped.length < 2) save.equipped.push(relic.id);
  }

  function toggleEquip(id) {
    const relic = IL.relicById(id);
    if (!relic || relic.scope === "fighter") return;
    if ((save.relics || []).indexOf(id) < 0) return;
    const eq = save.equipped || (save.equipped = []);
    const at = eq.indexOf(id);
    let wore = false;
    if (at >= 0) eq.splice(at, 1);
    else if (eq.length < 2) { eq.push(id); wore = true; }
    else { eq.splice(0, 1, id); wore = true; }
    persist();
    showHub("relics", true);
    if (wore) showNote(relic.name + ". " + (relic.blurb || ""));
  }

  function bindFighterRelic(fighterId, relicId) {
    const relic = IL.relicById(relicId);
    if (!relic || relic.scope !== "fighter") return;
    if ((save.relics || []).indexOf(relicId) < 0) return;
    const fighter = fighterById(fighterId);
    if (!fighter) return;
    (save.roster || []).forEach(function (f) { if (f && f.relic === relicId) f.relic = null; });
    fighter.relic = relicId;
    persist();
    showHub("relics", true);
    showNote(relic.name + ". " + (relic.blurb || ""));
  }

  function clearFighterRelic(relicId) {
    (save.roster || []).forEach(function (f) { if (f && f.relic === relicId) f.relic = null; });
    persist();
    showHub("relics", true);
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
      if (IL.dedupeNames) IL.dedupeNames(save.roster);
      save.market.splice(index, 1);
      if (!save.market.length) save.market = IL.rollMarket(takeRng(), save.renown || 0, rosterAvoid());
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
    (spec.extra || []).forEach(function (f) { if (f) people.push(f); });
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
      const party = spec.left || (spec.sides && spec.sides[0] && spec.sides[0].fighters) || [];
      const pack = IL.relicPack(save, party);
      const relics = pack.club.concat(pack.sets);
      const match = spec.sides
        ? IL.createMatch({ seed: spec.seed, sides: spec.sides, relics: relics, wornRelics: pack.worn, mode: spec.mode })
        : IL.createMatch({
          seed: spec.seed,
          left: spec.left,
          right: spec.right,
          leftName: spec.leftName,
          rightName: spec.rightName,
          relics: relics,
          wornRelics: pack.worn,
          mode: spec.mode,
          horde: spec.horde || null,
          king: spec.king || null,
          bossAdds: spec.bossAdds || null,
          mod: spec.mod || null,
          foeRelics: spec.foeRelics || null,
          foeWorn: spec.foeWorn || null
        });
      match.spriteMap = map;
      match.units.forEach(function (u) { u.sprite = map[IL.hero.keyOf(u.parts)]; });
      fight = {
        match: match,
        left: spec.left || (spec.sides && spec.sides[0].fighters) || [],
        right: spec.right || [],
        rival: spec.rival || null,
        size: spec.size || 1,
        mode: spec.mode || "league",
        returnTab: spec.returnTab || "club",
        friendName: spec.friendName || "",
        tok: tok
      };
      IL.currentMatch = match;
      mountFight(match);
      runFight(tok);
    });
  }

  function fightPasted(raw) {
    const note = document.getElementById("friendNote");
    const fault = IL.challengeFault ? IL.challengeFault(raw) : "";
    if (fault) {
      if (note) note.textContent = fault;
      return;
    }
    if (!fielded(save.roster, 1).length) {
      if (note) note.textContent = "Field a fighter first.";
      return;
    }
    const foe = IL.importChallenge(raw);
    if (!foe) {
      if (note) note.textContent = "That code is cut off or damaged.";
      return;
    }
    startChallenge(foe);
  }

  function startChallenge(foe) {
    const cap = IL.PARTY_CAP || 3;
    const have = fielded(save.roster, cap);
    if (!have.length || !foe || !foe.fighters || !foe.fighters.length) return;
    const n = Math.min(have.length, foe.fighters.length, cap);
    const left = have.slice(0, n);
    const right = foe.fighters.slice(0, n);
    const foeRelics = (foe.equipped || []).map(function (id) { return IL.relicById(id); }).filter(Boolean);
    const foeWorn = {};
    right.forEach(function (f) {
      const relic = f && f.relic && IL.relicById(f.relic);
      if (relic) foeWorn[f.id] = relic;
    });
    settingsOpen = false;
    openVersus({
      mode: "challenge",
      left: left,
      right: right,
      leftName: save.clubName,
      rightName: foe.name,
      size: n,
      seed: (save.rngSeed ^ IL.hashStr(foe.name || "ch")) >>> 0,
      returnTab: "events",
      friendName: foe.name || "A friend",
      foeRelics: foeRelics,
      foeWorn: foeWorn
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

  function eventSeed(salt) {
    return (save.rngSeed ^ IL.weekIndex(Date.now()) ^ salt) >>> 0;
  }

  function launchBoss(party) {
    const rng = takeRng();
    const boss = IL.makeBoss(rng, (save.season || 1) + 2);
    const adds = IL.bossAdds(rng, save.season || 1);
    persist();
    return launchMatch({
      mode: "boss", left: party, right: [boss], extra: adds, bossAdds: adds,
      leftName: save.clubName, rightName: boss.name, size: party.length,
      seed: eventSeed(0xB055), returnTab: "events",
      mod: IL.weekFightEvent(Date.now())
    });
  }

  function launchGauntletStep() {
    const g = save.gauntlet;
    if (!g) return;
    const byId = {};
    (save.roster || []).forEach(function (f) { if (f) byId[f.id] = f; });
    const base = (g.ids || []).map(function (id) { return byId[id]; }).filter(Boolean);
    const party = withFractions(base, g.hp);
    if (!party.length || g.step >= 5) {
      save.gauntlet = null;
      showHub("events");
      return;
    }
    const foes = g.fights[g.step];
    return launchMatch({
      mode: "gauntlet", left: party, right: foes,
      leftName: save.clubName, rightName: "Fight " + (g.step + 1), size: party.length,
      seed: eventSeed(0x6A17 + g.step), returnTab: "events",
      mod: IL.weekFightEvent(Date.now())
    });
  }

  function launchGauntlet(party) {
    const g = IL.startGauntlet(takeRng(), party.length, save.season || 1);
    g.ids = party.map(function (f) { return f.id; });
    save.gauntlet = g;
    persist();
    return launchGauntletStep();
  }

  function launchHorde(party) {
    const rng = takeRng();
    const level = save.season || 1;
    const size = Math.min(3, Math.max(2, party.length));
    const wave1 = IL.squadOf(rng, Math.min(2, size), level);
    const later = [
      IL.squadOf(rng, Math.min(3, size), level + 1),
      IL.squadOf(rng, Math.min(3, size), level + 2)
    ];
    return launchMatch({
      mode: "horde", left: party, right: wave1,
      extra: later[0].concat(later[1]),
      horde: { waves: later, next: 0, cleared: 0 },
      leftName: save.clubName, rightName: "The horde", size: party.length,
      seed: eventSeed(0x40DE), returnTab: "events",
      mod: IL.weekFightEvent(Date.now())
    });
  }

  function launchKing(party) {
    const rng = takeRng();
    const waves = [];
    for (let i = 0; i < 5; i++) waves.push(IL.squadOf(rng, 1, 2 + i));
    const first = IL.squadOf(rng, 1, 1);
    return launchMatch({
      mode: "king", left: party.slice(0, 1), right: first,
      extra: waves.reduce(function (all, row) { return all.concat(row); }, []),
      king: { waves: waves, next: 0, cleared: 0 },
      leftName: save.clubName, rightName: "The pit", size: 1,
      seed: eventSeed(0x1116), returnTab: "events",
      mod: IL.weekFightEvent(Date.now())
    });
  }

  function launchMirror(party) {
    const copies = party.map(function (f) { return Object.assign({}, f, { id: "mir-" + f.id }); });
    return launchMatch({
      mode: "mirror", left: party, right: copies,
      leftName: save.clubName, rightName: "Mirror", size: party.length,
      seed: eventSeed(0x1110), returnTab: "events",
      mod: IL.weekFightEvent(Date.now())
    });
  }

  function beginEvent() {
    const ev = IL.activeEvent(Date.now());
    if (!ev || weekDone(ev.id)) return;
    const party = eventParty();
    if (!party.length) return;
    if (ev.id === "boss") return launchBoss(party);
    if (ev.id === "gauntlet") return launchGauntlet(party);
    if (ev.id === "horde") return launchHorde(party);
    if (ev.id === "king") return launchKing(party);
    if (ev.id === "mirror") return launchMirror(party);
  }

  function launchEndlessWave() {
    const run = save.endlessRun;
    if (!run) return;
    const party = withFractions(eventParty(), run.hp);
    if (!party.length) {
      IL.noteEndless(save, Math.max(0, (run.wave || 1) - 1));
      save.endlessRun = null;
      persist();
      showHub("events");
      return;
    }
    const rng = takeRng();
    const count = Math.min(3, 1 + Math.floor(((run.wave || 1) - 1) / 3));
    const foes = IL.squadOf(rng, count, 1 + Math.floor((run.wave || 1) * 0.55));
    return launchMatch({
      mode: "endless", left: party, right: foes, mod: IL.endlessMod(run.wave),
      leftName: save.clubName, rightName: "Wave " + run.wave, size: party.length,
      seed: ((save.rngSeed ^ ((run.wave || 1) * 131)) >>> 0) || 1,
      returnTab: "events"
    });
  }

  function beginEndless() {
    if (!save.endlessRun || typeof save.endlessRun.wave !== "number") save.endlessRun = { wave: 1, hp: {} };
    persist();
    return launchEndlessWave();
  }

  function beginDaily() {
    const day = IL.dayIndex(Date.now());
    if (save.daily && save.daily.day === day && save.daily.cleared) return;
    const party = eventParty().slice(0, 2);
    if (!party.length) return;
    return launchMatch({
      mode: "daily", left: party, right: IL.dailySquad(day, save.season || 1),
      leftName: save.clubName, rightName: "Daily", size: party.length,
      seed: (day * 9973 + 17) >>> 0, returnTab: "events",
      mod: IL.weekFightEvent(Date.now())
    });
  }

  function keepRelic(id) {
    if (id && id !== "gold") {
      if ((save.relics || []).indexOf(id) < 0) save.relics.push(id);
    } else save.gold += 20;
    save.endlessPick = null;
    persist();
    launchEndlessWave();
  }

  function relicPickHtml() {
    return '<div class="chips">' + (save.endlessPick || []).map(function (id) {
      const relic = id === "gold" ? null : IL.relicById(id);
      return '<button type="button" class="chip" data-keep-relic="' + esc(id) + '">' + esc(relic ? relic.name : "20 gold") + '</button>';
    }).join("") + '</div>';
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
        (match.hazardName ? '<p class="hazard-line" id="pitBanner"><strong>' + esc(match.hazardName) + '</strong>' + (match.hazardBlurb ? '<span>' + esc(match.hazardBlurb) + '</span>' : '') + '</p>' : '') +
        '<div class="hud-strip" id="liveYou"></div>' +
        '<div class="fight-layout">' +
          '<div class="stage"><canvas id="arena" width="1440" height="900"></canvas><div id="dmgMeter" class="dmg-meter" hidden></div><div id="result" class="result" hidden></div></div>' +
        '</div>' +
        '<div class="hud-strip" id="liveThem"></div>' +
        '<footer class="fight-controls">' +
          speedButtons() +
          '<button type="button" class="btn ghost" id="meter">Meter</button>' +
          '<button type="button" class="btn ghost" id="pause">Pause</button>' +
          '<button type="button" class="btn primary" id="skip">Skip</button>' +
        '</footer>' +
      '</main>';
    document.getElementById("leftName").innerHTML = crestHtml(match.leftName, "sm", save.crest, save.plate) + '<span class="club-name">' + esc(match.leftName) + '</span>';
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
    document.getElementById("meter").onclick = toggleMeter;
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

  function toggleMeter() {
    meterOn = !meterOn;
    const btn = document.getElementById("meter");
    const box = document.getElementById("dmgMeter");
    if (btn) {
      btn.classList.toggle("on", meterOn);
      btn.textContent = meterOn ? "Hide" : "Meter";
    }
    if (box) box.hidden = !meterOn;
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
    const fx = { shake: 0, nums: [], booms: [], rings: [], beams: [], sprites: [], sigs: [], t: 0, cam: null };
    function pitPoint(ev) {
      const r = canvas.getBoundingClientRect();
      fx.pointer = { x: ev.clientX - r.left, y: ev.clientY - r.top, stick: ev.type === "pointerdown" || !!fx.stickId };
      if (ev.type === "pointerdown") fx.pointer.stick = true;
    }
    canvas.addEventListener("pointermove", pitPoint);
    canvas.addEventListener("pointerdown", pitPoint);
    canvas.addEventListener("pointerleave", function () { fx.pointer = null; });
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
      } else if (e.type === "ring") {
        if (!fx.rings) fx.rings = [];
        fx.rings.push({ x: e.x, y: e.y, r: e.r || 64, kind: e.kind, t: 0, life: 0.45 });
      } else if (e.type === "beam") {
        if (!fx.beams) fx.beams = [];
        fx.beams.push({ x: e.x, y: e.y, x2: e.x2, y2: e.y2, kind: e.kind, t: 0, life: 0.32 });
      } else if (e.type === "sig") {
        if (!fx.sigs) fx.sigs = [];
        fx.sigs.push({
          style: e.style,
          mark: e.mark || "",
          x: e.x,
          y: e.y,
          x2: e.x2,
          y2: e.y2,
          x3: e.x3,
          y3: e.y3,
          hop: e.hop || 0,
          rgb: e.rgb || "244,210,150",
          r: e.r || 64,
          facing: e.facing || 1,
          t: 0,
          life: e.life || 0.6
        });
        if (e.sheet && IL.fx) {
          const ground = e.style === "ring" || e.style === "dust" || e.style === "summon";
          const sx = e.style === "trail" || e.style === "chain" ? e.x2 : e.x;
          const sy = e.style === "trail" || e.style === "chain" ? e.y2 : e.y;
          IL.fx.spawn(fx.sprites, e.sheet, sx, sy, {
            size: e.size || 150,
            ground: ground,
            facing: e.facing,
            team: e.team
          });
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
    if (fx.rings) fx.rings = fx.rings.filter(function (r) { r.t += dt; return r.t < r.life; });
    if (fx.beams) fx.beams = fx.beams.filter(function (b) { b.t += dt; return b.t < b.life; });
    if (fx.sigs) fx.sigs = fx.sigs.filter(function (s) { s.t += dt; return s.t < s.life; });
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
      rows[i].classList.toggle("hot", !!IL.pitFocusId && u.id === IL.pitFocusId);
      const fill = rows[i].querySelector(".fill");
      if (fill) fill.style.width = Math.max(0, u.hp / u.maxHp * 100) + "%";
      const num = rows[i].querySelector(".hp-num");
      if (num) num.textContent = Math.max(0, Math.round(u.hp)) + "/" + Math.round(u.maxHp);
    }
    paintMeter(match);
  }

  function paintMeter(match) {
    const box = document.getElementById("dmgMeter");
    if (!box || !meterOn) return;
    const units = match.units.filter(function (u) { return u && !u.summon; });
    let top = 1;
    units.forEach(function (u) { top = Math.max(top, u.dmgDealt || 0); });
    units.sort(function (a, b) { return (b.dmgDealt || 0) - (a.dmgDealt || 0); });
    box.innerHTML = units.slice(0, 8).map(function (u) {
      const name = String(u.name || "").trim().split(/\s+/)[0] || "Fighter";
      const n = u.dmgDealt || 0;
      const pct = Math.max(4, Math.round(100 * n / top));
      return '<p class="' + (u.team === 0 ? "you" : "them") + '"><span>' + esc(name) + '</span><b>' + n + '</b></p>' +
        '<i class="' + (u.team === 0 ? "you" : "them") + '" style="width:' + pct + '%"></i>';
    }).join("");
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

  function abBreakdown(u) {
    const book = u.byAb || {};
    const rows = Object.keys(book).map(function (id) { return book[id]; }).filter(function (r) {
      return r && ((r.dmg || 0) > 0 || (r.heal || 0) > 0 || r.used);
    });
    rows.sort(function (a, b) { return ((b.dmg || 0) + (b.heal || 0)) - ((a.dmg || 0) + (a.heal || 0)); });
    if (!rows.length) return "";
    const text = rows.map(function (r) {
      const bits = [];
      if (r.dmg) bits.push(String(r.dmg));
      if (r.heal) bits.push("+" + r.heal);
      return r.name + (bits.length ? " " + bits.join(" ") : "");
    }).join(" · ");
    return '<p class="ab-break">' + esc(text) + "</p>";
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
          (b.up ? ' <em class="level-call">Level ' + b.lv + '</em>' : '') +
          abBreakdown(u) + '</td>' +
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
        abBreakdown(u) +
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

  function nemesisPay(match, win) {
    const n = save.nemesis;
    if (!n || !n.name || !match) return 0;
    if ((match.teams || 2) > 2) return 0;
    if ((match.rightName || "") !== n.name) return 0;
    let bonus = 0;
    if (win) {
      if ((n.grudge || 0) > 0) bonus = 12;
      n.wins = (n.wins || 0) + 1;
      n.grudge = Math.max(0, (n.grudge || 0) - 1);
    } else {
      n.losses = (n.losses || 0) + 1;
      n.grudge = Math.min(3, (n.grudge || 0) + 1);
    }
    return bonus;
  }

  function ensureCareer(f) {
    if (!f.career || typeof f.career !== "object") {
      const season = f.season || {};
      f.career = {
        dealt: season.dealt || 0,
        taken: season.taken || 0,
        heal: season.heal || 0,
        kos: season.kos || 0,
        moves: {}
      };
    }
    const career = f.career;
    if (typeof career.dealt !== "number") career.dealt = 0;
    if (typeof career.taken !== "number") career.taken = 0;
    if (typeof career.heal !== "number") career.heal = 0;
    if (typeof career.kos !== "number") career.kos = 0;
    if (!career.moves || typeof career.moves !== "object") career.moves = {};
    return career;
  }

  function noteRecords(match, win) {
    const byId = {};
    (save.roster || []).forEach(function (f) { if (f && f.id) byId[f.id] = f; });
    match.units.forEach(function (u) {
      if (!u || u.team !== 0) return;
      const f = byId[u.id];
      if (!f) return;
      const career = ensureCareer(f);
      if (win) f.wins = (f.wins || 0) + 1;
      else f.losses = (f.losses || 0) + 1;
      f.kos = (f.kos || 0) + (u.kos || 0);
      if (!f.season) f.season = { dealt: 0, taken: 0, heal: 0, kos: 0 };
      f.season.dealt += u.dmgDealt || 0;
      f.season.taken += u.dmgTaken || 0;
      f.season.heal += u.healing || 0;
      f.season.kos += u.kos || 0;
      career.dealt += u.dmgDealt || 0;
      career.taken += u.dmgTaken || 0;
      career.heal += u.healing || 0;
      career.kos += u.kos || 0;
      const book = u.byAb || {};
      Object.keys(book).forEach(function (id) {
        const row = book[id];
        if (!row || !id) return;
        const slot = career.moves[id] || (career.moves[id] = { id: id, name: row.name || id, dmg: 0, heal: 0 });
        if (row.name) slot.name = row.name;
        slot.dmg += row.dmg || 0;
        slot.heal += row.heal || 0;
      });
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
            holdClubRelic(relic);
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
    } else if (mode === "boss") {
      gold = win ? 70 : 18;
      renown = win ? 8 : 2;
      headline = win ? "The warden falls" : "The warden stands";
      if (win) {
        save.weekClear = { week: IL.weekIndex(Date.now()), id: "boss" };
        if (takeRng()() < 0.5) {
          const relic = IL.offerRelic(save, takeRng());
          if (relic) relicNote = " Relic: " + relic.name + ".";
        }
      }
    } else if (mode === "gauntlet") {
      const g = save.gauntlet;
      if (g) {
        g.hp = hpFractions(match);
        if (win) {
          g.wins = (g.wins || 0) + 1;
          g.step = (g.step || 0) + 1;
        }
        gold = 16 * (g.wins || 0);
        renown = 2 * (g.wins || 0);
        headline = win ? ("Fight " + g.wins + " of 5") : "The gauntlet stops";
        if (!win || g.step >= 5) {
          if (win) save.weekClear = { week: IL.weekIndex(Date.now()), id: "gauntlet" };
          save.gauntlet = null;
        }
      }
    } else if (mode === "horde") {
      const cleared = (match.horde && match.horde.cleared) || (win ? 3 : 0);
      gold = win ? 48 : 8 * cleared;
      renown = win ? 6 : 1;
      headline = win ? "The horde breaks" : "The horde rolls on";
      if (win) save.weekClear = { week: IL.weekIndex(Date.now()), id: "horde" };
    } else if (mode === "king") {
      const cleared = (match.king && match.king.cleared) || 0;
      gold = 8 * cleared;
      renown = 3 * cleared;
      headline = win ? "King of the pit" : ("Held " + cleared + (cleared === 1 ? " wave" : " waves"));
      if (win) save.weekClear = { week: IL.weekIndex(Date.now()), id: "king" };
    } else if (mode === "mirror") {
      gold = win ? 24 : 10;
      renown = win ? 10 : 4;
      headline = win ? "You outlast yourself" : "The mirror wins";
      if (win) save.weekClear = { week: IL.weekIndex(Date.now()), id: "mirror" };
    } else if (mode === "daily") {
      gold = win ? 36 : 8;
      renown = win ? 4 : 1;
      headline = win ? "The day is yours" : "The day stands";
      const day = IL.dayIndex(Date.now());
      const already = save.daily && save.daily.day === day && save.daily.cleared;
      save.daily = { day: day, cleared: already || win };
    } else if (mode === "challenge") {
      const friend = fight.friendName || match.rightName || "A friend";
      gold = win ? 20 : 8;
      renown = win ? 2 : 1;
      headline = win ? (friend + " falls") : (friend + " holds");
    } else if (mode === "endless") {
      const run = save.endlessRun || { wave: 1, hp: {} };
      if (win) {
        gold = 8 + run.wave * 2;
        renown = 1;
        xp = 6;
        headline = "Wave " + run.wave + " cleared";
        run.hp = hpFractions(match);
        const cleared = run.wave;
        run.wave = cleared + 1;
        save.endlessRun = run;
        if (cleared % 5 === 0) save.endlessPick = IL.relicChoices(save, takeRng());
      } else {
        const cleared = Math.max(0, (run.wave || 1) - 1);
        IL.noteEndless(save, cleared);
        save.endlessRun = null;
        save.endlessPick = null;
        gold = 6 + cleared * 2;
        renown = 1;
        headline = cleared ? ("Stopped after wave " + cleared) : "The pit stops you";
      }
    } else {
      if (win) save.tokens = (save.tokens || 0) + 1;
      recordRound(win, pf, pa);
    }
    const renownPack = IL.relicPack(save, fight.left || []);
    const renownOn = renownPack.club.concat(renownPack.sets).some(function (r) { return r.kind === "renown"; })
      || Object.keys(renownPack.worn).some(function (id) { return renownPack.worn[id] && renownPack.worn[id].kind === "renown"; });
    if (renownOn) renown = Math.round(renown * 1.25);
    gold += match.stats.bounty || 0;
    noteRecords(match, win);
    if (IL.noteTasks) IL.noteTasks(save, match, win);
    save.bouts = (save.bouts || 0) + 1;
    if (win) save.clubWins = (save.clubWins || 0) + 1;
    else save.clubLosses = (save.clubLosses || 0) + 1;
    gold += nemesisPay(match, win);
    if (win) {
      let taken = 0;
      match.units.forEach(function (u) { if (u.team === 0) taken += u.dmgTaken || 0; });
      if (taken <= 0) save.flawless = (save.flawless || 0) + 1;
    }
    const before = {};
    const xpBefore = {};
    const statBefore = {};
    const movesBefore = {};
    fight.left.forEach(function (f) {
      if (!f) return;
      before[f.id] = f.level;
      xpBefore[f.id] = f.xp || 0;
      movesBefore[f.id] = f.pendingMoves || 0;
      const kit = IL.CLASSES[f.cls];
      if (kit && IL.scaledStats) statBefore[f.id] = IL.scaledStats(f, kit);
      IL.grantXp(f, xp);
    });
    const tally = resultTable(match, xpBefore, before);
    pushHistory(match, win, tally.mvp ? tally.mvp.name : "");
    save.gold += gold;
    save.renown = (save.renown || 0) + renown;
    let loot = null;
    const eventLoot = (mode === "boss" && win) || (mode === "horde" && win) || (mode === "daily" && win) || (mode === "gauntlet" && win && !save.gauntlet);
    if (mode === "league" || mode === "chaos" || (mode === "cup" && win) || eventLoot) {
      const bag = mode === "cup" ? "cup" : (win ? "win" : "loss");
      loot = IL.rollLoot(takeRng(), bag);
      if (!Array.isArray(save.items)) save.items = [];
      save.items.push(loot);
    }
    persist();
    const flashes = [];
    const unlocks = [];
    fight.left.forEach(function (f) {
      if (!f || !(f.level > before[f.id])) return;
      const kit = IL.CLASSES[f.cls];
      const now = kit && IL.scaledStats ? IL.scaledStats(f, kit) : null;
      const was = statBefore[f.id];
      const parts = [];
      if (now && was) {
        const dh = now.hp - was.hp;
        const da = now.atk - was.atk;
        if (dh) parts.push((dh > 0 ? "+" : "") + dh + " health");
        if (da) parts.push((da > 0 ? "+" : "") + da + " attack");
      }
      flashes.push(
        '<p class="level-flash"><strong>' + esc(f.name) + " reached level " + f.level + "</strong>" +
        (parts.length ? "<span>" + esc(parts.join(" · ")) + "</span>" : "") + "</p>"
      );
      if ((f.pendingMoves || 0) > (movesBefore[f.id] || 0)) {
        unlocks.push(
          '<article class="unlock-card"><p class="eyebrow">New ability</p><strong>' + esc(f.name) + "</strong><p>Level " + f.level + " opens a move.</p></article>"
        );
      }
    });
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
    } else if (mode === "endless" && win && save.endlessRun) {
      const mod = IL.endlessMod(save.endlessRun.wave);
      nextLine = "Wave " + save.endlessRun.wave + " is next." + (mod ? " Modifier: " + mod.name + ". " + mod.blurb : "");
    } else if (mode === "gauntlet" && save.gauntlet) {
      nextLine = "No healing. Fight " + (save.gauntlet.step + 1) + " of 5 is next.";
    } else if (mode === "challenge") {
      nextLine = "Fought " + (fight.friendName || match.rightName || "a friend") + ".";
    } else if (mode === "boss" || mode === "horde" || mode === "king" || mode === "mirror" || mode === "daily" || mode === "gauntlet" || mode === "endless") {
      nextLine = "The events board is ready when you are.";
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
        flashes.join("") +
        unlocks.join("") +
        (pendingGrowth().length ? '<p class="level-call">A perk is waiting.</p>' : '') +
        tally.html +
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
        ((mode === "endless" && win && save.endlessPick && save.endlessPick.length) ? relicPickHtml() : '') +
        (((mode === "endless" && win && !(save.endlessPick && save.endlessPick.length)) || (mode === "gauntlet" && win && save.gauntlet))
          ? '<button type="button" class="btn fight" id="nextWave">' + (mode === "gauntlet" ? "Next fight" : "Next wave") + '</button>' : '') +
        '<button type="button" class="btn primary" id="backHub">' + (fight.returnTab === "events" ? "Back to events" : "Back to club") + '</button>' +
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
      else showHub(fight.returnTab || "club");
    };
    const nextWave = document.getElementById("nextWave");
    if (nextWave) nextWave.onclick = function () {
      IL.currentMatch = null;
      if (mode === "gauntlet") launchGauntletStep();
      else launchEndlessWave();
    };
    box.querySelectorAll("[data-keep-relic]").forEach(function (btn) {
      btn.onclick = function () {
        IL.currentMatch = null;
        keepRelic(btn.getAttribute("data-keep-relic"));
      };
    });
    paintHud(match);
    const canvas = document.getElementById("arena");
    if (canvas) {
      const fx = { shake: 0, nums: [], booms: [], rings: [], beams: [], sprites: [], sigs: [], t: 0, cam: null };
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
    save.trainsLeft = IL.drillCap ? IL.drillCap(save) : (IL.TRAIN_CAP || 2);
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
    if (ev.key < "1" || ev.key > "9") return;
    if (ev.key.charCodeAt(0) - 49 >= HUB_TABS.length) return;
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
  function classGalleryOn() {
    let q = "";
    try { q = (root.location && root.location.search) || ""; } catch (err) { q = ""; }
    return /(?:^|[?&])debug=classes(?:&|$)/.test(q);
  }

  function showClassGallery() {
    const beats = [];
    Object.keys(IL.CLASSES).forEach(function (id) {
      const kit = IL.CLASSES[id];
      const starters = (kit.abilities || []).filter(function (ab) { return ab && ab.unlock && ab.unlock <= 7; }).slice(0, 3);
      const basic = IL.attackOf ? IL.attackOf(id) : { name: "Attack" };
      beats.push({ cls: id, which: "basic", label: basic.name, kit: kit.name });
      starters.forEach(function (ab, i) {
        beats.push({ cls: id, which: i, label: ab.name + (ab.ult ? " · ultimate" : ""), kit: kit.name });
      });
    });
    let index = 0;
    let match = null;
    let fx = null;
    let beatT = 0;
    const spriteCache = {};
    app.innerHTML =
      '<main class="fight-screen class-gallery">' +
        '<header class="bar gal-bar">' +
          '<strong id="galKit">Classes</strong>' +
          '<span id="galBeat">Loading</span>' +
        '</header>' +
        '<div class="stage"><canvas id="arena" width="1440" height="900"></canvas></div>' +
        '<footer class="fight-controls">' +
          '<button type="button" class="btn ghost" id="galPrev">Back</button>' +
          '<button type="button" class="btn primary" id="galNext">Next</button>' +
        '</footer>' +
      '</main>';
    const canvas = document.getElementById("arena");
    const ctx = canvas.getContext("2d");
    function paintCaption() {
      const beat = beats[index];
      const kit = document.getElementById("galKit");
      const line = document.getElementById("galBeat");
      if (kit) kit.textContent = beat.kit;
      if (line) line.textContent = beat.label + " · " + (index + 1) + " / " + beats.length;
    }
    function arm(i) {
      index = (i + beats.length) % beats.length;
      beatT = 0;
      const beat = beats[index];
      match = IL.showcase(beat.cls, beat.which);
      fx = { shake: 0, nums: [], booms: [], rings: [], beams: [], sprites: [], sigs: [], t: 0, cam: null };
      paintCaption();
      const jobs = [];
      match.units.forEach(function (u) {
        if (!u.parts) return;
        const key = IL.hero.keyOf(u.parts);
        if (spriteCache[key]) u.sprite = spriteCache[key];
        else jobs.push(IL.hero.compose(u.parts).then(function (c) { spriteCache[key] = c; u.sprite = c; }));
      });
      return Promise.all(jobs);
    }
    document.getElementById("galPrev").onclick = function () { arm(index - 1); };
    document.getElementById("galNext").onclick = function () { arm(index + 1); };
    let last = performance.now();
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      fx.t += dt;
      beatT += dt;
      if (match && !match.over) {
        IL.stepMatch(match, dt);
        consume(match, fx);
      }
      ageFx(fx, dt);
      if (beatT > 1.45) arm(index + 1);
      IL.drawArena(ctx, match, fx);
      raf = requestAnimationFrame(frame);
    }
    arm(0).then(function () {
      raf = requestAnimationFrame(frame);
    });
  }

  loadIconAtlas();
  if (classGalleryOn() && IL.showcase) showClassGallery();
  else showTitle();
})(typeof window !== "undefined" ? window : globalThis);
