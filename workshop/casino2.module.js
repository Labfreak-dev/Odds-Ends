/* ============================================================
   THE BACK ROOM LEDGER — House Standing, the featured table,
   the High Table (wager anything), and the Fortune & Folly
   completion drive. The casino joins the rest of the game.
   ============================================================ */
(function(){
const C = ()=> casinoStats();
function c2Init(){
  const c = C();
  c.standingXP = c.standingXP || 0;
  c.riskOpened = c.riskOpened || 0;
  const day = new Date().toDateString();
  if(c.day !== day){ c.day = day; c.dayWagered = 0; c.dayWins = 0; c.dayClaimed = false; c.compClaimed = false; }
}
const C2_RANKS = [
  { at:0,       name:"Nobody",       comp:0,    note:"the floor doesn't know your name" },
  { at:50000,   name:"Regular",      comp:500,  note:"the bartender nods" },
  { at:500000,  name:"High Roller",  comp:2500, note:"they hold your seat" },
  { at:2500000, name:"Comped",       comp:8000, note:"the house pretends it likes you" },
];
function c2Rank(){ const xp = C().standingXP||0; let r = 0;
  for(let i=0;i<C2_RANKS.length;i++) if(xp >= C2_RANKS[i].at) r = i; return r; }
/* every wager feeds standing and the day's special */
if(typeof logWager === "function" && !window.__c2WagerWrap){
  window.__c2WagerWrap = true;
  const _w = logWager, _n = logWin;
  logWager = function(a){ try{ c2Init(); C().standingXP += a; C().dayWagered += a; }catch(e){} c2Render(); return _w(a); };
  logWin = function(a){ try{ c2Init(); C().dayWins += 1; }catch(e){} c2Render(); return _n(a); };
}
/* the featured table, new with the sun */
const C2_TABLES = ["🚀 Ascent","🎡 The Sorting Wheel","🎰 Three Reels","🃏 Double or Nothing","🂡 The Dealer's Table","📈 Higher or Lower","🎯 The Drop","💣 The Minefield","🔢 Keno","🎟️ The Daily Lottery"];
function c2Hash(str){ let h=2166136261; for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619); } return (h>>>0); }
function c2Featured(){ return C2_TABLES[c2Hash(new Date().toDateString()+"#house") % C2_TABLES.length]; }

/* ---------------- Fortune & Folly drive ---------------- */
let FF_ALL = null;
function ffAll(){ if(!FF_ALL) FF_ALL = cards.filter(c=>c.category==="Fortune & Folly"); return FF_ALL; }
function ffOwned(){ return ffAll().filter(c=>state.owned[c.id]>0).length; }
function ffCheckDone(){
  const c = C();
  if(!c.ffLuck && ffAll().length && ffOwned() === ffAll().length){
    c.ffLuck = true;
    state.upgrades.luck = (state.upgrades.luck||0) + 1;
    showToast("🍀 FORTUNE & FOLLY COMPLETE — Lady Luck herself deals you in. Permanent luck raised.");
    try{ fbSfxSafe && fbSfxSafe("perfect", 0.6); }catch(e){}
  }
}
/* pity: every 5th Risk pack guarantees a new F&F card */
if(typeof openOnePack === "function" && !window.__c2PityWrap){
  window.__c2PityWrap = true;
  const _o = openOnePack;
  openOnePack = function(key, claimed){
    const pulls = _o(key, claimed);
    try{
      if(key === "risk"){
        c2Init();
        C().riskOpened += 1;
        if(C().riskOpened % 5 === 0){
          const unowned = ffAll().filter(c=>!(state.owned[c.id]>0) && !pulls.some(p=>p.id===c.id));
          if(unowned.length && !pulls.some(p=>!(state.owned[p.id]>0))){
            pulls[0] = unowned[Math.floor(Math.random()*unowned.length)];
          }
        }
        setTimeout(ffCheckDone, 800);
      }
    }catch(e){}
    return pulls;
  };
}

