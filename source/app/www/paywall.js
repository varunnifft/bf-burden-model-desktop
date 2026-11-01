/* Paid pages (BF Model 3.1): Report (item "report") and Other charging modes with its 3D run (item "modes").
   Phone app: Google Play subscriptions through the Android shell (Android.proQuery / Android.proBuy, answers come
   back in window.__bfPro). Windows / Mac: Razorpay through the registration server (proStatus / proCheckout).
   The page is covered until the subscription is confirmed; the last answer is kept so the page also opens offline
   until the paid period ends. With no way to pay on this device (no Play billing, server keys not set), nothing is locked. */
(function () {
  'use strict';
  if (window.top !== window) return;
  var P = window.BF_PAY || {}, KEY = 'bf-pro';
  var path = location.pathname, item = /report\.html$/.test(path) ? 'report' : /charging-modes\.html$/.test(path) || (/simulator\.html$/.test(path) && /[?&]seq=1\b/.test(location.search)) ? 'modes' : '';
  var NAMES = { report: 'Report', modes: 'Other charging modes', all: 'Report and Other charging modes' };
  var WHAT = { report: 'The full report: slag and hot metal chemistry, rates, production, burden ratio, charging matrix, distribution and technical suggestions, with PDF download.',
    modes: 'COO and CCO charging: your dump tables, O/C, layers and ring-wise ore and coke, and the whole charge played in the 3D distribution.',
    all: 'Report and Other charging modes.' };
  var phone = !!(window.Android && window.Android.proQuery);
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function day(t) { var d = new Date(t); return isNaN(d) ? '' : d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear(); }
  function rd() { try { return JSON.parse(localStorage.getItem(KEY) || 'null') || {}; } catch (e) { return {}; } }
  function wr(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { } }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function price() { return (P.currency === 'INR' ? '₹' : (P.currency || '') + ' ') + (P.price || 0) + ' for ' + (P.months || 3) + ' months'; }
  function buyItem(it) { return P.plan === 'all' ? 'all' : it; }
  function until(c, it) { var t = c.items && Date.parse(c.items[it] || ''); return t > Date.now() ? t : 0; }

  /* ---------- asking the shop */
  var waits = [];
  window.__bfPro = function (json) {           // phone: Google Play answered (owned subscriptions or a finished purchase)
    var r = {}; try { r = JSON.parse(json) || {}; } catch (e) { }
    var w = waits; waits = []; w.forEach(function (f) { f(r); });
  };
  function ask() {
    if (phone) return new Promise(function (ok) {
      waits.push(function (r) { ok({ ok: !r.error, error: r.error, payments: r.ready !== false, items: r.items || {} }); });
      try { window.Android.proQuery(JSON.stringify(P.play || {})); } catch (e) { window.__bfPro('{"error":"billing"}'); }
    });
    if (!window.BFAuth || !BFAuth.user() || !BFAuth.configured()) return Promise.resolve({ ok: false, error: 'login' });
    var u = BFAuth.user();
    return BFAuth.call('proStatus', { loginId: u.loginId, token: u.token || '' }).then(function (r) { return { ok: true, payments: !!r.payments, items: r.items || {} }; },
      function (e) { return { ok: false, error: e.message }; });
  }
  function refresh() {
    return ask().then(function (r) {
      var c = rd();
      if (r.ok) { c = { items: r.items, payments: r.payments, at: Date.now(), via: phone ? 'play' : 'server' }; wr(c); }
      c.error = r.ok ? '' : r.error;
      return c;
    });
  }

  /* ---------- the cover */
  var css = '.bfpay{position:fixed;inset:0;z-index:80;display:grid;place-items:center;padding:max(16px,env(safe-area-inset-top,0px)) 16px 16px;' +
    'background:rgba(14,16,18,.72);-webkit-backdrop-filter:blur(7px);backdrop-filter:blur(7px);font:15px/1.5 "IBM Plex Sans",system-ui,sans-serif;overflow:auto}' +
    '.bfpay .box{position:relative;max-width:440px;width:100%;background:linear-gradient(160deg,#272b31,#17191c);color:#f2efe9;border:1px solid #3a3f46;border-radius:16px;padding:22px 20px 18px;box-shadow:0 30px 60px -20px rgba(0,0,0,.8)}' +
    '.bfpay .box::before{content:"";position:absolute;left:0;right:0;top:0;height:5px;border-radius:16px 16px 0 0;background:linear-gradient(90deg,#ff3d00,#ff7a1a 45%,#ffc23d)}' +
    '.bfpay h2{margin:4px 0 6px;font:700 26px/1.1 "Barlow Condensed","Arial Narrow",sans-serif;letter-spacing:.04em;text-transform:uppercase}' +
    '.bfpay .amt{font:700 34px/1 "Barlow Condensed","Arial Narrow",sans-serif;color:#ffb547;margin:10px 0 2px}.bfpay .amt small{font:500 14px "IBM Plex Sans",sans-serif;color:#c9c4bb}' +
    '.bfpay p{margin:8px 0;color:#d6d1c9;font-size:14px}.bfpay .msg{min-height:1.2em;color:#ffb4a8}.bfpay .msg.ok{color:#8fe0a3}' +
    '.bfpay .row{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}.bfpay button,.bfpay a.b{font:700 14px/1 "IBM Plex Sans",sans-serif;padding:13px 16px;border-radius:10px;border:1px solid #4a4f57;background:#2c3036;color:#f2efe9;cursor:pointer;text-decoration:none}' +
    '.bfpay button.go{flex:1 1 100%;background:linear-gradient(180deg,#ff9a3d,#ec5f12);color:#1a0900;border-color:#ffb066;font-size:16px;padding:15px}' +
    '.bfpay button:disabled{opacity:.6}.bfpay .fine{font-size:12px;color:#a9a399}';
  var box = null;
  function cover(html) {
    if (!box) {
      var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
      box = document.createElement('div'); box.className = 'bfpay'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
      document.body.appendChild(box);
    }
    box.innerHTML = '<div class="box">' + html + '</div>';
    box.hidden = false; document.documentElement.style.overflow = 'hidden';
  }
  function uncover() { if (box) { box.hidden = true; } document.documentElement.style.overflow = ''; document.dispatchEvent(new Event('bfpaid')); }
  function say(t, okc) { var m = box && box.querySelector('.msg'); if (m) { m.textContent = t || ''; m.className = 'msg' + (okc ? ' ok' : ''); } }

  function offer(it, c, closable) {
    var b = buyItem(it), t = until(c, it);
    cover('<h2>' + esc(NAMES[it]) + '</h2>' +
      (t ? '<p>Your subscription is active until <b>' + esc(day(t)) + '</b>.' + (phone ? ' It renews on Google Play; manage or cancel it in the Play Store under Payments &amp; subscriptions.' : ' Paying again adds ' + (P.months || 3) + ' months.') + '</p>'
         : '<p>' + esc(WHAT[b]) + '</p>') +
      '<div class="amt">' + esc((P.currency === 'INR' ? '₹' : '') + (P.price || 0)) + ' <small>for ' + (P.months || 3) + ' months' + (b === 'all' ? ', Report and Other charging modes' : '') + '</small></div>' +
      '<p class="fine">' + (phone ? 'Paid through Google Play, renews every ' + (P.months || 3) + ' months until you cancel.' : 'Pay by UPI, card or netbanking (Razorpay). One payment opens it for ' + (P.months || 3) + ' months; it does not renew by itself.') + '</p>' +
      '<p class="msg" role="status"></p>' +
      (window.BFTrial && BFTrial.state().offered && !BFTrial.state().started ? '<div class="row"><button type="button" class="go" data-x="trial" style="background:linear-gradient(180deg,#5fe0db,#19b3b1);border-color:#7ff0ea;color:#04201f">Start 2 months free ›</button></div>' : '') +
      '<div class="row"><button type="button" class="go" data-x="buy">' + (t ? 'Add ' + (P.months || 3) + ' months' : (phone ? 'Subscribe ' : 'Pay ') + esc((P.currency === 'INR' ? '₹' : '') + (P.price || 0))) + ' ›</button>' +
      (phone ? '' : '<button type="button" data-x="check">I have paid, check again</button>') +
      (closable || t ? '<button type="button" data-x="close">Close</button>' : '<a class="b" href="index.html">‹ Home</a>') + '</div>');
    box.onclick = function (e) {
      var x = e.target.getAttribute && e.target.getAttribute('data-x'); if (!x) return;
      if (x === 'close') { uncover(); return; }
      if (x === 'trial') { BFTrial.start(); uncover(); return; }
      if (x === 'check') { check(it, true); return; }
      if (x === 'buy') buy(it, e.target);
    };
  }
  function buy(it, btn) {
    var b = buyItem(it);
    if (phone) {
      btn.disabled = true; say('Opening Google Play…');
      waits.push(function (r) { btn.disabled = false; if (r.error) say(r.error === 'cancel' ? '' : 'Google Play: ' + r.error); else { wr({ items: r.items || {}, payments: true, at: Date.now(), via: 'play' }); gate(it); } });
      try { window.Android.proBuy((P.play || {})[b] || ''); } catch (e) { btn.disabled = false; say('Google Play is not available.'); }
      return;
    }
    var u = BFAuth.user(); btn.disabled = true; say('Making your payment link…');
    BFAuth.call('proCheckout', { loginId: u.loginId, token: u.token || '', item: b }).then(function (r) {
      btn.disabled = false; say('Pay in the page that opened, then come back here. It opens by itself after payment.', true);
      if (window.Android && window.Android.openUrl) window.Android.openUrl(r.url); else window.open(r.url, '_blank', 'noopener');
      watch(it);
    }, function (e) { btn.disabled = false; say(e.message); });
  }
  var watching = 0;
  function watch(it) {               // after paying in the browser: check when the app comes back, and every 10 s for 5 min
    if (watching) return; var n = 0;
    watching = setInterval(function () { if (++n > 30) { clearInterval(watching); watching = 0; } check(it, false); }, 10000);
    window.addEventListener('focus', function () { check(it, false); });
  }
  function check(it, loud) {
    if (loud) say('Checking…');
    return refresh().then(function (c) {
      if (!c.payments || until(c, it)) { if (watching) { clearInterval(watching); watching = 0; } uncover(); return; }
      if (loud) say(c.error ? c.error : 'No payment found yet. If you have just paid, wait a minute and check again.');
    });
  }
  /** opens the page if the subscription is active (or nothing is for sale here), otherwise covers it */
  function gate(it) {
    var T = window.BFTrial && BFTrial.state();
    if (T && T.active) { uncover(); return; }                 // 2-month free Pro (trial.js)
    var c = rd();
    if (c.at && (!c.payments || until(c, it))) {          // last answer says open: open now, confirm in the background
      uncover();
      if (Date.now() - c.at > 6 * 3600 * 1000) refresh().then(function (n) { if (n.at === c.at) return; if (n.payments && !until(n, it)) offer(it, n); });
      return;
    }
    cover('<h2>' + esc(NAMES[it]) + '</h2><p>Checking your subscription…</p><p class="msg" role="status"></p>');
    refresh().then(function (n) {
      if (!n.at) {                                   // never got an answer: no login or no internet
        if (n.error === 'login' || /not set up|unknown action|did not answer|Unexpected answer/.test(n.error || '')) { uncover(); return; }   // no login, or a server from before 3.1
        cover('<h2>' + esc(NAMES[it]) + '</h2><p>Connect to the internet once to check your subscription.</p><p class="msg" role="status">' + esc(n.error || '') + '</p>' +
          (window.BFTrial && BFTrial.state().offered && !BFTrial.state().started ? '<div class="row"><button type="button" class="go" data-x="trial" style="background:linear-gradient(180deg,#5fe0db,#19b3b1);border-color:#7ff0ea;color:#04201f">Start 2 months free ›</button></div>' : '') +
          '<div class="row"><button type="button" class="go" data-x="check">Try again</button><a class="b" href="index.html">‹ Home</a></div>');
        box.onclick = function (e) { var x = e.target.getAttribute('data-x'); if (x === 'check') gate(it); else if (x === 'trial') { BFTrial.start(); uncover(); } };
        return;
      }
      if (!n.payments || until(n, it)) uncover(); else offer(it, n);
    });
  }

  window.BFPaid = {
    state: function (it) { var c = rd(), t = until(c, it), T = window.BFTrial ? BFTrial.state() : {}; return { until: t, untilText: t ? day(t) : '', payments: !!c.payments, trial: !!T.active, trialUntil: T.untilText || '' }; },
    show: function (it) { offer(it || item, rd(), true); },
    refresh: refresh
  };
  if (P.on === false) { window.BFPaid.show = function () { }; return; }
  var start = function () {
    if (item) gate(item);
    else if (window.BFAuth && BFAuth.user() && Date.now() - (rd().at || 0) > 6 * 3600 * 1000) refresh();   // home page: keep the answer fresh
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
