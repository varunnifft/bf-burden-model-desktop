/* Feedback and Suggestion page. A suggestion goes to the registration server (auth-api.js, action "suggest"), which
   saves it in the admin's Sheet and emails the admin. If the server cannot take it (not updated yet, or offline),
   the email app opens with the suggestion addressed to the admin, so nothing is lost. */
(function () {
  'use strict';
  var SENT = 'bf-sug-sent', ADMIN = window.BF_ADMIN_EMAIL || '';
  var $ = function (id) { return document.getElementById(id); };
  var NAV = [['index.html', '‹ Home'], ['data-input.html', 'Data input'], ['chemistry.html', 'Batch chemistry'], ['calculator.html', 'Burden calculator'], ['simulator.html', '3D distribution'], ['furnace-inside.html', 'Furnace 3D view'], ['report.html', 'Report'], ['materials.html', 'Fact must know'], ['feedback.html', 'Feedback & suggestion'], ['charging-modes.html', 'Other charging modes']];
  $('nav').innerHTML = NAV.map(function (n) { return '<a href="' + n[0] + '"' + (n[0] === 'feedback.html' ? ' class="on" aria-current="page"' : '') + '>' + n[1] + '</a>'; }).join('');

  function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function rd(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function wr(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function time(s) { var d = new Date(s); return isNaN(d) ? '' : d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear() + ', ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  function say(el, text, cls) { el.textContent = text || ''; el.className = 'msg' + (cls ? ' ' + cls : ''); }

  function mailto(d) {
    var u = BFAuth.user() || {};
    var body = d.type + ' for: ' + d.page + '\n\n' + d.text + '\n\nFrom: ' + (u.name || '') + (u.company ? ', ' + u.company : '') +
      '\nLogin ID: ' + (u.loginId || '') + '\nApp: BF Model ' + (window.BF_APP_VERSION || '');
    return 'mailto:' + ADMIN + '?subject=' + encodeURIComponent('BF Model ' + d.type.toLowerCase() + ' from ' + (u.name || u.loginId || 'a user')) + '&body=' + encodeURIComponent(body);
  }
  if (ADMIN) $('mailLine').innerHTML = 'You can also email the admin: <a href="mailto:' + esc(ADMIN) + '">' + esc(ADMIN) + '</a>';

  function sentList() {
    var s = rd(SENT) || [];
    $('sent').innerHTML = s.length ? '<p class="hint" style="margin:0">Sent from this device</p>' + s.slice(0, 5).map(function (x) {
      return '<div>' + esc(time(x.at)) + ' · ' + esc(x.type) + ' · ' + esc(x.page) + (x.by === 'email' ? ' · by email' : '') + '<br>' + esc(x.text.length > 140 ? x.text.slice(0, 140) + '…' : x.text) + '</div>';
    }).join('') : '';
  }
  function keep(d, by) { var s = rd(SENT) || []; d.at = Date.now(); d.by = by; s.unshift(d); wr(SENT, s.slice(0, 20)); sentList(); }

  $('sugForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = this, btn = f.querySelector('button[type=submit]'), u = BFAuth.user() || {};
    var d = { type: f.elements.type.value, page: f.elements.page.value, text: f.elements.text.value.trim() };
    if (d.text.length < 5) { say($('sugMsg'), 'Please write your suggestion first.', 'bad'); return; }
    btn.disabled = true; say($('sugMsg'), 'Sending…');
    BFAuth.call('suggest', { loginId: u.loginId || '', token: u.token || '', type: d.type, page: d.page, text: d.text }).then(function () {
      btn.disabled = false; f.elements.text.value = '';
      say($('sugMsg'), 'Thank you! Your suggestion was sent to the app admin.', 'ok');
      keep(d, 'app');
    }, function (err) {
      btn.disabled = false;
      var m = err && err.message || '';
      // a server without the suggestion box, no server link, or no internet: hand it to the email app instead
      if (ADMIN && /unknown action|did not answer|Unexpected answer|not set up|No internet|request failed|HTTP/i.test(m)) {
        say($('sugMsg'), 'Opening your email app with the suggestion addressed to the admin. Press Send there.', 'ok');
        keep(d, 'email'); f.elements.text.value = '';
        location.href = mailto(d);
      } else say($('sugMsg'), m, 'bad');
    });
  });
  sentList();
})();
