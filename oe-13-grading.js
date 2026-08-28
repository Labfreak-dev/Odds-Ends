
/* ============================================================
   THE GRADING DESK — pulls come raw. Prof. Mullen takes your
   card, your fee, and his time; the slab comes back 1 to 10.
   Like real cardboard: the pull is hope, the grade is truth.
   ============================================================ */
(function(){
state.grading = state.grading || {};
state.grading.slots = state.grading.slots || [null, null];
if(((state.upgrades && state.upgrades.deskSlot)||0) && state.grading.slots.length < 3) state.grading.slots.push(null);
state.grading.graded = state.grading.graded || {};    /* cardId -> grade */

const GR_LABEL = ["","POOR","FAIR","GOOD","GOOD+","EXCELLENT","EX-MINT","NEAR MINT","NM-MINT","MINT","GEM MINT"];
function grFee(r){ return 400 * Math.pow(Math.floor(r/3)+1, 2); }        /* by band */
function grSecs(r){ return 60 * (Math.floor(r/3)+1); }
function grRoll(){
  let rerolls = Math.min(2,((state.upgrades && state.upgrades.profFavor)||0));
  const w = [0,1,2,4,8,14,20,22,16,9,4];                                  /* grades 1..10 */
  let tot = 0; for(let i=1;i<=10;i++) tot += w[i];
  const draw = ()=>{ let x = Math.random()*tot;
    for(let i=1;i<=10;i++){ x -= w[i]; if(x <= 0) return i; }
    return 7; };
  let g = draw();
  while(g <= 4 && rerolls > 0){ rerolls--; g = draw(); }   /* Mullen takes another look */
  return g;
}
function grCandidates(){
  const out = [];
  for(const id in state.owned){
    if(!(state.owned[id] > 0)) continue;
    if(state.grading.graded[id]) continue;
    if(state.grading.slots.some(s => s && s.id === id)) continue;
    const c = cards[id];
    if(c) out.push(c);
  }
  out.sort((a,b) => b.rarity - a.rarity);
  return out.slice(0, 8);
}
function grRender(){
  const tab = document.getElementById("tab-collection");
  if(!tab) return;
  let host = document.getElementById("grPanel");
  if(!host){
    host = document.createElement("div");
    host.id = "grPanel"; host.className = "panel gr-panel";
    tab.insertBefore(host, tab.firstChild);
  }
  const G = state.grading;
  /* the two desk slots */
  const slots = G.slots.map((s,i)=>{
    if(!s) return `<div class="gr-slot empty">— open slot —</div>`;
    const left = Math.max(0, Math.ceil((s.done - Date.now())/1000));
    const c = cards[s.id];
    return left > 0
      ? `<div class="gr-slot">🔎 <b>${c ? c.name : "?"}</b> — with the professional, ${left}s</div>`
      : `<div class="gr-slot ready"><b>${c ? c.name : "?"}</b><button class="gr-crack" data-crack="${i}">CRACK THE SLAB</button></div>`;
  }).join("");
  /* the candidates worth sending */
  const cand = grCandidates();
  const hand = cand.length
    ? cand.map(c=>{
        const r = RARITIES[c.rarity];
        return `<button class="gr-card" data-send="${c.id}" style="border-color:${r.color}66"
          title="${c.name} · fee 🪙${grFee(c.rarity).toLocaleString()} · ${grSecs(c.rarity)}s">
          <span class="e">${c.emoji}</span><span class="n">${c.name}</span>
          <span class="f">🪙${grFee(c.rarity).toLocaleString()}</span></button>`;
      }).join("")
    : `<div class="gr-dim">Nothing ungraded worth sending — open packs, then come back.</div>`;
  /* the shelf of finished slabs */
  const done = Object.keys(G.graded)
    .map(id => ({ id, g: G.graded[id], c: cards[id] }))
    .filter(x => x.c)
    .sort((a,b) => b.g - a.g).slice(0, 10);
  const shelf = done.length
    ? `<div class="gr-shelfhead">The slab shelf</div><div class="gr-shelf">` +
      done.map(x=>`<span class="gr-slab g${x.g}">${x.c.emoji} <b>${x.g}</b></span>`).join("") + `</div>`
    : "";
  host.innerHTML = `<div class="gr-head">🔎 <b>The Grading Desk</b><i>raw pulls in, graded slabs out — Prof. Mullen sees all flaws</i></div>
    <div class="gr-slots">${slots}</div>
    <div class="gr-handhead">Worth sending (your best raw cards)</div>
    <div class="gr-hand">${hand}</div>${shelf}`;
  host.querySelectorAll("[data-send]").forEach(b => b.onclick = ()=>{
    const id = b.dataset.send;
    const c = cards[id]; if(!c) return;
    const si = state.grading.slots.findIndex(s => !s);
    if(si < 0){ showToast("The desk is full — crack a slab first"); return; }
    const fee = grFee(c.rarity);
    if(state.credits < fee){ showToast(`The professional wants 🪙${fee.toLocaleString()}`); return; }
    state.credits -= fee;
    state.grading.slots[si] = { id, done: Date.now() + grSecs(c.rarity)*1000 };
    showToast(`🔎 ${c.name} is with the professional`);
    try{ fbSfxSafe && fbSfxSafe("bait", 0.35); }catch(e){}
    try{ saveState(); }catch(e){}
    grRender();
  });
  host.querySelectorAll("[data-crack]").forEach(b => b.onclick = ()=>{
    const i = +b.dataset.crack;
    const s = state.grading.slots[i];
    if(!s || Date.now() < s.done) return;
    const grade = grRoll();
    state.grading.graded[s.id] = grade;
    state.grading.slots[i] = null;
    const c = cards[s.id];
    grCeremony(c, grade);
    /* a graded card works harder in the mine */
    try{
      state.miningBonus = computeMiningBonusFromOwned(state.owned);
      renderMiningStats && renderMiningStats();
    }catch(e){}
    if(grade >= 9){
      state.player.bonusXP = (state.player.bonusXP||0) + 40 * (Math.floor((c?c.rarity:0)/3)+1);
      try{ recomputeLevelFromXP && recomputeLevelFromXP(); }catch(e){}
    }
    try{ saveState(); }catch(e){}
    grRender();
  });
}
function grCeremony(c, grade){
  let m = document.getElementById("grModal");
  if(m) m.remove();
  m = document.createElement("div");
  m.id = "grModal";
  m.innerHTML = `<div class="gr-slabbig g${grade}">
      <div class="gr-slabtop">PROFESSIONAL GRADING</div>
      <div class="gr-slabemoji">${c ? c.emoji : "🎴"}</div>
      <div class="gr-slabname">${c ? c.name : ""}</div>
      <div class="gr-grade" id="grNum">1</div>
      <div class="gr-gradelabel" id="grLbl"></div>
      <button class="gr-close" id="grClose">Take it home</button>
    </div>`;
  document.body.appendChild(m);
  /* the count-up: hope, then truth */
  let n = 0;
  const iv = setInterval(()=>{
    n++;
    const el = document.getElementById("grNum");
    if(!el){ clearInterval(iv); return; }
    el.textContent = n;
    try{ fbSfxSafe && fbSfxSafe("equip", 0.12); }catch(e){}
    if(n >= grade){
      clearInterval(iv);
      document.getElementById("grLbl").textContent = GR_LABEL[grade];
      if(grade >= 9){ m.querySelector(".gr-slabbig").classList.add("shine");
        try{ fbSfxSafe && fbSfxSafe("perfect", 0.5); }catch(e){} }
      else try{ fbSfxSafe && fbSfxSafe("finish", 0.35); }catch(e){}
    }
  }, 260);
  document.getElementById("grClose").onclick = ()=> m.remove();
}
/* graded cards pull extra weight in the mine: +grade/10 of their bonus */
if(typeof computeMiningBonusFromOwned === "function" && !window.__grMineWrap){
  window.__grMineWrap = true;
  const _b0 = computeMiningBonusFromOwned;
  computeMiningBonusFromOwned = function(ownedMap){
    let b = _b0(ownedMap);
    try{
      const g = (state.grading && state.grading.graded) || {};
      for(const id in g){
        if(ownedMap[id] > 0 && cards[id]) b += MINE_BONUS_BY_TIER[cards[id].rarity] * (g[id]/10);
      }
    }catch(e){}
    return b;
  };
}
setInterval(()=>{ try{ grRender(); }catch(e){} }, 1000);
setTimeout(()=>{ try{ grRender(); }catch(e){} }, 500);
})();


