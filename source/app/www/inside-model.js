/* Furnace 3D view model (BF Model 3.3, module 08).
   Axisymmetric, stream-tube model of the furnace from the tuyeres to the stockline:
     1. Tuyere and raceway: blast and injection products, raceway adiabatic flame temperature (heat balance), bosh gas,
        tuyere velocity, kinetic energy, raceway depth.
     2. Whole-furnace carbon / oxygen / hydrogen balance: top gas, CO and H2 utilisation, direct reduction, solution loss.
     3. Radial gas distribution in the lumpy zone from the ring-by-ring coke and ore layers (Ergun, parallel rings at equal
        pressure gradient), and from the raceway / deadman at the bottom; gas crosses between rings through the
        cohesive zone.
     4. Gas and burden temperature in every ring and level (counter-current heat exchange with the reaction, melting,
        moisture and wall-loss heat sinks), so the cohesive zone, thermal reserve zone and isotherms come out of it.
     5. Pressure, gas velocity, reduction degree and CO utilisation in the same grid.
   Indicative engineering model: calibrate against your over-burden probe, top gas, shaft pressure taps and stave
   temperatures before you rely on absolute numbers. */
(function (root) {
  'use strict';
  var RG = 8.314, NM3 = 22.414e-3, ATM = 101.325;     // J/mol K, m³/mol at NTP, kPa
  var KG = 98.0665;                                   // kPa per kg/cm²
  function cl(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function num(v, d) { return typeof v === 'number' && isFinite(v) ? v : d; }
  function smooth(x) { x = cl(x, 0, 1); return x * x * (3 - 2 * x); }

  /* sensible enthalpy above 25 °C, kJ/mol (fits to JANAF within about 2 % up to 2300 °C) */
  function hN2(t) { t -= 25; return t * (29.0 + 0.0021 * t) / 1000; }
  function hCO(t) { t -= 25; return t * (29.2 + 0.0021 * t) / 1000; }
  function hH2(t) { t -= 25; return t * (28.6 + 0.0015 * t) / 1000; }
  function hH2O(t) { t -= 25; return t * (33.4 + 0.0046 * t) / 1000; }
  function hO2(t) { t -= 25; return t * (31.2 + 0.0024 * t) / 1000; }
  function hC(t) { t -= 25; return t * (15.0 + 0.0040 * t) / 1000; }
  function cpGas(t) { return 30.0 + 0.0036 * t; }     // J/mol K, CO-N2-CO2-H2 mixture
  function cpCoke(t) { return cl(0.85 + 0.00075 * t, 0.85, 1.95); }   // kJ/kg K
  function cpOre(t) { return cl(0.76 + 0.00032 * t, 0.76, 1.12); }   // sinter / pellet / ore, kJ/kg K

  /* ---------------------------------------------------------------- input list (one page, all sections) */
  // [key, label, unit, default, min, max, step, priority E/O/A, link (where the app fills it), excel aliases]
  var SECTIONS = [
    { id: 'geo', n: 'A', title: 'Furnace geometry and tuyeres', note: 'From the Burden calculator (section 1) when linked.', rows: [
      ['throatD', 'Throat diameter', 'm', 6.0, 2, 15, 0.01, 'E', 'calc'],
      ['throatH', 'Throat height', 'm', 1.8, 0.3, 5, 0.01, 'E', 'calc'],
      ['shaftH', 'Shaft height', 'm', 13.0, 4, 25, 0.1, 'E', 'calc'],
      ['bellyD', 'Belly diameter', 'm', 9.0, 3, 18, 0.01, 'E', 'calc'],
      ['bellyH', 'Belly height', 'm', 1.8, 0.3, 5, 0.01, 'E', 'calc'],
      ['boshH', 'Bosh height', 'm', 3.2, 1, 6, 0.01, 'E', 'calc'],
      ['hearthD', 'Hearth diameter', 'm', 7.6, 2, 16, 0.01, 'E', 'calc'],
      ['stock', 'Stockline level (below throat top)', 'm', 1.5, 0.3, 4, 0.05, 'E', 'calc', ['stockline level']],
      ['hearthH', 'Tuyere level to hearth bottom', 'm', 2.6, 1, 6, 0.1, 'O'],
      ['nTuy', 'Number of tuyeres', 'Nos.', 20, 4, 44, 1, 'E', '', ['number of tuyeres']],
      ['tuyD', 'Tuyere diameter', 'mm', 130, 80, 200, 1, 'E', '', ['tuyere diameter']],
      ['nTap', 'Number of tapholes', 'Nos.', 2, 1, 6, 1, 'E', '', ['number of tapholes']],
      ['tapAng', 'Taphole 1 angle (from Top temp 1 = 0°, clockwise)', '°', 45, 0, 360, 1, 'O', '', ['taphole angle']]] },
    { id: 'blast', n: 'B', title: 'Hot blast and oxygen', note: 'Blast volume, oxygen and blast pressure come from the calculator; moisture and O₂ purity from Batch chemistry.', rows: [
      ['BV', 'Cold blast flow', 'Nm³/min', 2000, 200, 10000, 10, 'E', 'calc', ['cold blast flow rate', 'blast volume', 'hot blast flow rate']],
      ['HBT', 'Hot blast temperature', '°C', 1150, 700, 1350, 5, 'E', '', ['hot blast temperature']],
      ['CBT', 'Cold blast temperature', '°C', 130, 20, 300, 5, 'O', '', ['cold blast temperature']],
      ['BP', 'Hot blast pressure', 'kg/cm² g', 2.6, 0.3, 6, 0.01, 'E', 'calc', ['hot blast pressure', 'blast pressure']],
      ['O2', 'Oxygen injection', 'Nm³/h', 5000, 0, 100000, 100, 'E', 'calc', ['oxygen injection rate', 'oxygen flow']],
      ['O2pur', 'Oxygen purity', '%', 99.5, 80, 100, 0.1, 'O', 'chem'],
      ['W', 'Blast moisture', 'g/Nm³', 15, 0, 60, 0.5, 'E', 'chem', ['blast moisture', 'blast humidity']]] },
    { id: 'fuel', n: 'C', title: 'Fuel rate and injection', note: 'Coke, nut coke, PCI and production come from Batch chemistry when linked.', rows: [
      ['coke', 'Coke rate (dry, excl. nut coke)', 'kg/tHM', 400, 150, 800, 1, 'E', 'chem', ['coke rate', 'coke charging rate']],
      ['nut', 'Nut coke rate (dry)', 'kg/tHM', 35, 0, 150, 1, 'O', 'chem'],
      ['pci', 'PCI rate', 'kg/tHM', 150, 0, 300, 1, 'E', 'chem', ['pci rate', 'total pci rate', 'coal injection rate']],
      ['coalFC', 'PCI fixed carbon', '%', 56, 30, 90, 0.1, 'E', '', ['coal fixed carbon', 'proximate analysis fixed carbon']],
      ['coalVM', 'PCI volatile matter', '%', 24, 5, 45, 0.1, 'E', '', ['coal volatile matter', 'proximate analysis volatile matter']],
      ['coalAsh', 'PCI ash', '%', 10, 2, 25, 0.1, 'E', '', ['coal ash', 'proximate analysis ash']],
      ['coalM', 'PCI moisture', '%', 1.0, 0, 10, 0.1, 'E', '', ['pulverized coal moisture', 'moisture total']],
      ['coalC', 'PCI carbon (ultimate)', '%', 78, 50, 92, 0.1, 'E', '', ['ultimate analysis carbon']],
      ['coalH', 'PCI hydrogen (ultimate)', '%', 4.4, 1, 7, 0.1, 'O', '', ['ultimate analysis hydrogen']],
      ['coalO', 'PCI oxygen (ultimate)', '%', 5.0, 0, 15, 0.1, 'O', '', ['ultimate analysis oxygen']],
      ['ng', 'Natural gas injection', 'Nm³/tHM', 0, 0, 150, 1, 'O', '', ['natural gas injection']],
      ['h2', 'Hydrogen injection', 'Nm³/tHM', 0, 0, 300, 1, 'O', '', ['hydrogen injection']],
      ['cokeFC', 'Coke fixed carbon', '%', 86.5, 70, 92, 0.1, 'E', '', ['fixed carbon']],
      ['cokeM', 'Coke moisture', '%', 5, 0, 15, 0.1, 'E', 'calc', ['moisture']]] },
    { id: 'pci', n: 'D', title: 'PCI lance, grind and combustion', note: 'Used by the PCI raceway model (one tuyere, all lances equal). Its burnout goes into the furnace calculation unless you type your own. Calibration rows are starting values from the literature.', rows: [
      ['pciD', 'PCI mean particle size', 'µm', 55, 15, 200, 1, 'E', '', ['pci mean particle size']],
      ['pciR75', 'PCI residue on 75 µm (200 mesh)', '%', 20, 0, 95, 0.5, 'E', '', ['residue on 200 mesh', 'residue on 75 µm sieve']],
      ['lanceDepth', 'Lance tip, back from the tuyere nose', 'mm', 300, 50, 2000, 10, 'E', '', ['injection lance position geometry']],
      ['lanceAng', 'Lance angle to the blowpipe axis', '°', 8, 0, 25, 0.5, 'E'],
      ['tuyAng', 'Tuyere angle, downward', '°', 5, 0, 15, 0.5, 'O'],
      ['carType', 'Carrier gas (1 N₂, 2 air)', '–', 1, 1, 2, 1, 'O'],
      ['carQ', 'Carrier gas per lance', 'Nm³/h', 30, 0, 300, 1, 'E'],
      ['carT', 'Carrier gas temperature', '°C', 60, 0, 300, 1, 'O', '', ['carrier gas temperature']],
      ['burn', 'PCI burnout in the raceway (to the furnace model)', '%', 70, 20, 100, 0.5, 'E', 'pci'],
      ['burnM', 'Burnout measured (dust carbon or probe)', '%', null, 0, 100, 0.5, 'O'],
      ['pciQ', 'Volatile yield factor Q (× proximate VM)', '×', 1.4, 1, 2, 0.05, 'A'],
      ['pciKv', 'Devolatilisation rate factor', '×', 1, 0.1, 10, 0.1, 'A'],
      ['pciKc', 'Char reaction rate factor', '×', 1, 0.1, 10, 0.1, 'A'],
      ['pciMix', 'Volatile–oxygen mixing factor', '×', 1, 0.2, 5, 0.1, 'A'],
      ['pciCoke', 'Coke combustion in the raceway factor', '×', 1, 0.3, 3, 0.1, 'A']] },
    { id: 'prod', n: 'D', title: 'Production, hot metal and slag', note: 'Production, slag rate, burden Fe, HM Si and C come from Batch chemistry.', rows: [
      ['prod', 'Hot metal production', 't/day', 2300, 100, 15000, 10, 'E', 'chem', ['hot metal production']],
      ['fe', 'Burden Fe (ferrous, dry)', '%', 57.5, 40, 68, 0.1, 'E', 'chem', ['total fe']],
      ['slag', 'Slag rate', 'kg/tHM', 330, 150, 600, 1, 'E', 'chem', ['slag formation', 'slag rate']],
      ['si', 'Hot metal Si', '%', 0.6, 0.1, 2, 0.01, 'E', 'chem'],
      ['hmC', 'Hot metal C', '%', 4.5, 3.5, 5.2, 0.01, 'O', 'chem'],
      ['flux', 'Raw limestone + dolomite', 'kg/tHM', 0, 0, 300, 1, 'O', 'calc', ['flux charging rate']],
      ['hmtM', 'Hot metal temperature, measured', '°C', null, 1350, 1600, 1, 'O', '', ['hot metal temperature']]] },
    { id: 'burden', n: 'E', title: 'Burden and radial distribution', note: 'With "Use the calculator rings" on, O/C by ring comes from the Burden calculator results; the three zone O/C below are then only shown for reference.', rows: [
      ['useCalc', 'Use the charged burden rings (1 = yes, 0 = zone values)', '–', 1, 0, 1, 1, 'E'],
      ['ocC', 'O/C centre (r/R < 0.4)', 'mass', 2.0, 0, 12, 0.05, 'E', 'calc', ['radial burden distribution']],
      ['ocI', 'O/C intermediate (0.4–0.75)', 'mass', 4.6, 0, 12, 0.05, 'E', 'calc'],
      ['ocW', 'O/C wall (r/R > 0.75)', 'mass', 4.3, 0, 12, 0.05, 'E', 'calc'],
      ['sinterPct', 'Sinter in ferrous burden', '%', 65, 0, 100, 1, 'E', 'calc', ['burden share in total ferrous burden']],
      ['pelletPct', 'Pellet in ferrous burden', '%', 20, 0, 100, 1, 'E', 'calc'],
      ['lumpPct', 'Lump ore in ferrous burden', '%', 15, 0, 100, 1, 'E', 'calc'],
      ['dC', 'Coke mean size', 'mm', 50, 15, 90, 1, 'E', 'calc', ['coke size']],
      ['dS', 'Sinter mean size', 'mm', 18, 5, 50, 0.5, 'E', 'calc', ['sinter size']],
      ['dP', 'Pellet mean size', 'mm', 12, 6, 20, 0.5, 'E', 'calc', ['pellet size', 'mean pellet diameter']],
      ['dL', 'Lump ore mean size', 'mm', 22, 6, 50, 0.5, 'E', 'calc'],
      ['finC', 'Coke fines', '%', 3, 0, 20, 0.1, 'E', '', ['fines fraction']],
      ['finS', 'Sinter −5 mm', '%', 8, 0, 30, 0.1, 'E', '', ['fines below 5 mm']],
      ['finP', 'Pellet −5 mm', '%', 3, 0, 30, 0.1, 'E', ''],
      ['finL', 'Lump ore −5 mm', '%', 6, 0, 30, 0.1, 'E', ''],
      ['bdC', 'Coke bulk density', 'kg/m³', 500, 350, 700, 5, 'O', 'calc', ['bulk density']],
      ['bdO', 'Ferrous burden bulk density', 'kg/m³', 1900, 1300, 2600, 10, 'O', 'calc'],
      ['oreM', 'Ferrous burden moisture', '%', 1.5, 0, 10, 0.1, 'O', 'calc']] },
    { id: 'coke', n: 'F', title: 'Coke quality', note: 'From the raw material test list (coke).', rows: [
      ['csr', 'CSR', '%', 62, 30, 75, 0.5, 'E', '', ['csr']],
      ['cri', 'CRI', '%', 25, 15, 45, 0.5, 'E', '', ['cri']],
      ['m40', 'M40', '%', 85, 60, 95, 0.5, 'E', '', ['m40 or di', 'm40']],
      ['m10', 'M10', '%', 7, 3, 15, 0.1, 'E', '', ['m10']],
      ['cokeAsh', 'Coke ash', '%', 12.5, 6, 20, 0.1, 'E', '', ['ash']]] },
    { id: 'fer', n: 'G', title: 'Sinter, pellet and lump ore quality', note: 'Softening and melting temperatures set where the cohesive zone forms; RDI and fines set upper-shaft permeability; RI sets indirect reduction.', grid: ['Sinter', 'Pellet', 'Lump ore'], rows: [
      ['RDI', 'RDI (−3.15 mm)', '%', [28, 12, 15], 0, 60, 0.5, 'E', '', ['rdi', 'reduction degradation index']],
      ['RI', 'Reduction index RI', '%', [68, 65, 55], 30, 90, 0.5, 'E', '', ['reduction index']],
      ['FeO', 'FeO', '%', [9, 0.8, 1], 0, 20, 0.1, 'E', 'chem', ['feo']],
      ['Tss', 'Softening start', '°C', [1180, 1120, 1080], 900, 1400, 5, 'E', '', ['softening start temperature']],
      ['Tse', 'Softening end', '°C', [1290, 1260, 1230], 950, 1450, 5, 'E', '', ['softening end temperature']],
      ['Tms', 'Melting start', '°C', [1380, 1350, 1320], 1100, 1550, 5, 'E', '', ['melting start temperature']],
      ['Tme', 'Melting end (dripping)', '°C', [1480, 1460, 1440], 1200, 1600, 5, 'E', '', ['melting end temperature']],
      ['DP', 'Max ΔP softening–melting', 'kPa', [12, 18, 20], 0, 60, 0.5, 'E', '', ['pressure drop during softening melting']]] },
    { id: 'top', n: 'H', title: 'Top gas, measured', note: 'Top temp 1–4 are the four uptake temperatures; Top temp 1 is the 0° reference for every angle on this page, clockwise seen from the top. Leave empty what you do not measure.', rows: [
      ['TP', 'Top gas pressure', 'kg/cm² g', 1.2, 0, 3, 0.01, 'E', 'calc', ['top gas pressure', 'top pressure']],
      ['tt1', 'Top temp 1 (0°)', '°C', null, 20, 600, 1, 'E', '', ['top temp 1', 'top temperature 1']],
      ['tt2', 'Top temp 2', '°C', null, 20, 600, 1, 'E', '', ['top temp 2', 'top temperature 2']],
      ['tt3', 'Top temp 3', '°C', null, 20, 600, 1, 'E', '', ['top temp 3', 'top temperature 3']],
      ['tt4', 'Top temp 4', '°C', null, 20, 600, 1, 'E', '', ['top temp 4', 'top temperature 4']],
      ['tta2', 'Top temp 2 angle', '°', 90, 0, 360, 1, 'O'],
      ['tta3', 'Top temp 3 angle', '°', 180, 0, 360, 1, 'O'],
      ['tta4', 'Top temp 4 angle', '°', 270, 0, 360, 1, 'O'],
      ['Ttop', 'Top gas temperature (used when Top temp 1–4 are empty)', '°C', 150, 60, 500, 1, 'O', 'calc', ['top gas temperature']],
      ['tgCO', 'Top gas CO', 'vol %', 23, 10, 35, 0.1, 'E', '', ['co']],
      ['tgCO2', 'Top gas CO₂', 'vol %', 21, 10, 30, 0.1, 'E', '', ['co2']],
      ['tgH2', 'Top gas H₂', 'vol %', 3.5, 0, 15, 0.1, 'E', '', ['h2']],
      ['dust', 'Top gas dust', 'g/Nm³', null, 0, 60, 0.1, 'O', '', ['top gas dust content']]] },
    { id: 'probe', n: 'I', title: 'Burden probe and periphery temperatures', note: 'Set the probe and the number of points first; the tables below then show one row per point. TL = left arm, TR = right arm, point 1 nearest the centre. Periphery T1 … Tm are around the wall at one level. Angles from Top temp 1 = 0°, clockwise.', dyn: true, rows: [
      ['prType', 'Probe type (1 over-burden, 2 in-burden)', '–', 1, 1, 2, 1, 'E', '', ['burden probe type']],
      ['prH', 'Probe distance from the stockline (above + / below −)', 'm', 0.5, -3, 3, 0.05, 'E', '', ['probe level from the stockline']],
      ['prAng', 'Probe left arm angle', '°', 30, 0, 360, 1, 'E', '', ['probe left arm angle']],
      ['prN', 'Points per arm', 'Nos.', 5, 1, 10, 1, 'E', '', ['points per arm']],
      ['prGap', 'Gap from the last point to the wall', 'm', 0.3, 0, 1.5, 0.05, 'O'],
      ['peN', 'Periphery points', 'Nos.', 8, 1, 24, 1, 'E', '', ['periphery points']],
      ['peAng', 'Angle of T1', '°', 0, 0, 360, 1, 'O'],
      ['peD', 'Periphery level below the throat top', 'm', 1.5, 0, 25, 0.1, 'E', '', ['periphery level below throat top']]] },
    { id: 'meas', n: 'J', title: 'Inside the furnace, measured (optional)', note: 'Near-wall gas temperature from shaft probes or refractory thermocouples, pressure taps and the cooling heat loss.', rows: [
      ['mUS', 'Upper shaft, near wall', '°C', null, 20, 1500, 1, 'O', '', ['upper shaft temperature']],
      ['mMS', 'Middle shaft, near wall', '°C', null, 20, 1500, 1, 'O', '', ['middle shaft temperature']],
      ['mLS', 'Lower shaft, near wall', '°C', null, 20, 1600, 1, 'O', '', ['lower shaft temperature']],
      ['mPS', 'Shaft pressure (mid-shaft tap)', 'kg/cm² g', null, 0, 6, 0.01, 'O', '', ['shaft pressure']],
      ['mPB', 'Bosh / belly pressure tap', 'kg/cm² g', null, 0, 6, 0.01, 'O', '', ['bosh pressure']],
      ['wallQ', 'Total cooling heat loss (staves + hearth + tuyeres)', 'GJ/h', 40, 0, 300, 0.5, 'E', '', ['heat loss']]] },
    { id: 'cal', n: 'K', title: 'Model calibration', note: 'Press "Fit to my measurements" to set these from the probe, top gas temperature and pressure; or set them by hand.', rows: [
      ['fH', 'Heat transfer factor', '×', 1.3, 0.3, 3, 0.05, 'A'],
      ['fB', 'Radial bias (+ = more centre gas)', '–', 0.0, -0.8, 0.8, 0.05, 'A'],
      ['fK', 'Permeability factor (resistance ×)', '×', 1.0, 0.3, 3, 0.05, 'A'],
      ['Tch', 'Burden charging temperature', '°C', 25, 0, 200, 1, 'O', '', ['charging temperature']]] }
  ];
  SECTIONS.forEach(function (sx, i) { sx.n = 'ABCDEFGHIJKLMNOP'.charAt(i); });
  var MATS = ['s', 'p', 'l'];
  var PRMAX = 10, PEMAX = 24;
  // dynamic per-point keys: probe distance prd, left tl, right tr (point 1 = centre); periphery t and its angle ta
  var DYN = [];
  for (var q = 1; q <= PRMAX; q++) DYN.push(['prd' + q, 'Probe point ' + q + ' distance from centre', 'm', 0, 15], ['tl' + q, 'TL' + q + ' left arm, point ' + q, '°C', 20, 1300], ['tr' + q, 'TR' + q + ' right arm, point ' + q, '°C', 20, 1300]);
  for (q = 1; q <= PEMAX; q++) DYN.push(['t' + q, 'T' + q + ' periphery temperature', '°C', 20, 1300], ['ta' + q, 'T' + q + ' angle', '°', 0, 360]);
  function probeDist(I, i) { var v = num(I['prd' + i], null); if (v != null) return v; var n = cl(Math.round(num(I.prN, 5)), 1, PRMAX), R = num(I.throatD, 6) / 2; return +((i - 0.5) / n * Math.max(R - num(I.prGap, 0.3), 0.2)).toFixed(2); }
  function periAngle(I, j) { var v = num(I['ta' + j], null); if (v != null) return v; var m = cl(Math.round(num(I.peN, 8)), 1, PEMAX); return ((num(I.peAng, 0) + (j - 1) * 360 / m) % 360 + 360) % 360; }
  function topTemps(I) { var a = [0, num(I.tta2, 90), num(I.tta3, 180), num(I.tta4, 270)]; return [1, 2, 3, 4].map(function (k, i) { return { tag: 'Top temp ' + k, ang: a[i], v: num(I['tt' + k], null) }; }); }
  function measTop(I) { var v = topTemps(I).map(function (t) { return t.v; }).filter(function (x) { return x != null; }); return v.length ? v.reduce(function (a, b) { return a + b; }, 0) / v.length : num(I.Ttop, null); }
  function defaults() {
    var o = {};
    SECTIONS.forEach(function (s) { s.rows.forEach(function (r) {
      if (s.grid) MATS.forEach(function (m, i) { o[m + r[0]] = r[3][i]; }); else o[r[0]] = r[3];
    }); });
    return o;
  }

  /* ---------------------------------------------------------------- geometry (depth from throat top, as the calculator) */
  function geometry(I) {
    var g = { Rt: I.throatD / 2, tH: I.throatH, sH: I.shaftH, Rb: I.bellyD / 2, bH: I.bellyH, boH: I.boshH, Rh: I.hearthD / 2, hH: num(I.hearthH, 2.6) };
    g.dS = g.tH + g.sH; g.dB = g.dS + g.bH; g.dBot = g.dB + g.boH;
    g.r = function (d) { return d <= g.tH ? g.Rt : d <= g.dS ? g.Rt + (d - g.tH) / g.sH * (g.Rb - g.Rt) : d <= g.dB ? g.Rb : d <= g.dBot ? g.Rb - (d - g.dB) / Math.max(g.boH, 1e-6) * (g.Rb - g.Rh) : g.Rh; };
    g.zs = cl(I.stock, 0, g.tH + g.sH * 0.5); g.zt = g.dBot;
    var v = 0, n = 200, dz = (g.dBot - g.zs) / n;
    for (var i = 0; i < n; i++) { var rr = g.r(g.zs + (i + 0.5) * dz); v += Math.PI * rr * rr * dz; }
    g.workV = v;
    return g;
  }

  /* ---------------------------------------------------------------- 1. tuyere and raceway */
  function raceway(I, g) {
    var pt = I.prod / 1440;                                     // tHM per minute
    var air = I.BV, o2f = I.O2 / 60, pur = I.O2pur / 100;
    var nH2Ob = air * I.W / 18;                                 // g/Nm³ × Nm³/min ÷ 18 = mol/min
    var nO2 = (0.21 * air + pur * o2f) / NM3, nN2 = (0.79 * air + (1 - pur) * o2f) / NM3;
    var coal = I.pci * pt;                                      // kg/min
    var bf = I.burn / 100;
    var cC = coal * I.coalC / 100 * 1000 / 12, cH = coal * I.coalH / 100 * 1000 / 2, cO = coal * I.coalO / 100 * 1000 / 16;
    var cW = coal * I.coalM / 100 * 1000 / 18, cAsh = coal * I.coalAsh / 100;
    var ch4 = I.ng * pt / NM3, h2i = I.h2 * pt / NM3;
    var Oat = 2 * nO2 + nH2Ob + cO + cW;                       // O atoms -> CO
    var CO = Oat;
    var cBurn = cC * bf;                                        // coal carbon gasified in the raceway
    var cCoke = CO - cBurn - ch4 - 0;                           // coke carbon burnt at the tuyeres, mol/min
    var H2 = nH2Ob + cH + cW + 2 * ch4 + h2i;
    var N2 = nN2 + coal * 0.015 * 1000 / 28;
    // heat balance, kJ/min, reference 25 °C
    var T = I.HBT;
    var hin = (nO2 * hO2(T) + nN2 * hN2(T) + nH2Ob * hH2O(T))
      + Math.max(cCoke, 0) * hC(I.tCoke || 1500)
      + (2 * nO2 + cO) * 110.5 - (nH2Ob + cW) * 131.3 - cW * 44.0
      + ch4 * 35.7
      - coal * (250 + 32 * I.coalVM)                           // PCI heating and decomposition
      - (cC - cBurn) * hC(1500) * 0;                             // unburnt char leaves at flame temperature (in products)
    function hout(t) { return CO * hCO(t) + H2 * hH2(t) + N2 * hN2(t) + (cAsh + Math.max(cC - cBurn, 0) * 0.012) * 1.25 * (t - 25); }
    var lo = 800, hi = 3200;
    for (var k = 0; k < 60; k++) { var m = (lo + hi) / 2; if (hout(m) > hin) hi = m; else lo = m; }
    var raft = (lo + hi) / 2;
    var bosh = (CO + H2 + N2) * NM3;                            // Nm³/min
    var Ah = Math.PI * g.Rh * g.Rh;
    var qN = air + o2f + nH2Ob * NM3;                           // Nm³/min through the tuyeres
    var At = Math.PI * Math.pow(I.tuyD / 2000, 2) * I.nTuy;
    var Pabs = ATM + I.BP * KG;
    var vT = qN / 60 * (I.HBT + 273.15) / 273.15 * ATM / Pabs / At;   // m/s
    var mdot = (air * 1.293 + o2f * 1.429 + nH2Ob * 0.018) / 60 / I.nTuy;   // kg/s per tuyere
    var KE = 0.5 * mdot * vT * vT / 1000;                       // kJ/s (kW) per tuyere
    var Dr = cl(0.36 * Math.pow(Math.max(KE, 1), 0.32) * Math.pow(50 / I.dC, 0.15) * (1 - 0.0006 * Math.max(I.pci - 100, 0)), 0.4, 2.6);
    var enr = (nO2 * NM3) / (air + o2f) * 100 - 21;
    return { pt: pt, nO2: nO2, nN2: nN2, nH2Ob: nH2Ob, coal: coal, CO: CO, H2: H2, N2: N2, cCoke: cCoke, cBurn: cBurn, cUnb: cC - cBurn,
      raft: raft, bosh: bosh, BGI: bosh / Ah, vT: vT, KE: KE, Dr: Dr, enr: enr, Pabs: Pabs,
      comp: { CO: CO / (CO + H2 + N2) * 100, H2: H2 / (CO + H2 + N2) * 100, N2: N2 / (CO + H2 + N2) * 100 },
      cokeAtTuy: cCoke * 12 / 1000 / I.cokeFC * 100 / pt,          // kg coke/tHM burnt at the tuyeres
      o2PerTuy: (pur * o2f) / I.nTuy, coalPerTuy: coal / I.nTuy, stove: (I.HBT - num(I.CBT, 130)) * qN / 60 * 1.40 / 1000 };   // MW
  }

  /* ---------------------------------------------------------------- 2. carbon / oxygen / hydrogen balance per tHM */
  function balance(I, rw) {
    var feHM = 1000 * (1 - I.hmC / 100 - I.si / 100 - 0.012);
    var ferr = feHM / (I.fe / 100) / 0.995;                    // ferrous burden kg/tHM (dry)
    var sh = shares(I);
    var feo = sh.s * I.sFeO + sh.p * I.pFeO + sh.l * I.lFeO;   // % FeO in the ferrous burden
    var feoKg = ferr * feo / 100, feInFeO = feoKg * 55.85 / 71.85;
    var oBurden = (feoKg * 16 / 71.85 + Math.max(feHM - feInFeO, 0) * 48 / 111.7) / 16 * 1000;   // mol O/tHM from iron oxides
    var oSi = I.si * 10 * 1000 / 28.09 * 2;                    // SiO2 -> Si
    var oMn = 3 * 1000 / 54.9;                                 // ~0.3 % Mn
    var cIn = (I.coke * I.cokeFC / 100 + I.nut * I.cokeFC / 100 * 0.98 + I.pci * I.coalC / 100) * 1000 / 12 + I.ng / NM3;
    var cHM = I.hmC * 10 * 1000 / 12;
    var cGas = cIn - cHM;                                      // mol C/tHM to gas
    var pt = rw.pt;
    var oBlast = (2 * rw.nO2 + rw.nH2Ob) / pt;                 // mol O/tHM
    var oCoal = I.pci * (I.coalO / 100 * 1000 / 16 + I.coalM / 100 * 1000 / 18);
    var co2Flux = I.flux * 0.45 * 1000 / 44;
    var h2Tot = rw.H2 / pt;
    var n2 = rw.N2 / pt;
    var etaH = 0.42, etaCO = 0.45, co2, co, k;
    for (k = 0; k < 30; k++) {
      var h2o = etaH * h2Tot;
      var oGas = oBlast + oCoal + oBurden + oSi + oMn - h2o;   // O that ends in CO + CO2 (excl. flux CO2)
      co2 = oGas - cGas; co = cGas - co2;
      etaCO = co2 / Math.max(co + co2, 1e-9);
      etaH = cl(0.88 * etaCO + 0.02, 0.15, 0.6);
    }
    var cTuy = (rw.cCoke + rw.cBurn + I.ng * pt / NM3) / pt;    // carbon gasified at the tuyeres, mol/tHM
    var cDir = cGas - cTuy;                                    // solution loss + direct reduction carbon
    var oSiMn = oSi + oMn;
    var oWus = feHM / 55.85 * 1000;                            // O bound as FeO at the wustite stage
    var rd = cl((cDir - oSiMn - co2Flux * 0) / oWus, 0, 1);
    var dryTop = co + co2 + co2Flux + n2 + h2Tot * (1 - etaH);
    var top = { CO: co / dryTop * 100, CO2: (co2 + co2Flux) / dryTop * 100, H2: h2Tot * (1 - etaH) / dryTop * 100, N2: n2 / dryTop * 100 };
    var waterTop = h2Tot * etaH + (I.coke * I.cokeM / (100 - I.cokeM) + ferr * I.oreM / (100 - I.oreM)) * 1000 / 18;
    return { feHM: feHM, ferr: ferr, feo: feo, oBurden: oBurden, cIn: cIn, cGas: cGas, cTuy: cTuy, cDir: cDir, rd: rd, etaCO: etaCO * 100, etaH: etaH * 100,
      top: top, topDry: dryTop * NM3, topWet: (dryTop + waterTop) * NM3, water: waterTop, co2Flux: co2Flux, h2Tot: h2Tot, n2: n2,
      solLossC: Math.max(cDir - oSiMn - rd * oWus * 0, 0) * 12 / 1000, cTuyKg: cTuy * 12 / 1000, cDirKg: cDir * 12 / 1000, cHMkg: cHM * 12 / 1000,
      ok: cDir > 0 && rd > 0.05 && rd < 0.7 };
  }
  function shares(I) {
    var s = Math.max(I.sinterPct, 0), p = Math.max(I.pelletPct, 0), l = Math.max(I.lumpPct, 0), t = s + p + l || 1;
    return { s: s / t, p: p / t, l: l / t };
  }

  /* ---------------------------------------------------------------- rings: radial structure of the burden */
  function rings(I, calc) {
    var R = [], i;
    if (I.useCalc && calc && calc.radial && calc.radial.mid && calc.radial.mid.length >= 4 && calc.R > 0) {
      var mid = calc.radial.mid, Rr = calc.R, n = mid.length, e = [0];
      for (i = 0; i < n - 1; i++) e.push((mid[i] + mid[i + 1]) / 2 / Rr);
      e.push(1);
      var raw = [];
      for (i = 0; i < n; i++) raw.push({ s0: e[i], s1: e[i + 1], c: Math.max(+calc.radial.cmm[i] || 0, 0), o: Math.max(+calc.radial.omm[i] || 0, 0) });
      // more than 12 calculator rings: merge neighbours into 12 bands of equal width (layer volumes kept), for a fast, stable solve
      if (n > 12) {
        var NB = 12;
        for (var q = 0; q < NB; q++) {
          var a0 = q / NB, a1 = (q + 1) / NB, ar = 0, cv = 0, ov = 0;
          raw.forEach(function (x) { var lo = Math.max(a0, x.s0), hi = Math.min(a1, x.s1); if (hi > lo) { var w = hi * hi - lo * lo; ar += w; cv += x.c * w; ov += x.o * w; } });
          R.push({ s0: a0, s1: a1, c: ar ? cv / ar : 0, o: ar ? ov / ar : 0 });
        }
      } else R.push.apply(R, raw);
      R.src = 'calc'; R.nCalc = n;
    } else {
      var n2 = 10;
      for (i = 0; i < n2; i++) {
        var s = (i + 0.5) / n2;
        var oc = s < 0.4 ? I.ocC + (I.ocI - I.ocC) * smooth((s - 0.3) / 0.2) : s < 0.75 ? I.ocI + (I.ocW - I.ocI) * smooth((s - 0.65) / 0.2) : I.ocW;
        var vr = oc * I.bdC / I.bdO;                         // ore / coke by volume
        R.push({ s0: i / n2, s1: (i + 1) / n2, c: 1, o: vr });
      }
      R.src = 'zones';
    }
    // drop rings that get nothing; keep the geometry
    R.forEach(function (r) { r.sm = (r.s0 + r.s1) / 2; r.a = r.s1 * r.s1 - r.s0 * r.s0; if (r.c + r.o <= 1e-9) { r.c = 1e-3; } r.phi = r.o / (r.o + r.c); });
    return R;
  }

  /* ---------------------------------------------------------------- 3. Ergun resistance of a ring (per metre) */
  function ergunAB(eps, d) { return { A: 150 * Math.pow(1 - eps, 2) / Math.pow(eps, 3) / (d * d), B: 1.75 * (1 - eps) / Math.pow(eps, 3) / d }; }
  function bedProps(I) {
    var sh = shares(I);
    var finO = sh.s * (I.finS + 0.22 * I.sRDI) + sh.p * (I.finP + 0.22 * I.pRDI) + sh.l * (I.finL + 0.22 * I.lRDI);   // % fines in the upper shaft incl. RDI
    var dO = 1 / (sh.s / I.dS + sh.p / I.dP + sh.l / I.dL) / 1000 * 0.8;         // harmonic, shape factor 0.8
    dO = dO * (1 - cl(finO, 0, 60) / 100 * 0.9);
    var epsO = cl(0.43 - 0.0045 * finO, 0.26, 0.45);
    var dCk = I.dC / 1000 * 0.72 * (1 - I.finC / 100 * 0.6);
    var epsC = cl(0.52 - 0.004 * I.finC - 0.002 * (I.m10 - 7), 0.38, 0.56);
    var dCl = I.dC / 1000 * 0.72 * cl(0.55 + 0.006 * (I.csr - 50) - 0.004 * (I.cri - 25), 0.35, 0.85);   // coke reaching the bosh
    var epsCl = cl(epsC - 0.06 - 0.002 * (65 - I.csr), 0.28, 0.5);
    var tss = sh.s * I.sTss + sh.p * I.pTss + sh.l * I.lTss, tse = sh.s * I.sTse + sh.p * I.pTse + sh.l * I.lTse;
    var tms = sh.s * I.sTms + sh.p * I.pTms + sh.l * I.lTms, tme = sh.s * I.sTme + sh.p * I.pTme + sh.l * I.lTme;
    var dpm = sh.s * I.sDP + sh.p * I.pDP + sh.l * I.lDP;
    var ri = sh.s * I.sRI + sh.p * I.pRI + sh.l * I.lRI;
    return { sh: sh, finO: finO, dO: dO, epsO: epsO, dC: dCk, epsC: epsC, dCl: dCl, epsCl: epsCl, ore: ergunAB(epsO, dO), coke: ergunAB(epsC, dCk), cokeL: ergunAB(epsCl, dCl),
      tss: tss, tse: tse, tms: tms, tme: Math.max(tme, tms + 20), dpm: dpm, ri: ri };
  }
  // u from gradient G (Pa/m): B ρ u² + A μ u = G
  function uFromG(A, B, mu, rho, G) { var a = B * rho, b = A * mu; return (-b + Math.sqrt(b * b + 4 * a * G)) / (2 * a); }

  function lumpyDistribution(I, R, bp, Qact, area, mu, rho) {
    // layers in series inside a ring: resistance = φ·ore + (1−φ)·coke ; wall effect on the outer ring
    var res = R.map(function (r) {
      var bias = 1 + I.fB * (2 * r.sm - 1) * 0.9;              // + bias raises wall resistance, lowers centre
      var wall = r.s1 > 0.97 ? 0.82 : 1;
      var A = (r.phi * bp.ore.A + (1 - r.phi) * bp.coke.A) * bias * wall * I.fK;
      var B = (r.phi * bp.ore.B + (1 - r.phi) * bp.coke.B) * bias * wall * I.fK;
      return { A: A, B: B };
    });
    var lo = 1, hi = 1e6, u = [];
    for (var k = 0; k < 80; k++) {
      var G = Math.sqrt(lo * hi), q = 0;
      u = res.map(function (x) { return uFromG(x.A, x.B, mu, rho, G); });
      R.forEach(function (r, i) { q += u[i] * r.a * area; });
      if (q > Qact) hi = G; else lo = G;
    }
    var tot = 0; R.forEach(function (r, i) { tot += u[i] * r.a; });
    return { F: R.map(function (r, i) { return u[i] * r.a / tot; }), G: Math.sqrt(lo * hi), u: u };
  }

  /* ---------------------------------------------------------------- 4. the 2D field */
  function run(I0, calc) {
    var I = Object.assign(defaults(), I0 || {});
    MATS.forEach(function (m) { ['Tss', 'Tse', 'Tms', 'Tme'].forEach(function (k) { I[m + k] = num(I[m + k], 1200); }); });
    I.tCoke = 1500;
    var warn = [];
    var g = geometry(I), rw = raceway(I, g), mb = balance(I, rw), bp = bedProps(I);
    var R = rings(I, calc), NR = R.length, NZ = 60;
    var pt = rw.pt / 60;                                        // tHM/s
    // solids per ring: volumes charged per ring at the throat (calc layer mm × ring area), scaled to the per-tHM masses
    var cokeKg = I.coke + I.nut, oreKg = mb.ferr + I.flux;
    var vc = 0, vo = 0; R.forEach(function (r) { vc += r.c * r.a; vo += r.o * r.a; });
    R.forEach(function (r) {
      r.cs = r.c * r.a / vc; r.os = r.o * r.a / vo;              // ring share of coke and ore
      r.mc = cokeKg * r.cs * pt; r.mo = oreKg * r.os * pt;       // kg/s dry
      r.ws = r.mc + r.mo;
      r.water = (I.coke * I.cokeM / (100 - I.cokeM) * r.cs + mb.ferr * I.oreM / (100 - I.oreM) * r.os) * pt;   // kg/s
      r.vol = (cokeKg / I.bdC * r.cs + oreKg / I.bdO * r.os) * pt; // m³/s of burden
    });
    // levels: stockline (j=0) to tuyeres (j=NZ)
    var z = [], Rz = [];
    for (var j = 0; j <= NZ; j++) { z.push(g.zs + (g.zt - g.zs) * j / NZ); Rz.push(g.r(z[j])); }
    var dz = (g.zt - g.zs) / NZ;
    // gas flows, mol/s: bosh gas at the bottom, top gas (wet, without burden moisture) at the top
    var Nb = (rw.CO + rw.H2 + rw.N2) / 60;
    var Nt = (mb.topDry / NM3 + mb.h2Tot * mb.etaH / 100) * pt;
    // lumpy-zone radial distribution at mid-shaft conditions
    var Pt = ATM + I.TP * KG, Pb = ATM + I.BP * KG, Pm = (Pt + Pb) / 2 * 1000;
    var Tm = 650 + 273.15, rho = 0.0286 * Pm / (RG * Tm), mu = 3.4e-5;
    var zMid = g.tH + g.sH * 0.55, Amid = Math.PI * Math.pow(g.r(zMid), 2);
    var Qact = Nt * RG * Tm / Pm;
    var LZ = lumpyDistribution(I, R, bp, Qact, Amid, mu, rho);
    // bottom (raceway / deadman) distribution: raceway along the wall, deadman takes less gas to the centre
    var Rh = g.r(g.zt), sRw = cl(1 - rw.Dr / Rh, 0, 0.95);
    var lp = cl(1.1 * (bp.dCl * 1000 / 22) * (1 + 0.01 * (I.csr - 60)), 0.35, 3.0);   // m, gas penetration into the deadman
    var wB = R.map(function (r) { var dist = Math.max(sRw - r.sm, 0) * Rh; return r.a * (r.sm >= sRw ? 1.25 : Math.exp(-dist / lp)); });
    var sB = wB.reduce(function (a, b) { return a + b; }, 0), FB = wB.map(function (w) { return w / sB; });
    var Tdm = 1450 + 0.1 * (rw.raft - 2150);                    // deadman / dripping metal temperature
    var Tin = R.map(function (r) { var dist = Math.max(sRw - r.sm, 0) * Rh; return Tdm + (rw.raft - Tdm) * Math.exp(-dist / 0.7) * (r.sm >= sRw ? 1 : 0.85); });
    // heat sinks per ring, kW, with their temperature windows
    var Tsl0 = cl(960 - 4 * (I.cri - 25) - 2 * (bp.ri - 65) * 0, 830, 1080), Tsl1 = Math.max(bp.tme - 60, Tsl0 + 150);
    var oreTot = 0; R.forEach(function (r) { oreTot += r.os; });
    var ratio = R.map(function (r, i) { return (r.os + 1e-6) / (LZ.F[i] + 1e-6); });   // ore per gas, relative
    var rdR = ratio.map(function (x) { return cl(mb.rd * Math.pow(x, 0.45), 0.03, 0.95); });
    // normalise so the ore-weighted ring direct reduction equals the furnace balance
    var rdm = 0; R.forEach(function (r, i) { rdm += r.os * rdR[i]; });
    rdR = rdR.map(function (x) { return cl(x * mb.rd / Math.max(rdm, 1e-6), 0.02, 0.98); });
    var oWusS = mb.feHM / 55.85 * pt;                           // kmol/s FeO stage O (×1000 below)
    var siQ = I.si * 10 * 22000 * pt;                          // kW, ≈ 22 MJ per kg Si reduced
    var meltQ = (1000 * 270 + I.slag * 480) * pt;               // kW latent of iron and slag
    var calcQ = mb.co2Flux * 44 / 1000 * 4040 * pt;             // kW, ≈ 4.0 MJ/kg CO2 incl. solution loss of it
    R.forEach(function (r, i) {
      r.qDR = rdR[i] * oWusS * r.os * 1000 * 152.6;             // kW, FeO + C -> Fe + CO
      r.qMelt = meltQ * r.os; r.qCalc = calcQ * r.os; r.qSi = siQ * r.os; r.qEv = r.water * (2257 + 4.19 * 75);
      r.rd = rdR[i];
    });
    // cooling heat loss shared along the wall (hearth and tuyeres take 35 %), applied to the two outer rings
    var Qw = num(I.wallQ, 40) * 1e6 / 3600 * 0.65;              // kW
    var wz = [], wzs = 0;
    for (j = 0; j < NZ; j++) { var zz = (z[j] + z[j + 1]) / 2, f = zz < g.dS - g.sH * 0.4 ? 0.25 : zz < g.dS ? 1.0 : 1.6; var w = 2 * Math.PI * (Rz[j] + Rz[j + 1]) / 2 * dz * f; wz.push(w); wzs += w; }
    wz = wz.map(function (w) { return w / wzs * Qw; });
    var outer = NR - 1;
    // fields
    var Tg = [], Ts = [], F = [], cell, i;
    for (j = 0; j <= NZ; j++) { Tg.push(new Float64Array(NR)); Ts.push(new Float64Array(NR)); F.push(new Float64Array(NR)); }
    for (j = 0; j <= NZ; j++) for (i = 0; i < NR; i++) { var fr = j / NZ; Ts[j][i] = I.Tch + (1450 - I.Tch) * Math.pow(fr, 1.6); Tg[j][i] = Ts[j][i] + 120; }
    var dmref = bp.dO * 0.5 + bp.dC * 0.5;
    // burden enthalpy per ring, kJ/kg from 0 °C, with the heat sinks spread over their temperature windows
    var HT = 5, NH = 421;
    function win(T, a, b) { return smooth((T - a) / (b - a)); }
    R.forEach(function (r) {
      var h = new Float64Array(NH), acc = 0, ws = r.ws;
      for (var k = 0; k < NH; k++) {
        var T = k * HT;
        if (k > 0) { var Tm = T - HT / 2; acc += (r.mc * cpCoke(Tm) + r.mo * cpOre(Tm)) / ws * HT; }
        h[k] = acc + (r.qEv * win(T, 70, 140) + r.qCalc * win(T, 720, 900) + 0.5 * r.qDR * win(T, Tsl0, bp.tss) + 0.5 * r.qDR * win(T, bp.tss, bp.tme) + r.qMelt * win(T, bp.tms, bp.tme)) / ws;
      }
      r.H = h;
    });
    function Hof(r, T) { var x = cl(T / HT, 0, NH - 1.0001), k = Math.floor(x); return r.H[k] + (r.H[k + 1] - r.H[k]) * (x - k); }
    function Tof(r, H) { var h = r.H; if (H <= h[0]) return 0; var lo = 0, hi = NH - 1; if (H >= h[hi]) return hi * HT; while (hi - lo > 1) { var m = (lo + hi) >> 1; if (h[m] < H) lo = m; else hi = m; } return (lo + (H - h[lo]) / Math.max(h[hi] - h[lo], 1e-9)) * HT; }
    var it, maxd = 0, iters = 0;
    var Ngas = new Float64Array(NZ + 1);
    // ring resistance (Ergun A, B per metre) at burden temperature T: lumpy layers -> cohesive (coke slits) -> dripping coke bed
    var hDM = 0.75 * g.r(g.zt) * Math.max(sRw, 0.2) * cl(1 + 0.02 * (60 - I.csr), 0.7, 1.6);   // deadman cone height above the tuyeres, m
    function resAt(i, T, h) {
      var r = R[i], bias = (1 + I.fB * (2 * r.sm - 1) * 0.9) * (r.s1 > 0.97 ? 0.82 : 1) * I.fK;
      if (h != null && r.sm < sRw) { var hc = hDM * (1 - r.sm / Math.max(sRw, 0.05)); if (h < hc) bias *= 1 + 3.5 * smooth((hc - h) / 0.8) * cl(62 / I.csr, 0.8, 1.4); }   // deadman: small, packed coke
      var s1 = smooth((T - bp.tss) / Math.max(bp.tse - bp.tss, 10)), s2 = smooth((T - bp.tms) / Math.max(bp.tme - bp.tms, 10));
      var sl = Math.max(1 - r.phi, 0.15), m = 1 + bp.dpm / 12;
      var Al = r.phi * bp.ore.A + (1 - r.phi) * bp.coke.A, Bl = r.phi * bp.ore.B + (1 - r.phi) * bp.coke.B;
      var Ac = bp.coke.A / (sl * sl) * m, Bc = bp.coke.B / (sl * sl * sl) * m;
      var Ad = bp.cokeL.A * 1.15, Bd = bp.cokeL.B * 1.15;
      var w1 = (1 - s1), w2 = s1 * (1 - s2), w3 = s2;
      return { A: (w1 * Al + w2 * Ac + w3 * Ad) * bias, B: (w1 * Bl + w2 * Bc + w3 * Bd) * bias };
    }
    var Pguess = new Float64Array(NZ + 1); for (j = 0; j <= NZ; j++) Pguess[j] = (Pt + (Pb - Pt) * j / NZ) * 1000;
    function eqSplit(j, out) {          // split of the level's gas between rings at one pressure gradient
      var Ar = Math.PI * Rz[j] * Rz[j], P0 = Pguess[j], res = [], i;
      for (i = 0; i < NR; i++) {
        var T = (j < NZ ? (Ts[j][i] + Ts[j + 1][i]) / 2 : Ts[j][i]), Tgk = Tg[j][i] + 273.15;
        var ab = resAt(i, T, g.zt - z[j]); ab.rho = 0.0286 * P0 / (RG * Tgk); ab.mu = 1.7e-5 * Math.pow(Tgk / 273, 0.7); ab.k = Ar * R[i].a * P0 / (RG * Tgk); res.push(ab);
      }
      var lo = 1, hi = 1e6, n = new Float64Array(NR), G = 1;
      for (var k = 0; k < 50; k++) {
        G = Math.sqrt(lo * hi); var tot = 0;
        for (i = 0; i < NR; i++) { n[i] = uFromG(res[i].A, res[i].B, res[i].mu, res[i].rho, G) * res[i].k; tot += n[i]; }
        if (tot > Ngas[j]) hi = G; else lo = G;
      }
      var t2 = 0; for (i = 0; i < NR; i++) t2 += n[i];
      for (i = 0; i < NR; i++) out[i] = n[i] / t2;
      return G;
    }
    var Glev = new Float64Array(NZ + 1);
    function flows(first) {
      var f = new Float64Array(NR);
      for (var j = 0; j <= NZ; j++) {
        var tsm = 0, wsum = 0, i; for (i = 0; i < NR; i++) { tsm += Ts[j][i] * R[i].os; wsum += R[i].os; } tsm /= wsum;
        var ng = Nt - (Nt - Nb) * cl((tsm - Tsl0) / (Tsl1 - Tsl0), 0, 1);
        Ngas[j] = first ? ng : 0.5 * Ngas[j] + 0.5 * ng;
        Glev[j] = eqSplit(j, f);
        var wb = Math.exp(-(g.zt - z[j]) / Math.max(0.8 * rw.Dr, 0.6));   // raceway sets the split just above the tuyeres
        for (i = 0; i < NR; i++) { var v = wb * FB[i] + (1 - wb) * f[i]; F[j][i] = first ? v : 0.5 * F[j][i] + 0.5 * v; }
      }
    }
    function zoneHa(T) { return 1 - 0.65 * smooth((T - bp.tss + 30) / 60) + 0.15 * smooth((T - bp.tme + 30) / 60); }   // cohesive zone: gas only through coke slits
    // banded solve with partial pivoting (unknowns: Tg_j at 2j, Ts_j at 2j+1)
    var NU = 2 * NZ + 2, KB = 7;
    var M = []; for (var q = 0; q < NU; q++) M.push(new Float64Array(NU + 1));
    function solve() {
      for (var k = 0; k < NU; k++) {
        var p = k, mx = Math.abs(M[k][k]), e = Math.min(NU - 1, k + KB), c, r;
        for (r = k + 1; r <= e; r++) if (Math.abs(M[r][k]) > mx) { mx = Math.abs(M[r][k]); p = r; }
        if (p !== k) { var t = M[p]; M[p] = M[k]; M[k] = t; }
        var piv = M[k][k] || 1e-12, ce = Math.min(NU - 1, k + 2 * KB);
        for (r = k + 1; r <= e; r++) { var fct = M[r][k] / piv; if (!fct) continue; for (c = k; c <= ce; c++) M[r][c] -= fct * M[k][c]; M[r][NU] -= fct * M[k][NU]; }
      }
      var x = new Float64Array(NU);
      for (var k2 = NU - 1; k2 >= 0; k2--) { var sm = M[k2][NU], ce2 = Math.min(NU - 1, k2 + 2 * KB); for (var c2 = k2 + 1; c2 <= ce2; c2++) sm -= M[k2][c2] * x[c2]; x[k2] = sm / (M[k2][k2] || 1e-12); }
      return x;
    }
    var Tdon = new Float64Array(NZ);
    flows(true);
    for (it = 0; it < 220; it++) {
      iters = it + 1;
      if (it > 0 && it % 4 === 0) flows(false);
      // cross-flow: gas leaving rings that lose flow mixes into the rings that gain it (lagged)
      for (j = 0; j < NZ; j++) { var give = 0, gh = 0; for (i = 0; i < NR; i++) { var d0 = F[j + 1][i] - F[j][i]; if (d0 > 0) { give += d0; gh += d0 * Tg[j + 1][i]; } } Tdon[j] = give > 0 ? gh / give : 0; }
      maxd = 0;
      for (i = 0; i < NR; i++) {
        var r = R[i];
        for (q = 0; q < NU; q++) M[q].fill(0);
        // burden unknowns are enthalpies (latent windows stay well behaved); T(H) is linearised at the last iterate
        var ak = new Float64Array(NZ + 1), bk = new Float64Array(NZ + 1), H0 = new Float64Array(NZ + 1);
        for (j = 0; j <= NZ; j++) { var tk = Ts[j][i]; H0[j] = Hof(r, tk); var ck = Math.max((Hof(r, tk + 2) - Hof(r, tk - 2)) / 4, 0.3); bk[j] = 1 / ck; ak[j] = tk - bk[j] * H0[j]; }
        M[0][1] = 1; M[0][NU] = Hof(r, I.Tch);                            // burden charged at the top
        M[NU - 1][2 * NZ] = 1; M[NU - 1][NU] = Tin[i];                     // gas from the raceway / deadman
        for (j = 0; j < NZ; j++) {
          var Ar = Math.PI * Math.pow((Rz[j] + Rz[j + 1]) / 2, 2), A = Ar * r.a, V = A * dz;
          var Fj = Math.max(F[j][i], 1e-9), keep = Math.min(F[j + 1][i], F[j][i]) / Fj, c0 = Math.max(F[j][i] - F[j + 1][i], 0) / Fj * Tdon[j];
          var ng = Ngas[j] * F[j][i], cg = Math.max(ng * cpGas((Tg[j][i] + Tg[j + 1][i]) / 2) / 1000, 1e-9);
          var gm = ng * 0.0286 / A, gref = Ngas[j] * 0.0286 / Ar, dEff = r.phi * bp.dO + (1 - r.phi) * bp.dC;
          var t0 = Ts[j][i], t1 = Ts[j + 1][i], tsm = (t0 + t1) / 2;
          var ce = Math.abs(t1 - t0) > 0.5 ? (H0[j + 1] - H0[j]) / (t1 - t0) : 1 / bk[j];
          var cs = Math.max(r.ws * ce, 1e-9);
          var hv = I.fH * 2.6 * Math.pow(Math.max(gm / gref, 0.05), 0.7) * Math.pow(dmref / dEff, 0.6) * zoneHa(tsm) * V;   // kW/K in the cell
          var cm = Math.min(cg, cs), he = 2 * cm * Math.tanh(hv / (2 * cm));   // exponential-fitted exchange, no wiggles
          var lossG = i === outer ? wz[j] * 0.275 : i === outer - 1 ? wz[j] * 0.225 : 0, lossS = lossG;
          var si = j >= Math.floor(NZ * 0.86) ? r.qSi / (NZ - Math.floor(NZ * 0.86)) : 0;
          var g0 = 2 * j, s0 = 2 * j + 1, g1 = 2 * j + 2, s1 = 2 * j + 3, rg = 2 * j + 1, rs = 2 * j + 2, hk = he / 2 * (ak[j] + ak[j + 1]);
          // gas: cg (Tup − Tg_j) − he ((Tup + Tg_j)/2 − (Ts_j + Ts_j+1)/2) = lossG, with Tup = keep·Tg_j+1 + c0
          M[rg][g1] += (cg - he / 2) * keep; M[rg][g0] += -cg - he / 2; M[rg][s0] += he / 2 * bk[j]; M[rg][s1] += he / 2 * bk[j + 1]; M[rg][NU] = lossG - (cg - he / 2) * c0 - hk;
          // burden: ws (H_j+1 − H_j) − he ((Tup + Tg_j)/2 − (Ts_j + Ts_j+1)/2) = −lossS − si
          M[rs][s1] += r.ws + he / 2 * bk[j + 1]; M[rs][s0] += -r.ws + he / 2 * bk[j]; M[rs][g1] += -he / 2 * keep; M[rs][g0] += -he / 2; M[rs][NU] = -lossS - si + he / 2 * c0 - hk;
        }
        var x = solve();
        for (j = 0; j <= NZ; j++) {
          var tgN = Math.max(x[2 * j], I.Tch), hN = H0[j] + 0.6 * (x[2 * j + 1] - H0[j]);
          var tsN = cl(Tof(r, hN), I.Tch, 2000);
          var dd = Math.max(Math.abs(tsN - Ts[j][i]), Math.abs(tgN - Tg[j][i]) * 0.6);
          maxd = Math.max(maxd, dd);
          Ts[j][i] = tsN; Tg[j][i] += 0.6 * (tgN - Tg[j][i]);
        }
      }
      if (it > 16 && it % 4 === 3 && maxd < 0.5) break;
    }
    // ---------------- results
    var levels = [], P = new Float64Array(NZ + 1), U = [], ETA = [], RED = [], dP = new Float64Array(NZ);
    // pressure: Ergun per level with the local gas temperature and the zone of each ring
    P[0] = Pt * 1000;
    for (j = 0; j < NZ; j++) {
      var grad = 0, Ar = Math.PI * Math.pow((Rz[j] + Rz[j + 1]) / 2, 2), uu = new Float64Array(NR);
      for (i = 0; i < NR; i++) {
        var r3 = R[i], A3 = Ar * r3.a, T3 = (Tg[j][i] + Tg[j + 1][i]) / 2 + 273.15, Ps = P[j];
        var q3 = Ngas[j] * F[j][i] * RG * T3 / Ps, u3 = q3 / A3, rho3 = 0.0286 * Ps / (RG * T3), mu3 = 1.7e-5 * Math.pow(T3 / 273, 0.7);
        var ab = resAt(i, (Ts[j][i] + Ts[j + 1][i]) / 2, g.zt - (z[j] + z[j + 1]) / 2);
        var gr = ab.A * mu3 * u3 + ab.B * rho3 * u3 * u3;
        grad += gr * F[j][i]; uu[i] = u3;
      }
      dP[j] = grad * dz; P[j + 1] = P[j] + dP[j]; U.push(uu);
    }
    U.push(U[NZ - 1]);
    var Ppred = P[NZ] / 1000, dPpred = Ppred - Pt, dPmeas = (I.BP - I.TP) * KG;
    var tuyDP = 0.5 * 1.29 * (Pb / ATM) * 273 / (I.HBT + 273) * rw.vT * rw.vT * 1.4 / 1000;  // kPa, tuyere and raceway
    var pScale = dPmeas > 0 ? (dPmeas - tuyDP) / Math.max(dPpred, 1e-6) : 1;
    var Pd = Array.prototype.map.call(P, function (p) { return Pt + (p / 1000 - Pt) * pScale; });   // kPa abs, scaled to measured
    // reduction degree and CO utilisation along each ring
    var etaRing = [];
    (function () {
      var x = R.map(function (r, i) { return ratio[i]; }), xm = 0, k = 0;
      R.forEach(function (r, i) { xm += LZ.F[i] * x[i]; });
      var target = mb.etaCO / 100, lo = 0.01, hi = 20, emax = 0.62;
      for (k = 0; k < 60; k++) { var a = (lo + hi) / 2, e = 0; R.forEach(function (r, i) { e += LZ.F[i] * emax * (1 - Math.exp(-a * x[i] / xm)); }); if (e > target) hi = a; else lo = a; }
      var a2 = (lo + hi) / 2; etaRing = x.map(function (v) { return emax * (1 - Math.exp(-a2 * v / xm)) * 100; });
    })();
    function redAt(T, rd) {   // reduction degree relative to Fe2O3, %
      if (T < 450) return 0; if (T < 620) return 11.1 * (T - 450) / 170; if (T < 850) return 11.1 + 22.2 * (T - 620) / 230;
      var ind = 66.7 * (1 - rd);
      if (T < Tsl0) return 33.3 + ind * 0.55 * (T - 850) / Math.max(Tsl0 - 850, 1);
      if (T < bp.tse) return 33.3 + ind * (0.55 + 0.45 * (T - Tsl0) / Math.max(bp.tse - Tsl0, 1)) + 66.7 * rd * 0.25 * smooth((T - Tsl0) / Math.max(bp.tse - Tsl0, 1));
      return Math.min(100, 33.3 + ind + 66.7 * rd * (0.25 + 0.75 * smooth((T - bp.tse) / Math.max(bp.tme - bp.tse, 1))));
    }
    for (j = 0; j <= NZ; j++) {
      var er = new Float64Array(NR), rdj = new Float64Array(NR);
      for (i = 0; i < NR; i++) {
        rdj[i] = redAt(Ts[j][i], R[i].rd);
        var indTot = 33.3 + 66.7 * (1 - R[i].rd), indHere = Math.min(rdj[i], indTot);
        er[i] = etaRing[i] * (1 - indHere / indTot) * 1;
      }
      ETA.push(er); RED.push(rdj);
    }
    // gas velocity at every level (actual, superficial), m/s
    // cohesive zone per ring
    function depthAt(i, T) { for (var jj = 0; jj < NZ; jj++) if (Ts[jj][i] <= T && Ts[jj + 1][i] > T) return z[jj] + dz * (T - Ts[jj][i]) / Math.max(Ts[jj + 1][i] - Ts[jj][i], 1e-9); return Ts[0][i] > T ? z[0] : null; }
    var cz = R.map(function (r, i) { var top = depthAt(i, bp.tss), bot = depthAt(i, bp.tme); return { top: top, bot: bot, s: r.sm, red: top == null ? null : redAt(bp.tss, r.rd) }; });
    var trz = R.map(function (r, i) { return { top: depthAt(i, 800), bot: depthAt(i, Tsl0 + 40) }; });
    var hAbove = function (d) { return d == null ? null : g.zt - d; };
    var czC = cz[0], czW = cz[NR - 1];
    var czTops = cz.map(function (c) { return c.top; }).filter(function (v) { return v != null; });
    var apex = czTops.length ? Math.min.apply(null, czTops) : null;
    var rootBot = czW.top != null ? czW.top : czW.bot;
    var thick = cz.filter(function (c) { return c.top != null; }).map(function (c) { return (c.bot != null ? c.bot : g.zt) - c.top; });
    var thickM = thick.length ? thick.reduce(function (a, b) { return a + b; }, 0) / thick.length : null;
    var shape = 'flat';
    if (czC.top != null && czW.top != null) {
      var mid = cz[Math.round(NR * 0.55)] && cz[Math.round(NR * 0.55)].top;
      if (czW.top - czC.top > 1.5 && (mid == null || mid >= czC.top - 0.3)) shape = (mid != null && mid < czC.top - 0.3) ? 'W' : 'inverted V';
      else if (czC.top - czW.top > 1.0) shape = 'V (wall working)';
      else if (mid != null && mid < Math.min(czC.top, czW.top) - 0.8) shape = 'W';
      else shape = 'inverted U / flat';
    } else if (czC.top == null) shape = 'not formed in the centre (cold centre)';
    // charge layers in the cohesive zone (coke slits): one coke + one ore layer per charge
    var cokeBase = calc && calc.f && calc.f.cokeBase > 0 ? calc.f.cokeBase : 7000;
    var chV = cokeBase / I.bdC + cokeBase * (I.coke + I.nut ? (mb.ferr + I.flux) / (I.coke + I.nut) : 4) / I.bdO;
    var zc0 = apex != null ? (apex + (rootBot || g.zt)) / 2 : g.dS;
    var pair = chV / (Math.PI * Math.pow(g.r(zc0), 2));
    var slits = apex != null && czC.top != null ? ((czC.bot != null ? czC.bot : g.zt) - czC.top) / pair : null;
    // zonal table at the standard levels
    var LV = [['Stockline / throat', g.zs + 0.3], ['Upper shaft', g.tH + g.sH * 0.25], ['Middle shaft', g.tH + g.sH * 0.55], ['Lower shaft', g.tH + g.sH * 0.85],
      ['Belly', g.dS + g.bH / 2], ['Bosh', g.dB + g.boH * 0.5], ['Tuyere level', g.zt - 0.05]];
    var ZN = [['Wall', 0.75, 1.0], ['Intermediate', 0.4, 0.75], ['Centre', 0.0, 0.4]];
    function at(field, d) { var x = cl((d - g.zs) / dz, 0, NZ - 1e-6), jj = Math.floor(x), t = x - jj; var row = new Float64Array(NR); for (var ii = 0; ii < NR; ii++) row[ii] = field[jj][ii] * (1 - t) + field[jj + 1][ii] * t; return row; }
    function zoneAvg(row, a, b, w) { var s = 0, ww = 0; R.forEach(function (r, ii) { var o = Math.max(0, Math.min(r.s1, b) - Math.max(r.s0, a)); if (o > 0) { var k = o * (w ? w[ii] : 1) * (r.s0 + r.s1); s += row[ii] * k; ww += k; } }); return ww ? s / ww : NaN; }
    LV.forEach(function (L) {
      var rg = at(Tg, L[1]), rs = at(Ts, L[1]), jj = Math.round(cl((L[1] - g.zs) / dz, 0, NZ)), fw = F[Math.min(jj, NZ)];
      levels.push({ name: L[0], d: L[1], h: g.zt - L[1], D: 2 * g.r(L[1]), zones: ZN.map(function (Z) { return { name: Z[0], gas: zoneAvg(rg, Z[1], Z[2], fw), solid: zoneAvg(rs, Z[1], Z[2]) }; }), P: Pd[jj] });
    });
    // gas flow share by zone (lumpy) and at the bottom
    function zoneShare(Fz) { return ZN.map(function (Z) { var s = 0; R.forEach(function (r, ii) { var o = Math.max(0, Math.min(r.s1, Z[2]) - Math.max(r.s0, Z[1])) / (r.s1 - r.s0); s += Fz[ii] * o; }); return { name: Z[0], pct: s * 100 }; }); }
    var jMid = Math.round(cl((zMid - g.zs) / dz, 0, NZ));
    // production the blast can carry: carbon burnt at the tuyeres ÷ tuyere carbon per tHM at 30 % direct reduction
    var cNeed = mb.cGas - (0.30 * mb.feHM / 55.85 * 1000 + I.si * 10 * 1000 / 28.09 * 2 + 3 * 1000 / 54.9);
    var prodBlast = cNeed > 0 ? (rw.cCoke + rw.cBurn + I.ng * rw.pt / NM3) / cNeed * 1440 : null;
    // top: gas temperature and CO utilisation by ring; probe points P1 (wall) … P5 (centre)
    var topT = Array.prototype.slice.call(Tg[0]), topEta = etaRing.slice();
    var fsum = 0, tmix = 0; R.forEach(function (r, ii) { var ng = Ngas[0] * F[0][ii]; tmix += ng * cpGas(topT[ii]) * topT[ii]; fsum += ng * cpGas(topT[ii]); });
    var topMix = tmix / fsum;
    // burden moisture leaves with the top gas without heat exchange time at the very top: small correction already in sinks
    function ringAt(s, arr) { for (var ii = 0; ii < NR; ii++) if (s <= R[ii].s1 + 1e-9) return arr[ii]; return arr[NR - 1]; }
    // burden probe: model gas temperature at each point (over-burden: gas leaving the burden; in-burden: at that depth)
    var prN = cl(Math.round(num(I.prN, 5)), 1, PRMAX), Rt = g.r(g.zs);
    function modelAtR(sr, depth) { var sx = cl(sr, 0, 1); if (depth <= g.zs) return ringAt(sx, topT); var row = at(Tg, depth), ii = 0; while (ii < NR - 1 && sx > R[ii].s1) ii++; return row[ii]; }
    var prDepth = g.zs - num(I.prH, 0.5);
    var probe = [];
    for (var pi = 1; pi <= prN; pi++) { var dd = probeDist(I, pi), sr = dd / Rt; probe.push({ i: pi, d: dd, s: sr, model: modelAtR(sr, prDepth), L: num(I0 && I0['tl' + pi], null), R: num(I0 && I0['tr' + pi], null) }); }
    var probeS = probe.map(function (p) { return p.s; }), probePred = probe.map(function (p) { return p.model; });
    var probeMeas = probe.map(function (p) { var v = [p.L, p.R].filter(function (x) { return x != null; }); return v.length ? v.reduce(function (a, b) { return a + b; }, 0) / v.length : null; });
    var peN = cl(Math.round(num(I.peN, 8)), 1, PEMAX), peDepth = num(I.peD, 1.5), peModel = modelAtR(0.97, peDepth);
    var peri = []; for (var pj = 1; pj <= peN; pj++) peri.push({ j: pj, ang: periAngle(I, pj), v: num(I0 && I0['t' + pj], null), model: peModel });
    // HM temperature: burden and liquid temperature reaching the tuyeres, ore weighted, less hearth losses
    var tl = 0, tw = 0; R.forEach(function (r, ii) { tl += Ts[NZ][ii] * r.os; tw += r.os; });
    var hmt = cl(tl / tw - 30 + 40 * (I.si - 0.5), 1300, 1600);
    // coke consumption breakdown, kg coke/tHM
    var cokeC = I.cokeFC / 100;
    var cokeTuy = Math.max(rw.cCoke * 12 / 1000 / rw.pt, 0) / cokeC;
    var cokeHM = mb.cHMkg / cokeC * ((I.coke + I.nut) * cokeC / Math.max(mb.cIn * 12 / 1000, 1));
    var cokeDir = Math.max(I.coke + I.nut - cokeTuy - cokeHM, 0);
    // measured comparisons near the wall
    var nearWall = function (d) { var row = at(Tg, d); return zoneAvg(row, 0.75, 1, null); };
    var cmp = [['Top gas temperature (mean of uptakes)', measTop(I0 || {}), topMix], ['Upper shaft, near wall', num(I0 && I0.mUS, null), nearWall(LV[1][1])], ['Middle shaft, near wall', num(I0 && I0.mMS, null), nearWall(LV[2][1])],
      ['Lower shaft, near wall', num(I0 && I0.mLS, null), nearWall(LV[3][1])], ['Hot metal temperature', num(I0 && I0.hmtM, null), hmt],
      ['Top gas CO', num(I0 && I0.tgCO, null), mb.top.CO], ['Top gas CO₂', num(I0 && I0.tgCO2, null), mb.top.CO2], ['Top gas H₂', num(I0 && I0.tgH2, null), mb.top.H2],
      ['Shaft pressure', num(I0 && I0.mPS, null), (Pd[Math.round((LV[2][1] - g.zs) / dz)] - ATM) / KG], ['Bosh / belly pressure', num(I0 && I0.mPB, null), (Pd[Math.round((LV[4][1] - g.zs) / dz)] - ATM) / KG]];
    // K value (plant permeability index), abs kg/cm², bosh gas Nm³/min
    var Kv = (Math.pow(I.BP + 1.033, 2) - Math.pow(I.TP + 1.033, 2)) / Math.pow(rw.bosh, 1.7) * 1e3;
    var heatLossPerT = num(I.wallQ, 40) / (I.prod / 24);
    var throatU = Ngas[0] * RG * (topMix + 273.15) / (Pt * 1000) / (Math.PI * g.Rt * g.Rt);
    var out = {
      I: I, g: g, rw: rw, mb: mb, bp: bp, R: R, NZ: NZ, NR: NR, z: z, Rz: Rz, Tg: Tg, Ts: Ts, F: F, U: U, ETA: ETA, RED: RED, P: Pd, Ngas: Ngas,
      LZ: LZ, FB: FB, levels: levels, zonesTop: zoneShare(F[jMid]), zonesBot: zoneShare(F[NZ]), Fmid: Array.prototype.slice.call(F[jMid]), prodBlast: prodBlast, hDM: hDM, sRw: sRw, cz: cz, trz: trz, Tsl0: Tsl0,
      czApexH: hAbove(apex), czRootH: hAbove(rootBot), czThick: thickM, czShape: shape, slits: slits,
      topT: topT, topEta: topEta, topMix: topMix, probeS: probeS, probePred: probePred, probeMeas: probeMeas, probe: probe, prDepth: prDepth, peri: peri, peDepth: peDepth, peModel: peModel, tops: topTemps(I0 || {}), measTop: measTop(I0 || {}), hmt: hmt,
      dPpred: dPpred, dPmeas: dPmeas, pScale: pScale, tuyDP: tuyDP, Kv: Kv, iters: iters, conv: maxd,
      coke: { tuy: cokeTuy, dir: cokeDir, hm: cokeHM }, cmp: cmp, heatLossPerT: heatLossPerT, throatU: throatU, ringSrc: R.src, nCalc: R.nCalc || R.length, warn: warn,
      outputs: null
    };
    out.alerts = alerts(out);
    out.outputs = outputs(out);
    return out;
  }

  /* ---------------------------------------------------------------- the 17 simulation outputs of the parameter list */
  function outputs(o) {
    var mb = o.mb, rw = o.rw, I = o.I;
    var zt = o.zonesTop;
    var gt = o.levels.map(function (l) { return l.name + ' ' + Math.round(l.zones[0].gas) + '/' + Math.round(l.zones[1].gas) + '/' + Math.round(l.zones[2].gas); });
    return [
      ['Raceway flame temperature (RAFT)', rw.raft, '°C', 0],
      ['Gas flow distribution, wall / intermediate / centre', zt.map(function (z) { return z.pct.toFixed(0); }).join(' / '), '%'],
      ['Gas temperature profile (wall/int./centre)', o.levels[2].zones.map(function (z) { return Math.round(z.gas); }).join(' / '), '°C, middle shaft'],
      ['Burden temperature profile (wall/int./centre)', o.levels[3].zones.map(function (z) { return Math.round(z.solid); }).join(' / '), '°C, lower shaft'],
      ['Reduction degree entering the cohesive zone', o.cz.filter(function (c) { return c.red != null; }).reduce(function (a, c, i, arr) { return a + c.red / arr.length; }, 0), '%', 1],
      ['FeO (wustite) reduced indirectly', 100 * (1 - mb.rd), '%', 1],
      ['CO utilisation ηCO', mb.etaCO, '%', 1],
      ['H₂ utilisation ηH₂', mb.etaH, '%', 1],
      ['Cohesive zone apex / root above tuyeres', (o.czApexH == null ? '–' : o.czApexH.toFixed(1)) + ' / ' + (o.czRootH == null ? '–' : o.czRootH.toFixed(1)), 'm'],
      ['Cohesive zone thickness (mean)', o.czThick, 'm', 2],
      ['Liquid iron formation', 1000, 'kg/tHM', 0],
      ['Slag formation', I.slag, 'kg/tHM', 0],
      ['Hot metal temperature', o.hmt, '°C', 0],
      ['Hot metal production', I.prod, 't/day', 0],
      ['Coke consumption (dry, incl. nut coke)', I.coke + I.nut, 'kg/tHM', 0],
      ['Total fuel rate', I.coke + I.nut + I.pci, 'kg/tHM', 0],
      ['Furnace pressure drop, model / measured', o.dPpred.toFixed(0) + ' / ' + o.dPmeas.toFixed(0), 'kPa']
    ];
  }

  /* ---------------------------------------------------------------- operator alerts */
  function alerts(o) {
    var a = [], rw = o.rw, mb = o.mb, I = o.I, zt = o.zonesTop;
    function add(lv, t, m) { a.push({ lv: lv, t: t, m: m }); }
    if (rw.raft < 2000) add('hi', 'Raceway', 'RAFT ' + rw.raft.toFixed(0) + ' °C is low (aim 2050–2300 °C): raise hot blast temperature or oxygen, or lower blast moisture / PCI.');
    else if (rw.raft > 2350) add('md', 'Raceway', 'RAFT ' + rw.raft.toFixed(0) + ' °C is high: risk of hanging and tuyere damage; add moisture or PCI.');
    if (rw.vT < 180) add('md', 'Tuyere', 'Tuyere velocity ' + rw.vT.toFixed(0) + ' m/s is low: gas stays at the wall; consider smaller tuyeres.');
    if (rw.vT > 290) add('md', 'Tuyere', 'Tuyere velocity ' + rw.vT.toFixed(0) + ' m/s is high: deep raceway, more central gas, higher tuyere pressure drop.');
    if (rw.BGI > 72) add('md', 'Bosh gas', 'Bosh gas index ' + rw.BGI.toFixed(0) + ' m/min is high for the hearth: fluidisation and channelling risk.');
    if (!mb.ok) add('hi', 'Balance', 'The carbon–oxygen balance does not close (direct reduction ' + (mb.rd * 100).toFixed(0) + ' %): check production, fuel rates, blast volume and oxygen against each other.');
    if (zt[2].pct < 18) add('md', 'Gas flow', 'Only ' + zt[2].pct.toFixed(0) + ' % of the gas goes through the centre: weak central flow; lower the centre O/C (more coke or lower ore angle at the centre).');
    if (zt[0].pct > 38) add('md', 'Gas flow', zt[0].pct.toFixed(0) + ' % of the gas goes along the wall: high heat load on staves, lower ηCO; raise the wall O/C.');
    if (o.czRootH != null && o.czRootH < 2.0) add('hi', 'Cohesive zone', 'Cohesive zone root only ' + o.czRootH.toFixed(1) + ' m above the tuyeres: risk of tuyere burning and cold hearth; open the wall less, check wall O/C.');
    if (o.czApexH != null && o.czApexH > o.g.zt - o.g.zs - 3) add('md', 'Cohesive zone', 'Cohesive zone apex is high (' + o.czApexH.toFixed(1) + ' m above tuyeres): short indirect reduction zone in the centre, higher fuel rate.');
    if (/cold centre/.test(o.czShape)) add('hi', 'Centre', 'The centre does not reach softening temperature: cold, dead centre. More central coke, check deadman and coke CSR.');
    if (o.topMix < 90) add('md', 'Top', 'Predicted top gas ' + o.topMix.toFixed(0) + ' °C: below the dew point risk with wet burden.');
    if (o.topMix > 250) add('md', 'Top', 'Predicted top gas ' + o.topMix.toFixed(0) + ' °C is high: heat is lost with the gas; check central gas and coke rate.');
    if (o.dPmeas > 0 && o.pScale > 1.6) add('md', 'Permeability', 'Measured pressure drop is ' + o.pScale.toFixed(1) + '× the model: burden fines, RDI or coke strength are worse than entered, or hanging.');
    if (I.csr < 58) add('md', 'Coke', 'CSR ' + I.csr + ' %: small coke reaches the bosh, deadman permeability falls, less gas to the centre.');
    if (mb.etaCO < 42) add('md', 'Utilisation', 'ηCO ' + mb.etaCO.toFixed(1) + ' %: gas is under-used; fuel rate could fall with better radial distribution.');
    if (!a.length) add('ok', 'All in range', 'No warnings for these inputs.');
    return a;
  }

  /* ---------------------------------------------------------------- matching parameter names from Excel files */
  function norm(s) { return String(s == null ? '' : s).toLowerCase().replace(/₂/g, '2').replace(/[^a-z0-9]/g, ''); }
  var MATMAP = [[/sinter/, 's'], [/pellet/, 'p'], [/lump|ironore|ore/, 'l'], [/pulveri|pci|coal/, 'pci'], [/^coke|cokequality/, 'coke']];
  var RULES = {
    coke: [[/^meanparticlesize|^cokesize/, 'dC'], [/^finesfraction|^fines/, 'finC'], [/^m40|^di$/, 'm40'], [/^m10/, 'm10'], [/^cri/, 'cri'], [/^csr/, 'csr'], [/^moisture/, 'cokeM'], [/^ash/, 'cokeAsh'], [/^fixedcarbon/, 'cokeFC'], [/^bulkdensity/, 'bdC']],
    pci: [[/fixedcarbon/, 'coalFC'], [/volatile/, 'coalVM'], [/proximateanalysisash|^ash$/, 'coalAsh'], [/^moisture/, 'coalM'], [/ultimateanalysiscarbon/, 'coalC'], [/ultimateanalysishydrogen/, 'coalH'], [/ultimateanalysisoxygen/, 'coalO'], [/burnout/, 'burn'], [/coalinjectionrate|^pcirate/, 'pci'], [/^meanparticlesize/, 'pciD'], [/residueon200|residueon75/, 'pciR75'], [/carriergastemperature/, 'carT']],
    fer: [[/^rdi|reductiondegradation/, 'RDI'], [/^reductionindex|^ri$/, 'RI'], [/^feo$/, 'FeO'], [/softeningstart/, 'Tss'], [/softeningend/, 'Tse'], [/meltingstart/, 'Tms'], [/meltingend/, 'Tme'], [/pressuredrop/, 'DP'], [/^mean/, 'SIZE'], [/^fines/, 'FINES']]
  };
  var SIZE = { s: 'dS', p: 'dP', l: 'dL' }, FINES = { s: 'finS', p: 'finP', l: 'finL' };
  var GEN = {}; SECTIONS.forEach(function (s) { if (s.grid) return; s.rows.forEach(function (r) { GEN[norm(r[1])] = r[0]; (r[9] || []).forEach(function (a) { if (!GEN[norm(a)]) GEN[norm(a)] = r[0]; }); GEN[norm(r[0])] = r[0]; }); });
  DYN.forEach(function (d) { GEN[norm(d[0])] = d[0]; GEN[norm(d[1])] = d[0]; });
  function matchKey(mat, par) {
    var p = norm(par), m = norm(mat), mk = null;
    MATMAP.some(function (x) { if (x[0].test(m)) { mk = x[1]; return true; } return false; });
    var rules = mk === 's' || mk === 'p' || mk === 'l' ? RULES.fer : mk ? RULES[mk] : null, hit = null;
    if (rules) rules.some(function (r) { if (r[0].test(p)) { hit = r[1]; return true; } return false; });
    if (hit && (mk === 's' || mk === 'p' || mk === 'l')) hit = hit === 'SIZE' ? SIZE[mk] : hit === 'FINES' ? FINES[mk] : mk + hit;
    if (hit) return hit;
    if (mk && mk !== 'coke' && mk !== 'pci') return null;   // a ferrous property we do not use
    return GEN[p] || null;
  }

  /* ---------------------------------------------------------------- calculated vs actual, and the measured gas direction around the furnace */
  // first circumferential harmonic of a set of readings around the furnace: direction (° from Top temp 1, clockwise) and half peak-to-peak amplitude
  function harmonic(pts) {
    pts = pts.filter(function (p) { return p.v != null; });
    if (pts.length < 3) return null;
    var m = pts.reduce(function (a, p) { return a + p.v; }, 0) / pts.length, x = 0, y = 0;
    pts.forEach(function (p) { var t = p.ang * Math.PI / 180; x += (p.v - m) * Math.sin(t); y += (p.v - m) * Math.cos(t); });
    var amp = 2 / pts.length * Math.sqrt(x * x + y * y), dir = (Math.atan2(x, y) * 180 / Math.PI + 360) % 360;
    var hi = pts.reduce(function (a, p) { return p.v > a.v ? p : a; }), lo = pts.reduce(function (a, p) { return p.v < a.v ? p : a; });
    return { mean: m, amp: amp, dir: dir, spread: hi.v - lo.v, hi: hi, lo: lo, n: pts.length, x: x / pts.length, y: y / pts.length };
  }
  function angName(a, I) {
    var t = topTemps(I), best = t.reduce(function (b, q) { var d = Math.abs(((a - q.ang + 540) % 360) - 180); return d < b.d ? { d: d, q: q } : b; }, { d: 999 });
    return Math.round(a) + '° (' + (best.d < 20 ? 'at ' : 'near ') + best.q.tag + ')';
  }
  function tuyeresNear(I, a, half) {
    var n = Math.max(1, Math.round(num(I.nTuy, 20))), out = [];
    for (var k = 1; k <= n; k++) { var ta = (k - 1) * 360 / n, d = Math.abs(((ta - a + 540) % 360) - 180); if (d <= half) out.push(k); }
    return out;
  }
  function diagnose(I, o) {
    var M = [], f0 = function (v) { return Math.round(v); };
    function add(lv, t, m, act) { M.push({ lv: lv, t: t, m: m, act: act || [] }); }
    var tops = harmonic(o.tops), peri = harmonic(o.peri), mt = o.measTop;
    // probe arms: left arm points at prAng, right arm at prAng + 180; use the outer half of each arm for direction
    var la = num(I.prAng, 30), pts = [];
    o.probe.forEach(function (p) { if (p.s >= 0.5) { pts.push({ ang: la, v: p.L }); pts.push({ ang: (la + 180) % 360, v: p.R }); } });
    var LR = o.probe.filter(function (p) { return p.L != null && p.R != null; }).map(function (p) { return p.L - p.R; });
    var lrMean = LR.length ? LR.reduce(function (a, b) { return a + b; }, 0) / LR.length : null;
    // combined direction: each source weighted by its amplitude
    var vx = 0, vy = 0, w = 0;
    [tops, peri].forEach(function (h) { if (h) { vx += h.x; vy += h.y; w++; } });
    if (lrMean != null && Math.abs(lrMean) > 20) { var t = (lrMean > 0 ? la : la + 180) * Math.PI / 180; vx += Math.abs(lrMean) / 2 * Math.sin(t); vy += Math.abs(lrMean) / 2 * Math.cos(t); w++; }
    var circ = w ? { dir: (Math.atan2(vx, vy) * 180 / Math.PI + 360) % 360, amp: 2 * Math.sqrt(vx * vx + vy * vy) / w, n: w } : null;
    var common = ['Tapping is taken as good and all coal lances as equal and flowing well, so hearth drainage and PCI are not considered as causes.'];
    // 1. uneven top temperatures
    if (tops && tops.spread > 30) {
      var near = tuyeresNear(I, tops.dir, 360 / 8);
      add(tops.spread > 50 ? 'hi' : 'md', 'Gas is leaning to one side',
        'The four uptakes differ by ' + f0(tops.spread) + ' °C (hottest ' + tops.hi.tag + ' ' + f0(tops.hi.v) + ' °C, coolest ' + tops.lo.tag + ' ' + f0(tops.lo.v) + ' °C). The model assumes the same burden and gas all round, so it predicts ' + f0(o.topMix) + ' °C at every uptake. Measured gas is stronger towards ' + angName(tops.dir, I) + '.',
        ['Check the stockline with both stock rods or the radar: a lower stock level on the ' + angName(tops.dir, I) + ' side lets more gas through.',
          'Check the chute: tilt-angle calibration, liner wear and an even rotation speed. Vary the chute start position from charge to charge so material does not always land first on one side.',
          'Tuyeres facing that side' + (near.length ? ' (about ' + near.join(', ') + ', counting tuyere 1 at 0°)' : '') + ': look for leaks, a burnt or protruding tuyere and the blowpipe condition. If the side stays hot for several shifts, a smaller tuyere there or a larger one on the cold side evens the gas.',
          'On the cold side opposite (' + angName((tops.dir + 180) % 360, I) + '): check stave temperatures and heat loads for a scaffold or wall build-up that pushes the gas across.'].concat(common));
    }
    // 2. mean top temperature, model against measured
    if (mt != null && Math.abs(mt - o.topMix) > 40) {
      if (mt > o.topMix) add('md', 'Top runs hotter than calculated', 'Measured ' + f0(mt) + ' °C against ' + f0(o.topMix) + ' °C calculated: more gas heat leaves the top than the inputs explain.',
        ['Look at the probe to see whether the centre or the wall is the cause, then use "Fit to my measurements".', 'Check blast volume and oxygen metering against the production and fuel rate.', 'A higher coke rate or an over-open centre also raises the top temperature.']);
      else add('md', 'Top runs cooler than calculated', 'Measured ' + f0(mt) + ' °C against ' + f0(o.topMix) + ' °C calculated: the burden takes more heat than the inputs explain.',
        ['Check burden and coke moisture (wet burden after rain, coke quenching).', 'The centre may be less open than the model assumes: compare the probe centre points.', 'Use "Fit to my measurements" to set the heat transfer and radial bias.']);
    }
    // 3. probe centre and wall against the model
    var p1 = o.probe[0], pn = o.probe[o.probe.length - 1];
    var avg = function (p) { var v = [p.L, p.R].filter(function (x) { return x != null; }); return v.length ? v.reduce(function (a, b) { return a + b; }, 0) / v.length : null; };
    var c1 = p1 ? avg(p1) : null, cw = pn && o.probe.length > 1 ? avg(pn) : null;
    if (c1 != null && c1 - p1.model < -120) add('md', 'Centre cooler than calculated', 'Probe centre ' + f0(c1) + ' °C against ' + f0(p1.model) + ' °C calculated: less gas comes up the centre than the burden distribution suggests.',
      ['Check that centre coke reaches the centre: ring 1 coke angle and revolutions in the charging matrix.', 'Check coke size and fines, and nut coke landing at the centre.', 'A lower centre O/C (more centre coke) re-opens the centre; change one ring at a time and watch the probe.']);
    if (c1 != null && c1 - p1.model > 150) add('md', 'Centre hotter than calculated', 'Probe centre ' + f0(c1) + ' °C against ' + f0(p1.model) + ' °C calculated: the centre is more open than the model assumes, and heat leaves with the top gas.',
      ['Reduce the centre coke slightly (fewer centre-ring coke revolutions) if the fuel rate allows.', 'Check that the calculator charging matrix matches what is actually charged.']);
    if (cw != null && cw - pn.model > 60) add('md', 'Wall gas stronger than calculated', 'Probe wall points ' + f0(cw) + ' °C against ' + f0(pn.model) + ' °C calculated: more gas goes along the wall.',
      ['Raise the wall O/C: more ore revolutions at the outer rings or a larger ore angle.', 'Check where the ore lands near the wall (chute angle against stockline level).', 'Watch stave heat loads; strong wall gas wears staves and raises the fuel rate.']);
    if (cw != null && cw - pn.model < -50) add('md', 'Wall colder than calculated', 'Probe wall points ' + f0(cw) + ' °C against ' + f0(pn.model) + ' °C calculated: the wall is less active than calculated.',
      ['Check stave temperatures for a scaffold or accretion.', 'A slightly lower wall O/C keeps the wall active.']);
    if (lrMean != null && Math.abs(lrMean) > 60) add('md', 'Left and right probe arms differ', 'Left arm (' + f0(la) + '°) is ' + (lrMean > 0 ? 'hotter' : 'cooler') + ' than the right arm (' + f0((la + 180) % 360) + '°) by ' + f0(Math.abs(lrMean)) + ' °C on average: gas leans towards ' + angName(lrMean > 0 ? la : (la + 180) % 360, I) + '.',
      ['Compare with the uptake temperatures; if both show the same side, act as for gas leaning to one side.', 'Check the probe thermocouples on the cooler arm for faults before acting.']);
    // 4. periphery
    if (peri && peri.spread > 60) add(peri.spread > 100 ? 'hi' : 'md', 'Periphery uneven', 'T' + peri.hi.j + ' at ' + f0(peri.hi.ang) + '° is ' + f0(peri.hi.v) + ' °C and T' + peri.lo.j + ' at ' + f0(peri.lo.ang) + '° is ' + f0(peri.lo.v) + ' °C. Gas along the wall is strongest towards ' + angName(peri.dir, I) + '.',
      ['Check the burden level and ore landing on that side, and the tuyeres facing it.', 'A persistently cold sector can mean a wall build-up; compare the stave temperatures below it.'].concat(common));
    if (peri && Math.abs(peri.mean - o.peModel) > 60) add('md', 'Periphery ' + (peri.mean > o.peModel ? 'hotter' : 'cooler') + ' than calculated', 'Mean of T1 … T' + o.peri.length + ' is ' + f0(peri.mean) + ' °C against ' + f0(o.peModel) + ' °C calculated at the wall.',
      [peri.mean > o.peModel ? 'More gas at the wall than the O/C by ring suggests: raise the wall O/C or check ore landing.' : 'Less gas at the wall than calculated: check for a wall build-up, or lower the wall O/C a little.']);
    if (!M.length && (tops || peri || c1 != null || mt != null)) add('ok', 'Measured and calculated agree', 'Uptakes, probe and periphery are within the normal range of the calculation and even around the furnace.');
    if (!tops && !peri && c1 == null && mt == null) add('ok', 'No readings entered yet', 'Enter Top temp 1–4, the burden probe and periphery temperatures to compare them with the calculation.');
    return { msgs: M, tops: tops, peri: peri, circ: circ, lr: lrMean };
  }

  /* ---------------------------------------------------------------- calibration to measurements */
  // weighted misfit of a run against what the user measured (top gas temperature, over-burden probe, near-wall shaft temperatures)
  function misfit(I, o) {
    var e = 0, n = 0;
    var mt = measTop(I); if (mt != null) { e += Math.pow((o.topMix - mt) / 15, 2); n++; }
    o.probe.forEach(function (p) { [p.L, p.R].forEach(function (v) { if (v != null) { e += Math.pow((p.model - v) / 40, 2) / 2; n += 0.5; } }); });
    [['mUS', 1], ['mMS', 2], ['mLS', 3]].forEach(function (q) { var v = num(I[q[0]], null); if (v != null) { e += Math.pow((o.levels[q[1]].zones[0].gas - v) / 60, 2); n++; } });
    return { e: n ? e / n : 0, n: n };
  }
  function hasProbe(I) { var c = 0; for (var i = 1; i <= cl(Math.round(num(I.prN, 5)), 1, PRMAX); i++) { if (num(I['tl' + i], null) != null) c++; if (num(I['tr' + i], null) != null) c++; } return c >= 3; }
  function fitGrid(I) {
    var fHs = [0.5, 0.7, 0.9, 1.1, 1.3, 1.6, 2.0, 2.5, 3.0], fBs = hasProbe(I) ? [-0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6] : [num(I.fB, 0)];
    var c = []; fHs.forEach(function (h) { fBs.forEach(function (b) { c.push({ fH: h, fB: b }); }); });
    return c;
  }

  var API = { norm: norm, matchParam: matchKey, SECTIONS: SECTIONS, MATS: MATS, DYN: DYN, PRMAX: PRMAX, PEMAX: PEMAX, probeDist: probeDist, periAngle: periAngle, diagnose: diagnose, defaults: defaults, run: run, misfit: misfit, fitGrid: fitGrid, hasProbe: hasProbe, geometry: geometry, raceway: raceway, version: '1.1' };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.BFInside = API;
})(typeof window !== 'undefined' ? window : this);
