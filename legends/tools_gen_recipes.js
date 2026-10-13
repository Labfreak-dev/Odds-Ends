// Pre-made decks ("recipes"): twelve themed decks, two per class, that players can copy and finish.
//   node legends/tools_gen_recipes.js            -> writes data/recipes.js, then tests every recipe in bot games
// Each recipe names its key cards by hand (the cards the deck is about), says what counts as a fit
// (its tribe, keyword or mechanic) and what counts as a payoff (cards whose abilities care about that).
// The rest of the 30 is filled from fits and payoffs first, by card power (data/meta.js), on a mana curve.
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname);
const L = require(ROOT + '/js/engine.js');
const load = f => { const s = fs.readFileSync(ROOT + f, 'utf8'); return JSON.parse(s.slice(s.indexOf('=') + 1, s.lastIndexOf(';'))); };
const D = load('/data/cards.js'); L.setData(D);
const P = load('/data/meta.js').power;
const COL = D.cards.filter(c => !c.token);
const byName = n => { const c = COL.find(x => x.n === n); if (!c) throw new Error('no card named ' + n); return c; };
const refs = (c, ...tags) => { const s = JSON.stringify([c.fx || [], c.cred || null, c.q || null, c.ch || null]); return tags.some(t => s.includes('"' + t + '"')); };
const ops = (c, ...o) => (c.fx || []).concat(...(c.ch || []).map(x => x.fx)).some(e => o.includes(e.op));
const kw = (c, k) => (c.kw || []).includes(k);
const tr = (c, ...t) => t.includes(c.tr);

// curve: how many cards at each cost (0-1, 2, 3, 4, 5, 6, 7+)
const CURVE = { aggro: [5, 7, 6, 5, 3, 2, 2], mid: [4, 6, 6, 5, 4, 2, 3], control: [3, 5, 5, 5, 4, 4, 4] };
// at most this many spells and weapons: a deck needs a board
const MAXSPELLS = { aggro: 10, mid: 11, control: 13 };

