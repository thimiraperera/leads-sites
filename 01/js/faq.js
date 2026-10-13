/* ============================================================
   BlinQ leads site · faq.js
   Topic-based FAQ. The topic links switch which topic's questions
   are shown (one at a time), and each topic's "Expand all" opens or
   closes every question in it. Without this script every topic is
   listed in turn and the topic links simply jump to it.
   ============================================================ */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  var root = document.querySelector('[data-faq]');
  if (!root) return;

  var links = all('.faqx__topic', root);
  var panels = all('.faqx__panel', root);
  var strip = root.querySelector('.faqx__topics');
  if (!panels.length) return;

  function show(id, fromClick) {
    var panel = document.getElementById(id);
    if (!panel || panels.indexOf(panel) === -1) return;
    panels.forEach(function (p) { p.hidden = p !== panel; });
    links.forEach(function (a) {
      var on = a.getAttribute('href') === '#' + id;
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      // On phones the topics are a sideways row: keep the active one in view
      if (on && strip && strip.scrollWidth > strip.clientWidth) {
        var into = a.getBoundingClientRect().left - strip.getBoundingClientRect().left;
        strip.scrollTo({ left: Math.max(0, strip.scrollLeft + into - 24), behavior: reduce ? 'auto' : 'smooth' });
      }
    });
    // If the new topic starts above the screen (a long topic was scrolled), bring its title back
    if (fromClick && panel.getBoundingClientRect().top < 80) {
      panel.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
    }
  }

  links.forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      show(a.getAttribute('href').slice(1), true);
    });
  });

  // "Expand all" / "Collapse all", per topic
  panels.forEach(function (panel) {
    var btn = panel.querySelector('.faqx__toggle');
    var items = all('details', panel);
    if (!btn || !items.length) return;
    var sync = function () {
      var allOpen = items.every(function (d) { return d.open; });
      btn.textContent = allOpen ? 'Collapse all' : 'Expand all';
      btn.setAttribute('aria-expanded', allOpen ? 'true' : 'false');
    };
    btn.addEventListener('click', function () {
      var open = !items.every(function (d) { return d.open; });
      items.forEach(function (d) { d.open = open; });
      sync();
    });
    items.forEach(function (d) { d.addEventListener('toggle', sync); });
    sync();
  });

  root.classList.add('is-ready');
  // Open the topic named in the address (e.g. #faq-pricing), otherwise the first one
  var start = location.hash && document.getElementById(location.hash.slice(1));
  show(start && panels.indexOf(start) !== -1 ? start.id : panels[0].id, false);
})();
