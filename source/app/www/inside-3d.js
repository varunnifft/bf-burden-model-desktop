/* Furnace 3D view, 3D view (three.js r128 + OrbitControls from lib/). A cut-away furnace built from the model result:
   temperature (or the selected field) on the two cut faces and on a level slice, cohesive zone shells, raceways at every
   tuyere with the coal lance plumes, tapholes, hearth and deadman, the four uptakes, the burden probe and periphery
   thermocouples at their angles, moving gas, and the measured lean of the gas around the furnace.
   Angles: 0° at Top temp 1, clockwise seen from the top. Tuyere 1 is drawn at 0°. */
(function () {
  'use strict';
  var T = window.THREE;
  function cl(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function isNum(x) { return typeof x === 'number' && isFinite(x); }
  // furnace angle θ (clockwise from 0° at the back, seen from the top) -> x, z
  function P(r, y, th) { var t = th * Math.PI / 180; return new T.Vector3(r * Math.sin(t), y, -r * Math.cos(t)); }

  function label(text, opt) {
    opt = opt || {};
    var lines = String(text).split('\n'), fs = opt.size || 34, pad = 10;
    var c = document.createElement('canvas'), x = c.getContext('2d');
    x.font = '600 ' + fs + 'px "IBM Plex Sans", Arial, sans-serif';
    var w = Math.max.apply(null, lines.map(function (l) { return x.measureText(l).width; })) + pad * 2, h = lines.length * fs * 1.2 + pad * 2;
    c.width = Math.ceil(w); c.height = Math.ceil(h);
    x.font = '600 ' + fs + 'px "IBM Plex Sans", Arial, sans-serif';
    x.fillStyle = opt.bg || 'rgba(16,18,21,.82)'; roundRect(x, 0, 0, c.width, c.height, 10); x.fill();
    if (opt.border) { x.strokeStyle = opt.border; x.lineWidth = 3; roundRect(x, 1.5, 1.5, c.width - 3, c.height - 3, 9); x.stroke(); }
    x.fillStyle = opt.color || '#f3efe8'; x.textBaseline = 'top';
    lines.forEach(function (l, i) { x.fillText(l, pad, pad + i * fs * 1.2); });
    var tx = new T.CanvasTexture(c); tx.minFilter = T.LinearFilter;
    var sp = new T.Sprite(new T.SpriteMaterial({ map: tx, depthTest: opt.depthTest !== false, transparent: true }));
    var k = (opt.scale || 0.011); sp.scale.set(c.width * k, c.height * k, 1);
    sp.renderOrder = 10;
    return sp;
  }
  function roundRect(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }

  function create(host, api) {
    // api: { sample(field, d, s), lut(view), range(view), colorOf(view, v) -> [r,g,b], onPick(info) }
    var renderer = new T.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x0b0c0e, 1);
    host.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block'; renderer.domElement.style.width = '100%'; renderer.domElement.style.borderRadius = '8px'; renderer.domElement.style.touchAction = 'none';
    var scene = new T.Scene(), camera = new T.PerspectiveCamera(42, 1, 0.1, 400);
    var controls = new T.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.08; controls.screenSpacePanning = true; controls.minDistance = 1.2; controls.maxDistance = 90;
    scene.add(new T.AmbientLight(0xffffff, 0.55));
    var key = new T.DirectionalLight(0xffffff, 0.75); key.position.set(12, 30, 18); scene.add(key);
    var rim = new T.DirectionalLight(0xffb37a, 0.35); rim.position.set(-14, 6, -10); scene.add(rim);
    var root = null, st = { opts: {}, parts: null, coal: null, planes: [], anim: 0, visible: true, last: 0, tween: null };
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function size() {
      var W = Math.max(280, host.clientWidth), H = Math.round(cl(W * 1.05, 380, Math.min(window.innerHeight * 0.82, 760)));
      renderer.setSize(W, H, false); renderer.domElement.style.height = H + 'px';
      camera.aspect = W / H; camera.updateProjectionMatrix();
    }
    function disposeTree(o) { o.traverse(function (n) { if (n.geometry) n.geometry.dispose(); if (n.material) { (Array.isArray(n.material) ? n.material : [n.material]).forEach(function (m) { if (m.map) m.map.dispose(); m.dispose(); }); } }); }

    /* ---------- build the scene from a model result */
    function build(o, view, diag, opts) {
      st.opts = opts; st.o = o; st.view = view; st.diag = diag;
      if (root) { scene.remove(root); disposeTree(root); }
      root = new T.Group(); scene.add(root); st.planes = [];
      var g = o.g, I = o.I, zt = g.zt, yS = zt - g.zs, Hh = g.hH, cut = cl(opts.cut || 100, 20, 200) * Math.PI / 180;
      var Y = function (d) { return zt - d; }, Rof = function (d) { return d <= zt ? g.r(d) : g.Rh; };
      var phiS = cut / 2, phiL = Math.PI * 2 - cut;
      // shell: inner lining (refractory) and outer steel, cut open towards the viewer
      var prof = [], prof2 = [];
      for (var d = 0; d <= zt + Hh + 1e-6; d += 0.25) { var dd = Math.min(d, zt + Hh); prof.push(new T.Vector2(Rof(dd) + 0.02, Y(dd))); prof2.push(new T.Vector2(Rof(dd) + 0.38, Y(dd))); }
      prof.push(new T.Vector2(0.01, -Hh)); prof2.push(new T.Vector2(0.01, -Hh - 0.36));
      var lin = new T.Mesh(new T.LatheGeometry(prof, 96, phiS, phiL), new T.MeshStandardMaterial({ color: 0x6b3f2c, roughness: 0.9, metalness: 0.05, side: T.BackSide }));
      var shell = new T.Mesh(new T.LatheGeometry(prof2, 96, phiS, phiL), new T.MeshStandardMaterial({ color: 0x59606a, roughness: 0.55, metalness: 0.55, side: T.FrontSide }));
      root.add(lin, shell);
      // top cone and the four uptakes
      var cone = [new T.Vector2(g.Rt + 0.38, zt), new T.Vector2(g.Rt * 0.55, zt + 2.4), new T.Vector2(0.9, zt + 3.0)];
      root.add(new T.Mesh(new T.LatheGeometry(cone, 64, phiS, phiL), new T.MeshStandardMaterial({ color: 0x59606a, roughness: 0.6, metalness: 0.5, side: T.DoubleSide, transparent: true, opacity: 0.45, depthWrite: false })));
      (o.tops || []).forEach(function (t, i) {
        var a = t.ang, p0 = P(g.Rt * 0.72, zt + 1.3, a), p1 = P(g.Rt * 0.9, zt + 6.0, a);
        var pipe = cyl(p0, p1, 0.32, 0x6d747e); root.add(pipe);
        var col = isNum(t.v) ? css(api.colorOf('heat', t.v, 0, 400)) : '#9aa3ad';
        var lb = label('Top temp ' + (i + 1) + '  ' + Math.round(a) + '°\n' + (isNum(t.v) ? Math.round(t.v) + ' °C' : 'not entered') + '  ·  calc ' + Math.round(o.topMix) + ' °C', { border: col, size: 30 });
        lb.position.copy(p1).add(new T.Vector3(0, 1.0, 0)); root.add(lb);
      });
      // compass at the stockline level, outside the shell
      [0, 90, 180, 270].forEach(function (a) { var lb = label(a + '°', { size: 30, bg: 'rgba(194,65,12,.85)' }); lb.position.copy(P(g.Rb + 2.2, yS + 0.3, a)); root.add(lb); });
      var ringG = new T.BufferGeometry().setFromPoints(Array.from({ length: 121 }, function (_, i) { return P(g.Rb + 1.6, yS, i * 3); }));
      root.add(new T.Line(ringG, new T.LineBasicMaterial({ color: 0x8a8f97 })));

      // cut faces with the field
      var tex = fieldTexture(o, view);
      [phiS, -phiS].forEach(function (ph) { var th = 180 - ph * 180 / Math.PI; var m = sectionPlane(o, th, tex); root.add(m); st.planes.push(m); });
      // level slice
      if (opts.slice) { var sl = slice(o, view, opts.sliceH, phiS, phiL, diag && opts.lean ? diag.circ : null); if (sl) { root.add(sl); st.planes.push(sl); } }
      // burden surface at the stockline
      var bs = []; for (var s = 0; s <= 1.0001; s += 0.1) bs.push(new T.Vector2(s * (g.Rt - 0.02), yS - 0.35 * (1 - s * s) * 0.6));
      root.add(new T.Mesh(new T.LatheGeometry(bs, 64, phiS, phiL), new T.MeshStandardMaterial({ color: 0x5a4636, roughness: 1, side: T.DoubleSide, transparent: true, opacity: 0.9 })));
      // cohesive zone shells
      if (opts.cz) {
        var top = [], bot = [];
        o.R.forEach(function (r, i) { var c = o.cz[i]; if (c.top != null) { top.push(new T.Vector2(r.sm * g.r(c.top), Y(c.top))); bot.push(new T.Vector2(r.sm * g.r(c.bot == null ? zt : c.bot), Y(c.bot == null ? zt : c.bot))); } });
        if (top.length > 1) {
          top.unshift(new T.Vector2(0, top[0].y)); bot.unshift(new T.Vector2(0, bot[0].y));
          root.add(new T.Mesh(new T.LatheGeometry(top, 72, phiS, phiL), new T.MeshStandardMaterial({ color: 0xffc23d, emissive: 0x6b3500, transparent: true, opacity: 0.55, side: T.DoubleSide, depthWrite: false })));
          root.add(new T.Mesh(new T.LatheGeometry(bot, 72, phiS, phiL), new T.MeshStandardMaterial({ color: 0xff7a1a, emissive: 0x5a1a00, transparent: true, opacity: 0.32, side: T.DoubleSide, depthWrite: false })));
          var ap = label('Cohesive zone\napex ' + (o.czApexH == null ? '–' : o.czApexH.toFixed(1)) + ' m, root ' + (o.czRootH == null ? '–' : o.czRootH.toFixed(1)) + ' m', { size: 28, border: '#ffc23d' , depthTest: false });
          ap.position.set(0, top[0].y + 1.2, 0); root.add(ap);
        }
      }
      // hearth: hot metal, slag, deadman
      var hm = new T.Mesh(new T.CylinderGeometry(g.Rh, g.Rh, Hh * 0.5, 64, 1, false, phiS, phiL), new T.MeshStandardMaterial({ color: 0xff7a1a, emissive: 0xc2410c, emissiveIntensity: 0.9, roughness: 0.4 }));
      hm.position.y = -Hh * 0.75; root.add(hm);
      var sg = new T.Mesh(new T.CylinderGeometry(g.Rh, g.Rh, Hh * 0.18, 64, 1, false, phiS, phiL), new T.MeshStandardMaterial({ color: 0x8a3b12, emissive: 0x3a1204, roughness: 0.7 }));
      sg.position.y = -Hh * 0.41; root.add(sg);
      var dm = new T.Mesh(new T.ConeGeometry(o.sRw * g.Rh, o.hDM + Hh * 0.3, 48, 1, true, phiS, phiL), new T.MeshStandardMaterial({ color: 0x2d2f33, transparent: true, opacity: 0.55, side: T.DoubleSide, depthWrite: false }));
      dm.position.y = (o.hDM - Hh * 0.3) / 2; root.add(dm);
      var dml = label('Deadman', { size: 26, depthTest: false }); dml.position.set(0, o.hDM * 0.45, 0); root.add(dml);
      // tuyeres, blowpipes, bustle main, coal lances, raceways
      var nT = Math.max(1, Math.round(I.nTuy)), Rh = g.Rh, Dr = o.rw.Dr, bustR = Math.max(g.Rb, Rh) + 1.9, bustY = 2.6;
      var bust = new T.Mesh(new T.TorusGeometry(bustR, 0.38, 12, 96), new T.MeshStandardMaterial({ color: 0x7a8088, metalness: 0.6, roughness: 0.45 }));
      bust.rotation.x = Math.PI / 2; bust.position.y = bustY; root.add(bust);
      var bl = label('Bustle main · ' + Math.round(I.HBT) + ' °C hot blast', { size: 26 }); bl.position.copy(P(bustR, bustY + 0.9, 135)); root.add(bl);
      var rwMat = new T.MeshStandardMaterial({ color: 0xffe08a, emissive: 0xffa31a, emissiveIntensity: 1.1, transparent: true, opacity: 0.6, depthWrite: false });
      st.lances = [];
      for (var k = 0; k < nT; k++) {
        var a = k * 360 / nT;
        root.add(cyl(P(Rh - 0.25, 0, a), P(Rh + 0.6, 0, a), 0.12, 0xb87333));                    // copper tuyere
        root.add(cyl(P(Rh + 0.6, 0, a), P(Rh + 1.5, 0.15, a), 0.15, 0x6d747e));                   // blowpipe
        root.add(cyl(P(Rh + 1.5, 0.15, a), P(bustR, bustY, a), 0.13, 0x6d747e));                  // downleg to bustle
        var lt = P(Rh + 0.35, 0.02, a), lb0 = P(Rh + 1.35, 0.55, a);                               // coal lance, into the blowpipe
        root.add(cyl(lb0, lt, 0.035, 0xd9dde2));
        st.lances.push({ a: a, tip: lt });
        var rwy = new T.Mesh(new T.SphereGeometry(1, 20, 14), rwMat);
        rwy.scale.set(0.38, 0.62, Dr / 2 + 0.05); rwy.position.copy(P(Rh - Dr / 2 - 0.1, 0, a)); rwy.lookAt(0, 0, 0); root.add(rwy);
        if (nT <= 40 && (k % Math.max(1, Math.round(nT / 8)) === 0)) { var tl = label('Tuyere ' + (k + 1), { size: 22 }); tl.position.copy(P(Rh + 1.25, -0.55, a)); root.add(tl); }
      }
      var tuyL = label(nT + ' tuyeres · raceway ' + Dr.toFixed(2) + ' m · RAFT ' + Math.round(o.rw.raft) + ' °C\nPCI ' + Math.round(I.pci) + ' kg/tHM, ' + (o.rw.coalPerTuy).toFixed(1) + ' kg/min per lance', { size: 26, border: '#ffd34d' , depthTest: false });
      tuyL.position.copy(P(bustR + 1.2, 4.2, 110)); root.add(tuyL);
      // tapholes
      var nTap = Math.max(1, Math.round(I.nTap || 1)), tapY = -Hh * 0.72;
      for (var q = 0; q < nTap; q++) {
        var ta = ((I.tapAng || 0) + q * 360 / nTap) % 360;
        root.add(cyl(P(Rh - 0.1, tapY, ta), P(Rh + 1.0, tapY - 0.25, ta), 0.16, 0x2b2d31));
        var spout = cyl(P(Rh + 1.0, tapY - 0.25, ta), P(Rh + 1.6, tapY - 1.3, ta), 0.08, 0xff7a1a); spout.material.emissive = new T.Color(0xff5a00); root.add(spout);
        var thl = label('Taphole ' + (q + 1) + ' · ' + Math.round(ta) + '°', { size: 26, border: '#ff7a1a' , depthTest: false }); thl.position.copy(P(Rh + 2.2, tapY - 0.4, ta)); root.add(thl);
      }
      // burden probe (two arms) and periphery thermocouples
      if (opts.meas) {
        var prY = Y(o.prDepth), la = I.prAng || 0, Rp = g.r(Math.max(o.prDepth, 0));
        root.add(cyl(P(Rp + 0.4, prY, la), P(Rp + 0.4, prY, la + 180), 0.07, 0xc8ccd2));
        o.probe.forEach(function (p) {
          [['L', la, p.L, 'TL'], ['R', la + 180, p.R, 'TR']].forEach(function (arm) {
            var col = isNum(arm[2]) ? api.colorOf('heat', arm[2], 0, 900) : [0.55, 0.58, 0.62];
            var sp = new T.Mesh(new T.SphereGeometry(0.16, 14, 10), new T.MeshStandardMaterial({ color: new T.Color(col[0], col[1], col[2]), emissive: new T.Color(col[0] * 0.5, col[1] * 0.5, col[2] * 0.5) }));
            sp.position.copy(P(p.d, prY, arm[1])); root.add(sp);
            if (p.i === 1 || p.i === o.probe.length) { var l2 = label(arm[3] + p.i + ' ' + (isNum(arm[2]) ? Math.round(arm[2]) + '°C' : '–') + ' / calc ' + Math.round(p.model), { size: 22 }); l2.position.copy(P(p.d, prY + 0.55 + (p.i === 1 ? 0.45 : 0), arm[1])); root.add(l2); }
          });
        });
        var pY = Y(o.peDepth), pR = Rof(o.peDepth);
        o.peri.forEach(function (p) {
          var col = isNum(p.v) ? api.colorOf('heat', p.v, 0, 400) : [0.55, 0.58, 0.62];
          var m = new T.Mesh(new T.BoxGeometry(0.3, 0.3, 0.3), new T.MeshStandardMaterial({ color: new T.Color(col[0], col[1], col[2]), emissive: new T.Color(col[0] * 0.4, col[1] * 0.4, col[2] * 0.4) }));
          m.position.copy(P(pR - 0.05, pY, p.ang)); root.add(m);
          if (o.peri.length <= 12 || p.j % 2 === 1) { var l3 = label('T' + p.j + (isNum(p.v) ? ' ' + Math.round(p.v) : ''), { size: 22 }); l3.position.copy(P(pR + 0.9, pY + 0.35, p.ang)); root.add(l3); }
        });
      }
      // measured lean of the gas: arrow at the stockline towards the hot side
      if (diag && diag.circ && diag.circ.amp > 8 && opts.lean) {
        var dir = P(1, 0, diag.circ.dir).normalize(), len = cl(1.2 + diag.circ.amp / 12, 1.5, g.Rt * 0.95);
        var arrow = new T.ArrowHelper(dir, new T.Vector3(0, yS + 0.9, 0), len, 0xff3b30, 0.7, 0.45); root.add(arrow);
        var al = label('Gas leaning to ' + Math.round(diag.circ.dir) + '°  (+' + Math.round(diag.circ.amp) + ' °C)', { size: 28, border: '#ff3b30', color: '#ffd2cc' , depthTest: false });
        al.position.copy(P(len * 0.6, yS + 1.9, diag.circ.dir)); root.add(al);
      }
      // Learn: what each zone is, placed in the open sector facing the viewer
      if (opts.learn) {
        var apexY = o.czApexH != null ? o.czApexH : zt * 0.5, rootY = o.czRootH != null ? o.czRootH : 2;
        var ti = Math.min(Math.round(o.NR * 0.6), o.NR - 1), tz = o.trz[ti] || {}, trzY = tz.top != null && tz.bot != null ? Y((tz.top + tz.bot) / 2) : (apexY + yS) / 2;
        var L = [
          [yS - (yS - apexY) * 0.3, 0.55, 'Lumpy zone', 'Ore and coke in layers. The rising gas heats the burden and reduces Fe₂O₃ to FeO.'],
          [trzY, 0.62, 'Thermal reserve zone', 'Gas and burden near 900–1000 °C, almost the same temperature: FeO is reduced by CO.'],
          [(apexY + rootY) / 2 + 0.6, 0.25, 'Cohesive zone', 'Ore softens and melts. Gas can pass only through the coke slits between ore layers.'],
          [Math.max(rootY * 0.55, 1.2), 0.45, 'Dripping zone', 'Active coke; liquid iron and slag trickle down through it.'],
          [0.35, 0.95, 'Raceway', 'Coke and coal burn in the hot blast at about ' + Math.round(o.rw.raft) + ' °C; CO and H₂ go up.'],
          [o.hDM * 0.3, 0.05, 'Deadman', 'A slowly renewed coke core that sits in the hearth.'],
          [-Hh * 0.6, 0.6, 'Hearth', 'Iron and slag collect here and leave through the tapholes.']];
        // labels stacked outside the furnace (sorted by height, at least 2.1 m apart), each with a leader line to its zone
        L.sort(function (p1, p2) { return p1[0] - p2[0]; });
        var yl = -Hh - 0.5, outR = Math.max(g.Rb, g.Rh) + 4.2;
        L.forEach(function (q) {
          yl = Math.max(q[0], yl + 2.1);
          var lb = label(q[2] + '\n' + q[3].replace(/(.{1,34})(\s|$)/g, '$1\n').trim(), { size: 24, border: '#4fc3d6', depthTest: false, scale: 0.0095 });
          var at = P(outR, yl, 125), to = P(q[1] * Rof(Math.max(0, zt - q[0])), q[0], 180);
          lb.position.copy(at); root.add(lb);
          var ln = new T.Line(new T.BufferGeometry().setFromPoints([P(outR - 1.6, yl, 125), to]), new T.LineBasicMaterial({ color: 0x4fc3d6, depthTest: false, transparent: true, opacity: 0.8 }));
          ln.renderOrder = 9; root.add(ln);
          var dot = new T.Mesh(new T.SphereGeometry(0.12, 10, 8), new T.MeshBasicMaterial({ color: 0x4fc3d6, depthTest: false })); dot.position.copy(to); dot.renderOrder = 9; root.add(dot);
        });
      }
      // gas and coal particles
      st.parts = opts.gas ? gasParticles(o, diag && opts.lean ? diag.circ : null) : null; if (st.parts) root.add(st.parts.points);
      st.coal = opts.coal ? coalParticles(o) : null; if (st.coal) root.add(st.coal.points);
      st.H = { yTop: zt + 6, yBot: -Hh, yS: yS };
      render();
    }
    function css(c) { return 'rgb(' + Math.round(c[0] * 255) + ',' + Math.round(c[1] * 255) + ',' + Math.round(c[2] * 255) + ')'; }
    function cyl(a, b, r, color) {
      var len = a.distanceTo(b), m = new T.Mesh(new T.CylinderGeometry(r, r, len, 12), new T.MeshStandardMaterial({ color: color, metalness: 0.5, roughness: 0.5 }));
      m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), b.clone().sub(a).normalize()); return m;
    }
    // field image: s across (0 centre … 1 wall), depth down (throat top … hearth bottom)
    function fieldTexture(o, view) {
      var g = o.g, W = view.id === 'bur' ? 256 : 160, H = view.id === 'bur' ? 1100 : 420, c = document.createElement('canvas'); c.width = W; c.height = H;
      var x = c.getContext('2d'), img = x.createImageData(W, H), px = img.data, bot = g.zt + g.hH;
      for (var yy = 0; yy < H; yy++) {
        var d = (yy + 0.5) / H * bot;
        for (var xx = 0; xx < W; xx++) {
          var s = (xx + 0.5) / W, p = (yy * W + xx) * 4, col;
          if (d < g.zs) col = [0.09, 0.07, 0.06];
          else if (d > g.zt) { var f = (d - g.zt) / g.hH; col = f < 0.3 ? [0.32, 0.12, 0.04] : [1, 0.42 + 0.2 * f, 0.08]; }
          else col = view.id === 'bur' && api.burden ? api.burden(d, s) : api.colorOf(view, api.sample(view, d, s));
          px[p] = col[0] * 255; px[p + 1] = col[1] * 255; px[p + 2] = col[2] * 255; px[p + 3] = 255;
        }
      }
      x.putImageData(img, 0, 0);
      // isotherms on the face
      var Tf = view.id === 'ts' ? o.Ts : o.Tg;
      x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = 1.2;
      [600, 1000, 1400].forEach(function (Tv) {
        x.beginPath(); var first = true;
        o.R.forEach(function (r, i) { for (var j = 0; j < o.NZ; j++) { var a = Tf[j][i], b = Tf[j + 1][i]; if ((a - Tv) * (b - Tv) <= 0 && a !== b) { var dd = o.z[j] + (o.z[j + 1] - o.z[j]) * (Tv - a) / (b - a); var X = r.sm * W, Yp = dd / bot * H; if (first) { x.moveTo(X, Yp); first = false; } else x.lineTo(X, Yp); return; } } });
        x.stroke();
      });
      // cohesive zone band outline, as in the 2D section
      x.strokeStyle = '#ffffff'; x.lineWidth = 2.5; x.setLineDash([7, 4]);
      ['top', 'bot'].forEach(function (k) { x.beginPath(); var first = true; o.R.forEach(function (r, i) { var c = o.cz[i]; if (c.top == null) return; var dd = k === 'top' ? c.top : (c.bot == null ? g.zt : c.bot); var X = r.sm * W, Yp = dd / bot * H; if (first) { x.moveTo(X, Yp); first = false; } else x.lineTo(X, Yp); }); x.stroke(); });
      x.setLineDash([]);
      var t = new T.CanvasTexture(c); t.minFilter = T.LinearFilter; return t;
    }
    function sectionPlane(o, th, tex) {
      var g = o.g, NS = 24, ND = 90, bot = g.zt + g.hH, pos = [], uv = [], idx = [];
      for (var j = 0; j <= ND; j++) { var d = j / ND * bot, R = (d <= g.zt ? g.r(d) : g.Rh); for (var i = 0; i <= NS; i++) { var s = i / NS, p = P(s * R, g.zt - d, th); pos.push(p.x, p.y, p.z); uv.push(s, 1 - d / bot); } }
      for (j = 0; j < ND; j++) for (var i2 = 0; i2 < NS; i2++) { var a = j * (NS + 1) + i2, b = a + NS + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
      var geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
      var m = new T.Mesh(geo, new T.MeshBasicMaterial({ map: tex, side: T.DoubleSide }));
      m.userData = { kind: 'face', th: th }; return m;
    }
    function slice(o, view, h, phiS, phiL, circ) {
      var g = o.g, d = g.zt - h; if (d < g.zs || d > g.zt) return null;
      var R = g.r(d), NR = 26, NA = 90, pos = [], col = [], idx = [];
      for (var i = 0; i <= NR; i++) for (var k = 0; k <= NA; k++) {
        var s = i / NR, ph = phiS + phiL * k / NA, th = 180 - ph * 180 / Math.PI, p = P(s * R, h, th), v = api.sample(view, d, s);
        if (circ && (view.id === 'tg' || view.id === 'ts')) v += circ.amp * Math.cos((th - circ.dir) * Math.PI / 180) * s * s * (0.4 + 0.6 * (1 - (g.zt - d) / (g.zt - g.zs)));
        var c = view.id === 'bur' && api.burden ? api.burden(d, s) : api.colorOf(view, v); pos.push(p.x, p.y, p.z); col.push(c[0], c[1], c[2]);
      }
      for (i = 0; i < NR; i++) for (k = 0; k < NA; k++) { var a = i * (NA + 1) + k, b = a + NA + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
      var geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new T.Float32BufferAttribute(col, 3)); geo.setIndex(idx);
      var m = new T.Mesh(geo, new T.MeshBasicMaterial({ vertexColors: true, side: T.DoubleSide, transparent: true, opacity: 0.93 }));
      m.userData = { kind: 'slice', d: d }; return m;
    }
    /* gas: each particle keeps its place in the cumulative flow (stream function) and its angle; starts at a tuyere */
    function gasParticles(o, circ) {
      var N = 900, g = o.g, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), P0 = [];
      var cum = o.F.map(function (row) { var c = [0]; for (var i = 0; i < row.length; i++) c.push(c[i] + row[i]); return c; });
      var nT = Math.max(1, Math.round(o.I.nTuy)), um = 0, n = 0; o.U.forEach(function (r) { for (var i = 0; i < r.length; i++) { um += r[i]; n++; } });
      function pickAngle() { for (var t = 0; t < 8; t++) { var a = Math.floor(Math.random() * nT) * 360 / nT + (Math.random() - 0.5) * 360 / nT * 0.6; if (!circ) return a; var w = 1 + Math.min(circ.amp / 40, 0.8) * Math.cos((a - circ.dir) * Math.PI / 180); if (Math.random() * 1.8 < w) return a; } return Math.random() * 360; }
      function spawn(p, any) { p.c = Math.random(); p.d = any ? g.zs + Math.random() * (g.zt - g.zs) : g.zt; p.a = pickAngle(); p.top = 0; return p; }
      for (var i = 0; i < N; i++) P0.push(spawn({}, true));
      var geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('color', new T.BufferAttribute(col, 3));
      var pts = new T.Points(geo, new T.PointsMaterial({ size: 0.16, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false, blending: T.AdditiveBlending }));
      var k = (g.zt - g.zs) / 8 / Math.max(um / n, 1e-3);
      function where(p) {
        var x = cl((p.d - g.zs) / ((g.zt - g.zs) / o.NZ), 0, o.NZ), j = Math.round(x), c = cum[j], i = 0;
        while (i < o.NR - 1 && c[i + 1] < p.c) i++;
        var fr = (p.c - c[i]) / Math.max(c[i + 1] - c[i], 1e-9), r = o.R[i];
        return { s: Math.sqrt(r.s0 * r.s0 + fr * (r.s1 * r.s1 - r.s0 * r.s0)), u: o.U[Math.min(j, o.NZ)][i], T: o.Tg[j][i] };
      }
      var tops = o.tops || [];
      function step(dt) {
        for (var q = 0; q < N; q++) {
          var p = P0[q], v;
          if (p.d >= g.zs) {
            var w = where(p); v = P(w.s * g.r(p.d), g.zt - p.d, p.a);
            var c = api.colorOf({ id: 'tg', lut: 'heat', lo: 0, hi: 2200 }, w.T); col[q * 3] = c[0] * 0.9 + 0.1; col[q * 3 + 1] = c[1] * 0.9 + 0.1; col[q * 3 + 2] = c[2] * 0.9 + 0.1;
            p.d -= w.u * k * dt; p.s = w.s;
          } else {
            // above the burden: rise and turn towards the nearest uptake
            p.top += dt * 0.35; var near = tops.length ? tops.reduce(function (b, t) { var dd = Math.abs(((t.ang - p.a + 540) % 360) - 180); return dd < b.d ? { d: dd, a: t.ang } : b; }, { d: 999, a: p.a }).a : p.a;
            var aa = p.a + (((near - p.a + 540) % 360) - 180) * Math.min(p.top, 1), rr = (p.s || 0.5) * g.Rt * (1 - p.top * 0.3) + g.Rt * 0.72 * p.top * 0.3;
            v = P(rr, g.zt - g.zs + p.top * (g.zs + 2.0), aa);
            col[q * 3] = 0.85; col[q * 3 + 1] = 0.8; col[q * 3 + 2] = 0.75;
            if (p.top > 1.4) spawn(p, false);
          }
          pos[q * 3] = v.x; pos[q * 3 + 1] = v.y; pos[q * 3 + 2] = v.z;
        }
        geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
      }
      step(0);
      return { points: pts, step: step };
    }
    /* coal: every lance the same, a plume from the lance tip into the raceway; dark coal, burning orange, gone at burnout */
    function coalParticles(o) {
      var per = 44, L = st.lances, N = per * L.length, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), A = [];
      var Rh = o.g.Rh, Dr = o.rw.Dr, burn = cl((o.I.burn || 80) / 100, 0.3, 1);
      for (var i = 0; i < N; i++) A.push({ l: i % L.length, t: Math.random(), sp: (Math.random() - 0.5) * 0.5, sv: (Math.random() - 0.5) * 0.4 });
      var geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('color', new T.BufferAttribute(col, 3));
      var pts = new T.Points(geo, new T.PointsMaterial({ size: 0.13, vertexColors: true, transparent: true, depthWrite: false }));
      function step(dt) {
        for (var q = 0; q < N; q++) {
          var p = A[q]; p.t += dt * 0.9; if (p.t > 1) { p.t -= 1; p.sp = (Math.random() - 0.5) * 0.5; p.sv = (Math.random() - 0.5) * 0.4; }
          var ln = L[p.l], r = Rh + 0.35 - p.t * (Dr + 0.6), spread = p.t < 0.35 ? p.t * 0.25 : 0.09 + (p.t - 0.35) * 1.1, v = P(r, 0.02 + p.sv * spread, ln.a + p.sp * spread * 70 / Math.max(r, 0.5));
          pos[q * 3] = v.x; pos[q * 3 + 1] = v.y; pos[q * 3 + 2] = v.z;
          var h = cl(p.t / 0.45, 0, 1), gone = p.t > burn * 1.05 ? 0 : 1;
          col[q * 3] = (0.18 + 0.82 * h) * gone; col[q * 3 + 1] = (0.17 + 0.45 * h) * gone; col[q * 3 + 2] = (0.16 + 0.05 * h) * gone;
        }
        geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
      }
      step(0);
      return { points: pts, step: step };
    }

    /* ---------- camera presets and animation */
    function preset(name) {
      var o = st.o; if (!o) return;
      var g = o.g, yS = g.zt - g.zs, Rb = g.Rb, mid = g.zt / 2, ca = o.czApexH != null ? (o.czApexH + (o.czRootH || 0)) / 2 : g.zt * 0.35;
      var P2 = {
        whole: [new T.Vector3(0, mid - 1, 0), new T.Vector3((g.zt + g.hH + 6) * 0.55, mid + 5, (g.zt + g.hH + 6) * 1.25)],
        top: [new T.Vector3(0, yS, 0), new T.Vector3(Rb * 0.5, yS + Rb * 1.9, Rb * 1.4)],
        shaft: [new T.Vector3(0, (yS + ca) / 2, 0), new T.Vector3(Rb * 1.2, (yS + ca) / 2 + 2, Rb * 2.3)],
        cz: [new T.Vector3(0, ca, 0), P(Rb * 2.3, ca + 6, 150)],
        tuyere: [P(g.Rh - o.rw.Dr / 2, 0, 180), P(g.Rh + 3.5, 2.0, 150)],
        hearth: [new T.Vector3(0, -g.hH * 0.5, 0), P(g.Rh * 3.6, 0.6, 215)]
      }[name] || null;
      if (!P2) return;
      st.tween = { t0: performance.now(), dur: 650, fromT: controls.target.clone(), toT: P2[0], fromP: camera.position.clone(), toP: P2[1] };
      kick();
    }
    function render() { renderer.render(scene, camera); }
    function loop(t) {
      st.anim = 0;
      var dt = st.last ? Math.min((t - st.last) / 1000, 0.05) : 0.016; st.last = t;
      if (st.tween) { var k = cl((t - st.tween.t0) / st.tween.dur, 0, 1), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; controls.target.lerpVectors(st.tween.fromT, st.tween.toT, e); camera.position.lerpVectors(st.tween.fromP, st.tween.toP, e); if (k >= 1) st.tween = null; }
      controls.update();
      if (!reduce) { if (st.parts) st.parts.step(dt); if (st.coal) st.coal.step(dt); }
      render();
      if (st.visible && (!reduce || st.tween)) st.anim = requestAnimationFrame(loop);
    }
    function kick() { if (!st.anim) { st.last = 0; st.anim = requestAnimationFrame(loop); } }
    controls.addEventListener('change', function () { if (reduce) render(); });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { st.visible = es[0].isIntersecting && !document.hidden; if (st.visible) kick(); }).observe(renderer.domElement);
    document.addEventListener('visibilitychange', function () { st.visible = !document.hidden; if (st.visible) kick(); });
    // tap to read a point on a cut face or the slice
    var ray = new T.Raycaster(), down = null;
    renderer.domElement.addEventListener('pointerdown', function (e) { down = [e.clientX, e.clientY]; });
    renderer.domElement.addEventListener('pointerup', function (e) {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6 || !st.o) return;
      var b = renderer.domElement.getBoundingClientRect(), m = new T.Vector2((e.clientX - b.left) / b.width * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
      ray.setFromCamera(m, camera); var hit = ray.intersectObjects(st.planes, false)[0]; if (!hit) return;
      var p = hit.point, g = st.o.g, d = g.zt - p.y, r = Math.hypot(p.x, p.z);
      if (d < g.zs || d > g.zt) return;
      api.onPick && api.onPick({ d: d, s: cl(r / g.r(d), 0, 1), ang: (Math.atan2(p.x, -p.z) * 180 / Math.PI + 360) % 360, x: e.clientX - b.left, y: e.clientY - b.top });
    });
    size();
    window.addEventListener('resize', function () { size(); kick(); });
    return {
      build: function (o, view, diag, opts) { var first = !st.o; size(); build(o, view, diag, opts); if (first) { var g = o.g, D = g.zt + g.hH + 6; controls.target.set(0, g.zt / 2 - 1, 0); camera.position.set(D * 0.55, g.zt / 2 + 5, D * 1.25); } kick(); },
      preset: preset, resize: function () { size(); kick(); },
      snapshot: function () { render(); return renderer.domElement.toDataURL('image/png'); }
    };
  }
  window.BFInside3D = { create: create, ok: function () { try { var c = document.createElement('canvas'); return !!(window.THREE && (c.getContext('webgl') || c.getContext('experimental-webgl'))); } catch (e) { return false; } } };
})();
