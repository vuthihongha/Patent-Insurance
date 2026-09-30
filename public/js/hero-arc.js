/*
 * The arc of cover, drawn live over the hero picture: on arrival a point of silver light
 * draws a vault over the city, shedding sparkles; the vault stays, with light gliding
 * along it. Its ends pass behind the towers, using the skyline profile of the picture
 * (data-skyline on the canvas: top of the city per column, as a fraction of the height).
 * The picture is a 16:9 frame shown with object-fit: cover.
 */
(function () {
  'use strict';
  var cv = document.querySelector('[data-hero-arc]');
  if (!cv) return;
  var hero = cv.closest('.hero');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SKY = JSON.parse(cv.getAttribute('data-skyline') || '[]');
  var A = (cv.getAttribute('data-arc') || '0.5,0.77,0.44,0.62').split(',').map(parseFloat);
  var ARC = { cx: A[0], cy: A[1], rx: A[2], ry: A[3] };
  var g = cv.getContext('2d'), W = 1, H = 1, dpr = 1, box = { x: 0, y: 0, w: 1, h: 1 };

  function layout() {
    var r = cv.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2); W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    var AR2 = 2752 / 1536, vw = W, vh = W / AR2; if (vh < H) { vh = H; vw = H * AR2; }
    box = { x: (W - vw) / 2, y: (H - vh) / 2, w: vw, h: vh };
  }
  function P(u, y) { return [box.x + u * box.w, box.y + y * box.h]; }
  function arcPt(t) { var a = Math.PI * (1 - t); return P(ARC.cx + Math.cos(a) * ARC.rx, ARC.cy - Math.sin(a) * ARC.ry); }
  function clipSky() {
    if (!SKY.length) return;
    g.beginPath(); g.moveTo(box.x, box.y);
    for (var i = 0; i < SKY.length; i++) { var q = P((i + 0.5) / SKY.length, SKY[i] + 0.004); g.lineTo(q[0], q[1]); }
    g.lineTo(box.x + box.w, box.y); g.closePath(); g.clip();
  }

  var sparks = [], t0 = performance.now(), last = t0, DELAY = 1.0, SWEEP = 4.4;
  var meteors = [], nextMeteor = 9 + Math.random() * 6;
  function meteor(time) {
    var sx = box.x + box.w * (0.12 + Math.random() * 0.76), sy = box.y + box.h * (0.04 + Math.random() * 0.16);
    var ang = (Math.random() < 0.5 ? 1 : -1) * (0.35 + Math.random() * 0.25), sp = box.w * (0.35 + Math.random() * 0.2);
    meteors.push({ x: sx, y: sy, vx: Math.cos(ang) * sp * (ang > 0 ? 1 : -1), vy: Math.abs(Math.sin(ang)) * sp, age: 0, life: 0.9 + Math.random() * 0.5 });
  }
  function spawn(x, y, n, spread) {
    for (var i = 0; i < n; i++) sparks.push({ x: x + (Math.random() - 0.5) * spread, y: y + (Math.random() - 0.5) * spread,
      vx: (Math.random() - 0.5) * 16, vy: 6 + Math.random() * 24, life: 1.6 + Math.random() * 2.4, age: 0, s: 0.5 + Math.random() * 1.5, ph: Math.random() * 6.28 });
  }
  function frame(now) {
    var time = (now - t0) / 1000, dt = Math.min(0.05, (now - last) / 1000); last = now;
    var head = reduce ? 1 : Math.min(1, Math.max(0, (time - DELAY) / SWEEP));
    head = 1 - Math.pow(1 - head, 2.4);
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    g.save(); clipSky(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
    var N = 240, drawn = Math.floor(N * head);
    for (var pass = 0; pass < 2; pass++) {
      for (var i = 1; i <= drawn; i++) {
        var t = i / N, a = arcPt((i - 1) / N), b = arcPt(t);
        var near = head < 1 ? Math.exp(-(head - t) * 9) : 0, glide = 0.5 + 0.5 * Math.sin(t * 22 - time * 0.9);
        var alpha = pass ? 0.3 + 0.16 * glide + 0.6 * near : 0.06 + 0.05 * glide + 0.3 * near;
        g.strokeStyle = 'rgba(214,228,255,' + alpha.toFixed(3) + ')'; g.lineWidth = pass ? 1.3 : 7;
        g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
      }
    }
    if (head > 0 && head < 1) {
      var hp = arcPt(head), rg = g.createRadialGradient(hp[0], hp[1], 0, hp[0], hp[1], 46);
      rg.addColorStop(0, 'rgba(255,255,255,0.95)'); rg.addColorStop(0.15, 'rgba(220,232,255,0.6)'); rg.addColorStop(1, 'rgba(120,160,255,0)');
      g.fillStyle = rg; g.beginPath(); g.arc(hp[0], hp[1], 46, 0, 6.283); g.fill();
      if (!reduce) spawn(hp[0], hp[1], 6, 18);
    } else if (head >= 1 && !reduce && Math.random() < 0.3) { var sp = arcPt(Math.random()); spawn(sp[0], sp[1], 1, 6); }
    for (var m = meteors.length - 1; m >= 0; m--) {
      var me = meteors[m]; me.age += dt; if (me.age > me.life) { meteors.splice(m, 1); continue; }
      var f0 = me.age / me.life, al = Math.sin(f0 * Math.PI) * 0.85, hx = me.x + me.vx * me.age, hy = me.y + me.vy * me.age;
      var tx = hx - me.vx * 0.12, ty = hy - me.vy * 0.12, lg = g.createLinearGradient(tx, ty, hx, hy);
      lg.addColorStop(0, 'rgba(214,228,255,0)'); lg.addColorStop(1, 'rgba(240,246,255,' + al.toFixed(3) + ')');
      g.strokeStyle = lg; g.lineWidth = 1.4; g.beginPath(); g.moveTo(tx, ty); g.lineTo(hx, hy); g.stroke();
    }
    for (var k = sparks.length - 1; k >= 0; k--) {
      var s = sparks[k]; s.age += dt;
      if (s.age > s.life) { sparks.splice(k, 1); continue; }
      s.x += s.vx * dt; s.y += s.vy * dt;
      var f = 1 - s.age / s.life, tw = 0.55 + 0.45 * Math.sin(time * 9 + s.ph);
      g.fillStyle = 'rgba(235,242,255,' + (f * tw * 0.9).toFixed(3) + ')'; g.beginPath(); g.arc(s.x, s.y, s.s, 0, 6.283); g.fill();
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
