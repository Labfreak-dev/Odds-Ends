
/* =====================================================================
   CONNECTIONS  —  sixteen cards, four groups of four
   ---------------------------------------------------------------------
   Every card is face up. Every property you need — set, tier, emoji,
   subject — is printed on it. Nothing is hidden and nothing has to be
   remembered: the puzzle is entirely in front of you, and solving it is
   noticing, not recalling.

   The groups come from the card data itself:
     · same set          (Animal Kingdom, Cosmos & Terra …)
     · same rarity tier  (four Practical prints)
     · same emoji        (four cards showing 🐟)
     · same subject      (four prints of one Lion)

   Puzzles are generated so exactly four cards match each rule, which
   makes the partition unique — you can always prove your answer rather
   than guess it. Incidental near-misses of three are left alone on
   purpose; they're the red herrings.

   Host functions expected (all already in index.html):
     cards, RARITIES, MINE_BONUS_BY_TIER, UNIQUE_TIERS,
     state, saveState, showToast, renderHeader,
     grantBonusXP, recomputePlayerXP
   ===================================================================== */

const CX_MISTAKES   = 4;
const CX_CREDITS    = 2600;   // per group solved
const CX_CLEAR_BONUS= 9000;   // for taking all four
const CX_XP_SOLVE   = 14;     // for a full clear
const CX_CARD_ON    = 3;      // groups solved before a print is pulled

/* Difficulty of a rule, used to colour the solved bands and to keep a
   mix of easy and hard in every puzzle. */
const CX_RULES = [
  { id:"subject",  label:"Prints of one thing", rank:0 },
  { id:"emoji",    label:"Same picture",        rank:1 },
  { id:"print",    label:"Same print run",      rank:2 },   /* Dawn Print, Archive Print... */
  { id:"category", label:"One collection",      rank:3 },
  { id:"letter",   label:"Same first letter",   rank:4 },
  { id:"tier",     label:"One rarity",          rank:5 },
];
const CX_BAND = ["#3ddc84","#6c8cff","#c98cff","#ffd35c"];

function cxStats(){
  if(!state.connections){
    state.connections = { played:0, solved:0, perfect:0, groups:0, credits:0, cards:0, streak:0, bestStreak:0 };
  }
  return state.connections;
}

/* ---------- puzzle construction --------------------------------------- */
function cxProp(card, rule){
  if(rule === "subject")  return card.name.split(" — ")[0];
  if(rule === "emoji")    return card.emoji;
  if(rule === "category") return card.category;
  if(rule === "tier")     return RARITIES[card.rarity].name;   /* the name the tile shows, not the 0-15 id */
  if(rule === "print")    return card.name.split(" — ")[1] || "Original";
  if(rule === "letter")   return card.name.split(" — ")[0].trim().charAt(0).toUpperCase();
  return null;
}

/* Index the pool once per puzzle: rule -> value -> [cards] */
function cxIndex(pool){
  const idx = {};
  CX_RULES.forEach(r=>{ idx[r.id] = new Map(); });
  pool.forEach(c=>{
    CX_RULES.forEach(r=>{
      const v = cxProp(c, r.id);
      if(!idx[r.id].has(v)) idx[r.id].set(v, []);
      idx[r.id].get(v).push(c);
    });
  });
  return idx;
}

