/* ============================================================
   BlinQ leads site · form.js
   Demo request form: business-type choice reveals step 2,
   then a placeholder submit confirmation.
   ============================================================ */
(function () {
  'use strict';

  /* ==========================================================
     1. BUSINESS TYPE CHOICES + PROGRESSIVE FORM REVEAL
     ========================================================== */
  var choiceButtons = document.querySelectorAll('#businessChoices button');
  var formDetails   = document.getElementById('formDetails');

  Array.prototype.forEach.call(choiceButtons, function (btn) {
    btn.addEventListener('click', function () {
      Array.prototype.forEach.call(choiceButtons, function (other) {
        var isActive = other === btn;
        other.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        var marker = other.querySelector('.marker');
        if (marker) marker.textContent = isActive ? '✓' : '↗';
      });

      if (formDetails && !formDetails.classList.contains('open')) {
        formDetails.classList.add('open');
        formDetails.setAttribute('aria-hidden', 'false');

        setTimeout(function () {
          var rect = formDetails.getBoundingClientRect();
          var absoluteY = window.scrollY + rect.top - 120;
          window.scrollTo({ top: absoluteY, behavior: 'smooth' });
        }, 200);
      }
    });
  });

  /* ==========================================================
     2. DEMO FORM SUBMIT
     Placeholder: shows a confirmation only. Connect this to
     your CRM / form endpoint before going live.
     ========================================================== */
  var demoForm = document.getElementById('demoForm');
  if (demoForm) {
    demoForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = demoForm.querySelector('.formSubmit');
      if (!btn) return;
      var original = btn.innerHTML;
      btn.disabled = true;
      btn.style.opacity = '0.85';
      btn.innerHTML = 'Request received ✓';
      setTimeout(function () {
        btn.disabled = false;
        btn.style.opacity = '';
        btn.innerHTML = original;
      }, 2400);
    });
  }
})();
