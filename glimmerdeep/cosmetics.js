// Wardrobe: extra tamer palettes, titles, frames, and CSS board themes.
// Outfit selection stays on meta.skin so The Wilds recolor is unchanged.
(function () {
'use strict';
if (typeof window === 'undefined' || !window.GD) return;
const G = window.GD;

const PALETTES = {
  crimson: { n: 'Crimson', hue: 350, sat: 1.1, req: { ach: 'kills1000' }, d: 'Knock out 1,000 foes.' },
  mint: { n: 'Mint', hue: 150, sat: 1.05, req: { ach: 'merge250' }, d: 'Merge creatures 250 times.' },
  emberglow: { n: 'Emberglow', hue: 22, sat: 1.3, req: { ach: 'streak12' }, d: 'Win 12 fights in a row.' },
  ocean: { n: 'Ocean', hue: 195, sat: 1.2, req: { stamps: 3 }, d: 'Collect 3 daily stamps.' },
  sunset: { n: 'Sunset', hue: 20, sat: 1.15, req: { ach: 'run10' }, d: 'Win 10 runs.' },
  royal: { n: 'Royal', hue: 265, sat: 1.3, req: { ach: 'boss50' }, d: 'Win 50 elite or boss fights.' },
  mono: { n: 'Mono', hue: 200, sat: 0.1, req: { stamps: 7 }, d: 'Collect 7 daily stamps.' },
  gilded: { n: 'Gilded', hue: 48, sat: 1.45, req: { ach: 'win500' }, d: 'Win 500 fights.' },
  vine: { n: 'Vine', hue: 128, sat: 1.2, req: { ach: 'wild10' }, d: 'Start 10 Wilds expeditions.' },
  duskrose: { n: 'Duskrose', hue: 320, sat: 1.25, req: { ach: 'shiny5' }, d: 'Catch 5 shinies.' },
};
Object.assign(G.SKINS, PALETTES);

const TITLES = {
  veteran: { n: 'Veteran', d: 'Win 100 fights.', unlock: { ach: 'win100' } },
  slayer: { n: 'Slayer', d: 'Win 50 elite or boss fights.', unlock: { ach: 'boss50' } },
  evolver: { n: 'Evolver', d: 'Evolve creatures 50 times.', unlock: { ach: 'evo50' } },
  glim_master: { n: 'Glim Master', d: 'See every species.', unlock: { ach: 'dex172' } },
  wall_whisperer: { n: 'Wall Whisperer', d: 'Find 10 secret rooms.', unlock: { ach: 'secret10' } },
  rival_beater: { n: 'Rival Beater', d: 'Earn all 3 Rival Badges.', unlock: { ach: 'rival3' } },
  deep_diver: { n: 'Deep Diver', d: 'Unlock Depth 10.', unlock: { ach: 'depth10' } },
  hoarder: { n: 'Relic Hoarder', d: 'Find 150 relics.', unlock: { ach: 'relic150' } },
  shiny_hunter: { n: 'Shiny Hunter', d: 'Catch 20 shinies.', unlock: { ach: 'shiny20' } },
  den_champ: { n: 'Den Champion', d: 'Clear the Rival\'s Den.', unlock: { ach: 'den1' } },
  devotee: { n: 'Daily Devotee', d: 'Collect 30 daily stamps.', unlock: { ach: 'daily30' } },
  trailblazer: { n: 'Trailblazer', d: 'Collect 1 daily stamp.', unlock: { stamps: 1 } },
};
const FRAMES = {
  gold: { n: 'Gold', d: 'Win 500 fights.', unlock: { ach: 'win500' } },
  rainbow: { n: 'Rainbow', d: 'See every species.', unlock: { ach: 'dex172' } },
  ember: { n: 'Ember', d: 'Win 50 runs.', unlock: { ach: 'run50' } },
  ice: { n: 'Ice', d: 'Beat 50 trainers.', unlock: { ach: 'trainer50' } },
  leaf: { n: 'Leaf', d: 'Enter 25 Wilds floors.', unlock: { ach: 'floors25' } },
};
const THEMES = {
  '': { n: 'Default', d: 'The Glimmerdeep you started with.', unlock: { default: 1 } },
  forest: { n: 'Forest', d: 'Start 10 expeditions.', unlock: { ach: 'wild10' } },
  ember: { n: 'Ember', d: 'Win 10 elite or boss fights.', unlock: { ach: 'boss10' } },
  frost: { n: 'Frost', d: 'Unlock Depth 5.', unlock: { ach: 'depth5' } },
  starfield: { n: 'Starfield', d: 'Unlock Depth 10.', unlock: { ach: 'depth10' } },
  aurora: { n: 'Aurora', d: 'Ascend 15 creatures.', unlock: { ach: 'ascend15' } },
  candy: { n: 'Candy', d: 'Finish daily goals 7 days in a row.', unlock: { ach: 'daily7' } },
};

let meta = null;
let tab = 'outfit';
function metaOf() { return meta || (window.GLIM && GLIM.meta) || null; }
function esc(s) { return window.GLIM && GLIM.esc ? GLIM.esc(s) : String(s); }

function openOf(u) {
  if (!u || u.default) return true;
  const m = metaOf();
  if (!m) return false;
  if (u.ach) return !!(window.AX && AX.has(u.ach));
  if (u.stamps) return ((m.daily && m.daily.stamps) || 0) >= u.stamps;
  return false;
}
function skinOk(id) {
  if (!G.SKINS[id]) return false;
  if (window.WILDS && WILDS.skinOpen) return !!WILDS.skinOpen(id);
  const q = G.SKINS[id].req;
  if (!q) return true;
  if (q.ach) return !!(window.AX && AX.has(q.ach));
  if (q.stamps) return ((metaOf().daily && metaOf().daily.stamps) || 0) >= q.stamps;
  return false;
}
function init(m) {
  meta = m || metaOf();
  if (!meta) return;
  meta.cosm = meta.cosm || {};
  meta.cosm.own = meta.cosm.own || {};
  meta.cosm.sel = Object.assign({ skin: meta.skin || 'classic', title: '', frame: '', theme: '' }, meta.cosm.sel || {});
  apply();
}
function apply() {
  const m = metaOf();
  if (!m || !m.cosm) return;
  const sel = m.cosm.sel;
  if (!skinOk(sel.skin)) sel.skin = 'classic';
  if (sel.skin) m.skin = sel.skin;
  if (sel.title && !TITLES[sel.title]) sel.title = '';
  if (sel.title && !openOf(TITLES[sel.title].unlock)) sel.title = '';
  if (sel.frame && !FRAMES[sel.frame]) sel.frame = '';
  if (sel.frame && !openOf(FRAMES[sel.frame].unlock)) sel.frame = '';
  if (sel.theme && !THEMES[sel.theme]) sel.theme = '';
  if (sel.theme && !openOf(THEMES[sel.theme].unlock)) sel.theme = '';
  if (document.body) document.body.dataset.theme = sel.theme || '';
}
function grant(id) {
  const m = metaOf();
  if (!m) return;
  m.cosm = m.cosm || { own: {}, sel: { skin: m.skin || 'classic', title: '', frame: '', theme: '' } };
  m.cosm.own[id] = 1;
}
function label(id) {
  const p = String(id).split(':');
  const kind = p[0], key = p.slice(1).join(':');
  if (kind === 'palette' && G.SKINS[key]) return 'Outfit: ' + G.SKINS[key].n;
  if (kind === 'title' && TITLES[key]) return 'Title: ' + TITLES[key].n;
  if (kind === 'frame' && FRAMES[key]) return 'Frame: ' + FRAMES[key].n;
  if (kind === 'theme' && THEMES[key]) return 'Theme: ' + THEMES[key].n;
  return id;
}
function titleName() {
  const m = metaOf();
  const id = m && m.cosm && m.cosm.sel && m.cosm.sel.title;
  return id && TITLES[id] && openOf(TITLES[id].unlock) ? TITLES[id].n : '';
}
function frameClass() {
  const m = metaOf();
  const id = m && m.cosm && m.cosm.sel && m.cosm.sel.frame;
  return id && FRAMES[id] && openOf(FRAMES[id].unlock) ? 'frame-' + id : '';
}
function filterFor(sk) {
  if (!sk || sk.hue == null) return '';
  const deg = ((sk.hue - 180) % 360 + 360) % 360;
  return 'filter:hue-rotate(' + deg + 'deg) saturate(' + (sk.sat || 1) + ')';
}
function preview() {
  const m = metaOf();
  const id = (m && m.skin) || 'classic';
  const sk = G.SKINS[id] || G.SKINS.classic;
  const tn = titleName();
  return '<div class="cosprev ' + frameClass() + '"><img src="' + (window.GLIM ? GLIM.IMG('wd_tamer_idle_1') : 'img/wd_tamer_idle_1.webp') + '" alt="" style="' + filterFor(sk) + '">' +
    '<div class="t">' + esc(sk.n) + '</div>' + (tn ? '<div class="costitle">' + esc(tn) + '</div>' : '') + '</div>';
}
function card(kind, id, def, on, ok) {
  return '<button type="button" class="coscard' + (on ? ' on' : '') + (ok ? '' : ' locked') + '" data-v="eq:' + kind + ':' + id + '">' +
    '<div class="nm">' + esc(def.n) + '</div>' +
    '<div class="small muted">' + (ok ? 'Tap to equip' : esc(def.d || '')) + '</div></button>';
}
function body() {
  const m = metaOf();
  const sel = m.cosm.sel;
  let grid = '';
  if (tab === 'outfit') {
    grid = Object.keys(G.SKINS).map(k => card('palette', k, G.SKINS[k], (m.skin || 'classic') === k, skinOk(k))).join('');
  } else if (tab === 'title') {
    grid = card('title', '', { n: 'None', d: 'No title.' }, !sel.title, true) +
      Object.keys(TITLES).map(k => card('title', k, TITLES[k], sel.title === k, openOf(TITLES[k].unlock))).join('');
  } else if (tab === 'frame') {
    grid = card('frame', '', { n: 'None', d: 'No frame.' }, !sel.frame, true) +
      Object.keys(FRAMES).map(k => card('frame', k, FRAMES[k], sel.frame === k, openOf(FRAMES[k].unlock))).join('');
  } else {
    grid = Object.keys(THEMES).map(k => card('theme', k, THEMES[k], (sel.theme || '') === k, openOf(THEMES[k].unlock))).join('');
  }
  const tabs = [['outfit', 'Outfit'], ['title', 'Title'], ['frame', 'Frame'], ['theme', 'Theme']].map(([id, n]) =>
    '<button class="btn sm' + (tab === id ? ' green' : ' ghost') + '" data-v="tab:' + id + '">' + n + '</button>').join('');
  return preview() + '<div class="achtabs">' + tabs + '</div><div class="cosgrid">' + grid + '</div>';
}
function equip(kind, id) {
  const m = metaOf();
  if (!m) return false;
  if (kind === 'palette') {
    if (!skinOk(id)) return false;
    m.skin = id;
    m.cosm.sel.skin = id;
  } else if (kind === 'title') {
    if (id && (!TITLES[id] || !openOf(TITLES[id].unlock))) return false;
    m.cosm.sel.title = id;
  } else if (kind === 'frame') {
    if (id && (!FRAMES[id] || !openOf(FRAMES[id].unlock))) return false;
    m.cosm.sel.frame = id;
  } else if (kind === 'theme') {
    if (id && (!THEMES[id] || !openOf(THEMES[id].unlock))) return false;
    m.cosm.sel.theme = id || '';
  } else return false;
  apply();
  if (window.GLIM && GLIM.save) GLIM.save();
  return true;
}
async function open() {
  if (!meta) init(metaOf());
  tab = 'outfit';
  for (;;) {
    const v = await GLIM.ask('Wardrobe', body(), GLIM.btn('x', 'Done', 'green'), 'x');
    if (v == null || v === 'x') break;
    if (v.indexOf('tab:') === 0) { tab = v.slice(4); continue; }
    if (v.indexOf('eq:') === 0) {
      const p = v.split(':');
      const ok = equip(p[1], p.slice(2).join(':'));
      if (window.GLIM) GLIM.toast(ok ? 'Equipped.' : 'Still locked.');
      continue;
    }
    break;
  }
  if (window.GLIM && GLIM.renderTitle && document.querySelector('#title.on')) GLIM.renderTitle();
}

window.COSM = {
  init, apply, open, grant, label, titleName, frameClass, equip,
  PALETTES, TITLES, FRAMES, THEMES,
};
if (window.GLIM && GLIM.meta) {
  init(GLIM.meta);
  apply();
  if (document.querySelector('#title.on') && GLIM.renderTitle) GLIM.renderTitle();
}
})();
