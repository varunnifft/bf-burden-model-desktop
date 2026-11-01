/* the chemistry part: the burden calculator and 3D distribution pages inside the app.
   Burden per charge and moisture come from the chemistry part (Burden tab weights, Review tab analysis); the furnace, chute,
   matrix and gas inputs stay on the calculator. Loads after engine.js and seed.js, before link.js. */
(function () {
  'use strict';
  var E = window.BurdenEngine, KEY = 'sspl_bf_burden_v1', LINK = 'bf608-link';
  var OP_KEYS = ['cokeBase', 'yardPct', 'oc', 'sinterPct', 'pelletPct', 'cloPct', 'nut', 'lime', 'dolo', 'pyrox', 'quartz', 'mn'];
  // calculator row <- Chemistry materials
  var GROUPS = [['mainCoke', 'Main coke', ['COKE1', 'COKE3', 'COKE4']], ['yardCoke', 'Yard / second coke', ['COKE2']], ['sinter', 'Sinter', ['SINTER']],
    ['pellet', 'Pellet', ['PELLET']], ['clo', 'Lump CLO', ['TATA']], ['ore', 'Lump ore', ['APHATU', 'ACC_COLLER', 'PSB_ACC']], ['lime', 'Limestone', ['LIMESTONE']],
    ['dolo', 'Dolomite', ['DOLO']], ['pyrox', 'Paraxonite', ['PYROX']], ['quartz', 'Quartz', ['QTZ']], ['mn', 'Mn ore', ['MN']], ['nut', 'Nut coke', ['NUT']]];

  function on() { try { return localStorage.getItem(LINK) !== 'off'; } catch (e) { return true; } }
  function revive(txt) {
    return JSON.parse(txt, function (k, v) {
      if (v && typeof v === 'object' && typeof v.__d === 'string') { var p = v.__d.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
      return v;
    });
  }
  /** the the chemistry part state as its Results tab sees it (same loading rules as app.js) */
  function state() {
    var st = null;
    try { var t = localStorage.getItem(KEY); if (t) st = revive(t); } catch (e) { }
    var fresh = !st || st.version !== 1;
    if (fresh) st = E.defaultState();
    if (fresh || !st.lab || (!st.lab.bf && !st.lab.importedOn)) st.lab = window.SEED_LAB ? E.migrateLab(revive(JSON.stringify(window.SEED_LAB))) : E.emptyLab();
    st.lab = E.migrateLab(st.lab);
    if (!st.charge) st.charge = E.chargeDefault();
    st.matSource = st.matSource || {}; st.manual = st.manual || {};
    var md = (st.importOpt || {}).mode;
    st.importOpt = { mode: md === 'LAST 2' || md === 'LAST N' ? 'LAST 2' : 'LATEST', staleDays: 3 };
    return st;
  }
  var cache = null;
  /** calculator burden inputs and moisture from the the chemistry part charge */
  function burden() {
    if (cache) return cache;
    var S = state();
    if (S.charge && S.charge.on) E.applyCharge(S);
    var rv = E.review(S), I = E.IDX, dryBasis = S.params.basis === 'DRY';
    var wet = function (k) { return +S.qty[I[k]] || 0; }, moist = function (k) { return +rv[I[k]].used[0] || 0; };
    var dry = function (k) { return dryBasis ? wet(k) : wet(k) * (1 - moist(k) / 100); };
    var g = {}, rows = [];
    GROUPS.forEach(function (x) {
      var w = 0, d = 0, mw = 0;
      x[2].forEach(function (k) { w += wet(k); d += dry(k); mw += wet(k) * moist(k); });
      g[x[0]] = { wet: w, dry: d, moist: w ? mw / w : moist(x[2][0]) };
      x[2].forEach(function (k) {
        if (!(wet(k) > 0)) return;
        var u = rv[I[k]].used, m = rv[I[k]].m;
        var chem = m.group === 'Fuel' ? 'FC ' + u[1].toFixed(2) : m.group === 'Flux' ? 'CaO ' + u[3].toFixed(1) + ' · MgO ' + u[4].toFixed(1) + ' · SiO₂ ' + u[5].toFixed(1)
          : 'Fe ' + u[2].toFixed(2) + ' · SiO₂ ' + u[5].toFixed(2) + ' · Al₂O₃ ' + u[6].toFixed(2);
        rows.push({ name: m.name, to: x[1], wet: wet(k), moist: moist(k), dry: dry(k), chem: chem });
      });
    });
    var coke = g.mainCoke.dry + g.yardCoke.dry, met = g.sinter.dry + g.pellet.dry + g.clo.dry + g.ore.dry, base = coke + g.nut.dry;
    var r = function (v, n) { return +v.toFixed(n); }, pc = function (v) { return met ? r(v / met * 100, 3) : 0; };
    var f = { cokeBase: r(coke, 1), yardPct: coke ? r(g.yardCoke.dry / coke * 100, 3) : 0, oc: base ? r(met / base, 4) : 0,
      sinterPct: pc(g.sinter.dry), pelletPct: pc(g.pellet.dry), cloPct: pc(g.clo.dry), nut: r(g.nut.dry, 1),
      lime: r(g.lime.wet, 1), dolo: r(g.dolo.wet, 1), pyrox: r(g.pyrox.wet, 1), quartz: r(g.quartz.wet, 1), mn: r(g.mn.wet, 1) };
    var ms = {}; GROUPS.forEach(function (x) { ms[x[0]] = r(g[x[0]].moist, 2); });
    cache = { f: f, moist: ms, rows: rows, basis: S.params.basis, mix: !!(S.charge && S.charge.on), file: (S.lab.uploads || []).length ? 'uploaded reports' : 'example analyses' };
    return cache;
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function n(v, d) { return isFinite(v) ? v.toFixed(d) : '–'; }
  var CSS = '.c608{border-left:4px solid #f08a24!important}.c608 table{font-size:12.5px}.c608 td,.c608 th{white-space:nowrap}' +
    '.c608 .sw{display:flex;gap:8px;align-items:center;font-size:13px;margin:8px 0}.c608 .sw input{width:18px;height:18px}' +
    '.c608 .acts{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.c608 .acts a{font:600 13px/1 var(--f-body,system-ui),sans-serif;text-decoration:none;color:#1f3864;background:#eef1f6;padding:10px 14px;border-radius:8px}' +
    'input.from608{background:#fff4e0!important;color:#9a5b00!important}body.lock608 #addTable input{pointer-events:none;background:#fff4e0;color:#9a5b00}' +
    /* bottom tab bar, same as the the chemistry part home screen */
    '.t608{position:fixed;inset:auto 0 0 0;height:calc(62px + env(safe-area-inset-bottom));padding-bottom:env(safe-area-inset-bottom);background:#fff;border-top:1px solid #e3e7ee;display:grid;grid-template-columns:repeat(7,1fr);z-index:50}' +
    '.t608 a{color:#667085;text-decoration:none;font:600 11px system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px}' +
    '.t608 svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}' +
    'body.has608 .actions{bottom:calc(70px + env(safe-area-inset-bottom))}.t608 a.on{color:#1f3864}.t608 a.on svg{stroke:#f08a24}body.has608{padding-bottom:calc(80px + env(safe-area-inset-bottom))!important}' +
    '.bar608{display:flex;align-items:center;gap:10px;background:#14213d;color:#fff;margin:-24px -16px 16px;padding:12px 16px}.bar608 b{font:700 17px system-ui,sans-serif}.bar608 span{font-size:12px;color:#b9c3d6}';
  var TABS = [['chemistry.html#import', 'Import', 'M12 3v12m0 0-4-4m4 4 4-4M4 17v3h16v-3'], ['chemistry.html#review', 'Review', 'M4 6h16M4 12h10M4 18h7m9-3-4 4-2-2'],
    ['chemistry.html#burden', 'Burden', 'M7 21 9.5 3h5L17 21M5 21h14M10 9h4M9.5 14h5'], ['chemistry.html#results', 'Results', 'M4 20V10m6 10V4m6 16v-7m4 7H2'],
    ['calculator.html', 'Calculator', 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0M12 12m-5 0a5 5 0 1 0 10 0a5 5 0 1 0-10 0M12 12h.01'],
    ['simulator.html', '3D', 'M12 3 4 7.5v9L12 21l8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9'], ['report.html', 'Report', 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6']];

  function tabBar(page) {
    var me = page === 'sim' ? 'simulator.html' : 'calculator.html';
    var nav = document.createElement('nav'); nav.className = 't608'; nav.setAttribute('aria-label', 'the chemistry part pages');
    nav.innerHTML = TABS.map(function (t) { return '<a href="' + t[0] + '"' + (t[0] === me ? ' class="on" aria-current="page"' : '') + '><svg viewBox="0 0 24 24"><path d="' + t[2] + '"/></svg><span>' + t[1] + '</span></a>'; }).join('');
    document.body.appendChild(nav); document.body.classList.add('has608');
    var wrap = document.querySelector('.wrap'), bar = document.createElement('div'); bar.className = 'bar608';
    bar.innerHTML = '<div><b>the chemistry part</b><br><span>' + (page === 'sim' ? 'Step 4 of 4 · 3D charging simulator' : 'Step 3 of 4 · Burden distribution calculator') + '</span></div>';
    if (wrap) wrap.insertBefore(bar, wrap.firstChild);
  }
  function card608(anchor, html) {
    if (!anchor) return;
    var c = document.createElement('div'); c.className = 'card c608'; c.id = 'card608'; c.style.marginBottom = '14px'; c.innerHTML = html;
    anchor.parentNode.insertBefore(c, anchor);
  }
  function table(b) {
    return '<div class="tablewrap" style="overflow-x:auto"><table><thead><tr><th>Chemistry material</th><th>Calculator row</th><th>kg/charge</th><th>Moist %</th><th>Dry kg</th><th>Analysis %</th></tr></thead><tbody>' +
      b.rows.map(function (x) { return '<tr><td>' + esc(x.name) + '</td><td>' + esc(x.to) + '</td><td>' + n(x.wet, 0) + '</td><td>' + n(x.moist, 2) + '</td><td>' + n(x.dry, 0) + '</td><td>' + esc(x.chem) + '</td></tr>'; }).join('') +
      '</tbody></table></div>';
  }

  window.BF_NAV = [['index.html', '‹ Home'], ['data-input.html', 'Data input'], ['chemistry.html', 'Batch chemistry'], ['calculator.html', 'Burden calculator'], ['simulator.html', '3D distribution'], ['furnace-inside.html', 'Furnace 3D view'], ['report.html', 'Report'], ['materials.html', 'Fact must know'], ['feedback.html', 'Feedback & suggestion'], ['charging-modes.html', 'Other charging modes']];
  window.BF_SOURCE = {
    burden: burden,
    beforeBuild: function (IN) { if (!on()) return; var b = burden(); Object.assign(IN.f, b.f); Object.assign(IN.moist, b.moist); },
    afterBuild: function () {
      if (!on()) return;
      OP_KEYS.forEach(function (k) { var el = document.getElementById('i_' + k); if (el) { el.readOnly = true; el.classList.add('from608'); } });
      Object.keys(burden().moist).forEach(function (k) { var el = document.getElementById('moist_' + k); if (el) { el.readOnly = true; el.classList.add('from608'); } });
    },
    simLoaded: function (OP) {
      if (!on()) return; var b = burden();
      OP_KEYS.forEach(function (k) { OP[k] = b.f[k]; });
      Object.keys(b.moist).forEach(function (k) { OP['m_' + k] = b.moist[k]; });
    },
    mounted: function (page) {
      var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
      var b = burden(), live = on();
      var head = '<header><h2>From batch wise output chemistry</h2><span class="hint">' + (b.mix ? 'charge mix' : 'direct kg') + ' · ' + b.basis.toLowerCase() + ' basis · ' + esc(b.file) + '</span></header>';
      if (page === 'calc') {
        card608(document.getElementById('i_cokeBase') && document.getElementById('i_cokeBase').closest('.card'), head +
          '<label class="sw"><input type="checkbox" id="use608"' + (live ? ' checked' : '') + '> Take burden per charge and moisture from the chemistry part</label>' +
          (live ? '<p class="hint" style="margin:0 0 8px">The shaded boxes in <b>2 Burden per charge</b> and the moisture column in <b>3 Materials</b> are filled from the the chemistry part charge and lab analysis. Change them in Batch chemistry (Burden and Review tabs). Furnace, chute, matrix and gas are entered here.</p>' + table(b)
            : '<p class="hint">Off: type the burden and moisture by hand below.</p>') +
          '<div class="acts"><a href="chemistry.html#burden">Change charge on Burden tab ›</a><a href="chemistry.html#review">Change analysis on Review tab ›</a><a href="chemistry.html#results">Chemistry results ›</a></div>');
        var cb = document.getElementById('use608');
        if (cb) cb.addEventListener('change', function () { try { localStorage.setItem(LINK, cb.checked ? 'on' : 'off'); } catch (e) { } location.reload(); });
      } else if (live) {
        OP_KEYS.forEach(function (k) { var el = document.getElementById('op_' + k); if (el) { el.readOnly = true; el.classList.add('from608'); } });
        document.body.classList.add('lock608');
        card608(document.getElementById('op_cokeBase') && document.getElementById('op_cokeBase').closest('.card'), head +
          '<p class="hint" style="margin:0">Burden per charge and moisture (shaded) come from the chemistry part. Change them in Batch chemistry (Burden and Review tabs); the rest of the inputs come from the burden calculator.</p>' +
          '<div class="acts"><a href="calculator.html">‹ Burden calculator</a><a href="chemistry.html#burden">Change charge on Burden tab ›</a></div>');
      }
    }
  };
})();
