/* PCI raceway close-up (three.js r128): one tuyere with its blowpipe, coal lance, raceway and the coke bed around it.
   Coal particles follow the PCI model: dark coal heating up, volatiles puffing off and burning, glowing char shrinking,
   grey ash; the hot-blast gas and the flame are coloured by the calculated gas temperature. Slow motion maps the real
   ~10 ms flight to seconds. The x axis runs from the lance tip (0) through the tuyere nose to the raceway end. */
(function () {
  'use strict';
  var T = window.THREE;
  function cl(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function heat(t) {   // gas / particle temperature colour, °C → rgb 0..1 (blue cold blast → red → orange → white)
    var s = [[0, [0.10, 0.18, 0.45]], [900, [0.25, 0.32, 0.75]], [1200, [0.65, 0.12, 0.10]], [1600, [0.95, 0.35, 0.05]], [2000, [1.0, 0.72, 0.18]], [2400, [1.0, 0.95, 0.75]], [2800, [1, 1, 1]]];
    for (var i = 1; i < s.length; i++) if (t <= s[i][0]) { var f = (t - s[i - 1][0]) / (s[i][0] - s[i - 1][0]), a = s[i - 1][1], b = s[i][1]; return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]; }
    return [1, 1, 1];
  }
  var VS = 'attribute float size; attribute vec3 color; attribute float alpha; varying vec3 vC; varying float vA; uniform float scale;' +
    'void main(){ vC = color; vA = alpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }';
  var FS = 'varying vec3 vC; varying float vA; uniform float soft;' +
    'void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); if (d > 0.5) discard; float a = mix(1.0, smoothstep(0.5, 0.0, d), soft); gl_FragColor = vec4(vC, a * vA); }';
  function pointsMat(soft, additive) { return new T.ShaderMaterial({ uniforms: { scale: { value: 400 }, soft: { value: soft } }, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, blending: additive ? T.AdditiveBlending : T.NormalBlending }); }
  function label(text, opt) {
    opt = opt || {};
    var lines = String(text).split('\n'), fs = opt.size || 30, pad = 9, c = document.createElement('canvas'), x = c.getContext('2d');
    x.font = '600 ' + fs + 'px "IBM Plex Sans", Arial, sans-serif';
    var w = Math.max.apply(null, lines.map(function (l) { return x.measureText(l).width; })) + pad * 2, h = lines.length * fs * 1.22 + pad * 2;
    c.width = Math.ceil(w); c.height = Math.ceil(h); x.font = '600 ' + fs + 'px "IBM Plex Sans", Arial, sans-serif';
    x.fillStyle = 'rgba(16,18,21,.84)'; x.beginPath(); x.rect(0, 0, c.width, c.height); x.fill();
    if (opt.border) { x.strokeStyle = opt.border; x.lineWidth = 3; x.strokeRect(1.5, 1.5, c.width - 3, c.height - 3); }
    x.fillStyle = opt.color || '#f3efe8'; x.textBaseline = 'top'; lines.forEach(function (l, i) { x.fillText(l, pad, pad + i * fs * 1.22); });
    var tx = new T.CanvasTexture(c); tx.minFilter = T.LinearFilter;
    var sp = new T.Sprite(new T.SpriteMaterial({ map: tx, transparent: true, depthTest: false })); sp.renderOrder = 20;
    var k = opt.scale || 0.0021; sp.scale.set(c.width * k, c.height * k, 1); return sp;
  }

  function create(host) {
    var renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setClearColor(0x0b0c0e, 1);
    host.appendChild(renderer.domElement); var cv = renderer.domElement; cv.style.display = 'block'; cv.style.width = '100%'; cv.style.borderRadius = '8px'; cv.style.touchAction = 'none';
    var scene = new T.Scene(), camera = new T.PerspectiveCamera(40, 1, 0.01, 60), controls = new T.OrbitControls(camera, cv);
    controls.enableDamping = true; controls.dampingFactor = 0.08; controls.screenSpacePanning = true; controls.minDistance = 0.15; controls.maxDistance = 12;
    scene.add(new T.HemisphereLight(0xdfe6ee, 0x2a1a10, 0.55));
    var key = new T.DirectionalLight(0xffffff, 0.7); key.position.set(-2, 4, 5); scene.add(key);
    var glow = new T.PointLight(0xffa040, 2.2, 3.5, 1.6); scene.add(glow);
    var root = null, st = { anim: 0, visible: true, last: 0, t: 0, opts: {} };
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function size() { var W = Math.max(280, host.clientWidth), H = Math.round(cl(W * 0.72, 300, Math.min(window.innerHeight * 0.75, 640))); renderer.setSize(W, H, false); cv.style.height = H + 'px'; camera.aspect = W / H; camera.updateProjectionMatrix(); st.H = H; }
    function dispose(o) { o.traverse(function (n) { if (n.geometry) n.geometry.dispose(); if (n.material) { if (n.material.map) n.material.map.dispose(); n.material.dispose(); } }); }

    function build(r, I, opts) {
      st.r = r; st.I = I; st.opts = opts;
      if (root) { scene.remove(root); dispose(root); }
      root = new T.Group(); scene.add(root);
      var axis = new T.Group(); axis.rotation.z = -r.tilt; root.add(axis);      // tuyere tilted down towards the furnace
      var Lb = r.Lb, Dr = r.Dr, R = r.dT / 2, Lend = r.Lend, cut = opts.cut;
      var half = cut ? Math.PI : 2 * Math.PI;
      function tube(x0, x1, r0, r1, color, metal, open) {
        var g = new T.CylinderGeometry(r1, r0, x1 - x0, 40, 1, open !== false, cut ? Math.PI / 2 : 0, half);
        var m = new T.Mesh(g, new T.MeshStandardMaterial({ color: color, metalness: metal, roughness: 0.42, side: T.DoubleSide }));
        m.rotation.z = -Math.PI / 2; m.position.x = (x0 + x1) / 2; return m;
      }
      // blowpipe (steel, refractory lined) and copper tuyere; the nose is at x = Lb
      var bpL = Lb + 0.9, tuyL = 0.55;
      axis.add(tube(-0.9, Lb - tuyL, R + 0.035, R + 0.035, 0x6d747e, 0.6));
      axis.add(tube(-0.9, Lb - tuyL, R + 0.012, R + 0.012, 0x8a5a44, 0.05));
      axis.add(tube(Lb - tuyL, Lb, R + 0.07, R + 0.03, 0xb87333, 0.8));
      axis.add(tube(Lb - tuyL, Lb, R + 0.005, R + 0.0, 0xd08a50, 0.8));
      // coal lance: tip on the axis at x = 0, entering the blowpipe from above at the lance angle
      var la = r.la, dir = new T.Vector3(-Math.cos(la), Math.sin(la), 0), L = 0.9;
      var lg = new T.CylinderGeometry(0.011, 0.011, L, 16), lance = new T.Mesh(lg, new T.MeshStandardMaterial({ color: 0xd9dde2, metalness: 0.7, roughness: 0.3 }));
      lance.position.copy(dir.clone().multiplyScalar(L / 2)); lance.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir.clone().normalize()); axis.add(lance);
      // raceway cavity and coke bed
      var rc = new T.Vector3(Lb + Dr * 0.5, 0, 0), ra = Dr * 0.55, rb = Math.max(0.45, Dr * 0.42), rz = Math.max(0.36, Dr * 0.34);
      var shell = new T.Mesh(new T.SphereGeometry(1, 48, 32, cut ? Math.PI : 0, half), new T.MeshStandardMaterial({ color: 0xc8501a, emissive: 0xb83a00, emissiveIntensity: 0.5, transparent: true, opacity: 0.42, side: T.BackSide, depthWrite: false }));
      shell.scale.set(ra, rb, rz); shell.position.copy(rc); axis.add(shell);
      glow.position.set(rc.x, rc.y, rc.z);
      var lumps = 1600, geo = new T.DodecahedronGeometry(0.045, 0), mat = new T.MeshStandardMaterial({ color: 0x3a3a3c, roughness: 0.95, metalness: 0.05, emissive: 0x000000 });
      var inst = new T.InstancedMesh(geo, mat, lumps), m4 = new T.Matrix4(), q = new T.Quaternion(), sc = new T.Vector3(), p = new T.Vector3(), colA = [];
      var seed = 7; function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
      var placed = 0, tries = 0;
      while (placed < lumps && tries < lumps * 12) {
        tries++;
        p.set(Lb - 0.05 + rnd() * (Dr + 0.75), -rb - 0.35 + rnd() * (2 * rb + 0.75), -rz - 0.45 + rnd() * (2 * rz + 0.9));
        var e = Math.pow((p.x - rc.x) / ra, 2) + Math.pow((p.y - rc.y) / rb, 2) + Math.pow((p.z - rc.z) / rz, 2);
        if (e < 1.02) continue;                                  // inside the raceway
        if (cut && p.z > 0.02) continue;                         // cut-away towards the viewer
        if (p.x < Lb + 0.02 && Math.hypot(p.y, p.z) < R + 0.09) continue;
        var s2 = 0.65 + rnd() * 0.8; sc.set(s2, s2 * (0.8 + rnd() * 0.4), s2);
        q.setFromEuler(new T.Euler(rnd() * 6, rnd() * 6, rnd() * 6)); m4.compose(p, q, sc); inst.setMatrixAt(placed, m4);
        var hot = Math.exp(-Math.max(e - 1, 0) * 3.2), c = new T.Color().setRGB(0.22 + 0.75 * hot, 0.21 + 0.33 * hot, 0.2 + 0.05 * hot);
        inst.setColorAt(placed, c); placed++;
      }
      inst.count = placed; inst.instanceMatrix.needsUpdate = true; if (inst.instanceColor) inst.instanceColor.needsUpdate = true; axis.add(inst);
      // flame / gas temperature envelope along the axis (lathe with vertex colours)
      if (opts.flame) {
        var prof = r.prof, pts = [], cols = [], NA = 36;
        var rad = function (x) { return x < Lb ? Math.min(r.plumeR(x) + 0.004, R * 0.95) : Math.min(R + (x - Lb) * 0.55, rb * 0.92); };
        var pos = [], col = [], idx = [];
        prof.forEach(function (pp, i) { for (var k = 0; k <= NA; k++) { var a = (cut ? Math.PI : 0) + half * k / NA, rr = rad(pp.x) * (pp.x > Lb ? Math.sqrt(Math.max(0, 1 - Math.pow((pp.x - rc.x) / (ra * 1.02), 2))) : 1); pos.push(pp.x, rr * Math.cos(a), rr * Math.sin(a)); var c = heat(pp.Tg); col.push(c[0], c[1], c[2]); } });
        for (var i = 0; i < prof.length - 1; i++) for (var k = 0; k < NA; k++) { var a0 = i * (NA + 1) + k, b0 = a0 + NA + 1; idx.push(a0, b0, a0 + 1, b0, b0 + 1, a0 + 1); }
        var fg = new T.BufferGeometry(); fg.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); fg.setAttribute('color', new T.Float32BufferAttribute(col, 3)); fg.setIndex(idx);
        axis.add(new T.Mesh(fg, new T.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.16, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending })));
      }
      // ruler under the axis and the key positions
      var ry = -Math.max(rb, R) - 0.5;
      var rl = new T.BufferGeometry().setFromPoints([new T.Vector3(-0.1, ry, 0), new T.Vector3(Lend, ry, 0)]); axis.add(new T.Line(rl, new T.LineBasicMaterial({ color: 0x8a8f97 })));
      for (var xx = 0; xx <= Lend + 1e-6; xx += 0.25) { var tk = new T.BufferGeometry().setFromPoints([new T.Vector3(xx, ry, 0), new T.Vector3(xx, ry + 0.05, 0)]); axis.add(new T.Line(tk, new T.LineBasicMaterial({ color: 0x8a8f97 }))); var tl = label((xx * 1000).toFixed(0) + ' mm', { size: 22, scale: 0.0016 }); tl.position.set(xx, ry - 0.08, 0); axis.add(tl); }
      function mark(x, txt, color, yOff) {
        var ln = new T.BufferGeometry().setFromPoints([new T.Vector3(x, ry + 0.05, 0), new T.Vector3(x, (yOff || 0.6), 0)]), lo = new T.Line(ln, new T.LineDashedMaterial({ color: color, dashSize: 0.04, gapSize: 0.03 })); lo.computeLineDistances(); axis.add(lo);
        var lb = label(txt, { border: '#' + new T.Color(color).getHexString(), size: 24 }); lb.position.set(x, (yOff || 0.6) + 0.1, 0); axis.add(lb);
      }
      mark(0, 'Lance tip', 0xd9dde2, R + 0.45);
      mark(Lb, 'Tuyere nose · ' + r.tNose.toFixed(1) + ' ms', 0xd08a50, rb + 0.25);
      if (r.o2Zero != null) mark(r.o2Zero, 'O₂ used up · ' + Math.round(r.o2Zero * 1000) + ' mm', 0x4fc3d6, rb + 0.45);
      mark(r.xPk, 'Peak flame ' + Math.round(r.Tpk) + ' °C', 0xffd34d, rb + 0.7);
      mark(Lend, 'Raceway end · burnout ' + r.burn.toFixed(0) + ' %', 0xff7a1a, rb + 0.25);
      var hb = label('Hot blast ' + Math.round(I.HBT) + ' °C\n' + Math.round(I.BV / r.nT) + ' Nm³/min air per tuyere', { size: 24 }); hb.position.set(-0.6, -R - 0.32, 0); axis.add(hb);
      var cl1 = label('Coal ' + r.coalKgMin.toFixed(1) + ' kg/min per lance\n' + Math.round(I.pciD) + ' µm mean, ' + Math.round(100 - I.pciR75) + ' % −75 µm', { size: 24, border: '#9aa3ad' }); cl1.position.copy(dir.clone().multiplyScalar(0.85)).add(new T.Vector3(0, 0.12, 0)); axis.add(cl1);
      var ck = label('Coke bed', { size: 24 }); ck.position.set(Lb + Dr * 0.95, -rb - 0.15, -rz - 0.2); axis.add(ck);
      st.axis = axis; st.ry = ry;
      // particles
      st.coal = coalSystem(r, opts.count, axis);
      st.vols = volatileSystem(r, axis);
      st.gas = gasSystem(r, axis, rad2);
      function rad2(x) { return x < Lb ? R * 0.9 : Math.min(R + (x - Lb) * 0.6, rb * 0.85) * Math.sqrt(Math.max(0.05, 1 - Math.pow((x - rc.x) / (ra * 1.02), 2))); }
      st.coal.points.visible = opts.coal; st.vols.points.visible = opts.vol; st.gas.points.visible = opts.gas;
      render();
    }
    // profile lookup by distance
    function at(r, x) { var P = r.prof, lo = 0, hi = P.length - 1; if (x <= P[0].x) return [P[0], P[0], 0]; if (x >= P[hi].x) return [P[hi], P[hi], 0]; while (hi - lo > 1) { var m = (lo + hi) >> 1; if (P[m].x < x) lo = m; else hi = m; } return [P[lo], P[hi], (x - P[lo].x) / (P[hi].x - P[lo].x)]; }
    function coalSystem(r, N, axis) {
      N = Math.round(cl(N || 500, 50, 2000));
      var pos = new Float32Array(N * 3), col = new Float32Array(N * 3), sz = new Float32Array(N), al = new Float32Array(N), P = [];
      for (var i = 0; i < N; i++) P.push({ k: i % 5, x: Math.random() * r.Lend, a: Math.random() * Math.PI * 2, rr: Math.sqrt(Math.random()) });
      var g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('color', new T.BufferAttribute(col, 3)); g.setAttribute('size', new T.BufferAttribute(sz, 1)); g.setAttribute('alpha', new T.BufferAttribute(al, 1));
      var pts = new T.Points(g, pointsMat(0.25, false)); pts.renderOrder = 5; axis.add(pts);
      function step(dt, slow) {
        for (var i = 0; i < N; i++) {
          var p = P[i], A = at(r, p.x), f = A[2], a = A[0], b = A[1], ca = a.cls[p.k], cb = b.cls[p.k];
          var up = a.up[p.k] + (b.up[p.k] - a.up[p.k]) * f, Tp = ca.T + (cb.T - ca.T) * f, vol = ca.vol + (cb.vol - ca.vol) * f, ch = ca.ch + (cb.ch - ca.ch) * f, d = a.d[p.k] + (b.d[p.k] - a.d[p.k]) * f;
          p.x += up * dt / slow;
          if (p.x > r.Lend + 0.25) { p.x = 0; p.a = Math.random() * Math.PI * 2; p.rr = Math.sqrt(Math.random()); }
          var spread = p.x < r.Lb ? r.plumeR(p.x) : Math.min(r.dT / 2 + (p.x - r.Lb) * 0.55, 0.45);
          var y = Math.cos(p.a) * spread * p.rr, z = Math.sin(p.a) * spread * p.rr;
          pos[i * 3] = p.x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = st.opts.cut ? -Math.abs(z) : z;
          // colour by state: raw coal (dark) → devolatilising (dark red rim) → burning char (glow by temperature) → ash (grey)
          var c;
          if (ch > 0.985) { c = [0.55, 0.55, 0.55]; al[i] = 0.55; sz[i] = 0.006; }
          else if (vol < 0.05) { var w = cl((Tp - 200) / 900, 0, 1); c = [0.13 + 0.45 * w, 0.12 + 0.08 * w, 0.11]; al[i] = 1; sz[i] = 0.012 + d * 0.00012; }
          else if (vol < 0.97 && Tp < 1500) { c = [0.55, 0.16, 0.06]; al[i] = 1; sz[i] = 0.012 + d * 0.00012; }
          else { var h = heat(Math.max(Tp, 1200)); c = [h[0], h[1] * 0.92, h[2] * 0.8]; al[i] = 1; sz[i] = (0.01 + d * 0.00011) * (1 - 0.55 * ch); }
          col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
        }
        g.attributes.position.needsUpdate = g.attributes.color.needsUpdate = g.attributes.size.needsUpdate = g.attributes.alpha.needsUpdate = true;
      }
      step(0, 1); return { points: pts, step: step, mat: pts.material };
    }
    function volatileSystem(r, axis) {
      var N = 260, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), sz = new Float32Array(N), al = new Float32Array(N), P = [];
      // emitted where the volatiles are released (between 5 % and 95 % release), drifting with the gas and burning while O2 remains
      var x0 = null, x1 = null; r.prof.forEach(function (p) { if (x0 == null && p.vol > 5) x0 = p.x; if (x1 == null && p.vol > 95) x1 = p.x; });
      x0 = x0 == null ? r.Lb : x0; x1 = x1 == null ? r.Lend : x1;
      for (var i = 0; i < N; i++) P.push({ x: x0 + Math.random() * (x1 - x0), age: Math.random(), a: Math.random() * 6.28, rr: Math.random() });
      var g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('color', new T.BufferAttribute(col, 3)); g.setAttribute('size', new T.BufferAttribute(sz, 1)); g.setAttribute('alpha', new T.BufferAttribute(al, 1));
      var pts = new T.Points(g, pointsMat(1, true)); pts.renderOrder = 4; axis.add(pts);
      function step(dt, slow) {
        for (var i = 0; i < N; i++) {
          var p = P[i], A = at(r, p.x), pr = A[0], u = pr.u;
          p.x += u * dt / slow * 0.8; p.age += dt * 0.9;
          if (p.age > 1 || p.x > r.Lend) { p.x = x0 + Math.random() * (x1 - x0); p.age = 0; p.a = Math.random() * 6.28; p.rr = Math.random(); }
          var spread = (p.x < r.Lb ? r.plumeR(p.x) : Math.min(r.dT / 2 + (p.x - r.Lb) * 0.5, 0.4)) * (0.6 + 0.6 * p.rr);
          pos[i * 3] = p.x; pos[i * 3 + 1] = Math.cos(p.a) * spread; pos[i * 3 + 2] = (st.opts.cut ? -1 : 1) * Math.abs(Math.sin(p.a) * spread);
          var burning = pr.O2 > 1, c = burning ? [1.0, 0.75, 0.35] : [0.85, 0.85, 0.8];
          col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2]; sz[i] = 0.03 + 0.07 * p.age; al[i] = (1 - p.age) * (burning ? 0.45 : 0.25);
        }
        g.attributes.position.needsUpdate = g.attributes.color.needsUpdate = g.attributes.size.needsUpdate = g.attributes.alpha.needsUpdate = true;
      }
      step(0, 1); return { points: pts, step: step };
    }
    function gasSystem(r, axis, rad) {
      var N = 500, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), sz = new Float32Array(N), al = new Float32Array(N), P = [];
      for (var i = 0; i < N; i++) P.push({ x: -0.9 + Math.random() * (r.Lend + 0.9), a: Math.random() * 6.28, rr: Math.sqrt(Math.random()) });
      var g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('color', new T.BufferAttribute(col, 3)); g.setAttribute('size', new T.BufferAttribute(sz, 1)); g.setAttribute('alpha', new T.BufferAttribute(al, 1));
      var pts = new T.Points(g, pointsMat(1, true)); pts.renderOrder = 3; axis.add(pts);
      function step(dt, slow) {
        for (var i = 0; i < N; i++) {
          var p = P[i], A = at(r, Math.max(p.x, 0)), pr = A[0];
          p.x += pr.u * dt / slow;
          if (p.x > r.Lend) { p.x = -0.9; p.a = Math.random() * 6.28; p.rr = Math.sqrt(Math.random()); }
          var rr = rad(Math.max(p.x, 0)) * p.rr;
          pos[i * 3] = p.x; pos[i * 3 + 1] = Math.cos(p.a) * rr; pos[i * 3 + 2] = (st.opts.cut ? -1 : 1) * Math.abs(Math.sin(p.a) * rr);
          var c = heat(p.x < 0 ? st.I.HBT : pr.Tg); col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2]; sz[i] = 0.018; al[i] = 0.5;
        }
        g.attributes.position.needsUpdate = g.attributes.color.needsUpdate = g.attributes.size.needsUpdate = g.attributes.alpha.needsUpdate = true;
      }
      step(0, 1); return { points: pts, step: step };
    }
    function render() {
      [st.coal, st.vols, st.gas].forEach(function (s) { if (s && s.points.material.uniforms) s.points.material.uniforms.scale.value = (st.H || 400) * 0.9; });
      renderer.render(scene, camera);
    }
    function loop(t) {
      st.anim = 0; var dt = st.last ? Math.min((t - st.last) / 1000, 0.05) : 0.016; st.last = t;
      controls.update();
      var slow = st.opts.slow || 400;     // shown time ÷ real time
      if (!reduce && st.coal) { st.coal.step(dt, slow); st.vols.step(dt, slow); st.gas.step(dt, slow); }
      render();
      if (st.visible && !reduce) st.anim = requestAnimationFrame(loop);
    }
    function kick() { if (!st.anim) { st.last = 0; st.anim = requestAnimationFrame(loop); } }
    controls.addEventListener('change', function () { if (reduce) render(); });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { st.visible = es[0].isIntersecting && !document.hidden; if (st.visible) kick(); }).observe(cv);
    document.addEventListener('visibilitychange', function () { st.visible = !document.hidden; if (st.visible) kick(); });
    size(); window.addEventListener('resize', function () { size(); kick(); });
    function view(name) {
      var r = st.r; if (!r) return; var mid = r.Lend / 2;
      var V = { side: [new T.Vector3(mid - 0.15, 0.15, 0), new T.Vector3(mid - 0.15, 0.55, r.Lend * 1.55 + 1.6)], lance: [new T.Vector3(0.05, 0, 0), new T.Vector3(-0.25, 0.25, 0.75)],
        nose: [new T.Vector3(r.Lb, 0, 0), new T.Vector3(r.Lb - 0.2, 0.2, 0.85)], raceway: [new T.Vector3(r.Lb + r.Dr * 0.5, 0, 0), new T.Vector3(r.Lb + r.Dr * 0.35, 0.35, 1.7)] }[name];
      if (!V) return; controls.target.copy(V[0]); camera.position.copy(V[1]); controls.update(); kick();
    }
    return {
      build: function (r, I, opts) { var first = !st.r; size(); build(r, I, opts); if (first) view('side'); kick(); },
      opts: function (o) { Object.assign(st.opts, o); if (st.coal) { st.coal.points.visible = st.opts.coal; st.vols.points.visible = st.opts.vol; st.gas.points.visible = st.opts.gas; } kick(); },
      view: view, resize: function () { size(); kick(); }
    };
  }
  window.BFPci3D = { create: create };
})();
