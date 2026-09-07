
/* =====================================================================
   THE PRESS  —  spare prints in, one good print out
   ---------------------------------------------------------------------
   The binder has a duplicate problem: ~16,000 Junk Drawer cards and about
   fifty print variants behind every real subject. Every other mode in the
   game is a faucet. This is the sink.

   Load spare prints into the hopper. What you feed it sets the floor the
   board spawns at, so your junk determines your ceiling. Merge upward.
   Bank the plate and the best tiles come back as real prints, descended
   from the exact cards you fed in.

   THE GUARANTEE, and it drives most of the design below: the Press only
   ever consumes copies beyond the first. Collection XP counts unique
   cards and the mining bonus only moves when a card crosses 0↔1, so a
   run can never cost you a subject, a level, or a point of mining rate.

   Host functions this module expects (all already in index.html):
     cards, RARITIES, MINE_BONUS_BY_TIER, UNIQUE_TIERS
     state, saveState, showToast, renderHeader
     grantBonusXP, recomputePlayerXP
   ===================================================================== */

/* ---------- tuning --------------------------------------------------- */
const PR_SIZE        = 4;      // board is PR_SIZE × PR_SIZE
const PR_MIN_LOAD    = 12;     // spare prints needed to fire it up
const PR_MAX_LOAD    = 60;     // hopper ceiling
const PR_MINT_TOP    = 3;      // how many of the best tiles come back as cards
const PR_XP_PER_TIER = 3;      // XP per tier climbed above the floor
const PR_SPAWN_UP    = 0.18;   // chance a spawn lands one tier above the floor

/* Payout is a multiplier on what the hopper would have fetched at the
   Market counter, not on the plate score. Score is super-linear in tier
   while the sell table is steeper still, so paying out on score made the
   Press worth 8–20× selling depending on the floor — enough to make the
   Market pointless. Pegging to sell value keeps the comparison honest at
   every tier and gives the player a number they can actually reason
   about: this run beat the counter by 3.4×.

   Climbing is the only thing that raises the multiplier, so the reward
   tracks the part that takes skill. */
const PR_MULT_PER_TIER = 0.40;  // multiplier gained per tier climbed above the floor
const PR_MULT_CAP      = 6;     // ceiling on that multiplier

/* The Press upgrades prints; it does not hand out the top of the table.
   Anything above this clamps on the way out, so Prototype and above stay
   the preserve of packs and luck. Climbing past it still pays, because
   the climb is what drives the multiplier. */
const PR_MINT_CEILING  = 10;

/* ---------- save ----------------------------------------------------- */
function prStats(){
  if(!state.press){
    state.press = { runs:0, bestTier:0, bestScore:0, pressed:0, minted:0, credits:0 };
  }
  return state.press;
}

/* ---------- the spare pool -------------------------------------------
   A spare is any copy past the first. The first copy of everything is
   untouchable, which is what makes the guarantee above hold. */
function prSpares(){
  const byTier = Array.from({length:16}, ()=>[]);
  for(const id in state.owned){
    const n = state.owned[id];
    if(n > 1){
      const c = cards[id];
      if(c) byTier[c.rarity].push({ id:+id, spare:n - 1, card:c });
    }
  }
  return byTier;
}
function prSpareCount(byTier){
  return byTier.reduce((s,list)=> s + list.reduce((a,e)=> a + e.spare, 0), 0);
}
function prSubjectOf(card){ return card.name.split(" — ")[0]; }

/* ---------- run state ------------------------------------------------ */
let pr = null;         // live run
let prHopper = null;   // { picks:{cardId:qty}, total }
let prTileSeq = 1;

function prNewHopper(){ prHopper = { picks:{}, total:0 }; }
function prHopperTiers(){
  /* Expand the hopper into a flat list of {tier,subject} the board can
     draw from, one entry per print loaded. */
  const out = [];
  for(const id in prHopper.picks){
    const c = cards[id];
    for(let i = 0; i < prHopper.picks[id]; i++) out.push({ tier:c.rarity, subject:prSubjectOf(c) });
  }
  return out;
}
function prFloorFor(list){
  if(!list.length) return 0;
  /* The floor is the hopper's mean tier, rounded down. Feeding better
     junk starts the board higher, which is the whole incentive. */
  return Math.max(0, Math.min(13, Math.floor(list.reduce((s,e)=> s + e.tier, 0) / list.length)));
}

