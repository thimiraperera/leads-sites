/* ============================================================
   BlinQ leads site · testimonials.js
   Customer stories carousel (ported from blinq-web-v3.0).
   One story at a time. The red bar over the active tab is a 7s
   CSS animation; when it ends, the next story comes up. Hovering
   or focusing the card pauses the bar, and so the rotation.
   ============================================================ */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  all('[data-testi]').forEach(function (t) {
    var slides = all('.testi__slide', t);
    var tabs = all('.testi__tab', t);
    var i = 0;
    var strip = t.querySelector('.testi__tabs');
    var go = function (n) {
      i = (n + slides.length) % slides.length;
      slides.forEach(function (sl, k) { sl.classList.toggle('is-active', k === i); });
      tabs.forEach(function (b, k) {
        b.classList.toggle('is-active', k === i);
        b.setAttribute('aria-selected', k === i ? 'true' : 'false');
        b.tabIndex = k === i ? 0 : -1;
      });
      // Centre the active tab in the strip without moving the page. Measured from the strip
      // itself, since the tabs' offsetParent is further up the page.
      if (strip && tabs[i]) {
        var into = tabs[i].getBoundingClientRect().left - strip.getBoundingClientRect().left;
        var left = strip.scrollLeft + into - strip.clientWidth / 2 + tabs[i].offsetWidth / 2;
        strip.scrollTo({ left: Math.max(0, left), behavior: reduce ? 'auto' : 'smooth' });
      }
    };
    tabs.forEach(function (b, k) {
      b.addEventListener('click', function () { go(k); });
      b.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          go(e.key === 'ArrowRight' ? i + 1 : i - 1);
          tabs[i].focus();
        }
      });
    });
    t.querySelector('[data-prev]').addEventListener('click', function () { go(i - 1); });
    t.querySelector('[data-next]').addEventListener('click', function () { go(i + 1); });
    t.addEventListener('animationend', function (e) {
      if (reduce) return;
      if (e.target.classList.contains('testi__bar') && e.target.closest('.testi__tab').classList.contains('is-active')) go(i + 1);
    });
  });
})();
