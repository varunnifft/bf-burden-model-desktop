/* Premium shell for the BF apps: theme class, "Know your input / output" link in the page strip, and the
   developer's signature at the foot of every page. Changes no input, result or calculation. */
(function () {
  'use strict';
  var de = document.documentElement;
  de.classList.add('pm');
  var CFG = window.PM_CFG || {};
  var SIGN_TEXT = CFG.signText || 'Designed and developed by Niteen Kumar';

  function addKnow() {
    if (/know\.html$/.test(location.pathname)) return;
    var navs = document.querySelectorAll('.bfnav, .jump');
    for (var i = 0; i < navs.length; i++) {
      var n = navs[i];
      if (!n.querySelector('a') || n.querySelector('.pm-know')) continue;
      var a = document.createElement('a');
      a.href = 'know.html'; a.className = 'pm-know'; a.textContent = 'Know your input / output';
      n.appendChild(a);
    }
  }
  function addSign() {
    if (document.querySelector('.pm-sign') || document.body.hasAttribute('data-no-sign')) return;
    var f = document.createElement('footer');
    f.className = 'pm-sign';
    f.innerHTML = '<img class="l" src="sign-dark.png" alt="Niteen Kumar (signature)" width="168" height="26">' +
      '<img class="d" src="sign-light.png" alt="" width="168" height="26">' +
      '<span><b>' + SIGN_TEXT + '</b>' + (CFG.app ? ' · ' + CFG.app : '') + '</span>';
    var host = document.querySelector('[data-sign-host]') || document.body;
    host.appendChild(f);
  }
  function run() { addKnow(); addSign(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
  window.addEventListener('load', addKnow);
  // page strips that scripts build after load
  if (window.MutationObserver) {
    var mo = new MutationObserver(addKnow);
    var start = function () { mo.observe(document.body, { childList: true, subtree: true }); setTimeout(function () { mo.disconnect(); }, 4000); };
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
  }
})();
