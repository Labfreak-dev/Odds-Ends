
/* =================== END ADDED MODES =================== */

const UI_GAMES = [
  { id:"hunt",    name:"The Hunt",    icon:"🗡️", desc:"Every tap fuels the fight. Beasts without end, a blade forged in ingots, and embers for the brave.", meta:"Endless clicker" },
  { id:"fishing", name:"Fishing",     icon:"🎣", desc:"Cast a line. The water pays out in Credits — some catches handsomely.", meta:"Hold, hook & fight" },
  { id:"poker",   name:"Poker Rush",  icon:"🃏", desc:"The stack rises. Make poker hands. Jokers go off.",   meta:"Arcade" },
  { id:"casino",  name:"Risk it All", icon:"🎰", desc:"Six ways to lose it, and a few to win big.",          meta:"6 games" },
  { id:"provenance",  name:"Provenance",   icon:"🗃️", desc:"An archive record with the name struck out. Four cards. Name the thing.", meta:"1,215 subjects" },
  { id:"connections", name:"Connections",  icon:"🧩", desc:"Sixteen cards, four groups of four. Everything you need is on the cards.", meta:"Daily-style puzzle" },
  { id:"showcase",    name:"The Case",     icon:"🗄️", desc:"Five slots, each with a rule. Twelve cards. Make them fit.", meta:"Constraint puzzle" },
  { id:"oddone",      name:"Odd One Out",  icon:"👀", desc:"Three belong together, one doesn't. Ten seconds.", meta:"Fast rounds" },
  { id:"press",       name:"The Press",    icon:"⚙️", desc:"Spare prints in, one good print out. Merge tiers until the plate jams.", meta:"Duplicate sink" },
  /* Runeshard entry removed - it ships as its own build. */
];
const UI_GAME_IDS = UI_GAMES.map(g=>g.id);
const UI_SECTIONS = ["mining","packs","upgrades","market","empire","play","collection","account"].concat(UI_GAME_IDS);
function uiShowSection(id){
  UI_SECTIONS.forEach(t=>{
    const el = document.getElementById("tab-"+t);
    if(el) el.style.display = (t === id) ? "block" : "none";
  });
}
function uiLeaveGames(except){
  /* Runeshard removed from this build; rsOnLeaveTab no longer exists. */
  if(except!=="provenance") pvOnLeaveTab();
  if(except!=="press") prOnLeaveTab();
  if(except!=="connections") cxOnLeaveTab();
  if(except!=="showcase") csOnLeaveTab();
  if(except!=="oddone") ooOnLeaveTab();
  if(except!=="siege") sgOnLeaveTab();
  if(except!=="raids") rdOnLeaveTab();
  if(except!=="poker") pkOnLeaveTab();
  if(except!=="arena") arOnLeaveTab();
  if(except!=="fishing") fshOnLeaveTab();
  if(except!=="casino"){
    if(typeof rocketAbortIfIdle === "function") rocketAbortIfIdle();
    stopAllCasinoAuto();
  }
}
function uiEnterSection(id){
  if(id==="collection") renderCollection();
  else if(id==="upgrades") renderUpgrades();
  else if(id==="market"){ renderMarket(); renderTackleShop(); }
  else if(id==="empire") renderEmpire();
  else if(id==="account") renderAccount();
  else if(id==="play") renderPlayLobby();
  else if(id==="siege"){ renderSiege(); sgOnEnterTab(); }
  else if(id==="raids"){ renderRaids(); rdOnEnterTab(); }
  else if(id==="poker"){ renderPoker(); pkOnEnterTab(); }
  else if(id==="arena"){ renderArena(); arOnEnterTab(); }
  else if(id==="fishing"){ renderFishing(); fshOnEnterTab(); }
  else if(id==="casino"){ renderCasino(); brShowLobby(); }
  else if(id==="provenance"){ pvOnEnterTab(); }
  else if(id==="press"){ prOnEnterTab(); }
  else if(id==="connections"){ cxOnEnterTab(); }
  else if(id==="showcase"){ csOnEnterTab(); }
  else if(id==="oddone"){ ooOnEnterTab(); }
  else if(id==="dungeon"){ renderDungeon(); }
  uiLeaveGames(id);
  uiInitStatStrips();
  uiInitHelp();
}
function uiSetNavActive(tab){
  document.querySelectorAll("nav button").forEach(b=>b.classList.toggle("active", b.dataset.tab === tab));
  const gear = document.getElementById("hdrGear");
  if(gear) gear.classList.toggle("active", tab === "account");
}
function uiSwitchTab(tab){
  uiSetNavActive(tab);
  const bb = document.getElementById("playBack");
  if(bb) bb.style.display = "none";
  uiShowSection(tab);
  uiEnterSection(tab);
}
function uiOpenGame(id){
  const g = UI_GAMES.find(x=>x.id === id);
  if(!g) return;
  uiSetNavActive("play");
  uiShowSection(id);
  const bb = document.getElementById("playBack");
  if(bb){
    bb.style.display = "flex";
    document.getElementById("playBackTitle").textContent = `${g.icon} ${g.name}`;
  }
  uiEnterSection(id);
  try{ window.scrollTo({ top:0, behavior:"smooth" }); }catch(e){ window.scrollTo(0,0); }
}
function uiBackToPlay(){ uiSwitchTab("play"); }
/* The browser can end this page without warning - an iOS tab reaped for
   memory, a swipe out of the app switcher, a closed laptop. 'pagehide' is the
   only event that reliably fires in all of those on Safari; 'beforeunload' is
   not dispatched on iOS at all. The save gets flushed here. */
