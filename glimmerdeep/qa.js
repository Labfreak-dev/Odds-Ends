/* Glimmerdeep QA: keyboard/screen-reader labels, modal focus trap, low-fps Classic switch.
   Loaded after game.js. Does not touch load/save, drag-to-sell, or the game-over copy. */
(function () {
  'use strict';

  function syncReduced() {
    let media = false;
    try { media = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { /* no matchMedia */ }
    const ga = window.GlimAnim;
    if (ga && media) ga.reduced = true;
    const on = media || !!(ga && ga.reduced);
    document.documentElement.classList.toggle('reduce-motion', on);
  }
  syncReduced();
  try {
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.addEventListener) mq.addEventListener('change', syncReduced);
  } catch (e) { /* no matchMedia */ }

  const $ = s => document.querySelector(s);
  function txt(el, sel) {
    const n = el.querySelector(sel);
    return n ? n.textContent.replace(/\s+/g, ' ').trim() : '';
  }
  function speciesName(el) {
    const img = el.querySelector('img');
    const src = img ? (img.getAttribute('src') || '') : '';
    const m = /cr_([a-z0-9]{4})(\d)/.exec(src);
    if (m && window.GD && GD.SP && GD.SP[m[1]]) {
      const names = GD.SP[m[1]].names || [];
      return names[(+m[2] || 1) - 1] || names[0] || 'Creature';
    }
    if (/boss_/.test(src)) return 'Boss';
    return 'Creature';
  }
  function decorate() {
    document.querySelectorAll('.scard').forEach(el => {
      if (el.classList.contains('empty') || el.dataset.buy == null) {
        el.removeAttribute('role');
        el.removeAttribute('aria-label');
        if (el.tabIndex === 0) el.tabIndex = -1;
        return;
      }
      const name = txt(el, '.nm') || 'Creature';
      const cost = txt(el, '.cost');
      const role = txt(el, '.role');
      const bits = [name];
      if (el.classList.contains('shinycard')) bits.push('shiny');
      if (cost) bits.push(cost + ' gold');
      if (role) bits.push(role);
      if (el.classList.contains('have')) bits.push('owned');
      if (el.classList.contains('poor')) bits.push('not enough gold');
      bits.push('buy');
      el.setAttribute('role', 'button');
      el.tabIndex = 0;
      el.setAttribute('aria-label', bits.join(', '));
    });
    document.querySelectorAll('#units .unit, .bslot .unit').forEach(el => {
      const name = speciesName(el);
      const stars = txt(el, '.stars');
      const side = el.classList.contains('side1') ? 'foe' : 'your creature';
      const where = el.closest('.bslot') ? 'on the bench' : (el.classList.contains('preview') ? 'enemy preview' : 'on the board');
      el.setAttribute('role', 'button');
      el.tabIndex = 0;
      el.setAttribute('aria-label', [name, stars, side, where].filter(Boolean).join(', '));
    });
    document.querySelectorAll('.bslot').forEach(el => {
      const n = (+el.dataset.slot || 0) + 1;
      const unit = el.querySelector('.unit');
      el.setAttribute('role', 'button');
      el.tabIndex = 0;
      el.setAttribute('aria-label', unit && unit.getAttribute('aria-label')
        ? 'Bench slot ' + n + ', ' + unit.getAttribute('aria-label')
        : 'Bench slot ' + n + ', empty');
    });
    document.querySelectorAll('button.iconbtn, button.wrel, button.wasc, button.wbtn').forEach(el => {
      if (el.getAttribute('aria-label')) return;
      const top = el.dataset.top || '';
      const go = el.dataset.go || '';
      const w = el.dataset.w || '';
      let label = el.getAttribute('title') || '';
      if (top === 'menu' || (el.textContent || '').trim() === '☰') label = 'Menu';
      else if (top === 'bag') label = label || 'Bag';
      else if (go === 'title' || w === 'home' || w === 'leave' || (el.textContent || '').trim() === '◀') label = 'Back';
      else if (w === 'tonic') label = label || 'Glim Tonic';
      else if (el.classList.contains('wasc')) label = label || 'Ascend';
      else if (el.classList.contains('wrel')) label = label || 'Relic';
      if (!label) {
        const visible = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (!visible || el.querySelector('img, svg')) label = 'Button';
      }
      if (label) el.setAttribute('aria-label', label);
    });
    const modal = $('#modal');
    if (modal && modal.classList.contains('on')) armModal(modal);
    document.querySelectorAll('.evo').forEach(armEvo);
  }

  function armModal(modal) {
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    const h = modal.querySelector('h2');
    if (h) { h.id = 'modalTitle'; modal.setAttribute('aria-labelledby', 'modalTitle'); }
    modal.querySelectorAll('[data-v]').forEach(el => {
      if (el.matches('button, a, input, select, textarea')) return;
      if (!el.hasAttribute('tabindex')) el.tabIndex = 0;
      if (!el.getAttribute('role')) el.setAttribute('role', 'button');
      if (!el.getAttribute('aria-label')) {
        const t = (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 140);
        if (t) el.setAttribute('aria-label', t);
      }
    });
  }
  function armEvo(el) {
    el.tabIndex = 0;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', 'Evolution. Activate to continue.');
  }

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; try { decorate(); } catch (e) { /* a label must not break the game */ } });
  }
  const app = $('#app');
  if (app && window.MutationObserver) new MutationObserver(schedule).observe(app, { childList: true, subtree: true });
  schedule();

  const FOCUSABLE = 'button, summary, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  function hiddenInClosedDetails(el) {
    const det = el.closest && el.closest('details');
    if (!det || det.open) return false;
    if (el.tagName === 'SUMMARY' || (el.closest && el.closest('summary'))) return false;
    return true;
  }
  function focusables(root) {
    return Array.prototype.filter.call(root.querySelectorAll(FOCUSABLE), el => {
      if (el.disabled) return false;
      if (el.tabIndex < 0) return false;
      if (hiddenInClosedDetails(el)) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 || r.height > 0;
    });
  }
  function primaryAction(dlg) {
    const greens = dlg.querySelectorAll('.acts .btn.green');
    for (let i = greens.length - 1; i >= 0; i--) {
      const el = greens[i];
      if (el.disabled || el.tabIndex < 0 || hiddenInClosedDetails(el)) continue;
      return el;
    }
    const list = focusables(dlg);
    return list[0] || dlg;
  }
  function activeDialog() {
    const evo = document.querySelector('.evo:not(.out)');
    if (evo) return evo;
    const m = $('#modal');
    if (m && m.classList.contains('on')) return m;
    return null;
  }

  let trapped = null;
  let prevFocus = null;
  function focusToken(el) {
    if (!el || !el.getAttribute || el === document.body) return null;
    if (el.classList && el.classList.contains('unit') && el.dataset.uid != null) return { sel: '.unit.mine[data-uid="' + el.dataset.uid + '"]' };
    if (el.classList && el.classList.contains('scard') && el.dataset.buy != null) return { sel: '.scard[data-buy="' + el.dataset.buy + '"]' };
    if (el.classList && el.classList.contains('bslot') && el.dataset.slot != null) return { sel: '.bslot[data-slot="' + el.dataset.slot + '"]' };
    if (el.dataset && el.dataset.top) return { sel: '[data-top="' + el.dataset.top + '"]' };
    if (el.dataset && el.dataset.go) return { sel: '[data-go="' + el.dataset.go + '"]' };
    if (el.dataset && el.dataset.v && el.closest && !el.closest('#modal')) return { sel: '[data-v="' + el.dataset.v + '"]' };
    return { el: el };
  }
  function focusEl(el) {
    if (!el || !el.focus) return;
    if (el.tabIndex < 0) el.tabIndex = 0;
    el.focus();
  }
  // display:none controls (the Skip button left in the fight bar) still accept
  // focus() and then drop it, which lands on body.
  function isShown(el) {
    return !!(el && el.getClientRects && el.getClientRects().length);
  }
  function hasFocus(el) {
    return !!(el && el !== document.body && el !== document.documentElement && isShown(el));
  }
  function restoreFocus(token) {
    if (!token) return;
    const n = token.sel ? document.querySelector(token.sel) : null;
    const el = (n && document.contains(n) && n) || (token.el && document.contains(token.el) ? token.el : null);
    if (isShown(el)) focusEl(el);
    if (!token.sel) return;
    const sel = token.sel;
    // Goals and Wardrobe rebuild the title menu after this observer, so the
    // button focused above may already have been replaced by the time we paint.
    requestAnimationFrame(() => {
      if (activeDialog()) return;
      if (hasFocus(document.activeElement)) return;
      const again = document.querySelector(sel);
      if (isShown(again)) focusEl(again);
    });
  }
  let afterResult = false;
  function focusFight() {
    if (!afterResult) return;
    requestAnimationFrame(() => {
      if (!afterResult) return;
      if (activeDialog()) return;
      if (hasFocus(document.activeElement)) { afterResult = false; return; }
      const btn = document.querySelector('#game.on #shopBtns [data-v=fight]');
      if (!isShown(btn)) return;
      afterResult = false;
      focusEl(btn);
    });
  }
  function syncTrap() {
    const dlg = activeDialog();
    const modal = $('#modal');
    if (modal) modal.setAttribute('aria-hidden', modal.classList.contains('on') ? 'false' : 'true');
    if (dlg === trapped) {
      // Reward modals reuse #modal before the observer runs, so the node never
      // looks closed. If Continue's button was removed, focus fell to body.
      if (dlg && dlg.id === 'modal') {
        const ae = document.activeElement;
        if (!ae || ae === document.body || ae === document.documentElement || !dlg.contains(ae)) {
          armModal(dlg);
          const target = primaryAction(dlg);
          if (target && target.focus) target.focus();
        }
      }
      return;
    }
    if (dlg) {
      const ae = document.activeElement;
      if (!trapped && ae && !dlg.contains(ae)) prevFocus = focusToken(ae);
      trapped = dlg;
      if (dlg.id === 'modal') armModal(dlg); else armEvo(dlg);
      const h = dlg.querySelector('h2');
      if (h && /victory|defeat|defeated/i.test(h.textContent || '')) afterResult = true;
      const target = primaryAction(dlg);
      if (target && target.focus) target.focus();
    } else {
      trapped = null;
      const back = prevFocus;
      prevFocus = null;
      restoreFocus(back);
      focusFight();
    }
  }
  if (app && window.MutationObserver) {
    new MutationObserver(syncTrap).observe(app, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }
  const modalEl = $('#modal');
  if (modalEl) modalEl.setAttribute('aria-hidden', 'true');

  function poke(el) {
    const r = el.getBoundingClientRect();
    const opt = { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerId: 1, pointerType: 'mouse', isPrimary: true };
    el.dispatchEvent(new PointerEvent('pointerdown', opt));
    el.dispatchEvent(new PointerEvent('pointerup', opt));
  }
  function activate(el) {
    if (el.classList.contains('bslot')) {
      const unit = el.querySelector('.unit');
      if (unit) { poke(unit); return; }
    }
    if (el.classList.contains('unit') || el.classList.contains('evo')) { poke(el); return; }
    el.click();
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'Tab') {
      const dlg = activeDialog();
      if (!dlg) return;
      const list = focusables(dlg);
      if (!list.length) { e.preventDefault(); if (dlg.focus) dlg.focus(); return; }
      const i = list.indexOf(document.activeElement);
      const next = e.shiftKey ? (i <= 0 ? list[list.length - 1] : list[i - 1]) : (i < 0 || i >= list.length - 1 ? list[0] : list[i + 1]);
      e.preventDefault();
      next.focus();
      return;
    }
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
    if (e.altKey || e.ctrlKey || e.metaKey || e.repeat) return;
    const dlg = activeDialog();
    if (dlg && dlg.classList.contains('evo')) {
      e.preventDefault();
      poke(dlg);
      return;
    }
    const el = e.target.closest && e.target.closest('.scard, .unit, .bslot, .card[data-v], .li.click[data-v]');
    if (!el) return;
    if (e.target.matches && e.target.matches('button, input, textarea, select, a')) return;
    if (el.classList.contains('empty')) return;
    e.preventDefault();
    activate(el);
  });

  function overlaps(a, b) {
    return !!(a && b && a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5 && a.left < b.right - 0.5 && a.right > b.left + 0.5);
  }
  function placeLowToast() {
    const toast = $('#toast');
    if (!toast) return;
    const fighting = document.querySelector('#game.fighting .board.arena-on');
    if (fighting) {
      toast.style.top = 'auto';
      toast.style.bottom = '10px';
      toast.style.left = '10px';
      toast.style.right = 'auto';
      toast.style.transform = 'none';
      toast.style.maxWidth = '240px';
      return;
    }
    toast.style.top = '';
    toast.style.bottom = '';
    toast.style.left = '';
    toast.style.maxWidth = '';
    toast.style.transform = '';
    if (!toast.classList.contains('low') || !toast.classList.contains('on')) return;
    const game = document.querySelector('#game.on');
    const traits = game && game.querySelector('.traits');
    const fight = game && (game.querySelector('#shopBtns [data-v=fight]') || game.querySelector('#fightBar [data-v=skip]'));
    if (!traits || !traits.getBoundingClientRect().height) return;
    const host = toast.offsetParent || document.getElementById('app') || document.body;
    const hostTop = host.getBoundingClientRect().top;
    const gap = 18;
    const anim = toast.style.animation;
    toast.style.animation = 'none';
    const apply = px => { toast.style.top = Math.max(0, Math.round(px)) + 'px'; };
    let t = toast.getBoundingClientRect();
    const tr = traits.getBoundingClientRect();
    if (overlaps(t, tr)) {
      apply(tr.bottom + gap - hostTop);
      t = toast.getBoundingClientRect();
    }
    const fr = fight && fight.getBoundingClientRect();
    if (fr && fr.height && overlaps(t, fr)) {
      const aboveTop = fr.top - gap - t.height;
      const above = { top: aboveTop, bottom: aboveTop + t.height, left: t.left, right: t.right };
      if (aboveTop >= 0 && !overlaps(above, tr)) apply(aboveTop - hostTop);
      else apply(fr.bottom + gap - hostTop);
    }
    toast.style.animation = anim;
  }

  const toast = $('#toast');
  if (toast) {
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    new MutationObserver(() => {
      // Removing a class that is not there still notifies observers in Chrome
      // and would loop with the class watch below.
      if (toast.classList.contains('ask') && !toast.querySelector('[data-ac]')) toast.classList.remove('ask');
      placeLowToast();
    }).observe(toast, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    window.addEventListener('resize', placeLowToast);
    toast.addEventListener('click', e => {
      const b = e.target.closest('[data-ac]');
      if (!b || !window.GLIM) return;
      if (b.dataset.ac === 'keep') GLIM.confirmClassic();
      else GLIM.setAutoClassic(false);
      const msg = b.dataset.ac === 'keep' ? 'Classic animation saved. Switch back any time in Settings.' : 'Switched back to Rich. You can change it in Settings.';
      toast.classList.remove('ask');
      if (GLIM.toast) GLIM.toast(msg);
    });
  }
  const ach = $('#achToast');
  if (ach && !ach.getAttribute('aria-live')) ach.setAttribute('aria-live', 'polite');

  // First fight after the title screen: if the opening 3 seconds stay under 30 fps, use Classic
  // without rewriting the saved Animation choice unless the player confirms on the toast.
  let arm = true;
  const title = $('#title');
  if (title && window.MutationObserver) {
    new MutationObserver(() => { if (title.classList.contains('on')) arm = true; }).observe(title, { attributes: true, attributeFilter: ['class'] });
  }
  function queryLocksAnim() {
    try {
      const q = new URLSearchParams(location.search).get('anim');
      return q === '0' || q === '1';
    } catch (e) { return false; }
  }
  function showFpsToast(fps) {
    if (!toast) return;
    toast.classList.remove('on', 'ask');
    toast.innerHTML = '<div>Under 30 fps (' + Math.round(fps) + '), so Classic animation is on. Your saved choice is still Rich.</div>' +
      '<div class="qa-acts"><button type="button" class="btn sm" data-ac="keep">Keep Classic</button>' +
      '<button type="button" class="btn sm ghost" data-ac="back">Switch back</button></div>';
    void toast.offsetWidth;
    toast.classList.add('on', 'ask');
    clearTimeout(showFpsToast._t);
    showFpsToast._t = setTimeout(() => {
      if (document.querySelector('.board.arena-on') && toast.classList.contains('ask') && toast.querySelector('[data-ac]')) toast.classList.remove('on', 'ask');
    }, 4600);
  }
  let sampling = false;
  function sampleFight() {
    const meta = window.GLIM && GLIM.meta;
    if (!meta || meta.fpsOptOut || meta.autoClassic || meta.anim === 0 || queryLocksAnim()) return;
    if (sampling) return;
    sampling = true;
    const t0 = performance.now();
    let frames = 0;
    function frame(now) {
      const game = $('#game');
      if (!game || !game.classList.contains('fighting') || game.classList.contains('wild')) {
        sampling = false;
        arm = true;
        return;
      }
      frames++;
      if (now - t0 < 3000) { requestAnimationFrame(frame); return; }
      sampling = false;
      const fps = frames / ((now - t0) / 1000);
      if (fps >= 30 || !window.GLIM || !GLIM.setAutoClassic) return;
      const m = GLIM.meta;
      if (!m || m.anim === 0 || m.fpsOptOut || m.autoClassic) return;
      GLIM.setAutoClassic(true);
      showFpsToast(fps);
    }
    requestAnimationFrame(frame);
  }
  const game = $('#game');
  if (game && window.MutationObserver) {
    new MutationObserver(() => {
      if (!arm || sampling) return;
      if (!game.classList.contains('fighting') || game.classList.contains('wild')) return;
      arm = false;
      sampleFight();
    }).observe(game, { attributes: true, attributeFilter: ['class'] });
  }
})();
