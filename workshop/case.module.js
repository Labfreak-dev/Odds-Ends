/* =====================================================================
   THE CASE  —  fit the hand to the display
   ---------------------------------------------------------------------
   Twelve cards from the binder and a case of five slots, each with a
   written requirement. Every requirement is plain text on the slot and
   every card shows the properties it's judged on, so the puzzle is
   reasoning, never recall.

   Puzzles are built backwards — five cards are chosen first and the
   requirements are derived from them — so a solution always exists. The
   other seven cards are there to make finding it work.

   This is the mode that rewards a broad binder: a wider hand means more
   ways to satisfy an awkward slot, so breadth becomes worth something
   mechanically rather than just on the completion screen.

   Host functions expected (all already in index.html):
     cards, RARITIES, MINE_BONUS_BY_TIER, UNIQUE_TIERS,
     state, saveState, showToast, renderHeader,
     grantBonusXP, recomputePlayerXP
   ===================================================================== */

const CS_HAND     = 12;
const CS_SLOTS    = 5;
const CS_CREDITS  = 3400;    // per slot filled
const CS_SOLVE    = 11000;   // for completing the case
const CS_XP       = 16;
const CS_HINT_COST= 0.45;    // a hint costs this share of the payout

function csStats(){
  if(!state.showcase){
    state.showcase = { played:0, solved:0, perfect:0, slots:0, credits:0, cards:0 };
  }
  return state.showcase;
}

/* ---------- requirement kinds ------------------------------------------
   Each has a test and a label. `rel` kinds compare against the slot to
   the left, which is what stops the case being five independent lookups
   and makes ordering matter. */
const CS_KINDS = [
  { id:"cat",    rel:false,
    make:c=>({ v:c.category }),
    text:r=>`From ${r.v}`,
    ok:(c,r)=> c.category === r.v },

  { id:"minTier", rel:false,
    make:c=>({ v:c.rarity }),
    text:r=>`${RARITIES[r.v].name} or better`,
    ok:(c,r)=> c.rarity >= r.v },

  { id:"maxTier", rel:false,
    make:c=>({ v:c.rarity }),
    text:r=>`${RARITIES[r.v].name} or humbler`,
    ok:(c,r)=> c.rarity <= r.v },

  { id:"emoji",  rel:false,
    make:c=>({ v:c.emoji }),
    text:r=>`Shows ${r.v}`,
    ok:(c,r)=> c.emoji === r.v },

  { id:"rarer",  rel:true,
    make:()=>({}),
    text:()=>`Rarer than the slot on its left`,
    ok:(c,r,left)=> !!left && c.rarity > left.rarity },

  { id:"plainer", rel:true,
    make:()=>({}),
    text:()=>`Humbler than the slot on its left`,
    ok:(c,r,left)=> !!left && c.rarity < left.rarity },

  { id:"sameSet", rel:true,
    make:()=>({}),
    text:()=>`Same collection as the slot on its left`,
    ok:(c,r,left)=> !!left && c.category === left.category },
];

function csKind(id){ return CS_KINDS.find(k=>k.id === id); }
function csShuffle(a){
  for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}

function csPool(){
  const owned = [];
  for(const id in state.owned){
    if(state.owned[id] > 0){ const c = cards[id]; if(c) owned.push(c); }
  }
  if(owned.length >= 120) return owned;
  const sample = [];
  const step = Math.max(1, Math.floor(cards.length / 3000));
  for(let i = 0; i < cards.length; i += step) sample.push(cards[i]);
  return owned.length > sample.length ? owned : sample;
}

/* Build backwards: choose the five that will sit in the case, then write
   requirements they happen to satisfy. */
