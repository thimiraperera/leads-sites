/* ============================================================
   BlinQ leads site · stages.js
   "How BlinQ works": five stage tabs over one panel. Clicking a tab
   (or arrow keys / Home / End on the tabs) shows that stage. The
   panels are written in index.html; without this script all five
   stages are listed one after another.
   ============================================================ */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  var root = document.querySelector('[data-stages]');
  if (!root) return;

  var tabs = all('.stages__tab', root);
  var panels = all('.stage', root);
  var strip = root.querySelector('.stages__tabs');
  if (!tabs.length || tabs.length !== panels.length) return;

  var current = 0;
  function go(i, focus) {
    current = (i + tabs.length) % tabs.length;
    tabs.forEach(function (t, k) {
      var on = k === current;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
    });
    panels.forEach(function (p, k) { p.classList.toggle('is-active', k === current); });
    if (focus) tabs[current].focus();
    // On narrow screens the tabs scroll sideways: keep the active one in view
    if (strip && strip.scrollWidth > strip.clientWidth) {
      var t = tabs[current];
      var into = t.getBoundingClientRect().left - strip.getBoundingClientRect().left;
      strip.scrollTo({ left: Math.max(0, strip.scrollLeft + into - 24), behavior: reduce ? 'auto' : 'smooth' });
    }
  }

  tabs.forEach(function (t, k) {
    t.addEventListener('click', function () { go(k); });
    t.addEventListener('keydown', function (e) {
      var to = null;
      if (e.key === 'ArrowRight') to = current + 1;
      else if (e.key === 'ArrowLeft') to = current - 1;
      else if (e.key === 'Home') to = 0;
      else if (e.key === 'End') to = tabs.length - 1;
      if (to === null) return;
      e.preventDefault();
      go(to, true);
    });
  });

  root.classList.add('is-ready');
  go(0);
})();