/* ---------- board ----------------------------------------------------- */
function prIdx(x,y){ return y*PR_SIZE + x; }

function prSpawn(){
  if(!pr) return false;
  const empty = [];
  for(let i = 0; i < pr.grid.length; i++) if(!pr.grid[i]) empty.push(i);
  if(!empty.length) return false;
  const at = empty[Math.floor(Math.random()*empty.length)];
  const src = pr.pool[Math.floor(Math.random()*pr.pool.length)];
  const tier = Math.min(15, pr.floor + (Math.random() < PR_SPAWN_UP ? 1 : 0));
  pr.grid[at] = { id:prTileSeq++, tier, subject:src ? src.subject : "", fresh:true };
  return true;
}

function prStart(){
  const list = prHopperTiers();
  if(list.length < PR_MIN_LOAD) return;

  /* Consume the spares now, so the cost is paid up front and a closed tab
     can't refund it. Bank the counter value of what went in — that's the
     baseline the payout multiplies. */
  let consumed = 0, sellValue = 0;
  for(const id in prHopper.picks){
    const q = prHopper.picks[id];
    const have = state.owned[id] || 0;
    const take = Math.min(q, Math.max(0, have - 1));   // never the last copy
    if(take > 0){
      state.owned[id] = have - take;
      consumed += take;
      sellValue += MARKET_SELL_PRICE_BY_TIER[cards[id].rarity] * take;
    }
  }
  prStats().pressed += consumed;
  saveState();

  pr = {
    grid: new Array(PR_SIZE*PR_SIZE).fill(null),
    pool: list,
    floor: prFloorFor(list),
    loaded: consumed,
    sellValue,
    score: 0, moves: 0, best: 0,
    over: false, banked: false, lastGain: 0
  };
  prSpawn(); prSpawn();
  pr.best = pr.floor;
  prNewHopper();
  prPaint();
}

/* One line of the board, collapsed toward index 0. Standard 2048 rules:
   a tile merges at most once per move. */
function prCollapse(line){
  const tiles = line.filter(Boolean);
  const out = [];
  let gained = 0, merges = 0;
  for(let i = 0; i < tiles.length; i++){
    const a = tiles[i], b = tiles[i+1];
    if(b && a.tier === b.tier && a.tier < 15){
      /* The new print descends from one of its two parents — that lineage
         is what gets minted at the end of the run. */
      const heir = Math.random() < 0.5 ? a.subject : b.subject;
      out.push({ id:a.id, tier:a.tier + 1, subject:heir, merged:true });
      gained += (a.tier + 1) * (a.tier + 1);
      merges++;
      i++;
    } else {
      out.push({ id:a.id, tier:a.tier, subject:a.subject });
    }
  }
  while(out.length < PR_SIZE) out.push(null);
  return { line:out, gained, merges };
}

function prReadLine(dir, k){
  const out = [];
  for(let i = 0; i < PR_SIZE; i++){
    if(dir === "left")  out.push(pr.grid[prIdx(i, k)]);
    if(dir === "right") out.push(pr.grid[prIdx(PR_SIZE-1-i, k)]);
    if(dir === "up")    out.push(pr.grid[prIdx(k, i)]);
    if(dir === "down")  out.push(pr.grid[prIdx(k, PR_SIZE-1-i)]);
  }
  return out;
}
function prWriteLine(dir, k, line){
  for(let i = 0; i < PR_SIZE; i++){
    if(dir === "left")  pr.grid[prIdx(i, k)] = line[i];
    if(dir === "right") pr.grid[prIdx(PR_SIZE-1-i, k)] = line[i];
    if(dir === "up")    pr.grid[prIdx(k, i)] = line[i];
    if(dir === "down")  pr.grid[prIdx(k, PR_SIZE-1-i)] = line[i];
  }
}

