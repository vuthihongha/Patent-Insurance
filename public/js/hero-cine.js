/*
 * Hero cinemagraph: one still night photograph brought to life in a single shader.
 *  · a slow cinematic camera: push-in / pull-back with a gentle lateral drift;
 *  · light pulses running up the towers' LED lines;
 *  · a few windows switching on and off;
 *  · twinkling stars above the skyline;
 *  · living water: perspective ripples, reflections that sway and break up,
 *    silver streaks sliding toward the viewer, drifting glints;
 *  · a breathing beacon on the spire and silver mist along the horizon.
 * The skyline profile (data-skyline, top of the city per column, 0..1 of the image height)
 * separates sky, city and water. The <img> underneath is the fallback and the
 * reduced-motion view; the canvas fades in once it has drawn a frame.
 */
(function () {
  'use strict';
  var canvas = document.querySelector('[data-hero-cine]');
  var img = document.querySelector('[data-hero-photo]');
  if (!canvas || !img) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false });
  if (!gl) return;

  var HORIZON = parseFloat(canvas.getAttribute('data-horizon')) || 0.672;
  var BEACON = (canvas.getAttribute('data-beacon') || '0.5,0.075').split(',').map(parseFloat);
  var SKY = [];
  try { SKY = JSON.parse(canvas.getAttribute('data-skyline') || '[]'); } catch (e) {}
  if (!SKY.length) SKY = [HORIZON];

  var VS = 'attribute vec2 p; varying vec2 v; void main(){ v = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }';
  var FS = [
    'precision highp float;',
    'varying vec2 v;',
    'uniform sampler2D img; uniform sampler2D sky; uniform float t; uniform vec2 scale; uniform vec2 offset;',
    'uniform float horizon; uniform vec2 beacon; uniform vec2 res;',
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    'float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }',
    'void main(){',
    // cover mapping, then a slow camera: push-in / pull-back and a lateral drift
    '  vec2 uv = vec2(v.x, 1.0 - v.y) * scale + offset;',
    '  float z = 1.0 + 0.03 * (0.5 - 0.5 * cos(t * 0.05));',
    '  vec2 c0 = vec2(0.5 + 0.012 * sin(t * 0.037), horizon - 0.12);',
    '  uv = (uv - c0) / z + vec2(0.5, horizon - 0.12);',
    '  float sl = texture2D(sky, vec2(uv.x, 0.5)).r;',
    '  float below = uv.y - horizon;',
    '  vec2 s = uv;',
    '  float streak = 0.0;',
    // water: layered perspective ripples; reflections sway and break into bands
    '  if (below > 0.0) {',
    '    float d = below / (1.0 - horizon);',
    '    float k = 1.0 / (below + 0.012);',
    '    float n1 = noise(vec2(uv.x * 6.0 + t * 0.15, uv.y * k * 0.22 - t * 0.35));',
    '    float w1 = sin(uv.y * k * 1.2 - t * 1.3 + n1 * 4.0);',
    '    float w2 = sin(uv.y * k * 0.55 + t * 0.7 + uv.x * 9.0);',
    '    float w3 = sin(uv.y * k * 2.6 - t * 2.1 + uv.x * 23.0) * 0.12;',
    '    float amp = 0.0004 + d * 0.0026;',
    '    s.x += (w1 * 0.6 + w2 * 0.28 + w3) * amp;',
    '    s.y += (w1 - w2) * amp * 0.22;',
    '    s.y = max(s.y, horizon + 0.0015);',
    // bands where the surface faces the sky: silver streaks sliding toward the viewer
    '    float band = sin(uv.y * k * 0.9 - t * 1.1 + noise(vec2(uv.x * 3.0, t * 0.1)) * 2.5);',
    '    streak = smoothstep(0.82, 1.0, band) * (0.35 + 0.65 * noise(vec2(uv.x * 14.0 - t * 0.2, uv.y * k * 0.3)));',
    '  }',
    '  vec3 c = texture2D(img, s).rgb;',
    '  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));',
    '  if (uv.y < sl - 0.004) {',
    // sky: stars twinkle
    '    vec2 cell = floor(uv * vec2(1400.0, 780.0));',
    '    float h = hash(cell);',
    '    float tw = 0.45 + 0.55 * sin(t * (0.8 + h * 3.0) + h * 60.0);',
    '    c *= mix(1.0, tw, smoothstep(0.12, 0.35, lum));',
    '  } else if (below < 0.0) {',
    // city: LED pulses running up the towers, each tower its own cool hue (navy/royal palette — no warm colours)
    '    float col = floor(uv.x * 90.0);',
    '    float hc = hash(vec2(col, 7.0));',
    '    float span = max(0.02, horizon - sl);',
    '    float head = horizon - fract(t * (0.07 + hc * 0.06) + hc * 5.0) * span * 1.25;',
    '    float bandc = exp(-pow((uv.y - head) / (0.018 + hc * 0.02), 2.0));',
    '    vec3 hue1 = mix(vec3(0.55, 0.66, 0.92), vec3(0.5, 0.82, 0.92), smoothstep(0.0, 0.33, hc));',
    '    vec3 hue2 = mix(hue1, vec3(0.68, 0.6, 0.95), smoothstep(0.33, 0.66, hc));',
    '    vec3 ledHue = mix(hue2, vec3(0.82, 0.88, 0.98), smoothstep(0.66, 1.0, hc));',
    '    c += ledHue * bandc * smoothstep(0.42, 0.78, lum) * 0.75;',
    // a few windows switching on and off, tinted per-window from the same cool palette
    '    vec2 wc = floor(uv * vec2(260.0, 190.0));',
    '    float hw = hash(wc);',
    '    if (hw > 0.975) {',
    '      float ph = fract(t * 0.05 + hw * 17.0);',
    '      float on = smoothstep(0.35, 0.5, ph) * (1.0 - smoothstep(0.85, 1.0, ph));',
    '      float hw2 = hash(wc + 11.0);',
    '      vec3 wHue1 = mix(vec3(0.62, 0.72, 0.98), vec3(0.55, 0.85, 0.9), smoothstep(0.0, 0.5, hw2));',
    '      vec3 wHue = mix(wHue1, vec3(0.72, 0.64, 0.98), smoothstep(0.5, 1.0, hw2));',
    // a rare handful of windows glow warm instead — an old incandescent lamp among the cool LEDs
    '      float hw3 = hash(wc + 23.0);',
    '      if (hw3 > 0.88) wHue = vec3(0.95, 0.6, 0.32);',
    '      c = mix(c * mix(1.0, 0.55 + 0.45 * on, smoothstep(0.45, 0.7, lum)), wHue * lum * 1.3, on * smoothstep(0.45, 0.7, lum) * 0.55);',
    '    }',
    '  } else {',
    // water: silver streaks, glints on the lit reflections, mirrored LED pulses
    '    c += vec3(0.62, 0.72, 0.95) * streak * (0.05 + 0.5 * smoothstep(0.1, 0.5, lum)) * 0.5;',
    '    float g = pow(noise(vec2(uv.x * 260.0, uv.y * 1400.0 / (below * 9.0 + 0.25) - t * 1.6)), 11.0);',
    '    c += vec3(0.88, 0.94, 1.0) * g * smoothstep(0.18, 0.55, lum) * 1.4;',
    '    float colw = floor(uv.x * 90.0);',
    '    float hcw = hash(vec2(colw, 7.0));',
    '    float spanw = max(0.02, horizon - sl);',
    '    float headw = horizon + fract(t * (0.07 + hcw * 0.06) + hcw * 5.0) * spanw * 1.25;',
    '    c += vec3(0.45, 0.56, 0.85) * exp(-pow((uv.y - headw) / 0.03, 2.0)) * smoothstep(0.35, 0.7, lum) * 0.35;',
    '  }',
    // silver mist drifting along the horizon
    '  float mb = exp(-pow((uv.y - horizon + 0.02) / 0.05, 2.0));',
    '  float mist = noise(vec2(uv.x * 3.0 - t * 0.03, uv.y * 14.0)) * noise(vec2(uv.x * 6.5 + t * 0.02, uv.y * 22.0 + 3.0));',
    '  c += vec3(0.5, 0.58, 0.74) * mb * mist * 0.14;',
    // the beacon on the spire breathes
    '  vec2 bd = (uv - beacon) * vec2(res.x / res.y, 1.0) / scale.y;',
    '  float pulse = 0.5 + 0.5 * sin(t * 1.6);',
    '  c += vec3(0.88, 0.93, 1.0) * (exp(-dot(bd, bd) * 12000.0) * 1.2 + exp(-dot(bd, bd) * 900.0) * 0.22) * pulse;',
    // fine moving grain
    '  c += (hash(v * res + fract(t) * 97.0) + hash(v * res * 1.37 + fract(t * 1.7) * 53.0) - 1.0) * 0.008;   // triangular dither: no banding in the dark water',
    '  gl_FragColor = vec4(c, 1.0);',
    '}'
  ].join('\n');

  function sh(type, src) { var x = gl.createShader(type); gl.shaderSource(x, src); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; }
  var prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (e) { if (window.console) console.warn('hero-cine:', e); return; }
  gl.useProgram(prog);
  var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  var U = {}; ['img', 'sky', 't', 'scale', 'offset', 'horizon', 'beacon', 'res'].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });

  function tex(unit) {
    var tx = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tx);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tx;
  }
  tex(1);
  var px = new Uint8Array(SKY.length);
  for (var i = 0; i < SKY.length; i++) px[i] = Math.max(0, Math.min(255, Math.round(SKY[i] * 255)));
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, SKY.length, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, px);
  tex(0);
  gl.uniform1i(U.img, 0); gl.uniform1i(U.sky, 1);
  gl.uniform1f(U.horizon, HORIZON);
  gl.uniform2f(U.beacon, BEACON[0], BEACON[1]);

  var ready = false, iw = 16, ih = 9;
  function upload() {
    // resample into a power-of-two texture so WebGL1 can build mipmaps (no shimmer on thin LED lines)
    var max = gl.getParameter(gl.MAX_TEXTURE_SIZE), PW = Math.min(4096, max), PH = Math.min(2048, max);
    var pc = document.createElement('canvas'); pc.width = PW; pc.height = PH;
    var pctx = pc.getContext('2d'); pctx.imageSmoothingQuality = 'high'; pctx.drawImage(img, 0, 0, PW, PH);
    gl.activeTexture(gl.TEXTURE0);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, pc);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    var an = gl.getExtension('EXT_texture_filter_anisotropic');
    if (an) gl.texParameterf(gl.TEXTURE_2D, an.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(an.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    iw = img.naturalWidth; ih = img.naturalHeight; ready = true;
    resize(); draw(); canvas.classList.add('is-ready'); start();
  }

  var W = 1, H = 1;
  function resize() {
    var r = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, Math.round(r.width * dpr)); H = Math.max(1, Math.round(r.height * dpr));
    canvas.width = W; canvas.height = H; gl.viewport(0, 0, W, H);
    var ca = W / H, ia = iw / ih, sx = 1, sy = 1;
    if (ca > ia) sy = ia / ca; else sx = ca / ia;
    gl.uniform2f(U.scale, sx, sy); gl.uniform2f(U.offset, (1 - sx) / 2, (1 - sy) / 2);
    gl.uniform2f(U.res, W, H);
  }

  var t0 = performance.now(), running = false, visible = true;
  function draw() { gl.uniform1f(U.t, (performance.now() - t0) / 1000); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); }
  function loop() { if (!running) return; draw(); requestAnimationFrame(loop); }
  function start() { if (running || !ready || !visible || document.hidden) return; running = true; requestAnimationFrame(loop); }
  function stop() { running = false; }

  var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { if (ready) { resize(); draw(); } }, 150); });
  document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
  if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { visible = e[0].isIntersecting; visible ? start() : stop(); }).observe(canvas);

  if (img.complete && img.naturalWidth) upload(); else img.addEventListener('load', upload);
})();
