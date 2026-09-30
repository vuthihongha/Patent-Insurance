/*
 * Inner-page hero scene: moody steel-blue sky, a giant word set behind the page
 * emblem, a perspective grid floor and crisp data beams with travelling pulses.
 * One canvas per page hero ([data-page-scene], word from data-word).
 * Full device resolution; pauses off-screen; a still frame for reduced motion.
 */
(function () {
  'use strict';
  var canvas = document.querySelector('[data-page-scene]');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var word = (canvas.getAttribute('data-word') || '').toUpperCase();
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var base = document.createElement('canvas');
  var bctx = base.getContext('2d');
  var W = 0, H = 0, dpr = 1, horizon = 0, time = 0, running = false, visible = true, last = 0;

  var BEAMS = [
    { a: [-0.02, 0.70], b: [0.28, 0.36], c: [0.62, 0.58], d: [1.02, 0.20], w: 1.2, speed: 0.08, col: '111,166,255' },
    { a: [-0.02, 0.42], b: [0.30, 0.22], c: [0.66, 0.18], d: [1.02, 0.30], w: 0.9, speed: 0.06, col: '120,220,255' },
    { a: [0.18, 0.95], b: [0.46, 0.70], c: [0.74, 0.62], d: [1.02, 0.46], w: 1.0, speed: 0.11, col: '160,200,255' }
  ];
  function bez(p0, p1, p2, p3, t) { var u = 1 - t; return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3; }

  function rng(seed) {
    return function () { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; var t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  function buildBase() {
    base.width = W; base.height = H;
    var g = bctx, r = rng(word.length * 97 + 11);
    // sky
    var sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#02050d');
    sky.addColorStop(0.55, '#071a3a');
    sky.addColorStop(0.86, '#123a6e');
    sky.addColorStop(1, '#030a1c');
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    var bloom = g.createRadialGradient(W * 0.8, 0, 0, W * 0.8, 0, W * 0.55);
    bloom.addColorStop(0, 'rgba(170,205,240,0.26)'); bloom.addColorStop(0.5, 'rgba(90,140,200,0.10)'); bloom.addColorStop(1, 'rgba(40,80,150,0)');
    g.fillStyle = bloom; g.fillRect(0, 0, W, H);
    var bloom2 = g.createRadialGradient(W * 0.1, H * 0.9, 0, W * 0.1, H * 0.9, W * 0.45);
    bloom2.addColorStop(0, 'rgba(47,107,255,0.22)'); bloom2.addColorStop(1, 'rgba(47,107,255,0)');
    g.fillStyle = bloom2; g.fillRect(0, 0, W, H);
    // stars
    for (var s = 0; s < 110; s++) { g.fillStyle = 'rgba(214,230,255,' + (0.12 + r() * 0.45) + ')'; g.fillRect(r() * W, r() * horizon * 0.8, dpr, dpr); }
    // giant word
    if (word) {
      var fs = Math.min(W / (word.length * 0.62), H * 0.46);
      g.save();
      g.font = '700 ' + fs + 'px "Be Vietnam Pro", sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      if ('letterSpacing' in g) g.letterSpacing = Math.round(fs * 0.03) + 'px';
      var y = horizon + fs * 0.08;
      var wg = g.createLinearGradient(0, y - fs * 0.8, 0, y);
      wg.addColorStop(0, 'rgba(214,230,255,0.13)'); wg.addColorStop(1, 'rgba(214,230,255,0.015)');
      g.fillStyle = wg; g.fillText(word, W / 2, y);
      g.lineWidth = dpr; g.strokeStyle = 'rgba(214,230,255,0.18)'; g.strokeText(word, W / 2, y);
      g.restore();
    }
    // horizon line + perspective grid floor
    var hl = g.createLinearGradient(0, 0, W, 0);
    hl.addColorStop(0, 'rgba(160,200,255,0)'); hl.addColorStop(0.5, 'rgba(200,225,255,0.55)'); hl.addColorStop(1, 'rgba(160,200,255,0)');
    g.fillStyle = hl; g.fillRect(0, horizon, W, dpr);
    var floor = g.createLinearGradient(0, horizon, 0, H);
    floor.addColorStop(0, 'rgba(3,10,28,0.2)'); floor.addColorStop(1, 'rgba(3,10,28,0.95)');
    g.fillStyle = floor; g.fillRect(0, horizon + dpr, W, H - horizon);
    g.lineWidth = dpr;
    var vx = W / 2, depth = H - horizon;
    for (var i = -22; i <= 22; i++) {
      var lg = g.createLinearGradient(0, horizon, 0, H);
      lg.addColorStop(0, 'rgba(111,166,255,0)'); lg.addColorStop(1, 'rgba(111,166,255,' + Math.max(0.03, 0.17 - Math.abs(i) * 0.006) + ')');
      g.strokeStyle = lg; g.beginPath(); g.moveTo(vx + i * W * 0.005, horizon); g.lineTo(vx + i * W * 0.08, H); g.stroke();
    }
    for (var j = 1; j <= 7; j++) {
      var yy = horizon + depth * Math.pow(j / 7, 1.8);
      g.strokeStyle = 'rgba(111,166,255,' + (0.03 + j * 0.014) + ')'; g.beginPath(); g.moveTo(0, yy); g.lineTo(W, yy); g.stroke();
    }
  }

  function frame(dt) {
    time += dt;
    ctx.drawImage(base, 0, 0);
    ctx.save(); ctx.lineCap = 'round';
    BEAMS.forEach(function (bm, k) {
      var A = [bm.a[0] * W, bm.a[1] * horizon], B = [bm.b[0] * W, bm.b[1] * horizon], C = [bm.c[0] * W, bm.c[1] * horizon], D = [bm.d[0] * W, bm.d[1] * horizon];
      var rail = ctx.createLinearGradient(A[0], A[1], D[0], D[1]);
      rail.addColorStop(0, 'rgba(' + bm.col + ',0)'); rail.addColorStop(0.4, 'rgba(' + bm.col + ',0.26)'); rail.addColorStop(1, 'rgba(' + bm.col + ',0.05)');
      ctx.strokeStyle = rail; ctx.lineWidth = bm.w * dpr;
      ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.bezierCurveTo(B[0], B[1], C[0], C[1], D[0], D[1]); ctx.stroke();
      var t = (time * bm.speed + k * 0.33) % 1, seg = 0.1;
      ctx.beginPath();
      for (var i = 0; i <= 14; i++) {
        var tt = Math.max(0, t - seg + seg * i / 14);
        var x = bez(A[0], B[0], C[0], D[0], tt), y = bez(A[1], B[1], C[1], D[1], tt);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      var hx = bez(A[0], B[0], C[0], D[0], t), hy = bez(A[1], B[1], C[1], D[1], t);
      var tx = bez(A[0], B[0], C[0], D[0], Math.max(0, t - seg)), ty = bez(A[1], B[1], C[1], D[1], Math.max(0, t - seg));
      var gr = ctx.createLinearGradient(tx, ty, hx, hy);
      gr.addColorStop(0, 'rgba(' + bm.col + ',0)'); gr.addColorStop(1, 'rgba(235,245,255,0.95)');
      ctx.strokeStyle = gr; ctx.lineWidth = (bm.w + 0.8) * dpr;
      ctx.shadowColor = 'rgba(' + bm.col + ',0.9)'; ctx.shadowBlur = 10 * dpr; ctx.stroke(); ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(hx, hy, 1.7 * dpr, 0, 6.283); ctx.fill();
    });
    ctx.restore();
  }

  function loop(now) {
    if (!running) return;
    var dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
    frame(dt); requestAnimationFrame(loop);
  }
  function start() { if (running || reduce || !visible || document.hidden) return; running = true; last = performance.now(); requestAnimationFrame(loop); }
  function stop() { running = false; }
  function resize() {
    var rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, Math.round(rect.width * dpr)); H = Math.max(1, Math.round(rect.height * dpr));
    canvas.width = W; canvas.height = H;
    horizon = H * 0.78;
    buildBase(); frame(0);
  }
  var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(resize, 150); });
  document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
  if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { visible = e[0].isIntersecting; visible ? start() : stop(); }).observe(canvas);
  resize();
  canvas.classList.add('is-ready');
  if (document.fonts && document.fonts.load) document.fonts.load('700 100px "Be Vietnam Pro"').then(function () { buildBase(); if (!running) frame(0); }).catch(function () {});
  start();
})();
