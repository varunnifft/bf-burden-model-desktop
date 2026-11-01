/* 2-month free Pro for every user (introductory offer, BF apps 2026-10).
   Free-until-date unlock kept on this device for the signed-in login: the user presses "Start 2 months free" once,
   and every paid page (Report, Other charging modes) stays open until that date. Nothing is charged and nothing
   renews; afterwards the normal ₹25 subscription applies. Change TRIAL_DAYS or set on:false to stop the offer. */
(function () {
  'use strict';
  var TRIAL_DAYS = 61, KEY = 'bf-trial', ON = !(window.BF_TRIAL && window.BF_TRIAL.on === false);
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function who() { try { var u = JSON.parse(localStorage.getItem('bf-user') || 'null'); return (u && u.loginId) || 'device'; } catch (e) { return 'device'; } }
  function rd() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } }
  function wr(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { } }
  function day(t) { var d = new Date(t); return d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear(); }
  function state() {
    var r = rd()[who()], start = r ? Date.parse(r) : 0, until = start ? start + TRIAL_DAYS * 864e5 : 0;
    return { offered: ON, started: !!start, active: ON && until > Date.now(), until: until, untilText: until ? day(until) : '',
      daysLeft: until > Date.now() ? Math.ceil((until - Date.now()) / 864e5) : 0, days: TRIAL_DAYS };
  }
  function start() {
    var all = rd(), k = who();
    if (!all[k]) { all[k] = new Date().toISOString(); wr(all); }
    document.dispatchEvent(new Event('bftrial'));
    return state();
  }
  window.BFTrial = { state: state, start: start };
})();
