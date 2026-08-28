/* =====================================================================
   PROVENANCE  —  the archive quiz
   ---------------------------------------------------------------------
   An archive record comes up with the subject's name struck out. Four
   cards from the binder are laid beside it. Name the right one.

   Everything here reads from data the game already has: the 1,215 real
   subjects hiding behind ~60,000 print variants, and the Wikipedia
   summaries the card inspector already fetches and caches. No new
   content pipeline, no new art.

   Host functions this module expects (all already in index.html):
     cards, RARITIES, MINE_BONUS_BY_TIER, UNIQUE_TIERS
     state, saveState, showToast, renderHeader
     grantBonusXP, recomputePlayerXP
     ciLookup  (async, returns {title,desc,extract,img,url} or null)
   ===================================================================== */

/* ---------- tuning ---------------------------------------------------
   All the knobs in one place. XP is deliberately small: this is the only
   game that grants XP directly rather than through cards, so it should
   feel like a nudge, not a shortcut. A clean 15-question run lands around
   150 XP — roughly a handful of mid-tier cards. */
const PV_LIVES        = 3;
const PV_TIME_MS      = 22000;  // per question; running out costs the speed bonus, not a life
const PV_BASE_CREDITS = 220;
const PV_XP_BASE      = 4;
const PV_QUEUE_TARGET = 2;      // questions kept warm ahead of the player
const PV_MIN_EXTRACT  = 90;     // chars; shorter summaries make unfair questions
const PV_CARD_EVERY   = 5;      // correct answers per card pulled from the archive

/* Invented objects with no article behind them. Still allowed as wrong
   answers — they just never get asked about. */
const PV_FICTION = new Set(["Fortune & Folly", "Raid Gear"]);

const PV_TIERS = [
  { at: 0,  name: "Field Survey",  hint: "Answers come from anywhere in the binder." },
  { at: 4,  name: "Reading Room",  hint: "All four candidates share a collection." },
  { at: 9,  name: "Closed Stacks", hint: "Same collection, same shelf. Good luck." },
];

/* ---------- subject index -------------------------------------------
   Built once, lazily. "Lion — Night Print" and its forty-nine siblings
   collapse into one subject: Lion. */
/* ---------- archive access ------------------------------------------
   Two sources. Live Wikipedia wins whenever it answers; the bundled
   catalogue is the floor. If the network is blocked — offline, a
   corporate proxy, an extension, or the page opened over file:// where
   the request never leaves the browser — the game keeps working on the
   catalogue instead of dead-ending on an error screen. */
let pvArchiveLive = null;   // null = untested, true/false once known

function pvHasCatalogue(){ return typeof PV_CATALOGUE !== "undefined"; }

async function pvFetchEntry(name){
  /* Catalogue first when the network has already proven unreachable —
     no point paying 16 timeouts a question to rediscover that. */
  if(pvArchiveLive === false && pvHasCatalogue()){
    return pvCatalogueEntry(name);
  }
  let entry = null;
  try {
    entry = await ciLookup(name);
    if(entry) pvArchiveLive = true;
  } catch(e){
    pvArchiveLive = false;
  }
  if(!entry && pvHasCatalogue()) entry = pvCatalogueEntry(name);
  return entry;
}

/* One cheap probe so the first run doesn't spend its whole budget
   discovering the archive is unreachable. */
async function pvProbeArchive(){
  if(pvArchiveLive !== null) return pvArchiveLive;
  try{
    const j = await ciLookup("Lion");
    pvArchiveLive = !!(j && j.extract);
  }catch(e){
    pvArchiveLive = false;
  }
  return pvArchiveLive;
}

let pvIndex = null;
function pvSubjects(){
  if(pvIndex) return pvIndex;
  const map = new Map();
  cards.forEach(c=>{
    const key = c.name.split(" — ")[0];
    let s = map.get(key);
    if(!s){
      s = { key, name:key, category:c.category, emoji:c.emoji, top:c.rarity, ids:[] };
      map.set(key, s);
    }
    s.ids.push(c.id);
    if(c.rarity > s.top){ s.top = c.rarity; s.emoji = c.emoji; }
  });
  pvIndex = [...map.values()];
  return pvIndex;
}
function pvOwns(s){ return s.ids.some(id => (state.owned[id]||0) > 0); }

