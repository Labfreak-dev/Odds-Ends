/* Labfreak Legends UI: menus, collection and deck builder, battle board, animations, sound. */
(function () {
  'use strict';
  const D = window.LL_DATA, E = window.LLE;
  E.setData(D);
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const CLS = ['tamer', 'gambler', 'healer', 'collector', 'scientist', 'champion'];
  const CLSN = { tamer: 'Tamer', gambler: 'Gambler', healer: 'Healer', collector: 'Collector', scientist: 'Scientist', champion: 'Champion', neutral: 'Neutral' };
  const CLSG = { tamer: 'Glimmerdeep', gambler: "Dead Man's Pull", healer: 'Thankless', collector: 'Odds & Ends', scientist: 'Labfreak Series 1 & 2', champion: 'Ironhold Idle' };
  // card sets, Hearthstone-style: the Core Set plus expansions, each with its own keyword and pack
  const SETS = D.sets || [{ id: 'core', n: 'Core Set' }];
  const SETN = Object.fromEntries(SETS.map(x => [x.id, x.n]));
  const setOf = c => c.s || 'core';
  const SET_ICON = {
    ih: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 4 5v6c0 5 3.4 9.3 8 11 4.6-1.7 8-6 8-11V5z" fill="#2a2f3a" stroke="#ffd35c" stroke-width="2"/><path d="M8 8h8M12 8v9M9 17h6" stroke="#ffd35c" stroke-width="2" stroke-linecap="round" fill="none"/></svg>',
    dc: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#0d3550" stroke="#7fd8ff" stroke-width="2"/><path d="M12 4v11a4 4 0 0 1-8 0M12 4a2 2 0 1 1 0 .01M15 12l-3 3" stroke="#7fd8ff" stroke-width="2" stroke-linecap="round" fill="none"/></svg>',
  };
  const CCOL = c => (D.heroes[c] ? D.heroes[c].col : [190, 180, 160]).join(',');
  const RN = ['Common', 'Rare', 'Epic', 'Legendary'];
  // plain-English glossary: [word on the card, what it means, board icon]
  const GLOSS = [
    ['Guard', 'Enemies must attack this minion before they can hit anything else.', 'kw:taunt'],
    ['Haste', 'Can attack the same turn you play it.', 'kw:charge'],
    ['Quick', 'Can attack enemy minions (but not the hero) the turn you play it.', 'kw:rush'],
    ['Shield', 'Blocks the first hit completely, then the shield breaks.', 'kw:divine'],
    ['Double Strike', 'Can attack twice each turn.', 'kw:windfury'],
    ['Hidden', "Enemies can't attack or target it until it attacks.", 'kw:stealth'],
    ['Deadly', 'Destroys any minion it damages, no matter its Health.', 'kw:poisonous'],
    ['Lifesteal', 'Damage it deals also heals your hero by the same amount.', 'kw:lifesteal'],
    ['Comes Back', 'The first time it dies, it returns with 1 Health.', 'kw:reborn'],
    ['When played:', 'Happens once, right when you play the card from your hand.'],
    ['When it dies:', 'Happens when this minion dies.'],
    ['If you played another card first this turn:', "A bonus that only happens if this isn't the first card you played this turn."],
    ['Start of your turn:', 'Happens at the start of each of your turns while this minion is on the board.'],
    ['End of your turn:', 'Happens at the end of each of your turns while this minion is on the board.'],
    ['When it attacks:', 'Happens every time this minion attacks.'],
    ['When it takes damage:', 'Happens every time this minion is hurt and survives the hit.'],
    ['After you cast a spell:', 'Happens every time you cast a spell while this minion is on the board.'],
    ['When anything is healed:', 'Happens every time any character on either side is healed.'],
    ['When an enemy minion dies:', 'Happens every time one of your opponent\'s minions dies.'],
    ['When you summon a minion:', 'Happens every time another minion joins your side.'],
    ['Frenzy:', 'Happens once, the first time this minion takes damage and survives. (Siege of Ironhold)'],
    ['Dredge', 'Look at the bottom 3 cards of your deck and put one of them on top, so you draw it next. (The Deep Catch)'],
    ['Your hero gets +', 'Your hero can attack this turn, or hits harder if it already holds a weapon. The bonus ends when your turn does.'],
    ['Trap:', "A hidden spell. It sits face-down by your hero and goes off by itself during your opponent's turn."],
    ['Freeze', "A Frozen character can't attack during its next turn."],
    ['Remove all abilities', 'Wipes every ability and bonus from a minion. Damage it already took stays.'],
    ['Pick 1 of 3', 'You see three random cards and keep the one you choose.'],
    ['Armor', 'Extra protection for your hero. Damage hits Armor before Health.'],
    ['Spin!', 'The reels from Dead Man\'s Pull. One of the three results happens at random.'],
    ['less Mana', 'Strong cards that borrow Mana from your next turn.'],
    ['spells deal +', 'While this minion is alive, your damage spells deal extra damage.'],
    ['Freezes anything it damages', 'Anything it hits, or anything that hits it, gets Frozen.'],
    ["Can't attack", 'This minion only defends.'],
    ['Attacks a random enemy', 'Whatever you aim it at, it picks a random enemy it is allowed to hit instead.'],
    ["Spells can't target it", "Spells and Hero Powers can't choose it."],
    ['+2 Attack while hurt', 'Gets +2 Attack while it is missing Health.'],
    ['ALL', 'Hits every one of them, not just one.'],
  ];
  function explain(c) {
    const tx = c.tx || '', out = [];
    GLOSS.forEach(([k, v]) => { if (tx.includes(k) && !(k === 'Shield' && !/\bShield\b/.test(tx)) && !(k === 'Freeze' && tx.includes('Freezes anything'))) out.push([k.replace(/:$/, ''), v]); });
    if (c.evo) out.unshift(['Evolves from ' + c.evo.from, `Costs 2 less while ${c.evo.from} is on your board. Playing it turns ${c.evo.from} into this card.`]);
    if (c.t === 'w') out.push(['Weapon', 'Lets your hero attack. Attack is the yellow number; the grey number is how many attacks it lasts.']);
    return out;
  }
  const BOLD = ['When played:', 'When it dies:', 'If you played another card first this turn:', 'Start of your turn:', 'End of your turn:', 'When it attacks:',
    'When it takes damage:', 'Frenzy:', 'Dredge', 'After you cast a spell:', 'When anything is healed:', 'When an enemy minion dies:', 'When you summon a minion:', 'Trap:', 'Spin!',
    'Double Strike', 'Comes Back', 'Guard', 'Haste', 'Quick', 'Shield', 'Hidden', 'Deadly', 'Lifesteal', 'Freeze', 'ALL'];
  const KWRE = new RegExp('(^|[^\\w])(' + BOLD.map(w => w.replace(/[.*+?^${}()|[\]\\!]/g, '\\$&')).join('|') + ')(?![\\w])', 'g');

  // ---------------------------------------------------------------- helpers
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  function artCSS(art) {
    if (!art) return '';
    const [s, i] = art;
    return `background-image:url(${D.sheets[s]});background-position:${(i % 8) * 100 / 7}% ${Math.floor(i / 8) * 100 / 7}%;`;
  }
  const fmt = tx => esc(tx).replace(KWRE, '$1<b>$2</b>');
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  };
  function fitCard(card) {
    const box = card.querySelector('.text'), sp = box && box.firstElementChild;
    if (sp && box.clientHeight) {
      let f = parseFloat(sp.dataset.f || 1), n = 0;
      sp.style.fontSize = f + 'em';
      while (sp.offsetHeight > box.clientHeight + 1 && f > 0.42 && n++ < 14) { f -= 0.05; sp.style.fontSize = f.toFixed(2) + 'em'; }
    }
    const nm = card.querySelector('.name');
    if (nm && nm.clientWidth) { let f = 1, n = 0; nm.style.letterSpacing = ''; while (nm.scrollWidth > nm.clientWidth + 1 && n++ < 10) { f -= 0.06; nm.style.fontSize = (parseFloat(getComputedStyle(nm).fontSize) * 0.94) + 'px'; } }
  }
  const fitQ = new Set(); let fitRaf = 0;
  function fitAll(root) { (root || document).querySelectorAll('.card').forEach(c => fitQ.add(c)); if (!fitRaf) fitRaf = requestAnimationFrame(() => { fitRaf = 0; fitQ.forEach(c => { if (c.isConnected) fitCard(c); }); fitQ.clear(); }); }
  new MutationObserver(ms => { for (const m of ms) m.addedNodes.forEach(n => { if (n.nodeType === 1) { if (n.classList.contains('card')) fitQ.add(n); n.querySelectorAll && n.querySelectorAll('.card').forEach(c => fitQ.add(c)); } }); if (fitQ.size) fitAll(document.createElement('div')); })
    .observe(document.body, { childList: true, subtree: true });
  window.LLUI = { fitAll, fitCard, cardHTML: (c, o) => cardHTML(c, o) };
  const spr = (art, k) => `<i class="spr ${k || 'w'}" style="${artCSS(art)}"></i>`;
  function cardHTML(c, o) {
    o = o || {};
    const cls = c.c || 'neutral';
    const cost = o.cost != null ? o.cost : c.m;
    const tribe = c.tr ? esc(c.tr) : (c.t === 's' ? 'Spell' : c.t === 'w' ? 'Weapon' : '');
    const nameSize = c.n.length > 20 ? 'font-size:.84em' : c.n.length > 15 ? 'font-size:.96em' : '';
    const L = (c.tx || '').length;
    const tf = L <= 45 ? 1 : L <= 75 ? .92 : L <= 105 ? .82 : L <= 135 ? .74 : .68;
    return `<div class="card t-${c.t} r${c.r} ${o.cls || ''}${o.locked ? ' locked' : ''}" style="--cc:${CCOL(cls)};${o.cw ? '--cw:' + o.cw + ';' : ''}${o.style || ''}" ${o.attrs || ''} data-cid="${c.id}">
      <div class="art">${spr(c.art)}</div>
      <div class="cost${cost < c.m ? ' cheap' : ''}">${cost}</div>
      <div class="name" style="${nameSize}">${esc(c.n)}</div>
      <div class="gem r${c.r}"></div>
      ${c.evo ? `<div class="evo">Evolves from ${esc(c.evo.from)}</div>` : ''}
      <div class="text"><span data-f="${tf}" style="font-size:${tf}em">${fmt(c.tx || '')}</span></div>
      ${c.t !== 's' ? `<div class="atk">${c.a}</div><div class="hp">${c.h}</div>` : ''}
      <div class="tribe">${tribe}</div>${c.s && SET_ICON[c.s] ? `<div class="setb" title="${esc(SETN[c.s] || '')}">${SET_ICON[c.s]}</div>` : ''}
      ${o.copies ? `<div class="copies">×${o.copies}</div>` : ''}${o.owned != null ? `<div class="owned${o.owned ? '' : ' none'}">${o.owned ? 'Owned ×' + o.owned : 'Not owned'}</div>` : ''}
    </div>`;
  }

  // ---------------------------------------------------------------- sound
  const SND = {};
  let soundOn = store.get('ll_sound', false), music = null;
  function sfx(name, vol) {
    if (!soundOn) return;
    try { const a = SND[name] ? SND[name].cloneNode() : new Audio(`sfx/${name}.mp3`); SND[name] = SND[name] || a; a.volume = vol || 0.5; a.play().catch(() => { }); } catch (e) { }
  }
  function playMusic(name) {
    if (music && music.dataset.n === name) { if (soundOn) music.play().catch(() => { }); return; }
    if (music) { music.pause(); music = null; }
    if (!soundOn) return;
    try { music = new Audio(`sfx/${name}.mp3`); music.dataset.n = name; music.loop = true; music.volume = 0.28; music.play().catch(() => { }); } catch (e) { }
  }
  function setSound(on) {
    soundOn = on; store.set('ll_sound', on);
    $('#b-sound').textContent = 'Sound: ' + (on ? 'on' : 'off');
    if (!on && music) music.pause(); else playMusic(current === 'battle' ? 'fight' : 'title');
  }

  // ---------------------------------------------------------------- navigation
  let current = 'menu';
  function show(id) {
    $$('.screen').forEach(s => { s.hidden = s.id !== id; });
    current = id;
    if (id === 'menu') { renderMenu(); playMusic('title'); }
    if (id === 'collection') renderCollection();
    if (id === 'play') renderPlay();
    if (id === 'rules') renderRules();
    if (id === 'shop') renderShop();
    if (id === 'campaign') renderCampaign();
    goldChips();
  }
  $$('[data-back]').forEach(b => b.addEventListener('click', () => { sfx('click', .4); show('menu'); }));
  $('#b-play').onclick = () => { sfx('click', .4); show('play'); };
  $('#b-coll').onclick = () => { sfx('click', .4); show('collection'); };
  $('#b-rules').onclick = () => { sfx('click', .4); show('rules'); };
  $('#b-shop').onclick = () => { sfx('click', .4); show('shop'); };
  $('#b-sound').onclick = () => setSound(!soundOn);

  // ---------------------------------------------------------------- decks
  function seeded(s) { return () => { let t = (s += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  // Starter lists were picked by simulation: candidates tested against random decks from every class, then refined so each
  // starter is close to even against the other four (bot vs bot, both seats).
  const STARTER_LISTS = {"tamer":["gd_mepa1","gd_mepa1","gd_emfl1","gds_mystic0","gds_mystic0","gd_emsp1","gd_shdm1","gd_shdm1","oe_northern-cardinal","oe_northern-cardinal","oe_ladybug","gd_voyk2","gd_voyk2","oe_great-blue-heron","oe_great-blue-heron","oe_blue-crab","gd_gaff2","gd_pyrp2","gd_meot2","gd_buzz2","dcm_dolphin5","dcm_dolphin5","gd_mytd3","gd_frow3","gd_gasw3","gd_gasw3","oe_dragon","oe_platypus","oe_platypus","ihm_frost_matriarch"],"gambler":["dmpr_61","dmpr_61","oe_atlantic-salmon","dmpw_13","oe_american-crow","oe_american-crow","dmpr_54","dmp_brute_base","oe_carpenter-ant","oe_carpenter-ant","dmpg_68","oe_great-white-shark","oe_great-white-shark","dmpe_brainjar","oe_great-blue-heron","oe_great-blue-heron","dmpg_74","dmp_duelist_crimson","dmpg_54","dmpg_54","dmp_gambler_goldengrin","dmpw_24","dmpw_24","oe_neptune-s-trident","oe_barracuda","dmp_ranger_spectral","dmp_hexpriest_voidcardinal","dmp_brute_siege","oe_hydra","dmpb_labmut"],"healer":["ths_m_barrier","ths_m_barrier","ths_eyebrows","ths_eyebrows","ths_stew","ths_a_volley","ths_a_volley","ths_cushion","ths_cushion","dcf_little_sunfish","oe_prairie-dog","ihc_cleric","ihc_cleric","th_wren","th_wren","dcf_smallmouth_bass","dcf_smallmouth_bass","oe_grevy-s-zebra","oe_grevy-s-zebra","th_ult_tank_nap_c","th_ult_tank_nap_c","th_ivy_c","th_ivy_c","th_ult_mage_swarm_b","th_robot_c","oe_african-elephant","oe_orb-weaver-spider","oe_orb-weaver-spider","th_ansel_c","ihm_mark_twins"],"collector":["oe_diamond","oe_garter-snake","oe_whirlpool-galaxy","oe_orion-nebula","oe_orion-nebula","oe_oil-tanker","oe_oil-tanker","oe_nile-crocodile","oe_nile-crocodile","oe_aldebaran","oe_american-beaver","oe_coyote","oe_eurasian-hoopoe","oe_cottonmouth","oe_cottonmouth","oe_blimp","oe_blimp","oe_grandfather-clock","oe_grandfather-clock","oe_rocket","oe_rocket","oe_red-panda","oe_red-panda","oe_orb-weaver-spider","ihm_mark_dead","ihm_mark_dead","oe_tourmaline","oe_grizzly-bear","oe_moose","ihc_goldragon"],"scientist":["scs_12","scs_12","oe_black-capped-chickadee","oe_black-capped-chickadee","s2_39","oe_american-bison","oe_the-old-lighthouse","oe_the-old-lighthouse","s2_139","s2_91","s2_91","oe_reindeer","s1_110","s1_110","s2_155","oe_common-loon","s1_7","s2_44","s2_132","s2_93","s2_45","s1_24","s1_24","s2_169","s2_169","s2_188","s2_188","oe_dragon","oe_dragon","mv_labfreak"],"champion":["ihc_squire","ihc_squire","ihl_stitched","oe_sandhill-crane","oe_sandhill-crane","ihl_vexil","ihl_vexil","ihg_goblin","ihl_kael","ihl_maldrek","ihl_ash","ihl_ash","oe_giant-isopod","oe_mermaid-s-comb","oe_mermaid-s-comb","ihm_mark_famine","oe_orca","oe_orca","oe_horned-lizard","oe_emperor-penguin","ihc_necro","ihc_necro","oe_sunken-wreck","dcf_bull_shark","dcf_bull_shark","ihk_lk_set_saint","dcf_mako_shark","ihw_glass_fang","ihm_mark_twins","mv_188"]};
  const STARTERS = CLS.map(c => ({ id: 'starter_' + c, name: `${CLSN[c]} Starter`, cls: c, cards: STARTER_LISTS[c].filter(id => E.card(id)), starter: true }));
  let decks = store.get('ll_decks', []);
  // ---- collection ownership and gold
  const CAP = c => (c.r === 3 ? 1 : 2);
  let owned = store.get('ll_owned', null);
  if (!owned) { owned = {}; STARTERS.forEach(d => d.cards.forEach(id => { owned[id] = Math.min(CAP(E.card(id)), (owned[id] || 0) + 1); })); store.set('ll_owned', owned); }
  // every player owns the cards in every starter deck (also covers saves made before the starters were rebalanced)
  STARTERS.forEach(d => { const n = {}; d.cards.forEach(id => { n[id] = (n[id] || 0) + 1; }); Object.entries(n).forEach(([id, k]) => { if ((owned[id] || 0) < k) owned[id] = k; }); });
  store.set('ll_owned', owned);
  let gold = store.get('ll_gold', 300);
  const saveOwned = () => { store.set('ll_owned', owned); store.set('ll_gold', gold); };
  const ownedTotal = () => Object.values(owned).reduce((a, b) => a + b, 0);
  function goldChips() { $$('.goldchip').forEach(g => { g.textContent = gold.toLocaleString() + ' gold'; }); }
  const REFUND = [5, 20, 100, 400];
  const ODDS_STD = [72, 21, 5.5, 1.5], ODDS_MV = [40, 36, 17, 7];
  const PACKS = [
    { id: 'ih', name: 'Siege of Ironhold Pack', price: 100, odds: ODDS_STD, cover: 'ihn_ashking', col: '225,95,70', set: 'ih', blurb: "New expansion. Ironhold Idle's nemeses, monsters, companions and gear, the Champion's class cards, and the Frenzy keyword.", f: c => c.s === 'ih' },
    { id: 'dc', name: 'Deep Catch Pack', price: 100, odds: ODDS_STD, cover: 'dcl_drownedking', col: '40,150,220', set: 'dc', blurb: 'New expansion. A hundred fish, sea creatures, sunken treasure, tackle and the six Legend fish, with the Dredge keyword.', f: c => c.s === 'dc' },
    { id: 'glim', name: 'Glimmerdeep Pack', price: 100, odds: ODDS_STD, cover: 'gd_emdr4', col: '90,200,255', blurb: 'Tamer creatures from every biome, all their evolutions, and the 24 bosses.', f: c => c.g === 'Glimmerdeep' },
    { id: 'dmp', name: "Dead Man's Pull Pack", price: 100, odds: ODDS_STD, cover: 'dmpb_death3', col: '150,200,90', blurb: 'Gambler heroes and skins, dungeon enemies, Death, weapons, relics and Traps.', f: c => c.g === "Dead Man's Pull" },
    { id: 'th', name: 'Thankless Pack', price: 100, odds: ODDS_STD, cover: 'th_kingc', col: '240,190,90', blurb: 'The whole ungrateful party, the King, the Brood, and healing spells.', f: c => c.g === 'Thankless' },
    { id: 'oe', name: 'Odds & Ends Pack', price: 100, odds: ODDS_STD, cover: null, col: '60,210,190', blurb: 'Animals, machines, sea life, myths, cosmos and fortune cards.', f: c => c.g === 'Odds & Ends' },
    { id: 'lab', name: 'Labfreak Lab Pack', price: 100, odds: ODDS_STD, cover: 's2_200', col: '255,110,225', blurb: 'Scientist creatures from Labfreak Series 1 and 2, plus lab spells.', f: c => /^Labfreak( Series [12])?$/.test(c.g) },
    { id: 'mv', name: 'Multiverse Pack', price: 250, odds: ODDS_MV, cover: 'mv_labfreak', col: '255,215,90', blurb: 'Any card from any game, with much better odds of Epics and Legendaries.', f: c => true },
  ];
  PACKS.forEach(p => {
    p.pool = [[], [], [], []];
    D.cards.forEach(c => { if (!c.token && p.f(c)) p.pool[c.r].push(c.id); });
    p.size = p.pool.reduce((a, l) => a + l.length, 0);
    if (!p.cover) p.cover = p.pool[3][0] || p.pool[2][0];
  });
  function rollRarity(odds) { let r = Math.random() * 100; for (let i = 3; i >= 1; i--) { const t = odds[i]; if (r < t) return i; r -= t; } return 0; }
  function openPack(p) {
    const got = [];
    for (let k = 0; k < 5; k++) {
      let r = rollRarity(p.odds);
      if (k === 4 && got.every(g => g.r === 0) && r === 0) r = 1; // every pack has at least one Rare
      while (r > 0 && !p.pool[r].length) r--;
      const id = p.pool[r][Math.floor(Math.random() * p.pool[r].length)];
      const c = E.card(id);
      const had = owned[id] || 0;
      let extra = 0;
      if (had >= CAP(c)) { extra = REFUND[c.r]; gold += extra; } else owned[id] = had + 1;
      got.push({ id, r: c.r, isNew: had === 0, extra });
    }
    saveOwned();
    return got;
  }
  const saveDecks = () => store.set('ll_decks', decks);
  let chosenDeck = store.get('ll_chosen', 'starter_tamer');
  let chosenOpp = 'random';

  // ---------------------------------------------------------------- menu
  function renderMenu() {
    $('#menubg').style.backgroundImage = `url(${D.boards.bg_core})`;
    const ids = ['dmpb_death1', 'gdb_wyrm', 'mv_labfreak', 'th_kingc', 's2_200'];
    const fan = ids.map(id => E.card(id)).filter(Boolean);
    $('#menufan').innerHTML = fan.map((c, i) => cardHTML(c, { style: `transform:translateX(-50%) rotate(${(i - 2) * 11}deg) translateY(${Math.abs(i - 2) * 8}px);z-index:${10 - Math.abs(i - 2)}` })).join('');
    $('#menutag').textContent = `${D.cards.length.toLocaleString()} cards from Glimmerdeep, Dead Man's Pull, Thankless, Odds & Ends, Ironhold Idle and Labfreak Series 1\u20133, in ${SETS.length} sets. You own ${ownedTotal().toLocaleString()}.`;
  }

  // ---------------------------------------------------------------- play screen
  function deckBox(d, on, attrs) {
    const h = D.heroes[d.cls] || D.heroes.tamer;
    const sub = d.sub || `${CLSN[d.cls]} · ${CLSG[d.cls]}${d.cards && d.cards.length !== 30 ? ' · ' + d.cards.length + '/30' : ''}`;
    return `<button class="deckbox${on ? ' on' : ''}" style="--cc:${CCOL(d.cls)}" ${attrs}>
      <div class="dp">${d.mystery ? '<span class="mystery">?</span>' : spr(h.art)}</div>
      <div class="dt"><b>${esc(d.name)}</b><span>${esc(sub)}</span></div>${on ? '<span class="tick" aria-hidden="true">✓</span>' : ''}</button>`;
  }
  function renderPlay() {
    const valid = decks.filter(d => E.validateDeck(d.cards, d.cls).length === 0);
    $('#mydecks').innerHTML = valid.length ? valid.map(d => deckBox(d, d.id === chosenDeck, `data-deck="${d.id}"`)).join('') :
      `<p class="empty" style="grid-column:1/-1">No decks of your own yet. Build one in Collection &amp; Decks, or play a starter below.</p>`;
    $('#starters').innerHTML = STARTERS.map(d => deckBox(d, d.id === chosenDeck, `data-deck="${d.id}"`)).join('');
    const opps = [{ id: 'random', name: 'Random Bot', cls: 'neutral', mystery: true, sub: 'Any class' }].concat(CLS.map(c => ({ id: c, name: `${CLSN[c]} Bot`, cls: c, sub: CLSG[c] })));
    $('#opps').innerHTML = opps.map(o => deckBox(o, o.id === chosenOpp, `data-opp="${o.id}"`)).join('');
    const d = decks.concat(STARTERS).find(x => x.id === chosenDeck) || STARTERS[0];
    const o = opps.find(x => x.id === chosenOpp) || opps[0];
    const av = x => x.mystery ? '<span class="mystery">?</span>' : spr(D.heroes[x.cls].art);
    $('#matchbar').innerHTML = `<div class="side"><span class="av">${av(d)}</span><span class="nm"><small>You</small><b>${esc(d.name)}</b></span></div>
      <span class="vs">VS</span><div class="side"><span class="av">${av(o)}</span><span class="nm"><small>Opponent</small><b>${esc(o.name)}</b></span></div>
      <button class="big" id="b-start">Battle</button>`;
  }
  $('#play').addEventListener('click', e => {
    const b = e.target.closest('[data-deck]'); if (b) { chosenDeck = b.dataset.deck; store.set('ll_chosen', chosenDeck); sfx('click', .4); renderPlay(); }
    const o = e.target.closest('[data-opp]'); if (o) { chosenOpp = o.dataset.opp; sfx('click', .4); renderPlay(); }
  });
  $('#matchbar').addEventListener('click', e => { if (e.target.closest('#b-start')) startChosen(); });
  const startChosen = () => {
    const d = decks.concat(STARTERS).find(x => x.id === chosenDeck) || STARTERS[0];
    const oc = chosenOpp === 'random' ? CLS[Math.floor(Math.random() * CLS.length)] : chosenOpp;
    startBattle(d, oc);
  };

  // ---------------------------------------------------------------- collection & deck builder
  const F = { cls: 'all', mana: null, type: 'all', rar: 'all', game: 'all', set: 'all', q: '', page: 0, own: 'all' };
  let editing = null; // deck being edited
  const GAMES = ['Glimmerdeep', "Dead Man's Pull", 'Thankless', 'Odds & Ends', 'Labfreak Series 1', 'Labfreak Series 2', 'Labfreak Multiverse', 'Labfreak', 'Ironhold Idle', 'Odds & Ends Fishing'];
  function filtered() {
    const q = F.q.trim().toLowerCase();
    return D.cards.filter(c => {
      if (editing && c.c !== editing.cls && c.c !== 'neutral') return false;
      if (F.cls !== 'all' && c.c !== F.cls) return false;
      if (F.mana != null && (F.mana === 7 ? c.m < 7 : c.m !== F.mana)) return false;
      if (F.type !== 'all' && c.t !== F.type) return false;
      if (F.rar !== 'all' && c.r !== +F.rar) return false;
      if (F.game !== 'all' && c.g !== F.game) return false;
      if (F.set !== 'all' && setOf(c) !== F.set) return false;
      if (F.own === 'owned' && !owned[c.id]) return false;
      if (F.own === 'missing' && owned[c.id]) return false;
      if (q && !(c.n.toLowerCase().includes(q) || (c.tx || '').toLowerCase().includes(q) || (c.tr || '').toLowerCase().includes(q))) return false;
      return true;
    }).sort((a, b) => a.m - b.m || a.n.localeCompare(b.n));
  }
  function renderFilters() {
    const clsList = editing ? [editing.cls, 'neutral'] : ['all', ...CLS, 'neutral'];
    if (editing && F.cls !== 'all' && !clsList.includes(F.cls)) F.cls = 'all';
    $('#filters').innerHTML =
      `<input id="search" placeholder="Search name, text or tribe" value="${esc(F.q)}" aria-label="Search cards">` +
      (editing ? `<button class="chip${F.cls === 'all' ? ' on' : ''}" data-f="cls" data-v="all">All</button>` : '') +
      clsList.map(c => `<button class="chip${F.cls === c ? ' on' : ''}" data-f="cls" data-v="${c}">${c === 'all' ? 'All classes' : CLSN[c]}</button>`).join('') +
      [0, 1, 2, 3, 4, 5, 6, 7].map(m => `<button class="chip mana${F.mana === m ? ' on' : ''}" data-f="mana" data-v="${m}">${m === 7 ? '7+' : m}</button>`).join('') +
      `<select class="sel" data-f="type" aria-label="Card type"><option value="all">All types</option><option value="m">Minions</option><option value="s">Spells</option><option value="w">Weapons</option></select>` +
      `<select class="sel" data-f="rar" aria-label="Rarity"><option value="all">All rarities</option>${RN.map((r, i) => `<option value="${i}">${r}</option>`).join('')}</select>` +
      `<select class="sel" data-f="set" aria-label="Card set"><option value="all">All sets</option>${SETS.map(x => `<option value="${x.id}">${esc(x.n)}</option>`).join('')}</select>` +
      `<select class="sel" data-f="game" aria-label="Game"><option value="all">All games</option>${GAMES.map(g => `<option>${esc(g)}</option>`).join('')}</select>` +
      `<select class="sel" data-f="own" aria-label="Owned"><option value="all">Owned and not owned</option><option value="owned">Only cards I own</option><option value="missing">Only cards I'm missing</option></select>`;
    $$('#filters select').forEach(s => { s.value = F[s.dataset.f]; });
  }
  const PER = 40;
  function renderGrid() {
    const list = filtered();
    const pages = Math.max(1, Math.ceil(list.length / PER));
    F.page = Math.min(F.page, pages - 1);
    const counts = {};
    if (editing) editing.cards.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
    $('#grid').innerHTML = list.slice(F.page * PER, F.page * PER + PER).map(c => cardHTML(c, { copies: counts[c.id], owned: owned[c.id] || 0, locked: !owned[c.id], attrs: 'tabindex="0" role="button"' })).join('') ||
      `<p style="grid-column:1/-1;color:var(--muted);font-weight:800">No cards match these filters.</p>`;
    $('#pager').innerHTML = `<button class="small" data-pg="-1" ${F.page ? '' : 'disabled'}>Previous</button><span>${list.length.toLocaleString()} cards · page ${F.page + 1} of ${pages}</span><button class="small" data-pg="1" ${F.page < pages - 1 ? '' : 'disabled'}>Next</button>`;
  }
  function renderDeckPanel() {
    $('#collbody').classList.toggle('nodeck', !editing);
    $('#deckpanel').hidden = !editing;
    $('#deckpick').innerHTML = `<option value="">Edit a deck\u2026</option>` + decks.map(d => `<option value="${d.id}">${esc(d.name)} (${d.cards.length}/30)</option>`).join('');
    if (!editing) return;
    $('#deckname').value = editing.name;
    $('#deckcls').textContent = `${CLSN[editing.cls]} · ${editing.cards.length}/30 cards · Hero Power: ${D.heroes[editing.cls].hp.n}`;
    const counts = {};
    editing.cards.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
    const ids = Object.keys(counts).sort((a, b) => E.card(a).m - E.card(b).m || E.card(a).n.localeCompare(E.card(b).n));
    const rc = ['#e8e8ef', '#4fa3ff', '#c27bff', '#ff9d2e'];
    $('#decklist').innerHTML = ids.map(id => { const c = E.card(id); return `<div class="drow" data-rm="${id}" style="--rc:${rc[c.r]}" title="Remove one"><span class="m">${c.m}</span><span class="n">${esc(c.n)}</span><span class="x">${counts[id] > 1 ? '×' + counts[id] : ''}</span></div>`; }).join('') ||
      `<p style="color:var(--muted);font-weight:800;padding:8px">Click cards on the left to add them.</p>`;
    const curve = [0, 0, 0, 0, 0, 0, 0, 0];
    editing.cards.forEach(id => { curve[Math.min(7, E.card(id).m)]++; });
    const mx = Math.max(4, ...curve);
    $('#curve').innerHTML = curve.map((n, i) => `<div style="height:${n / mx * 100}%"><span>${i === 7 ? '7+' : i}</span></div>`).join('');
    const errs = E.validateDeck(editing.cards, editing.cls);
    $('#deckerrs').textContent = errs[0] || 'Ready to play.';
    $('#deckerrs').style.color = errs.length ? '#ffb3bb' : 'var(--heal)';
  }
  function renderCollection() { if (editing && F.own === 'all') F.own = 'owned'; renderFilters(); renderGrid(); renderDeckPanel(); $('#collsub').textContent = `You own ${ownedTotal().toLocaleString()} cards`; }
  $('#filters').addEventListener('click', e => {
    const b = e.target.closest('[data-f]'); if (!b || b.tagName === 'SELECT') return;
    const f = b.dataset.f; let v = b.dataset.v;
    if (f === 'mana') v = F.mana === +v ? null : +v;
    F[f] = v; F.page = 0; renderFilters(); renderGrid();
  });
  $('#filters').addEventListener('change', e => { const s = e.target.closest('select'); if (!s) return; F[s.dataset.f] = s.value; F.page = 0; renderGrid(); });
  $('#filters').addEventListener('input', e => { if (e.target.id === 'search') { F.q = e.target.value; F.page = 0; renderGrid(); } });
  $('#pager').addEventListener('click', e => { const b = e.target.closest('[data-pg]'); if (!b) return; F.page += +b.dataset.pg; renderGrid(); $('#gridwrap').scrollTop = 0; });
  function addToDeck(id) {
    const c = E.card(id);
    if (editing.cards.length >= 30) return flashErr('This deck already has 30 cards.');
    const n = editing.cards.filter(x => x === id).length;
    if (!owned[id]) { const pk = PACKS.find(p => p.id !== 'mv' && p.f(c)); return flashErr(`You don't own ${c.n} yet. Find it in the ${pk ? pk.name : 'Multiverse Pack'}.`); }
    if (n >= (c.r === 3 ? 1 : 2)) return flashErr(c.r === 3 ? 'Only one copy of each Legendary.' : 'Only two copies of each card.');
    if (n >= owned[id]) return flashErr(`You only own ${owned[id]} ${c.n}.`);
    editing.cards.push(id); sfx('click', .3); renderGrid(); renderDeckPanel();
  }
  function flashErr(s) { $('#deckerrs').textContent = s; $('#deckerrs').style.color = '#ffb3bb'; }
  $('#grid').addEventListener('click', e => {
    const el = e.target.closest('.card'); if (!el) return;
    if (editing) addToDeck(el.dataset.cid); else zoom(E.card(el.dataset.cid));
  });
  $('#grid').addEventListener('keydown', e => { if (e.key === 'Enter') { const el = e.target.closest('.card'); if (el) el.click(); } });
  $('#grid').addEventListener('contextmenu', e => { const el = e.target.closest('.card'); if (el) { e.preventDefault(); zoom(E.card(el.dataset.cid)); } });
  $('#decklist').addEventListener('click', e => {
    const r = e.target.closest('[data-rm]'); if (!r) return;
    const i = editing.cards.indexOf(r.dataset.rm); if (i >= 0) editing.cards.splice(i, 1);
    renderGrid(); renderDeckPanel();
  });
  $('#deckname').addEventListener('input', e => { if (editing) editing.name = e.target.value || 'Untitled deck'; });
  $('#b-newdeck').onclick = () => {
    const m = $('#zoom');
    m.innerHTML = `<div class="modal" style="position:static;background:none"><div><h3>Pick a class</h3><p>Each class plays the cards of one Labfreak game, plus every Neutral card.</p>
      <div class="deckgrid" style="max-width:720px">${CLS.map(c => deckBox({ name: CLSN[c], cls: c, cards: new Array(30) }, false, `data-newcls="${c}"`)).join('')}</div>
      <p style="margin-top:14px"><button class="small" data-close>Cancel</button></p></div></div>`;
    m.hidden = false;
  };
  $('#deckpick').onchange = e => { const d = decks.find(x => x.id === e.target.value); if (d) { editing = d; F.cls = 'all'; F.page = 0; renderCollection(); } };
  $('#b-save').onclick = () => {
    if (!editing) return;
    if (!decks.includes(editing)) decks.push(editing);
    saveDecks(); renderDeckPanel();
    const errs = E.validateDeck(editing.cards, editing.cls);
    $('#deckerrs').textContent = errs.length ? 'Saved. ' + errs[0] : 'Saved. Ready to play.';
  };
  $('#b-fill').onclick = () => {
    if (!editing) return;
    const fill = E.randomDeck(null, editing.cls, Math.random);
    const mine = D.cards.filter(c => owned[c.id] && (c.c === editing.cls || c.c === 'neutral')).sort(() => Math.random() - .5);
    for (const c of mine) { for (let k = 0; k < owned[c.id]; k++) { if (editing.cards.length >= 30) break; if (editing.cards.filter(x => x === c.id).length < owned[c.id]) editing.cards.push(c.id); } }
    if (editing.cards.length < 30) flashErr(`You only own ${editing.cards.length} cards for this class. Open more packs in the Card Shop.`);
    renderGrid(); renderDeckPanel();
  };
  $('#b-del').onclick = () => {
    if (!editing) return;
    const b = $('#b-del');
    if (b.dataset.confirm !== '1') { b.dataset.confirm = '1'; b.textContent = 'Tap again to delete'; setTimeout(() => { b.dataset.confirm = ''; b.textContent = 'Delete'; }, 2500); return; }
    decks = decks.filter(d => d !== editing); saveDecks(); editing = null; b.dataset.confirm = ''; b.textContent = 'Delete'; renderCollection();
  };
  $('#b-close').onclick = () => { if (editing && !decks.includes(editing) && editing.cards.length) decks.push(editing); saveDecks(); editing = null; renderCollection(); };
  $('#zoom').addEventListener('click', e => {
    const n = e.target.closest('[data-newcls]');
    if (n) { const cls = n.dataset.newcls; editing = { id: 'd' + Date.now(), name: `My ${CLSN[cls]} Deck`, cls, cards: [] }; F.cls = 'all'; F.page = 0; $('#zoom').hidden = true; renderCollection(); return; }
    if (e.target.closest('[data-close]') || e.target === $('#zoom') || !e.target.closest('.wrap,.modal')) $('#zoom').hidden = true;
  });
  function zoom(c) {
    const kws = explain(c);
    $('#zoom').innerHTML = `<div class="wrap">${cardHTML(c)}<div class="info"><h3>${esc(c.n)}</h3>
      <p>${RN[c.r]} ${c.t === 's' ? 'spell' : c.t === 'w' ? 'weapon' : 'minion'} · ${CLSN[c.c]} · ${esc(c.g || '')}${c.tr ? ' · ' + esc(c.tr) : ''}</p>
      ${c.fl ? `<p style="font-style:italic">“${esc(c.fl)}”</p>` : ''}
      <p>${owned[c.id] ? `You own ${owned[c.id]} cop${owned[c.id] > 1 ? 'ies' : 'y'}.` : `Not owned yet. Found in the ${esc((PACKS.find(p => p.id !== 'mv' && p.f(c)) || PACKS[5]).name)} and the Multiverse Pack.`}</p>
      <div class="kwlist">${kws.map(([k, v]) => `<div><b>${esc(k)}</b> ${esc(v)}</div>`).join('')}</div>
      <p><button class="small" data-close>Close</button></p></div></div>`;
    $('#zoom').hidden = false;
  }

  // ---------------------------------------------------------------- rules
  function renderRules() {
    const sample = E.card('dmpe_croupier') || D.cards.find(c => c.t === 'm' && c.fx && c.fx.length);
    const icons = [['🛡', 'Grey armour behind a minion', 'Guard: hit this one first'], ['✦', 'Gold glow around a minion', 'Shield: blocks the next hit'],
      ['2×', 'Double Strike', 'Attacks twice a turn'], ['☠', 'Deadly', 'Kills any minion it hurts'], ['♥', 'Lifesteal', 'Its damage heals you'],
      ['↺', 'Comes Back', 'Returns once with 1 Health'], ['✝', 'When it dies', 'Something happens when it dies'],
      ['ϟ', 'Triggered ability', 'Does something every turn or on an event'], ['+1', 'Spell boost', 'Your spells deal +1 damage'],
      ['❄', 'Freezes', 'Freezes anything it damages'], ['∅', 'Abilities removed', 'This minion lost its abilities'], ['zz', 'Sleeping', "Just played, can't attack yet"]];
    $('#rulesbody').innerHTML = `
      <p class="lead">Two heroes, 30 Health each. Play minions and spells from your hand, attack, and bring the enemy hero to 0 Health to win.</p>
      <h3>Reading a card</h3>
      <div class="anatomy">${cardHTML(sample, { cw: '210px' })}
        <dl>
          <div><dt><span class="dot mana"></span>Mana cost</dt><dd>Top left. What it costs to play.</dd></div>
          <div><dt><span class="dot atk"></span>Attack</dt><dd>Bottom left. The damage it deals when it fights.</dd></div>
          <div><dt><span class="dot hp"></span>Health</dt><dd>Bottom right. When it reaches 0, the minion dies.</dd></div>
          <div><dt>Ability</dt><dd>The text box. Bold words are explained if you press and hold (or hover) the card.</dd></div>
          <div><dt>Rarity</dt><dd>The gem under the name: white Common, blue Rare, purple Epic, orange Legendary (with a crown).</dd></div>
        </dl></div>
      <h3>Your turn, step by step</h3>
      <ol class="steps">
        <li><b>You get Mana.</b> Each turn your max Mana goes up by 1 (to a limit of 10), and it refills. Turn 1 you have 1, turn 5 you have 5.</li>
        <li><b>You draw a card.</b></li>
        <li><b>Play cards.</b> Tap a card that glows green. Its cost comes out of your Mana. Minions go on your side of the board (7 at most). Spells happen right away.</li>
        <li><b>Attack.</b> Tap one of your minions that glows green, then tap an enemy. Minions can't attack on the turn you play them (they're sleeping, <b>zz</b>) unless they have <b>Haste</b> or <b>Quick</b>.</li>
        <li><b>Use your Hero Power</b> if you have 2 Mana left. It's the round button next to your hero, once per turn.</li>
        <li><b>Press End Turn.</b> When the button turns gold, you have nothing left to do.</li>
      </ol>
      <h3>How fighting works</h3>
      <p>When a minion attacks, both sides hit each other at the same time: each one takes damage equal to the other's Attack. Damage stays until it's healed.</p>
      <div class="example"><b>Example:</b> your 3/2 (3 Attack, 2 Health) attacks an enemy 2/4. The enemy takes 3 and is left with 1 Health. Yours takes 2 and dies.</div>
      <p>You can attack the enemy hero directly, unless they have a minion with <b>Guard</b>; then you must deal with that first. Heroes don't hit back unless they hold a weapon.</p>
      <h3>Ability words</h3>
      <div class="gloss">${GLOSS.map(([k, v]) => `<div><b>${esc(k.replace(/:$/, ''))}</b><span>${esc(v)}</span></div>`).join('')}
        <div><b>Evolves from</b><span>Glimmerdeep creatures cost 2 less while their earlier form is on your board, and playing them replaces it.</span></div></div>
      <h3>Icons on the board</h3>
      <div class="legend">${icons.map(([i, a, b]) => `<div><i>${i}</i><b>${esc(a)}</b><span>${esc(b)}</span></div>`).join('')}</div>
      <h3>Starting a game</h3>
      <p>A coin flip decides who goes first. The first player starts with 3 cards; the second starts with 5 plus <b>The Coin</b>, a free card that gives 1 extra Mana for one turn. Before the game starts you can swap any starting cards you don't want.</p>
      <h3>Running out</h3>
      <p>Your hand holds 10 cards; a card drawn past that is destroyed. If your deck runs out, every draw hurts your hero instead, 1 damage, then 2, then 3, and so on.</p>
      <h3>Classes</h3><div class="classes">${CLS.map(c => { const h = D.heroes[c]; return `<div class="cls" style="--cc:${CCOL(c)}"><div class="p" style="${artCSS(h.art)}"></div><div><b>${CLSN[c]}</b><span>${esc(CLSG[c])} cards<br>Hero Power, ${esc(h.hp.n)}: ${esc(h.hp.tx)}</span></div></div>`; }).join('')}</div>
      <h3>Card sets</h3>
      <p>Like Hearthstone, cards come in sets. Every set has its own pack in the Card Shop, and every expansion brings a new keyword. Expansion cards carry the set's symbol under the art, and the collection can be filtered by set.</p>
      <div class="gloss">${SETS.map(x => `<div><b>${x.id !== 'core' && SET_ICON[x.id] ? `<i class="seti">${SET_ICON[x.id]}</i>` : ''}${esc(x.n)}</b><span>${{ core: 'The original 2,318 cards from Glimmerdeep, Dead Man\'s Pull, Thankless, Odds & Ends and the Labfreak series.', ih: 'Ironhold Idle\'s monsters, nemeses, companions and gear. Brings the Champion class and the Frenzy keyword.', dc: 'The Odds & Ends fishing game: a hundred species, sea creatures, sunken treasure, tackle and the six Legend fish. Brings the Dredge keyword.' }[x.id] || ''}</span></div>`).join('')}</div>
      <h3>Decks, packs and gold</h3>
      <p>A deck is exactly 30 cards: cards of its class plus Neutral cards, up to 2 copies of a card and 1 of a Legendary. You start with every card in the six starter decks and 300 gold. Win a battle for 60 gold, lose one for 20 (your first battle also pays a 100,000 gold bonus), and spend gold on packs in the Card Shop. Extra copies you can't use turn into gold automatically.</p>`;
  }

  // ================================================================= BATTLE
  let G = null, sel = null, busy = false, lastDecks = null, popUids = new Set();
  function startBattle(myDeck, oppCls, cmp) {
    const oppDeck = cmp ? cmp.deck : E.randomDeck(null, oppCls, Math.random);
    lastDecks = { myDeck, oppCls, cmp };
    G = E.newGame({ decks: [myDeck.cards, oppDeck], classes: [myDeck.cls, oppCls], seed: (Math.random() * 1e9) | 0,
      names: ['You', cmp ? cmp.name : D.heroes[oppCls].n], heroes: cmp ? [null, { n: cmp.name, art: cmp.art }] : null, hp: cmp ? [30, cmp.hp] : null });
    G.p[1].isBot = true;
    if (cmp) G.camp = { k: cmp.k, i: cmp.i };
    sel = null; busy = false;
    const bgk = cmp && D.boards[cmp.bg] ? cmp.bg : D.heroes[myDeck.cls].bg;
    const bgs = Object.keys(D.boards);
    $('#battlebg').style.backgroundImage = `url(${D.boards[bgk] || D.boards[bgs[Math.floor(Math.random() * bgs.length)]]})`;
    show('battle'); playMusic('fight'); sfx('fightstart', .5);
    sizeTable(); render();
    E.botMulligan(G, 1);
    showMulligan();
  }
  function sizeTable() {
    const W = innerWidth, H = innerHeight;
    // phones get bigger minions: a board of 5 fills the width, a fuller board shrinks to fit (render() sets --k)
    const mw = W < 720 ? Math.max(56, Math.min((W - 8) / 5, H / 8.4, 112)) : Math.max(52, Math.min((W - 24) / 6.4, H / 7.9, 112));
    $('#table').style.setProperty('--mw', mw + 'px');
  }
  addEventListener('resize', () => { if (current === 'battle') { sizeTable(); render(); } });

  function minionHTML(m, o) {
    const c = E.card(m.cid);
    const a = E.atkOf(G, m);
    const cls = ['minion', m.kw.has('taunt') ? 'taunt' : '', m.divine ? 'divine' : '', m.stealth ? 'stealth' : '', m.frozen ? 'frozen' : '', c.r === 3 ? 'leg' : '', o.extra || ''].join(' ');
    const icons = [];
    if (m.kw.has('windfury')) icons.push('<i title="Double Strike: attacks twice">2×</i>');
    if (m.kw.has('poisonous')) icons.push('<i title="Deadly: kills any minion it damages" style="color:#7dff6a">☠</i>');
    if (m.kw.has('lifesteal')) icons.push('<i title="Lifesteal: its damage heals you" style="color:#ff7b8a">♥</i>');
    if (m.reborn) icons.push('<i title="Comes Back with 1 Health" style="color:#bff">↺</i>');
    if (m.fx.some(e => e.on === 'dr')) icons.push('<i title="Something happens when it dies">✝</i>');
    if (m.fx.some(e => ['eot', 'sot', 'edie', 'heal', 'fspell', 'atk', 'dmg', 'fsum'].includes(e.on))) icons.push('<i title="Triggered ability" style="color:#ffe36a">ϟ</i>');
    if (m.sd || m.fx.some(e => e.op === 'aura_sd')) icons.push(`<i title="Your spells deal more damage" style="color:#9fdcff">+${m.sd || 1}</i>`);
    if (m.kw.has('frostbite')) icons.push('<i title="Freezes what it damages" style="color:#9fe6ff">❄</i>');
    if (m.silenced) icons.push('<i title="Abilities removed">∅</i>');
    const sleepy = m.owner === 0 && G.turn === 0 && m.sleeping && !m.kw.has('charge') && !m.kw.has('rush') && !m.kw.has('cantattack');
    return `<div class="${cls}" data-uid="${m.uid}" data-cid="${m.cid}" style="--cc:${CCOL(c.c)}">
      <div class="port">${spr(c.art, 't')}</div>
      <div class="ma${a > c.a ? ' buffed' : ''}">${a}</div><div class="mh${m.h < m.max ? ' hurt' : m.max > c.h ? ' buffed' : ''}">${m.h}</div>
      <div class="icons">${icons.join('')}</div>${sleepy ? '<div class="zz">z<small>z</small></div>' : ''}</div>`;
  }
  function heroRowHTML(pi) {
    const P = G.p[pi], h = P.heroData, me = pi === 0;
    const atk = E.atkOf(G, P.hero);
    const hpBtn = `<button class="hpower${P.hpUsed ? ' used' : ''}${me && E.canHeroPower(G, 0) && !busy ? ' ready' : ''}" ${me ? 'data-hp="1"' : ''} title="${esc(h.hp.n)}: ${esc(h.hp.tx)}" style="${artCSS(h.art)}" aria-label="Hero Power: ${esc(h.hp.n)}"><span class="c">2</span></button>`;
    const weap = P.weapon ? `<div class="weapon" data-cid="${P.weapon.cid}" style="${artCSS(E.card(P.weapon.cid) ? E.card(P.weapon.cid).art : null)}"><span class="wa">${P.weapon.a}</span><span class="wd">${P.weapon.h}</span></div>` : '';
    const crys = Array.from({ length: P.maxMana }, (_, i) => `<span class="crys${i < P.mana ? ' f' : (i >= P.maxMana - P.ovLocked ? ' lock' : '')}"></span>`).join('');
    const can = me && E.canAttack(G, P.hero) && !busy;
    const heroEl = `<div class="hero${P.hero.frozen ? ' frozen' : ''}${can ? ' can' : ''}" data-uid="${P.hero.uid}" style="--cc:${CCOL(P.cls)}">
      <div class="hname">${esc(P.name)}</div><div class="port" style="${artCSS(h.art)}"></div>
      ${P.hero.armor ? `<div class="harm">${P.hero.armor}</div>` : ''}${atk > 0 ? `<div class="hatk">${atk}</div>` : ''}<div class="hhp">${P.hero.hp}</div></div>`;
    const side = `<div class="side"><div class="manabar">${P.mana}/${P.maxMana} ${crys}</div>
      <div class="deckct" title="Cards left in deck">Deck ${P.deck.length}</div>${!me ? `<div class="handct">Hand ${P.hand.length}</div>` : ''}
      ${P.secrets.length ? `<div class="secrets">${P.secrets.map(s => `<span class="secret" title="${me ? 'Your Trap: ' + esc(E.card(s.cid).n) : 'Enemy Trap'}">?</span>`).join('')}</div>` : ''}</div>`;
    return me ? `${weap}${heroEl}${hpBtn}${side}` : `${side}${weap}${heroEl}${hpBtn}`;
  }
  function render() {
    if (!G) return;
    const me = G.p[0], op = G.p[1];
    const myTurn = G.turn === 0 && G.phase === 'play' && !busy;
    const atkSet = new Set(), tgtSet = new Set(), friendTgt = new Set();
    if (myTurn && !sel) [...me.board, me.hero].forEach(u => { if (E.canAttack(G, u)) atkSet.add(u.uid); });
    if (sel) sel.targets.forEach(u => { tgtSet.add(u.uid); if (u.owner === 0) friendTgt.add(u.uid); });
    $('#ohand').innerHTML = op.hand.map(() => '<div class="cb"></div>').join('');
    $('#ohero').innerHTML = heroRowHTML(1);
    $('#mhero').innerHTML = heroRowHTML(0);
    const extra = u => (atkSet.has(u.uid) ? ' can' : '') + (tgtSet.has(u.uid) ? ' tgt' : '') + (friendTgt.has(u.uid) ? ' friendly' : '') + (sel && sel.uid === u.uid ? ' picked' : '');
    $('#oboard').innerHTML = op.board.map(m => minionHTML(m, { extra: extra(m) })).join('');
    $('#mboard').innerHTML = me.board.map(m => minionHTML(m, { extra: extra(m) })).join('');
    const mwPx = parseFloat(getComputedStyle($('#table')).getPropertyValue('--mw')) || 86;
    [['#oboard', op.board.length], ['#mboard', me.board.length]].forEach(([q, n]) => {
      const need = n * mwPx * 1.12 + 40, avail = innerWidth - 16;
      $(q).style.setProperty('--k', need > avail ? (avail / need).toFixed(3) : 1);
    });
    [me.hero, op.hero].forEach(h => { const el = document.querySelector(`.hero[data-uid="${h.uid}"]`); if (el) el.className += extra(h); });
    // hand fan
    const n = me.hand.length;
    const W = $('#hand').clientWidth || innerWidth;
    const mw = parseFloat(getComputedStyle($('#table')).getPropertyValue('--mw')) || 86;
    const cw = mw * 1.18;
    const step = Math.min(cw * 0.86, (W - cw - 150) / Math.max(1, n - 1));
    $('#hand').innerHTML = me.hand.map((ci, i) => {
      const c = E.card(ci.cid);
      const off = (i - (n - 1) / 2);
      const playable = myTurn && E.canPlay(G, 0, i);
      const s = sel && sel.type === 'hand' && sel.idx === i;
      return cardHTML(c, { cost: E.costOf(G, 0, ci), cls: (playable ? 'playable' : '') + (s ? ' sel' : ''),
        style: `transform:translateX(calc(-50% + ${off * step}px)) rotate(${off * 3.2}deg) translateY(${Math.abs(off) * Math.abs(off) * 2.2}px);z-index:${i + 1}`,
        attrs: `data-hand="${i}" tabindex="0" role="button" aria-label="${esc(c.n)}"` });
    }).join('');
    $('#mboard').classList.toggle('target-zone', !!(sel && sel.type === 'hand' && sel.place));
    const et = $('#endturn');
    et.disabled = !myTurn;
    et.textContent = G.turn === 0 ? 'End Turn' : 'Enemy Turn';
    const anyMove = myTurn && (me.hand.some((_, i) => E.canPlay(G, 0, i)) || [...me.board, me.hero].some(u => E.canAttack(G, u)) || E.canHeroPower(G, 0));
    et.classList.toggle('done', myTurn && !anyMove);
    coach(myTurn, me, anyMove);
    $('#loglines').innerHTML = G.log.slice(-80).map(l => `<div>${esc(l)}</div>`).join('');
    popUids.forEach(uid => { const el = document.querySelector(`[data-uid="${uid}"]`); if (el) el.classList.add('pop'); });
    popUids.clear();
  }
  let tips = store.get('ll_tips', true);
  function coach(myTurn, me, anyMove) {
    const el = $('#coach');
    if (!tips || !myTurn || sel) { el.hidden = true; return; }
    let t;
    if (me.hand.some((_, i) => E.canPlay(G, 0, i))) t = readFirst ? `Tap a card glowing green to read it, then press Play. You have ${me.mana} Mana.` : `Tap a card glowing green to play it. You have ${me.mana} Mana.`;
    else if ([...me.board, me.hero].some(u => E.canAttack(G, u))) t = 'Tap one of your minions glowing green, then tap an enemy to attack it.';
    else if (E.canHeroPower(G, 0)) t = `Use your Hero Power, ${me.heroData.hp.n}: the round button next to your hero (2 Mana).`;
    else t = 'Nothing left to do. Press End Turn.';
    el.innerHTML = `${esc(t)} <button class="linkbtn" data-tipsoff>Hide tips</button>`;
    el.hidden = false;
  }
  $('#coach').addEventListener('click', e => { if (e.target.closest('[data-tipsoff]')) { tips = false; store.set('ll_tips', false); $('#coach').hidden = true; } });
  function hint(s) { const h = $('#hint'); if (!s) { h.hidden = true; return; } h.textContent = s; h.hidden = false; }
  async function banner(s, ms) { const b = $('#banner'); b.textContent = s; b.classList.add('show'); await sleep(ms || 900); b.classList.remove('show'); }

  // ---------- animation of engine events ----------
  function elOf(uid) { return document.querySelector(`[data-uid="${uid}"]`); }
  function centerOf(el) { const r = el.getBoundingClientRect(), b = $('#battle').getBoundingClientRect(); return { x: r.left - b.left + r.width / 2, y: r.top - b.top + r.height / 2 }; }
  function floatText(uid, txt, kind) {
    const el = elOf(uid); if (!el) return;
    const p = centerOf(el);
    const f = document.createElement('div'); f.className = 'float ' + kind; f.textContent = txt; f.style.left = p.x + 'px'; f.style.top = (p.y - 10) + 'px';
    $('#battle').appendChild(f); setTimeout(() => f.remove(), 950);
  }
  function vfxAt(uid, idx) {
    if (idx == null) return;
    const el = elOf(uid); if (!el) return;
    const p = centerOf(el);
    const rows = Math.ceil(Object.keys(D.fx).length / 8) || 1;
    const v = document.createElement('div'); v.className = 'vfx';
    const sheetRows = Math.max(1, Math.ceil((Math.max(...Object.values(D.fx)) + 1) / 8));
    v.style.cssText = `left:${p.x}px;top:${p.y}px;background-image:url(img/fx.webp);background-size:800% ${sheetRows * 100}%;background-position:${(idx % 8) * 100 / 7}% ${sheetRows > 1 ? Math.floor(idx / 8) * 100 / (sheetRows - 1) : 0}%`;
    $('#battle').appendChild(v); setTimeout(() => v.remove(), 650);
  }
  async function lunge(fromUid, toUid) {
    const a = elOf(fromUid), d = elOf(toUid); if (!a || !d) return;
    const pa = centerOf(a), pd = centerOf(d);
    a.style.transition = 'transform .16s ease-in'; a.style.zIndex = 40;
    a.style.transform = `translate(${(pd.x - pa.x) * 0.72}px, ${(pd.y - pa.y) * 0.72}px) scale(1.08)`;
    await sleep(170);
    vfxAt(toUid, D.fx.fxa_slash_long != null ? D.fx.fxa_slash_long : D.fx.fx_slash);
    a.style.transition = 'transform .2s ease-out'; a.style.transform = '';
    await sleep(120);
    a.style.zIndex = '';
  }
  async function showPlayed(cid) {
    const c = E.card(cid); if (!c) return;
    const w = document.createElement('div'); w.className = 'played'; w.innerHTML = cardHTML(c);
    $('#battle').appendChild(w); await sleep(900); w.remove();
  }
  async function animate(evs) {
    let deaths = [];
    for (const e of evs) {
      switch (e.t) {
        case 'play': {
          const c = E.card(e.cid);
          sfx(c.t === 's' ? 'ult' : 'summon', .45);
          if (e.pi === 1) await showPlayed(e.cid);
          break;
        }
        case 'attack': sfx(['hit1', 'hit2', 'hit3'][Math.floor(Math.random() * 3)], .55); await lunge(e.from, e.to); break;
        case 'dmg': floatText(e.uid, '−' + e.n, 'd'); { const el = elOf(e.uid); if (el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); } } break;
        case 'heal': floatText(e.uid, '+' + e.n, 'h'); sfx('heal', .35); break;
        case 'shield': floatText(e.uid, 'Blocked', 's'); sfx('shield', .45); break;
        case 'freeze': floatText(e.uid, 'Frozen', 's'); break;
        case 'buff': floatText(e.uid, 'Buffed', 's'); break;
        case 'silence': floatText(e.uid, 'Abilities removed', 's'); break;
        case 'armor': floatText(e.uid, '+' + e.n + ' Armor', 's'); sfx('shield', .3); break;
        case 'vfx': (e.uids || []).forEach(u => vfxAt(u, e.k)); break;
        case 'death': case 'destroy': deaths.push(e.uid); break;
        case 'summon': popUids.add(e.uid); break;
        case 'evolve': popUids.add(e.uid); sfx('lvl', .5); break;
        case 'secret': sfx('relic', .5); await banner('Trap! ' + E.card(e.cid).n, 1000); break;
        case 'gamble': floatText(G.p[e.pi].hero.uid, ['Spin: damage!', 'Spin: heal!', 'Spin: draw!'][e.r], 's'); sfx('coin', .4); break;
        case 'burn': floatText(G.p[e.pi].hero.uid, 'Burned: ' + E.card(e.cid).n, 's'); break;
        case 'fatigue': floatText(G.p[e.pi].hero.uid, 'Fatigue', 's'); break;
        case 'hp': sfx('crit', .35); if (e.target) vfxAt(e.target, D.fx.fxa_spark_zap); break;
        case 'frenzy': floatText(e.uid, 'Frenzy!', 's'); sfx('crit', .4); break;
        case 'dredge': floatText(G.p[e.pi].hero.uid, 'Dredged', 's'); break;
        case 'weaponBreak': floatText(G.p[e.pi].hero.uid, 'Weapon broke', 's'); break;
        default: break;
      }
    }
    if (deaths.length) {
      sfx('ko', .4);
      deaths.forEach(u => { const el = elOf(u); if (el) el.classList.add('dying'); });
      await sleep(420);
    }
  }
  async function act(fn) {
    if (busy || !G) return false;
    busy = true;
    G.ev.length = 0;
    const ok = fn();
    const evs = G.ev.splice(0);
    sel = null; hint(null);
    await animate(evs);
    busy = false;
    render();
    await afterAction();
    return ok;
  }
  async function afterAction() {
    if (G.pending && G.pending.type === 'discover' && G.pending.pi === 0) showDiscover();
    if (G.pending && G.pending.type === 'dredge' && G.pending.pi === 0) showDredge();
    if (G.phase === 'over') await gameOver();
  }

  // ---------- player input ----------
  function whyNot(i) {
    const P = G.p[0], ci = P.hand[i], c = E.card(ci.cid), cost = E.costOf(G, 0, ci);
    if (G.turn !== 0 || G.phase !== 'play') return "It's not your turn.";
    return cost > P.mana ? `Not enough Mana: it costs ${cost}, you have ${P.mana}.` : c.t === 'm' && P.board.length >= 7 ? 'Your board is full (7 minions).' : c.secret ? 'That Trap is already set.' : 'Nothing it can target right now.';
  }
  function selectHand(i) {
    const P = G.p[0], ci = P.hand[i], c = E.card(ci.cid);
    if (!E.canPlay(G, 0, i)) {
      hint(whyNot(i));
      setTimeout(() => hint(null), 1200);
      return;
    }
    const onKeys = c.t === 's' ? ['cast'] : ['bc', 'combo'];
    if (E.needsTarget(c, onKeys)) {
      const e = E.chosenEffect(c, onKeys);
      if (e.on === 'combo' && G.played === 0) { act(() => E.playCard(G, 0, i, null)); return; }
      const targets = E.validTargets(G, 0, e.tg || 'any', { spell: c.t === 's', eff: e });
      if (!targets.length && c.t !== 's') { act(() => E.playCard(G, 0, i, null)); return; }
      sel = { type: 'hand', idx: i, targets };
      hint(c.t === 's' ? 'Choose a target for this spell' : 'Choose a target for its "When played" ability');
      render();
      return;
    }
    act(() => E.playCard(G, 0, i, null));
  }
  $('#table').addEventListener('click', e => {
    if (noClick) { noClick = false; return; }
    if (G && G.phase === 'play' && !G.pending && (G.turn !== 0 || busy)) {
      // not your move: tapping still reads cards
      const h0 = e.target.closest('[data-hand]'), u0 = e.target.closest('.minion[data-uid]'), w0 = e.target.closest('.weapon[data-cid]');
      if (h0) inspect({ hand: +h0.dataset.hand, look: true }); else if (u0) inspect({ uid: +u0.dataset.uid, look: true }); else if (w0) inspect({ cid: w0.dataset.cid, look: true });
      return;
    }
    if (!G || busy || G.phase !== 'play' || G.turn !== 0 || G.pending) return;
    const h = e.target.closest('[data-hand]');
    if (h) {
      const i = +h.dataset.hand;
      if (sel && sel.type === 'hand' && sel.idx === i) { sel = null; hint(null); render(); return; }
      sel = null;
      if (readFirst) { hint(null); render(); inspect({ hand: i }); return; }
      selectHand(i); return;
    }
    const w = e.target.closest('.weapon[data-cid]');
    if (w && !sel) { inspect({ cid: w.dataset.cid }); return; }
    if (e.target.closest('[data-hp]')) {
      if (!E.canHeroPower(G, 0)) { hint(G.p[0].hpUsed ? 'Hero Power already used this turn.' : 'Not enough Mana.'); setTimeout(() => hint(null), 1200); return; }
      const ef = G.p[0].heroData.hp.fx.find(E.picks);
      if (ef) {
        sel = { type: 'hp', targets: E.validTargets(G, 0, ef.tg || 'any', { spell: true, eff: ef }) };
        hint('Choose a target'); render();
      } else act(() => E.heroPower(G, 0, null));
      return;
    }
    const u = e.target.closest('[data-uid]');
    if (u) {
      const uid = +u.dataset.uid;
      if (sel) {
        if (sel.targets.some(t => t.uid === uid)) {
          const s = sel;
          if (s.type === 'hand') act(() => E.playCard(G, 0, s.idx, uid));
          else if (s.type === 'hp') act(() => E.heroPower(G, 0, uid));
          else if (s.type === 'atk') act(() => E.attack(G, s.uid, uid));
          return;
        }
        if (sel.type === 'atk' && sel.uid === uid) { sel = null; hint(null); render(); return; }
      }
      const unit = E.findUnit(G, uid);
      if (unit && unit.owner === 0 && E.canAttack(G, unit)) {
        sel = { type: 'atk', uid, targets: E.attackTargets(G, unit) };
        hint(sel.targets.length ? (sel.targets.some(t => t.kind === 'minion' && t.kw.has('taunt')) ? 'Choose what to attack (Guard minions must be hit first)' : 'Choose what to attack') : 'Nothing to attack'); render(); return;
      }
      if (unit && unit.kind === 'minion') { inspect({ uid }); return; }
    }
    if (sel) { sel = null; hint(null); render(); }
  });
  $('#table').addEventListener('keydown', e => { if (e.key === 'Enter') { const el = e.target.closest('[data-hand]'); if (el) el.click(); } });
  $('#endturn').onclick = async () => {
    if (busy || !G || G.turn !== 0 || G.phase !== 'play') return;
    sfx('click', .4);
    await act(() => E.endTurn(G));
    if (G.phase === 'play' && G.turn === 1) runBot();
  };
  async function runBot() {
    if (!G) return;
    const g0 = G;
    await sleep(350);
    await banner('Enemy Turn', 700);
    let guard = 0;
    while (G === g0 && G.phase === 'play' && G.turn === 1 && guard++ < 60) {
      await sleep(420);
      busy = true;
      G.ev.length = 0;
      const did = E.botStep(G, 1);
      const evs = G.ev.splice(0);
      await animate(evs);
      busy = false;
      render();
      if (G.phase === 'over') { await gameOver(); return; }
      if (!did) break;
    }
    if (G !== g0 || G.phase !== 'play') return;
    if (G.turn === 1) { await act(() => E.endTurn(G)); }
    if (G.phase === 'play' && G.turn === 0) { sfx('click', .4); await banner('Your Turn', 800); render(); }
  }
  $('#b-log').onclick = () => $('#logpane').classList.add('open');
  $('#b-help').onclick = () => {
    const m = $('#modal');
    m.innerHTML = `<div class="helpbox"><h3>Quick help</h3>
      <ol class="steps"><li><b>Play cards</b> that glow green. The blue number is the Mana cost; your Mana is shown by your hero.</li>
      <li><b>Attack</b>: tap your glowing minion, then an enemy. Both hit each other. Health at 0 means it dies.</li>
      <li><b>Hero Power</b>: the round button by your hero, 2 Mana, once a turn.</li>
      <li><b>End Turn</b> when you're done. Bring the enemy hero to 0 Health to win.</li></ol>
      <p>Tap any minion, or press and hold any card, to see it big with every bold word explained. ${readFirst ? 'Tapping a card in your hand opens it first; press Play to play it.' : ''} You can change that in Menu.</p>
      <div class="legend">${[['zz', "Sleeping: can't attack yet"], ['🛡', 'Guard: must be attacked first'], ['✦', 'Shield: blocks one hit'], ['2×', 'Attacks twice'], ['☠', 'Deadly'], ['♥', 'Lifesteal'], ['↺', 'Comes Back'], ['✝', 'Does something when it dies'], ['ϟ', 'Triggered ability'], ['❄', 'Freezes'], ['?', 'A hidden Trap']].map(([i, t]) => `<div><i>${i}</i><span>${esc(t)}</span></div>`).join('')}</div>
      <div class="row" style="margin-top:14px"><button class="big alt" data-m="stay">Back to the game</button><button class="big alt" data-m="tipson">${tips ? 'Tips are on' : 'Turn tips back on'}</button></div></div>`;
    m.hidden = false;
  };
  $('#b-logx').onclick = () => $('#logpane').classList.remove('open');
  $('#b-menu').onclick = () => {
    const m = $('#modal');
    m.innerHTML = `<div><h3>Menu</h3>
      <p>Tapping a card in your hand ${readFirst ? '<b>opens it big first</b>, with a Play button, so you can read it.' : '<b>plays it right away</b>. Press and hold any card to read it.'}</p>
      <div class="row"><button class="big alt" data-m="read">${readFirst ? 'Switch to: tap plays right away' : 'Switch to: tap opens the card first'}</button></div>
      <p>Leaving the battle counts as a loss.</p><div class="row"><button class="big alt" data-m="stay">Keep playing</button><button class="big" data-m="quit">Concede</button></div></div>`;
    m.hidden = false;
  };

  // ---------- peek (hover / long-press) ----------
  let pressT = null;
  function peekCard(cid, el) {
    const c = E.card(cid); if (!c) return;
    const p = $('#peek');
    const ex = explain(c);
    p.innerHTML = `<div class="peekwrap">${cardHTML(c)}${ex.length ? `<div class="kwlist">${ex.map(([k, v]) => `<div><b>${esc(k)}</b> ${esc(v)}</div>`).join('')}</div>` : ''}</div>`;
    const r = el.getBoundingClientRect(), b = $('#battle').getBoundingClientRect();
    const w = ex.length ? Math.min(420, b.width - 16) : 210, h = 294;
    let x = r.right - b.left + 12; if (x + w > b.width - 8) x = r.left - b.left - w - 12; if (x < 8) x = Math.max(8, (b.width - w) / 2);
    let y = r.top - b.top + r.height / 2 - h / 2; y = Math.max(8, Math.min(b.height - h - 8, y));
    if (b.width < 720) { x = Math.max(8, (b.width - 210) / 2); y = 8; }
    p.style.left = x + 'px'; p.style.top = y + 'px'; p.hidden = false;
  }
  function hidePeek() { $('#peek').hidden = true; }
  $('#table').addEventListener('mouseover', e => { const el = e.target.closest('.minion[data-cid], .weapon[data-cid], #hand .card'); if (el && matchMedia('(hover: hover)').matches) peekCard(el.dataset.cid, el); });
  $('#table').addEventListener('mouseout', e => { if (e.target.closest('.minion[data-cid], .weapon[data-cid], #hand .card')) hidePeek(); });
  let noClick = false;
  $('#table').addEventListener('touchstart', e => {
    const el = e.target.closest('[data-cid]'); if (!el) return;
    pressT = setTimeout(() => {
      noClick = true;
      const h = el.closest('[data-hand]'), u = el.closest('.minion[data-uid]');
      inspect(h ? { hand: +h.dataset.hand, look: !!sel } : u ? { uid: +u.dataset.uid, look: true } : { cid: el.dataset.cid });
    }, 450);
  }, { passive: true });
  ['touchend', 'touchmove', 'touchcancel'].forEach(t => $('#table').addEventListener(t, () => { clearTimeout(pressT); setTimeout(() => { noClick = false; }, 400); }, { passive: true }));

  // ---------- inspect: a big, readable view of a card, then Play or Attack from it ----------
  // On phones a tap opens this first instead of playing the card straight away (setting: ll_read).
  let readFirst = store.get('ll_read', matchMedia('(hover: none)').matches || innerWidth < 720);
  let insp = null;
  function inspect(o) {
    if (!G) return;
    hidePeek();
    const me = G.p[0];
    let c, unit = null, ci = null;
    if (o.hand != null) { ci = me.hand[o.hand]; if (!ci) return; c = E.card(ci.cid); }
    else if (o.uid != null) { unit = E.findUnit(G, o.uid); if (!unit || unit.kind !== 'minion') return; c = E.card(unit.cid); }
    else c = E.card(o.cid);
    if (!c) return;
    insp = { ...o };
    const myMove = G.turn === 0 && G.phase === 'play' && !busy && !G.pending && !o.look;
    const ex = explain(c);
    let status = '', btn = '';
    if (unit) {
      const a = E.atkOf(G, unit), tags = [];
      if (unit.kw.has('taunt')) tags.push('Guard'); if (unit.divine) tags.push('Shield up'); if (unit.stealth) tags.push('Hidden'); if (unit.frozen) tags.push('Frozen');
      if (unit.reborn) tags.push('Comes Back ready'); if (unit.silenced) tags.push('Abilities removed');
      if (unit.owner === 0 && G.turn === 0 && unit.sleeping && !unit.kw.has('charge') && !unit.kw.has('rush')) tags.push('Asleep until your next turn');
      status = `<p class="now">${unit.owner === 0 ? 'Yours' : 'Enemy'} · now <b>${a}</b> Attack, <b>${unit.h}</b>/${unit.max} Health${tags.length ? ' · ' + tags.join(', ') : ''}</p>`;
      if (myMove && unit.owner === 0 && E.canAttack(G, unit)) btn = `<button class="big" data-ins="attack">Attack with it</button>`;
    }
    if (ci) {
      const cost = E.costOf(G, 0, ci);
      if (cost !== c.m) status = `<p class="now">Costs <b>${cost}</b> right now (normally ${c.m}).</p>`;
      if (myMove) btn = E.canPlay(G, 0, o.hand) ? `<button class="big" data-ins="play">${E.needsTarget(c, c.t === 's' ? ['cast'] : ['bc', 'combo']) ? 'Play, then pick a target' : 'Play it'}</button>`
        : `<button class="big" disabled>Can't play</button><p class="why">${esc(whyNot(o.hand))}</p>`;
    }
    const cardView = unit ? cardHTML(c, {}) : cardHTML(c, ci ? { cost: E.costOf(G, 0, ci) } : {});
    $('#inspect').innerHTML = `<div class="isheet" role="dialog" aria-label="${esc(c.n)}">
      <div class="icard">${cardView}</div>
      <div class="iinfo"><h3>${esc(c.n)}</h3>
        <p class="sub">${RN[c.r]} ${c.t === 's' ? 'spell' : c.t === 'w' ? 'weapon' : 'minion'} · ${CLSN[c.c] || ''}${c.tr ? ' · ' + esc(c.tr) : ''}</p>
        ${status}
        ${c.tx ? `<p class="itx">${fmt(c.tx)}</p>` : ''}
        ${ex.length ? `<div class="kwlist">${ex.map(([k, v]) => `<div><b>${esc(k)}</b> ${esc(v)}</div>`).join('')}</div>` : ''}
        ${c.fl ? `<p class="fl">\u201c${esc(c.fl)}\u201d</p>` : ''}
      </div>
      <div class="ibtns">${btn}<button class="big alt" data-ins="close">Close</button></div></div>`;
    $('#inspect').hidden = false;
  }
  function closeInspect() { $('#inspect').hidden = true; insp = null; }
  $('#inspect').addEventListener('click', e => {
    const b = e.target.closest('[data-ins]');
    if (!b) { if (e.target === $('#inspect')) closeInspect(); return; }
    const o = insp; closeInspect();
    if (!o || !G) return;
    if (b.dataset.ins === 'play' && o.hand != null) { sel = null; selectHand(o.hand); }
    else if (b.dataset.ins === 'attack' && o.uid != null) {
      const unit = E.findUnit(G, o.uid);
      if (unit && E.canAttack(G, unit)) { sel = { type: 'atk', uid: o.uid, targets: E.attackTargets(G, unit) }; hint(sel.targets.length ? 'Choose what to attack' : 'Nothing to attack'); render(); }
    }
  });

  // ---------- modals: mulligan, discover, game over ----------
  function showMulligan() {
    const P = G.p[0];
    const swap = new Set();
    const m = $('#modal');
    const draw = () => {
      m.innerHTML = `<div><h3>${G.first === 0 ? 'You go first' : 'You go second'}</h3>
        <p>Tap cards to swap them for new ones.${G.first === 1 ? ' You also get The Coin.' : ''}</p>
        <div class="row">${P.hand.map((ci, i) => cardHTML(E.card(ci.cid), { cls: swap.has(i) ? 'swap' : '', attrs: `data-mull="${i}"` })).join('')}</div>
        <button class="big" data-m="keep">${swap.size ? `Swap ${swap.size} and start` : 'Keep hand and start'}</button></div>`;
    };
    draw(); m.hidden = false;
    m.onclick = async e => {
      const c = e.target.closest('[data-mull]');
      if (c) { const i = +c.dataset.mull; swap.has(i) ? swap.delete(i) : swap.add(i); draw(); return; }
      const b = e.target.closest('[data-m]'); if (!b) return;
      if (b.dataset.m === 'keep') {
        m.hidden = true; m.onclick = modalClick;
        E.mulligan(G, 0, [...swap]);
        G.ev.length = 0; render();
        if (G.turn === 1) runBot(); else { await banner('Your Turn', 800); render(); }
      }
    };
  }
  function showDiscover() {
    const pd = G.pending; const m = $('#modal');
    m.innerHTML = `<div><h3>Pick a card</h3><p>Choose one of these to add to your hand.</p><div class="row">${pd.opts.map((id, i) => cardHTML(E.card(id), { attrs: `data-disc="${i}"` })).join('')}</div></div>`;
    m.hidden = false;
  }
  async function gameOver() {
    const w = G.winner;
    sfx(w === 0 ? 'stinger_win' : 'stinger_lose', .6);
    await sleep(500);
    const m = $('#modal');
    const title = w === 0 ? 'Victory!' : w === 1 ? 'Defeat' : 'Draw';
    const reward = w === 0 ? 60 : 20;
    // launch gift: 100,000 gold the first time a player finishes a match (any result).
    // Players who had already played before this shipped get it on their next match.
    const gift = store.get('ll_gift100k', false) ? 0 : 100000;
    if (gift) store.set('ll_gift100k', true);
    gold += reward + gift; saveOwned();
    const sub = w === 0 ? `You defeated ${G.p[1].name} on turn ${Math.ceil(G.turnNo / 2)}.` : w === 1 ? `${G.p[1].name} wins this one.` : 'Both heroes fell at once.';
    if (G.camp) {
      const r = campEnd(w === 0);
      saveOwned();
      m.innerHTML = `<div><h3>${title}</h3><p>${esc(sub)}</p>${gift ? '<p class="reward gift">First match bonus: +100,000 gold!</p>' : ''}
        ${r.lines.map(l => `<p class="reward">${esc(l)}</p>`).join('')}<p class="reward">+${reward} gold · you have ${gold.toLocaleString()}</p>
        <div class="row">${w === 0 ? '<button class="big" data-m="cnext">Continue the story</button>' : '<button class="big" data-m="cretry">Try again</button>'}
        <button class="big alt" data-m="cback">Back to the campaign</button></div></div>`;
      m.hidden = false;
      return;
    }
    m.innerHTML = `<div><h3>${title}</h3><p>${esc(sub)}</p>${gift ? '<p class="reward gift">First match bonus: +100,000 gold!</p>' : ''}<p class="reward">+${reward} gold · you have ${gold.toLocaleString()}</p><div class="row"><button class="big" data-m="again">Play again</button><button class="big alt" data-m="shop">Card Shop</button><button class="big alt" data-m="decks">Change deck</button><button class="big alt" data-m="menu">Main menu</button></div></div>`;
    m.hidden = false;
  }
  function showDredge() {
    const pd = G.pending; const m = $('#modal');
    m.innerHTML = `<div><h3>Dredge</h3><p>These are the bottom ${pd.opts.length} cards of your deck. Pick one to put on top. You draw it next.</p><div class="row">${pd.opts.map((id, i) => cardHTML(E.card(id), { attrs: `data-dredge="${i}"` })).join('')}</div></div>`;
    m.hidden = false;
  }
  function modalClick(e) {
    const dr = e.target.closest('[data-dredge]');
    if (dr) { E.chooseDredge(G, +dr.dataset.dredge); $('#modal').hidden = true; sfx('relic', .4); render(); afterAction(); return; }
    const d = e.target.closest('[data-disc]');
    if (d) { E.chooseDiscover(G, +d.dataset.disc); $('#modal').hidden = true; sfx('relic', .4); render(); afterAction(); return; }
    const b = e.target.closest('[data-m]'); if (!b) return;
    const k = b.dataset.m;
    $('#modal').hidden = true;
    if (k === 'stay') return;
    if (k === 'tipson') { tips = true; store.set('ll_tips', true); render(); return; }
    if (k === 'read') { readFirst = !readFirst; store.set('ll_read', readFirst); return; }
    if (k === 'quit') { G = null; show('menu'); return; }
    if (k === 'again') { startBattle(lastDecks.myDeck, chosenOpp === 'random' ? CLS[Math.floor(Math.random() * CLS.length)] : lastDecks.oppCls); return; }
    if (k === 'decks') { G = null; show('play'); return; }
    if (k === 'menu') { G = null; show('menu'); return; }
    if (k === 'shop') { G = null; show('shop'); return; }
    if (k === 'cretry') { const c = G.camp; G = null; startCampBattle(c.k, c.i, lastDecks.myDeck); return; }
    if (k === 'cback') { campView = G.camp.k; G = null; show('campaign'); return; }
    if (k === 'cnext') { const c = G.camp; G = null; const ch = storyOf(c.k).chapters[c.i]; campView = c.k; playScene(ch, c.i, 'outro').then(() => show('campaign')); return; }
  }
  $('#modal').onclick = modalClick;
  addEventListener('keydown', e => { if (e.key === 'Escape') { if (!$('#inspect').hidden) closeInspect(); else if (!$('#zoom').hidden) $('#zoom').hidden = true; else if (sel) { sel = null; hint(null); render(); } } });

  // ---------------------------------------------------------------- card shop
  function packHTML(p) {
    const pct = p.odds.map(x => (x < 10 ? x.toFixed(1) : Math.round(x)) + '%');
    return `<div class="packcard${p.set ? ' newset' : ''}" style="--pc:${p.col}">${p.set ? `<span class="setrib">${SET_ICON[p.set]}New expansion</span>` : ''}
      <div class="pack" aria-hidden="true" style="background-image:url(img/pack_${p.id}.webp)"></div>
      <div class="pinfo"><b>${esc(p.name)}</b><span>${esc(p.blurb)}</span>
        <span class="odds">5 cards · at least one Rare<br>Common ${pct[0]} · Rare ${pct[1]} · Epic ${pct[2]} · Legendary ${pct[3]}<br>${p.size.toLocaleString()} different cards inside</span>
        <button class="big buy" data-buy="${p.id}" ${gold < p.price ? 'disabled' : ''}>${gold < p.price ? `Need ${p.price} gold` : `Buy for ${p.price} gold`}</button></div></div>`;
  }
  function renderShop() {
    $('#packgrid').innerHTML = PACKS.map(packHTML).join('');
    $('#shopnote').textContent = `You own ${ownedTotal().toLocaleString()} of ${D.cards.reduce((a, c) => a + CAP(c), 0).toLocaleString()} collectible copies. Win battles for 60 gold, lose for 20.${store.get('ll_gift100k', false) ? '' : ' Finish your first battle for a 100,000 gold bonus!'}`;
    goldChips();
  }
  $('#packgrid').addEventListener('click', e => {
    const b = e.target.closest('[data-buy]'); if (!b) return;
    const p = PACKS.find(x => x.id === b.dataset.buy);
    if (gold < p.price) return;
    gold -= p.price; saveOwned(); sfx('coin', .5);
    showOpening(p, openPack(p));
  });
  // ---------------------------------------------------------------- pack opening (ported from Odds & Ends' Rip & Ship)
  // Tear the foil with a finger: where the first drag starts picks the cut
  // (top band = slice the cap, bottom = peel the footer, either edge = zip
  // down the side, the middle = pinch it open, anywhere else = a slash that
  // locks to the finger's direction). Progress only counts travel ALONG the
  // cut. When the foil gives, the pack splits, the cards are dealt into a
  // spread, and anything new or Rare+ waits face-down for a tap.
  const PK_W = 236, PK_H = 378;
  const PK_HINT = {
    top: 'Slicing the cap. Keep dragging across.', bottom: 'Peeling the footer. Keep dragging across.',
    left: 'Zipping the left edge. Drag down the side.', right: 'Zipping the right edge. Drag down the side.',
    slash: 'Slashing the foil. Drag it through.', pinch: 'Pinching it open. Work the middle.' };
  const RNAME = ['Common', 'Rare', 'Epic', 'Legendary'], RCOL = ['#c9c2d8', '#4fa3ff', '#c27bff', '#ff9d2e'];
  const SIGILS = ['', 'blue', 'purple', 'gold'];
  let PO = null;
  const pkImg = p => `img/pack_${p.id}.webp`;
  function pkPt(pk, e) { const r = pk.getBoundingClientRect(); return { x: (e.clientX - r.left) * PK_W / r.width, y: (e.clientY - r.top) * PK_H / r.height }; }
  function pkPickCut(p) {
    const fx = p.x / PK_W, fy = p.y / PK_H;
    if (fy < 0.15) return { kind: 'top', px: 8, py: 32, ux: 1, uy: 0, nx: 0, ny: -1, ang: 0, len: PK_W * 0.94, rate: 220 };
    if (fy > 0.85) return { kind: 'bottom', px: 8, py: 342, ux: 1, uy: 0, nx: 0, ny: 1, ang: 0, len: PK_W * 0.94, rate: 240 };
    if (fx < 0.16) return { kind: 'left', px: 12, py: 8, ux: 0, uy: 1, nx: -1, ny: 0, ang: 90, len: PK_H * 0.96, rate: 240 };
    if (fx > 0.84) return { kind: 'right', px: PK_W - 12, py: 8, ux: 0, uy: 1, nx: 1, ny: 0, ang: 90, len: PK_H * 0.96, rate: 240 };
    if (fx > 0.32 && fx < 0.68 && fy > 0.36 && fy < 0.66) {
      const a = (fx - 0.5) * 50 * Math.PI / 180;
      return { kind: 'pinch', px: PK_W / 2, py: PK_H / 2, ux: Math.cos(a), uy: Math.sin(a), nx: -Math.sin(a), ny: Math.cos(a), ang: a * 180 / Math.PI, len: PK_W * 1.15, rate: 150, free: true };
    }
    return { kind: 'slash', px: p.x, py: p.y, ux: 0, uy: 0, nx: 0, ny: 1, ang: null, len: 0, rate: 1e9, sx: 0, sy: 0 };
  }
  function pkLockSlash(cut, ux, uy) {
    cut.ux = ux; cut.uy = uy; cut.nx = -uy; cut.ny = ux;
    cut.ang = Math.atan2(uy, ux) * 180 / Math.PI;
    let L = 1e9;
    if (ux > 0.001) L = Math.min(L, (PK_W - cut.px) / ux);
    if (ux < -0.001) L = Math.min(L, -cut.px / ux);
    if (uy > 0.001) L = Math.min(L, (PK_H - cut.py) / uy);
    if (uy < -0.001) L = Math.min(L, -cut.py / uy);
    cut.len = Math.max(40, L); cut.rate = Math.max(140, cut.len * 0.85);
  }
  function pkTearVars(pk, cut) {
    pk.style.setProperty('--px', cut.px.toFixed(1) + 'px');
    pk.style.setProperty('--py', cut.py.toFixed(1) + 'px');
    pk.style.setProperty('--ang', (cut.ang === null ? 0 : cut.ang).toFixed(1) + 'deg');
  }
  function pkBuzz(pat) { try { if (navigator.vibrate) navigator.vibrate(pat); } catch (e) { } }
  // everything but the cap slice splits the foil into two clipped copies along the cut
  function pkSplit(pk, cut) {
    const L = 1200;
    const poly = s => [[cut.px - cut.ux * L, cut.py - cut.uy * L], [cut.px + cut.ux * L, cut.py + cut.uy * L],
      [cut.px + cut.ux * L + cut.nx * s * L, cut.py + cut.uy * L + cut.ny * s * L],
      [cut.px - cut.ux * L + cut.nx * s * L, cut.py - cut.uy * L + cut.ny * s * L]].map(q => q[0].toFixed(0) + 'px ' + q[1].toFixed(0) + 'px').join(',');
    const nx = cut.nx, ny = cut.ny;
    const M = { bottom: { a: [0, -8, 0, .9], b: [0, 150, 12, 0] }, left: { a: [10, 0, 0, .9], b: [-110, -30, -28, 0] }, right: { a: [-10, 0, 0, .9], b: [110, -30, 28, 0] },
      slash: { a: [-nx * 30, -ny * 30, -5, .35], b: [nx * 30, ny * 30, 5, .35] }, pinch: { a: [-nx * 42, -ny * 42, -6, .3], b: [nx * 42, ny * 42, 6, .3] } }[cut.kind];
    if (!M) return;
    pk.querySelectorAll('.pk-cap,.pk-body').forEach(el => { el.style.visibility = 'hidden'; });
    [['a', -1, M.a], ['b', 1, M.b]].forEach(([id, s, t]) => {
      const h = document.createElement('div');
      h.className = 'pk-half pk-half-' + id;
      h.style.backgroundImage = `url(${pkImg(PO.p)})`;
      h.style.clipPath = 'polygon(' + poly(s) + ')';
      h.style.setProperty('--tx', t[0].toFixed(1) + 'px'); h.style.setProperty('--ty', t[1].toFixed(1) + 'px');
      h.style.setProperty('--tr', t[2] + 'deg'); h.style.setProperty('--to', t[3]);
      pk.appendChild(h);
    });
  }

  // the fx layer: sparks, stars, puffs and rings on one canvas over the overlay
  let fxCv = null, fxG = null, fxP = [], fxRun = false;
  function fxEnsure() {
    const ov = $('#packopen'); if (!ov) return null;
    if (!fxCv || fxCv.parentElement !== ov) { fxCv = document.createElement('canvas'); fxCv.id = 'pkFx'; ov.appendChild(fxCv); fxG = fxCv.getContext('2d'); }
    const w = ov.clientWidth, h = Math.max(ov.clientHeight, ov.scrollHeight); if (fxCv.width !== w || fxCv.height !== h) { fxCv.width = w; fxCv.height = h; }
    return fxG;
  }
  function fxLoop() {
    if (!fxRun) return;
    requestAnimationFrame(fxLoop);
    const g = fxG; if (!g) return;
    g.clearRect(0, 0, fxCv.width, fxCv.height);
    for (let i = fxP.length - 1; i >= 0; i--) {
      const p = fxP[i];
      p.life -= 1 / 60;
      if (p.life <= 0) { fxP.splice(i, 1); continue; }
      p.x += p.vx / 60; p.y += p.vy / 60;
      if (p.kind !== 'ring') p.vy += 340 * p.g / 60;
      const a = Math.min(1, p.life / (p.max * 0.55));
      if (p.kind === 'spark') { g.globalAlpha = a; g.fillStyle = p.col; g.save(); g.translate(p.x, p.y); g.rotate(p.rot += p.vr / 60); g.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.4); g.restore(); }
      else if (p.kind === 'star') { g.globalAlpha = a; g.fillStyle = p.col; g.font = `${p.s}px system-ui`; g.textAlign = 'center'; g.fillText('✦', p.x, p.y); }
      else if (p.kind === 'puff') { g.globalAlpha = a * 0.5; g.fillStyle = p.col; g.beginPath(); g.arc(p.x, p.y, p.s * (1.6 - p.life / p.max), 0, 7); g.fill(); }
      else if (p.kind === 'ring') { g.globalAlpha = a; g.strokeStyle = p.col; g.lineWidth = 4 * a + 1; g.beginPath(); g.arc(p.x, p.y, p.s * (1 - p.life / p.max) * 2.4 + 6, 0, 7); g.stroke(); }
    }
    g.globalAlpha = 1;
    if (!fxP.length) { fxRun = false; g.clearRect(0, 0, fxCv.width, fxCv.height); }
  }
  function fx(list) { if (!fxEnsure()) return; fxP.push(...list); if (!fxRun) { fxRun = true; fxLoop(); } }
  function burst(x, y, col, opts) {
    const o = Object.assign({ n: 26, sp: 260, kind: 'spark', s: 7, g: 1, life: 0.9 }, opts || {});
    const out = [];
    for (let i = 0; i < o.n; i++) {
      const a = Math.random() * 6.283, v = o.sp * (0.35 + Math.random() * 0.75);
      out.push({ kind: o.kind, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - o.sp * 0.25, s: o.s * (0.6 + Math.random() * 0.9), col: Array.isArray(col) ? col[i % col.length] : col,
        g: o.g, life: o.life * (0.6 + Math.random() * 0.6), max: o.life, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 14 });
    }
    fx(out);
  }
  function poof(x, y, col) {
    fx([{ kind: 'ring', x, y, s: 60, col, life: 0.55, max: 0.55, vx: 0, vy: 0, g: 0 }]);
    burst(x, y, ['#e8e2d6', '#cfc6b4', col], { n: 12, sp: 120, kind: 'puff', s: 16, g: -0.12, life: 0.85 });
  }
  function ovXY(el, fx_, fy_) { const r = el.getBoundingClientRect(), o = $('#packopen').getBoundingClientRect(); return [r.left - o.left + r.width * fx_, r.top - o.top + $('#packopen').scrollTop + r.height * fy_]; }
  function burstOn(el, g) {
    try {
      const [cx, cy] = ovXY(el, .5, .5), col = RCOL[g.r];
      if (g.r === 3) { poof(cx, cy, col); burst(cx, cy, [col, '#ffd35c', '#ffffff'], { n: 40, sp: 380, kind: 'star', s: 18, g: 0.35, life: 1.5 }); burst(cx, cy, [col, '#ffd35c'], { n: 24, sp: 280, s: 7, life: 1.2 }); }
      else if (g.r === 2) { poof(cx, cy, col); burst(cx, cy, [col, '#ffd35c'], { n: 24, sp: 280, kind: 'star', s: 14, g: 0.5, life: 1.1 }); }
      else if (g.r === 1) burst(cx, cy, [col, '#e8e2d6'], { n: 16, sp: 220, s: 6, life: 0.9 });
      else burst(cx, cy, [col], { n: 8, sp: 150, s: 4, life: 0.7 });
      if (g.r >= 1) {
        const box = $('#packopen .pk-box');
        if (box) {
          const im = document.createElement('img');
          im.className = 'pk-sigil' + (g.r === 3 ? ' big' : ''); im.alt = '';
          im.src = `img/sigil_${SIGILS[g.r]}${Math.floor(Math.random() * 3)}.webp`;
          const [sx, sy] = (() => { const r = el.getBoundingClientRect(), b = box.getBoundingClientRect(); return [r.left - b.left + r.width / 2, r.top - b.top + r.height / 2]; })();
          im.style.left = sx + 'px'; im.style.top = sy + 'px';
          box.appendChild(im);
          setTimeout(() => im.remove(), 1600);
        }
      }
    } catch (e) { }
  }
  function revealSfx(g) {
    sfx('pk_r' + g.r, g.r >= 2 ? .6 : .45);
    if (g.isNew) setTimeout(() => sfx('pk_new', .35), 180);
  }

  function showOpening(p, got) {
    PO = { p, got, stage: 'rip', tear: 0, cut: null, down: got.map(g => g.isNew || g.r >= 1), dealt: false };
    const o = $('#packopen');
    o.onclick = opClick;
    o.hidden = false;
    pkRender();
  }
  function pkRender() {
    const o = $('#packopen'), P = PO; if (!P) return;
    const keepFx = fxCv && fxCv.parentElement === o ? fxCv : null;
    if (P.stage === 'rip') {
      o.innerHTML = `<div class="pk-box"><h3>${esc(P.p.name)}</h3>
        <div class="pk-pack" id="pkPack" style="--pc:${P.p.col}">
          <div class="pk-cap" style="background-image:url(${pkImg(P.p)})"></div>
          <div class="pk-body" style="background-image:url(${pkImg(P.p)})"></div>
          <div class="pk-tearline"></div>
        </div>
        <p class="pk-hint">Tear it open: slice the top, zip an edge, slash across, or pinch the middle.</p>
        <button class="linkbtn" data-op="skip">Skip the tear</button></div>`;
      const pk = $('#pkPack');
      let last = null, cut = P.cut;
      const tick = e => {
        if (!PO || PO.stage !== 'rip' || !cut) return;
        const pt = pkPt(pk, e);
        if (last) {
          const dx = pt.x - last.x, dy = pt.y - last.y;
          let along;
          if (cut.free) along = Math.hypot(dx, dy);
          else if (cut.ang === null) {
            cut.sx += dx; cut.sy += dy;
            const h = Math.hypot(cut.sx, cut.sy);
            if (h < 14) { last = pt; return; }
            pkLockSlash(cut, cut.sx / h, cut.sy / h); pkTearVars(pk, cut);
            along = h;
          } else along = Math.abs(dx * cut.ux + dy * cut.uy);
          const before = P.tear;
          P.tear = Math.min(1, P.tear + along / cut.rate);
          if (Math.floor(P.tear * 8) !== Math.floor(before * 8)) pkBuzz(6);
        }
        last = pt;
        pk.style.setProperty('--tn', (P.tear * 100).toFixed(1));
        pk.style.setProperty('--len', (P.tear * cut.len).toFixed(1) + 'px');
        if (P.tear >= 1) ripDone();
      };
      pk.onpointerdown = e => {
        if (!PO || PO.stage !== 'rip') return;
        const pt = pkPt(pk, e);
        if (!cut) {
          cut = P.cut = pkPickCut(pt);
          pk.dataset.tear = cut.kind; pkTearVars(pk, cut);
          const hint = o.querySelector('.pk-hint'); if (hint) hint.textContent = PK_HINT[cut.kind];
        }
        P.tearing = true; last = pt;
        try { pk.setPointerCapture(e.pointerId); } catch (_) { }
        if (cut.kind === 'top') P.tear = Math.min(1, P.tear + 0.2);
        else if (cut.ang !== null && P.tear === 0) P.tear = 0.1;
        tick(e);
      };
      pk.onpointermove = e => { if (PO && PO.tearing) tick(e); };
      pk.onpointerup = pk.onpointercancel = () => { if (PO) PO.tearing = false; last = null; };
    } else {
      const downN = P.down.filter(Boolean).length;
      const deal = !P.dealt; P.dealt = true;
      const extra = P.got.reduce((a, g) => a + g.extra, 0);
      o.innerHTML = `<div class="pk-box wide"><h3>${esc(P.p.name)}</h3>
        <p class="pk-hint">${downN ? `Tap a card to turn it over. ${downN} still face down.` : extra ? `All revealed. Extra copies paid ${extra} gold.` : 'All revealed!'}</p>
        <div class="pk-spread${deal ? ' deal' : ''}">${P.got.map((g, i) => {
          const c = E.card(g.id);
          if (P.down[i]) return `<div class="pk-sp down" data-i="${i}" style="--d:${i}"><button class="pk-back" data-flip="${i}" aria-label="Turn over card ${i + 1}"><i class="pk-glow"></i><span class="pk-ll">LL</span><span class="pk-q">?</span></button><div class="pk-tag hid">tap to turn</div></div>`;
          return `<div class="pk-sp${g.r === 3 ? ' leg' : ''}" data-i="${i}" style="--d:${i};--rc:${RCOL[g.r]}">${cardHTML(c)}
            <div class="pk-tag ${g.isNew ? 'new' : g.extra ? 'dup' : ''}"><span class="rn" style="color:${RCOL[g.r]}">${RNAME[g.r]}</span> ${g.isNew ? 'New!' : g.extra ? `Extra copy +${g.extra} gold` : 'Another copy'}</div></div>`;
        }).join('')}</div>
        <div class="row">${downN ? '<button class="big alt" data-op="all">Turn them all over</button>' : `<button class="big" data-op="again" ${gold < P.p.price ? 'disabled' : ''}>Open another (${P.p.price} gold)</button><button class="big alt" data-op="close">Done</button>`}</div>
        <p class="reward">${gold.toLocaleString()} gold</p></div>`;
    }
    if (keepFx) o.appendChild(keepFx);
  }
  function ripDone() {
    const P = PO; if (!P || P.ripping) return;
    P.ripping = true;
    const pk = $('#pkPack');
    sfx('pk_tear', .5);
    if (pk) {
      pk.classList.add('sliced');
      const cut = P.cut;
      if (cut && cut.kind !== 'top') { try { pkSplit(pk, cut); } catch (e) { } }
      pkBuzz([18, 24, 42]);
      try {
        const side = cut && cut.kind !== 'top';
        const sx = side ? (cut.px + cut.ux * cut.len * 0.5) / PK_W : 0.5, sy = side ? (cut.py + cut.uy * cut.len * 0.5) / PK_H : 0.09;
        const [cx, cy] = ovXY(pk, sx, sy);
        poof(cx, cy, '#ffd35c');
        burst(cx, cy, ['#ffd35c', '#ff9a5c', '#e8e2d6', `rgb(${P.p.col})`], { n: 34, sp: 330, s: 8, life: 1.1 });
      } catch (e) { }
      setTimeout(() => { if (PO !== P) return; P.ripping = false; P.stage = 'spread'; pkRender(); }, 620);
    } else { P.ripping = false; P.stage = 'spread'; pkRender(); }
  }
  function pkReveal(i) {
    const P = PO; if (!P || !P.down[i] || P.flipping) return;
    P.flipping = true;
    sfx('pk_flip', .4);
    const cell = $(`#packopen .pk-sp[data-i="${i}"]`);
    if (cell) cell.classList.add('flip');
    setTimeout(() => {
      if (PO !== P) return;
      P.flipping = false; P.down[i] = false;
      pkRender();
      const el = $(`#packopen .pk-sp[data-i="${i}"]`);
      if (el) { el.classList.add('just'); burstOn(el, P.got[i]); }
      revealSfx(P.got[i]);
    }, 140);
  }
  function pkRevealAll() {
    const P = PO; if (!P) return;
    const idx = [];
    P.down.forEach((d, i) => { if (d) { P.down[i] = false; idx.push(i); } });
    if (!idx.length) return;
    sfx('pk_all', .4);
    pkRender();
    let top = null;
    idx.forEach((i, k) => {
      const g = P.got[i];
      if (!top || g.r > top.r) top = g;
      setTimeout(() => { if (PO !== P) return; const el = $(`#packopen .pk-sp[data-i="${i}"]`); if (el) { el.classList.add('just'); burstOn(el, g); } }, 90 * k);
    });
    if (top) revealSfx(top);
  }
  function opClick(e) {
    const f = e.target.closest('[data-flip]');
    if (f) { pkReveal(+f.dataset.flip); return; }
    const b = e.target.closest('[data-op]'); if (!b || !PO) return;
    const op = b.dataset.op, p = PO.p;
    if (op === 'skip') { if (PO.stage === 'rip') { if (!PO.cut) PO.cut = pkPickCut({ x: PK_W / 2, y: 10 }); ripDone(); } }
    else if (op === 'all') pkRevealAll();
    else if (op === 'again') { if (gold < p.price) return; gold -= p.price; saveOwned(); sfx('coin', .5); showOpening(p, openPack(p)); }
    else if (op === 'close') { PO = null; fxP.length = 0; $('#packopen').hidden = true; renderShop(); }
  }

  // ================================================================= CAMPAIGN
  // Story mode: one campaign per class (js/campaign.js), four chapters each, plus a finale once all six are beaten.
  // Progress is ll_camp: { <class>: chapters cleared, finale: 0|1 }.
  const CAMP = window.LL_CAMPAIGN || { order: [], stories: {} };
  let camp = store.get('ll_camp', {});
  const saveCamp = () => store.set('ll_camp', camp);
  const CH_GOLD = [100, 150, 200, 300];
  let campView = null; // null = list of campaigns, else a story key
  const storyOf = k => k === 'finale' ? CAMP.finale : CAMP.stories[k];
  const allSix = () => CAMP.order.every(k => (camp[k] || 0) >= CAMP.stories[k].chapters.length);

  // a speaker spec -> { name, art, cls }
  function who(spec) {
    if (!spec || spec === 'n') return null;
    const [base, rename] = spec.split('=');
    const [k, id] = base.split(':');
    if (k === 'h') { const h = D.heroes[id]; return h && { name: rename || h.n, art: h.art, cls: id }; }
    const c = k === 't' ? D.tokens[id] : E.card(id);
    return c && { name: rename || c.n, art: c.art, cls: c.c || 'neutral' };
  }
  const portrait = (w, big) => w ? `<div class="cport${big ? ' lg' : ''}" style="${artCSS(w.art)};--cc:${CCOL(w.cls)}"></div>` : '';

  function renderCampaign() {
    const box = $('#campbody');
    if (!campView) {
      const tiles = CAMP.order.map(k => {
        const s = CAMP.stories[k], n = s.chapters.length, done = Math.min(n, camp[k] || 0), w = who(s.hero), rc = E.card(s.reward.card);
        return `<button class="ctile${done >= n ? ' done' : ''}" data-story="${k}" style="--cc:${CCOL(k)}">
          ${portrait(w, true)}<div class="ct"><small>${esc(CLSN[k])} · ${esc(CLSG[k])}</small><b>${esc(s.title)}</b><span>${esc(s.blurb)}</span>
          <span class="pips">${s.chapters.map((_, i) => `<i class="${i < done ? 'on' : ''}"></i>`).join('')}<em>${done >= n ? 'Complete' : `${done} of ${n}`}</em></span>
          <span class="rw">Reward: ${rc ? esc(rc.n) : ''} + ${s.reward.gold} gold</span></div></button>`;
      }).join('');
      const f = CAMP.finale, open = allSix(), fdone = (camp.finale || 0) >= 1;
      const ftile = f ? `<button class="ctile finale${open ? '' : ' locked'}${fdone ? ' done' : ''}" data-story="finale" ${open ? '' : 'aria-disabled="true"'} style="--cc:255,215,90">
        ${portrait(who(f.chapters[0].foe.who), true)}<div class="ct"><small>Finale</small><b>${esc(f.title)}</b>
        <span>${open ? esc(f.blurb) : 'Beat all six campaigns to open the finale.'}</span>
        <span class="rw">${fdone ? 'Complete' : `Reward: ${esc(E.card(f.reward.card).n)} + ${f.reward.gold} gold`}</span></div></button>` : '';
      box.innerHTML = `<p class="campintro">Every class has its own story: four battles, cutscenes before and after each, and a boss with more Health at the end. You play your own decks of that class.</p><div class="cgrid">${tiles}${ftile}</div>`;
      return;
    }
    const s = storyOf(campView), k = campView, done = camp[k] || 0;
    box.innerHTML = `<div class="chead" style="--cc:${CCOL(k === 'finale' ? 'neutral' : k)}">${portrait(who(s.hero), true)}<div><h3>${esc(s.title)}</h3><p>${esc(s.blurb)}</p>
        <button class="small" data-campback>All campaigns</button></div></div>
      <div class="clist">${s.chapters.map((ch, i) => {
        const fw = who(ch.foe.who), state = i < done ? 'won' : i === done ? 'next' : 'locked';
        return `<div class="chap ${state}${ch.boss ? ' boss' : ''}">${portrait(fw)}
          <div class="cinfo"><small>Chapter ${i + 1}${ch.boss ? ' · Boss' : ''}</small><b>${esc(ch.title)}</b>
          <span>vs ${esc(fw.name)} · ${ch.foe.hp} Health${state === 'won' ? ' · Won' : ''}</span></div>
          <div class="cbtns">${state === 'locked' ? '<span class="lock">Locked</span>' :
            `<button class="big${state === 'won' ? ' alt' : ''}" data-chap="${i}">${state === 'won' ? 'Replay' : 'Play'}</button>`}
            ${state === 'won' ? `<button class="small" data-watch="${i}">Watch scenes</button>` : ''}</div></div>`;
      }).join('')}</div>`;
  }
  $('#campbody').addEventListener('click', e => {
    const st = e.target.closest('[data-story]');
    if (st) { if (st.getAttribute('aria-disabled')) return; campView = st.dataset.story; sfx('click', .4); renderCampaign(); $('#campaign .body').scrollTop = 0; return; }
    if (e.target.closest('[data-campback]')) { campView = null; renderCampaign(); return; }
    const w = e.target.closest('[data-watch]');
    if (w) { const ch = storyOf(campView).chapters[+w.dataset.watch]; playScene(ch, +w.dataset.watch, 'intro').then(() => playScene(ch, +w.dataset.watch, 'outro', true)); return; }
    const c = e.target.closest('[data-chap]');
    if (c) pickCampDeck(campView, +c.dataset.chap);
  });
  $('#b-camp').onclick = () => { sfx('click', .4); campView = null; show('campaign'); };

  // choose which of your decks to bring (only asks when there is more than one)
  function pickCampDeck(k, i) {
    const ch = storyOf(k).chapters[i];
    const okDeck = d => E.validateDeck(d.cards, d.cls).length === 0 && (ch.anyDeck || d.cls === k);
    const list = decks.filter(okDeck).concat(STARTERS.filter(okDeck));
    const go = d => playScene(ch, i, 'intro').then(() => startCampBattle(k, i, d));
    if (list.length <= 1) { go(list[0] || STARTERS.find(d => d.cls === k) || STARTERS[0]); return; }
    const m = $('#campdeck');
    m.innerHTML = `<div class="cdbox"><h3>Bring which deck?</h3><p>${ch.anyDeck ? 'Any of your decks can fight the finale.' : `Your ${esc(CLSN[k])} decks.`}</p>
      <div class="deckgrid">${list.map(d => deckBox(d, d.id === chosenDeck, `data-cdeck="${d.id}"`)).join('')}</div>
      <p><button class="small" data-cdx>Cancel</button></p></div>`;
    m.hidden = false;
    m.onclick = e => {
      const b = e.target.closest('[data-cdeck]');
      if (b) { m.hidden = true; go(list.find(d => d.id === b.dataset.cdeck)); return; }
      if (e.target.closest('[data-cdx]') || e.target === m) m.hidden = true;
    };
  }

  // the boss: a random deck of its class with its signature cards shuffled in
  function bossDeck(foe) {
    const d = E.randomDeck(null, foe.cls, Math.random);
    const sig = (foe.sig || []).filter(id => E.card(id));
    const keep = d.filter(id => !sig.includes(id));
    const cut = Math.max(0, keep.length + sig.length - 30);
    for (let k = 0; k < cut; k++) keep.splice(Math.floor(Math.random() * keep.length), 1);
    return keep.concat(sig).slice(0, 30);
  }
  function startCampBattle(k, i, myDeck) {
    const ch = storyOf(k).chapters[i], fw = who(ch.foe.who);
    startBattle(myDeck, ch.foe.cls, { k, i, deck: bossDeck(ch.foe), name: fw.name, art: fw.art, hp: ch.foe.hp, bg: ch.bg });
  }
  // after a campaign battle: rewards on a first win, then the outro
  function campEnd(won) {
    const c = G.camp, s = storyOf(c.k), ch = s.chapters[c.i];
    const first = won && (camp[c.k] || 0) === c.i;
    let lines = [];
    if (first) {
      camp[c.k] = c.i + 1; saveCamp();
      const g = c.k === 'finale' ? 0 : CH_GOLD[Math.min(c.i, CH_GOLD.length - 1)];
      gold += g; if (g) lines.push(`Chapter cleared: +${g} gold`);
      if (camp[c.k] >= s.chapters.length) {
        const rc = E.card(s.reward.card);
        gold += s.reward.gold;
        if (rc) { owned[rc.id] = Math.max(owned[rc.id] || 0, 1); }
        lines.push(`Campaign complete: ${rc ? rc.n + ' added to your collection, ' : ''}+${s.reward.gold} gold`);
        if (c.k !== 'finale' && allSix() && !(camp.finale >= 1)) lines.push('All six campaigns beaten: the Finale is open!');
      }
      saveOwned();
    }
    return { first, lines, ch };
  }

  // ---------- cutscenes ----------
  function playScene(ch, idx, part, skipTitle) {
    return new Promise(resolve => {
      const lines = (ch[part] || []).slice();
      if (!lines.length) { resolve(); return; }
      const cs = $('#cutscene');
      const bg = D.boards[ch.bg] || D.boards.bg_core;
      cs.innerHTML = `<div class="cs-bg" style="background-image:url(${bg})"></div><div class="cs-shade"></div>
        <div class="cs-stage"><div class="cs-p l"></div><div class="cs-p r"></div></div>
        <div class="cs-box"><div class="cs-name"></div><div class="cs-text"></div><div class="cs-next" aria-hidden="true">▼</div></div>
        <button class="small cs-skip">Skip</button><div class="cs-flash"></div>
        ${skipTitle ? '' : `<div class="cs-title"><small>${part === 'intro' ? `Chapter ${idx + 1}` : 'Afterward'}</small><b>${esc(ch.title)}</b></div>`}`;
      cs.hidden = false; cs.classList.remove('out');
      playMusic('title');
      let n = -1, typing = null, full = '', done = false;
      const side = { l: null, r: null };
      const finish = () => {
        if (done) return; done = true; clearInterval(typing);
        cs.classList.add('out'); document.removeEventListener('keydown', key);
        setTimeout(() => { cs.hidden = true; resolve(); }, 260);
      };
      const next = () => {
        if (typing) { clearInterval(typing); typing = null; $('#cutscene .cs-text').textContent = full; return; }
        n++;
        if (n >= lines.length) { finish(); return; }
        const [sd, spec, text, fx] = lines[n];
        const w = who(spec), name = $('#cutscene .cs-name'), tx = $('#cutscene .cs-text'), box = $('#cutscene .cs-box');
        $$('#cutscene .cs-p').forEach(p => p.classList.remove('on'));
        if (w) {
          const p = $(`#cutscene .cs-p.${sd}`);
          if (side[sd] !== spec) { side[sd] = spec; p.innerHTML = portrait(w, true); p.classList.remove('in'); void p.offsetWidth; p.classList.add('in'); }
          p.classList.add('on');
          if (fx === 'pop') { p.classList.remove('pop'); void p.offsetWidth; p.classList.add('pop'); }
          name.textContent = w.name; name.hidden = false; name.style.setProperty('--cc', CCOL(w.cls));
          box.classList.toggle('right', sd === 'r'); box.classList.remove('narr');
        } else { name.hidden = true; box.classList.add('narr'); box.classList.remove('right'); }
        if (fx === 'shake') { cs.classList.remove('shake'); void cs.offsetWidth; cs.classList.add('shake'); sfx('crit', .35); }
        if (fx === 'flash') { const f = $('#cutscene .cs-flash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); sfx('relic', .45); }
        full = text; tx.textContent = '';
        let k = 0;
        typing = setInterval(() => { k += 2; tx.textContent = full.slice(0, k); if (k >= full.length) { clearInterval(typing); typing = null; } }, 24);
      };
      const key = e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); next(); } else if (e.key === 'Escape') finish(); };
      document.addEventListener('keydown', key);
      cs.onclick = e => { if (e.target.closest('.cs-skip')) { finish(); return; } const t = $('#cutscene .cs-title'); if (t && !t.classList.contains('gone')) { t.classList.add('gone'); next(); return; } next(); };
      const t = $('#cutscene .cs-title');
      if (t) { sfx('fightstart', .3); setTimeout(() => { if (!t.classList.contains('gone') && !done && n < 0) { t.classList.add('gone'); next(); } }, 1800); }
      else next();
    });
  }

  // ---------------------------------------------------------------- boot
  $('#b-sound').textContent = 'Sound: ' + (soundOn ? 'on' : 'off');
  const h = (location.hash || '').replace('#', '');
  show(['collection', 'play', 'rules', 'shop', 'campaign'].includes(h) ? h : 'menu');
})();