const RECIPES = [
  { id: 'tamer_beasts', cls: 'tamer', name: 'Beast Pack', curve: 'aggro',
    blurb: 'Flood the board with Beasts, search them out of your deck and make them cheaper, then finish the Quest for Quetzalcoatl.',
    plan: 'Play the Quest on turn one. Keep the board full of Beasts so Sabre Strike draws and the lords grow your team. Every Beast you play counts toward the Feathered Serpent.',
    core: [['Return of the Feathered Serpent', 1], ['Seed of Plenty', 2], ['Sabre Strike', 2], ['Honeypot', 2], ['Flying Squirrel', 2], ['Cockroach', 2], ['Betta Fish', 1], ['Bastet', 2]],
    fit: c => tr(c, 'Beast'), pay: c => refs(c, 'Beast') },
  { id: 'tamer_growth', cls: 'tamer', name: 'Wild Growth', curve: 'mid',
    blurb: 'Choose One cards, Bloom and Tide creatures, and the Horned Lord. Every card bends to what the board needs.',
    plan: 'Use the Choose One cards to answer what your opponent does: removal when they have a threat, minions or buffs when they don\'t. Bloom and Tide minions buff each other; Cernunnos keeps the board full late.',
    core: [['Demeter, Harvest Mother', 2], ['Artemis, the Huntress', 1], ["Brigid's Flame", 2], ['Cernunnos, the Horned Lord', 1], ['Pixie Dust', 2], ['Worldoak', 2], ['Bramblehorn', 2]],
    fit: c => !!c.ch || (c.t === 'm' && tr(c, 'Bloom', 'Tide')), pay: c => c.t === 'm' && refs(c, 'Bloom', 'Tide') },
  { id: 'gambler_jackpot', cls: 'gambler', name: 'Jackpot', curve: 'mid',
    blurb: 'Spin! cards, Coins and lucky charms. Every pull of the lever is a little damage, a little healing or a fresh card.',
    plan: 'Spin! is never bad: it hits, heals or draws. Coins let you play two cards a turn and feed Combo effects. Dionysus and Pandora\'s Jar turn a close game into a landslide.',
    core: [['Dionysus, Revel Lord', 1], ['Lucky Drachma', 2], ['The House Itself', 1], ['Pit Boss', 2], ['Golden Grin', 2], ['Voodoo Croupier', 2], ['One-Armed Bandit', 1]],
    fit: c => c.t === 'm' && ops(c, 'gamble', 'coin', 'steal'), pay: c => c.t === 'm' && ops(c, 'gamble'), pw: 75, no: ['Epitaph'] },
  { id: 'gambler_blades', cls: 'gambler', name: 'Cutthroat Blades', curve: 'aggro',
    blurb: 'Weapons, poison and stolen cards. Your hero does the fighting while Loki empties their hand.',
    plan: 'Keep a weapon equipped: Shady Contract and Straight Razor get better with one. Twin Knives and Poison Vial make a minion Deadly. Loki steals two cards and keeps stealing every turn.',
    core: [['Shady Contract', 2], ['Wrist Blades', 2], ['Twin Knives', 2], ['Coin Dagger', 2], ['Gilded Scimitar', 1], ['Straight Razor', 2], ['Poison Vial', 2], ['Loki, Trickster King', 1], ['Tezcatlipoca, Smoking Mirror', 1], ['Gilded Letter Opener', 2]],
    fit: c => c.t === 'w' || ops(c, 'steal') || kw(c, 'poisonous'), pay: c => refs(c, 'weapon') || ops(c, 'equip', 'hatk'), weapons: true,
    no: ['Death, the Dealer'] },
  { id: 'healer_party', cls: 'healer', name: 'The Unthanked Party', curve: 'mid',
    blurb: 'Wren\'s whole ungrateful party, the Signature heroes who cheer each other on, and Hathor\'s Feast.',
    plan: 'Play the Quest early, then party members. Prayer Beads and the party heroes buff every member; Thank-You Note draws a card for each. Ambrosia restores you and boosts the whole table.',
    core: [["Hathor's Feast", 1], ['Prayer Beads', 2], ['Thank-You Note', 2], ['Scripture', 2]],
    fit: c => tr(c, 'Party', 'Signature', 'Swarm'), pay: c => refs(c, 'Party', 'Signature') },
  { id: 'healer_wall', cls: 'healer', name: 'Holy Wall', curve: 'control',
    blurb: 'Shields, Guards and endless healing. Nothing gets through, and Isis outlasts everything.',
    plan: 'Trade early with Guard minions and protect them with Shield. Heal the important ones back up. Apollo and Isis swing the long game; Smite the Mighty handles their biggest threat.',
    core: [['Blessed Ward', 2], ['Steadfast Clasp', 2], ['Holy Water', 2], ['Baldr, the Beloved', 1], ['Apollo, Sun Healer', 1], ['Isis, Mother of Magic', 1], ['Smite the Mighty', 2], ['Woolen Poncho', 2], ['Hestia, Keeper of the Hearth', 2]],
    fit: c => kw(c, 'divine') || kw(c, 'taunt') || ops(c, 'heal', 'aoe_heal'), pay: c => refs(c, 'taunt', 'divine') || ops(c, 'aoe_heal'), no: ['Dr. Labfreak'] },
  { id: 'collector_mechs', cls: 'collector', name: 'Mech Workshop', curve: 'mid',
    blurb: 'Machines that fuse together. Magnetic Mechs stack onto each other and Athena upgrades every new one.',
    plan: 'Play the Golden Paperclip first. Get a sturdy Mech down, then fuse Magnetic Mechs into it for one huge threat. Hephaestus forges a new Mech every turn.',
    core: [['The Golden Paperclip', 1], ['Athena, Owl-Eyed', 1], ['Hephaestus, Forgemaster', 1], ["Dragon's Eye", 2], ['Gilded Crown', 2], ['Walkman Automaton', 2], ['Typewriter Golem', 2], ['Brick Phone Drone', 2], ['Click-Wheel Mite', 2], ['Lugh of the Long Arm', 1]],
    fit: c => tr(c, 'Mech'), pay: c => refs(c, 'Mech') },
  { id: 'collector_vault', cls: 'collector', name: 'Treasure Vault', curve: 'control',
    blurb: 'Rare finds, piles of Armor and Coins. Hoard the best cards and win with Legendaries.',
    plan: 'Armor and Coins keep you alive and ahead on Mana. Appraisal draws more the rarer your board is, and Wyrmheart refills your hand once a Legendary lands.',
    core: [['Appraisal', 2], ['Wyrmheart', 2], ['Njord, Lord of Riches', 2], ['Kaleidoscope', 2], ['Brass Telescope', 2], ['Pocket Watch', 2], ['Hoard Coin', 2]],
    fit: c => (c.r || 0) >= 2 || ops(c, 'coin', 'armor'), pay: c => refs(c, 'r') },
  { id: 'scientist_spells', cls: 'scientist', name: 'Spell Lab', curve: 'control',
    blurb: 'Cheap spells, Echo spells you can cast again, and spell damage. Ten spells finish the Tablets of Destiny.',
    plan: 'Play the Quest, then cast as many spells as you can. Echo spells come back for another go the same turn; Thoth finds more spells and makes them hit harder. Marduk\'s Tempest ends it.',
    core: [['The Tablets of Destiny', 1], ['Thoth, Scribe of the Gods', 1], ['Formula X', 2], ['Lab Coat', 2], ['Void Ink', 2], ["Enlil's Gale", 2], ["Anu's Judgement", 2], ['Prometheus, Fire-Bringer', 1], ['Infernal Contract', 1]],
    fit: c => c.t === 's' || !!c.sd || ops(c, 'aura_sd'), pay: c => (c.fx || []).some(e => e.on === 'fspell') || refs(c, 's') },
  { id: 'scientist_spores', cls: 'scientist', name: 'Spores & Sparks', curve: 'aggro',
    blurb: 'Lab-grown Spore swarms charged with Static shields. Wide boards that are hard to clear.',
    plan: 'Spore Flask fills the board; Safety Goggles shields every Static minion. Go wide early and keep pressure on before they can sweep.',
    core: [['Spore Flask', 2], ['Safety Goggles', 2], ['Rubber Glove', 2], ['Soul Shard', 1]],
    fit: c => tr(c, 'Spore', 'Static', 'Gloom', 'Circuit'), pay: c => refs(c, 'Spore', 'Static', 'Gloom', 'Circuit') },
  { id: 'champion_weapons', cls: 'champion', name: 'Weapon Master', curve: 'mid',
    blurb: 'Swords, axes and Thor\'s hammer. Your hero swings every turn and the weapons keep getting better.',
    plan: 'Always have a weapon: Sword Charm finds the next one and sharpens the current one. Oath Ring and Rune Oil turn your hero into the biggest attacker on the board. Thor caps it off.',
    core: [['Thor, God of Thunder', 1], ['Sword Charm', 2], ['Rune Oil', 2], ['Oath Ring', 2], ['Throwing Axe', 2], ['Odysseus, Far-Wanderer', 2], ['Tower Greatsword', 2], ['Frenzied Axe', 1], ['Hand-Forged Cleaver', 2]],
    fit: c => c.t === 'w' || ops(c, 'hatk', 'wbuff', 'equip'), pay: c => refs(c, 'weapon', 'w'), pw: 40, weapons: true },
  { id: 'champion_lieutenants', cls: 'champion', name: 'Iron Lieutenants', curve: 'aggro',
    blurb: 'The nemeses and their lieutenants march together. Frenzy turns every hit into fuel, and the Twelve Labors rewards the carnage.',
    plan: 'Play the Quest, then lieutenants. Vow Scroll and Battle Pennant buff them all at once. Trade aggressively: every enemy minion you destroy counts toward Hercules.',
    core: [['The Twelve Labors', 1], ['Vow Scroll', 2], ['Battle Pennant', 2], ["Knight's Longsword", 2], ['Valkyrie, Chooser of the Slain', 1]],
    fit: c => tr(c, 'Lieutenant', 'Nemesis') || (c.fx || []).some(e => e.on === 'frenzy'), pay: c => refs(c, 'Lieutenant', 'Nemesis') },
];

