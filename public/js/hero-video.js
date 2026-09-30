/*
 * Hero: real footage of a Vietnamese city lit up by its river at night, composited with a
 * sapphire starry sky (see media/hero-night-*.mp4), plus one live element drawn here:
 * the arc of cover. On arrival a point of silver light draws a vault over the city,
 * shedding sparkles; the vault stays, with light gliding along it. Its ends pass behind
 * the real towers (the skyline profile below was measured from the footage).
 * Reduced motion: poster frame and a still arc.
 */
(function () {
  'use strict';
  var v = document.querySelector('[data-hero-video]');
  if (!v) return;
  var hero = v.closest('.hero');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- footage
  if (reduce) v.removeAttribute('autoplay');
  else {
    var big = Math.max(window.innerWidth, window.innerHeight) * (window.devicePixelRatio || 1) > 1600 && !/Mobi|Android/i.test(navigator.userAgent);
    v.src = v.getAttribute(big ? 'data-src-lg' : 'data-src-sm');
    var p = v.play(); if (p && p.catch) p.catch(function () {});
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (e) { if (e[0].isIntersecting) { var q = v.play(); if (q && q.catch) q.catch(function () {}); } else v.pause(); }).observe(v);
    }
  }

  // ---- the arc of cover
  // skyline of the footage: top of the city at 128 columns, as a fraction of the frame height
  var SKY = [0.401,0.424,0.417,0.391,0.391,0.424,0.323,0.323,0.335,0.335,0.42,0.42,0.366,0.366,0.349,0.349,0.389,0.375,0.26,0.24,0.24,0.264,0.246,0.215,0.215,0.196,0.194,0.194,0.194,0.194,0.208,0.194,0.194,0.203,0.266,0.26,0.26,0.266,0.267,0.269,0.436,0.417,0.417,0.417,0.434,0.434,0.439,0.441,0.439,0.436,0.436,0.431,0.424,0.42,0.42,0.444,0.446,0.434,0.434,0.438,0.432,0.425,0.403,0.403,0.403,0.406,0.406,0.411,0.411,0.411,0.457,0.451,0.451,0.453,0.46,0.46,0.453,0.453,0.455,0.455,0.455,0.455,0.455,0.458,0.458,0.457,0.457,0.453,0.453,0.453,0.427,0.422,0.417,0.399,0.391,0.391,0.391,0.392,0.431,0.432,0.2,0.167,0.167,0.167,0.17,0.17,0.17,0.154,0.153,0.153,0.153,0.153,0.153,0.182,0.321,0.321,0.194,0.193,0.182,0.182,0.16,0.158,0.154,0.154,0.158,0.311,0.293,0.293];
  var ARC = { cx: 0.5, cy: 0.5, rx: 0.44, ry: 0.36 };     // in footage coordinates (0..1)
  var cv = document.createElement('canvas');
  cv.className = 'hero-arc'; cv.setAttribute('aria-hidden', 'true');
  v.insertAdjacentElement('afterend', cv);
  var g = cv.getContext('2d');
  var W = 1, H = 1, dpr = 1, box = { x: 0, y: 0, w: 1, h: 1 };

  function layout() {
    var r = hero.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    // object-fit: cover for a 16:9 frame
    var vw = W, vh = W * 9 / 16; if (vh < H) { vh = H; vw = H * 16 / 9; }
    box = { x: (W - vw) / 2, y: (H - vh) / 2, w: vw, h: vh };
  }
  function P(u, y) { return [box.x + u * box.w, box.y + y * box.h]; }
  function arcPt(t) { var a = Math.PI * (1 - t); return P(ARC.cx + Math.cos(a) * ARC.rx, ARC.cy - Math.sin(a) * ARC.ry); }
  function clipSky() {                                   // everything above the real skyline
    g.beginPath(); g.moveTo(box.x, box.y);
    for (var i = 0; i < SKY.length; i++) { var q = P((i + 0.5) / SKY.length, SKY[i] + 0.004); g.lineTo(q[0], q[1]); }
    g.lineTo(box.x + box.w, box.y); g.closePath(); g.clip();
  }

  var sparks = [], t0 = performance.now(), DELAY = 0.9, SWEEP = 4.2, last = t0;
  function spawn(x, y, n, spread) {
    for (var i = 0; i < n; i++) sparks.push({ x: x + (Math.random() - 0.5) * spread, y: y + (Math.random() - 0.5) * spread,
      vx: (Math.random() - 0.5) * 18, vy: 6 + Math.random() * 26, life: 1.6 + Math.random() * 2.4, age: 0, s: 0.6 + Math.random() * 1.6, ph: Math.random() * 6.28 });
  }
  function frame(now) {
    var time = (now - t0) / 1000, dt = Math.min(0.05, (now - last) / 1000); last = now;
    var head = reduce ? 1 : Math.min(1, Math.max(0, (time - DELAY) / SWEEP));
    head = 1 - Math.pow(1 - head, 2.4);
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    g.save(); clipSky();
    g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
    var N = 220, drawn = Math.floor(N * head);
    // the vault: soft glow + fine core, brightest near the travelling head
    for (var pass = 0; pass < 2; pass++) {
      for (var i = 1; i <= drawn; i++) {
        var t = i / N, a = arcPt((i - 1) / N), b = arcPt(t);
        var near = head < 1 ? Math.exp(-(head - t) * 9) : 0;
        var glide = 0.5 + 0.5 * Math.sin(t * 22 - time * 0.9);
        var alpha = pass ? 0.34 + 0.16 * glide + 0.6 * near : 0.07 + 0.05 * glide + 0.3 * near;
        g.strokeStyle = 'rgba(214,228,255,' + alpha.toFixed(3) + ')';
        g.lineWidth = pass ? 1.3 : 7;
        g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
      }
    }
    // the head
    if (head > 0 && head < 1) {
      var hp = arcPt(head), rg = g.createRadialGradient(hp[0], hp[1], 0, hp[0], hp[1], 46);
      rg.addColorStop(0, 'rgba(255,255,255,0.95)'); rg.addColorStop(0.15, 'rgba(220,232,255,0.6)'); rg.addColorStop(1, 'rgba(120,160,255,0)');
      g.fillStyle = rg; g.beginPath(); g.arc(hp[0], hp[1], 46, 0, 6.283); g.fill();
      if (!reduce) spawn(hp[0], hp[1], 6, 18);
    } else if (head >= 1 && !reduce && Math.random() < 0.35) {
      var sp = arcPt(Math.random()); spawn(sp[0], sp[1], 1, 6);      // a few sparkles keep falling from the vault
    }
    // sparkles
    for (var k = sparks.length - 1; k >= 0; k--) {
      var s = sparks[k]; s.age += dt;
      if (s.age > s.life) { sparks.splice(k, 1); continue; }
      s.x += s.vx * dt; s.y += s.vy * dt; s.vy *= 0.995;
      var f = 1 - s.age / s.life, tw = 0.55 + 0.45 * Math.sin(time * 9 + s.ph);
      g.fillStyle = 'rgba(235,242,255,' + (f * tw * 0.9).toFixed(3) + ')';
      g.beginPath(); g.arc(s.x, s.y, s.s, 0, 6.283); g.fill();
    }
    g.restore();
  }
  var running = false, visible = true;
  function loop(now) { if (!running) return; frame(now); requestAnimationFrame(loop); }
  function start() { if (running || reduce || !visible || document.hidden) return; running = true; last = performance.now(); requestAnimationFrame(loop); }
  function stop() { running = false; }
  var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { layout(); frame(performance.now()); }, 150); });
  document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
  if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { visible = e[0].isIntersecting; visible ? start() : stop(); }).observe(hero);
  layout(); frame(performance.now()); start();
})();
