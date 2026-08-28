
/* =================== END ADDED MODES =================== */

const UI_GAMES = [
  { id:"hunt",    name:"The Hunt",    icon:"🗡️", desc:"Every tap fuels the fight. Beasts without end, a blade forged in ingots, and embers for the brave.", meta:"Endless clicker" },
  { id:"keep",    name:"The Keep",    icon:"🏰", desc:"An idle war. The castle never falls — it earns. Hold the line when it suits you.", meta:"Idle defense" },
  { id:"fishing", name:"Fishing",     icon:"🎣", desc:"Cast a line. The water pays out in Credits — some catches handsomely.", meta:"Idle-friendly" },
  { id:"poker",   name:"Poker Rush",  icon:"🃏", desc:"The stack rises. Make poker hands. Jokers go off.",   meta:"Arcade" },
  { id:"casino",  name:"Risk it All", icon:"🎰", desc:"Six ways to lose it, and a few to win big.",          meta:"6 games" },
  { id:"dungeon", name:"Mythic Raids", icon:"🏚️", desc:"Daemonheim. Go in with nothing, come out with a level.", meta:"10 floors" },
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

function renderPlayLobby(){
  const grid = document.getElementById("playGrid");
  if(!grid) return;
  grid.innerHTML = UI_GAMES.map(g=>`
    <button class="play-card" data-game="${g.id}">
      <span class="pi">${g.icon}</span>
      <span class="pn">${g.name}</span>
      <span class="pd">${g.desc}</span>
      <span class="pmeta">${g.meta}</span>
    </button>`).join("");
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
setInterval(()=>{
  resolveLotteryDraws();
  const panel = document.getElementById("brGame-lottery");
  if(panel && panel.style.display!=="none") updateLottoCountdown();
}, 1000);