(function installSaveGuards(){
  function flushAll(){
    try{ saveState(); }catch(e){}
  }
  window.addEventListener("pagehide", flushAll);
  window.addEventListener("beforeunload", flushAll);
  document.addEventListener("visibilitychange", function(){
    if(document.hidden) flushAll();
  });
  /* Safari/Chrome may 'freeze' a backgrounded tab; last call before it does. */
  document.addEventListener("freeze", flushAll);
})();

/* ---- backup file ---------------------------------------------------------- */
function buildBackup(){
  return JSON.stringify({
    game:"oddsandends", format:2, savedAt:new Date().toISOString(),
    main: state
  });
}
function saveIoMsg(text, ok){
  const el = document.getElementById("saveIoResult");
  if(!el) return;
  el.style.color = ok ? "var(--good)" : "var(--bad)";
  el.textContent = text;
}
function exportSaveFile(){
  try{
    const text = buildBackup();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], {type:"application/json"}));
    a.download = "oddsandends-backup-" + new Date().toISOString().slice(0,10) + ".json";
    document.body.appendChild(a); a.click();
    setTimeout(()=>{ try{ URL.revokeObjectURL(a.href); }catch(e){} a.remove(); }, 1000);
    saveIoMsg("Backup downloaded.", true);
  }catch(e){ saveIoMsg("Download failed: " + e.message + " — try Copy instead.", false); }
}
function copySaveText(){
  const text = buildBackup();
  const ok = ()=>saveIoMsg("Copied. Paste it into Notes or send it to yourself.", true);
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(ok).catch(()=>textSelectFallback(text));
  } else textSelectFallback(text);
}
function textSelectFallback(text){
  const box = document.getElementById("savePasteBox");
  if(!box){ saveIoMsg("Copying isn't supported here.", false); return; }
  const d = box.closest("details"); if(d) d.open = true;
  box.value = text; box.focus();
  try{ box.setSelectionRange(0, text.length); }catch(e){}
  saveIoMsg("Couldn't copy automatically — it's selected below, choose Copy.", false);
}
function applyBackup(raw){
  let d;
  try{ d = JSON.parse(raw); }catch(e){ saveIoMsg("That isn't a backup file.", false); return; }
  const main = d && (d.main || d.state || (typeof d.credits !== "undefined" ? d : null));
  if(!main || typeof main !== "object" || typeof main.credits === "undefined"){
    saveIoMsg("That file has no save data in it.", false); return;
  }
  if(!confirm("Replace ALL current progress with this backup?")) return;
  try{
    localStorage.setItem(SAVE_KEY, JSON.stringify(main));
    state = loadState();
    saveState(); renderAll();
    saveIoMsg("Restored.", true);
    showToast("💾 Backup restored.");
  }catch(e){ saveIoMsg("Restore failed: " + e.message, false); }
}
function importSaveFile(input){
  const f = input.files && input.files[0];
  if(!f) return;
  const r = new FileReader();
  r.onload  = ()=>{ applyBackup(String(r.result)); input.value = ""; };
  r.onerror = ()=>{ saveIoMsg("Couldn't read that file.", false); input.value = ""; };
  r.readAsText(f);
}
function importSavePaste(){
  const box = document.getElementById("savePasteBox");
  if(!box || !box.value.trim()){ saveIoMsg("Paste a backup in first.", false); return; }
  applyBackup(box.value.trim());
}