/* The card inspector caches lookups that came back empty. Those subjects
   have no article to quiz on, so drop them from the pool permanently
   rather than burning a retry on them every round. */
function pvKnownMiss(name){
  try{
    if(typeof ciLoadCache !== "function") return false;
    const hit = ciLoadCache()[name];
    return !!(hit && hit.miss);
  }catch(e){ return false; }
}

/* Askable subjects: real things, preferring ones the player owns so the
   game feels like reading your own binder. Falls back to the whole index
   for a brand-new save, otherwise a fresh account has nothing to play. */
function pvAskPool(){
  const real = pvSubjects().filter(s => !PV_FICTION.has(s.category));
  const owned = real.filter(pvOwns);
  return owned.length >= 24 ? owned : real;
}

function pvDifficulty(round){
  let t = PV_TIERS[0];
  for(const x of PV_TIERS){ if(round >= x.at) t = x; }
  return t;
}

/* ---------- redaction -----------------------------------------------
   Strike out the subject's name and every distinctive word in it, plus
   whatever Wikipedia calls the article, so the summary can't just hand
   over the answer. Word length survives — that's how a real redacted
   document reads, and it leaves the player something to work with. */
const PV_STOP = new Set(["the","a","an","of","and","or","in","on","at","to","for","is","are","was","were",
  "by","with","from","as","its","it","that","this","which","also","known","called","common","genus",
  "species","family","order","type","kind","other","most","more","than","been","have","has","their"]);

