/* Report page: the batch chemistry results (worked out here with engine.js, the same way as the chemistry Results tab)
   and the burden calculator results (the calculator page is opened hidden to recalculate; it leaves a snapshot in
   localStorage) on one printable sheet. A parameter that both parts have is shown once. Download as PDF; the Pay
   button and the download lock are set in pay-config.js. */
(function () {
  'use strict';
  var E = window.BurdenEngine, KEY = 'sspl_bf_burden_v1', SNAP = 'bf-calc-snapshot';
  var VER = window.BF_APP_VERSION || '';
  var $ = function (id) { return document.getElementById(id); };
  var isNum = function (x) { return typeof x === 'number' && isFinite(x); };
  function f(x, d) { return isNum(x) ? x.toFixed(d === undefined ? 2 : d) : '–'; }
  function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function toast(msg) { var t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(function () { t.classList.remove('show'); }, 3200); }
  function two(n) { return ('0' + n).slice(-2); }
  function stamp(d) { return d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate()) + ' ' + two(d.getHours()) + ':' + two(d.getMinutes()); }

  /* ---------- page navigation, same strip as the other pages */
  var NAV = [['index.html', '‹ Home'], ['data-input.html', 'Data input'], ['chemistry.html', 'Batch chemistry'], ['calculator.html', 'Burden calculator'], ['simulator.html', '3D distribution'], ['furnace-inside.html', 'Furnace 3D view'], ['report.html', 'Report'], ['materials.html', 'Fact must know'], ['feedback.html', 'Feedback & suggestion'], ['charging-modes.html', 'Other charging modes']];
  $('nav').innerHTML = NAV.map(function (n) { return '<a href="' + n[0] + '"' + (n[0] === 'report.html' ? ' class="on" aria-current="page"' : '') + '>' + n[1] + '</a>'; }).join('');

  /* ---------- chemistry part: same loading rules as chem.js */
  function revive(txt) {
    return JSON.parse(txt, function (k, v) {
      if (v && typeof v === 'object' && typeof v.__d === 'string') { var p = v.__d.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
      return v;
    });
  }
  function chemState() {
    var st = null;
    try { var t = localStorage.getItem(KEY); if (t) st = revive(t); } catch (e) { }
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
  function chem() {
    var S = chemState();
    if (S.charge && S.charge.on) E.applyCharge(S);
    var rv = E.review(S), R = E.burden(S, rv);
    return { S: S, rv: rv, R: R, A: E.actualSlag(S) || {}, cc: E.chargeChecks(S.charge), fresh: !(S.lab.uploads || []).length };
  }
  function snapshot() { try { return JSON.parse(localStorage.getItem(SNAP) || 'null'); } catch (e) { return null; } }

  /* ---------- building blocks */
  function fig(label, val, unit, sub) { return '<div class="fig"><span>' + label + '</span><b>' + val + (unit ? '<small>' + unit + '</small>' : '') + '</b>' + (sub ? '<i>' + sub + '</i>' : '') + '</div>'; }
  function head(n, title, from) { return '<div class="sh"><span class="n">' + n + '</span><h2>' + title + '</h2>' + (from ? '<span class="from">' + from + '</span>' : '') + '</div>'; }
  function table(cols, rows) {
    return '<div class="tw"><table><thead><tr>' + cols.map(function (c) { return '<th>' + c + '</th>'; }).join('') + '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
  }
  function tr(cells, cls) { return '<tr' + (cls ? ' class="' + cls + '"' : '') + '>' + cells.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>'; }
  function lab(name, unit) { return esc(name) + (unit ? '<small>' + unit + '</small>' : ''); }
  // A parameter that both parts carry is shown once; if the two values differ, both are given in the same row
  function shared(a, b, d) {
    if (!isNum(b) || (isNum(a) && Math.abs(a - b) < Math.pow(10, -d) / 2 + 1e-9)) return f(isNum(a) ? a : b, d);
    if (!isNum(a)) return f(b, d);
    return f(a, d) + ' <small>chem.</small> · ' + f(b, d) + ' <small>calc.</small> <span class="chip">differ</span>';
  }

  /* ---------- Fe-bearing ratio: sinter, pellet, ore, and any other Fe-bearing material by its name */
  var COLORS = { SINTER: '#c4622d', PELLET: '#6d4c9f', ORE: '#2f62a8', other: ['#1f8a5b', '#b8860b', '#8a7f76', '#2a9db0'] };
  function ratio(C) {
    var q = C.S.qty, I = E.IDX, kg = function (k) { return +q[I[k]] || 0; }, name = function (k) { return E.MATERIALS[I[k]].name; };
    var parts = [{ key: 'SINTER', name: 'Sinter', kg: kg('SINTER') }, { key: 'PELLET', name: 'Pellet', kg: kg('PELLET') }, { key: 'ORE', name: 'Ore', kg: kg('TATA') + kg('APHATU'), sub: [name('TATA'), name('APHATU')] }];
    var oi = 0;
    E.MATERIALS.forEach(function (m) {
      if (m.group !== 'Ferrous' || ['SINTER', 'PELLET', 'TATA', 'APHATU'].indexOf(m.key) >= 0) return;
      if (kg(m.key) > 0) parts.push({ key: m.key, name: m.name, kg: kg(m.key), other: true, color: COLORS.other[oi++ % 4] });
    });
    var tot = parts.reduce(function (s, p) { return s + p.kg; }, 0);
    parts.forEach(function (p) { p.pct = tot ? p.kg / tot * 100 : 0; p.color = p.color || COLORS[p.key]; });
    return { parts: parts, tot: tot };
  }

  /* ---------- top view of the throat: where every chute ring lands (coke left half, metallics right half) */
  function ringDiagram(s) {
    var R = s.R, c = 160, k = 132 / R, h = [];
    h.push('<svg viewBox="0 0 320 344" role="img" aria-label="Top view of the throat with the landing radius of each chute ring">');
    h.push('<circle cx="160" cy="160" r="' + (R * k) + '" fill="#eef2f7" stroke="#16181b" stroke-width="2"/>');
    h.push('<circle cx="160" cy="160" r="' + (0.75 * R * k) + '" fill="#f6f4f0" stroke="#d8d2c8" stroke-dasharray="3 3"/>');
    h.push('<circle cx="160" cy="160" r="' + (0.4 * R * k) + '" fill="#fbf9f6" stroke="#d8d2c8" stroke-dasharray="3 3"/>');
    h.push('<line x1="160" y1="22" x2="160" y2="298" stroke="#16181b" stroke-width="1" stroke-dasharray="2 4"/>');
    var maxRev = Math.max.apply(null, s.rings.map(function (r) { return r.revs; }).concat([1]));
    s.rings.forEach(function (r) {
      var rr = Math.max(2, r.r * k), w = 2 + 5 * r.revs / maxRev, coke = r.mat === 'coke';
      h.push('<path d="M160 ' + (c - rr).toFixed(1) + ' A' + rr.toFixed(1) + ' ' + rr.toFixed(1) + ' 0 0 ' + (coke ? 0 : 1) + ' 160 ' + (c + rr).toFixed(1) + '" fill="none" stroke="' + (coke ? '#2f62a8' : '#c4622d') + '" stroke-width="' + w.toFixed(1) + '" stroke-opacity=".85"/>');
      var th = (r.ring % 2 ? -1 : 1) * (6 + 6 * (r.ring % 3)) * Math.PI / 180, lx = c + (coke ? -1 : 1) * rr * Math.cos(th), ly = c + rr * Math.sin(th) + 3;
      h.push('<text x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" text-anchor="middle" font-size="9" font-weight="600" fill="#fff" stroke="' + (coke ? '#2f62a8' : '#c4622d') + '" stroke-width="3" paint-order="stroke">' + r.ring + '</text>');
    });
    h.push('<text x="80" y="318" text-anchor="middle" font-size="12" font-weight="600" fill="#2f62a8">COKE</text><text x="240" y="318" text-anchor="middle" font-size="12" font-weight="600" fill="#c4622d">METALLICS</text>');
    h.push('<text x="160" y="338" text-anchor="middle" font-size="10.5" fill="#5d636b">Throat Ø ' + f(2 * R, 2) + ' m · line width = revolutions · number = ring</text>');
    h.push('</svg>');
    return '<div class="diagram">' + h.join('') + '</div>';
  }

  /* ---------- O/C across the throat */
  function ocChart(s) {
    var W = 860, H = 280, m = { l: 40, r: 12, t: 16, b: 32 }, R = s.R, rd = s.radial;
    var fin = rd.oc.filter(isNum), yMax = Math.ceil(Math.max(6, Math.max.apply(null, fin.concat([0])) * 1.1));
    var x = function (r) { return m.l + r / R * (W - m.l - m.r); }, y = function (v) { return H - m.b - v / yMax * (H - m.t - m.b); };
    var h = ['<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Ore to coke ratio by radius">'];
    [[0, .4, 'Centre'], [.4, .75, 'Intermediate'], [.75, 1, 'Wall']].forEach(function (z, i) {
      if (i === 1) h.push('<rect x="' + x(z[0] * R) + '" y="' + m.t + '" width="' + (x(z[1] * R) - x(z[0] * R)) + '" height="' + (H - m.t - m.b) + '" fill="#f6f4f0"/>');
      h.push('<text x="' + ((x(z[0] * R) + x(z[1] * R)) / 2) + '" y="' + (m.t + 11) + '" text-anchor="middle">' + z[2] + '</text>');
    });
    for (var k = 0; k <= 4; k++) { var v = yMax * k / 4; h.push('<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="#e3ddd3"/><text x="' + (m.l - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + v.toFixed(1) + '</text>'); }
    for (var r = 0; r <= R + 1e-9; r += R > 3 ? 1 : 0.5) h.push('<text x="' + x(r) + '" y="' + (H - m.b + 15) + '" text-anchor="middle">' + r.toFixed(1) + '</text>');
    h.push('<text x="' + (W - m.r) + '" y="' + (H - 3) + '" text-anchor="end">Radius from furnace axis (m)</text>');
    if (isNum(s.ocAvg)) h.push('<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y(s.ocAvg) + '" y2="' + y(s.ocAvg) + '" stroke="#5d636b" stroke-dasharray="4 4"/><text x="' + (W - m.r) + '" y="' + (y(s.ocAvg) - 5) + '" text-anchor="end">Charge average ' + f(s.ocAvg, 2) + '</text>');
    var seg = [], segs = [];
    rd.oc.forEach(function (v, i) { if (isNum(v)) seg.push([x(rd.mid[i]), y(v)]); else { if (seg.length) segs.push(seg); seg = []; } if (v === 'ore') h.push('<rect x="' + (x(rd.mid[i]) - 6) + '" y="' + (m.t + 16) + '" width="12" height="6" rx="2" fill="#c4622d"/>'); });
    if (seg.length) segs.push(seg);
    segs.forEach(function (sg) {
      h.push('<path d="' + sg.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ') + '" fill="none" stroke="#c2410c" stroke-width="2.4"/>');
      sg.forEach(function (p) { h.push('<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="2.6" fill="#c2410c"/>'); });
    });
    h.push('</svg>');
    return '<div class="chart">' + h.join('') + '</div>';
  }

  /* ---------- short technical suggestions: [level, topic, text]; level hi = act, md = watch */
  function suggestions(C, s, rt) {
    var R = C.R, P = Object.assign({}, E.PARAMS_DEFAULT, C.S.params), out = [];
    var add = function (lv, tg, t) { out.push([lv, tg, t]); };
    if (R.b2 < 1.0) add('hi', 'Slag', 'B2 is ' + f(R.b2, 2) + ', below about 1.0: sulphur goes to the hot metal. Add limestone or dolomite, or cut quartzite.');
    else if (R.b2 > 1.25) add('hi', 'Slag', 'B2 is ' + f(R.b2, 2) + ', above about 1.25: the slag gets short and viscous. Cut limestone or add quartzite.');
    if (R.al2o3 > 18) add('hi', 'Slag', 'Al₂O₃ in slag is ' + f(R.al2o3, 1) + ' %: keep MgO at 8–10 % and use lower-alumina ore or pellet to hold slag fluidity.');
    if (R.mgoAl < 0.45) add('md', 'Slag', 'MgO/Al₂O₃ is ' + f(R.mgoAl, 2) + ': bring it to 0.5–0.7 with dolomite or pyroxenite for better slag fluidity and desulphurisation.');
    else if (R.mgo > 11) add('md', 'Slag', 'MgO in slag is ' + f(R.mgo, 1) + ' %: above about 11 % it raises the liquidus. Cut dolomite.');
    if (R.slagRate > 350) add('md', 'Burden', 'Slag rate ' + f(R.slagRate, 0) + ' kg/tHM is high: each 10 kg/tHM less slag saves roughly 3–4 kg coke/tHM. Raise the pellet or high-Fe ore share.');
    if (R.avgFe < 56) add('md', 'Burden', 'Average burden Fe is ' + f(R.avgFe, 1) + ' %: a lower-grade burden means more slag and fuel.');
    if (R.fuel > 550) add('hi', 'Fuel', 'Fuel rate ' + f(R.fuel, 0) + ' kg/tHM is high: check coke CSR and ash, burden fines below 5 mm, and the gas distribution (O/C in the centre and at the wall).');
    if (R.dri > 40) add('md', 'Fuel', 'Direct reduction degree ' + f(R.dri, 0) + ' % is high: better indirect reduction (sinter and pellet reducibility, even gas flow in the stack) lowers the coke rate.');
    if (P.si > 0.8) add('md', 'Thermal', 'Si in HM setting ' + f(P.si, 2) + ' %: a hot furnace. Each 0.1 % Si less saves about 4–5 kg fuel/tHM once operation is stable.');
    if (R.alkLoad > 3) add('hi', 'Burden', 'Alkali load ' + f(R.alkLoad, 2) + ' kg/tHM is above about 3: alkalis weaken coke and build scaffolds. Run a lower-B2 slag for some casts to flush them.');
    if (R.sLoad > 5) add('md', 'Burden', 'Sulphur load ' + f(R.sLoad, 1) + ' kg/tHM is high: keep B2 and slag volume up, or use lower-S coke and coal.');
    if (R.prodCharges > 0 && R.prodO2 > 0 && Math.abs(R.prodO2 / R.prodCharges - 1) > 0.08) add('md', 'Production', 'The two production methods differ by ' + f(Math.abs(R.prodO2 / R.prodCharges - 1) * 100, 0) + ' %: check blast volume and oxygen metering and the charge weights.');
    var pp = {}; rt.parts.forEach(function (x) { pp[x.key] = x.pct; });
    if (pp.PELLET > 30) add('md', 'Burden', 'Pellet is ' + f(pp.PELLET, 0) + ' % of the Fe burden: watch swelling (RSI below 20 %) and keep pellets out of the centre so they do not roll in.');
    if (pp.ORE > 20) add('md', 'Burden', 'Lump ore is ' + f(pp.ORE, 0) + ' % of the Fe burden: screen out fines and watch decrepitation in the upper stack.');
    if (s) {
      var z = {}; s.zones.forEach(function (x) { z[x.name] = x.oc; });
      if (isNum(z.Centre) && isNum(s.ocAvg) && z.Centre > s.ocAvg) add('hi', 'Distribution', 'O/C in the centre (' + f(z.Centre, 2) + ') is above the charge average: the central gas flow is closed. Move coke inward (more revolutions at the inner coke angles) or metallics outward.');
      if (z.Wall === 'ore') add('hi', 'Distribution', 'There is ore with no coke under it at the wall. Open the wall with a coke ring there.');
      else if (isNum(z.Wall) && isNum(s.ocAvg) && z.Wall < 0.8 * s.ocAvg) add('md', 'Distribution', 'O/C at the wall (' + f(z.Wall, 2) + ') is well below the average: strong peripheral gas and heat loss. Shift metallics outward (a higher outer metallics angle or more revolutions).');
      var walls = s.rings.filter(function (r) { return r.flag === 'Wall'; });
      if (walls.length) add('md', 'Matrix', 'Ring ' + walls.map(function (r) { return r.ring + ' (' + (r.mat === 'coke' ? 'coke ' : 'ore ') + r.a + '°)'; }).join(', ') + ' hits the wall: lower that angle by 1–2° to protect the wall lining.');
      var cl = (s.levels || [])[0];
      if (cl && cl.c < 400) add('md', 'Distribution', 'The coke layer at the throat is ' + f(cl.c, 0) + ' mm: below about 400 mm the coke slits in the cohesive zone get thin. A larger coke base helps permeability.');
      if (s.gas && s.gas.u > 2) add('md', 'Gas', 'Gas velocity above the burden is ' + f(s.gas.u, 2) + ' m/s: fines and small pellets get carried; screen the burden well.');
    }
    return out;
  }

  /* ---------- the report */
  var reportNo = '', current = null;
  function render(snap, snapNote) {
    var C = chem(), S = C.S, R = C.R, A = C.A, P = Object.assign({}, E.PARAMS_DEFAULT, S.params), s = snap && snap.rings ? snap : null;
    var now = new Date(); reportNo = 'BFR-' + now.getFullYear() + two(now.getMonth() + 1) + two(now.getDate()) + '-' + two(now.getHours()) + two(now.getMinutes());
    current = { C: C, s: s };
    var u = window.BFAuth && BFAuth.user ? BFAuth.user() : null;
    $('meta').innerHTML = 'REPORT <b>' + reportNo + '</b><br>' + stamp(now) + '<br>BF MODEL ' + esc(VER);
    $('footL').textContent = 'BF MODEL ' + VER + ' · ' + reportNo;
    $('who').innerHTML = (u ? '<span>Prepared for <b>' + esc(u.name || u.loginId) + '</b>' + (u.company ? ', ' + esc(u.company) : '') + '</span>' : '') +
      '<span>Lab analysis <b>' + (C.fresh ? 'standard example analyses' : esc((S.lab.files || []).slice(-3).join(', ') || 'uploaded reports')) + '</b></span>' +
      '<span>Charge <b>' + (S.charge && S.charge.on ? 'charge mix' : 'kg per charge') + ', ' + String(S.params.basis || 'WET').toLowerCase() + ' basis</b></span>' +
      '<span>Calculator <b>' + (s ? (s.mode === 'extended' ? 'extended' : 'first-order') + ' model, ' + stamp(new Date(s.at)) : 'not calculated') + '</b>' + (snapNote ? ' ' + snapNote : '') + '</span>';

    var h = [];
    /* key figures */
    var rt = ratio(C);
    h.push('<section><div class="hero">' +
      fig('Production', f(R.prodCharges, 0), 't/day', 'From charges per hour; ' + (R.prodO2 > 0 ? f(R.prodO2, 0) + ' t/day from oxygen' : 'oxygen method –')) +
      fig('Hot metal per charge', f(R.hm / 1000, 2), 't', 'Slag ' + f(R.slag / 1000, 2) + ' t per charge') +
      fig('Fuel rate', f(R.fuel, 0), 'kg/tHM', 'Coke ' + f(R.cokeDry, 0) + ' + NC ' + f(R.ncDry, 0) + ' + PCI ' + f(R.coal, 0)) +
      fig('Slag rate', f(R.slagRate, 0), 'kg/tHM') +
      fig('Basicity B2', f(R.b2, 3), '', isNum(A.b2) ? 'Actual ' + f(A.b2, 3) : 'B3 ' + f(R.b3, 3)) +
      fig('Ore / coke', f(R.oc, 2), 'wet', s && isNum(s.ocExNC) ? f(s.ocExNC, 2) + ' dry, excl. nut coke' : '') +
      fig('Sinter : pellet : ore', rt.parts.slice(0, 3).map(function (p) { return f(p.pct, 0); }).join(' : '), '', rt.parts.length > 3 ? '+ ' + rt.parts.slice(3).map(function (p) { return esc(p.name) + ' ' + f(p.pct, 0) + '%'; }).join(', ') : 'of Fe-bearing burden') +
      (s && s.gas ? fig('Gas above burden', f(s.gas.u, 2), 'm/s', 'Bosh gas ' + f(s.gas.Qn, 0) + ' Nm³/min') : fig('Direct reduction', f(R.dri, 1), '%', 'Rist W point')) +
      '</div></section>');

    /* 01 burden ratio and charge */
    var q = S.qty, I = E.IDX, kg = function (k) { return +q[I[k]] || 0; };
    var big = rt.parts.map(function (p) { return '<span style="color:' + p.color + '">' + esc(p.name) + ' ' + f(p.pct, 1) + '</span>'; }).join('<em>:</em>');
    var rows = [tr(['Fe-bearing burden', '', f(rt.tot, 0), f(rt.tot / R.hm * 1000, 1)], 'grp')];
    rt.parts.forEach(function (p) { rows.push(tr(['<i style="display:inline-block;width:9px;height:9px;border-radius:2px;background:' + p.color + ';margin-right:6px"></i>' + esc(p.name) + (p.sub && p.kg > 0 ? '<small>' + p.sub.filter(function (n, i) { return kg(['TATA', 'APHATU'][i]) > 0; }).map(esc).join(', ') + '</small>' : ''), f(p.pct, 2), f(p.kg, 0), f(p.kg / R.hm * 1000, 1)])); });
    var flux = E.FLUXES.filter(function (x) { return kg(x[0]) > 0; });
    if (flux.length) { rows.push(tr(['Flux', '', '', ''], 'grp')); flux.forEach(function (x) { rows.push(tr([esc(x[1]), '', f(kg(x[0]), 0), f(kg(x[0]) / R.hm * 1000, 1)])); }); }
    var cokeTot = ['COKE1', 'COKE2', 'COKE3', 'COKE4'].reduce(function (a, k) { return a + kg(k); }, 0);
    rows.push(tr(['Coke', '', f(cokeTot, 0), f(cokeTot / R.hm * 1000, 1)], 'grp'));
    ['COKE1', 'COKE2', 'COKE3', 'COKE4'].forEach(function (k) { if (kg(k) > 0) rows.push(tr([esc(E.MATERIALS[I[k]].name), f(kg(k) / cokeTot * 100, 2), f(kg(k), 0), f(kg(k) / R.hm * 1000, 1)])); });
    rows.push(tr(['Nut coke and injection', '', '', ''], 'grp'));
    rows.push(tr(['Nut coke', '', f(kg('NUT'), 0), f(kg('NUT') / R.hm * 1000, 1)]));
    rows.push(tr(['PCI coal', '', f(kg('COAL'), 0), f(R.coal, 1)]));
    h.push('<section>' + head('01', 'Burden ratio and charge', 'Batch chemistry · wet kg per charge') +
      '<div class="ratio"><div class="big">' + big + '</div><div class="stack">' + rt.parts.filter(function (p) { return p.pct > 0; }).map(function (p) { return '<i style="width:' + p.pct + '%;background:' + p.color + '" title="' + esc(p.name) + '"></i>'; }).join('') + '</div>' +
      '<div class="legend">' + rt.parts.map(function (p) { return '<span><i style="background:' + p.color + '"></i>' + esc(p.name) + ' ' + f(p.kg, 0) + ' kg</span>'; }).join('') + '</div></div>' +
      '<div style="margin-top:12px">' + table(['Material', '%', 'kg/charge', 'kg/tHM'], rows) + '</div></section>');

    /* 02 slag and hot metal */
    var sl = [['CaO', R.cao, 2, A.SL_CAO, '%'], ['SiO₂', R.sio2, 2, A.SL_SIO2, '%'], ['Al₂O₃', R.al2o3, 2, A.SL_AL2O3, '%'], ['MgO', R.mgo, 2, A.SL_MGO, '%'],
      ['B2 CaO/SiO₂', R.b2, 3, A.b2, ''], ['B3 (CaO+MgO)/SiO₂', R.b3, 3, A.b3, ''], ['B4 (CaO+MgO)/(SiO₂+Al₂O₃)', R.b4, 3, null, ''], ['MgO/Al₂O₃', R.mgoAl, 3, A.mgoAl, ''], ['Bosh basicity', R.bosh, 3, null, '']];
    var hm = [['Si in HM (setting)', S.params.si, 2, A.HM_SI, '%'], ['Fe in HM (setting)', S.params.feHM, 2, A.HM_FE, '%'], ['C in HM (setting)', P.hmC, 2, null, '%'], ['Mn in HM', R.mnPct, 3, null, '%'], ['P in HM', R.pPct, 3, null, '%'],
      ['Slag per charge', R.slag / 1000, 3, null, 't'], ['Slag rate', R.slagRate, 1, null, 'kg/tHM']];
    var row3 = function (x) { return tr([lab(x[0], x[4]), '<b>' + f(x[1], x[2]) + '</b>', f(x[3], x[2])]); };
    h.push('<section>' + head('02', 'Output slag and hot metal', 'Batch chemistry') + '<div class="two"><div><h3>Slag chemistry</h3>' + table(['Parameter', 'Calculated', 'Actual'], sl.map(row3)) +
      '</div><div><h3>Hot metal and slag volume</h3>' + table(['Parameter', 'Calculated', 'Actual'], hm.map(row3)) + '</div></div></section>');

    /* 03 rates and loads */
    var ra = [['Coke rate, dry (excl. nut coke)', R.cokeDry, 1, 'kg/tHM'], ['Coke rate, wet', R.cokeWet, 1, 'kg/tHM'], ['Nut coke, dry', R.ncDry, 1, 'kg/tHM'], ['PCI coal', R.coal, 1, 'kg/tHM'], ['Fuel rate', R.fuel, 1, 'kg/tHM'],
      ['Carbon rate (fixed carbon)', R.cRate, 1, 'kg/tHM'], ['Fe/C', R.feC, 3, '']];
    var lo = [['Fe-bearing rate, wet', R.feBearing, 0, 'kg/tHM'], ['Average burden Fe', R.avgFe, 2, '%'], ['Metallic yield', R.yield, 2, '%'], ['Flux rate', R.flux, 1, 'kg/tHM'],
      ['Al₂O₃ load', R.al2o3Load, 1, 'kg/tHM'], ['Alkali load', R.alkLoad, 2, 'kg/tHM'], ['Sulphur load', R.sLoad, 2, 'kg/tHM']];
    var row2 = function (x) { return tr([lab(x[0], x[3]), '<b>' + f(x[1], x[2]) + '</b>']); };
    h.push('<section>' + head('03', 'Fuel rates and loads', 'Batch chemistry') + '<div class="two"><div>' + table(['Fuel', 'Value'], ra.map(row2)) + '</div><div>' + table(['Burden', 'Value'], lo.map(row2)) + '</div></div></section>');

    /* 04 production, oxygen and furnace operation (blast volume and oxygen are in both parts: shown once) */
    var pr = [['Production from charges per hour', R.prodCharges, 0, 't/day'], ['Production from oxygen', R.prodO2 > 0 ? R.prodO2 : null, 0, 't/day'], ['Hot metal per hour (charges)', R.hmChargesH, 1, 't/h'],
      ['Hot metal per hour (oxygen)', R.hmO2H, 1, 't/h'], ['Total oxygen to the tuyeres', R.o2Total, 0, 'Nm³/h'], ['Oxygen per tonne HM', R.o2Spec, 0, 'Nm³/tHM'], ['Carbon burnt at the tuyeres', R.cTuyere, 1, 'kg/tHM'],
      ['Direct reduction degree (Rist)', R.dri, 1, '%']];
    var sf = s ? s.f : {};
    var op = [tr([lab('Blast volume incl. oxygen', 'Nm³/min'), shared(P.blastVol, sf.BV, 0)]), tr([lab('Oxygen enrichment', 'Nm³/h'), shared(P.o2Flow, sf.O2, 0)]),
      tr([lab('Oxygen purity', '%'), f(P.o2Purity, 1)]), tr([lab('Blast moisture', 'g/Nm³'), f(P.blastMoist, 1)]), tr([lab('Charges per hour', ''), f(P.chPerHour, 1)]), tr([lab('Fe recovery', '%'), f(P.feRec, 1)])];
    if (s) op.push(tr([lab('Top pressure', 'kg/cm² g'), f(sf.TP, 2)]), tr([lab('Blast pressure', 'kg/cm² g'), f(sf.BP, 2)]), tr([lab('Top gas temperature', '°C'), f(sf.Ttop, 0)]));
    h.push('<section>' + head('04', 'Production and furnace operation', 'Batch chemistry · calculator') + '<div class="two"><div>' + table(['Production', 'Value'], pr.map(row2)) +
      '</div><div>' + table(['Operating input', 'Value'], op) + '<p class="cap">Inputs that both parts use are listed once. If the two pages hold different values, both are shown.</p></div></div></section>');

    /* 05 charging matrix and 06 distribution: from the burden calculator */
    if (!s) {
      h.push('<section>' + head('05', 'Charging matrix and distribution', 'Burden calculator') + '<div class="empty">The burden calculator has no results yet. Open the <a href="calculator.html">Burden calculator</a>, fill every input and press Calculate, then come back to this page.</div></section>');
    } else {
      var land = {}; s.rings.forEach(function (r) { land[r.mat + r.ring] = r; });
      var L = function (mat, i) { var r = land[mat + (i + 1)]; return r ? f(r.r, 2) + (r.flag === 'Wall' ? '<small>wall</small>' : '') : '–'; };
      var mrows = s.mx.map(function (r, i) { return tr([String(i + 1), f(r[0], 1), f(r[1], 0), L('coke', i), f(r[2], 1), f(r[3], 0), L('ore', i)]); });
      var sc = s.mx.reduce(function (a, r) { return a + (+r[1] || 0); }, 0), so = s.mx.reduce(function (a, r) { return a + (+r[3] || 0); }, 0);
      mrows.push(tr(['Total', '', String(sc), '', '', String(so), ''], 'tot'));
      h.push('<section>' + head('05', 'Charging matrix', 'Burden calculator · section 4') + '<div class="two mx"><div>' +
        table(['Ring', 'Coke angle °', 'Coke rev', 'Lands m', 'Metallics angle °', 'Metallics rev', 'Lands m'], mrows) +
        '<p class="cap">Tilt order ' + (s.order === 'out' ? 'outer → inner' : 'inner → outer') + ' · ' + (s.mode === 'extended' ? 'extended (rotating chute)' : 'first-order (flat stockline)') + ' model · ' + f(s.pre, 0) + ' charges before the reported one · chute ' + f(sf.rpm, 1) + ' r/min, length ' + f(sf.L, 2) + ' m · stockline ' + f(sf.stock, 2) + ' m. Lands = landing radius from the furnace axis.</p>' +
        '</div><div>' + ringDiagram(s) + '</div></div></section>');

      // the calculator's result tiles, less the ones already shown above
      var skip = /Ore\/coke|Gas velocity|Bosh gas/;
      var tiles = s.tiles.filter(function (t) { return !skip.test(t[0]); });
      var zr = s.zones.map(function (z) { return tr([z.name, f(z.r0, 2) + '–' + f(z.r1, 2), f(z.coke, 1), f(z.ore, 1), z.oc === 'ore' ? 'ore only' : f(z.oc, 2)]); });
      var lv = (s.levels || []).map(function (l) { return tr([esc(l.name), f(l.d, 1), f(l.D, 2), f(l.c, 0), f(l.o, 0)]); });
      h.push('<section class="long">' + head('06', 'Burden distribution', 'Burden calculator') +
        '<div class="hero" style="margin-bottom:14px">' + tiles.map(function (t) { var m = String(t[1]).match(/^(\S+)\s*(.*)$/); return fig(esc(t[0]), esc(m ? m[1] : t[1]), esc(m ? m[2] : '')); }).join('') + '</div>' +
        '<h3>Ore / coke by radius</h3>' + ocChart(s) +
        '<div class="two" style="margin-top:12px"><div><h3>By zone</h3>' + table(['Zone', 'Radius m', 'Coke %', 'Ore %', 'O/C'], zr) + '</div>' +
        '<div><h3>Layer thickness down the furnace</h3>' + table(['Level', 'Depth m', 'Ø m', 'Coke mm', 'Metallics mm'], lv) + '</div></div></section>');
    }

    /* 07 furnace inside (module 08), from its last calculation */
    var fi = null; try { fi = JSON.parse(localStorage.getItem('bf-inside-snapshot') || 'null'); } catch (e) { }
    if (fi && fi.levels) {
      var fr = fi.levels.map(function (l) { return tr([esc(l.name), f(l.h, 1)].concat(l.gas.map(function (g, k) { return f(g, 0) + ' / ' + f(l.solid[k], 0); }))); });
      var fo = (fi.outputs || []).map(function (x) { return tr([esc(x[0]), typeof x[1] === 'number' ? f(x[1], x[3] === undefined ? 1 : x[3]) : esc(x[1]), esc(x[2])]); });
      h.push('<section>' + head('07', 'Furnace 3D view', 'Furnace 3D view · ' + stamp(new Date(fi.at))) + '<div class="two"><div><h3>Zonal temperatures, gas / burden °C</h3>' +
        table(['Level', 'Height m', 'Wall', 'Intermediate', 'Centre'], fr) + '</div><div><h3>Simulation outputs</h3>' + table(['Output', 'Value', 'Unit'], fo) + '</div></div></section>');
    }

    /* 08 technical suggestions, from the calculated results (rules of thumb) */
    var sg = suggestions(C, s, rt);
    h.push('<section>' + head(fi && fi.levels ? '08' : '07', 'Technical suggestions', 'From the results above') + (sg.length ? '<div class="sugs">' + sg.map(function (x) {
      return '<div class="sug ' + x[0] + '"><span class="tg">' + x[1] + '</span><p>' + x[2] + '</p></div>'; }).join('') + '</div>' : '<div class="okline">All checked values are in the usual range. No change suggested.</div>') +
      '<p class="cap">Rules of thumb from the calculated values; check them against your furnace trends before changing the burden or the matrix.</p></section>');

    /* 08 checks (materials that fall back to standard values are not listed) */
    var al = [];
    if (s) s.alerts.forEach(function (a) { al.push(a); });
    if (S.charge && S.charge.on) C.cc.forEach(function (x) { al.push(x); });
    if (!C.fresh) C.rv.forEach(function (r) {
      var ck = r.checks.filter(function (c) { return !/standard values?$/i.test(c); });
      if (ck.length && +S.qty[r.i] > 0) al.push(r.m.name + ': ' + ck.join(', '));
    });
    h.push('<section>' + head(fi && fi.levels ? '09' : '08', 'Checks and warnings', '') + '<div class="alerts">' + (al.length ? al.map(function (a) { return '<div class="alert">' + esc(a) + '</div>'; }).join('') : '<div class="okline">No warnings.</div>') + '</div></section>');

    $('body').innerHTML = h.join('');
  }

  /* ---------- recalculate the burden calculator in a hidden frame, so the report uses the latest inputs */
  var started = 0, waitT = 0;
  function recalc() {
    started = Date.now();
    var fr = $('calcFrame');
    fr.src = 'calculator.html?report=' + started;
    clearTimeout(waitT);
    waitT = setTimeout(function () { var s = snapshot(); render(s, s ? '(last calculation; the calculator needs every input filled to update)' : ''); }, 9000);
  }
  window.addEventListener('message', function (e) {
    if (!e.data || !e.data.bfCalcSnapshot) return;
    var s = snapshot(); if (!s || s.at < started) return;
    clearTimeout(waitT); render(s, ''); $('calcFrame').src = 'about:blank';
  });
  $('refresh').addEventListener('click', function () { $('body').innerHTML = '<p class="loading">Recalculating…</p>'; recalc(); });

  /* ---------- payment: since 3.1 the whole Report page is paid (paywall.js, pay-config.js); this button shows the subscription */
  function payUi() {
    var st = window.BFPaid && BFPaid.state('report');
    $('pay').querySelector('span').textContent = st && st.until ? 'Paid until ' + st.untilText : 'Subscription';
  }
  $('pay').addEventListener('click', function () { if (window.BFPaid) BFPaid.show('report'); });
  document.addEventListener('bfpaid', payUi);

  /* ---------- download as PDF: desktop saves the file, the phone opens Android's print screen with "Save as PDF" */
  $('download').addEventListener('click', function () {
    if (!current) { toast('The report is still being prepared'); return; }
    var name = 'BF_Model_Report_' + reportNo.slice(4) + '.pdf';
    var used = function () { };
    if (window.bfReport && window.bfReport.savePdf) {
      window.bfReport.savePdf(name).then(function (r) {
        if (r && r.ok) { used(); toast('Saved ' + r.path); } else if (r && r.error) toast('Could not save the PDF: ' + r.error);
      });
    } else if (window.Android && window.Android.printPdf) {
      window.Android.printPdf(name.replace(/\.pdf$/, '')); used();
      toast('Choose "Save as PDF" as the printer, then tap the PDF button');
    } else { window.print(); used(); }
  });

  payUi();
  var s0 = snapshot();
  render(s0, s0 ? '(updating…)' : '');
  recalc();
})();
