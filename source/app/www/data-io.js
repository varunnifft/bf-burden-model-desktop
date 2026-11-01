/* Data input for the whole app: one list of every input (each once, on the page that owns it), written out as one
   Excel / CSV sheet and read back from one file. Batch chemistry owns the charge and its parameters; the Burden
   calculator owns the furnace, chute, matrix, gas and material properties (burden per charge and moisture come from
   Batch chemistry while the link is on); Furnace 3D view owns everything else. Lab analyses stay in the lab-report layout
   and are handed to the Batch chemistry import, which shows its own preview. Needs engine.js, seed.js, calc-def.js,
   inside-model.js and lib/xlsx.full.min.js. */
(function () {
  'use strict';
  var E = window.BurdenEngine, M = window.BFInside, CD = window.BF_CALC_DEF;
  var CHEMK = 'sspl_bf_burden_v1', CALCK = 'bfbm-calculator-v1', INK = 'bf-inside-v1', LINK = 'bf608-link';
  var isNum = function (x) { return typeof x === 'number' && isFinite(x); };
  function rd(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function wr(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  function iso(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function ser(st) { return JSON.stringify(st, function (k, v) { if (this[k] instanceof Date) return { __d: iso(this[k]) }; return v; }); }
  function revive(txt) { return JSON.parse(txt, function (k, v) { if (v && typeof v === 'object' && typeof v.__d === 'string') { var p = v.__d.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); } return v; }); }
  function chemLoad() {
    var st = null; try { var t = localStorage.getItem(CHEMK); if (t) st = revive(t); } catch (e) { }
    var fresh = !st || st.version !== 1; if (fresh) st = E.defaultState();
    if (fresh || !st.lab || (!st.lab.bf && !st.lab.importedOn)) st.lab = window.SEED_LAB ? E.migrateLab(revive(JSON.stringify(window.SEED_LAB))) : E.emptyLab();
    st.lab = E.migrateLab(st.lab); if (!st.charge) st.charge = E.chargeDefault();
    st.params = Object.assign({}, E.PARAMS_DEFAULT, st.params); st.matSource = st.matSource || {}; st.manual = st.manual || {};
    return st;
  }
  function chemSave(st) { try { localStorage.setItem(CHEMK, ser(st)); } catch (e) { } }
  function calcLoad() {
    var IN = JSON.parse(JSON.stringify(CD)); delete IN.labels;
    var d = rd(CALCK);
    if (d && d.f) { IN = Object.assign(IN, d); IN.f = Object.assign({}, CD.f, d.f); IN.mps = Object.assign({}, CD.mps, d.mps || {}); IN.moist = Object.assign({}, CD.moist, d.moist || {}); IN.props = Object.assign({}, CD.props, d.props || {}); delete IN.labels; }
    return IN;
  }
  function linkOn() { try { return localStorage.getItem(LINK) !== 'off'; } catch (e) { return true; } }
  var OP_KEYS = ['cokeBase', 'yardPct', 'oc', 'sinterPct', 'pelletPct', 'cloPct', 'nut', 'lime', 'dolo', 'pyrox', 'quartz', 'mn'];
  var CALC_MATS = [['mainCoke', 'Main coke', 'coke'], ['yardCoke', 'Yard / second coke', 'coke'], ['sinter', 'Sinter', 'sinter'], ['pellet', 'Pellet', 'pellet'], ['ore', 'Lump ore', 'ore'], ['clo', 'Lump CLO', 'clo'],
    ['lime', 'Limestone', 'lime'], ['dolo', 'Dolomite', 'dolo'], ['pyrox', 'Paraxonite', 'pyrox'], ['quartz', 'Quartz', 'quartz'], ['mn', 'Mn ore', 'mn'], ['nut', 'Nut coke', 'nut']];
  var CHEM_P = [['si', 'Si in hot metal', '%'], ['feRec', 'Fe recovery', '%'], ['feHM', 'Fe in hot metal', '%'], ['hmC', 'C in hot metal', '%'], ['chPerHour', 'Charges per hour', 'Nos./h'], ['o2Purity', 'Oxygen purity', '%'], ['blastMoist', 'Blast moisture', 'g/Nm³']];
  function splitUnit(l) { var m = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(l); return m ? [m[1], m[2]] : [l, '']; }

  /* every input once: { page, sec, key, label, unit, v, opt } */
  function entries() {
    var L = [], S = chemLoad(), IN = calcLoad(), ST = rd(INK) || { v: {}, man: {} }, on = linkOn();
    ST.v = ST.v || {};
    function add(page, sec, key, label, unit, v, opt) { L.push({ page: page, sec: sec, key: key, label: label, unit: unit || '', v: v == null || v === '' ? null : v, opt: !!opt }); }
    // Batch chemistry
    if (!(S.charge && S.charge.on)) E.MATERIALS.forEach(function (m, i) { add('Batch chemistry', 'Charge per batch', 'chem.qty.' + m.key, m.name, 'kg/batch', +S.qty[i] || 0); });
    CHEM_P.forEach(function (p) { add('Batch chemistry', 'Parameters', 'chem.p.' + p[0], p[1], p[2], S.params[p[0]]); });
    // Burden calculator
    Object.keys(CD.f).forEach(function (k) {
      if (on && OP_KEYS.indexOf(k) >= 0) return;
      var lu = splitUnit(CD.labels[k] || k), opt = k === 'tankV' || k === 'oreMax';
      add('Burden calculator', OP_KEYS.indexOf(k) >= 0 ? 'Burden per charge' : ['BV', 'O2', 'TP', 'BP', 'Ttop'].indexOf(k) >= 0 ? 'Furnace operation' : 'Furnace and chute', 'calc.f.' + k, lu[0], lu[1], IN.f[k], opt);
    });
    CALC_MATS.forEach(function (m) {
      add('Burden calculator', 'Materials', 'calc.mps.' + m[0], m[1] + ' mean particle size', 'mm', IN.mps[m[0]]);
      if (!on) add('Burden calculator', 'Materials', 'calc.moist.' + m[0], m[1] + ' moisture', '%', IN.moist[m[0]]);
    });
    Object.keys(CD.props).forEach(function (c) {
      var nm = { coke: 'Coke', sinter: 'Sinter', pellet: 'Pellet', ore: 'Lump ore', clo: 'Lump CLO', lime: 'Limestone', dolo: 'Dolomite', pyrox: 'Paraxonite', quartz: 'Quartz', mn: 'Mn ore', nut: 'Nut coke' }[c] || c, p = IN.props[c] || CD.props[c];
      add('Burden calculator', 'Materials', 'calc.props.' + c + '.0', nm + ' bulk density', 't/m³', p[0]);
      add('Burden calculator', 'Materials', 'calc.props.' + c + '.1', nm + ' friction coefficient', '–', p[1]);
      add('Burden calculator', 'Materials', 'calc.props.' + c + '.2', nm + ' angle of repose', '°', p[2]);
    });
    (IN.mx || CD.mx).forEach(function (r, i) {
      ['Coke angle', 'Coke revolutions', 'Metallics angle', 'Metallics revolutions'].forEach(function (n, j) { add('Burden calculator', 'Charging matrix', 'calc.mx.' + (i + 1) + '.' + j, 'Ring ' + (i + 1) + ' ' + n.toLowerCase(), j % 2 ? 'rev' : '°', r[j]); });
    });
    // Furnace 3D view: only what it owns (rows linked to the calculator, chemistry or the PCI model are filled there)
    var D = M.defaults();
    M.SECTIONS.forEach(function (s) {
      s.rows.forEach(function (r) {
        if (r[8]) return;
        if (s.grid) M.MATS.forEach(function (m, i) { var k = m + r[0], v = ST.v[k] !== undefined ? ST.v[k] : D[k]; add('Furnace 3D view', s.title, 'fi.' + k, s.grid[i] + ' – ' + r[1], r[2], v, r[7] !== 'E'); });
        else { var v = ST.v[r[0]] !== undefined ? ST.v[r[0]] : D[r[0]]; add('Furnace 3D view', s.title, 'fi.' + r[0], r[1], r[2], v, r[7] !== 'E'); }
      });
      if (s.dyn) {
        var I2 = Object.assign({}, D, ST.v), n = Math.round(Math.min(Math.max(+I2.prN || 5, 1), M.PRMAX)), m2 = Math.round(Math.min(Math.max(+I2.peN || 8, 1), M.PEMAX));
        for (var i = 1; i <= n; i++) { add('Furnace 3D view', s.title, 'fi.prd' + i, 'Probe point ' + i + ' distance from centre', 'm', isNum(ST.v['prd' + i]) ? ST.v['prd' + i] : M.probeDist(I2, i), true); add('Furnace 3D view', s.title, 'fi.tl' + i, 'TL' + i + ' left arm', '°C', ST.v['tl' + i], true); add('Furnace 3D view', s.title, 'fi.tr' + i, 'TR' + i + ' right arm', '°C', ST.v['tr' + i], true); }
        for (var j = 1; j <= m2; j++) { add('Furnace 3D view', s.title, 'fi.ta' + j, 'T' + j + ' angle', '°', isNum(ST.v['ta' + j]) ? ST.v['ta' + j] : M.periAngle(I2, j), true); add('Furnace 3D view', s.title, 'fi.t' + j, 'T' + j + ' periphery temperature', '°C', ST.v['t' + j], true); }
      }
    });
    return L;
  }
  var HEAD = ['Page', 'Section', 'Key', 'Parameter', 'Unit', 'Value', 'Required'];
  function rows() { return entries().map(function (e) { return [e.page, e.sec, e.key, e.label, e.unit, e.v == null ? '' : e.v, e.opt ? 'optional' : 'essential']; }); }
  function labRows() {
    var S = chemLoad(), rv = E.review(S), today = iso(new Date()), H = ['Date', 'Material', 'Moisture', 'FC', 'Fe(T)', 'CaO', 'MgO', 'SiO2', 'Al2O3', 'P', 'S'], idx = [0, 1, 2, 3, 4, 5, 6, 8, 9], out = [H];
    rv.forEach(function (r) { var name = (r.m.sheet || r.m.name).split('|')[0] || r.m.name; out.push([today, name].concat(idx.map(function (j) { var v = r.used[j]; return isNum(v) ? +v.toFixed(3) : ''; }))); });
    return out;
  }
  function workbook() {
    var wb = XLSX.utils.book_new(), now = new Date();
    var readme = [['BF Model – input data sheet'], ['Made ' + now.toLocaleString() + ' with the values now in the app.'], [''],
      ['How to use'], ['1. Fill or change the Value column on the sheet "All inputs". Each input appears once, on the page that owns it.'],
      ['2. Lab analyses go on the sheet "Lab analysis" (or upload your own lab report Excel, as before).'],
      ['3. In the app open Data input and upload this file: every page is filled at once. Anything left empty keeps the value in the app.'],
      ['4. Inputs that are not in the file can still be typed on each page.'], [''],
      ['Rows that are not here on purpose'], ['Furnace 3D view takes geometry, blast, burden and fuel rates from the Burden calculator and Batch chemistry, so they are not repeated.'],
      ['While the Burden calculator is linked to Batch chemistry, burden per charge and moisture come from the charge and the lab analysis.'],
      ['Production, coke rate and PCI rate are calculated by Batch chemistry from the charge and the charges per hour.']];
    var ws0 = XLSX.utils.aoa_to_sheet(readme); ws0['!cols'] = [{ wch: 110 }]; XLSX.utils.book_append_sheet(wb, ws0, 'Read me');
    var ws = XLSX.utils.aoa_to_sheet([HEAD].concat(rows())); ws['!cols'] = [{ wch: 18 }, { wch: 30 }, { wch: 22 }, { wch: 46 }, { wch: 12 }, { wch: 12 }, { wch: 11 }]; ws['!autofilter'] = { ref: 'A1:G1' };
    XLSX.utils.book_append_sheet(wb, ws, 'All inputs');
    var wl = XLSX.utils.aoa_to_sheet(labRows()); wl['!cols'] = [{ wch: 12 }, { wch: 24 }].concat(new Array(9).fill({ wch: 10 }));
    XLSX.utils.book_append_sheet(wb, wl, 'Lab analysis');
    return wb;
  }
  function csv() {
    var q = function (v) { v = v == null ? '' : String(v); return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    return [HEAD].concat(rows()).map(function (r) { return r.map(q).join(','); }).join('\r\n');
  }

  /* ---------- reading a file */
  function norm(s) { return M.norm(s); }
  function parse(wb) {
    var all = entries(), byKey = {}; all.forEach(function (e) { byKey[e.key] = e; });
    var inRows = {}; M.SECTIONS.forEach(function (s) { s.rows.forEach(function (r) { if (!s.grid) inRows[r[0]] = r; }); });
    var found = [], seen = {}, unmatched = [];
    function push(key, v, name) {
      if (seen[key]) return; seen[key] = 1;
      var e = byKey[key];
      if (!e && /^fi\./.test(key)) { var k = key.slice(3), r = inRows[k]; if (r && r[8]) return; e = { page: 'Furnace 3D view', sec: '', key: key, label: r ? r[1] : k, unit: r ? r[2] : '', v: null }; }
      if (!e && /^calc\.mx\.\d+\.\d$/.test(key)) e = { page: 'Burden calculator', sec: 'Charging matrix', key: key, label: key.replace('calc.mx.', 'Ring ').replace(/\.(\d)$/, function (_, j) { return ' ' + ['coke angle', 'coke revolutions', 'metallics angle', 'metallics revolutions'][j]; }), unit: '', v: null };
      if (!e && /^chem\.p\.(blastVol|o2Flow)$/.test(key)) return;
      if (!e) { unmatched.push(name || key); return; }
      found.push({ e: e, v: v });
    }
    wb.SheetNames.forEach(function (sn) {
      var R = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: true, defval: null });
      var hi = -1, cK = -1, cP = -1, cV = -1, cM = -1;
      for (var r = 0; r < Math.min(R.length, 15) && hi < 0; r++) {
        (R[r] || []).forEach(function (c, i) { var n = norm(c); if (n === 'key') cK = i; if (/^(inputparameter|parameter)$/.test(n)) cP = i; if (/^(value|plantmeasuredvalue|measuredvalue|plantvalue|actual)$/.test(n)) cV = i; if (n === 'material') cM = i; });
        if (cV >= 0 && (cK >= 0 || cP >= 0)) hi = r; else { cK = cP = cV = cM = -1; }
      }
      if (hi < 0) return;
      for (r = hi + 1; r < R.length; r++) {
        var row = R[r] || [], v = row[cV]; if (typeof v === 'string') v = v.trim() === '' ? null : parseFloat(v.replace(',', '.'));
        if (!isNum(v)) continue;
        var key = cK >= 0 && row[cK] ? String(row[cK]).trim() : null;
        if (key && /^(chem|calc|fi)\./.test(key)) { push(key, v, row[cP]); continue; }
        if (key && M.SECTIONS.some(function (s) { return s.rows.some(function (q) { return q[0] === key; }); }) || (key && /^(prd|tl|tr|ta|t|tt)\d+$/.test(key))) { push('fi.' + key, v, row[cP]); continue; }
        var mk = M.matchParam(cM >= 0 ? row[cM] : sn, row[cP]);
        if (mk) push('fi.' + mk, v, (cM >= 0 && row[cM] ? row[cM] + ' · ' : '') + row[cP]); else unmatched.push((cM >= 0 && row[cM] ? row[cM] + ' · ' : '') + row[cP]);
      }
    });
    // lab analyses in the lab-report layout: Batch chemistry reads those itself
    var lab = 0;
    try { var p = E.parseWorkbook(wb, 'data', { mode: 'LATEST' }); lab = Object.keys(p.rows).filter(function (k) { return E.hasData(p.rows[k]); }).length; } catch (e) { }
    return { found: found, unmatched: unmatched, lab: lab };
  }
  function apply(list) {
    var S = null, IN = null, ST = null, n = { chem: 0, calc: 0, fi: 0 };
    list.forEach(function (x) {
      var k = x.e.key, v = x.v, m;
      if ((m = /^chem\.qty\.(\w+)$/.exec(k))) { S = S || chemLoad(); var i = E.IDX[m[1]]; if (i != null) { S.qty[i] = v; n.chem++; } }
      else if ((m = /^chem\.p\.(\w+)$/.exec(k))) { S = S || chemLoad(); S.params[m[1]] = v; n.chem++; }
      else if ((m = /^calc\.f\.(\w+)$/.exec(k))) { IN = IN || calcLoad(); IN.f[m[1]] = v; n.calc++; }
      else if ((m = /^calc\.(mps|moist)\.(\w+)$/.exec(k))) { IN = IN || calcLoad(); IN[m[1]][m[2]] = v; n.calc++; }
      else if ((m = /^calc\.props\.(\w+)\.(\d)$/.exec(k))) { IN = IN || calcLoad(); IN.props[m[1]] = (IN.props[m[1]] || CD.props[m[1]]).slice(); IN.props[m[1]][+m[2]] = v; n.calc++; }
      else if ((m = /^calc\.mx\.(\d+)\.(\d)$/.exec(k))) { IN = IN || calcLoad(); var ri = +m[1] - 1; while (IN.mx.length <= ri) IN.mx.push([null, 0, null, 0]); IN.mx[ri] = IN.mx[ri].slice(); IN.mx[ri][+m[2]] = v; n.calc++; }
      else if ((m = /^fi\.(\w+)$/.exec(k))) { ST = ST || (rd(INK) || {}); ST.v = ST.v || {}; ST.man = ST.man || {}; ST.v[m[1]] = v; n.fi++; }
    });
    // the calculator blast and oxygen also feed the Batch chemistry production from oxygen (one input, two pages)
    if (IN) { S = S || chemLoad(); S.params.blastVol = (+IN.f.BV || 0) + (+IN.f.O2 || 0) / 60; S.params.o2Flow = +IN.f.O2 || 0; }
    if (S) chemSave(S); if (IN) wr(CALCK, IN); if (ST) wr(INK, ST);
    return n;
  }
  function coverage() {
    var L = entries(), pages = {};
    L.forEach(function (e) { var p = pages[e.page] = pages[e.page] || { n: 0, filled: 0, ess: 0, essFilled: 0 }; p.n++; if (e.v != null) p.filled++; if (!e.opt) { p.ess++; if (e.v != null) p.essFilled++; } });
    return pages;
  }
  window.BFData = { entries: entries, workbook: workbook, csv: csv, parse: parse, apply: apply, coverage: coverage, linkOn: linkOn };
})();
