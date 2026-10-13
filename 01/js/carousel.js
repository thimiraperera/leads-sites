/* ============================================================
   BlinQ leads site · carousel.js
   Steps carousel (ported from blinq-web-v3.0, "Keep it simple &
   accurate!"). One row of cards, a step every 5 seconds, drag to
   move. The row has a start and an end: it stops at the last card
   (the next arrow switches off there) so visitors can see where it
   finishes; stepping back lets it carry on again.
   The cards are written in index.html (.flow__track > li); this
   script adds the dots, arrows, timer and dragging.
   ============================================================ */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  all('[data-flow]').forEach(function (flow) {
    var view = flow.querySelector('.flow__view');
    var track = flow.querySelector('.flow__track');
    var dotsWrap = flow.querySelector('[data-flow-dots]');
    var prevBtn = flow.querySelector('[data-flow-prev]');
    var nextBtn = flow.querySelector('[data-flow-next]');
    var cards = all(':scope > li', track);
    var n = cards.length;
    if (n < 2) return;
    cards.forEach(function (li, k) {
      li.setAttribute('aria-roledescription', 'slide');
      li.setAttribute('aria-label', (k + 1) + ' of ' + n);
    });

    var index = 0, x = 0, maxX = 0, last = n - 1, dots = [];
    var setX = function (v, jump) {
      x = v;
      if (jump) track.classList.add('is-jump');
      track.style.transform = 'translate3d(' + v + 'px, 0, 0)';
      if (jump) { void track.offsetWidth; track.classList.remove('is-jump'); }
    };
    /* How far the row can travel, and the last card that still moves it. */
    var measure = function () {
      maxX = Math.max(0, track.scrollWidth - view.clientWidth);
      last = 0;
      while (last < n - 1 && cards[last].offsetLeft < maxX - 1) last++;
    };
    var buildDots = function () {
      if (dots.length === last + 1) return;
      dotsWrap.textContent = '';
      dots = [];
      for (var k = 0; k <= last; k++) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'flow__dot';
        b.setAttribute('aria-label', 'Show step ' + (k + 1));
        b.appendChild(document.createElement('i'));
        (function (k) { b.addEventListener('click', function () { go(k); }); })(k);
        dotsWrap.appendChild(b);
        dots.push(b);
      }
    };
    var go = function (i, jump) {
      index = Math.max(0, Math.min(last, i));
      setX(-Math.min(cards[index].offsetLeft, maxX), jump);
      dots.forEach(function (d, j) {
        d.classList.toggle('is-active', j === index);
        if (j === index) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current');
      });
      prevBtn.disabled = index === 0;
      nextBtn.disabled = index === last;
      flow.classList.toggle('is-end', index === last);
    };

    /* The red fill in the active dot is the 5 second timer, so pausing it pauses the carousel. */
    var hover = false, focus = false, away = false, drag = null;
    var syncPause = function () { flow.classList.toggle('is-paused', hover || focus || away || !!drag); };
    dotsWrap.addEventListener('animationend', function (e) {
      if (e.animationName === 'fill' && !reduce && index < last) go(index + 1);
    });
    flow.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') { hover = true; syncPause(); } });
    flow.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') { hover = false; syncPause(); } });
    flow.addEventListener('focusin', function () { focus = true; syncPause(); });
    flow.addEventListener('focusout', function (e) { if (!flow.contains(e.relatedTarget)) { focus = false; syncPause(); } });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        away = !entries[0].isIntersecting;
        syncPause();
      }).observe(flow);
    }
    prevBtn.addEventListener('click', function () { go(index - 1); });
    nextBtn.addEventListener('click', function () { go(index + 1); });

    /* Drag with a mouse, pen or finger. Vertical swipes are left to the page. Past either end the
       row gives a little and springs back. */
    view.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      var m = window.getComputedStyle(track).transform;
      var at = m && m !== 'none' && window.DOMMatrixReadOnly ? new DOMMatrixReadOnly(m).m41 : x;
      drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, start: at, moved: false };
      if (e.pointerType === 'mouse') e.preventDefault();
    });
    view.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var dx = e.clientX - drag.x0;
      if (!drag.moved) {
        if (Math.abs(dx) < 6) return;
        if (Math.abs(e.clientY - drag.y0) > Math.abs(dx)) { drag = null; return; }
        drag.moved = true;
        flow.classList.add('is-dragging');
        try { view.setPointerCapture(e.pointerId); } catch (err) { /* capture is optional */ }
        syncPause();
      }
      var v = drag.start + dx;
      if (v > 0) v = v / 3;
      else if (v < -maxX) v = -maxX + (v + maxX) / 3;
      setX(v);
    });
    var endDrag = function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var d = drag;
      drag = null;
      syncPause();
      if (!d.moved) return;
      flow.classList.remove('is-dragging');
      var step = cards[1].offsetLeft - cards[0].offsetLeft;
      var from = index;
      var to = Math.round(-x / step);
      var dx = x - d.start;
      if (to === from && e.type === 'pointerup' && Math.abs(dx) > 40) to += dx < 0 ? 1 : -1;
      go(to);
    };
    view.addEventListener('pointerup', endDrag);
    view.addEventListener('pointercancel', endDrag);
    view.addEventListener('dragstart', function (e) { e.preventDefault(); });
    window.addEventListener('resize', function () { measure(); buildDots(); go(index, true); });

    flow.classList.add('is-ready');
    if (reduce) flow.classList.add('is-still');
    measure();
    buildDots();
    go(0, true);
  });
})();
