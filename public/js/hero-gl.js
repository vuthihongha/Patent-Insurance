/*
 * Hero — "Dòng sông ánh sáng".
 * A modern city of glass on the far bank at night: physically based glass towers that
 * reflect a navy sky and a silver horizon, cool-white windows with a cinematic bloom, and
 * one tallest tower at the centre (the nation's rise). In front, the river (Hồng Hà) is a
 * real-time mirror that bows around the city — feng shui "ngọc đới triền yêu": it enters
 * from the Thanh Long side, gathers wide and calm before the city, leaves out of sight —
 * with threads of light gliding along the current. A hairline dome ripples out over the
 * city: the cover that patent insurance gives. Static camera; crisp at any pixel ratio.
 * three.js 0.170 via jsDelivr ESM (core + Reflector + bloom share one instance).
 */
(function () {
  'use strict';
  var canvas = document.querySelector('[data-hero-gl]');
  var hero = canvas && canvas.closest('.hero');
  function hasGL() { try { return !!document.createElement('canvas').getContext('webgl2'); } catch (e) { return false; } }
  if (!canvas || !hasGL() || !window.Promise) return;

  var CDN = 'https://cdn.jsdelivr.net/npm/three@0.170.0/';
  Promise.all([
    import(CDN + '+esm'),
    import(CDN + 'examples/jsm/objects/Reflector.js/+esm'),
    import(CDN + 'examples/jsm/postprocessing/EffectComposer.js/+esm'),
    import(CDN + 'examples/jsm/postprocessing/RenderPass.js/+esm'),
    import(CDN + 'examples/jsm/postprocessing/UnrealBloomPass.js/+esm'),
    import(CDN + 'examples/jsm/postprocessing/OutputPass.js/+esm')
  ]).then(function (m) {
    init(m[0], m[1].Reflector, m[2].EffectComposer, m[3].RenderPass, m[4].UnrealBloomPass, m[5].OutputPass);
  }).catch(function (e) { if (window.console) console.warn('hero-gl:', e); });

  function rng(seed) { return function () { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; var t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  function init(THREE, Reflector, EffectComposer, RenderPass, UnrealBloomPass, OutputPass) {
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var small = Math.min(window.innerWidth, window.innerHeight) < 600;
    var r = rng(57);
    var SHORE = -1150;

    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(30, 1, 1, 30000);

    // ---------------------------------------------------------------- night sky (HDR)
    // navy-black overhead, a thin silver band of light along the horizon behind the city
    function skyTexture() {
      var w = 1024, h = 512, data = new Float32Array(w * h * 4), d = new THREE.Vector3();
      for (var y = 0; y < h; y++) {
        var el = Math.PI / 2 - (y / (h - 1)) * Math.PI;
        for (var x = 0; x < w; x++) {
          var th = (x / (w - 1)) * Math.PI * 2 - Math.PI;
          d.set(Math.cos(el) * Math.sin(th), Math.sin(el), -Math.cos(el) * Math.cos(th));
          var up = Math.max(0, d.y), t = Math.pow(up, 0.22);
          var R = 0.05 * (1 - t) + 0.003 * t, G = 0.08 * (1 - t) + 0.007 * t, B = 0.17 * (1 - t) + 0.024 * t;
          var face = Math.max(0, -d.z);                                  // brighter behind the city
          var band = Math.exp(-up * 22) * (0.25 + 0.75 * Math.pow(face, 3));
          R += band * 0.55; G += band * 0.64; B += band * 0.80;
          if (d.y < 0) { var k = Math.min(1, -d.y * 5); R *= 1 - k * 0.9; G *= 1 - k * 0.9; B *= 1 - k * 0.85; }
          var i = ((h - 1 - y) * w + x) * 4; data[i] = R; data[i + 1] = G; data[i + 2] = B; data[i + 3] = 1;
        }
      }
      var tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.FloatType);
      tex.mapping = THREE.EquirectangularReflectionMapping; tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
      return tex;
    }
    var SKY = skyTexture();
    scene.background = SKY;
    var pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromEquirectangular(SKY).texture;
    scene.fog = new THREE.FogExp2(0x0a1328, 0.00006);

    // ---------------------------------------------------------------- curtain-wall glass
    function wallMaps(seed, cols, rows, lit, fins) {
      var rr = rng(seed), mk = function () { var c = document.createElement('canvas'); c.width = 256; c.height = 512; return c; };
      var c = mk(), e = mk(), g = c.getContext('2d'), ge = e.getContext('2d'), cw = 256 / cols, ch = 512 / rows;
      ge.fillStyle = '#000'; ge.fillRect(0, 0, 256, 512);
      for (var y = 0; y < rows; y++) for (var x = 0; x < cols; x++) {
        var k = 150 + rr() * 70 | 0; g.fillStyle = 'rgb(' + k + ',' + k + ',' + k + ')'; g.fillRect(x * cw, y * ch, cw, ch);
        if (rr() < lit) { var a = 0.45 + rr() * 0.55; ge.fillStyle = 'rgba(225,236,255,' + a + ')'; ge.fillRect(x * cw + cw * 0.12, y * ch + ch * 0.18, cw * 0.76, ch * 0.62); }
      }
      g.fillStyle = '#0b0f18';
      for (var xx = 0; xx <= cols; xx++) g.fillRect(xx * cw - (fins ? 2 : 1), 0, fins ? 4 : 2, 512);
      for (var yy = 0; yy <= rows; yy++) g.fillRect(0, yy * ch - (yy % 4 ? 1 : 3), 256, yy % 4 ? 2 : 6);
      var T = function (cv) { var t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t; };
      return { map: T(c), em: T(e) };
    }
    var LIT = 0.2;
    var MAPS = [wallMaps(3, 8, 16, LIT, false), wallMaps(9, 6, 16, LIT * 1.2, true), wallMaps(27, 12, 16, LIT * 0.8, false), wallMaps(41, 5, 12, LIT, true)];
    var TINTS = [0x5a78ad, 0x6d88b8, 0x4c6aa0, 0x8196bb];
    function glassMat(k, tint) {
      var M = MAPS[k];
      return new THREE.MeshPhysicalMaterial({
        color: tint || TINTS[k], map: M.map, metalness: 0.85, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.04,
        envMapIntensity: 1.6, emissive: 0xffffff, emissiveMap: M.em, emissiveIntensity: 1.35
      });
    }
    var GLASS = [0, 1, 2, 3].map(function (k) { return glassMat(k); });
    var HERO_GLASS = [0, 1, 2, 3].map(function (k) { return glassMat(k, 0x8ea6d4); });
    var ROOF = new THREE.MeshStandardMaterial({ color: 0x0c1220, roughness: 0.7, metalness: 0.3 });
    var CROWN = new THREE.MeshBasicMaterial({ color: 0xdfeaff });           // light strips crowning some towers (bloom)

    function uvBox(w, h, d) {
      var g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
      var size = [[d, h], [d, h], [0, 0], [0, 0], [w, h], [w, h]];
      for (var f = 0; f < 6; f++) { var a = size[f][0], b = size[f][1]; if (!a) continue;
        for (var v = 0; v < 4; v++) { var i = f * 4 + v; uv.setXY(i, uv.getX(i) * Math.max(1, Math.round(a / 70)), uv.getY(i) * Math.max(1, Math.round(b / 150))); } }
      return g;
    }
    function uvCyl(rad, h) {
      var g = new THREE.CylinderGeometry(rad, rad, h, 36, 1, true), uv = g.attributes.uv;
      for (var i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.max(1, Math.round(rad * 6.28 / 70)), uv.getY(i) * Math.max(1, Math.round(h / 150)));
      return g;
    }
    var city = new THREE.Group(); scene.add(city);
    function block(x, z, w, d, h, k, hero) {
      var mats = hero ? HERO_GLASS : GLASS;
      var m = new THREE.Mesh(uvBox(w, h, d), [mats[k], mats[k], ROOF, ROOF, mats[k], mats[k]]);
      m.position.set(x, h / 2, z); city.add(m); return m;
    }
    function tower(x, z, w, d, h, k) {
      var kind = r();
      if (kind < 0.18) {                                                   // cylinder tower
        var rad = Math.min(w, d) * 0.5, cyl = new THREE.Mesh(uvCyl(rad, h), GLASS[k]);
        cyl.position.set(x, h / 2, z); city.add(cyl);
        var cap = new THREE.Mesh(new THREE.CircleGeometry(rad, 36), ROOF); cap.rotation.x = -Math.PI / 2; cap.position.set(x, h, z); city.add(cap);
        if (r() < 0.5) { var ring = new THREE.Mesh(new THREE.TorusGeometry(rad, 0.8, 6, 48), CROWN); ring.rotation.x = Math.PI / 2; ring.position.set(x, h, z); city.add(ring); }
        return;
      }
      block(x, z, w, d, h, k);
      var top = h;
      if (kind < 0.62) {                                                   // setback
        var w2 = w * (0.62 + r() * 0.2), d2 = d * (0.62 + r() * 0.2), h2 = 12 + r() * 40;
        var m2 = block(x, z, w2, d2, h2, (k + 1) % 4); m2.position.y = top + h2 / 2; top += h2;
      }
      if (r() < 0.35) { var strip = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7 + 0.6, 1.2, 1.2), CROWN); strip.position.set(x, top - 3, z + d / 2 + 0.3); city.add(strip); }
    }
    // skyline: three depth ranks, rising toward the centre
    for (var rank = 0; rank < 3; rank++) {
      var x = -3600;
      while (x < 3600) {
        var w = 40 + r() * 50, d = 40 + r() * 40;
        var c = Math.exp(-Math.pow(x / (1100 - rank * 120), 2));
        var h = (40 + r() * 80) * (1 - rank * 0.1) + c * (140 + r() * 220) * (1 + rank * 0.2);
        if (Math.abs(x) > 80) tower(x, SHORE - 60 - rank * 150 - r() * 60, w, d, h, (Math.abs(x | 0) + rank) % 4);
        x += w + 10 + r() * 22;
      }
    }
    // the tallest tower: tapering in six stages, a crown of light and a fine spire
    var spireTop = 0;
    (function () {
      var y = 0, z = SHORE - 170;
      [[110, 300], [94, 250], [78, 210], [62, 160], [46, 120], [30, 70]].forEach(function (t, i) {
        var m = block(0, z, t[0], t[0], t[1], i % 4, true); m.position.y = y + t[1] / 2; y += t[1];
        var band = new THREE.Mesh(new THREE.BoxGeometry(t[0] + 2, 3, t[0] + 2), CROWN); band.position.set(0, y, z); city.add(band);
      });
      var spire = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 4, 200, 12), new THREE.MeshStandardMaterial({ color: 0xa9bbdc, metalness: 1, roughness: 0.15 }));
      spire.position.set(0, y + 100, z); city.add(spire);
      spireTop = y + 200;
      var tip = new THREE.Mesh(new THREE.SphereGeometry(2.2, 12, 8), CROWN); tip.position.set(0, spireTop, z); city.add(tip);
    })();

    // ground on both banks (matte, near-black)
    var ground = new THREE.Mesh(new THREE.PlaneGeometry(40000, 40000), new THREE.MeshStandardMaterial({ color: 0x0b1222, roughness: 0.9, metalness: 0.1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.5; scene.add(ground);
    // promenade: a line of light along the city bank
    var prom = new THREE.Mesh(new THREE.BoxGeometry(9000, 1.2, 1.2), CROWN); prom.position.set(0, 3, SHORE + 40); scene.add(prom);

    // ---------------------------------------------------------------- the river (Hồng Hà)
    // enters from the Thanh Long side (screen right), bows toward the viewer around the city,
    // widest and calmest in front of it (minh đường), leaves out of sight on the left
    var riverPts = [[3600, -1000], [2500, -700], [1400, -250], [350, 80], [-700, 40], [-1700, -330], [-2700, -760], [-3800, -1000]];
    var curve = new THREE.CatmullRomCurve3(riverPts.map(function (p) { return new THREE.Vector3(p[0], 0, p[1]); }));
    function widthAt(u) { return 520 + 900 * Math.exp(-Math.pow((u - 0.48) / 0.24, 2)); }
    // a flat ribbon in the XY plane (Reflector mirrors about its local +Z), laid down afterwards
    function ribbon(segs) {
      var pos = [], uv = [], idx = [], p = new THREE.Vector3(), t = new THREE.Vector3();
      for (var i = 0; i <= segs; i++) {
        var u = i / segs; curve.getPoint(u, p); curve.getTangent(u, t);
        var nx = -t.z, nz = t.x, l = Math.hypot(nx, nz); nx /= l; nz /= l; var hw = widthAt(u) / 2;
        // world (x, z) -> local (x, -z) so that rotating the mesh by -90° about X lays it on the ground
        pos.push(p.x + nx * hw, -(p.z + nz * hw), 0, p.x - nx * hw, -(p.z - nz * hw), 0); uv.push(0, u, 1, u);
        if (i < segs) { var k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
      }
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx); g.computeVertexNormals(); return g;
    }
    var riverGeo = ribbon(300);
    var mirror = new Reflector(riverGeo, { color: 0x8a9cbf, textureWidth: 1024, textureHeight: 1024, clipBias: 0.002 });
    mirror.rotation.x = -Math.PI / 2; mirror.position.y = 0.2; mirror.material.side = THREE.DoubleSide;
    scene.add(mirror);
    // a dark glass film over the mirror: tints the reflection navy and fades it toward the banks and the ends
    var film = new THREE.Mesh(riverGeo, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying vec2 vUv; void main(){ float e = smoothstep(0.0, 0.16, vUv.x) * smoothstep(1.0, 0.84, vUv.x); float ends = smoothstep(0.0, 0.12, vUv.y) * smoothstep(1.0, 0.86, vUv.y); gl_FragColor = vec4(0.012, 0.024, 0.055, 1.0 - 0.75 * e * ends); }'
    }));
    film.rotation.x = -Math.PI / 2; film.position.y = 0.8; scene.add(film);

    // threads of light gliding along the current
    var U = { uTime: { value: 0 }, uPx: { value: 1 } };
    var POINT_FS = 'varying float vA; varying vec3 vC; void main(){ vec2 d = gl_PointCoord - 0.5; float a = exp(-dot(d, d) * 12.8) * vA; if (a < 0.003) discard; gl_FragColor = vec4(vC * a, a); }';
    function pointsMat(vs) { return new THREE.ShaderMaterial({ uniforms: U, vertexShader: vs, fragmentShader: POINT_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }); }
    var lines = 11, per = small ? 900 : 1800, pos = [], au = [], ak = [];
    var cp = new THREE.Vector3(), ct = new THREE.Vector3();
    for (var li = 0; li < lines; li++) {
      var off = (li / (lines - 1) - 0.5) * 0.78;
      for (var pi = 0; pi < per; pi++) {
        var u = pi / per; curve.getPoint(u, cp); curve.getTangent(u, ct);
        var nx = -ct.z, nz = ct.x, l = Math.hypot(nx, nz); nx /= l; nz /= l;
        var wv = off + Math.sin(u * 14 + li) * 0.03;
        pos.push(cp.x + nx * wv * widthAt(u), 2, cp.z + nz * wv * widthAt(u)); au.push(u); ak.push(li);
      }
    }
    var tGeo = new THREE.BufferGeometry();
    tGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    tGeo.setAttribute('aU', new THREE.Float32BufferAttribute(au, 1)); tGeo.setAttribute('aK', new THREE.Float32BufferAttribute(ak, 1));
    scene.add(new THREE.Points(tGeo, pointsMat([
      'attribute float aU; attribute float aK; uniform float uTime; uniform float uPx; varying float vA; varying vec3 vC;',
      'void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;',
      '  float dash = pow(0.5 + 0.5 * sin(aU * 90.0 - uTime * (0.55 + aK * 0.04) + aK * 1.9), 8.0);',
      '  float ends = smoothstep(0.0, 0.12, aU) * (1.0 - smoothstep(0.84, 1.0, aU));',
      '  float hall = exp(-pow((aU - 0.48) / 0.18, 2.0));',
      '  vA = (0.05 + 0.85 * dash) * ends * (0.5 + 0.5 * hall); vC = vec3(0.86, 0.93, 1.0);',
      '  gl_PointSize = clamp(6000.0 / -mv.z, 1.0, 3.2) * uPx; }'
    ].join('\n'))));

    // ---------------------------------------------------------------- stars
    var st = [], sb = [], sp = [];
    for (var s = 0; s < 1600; s++) {
      var a = (r() - 0.5) * Math.PI * 1.1, e = 0.05 + Math.pow(r(), 0.7) * 1.1, R = 20000;
      st.push(Math.sin(a) * Math.cos(e) * R, Math.sin(e) * R, -Math.cos(a) * Math.cos(e) * R + SHORE);
      sb.push(0.12 + Math.pow(r(), 3) * 0.88); sp.push(r() * 6.283);
    }
    var sGeo = new THREE.BufferGeometry();
    sGeo.setAttribute('position', new THREE.Float32BufferAttribute(st, 3));
    sGeo.setAttribute('aB', new THREE.Float32BufferAttribute(sb, 1)); sGeo.setAttribute('aP', new THREE.Float32BufferAttribute(sp, 1));
    scene.add(new THREE.Points(sGeo, pointsMat([
      'attribute float aB; attribute float aP; uniform float uTime; uniform float uPx; varying float vA; varying vec3 vC;',
      'void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;',
      '  vA = aB * (0.6 + 0.4 * sin(uTime * (0.5 + aP * 0.15) + aP)); vC = vec3(0.86, 0.9, 1.0);',
      '  gl_PointSize = (1.2 + aB * 2.0) * uPx; }'
    ].join('\n'))));

    // ---------------------------------------------------------------- the dome of cover
    var DOME_R = [2700, 2350, 2000], dp = [], dt = [], dk = [];
    DOME_R.forEach(function (Rr, k) { for (var q = 0; q < 2600; q++) { dp.push(0, 0, SHORE - 400); dt.push(q / 2599); dk.push(k); } });
    var dGeo = new THREE.BufferGeometry();
    dGeo.setAttribute('position', new THREE.Float32BufferAttribute(dp, 3)); dGeo.setAttribute('aT', new THREE.Float32BufferAttribute(dt, 1)); dGeo.setAttribute('aK', new THREE.Float32BufferAttribute(dk, 1));
    U.uR = { value: new THREE.Vector3(DOME_R[0], DOME_R[1], DOME_R[2]) };
    U.uGrow = { value: new THREE.Vector3() };
    U.uRy = { value: (spireTop + 260) / DOME_R[0] };
    var dome = new THREE.Points(dGeo, pointsMat([
      'attribute float aT; attribute float aK; uniform float uTime; uniform float uPx; uniform vec3 uR; uniform vec3 uGrow; uniform float uRy; varying float vA; varying vec3 vC;',
      'void main(){',
      '  float R = aK < 0.5 ? uR.x : (aK < 1.5 ? uR.y : uR.z);',
      '  float g = aK < 0.5 ? uGrow.x : (aK < 1.5 ? uGrow.y : uGrow.z);',
      '  float a = 3.14159265 * (1.0 - aT);',
      '  vec3 p = position + vec3(cos(a) * R * g, sin(a) * R * uRy * g, 0.0);',
      '  vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;',
      '  float wave = 1.0 - smoothstep(0.0, 1.0, g);',
      '  float shimmer = 0.5 + 0.5 * sin(aT * 36.0 - uTime * 0.7 + aK * 1.7);',
      '  vA = step(0.001, g) * (0.16 + 0.08 * shimmer + 0.55 * wave) * (1.0 - aK * 0.3);',
      '  vC = vec3(0.86, 0.92, 1.0);',
      '  gl_PointSize = (2.0 - aK * 0.3) * uPx; }'
    ].join('\n')));
    dome.frustumCulled = false; scene.add(dome);

    // ---------------------------------------------------------------- post: cinematic bloom
    var composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    var bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.85, 0.55, 0.62);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    // ---------------------------------------------------------------- camera & layout
    // Low over the near bank, 7.3 km from the city: the city's foot sits at ~76% of the frame,
    // the spire tip stays below the buttons, the river mirror fills the foreground.
    var W = 1, H = 1, look = new THREE.Vector3();
    function layout() {
      var rect = hero.getBoundingClientRect();
      W = Math.max(1, rect.width); H = Math.max(1, rect.height);
      var dpr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);
      renderer.setPixelRatio(dpr); renderer.setSize(W, H, false);
      composer.setPixelRatio(dpr); composer.setSize(W, H);
      U.uPx.value = dpr;
      var portrait = W / H < 1;
      camera.aspect = W / H; camera.fov = portrait ? 52 : 30;
      camera.position.set(0, portrait ? 70 : 60, SHORE + (portrait ? 5200 : 3600));
      look.set(0, portrait ? 1500 : 600, SHORE);
      camera.lookAt(look);
      camera.updateProjectionMatrix();
      mirror.getRenderTarget().setSize(Math.round(W * dpr * 0.75), Math.round(H * dpr * 0.75));
    }

    var running = false, visible = true, t0 = performance.now();
    var pointer = { x: 0 }, ease = { x: 0 };
    hero.addEventListener('pointermove', function (ev) { var b = hero.getBoundingClientRect(); pointer.x = (ev.clientX - b.left) / b.width - 0.5; });
    function frame() {
      var time = (performance.now() - t0) / 1000;
      U.uTime.value = time;
      for (var k = 0; k < 3; k++) {
        var g = reduce ? 1 : Math.min(1, Math.max(0, (time - 0.8 - k * 0.45) / 3.4));
        U.uGrow.value.setComponent(k, 1 - Math.pow(1 - g, 3));
      }
      ease.x += (pointer.x - ease.x) * 0.03;
      camera.position.x = ease.x * 80;
      camera.lookAt(look);
      composer.render();
    }
    function loop() { if (!running) return; frame(); requestAnimationFrame(loop); }
    function start() { if (running || reduce || !visible || document.hidden) return; running = true; requestAnimationFrame(loop); }
    function stop() { running = false; }
    var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { layout(); frame(); }, 150); });
    document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { visible = en[0].isIntersecting; visible ? start() : stop(); }).observe(hero);

    layout(); frame();
    canvas.classList.add('is-ready');
    start();
  }
})();
