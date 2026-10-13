/* ============================================================
   BlinQ leads site · main.js
   Header scroll state, mobile sticky CTA, FAQ accordion
   and scroll reveal. Loaded last of the page scripts.
   ============================================================ */
(function () {
  'use strict';

  /* ==========================================================
     1. HEADER SCROLL + MOBILE STICKY CTA
     ========================================================== */
  var header    = document.querySelector('header');
  var mobileCta = document.querySelector('.mobilecta');

  function toggleMobileCta() {
    if (!mobileCta) return;
    if (window.innerWidth > 640) {
      mobileCta.classList.remove('show');
      return;
    }
    mobileCta.classList.toggle('show', window.scrollY > 560);
  }

  function onScroll() {
    if (header) header.classList.toggle('scrolled', window.scrollY > 8);
    toggleMobileCta();
  }

  /* ==========================================================
     2. FAQ ACCORDION (one item open at a time)
     ========================================================== */
  var faqItems = document.querySelectorAll('.faq details');
  Array.prototype.forEach.call(faqItems, function (item) {
    item.addEventListener('toggle', function () {
      if (!item.open) return;
      Array.prototype.forEach.call(faqItems, function (other) {
        if (other !== item) other.open = false;
      });
    });
  });

  /* ==========================================================
     3. SCROLL REVEAL
     ========================================================== */
  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!prefersReduced && 'IntersectionObserver' in window) {
    var selector = [
      '.hero > *','.industry > *','.booking > *','.gut > *',
      '.connected > *','.testimonial > *','.onboarding > *',
      '.faq > *','.final > *','footer > *'
    ].join(',');
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    Array.prototype.forEach.call(document.querySelectorAll(selector), function (el) {
      var siblings = el.parentElement ? el.parentElement.children : [];
      var index = Array.prototype.indexOf.call(siblings, el);
      var delay = Math.min(Math.max(index, 0) * 70, 350);
      el.classList.add('reveal');
      el.style.transitionDelay = delay + 'ms';
      observer.observe(el);
    });
  }

  /* ==========================================================
     4. BIND SCROLL
     ========================================================== */
  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      onScroll();
      ticking = false;
    });
  }, { passive: true });
  window.addEventListener('resize', toggleMobileCta, { passive: true });

  onScroll();
})();
