/* Other charging modes: COO (coke, oxide 1, oxide 2) and CCO (coke 1, coke 2 at the centre, oxide). Each dump has a
   weight and a ring table (angle, portion = chute revolutions). The figures below use the raw material data entered on
   the earlier pages (burden mix and moisture from Batch chemistry, bulk densities and throat size from the calculator /
   3D distribution). Calculate stores the charge and opens the 3D distribution in sequence mode (simulator.html?seq=1). */
(function () {
  'use strict';
  var KEY = 'bf-charge-modes', SIM = 'bfbm-simulator-v1', MAXR = 18;
  var $ = function (id) { return document.getElementById(id); };
  var NAV = [['index.html', '‹ Home'], ['data-input.html', 'Data input'], ['chemistry.html', 'Batch chemistry'], ['calculator.html', 'Burden calculator'], ['simulator.html', '3D distribution'], ['furnace-inside.html', 'Furnace 3D view'], ['report.html', 'Report'], ['materials.html', 'Fact must know'], ['feedback.html', 'Feedback & suggestion'], ['charging-modes.html', 'Other charging modes']];
  $('nav').innerHTML = NAV.map(function (n) { return '<a href="' + n[0] + '"' + (n[0] === 'charging-modes.html' ? ' class="on" aria-current="page"' : '') + '>' + n[1] + '</a>'; }).join('');

  function rd(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function wr(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function f0(v) { return isFinite(v) ? Math.round(v).toLocaleString('en-IN') : '–'; }
  function fx(v, d) { return isFinite(v) ? v.toFixed(d) : '–'; }

  /* ---------- example tables (as in the plant sheet) */
  var ANG = [11, 18, 21, 23, 25, 28, 32, 34, 36, 37, 39], ANG_O = [12, 17, 21, 23, 25, 28, 32, 34, 36, 37, 38];
  function rows(a, p) { return a.map(function (x, i) { return [x, p[i] || 0]; }); }
  var MODES = {
    COO: { info: 'One coke dump, then two oxide dumps', dumps: [{ name: 'Coke', mat: 'coke' }, { name: 'Oxide 1', mat: 'ore' }, { name: 'Oxide 2', mat: 'ore' }],
      example: { kg: [12000, 23000, 23000], cols: [rows(ANG, [2, 0, 0, 2, 1, 0, 0, 1, 2, 2, 3]), rows(ANG_O, [0, 0, 0, 2, 0, 2, 0, 0, 2, 1, 0]), rows(ANG_O, [0, 0, 0, 2, 0, 2, 0, 0, 2, 1, 0])] } },
    CCO: { info: 'Two coke dumps (the second usually at the centre), then one oxide dump', dumps: [{ name: 'Coke 1', mat: 'coke' }, { name: 'Coke 2', note: 'usually centre', mat: 'coke' }, { name: 'Oxide', mat: 'ore' }],
      example: { kg: [10000, 2000, 45000], cols: [rows(ANG, [2, 0, 0, 2, 1, 0, 0, 1, 2, 2, 3]), rows(ANG_O, [4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0]), rows(ANG_O, [0, 0, 0, 2, 0, 2, 0, 0, 2, 1, 0])] } }
  };
  function example(m) { var e = MODES[m].example; return { kg: e.kg.slice(), cols: e.cols.map(function (c) { return c.map(function (r) { return r.slice(); }); }) }; }

  var saved = rd(KEY) || {}, state = { mode: MODES[saved.mode] ? saved.mode : 'COO' };
  Object.keys(MODES).forEach(function (m) {
    var t = saved[m], ok = t && Array.isArray(t.kg) && Array.isArray(t.cols) && t.cols.length === MODES[m].dumps.length;
    state[m] = ok ? t : example(m);
  });
  function save() { var o = rd(KEY) || {}; o.mode = state.mode; o.COO = state.COO; o.CCO = state.CCO; wr(KEY, o); }

  /* ---------- raw material data from the earlier pages */
  var OP_DEFAULT = { cokeBase: 7000, yardPct: 0, oc: 4.2, sinterPct: 65, pelletPct: 20, cloPct: 10, nut: 500, lime: 0, dolo: 200, pyrox: 0, quartz: 0, mn: 0,
    m_mainCoke: 5, m_yardCoke: 5, m_pellet: 2, m_ore: 3, m_sinter: 0.5, m_lime: 1, m_dolo: 1, m_pyrox: 2, m_quartz: 1, m_clo: 3, m_mn: 2, m_nut: 8 };
  var RHO = { coke: 0.5, sinter: 1.75, pellet: 2.2, ore: 2.3, clo: 2.3, lime: 1.5, dolo: 1.6, pyrox: 1.6, quartz: 1.5, mn: 2.0, nut: 0.5 };
  function material() {
    var st = rd(SIM) || {}, OP = {}, k, linked = false;
    for (k in OP_DEFAULT) OP[k] = OP_DEFAULT[k];
    if (st.OP) for (k in st.OP) if (isFinite(st.OP[k])) OP[k] = +st.OP[k];
    // burden and moisture from Batch chemistry while that link is on (the same switch as on the calculator)
    if (window.BF_SOURCE) { try { BF_SOURCE.simLoaded(OP); linked = localStorage.getItem('bf608-link') !== 'off'; } catch (e) { } }
    var rho = {}; for (k in RHO) rho[k] = st.MAT && st.MAT[k] && st.MAT[k].rho > 0 ? +st.MAT[k].rho : RHO[k];
    var R = st.GEO && st.GEO.R > 0 ? +st.GEO.R : 3.0;
    // ore-side mix of one charge, as the 3D distribution works it out (dry kg for volume, wet kg as charged)
    var tot = OP.cokeBase + OP.nut, wet = function (kg, m) { return kg / (1 - m / 100); };
    var kg = { pellet: OP.pelletPct * OP.oc * tot / 100, ore: Math.max(0, 100 - (OP.sinterPct + OP.pelletPct + OP.cloPct)) * OP.oc * tot / 100,
      sinter: OP.oc * OP.sinterPct * tot / 100, clo: OP.oc * OP.cloPct * tot / 100, lime: OP.lime, dolo: OP.dolo, pyrox: OP.pyrox, quartz: OP.quartz, mn: OP.mn, nut: OP.nut };
    var mo = { pellet: OP.m_pellet, ore: OP.m_ore, sinter: OP.m_sinter, clo: OP.m_clo, lime: 0, dolo: 0, pyrox: 0, quartz: 0, mn: 0, nut: OP.m_nut };
    var dry = 0, wetOre = 0, vol = 0;
    for (k in kg) { dry += kg[k]; wetOre += mo[k] ? wet(kg[k], mo[k]) : kg[k]; vol += kg[k] / 1000 / rho[k]; }
    var oreRho = vol > 0 ? wetOre / 1000 / vol : rho.sinter;        // t of ore side as charged per m³ of layer
    return { OP: OP, rho: rho, R: R, oreRho: oreRho, cokeRho: rho.coke, linked: linked, fromSim: !!st.OP };
  }
  var MT = material();

  /* ---------- page */
  function seqHtml(m) { return MODES[m].dumps.map(function (d) { return '<i class="' + d.mat + '">' + esc(d.name.toUpperCase()) + '</i>'; }).join('<em>›</em>'); }
  $('modes').innerHTML = Object.keys(MODES).map(function (m) {
    return '<button type="button" class="mode" data-m="' + m + '" aria-pressed="' + (m === state.mode) + '"><b>' + m + '</b><span class="seq">' + seqHtml(m) + '</span><span class="s">' + esc(MODES[m].info) + '</span></button>';
  }).join('');
  $('modes').addEventListener('click', function (e) {
    var b = e.target.closest('.mode'); if (!b) return;
    state.mode = b.dataset.m; save(); draw();
  });

  function cur() { return state[state.mode]; }
  function draw() {
    [].forEach.call(document.querySelectorAll('.mode'), function (b) { b.setAttribute('aria-pressed', String(b.dataset.m === state.mode)); });
    var M = MODES[state.mode], t = cur(), n = t.cols[0].length;
    $('tblTitle').textContent = state.mode + ' table';
    var h = '<thead><tr><th class="r"></th>' + M.dumps.map(function (d) {
      return '<th colspan="2" class="d ' + d.mat + '">' + esc(d.name) + (d.note ? '<small>' + esc(d.note) + '</small>' : '') + '</th>'; }).join('') + '</tr>' +
      '<tr class="wt"><th class="r">Weight<small>kg</small></th>' + M.dumps.map(function (d, j) {
        return '<th colspan="2"><input type="number" inputmode="decimal" min="0" step="100" data-w="' + j + '" value="' + (t.kg[j] || '') + '" aria-label="' + esc(d.name) + ' weight in kg"></th>'; }).join('') + '</tr>' +
      '<tr><th class="r">Ring</th>' + M.dumps.map(function () { return '<th>Angle</th><th>Portion</th>'; }).join('') + '</tr></thead><tbody>';
    for (var i = 0; i < n; i++) {
      h += '<tr><td class="r">' + (i + 1) + '</td>' + M.dumps.map(function (d, j) {
        var r = t.cols[j][i] || [0, 0];
        return '<td><input type="number" inputmode="decimal" min="0" max="50" step="0.5" data-j="' + j + '" data-i="' + i + '" data-k="0" value="' + r[0] + '" aria-label="' + esc(d.name) + ' ring ' + (i + 1) + ' angle"></td>' +
          '<td><input class="p" type="number" inputmode="numeric" min="0" max="12" step="1" placeholder=" " data-j="' + j + '" data-i="' + i + '" data-k="1" value="' + (r[1] || '') + '" aria-label="' + esc(d.name) + ' ring ' + (i + 1) + ' portion"></td>';
      }).join('') + '</tr>';
    }
    h += '</tbody><tfoot><tr><td class="r">Σ</td>' + M.dumps.map(function (d, j) { return '<td></td><td id="sum' + j + '"></td>'; }).join('') + '</tr></tfoot>';
    $('rings').innerHTML = h;
    calc();
  }
  $('rings').addEventListener('input', function (e) {
    var el = e.target, t = cur(), v = el.value === '' ? 0 : Number(el.value);
    if (!isFinite(v)) return;
    if (el.dataset.w !== undefined) t.kg[+el.dataset.w] = Math.max(0, v);
    else t.cols[+el.dataset.j][+el.dataset.i][+el.dataset.k] = el.dataset.k === '1' ? Math.max(0, Math.round(v)) : Math.max(0, v);
    save(); calc();
  });
  $('addRing').addEventListener('click', function () {
    var t = cur(); if (t.cols[0].length >= MAXR) return;
    t.cols.forEach(function (c) { var last = c[c.length - 1] || [30, 0]; c.push([Math.min(50, last[0] + 1), 0]); });
    save(); draw();
  });
  $('delRing').addEventListener('click', function () {
    var t = cur(); if (t.cols[0].length <= 1) return;
    t.cols.forEach(function (c) { c.pop(); }); save(); draw();
  });
  $('example').addEventListener('click', function () { state[state.mode] = example(state.mode); save(); draw(); });
  $('clearP').addEventListener('click', function () { cur().cols.forEach(function (c) { c.forEach(function (r) { r[1] = 0; }); }); save(); draw(); });

  /* ---------- figures */
  function figures() {
    var M = MODES[state.mode], t = cur(), A = Math.PI * MT.R * MT.R;
    var dumps = M.dumps.map(function (d, j) {
      var revs = t.cols[j].reduce(function (s, r) { return s + (r[1] || 0); }, 0), kg = t.kg[j] || 0;
      var used = t.cols[j].filter(function (r) { return r[1] > 0; }).map(function (r) { return r[0]; });
      var vol = kg / 1000 / (d.mat === 'coke' ? MT.cokeRho : MT.oreRho);
      var wa = revs ? t.cols[j].reduce(function (s, r) { return s + r[0] * (r[1] || 0); }, 0) / revs : NaN;
      return { name: d.name, mat: d.mat, kg: kg, revs: revs, perRev: revs ? kg / revs : NaN, vol: vol, mm: vol / A * 1000,
        amin: used.length ? Math.min.apply(null, used) : NaN, amax: used.length ? Math.max.apply(null, used) : NaN, wa: wa };
    });
    var n = t.cols[0].length, ring = [];
    for (var i = 0; i < n; i++) {
      var c = 0, o = 0;
      dumps.forEach(function (d, j) { var p = t.cols[j][i][1] || 0; if (!p || !d.revs) return; if (d.mat === 'coke') c += p * d.perRev; else o += p * d.perRev; });
      ring.push({ c: c, o: o });
    }
    var sum = function (m, k) { return dumps.filter(function (d) { return d.mat === m; }).reduce(function (s, d) { return s + d[k]; }, 0); };
    return { dumps: dumps, ring: ring, coke: sum('coke', 'kg'), ore: sum('ore', 'kg'), cmm: sum('coke', 'mm'), omm: sum('ore', 'mm'), vol: sum('coke', 'vol') + sum('ore', 'vol'),
      revs: dumps.reduce(function (s, d) { return s + d.revs; }, 0) };
  }
  function calc() {
    var F = figures();
    F.dumps.forEach(function (d, j) { var el = $('sum' + j); if (el) el.textContent = d.revs; });
    $('resFor').textContent = state.mode;
    $('kpis').innerHTML = [['Coke per charge', f0(F.coke) + ' kg'], ['Oxide per charge', f0(F.ore) + ' kg'], ['O/C (as charged)', fx(F.ore / F.coke, 2)],
      ['Charge volume', fx(F.vol, 1) + ' m³'], ['Coke layer at throat', f0(F.cmm) + ' mm'], ['Oxide layer at throat', f0(F.omm) + ' mm'], ['Chute revolutions', F.revs]]
      .map(function (k) { return '<div><span>' + k[0] + '</span><b>' + k[1] + '</b></div>'; }).join('');
    $('perDump').innerHTML = '<thead><tr><th>Dump</th><th>Weight kg</th><th>Rev</th><th>kg / rev</th><th>Angles °</th><th>Mean α °</th><th>Volume m³</th><th>Layer mm</th></tr></thead><tbody>' +
      F.dumps.map(function (d) {
        return '<tr><td><span class="seq"><i class="' + d.mat + '">' + esc(d.name.toUpperCase()) + '</i></span></td><td>' + f0(d.kg) + '</td><td>' + d.revs + '</td><td>' + f0(d.perRev) + '</td><td>' +
          (isFinite(d.amin) ? d.amin + (d.amax !== d.amin ? '–' + d.amax : '') : '–') + '</td><td>' + fx(d.wa, 1) + '</td><td>' + fx(d.vol, 2) + '</td><td>' + f0(d.mm) + '</td></tr>';
      }).join('') + '</tbody>';
    var mx = Math.max.apply(null, F.ring.map(function (r) { return Math.max(r.c, r.o); }).concat([1]));
    $('perRing').innerHTML = '<thead><tr><th>Ring</th><th>Coke kg</th><th>Oxide kg</th><th>O/C</th><th style="text-align:left">Share</th></tr></thead><tbody>' +
      F.ring.map(function (r, i) {
        return '<tr><td>' + (i + 1) + '</td><td>' + (r.c ? f0(r.c) : '–') + '</td><td>' + (r.o ? f0(r.o) : '–') + '</td><td>' + (r.c && r.o ? fx(r.o / r.c, 2) : r.o ? 'oxide only' : r.c ? 'coke only' : '–') + '</td>' +
          '<td style="text-align:left"><span class="bar" style="width:' + (r.c / mx * 70).toFixed(1) + 'px;background:var(--coke);margin-left:0"></span><span class="bar" style="width:' + (r.o / mx * 70).toFixed(1) + 'px;background:var(--ore);margin-left:2px"></span></td></tr>';
      }).join('') + '</tbody>';
    var o = MT.OP, lump = Math.max(0, 100 - o.sinterPct - o.pelletPct - o.cloPct);
    $('src').innerHTML = 'Raw material data used: coke bulk density ' + fx(MT.cokeRho, 2) + ' t/m³; oxide mix sinter ' + fx(o.sinterPct, 0) + ' %, pellet ' + fx(o.pelletPct, 0) + ' %, CLO ' + fx(o.cloPct, 0) + ' %, lump ore ' + fx(lump, 0) +
      ' % with fluxes and moisture (bulk ' + fx(MT.oreRho, 2) + ' t/m³ as charged); throat Ø ' + fx(MT.R * 2, 2) + ' m. From ' + (MT.linked ? '<a href="chemistry.html#burden">Batch chemistry</a> (burden and moisture) and ' : '') +
      '<a href="calculator.html">Burden calculator</a> / <a href="simulator.html">3D distribution</a> inputs. Ring-wise kg share each dump\'s weight over its revolutions; the 3D distribution adds where each ring lands, the layer shape and O/C by radius.';
  }

  /* ---------- Calculate: check, store the charge, open the 3D distribution */
  $('calc').addEventListener('click', function () {
    var M = MODES[state.mode], t = cur(), errs = [];
    M.dumps.forEach(function (d, j) {
      if (!(t.kg[j] > 0)) errs.push('Enter the weight of ' + d.name + '.');
      if (!t.cols[j].some(function (r) { return r[1] > 0; })) errs.push('Enter at least one portion for ' + d.name + '.');
      t.cols[j].forEach(function (r, i) { if (r[1] > 0 && !(r[0] > 0 && r[0] <= 50)) errs.push(d.name + ', ring ' + (i + 1) + ': angle must be between 0 and 50°.'); });
    });
    $('errs').hidden = !errs.length;
    if (errs.length) { $('errs').innerHTML = '<h2>Check the table</h2><ul>' + errs.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul>'; $('errs').scrollIntoView({ block: 'center' }); return; }
    var o = rd(KEY) || {};
    o.mode = state.mode; o.COO = state.COO; o.CCO = state.CCO;
    o.run = { mode: state.mode, at: Date.now(), dumps: M.dumps.map(function (d, j) {
      return { name: d.name, mat: d.mat, kg: t.kg[j], rings: t.cols[j].map(function (r, i) { return { ring: i + 1, a: r[0], revs: r[1] || 0 }; }) }; }) };
    wr(KEY, o);
    location.href = 'simulator.html?seq=1';
  });

  draw();
})();
