/* Furnace 3D view (module 08): one input page linked to the Burden calculator and Batch chemistry, the inside-model.js run,
   the section view (heat map, isotherms, cohesive zone, moving gas), charts, tables, Excel in/out and calibration. */
(function () {
  'use strict';
  var M = window.BFInside, E = window.BurdenEngine;
  var KEY = 'bf-inside-v1', CALC = 'bfbm-calculator-v1', SNAP = 'bf-calc-snapshot', CHEM = 'sspl_bf_burden_v1', OUT = 'bf-inside-snapshot';
  var $ = function (id) { return document.getElementById(id); };
  var isNum = function (x) { return typeof x === 'number' && isFinite(x); };
  var cl = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  function f(x, d) { return isNum(x) ? x.toFixed(d === undefined ? 0 : d) : '–'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function toast(m) { var t = $('toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(function () { t.classList.remove('show'); }, 3600); }
  function read(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  var KG = 98.0665, ATM = 101.325;

  /* ---------- navigation strip, same as the other pages */
  var NAV = [['index.html', '‹ Home'], ['data-input.html', 'Data input'], ['chemistry.html', 'Batch chemistry'], ['calculator.html', 'Burden calculator'], ['simulator.html', '3D distribution'], ['furnace-inside.html', 'Furnace 3D view'], ['report.html', 'Report'], ['materials.html', 'Fact must know'], ['feedback.html', 'Feedback & suggestion'], ['charging-modes.html', 'Other charging modes']];
  $('nav').innerHTML = NAV.map(function (n) { return '<a href="' + n[0] + '"' + (n[0] === 'furnace-inside.html' ? ' class="on" aria-current="page"' : '') + '>' + n[1] + '</a>'; }).join('');

  /* ---------- rows of the input list */
  var ROWS = {}, ORDER = [];
  M.SECTIONS.forEach(function (s) {
    s.rows.forEach(function (r) {
      if (s.grid) M.MATS.forEach(function (m, i) { var k = m + r[0]; ROWS[k] = { k: k, sec: s, label: s.grid[i] + ' – ' + r[1], unit: r[2], def: r[3][i], min: r[4], max: r[5], step: r[6], pr: r[7], link: r[8] || '', al: r[9] || [], mat: m, base: r[0] }; ORDER.push(k); });
      else { ROWS[r[0]] = { k: r[0], sec: s, label: r[1], unit: r[2], def: r[3], min: r[4], max: r[5], step: r[6], pr: r[7], link: r[8] || '', al: r[9] || [] }; ORDER.push(r[0]); }
    });
  });
  var PSEC = M.SECTIONS.filter(function (s) { return s.dyn; })[0];
  M.DYN.forEach(function (d) { ROWS[d[0]] = { k: d[0], sec: PSEC, label: d[1], unit: d[2], def: null, min: d[3], max: d[4], step: d[2] === 'm' ? 0.01 : 1, pr: 'O', link: '', al: [], dyn: true }; ORDER.push(d[0]); });
  var ST = read(KEY) || {}; ST.v = ST.v || {}; ST.man = ST.man || {};
  function save() { write(KEY, ST); }

  /* ---------- values from the other pages */
  function revive(txt) { return JSON.parse(txt, function (k, v) { if (v && typeof v === 'object' && typeof v.__d === 'string') { var p = v.__d.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); } return v; }); }
  function chemState() {
    var st = null;
    try { var t = localStorage.getItem(CHEM); if (t) st = revive(t); } catch (e) { }
    var fresh = !st || st.version !== 1;
    if (fresh) st = E.defaultState();
    if (fresh || !st.lab || (!st.lab.bf && !st.lab.importedOn)) st.lab = window.SEED_LAB ? E.migrateLab(revive(JSON.stringify(window.SEED_LAB))) : E.emptyLab();
    st.lab = E.migrateLab(st.lab);
    if (!st.charge) st.charge = E.chargeDefault();
    st.params = Object.assign({}, E.PARAMS_DEFAULT, st.params);
    st.matSource = st.matSource || {}; st.manual = st.manual || {};
    var md = (st.importOpt || {}).mode;
    st.importOpt = { mode: md === 'LAST 2' || md === 'LAST N' ? 'LAST 2' : 'LATEST', staleDays: 3 };
    return st;
  }
  var APP = { v: {}, src: {}, calc: null, info: {} };
  function appData() {
    var v = {}, src = {}, info = {};
    function put(k, x, s) { if (isNum(x)) { v[k] = +(+x).toFixed(4); src[k] = s; } }
    var IN = read(CALC), snap = read(SNAP);
    if (IN && IN.f) {
      var F = IN.f;
      ['throatD', 'throatH', 'shaftH', 'bellyD', 'bellyH', 'boshH', 'hearthD', 'stock', 'BV', 'O2', 'TP', 'BP', 'Ttop', 'sinterPct', 'pelletPct'].forEach(function (k) { put(k, F[k], 'calc'); });
      if (isNum(F.sinterPct) && isNum(F.pelletPct)) put('lumpPct', Math.max(0, 100 - F.sinterPct - F.pelletPct), 'calc');
      var mps = IN.mps || {}, y = isNum(F.yardPct) ? F.yardPct / 100 : 0;
      if (isNum(mps.mainCoke)) put('dC', isNum(mps.yardCoke) ? mps.mainCoke * (1 - y) + mps.yardCoke * y : mps.mainCoke, 'calc');
      put('dS', mps.sinter, 'calc'); put('dP', mps.pellet, 'calc');
      var lo = [mps.ore, mps.clo].filter(isNum); if (lo.length) put('dL', lo.reduce(function (a, b) { return a + b; }, 0) / lo.length, 'calc');
      var mo = IN.moist || {}, pr = IN.props || {};
      put('cokeM', mo.mainCoke, 'calc');
      var sh = [[F.sinterPct, 'sinter'], [F.pelletPct, 'pellet'], [Math.max(0, 100 - (F.sinterPct || 0) - (F.pelletPct || 0)), 'ore']], tw = 0, m1 = 0, r1 = 0;
      sh.forEach(function (s) { var w = +s[0] || 0; tw += w; m1 += w * (+mo[s[1]] || 0); r1 += w * (+((pr[s[1]] || [])[0]) || 0); });
      if (tw > 0) { put('oreM', m1 / tw, 'calc'); if (r1 > 0) put('bdO', r1 / tw * 1000, 'calc'); }
      if (pr.coke && isNum(pr.coke[0])) put('bdC', pr.coke[0] * 1000, 'calc');
    }
    if (snap && snap.zones && snap.zones.length === 3) {
      var oc = function (z) { return z.oc === 'ore' ? 12 : z.oc; };
      put('ocC', oc(snap.zones[0]), 'calc'); put('ocI', oc(snap.zones[1]), 'calc'); put('ocW', oc(snap.zones[2]), 'calc');
      info.calcAt = snap.at; info.rings = snap.radial && snap.radial.mid ? snap.radial.mid.length : 0;
    }
    try {
      var S = chemState(); if (S.charge && S.charge.on) E.applyCharge(S);
      var rv = E.review(S), R = E.burden(S, rv), P = Object.assign({}, E.PARAMS_DEFAULT, S.params), I = E.IDX, q = S.qty;
      put('coke', R.cokeDry, 'chem'); put('nut', R.ncDry, 'chem'); put('pci', R.coal, 'chem');
      put('prod', R.prodCharges > 0 ? R.prodCharges : R.prodO2, 'chem'); put('fe', R.avgFe, 'chem'); put('slag', R.slagRate, 'chem');
      put('si', P.si, 'chem'); put('hmC', P.hmC, 'chem'); put('W', P.blastMoist, 'chem'); put('O2pur', P.o2Purity, 'chem');
      var fl = (+q[I.LIMESTONE] || 0) + (+q[I.DOLO] || 0); if (R.hm > 0) put('flux', fl / R.hm * 1000, 'chem');
      info.chemFresh = !(S.lab.uploads || []).length;
    } catch (e) { info.chemErr = e.message; }
    APP = { v: v, src: src, calc: snap, info: info };
  }
  function linked(k) { var r = ROWS[k]; return r.link && !ST.man[k] && isNum(APP.v[k]); }
  function val(k) {
    if (linked(k)) return APP.v[k];
    var x = ST.v[k];
    if (x === null) return null;
    return x === undefined ? ROWS[k].def : x;
  }
  function inputs() { var o = {}; ORDER.forEach(function (k) { var x = val(k); o[k] = x == null ? null : x; }); return o; }

  /* ---------- the input page */
  function chipOf(k) {
    var r = ROWS[k]; if (!r.link) return '';
    var on = linked(k), has = isNum(APP.v[k]);
    if (!has) return '';
    var c = on ? r.link : 'man', t = on ? r.link : has ? 'typed' : 'no link';
    var src = { calc: 'the Burden calculator', chem: 'Batch chemistry', pci: 'the PCI raceway model' }[r.link];
    return '<button type="button" class="chip ' + c + '" data-chip="' + k + '" title="' + (on ? 'Taken from ' + src + '. Type a value to override.' : 'Your own value. Tap to take ' + f(APP.v[k], 1) + ' from ' + src) + '">' + t + '</button>';
  }
  function field(k) {
    var r = ROWS[k], x = val(k);
    return '<div class="f' + (r.pr !== 'E' ? ' opt' : '') + '"><label class="lb" for="in_' + k + '"><span>' + esc(r.label) + '</span><i>' + esc(r.unit) + '</i></label><div class="row">' +
      '<input id="in_' + k + '" data-k="' + k + '" type="number" inputmode="decimal" step="' + r.step + '" min="' + r.min + '" max="' + r.max + '" value="' + (x == null ? '' : +(+x).toFixed(4)) + '"' + (r.pr !== 'E' && x == null ? ' placeholder="optional"' : '') + '>' + chipOf(k) + '</div></div>';
  }
  function buildInputs() {
    var h = [], open = read('bf-inside-open') || { geo: 1, blast: 1 };
    M.SECTIONS.forEach(function (s) {
      var keys = ORDER.filter(function (k) { return ROWS[k].sec === s; }), nl = keys.filter(linked).length, nShow = keys.filter(function (k) { return !ROWS[k].dyn; }).length;
      h.push('<details class="sec" data-sec="' + s.id + '"' + (open[s.id] ? ' open' : '') + '><summary><span class="k">' + s.n + '</span><h2>' + esc(s.title) + '</h2><span class="cnt">' + nShow + (nl ? ' · ' + nl + ' linked' : '') + '</span></summary><div class="body"><p class="hint">' + esc(s.note) + '</p>');
      if (s.grid) {
        h.push('<div class="tw"><table class="grid3"><thead><tr><th>Property</th>' + s.grid.map(function (g) { return '<th>' + g + '</th>'; }).join('') + '<th>Unit</th></tr></thead><tbody>');
        s.rows.forEach(function (r) {
          h.push('<tr><td>' + esc(r[1]) + '</td>' + M.MATS.map(function (m, i) { var k = m + r[0], x = val(k); return '<td><input id="in_' + k + '" data-k="' + k + '" type="number" inputmode="decimal" step="' + r[6] + '" value="' + (x == null ? '' : x) + '" aria-label="' + esc(s.grid[i] + ' ' + r[1]) + '"></td>'; }).join('') + '<td class="hint">' + esc(r[2]) + '</td></tr>');
        });
        h.push('</tbody></table></div>');
      } else if (s.dyn) {
        h.push('<div class="fields">' + keys.filter(function (k) { return !ROWS[k].dyn; }).map(field).join('') + '</div>');
        var I0 = inputs(), n = Math.round(cl(+val('prN') || 5, 1, M.PRMAX)), m = Math.round(cl(+val('peN') || 8, 1, M.PEMAX));
        var cell = function (k, ph) { var x = val(k); return '<td><input id="in_' + k + '" data-k="' + k + '" type="number" inputmode="decimal" step="' + ROWS[k].step + '" value="' + (x == null ? '' : x) + '"' + (ph != null ? ' placeholder="' + ph + '"' : '') + ' aria-label="' + esc(ROWS[k].label) + '"></td>'; };
        h.push('<h3 class="sub2">Burden probe, ' + n + ' points per arm · left arm ' + f(+val('prAng') || 0) + '°, right arm ' + f(((+val('prAng') || 0) + 180) % 360) + '°</h3>');
        h.push('<div class="tw"><table class="dyn"><thead><tr><th>Point</th><th>From centre m</th><th>TL left °C</th><th>TR right °C</th></tr></thead><tbody>');
        for (var i = 1; i <= n; i++) h.push('<tr><td>' + i + (i === 1 ? ' centre' : i === n ? ' wall' : '') + '</td>' + cell('prd' + i, f(M.probeDist(Object.assign({}, I0, { ['prd' + i]: null }), i), 2)) + cell('tl' + i) + cell('tr' + i) + '</tr>');
        h.push('</tbody></table></div><p class="hint">Distances are filled with equal steps from the centre; type your own if your probe is different.</p>');
        h.push('<h3 class="sub2">Periphery, ' + m + ' points</h3><div class="tw"><table class="dyn"><thead><tr><th>Point</th><th>Angle °</th><th>Temperature °C</th></tr></thead><tbody>');
        for (var j = 1; j <= m; j++) h.push('<tr><td>T' + j + '</td>' + cell('ta' + j, f(M.periAngle(Object.assign({}, I0, { ['ta' + j]: null }), j))) + cell('t' + j) + '</tr>');
        h.push('</tbody></table></div><p class="hint">Angles are spaced evenly from the angle of T1; type your own for an uneven layout.</p>');
      } else h.push('<div class="fields">' + keys.map(field).join('') + '</div>');
      h.push('</div></details>');
    });
    var host = $('ins'), lg = host.querySelector('.legend').outerHTML;
    host.innerHTML = lg + h.join('');
    host.querySelectorAll('details.sec').forEach(function (d) { d.addEventListener('toggle', function () { var o = read('bf-inside-open') || {}; o[d.getAttribute('data-sec')] = d.open ? 1 : 0; write('bf-inside-open', o); }); });
  }
  $('ins').addEventListener('change', function (e) {
    var k = e.target.getAttribute('data-k'); if (!k) return;
    var r = ROWS[k], t = e.target.value.trim(), x = t === '' ? null : Number(t);
    if (x != null && !isFinite(x)) { e.target.classList.add('bad'); return; }
    e.target.classList.toggle('bad', x != null && (x < r.min || x > r.max));
    ST.v[k] = x; if (r.link) ST.man[k] = true; save();
    var c = document.querySelector('[data-chip="' + k + '"]'); if (c) c.outerHTML = chipOf(k);
    if (['prN', 'peN', 'prAng', 'peAng', 'prGap', 'throatD'].indexOf(k) >= 0) buildInputs();
    schedule();
  });
  $('ins').addEventListener('click', function (e) {
    var c = e.target.closest('[data-chip]'); if (!c) return;
    var k = c.getAttribute('data-chip');
    if (!isNum(APP.v[k])) { toast('Nothing to link: fill this on the ' + (ROWS[k].link === 'calc' ? 'Burden calculator' : 'Batch chemistry') + ' page first'); return; }
    if (ST.man[k]) { delete ST.man[k]; save(); $('in_' + k).value = +APP.v[k].toFixed(4); c.outerHTML = chipOf(k); schedule(); toast(ROWS[k].label + ' linked again'); }
    else toast('Type a value to override the linked one');
  });
  function srcLine() {
    var i = APP.info, d = i.calcAt ? new Date(i.calcAt) : null;
    $('srcLine').innerHTML = '<span><b>Calculator:</b> ' + (d ? 'last calculated ' + d.toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) + (i.rings ? ', ' + i.rings + ' rings' : '') : 'not calculated yet, zone O/C used') + '</span>' +
      '<span><b>Batch chemistry:</b> ' + (i.chemErr ? 'not readable' : i.chemFresh ? 'example lab values' : 'your lab data') + '</span>';
  }

  /* ---------- run */
  var O = null, timer = 0;
  function schedule() { clearTimeout(timer); timer = setTimeout(calc, 450); }
  var PC = null;
  function calc() {
    var I = inputs(), t0 = performance.now();
    try {
      if (window.BFPci) {
        var rw0 = M.raceway(Object.assign(M.defaults(), I, { tCoke: 1500 }), M.geometry(Object.assign(M.defaults(), I)));
        PC = BFPci.run(Object.assign(M.defaults(), I), rw0);
        APP.v.burn = +PC.burn.toFixed(1); APP.src.burn = 'pci';
        if (!ST.man.burn) { I.burn = APP.v.burn; var bi = $('in_burn'); if (bi && document.activeElement !== bi) { bi.value = APP.v.burn; var ch = document.querySelector('[data-chip="burn"]'); if (ch) ch.outerHTML = chipOf('burn'); else bi.insertAdjacentHTML('afterend', chipOf('burn')); } }
      }
      BS = burdenSource(); O = M.run(I, I.useCalc && BS ? BS : null); BMAP = BS ? buildBurden(O, BS) : null; burdenInfo();
    }
    catch (e) { toast('Could not calculate: ' + e.message); return; }
    O.ms = performance.now() - t0;
    renderAll();
    saveSnapshot();
  }
  function saveSnapshot() {
    if (!O) return;
    write(OUT, { at: Date.now(), raft: O.rw.raft, bosh: O.rw.bosh, bgi: O.rw.BGI, vT: O.rw.vT, KE: O.rw.KE, Dr: O.rw.Dr, etaCO: O.mb.etaCO, etaH: O.mb.etaH, rd: O.mb.rd,
      czApex: O.czApexH, czRoot: O.czRootH, czThick: O.czThick, czShape: O.czShape, topMix: O.topMix, hmt: O.hmt, dP: [O.dPpred, O.dPmeas],
      zones: O.zonesTop.map(function (z) { return [z.name, z.pct]; }), levels: O.levels.map(function (l) { return { name: l.name, h: l.h, gas: l.zones.map(function (z) { return z.gas; }), solid: l.zones.map(function (z) { return z.solid; }) }; }),
      outputs: O.outputs, alerts: O.alerts });
  }

  /* ---------- the burden in the furnace: C-O from the Burden calculator, COO / CCO from Other charging modes */
  var BS = null, BMAP = null, BSEL = read('bf-inside-burden') || 'auto';
  function edgesFromMid(mid, R) { var e = [0]; for (var i = 0; i < mid.length - 1; i++) e.push((mid[i] + mid[i + 1]) / 2); e.push(R); return e; }
  function fromCalc(cs) {
    return { mode: 'C-O', at: cs.at, R: cs.R, f: cs.f, radial: cs.radial, edges: edgesFromMid(cs.radial.mid, cs.R), surf: null, from: 'Burden calculator',
      layers: [{ mat: 'coke', mm: cs.radial.cmm, name: 'Coke' }, { mat: 'ore', mm: cs.radial.omm, name: 'Metallics' }] };
  }
  function fromSim(sm, cs) {
    var n = sm.edges.length - 1, mid = [], cmm = [], omm = [];
    for (var i = 0; i < n; i++) { mid.push((sm.edges[i] + sm.edges[i + 1]) / 2); var c = 0, o2 = 0; sm.layers.forEach(function (l) { if (l.mat === 'coke') c += l.mm[i]; else o2 += l.mm[i]; }); cmm.push(c); omm.push(o2); }
    var ck = sm.kg ? sm.kg.filter(function (k, j) { return sm.layers[j] && sm.layers[j].mat === 'coke'; }).reduce(function (a, b) { return a + b; }, 0) : null;
    return { mode: sm.mode, at: sm.at, R: sm.R, f: Object.assign({}, cs && cs.f, ck ? { cokeBase: ck } : {}), radial: { mid: mid, cmm: cmm, omm: omm }, edges: sm.edges, surf: sm.surf, from: 'Other charging modes',
      layers: sm.layers.map(function (l, j) { return { mat: l.mat, mm: l.mm, name: (sm.names || [])[j] || (l.mat === 'coke' ? 'Coke' : 'Oxide') }; }) };
  }
  function burdenSources() {
    var out = {}, cs = APP.calc;
    if (cs && cs.radial && cs.radial.mid) out['C-O'] = fromCalc(cs);
    ['COO', 'CCO'].forEach(function (m) { var sm = read('bf-sim-layers-' + m); if (sm && sm.edges && sm.layers) out[m] = fromSim(sm, cs); });
    return out;
  }
  function burdenSource() {
    var all = burdenSources(), pick = BSEL;
    if (pick === 'auto') { var run = (read('bf-charge-modes') || {}).run, best = null; Object.keys(all).forEach(function (k) { if (!best || (all[k].at || 0) > (all[best].at || 0)) best = k; }); pick = best; if (run && all[run.mode] && run.at > ((all['C-O'] || {}).at || 0)) pick = run.mode; }
    burdenSource.missing = pick && !all[pick] ? pick : null;
    return pick ? all[pick] || null : null;
  }
  function burdenInfo() {
    var el = $('bInfo'); if (!el) return;
    if (burdenSource.missing) { el.innerHTML = burdenSource.missing + ' has not been charged yet: set it on <a href="charging-modes.html">Other charging modes</a> and let one charge finish in <a href="simulator.html?seq=1">3D distribution</a>. The view uses the zone O/C until then.'; return; }
    if (!BS) { el.textContent = 'No charge calculated yet: calculate the Burden calculator once. The view uses the zone O/C until then.'; return; }
    var d = new Date(BS.at || Date.now());
    el.textContent = BS.mode + ' from ' + BS.from + ' · ' + BS.layers.map(function (l) { return l.name; }).join(' ↓ ') + ' ↓ · ' + (BS.edges.length - 1) + ' rings · ' + d.toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
  // layers carried down from the stockline: each layer's throat thickness grows as the furnace widens (plug flow)
  function buildBurden(o, src) {
    var g = o.g, R0 = g.r(g.zs), n = src.edges.length - 1, rings = [];
    for (var i = 0; i < n; i++) {
      var st = [], mt = [], d = g.zs + (src.surf ? src.surf[i] || 0 : 0), k = 0, nl = src.layers.length, guard = 0;
      while (d < g.zt && guard++ < 4000) { var L = src.layers[k % nl], t = (+L.mm[i] || 0) / 1000; if (t > 0.002) { var t2 = t * Math.pow(R0 / g.r(d), 2); st.push(d); mt.push(k % nl); d += t2; } k++; if (k > nl * 400) break; }
      st.push(1e9); rings.push({ s0: src.edges[i] / src.R, s1: src.edges[i + 1] / src.R, st: st, mt: mt });
    }
    return { rings: rings, layers: src.layers };
  }
  var BCOL = { coke: [[0.15, 0.17, 0.23], [0.24, 0.27, 0.36]], ore: [[0.60, 0.29, 0.13], [0.70, 0.40, 0.17], [0.55, 0.24, 0.16]] };
  function hash(a, b) { var h = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return h - Math.floor(h); }
  function burdenColor(d, s) {
    var o = O, bp = o.bp; if (!BMAP) return [0.3, 0.3, 0.3];
    var R = BMAP.rings, i = 0; while (i < R.length - 1 && s > R[i].s1) i++;
    var r = R[i], lo = 0, hi = r.st.length - 1; if (d < r.st[0]) return [0.09, 0.07, 0.06];
    while (hi - lo > 1) { var m = (lo + hi) >> 1; if (r.st[m] <= d) lo = m; else hi = m; }
    var li = r.mt[lo], L = BMAP.layers[li], cokeIdx = 0, oreIdx = 0;
    for (var q = 0; q < li; q++) { if (BMAP.layers[q].mat === 'coke') cokeIdx++; else oreIdx++; }
    var T = fieldAt(o.Ts, o, d, s), c;
    var ore = L.mat !== 'coke';
    if (ore && T >= bp.tme) { ore = false; }
    c = ore ? BCOL.ore[oreIdx % 3].slice() : BCOL.coke[cokeIdx % 2].slice();
    var gr = 0.9 + 0.2 * hash(Math.floor(d * 60), Math.floor(s * 90));
    c = c.map(function (v) { return v * gr; });
    if (ore && T > bp.tss) { var f2 = smooth((T - bp.tss) / Math.max(bp.tme - bp.tss, 10)); c = [c[0] + (1 - c[0]) * f2 * 0.85, c[1] + (0.62 - c[1]) * f2 * 0.85, c[2] + (0.18 - c[2]) * f2 * 0.6]; }
    if (L.mat !== 'coke' && !ore && hash(Math.floor(d * 40), Math.floor(s * 70)) > 0.86) return [1, 0.6, 0.16];
    var gl = smooth((T - 650) / 1100), hc = LUT.heat, k3 = Math.round(cl(T / 2200, 0, 1) * 255) * 3;
    return [c[0] + (hc[k3] / 255 - c[0]) * gl * 0.45, c[1] + (hc[k3 + 1] / 255 - c[1]) * gl * 0.45, c[2] + (hc[k3 + 2] / 255 - c[2]) * gl * 0.45];
  }
  function smooth(x) { x = cl(x, 0, 1); return x * x * (3 - 2 * x); }
  function burdenKey(s2, sw) {
    var items = BMAP ? BMAP.layers.map(function (l, j) { var ci = 0, oi = 0; for (var q = 0; q < j; q++) { if (BMAP.layers[q].mat === 'coke') ci++; else oi++; } return [l.name, l.mat === 'coke' ? BCOL.coke[ci % 2] : BCOL.ore[oi % 3]]; }) : [];
    items.push(['Softening / melting', [1, 0.62, 0.18]], ['Dripping metal', [1, 0.6, 0.16]]);
    s2.clearRect(0, 0, sw, 12);
    var w = sw / items.length; items.forEach(function (it, i) { s2.fillStyle = 'rgb(' + it[1].map(function (v) { return Math.round(v * 255); }).join(',') + ')'; s2.fillRect(i * w, 0, w - 2, 12); });
    $('scLo').textContent = items.map(function (it) { return it[0]; }).join(' · '); $('scHi').textContent = BS ? BS.mode : '';
  }
  if ($('bSrc')) { $('bSrc').value = BSEL; $('bSrc').addEventListener('change', function () { BSEL = this.value; write('bf-inside-burden', BSEL); calc(); }); }

  /* ---------- colour maps */
  var INFERNO = ['#000004', '#1b0c41', '#4a0c6b', '#781c6d', '#a52c60', '#cf4446', '#ed6925', '#fb9b06', '#f7d13d', '#fcffa4'];
  var VIRIDIS = ['#440154', '#482878', '#3e4a89', '#31688e', '#26828e', '#1f9e89', '#35b779', '#6ece58', '#b5de2b', '#fde725'];
  function hex(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function lut(stops) { var c = stops.map(hex), o = new Uint8ClampedArray(256 * 3); for (var i = 0; i < 256; i++) { var x = i / 255 * (c.length - 1), k = Math.min(Math.floor(x), c.length - 2), t = x - k; for (var q = 0; q < 3; q++) o[i * 3 + q] = c[k][q] + (c[k + 1][q] - c[k][q]) * t; } return o; }
  var LUT = { heat: lut(INFERNO), vir: lut(VIRIDIS) };
  var VIEWS = [
    { id: 'tg', name: 'Gas temperature', unit: '°C', lut: 'heat', lo: 0, hi: 2200, get: function (o) { return o.Tg; } },
    { id: 'ts', name: 'Burden temperature', unit: '°C', lut: 'heat', lo: 0, hi: 2200, get: function (o) { return o.Ts; } },
    { id: 'u', name: 'Gas velocity', unit: 'm/s', lut: 'vir', lo: 0, hi: null, get: function (o) { return o.U; } },
    { id: 'eta', name: 'CO utilisation', unit: '%', lut: 'vir', lo: 0, hi: 60, get: function (o) { return o.ETA; } },
    { id: 'red', name: 'Reduction degree', unit: '%', lut: 'vir', lo: 0, hi: 100, get: function (o) { return o.RED; } },
    { id: 'bur', name: 'Burden layers', unit: '', lut: 'heat', lo: 0, hi: 2200, get: function (o) { return o.Ts; } },
    { id: 'p', name: 'Pressure', unit: 'kg/cm² g', lut: 'heat', lo: null, hi: null, get: function (o) { return o.P.map(function (p) { var g = (p - ATM) / KG; var row = new Float64Array(o.NR); row.fill(g); return row; }); } }];
  var vSaved = read('bf-inside-view'), view = VIEWS[vSaved == null ? 5 : vSaved] || VIEWS[0];
  $('views').innerHTML = VIEWS.map(function (v, i) { return '<button type="button" data-v="' + i + '"' + (v === view ? ' class="on" aria-pressed="true"' : ' aria-pressed="false"') + '>' + v.name + '</button>'; }).join('');
  $('views').addEventListener('click', function (e) { var b = e.target.closest('[data-v]'); if (!b) return; view = VIEWS[+b.getAttribute('data-v')]; write('bf-inside-view', +b.getAttribute('data-v')); $('views').querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }); drawSection(); draw3d(); });
  ['oIso', 'oCz', 'oGas'].forEach(function (id) { $(id).addEventListener('change', drawSection); });

  /* ---------- section view */
  var cv = $('cv'), ctx = cv.getContext('2d'), BASE = document.createElement('canvas'), GEO = null, PARTS = [], anim = 0, visible = true;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function fieldAt(field, o, d, s) {          // value at depth d and relative radius s (0 centre … 1 wall)
    var x = cl((d - o.g.zs) / ((o.g.zt - o.g.zs) / o.NZ), 0, o.NZ), j = Math.min(Math.floor(x), o.NZ - 1), t = x - j;
    var R = o.R, n = R.length, i = 0;
    if (s <= R[0].sm) return lerp(0, 0); if (s >= R[n - 1].sm) return lerp(n - 1, n - 1);
    while (i < n - 2 && R[i + 1].sm < s) i++;
    return lerp(i, i + 1);
    function lerp(a, b) { var w = b === a ? 0 : (s - R[a].sm) / (R[b].sm - R[a].sm); var va = field[j][a] * (1 - t) + field[j + 1][a] * t, vb = field[j][b] * (1 - t) + field[j + 1][b] * t; return va + (vb - va) * w; }
  }
  function rangeOf(v, F) {
    if (v.lo != null && v.hi != null) return [v.lo, v.hi];
    var lo = Infinity, hi = -Infinity; F.forEach(function (r) { for (var i = 0; i < r.length; i++) { if (r[i] < lo) lo = r[i]; if (r[i] > hi) hi = r[i]; } });
    if (v.lo != null) lo = v.lo; return [lo, hi > lo ? hi : lo + 1];
  }
  function layout() {
    var o = O, g = o.g, W = Math.max(280, cv.parentNode.clientWidth), top = 0, bot = g.zt + g.hH;
    var H = Math.round(Math.min(Math.max(W * 1.15, 440), 820)), m = { l: 8, r: 64, t: 10, b: 10 };
    var Rmax = Math.max(g.Rt, g.Rb, g.Rh) + 0.45;
    var sc = Math.min((H - m.t - m.b) / (bot - top), (W - m.l - m.r) / (2 * Rmax));
    var cx = m.l + (W - m.l - m.r) / 2;
    H = Math.round((bot - top) * sc + m.t + m.b);
    return { W: W, H: H, sc: sc, cx: cx, X: function (r) { return cx + r * sc; }, Y: function (d) { return m.t + d * sc; }, D: function (y) { return (y - m.t) / sc; }, bot: bot, m: m };
  }
  function drawBase() {
    var o = O, g = o.g, L = GEO = layout(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(L.W * dpr); cv.height = Math.round(L.H * dpr); cv.style.height = L.H + 'px';
    BASE.width = cv.width; BASE.height = cv.height;
    var b = BASE.getContext('2d'); b.setTransform(dpr, 0, 0, dpr, 0, 0); b.clearRect(0, 0, L.W, L.H);
    var F = view.get(o), rg = rangeOf(view, F), lu = LUT[view.lut];
    // heat map at reduced resolution, then scaled up smoothly
    var step = 2, iw = Math.ceil(L.W / step), ih = Math.ceil(L.H / step), img = new ImageData(iw, ih), px = img.data;
    for (var yy = 0; yy < ih; yy++) {
      var d = L.D(yy * step + step / 2);
      if (d < g.zs || d > g.zt) continue;
      var Rr = g.r(d);
      for (var xx = 0; xx < iw; xx++) {
        var r = Math.abs((xx * step + step / 2 - L.cx) / L.sc); if (r > Rr) continue;
        var p = (yy * iw + xx) * 4;
        if (view.id === 'bur') { var bc = burdenColor(d, r / Rr); px[p] = bc[0] * 255; px[p + 1] = bc[1] * 255; px[p + 2] = bc[2] * 255; px[p + 3] = 255; continue; }
        var v = fieldAt(F, o, d, r / Rr), k = Math.round(cl((v - rg[0]) / (rg[1] - rg[0]), 0, 1) * 255) * 3;
        px[p] = lu[k]; px[p + 1] = lu[k + 1]; px[p + 2] = lu[k + 2]; px[p + 3] = 255;
      }
    }
    var tmp = document.createElement('canvas'); tmp.width = iw; tmp.height = ih; tmp.getContext('2d').putImageData(img, 0, 0);
    b.imageSmoothingEnabled = true; b.drawImage(tmp, 0, 0, L.W, L.H);
    // free space above the stockline and the hearth below the tuyeres
    b.fillStyle = '#16120f'; profile(b, 0, g.zs); b.fill();
    var gh = b.createLinearGradient(0, L.Y(g.zt), 0, L.Y(L.bot)); gh.addColorStop(0, '#7a1d06'); gh.addColorStop(0.45, '#c2410c'); gh.addColorStop(1, '#ff7a1a');
    b.fillStyle = gh; b.beginPath(); b.rect(L.X(-g.Rh), L.Y(g.zt), 2 * g.Rh * L.sc, g.hH * L.sc); b.fill();
    b.fillStyle = 'rgba(20,10,6,.55)'; b.beginPath(); b.rect(L.X(-g.Rh), L.Y(g.zt), 2 * g.Rh * L.sc, g.hH * 0.45 * L.sc); b.fill();   // slag layer
    b.fillStyle = '#ffd9a8'; b.font = '600 11px "IBM Plex Sans", sans-serif'; b.textAlign = 'center';
    b.fillText('slag', L.cx, L.Y(g.zt + g.hH * 0.27)); b.fillText('hot metal', L.cx, L.Y(g.zt + g.hH * 0.75));
    // lining and shell
    b.strokeStyle = '#4a4f57'; b.lineWidth = Math.max(3, 0.35 * L.sc); b.lineJoin = 'round';
    [-1, 1].forEach(function (sd) { b.beginPath(); for (var dd = 0; dd <= L.bot + 1e-6; dd += 0.1) { var rr = (dd <= g.zt ? g.r(dd) : g.Rh) + 0.18; var X = L.X(sd * rr), Y = L.Y(dd); if (dd === 0) b.moveTo(X, Y); else b.lineTo(X, Y); } b.stroke(); });
    b.beginPath(); b.moveTo(L.X(-g.Rh - 0.18), L.Y(L.bot)); b.lineTo(L.X(g.Rh + 0.18), L.Y(L.bot)); b.stroke();
    // stockline
    b.strokeStyle = 'rgba(255,255,255,.55)'; b.lineWidth = 1; b.setLineDash([5, 4]); b.beginPath(); b.moveTo(L.X(-g.r(g.zs)), L.Y(g.zs)); b.lineTo(L.X(g.r(g.zs)), L.Y(g.zs)); b.stroke(); b.setLineDash([]);
    // raceways and tuyeres, deadman
    var Rh = g.r(g.zt), dr = o.rw.Dr;
    [-1, 1].forEach(function (sd) {
      var rad = b.createRadialGradient(L.X(sd * (Rh - dr * 0.45)), L.Y(g.zt - 0.05), 2, L.X(sd * (Rh - dr * 0.45)), L.Y(g.zt - 0.05), dr * 0.6 * L.sc);
      rad.addColorStop(0, '#fffbe6'); rad.addColorStop(0.5, '#ffd34d'); rad.addColorStop(1, 'rgba(255,140,0,0)');
      b.fillStyle = rad; b.beginPath(); b.ellipse(L.X(sd * (Rh - dr / 2)), L.Y(g.zt - 0.05), dr / 2 * L.sc, Math.max(0.28 * L.sc, 5), 0, 0, 2 * Math.PI); b.fill();
      b.fillStyle = '#9aa3ad'; b.fillRect(sd > 0 ? L.X(Rh) : L.X(-Rh) - 0.6 * L.sc, L.Y(g.zt - 0.08), 0.6 * L.sc, 0.16 * L.sc);
    });
    b.strokeStyle = 'rgba(255,255,255,.45)'; b.setLineDash([3, 4]); b.beginPath(); b.moveTo(L.X(-o.sRw * Rh), L.Y(g.zt)); b.lineTo(L.X(0), L.Y(g.zt - o.hDM)); b.lineTo(L.X(o.sRw * Rh), L.Y(g.zt)); b.stroke(); b.setLineDash([]);
    b.fillStyle = 'rgba(255,255,255,.7)'; b.font = '500 10.5px "IBM Plex Sans", sans-serif'; b.fillText('deadman', L.cx, L.Y(g.zt - o.hDM * 0.35));
    // isotherms (gas temperature, or burden temperature when that is shown)
    var TF = view.id === 'ts' ? o.Ts : o.Tg;
    if ($('oIso').checked) [400, 800, 1000, 1200, 1400, 1600, 1800].forEach(function (T) {
      var pts = o.R.map(function (r, i) { for (var j = 0; j < o.NZ; j++) { var a = TF[j][i], c = TF[j + 1][i]; if ((a - T) * (c - T) <= 0 && a !== c) return [r.sm, o.z[j] + (o.z[j + 1] - o.z[j]) * (T - a) / (c - a)]; } return null; });
      var seg = pts.filter(Boolean); if (seg.length < 2) return;
      b.strokeStyle = 'rgba(255,255,255,.5)'; b.lineWidth = 1;
      [-1, 1].forEach(function (sd) { b.beginPath(); seg.forEach(function (p, k) { var X = L.X(sd * p[0] * g.r(p[1])), Y = L.Y(p[1]); if (k) b.lineTo(X, Y); else b.moveTo(X, Y); }); b.stroke(); });
      var e = seg[seg.length - 1]; b.fillStyle = '#fff'; b.textAlign = 'left'; b.font = '500 10.5px "IBM Plex Mono", monospace';
      b.fillText(T + '°', L.X(g.r(e[1])) + 6, L.Y(e[1]) + 3);
    });
    // cohesive zone band
    if ($('oCz').checked) {
      var top = o.cz.map(function (c) { return c.top; }), bt = o.cz.map(function (c) { return c.bot == null ? g.zt : c.bot; });
      [-1, 1].forEach(function (sd) {
        var up = [], dn = [];
        o.R.forEach(function (r, i) { if (top[i] != null) { up.push([sd * r.sm, top[i]]); dn.push([sd * r.sm, bt[i]]); } });
        if (up.length < 2) return;
        b.beginPath(); up.forEach(function (p, k) { var X = L.X(p[0] * g.r(p[1])), Y = L.Y(p[1]); if (k) b.lineTo(X, Y); else b.moveTo(X, Y); });
        dn.slice().reverse().forEach(function (p) { b.lineTo(L.X(p[0] * g.r(p[1])), L.Y(p[1])); }); b.closePath();
        b.fillStyle = 'rgba(255,255,255,.10)'; b.fill(); b.strokeStyle = '#ffffff'; b.lineWidth = 1.6; b.setLineDash([6, 3]); b.stroke(); b.setLineDash([]);
      });
      if (O.czApexH != null) { b.fillStyle = '#fff'; b.textAlign = 'left'; b.font = '600 11px "IBM Plex Sans", sans-serif'; var ap = g.zt - O.czApexH; b.fillText('cohesive zone', L.X(0.05 * g.r(ap)) + 4, L.Y(ap) - 6); }
    }
    // height scale on the right
    b.fillStyle = 'rgba(233,229,222,.75)'; b.font = '500 10.5px "IBM Plex Mono", monospace'; b.textAlign = 'left';
    for (var hgt = 0; hgt <= g.zt - g.zs + 0.01; hgt += hgt < 0.01 ? 2 : 2) { var dd2 = g.zt - hgt; b.fillText('+' + hgt.toFixed(0) + ' m', L.W - L.m.r + 14, L.Y(dd2) + 3); b.fillRect(L.W - L.m.r + 6, L.Y(dd2), 5, 1); }
    // scale bar
    var sc2 = $('scale'), s2 = sc2.getContext('2d'), sw = sc2.width; for (var q = 0; q < sw; q++) { var kk = Math.round(q / (sw - 1) * 255) * 3; s2.fillStyle = 'rgb(' + lu[kk] + ',' + lu[kk + 1] + ',' + lu[kk + 2] + ')'; s2.fillRect(q, 0, 1, 12); }
    var dig = view.id === 'p' ? 2 : 0;
    $('scLo').textContent = f(rg[0], dig) + ' ' + view.unit; $('scHi').textContent = f(rg[1], dig) + ' ' + view.unit;
    if (view.id === 'bur') burdenKey(s2, sw);
    function profile(c, d0, d1) { c.beginPath(); c.moveTo(L.X(-g.r(d0)), L.Y(d0)); for (var dd = d0; dd <= d1; dd += 0.1) c.lineTo(L.X(-g.r(dd)), L.Y(dd)); for (dd = d1; dd >= d0; dd -= 0.1) c.lineTo(L.X(g.r(dd)), L.Y(dd)); c.closePath(); }
    // gas particles: each keeps its place in the cumulative flow (a stream function), so it follows the gas between rings
    cumF = O.F.map(function (row) { var c = [0]; for (var i = 0; i < row.length; i++) c.push(c[i] + row[i]); return c; });
    var um = 0, n = 0; O.U.forEach(function (row) { for (var i = 0; i < row.length; i++) { um += row[i]; n++; } }); uMean = um / n;
    if (!PARTS.length) for (var p = 0; p < 240; p++) PARTS.push(newPart(true));
  }
  var cumF = [], uMean = 1;
  function newPart(any) { var g = O.g; return { c: Math.random(), d: any ? g.zs + Math.random() * (g.zt - g.zs) : g.zt - 0.05, sd: Math.random() < 0.5 ? -1 : 1, px: null, py: null }; }
  function partPos(p) {
    var o = O, g = o.g, x = cl((p.d - g.zs) / ((g.zt - g.zs) / o.NZ), 0, o.NZ), j = Math.round(x), c = cumF[j], i = 0;
    while (i < o.NR - 1 && c[i + 1] < p.c) i++;
    var fr = (p.c - c[i]) / Math.max(c[i + 1] - c[i], 1e-9), r = o.R[i], s = Math.sqrt(r.s0 * r.s0 + fr * (r.s1 * r.s1 - r.s0 * r.s0));
    return { s: s, u: o.U[Math.min(j, o.NZ)][i], j: j, i: i };
  }
  var last = 0;
  function frame(t) {
    anim = 0;
    if (!O || !GEO || MODE === '3d') return;
    var L = GEO, g = O.g, dt = last ? Math.min((t - last) / 1000, 0.05) : 0.016; last = t;
    var dpr = cv.width / L.W;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.drawImage(BASE, 0, 0); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if ($('oGas').checked) {
      var k = (g.zt - g.zs) / 7 / Math.max(uMean, 1e-3);    // a mean particle crosses the furnace in about 7 s
      ctx.lineCap = 'round';
      for (var q = 0; q < PARTS.length; q++) {
        var p = PARTS[q];
        if (p.d < g.zs) { p.d -= 0.6 * dt * (g.zs / 2) * 2; var y0 = L.Y(p.d); if (p.d < 0.05) { PARTS[q] = newPart(false); continue; } ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(p.px - 1, y0 - 1, 2, 2); continue; }
        var pp = partPos(p), X = L.X(p.sd * pp.s * g.r(p.d)), Y = L.Y(p.d);
        if (p.px != null && Math.abs(p.py - Y) < 40) { ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(p.px, p.py); ctx.lineTo(X, Y); ctx.stroke(); }
        p.px = X; p.py = Y;
        p.d -= pp.u * k * dt;
      }
      if (!reduce && visible) anim = requestAnimationFrame(frame);
    }
  }
  function streamlines() {   // reduced motion: draw the gas paths instead of moving them
    var L = GEO, g = O.g, dpr = cv.width / L.W;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.drawImage(BASE, 0, 0); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!$('oGas').checked) return;
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.2;
    [0.1, 0.25, 0.4, 0.55, 0.7, 0.82, 0.92].forEach(function (c) { [-1, 1].forEach(function (sd) {
      ctx.beginPath(); for (var d = g.zt; d >= g.zs; d -= 0.15) { var pp = partPos({ c: c, d: d }), X = L.X(sd * pp.s * g.r(d)), Y = L.Y(d); if (d === g.zt) ctx.moveTo(X, Y); else ctx.lineTo(X, Y); } ctx.stroke();
    }); });
  }
  function drawSection() {
    if (!O) return;
    drawBase();
    if (anim) cancelAnimationFrame(anim), anim = 0;
    last = 0;
    if (reduce) streamlines(); else frame(performance.now());
  }
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible && !anim && O && !reduce) anim = requestAnimationFrame(frame); }).observe(cv);
  var rz = 0; window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(drawSection, 200); });
  function pick(ev) {
    if (!O || !GEO) return null;
    var b = cv.getBoundingClientRect(), x = ev.clientX - b.left, y = ev.clientY - b.top, d = GEO.D(y), g = O.g;
    if (d < g.zs || d > g.zt) return null;
    var Rr = g.r(d), r = Math.abs((x - GEO.cx) / GEO.sc); if (r > Rr) return null;
    return { d: d, s: r / Rr, x: x, y: y };
  }
  cv.addEventListener('pointermove', function (ev) {
    var p = pick(ev), hud = $('hud'); if (!p) { hud.hidden = true; return; }
    var o = O, Pg = fieldAt(VIEWS[5].get(o), o, p.d, p.s);
    hud.hidden = false;
    hud.innerHTML = '+' + f(o.g.zt - p.d, 1) + ' m above tuyeres, r/R ' + f(p.s, 2) + '<br>gas ' + f(fieldAt(o.Tg, o, p.d, p.s)) + ' °C · burden ' + f(fieldAt(o.Ts, o, p.d, p.s)) + ' °C<br>gas ' + f(fieldAt(o.U, o, p.d, p.s), 2) + ' m/s · ηCO ' + f(fieldAt(o.ETA, o, p.d, p.s), 1) + ' %<br>reduction ' + f(fieldAt(o.RED, o, p.d, p.s)) + ' % · ' + f(Pg, 2) + ' kg/cm² g';
    hud.style.left = (p.x > GEO.W / 2 ? 8 : GEO.W / 2 + 8) + 'px';
  });
  cv.addEventListener('pointerleave', function () { $('hud').hidden = true; });
  cv.addEventListener('click', function (ev) { var p = pick(ev); if (!p) return; var g = O.g; $('lvl').value = Math.round((g.zt - p.d) / (g.zt - g.zs) * 1000); radial(); });

  /* ---------- small SVG charts */
  var NS = 'http://www.w3.org/2000/svg';
  function svgEl(t, a, p) { var e = document.createElementNS(NS, t); for (var k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; }
  function nice(v) { var p = Math.pow(10, Math.floor(Math.log10(Math.max(v, 1e-9)))), n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; }
  function frameXY(host, o) {
    host.innerHTML = '';
    var W = Math.max(260, host.clientWidth || 300), H = o.H || 220, m = { l: 44, r: o.r2 ? 40 : 12, t: 28, b: 30 };
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': o.label }, host);
    var X = function (v) { return m.l + (v - o.x0) / (o.x1 - o.x0) * (W - m.l - m.r); }, Y = function (v) { return H - m.b - (v - o.y0) / (o.y1 - o.y0) * (H - m.t - m.b); };
    var gx = o.xt || nice((o.x1 - o.x0) / 5), gy = o.yt || nice((o.y1 - o.y0) / 4);
    for (var v = Math.ceil(o.y0 / gy) * gy; v <= o.y1 + 1e-9; v += gy) { svgEl('line', { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), stroke: 'var(--line)' }, svg); svgEl('text', { x: m.l - 6, y: Y(v) + 4, 'text-anchor': 'end' }, svg).textContent = o.yf ? o.yf(v) : +v.toFixed(2); }
    for (v = Math.ceil(o.x0 / gx) * gx; v <= o.x1 + 1e-9; v += gx) svgEl('text', { x: X(v), y: H - m.b + 15, 'text-anchor': 'middle' }, svg).textContent = o.xf ? o.xf(v) : +v.toFixed(2);
    if (o.xl) svgEl('text', { x: (m.l + W - m.r) / 2, y: H - 2, 'text-anchor': 'middle' }, svg).textContent = o.xl;
    if (o.yl) { var t = svgEl('text', { x: 10, y: (m.t + H - m.b) / 2, 'text-anchor': 'middle', transform: 'rotate(-90 10 ' + (m.t + H - m.b) / 2 + ')' }, svg); t.textContent = o.yl; }
    return { svg: svg, X: X, Y: Y, W: W, H: H, m: m };
  }
  function line(Fr, pts, st) { if (pts.length < 2) return; svgEl('path', Object.assign({ d: 'M' + pts.map(function (p) { return Fr.X(p[0]).toFixed(1) + ',' + Fr.Y(p[1]).toFixed(1); }).join('L'), fill: 'none', 'stroke-width': 2, 'stroke-linejoin': 'round' }, st), Fr.svg); }
  function key(Fr, items) { var x = Fr.m.l + 6; items.forEach(function (it) { svgEl('line', { x1: x, x2: x + 16, y1: 9, y2: 9, stroke: it[1], 'stroke-width': 2, 'stroke-dasharray': it[2] || '' }, Fr.svg); var t = svgEl('text', { x: x + 20, y: 13 }, Fr.svg); t.textContent = it[0]; x += 28 + it[0].length * 6.2; }); }
  var ZC = ['var(--ore)', 'var(--chem)', 'var(--coke)'];

  function radial() {
    if (!O) return;
    var o = O, g = o.g, hRel = +$('lvl').value / 1000, d = g.zt - hRel * (g.zt - g.zs);
    var x = cl((d - g.zs) / ((g.zt - g.zs) / o.NZ), 0, o.NZ), j = Math.round(x);
    $('lvlTxt').textContent = '+' + f(g.zt - d, 1) + ' m';
    var lvName = o.levels.reduce(function (a, l) { return Math.abs(l.d - d) < Math.abs(a.d - d) ? l : a; });
    $('rpAt').textContent = f(g.zt - d, 1) + ' m above the tuyeres (near ' + lvName.name.toLowerCase() + '), Ø ' + f(2 * g.r(d), 2) + ' m';
    var tg = o.R.map(function (r) { return [1 - r.sm, fieldAt(o.Tg, o, d, r.sm)]; }), ts = o.R.map(function (r) { return [1 - r.sm, fieldAt(o.Ts, o, d, r.sm)]; });
    var hi = nice(Math.max.apply(null, tg.concat(ts).map(function (p) { return p[1]; })) * 1.05);
    var Fr = frameXY($('chRad'), { x0: 0, x1: 1, y0: 0, y1: Math.max(hi, 400), xt: 0.25, xf: function (v) { return v === 0 ? 'wall' : v === 1 ? 'centre' : (1 - v).toFixed(2); }, yl: '°C', label: 'Gas and burden temperature from the wall to the centre', H: 230 });
    var share = o.F[j], fmax = Math.max.apply(null, o.R.map(function (r, i) { return share[i] / (r.s1 - r.s0); }));
    o.R.forEach(function (r, i) { var hgt = share[i] / (r.s1 - r.s0) / fmax * (Fr.H - Fr.m.t - Fr.m.b) * 0.35; svgEl('rect', { x: Fr.X(1 - r.s1) + 1, width: Math.max(Fr.X(1 - r.s0) - Fr.X(1 - r.s1) - 2, 1), y: Fr.H - Fr.m.b - hgt, height: hgt, fill: 'var(--gas)', 'fill-opacity': 0.22 }, Fr.svg); });
    line(Fr, tg.slice().reverse(), { stroke: 'var(--accent)' });
    line(Fr, ts.slice().reverse(), { stroke: 'var(--ink-2)', 'stroke-dasharray': '5 4' });
    key(Fr, [['gas', 'var(--accent)'], ['burden', 'var(--ink-2)', '5 4'], ['gas share', 'var(--gas)']]);
  }
  function vertical() {
    var o = O, g = o.g, hmax = g.zt - g.zs;
    var Fr = frameXY($('chVert'), { x0: 0, x1: 2200, y0: 0, y1: Math.ceil(hmax), xt: 500, yt: nice(hmax / 5), xl: '°C', yl: 'm above tuyeres', label: 'Gas temperature against height', H: 260 });
    [[0.75, 1], [0.4, 0.75], [0, 0.4]].forEach(function (zn, k) {
      var gp = [], sp = [];
      for (var j = 0; j <= o.NZ; j++) {
        var a = 0, b = 0, w = 0; o.R.forEach(function (r, i) { var ov = Math.max(0, Math.min(r.s1, zn[1]) - Math.max(r.s0, zn[0])); if (ov > 0) { var ww = ov * (r.s0 + r.s1); a += o.Tg[j][i] * ww; b += o.Ts[j][i] * ww; w += ww; } });
        gp.push([a / w, g.zt - o.z[j]]); sp.push([b / w, g.zt - o.z[j]]);
      }
      line(Fr, gp, { stroke: ZC[k] }); line(Fr, sp, { stroke: ZC[k], 'stroke-dasharray': '4 4', 'stroke-width': 1.3 });
    });
    key(Fr, [['wall', ZC[0]], ['intermediate', ZC[1]], ['centre', ZC[2]]]);
  }
  function pressure() {
    var o = O, g = o.g, I = o.I, pts = o.P.map(function (p, j) { return [(p - ATM) / KG, g.zt - o.z[j]]; });
    var x0 = Math.floor(Math.min(I.TP, pts[0][0]) * 2) / 2, x1 = Math.ceil(Math.max(I.BP, pts[pts.length - 1][0]) * 2) / 2 + 0.01;
    var Fr = frameXY($('chP'), { x0: Math.max(0, x0 - 0.2), x1: x1, y0: 0, y1: Math.ceil(g.zt - g.zs), yt: nice((g.zt - g.zs) / 5), xl: 'kg/cm² g', yl: 'm above tuyeres', label: 'Pressure against height', H: 260 });
    line(Fr, pts, { stroke: 'var(--accent)' });
    var meas = [[I.TP, g.zt - g.zs, 'top'], [I.BP, 0, 'blast'], [I.mPS, g.zt - o.levels[2].d, 'shaft tap'], [I.mPB, g.zt - o.levels[4].d, 'belly tap']];
    meas.forEach(function (m) { if (!isNum(m[0])) return; svgEl('circle', { cx: Fr.X(m[0]), cy: Fr.Y(m[1]), r: 4, fill: 'var(--ink)' }, Fr.svg); svgEl('text', { x: Fr.X(m[0]) + 7, y: Fr.Y(m[1]) + 4 }, Fr.svg).textContent = m[2]; });
    $('pNote').textContent = 'Model resistance gives ' + f(o.dPpred) + ' kPa from stockline to tuyeres; measured blast minus top pressure is ' + f(o.dPmeas) + ' kPa, so the line is scaled ×' + f(o.pScale, 2) + ' (permeability index). Dots are your readings.';
  }
  function topChart() {
    var o = O, I = o.I, mx = Math.max.apply(null, o.topT.concat(o.probePred, o.probe.map(function (p) { return Math.max(p.L || 0, p.R || 0); }))) * 1.1;
    var Fr = frameXY($('chTop'), { x0: 0, x1: 1, y0: 0, y1: nice(Math.max(mx, 200)), xt: 0.25, xf: function (v) { return v === 0 ? 'wall' : v === 1 ? 'centre' : (1 - v).toFixed(2); }, yl: '°C', label: 'Gas temperature above the burden from the wall to the centre', H: 220, r2: true });
    var T = o.R.map(function (r, i) { return [1 - r.sm, o.topT[i]]; }).reverse();
    line(Fr, T, { stroke: 'var(--accent)' });
    var ymax = Fr.H - Fr.m.b, yt = Fr.m.t, eta = o.R.map(function (r, i) { return [Fr.X(1 - r.sm), ymax - o.topEta[i] / 70 * (ymax - yt)]; }).reverse();
    svgEl('path', { d: 'M' + eta.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join('L'), fill: 'none', stroke: 'var(--gas)', 'stroke-width': 1.3 }, Fr.svg);
    [0, 20, 40, 60].forEach(function (v) { svgEl('text', { x: Fr.W - Fr.m.r + 6, y: ymax - v / 70 * (ymax - yt) + 4 }, Fr.svg).textContent = v + '%'; });
    o.probe.forEach(function (p) {
      var X = Fr.X(1 - cl(p.s, 0, 1));
      if (isNum(p.L)) svgEl('circle', { cx: X, cy: Fr.Y(p.L), r: 4.5, fill: 'var(--coke)' }, Fr.svg);
      if (isNum(p.R)) svgEl('circle', { cx: X, cy: Fr.Y(p.R), r: 4.5, fill: 'none', stroke: 'var(--ore)', 'stroke-width': 2 }, Fr.svg);
      svgEl('text', { x: X, y: Fr.H - Fr.m.b - 6, 'text-anchor': 'middle' }, Fr.svg).textContent = p.i;
    });
    key(Fr, [['model', 'var(--accent)'], ['TL', 'var(--coke)'], ['TR', 'var(--ore)'], ['ηCO', 'var(--gas)']]);
  }

  /* ---------- tables and tiles */
  function tbl(head, rows) { return '<table class="t"><thead><tr>' + head.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead><tbody>' + rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>'; }
  function tile(lb, v, u, sub, warn) { return '<div class="tile' + (warn ? ' warn' : '') + '"><span>' + lb + '</span><b>' + v + (u ? '<small>' + u + '</small>' : '') + '</b>' + (sub ? '<i>' + sub + '</i>' : '') + '</div>'; }
  function renderAll() {
    var o = O, rw = o.rw, mb = o.mb, I = o.I;
    $('runInfo').textContent = o.NR + ' rings (' + (o.ringSrc === 'calc' ? 'from ' + o.nCalc + ' calculator rings' : 'from zone O/C') + ') × ' + o.NZ + ' levels' + (o.conv > 2 ? ' · not fully settled, check inputs' : '') + ' · ' + f(o.ms) + ' ms';
    var mEta = isNum(I.tgCO) && isNum(I.tgCO2) ? I.tgCO2 / (I.tgCO + I.tgCO2) * 100 : null;
    $('tiles').innerHTML = [
      tile('Flame temperature RAFT', f(rw.raft), '°C', 'O₂ enrichment ' + f(rw.enr, 1) + ' %', rw.raft < 2000 || rw.raft > 2350),
      tile('Bosh gas', f(rw.bosh), 'Nm³/min', 'Bosh gas index ' + f(rw.BGI, 1) + ' m/min', rw.BGI > 72),
      tile('Tuyere velocity', f(rw.vT), 'm/s', 'Kinetic energy ' + f(rw.KE, 1) + ' kW per tuyere', rw.vT < 180 || rw.vT > 290),
      tile('Raceway depth', f(rw.Dr, 2), 'm', 'Estimated from kinetic energy'),
      tile('CO utilisation', f(mb.etaCO, 1), '%', mEta != null ? 'measured ' + f(mEta, 1) + ' %' : 'H₂ ' + f(mb.etaH, 1) + ' %'),
      tile('Direct reduction', f(mb.rd * 100, 0), '%', 'of the wustite oxygen', !mb.ok),
      tile('Cohesive zone', o.czApexH == null ? '–' : f(o.czApexH, 1), 'm apex', 'root ' + f(o.czRootH, 1) + ' m · ' + o.czShape, o.czRootH != null && o.czRootH < 2),
      tile('Top gas temperature', f(o.topMix), '°C', isNum(o.measTop) ? 'measured ' + f(o.measTop) + ' °C' + (o.tops.some(function (t) { return isNum(t.v); }) ? ' (uptakes)' : '') : 'not measured', isNum(o.measTop) && Math.abs(o.measTop - o.topMix) > 40),
      tile('Hot metal temperature', f(o.hmt), '°C', isNum(I.hmtM) ? 'measured ' + f(I.hmtM) + ' °C' : 'model estimate'),
      tile('Pressure drop', f(o.dPmeas), 'kPa', 'model ' + f(o.dPpred) + ' · index ×' + f(o.pScale, 2), o.pScale > 1.6),
      tile('Gas to the centre', f(o.zonesTop[2].pct, 0), '%', 'wall ' + f(o.zonesTop[0].pct, 0) + ' % · intermediate ' + f(o.zonesTop[1].pct, 0) + ' %'),
      PC ? tile('PCI burnout in the raceway', f(PC.burn, 0), '%', 'unburnt char ' + f(PC.unbKgT, 0) + ' kg/tHM' + (isNum(I.burnM) ? ' · measured ' + f(I.burnM, 0) + ' %' : ''), PC.burn < 60) : '',
      tile('Production the blast carries', f(o.prodBlast), 't/day', 'entered ' + f(I.prod) + ' t/day', isNum(o.prodBlast) && Math.abs(o.prodBlast / I.prod - 1) > 0.12)].join('');
    $('alerts').innerHTML = o.alerts.map(function (a) { return '<div class="al ' + a.lv + '"><b>' + esc(a.t) + '</b>' + esc(a.m) + '</div>'; }).join('');
    $('zoneT').innerHTML = tbl(['Level', 'Height m', 'Ø m', 'Wall', 'Intermediate', 'Centre', 'Pressure kg/cm² g'], o.levels.map(function (l) {
      return [esc(l.name), f(l.h, 1), f(l.D, 2)].concat(l.zones.map(function (z) { return '<b>' + f(z.gas) + '</b> / ' + f(z.solid); })).concat([f((l.P - ATM) / KG, 2)]); }));
    $('gasT').innerHTML = tbl(['Zone', 'Middle shaft %', 'Just above tuyeres %', 'Top gas °C', 'ηCO at top %'], o.zonesTop.map(function (z, k) {
      var zr = [[0.75, 1], [0.4, 0.75], [0, 0.4]][k], t = 0, e = 0, w = 0; o.R.forEach(function (r, i) { var ov = Math.max(0, Math.min(r.s1, zr[1]) - Math.max(r.s0, zr[0])); if (ov > 0) { var ww = ov * o.F[0][i] / (r.s1 - r.s0); t += o.topT[i] * ww; e += o.topEta[i] * ww; w += ww; } });
      return [z.name, f(z.pct, 1), f(o.zonesBot[k].pct, 1), f(t / w), f(e / w, 1)]; }));
    $('czInfo').textContent = 'Shape ' + o.czShape + (isNum(o.slits) ? ' · about ' + f(o.slits) + ' coke slits in the centre' : '');
    $('czT').innerHTML = tbl(['Ring', 'r/R', 'O/C (vol)', 'Top m', 'Bottom m', 'Thickness m', 'Reduction in %', 'Direct red. %'], o.cz.map(function (c, i) {
      var r = o.R[i], tp = c.top == null ? null : o.g.zt - c.top, bt = c.bot == null ? 0 : o.g.zt - c.bot;
      return [i + 1, f(r.s0, 2) + '–' + f(r.s1, 2), f(r.o / Math.max(r.c, 1e-6), 2), tp == null ? 'not formed' : f(tp, 1), tp == null ? '–' : f(bt, 1), tp == null ? '–' : f(tp - bt, 1), f(c.red), f(r.rd * 100)]; }).reverse());
    var t = mb.top;
    $('balT').innerHTML = tbl(['Item', 'Model', 'Measured', 'Unit'], [
      ['Raceway gas CO / H₂ / N₂', f(rw.comp.CO, 1) + ' / ' + f(rw.comp.H2, 1) + ' / ' + f(rw.comp.N2, 1), '', 'vol %'],
      ['Coal per tuyere / O₂ per tuyere', f(rw.coalPerTuy, 1) + ' / ' + f(rw.o2PerTuy, 1), '', 'kg/min / Nm³/min'],
      ['Top gas CO', f(t.CO, 1), f(I.tgCO, 1), 'vol %'], ['Top gas CO₂', f(t.CO2, 1), f(I.tgCO2, 1), 'vol %'], ['Top gas H₂', f(t.H2, 1), f(I.tgH2, 1), 'vol %'], ['Top gas N₂', f(t.N2, 1), '', 'vol %'],
      ['Top gas, dry', f(mb.topDry), '', 'Nm³/tHM'], ['Carbon to gas', f(mb.cGas * 12 / 1000), '', 'kg/tHM'],
      ['… burnt at the tuyeres', f(mb.cTuyKg), '', 'kg/tHM'], ['… solution loss and direct reduction', f(mb.cDirKg), '', 'kg/tHM'], ['Carbon dissolved in hot metal', f(mb.cHMkg), '', 'kg/tHM'],
      ['Coke burnt at the tuyeres', f(o.coke.tuy), '', 'kg/tHM'], ['Coke to solution loss and direct reduction', f(o.coke.dir), '', 'kg/tHM'],
      ['Stove duty (cold to hot blast)', f(rw.stove, 1), '', 'MW'], ['Cooling loss', f(o.heatLossPerT, 2), '', 'GJ/tHM'], ['K value (permeability)', f(o.Kv, 3), '', '–'], ['Gas velocity at the throat', f(o.throatU, 2), '', 'm/s']]);
    $('cmpT').innerHTML = tbl(['Reading', 'Yours', 'Model', 'Difference'], o.cmp.map(function (c) { var d = isNum(c[1]) && isNum(c[2]) ? c[2] - c[1] : null, dg = /CO|H₂|pressure/i.test(c[0]) ? 2 : 0; return [c[0], f(c[1], dg), f(c[2], dg), d == null ? '–' : (d > 0 ? '+' : '') + f(d, dg)]; }));
    $('outT').innerHTML = tbl(['Output', 'Value', 'Unit'], o.outputs.map(function (x) { return [esc(x[0]), typeof x[1] === 'number' ? f(x[1], x[3] === undefined ? 1 : x[3]) : esc(x[1]), esc(x[2])]; }));
    DG = M.diagnose(I, o);
    var mrows = [];
    o.tops.forEach(function (t) { mrows.push([t.tag + ' (' + f(t.ang) + '°)', f(t.v), f(o.topMix), isNum(t.v) ? sg(t.v - o.topMix) : '–']); });
    o.probe.forEach(function (p) { mrows.push(['TL' + p.i + ' / TR' + p.i + ' (' + f(p.d, 2) + ' m from centre)', f(p.L) + ' / ' + f(p.R), f(p.model), [p.L, p.R].filter(isNum).map(function (v) { return sg(v - p.model); }).join(' / ') || '–']); });
    o.peri.forEach(function (p) { mrows.push(['T' + p.j + ' periphery (' + f(p.ang) + '°)', f(p.v), f(p.model), isNum(p.v) ? sg(p.v - p.model) : '–']); });
    $('measT').innerHTML = tbl(['Reading', 'Actual °C', 'Calculated °C', 'Actual − calculated'], mrows);
    $('diag').innerHTML = DG.msgs.map(function (a) { return '<div class="al ' + a.lv + '"><b>' + esc(a.t) + '</b>' + esc(a.m) + (a.act.length ? '<ul>' + a.act.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') + '</div>'; }).join('');
    var top = DG.msgs.filter(function (a) { return a.lv !== 'ok'; })[0], ban = $('diagBan');
    ban.hidden = false; ban.className = 'banner' + (top ? '' : ' ok');
    ban.innerHTML = top ? '<b>Check calculated against actual:</b> ' + esc(top.t) + '. ' + esc(top.m.split('. ').slice(-1)[0]) + ' See "Calculated against actual" under Numbers for the actions.' : '<b>Calculated and actual agree</b> or no readings entered yet.';
    drawSection(); radial(); vertical(); pressure(); topChart(); draw3d(); syncPciSliders(); drawPci(); status();
  }
  function sg(v) { return (v > 0 ? '+' : '') + Math.round(v); }
  var DG = null;
  $('lvl').addEventListener('input', radial);

  /* ---------- 3D furnace view */
  var V3 = null, MODE = read('bf-inside-mode') || '3d', can3d = !!(window.BFInside3D && BFInside3D.ok());
  if (!can3d) MODE = '2d';
  function colorOf(v, val, lo, hi) {
    if (typeof v === 'string') v = { lut: v, lo: lo, hi: hi };
    var rg = v.lo != null && v.hi != null ? [v.lo, v.hi] : (O ? rangeOf(v, v.get(O)) : [0, 1]);
    var l = LUT[v.lut], k = Math.round(cl((val - rg[0]) / (rg[1] - rg[0] || 1), 0, 1) * 255) * 3; return [l[k] / 255, l[k + 1] / 255, l[k + 2] / 255];
  }
  function opts3() { return { gas: $('o3Gas').checked, coal: $('o3Coal').checked, cz: $('o3Cz').checked, meas: $('o3Meas').checked, lean: $('o3Lean').checked, slice: $('o3Slice').checked, learn: $('o3Learn').checked,
    sliceH: O ? +$('slh3').value / 1000 * (O.g.zt - O.g.zs) : 5, cut: +$('cut3').value }; }
  function draw3d() {
    if (MODE !== '3d' || !O || !can3d) return;
    if (!V3) V3 = BFInside3D.create($('w3d'), { sample: function (v, d, s) { return fieldAt(v.get(O), O, d, s); }, colorOf: colorOf, onPick: pick3, burden: function (d, s) { return burdenColor(d, s); } });
    var F = view.get(O), rg = rangeOf(view, F); view._rg = rg;
    V3.build(O, Object.assign({}, view, { lo: rg[0], hi: rg[1] }), DG, opts3());
    $('slh3t').textContent = '+' + f(+$('slh3').value / 1000 * (O.g.zt - O.g.zs), 1) + ' m';
  }
  function pick3(p) {
    var o = O, hud = $('hud3'); hud.hidden = false;
    hud.innerHTML = '+' + f(o.g.zt - p.d, 1) + ' m above tuyeres, r/R ' + f(p.s, 2) + ', ' + f(p.ang) + '°<br>gas ' + f(fieldAt(o.Tg, o, p.d, p.s)) + ' °C · burden ' + f(fieldAt(o.Ts, o, p.d, p.s)) + ' °C<br>gas ' + f(fieldAt(o.U, o, p.d, p.s), 2) + ' m/s · ηCO ' + f(fieldAt(o.ETA, o, p.d, p.s), 1) + ' % · reduction ' + f(fieldAt(o.RED, o, p.d, p.s)) + ' %';
    clearTimeout(pick3.h); pick3.h = setTimeout(function () { hud.hidden = true; }, 6000);
    $('lvl').value = Math.round((o.g.zt - p.d) / (o.g.zt - o.g.zs) * 1000); radial();
  }
  function setMode(m) {
    MODE = m; write('bf-inside-mode', m);
    document.querySelectorAll('.mode button').forEach(function (b) { var on = b.getAttribute('data-m') === m; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    $('w3d').hidden = m !== '3d'; $('w2d').hidden = m !== '2d'; $('opt3d').hidden = $('pre3d').hidden = $('sl3d').hidden = m !== '3d'; $('opt2d').hidden = m !== '2d';
    $('wpci').hidden = $('pciCtl').hidden = $('pKey').hidden = $('pciCard').hidden = m !== 'pci'; $('views').hidden = m === 'pci';
    document.querySelector('.scale').hidden = m === 'pci';
    if (m === 'pci') { $('stHelp').textContent = 'One tuyere of ' + (O ? O.I.nTuy : '') + ', all lances equal. Drag to turn, pinch to zoom. The real flight from the lance tip to the raceway end takes about ' + (PC ? f(PC.tExit, 0) : '10') + ' ms; slow motion stretches it.'; $('stSub').textContent = 'Coal injection and combustion from the lance tip through the tuyere into the raceway.'; status(); drawPci(); return; }
    $('stHelp').textContent = m === '3d' ? 'Drag to turn, pinch or scroll to zoom, two fingers to move. Tap a cut face to read it. Angles clockwise from Top temp 1 = 0°; tuyere 1 is drawn at 0°.' : 'Left and right halves are the same radius, mirrored. Tap the section to read a point and set the level for the wall-to-centre profile.';
    $('stSub').textContent = m === '3d' ? 'Cut-away furnace from the calculation, with your readings at their angles.' : 'Section from the tuyeres to the stockline. Dots are gas, moving at their real relative speed.';
    status();
    if (m === '3d') draw3d(); else drawSection();
  }
  document.querySelector('.mode').addEventListener('click', function (e) { var b = e.target.closest('[data-m]'); if (!b) return; if (b.getAttribute('data-m') !== '2d' && !can3d) { toast('This device cannot show 3D (WebGL is off)'); return; } setMode(b.getAttribute('data-m')); });
  ['o3Gas', 'o3Coal', 'o3Cz', 'o3Meas', 'o3Lean', 'o3Slice', 'o3Learn'].forEach(function (id) { $(id).addEventListener('change', draw3d); });
  ['cut3', 'slh3'].forEach(function (id) { $(id).addEventListener('change', draw3d); $(id).addEventListener('input', function () { if (id === 'slh3' && O) $('slh3t').textContent = '+' + f(+$('slh3').value / 1000 * (O.g.zt - O.g.zs), 1) + ' m'; }); });
  $('slh3').addEventListener('change', function () { $('o3Slice').checked = true; draw3d(); });
  $('pre3d').addEventListener('click', function (e) { var b = e.target.closest('[data-z]'); if (b && V3) V3.preset(b.getAttribute('data-z')); });

  /* ---------- PCI raceway view */
  var V4 = null;
  function popts() { return { gas: $('pGas').checked, coal: $('pCoal').checked, vol: $('pVol').checked, flame: $('pFlame').checked, cut: $('pCut').checked, slow: +$('sSm').value, count: +$('sPn').value }; }
  function drawPci() {
    if (MODE !== 'pci' || !PC || !can3d) return;
    if (!V4) V4 = BFPci3D.create($('wpci'));
    V4.build(PC, O.I, popts());
    $('stHelp').textContent = 'One tuyere of ' + O.I.nTuy + ', all lances equal. Drag to turn, pinch to zoom. The real flight from the lance tip to the raceway end takes about ' + f(PC.tExit, 0) + ' ms; slow motion ×' + $('sSm').value + ' stretches it.';
    renderPci();
  }
  function status() {
    var el = $('mStatus'); if (!el || !O) return;
    var I = O.I, nm = 0; ['tt1', 'tt2', 'tt3', 'tt4', 'mUS', 'mMS', 'mLS', 'mPS', 'mPB', 'hmtM'].forEach(function (k) { if (isNum(I[k])) nm++; }); O.probe.forEach(function (p) { if (isNum(p.L)) nm++; if (isNum(p.R)) nm++; }); O.peri.forEach(function (p) { if (isNum(p.v)) nm++; });
    var fitted = Math.abs((I.fH || 1) - 1.3) > 1e-6 || Math.abs(I.fB || 0) > 1e-6;
    if (MODE === 'pci' && PC) el.innerHTML = '<span><b>PCI raceway</b> reduced-order model, not CFD</span><span>Status <b class="pre">' + (isNum(I.burnM) ? 'Checked against your burnout' : 'Preliminary') + '</b></span><span>Validation <b class="' + (isNum(I.burnM) ? 'val' : 'pre') + '">' + (isNum(I.burnM) ? 'measured ' + f(I.burnM, 0) + ' % · model ' + f(PC.burn, 0) + ' %' : 'no plant data loaded') + '</b></span><span>Kinetic constants: literature values, to calibrate</span>';
    else el.innerHTML = '<span><b>Furnace</b> reduced-order model, not CFD</span><span>Status <b class="' + (fitted ? 'val' : 'pre') + '">' + (fitted ? 'Fitted to your readings' : 'Preliminary') + '</b></span><span>Validation <b class="' + (nm ? 'val' : 'pre') + '">' + (nm ? nm + ' plant readings compared' : 'no plant data loaded') + '</b></span>';
  }
  function renderPci() {
    var r = PC; if (!r) return;
    $('sLdT').textContent = f(O.I.lanceDepth) + ' mm'; $('sLaT').textContent = f(O.I.lanceAng, 1) + '°'; $('sTaT').textContent = f(O.I.tuyAng, 1) + '°'; $('sSmT').textContent = '×' + $('sSm').value; $('sPnT').textContent = $('sPn').value;
    $('pcInfo').textContent = 'One tuyere ×' + r.nT + ', all lances equal · grind Rosin-Rammler n ' + f(r.grind.n, 2);
    var tgt = 70, mp = renderPci.mp;
    if (renderPci.key !== JSON.stringify([O.I.pci, O.I.BV, O.I.O2, O.I.HBT, O.I.pciD, O.I.pciR75, O.I.lanceDepth, O.I.lanceAng, O.I.coalVM, O.I.prod, O.I.nTuy])) { renderPci.key = JSON.stringify([O.I.pci, O.I.BV, O.I.O2, O.I.HBT, O.I.pciD, O.I.pciR75, O.I.lanceDepth, O.I.lanceAng, O.I.coalVM, O.I.prod, O.I.nTuy]); mp = renderPci.mp = BFPci.maxPci(O.I, O.rw, tgt); }
    $('pcTiles').innerHTML = [
      tile('Burnout at the raceway exit', f(r.burn, 0), '% daf', isNum(O.I.burnM) ? 'measured ' + f(O.I.burnM, 0) + ' %' : 'not measured', r.burn < 60),
      tile('Volatiles released', f(r.vol, 0), '%', 'yield ' + f(r.vY, 0) + ' % of daf coal (Q ×' + f(O.I.pciQ, 2) + ')'),
      tile('Char burnt', f(r.char, 0), '%', 'of the char formed'),
      tile('Peak flame', f(r.Tpk), '°C', 'at ' + f(r.xPk * 1000) + ' mm from the lance tip'),
      tile('Oxygen used up at', r.o2Zero == null ? '–' : f(r.o2Zero * 1000), 'mm', 'tuyere nose at ' + f(r.Lb * 1000) + ' mm'),
      tile('Residence time', f(r.tExit, 1), 'ms', 'in the blowpipe and tuyere ' + f(r.tNose, 1) + ' ms'),
      tile('Oxygen excess λ', f(r.lam, 2), '', 'O₂ in the blast ÷ O₂ the coal needs', r.lam < 1.4),
      tile('Unburnt char', f(r.unbKgT, 0), 'kg/tHM', f(r.unbKgH, 0) + ' kg/h per tuyere', r.unbKgT > 40),
      tile('Highest PCI for ' + tgt + ' % burnout', mp == null ? 'below 20' : f(mp), 'kg/tHM', 'same blast, grind and lance'),
      tile('Gas leaving the raceway', f(r.exit.T), '°C', 'furnace RAFT ' + f(O.rw.raft) + ' °C')].join('');
    $('pcWarn').innerHTML = r.warn.map(function (a) { return '<div class="al ' + a.lv + '"><b>' + esc(a.t) + '</b>' + esc(a.m) + '</div>'; }).join('');
    var e = r.exit; $('pcExit').innerHTML = tbl(['Gas', 'vol %'], [['CO', f(e.CO, 1)], ['H₂', f(e.H2, 1)], ['N₂', f(e.N2, 1)], ['CO₂', f(e.CO2, 2)], ['H₂O', f(e.H2O, 2)], ['O₂', f(e.O2, 2)], ['Temperature', f(e.T) + ' °C']]);
    var lp = r.prof[r.prof.length - 1];
    $('pcCls').innerHTML = tbl(['Size µm', 'Share', 'Volatiles %', 'Char burnt %', 'Max °C'], r.grind.d.map(function (d, k) { var mx = Math.max.apply(null, r.prof.map(function (p) { return p.Tp[k]; })); return [f(d), '20 %', f(lp.cls[k].vol * 100), f(lp.cls[k].ch * 100), f(mx)]; }));
    // conversion vs residence time
    var tmax = Math.ceil(r.tExit + 0.5);
    var Fr = frameXY($('chConv'), { x0: 0, x1: tmax, y0: 0, y1: 100, yt: 25, xl: 'residence time, ms', yl: '%', label: 'Conversion against residence time', H: 230 });
    [['vol', 'var(--chem)', 'volatiles'], ['char', 'var(--ore)', 'char'], ['burn', 'var(--accent)', 'burnout']].forEach(function (q) { line(Fr, r.prof.map(function (p) { return [p.t, p[q[0]]]; }), { stroke: q[1] }); });
    [[r.tNose, 'nose']].forEach(function (m) { svgEl('line', { x1: Fr.X(m[0]), x2: Fr.X(m[0]), y1: Fr.m.t, y2: Fr.H - Fr.m.b, stroke: 'var(--muted)', 'stroke-dasharray': '4 4' }, Fr.svg); svgEl('text', { x: Fr.X(m[0]) + 4, y: Fr.m.t + 12 }, Fr.svg).textContent = 'tuyere nose'; });
    key(Fr, [['volatiles', 'var(--chem)'], ['char', 'var(--ore)'], ['burnout', 'var(--accent)']]);
    // gas along the axis
    var Fg = frameXY($('chGasX'), { x0: 0, x1: Math.ceil(r.Lend * 10) / 10 * 1000, y0: 0, y1: 3000, yt: 500, xl: 'distance from the lance tip, mm', yl: '°C', label: 'Gas temperature and composition along the tuyere axis', H: 230, r2: true });
    line(Fg, r.prof.map(function (p) { return [p.x * 1000, p.Tg]; }), { stroke: 'var(--accent)' });
    var yb = Fg.H - Fg.m.b, ytp = Fg.m.t, sp = function (v) { return yb - v / 40 * (yb - ytp); };
    [['O2', 'var(--gas)'], ['CO2', 'var(--ink-2)'], ['CO', 'var(--coke)']].forEach(function (q) { svgEl('path', { d: 'M' + r.prof.map(function (p) { return Fg.X(p.x * 1000).toFixed(1) + ',' + sp(p[q[0]]).toFixed(1); }).join('L'), fill: 'none', stroke: q[1], 'stroke-width': 1.5, 'stroke-dasharray': q[0] === 'CO2' ? '4 3' : '' }, Fg.svg); });
    [0, 10, 20, 30, 40].forEach(function (v) { svgEl('text', { x: Fg.W - Fg.m.r + 6, y: sp(v) + 4 }, Fg.svg).textContent = v + '%'; });
    svgEl('line', { x1: Fg.X(r.Lb * 1000), x2: Fg.X(r.Lb * 1000), y1: Fg.m.t, y2: Fg.H - Fg.m.b, stroke: 'var(--muted)', 'stroke-dasharray': '4 4' }, Fg.svg);
    key(Fg, [['gas °C', 'var(--accent)'], ['O₂', 'var(--gas)'], ['CO₂', 'var(--ink-2)'], ['CO', 'var(--coke)']]);
  }
  function setIn(k, v) { ST.v[k] = v; save(); var el = $('in_' + k); if (el) el.value = v; schedule(); }
  [['sLd', 'lanceDepth'], ['sLa', 'lanceAng'], ['sTa', 'tuyAng']].forEach(function (q) {
    $(q[0]).addEventListener('input', function () { var u = q[1] === 'lanceDepth' ? ' mm' : '°'; $(q[0] + 'T').textContent = this.value + u; });
    $(q[0]).addEventListener('change', function () { setIn(q[1], +this.value); });
  });
  ['pGas', 'pCoal', 'pVol'].forEach(function (id) { $(id).addEventListener('change', function () { if (V4) V4.opts(popts()); }); });
  ['pFlame', 'pCut', 'sPn'].forEach(function (id) { $(id).addEventListener('change', drawPci); });
  $('sSm').addEventListener('input', function () { $('sSmT').textContent = '×' + this.value; if (V4) V4.opts(popts()); });
  $('sPn').addEventListener('input', function () { $('sPnT').textContent = this.value; });
  $('pViews').addEventListener('click', function (e) { var b = e.target.closest('[data-pv]'); if (b && V4) V4.view(b.getAttribute('data-pv')); });
  function syncPciSliders() { if (!O) return; $('sLd').value = O.I.lanceDepth; $('sLa').value = O.I.lanceAng; $('sTa').value = O.I.tuyAng; }

  /* ---------- phone panes */
  document.querySelector('.seg').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    document.querySelectorAll('.seg button').forEach(function (x) { x.classList.toggle('on', x === b); });
    $('main').setAttribute('data-pane', b.getAttribute('data-p'));
    if (O) setTimeout(function () { drawSection(); radial(); vertical(); pressure(); topChart(); if (V3) V3.resize(); if (V4) V4.resize(); }, 30);
  });

  /* ---------- Excel: template, import, results */
  function norm(s) { return M.norm(s); }
  function matchKey(mat, par) { return M.matchParam(mat, par); }
  function readBook(wb) {
    var found = [], seen = {};
    wb.SheetNames.forEach(function (sn) {
      var rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: true, defval: null });
      var hi = -1, cP = -1, cV = -1, cM = -1, cK = -1;
      for (var r = 0; r < Math.min(rows.length, 15) && hi < 0; r++) {
        (rows[r] || []).forEach(function (c, i) { var n = norm(c); if (/^(inputparameter|parameter|input)$/.test(n)) cP = i; if (/^(value|plantmeasuredvalue|measuredvalue|plantvalue|actual)$/.test(n)) cV = i; if (n === 'material') cM = i; if (n === 'key') cK = i; });
        if (cP >= 0 && cV >= 0) hi = r; else { cP = cV = cM = cK = -1; }
      }
      if (hi < 0) return;
      for (r = hi + 1; r < rows.length; r++) {
        var row = rows[r] || [], v = row[cV]; if (typeof v === 'string') v = parseFloat(v.replace(',', '.'));
        if (!isNum(v)) continue;
        var kk = cK >= 0 ? String(row[cK] || '').replace(/^fi\./, '') : '', k = kk && ROWS[kk] ? kk : (cK >= 0 && /^(calc|chem)\./.test(String(row[cK] || '')) ? null : matchKey(cM >= 0 ? row[cM] : sn, row[cP]));
        var name = (cM >= 0 && row[cM] ? row[cM] + ' · ' : '') + row[cP];
        if (k && !seen[k]) { seen[k] = 1; found.push({ k: k, v: v, name: name, sheet: sn }); } else if (!k) found.push({ k: null, v: v, name: name, sheet: sn });
      }
    });
    return found;
  }
  $('xl').addEventListener('change', function () {
    var file = this.files[0]; this.value = ''; if (!file) return;
    var fr = new FileReader();
    fr.onload = function () {
      var list; try { list = readBook(XLSX.read(new Uint8Array(fr.result), { type: 'array' })); } catch (e) { toast('Could not read the file: ' + e.message); return; }
      var ok = list.filter(function (x) { return x.k; }), no = list.filter(function (x) { return !x.k; });
      if (!list.length) { toast('No values found. The sheet needs a Parameter column and a Value or Plant Measured Value column.'); return; }
      $('dlgH').textContent = 'Import ' + ok.length + ' value' + (ok.length === 1 ? '' : 's') + ' from ' + file.name;
      $('dlgB').innerHTML = (ok.length ? tbl(['Use', 'In the file', 'Goes to', 'Now', 'New'], ok.map(function (x, i) { var r = ROWS[x.k], cur = val(x.k), out = x.v < r.min || x.v > r.max; return ['<input type="checkbox" data-i="' + i + '"' + (out ? '' : ' checked') + ' aria-label="Use this value">', esc(x.name), esc(r.label) + ' <small>' + esc(r.unit) + '</small>', f(cur, 2), (out ? '<span style="color:var(--bad)">' : '') + f(x.v, 2) + (out ? ' out of range</span>' : '')]; })) : '') +
        (no.length ? '<p class="hint" style="margin-top:10px"><b>Not used (' + no.length + '):</b> ' + no.slice(0, 40).map(function (x) { return esc(x.name); }).join(', ') + (no.length > 40 ? '…' : '') + '</p>' : '');
      $('dlgF').innerHTML = '<button type="button" class="btn" id="dlgC">Cancel</button><button type="button" class="btn go" id="dlgA">Use ticked values</button>';
      $('dlgC').onclick = function () { $('dlg').close(); };
      $('dlgA').onclick = function () {
        var n = 0; $('dlgB').querySelectorAll('input[data-i]').forEach(function (c) { if (!c.checked) return; var x = ok[+c.getAttribute('data-i')]; ST.v[x.k] = x.v; if (ROWS[x.k].link) ST.man[x.k] = true; n++; });
        save(); $('dlg').close(); buildInputs(); calc(); toast(n + ' value' + (n === 1 ? '' : 's') + ' imported');
      };
      $('dlg').showModal();
    };
    fr.readAsArrayBuffer(file);
  });
  $('dlgX').addEventListener('click', function () { $('dlg').close(); });
  function saveBook(wb, name) {
    try { XLSX.writeFile(wb, name); toast('Saved ' + name); }
    catch (e) { toast('This device cannot save Excel files from the app. Use the template file shared with the app.'); }
  }
  $('bTpl').addEventListener('click', function () {
    var aoa = [['Section', 'Key', 'Parameter', 'Unit', 'Priority', 'Value', 'Source in app']];
    ORDER.forEach(function (k) { var r = ROWS[k], x = val(k); aoa.push([r.sec.n + '. ' + r.sec.title, k, r.label, r.unit, { E: 'Essential', O: 'Optional', A: 'Advanced' }[r.pr], x == null ? '' : x, linked(k) ? (r.link === 'calc' ? 'Burden calculator' : 'Batch chemistry') : 'typed']); });
    var wb = XLSX.utils.book_new(), ws = XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = [{ wch: 34 }, { wch: 10 }, { wch: 44 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Furnace 3D view inputs'); saveBook(wb, 'BF_Furnace_Inside_Inputs.xlsx');
  });
  $('bXls').addEventListener('click', function () {
    if (!O) return; var o = O, wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Output', 'Value', 'Unit']].concat(o.outputs.map(function (x) { return [x[0], typeof x[1] === 'number' ? +x[1].toFixed(2) : x[1], x[2]]; }))), 'Outputs');
    var zr = [['Level', 'Height above tuyeres m', 'Wall gas', 'Wall burden', 'Intermediate gas', 'Intermediate burden', 'Centre gas', 'Centre burden', 'Pressure kg/cm2 g']];
    o.levels.forEach(function (l) { zr.push([l.name, +l.h.toFixed(2)].concat([].concat.apply([], l.zones.map(function (z) { return [Math.round(z.gas), Math.round(z.solid)]; }))).concat([+((l.P - ATM) / KG).toFixed(3)])); });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(zr), 'Zonal temperatures');
    ['Tg', 'Ts'].forEach(function (fk) { var a = [['Height m \\ r/R'].concat(o.R.map(function (r) { return +r.sm.toFixed(3); }))]; for (var j = 0; j <= o.NZ; j++) a.push([+(o.g.zt - o.z[j]).toFixed(2)].concat(Array.prototype.map.call(o[fk][j], function (v) { return Math.round(v); }))); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(a), fk === 'Tg' ? 'Gas T grid' : 'Burden T grid'); });
    var inp = [['Key', 'Parameter', 'Unit', 'Value']]; ORDER.forEach(function (k) { inp.push([k, ROWS[k].label, ROWS[k].unit, o.I[k]]); });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(inp), 'Inputs used');
    saveBook(wb, 'BF_Furnace_Inside_Results.xlsx');
  });
  $('bPdf').addEventListener('click', function () {
    var name = 'BF_Furnace_Inside_' + new Date().toISOString().slice(0, 10);
    if (window.bfReport && window.bfReport.savePdf) window.bfReport.savePdf(name + '.pdf').then(function (r) { if (r && r.ok) toast('Saved ' + r.path); else if (r && r.error) toast('Could not save the PDF: ' + r.error); });
    else if (window.Android && window.Android.printPdf) { window.Android.printPdf(name); toast('Choose "Save as PDF" as the printer, then tap the PDF button'); }
    else window.print();
  });

  /* ---------- calibration: grid search on heat transfer and radial bias, then permeability from the pressure drop */
  $('bFit').addEventListener('click', function () {
    var I = inputs(), m0 = M.misfit(I, O || M.run(I, I.useCalc && BS ? BS : null));
    if (!m0.n) { toast('Enter Top temp 1–4 or burden probe readings to fit the model'); return; }
    var cand = M.fitGrid(I), best = null, k = 0, btn = $('bFit'), lbl = btn.innerHTML; btn.disabled = true;
    function step() {
      var t0 = performance.now();
      while (k < cand.length && performance.now() - t0 < 120) {
        var c = cand[k++], Ii = Object.assign({}, I, c), o = M.run(Ii, I.useCalc && BS ? BS : null), e = M.misfit(Ii, o).e;
        if (!best || e < best.e) best = { e: e, c: c, o: o };
      }
      btn.textContent = 'Fitting ' + Math.round(k / cand.length * 100) + ' %';
      if (k < cand.length) { setTimeout(step, 0); return; }
      var fK = best.o.dPmeas > 0 ? +(cl((I.fK || 1) * best.o.pScale, 0.3, 3)).toFixed(2) : I.fK;
      ST.v.fH = best.c.fH; ST.v.fB = best.c.fB; ST.v.fK = fK; save();
      btn.disabled = false; btn.innerHTML = lbl; buildInputs(); calc();
      toast('Fitted: heat transfer ×' + best.c.fH + ', radial bias ' + best.c.fB + ', permeability ×' + fK + ' (rms ' + f(Math.sqrt(best.e), 2) + ' of the reading tolerance)');
      var d = document.querySelector('[data-sec="cal"]'); if (d) d.open = true;
    }
    step();
  });

  /* ---------- buttons, start */
  $('bRun').addEventListener('click', calc);
  $('bLoad').addEventListener('click', function () { refreshCalc(true); });
  var started = 0, waitT = 0, loudNow = false;
  function refreshCalc(loud) {
    loudNow = loud;
    // open the calculator hidden so it recalculates with its latest inputs and leaves a fresh snapshot (same as the Report page)
    if (!read(CALC)) { appData(); srcLine(); buildInputs(); calc(); if (loud) toast('Calculator has no saved inputs yet: zone O/C used'); return; }
    started = Date.now(); $('calcFrame').src = 'calculator.html?inside=' + started;
    clearTimeout(waitT); waitT = setTimeout(function () { done(loud ? 'Calculator did not finish (check its inputs): last result used' : ''); }, 9000);
  }
  function done(msg) { $('calcFrame').src = 'about:blank'; appData(); srcLine(); buildInputs(); calc(); if (msg) toast(msg); }
  window.addEventListener('message', function (e) {
    if (!e.data || !e.data.bfCalcSnapshot) return;
    var s = read(SNAP); if (!s || s.at < started) return;
    clearTimeout(waitT); done(loudNow ? 'Updated from the calculator and Batch chemistry' : '');
  });
  if (window.Android) { $('bTpl').hidden = true; $('bXls').hidden = true; }   // the Android shell cannot save downloaded files; PDF still works
  setMode(MODE);
  appData(); srcLine(); buildInputs(); calc();
  refreshCalc(false);
})();
