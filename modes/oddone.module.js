/* =====================================================================
   ODD ONE OUT  —  three belong together, one doesn't
   ---------------------------------------------------------------------
   Four cards. Three share something; one is the exception. Ten seconds.

   The shared thing is always a property printed on the cards — set,
   rarity, picture, subject — so like Connections this is noticing rather
   than remembering. It is the shallow, fast member of the set: runs last
   under a minute and it works one-handed on a phone.

   Every round is verified to have exactly one defensible answer before
   it's shown. A round where two different cards could each be argued as
   the odd one is discarded rather than served.

   Host functions expected (all already in index.html):
     cards, RARITIES, MINE_BONUS_BY_TIER, UNIQUE_TIERS,
     state, saveState, showToast, renderHeader,
     grantBonusXP, recomputePlayerXP
   ===================================================================== */

const OO_LIVES      = 3;
const OO_TIME_START = 10000;
const OO_TIME_FLOOR = 5000;
const OO_TIME_STEP  = 180;
const OO_BASE       = 180;    // credits per correct call
const OO_XP_PER_10  = 10;
const OO_CARD_EVERY = 12;

const OO_PROPS = [
  { id:"category", label:"collection", of:c=>c.category },
  { id:"tier",     label:"rarity",     of:c=>RARITIES[c.rarity].name },   /* the NAME the tile shows - ids 0/1/2 are all "Common" */
  { id:"emoji",    label:"picture",    of:c=>c.emoji },
  { id:"subject",  label:"subject",    of:c=>c.name.split(" — ")[0] },
];
function ooProp(id){ return OO_PROPS.find(p=>p.id === id); }

function ooStats(){
  if(!state.oddone){
    state.oddone = { runs:0, best:0, calls:0, right:0, credits:0, cards:0, bestStreak:0 };
  }
  return state.oddone;
}

function ooShuffle(a){
  for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}
function ooPool(){
  const owned = [];
  for(const id in state.owned){
    if(state.owned[id] > 0){ const c = cards[id]; if(c) owned.push(c); }
  }
  if(owned.length >= 200) return owned;
  const sample = [];
  const step = Math.max(1, Math.floor(cards.length / 3000));
  for(let i = 0; i < cards.length; i += step) sample.push(cards[i]);
  return owned.length > sample.length ? owned : sample;
}

/* How many cards in the set of four are the sole exception on some
   property. The round is only fair when that count is exactly one. */
function ooOutliers(four){
  const out = [];
  for(let i = 0; i < 4; i++){
    const rest = four.filter((_,j)=> j !== i);
    const props = OO_PROPS.filter(p=>{
      const v = p.of(rest[0]);
      return rest.every(c => p.of(c) === v) && p.of(four[i]) !== v;
    });
    if(props.length) out.push({ index:i, props });
  }
  return out;
}

function ooMakeRound(round){
  const pool = ooPool();
  if(pool.length < 40) return null;
  const tighten = round >= 8;   // later rounds share two properties, not one

  for(let attempt = 0; attempt < 120; attempt++){
    const prop = OO_PROPS[Math.floor(Math.random()*OO_PROPS.length)];

    /* Three that agree on the chosen property. */
    const seed = pool[Math.floor(Math.random()*pool.length)];
    const v = prop.of(seed);
    const matches = pool.filter(c => prop.of(c) === v);
    if(matches.length < 3) continue;
    const three = ooShuffle(matches.slice()).slice(0, 3);

    /* And one that doesn't. Later on, make it agree with the others on a
       second property so the difference is less obvious. */
    let oddPool = pool.filter(c => prop.of(c) !== v && !three.some(t=>t.id === c.id));
    if(tighten){
      const other = OO_PROPS.filter(p=>p.id !== prop.id)[Math.floor(Math.random()*3)];
      const shared = other.of(three[0]);
      if(three.every(c => other.of(c) === shared)){
        const tighter = oddPool.filter(c => other.of(c) === shared);
        if(tighter.length >= 1) oddPool = tighter;
      }
    }
    if(!oddPool.length) continue;
    const odd = oddPool[Math.floor(Math.random()*oddPool.length)];

    const four = ooShuffle(three.concat([odd]));
    const outliers = ooOutliers(four);

    /* Exactly one card may be arguable as the exception, or the round has
       two right answers and punishes a correct read. */
    if(outliers.length !== 1) continue;
    const answer = outliers[0];
    if(four[answer.index].id !== odd.id) continue;

    return {
      cards: four,
      correct: answer.index,
      props: answer.props,
      shared: prop,
      ms: Math.max(OO_TIME_FLOOR, OO_TIME_START - round * OO_TIME_STEP)
    };
  }
  return null;
}