function prMove(dir){
  if(!pr || pr.over || pr.banked) return;
  const before = pr.grid.map(t => t ? t.id + ":" + t.tier : "-").join(",");
  pr.grid.forEach(t => { if(t){ t.merged = false; t.fresh = false; } });

  let gained = 0, merges = 0;
  for(let k = 0; k < PR_SIZE; k++){
    const r = prCollapse(prReadLine(dir, k));
    prWriteLine(dir, k, r.line);
    gained += r.gained; merges += r.merges;
  }
  const after = pr.grid.map(t => t ? t.id + ":" + t.tier : "-").join(",");
  if(before === after) return;   // nothing shifted; not a move

  pr.score += gained;
  pr.lastGain = gained;
  pr.moves++;
  pr.grid.forEach(t => { if(t && t.tier > pr.best) pr.best = t.tier; });
  prSpawn();
  if(!prHasMoves()) pr.over = true;
  prPaint();
}

function prHasMoves(){
  if(pr.grid.some(t => !t)) return true;
  for(let y = 0; y < PR_SIZE; y++){
    for(let x = 0; x < PR_SIZE; x++){
      const t = pr.grid[prIdx(x,y)];
      if(x+1 < PR_SIZE && pr.grid[prIdx(x+1,y)].tier === t.tier) return true;
      if(y+1 < PR_SIZE && pr.grid[prIdx(x,y+1)].tier === t.tier) return true;
    }
  }
  return false;
}

/* ---------- banking --------------------------------------------------
   The best tiles on the plate come back as real prints. A tile knows its
   subject, so the card minted is a print of that subject — preferring one
   at the tile's own tier, and a copy the binder is missing. */
function prMintFor(tile){
  const subject = tile.subject;
  const prints = cards.filter(c => c.name.startsWith(subject + " — ") || c.name === subject);
  if(!prints.length) return null;

  const legal = prints.filter(c => !(UNIQUE_TIERS.has(c.rarity) && (state.owned[c.id]||0) > 0));
  if(!legal.length) return null;

  /* Two separate reasons a minted print can land below its tile: the
     ceiling, and the plain fact that a subject may have no print that
     high. Track them apart so the summary can say which happened. */
  const capped = Math.min(tile.tier, PR_MINT_CEILING);
  const overflow = Math.max(0, tile.tier - PR_MINT_CEILING);

  let band = legal.filter(c => c.rarity === capped);
  if(!band.length){
    let bestTier = -1;
    legal.forEach(c => { if(c.rarity <= capped && c.rarity > bestTier) bestTier = c.rarity; });
    if(bestTier < 0) bestTier = Math.min(...legal.map(c => c.rarity));
    band = legal.filter(c => c.rarity === bestTier);
  }
  const missing = band.filter(c => !(state.owned[c.id] > 0));
  const pick = (missing.length ? missing : band)[Math.floor(Math.random() * (missing.length ? missing.length : band.length))];

  const had = state.owned[pick.id] || 0;
  if(had === 0) state.miningBonus = (state.miningBonus||0) + MINE_BONUS_BY_TIER[pick.rarity];
  state.owned[pick.id] = had + 1;
  return {
    card: pick,
    isNew: had === 0,
    overflow,
    shortfall: Math.max(0, capped - pick.rarity)
  };
}

function prBank(){
  if(!pr || pr.banked) return;
  pr.banked = true;

  const top = pr.grid.filter(Boolean).sort((a,b)=> b.tier - a.tier).slice(0, PR_MINT_TOP);
  const minted = [];
  top.forEach(t => { const m = prMintFor(t); if(m) minted.push(m); });

  const climbed = Math.max(0, pr.best - pr.floor);
  const mult    = Math.min(PR_MULT_CAP, 1 + climbed * PR_MULT_PER_TIER);
  const credits = Math.round(pr.sellValue * mult);

  /* XP tracks how far you climbed, weighted by how high you got. Weighting
     matters: a high floor buys a shorter climb, and without it, loading
     better junk would earn less for reaching further, which is backwards. */
  const xp = climbed > 0 ? Math.round(climbed * PR_XP_PER_TIER * (1 + pr.best * 0.15)) : 0;

  state.credits += credits;
  if(xp > 0) grantBonusXP(xp);
  if(minted.length) recomputePlayerXP();

  const st = prStats();
  st.runs++;
  st.credits += credits;
  st.minted += minted.length;
  if(pr.best > st.bestTier) st.bestTier = pr.best;
  if(pr.score > st.bestScore) st.bestScore = pr.score;

  saveState();
  renderHeader();
  prPaintSummary({ score:pr.score, best:pr.best, floor:pr.floor, moves:pr.moves,
                   loaded:pr.loaded, sellValue:pr.sellValue, mult, credits, xp, minted });
  pr = null;
}

