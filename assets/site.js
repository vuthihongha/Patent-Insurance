/* scoring.js */
/*
 * Self-assessment scoring. Shared by the browser (window.BHSCScoring) and the
 * server (require), so results and stored records always agree.
 * Weights follow the strategy's pilot criteria: S&T / high-tech firms, owned or
 * exploited patents, Hanoi & HCMC pilot locations, priority core technologies.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BHSCScoring = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var QUESTIONS = {
    type: ['st', 'hitech', 'startup', 'sme', 'institute', 'individual'],
    patent: ['none', 'preparing', 'pending', 'granted'],
    use: ['produce', 'license', 'acquire', 'notyet'],
    market: ['domestic', 'export'],
    dispute: ['never', 'accused', 'infringed', 'ongoing'],
    sector: ['semi', 'quantum', 'energy', 'digital', 'bio', 'other'],
    city: ['hanoi', 'hcmc', 'other'],
    budget: ['yes', 'hard', 'no']
  };

  // Pilot readiness, max 100
  var READINESS = {
    type: { st: 30, hitech: 30, startup: 22, institute: 16, sme: 12, individual: 8 },
    patent: { granted: 20, pending: 15, preparing: 8, none: 0 },
    use: { produce: 15, license: 15, acquire: 10, notyet: 3 },
    city: { hanoi: 20, hcmc: 20, other: 8 },
    sector: { semi: 15, quantum: 15, energy: 15, digital: 11, bio: 11, other: 6 }
  };

  var PRIORITY_SECTORS = ['semi', 'quantum', 'energy'];

  function isValid(a) {
    if (!a || typeof a !== 'object') return false;
    return Object.keys(QUESTIONS).every(function (k) {
      return QUESTIONS[k].indexOf(a[k]) !== -1;
    });
  }

  function money(a) { return a.budget === 'no' ? 2 : a.budget === 'hard' ? 1 : 0; }
  function fitOf(pct) { return pct >= 60 ? 'high' : pct >= 30 ? 'mid' : 'low'; }

  function score(a) {
    var readiness = 0;
    Object.keys(READINESS).forEach(function (k) { readiness += READINESS[k][a[k]]; });

    var application = { preparing: 6, pending: 6, none: 2, granted: 0 }[a.patent]
      + ({ individual: 2, startup: 2, institute: 1, sme: 1 }[a.type] || 0)
      + money(a);
    var legal = { granted: 4, pending: 2, preparing: 0, none: 0 }[a.patent]
      + (a.market === 'export' ? 2 : 0)
      + { infringed: 3, ongoing: 3, accused: 1, never: 0 }[a.dispute]
      + money(a)
      + (a.use === 'license' ? 1 : 0);
    var liability = { produce: 4, acquire: 4, license: 1, notyet: 0 }[a.use]
      + { accused: 4, ongoing: 2, infringed: 0, never: 0 }[a.dispute]
      + (a.market === 'export' ? 2 : 0);

    var products = [
      { id: 'application', pct: Math.round((application / 10) * 100) },
      { id: 'legal', pct: Math.round((legal / 12) * 100) },
      { id: 'liability', pct: Math.round((liability / 10) * 100) }
    ].map(function (p) { p.fit = fitOf(p.pct); return p; })
      .sort(function (x, y) { return y.pct - x.pct; });

    var tips = [];
    if (['sme', 'startup', 'institute'].indexOf(a.type) !== -1) tips.push('certify');
    if (a.patent === 'none') tips.push('file');
    if (a.use === 'notyet') tips.push('exploit');
    if (a.market === 'export') tips.push('export');
    if ((a.use === 'produce' || a.use === 'acquire') && a.dispute === 'never') tips.push('fto');
    if (a.budget !== 'yes') tips.push('support');
    if (a.city === 'other') tips.push('city');
    if (PRIORITY_SECTORS.indexOf(a.sector) !== -1) tips.push('priority');

    return {
      readiness: readiness,
      level: readiness >= 75 ? 'high' : readiness >= 50 ? 'mid' : 'low',
      products: products,
      tips: tips
    };
  }

  return { QUESTIONS: QUESTIONS, isValid: isValid, score: score };
});

;
/* hero-scene.js */
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
  // Two palettes: the night city, and a light morning city for the light theme
  function tone(dark, light) { return document.documentElement.getAttribute('data-theme') === 'light' ? light : dark; }

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
    skyGrad.addColorStop(0, tone('#02050d', '#cfe0f6'));
    skyGrad.addColorStop(0.5, tone('#071a3a', '#e6effb'));
    skyGrad.addColorStop(1, tone('#16447a', '#f7faff'));
    g.fillStyle = skyGrad;
    g.fillRect(0, 0, W, horizon);
    var bloom = g.createRadialGradient(W * 0.82, horizon * 0.05, 0, W * 0.82, horizon * 0.05, W * 0.55);
    bloom.addColorStop(0, tone('rgba(170,205,240,0.30)', 'rgba(255,255,255,0.85)'));
    bloom.addColorStop(0.45, tone('rgba(90,140,200,0.12)', 'rgba(255,255,255,0.3)'));
    bloom.addColorStop(1, tone('rgba(40,80,150,0)', 'rgba(255,255,255,0)'));
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
    wg.addColorStop(0, tone('rgba(240,246,255,0.34)', 'rgba(47,107,255,0.12)'));
    wg.addColorStop(0.42, tone('rgba(160,185,225,0.16)', 'rgba(29,78,216,0.06)'));
    wg.addColorStop(0.5, tone('rgba(30,60,110,0.10)', 'rgba(10,63,160,0.09)'));
    wg.addColorStop(0.58, tone('rgba(210,228,255,0.26)', 'rgba(47,107,255,0.11)'));
    wg.addColorStop(1, tone('rgba(120,150,200,0.05)', 'rgba(47,107,255,0.02)'));
    g.fillStyle = wg;
    g.fillText(word, wordX, wy);
    g.lineWidth = 1 * dpr;
    g.strokeStyle = tone('rgba(214,230,255,0.22)', 'rgba(29,78,216,0.16)');
    g.strokeText(word, wordX, wy);
    g.restore();

    // City light haze on the horizon
    var haze = g.createRadialGradient(W * 0.55, horizon, 0, W * 0.55, horizon, W * 0.6);
    haze.addColorStop(0, tone('rgba(111,166,255,0.45)', 'rgba(120,165,240,0.30)'));
    haze.addColorStop(0.4, tone('rgba(47,107,255,0.14)', 'rgba(150,190,250,0.12)'));
    haze.addColorStop(1, tone('rgba(47,107,255,0)', 'rgba(150,190,250,0)'));
    g.fillStyle = haze;
    g.fillRect(0, 0, W, horizon);

    // Three shooting-star trails — one per stage of the idea's journey (Ý tưởng → Sáng chế →
    // Hệ sinh thái), not an arbitrary count.
    g.save();
    g.lineCap = 'round';
    [[0.03, 0.10, 0.16, 0.20], [0.02, 0.26, 0.13, 0.335], [0.10, 0.42, 0.19, 0.475]].forEach(function (t, ti) {
      var x0 = t[0] * W, y0 = t[1] * horizon, x1 = t[2] * W, y1 = t[3] * horizon;
      var trail = g.createLinearGradient(x0, y0, x1, y1);
      trail.addColorStop(0, tone('rgba(230,240,255,0)', 'rgba(47,107,255,0)'));
      trail.addColorStop(1, tone('rgba(230,240,255,', 'rgba(47,107,255,') + (0.5 - ti * 0.08) + ')');
      g.strokeStyle = trail;
      g.lineWidth = (1.1 - ti * 0.15) * dpr;
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    });
    g.restore();

    // Stars
    for (var s = 0; s < 140; s++) {
      g.fillStyle = tone('rgba(214,230,255,', 'rgba(110,150,225,') + (0.15 + r() * 0.5) + ')';
      var sz = r() < 0.9 ? 1 : 1.6;
      g.fillRect(r() * W, r() * horizon * 0.6, sz * dpr, sz * dpr);
    }

    g = bgCtx;
    tops = []; twinkles = [];
    var layers = [
      { fill: tone('#0b1f4d', '#d3e0f4'), rim: 0.10, hMin: 0.06, hMax: 0.20, wMin: 26, wMax: 60, win: 0.10, gap: 2 },
      { fill: tone('#07163a', '#b3c7e8'), rim: 0.22, hMin: 0.08, hMax: 0.26, wMin: 30, wMax: 74, win: 0.18, gap: 8 },
      { fill: tone('#040d26', '#90aada'), rim: 0.35, hMin: 0.04, hMax: 0.14, wMin: 40, wMax: 96, win: 0.26, gap: 18 }
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
    water.addColorStop(0, tone('rgba(4,13,38,0.22)', 'rgba(235,242,252,0.35)'));
    water.addColorStop(1, tone('rgba(2,6,18,0.82)', 'rgba(205,220,243,0.92)'));
    g.fillStyle = water;
    g.fillRect(0, horizon, W, H - horizon);
    // Perspective grid on the water: lines converge on the horizon under the dome
    g.save();
    g.lineWidth = 1 * dpr;
    var vx = dome.cx, depth = H - horizon;
    for (var gi = -18; gi <= 18; gi++) {
      var bx = vx + gi * W * 0.09;
      var lg = g.createLinearGradient(0, horizon, 0, H);
      lg.addColorStop(0, tone('rgba(111,166,255,0)', 'rgba(47,107,255,0)'));
      lg.addColorStop(1, tone('rgba(111,166,255,', 'rgba(47,107,255,') + (0.16 - Math.abs(gi) * 0.005) + ')');
      g.strokeStyle = lg;
      g.beginPath(); g.moveTo(vx + gi * W * 0.006, horizon); g.lineTo(bx, H); g.stroke();
    }
    for (var gj = 1; gj <= 9; gj++) {
      var yy = horizon + depth * Math.pow(gj / 9, 1.9);
      g.strokeStyle = tone('rgba(111,166,255,', 'rgba(47,107,255,') + (0.03 + gj * 0.012) + ')';
      g.beginPath(); g.moveTo(0, yy); g.lineTo(W, yy); g.stroke();
    }
    g.restore();
    // Ripples
    for (var k = 0; k < 70; k++) {
      var ry = horizon + Math.pow(r(), 1.6) * (H - horizon);
      g.fillStyle = tone('rgba(150,190,255,', 'rgba(255,255,255,') + (0.03 + r() * 0.08) + ')';
      g.fillRect(r() * W, ry, (20 + r() * 120) * scale, 1 * dpr);
    }
    // Shoreline glow
    var shore = g.createLinearGradient(0, horizon - 2 * dpr, 0, horizon + 6 * dpr);
    shore.addColorStop(0, tone('rgba(111,166,255,0)', 'rgba(255,255,255,0)'));
    shore.addColorStop(0.5, tone('rgba(160,200,255,0.35)', 'rgba(255,255,255,0.8)'));
    shore.addColorStop(1, tone('rgba(111,166,255,0)', 'rgba(255,255,255,0)'));
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
    glass.addColorStop(0, tone('#1d4296', '#6f93d8'));
    glass.addColorStop(0.45, tone('#0e2a66', '#4a72c4'));
    glass.addColorStop(1, tone('#081a44', '#3559a8'));
    tiers.forEach(function (tr) {
      var inset = w1 * tr[0];
      var th = h1 * tr[1];
      g.fillStyle = glass;
      g.fillRect(x1 + inset, base - th, w1 - inset * 2, th);
      var rim = g.createLinearGradient(0, base - th, 0, base);
      rim.addColorStop(0, tone('rgba(214,230,255,0.8)', 'rgba(255,255,255,0.9)'));
      rim.addColorStop(1, tone('rgba(190,215,255,0)', 'rgba(255,255,255,0)'));
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
    spireGrad.addColorStop(0, tone('#2a4fa8', '#7d9fe0')); spireGrad.addColorStop(0.5, tone('#12306e', '#4a72c4')); spireGrad.addColorStop(1, tone('#0a1f4d', '#3559a8'));
    g.fillStyle = spireGrad;
    g.beginPath();
    g.moveTo(tipX - spireBase / 2, crownY); g.lineTo(tipX + spireBase / 2, crownY); g.lineTo(tipX, tipY);
    g.closePath(); g.fill();
    g.strokeStyle = tone('rgba(214,230,255,0.6)', 'rgba(255,255,255,0.8)'); g.lineWidth = 1 * dpr;
    g.beginPath(); g.moveTo(tipX - spireBase / 2, crownY); g.lineTo(tipX, tipY); g.stroke();
    // The spire's star: the one fixed point every patent-node flash must stay smaller than,
    // so the eye always resolves back to the tower — this is the image's centre, not a detail.
    var starR = 46 * scale;
    var starGlow = g.createRadialGradient(tipX, tipY, 0, tipX, tipY, starR);
    starGlow.addColorStop(0, tone('rgba(255,255,255,0.55)', 'rgba(255,255,255,0.95)'));
    starGlow.addColorStop(0.3, tone('rgba(214,230,255,0.3)', 'rgba(47,107,255,0.25)'));
    starGlow.addColorStop(1, tone('rgba(214,230,255,0)', 'rgba(47,107,255,0)'));
    g.fillStyle = starGlow;
    g.beginPath(); g.arc(tipX, tipY, starR, 0, 6.283); g.fill();
    // a hard, sharp core — this is the part that actually reads as "a point", the halo alone did not
    g.fillStyle = tone('#fff', '#2f6bff');
    g.beginPath(); g.arc(tipX, tipY, 5 * scale, 0, 6.283); g.fill();
    g.strokeStyle = tone('rgba(255,255,255,0.5)', 'rgba(29,78,216,0.5)'); g.lineWidth = 1 * dpr;
    g.beginPath(); g.arc(tipX, tipY, 8 * scale, 0, 6.283); g.stroke();
    // Vertical light strips (kept below the crown so they don't blur into the spire)
    g.fillStyle = tone('rgba(111,166,255,0.3)', 'rgba(255,255,255,0.45)');
    for (var s = 1; s < 4; s++) g.fillRect(x1 + (w1 * s) / 4, base - h1 * 0.7, 1 * dpr, h1 * 0.7);
    tops.push({ x: x1 + w1 / 2, y: base - h1, w: w1 * 0.3 });

    // Tapered tower with helipad
    var w2 = 46 * scale, x2 = dome.cx - W * 0.16, h2 = Math.min(H * 0.36, W * 0.36);
    var glass2 = g.createLinearGradient(x2, 0, x2 + w2, 0);
    glass2.addColorStop(0, tone('#173a86', '#6a8ed4')); glass2.addColorStop(1, tone('#081a44', '#3a62b2'));
    g.fillStyle = glass2;
    g.beginPath();
    g.moveTo(x2, base); g.lineTo(x2 + w2 * 0.2, base - h2); g.lineTo(x2 + w2 * 0.8, base - h2); g.lineTo(x2 + w2, base);
    g.closePath(); g.fill();
    g.beginPath();
    g.ellipse(x2 + w2 * 0.35, base - h2 * 0.82, w2 * 0.55, w2 * 0.12, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = tone('rgba(190,215,255,0.5)', 'rgba(255,255,255,0.7)');
    g.lineWidth = 1 * dpr;
    g.stroke();
    g.fillStyle = tone('rgba(111,166,255,0.3)', 'rgba(255,255,255,0.45)');
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
      g.fillStyle = tone('rgba(200,215,245,0.85)', 'rgba(29,78,216,0.8)');
      g.fillRect(x + w / 2 - 1 * dpr, top - h * 0.14, 2 * dpr, 2 * dpr);
    }

    // Rim light from the dome glow
    var rim = g.createLinearGradient(0, top, 0, base);
    rim.addColorStop(0, tone('rgba(160,200,255,', 'rgba(255,255,255,') + L.rim + ')');
    rim.addColorStop(1, tone('rgba(160,200,255,0)', 'rgba(255,255,255,0)'));
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
        var col = c < 0.75 ? tone('rgba(170,205,255,', 'rgba(255,255,255,') : tone('rgba(255,255,255,', 'rgba(228,238,255,');
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
    { a: [0.02, 0.94], b: [0.30, 0.40], c: [0.62, 0.62], d: [1.02, 0.18], w: 1.6, speed: 0.10, color: [[111, 166, 255], [47, 107, 255]] },
    { a: [-0.02, 0.60], b: [0.25, 0.30], c: [0.55, 0.30], d: [1.02, 0.34], w: 1.2, speed: 0.07, color: [[120, 220, 255], [29, 78, 216]] },
    { a: [0.10, 1.02], b: [0.45, 0.72], c: [0.70, 0.48], d: [1.02, 0.52], w: 1.3, speed: 0.13, color: [[160, 200, 255], [80, 130, 240]] },
    { a: [-0.02, 0.36], b: [0.35, 0.16], c: [0.70, 0.12], d: [1.02, 0.06], w: 0.9, speed: 0.05, color: [[111, 166, 255], [47, 107, 255]] }
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
      var col = tone(bm.color[0], bm.color[1]).join(',');
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
        g.addColorStop(1, tone('rgba(235,245,255,0.95)', 'rgba(29,78,216,0.95)'));
        ctx.strokeStyle = g;
        ctx.lineWidth = (bm.w + 0.8) * dpr;
        ctx.shadowColor = 'rgba(' + col + ',0.9)';
        ctx.shadowBlur = 10 * dpr;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = tone('#fff', '#1d4ed8');
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
    fill.addColorStop(0, tone('rgba(111,166,255,0.10)', 'rgba(47,107,255,0.06)'));
    fill.addColorStop(1, tone('rgba(111,166,255,0)', 'rgba(47,107,255,0)'));
    ctx.fillStyle = fill;
    ctx.beginPath(); ctx.arc(pts[N][0], pts[N][1], targetR * 0.9, 0, 6.283); ctx.fill();

    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.shadowColor = tone('rgba(111,166,255,0.7)', 'rgba(47,107,255,0.35)');
    ctx.shadowBlur = 16 * dpr;
    ctx.strokeStyle = tone('rgba(190,215,255,', 'rgba(29,78,216,') + (0.3 + 0.12 * pulse) + ')';
    ctx.lineWidth = 1.4 * dpr;
    ctx.beginPath();
    pts.forEach(function (p, i) { i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); });
    ctx.stroke();

    // a travelling highlight running out along the curve, tail to crown
    var hp = Math.floor(((time * 0.08) % 1) * N);
    ctx.shadowBlur = 10 * dpr;
    ctx.strokeStyle = tone('rgba(255,255,255,0.8)', 'rgba(29,78,216,0.85)');
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
      trail.addColorStop(0, tone('rgba(214,230,255,0.8)', 'rgba(29,78,216,0.7)'));
      trail.addColorStop(1, tone('rgba(111,166,255,0)', 'rgba(47,107,255,0)'));
      ctx.fillStyle = trail;
      ctx.fillRect(px - 0.75 * dpr, py, 1.5 * dpr, 40 * scale);
      ctx.fillStyle = tone('#fff', '#1d4ed8');
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
          ctx.strokeStyle = tone('rgba(111,166,255,', 'rgba(29,78,216,') + ((1 - d2 / maxD2) * 0.45 * grow).toFixed(3) + ')';
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
      gl.addColorStop(0, tone('rgba(160,200,255,', 'rgba(47,107,255,') + (0.35 + flash * 0.5) + ')');
      gl.addColorStop(1, tone('rgba(111,166,255,0)', 'rgba(47,107,255,0)'));
      ctx.fillStyle = gl;
      ctx.beginPath(); ctx.arc(nn.x, nn.y, glowR, 0, 6.283); ctx.fill();
      ctx.fillStyle = tone('rgba(255,255,255,', 'rgba(20,60,190,') + (0.75 + 0.25 * Math.sin(time * 2 + nn.phase)) + ')';
      ctx.beginPath(); ctx.arc(nn.x, nn.y, nn.r, 0, 6.283); ctx.fill();
      if (flash > 0) {
        ctx.strokeStyle = tone('rgba(214,230,255,', 'rgba(29,78,216,') + flash + ')';
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
    var skyAt = towerTip.y < horizon * 0.5 ? tone('#02050d', '#cfe0f6') : tone('#16447a', '#f7faff');
    wipe.addColorStop(0, skyAt); wipe.addColorStop(0.7, skyAt); wipe.addColorStop(1, tone('rgba(2,5,13,0)', 'rgba(247,250,255,0)'));
    ctx.fillStyle = wipe;
    ctx.beginPath(); ctx.arc(towerTip.x, towerTip.y, wipeR, 0, 6.283); ctx.fill();
    var haloR = 46 * scale;
    var halo = ctx.createRadialGradient(towerTip.x, towerTip.y, 0, towerTip.x, towerTip.y, haloR);
    halo.addColorStop(0, tone('rgba(255,255,255,0.55)', 'rgba(255,255,255,0.95)'));
    halo.addColorStop(0.3, tone('rgba(214,230,255,0.3)', 'rgba(47,107,255,0.25)'));
    halo.addColorStop(1, tone('rgba(214,230,255,0)', 'rgba(47,107,255,0)'));
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(towerTip.x, towerTip.y, haloR, 0, 6.283); ctx.fill();
    ctx.fillStyle = tone('#fff', '#2f6bff');
    ctx.beginPath(); ctx.arc(towerTip.x, towerTip.y, 5 * scale, 0, 6.283); ctx.fill();
    ctx.strokeStyle = tone('rgba(255,255,255,0.5)', 'rgba(29,78,216,0.5)'); ctx.lineWidth = 1 * dpr;
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
    // pause once the scene is mostly scrolled away, so the rest of the page scrolls smoothly
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting && entries[0].intersectionRatio >= 0.2;
      visible ? start() : stop();
    }, { threshold: [0, 0.2] }).observe(canvas);
  }

  // the light/dark switch: repaint the still layers in the other palette
  window.addEventListener('themechange', function () { buildBackground(); if (!running) frame(0); });

  resize();
  canvas.classList.add('is-ready');
  if (document.fonts && document.fonts.load) {
    document.fonts.load('700 100px "Be Vietnam Pro"').then(function () { buildBackground(); if (!running) frame(0); }).catch(function () {});
  }
  start();
};
if (!document.documentElement.classList.contains('hero-gl')) window.startHeroScene();

