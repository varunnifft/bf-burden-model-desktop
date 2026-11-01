/* Sign-up, OTP, create login, log in and forgot password screens (auth.html). */
(function () {
  'use strict';
  var REG = 'bf-reg';                          // progress through sign-up, kept if the app is closed half way
  var msg = document.getElementById('msg');
  var panes = {};
  Array.prototype.forEach.call(document.querySelectorAll('[data-pane]'), function (p) { panes[p.getAttribute('data-pane')] = p; });

  function reg() { try { return JSON.parse(localStorage.getItem(REG) || '{}'); } catch (e) { return {}; } }
  function saveReg(r) { try { localStorage.setItem(REG, JSON.stringify(r)); } catch (e) { } }
  function clearReg() { try { localStorage.removeItem(REG); } catch (e) { } }

  function say(text, ok) { msg.textContent = text || ''; msg.className = 'msg' + (text ? ' on ' + (ok ? 'ok' : 'err') : ''); }
  function show(name) {
    say('');
    Object.keys(panes).forEach(function (k) { panes[k].hidden = k !== name; });
    var r = reg(); r.pane = name; saveReg(r);
    var first = panes[name].querySelector('input'); if (first && window.innerWidth > 700) first.focus();
    window.scrollTo(0, 0);
  }
  function field(form, name) { return form.elements[name].value.trim(); }

  /** Runs a server call with the form's button showing progress */
  function busy(form, label, job) {
    var b = form.querySelector('.btn'), old = b.textContent;
    b.disabled = true; b.textContent = label; say('');
    return job().then(function (r) { b.disabled = false; b.textContent = old; return r; },
      function (e) { b.disabled = false; b.textContent = old; say(e.message); throw e; });
  }
  function enter(user) {
    BFAuth.signIn(user); clearReg();
    location.replace('index.html');
  }
  function samePasswords(form) {
    if (form.elements.password.value !== form.elements.password2.value) { say('The two passwords are not the same.'); return false; }
    var p = form.elements.password.value;
    if (p.length < 8 || !/[A-Za-z]/.test(p) || !/\d/.test(p)) { say('Password: at least 8 characters, with letters and digits.'); return false; }
    return true;
  }

  document.addEventListener('click', function (e) {
    var go = e.target.closest('[data-go]');
    if (go) { show(go.getAttribute('data-go')); return; }
    var eye = e.target.closest('[data-show]');
    if (eye) { var i = eye.parentNode.querySelector('input'); i.type = i.type === 'password' ? 'text' : 'password'; eye.textContent = i.type === 'password' ? 'Show' : 'Hide'; }
  });

  // 1. details -> OTP
  panes.signup.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target, d = { name: field(f, 'name'), mobile: field(f, 'mobile'), email: field(f, 'email'), company: field(f, 'company') };
    if (d.name.length < 2) return say('Please enter your full name.');
    if (!/^\+?\d{10,15}$/.test(d.mobile.replace(/[\s()-]/g, ''))) return say('Please enter a valid mobile number (10 to 15 digits).');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) return say('Please enter a valid email address.');
    if (d.company.length < 2) return say('Please enter your company name.');
    busy(f, 'Sending OTP…', function () { return BFAuth.call('signup', d); }).then(function (r) {
      saveReg({ email: r.email, purpose: 'signup', details: d, sentAt: Date.now() });
      openOtp(); say('OTP sent to ' + r.email + '.', true);
    }, function () { });
  });

  // 2. OTP
  var timer;
  function openOtp() {
    var r = reg();
    document.getElementById('otpEmail').textContent = r.email || '';
    document.getElementById('otpSteps').hidden = r.purpose === 'reset';
    panes.otp.elements.otp.value = '';
    show('otp'); cooldown();
  }
  function cooldown() {
    var b = document.getElementById('resend');
    function tick() {
      var left = Math.ceil(((reg().sentAt || 0) + 60000 - Date.now()) / 1000);
      b.disabled = left > 0; b.textContent = left > 0 ? 'Resend OTP in ' + left + ' s' : 'Resend OTP';
      if (left <= 0) clearInterval(timer);
    }
    clearInterval(timer); timer = setInterval(tick, 1000); tick();
  }
  panes.otp.elements.otp.addEventListener('input', function (e) {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
  });
  panes.otp.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target, otp = field(f, 'otp'), r = reg();
    if (!/^\d{6}$/.test(otp)) return say('Please enter the 6-digit OTP from the email.');
    busy(f, 'Checking…', function () { return BFAuth.call('verify', { email: r.email, otp: otp, purpose: r.purpose }); }).then(function (v) {
      r.token = v.token; r.tokenAt = Date.now(); r.loginId = v.loginId; saveReg(r);
      if (r.purpose === 'reset') { document.getElementById('resetId').textContent = v.loginId; show('newpw'); }
      else show('create');
      say('Email verified.', true);
    }, function () { });
  });
  document.getElementById('resend').addEventListener('click', function () {
    var r = reg(), b = this;
    b.disabled = true; say('');
    var job = r.purpose === 'reset' ? BFAuth.call('forgot', { email: r.email }) : BFAuth.call('signup', r.details || {});
    job.then(function () { r.sentAt = Date.now(); saveReg(r); cooldown(); say('A new OTP was sent to ' + r.email + '.', true); },
             function (e) { b.disabled = false; say(e.message); });
  });
  document.getElementById('changeEmail').addEventListener('click', function () {
    var r = reg(), back = r.purpose === 'reset' ? 'forgot' : 'signup';
    show(back);
    if (back === 'signup' && r.details) ['name', 'mobile', 'email', 'company'].forEach(function (k) { panes.signup.elements[k].value = r.details[k] || ''; });
    var em = panes[back].elements.email; em.focus(); em.select();
  });

  // 3. create login
  panes.create.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target, id = field(f, 'loginId'), r = reg();
    if (!/^[A-Za-z0-9._-]{4,30}$/.test(id)) return say('Login ID: 4 to 30 letters, digits, dot, dash or underscore, no spaces.');
    if (!samePasswords(f)) return;
    busy(f, 'Creating login…', function () { return BFAuth.call('create', { email: r.email, token: r.token, loginId: id, password: f.elements.password.value }); })
      .then(function (v) { enter(v.user); }, function () { });
  });

  // log in
  panes.login.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target, id = field(f, 'loginId'), pw = f.elements.password.value;
    if (!id || !pw) return say('Please enter your login ID and password.');
    busy(f, 'Logging in…', function () { return BFAuth.call('login', { loginId: id, password: pw }); })
      .then(function (v) { enter(v.user); }, function () { });
  });

  // forgot password -> OTP -> new password
  panes.forgot.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target, em = field(f, 'email').toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) return say('Please enter a valid email address.');
    busy(f, 'Sending OTP…', function () { return BFAuth.call('forgot', { email: em }); }).then(function (r) {
      saveReg({ email: r.email, purpose: 'reset', sentAt: Date.now() });
      openOtp(); say('If ' + r.email + ' is registered, an OTP is on its way.', true);
    }, function () { });
  });
  panes.newpw.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target, r = reg();
    if (!samePasswords(f)) return;
    busy(f, 'Saving…', function () { return BFAuth.call('reset', { email: r.email, token: r.token, password: f.elements.password.value }); })
      .then(function (v) { enter(v.user); }, function () { });
  });

  // server link (app owner)
  panes.server.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target, url = field(f, 'url');
    if (url && !/^https:\/\/script\.google(usercontent)?\.com\/.+/.test(url)) return say('The link must start with https://script.google.com/');
    try { url ? localStorage.setItem(BFAuth.URLKEY, url) : localStorage.removeItem(BFAuth.URLKEY); } catch (x) { }
    busy(f, 'Testing…', function () { return BFAuth.call('ping'); }).then(function () { say('The server answered. Registration is ready.', true); }, function () { });
  });
  panes.server.elements.url.value = (function () { try { return localStorage.getItem(BFAuth.URLKEY) || ''; } catch (e) { return ''; } })();

  // where to start: resume a half-finished sign-up (OTP is valid 10 min, the verified step 30 min)
  var r = reg(), now = Date.now(), resumable = ['otp', 'create', 'newpw'].indexOf(r.pane) >= 0;
  if (resumable && r.token && r.tokenAt && now - r.tokenAt < 29 * 60000) {
    if (r.purpose === 'reset') { document.getElementById('resetId').textContent = r.loginId || ''; show('newpw'); } else show('create');
  } else if (resumable && r.email && r.sentAt && now - r.sentAt < 10 * 60000) openOtp();
  else { clearReg(); show('welcome'); }
})();
