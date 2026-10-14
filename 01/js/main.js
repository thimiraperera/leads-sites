/* ============================================================
   BlinQ leads site · main.js
   Header scroll state, mobile sticky CTA and scroll reveal. Loaded last of the page scripts.
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
     2. SCROLL REVEAL
     ========================================================== */
  // The footer is left out: it sits at the very bottom, where the -8% margin below means it could
  // never count as "in view" on tall screens and stayed invisible.
  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var revealRest = function () {};
  if (!prefersReduced && 'IntersectionObserver' in window) {
    var selector = [
      '.hero > *','.industry > *','.booking > *','.gut > *',
      '.how > *','.testimonial > *','.onboarding > *',
      '.faq > *','.final > *'
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
    // Safety net: once the page is scrolled to the bottom, show anything still waiting
    revealRest = function () {
      if (window.innerHeight + window.scrollY < document.documentElement.scrollHeight - 2) return;
      Array.prototype.forEach.call(document.querySelectorAll('.reveal:not(.in)'), function (el) {
        el.classList.add('in');
        observer.unobserve(el);
      });
    };
  }

  /* ==========================================================
     3. BIND SCROLL
     ========================================================== */
  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      onScroll();
      revealRest();
      ticking = false;
    });
  }, { passive: true });
  window.addEventListener('resize', toggleMobileCta, { passive: true });

  onScroll();
  revealRest();
})();
