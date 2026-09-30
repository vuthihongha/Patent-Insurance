(function () {
  'use strict';

  var form = document.querySelector('[data-quiz]');
  var dataEl = document.getElementById('assessment-data');
  if (!form || !dataEl || !window.BHSCScoring) return;

  var data = JSON.parse(dataEl.textContent);
  var ui = data.ui;
  var R = data.result;
  var steps = Array.prototype.slice.call(form.querySelectorAll('[data-question]'));
  var total = steps.length;
  var current = 0;
  var pointerPick = false;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var el = function (sel) { return document.querySelector(sel); };
  var backBtn = form.querySelector('[data-back]');
  var nextBtn = form.querySelector('[data-next]');
  var nextLabel = form.querySelector('[data-next-label]');
  var errorEl = form.querySelector('[data-error]');
  var stepEl = form.querySelector('[data-step-current]');
  var progressEl = form.querySelector('[data-progress]');
  var resultEl = el('[data-result]');

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function answerOf(step) {
    var checked = step.querySelector('input:checked');
    return checked ? checked.value : null;
  }

  function show(index, focus) {
    current = index;
    steps.forEach(function (s, i) { s.hidden = i !== index; });
    stepEl.textContent = pad(index + 1);
    progressEl.style.transform = 'scaleX(' + (index + 1) / total + ')';
    backBtn.disabled = index === 0;
    nextLabel.textContent = index === total - 1 ? ui.finish : ui.next;
    errorEl.hidden = true;
    if (focus) {
      var target = steps[index].querySelector('input:checked') || steps[index].querySelector('input');
      if (target) target.focus({ preventScroll: true });
    }
  }

  function next() {
    if (!answerOf(steps[current])) {
      errorEl.hidden = false;
      var first = steps[current].querySelector('input');
      if (first) first.focus();
      return;
    }
    if (current < total - 1) show(current + 1, true);
    else finish();
  }

  // Auto-advance when an option is picked with mouse/touch (not keyboard arrows)
  form.addEventListener('pointerdown', function (e) {
    if (e.target.closest('.option')) pointerPick = true;
  });
  form.addEventListener('change', function () {
    errorEl.hidden = true;
    if (!pointerPick) return;
    pointerPick = false;
    setTimeout(next, reduceMotion ? 0 : 260);
  });
  form.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.matches('input[type="radio"]')) {
      e.preventDefault();
      next();
    }
  });
  nextBtn.addEventListener('click', next);
  backBtn.addEventListener('click', function () { if (current > 0) show(current - 1, true); });
  form.addEventListener('submit', function (e) { e.preventDefault(); next(); });

  function collect() {
    var answers = {};
    data.questions.forEach(function (id) {
      var checked = form.querySelector('input[name="' + id + '"]:checked');
      answers[id] = checked ? checked.value : null;
    });
    return answers;
  }

  function node(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function animateNumber(target) {
    var out = el('[data-score]');
    if (reduceMotion) { out.textContent = target; return; }
    var start = null;
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min(1, (ts - start) / 1100);
      out.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function renderResult(res) {
    var circumference = 2 * Math.PI * 52;
    var gauge = el('[data-gauge]');
    gauge.style.strokeDasharray = circumference;
    gauge.style.strokeDashoffset = circumference;
    resultEl.dataset.level = res.level;
    el('[data-level-title]').textContent = R.levels[res.level].title;
    el('[data-level-body]').textContent = R.levels[res.level].body;

    var list = el('[data-products]');
    list.textContent = '';
    res.products.forEach(function (p, i) {
      var info = R.products[p.id];
      var li = node('li', 'fit-card glass fit-' + p.fit + (i === 0 ? ' is-top' : ''));
      var head = node('div', 'fit-head');
      head.appendChild(node('span', 'fit-rank', pad(i + 1)));
      var titles = node('div', 'fit-titles');
      titles.appendChild(node('h3', 'h3', info.name));
      titles.appendChild(node('p', 'muted', info.body));
      head.appendChild(titles);
      li.appendChild(head);
      var meter = node('div', 'fit-meter');
      var track = node('span', 'fit-track');
      var fill = node('span', 'fit-fill');
      fill.style.setProperty('--w', Math.max(p.pct, 4) + '%');
      track.appendChild(fill);
      meter.appendChild(track);
      meter.appendChild(node('span', 'fit-label', R.fit[p.fit]));
      li.appendChild(meter);
      li.appendChild(node('span', 'fit-phase', R.phase + ' ' + info.phase));
      list.appendChild(li);
    });

    var tips = el('[data-tips]');
    tips.textContent = '';
    res.tips.forEach(function (id) { tips.appendChild(node('li', null, R.tips[id])); });
    el('[data-tips-wrap]').hidden = res.tips.length === 0;

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        gauge.style.strokeDashoffset = circumference * (1 - res.readiness / 100);
        resultEl.classList.add('is-shown');
      });
    });
    animateNumber(res.readiness);
  }

  function finish() {
    var answers = collect();
    if (!window.BHSCScoring.isValid(answers)) return;
    var res = window.BHSCScoring.score(answers);
    window.BHSCLastResult = { readiness: res.readiness, top: res.products[0].id };
    form.hidden = true;
    resultEl.hidden = false;
    renderResult(res);
    resultEl.focus({ preventScroll: true });
    resultEl.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });

    fetch('/api/assessments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lang: data.lang, answers: answers })
    }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (json) { if (json && json.count) setCount(json.count); })
      .catch(function () { /* the result still shows if logging fails */ });
  }

  el('[data-restart]').addEventListener('click', function () {
    form.reset();
    resultEl.hidden = true;
    resultEl.classList.remove('is-shown');
    form.hidden = false;
    show(0, true);
    form.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  });
  el('[data-print]').addEventListener('click', function () { window.print(); });

  function setCount(n) {
    var wrap = el('[data-count-wrap]');
    el('[data-count]').textContent = n.toLocaleString(data.lang === 'vi' ? 'vi-VN' : 'en-US');
    wrap.hidden = false;
  }
  fetch('/api/assessments/count')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (json) { if (json && json.count > 0) setCount(json.count); })
    .catch(function () {});

  show(0, false);
})();