/* Shelves for the Play lobby. A game's home is looked up by id rather than
   stored on the UI_GAMES entry, because that array is assembled from two
   places (the host below + integrate.py's registry splice) - keeping the
   grouping in one map means adding a mode never has to touch both. */
const PLAY_GROUPS = [
  { id:"outdoor", title:"Outdoor & idle", blurb:"Play while something else ticks along." },
  { id:"arcade",  title:"Arcade",         blurb:"Short sessions, louder payouts." },
  { id:"puzzle",  title:"Puzzles",        blurb:"Think, then collect." },
];
const PLAY_GROUP_OF = {
  fishing:"outdoor", hunt:"outdoor", press:"outdoor",
  poker:"arcade", casino:"arcade", oddone:"arcade",
  provenance:"puzzle", connections:"puzzle", showcase:"puzzle",
};
function renderPlayLobby(){
  const grid = document.getElementById("playGrid");
  if(!grid) return;
  const cardHtml = (g, groupId)=>`
    <button class="play-card" data-game="${g.id}" data-group="${groupId}">
      <span class="pi">${g.icon}</span>
      <span class="pn">${g.name}</span>
      <span class="pd">${g.desc}</span>
      <span class="pmeta">${g.meta}</span>
    </button>`;
  /* A game missing from PLAY_GROUP_OF falls into the last shelf rather than
     vanishing from the lobby - a new mode showing up in the wrong group is a
     nuisance, one that never renders is a bug nobody notices. */
  grid.innerHTML = PLAY_GROUPS.map((grp, gi)=>{
    const isLast = gi === PLAY_GROUPS.length - 1;
    const games = UI_GAMES.filter(g=>{
      const home = PLAY_GROUP_OF[g.id];
      return home === grp.id || (isLast && !home);
    });
    if(!games.length) return "";
    return `
    <section class="play-group" data-group="${grp.id}">
      <div class="play-group-head"><h3>${grp.title}</h3><span>${grp.blurb}</span></div>
      <div class="play-grid">${games.map(g=>cardHtml(g, grp.id)).join("")}</div>
    </section>`;
  }).join("");
  grid.querySelectorAll("[data-game]").forEach(b=>
    b.addEventListener("click", ()=>uiOpenGame(b.dataset.game)));
  const blurb = document.getElementById("playBlurb");
  if(blurb){
    const WORDS = ["Zero","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve"];
    const n = grid.querySelectorAll("[data-game]").length;
    blurb.textContent = `${WORDS[n] || n} ways to turn credits into more credits \u2014 or into a very good story.`;
  }
}
document.querySelectorAll("nav button").forEach(btn=>{
  btn.addEventListener("click", ()=>uiSwitchTab(btn.dataset.tab));
});
(function(){
  const gear = document.getElementById("hdrGear");
  if(gear) gear.addEventListener("click", ()=>uiSwitchTab("account"));
})();

/* Runeshard removed - see runeshard.html for that build. */


/* ---------------- INIT ---------------- */
/* Each panel is isolated: if one throws, the rest of the app still comes up and
   the failure is reported instead of silently blanking the screen. */
function safeRender(label, fn){
  try { fn(); }
  catch(e){
    console.error("[render] " + label + " failed:", e);
    if(!window.__renderFails) window.__renderFails = [];
    window.__renderFails.push(label + ": " + e.message);
    showRenderWarning();
  }
}
function showRenderWarning(){
  let el = document.getElementById("renderWarn");
  if(!el){
    el = document.createElement("div");
    el.id = "renderWarn";
    el.style.cssText = "position:fixed;bottom:12px;left:12px;right:12px;z-index:9998;background:rgba(90,20,20,.96);"
      + "border:1px solid #ff5c5c;border-radius:12px;padding:11px 14px;font-size:12.5px;color:#ffd9d9;line-height:1.5;";
    document.body.appendChild(el);
  }
  el.innerHTML = "⚠️ Some panels failed to draw: <b>" + (window.__renderFails||[]).join(" · ")
    + "</b><br>The rest of the game still works. "
    + "<button onclick=\"this.parentNode.remove()\" style=\"margin-top:6px;background:#2b3142;color:#fff;border:1px solid #555;"
    + "border-radius:8px;padding:4px 10px;font-family:inherit;cursor:pointer;\">Dismiss</button>";
}