/* ---------- run ---------------------------------------------------------- */
let oo = null;
let ooTimer = null;

function ooStart(){
  oo = { round:0, lives:OO_LIVES, streak:0, right:0, credits:0,
         seen:[], q:null, locked:false, deadline:0, lastGain:null };
  ooNext();
}

function ooNext(){
  if(!oo) return;
  if(oo.lives <= 0){ ooEnd(); return; }
  const q = ooMakeRound(oo.round);
  if(!q){ ooEnd("Couldn't lay out a fair round."); return; }
  oo.round++;
  oo.q = q;
  oo.locked = false;
  oo.deadline = Date.now() + q.ms;
  ooPaint();
  ooClock();
}

function ooClock(){
  ooStopClock();
  ooTimer = setInterval(()=>{
    if(!oo || !oo.q || oo.locked) return ooStopClock();
    const left = oo.deadline - Date.now();
    const el = document.getElementById("ooClock");
    if(el) el.style.width = Math.max(0, (left / oo.q.ms) * 100) + "%";
    if(left <= 0){ ooStopClock(); ooCall(-1); }
  }, 80);
}
function ooStopClock(){ if(ooTimer){ clearInterval(ooTimer); ooTimer = null; } }

function ooCall(idx){
  if(!oo || !oo.q || oo.locked) return;
  oo.locked = true;
  ooStopClock();
  const q = oo.q;
  const right = idx === q.correct;
  const speed = Math.max(0, (oo.deadline - Date.now()) / q.ms);

  if(right){
    const mult = 1 + Math.min(oo.streak, 15) * 0.09;
    const credits = Math.round(OO_BASE * mult * (1 + speed * 0.7));
    oo.streak++; oo.right++; oo.credits += credits;
    oo.seen.push(q.cards[q.correct]);
    oo.lastGain = { credits, timedOut:false };
  } else {
    oo.streak = 0; oo.lives--;
    oo.lastGain = { credits:0, timedOut: idx === -1 };
  }

  const st = ooStats();
  st.calls++;
  if(right) st.right++;
  if(oo.streak > st.bestStreak) st.bestStreak = oo.streak;

  ooPaint(true, idx);
}

function ooEnd(note){
  if(!oo) return;
  ooStopClock();
  const run = oo;
  const st = ooStats();
  const xp = Math.floor(run.right / 10) * OO_XP_PER_10;

  state.credits += run.credits;
  if(xp > 0) grantBonusXP(xp);

  const pulled = ooPull(run);
  st.runs++; st.credits += run.credits; st.cards += pulled.length;
  if(run.right > st.best) st.best = run.right;

  oo = null;
  saveState();
  renderHeader();
  ooPaintSummary(run, pulled, xp, note);
}