/* ---------- rendering ------------------------------------------------- */
function prEl(){ return document.getElementById("prStage"); }
function prEsc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

function prTileHTML(t, i){
  const x = i % PR_SIZE, y = Math.floor(i / PR_SIZE);
  const r = RARITIES[t.tier];
  const cls = "pr-tile" + (t.merged ? " merged" : "") + (t.fresh ? " fresh" : "");
  return `<div class="${cls}" style="--rc:${r.color}; --x:${x}; --y:${y};" data-id="${t.id}">
    <span class="pr-t">${t.tier}</span>
    <span class="pr-r">${prEsc(r.name)}</span>
    <span class="pr-s">${prEsc(t.subject)}</span>
  </div>`;
}

function prPaint(){
  const stage = prEl();
  if(!stage) return;
  if(!pr){ prPaintHopper(); return; }

  const cells = Array.from({length:PR_SIZE*PR_SIZE}, ()=>`<div class="pr-cell"></div>`).join("");
  const tiles = pr.grid.map((t,i)=> t ? prTileHTML(t,i) : "").join("");
  const rBest = RARITIES[pr.best];

  stage.innerHTML = `
    <div class="pr-hud">
      <div class="pr-stat"><b>${pr.score.toLocaleString()}</b><span>Plate score</span></div>
      <div class="pr-stat"><b style="color:${rBest.color}">${pr.best}</b><span>Best tier</span></div>
      <div class="pr-stat"><b>${pr.moves}</b><span>Passes</span></div>
      <div class="pr-stat"><b>${Math.min(PR_MULT_CAP, 1 + Math.max(0, pr.best - pr.floor) * PR_MULT_PER_TIER).toFixed(2)}×</b><span>Payout</span></div>
    </div>

    <div class="pr-boardwrap">
      <div class="pr-board" id="prBoard" style="--n:${PR_SIZE}">
        <div class="pr-cells">${cells}</div>
        ${tiles}
      </div>
      ${pr.over ? `<div class="pr-jam"><div>
          <strong>The plate is full.</strong>
          <span>No pass left to make. Bank it and collect the prints.</span>
        </div></div>` : ""}
    </div>

    <div class="pr-pad">
      <button class="pr-dir" data-d="up"    aria-label="Press up">↑</button>
      <button class="pr-dir" data-d="left"  aria-label="Press left">←</button>
      <button class="pr-dir" data-d="down"  aria-label="Press down">↓</button>
      <button class="pr-dir" data-d="right" aria-label="Press right">→</button>
    </div>

    <div class="pr-foot">
      <button class="btn" id="prBank">Bank the plate${pr.best > pr.floor ? ` — mint ${Math.min(PR_MINT_TOP, pr.grid.filter(Boolean).length)}` : ""}</button>
      <span class="pr-hint">Arrow keys, swipe, or the pad. Two prints of a tier press into one of the next.</span>
    </div>`;

  stage.querySelectorAll(".pr-dir").forEach(b =>
    b.addEventListener("click", ()=> prMove(b.dataset.d)));
  document.getElementById("prBank").addEventListener("click", prBank);
  prBindGestures();
}