function cxShuffle(a){
  for(let i = a.length - 1; i > 0; i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* The player's own cards when they have enough of them, otherwise the
   whole catalogue so a new save still gets a puzzle. */
function cxPool(){
  const owned = [];
  for(const id in state.owned){
    if(state.owned[id] > 0){ const c = cards[id]; if(c) owned.push(c); }
  }
  if(owned.length >= 400) return owned;
  const sample = [];
  const step = Math.max(1, Math.floor(cards.length / 4000));
  for(let i = 0; i < cards.length; i += step) sample.push(cards[i]);
  return owned.length > sample.length ? owned : sample;
}

/* Uniqueness, done properly.
   ---------------------------------------------------------------------
   The first version banned any rule from matching four cards it wasn't
   supposed to. That killed every board it generated, and it was the wrong
   target anyway: a rival foursome only breaks the puzzle if the remaining
   twelve can *also* be split three ways. If they can't, it's just a red
   herring — which is the entire appeal of the format.

   So: enumerate every four-card set the player could legitimately justify,
   then count how many ways the sixteen partition into four of them. One
   way means the board is provable and still full of traps. */
function cxAllGroups(board){
  const out = [];
  const seen = new Set();
  for(const r of CX_RULES){
    const buckets = new Map();
    board.forEach(c=>{
      const v = cxProp(c, r.id);
      if(!buckets.has(v)) buckets.set(v, []);
      buckets.get(v).push(c);
    });
    for(const [value, list] of buckets){
      if(list.length < 4) continue;
      if(list.length > 10) return null;   // C(11,4) upward gets silly; discard the board
      const n = list.length;
      const pick = (start, acc)=>{
        if(acc.length === 4){
          const ids = acc.map(c=>c.id).sort((a,b)=>a-b);
          const key = ids.join(",");
          if(!seen.has(key)){ seen.add(key); out.push({ rule:r.id, value, ids:new Set(ids), cards:acc.slice() }); }
          return;
        }
        for(let i = start; i < n; i++){ acc.push(list[i]); pick(i+1, acc); acc.pop(); }
      };
      pick(0, []);
    }
  }
  return out;
}

/* Count exact covers of the sixteen, stopping at two — we only ever need
   to know whether there's more than one.

   Indexed by card: at each step we resolve the lowest uncovered card and
   only consider groups that contain it. Scanning the whole candidate list
   instead took ~3.4s a board, which is far too slow to sit behind a
   button; this brings it under a frame. */
function cxCountPartitions(board, all, limit){
  const ids = board.map(c=>c.id);
  const index = new Map(ids.map((id,i)=>[id,i]));
  const masks = all.map(g=>{
    let m = 0;
    for(const id of g.ids) m |= (1 << index.get(id));
    return m;
  });

  const byCard = Array.from({length:ids.length}, ()=>[]);
  masks.forEach(m=>{
    for(let i = 0; i < ids.length; i++) if(m & (1 << i)) byCard[i].push(m);
  });

  const full = (1 << ids.length) - 1;
  let found = 0;
  const rec = (used)=>{
    if(used === full){ found++; return; }
    let lowest = 0;
    while(used & (1 << lowest)) lowest++;
    const options = byCard[lowest];
    for(let i = 0; i < options.length; i++){
      const m = options[i];
      if(m & used) continue;
      rec(used | m);
      if(found >= limit) return;
    }
  };
  rec(0);
  return found;
}

function cxUnique(board, groups){
  for(const g of groups){
    if(board.filter(c => cxProp(c, g.rule) === g.value).length < 4) return false;
  }
  const all = cxAllGroups(board);
  if(!all || all.length > 2000) return false;
  return cxCountPartitions(board, all, 2) === 1;
}

/* Indexing 3,000+ cards on every deal was most of the generator's cost.
   The binder only changes when a card is added, so key the cache on that. */
let cxCache = null;
function cxCached(){
  const sig = Object.keys(state.owned).length;
  if(cxCache && cxCache.sig === sig) return cxCache;
  const pool = cxPool();
  cxCache = { sig, pool, idx: cxIndex(pool) };
  return cxCache;
}

function cxBuild(){
  const { pool, idx } = cxCached();
  if(pool.length < 60) return null;

  for(let attempt = 0; attempt < 900; attempt++){
    /* Only rules that can actually form a group in this binder, and FOUR
       DIFFERENT ones - two "one collection" bands on a board read as the
       same puzzle twice (batch 119). With six rule types the pool (owned
       binder or a catalogue sample, never under 60 cards) always offers
       four; the pad below is the last resort for a binder that cannot,
       and even then no rule appears more than twice. */
    const viable = CX_RULES.map(r=>r.id)
      .filter(id => { for(const l of idx[id].values()) if(l.length >= 4) return true; return false; });
    if(!viable.length) return null;
    const rules = cxShuffle(viable.slice()).slice(0, 4);
    while(rules.length < 4){
      const cand = viable.filter(id => rules.filter(r=>r===id).length < 2);
      if(!cand.length) break;
      rules.push(cand[Math.floor(Math.random()*cand.length)]);
    }
    if(rules.length < 4) return null;
    const groups = [];
    const taken = new Set();
    let ok = true;
    /* Running count of every property value on the board. Left unchecked,
       a subject group (four Lion prints, all Animal Kingdom, all 🦁) plus
       a category group in that same set stacks eight-plus cards into one
       bucket, which both explodes the combination count and makes rival
       partitions near-certain. Capping growth here took the attempt
       survival rate from 31% to the great majority. */
    const tally = {};
    CX_RULES.forEach(r=>{ tally[r.id] = new Map(); });
    const CAP = 6;

    for(const rule of rules){
      const values = cxShuffle([...idx[rule].entries()].filter(([,l])=> l.length >= 4)).slice(0, 60);
      let picked = null;
      for(const [value, list] of values){
        /* Free cards only, and nothing that already answers to an earlier
           group's rule — that much overlap is never interesting. */
        const free = list.filter(c => !taken.has(c.id) && !groups.some(g => cxProp(c, g.rule) === g.value));
        if(free.length < 4) continue;

        const chosen = [];
        const subjectsUsed = new Set();
        for(const c of cxShuffle(free.slice())){
          if(chosen.length === 4) break;
          /* Only a subject group may stack prints of one thing. Without
             this an emoji group comes out as four Sea Cucumbers, which
             reads exactly like a subject group and makes two of the four
             bands look like the same kind of answer. */
          const subj = c.name.split(" — ")[0];
          if(rule !== "subject" && subjectsUsed.has(subj)) continue;

          let fits = true;
          for(const r of CX_RULES){
            if(r.id === rule) continue;
            const v = cxProp(c, r.id);
            const n = (tally[r.id].get(v)||0) + chosen.filter(x=>cxProp(x, r.id) === v).length + 1;
            if(n > CAP){ fits = false; break; }
          }
          if(fits){ chosen.push(c); subjectsUsed.add(subj); }
        }
        if(chosen.length === 4){ picked = { rule, value, cards: chosen }; break; }
      }
      if(!picked){ ok = false; break; }
      picked.cards.forEach(c=>{
        taken.add(c.id);
        CX_RULES.forEach(r=>{
          const v = cxProp(c, r.id);
          tally[r.id].set(v, (tally[r.id].get(v)||0) + 1);
        });
      });
      groups.push(picked);
    }
    if(!ok || groups.length !== 4) continue;

    const board = groups.flatMap(g => g.cards);
    if(board.length !== 16) continue;
    if(!cxUnique(board, groups)) continue;

    groups.sort((a,b)=>{
      const ra = CX_RULES.find(x=>x.id===a.rule).rank;
      const rb = CX_RULES.find(x=>x.id===b.rule).rank;
      return ra - rb;
    });
    return { groups, board: cxShuffle(board.slice()) };
  }
  return null;
}

function cxGroupLabel(g){
  const rule = CX_RULES.find(r=>r.id === g.rule);
  if(g.rule === "tier")     return `${g.value} — ${rule.label}`;
  if(g.rule === "letter")   return `Starts with ${g.value} — ${rule.label}`;
  if(g.rule === "subject")  return `${g.value} — ${rule.label}`;
  if(g.rule === "emoji")    return `${g.value} — ${rule.label}`;
  return `${g.value} — ${rule.label}`;
}

/* ---------- run state --------------------------------------------------- */
let cx = null;

function cxStart(){
  const p = cxBuild();
  if(!p){
    showToast("Not enough variety in the binder for a puzzle yet. Open a few packs.");
    return;
  }
  cx = { groups:p.groups, board:p.board, picked:[], found:[], mistakes:0,
         over:false, banked:false, note:"", shake:false };
  cxStats().played++;
  saveState();
  cxPaint();
}

function cxToggle(id){
  if(!cx || cx.over) return;
  const i = cx.picked.indexOf(id);
  if(i >= 0) cx.picked.splice(i, 1);
  else if(cx.picked.length < 4) cx.picked.push(id);
  cx.note = "";
  cxPaint();
}

function cxSubmit(){
  if(!cx || cx.over || cx.picked.length !== 4) return;
  const chosen = cx.picked.map(id => cards[id]);

  const hit = cx.groups.find(g =>
    !cx.found.some(f => f.value === g.value && f.rule === g.rule) &&
    chosen.every(c => g.cards.some(x => x.id === c.id)));

  if(hit){
    cx.found.push(hit);
    cx.board = cx.board.filter(c => !hit.cards.some(x => x.id === c.id));
    cx.picked = [];
    cx.note = "";
    cxStats().groups++;
    if(cx.found.length === 4){ cx.over = true; cxFinish(true); return; }
    cxPaint();
    return;
  }

  /* Near miss is the good feedback in this format — it tells you the
     shape of your error without giving the group away. */
  let best = 0;
  cx.groups.forEach(g=>{
    if(cx.found.some(f => f.value === g.value && f.rule === g.rule)) return;
    const n = chosen.filter(c => g.cards.some(x => x.id === c.id)).length;
    if(n > best) best = n;
  });

  cx.mistakes++;
  cx.shake = true;
  cx.note = best === 3 ? "One away." : best === 2 ? "Two of those belong together." : "Nothing there.";
  if(cx.mistakes >= CX_MISTAKES){ cx.over = true; cxFinish(false); return; }
  cxPaint();
  setTimeout(()=>{ if(cx){ cx.shake = false; cxPaint(); } }, 420);
}

function cxShuffleBoard(){
  if(!cx || cx.over) return;
  cxShuffle(cx.board);
  cxPaint();
}
function cxClear(){
  if(!cx || cx.over) return;
  cx.picked = []; cx.note = "";
  cxPaint();
}

function cxFinish(won){
  if(!cx || cx.banked) return;
  cx.banked = true;
  const st = cxStats();

  const credits = cx.found.length * CX_CREDITS + (won ? CX_CLEAR_BONUS : 0);
  const xp = won ? CX_XP_SOLVE : 0;
  state.credits += credits;
  if(xp) grantBonusXP(xp);

  if(won){
    st.solved++;
    st.streak++;
    if(cx.mistakes === 0) st.perfect++;
    if(st.streak > st.bestStreak) st.bestStreak = st.streak;
  } else {
    st.streak = 0;
  }
  st.credits += credits;

  const pulled = cxPull();
  st.cards += pulled.length;

  saveState();
  renderHeader();
  cxPaintSummary(won, credits, xp, pulled);
}

/* A print from one of the groups you actually solved. */
function cxPull(){
  const n = Math.floor(cx.found.length / CX_CARD_ON);
  if(n <= 0) return [];
  const pool = cx.found.flatMap(g => g.cards);
  const out = [];
  while(out.length < n && pool.length){
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

/* ---------- rendering ---------------------------------------------------- */
function cxEl(){ return document.getElementById("cxStage"); }
function cxEsc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

function cxTile(c){
  const r = RARITIES[c.rarity];
  const on = cx.picked.includes(c.id);
  const subject = c.name.split(" — ")[0];
  const variant = c.name.includes(" — ") ? c.name.split(" — ")[1] : "";
  return `<button class="cx-tile${on ? " on" : ""}" data-id="${c.id}">
    <span class="cx-e">${c.emoji}</span>
    <span class="cx-n">${cxEsc(subject)}</span>
    <span class="cx-v">${variant ? cxEsc(variant) : "&nbsp;"}</span>
    <span class="cx-meta">
      <i class="cx-cat">${cxEsc(c.category)}</i>
      <i class="cx-tier" style="color:${r.color}">${cxEsc(r.name)}</i>
    </span>
  </button>`;
}

function cxPaint(){
  const stage = cxEl();
  if(!stage) return;
  if(!cx){ cxPaintLobby(); return; }

  const bands = cx.found.map((g,i)=>`
    <div class="cx-band" style="--bc:${CX_BAND[i]}">
      <b>${cxEsc(cxGroupLabel(g))}</b>
      <span>${g.cards.map(c=>cxEsc(c.emoji + " " + c.name.split(" — ")[0])).join("  ·  ")}</span>
    </div>`).join("");

  const dots = Array.from({length:CX_MISTAKES}, (_,i)=>
    `<span class="cx-dot${i < CX_MISTAKES - cx.mistakes ? "" : " out"}"></span>`).join("");

  stage.innerHTML = `
    <div class="cx-hud">
      <span class="cx-eyebrow">Four groups of four</span>
      <div class="cx-tries">${dots}<span class="cx-trylbl">tries left</span></div>
    </div>

    <div class="cx-bands">${bands}</div>

    <div class="cx-grid${cx.shake ? " shake" : ""}">${cx.board.map(cxTile).join("")}</div>

    <div class="cx-foot">
      <button class="btn secondary" id="cxShuffle">Shuffle</button>
      <button class="btn secondary" id="cxClear" ${cx.picked.length ? "" : "disabled"}>Deselect</button>
      <button class="btn" id="cxSubmit" ${cx.picked.length === 4 ? "" : "disabled"}>Submit</button>
      ${cx.note ? `<span class="cx-note">${cxEsc(cx.note)}</span>` : ""}
    </div>`;

  stage.querySelectorAll(".cx-tile").forEach(b =>
    b.addEventListener("click", ()=> cxToggle(+b.dataset.id)));
  document.getElementById("cxShuffle").addEventListener("click", cxShuffleBoard);
  document.getElementById("cxClear").addEventListener("click", cxClear);
  document.getElementById("cxSubmit").addEventListener("click", cxSubmit);
}

function cxPaintLobby(){
  const stage = cxEl();
  if(!stage) return;
  const st = cxStats();
  const rate = st.played ? Math.round((st.solved / st.played) * 100) : 0;

  stage.innerHTML = `
    <div class="cx-lobby">
      <div class="cx-lede">
        <span class="cx-eyebrow">Connections</span>
        <h3>Sixteen cards. Four groups of four.<br>Everything you need is on the cards.</h3>
        <p>Cards group by the collection they belong to, the rarity they share,
           the picture they show, or by being prints of the same thing. Nothing
           is hidden and nothing needs memorising — find the four sets before
           you run out of tries.</p>
      </div>

      <div class="cx-how">
        ${CX_RULES.map(r=>`<div class="cx-howrow"><b>${cxEsc(r.label)}</b></div>`).join("")}
      </div>

      <div class="cx-lobstats">
        <div><b>${st.solved}</b><span>Solved</span></div>
        <div><b>${rate}%</b><span>Clear rate</span></div>
        <div><b>${st.perfect}</b><span>No mistakes</span></div>
        <div><b>${st.bestStreak}</b><span>Best streak</span></div>
      </div>

      <button class="btn cx-start" id="cxStart">Deal a board</button>
    </div>`;

  document.getElementById("cxStart").addEventListener("click", cxStart);
}

function cxPaintSummary(won, credits, xp, pulled){
  const stage = cxEl();
  if(!stage) return;
  const all = cx.groups.map((g,i)=>{
    const got = cx.found.some(f => f.rule === g.rule && f.value === g.value);
    return `<div class="cx-band${got ? "" : " missed"}" style="--bc:${got ? CX_BAND[cx.found.findIndex(f=>f.rule===g.rule&&f.value===g.value)] : "#4a5270"}">
      <b>${cxEsc(cxGroupLabel(g))}${got ? "" : " — missed"}</b>
      <span>${g.cards.map(c=>cxEsc(c.emoji + " " + c.name.split(" — ")[0])).join("  ·  ")}</span>
    </div>`;
  }).join("");

  stage.innerHTML = `
    <div class="cx-summary">
      <span class="cx-eyebrow">${won ? "Board cleared" : "Out of tries"}</span>
      <h3>${cx.found.length} of 4${won && cx.mistakes === 0 ? " — clean sweep" : ""}</h3>

      <div class="cx-lobstats">
        <div><b>${credits.toLocaleString()}</b><span>Credits</span></div>
        <div><b>${xp}</b><span>XP</span></div>
        <div><b>${cx.mistakes}</b><span>Mistakes</span></div>
      </div>

      <div class="cx-bands">${all}</div>

      ${pulled.length ? `
        <div class="cx-pulled">
          <span class="cx-eyebrow">Pulled from the board</span>
          <div class="cx-pullrow">
            ${pulled.map(p=>{
              const r = RARITIES[p.card.rarity];
              return `<div class="cx-pull" style="--rc:${r.color}">
                ${p.isNew ? `<span class="cx-new">New</span>` : ""}
                <span class="cx-pe">${p.card.emoji}</span>
                <span class="cx-pn">${cxEsc(p.card.name)}</span>
                <span class="cx-pr">${cxEsc(r.name)}</span>
              </div>`;
            }).join("")}
          </div>
        </div>` : ""}

      <div class="cx-foot">
        <button class="btn" id="cxAgain">Deal another</button>
        <button class="btn secondary" id="cxBack">Back</button>
      </div>
    </div>`;

  document.getElementById("cxAgain").addEventListener("click", cxStart);
  document.getElementById("cxBack").addEventListener("click", ()=>{ cx = null; cxPaintLobby(); });
}

/* ---------- host wiring --------------------------------------------------- */
function renderConnections(){ if(cx) cxPaint(); else cxPaintLobby(); }
function cxOnEnterTab(){ cxStats(); renderConnections(); }
function cxOnLeaveTab(){
  /* Leaving mid-board banks whatever groups were already found. */
  if(cx && !cx.over && cx.found.length){ cx.over = true; cxFinish(false); }
  cx = null;
}


