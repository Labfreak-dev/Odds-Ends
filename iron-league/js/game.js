/* Iron League — screens, save, and the fight loop. */
(function (root) {
  const IL = root.IL = root.IL || {};
  const SAVE_KEY = "ironleague.v1";
  /* Raise WIPE to reset every player's progress: a save stamped lower is
     thrown away on the next load. 1 = the October 2026 tester reset. */
  const WIPE = 1;
  let wipedNow = false;
  const app = document.getElementById("app");

  let save = null;
  let token = 0;
  let raf = 0;
  let draft = null;
  let speed = 1;
  let fight = null;
  let hubTab = "overview";
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
  let identityOpen = false;
  let clubView = "table";
  let fightMenuOpen = false;
  let armorySlot = "all";
  let armoryRarity = "all";
  let armorySort = "rarity";
  let fighterFilter = "all";
  let marketPane = "fighters";
  let swapPick = "";
  let eventPane = "week";
  let trainPane = "drills";
  let trainDrill = "strength";
  let relicStatus = "all";
  let relicRarity = "all";
  let relicSet = "all";
  let relicOpen = null;
  let tutorStep = 0;
  /* v71 hub, after Eslabong: six tabs. Old tab names still work and land
     on the pane that now holds them (tabAlias). */
  const HUB_TABS = ["overview", "matches", "roster", "club", "market", "intel"];
  const TAB_ALIAS = {
    fighters: ["roster"], cup: ["matches", "cups"], relics: ["roster", "relics"],
    events: ["club", "events"], train: ["club", "train"], armory: ["roster", "team"], history: ["matches", "history"]
  };
  let matchesPane = "league";
  let rosterPane = "team";
  /* v89 party board: the fighter picked to swap, and whose gear drawer is open. */
  let partySwap = null;
  let partyGear = null;
  let clubPane = "home";
  let intelPane = "stats";
  let inboxOpen = false;
  let feedFilter = "all";
  let marketPick = 0;
  let marketFilter = "all";
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
      if (data && (data.wipe || 0) < WIPE) {
        localStorage.removeItem(SAVE_KEY);
        wipedNow = true;
        return null;
      }
      if (!data || data.v !== 1 || !Array.isArray(data.roster) || !data.roster.length) return null;
      if (!Array.isArray(data.clubs) || !Array.isArray(data.fixtures)) return null;
      return IL.migrate(data);
    } catch (err) {
      return null;
    }
  }

  function persist() {
    try {
      save.wipe = WIPE;
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

  /* v73: the season is as long as its fixture list (7 weeks now; an
     older save finishes its 5-week season first). */
  function seasonWeeks() {
    return (save && Array.isArray(save.fixtures) && save.fixtures.length) || IL.SEASON_SIZES.length;
  }
  function weekSize(r) {
    return IL.SEASON_SIZES[(r | 0) % IL.SEASON_SIZES.length];
  }
  function seasonDone() {
    return !!save && (save.round || 0) >= seasonWeeks();
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
    while (rivals.length < (IL.LEAGUE_CLUBS || 8) - 1 && pool.length) {
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
    /* v106 named teams take some rival places, never the nemesis's. */
    const named = IL.eligibleNamed ? IL.eligibleNamed(save).slice() : [];
    const namedWant = Math.min(named.length, IL.divisionOf(save) >= 1 ? 3 : 2);
    const namedPicked = [];
    while (namedPicked.length < namedWant && named.length) namedPicked.push(named.splice(Math.floor(rng() * named.length), 1)[0]);
    namedPicked.forEach(function (t, k) {
      for (let j = 0; j < rivals.length; j++) {
        if (rivals[j] !== nemesisName && !IL.namedTeam(rivals[j])) { rivals[j] = t.name; break; }
      }
    });
    const clubs = [{ id: "you", name: save.clubName, you: true, w: 0, l: 0, pts: 0, pf: 0, pa: 0, str: 1 }];
    /* v65: rivals match the club's level (one either way, never under the
       division floor), wear division gear, and take real level-ups. */
    const tier = IL.divisionOf(save);
    rivals.forEach(function (name, i) {
      const team = IL.namedTeam ? IL.namedTeam(name) : null;
      /* v106 four fighters a club: one on the bench to rest. */
      const fighters = team ? IL.namedFighters(save, team, rng, function (k) { return IL.rivalLevel(save, i, k); }) : [0, 1, 2, 3].map(function (k) {
        const fighter = IL.themedFighter ? IL.themedFighter(rng, name) : IL.randomFighter(rng);
        if (IL.dressRival) IL.dressRival(fighter, rng, tier);
        IL.growRival(fighter, rng, IL.rivalLevel(save, i, k));
        return fighter;
      });
      const str = fighters.slice(0, 3).reduce(function (s, f) {
        return s + (f.cls === "tank" ? 1.12 : f.cls === "mage" ? 1.06 : 1);
      }, 0) / 3 * (team ? 1.05 : 1);
      if (IL.dedupeNames) IL.dedupeNames(fighters);
      if (IL.separateLooks) IL.separateLooks(fighters);
      const club = { id: "c" + i, name: name, you: false, w: 0, l: 0, pts: 0, pf: 0, pa: 0, str: str, swing: i, fighters: fighters };
      if (IL.dressRivalRelics) IL.dressRivalRelics(club, rng, tier);
      if (team) {
        club.named = true;
        club.leader = team.leader;
        club.style = team.style;
        club.formation = team.formation;
        const sigRelic = team.relic && IL.relicById(team.relic);
        if (sigRelic && sigRelic.scope !== "fighter" && club.equipped.indexOf(sigRelic.id) < 0) club.equipped.unshift(sigRelic.id);
      }
      clubs.push(club);
    });
    save.clubs = clubs;
    save.round = 0;
    /* v93: home and away, 14 weeks for eight clubs, as long seasons go. */
    const firstHalf = roundRobin(clubs.map(function (c) { return c.id; }));
    const secondHalf = firstHalf.map(function (pairs) { return pairs.map(function (p) { return [p[1], p[0]]; }); });
    save.fixtures = firstHalf.concat(secondHalf);
    const modCount = IL.DIFFICULTY ? IL.DIFFICULTY[IL.difficultyOf(save)].mods : 2;
    save.mods = IL.pickSeasonMods && !(save.settings && save.settings.noMods) ? IL.pickSeasonMods(rng, modCount) : [];
    save.seasonGoals = IL.pickSeasonGoals ? IL.pickSeasonGoals(rng) : [];
    (save.roster || []).forEach(function (f) { f.lv0 = f.level || 1; f.lv0Season = save.season; });
    save.streak = 0;
    save.streakBest = 0;
    save.streakSeason = save.season;
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
    if (!save || seasonDone()) return null;
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
    beastmaster: "swords", templar: "shield", frostknight: "sword", witchhunter: "bow"
  };
  const NAV_GLYPH = { overview: "shield", matches: "chest", roster: "swords", club: "preparing_for_an_attack", market: "cargo_bag", intel: "wizards_cap" };
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
      '<span class="coin"><i class="ico ico-roster" aria-hidden="true"></i><b>' + (save.roster || []).length + "/" + IL.rosterCap(save) + '</b> roster</span>' +
      '<span class="coin"><i class="ico ico-relic" aria-hidden="true"></i><b>' + eq.length + "/2</b> relics" + (eq.length ? " · " + esc(eq.map(function (r) { return r.name; }).join(", ")) : "") + '</span>' +
    '</div>';
  }

  /* v97 the club's own feed (Events, "Club" filter). */
  function logClub(text) {
    if (!save) return;
    if (!Array.isArray(save.clubLog)) save.clubLog = [];
    save.clubLog.unshift(String(text));
    if (save.clubLog.length > 20) save.clubLog.length = 20;
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
    "Three new classes (Templar, Frost Knight, Witch Hunter), and every champion now has a signature move of its own.",
    "Milestones: an ability upgrade every 5 levels from 14 and more masteries from level 27. Respec rebuilds a fighter's upgrades, Rebirth re-rolls growth grades, and evolutions can be skipped.",
    "Eleven personalities with their own quirks and default tactics, new Healing priority, Protect and Opening tactics, and five tactic presets.",
    "Transfers: buy, swap or loan fighters straight from rival rosters on the Market, and loan your bench out for gold and XP.",
    "Difficulty: Relaxed, Normal, Hard and Infernus in Settings, plus options for no champion signings and no season modifiers.",
    "Named rivals: twelve handcrafted clubs with leaders, styles and signature moves. Every rival now has a bench, wears relics, rests tired fighters, and the better ones prepare against your last three lineups.",
    "Ability costs and friendly fire: spells spend mana and physical moves spend stamina. Blasts now catch allies too, and a new Friendly fire tactic decides how careful each fighter is.",
    "League matches are now best of three. Between rounds you see the score and can change the formation.",
    "The Academy: send young fighters to a weekly 3v3 youth league that costs no week and no stamina. Wins earn Development Tomes, which lift a fighter to the club's average level.",
    "The Chaos Thunder Cup: twice a season, four clubs in one pit, three free-for-all rounds, with points by place and a purse by final standing.",
    "Staff: hire a Trainer, Medic, Scout, Captain Coach and Treasurer from a weekly staff market. The new Club House adds staff slots.",
    "Injuries: a knocked-out fighter may be hurt for 1 to 3 league weeks, by its injury risk. The bench covers, and the Medical Bay heals for gold. You can switch injuries off in Settings.",
    "Live orders in the pit: Plan, Attack, Regroup and Hold, from the bar at the top-left or keys F1 to F4.",
    "Polish: a new Area moves tactic (Anyone, 2 or more, 3 or more), season Impact and assists on the Intel boards, evolution marks on move cards, and Unequip all for relics.",
    "Before and after the fight: pick a formation and read a scouting report on the rival before the pit. Results now show K/D/A and an Impact score for both sides. Save three lineups on the Party board, and filter the Events feed.",
    "Abilities v2: new moves that pull, root, silence, chain lightning, drain life, raise a fallen ally, and fire shots that follow their target. At level 20 and 50 each fighter evolves a move, choosing one of two new effects.",
    "Relics v2: every relic shows its exact numbers and its own roll (85% to 115%). Fighters wear two relics from level 10. Four named legendaries (Phoenix Feather, Bloodvine Ring, Mirror Aegis, Blink Stone), relics that teach a move, a stall that restocks every week, and Auto-equip.",
    "Better fighters: every recruit rolls Balanced, Good or Excellent growth per stat and shows 1 to 5 potential stars. Shiny fighters (1 in 250) start 20% stronger. Champions carry a second class's passive, go to auction against rival clubs, and sometimes ask to join you.",
    "Longer seasons that pay: 14 weeks home and away, a free MidCup after week 7, two season modifiers, five season goals that pay on the spot, and a season chest of gold, gear and relics by where you finish.",
    "Clearer, smarter fights: spells mark their real landing zone and flash before they hit, cleaves show their ring, charges their path, casters a cast bar. Autobattle fighters step out of marked spells, focus the same target, finish the wounded, protect their casters, and save area moves for groups.",
    "A party board on Roster: swap a fighter in two taps, open anyone's gear right under them, and hire from the market without leaving. Gear equips in one tap, with the stat change on every item.",
    "Class passives work: every class has a real passive with a set number, shown on its sheet (Bard: the team deals 15% more damage; Druid: the team regains 3 HP a second).",
    "Clear move text: every skill, upgrade and passive now says exactly what it does, with real damage, durations and cooldowns.",
    "Fairer early seasons: a young club meets rivals one level either way. The swing widens with the club, up to six each way at level 24.",
    "Six new moves for every class, 162 in all: learn them on level up and swap them into a slot. Every kit now has fourteen.",
    "Levels run to 100. Rival clubs keep pace, from six under your level to six over, and level up with you through the season. Maxed moves and passives rank up, then Hone adds stats.",
    "Fresh start: all progress was reset for a balance pass. Every club begins again in Division V.",
    "The Iron Gate: eight floors once a week, bosses on 5, 7 and 8, health carried floor to floor, a chest at every boss.",
    "Quieter menus: the hub music's ticking hi-hat is gone. Cleaner popups, and Events opens the right page.",
    "Transfers: rival clubs bid for your fighters (accept or decline in Events), and list their own fighters on the market.",
    "Intel: club leaders and records, every rival roster in the division, and an Archive of classes, clubs, champions, relics and how the game works.",
    "The Champions Cup: when the league closes, its top four play 3v3 knockouts before the ceremony. The winner takes a relic.",
    "Club facilities: Headquarters, Training Grounds, Time Chamber, Barracks, Medical Bay, Scouting Office and Treasure House.",
    "A trading-floor market: every listing in one list with stats and price, the picked fighter's full card beside it, and filters for affordable, watched, champions and scouted.",
    "Longer seasons: eight clubs a division and seven league weeks, shown as Division V (Sand) up to Division I (Crown).",
    "Roster cards like the mercenary leagues: stats, moves, gear and behavior per fighter, and a full sheet with market value and performance score.",
    "A new club hub: Overview, Matches, Roster, Club, Market and Intel, with a season calendar, a feed, and an Events inbox.",
    "Level up like the mercenary leagues: choose one of four stats, then one of three skills marked by category and tier.",
    "Clearer fights: team rings underfoot, ability icons over heads, status icons, a kill feed, wind-up glints, and a calmer floor.",
    "New hit effects: chunky pixel blood and sparks, white hit flashes, fire craters, sky lightning, and dash afterimages.",
    "Slower on screen: the whole pit plays at 80% speed, so walks, swings, casts and rolls move slower.",
    "A calmer pit: fighters walk 30% slower, swing about once a second, roll less, and wait longer between moves.",
    "Divisions: five tiers from Sand to Crown. The top two go up, the bottom two go down, and higher tiers pay more.",
    "Rivals now match your level and take real level-ups and better gear in higher divisions. Levels come slower.",
    "Quieter fights: the ticking in the fight music is filtered out, and hits no longer stack into a clatter.",
    "Painted arenas: five pits drawn at full resolution, with stands, banners, and live firelight.",
    "Fights read cleaner: health over every head, damage numbers that float right, swing arcs, sparks, and glowing spells. Speeds are 1× and 1.5×.",
    "Level ups roll stats by growth style, then offer three skills by rarity: a new move, a specialization, or a talent. Rerolls cost gold.",
    "The Club tab keeps one slim Fight bar. Fight opens a popup with both lineups and every other fight that is waiting, and the club screen scrolls on a phone.",
    "Level ups: every level picks one of three cards — rank a move up to V, learn a new one, or train a stat — with the numbers shown.",
    "A cleaner club: the emblem opens name and colors, Settings holds credits and the title, and the Club pane shows one view at a time.",
    "A bigger pit: the floor scales in finer steps, health sits in one header, and the toolbar groups speed, control, and skip.",
    "One way to the pit: the Club tab leads with the next match and a Fight button, every other tab keeps a fight bar, and Compete gathers the league, cup, draft, and chaos pit.",
    "Draft cup: pick three mercenaries one at a time, run a 3 vs 3 bracket, and sign one free if you win.",
    "Watchlist: keep up to three recruits on the board as it turns over after each match. Scout for a class.",
    "Steer your captain: move with WASD or a tap, fire moves with Q, E, R, roll with Space. Auto hands them back.",
    "Behavior rows on every fighter: target, spacing, when to spend the ultimate, when to fall back, how often to roll.",
    "Stamina: league and cup matches tire the party and rest the bench. Rotate the roster.",
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
          (wipedNow ? '<p class="wipe-note" id="wipeNote">Fresh start: every club was reset for a balance pass. Found a new club to play.</p>' : '') +
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
    if (save.roster.length >= IL.rosterCap(save)) {
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
    const p = IL.PERSONAS && IL.PERSONAS[id];
    return p ? p.name : "Bold";
  }

  function pendingGrowth() {
    return (save.roster || []).filter(function (f) { return (f.pendingLevels || 0) > 0; });
  }

  /* Level moves now ride the level-up queue. Kept so old callers stay quiet. */
  function pendingMoveFighters() {
    return [];
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
      save.relicStock = IL.rollRelicStock(takeRng(), save);
      persist();
    }
  }

  const ABILITY_COPY = {
    pull: "Drags an enemy to this fighter.",
    root: "Pins the target in place.",
    silence: "Stops the target using abilities.",
    chain: "Lightning that jumps between enemies.",
    drain: "Takes the target's health for this fighter.",
    revive: "Brings a fallen ally back.",
    homing: "A shot that follows its target.",
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

  /* v87: what a move does, in plain numbers, read from the arena rules
     (arena.js fireOne and its helpers). f is optional: with a fighter the
     damage shows as their ATK value too, with their rank and Heavy upgrade. */
  function moveFacts(ab, f, cls) {
    if (!ab) return "";
    const kit = f ? (IL.CLASSES[f.cls] || IL.CLASSES.warrior) : null;
    const st = f && IL.scaledStats ? IL.scaledStats(f, kit) : null;
    let mul = 1;
    if (f) {
      const r = IL.rankOf ? IL.rankOf(f, ab.id) : 1;
      if (r > 1) mul *= 1 + (IL.RANK_POW || 0.08) * (r - 1);
      const sp = f.specs && f.specs[ab.id];
      if (sp && sp.mod === "heavy" && IL.modValue) mul *= 1 + IL.modValue("heavy", sp.tier) / 100;
    }
    function dmg(x) {
      const p = Math.round(x * mul * 100);
      return p + "% ATK" + (st ? " (" + Math.max(1, Math.round(st.atk * x * mul)) + ")" : "");
    }
    function pct(x) { return Math.round(x * 100) + "%"; }
    function sec(x) { return (Math.round(x * 10) / 10) + "s"; }
    const wk = (IL.CLASS_WEAPON && IL.CLASS_WEAPON[(f && f.cls) || cls]) || "";
    const arrows = wk === "bow" || wk === "crossbow" ? "arrows" : "shots";
    const arrow = arrows === "arrows" ? "arrow" : "shot";
    const k = ab.kind;
    if (k === "cleave") return "Next swing hits the target for " + dmg(1.12) + " and every other enemy in reach for " + dmg(0.55) + ".";
    if (k === "lunge") return "Next hit is a sure critical: " + dmg(1.06 * 1.55) + ".";
    if (k === "multishot") return "Fires 3 " + arrows + " in a fan, " + dmg(0.72) + " each.";
    if (k === "pierce") return "Fires one " + arrow + " for " + dmg(1) + " that goes through one extra enemy.";
    if (k === "taunt") return "For 3.2s, enemies attack this fighter first.";
    if (k === "zone") return "Deals " + dmg(0.35) + " to enemies close by and guards for 0.8s: hits taken in that time do 32% damage.";
    if (k === "nova") return "A blast at the target: " + dmg(ab.power || 0.9) + " to every enemy in the area" + (ab.slow ? ", and they move 38% slower for " + sec(ab.slow) : "") + ". Allies caught in it take 40% (see the Friendly fire tactic).";
    if (k === "bolt") return "Fires a bolt: " + dmg(ab.power || 0.9) + " to the first enemy it hits.";
    if (k === "frost") return "A frost blast at the target: " + dmg(1.15) + " to every enemy in the area, and they move 38% slower for 2.1s. Allies caught in it take 40% (see the Friendly fire tactic).";
    if (k === "fireball") return "Fires a fireball: " + dmg(1.15) + " to the first enemy hit, and it goes through one more.";
    if (k === "arc") return "Arcs at the target: " + dmg(0.95) + " to every enemy in the area.";
    if (k === "dot") {
      const t = ab.dot || 3.2;
      const ticks = Math.max(1, Math.floor(t / 0.85));
      return "Hits for " + dmg(0.35) + ", then deals " + dmg(ab.power || 0.25) + " every 0.85s for " + sec(t) + " (" + ticks + " ticks).";
    }
    if (k === "shield") {
      const amt = st && ab.self ? " (" + Math.round(st.hp * (ab.power || 0.1)) + ")" : "";
      return ab.self ? "A shield on this fighter that absorbs " + pct(ab.power || 0.1) + " of their max HP" + amt + "."
        : "A shield on the most wounded ally that absorbs " + pct(ab.power || 0.1) + " of that ally's max HP.";
    }
    if (k === "buff") return (ab.team ? "Every ally deals " : "This fighter deals ") + pct(ab.power || 0.12) + " more damage for " + sec(ab.time || 3.5) + ".";
    if (k === "debuff") return "The target moves 38% slower for " + sec(ab.time || 2.2) + ".";
    if (k === "stun") return "Deals " + dmg(ab.power || 0.4) + " and stuns the target for " + sec(ab.stun || 0.55) + ".";
    if (k === "knock") return "Deals " + dmg(ab.power || 0.35) + " and knocks the target back.";
    if (k === "charge") return "Dashes at the target and hits the first enemy in the way for " + dmg(0.55 * 1.7) + ".";
    if (k === "shadowstep") return "Teleports behind the target, hits for " + dmg(0.55 * 0.35) + ", and the next hit is a sure critical (×1.55).";
    if (k === "skirmish") return "Dashes past the target and hits the first enemy in the way for " + dmg(0.55 * 0.45) + ".";
    if (k === "heal") return "Heals the most wounded ally for " + pct(ab.power || 0.16) + " of their max HP plus " + dmg(0.25) + ".";
    if (k === "mend") return "Channels for 0.6s, then heals the most wounded ally for 20% of their max HP plus " + dmg(0.35) + ".";
    if (k === "rage") return "Only below 72% HP: for 4s, deals 28% more damage and moves 8% faster.";
    if (k === "summon") return "Summons a " + (ab.pet || "Familiar") + " for " + sec(ab.life || 6) + " with " + pct(ab.petHp || 0.26) + " of this fighter's max HP and " + pct(ab.petAtk || 0.4) + " of their ATK. One at a time.";
    if (k === "vial") return "Throws a flask: " + dmg(ab.power || 0.85) + " to the first enemy it hits.";
    if (k === "pull") return "Drags an enemy 90 to " + (ab.reach || 280) + " px away (a caster, archer or support first) to this fighter, deals " + dmg(ab.power || 0.3) + " and holds them 0.3s.";
    if (k === "root") return "Deals " + dmg(ab.power || 0.2) + " and roots the target for " + sec(ab.time || 1.6) + ": they cannot move, but can still fight.";
    if (k === "silence") return "Deals " + dmg(ab.power || 0.15) + " and silences an enemy for " + sec(ab.time || 2.5) + ": no abilities, and a spell being cast is cut off. Goes for a caster first.";
    if (k === "chain") return "Lightning hits the target for " + dmg(ab.power || 0.6) + ", then jumps to " + (ab.jumps || 2) + " more enemies within 150 px, 25% weaker each jump.";
    if (k === "drain") return "Deals " + dmg(ab.power || 0.55) + " and heals this fighter for all of the damage dealt.";
    if (k === "revive") return "Once a fight: brings a fallen ally back with " + pct(ab.power || 0.3) + " of their max HP and 1s of guard.";
    if (k === "homing") return "Fires a " + (ab.row === "spell" ? "bolt" : arrow) + " that turns to follow its target: " + dmg(ab.power || 1) + ". If the target falls, it finds the nearest enemy.";
    return ab.blurb || abilityBlurb(ab.id);
  }

  /* The real cooldown in a fight: the listed one × PACE (1.2), less ranks
     and a Swift upgrade. */
  function realCd(ab, f) {
    if (!ab || !ab.cd) return 0;
    let cd = ab.cd * ((IL.PACE && IL.PACE.abilityCd) || 1);
    if (f) {
      const r = IL.rankOf ? IL.rankOf(f, ab.id) : 1;
      if (r > 1) cd *= Math.max(0.5, 1 - (IL.RANK_CD || 0.06) * (r - 1));
      const sp = f.specs && f.specs[ab.id];
      if (sp && sp.mod === "swift" && IL.modValue) cd *= 1 - IL.modValue("swift", sp.tier) / 100;
    }
    return Math.round(cd * 10) / 10;
  }

  function modFacts(mod, tier, ab, f) {
    const v = IL.modValue(mod, tier);
    const name = ab ? ab.name : "The move";
    if (mod === "swift") {
      const now = realCd(ab, f && Object.assign({}, f, { specs: {} }));
      return name + "'s cooldown is " + v + "% shorter" + (now ? " (" + now + "s → " + (Math.round(now * (1 - v / 100) * 10) / 10) + "s)" : "") + ".";
    }
    if (mod === "heavy") return name + " deals " + v + "% more damage.";
    if (mod === "vampiric") return name + " heals this fighter for " + v + "% of the damage it deals.";
    if (mod === "chilling") return "Every enemy " + name + " hits moves 38% slower for " + v + "s.";
    if (mod === "searing") return "Every hit from " + name + " burns for another " + v + "% of its damage over 3s.";
    if (mod === "sundering") return "Every enemy " + name + " hits takes " + v + "% more damage from everyone for 3s.";
    return "";
  }

  function talentFacts(id, tier) {
    const v = IL.talentValue(id, tier);
    if (id === "keen") return "+" + v + "% chance to land a critical hit (×1.55 damage).";
    if (id === "ironhide") return "+" + v + " defense: every hit taken does " + (Math.round(v * 0.35 * 100) / 100) + " less damage.";
    if (id === "vigor") return "Regains " + v + " HP every second in a fight.";
    if (id === "thorns") return "Melee attackers take back " + v + "% of the damage they deal to this fighter.";
    if (id === "bloodlust") return "Heals " + v + "% of max HP on every knockout.";
    if (id === "fleet") return "+" + v + "% movement speed.";
    const t = IL.TALENTS[id];
    return t ? "+" + v + t.unit + "." : "";
  }

  IL.moveFacts = moveFacts;
  IL.realCd = realCd;

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

  function moveMeta(ab, level, learned, f) {
    const learnedMove = learned && learned.indexOf(ab.id) >= 0;
    const unlock = ab.unlock || 1;
    const locked = !learnedMove && unlock > (level || 1) && unlock <= 7;
    const tags = (ab.tags || []).join(" · ");
    const row = ab.row ? ab.row.charAt(0).toUpperCase() + ab.row.slice(1) : "";
    const when = locked ? ("Level " + unlock) : (ab.cd ? "Cooldown " + realCd(ab, f) + "s" : cdText(ab));
    /* v105 cost: spells, items and skills spend mana; the rest stamina. */
    const cost = ab.cd ? Math.round(6 + ab.cd * 1.6) + (ab.row === "spell" || ab.row === "item" || ab.row === "skill" ? " mana" : " stamina") : "";
    return { locked: locked, line: [when, cost, row, tags].filter(Boolean).join(" · "), tags: ab.tags || [], row: row };
  }

  function abilityItem(ab, level, learned, f) {
    const frame = IL.abilityIcon ? IL.abilityIcon(ab.id) : "";
    const icon = frame ? iconTag(frame, 32) : "";
    const meta = moveMeta(ab, level, learned, f);
    const blurb = moveFacts(ab, f);
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
    if (spec.mode === "gate") return "boss";
    if (spec.mode === "chaos" || spec.mode === "thunder" || spec.mode === "endless" || spec.mode === "king") return "endless";
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
    return save && !seasonDone() ? weekSize(save.round) : 0;
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
          : '<button type="button" class="btn ghost" data-arm-equip="' + esc(item.uid) + '">' + (gearPreview && gearPreview.uid === item.uid ? "Pick a fighter ↓" : "Equip") + '</button>');
    const salvage = row.owner ? "" : '<button type="button" class="btn ghost" data-salvage="' + esc(item.uid) + '">Salvage — ' + IL.salvageValue(item) + ' gold</button>';
    const pickingGear = !row.owner && !drink && !tome && gearPreview && gearPreview.uid === item.uid;
    const pickingTonic = !row.owner && drink && tonicPick && tonicPick.uid === item.uid;
    const pickingTome = !row.owner && tome && tomePick && tomePick.uid === item.uid;
    const pick = (pickingGear || pickingTonic || pickingTome)
      ? '<div class="armory-pick">' + (save.roster || []).map(function (f) {
        if (pickingTonic) return '<button type="button" class="btn ghost" data-give-on="' + esc(f.id) + '" data-give-item="' + esc(item.uid) + '">' + esc(f.name) + '</button>';
        if (pickingTome) return '<button type="button" class="btn ghost" data-study-on="' + esc(f.id) + '" data-study-item="' + esc(item.uid) + '">' + esc(f.name) + '</button>';
        return '<button type="button" class="btn ghost arm-who" data-arm-on="' + esc(f.id) + '" data-arm-item="' + esc(item.uid) + '"><b>' + esc(f.name) + '</b><small class="gear-delta">' + gearDelta(f, item) + '</small></button>';
      }).join("") + '</div>'
      : "";
    return '<article class="gear-card rarity-' + esc(item.rarity) + '">' +
      itemFaceHtml(item) +
      '<h3>' + esc(IL.itemName(item)) + '</h3>' +
      '<p>' + esc(rarityLabel(item.rarity)) + " · " + esc(slotLabel(row.slot)) + '</p>' +
      '<p class="fine">' + esc(bonusLine(item)) + '</p>' +
      '<p class="fine">' + esc(where) + '</p>' +
      actions + pick + salvage +
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
        '<p class="fine">HP ' + Math.round(stats.hp) + " · ATK " + Math.round(stats.atk) +
          (IL.staminaOf && IL.staminaOf(f) < 50 ? ' · <span class="tired-word">' + esc(IL.staminaLabel(f)) + '</span>' : '') + '</p>' +
        staminaBar(f) +
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
      ["overview", "Overview", "1", "tab-overview"],
      ["matches", "Matches", "2", "tab-matches"],
      ["roster", "Roster", "3", "tab-roster"],
      ["club", "Club", "4", "tab-club"],
      ["market", "Market", "5", "market"],
      ["intel", "Intel", "6", "tab-intel"]
    ];
    return '<nav class="tabbar es-tabs" id="tabbar" role="tablist" aria-label="Club sections">' +
      labels.map(function (row) {
        const on = row[0] === active;
        return '<button type="button" class="tab" role="tab" id="' + row[3] + '" data-tab="' + row[0] + '" aria-selected="' + (on ? "true" : "false") + '" aria-keyshortcuts="' + row[2] + '"><b>' + row[1] + '</b></button>';
      }).join("") +
    '</nav>';
  }


  /* v89 one-tap gear: every spare item for a slot sits under that slot with
     its stat change and its own Equip button. No preview, no confirm at the
     bottom of the sheet. */
  function gearDelta(f, item) {
    const kit = IL.CLASSES[f.cls] || IL.CLASSES.warrior;
    const now = IL.scaledStats(f, kit);
    const slot = IL.itemSlot(item);
    const gear = { weapon: f.gear && f.gear.weapon, armor: f.gear && f.gear.armor, trinket: f.gear && f.gear.trinket };
    gear[slot] = item;
    const next = IL.scaledStats(Object.assign({}, f, { gear: gear }), kit);
    const bits = [["HP", "hp"], ["ATK", "atk"], ["DEF", "def"], ["SPD", "speed"]].map(function (k) {
      const d = Math.round(next[k[1]]) - Math.round(now[k[1]]);
      return d ? '<span class="' + (d > 0 ? "diff-up" : "diff-down") + '">' + (d > 0 ? "+" : "") + d + " " + k[0] + '</span>' : "";
    }).filter(Boolean);
    return bits.length ? bits.join(" ") : '<span class="diff-same">No stat change</span>';
  }

  function quickGearHtml(f) {
    const fid = esc(f.id);
    const slots = ["weapon", "armor", "trinket"].map(function (slot) {
      const cur = f.gear && f.gear[slot];
      const head = cur
        ? '<div class="qg-row qg-cur">' + itemFaceHtml(cur) +
          '<span><b>' + esc(IL.itemName(cur)) + '</b><small>' + esc(rarityLabel(cur.rarity)) + " · " + esc(bonusLine(cur)) + '</small></span>' +
          '<button type="button" class="btn ghost qg-go" data-qunequip="' + fid + '|' + slot + '">Unequip</button></div>'
        : '<div class="qg-row qg-cur empty">' + glyphHtml(slot === "weapon" ? "sword" : slot === "armor" ? "shield" : "gem", "common") +
          '<span><b>Empty ' + esc(slotLabel(slot).toLowerCase()) + '</b><small>Nothing worn</small></span></div>';
      const opts = (save.items || []).filter(function (it) { return it && IL.itemSlot(it) === slot; }).map(function (it) {
        return '<div class="qg-row qg-opt">' + itemFaceHtml(it) +
          '<span><b>' + esc(IL.itemName(it)) + '</b><small>' + esc(rarityLabel(it.rarity)) + " · " + esc(bonusLine(it)) + '</small>' +
          '<small class="gear-delta">' + gearDelta(f, it) + '</small></span>' +
          '<button type="button" class="btn primary qg-go" data-qequip="' + fid + '|' + esc(it.uid) + '">Equip</button></div>';
      }).join("");
      return '<section class="qg-slot"><h4>' + esc(slotLabel(slot)) + '</h4>' + head +
        (opts || '<p class="fine qg-none">No spare ' + esc(slotLabel(slot).toLowerCase()) + ' in the bag.</p>') + '</section>';
    }).join("");
    const drink = f.tonic;
    const tonics = (save.items || []).filter(function (it) { return it && IL.itemSlot(it) === "tonic"; }).map(function (it) {
      return '<div class="qg-row qg-opt">' + itemFaceHtml(it) +
        '<span><b>' + esc(IL.itemName(it)) + '</b><small>Tonic · ' + esc(bonusLine(it)) + '</small></span>' +
        '<button type="button" class="btn primary qg-go" data-qtonic="' + fid + '|' + esc(it.uid) + '">Give</button></div>';
    }).join("");
    const tonic = '<section class="qg-slot"><h4>Tonic</h4>' + (drink
      ? '<div class="qg-row qg-cur">' + itemFaceHtml(drink) + '<span><b>' + esc(IL.itemName(drink)) + '</b><small>One match · ' + esc(bonusLine(drink)) + '</small></span>' +
        '<button type="button" class="btn ghost qg-go" data-qtonic-drop="' + fid + '">Pour back</button></div>'
      : '<div class="qg-row qg-cur empty"><span><b>No tonic</b><small>A tonic lasts one match.</small></span></div>') +
      (tonics || '<p class="fine qg-none">No tonics in the bag.</p>') + '</section>';
    return '<div class="qg">' + slots + tonic + '</div>';
  }

  /* Handles the one-tap gear buttons wherever they are drawn. */
  function quickGearClick(ev) {
    const eq = ev.target.closest("[data-qequip]");
    const un = ev.target.closest("[data-qunequip]");
    const tn = ev.target.closest("[data-qtonic]");
    const td = ev.target.closest("[data-qtonic-drop]");
    if (!eq && !un && !tn && !td) return false;
    ev.stopPropagation();
    let done = false;
    if (eq) {
      const bits = eq.dataset.qequip.split("|");
      const found = findItem(bits[1]);
      done = !!(found && equipItem(fighterById(bits[0]), found.item));
    } else if (un) {
      const bits = un.dataset.qunequip.split("|");
      done = unequipSlot(fighterById(bits[0]), bits[1]);
    } else if (tn) {
      const bits = tn.dataset.qtonic.split("|");
      const found = findItem(bits[1]);
      done = !!(found && giveTonic(fighterById(bits[0]), found.item));
    } else if (td) done = dropTonic(fighterById(td.dataset.qtonicDrop));
    if (done) { gearPreview = null; pitSound("purchase"); persist(); }
    else pitSound("error");
    refreshHub();
    return true;
  }

  function gearSheetHtml(f) {
    return '<h3 class="section">Gear</h3>' + quickGearHtml(f);
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
    const xpi = IL.xpInto(f.xp || 0, f.level);
    const into = xpi.into;
    const xpPct = Math.round(100 * xpi.frac);
    if (IL.ensureMoves) IL.ensureMoves(f);
    const byAb = {};
    (kit.abilities || []).forEach(function (ab) { if (ab && ab.id) byAb[ab.id] = ab; });
    const attack = IL.attackOf ? IL.attackOf(f.cls) : { name: "Melee combo", blurb: "A chain of swings." };
    const passive = kit.passive || {};
    const passiveBlurb = passive.blurb || abilityBlurb(passive.id);
    const loadout = (f.loadout || []).map(function (id, i) {
      const ab = byAb[id];
      if (!ab) return "";
      const rk = IL.rankOf ? IL.rankOf(f, id) : 1;
      const evo = f.evos && f.evos[id] && IL.EVOS && IL.EVOS[f.evos[id]];
      return '<div class="loadout-slot' + (loadoutSlot === i ? " on" : "") + '" data-slot="' + i + '">' + (rk > 1 ? '<em class="rank-pip">' + roman(rk) + '</em>' : '') + (evo ? '<em class="evo-pip" title="Evolved: ' + esc(evo.name) + '. ' + esc(evo.text) + '">★ ' + esc(evo.name) + '</em>' : '') + '<ul class="abilities">' + abilityItem(ab, f.level || 1, f.learned, f) + '</ul></div>';
    }).join("");
    const picks = (f.known || []).map(function (id) {
      const ab = byAb[id];
      if (!ab) return "";
      const on = (f.loadout || []).indexOf(id) >= 0;
      const meta = moveMeta(ab, f.level || 1, f.learned, f);
      const rk = IL.rankOf ? IL.rankOf(f, id) : 1;
      return '<button type="button" class="chip' + (on ? " on" : "") + '" data-fill="' + esc(id) + '"><b>' + esc(ab.name) + (rk > 1 ? ' ' + roman(rk) : '') + '</b><small>' + esc(meta.line) + '</small></button>';
    }).join("");
    const unlearned = (kit.abilities || []).filter(function (ab) {
      return ab && (f.known || []).indexOf(ab.id) < 0;
    }).map(function (ab) { return abilityItem(ab, 1, [], f); }).join("");
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
    const relicRows = [];
    [f.relic, (f.level || 1) >= IL.RELIC_SLOT2_LV ? f.relic2 : null].forEach(function (id, i) {
      const wr = id && IL.relicById(id);
      if (wr) relicRows.push('<li><strong>' + esc(wr.name) + ' ' + rollTag(IL.relicRoll(save, wr.id)) + '</strong><p>Slot ' + (i + 1) + '. ' + esc(relicLine(wr)) + '</p></li>');
    });
    if ((f.level || 1) < IL.RELIC_SLOT2_LV) relicRows.push('<li class="fine">A second relic slot opens at level ' + IL.RELIC_SLOT2_LV + '.</li>');
    eq.forEach(function (r) {
      relicRows.push('<li><strong>' + esc(r.name) + '</strong><p>' + esc(relicLine(r)) + '</p></li>');
    });
    const relics = relicRows.length
      ? '<ul class="relic-list">' + relicRows.join("") + '</ul>'
      : emptyState("No relics equipped.", "Win a cup or close a season, then equip them on the Relics tab.");
    const slot = (save.lineup || []).indexOf(f.id);
    const full = slot < 0 && (save.lineup || []).length >= IL.PARTY_CAP;
    const lineLabel = slot >= 0 ? "Remove from lineup" : (full ? "Party full" : "Add to lineup");
    const anim = kit.idle || "idle";
    const kos = f.kos || 0;
    const mv = IL.marketValue ? IL.marketValue(f) : 0;
    const ps = IL.perfScore ? IL.perfScore(f) : 0;
    const played = (f.wins || 0) + (f.losses || 0);
    const career = f.career || {};
    const base = IL.scaledStats(Object.assign({}, f, { level: 1, rolls: null, talents: [], specs: {}, gear: IL.blankGear ? IL.blankGear() : {}, drillRanks: {} }), kit);
    function gainPct(now, was) { return was > 0 ? Math.round((now / was - 1) * 100) : 0; }
    const statRows = [
      ["HP", Math.round(stats.hp), "Max health " + (gainPct(stats.hp, base.hp) >= 0 ? "+" : "") + gainPct(stats.hp, base.hp) + "%", "drop_water_or_blood"],
      ["ATK", Math.round(stats.atk), "Power " + (gainPct(stats.atk, base.atk) >= 0 ? "+" : "") + gainPct(stats.atk, base.atk) + "%", "sword"],
      ["DEF", Math.round(stats.def * 10) / 10, "Blocks " + Math.round(stats.def * 10) / 10 + " a hit", "armor_1_body"],
      ["SPD", Math.round(stats.speed), "Move " + Math.round(stats.speed) + " (" + (gainPct(stats.speed, base.speed) >= 0 ? "+" : "") + gainPct(stats.speed, base.speed) + "%)", "shoes"]
    ];
    const role = { tank: "Tank", melee: "Melee DPS", dash: "Rogue", kite: "Ranged DPS", cast: "Caster", heal: "Support", support: "Support" }[kit.role] || "Fighter";
    const tone = ROLE_TONE[kit.role] || "melee";
    return '<div class="sheet-back" id="sheetBack"></div>' +
      '<aside class="sheet es-detail" id="fighterSheet" role="dialog" aria-modal="true" aria-labelledby="sheetTitle">' +
        '<header class="es-dhead">' +
          '<div class="detail-stage">' + portraitWrap('id="detailPreview" width="140" height="124" data-key="' + esc(IL.hero.keyOf(f.parts)) + '" data-anim="' + anim + '" data-scale="3" data-foot="10"', f.captain, f) + '</div>' +
          '<div class="es-dwho">' +
            '<h2 id="sheetTitle">' + shinyMark(f) + esc(f.name) + (f.captain ? ' <small class="es-captain">Captain</small>' : '') + '</h2>' +
            '<p class="es-dtags"><span class="es-class ' + tone + '">' + esc(kit.name) + '</span><span class="es-role">' + esc(role) + '</span>' + (f.champion ? '<span class="es-role champ">Champion</span>' : '') + (f.shiny ? '<span class="es-role shiny-tag">Shiny</span>' : '') + '</p>' +
            '<p class="es-dgrades">' + potentialStars(f) + gradeChips(f) + '</p>' +
            staminaBar(f) +
            '<p class="es-dlevel">Level ' + (f.level || 1) + ' · XP ' + into + '/' + xpi.need + ' (' + xpPct + '%)</p>' +
            '<div class="xp"><span>XP</span><div class="track"><div class="fill" style="width:' + xpPct + '%"></div></div><b>' + into + '/' + xpi.need + '</b></div>' +
          '</div>' +
          '<div class="es-dvalue">' +
            '<p><span>Market value</span><b>' + coinIcon("gold") + mv + '</b></p>' +
            '<p><span>Performance score</span><b>' + esc(IL.perfLabel ? IL.perfLabel(ps) : "") + ' (' + ps + ')</b></p>' +
          '</div>' +
          '<button type="button" class="btn close-x" id="sheetClose" aria-label="Close">Close</button>' +
        '</header>' +
        ((f.pendingLevels || 0) > 0 ? '<button type="button" class="btn gold sheet-level" id="sheetLevel">Level up · ' + f.pendingLevels + ' pick' + (f.pendingLevels === 1 ? '' : 's') + '</button>' : '') +
        '<div class="es-dgrid">' +
          '<section class="es-card"><h3 class="section">Fighter stats</h3>' +
            '<ul class="es-dstats">' + statRows.map(function (r) {
              return '<li><img class="ui-glyph" alt="" src="assets/ui/glyphs/orange_32/' + r[3] + '.png"><span>' + r[0] + '</span><b>' + r[1] + '</b><em>' + esc(r[2]) + '</em></li>';
            }).join("") + '</ul>' +
          '</section>' +
          '<section class="es-card"><h3 class="section">Abilities</h3>' +
            '<p class="loadout-style"><strong>' + esc(attack.name) + '</strong> ' + esc(attack.blurb) + '</p>' +
            '<p class="loadout-style"><strong>Passive · ' + esc(passive.name || "Passive") + '</strong> ' + esc(passiveBlurb) + '</p>' +
            (champPassiveOf(f) ? '<p class="loadout-style"><strong>Champion passive · ' + esc(champPassiveOf(f).p.name) + '</strong> ' + esc(champPassiveOf(f).p.blurb) + ' (from the ' + esc(champPassiveOf(f).cls) + ')</p>' : '') +
            (IL.championMove && IL.championMove(f) ? '<p class="loadout-style"><strong>Champion move · ' + esc(IL.championMove(f).name) + '</strong> ' + esc(moveFacts(IL.championMove(f), null, f.cls)) + ' An extra move on top of the three, fought at rank IV.</p>' : '') +
            '<h3 class="section">Loadout</h3><div class="loadout">' + loadout + '</div>' +
            '<p class="fine">Equip three. A tome teaches the rest.</p>' +
            '<div class="loadout-picks" id="loadoutPicks">' + picks + '</div>' +
            evoHtml(f) +
            milestoneHtml(f) +
          '</section>' +
          '<section class="es-card"><h3 class="section">Profile and behavior</h3>' +
            '<dl class="es-profile">' +
              '<dt>Personality</dt><dd>' + esc(personalityLabel(f.personality)) + '</dd>' +
              '<dt>Growth style</dt><dd>' + esc(IL.STYLES[IL.styleOf(f)].name) + ' growth</dd>' +
              (f.rarity ? '<dt>Rarity</dt><dd>' + esc(rarityLabel(f.rarity)) + '</dd>' : '') +
              (f.specialty && IL.specialtyOf && IL.specialtyOf(f.specialty) ? '<dt>Specialty</dt><dd>' + esc(IL.specialtyOf(f.specialty).name) + '</dd>' : '') +
              '<dt>Stamina</dt><dd>' + esc(IL.staminaLabel ? IL.staminaLabel(f) : "") + '</dd>' +
              '<dt>Injury risk</dt><dd>' + esc(IL.INJURY_NAME[IL.injuryRiskOf(f)]) + ' (' + Math.round(IL.injuryChance(save, f) * 100) + '% a knockout)</dd>' +
              (IL.isInjured(f) ? '<dt>Injured</dt><dd class="hurt-line">' + f.injury.weeks + ' league week' + (f.injury.weeks === 1 ? '' : 's') + ' left ' + healButton(f.id) + '</dd>' : '') +
            '</dl>' +
            '<h3 class="section">Tactic</h3>' + tacticChips(f) +
            behaviorHtml(f) +
          '</section>' +
          '<section class="es-card"><h3 class="section">Combat summary · Record</h3>' +
            '<div class="es-summary">' +
              '<span><small>Battles</small><b>' + played + '</b></span>' +
              '<span><small>MVP</small><b>' + (f.mvps || 0) + '</b></span>' +
              '<span><small>Win rate</small><b>' + (played ? Math.round(100 * (f.wins || 0) / played) + "%" : "—") + '</b></span>' +
              '<span><small>Kills</small><b>' + kos + '</b></span>' +
              '<span><small>Damage</small><b>' + Math.round(career.dealt || 0) + '</b></span>' +
              '<span><small>Healing</small><b>' + Math.round(career.heal || 0) + '</b></span>' +
            '</div>' +
            '<p class="record"><span><b>W</b> ' + (f.wins || 0) + '</span><span><b>L</b> ' + (f.losses || 0) + '</span><span><b>KO</b> ' + kos + '</span></p>' +
          '</section>' +
          '<section class="es-card">' + gearSheetHtml(f) + '</section>' +
          '<section class="es-card"><h3 class="section">Relics</h3>' + relics + '</section>' +
        '</div>' +
        '<details class="es-fold"' + (unlearned || tomeList ? '' : '') + '><summary>Still to learn and tomes</summary>' +
          (unlearned ? '<ul class="abilities">' + unlearned + '</ul>' : '<p class="fine">Every move in the pool is known.</p>') + tomeList +
        '</details>' +
        '<details class="es-fold"><summary>Development, upgrades and ability history</summary>' + perkList(f) + '</details>' +
        '<details class="es-fold" open><summary>Actions</summary>' +
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
        '</div></details>' +
      '</aside>';
  }

  function tacticChips(f) {
    const order = IL.TACTICS || ["strike", "cover", "hold"];
    return '<div class="chips" id="tacticChips">' + order.map(function (id) {
      const on = (f.tactic || "strike") === id;
      return '<button type="button" class="chip' + (on ? " on" : "") + '" data-tactic="' + esc(id) + '">' + esc(tacticLabel(id)) + '</button>';
    }).join("") + '</div>';
  }

  /* Behavior rows: how the fighter picks a target, where they stand,
     when they spend the ultimate, when they back off, and how often
     they roll. Each row is a chip set; the first chip is the default. */
  function behaviorHtml(f) {
    const rows = IL.AI_ROWS || [];
    if (!rows.length) return "";
    const ai = IL.aiFor(f);
    const custom = !!f.ai && IL.aiCustom(f.ai);
    const persona = IL.PERSONAS[f.personality];
    const presets = Array.isArray(save.tacticPresets) ? save.tacticPresets : [];
    return '<details class="behavior"' + (custom ? " open" : "") + ' id="behaviorBox">' +
      '<summary><span>Behavior</span><em>' + esc(custom ? behaviorSummary(ai) : (persona ? persona.name + " defaults" : "Class default")) + '</em></summary>' +
      (persona ? '<p class="fine ai-persona"><b>' + esc(persona.name) + ':</b> ' + esc(persona.blurb) + ' Mistake chance ' + Math.round(persona.mistake * 100) + '%.</p>' : '') +
      '<div class="ai-presets"><span class="fine">Presets</span>' + [0, 1, 2, 3, 4].map(function (i) {
        const p = presets[i];
        return p ? '<button type="button" class="chip" data-ai-preset="' + i + '" title="Apply ' + esc(behaviorSummary(IL.normAi(p.ai))) + '">' + (i + 1) + '</button>' : '';
      }).join("") + '<button type="button" class="chip" data-ai-save="1" title="Save this fighter\'s behavior into the next free preset (5 at most; the oldest is replaced)">Save</button></div>' +
      rows.map(function (row) {
        const on = row.opts.filter(function (o) { return o.id === ai[row.key]; })[0] || row.opts[0];
        return '<div class="ai-row"><p class="ai-name">' + esc(row.name) + '</p>' +
          '<div class="chips">' + row.opts.map(function (o) {
            return '<button type="button" class="chip' + (o.id === ai[row.key] ? " on" : "") + '" data-ai="' + esc(row.key + ":" + o.id) + '" title="' + esc(o.blurb) + '">' + esc(o.name) + '</button>';
          }).join("") + '</div>' +
          '<p class="fine ai-blurb">' + esc(on.blurb) + '</p></div>';
      }).join("") +
      (custom ? '<button type="button" class="btn ghost" data-ai-reset="1">Back to personality defaults</button>' : '') +
    '</details>';
  }

  function behaviorSummary(ai) {
    const rows = IL.AI_ROWS || [];
    const bits = [];
    rows.forEach(function (row) {
      if (ai[row.key] === row.opts[0].id) return;
      const o = row.opts.filter(function (x) { return x.id === ai[row.key]; })[0];
      if (o) bits.push(row.name + " " + o.name.toLowerCase());
    });
    return bits.join(" · ");
  }

  function setBehavior(id, pair) {
    const f = fighterById(id);
    if (!f || !pair) return;
    const at = pair.indexOf(":");
    const key = pair.slice(0, at);
    const val = pair.slice(at + 1);
    const ai = IL.aiFor(f);
    ai[key] = val;
    f.ai = IL.normAi(ai);
    persist();
    refreshHub();
    const box = document.getElementById("behaviorBox");
    if (box) box.open = true;
  }

  function perkList(f) {
    const log = (f && f.growth) || [];
    if (log.length) {
      return '<h3 class="section">Growth</h3><ul class="growth-log">' + log.slice().reverse().slice(0, 12).map(function (g) {
        let text = "";
        const rar = g.tier != null && IL.RARITY && IL.RARITY[g.tier] ? IL.RARITY[g.tier].name + " " : "";
        if (g.kind === "rank") { const ab = IL.abilityById(g.id); text = (ab ? ab.name : g.id) + " to rank " + roman(g.to); }
        else if (g.kind === "learn") { const ab = IL.abilityById(g.id); text = rar + "move · " + (ab ? ab.name : g.id); }
        else if (g.kind === "spec") { const ab = IL.abilityById(g.id); text = rar + (IL.MODS[g.mod] ? IL.MODS[g.mod].name : g.mod) + " " + (ab ? ab.name : g.id); }
        else if (g.kind === "talent") { text = rar + "talent · " + (IL.TALENTS[g.id] ? IL.TALENTS[g.id].name : g.id); }
        else if (g.kind === "hone") { text = "Hone · " + (STAT_CARD[g.id] ? STAT_CARD[g.id].name : g.id); }
        else { const st = IL.STAT_STEP && IL.STAT_STEP[g.id]; text = (st ? st.name + " · " + st.stat : g.id); }
        if (g.roll) text += " · " + Object.keys(g.roll).filter(function (k) { return g.roll[k]; }).map(function (k) { return "+" + g.roll[k] + " " + k.toUpperCase(); }).join(" ");
        return '<li><span class="lv-badge">Lv ' + (g.level || 1) + '</span>' + esc(text) + '</li>';
      }).join("") + '</ul>';
    }
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
        '<span class="achieve-icon">' + iconTag(r.icon, 24) + '</span>' +
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
    if (!seasonDone()) return null;
    if (save.ceremonyPaid === save.season) return null;
    const sorted = sortedClubs();
    const place = sorted.findIndex(function (c) { return c.you; });
    /* v93: a season chest by finish (gold, renown, gear, a relic at the
       top), the awards pay XP, and the top-three goal is settled. */
    const rng = takeRng();
    const chest = IL.seasonChest ? IL.seasonChest(place < 0 ? 99 : place, IL.divisionOf(save), rng) : IL.seasonPurse(place < 0 ? 99 : place, IL.divisionOf(save));
    const purse = { gold: chest.gold, renown: chest.renown };
    save.gold += purse.gold;
    save.renown = (save.renown || 0) + purse.renown;
    if (!Array.isArray(save.items)) save.items = [];
    const got = [];
    (chest.items || []).forEach(function (it) { save.items.push(it); got.push(IL.itemName(it) + " (" + rarityLabel(it.rarity) + ")"); });
    if (chest.relic) {
      const relic = IL.offerRelic(save, rng);
      if (relic) { holdClubRelic(relic); got.push(relic.name + " (relic)"); }
    }
    const aw = IL.seasonAwards(save.roster);
    const awarded = [];
    ["mvp", "kos", "wall", "healer"].forEach(function (k) {
      const f = aw[k];
      if (!f || awarded.indexOf(f.id + k) >= 0) return;
      awarded.push(f.id + k);
      f.awards = (f.awards || 0) + 1;
      IL.grantXp(f, Math.round((IL.xpNeed ? IL.xpNeed(f.level || 1) : 60) * 0.5));
    });
    const goals = settleGoals({ place: place });
    goals.forEach(function (g) { purse.gold += g.gold; purse.renown += g.renown; });
    save.chest = { season: save.season, gold: purse.gold, renown: purse.renown, got: got, goals: goals.map(function (g) { return g.name; }) };
    save.ceremonyPaid = save.season;
    if (place === 0) save.seasonTitles = (save.seasonTitles || 0) + 1;
    const you = place >= 0 ? sorted[place] : null;
    if (you && you.w >= seasonWeeks() && you.l === 0) save.unbeaten = (save.unbeaten || 0) + 1;
    return purse;
  }

  /* League and cup matches tire whoever walked in and rest the bench. */
  function tireAndRest(sent) {
    if (!IL.staminaOf) return "";
    const ids = {};
    (sent || []).forEach(function (f) { if (f) ids[f.id] = true; });
    let rested = 0;
    const worn = [];
    (save.roster || []).forEach(function (f) {
      const was = IL.staminaOf(f);
      if (ids[f.id]) {
        f.stamina = Math.max(0, was - IL.STAMINA_COST);
        if (f.stamina < 50) worn.push(f.name.split(" ")[0]);
      } else {
        f.stamina = Math.min(IL.STAMINA_MAX, was + IL.STAMINA_REST + (IL.restBonus ? IL.restBonus(save) : 0));
        if (f.stamina > was) rested++;
      }
    });
    const bits = ["Stamina −" + IL.STAMINA_COST + " for the party"];
    if (rested) bits.push("the bench rested");
    let line = bits.join(", ") + ".";
    if (worn.length) line += " Tired: " + worn.join(", ") + " — rest them a match.";
    return line;
  }

  function staminaBar(f) {
    if (!IL.staminaOf) return "";
    const s = Math.round(IL.staminaOf(f));
    const label = IL.staminaLabel(f);
    const tone = s >= 50 ? "ok" : s >= 25 ? "low" : "out";
    return '<span class="stamina ' + tone + '" title="Stamina ' + s + '/100 · ' + esc(label) + (s < 50 ? " · fights a little weaker" : "") + '">' +
      '<i style="width:' + s + '%"></i><em>' + esc(label) + '</em></span>';
  }

  /* Top two go up, bottom two go down. Returns the line for the ceremony. */
  function divisionMove(place) {
    const tier = IL.divisionOf(save);
    const top = IL.DIVISIONS.length - 1;
    if (place <= 1 && tier < top) return { to: tier + 1, text: "Promoted to the " + IL.DIVISIONS[tier + 1].name + "." };
    const clubsN = (save.clubs || []).length || 6;
    if (place >= clubsN - 2 && tier > 0) return { to: tier - 1, text: "Relegated to the " + IL.DIVISIONS[tier - 1].name + "." };
    return { to: tier, text: "Staying in the " + IL.DIVISIONS[tier].name + "." };
  }

  function startNextSeason() {
    const placeNow = sortedClubs().findIndex(function (c) { return c.you; });
    const move = divisionMove(placeNow < 0 ? 5 : placeNow);
    save.division = move.to;
    save.season += 1;
    save.gold += 30;
    (save.roster || []).forEach(function (f) {
      f.season = { dealt: 0, taken: 0, heal: 0, kos: 0 };
      f.stamina = IL.STAMINA_MAX;
    });
    buildSeason(true);
    persist();
    showHub("overview");
  }

  /* v76 Champions Cup: made when the league closes, played before the
     ceremony. Ties that do not need you are settled on the spot. */
  function champsState() {
    if (!save || !seasonDone() || !IL.startChampionsCup) return null;
    if (!save.champs || save.champs.season !== save.season) {
      save.champs = IL.startChampionsCup(save, sortedClubs());
      if (save.champs) IL.settleCup(save.champs, save.roster, takeRng());
      persist();
    }
    return save.champs;
  }

  function champsPending() {
    const c = champsState();
    return !!(c && !c.champion && IL.cupOpponent(c));
  }

  function champsName(c) {
    if (!c || !c.champion) return "";
    if (c.champion === "you") return save.clubName;
    const s = (c.slots || []).filter(function (x) { return x.id === c.champion; })[0];
    if (s) return s.name;
    const club = clubById(c.champion);
    return club ? club.name : "";
  }

  function startChampsFight() {
    const cup = champsState();
    const opp = cup && IL.cupOpponent(cup);
    if (!opp) return;
    const left = fielded(save.roster, cup.size);
    if (left.length < Math.min(cup.size, save.roster.length)) { showHub("roster"); return; }
    openVersus({
      mode: "champions",
      left: left,
      right: (opp.foe.fighters || []).slice(0, cup.size),
      leftName: save.clubName,
      rightName: opp.foe.name,
      size: cup.size,
      seed: (save.rngSeed ^ (save.season * 1907) ^ ((cup.round + 1) * 31)) >>> 0,
      returnTab: "overview"
    });
  }

  function showSeasonEnd() {
    stopLoops();
    hubBed();
    app.onclick = null;
    save = save || load();
    if (!save) { showTitle(); return; }
    IL.migrate(save);
    if (champsPending()) { showHub("overview"); return; }
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
    const relicReady = save.relicSeason !== save.season;
    app.innerHTML =
      '<main class="hub season-end" id="seasonEnd">' +
        '<header class="res-hero ' + (place === 0 ? "win" : "") + ' season-hero">' +
          '<p class="eyebrow">Season ' + save.season + ' · the yard closes</p>' +
          '<h2>' + esc(save.clubName) + ' finish ' + ordinal(place + 1) + '</h2>' +
          '<p class="res-score">' + crestHtml(save.clubName, "md", save.crest, save.plate) + '<span class="res-ko">' + (sorted[place] ? sorted[place].w + 'W · ' + sorted[place].l + 'L · ' + sorted[place].pts + ' pts' : '') + '</span></p>' +
          '<p class="fine">' + esc(cupNote) + '</p>' +
          '<p class="division-move ' + (divisionMove(place).to > IL.divisionOf(save) ? 'up' : divisionMove(place).to < IL.divisionOf(save) ? 'down' : '') + '" id="divisionMove">' + esc(divisionMove(place).text) + '</p>' +
          (save.champs && save.champs.season === save.season && save.champs.champion ? '<p class="fine champs-line" id="champsLine">Champions Cup: ' + esc(champsName(save.champs)) + (save.champs.champion === "you" ? ' — that is you.' : '.') + '</p>' : '') +
        '</header>' +
        '<div class="res-rewards season-rewards">' +
          (purse ? '<div class="res-tile gold-tile">' + coinIcon("gold") + '<b>+' + purse.gold + '</b><span>gold</span></div>' +
                   '<div class="res-tile renown-tile">' + coinIcon("renown") + '<b>+' + purse.renown + '</b><span>renown</span></div>'
                 : '<div class="res-tile"><b>✓</b><span>rewards paid</span></div>') +
          '<div class="res-tile"><b>' + (save.season + 1) + '</b><span>next season</span></div>' +
          '<div class="res-tile relic-tile">' + (relicReady
            ? '<span>Yard relic</span><button type="button" class="btn gold" id="claimRelic">Take it</button>'
            : '<b>✓</b><span>relic taken</span>') + '</div>' +
        '</div>' +
        '<section class="panel-frame"><h3 class="section">Final standings</h3>' +
          '<table class="board" id="finalTable"><thead><tr><th></th><th>Club</th><th>P</th><th>W</th><th>L</th><th>Pts</th></tr></thead><tbody>' + table + '</tbody></table></section>' +
        '<section class="panel-frame" id="awards"><h3 class="section">Awards</h3><div class="awards">' +
          awardCard("MVP", awards.mvp) +
          awardCard("Most KOs", awards.kos) +
          awardCard("Iron wall", awards.wall) +
          awardCard("Top healer", awards.healer) +
        '</div></section>' +
        (save.chest && save.chest.season === save.season
          ? '<section class="panel-frame" id="seasonChest"><h3 class="section">Season chest</h3>' +
            '<p class="fine">' + esc("+" + save.chest.gold + " gold · +" + save.chest.renown + " renown" + (save.chest.goals.length ? " (with " + save.chest.goals.length + " goal" + (save.chest.goals.length === 1 ? "" : "s") + ")" : "")) + '</p>' +
            (save.chest.got.length ? '<ul class="chest-list">' + save.chest.got.map(function (g) { return '<li>' + esc(g) + '</li>'; }).join("") + '</ul>' : '<p class="fine">Finish in the top five for gear, the top three for a chance at a relic.</p>') +
            '<p class="fine">Award winners each took half a level of XP.</p></section>'
          : '') +
        seasonGoalsHtml(place) +
        '<p id="seasonRewards" class="fine">' + esc(paidLine) + '</p>' +
        '<p id="cupNote" hidden>' + esc(cupNote) + '</p>' +
        '<div class="hub-actions">' +
          '<button type="button" class="btn ghost" id="backFromSeason">Back to the club</button>' +
          '<button type="button" class="btn gold" id="startSeason">Start season ' + (save.season + 1) + '</button>' +
        '</div></main>';
    root.scrollTo(0, 0);
    bootCards();
    showToasts(fresh);
    const start = document.getElementById("startSeason");
    if (start) start.onclick = startNextSeason;
    const back = document.getElementById("backFromSeason");
    if (back) back.onclick = function () { showHub("overview"); };
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
    const size = !seasonDone() ? weekSize(save.round) : 0;
    const yours = size ? fielded(save.roster, size) : [];
    const theirs = rival && size ? IL.rivalPick(rival, size) : [];
    const partyReady = !size || yours.length >= size;
    const done = seasonDone();
    const table = sortedClubs().map(function (c, i) {
      const played = c.w + c.l;
      const nemesisRow = save.nemesis && c.name === save.nemesis.name;
      const tierNow = IL.divisionOf(save);
      const zone = (i <= 1 && tierNow < IL.DIVISIONS.length - 1) ? " promo" : (i >= (save.clubs || []).length - 2 && tierNow > 0) ? " releg" : "";
      return '<tr class="' + (c.you ? "you" : "") + (nemesisRow ? " nemesis" : "") + zone + '"><td>' + (i + 1) + '</td><td class="club-cell">' + crestHtml(c.name, "sm", clubCrest(c), c.you ? save.plate : undefined) + '<span class="club-name">' + esc(c.name) + '</span></td><td>' + played + '</td><td>' + c.w + '</td><td>' + c.l + '</td><td>' + c.pts + '</td></tr>';
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
          (partyReady ? "Fight" : ("Choose " + size)) + '</button>'
      : "";
    const hero = done
      ? '<section class="next-bar done" id="nextCard"><div class="next-info"><p class="eyebrow">League · Season ' + save.season + '</p>' +
          '<h3>Season closed</h3></div>' +
          '<button type="button" class="btn gold" id="openSeasonBanner">Open the ceremony</button></section>'
      : '<section class="next-bar" id="nextCard">' +
          '<div class="next-info">' +
            '<p class="eyebrow">League · ' + (save.round + 1) + '/' + seasonWeeks() + ' · ' + size + 'v' + size + (otherFights().length ? ' · +' + otherFights().length + ' more' : '') + '</p>' +
            '<h3>vs ' + crestHtml(rival ? rival.name : "", "sm", rival ? clubCrest(rival) : 0) + '<span>' + esc(rival ? rival.name : "—") + '</span></h3>' +
          '</div>' +
          '<button type="button" class="btn fight" id="nextMatch"' + (partyReady ? "" : " disabled") + '>' + (partyReady ? "Fight" : "Pick " + size) + '</button>' +
        '</section>';
    return tutorHtml() +
      (pendingGrowth().length
        ? '<p class="banner level-banner">' + esc(levelBannerText()) + ' <button type="button" class="btn gold" id="openGrowth">Level up</button></p>'
        : '') +
      (pendingMoveFighters().length
        ? '<p class="banner">A new trick is waiting. <button type="button" class="btn gold" id="openMoves">Choose a move</button></p>'
        : '') +
      hero +
      '<div class="hub-split" id="hubSplit">' +
        '<div class="hub-main" id="hubMain">' +
          partySynergy +
          rosterHtml(size, size ? "In the pit" : "Party", "all") +
        '</div>' +
        '<div class="pane club-pane" id="clubPane">' +
          '<nav class="club-views" id="clubViews" role="tablist">' +
            [["table", "Standings"], ["record", "Record"], ["history", "History"], ["goals", "Goals"]].map(function (v) {
              return '<button type="button" role="tab" class="club-view' + (clubView === v[0] ? " on" : "") + '" data-club-view="' + v[0] + '" aria-selected="' + (clubView === v[0]) + '">' + v[1] + '</button>';
            }).join("") +
          '</nav>' +
          (clubView === "record" ? clubRecordHtml()
            : clubView === "history" ? historyHtml()
            : clubView === "goals" ? achievementsHtml()
            : '<section class="panel-frame"><h3 class="section">Standings · ' + esc(IL.DIVISIONS[IL.divisionOf(save)].name) + '</h3>' +
                '<p class="fine division-key"><span class="key promo"></span>Top two go up<span class="key releg"></span>Bottom two go down · rivals Lv ' + IL.rivalRange(save).join('–') + '</p>' +
                '<table class="board"><thead><tr><th></th><th>Club</th><th>P</th><th>W</th><th>L</th><th>Pts</th></tr></thead><tbody>' + table + '</tbody></table>' +
              '</section>') +
        '</div>' +
      '</div>';
  }

  /* ---------- the way to the pit ----------
     The Club tab leads with the next league match. Every other tab
     keeps a slim fight bar at the bottom. Other ties that are waiting
     (cup, draft, the week's event, the daily, an endless run) show as
     chips that open the tab they live on. */
  function otherFights() {
    const out = [];
    const cup = save.cup;
    const copp = cup && !cup.champion ? IL.cupOpponent(cup) : null;
    if (copp) out.push({ tab: "cup", label: "Cup tie vs " + copp.foe.name });
    const d = save.draft;
    if (d && d.stage === "pick") out.push({ tab: "cup", label: "Draft · pick " + (d.picks.length + 1) + " of " + IL.DRAFT_PICKS });
    else if (d && d.stage === "bracket" && d.cup && IL.cupOpponent(d.cup)) out.push({ tab: "cup", label: "Draft tie vs " + IL.cupOpponent(d.cup).foe.name });
    else if (d && d.stage === "sign") out.push({ tab: "cup", label: "Draft · sign a pick" });
    const week = IL.weekIndex(Date.now());
    if (!(save.weekClear && save.weekClear.week === week)) out.push({ tab: "events:week", label: "Weekly event" });
    const day = IL.dayIndex(Date.now());
    if (!(save.daily && save.daily.day === day && save.daily.cleared)) out.push({ tab: "events:daily", label: "Daily challenge" });
    if (save.endlessRun) out.push({ tab: "events:endless", label: "Endless · wave " + (save.endlessRun.wave || 1) });
    if (save.gateRun) out.push({ tab: "club:home", label: "Iron Gate · floor " + save.gateRun.floor });
    else if (gateOpen()) out.push({ tab: "club:home", label: "Iron Gate" });
    return out;
  }

  /* The fight menu: the next league match with both lineups, then every
     other fight that is waiting. Opened from the Fight bar on any tab. */
  function fightMenuHtml() {
    const done = seasonDone();
    const rival = done ? null : nextRival();
    const size = done ? 0 : weekSize(save.round);
    const yours = size ? fielded(save.roster, size) : [];
    const theirs = rival && size ? IL.rivalPick(rival, size) : [];
    const ready = !size || yours.length >= size;
    function names(list) {
      return '<ul class="preview-names">' + list.map(function (f) {
        return '<li>' + esc(String(f.name || "Fighter").split(" ")[0]) + ' <small>' + esc((IL.CLASSES[f.cls] || {}).name || "") + ' · Lv ' + (f.level || 1) + '</small></li>';
      }).join("") + '</ul>';
    }
    const league = done
      ? '<section class="fm-card"><p class="eyebrow">League</p><h3>Season closed</h3>' +
          '<button type="button" class="btn gold" id="fmSeason">Open the ceremony</button></section>'
      : '<section class="fm-card fm-league">' +
          '<p class="eyebrow">League · Match ' + (save.round + 1) + ' of ' + seasonWeeks() + ' · ' + size + ' vs ' + size + '</p>' +
          '<h3>vs ' + crestHtml(rival ? rival.name : "", "sm", rival ? clubCrest(rival) : 0) + '<span>' + esc(rival ? rival.name : "—") + '</span></h3>' +
          (nemesisBanner(rival) ? '<p class="fine">' + nemesisBanner(rival) + '</p>' : '') +
          synergyLine(yours, "fmSynergy") +
          '<div class="fm-sides"><div><p class="eyebrow">Your party</p>' + names(yours) + '</div>' +
            '<p class="vs">vs</p><div><p class="eyebrow">They send</p>' + names(theirs) + '</div></div>' +
          (ready ? '' : '<p class="banner">Pick ' + (size - yours.length) + ' more for the pit on the Club tab.</p>') +
          '<button type="button" class="btn fight" id="fightGo"' + (ready ? '' : ' disabled') + '>To the pit</button>' +
        '</section>';
    const rows = otherFights().map(function (o) {
      return '<li><span>' + esc(o.label) + '</span><button type="button" class="ctl" data-fm-go="' + esc(o.tab) + '">Open ›</button></li>';
    });
    if (thunderLive()) rows.unshift('<li><span>Chaos Thunder Cup · round ' + (save.thunder.round + 1) + ' of ' + IL.THUNDER_ROUNDS + '</span><button type="button" class="ctl" data-fm-thunder="1">Fight ›</button></li>');
    if (fielded(save.roster, 1).length) rows.push('<li><span>Chaos pit · free for all</span><button type="button" class="ctl" data-fm-chaos="1">Enter ›</button></li>');
    return '<div class="sheet-back" id="fightMenuBack"></div>' +
      '<aside class="sheet fight-menu" id="fightMenu" role="dialog" aria-modal="true" aria-labelledby="fightMenuTitle">' +
        '<header class="sheet-head"><div><p class="eyebrow">Season ' + save.season + '</p><h2 id="fightMenuTitle">Ready to fight?</h2></div>' +
          '<button type="button" class="btn close-x" id="fightMenuClose" aria-label="Close">Close</button></header>' +
        league +
        (rows.length ? '<h3 class="section">Also open</h3><ul class="fm-list">' + rows.join("") + '</ul>' : '') +
      '</aside>';
  }

  function openFightMenu() {
    detailId = null;
    settingsOpen = false;
    creditsOpen = false;
    identityOpen = false;
    fightMenuOpen = true;
    refreshHub();
  }

  function bindFightMenu() {
    const box = document.getElementById("fightMenu");
    if (!box) return;
    const close = function () { fightMenuOpen = false; refreshHub(); };
    document.getElementById("fightMenuBack").onclick = close;
    document.getElementById("fightMenuClose").onclick = close;
    box.onclick = function (ev) {
      if (ev.target.closest("#fightGo")) { fightMenuOpen = false; startFight(); return; }
      if (ev.target.closest("#fmSeason")) { fightMenuOpen = false; showSeasonEnd(); return; }
      const go = ev.target.closest("[data-fm-go]");
      if (go) { fightMenuOpen = false; showHub(go.dataset.fmGo); return; }
      if (ev.target.closest("[data-fm-chaos]")) { fightMenuOpen = false; showHub("cup"); startChaosFight(); }
      if (ev.target.closest("[data-fm-thunder]")) { fightMenuOpen = false; showHub("cup"); startThunderFight(); }
    };
  }

  function otherFightsHtml() {
    const list = otherFights();
    if (!list.length) return "";
    return '<nav class="other-fights" id="otherFights" aria-label="Other fights"><span>Also open</span>' +
      list.map(function (o) { return '<button type="button" class="chip go" data-goto="' + esc(o.tab) + '">' + esc(o.label) + ' ›</button>'; }).join("") +
      '</nav>';
  }

  /* v71 bottom bar, after Eslabong: a side match on the left, NEXT MATCH
     in the middle, the Events inbox (with a badge) on the right. */
  function fightDockHtml() {
    const done = seasonDone();
    const size = done ? 0 : weekSize(save.round);
    const ready = done || fielded(save.roster, size).length >= size;
    const champsUp = done && champsPending();
    const day = IL.dayIndex(Date.now());
    const dailyDone = save.daily && save.daily.day === day && save.daily.cleared;
    const inbox = inboxItems().filter(function (x) { return x.act; }).length;
    return '<div class="fight-dock es-dock" id="fightDock">' +
      '<button type="button" class="dock-side" id="dockDaily" data-dock="daily"' + (dailyDone ? ' disabled' : '') + '>' + (dailyDone ? 'Daily <span class="dock-long">done</span>' : 'Daily <span class="dock-long">match</span>') + '</button>' +
      (champsUp
        ? '<button type="button" class="btn fight dock-main" id="dockFight" data-dock="champs">Champions Cup</button>'
        : done
        ? '<button type="button" class="btn gold dock-main" id="dockFight" data-dock="season">Season ceremony</button>'
        : '<button type="button" class="btn fight dock-main" id="dockFight" data-dock="' + (ready ? "fight" : "club") + '">' + (ready ? "Next match" : "Pick " + size + " fighters") + '</button>') +
      '<button type="button" class="dock-side" id="dockInbox" data-dock="inbox">Events' + (inbox ? '<em class="dock-badge">' + inbox + '</em>' : '') + '</button>' +
    '</div>';
  }

  /* The Events inbox: what needs you ("Action required") and what
     happened (results, market news). */
  function inboxItems() {
    const out = [];
    pendingGrowth().forEach(function (f) {
      out.push({ act: true, kind: "level", fid: f.id, text: f.name + " has " + f.pendingLevels + " level-up pick" + (f.pendingLevels === 1 ? "" : "s") + " waiting." });
    });
    (save.roster || []).forEach(function (f) {
      if (IL.evoPicks && IL.evoPicks(f) > 0) out.push({ act: true, kind: "evo", fid: f.id, text: f.name + " can evolve a move." });
      if (IL.upgradesPending && (IL.upgradesPending(f) > 0 || IL.masteriesPending(f) > 0 || f.respecPicks > 0)) out.push({ act: true, kind: "evo", fid: f.id, text: f.name + " has a milestone to claim." });
      if (IL.isInjured && IL.isInjured(f)) out.push({ act: true, kind: "injury", fid: f.id, text: f.name + " is injured for " + f.injury.weeks + " more league week" + (f.injury.weeks === 1 ? "" : "s") + "." });
    });
    (save.offers || []).forEach(function (o) {
      const f = fighterById(o.fid);
      if (!f) return;
      const mv = IL.marketValue ? IL.marketValue(f) : 0;
      out.push({ act: true, kind: "offer", oid: o.id, text: o.club + " offers " + o.gold + " gold for " + f.name + " (value " + mv + ")." });
    });
    if (save.approach && save.approach.fighter) {
      const af = save.approach.fighter;
      out.push({ act: true, kind: "approach", text: af.name + " (" + (IL.CLASSES[af.cls] ? IL.CLASSES[af.cls].name : af.cls) + ", Lv " + (af.level || 1) + ", " + (IL.potentialOf ? IL.potentialOf(af) : 1) + "★ potential), a champion, asks to join for " + save.approach.cost + " gold." });
    }
    otherFights().forEach(function (o) { out.push({ act: true, kind: "go", tab: o.tab, text: o.label + " is open." }); });
    if (save.cup && save.cup.mid && !save.cup.champion && IL.cupOpponent(save.cup)) out.push({ act: true, kind: "go", tab: "matches:cups", text: "The MidCup is open: " + save.cup.size + "v" + save.cup.size + ", free entry." });
    if (save.academy && save.academy.season === save.season && IL.academyReady(save)) out.push({ act: true, kind: "go", tab: "club:academy", text: "The academy fixture is ready this week." });
    if (thunderLive()) out.push({ act: true, kind: "go", tab: "cup", text: "Chaos Thunder Cup: round " + (save.thunder.round + 1) + " of " + IL.THUNDER_ROUNDS + " is ready." });
    if (seasonDone()) out.push({ act: true, kind: "season", text: "The season is over. The ceremony is waiting." });
    (save.marketNews || []).forEach(function (n) { out.push({ act: false, kind: "news", text: n }); });
    (save.clubLog || []).slice(0, 10).forEach(function (n) { out.push({ act: false, kind: "club", text: n }); });
    (save.history || []).slice(0, 10).forEach(function (h) {
      out.push({ act: false, kind: "result", text: (h.win ? "Won " : "Lost ") + (h.score || "") + " against " + (h.opponent || "a rival") + ". MVP " + (h.mvp || "—") + "." });
    });
    return out;
  }

  function healButton(fid) {
    const f = fighterById(fid);
    const cost = f ? IL.healCost(save, f) : 0;
    const cant = save.gold < cost;
    return '<button type="button" class="ctl gold' + (cant ? " cant-afford" : "") + '" data-heal="' + esc(fid) + '"' + (cant ? " disabled" : "") + '>Heal ' + cost + 'g</button>';
  }
  function healFighter(fid) {
    const f = fighterById(fid);
    if (!f || !IL.healInjury(save, f)) { pitSound("error"); return; }
    pitSound("purchase");
    logClub(f.name + " was healed at the Medical Bay.");
    persist();
    refreshHub();
    showNote(f.name + " is fit to fight.");
  }

  function offerButtons(oid) {
    return '<span class="offer-btns"><button type="button" class="ctl gold" data-offer-accept="' + esc(oid) + '">Accept</button><button type="button" class="ctl" data-offer-decline="' + esc(oid) + '">Decline</button></span>';
  }

  function approachButtons() {
    const a = save.approach;
    const cant = !a || save.gold < a.cost || save.roster.length >= IL.rosterCap(save);
    return '<span class="offer-btns"><button type="button" class="ctl gold' + (cant ? " cant-afford" : "") + '" data-approach-accept="1"' + (cant ? " disabled" : "") + '>Sign ' + (a ? a.cost : 0) + 'g</button><button type="button" class="ctl" data-approach-decline="1">Decline</button></span>';
  }

  /* v94 a champion asked to join: sign for the asking price, or let them go. */
  function answerApproach(yes) {
    const a = save.approach;
    if (!a || !a.fighter) { save.approach = null; refreshHub(); return; }
    if (!yes) { save.approach = null; persist(); refreshHub(); return; }
    if (save.gold < a.cost || save.roster.length >= IL.rosterCap(save)) { pitSound("error"); return; }
    const f = a.fighter;
    save.gold -= a.cost;
    f.lv0 = f.level || 1;
    f.lv0Season = save.season;
    save.roster.push(f);
    if (IL.dedupeNames) IL.dedupeNames(save.roster);
    if (!Array.isArray(save.seenClasses)) save.seenClasses = [];
    if (f.cls && save.seenClasses.indexOf(f.cls) < 0) save.seenClasses.push(f.cls);
    save.hires = (save.hires || 0) + 1;
    save.approach = null;
    save.marketNews = [f.name + " signed for " + a.cost + " gold."].concat(save.marketNews || []).slice(0, 6);
    pitSound("purchase");
    persist();
    refreshHub();
    showNote(f.name + " joins your club.");
  }

  function bidAuction() {
    const a = save.auction;
    if (a && a.fighter && a.fighter.champion && save.settings && save.settings.noChampions) { pitSound("error"); showNote("No champion signings is on (Settings)."); return; }
    if (!a || save.roster.length >= IL.rosterCap(save) || !IL.auctionBid(save)) { pitSound("error"); return; }
    pitSound("purchase");
    persist();
    refreshHub();
    showNote("You lead the auction at " + a.bid + " gold.");
  }

  /* Sell to the bidding club: gold in, gear back to the bag. */
  function answerOffer(oid, yes) {
    const list = save.offers || [];
    const o = list.filter(function (x) { return x.id === oid; })[0];
    save.offers = list.filter(function (x) { return x.id !== oid; });
    if (!o) { refreshHub(); return; }
    const f = fighterById(o.fid);
    if (yes && f && !f.captain) {
      save.gold += o.gold;
      returnGear(f);
      save.roster = save.roster.filter(function (r) { return r !== f; });
      save.lineup = (save.lineup || []).filter(function (fid) { return fid !== f.id; });
      save.marketNews = [f.name + " joined " + o.club + " for " + o.gold + " gold."].concat(save.marketNews || []).slice(0, 6);
      pitSound("sell");
      persist();
      refreshHub();
      showNote(f.name + " leaves for " + o.club + ". +" + o.gold + " gold.");
      return;
    }
    persist();
    refreshHub();
  }

  function inboxHtml() {
    const items = inboxItems();
    const acts = items.filter(function (x) { return x.act; });
    const news = items.filter(function (x) { return !x.act; });
    function row(x, i) {
      const btn = x.kind === "level" ? '<button type="button" class="ctl" data-inbox-level="' + esc(x.fid) + '">Level up ›</button>'
        : x.kind === "go" ? '<button type="button" class="ctl" data-inbox-go="' + esc(x.tab) + '">Open ›</button>'
        : x.kind === "offer" ? offerButtons(x.oid)
        : x.kind === "approach" ? approachButtons()
        : x.kind === "evo" ? '<button type="button" class="ctl" data-detail="' + esc(x.fid) + '">Evolve ›</button>'
        : x.kind === "injury" ? healButton(x.fid)
        : x.kind === "season" ? '<button type="button" class="ctl" data-inbox-season="1">Open ›</button>' : '';
      return '<li class="inbox-row ib-' + x.kind + '"><span>' + esc(x.text) + '</span>' + btn + '</li>';
    }
    return '<div class="sheet-back" id="inboxBack"></div>' +
      '<aside class="sheet inbox-sheet" id="inboxSheet" role="dialog" aria-modal="true" aria-labelledby="inboxTitle">' +
        '<header class="sheet-head"><div><p class="eyebrow">Season ' + save.season + '</p><h2 id="inboxTitle">Events</h2></div>' +
          '<button type="button" class="btn close-x" id="inboxClose" aria-label="Close">Close</button></header>' +
        '<h3 class="section">Action required</h3>' +
        (acts.length ? '<ul class="inbox">' + acts.map(row).join("") + '</ul>' : '<p class="fine">Nothing waits on you.</p>') +
        '<h3 class="section">Feed</h3>' +
        '<div class="feed-filters" role="group" aria-label="Feed filter">' + [["all", "All"], ["result", "Results"], ["news", "Market"], ["club", "Club"]].map(function (c) {
          const n = c[0] === "all" ? news.length : news.filter(function (x) { return x.kind === c[0]; }).length;
          return '<button type="button" class="es-subtab small' + (feedFilter === c[0] ? " on" : "") + '" data-feed="' + c[0] + '">' + c[1] + ' <em class="es-count">' + n + '</em></button>';
        }).join("") + '</div>' +
        (function () {
          const shown = feedFilter === "all" ? news : news.filter(function (x) { return x.kind === feedFilter; });
          return shown.length ? '<ul class="inbox">' + shown.map(row).join("") + '</ul>' : '<p class="fine">Nothing here yet.</p>';
        })() +
        '<button type="button" class="btn ghost inbox-done" id="inboxDone">Close</button>' +
      '</aside>';
  }

  function bindInbox() {
    const box = document.getElementById("inboxSheet");
    if (!box) return;
    const close = function () { inboxOpen = false; refreshHub(); };
    document.getElementById("inboxBack").onclick = close;
    document.getElementById("inboxClose").onclick = close;
    document.getElementById("inboxDone").onclick = close;
    box.onclick = function (ev) {
      const lv = ev.target.closest("[data-inbox-level]");
      if (lv) { inboxOpen = false; levelFocus = lv.dataset.inboxLevel; showGrowth(); return; }
      const go = ev.target.closest("[data-inbox-go]");
      if (go) { inboxOpen = false; showHub(go.dataset.inboxGo); return; }
      if (ev.target.closest("[data-inbox-season]")) { inboxOpen = false; showSeasonEnd(); return; }
      const oy = ev.target.closest("[data-offer-accept]");
      if (oy) { answerOffer(oy.dataset.offerAccept, true); return; }
      const on = ev.target.closest("[data-offer-decline]");
      if (on) { answerOffer(on.dataset.offerDecline, false); return; }
      const ay = ev.target.closest("[data-approach-accept]");
      if (ay && !ay.disabled) { answerApproach(true); return; }
      if (ev.target.closest("[data-approach-decline]")) { answerApproach(false); return; }
      const dt = ev.target.closest("[data-detail]");
      if (dt) { inboxOpen = false; detailId = dt.dataset.detail; refreshHub(); return; }
      const ff = ev.target.closest("[data-feed]");
      if (ff) { feedFilter = ff.dataset.feed; refreshHub(); return; }
      const hl = ev.target.closest("[data-heal]");
      if (hl && !hl.disabled) healFighter(hl.dataset.heal);
    };
  }

  /* ---------- v71 hub header ---------- */
  function weekPips() {
    const total = seasonWeeks();
    let out = "";
    for (let i = 0; i < total; i++) {
      const r = seasonLog(i);
      const cls = r ? (r.win ? "w" : "l") : i === save.round ? "now" : "";
      out += '<i class="pip ' + cls + '"></i>';
    }
    return '<span class="week-pips" aria-hidden="true">' + out + '</span>';
  }

  function hubHeadHtml(done) {
    const week = Math.min(seasonWeeks(), (save.round || 0) + (done ? 0 : 1));
    const div = IL.DIVISIONS[IL.divisionOf(save)];
    return '<header class="hub-head es-head">' +
      '<button type="button" class="crest-btn" id="clubIdentity" aria-label="Club name and colors" title="Club name and colors">' + crestHtml(save.clubName, "md", save.crest, save.plate) + '<span class="crest-edit" aria-hidden="true">✎</span></button>' +
      '<h2 class="es-club">' + esc(save.clubName) + '</h2>' +
      '<div class="es-week"><p><b>Season ' + save.season + ' - Week ' + week + '/' + seasonWeeks() + '</b><span class="div-chip">' + esc((div.roman ? "Div " + div.roman + " · " : "") + div.name.replace(" Division", "")) + '</span>' +
        ((save.mods || []).length && IL.seasonModById ? '<span class="mod-chip" title="' + esc((save.mods || []).map(function (id) { const m = IL.seasonModById(id); return m ? m.name + ": " + m.blurb : ""; }).join("  ")) + '">◆ ' + esc((save.mods || []).map(function (id) { const m = IL.seasonModById(id); return m ? m.name : ""; }).join(" · ")) + '</span>' : '') +
        '</p>' + weekPips() + '</div>' +
      '<div class="es-purse">' +
        '<span class="coin" title="Gold">' + coinIcon("gold") + '<b>' + save.gold + '</b></span>' +
        '<span class="coin" title="Renown">' + coinIcon("renown") + '<b>' + (save.renown || 0) + '</b></span>' +
        '<span class="coin" title="Cup tokens">' + coinIcon("token") + '<b>' + (save.tokens || 0) + '</b></span>' +
        (done ? '<button type="button" class="btn gold" id="openSeason">Ceremony</button>' : '') +
      '</div>' +
      '<button type="button" class="icon-btn menu-btn" id="settings" aria-label="Menu" title="Menu">Menu</button>' +
    '</header>';
  }

  /* On a phone the tabs pin to the bottom; the action bar sits on them. */
  function seatDock() {
    const tb = document.getElementById("tabbar");
    if (!tb || typeof getComputedStyle === "undefined") return;
    const h = getComputedStyle(tb).position === "fixed" ? tb.offsetHeight : 0;
    document.documentElement.style.setProperty("--tabbar-h", h + "px");
  }
  if (typeof window !== "undefined") window.addEventListener("resize", seatDock);

  /* Tapping the tab you are on goes back to its first page. */
  function resetPane(tab) {
    if (tab === "roster") rosterPane = "team";
    else if (tab === "matches") matchesPane = "league";
    else if (tab === "club") clubPane = "home";
    else if (tab === "intel") intelPane = "stats";
  }

  function subTabs(kind, current, options) {
    return '<nav class="es-subtabs" role="tablist">' + options.map(function (o) {
      const on = o[0] === current;
      return '<button type="button" role="tab" class="es-subtab' + (on ? " on" : "") + '" data-pane="' + kind + ':' + o[0] + '" aria-selected="' + on + '">' + o[1] + '</button>';
    }).join("") + '</nav>';
  }

  /* ---------- Overview ---------- */
  function overviewPanel() {
    const done = seasonDone();
    const rival = done ? null : nextRival();
    const size = done ? 0 : weekSize(save.round);
    const yours = size ? fielded(save.roster, size) : [];
    const ready = !size || yours.length >= size;
    const table = sortedClubs();
    const youAt = table.findIndex(function (c) { return c.you; });
    const lineup = yours.map(function (f) {
      const st = IL.staminaOf ? IL.staminaOf(f) : 100;
      const kit = IL.CLASSES[f.cls] || {};
      return '<li><canvas class="es-mface' + (f.captain ? ' cap' : '') + '" width="40" height="36" data-key="' + esc(IL.hero.keyOf(f.parts)) + '" data-anim="' + (kit.idle || "idle") + '" data-scale="1" data-foot="3"></canvas>' +
        '<span class="ov-name">' + esc(f.name) + '</span><small>' + esc(kit.name || "") + ' · Lv ' + (f.level || 1) + '</small>' +
        '<span class="ov-form"><i style="width:' + Math.round(st) + '%"></i></span></li>';
    }).join("");
    const champs = done ? champsState() : null;
    const champOpp = champs && !champs.champion ? IL.cupOpponent(champs) : null;
    const next = done
      ? (champOpp
        ? '<section class="es-card ov-next champs" id="nextCard"><p class="eyebrow">Champions Cup · ' + (champs.round >= 1 ? "Final" : "Semifinal") + ' · 3v3</p>' +
            '<div class="ov-vs">' +
              '<div class="ov-side">' + crestHtml(save.clubName, "md", save.crest, save.plate) + '<b>' + esc(save.clubName) + '</b></div>' +
              '<span class="vs">vs</span>' +
              '<div class="ov-side">' + crestHtml(champOpp.foe.name, "md", crestIndexOf(champOpp.foe.name)) + '<b>' + esc(champOpp.foe.name) + '</b></div>' +
            '</div>' +
            '<p class="fine">The league\'s top four play it out before the ceremony. The winner takes a relic.</p>' +
            '<div class="ov-actions"><button type="button" class="btn fight" id="champsFight">Fight</button></div></section>'
        : '<section class="es-card ov-next" id="nextCard"><p class="eyebrow">League</p><h3>Season ' + save.season + ' closed</h3>' +
            (champs && champs.champion ? '<p class="fine">Champions Cup: ' + esc(champsName(champs)) + '.</p>' : '') +
            '<button type="button" class="btn gold" id="openSeasonBanner">Open the ceremony</button></section>')
      : '<section class="es-card ov-next" id="nextCard">' +
          '<p class="eyebrow">Next match · Week ' + (save.round + 1) + ' · ' + size + 'v' + size + '</p>' +
          '<div class="ov-vs">' +
            '<div class="ov-side">' + crestHtml(save.clubName, "md", save.crest, save.plate) + '<b>' + esc(save.clubName) + '</b><small>' + (youAt >= 0 ? ordinal(youAt + 1) : "") + '</small></div>' +
            '<span class="vs">vs</span>' +
            '<div class="ov-side">' + crestHtml(rival ? rival.name : "", "md", rival ? clubCrest(rival) : 0) + '<b>' + esc(rival ? rival.name : "—") + '</b><small>' + (rival ? ordinal(table.indexOf(rival) + 1) : "") + '</small></div>' +
          '</div>' +
          (nemesisBanner(rival) ? '<p class="fine">' + nemesisBanner(rival) + '</p>' : '') +
          synergyLine(yours, "partySynergy") +
          '<h4 class="ov-sub">Lineup readiness</h4>' +
          (lineup ? '<ul class="ov-lineup">' + lineup + '</ul>' : '<p class="fine">Nobody fielded yet.</p>') +
          (ready ? '' : '<p class="banner">Pick ' + (size - yours.length) + ' more on the Roster tab.</p>') +
          '<div class="ov-actions"><button type="button" class="btn ghost" data-goto="roster">Lineup</button>' +
          '<button type="button" class="btn fight" id="nextMatch"' + (ready ? "" : " disabled") + '>' + (ready ? "Fight" : "Pick " + size) + '</button></div>' +
        '</section>';
    const acts = inboxItems().filter(function (x) { return x.act; });
    const action = acts.length
      ? '<section class="es-card ov-action"><h3 class="section">Action required</h3><ul class="inbox">' + acts.slice(0, 4).map(function (x) {
          const btn = x.kind === "level" ? '<button type="button" class="ctl" data-inbox-level="' + esc(x.fid) + '">Level up ›</button>'
            : x.kind === "go" ? '<button type="button" class="ctl" data-goto="' + esc(x.tab) + '">Open ›</button>'
            : x.kind === "offer" ? offerButtons(x.oid)
            : x.kind === "approach" ? approachButtons()
            : x.kind === "evo" ? '<button type="button" class="ctl" data-detail="' + esc(x.fid) + '">Evolve ›</button>'
            : x.kind === "injury" ? healButton(x.fid) : '';
          return '<li class="inbox-row"><span>' + esc(x.text) + '</span>' + btn + '</li>';
        }).join("") + '</ul></section>'
      : '';
    const feed = inboxItems().filter(function (x) { return !x.act; });
    const top = table.slice(0, 4).map(function (c, i) {
      return '<li class="' + (c.you ? "you" : "") + '"><b>' + (i + 1) + '</b>' + crestHtml(c.name, "sm", clubCrest(c), c.you ? save.plate : undefined) + '<span>' + esc(c.name) + '</span><em>' + c.pts + '</em></li>';
    }).join("");
    const star = (save.history || []).filter(function (h) { return h.win && h.mvp && h.mvp !== "—"; })[0];
    return tutorHtml() +
      (pendingGrowth().length ? '<p class="banner level-banner">' + esc(levelBannerText()) + ' <button type="button" class="btn gold" id="openGrowth">Level up</button></p>' : '') +
      '<div class="ov-grid">' +
        '<div class="ov-col">' + next + action + '</div>' +
        '<div class="ov-col">' +
          '<section class="es-card"><h3 class="section">Standings · ' + esc(IL.DIVISIONS[IL.divisionOf(save)].name) + '</h3><ol class="ov-table">' + top + '</ol>' +
            '<button type="button" class="text-btn" data-goto="matches">Full table ›</button></section>' +
          seasonModsHtml() + seasonGoalsHtml() +
          (star ? '<section class="es-card ov-star"><p class="eyebrow">Fighter of the week</p><h3>' + esc(star.mvp) + '</h3><p class="fine">MVP against ' + esc(star.opponent) + ', ' + esc(star.score) + '.' + (star.mvpImpact ? ' Impact ' + star.mvpImpact + '.' : '') + '</p></section>' : '') +
          '<section class="es-card"><h3 class="section">Feed</h3>' + (feed.length ? '<ul class="ov-feed">' + feed.slice(0, 6).map(function (x) { return '<li>' + esc(x.text) + '</li>'; }).join("") + '</ul>' : '<p class="fine">Results and market news show up here.</p>') + '</section>' +
        '</div>' +
      '</div>';
  }

  /* ---------- Matches ---------- */
  function matchesPanel() {
    const panes = [["league", "League"], ["cups", "Cups"], ["history", "History"]];
    let body;
    if (matchesPane === "cups") body = champsBlock() + cupPanel();
    else if (matchesPane === "history") body = historyHtml();
    else body = leaguePane();
    return subTabs("matches", matchesPane, panes) + body;
  }

  function leaguePane() {
    const tierNow = IL.divisionOf(save);
    const rows = sortedClubs().map(function (c, i) {
      const zone = (i <= 1 && tierNow < IL.DIVISIONS.length - 1) ? " promo" : (i >= (save.clubs || []).length - 2 && tierNow > 0) ? " releg" : "";
      const form = (c.form || []).slice(-3).map(function (r) { return '<i class="form ' + (r === "W" ? "w" : "l") + '">' + r + '</i>'; }).join("");
      const diff = (c.pf || 0) - (c.pa || 0);
      return '<tr class="' + (c.you ? "you" : "") + zone + '"><td>' + (i + 1) + '</td><td class="club-cell">' + crestHtml(c.name, "sm", clubCrest(c), c.you ? save.plate : undefined) + '<span class="club-name">' + esc(c.name) + '</span></td>' +
        '<td>' + c.w + '-' + c.l + '</td><td class="' + (diff > 0 ? "up" : diff < 0 ? "down" : "") + '">' + (diff > 0 ? "+" : "") + diff + '</td><td><b>' + c.pts + '</b></td><td class="form-cell">' + form + '</td></tr>';
    }).join("");
    const cal = [];
    for (let r = 0; r < seasonWeeks(); r++) {
      const log = seasonLog(r);
      const foe = roundRival(r);
      const res = log ? '<b class="' + (log.win ? "w" : "l") + '">' + (log.win ? "W " : "L ") + log.pf + '-' + log.pa + '</b>' : r === save.round ? '<b class="now">NEXT</b>' : '<b>-</b>';
      cal.push('<li class="' + (r === save.round ? "now" : "") + '"><span class="wk">W' + (r + 1) + '</span>' + (foe ? crestHtml(foe.name, "sm", clubCrest(foe)) + '<span>vs ' + esc(foe.name) + '</span>' : '<span>—</span>') + '<em>' + weekSize(r) + 'v' + weekSize(r) + '</em>' + res + '</li>');
    }
    const midAt = Math.floor(seasonWeeks() / 2);
    const midText = save.midWon === save.season ? "MidCup won" : save.cup && save.cup.mid && save.cup.season === save.season ? (save.cup.champion ? "MidCup played" : "MidCup open · " + save.cup.size + "v" + save.cup.size) : "MidCup opens after week " + midAt;
    cal.splice(midAt, 0, '<li class="cup' + (save.cup && save.cup.mid && !save.cup.champion ? " now" : "") + '"><span class="wk">Mid</span><span>' + esc(midText) + '</span></li>');
    if (save.cup && !save.cup.champion && !save.cup.mid) cal.push('<li class="cup"><span class="wk">Cup</span><span>' + esc("Cup bracket is open") + '</span></li>');
    const champsRow = seasonDone() ? champsState() : null;
    let champsText = "Champions Cup · the top four, 3v3 knockouts";
    if (champsRow) {
      const o = !champsRow.champion ? IL.cupOpponent(champsRow) : null;
      champsText = champsRow.champion ? "Champions Cup won by " + champsName(champsRow) : o ? "Champions Cup · " + (champsRow.round >= 1 ? "final" : "semifinal") + " vs " + o.foe.name : "Champions Cup · being played";
    }
    cal.push('<li class="cup' + (champsRow && !champsRow.champion ? " now" : "") + '"><span class="wk">CC</span><span>' + esc(champsText) + '</span></li>');
    cal.push('<li class="cup"><span class="wk">End</span><span>Season ceremony · promotion and relegation</span></li>');
    return '<div class="es-split">' +
      '<section class="es-card"><h3 class="section">' + esc(IL.DIVISIONS[tierNow].name) + ' · League standings</h3>' +
        '<p class="fine division-key"><span class="key promo"></span>Top two go up<span class="key releg"></span>Bottom two go down · rivals Lv ' + IL.rivalRange(save).join('–') + '</p>' +
        '<table class="board es-board"><thead><tr><th>#</th><th>Team</th><th>W-L</th><th>+/-</th><th>Pts</th><th>Form</th></tr></thead><tbody>' + rows + '</tbody></table></section>' +
      '<section class="es-card"><h3 class="section">Season calendar</h3><ol class="es-calendar">' + cal.join("") + '</ol></section>' +
    '</div>';
  }

  function seasonLog(r) {
    const row = (save.leagueLog || [])[r];
    return row && row.season === save.season ? row : null;
  }

  function roundRival(r) {
    const pairs = (save.fixtures || [])[r] || [];
    for (let i = 0; i < pairs.length; i++) {
      const a = clubById(pairs[i][0]);
      const b = clubById(pairs[i][1]);
      if (a && a.you) return b;
      if (b && b.you) return a;
    }
    return null;
  }

  /* ---------- Roster ---------- */
  function rosterPanel() {
    const panes = [["team", "Party"], ["gear", "Gear"], ["relics", "Relics"]];
    const body = rosterPane === "relics" ? relicsPanel()
      : rosterPane === "gear" ? '<div class="pane es-armory" id="armoryPane">' + armoryHtml() + '</div>'
      : teamPanel();
    return subTabs("roster", rosterPane, panes) + body;
  }

  /* v72 Roster, after Eslabong: the first team as big cards (stats,
     moves, gear, behavior, captain), then a strip of substitutes. */
  const ROLE_TONE = { tank: "tank", melee: "melee", dash: "rogue", kite: "ranged", cast: "caster", heal: "support", support: "support" };

  function statPips(st) {
    const row = [["HP", "drop_water_or_blood", Math.round(st.hp)], ["ATK", "sword", Math.round(st.atk)], ["DEF", "armor_1_body", Math.round(st.def)], ["SPD", "shoes", Math.round(st.speed)]];
    return '<p class="es-stats">' + row.map(function (r) {
      return '<span title="' + r[0] + '"><img class="ui-glyph" alt="' + r[0] + '" src="assets/ui/glyphs/orange_32/' + r[1] + '.png"><b>' + r[2] + '</b></span>';
    }).join("") + '</p>';
  }

  function esFighterCard(f, size) {
    const kit = IL.CLASSES[f.cls] || IL.CLASSES.warrior;
    const st = IL.scaledStats(f, kit);
    const tone = ROLE_TONE[kit.role] || "melee";
    const moves = [0, 1, 2].map(function (k) {
      const id = (f.loadout || [])[k];
      if (!id) return '<i class="es-move empty"></i>';
      const sp = f.specs && f.specs[id];
      const ab = IL.abilityById(id);
      return '<i class="es-move" title="' + esc((sp ? IL.MODS[sp.mod].name + " " : "") + (ab ? ab.name : id)) + '">' + (IL.abilityIcon ? iconTag(IL.abilityIcon(id), 34) : "") + (sp ? '<em class="spec-pip">' + esc(IL.MODS[sp.mod].name.charAt(0)) + '</em>' : '') + '</i>';
    }).join("");
    const talents = (f.talents || []).slice(0, 3).map(function (t) {
      return '<i class="es-move talent ' + (RARITY_CLASS[t.tier] || "common") + '" title="' + esc(IL.TALENTS[t.id].name) + '"><b>' + esc(IL.TALENTS[t.id].name.charAt(0)) + '</b></i>';
    }).join("");
    const gear = ["weapon", "armor", "trinket"].map(function (slot) {
      const item = f.gear && f.gear[slot];
      return '<i class="es-gear' + (item ? "" : " empty") + '" title="' + esc(item ? IL.itemName(item) : "Empty " + slotLabel(slot).toLowerCase()) + '">' + (item ? (IL.itemIcon && IL.itemIcon(item) ? iconTag(IL.itemIcon(item), 30) : esc(IL.itemName(item).charAt(0))) : '') + '</i>';
    }).join("");
    const relicMarks = IL.wornIds(f).map(function (id) { return IL.relicById(id); }).filter(Boolean).map(function (relic) {
      return '<i class="es-gear relic" title="' + esc(relic.name) + '">' + esc(relic.name.charAt(0)) + '</i>';
    }).join("");
    const ai = IL.normAi ? IL.normAi(f.ai) : null;
    const behave = esc(tacticLabel(f.tactic) + " · " + personalityLabel(f.personality) + (ai && IL.aiCustom && IL.aiCustom(f.ai) ? " · custom" : ""));
    return '<article class="es-fcard ' + tone + (f.captain ? " captain" : "") + '" data-role="' + esc(kit.role) + '">' +
      '<header><h3>' + esc(f.name) + '</h3></header>' +
      '<div class="es-fc-id">' +
        '<button type="button" class="portrait" data-detail="' + esc(f.id) + '" aria-label="Open ' + esc(f.name) + '">' +
          portraitWrap('width="64" height="58" data-key="' + esc(IL.hero.keyOf(f.parts)) + '" data-anim="' + (kit.idle || "idle") + '" data-scale="2" data-foot="5"', f.captain, f) +
        '</button>' +
        '<div><p class="es-lv">Lv ' + (f.level || 1) + (f.pendingLevels > 0 ? ' <span class="es-up" title="Level-up waiting">▲' + f.pendingLevels + '</span>' : '') + hurtTag(f) + '</p>' +
          '<p class="es-class ' + tone + '">' + esc(kit.name) + '</p>' + staminaBar(f) + '</div>' +
      '</div>' +
      statPips(st) +
      '<div class="es-kit"><div class="es-moves">' + moves + talents + '</div><div class="es-gearcol">' + gear + relicMarks + '</div></div>' +
      '<button type="button" class="es-behave" data-fid="' + esc(f.id) + '" title="Tap to change the tactic">' + behave + '</button>' +
      '<div class="es-fc-foot">' +
        (f.captain ? '<span class="es-captain">Captain</span>' : '<button type="button" class="ctl" data-set-captain="' + esc(f.id) + '">Set captain</button>') +
        lineupControl(f, size) +
      '</div>' +
    '</article>';
  }

  /* v89 party board: swap, gear and hire without leaving the page. */
  function partyActs(f) {
    const picked = partySwap === f.id;
    const other = partySwap && partySwap !== f.id;
    const inParty = (save.lineup || []).indexOf(f.id) >= 0;
    const otherIn = other && (save.lineup || []).indexOf(partySwap) >= 0;
    const swapLabel = picked ? "Cancel swap" : other ? (inParty === otherIn ? "Swap places" : (inParty ? "Swap out" : "Swap in")) : "Swap";
    return '<span class="party-acts">' +
      '<button type="button" class="ctl' + (picked ? " on" : other ? " target" : "") + '" data-party-swap="' + esc(f.id) + '">' + swapLabel + '</button>' +
      '<button type="button" class="ctl' + (partyGear === f.id ? " on" : "") + '" data-party-gear="' + esc(f.id) + '">' + (partyGear === f.id ? "Close gear" : "Gear") + '</button>' +
    '</span>';
  }

  function partyDrawer(f) {
    return '<section class="party-drawer" id="partyGear" data-for="' + esc(f.id) + '">' +
      '<header><h3 class="section">Gear · ' + esc(f.name) + '</h3><button type="button" class="ctl" data-party-gear="' + esc(f.id) + '">Close</button></header>' +
      quickGearHtml(f) + '</section>';
  }

  function hurtTag(f) {
    return IL.isInjured && IL.isInjured(f) ? ' <em class="hurt-badge" title="Injured: sits out while a healthy bench fighter can cover, else plays at 85% HP and ATK">✚ ' + f.injury.weeks + ' wk</em>' : '';
  }

  function benchRow(f, size) {
    const kit = IL.CLASSES[f.cls] || IL.CLASSES.warrior;
    const st = IL.scaledStats(f, kit);
    return '<article class="bench-row' + (partySwap === f.id ? " picked" : "") + '" data-role="' + esc(kit.role) + '">' +
      '<button type="button" class="portrait" data-detail="' + esc(f.id) + '" aria-label="Open ' + esc(f.name) + '">' +
        portraitWrap('width="56" height="50" data-key="' + esc(IL.hero.keyOf(f.parts)) + '" data-anim="' + (kit.idle || "idle") + '" data-scale="2" data-foot="4"', f.captain, f) +
      '</button>' +
      '<span class="bench-id"><b>' + esc(f.name) + hurtTag(f) + '</b><small>' + esc(kit.name) + ' · Lv ' + (f.level || 1) + ' · HP ' + Math.round(st.hp) + ' · ATK ' + Math.round(st.atk) + '</small>' + staminaBar(f) + '</span>' +
      '<span class="es-sub-act">' + ((save.lineup || []).length < IL.PARTY_CAP ? lineupControl(f, size) : "") + partyActs(f) + trainControl(f, false) + '</span>' +
    '</article>';
  }

  function partyHireHtml() {
    const room = IL.rosterCap(save) - save.roster.length;
    const rows = (save.market || []).map(function (row, i) { return { row: row, i: i }; }).filter(function (x) {
      return x.row && !x.row.locked && x.row.fighter;
    }).sort(function (a, b) {
      const ca = save.gold >= a.row.cost ? 0 : 1;
      const cb = save.gold >= b.row.cost ? 0 : 1;
      return ca - cb || (b.row.fighter.level || 1) - (a.row.fighter.level || 1) || a.row.cost - b.row.cost;
    }).slice(0, 4);
    const list = rows.map(function (x) {
      const f = x.row.fighter;
      const kit = IL.CLASSES[f.cls] || IL.CLASSES.warrior;
      const st = IL.scaledStats(f, kit);
      const cant = save.gold < x.row.cost || room <= 0;
      return '<div class="hire-row">' +
        '<span class="bench-id"><b>' + esc(f.name) + (f.champion ? ' <em class="champ">★</em>' : '') + '</b><small>' + esc(kit.name) + ' · Lv ' + (f.level || 1) + ' · HP ' + Math.round(st.hp) + ' · ATK ' + Math.round(st.atk) + '</small></span>' +
        '<button type="button" class="btn primary' + (cant ? " cant-afford" : " buyable") + '" data-party-hire="' + x.i + '"' + (cant ? " disabled" : "") + '>Hire · ' + x.row.cost + 'g</button>' +
      '</div>';
    }).join("");
    return '<section class="es-card party-hire" id="partyHire"><header class="es-team-head"><h3 class="section">Hire</h3>' +
      '<span class="fine">' + (room > 0 ? "Room for " + room + " more" : "Roster full (" + save.roster.length + "/" + IL.rosterCap(save) + "). Sell a fighter or build the Barracks.") + '</span></header>' +
      (list || '<p class="fine">The market is empty until the next refresh.</p>') +
      '<button type="button" class="ctl" data-tab-jump="market">Whole market ›</button></section>';
  }

  function partySwapDo(a, b) {
    if (!Array.isArray(save.lineup)) save.lineup = [];
    const ia = save.lineup.indexOf(a);
    const ib = save.lineup.indexOf(b);
    if (ia >= 0 && ib >= 0) { save.lineup[ia] = b; save.lineup[ib] = a; }
    else if (ia >= 0) save.lineup[ia] = b;
    else if (ib >= 0) save.lineup[ib] = a;
    else return false;
    return true;
  }

  /* Strongest first: level, then health and attack, the captain kept in. */
  function bestLineup() {
    const kitStats = function (f) { const st = IL.scaledStats(f, IL.CLASSES[f.cls] || IL.CLASSES.warrior); return st.hp / 10 + st.atk + st.def * 2; };
    const order = save.roster.slice().sort(function (a, b) {
      return (b.captain ? 1 : 0) - (a.captain ? 1 : 0) || (b.level || 1) - (a.level || 1) || kitStats(b) - kitStats(a);
    });
    save.lineup = order.filter(function (f) { return !IL.isInjured(f); }).concat(order.filter(function (f) { return IL.isInjured(f); })).slice(0, IL.PARTY_CAP).map(function (f) { return f.id; });
  }

  /* v97 three saved lineups, each with its formation. */
  function lineupPresets() {
    const sets = Array.isArray(save.lineups) ? save.lineups : [];
    return '<div class="lineup-presets" id="lineupPresets">' + ["A", "B", "C"].map(function (tag, i) {
      const p = sets[i];
      const ids = p && Array.isArray(p.ids) ? p.ids.filter(function (id) { return fighterById(id); }) : [];
      const names = ids.map(function (id) { return fighterById(id).name.split(" ")[0]; }).join(", ");
      const fm = p && p.formation && IL.FORMATIONS[p.formation] ? IL.FORMATIONS[p.formation].name : "";
      return '<div class="lp-slot">' +
        (ids.length
          ? '<button type="button" class="lp-load" data-lineup-load="' + i + '"><b>' + tag + '</b><span>' + esc(names) + (fm ? ' · ' + esc(fm) : '') + '</span></button>'
          : '<span class="lp-empty"><b>' + tag + '</b><span>Empty</span></span>') +
        '<button type="button" class="ctl lp-save" data-lineup-save="' + i + '" aria-label="Save the current lineup as ' + tag + '">Save</button>' +
      '</div>';
    }).join("") + '</div>';
  }
  function saveLineupPreset(i) {
    if (!Array.isArray(save.lineups)) save.lineups = [];
    save.lineups[i] = { ids: (save.lineup || []).filter(function (id) { return fighterById(id); }).slice(0, IL.PARTY_CAP), formation: save.formation || "line" };
    persist();
    refreshHub();
    showNote("Lineup " + "ABC".charAt(i) + " saved.");
  }
  function loadLineupPreset(i) {
    const p = Array.isArray(save.lineups) ? save.lineups[i] : null;
    const ids = p && Array.isArray(p.ids) ? p.ids.filter(function (id) { return fighterById(id); }) : [];
    if (!ids.length) { pitSound("error"); return; }
    const rest = (save.lineup || []).filter(function (id) { return ids.indexOf(id) < 0 && fighterById(id); });
    save.lineup = ids.concat(rest).slice(0, IL.PARTY_CAP);
    if (p.formation && IL.FORMATIONS[p.formation]) save.formation = p.formation;
    partySwap = null;
    persist();
    refreshHub();
    showNote("Lineup " + "ABC".charAt(i) + " loaded.");
  }

  function teamPanel() {
    const size = !seasonDone() ? weekSize(save.round) : 0;
    const slotOf = {};
    (save.lineup || []).forEach(function (id, i) { slotOf[id] = i; });
    const ordered = save.roster.slice().sort(function (a, b) {
      const sa = Object.prototype.hasOwnProperty.call(slotOf, a.id) ? slotOf[a.id] : 99;
      const sb = Object.prototype.hasOwnProperty.call(slotOf, b.id) ? slotOf[b.id] : 99;
      return sa - sb;
    });
    const first = [];
    const subs = [];
    ordered.forEach(function (f) {
      const slot = Object.prototype.hasOwnProperty.call(slotOf, f.id) ? slotOf[f.id] : -1;
      const fighting = slot >= 0 && (!size || slot < size);
      (fighting ? first : subs).push(f);
    });
    const want = size || IL.PARTY_CAP;
    if (partySwap && !fighterById(partySwap)) partySwap = null;
    if (partyGear && !fighterById(partyGear)) partyGear = null;
    const cards = first.map(function (f) { return esFighterCard(f, size).replace('<div class="es-fc-foot">', '<div class="es-fc-party">' + partyActs(f) + '</div><div class="es-fc-foot">'); });
    for (let i = first.length; i < want; i++) cards.push('<article class="es-fcard empty"><p>Empty slot</p><small>' + (subs.length ? "Tap Add on a bench fighter below." : "Hire a fighter below.") + '</small></article>');
    const subTiles = subs.map(function (f) { return benchRow(f, size) + (partyGear === f.id ? partyDrawer(f) : ""); });
    const firstDrawer = partyGear && first.some(function (f) { return f.id === partyGear; }) ? partyDrawer(fighterById(partyGear)) : "";
    const pilot = !!(save.settings && save.settings.pilot);
    const left = save.trainsLeft || 0;
    return '<div id="fighterList" class="es-team">' +
      '<header class="es-team-head"><h3 class="section">Party</h3><span class="fine">' + (size ? 'Week ' + (save.round + 1) + ' fields ' + size + '. ' : '') + (partySwap ? 'Pick who to swap with ' + esc(fighterById(partySwap).name.split(" ")[0]) + '.' : 'Swap, gear and hire here. Tap a portrait for the full sheet.') + '</span>' +
        '<button type="button" class="ctl" data-party-best="1">Best lineup</button></header>' +
      lineupPresets() +
      '<div class="es-first" id="partyCards">' + cards.join("") + '</div>' + firstDrawer +
      '<nav class="es-team-actions">' +
        '<button type="button" class="es-subtab' + (pilot ? "" : " on") + '" data-pilot-pick="off">Autobattle</button>' +
        '<button type="button" class="es-subtab' + (pilot ? " on" : "") + '" data-pilot-pick="on">Control</button>' +
        '<button type="button" class="es-subtab" data-pane="roster:gear">Gear</button>' +
        '<button type="button" class="es-subtab" data-pane="roster:relics">Relics</button>' +
        '<button type="button" class="es-subtab" data-goto="train">Development</button>' +
      '</nav>' +
      '<section class="es-subs-wrap"><h3 class="section">Bench · ' + subs.length + '</h3><p class="fine es-subs-note">Drills left this week: ' + left + '</p>' +
        '<div class="es-bench" id="benchList">' + (subs.length ? '' : emptyState("The bench is empty.", "The whole club is in the party.")) + subTiles.join("") + '</div>' +
      '</section>' +
      partyHireHtml() +
    '</div>';
  }

  /* ---------- Club: activities, facilities, services ---------- */
  function clubTile(id, title, line, blurb, tone, badge) {
    return '<button type="button" class="es-tile ' + tone + '" data-pane="club:' + id + '">' +
      '<span class="tile-text"><b>' + esc(title) + '</b><small>' + esc(line) + '</small><span>' + esc(blurb) + '</span></span>' +
      (badge ? '<em class="tile-badge">' + esc(badge) + '</em>' : '') + '</button>';
  }

  function gateTile() {
    const run = save.gateRun;
    const line = run ? "Floor " + run.floor + " of " + IL.GATE_FLOORS + " · run in progress" : gateOpen() ? "Open this week · best " + (save.gateBest || 0) + "/" + IL.GATE_FLOORS + " floors" : "Cleared this week · best " + (save.gateBest || 0) + "/" + IL.GATE_FLOORS;
    return '<button type="button" class="es-tile steel" id="gateTile"' + (!run && !gateOpen() ? ' disabled' : '') + '>' +
      '<span class="tile-text"><b>Iron Gate</b><small>' + esc(line) + '</small><span>Eight floors, bosses on 5, 7 and 8. Health carries over; every boss drops a chest.</span></span>' +
      '<em class="tile-badge">' + (run ? "GO" : "PVE") + '</em></button>';
  }

  /* v101 staff: one of each role, stars scale the effect. */
  function staffStarsHtml(n) { return '<span class="pot">' + "★★★★★".slice(0, n) + '<i>' + "★★★★★".slice(0, 5 - n) + '</i></span>'; }
  function staffPanel() {
    if (IL.restockStaff && (!Array.isArray(save.staffMarket) || save.staffWeek == null)) { IL.restockStaff(save, takeRng()); persist(); }
    const hired = save.staff || [];
    const slots = IL.staffSlots(save);
    const mine = hired.map(function (st) {
      const role = IL.STAFF_ROLES[st.role];
      return '<article class="es-card staff-card"><header><b>' + esc(st.name) + '</b>' + staffStarsHtml(st.stars) + '</header>' +
        '<p class="staff-role">' + esc(role ? role.name : st.role) + '</p><p>' + esc(role ? role.text(st.stars) : "") + '</p>' +
        '<button type="button" class="btn ghost" data-staff-fire="' + esc(st.id) + '">Let go</button></article>';
    }).join("");
    const market = (save.staffMarket || []).map(function (row, i) {
      const role = IL.STAFF_ROLES[row.role];
      const same = hired.filter(function (h) { return h.role === row.role; })[0];
      const full = !same && hired.length >= slots;
      const cant = save.gold < row.cost || full;
      return '<article class="es-card staff-card"><header><b>' + esc(row.name) + '</b>' + staffStarsHtml(row.stars) + '</header>' +
        '<p class="staff-role">' + esc(role ? role.name : row.role) + '</p><p>' + esc(role ? role.text(row.stars) : "") + '</p>' +
        (same ? '<p class="fine' + (same.stars > row.stars ? ' staff-worse' : '') + '">Replaces ' + esc(same.name) + ' (' + same.stars + '★)' + (same.stars > row.stars ? ', a downgrade' : '') + '.</p>' : '') +
        '<button type="button" class="btn primary' + (cant ? " cant-afford" : " buyable") + '" data-staff-hire="' + i + '"' + (cant ? " disabled" : "") + '>' + (full ? "No free slot" : "Hire · " + row.cost + "g") + '</button></article>';
    }).join("");
    return '<div class="staff-pane" id="staffPane">' +
      '<p class="fine">' + hired.length + ' of ' + slots + ' staff slots. One of each role; the Club House adds a slot a rank. The staff market turns over after each league week.</p>' +
      '<h3 class="section">Your staff</h3><div class="staff-grid">' + (mine || emptyState("No staff yet.", "Hire from the market below.")) + '</div>' +
      '<h3 class="section">Staff market</h3><div class="staff-grid">' + (market || emptyState("Nobody is looking this week.", "New faces after the next league match.")) + '</div>' +
    '</div>';
  }

  /* v103 Academy: youth squad, weekly fixture, Development Tomes. */
  function academyPanel() {
    const fresh = !save.academy || save.academy.season !== save.season;
    const a = IL.ensureAcademy(save, takeRng());
    if (fresh) persist();
    const inSquad = function (f) { return a.ids.indexOf(f.id) >= 0; };
    const squad = (save.roster || []).filter(inSquad);
    const open = (save.roster || []).filter(function (f) { return !inSquad(f) && IL.academyEligible(f); });
    const avg = IL.clubAverage(save);
    const tomes = save.devTomes || 0;
    const tomeLeft = Math.max(0, IL.TOMES_A_SEASON - (a.tomesUsed || 0));
    function row(f, act) {
      const kit = IL.CLASSES[f.cls] || IL.CLASSES.warrior;
      const canTome = tomes > 0 && tomeLeft > 0 && (f.level || 1) < avg;
      return '<li class="acad-row"><span><b>' + esc(f.name) + hurtTag(f) + '</b><small>' + esc(kit.name) + ' · Lv ' + (f.level || 1) + '</small></span><span class="acad-acts">' +
        (canTome ? '<button type="button" class="ctl gold" data-tome="' + esc(f.id) + '" title="Lift to level ' + avg + '">Tome → Lv ' + avg + '</button>' : '') + act + '</span></li>';
    }
    const ready = IL.academyReady(save);
    const table = a.table.slice().sort(function (x, y) { return y.pts - x.pts || y.w - x.w; }).map(function (c, i) {
      return '<li class="' + (c.you ? "you" : "") + '"><b>' + (i + 1) + '</b><span>' + esc(c.name) + (c.you ? '' : ' Academy') + '</span><em>' + c.w + '-' + c.l + ' · ' + c.pts + ' pts</em></li>';
    }).join("");
    return '<div class="academy-pane" id="academyPane">' +
      '<section class="es-card"><h3 class="section">This week</h3>' +
        '<p class="fine">Up to ' + IL.ACADEMY_SQUAD + ' fighters of level ' + IL.ACADEMY_MAX_LV + ' or less. The best three play a 3v3 against a rival academy at their level, once a league week. It does not advance the week or cost stamina, and pays 75% of match XP. A win earns a Development Tome. Academy fighters can still play for the first team.</p>' +
        '<button type="button" class="btn fight" id="academyGo"' + (ready ? '' : ' disabled') + '>' + (ready ? 'Play the academy match' : a.played === (save.season * 100 + (save.round || 0)) ? 'Played this week' : 'Send a fighter to the academy') + '</button>' +
      '</section>' +
      '<section class="es-card"><h3 class="section">Academy squad · ' + squad.length + '/' + IL.ACADEMY_SQUAD + '</h3>' +
        (squad.length ? '<ul class="acad-list">' + squad.map(function (f) { return row(f, '<button type="button" class="ctl" data-acad-out="' + esc(f.id) + '">Recall</button>'); }).join("") + '</ul>' : emptyState("Nobody in the academy.", "Send a fighter of level " + IL.ACADEMY_MAX_LV + " or less.")) +
        (open.length ? '<h3 class="section">Can join</h3><ul class="acad-list">' + open.map(function (f) { return row(f, '<button type="button" class="ctl"' + (a.ids.length >= IL.ACADEMY_SQUAD ? ' disabled' : '') + ' data-acad-in="' + esc(f.id) + '">Send</button>'); }).join("") + '</ul>' : '') +
      '</section>' +
      '<section class="es-card"><h3 class="section">Development Tomes · ' + tomes + '</h3>' +
        '<p class="fine">A tome lifts a fighter below the club average (level ' + avg + ', your top five) straight to it, with every level-up pick on the way. ' + tomeLeft + ' of ' + IL.TOMES_A_SEASON + ' left to use this season. Use one from the squad lists above.</p>' +
      '</section>' +
      '<section class="es-card"><h3 class="section">Academy league · season ' + save.season + '</h3><ol class="thunder-table acad-table">' + table + '</ol></section>' +
    '</div>';
  }
  function startAcademyFight() {
    if (!IL.academyReady(save)) { pitSound("error"); return; }
    const squad = IL.academySquad(save);
    const opp = IL.academyOpponent(save, takeRng());
    const btn = document.getElementById("academyGo");
    if (btn) { btn.disabled = true; btn.textContent = "Opening the pit…"; }
    launchMatch({
      mode: "academy",
      left: squad,
      right: opp.fighters,
      leftName: save.clubName + " Academy",
      rightName: opp.name,
      academyClub: opp.club,
      size: squad.length,
      returnTab: "club",
      seed: (save.rngSeed ^ (0xACAD + save.round * 131 + save.season * 7)) >>> 0
    }).catch(function (e) {
      if (btn) btn.disabled = false;
      const banner = document.querySelector(".banner");
      if (banner) banner.textContent = e.message;
    });
  }

  function clubHomePanel() {
    if (clubPane === "events") return subTabs("club", "events", [["home", "‹ Club"], ["events", "Activities"]]) + eventsPanel();
    if (clubPane === "train") return subTabs("club", "train", [["home", "‹ Club"], ["train", "Training"]]) + trainingPanel();
    if (clubPane === "staff") return subTabs("club", "staff", [["home", "‹ Club"], ["staff", "Staff"]]) + staffPanel();
    if (clubPane === "academy") return subTabs("club", "academy", [["home", "‹ Club"], ["academy", "Academy"]]) + academyPanel();
    const ev = IL.activeEvent ? IL.activeEvent(Date.now()) : null;
    const fac = save.facilities || {};
    return '<div class="es-club-grid">' +
      '<section><h3 class="section">Activities</h3>' +
        clubTile("events", "Weekly event", ev ? ev.name : "This week", "Boss, gauntlet, horde, king or mirror. A new one each week.", "blue", "PvE") +
        gateTile() +
        clubTile("academy", "Academy", (save.academy && save.academy.season === save.season ? save.academy.ids.length : 0) + " of " + IL.ACADEMY_SQUAD + " in training", "A weekly 3v3 youth fixture that never costs a week or stamina. Wins earn Development Tomes.", "green", IL.academyReady && save.academy && IL.academyReady(save) ? "Ready" : "Youth") +
        clubTile("events", "Endless pit", "Best wave " + ((save.endless && save.endless.best) || 0), "Waves until you fall. A relic every fifth.", "steel", "PvE") +
        clubTile("events", "Daily challenge", "A seeded pair", "One fight a day for a purse.", "purple", "Daily") +
        clubTile("events", "Fight a friend", "Share a code", "Send your party as a code, or fight theirs.", "gold", "PvP") +
      '</section>' +
      '<section><h3 class="section">Facilities</h3>' +
        (IL.FACILITIES || []).map(function (def, k) {
          const lv = fac[def.id] || 0;
          const tones = ["gold", "teal", "purple", "red", "green", "blue", "steel"];
          const now = def.id === "hq" ? IL.rosterCap(save) + " roster slots"
            : def.id === "yard" ? (IL.drillCap ? IL.drillCap(save) : 2) + " drills a week"
            : def.id === "hall" ? (IL.drillXp ? IL.drillXp(save) : 12) + " xp a drill"
            : def.id === "barracks" ? Math.round((IL.benchShare ? IL.benchShare(save) : 0) * 100) + "% bench XP"
            : def.id === "infirmary" ? "+" + (IL.restBonus ? IL.restBonus(save) : 0) + " rest · drills " + (IL.drillCost ? IL.drillCost(save) : 16) + "g"
            : def.id === "scout" ? Math.round((IL.scoutOdds ? IL.scoutOdds(save) : 0.45) * 100) + "% scout hits"
            : def.id === "treasury" ? IL.clubRelicSlots(save) + " club relic slots"
            : def.id === "clubhouse" ? IL.staffSlots(save) + " staff slots" : "";
          return clubTile("train:facilities", def.name, now, def.blurb, tones[k % tones.length], lv >= def.max ? "MAX" : "LV " + (lv + 1));
        }).join("") +
      '</section>' +
      '<section><h3 class="section">Services</h3>' +
        clubTile("staff", "Staff", (save.staff || []).length + " of " + IL.staffSlots(save) + " hired", "Trainers, medics, scouts, coaches and treasurers. New faces every week.", "teal", "Staff") +
        clubTile("train", "Drills", (save.trainsLeft || 0) + " left this week", "Raise a stat on a bench fighter.", "red", "Train") +
        clubTile("train", "Specialties", (save.specPoints || 0) + " points", "Focus at level 5, mastery at level 10.", "gold", "Spec") +
        clubTile("train", "Tasks", "Earn specialty points", "Crits, KOs, blocks, flawless wins.", "steel", "Goals") +
      '</section>' +
    '</div>';
  }

  /* ---------- Intel ---------- */
  let archivePane = "classes";
  let codexOpen = null;

  function intelPanel() {
    const panes = [["stats", "Stats"], ["rosters", "Rosters"], ["archive", "Archive"], ["goals", "Goals"]];
    let body;
    if (intelPane === "archive") body = archiveHtml();
    else if (intelPane === "goals") body = achievementsHtml();
    else if (intelPane === "rosters") body = rostersIntelHtml();
    else body = statsIntelHtml();
    return subTabs("intel", intelPane, panes) + body;
  }

  /* Club leaders this season and all time, plus single-match records. */
  function statsIntelHtml() {
    const roster = (save.roster || []).filter(Boolean);
    function board(title, val, fmt) {
      const rows = roster.map(function (f) { return { f: f, n: val(f) }; }).filter(function (r) { return r.n > 0; })
        .sort(function (a, b) { return b.n - a.n; }).slice(0, 5);
      return '<section class="es-card leader-card"><h3 class="section">' + esc(title) + '</h3>' +
        (rows.length ? '<ol class="leaders">' + rows.map(function (r, i) {
          const kit = IL.CLASSES[r.f.cls] || {};
          return '<li><b>' + (i + 1) + '</b><span class="es-class ' + (ROLE_TONE[kit.role] || "melee") + '">' + esc(kit.name || "") + '</span><span class="ldr-name">' + esc(r.f.name) + '</span><em>' + esc(fmt ? fmt(r.n) : String(Math.round(r.n))) + '</em></li>';
        }).join("") + '</ol>' : '<p class="fine">Nobody yet.</p>') + '</section>';
    }
    const rec = save.records || {};
    function recRow(key, label) {
      const r = rec[key];
      return '<li><span>' + esc(label) + '</span>' + (r ? '<b>' + r.n + '</b><em>' + esc(r.name) + ' · season ' + r.season + '</em>' : '<b>—</b><em></em>') + '</li>';
    }
    return '<div class="intel-grid">' +
      board("Top kills (season)", function (f) { return (f.season && f.season.kos) || 0; }) +
      board("Top damage (season)", function (f) { return (f.season && f.season.dealt) || 0; }) +
      board("Top healing (season)", function (f) { return (f.season && f.season.heal) || 0; }) +
      board("Top Impact (season)", function (f) { return (f.season && f.season.impact) || 0; }) +
      board("Impact a match (season)", function (f) { return f.season && f.season.games ? Math.round(f.season.impact / f.season.games) : 0; }) +
      board("Top assists (season)", function (f) { return (f.season && f.season.assists) || 0; }) +
      board("Performance score", function (f) { return IL.perfScore ? IL.perfScore(f) : 0; }, function (n) { return (IL.perfLabel ? IL.perfLabel(n) + " " : "") + n; }) +
      board("Most MVPs", function (f) { return f.mvps || 0; }) +
      board("Career kills", function (f) { return f.kos || 0; }) +
      '<section class="es-card"><h3 class="section">Club records · one match</h3><ul class="records">' +
        recRow("dealt", "Most damage") + recRow("kos", "Most knockouts") + recRow("heal", "Most healing") + recRow("taken", "Most damage taken") +
      '</ul></section>' +
    '</div>' + clubRecordHtml();
  }

  /* Every club in the division with its record and its three fighters. */
  function rostersIntelHtml() {
    return '<div class="intel-rosters">' + sortedClubs().map(function (c, i) {
      const team = c.you ? fielded(save.roster, 3) : IL.rivalPick(c, 3);
      return '<section class="es-card intel-club' + (c.you ? " you" : "") + '"><header>' + crestHtml(c.name, "sm", clubCrest(c), c.you ? save.plate : undefined) +
        '<h3>' + esc(c.name) + '</h3><span class="fine">' + ordinal(i + 1) + ' · ' + c.w + '-' + c.l + ' · ' + c.pts + ' pts</span></header>' +
        '<ul class="intel-fighters">' + team.map(function (f) {
          const kit = IL.CLASSES[f.cls] || {};
          return '<li><canvas class="es-mface" width="40" height="36" data-key="' + esc(IL.hero.keyOf(f.parts)) + '" data-anim="' + (kit.idle || "idle") + '" data-scale="1" data-foot="3"></canvas>' +
            '<span><b>' + esc(f.name) + '</b><small>' + esc(kit.name || "") + ' · Lv ' + (f.level || 1) + '</small></span></li>';
        }).join("") + '</ul></section>';
    }).join("") + '</div>';
  }

  function archiveHtml() {
    const tabs = [["classes", "Classes"], ["clubs", "Clubs"], ["champions", "Champions"], ["relics", "Relics"], ["systems", "Systems"]];
    const nav = '<nav class="es-subtabs small">' + tabs.map(function (t) {
      return '<button type="button" class="es-subtab small' + (archivePane === t[0] ? " on" : "") + '" data-archive="' + t[0] + '">' + t[1] + '</button>';
    }).join("") + '</nav>';
    let body = "";
    if (archivePane === "clubs") {
      const met = {};
      (save.clubs || []).forEach(function (c) { if (!c.you) met[c.name] = c; });
      body = '<div class="archive-grid wide">' + IL.CLUBS.filter(function (n) { return n !== save.clubName; }).map(function (n) {
        const known = met[n] || (save.nemesis && save.nemesis.name === n);
        const theme = IL.CLUB_THEMES && IL.CLUB_THEMES[n];
        return '<div class="archive-cell' + (known ? "" : " unknown") + '">' + (known ? crestHtml(n, "md", crestIndexOf(n)) : '<span class="q">???</span>') +
          '<b>' + (known ? esc(n) : "Not yet met") + '</b>' + (known && theme ? '<small>' + esc(theme.map(function (id) { return (IL.CLASSES[id] || {}).name || id; }).join(" · ")) + '</small>' : '') + '</div>';
      }).join("") + '</div>';
    } else if (archivePane === "champions") {
      const mine = {};
      (save.roster || []).forEach(function (f) { if (f.champion) mine[f.name] = true; });
      body = '<div class="archive-grid wide">' + (IL.CHAMPIONS || []).map(function (c) {
        const kit = IL.CLASSES[c.cls] || {};
        return '<div class="archive-cell' + (mine[c.name] ? " owned" : "") + '"><span class="q champ">★</span><b>' + esc(c.name) + '</b><small>' + esc(kit.name || "") + (mine[c.name] ? " · signed" : "") + '</small></div>';
      }).join("") + '</div><p class="fine">Champions come to the market now and then, at a higher price, with tougher bodies and harder hits.</p>';
    } else if (archivePane === "relics") {
      const owned = save.relics || [];
      body = '<div class="archive-grid wide">' + (IL.RELICS || []).map(function (r) {
        const has = owned.indexOf(r.id) >= 0;
        return '<div class="archive-cell relic-' + esc(r.rarity) + (has ? "" : " unknown") + '"><span class="q">' + (has ? "◆" : "?") + '</span><b>' + (has ? esc(r.name) : "Not yet found") + '</b>' + (has ? '<small>' + esc(relicLine(r)) + '</small>' : '<small>' + esc(r.rarity) + '</small>') + '</div>';
      }).join("") + '</div>';
    } else if (archivePane === "systems") {
      const rows = [
        ["Seasons", "Eight clubs a division play seven league weeks. The top four then play the Champions Cup. The top two go up a division and the bottom two go down."],
        ["Divisions", IL.DIVISIONS.map(function (d) { return "Div " + d.roman + " " + d.name.replace(" Division", "") + " (rivals from Lv " + d.floor + ", purse ×" + d.purse + ")"; }).join(" · ")],
        ["Level up", "Each level is two picks: a stat card (the growth style makes one card bigger) and a skill card: a new move, an upgrade to a move, or a passive, from T1 Common to T4 Legendary."],
        ["Stamina", "League and cup matches tire the squad; the bench rests. Under half, a fighter hits and lasts a little less. The Medical Bay speeds rest."],
        ["Market value", "Built from hire price, rarity, level, upgrades, performance, stamina and gear. The performance score reads damage, healing, knockouts, wins and MVPs per match."],
        ["Facilities", "Headquarters, Training Grounds, Time Chamber, Barracks, Medical Bay, Scouting Office and Treasure House, each bought a rank at a time."],
        ["Relics", "Club relics ride with everyone (two slots, more with the Treasure House); a fighter relic is worn by one. Two pieces of a set wake a bonus."]
      ];
      body = '<dl class="systems">' + rows.map(function (r) { return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join("") + '</dl>';
    } else {
      const seen = save.seenClasses || [];
      const ids = Object.keys(IL.CLASSES);
      const owned = {};
      (save.roster || []).forEach(function (f) { owned[f.cls] = true; });
      const found = ids.filter(function (id) { return owned[id] || seen.indexOf(id) >= 0; }).length;
      body = '<header class="archive-head"><span class="fine">' + found + ' / ' + ids.length + ' discovered · tap a class for its codex page</span></header>' +
        '<div class="archive-grid">' + ids.map(function (id) {
          const kit = IL.CLASSES[id];
          const known = owned[id] || seen.indexOf(id) >= 0;
          const sheet = IL.defaultSheet ? IL.defaultSheet(id) : "";
          return '<button type="button" class="archive-cell' + (known ? "" : " unknown") + '"' + (known ? ' data-codex="' + esc(id) + '"' : ' disabled') + '>' +
            (known ? '<canvas width="64" height="64" data-key="' + esc(IL.hero.keyOf({ sheet: sheet })) + '" data-anim="idle" data-scale="2" data-foot="4"></canvas>' : '<span class="q">???</span>') +
            '<b class="' + (known ? "es-class " + (ROLE_TONE[kit.role] || "melee") : "") + '">' + (known ? esc(kit.name) : "Not yet discovered") + '</b></button>';
        }).join("") + '</div>';
    }
    return '<section class="es-card" id="archive">' + nav + body + '</section>';
  }

  /* A class's codex page: role, base stats, trait, passive and its moves. */
  function codexHtml(id) {
    const kit = IL.CLASSES[id];
    if (!kit) return "";
    const tone = ROLE_TONE[kit.role] || "melee";
    const trait = kit.trait && IL.TRAITS ? IL.TRAITS[kit.trait] : null;
    const pool = (IL.poolOf ? IL.poolOf(id) : (kit.abilities || [])).filter(Boolean);
    const sheet = IL.defaultSheet ? IL.defaultSheet(id) : "";
    return '<div class="sheet-back" id="codexBack"></div>' +
      '<aside class="sheet es-detail codex" id="codexSheet" role="dialog" aria-modal="true" aria-labelledby="codexTitle">' +
        '<header class="es-dhead">' +
          '<div class="detail-stage"><canvas width="120" height="110" data-key="' + esc(IL.hero.keyOf({ sheet: sheet })) + '" data-anim="cheer" data-scale="3" data-foot="8"></canvas></div>' +
          '<div class="es-dwho"><h2 id="codexTitle">' + esc(kit.name) + '</h2><p class="es-dtags"><span class="es-class ' + tone + '">' + esc(kit.role || "") + '</span>' + (trait ? '<span class="es-role">' + esc(trait.name) + '</span>' : '') + '</p>' +
            '<p class="fine">' + esc(kit.blurb || "") + '</p></div>' +
          '<div class="es-dvalue"><p><span>Unlock</span><b>' + ((kit.renown || 0) ? kit.renown + " renown" : "Free") + '</b></p></div>' +
          '<button type="button" class="btn close-x" id="codexClose" aria-label="Close">Close</button>' +
        '</header>' +
        '<div class="es-dgrid">' +
          '<section class="es-card"><h3 class="section">Base stats</h3><ul class="es-dstats">' +
            [["HP", kit.hp, "drop_water_or_blood"], ["ATK", kit.atk, "sword"], ["DEF", kit.def, "armor_1_body"], ["SPD", kit.speed, "shoes"]].map(function (r) {
              return '<li><img class="ui-glyph" alt="" src="assets/ui/glyphs/orange_32/' + r[2] + '.png"><span>' + r[0] + '</span><b>' + r[1] + '</b><em></em></li>';
            }).join("") + '</ul>' +
            (trait ? '<p class="fine"><b>' + esc(trait.name) + ':</b> ' + esc(trait.blurb || "") + '</p>' : '') +
            (kit.passive ? '<p class="fine"><b>Passive · ' + esc(kit.passive.name || "") + ':</b> ' + esc(kit.passive.blurb || abilityBlurb(kit.passive.id)) + '</p>' : '') +
          '</section>' +
          '<section class="es-card"><h3 class="section">Ability pool</h3><ul class="codex-pool">' + pool.map(function (ab) {
            return '<li>' + (IL.abilityIcon ? iconTag(IL.abilityIcon(ab.id), 32) : "") + '<span><b>' + esc(ab.name) + '</b><small>' + esc((IL.categoryOf ? IL.categoryOf({ kind: "learn", id: ab.id }) : "") + (ab.cd ? " · " + realCd(ab) + "s cooldown" : "") + (ab.ult ? " · Ultimate" : "")) + '</small><em>' + esc(moveFacts(ab, null, kit.id)) + '</em></span></li>';
          }).join("") + '</ul></section>' +
        '</div>' +
      '</aside>';
  }


  function leagueCardHtml() {
    const done = seasonDone();
    const rival = done ? null : nextRival();
    const size = done ? 0 : weekSize(save.round);
    const ready = done || fielded(save.roster, size).length >= size;
    const you = sortedClubs().map(function (c, i) { return { c: c, i: i }; }).filter(function (r) { return r.c.you; })[0];
    return '<section class="compete-card" id="leagueCard">' +
      '<header><p class="eyebrow">League</p><h3>Season ' + save.season + '</h3></header>' +
      '<p class="fine">' + (done ? 'All ' + seasonWeeks() + ' matches played.' : 'Match ' + (save.round + 1) + ' of ' + seasonWeeks() + ' · ' + size + ' vs ' + size + ' against ' + esc(rival ? rival.name : "—") + '.') +
        (you ? ' You sit ' + ordinal(you.i + 1) + ' on ' + you.c.pts + ' pts.' : '') + '</p>' +
      (done
        ? '<button type="button" class="btn gold" id="leagueCeremony">Season ceremony</button>'
        : '<button type="button" class="btn fight" id="leagueFight"' + (ready ? '' : ' disabled') + '>' + (ready ? 'Fight' : 'Pick ' + size + ' on the club tab') + '</button>') +
    '</section>';
  }

  /* v102 Chaos Thunder Cup. */
  function thunderLive() {
    return !!(save.thunder && save.thunder.season === save.season && !save.thunder.done);
  }
  function thunderCardHtml() {
    const t = save.thunder;
    if (!t || t.season !== save.season) {
      const next = (IL.THUNDER_AT || []).filter(function (a, i) { return !(save.thunderDone && save.thunderDone.season === save.season && save.thunderDone.slots.indexOf(i) >= 0); })[0];
      return '<section class="compete-card" id="thunderCard"><header><p class="eyebrow">Free for all · twice a season</p><h3>Chaos Thunder Cup</h3></header>' +
        '<p class="fine">' + (next ? 'Opens after league week ' + next.round + ': four clubs in one pit, ' + next.size + ' fighters each, three rounds. Places score 3, 2, 1, 0.' : 'Both cups are done this season.') + '</p></section>';
    }
    const table = IL.thunderTable(t);
    const rows = table.map(function (c, i) {
      return '<li class="' + (c.you ? "you" : "") + '"><b>' + (i + 1) + '</b><span>' + esc(c.name) + '</span><em>' + c.pts + ' pts</em><small>' + (c.places.length ? c.places.map(function (p) { return p === 1 ? "1st" : p === 2 ? "2nd" : p === 3 ? "3rd" : "4th"; }).join(" · ") : "—") + '</small></li>';
    }).join("");
    const ready = !t.done && fielded(save.roster, t.size).length >= t.size;
    return '<section class="compete-card" id="thunderCard"><header><p class="eyebrow">Free for all · ' + t.size + 'v' + t.size + 'v' + t.size + 'v' + t.size + '</p><h3>Chaos Thunder Cup</h3></header>' +
      '<ol class="thunder-table">' + rows + '</ol>' +
      (t.done ? '<p class="fine">Finished ' + (t.finish === 1 ? "1st. The cup is yours." : t.finish === 2 ? "2nd." : t.finish === 3 ? "3rd." : "4th.") + '</p>'
        : '<p class="fine">Round ' + (t.round + 1) + ' of ' + IL.THUNDER_ROUNDS + '. Last club standing places 1st; the rest place by when they fall.</p>' +
          '<button type="button" class="btn fight" id="thunderGo"' + (ready ? '' : ' disabled') + '>' + (ready ? 'Fight round ' + (t.round + 1) : 'Pick ' + t.size + ' for the pit') + '</button>') +
    '</section>';
  }
  function startThunderFight() {
    const sides = IL.thunderSides(save);
    if (!sides) { pitSound("error"); return; }
    const btn = document.getElementById("thunderGo");
    if (btn) { btn.disabled = true; btn.textContent = "Opening the pit…"; }
    launchMatch({
      mode: "thunder",
      sides: sides,
      left: sides[0].fighters,
      size: save.thunder.size,
      returnTab: "cup",
      seed: (save.rngSeed ^ (0x7D0 + save.thunder.round * 977 + save.season * 31)) >>> 0
    }).catch(function (e) {
      if (btn) btn.disabled = false;
      const banner = document.querySelector(".banner");
      if (banner) banner.textContent = e.message;
    });
  }

  function chaosCardHtml() {
    const ready = fielded(save.roster, 1).length >= 1;
    return '<section class="compete-card" id="chaosCard">' +
      '<header><p class="eyebrow">Free for all</p><h3>Chaos pit</h3></header>' +
      '<p class="fine">Your first fielded fighter against two other clubs at once. No stamina, a smaller purse.</p>' +
      '<button type="button" class="btn fight" id="chaos"' + (ready ? '' : ' disabled') + '>Enter the chaos pit</button>' +
    '</section>';
  }

  function ordinal(n) {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
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
    const size = !seasonDone() ? weekSize(save.round) : 0;
    return '<div id="fighterList">' +
      filterBar("fighters", fighterFilter, [["all", "All"], ["party", "First team"], ["bench", "Substitutes"]]) +
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
    const style = IL.STYLES && IL.styleOf ? IL.STYLES[IL.styleOf(f)].name + " growth" : "";
    return [rarityLabel(f.rarity), style, spec && spec.name, trait && trait.name].filter(Boolean).join(" · ");
  }

  /* v108 rival rosters: buy, swap or loan with league clubs. */
  function rivalMarketHtml() {
    const mine = (save.roster || []).filter(function (f) { return !f.captain && !f.loan; });
    if (swapPick && !mine.some(function (f) { return f.id === swapPick; })) swapPick = "";
    const yours = swapPick ? fighterById(swapPick) : null;
    const room = save.roster.length < IL.rosterCap(save);
    const clubs = (save.clubs || []).filter(function (c) { return c && !c.you; }).map(function (c) {
      const bench = IL.rivalBench(c);
      const rows = (c.fighters || []).map(function (f) {
        const kit = IL.CLASSES[f.cls] || IL.CLASSES.warrior;
        const ask = IL.askingPrice(f);
        const onBench = bench.indexOf(f) >= 0;
        const fee = IL.loanFee(f);
        const top = yours ? IL.swapTopUp(f, yours) : 0;
        return '<li class="rv-row"><span class="rv-id"><b>' + shinyMark(f) + esc(f.name) + (f.leader ? ' <em class="rv-lead">Leader</em>' : '') + '</b><small>' + esc(kit.name) + ' · Lv ' + (f.level || 1) + ' · ' + potentialStars(f) + (onBench ? ' · bench' : '') + '</small></span>' +
          '<span class="rv-acts">' + (ask
            ? '<button type="button" class="ctl gold" data-rv-buy="' + esc(c.id + ":" + f.id) + '"' + (save.gold < ask || !room ? ' disabled' : '') + '>Buy ' + ask + 'g</button>' +
              (yours ? '<button type="button" class="ctl" data-rv-swap="' + esc(c.id + ":" + f.id) + '"' + (save.gold < top ? ' disabled' : '') + '>Swap +' + top + 'g</button>' : '') +
              (onBench ? '<button type="button" class="ctl" data-rv-loan="' + esc(c.id + ":" + f.id) + '"' + (save.gold < fee || !room ? ' disabled' : '') + '>Loan ' + IL.LOAN_WEEKS + ' wk · ' + fee + 'g</button>' : '')
            : '<span class="fine">Not for sale</span>') + '</span></li>';
      }).join("");
      return '<section class="es-card rv-club"><h3 class="section">' + esc(c.name) + (c.named ? ' · ' + esc(c.leader) : '') + '</h3><ul class="rv-list">' + rows + '</ul></section>';
    }).join("");
    const out = (save.loansOut || []).map(function (r) { return '<li>' + esc(r.fighter.name) + ' at ' + esc(r.club) + ' · ' + r.weeks + ' wk left</li>'; }).join("");
    const inn = (save.roster || []).filter(function (f) { return f.loan; }).map(function (f) { return '<li>' + esc(f.name) + ' on loan here · ' + f.loan.weeks + ' wk left</li>'; }).join("");
    return '<div class="rv-pane" id="rivalMarket">' +
      '<p class="fine">Every league club\'s roster. A rival asks 25% over market value, and leaders are not for sale. A swap counts 90% of your fighter\'s value against the price. Bench fighters can be loaned for ' + IL.LOAN_WEEKS + ' league weeks.</p>' +
      '<label class="rv-swap">Swap with <select id="swapPick"><option value="">— pick your fighter —</option>' + mine.map(function (f) {
        return '<option value="' + esc(f.id) + '"' + (f.id === swapPick ? ' selected' : '') + '>' + esc(f.name) + ' · Lv ' + (f.level || 1) + '</option>';
      }).join("") + '</select></label>' +
      ((out || inn) ? '<section class="es-card"><h3 class="section">Loans</h3><ul class="rv-loans">' + inn + out + '</ul></section>' : '') +
      '<div class="rv-clubs">' + (clubs || emptyState("No league clubs yet.", "")) + '</div></div>';
  }
  function rivalDeal(kind, key) {
    const bits = key.split(":");
    const rng = takeRng();
    let done = null;
    if (kind === "buy") done = IL.buyFromRival(save, bits[0], bits[1], rng);
    else if (kind === "loan") done = IL.loanIn(save, bits[0], bits[1]);
    else if (kind === "swap") {
      const gone = fighterById(swapPick);
      if (gone) returnGear(gone);
      done = IL.swapWithRival(save, bits[0], bits[1], swapPick, rng);
      if (done) swapPick = "";
    }
    if (!done) { pitSound("error"); return; }
    const f = fighterById(bits[1]);
    pitSound("purchase");
    if (f) logClub(f.name + (kind === "loan" ? " arrives on loan." : " joins from a rival club."));
    persist();
    if (f && IL.hero) IL.hero.compose(f.parts).then(function () { refreshHub(); }).catch(function () { refreshHub(); });
    else refreshHub();
  }

  function marketPanel() {
    if (marketPane === "recruits") marketPane = "fighters";
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
        (f.loan ? '<p class="fine">On loan from a rival · ' + f.loan.weeks + ' wk left</p>'
          : '<span class="sell-acts"><button type="button" class="btn ghost buyable" data-sell="' + esc(f.id) + '">Sell</button>' +
            '<button type="button" class="ctl" data-loan-out="' + esc(f.id) + '" title="Two league weeks at a rival; comes back with XP">Loan +' + IL.loanOutFee(f) + 'g</button></span>') +
      '</article>';
    }).join("");
    const captain = save.roster.filter(function (f) { return f.captain; })[0];
    const brokeRefresh = save.gold < IL.REFRESH_COST;
    const recruits = marketBoardHtml(brokeRefresh);
    const selling = '<section class="roster-block"><h3 class="section">Sell from the bench</h3>' +
      '<p class="fine">' + (captain ? esc(captain.name) + " is captain and stays." : "The captain stays.") + '</p>' +
      '<div class="cards dense-grid">' + (bench || emptyState("The bench is empty.", "Hire someone before there is anyone to sell.")) + '</div></section>';
    const body = marketPane === "rivals" ? rivalMarketHtml()
      : marketPane === "gear" ? gearStallHtml()
      : marketPane === "relics" ? relicStallHtml()
      : marketPane === "deals" ? dealsHtml()
      : marketPane === "sell" ? selling
      : recruits;
    return filterBar("market", marketPane, [["fighters", "Fighters"], ["rivals", "Rival rosters"], ["relics", "Relics"], ["gear", "Gear"], ["deals", "Deals"], ["sell", "Sell"]]) +
      (marketPane === "deals" ? dealsHead() : "") +
      '<div class="pane" id="marketPane">' + body + '</div>';
  }

  /* v74 market, after Eslabong: a list of listings on the left (moves,
     stats, class and level, price, watch star) and the picked fighter's
     full card on the right with market value and Hire. */
  function marketRows() {
    return (save.market || []).map(function (row, i) { return { row: row, i: i }; }).filter(function (x) {
      const r = x.row;
      if (marketFilter === "affordable") return !r.locked && save.gold >= r.cost;
      if (marketFilter === "watch") return !!r.watch;
      if (marketFilter === "champions") return !!(r.fighter && r.fighter.champion);
      if (marketFilter === "scouted") return !!r.scouted;
      if (marketFilter === "league") return !!r.from;
      return true;
    });
  }

  function marketBoardHtml(brokeRefresh) {
    const all = save.market || [];
    const rows = marketRows();
    if (!all[marketPick]) marketPick = 0;
    const counts = {
      affordable: all.filter(function (r) { return !r.locked && save.gold >= r.cost; }).length,
      watch: all.filter(function (r) { return r.watch; }).length,
      champions: all.filter(function (r) { return r.fighter && r.fighter.champion; }).length,
      scouted: all.filter(function (r) { return r.scouted; }).length
    };
    const chips = [["all", "All", 0], ["affordable", "Affordable", counts.affordable], ["watch", "Watchlist", counts.watch], ["league", "League", all.filter(function (r) { return r.from; }).length], ["champions", "Champions", counts.champions], ["scouted", "Scouted", counts.scouted]];
    const full = save.roster.length >= IL.rosterCap(save);
    const list = rows.map(function (x) {
      const r = x.row;
      const f = r.fighter;
      const kit = IL.CLASSES[f.cls] || IL.CLASSES.warrior;
      const st = IL.scaledStats(f, kit);
      const tone = ROLE_TONE[kit.role] || "melee";
      const moves = (f.loadout || []).slice(0, 3).map(function (id) { return IL.abilityIcon ? iconTag(IL.abilityIcon(id), 20) : ""; }).join("");
      const cant = r.locked || save.gold < r.cost || full;
      const price = r.locked ? r.need + " renown" : r.cost;
      const watchFull = !r.watch && IL.watchCount(save) >= IL.WATCH_CAP;
      return '<div class="es-mrow' + (x.i === marketPick ? " on" : "") + (cant ? " cant-afford" : "") + '" data-role="' + esc(kit.role) + '">' +
        '<button type="button" class="es-mpick" data-mpick="' + x.i + '">' +
          '<canvas class="es-mface" width="40" height="36" data-key="' + esc(IL.hero.keyOf(f.parts)) + '" data-anim="' + (kit.idle || "idle") + '" data-scale="1" data-foot="3"></canvas>' +
          '<span class="es-mname"><b>' + (r.from ? '<span class="es-mfrom" title="Listed by ' + esc(r.from) + '">' + crestHtml(r.from, "sm", crestIndexOf(r.from)) + '</span>' : '') + shinyMark(f) + esc(f.name) + (f.champion ? ' <em class="champ">★</em>' : '') + (r.scouted ? ' <em class="scout-tag">Scouted</em>' : '') + '</b><span class="es-mmoves">' + moves + potentialStars(f) + '</span></span>' +
          '<span class="es-mstat">' + Math.round(st.hp) + '</span><span class="es-mstat">' + Math.round(st.atk) + '</span><span class="es-mstat">' + Math.round(st.def) + '</span><span class="es-mstat">' + Math.round(st.speed) + '</span>' +
          '<span class="es-mclass"><span class="es-class ' + tone + '">' + esc(kit.name) + '</span><small>Lvl ' + (f.level || 1) + '</small></span>' +
          '<span class="es-mprice">' + (r.locked ? '' : coinIcon("gold")) + price + '</span>' +
        '</button>' +
        (r.locked ? '<span class="es-mstar"></span>' : '<button type="button" class="es-mstar' + (r.watch ? " on" : "") + '" data-watch="' + x.i + '"' + (watchFull ? " disabled" : "") + ' title="' + (r.watch ? "Stop watching" : "Watch: keeps them on the board when it turns over") + '">' + (r.watch ? "★" : "☆") + '</button>') +
      '</div>';
    }).join("");
    const pick = all[marketPick];
    let detail = '<section class="es-card es-mdetail"><p class="fine">Pick a listing.</p></section>';
    if (pick && pick.fighter) {
      const f = pick.fighter;
      const kit = IL.CLASSES[f.cls] || IL.CLASSES.warrior;
      const st = IL.scaledStats(f, kit);
      const tone = ROLE_TONE[kit.role] || "melee";
      const cant = pick.locked || save.gold < pick.cost || full;
      let hireText = "Hire · " + pick.cost + "g";
      if (pick.locked) hireText = "Needs " + pick.need + " renown";
      else if (full) hireText = "Roster full";
      else if (save.gold < pick.cost) hireText = "Need " + pick.cost + "g";
      const mv = IL.marketValue ? IL.marketValue(f) : pick.cost;
      const moves = (f.loadout || []).map(function (id) {
        const ab = IL.abilityById(id);
        return '<li>' + (IL.abilityIcon ? iconTag(IL.abilityIcon(id), 40) : "") + '<span>' + esc(ab ? ab.name : id) + '</span></li>';
      }).join("");
      const spec = IL.specialtyOf ? IL.specialtyOf(f.specialty) : null;
      const trait = kit.trait && IL.TRAITS ? IL.TRAITS[kit.trait] : null;
      detail = '<section class="es-card es-mdetail" id="marketDetail">' +
        '<header class="es-mdhead">' +
          portraitWrap('width="96" height="86" data-key="' + esc(IL.hero.keyOf(f.parts)) + '" data-anim="' + (kit.idle || "idle") + '" data-scale="2" data-foot="6"', false, f) +
          '<div><h3>' + shinyMark(f) + esc(f.name) + '</h3>' +
            '<p class="es-dtags"><span class="es-class ' + tone + '">' + esc(kit.name) + '</span>' + (f.rarity ? '<span class="es-role">' + esc(rarityLabel(f.rarity)) + '</span>' : '') + (f.champion ? '<span class="es-role champ">Champion</span>' : '') + (f.shiny ? '<span class="es-role shiny-tag">Shiny</span>' : '') + '</p>' +
            '<p class="es-dlevel">Level ' + (f.level || 1) + ' · ' + (pick.from ? 'Listed by ' + esc(pick.from) : 'Free agent') + '</p></div>' +
          '<div class="es-dvalue"><p><span>Market value</span><b>' + coinIcon("gold") + mv + '</b></p>' +
            '<p><span>' + (pick.locked ? 'Renown required' : 'Asking price') + '</span><b>' + (pick.locked ? pick.need : coinIcon("gold") + pick.cost) + '</b></p></div>' +
        '</header>' +
        '<div class="es-mdgrid">' +
          '<div><h4 class="ov-sub">Fighter stats</h4><ul class="es-dstats">' +
            [["HP", Math.round(st.hp), "drop_water_or_blood"], ["ATK", Math.round(st.atk), "sword"], ["DEF", Math.round(st.def), "armor_1_body"], ["SPD", Math.round(st.speed), "shoes"]].map(function (r) {
              return '<li><img class="ui-glyph" alt="" src="assets/ui/glyphs/orange_32/' + r[2] + '.png"><span>' + r[0] + '</span><b>' + r[1] + '</b><em></em></li>';
            }).join("") + '</ul></div>' +
          '<div><h4 class="ov-sub">Abilities</h4><ul class="es-mmovelist">' + moves + '</ul></div>' +
        '</div>' +
        '<h4 class="ov-sub">Profile and behavior</h4>' +
        '<dl class="es-profile">' +
          '<dt>Potential</dt><dd>' + potentialStars(f) + '</dd>' +
          '<dt>Growth grades</dt><dd>' + gradeChips(f) + '</dd>' +
          (champPassiveOf(f) ? '<dt>Champion passive</dt><dd>' + esc(champPassiveOf(f).p.name + " (" + champPassiveOf(f).cls + "): " + champPassiveOf(f).p.blurb) + '</dd>' : '') +
          '<dt>Personality</dt><dd>' + esc(personalityLabel(f.personality)) + '</dd>' +
          '<dt>Growth style</dt><dd>' + esc(IL.STYLES[IL.styleOf(f)].name) + ' growth</dd>' +
          (spec ? '<dt>Specialty</dt><dd>' + esc(spec.name) + '</dd>' : '') +
          (trait ? '<dt>Trait</dt><dd>' + esc(trait.name) + '</dd>' : '') +
        '</dl>' +
        '<div class="es-mactions">' +
          (pick.locked ? '' : '<button type="button" class="btn ghost watch' + (pick.watch ? " on" : "") + '" data-watch="' + marketPick + '">' + (pick.watch ? "★ Watching" : "☆ Watch") + '</button>') +
          '<button type="button" class="btn primary hire' + (cant ? " cant-afford" : " buyable") + '" data-hire="' + marketPick + '"' + (cant ? " disabled" : "") + '>' + esc(hireText) + '</button>' +
        '</div>' +
      '</section>';
    }
    return '<div class="es-market">' +
      '<div class="es-mtools">' +
        '<div class="es-mchips">' + chips.map(function (c) {
          return '<button type="button" class="es-subtab small' + (marketFilter === c[0] ? " on" : "") + '" data-mfilter="' + c[0] + '">' + c[1] + (c[2] ? ' <em class="es-count">' + c[2] + '</em>' : '') + '</button>';
        }).join("") + '</div>' +
        '<div class="hub-actions market-tools"><button type="button" class="btn ghost' + (brokeRefresh ? " cant-afford" : " buyable") + '" id="refreshMarket"' + (brokeRefresh ? " disabled" : "") + '>Refresh · ' + IL.REFRESH_COST + 'g</button>' + scoutPicker() + '</div>' +
      '</div>' +
      (save.marketNews && save.marketNews.length ? '<ul class="market-news" id="marketNews">' + save.marketNews.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join("") + '</ul>' : '') +
      auctionHtml() +
      '<p class="fine es-pulse">Mercenary board · ' + all.length + ' listings · roster ' + save.roster.length + '/' + IL.rosterCap(save) + ' · the board turns over after league and cup matches; watch up to ' + IL.WATCH_CAP + ' to keep them.</p>' +
      '<div class="es-msplit">' +
        '<div class="es-mlist" id="marketCards">' +
          '<div class="es-mhead"><span></span><span>Name</span><span>HP</span><span>ATK</span><span>DEF</span><span>SPD</span><span>Class</span><span>Price</span><span></span></div>' +
          (list || emptyState("Nothing matches.", "Try another filter.")) +
        '</div>' +
        detail +
      '</div>' +
    '</div>';
  }

  /* v110 milestones (ability upgrades, masteries), respec and rebirth. */
  function milestoneHtml(f) {
    if (!IL.upgradesPending) return "";
    const lv = f.level || 1;
    const up = IL.upgradesPending(f);
    const ms = IL.masteriesPending(f);
    const nextUp = IL.UPGRADE_LEVELS.filter(function (l) { return lv < l; })[0];
    const nextMs = IL.MASTERY_LEVELS.filter(function (l) { return lv < l; })[0];
    let out = '<h3 class="section">Milestones</h3>';
    out += '<p class="fine">Ability upgrade every 5 levels from 14 (+8% power, -6% cooldown a rank, to rank ' + IL.RANK_MAX + '). Masteries at 27, 37 … 97.' +
      (nextUp ? ' Next upgrade: level ' + nextUp + '.' : '') + (nextMs ? ' Next mastery: level ' + nextMs + '.' : '') + '</p>';
    if (up > 0) {
      out += '<p class="evo-ready">Upgrade a move · ' + up + ' to spend</p><div class="ms-row">' + (f.loadout || []).map(function (id) {
        const ab = IL.abilityById(id);
        const rk = IL.rankOf(f, id);
        return ab ? '<button type="button" class="chip"' + (rk >= IL.RANK_MAX ? ' disabled' : '') + ' data-upgrade="' + esc(id) + '">' + esc(ab.name) + ' ' + roman(rk) + (rk < IL.RANK_MAX ? ' → ' + roman(rk + 1) : ' max') + '</button>' : '';
      }).join("") + '</div>';
    }
    if (ms > 0) {
      out += '<p class="evo-ready">Pick a mastery · ' + ms + ' to spend</p><div class="ms-row">' + (IL.MASTERIES || []).map(function (m) {
        return '<button type="button" class="chip" data-mastery-add="' + esc(m.id) + '" title="' + esc(m.blurb) + '">' + esc(m.name) + ' (' + [m.hp ? "+" + m.hp + " HP" : "", m.atk ? "+" + m.atk + " ATK" : "", m.def ? "+" + m.def + " DEF" : "", m.spd ? "+" + m.spd + " SPD" : ""].filter(Boolean).join(" ") + ')</button>';
      }).join("") + '</div>';
    }
    if ((f.masteries || []).length) out += '<p class="fine">Masteries: ' + f.masteries.map(function (id) { const m = IL.masteryOf(id); return m ? m.name : id; }).join(", ") + '.</p>';
    if (f.respecPicks > 0) {
      out += '<p class="evo-ready">Respec · rebuild ' + f.respecPicks + ' upgrade' + (f.respecPicks === 1 ? '' : 's') + '</p><div class="lv-skills respec-cards">' +
        IL.respecOffer(f).map(function (c, i) { return skillCardHtml(f, c, i).replace('data-pick="' + i + '"', 'data-respec-pick="' + i + '"').replace("Choose skill", "Take it"); }).join("") + '</div>';
    }
    const n = IL.respecCount(f);
    out += '<div class="ms-tools">' +
      (n > 0 && !(f.respecPicks > 0) ? '<button type="button" class="ctl" data-respec="1"' + (save.gold < IL.respecCost(f) ? ' disabled' : '') + ' title="Clear this fighter\'s ' + n + ' move upgrades and passives, then pick ' + n + ' again from fresh cards">Respec · ' + IL.respecCost(f) + 'g</button>' : '') +
      '<button type="button" class="ctl" data-rebirth="1"' + ((save.renown || 0) < IL.rebirthCost(f) ? ' disabled' : '') + ' title="Re-roll the growth grades (HP, ATK, DEF, SPD)">Rebirth · ' + IL.rebirthCost(f) + ' renown</button></div>';
    return out;
  }

  /* v96 evolutions: one move at level 20, another at 50, two choices each. */
  function evoHtml(f) {
    if (!IL.evoChoices) return "";
    const picks = IL.evoPicks(f);
    const evos = f.evos || {};
    const done = Object.keys(evos).map(function (id) {
      const ab = IL.abilityById(id);
      const e = IL.EVOS[evos[id]];
      return ab && e ? '<li><strong>' + esc(ab.name) + ' · ' + esc(e.name) + '</strong><p>' + esc(e.text) + '</p></li>' : '';
    }).join("");
    let offer = "";
    if (picks > 0) {
      offer = (f.loadout || []).map(function (id) {
        const ab = IL.abilityById(id);
        if (!ab || evos[id]) return "";
        const ch = IL.evoChoices(ab);
        if (!ch.length) return "";
        return '<div class="evo-move"><p><strong>' + esc(ab.name) + '</strong></p><div class="evo-opts">' + ch.map(function (c) {
          return '<button type="button" class="evo-opt" data-evo-move="' + esc(id) + '" data-evo="' + esc(c) + '"><b>' + esc(IL.EVOS[c].name) + '</b><span>' + esc(IL.EVOS[c].text) + '</span></button>';
        }).join("") + '</div></div>';
      }).join("");
      if (!offer) offer = '<p class="fine">None of the equipped moves can evolve. Equip a damage, heal or shield move.</p>';
    }
    const lv = f.level || 1;
    const next = IL.EVO_LEVELS.filter(function (l) { return lv < l; })[0];
    return '<h3 class="section">Evolutions</h3>' +
      (done ? '<ul class="evo-list">' + done + '</ul>' : '') +
      (picks > 0 ? '<p class="evo-ready">Evolve a move · ' + picks + ' to spend <button type="button" class="ctl" data-evo-skip="1" title="Give up this evolution for good">Skip</button></p>' + offer
        : '<p class="fine">' + (next ? "Level " + next + " evolves one move: pick one of two new effects for it." : "Both evolutions spent.") + '</p>');
  }

  /* v94 grades, potential, shiny, champion passive, auctions. */
  const GRADE_NAME = { B: "Balanced", G: "Good", E: "Excellent" };
  function potentialStars(f) {
    const n = IL.potentialOf ? IL.potentialOf(f) : 1;
    return '<span class="pot" title="Potential ' + n + ' of 5">' + "★★★★★".slice(0, n) + '<i>' + "★★★★★".slice(0, 5 - n) + '</i></span>';
  }
  function gradeChips(f) {
    return '<span class="grades">' + [["hp", "HP"], ["atk", "ATK"], ["def", "DEF"], ["spd", "SPD"]].map(function (k) {
      const g = IL.gradeOf ? IL.gradeOf(f, k[0]) : "B";
      return '<i class="g-' + g + '" title="' + k[1] + ' growth: ' + GRADE_NAME[g] + (g === "B" ? "" : g === "G" ? " (x1.3)" : " (x1.6)") + '">' + k[1] + ' ' + g + '</i>';
    }).join("") + '</span>';
  }
  function champPassiveOf(f) {
    if (!f || !f.champPassive) return null;
    const id = Object.keys(IL.CLASSES).filter(function (c) { return IL.CLASSES[c].passive && IL.CLASSES[c].passive.id === f.champPassive; })[0];
    return id ? { cls: IL.CLASSES[id].name, p: IL.CLASSES[id].passive } : null;
  }
  function shinyMark(f) { return f && f.shiny ? '<em class="shiny" title="Shiny: +20% base stats, one stat Excellent">✦</em>' : ''; }
  function auctionHtml() {
    const a = save.auction;
    if (!a || a.season !== save.season || !a.fighter) return "";
    const f = a.fighter;
    const kit = IL.CLASSES[f.cls] || IL.CLASSES.warrior;
    const st = IL.scaledStats(f, kit);
    const mine = a.leader === "you";
    const next = a.leader === "Opening bid" ? a.bid : Math.round(a.bid * 1.1 / 5) * 5;
    const left = Math.max(0, a.closes - (save.round || 0));
    const full = save.roster.length >= IL.rosterCap(save);
    const cant = mine || save.gold < next || full;
    return '<section class="es-card auction" id="auctionCard">' +
      '<header><p class="eyebrow">Auction · closes after ' + left + ' more league match' + (left === 1 ? '' : 'es') + '</p>' +
        '<h3>' + shinyMark(f) + esc(f.name) + ' ' + potentialStars(f) + '</h3>' +
        '<p class="fine">' + esc(kit.name) + ' · Lv ' + (f.level || 1) + ' · ' + esc(rarityLabel(f.rarity)) + (f.champion ? ' champion' : '') + ' · HP ' + Math.round(st.hp) + ' · ATK ' + Math.round(st.atk) + '</p>' + gradeChips(f) + '</header>' +
      '<p class="auction-bid"><span>Top bid</span><b>' + coinIcon("gold") + a.bid + '</b><em>' + (mine ? "Yours" : a.leader === "Opening bid" ? "No bids yet" : esc(a.leader)) + '</em></p>' +
      '<button type="button" class="btn primary' + (cant ? " cant-afford" : " buyable") + '" data-auction-bid="1"' + (cant ? " disabled" : "") + '>' + (mine ? "You lead" : full ? "Roster full" : "Bid " + next + "g") + '</button>' +
      '<p class="fine">Rival clubs raise after league matches. Gold leaves only if you hold the top bid when it closes.</p>' +
    '</section>';
  }

  function scoutPicker() {
    const ids = Object.keys(IL.CLASSES).sort(function (a, b) { return IL.CLASSES[a].name < IL.CLASSES[b].name ? -1 : 1; });
    const want = save.scout || "";
    return '<label class="scout-pick">Scout for <select id="scoutPick">' +
      '<option value=""' + (want ? "" : " selected") + '>Any class</option>' +
      ids.map(function (id) {
        const open = IL.classUnlocked(id, save.renown || 0);
        return '<option value="' + esc(id) + '"' + (want === id ? " selected" : "") + '>' + esc(IL.CLASSES[id].name + (open ? "" : " (" + (IL.CLASSES[id].renown || 0) + "r)")) + '</option>';
      }).join("") +
      '</select></label>';
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
        '<h3>' + esc(relic.name) + ' ' + rollTag(row.roll || 1) + '</h3>' +
        '<p class="fine">' + esc(IL.rarityName(relic.rarity)) + ' · ' + (relic.scope === "fighter" ? "Fighter" : "Club") + '</p>' +
        '<p>' + esc(relicLine(Object.assign({}, relic, { roll: row.roll || 1 }))) + '</p>' +
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
      '<p class="fine">Five relics, new stock after every league week. The % is that piece\'s roll. Refresh spends ' + cost + ' gold. Equip on the Relics tab: club relics in club slots, fighter relics on a fighter (two from level ' + IL.RELIC_SLOT2_LV + ').</p>' +
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
        const full = save.roster.length >= IL.rosterCap(save);
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
        '<p class="fine">Every rank is bought once and kept. Headquarters adds roster slots; Barracks feeds the bench; the Treasure House holds more club relics.</p>' +
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
            ? '<button type="button" class="btn fight" id="startEvent"' + (cleared ? " disabled" : "") + '>' + (cleared ? "Cleared ✓" : "Enter") + '</button>'
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

  /* v95 exact relic text, with the relic's own roll. */
  function relicLine(r) {
    if (!r) return "";
    const rr = r.setBonus ? r : (typeof r.roll === "number" ? r : IL.rolledRelic(save, r));
    let t = IL.relicText(rr);
    if (r.kind === "grant" && IL.grantAbility && IL.moveFacts) {
      const g = IL.grantAbility(r.grant);
      if (g) t += " " + g.ab.name + ": " + IL.moveFacts(g.ab, null, g.cls);
    }
    return t;
  }
  function rollTag(roll) {
    const pct = Math.round((roll || 1) * 100);
    return '<em class="relic-roll' + (pct >= 108 ? " hi" : pct <= 92 ? " lo" : "") + '" title="Roll: ' + pct + '% of base (85% to 115%)">' + pct + '%</em>';
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
      if (f && f.relic2) wearerOf[f.relic2] = f;
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
      return '<button type="button" class="relic-cell' + mark + miss + (r.named ? " named" : "") + '" data-relic-open="' + esc(r.id) + '" aria-label="' + esc(r.name) + '">' +
        relicFace(r, 32) +
        '<span class="relic-name">' + esc(r.name) + '</span>' +
        (have ? rollTag(IL.relicRoll(save, r.id)) : '') +
      '</button>';
    }).join("");
    const size = !seasonDone() ? weekSize(save.round) : IL.PARTY_CAP;
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
      '<div class="relic-top"><p class="fine relic-count">' + (save.equipped || []).length + ' of ' + IL.clubRelicSlots(save) + ' club slots · ' + wornCount + ' worn · ' + (save.relics || []).length + ' owned · a second fighter slot opens at level ' + IL.RELIC_SLOT2_LV + '</p>' +
        '<div class="relic-tools"><button type="button" class="btn ghost" id="autoRelics"' + ((save.relics || []).length ? '' : ' disabled') + '>Auto-equip</button>' +
        '<button type="button" class="btn ghost" id="clearRelics"' + ((save.equipped || []).length || Object.keys(bag.wearerOf).length ? '' : ' disabled') + '>Unequip all</button></div></div>' +
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
        const wearing = f.relic === r.id || f.relic2 === r.id;
        const slots = (f.level || 1) >= IL.RELIC_SLOT2_LV ? 2 : 1;
        const used = (f.relic ? 1 : 0) + (slots > 1 && f.relic2 ? 1 : 0);
        return '<button type="button" class="btn ' + (wearing ? "primary" : "ghost") + '" data-bind-relic="' + esc(r.id) + '" data-bind-fighter="' + esc(f.id) + '">' + esc(relicFirst(f.name)) + (wearing ? " · wearing" : " · " + used + "/" + slots) + '</button>';
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
        '<p class="relic-text">' + esc(relicLine(r)) + '</p>' +
        (have ? '<p class="fine">Roll ' + rollTag(IL.relicRoll(save, r.id)) + ' of its base numbers. Rolls run 85% to 115%; selling and finding it again rolls anew.</p>' : '<p class="fine">Numbers shown at a 100% roll.</p>') +
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
      return '<span class="club-line' + you + through + '">' + crestHtml(side.name, "sm", idx, side.you ? save.plate : undefined) + '<span class="club-name">' + esc(side.name) + '</span></span>';
    };
    const yours = (tie.a && tie.a.you) || (tie.b && tie.b.you);
    return '<div class="tie' + (yours ? " yours" : "") + '">' + mark(tie.a) + mark(tie.b) +
      '<em>' + (winName ? esc(winName) + " through" : "Yet to fight") + '</em></div>';
  }

  function cupMarkup(cup, boardId) {
    if (!cup) return "";
    const bid = boardId || "bracketBoard";
    const champName = cup.champion
      ? ((cup.slots || []).filter(function (s) { return s.id === cup.champion; })[0] || {}).name || cup.champion
      : "";
    const champ = champName ? ("<p class='banner'>Cup champion: " + esc(champName) + "</p>") : "";
    if (cup.tree && cup.tree.semis) {
      return '<div class="bracket" id="' + bid + '">' +
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
    return '<div class="bracket" id="' + bid + '"><ol>' + rows + '</ol></div>' + champ;
  }

  function champsBlock() {
    const c = seasonDone() ? champsState() : null;
    if (!c) return '<section class="es-card"><h3 class="section">Champions Cup</h3><p class="fine">When the league closes, its top four play 3v3 knockouts before the ceremony: 1st vs 4th, 2nd vs 3rd, then the final. The winner takes a relic.</p></section>';
    return '<section class="es-card" id="champsCard"><h3 class="section">Champions Cup · Season ' + c.season + '</h3>' +
      cupMarkup(c, "champsBoard") +
      (!c.champion && IL.cupOpponent(c) ? '<button type="button" class="btn fight" id="champsFight">Fight the ' + (c.round >= 1 ? "final" : "semifinal") + '</button>' : '') +
    '</section>';
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
    return '<div class="compete-grid">' + leagueCardHtml() + thunderCardHtml() + chaosCardHtml() + '</div>' +
      '<section class="cup-block" id="cupBlock">' +
      '<header class="panel-head"><p class="eyebrow">' + (cup && cup.mid && !cup.champion ? 'Mid-season · free entry · ' + cup.size + 'v' + cup.size : 'Single elimination') + '</p><h3>' + (cup && cup.mid && !cup.champion ? 'The MidCup' : 'The cup') + '</h3></header>' +
      '<div class="hub-actions">' + enter + '</div>' +
      '<p class="banner">' + (cup && cup.mid && !cup.champion
        ? 'Every club gets one MidCup a season, opened after week ' + Math.floor(seasonWeeks() / 2) + '. You send ' + esc(sentNames) + '. Win it for 150 gold, 28 renown and a season goal.'
        : 'Four clubs. You send ' + esc(sentNames) + '. The other semi is called from the yard. Win the final for gold, renown, and a shot at a relic.') + '</p>' +
      (opp && !cupReady ? '<p class="banner">Set ' + cup.size + ' fighters in the lineup on the club tab before this tie.</p>' : '') +
      (cup ? cupMarkup(cup) : '<p class="fine">No bracket yet.</p>') +
      '</section>' +
      '<section class="draft-block" id="draftBlock">' + draftPanel() + '</section>';
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
    if (IL.keepRivalsUp && IL.keepRivalsUp(save)) persist();
    if (openMidCup()) persist();
    ensureMarket();
    const freshAchieve = takeAchievements().concat(settleGoals());
    let want = tab;
    let aliased = false;
    /* "events:daily", "club:home", "matches:cups": a tab and the page in it. */
    if (typeof want === "string" && want.indexOf(":") > 0) {
      const bits = want.split(":");
      if (bits[0] === "events") { eventPane = bits[1]; want = "events"; }
      else if (bits[0] === "club") { clubPane = bits[1]; want = "club"; aliased = true; }
      else if (bits[0] === "matches") { matchesPane = bits[1]; want = "matches"; aliased = true; }
      else if (bits[0] === "roster") { rosterPane = bits[1]; want = "roster"; aliased = true; }
      else want = bits[0];
    }
    if (typeof want === "string" && TAB_ALIAS[want]) {
      aliased = true;
      const al = TAB_ALIAS[want];
      want = al[0];
      if (al[1] && want === "roster") rosterPane = al[1];
      if (al[1] && want === "matches") matchesPane = al[1];
      if (al[1] && want === "club") clubPane = al[1];
    }
    const next = (typeof want === "string" && HUB_TABS.indexOf(want) >= 0) ? want : (HUB_TABS.indexOf(hubTab) >= 0 ? hubTab : "overview");
    const switching = next !== hubTab;
    const snap = keep && !switching ? captureScroll() : null;
    if (switching) {
      if (!aliased) {
        if (next === "roster") rosterPane = "team";
        if (next === "matches") matchesPane = "league";
        if (next === "club") clubPane = "home";
        if (next === "intel") intelPane = "stats";
      }
      if (next === "market") marketPane = "fighters";
      if (next === "roster") fighterFilter = "all";
      if (next === "events") eventPane = "week";
      if (next === "train") trainPane = "drills";
      if (next === "relics") { relicStatus = "all"; relicRarity = "all"; relicSet = "all"; relicOpen = null; }
    }
    hubTab = next;
    hubBed();
    if (detailId && !fighterById(detailId)) detailId = null;
    persist();
    const done = seasonDone();
    const panel = hubTab === "roster" ? rosterPanel()
      : hubTab === "market" ? marketPanel()
      : hubTab === "matches" ? matchesPanel()
      : hubTab === "club" ? clubHomePanel()
      : hubTab === "intel" ? intelPanel()
      : overviewPanel();
    const fighter = detailId ? fighterById(detailId) : null;
    app.innerHTML =
      '<main class="hub es-hub tab-' + hubTab + '">' +
        '<div class="hub-sticky">' +
          hubHeadHtml(done) +
          tabBar(hubTab) +
        '</div>' +
        '<div class="hub-panel" id="hubPanel">' + panel + '</div>' +
        fightDockHtml() +
      '</main>' +
      (fightMenuOpen ? fightMenuHtml() : '') +
      (!fightMenuOpen && inboxOpen ? inboxHtml() : '') +
      (!fightMenuOpen && !inboxOpen && codexOpen && hubTab === "intel" ? codexHtml(codexOpen) : '') +
      (!fightMenuOpen && identityOpen ? identityHtml() : '') +
      (!fightMenuOpen && !identityOpen && creditsOpen ? creditsHtml() : '') +
      (!fightMenuOpen && !identityOpen && settingsOpen && !creditsOpen ? settingsHtml() : '') +
      (!fightMenuOpen && !identityOpen && !settingsOpen && !creditsOpen && fighter ? sheetHtml(fighter) : '') +
      (!fightMenuOpen && !identityOpen && !settingsOpen && !creditsOpen && !fighter && relicOpen && hubTab === "roster" && rosterPane === "relics" ? relicSheetHtml() : '');
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
    seatDock();
    const extra = [];
    if (hubTab === "market") {
      (save.market || []).forEach(function (row) { if (row && row.fighter) extra.push(row.fighter.parts); });
      ((save.deals && save.deals.offers) || []).forEach(function (o) { if (o && o.fighter) extra.push(o.fighter.parts); });
    }
    if (hubTab === "intel") {
      (save.clubs || []).forEach(function (c) { (c.fighters || []).forEach(function (f) { if (f && f.parts) extra.push(f.parts); }); });
      Object.keys(IL.CLASSES).forEach(function (id) { if (IL.defaultSheet) extra.push({ sheet: IL.defaultSheet(id) }); });
    }
    if (hubTab === "matches" && save.draft) {
      (save.draft.offer || []).concat(save.draft.picks || []).forEach(function (f) { if (f && f.parts) extra.push(f.parts); });
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

  function identityHtml() {
    return '<div class="sheet-back" id="identityBack"></div>' +
      '<aside class="sheet identity-sheet" id="identitySheet" role="dialog" aria-modal="true" aria-labelledby="identityTitle">' +
        '<header class="sheet-head"><div><p class="eyebrow">Club</p><h2 id="identityTitle">Name and colors</h2></div>' +
          '<button type="button" class="btn close-x" id="identityClose" aria-label="Close">Close</button></header>' +
        '<div class="identity-preview">' + crestHtml(save.clubName, "lg", save.crest, save.plate) +
          '<div><h3>' + esc(save.clubName) + '</h3><p class="fine">Season ' + save.season + ' · ' + (save.clubWins || 0) + ' wins</p></div></div>' +
        '<form class="rename-row" id="clubRenameForm"><input id="clubRenameInput" maxlength="22" autocomplete="off" aria-label="Club name" value="' + esc(save.clubName) + '">' +
          '<button type="submit" class="btn ghost">Rename</button></form>' +
        '<p class="fine" id="clubRenameNote"></p>' +
        colorsHtml() +
      '</aside>';
  }

  function renameClub(raw) {
    const name = String(raw || "").replace(/\s+/g, " ").trim().slice(0, 22);
    if (!name) return "Name the club something.";
    const old = save.clubName;
    if (name === old) return "";
    const taken = (save.clubs || []).some(function (c) { return !c.you && c.name.toLowerCase() === name.toLowerCase(); });
    if (taken) return "A rival in the league already uses that name.";
    save.clubName = name;
    (save.clubs || []).forEach(function (c) { if (c.you) c.name = name; });
    [save.cup, save.draft && save.draft.cup].forEach(function (cup) {
      if (!cup) return;
      (cup.slots || []).forEach(function (sl) { if (sl && sl.you) sl.name = name; });
      if (cup.tree) {
        (cup.tree.semis || []).concat([cup.tree.final]).forEach(function (t) {
          if (!t) return;
          if (t.a && t.a.you) t.a.name = name;
          if (t.b && t.b.you) t.b.name = name;
        });
      }
    });
    persist();
    return "";
  }

  function bindIdentity() {
    const open = function () {
      detailId = null;
      settingsOpen = false;
      creditsOpen = false;
      identityOpen = true;
      refreshHub();
    };
    const crestBtn = document.getElementById("clubIdentity");
    if (crestBtn) crestBtn.onclick = open;
    const fromSettings = document.getElementById("openIdentity");
    if (fromSettings) fromSettings.onclick = open;
    const sheet = document.getElementById("identitySheet");
    if (!sheet) return;
    const close = function () { identityOpen = false; refreshHub(); };
    document.getElementById("identityBack").onclick = close;
    document.getElementById("identityClose").onclick = close;
    document.getElementById("clubRenameForm").onsubmit = function (ev) {
      ev.preventDefault();
      const err = renameClub(document.getElementById("clubRenameInput").value);
      if (err) { document.getElementById("clubRenameNote").textContent = err; return; }
      refreshHub();
    };
    sheet.onclick = function (ev) {
      const emblem = ev.target.closest("[data-club-crest]");
      if (emblem) {
        const n = +emblem.dataset.clubCrest;
        if (n >= 1 && n <= 16) { save.crest = n; persist(); refreshHub(); }
        return;
      }
      const plateBtn = ev.target.closest("[data-club-plate]");
      if (plateBtn) {
        const n = +plateBtn.dataset.clubPlate;
        if (n >= 0 && n <= 15) { save.plate = n; persist(); refreshHub(); }
      }
    };
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
    const cur = s.speed > 1 ? 1.5 : 1;
    const picks = SPEEDS.map(function (n) {
      return '<button type="button" class="btn ghost' + (cur === n ? " on" : "") + '" id="speedPick' + speedId(n) + '" data-speed="' + n + '">' + n + '×</button>';
    }).join("");
    return '<div class="sheet-back" id="settingsBack"></div>' +
      '<aside class="sheet" id="settingsSheet" role="dialog" aria-modal="true" aria-labelledby="settingsTitle">' +
        '<header class="sheet-head"><div><p class="eyebrow">Club</p><h2 id="settingsTitle">Settings</h2></div>' +
          '<button type="button" class="btn close-x" id="settingsClose" aria-label="Close">Close</button></header>' +
        '<div class="settings-block settings-club">' +
          '<p class="eyebrow">Club</p>' +
          '<button type="button" class="btn" id="openIdentity">Club name and colors</button>' +
          '<button type="button" class="btn" id="credits">Credits</button>' +
          '<button type="button" class="btn" id="toTitle">Back to the title</button>' +
        '</div>' +
        '<label class="field">SFX<input id="soundVol" type="range" min="0" max="100" value="' + s.sound + '"></label>' +
        '<label class="field">Music<input id="musicVol" type="range" min="0" max="100" value="' + s.music + '"></label>' +
        '<label class="field">Crowd<input id="crowdVol" type="range" min="0" max="100" value="' + (typeof s.crowd === "number" ? s.crowd : 70) + '"></label>' +
        '<p class="fine">SFX is the fight and menu sound. Music is the bed under the club and the pit. Crowd is the stands.</p>' +
        '<p class="eyebrow">Fight speed</p>' +
        '<div class="chips" id="speedPicks">' + picks + '</div>' +
        '<label class="shake-row"><input type="checkbox" id="shakeToggle"' + (s.shake ? " checked" : "") + '> Screen shake</label>' +
        '<label class="shake-row"><input type="checkbox" id="injuryToggle"' + (s.injuries !== false ? " checked" : "") + '> Injuries</label>' +
        '<p class="eyebrow">Difficulty</p>' +
        '<div class="chips" id="diffPicks">' + Object.keys(IL.DIFFICULTY).map(function (id) {
          return '<button type="button" class="chip' + (IL.difficultyOf(save) === id ? " on" : "") + '" data-diff="' + id + '">' + esc(IL.DIFFICULTY[id].name) + '</button>';
        }).join("") + '</div>' +
        '<p class="fine" id="diffLine">' + esc(IL.DIFFICULTY[IL.difficultyOf(save)].blurb) + (IL.difficultyOf(save) === "infernus" ? ' Threat now +' + Math.round((IL.foeMulOf(save) / 1.2 - 1) * 100) + '%.' : '') + ' Change it any time; it applies from the next fight.</p>' +
        '<label class="shake-row"><input type="checkbox" id="noChampToggle"' + (s.noChampions ? " checked" : "") + '> No champion signings</label>' +
        '<label class="shake-row"><input type="checkbox" id="noModsToggle"' + (s.noMods ? " checked" : "") + '> No season modifiers (from next season)</label>' +
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
    const diffPicks = document.getElementById("diffPicks");
    if (diffPicks) diffPicks.onclick = function (ev) {
      const b = ev.target.closest("[data-diff]");
      if (!b) return;
      save.settings.difficulty = b.dataset.diff;
      touch();
      diffPicks.querySelectorAll("[data-diff]").forEach(function (c) { c.classList.toggle("on", c === b); });
      const line = document.getElementById("diffLine");
      if (line) line.textContent = IL.DIFFICULTY[b.dataset.diff].blurb + " Change it any time; it applies from the next fight.";
    };
    const ncT = document.getElementById("noChampToggle");
    if (ncT) ncT.onchange = function () { save.settings.noChampions = !!ncT.checked; touch(); };
    const nmT = document.getElementById("noModsToggle");
    if (nmT) nmT.onchange = function () { save.settings.noMods = !!nmT.checked; touch(); };
    const injT = document.getElementById("injuryToggle");
    if (injT) injT.onchange = function () {
      save.settings.injuries = !!injT.checked;
      if (!injT.checked) (save.roster || []).forEach(function (f) { if (f) f.injury = null; });
      touch();
    };
    const openFriend = document.getElementById("openFriend");
    if (openFriend) openFriend.onclick = function () {
      settingsOpen = false;
      detailId = null;
      eventPane = "friend";
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

  /* v97 pre-match: formation and a scouting report on the rival. */
  function formationHtml() {
    const cur = IL.FORMATIONS[save.formation] ? save.formation : "line";
    return '<section class="panel-frame formation" id="formationBox"><h3 class="section">Formation</h3>' +
      '<div class="formation-pick" id="formationPick" role="group" aria-label="Formation">' + Object.keys(IL.FORMATIONS).map(function (id) {
        return '<button type="button" class="es-subtab' + (id === cur ? " on" : "") + '" data-formation="' + id + '">' + esc(IL.FORMATIONS[id].name) + '</button>';
      }).join("") + '</div>' +
      '<p class="fine" id="formationLine">' + esc(IL.FORMATIONS[cur].blurb) + '</p></section>';
  }
  function scoutHtml(spec, right) {
    if (!right || !right.length) return "";
    const club = (save.clubs || []).filter(function (c) { return c && !c.you && c.name === spec.rightName; })[0];
    const lines = [];
    if (club) {
      const rank = sortedClubs().indexOf(club) + 1;
      lines.push(rank + (rank === 1 ? "st" : rank === 2 ? "nd" : rank === 3 ? "rd" : "th") + " in the league · " + club.w + " won, " + club.l + " lost · " + club.pts + " pts");
    }
    if (club && club.named) lines.push("Named team, led by " + club.leader + ". " + club.style);
    if (spec.prep) lines.push("Rival preparations: " + spec.prep);
    if (club && club.equipped && club.equipped.length) lines.push("Club relics: " + club.equipped.map(function (id) { const r = IL.relicById(id); return r ? r.name : id; }).join(", "));
    const met = (save.history || []).filter(function (h) { return h && h.opponent === spec.rightName; }).slice(0, 3);
    if (met.length) lines.push("Last met: " + met.map(function (h) { return (h.win ? "won " : "lost ") + (h.score || ""); }).join(", "));
    const rows = right.map(function (f) {
      const kit = IL.CLASSES[f.cls] || IL.CLASSES.warrior;
      if (IL.ensureMoves) IL.ensureMoves(f);
      const moves = (f.loadout || []).map(function (id) {
        const ab = IL.abilityById(id);
        if (!ab) return "";
        const evo = f.evos && f.evos[id] && IL.EVOS[f.evos[id]];
        return esc(ab.name) + (evo ? ' <em class="scout-evo" title="Evolved: ' + esc(evo.name) + '">★</em>' : '');
      }).filter(Boolean).join(", ");
      const relics = [f.relic, f.relic2].map(function (id) { return id && IL.relicById(id); }).filter(Boolean).map(function (r) { return esc(r.name); }).join(", ");
      const st = IL.scaledStats(f, kit);
      return '<li><b>' + esc(f.name) + '</b><span>' + esc(kit.name) + ' · Lv ' + (f.level || 1) + ' · HP ' + Math.round(st.hp) + ' · ATK ' + Math.round(st.atk) + ' · DEF ' + Math.round(st.def) + '</span>' +
        '<span class="scout-moves">' + (moves || "Basic attacks") + '</span>' +
        (relics ? '<span class="scout-relics">Relics: ' + relics + '</span>' : '') + '</li>';
    }).join("");
    return '<section class="panel-frame scout" id="scoutReport"><h3 class="section">Scouting report</h3>' +
      (lines.length ? lines.map(function (l) { return '<p class="fine' + (l.indexOf("Rival preparations") === 0 ? ' scout-prep' : '') + '">' + esc(l) + '</p>'; }).join("") : '') +
      '<ul class="scout-list">' + rows + '</ul></section>';
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
      (typeof f.stamina === "number" ? staminaBar(f) : '') +
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
        (spec.sides ? '' : formationHtml()) +
        '<div class="versus-grid">' +
          '<section class="panel-frame"><h3 class="section">Your party</h3>' + synergyLine(left, "yourSynergy") + '<div class="cards">' + left.map(versusCard).join("") + '</div></section>' +
          '<section class="panel-frame"><h3 class="section">They send</h3>' + synergyLine(right, "theirSynergy") + '<div class="cards">' + right.map(versusCard).join("") + '</div></section>' +
        '</div>' +
        scoutHtml(spec, right) +
        '<div class="power-compare" id="powerBar">' +
          '<div class="power-track"><div class="power-you" style="width:' + share + '%"></div></div>' +
          '<p>Power ' + youP + ' · ' + themP + '</p>' +
        '</div>' +
        '<div class="versus-actions">' +
          '<button type="button" class="btn ghost" id="versusBack">Back</button>' +
          pilotPickHtml() +
          '<button type="button" class="btn fight" id="confirmFight">Fight</button>' +
        '</div>' +
      '</main>';
    root.scrollTo(0, 0);
    document.getElementById("versusBack").onclick = function () {
      pendingSpec = null;
      showHub(spec.returnTab || "overview");
    };
    document.getElementById("confirmFight").onclick = confirmPending;
    const fmBox = document.getElementById("formationPick");
    if (fmBox) fmBox.onclick = function (ev) {
      const b = ev.target.closest("[data-formation]");
      if (!b) return;
      save.formation = b.dataset.formation;
      persist();
      fmBox.querySelectorAll("[data-formation]").forEach(function (c) { c.classList.toggle("on", c.dataset.formation === save.formation); });
      const line = document.getElementById("formationLine");
      if (line) line.textContent = IL.FORMATIONS[save.formation].blurb;
    };
    const pick = document.getElementById("pilotPick");
    if (pick) pick.onclick = function (ev) {
      const b = ev.target.closest("[data-pilot-pick]");
      if (!b) return;
      if (!save.settings) save.settings = { speed: 1, shake: true, sound: 80, music: 60, crowd: 70 };
      save.settings.pilot = b.dataset.pilotPick === "on";
      persist();
      pick.querySelectorAll("[data-pilot-pick]").forEach(function (c) {
        c.classList.toggle("on", (c.dataset.pilotPick === "on") === save.settings.pilot);
      });
    };
    bootCards(right.map(function (f) { return f && f.parts; }));
  }

  function pilotPickHtml() {
    const on = !!(save && save.settings && save.settings.pilot);
    return '<div class="pilot-pick" id="pilotPick" role="group" aria-label="In the pit">' +
      '<button type="button" class="ctl' + (on ? "" : " on") + '" data-pilot-pick="off" title="Watch: your fighters follow their behavior">Auto</button>' +
      '<button type="button" class="ctl' + (on ? " on" : "") + '" data-pilot-pick="on" title="Steer the captain with keys or taps">Steer</button>' +
      '</div>';
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
    if (nm) nm.onclick = function () { openFightMenu(); };
    const tutorSkip = document.getElementById("tutorSkip");
    if (tutorSkip) tutorSkip.onclick = function () {
      save.tutored = true;
      persist();
      showHub(hubTab);
    };
    const tutorNext = document.getElementById("tutorNext");
    if (tutorNext) tutorNext.onclick = function () {
      if (tutorStep >= TUTOR_STEPS.length - 1) {
        save.tutored = true;
        persist();
      } else tutorStep += 1;
      showHub(hubTab);
    };
    const openSeason = document.getElementById("openSeason");
    if (openSeason) openSeason.onclick = function () { showSeasonEnd(); };
    const dock = document.getElementById("fightDock");
    if (dock) dock.onclick = function (ev) {
      const b = ev.target.closest("[data-dock]");
      if (b) {
        if (b.dataset.dock === "fight") openFightMenu();
        else if (b.dataset.dock === "season") showSeasonEnd();
        else if (b.dataset.dock === "daily") beginDaily();
        else if (b.dataset.dock === "champs") startChampsFight();
        else if (b.dataset.dock === "inbox") { detailId = null; inboxOpen = true; refreshHub(); }
        else showHub("roster");
        return;
      }
      const g = ev.target.closest("[data-goto]");
      if (g) showHub(g.dataset.goto);
    };
    const others = document.getElementById("otherFights");
    if (others) others.onclick = function (ev) {
      const g = ev.target.closest("[data-goto]");
      if (g) showHub(g.dataset.goto);
    };
    const leagueFight = document.getElementById("leagueFight");
    if (leagueFight) leagueFight.onclick = function () { startFight(); };
    const leagueCeremony = document.getElementById("leagueCeremony");
    if (leagueCeremony) leagueCeremony.onclick = function () { showSeasonEnd(); };
    const gateBtn = document.getElementById("gateTile");
    if (gateBtn) gateBtn.onclick = function () { beginGate(); };
    const champsBtn = document.getElementById("champsFight");
    if (champsBtn) champsBtn.onclick = function () { startChampsFight(); };
    const openSeasonBanner = document.getElementById("openSeasonBanner");
    if (openSeasonBanner) openSeasonBanner.onclick = function () { showSeasonEnd(); };
    const chaosBtn = document.getElementById("chaos");
    if (chaosBtn) chaosBtn.onclick = function () { startChaosFight(); };
    const acadBtn = document.getElementById("academyGo");
    if (acadBtn && !acadBtn.disabled) acadBtn.onclick = function () { startAcademyFight(); };
    const thunderBtn = document.getElementById("thunderGo");
    if (thunderBtn && !thunderBtn.disabled) thunderBtn.onclick = function () { startThunderFight(); };
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
    bindIdentity();
    bindFightMenu();
    bindInbox();
    const codexClose = document.getElementById("codexClose");
    if (codexClose) codexClose.onclick = function () { codexOpen = null; refreshHub(); };
    const codexBack = document.getElementById("codexBack");
    if (codexBack) codexBack.onclick = function () { codexOpen = null; refreshHub(); };
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
      const found = IL.refreshBoard(save, takeRng(), rosterAvoid());
      save.marketNews = found ? ["Your scout found a " + found + "."] : [];
      persist();
      showHub("market", true);
    };
    const swapSel = document.getElementById("swapPick");
    if (swapSel) swapSel.onchange = function () { swapPick = swapSel.value; refreshHub(); };
    const scout = document.getElementById("scoutPick");
    if (scout) scout.onchange = function () {
      save.scout = scout.value || null;
      persist();
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
      if (t.dataset.tab === hubTab) resetPane(hubTab);
      detailId = null;
      gearPreview = null;
      tonicPick = null;
      tomePick = null;
      creditsOpen = false;
      identityOpen = false;
      fightMenuOpen = false;
      showHub(t.dataset.tab, t.dataset.tab === hubTab);
    };
    const panel = document.getElementById("hubPanel");
    if (panel) panel.onclick = function (ev) {
      if (quickGearClick(ev)) return;
      const pSwap = ev.target.closest("[data-party-swap]");
      if (pSwap) {
        const id = pSwap.dataset.partySwap;
        if (!partySwap || partySwap === id) partySwap = partySwap === id ? null : id;
        else if (partySwapDo(partySwap, id)) { partySwap = null; persist(); }
        else partySwap = id;
        refreshHub();
        return;
      }
      const pGear = ev.target.closest("[data-party-gear]");
      if (pGear) { partyGear = partyGear === pGear.dataset.partyGear ? null : pGear.dataset.partyGear; refreshHub(); return; }
      if (ev.target.closest("[data-party-best]")) { bestLineup(); partySwap = null; persist(); refreshHub(); return; }
      const lpLoad = ev.target.closest("[data-lineup-load]");
      if (lpLoad) { loadLineupPreset(+lpLoad.dataset.lineupLoad); return; }
      const lpSave = ev.target.closest("[data-lineup-save]");
      if (lpSave) { saveLineupPreset(+lpSave.dataset.lineupSave); return; }
      const pHire = ev.target.closest("[data-party-hire]");
      if (pHire && !pHire.disabled) { hireFromMarket(+pHire.dataset.partyHire, "roster"); return; }
      const jump = ev.target.closest("[data-tab-jump]");
      if (jump) { showHub(jump.dataset.tabJump); return; }
      const cv = ev.target.closest("[data-club-view]");
      if (cv) { clubView = cv.dataset.clubView; refreshHub(); return; }
      const pane = ev.target.closest("[data-pane]");
      if (pane) {
        const bits = pane.dataset.pane.split(":");
        if (bits[0] === "matches") matchesPane = bits[1];
        else if (bits[0] === "roster") rosterPane = bits[1];
        else if (bits[0] === "club") { clubPane = bits[1]; if (bits[2]) trainPane = bits[2]; }
        else if (bits[0] === "intel") intelPane = bits[1];
        refreshHub();
        return;
      }
      const gotoBtn = ev.target.closest("[data-goto]");
      if (gotoBtn) { showHub(gotoBtn.dataset.goto); return; }
      const offY = ev.target.closest("[data-offer-accept]");
      if (offY) { answerOffer(offY.dataset.offerAccept, true); return; }
      const offN = ev.target.closest("[data-offer-decline]");
      if (offN) { answerOffer(offN.dataset.offerDecline, false); return; }
      const apY = ev.target.closest("[data-approach-accept]");
      if (apY && !apY.disabled) { answerApproach(true); return; }
      if (ev.target.closest("[data-approach-decline]")) { answerApproach(false); return; }
      const healB = ev.target.closest("[data-heal]");
      if (healB && !healB.disabled) { healFighter(healB.dataset.heal); return; }
      const stHire = ev.target.closest("[data-staff-hire]");
      if (stHire && !stHire.disabled) {
        const row = (save.staffMarket || [])[+stHire.dataset.staffHire];
        if (row && IL.hireStaff(save, +stHire.dataset.staffHire)) { pitSound("purchase"); logClub(row.name + " joins the staff as " + IL.STAFF_ROLES[row.role].name + "."); persist(); refreshHub(); showNote(row.name + " hired."); }
        else pitSound("error");
        return;
      }
      const acIn = ev.target.closest("[data-acad-in]");
      if (acIn && !acIn.disabled) { if (IL.setAcademy(save, acIn.dataset.acadIn, true)) { persist(); refreshHub(); } else pitSound("error"); return; }
      const acOut = ev.target.closest("[data-acad-out]");
      if (acOut) { IL.setAcademy(save, acOut.dataset.acadOut, false); persist(); refreshHub(); return; }
      const tomeB = ev.target.closest("[data-tome]");
      if (tomeB) {
        const tf = fighterById(tomeB.dataset.tome);
        const was = tf ? tf.level || 1 : 1;
        if (tf && IL.useTome(save, tf)) { pitSound("purchase"); logClub(tf.name + " read a Development Tome: level " + was + " to " + tf.level + "."); persist(); refreshHub(); showNote(tf.name + " is now level " + tf.level + ". Level-up picks are waiting."); }
        else pitSound("error");
        return;
      }
      const stFire = ev.target.closest("[data-staff-fire]");
      if (stFire) { if (IL.fireStaff(save, stFire.dataset.staffFire)) { persist(); refreshHub(); } return; }
      const bid = ev.target.closest("[data-auction-bid]");
      if (bid && !bid.disabled) { bidAuction(); return; }
      const inLv = ev.target.closest("[data-inbox-level]");
      if (inLv) { levelFocus = inLv.dataset.inboxLevel; showGrowth(); return; }
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
      const capBtn = ev.target.closest("[data-set-captain]");
      if (capBtn) { setCaptain(capBtn.dataset.setCaptain); return; }
      const pilotBtn = ev.target.closest("#fighterList [data-pilot-pick]");
      if (pilotBtn) {
        if (!save.settings) save.settings = { speed: 1, shake: true, sound: 80, music: 60, crowd: 70 };
        save.settings.pilot = pilotBtn.dataset.pilotPick === "on";
        persist();
        refreshHub();
        return;
      }
      const arch = ev.target.closest("[data-archive]");
      if (arch) { archivePane = arch.dataset.archive; refreshHub(); return; }
      const cdx = ev.target.closest("[data-codex]");
      if (cdx) { codexOpen = cdx.dataset.codex; refreshHub(); return; }
      const mp = ev.target.closest("[data-mpick]");
      if (mp) { marketPick = +mp.dataset.mpick; refreshHub(); return; }
      const mf = ev.target.closest("[data-mfilter]");
      if (mf) { marketFilter = mf.dataset.mfilter; refreshHub(); return; }
      const hire = ev.target.closest("[data-hire]");
      if (hire) { hireFromMarket(+hire.dataset.hire); return; }
      const watch = ev.target.closest("[data-watch]");
      if (watch && !watch.disabled) { toggleWatch(+watch.dataset.watch); return; }
      const dpick = ev.target.closest("[data-draft-pick]");
      if (dpick) { pickDraft(+dpick.dataset.draftPick); return; }
      const dsign = ev.target.closest("[data-draft-sign]");
      if (dsign && !dsign.disabled) { signDrafted(dsign.dataset.draftSign); return; }
      if (ev.target.closest("#draftEnter")) { enterDraft(); return; }
      if (ev.target.closest("#draftReroll")) { if (IL.rerollDraft(save.draft, takeRng())) { persist(); refreshHub(); } return; }
      if (ev.target.closest("#draftFight")) { startDraftFight(); return; }
      if (ev.target.closest("#draftRelease")) { save.draft.stage = "done"; persist(); refreshHub(); return; }
      const sell = ev.target.closest("[data-sell]");
      if (sell) { const sf = fighterById(sell.dataset.sell); if (sf && sf.loan) { pitSound("error"); return; } sellFighter(sell.dataset.sell); return; }
      const lo = ev.target.closest("[data-loan-out]");
      if (lo) {
        const lf = fighterById(lo.dataset.loanOut);
        if (lf) returnGear(lf);
        const res = lf && IL.loanOut(save, lf.id, takeRng());
        if (res) { pitSound("purchase"); logClub(lf.name + " goes on loan to " + res.club + " (+" + res.fee + " gold)."); persist(); refreshHub(); showNote(lf.name + " joins " + res.club + " for " + IL.LOAN_WEEKS + " weeks."); }
        else pitSound("error");
        return;
      }
      const rvB = ev.target.closest("[data-rv-buy]");
      if (rvB && !rvB.disabled) { rivalDeal("buy", rvB.dataset.rvBuy); return; }
      const rvS = ev.target.closest("[data-rv-swap]");
      if (rvS && !rvS.disabled) { rivalDeal("swap", rvS.dataset.rvSwap); return; }
      const rvL = ev.target.closest("[data-rv-loan]");
      if (rvL && !rvL.disabled) { rivalDeal("loan", rvL.dataset.rvLoan); return; }
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
        gearPreview = gearPreview && gearPreview.uid === armEquip.dataset.armEquip ? null : { uid: armEquip.dataset.armEquip };
        refreshHub();
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
        const found = findItem(armOn.dataset.armItem);
        if (found && equipItem(fighterById(armOn.dataset.armOn), found.item)) { pitSound("purchase"); persist(); }
        gearPreview = null;
        refreshHub();
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

  function autoEquipRelics() {
    const size = !seasonDone() ? weekSize(save.round) : IL.PARTY_CAP;
    const party = fielded(save.roster, size || IL.PARTY_CAP);
    const changed = IL.autoRelics(save, party);
    persist();
    showHub("relics", true);
    showNote(changed ? "Relics equipped: the best club relics in the club slots, and the fielded party dressed by role." : "Already at the best fit.");
  }

  function bindRelicSheet() {
    const autoBtn = document.getElementById("autoRelics");
    if (autoBtn) autoBtn.onclick = autoEquipRelics;
    const clearBtn = document.getElementById("clearRelics");
    if (clearBtn) clearBtn.onclick = function () {
      save.equipped = [];
      (save.roster || []).forEach(function (f) { if (f) { f.relic = null; f.relic2 = null; } });
      persist();
      showHub("relics", true);
      showNote("Every relic is back in the chest.");
    };
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
    const sheetLevel = document.getElementById("sheetLevel");
    if (sheetLevel) sheetLevel.onclick = function () {
      levelFocus = detailId;
      detailId = null;
      showGrowth();
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
      if (quickGearClick(ev)) return;
      const tactic = ev.target.closest("[data-tactic]");
      if (tactic) { setTactic(detailId, tactic.dataset.tactic); return; }
      const aiChip = ev.target.closest("[data-ai]");
      if (aiChip) { setBehavior(detailId, aiChip.dataset.ai); return; }
      const aiP = ev.target.closest("[data-ai-preset]");
      if (aiP) {
        const pf = fighterById(detailId);
        const preset = (save.tacticPresets || [])[+aiP.dataset.aiPreset];
        if (pf && preset) { pf.ai = IL.normAi(preset.ai); persist(); refreshHub(); const bx = document.getElementById("behaviorBox"); if (bx) bx.open = true; showNote("Preset " + (+aiP.dataset.aiPreset + 1) + " applied."); }
        return;
      }
      if (ev.target.closest("[data-ai-save]")) {
        const sf = fighterById(detailId);
        if (sf) {
          if (!Array.isArray(save.tacticPresets)) save.tacticPresets = [];
          save.tacticPresets.push({ ai: IL.aiFor(sf) });
          if (save.tacticPresets.length > 5) save.tacticPresets.shift();
          persist(); refreshHub();
          const bx = document.getElementById("behaviorBox"); if (bx) bx.open = true;
          showNote("Behavior saved as preset " + save.tacticPresets.length + ".");
        }
        return;
      }
      if (ev.target.closest("[data-ai-reset]")) {
        const rf = fighterById(detailId);
        if (rf) { delete rf.ai; persist(); refreshHub(); }
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
      const upB = ev.target.closest("[data-upgrade]");
      if (upB && !upB.disabled) {
        const uf = fighterById(detailId);
        if (uf && IL.upgradeMove(uf, upB.dataset.upgrade)) { pitSound("purchase"); persist(); showHub(hubTab); }
        return;
      }
      const msB = ev.target.closest("[data-mastery-add]");
      if (msB) {
        const mf = fighterById(detailId);
        if (mf && IL.addMastery(mf, msB.dataset.masteryAdd)) { pitSound("purchase"); persist(); showHub(hubTab); }
        return;
      }
      const rsB = ev.target.closest("[data-respec]");
      if (rsB && !rsB.disabled) {
        const rf2 = fighterById(detailId);
        const cost = rf2 ? IL.respecCost(rf2) : 0;
        if (rf2 && save.gold >= cost && IL.startRespec(rf2)) { save.gold -= cost; pitSound("purchase"); logClub(rf2.name + " started a respec."); persist(); showHub(hubTab); }
        return;
      }
      const rpB = ev.target.closest("[data-respec-pick]");
      if (rpB) {
        const pf2 = fighterById(detailId);
        if (pf2 && IL.applyRespecPick(pf2, +rpB.dataset.respecPick)) { pitSound("purchase"); persist(); showHub(hubTab); }
        return;
      }
      const rbB = ev.target.closest("[data-rebirth]");
      if (rbB && !rbB.disabled) {
        const bf = fighterById(detailId);
        if (bf && IL.rebirth(save, bf, takeRng())) { pitSound("purchase"); logClub(bf.name + " was reborn: new growth grades."); persist(); showHub(hubTab); showNote(bf.name + ": growth grades re-rolled."); }
        return;
      }
      const sheetHeal = ev.target.closest("[data-heal]");
      if (sheetHeal && !sheetHeal.disabled) { healFighter(sheetHeal.dataset.heal); return; }
      if (ev.target.closest("[data-evo-skip]")) {
        const kf = fighterById(detailId);
        if (kf && IL.evoPicks(kf) > 0) { kf.evoSkips = (kf.evoSkips || 0) + 1; persist(); showHub(hubTab); }
        return;
      }
      const evoBtn = ev.target.closest("[data-evo-move]");
      if (evoBtn) {
        const ef = fighterById(detailId);
        if (ef && IL.evolveMove(ef, evoBtn.dataset.evoMove, evoBtn.dataset.evo)) {
          pitSound("purchase");
          persist();
          showHub(hubTab);
          const ab = IL.abilityById(evoBtn.dataset.evoMove);
          showNote((ab ? ab.name : "The move") + " evolves: " + IL.EVOS[evoBtn.dataset.evo].name + ".");
          logClub(ef.name + "'s " + (ab ? ab.name : "move") + " evolved: " + IL.EVOS[evoBtn.dataset.evo].name + ".");
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
    save.gold -= cost;
    save.trainsLeft -= 1;
    save.trainsDone = (save.trainsDone || 0) + 1;
    IL.grantXp(f, xp);
    persist();
    refreshHub();
    const word = { atk: "attack", hp: "health", def: "defense", spd: "speed" }[drill.stat] || "stat";
    let note = f.name + ": " + drill.name + ". +" + drill.amt + " " + word + ", +" + xp + " xp";
    if ((f.level || 1) > lv0) note += ", level " + f.level;
    if ((f.level || 1) > lv0) note += ". A level-up pick is waiting";
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
    save.relicStock = IL.rollRelicStock(takeRng(), save);
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
    if (typeof row.roll === "number") {
      if (!save.relicRolls || typeof save.relicRolls !== "object") save.relicRolls = {};
      save.relicRolls[row.id] = row.roll;
    }
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
    (save.roster || []).forEach(function (f) {
      if (f && f.relic === id) f.relic = null;
      if (f && f.relic2 === id) f.relic2 = null;
    });
    if (save.relicRolls) delete save.relicRolls[id];
    save.relicSalt = (save.relicSalt || 0) + 1;
    const fromSheet = relicOpen === id;
    if (fromSheet) relicOpen = null;
    persist();
    showHub(fromSheet ? "relics" : "market", true);
  }

  function takeDeal(index) {
    const offer = save.deals && save.deals.offers && save.deals.offers[index];
    if (!offer || offer.stock < 1 || save.gold < offer.cost) { pitSound("error"); return; }
    if (offer.kind === "fighter") {
      if (save.roster.length >= IL.rosterCap(save)) { pitSound("error"); return; }
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
    if (!f || f.captain || f.loan) return;
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
    if (save.equipped.length < IL.clubRelicSlots(save)) save.equipped.push(relic.id);
  }

  function toggleEquip(id) {
    const relic = IL.relicById(id);
    if (!relic || relic.scope === "fighter") return;
    if ((save.relics || []).indexOf(id) < 0) return;
    const eq = save.equipped || (save.equipped = []);
    const at = eq.indexOf(id);
    let wore = false;
    if (at >= 0) eq.splice(at, 1);
    else if (eq.length < IL.clubRelicSlots(save)) { eq.push(id); wore = true; }
    else { eq.splice(0, 1, id); wore = true; }
    persist();
    showHub("relics", true);
    if (wore) showNote(relic.name + ". " + relicLine(relic));
  }

  function bindFighterRelic(fighterId, relicId) {
    const relic = IL.relicById(relicId);
    if (!relic || relic.scope !== "fighter") return;
    if ((save.relics || []).indexOf(relicId) < 0) return;
    const fighter = fighterById(fighterId);
    if (!fighter) return;
    const was = fighter.relic === relicId || fighter.relic2 === relicId;
    (save.roster || []).forEach(function (f) {
      if (f && f.relic === relicId) f.relic = null;
      if (f && f.relic2 === relicId) f.relic2 = null;
    });
    if (was) { persist(); showHub("relics", true); return; }
    const two = (fighter.level || 1) >= IL.RELIC_SLOT2_LV;
    if (!fighter.relic) fighter.relic = relicId;
    else if (two) fighter.relic2 = relicId;
    else fighter.relic = relicId;
    persist();
    showHub("relics", true);
    showNote(relic.name + ". " + relicLine(relic));
  }

  function clearFighterRelic(relicId) {
    (save.roster || []).forEach(function (f) {
      if (f && f.relic === relicId) f.relic = null;
      if (f && f.relic2 === relicId) f.relic2 = null;
    });
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
    if (rival && !seasonDone()) {
      const n = weekSize(save.round);
      IL.rivalPick(rival, n).forEach(function (f) { pending[IL.hero.keyOf(f.parts)] = f.parts; });
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

  function hireFromMarket(index, back) {
    const row = save.market[index];
    if (!row || row.locked) { pitSound("error"); return; }
    if (save.gold < row.cost || save.roster.length >= IL.rosterCap(save)) { pitSound("error"); return; }
    if (row.fighter && row.fighter.champion && save.settings && save.settings.noChampions) { pitSound("error"); showNote("No champion signings is on (Settings)."); return; }
    const fighter = row.fighter;
    IL.hero.compose(fighter.parts).then(function () {
      save.gold -= row.cost;
      if (row.watch) save.watchSigned = (save.watchSigned || 0) + 1;
      pitSound("purchase");
      save.hires = (save.hires || 0) + 1;
      if (!Array.isArray(save.seenClasses)) save.seenClasses = [];
      if (fighter.cls && save.seenClasses.indexOf(fighter.cls) < 0) save.seenClasses.push(fighter.cls);
      save.roster.push(fighter);
      fighter.lv0 = fighter.level || 1;
      fighter.lv0Season = save.season;
      if (IL.dedupeNames) IL.dedupeNames(save.roster);
      save.market.splice(index, 1);
      if (!save.market.length) save.market = IL.rollMarket(takeRng(), save.renown || 0, rosterAvoid());
      persist();
      showHub(back || "market", true);
    }).catch(function () { showHub(back || "market", true); });
  }

  function toggleWatch(i) {
    const row = save.market && save.market[i];
    if (!row || row.locked) return;
    if (!row.watch && IL.watchCount(save) >= IL.WATCH_CAP) { pitSound("error"); return; }
    row.watch = !row.watch;
    if (row.watch && !row.base) row.base = row.cost;
    persist();
    refreshHub();
  }

  /* ---------- draft cup ---------- */
  function enterDraft() {
    const d = save.draft;
    if (d && d.stage !== "done") return;
    if (save.gold < IL.DRAFT_COST) { pitSound("error"); return; }
    save.gold -= IL.DRAFT_COST;
    save.draftsEntered = (save.draftsEntered || 0) + 1;
    save.draft = IL.startDraft(save, takeRng());
    persist();
    refreshHub();
  }

  function pickDraft(i) {
    if (!IL.draftPick(save, save.draft, i, takeRng())) return;
    pitSound("purchase");
    persist();
    refreshHub();
  }

  function signDrafted(id) {
    const d = save.draft;
    if (!d || d.stage !== "sign") return;
    const f = d.picks.filter(function (p) { return p.id === id; })[0];
    if (!f || save.roster.length >= IL.rosterCap(save)) { pitSound("error"); return; }
    IL.hero.compose(f.parts).then(function () {
      delete f.drafted;
      f.stamina = IL.STAMINA_MAX;
      save.roster.push(f);
      if (IL.dedupeNames) IL.dedupeNames(save.roster);
      if (!Array.isArray(save.seenClasses)) save.seenClasses = [];
      if (save.seenClasses.indexOf(f.cls) < 0) save.seenClasses.push(f.cls);
      d.signed = f.name;
      d.stage = "done";
      pitSound("purchase");
      persist();
      refreshHub();
    }).catch(function () { refreshHub(); });
  }

  function startDraftFight() {
    const d = save.draft;
    const cup = d && d.cup;
    const opp = cup && IL.cupOpponent(cup);
    if (!opp || d.stage !== "bracket") return;
    openVersus({
      mode: "draft",
      left: d.picks.slice(0, cup.size),
      right: opp.foe.fighters.slice(0, cup.size),
      leftName: save.clubName,
      rightName: opp.foe.name,
      size: cup.size,
      seed: (save.rngSeed ^ (save.draftsEntered * 4111) ^ ((cup.round + 1) * 29)) >>> 0,
      returnTab: "cup"
    });
  }

  function draftCard(f, button) {
    const kit = IL.CLASSES[f.cls] || IL.CLASSES.warrior;
    const st = IL.scaledStats(f, kit);
    const trait = IL.TRAITS && IL.TRAITS[kit.trait];
    return '<article class="card roster-row draft-card" data-role="' + esc(kit.role) + '">' +
      portraitWrap('width="72" height="64" data-key="' + esc(IL.hero.keyOf(f.parts)) + '" data-anim="' + (kit.idle || "idle") + '" data-scale="2" data-foot="6"', false, f) +
      '<div class="row-main">' +
        '<h3>' + esc(f.name) + '</h3>' +
        '<p class="kit-line">' + classBadge(f.cls) + '<span>' + esc(kit.name) + ' · Lv ' + (f.level || 1) + ' · ' + esc(rarityLabel(f.rarity)) + (trait ? ' · ' + esc(trait.name) : '') + '</span></p>' +
        '<p class="fine">HP ' + Math.round(st.hp) + ' · ATK ' + Math.round(st.atk) + ' · ' + esc(roleLabel(kit.role)) + '</p>' +
      '</div>' +
      (button || '') +
    '</article>';
  }

  function roleLabel(role) {
    return { melee: "Front", tank: "Wall", kite: "Ranged", cast: "Caster", support: "Support", dash: "Skirmisher", hybrid: "Hybrid" }[role] || "Fighter";
  }

  function draftPanel() {
    const d = save.draft;
    const head = '<header class="panel-head draft-head"><p class="eyebrow">Draft</p><h3>The draft cup</h3></header>';
    const level = IL.draftLevel(save);
    if (!d || d.stage === "done") {
      const broke = save.gold < IL.DRAFT_COST;
      return head +
        '<p class="banner">Your roster stays home. Pick ' + IL.DRAFT_PICKS + ' mercenaries one at a time from offers of three, any class, at level ' + level + '. Three other clubs draft from the same pool. Win the 3 vs 3 bracket and sign one of your picks for free.</p>' +
        (d && d.signed ? '<p class="fine">Last draft: ' + esc(d.signed) + ' signed with the club.</p>' : '') +
        '<div class="hub-actions"><button type="button" class="btn gold" id="draftEnter"' + (broke ? " disabled" : "") + '>Enter draft — ' + IL.DRAFT_COST + ' gold</button></div>';
    }
    const picked = d.picks.length
      ? '<h4 class="section">Your picks</h4><div class="cards dense-grid">' + d.picks.map(function (f) { return draftCard(f, ""); }).join("") + '</div>'
      : '';
    if (d.stage === "pick") {
      return head +
        '<p class="banner" id="draftStatus">Pick ' + (d.picks.length + 1) + ' of ' + IL.DRAFT_PICKS + '. Level ' + d.level + '. Mind the mix: a wall, a ranged hand, and a healer go a long way.</p>' +
        '<div class="cards dense-grid" id="draftOffer">' + d.offer.map(function (f, i) {
          return draftCard(f, '<button type="button" class="btn primary" data-draft-pick="' + i + '">Draft</button>');
        }).join("") + '</div>' +
        '<div class="hub-actions"><button type="button" class="btn ghost" id="draftReroll"' + (d.rerolls > 0 ? "" : " disabled") + '>' + (d.rerolls > 0 ? "Reroll this offer — free once" : "Reroll spent") + '</button></div>' +
        picked + synergyLine(d.picks, "draftSynergy");
    }
    if (d.stage === "bracket") {
      const opp = d.cup ? IL.cupOpponent(d.cup) : null;
      return head +
        '<div class="hub-actions">' + (opp ? '<button type="button" class="btn fight" id="draftFight">Fight ' + esc(opp.foe.name) + '</button>' : '') + '</div>' +
        (d.cup ? cupMarkup(d.cup) : '') + picked;
    }
    if (d.stage === "sign") {
      const full = save.roster.length >= IL.rosterCap(save);
      return head +
        '<p class="banner" id="draftStatus">Draft champions. Sign one of the three for free' + (full ? " — the roster is full, so sell someone first or let them go." : ".") + '</p>' +
        '<div class="cards dense-grid">' + d.picks.map(function (f) {
          return draftCard(f, '<button type="button" class="btn gold" data-draft-sign="' + esc(f.id) + '"' + (full ? " disabled" : "") + '>Sign free</button>');
        }).join("") + '</div>' +
        '<div class="hub-actions"><button type="button" class="btn ghost" id="draftRelease">Let them all go</button></div>';
    }
    return head;
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


  /* ---------- level up ----------
     One screen per pick. Three cards with the numbers on them: a rank
     up for a move in use, a new move from the class pool, and a
     training step. A learned move can go straight into a slot. */
  let levelFocus = null;
  let levelEquip = null;

  function levelBannerText() {
    const q = pendingGrowth();
    if (!q.length) return "";
    const n = q.reduce(function (a, f) { return a + (f.pendingLevels || 0); }, 0);
    const names = q.slice(0, 2).map(function (f) { return f.name.split(" ")[0]; }).join(", ") + (q.length > 2 ? " and " + (q.length - 2) + " more" : "");
    return names + (q.length === 1 ? " has " : " have ") + n + " level-up pick" + (n === 1 ? "" : "s") + " waiting.";
  }

  function levelQueue() {
    const q = pendingGrowth();
    if (levelFocus) {
      const at = q.findIndex(function (f) { return f.id === levelFocus; });
      if (at > 0) q.unshift(q.splice(at, 1)[0]);
    }
    return q;
  }

  function roman(n) {
    return ["", "I", "II", "III", "IV", "V"][n] || String(n);
  }

  const RARITY_CLASS = ["common", "rare", "epic", "legendary"];

  /* v70 level up, after Eslabong: first "Choose a stat" (four cards,
     take one), then "Choose a skill" (three cards with a category pill
     and a tier). The stat waits in memory until the skill is taken, so
     Later drops nothing. */
  let growthStat = null;

  const STAT_CARD = {
    hp: { name: "HP", stat: "hp", verb: "Increase max health by", tone: "hp" },
    atk: { name: "ATK", stat: "atk", verb: "Increase attack by", tone: "atk" },
    def: { name: "DEF", stat: "def", verb: "Increase defense by", tone: "def" },
    spd: { name: "SPD", stat: "speed", verb: "Increase movement speed by", tone: "spd" }
  };

  /* Pixel-style stat icons, drawn as SVG so they stay crisp. */
  function statIcon(key) {
    const px = function (cells, color) {
      return cells.map(function (c) { return '<rect x="' + c[0] + '" y="' + c[1] + '" width="' + (c[2] || 1) + '" height="1" fill="' + color + '"/>'; }).join("");
    };
    let body = "";
    if (key === "hp") {
      body = px([[2, 3, 3], [7, 3, 3], [1, 4, 5], [6, 4, 5], [1, 5, 10], [1, 6, 10], [2, 7, 8], [3, 8, 6], [4, 9, 4], [5, 10, 2]], "#e8333a") +
        px([[2, 4, 2], [2, 5, 1]], "#ff8a8a");
    } else if (key === "atk") {
      body = px([[10, 1, 1], [9, 2, 2], [8, 3, 2], [7, 4, 2], [6, 5, 2], [5, 6, 2]], "#d9e3f2") +
        px([[10, 2, 1], [9, 3, 1], [8, 4, 1], [7, 5, 1]], "#8fa3c2") +
        px([[2, 6, 2], [3, 7, 3], [4, 8, 1], [2, 9, 2], [1, 10, 2]], "#b88a52");
    } else if (key === "def") {
      body = px([[2, 1, 8], [1, 2, 10], [1, 3, 10], [1, 4, 10], [1, 5, 10], [2, 6, 8], [2, 7, 8], [3, 8, 6], [4, 9, 4], [5, 10, 2]], "#3d8be0") +
        px([[3, 2, 3], [2, 3, 2], [2, 4, 1]], "#a8d4ff");
    } else {
      body = px([[3, 1, 3], [3, 2, 3], [3, 3, 3], [3, 4, 3], [3, 5, 3], [3, 6, 4], [2, 7, 7], [2, 8, 8], [2, 9, 8]], "#5cc45a") +
        px([[9, 3, 2], [9, 5, 2], [10, 7, 1]], "#b8f0a0") + px([[2, 9, 8]], "#2f7a32");
    }
    return '<svg class="lv-stat-icon" viewBox="0 0 12 12" width="44" height="44" shape-rendering="crispEdges" aria-hidden="true">' + body + '</svg>';
  }

  function statGain(f, key, pts) {
    const kit = IL.CLASSES[f.cls] || IL.CLASSES.warrior;
    const now = IL.scaledStats(f, kit);
    const rolls = Object.assign({ hp: 0, atk: 0, def: 0, spd: 0 }, f.rolls || {});
    rolls[key] += pts;
    const next = IL.scaledStats(Object.assign({}, f, { rolls: rolls }), kit);
    const k = STAT_CARD[key].stat;
    const d = next[k] - now[k];
    return key === "def" ? Math.round(d * 10) / 10 : Math.max(1, Math.round(d));
  }

  const CATEGORY_TONE = {
    "AoE": "aoe", "Defense": "def", "Taunt": "def", "Buff": "buff", "Heal": "heal", "Mobility": "mob",
    "Damage": "dmg", "Control": "ctl", "Stun": "ctl", "Push": "ctl", "Over time": "dot",
    "Summon": "sum", "Passive": "pas", "Upgrade": "upg", "Training": "upg", "Utility": "uti"
  };

  function skillCardHtml(f, card, i) {
    const rar = RARITY_CLASS[card.tier] || "common";
    const R = IL.RARITY[card.tier] || IL.RARITY[0];
    const cat = IL.categoryOf ? IL.categoryOf(card) : "Utility";
    const top = '<p class="lv-cat ' + (CATEGORY_TONE[cat] || "uti") + '">' + esc(cat) + '</p>' +
      '<p class="lv-tier ' + rar + '">' + esc((R.tier || "T1") + " " + R.name) + '</p>';
    const wrap = function (icon, title, lines) {
      return '<button type="button" class="lv-card skill es ' + rar + '" data-pick="' + i + '" data-kind="' + card.kind + '" data-tier="' + card.tier + '">' +
        top + '<div class="lv-icon big">' + icon + '</div>' +
        '<h3>' + esc(title) + '</h3>' + lines + '<span class="lv-choose">Choose skill</span></button>';
    };
    if (card.kind === "hone") {
      const c = STAT_CARD[card.id];
      const gain = statGain(f, card.id, card.pts);
      return wrap(statIcon(card.id), "Hone " + c.name,
        '<p class="lv-desc"><b class="up">+' + gain + '</b> ' + esc(c.name) + ', permanently, on top of the stat pick.</p><p class="lv-desc dim">Offered once every move, upgrade and passive is taken.</p>');
    }
    if (card.kind === "talent") {
      const t = IL.TALENTS[card.id];
      const glyph = { keen: "◎", ironhide: "⛨", vigor: "✚", thorns: "✶", bloodlust: "♥", fleet: "»" }[card.id] || "✦";
      return wrap('<span class="lv-glyph">' + glyph + '</span>', t.name + (card.up ? " · rank up" : ""),
        '<p class="lv-desc">' + esc(talentFacts(card.id, card.tier)) + '</p><p class="lv-desc dim">' + (card.up ? 'Replaces the weaker version this fighter has.' : 'Permanent, in every fight.') + '</p>');
    }
    const ab = IL.abilityById(card.id);
    if (!ab) return "";
    const icon = IL.abilityIcon ? iconTag(IL.abilityIcon(ab.id), 64) : "";
    if (card.kind === "spec") {
      const m = IL.MODS[card.mod];
      return wrap(icon + '<em class="spec-pip">' + esc(m.name.charAt(0)) + '</em>', m.name + " " + ab.name + (card.up ? " · rank up" : ""),
        '<p class="lv-desc">' + esc(modFacts(card.mod, card.tier, ab, f)) + '</p>' +
        '<p class="lv-desc dim">' + (card.up ? 'Raises the upgrade ' + esc(ab.name) + ' already has.' : 'A move holds one upgrade; it can be raised later.') + (ab.cd && card.mod !== "swift" ? ' Cooldown ' + realCd(ab, f) + 's.' : '') + '</p>');
    }
    return wrap(icon, ab.name,
      '<p class="lv-desc">' + esc(moveFacts(ab, f)) + '</p>' +
      '<p class="lv-desc dim">' + (ab.ult ? 'Ultimate. ' : '') + (ab.cd ? 'Cooldown ' + realCd(ab, f) + 's. ' : '') + (f.loadout.length < 3 ? 'Goes into an open slot.' : 'You can swap it into a slot next.') + '</p>');
  }

  function growthHeader(f, kit, waiting) {
    const slots = [0, 1, 2].map(function (k) {
      const id = (f.loadout || [])[k];
      if (!id) return '<li class="lv-slot empty">+</li>';
      const sp = f.specs && f.specs[id];
      const ab = IL.abilityById(id);
      return '<li class="lv-slot" title="' + esc((sp ? IL.MODS[sp.mod].name + " " : "") + (ab ? ab.name : id)) + '">' +
        (IL.abilityIcon ? iconTag(IL.abilityIcon(id), 30) : "") + (sp ? '<em class="spec-pip">' + esc(IL.MODS[sp.mod].name.charAt(0)) + '</em>' : '') + '</li>';
    }).join("");
    const talents = (f.talents || []).map(function (t) {
      return '<li class="lv-slot talent ' + (RARITY_CLASS[t.tier] || "common") + '" title="' + esc(IL.TALENTS[t.id].name) + '">' + esc(IL.TALENTS[t.id].name.charAt(0)) + '</li>';
    }).join("");
    const style = IL.STYLES[IL.styleOf(f)];
    return '<header class="lv-head es">' +
      '<div class="lv-portrait">' + portraitWrap('width="96" height="84" data-key="' + esc(IL.hero.keyOf(f.parts)) + '" data-anim="cheer" data-scale="2" data-foot="6"', f.captain, f) + '</div>' +
      '<div class="lv-who">' +
        '<h2>' + esc(f.name) + '</h2>' +
        '<p class="lv-class">' + esc(kit.name) + ' · <span class="style-chip" title="' + esc(style.blurb) + '">' + esc(style.name) + ' growth</span></p>' +
        '<p class="lv-level">Level ' + (f.level || 1) + (waiting > 1 ? ' <span class="fine">· ' + waiting + ' picks waiting</span>' : '') + '</p>' +
      '</div>' +
      '<ul class="lv-slots">' + slots + talents + '</ul>' +
    '</header>';
  }

  function showGrowth() {
    stopLoops();
    const queue = levelQueue();
    if (!queue.length && !levelEquip) { levelFocus = null; growthStat = null; showHub(); return; }
    hubBed();
    app.onclick = null;
    if (levelEquip) { showLevelEquip(); return; }
    pitSound("level");
    const f = queue[0];
    if (IL.ensureMoves) IL.ensureMoves(f);
    const kit = IL.CLASSES[f.cls] || IL.CLASSES.warrior;
    const offer = IL.levelOffer(f);
    const waiting = queue.reduce(function (n, x) { return n + (x.pendingLevels || 0); }, 0);
    const chosen = growthStat && growthStat.fid === f.id ? growthStat.key : null;
    const skillCost = IL.rerollCost(f, "skill");
    let body;
    if (!chosen) {
      body =
        '<h2 class="lv-title">Choose a stat</h2>' +
        '<div class="lv-cards stats" id="statChoices">' + offer.stats.map(function (st) {
          const c = STAT_CARD[st.key];
          const gain = statGain(f, st.key, st.pts);
          return '<button type="button" class="lv-card stat es ' + c.tone + '" data-stat="' + st.key + '">' +
            statIcon(st.key) +
            '<p class="lv-stat-name">' + c.name + (st.good ? ' <span class="lv-good">Growth</span>' : '') + '</p>' +
            '<p class="lv-stat-gain">+' + gain + ' ' + c.name + '</p>' +
            '<p class="lv-desc">' + c.verb + ' ' + gain + '.</p>' +
            '<span class="lv-choose">Choose stat</span>' +
          '</button>';
        }).join("") + '</div>' +
        '<footer class="lv-foot"><button type="button" class="lv-later" id="backHub">Later</button></footer>';
    } else {
      const st = offer.stats.filter(function (x) { return x.key === chosen; })[0];
      const c = STAT_CARD[chosen];
      body =
        '<h2 class="lv-title">Choose a skill</h2>' +
        '<p class="lv-chosen">Stat chosen: <b>+' + statGain(f, chosen, st.pts) + ' ' + c.name + '</b> <button type="button" class="link" id="changeStat">Change</button></p>' +
        '<div class="lv-cards skills" id="growthChoices">' + offer.cards.map(function (card, i) { return skillCardHtml(f, card, i); }).join("") + '</div>' +
        '<footer class="lv-foot">' +
          '<button type="button" class="lv-later" id="rerollSkills"' + (save.gold < skillCost ? ' disabled' : '') + '>Reroll · ' + skillCost + 'g</button>' +
          '<button type="button" class="lv-later" id="backHub">Later</button>' +
        '</footer>';
    }
    app.innerHTML = '<main class="lv-screen v3" id="growth">' + growthHeader(f, kit, waiting) + body + '</main>';
    mountIcons(app);
    bootCards();
    document.getElementById("backHub").onclick = function () { levelFocus = null; growthStat = null; showHub(); };
    if (!chosen) {
      document.getElementById("statChoices").onclick = function (ev) {
        const btn = ev.target.closest("[data-stat]");
        if (!btn) return;
        pitSound("click");
        growthStat = { fid: f.id, key: btn.dataset.stat };
        levelFocus = f.id;
        showGrowth();
      };
      return;
    }
    document.getElementById("changeStat").onclick = function () { growthStat = null; levelFocus = f.id; showGrowth(); };
    document.getElementById("rerollSkills").onclick = function () {
      if (save.gold < skillCost) { pitSound("error"); return; }
      save.gold -= skillCost;
      f.skillRerolls = (f.skillRerolls || 0) + 1;
      levelFocus = f.id;
      persist();
      showGrowth();
    };
    document.getElementById("growthChoices").onclick = function (ev) {
      const btn = ev.target.closest("[data-pick]");
      if (!btn) return;
      const card = IL.applyLevelPick(f, +btn.dataset.pick, chosen);
      if (!card) return;
      growthStat = null;
      pitSound("purchase");
      if (card.kind === "learn" && f.loadout.indexOf(card.id) < 0) levelEquip = { fid: f.id, id: card.id };
      persist();
      afterLevelPick();
    };
  }

  function afterLevelPick() {
    if (levelEquip || pendingGrowth().length) showGrowth();
    else if (seasonDone()) showSeasonEnd();
    else { levelFocus = null; showHub(); }
  }

  function showLevelEquip() {
    const f = fighterById(levelEquip.fid);
    const ab = f && IL.abilityById(levelEquip.id);
    if (!f || !ab) { levelEquip = null; afterLevelPick(); return; }
    const slots = f.loadout.map(function (id, i) {
      const cur = IL.abilityById(id);
      return '<button type="button" class="lv-equip-slot" data-slot="' + i + '">' +
        '<span class="lv-equip-icon">' + (IL.abilityIcon ? iconTag(IL.abilityIcon(id), 32) : "") + '</span>' +
        '<span class="lv-equip-text"><span class="lv-equip-tag">Slot ' + (i + 1) + (i === 2 ? ' · ultimate' : '') + '</span>' +
        '<b>' + esc(cur ? cur.name : "Empty") + '</b>' + (cur ? '<span class="fine">Rank ' + roman(IL.rankOf(f, id)) + '</span>' : '') + '</span>' +
        '<span class="lv-equip-go">Replace</span></button>';
    }).join("");
    app.innerHTML =
      '<main class="lv-screen" id="growth">' +
        '<header class="lv-head"><div class="lv-who"><p class="eyebrow">New move</p>' +
          '<h2>' + esc(f.name) + ' learned ' + esc(ab.name) + '</h2>' +
          '<p class="fine">Put it in a slot now, or keep the loadout. The sheet can swap it any time.</p></div></header>' +
        '<div class="lv-equip-new">' + (IL.abilityIcon ? '<span class="lv-equip-icon">' + iconTag(IL.abilityIcon(ab.id), 40) + '</span>' : '') +
          '<span class="lv-equip-text"><span class="lv-equip-tag">New</span><b>' + esc(ab.name) + '</b>' + '<span class="fine">' + esc(moveFacts(ab, f)) + (ab.cd ? ' Cooldown ' + realCd(ab, f) + 's.' : '') + '</span>' + '</span></div>' +
        '<h3 class="lv-equip-ask">Swap it in for</h3>' +
        '<div class="lv-equip" id="growthChoices">' + slots + '</div>' +
        '<footer class="lv-foot"><button type="button" class="lv-later" id="backHub">Keep the loadout</button></footer>' +
      '</main>';
    mountIcons(app);
    document.getElementById("backHub").onclick = function () { levelEquip = null; persist(); afterLevelPick(); };
    document.getElementById("growthChoices").onclick = function (ev) {
      const b = ev.target.closest("[data-slot]");
      if (!b) return;
      IL.equipMove(f, +b.dataset.slot, ab.id);
      levelEquip = null;
      persist();
      afterLevelPick();
    };
  }

  function showMoves() { showGrowth(); }

  /* ---------- fight ---------- */
  function seasonModsFor(mode) {
    const m = mode || "league";
    return (m === "league" || m === "cup" || m === "champions") && Array.isArray(save.mods) ? save.mods.slice() : [];
  }

  /* v93 MidCup: from week 8 a free cup opens once a season, in a random
     size, for a bigger purse. It waits for a token cup in progress. */
  function openMidCup() {
    if (!save || !IL.startCup || seasonDone()) return false;
    if (save.midSeason === save.season) return false;
    if ((save.round || 0) < Math.floor(seasonWeeks() / 2)) return false;
    if (save.cup && !save.cup.champion) return false;
    const rng = takeRng();
    const size = 1 + Math.floor(rng() * 3);
    save.cup = IL.startCup(save, rng, size);
    save.cup.mid = true;
    save.cup.season = save.season;
    save.midSeason = save.season;
    return true;
  }

  /* v93 season objectives: pay the moment one is met. */
  /* Season card: modifiers and objectives with progress. */
  function seasonGoalsHtml(place) {
    const goals = save.seasonGoals || [];
    if (!goals.length || !IL.SEASON_GOALS) return "";
    const ctx = place != null ? { place: place } : null;
    const rows = goals.map(function (g) {
      const def = IL.SEASON_GOALS.filter(function (d) { return d.id === g.id; })[0];
      if (!def) return "";
      const have = Math.min(def.need, IL.goalProgress(save, g.id, ctx));
      const pct = Math.round(100 * have / def.need);
      return '<li class="goal-row' + (g.paid ? " done" : "") + '"><span><b>' + esc(def.text) + '</b><small>' + (g.paid ? "Done · paid" : have + " / " + def.need) + ' · ' + def.gold + 'g, ' + def.renown + ' renown</small></span>' +
        '<i class="goal-bar"><i style="width:' + (g.paid ? 100 : pct) + '%"></i></i></li>';
    }).join("");
    return '<section class="es-card season-card" id="seasonGoals"><h3 class="section">Season goals</h3><ul class="goal-list">' + rows + '</ul></section>';
  }

  function seasonModsHtml() {
    const mods = (save.mods || []).map(function (id) { return IL.seasonModById ? IL.seasonModById(id) : null; }).filter(Boolean);
    if (!mods.length) return "";
    return '<section class="es-card season-card" id="seasonMods"><h3 class="section">Season modifiers</h3><ul class="mod-list">' +
      mods.map(function (m) { return '<li><b>' + esc(m.name) + '</b><small>' + esc(m.blurb) + '</small></li>'; }).join("") +
      '</ul><p class="fine">On every league, cup and Champions Cup match this season.</p></section>';
  }

  function settleGoals(ctx) {
    const out = [];
    if (!save || !Array.isArray(save.seasonGoals) || !IL.SEASON_GOALS) return out;
    const mul = IL.DIVISIONS[IL.divisionOf(save)].purse;
    save.seasonGoals.forEach(function (g) {
      if (g.paid) return;
      const def = IL.SEASON_GOALS.filter(function (d) { return d.id === g.id; })[0];
      if (!def) return;
      if (def.id === "top3" && !(ctx && ctx.place != null)) return;
      if (IL.goalProgress(save, g.id, ctx) < def.need) return;
      g.paid = true;
      const gold = Math.round(def.gold * mul);
      const renown = Math.round(def.renown * mul);
      save.gold += gold;
      save.renown = (save.renown || 0) + renown;
      out.push({ name: "Goal: " + def.text, gold: gold, renown: renown });
      logClub("Season goal met: " + def.text + " (+" + gold + " gold).");
    });
    if (out.length) persist();
    return out;
  }

  /* v107 difficulty applies to every fight but friend fights and the shared daily. */
  function foeMulFor(mode) {
    if (mode === "challenge" || mode === "daily" || !IL.foeMulOf) return 1;
    return IL.foeMulOf(save);
  }

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
      speed = savedSpeed > 1 ? 1.5 : 1;
      paused = false;
      const party = spec.left || (spec.sides && spec.sides[0] && spec.sides[0].fighters) || [];
      const pack = IL.relicPack(save, party);
      const relics = pack.club.concat(pack.sets);
      const match = spec.sides
        ? IL.createMatch({ seed: spec.seed, sides: spec.sides, relics: relics, wornRelics: pack.worn, mode: spec.mode, mods: seasonModsFor(spec.mode), foeMul: foeMulFor(spec.mode) })
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
          mods: seasonModsFor(spec.mode),
          foeRelics: spec.foeRelics || null,
          foeWorn: spec.foeWorn || null,
          formation: save.formation || null,
          foeFormation: spec.foeFormation || null,
          captainBoost: IL.staffStars ? 0.03 * IL.staffStars(save, "coach") : 0,
          foeMul: foeMulFor(spec.mode),
          capBonus: save.settings && save.settings.pilot ? 0 : (IL.DIFFICULTY ? IL.DIFFICULTY[IL.difficultyOf(save)].cap : 0)
        });
      match.spriteMap = map;
      match.units.forEach(function (u) { u.sprite = map[IL.hero.keyOf(u.parts)]; });
      match.pilot = makePilot(match, !!(save && save.settings && save.settings.pilot));
      fight = {
        match: match,
        left: spec.left || (spec.sides && spec.sides[0].fighters) || [],
        right: spec.right || [],
        rival: spec.rival || null,
        size: spec.size || 1,
        mode: spec.mode || "league",
        returnTab: spec.returnTab || "overview",
        friendName: spec.friendName || "",
        academyClub: spec.academyClub || "",
        series: spec.series || null,
        spec: spec,
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
      const list = f ? [f.relic, f.relic2].map(function (id) { return id && IL.relicById(id); }).filter(Boolean) : [];
      if (list.length) foeWorn[f.id] = list;
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
    const size = weekSize(save.round);
    const left = fielded(save.roster, size);
    if (left.length < size) return;
    /* v106 rivals rest the tired, wear relics, and may counter your last three lineups. */
    const prep = IL.rivalPrep ? IL.rivalPrep(save, rival) : null;
    const right = IL.rivalPick(rival, size).map(function (f) {
      return prep ? Object.assign({}, f, { ai: Object.assign({}, f.ai || {}, prep.ai) }) : f;
    });
    const foeWorn = {};
    right.forEach(function (f) { const r = f.relic && IL.relicById(f.relic); if (r) foeWorn[f.id] = [r]; });
    openVersus({
      mode: "league",
      left: left,
      right: right,
      foeRelics: (rival.equipped || []).map(function (id) { return IL.relicById(id); }).filter(Boolean),
      foeWorn: foeWorn,
      foeFormation: (prep && prep.formation) || rival.formation || null,
      prep: prep ? prep.text : "",
      leftName: save.clubName,
      rightName: rival.name,
      rival: rival,
      size: size,
      seed: (save.rngSeed ^ (save.season * 997) ^ ((save.round + 1) * 131)) >>> 0,
      returnTab: "overview",
      series: newSeries()
    });
  }

  /* v104 league matches are a best-of-three series. */
  function newSeries() { return { need: 2, wins: [0, 0], log: [], stats: {}, kills: [0, 0], round: 1, done: false }; }
  const SERIES_KEYS = ["dmgDealt", "dmgTaken", "healing", "kos", "deaths", "assists", "ffDealt"];
  function stashSeries(ser, match) {
    match.units.forEach(function (u) {
      if (!u || u.summon) return;
      const k = u.team + ":" + u.id;
      const row = ser.stats[k] || (ser.stats[k] = { byAb: {} });
      SERIES_KEYS.forEach(function (key) { row[key] = (row[key] || 0) + (u[key] || 0); });
      Object.keys(u.byAb || {}).forEach(function (id) {
        const a = u.byAb[id];
        const b = row.byAb[id] || (row.byAb[id] = { id: id, name: a.name, dmg: 0, heal: 0, uses: 0 });
        b.dmg += a.dmg || 0; b.heal += a.heal || 0; b.uses += a.uses || 0; if (a.used) b.used = true;
      });
    });
    (match.kills || []).forEach(function (n, t) { ser.kills[t] = (ser.kills[t] || 0) + (n || 0); });
  }
  function foldSeries(ser, match) {
    match.units.forEach(function (u) {
      const row = u && ser.stats[u.team + ":" + u.id];
      if (!row) return;
      SERIES_KEYS.forEach(function (key) { u[key] = (u[key] || 0) + (row[key] || 0); });
      if (!u.byAb) u.byAb = {};
      Object.keys(row.byAb).forEach(function (id) {
        const b = row.byAb[id];
        const a = u.byAb[id] || (u.byAb[id] = { id: id, name: b.name, dmg: 0, heal: 0 });
        a.dmg = (a.dmg || 0) + b.dmg; a.heal = (a.heal || 0) + b.heal; a.uses = (a.uses || 0) + b.uses; if (b.used) a.used = true;
      });
    });
    (ser.kills || []).forEach(function (n, t) { match.kills[t] = (match.kills[t] || 0) + (n || 0); });
  }
  function seriesBreak(ser) {
    const box = document.getElementById("result");
    if (!box) return;
    const cur = IL.FORMATIONS[save.formation] ? save.formation : "line";
    const last = ser.log[ser.log.length - 1];
    box.hidden = false;
    box.innerHTML = '<div class="series-break" id="seriesBreak">' +
      '<p class="eyebrow">Round ' + (ser.round - 1) + ' of 3 · best of three</p>' +
      '<h2>' + (last === "W" ? "Round won" : "Round lost") + '</h2>' +
      '<p class="series-score"><b>' + ser.wins[0] + '</b><span>–</span><b>' + ser.wins[1] + '</b></p>' +
      '<p class="fine">' + (ser.wins[0] === 1 && ser.wins[1] === 1 ? "All square. The next round decides it." : ser.wins[0] > ser.wins[1] ? "One more round takes the match." : "Win the next round to force a decider.") + ' Health and cooldowns reset. Change the formation if the last round went wrong.</p>' +
      '<div class="formation-pick" id="breakFormation" role="group" aria-label="Formation">' + Object.keys(IL.FORMATIONS).map(function (id) {
        return '<button type="button" class="es-subtab' + (id === cur ? " on" : "") + '" data-formation="' + id + '">' + esc(IL.FORMATIONS[id].name) + '</button>';
      }).join("") + '</div>' +
      '<p class="fine" id="breakFormationLine">' + esc(IL.FORMATIONS[cur].blurb) + '</p>' +
      '<button type="button" class="btn fight" id="nextRound">Round ' + ser.round + '</button>' +
    '</div>';
    document.getElementById("breakFormation").onclick = function (ev) {
      const b = ev.target.closest("[data-formation]");
      if (!b) return;
      save.formation = b.dataset.formation;
      persist();
      this.querySelectorAll("[data-formation]").forEach(function (c) { c.classList.toggle("on", c.dataset.formation === save.formation); });
      document.getElementById("breakFormationLine").textContent = IL.FORMATIONS[save.formation].blurb;
    };
    const spec = fight.spec;
    document.getElementById("nextRound").onclick = function () {
      this.disabled = true;
      this.textContent = "Opening the pit…";
      launchMatch(Object.assign({}, spec, { seed: ((spec.seed || 1) + ser.round * 7919) >>> 0, series: ser }));
    };
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

  /* ---------- v79 Iron Gate ---------- */
  function gateOpen() {
    return !(save.gateWeek === IL.weekIndex(Date.now()) && !save.gateRun);
  }

  function beginGate() {
    if (!save.gateRun) {
      if (!gateOpen()) return;
      save.gateRun = { floor: 1, hp: {}, week: IL.weekIndex(Date.now()), chests: 0 };
      save.gateWeek = save.gateRun.week;
    }
    persist();
    return launchGateFloor();
  }

  function launchGateFloor() {
    const run = save.gateRun;
    if (!run) return;
    const party = withFractions(eventParty(), run.hp);
    if (!party.length) { endGate(); showHub("club"); return; }
    const rng = takeRng();
    const spec = IL.gateFloor(save, rng, run.floor);
    const seed = ((save.rngSeed ^ (run.floor * 7919) ^ (run.week || 0)) >>> 0) || 1;
    if (spec.boss) {
      return launchMatch({
        mode: "gate", left: party, right: [spec.boss], extra: spec.adds, bossAdds: spec.adds,
        leftName: save.clubName, rightName: spec.boss.name + " · Floor " + run.floor, size: party.length,
        seed: seed, returnTab: "club"
      });
    }
    return launchMatch({
      mode: "gate", left: party, right: spec.foes,
      leftName: save.clubName, rightName: "Iron Gate · Floor " + run.floor, size: party.length,
      seed: seed, returnTab: "club"
    });
  }

  function endGate() {
    const run = save.gateRun;
    if (run) save.gateBest = Math.max(save.gateBest || 0, (run.floor || 1) - 1);
    if (run) {
      if (save.gateSeason !== save.season) { save.gateSeason = save.season; save.gateSeasonBest = 0; }
      save.gateSeasonBest = Math.max(save.gateSeasonBest || 0, (run.floor || 1) - 1);
    }
    save.gateRun = null;
    persist();
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

  /* v99 live orders, after Eslabong's F1 to F4. */
  const ORDER_LABELS = [
    ["plan", "Plan", "Each fighter follows its own behavior"],
    ["engage", "Attack", "Everyone pushes in: no falling back, ranged close the gap"],
    ["regroup", "Regroup", "Gather on the captain and fight only what comes close"],
    ["hold", "Hold", "Hold the starting line and fight only what is in reach"]
  ];
  function giveOrder(order) {
    const m = fight && fight.match;
    if (!m || m.over || !IL.setOrder) return;
    IL.setOrder(m, 0, order);
    const bar = document.getElementById("orderBar");
    if (bar) bar.querySelectorAll("[data-order]").forEach(function (b) { b.classList.toggle("on", b.dataset.order === order); });
    const lab = ORDER_LABELS.filter(function (o) { return o[0] === order; })[0];
    if (lab) pilotSay(lab[1] + ": " + lab[2] + ".");
  }
  function onOrderKey(ev) {
    if (!fight || !fight.match || fight.match.over) return;
    const n = { F1: 0, F2: 1, F3: 2, F4: 3 }[ev.key];
    if (n == null || !document.getElementById("orderBar")) return;
    ev.preventDefault();
    giveOrder(ORDER_LABELS[n][0]);
  }

  function mountFight(match) {
    app.onclick = null;
    app.innerHTML =
      '<main class="fight-screen v61">' +
        '<header class="bar fight-top">' +
          '<div class="side you"><div class="side-head"><strong id="leftName"></strong><span id="leftHp" class="team-pct"></span></div><div class="team-bar you"><i id="leftBar"></i></div></div>' +
          '<div class="timer" id="timer">0:00</div>' +
          '<div class="side them"><div class="side-head"><strong id="rightName"></strong><span id="rightHp" class="team-pct"></span></div><div class="team-bar them"><i id="rightBar"></i></div></div>' +
        '</header>' +
        (match.hazardName ? '<p class="hazard-line" id="pitBanner"><strong>' + esc(match.hazardName) + '</strong>' + (match.hazardBlurb ? '<span>' + esc(match.hazardBlurb) + '</span>' : '') + '</p>' : '') +
        '<div class="fight-layout">' +
          '<div class="stage"><canvas id="arena" width="1440" height="900"></canvas><div id="dmgMeter" class="dmg-meter" hidden></div>' +
            ((match.teams || 2) <= 2 && !match.scripted ? '<div class="order-bar" id="orderBar" role="group" aria-label="Orders">' + ORDER_LABELS.map(function (o, i) {
              return '<button type="button" class="order-btn' + (i === 0 ? " on" : "") + '" data-order="' + o[0] + '" title="' + esc(o[2]) + ' (F' + (i + 1) + ')">' + o[1] + '</button>';
            }).join("") + '</div>' : '') +
            '<div class="pilot-bar" id="pilotBar" hidden></div>' +
            '<p class="pilot-note" id="pilotNote" hidden></p>' +
            '<div id="result" class="result" hidden></div></div>' +
        '</div>' +
        '<footer class="fight-controls">' +
          '<div class="ctl-group ctl-speed" role="group" aria-label="Fight speed">' + speedButtons() + '</div>' +
          '<button type="button" class="ctl ctl-pilot" id="pilot">Control</button>' +
          '<div class="ctl-group ctl-right">' +
            '<button type="button" class="ctl" id="meter">Info</button>' +
            '<button type="button" class="ctl" id="pause">Pause</button>' +
          '</div>' +
        '</footer>' +
      '</main>';
    document.getElementById("leftName").innerHTML = crestHtml(match.leftName, "sm", save.crest, save.plate) + '<span class="club-name">' + esc(match.leftName) + '</span>';
    const rightLabel = (match.teams || 2) > 2
      ? (match.names || []).slice(1).join(" · ")
      : match.rightName;
    const rightCrest = (match.teams || 2) > 2 ? "" : crestHtml(rightLabel, "sm", crestIndexOf(rightLabel));
    document.getElementById("rightName").innerHTML = rightCrest + '<span class="club-name">' + esc(rightLabel) + '</span>';
    SPEEDS.forEach(function (n) {
      const btn = document.getElementById("speed" + speedId(n));
      if (btn) btn.onclick = function () { setFightSpeed(n); };
    });
    document.getElementById("pause").onclick = togglePause;
    const orderBar = document.getElementById("orderBar");
    if (orderBar) orderBar.onclick = function (ev) {
      const b = ev.target.closest("[data-order]");
      if (b) giveOrder(b.dataset.order);
    };
    document.getElementById("meter").onclick = toggleMeter;
    document.getElementById("pilot").onclick = function () { togglePilot(); };
    /* No skip in the pit. Tests and tools finish a fight with IL.finishNow(). */
    IL.finishNow = function () { if (fight && fight.series) fight.series.quick = true; skipFight(); };
    IL.finishRound = function () { skipFight(); }; /* tests: end one round of a series */
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
    /* Per-fighter health now rides over each head in the pit. */
    mountPilotBar(match);
  }

  /* ---------- captain control ----------
     The pit steps intent written here: a move vector from the keys, a
     tapped point or foe, a queued move, a roll. Auto hands the fighter
     back to their sheet's behavior, mid-fight, at any time. */
  function makePilot(match, on) {
    let pick = null;
    match.units.forEach(function (u) {
      if (u.team !== 0 || u.summon) return;
      if (!pick || (u.captain && !pick.captain)) pick = u;
    });
    if (!pick) return null;
    return { id: pick.id, mx: 0, my: 0, goX: null, goY: null, focusId: null, targetId: null, ab: null, abT: 0, roll: false, chase: false, auto: !on };
  }

  function pilotFighter(match) {
    const P = match && match.pilot;
    if (!P) return null;
    for (let i = 0; i < match.units.length; i++) if (match.units[i].id === P.id) return match.units[i];
    return null;
  }

  function mountPilotBar(match) {
    const bar = document.getElementById("pilotBar");
    const btn = document.getElementById("pilot");
    const P = match.pilot;
    if (btn) {
      btn.disabled = !P;
      btn.classList.toggle("on", !!P && !P.auto);
      btn.textContent = P && !P.auto ? "Auto" : "Control";
      btn.title = P && !P.auto ? "Hand the fighter back to their behavior (C)" : "Steer your captain (C)";
    }
    if (!bar) return;
    const u = pilotFighter(match);
    if (!P || P.auto || !u) {
      bar.hidden = true;
      bar.innerHTML = "";
      return;
    }
    const abs = IL.pilotAbs ? IL.pilotAbs(u) : [];
    const keys = ["Q", "E", "R"];
    bar.hidden = false;
    bar.dataset.pid = u.id;
    bar.innerHTML =
      '<p class="pilot-who"><span>Steering</span><b>' + esc(u.name) + '</b></p>' +
      '<div class="pilot-keys">' +
        abs.slice(0, 3).map(function (ab, i) {
          return '<button type="button" class="pilot-ab' + (ab.ult ? " ult" : "") + '" data-pilot-ab="' + i + '" title="' + esc(ab.name + " — " + moveFacts(ab, null, u && u.cls)) + '">' +
            (IL.abilityIcon ? iconTag(IL.abilityIcon(ab.id), 32) : "") +
            '<span class="pilot-name">' + esc(ab.name) + '</span><kbd>' + keys[i] + '</kbd><i class="pilot-cd"></i></button>';
        }).join("") +
        '<button type="button" class="pilot-ab roll" data-pilot-roll="1" title="Roll out of harm">' +
          '<span class="pilot-name">Roll</span><kbd>Space</kbd><i class="pilot-cd"></i></button>' +
      '</div>' +
      '<p class="pilot-help">Move with WASD or the arrows, or tap the floor. Tap a foe to hunt them. Tab swaps fighter.</p>';
    bar.onclick = function (ev) {
      const a = ev.target.closest("[data-pilot-ab]");
      if (a) { pilotCast(+a.dataset.pilotAb); return; }
      if (ev.target.closest("[data-pilot-roll]")) pilotRollNow();
    };
    mountIcons(bar);
  }

  function togglePilot(force) {
    if (!fight || !fight.match || fight.match.over || !fight.match.pilot) return;
    const P = fight.match.pilot;
    P.auto = typeof force === "boolean" ? !force : !P.auto;
    P.mx = 0; P.my = 0; P.goX = null; P.focusId = null; P.ab = null; P.roll = false; P.chase = false;
    pilotHeld = {};
    if (!save.settings) save.settings = { speed: 1, shake: true, sound: 80, music: 60, crowd: 70 };
    save.settings.pilot = !P.auto;
    persist();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    mountPilotBar(fight.match);
    pilotSay(P.auto ? "Back on auto." : "You have the captain.");
  }

  function pilotCast(i) {
    const P = fight && fight.match && fight.match.pilot;
    if (!P || P.auto) return;
    P.ab = i;
    P.abT = 2.6;
  }

  function pilotRollNow() {
    const P = fight && fight.match && fight.match.pilot;
    if (!P || P.auto) return;
    P.roll = true;
  }

  function pilotSwap() {
    const match = fight && fight.match;
    const P = match && match.pilot;
    if (!P || P.auto) return;
    const mine = match.units.filter(function (u) { return u.team === 0 && !u.summon && u.hp > 0; });
    if (mine.length < 2) return;
    const at = mine.findIndex(function (u) { return u.id === P.id; });
    const next = mine[(at + 1) % mine.length];
    P.id = next.id;
    P.goX = null; P.focusId = null; P.ab = null; P.chase = false;
    mountPilotBar(match);
    pilotSay("Steering " + next.name + ".");
  }

  let pilotHeld = {};
  let pilotNoteT = 0;
  function pilotSay(text) {
    const note = document.getElementById("pilotNote");
    if (!note) return;
    note.textContent = text;
    note.hidden = false;
    pilotNoteT = 1.6;
  }

  function pilotAxis() {
    const P = fight && fight.match && fight.match.pilot;
    if (!P) return;
    let sx = 0;
    let sy = 0;
    if (pilotHeld.left) sx -= 1;
    if (pilotHeld.right) sx += 1;
    if (pilotHeld.up) sy -= 1;
    if (pilotHeld.down) sy += 1;
    /* A turned floor puts world x down the screen. */
    if (IL.pitCam && IL.pitCam.portrait) { P.mx = sy; P.my = sx; }
    else { P.mx = sx; P.my = sy; }
  }

  const PILOT_DIRS = {
    ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down",
    a: "left", d: "right", w: "up", s: "down", A: "left", D: "right", W: "up", S: "down"
  };

  function onPilotKey(ev) {
    if (!fight || !fight.match || fight.match.over) return;
    const tag = ev.target && ev.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || ev.metaKey || ev.ctrlKey || ev.altKey) return;
    const P = fight.match.pilot;
    if (!P) return;
    const down = ev.type === "keydown";
    if (down && (ev.key === "c" || ev.key === "C")) { ev.preventDefault(); togglePilot(); return; }
    if (P.auto) return;
    const dir = PILOT_DIRS[ev.key];
    if (dir) {
      ev.preventDefault();
      pilotHeld[dir] = down;
      pilotAxis();
      return;
    }
    if (!down) return;
    const k = ev.key.toLowerCase();
    if (k === "q" || k === "1") { ev.preventDefault(); pilotCast(0); }
    else if (k === "e" || k === "2") { ev.preventDefault(); pilotCast(1); }
    else if (k === "r" || k === "3") { ev.preventDefault(); pilotCast(2); }
    else if (ev.key === " ") { ev.preventDefault(); pilotRollNow(); }
    else if (ev.key === "Tab") { ev.preventDefault(); pilotSwap(); }
  }

  function pilotTap(canvas, ev, fx) {
    const match = fight && fight.match;
    const P = match && match.pilot;
    if (!P || P.auto || !fx.cam || !IL.pitToWorld) return;
    const r = canvas.getBoundingClientRect();
    const w = IL.pitToWorld(ev.clientX - r.left, ev.clientY - r.top, fx.cam);
    let foe = null;
    let best = 26;
    match.units.forEach(function (u) {
      if (u.team === 0 || u.hp <= 0) return;
      const d = Math.hypot(u.x - w.x, (u.y - 14) - w.y);
      if (d < best) { best = d; foe = u; }
    });
    if (foe) {
      P.focusId = foe.id;
      P.chase = true;
      P.goX = null;
      return;
    }
    const W = IL.WORLD;
    P.goX = Math.max(W.left, Math.min(W.right, w.x));
    P.goY = Math.max(W.top, Math.min(W.bottom, w.y));
    P.chase = false;
  }

  function paintPilot(match, dt) {
    if (pilotNoteT > 0) {
      pilotNoteT -= dt;
      if (pilotNoteT <= 0) {
        const note = document.getElementById("pilotNote");
        if (note) note.hidden = true;
      }
    }
    const bar = document.getElementById("pilotBar");
    const P = match.pilot;
    if (!bar || bar.hidden || !P || P.auto) return;
    const u = pilotFighter(match);
    if (!u) return;
    if (bar.dataset.pid !== u.id) { mountPilotBar(match); return; }
    const abs = IL.pilotAbs ? IL.pilotAbs(u) : [];
    const btns = bar.querySelectorAll("[data-pilot-ab]");
    for (let i = 0; i < btns.length; i++) {
      const ab = abs[i];
      if (!ab) continue;
      const left = (u.cds && u.cds[ab.id]) || 0;
      const full = (ab.cd || 6.5) * (u.abilityCdMul || 1);
      const frac = Math.max(0, Math.min(1, left / full));
      btns[i].style.setProperty("--cd", (frac * 100).toFixed(1) + "%");
      btns[i].classList.toggle("ready", frac <= 0);
      btns[i].classList.toggle("queued", P.ab === i);
    }
    const roll = bar.querySelector("[data-pilot-roll]");
    if (roll) {
      const frac = Math.max(0, Math.min(1, (u.rollCd || 0) / 2.7));
      roll.style.setProperty("--cd", (frac * 100).toFixed(1) + "%");
      roll.classList.toggle("ready", frac <= 0);
    }
  }

  /* Two speeds: watch it, or a little quicker. ids speed1 and speed15. */
  const SPEEDS = [1, 1.5];
  function speedId(n) { return n === 1.5 ? "15" : String(n); }

  function speedButtons() {
    return SPEEDS.map(function (n) {
      return '<button type="button" class="ctl' + (speed === n ? " on" : "") + '" id="speed' + speedId(n) + '">' + n + '×</button>';
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
      btn.textContent = meterOn ? "Hide info" : "Info";
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
    SPEEDS.forEach(function (n) {
      const el = document.getElementById("speed" + speedId(n));
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
    IL.liveFx = fx;
    function pitPoint(ev) {
      const r = canvas.getBoundingClientRect();
      fx.pointer = { x: ev.clientX - r.left, y: ev.clientY - r.top, stick: ev.type === "pointerdown" || !!fx.stickId };
      if (ev.type === "pointerdown") fx.pointer.stick = true;
    }
    canvas.addEventListener("pointermove", pitPoint);
    canvas.addEventListener("pointerdown", pitPoint);
    canvas.addEventListener("pointerleave", function () { fx.pointer = null; });
    canvas.addEventListener("pointerdown", function (ev) { pilotTap(canvas, ev, fx); });
    pilotHeld = {};
    document.addEventListener("keydown", onPilotKey);
    document.addEventListener("keyup", onPilotKey);
    document.addEventListener("keydown", onOrderKey);
    function dropKeys() {
      document.removeEventListener("keydown", onOrderKey);
      document.removeEventListener("keydown", onPilotKey);
      document.removeEventListener("keyup", onPilotKey);
      pilotHeld = {};
    }
    let last = performance.now();
    let acc = 0;
    function frame(now) {
      if (!alive(tok) || !fight) { dropKeys(); return; }
      const match = fight.match;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      fx.t += dt;
      paintPilot(match, dt);
      if (!match.over && !paused) {
        /* A kill slows the view for a beat; the sim itself is untouched. */
        const beat = (fx.slow || 0) > 0 ? 0.35 : 1;
        acc += dt * speed * ((IL.PACE && IL.PACE.tempo) || 1) * beat;
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
      if (match.over) { dropKeys(); finishFight(); return; }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
  }

  function consume(match, fx) {
    function placeNum(n) {
      /* Fixed sideways jitter, and a step up for each number still fresh
         on the same spot, so 9 and 29 never print as 929. */
      n.jx = Math.round((Math.random() - 0.5) * 22);
      let stack = 0;
      for (let k = 0; k < fx.nums.length; k++) {
        const o = fx.nums[k];
        if (o.t < 0.35 && Math.abs(o.x - n.x) < 16 && Math.abs(o.y - n.y) < 16) stack++;
      }
      n.dy = stack * 13;
      fx.nums.push(n);
    }
    /* Arena fx events carry a head-height y. Find the fighter they belong
       to so pixel FX can sit on the floor and rise up the screen, which
       keeps them right on a turned phone floor too. */
    function footOf(e) {
      let best = null;
      let bestD = 34;
      for (let k = 0; k < match.units.length; k++) {
        const u = match.units[k];
        const up = u.y - e.y;
        if (up < -4 || up > 64) continue;
        const d = Math.abs(u.x - e.x);
        if (d < bestD) { bestD = d; best = u; }
      }
      return best ? best.y : e.y;
    }
    const P = IL.pfx;
    for (let i = 0; i < match.events.length; i++) {
      const e = match.events[i];
      if (P) {
        if (e.type === "swing") P.swing(fx, e);
        else if (e.type === "hit") P.hit(fx, e);
        else if (e.type === "die") P.die(fx, e);
        else if (e.type === "boom") P.boom(fx, e);
      }
      if (e.type === "dmg") {
        placeNum({ x: e.x, y: e.y, n: e.n, blocked: e.blocked, crit: e.crit, team: e.team, t: 0, life: e.crit ? 1.05 : 0.85 });
        /* Amplitude is IL.SHAKE_SCALE in render.js. These stay in raw units. */
        if (typeof e.n === "number" && shakeOn()) fx.shake = Math.min(7, fx.shake + (e.blocked ? 1.5 : 3.2));
      } else if (e.type === "heal") {
        placeNum({ x: e.x, y: e.y, n: e.n, heal: true, team: e.team, t: 0, life: 0.9 });
      } else if (e.type === "death") {
        /* Kill feed and a short slow-motion beat (live view only). */
        let who = null;
        let by = null;
        for (let k = 0; k < match.units.length; k++) {
          const u = match.units[k];
          if (u.id === e.id && u.team === e.team) who = u;
          if (e.by && u.id === e.by && u.team === e.byTeam) by = u;
        }
        if (who && !who.summon) {
          if (!fx.feed) fx.feed = [];
          fx.feed.push({ who: who.name || "?", team: e.team, by: by ? by.name : "", byTeam: by ? by.team : -1, t: 0, life: 4.5 });
          if (fx.feed.length > 6) fx.feed.shift();
          fx.slow = 0.38;
          if (shakeOn()) fx.shake = Math.min(9, fx.shake + 4);
        }
      } else if (e.type === "pilotNo") {
        pilotSay(e.name + " — not yet.");
      } else if (e.type === "pilot") {
        pilotSay("Now steering " + e.name + ".");
        if (fight && fight.match === match) mountPilotBar(match);
      } else if (e.type === "dodge") {
        placeNum({ x: e.x, y: e.y, dodge: true, team: e.team, t: 0, life: 0.6 });
      } else if (e.type === "boom") {
        if (shakeOn()) fx.shake = Math.min(8, fx.shake + 4);
      } else if (e.type === "cue" && e.id) {
        if (IL.sfx) {
          syncMix();
          IL.sfx.play(e.id, { gain: e.gain, layer: e.layer });
        }
      } else if (e.type === "ring" && P) {
        /* Most ring kinds also paint a signature or a boom; only the two
           self-casts without one draw here. */
        if (e.kind === "rage") {
          P.glow(fx, e.x, e.y, 12, 22, "255,90,50", 0.4, 0.8);
          P.burst(fx, e.x, e.y, 6, { pal: "fire", n: 14, speed: [10, 40], g: -60, life: [0.5, 0.9], size: [1.4, 2.4], add: true, floor: 999 });
        } else if (e.kind === "buff") {
          P.heal(fx, e.x, e.y, 14, "255,214,110");
        }
      } else if (e.type === "beam" && P) {
        const fa = footOf({ x: e.x, y: e.y });
        const fb = footOf({ x: e.x2, y: e.y2 });
        if (e.kind === "bolt") {
          P.chain(fx, e.x, fa, fa - e.y, e.x2, fb, fb - e.y2, "255,246,170");
        } else {
          const rgb = e.kind === "fireball" ? "255,140,50" : e.kind === "pierce" ? "200,240,170" : e.kind === "vial" || e.kind === "dot" ? "170,236,80"
            : e.kind === "pull" ? "230,220,190" : e.kind === "drain" ? "235,70,90" : e.kind === "revive" ? "255,236,150" : "200,160,255";
          const turn = !!(IL.pitCam && IL.pitCam.portrait);
          const off = turn ? [fa - fb, e.x - e.x2] : [e.x - e.x2, fa - fb];
          P.streaks(fx, { ax: e.x2, ay: fb, x1: off[0], y1: off[1] - (fa - e.y), x2: 0, y2: -(fb - e.y2), rgb: rgb, n: e.kind === "fireball" ? 2 : 1, gap: 2, life: 0.2, w: e.kind === "fireball" ? 2.6 : 1.6 });
        }
      } else if (e.type === "sig" && P) {
        P.sig(fx, e);
      } else if (e.type === "fx" && P) {
        const fy = footOf(e);
        P.legacy(fx, { kind: e.kind, x: e.x, y: e.y, fy: fy, facing: e.facing, size: e.size, ground: e.ground }, Math.max(0, fy - e.y));
      }
    }
    match.events.length = 0;
  }

  function ageFx(fx, dt) {
    fx.dtLast = dt;
    if (IL.pfx) IL.pfx.step(fx, dt);
    if (fx.slow > 0) fx.slow = Math.max(0, fx.slow - dt);
    if (fx.feed) fx.feed = fx.feed.filter(function (f) { f.t += dt; return f.t < f.life; });
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
    const lb = document.getElementById("leftBar");
    const rb = document.getElementById("rightBar");
    if (lb) lb.style.width = teamHp(match, 0) + "%";
    if (rb) rb.style.width = teamHp(match, 1) + "%";
    const rows = document.querySelectorAll(".fight-screen .live");
    for (let i = 0; i < rows.length; i++) {
      const u = match.units[+rows[i].dataset.i];
      if (!u) continue;
      rows[i].classList.toggle("hot", !!IL.pitFocusId && u.id === IL.pitFocusId);
      rows[i].classList.toggle("dead", u.hp <= 0);
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
      const n = Math.round(u.dmgDealt || 0);
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
    if (match.pilot) match.pilot.auto = true;
    let n = 0;
    while (!match.over && n < 9000) {
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
      if (r.dmg) bits.push(String(Math.round(r.dmg)));
      if (r.heal) bits.push("+" + Math.round(r.heal));
      if (r.uses > 1) bits.push("×" + r.uses);
      return r.name + (bits.length ? " " + bits.join(" ") : "");
    }).join(" · ");
    return '<p class="ab-break">' + esc(text) + "</p>";
  }

  /* v97 Impact: one number for a fighter's part in the fight. */
  function impactOf(u) {
    return Math.max(0, Math.round((u.dmgDealt || 0) + (u.healing || 0) + (u.dmgTaken || 0) * 0.35 + (u.kos || 0) * 60 + (u.assists || 0) * 30 - (u.deaths || 0) * 40));
  }
  function kdaText(u) { return (u.kos || 0) + "/" + (u.deaths || 0) + "/" + (u.assists || 0); }
  function rivalBoard(match) {
    const theirs = match.units.filter(function (u) { return u.team !== 0 && !u.summon; });
    if (!theirs.length) return "";
    return '<details class="res-rivals" id="resRivals"><summary>Their side · K/D/A and Impact</summary>' +
      '<div class="res-rival-rows">' + theirs.map(function (u) {
        const kit = IL.CLASSES[u.cls] || IL.CLASSES.warrior;
        return '<p class="res-rival"><b>' + esc(u.name) + '</b><span>' + esc(kit.name) + '</span><span>K/D/A ' + kdaText(u) + '</span><span>Dealt ' + Math.round(u.dmgDealt || 0) + '</span><span>Taken ' + Math.round(u.dmgTaken || 0) + '</span><span>Heal ' + Math.round(u.healing || 0) + '</span><span>Impact ' + impactOf(u) + '</span></p>';
      }).join("") + '</div></details>';
  }

  function resultTable(match, xpBefore, lvBefore) {
    const yours = match.units.filter(function (u) { return u.team === 0; });
    let mvp = null;
    let best = -1;
    yours.forEach(function (u) {
      const score = impactOf(u);
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
        '<td><div class="xp result-xp" data-xp-from="' + b.prev + '" data-xp-to="' + b.now + '"><div class="track"><div class="fill" style="width:' + Math.round(IL.xpInto(b.prev).frac * 100) + '%"></div></div></div></td>' +
      '</tr>';
    }).join("");
    let topDealt = 1;
    yours.forEach(function (u) { topDealt = Math.max(topDealt, u.dmgDealt || 0, u.dmgTaken || 0, u.healing || 0); });
    const cards = yours.map(function (u) {
      const b = bits(u);
      const bar = function (label, n, cls) {
        return '<span class="res-stat ' + cls + '"><em>' + label + '</em><b>' + Math.round(n) + '</b><i style="width:' + Math.max(2, Math.round(100 * n / topDealt)) + '%"></i></span>';
      };
      return '<article class="result-row' + (b.isMvp ? " mvp" : "") + (u.hp <= 0 ? " down" : "") + '">' +
        '<div class="result-who">' +
          resultFace(u) +
          '<span class="result-name">' + esc(u.name) + "</span>" +
          (b.isMvp ? '<em class="mvp-badge">MVP</em>' : "") +
          (b.up ? '<em class="lv-badge">Level ' + b.lv + "</em>" : "") +
          (fighterById(u.id) && IL.isInjured(fighterById(u.id)) ? '<em class="hurt-badge">Injured · ' + fighterById(u.id).injury.weeks + ' wk</em>' : "") +
        "</div>" +
        '<div class="res-stats">' + bar("Dealt", u.dmgDealt || 0, "dealt") + bar("Taken", u.dmgTaken || 0, "taken") + bar("Heal", u.healing || 0, "heal") +
          '<span class="res-kos"><em>K/D/A</em><b>' + kdaText(u) + '</b></span>' +
          '<span class="res-kos res-imp"><em>Impact</em><b>' + impactOf(u) + '</b></span></div>' +
        abBreakdown(u) +
        (u.ffDealt ? '<p class="fine res-ff">Friendly fire ' + Math.round(u.ffDealt) + '</p>' : '') +
        '<div class="xp result-xp" data-xp-from="' + b.prev + '" data-xp-to="' + b.now + '"><div class="track"><div class="fill" style="width:' + Math.round(IL.xpInto(b.prev).frac * 100) + '%"></div></div><small>Lv ' + b.lv + ' · ' + IL.xpInto(b.now, b.lv).into + '/' + IL.xpInto(b.now, b.lv).need + ' xp</small></div>' +
      "</article>";
    }).join("");
    if (cards) return { mvp: mvp, html: '<div id="resultTable" class="result-board res-cards"><div class="result-rows">' + cards + '</div>' + rivalBoard(match) + '</div>' };
    const legacy = yours.map(function (u) {
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
        '<div class="xp result-xp" data-xp-from="' + b.prev + '" data-xp-to="' + b.now + '"><div class="track"><div class="fill" style="width:' + Math.round(IL.xpInto(b.prev).frac * 100) + '%"></div></div></div>' +
      "</article>";
    }).join("");
    return {
      mvp: mvp,
      html: '<div id="resultTable" class="result-board">' +
        '<table class="board result-grid"><thead><tr><th>Fighter</th><th>Dealt</th><th>Taken</th><th>Heal</th><th>KOs</th><th>XP</th></tr></thead><tbody>' +
        rows + "</tbody></table>" +
        '<div class="result-rows">' + legacy + "</div></div>"
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
        if (fill) fill.style.width = (IL.xpInto(xp).frac * 100) + "%";
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
      score: fight && fight.series ? fight.series.wins[0] + "–" + fight.series.wins[1] : (match.kills[0] || 0) + "–" + foe,
      win: !!win,
      mvp: mvpName || "—",
      mvpImpact: (function () {
        const star = match.units.filter(function (u) { return u.team === 0 && u.name === mvpName; })[0];
        return star ? impactOf(star) : 0;
      })()
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

  /* v77: single-match club records for Intel, and every class faced
     joins the Archive. */
  function noteRecord(key, n, name) {
    if (!(n > 0)) return;
    if (!save.records || typeof save.records !== "object") save.records = {};
    const cur = save.records[key];
    if (!cur || n > cur.n) save.records[key] = { n: Math.round(n), name: name, season: save.season };
  }

  function noteRecords(match, win) {
    const byId = {};
    (save.roster || []).forEach(function (f) { if (f && f.id) byId[f.id] = f; });
    if (!Array.isArray(save.seenClasses)) save.seenClasses = [];
    match.units.forEach(function (u) {
      if (u && u.team !== 0 && u.cls && IL.CLASSES[u.cls] && save.seenClasses.indexOf(u.cls) < 0) save.seenClasses.push(u.cls);
    });
    match.units.forEach(function (u) {
      if (!u || u.team !== 0) return;
      noteRecord("dealt", u.dmgDealt || 0, u.name);
      noteRecord("kos", u.kos || 0, u.name);
      noteRecord("heal", u.healing || 0, u.name);
      noteRecord("taken", u.dmgTaken || 0, u.name);
      const f = byId[u.id];
      if (!f) return;
      const career = ensureCareer(f);
      if (win) f.wins = (f.wins || 0) + 1;
      else f.losses = (f.losses || 0) + 1;
      f.kos = (f.kos || 0) + (u.kos || 0);
      if (!f.season) f.season = { dealt: 0, taken: 0, heal: 0, kos: 0 };
      /* v98 season Impact, assists and deaths, for the Intel boards. */
      f.season.impact = (f.season.impact || 0) + impactOf(u);
      f.season.assists = (f.season.assists || 0) + (u.assists || 0);
      f.season.deaths = (f.season.deaths || 0) + (u.deaths || 0);
      f.season.games = (f.season.games || 0) + 1;
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
    /* v104 a series: record the round; break between rounds, or fold every
       round's numbers into this match before the payout. */
    const ser = fight.series;
    if (ser && !ser.done) {
      ser.wins[match.winner === 0 ? 0 : 1] += 1;
      ser.log.push(match.winner === 0 ? "W" : "L");
      ser.round += 1;
      if (!ser.quick && ser.wins[0] < ser.need && ser.wins[1] < ser.need) {
        stashSeries(ser, match);
        seriesBreak(ser);
        return;
      }
      ser.done = true;
      foldSeries(ser, match);
      if (ser.wins[0] !== ser.wins[1]) match.winner = ser.wins[0] > ser.wins[1] ? 0 : 1;
    }
    const win = match.winner === 0;
    const pf = match.kills[0] || 0;
    const pa = match.units.filter(function (u) { return u.team === 0 && u.hp <= 0; }).length;
    const mode = fight.mode || "league";
    let gold = win ? 40 + 10 * fight.size : 16;
    let renown = win ? 6 + fight.size : 2;
    let xp = win ? 22 : 8;
    let headline = win ? "The pit is yours" : "They walk out";
    if (ser && ser.done && ser.log.length > 1) headline = (win ? "Series won " : "Series lost ") + ser.wins[0] + "–" + ser.wins[1];
    let relicNote = "";
    if (mode === "champions") {
      const cup = save.champs;
      const opp = cup && IL.cupOpponent(cup);
      const wasFinal = cup && cup.round >= 1;
      if (opp) IL.noteCupResult(cup, opp.pair, win ? "you" : opp.foe.id);
      if (cup) {
        IL.resolveOtherPairs(cup, save.roster, takeRng());
        IL.advanceCup(cup);
        IL.settleCup(cup, save.roster, takeRng());
      }
      xp = win ? 30 : 12;
      if (!win) {
        gold = wasFinal ? 80 : 40;
        renown = wasFinal ? 14 : 7;
        headline = wasFinal ? "The Champions final slips away" : "Out of the Champions Cup";
      } else if (cup && cup.champion === "you") {
        gold = 160;
        renown = 30;
        xp = 40;
        save.tokens = (save.tokens || 0) + 1;
        save.champsWon = (save.champsWon || 0) + 1;
        headline = "Champions of the " + IL.DIVISIONS[IL.divisionOf(save)].name;
        const relic = IL.offerRelic(save, takeRng());
        if (relic) {
          relicNote = " Relic: " + relic.name + ".";
          holdClubRelic(relic);
        }
      } else {
        gold = 50;
        renown = 9;
        headline = "Through to the Champions final";
      }
    } else if (mode === "cup") {
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
        gold = cup.mid ? 150 : 90;
        renown = cup.mid ? 28 : 18;
        xp = cup.mid ? 45 : 30;
        save.tokens = (save.tokens || 0) + 1;
        headline = cup.mid ? "MidCup champions" : "The cup is yours";
        if (cup.mid) save.midWon = save.season;
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
    } else if (mode === "draft") {
      const d = save.draft;
      const dc = d && d.cup;
      const dopp = dc && IL.cupOpponent(dc);
      const wasFinal = dc && dc.round >= 1;
      if (dopp) IL.noteCupResult(dc, dopp.pair, win ? "you" : dopp.foe.id);
      if (dc) {
        IL.resolveOtherPairs(dc, d.picks, takeRng());
        IL.advanceCup(dc);
        let guard = 0;
        while (!dc.champion && !IL.cupOpponent(dc) && guard < 3) {
          IL.resolveOtherPairs(dc, d.picks, takeRng());
          IL.advanceCup(dc);
          guard++;
        }
      }
      if (!win) {
        gold = wasFinal ? 45 : 20;
        renown = wasFinal ? 8 : 3;
        headline = wasFinal ? "The draft final slips away" : "Out of the draft";
        if (d) d.stage = "done";
      } else if (dc && dc.champion === "you") {
        gold = 80;
        renown = 14;
        headline = "Draft champions";
        save.draftsWon = (save.draftsWon || 0) + 1;
        if (d) d.stage = "sign";
      } else {
        gold = 18;
        renown = 4;
        headline = "Through to the draft final";
      }
    } else if (mode === "academy") {
      const mul = IL.DIVISIONS[IL.divisionOf(save)].purse;
      gold = Math.round((win ? 10 : 4) * mul);
      renown = win ? 2 : 1;
      xp = win ? 16 : 6;
      IL.recordAcademy(save, fight.academyClub, win, takeRng());
      headline = win ? "The academy wins · +1 Development Tome" : "The academy learns";
    } else if (mode === "thunder") {
      const order = IL.placings(match);
      const place = order.indexOf(0) + 1;
      const t = IL.scoreThunder(save, order);
      const mul = IL.DIVISIONS[IL.divisionOf(save)].purse;
      gold = Math.round([30, 18, 10, 5][place - 1] * mul);
      renown = [5, 3, 2, 1][place - 1];
      headline = place === 1 ? "Last club standing" : "Placed " + (place === 2 ? "2nd" : place === 3 ? "3rd" : "4th") + " in the round";
      if (t && t.done) {
        const pay = IL.THUNDER_PAY[t.finish - 1];
        gold += Math.round(pay.gold * mul);
        renown += pay.renown;
        xp += pay.xp;
        headline = t.finish === 1 ? "The Thunder Cup is yours" : "Thunder Cup: finished " + (t.finish === 2 ? "2nd" : t.finish === 3 ? "3rd" : "4th");
        logClub("Chaos Thunder Cup finished " + (t.finish === 1 ? "1st" : t.finish === 2 ? "2nd" : t.finish === 3 ? "3rd" : "4th") + ".");
        if (t.finish === 1) save.cupsWon = (save.cupsWon || 0) + 1;
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
    } else if (mode === "gate") {
      const run = save.gateRun || { floor: 1, hp: {}, chests: 0 };
      const floor = run.floor || 1;
      const bossFloor = !!IL.GATE_BOSSES[floor];
      xp = win ? 10 + floor * 2 : 6;
      renown = win ? (bossFloor ? 4 : 1) : 1;
      if (win) {
        gold = 10 + floor * 4;
        headline = bossFloor ? IL.GATE_BOSSES[floor] + " falls" : "Floor " + floor + " cleared";
        if (bossFloor) {
          const chest = IL.gateChest(save, takeRng(), floor);
          gold += chest.gold;
          run.chests = (run.chests || 0) + 1;
          if (chest.relic) {
            const relic = IL.relicById(chest.relic);
            if (relic) { holdClubRelic(relic); relicNote = " Chest: " + chest.gold + " gold and " + relic.name + "."; }
          } else {
            if (chest.item) { if (!Array.isArray(save.items)) save.items = []; save.items.push(chest.item); }
            relicNote = " Chest: " + chest.gold + " gold" + (chest.item ? " and " + IL.itemName(chest.item) : "") + ".";
          }
        }
        run.hp = hpFractions(match);
        run.floor = floor + 1;
        save.gateRun = run;
        if (floor >= IL.GATE_FLOORS) {
          headline = "The Iron Gate is broken";
          save.gateClears = (save.gateClears || 0) + 1;
          renown += 10;
          endGate();
          save.gateBest = IL.GATE_FLOORS;
          save.gateSeason = save.season;
          save.gateSeasonBest = IL.GATE_FLOORS;
        }
      } else {
        gold = 4 + floor * 2;
        headline = "Turned back on floor " + floor;
        endGate();
      }
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
      if (mode === "league") {
        if (fight.rival && IL.rivalTire) IL.rivalTire(fight.rival, fight.right);
        if (!Array.isArray(save.recentRoles)) save.recentRoles = [];
        save.recentRoles.unshift((fight.left || []).map(function (f) { return (IL.CLASSES[f.cls] || IL.CLASSES.warrior).role; }));
        save.recentRoles = save.recentRoles.slice(0, 3);
      }
      recordRound(win, pf, pa);
      /* Higher divisions pay more for the same match. */
      const purseMul = IL.DIVISIONS[IL.divisionOf(save)].purse;
      gold = Math.round(gold * purseMul);
      const sm = save.mods || [];
      if (mode === "league" && sm.indexOf("purse") >= 0) gold = Math.round(gold * 1.3);
      if (mode === "league" && sm.indexOf("lean") >= 0) { gold = Math.round(gold * 0.8); xp = Math.round(xp * 1.25); }
      renown = Math.round(renown * purseMul);
    }
    const renownPack = IL.relicPack(save, fight.left || []);
    const renownOn = renownPack.club.concat(renownPack.sets).some(function (r) { return r.kind === "renown"; })
      || Object.keys(renownPack.worn).some(function (id) { return (renownPack.worn[id] || []).some(function (r) { return r && r.kind === "renown"; }); });
    if (renownOn) renown = Math.round(renown * 1.25);
    gold += match.stats.bounty || 0;
    if (IL.DIFFICULTY && mode !== "challenge" && mode !== "daily") gold = Math.round(gold * IL.DIFFICULTY[IL.difficultyOf(save)].gold);
    /* v101 staff: Treasurer on league and cup gold, Trainer on all match XP. */
    if (IL.staffStars) {
      if (mode === "league" || mode === "cup" || mode === "champions") gold = Math.round(gold * (1 + 0.04 * IL.staffStars(save, "treasurer")));
      xp = Math.round(xp * (1 + 0.04 * IL.staffStars(save, "trainer")));
    }
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
      if ((f.level || 1) > (before[f.id] || 1)) logClub(f.name + " reached level " + f.level + ".");
    });
    /* v75 Barracks: the bench takes a share of the lineup's match XP. */
    const share = IL.benchShare ? IL.benchShare(save) : 0;
    if (share > 0 && xp > 0 && (mode === "league" || mode === "cup" || mode === "champions")) {
      const inFight = {};
      fight.left.forEach(function (f) { if (f) inFight[f.id] = true; });
      (save.roster || []).forEach(function (f) { if (!inFight[f.id]) IL.grantXp(f, Math.max(1, Math.round(xp * share))); });
    }
    /* v100 a fighter knocked out in a league, cup or Champions Cup match may be injured. */
    if (mode === "league" || mode === "cup" || mode === "champions") {
      const irng = takeRng();
      match.units.forEach(function (u) {
        if (!u || u.team !== 0 || u.summon || !(u.deaths > 0)) return;
        const f = fighterById(u.id);
        const weeks = f ? IL.rollInjury(save, f, irng) : 0;
        if (weeks) logClub(f.name + " was injured: out for " + weeks + " league week" + (weeks === 1 ? "" : "s") + ".");
      });
    }
    const tally = resultTable(match, xpBefore, before);
    if (tally.mvp && tally.mvp.team === 0) {
      const star = fighterById(tally.mvp.id);
      if (star) star.mvps = (star.mvps || 0) + 1;
    }
    pushHistory(match, win, tally.mvp ? tally.mvp.name : "");
    save.gold += gold;
    save.renown = (save.renown || 0) + renown;
    let loot = null;
    const eventLoot = (mode === "boss" && win) || (mode === "horde" && win) || (mode === "daily" && win) || (mode === "gauntlet" && win && !save.gauntlet);
    if (mode === "league" || mode === "chaos" || ((mode === "cup" || mode === "champions") && win) || eventLoot) {
      const bag = mode === "cup" || mode === "champions" ? "cup" : (win ? "win" : "loss");
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
    const restLine = (mode === "league" || mode === "cup" || mode === "champions") ? tireAndRest(fight.left) : "";
    let marketLines = [];
    if (mode === "league" || mode === "cup") {
      marketLines = IL.turnMarket(save, takeRng(), rosterAvoid());
      save.marketNews = marketLines.slice();
    }
    if (restLine || marketLines.length) persist();
    const stood = match.units.filter(function (u) { return u.team === 0 && u.hp > 0; }).map(function (u) { return u.name; });
    const fell = match.units.filter(function (u) { return u.team === 0 && u.hp <= 0; }).map(function (u) { return u.name; });
    let nextLine = "";
    if (mode === "league") {
      if (seasonDone()) nextLine = "The season board is closed.";
      else {
        const nxt = nextRival();
        const nsize = weekSize(save.round);
        nextLine = "Next is match " + (save.round + 1) + " of " + seasonWeeks() + " · " + nsize + " vs " + nsize + (nxt ? " against " + nxt.name : "") + ".";
      }
    } else if (mode === "cup") {
      nextLine = save.cup && save.cup.champion ? "The bracket is finished." : "The bracket is waiting on the cup screen.";
    } else if (mode === "champions") {
      nextLine = champsPending() ? "The Champions final is next." : "The Champions Cup is over: " + (champsName(save.champs) || "—") + ". The ceremony is open.";
    } else if (mode === "draft") {
      const st = save.draft && save.draft.stage;
      nextLine = st === "sign" ? "Sign one of your picks on the cup tab." : st === "bracket" ? "The draft final is waiting on the cup tab." : "The draft is over. Your picks go home.";
    } else if (mode === "gate") {
      nextLine = save.gateRun ? "Floor " + save.gateRun.floor + " of " + IL.GATE_FLOORS + " is next" + (IL.GATE_BOSSES[save.gateRun.floor] ? ": " + IL.GATE_BOSSES[save.gateRun.floor] + "." : ". Health carries over.") : "The Iron Gate opens again next week.";
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
    const levelUps = pendingGrowth().reduce(function (n, f) { return n + (f.pendingLevels || 0); }, 0);
    const kos = match.kills || [];
    const notes = [];
    if (relicNote) notes.push(relicNote.trim());
    if (restLine) notes.push(restLine);
    if (mode === "league" || mode === "cup") notes.push("The fighter board turned over" + (marketLines.length ? ": " + marketLines.join(" ") : "."));
    const standLine = (stood.length ? "Still standing: " + stood.join(", ") + "." : "") + (fell.length ? (stood.length ? " " : "") + "Down: " + fell.join(", ") + "." : "");
    box.innerHTML =
      '<div class="result-scroll">' +
        '<header class="res-hero ' + (win ? "win" : "loss") + '">' +
          '<p class="eyebrow">' + (win ? "Victory" : "Defeat") + ' · ' + esc(modeLabel(mode)) + '</p>' +
          '<h2>' + headline + '</h2>' +
          ((match.teams || 2) === 2
            ? '<p class="res-score">' + crestHtml(match.leftName, "sm", save.crest, save.plate) + '<b>' + esc(match.leftName) + '</b><span class="res-ko">' + (kos[0] || 0) + ' – ' + (kos[1] || 0) + '</span><b>' + esc(match.rightName) + '</b>' + crestHtml(match.rightName, "sm", crestIndexOf(match.rightName)) + '</p>'
            : '') +
          '<p class="fine">' + Math.floor(match.time) + ' seconds in the pit</p>' +
        '</header>' +
        '<div class="res-rewards" id="rewards">' +
          '<div class="res-tile gold-tile">' + coinIcon("gold") + '<b>+' + gold + '</b><span>gold</span></div>' +
          '<div class="res-tile renown-tile">' + coinIcon("renown") + '<b>+' + renown + '</b><span>renown</span></div>' +
          '<div class="res-tile xp-tile"><i class="res-glyph">✦</i><b>+' + xp + '</b><span>xp each</span></div>' +
          (loot ? '<div class="res-tile loot-tile">' + lootRevealHtml(loot) + '</div>' : '') +
        '</div>' +
        (levelUps ? '<p class="res-levelup" id="resLevelUp"><span class="lv-badge">Level up</span> ' + esc(levelBannerText()) + '</p>' : '') +
        tally.html +
        '<details class="res-more"' + (notes.length ? '' : '') + '><summary>Match notes</summary>' +
          '<ul class="payout">' + notes.map(function (n) { return '<li class="rest-line">' + esc(n) + '</li>'; }).join("") + '</ul>' +
          (standLine ? '<p>' + esc(standLine) + '</p>' : '') +
        '</details>' +
        '<p class="fine res-next">' + esc(nextLine) + '</p>' +
      '</div>' +
      '<div class="result-actions">' +
        (levelUps ? '<button type="button" class="btn gold" id="pickPerk">Level up · ' + levelUps + '</button>' : '') +
        ((mode === "endless" && win && save.endlessPick && save.endlessPick.length) ? relicPickHtml() : '') +
        (((mode === "endless" && win && !(save.endlessPick && save.endlessPick.length)) || (mode === "gauntlet" && win && save.gauntlet) || (mode === "gate" && win && save.gateRun))
          ? '<button type="button" class="btn fight" id="nextWave">' + (mode === "gauntlet" ? "Next fight" : mode === "gate" ? "Floor " + save.gateRun.floor : "Next wave") + '</button>' : '') +
        '<button type="button" class="btn ' + (levelUps ? 'ghost res-continue' : 'primary') + '" id="backHub">' + (fight.returnTab === "events" ? "Back to events" : fight.returnTab === "cup" ? "Back to compete" : "Continue") + '</button>' +
      '</div>';
    bootCards(match.units.map(function (u) { return u && u.parts; }));
    mountIcons(box);
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
      if ((mode === "league" || mode === "champions") && seasonDone()) showSeasonEnd();
      else if (mode === "cup") showCup();
      else showHub(fight.returnTab || "club");
    };
    const nextWave = document.getElementById("nextWave");
    if (nextWave) nextWave.onclick = function () {
      IL.currentMatch = null;
      if (mode === "gauntlet") launchGauntletStep();
      else if (mode === "gate") launchGateFloor();
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
        /* v71: the calendar and the form column read these. */
        if (!Array.isArray(save.leagueLog)) save.leagueLog = [];
        save.leagueLog[save.round] = { season: save.season, win: !!win, pf: pf, pa: pa, opp: them.id };
        you.form = (you.form || []).concat(win ? "W" : "L").slice(-5);
        them.form = (them.form || []).concat(win ? "L" : "W").slice(-5);
        if (save.streakSeason !== save.season) { save.streakSeason = save.season; save.streak = 0; save.streakBest = 0; }
        save.streak = win ? (save.streak || 0) + 1 : 0;
        save.streakBest = Math.max(save.streakBest || 0, save.streak);
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
        a.form = (a.form || []).concat(awin ? "W" : "L").slice(-5);
        b.form = (b.form || []).concat(awin ? "L" : "W").slice(-5);
        if (awin) { a.w++; a.pts += 3; a.pf += gf; a.pa += ga; b.l++; b.pf += ga; b.pa += gf; }
        else { b.w++; b.pts += 3; b.pf += ga; b.pa += gf; a.l++; a.pf += gf; a.pa += ga; }
      }
    });
    save.round += 1;
    if (IL.tickInjuries) IL.tickInjuries(save).forEach(function (n) { logClub(n + " is fit again."); });
    if (IL.tickLoans) IL.tickLoans(save, returnGear).forEach(logClub);
    if (IL.openThunder) {
      const tc = IL.openThunder(save, takeRng());
      if (tc) logClub("The Chaos Thunder Cup opens: " + tc.size + "v" + tc.size + "v" + tc.size + "v" + tc.size + ", three rounds.");
    }
    save.trainsLeft = IL.drillCap ? IL.drillCap(save) : (IL.TRAIN_CAP || 2);
    save.trainRound = save.round;
    if (IL.rollGearStock) save.gearStock = IL.rollGearStock(takeRng());
  }

  function modeLabel(mode) {
    return { league: "League", cup: "Cup", draft: "Draft cup", chaos: "Chaos pit", thunder: "Thunder Cup", academy: "Academy", boss: "Weekly boss", gauntlet: "Gauntlet", horde: "Horde", king: "King of the pit", mirror: "Mirror", daily: "Daily", challenge: "Friend fight", endless: "Endless" }[mode] || "Fight";
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
      if (document.getElementById("fightMenu")) {
        ev.preventDefault();
        fightMenuOpen = false;
        refreshHub();
        return;
      }
      if (document.getElementById("codexSheet")) {
        ev.preventDefault();
        codexOpen = null;
        refreshHub();
        return;
      }
      if (document.getElementById("inboxSheet")) {
        ev.preventDefault();
        inboxOpen = false;
        refreshHub();
        return;
      }
      if (document.getElementById("identitySheet")) {
        ev.preventDefault();
        identityOpen = false;
        refreshHub();
        return;
      }
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
    if (nextTab === hubTab) resetPane(nextTab);
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
