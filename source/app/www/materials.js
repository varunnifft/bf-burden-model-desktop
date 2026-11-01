/* Fact must know (was "Material based suggestion"): live 3D degradation model of coke, sinter, pellet and lump ore (three.js r128, bundled in
   lib/), started from this plant's burden: the Batch chemistry analysis (engine.js) and the burden calculator's particle
   sizes. Six lumps: the combined effect of all settings, and one lump per single factor. Indicative, not plant-calibrated. */
(function () {
  'use strict';
  var E = window.BurdenEngine, KEY = 'sspl_bf_burden_v1', CALC = 'bfbm-calculator-v1';
  var $ = function (id) { return document.getElementById(id); };
  var cl = function (v, a, b) { return Math.min(b, Math.max(a, v)); }, F = function (v, d) { return isFinite(v) ? v.toFixed(d === undefined ? 1 : d) : '–'; };
  var isNum = function (x) { return typeof x === 'number' && isFinite(x); };

  /* ---------- page navigation, same strip as the other pages */
  var NAV = [['index.html', '‹ Home'], ['data-input.html', 'Data input'], ['chemistry.html', 'Batch chemistry'], ['calculator.html', 'Burden calculator'], ['simulator.html', '3D distribution'], ['furnace-inside.html', 'Furnace 3D view'], ['report.html', 'Report'], ['materials.html', 'Fact must know'], ['feedback.html', 'Feedback & suggestion'], ['charging-modes.html', 'Other charging modes']];
  $('nav').innerHTML = NAV.map(function (n) { return '<a href="' + n[0] + '"' + (n[0] === 'materials.html' ? ' class="on" aria-current="page"' : '') + '>' + n[1] + '</a>'; }).join('');

  /* ---------- this plant's burden: chemistry state (same loading rules as chem.js) and calculator sizes */
  function revive(txt) {
    return JSON.parse(txt, function (k, v) {
      if (v && typeof v === 'object' && typeof v.__d === 'string') { var p = v.__d.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
      return v;
    });
  }
  function plant() {
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
    if (st.charge && st.charge.on) E.applyCharge(st);
    var rv = E.review(st), I = E.IDX, q = st.qty;
    var kg = function (k) { return +q[I[k]] || 0; }, u = function (k) { return rv[I[k]].used; };
    var fe = kg('SINTER') + kg('PELLET') + kg('TATA') + kg('APHATU') + kg('ACC_COLLER') + kg('PSB_ACC');
    var calc = null; try { calc = JSON.parse(localStorage.getItem(CALC) || 'null'); } catch (e) { }
    var mps = (calc && calc.mps) || {};
    return { S: st, kg: kg, u: u, fe: fe, coke: kg('COKE1') + kg('COKE2') + kg('COKE3') + kg('COKE4'), mps: mps, fresh: !(st.lab.uploads || []).length };
  }
  var PL = plant();

  /* ---------- material models: slider = [min, max, step, label, typical, short name] */
  var M = {
    coke: { n: 'Coke', dot: '#3a3d42', col: [.16, .16, .17], lump: .14, fine: 1,
      f: { cri: [12, 40, 1, 'CRI (%)', 22, 'CRI'], ash: [7, 18, .5, 'Ash (%)', 11, 'Ash'], alk: [0, 1.5, .05, 'Alkali K₂O+Na₂O (%)', .2, 'Alkali'], T: [900, 1500, 10, 'Temperature (°C)', 1100, 'Temp.'], size: [25, 80, 1, 'Mean size (mm)', 50, 'Size'], time: [0, 100, 1, 'Reaction time (%)', 50] },
      rad: function (p, d) { return (.7 + p.size / 150) * (1 - .32 * d); }, grain: function (p) { return (p.ash - 5) / 32; }, tint: function (p) { return [p.alk * .22, p.alk * .12, 0]; },
      note: 'Coke loses carbon by solution loss, so the lump shrinks and its pores widen. CRI, ash and alkali weaken it; alkali (yellow tint) speeds the reaction; ash shows as light grains.',
      calc: function (p) { var CSR = cl(100 - 1.4 * p.cri - .8 * (p.ash - 12) - 8 * p.alk, 20, 85), tf = Math.max(0, (p.T - 900) / 600) + .3;
        var d = cl(p.time / 100 * (p.cri / 22) * (1 + .8 * p.alk) * tf * (1 + (p.ash - 11) * .03) * .75 * (1 + (p.size - 50) / 250), 0, 1);
        var fines = cl(d * (100 - CSR) * .5 * (.7 + p.size / 100), 0, 40);
        return { d: d, fines: fines, CSR: CSR, perm: cl(100 - fines * 3 - (p.size < 35 ? (35 - p.size) * 1.2 : 0) - (p.ash - 11) * 1.2, 0, 100), cr: (p.ash - 11) * 5 + (65 - CSR) * 1.5 + p.alk * 15, m: [['CSR (estimated)', F(CSR) + ' %', CSR < 60]] }; },
      tb: [['Particle size', '45–60 mm (25–80)', 'Keeps "windows" open in the cohesive zone and deadman. Small or fine coke raises ΔP and causes hanging or slips.'],
        ['CRI', '20–28 %', 'High CRI → solution loss, thin pore walls, lower CSR.'], ['CSR', '≥ 62–70 %', 'Best predictor of lower-furnace strength; low CSR → fines, poor permeability, higher coke rate.'],
        ['Ash', '8–12 %', '+1 % ash ≈ +4–6 kg/tHM coke rate, more slag, lower productivity; weakens structure.'],
        ['Alkalis K₂O+Na₂O', '< 0.25–0.30 %', 'Catalyse gasification, drop CSR, cause scaffolds and refractory attack.'],
        ['M40 / M10', 'M40 > 82–88; M10 < 6–8', 'Cold strength, handling breakage, fines at furnace top.'],
        ['Fixed carbon / VM', 'FC > 86 %; VM < 1 %', 'Higher FC → less slag and lower coke rate; high VM = under-coked.'],
        ['Sulphur / P', 'S < 0.6–0.8 %; P < 0.05 %', 'Coke supplies most of the burden S → more desulphurisation and flux; P goes entirely to hot metal.'],
        ['Moisture', '< 4–5 % stable', 'Variable moisture upsets the coke weight charged.'], ['Porosity', '45–50 %', 'Higher porosity → higher reactivity, lower strength.']] },
    sinter: { n: 'Sinter', dot: '#8a4b2a', col: [.28, .2, .15], lump: .12, fine: 1.4,
      f: { feo: [5, 12, .5, 'FeO (%)', 8, 'FeO'], bas: [1.3, 2.6, .05, 'Basicity CaO/SiO₂', 1.9, 'Basicity'], alu: [1, 3.2, .1, 'Al₂O₃ (%)', 1.8, 'Al₂O₃'], ti: [55, 85, 1, 'Tumbler index (%)', 70, 'TI'], T: [350, 1000, 10, 'Reduction temp. (°C)', 550, 'Temp.'], time: [0, 100, 1, 'Reduction time (%)', 50] },
      rad: function (p, d) { return .95 * (1 - .1 * d); },
      note: 'Low-temperature reduction (450–650 °C) turns hematite into magnetite with volume expansion, cracking the sinter. High Al₂O₃, low FeO and low strength worsen RDI.',
      calc: function (p) { var tf = Math.exp(-Math.pow((p.T - 550) / 150, 2)) * .8 + .2;
        var risk = (1 + .4 * (p.alu - 1.8)) * (1 + .5 * (8 - p.feo) / 4) * (1 + (70 - p.ti) / 80) * (1 + .3 * (1.9 - p.bas)) * tf;
        var d = cl(risk * p.time / 100 * .6, 0, 1), rdi = 100 - 55 * d, ri = cl(60 + (p.bas - 1.9) * 10 - (p.feo - 8) * 2.5, 30, 90);
        return { d: d, fines: d * 27, rdi: rdi, ri: ri, m: [['RDI +3.15 mm', F(rdi) + ' %', rdi < 70], ['Reducibility RI', F(ri) + ' %', ri < 60]] }; },
      tb: [['RDI +3.15 mm', '> 65–75 %', 'Disintegration in the stack; fines raise ΔP and cause channelling.'], ['Tumbler index +6.3 mm', '> 70–78 %', 'Cold strength and resistance to handling breakage.'],
        ['Reducibility (RI)', '> 60–70 %', 'Better indirect reduction lowers coke rate.'], ['Basicity CaO/SiO₂', '1.8–2.2', 'Governs the SFCA bonding phase, slag volume and softening behaviour.'],
        ['FeO', '7–9 %', 'Low FeO → more hematite, worse RDI; high FeO → lower reducibility.'], ['Al₂O₃', '< 1.8–2.2 %', 'Raises RDI damage, viscous slag, ΔP in the cohesive zone.'],
        ['MgO', '1.5–2.5 %', 'Improves RDI and slag fluidity.'], ['Size', '5–40 mm; < 5 mm < 5–10 %', 'Fines block voids and reduce permeability.'], ['Fe grade', '56–58 %', 'Higher Fe → less slag and lower fuel rate.']] },
    pellet: { n: 'Pellet', dot: '#6d4c9f', col: [.35, .14, .1], lump: .012, fine: .25,
      f: { ccs: [120, 350, 5, 'CCS (daN/pellet)', 250, 'CCS'], sil: [2.5, 7, .1, 'SiO₂ (%)', 4.5, 'SiO₂'], por: [15, 35, 1, 'Porosity (%)', 25, 'Porosity'], size: [6, 18, .5, 'Mean size (mm)', 12, 'Size'], T: [500, 1100, 10, 'Reduction temp. (°C)', 900, 'Temp.'], time: [0, 100, 1, 'Reduction time (%)', 50] },
      rad: function (p, d) { return (.5 + p.size / 32) * (1 + .5 * d); },
      note: 'In the wüstite stage (~900–1000 °C) iron whiskers grow and the pellet swells, so it expands instead of shrinking. Low CCS, low silica and high porosity worsen swelling.',
      calc: function (p) { var tf = Math.exp(-Math.pow((p.T - 900) / 250, 2)) * .8 + .2;
        var d = cl(p.time / 100 * tf * (1 + (250 - p.ccs) / 300) * (1 + (4.5 - p.sil) * .12) * (1 + (p.por - 25) * .02) * .9, 0, 1), sw = d * 35, cc = p.ccs * (1 - .6 * d), ri = cl(55 + (p.por - 25) - (p.sil - 4.5) * 2, 30, 95);
        return { d: d, fines: d * 16, sw: sw, ccsR: cc, ri: ri, m: [['Swelling RSI', F(sw) + ' %', sw > 20], ['CCS after reduction', F(cc, 0) + ' daN', cc < 120], ['Reducibility RI', F(ri) + ' %', ri < 60]] }; },
      tb: [['Cold crushing strength', '> 250 daN/pellet', 'Low CCS → breakage and fines in the shaft.'], ['Swelling index (RSI)', '< 20 %', 'Abnormal swelling (> 20–30 %) causes burden slips, fines and scaffolding.'],
        ['Reducibility (RI)', '> 65–70 %', 'Higher RI → more indirect reduction, lower coke rate.'], ['Size', '9–16 mm, narrow range', 'Uniform size gives high permeability; large pellets reduce slowly.'],
        ['Fe grade', '> 64–66 %', 'Low slag volume, lower coke rate.'], ['SiO₂', '4–5 %', 'Too low → swelling and weak bond; too high → more slag.'],
        ['Tumbler index +6.3 mm', '> 93 %', 'Resistance to abrasion in handling and furnace.'], ['Porosity', '20–30 %', 'Higher → faster reduction but lower strength.'], ['Softening range', 'Narrow, high T', 'A narrow high-temperature cohesive zone keeps ΔP low.']] },
    ore: { n: 'Lump ore', dot: '#2f62a8', col: [.25, .26, .3], lump: .1, fine: .6,
      f: { loi: [0, 10, .5, 'LOI / combined water (%)', 3, 'LOI'], alu: [.5, 4, .1, 'Al₂O₃ (%)', 1.5, 'Al₂O₃'], por: [3, 25, 1, 'Porosity (%)', 10, 'Porosity'], size: [10, 40, 1, 'Mean size (mm)', 25, 'Size'], T: [300, 1000, 10, 'Heating temp. (°C)', 650, 'Temp.'], time: [0, 100, 1, 'Exposure time (%)', 50] },
      rad: function (p, d) { return (.55 + p.size / 80) * (1 - .15 * d); },
      note: 'Goethite-rich ore loses combined water at 300–700 °C and cracks (decrepitation). Large, porous, high-LOI lumps heated quickly break up the most.',
      calc: function (p) { var tf = Math.exp(-Math.pow((p.T - 650) / 250, 2)) * .8 + .2;
        var d = cl(p.time / 100 * (.4 + .25 * p.loi) * (1 + .2 * (p.alu - 1.5)) * (1 + (p.size - 25) / 50) * (1 + (p.por - 10) / 40) * tf * .55, 0, 1), ri = cl(45 + (p.por - 10) * 1.6 - (p.alu - 1.5) * 3, 20, 90);
        return { d: d, fines: d * 40, ri: ri, m: [['Size after degradation', F(p.size * (1 - .5 * d), 0) + ' mm', false], ['Reducibility RI', F(ri) + ' %', ri < 50]] }; },
      tb: [['Size', '10–40 mm', 'Too many fines (< 5 mm) lower permeability.'], ['Decrepitation index (DI)', 'Low fines after heating', 'Thermal shattering in the stack creates fines.'],
        ['LOI / combined water', '< 3–5 %', 'Water loss opens cracks; also costs heat.'], ['RDI +3.15 mm', '> 60–70 %', 'Low-temperature disintegration, like sinter.'],
        ['Reducibility (RI)', '> 50–60 %', 'Dense hematite reduces slowly, increasing direct reduction and coke rate.'], ['Fe grade', '60–65 %', 'Low Fe → more slag.'],
        ['Al₂O₃ / SiO₂', 'Al₂O₃ < 2.5 %', 'Raises slag viscosity and volume.'], ['Alkali, P, S', 'Low', 'Alkali recirculates; P and S enter hot metal.'], ['Porosity', '8–15 %', 'Speeds reduction but promotes breakage.']] }
  };

  /* ---------- starting values from this plant's burden, where the app has them */
  function snap(k, q, v) { var f = M[k].f[q]; return +cl(Math.round(v / f[2]) * f[2], f[0], f[1]).toFixed(2); }
  var MINE = {}, FROM = {};
  (function () {
    var u, set = function (k, q, v, why) { if (isNum(v) && v > 0) { MINE[k][q] = snap(k, q, v); FROM[k][q] = why; } };
    Object.keys(M).forEach(function (k) { MINE[k] = {}; FROM[k] = {}; Object.keys(M[k].f).forEach(function (q) { MINE[k][q] = M[k].f[q][4]; }); });
    u = PL.u('COKE1'); set('coke', 'ash', u[1] > 0 ? 100 - u[1] - 1 : null, 'from fixed carbon'); set('coke', 'alk', u[10], 'from analysis'); set('coke', 'size', PL.mps.mainCoke, 'calculator MPS');
    u = PL.u('SINTER'); set('sinter', 'bas', u[5] > 0 ? u[3] / u[5] : null, 'from CaO/SiO₂'); set('sinter', 'alu', u[6], 'from analysis');
    u = PL.u('PELLET'); set('pellet', 'sil', u[5], 'from analysis'); set('pellet', 'size', PL.mps.pellet, 'calculator MPS');
    u = PL.u('TATA'); set('ore', 'alu', u[6], 'from analysis'); set('ore', 'size', PL.mps.ore, 'calculator MPS');
  })();
  var MKEY = { coke: ['COKE1', 'COKE2', 'COKE3', 'COKE4'], sinter: ['SINTER'], pellet: ['PELLET'], ore: ['TATA', 'APHATU'] };
  function share(k) { var w = MKEY[k].reduce(function (a, x) { return a + PL.kg(x); }, 0); return { kg: w, pct: k === 'coke' ? null : (PL.fe ? w / PL.fe * 100 : 0) }; }
  function mine(k) {
    var key = MKEY[k][0], u = PL.u(key), sh = share(k), items = [];
    items.push([k === 'coke' ? 'Coke per charge' : 'Share of Fe burden', k === 'coke' ? F(sh.kg, 0) + ' kg' : F(sh.pct, 1) + ' %']);
    if (k === 'coke') items.push(['Fixed carbon', F(u[1], 2) + ' %'], ['Ash (est.)', F(100 - u[1] - 1, 1) + ' %'], ['Alkali', F(u[10], 2) + ' %'], ['S', F(u[9], 2) + ' %'], ['Moisture', F(u[0], 1) + ' %']);
    else items.push(['Fe', F(u[2], 2) + ' %'], ['SiO₂', F(u[5], 2) + ' %'], ['Al₂O₃', F(u[6], 2) + ' %'], ['CaO', F(u[3], 2) + ' %'], ['MgO', F(u[4], 2) + ' %'], ['Moisture', F(u[0], 1) + ' %']);
    if (k === 'sinter' && u[5] > 0) items.push(['B2 CaO/SiO₂', F(u[3] / u[5], 2)]);
    var mp = { coke: 'mainCoke', sinter: 'sinter', pellet: 'pellet', ore: 'ore' }[k];
    if (isNum(+PL.mps[mp]) && PL.mps[mp] > 0) items.push(['Size (MPS)', F(+PL.mps[mp], 0) + ' mm']);
    $('mineH').textContent = 'Your ' + M[k].n.toLowerCase() + ': ' + E.MATERIALS[E.IDX[key]].name;
    $('mineNote').textContent = (PL.fresh ? 'No lab reports uploaded yet: standard example analysis. ' : 'From Batch chemistry. ') + 'Sliders marked "yours" start from these values; the others start at typical values.';
    $('mine').innerHTML = items.map(function (x) { return '<div><span>' + x[0] + '</span><b>' + x[1] + '</b></div>'; }).join('');
  }

  /* ---------- live suggestions: [level, text]; level hi = act, md = watch, ok = fine */
  function suggest(k, p, r) {
    var o = [], add = function (lv, t) { o.push([lv, t]); }, sh = share(k);
    if (k === 'coke') {
      if (r.CSR < 62) add('hi', '<b>CSR about ' + F(r.CSR, 0) + ' %</b> is below 62 %: expect coke fines in the deadman and a higher pressure drop. Lower CRI with a better coal blend or longer coking time, and cut alkali input.');
      if (p.ash > 12) add('hi', '<b>Ash ' + F(p.ash) + ' %</b>: each 1 % above 11 % costs about 5 kg coke/tHM, here about ' + F((p.ash - 11) * 5, 0) + ' kg/tHM, and adds slag.');
      if (p.alk > 0.3) add('md', '<b>Alkali ' + F(p.alk, 2) + ' %</b> is above 0.3 %: it speeds solution loss and builds scaffolds. Flush with a lower-B2 slag now and then.');
      if (p.cri > 28) add('md', '<b>CRI ' + F(p.cri, 0) + ' %</b> is above 28 %: the coke reacts early in the shaft and loses strength before the cohesive zone.');
      if (p.size < 40) add('md', '<b>Mean size ' + F(p.size, 0) + ' mm</b> is small for the centre: screen at 25–30 mm and charge the undersize as nut coke with the ore.');
    } else if (k === 'sinter') {
      if (r.rdi < 65) add('hi', '<b>RDI about ' + F(r.rdi, 0) + ' %</b> is below 65 %: sinter breaks down in the upper stack. Raise MgO to 1.5–2.5 %, keep FeO at 7–9 % and cut Al₂O₃.');
      if (p.bas < 1.8 || p.bas > 2.2) add('md', '<b>Basicity ' + F(p.bas, 2) + '</b> is outside 1.8–2.2: the SFCA bond weakens and strength falls. Adjust the limestone/dolomite in the sinter mix.');
      if (p.alu > 2.2) add('md', '<b>Al₂O₃ ' + F(p.alu) + ' %</b> is high: worse RDI and a viscous slag. Blend lower-alumina fines.');
      if (p.feo < 7) add('md', '<b>FeO ' + F(p.feo) + ' %</b> is low: more hematite means more disintegration. A little more fuel in the sinter mix helps.');
      else if (p.feo > 9) add('md', '<b>FeO ' + F(p.feo) + ' %</b> is high: reducibility drops. Trim the sinter fuel.');
      if (p.ti < 70) add('md', '<b>Tumbler index ' + F(p.ti, 0) + ' %</b>: weak sinter breaks in handling. Screen before charging (keep under 5 mm below 5 %).');
      if (isNum(sh.pct) && sh.pct > 75) add('md', 'Sinter is <b>' + F(sh.pct, 0) + ' %</b> of your Fe burden, so the furnace depends on its RDI. Watch the top-gas utilisation when sinter quality drops.');
    } else if (k === 'pellet') {
      if (r.sw > 20) add('hi', '<b>Swelling about ' + F(r.sw, 0) + ' %</b> is above 20 %: risk of slips and scaffolding. Use a fluxed pellet (higher basicity or MgO), keep SiO₂ at 4–5 % and CCS above 250 daN.');
      if (p.ccs < 250) add('md', '<b>CCS ' + F(p.ccs, 0) + ' daN</b> is below 250: pellets break in handling and in the shaft.');
      if (p.sil < 4) add('md', '<b>SiO₂ ' + F(p.sil) + ' %</b> is low: a weaker slag bond and more swelling.');
      else if (p.sil > 5.5) add('md', '<b>SiO₂ ' + F(p.sil) + ' %</b> is high: more slag volume and fuel.');
      if (p.size < 9 || p.size > 16) add('md', '<b>Size ' + F(p.size) + ' mm</b> is outside 9–16 mm: ' + (p.size < 9 ? 'small pellets lower permeability' : 'large pellets reduce slowly') + '.');
      if (isNum(sh.pct) && sh.pct > 30) add('md', 'Pellet is <b>' + F(sh.pct, 0) + ' %</b> of your Fe burden: pellets roll to the centre, so keep them out of the inner rings of the matrix.');
    } else {
      if (p.loi > 5) add('hi', '<b>LOI ' + F(p.loi) + ' %</b> is high: the ore decrepitates as it heats. Limit its share or use a lower-LOI ore.');
      if (r.fines > 10) add('hi', 'About <b>' + F(r.fines, 0) + ' % fines</b> after heating: screen out under 10 mm and keep lump ore at 15–20 % of the burden or less.');
      if (p.size > 30) add('md', '<b>Size ' + F(p.size, 0) + ' mm</b>: large lumps crack more and reduce slowly. Crush to 10–30 mm.');
      if (p.alu > 2.5) add('md', '<b>Al₂O₃ ' + F(p.alu) + ' %</b> is above 2.5 %: more, and more viscous, slag.');
      if (isNum(sh.pct) && sh.pct > 20) add('md', 'Lump ore is <b>' + F(sh.pct, 0) + ' %</b> of your Fe burden: above about 20 % its fines start to hurt permeability.');
    }
    if (r.perm < 70 && k !== 'coke') add('md', 'Bed permeability index <b>' + F(r.perm, 0) + '</b>: expect a higher pressure drop. Better screening helps most.');
    if (k === 'coke' && r.perm < 70) add('hi', 'Bed permeability index <b>' + F(r.perm, 0) + '</b>: weak or small coke closes the cohesive-zone windows. Raise coke size and CSR before raising the O/C.');
    if (!o.length) add('ok', M[k].n + ' is within the usual range at these settings. No change suggested.');
    return o;
  }
  function mixSuggest() {
    var o = [], s = share('sinter').pct, p = share('pellet').pct, r = share('ore').pct, add = function (lv, t) { o.push([lv, t]); };
    add('ok', 'Your Fe burden: sinter <b>' + F(s, 0) + ' %</b>, pellet <b>' + F(p, 0) + ' %</b>, lump ore <b>' + F(r, 0) + ' %</b>' + (s + p + r < 99.5 ? ', other ' + F(100 - s - p - r, 0) + ' %' : '') + '.');
    if (p > 30) add('md', 'More than 30 % pellet: check swelling (RSI) and charge pellets away from the centre.');
    if (r > 20) add('md', 'More than 20 % lump ore: decrepitation fines start to hurt permeability; screen well.');
    if (s > 75) add('md', 'Over 75 % sinter: RDI decides the stack permeability; keep MgO and FeO in range.');
    if (s < 50 && p + r > 50) add('md', 'Less than 50 % sinter: the burden is less self-fluxing, so more limestone or dolomite goes in the charge.');
    return o;
  }

  /* ---------- 3D: six lumps with fines specks (three.js r128) */
  var cur, S, base, keys, cv = $('cv');
  var ren = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
  var sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(45, 1, .1, 100); cam.position.set(0, 0, 12);
  sc.add(new THREE.AmbientLight(0xffffff, .6));
  var dl = new THREE.DirectionalLight(0xffffff, .75); dl.position.set(4, 6, 8); sc.add(dl);
  var warm = new THREE.PointLight(0xff7a1a, .35, 30); warm.position.set(0, -6, 6); sc.add(warm);
  function hash(x, y, z) { return Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453 % 1; }
  function mkLabel() {
    var c = document.createElement('canvas'); c.width = 256; c.height = 64;
    var tx = new THREE.CanvasTexture(c), s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true })); s.scale.set(3, .75, 1);
    s.set = function (t, hot) { var g = c.getContext('2d'); g.clearRect(0, 0, 256, 64); g.fillStyle = hot ? '#ffb547' : '#c9cdd2'; g.font = '600 26px "IBM Plex Sans", system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(t, 128, 40); tx.needsUpdate = true; };
    return s;
  }
  var L = [];
  for (var i = 0; i < 6; i++) (function (i) {
    var geo = new THREE.IcosahedronGeometry(1, 4), N = geo.attributes.position.count, bp = new Float32Array(geo.attributes.position.array), ns = new Float32Array(N), fn = new Float32Array(N), ha = new Float32Array(N);
    for (var j = 0; j < N; j++) { var x = bp[3 * j], y = bp[3 * j + 1], z = bp[3 * j + 2]; ns[j] = Math.sin(x * 2.1 + i) * Math.sin(y * 1.7 + 2) * Math.cos(z * 2.3 + 1); fn[j] = Math.sin(x * 9 + y * 7 + i) * Math.sin(z * 8 + x * 5) * .5 + .5; ha[j] = Math.abs(hash(x, y, z)); }
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    var m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9, flatShading: true })), w = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffb066, wireframe: true, transparent: true, opacity: 0 }));
    var g = new THREE.Group(); g.add(m, w); g.position.set((i % 3 - 1) * 3.4, i < 3 ? 1.7 : -1.5, 0);
    var FN = 150, fp = new Float32Array(FN * 3), dirs = [];
    for (var k = 0; k < FN; k++) dirs.push([new THREE.Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5).normalize(), Math.random()]);
    var fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(fp, 3));
    var pt = new THREE.Points(fg, new THREE.PointsMaterial({ color: 0x999999, size: .07 })); pt.position.copy(g.position);
    var lb = mkLabel(); lb.position.set(g.position.x, g.position.y - 1.6, 0); sc.add(g, pt, lb);
    L.push({ g: g, w: w, geo: geo, bp: bp, ns: ns, fn: fn, ha: ha, pt: pt, fg: fg, fp: fp, dirs: dirs, lb: lb, rad: 1, k: null });
  })(i);

  var TABS = Object.keys(M).concat('cmp');
  TABS.forEach(function (k) {
    var b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'tab'); b.dataset.k = k;
    b.innerHTML = k === 'cmp' ? 'Compare all' : '<i style="background:' + M[k].dot + '"></i>' + M[k].n;
    b.onclick = function () { setMat(k); }; $('tb').appendChild(b);
  });
  function setMat(k) {
    document.querySelectorAll('#tb button').forEach(function (b) { b.classList.toggle('on', b.dataset.k === k); b.setAttribute('aria-selected', b.dataset.k === k); });
    $('mat').classList.toggle('hide', k === 'cmp'); $('cmp').classList.toggle('hide', k !== 'cmp');
    try { localStorage.setItem('bf-mat-tab', k); } catch (e) { }
    if (k === 'cmp') { $('mixSugs').innerHTML = mixSuggest().map(sugHtml).join(''); return; }
    cur = k; var c = M[k]; S = {}; base = {};
    for (var q in c.f) S[q] = base[q] = MINE[k][q];
    $('sl').innerHTML = Object.keys(c.f).map(function (q) { var a = c.f[q];
      return '<div class="sl"><label for="r_' + q + '"><span>' + a[3] + (FROM[k][q] ? ' <small>yours, ' + FROM[k][q] + '</small>' : '') + '</span><b id="v_' + q + '"></b></label><input type="range" id="r_' + q + '" min="' + a[0] + '" max="' + a[1] + '" step="' + a[2] + '" value="' + S[q] + '"></div>'; }).join('');
    Object.keys(c.f).forEach(function (q) { $('r_' + q).oninput = function (e) { S[q] = +e.target.value; upd(); }; });
    keys = Object.keys(c.f).slice(0, 5);
    L.forEach(function (l, i) { l.k = i ? keys[i - 1] : null; l.lb.set(i ? c.f[l.k][5] + ' only' : 'Combined', !i); l.pt.material.color.setRGB(c.col[0] * 2.5 + .3, c.col[1] * 2.5 + .3, c.col[2] * 2.5 + .3); });
    $('note').textContent = c.note; $('th').textContent = c.n + ': key properties and furnace effect';
    $('tbl').innerHTML = '<tr><th>Property</th><th>Typical target</th><th>Effect on blast furnace</th></tr>' + c.tb.map(function (r) { return '<tr><td class="tag">' + r[0] + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td></tr>'; }).join('');
    mine(k); upd(); resize();
  }
  function setAll(src) { for (var q in S) { S[q] = src[q]; $('r_' + q).value = src[q]; } upd(); }
  $('rs').onclick = function () { setAll(base); };
  $('rt').onclick = function () { var t = {}, f = M[cur].f; for (var q in f) t[q] = f[q][4]; setAll(t); };
  function sugHtml(x) { return '<div class="sug ' + x[0] + '">' + x[1] + '</div>'; }
  function upd() {
    var c = M[cur], b = c.calc(base), r = c.calc(S);
    for (var q in S) $('v_' + q).textContent = S[q];
    var perm = isNum(r.perm) ? r.perm : cl(100 - r.fines * 3, 0, 100), cr = isNum(r.cr) ? r.cr - (isNum(b.cr) ? b.cr : 0) : (r.fines - b.fines) * 1.6;
    r.perm = perm;
    $('out').innerHTML = r.m.map(function (x) { return '<div class="m">' + x[0] + '<b class="' + (x[2] ? 'bad' : 'good') + '">' + x[1] + '</b></div>'; }).join('') +
      '<div class="m">Degradation<b>' + F(r.d * 100, 0) + ' %</b></div><div class="m">Fines generated<b class="' + (r.fines > 10 ? 'bad' : '') + '">' + F(r.fines) + ' %</b></div>' +
      '<div class="m">Bed permeability index<b class="' + (perm < 70 ? 'bad' : 'good') + '">' + F(perm, 0) + '</b></div><div class="m">Coke rate change<b class="' + (cr > 0.5 ? 'bad' : 'good') + '">' + (cr > 0 ? '+' : '') + F(cr, 0) + ' kg/tHM</b></div>';
    $('sugs').innerHTML = suggest(cur, S, r).map(sugHtml).join('');
    L.forEach(function (l) {
      var p = Object.assign({}, base); if (l.k) p[l.k] = S[l.k]; else Object.assign(p, S);
      var qd = c.calc(p), d = qd.d, pos = l.geo.attributes.position, col = l.geo.attributes.color, N = pos.count, rad = c.rad(p, d), amp = (.04 + .3 * d) * c.fine, gr = c.grain ? c.grain(p) : 0, tn = c.tint ? c.tint(p) : [0, 0, 0];
      for (var j = 0; j < N; j++) {
        var x = l.bp[3 * j], y = l.bp[3 * j + 1], z = l.bp[3 * j + 2], s = rad * (1 + c.lump * l.ns[j] + amp * (l.fn[j] - .5));
        pos.array[3 * j] = x * s; pos.array[3 * j + 1] = y * s * .9; pos.array[3 * j + 2] = z * s;
        var a = .08 * l.fn[j] + .15 * d * l.fn[j], R = c.col[0] + a + tn[0], G = c.col[1] + a + tn[1], B = c.col[2] + a * 1.05;
        if (gr > 0 && l.ha[j] > 1 - gr) { R = G = B = .55 + .2 * l.ha[j]; }
        col.array[3 * j] = R; col.array[3 * j + 1] = G; col.array[3 * j + 2] = B;
      }
      pos.needsUpdate = col.needsUpdate = true; l.geo.computeVertexNormals(); l.rad = rad;
      l.w.material.opacity = Math.min(.35, d * .6); l.fg.setDrawRange(0, Math.round(Math.min(150, qd.fines / 25 * 150)));
    });
  }
  function resize() { var w = cv.clientWidth, h = cv.clientHeight; if (!w) return; ren.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); ren.setSize(w, h, false); cam.aspect = w / h; cam.position.z = w / h < 1.2 ? 13.5 : 11.5; cam.updateProjectionMatrix(); }
  window.addEventListener('resize', resize);
  var drag = null;
  cv.onpointerdown = function (e) { drag = e; cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing'; };
  cv.onpointerup = cv.onpointercancel = function () { drag = null; cv.style.cursor = 'grab'; };
  cv.onpointermove = function (e) {
    if (!drag) return; var dx = e.clientX - drag.clientX, dy = e.clientY - drag.clientY; drag = e;
    var rc = cv.getBoundingClientRect(), cx = (e.clientX - rc.left) / rc.width, cy = (e.clientY - rc.top) / rc.height;
    var l = L[(cy < .5 ? 0 : 3) + (cx < .33 ? 0 : cx < .66 ? 1 : 2)]; l.g.rotation.y += dx * .01; l.g.rotation.x += dy * .01;
  };
  var t = 0, still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  (function loop() {
    t += .016;
    L.forEach(function (l) {
      if (!drag && !still) l.g.rotation.y += .004;
      l.dirs.forEach(function (d, j) { var ph = (t * .35 + d[1]) % 1, rr = l.rad * (1 + ph * 1.2); l.fp[3 * j] = d[0].x * rr; l.fp[3 * j + 1] = d[0].y * rr; l.fp[3 * j + 2] = d[0].z * rr; });
      l.fg.attributes.position.needsUpdate = true;
    });
    if (!document.hidden && cur && !$('mat').classList.contains('hide')) ren.render(sc, cam);
    requestAnimationFrame(loop);
  })();
  var first = 'coke'; try { var sv = localStorage.getItem('bf-mat-tab'); if (TABS.indexOf(sv) >= 0) first = sv; } catch (e) { }
  setMat(first === 'cmp' ? 'coke' : first); if (first === 'cmp') setMat('cmp');
})();