function csBuild(){
  const pool = csPool();
  if(pool.length < CS_HAND + 4) return null;

  for(let attempt = 0; attempt < 80; attempt++){
    const answer = csShuffle(pool.slice()).slice(0, CS_SLOTS);
    const slots = [];
    let ok = true;

    for(let i = 0; i < CS_SLOTS; i++){
      const card = answer[i];
      const left = i > 0 ? answer[i-1] : null;
      const usable = CS_KINDS.filter(k=>{
        if(k.rel && !left) return false;
        const r = k.make(card);
        return k.ok(card, r, left);
      });
      if(!usable.length){ ok = false; break; }
      /* Prefer a relational requirement when one fits — they're what make
         the case a puzzle instead of a filter. */
      const rel = usable.filter(k=>k.rel);
      const pick = (rel.length && Math.random() < 0.55)
        ? rel[Math.floor(Math.random()*rel.length)]
        : usable[Math.floor(Math.random()*usable.length)];
      slots.push({ kind:pick.id, req:pick.make(card) });
    }
    if(!ok) continue;

    /* A case where one slot accepts almost anything is dull; require that
       at least two slots are genuinely selective against the full hand. */
    const filler = csShuffle(pool.filter(c => !answer.some(a=>a.id === c.id)))
      .slice(0, CS_HAND - CS_SLOTS);
    if(filler.length < CS_HAND - CS_SLOTS) continue;
    const hand = csShuffle(answer.concat(filler));

    const selective = slots.filter((s,i)=>{
      if(csKind(s.kind).rel) return true;
      const n = hand.filter(c => csKind(s.kind).ok(c, s.req, null)).length;
      return n <= Math.ceil(CS_HAND * 0.5);
    }).length;
    if(selective < 2) continue;

    return { slots, hand, answer };
  }
  return null;
}

/* ---------- run --------------------------------------------------------- */
let cs = null;

function csStart(){
  const p = csBuild();
  if(!p){
    showToast("The binder is too thin to lay out a case. Open a few packs.");
    return;
  }
  cs = { slots:p.slots, hand:p.hand, answer:p.answer,
         placed:new Array(CS_SLOTS).fill(null),
         selected:null, hinted:false, done:false, banked:false };
  csStats().played++;
  saveState();
  csPaint();
}

function csCardAt(i){
  const id = cs.placed[i];
  return id == null ? null : cards[id];
}

/* A slot is satisfied when its own test passes against whatever sits to
   its left. Relational slots stay unresolved until the left is filled. */
function csSlotOk(i){
  const card = csCardAt(i);
  if(!card) return null;
  const k = csKind(cs.slots[i].kind);
  const left = i > 0 ? csCardAt(i-1) : null;
  if(k.rel && !left) return null;
  return k.ok(card, cs.slots[i].req, left);
}

function csPick(id){
  if(!cs || cs.done) return;
  cs.selected = cs.selected === id ? null : id;
  csPaint();
}

function csPlace(slot){
  if(!cs || cs.done) return;
  if(cs.placed[slot] != null){    // tap a filled slot to clear it
    cs.placed[slot] = null;
    csPaint();
    return;
  }
  if(cs.selected == null) return;
  const already = cs.placed.indexOf(cs.selected);
  if(already >= 0) cs.placed[already] = null;
  cs.placed[slot] = cs.selected;
  cs.selected = null;
  csCheck();
}

function csCheck(){
  const full = cs.placed.every(v => v != null);
  if(full && cs.slots.every((s,i)=> csSlotOk(i) === true)){
    cs.done = true;
    csFinish(true);
    return;
  }
  csPaint();
}

function csHint(){
  if(!cs || cs.done || cs.hinted) return;
  cs.hinted = true;
  /* Fill the first empty slot with a card that genuinely works there. */
  const i = cs.placed.findIndex(v => v == null);
  if(i >= 0){
    const card = cs.answer[i];
    const already = cs.placed.indexOf(card.id);
    if(already >= 0) cs.placed[already] = null;
    cs.placed[i] = card.id;
  }
  csCheck();
}

function csGiveUp(){
  if(!cs || cs.done) return;
  cs.done = true;
  csFinish(false);
}

function csFinish(won){
  if(!cs || cs.banked) return;
  cs.banked = true;
  const st = csStats();

  const filled = cs.slots.filter((s,i)=> csSlotOk(i) === true).length;
  let credits = filled * CS_CREDITS + (won ? CS_SOLVE : 0);
  let xp = won ? CS_XP : 0;
  if(cs.hinted){ credits = Math.round(credits * (1 - CS_HINT_COST)); xp = Math.round(xp * (1 - CS_HINT_COST)); }

  state.credits += credits;
  if(xp > 0) grantBonusXP(xp);

  st.slots += filled;
  st.credits += credits;
  if(won){ st.solved++; if(!cs.hinted) st.perfect++; }

  const pulled = csPull(won);
  st.cards += pulled.length;

  saveState();
  renderHeader();
  csPaintSummary(won, filled, credits, xp, pulled);
}

