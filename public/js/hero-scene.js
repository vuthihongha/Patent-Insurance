/*
 * Hero scene: a night-time tech city (Vietnam's innovation hubs) where ideas rise
 * from the buildings, become patents (glowing nodes), link into an innovation
 * ecosystem, all under a luminous insurance "shield" dome.
 * Canvas 2D, no dependencies. Pauses off-screen; static frame for reduced motion.
 */
// Fallback scene: runs only when the WebGL crystal (hero-gl.js) is unavailable.
window.startHeroScene = function () {
  'use strict';

  var canvas = document.querySelector('[data-hero-canvas]');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var W = 0, H = 0, dpr = 1, horizon = 0, scale = 1;
  var bg = document.createElement('canvas');      // city + water (transparent sky)
  var bgCtx = bg.getContext('2d');
  var sky = document.createElement('canvas');     // sky, haze, stars
  var skyCtx = sky.getContext('2d');
  var tops = [];        // spawn points on rooftops
  var twinkles = [];    // windows that blink
  var nodes = [];       // patents
  var sparks = [];      // rising ideas
  var dome = { cx: 0, cy: 0, rx: 0, ry: 0 };
  var towerTip = { x: 0, y: 0 };   // the tallest tower's spire — the golden spiral's pole
  var PHI = 1.6180339887;          // golden ratio: governs the spiral and a few key proportions below
  var maxNodes = 60;
  var running = false, visible = true, last = 0, spawnTimer = 0, time = 0;

  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- Static background: sky, stars, skyline, reflection ----------
  function buildBackground() {
    var r = rng(2026);
    bg.width = W; bg.height = H;
    sky.width = W; sky.height = H;
    var g = skyCtx;

    // Moody steel-blue sky with a soft bloom of light in the upper right
    var skyGrad = g.createLinearGradient(0, 0, 0, horizon);
    skyGrad.addColorStop(0, '#02050d');
    skyGrad.addColorStop(0.5, '#071a3a');
    skyGrad.addColorStop(1, '#16447a');
    g.fillStyle = skyGrad;
    g.fillRect(0, 0, W, horizon);
    var bloom = g.createRadialGradient(W * 0.82, horizon * 0.05, 0, W * 0.82, horizon * 0.05, W * 0.55);
    bloom.addColorStop(0, 'rgba(170,205,240,0.30)');
    bloom.addColorStop(0.45, 'rgba(90,140,200,0.12)');
    bloom.addColorStop(1, 'rgba(40,80,150,0)');
    g.fillStyle = bloom;
    g.fillRect(0, 0, W, horizon);

    // Giant word set behind the skyline: the towers overlap its lower half.
    // Left-aligned starting clear of the title column, sized to fill the space to the right edge without clipping.
    var word = 'PATENT';
    var fs = Math.min(W * 0.26, horizon * 0.62);
    g.save();
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    g.font = '700 ' + fs + 'px "Be Vietnam Pro", sans-serif';
    // keep the size (it needs height to clear the buildings) — slide it left instead of shrinking if it would clip
    var w0 = g.measureText(word).width;
    var wordX = Math.min(W * 0.46, W * 0.98 - w0);
    if ('letterSpacing' in g) g.letterSpacing = Math.round(fs * 0.04) + 'px';
    var wy = horizon - horizon * 0.06;
    var wg = g.createLinearGradient(0, wy - fs * 0.8, 0, wy);
    // brushed chrome: bright crown, dark waist band, a second highlight, fading base
    wg.addColorStop(0, 'rgba(240,246,255,0.34)');
    wg.addColorStop(0.42, 'rgba(160,185,225,0.16)');
    wg.addColorStop(0.5, 'rgba(30,60,110,0.10)');
    wg.addColorStop(0.58, 'rgba(210,228,255,0.26)');
    wg.addColorStop(1, 'rgba(120,150,200,0.05)');
    g.fillStyle = wg;
    g.fillText(word, wordX, wy);
    g.lineWidth = 1 * dpr;
    g.strokeStyle = 'rgba(214,230,255,0.22)';
    g.strokeText(word, wordX, wy);
    g.restore();

    // City light haze on the horizon
    var haze = g.createRadialGradient(W * 0.55, horizon, 0, W * 0.55, horizon, W * 0.6);
    haze.addColorStop(0, 'rgba(111,166,255,0.45)');
    haze.addColorStop(0.4, 'rgba(47,107,255,0.14)');
    haze.addColorStop(1, 'rgba(47,107,255,0)');
    g.fillStyle = haze;
    g.fillRect(0, 0, W, horizon);

    // Three shooting-star trails — one per stage of the idea's journey (Ý tưởng → Sáng chế →
    // Hệ sinh thái), not an arbitrary count.
    g.save();
    g.lineCap = 'round';
    [[0.03, 0.10, 0.16, 0.20], [0.02, 0.26, 0.13, 0.335], [0.10, 0.42, 0.19, 0.475]].forEach(function (t, ti) {
      var x0 = t[0] * W, y0 = t[1] * horizon, x1 = t[2] * W, y1 = t[3] * horizon;
      var trail = g.createLinearGradient(x0, y0, x1, y1);
      trail.addColorStop(0, 'rgba(230,240,255,0)');
      trail.addColorStop(1, 'rgba(230,240,255,' + (0.5 - ti * 0.08) + ')');
      g.strokeStyle = trail;
      g.lineWidth = (1.1 - ti * 0.15) * dpr;
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    });
    g.restore();

    // Stars
    for (var s = 0; s < 140; s++) {
      g.fillStyle = 'rgba(214,230,255,' + (0.15 + r() * 0.5) + ')';
      var sz = r() < 0.9 ? 1 : 1.6;
      g.fillRect(r() * W, r() * horizon * 0.6, sz * dpr, sz * dpr);
    }

    g = bgCtx;
    tops = []; twinkles = [];
    var layers = [
      { fill: '#0b1f4d', rim: 0.10, hMin: 0.06, hMax: 0.20, wMin: 26, wMax: 60, win: 0.10, gap: 2 },
      { fill: '#07163a', rim: 0.22, hMin: 0.08, hMax: 0.26, wMin: 30, wMax: 74, win: 0.18, gap: 8 },
      { fill: '#040d26', rim: 0.35, hMin: 0.04, hMax: 0.14, wMin: 40, wMax: 96, win: 0.26, gap: 18 }
    ];
    layers.forEach(function (L, li) {
      var x = -20 * scale;
      while (x < W) {
        var w = (L.wMin + r() * (L.wMax - L.wMin)) * scale;
        var hFrac = L.hMin + r() * (L.hMax - L.hMin);
        // Taller towers cluster around the centre-right, under the dome's peak
        var centre = 1 - Math.min(1, Math.abs(x + w / 2 - dome.cx) / (W * 0.4));
        hFrac *= 0.7 + centre * 0.6;
        var h = hFrac * H;
        drawBuilding(g, x, w, h, L, li, r);
        x += w + (r() * L.gap) * scale;
      }
      if (li === 1) drawLandmarks(g, L, r);
    });

    // Water with reflection
    g.save();
    g.translate(0, horizon * 2);
    g.scale(1, -1);
    g.globalAlpha = 0.62;
    g.drawImage(sky, 0, 0, W, horizon, 0, 0, W, horizon);
    g.globalAlpha = 0.42;
    g.drawImage(bg, 0, 0, W, horizon, 0, 0, W, horizon);
    g.restore();
    var water = g.createLinearGradient(0, horizon, 0, H);
    water.addColorStop(0, 'rgba(4,13,38,0.22)');
    water.addColorStop(1, 'rgba(2,6,18,0.82)');
    g.fillStyle = water;
    g.fillRect(0, horizon, W, H - horizon);
    // Perspective grid on the water: lines converge on the horizon under the dome
    g.save();
    g.lineWidth = 1 * dpr;
    var vx = dome.cx, depth = H - horizon;
    for (var gi = -18; gi <= 18; gi++) {
      var bx = vx + gi * W * 0.09;
      var lg = g.createLinearGradient(0, horizon, 0, H);
      lg.addColorStop(0, 'rgba(111,166,255,0)');
      lg.addColorStop(1, 'rgba(111,166,255,' + (0.16 - Math.abs(gi) * 0.005) + ')');
      g.strokeStyle = lg;
      g.beginPath(); g.moveTo(vx + gi * W * 0.006, horizon); g.lineTo(bx, H); g.stroke();
    }
    for (var gj = 1; gj <= 9; gj++) {
      var yy = horizon + depth * Math.pow(gj / 9, 1.9);
      g.strokeStyle = 'rgba(111,166,255,' + (0.03 + gj * 0.012) + ')';
      g.beginPath(); g.moveTo(0, yy); g.lineTo(W, yy); g.stroke();
    }
    g.restore();
    // Ripples
    for (var k = 0; k < 70; k++) {
      var ry = horizon + Math.pow(r(), 1.6) * (H - horizon);
      g.fillStyle = 'rgba(150,190,255,' + (0.03 + r() * 0.08) + ')';
      g.fillRect(r() * W, ry, (20 + r() * 120) * scale, 1 * dpr);
    }
    // Shoreline glow
    var shore = g.createLinearGradient(0, horizon - 2 * dpr, 0, horizon + 6 * dpr);
    shore.addColorStop(0, 'rgba(111,166,255,0)');
    shore.addColorStop(0.5, 'rgba(160,200,255,0.35)');
    shore.addColorStop(1, 'rgba(111,166,255,0)');
    g.fillStyle = shore;
    g.fillRect(0, horizon - 2 * dpr, W, 8 * dpr);
  }

  // Two signature towers: a stepped supertall with a crown (Landmark 81-like)
  // and a tapered tower with a helipad disc (Bitexco-like).
  function drawLandmarks(g, L, r) {
    var base = horizon;
    // Stepped supertall
    var w1 = 64 * scale, x1 = dome.cx + W * 0.04, h1 = Math.min(H * 0.5, W * 0.5);
    // Tiers stack from the widest base up to the narrow crown
    var tiers = [[0, 0.62], [0.1, 0.78], [0.2, 0.9], [0.3, 1]];
    var glass = g.createLinearGradient(x1, 0, x1 + w1, 0);
    glass.addColorStop(0, '#1d4296');
    glass.addColorStop(0.45, '#0e2a66');
    glass.addColorStop(1, '#081a44');
    tiers.forEach(function (tr) {
      var inset = w1 * tr[0];
      var th = h1 * tr[1];
      g.fillStyle = glass;
      g.fillRect(x1 + inset, base - th, w1 - inset * 2, th);
      var rim = g.createLinearGradient(0, base - th, 0, base);
      rim.addColorStop(0, 'rgba(214,230,255,0.8)');
      rim.addColorStop(1, 'rgba(190,215,255,0)');
      g.fillStyle = rim;
      g.fillRect(x1 + inset, base - th, 1.2 * dpr, th);
      g.fillRect(x1 + inset, base - th, w1 - inset * 2, 1 * dpr);
    });
    // Spire: a solid, tapered point — a church-steeple silhouette, not a thin antenna —
    // so the tower reads as sharp and finished, not trailing off into the sky.
    var tipX = x1 + w1 / 2, crownY = base - h1, tipY = Math.max(H * 0.1, base - h1 * 1.16);
    towerTip.x = tipX; towerTip.y = tipY;   // the golden spiral's pole starts exactly here
    var spireBase = w1 * 0.4;
    var spireGrad = g.createLinearGradient(tipX - spireBase / 2, 0, tipX + spireBase / 2, 0);
    spireGrad.addColorStop(0, '#2a4fa8'); spireGrad.addColorStop(0.5, '#12306e'); spireGrad.addColorStop(1, '#0a1f4d');
    g.fillStyle = spireGrad;
    g.beginPath();
    g.moveTo(tipX - spireBase / 2, crownY); g.lineTo(tipX + spireBase / 2, crownY); g.lineTo(tipX, tipY);
    g.closePath(); g.fill();
    g.strokeStyle = 'rgba(214,230,255,0.6)'; g.lineWidth = 1 * dpr;
    g.beginPath(); g.moveTo(tipX - spireBase / 2, crownY); g.lineTo(tipX, tipY); g.stroke();
    // The spire's star: the one fixed point every patent-node flash must stay smaller than,
    // so the eye always resolves back to the tower — this is the image's centre, not a detail.
    var starR = 46 * scale;
    var starGlow = g.createRadialGradient(tipX, tipY, 0, tipX, tipY, starR);
    starGlow.addColorStop(0, 'rgba(255,255,255,0.55)');
    starGlow.addColorStop(0.3, 'rgba(214,230,255,0.3)');
    starGlow.addColorStop(1, 'rgba(214,230,255,0)');
    g.fillStyle = starGlow;
    g.beginPath(); g.arc(tipX, tipY, starR, 0, 6.283); g.fill();
    // a hard, sharp core — this is the part that actually reads as "a point", the halo alone did not
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(tipX, tipY, 5 * scale, 0, 6.283); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1 * dpr;
    g.beginPath(); g.arc(tipX, tipY, 8 * scale, 0, 6.283); g.stroke();
    // Vertical light strips (kept below the crown so they don't blur into the spire)
    g.fillStyle = 'rgba(111,166,255,0.3)';
    for (var s = 1; s < 4; s++) g.fillRect(x1 + (w1 * s) / 4, base - h1 * 0.7, 1 * dpr, h1 * 0.7);
    tops.push({ x: x1 + w1 / 2, y: base - h1, w: w1 * 0.3 });

    // Tapered tower with helipad
    var w2 = 46 * scale, x2 = dome.cx - W * 0.16, h2 = Math.min(H * 0.36, W * 0.36);
    var glass2 = g.createLinearGradient(x2, 0, x2 + w2, 0);
    glass2.addColorStop(0, '#173a86'); glass2.addColorStop(1, '#081a44');
    g.fillStyle = glass2;
    g.beginPath();
    g.moveTo(x2, base); g.lineTo(x2 + w2 * 0.2, base - h2); g.lineTo(x2 + w2 * 0.8, base - h2); g.lineTo(x2 + w2, base);
    g.closePath(); g.fill();
    g.beginPath();
    g.ellipse(x2 + w2 * 0.35, base - h2 * 0.82, w2 * 0.55, w2 * 0.12, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(190,215,255,0.5)';
    g.lineWidth = 1 * dpr;
    g.stroke();
    g.fillStyle = 'rgba(111,166,255,0.3)';
    g.fillRect(x2 + w2 * 0.5, base - h2, 1 * dpr, h2);
    tops.push({ x: x2 + w2 / 2, y: base - h2, w: w2 * 0.4 });
  }

  function drawBuilding(g, x, w, h, L, li, r) {
    var base = horizon, top = base - h;
    var kind = r();
    g.fillStyle = L.fill;
    g.beginPath();
    if (kind < 0.18 && li > 0) {
      // Stepped tower (setbacks)
      var s1 = w * 0.15, s2 = w * 0.3;
      g.moveTo(x, base); g.lineTo(x, top + h * 0.25); g.lineTo(x + s1, top + h * 0.25);
      g.lineTo(x + s1, top + h * 0.1); g.lineTo(x + s2, top + h * 0.1); g.lineTo(x + s2, top);
      g.lineTo(x + w - s2, top); g.lineTo(x + w - s2, top + h * 0.1); g.lineTo(x + w - s1, top + h * 0.1);
      g.lineTo(x + w - s1, top + h * 0.25); g.lineTo(x + w, top + h * 0.25); g.lineTo(x + w, base);
    } else if (kind < 0.32) {
      // Slanted roof
      var up = r() < 0.5;
      g.moveTo(x, base); g.lineTo(x, top + (up ? h * 0.08 : 0)); g.lineTo(x + w, top + (up ? 0 : h * 0.08)); g.lineTo(x + w, base);
    } else if (kind < 0.40 && li > 0) {
      // Tapered tower
      g.moveTo(x, base); g.lineTo(x + w * 0.12, top); g.lineTo(x + w * 0.88, top); g.lineTo(x + w, base);
    } else {
      g.rect(x, top, w, h);
    }
    g.closePath();
    g.fill();

    // Spire / antenna on some towers
    if (li > 0 && r() < 0.22) {
      g.fillStyle = L.fill;
      g.fillRect(x + w / 2 - 1 * dpr, top - h * 0.14, 2 * dpr, h * 0.14);
      g.fillStyle = 'rgba(200,215,245,0.85)';
      g.fillRect(x + w / 2 - 1 * dpr, top - h * 0.14, 2 * dpr, 2 * dpr);
    }

    // Rim light from the dome glow
    var rim = g.createLinearGradient(0, top, 0, base);
    rim.addColorStop(0, 'rgba(160,200,255,' + L.rim + ')');
    rim.addColorStop(1, 'rgba(160,200,255,0)');
    g.fillStyle = rim;
    g.fillRect(x, top, 1 * dpr, h);
    g.fillRect(x, top, w, 1 * dpr);

    // Windows
    var cw = 6 * scale, chh = 9 * scale;
    var ww = Math.max(1.5 * dpr, 2.4 * scale), wh = Math.max(1.5 * dpr, 3 * scale);
    for (var wy = top + chh; wy < base - chh; wy += chh) {
      for (var wx = x + cw * 0.6; wx < x + w - cw * 0.6; wx += cw) {
        if (r() > L.win) continue;
        var c = r();
        var col = c < 0.75 ? 'rgba(170,205,255,' : 'rgba(255,255,255,';
        var a = 0.25 + r() * 0.6;
        g.fillStyle = col + a + ')';
        g.fillRect(wx, wy, ww, wh);
        if (li === 2 && r() < 0.05) twinkles.push({ x: wx, y: wy, w: ww, h: wh, col: col, phase: r() * 6.28, speed: 0.4 + r() * 1.6 });
      }
    }

    if (li > 0 && h > H * 0.12) tops.push({ x: x + w / 2, y: top, w: w });
  }

  // ---------- Data beams: crisp light lines with travelling signal pulses ----------
  // Each beam is a cubic curve from the city towards the sky; drawn at full resolution.
  var BEAMS = [
    { a: [0.02, 0.94], b: [0.30, 0.40], c: [0.62, 0.62], d: [1.02, 0.18], w: 1.6, speed: 0.10, color: [111, 166, 255] },
    { a: [-0.02, 0.60], b: [0.25, 0.30], c: [0.55, 0.30], d: [1.02, 0.34], w: 1.2, speed: 0.07, color: [120, 220, 255] },
    { a: [0.10, 1.02], b: [0.45, 0.72], c: [0.70, 0.48], d: [1.02, 0.52], w: 1.3, speed: 0.13, color: [160, 200, 255] },
    { a: [-0.02, 0.36], b: [0.35, 0.16], c: [0.70, 0.12], d: [1.02, 0.06], w: 0.9, speed: 0.05, color: [111, 166, 255] }
  ];
  function bez(p0, p1, p2, p3, t) {
    var u = 1 - t;
    return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
  }
  function drawBeams() {
    var hz = horizon;
    ctx.save();
    ctx.lineCap = 'round';
    BEAMS.forEach(function (bm, k) {
      var P = function (pt) { return [pt[0] * W, pt[1] * hz]; };
      var A = P(bm.a), B = P(bm.b), C = P(bm.c), D = P(bm.d);
      var col = bm.color.join(',');
      // faint rail
      var rail = ctx.createLinearGradient(A[0], A[1], D[0], D[1]);
      rail.addColorStop(0, 'rgba(' + col + ',0)');
      rail.addColorStop(0.35, 'rgba(' + col + ',0.42)');
      rail.addColorStop(1, 'rgba(' + col + ',0.12)');
      ctx.strokeStyle = rail;
      ctx.lineWidth = bm.w * dpr;
      ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.bezierCurveTo(B[0], B[1], C[0], C[1], D[0], D[1]); ctx.stroke();
      // travelling pulses
      for (var j = 0; j < 2; j++) {
        var t = ((time * bm.speed + k * 0.27 + j * 0.5) % 1);
        var seg = 0.09;
        ctx.beginPath();
        for (var i = 0; i <= 14; i++) {
          var tt = Math.max(0, t - seg + (seg * i) / 14);
          var x = bez(A[0], B[0], C[0], D[0], tt), y = bez(A[1], B[1], C[1], D[1], tt);
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        var hx = bez(A[0], B[0], C[0], D[0], t), hy = bez(A[1], B[1], C[1], D[1], t);
        var tx = bez(A[0], B[0], C[0], D[0], Math.max(0, t - seg)), ty = bez(A[1], B[1], C[1], D[1], Math.max(0, t - seg));
        var g = ctx.createLinearGradient(tx, ty, hx, hy);
        g.addColorStop(0, 'rgba(' + col + ',0)');
        g.addColorStop(1, 'rgba(235,245,255,0.95)');
        ctx.strokeStyle = g;
        ctx.lineWidth = (bm.w + 0.8) * dpr;
        ctx.shadowColor = 'rgba(' + col + ',0.9)';
        ctx.shadowBlur = 10 * dpr;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(hx, hy, 1.8 * dpr, 0, 6.283); ctx.fill();
      }
    });
    ctx.restore();
  }

  // ---------- Dynamic layer ----------
  function makeNode(x, y, born) {
    return {
      x: x, y: y,
      vx: (Math.random() - 0.5) * 6 * scale, vy: (Math.random() - 0.5) * 4 * scale,
      r: (1.4 + Math.random() * 1.8) * scale,
      age: born ? 0 : 99, life: 18 + Math.random() * 22, phase: Math.random() * 6.28
    };
  }

  function insideDome(x, y, margin) {
    var dx = (x - dome.cx) / (dome.rx - margin), dy = (y - dome.cy) / (dome.ry - margin);
    if (dx * dx + dy * dy >= 1 || y >= horizon - H * 0.2) return false;
    // stay clear of the title column on the left — the network belongs to the tower's side
    if (x < W * 0.48) return false;
    // keep a clear halo around the tower's spire — patents drift, but never crowd the tip
    var tdx = x - towerTip.x, tdy = y - towerTip.y;
    return tdx * tdx + tdy * tdy > (70 * scale) * (70 * scale);
  }

  function randomNodePos() {
    for (var i = 0; i < 40; i++) {
      var x = dome.cx + (Math.random() - 0.5) * dome.rx * 1.8;
      var y = dome.cy - Math.random() * dome.ry;
      if (insideDome(x, y, 30 * scale)) return { x: x, y: y };
    }
    return { x: dome.cx, y: dome.cy - dome.ry * 0.5 };
  }

  function spawnSpark() {
    if (!tops.length) return;
    var t = tops[(Math.random() * tops.length) | 0];
    var target = randomNodePos();
    sparks.push({ x: t.x + (Math.random() - 0.5) * t.w * 0.5, y: t.y, tx: target.x, ty: target.y, p: 0, speed: 0.18 + Math.random() * 0.22, sx: 0, sy: 0 });
    var s = sparks[sparks.length - 1]; s.sx = s.x; s.sy = s.y;
  }

  // The "shield": a true golden spiral (r = a·e^(bθ), b chosen so radius scales by φ every
  // quarter turn — the same curve as a nautilus shell). Its pole sits exactly on the tallest
  // tower's spire, so the tower reads as the origin the whole city's growth spirals out from;
  // 1.5 turns is the shortest sweep that reads as a closed, deliberate loop rather than a
  // stray arc. Meaning over decoration: nothing here is placed by eye.
  var SPIRAL_B = Math.log(PHI) / (Math.PI / 2);
  var SPIRAL_TURNS = 1.05;
  function drawDome() {
    var pulse = 0.55 + 0.45 * Math.sin(time * 0.6);
    ctx.save();
    // the shield belongs to the sky above the city — never let it sweep down past the horizon
    ctx.beginPath(); ctx.rect(0, 0, W, horizon); ctx.clip();
    var thetaMax = SPIRAL_TURNS * 2 * Math.PI;
    var targetR = Math.min(W, H * 1.6) * 0.6;
    var a = targetR / Math.exp(SPIRAL_B * thetaMax);
    var phase = -Math.PI * 0.5; // the tail leaves the spire heading straight up, then sweeps left
    var N = 160;
    var pts = [];
    for (var i = 0; i <= N; i++) {
      var t = (i / N) * thetaMax;
      var r = a * Math.exp(SPIRAL_B * t);
      pts.push([towerTip.x + r * Math.cos(t + phase), towerTip.y + r * Math.sin(t + phase)]);
    }
    // soft fill under the spiral's big loop, so it reads as a shield, not just a line
    var fill = ctx.createRadialGradient(pts[N][0], pts[N][1], 0, pts[N][0], pts[N][1], targetR * 0.9);
    fill.addColorStop(0, 'rgba(111,166,255,0.10)');
    fill.addColorStop(1, 'rgba(111,166,255,0)');
    ctx.fillStyle = fill;
    ctx.beginPath(); ctx.arc(pts[N][0], pts[N][1], targetR * 0.9, 0, 6.283); ctx.fill();

    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(111,166,255,0.7)';
    ctx.shadowBlur = 16 * dpr;
    ctx.strokeStyle = 'rgba(190,215,255,' + (0.3 + 0.12 * pulse) + ')';
    ctx.lineWidth = 1.4 * dpr;
    ctx.beginPath();
    pts.forEach(function (p, i) { i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); });
    ctx.stroke();

    // a travelling highlight running out along the curve, tail to crown
    var hp = Math.floor(((time * 0.08) % 1) * N);
    ctx.shadowBlur = 10 * dpr;
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2.4 * dpr;
    ctx.beginPath();
    for (var k = Math.max(0, hp - 14); k <= hp; k++) { var p2 = pts[k]; k === Math.max(0, hp - 14) ? ctx.moveTo(p2[0], p2[1]) : ctx.lineTo(p2[0], p2[1]); }
    ctx.stroke();
    ctx.restore();
  }

  function frame(dt) {
    time += dt;
    ctx.drawImage(sky, 0, 0);
    ctx.drawImage(bg, 0, 0);
    drawBeams();

    // Twinkling windows
    for (var i = 0; i < twinkles.length; i++) {
      var tw = twinkles[i];
      var a = 0.5 + 0.5 * Math.sin(time * tw.speed + tw.phase);
      ctx.fillStyle = tw.col + (a * 0.9).toFixed(2) + ')';
      ctx.fillRect(tw.x, tw.y, tw.w, tw.h);
    }


    // Rising ideas
    ctx.save();
    for (var s = sparks.length - 1; s >= 0; s--) {
      var sp = sparks[s];
      sp.p = Math.min(1, sp.p + dt * sp.speed);
      var e = 1 - Math.pow(1 - sp.p, 2);
      var px = sp.sx + (sp.tx - sp.sx) * e + Math.sin(sp.p * 8 + s) * 6 * scale;
      var py = sp.sy + (sp.ty - sp.sy) * e;
      var trail = ctx.createLinearGradient(px, py, px, py + 40 * scale);
      trail.addColorStop(0, 'rgba(214,230,255,0.8)');
      trail.addColorStop(1, 'rgba(111,166,255,0)');
      ctx.fillStyle = trail;
      ctx.fillRect(px - 0.75 * dpr, py, 1.5 * dpr, 40 * scale);
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(px, py, 1.6 * scale, 0, 6.283); ctx.fill();
      if (sp.p >= 1) {
        sparks.splice(s, 1);
        if (nodes.length >= maxNodes) {
          // retire the oldest patent to keep the ecosystem evolving
          var oldest = 0;
          for (var o = 1; o < nodes.length; o++) if (nodes[o].age > nodes[oldest].age) oldest = o;
          nodes.splice(oldest, 1);
        }
        nodes.push(makeNode(sp.tx, sp.ty, true));
      }
    }
    ctx.restore();

    // Patents drift inside the dome
    for (var n = 0; n < nodes.length; n++) {
      var nd = nodes[n];
      nd.age += dt;
      nd.x += nd.vx * dt; nd.y += nd.vy * dt;
      if (!insideDome(nd.x, nd.y, 20 * scale)) {
        nd.vx *= -1; nd.vy *= -1;
        nd.x += nd.vx * dt * 2; nd.y += nd.vy * dt * 2;
      }
    }

    // Ecosystem links
    var maxD = 95 * scale, maxD2 = maxD * maxD;
    ctx.lineWidth = 1 * dpr;
    for (var p = 0; p < nodes.length; p++) {
      for (var q = p + 1; q < nodes.length; q++) {
        var dx = nodes[p].x - nodes[q].x, dy = nodes[p].y - nodes[q].y, d2 = dx * dx + dy * dy;
        if (d2 < maxD2) {
          var grow = Math.min(1, Math.min(nodes[p].age, nodes[q].age) / 1.5);
          ctx.strokeStyle = 'rgba(111,166,255,' + ((1 - d2 / maxD2) * 0.45 * grow).toFixed(3) + ')';
          ctx.beginPath(); ctx.moveTo(nodes[p].x, nodes[p].y); ctx.lineTo(nodes[q].x, nodes[q].y); ctx.stroke();
        }
      }
    }

    // Nodes with glow; new patents flash as they are "granted"
    for (var m = 0; m < nodes.length; m++) {
      var nn = nodes[m];
      var flash = nn.age < 1.2 ? 1 - nn.age / 1.2 : 0;
      var glowR = nn.r * (5 + flash * 10);
      var gl = ctx.createRadialGradient(nn.x, nn.y, 0, nn.x, nn.y, glowR);
      gl.addColorStop(0, 'rgba(160,200,255,' + (0.35 + flash * 0.5) + ')');
      gl.addColorStop(1, 'rgba(111,166,255,0)');
      ctx.fillStyle = gl;
      ctx.beginPath(); ctx.arc(nn.x, nn.y, glowR, 0, 6.283); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,' + (0.75 + 0.25 * Math.sin(time * 2 + nn.phase)) + ')';
      ctx.beginPath(); ctx.arc(nn.x, nn.y, nn.r, 0, 6.283); ctx.fill();
      if (flash > 0) {
        ctx.strokeStyle = 'rgba(214,230,255,' + flash + ')';
        ctx.lineWidth = 1 * dpr;
        ctx.beginPath(); ctx.arc(nn.x, nn.y, nn.r + (1 - flash) * 24 * scale, 0, 6.283); ctx.stroke();
      }
    }

    // Spawn new ideas
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnSpark();
      spawnTimer = 1.6 + Math.random() * 1.6;
    }

    // Redraw the spire's star dead last: beams, links and sparks all pass behind the tower in
    // real life, but on a flat canvas any of them can paint over the tip. Wipe a small patch of
    // clean sky around it and put the star back — nothing is ever allowed to cross this point.
    var wipeR = 26 * scale;
    var wipe = ctx.createRadialGradient(towerTip.x, towerTip.y, 0, towerTip.x, towerTip.y, wipeR);
    var skyAt = towerTip.y < horizon * 0.5 ? '#02050d' : '#16447a';
    wipe.addColorStop(0, skyAt); wipe.addColorStop(0.7, skyAt); wipe.addColorStop(1, 'rgba(2,5,13,0)');
    ctx.fillStyle = wipe;
    ctx.beginPath(); ctx.arc(towerTip.x, towerTip.y, wipeR, 0, 6.283); ctx.fill();
    var haloR = 46 * scale;
    var halo = ctx.createRadialGradient(towerTip.x, towerTip.y, 0, towerTip.x, towerTip.y, haloR);
    halo.addColorStop(0, 'rgba(255,255,255,0.55)');
    halo.addColorStop(0.3, 'rgba(214,230,255,0.3)');
    halo.addColorStop(1, 'rgba(214,230,255,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(towerTip.x, towerTip.y, haloR, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(towerTip.x, towerTip.y, 5 * scale, 0, 6.283); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1 * dpr;
    ctx.beginPath(); ctx.arc(towerTip.x, towerTip.y, 8 * scale, 0, 6.283); ctx.stroke();
  }

  function loop(now) {
    if (!running) return;
    var dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    frame(dt);
    requestAnimationFrame(loop);
  }

  function start() {
    if (running || reduceMotion || !visible || document.hidden) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(loop);
  }
  function stop() { running = false; }

  function resize() {
    var rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, Math.round(rect.width * dpr));
    H = Math.max(1, Math.round(rect.height * dpr));
    canvas.width = W; canvas.height = H;
    scale = dpr * Math.max(0.7, Math.min(1.2, rect.width / 1400));
    horizon = H * 0.7;
    dome.cx = W * (rect.width < 760 ? 0.5 : 0.6);
    dome.cy = horizon;
    dome.rx = Math.max(W * 0.46, Math.min(W * 0.62, H * 0.9));
    dome.ry = horizon * 1.05;
    maxNodes = rect.width < 760 ? 13 : 21; // Fibonacci numbers — kept small, so the tower stays the one thing the eye settles on
    buildBackground();

    // Pre-populate so the ecosystem is visible immediately
    nodes = []; sparks = [];
    var initial = Math.round(maxNodes * 0.7);
    for (var i = 0; i < initial; i++) {
      var pos = randomNodePos();
      nodes.push(makeNode(pos.x, pos.y, false));
    }
    frame(0);
  }

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
  });
  document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      visible ? start() : stop();
    }).observe(canvas);
  }

  resize();
  canvas.classList.add('is-ready');
  if (document.fonts && document.fonts.load) {
    document.fonts.load('700 100px "Be Vietnam Pro"').then(function () { buildBackground(); if (!running) frame(0); }).catch(function () {});
  }
  start();
};
if (!document.documentElement.classList.contains('hero-gl')) window.startHeroScene();
