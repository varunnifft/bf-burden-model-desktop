/* PCI combustion and raceway model (BF Model 3.4, part of Furnace 3D view).
   Reduced-order engineering model, not CFD: one representative tuyere (the furnace is N identical tuyeres, all lances
   with the same flow), one-dimensional along the lance → blowpipe → tuyere → raceway axis, steady state.
   Particles: 5 size classes from the grind (Rosin-Rammler through the mean size and the −75 µm share).
     heating      convection (Ranz-Marshall) + radiation from the raceway and coke
     volatiles    single first-order rate (Badzioch & Hawksley form), high-heating-rate yield = Q × proximate VM
     char         O2 at the surface, kinetic + film diffusion in series (Baum & Street / Field form), product CO;
                  CO2 gasification after the oxygen is gone
   Gas: O2, N2, CO2, CO, H2O, H2 and volatile carbon; volatiles burn at a mixing-limited rate while O2 lasts, then reform
   with CO2 / H2O; coke at the raceway boundary burns to CO2 and is gasified to CO (Boudouard, water-gas).
   Gas temperature from the enthalpy balance at every step (formation + sensible enthalpies).
   Every kinetic constant is a starting value from the literature and is meant to be calibrated to plant data
   (dust carbon / unburnt char, tuyere camera, raceway probe). Decision support only. */