function ooPull(run){
  const n = Math.floor(run.right / OO_CARD_EVERY);
  if(n <= 0 || !run.seen.length) return [];
  const pool = [...run.seen];
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

/* ---------- rendering ------------------------------------------------------ */
function ooEl(){ return document.getElementById("ooStage"); }
function ooEsc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

function ooPaint(revealed, chosen){
  const stage = ooEl();
  if(!stage) return;
  if(!oo){ ooPaintLobby(); return; }
  const q = oo.q;
  if(!q) return;

  const lives = Array.from({length:OO_LIVES}, (_,i)=>
    `<span class="oo-life${i < oo.lives ? "" : " out"}"></span>`).join("");

  const tiles = q.cards.map((c,i)=>{
    const r = RARITIES[c.rarity];
    let cls = "oo-card";
    if(revealed){
      if(i === q.correct) cls += " odd";
      else cls += " same";
      if(i === chosen && i !== q.correct) cls += " picked";
    }
    return `<button class="${cls}" data-i="${i}" ${revealed ? "disabled" : ""}>
      <span class="oo-e">${c.emoji}</span>
      <span class="oo-n">${ooEsc(c.name.split(" — ")[0])}</span>
      <span class="oo-m">
        <i>${ooEsc(c.category)}</i>
        <i style="color:${r.color}">${ooEsc(r.name)}</i>
      </span>
    </button>`;
  }).join("");

  stage.innerHTML = `
    <div class="oo-hud">
      <div class="oo-lives">${lives}</div>
      <div class="oo-meta">
        <span class="oo-chip">Round ${oo.round}</span>
        ${oo.streak > 1 ? `<span class="oo-chip hot">×${(1 + Math.min(oo.streak,15)*0.09).toFixed(2)}</span>` : ""}
        <span class="oo-chip">${oo.credits.toLocaleString()} banked</span>
      </div>
      <button class="oo-quit" id="ooQuit">Stop</button>
    </div>

    <div class="oo-clockrail"><i id="ooClock" style="width:${revealed ? 0 : 100}%"></i></div>

    <p class="oo-ask">Three of these belong together. Tap the one that doesn't.</p>
    <div class="oo-grid">${tiles}</div>

    <div class="oo-foot">
      ${revealed ? `
        <div class="oo-verdict ${chosen === q.correct ? "good" : "bad"}">
          <strong>${chosen === q.correct ? "Right." : oo.lastGain.timedOut ? "Time." : "No."}</strong>
          <span>The other three share a ${ooEsc(q.props.map(p=>p.label).join(" and a "))}.
            ${chosen === q.correct ? `+${oo.lastGain.credits.toLocaleString()} credits` : ""}</span>
        </div>
        <button class="btn" id="ooNext">${oo.lives <= 0 ? "See the run" : "Next"}</button>`
        : ""}
    </div>`;

  stage.querySelectorAll(".oo-card").forEach(b =>
    b.addEventListener("click", ()=> ooCall(+b.dataset.i)));
  const next = document.getElementById("ooNext");
  if(next) next.addEventListener("click", ()=>{ if(oo.lives <= 0) ooEnd(); else ooNext(); });
  const quit = document.getElementById("ooQuit");
  if(quit) quit.addEventListener("click", ()=>{ if(confirm("Stop and bank the run?")) ooEnd(); });
}

function ooPaintLobby(){
  const stage = ooEl();
  if(!stage) return;
  const st = ooStats();
  const acc = st.calls ? Math.round((st.right / st.calls) * 100) : 0;

  stage.innerHTML = `
    <div class="oo-lobby">
      <div class="oo-lede">
        <span class="oo-eyebrow">Odd One Out</span>
        <h3>Three belong together. One doesn't.</h3>
        <p>They might share a collection, a rarity, a picture, or be prints of the
           same thing — it's on the cards. Ten seconds a round, tightening as you
           go, and from round eight the odd one starts hiding behind a second
           thing it has in common.</p>
      </div>

      <div class="oo-lobstats">
        <div><b>${st.best}</b><span>Best run</span></div>
        <div><b>${acc}%</b><span>Accuracy</span></div>
        <div><b>${st.bestStreak}</b><span>Best streak</span></div>
        <div><b>${st.credits.toLocaleString()}</b><span>Lifetime take</span></div>
      </div>

      <button class="btn oo-start" id="ooStart">Start</button>
    </div>`;

  document.getElementById("ooStart").addEventListener("click", ooStart);
}

function ooPaintSummary(run, pulled, xp, note){
  const stage = ooEl();
  if(!stage) return;
  const acc = run.round ? Math.round((run.right / run.round) * 100) : 0;

  stage.innerHTML = `
    <div class="oo-summary">
      <span class="oo-eyebrow">Run over</span>
      <h3>${run.right} spotted<span> of ${run.round}</span></h3>
      ${note ? `<p class="oo-hint">${ooEsc(note)}</p>` : ""}

      <div class="oo-lobstats">
        <div><b>${run.credits.toLocaleString()}</b><span>Credits</span></div>
        <div><b>${xp}</b><span>XP</span></div>
        <div><b>${acc}%</b><span>Accuracy</span></div>
      </div>

      ${pulled.length ? `
        <div class="oo-pulled">
          <span class="oo-eyebrow">Picked out</span>
          <div class="oo-pullrow">
            ${pulled.map(p=>{
              const r = RARITIES[p.card.rarity];
              return `<div class="oo-pull" style="--rc:${r.color}">
                ${p.isNew ? `<span class="oo-new">New</span>` : ""}
                <span class="oo-pe">${p.card.emoji}</span>
                <span class="oo-pn">${ooEsc(p.card.name)}</span>
                <span class="oo-pr">${ooEsc(r.name)}</span>
              </div>`;
            }).join("")}
          </div>
        </div>`
        : `<p class="oo-hint">Spot ${OO_CARD_EVERY} in a run to keep one.</p>`}

      <div class="oo-foot">
        <button class="btn" id="ooAgain">Again</button>
        <button class="btn secondary" id="ooBack">Back</button>
      </div>
    </div>`;

  document.getElementById("ooAgain").addEventListener("click", ooStart);
  document.getElementById("ooBack").addEventListener("click", ooPaintLobby);
}

/* ---------- host wiring ------------------------------------------------------ */
function renderOddOne(){ if(oo) ooPaint(); else ooPaintLobby(); }
function ooOnEnterTab(){ ooStats(); renderOddOne(); }
function ooOnLeaveTab(){
  ooStopClock();
  if(oo && oo.round > 0) ooEnd();
  else oo = null;
}