function build(R) {
  const pool = COL.filter(c => (c.c === R.cls || c.c === 'neutral') && !(c.q && !R.core.some(([n]) => n === c.n)));
  const deck = [], cnt = {};
  const add = (c, k) => { for (let j = 0; j < k; j++) { if ((cnt[c.id] || 0) >= (c.r === 3 ? 1 : 2) || deck.length >= 30) return; deck.push(c.id); cnt[c.id] = (cnt[c.id] || 0) + 1; } };
  R.core.forEach(([n, k]) => { const c = byName(n); if (c.c !== R.cls && c.c !== 'neutral') throw new Error(`${R.name}: ${n} is a ${c.c} card`); if (k) add(c, k); });
  const score = c => ((P[c.id] || .5) - .5) * (R.pw || 50) + (R.fit(c) ? 5 : 0) + (R.pay(c) ? 7 : 0) + (c.c === R.cls ? .5 : 0);
  const nonMin = () => deck.filter(id => R.weapons ? L.card(id).t === 's' : L.card(id).t !== 'm').length;
  const bucket = m => Math.min(6, Math.max(0, m - 1));
  const want = CURVE[R.curve].slice();
  deck.forEach(id => { want[bucket(L.card(id).m)]--; });
  const no = new Set((R.no || []).map(n => byName(n).id));
  const ranked = pool.filter(c => !cnt[c.id] && !no.has(c.id) && (R.fit(c) || R.pay(c) || (P[c.id] || .5) >= .53)).sort((a, b) => score(b) - score(a));
  // fill each cost bucket with the best-scoring cards, two copies of non-Legendaries for consistency
  for (let pass = 0; pass < 2 && deck.length < 30; pass++) {
    for (const c of ranked) {
      if (deck.length >= 30) break;
      const b = bucket(c.m);
      if (pass === 0 && want[b] <= 0) continue;
      if (c.t === 's' && nonMin() >= MAXSPELLS[R.curve]) continue;
      if (c.t === 'w' && !R.weapons && nonMin() >= MAXSPELLS[R.curve]) continue;
      if (c.t === 'w' && deck.filter(id => L.card(id).t === 'w').length >= (R.weapons ? 6 : 2)) continue;
      const k = c.r === 3 ? 1 : Math.min(2, Math.max(1, pass === 0 ? want[b] : 2));
      const before = deck.length; add(c, k); want[b] -= deck.length - before;
    }
  }
  return deck.sort((a, b) => L.card(a).m - L.card(b).m || L.card(a).n.localeCompare(L.card(b).n));
}