;
/* page-scene.js */
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
  // Two palettes: night sky, and a light morning sky for the light theme
  function tone(dark, light) { return document.documentElement.getAttribute('data-theme') === 'light' ? light : dark; }
  var base = document.createElement('canvas');
  var bctx = base.getContext('2d');
  var W = 0, H = 0, dpr = 1, horizon = 0, time = 0, running = false, visible = true, last = 0;

  var BEAMS = [
    { a: [-0.02, 0.70], b: [0.28, 0.36], c: [0.62, 0.58], d: [1.02, 0.20], w: 1.2, speed: 0.08, col: ['111,166,255', '47,107,255'] },
    { a: [-0.02, 0.42], b: [0.30, 0.22], c: [0.66, 0.18], d: [1.02, 0.30], w: 0.9, speed: 0.06, col: ['120,220,255', '29,78,216'] },
    { a: [0.18, 0.95], b: [0.46, 0.70], c: [0.74, 0.62], d: [1.02, 0.46], w: 1.0, speed: 0.11, col: ['160,200,255', '80,130,240'] }
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
    sky.addColorStop(0, tone('#02050d', '#cfe0f6'));
    sky.addColorStop(0.55, tone('#071a3a', '#e3edfb'));
    sky.addColorStop(0.86, tone('#123a6e', '#f2f6fd'));
    sky.addColorStop(1, tone('#030a1c', '#f4f7fc'));
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    var bloom = g.createRadialGradient(W * 0.8, 0, 0, W * 0.8, 0, W * 0.55);
    bloom.addColorStop(0, tone('rgba(170,205,240,0.26)', 'rgba(255,255,255,0.85)')); bloom.addColorStop(0.5, tone('rgba(90,140,200,0.10)', 'rgba(255,255,255,0.3)')); bloom.addColorStop(1, tone('rgba(40,80,150,0)', 'rgba(255,255,255,0)'));
    g.fillStyle = bloom; g.fillRect(0, 0, W, H);
    var bloom2 = g.createRadialGradient(W * 0.1, H * 0.9, 0, W * 0.1, H * 0.9, W * 0.45);
    bloom2.addColorStop(0, tone('rgba(47,107,255,0.22)', 'rgba(47,107,255,0.10)')); bloom2.addColorStop(1, tone('rgba(47,107,255,0)', 'rgba(47,107,255,0)'));
    g.fillStyle = bloom2; g.fillRect(0, 0, W, H);
    // stars
    for (var s = 0; s < 110; s++) { g.fillStyle = tone('rgba(214,230,255,', 'rgba(110,150,225,') + (0.12 + r() * 0.45) + ')'; g.fillRect(r() * W, r() * horizon * 0.8, dpr, dpr); }
    // giant word
    if (word) {
      var fs = Math.min(W / (word.length * 0.62), H * 0.46);
      g.save();
      g.font = '700 ' + fs + 'px "Be Vietnam Pro", sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      if ('letterSpacing' in g) g.letterSpacing = Math.round(fs * 0.03) + 'px';
      var y = horizon + fs * 0.08;
      var wg = g.createLinearGradient(0, y - fs * 0.8, 0, y);
      wg.addColorStop(0, tone('rgba(214,230,255,0.13)', 'rgba(29,78,216,0.10)')); wg.addColorStop(1, tone('rgba(214,230,255,0.015)', 'rgba(29,78,216,0.02)'));
      g.fillStyle = wg; g.fillText(word, W / 2, y);
      g.lineWidth = dpr; g.strokeStyle = tone('rgba(214,230,255,0.18)', 'rgba(29,78,216,0.16)'); g.strokeText(word, W / 2, y);
      g.restore();
    }
    // horizon line + perspective grid floor
    var hl = g.createLinearGradient(0, 0, W, 0);
    hl.addColorStop(0, tone('rgba(160,200,255,0)', 'rgba(47,107,255,0)')); hl.addColorStop(0.5, tone('rgba(200,225,255,0.55)', 'rgba(47,107,255,0.35)')); hl.addColorStop(1, tone('rgba(160,200,255,0)', 'rgba(47,107,255,0)'));
    g.fillStyle = hl; g.fillRect(0, horizon, W, dpr);
    var floor = g.createLinearGradient(0, horizon, 0, H);
    floor.addColorStop(0, tone('rgba(3,10,28,0.2)', 'rgba(244,247,252,0.2)')); floor.addColorStop(1, tone('rgba(3,10,28,0.95)', 'rgba(244,247,252,0.97)'));
    g.fillStyle = floor; g.fillRect(0, horizon + dpr, W, H - horizon);
    g.lineWidth = dpr;
    var vx = W / 2, depth = H - horizon;
    for (var i = -22; i <= 22; i++) {
      var lg = g.createLinearGradient(0, horizon, 0, H);
      lg.addColorStop(0, tone('rgba(111,166,255,0)', 'rgba(47,107,255,0)')); lg.addColorStop(1, tone('rgba(111,166,255,', 'rgba(47,107,255,') + Math.max(0.03, 0.17 - Math.abs(i) * 0.006) + ')');
      g.strokeStyle = lg; g.beginPath(); g.moveTo(vx + i * W * 0.005, horizon); g.lineTo(vx + i * W * 0.08, H); g.stroke();
    }
    for (var j = 1; j <= 7; j++) {
      var yy = horizon + depth * Math.pow(j / 7, 1.8);
      g.strokeStyle = tone('rgba(111,166,255,', 'rgba(47,107,255,') + (0.03 + j * 0.014) + ')'; g.beginPath(); g.moveTo(0, yy); g.lineTo(W, yy); g.stroke();
    }
  }

  function frame(dt) {
    time += dt;
    ctx.drawImage(base, 0, 0);
    ctx.save(); ctx.lineCap = 'round';
    BEAMS.forEach(function (bm, k) {
      var bcol = tone(bm.col[0], bm.col[1]);
      var A = [bm.a[0] * W, bm.a[1] * horizon], B = [bm.b[0] * W, bm.b[1] * horizon], C = [bm.c[0] * W, bm.c[1] * horizon], D = [bm.d[0] * W, bm.d[1] * horizon];
      var rail = ctx.createLinearGradient(A[0], A[1], D[0], D[1]);
      rail.addColorStop(0, 'rgba(' + bcol + ',0)'); rail.addColorStop(0.4, 'rgba(' + bcol + ',0.26)'); rail.addColorStop(1, 'rgba(' + bcol + ',0.05)');
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
      gr.addColorStop(0, 'rgba(' + bcol + ',0)'); gr.addColorStop(1, tone('rgba(235,245,255,0.95)', 'rgba(29,78,216,0.95)'));
      ctx.strokeStyle = gr; ctx.lineWidth = (bm.w + 0.8) * dpr;
      ctx.shadowColor = 'rgba(' + bcol + ',0.9)'; ctx.shadowBlur = 10 * dpr; ctx.stroke(); ctx.shadowBlur = 0;
      ctx.fillStyle = tone('#fff', '#1d4ed8'); ctx.beginPath(); ctx.arc(hx, hy, 1.7 * dpr, 0, 6.283); ctx.fill();
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
  window.addEventListener('themechange', function () { buildBase(); if (!running) frame(0); });
  resize();
  canvas.classList.add('is-ready');
  if (document.fonts && document.fonts.load) document.fonts.load('700 100px "Be Vietnam Pro"').then(function () { buildBase(); if (!running) frame(0); }).catch(function () {});
  start();
})();

;
/* main.js */
(function () {
  'use strict';
  window.BHSC_MAIN = true; // lets the static preview know the site script is running

  // Header background once the page scrolls
  var header = document.querySelector('[data-header]');
  function onScroll() {
    if (header) header.classList.toggle('is-scrolled', window.scrollY > 8);
  }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // Parallax: the hero scene drifts slower than the page, and the hero copy fades out
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var layers = Array.prototype.slice.call(document.querySelectorAll('[data-parallax]'));
  var heroFade = document.querySelector('[data-hero-fade]');
  if (!reduce && (layers.length || heroFade)) {
    var ticking = false;
    var paint = function () {
      var y = window.scrollY;
      var vh = window.innerHeight || 1;
      if (y < vh * 1.2) {
        layers.forEach(function (el) { el.style.transform = 'translate3d(0,' + (y * parseFloat(el.dataset.parallax)).toFixed(1) + 'px,0)'; });
        if (heroFade) {
          var k = Math.min(1, y / (vh * 0.7));
          heroFade.style.opacity = String(1 - k);
          heroFade.style.transform = 'translate3d(0,' + (y * 0.12).toFixed(1) + 'px,0)';
        }
      }
      ticking = false;
    };
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(paint); }
    }, { passive: true });
  }

  // Light / dark theme switch: remembered per browser, announced so the canvas scenes repaint
  var themeBtn = document.querySelector('[data-theme-toggle]');
  if (themeBtn) {
    var root = document.documentElement;
    var label = function () {
      var light = root.getAttribute('data-theme') === 'light';
      var text = light ? themeBtn.dataset.labelDark : themeBtn.dataset.labelLight;
      themeBtn.setAttribute('aria-label', text); themeBtn.title = text;
      themeBtn.setAttribute('aria-pressed', String(!light));
    };
    label();
    themeBtn.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      root.classList.add('theme-switching');
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('bhsc-theme-v2', next); } catch (e) {}
      label();
      window.dispatchEvent(new CustomEvent('themechange', { detail: next }));
      setTimeout(function () { root.classList.remove('theme-switching'); }, 450);
    });
  }

  // Warm the next page: fetch a same-site page as soon as the pointer rests on (or a finger touches)
  // its link, so the click itself only has to paint it
  var warmed = {};
  var warm = function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || a.target === '_blank') return;
    var href = a.getAttribute('href');
    if (!href || /^(https?:|mailto:|tel:|#|data:)/.test(href)) return;
    var url = href.split('#')[0];
    if (!url || warmed[url]) return;
    warmed[url] = true;
    var l = document.createElement('link'); l.rel = 'prefetch'; l.href = url; document.head.appendChild(l);
  };
  document.addEventListener('pointerover', warm, { passive: true });
  document.addEventListener('touchstart', warm, { passive: true });
  document.addEventListener('focusin', warm);

  // Mobile navigation
  var toggle = document.querySelector('[data-nav-toggle]');
  var nav = document.querySelector('[data-nav]');
  if (toggle && nav) {
    var setOpen = function (open) {
      nav.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? toggle.dataset.labelClose : toggle.dataset.labelOpen);
    };
    toggle.addEventListener('click', function () {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        setOpen(false);
        toggle.focus();
      }
    });
    window.matchMedia('(min-width: 1201px)').addEventListener('change', function (mq) {
      if (mq.matches) setOpen(false);
    });
  }

  // Reveal on scroll
  var revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('is-visible'); });
  }

  // Accessible tabs (WAI-ARIA pattern, automatic activation)
  document.querySelectorAll('[data-tabs]').forEach(function (root) {
    var tabs = Array.prototype.slice.call(root.querySelectorAll('[role="tab"]'));
    var panels = tabs.map(function (tab) { return document.getElementById(tab.getAttribute('aria-controls')); });
    function select(index, focus) {
      tabs.forEach(function (tab, i) {
        var active = i === index;
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
        panels[i].hidden = !active;
      });
      if (focus) tabs[index].focus();
    }
    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { select(i, false); });
      tab.addEventListener('keydown', function (e) {
        var next = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % tabs.length;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + tabs.length) % tabs.length;
        if (e.key === 'Home') next = 0;
        if (e.key === 'End') next = tabs.length - 1;
        if (next !== null) { e.preventDefault(); select(next, true); }
      });
    });
    select(0, false);
  });

  // Demo video in a modal dialog
  var modal = document.querySelector('[data-video-modal]');
  if (modal && typeof modal.showModal === 'function') {
    var video = modal.querySelector('[data-video]');
    var opener = null;
    // The tour was filmed in both themes: show the one that matches the page
    var isDark = function () { return document.documentElement.getAttribute('data-theme') !== 'light'; };
    var syncVideoTheme = function () {
      var t = isDark() ? 'dark' : 'light';
      var src = video.getAttribute('data-src-' + t), poster = video.getAttribute('data-poster-' + t);
      // the shared preview ships AV1 cuts; browsers without AV1 get the H.264 cut instead
      if (src && /-av1\.mp4$/.test(src) && !video.canPlayType('video/mp4; codecs="av01.0.08M.08"')) src = src.replace(/-av1\.mp4$/, '-lite.mp4');
      if (poster) video.setAttribute('poster', poster);
      if (src && video.getAttribute('src') !== src) { video.pause(); video.setAttribute('src', src); }
      document.querySelectorAll('[data-theme-src-' + t + ']').forEach(function (img) {
        img.setAttribute('src', img.getAttribute('data-theme-src-' + t));
      });
    };
    syncVideoTheme();
    window.addEventListener('themechange', syncVideoTheme);
    document.querySelectorAll('[data-video-open]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        opener = btn;
        syncVideoTheme();
        modal.showModal();
        var p = video.play(); if (p && p.catch) p.catch(function () {});
      });
    });
    var closeModal = function () { video.pause(); modal.close(); };
    modal.querySelector('[data-video-close]').addEventListener('click', closeModal);
    modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
    modal.addEventListener('close', function () { video.pause(); if (opener) opener.focus(); });
  }

  // Copy buttons (e.g. the citation on the About page)
  document.querySelectorAll('[data-copy]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var src = document.querySelector(btn.dataset.copy);
      if (!src) return;
      var text = src.textContent.trim();
      var done = function () {
        var label = btn.textContent;
        btn.textContent = btn.dataset.copied;
        setTimeout(function () { btn.textContent = label; }, 1800);
      };
      var fallback = function () {
        var range = document.createRange();
        range.selectNodeContents(src);
        var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, fallback);
      } else { fallback(); }
    });
  });

  // Table-of-contents scrollspy
  var tocLinks = document.querySelectorAll('[data-toc-link]');
  if (tocLinks.length && 'IntersectionObserver' in window) {
    var byId = {};
    tocLinks.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        tocLinks.forEach(function (a) { a.classList.remove('is-active'); a.removeAttribute('aria-current'); });
        var link = byId[entry.target.id];
        if (link) { link.classList.add('is-active'); link.setAttribute('aria-current', 'true'); }
      });
    }, { rootMargin: '-30% 0px -60% 0px' });
    Object.keys(byId).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) spy.observe(el);
    });
  }
})();