/* ---------------- the panel ---------------- */
function c2Render(){
  const tab = document.getElementById("tab-casino");
  if(!tab) return;
  let host = document.getElementById("c2Panel");
  if(!host){
    host = document.createElement("div");
    host.id = "c2Panel"; host.className = "panel c2-panel";
    tab.insertBefore(host, tab.firstChild.nextSibling);
  }
  c2Init();
  const c = C(), r = c2Rank(), R = C2_RANKS[r], nx = C2_RANKS[r+1];
  const prog = nx ? Math.min(1,(c.standingXP - R.at)/(nx.at - R.at)) : 1;
  const ff = ffAll().length ? `${ffOwned()}/${ffAll().length}` : "—";
  const wagerGoal = 4000, winGoal = 3;
  const specialDone = c.dayWagered >= wagerGoal && c.dayWins >= winGoal;
  host.innerHTML = `
    <div class="c2-row">
      <div class="c2-rank"><span class="c2-rname">🎩 ${R.name}</span><i>${R.note}</i>
        <div class="c2-bar"><div style="width:${(prog*100).toFixed(1)}%"></div></div>
        <i>${nx ? `🪙${c.standingXP.toLocaleString()} wagered · ${nx.at.toLocaleString()} makes ${nx.name}` : "the house has nothing left to offer"}</i></div>
      <div class="c2-comp">${R.comp ? (c.compClaimed
          ? `<span class="c2-dim">comp collected</span>`
          : `<button class="c2-btn hot" id="c2Comp">🥃 Daily comp — 🪙${R.comp.toLocaleString()}</button>`)
        : `<span class="c2-dim">comps start at Regular</span>`}</div>
    </div>
    <div class="c2-row c2-special">
      <span>✨ <b>House Special: ${c2Featured()}</b> — wager 🪙${wagerGoal.toLocaleString()} and take ${winGoal} wins anywhere on the floor</span>
      <span class="c2-prog">${Math.min(c.dayWagered,wagerGoal).toLocaleString()}/${wagerGoal.toLocaleString()} · ${Math.min(c.dayWins,winGoal)}/${winGoal}</span>
      ${c.dayClaimed ? `<span class="c2-dim">✔ paid</span>`
        : specialDone ? `<button class="c2-btn hot" id="c2Spec">CLAIM 🪙2,000 · ♻️5</button>` : ``}
    </div>
    <div class="c2-row c2-ff"><span>🍀 <b>Fortune & Folly</b> ${ff}${c.ffLuck ? " · <b>COMPLETE — Lady Luck deals you in</b>" : " · every 5th Risk pack owes you a new one"}</span>
      <div class="c2-bar gold"><div style="width:${ffAll().length ? (100*ffOwned()/ffAll().length).toFixed(1) : 0}%"></div></div></div>
    <div class="c2-high">
      <div class="c2-hh">🕯️ THE HIGH TABLE <i>— the house takes more than credits</i></div>
      <div class="c2-stakes">
        <div class="c2-stake"><b>♻️ Scrap Flip</b><i>even odds, double or dust</i>
          ${[10,50,250].map(n=>`<button class="c2-btn" data-flip="${n}" ${state.scrap>=n?"":"disabled"}>${n}</button>`).join("")}</div>
        <div class="c2-stake"><b>⛏️ Ore Duel</b><i>stake 3, draw against the pit — 55% yours</i>
          ${[1,2,3,4,5,6,7].map(t=>((state.mining&&state.mining.ore&&state.mining.ore[t])||0)>=3?`<button class="c2-btn" data-duel="${t}">T${t}</button>`:"").join("")||`<i class="c2-dim">need 3 ore of a tier</i>`}</div>
        <div class="c2-stake"><b>🎴 Card Stake</b><i>win: a card a band up · lose: it's gone forever</i>
          <button class="c2-btn" id="c2Stake">choose a card…</button></div>
      </div>
    </div>`;
  const comp = host.querySelector("#c2Comp");
  if(comp) comp.onclick = ()=>{ if(c.compClaimed) return; c.compClaimed = true;
    state.credits += R.comp; showToast(`🥃 The house sends one over — 🪙${R.comp.toLocaleString()}`);
    try{ saveState(); renderHeader(); }catch(e){} c2Render(); };
  const spec = host.querySelector("#c2Spec");
  if(spec) spec.onclick = ()=>{ if(c.dayClaimed || !specialDone) return; c.dayClaimed = true;
    state.credits += 2000; state.scrap = (state.scrap||0) + 5;
    showToast("✨ The pit boss settles up — 🪙2,000 · ♻️5");
    try{ saveState(); renderHeader(); }catch(e){} c2Render(); };
  host.querySelectorAll("[data-flip]").forEach(b=>b.onclick=()=>{
    const n = +b.dataset.flip; if(state.scrap < n) return;
    if(Math.random() < 0.5){ state.scrap += n; showToast(`♻️ HEADS — the pile doubles (+${n})`); try{ fbSfxSafe&&fbSfxSafe("reward_good",0.4);}catch(e){} }
    else { state.scrap -= n; showToast(`♻️ TAILS — ${n} scrap sweeps away`); try{ fbSfxSafe&&fbSfxSafe("splash_small",0.4);}catch(e){} }
    try{ saveState(); renderHeader(); }catch(e){} c2Render();
  });
  host.querySelectorAll("[data-duel]").forEach(b=>b.onclick=()=>{
    const t = +b.dataset.duel; const M = state.mining;
    if(((M.ore&&M.ore[t])||0) < 3) return;
    if(Math.random() < 0.55){ M.ore[t] += 3; showToast(`⛏️ Your draw stands — +3 Tier-${t} ore`); }
    else { M.ore[t] -= 3; showToast(`⛏️ The pit draws higher — 3 Tier-${t} ore to the house`); }
    try{ saveState(); }catch(e){} c2Render();
  });
  const stk = host.querySelector("#c2Stake");
  if(stk) stk.onclick = c2StakeSheet;
}
function c2StakeSheet(){
  const cand = [];
  for(const id in state.owned){
    if(!(state.owned[id]>0)) continue;
    const c = cards[id];
    if(c && c.rarity < 15) cand.push(c);
  }
  cand.sort((a,b)=>b.rarity-a.rarity);
  const top = cand.slice(0,8);
  let m = document.getElementById("c2Sheet"); if(m) m.remove();
  m = document.createElement("div"); m.id = "c2Sheet";
  m.innerHTML = `<div class="c2-sheet"><div class="c2-sh-h">🎴 <b>Stake a card</b> — win, and the house pays a card one band up. Lose, and yours burns.</div>
    ${top.length ? top.map(c=>{ const r = RARITIES[c.rarity];
      return `<button class="c2-sh-c" data-stake="${c.id}" style="border-color:${r.color}66">${c.emoji} ${c.name} <span style="color:${r.color}">${r.name}</span></button>`; }).join("")
      : `<div class="c2-dim">nothing in the binder worth the felt</div>`}
    <button class="c2-btn" id="c2ShX">walk away</button></div>`;
  document.body.appendChild(m);
  document.getElementById("c2ShX").onclick = ()=> m.remove();
  m.querySelectorAll("[data-stake]").forEach(b=>b.onclick=()=>{
    const id = b.dataset.stake; const c = cards[id];
    if(!(state.owned[id]>0)) { m.remove(); return; }
    if(!confirm(`Put "${c.name}" on the felt? Lose and it is GONE.`)) return;
    m.remove();
    logWager(0);
    if(Math.random() < 0.46){
      const lo = c.rarity >= 12 ? Math.min(15, c.rarity+1) : (Math.floor(c.rarity/3)+1)*3;
      const hi = lo >= 12 ? lo : lo+2;
      const pool = cards.filter(x=>x.rarity>=lo && x.rarity<=hi && !(typeof EXCLUSIVE_CATEGORIES!=="undefined" && EXCLUSIVE_CATEGORIES.has(x.category)));
      const win = pool[Math.floor(Math.random()*pool.length)];
      state.owned[win.id] = (state.owned[win.id]||0)+1;
      state.miningBonus = computeMiningBonusFromOwned(state.owned);
      showToast(`🎴 THE HOUSE PAYS — ${win.name} (${RARITIES[win.rarity].name}) joins the binder`);
      try{ fbSfxSafe&&fbSfxSafe("treasure",0.5); }catch(e){}
      try{ logWin(0); }catch(e){}
    } else {
      state.owned[id] -= 1;
      state.miningBonus = computeMiningBonusFromOwned(state.owned);
      if(state.grading && state.grading.graded && !(state.owned[id]>0)) delete state.grading.graded[id];
      showToast(`🔥 The dealer turns it over — ${c.name} burns.`);
      try{ fbSfxSafe&&fbSfxSafe("splash_small",0.5); }catch(e){}
    }
    try{ saveState(); }catch(e){} c2Render();
  });
}
setInterval(()=>{ try{ if(document.getElementById("tab-casino") && document.getElementById("tab-casino").style.display !== "none") c2Render(); }catch(e){} }, 2500);
setTimeout(()=>{ try{ c2Init(); c2Render(); }catch(e){} }, 700);
})();