function renderAll(){
  safeRender("header",     renderHeader);
  safeRender("dev tools",  renderDevTools);
  safeRender("packs",      renderPackShelf);
  safeRender("collection", renderCollection);
  safeRender("rarity",     renderRarityTable);
  safeRender("sets",       renderSetTable);
  safeRender("mining",     renderMiningStats);
  safeRender("mine bonus", renderMineBoostTable);
  safeRender("mine scene", renderMiningScene);
  safeRender("upgrades",   renderUpgrades);
  safeRender("market",     renderMarket);
  safeRender("empire",     renderEmpire);
  safeRender("siege",      renderSiege);
  safeRender("fishing",    renderFishing);
  safeRender("tackle",     renderTackleShop);
  safeRender("account",    renderAccount);
  safeRender("casino",     renderCasino);
  safeRender("arena",      renderArena);
  safeRender("raids",      renderRaids);
  safeRender("provenance",  renderProvenance);
  safeRender("press",       renderPress);
  safeRender("connections", renderConnections);
  safeRender("showcase",    renderCase);
  safeRender("oddone",      renderOddOne);
  safeRender("play",       renderPlayLobby);
  safeRender("chrome",     ()=>{ uiInitStatStrips(); uiInitHelp(); });
}
safeRender("filters",        populateFilters);
safeRender("account filters",populateAccountFilters);
safeRender("settings",       populateSettingsUI);
safeRender("offline mining", applyOfflineMining);
safeRender("xp migrate",     migratePlayerXP);
safeRender("xp recompute",   recomputePlayerXP);
safeRender("lottery",        resolveLotteryDraws);
renderAll();
try{ saveState(); }catch(e){ console.error("saveState failed", e); }
setInterval(mineTick, 1000);

/* ---------------- START SCREEN: the crest, a rain of cards, tap to start ----
   The overlay is in the markup so it paints first; this fills it with the
   game's own cards (real frames, real paintings) and takes it down on the
   first tap, which is also the gesture that unlocks audio. Automation
   (navigator.webdriver) and ?nostart never see it; ?start forces it on. */