function prPaintHopper(){
  const stage = prEl();
  if(!stage) return;
  if(!prHopper) prNewHopper();

  const spares = prSpares();
  const total = prSpareCount(spares);
  const st = prStats();
  const list = prHopperTiers();
  const floor = prFloorFor(list);
  const ready = list.length >= PR_MIN_LOAD;

  const buckets = spares.map((entries, tier)=>{
    const avail = entries.reduce((a,e)=> a + e.spare, 0);
    if(!avail) return "";
    const r = RARITIES[tier];
    const loaded = entries.reduce((a,e)=> a + (prHopper.picks[e.id]||0), 0);
    return `<div class="pr-bucket${loaded ? " on" : ""}" style="--rc:${r.color}">
      <div class="pr-bt">
        <b>${tier}</b>
        <span>${prEsc(r.name)}</span>
      </div>
      <div class="pr-bn">${avail.toLocaleString()} spare</div>
      <div class="pr-bctl">
        <button data-t="${tier}" data-n="-5" ${loaded ? "" : "disabled"}>−5</button>
        <span class="pr-bl">${loaded}</span>
        <button data-t="${tier}" data-n="5" ${avail - loaded > 0 ? "" : "disabled"}>+5</button>
      </div>
    </div>`;
  }).join("");

  stage.innerHTML = `
    <div class="pr-lobby">
      <div class="pr-lede">
        <span class="pr-eyebrow">The Press</span>
        <h3>Spare prints in. One good print out.</h3>
        <p>Load the hopper, then press matching tiers together until you can't.
           What you feed it sets the floor the board starts at, so better junk
           reaches higher. Bank the plate and the best ${PR_MINT_TOP} tiles come
           back as real prints of the subjects you fed in.</p>
        <p class="pr-safe">Only spare copies are ever consumed. Your last copy of
           anything is untouchable, so a run can't cost you a subject, a level,
           or any mining rate.</p>
      </div>

      ${total === 0 ? `
        <div class="pr-empty">
          <strong>No spares yet.</strong>
          <span>Open a few packs. Every second copy of a print becomes fuel.</span>
        </div>` : `
        <div class="pr-hopper">
          <div class="pr-hophead">
            <span class="pr-eyebrow">Hopper</span>
            <span class="pr-hopcount ${ready ? "ok" : ""}">${list.length} / ${PR_MAX_LOAD} loaded${
              ready ? "" : ` · ${PR_MIN_LOAD - list.length} more to start`}</span>
          </div>
          <div class="pr-buckets">${buckets}</div>
          <div class="pr-hopfoot">
            <div class="pr-floor">Starting floor <b>${floor}</b>
              <span style="color:${RARITIES[floor].color}">${prEsc(RARITIES[floor].name)}</span>
              ${list.length ? `<span class="pr-worth">· worth ${list.reduce((a,e)=>a+MARKET_SELL_PRICE_BY_TIER[e.tier],0).toLocaleString()} at the counter</span>` : ""}</div>
            <div class="pr-hopbtns">
              <button class="btn secondary" id="prClear" ${list.length ? "" : "disabled"}>Empty</button>
              <button class="btn secondary" id="prAuto">Fill with lowest</button>
              <button class="btn" id="prGo" ${ready ? "" : "disabled"}>Fire up the press</button>
            </div>
          </div>
        </div>`}

      <div class="pr-lobstats">
        <div><b>${total.toLocaleString()}</b><span>Spare prints</span></div>
        <div><b>${st.bestTier}</b><span>Best tier pressed</span></div>
        <div><b>${st.bestScore.toLocaleString()}</b><span>Best plate</span></div>
        <div><b>${st.pressed.toLocaleString()}</b><span>Prints consumed</span></div>
      </div>
    </div>`;

  stage.querySelectorAll(".pr-bctl button").forEach(b =>
    b.addEventListener("click", ()=> prAdjust(+b.dataset.t, +b.dataset.n)));
  const clear = document.getElementById("prClear");
  if(clear) clear.addEventListener("click", ()=>{ prNewHopper(); prPaintHopper(); });
  const auto = document.getElementById("prAuto");
  if(auto) auto.addEventListener("click", prAutoFill);
  const go = document.getElementById("prGo");
  if(go) go.addEventListener("click", prStart);
}

function prAdjust(tier, delta){
  const spares = prSpares()[tier];
  let left = delta;
  if(delta > 0){
    const room = PR_MAX_LOAD - prHopperTiers().length;
    left = Math.min(delta, room);
    for(const e of spares){
      if(left <= 0) break;
      const cur = prHopper.picks[e.id] || 0;
      const add = Math.min(left, e.spare - cur);
      if(add > 0){ prHopper.picks[e.id] = cur + add; left -= add; }
    }
  } else {
    left = -delta;
    for(const e of spares){
      if(left <= 0) break;
      const cur = prHopper.picks[e.id] || 0;
      const sub = Math.min(left, cur);
      if(sub > 0){
        prHopper.picks[e.id] = cur - sub;
        if(prHopper.picks[e.id] <= 0) delete prHopper.picks[e.id];
        left -= sub;
      }
    }
  }
  prPaintHopper();
}

