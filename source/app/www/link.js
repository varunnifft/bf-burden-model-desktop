/* Burden calculator <-> 3D distribution: jump buttons between the pages and hand-over of inputs.
   Calculate on the calculator copies its inputs into the simulator; Apply and restart on the simulator copies them back.
   An app that embeds the two pages (608burden) can set window.BF_NAV and window.BF_SOURCE before this file loads. */
(function () {
  'use strict';
  var CALC = 'bfbm-calculator-v1', SIM = 'bfbm-simulator-v1';
  var page = /simulator\.html/.test(location.pathname) ? 'sim' : 'calc';
  function read(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  function ok(v) { return typeof v === 'number' && isFinite(v); }
  function stamp(t) { var d = new Date(t); return isNaN(d) ? '' : d.toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }

  var OP_KEYS = ['cokeBase', 'yardPct', 'oc', 'sinterPct', 'pelletPct', 'cloPct', 'nut', 'lime', 'dolo', 'pyrox', 'quartz', 'mn'];
  var MOIST = ['mainCoke', 'yardCoke', 'pellet', 'ore', 'sinter', 'clo', 'lime', 'dolo', 'pyrox', 'quartz', 'mn', 'nut'];
  var CLS = ['coke', 'sinter', 'pellet', 'ore', 'clo', 'lime', 'dolo', 'pyrox', 'quartz', 'mn', 'nut'];
  var P_SAME = ['stock', 'rpm', 'Hp', 'L', 'BV', 'O2', 'TP', 'BP', 'Ttop'];
  var PX = ['e', 'hG', 'kImp', 'wC', 'wO'];          // chute inputs the simulator has no boxes for
  var GEO_DIA = [['R', 'throatD'], ['Rbelly', 'bellyD'], ['Rhearth', 'hearthD']], GEO_SAME = ['Reff', 'throatH', 'shaftH', 'bellyH', 'boshH', 'tankV', 'oreMax'];

  /** calculator inputs (IN) -> simulator store */
  function calcToSim(IN) {
    var f = IN.f, s = read(SIM) || {}, i;
    var GEO = s.GEO || {}, P = s.P || {}, X = s.PX || {}, OP = s.OP || {}, MAT = s.MAT || {};
    GEO_DIA.forEach(function (g) { if (f[g[1]] > 0) GEO[g[0]] = f[g[1]] / 2; });
    GEO_SAME.forEach(function (k) { if (ok(f[k]) || f[k] === null) GEO[k] = f[k]; });
    P_SAME.forEach(function (k) { if (ok(f[k])) P[k] = f[k]; });
    P.mode = IN.mode; P.order = IN.order; P.gasOn = IN.gas;
    if (ok(IN.props.coke[1])) P.muCoke = IN.props.coke[1];
    PX.forEach(function (k) { if (ok(f[k])) X[k] = f[k]; });
    OP_KEYS.forEach(function (k) { if (ok(f[k])) OP[k] = f[k]; });
    MOIST.forEach(function (k) { if (ok(IN.moist[k])) OP['m_' + k] = IN.moist[k]; });
    CLS.forEach(function (c) {
      var p = IN.props[c] || [], m = MAT[c] || {};
      if (ok(p[0])) m.rho = p[0]; if (ok(p[1])) m.mu = p[1]; if (ok(p[2])) m.rep = p[2];
      if (c === 'coke') {                              // one coke size in the simulator: main and yard coke weighted by mass
        var y = ok(f.yardPct) ? f.yardPct / 100 : 0, a = IN.mps.mainCoke, b = IN.mps.yardCoke;
        if (ok(a)) m.d = ok(b) ? +(a * (1 - y) + b * y).toFixed(1) : a;
      } else if (ok(IN.mps[c])) m.d = IN.mps[c];
      MAT[c] = m;
    });
    var NOTCH = [];
    for (i = 0; i < IN.mx.length; i++) { var r = IN.mx[i]; NOTCH.push({ a: r[0], c: r[1], ao: r[2], o: r[3] }); }
    s.GEO = GEO; s.P = P; s.PX = X; s.OP = OP; s.MAT = MAT; s.NOTCH = NOTCH;
    s.link = { from: 'calc', at: Date.now() };
    write(SIM, s);
  }

  /** simulator state -> calculator store (full record, so the calculator can load it on its own) */
  function simToCalc(st) {
    var c = read(CALC) || {}, f = c.f || {}, GEO = st.GEO, P = st.P, OP = st.OP;
    GEO_DIA.forEach(function (g) { if (GEO[g[0]] > 0) f[g[1]] = +(2 * GEO[g[0]]).toFixed(3); });
    GEO_SAME.forEach(function (k) { if (GEO[k] !== undefined) f[k] = GEO[k]; });
    P_SAME.concat(PX).forEach(function (k) { if (ok(P[k])) f[k] = P[k]; });
    OP_KEYS.forEach(function (k) { if (ok(OP[k])) f[k] = OP[k]; });
    var moist = {}; MOIST.forEach(function (k) { moist[k] = OP['m_' + k]; });
    var props = {}, mps = c.mps || {};
    CLS.forEach(function (k) { var m = st.MAT[k]; props[k] = [m.rho, m.mu, m.rep]; });
    CLS.forEach(function (k) { if (k !== 'coke') mps[k] = st.MAT[k].d; });
    var y = ok(f.yardPct) ? f.yardPct / 100 : 0, now = ok(mps.mainCoke) ? (ok(mps.yardCoke) ? mps.mainCoke * (1 - y) + mps.yardCoke * y : mps.mainCoke) : null;
    if (!ok(now) || Math.abs(now - st.MAT.coke.d) > 0.05) { mps.mainCoke = st.MAT.coke.d; mps.yardCoke = st.MAT.coke.d; }
    c.f = f; c.moist = moist; c.props = props; c.mps = mps;
    c.mx = st.NOTCH.map(function (n) { return [n.a, n.c, n.ao, n.o]; });
    c.order = P.order; c.mode = P.mode; c.gas = P.gasOn;
    c.link = { from: 'sim', at: Date.now() };
    write(CALC, c);
    var s = read(SIM); if (s) { s.link = { from: 'sim', at: Date.now() }; write(SIM, s); }
  }

  /* ---------- page jump buttons ---------- */
  var NAV = window.BF_NAV || [['index.html', '‹ Home'], ['data-input.html', 'Data input'], ['calculator.html', 'Burden calculator'], ['simulator.html', '3D distribution'], ['furnace-inside.html', 'Furnace 3D view']];
  var css = '.bfnav{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 14px}' +
    '.bfnav a{font:600 13px/1 var(--f-body,system-ui),sans-serif;text-decoration:none;color:var(--accent,#0e7c70);border:1px solid var(--line,#d3d9e0);background:var(--surface,#fff);padding:10px 14px;border-radius:999px;-webkit-tap-highlight-color:transparent}' +
    '.bfnav a.on{background:var(--accent,#0e7c70);border-color:var(--accent,#0e7c70);color:var(--accent-ink,#fff)}' +
    '.bfnav a.go{margin-left:auto}' +
    '.bflink-note{font-size:12.5px;color:var(--ink-2,#47525f);background:var(--surface,#fff);border:1px solid var(--line,#d3d9e0);border-left:4px solid var(--accent,#0e7c70);border-radius:6px;padding:8px 12px;margin:0 0 14px}';
  function mountNav() {
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    if (window.BF_NAV_CUSTOM) return;                  // the embedding app draws its own tab bar
    var wrap = document.querySelector('.wrap'); if (!wrap) return;
    var nav = document.createElement('nav'); nav.className = 'bfnav'; nav.setAttribute('aria-label', 'Pages');
    var me = page === 'sim' ? (/[?&]seq=1\b/.test(location.search) ? 'charging-modes.html' : 'simulator.html') : 'calculator.html';
    nav.innerHTML = NAV.map(function (n) { return '<a href="' + n[0] + '"' + (n[0] === me ? ' class="on" aria-current="page"' : '') + '>' + n[1] + '</a>'; }).join('');
    wrap.insertBefore(nav, wrap.firstChild);
  }
  function note(html) {
    var top = document.querySelector('.wrap .top'); if (!top) return;
    var n = document.getElementById('bflinkNote');
    if (!n) { n = document.createElement('div'); n.id = 'bflinkNote'; n.className = 'bflink-note'; n.setAttribute('role', 'status'); top.parentNode.insertBefore(n, top.nextSibling); }
    n.innerHTML = html;
  }
  function showLinkNote() {
    var s = read(page === 'sim' ? SIM : CALC), l = s && s.link;
    if (page === 'sim' && l && l.from === 'calc' && !/[?&]seq=1\b/.test(location.search)) note('Inputs taken from the <b>burden calculator</b> (Calculate pressed ' + stamp(l.at) + '): burden, moisture, materials, matrix, chute, furnace and gas. Changes here go back to the calculator when you press <b>Apply and restart</b>.');
    if (page === 'calc' && l && l.from === 'sim') note('Inputs taken from the <b>3D distribution</b> (Apply and restart pressed ' + stamp(l.at) + '). Press <b>Calculate</b> to update the results.');
  }
  // a page shown again from the back/forward cache must re-read the other page's changes
  window.addEventListener('pageshow', function (e) { if (e.persisted) location.reload(); });

  window.BFLink = {
    page: page,
    calcToSim: calcToSim,
    simToCalc: simToCalc,
    note: note,
    /** calculator: Calculate pressed -> simulator gets the same inputs */
    calculated: function (IN) { calcToSim(IN); note('Calculated and sent to the <b>3D distribution</b> ' + stamp(Date.now()) + '. Open it with <b>3D distribution ›</b>; it starts with these inputs.'); },
    /** calculator: open the simulator with the inputs now on screen */
    openSim: function (IN, calculate, missing) {
      if (missing().length) { calculate(); return; }  // shows which boxes are empty
      calculate(); calcToSim(IN); location.href = 'simulator.html';
    },
    init: function () { mountNav(); showLinkNote(); if (window.BF_SOURCE && window.BF_SOURCE.mounted) window.BF_SOURCE.mounted(page); }
  };
})();
