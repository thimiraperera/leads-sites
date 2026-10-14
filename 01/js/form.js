/* ============================================================
   BlinQ leads site · form.js
   Demo request form: the business-type choice reveals step 2;
   submitting checks the fields and sends them to the Cloudflare
   Pages Function at /api/demo-request, which emails them through
   Gmail (see functions/api/demo-request.js and the README).
   Where that Function isn't available (e.g. GitHub Pages, or
   sending not switched on yet) the visitor is offered an email
   link to the support address with their details filled in.
   ============================================================ */
(function () {
  'use strict';

  var ENDPOINT = '/api/demo-request';
  var SUPPORT_EMAIL = 'support@blinq.com.au';
  var SITE = '01';

  var form          = document.getElementById('demoForm');
  var choiceButtons = document.querySelectorAll('#businessChoices button');
  var formDetails   = document.getElementById('formDetails');
  var typeInput     = document.getElementById('f-businessType');
  var statusEl      = document.getElementById('formStatus');
  var successEl     = document.getElementById('formSuccess');
  var turnstileBox  = document.getElementById('formTurnstile');
  if (!form) return;

  var openedAt = 0;          // when step 2 opened: very fast submits are bots
  var service = null;        // { enabled, turnstile } from the Function, fetched once
  var turnstileToken = '';

  /* ==========================================================
     1. BUSINESS TYPE CHOICES + PROGRESSIVE FORM REVEAL
     ========================================================== */
  Array.prototype.forEach.call(choiceButtons, function (btn) {
    btn.addEventListener('click', function () {
      Array.prototype.forEach.call(choiceButtons, function (other) {
        var isActive = other === btn;
        other.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        var marker = other.querySelector('.marker');
        if (marker) marker.textContent = isActive ? '✓' : '↗';
      });
      if (typeInput) typeInput.value = btn.getAttribute('data-business') || '';

      if (formDetails && !formDetails.classList.contains('open')) {
        formDetails.classList.add('open');
        formDetails.setAttribute('aria-hidden', 'false');
        openedAt = Date.now();
        checkService();

        setTimeout(function () {
          var rect = formDetails.getBoundingClientRect();
          var absoluteY = window.scrollY + rect.top - 120;
          window.scrollTo({ top: absoluteY, behavior: 'smooth' });
        }, 200);
      }
    });
  });

  /* ==========================================================
     2. IS SENDING SWITCHED ON? (and should Turnstile show?)
     ========================================================== */
  function checkService() {
    if (service) return service;
    service = fetch(ENDPOINT, { headers: { accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : { enabled: false }; })
      .catch(function () { return { enabled: false }; })
      .then(function (d) {
        var s = { enabled: !!(d && d.enabled), turnstile: (d && d.turnstile) || null };
        if (s.enabled && s.turnstile) loadTurnstile(s.turnstile);
        return s;
      });
    return service;
  }

  function loadTurnstile(siteKey) {
    if (!turnstileBox || window.__blinqTurnstile) return;
    window.__blinqTurnstile = true;
    window.onBlinqTurnstile = function () {
      turnstileBox.hidden = false;
      window.turnstile.render(turnstileBox, {
        sitekey: siteKey,
        theme: 'light',
        callback: function (token) { turnstileToken = token; },
        'expired-callback': function () { turnstileToken = ''; },
        'error-callback': function () { turnstileToken = ''; }
      });
    };
    var s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onBlinqTurnstile';
    s.async = true;
    document.head.appendChild(s);
  }

  /* ==========================================================
     3. FIELD CHECKS
     ========================================================== */
  var EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[A-Za-z]{2,}$/;
  var CHECKS = [
    { id: 'f-name',     test: function (el) { return el.value.trim() !== ''; },  msg: 'Add your name.' },
    { id: 'f-email',    test: function (el) { return EMAIL.test(el.value.trim()); }, msg: 'Enter a valid email address.' },
    { id: 'f-country',  test: function (el) { return el.value !== ''; },          msg: 'Select your country.' },
    { id: 'f-priority', test: function (el) { return el.value !== ''; },          msg: 'Select what you’d most like to improve.' },
    { id: 'f-consent',  test: function (el) { return el.checked; },               msg: 'Tick the box so we can contact you.' }
  ];

  function wrapperOf(el) { return el.closest('.formField') || el.closest('.formCheck'); }

  function setError(el, msg) {
    var wrap = wrapperOf(el);
    var errId = el.id + '-error';
    var err = document.getElementById(errId);
    if (msg) {
      if (!err) {
        err = document.createElement('p');
        err.className = 'fieldError';
        err.id = errId;
        // Inside a text/select field's column; after the consent checkbox row
        if (wrap.classList.contains('formField')) wrap.appendChild(err);
        else wrap.insertAdjacentElement('afterend', err);
      }
      err.textContent = msg;
      wrap.classList.add('is-invalid');
      el.setAttribute('aria-invalid', 'true');
      el.setAttribute('aria-describedby', errId);
    } else {
      if (err) err.remove();
      wrap.classList.remove('is-invalid');
      el.removeAttribute('aria-invalid');
      el.removeAttribute('aria-describedby');
    }
  }

  function validate() {
    var firstBad = null;
    CHECKS.forEach(function (c) {
      var el = document.getElementById(c.id);
      if (!el) return;
      var good = c.test(el);
      setError(el, good ? '' : c.msg);
      if (!good && !firstBad) firstBad = el;
    });
    return firstBad;
  }

  // Clear a field's message as soon as it's fixed
  CHECKS.forEach(function (c) {
    var el = document.getElementById(c.id);
    if (!el) return;
    el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', function () {
      if (el.getAttribute('aria-invalid') === 'true' && c.test(el)) setError(el, '');
    });
  });

  /* ==========================================================
     4. SUBMIT
     ========================================================== */
  function value(name) {
    var el = form.elements[name];
    return el ? String(el.value || '').trim() : '';
  }

  function payload() {
    return {
      businessType: typeInput ? typeInput.value : '',
      name: value('name'),
      business: value('business'),
      email: value('email'),
      phone: value('phone'),
      country: value('country'),
      priority: value('priority'),
      consent: !!(form.elements.consent && form.elements.consent.checked),
      website: value('website'),
      elapsed: openedAt ? Date.now() - openedAt : 0,
      turnstile: turnstileToken,
      site: SITE,
      page: location.href.split('#')[0]
    };
  }

  function showStatus(msg, withEmailLink) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    if (withEmailLink) {
      var d = payload();
      var typeBtn = document.querySelector('#businessChoices button[aria-pressed="true"] span');
      var body = [
        'Hi BlinQ team,', '', 'I’d like to book a demo.', '',
        'Business type: ' + (typeBtn ? typeBtn.textContent : ''),
        'Name: ' + d.name, 'Business name: ' + d.business, 'Email: ' + d.email,
        'Phone: ' + d.phone, 'Country: ' + d.country, 'Wants to improve: ' + d.priority
      ].join('\n');
      var a = document.createElement('a');
      a.href = 'mailto:' + SUPPORT_EMAIL + '?subject=' + encodeURIComponent('Demo request') + '&body=' + encodeURIComponent(body);
      a.textContent = SUPPORT_EMAIL;
      statusEl.appendChild(document.createTextNode(' Email us at '));
      statusEl.appendChild(a);
      statusEl.appendChild(document.createTextNode(' and we’ll set up your demo.'));
    }
    statusEl.hidden = false;
  }

  function showSuccess(email) {
    var emailEl = document.getElementById('formSuccessEmail');
    if (emailEl) emailEl.textContent = email;
    form.classList.add('is-sent');
    if (successEl) {
      successEl.hidden = false;
      successEl.focus({ preventScroll: true });
      var rect = form.getBoundingClientRect();
      if (rect.top < 80) window.scrollTo({ top: window.scrollY + rect.top - 120, behavior: 'smooth' });
    }
  }

  var sending = false;
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (sending) return;
    if (statusEl) { statusEl.hidden = true; statusEl.textContent = ''; }

    var firstBad = validate();
    if (firstBad) { firstBad.focus(); return; }

    var data = payload();
    if (data.website) { showSuccess(data.email); return; }   // bot: pretend all is well

    var btn = form.querySelector('.formSubmit');
    var original = btn ? btn.innerHTML : '';
    sending = true;
    if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }

    Promise.resolve(checkService())
      .then(function (s) {
        if (!s.enabled) {
          throw { visitor: 'Sorry, we couldn’t send your request from this page.', link: true };
        }
        if (s.turnstile && !turnstileToken) {
          throw { visitor: 'Please complete the check above, then send again.' };
        }
        return fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify(data)
        }).then(function (r) {
          return r.json().catch(function () { return {}; }).then(function (body) {
            if (r.ok && body.ok) return;
            throw { visitor: body.error || 'Your request could not be sent.', link: r.status >= 500 || !body.error };
          });
        });
      })
      .then(function () {
        showSuccess(data.email);
      })
      .catch(function (err) {
        var known = err && err.visitor;
        showStatus(known ? err.visitor : 'Your request could not be sent.', known ? !!err.link : true);
        if (window.turnstile && turnstileToken) { try { window.turnstile.reset(turnstileBox); } catch (x) {} turnstileToken = ''; }
      })
      .then(function () {
        sending = false;
        if (btn && !form.classList.contains('is-sent')) { btn.disabled = false; btn.innerHTML = original; }
      });
  });
})();