/* Completing a case earns a print of something that went into it. */
function csPull(won){
  if(!won) return [];
  const pool = cs.placed.map(id => cards[id]).filter(Boolean);
  const out = [];
  while(out.length < 1 && pool.length){
    const unowned = pool.filter(c => !(state.owned[c.id] > 0));
    const src = unowned.length ? unowned : pool;
    const card = src[Math.floor(Math.random()*src.length)];
    pool.splice(pool.indexOf(card), 1);
    if(UNIQUE_TIERS.has(card.rarity) && (state.owned[card.id]||0) > 0) continue;
    const had = state.owned[card.id] || 0;
    if(had === 0) state.miningBonus = (state.miningBonus||0) + MINE_BONUS_BY_TIER[card.rarity];
    state.owned[card.id] = had + 1;
    out.push({ card, isNew: had === 0 });
  }
  if(out.length) recomputePlayerXP();
  return out;
}

/* ---------- rendering ----------------------------------------------------- */
function csEl(){ return document.getElementById("csStage"); }
function csEsc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

function csPaint(){
  const stage = csEl();
  if(!stage) return;
  if(!cs){ csPaintLobby(); return; }

  const slotHTML = cs.slots.map((s,i)=>{
    const card = csCardAt(i);
    const ok = csSlotOk(i);
    const cls = "cs-slot" + (card ? " full" : "") + (ok === true ? " ok" : ok === false ? " bad" : "");
    const r = card ? RARITIES[card.rarity] : null;
    return `<div class="${cls}" data-slot="${i}" style="${r ? `--rc:${r.color}` : ""}">
      <div class="cs-req">${csEsc(csKind(s.kind).text(s.req))}</div>
      <div class="cs-well">
        ${card ? `
          <span class="cs-se">${card.emoji}</span>
          <span class="cs-sn">${csEsc(card.name.split(" — ")[0])}</span>
          <span class="cs-sr" style="color:${r.color}">${csEsc(r.name)}</span>`
        : `<span class="cs-empty">empty</span>`}
      </div>
    </div>`;
  }).join("");

  const handHTML = cs.hand.map(c=>{
    const used = cs.placed.includes(c.id);
    const on = cs.selected === c.id;
    const r = RARITIES[c.rarity];
    return `<button class="cs-card${used ? " used" : ""}${on ? " on" : ""}" data-id="${c.id}" ${used ? "disabled" : ""}>
      <span class="cs-ce">${c.emoji}</span>
      <span class="cs-cn">${csEsc(c.name.split(" — ")[0])}</span>
      <span class="cs-cm">
        <i>${csEsc(c.category)}</i>
        <i style="color:${r.color}">${csEsc(r.name)}</i>
      </span>
    </button>`;
  }).join("");

  const filled = cs.slots.filter((s,i)=> csSlotOk(i) === true).length;

  stage.innerHTML = `
    <div class="cs-hud">
      <span class="cs-eyebrow">The Case</span>
      <span class="cs-prog">${filled} of ${CS_SLOTS} slots satisfied</span>
    </div>

    <div class="cs-case">${slotHTML}</div>

    <div class="cs-handhead">
      <span class="cs-eyebrow">Your hand</span>
      <span class="cs-hint">Pick a card, then tap a slot. Tap a filled slot to take it back.</span>
    </div>
    <div class="cs-hand">${handHTML}</div>

    <div class="cs-foot">
      <button class="btn secondary" id="csHint" ${cs.hinted ? "disabled" : ""}>
        ${cs.hinted ? "Hint used" : "Place one for me (−45%)"}
      </button>
      <button class="btn secondary" id="csGiveUp">Give up</button>
    </div>`;

  stage.querySelectorAll(".cs-card").forEach(b =>
    b.addEventListener("click", ()=> csPick(+b.dataset.id)));
  stage.querySelectorAll(".cs-slot").forEach(d =>
    d.addEventListener("click", ()=> csPlace(+d.dataset.slot)));
  document.getElementById("csHint").addEventListener("click", csHint);
  document.getElementById("csGiveUp").addEventListener("click", ()=>{
    if(confirm("Give up on this case and bank the slots you filled?")) csGiveUp();
  });
}

