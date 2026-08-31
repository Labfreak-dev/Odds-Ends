
/* ============================================================
   RIP & SHIP — the pack-cracking counter. Tear the foil with
   your thumb, flip the stack one card at a time, and make the
   call on every pull: SHIP it for fast coin, or KEEP it in the
   binder. The ledger line tells you if the pack paid.
   ============================================================ */
(function(){
if(typeof startReveal !== "function" || window.__rzWrap) return;
window.__rzWrap = true;

let RZ = null;                     /* live session */
let rzStreak = 0;                  /* packs ripped this sitting */

/* What a card is honestly WORTH: the price the collection screen pays for it,
   graded on the same curve the market uses. Not the market's BUY price - that
   is what a card costs you, roughly five times what anyone pays for it, and
   pricing a pull off it turns every pack into free money. */
function rzVal(card){
  try{
    let v = MARKET_SELL_PRICE_BY_TIER[card.rarity];
    const g = state.grading && state.grading.graded && state.grading.graded[card.id];
    if(g) v = Math.round(v * (0.5 + g*0.15));
    if(v > 0) return Math.max(2, Math.round(v));
  }catch(e){}
  return Math.max(2, Math.round(2 * Math.pow(2.05, card.rarity)));
}
/* SHIP is the impatient sale: the money lands now, and the 15% is what that
   convenience costs against carrying the card to the collection screen. */
function rzShipPay(card){ return Math.round(rzVal(card) * 0.85); }

const _origStartReveal = startReveal;
startReveal = function(pack, packsArr, spentCredits){
  try{
    const allPulls = packsArr.reduce((a,p)=>a.concat(p), []);
    const gains = applyPulls(allPulls);
    try{ saveState(); renderHeader(); renderPackShelf(); }catch(e){}
    RZ = { pack, pulls: allPulls, idx: 0, tear: 0, tearing:false,
           spent: spentCredits || 0, shipped: 0, keptVal: 0, stage: "rip",
           best: allPulls.reduce((a,c)=> (!a || c.rarity > a.rarity) ? c : a, null) };
    rzOpen();
  }catch(e){
    try{ _origStartReveal(pack, packsArr, spentCredits); }catch(e2){}
  }
};

function rzOpen(){
  let ov = document.getElementById("rzOverlay");
  if(!ov){
    ov = document.createElement("div");
    ov.id = "rzOverlay";
    document.body.appendChild(ov);
  }
  ov.style.display = "flex";
  rzRender();
}
function rzClose(){
  const ov = document.getElementById("rzOverlay");
  if(ov) ov.style.display = "none";
  RZ = null;
  try{ saveState(); renderHeader(); renderCollection && renderCollection(); }catch(e){}
}
function rzTally(){
  const net = RZ.shipped + RZ.keptVal - RZ.spent;
  return `<div class="rz-tally">
    <span>🎁 ${RZ.pack.icon||"🎴"} <b>${RZ.pack.name}</b>${RZ.spent?` · cost $${RZ.spent.toLocaleString()}`:""}</span>
    <span>📦 shipped <b>$${RZ.shipped.toLocaleString()}</b> · 🗃️ kept <b>$${RZ.keptVal.toLocaleString()}</b></span>
    <span class="${net>=0?"up":"down"}">${net>=0?"▲ up":"▼ down"} $${Math.abs(net).toLocaleString()}</span>
  </div>`;
}
function rzRender(){
  const ov = document.getElementById("rzOverlay");
  if(!ov || !RZ) return;
  if(RZ.stage === "rip"){
    ov.innerHTML = `<div class="rz-box">
      ${rzTally()}
      <div class="rz-pack" id="rzPack" style="--tear:${(RZ.tear*100).toFixed(1)}%">
        <div class="rz-foiltop"></div>
        <div class="rz-packicon">${RZ.pack.icon||"🎴"}</div>
        <div class="rz-packname">${RZ.pack.name}</div>
        <div class="rz-packsub">${RZ.pulls.length} cards inside</div>
        <div class="rz-tearline"></div>
      </div>
      <div class="rz-hint">👉 drag across the top to RIP — or tap it</div>
    </div>`;
    const pk = document.getElementById("rzPack");
    let lastX = null;
    const move = (x)=>{
      if(!RZ || RZ.stage !== "rip") return;   /* the drag can outlive the tear */
      if(lastX !== null){ RZ.tear = Math.min(1, RZ.tear + Math.abs(x-lastX)/220); }
      lastX = x;
      pk.style.setProperty("--tear", (RZ.tear*100).toFixed(1)+"%");
      if(RZ.tear >= 1) rzRipDone();
    };
    pk.onpointerdown = (e)=>{ RZ.tearing = true; lastX = e.clientX; pk.setPointerCapture(e.pointerId);
      RZ.tear = Math.min(1, RZ.tear + 0.2); move(e.clientX); };
    pk.onpointermove = (e)=>{ if(RZ && RZ.tearing) move(e.clientX); };
    pk.onpointerup = ()=>{ if(RZ) RZ.tearing = false; lastX = null; };
  }
  else if(RZ.stage === "cards"){
    const c = RZ.pulls[RZ.idx];
    const left = RZ.pulls.length - RZ.idx;
    ov.innerHTML = `<div class="rz-box">
      ${rzTally()}
      <div class="rz-stack" id="rzStack">
        <div class="rz-back"><span>🎴</span><i>${left} left · tap to flip</i></div>
      </div>
      <div class="rz-row"><button class="rz-btn dim" id="rzKeepAll">🗃️ keep the rest</button></div>
    </div>`;
    document.getElementById("rzStack").onclick = ()=> rzFlip(c);
    document.getElementById("rzKeepAll").onclick = ()=>{
      for(let i=RZ.idx; i<RZ.pulls.length; i++) RZ.keptVal += rzVal(RZ.pulls[i]);
      RZ.stage = "done"; rzRender();
    };
  }
  else if(RZ.stage === "face"){
    const c = RZ.face, r = RARITIES[c.rarity];
    const pay = rzShipPay(c);
    ov.innerHTML = `<div class="rz-box">
      ${rzTally()}
      <div class="rz-card ${c.rarity>=14?"burst":""}" style="--rc:${r.color}; border-color:${r.color}">
        <div class="rz-rname" style="color:${r.color}">${r.name}</div>
        <div class="rz-art">${c.emoji}</div>
        <div class="rz-cname">${c.name}</div>
        <div class="rz-cat">${c.category}</div>
        <div class="rz-badges"><span class="rz-b ${c._wasNew?"new":"dupe"}">${c._wasNew?"NEW":"DUPLICATE"}</span>
        <span class="rz-val">worth $${rzVal(c).toLocaleString()}</span></div>
      </div>
      <div class="rz-row">
        <button class="rz-btn ship" id="rzShip">📦 SHIP IT +$${pay.toLocaleString()}</button>
        <button class="rz-btn keep" id="rzKeep">🗃️ KEEP</button>
      </div>
    </div>`;
    document.getElementById("rzShip").onclick = ()=>{
      if(state.owned[c.id] > 0){
        state.owned[c.id] -= 1;
        if(!(state.owned[c.id] > 0)){
          try{ if(state.grading && state.grading.graded) delete state.grading.graded[c.id]; }catch(e){}
        }
        try{ state.miningBonus = computeMiningBonusFromOwned(state.owned); }catch(e){}
        state.dollars += pay;
        RZ.shipped += pay;
        try{ fbSfxSafe && fbSfxSafe("reward_good", 0.35); }catch(e){}
      }
      rzNext();
    };
    document.getElementById("rzKeep").onclick = ()=>{
      RZ.keptVal += rzVal(c);
      try{ fbSfxSafe && fbSfxSafe("equip", 0.25); }catch(e){}
      rzNext();
    };
  }
  else if(RZ.stage === "done"){
    rzStreak += 1;
    const net = RZ.shipped + RZ.keptVal - RZ.spent;
    const b = RZ.best, br = b ? RARITIES[b.rarity] : null;
    const canAgain = RZ.pack.price1 > 0 && state.dollars >= RZ.pack.price1 && typeof buyPacks === "function";
    ov.innerHTML = `<div class="rz-box">
      <div class="rz-doneh">${net >= 0 ? "📈 THE PACK PAID" : "📉 THE HOUSE WINS THIS ONE"}</div>
      <div class="rz-donenet ${net>=0?"up":"down"}">${net>=0?"+":"−"}$${Math.abs(net).toLocaleString()}</div>
      ${b ? `<div class="rz-bestline">best pull: <b style="color:${br.color}">${b.emoji} ${b.name}</b> (${br.name})</div>` : ""}
      <div class="rz-statline">📦 shipped $${RZ.shipped.toLocaleString()} · 🗃️ kept $${RZ.keptVal.toLocaleString()} · 🔥 streak ${rzStreak}</div>
      <div class="rz-row">
        ${canAgain ? `<button class="rz-btn ship" id="rzAgain">RIP ANOTHER — $${RZ.pack.price1.toLocaleString()}</button>` : ""}
        <button class="rz-btn keep" id="rzDone">back to the shelf</button>
      </div>
    </div>`;
    const ag = document.getElementById("rzAgain");
    if(ag) ag.onclick = ()=>{ const k = RZ.pack.key; rzClose(); try{ buyPacks(k, 1); }catch(e){} };
    document.getElementById("rzDone").onclick = rzClose;
    try{ saveState(); renderHeader(); }catch(e){}
  }
}
function rzRipDone(){
  RZ.stage = "cards";
  try{ fbSfxSafe && fbSfxSafe("treasure", 0.4); }catch(e){}
  rzRender();
}
function rzFlip(c){
  RZ.face = c;
  RZ.stage = "face";
  if(c.rarity >= 15 && typeof triggerMythicFireworksEvent === "function"){
    try{ if(!state.settings || state.settings.flashingEnabled !== false) triggerMythicFireworksEvent(); }catch(e){}
  }
  rzRender();
}
function rzNext(){
  RZ.idx += 1;
  RZ.stage = RZ.idx >= RZ.pulls.length ? "done" : "cards";
  try{ saveState(); renderHeader(); }catch(e){}
  rzRender();
}
})();