function seeded(s) { return () => { let t = (s += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function play(d0, d1, c0, c1, seed) {
  const G = L.newGame({ decks: [d0, d1], classes: [c0, c1], seed }); G.p[0].isBot = G.p[1].isBot = true;
  L.botMulligan(G, 0); L.botMulligan(G, 1); let t = 0;
  while (G.phase === 'play' && t++ < 300) { L.botTurn(G, G.turn); G.ev.length = 0; }
  return G.winner;
}
const uiSrc = fs.readFileSync(ROOT + '/js/ui.js', 'utf8');
const STARTER = JSON.parse(uiSrc.match(/const STARTER_LISTS = (\{.*?\});/)[1]);
const CLS = ['tamer', 'gambler', 'healer', 'collector', 'scientist', 'champion'];

const out = RECIPES.map(R => {
  const cards = build(R);
  const errs = L.validateDeck(cards, R.cls);
  if (errs.length) throw new Error(R.name + ': ' + errs.join(' '));
  return { id: R.id, cls: R.cls, name: R.name, blurb: R.blurb, plan: R.plan, key: R.core.filter(([, k]) => k).map(([n]) => byName(n).id), cards };
});
fs.writeFileSync(ROOT + '/data/recipes.js', '/* GENERATED by legends/tools_gen_recipes.js: the pre-made decks players can copy and finish. */\nwindow.LL_RECIPES = ' + JSON.stringify(out) + ';\n');

const N = +process.argv[2] || 240, rnd = seeded(4242);
console.log('recipe                    vs starters  vs random  rarity (C/R/E/L)  key fits');
for (const r of out) {
  let ws = 0, wr = 0;
  for (let g = 0; g < N; g++) {
    const o = CLS[g % 6];
    const a = play(r.cards, STARTER[o], r.cls, o, (rnd() * 1e9) | 0); if (a === 0) ws++; else if (a < 0) ws += .5;
    const b = play(r.cards, L.randomDeck(null, o, rnd), r.cls, o, (rnd() * 1e9) | 0); if (b === 0) wr++; else if (b < 0) wr += .5;
  }
  const rar = [0, 1, 2, 3].map(k => r.cards.filter(id => L.card(id).r === k).length).join('/');
  const R = RECIPES.find(x => x.id === r.id), fits = r.cards.filter(id => R.fit(L.card(id)) || R.pay(L.card(id))).length;
  console.log(r.name.padEnd(26), (ws / N * 100).toFixed(0).padStart(6) + '%', (wr / N * 100).toFixed(0).padStart(9) + '%', rar.padStart(14), String(fits).padStart(8));
}
if (process.argv.includes('--list')) for (const r of out) {
  const n = {}; r.cards.forEach(id => { n[id] = (n[id] || 0) + 1; });
  console.log('\n## ' + r.name + ' (' + r.cls + ')'); Object.entries(n).forEach(([id, k]) => { const c = L.card(id); console.log(`  ${k}x ${c.m} ${c.n}${c.tr ? ' [' + c.tr + ']' : ''} :: ${(c.tx || '').slice(0, 80)}`); });
}