function prAutoFill(){
  prNewHopper();
  const spares = prSpares();
  let room = PR_MAX_LOAD;
  for(let t = 0; t < 16 && room > 0; t++){
    for(const e of spares[t]){
      if(room <= 0) break;
      const add = Math.min(room, e.spare);
      prHopper.picks[e.id] = add;
      room -= add;
    }
  }
  prPaintHopper();
}

function prPaintSummary(res){
  const stage = prEl();
  if(!stage) return;
  const rBest = RARITIES[res.best];

  stage.innerHTML = `
    <div class="pr-summary">
      <span class="pr-eyebrow">Plate banked</span>
      <h3>Tier <span style="color:${rBest.color}">${res.best}</span> off a floor of ${res.floor}</h3>

      <div class="pr-lobstats">
        <div><b>${res.credits.toLocaleString()}</b><span>Credits</span></div>
        <div><b>${res.mult.toFixed(2)}×</b><span>Beat the counter</span></div>
        <div><b>${res.xp}</b><span>XP</span></div>
        <div><b>${res.loaded}</b><span>Prints consumed</span></div>
      </div>
      <p class="pr-hint">Those ${res.loaded} spares would have fetched
        ${res.sellValue.toLocaleString()} at the Market. Climbing
        ${res.best - res.floor} tier${res.best-res.floor===1?"":"s"} turned that into
        ${res.credits.toLocaleString()}, plus the prints below.</p>

      ${res.minted.length ? `
        <div class="pr-minted">
          <span class="pr-eyebrow">Off the press</span>
          <div class="pr-mintrow">
            ${res.minted.map(m=>{
              const r = RARITIES[m.card.rarity];
              return `<div class="pr-mint" style="--rc:${r.color}">
                ${m.isNew ? `<span class="pr-new">New</span>` : ""}
                <span class="pr-me">${m.card.emoji}</span>
                <span class="pr-mn">${prEsc(m.card.name)}</span>
                <span class="pr-mr">${prEsc(r.name)}</span>
                ${m.overflow ? `<span class="pr-short">capped at the press ceiling — ${m.overflow} tier${m.overflow>1?"s":""} paid out in credits</span>`
                  : m.shortfall ? `<span class="pr-short">no print of this subject exists that high — dropped ${m.shortfall}</span>` : ""}
              </div>`;
            }).join("")}
          </div>
        </div>` : `<p class="pr-hint">Nothing to mint — press at least one tier above the floor.</p>`}

      <div class="pr-foot">
        <button class="btn" id="prAgain">Load another hopper</button>
      </div>
    </div>`;

  document.getElementById("prAgain").addEventListener("click", ()=>{ prNewHopper(); prPaintHopper(); });
}

/* ---------- input ----------------------------------------------------- */
let prKeyBound = false;
function prKeyHandler(e){
  if(!pr || pr.over || pr.banked) return;
  const sec = document.getElementById("tab-press");
  if(!sec || sec.style.display === "none") return;
  const map = { ArrowUp:"up", ArrowDown:"down", ArrowLeft:"left", ArrowRight:"right",
                w:"up", s:"down", a:"left", d:"right" };
  const dir = map[e.key];
  if(!dir) return;
  e.preventDefault();
  prMove(dir);
}
function prBindGestures(){
  if(!prKeyBound){
    window.addEventListener("keydown", prKeyHandler, { passive:false });
    prKeyBound = true;
  }
  const board = document.getElementById("prBoard");
  if(!board) return;
  let sx = 0, sy = 0, tracking = false;
  board.addEventListener("touchstart", e=>{
    const t = e.changedTouches[0]; sx = t.clientX; sy = t.clientY; tracking = true;
  }, { passive:true });
  board.addEventListener("touchend", e=>{
    if(!tracking) return;
    tracking = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - sx, dy = t.clientY - sy;
    if(Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    prMove(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
  }, { passive:true });
}

/* ---------- host wiring ------------------------------------------------ */
function renderPress(){ if(pr) prPaint(); else prPaintHopper(); }
function prOnEnterTab(){ prStats(); if(!prHopper) prNewHopper(); renderPress(); }
function prOnLeaveTab(){
  /* The hopper was already spent to start the run, so leaving mid-run banks
     it rather than throwing those prints away. */
  if(pr && !pr.banked) prBank();
}