(function(){
  const host = document.getElementById("oeStart");
  if(!host) return;
  const q = location.search || "";
  if(/[?&]nostart\b/.test(q) || (navigator.webdriver && !/[?&]start\b/.test(q))){ host.remove(); return; }
  let done = false;
  function rain(){
    const box = document.getElementById("oeStartRain");
    if(!box || typeof cards === "undefined") return;
    const FR = window.oeFrameFor, SL = window.oeArtSlug, MIN = window.oeArtMin || 9;
    /* four frame bands, drawn round-robin so the rain is not all Rare-red
       (tiers 9-11 are most of the pool) */
    const bands = [[9,11],[12,13],[14,14],[15,15]].map(([lo,hi]) =>
      cards.filter(c => c.rarity >= Math.max(lo, MIN) && c.rarity <= hi && c.category !== "Raid Gear"))
      .filter(b => b.length);
    const seen = new Set(), picks = [];
    const want = Math.max(10, Math.min(18, Math.round(window.innerWidth / 40)));
    for(let t = 0; t < 600 && picks.length < want && bands.length; t++){
      const b = bands[t % bands.length];
      const c = b[Math.floor(Math.random() * b.length)];
      const key = c.name.split(" — ")[0];
      if(seen.has(key)) continue;
      seen.add(key); picks.push(c);
    }
    const n = picks.length, scale = Math.min(1.4, Math.max(1, window.innerWidth / 760));
    const frag = document.createDocumentFragment();
    for(let i = 0; i < n; i++){
      const c = picks[i], fr = typeof FR === "function" ? FR(c.rarity) : null;
      const d = document.createElement("div"); d.className = "oe-fall";
      const w = (46 + Math.random() * 40) * scale;
      d.style.cssText = "--x:" + ((i + Math.random()) * 100 / n).toFixed(1) + "%;--w:" + w.toFixed(0) + "px;"
        + "--d:" + (7 + Math.random() * 7).toFixed(2) + "s;--delay:" + (-Math.random() * 14).toFixed(2) + "s;"
        + "--r0:" + (Math.random() * 60 - 30).toFixed(0) + "deg;--r1:" + (Math.random() * 120 - 60).toFixed(0) + "deg;"
        + "--dx:" + (Math.random() * 120 - 60).toFixed(0) + "px;" + (fr ? "--frame:url(" + fr.img + ")" : "");
      const em = document.createElement("span"); em.className = "oe-fall-em"; em.textContent = c.emoji;
      d.appendChild(em);
      if(typeof SL === "function"){
        const img = new Image(); img.alt = ""; img.draggable = false; img.decoding = "async";
        img.onerror = ()=> img.remove();
        img.src = "art/" + SL(c.name) + ".webp";
        d.appendChild(img);
      }
      frag.appendChild(d);
    }
    box.appendChild(frag);
  }
  function dismiss(e){
    if(e){ e.preventDefault(); e.stopPropagation(); }
    if(done) return; done = true;
    host.classList.add("out");
    try{ if(typeof feAudioUnlock === "function") feAudioUnlock(); }catch(e){}
    setTimeout(()=>{ try{ host.remove(); }catch(e){} }, 520);
  }
  /* Dismiss on CLICK, not pointerdown: the first tap once took the overlay
     down mid-gesture and the same finger's pointerup bought a pack on the
     shelf underneath. The overlay also stays hit-testable while it fades. */
  host.addEventListener("click", dismiss);
  host.addEventListener("pointerdown", (e)=>{ e.preventDefault(); e.stopPropagation(); });
  host.addEventListener("pointerup",   (e)=>{ e.preventDefault(); e.stopPropagation(); });
  window.addEventListener("keydown", (e)=>{
    if(!done && (e.key === "Enter" || e.key === " ")){ e.preventDefault(); dismiss(); }
  });
  window.oeStartDismiss = dismiss;
  try{ rain(); }catch(e){ console.warn("start screen rain skipped", e); }
})();

/* ---------------- POKER SMASH: challenge hands, chain bolts, banners ----------
   Wraps the poker functions rather than editing them, so the layer can be
   lifted out in one piece. The felt and the tile faces live in pkDraw /
   pkDrawFace above - a wrapper CANNOT repaint the background, because
   pkDraw opens with clearRect and would erase anything drawn beforehand. */
