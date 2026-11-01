/* BF burden chemistry engine - lab report import + all-material burden calculation.
   Same rules as the Excel module (Lab Import / Analysis Review / All Materials / Burden Results). */
(function (root) {
  "use strict";

  var PROPS = ["MOIST", "FET", "FEO", "SIO2", "AL2O3", "R2O3", "CAO", "MGO", "MNO", "FE2O3", "P", "S", "NA2O", "K2O", "TIO2", "LOI", "ASH", "VM", "FC"];
  var SYN = { MOIST: ["MOISTURE", "MOIST", "MOI", "TMOIST"], S: ["S", "OFS"] };
  PROPS.forEach(function (p) { if (!SYN[p]) SYN[p] = [p]; });
  var ACT = ["HM_SI", "HM_FE", "HM_C", "HM_MN", "HM_S", "HM_P", "HM_TI", "SL_SIO2", "SL_CAO", "SL_MGO", "SL_AL2O3", "SL_FEO", "SL_MNO", "SL_NA2O", "SL_K2O"];
  var CHEM = ["Moist", "FC", "Fe", "CaO", "MgO", "SiO2", "Al2O3", "Mn", "P", "S", "Alkali", "Ti"];

  // name, group, sheet, source filter, key column, title keyword, exclude keyword, ash key, default qty, default chem
  var MATERIALS = [
    ["PELLET", "Pellet", "Ferrous", "Pellets|Pellet|BF Pellets", "", "FET", "PELLET", "NUT", null, 4049.5, [3.03, 0, 62.48, 0.74, 0.36, 5.32, 3.22, 0.32, 0.06, 0.01, 0.14, 0.08]],
    ["SINTER", "Sinter", "Ferrous", "Sinter|BF Sinter", "", "FET", "SINTER ANALYSIS", "PRODUCTION", null, 22428, [1.2, 0, 53.74, 11.58, 2.17, 6.24, 2.97, 0.28, 0.01, 0.008, 0.15, 0.183]],
    ["APHATU", "Iron ore lump 2", "Ferrous", "", "", "FET", "", "", null, 0, [4.13, 0, 64.76, 0.07, 0.04, 2.72, 1.54, 0.38, 0.06, 0.01, 0.115, 0.06]],
    ["TATA", "Iron ore lump / CLO", "Ferrous", "I Ore Lump (CLO)|Iron Ore|CLO|Ore", "", "FET", "IRON ORE|ORE LUMP|ORE CLO", "", null, 4672.5, [2.09, 0, 64.49, 0.08, 0.04, 2.14, 1.97, 0.07, 0.03, 0.014, 0.17, 0]],
    ["ACC_COLLER", "Accretion", "Ferrous", "PSB|Accretion", "", "FET", "ACCRETION", "", null, 0, [1.94, 0, 37.33, 0.001, 0.01, 38.56, 4.75, 0.25, 0.06, 0.01, 0.14, 0]],
    ["PSB_ACC", "Accretion 2", "Ferrous", "", "", "FET", "", "", null, 0, [1.94, 0, 37.33, 1.85, 0.84, 38.56, 4.75, 0.25, 0.06, 0.01, 0.14, 0]],
    ["LIMESTONE", "Limestone", "Flux", "Limestone|LST", "", "CAO", "LIMESTONE", "", null, 0, [1.5, 0, 0, 52.05, 1.92, 4.96, 1, 0.01, 0.01, 0.07, 0.3, 0]],
    ["DOLO", "Dolomite", "Flux", "DOLOMITE|Dolo", "", "CAO", "DOLOMITE", "", null, 0, [1.24, 0, 0, 30.26, 21.3, 1.02, 1.12, 0, 0, 0.07, 0.3, 0]],
    ["MN", "Mn ore", "Flux", "", "", "FET", "", "", null, 0, [0.5, 0, 30, 0, 0, 3, 4.9, 32, 0.01, 0.01, 0.343, 0]],
    ["QTZ", "Quartzite", "Flux", "QUARTZITE|Quartz|QTZ", "", "SIO2", "QUARTZ", "", null, 420, [2.1, 0, 0.6, 0, 0, 94.58, 0.71, 0, 0, 0.01, 0.086, 0]],
    ["PYROX", "Pyroxenite", "Flux", "Pyroxinite|Pyroxenite|Pyroxinate", "", "SIO2", "PYROX", "", null, 0, [5.34, 0, 15.64, 0.68, 31.86, 36.27, 2.42, 0, 0, 0, 0, 0]],
    ["COAL", "PCI coal", "Fuel", "PCI|PCI Coal|Coal|CDI", "", "ASH", "PCI|CDI|COAL ANALYSIS", "COKE", "PCI", 3628.571428571428, [0.55, 84.25, 0, 0.62, 0.29, 6, 4, 0, 0.06, 0.6, 0.176, 0]],
    ["COKE1", "Coke 1 (main)", "Fuel", "Coke|BF Coke|Coke Report", "SSPL", "ASH", "COKE ANALYSIS|COKE REPORT", "NUT", "COKE1", 4200, [7, 85.41, 1.25, 0.457296, 0.146988, 7.520886, 3.386168, 0, 0.052, 1, 0.38, 0]],
    ["COKE2", "Coke 2 (yard)", "Fuel", "Coke|BF Coke|Coke Report", "IND", "ASH", "COKE ANALYSIS|COKE REPORT", "NUT", "COKE2", 1800, [7, 84.49, 1.16, 0.52, 0.17, 8.58, 3.85, 0, 0.044, 0.98, 0.38, 0]],
    ["COKE3", "Coke 3 (special)", "Fuel", "Coke|BF Coke|Coke Report", "NMDC", "ASH", "COKE ANALYSIS|COKE REPORT", "NUT", "COKE3", 0, [8, 84.61, 1.3825, 0.53088, 0.17064, 8.73108, 3.93104, 0, 0.055, 0.67, 0.38, 0]],
    ["COKE4", "Coke 4", "Fuel", "Coke|BF Coke|Coke Report", "MAHA", "ASH", "COKE ANALYSIS|COKE REPORT", "NUT", "COKE4", 0, [8, 84.25, 1.2763422, 0.461076, 0.167664, 8.272422, 3.636213, 0, 0.06, 0.67, 0.38, 0]],
    ["NUT", "Nut coke", "Fuel", "Nut Coke|NutCoke|Nut", "", "ASH", "NUT COKE", "", "NUT", 860, [16, 79.55, 0.7, 0.67235, 0.23052, 9.843204, 5.555532, 0, 0.06, 0.6, 0.16, 0]]
  ].map(function (a) {
    return { key: a[0], name: a[1], group: a[2], sheet: a[3], filter: a[4], keyProp: a[5], kw: a[6], excl: a[7], ash: a[8], qty: a[9], chem: a[10] };
  });
  var SOURCES = MATERIALS.map(function (m) { return { key: m.key, sheet: m.sheet, filter: m.filter, keyProp: m.keyProp, kw: m.kw, excl: m.excl }; })
    .concat([{ key: "SINTER_PROD", sheet: "Production Sinter|Sinter Production", filter: "", keyProp: "FET", kw: "SINTER PRODUCTION|PRODUCTION SINTER", excl: "" }]);
  var ACT_SRC = { sheet: "HM & Slag|HM Slag|Hot Metal", kw: "HOT METAL|HM & SLAG", excl: "" };

  // ash composition % of ash: Fe2O3, SiO2, Al2O3, CaO, MgO
  var ASH_DEFAULT = {
    COKE1: [6.92, 53.77, 29.4, 3.44, 1.22], COKE2: [6.44, 53.4, 32.11, 2.74, 0.77], COKE3: [6.44, 53.4, 32.11, 2.74, 0.77],
    COKE4: [6.44, 53.4, 32.11, 2.74, 0.77], NUT: [6.92, 53.77, 29.4, 3.44, 1.22], PCI: [5.923, 52.127, 31.538, 3.677, 1.31]
  };
  var PARAMS_DEFAULT = { basis: "WET", si: 0.6, feRec: 98, feHM: 94.6, mnRec: 65, pRec: 70, minor: 3, boshAsh: 0.3, charges: 159,
    chPerHour: 5.5, blastVol: 2000, o2Flow: 5000, o2Purity: 99.5, blastMoist: 15, dri: 35, hmC: 4.5 };
  // No longer inputs: fixed standard values (Mn and P to hot metal, minor slag constituents, fuel ash reaching the bosh slag)
  var PARAMS_FIXED = { mnRec: 65, pRec: 70, minor: 3, boshAsh: 0.3 };
  function params(state) { return Object.assign({}, PARAMS_DEFAULT, state.params, PARAMS_FIXED); }
  var TARGETS_DEFAULT = { b2: 1.05, b2Tol: 0.03, mgo: 8.5, mgoTol: 0.5, al2o3Max: 18.5, mgoAlMin: 0.45, slagMax: 400 };
  var IMPORT_DEFAULT = { mode: "LATEST", staleDays: 3 };   // LATEST | LAST 2
  var KEEP = 10, KEEP_CASTS = 150;                           // raw samples kept per material / per HM & slag sheet

  // ---------------------------------------------------------------- parsing helpers
  function norm(v) {
    if (v === null || v === undefined) return "";
    return String(v).toUpperCase().replace(/[\s%\.\(\)\-: ]/g, "");
  }
  function num(v) {
    if (typeof v === "number" && isFinite(v)) return v;
    if (typeof v === "string") {
      var t = v.trim().replace(/,/g, "");
      if (t === "" || !/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(t)) return null;
      return parseFloat(t);
    }
    return null;
  }
  function toDate(v) {
    if (v instanceof Date && !isNaN(v)) return new Date(v.getFullYear(), v.getMonth(), v.getDate());
    if (typeof v === "string") {
      var m = v.trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
      if (m) {
        var y = +m[3]; if (y < 100) y += 2000;
        var d = new Date(y, +m[2] - 1, +m[1]);
        if (!isNaN(d)) return d;
      }
    }
    return null;
  }
  function dateCell(ws, r, c) { // Excel serial -> local calendar date (no timezone shift)
    var x = ws[root.XLSX.utils.encode_cell({ r: r - 1, c: c - 1 })];
    if (!x) return null;
    if (x.t === "n" && x.v > 20000 && x.v < 80000) {
      var p = root.XLSX.SSF.parse_date_code(x.v);
      if (p) return new Date(p.y, p.m - 1, p.d);
    }
    if (x.t === "d" && x.v instanceof Date) return new Date(x.v.getFullYear(), x.v.getMonth(), x.v.getDate());
    return toDate(x.v);
  }
  function cell(ws, r, c) { // 1-based
    var x = ws[root.XLSX.utils.encode_cell({ r: r - 1, c: c - 1 })];
    return x ? x.v : null;
  }
  function range(ws) {
    if (!ws["!ref"]) return { r: 0, c: 0 };
    var d = root.XLSX.utils.decode_range(ws["!ref"]);
    return { r: d.e.r + 1, c: d.e.c + 1 };
  }
  function titleOf(ws) {                       // text of the first rows, skipping rows that carry data
    var s = "", r, c;
    for (r = 1; r <= 4; r++) {
      var txt = "", nums = 0;
      for (c = 1; c <= 40; c++) { var v = cell(ws, r, c); if (typeof v === "string") txt += norm(v); else if (num(v) !== null) nums++; }
      if (nums < 2) s += txt;
    }
    return s;
  }
  function alts(s) { return String(s || "").split("|").map(norm).filter(function (x) { return x; }); }
  function matches(name, title, src) {
    var ok = false, nn = norm(name);
    alts(src.kw).forEach(function (k) { if (title.indexOf(k) >= 0) ok = true; });
    alts(src.sheet).forEach(function (k) { if (nn === k) ok = true; });
    alts(src.excl).forEach(function (k) { if (title.indexOf(k) >= 0 || nn.indexOf(k) >= 0) ok = false; });
    return ok;
  }
  var DATE_HDR = ["SAMPLEDATE", "DATEOFANALYSIS", "DATEOFSAMPLING", "SAMPLINGDATE", "DATE"];
  function select(samples, opt, n) {
    if (opt.mode === "LATEST") return samples.slice(-1);
    if (opt.mode === "LAST N") return samples.slice(-Math.max(1, n));
    if (opt.mode === "DATE RANGE") {
      var a = opt.from ? new Date(opt.from + "T00:00:00") : null, b = opt.to ? new Date(opt.to + "T00:00:00") : null;
      return samples.filter(function (s) { return s.d && (!a || s.d >= a) && (!b || s.d <= b); });
    }
    return samples;
  }
  function average(sel, keys) {
    var out = { n: sel.length, d1: sel.length ? sel[0].d : null, d2: sel.length ? sel[sel.length - 1].d : null, v: {} };
    keys.forEach(function (p) {
      var s = 0, m = 0;
      sel.forEach(function (x) { if (x.v[p] !== undefined) { s += x.v[p]; m++; } });
      if (m) out.v[p] = s / m;
    });
    return out;
  }
  function modeN(mode) { return mode === "LAST 2" ? 2 : 1; }
  /** average of the latest 1 or 2 samples kept on a result; old results without samples pass through */
  function pick(res, mode) {
    if (!res) return null;
    if (!res.samples) return res;
    var a = average(res.samples.slice(-modeN(mode)), PROPS);
    a.file = res.file; a.sheet = res.sheet; a.generic = res.generic; a.imp = res.imp; a.total = res.samples.length;
    a.last = res.samples.length ? res.samples[res.samples.length - 1].d : null;
    return a;
  }
  function finish(samples, mode) {
    var s = samples.slice(-KEEP), r = pick({ samples: s }, mode);
    r.samples = s; return r;
  }
  /** HM & slag: LATEST = every cast of the latest day, LAST 2 = every cast of the latest two days */
  function pickActual(a, mode) {
    if (!a) return null;
    if (!a.samples) return a;
    var s = a.samples, days = [];
    s.forEach(function (x) { if (x.d) { var t = +x.d; if (days.indexOf(t) < 0) days.push(t); } });
    days.sort(function (p, q) { return p - q; });
    var keep = days.slice(-modeN(mode));
    var sel = days.length ? s.filter(function (x) { return x.d && keep.indexOf(+x.d) >= 0; }) : s.slice(-modeN(mode));
    var r = average(sel, ACT); r.file = a.file; r.days = keep.length;
    r.last = s.length ? s[s.length - 1].d : null;
    return r;
  }
  function readMaterialSheet(ws, src, opt) {
    var size = range(ws), hdr = 0, r, c;
    for (r = 1; r <= 30 && !hdr; r++) for (c = 1; c <= 60; c++) { var h = norm(cell(ws, r, c)); if (DATE_HDR.indexOf(h) >= 0) { hdr = r; break; } }
    if (!hdr) return null;
    var cols = {}, srcCol = 0;
    PROPS.forEach(function (p) { cols[p] = []; });
    for (c = 1; c <= size.c; c++) {
      var hh = norm(cell(ws, hdr, c));
      PROPS.forEach(function (p) { if (SYN[p].indexOf(hh) >= 0) cols[p].push(c); });
      if (hh === "SOURCE" && !srcCol) srcCol = c;
    }
    var samples = [], last = null;
    for (r = hdr + 1; r <= size.r; r++) {
      var lab = norm(cell(ws, r, 3));
      if (lab === "MAXIMUM" || lab === "MINIMUM" || lab === "AVERAGE") break;
      var d = dateCell(ws, r, 2); if (d) last = d;
      if (src.filter) {
        if (!srcCol) continue;
        var sv = cell(ws, r, srcCol);
        if (String(sv === null ? "" : sv).trim().toUpperCase() !== src.filter.toUpperCase()) continue;
      }
      var v = {};
      PROPS.forEach(function (p) {
        for (var k = 0; k < cols[p].length; k++) { var x = num(cell(ws, r, cols[p][k])); if (x !== null) { v[p] = x; break; } }
      });
      if (v.FC === undefined && v.ASH !== undefined && v.VM !== undefined) v.FC = 100 - v.ASH - v.VM;   // FC column is often a formula
      if (v[src.keyProp] !== undefined) samples.push({ d: last, v: v });
    }
    return finish(samples, opt.mode);
  }
  function readActualSheet(ws, opt) {
    var size = range(ws), hdr = 0, r, c;
    for (r = 1; r <= 30 && !hdr; r++) for (c = 1; c <= 10; c++) if (DATE_HDR.indexOf(norm(cell(ws, r, c))) >= 0) { hdr = r; break; }
    if (!hdr) return null;
    var sub = hdr + 1, slag0 = size.c + 1;
    for (c = 1; c <= size.c; c++) if (norm(cell(ws, hdr, c)).indexOf("SLAG") >= 0) { slag0 = c; break; }
    var colOf = {};
    ACT.forEach(function (k) {
      var side = k.slice(0, 2), nm = k.slice(3);
      for (var cc = 1; cc <= size.c; cc++) if (norm(cell(ws, sub, cc)) === nm && ((cc >= slag0) === (side === "SL"))) { colOf[k] = cc; break; }
    });
    var samples = [], last = null;
    for (r = sub + 1; r <= size.r; r++) {
      var d = dateCell(ws, r, 2); if (d) last = d;
      if (norm(cell(ws, r, 3)) !== "INDIVIDUAL") continue;
      var v = {}, any = false;
      ACT.forEach(function (k) { if (colOf[k]) { var x = num(cell(ws, r, colOf[k])); if (x !== null) { v[k] = x; any = true; } } });
      if (any) samples.push({ d: last, v: v });
    }
    var keep = samples.slice(-KEEP_CASTS), out = pickActual({ samples: keep }, opt.mode);
    out.samples = keep; return out;
  }
  // ---------------------------------------------------------------- universal scan (any workbook layout)
  // Property synonyms as they appear in headers once normalised (spaces, %, dots, brackets, dashes removed).
  var GSYN = {
    MOIST: ["MOISTURE", "MOIST", "MOI", "TMOIST", "TOTALMOISTURE", "FREEMOISTURE", "INHERENTMOISTURE", "H2O", "MOISTURECONTENT"],
    FET: ["FET", "FE", "TFE", "FETOTAL", "TOTALFE", "FETOT", "FETOTAL%"],
    FEO: ["FEO"], FE2O3: ["FE2O3"],
    SIO2: ["SIO2", "SILICA"], AL2O3: ["AL2O3", "ALUMINA", "AL203"], R2O3: ["R2O3"],
    CAO: ["CAO"], MGO: ["MGO", "MAGNESIA"], MNO: ["MNO", "MN3O4", "MN2O3"],
    P: ["P", "PHOSPHORUS", "PHOS"], S: ["S", "SULPHUR", "SULFUR", "OFS", "TS", "TOTALSULPHUR"],
    NA2O: ["NA2O"], K2O: ["K2O"], TIO2: ["TIO2"], LOI: ["LOI", "LOSSONIGNITION"],
    ASH: ["ASH", "ASHCONTENT", "ASHAD", "ASHDB"], VM: ["VM", "VOLATILEMATTER", "VOLATILE", "VMATTER"],
    FC: ["FC", "FIXEDCARBON", "FCARBON"]
  };
  var GIDX = {};
  Object.keys(GSYN).forEach(function (p) { GSYN[p].forEach(function (h) { if (!GIDX[h]) GIDX[h] = p; }); });
  function propOf(h) { return h ? (GIDX[h] || null) : null; }
  // Material name keywords, most specific first. NUT before COKE, Mn ore before plain ore.
  var MATCH = [
    ["NUT", ["NUTCOKE", "NUTCOCK", "NUT"]],
    ["PELLET", ["PELLET", "PELLETS", "PELET"]],
    ["SINTER", ["SINTER"]],
    ["ACC_COLLER", ["ACCRETION", "ACCERTION", "PSB"]],
    ["LIMESTONE", ["LIMESTONE", "LIMESTN", "LST"]],
    ["DOLO", ["DOLOMITE", "DOLOMITIC", "DOLO"]],
    ["QTZ", ["QUARTZITE", "QUARTZ", "QTZ", "SILICASAND"]],
    ["PYROX", ["PYROXENITE", "PYROXINITE", "PYROXINATE", "PYROX"]],
    ["MN", ["MNORE", "MANGANESEORE", "MANGANESE"]],
    ["COAL", ["PCICOAL", "PCI", "CDI", "PULVERISEDCOAL", "PULVERIZEDCOAL", "COAL"]],
    ["COKE1", ["COKE", "COCK"]],
    ["TATA", ["IRONORELUMP", "IRONORE", "ORELUMP", "LUMPORE", "CLO", "IOLUMP", "ORE"]]
  ];
  var COKE_SRC = { SSPL: "COKE1", ONLINE: "COKE1", IND: "COKE2", YARD: "COKE2", NMDC: "COKE3", SPECIAL: "COKE3", MAHA: "COKE4" };
  function matchMaterial(txt) {
    var n = norm(txt);
    if (!n || n.length < 3) return null;
    for (var i = 0; i < MATCH.length; i++) for (var j = 0; j < MATCH[i][1].length; j++) if (n.indexOf(MATCH[i][1][j]) >= 0) return MATCH[i][0];
    return null;
  }
  function cokeVariant(rowText, dflt) {
    var n = norm(rowText);
    var keys = Object.keys(COKE_SRC);
    for (var i = 0; i < keys.length; i++) if (n.indexOf(keys[i]) >= 0) return COKE_SRC[keys[i]];
    return dflt;
  }
  var SUMMARY = ["MAXIMUM", "MINIMUM", "AVERAGE", "AVG", "MEAN", "TOTAL", "SUM", "MAX", "MIN", "STDDEV", "RANGE"];
  var NAME_HDR = ["MATERIAL", "MATERIALNAME", "MATERIALS", "ITEM", "ITEMNAME", "SAMPLE", "SAMPLENAME", "SAMPLEDESCRIPTION", "SAMPLEDESC",
    "PARTICULARS", "PARTICULAR", "DESCRIPTION", "DESC", "NAME", "GRADE", "RAWMATERIAL", "RMNAME", "TYPE", "PRODUCT", "SOURCE"];
  /** rows layout: one header row, properties across columns, material named somewhere in each row (or in a block heading above) */
  function scanRows(ws, hdr, maxR, maxC, opt, sheetKey) {
    var cols = {}, nameCols = [], srcCol = 0, dateCol = 0, c, r, p;
    PROPS.forEach(function (x) { cols[x] = []; });
    for (c = 1; c <= maxC; c++) {
      var h = norm(cell(ws, hdr, c));
      p = propOf(h); if (p && cols[p].indexOf(c) < 0) cols[p].push(c);
      if (NAME_HDR.indexOf(h) >= 0) nameCols.push(c);
      if (h === "SOURCE" && !srcCol) srcCol = c;
      if (!dateCol && DATE_HDR.indexOf(h) >= 0) dateCol = c;
    }
    var searchCols = nameCols.slice();
    for (c = 1; c <= Math.min(6, maxC); c++) if (searchCols.indexOf(c) < 0) searchCols.push(c);
    var byKey = {}, last = null, blockKey = null;
    for (r = hdr + 1; r <= maxR; r++) {
      var skip = false;                          // Maximum / Minimum / Average summary rows are not samples
      for (var tc = 1; tc <= 4; tc++) { var tg = norm(cell(ws, r, tc)); if (SUMMARY.indexOf(tg) >= 0) { skip = true; break; } }
      if (skip) continue;
      if (dateCol) { var d = dateCell(ws, r, dateCol); if (d) last = d; }
      var key = null, hadText = false, rowText = "";
      for (var si = 0; si < searchCols.length; si++) {
        var tv = cell(ws, r, searchCols[si]);
        if (typeof tv === "string" && tv.trim()) { hadText = true; rowText += " " + tv; if (!key) key = matchMaterial(tv); }
      }
      if (!key && !hadText) key = blockKey || sheetKey;   // stacked blocks, or a sheet that is all one material
      if (!key && sheetKey && !nameCols.length) key = sheetKey;
      if (key) blockKey = key; else continue;
      if (key === "COKE1") key = cokeVariant(rowText + " " + (srcCol ? cell(ws, r, srcCol) : ""), "COKE1");
      var v = {}, any = false;
      PROPS.forEach(function (x) {
        for (var k = 0; k < cols[x].length; k++) { var n2 = num(cell(ws, r, cols[x][k])); if (n2 !== null) { v[x] = n2; any = true; break; } }
      });
      if (!any) continue;
      if (v.FC === undefined && v.ASH !== undefined && v.VM !== undefined) v.FC = 100 - v.ASH - v.VM;
      (byKey[key] = byKey[key] || []).push({ d: last, v: v });
    }
    return byKey;
  }
  /** transposed layout: property names run down one column, each column to the right is one material */
  function scanCols(ws, pc, maxR, maxC, opt, sheetKey) {
    var rowOf = {}, r, c, first = 1e9;
    for (r = 1; r <= Math.min(maxR, 120); r++) { var p = propOf(norm(cell(ws, r, pc))); if (p && !rowOf[p]) { rowOf[p] = r; if (r < first) first = r; } }
    var byKey = {};
    for (c = pc + 1; c <= maxC; c++) {
      var key = null, txt = "";
      for (r = 1; r < first; r++) { var tv = cell(ws, r, c); if (typeof tv === "string" && tv.trim()) { txt += " " + tv; if (!key) key = matchMaterial(tv); } }
      if (!key) key = sheetKey;
      if (!key) continue;
      if (key === "COKE1") key = cokeVariant(txt, "COKE1");
      var v = {}, any = false;
      Object.keys(rowOf).forEach(function (x) { var n2 = num(cell(ws, rowOf[x], c)); if (n2 !== null) { v[x] = n2; any = true; } });
      if (!any) continue;
      if (v.FC === undefined && v.ASH !== undefined && v.VM !== undefined) v.FC = 100 - v.ASH - v.VM;
      (byKey[key] = byKey[key] || []).push({ d: null, v: v });
    }
    return byKey;
  }
  /** scan any sheet whatever its title or layout. Returns {key:res} or null */
  function genericSheet(ws, opt, sheetName) {
    var size = range(ws); if (!size.r || !size.c) return null;
    var maxR = Math.min(size.r, 5000), maxC = Math.min(size.c, 80), r, c, n;
    var sheetKey = matchMaterial(sheetName) || matchMaterial(titleOf(ws));   // sheet named or titled after one material
    var best = { r: 0, hits: 0 };
    for (r = 1; r <= Math.min(maxR, 40); r++) {
      n = 0; for (c = 1; c <= maxC; c++) if (propOf(norm(cell(ws, r, c)))) n++;
      if (n > best.hits) best = { r: r, hits: n };
    }
    var byKey = null;
    if (best.hits >= 3) byKey = scanRows(ws, best.r, maxR, maxC, opt, sheetKey);
    if (!byKey || !Object.keys(byKey).length) {
      var bc = { c: 0, hits: 0 };
      for (c = 1; c <= Math.min(maxC, 14); c++) {
        n = 0; for (r = 1; r <= Math.min(maxR, 120); r++) if (propOf(norm(cell(ws, r, c)))) n++;
        if (n > bc.hits) bc = { c: c, hits: n };
      }
      if (bc.hits >= 3) byKey = scanCols(ws, bc.c, maxR, maxC, opt, sheetKey);
    }
    if (!byKey || !Object.keys(byKey).length) return null;
    var out = {};
    Object.keys(byKey).forEach(function (k) {
      var list = byKey[k], dated = list.filter(function (x) { return x.d; });
      var res = finish(dated.length ? dated : list, opt.mode);
      res.generic = true; out[k] = res;
    });
    return out;
  }

  /** how many different materials are named in the left-hand text of a sheet */
  function distinctMaterials(ws) {
    var size = range(ws), seen = {}, n = 0, r, c;
    var R = Math.min(size.r, 500), C = Math.min(size.c, 8);
    for (r = 1; r <= R; r++) for (c = 1; c <= C; c++) {
      var v = cell(ws, r, c);
      if (typeof v !== "string") continue;
      var k = matchMaterial(v);
      if (k && !seen[k]) { seen[k] = 1; n++; }
    }
    return n;
  }

  /** parse one workbook (SheetJS object). Returns {rows:{key:res}, actual:res|null} */
  function parseWorkbook(wb, fileName, opt) {
    var out = { rows: {}, actual: null, log: [] };
    wb.SheetNames.forEach(function (name) {
      var ws = wb.Sheets[name]; if (!ws || !ws["!ref"]) return;
      var title = titleOf(ws), hits = [], produced = 0, early = null;
      if (distinctMaterials(ws) >= 2) {           // several materials on one sheet: read it row by row instead
        var ge = genericSheet(ws, opt, name);
        if (ge && Object.keys(ge).length >= 2) early = ge;
      }
      if (early) {
        Object.keys(early).forEach(function (k) {
          var res = early[k]; if (!res.n) return;
          res.file = fileName; res.sheet = name;
          hits.push(k + ": " + res.n + " sample(s) (scanned)");
          var cur = out.rows[k];
          if (!cur || !cur.n || (cur.generic && (!cur.d2 || (res.d2 && res.d2 > cur.d2)))) out.rows[k] = res;
        });
        out.log.push({ file: fileName, sheet: name, hits: hits });
        return;
      }
      SOURCES.forEach(function (src) {
        if (!(src.sheet || src.kw) || !matches(name, title, src)) return;
        var res = readMaterialSheet(ws, src, opt);
        if (!res) { hits.push(src.key + ": no 'Sample Date' header"); return; }
        res.file = fileName; res.sheet = name;
        hits.push(src.key + ": " + res.n + " sample(s)");
        if (res.n > 0) produced++;
        var cur = out.rows[src.key];
        if (!cur || (res.n > 0 && (!cur.d2 || (res.d2 && res.d2 > cur.d2)))) out.rows[src.key] = res;
      });
      if (matches(name, title, ACT_SRC)) {
        var a = readActualSheet(ws, opt);
        if (a) { a.file = fileName; hits.push("ACTUAL HM/slag: " + a.n + " cast(s)"); if (a.n > 0) produced++; if (!out.actual || (a.n > 0 && (!out.actual.d2 || a.d2 > out.actual.d2))) out.actual = a; }
      }
      if (!produced) {                                   // unknown title or layout: scan it anyway
        var g = genericSheet(ws, opt, name);
        if (g) Object.keys(g).forEach(function (k) {
          var res = g[k]; if (!res.n) return;
          res.file = fileName; res.sheet = name;
          hits.push(k + ": " + res.n + " sample(s) (scanned)");
          var cur = out.rows[k];                          // never displace a known-format result that has samples
          if (!cur || !cur.n || (cur.generic && (!cur.d2 || (res.d2 && res.d2 > cur.d2)))) out.rows[k] = res;
        });
      }
      out.log.push({ file: fileName, sheet: name, hits: hits });
    });
    return out;
  }
  // ---------------------------------------------------------------- stored lab data
  // bf    = results from the standard reports (BF Analysis / Coke / Sinter Production), read by title
  // other = results scanned from any other Excel file
  // Each result keeps its last raw samples, so Latest / Last two can be switched without re-uploading.
  function emptyLab() { return { bf: {}, other: {}, actual: null, files: [], uploads: [], importedOn: null }; }
  function migrateLab(lab) {
    if (!lab) return emptyLab();
    if (lab.bf || lab.other) { lab.bf = lab.bf || {}; lab.other = lab.other || {}; lab.uploads = lab.uploads || []; lab.files = lab.files || []; return lab; }
    var out = emptyLab();
    out.actual = lab.actual || null; out.files = lab.files || []; out.importedOn = lab.importedOn || null;
    Object.keys(lab.rows || {}).forEach(function (k) { var r = lab.rows[k]; if (r) (r.generic ? out.other : out.bf)[k] = r; });
    return out;
  }
  function hasData(r) { return !!r && ((r.samples && r.samples.length > 0) || r.n > 0); }
  function lastDate(r) {
    if (!r) return null;
    if (r.samples && r.samples.length) { for (var i = r.samples.length - 1; i >= 0; i--) if (r.samples[i].d) return r.samples[i].d; return null; }
    return r.d2 || null;
  }
  function newer(a, b) {                       // is result a newer than result b?
    var da = lastDate(a), db = lastDate(b);
    if (da && db && +da !== +db) return da > db;
    if (da && !db) return true;
    if (!da && db) return false;
    return (+a.imp || 0) > (+b.imp || 0);      // undated scans: the later upload wins
  }
  /** files parsed in one upload -> newest standard-report and newest other-file result per material */
  function mergeLab(lab, parsedList) {
    var bf = {}, other = {}, actual = null;
    parsedList.forEach(function (p) {
      Object.keys(p.rows).forEach(function (k) {
        var res = p.rows[k];
        if (!hasData(res)) { if (!res.generic && !bf[k]) bf[k] = res; return; }   // report says STOP: keep it, standard values will be used
        var bucket = res.generic ? other : bf;
        if (!hasData(bucket[k]) || newer(res, bucket[k])) bucket[k] = res;
      });
      if (p.actual && hasData(p.actual) && (!actual || newer(p.actual, actual))) actual = p.actual;
    });
    return { bf: bf, other: other, actual: actual };
  }

  // ---------------------------------------------------------------- chemistry
  function isNum(x) { return typeof x === "number" && isFinite(x); }
  function labChem(m, res, ash) {
    var out = CHEM.map(function () { return null; });
    if (!res || !res.n) return out;
    var v = res.v, g = function (k) { return isNum(v[k]) ? v[k] : null; };
    out[0] = g("MOIST"); out[1] = g("FC"); out[9] = g("S");
    if (m.group === "Fuel") {
      var a = g("ASH"), c = ash[m.ash];
      if (a !== null && c) { out[2] = a * c[0] / 100 * 0.6994; out[3] = a * c[3] / 100; out[4] = a * c[4] / 100; out[5] = a * c[1] / 100; out[6] = a * c[2] / 100; }
    } else {
      out[2] = g("FET") !== null ? g("FET") : (g("FE2O3") !== null ? g("FE2O3") * 0.6994 : null);
      out[3] = g("CAO"); out[4] = g("MGO"); out[5] = g("SIO2");
      out[6] = g("AL2O3") !== null ? g("AL2O3") : g("R2O3");
      out[7] = g("MNO") !== null ? g("MNO") * 0.7745 : null;
      out[8] = g("P");
      out[10] = (g("NA2O") !== null || g("K2O") !== null) ? (g("NA2O") || 0) + (g("K2O") || 0) : null;
      out[11] = g("TIO2") !== null ? g("TIO2") * 0.5995 : null;
    }
    return out;
  }
  var FUEL_KEYS = ["COAL", "COKE1", "COKE2", "COKE3", "COKE4", "NUT"];
  /** is result a from a later upload than b? Same upload: the later sample. */
  function laterUpload(a, b) {
    var ia = +a.imp || 0, ib = +b.imp || 0;
    if (ia !== ib) return ia > ib;
    return newer(a, b);
  }
  /** which analysis a material uses. Every choice is strict - nothing is borrowed from another source:
      BF REPORT  = the standard BF Analysis Report only (coke from its Coke sheet)
      PRODUCTION = sinter only, the Sinter Production report only
      NEWEST     = the Excel file uploaded most recently that contains this material, only
      MANUAL     = any material, typed by the operator (blank fields show the BF report value)
      If the chosen source has no analysis, standard values are used and flagged. */
  function materialSource(state, key) {
    var L = state.lab || emptyLab(), mode = (state.importOpt || {}).mode, cands = [];
    var bf = (L.bf || {})[key], ot = (L.other || {})[key], choice;
    if (hasData(bf)) cands.push({ r: bf, src: "BF REPORT" });
    if (hasData(ot)) cands.push({ r: ot, src: "OTHER FILE" });
    if (key === "SINTER") {
      choice = state.sinterSource || "BF REPORT";
      var pr = (L.bf || {}).SINTER_PROD || (L.other || {}).SINTER_PROD;
      if (hasData(pr)) cands.push({ r: pr, src: "PRODUCTION" });
    } else {
      choice = (state.matSource || {})[key] || "BF REPORT";
      if (choice === "PRODUCTION") choice = "BF REPORT";
    }
    var c = null;
    if (choice === "NEWEST") cands.forEach(function (x) { if (!c || laterUpload(x.r, c.r)) c = x; });
    else { var want = choice === "MANUAL" ? "BF REPORT" : choice; c = cands.filter(function (x) { return x.src === want; })[0] || null; }
    return {
      row: c ? pick(c.r, mode) : null, src: c ? c.src : "DEFAULT", choice: choice,
      file: c ? c.r.file : null, imp: c ? c.r.imp || null : null,
      cands: cands.map(function (x) { return { src: x.src, last: lastDate(x.r), file: x.r.file, sheet: x.r.sheet, imp: x.r.imp || null, n: x.r.samples ? x.r.samples.length : x.r.n }; })
    };
  }
  function sinterRow(state) { var s = materialSource(state, "SINTER"); return { row: s.row, src: s.src }; }
  // fields offered for manual entry
  var MANUAL_FIELDS = {
    Ferrous: [["MOIST", "Moist"], ["FET", "Fe(T)"], ["SIO2", "SiO2"], ["AL2O3", "Al2O3"], ["CAO", "CaO"], ["MGO", "MgO"], ["MNO", "MnO"], ["P", "P"], ["S", "S"], ["TIO2", "TiO2"]],
    Fuel: [["MOIST", "Moist"], ["ASH", "Ash"], ["VM", "VM"], ["FC", "FC"], ["S", "S"]]
  };
  MANUAL_FIELDS.Flux = MANUAL_FIELDS.Ferrous;
  /** per material: the analysis used, where it came from, and checks */
  function review(state) {
    var L = state.lab || emptyLab(), maxD = null;
    var stale = (state.importOpt || {}).staleDays || 3;
    [L.bf || {}, L.other || {}].forEach(function (b) { Object.keys(b).forEach(function (k) { var d = lastDate(b[k]); if (d && (!maxD || d > maxD)) maxD = d; }); });
    return MATERIALS.map(function (m, i) {
      var ms = materialSource(state, m.key), res = ms.row, manual = ms.choice === "MANUAL";
      var mv = manual ? ((state.manual || {})[m.key] || {}) : {};
      var nMan = Object.keys(mv).filter(function (k) { return isNum(mv[k]); }).length;
      var v = Object.assign({}, res && res.n ? res.v : {});
      Object.keys(mv).forEach(function (k) { if (isNum(mv[k])) v[k] = mv[k]; });
      if (nMan && m.group === "Fuel" && !isNum(mv.FC) && (isNum(mv.ASH) || isNum(mv.VM)) && isNum(v.ASH) && isNum(v.VM)) v.FC = 100 - v.ASH - v.VM;
      var lab = labChem(m, { n: Object.keys(v).length ? 1 : 0, v: v }, state.ash), def = state.defaults[i];
      var used = CHEM.map(function (_, j) { return isNum(lab[j]) ? lab[j] : def[j]; });
      var source = manual ? "MANUAL" : !res ? "DEFAULT" : ms.choice === "NEWEST" ? "NEWEST" : ms.src;
      var u = used, f = [];
      if (source === "DEFAULT" && +state.qty[i] > 0) f.push(ms.choice === "NEWEST" ? "No Excel has this material - standard values" : ms.choice === "PRODUCTION" ? "No production report - standard values" : "Not in BF report - standard values");
      if (manual && !nMan && +state.qty[i] > 0) f.push("Manual selected but nothing typed");
      if (u[0] > 25) f.push("Moist>25");
      if (u[2] > 72) f.push("Fe>72");
      if (m.group === "Ferrous" && u[2] < 30) f.push("Fe<30");
      if (u[7] > 60) f.push("Mn>60");
      if (u[2] * 1.43 + u[3] + u[4] + u[5] + u[6] + u[7] * 1.29 > 101) f.push("Oxides>100");
      if (m.group === "Fuel" && u[1] < 60) f.push("FC<60");
      if (m.group !== "Fuel") [[2, 0.05, 0, "Fe"], [5, 0.15, 0, "SiO2"], [6, 0.15, 0, "Al2O3"], [3, 0.15, 0.5, "CaO"], [4, 0.15, 0.5, "MgO"]].forEach(function (t) {
        var j = t[0];
        if (isNum(lab[j]) && def[j] > t[2] && def[j] > 0 && Math.abs(lab[j] - def[j]) / def[j] > t[1]) f.push(t[3] + " vs standard >" + Math.round(t[1] * 100) + "%");
      });
      else if (isNum(lab[1]) && def[1] > 0 && Math.abs(lab[1] - def[1]) > 3) f.push("FC differs from standard by >3");
      if (!manual && res && res.d2 && maxD && (maxD - res.d2) / 86400000 > stale) f.push("Older than " + stale + " days");
      return { m: m, i: i, res: res, ms: ms, lab: lab, def: def, used: used, source: source, nMan: nMan, nLab: lab.filter(isNum).length, checks: f };
    });
  }

  // ---------------------------------------------------------------- burden
  function burden(state, rv) {
    rv = rv || review(state);
    var P = params(state), q = state.qty;
    var T = { dry: 0, fe: 0, cao: 0, mgo: 0, sio2: 0, al2o3: 0, mn: 0, p: 0, s: 0, alk: 0, ti: 0, c: 0 };
    var rowsK = rv.map(function (r, i) {
      var u = r.used, qty = +q[i] || 0;
      var dry = P.basis === "DRY" ? qty : qty * (1 - u[0] / 100);
      var k = { qty: qty, dry: dry, fe: dry * u[2] / 100, cao: dry * u[3] / 100, mgo: dry * u[4] / 100, sio2: dry * u[5] / 100, al2o3: dry * u[6] / 100,
        mn: dry * u[7] / 100, p: dry * u[8] / 100, s: dry * u[9] / 100, alk: dry * u[10] / 100, ti: dry * u[11] / 100, c: dry * u[1] / 100 };
      Object.keys(T).forEach(function (x) { T[x] += k[x]; });
      return k;
    });
    var sum = function (a, b, f) { var s = 0; for (var i = a; i <= b; i++) s += rowsK[i][f]; return s; };
    var R = {};
    R.hm = T.fe * P.feRec / 100 / (P.feHM / 100);
    R.si = R.hm * P.si / 100;
    R.sio2Red = R.si * 60.08 / 28.09;
    R.mnHM = T.mn * P.mnRec / 100;
    R.mnoSlag = (T.mn - R.mnHM) * 70.94 / 54.94;
    R.sio2Slag = T.sio2 - R.sio2Red;
    R.slag = (T.cao + T.mgo + R.sio2Slag + T.al2o3 + R.mnoSlag) / (1 - P.minor / 100);
    R.slagRate = R.slag / R.hm * 1000;
    R.cao = T.cao / R.slag * 100; R.sio2 = R.sio2Slag / R.slag * 100; R.al2o3 = T.al2o3 / R.slag * 100; R.mgo = T.mgo / R.slag * 100;
    R.b2 = T.cao / R.sio2Slag; R.b3 = (T.cao + T.mgo) / R.sio2Slag; R.b4 = (T.cao + T.mgo) / (R.sio2Slag + T.al2o3); R.mgoAl = T.mgo / T.al2o3;
    R.bosh = (sum(0, 10, "cao") + sum(11, 16, "cao") * P.boshAsh) / (sum(0, 10, "sio2") + sum(11, 16, "sio2") * P.boshAsh - R.sio2Red);
    R.cokeWet = sum(12, 15, "qty") / R.hm * 1000; R.cokeDry = sum(12, 15, "dry") / R.hm * 1000;
    R.ncWet = rowsK[16].qty / R.hm * 1000; R.ncDry = rowsK[16].dry / R.hm * 1000;
    R.coal = rowsK[11].qty / R.hm * 1000;
    R.fuel = R.cokeDry + R.ncDry + R.coal;
    R.cRate = T.c / R.hm * 1000; R.feC = T.fe / T.c;
    R.burdenRatio = sum(0, 5, "qty") / sum(11, 16, "qty");
    R.oc = sum(0, 5, "qty") / sum(12, 16, "qty");
    R.feBearing = sum(0, 5, "qty") / R.hm * 1000;
    R.avgFe = sum(0, 5, "fe") / sum(0, 5, "dry") * 100;
    R.yield = R.hm / sum(0, 5, "dry") * 100;
    R.flux = sum(6, 10, "qty") / R.hm * 1000;
    R.al2o3Load = T.al2o3 / R.hm * 1000; R.alkLoad = T.alk / R.hm * 1000; R.sLoad = T.s / R.hm * 1000;
    R.mnPct = R.mnHM / R.hm * 100; R.pPct = T.p * P.pRec / 100 / R.hm * 100; R.tiPct = T.ti * 0.5 / R.hm * 100;
    // Production 1, from the charging rate: hot metal per charge x charges per hour
    R.hmChargesH = R.hm / 1000 * P.chPerHour;
    R.prodCharges = R.hmChargesH * 24;
    // Production 2, from the oxygen blown (carbon/oxygen balance at the tuyeres, C + 1/2 O2 -> CO):
    // oxygen in = air O2 + enrichment O2 + O2 equivalent of blast moisture (H2O + C -> CO + H2).
    // The blast volume already includes the enrichment oxygen, so the air part is blast volume - oxygen flow.
    R.airFlow = Math.max(0, P.blastVol * 60 - P.o2Flow);
    R.o2Air = R.airFlow * 0.21;
    R.o2Enrich = P.o2Flow * P.o2Purity / 100;
    R.o2Moist = P.blastVol * 60 * P.blastMoist / 1000 * 22.414 / 18.015 * 0.5;
    R.o2Total = R.o2Air + R.o2Enrich + R.o2Moist;
    // carbon burnt at the tuyeres per tHM = fuel carbon - carbon dissolved in hot metal - carbon used for direct reduction of
    // FeO and for reducing Si, Mn and P (these leave as CO without needing blast oxygen)
    R.cHM = P.hmC * 10;
    // Direct reduction degree from the Rist diagram W point: all gasified carbon passes the wustite zone as CO, and the gas can
    // take up oxygen from wustite (FeO1.05) only up to the Fe/FeO equilibrium, CO2/(CO+CO2) = 0.29 at about 1000 C, times the
    // shaft efficiency (0.94). The rest of the wustite oxygen is removed by carbon (direct reduction). Hydrogen is not counted.
    R.nFe = P.feHM * 10 / 55.845;                                    // kmol Fe per tHM
    R.oWus = 1.05 * R.nFe;                                           // kmol O in wustite per tHM
    R.cGas = (R.cRate - P.hmC * 10) / 12.011;                        // kmol C gasified per tHM
    R.oInd = Math.min(R.oWus, 0.29 * 0.94 * R.cGas);
    R.dri = R.oWus > 0 ? (1 - R.oInd / R.oWus) * 100 : 0;
    R.cDR = R.oWus * R.dri / 100 * 12.011;
    R.cAlloy = P.si * 10 * 2 * 12.011 / 28.086 + R.mnHM / R.hm * 1000 * 12.011 / 54.938 + T.p * P.pRec / 100 / R.hm * 1000 * 2.5 * 12.011 / 30.974;
    R.cTuyere = R.cRate - R.cHM - R.cDR - R.cAlloy;
    R.o2Spec = R.cTuyere * 22.414 / (2 * 12.011);                 // Nm3 O2 per tHM
    R.hmO2H = R.o2Spec > 0 ? R.o2Total / R.o2Spec : 0;
    R.prodO2 = R.hmO2H * 24;
    // the direct reduction degree the charging rate implies (same balance solved the other way round), as a check
    R.cTuyereCh = R.hmChargesH > 0 ? R.o2Total / R.hmChargesH * 2 * 12.011 / 22.414 : 0;
    R.driCh = R.oWus > 0 && R.hmChargesH > 0 ? (R.cRate - R.cHM - R.cAlloy - R.cTuyereCh) / 12.011 / R.oWus * 100 : null;
    R.production = R.prodCharges;
    R.T = T; R.rows = rowsK;
    return R;
  }
  function status(state, R) {
    var t = state.targets, s = {};
    s.slagRate = R.slagRate <= t.slagMax ? "OK" : "HIGH";
    s.al2o3 = R.al2o3 <= t.al2o3Max ? "OK" : "HIGH";
    s.mgo = Math.abs(R.mgo - t.mgo) <= t.mgoTol ? "OK" : (R.mgo < t.mgo ? "LOW - add dolomite" : "HIGH - cut dolomite");
    s.b2 = Math.abs(R.b2 - t.b2) <= t.b2Tol ? "OK" : (R.b2 < t.b2 ? "LOW - add limestone / cut quartz" : "HIGH - add quartz / cut limestone");
    s.mgoAl = R.mgoAl >= t.mgoAlMin ? "OK" : "LOW - add MgO";
    return s;
  }
  function fluxCorrection(state, rv, R) {
    var P = state.params, t = state.targets, idx = { lime: 6, dolo: 7, qtz: 9 }, co = {};
    Object.keys(idx).forEach(function (k) {
      var u = rv[idx[k]].used, kk = P.basis === "DRY" ? 1 : 1 - u[0] / 100;
      var ca = kk * u[3] / 100, mg = kk * u[4] / 100, si = kk * u[5] / 100;
      var sl = (ca + mg + si + kk * u[6] / 100) / (1 - P.minor / 100);
      co[k] = { cur: +state.qty[idx[k]] || 0, e1: ca - t.b2 * si, e2: mg - t.mgo / 100 * sl };
    });
    var R1 = t.b2 * R.sio2Slag - R.T.cao, R2 = t.mgo / 100 * R.slag - R.T.mgo;
    function solve(x) {
      var a = co[x], d = co.dolo, det = a.e1 * d.e2 - d.e1 * a.e2;
      if (!det) return null;
      var dx = (R1 * d.e2 - d.e1 * R2) / det, dd = (a.e1 * R2 - R1 * a.e2) / det;
      return { dx: dx, dd: dd, nx: a.cur + dx, nd: d.cur + dd, ok: a.cur + dx >= -0.5 && d.cur + dd >= -0.5 };
    }
    var A = solve("lime"), B = solve("qtz"), st = status(state, R), rec;
    if (st.b2 === "OK" && st.mgo === "OK") rec = "B2 and MgO on target - no flux change needed";
    else if (A && A.ok) rec = "Option A: limestone " + Math.round(A.nx) + " kg + dolomite " + Math.round(A.nd) + " kg per charge";
    else if (B && B.ok) rec = "Option B: quartzite " + Math.round(B.nx) + " kg + dolomite " + Math.round(B.nd) + " kg per charge";
    else rec = "Flux alone cannot meet both targets - change sinter B2/MgO or the pellet/ore/sinter mix";
    return { A: A, B: B, R1: R1, R2: R2, rec: rec };
  }
  function actualSlag(state) {
    var a0 = state.lab && state.lab.actual; if (!hasData(a0)) return null;
    var a = pickActual(a0, (state.importOpt || {}).mode); if (!a || !a.n) return null;
    var v = a.v, r = { n: a.n, d2: a.d2, file: a0.file, days: a.days };
    ["SL_CAO", "SL_SIO2", "SL_AL2O3", "SL_MGO", "HM_SI", "HM_FE"].forEach(function (k) { r[k] = v[k]; });
    if (v.SL_CAO && v.SL_SIO2) { r.b2 = v.SL_CAO / v.SL_SIO2; r.b3 = (v.SL_CAO + (v.SL_MGO || 0)) / v.SL_SIO2; }
    if (v.SL_MGO && v.SL_AL2O3) r.mgoAl = v.SL_MGO / v.SL_AL2O3;
    return r;
  }
  // ---------------------------------------------------------------- charge mix (operator input by %)
  var IDX = {}; MATERIALS.forEach(function (m, i) { IDX[m.key] = i; });
  var AGGLO = [["PELLET", "Pellet %", "PELLET"], ["SINTER", "Sinter %", "SINTER"], ["ORE", "Ore %", "TATA"], ["ACC", "Accretion %", "ACC_COLLER"]];
  var FLUXES = [["LIMESTONE", "Limestone"], ["DOLO", "Dolomite"], ["QTZ", "Quartzite"], ["PYROX", "Pyroxenite"], ["MN", "Mn ore"]];
  var COKES = [["ONLINE", "Online coke %", "COKE1"], ["YARD", "Yard coke %", "COKE2"], ["SPECIAL", "Special coke %", "COKE3"]];
  function chargeDefault() {
    var q = MATERIALS.map(function (m) { return m.qty; });
    var ore = q[IDX.PELLET] + q[IDX.SINTER] + q[IDX.TATA] + q[IDX.APHATU] + q[IDX.ACC_COLLER] + q[IDX.PSB_ACC];
    var coke = q[IDX.COKE1] + q[IDX.COKE2] + q[IDX.COKE3] + q[IDX.COKE4];
    var pc = function (x) { return ore > 0 ? +(x / ore * 100).toFixed(2) : 0; };
    var cc = function (x) { return coke > 0 ? +(x / coke * 100).toFixed(2) : 0; };
    return {
      on: false, oreKey: "TATA", accKey: "ACC_COLLER",
      oreTotal: Math.round(ore),
      pct: { PELLET: pc(q[IDX.PELLET]), SINTER: pc(q[IDX.SINTER]), ORE: pc(q[IDX.TATA] + q[IDX.APHATU]), ACC: pc(q[IDX.ACC_COLLER] + q[IDX.PSB_ACC]) },
      flux: { LIMESTONE: q[IDX.LIMESTONE], DOLO: q[IDX.DOLO], QTZ: q[IDX.QTZ], PYROX: q[IDX.PYROX], MN: q[IDX.MN] },
      cokeTotal: Math.round(coke),
      cokePct: { ONLINE: cc(q[IDX.COKE1]), YARD: cc(q[IDX.COKE2]), SPECIAL: cc(q[IDX.COKE3]) },
      nut: q[IDX.NUT],
      coalRate: (function () {            // PCI kg/tHM from the default mix, hm estimated straight from burden Fe
        var P = PARAMS_DEFAULT, fe = 0;
        MATERIALS.forEach(function (m, i) { var dry = q[i] * (1 - m.chem[0] / 100); fe += dry * m.chem[2] / 100; });
        var hm = fe * P.feRec / 100 / (P.feHM / 100);
        return hm > 0 ? +(q[IDX.COAL] / hm * 1000).toFixed(1) : 0;
      })()
    };
  }
  /** rebuild the mix from the kg now entered, so switching modes keeps the same burden */
  function chargeFromQty(state) {
    var q = state.qty, c = Object.assign({}, state.charge || chargeDefault());
    var oreKeys = [IDX.PELLET, IDX.SINTER, IDX.TATA, IDX.APHATU, IDX.ACC_COLLER, IDX.PSB_ACC];
    var ore = oreKeys.reduce(function (a, i) { return a + (+q[i] || 0); }, 0);
    var coke = [IDX.COKE1, IDX.COKE2, IDX.COKE3, IDX.COKE4].reduce(function (a, i) { return a + (+q[i] || 0); }, 0);
    c.oreTotal = +ore.toFixed(1); c.cokeTotal = +coke.toFixed(1);
    c.pct = { PELLET: ore ? +((+q[IDX.PELLET] || 0) / ore * 100).toFixed(2) : 0, SINTER: ore ? +((+q[IDX.SINTER] || 0) / ore * 100).toFixed(2) : 0,
      ORE: ore ? +(((+q[IDX.TATA] || 0) + (+q[IDX.APHATU] || 0)) / ore * 100).toFixed(2) : 0,
      ACC: ore ? +(((+q[IDX.ACC_COLLER] || 0) + (+q[IDX.PSB_ACC] || 0)) / ore * 100).toFixed(2) : 0 };
    c.flux = { LIMESTONE: +q[IDX.LIMESTONE] || 0, DOLO: +q[IDX.DOLO] || 0, QTZ: +q[IDX.QTZ] || 0, PYROX: +q[IDX.PYROX] || 0, MN: +q[IDX.MN] || 0 };
    c.cokePct = { ONLINE: coke ? +((+q[IDX.COKE1] || 0) / coke * 100).toFixed(2) : 0, YARD: coke ? +((+q[IDX.COKE2] || 0) / coke * 100).toFixed(2) : 0,
      SPECIAL: coke ? +((+q[IDX.COKE3] || 0) / coke * 100).toFixed(2) : 0 };
    c.nut = +q[IDX.NUT] || 0;
    var R = burden(state);
    c.coalRate = R && R.hm > 0 ? +((+q[IDX.COAL] || 0) / R.hm * 1000).toFixed(1) : 0;
    return c;
  }
  /** write state.qty from the mix. PCI is given in kg/tHM, so it is solved against the hot metal it helps make. */
  function applyCharge(state) {
    var c = state.charge;
    if (!c || !c.on) return state;
    var q = state.qty.slice(), tot = +c.oreTotal || 0, p = c.pct || {}, cp = c.cokePct || {}, ck = +c.cokeTotal || 0;
    [IDX.PELLET, IDX.SINTER, IDX.TATA, IDX.APHATU, IDX.ACC_COLLER, IDX.PSB_ACC, IDX.COKE1, IDX.COKE2, IDX.COKE3, IDX.COKE4].forEach(function (i) { q[i] = 0; });
    q[IDX.PELLET] = tot * (+p.PELLET || 0) / 100;
    q[IDX.SINTER] = tot * (+p.SINTER || 0) / 100;
    q[IDX[c.oreKey || "TATA"]] = tot * (+p.ORE || 0) / 100;
    q[IDX[c.accKey || "ACC_COLLER"]] = tot * (+p.ACC || 0) / 100;
    FLUXES.forEach(function (fx) { q[IDX[fx[0]]] = +(c.flux || {})[fx[0]] || 0; });
    COKES.forEach(function (ckx) { q[IDX[ckx[2]]] = ck * (+cp[ckx[0]] || 0) / 100; });
    q[IDX.NUT] = +c.nut || 0;
    state.qty = q;
    var rate = +c.coalRate || 0, x = +q[IDX.COAL] || 0;
    if (rate > 0) {
      for (var k = 0; k < 8; k++) {                      // PCI ash adds slag, so iterate to the kg/tHM asked for
        state.qty[IDX.COAL] = x;
        var R = burden(state);
        if (!(R.hm > 0)) break;
        var nx = rate * R.hm / 1000;
        if (Math.abs(nx - x) < 0.02) { x = nx; break; }
        x = nx;
      }
    } else x = 0;
    state.qty[IDX.COAL] = x;
    return state;
  }
  function chargeChecks(c) {
    var f = [];
    if (!c || !c.on) return f;
    var p = c.pct || {}, s = (+p.PELLET || 0) + (+p.SINTER || 0) + (+p.ORE || 0) + (+p.ACC || 0);
    if (Math.abs(s - 100) > 0.05) f.push("Agglomerate split is " + s.toFixed(2) + " %, not 100");
    var cp = c.cokePct || {}, s2 = (+cp.ONLINE || 0) + (+cp.YARD || 0) + (+cp.SPECIAL || 0);
    if ((+c.cokeTotal || 0) > 0 && Math.abs(s2 - 100) > 0.05) f.push("Coke split is " + s2.toFixed(2) + " %, not 100");
    if (!(+c.oreTotal > 0)) f.push("Enter the total Fe-bearing weight per charge");
    return f;
  }

  function defaultState() {
    return {
      version: 1,
      lab: emptyLab(),
      defaults: MATERIALS.map(function (m) { return m.chem.slice(); }),
      matSource: {}, manual: {},
      qty: MATERIALS.map(function (m) { return m.qty; }),
      ash: JSON.parse(JSON.stringify(ASH_DEFAULT)),
      params: Object.assign({}, PARAMS_DEFAULT), targets: Object.assign({}, TARGETS_DEFAULT),
      importOpt: Object.assign({}, IMPORT_DEFAULT), sinterSource: "BF REPORT",
      charge: chargeDefault()
    };
  }

  root.BurdenEngine = {
    PROPS: PROPS, ACT: ACT, CHEM: CHEM, MATERIALS: MATERIALS, SOURCES: SOURCES, ASH_DEFAULT: ASH_DEFAULT,
    IDX: IDX, AGGLO: AGGLO, FLUXES: FLUXES, COKES: COKES,
    parseWorkbook: parseWorkbook, genericSheet: genericSheet, mergeLab: mergeLab, review: review, burden: burden, status: status,
    fluxCorrection: fluxCorrection, actualSlag: actualSlag, sinterRow: sinterRow, defaultState: defaultState, isNum: isNum,
    chargeDefault: chargeDefault, chargeFromQty: chargeFromQty, applyCharge: applyCharge, chargeChecks: chargeChecks,
    pick: pick, pickActual: pickActual, materialSource: materialSource, migrateLab: migrateLab, emptyLab: emptyLab,
    MANUAL_FIELDS: MANUAL_FIELDS, lastDate: lastDate, hasData: hasData, newer: newer, laterUpload: laterUpload, FUEL_KEYS: FUEL_KEYS,
    PARAMS_DEFAULT: PARAMS_DEFAULT
  };
})(typeof window !== "undefined" ? window : globalThis);
