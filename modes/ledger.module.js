/* ============================================================
   THE FOREMAN'S LEDGER — three contracts a day, drawn across
   the mine, the water, and the pack shelf. Fill all three and
   the foreman stands you a pack on the house.
   ============================================================ */
(function(){
function lgHash(str){ let h=2166136261; for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619); } return (h>>>0); }
const LG_POOL = [
  { kind:"vein",     mk:h=>({ goal: 3+(h>>>3)%3,  txt:g=>`Break ${g} veins in the mine`,          cr:2600, sc:5 }) },
  { kind:"tap",      mk:h=>({ goal: 30+((h>>>4)%4)*10, txt:g=>`Swing your own pick ${g} times`,   cr:2200, sc:4 }) },
  { kind:"smelt",    mk:h=>({ goal: 1,             txt:g=>`Collect an ingot from the smelter`,     cr:3000, sc:6 }) },
  { kind:"fish",     mk:h=>({ goal: 4+(h>>>5)%4,  txt:g=>`Land ${g} fish`,                        cr:2600, sc:5 }) },
  { kind:"rarefish", mk:h=>({ goal: 1+(h>>>6)%2,  txt:g=>`Land ${g} Rare-or-better fish`,         cr:3200, sc:6 }) },
  { kind:"fbounty",  mk:h=>({ goal: 1,             txt:g=>`Strike a bounty at the fishing board`,  cr:3000, sc:6 }) },
  { kind:"pack",     mk:h=>({ goal: 2+(h>>>7)%2,  txt:g=>`Open ${g} card packs`,                  cr:2400, sc:5 }) },
  { kind:"hunt",     mk:h=>({ goal: 8+(h>>>9)%8,  txt:g=>`Slay ${g} beasts in the Hunt`,           cr:2600, sc:5 }) },
];
function lgState(){
  const day = new Date().toDateString();
  if(!state.ledger || state.ledger.day !== day){
    const picked = [];
    const nC = 3 + (((state.upgrades && state.upgrades.foremanTrust)||0) ? 1 : 0);
    let h0 = lgHash(day + "#foreman");
    while(picked.length < nC){
      const cand = LG_POOL[(h0 >>> (picked.length*5)) % LG_POOL.length];
      if(!picked.some(p => p.kind === cand.kind)){
        const h = lgHash(day + "#" + cand.kind);
        const m = cand.mk(h);
        picked.push({ kind: cand.kind, goal: m.goal, txt: m.txt(m.goal), cr: m.cr, sc: m.sc, n:0, claimed:false });
      } else h0 = lgHash(day + "#re" + picked.length + h0);
    }
    state.ledger = { day, items: picked, grand:false };
  }
  return state.ledger;
}
window.feLedgerBump = function(kind, n){
  try{
    const L = lgState();
    let hit = false;
    for(const it of L.items){
      if(it.kind !== kind || it.claimed || it.n >= it.goal) continue;
      it.n = Math.min(it.goal, it.n + (n||1));
      if(it.n >= it.goal){ hit = true; }
    }
    if(hit){
      showToast("📜 Contract fulfilled — the foreman pays in the Play lobby");
      try{ fbSfxSafe && fbSfxSafe("reward_good", 0.35); }catch(e){}
    }
    lgBadge(); lgRender();
  }catch(e){}
};
function lgClaimable(){
  const L = lgState();
  return L.items.some(it => it.n >= it.goal && !it.claimed) ||
         (!L.grand && L.items.every(it => it.claimed));
}
function lgBadge(){
  const btn = document.querySelector('nav button[data-tab="play"]');
  if(!btn) return;
  let dot = btn.querySelector(".lg-dot");
  if(lgClaimable()){
    if(!dot){ dot = document.createElement("span"); dot.className = "lg-dot"; dot.textContent = "●"; btn.appendChild(dot); }
  } else if(dot) dot.remove();
}
function lgRender(){
  const tab = document.getElementById("tab-play");
  if(!tab) return;
  let host = document.getElementById("lgPanel");
  if(!host){
    host = document.createElement("div");
    host.id = "lgPanel"; host.className = "panel lg-panel";
    tab.insertBefore(host, tab.firstChild);
  }
  const L = lgState();
  const rows = L.items.map((it,i)=>{
    const done = it.n >= it.goal;
    const st = it.claimed ? `<span class="lg-done">✔</span>`
      : done ? `<button class="lg-claim" data-lgclaim="${i}">CLAIM 🪙${it.cr.toLocaleString()} · ♻️${it.sc}</button>`
      : `<span class="lg-prog">${it.n}/${it.goal}</span>`;
    return `<div class="lg-row ${done && !it.claimed ? "hot":""}"><span>${it.txt}</span>${st}</div>`;
  }).join("");
  const allClaimed = L.items.every(it=>it.claimed);
  const grand = L.grand
    ? `<div class="lg-row"><span>🎁 The foreman tips his hat. Back tomorrow.</span><span class="lg-done">✔</span></div>`
    : allClaimed
      ? `<div class="lg-row hot"><span>🎁 <b>All three filled</b> — the Prospector's Pack is yours.</span><button class="lg-claim" data-lggrand="1">OPEN IT</button></div>`
      : `<div class="lg-row lg-dim"><span>🎁 Fill all three for the Prospector's Pack — on the house.</span></div>`;
  host.innerHTML = `<div class="lg-head">📜 <b>The Foreman's Ledger</b><i>three contracts, new with the sun</i></div>${rows}${grand}`;
  host.querySelectorAll("[data-lgclaim]").forEach(b => b.onclick = ()=>{
    const it = L.items[+b.dataset.lgclaim];
    if(it.claimed || it.n < it.goal) return;
    it.claimed = true;
    state.credits += it.cr; state.scrap = (state.scrap||0) + Math.round(it.sc * (1 + 0.12*((state.upgrades && state.upgrades.scrapMagnet)||0)));
    try{ renderHeader ? renderHeader() : null; }catch(e){}
    try{ document.getElementById("creditCount").textContent = Math.floor(state.credits).toLocaleString(); }catch(e){}
    showToast(`📜 Contract paid — 🪙${it.cr.toLocaleString()}`);
    try{ fbSfxSafe && fbSfxSafe("finish", 0.4); }catch(e){}
    try{ saveState(); }catch(e){}
    lgBadge(); lgRender();
  });
  const gb = host.querySelector("[data-lggrand]");
  if(gb) gb.onclick = ()=>{
    if(L.grand || !L.items.every(it=>it.claimed)) return;
    L.grand = true;
    try{
      const pk = PACKS.find(p=>p.price1===1000) || PACKS[0];
      const nPk = 1 + (((state.upgrades && state.upgrades.foremanTrust)||0) ? 1 : 0);
      const arr = [];
      for(let q=0;q<nPk;q++) arr.push(openOnePack(pk.key, new Set()));
      startReveal(pk, arr, 0);
      showToast(`🎁 The Prospector's Pack — a ${pk.name} on the house`);
    }catch(e){ state.credits += 10000; showToast("🎁 The foreman pays 🪙10,000 instead"); }
    try{ saveState(); }catch(e){}
    lgBadge(); lgRender();
  };
}
/* packs count themselves, bought or granted alike */
if(typeof startReveal === "function" && !window.__lgPackWrap){
  window.__lgPackWrap = true;
  const _sr = startReveal;
  startReveal = function(pack, packsArr, spent){
    try{ if(spent > 0 || !state.ledger || !state.ledger.grand) window.feLedgerBump("pack", packsArr.length); }catch(e){}
    return _sr(pack, packsArr, spent);
  };
}
/* keep the panel fresh when the lobby renders */
if(typeof renderPlayLobby === "function" && !window.__lgLobbyWrap){
  window.__lgLobbyWrap = true;
  const _rp = renderPlayLobby;
  renderPlayLobby = function(){ const r = _rp.apply(this, arguments); try{ lgRender(); }catch(e){} return r; };
}
setInterval(()=>{ try{ lgBadge(); }catch(e){} }, 4000);
setTimeout(()=>{ try{ lgState(); lgBadge(); lgRender(); }catch(e){} }, 400);
})();