(function (root) {
  'use strict';
  var NM3 = 22.414e-3, RG = 8.314, ATM = 101325, KGC = 98066.5, SIG = 5.67e-8;
  function cl(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function num(v, d) { return typeof v === 'number' && isFinite(v) ? v : d; }
  // sensible enthalpy above 25 °C, J/mol (t in °C), and formation enthalpy at 25 °C, J/mol
  var HS = {
    O2: function (t) { t -= 25; return t * (31.2 + 0.0024 * t); }, N2: function (t) { t -= 25; return t * (29.0 + 0.0021 * t); },
    CO: function (t) { t -= 25; return t * (29.2 + 0.0021 * t); }, CO2: function (t) { t -= 25; return t * (44.5 + 0.0045 * t); },
    H2O: function (t) { t -= 25; return t * (33.4 + 0.0046 * t); }, H2: function (t) { t -= 25; return t * (28.6 + 0.0015 * t); },
    Cv: function (t) { t -= 25; return t * (15.0 + 0.0040 * t); }
  };
  var HF = { O2: 0, N2: 0, CO: -110530, CO2: -393510, H2O: -241830, H2: 0, Cv: 0 };
  var SP = ['O2', 'N2', 'CO2', 'CO', 'H2O', 'H2', 'Cv'];
  function hTot(n, t) { var s = 0; SP.forEach(function (k) { if (n[k]) s += n[k] * (HF[k] + HS[k](t)); }); return s; }
  function tOf(n, H) { var lo = 0, hi = 3200; for (var i = 0; i < 46; i++) { var m = (lo + hi) / 2; if (hTot(n, m) > H) hi = m; else lo = m; } return (lo + hi) / 2; }
  function hC(t) { return HS.Cv(t); }

  // Rosin-Rammler grind: find d' and n so the mass mean is dm and the share below 75 µm is p75; 5 equal-mass classes
  function grind(dm, p75) {
    dm = cl(dm, 15, 300); p75 = cl(p75, 5, 99.5) / 100;
    var best = null;
    for (var n = 0.6; n <= 4.0; n += 0.01) {
      var dp = 75 / Math.pow(-Math.log(1 - p75), 1 / n);                 // d' from the −75 µm share
      var mean = dp * gamma(1 + 1 / n), e = Math.abs(mean - dm);
      if (!best || e < best.e) best = { e: e, n: n, dp: dp };
    }
    var cls = [0.1, 0.3, 0.5, 0.7, 0.9].map(function (F) { return best.dp * Math.pow(-Math.log(1 - F), 1 / best.n); });
    return { n: best.n, dprime: best.dp, d: cls, w: [0.2, 0.2, 0.2, 0.2, 0.2] };
  }
  function gamma(z) { var g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z)); z -= 1; var x = c[0]; for (var i = 1; i < g + 2; i++) x += c[i] / (z + i); var t = z + g + 0.5; return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x; }

  /* I: furnace inside inputs; rw: raceway() result of the furnace model (blast per tuyere, raceway depth, RAFT) */
  function run(I, rw, opt) {
    opt = opt || {};
    var nT = Math.max(1, Math.round(num(I.nTuy, 20)));
    var pt = I.prod / 86400;                                         // tHM/s
    var coal = (opt.pci != null ? opt.pci : I.pci) * pt / nT;       // kg/s per lance
    var ash = num(I.coalAsh, 10) / 100, mo = num(I.coalM, 1) / 100, vm = num(I.coalVM, 24) / 100;
    var cC = num(I.coalC, 78) / 100, cH = num(I.coalH, 4.4) / 100, cO = num(I.coalO, 5) / 100;
    var daf = Math.max(1 - ash - mo, 0.3);
    var Q = num(I.pciQ, 1.4), vY = cl(Q * vm / daf, 0.05, 0.85);      // volatile yield, fraction of daf coal
    // per tuyere blast (mol/s) at the tuyere: air + oxygen + moisture, and carrier gas
    var air = I.BV / 60 / nT, o2f = I.O2 / 3600 / nT, pur = num(I.O2pur, 99.5) / 100, Wb = num(I.W, 15);
    var n = { O2: (0.21 * air + pur * o2f) / NM3, N2: (0.79 * air + (1 - pur) * o2f) / NM3, CO2: 0, CO: 0, H2O: air * Wb / 18, H2: 0, Cv: 0 };
    var carQ = num(I.carQ, 30) / 3600 / NM3;                         // mol/s per lance
    var carAir = num(I.carType, 1) === 2;
    n.N2 += carAir ? 0.79 * carQ : carQ; if (carAir) n.O2 += 0.21 * carQ;
    var o2In = n.O2;
    var HBT = I.HBT, Tg = HBT;
    // the carrier gas mixes in cold: start from the mixed enthalpy
    var H = hTot(n, HBT) - (carAir ? carQ * (0.79 * (HS.N2(HBT) - HS.N2(num(I.carT, 60))) + 0.21 * (HS.O2(HBT) - HS.O2(num(I.carT, 60)))) : carQ * (HS.N2(HBT) - HS.N2(num(I.carT, 60))));
    Tg = tOf(n, H);
    // geometry along the axis: x = 0 at the lance tip; tuyere nose at Lb; raceway end at Lb + Dr
    var tilt = cl(num(I.tuyAng, 5), 0, 15) * Math.PI / 180, la = cl(num(I.lanceAng, 10), 0, 25) * Math.PI / 180;
    var Lb = cl(num(I.lanceDepth, 450), 50, 2000) / 1000, Dr = rw.Dr / Math.cos(tilt) * (1 + 0.15 * Math.sin(tilt)), Lend = Lb + Dr;
    var dT = num(I.tuyD, 130) / 1000, At = Math.PI * dT * dT / 4, P = ATM + num(I.BP, 2.6) * KGC;
    // mixing of the plume with the blast: faster with a larger lance angle (wider plume), within limits
    var kMix = num(I.pciMix, 1) * (6 + 40 * Math.sin(la)) ;           // 1/m for volatile-oxygen mixing
    var plumeR = function (x) { return Math.min(dT / 2, 0.006 + x * Math.tan(la) * 0.9 + 0.04 * x); };
    var wallHit = Lb * Math.tan(la) > dT / 2 * 0.85;                   // plume reaches the tuyere wall before the nose
    // particle classes
    var G = grind(num(I.pciD, 55), 100 - num(I.pciR75, 20));
    var rhoC = 1300, cpP = 1300;
    var cls = G.d.map(function (d, k) {
      var mdot = coal * G.w[k], d0 = d * 1e-6, m0 = rhoC * Math.PI / 6 * d0 * d0 * d0;
      return { d0: d0, d: d0, np: mdot / m0, m0: m0, vol0: m0 * daf * vY, vol: m0 * daf * vY, ch0: m0 * daf * (1 - vY), ch: m0 * daf * (1 - vY), ash: m0 * ash, wat: m0 * mo,
        T: num(I.carT, 60), u: 20, t: 0, mdot: mdot };
    });
    // kinetics (SI); multipliers are the calibration handles
    var Av = 3.12e5 * num(I.pciKv, 1), Ev = 74e3;                      // devolatilisation 1/s
    var Ac = 0.012 * num(I.pciKc, 1), Ec = 79e3, C1 = 5e-12;            // char + O2: kg/(m² s Pa); A within the range reported for bituminous coal chars, to calibrate
    var Ag = 6.35e-3 * num(I.pciKc, 1), Eg = 162e3;                     // char + CO2
    var cokeT = 1500, dx = opt.dx || 0.0025, steps = Math.ceil(Lend / dx), prof = [], heatDecomp = (250 + 32 * vm * 100) * 1000;   // J/kg coal (as in the raceway heat balance)
    var cokeIn = 0, o2Zero = null, Tpk = Tg, xPk = 0;
    var mCoalPerTuy = coal;
    for (var s = 0; s <= steps; s++) {
      var x = s * dx, inR = x > Lb, xr = x - Lb;
      var tot = SP.reduce(function (a, k) { return a + n[k]; }, 0);
      var Tk = Tg + 273.15;
      // gas velocity: tuyere jet at local temperature, decaying through the raceway to the coke boundary
      var uT = tot * RG * Tk / P / At, ug = inR ? Math.max(uT / (1 + xr / (2.2 * dT)), 6 * Tk / 2000) : uT;
      if (s === 0) cls.forEach(function (c) { c.u = Math.min(c.u, ug); });
      var yO2 = n.O2 / tot, pO2 = yO2 * P, yCO2 = n.CO2 / tot;
      var rhoG = P * 0.029 / (RG * Tk), muG = 1.7e-5 * Math.pow(Tk / 273, 0.7), kG = 0.0241 * Math.pow(Tk / 273, 0.8);
      var Trad = inR ? Math.max(Tk, cokeT + 273.15 + 250) : Math.min(HBT + 273.15 + 0.15 * Math.max(0, (rw.raft - HBT)) * Math.exp(-(Lb - x) / 0.25), 2400);
      var dGas = { O2: 0, CO2: 0, CO: 0, H2O: 0, H2: 0, Cv: 0 }, Hp = 0, dtStep = 0;
      H = hTot(n, Tg);
      cls.forEach(function (c) {
        var up = Math.max(c.u, 1), dt = dx / up; if (c === cls[2]) dtStep = dt;
        c.t += dt;
        // drag towards the gas velocity
        var Re = rhoG * Math.abs(ug - c.u) * c.d / muG, Cd = 24 / Math.max(Re, 0.01) * (1 + 0.15 * Math.pow(Re, 0.687));
        var mp = c.vol + c.ch + c.ash + c.wat, Ap = Math.PI * c.d * c.d;
        c.u += (0.75 * Cd * rhoG * Math.abs(ug - c.u) * (ug - c.u) / ((mp / (Math.PI / 6 * c.d * c.d * c.d)) * c.d)) * dt;
        c.u = cl(c.u, 1, Math.max(ug, 1));
        var Tp = c.T + 273.15;
        var Nu = 2 + 0.6 * Math.sqrt(Re) * 0.89, h = Nu * kG / c.d;
        var qConv = h * Ap * (Tk - Tp), qRad = 0.8 * SIG * Ap * (Math.pow(Trad, 4) - Math.pow(Tp, 4));
        // moisture
        var dW = 0; if (c.wat > 0 && Tp > 373) { dW = Math.min(c.wat, (qConv + qRad) * dt / 2.6e6); c.wat -= dW; }
        // devolatilisation
        var kv = Av * Math.exp(-Ev / (RG * Tp)), dV = Math.min(c.vol, c.vol * (1 - Math.exp(-kv * dt)));
        c.vol -= dV;
        // char: O2 (kinetic + diffusion in series), then CO2 gasification
        var kk = Ac * Math.exp(-Ec / (RG * Tp)), kd = C1 * Math.pow((Tp + Tk) / 2, 0.75) / c.d;
        var rO = pO2 / (1 / kk + 1 / kd) * Ap;                          // kg C/s per particle
        var rG = Ag * Math.exp(-Eg / (RG * Tp)) * yCO2 * P * Ap * 0.02;
        var dCh = Math.min(c.ch, (rO + rG) * dt), fO = rO + rG > 0 ? rO / (rO + rG) : 1;
        c.ch -= dCh;
        // particle energy: heating + char oxidation heat (C + ½O2 → CO) − gasification − decomposition − evaporation
        var qRx = dCh * fO / 0.012 * 110530 - dCh * (1 - fO) / 0.012 * 172460;
        var mNow = c.vol + c.ch + c.ash + c.wat;
        c.T += ((qConv + qRad) * dt + qRx - dV * heatDecomp / Math.max(vY * daf, 0.05) * 0.5 - dW * 2.6e6 * 0) / Math.max(mNow * cpP, 1e-18);
        c.T = cl(c.T, 20, 2600);
        // shrinking: diameter follows the remaining solid at constant density in the char stage
        var frac = (c.ch + c.ash) / (c.ch0 + c.ash + 1e-30);
        c.d = c.d0 * Math.max(Math.pow(Math.max(frac, 0.02), 1 / 3), 0.25) * (c.vol > 0.05 * c.vol0 ? 1.0 : 1.1);
        // to the gas, per second for all particles of the class
        var N = c.np;
        var volC = dV * (cC - (1 - vY) * daf * 0.92) / Math.max(vY * daf, 0.05);   // carbon carried by the volatiles
        volC = Math.max(Math.min(volC, dV), 0);
        var volH = Math.min(dV * cH / Math.max(vY * daf, 0.05), dV - volC), volO = Math.max(Math.min(dV * cO / Math.max(vY * daf, 0.05), dV - volC - volH), 0);
        dGas.Cv += N * volC / 0.012; dGas.H2 += N * volH / 0.002; dGas.O2 += N * volO / 0.032;
        dGas.H2O += N * dW / 0.018;
        dGas.CO += N * dCh / 0.012 * (fO + 2 * (1 - fO)); dGas.O2 -= N * dCh * fO / 0.012 / 2; dGas.CO2 -= N * dCh * (1 - fO) / 0.012;
        Hp += N * (-(qConv * dt) - dV * heatDecomp / Math.max(vY * daf, 0.05) * 0.5);
      });
      // particle products join the gas at the gas temperature with their formation enthalpy (the char oxidation heat went to
      // the particle and comes back by convection); the gas also loses the heat that warms the particles
      SP.forEach(function (k) { if (dGas[k]) n[k] = Math.max(n[k] + dGas[k], 0); });
      H = hTot(n, Tg) + Hp;
      // gas-phase reactions over dx: volatiles and H2 burn while O2 is available (mixing limited), then reform
      var mixF = 1 - Math.exp(-kMix * dx * (inR ? 3 : 1));
      if (n.O2 > 1e-9) {
        var burnH2 = Math.min(n.H2 * mixF, n.O2 * 2 * 0.5); n.H2 -= burnH2; n.H2O += burnH2; n.O2 -= burnH2 / 2;
        var burnC = Math.min(n.Cv * mixF, n.O2); n.Cv -= burnC; n.CO2 += burnC; n.O2 -= burnC;
      } else {
        var kr = (1 - Math.exp(-dx * 8 * Math.exp(-120e3 / RG * (1 / Tk - 1 / 2073))));
        var r1 = Math.min(n.Cv * kr, n.CO2); n.Cv -= r1; n.CO2 -= r1; n.CO += 2 * r1;
        var r2 = Math.min(n.Cv * kr, n.H2O); n.Cv -= r2; n.H2O -= r2; n.CO += r2; n.H2 += r2;
      }
      // coke at the raceway boundary: combustion to CO2, then Boudouard and water-gas
      if (inR) {
        var k1 = num(I.pciCoke, 1) * 3.0 / Dr * Math.min(1, 0.25 + xr / (0.45 * Dr)), rC1 = n.O2 * (1 - Math.exp(-k1 * dx)); n.O2 -= rC1; n.CO2 += rC1; cokeIn += rC1; H += rC1 * hC(cokeT);
        var kb = (2.6 / Dr) * Math.exp(-180e3 / RG * (1 / Tk - 1 / 2273)), rB = n.CO2 * (1 - Math.exp(-kb * dx)) * (n.O2 < 0.05 * o2In ? 1 : 0.15);
        n.CO2 -= rB; n.CO += 2 * rB; cokeIn += rB; H += rB * hC(cokeT);
        var rW = n.H2O * (1 - Math.exp(-kb * 0.8 * dx)) * (n.O2 < 0.05 * o2In ? 1 : 0.15); n.H2O -= rW; n.CO += rW; n.H2 += rW; cokeIn += rW; H += rW * hC(cokeT);
      }
      Tg = tOf(n, H);
      if (Tg > Tpk) { Tpk = Tg; xPk = x; }
      if (o2Zero == null && n.O2 < 0.01 * o2In) o2Zero = x;
      if (s % 4 === 0 || s === steps) {
        var tt = SP.reduce(function (a, k) { return a + n[k]; }, 0), mc = cls[2];
        var vr = 0, cr = 0, bo = 0, wsum = 0;
        cls.forEach(function (c) { var w = c.mdot; vr += w * (1 - c.vol / c.vol0); cr += w * (1 - c.ch / c.ch0); bo += w * (1 - (c.vol + c.ch) / (c.vol0 + c.ch0)); wsum += w; });
        prof.push({ x: x, t: cls[2].t * 1000, Tg: Tg, Tp: cls.map(function (c) { return c.T; }), u: ug, up: cls.map(function (c) { return c.u; }), d: cls.map(function (c) { return c.d * 1e6; }),
          O2: n.O2 / tt * 100, CO2: n.CO2 / tt * 100, CO: n.CO / tt * 100, H2O: n.H2O / tt * 100, H2: n.H2 / tt * 100, N2: n.N2 / tt * 100,
          vol: vr / wsum * 100, char: cr / wsum * 100, burn: bo / wsum * 100,
          cls: cls.map(function (c) { return { vol: 1 - c.vol / c.vol0, ch: 1 - c.ch / c.ch0, T: c.T, t: c.t * 1000 }; }) });
      }
    }
    var last = prof[prof.length - 1], tt2 = SP.reduce(function (a, k) { return a + n[k]; }, 0);
    var burn = last.burn, unb = cls.reduce(function (a, c) { return a + c.ch * c.np; }, 0);           // kg/s char left per tuyere
    var o2Need = coal * daf * (cC / 0.012 + cH / 0.002 / 2 - cO / 0.016 / 1) / 1 * 1;                 // mol O2 for coal C→CO2 and H→H2O
    o2Need = coal * (cC / 0.012 + cH / 0.004 - cO / 0.032);
    var lam = o2In / Math.max(o2Need, 1e-9);
    var tNose = null, tExit = last.t; prof.forEach(function (p) { if (tNose == null && p.x >= Lb) tNose = p.t; });
    var warn = [];
    if (wallHit) warn.push({ lv: 'md', t: 'Plume reaches the tuyere wall', m: 'At ' + Math.round(num(I.lanceAng, 10)) + '° and ' + Math.round(Lb * 1000) + ' mm the coal plume spreads to the tuyere wall before the nose: risk of tuyere erosion and coal build-up. Reduce the lance angle or the insertion depth.' });
    if (burn < 60) warn.push({ lv: 'hi', t: 'Low burnout in the raceway', m: 'Only ' + burn.toFixed(0) + ' % of the coal (daf) burns in the raceway: unburnt char goes up the furnace, reduces permeability and raises coke consumption. Finer grind (more −75 µm), more oxygen, a deeper lance or a higher hot blast temperature raise burnout.' });
    else if (burn < 75) warn.push({ lv: 'md', t: 'Burnout moderate', m: 'Burnout ' + burn.toFixed(0) + ' %: acceptable, but watch the top-gas dust carbon and the furnace permeability at higher PCI.' });
    if (lam < 1.4) warn.push({ lv: 'md', t: 'Little oxygen per kg of coal', m: 'Oxygen excess λ ' + lam.toFixed(2) + ': the oxygen in the blast is not much more than the coal needs, so burnout is oxygen limited. More enrichment helps more than finer grind here.' });
    if (o2Zero != null && o2Zero < Lb) warn.push({ lv: 'md', t: 'Oxygen used up inside the tuyere', m: 'The volatiles use the oxygen before the tuyere nose: high tuyere heat load. Insert the lance less deep.' });
    if (!warn.length) warn.push({ lv: 'ok', t: 'PCI combustion in range', m: 'Burnout, oxygen excess and plume position are within the usual range for these inputs.' });
    return {
      grind: G, cls: cls, prof: prof, Lb: Lb, Dr: Dr, Lend: Lend, dT: dT, tilt: tilt, la: la, plumeR: plumeR, wallHit: wallHit,
      burn: burn, vol: last.vol, char: last.char, unbKgH: unb * 3600, unbKgT: unb * nT / pt, coalKgMin: coal * 60, nT: nT,
      exit: { O2: last.O2, CO2: last.CO2, CO: last.CO, H2O: last.H2O, H2: last.H2, N2: last.N2, T: last.Tg },
      Tpk: Tpk, xPk: xPk, o2Zero: o2Zero, tNose: tNose, tExit: tExit, lam: lam, vY: vY * 100, cokeKgH: cokeIn * 0.012 * 3600,
      coalPerO2: coal / Math.max(o2In * NM3, 1e-9), warn: warn, status: 'Preliminary', calibrated: num(I.burnM, null) != null
    };
  }
  // highest PCI rate that keeps burnout at or above the target (sweeps the rate)
  function maxPci(I, rw, target) {
    var lo = 20, hi = 320, ok = null;
    for (var k = 0; k < 10; k++) { var m = (lo + hi) / 2, r = run(I, rw, { pci: m, dx: 0.006 }); if (r.burn >= target) { ok = m; lo = m; } else hi = m; }
    return ok;
  }
  var API = { run: run, maxPci: maxPci, grind: grind };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.BFPci = API;
})(typeof window !== 'undefined' ? window : this);