(function(){
  const CHALLENGES = [
    { kind:"kind",     n:3, label:"THREE OF A KIND" },
    { kind:"kind",     n:4, label:"FOUR OF A KIND" },
    { kind:"straight", n:3, label:"STRAIGHT" },
    { kind:"flush",    n:4, label:"FLUSH" },
    { kind:"sflush",   n:3, label:"STRAIGHT FLUSH" }
  ];
  window.pkSmash = { challenge:null, challengeT:0, nextAt:18, bolts:[], flash:0 };

  function banner(txt){
    const stage = document.getElementById("pkStage");
    if(!stage) return;
    const el = document.createElement("div");
    el.className = "pk-smash-float";
    el.textContent = txt;
    stage.appendChild(el);
    setTimeout(()=>el.remove(), 750);
  }
  function ensureHud(){
    if(document.getElementById("pkChallenge")) return;
    const stage = document.getElementById("pkStage");
    if(!stage || !stage.parentNode) return;
    const bar = document.createElement("div");
    bar.id = "pkChallenge"; bar.className = "pk-challenge";
    stage.parentNode.insertBefore(bar, stage.nextSibling);
  }
  function barText(){
    const bar = document.getElementById("pkChallenge");
    if(bar && pkSmash.challenge){
      bar.textContent = "CHALLENGE  \u00b7  " + pkSmash.challenge.label +
        "  \u00b7  " + Math.max(0, Math.ceil(pkSmash.challengeT)) + "s";
    }
  }
  function setChallenge(ch, secs){
    pkSmash.challenge = ch; pkSmash.challengeT = secs;
    ensureHud();
    const bar = document.getElementById("pkChallenge");
    if(bar) bar.classList.add("show");
    barText();
  }
  function endChallenge(won){
    if(won && pkSmash.challenge && pk){
      const bonus = 180 + (pkSmash.challenge.n || 3) * 40;
      pk.score += bonus;
      if(pk.pops) pk.pops.push({ x: PK_COLS*PK_CELL/2, y: 80, t:0,
        txt:"CHALLENGE +" + bonus, col:"#ffd35c", size:18 });
      banner("CHALLENGE!");
    }
    pkSmash.challenge = null;
    const bar = document.getElementById("pkChallenge");
    if(bar) bar.classList.remove("show");
  }

  const _draw = pkDraw;
  window.pkDraw = function(dt){
    _draw(dt);
    if(pkCtx){
      const ctx = pkCtx;
      pkSmash.bolts = pkSmash.bolts.filter(b=>{
        b.t += (dt || 0.016);
        const a = 1 - b.t / b.life;
        if(a <= 0) return false;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = a * 0.95;
        ctx.strokeStyle = b.col; ctx.lineWidth = 3.5;
        ctx.shadowColor = b.col; ctx.shadowBlur = 16;
        ctx.beginPath(); ctx.moveTo(b.ax, b.ay);
        for(let i = 1; i < 6; i++){
          const t = i/6;
          ctx.lineTo(b.ax + (b.bx-b.ax)*t + (Math.random()-0.5)*10,
                     b.ay + (b.by-b.ay)*t + (Math.random()-0.5)*10);
        }
        ctx.lineTo(b.bx, b.by); ctx.stroke();
        ctx.lineWidth = 1.2; ctx.strokeStyle = "#fff"; ctx.stroke();
        ctx.restore();
        return true;
      });
      if(pkSmash.flash > 0){
        ctx.fillStyle = "rgba(170,230,255," + (pkSmash.flash*0.35) + ")";
        ctx.fillRect(0, 0, PK_COLS*PK_CELL, (PK_ROWS+1)*PK_CELL);
        pkSmash.flash *= 0.82;
      }
    }
    barText();
  };

  const _apply = pkApplyMatches;
  window.pkApplyMatches = function(sets){
    if(sets && sets.length){
      let cleared = false;
      sets.forEach(s=>{
        const n = (s.cells && s.cells.length) || 0;
        if(pkSmash.challenge && s.type === pkSmash.challenge.kind && n >= pkSmash.challenge.n) cleared = true;
      });
      banner(PK_HANDNAME[sets[0].type] || "HAND");
      const pts = [];
      sets.forEach(s=>(s.cells||[]).forEach(cell=>pts.push({
        x:(cell.x + 0.5) * PK_CELL,
        y: pkScreenY(cell.y) + PK_CELL/2 })));
      for(let i = 0; i < pts.length - 1; i++){
        pkSmash.bolts.push({ ax:pts[i].x, ay:pts[i].y, bx:pts[i+1].x, by:pts[i+1].y,
                             t:0, life:0.42, col:"#9be7ff" });
      }
      pkSmash.flash = Math.min(1, 0.35 + sets.length * 0.15);
      if(cleared) endChallenge(true);
    }
    return _apply(sets);
  };

  const _update = pkUpdate;
  window.pkUpdate = function(dt){
    _update(dt);
    if(!pk || pk.over) return;
    if(pkSmash.challenge){
      pkSmash.challengeT -= dt;
      if(pkSmash.challengeT <= 0) endChallenge(false);
    } else if(pk.time > pkSmash.nextAt){
      setChallenge(CHALLENGES[Math.floor(Math.random()*CHALLENGES.length)], 12 + Math.random()*6);
      pkSmash.nextAt = pk.time + 22 + Math.random()*14;
    }
  };

  const _render = renderPoker;
  window.renderPoker = function(){
    _render();
    ensureHud();
    if(!pk){
      /* a fresh board resets the challenge clock with it */
      pkSmash.challenge = null; pkSmash.nextAt = 18;
      pkSmash.bolts.length = 0; pkSmash.flash = 0;
      const bar = document.getElementById("pkChallenge");
      if(bar) bar.classList.remove("show");
    }
  };
})();

setInterval(()=>{
  resolveLotteryDraws();
  const panel = document.getElementById("brGame-lottery");
  if(panel && panel.style.display!=="none") updateLottoCountdown();
}, 1000);
