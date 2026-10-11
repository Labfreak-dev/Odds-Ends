/* Labfreak Legends rules engine. Pure logic: no DOM. Works in the browser (window.LLE) and in Node (module.exports).
   State is a plain object; every player action is a function that mutates it and pushes UI events onto G.ev. */
(function (root) {
  'use strict';
  const MAX_HAND = 10, MAX_BOARD = 7, MAX_MANA = 10, START_HP = 30, MAX_SECRETS = 5;
  const CHOSEN = new Set(['any', 'enemy', 'm', 'em', 'fm']);
  // only these effects act on a chosen character; draw, summon, armor and the rest never ask for a target
  const TARGETED = new Set(['dmg', 'heal', 'buff', 'curse', 'kw', 'freeze', 'silence', 'destroy', 'transform', 'bounce']);
  const picks = e => TARGETED.has(e.op) && CHOSEN.has(e.tg || 'any');
  const KWS = ['taunt', 'charge', 'rush', 'divine', 'windfury', 'stealth', 'poisonous', 'lifesteal', 'reborn', 'frostbite', 'enrage', 'cantattack', 'misfire', 'elusive'];

  let DB = null; // { byId, tokens, collectible, heroes }
  function setData(data) {
    const byId = {};
    data.cards.forEach(c => { byId[c.id] = c; });
    Object.values(data.tokens).forEach(c => { byId[c.id] = c; });
    const collectible = data.cards.filter(c => !c.token);
    DB = { byId, tokens: data.tokens, collectible, heroes: data.heroes,
      minionsByCost: {}, data };
    collectible.forEach(c => { if (c.t === 'm') (DB.minionsByCost[c.m] = DB.minionsByCost[c.m] || []).push(c.id); });
    return DB;
  }
  const card = id => DB.byId[id];

  // ---------- rng (mulberry32) ----------
  function rnd(G) { let t = (G.seed += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  const pick = (G, arr) => arr.length ? arr[Math.floor(rnd(G) * arr.length)] : null;
  function shuffle(G, a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd(G) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  // ---------- construction ----------
  function newGame(opts) {
    // opts: { decks:[ids,ids], classes:[cls,cls], seed, names:[...] }
    const G = { seed: (opts.seed >>> 0) || 1, uid: 1, turn: 0, turnNo: 0, phase: 'mulligan', winner: null, log: [], ev: [],
      played: 0, pending: null, p: [] };
    for (let i = 0; i < 2; i++) {
      const hd = DB.heroes[opts.classes[i]];
      const P = { i, cls: opts.classes[i], name: (opts.names && opts.names[i]) || hd.n, heroData: hd,
        hero: { uid: G.uid++, kind: 'hero', owner: i, hp: START_HP, max: START_HP, armor: 0, attacks: 0, frozen: false, frozenAt: -1 },
        mana: 0, maxMana: 0, ovNext: 0, ovLocked: 0, hpUsed: false, deck: shuffle(G, opts.decks[i].slice()), hand: [], board: [],
        secrets: [], weapon: null, fatigue: 0, dead: [], mull: true };
      G.p.push(P);
    }
    G.turn = rnd(G) < 0.5 ? 0 : 1; // who goes first
    const first = G.turn;
    for (let k = 0; k < 3; k++) draw(G, first, true);
    for (let k = 0; k < 5; k++) draw(G, 1 - first, true); // second player: 5 cards + The Coin
    G.first = first;
    return G;
  }

  function mkCardInst(G, cid) { return { uid: G.uid++, cid }; }
  function log(G, s) { G.log.push(s); if (G.log.length > 200) G.log.shift(); }
  function ev(G, e) { G.ev.push(e); }

  // ---------- mulligan ----------
  function mulligan(G, pi, idxs) {
    const P = G.p[pi];
    if (!P.mull) return;
    const back = [];
    idxs.sort((a, b) => b - a).forEach(ix => { const c = P.hand.splice(ix, 1)[0]; if (c) back.push(c.cid); });
    back.forEach(cid => P.deck.push(cid));
    shuffle(G, P.deck);
    for (let k = 0; k < back.length; k++) draw(G, pi, true);
    P.mull = false;
    if (!G.p[0].mull && !G.p[1].mull) {
      G.p[1 - G.first].hand.push(mkCardInst(G, 'coin'));
      G.phase = 'play';
      startTurn(G, G.first);
    }
  }

  // ---------- minions ----------
  function mkMinion(G, cid, owner) {
    const c = card(cid);
    const m = { uid: G.uid++, kind: 'minion', cid, owner, baseA: c.a, a: c.a, h: c.h, max: c.h, kw: new Set(c.kw || []),
      fx: (c.fx || []).slice(), sd: c.sd || 0, sleeping: true, attacks: 0, frozen: false, frozenAt: -1, divine: false, stealth: false,
      reborn: false, silenced: false, dead: false, aura: 0, turnIn: G.turnNo };
    if (m.kw.has('divine')) m.divine = true;
    if (m.kw.has('stealth')) m.stealth = true;
    if (m.kw.has('reborn')) m.reborn = true;
    return m;
  }
  const atkOf = (G, u) => {
    if (u.kind === 'hero') { const P = G.p[u.owner]; return (u.tempAtk || 0) + (P.weapon && G.turn === u.owner ? P.weapon.a : 0); }
    let a = u.a + (u.aura || 0);
    if (u.kw.has('enrage') && u.h < u.max) a += 2;
    return Math.max(0, a);
  };
  function recalcAuras(G) {
    for (const P of G.p) {
      P.board.forEach(m => { m.aura = 0; });
      P.board.forEach((m, i) => {
        if (m.silenced) return;
        m.fx.forEach(e => {
          if (e.op === 'aura_adj') { [P.board[i - 1], P.board[i + 1]].forEach(n => { if (n) n.aura += e.a; }); }
        });
      });
    }
  }
  function spellDamage(G, pi) {
    let s = 0;
    G.p[pi].board.forEach(m => { if (!m.silenced && !m.dead) { s += m.sd || 0; m.fx.forEach(e => { if (e.op === 'aura_sd') s += e.n; }); } });
    return s;
  }
  function summon(G, pi, cid, pos) {
    const P = G.p[pi];
    if (P.board.length >= MAX_BOARD) return null;
    const m = mkMinion(G, cid, pi);
    if (pos == null || pos > P.board.length) pos = P.board.length;
    P.board.splice(pos, 0, m);
    ev(G, { t: 'summon', uid: m.uid, pi });
    // "whenever you summon a minion"
    P.board.forEach(o => { if (o !== m && !o.silenced) o.fx.forEach(e => { if (e.on === 'fsum') resolve(G, e, { pi, src: o }); }); });
    recalcAuras(G);
    return m;
  }

  // ---------- draw / turn ----------
  function draw(G, pi, quiet) {
    const P = G.p[pi];
    if (!P.deck.length) {
      P.fatigue++;
      log(G, `${P.name} takes ${P.fatigue} fatigue damage.`);
      ev(G, { t: 'fatigue', pi, n: P.fatigue });
      damage(G, null, P.hero, P.fatigue, {});
      return null;
    }
    const cid = P.deck.shift();
    if (P.hand.length >= MAX_HAND) { log(G, `${P.name}'s hand is full. ${card(cid).n} burns.`); ev(G, { t: 'burn', pi, cid }); return null; }
    const ci = mkCardInst(G, cid);
    P.hand.push(ci);
    if (!quiet) ev(G, { t: 'draw', pi, uid: ci.uid });
    return ci;
  }
  function startTurn(G, pi) {
    const P = G.p[pi];
    G.turn = pi; G.turnNo++; G.played = 0;
    P.maxMana = Math.min(MAX_MANA, P.maxMana + 1);
    P.ovLocked = P.ovNext; P.ovNext = 0;
    P.mana = Math.max(0, P.maxMana - P.ovLocked);
    P.hpUsed = false;
    P.hero.attacks = 0; P.hero.tempAtk = 0;
    P.board.forEach(m => { m.sleeping = false; m.attacks = 0; });
    ev(G, { t: 'turn', pi });
    log(G, `\u2014 ${P.name === 'You' ? 'Your' : P.name + "'s"} turn ${Math.ceil(G.turnNo / 2)} \u2014`);
    for (const m of P.board.slice()) if (!m.silenced && !m.dead) m.fx.forEach(e => { if (e.on === 'sot') resolve(G, e, { pi, src: m }); });
    deaths(G);
    if (G.phase === 'over') return;
    draw(G, pi);
    deaths(G);
  }
  function endTurn(G) {
    if (G.phase !== 'play' || G.pending) return false;
    const pi = G.turn, P = G.p[pi];
    for (const m of P.board.slice()) if (!m.silenced && !m.dead) m.fx.forEach(e => { if (e.on === 'eot') resolve(G, e, { pi, src: m }); });
    deaths(G);
    if (G.phase === 'over') return true;
    // thaw: frozen characters of the player whose turn ends, unless frozen during this very turn
    [...P.board, P.hero].forEach(u => { if (u.frozen && u.frozenAt !== G.turnNo) { u.frozen = false; } });
    P.hero.tempAtk = 0;
    startTurn(G, 1 - pi);
    return true;
  }

  // ---------- targeting ----------
  function needsTarget(c, onKeys) {
    return (c.fx || []).some(e => onKeys.includes(e.on) && picks(e));
  }
  function targetTg(c, onKeys) { const e = (c.fx || []).find(e => onKeys.includes(e.on) && picks(e)); return e ? (e.tg || 'any') : null; }
  function chosenEffect(c, onKeys) { return (c.fx || []).find(e => onKeys.includes(e.on) && picks(e)); }
  function validTargets(G, pi, tg, opts) {
    // opts: { spell:bool, self:uid, eff }
    opts = opts || {};
    const me = G.p[pi], op = G.p[1 - pi];
    let list = [];
    const enemyOK = u => !(u.kind === 'minion' && u.stealth) && !(opts.spell && u.kind === 'minion' && u.kw.has('elusive'));
    const allyOK = u => !(opts.spell && u.kind === 'minion' && u.kw.has('elusive'));
    if (tg === 'any') list = [...me.board.filter(allyOK), me.hero, ...op.board.filter(enemyOK), op.hero];
    else if (tg === 'enemy') list = [...op.board.filter(enemyOK), op.hero];
    else if (tg === 'm') list = [...me.board.filter(allyOK), ...op.board.filter(enemyOK)];
    else if (tg === 'em') list = op.board.filter(enemyOK);
    else if (tg === 'fm') list = me.board.filter(allyOK);
    list = list.filter(u => !u.dead && u.uid !== opts.self);
    const e = opts.eff;
    if (e && e.op === 'destroy' && e.max != null) list = list.filter(u => u.kind === 'minion' && atkOf(G, u) <= e.max);
    if (e && ['buff', 'kw', 'silence', 'destroy', 'transform', 'bounce', 'curse'].includes(e.op)) list = list.filter(u => u.kind === 'minion');
    return list;
  }
  function findUnit(G, uid) {
    for (const P of G.p) { if (P.hero.uid === uid) return P.hero; const m = P.board.find(x => x.uid === uid); if (m) return m; }
    return null;
  }
  function costOf(G, pi, ci) {
    const c = card(ci.cid);
    let m = c.m;
    if (c.evo && G.p[pi].board.some(x => x.cid === c.evo.fromId && !x.dead)) m = Math.max(0, m - 2);
    return m;
  }

  // ---------- damage / heal ----------
  function damage(G, src, u, n, ctx) {
    if (!u || u.dead || n <= 0) return 0;
    if (u.kind === 'minion' && u.divine) { u.divine = false; ev(G, { t: 'shield', uid: u.uid }); return 0; }
    let dealt = n;
    if (u.kind === 'hero') {
      const ab = Math.min(u.armor, n); u.armor -= ab; u.hp -= (n - ab);
      // owner's "when your hero takes damage" secrets fire on the opponent's turn
      const P = G.p[u.owner];
      if (G.turn !== u.owner) fireSecret(G, u.owner, 'ehp', {});
    } else { u.h -= n; }
    ev(G, { t: 'dmg', uid: u.uid, n });
    if (src && src.kind === 'minion' && !src.silenced) {
      if (src.kw.has('poisonous') && u.kind === 'minion') u.poisoned = true;
      if (src.kw.has('frostbite')) freeze(G, u);
      if (src.kw.has('lifesteal')) heal(G, G.p[src.owner].hero, dealt);
    } else if (src && src.kind === 'weapon') {
      if (src.kw.includes('poisonous') && u.kind === 'minion') u.poisoned = true;
      if (src.kw.includes('frostbite')) freeze(G, u);
      if (src.kw.includes('lifesteal')) heal(G, G.p[src.owner].hero, dealt);
    } else if (ctx && ctx.lifesteal != null) { heal(G, G.p[ctx.lifesteal].hero, dealt); }
    if (u.kind === 'minion' && !u.silenced) u.fx.forEach(e => { if (e.on === 'dmg') resolve(G, e, { pi: u.owner, src: u }); });
    // Frenzy: the first time this minion takes damage and lives
    if (u.kind === 'minion' && !u.silenced && !u.frenzied && u.h > 0 && !u.poisoned && u.fx.some(e => e.on === 'frenzy')) {
      u.frenzied = true;
      ev(G, { t: 'frenzy', uid: u.uid });
      log(G, `${card(u.cid).n} goes into a Frenzy!`);
      u.fx.forEach(e => { if (e.on === 'frenzy') resolve(G, e, { pi: u.owner, src: u }); });
    }
    return dealt;
  }
  function heal(G, u, n) {
    if (!u || u.dead || n <= 0) return 0;
    const cur = u.kind === 'hero' ? u.hp : u.h;
    const amt = Math.min(n, u.max - cur);
    if (amt <= 0) return 0;
    if (u.kind === 'hero') u.hp += amt; else u.h += amt;
    ev(G, { t: 'heal', uid: u.uid, n: amt });
    for (const P of G.p) P.board.slice().forEach(m => { if (!m.silenced && !m.dead) m.fx.forEach(e => { if (e.on === 'heal') resolve(G, e, { pi: m.owner, src: m }); }); });
    return amt;
  }
  function freeze(G, u) { if (!u || u.dead) return; u.frozen = true; u.frozenAt = G.turnNo; ev(G, { t: 'freeze', uid: u.uid }); }

  function deaths(G) {
    for (let guard = 0; guard < 30; guard++) {
      const dying = [];
      for (const P of G.p) P.board.forEach((m, i) => { if (m.h <= 0 || m.poisoned || m.destroy) dying.push({ m, P, i }); });
      if (!dying.length) break;
      dying.sort((a, b) => a.m.uid - b.m.uid);
      for (const d of dying) {
        const idx = d.P.board.indexOf(d.m);
        if (idx < 0) continue;
        d.P.board.splice(idx, 1);
        d.m.dead = true; d.m.pos = idx;
        if (!card(d.m.cid).token) d.P.dead.push(d.m.cid);
        ev(G, { t: 'death', uid: d.m.uid, pi: d.P.i });
        log(G, `${card(d.m.cid).n} dies.`);
      }
      for (const d of dying) {
        const m = d.m;
        if (!m.silenced) m.fx.forEach(e => { if (e.on === 'dr') resolve(G, e, { pi: m.owner, src: m, pos: m.pos }); });
        // enemy-minion-dies triggers
        G.p[1 - m.owner].board.slice().forEach(o => { if (!o.silenced && !o.dead) o.fx.forEach(e => { if (e.on === 'edie') resolve(G, e, { pi: o.owner, src: o }); }); });
        fireSecret(G, m.owner, 'fdie', { trig: m });
        if (m.reborn && !m.silenced) {
          const r = summon(G, m.owner, m.cid, m.pos);
          if (r) { r.h = 1; r.reborn = false; r.kw.delete('reborn'); log(G, `${card(m.cid).n} is reborn.`); }
        }
      }
      recalcAuras(G);
    }
    checkWin(G);
  }
  function checkWin(G) {
    if (G.phase === 'over') return;
    const d0 = G.p[0].hero.hp <= 0, d1 = G.p[1].hero.hp <= 0;
    if (d0 || d1) { G.phase = 'over'; G.winner = d0 && d1 ? -1 : (d0 ? 1 : 0); ev(G, { t: 'over', winner: G.winner }); log(G, G.winner < 0 ? 'Draw.' : `${G.p[G.winner].name} wins!`); }
  }

  // ---------- effects ----------
  function unitsFor(G, e, ctx) {
    const me = G.p[ctx.pi], op = G.p[1 - ctx.pi];
    const alive = l => l.filter(u => u && !u.dead && (u.kind === 'hero' || u.h > 0));
    switch (e.tg || 'any') {
      case 'any': case 'enemy': case 'm': case 'em': case 'fm': return ctx.target && !ctx.target.dead ? [ctx.target] : [];
      case 'self': return ctx.src && ctx.src.kind === 'minion' ? [ctx.src] : [];
      case 'fhero': return [me.hero];
      case 'ehero': return [op.hero];
      case 'em_all': return alive(op.board.slice());
      case 'am_all': return alive([...me.board, ...op.board]);
      case 'others': return alive([...me.board, ...op.board].filter(u => u !== ctx.src));
      case 'enemies': return alive([...op.board, op.hero]);
      case 'friends': return alive([...me.board, me.hero]);
      case 'fm_all': return alive(me.board.filter(u => u !== ctx.src));
      case 'rand_enemy': { const l = alive([...op.board, op.hero]); return l.length ? [pick(G, l)] : []; }
      case 'rand_em': { const l = alive(op.board.slice()); return l.length ? [pick(G, l)] : []; }
      case 'adj': { const i = me.board.indexOf(ctx.src); return alive([me.board[i - 1], me.board[i + 1]]); }
      case 'trig': return ctx.trig ? alive([ctx.trig]) : [];
      default: return [];
    }
  }
  function resolve(G, e, ctx) {
    if (G.phase === 'over') return;
    const pi = ctx.pi, me = G.p[pi], op = G.p[1 - pi];
    const sd = ctx.spell ? spellDamage(G, pi) : 0;
    const us = () => unitsFor(G, e, ctx);
    const srcUnit = ctx.src && ctx.src.kind === 'minion' ? ctx.src : null;
    switch (e.op) {
      case 'dmg': { const n = e.n + sd; us().forEach(u => damage(G, srcUnit, u, n, ctx)); if (ctx.spell) ev(G, { t: 'vfx', k: ctx.vfx, uids: us().map(u => u.uid) }); break; }
      case 'heal': us().forEach(u => heal(G, u, e.n)); break;
      case 'aoe_heal': [...me.board, me.hero].forEach(u => heal(G, u, e.n)); break;
      case 'buff': us().forEach(u => { if (u.kind !== 'minion') return; u.a += e.a; u.h += e.h; u.max += e.h; ev(G, { t: 'buff', uid: u.uid }); }); break;
      case 'curse': us().forEach(u => { if (u.kind !== 'minion') return; u.a = Math.max(0, u.a - e.n); ev(G, { t: 'buff', uid: u.uid }); }); break;
      case 'kw': us().forEach(u => { if (u.kind !== 'minion') return; u.kw.add(e.k); if (e.k === 'divine') u.divine = true; if (e.k === 'stealth') u.stealth = true;
        if (e.k === 'reborn') u.reborn = true; if (e.k === 'charge' || e.k === 'rush') { /* can act now */ } ev(G, { t: 'buff', uid: u.uid }); }); break;
      case 'armor': me.hero.armor += e.n; ev(G, { t: 'armor', uid: me.hero.uid, n: e.n }); break;
      case 'draw': for (let k = 0; k < e.n; k++) draw(G, pi); break;
      case 'summon': { const cnt = e.cnt || 1; let pos = ctx.pos != null ? ctx.pos : (srcUnit ? me.board.indexOf(srcUnit) + 1 : me.board.length);
        if (pos < 0) pos = me.board.length;
        for (let k = 0; k < cnt; k++) { const m = summon(G, pi, e.id, pos); if (m) pos++; } break; }
      case 'freeze': us().forEach(u => freeze(G, u)); break;
      case 'silence': us().forEach(u => silence(G, u)); break;
      case 'destroy': us().forEach(u => { if (u.kind === 'minion' && (e.max == null || atkOf(G, u) <= e.max)) { u.destroy = true; ev(G, { t: 'destroy', uid: u.uid }); } }); break;
      case 'mana': me.mana = Math.min(MAX_MANA, me.mana + e.n); break;
      case 'crystal': me.maxMana = Math.min(MAX_MANA, me.maxMana + 1); break;
      case 'missiles': { const n = e.n + sd; for (let k = 0; k < n; k++) { const l = [...op.board, op.hero].filter(u => !u.dead && (u.kind === 'hero' || u.h > 0));
          const u = pick(G, l); if (u) damage(G, srcUnit, u, 1, ctx); } break; }
      case 'resurrect': { const pool = me.dead.slice(); for (let k = 0; k < e.n && pool.length; k++) { const i = Math.floor(rnd(G) * pool.length); summon(G, pi, pool.splice(i, 1)[0]); } break; }
      case 'coin': if (me.hand.length < MAX_HAND) me.hand.push(mkCardInst(G, 'coin')); break;
      case 'steal': { if (op.hand.length && me.hand.length < MAX_HAND) { const i = Math.floor(rnd(G) * op.hand.length); const c = op.hand.splice(i, 1)[0]; me.hand.push(c); ev(G, { t: 'steal', pi }); log(G, `${me.name} steals a card.`); } break; }
      case 'transform': us().forEach(u => {
        if (u.kind !== 'minion') return; const P = G.p[u.owner]; const pool = DB.minionsByCost[card(u.cid).m] || DB.minionsByCost[3];
        const nid = pick(G, pool); const i = P.board.indexOf(u); if (i < 0) return;
        const nm = mkMinion(G, nid, u.owner); P.board[i] = nm; u.dead = true; ev(G, { t: 'transform', uid: u.uid, to: nm.uid }); }); recalcAuras(G); break;
      case 'bounce': us().forEach(u => { if (u.kind !== 'minion') return; const P = G.p[u.owner]; const i = P.board.indexOf(u); if (i < 0) return;
        P.board.splice(i, 1); u.dead = true; ev(G, { t: 'bounce', uid: u.uid }); if (P.hand.length < MAX_HAND && !card(u.cid).token) P.hand.push(mkCardInst(G, u.cid)); }); recalcAuras(G); break;
      case 'gamble': { const r = Math.floor(rnd(G) * 3); ev(G, { t: 'gamble', r, pi });
        if (r === 0) { const l = [...op.board, op.hero].filter(u => !u.dead); const u = pick(G, l); if (u) damage(G, srcUnit, u, e.n + sd, ctx); log(G, 'The reels land on Daggers.'); }
        else if (r === 1) { heal(G, me.hero, e.n); log(G, 'The reels land on Hearts.'); } else { draw(G, pi); log(G, 'The reels land on Cards.'); } break; }
      case 'copy': if (srcUnit) summon(G, pi, srcUnit.cid, me.board.indexOf(srcUnit) + 1); break;
      case 'discover': discover(G, pi, e.pool); break;
      case 'equip': equip(G, pi, { a: e.a, h: e.h, kw: [], cid: ctx.cid }); break;
      case 'hatk': me.hero.tempAtk = (me.hero.tempAtk || 0) + e.n; ev(G, { t: 'buff', uid: me.hero.uid }); break;
      case 'dredge': dredge(G, pi); break;
      case 'wbuff': if (me.weapon) { me.weapon.a += e.a || 0; me.weapon.h += e.h || 0; ev(G, { t: 'equip', pi }); } break;
      default: break;
    }
  }
  function silence(G, u) {
    if (u.kind !== 'minion') return;
    const c = card(u.cid);
    u.silenced = true; u.kw = new Set(); u.fx = []; u.sd = 0; u.divine = false; u.stealth = false; u.reborn = false; u.frozen = false;
    u.a = c.a; u.max = c.h; u.h = Math.min(u.h, u.max);
    ev(G, { t: 'silence', uid: u.uid }); recalcAuras(G);
  }
  function equip(G, pi, w) {
    const P = G.p[pi];
    P.weapon = { kind: 'weapon', owner: pi, a: w.a, h: w.h, kw: w.kw || [], cid: w.cid, uid: G.uid++ };
    ev(G, { t: 'equip', pi });
  }
  function discoverPool(G, pi, pool) {
    const cls = G.p[pi].cls;
    return DB.collectible.filter(c => (c.c === cls || c.c === 'neutral') &&
      (pool === 'any' || (pool === 'spell' && c.t === 's') || (pool === 'minion' && c.t === 'm') || (pool === 'legendary' && c.r === 3)));
  }
  function discover(G, pi, pool) {
    const P = G.p[pi];
    const cands = discoverPool(G, pi, pool);
    const opts = [];
    for (let k = 0; k < 40 && opts.length < 3; k++) { const c = pick(G, cands); if (c && !opts.includes(c.id)) opts.push(c.id); }
    if (!opts.length) return;
    if (P.isBot || G.autoDiscover) { const best = opts.slice().sort((a, b) => cardValue(card(b)) - cardValue(card(a)))[0]; if (P.hand.length < MAX_HAND) P.hand.push(mkCardInst(G, best)); log(G, `${P.name} discovers a card.`); }
    else setPending(G, { type: 'discover', pi, opts });
  }
  // a player's choices (Pick 1 of 3, Dredge) queue up when one card asks for more than one
  function setPending(G, pd) { if (G.pending) (G.pendingQ = G.pendingQ || []).push(pd); else G.pending = pd; }
  function nextPending(G) {
    G.pending = null;
    while (G.pendingQ && G.pendingQ.length && !G.pending) {
      const pd = G.pendingQ.shift();
      if (pd.type === 'dredge' && pd.lazy) dredge(G, pd.pi, true); else G.pending = pd;
    }
  }
  // Dredge: look at the bottom 3 cards of your deck and put one of them on top
  function dredge(G, pi, now) {
    const P = G.p[pi];
    if (!P.isBot && !G.autoDiscover && G.pending && !now) { setPending(G, { type: 'dredge', pi, lazy: true }); return; }
    const n = Math.min(3, P.deck.length);
    if (!n) return;
    const idxs = []; for (let k = P.deck.length - n; k < P.deck.length; k++) idxs.push(k);
    if (P.isBot || G.autoDiscover) {
      const want = Math.min(10, P.maxMana + 1);
      const score = cid => { const c = card(cid); return -Math.abs(Math.min(c.m, 10) - want) * 2 + cardValue(c) * 0.3 - (c.m > want ? 3 : 0); };
      const best = idxs.slice().sort((a, b) => score(P.deck[b]) - score(P.deck[a]))[0];
      const cid = P.deck.splice(best, 1)[0]; P.deck.unshift(cid);
      log(G, `${P.name} dredges a card to the top of their deck.`);
      ev(G, { t: 'dredge', pi });
    } else G.pending = { type: 'dredge', pi, opts: idxs.map(k => P.deck[k]), idxs };
  }
  function chooseDredge(G, i) {
    const pd = G.pending; if (!pd || pd.type !== 'dredge') return;
    const P = G.p[pd.pi]; const k = pd.idxs[i];
    if (k != null && k < P.deck.length) { const cid = P.deck.splice(k, 1)[0]; P.deck.unshift(cid); log(G, `${P.name} puts ${card(cid).n} on top of their deck.`); }
    nextPending(G);
  }
  function chooseDiscover(G, idx) {
    const pd = G.pending; if (!pd) return;
    const P = G.p[pd.pi]; const cid = pd.opts[idx];
    if (cid && P.hand.length < MAX_HAND) P.hand.push(mkCardInst(G, cid));
    nextPending(G);
    log(G, `${P.name} discovers ${card(cid).n}.`);
  }

  // ---------- secrets ----------
  function fireSecret(G, ownerPi, trig, ctx) {
    const P = G.p[ownerPi];
    if (G.turn === ownerPi) return { fired: false, countered: false };
    const i = P.secrets.findIndex(s => (card(s.cid).fx || []).some(e => e.on === 'sec' && e.trig === trig));
    if (i < 0) return { fired: false, countered: false };
    const s = P.secrets.splice(i, 1)[0];
    const c = card(s.cid);
    ev(G, { t: 'secret', pi: ownerPi, cid: s.cid });
    log(G, `Trap sprung: ${c.n}!`);
    let countered = false;
    c.fx.filter(e => e.on === 'sec').forEach(e => {
      if (e.op === 'counter') countered = true;
      else resolve(G, e, { pi: ownerPi, trig: ctx.trig, spell: true, vfx: c.vfx });
    });
    return { fired: true, countered };
  }

  // ---------- playing cards ----------
  function canPlay(G, pi, handIdx) {
    if (G.phase !== 'play' || G.turn !== pi || G.pending) return false;
    const P = G.p[pi], ci = P.hand[handIdx]; if (!ci) return false;
    const c = card(ci.cid);
    if (costOf(G, pi, ci) > P.mana) return false;
    if (c.t === 'm' && P.board.length >= MAX_BOARD && !(c.evo && P.board.some(x => x.cid === c.evo.fromId))) return false;
    if (c.secret && (P.secrets.some(s => s.cid === c.id) || P.secrets.length >= MAX_SECRETS)) return false;
    if (c.t === 's' && !c.secret && needsTarget(c, ['cast'])) {
      const e = chosenEffect(c, ['cast']);
      if (!validTargets(G, pi, e.tg || 'any', { spell: true, eff: e }).length) return false;
    }
    return true;
  }
  function playCard(G, pi, handIdx, targetUid, pos) {
    if (!canPlay(G, pi, handIdx)) return false;
    const P = G.p[pi], ci = P.hand[handIdx], c = card(ci.cid);
    const cost = costOf(G, pi, ci);
    const onKeys = c.t === 's' ? ['cast'] : ['bc', 'combo'];
    let target = null;
    if (needsTarget(c, onKeys)) {
      const e = chosenEffect(c, onKeys);
      const valid = validTargets(G, pi, e.tg || 'any', { spell: c.t === 's', eff: e });
      target = valid.find(u => u.uid === targetUid) || null;
      if (c.t === 's' && !target) return false; // spells need their target
    }
    P.mana -= cost;
    P.hand.splice(handIdx, 1);
    const combo = G.played > 0;
    G.played++;
    if (c.ov) P.ovNext += c.ov;
    ev(G, { t: 'play', pi, cid: c.id, target: target && target.uid });
    log(G, `${P.name} plays ${c.n}.`);
    if (c.t === 'm') {
      let evoFrom = c.evo ? P.board.find(x => x.cid === c.evo.fromId && !x.dead) : null;
      let m;
      if (evoFrom) {
        const i = P.board.indexOf(evoFrom);
        m = mkMinion(G, c.id, pi);
        m.sleeping = evoFrom.sleeping || evoFrom.attacks > 0;
        P.board[i] = m; evoFrom.dead = true;
        ev(G, { t: 'evolve', from: evoFrom.uid, uid: m.uid, pi });
        log(G, `${card(evoFrom.cid).n} evolves into ${c.n}!`);
        recalcAuras(G);
      } else {
        if (pos == null) pos = P.board.length;
        m = summon(G, pi, c.id, pos);
        if (!m) return true;
      }
      fireSecret(G, 1 - pi, 'eminion', { trig: m });
      deaths(G);
      if (m.dead || G.phase === 'over') return true;
      (c.fx || []).forEach(e => {
        if (e.on === 'bc' || (e.on === 'combo' && combo)) resolve(G, e, { pi, src: m, target: picks(e) ? target : null, cid: c.id });
      });
    } else if (c.t === 'w') {
      equip(G, pi, { a: c.a, h: c.h, kw: c.kw || [], cid: c.id });
      (c.fx || []).forEach(e => { if (e.on === 'bc') resolve(G, e, { pi, target: picks(e) ? target : null, cid: c.id }); });
    } else if (c.secret) {
      P.secrets.push({ uid: ci.uid, cid: c.id });
      ev(G, { t: 'secretSet', pi });
    } else {
      const countered = G.p[1 - pi].secrets.length ? (() => {
        const opP = G.p[1 - pi];
        const i = opP.secrets.findIndex(s => (card(s.cid).fx || []).some(e => e.on === 'sec' && e.trig === 'espell'));
        if (i < 0) return false;
        return fireSecret(G, 1 - pi, 'espell', {}).countered;
      })() : false;
      if (!countered) {
        (c.fx || []).forEach(e => { if (e.on === 'cast') resolve(G, e, { pi, target: picks(e) ? target : null, spell: true, vfx: c.vfx, cid: c.id }); });
        P.board.slice().forEach(m => { if (!m.silenced && !m.dead) m.fx.forEach(e => { if (e.on === 'fspell') resolve(G, e, { pi, src: m }); }); });
      } else log(G, `${c.n} was countered.`);
    }
    deaths(G);
    return true;
  }

  // ---------- hero power ----------
  function canHeroPower(G, pi) {
    const P = G.p[pi]; const hp = P.heroData.hp;
    if (G.phase !== 'play' || G.turn !== pi || P.hpUsed || P.mana < hp.m || G.pending) return false;
    const e = hp.fx.find(picks);
    if (e && !validTargets(G, pi, e.tg || 'any', { spell: true, eff: e }).length) return false;
    return true;
  }
  function heroPower(G, pi, targetUid) {
    if (!canHeroPower(G, pi)) return false;
    const P = G.p[pi], hp = P.heroData.hp, e = hp.fx.find(picks);
    let target = null;
    if (e) {
      target = validTargets(G, pi, e.tg || 'any', { spell: true, eff: e }).find(u => u.uid === targetUid);
      if (!target) return false;
    }
    P.mana -= hp.m; P.hpUsed = true;
    ev(G, { t: 'hp', pi, target: target && target.uid });
    log(G, `${P.name} uses ${hp.n}.`);
    hp.fx.forEach(x => resolve(G, x, { pi, target: picks(x) ? target : null, src: P.hero }));
    deaths(G);
    return true;
  }

  // ---------- combat ----------
  function canAttack(G, u) {
    if (G.phase !== 'play' || G.pending || !u || u.dead || u.owner !== G.turn) return false;
    if (u.frozen) return false;
    if (atkOf(G, u) <= 0) return false;
    if (u.kind === 'hero') return u.attacks < 1;
    if (u.kw.has('cantattack')) return false;
    const max = u.kw.has('windfury') ? 2 : 1;
    if (u.attacks >= max) return false;
    if (u.sleeping && !u.kw.has('charge') && !u.kw.has('rush')) return false;
    return true;
  }
  function attackTargets(G, u) {
    if (!canAttack(G, u)) return [];
    const op = G.p[1 - u.owner];
    const taunts = op.board.filter(m => m.kw.has('taunt') && !m.stealth && !m.dead);
    let list = taunts.length ? taunts : [...op.board.filter(m => !m.stealth && !m.dead), op.hero];
    if (u.kind === 'minion' && u.sleeping && !u.kw.has('charge')) list = list.filter(x => x.kind === 'minion'); // rush
    return list;
  }
  function attack(G, attUid, defUid) {
    const a = findUnit(G, attUid); if (!a) return false;
    const tl = attackTargets(G, a);
    let d = tl.find(x => x.uid === defUid);
    if (!d) return false;
    if (a.kind === 'minion' && a.kw.has('misfire') && !a.silenced) { const r = pick(G, tl); if (r) d = r; }
    const P = G.p[a.owner];
    a.attacks++;
    if (a.kind === 'minion') a.stealth = false;
    ev(G, { t: 'attack', from: a.uid, to: d.uid });
    // defender's secret
    fireSecret(G, d.owner, 'eattack', { trig: a });
    deaths(G);
    if (a.dead || d.dead || G.phase === 'over' || (a.kind === 'hero' && a.hp <= 0)) return true;
    if (a.kind === 'minion' && !a.silenced) a.fx.forEach(e => { if (e.on === 'atk') resolve(G, e, { pi: a.owner, src: a }); });
    deaths(G);
    if (a.dead || d.dead || G.phase === 'over') return true;
    const aa = atkOf(G, a), da = d.kind === 'minion' ? atkOf(G, d) : 0;
    const wsrc = a.kind === 'hero' && P.weapon ? P.weapon : null;
    damage(G, a.kind === 'minion' ? a : wsrc, d, aa, {});
    if (da > 0) damage(G, d, a, da, {});
    if (wsrc) { wsrc.h--; if (wsrc.h <= 0) { P.weapon = null; ev(G, { t: 'weaponBreak', pi: a.owner }); } }
    log(G, `${a.kind === 'hero' ? P.name : card(a.cid).n} attacks ${d.kind === 'hero' ? G.p[d.owner].name : card(d.cid).n}.`);
    deaths(G);
    return true;
  }

  // ---------- values for AI ----------
  function cardValue(c) {
    if (!c) return 0;
    let v = c.m * 2 + (c.r || 0);
    if (c.t === 'm') v += (c.a + c.h) * 0.5;
    return v;
  }
  function unitValue(G, u) {
    if (u.kind === 'hero') return 0;
    let v = atkOf(G, u) * 1.2 + u.h;
    if (u.kw.has('taunt')) v += 1; if (u.divine) v += 2; if (u.kw.has('windfury')) v += atkOf(G, u) * 0.6;
    if (u.kw.has('poisonous')) v += 3; if (u.kw.has('lifesteal')) v += 1; if (u.sd) v += 1.5;
    if (u.fx.some(e => ['eot', 'sot', 'edie', 'heal', 'fspell', 'atk', 'dmg'].includes(e.on))) v += 3;
    if (!u.frenzied && u.fx.some(e => e.on === 'frenzy')) v += 1.5;
    return v;
  }

  // ---------- bot ----------
  function chooseTargetFor(G, pi, e, opts) {
    const list = validTargets(G, pi, e.tg || 'any', opts);
    if (!list.length) return null;
    const me = G.p[pi];
    const enemy = u => u.owner !== pi;
    const harm = ['dmg', 'freeze', 'silence', 'destroy', 'transform', 'bounce', 'curse'].includes(e.op);
    if (e.op === 'dmg') {
      const n = e.n + (opts.spell ? spellDamage(G, pi) : 0);
      const kills = list.filter(u => enemy(u) && u.kind === 'minion' && !u.divine && u.h <= n).sort((a, b) => unitValue(G, b) - unitValue(G, a));
      if (kills.length) return kills[0];
      const eh = list.find(u => enemy(u) && u.kind === 'hero');
      if (eh) return eh;
      const em = list.filter(enemy).sort((a, b) => unitValue(G, b) - unitValue(G, a));
      return em[0] || null;
    }
    if (harm) {
      const em = list.filter(u => enemy(u) && u.kind === 'minion').sort((a, b) => unitValue(G, b) - unitValue(G, a));
      if (e.op === 'silence') { const good = em.filter(u => u.fx.length || u.kw.size || u.divine || u.a > card(u.cid).a); return good[0] || null; }
      if (e.op === 'freeze') { const eh = list.find(u => enemy(u) && u.kind === 'hero'); return em[0] || eh || null; }
      return em[0] || null;
    }
    if (e.op === 'heal') {
      const hurt = list.filter(u => !enemy(u)).map(u => ({ u, miss: (u.kind === 'hero' ? u.max - u.hp : u.max - u.h) })).filter(x => x.miss > 0).sort((a, b) => b.miss - a.miss);
      return hurt.length ? hurt[0].u : (list.find(u => !enemy(u)) || null);
    }
    const fr = list.filter(u => !enemy(u) && u.kind === 'minion').sort((a, b) => unitValue(G, b) - unitValue(G, a));
    return fr[0] || null;
  }
  function botMulligan(G, pi) {
    const P = G.p[pi];
    const idx = [];
    P.hand.forEach((ci, i) => { if (card(ci.cid).m >= 4 && ci.cid !== 'coin') idx.push(i); });
    mulligan(G, pi, idx);
  }
  // one bot action; returns false when the bot has nothing left to do (caller then ends the turn)
  function botStep(G, pi) {
    if (G.phase !== 'play' || G.turn !== pi) return false;
    const P = G.p[pi], op = G.p[1 - pi];
    // 1. lethal check: attack face if total damage kills
    const attackers = [...P.board, P.hero].filter(u => canAttack(G, u));
    const taunts = op.board.filter(m => m.kw.has('taunt') && !m.stealth);
    const faceDmg = attackers.filter(u => !(u.kind === 'minion' && u.sleeping && !u.kw.has('charge'))).reduce((s, u) => s + atkOf(G, u) * (u.kind === 'minion' && u.kw.has('windfury') ? 2 - u.attacks : 1), 0);
    const lethal = !taunts.length && faceDmg >= op.hero.hp + op.hero.armor;
    if (lethal) {
      const u = attackers.find(x => attackTargets(G, x).includes(op.hero));
      if (u) return attack(G, u.uid, op.hero.uid);
    }
    // 2. play the most valuable affordable card
    const options = [];
    P.hand.forEach((ci, i) => {
      if (!canPlay(G, pi, i)) return;
      const c = card(ci.cid);
      if (ci.cid === 'coin') { const after = P.hand.some((x, j) => j !== i && costOf(G, pi, x) === P.mana + 1); if (!after) return; }
      let score = costOf(G, pi, ci) * 3 + cardValue(c) * 0.2;
      if (c.evo && P.board.some(x => x.cid === c.evo.fromId)) score += 3;
      const onKeys = c.t === 's' ? ['cast'] : ['bc', 'combo'];
      let tgt = null;
      if (needsTarget(c, onKeys)) {
        const e = chosenEffect(c, onKeys);
        tgt = chooseTargetFor(G, pi, e, { spell: c.t === 's', eff: e });
        if (!tgt && c.t === 's') return;
        if (tgt && ['buff', 'kw', 'heal'].includes(e.op) && tgt.owner !== pi) tgt = null;
        if (tgt && ['dmg', 'destroy', 'silence', 'freeze', 'transform', 'curse', 'bounce'].includes(e.op) && tgt.owner === pi) { if (c.t === 's') return; tgt = null; }
        if (c.t === 's' && !tgt) return;
      }
      // don't waste heal spells at full health
      if (c.t === 's' && (c.fx || []).every(e => e.op === 'heal' || e.op === 'aoe_heal') && P.hero.hp >= P.hero.max - 2 && !P.board.some(m => m.h < m.max)) return;
      if (c.t === 's' && (c.fx || []).some(e => e.op === 'dmg' && (e.tg === 'em_all')) && op.board.length < 2) score -= 6;
      if (c.t === 'w' && P.weapon) score -= 4;
      options.push({ i, score, tgt });
    });
    if (options.length) {
      options.sort((a, b) => b.score - a.score);
      const o = options[0];
      return playCard(G, pi, o.i, o.tgt ? o.tgt.uid : null, P.board.length);
    }
    // 3. hero power
    if (canHeroPower(G, pi)) {
      const e = P.heroData.hp.fx.find(picks) || P.heroData.hp.fx[0];
      let t = null;
      if (picks(e)) t = chooseTargetFor(G, pi, e, { spell: true, eff: e });
      const useless = (e.op === 'heal' && (!t || (t.kind === 'hero' ? t.hp >= t.max : t.h >= t.max))) || (picks(e) && !t);
      if (!useless) return heroPower(G, pi, t && t.uid);
    }
    // 4. attacks: trade into taunts or good targets, otherwise face
    for (const u of attackers) {
      const tl = attackTargets(G, u); if (!tl.length) continue;
      const aa = atkOf(G, u);
      const myVal = u.kind === 'hero' ? 99 : unitValue(G, u);
      let best = null, bestScore = -1e9;
      for (const d of tl) {
        if (d.kind === 'hero') { const s = aa * 1.0 + (op.hero.hp < 12 ? 3 : 0); if (s > bestScore) { best = d; bestScore = s; } continue; }
        const kills = !d.divine && (d.h <= aa || (u.kind === 'minion' && u.kw.has('poisonous')));
        const da = atkOf(G, d);
        const dies = u.kind === 'minion' ? (!u.divine && (u.h <= da || d.kw.has('poisonous'))) : false;
        if (u.kind === 'hero' && P.hero.hp - da < 8) continue;
        let s = (kills ? unitValue(G, d) + 2 : -2) - (dies ? myVal : 0) + (d.kw.has('taunt') ? 2 : 0);
        if (u.kind === 'hero') s -= da;
        if (s > bestScore) { best = d; bestScore = s; }
      }
      if (best && (bestScore > 0 || taunts.length || best.kind === 'hero')) return attack(G, u.uid, best.uid);
    }
    return false;
  }
  function botTurn(G, pi) { let n = 0; while (G.phase === 'play' && G.turn === pi && n++ < 60 && botStep(G, pi)); if (G.phase === 'play' && G.turn === pi) endTurn(G); }

  // ---------- decks ----------
  function randomDeck(G_or_seed, cls, rngFn) {
    const r = rngFn || Math.random;
    const pool = DB.collectible.filter(c => c.c === cls || c.c === 'neutral');
    const curve = [[0, 1, 4], [2, 2, 6], [3, 3, 6], [4, 4, 5], [5, 5, 4], [6, 6, 2], [7, 10, 3]];
    const deck = [];
    const counts = {};
    const add = c => { const lim = c.r === 3 ? 1 : 2; if ((counts[c.id] || 0) >= lim) return false; counts[c.id] = (counts[c.id] || 0) + 1; deck.push(c.id); return true; };
    for (const [lo, hi, n] of curve) {
      const cls_ = pool.filter(c => c.m >= lo && c.m <= hi && c.c === cls);
      const neu = pool.filter(c => c.m >= lo && c.m <= hi && c.c === 'neutral');
      let tries = 0;
      while (deck.filter(id => { const m = DB.byId[id].m; return m >= lo && m <= hi; }).length < n && tries++ < 200) {
        const src = (r() < 0.65 && cls_.length) ? cls_ : (neu.length ? neu : cls_);
        const c = src[Math.floor(r() * src.length)];
        if (!c) break;
        if (c.t === 's' && deck.filter(id => DB.byId[id].t === 's').length >= 9) continue;
        if (c.t === 'w' && deck.filter(id => DB.byId[id].t === 'w').length >= 3) continue;
        const copies = r() < 0.55 && c.r < 3 ? 2 : 1;
        for (let k = 0; k < copies; k++) add(c);
      }
    }
    while (deck.length < 30) { const c = pool[Math.floor(r() * pool.length)]; add(c); }
    return deck.slice(0, 30);
  }
  function validateDeck(ids, cls) {
    const errs = [];
    if (ids.length !== 30) errs.push(`A deck needs exactly 30 cards (this one has ${ids.length}).`);
    const counts = {};
    ids.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
    for (const [id, n] of Object.entries(counts)) {
      const c = DB.byId[id]; if (!c) { errs.push('Unknown card.'); continue; }
      if (c.c !== 'neutral' && c.c !== cls) errs.push(`${c.n} belongs to another class.`);
      if (n > (c.r === 3 ? 1 : 2)) errs.push(`Too many copies of ${c.n}.`);
    }
    return errs;
  }

  const API = { setData, newGame, mulligan, botMulligan, playCard, canPlay, heroPower, canHeroPower, attack, canAttack, attackTargets,
    endTurn, botStep, botTurn, validTargets, needsTarget, chosenEffect, targetTg, costOf, atkOf, spellDamage, findUnit, chooseDiscover,
    randomDeck, validateDeck, chooseDredge, picks, card: id => DB.byId[id], db: () => DB, KWS, MAX_BOARD, MAX_HAND };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.LLE = API;
})(typeof window !== 'undefined' ? window : globalThis);