function pvEscape(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

/* `terms` should only ever be names for the thing — the subject and the
   article title. Wikipedia's one-line description is deliberately NOT
   passed in: for Lion that reads "large cat native to Africa and India",
   which is precisely the clue the player is meant to reason from.

   Works by collecting match ranges over the original string and merging
   them before building output, rather than running replacements in
   sequence. Sequential replacement nests "Shark" inside an already-struck
   "Great White Shark" and corrupts the markup. */
function pvRedact(text, terms){
  const parts = [];
  terms.filter(Boolean).forEach(t=>{
    parts.push(t.trim());
    t.split(/[\s\-–—/(),'"]+/).forEach(w=>{
      if(w.length >= 4 && !PV_STOP.has(w.toLowerCase())) parts.push(w);
    });
  });
  const uniq = [...new Set(parts)].filter(Boolean);

  const ranges = [];
  uniq.forEach(p=>{
    const re = new RegExp("\\b" + pvEscape(p) + "(?:'s|’s|s|es)?\\b", "gi");
    let m;
    while((m = re.exec(text)) !== null){
      ranges.push([m.index, m.index + m[0].length]);
      if(m.index === re.lastIndex) re.lastIndex++;
    }
  });
  if(!ranges.length) return pvEsc(text);
  ranges.sort((a,b)=> a[0] - b[0]);

  /* Merge overlaps, and join neighbours separated only by whitespace so a
     multi-word name reads as one continuous bar. */
  const merged = [];
  for(const r of ranges){
    const last = merged[merged.length-1];
    if(last && r[0] <= last[1]){ last[1] = Math.max(last[1], r[1]); continue; }
    if(last && /^\s+$/.test(text.slice(last[1], r[0]))){ last[1] = r[1]; continue; }
    merged.push([r[0], r[1]]);
  }

  let out = "", cur = 0;
  merged.forEach(([a,b])=>{
    out += pvEsc(text.slice(cur, a));
    out += `<span class="pv-bar"><i></i>${pvEsc(text.slice(a, b))}</span>`;
    cur = b;
  });
  return out + pvEsc(text.slice(cur));
}
function pvEsc(s){
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

/* ---------- question construction ----------------------------------- */
function pvPickDistractors(answer, diff, n){
  const all = pvSubjects();
  let pool;
  if(diff.at >= 9){
    pool = all.filter(s => s.category === answer.category && s.key !== answer.key
                        && Math.abs(s.top - answer.top) <= 2);
    if(pool.length < n) pool = all.filter(s => s.category === answer.category && s.key !== answer.key);
  } else if(diff.at >= 4){
    pool = all.filter(s => s.category === answer.category && s.key !== answer.key);
  } else {
    pool = all.filter(s => s.category !== answer.category);
  }
  if(pool.length < n) pool = all.filter(s => s.key !== answer.key);

  const out = [];
  const seen = new Set([answer.key]);
  let guard = 0;
  while(out.length < n && guard++ < 400){
    const c = pool[Math.floor(Math.random()*pool.length)];
    if(!c || seen.has(c.key)) continue;
    seen.add(c.key);
    out.push(c);
  }
  return out;
}

async function pvBuildQuestion(round){
  const diff = pvDifficulty(round);
  let pool = pvAskPool();

  /* With no live archive, only catalogued subjects can be asked about. */
  if(pvArchiveLive === false && pvHasCatalogue()){
    const have = new Set(pvCatalogueSubjects());
    const narrowed = pool.filter(s => have.has(s.key));
    pool = narrowed.length >= 4
      ? narrowed
      : pvSubjects().filter(s => have.has(s.key));
  }
  if(!pool.length) return null;

  const tried = new Set();
  for(let attempt = 0; attempt < 16; attempt++){
    const answer = pool[Math.floor(Math.random()*pool.length)];
    if(!answer || tried.has(answer.key) || pvRun?.asked.has(answer.key)) continue;
    tried.add(answer.key);
    if(pvArchiveLive !== false && pvKnownMiss(answer.name)) continue;

    const entry = await pvFetchEntry(answer.name);
    if(!entry || !entry.extract || entry.extract.length < PV_MIN_EXTRACT) continue;

    const options = pvPickDistractors(answer, diff, 3);
    if(options.length < 3) continue;
    options.push(answer);
    for(let i = options.length - 1; i > 0; i--){
      const j = Math.floor(Math.random()*(i+1));
      [options[i], options[j]] = [options[j], options[i]];
    }

    return {
      answer, options, entry, diff,
      body: pvRedact(entry.extract, [answer.name, entry.title]),
      correct: options.findIndex(o => o.key === answer.key)
    };
  }
  return null;
}

/* ---------- run state ------------------------------------------------ */
let pvRun   = null;   // live run, or null in the lobby
let pvQueue = [];     // questions warmed in the background
let pvFilling = false;
let pvTimer = null;

function pvStats(){
  if(!state.provenance){
    state.provenance = { runs:0, best:0, answered:0, correct:0, cardsPulled:0, credits:0, xp:0, bestStreak:0 };
  }
  return state.provenance;
}

async function pvFillQueue(){
  if(pvFilling) return;
  pvFilling = true;
  try{
    while(pvQueue.length < PV_QUEUE_TARGET && pvRun){
      const q = await pvBuildQuestion(pvRun.round + pvQueue.length);
      if(!q) break;
      pvQueue.push(q);
    }
  } finally { pvFilling = false; }
}

async function pvStartRun(){
  pvRun = { round:0, lives:PV_LIVES, streak:0, correct:0, credits:0, xp:0,
            asked:new Set(), identified:[], q:null, locked:false, hinted:false, deadline:0 };
  pvQueue = [];
  pvPaint();
  await pvProbeArchive();
  await pvNextQuestion();
}

async function pvNextQuestion(){
  if(!pvRun) return;
  pvRun.locked = false;
  pvRun.hinted = false;
  pvRun.q = null;
  pvPaint();

  if(!pvQueue.length) await pvFillQueue();
  const q = pvQueue.shift();
  if(!q){
    pvEndRun(pvHasCatalogue()
      ? "Ran out of records to ask about. Collect a few more subjects and try again."
      : "Couldn't reach the archive, and no offline catalogue is loaded. Check your connection, or serve the page over http:// rather than opening the file directly.");
    return;
  }
  pvRun.round++;
  pvRun.q = q;
  pvRun.asked.add(q.answer.key);
  pvRun.deadline = Date.now() + PV_TIME_MS;
  pvPaint();
  pvStartTimer();
  pvFillQueue();
}

function pvStartTimer(){
  pvStopTimer();
  pvTimer = setInterval(()=>{
    if(!pvRun || !pvRun.q || pvRun.locked) return pvStopTimer();
    const left = pvRun.deadline - Date.now();
    const fill = document.getElementById("pvTimeFill");
    if(fill) fill.style.width = Math.max(0, Math.min(100, (left / PV_TIME_MS) * 100)) + "%";
    if(left <= 0) pvStopTimer();   // time out costs the speed bonus, nothing else
  }, 100);
}
function pvStopTimer(){ if(pvTimer){ clearInterval(pvTimer); pvTimer = null; } }

/* ---------- answering ------------------------------------------------ */
function pvAnswer(idx){
  if(!pvRun || !pvRun.q || pvRun.locked) return;
  pvRun.locked = true;
  pvStopTimer();

  const q = pvRun.q;
  const right = idx === q.correct;
  const msLeft = Math.max(0, pvRun.deadline - Date.now());
  const speed = msLeft / PV_TIME_MS;

  if(right){
    const streakMult = 1 + Math.min(pvRun.streak, 10) * 0.12;
    const roundMult  = 1 + pvRun.round * 0.10;
    let credits = PV_BASE_CREDITS * roundMult * streakMult * (1 + speed * 0.5);
    if(pvRun.hinted) credits *= 0.5;
    credits = Math.round(credits);

    let xp = PV_XP_BASE + pvRun.round;
    if(pvRun.hinted) xp = Math.round(xp * 0.5);

    pvRun.streak++;
    pvRun.correct++;
    pvRun.credits += credits;
    pvRun.xp += xp;
    pvRun.identified.push(q.answer);
    pvRun.lastGain = { credits, xp };
  } else {
    pvRun.streak = 0;
    pvRun.lives--;
    pvRun.lastGain = null;
  }

  const st = pvStats();
  st.answered++;
  if(right) st.correct++;
  if(pvRun.streak > st.bestStreak) st.bestStreak = pvRun.streak;

  pvPaint(true, idx);
}

function pvHint(){
  if(!pvRun || !pvRun.q || pvRun.locked || pvRun.hinted) return;
  pvRun.hinted = true;
  const q = pvRun.q;
  const wrong = q.options.map((o,i)=>i).filter(i => i !== q.correct);
  q.struck = wrong[Math.floor(Math.random()*wrong.length)];
  pvPaint();
}

function pvContinue(){
  if(!pvRun) return;
  if(pvRun.lives <= 0){ pvEndRun(); return; }
  pvNextQuestion();
}

/* ---------- end of run ----------------------------------------------- */
function pvEndRun(note){
  if(!pvRun) return;
  pvStopTimer();
  const run = pvRun;
  const st = pvStats();

  st.runs++;
  st.credits += run.credits;
  st.xp += run.xp;
  if(run.correct > st.best) st.best = run.correct;

  state.credits += run.credits;
  if(run.xp > 0) grantBonusXP(run.xp);

  const pulled = pvAwardCards(run);
  st.cardsPulled += pulled.length;

  pvRun = null;
  pvQueue = [];
  saveState();
  renderHeader();
  pvPaintSummary(run, pulled, note);
}

/* Every few correct answers, one of the subjects you identified turns up
   as a print for the binder. Unowned subjects come first — the point is
   that knowing a thing is a way of finding it. */
function pvAwardCards(run){
  const n = Math.floor(run.correct / PV_CARD_EVERY);
  if(n <= 0) return [];

  const pool = [...run.identified];
  const out = [];
  /* Loops on the award count, not on attempts: a subject whose only prints
     are one-of-ones you already hold yields nothing, and skipping it must
     cost a draw from the pool rather than one of the promised cards. */
  while(out.length < n && pool.length){
    const fresh = pool.filter(s => !pvOwns(s));
    const pick = (fresh.length ? fresh : pool)[Math.floor(Math.random() * (fresh.length ? fresh.length : pool.length))];
    pool.splice(pool.indexOf(pick), 1);

    /* Prefer a print the binder is missing, and never duplicate a
       one-of-one tier. */
    const options = pick.ids.map(id => cards[id])
      .filter(c => !(UNIQUE_TIERS.has(c.rarity) && (state.owned[c.id]||0) > 0));
    if(!options.length) continue;
    const missing = options.filter(c => !(state.owned[c.id] > 0));
    const card = (missing.length ? missing : options)[Math.floor(Math.random() * (missing.length ? missing.length : options.length))];

    const had = state.owned[card.id] || 0;
    if(had === 0) state.miningBonus = (state.miningBonus||0) + MINE_BONUS_BY_TIER[card.rarity];
    state.owned[card.id] = had + 1;
    out.push({ card, isNew: had === 0 });
  }
  if(out.length) recomputePlayerXP();
  return out;
}

/* ---------- rendering ------------------------------------------------ */
function pvEl(){ return document.getElementById("pvStage"); }

function pvPaint(revealed, chosen){
  const stage = pvEl();
  if(!stage) return;
  if(!pvRun){ pvPaintLobby(); return; }

  const q = pvRun.q;
  if(!q){
    stage.innerHTML = `<div class="pv-loading"><span class="pv-dots"><i></i><i></i><i></i></span>
      Pulling the next record…</div>`;
    return;
  }

  const r = RARITIES[q.answer.top];
  const hearts = Array.from({length:PV_LIVES}, (_,i)=>
    `<span class="pv-life${i < pvRun.lives ? "" : " out"}"></span>`).join("");

  const opts = q.options.map((o,i)=>{
    let cls = "pv-opt";
    if(q.struck === i) cls += " struck";
    if(revealed){
      if(i === q.correct) cls += " right";
      else if(i === chosen) cls += " wrong";
      else cls += " dim";
    }
    return `<button class="${cls}" data-i="${i}" ${revealed || q.struck === i ? "disabled" : ""}>
      <span class="pv-oe">${o.emoji}</span>
      <span class="pv-on">${pvEsc(o.name)}</span>
    </button>`;
  }).join("");

  stage.innerHTML = `
    <div class="pv-hud">
      <div class="pv-lives" title="Lives">${hearts}</div>
      <div class="pv-meta">
        <span class="pv-chip">Record ${pvRun.round}</span>
        <span class="pv-chip">${q.diff.name}</span>
        ${pvRun.streak > 1 ? `<span class="pv-chip hot">Streak ${pvRun.streak}</span>` : ""}
      </div>
      <button class="pv-quit" id="pvQuit">End run</button>
    </div>

    <div class="pv-time"><i id="pvTimeFill" style="width:${revealed ? 0 : 100}%"></i></div>

    <article class="pv-record">
      <header class="pv-rechead">
        <span class="pv-eyebrow">Archive record${q.entry.local ? " · offline catalogue" : ""}</span>
        <span class="pv-cat" style="--rc:${r.color}">Catalogued at ${r.name}</span>
      </header>
      <p class="pv-body" id="pvBody">${q.body}</p>
    </article>

    <div class="pv-opts">${opts}</div>

    <div class="pv-foot">
      ${revealed
        ? `<div class="pv-verdict ${chosen === q.correct ? "good" : "bad"}">
             <div class="pv-vtext">
               <strong>${chosen === q.correct ? "Identified." : "Misfiled."}</strong>
               ${chosen === q.correct
                 ? `+${pvRun.lastGain.credits.toLocaleString()} credits · +${pvRun.lastGain.xp} XP`
                 : `It was ${pvEsc(q.answer.name)}.`}
             </div>
             ${q.entry.url ? `<a class="pv-read" href="${q.entry.url}" target="_blank" rel="noopener">Read the full article ↗</a>` : ""}
           </div>
           <button class="btn" id="pvNext">${pvRun.lives <= 0 ? "See results" : "Next record"}</button>`
        : `<button class="btn secondary" id="pvHint" ${pvRun.hinted ? "disabled" : ""}>
             ${pvRun.hinted ? "Hint used — half payout" : "Rule one out (half payout)"}
           </button>`}
    </div>`;

  stage.querySelectorAll(".pv-opt").forEach(b=>
    b.addEventListener("click", ()=>pvAnswer(+b.dataset.i)));
  const hint = document.getElementById("pvHint");
  if(hint) hint.addEventListener("click", pvHint);
  const next = document.getElementById("pvNext");
  if(next) next.addEventListener("click", pvContinue);
  const quit = document.getElementById("pvQuit");
  if(quit) quit.addEventListener("click", ()=>{ if(confirm("End the run and bank what you've earned?")) pvEndRun(); });

  if(revealed) pvRevealBars();
}

/* The payoff: the marker lifts off the page and the subject is there. */
function pvRevealBars(){
  const bars = document.querySelectorAll("#pvBody .pv-bar");
  bars.forEach((b,i)=> setTimeout(()=>b.classList.add("open"), 90 + i*70));
}

function pvPaintLobby(){
  const stage = pvEl();
  if(!stage) return;
  const st = pvStats();
  const pool = pvAskPool();
  const owned = pvSubjects().filter(s => !PV_FICTION.has(s.category) && pvOwns(s)).length;
  const total = pvSubjects().filter(s => !PV_FICTION.has(s.category)).length;
  const acc = st.answered ? Math.round((st.correct / st.answered) * 100) : 0;

  stage.innerHTML = `
    <div class="pv-lobby">
      <div class="pv-lede">
        <span class="pv-eyebrow">Provenance</span>
        <h3>A record with the name struck out.<br>Four cards. One of them is the thing described.</h3>
        <p>Summaries are pulled from the archive and redacted on the spot. Three
           misfilings ends the run. Every ${PV_CARD_EVERY} correct identifications
           pull a print from the shelves into your binder.</p>
      </div>

      <div class="pv-lobstats">
        <div><b>${owned.toLocaleString()}<span>/${total.toLocaleString()}</span></b><span>Subjects documented</span></div>
        <div><b>${st.best}</b><span>Best run</span></div>
        <div><b>${acc}%</b><span>Accuracy</span></div>
        <div><b>${st.cardsPulled}</b><span>Cards pulled</span></div>
      </div>

      <div class="pv-ladder">
        ${PV_TIERS.map(t=>`<div class="pv-rung"><b>${t.name}</b><span>${t.hint}</span></div>`).join("")}
      </div>

      <button class="btn pv-start" id="pvStart">Open the archive</button>
      ${pool.length < 24 ? `<p class="pv-note">Your binder is still thin, so the archive is drawing on
        everything in the catalogue. Once you own 24 subjects it'll only ask about cards you actually hold.</p>` : ""}
    </div>`;

  document.getElementById("pvStart").addEventListener("click", pvStartRun);
}

function pvPaintSummary(run, pulled, note){
  const stage = pvEl();
  if(!stage) return;
  const acc = run.round ? Math.round((run.correct / run.round) * 100) : 0;

  stage.innerHTML = `
    <div class="pv-summary">
      <span class="pv-eyebrow">Run closed</span>
      <h3>${run.correct} identified<span> of ${run.round}</span></h3>
      ${note ? `<p class="pv-note">${pvEsc(note)}</p>` : ""}

      <div class="pv-lobstats">
        <div><b>${run.credits.toLocaleString()}</b><span>Credits</span></div>
        <div><b>${run.xp}</b><span>XP</span></div>
        <div><b>${acc}%</b><span>Accuracy</span></div>
      </div>

      ${pulled.length ? `
        <div class="pv-pulled">
          <span class="pv-eyebrow">Pulled from the shelves</span>
          <div class="pv-pullrow">
            ${pulled.map(p=>{
              const r = RARITIES[p.card.rarity];
              return `<div class="pv-pull" style="--rc:${r.color}">
                ${p.isNew ? `<span class="pv-new">New</span>` : ""}
                <span class="pv-pe">${p.card.emoji}</span>
                <span class="pv-pn">${pvEsc(p.card.name)}</span>
                <span class="pv-pr">${r.name}</span>
              </div>`;
            }).join("")}
          </div>
        </div>` : `<p class="pv-note">Identify ${PV_CARD_EVERY} in a run to start pulling prints.</p>`}

      <div class="pv-foot">
        <button class="btn" id="pvAgain">Another run</button>
        <button class="btn secondary" id="pvBack">Back to the lobby</button>
      </div>
    </div>`;

  document.getElementById("pvAgain").addEventListener("click", pvStartRun);
  document.getElementById("pvBack").addEventListener("click", pvPaintLobby);
}

/* ---------- host wiring ---------------------------------------------- */
function renderProvenance(){ if(!pvRun) pvPaintLobby(); else pvPaint(); }
function pvOnEnterTab(){ pvStats(); renderProvenance(); }
function pvOnLeaveTab(){
  pvStopTimer();
  /* Leaving mid-run banks it rather than silently dropping the credits. */
  if(pvRun && pvRun.round > 0) pvEndRun();
  else pvRun = null;
}