function csPaintLobby(){
  const stage = csEl();
  if(!stage) return;
  const st = csStats();
  const rate = st.played ? Math.round((st.solved / st.played) * 100) : 0;

  stage.innerHTML = `
    <div class="cs-lobby">
      <div class="cs-lede">
        <span class="cs-eyebrow">The Case</span>
        <h3>Five slots, each with a rule.<br>Twelve cards. Make them fit.</h3>
        <p>Some slots want a collection or a rarity floor. Others compare against
           the slot on their left — rarer than, humbler than, same collection as —
           so the order you fill them in matters. Every rule is written on the
           slot and every card shows what it's judged on.</p>
        <p class="cs-broad">A wider binder deals a wider hand, which is the point:
           this is the one mode where owning many different things beats owning
           a few good ones.</p>
      </div>

      <div class="cs-lobstats">
        <div><b>${st.solved}</b><span>Cases closed</span></div>
        <div><b>${rate}%</b><span>Solve rate</span></div>
        <div><b>${st.perfect}</b><span>Without a hint</span></div>
        <div><b>${st.credits.toLocaleString()}</b><span>Lifetime take</span></div>
      </div>

      <button class="btn cs-start" id="csStart">Lay out a case</button>
    </div>`;

  document.getElementById("csStart").addEventListener("click", csStart);
}

function csPaintSummary(won, filled, credits, xp, pulled){
  const stage = csEl();
  if(!stage) return;

  const reveal = cs.slots.map((s,i)=>{
    const want = cs.answer[i];
    const got = csCardAt(i);
    const good = csSlotOk(i) === true;
    return `<div class="cs-rev${good ? " ok" : ""}">
      <b>${csEsc(csKind(s.kind).text(s.req))}</b>
      <span>${good && got
        ? `${got.emoji} ${csEsc(got.name.split(" — ")[0])}`
        : `one that works: ${want.emoji} ${csEsc(want.name.split(" — ")[0])}`}</span>
    </div>`;
  }).join("");

  stage.innerHTML = `
    <div class="cs-summary">
      <span class="cs-eyebrow">${won ? "Case closed" : "Case left open"}</span>
      <h3>${filled} of ${CS_SLOTS} satisfied${won && !cs.hinted ? " — unaided" : ""}</h3>

      <div class="cs-lobstats">
        <div><b>${credits.toLocaleString()}</b><span>Credits</span></div>
        <div><b>${xp}</b><span>XP</span></div>
      </div>

      <div class="cs-reveal">${reveal}</div>

      ${pulled.length ? `
        <div class="cs-pulled">
          <span class="cs-eyebrow">Kept from the case</span>
          <div class="cs-pullrow">
            ${pulled.map(p=>{
              const r = RARITIES[p.card.rarity];
              return `<div class="cs-pull" style="--rc:${r.color}">
                ${p.isNew ? `<span class="cs-new">New</span>` : ""}
                <span class="cs-pe">${p.card.emoji}</span>
                <span class="cs-pn">${csEsc(p.card.name)}</span>
                <span class="cs-pr">${csEsc(r.name)}</span>
              </div>`;
            }).join("")}
          </div>
        </div>` : ""}

      <div class="cs-foot">
        <button class="btn" id="csAgain">Lay out another</button>
        <button class="btn secondary" id="csBack">Back</button>
      </div>
    </div>`;

  document.getElementById("csAgain").addEventListener("click", csStart);
  document.getElementById("csBack").addEventListener("click", ()=>{ cs = null; csPaintLobby(); });
}

/* ---------- host wiring ----------------------------------------------------- */
function renderCase(){ if(cs) csPaint(); else csPaintLobby(); }
function csOnEnterTab(){ csStats(); renderCase(); }
function csOnLeaveTab(){
  if(cs && !cs.done && cs.placed.some(v=>v != null)){ cs.done = true; csFinish(false); }
  cs = null;
}
