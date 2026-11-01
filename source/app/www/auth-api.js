/* Registration and login for BF Model. The server is a Google Apps Script web app owned by the app owner
   (see auth-config.js); users are saved in the owner's Google Sheet. Internet is needed only to register,
   log in, and for a once-a-day check that the login is still active. The rest of the app stays offline.
   Phone app: the request goes through the Android shell. Desktop app: through the Electron main process.
   Plain browser: fetch(). */
(function () {
  'use strict';
  var USER = 'bf-user', URLKEY = 'bf-auth-url', SEEN = 'bf-auth-checked';

  function serverUrl() {
    var own = ''; try { own = localStorage.getItem(URLKEY) || ''; } catch (e) { }
    return own || window.BF_AUTH_URL || '';
  }
  function configured() { return /^https:\/\/script\.google(usercontent)?\.com\/.+/.test(serverUrl()); }
  function appName() {
    var v = window.BF_APP_VERSION || '';
    if (window.Android) return 'Android ' + v;
    if (window.bfNet) return (/Mac/.test(navigator.platform) ? 'Mac ' : /Win/.test(navigator.platform) ? 'Windows ' : 'Desktop ') + v;
    return 'Browser ' + v;
  }

  var waits = {}, seq = 0;
  window.__bfPostDone = function (id, ok, text) {        // called by the Android shell
    var w = waits[id]; if (!w) return; delete waits[id];
    ok ? w.ok(text) : w.no(new Error(text || 'request failed'));
  };
  function post(url, body) {
    if (window.Android && window.Android.post) {
      return new Promise(function (ok, no) { var id = 'P' + (++seq); waits[id] = { ok: ok, no: no }; window.Android.post(url, body, id); });
    }
    if (window.bfNet && window.bfNet.post) {
      return window.bfNet.post(url, body).then(function (r) { if (!r.ok) throw new Error(r.error || 'request failed'); return r.text; });
    }
    // text/plain keeps it a "simple" request, so the browser does not send a CORS preflight
    return fetch(url, { method: 'POST', body: body, redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' } })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); });
  }

  /** Calls one server action; resolves to the server's answer, rejects with a message a user can read */
  function call(action, data) {
    if (!configured()) return Promise.reject(new Error('The registration server is not set up in this copy of the app yet. Please contact the app owner.'));
    var body = JSON.stringify(Object.assign({ action: action, app: appName() }, data || {}));
    return post(serverUrl(), body).then(function (text) {
      var r; try { r = JSON.parse(text); } catch (e) {
        throw new Error(/<html/i.test(text) ? 'The server link did not answer as expected. Check that the script is deployed with access "Anyone".' : 'Unexpected answer from the server.');
      }
      if (!r.ok) throw new Error(r.error || 'Something went wrong. Please try again.');
      return r;
    }, function (e) {
      var m = (e && e.message) || String(e);
      if (/Failed to fetch|NetworkError|Load failed|no internet|ERR_INTERNET|ERR_NAME|UnknownHost|timed? ?out/i.test(m)) {
        m = 'No internet connection. Registration and login need internet once; after that BF Model works offline.';
      }
      throw new Error(m);
    });
  }

  function user() { try { var u = JSON.parse(localStorage.getItem(USER) || 'null'); return u && u.loginId ? u : null; } catch (e) { return null; } }
  function signIn(u) {
    // token: signed by the server, sent with suggestions (logins made before 2.8 have none, which the server accepts since 3.0)
    try { localStorage.setItem(USER, JSON.stringify({ loginId: u.loginId, name: u.name, email: u.email, company: u.company, mobile: u.mobile,
                                                       token: u.token || '', admin: !!u.admin, since: new Date().toISOString() })); } catch (e) { }
    try { localStorage.setItem(SEEN, String(Date.now())); } catch (e) { }
  }
  function signOut() {
    try { localStorage.removeItem(USER); localStorage.removeItem(SEEN); localStorage.removeItem('bf-quiz-cache'); } catch (e) { }
    try { if (window.Android && window.Android.quizAlerts) window.Android.quizAlerts(''); } catch (e) { }
  }

  /** Once a day, when online: if the owner blocked or removed this login, sign out. Network trouble never signs out. */
  function dailyCheck() {
    var u = user(); if (!u || !configured()) return;
    var last = 0; try { last = Number(localStorage.getItem(SEEN) || 0); } catch (e) { }
    if (Date.now() - last < 20 * 3600 * 1000) return;
    call('status', { loginId: u.loginId }).then(function (r) {
      try { localStorage.setItem(SEEN, String(Date.now())); } catch (e) { }
      if (r.status === 'blocked' || r.status === 'unknown') { signOut(); location.replace('auth.html'); }
    }, function () { });
  }

  window.BFAuth = { call: call, user: user, signIn: signIn, signOut: signOut, dailyCheck: dailyCheck,
                    serverUrl: serverUrl, configured: configured, URLKEY: URLKEY };
})();
