(function () {
  "use strict";
  var E = window.BurdenEngine, KEY = "sspl_bf_burden_v1";
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var TABS = ["import", "review", "burden", "results"];
  var S, tab = TABS.indexOf(location.hash.slice(1)) >= 0 ? location.hash.slice(1) : "import", openMat = {}, revFilter = "used";   // calculator / 3D pages link back with #tab

  // ------------------------------------------------------------ persistence (dates stored as YYYY-MM-DD)
  function iso(d) { return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function ser(st) {
    return JSON.stringify(st, function (k, v) {
      if (this[k] instanceof Date) return { __d: iso(this[k]) };
      return v;
    });
  }
  function revive(txt) {
    return JSON.parse(txt, function (k, v) {
      if (v && typeof v === "object" && typeof v.__d === "string") { var p = v.__d.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
      return v;
    });
  }
  function save() { try { localStorage.setItem(KEY, ser(S)); } catch (e) { } }
  function load() {
    var st = null;
    try { var t = localStorage.getItem(KEY); if (t) st = revive(t); } catch (e) { }
    var fresh = !st || st.version !== 1;
    if (fresh) st = E.defaultState();
    // 1.2 / 1.3 kept one averaged row per material; untouched bundled data is replaced by the new bundle with raw samples
    if (fresh || !st.lab || (!st.lab.bf && !st.lab.importedOn)) st.lab = window.SEED_LAB ? E.migrateLab(revive(JSON.stringify(window.SEED_LAB))) : E.emptyLab();
    st.lab = E.migrateLab(st.lab);
    if (!st.charge) st.charge = E.chargeDefault();
    st.params = Object.assign({}, E.PARAMS_DEFAULT, st.params);   // 2.3 added charges per hour and the oxygen inputs
    if (!st.matSource) st.matSource = {};
    if (!st.manual) st.manual = {};
    var md = (st.importOpt || {}).mode;
    if (md === "MANUAL") {                                // 1.4: one manual mode for everything -> MANUAL on each typed material
      Object.keys(st.manual).forEach(function (k) {
        if (!Object.keys(st.manual[k] || {}).length) return;
        if (k === "SINTER") st.sinterSource = "MANUAL"; else st.matSource[k] = "MANUAL";
      });
    }
    if (st.pending === undefined) st.pending = null;
    st.importOpt = { mode: md === "LAST 2" || md === "LAST N" ? "LAST 2" : "LATEST", staleDays: 3 };
    delete st.overrides;
    return st;
  }

  // ------------------------------------------------------------ helpers
  var isNum = E.isNum;
  function f(x, d) { return isNum(x) ? x.toFixed(d === undefined ? 2 : d) : "-"; }
  function ds(d) { return d instanceof Date ? ("0" + d.getDate()).slice(-2) + "-" + MON[d.getMonth()] + "-" + String(d.getFullYear()).slice(-2) : "-"; }
  function esc(s) { return String(s === null || s === undefined ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function toast(msg) { var t = document.getElementById("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toast.h); toast.h = setTimeout(function () { t.classList.remove("show"); }, 2600); }
  function parseVal(v) { if (v === "" || v === null) return null; var x = parseFloat(String(v).replace(",", ".")); return isFinite(x) ? x : null; }
  function cls(s) { return s === "OK" ? "ok" : "bad"; }
  function compute() {
    if (S.charge && S.charge.on) E.applyCharge(S);     // mix -> kg per charge, PCI solved from kg/tHM
    var rv = E.review(S), R = E.burden(S, rv);
    return { rv: rv, R: R, st: E.status(S, R), F: E.fluxCorrection(S, rv, R), A: E.actualSlag(S), cc: E.chargeChecks(S.charge) };
  }

  // ------------------------------------------------------------ draft analysis + single Submit
  // Analysis choices are edited on a draft. Results keep using the submitted analysis until Submit is tapped.
  var AN = ["importOpt", "sinterSource", "matSource", "manual"];
  function clone(o) { return o === undefined ? undefined : JSON.parse(JSON.stringify(o)); }
  function committedAn() { var o = {}; AN.forEach(function (k) { o[k] = clone(S[k]); }); return o; }
  function draft() { return S.pending || committedAn(); }
  function edit() { if (!S.pending) S.pending = committedAn(); return S.pending; }
  function dirty() { return !!S.pending && JSON.stringify(S.pending) !== JSON.stringify(committedAn()); }
  function changeCount() {
    if (!dirty()) return 0;
    var D = S.pending, n = 0;
    if (D.importOpt.mode !== S.importOpt.mode) n++;
    E.MATERIALS.forEach(function (m) {     // one per material, whether its source or its typed values changed
      var src = m.key === "SINTER" ? (D.sinterSource || "BF REPORT") !== (S.sinterSource || "BF REPORT")
                                   : (D.matSource[m.key] || "BF REPORT") !== (S.matSource[m.key] || "BF REPORT");
      if (src || JSON.stringify(D.manual[m.key] || {}) !== JSON.stringify(S.manual[m.key] || {})) n++;
    });
    return Math.max(n, 1);
  }
  function draftState() { var D = draft(), T = Object.assign({}, S); AN.forEach(function (k) { T[k] = D[k]; }); return T; }
  function computeDraft() { var T = draftState(), rv = E.review(T); return { rv: rv, A: E.actualSlag(T) }; }
  function submitBar() {
    var bar = document.getElementById("submitBar"), n = changeCount();
    var show = n > 0 || tab === "import" || tab === "review";
    bar.classList.toggle("show", show); document.body.classList.toggle("has-submit", show);
    if (!show) return;
    document.getElementById("sbText").innerHTML = n ? "<b>" + n + " change" + (n > 1 ? "s" : "") + " not submitted</b><small>Results still use the last submitted analysis</small>" : "<b>Analysis up to date</b><small>Change a source or type a value, then Submit</small>";
    document.getElementById("sbSubmit").disabled = !n;
    document.getElementById("sbDiscard").style.display = n ? "" : "none";
  }
  function submit() {
    if (!dirty()) { S.pending = null; save(); render(); return; }
    var D = S.pending; AN.forEach(function (k) { S[k] = D[k]; });
    S.pending = null; save(); tab = "results"; window.scrollTo(0, 0); render();
    toast("Analysis submitted - results recalculated");
  }
  function discard() { if (confirm("Discard the changes you have not submitted?")) { S.pending = null; save(); render(); toast("Changes discarded"); } }

  // ------------------------------------------------------------ header
  function header(C) {
    var L = S.lab, mm = { LATEST: "Latest", "LAST 2": "Last two" }[S.importOpt.mode] + (dirty() ? " · pending" : "");
    var sub = (L.importedOn ? "Uploaded " + L.importedOn : "Example analysis (no lab data yet)") + " · " + mm;
    document.getElementById("subline").textContent = sub;
    var h = document.getElementById("headStatus");
    h.className = "pill neutral";
    h.textContent = "B2 " + f(C.R.b2, 2);
  }

  // ------------------------------------------------------------ IMPORT tab
  var MODES = [
    ["LATEST", "Latest analysis from the report", "The last sample of each material. HM & slag: every ladle analysis of the latest day."],
    ["LAST 2", "Last two analyses from the Excel", "Average of the last two samples of each material. HM & slag: the latest two days."]
  ];
  var KEYV = { Ferrous: [["FET", "Fe"], ["SIO2", "SiO2"], ["AL2O3", "Al2O3"], ["CAO", "CaO"], ["MGO", "MgO"]], Flux: [["SIO2", "SiO2"], ["CAO", "CaO"], ["MGO", "MgO"], ["AL2O3", "Al2O3"]],
    Fuel: [["ASH", "Ash"], ["FC", "FC"], ["VM", "VM"], ["MOIST", "M"]] };
  function srcTag(src) { return { "BF REPORT": "BF report", "OTHER FILE": "Other file", "PRODUCTION": "Production", "NEWEST": "Newest Excel", "DEFAULT": "Standard", "MANUAL": "Manual" }[src] || src; }
  function keyVals(group, v) {
    if (!v) return "-";
    return KEYV[group].filter(function (x) { return isNum(v[x[0]]); }).map(function (x) { return '<span class="kv">' + x[1] + "&nbsp;" + f(v[x[0]]) + "</span>"; }).join(" ") || "-";
  }
  function nameOf(k) { var m = E.MATERIALS.filter(function (x) { return x.key === k; })[0]; return m ? m.name : (k === "SINTER_PROD" ? "Sinter - plant production" : k); }
  function vImport(C) {
    var o = draft().importOpt, L = S.lab, h = [];
    h.push('<h2>Upload Excel</h2><div class="card upl"><button class="btn primary big" id="pick"><svg viewBox="0 0 24 24"><path d="M12 15V3m0 0-4 4m4-4 4 4M4 15v5h16v-5"/></svg>Upload Excel files</button>');
    h.push('<p class="hint">Your BF Analysis, Coke and Sinter Production reports, or any other Excel sheet with an analysis in it (.xlsx, .xls, .xlsm, .csv, .ods). Pick several at once. You see what was found before anything changes.</p>'
      + '<div class="linkrow"><label for="linkUrl">Or load from a link</label><div><input id="linkUrl" type="url" inputmode="url" autocomplete="off" spellcheck="false" placeholder="https://… Google Sheets, Drive, OneDrive, Dropbox or file link" value="' + esc(window.BFUrl ? BFUrl.last() : "") + '">'
      + '<button class="btn ghost" id="linkGo">Load</button></div><small>Needs internet. The file is downloaded and read on this device; share it as "Anyone with the link".</small></div></div>');

    h.push("<h2>Uploaded files</h2><div class=\"card tight\">");
    var up = L.uploads || [];
    if (!up.length) h.push('<div class="ufile"><div><b>No reports uploaded yet</b><small>Standard example analyses are in use until you upload your lab Excel files</small></div></div>');
    up.forEach(function (u) {
      var when = new Date(u.when);
      h.push('<div class="ufile"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2h9l5 5v15H6zM14 2v6h6M9 13l6 6m0-6-6 6"/></svg><div><b>' + esc(u.name) + "</b><small>" + ds(when) + " " + ("0" + when.getHours()).slice(-2) + ":" + ("0" + when.getMinutes()).slice(-2)
        + (u.found.length ? " · " + u.found.length + " material(s)" : " · nothing recognised") + (u.actual ? " + HM & slag" : "") + "</small>");
      if (u.found.length) h.push('<div class="chips">' + u.found.map(function (x) { return '<span class="chip' + (x.std ? "" : " sc") + '">' + esc(nameOf(x.k).replace(/ \(.*\)$/, "")) + "</span>"; }).join("") + "</div>");
      h.push("</div></div>");
    });
    h.push("</div>");
    if (up.some(function (u) { return u.found.some(function (x) { return !x.std; }); })) h.push('<p class="hint"><span class="chip sc">blue</span> = scanned from a non-standard sheet.</p>');

    h.push('<h2>Analysis to use</h2><div class="card tight" id="modeBox">');
    MODES.forEach(function (m) {
      h.push('<label class="pick mode"><input type="radio" name="mode" data-mode="' + m[0] + '"' + (o.mode === m[0] ? " checked" : "") + '><div><b>' + m[1] + "</b><small>" + m[2] + "</small></div></label>");
    });
    h.push("</div>");
    if (anyOldFormat()) h.push('<p class="hint warnline">Some stored analyses came from an older version of the app and hold only an average. Upload the reports again so Latest / Last two can be switched for them.</p>');

    h.push('<h2>Analysis in use</h2><div class="card tight scroll"><table><tr><th>Material</th><th>From</th><th class="n">Key values</th></tr>');
    C.rv.forEach(function (r) {
      var v = r.res && r.res.n ? r.res.v : null, d = r.res && r.res.n ? ds(r.res.d2) : "";
      h.push("<tr><td>" + esc(r.m.name) + '</td><td><span class="badge ' + r.source.replace(" ", "_") + '">' + srcTag(r.source) + "</span>" + (d ? '<br><span class="mono">' + d + "</span>" : "") + '</td><td class="n kvs">' + (r.source === "MANUAL" ? "typed" : keyVals(r.m.group, v)) + "</td></tr>");
    });
    h.push("</table></div>");

    var A = C.A;
    h.push('<h2>Actual hot metal &amp; slag</h2><div class="card tight"><table>');
    if (A) {
      h.push('<tr><td>Ladle analyses averaged</td><td class="n">' + A.n + " (" + (A.days > 1 ? A.days + " days to " : "") + ds(A.d2) + ")</td></tr>");
      [["HM Si %", A.HM_SI], ["HM Fe %", A.HM_FE], ["Slag CaO %", A.SL_CAO], ["Slag SiO2 %", A.SL_SIO2], ["Slag Al2O3 %", A.SL_AL2O3], ["Slag MgO %", A.SL_MGO]].forEach(function (x) {
        h.push("<tr><td>" + x[0] + '</td><td class="n">' + f(x[1]) + "</td></tr>"); });
      h.push('<tr><td>Slag B2</td><td class="n">' + f(A.b2, 3) + '</td></tr><tr><td>MgO/Al2O3</td><td class="n">' + f(A.mgoAl, 3) + "</td></tr>");
    } else h.push('<tr><td class="empty">No HM &amp; Slag sheet uploaded</td></tr>');
    h.push("</table></div>");
    h.push('<button class="btn danger" id="resetLab" style="width:100%">Clear uploaded data</button>');
    return h.join("");
  }
  function anyOldFormat() {
    var L = S.lab, old = false;
    [L.bf || {}, L.other || {}].forEach(function (b) { Object.keys(b).forEach(function (k) { if (b[k] && b[k].n > 0 && !b[k].samples) old = true; }); });
    return old;
  }

  // ------------------------------------------------------------ REVIEW tab
  function fallbackProps(r) {          // shown in grey for blank manual fields: the BF report value, else standard
    var v = r.res && r.res.n ? r.res.v : {}, d = r.def, out = {}, ash = S.ash[r.m.ash];
    var std = r.m.group === "Fuel"
      ? { MOIST: d[0], FC: d[1], S: d[9], ASH: ash && ash[1] ? d[5] / ash[1] * 100 : null }
      : { MOIST: d[0], FET: d[2], SIO2: d[5], AL2O3: d[6], CAO: d[3], MGO: d[4], MNO: d[7] / 0.7745, P: d[8], S: d[9], TIO2: d[11] / 0.5995 };
    if (r.m.group === "Fuel" && isNum(std.ASH) && isNum(std.FC)) std.VM = Math.max(0, 100 - std.ASH - std.FC);
    E.MANUAL_FIELDS[r.m.group].forEach(function (x) { out[x[0]] = isNum(v[x[0]]) ? v[x[0]] : std[x[0]]; });
    return out;
  }
  function when(ms) { var t = new Date(ms); return ds(t) + " " + ("0" + t.getHours()).slice(-2) + ":" + ("0" + t.getMinutes()).slice(-2); }
  function srcButtons(k, ch) {
    var opts = ["BF REPORT", "NEWEST", "MANUAL"];
    return '<div class="seg sm" data-src="' + k + '">' + opts.map(function (o) { return '<button data-v="' + o + '" class="' + (ch === o ? "on" : "") + '">' + o + "</button>"; }).join("") + "</div>";
  }
  function vReview(C) {
    var h = [], rv = C.rv;
    var D = draft();
    var modeName = MODES.filter(function (m) { return m[0] === D.importOpt.mode; })[0];
    h.push('<div class="card modeline"><b>' + esc(modeName ? modeName[1] : "") + '</b><button class="btn ghost sm" data-goto="import">Change</button></div>');
    h.push('<div class="card legend"><div><b>BF REPORT</b><span>Your standard BF Analysis Report only.</span></div>'
      + '<div><b>NEWEST</b><span>Only the Excel file you uploaded last that contains this material.</span></div>'
      + '<div><b>MANUAL</b><span>Type the analysis yourself, for any material. Blank fields use the BF report value shown in grey.</span></div>'
      + '<p>No option borrows from another source. If the chosen one has no analysis for a material, standard values are used and it is flagged.</p>'
      + '<p><b>Nothing changes the results until you tap Submit</b> at the bottom: source choices, typed values and Latest / Last two.</p></div>');

    h.push('<h2>Sinter analysis used</h2><div class="seg sm" data-sinter="1">' + ["BF REPORT", "PRODUCTION", "NEWEST", "MANUAL"].map(function (m) {
      return '<button data-v="' + m + '" class="' + ((D.sinterSource || "BF REPORT") === m ? "on" : "") + '">' + (m === "PRODUCTION" ? "PROD." : m) + "</button>"; }).join("") + "</div>");
    h.push('<p class="hint">' + srcLine(rv[E.IDX.SINTER]) + "</p>");

    var bulk = E.MATERIALS.filter(function (m) { return m.key !== "SINTER" && D.matSource[m.key] !== "MANUAL"; });
    var allBf = bulk.length && bulk.every(function (m) { return (D.matSource[m.key] || "BF REPORT") === "BF REPORT"; });
    var allNw = bulk.length && bulk.every(function (m) { return D.matSource[m.key] === "NEWEST"; });
    h.push('<h2>All other materials</h2><div class="seg" id="allSrc"><button data-v="BF REPORT" class="' + (allBf ? "on" : "") + '">BF REPORT</button><button data-v="NEWEST" class="' + (allNw ? "on" : "") + '">NEWEST</button></div>');
    h.push('<p class="hint">Sets every material at once' + (bulk.length < E.MATERIALS.length - 1 ? "; materials on MANUAL keep their typed values" : "") + ". Change any single one below.</p>");

    var nFlag = rv.filter(function (r) { return r.checks.length; }).length;
    h.push('<h2>Materials</h2><div class="seg" data-revf="1">' + [["all", "All"], ["used", "In burden"], ["flag", "Flagged (" + nFlag + ")"]].map(function (x) {
      return '<button data-v="' + x[0] + '" class="' + (revFilter === x[0] ? "on" : "") + '">' + x[1] + "</button>"; }).join("") + "</div>");
    h.push(flagHelp());
    h.push('<div class="mlist">');
    rv.forEach(function (r, i) {
      if (revFilter === "flag" && !r.checks.length) return;
      if (revFilter === "used" && !(+S.qty[i] > 0)) return;
      var k = r.m.key, ch = r.ms.choice, u = r.used;
      h.push('<div class="mcard"><div class="mtop"><div class="nm"><b>' + esc(r.m.name) + "</b><small>" + r.m.group + (+S.qty[i] > 0 ? " · " + f(+S.qty[i], 0) + " kg/charge" : " · not charged") + "</small></div>");
      h.push('<span class="badge ' + r.source.replace(" ", "_") + '">' + srcTag(r.source) + "</span></div>");
      if (k === "SINTER") h.push('<p class="hint" style="margin:6px 0 0">Source set above.</p>');
      else h.push(srcButtons(k, ch));
      if (ch === "MANUAL") {
        var fb = fallbackProps(r), mv = D.manual[k] || {};
        h.push('<div class="mgrid">' + E.MANUAL_FIELDS[r.m.group].map(function (x) {
          return "<label>" + x[1] + ' %<input class="in" inputmode="decimal" data-man="' + k + "," + x[0] + '" value="' + (isNum(mv[x[0]]) ? mv[x[0]] : "") + '" placeholder="' + (isNum(fb[x[0]]) ? +fb[x[0]].toFixed(x[0] === "S" || x[0] === "P" ? 3 : 2) : "") + '"></label>'; }).join("") + "</div>");
      }
      h.push('<div class="vals">' + (r.m.group === "Fuel"
        ? [["FC", u[1]], ["Moist", u[0]], ["S", u[9]], ["Ash SiO2", u[5]], ["Ash Al2O3", u[6]]]
        : [["Fe", u[2]], ["SiO2", u[5]], ["Al2O3", u[6]], ["CaO", u[3]], ["MgO", u[4]], ["Moist", u[0]]]).map(function (x) {
          return "<span><small>" + x[0] + "</small>" + f(x[1]) + "</span>"; }).join("") + "</div>");
      h.push('<p class="meta">' + srcLine(r) + "</p>");
      if (r.checks.length) h.push('<div class="flags">' + r.checks.map(function (c) { return '<span class="flag">' + esc(c) + "</span>"; }).join("") + "</div>");
      if (ch === "MANUAL" && r.nMan) h.push('<button class="btn ghost sm" data-clrman="' + k + '">Clear typed values</button>');
      h.push("</div>");
    });
    h.push("</div>");
    return h.join("");
  }
  function flagHelp() {
    return '<details class="flaghelp card"><summary>What does Flagged mean?</summary>'
      + '<p class="hint" style="margin-top:6px">A flag is a warning on one material\'s analysis: something worth checking before you trust the burden. It does not stop the calculation. "Flagged (n)" lists only the materials that carry at least one.</p><dl>'
      + "<dt>Not in BF report / No uploaded Excel contains this material - standard values</dt><dd>The source you chose has no analysis for it, so the app's built-in standard chemistry is used. Upload the report, or pick another source.</dd>"
      + "<dt>Manual selected but nothing typed</dt><dd>The material is on MANUAL but every field is blank, so the grey BF report values are in use.</dd>"
      + "<dt>Older than 3 days</dt><dd>This analysis is more than 3 days older than the newest analysis uploaded. The material may have changed since.</dd>"
      + "<dt>Fe / SiO2 / Al2O3 / CaO / MgO vs standard &gt;5% or &gt;15%</dt><dd>The value differs from the standard chemistry for this material by more than 5% (Fe) or 15% (the rest). Often a real change in the material, sometimes a typing or sampling error.</dd>"
      + "<dt>FC differs from standard by &gt;3</dt><dd>Fixed carbon of a coke, nut coke or PCI is more than 3 points from its standard.</dd>"
      + "<dt>Moist&gt;25, Fe&gt;72, Fe&lt;30, Mn&gt;60, Oxides&gt;100, FC&lt;60</dt><dd>Values that are physically unlikely for that material. Almost always a typing, column or unit mistake in the sheet.</dd>"
      + '</dl></details>';
  }
  function srcLine(r) {
    var ms = r.ms, rs = r.res, out = [];
    var smp = function () { return rs && rs.n ? (rs.n > 1 ? "average of " + rs.n + " samples to " : "sample of ") + ds(rs.d2) : ""; };
    if (ms.choice === "MANUAL") out.push(r.nMan ? "Typed " + r.nMan + " value(s). Blank fields use the BF report value shown in grey." : "Nothing typed yet. The grey values (BF report) are in use.");
    else if (r.source === "DEFAULT") out.push(ms.choice === "NEWEST" ? "No uploaded Excel contains this material." : ms.choice === "PRODUCTION" ? "No Sinter Production report uploaded." : "Not in the BF report.");
    else if (ms.choice === "NEWEST") out.push("Newest Excel: " + esc(ms.file || "") + (ms.imp ? ", uploaded " + when(ms.imp) : ", bundled with the app") + " · " + smp());
    else out.push(srcTag(r.source) + " · " + smp() + (ms.file ? " · " + esc(ms.file) : ""));
    var alt = ms.cands.filter(function (c) { return !(rs && c.file === ms.file && c.src === ms.src); });
    if (alt.length && ms.choice !== "MANUAL") out.push("also uploaded: " + alt.map(function (c) { return srcTag(c.src) + " " + (c.last ? ds(c.last) : "undated") + (c.imp ? " (" + when(c.imp) + ")" : ""); }).join(", "));
    return out.join("<br>");
  }

  // ------------------------------------------------------------ BURDEN tab
  function inp(k, v, mode) { return '<input class="in" inputmode="' + (mode || "decimal") + '" data-k="' + k + '" value="' + v + '">'; }
  function cin(k, v, w) { return '<input class="in" inputmode="decimal" data-ch="' + k + '" value="' + (v === null || v === undefined ? "" : v) + '"' + (w ? ' style="width:' + w + '"' : "") + ">"; }
  function vCharge(C) {
    var c = S.charge, h = [], p = c.pct || {}, cp = c.cokePct || {};
    var sAgg = (+p.PELLET || 0) + (+p.SINTER || 0) + (+p.ORE || 0) + (+p.ACC || 0);
    var sCk = (+cp.ONLINE || 0) + (+cp.YARD || 0) + (+cp.SPECIAL || 0);
    var ok = function (x) { return Math.abs(x - 100) <= 0.05 ? "ok" : "bad"; };
    var kg = function (i) { return '<small class="mono">' + f(S.qty[i], 0) + " kg</small>"; };
    h.push('<h2>Agglomerate and ore</h2><div class="card">');
    h.push('<label class="f">Total Fe-bearing weight per charge, kg' + cin("oreTotal", c.oreTotal) + "</label>");
    h.push('<div class="qgrid">');
    E.AGGLO.forEach(function (a) {
      var i = E.IDX[a[0] === "ORE" ? (c.oreKey || "TATA") : a[0] === "ACC" ? (c.accKey || "ACC_COLLER") : a[2]];
      h.push('<div class="qrow"><span>' + a[1] + "<br>" + kg(i) + "</span>" + cin("pct." + a[0], p[a[0]]) + "</div>");
    });
    h.push("</div>");
    h.push('<p class="tot ' + ok(sAgg) + '">Split total ' + f(sAgg, 2) + " %</p>");
    h.push('<div class="row"><label class="f">Ore row fed<select data-ch="oreKey" data-t="s"><option value="TATA"' + (c.oreKey === "TATA" ? " selected" : "") + '>Iron ore lump / CLO</option><option value="APHATU"' + (c.oreKey === "APHATU" ? " selected" : "") + ">Iron ore lump 2</option></select></label>");
    h.push('<label class="f">Accretion row fed<select data-ch="accKey" data-t="s"><option value="ACC_COLLER"' + (c.accKey === "ACC_COLLER" ? " selected" : "") + '>Accretion</option><option value="PSB_ACC"' + (c.accKey === "PSB_ACC" ? " selected" : "") + ">PSB accretion</option></select></label></div></div>");
    h.push('<h2>Flux, kg per charge</h2><div class="card"><div class="qgrid">');
    E.FLUXES.forEach(function (fx) { h.push('<div class="qrow"><span>' + fx[1] + "<br>" + kg(E.IDX[fx[0]]) + "</span>" + cin("flux." + fx[0], (c.flux || {})[fx[0]]) + "</div>"); });
    h.push("</div></div>");
    h.push('<h2>Coke</h2><div class="card">');
    h.push('<label class="f">Total coke per charge, kg' + cin("cokeTotal", c.cokeTotal) + "</label>");
    h.push('<div class="qgrid">');
    E.COKES.forEach(function (ck) { h.push('<div class="qrow"><span>' + ck[1] + "<br>" + kg(E.IDX[ck[2]]) + "</span>" + cin("cokePct." + ck[0], cp[ck[0]]) + "</div>"); });
    h.push("</div>");
    h.push('<p class="tot ' + ok(sCk) + '">Split total ' + f(sCk, 2) + " %</p></div>");
    h.push('<h2>Nut coke and injection</h2><div class="card">');
    h.push('<label class="f">Nut coke per charge, kg' + cin("nut", c.nut) + "</label>");
    h.push('<label class="f">PCI coal, kg/tHM' + cin("coalRate", c.coalRate) + "</label>");
    h.push('<p class="hint">PCI is entered per tonne of hot metal, so the app solves back to ' + f(S.qty[E.IDX.COAL], 0) + " kg per charge. Nut coke works out at " + f(C.R.ncDry, 1) + " kg/tHM dry.</p></div>");
    if (C.cc && C.cc.length) h.push('<div class="card"><p class="flag">' + C.cc.map(esc).join("<br>") + "</p></div>");
    h.push('<h2>Derived weights</h2><div class="card tight scroll"><table><tr><th>Material</th><th class="n">kg/charge</th><th class="n">kg/tHM</th></tr>');
    E.MATERIALS.forEach(function (m, i) {
      if (!(+S.qty[i] > 0)) return;
      h.push("<tr><td>" + esc(m.name) + '</td><td class="n">' + f(S.qty[i], 0) + '</td><td class="n">' + f(S.qty[i] / C.R.hm * 1000, 1) + "</td></tr>");
    });
    h.push("</table></div>");
    return h.join("");
  }
  function vBurden(C) {
    var h = [], P = S.params, mix = !!(S.charge && S.charge.on);
    h.push('<h2>How the charge is entered</h2><div class="seg" id="chSeg">');
    h.push('<button data-v="0" class="' + (mix ? "" : "on") + '">Direct kg</button><button data-v="1" class="' + (mix ? "on" : "") + '">Charge mix</button></div>');
    h.push('<p class="hint">' + (mix ? "Enter the mix as percentages and flux weights; the app works out the kg per charge for every material." : "Enter the kg per charge for each material directly.") + "</p>");
    if (mix) h.push(vCharge(C));
    else {
      h.push('<h2>Charge per batch (kg, as weighed)</h2><div class="card tight">');
      ["Ferrous", "Flux", "Fuel"].forEach(function (g) {
        h.push('<div class="grp">' + g + "</div>");
        E.MATERIALS.forEach(function (m, i) {
          if (m.group !== g) return;
          var kg = C.R.rows[i].qty / C.R.hm * 1000;
          h.push('<div class="qrow"><span>' + esc(m.name) + '<br><small class="mono">' + (C.R.rows[i].qty ? f(kg, 1) + " kg/tHM" : "") + '</small></span><input class="in" inputmode="decimal" data-qty="' + i + '" value="' + S.qty[i] + '"></div>');
        });
      });
      h.push("</div>");
    }
    h.push('<h2>Process parameters</h2><div class="card"><div class="grid2">');
    h.push('<label class="f">Quantity basis<select data-k="params.basis" data-t="s"><option' + (P.basis === "WET" ? " selected" : "") + ">WET</option><option" + (P.basis === "DRY" ? " selected" : "") + ">DRY</option></select></label>");
    [["si", "Si in HM %"], ["feRec", "Fe recovery %"], ["feHM", "Fe in HM %"], ["hmC", "C in HM %"], ["chPerHour", "Charges per hour"]].forEach(function (x) {
      h.push('<label class="f">' + x[1] + inp("params." + x[0], P[x[0]]) + "</label>"); });
    h.push("</div></div>");
    h.push('<h2>Blast and oxygen (for production)</h2><div class="card"><div class="grid2">');
    [["blastVol", "Blast volume incl. oxygen Nm3/min"], ["o2Flow", "Oxygen enrichment Nm3/h"], ["o2Purity", "Oxygen purity %"], ["blastMoist", "Blast moisture g/Nm3"]].forEach(function (x) {
      h.push('<label class="f">' + x[1] + inp("params." + x[0], P[x[0]]) + "</label>"); });
    h.push('</div><p class="hint">Used for production from oxygen on the Results tab. The blast volume includes the enrichment oxygen. The direct reduction degree is calculated (Results tab).</p></div>');
    h.push('<h2>Fuel ash composition (% of ash)</h2><div class="card tight scroll"><table><tr><th>Fuel</th><th class="n">Fe2O3</th><th class="n">SiO2</th><th class="n">Al2O3</th><th class="n">CaO</th><th class="n">MgO</th></tr>');
    Object.keys(S.ash).forEach(function (k) {
      h.push("<tr><td>" + k + "</td>" + S.ash[k].map(function (v, j) { return '<td class="n"><input class="in" style="width:70px" inputmode="decimal" data-ash="' + k + "," + j + '" value="' + v + '"></td>'; }).join("") + "</tr>");
    });
    h.push('</table></div><p class="hint">Reports give ash % only; fuel oxides = ash % x these values.</p>');
    h.push('<div class="row" style="margin-top:12px"><button class="btn primary" data-goto="results">See burden results ›</button></div>');
    h.push('<p class="hint">Furnace, chute matrix and gas flow are entered on the Calculator tab; it takes the weights and moisture from here.</p>');
    h.push('<div class="row" style="margin-top:12px">' + (mix ? '<button class="btn ghost" id="resetCharge">Rebuild mix from kg</button>' : "") + '<button class="btn danger" id="resetBurden">Reset charge and parameters</button></div>');
    return h.join("");
  }

  // ------------------------------------------------------------ RESULTS tab
  function kpi(label, val, d, act, unit) {
    return '<div class="kpi calc"><div class="l">' + label + '</div><div class="v">' + f(val, d) + (unit || "") + "</div>" + (isNum(act) ? '<div class="a">Actual ' + f(act, d) + (unit || "") + "</div>" : "") + "</div>";
  }
  function vResults(C) {
    var R = C.R, A = C.A || {}, h = [];
    h.push('<h2>Output slag chemistry</h2><p class="hint" style="margin:-2px 2px 8px">Calculated from the raw material analysis and the charge per batch.</p><div class="kpis">');
    h.push(kpi("CaO in slag", R.cao, 2, A.SL_CAO, "%"));
    h.push(kpi("SiO2 in slag", R.sio2, 2, A.SL_SIO2, "%"));
    h.push(kpi("Al2O3 in slag", R.al2o3, 2, A.SL_AL2O3, "%"));
    h.push(kpi("MgO in slag", R.mgo, 2, A.SL_MGO, "%"));
    h.push(kpi("B2 (CaO/SiO2)", R.b2, 3, A.b2));
    h.push(kpi("B3 (CaO+MgO)/SiO2", R.b3, 3, A.b3));
    h.push(kpi("MgO / Al2O3", R.mgoAl, 3, A.mgoAl));
    h.push(kpi("Slag rate kg/tHM", R.slagRate, 0, null));
    h.push('<div class="kpi calc"><div class="l">Fuel rate kg/tHM</div><div class="v">' + f(R.fuel, 0) + '</div><div class="a">Coke ' + f(R.cokeDry, 0) + " + NC " + f(R.ncDry, 0) + " + PCI " + f(R.coal, 0) + "</div></div>");
    h.push('<div class="kpi calc"><div class="l">Hot metal per charge</div><div class="v">' + f(R.hm / 1000, 2) + ' t</div><div class="a">Slag ' + f(R.slag / 1000, 2) + " t per charge</div></div>");
    h.push("</div>");
    var P = Object.assign({}, E.PARAMS_DEFAULT, S.params);
    h.push('<h2>Production</h2><div class="kpis">');
    h.push('<div class="kpi calc"><div class="l">From charges per hour</div><div class="v">' + f(R.prodCharges, 0) + ' t/day</div><div class="a">' + f(R.hmChargesH, 1) + " tHM/h = " + f(R.hm / 1000, 2) + " t/charge × " + f(P.chPerHour, 1) + " charges/h</div></div>");
    h.push('<div class="kpi calc"><div class="l">Direct reduction degree</div><div class="v">' + f(R.dri, 1) + '%</div><div class="a">Calculated, Rist W point' + (isNum(R.driCh) ? "; " + f(R.driCh, 1) + "% from the charging rate" : "") + "</div></div>");
    h.push('<div class="kpi calc"><div class="l">From oxygen input</div><div class="v">' + (R.hmO2H > 0 ? f(R.prodO2, 0) + " t/day" : "–") + '</div><div class="a">' + f(R.hmO2H, 1) + " tHM/h = " + f(R.o2Total, 0) + " Nm³ O₂/h ÷ " + f(R.o2Spec, 0) + " Nm³ O₂/tHM</div></div>");
    h.push("</div>");
    var gap = R.prodCharges > 0 && R.prodO2 > 0 ? (R.prodO2 / R.prodCharges - 1) * 100 : null;
    h.push('<details class="card method"><summary><b>How production is calculated</b>' + (isNum(gap) ? ' <span class="hint">· oxygen method is ' + f(Math.abs(gap), 1) + "% " + (gap >= 0 ? "higher" : "lower") + "</span>" : "") + "</summary>"
      + '<p><b>1. From charges per hour.</b> Hot metal per charge (from the Fe balance of the burden: Fe charged × Fe recovery ÷ Fe in HM) × charges per hour × 24.</p>'
      + '<p><b>2. From oxygen input</b> (carbon and oxygen balance at the tuyeres; Geerdes, Toxopeus and van der Vliet, <i>Modern Blast Furnace Ironmaking</i>; Rist operating line). Coke and coal burn in front of the tuyeres to CO, C + ½O₂ → CO, so every tonne of hot metal needs a fixed amount of blast oxygen, and the oxygen blown per hour sets the hot metal made per hour.</p><table>'
      + "<tr><td>Air = blast volume × 60 − oxygen flow</td><td class=\"n\">" + f(R.airFlow, 0) + " Nm³/h</td></tr>"
      + "<tr><td>Oxygen in air, 21 %</td><td class=\"n\">" + f(R.o2Air, 0) + " Nm³/h</td></tr>"
      + "<tr><td>Enrichment oxygen × purity</td><td class=\"n\">" + f(R.o2Enrich, 0) + " Nm³/h</td></tr>"
      + "<tr><td>Blast moisture, H₂O + C → CO + H₂ (½ Nm³ O₂ per Nm³ H₂O)</td><td class=\"n\">" + f(R.o2Moist, 0) + " Nm³/h</td></tr>"
      + "<tr><td><b>Total oxygen</b></td><td class=\"n\"><b>" + f(R.o2Total, 0) + " Nm³/h</b></td></tr>"
      + "<tr><td>Fuel carbon (fixed carbon of coke, nut coke, PCI)</td><td class=\"n\">" + f(R.cRate, 1) + " kg/tHM</td></tr>"
      + "<tr><td>− carbon dissolved in hot metal (C in HM %)</td><td class=\"n\">" + f(R.cHM, 1) + " kg/tHM</td></tr>"
      + "<tr><td>Direct reduction degree (below)</td><td class=\"n\">" + f(R.dri, 1) + " %</td></tr>"
      + "<tr><td>− direct reduction, wüstite O × degree × 12</td><td class=\"n\">" + f(R.cDR, 1) + " kg/tHM</td></tr>"
      + "<tr><td>− reduction of Si, Mn, P</td><td class=\"n\">" + f(R.cAlloy, 1) + " kg/tHM</td></tr>"
      + "<tr><td><b>Carbon burnt at the tuyeres</b></td><td class=\"n\"><b>" + f(R.cTuyere, 1) + " kg/tHM</b></td></tr>"
      + "<tr><td>Oxygen needed, × 22.4 ÷ 24</td><td class=\"n\">" + f(R.o2Spec, 0) + " Nm³/tHM</td></tr>"
      + "<tr><td><b>Hot metal from oxygen</b></td><td class=\"n\"><b>" + f(R.hmO2H, 1) + " t/h</b></td></tr></table>"
      + '<p><b>Direct reduction degree</b> (Rist diagram, W point). All gasified carbon (fuel carbon − C in HM = ' + f(R.cGas, 2) + ' kmol/tHM) passes the wüstite zone as CO. That gas can take oxygen from wüstite (FeO<sub>1.05</sub>, ' + f(R.oWus, 2) + ' kmol O/tHM) only up to the Fe/FeO equilibrium, CO₂/(CO+CO₂) = 0.29 at about 1000 °C, times a shaft efficiency of 0.94: ' + f(R.oInd, 2) + ' kmol O. The rest is removed by carbon, so degree = 1 − ' + f(R.oInd, 2) + ' ÷ ' + f(R.oWus, 2) + ' = ' + f(R.dri, 1) + ' %.'
      + (isNum(R.driCh) ? ' Check: the same oxygen balance with the hot metal from charges per hour gives ' + f(R.driCh, 1) + ' %.' : "") + ' Hydrogen from blast moisture and PCI also reduces wüstite, so the real degree is usually a few points lower.</p>'
      + '<p class="hint">Inputs are on the Burden tab (Blast and oxygen, C in HM, charges per hour). PCI carbon is taken as its fixed carbon, which slightly understates carbon at the tuyeres. A steady gap between the two methods usually points to blast volume or oxygen metering, the charge weights, or more hydrogen reduction than assumed.</p></details>');
    var q = S.qty, I = E.IDX, tot = function (ks) { return ks.reduce(function (a, k) { return a + (+q[I[k]] || 0); }, 0); };
    var ore = tot(["PELLET", "SINTER", "TATA", "APHATU", "ACC_COLLER", "PSB_ACC"]), ck = tot(["COKE1", "COKE2", "COKE3", "COKE4"]);
    h.push('<h2>Charge mix</h2><div class="card tight scroll"><table><tr><th></th><th class="n">%</th><th class="n">kg/charge</th><th class="n">kg/tHM</th></tr>');
    var pr = function (nm, kgv, base) { h.push("<tr><td>" + nm + '</td><td class="n">' + (base ? f(kgv / base * 100, 2) : "") + '</td><td class="n">' + f(kgv, 0) + '</td><td class="n">' + f(kgv / R.hm * 1000, 1) + "</td></tr>"); };
    h.push('<tr><td colspan="4" class="grp">Fe-bearing ' + f(ore, 0) + " kg</td></tr>");
    pr("Pellet", +q[I.PELLET] || 0, ore); pr("Sinter", +q[I.SINTER] || 0, ore);
    pr("Ore", (+q[I.TATA] || 0) + (+q[I.APHATU] || 0), ore); pr("Accretion", (+q[I.ACC_COLLER] || 0) + (+q[I.PSB_ACC] || 0), ore);
    h.push('<tr><td colspan="4" class="grp">Flux</td></tr>');
    E.FLUXES.forEach(function (fx) { if (+q[I[fx[0]]] > 0) pr(fx[1], +q[I[fx[0]]], 0); });
    h.push('<tr><td colspan="4" class="grp">Coke ' + f(ck, 0) + " kg</td></tr>");
    E.COKES.forEach(function (c2) { pr(c2[1].replace(" %", ""), +q[I[c2[2]]] || 0, ck); });
    if (+q[I.COKE4] > 0) pr("Coke 4", +q[I.COKE4], ck);
    h.push('<tr><td colspan="4" class="grp">Injection and nut</td></tr>');
    pr("Nut coke", +q[I.NUT] || 0, 0); pr("PCI coal", +q[I.COAL] || 0, 0);
    h.push("</table></div>");
    h.push('<h2>Burden results</h2><div class="card tight"><table><tr><th>Parameter</th><th class="n">Calculated</th><th class="n">Actual</th></tr>');
    var lines = [["Hot metal per charge", R.hm / 1000, 3, null, "t"], ["Slag per charge", R.slag / 1000, 3, null, "t"], ["Slag rate", R.slagRate, 1, null, "kg/tHM"],
      ["CaO in slag", R.cao, 2, A.SL_CAO, "%"], ["SiO2 in slag", R.sio2, 2, A.SL_SIO2, "%"], ["Al2O3 in slag", R.al2o3, 2, A.SL_AL2O3, "%"], ["MgO in slag", R.mgo, 2, A.SL_MGO, "%"],
      ["B2", R.b2, 3, A.b2, ""], ["B3 (CaO+MgO)/SiO2", R.b3, 3, A.b3, ""], ["B4 (CaO+MgO)/(SiO2+Al2O3)", R.b4, 3, null, ""], ["MgO/Al2O3", R.mgoAl, 3, A.mgoAl, ""],
      ["Bosh basicity", R.bosh, 3, null, ""], ["Si in HM (setting)", S.params.si, 2, A.HM_SI, "%"], ["Fe in HM (setting)", S.params.feHM, 2, A.HM_FE, "%"],
      ["Coke rate dry (excl. NC)", R.cokeDry, 1, null, "kg/tHM"], ["Coke rate wet", R.cokeWet, 1, null, "kg/tHM"], ["Nut coke dry", R.ncDry, 1, null, "kg/tHM"],
      ["PCI coal", R.coal, 1, null, "kg/tHM"], ["Fuel rate", R.fuel, 1, null, "kg/tHM"], ["Carbon rate (FC)", R.cRate, 1, null, "kg/tHM"], ["Fe/C", R.feC, 3, null, ""],
      ["Ore/coke (wet)", R.oc, 2, null, ""], ["Fe-bearing rate (wet)", R.feBearing, 0, null, "kg/tHM"], ["Average burden Fe", R.avgFe, 2, null, "%"],
      ["Metallic yield", R.yield, 2, null, "%"], ["Flux rate", R.flux, 1, null, "kg/tHM"], ["Al2O3 load", R.al2o3Load, 1, null, "kg/tHM"], ["Alkali load", R.alkLoad, 2, null, "kg/tHM"],
      ["Sulphur load", R.sLoad, 2, null, "kg/tHM"], ["Mn in HM", R.mnPct, 3, null, "%"], ["P in HM", R.pPct, 3, null, "%"],
      ["Production from charges", R.prodCharges, 0, null, "t/day"], ["Production from oxygen", R.prodO2, 0, null, "t/day"], ["Oxygen per tHM", R.o2Spec, 0, null, "Nm3/tHM"]];
    lines.forEach(function (x) { h.push("<tr><td>" + x[0] + (x[4] ? '<small class="u">' + x[4] + "</small>" : "") + '</td><td class="n"><b>' + f(x[1], x[2]) + '</b></td><td class="n">' + f(x[3], x[2]) + "</td></tr>"); });
    h.push("</table></div>");
    h.push('<h2>Next: burden distribution</h2><div class="card"><p class="hint" style="margin:0 0 10px">The burden calculator takes this charge and the moisture of every material, adds the furnace, chute matrix and gas inputs, and shows where each ring lands, layer thickness and O/C by radius. The 3D distribution then plays the same charge.</p>'
      + '<div class="row"><a class="btn primary" style="text-decoration:none" href="calculator.html">Burden calculator ›</a><a class="btn ghost" style="text-decoration:none" href="simulator.html">3D distribution ›</a></div></div>');
    h.push('<div class="row"><button class="btn primary" id="shareSum"><svg viewBox="0 0 24 24"><path d="M4 12v7h16v-7M12 3v12m0-12-4 4m4-4 4 4"/></svg>Share summary</button><button class="btn ghost" id="shareCsv">Share CSV</button></div>');
    return h.join("");
  }

  // ------------------------------------------------------------ share / export
  function summaryText(C) {
    var R = C.R, A = C.A || {}, L = [];
    L.push("BF Model - BURDEN CHEMISTRY - " + new Date().toLocaleString());
    L.push("Lab files: " + ((S.lab.files || []).join(", ") || "pre-loaded"));
    L.push("Analysis: " + MODES.filter(function (x) { return x[0] === S.importOpt.mode; })[0][1] + " | Sinter: " + E.sinterRow(S).src);
    var nonStd = C.rv.filter(function (r) { return r.source !== "BF REPORT" && +S.qty[r.i] > 0; });
    if (nonStd.length) L.push("Not from BF report: " + nonStd.map(function (r) { return r.m.name + " (" + srcTag(r.source).toLowerCase() + ")"; }).join(", "));
    L.push("");
    L.push("OUTPUT SLAG CHEMISTRY (calculated)");
    L.push("CaO " + f(R.cao) + "%, SiO2 " + f(R.sio2) + "%, Al2O3 " + f(R.al2o3) + "%, MgO " + f(R.mgo) + "%");
    L.push("B2 " + f(R.b2, 3) + (isNum(A.b2) ? "  actual " + f(A.b2, 3) : "") + ", B3 " + f(R.b3, 3) + ", MgO/Al2O3 " + f(R.mgoAl, 3));
    L.push("Slag rate " + f(R.slagRate, 0) + " kg/tHM");
    L.push("Fuel rate " + f(R.fuel, 0) + " (coke " + f(R.cokeDry, 0) + ", NC " + f(R.ncDry, 0) + ", PCI " + f(R.coal, 0) + ") kg/tHM");
    L.push("HM/charge " + f(R.hm / 1000, 2) + " t. Production: " + f(R.prodCharges, 0) + " t/day from charges/hour, " + f(R.prodO2, 0) + " t/day from oxygen (" + f(R.o2Total, 0) + " Nm3/h, " + f(R.o2Spec, 0) + " Nm3/tHM), direct reduction degree " + f(R.dri, 1) + "%");
    L.push("");
    var q = S.qty, I = E.IDX;
    var ore = [I.PELLET, I.SINTER, I.TATA, I.APHATU, I.ACC_COLLER, I.PSB_ACC].reduce(function (a, i) { return a + (+q[i] || 0); }, 0);
    var ck = [I.COKE1, I.COKE2, I.COKE3, I.COKE4].reduce(function (a, i) { return a + (+q[i] || 0); }, 0);
    var pc = function (x) { return ore ? f(x / ore * 100, 1) : "0"; }, cc = function (x) { return ck ? f(x / ck * 100, 1) : "0"; };
    L.push("MIX (" + f(ore, 0) + " kg Fe-bearing): pellet " + pc(+q[I.PELLET] || 0) + "%, sinter " + pc(+q[I.SINTER] || 0)
      + "%, ore " + pc((+q[I.TATA] || 0) + (+q[I.APHATU] || 0)) + "%, accretion " + pc((+q[I.ACC_COLLER] || 0) + (+q[I.PSB_ACC] || 0)) + "%");
    L.push("Flux kg: " + E.FLUXES.map(function (fx) { return fx[1] + " " + f(+q[I[fx[0]]] || 0, 0); }).join(", "));
    L.push("Coke (" + f(ck, 0) + " kg): online " + cc(+q[I.COKE1] || 0) + "%, yard " + cc(+q[I.COKE2] || 0) + "%, special " + cc(+q[I.COKE3] || 0) + "%");
    L.push("Nut coke " + f(+q[I.NUT] || 0, 0) + " kg, PCI " + f(R.coal, 1) + " kg/tHM");
    var fl = C.rv.filter(function (r) { return r.checks.length; });
    if (fl.length) { L.push(""); L.push("Flagged: " + fl.map(function (r) { return r.m.name + " (" + r.checks.join(", ") + ")"; }).join("; ")); }
    return L.join("\n");
  }
  function csvText(C) {
    var L = ["Material,Group,Qty kg/charge,Source," + E.CHEM.join(",") + ",Checks"];
    C.rv.forEach(function (r, i) { L.push('"' + r.m.name + '",' + r.m.group + "," + S.qty[i] + "," + r.source + "," + r.used.map(function (x) { return f(x, 4); }).join(",") + ',"' + r.checks.join("; ") + '"'); });
    L.push(""); L.push("Result,Value");
    var R = C.R;
    [["HM t/charge", R.hm / 1000], ["Slag rate", R.slagRate], ["CaO", R.cao], ["SiO2", R.sio2], ["Al2O3", R.al2o3], ["MgO", R.mgo], ["B2", R.b2], ["B3", R.b3], ["MgO/Al2O3", R.mgoAl],
      ["Coke dry", R.cokeDry], ["Nut coke dry", R.ncDry], ["PCI", R.coal], ["Fuel rate", R.fuel], ["Fe/C", R.feC], ["Production t/day (charges)", R.prodCharges], ["Production t/day (oxygen)", R.prodO2], ["Oxygen Nm3/tHM", R.o2Spec]].forEach(function (x) { L.push(x[0] + "," + f(x[1], 4)); });
    return L.join("\n");
  }
  function share(title, text) {
    if (window.Android && window.Android.share) { window.Android.share(title, text); return; }
    if (navigator.share) { navigator.share({ title: title, text: text }).catch(function () { }); return; }
    try { navigator.clipboard.writeText(text); toast("Copied to clipboard"); } catch (e) { toast("Sharing not available"); }
  }

  // ------------------------------------------------------------ upload files
  function loadLink() {
    var box = document.getElementById("linkUrl"), url = box ? box.value.trim() : "";
    if (!url) { toast("Paste a link first"); if (box) box.focus(); return; }
    if (!window.BFUrl) { toast("Loading from a link is not available here"); return; }
    var go = document.getElementById("linkGo"); if (go) { go.disabled = true; go.textContent = "Loading…"; }
    toast("Downloading…");
    BFUrl.load(url).then(function (fl) { importFiles([fl]); }, function (e) { toast("Could not load the link: " + ((e && e.message) || e)); })
      .then(function () { var g = document.getElementById("linkGo"); if (g) { g.disabled = false; g.textContent = "Load"; } });
  }
  function importFiles(files) {
    if (!files || !files.length) return;
    toast("Reading " + files.length + " file(s)...");
    var list = Array.prototype.slice.call(files), parsed = [], errs = [], info = [];
    var popt = { mode: S.importOpt.mode === "LAST 2" ? "LAST 2" : "LATEST" };
    var next = function (k) {
      if (k >= list.length) return done();
      var fl = list[k], rd = new FileReader();
      rd.onload = function () {
        try {
          var csv = /\.(csv|txt)$/i.test(fl.name);                 // keep CSV dates as typed (dd-mm-yyyy)
          var wb = XLSX.read(new Uint8Array(rd.result), { type: "array", raw: csv });
          var p = E.parseWorkbook(wb, fl.name, popt);
          parsed.push(p);
          info.push({ name: fl.name, actual: !!(p.actual && E.hasData(p.actual)),
            found: Object.keys(p.rows).filter(function (x) { return E.hasData(p.rows[x]); }).map(function (x) { return { k: x, std: !p.rows[x].generic }; }) });
        } catch (e) { errs.push(fl.name); }
        next(k + 1);
      };
      rd.onerror = function () { errs.push(fl.name); next(k + 1); };
      rd.readAsArrayBuffer(fl);
    };
    var done = function () {
      var log = [];
      parsed.forEach(function (p) { p.log.forEach(function (l) { log.push(l); }); });
      pending = { m: E.mergeLab(S.lab, parsed), files: list.map(function (x) { return x.name; }), log: log, errs: errs, info: info };
      showPreview();
    };
    next(0);
  }

  // ------------------------------------------------------------ "update chemistry?" preview
  var pending = null;
  var SHOWK = { Ferrous: [["FET", "Fe"], ["SIO2", "SiO2"], ["AL2O3", "Al2O3"], ["CAO", "CaO"], ["MGO", "MgO"]], Flux: [["SIO2", "SiO2"], ["CAO", "CaO"], ["MGO", "MgO"], ["AL2O3", "Al2O3"], ["R2O3", "R2O3"]],
    Fuel: [["ASH", "Ash"], ["FC", "FC"], ["MOIST", "Moist"]] };
  function srcGroup(key) { var m = E.MATERIALS.filter(function (x) { return x.key === key; })[0]; return m ? m.group : "Ferrous"; }
  function sameRow(a, b) {
    if (!a || !b) return false;
    if (a.n !== b.n) return false;
    var ka = Object.keys(a.v || {}), kb = Object.keys(b.v || {});
    if (ka.length !== kb.length) return false;
    return ka.every(function (k) { return Math.abs(a.v[k] - (b.v || {})[k]) < 1e-9; });
  }
  function items(m) {
    var out = [];
    ["bf", "other"].forEach(function (c) { Object.keys(m[c]).forEach(function (k) { out.push({ c: c, k: k, res: m[c][k], id: c + ":" + k }); }); });
    return out;
  }
  function applySelection(sel) {
    var L = S.lab, now = Date.now();
    var lab = { bf: Object.assign({}, L.bf), other: Object.assign({}, L.other), actual: L.actual, files: L.files, uploads: L.uploads, importedOn: L.importedOn, log: L.log };
    items(pending.m).forEach(function (it) { if (!sel || sel[it.id]) { it.res.imp = now; lab[it.c][it.k] = it.res; } });
    if (pending.m.actual && (!sel || sel.__actual)) lab.actual = pending.m.actual;
    return lab;
  }
  function previewResults(sel) {
    var T = revive(ser(S));
    T.lab = applySelection(sel);
    if (T.charge && T.charge.on) E.applyCharge(T);
    var R = E.burden(T);
    return { R: R, st: E.status(T, R) };
  }
  function willUse(it) {   // tells the operator whether this upload will actually be used, given each material's choice
    var k = it.k === "SINTER_PROD" ? "SINTER" : it.k;
    var D = draft(), ch = k === "SINTER" ? (D.sinterSource || "BF REPORT") : (D.matSource[k] || "BF REPORT");
    var msg = "";
    if (ch === "MANUAL") msg = "Stored. This material is on MANUAL, so typed values are used.";
    else if (ch === "NEWEST") msg = "";                                        // the file just uploaded is the newest
    else if (it.k === "SINTER_PROD" && ch !== "PRODUCTION") msg = "Stored. Used when sinter is set to PRODUCTION or NEWEST.";
    else if (it.c === "other") msg = "Stored. Used only when this material is set to NEWEST.";
    return msg ? '<small class="note">' + msg + "</small>" : "";
  }
  function showPreview() {
    var m = pending.m, h = [], mode = S.importOpt.mode, its = items(m);
    var changed = its.filter(function (it) { return !sameRow(E.pick(S.lab[it.c][it.k], mode), E.pick(it.res, mode)); });
    var same = its.filter(function (it) { return sameRow(E.pick(S.lab[it.c][it.k], mode), E.pick(it.res, mode)); });
    pending.sel = {}; changed.forEach(function (it) { pending.sel[it.id] = true; });
    var actChanged = !!m.actual && !sameRow(E.pickActual(S.lab.actual, mode), E.pickActual(m.actual, mode));
    if (actChanged) pending.sel.__actual = true;
    pending.noChange = !changed.length && !actChanged;
    h.push('<div class="sheet"><div class="sheethead"><b>Files scanned</b><span>' + pending.files.length + " file(s)</span></div><div class=\"sheetbody\">");
    if (pending.errs.length) h.push('<p class="flag">Could not read: ' + esc(pending.errs.join(", ")) + "</p>");
    if (pending.noChange) {
      var found = its.filter(function (it) { return E.hasData(it.res); }).length;
      h.push('<div class="card"><p class="rec">No chemistry change found</p><p class="hint">' + (found ? "The " + found + " analysis(es) found are exactly the ones already in use, so the results stay the same." : "No analysis was recognised in these files. Open Scan details below to see what each sheet held.") + "</p></div>");
    } else {
      h.push('<p class="hint" style="margin-top:0">Tick what to update. Values: current &rarr; new, using ' + esc(MODES.filter(function (x) { return x[0] === mode; })[0][1].toLowerCase()) + ".</p><div class=\"card tight\">");
      changed.forEach(function (it) {
        var o = E.pick(S.lab[it.c][it.k], mode), nw = E.pick(it.res, mode), g = srcGroup(it.k);
        var vals = SHOWK[g].filter(function (x) { return (nw && nw.n && isNum(nw.v[x[0]])) || (o && o.n && isNum(o.v[x[0]])); }).map(function (x) {
          var a = o && o.n ? o.v[x[0]] : null, b = nw && nw.n ? nw.v[x[0]] : null;
          return '<span class="chg' + (isNum(a) && isNum(b) && Math.abs(a - b) > 1e-6 ? " d" : "") + '">' + x[1] + " " + f(a) + " &rarr; " + f(b) + "</span>";
        }).join("");
        h.push('<label class="pick"><input type="checkbox" data-pk="' + it.id + '" checked><div><b>' + esc(nameOf(it.k)) + (it.c === "other" ? ' <span class="chip sc">scanned</span>' : "") + "</b><small>"
          + (nw && nw.n ? (nw.n > 1 ? "average of " + nw.n + " samples to " : "sample of ") + ds(nw.d2) + " - " : "report shows STOP - standard values will be used - ") + esc(it.res.file || "") + "</small>"
          + '<div class="chgs">' + vals + "</div>" + willUse(it) + "</div></label>");
      });
      if (actChanged) {
        var oa = E.pickActual(S.lab.actual, mode), na = E.pickActual(m.actual, mode), ov = oa && oa.v ? oa.v : {}, nv = na.v;
        h.push('<label class="pick"><input type="checkbox" data-pk="__actual" checked><div><b>Actual HM &amp; slag</b><small>' + na.n + " ladle analyses to " + ds(na.d2) + '</small><div class="chgs"><span class="chg d">Slag MgO ' + f(ov.SL_MGO) + " &rarr; " + f(nv.SL_MGO) + '</span><span class="chg d">Al2O3 ' + f(ov.SL_AL2O3) + " &rarr; " + f(nv.SL_AL2O3) + '</span><span class="chg d">B2 ' + f(ov.SL_CAO / ov.SL_SIO2, 3) + " &rarr; " + f(nv.SL_CAO / nv.SL_SIO2, 3) + "</span></div></div></label>");
      }
      h.push("</div>");
      h.push('<h2>Effect on results</h2><div class="card tight" id="pvRes"></div>');
    }
    if (same.length && !pending.noChange) h.push('<p class="hint">Same as now: ' + same.map(function (it) { return esc(nameOf(it.k)); }).join(", ") + "</p>");
    h.push('<details class="card"><summary><b>Scan details</b> (what each sheet held)</summary><table>' + pending.log.map(function (l) {
      return "<tr><td>" + esc(l.sheet) + '<br><span class="mono">' + esc(l.file) + "</span></td><td>" + (l.hits.length ? esc(l.hits.join("; ")) : '<span class="hint">not recognised</span>') + "</td></tr>"; }).join("") + "</table></details>");
    h.push('</div><div class="sheetfoot">');
    if (!pending.noChange) h.push('<button class="btn ghost" id="pvNo">Keep current</button><button class="btn primary" id="pvYes">Update chemistry</button>');
    else h.push('<button class="btn primary" id="pvNo">Close</button>');
    h.push("</div></div>");
    var ov2 = document.getElementById("overlay"); ov2.innerHTML = h.join(""); ov2.classList.add("show");
    updPreview();
  }
  function updPreview() {
    var box = document.getElementById("pvRes"); if (!box) return;
    var cur = window.__C, nw = previewResults(pending.sel);
    var rows = [["B2", "b2", 3], ["MgO %", "mgo", 2], ["Al2O3 %", "al2o3", 2], ["MgO/Al2O3", "mgoAl", 3], ["Slag rate", "slagRate", 0], ["Fuel rate", "fuel", 0], ["HM t/charge", "hm", 2]];
    box.innerHTML = '<table><tr><th></th><th class="n">Current</th><th class="n">After update</th></tr>' + rows.map(function (r) {
      var a = cur.R[r[1]], b = nw.R[r[1]]; if (r[1] === "hm") { a /= 1000; b /= 1000; }
      return "<tr><td>" + r[0] + '</td><td class="n">' + f(a, r[2]) + '</td><td class="n"><b>' + f(b, r[2]) + "</b></td></tr>"; }).join("") + "</table>";
  }
  function closeOverlay() { var ov = document.getElementById("overlay"); ov.classList.remove("show"); ov.innerHTML = ""; }
  function recordUploads(lab) {
    var now = Date.now();
    lab.uploads = (pending.info || []).map(function (x) { return { name: x.name, when: now, found: x.found, actual: x.actual }; }).concat(S.lab.uploads || []).slice(0, 8);
  }
  function applyImport(sel) {
    var lab = applySelection(sel), now = new Date();
    var n = items(pending.m).filter(function (it) { return !sel || sel[it.id]; }).length;
    recordUploads(lab);
    lab.files = pending.files; lab.log = pending.log;
    lab.importedOn = ds(now) + " " + ("0" + now.getHours()).slice(-2) + ":" + ("0" + now.getMinutes()).slice(-2);
    S.lab = lab; save(); closeOverlay(); tab = "results"; window.scrollTo(0, 0); render();
    toast(n + " analysis(es) updated" + (pending.m.actual && (!sel || sel.__actual) ? " + actual slag" : "") + " - results recalculated");
    pending = null;
  }
  document.getElementById("overlay").addEventListener("click", function (e) {
    var t = e.target;
    if (t.id === "pvYes") { applyImport(pending.sel); return; }
    if (t.id === "pvNo") {
      if (pending.noChange) { var lab = Object.assign({}, S.lab); recordUploads(lab); S.lab = lab; save(); render(); toast("Uploaded - nothing changed"); }
      else toast("Chemistry not changed");
      closeOverlay(); pending = null; return;
    }
  });
  document.getElementById("overlay").addEventListener("change", function (e) {
    var t = e.target; if (!t.hasAttribute("data-pk")) return;
    pending.sel[t.getAttribute("data-pk")] = t.checked; updPreview();
  });

  // ------------------------------------------------------------ render + events
  function render() {
    var C = compute();
    header(C);
    var y = window.scrollY;
    var V = (tab === "import" || tab === "review") ? Object.assign({}, C, computeDraft()) : C;
    document.getElementById("view").innerHTML = tab === "import" ? vImport(V) : tab === "review" ? vReview(V) : tab === "burden" ? vBurden(C) : vResults(C);
    submitBar();
    document.querySelectorAll(".tabs button").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-tab") === tab); });
    try { if (location.hash.slice(1) !== tab) history.replaceState(null, "", "#" + tab); } catch (e) { }
    window.scrollTo(0, y);
    window.__C = C;
  }
  function setPath(path, val) { var p = path.split("."), o = S; for (var i = 0; i < p.length - 1; i++) o = o[p[i]]; o[p[p.length - 1]] = val; }
  function seedLab() { return window.SEED_LAB ? E.migrateLab(revive(JSON.stringify(window.SEED_LAB))) : E.emptyLab(); }

  document.querySelector(".tabs").addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    if (b.hasAttribute("data-href")) { location.href = b.getAttribute("data-href"); return; }   // burden calculator and 3D distribution pages
    tab = b.getAttribute("data-tab"); window.scrollTo(0, 0); render();
  });
  document.getElementById("fileInput").addEventListener("change", function (e) { importFiles(e.target.files); e.target.value = ""; });
  var view = document.getElementById("view");
  view.addEventListener("click", function (e) {
    var t = e.target.closest("button"); if (!t) return;
    var par = t.parentElement || {};
    var seg = par.getAttribute && par.getAttribute("data-seg");
    if (seg) { setPath(seg, t.getAttribute("data-v")); save(); render(); return; }
    if (par.getAttribute && par.getAttribute("data-revf")) { revFilter = t.getAttribute("data-v"); render(); return; }
    if (par.getAttribute && par.getAttribute("data-src")) { edit().matSource[par.getAttribute("data-src")] = t.getAttribute("data-v"); save(); render(); return; }
    if (par.getAttribute && par.getAttribute("data-sinter")) { edit().sinterSource = t.getAttribute("data-v"); save(); render(); return; }
    if (par.id === "allSrc") {
      var v = t.getAttribute("data-v");
      var Dm = edit().matSource;
      E.MATERIALS.forEach(function (m) { if (m.key !== "SINTER" && Dm[m.key] !== "MANUAL") Dm[m.key] = v; });
      save(); render(); toast("All set to " + v + " - tap Submit to apply"); return;
    }
    if (t.hasAttribute("data-goto")) { tab = t.getAttribute("data-goto"); window.scrollTo(0, 0); render(); return; }
    if (t.id === "pick") { document.getElementById("fileInput").click(); return; }
    if (t.id === "linkGo") { loadLink(); return; }
    if (par.id === "chSeg") {
      var on = t.getAttribute("data-v") === "1";
      if (on && !S.charge.on) S.charge = E.chargeFromQty(S);   // seed the mix from the kg now in use
      S.charge.on = on; save(); render(); return;
    }
    if (t.id === "resetCharge") { if (confirm("Rebuild the mix from the kg now in use?")) { S.charge = E.chargeFromQty(S); S.charge.on = true; save(); render(); toast("Mix rebuilt from current weights"); } return; }
    if (t.hasAttribute("data-clrman")) { delete edit().manual[t.getAttribute("data-clrman")]; save(); render(); return; }
    if (t.id === "resetLab") { if (confirm("Clear uploaded data and go back to the reports bundled with the app?")) { S.lab = seedLab(); save(); render(); } return; }
    if (t.id === "resetBurden") { if (confirm("Reset charge weights and parameters to the original values?")) { var d = E.defaultState(); S.qty = d.qty; S.params = d.params; S.targets = d.targets; S.ash = d.ash; S.charge.on = false; save(); render(); } return; }
    if (t.id === "shareSum") { share("BF Model burden summary", summaryText(window.__C)); return; }
    if (t.id === "shareCsv") { share("BF Model burden CSV", csvText(window.__C)); return; }
  });
  view.addEventListener("keydown", function (e) { if (e.target.id === "linkUrl" && e.key === "Enter") { e.preventDefault(); loadLink(); } });
  view.addEventListener("change", function (e) {
    var t = e.target;
    if (t.hasAttribute("data-mode")) { edit().importOpt.mode = t.getAttribute("data-mode"); save(); render(); toast("Tap Submit to apply"); return; }
    if (t.hasAttribute("data-k")) { var ty = t.getAttribute("data-t"); setPath(t.getAttribute("data-k"), ty === "b" ? t.checked : ty === "s" ? t.value : (parseVal(t.value) === null ? 0 : parseVal(t.value))); }
    else if (t.hasAttribute("data-ch")) {
      var ck = t.getAttribute("data-ch"), cv = t.getAttribute("data-t") === "s" ? t.value : (parseVal(t.value) || 0), q = ck.split(".");
      if (q.length === 2) S.charge[q[0]][q[1]] = cv; else S.charge[ck] = cv;
    }
    else if (t.hasAttribute("data-qty")) { S.qty[+t.getAttribute("data-qty")] = parseVal(t.value) || 0; }
    else if (t.hasAttribute("data-man")) {
      var p = t.getAttribute("data-man").split(","), val = parseVal(t.value);
      var Dn = edit().manual;
      Dn[p[0]] = Dn[p[0]] || {};
      if (val === null) delete Dn[p[0]][p[1]]; else Dn[p[0]][p[1]] = val;
    }
    else if (t.hasAttribute("data-ash")) { var a = t.getAttribute("data-ash").split(","); S.ash[a[0]][+a[1]] = parseVal(t.value) || 0; }
    else return;
    save(); render();
  });

  document.getElementById("sbSubmit").addEventListener("click", submit);
  document.getElementById("sbDiscard").addEventListener("click", discard);

  window.onNativeFiles = importFiles;
  window.onSharedFile = function (name, b64) {   // Excel received from WhatsApp or a file manager
    var bin = atob(b64), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    tab = "import"; render();
    importFiles([new File([u], name || "shared.xlsx")]);
  };
  window.addEventListener("hashchange", function () {   // desktop menu or a link with #tab while this page is open
    var h = location.hash.slice(1); if (TABS.indexOf(h) >= 0 && h !== tab) { tab = h; window.scrollTo(0, 0); render(); }
  });
  S = load();
  render();
})();