;
/* assistant.js */
/*
 * "Trợ lý đề tài": an offline Q&A assistant built from the research content.
 * Retrieval runs entirely in the browser (diacritic-insensitive token + bigram scoring),
 * so it works on any host and in the static share link; answers link to the right page.
 * Designed so a real LLM backend can later replace `answer()` (POST /api/assistant).
 */
(function () {
  'use strict';
  var lang = (document.documentElement.lang || 'vi').slice(0, 2) === 'en' ? 'en' : 'vi';

  // page links, read from the footer (keeps working after the static export rewrites hrefs)
  var KEYS = ['about', 'insurance', 'strategy', 'international', 'legal', 'tool', 'experts', 'library'];
  var LINKS = {};
  var fl = document.querySelectorAll('.footer-links a');
  KEYS.forEach(function (k, i) { if (fl[i]) LINKS[k] = fl[i].getAttribute('href'); });

  var T = {
    vi: {
      open: 'Hỏi trợ lý đề tài', title: 'Trợ lý đề tài', sub: 'Trả lời theo nội dung nghiên cứu',
      hello: 'Xin chào! Tôi là trợ lý của đề tài <b>Chiến lược Bảo hiểm Sáng chế</b>. Bạn có thể hỏi về bảo hiểm sáng chế, 03 sản phẩm đề xuất, lộ trình, kinh nghiệm quốc tế hoặc khung pháp lý.',
      placeholder: 'Nhập câu hỏi…', send: 'Gửi', close: 'Đóng', more: 'Xem thêm',
      fallback: 'Tôi chưa tìm thấy nội dung khớp trong đề tài. Bạn thử hỏi theo một trong các gợi ý dưới đây, hoặc dùng <a href="{tool}">công cụ tự đánh giá</a> để biết doanh nghiệp phù hợp loại bảo hiểm nào.',
      note: 'Thông tin mang tính tham khảo, trích từ nội dung đề tài; không thay thế tư vấn pháp lý.',
      chips: ['Bảo hiểm sáng chế là gì?', 'Đã mua được ở Việt Nam chưa?', 'Có mấy sản phẩm đề xuất?', 'Phí bảo hiểm bao nhiêu?', 'Doanh nghiệp nhỏ có tham gia được không?', 'Trung Quốc làm thế nào?']
    },
    en: {
      open: 'Ask the research assistant', title: 'Research assistant', sub: 'Answers drawn from the study',
      hello: 'Hello! I am the assistant for the <b>Patent Insurance Strategy</b> study. Ask about patent insurance, the 3 proposed products, the roadmap, international models or the legal framework.',
      placeholder: 'Type a question…', send: 'Send', close: 'Close', more: 'Read more',
      fallback: 'I could not find a matching answer in the study. Try one of the suggestions below, or use the <a href="{tool}">self-assessment tool</a> to see which cover fits your business.',
      note: 'For reference only, drawn from the study; not legal advice.',
      chips: ['What is patent insurance?', 'Can I buy it in Vietnam yet?', 'Which products are proposed?', 'How much does it cost?', 'Can small businesses join?', 'How does China do it?']
    }
  }[lang];

  // ---------------- knowledge base (from the study's content) ----------------
  var KB = {
    vi: [
      { k: 'bao hiem sang che la gi khai niem dinh nghia', a: 'Bảo hiểm sáng chế là loại <b>bảo hiểm phi nhân thọ</b>, xác lập bằng hợp đồng. Doanh nghiệp bảo hiểm cùng gánh rủi ro pháp lý của sáng chế, chủ yếu là <b>rủi ro xâm phạm</b>: chi trả chi phí giải quyết tranh chấp khi bị kiện hoặc khi khởi kiện bảo vệ quyền.', l: 'insurance' },
      { k: 'khac bao hiem thong thuong dac diem tai san vo hinh', a: 'Khác bảo hiểm thông thường ở chỗ đối tượng là <b>tài sản vô hình</b>, rủi ro mang tính kỹ thuật cao, khó định lượng và định phí. Bảo hiểm tập trung vào <b>chi phí giải quyết tranh chấp</b> thay vì khôi phục tài sản.', l: 'insurance' },
      { k: 'da mua duoc chua viet nam hien nay co san pham thi truong', a: '<b>Chưa.</b> Thị trường Việt Nam chưa có sản phẩm bảo hiểm chuyên biệt cho sáng chế và pháp luật chưa có quy định riêng. Đề tài đề xuất lộ trình để hình thành thị trường này.', l: 'legal' },
      { k: 'may san pham de xuat 03 ba san pham loai nao cap phep chi phi phap ly thuc thi trach nhiem xam pham', a: 'Đề tài đề xuất <b>03 sản phẩm</b>: (1) <b>Bảo hiểm cấp phép</b>, cho rủi ro đơn không được cấp văn bằng; (2) <b>Bảo hiểm chi phí pháp lý (thực thi quyền)</b>, chi trả luật sư và tố tụng khi khởi kiện hoặc bị kiện; (3) <b>Bảo hiểm trách nhiệm xâm phạm</b>, khi bị bên thứ ba cáo buộc xâm phạm (giai đoạn 3).', l: 'insurance' },
      { k: 'phi bao hiem bao nhieu gia chi phi muc phi', a: 'Việt Nam <b>chưa có biểu phí</b>. Tại Hoa Kỳ, phí thường từ <b>1% đến 5%</b> giá trị được bảo hiểm. Đề tài đề xuất Nhà nước <b>hỗ trợ một phần phí</b> trong giai đoạn thí điểm.', l: 'international' },
      { k: 'doanh nghiep nho vua sme tham gia duoc khong dieu kien doi tuong', a: '<b>Được.</b> Đề tài đề xuất sàng lọc theo <b>năng lực công nghệ và hoạt động đổi mới sáng tạo</b>, không theo quy mô. Nghị định 268/2025/NĐ-CP đã mở rộng tư cách doanh nghiệp KH&CN theo tiêu chí đổi mới sáng tạo.', l: 'strategy' },
      { k: 'co y xam pham gian lan chi tra loai tru ran de', a: '<b>Không.</b> Hành vi cố ý xâm phạm và gian lận bị loại trừ, nên bảo hiểm không làm giảm tính răn đe của pháp luật sở hữu trí tuệ.', l: 'insurance' },
      { k: 'khi nao nen tham gia thoi diem mua luc nao', a: 'Bảo hiểm cấp phép phù hợp <b>từ khi nộp đơn</b>. Với các sản phẩm còn lại, đề tài đề xuất tham gia <b>ngay khi được cấp bằng</b>, lúc chưa phát sinh nguy cơ kiện tụng cụ thể.', l: 'insurance' },
      { k: 'bat buoc tu nguyen co phai mua', a: '<b>Không bắt buộc.</b> Đề tài đề xuất cơ chế tự nguyện có hỗ trợ của Nhà nước; chỉ khi thị trường đủ lớn mới cân nhắc bán bắt buộc với một số ngành rủi ro cao.', l: 'legal' },
      { k: 'rui ro sang che giai doan truoc sau cap bang khai thac', a: 'Rủi ro có mặt ở mọi giai đoạn: <b>trước khi cấp bằng</b> (đơn bị từ chối), <b>sau khi cấp bằng</b> (văn bằng có thể bị hủy bỏ, vô hiệu), <b>trong khai thác</b> (bị kiện hoặc bị xâm phạm), và cả <b>sau khi hết hiệu lực</b>.', l: 'insurance' },
      { k: 'chien luoc lo trinh tru cot giai doan 5 tru cot 3 giai doan', a: 'Chiến lược gồm <b>5 trụ cột, 3 giai đoạn</b>: lộ trình sản phẩm, thí điểm có kiểm soát, hạ tầng, tài chính, giám sát & KPI. Giai đoạn 1 <b>khởi động</b> với bảo hiểm cấp phép và thực thi quyền; giai đoạn 2 <b>củng cố</b>; giai đoạn 3 <b>phát triển chiều sâu</b> (trách nhiệm xâm phạm, bảo lãnh vay thế chấp bằng sáng chế).', l: 'strategy' },
      { k: 'thi diem dia ban ha noi tp hcm ho chi minh o dau', a: 'Đề tài đề xuất <b>thí điểm có kiểm soát</b> với doanh nghiệp KH&CN, công nghệ cao có hoạt động R&D và sở hữu sáng chế, tại các địa bàn có nguồn lực như <b>Hà Nội</b> và <b>TP. Hồ Chí Minh</b>. Khu vực tư nhân thiết kế sản phẩm; Nhà nước hỗ trợ qua đồng bảo hiểm, tái bảo hiểm.', l: 'strategy' },
      { k: 'nghich ly thuong mai hoa ty le so lieu tang 36 0 1', a: 'Nghịch lý: đơn sáng chế của chủ thể Việt Nam <b>tăng 36% năm 2025</b>, nhưng tỷ lệ sáng chế được thương mại hóa chỉ khoảng <b>0,1%</b>, thấp hơn trung bình toàn cầu (5%) khoảng 50 lần. Mục tiêu năm 2030 là 8–10%.', l: 'about' },
      { k: 'trung quoc china mo hinh bac kinh picc', a: '<b>Trung Quốc</b>: Nhà nước định hướng, thị trường vận hành, địa phương thí điểm. Từ sản phẩm đầu tiên ở Phật Sơn (2010), PICC thí điểm tại 27 thành phố; Bắc Kinh có <b>4.818 sáng chế</b> được bảo hiểm, <b>472 doanh nghiệp</b> được hỗ trợ phí.', l: 'international' },
      { k: 'hoa ky my usa mo hinh thi truong', a: '<b>Hoa Kỳ</b>: thị trường thuần túy, hợp đồng phức tạp, phí cao (<b>1–5%</b> giá trị bảo hiểm). Hình thành từ khoảng năm 1985; IPISC tiên phong năm 1987.', l: 'international' },
      { k: 'nhat ban japan jpo ho tro phi', a: '<b>Nhật Bản</b>: Nhà nước hỗ trợ có mục tiêu; từ năm 2016 JPO hỗ trợ <b>một nửa phí bảo hiểm</b> cho doanh nghiệp vừa và nhỏ.', l: 'international' },
      { k: 'kinh nghiem quoc te bai hoc viet nam mo hinh nao phu hop eu chau au', a: 'Đề tài so sánh 4 mô hình (Trung Quốc, Nhật Bản, EU, Hoa Kỳ), từ Nhà nước dẫn dắt đến thị trường tự vận hành. Đề xuất cho Việt Nam: <b>Nhà nước khởi xướng, hỗ trợ có điều kiện, rồi rút dần</b>.', l: 'international' },
      { k: 'phap ly khung phap luat rao can kien nghi luat', a: 'Bảo hiểm sáng chế nằm giữa <b>6 lĩnh vực pháp luật</b>. Rào cản chính: chưa có cơ chế chia sẻ rủi ro cho sáng chế, thị trường trung gian yếu, dữ liệu phân tán, năng lực còn hạn chế và giá trị sáng chế khó định lượng. Đề tài kiến nghị hoàn thiện 5 lĩnh vực, trong đó có định giá sáng chế theo chuẩn <b>IVS 210</b>.', l: 'legal' },
      { k: 'dinh gia sang che ivs 210 the chap vay von', a: 'Đề tài kiến nghị hướng dẫn <b>định giá sáng chế theo chuẩn IVS 210</b>, làm nền cho bảo lãnh khoản vay thế chấp bằng sáng chế và tài chính hóa tài sản trí tuệ ở giai đoạn 3.', l: 'legal' },
      { k: 'cong cu tu danh gia doanh nghiep can loai nao phu hop', a: 'Hãy dùng <b>công cụ tự đánh giá</b>: trả lời 8 câu hỏi ngắn về lĩnh vực, tình trạng sáng chế và hoạt động của doanh nghiệp để biết loại bảo hiểm phù hợp.', l: 'tool' },
      { k: 'tac gia nguoi huong dan de tai truong ai lam', a: 'Đề tài nghiên cứu khoa học sinh viên năm 2026 của <b>CN. Vũ Thị Hồng Hà</b>, người hướng dẫn <b>ThS. Đỗ Tiến Đạt</b>, Trường Đại học Luật Hà Nội.', l: 'about' },
      { k: 'chuyen gia phong van y kien', a: 'Đề tài có phần <b>góc chuyên gia</b>, tổng hợp ý kiến phỏng vấn về nhu cầu và điều kiện hình thành bảo hiểm sáng chế.', l: 'experts' },
      { k: 'tai lieu van ban thu vien nguon tham khao', a: 'Các văn bản pháp luật và tài liệu tham khảo của đề tài được tập hợp trong <b>thư viện</b>.', l: 'library' }
    ],
    en: [
      { k: 'what is patent insurance definition', a: 'Patent insurance is <b>non-life insurance</b> set up by contract. The insurer shares the legal risk of a patent, mainly <b>infringement risk</b>: it pays dispute costs when you are sued or when you sue to enforce your rights.', l: 'insurance' },
      { k: 'different from ordinary insurance intangible', a: 'It covers an <b>intangible asset</b> whose risk is technical and hard to quantify and price, and it pays <b>dispute costs</b> rather than restoring property.', l: 'insurance' },
      { k: 'buy vietnam available yet market exist', a: '<b>Not yet.</b> Vietnam has no dedicated patent insurance product and no specific legal rules for it. The study proposes a roadmap to create this market.', l: 'legal' },
      { k: 'products proposed three which licensing legal expenses enforcement liability infringement', a: 'The study proposes <b>3 products</b>: (1) <b>licensing (grant) insurance</b> for applications that are refused; (2) <b>legal expenses (enforcement) insurance</b> for lawyers and litigation; (3) <b>infringement liability insurance</b> when a third party alleges infringement (phase 3).', l: 'insurance' },
      { k: 'cost price premium how much', a: 'Vietnam has <b>no tariff yet</b>. In the United States premiums are typically <b>1–5%</b> of the insured value. The study proposes <b>partial state premium support</b> during the pilot.', l: 'international' },
      { k: 'small business sme join eligible', a: '<b>Yes.</b> Screening is by <b>technological and innovation capacity</b>, not by size. Decree 268/2025/ND-CP widened science-and-technology enterprise status on innovation criteria.', l: 'strategy' },
      { k: 'wilful intentional infringement fraud covered excluded', a: '<b>No.</b> Wilful infringement and fraud are excluded, so insurance does not weaken the deterrent effect of IP law.', l: 'insurance' },
      { k: 'when should join timing', a: 'Licensing insurance fits <b>from filing</b>. For the other products, the study suggests joining <b>as soon as the patent is granted</b>, before any concrete litigation risk arises.', l: 'insurance' },
      { k: 'mandatory compulsory voluntary', a: '<b>Not mandatory.</b> A voluntary scheme with state support; compulsory cover would only be considered for some high-risk sectors once the market is large enough.', l: 'legal' },
      { k: 'strategy roadmap pillars phases', a: 'The strategy has <b>5 pillars and 3 phases</b>: product roadmap, controlled pilot, infrastructure, finance, monitoring & KPIs. Phase 1 <b>launches</b> licensing and enforcement cover; phase 2 <b>consolidates</b>; phase 3 <b>deepens</b> (infringement liability, patent-backed loan guarantees).', l: 'strategy' },
      { k: 'paradox commercialisation rate statistics 36 0.1', a: 'Patent filings by Vietnamese applicants <b>rose 36% in 2025</b>, yet only about <b>0.1%</b> of patents are commercialised, roughly 50 times below the global average (5%). The 2030 target is 8–10%.', l: 'about' },
      { k: 'china model beijing picc', a: '<b>China</b>: state-guided, market-run, locally piloted. Beijing insured <b>4,818 patents</b> and subsidised premiums for <b>472 firms</b>.', l: 'international' },
      { k: 'united states usa america model', a: '<b>United States</b>: a pure market, complex contracts, high premiums (<b>1–5%</b> of insured value); pioneered by IPISC in 1987.', l: 'international' },
      { k: 'japan jpo subsidy', a: '<b>Japan</b>: targeted state support; since 2016 the JPO has covered <b>half the premium</b> for SMEs.', l: 'international' },
      { k: 'international lessons vietnam which model eu europe', a: 'Four models are compared (China, Japan, EU, US). For Vietnam the study proposes: <b>the state initiates, supports conditionally, then steps back</b>.', l: 'international' },
      { k: 'legal framework law barriers recommendations', a: 'Patent insurance sits across <b>6 areas of law</b>. The study recommends reforms in 5 areas, including patent valuation under <b>IVS 210</b>.', l: 'legal' },
      { k: 'self assessment tool which cover fits my business', a: 'Try the <b>self-assessment tool</b>: 8 short questions about your field, patent status and activity show which cover fits.', l: 'tool' },
      { k: 'author supervisor who university', a: 'A 2026 student research project by <b>Vu Thi Hong Ha (LL.B.)</b>, supervised by <b>Do Tien Dat (LL.M.)</b>, Hanoi Law University.', l: 'about' }
    ]
  }[lang];

  // ---------------- retrieval ----------------
  function norm(s) {
    return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\u0111/g, 'd').replace(/[^a-z0-9%.,\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  var STOP = { la: 1, gi: 1, co: 1, khong: 1, the: 1, nao: 1, cua: 1, va: 1, cho: 1, duoc: 1, toi: 1, ban: 1, a: 1, an: 1, is: 1, of: 1, to: 1, it: 1, do: 1, does: 1, how: 1, what: 1, i: 1, my: 1, in: 1, for: 1, can: 1 };
  function grams(s) {
    var w = norm(s).split(' ').filter(function (x) { return x && !STOP[x]; });
    var g = w.slice();
    for (var i = 0; i < w.length - 1; i++) g.push(w[i] + '_' + w[i + 1]);
    return g;
  }
  KB.forEach(function (e) { e.g = grams(e.k + ' ' + e.a.replace(/<[^>]+>/g, ' ')); e.kg = grams(e.k); });
  function answer(q) {
    var qg = grams(q); if (!qg.length) return null;
    var best = null, bs = 0;
    KB.forEach(function (e) {
      var s = 0;
      qg.forEach(function (t) { var bi = t.indexOf('_') > 0 ? 2 : 1; if (e.kg.indexOf(t) >= 0) s += 2 * bi; else if (e.g.indexOf(t) >= 0) s += 0.6 * bi; });
      s /= Math.sqrt(qg.length + 1);
      if (s > bs) { bs = s; best = e; }
    });
    return bs >= 1.1 ? best : null;
  }

  // ---------------- UI ----------------
  var root = document.createElement('div');
  root.className = 'asst';
  root.innerHTML =
    '<button class="asst-fab" type="button" aria-expanded="false" aria-controls="asst-panel">' +
      '<span class="asst-fab-dot" aria-hidden="true"></span><span class="asst-fab-label">' + T.open + '</span></button>' +
    '<section class="asst-panel" id="asst-panel" role="dialog" aria-label="' + T.title + '" hidden>' +
      '<header class="asst-head"><img src="/images/mark.svg" alt="" width="30" height="30"><div><p class="asst-title">' + T.title + '</p><p class="asst-sub">' + T.sub + '</p></div>' +
        '<button class="asst-close" type="button" aria-label="' + T.close + '">&times;</button></header>' +
      '<div class="asst-log" aria-live="polite"></div>' +
      '<div class="asst-chips"></div>' +
      '<form class="asst-form"><input class="asst-input" type="text" autocomplete="off" maxlength="200" placeholder="' + T.placeholder + '" aria-label="' + T.placeholder + '">' +
        '<button class="asst-send" type="submit" aria-label="' + T.send + '"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></form>' +
      '<p class="asst-note">' + T.note + '</p>' +
    '</section>';
  document.body.appendChild(root);
  var fab = root.querySelector('.asst-fab'), panel = root.querySelector('.asst-panel'), log = root.querySelector('.asst-log');
  var input = root.querySelector('.asst-input'), chips = root.querySelector('.asst-chips');
  // the page's own mark image may be inlined as a data URI in the static export
  var mark = document.querySelector('.brand img'); if (mark) root.querySelector('.asst-head img').src = mark.getAttribute('src');

  function msg(html, who) {
    var d = document.createElement('div'); d.className = 'asst-msg asst-' + who; d.innerHTML = html;
    log.appendChild(d); log.scrollTop = log.scrollHeight; return d;
  }
  function text(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function reply(q) {
    msg(text(q), 'me');
    var typing = msg('<span class="asst-typing"><i></i><i></i><i></i></span>', 'bot');
    setTimeout(function () {
      typing.remove();
      var e = answer(q);
      if (e) msg(e.a + (LINKS[e.l] ? ' <a class="asst-more" href="' + LINKS[e.l] + '">' + T.more + ' →</a>' : ''), 'bot');
      else msg(T.fallback.replace('{tool}', LINKS.tool || '#'), 'bot');
    }, 420);
  }
  T.chips.forEach(function (c) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'asst-chip'; b.textContent = c;
    b.addEventListener('click', function () { reply(c); });
    chips.appendChild(b);
  });
  var greeted = false;
  function open(v) {
    panel.hidden = !v; fab.setAttribute('aria-expanded', v ? 'true' : 'false'); root.classList.toggle('is-open', v);
    if (v) { if (!greeted) { msg(T.hello, 'bot'); greeted = true; } setTimeout(function () { input.focus(); }, 60); }
  }
  fab.addEventListener('click', function () { open(panel.hidden); });
  root.querySelector('.asst-close').addEventListener('click', function () { open(false); fab.focus(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) { open(false); fab.focus(); } });
  root.querySelector('.asst-form').addEventListener('submit', function (e) {
    e.preventDefault(); var q = input.value.trim(); if (!q) return; input.value = ''; reply(q);
  });
})();

;
/* interest.js */
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

;
/* assessment.js */
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

;