// Client for the "register interest" form(s): inline validation, then POST.
// A page (e.g. the shared static preview) can override where submissions go by
// setting window.BHSCInterestSubmit = async (payload) => boolean.
(function () {
  'use strict';
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function defaultSubmit(payload) {
    return fetch('/api/interest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (r) { return r.ok; });
  }

  document.querySelectorAll('[data-interest]').forEach(function (form) {
    var btn = form.querySelector('button[type="submit"]');
    function showError(name, show) {
      var el = form.querySelector('[data-error-for="' + name + '"]');
      var input = form.elements[name];
      if (el) el.hidden = !show;
      if (input && input.setAttribute) input.setAttribute('aria-invalid', show ? 'true' : 'false');
    }
    // Validate a field when the person leaves it, not while typing
    ['org', 'email'].forEach(function (name) {
      form.elements[name].addEventListener('blur', function () {
        var v = form.elements[name].value.trim();
        if (v) showError(name, name === 'email' ? !EMAIL.test(v) : false);
      });
    });
    form.elements.consent.addEventListener('change', function () { if (form.elements.consent.checked) showError('consent', false); });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var org = form.elements.org.value.trim();
      var email = form.elements.email.value.trim();
      var consent = form.elements.consent.checked;
      var bad = [];
      showError('org', !org); if (!org) bad.push('org');
      showError('email', !EMAIL.test(email)); if (!EMAIL.test(email)) bad.push('email');
      showError('consent', !consent); if (!consent) bad.push('consent');
      if (bad.length) { form.elements[bad[0]].focus(); return; }

      var topics = Array.prototype.slice.call(form.querySelectorAll('input[name="topics"]:checked')).map(function (i) { return i.value; });
      var payload = {
        lang: document.documentElement.lang === 'en' ? 'en' : 'vi',
        org: org, email: email,
        contact: form.elements.contact.value.trim(),
        type: form.elements.type.value, sector: form.elements.sector.value,
        topics: topics, message: form.elements.message.value.trim(),
        website: form.elements.website.value,
        consent: true,
        assessment: window.BHSCLastResult || null
      };
      form.querySelector('[data-server-error]').hidden = true;
      btn.disabled = true;
      btn.firstChild.nodeValue = btn.dataset.sending + ' ';
      var send = window.BHSCInterestSubmit || defaultSubmit;
      Promise.resolve(send(payload)).then(function (ok) {
        if (!ok) throw new Error('failed');
        form.classList.add('is-sent');
        Array.prototype.forEach.call(form.elements, function (el) { el.disabled = true; });
        var success = form.querySelector('[data-success]');
        success.hidden = false;
        success.setAttribute('tabindex', '-1');
        success.focus();
      }).catch(function () {
        btn.disabled = false;
        btn.firstChild.nodeValue = btn.dataset.label + ' ';
        form.querySelector('[data-server-error]').hidden = false;
      });
    });
  });
})();
