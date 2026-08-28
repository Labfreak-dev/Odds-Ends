
/* ============================================================
   THE SALESMAN'S FEED + BINDER SALES — every card has a true
   value and a seller who may or may not know it. Buy low from
   the clueless, dodge the fakes, and list your own cardboard
   for buyers who nibble, stall, or bail.
   ============================================================ */
(function(){
const M2_PERSONAS = [
  { key:"uncle",  w:18, icon:"🧓", name:"Clueless Uncle",  mult:[0.35,0.7],
    lines:["found in the attic, no idea","grandkids lost interest","is this worth anything lol","garage cleanout, priced to move"] },
  { key:"hype",   w:22, icon:"📢", name:"Hype Merchant",   mult:[1.7,2.8],
    lines:["INVESTMENT GRADE 🚀","this one's going to the moon","last one sold for double (trust me)","banger alert. serious buyers only"] },
  { key:"scam",   w:12, icon:"🕶️", name:"definitely_real_cards", mult:[0.45,0.75], fake:0.55,
    lines:["100% authentic no refunds","ships from an undisclosed location","photo is 'representative'","totally legit, why do you ask"] },
  { key:"fair",   w:40, icon:"🧑‍💼", name:"Fair Dealer",     mult:[0.9,1.15],
    lines:["priced off last week's sales","honest wear, honest price","smoke-free binder","what it's worth, no games"] },
  { key:"vault",  w:8,  icon:"🎩", name:"VaultDealer",     mult:[1.25,1.6], minR:9,
    lines:["curated. authenticated. expensive.","museum quality, museum price","for the discerning collector","you get what you pay for"] },
];
function m2TrueVal(c){
  let v = MARKET_BUY_PRICE_BY_TIER[c.rarity];
  const g = state.grading && state.grading.graded && state.grading.graded[c.id];
  if(g) v = Math.round(v * (0.5 + g*0.15));
  return v;
}
function m2Persona(rng){
  let tot = 0; for(const p of M2_PERSONAS) tot += p.w;
  let x = rng()*tot;
  for(const p of M2_PERSONAS){ x -= p.w; if(x <= 0) return p; }
  return M2_PERSONAS[3];
}
function m2RollCard(rng, minR){
  for(let a=0;a<400;a++){
    const c = cards[Math.floor(rng()*cards.length)];
    if(!c) continue;
    if(typeof EXCLUSIVE_CATEGORIES !== "undefined" && EXCLUSIVE_CATEGORIES.has(c.category)) continue;
    if(minR && c.rarity < minR) continue;
    return c;
  }
  return cards[0];
}
/* the feed replaces the old uniform stock */
generateMarketOffers = function(bucket, size){
  const rng = mulberry32(bucket);
  const offers = [];
  const used = new Set();
  const backroom = ((state.upgrades && state.upgrades.backRoom)||0) ? 1 : 0;
  while(offers.length < size + backroom){
    const isLast = backroom && offers.length === size + backroom - 1;
    if(isLast){
      if(rng() < 0.5){
        const c = m2RollCard(rng, 9);
        offers.push({ kind:"card", cardId:c.id, sold:false, persona:"vault",
          price: Math.max(5, Math.round(m2TrueVal(c) * (1.25 + rng()*0.35))),
          fake:false, line:"from the back room. don't touch the glass." });
      } else {
        const n = 5 + Math.floor(rng()*2);
        offers.push({ kind:"lot", n, sold:false, price: Math.round((200 + rng()*400) * n),
          line:"the back-room lot. sealed twice." });
      }
      continue;
    }
    const roll = rng();
    if(roll < 0.16 && typeof PACKS !== "undefined"){          /* a sealed pack, price wobbling */
      const pk = PACKS[Math.floor(rng()*Math.min(PACKS.length,4))];
      if(!pk || pk.earnOnly){ continue; }
      const mult = 0.55 + rng()*0.95;
      offers.push({ kind:"pack", packKey:pk.key, sold:false,
        price: Math.max(50, Math.round(pk.price1 * mult)),
        line: mult < 0.85 ? "sealed. probably. dented corner" : "sealed, straight from a case (he says)" });
      continue;
    }
    if(roll < 0.28){                                          /* the mystery lot */
      const n = 4 + Math.floor(rng()*2);
      offers.push({ kind:"lot", n, sold:false,
        price: Math.round((120 + rng()*380) * n),
        line: ["unsearched, i swear","from a storage unit","my brother's collection, don't ask","binder page fell in a puddle once"][Math.floor(rng()*4)] });
      continue;
    }
    const p = m2Persona(rng);
    const c = m2RollCard(rng, p.minR);
    if(used.has(c.id)) continue;
    used.add(c.id);
    const mult = p.mult[0] + rng()*(p.mult[1]-p.mult[0]);
    offers.push({ kind:"card", cardId:c.id, sold:false, persona:p.key,
      price: Math.max(5, Math.round(m2TrueVal(c) * mult)),
      fake: p.fake ? (rng() < p.fake) : false,
      line: p.lines[Math.floor(rng()*p.lines.length)] });
  }
  return offers;
};
/* THE COUNTER — one visitor at a time. No scroll, just people. */
const M2_HAGGLE = {
  uncle: { odds:0.7,  cut:0.18, yes:"oh! sure, that seems fair.", no:"the wife said not below that, sorry." },
  fair:  { odds:0.55, cut:0.10, yes:"you drive a fair bargain. done.", no:"that's already the honest price, friend." },
  hype:  { odds:0.25, cut:0.12, yes:"ugh. FINE. you're robbing me.", no:"full price, champ. this thing PRINTS." },
  scam:  { odds:1.0,  cut:0.25, yes:"deal deal deal. great doing business.", no:"" },
  vault: { odds:0.0,  cut:0,    yes:"", no:"we do not *haggle* here. that's five percent more for asking.", bump:0.05 },
  lotpk: { odds:0.5,  cut:0.12, yes:"take it, it's been sitting.", no:"sealed is sealed. price stands." },
};
function m2Cursor(){
  const of = state.market.offers;
  for(let i=0;i<of.length;i++) if(!of[i].sold && !of[i].passed) return i;
  return -1;
}
renderMarketOffers = function(){
  ensureMarketFresh();
  const grid = document.getElementById("marketGrid");
  if(!grid) return;
  const of = state.market.offers;
  const i = m2Cursor();
  const seen = of.filter(o=>o.sold||o.passed).length;
  if(i < 0){
    grid.innerHTML = `<div class="m2-quiet">🚪 The shop's quiet — everyone's been seen.<br>
      <i>${of.filter(o=>o.sold).length} deals done, ${of.filter(o=>o.passed).length} sent walking. Restock's coming.</i></div>`;
    return;
  }
  const o = of[i];
  let who, art, name, band = "", pitch = o.line;
  if(o.kind === "pack"){
    const pk = PACKS.find(p=>p.key===o.packKey) || {};
    who = "📦 A courier with a sealed box"; art = "🎴"; name = pk.name || "Pack";
  } else if(o.kind === "lot"){
    who = "🧳 Somebody clearing a storage unit"; art = "❔"; name = `${o.n} unsearched cards`;
  } else {
    const c = cards[o.cardId]; const p = M2_PERSONAS.find(x=>x.key===o.persona) || M2_PERSONAS[3];
    if(o.fake && ((state.upgrades && state.upgrades.fakeSpotter)||0) && o.sniff === undefined) o.sniff = Math.random() < 0.5;
    const r = RARITIES[c.rarity];
    who = `${p.icon} ${p.name}`; art = c.emoji; name = c.name;
    band = `<div class="m2-band" style="color:${r.color}">${r.name}</div>`;
  }
  const price = o.hagglePrice || o.price;
  grid.innerHTML = `<div class="m2-counter">
    <div class="m2-visitn">visitor ${seen+1} of ${of.length}</div>
    <div class="m2-visitor">${who}</div>
    <div class="m2-bubble">"${o.reply || pitch}"${o.sniff ? `<div class="m2-sniff">👃 something smells off about this one…</div>` : ""}</div>
    <div class="m2-itemrow"><span class="m2-art">${art}</span>
      <span><div class="m2-name">${name}</div>${band}</span></div>
    <div class="m2-price">🪙 ${price.toLocaleString()}${o.hagglePrice ? ` <s>${o.price.toLocaleString()}</s>` : ""}</div>
    <div class="m2-acts">
      <button class="m2-act buy" id="m2Buy">🤝 Buy it</button>
      <button class="m2-act" id="m2Hag" ${o.haggled ? "disabled" : ""}>💬 Bargain</button>
      <button class="m2-act" id="m2Pass">👋 No way</button>
    </div></div>`;
  document.getElementById("m2Buy").onclick = ()=> m2Buy(i);
  document.getElementById("m2Pass").onclick = ()=>{
    o.passed = true; try{ saveState(); }catch(e){} renderMarketOffers();
  };
  const hb = document.getElementById("m2Hag");
  if(hb) hb.onclick = ()=>{
    if(o.haggled) return;
    o.haggled = true;
    const key = o.kind ? "lotpk" : (o.persona || "fair");
    const H = M2_HAGGLE[key === "card" ? "fair" : key] || M2_HAGGLE.fair;
    const bonus = 0.15*Math.min(2,((state.upgrades && state.upgrades.silverTongue)||0)) + (((state.upgrades && state.upgrades.masterwork)||0) ? 0.10 : 0);
    if(H.bump){ o.price = Math.round(o.price * (1 + H.bump)); o.reply = H.no; }
    else if(Math.random() < Math.min(0.95, H.odds + bonus)){ o.hagglePrice = Math.round(o.price * (1 - H.cut)); o.reply = H.yes; }
    else { o.reply = H.no; if(((state.upgrades && state.upgrades.silverTongue)||0) >= 2 && !o.haggled2){ o.haggled2 = true; o.haggled = false; o.reply += " …though you sense one more push might land."; } }
    try{ fbSfxSafe && fbSfxSafe("equip", 0.25); }catch(e){}
    try{ saveState(); }catch(e){}
    renderMarketOffers();
  };
};
function m2Buy(i){
  ensureMarketFresh();
  const o = state.market.offers[i];
  if(!o || o.sold) return;
  const pay = o.hagglePrice || o.price;
  if(state.credits < pay){ showToast("Not enough credits for that deal"); return; }
  state.credits -= pay;
  o.sold = true;
  if(o.kind === "pack"){
    const pk = PACKS.find(p=>p.key===o.packKey);
    try{ const pulls = openOnePack(pk.key, new Set()); startReveal(pk, [pulls], (o.hagglePrice||o.price)); }catch(e){}
  } else if(o.kind === "lot"){
    /* roll the lot with the game's own rarity weights, open it like a pack */
    const pulls = [];
    for(let k=0;k<o.n;k++) pulls.push(m2RollCard(Math.random, 0));
    try{ startReveal({ name:"Mystery Lot", key:"m2lot" }, [pulls], (o.hagglePrice||o.price)); }catch(e){
      pulls.forEach(c=>{ state.owned[c.id]=(state.owned[c.id]||0)+1; });
      showToast("📦 The lot's yours — "+o.n+" cards to the binder");
    }
  } else if(o.fake){
    state.scrap = (state.scrap||0) + 3;
    showToast("🕶️ It never ships. The listing vanishes. (+3 ♻️ — the sleeve was real)");
    try{ fbSfxSafe && fbSfxSafe("splash_small", 0.4); }catch(e){}
  } else {
    const c = cards[o.cardId];
    state.owned[c.id] = (state.owned[c.id]||0) + 1;
    state.miningBonus = computeMiningBonusFromOwned(state.owned);
    showToast(`🤝 ${c.name} is yours — check the binder`);
    try{ fbSfxSafe && fbSfxSafe("reward_good", 0.4); }catch(e){}
  }
  try{ saveState(); renderHeader(); }catch(e){}
  renderMarketOffers();
}

/* ================= BINDER SALES ================= */
state.binderSales = state.binderSales || [];
const M2_TIERS = [
  { key:"quick",  label:"Quick sale",  mult:0.75, secs:90,   chance:1.0,  note:"sells fast, sure thing" },
  { key:"fair",   label:"Fair price",  mult:1.0,  secs:480,  chance:0.9,  note:"most buyers show up" },
  { key:"greedy", label:"Greedy",      mult:1.45, secs:1200, chance:0.6,  note:"someone MIGHT bite" },
];
let m2SellMode = false;
function m2InjectSellUI(){
  const grid = document.getElementById("collectionGrid");
  if(!grid || document.getElementById("m2SellBar")) return;
  const bar = document.createElement("div");
  bar.id = "m2SellBar";
  bar.innerHTML = `<button class="m2-sellmode" id="m2SellToggle">💰 Sell mode: <b>off</b></button>
    <span class="m2-selltip">arm it, then tap any card you own to list it</span>
    <div id="m2Listings"></div>`;
  grid.parentElement.insertBefore(bar, grid);
  document.getElementById("m2SellToggle").onclick = ()=>{
    m2SellMode = !m2SellMode;
    document.getElementById("m2SellToggle").innerHTML = `💰 Sell mode: <b>${m2SellMode?"ON":"off"}</b>`;
    grid.classList.toggle("m2-armed", m2SellMode);
  };
  grid.addEventListener("click", (e)=>{
    if(!m2SellMode) return;
    const el = e.target.closest(".mini-card[data-cid]");
    if(!el) return;
    const id = el.dataset.cid;
    if(!(state.owned[id] > 0)) return;
    e.stopPropagation(); e.preventDefault();
    m2SellSheet(id);
  }, true);
}
function m2SellSheet(id){
  const c = cards[id]; if(!c) return;
  const tv = m2TrueVal(c);
  const g = state.grading && state.grading.graded && state.grading.graded[id];
  let m = document.getElementById("m2Sheet"); if(m) m.remove();
  m = document.createElement("div"); m.id = "m2Sheet";
  m.innerHTML = `<div class="m2-sheet">
    <div class="m2-sh-head">${c.emoji} <b>${c.name}</b>${g ? ` <span class="m2-slabchip">SLAB ${g}</span>`:""}</div>
    <div class="m2-sh-est">the going rate: ~🪙${tv.toLocaleString()} · house takes 10%</div>
    ${M2_TIERS.map(t=>`<button class="m2-sh-opt" data-m2list="${t.key}">
      <b>${t.label}</b> — 🪙${Math.round(tv*t.mult).toLocaleString()} <i>${t.note}</i></button>`).join("")}
    <button class="m2-sh-x" id="m2SheetX">never mind</button></div>`;
  document.body.appendChild(m);
  document.getElementById("m2SheetX").onclick = ()=> m.remove();
  m.querySelectorAll("[data-m2list]").forEach(b => b.onclick = ()=>{
    const t = M2_TIERS.find(x=>x.key===b.dataset.m2list);
    if((state.owned[id]||0) <= 0) { m.remove(); return; }
    if(state.owned[id] === 1 && !confirm(`List your last copy of "${c.name}"? It leaves the binder while listed.`)){ return; }
    state.owned[id] -= 1;
    state.miningBonus = computeMiningBonusFromOwned(state.owned);
    const ch = ((state.upgrades && state.upgrades.storeSign)||0) ? 1 - (1 - t.chance)/2 : t.chance;
    state.binderSales.push({ id, price: Math.round(tv*t.mult), due: Date.now()+t.secs*1000, chance: ch });
    showToast(`💰 ${c.name} is listed — ${t.label.toLowerCase()}`);
    try{ saveState(); renderMiningStats && renderMiningStats(); }catch(e){}
    m.remove(); m2RenderListings();
  });
}
function m2RenderListings(){
  const host = document.getElementById("m2Listings");
  if(!host) return;
  if(!state.binderSales.length){ host.innerHTML = ""; return; }
  host.innerHTML = state.binderSales.map(L=>{
    const c = cards[L.id];
    const left = Math.max(0, Math.ceil((L.due-Date.now())/1000));
    return `<span class="m2-live">${c?c.emoji:"🎴"} 🪙${L.price.toLocaleString()} · ${left>0? left+"s" : "…"}</span>`;
  }).join("");
}
function m2Resolve(){
  let changed = false;
  for(let i=state.binderSales.length-1; i>=0; i--){
    const L = state.binderSales[i];
    if(Date.now() < L.due) continue;
    state.binderSales.splice(i,1);
    const c = cards[L.id];
    if(Math.random() < L.chance){
      const net = Math.round(L.price * (((state.upgrades && state.upgrades.storeSign)||0) ? 0.93 : 0.9));
      state.credits += net;
      showToast(`🤝 SOLD — ${c?c.name:"card"} for 🪙${L.price.toLocaleString()} (you keep ${net.toLocaleString()})`);
      try{ fbSfxSafe && fbSfxSafe("treasure", 0.4); }catch(e){}
    } else {
      state.owned[L.id] = (state.owned[L.id]||0) + 1;
      state.miningBonus = computeMiningBonusFromOwned(state.owned);
      showToast(`👻 The buyer bailed — ${c?c.name:"the card"} is back in your binder`);
    }
    changed = true;
  }
  if(changed){ try{ saveState(); renderHeader(); }catch(e){} }
  m2RenderListings();
}
setInterval(()=>{ try{ m2InjectSellUI(); m2Resolve(); }catch(e){} }, 1000);
setTimeout(()=>{ try{ m2InjectSellUI(); }catch(e){} }, 600);
})();


