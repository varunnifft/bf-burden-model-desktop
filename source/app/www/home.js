/* Home page: the 2-month free Pro banner, and the Pro labels on the module cards. */
(function () {
  'use strict';
  var box = document.getElementById('trial');
  if (!box || !window.BFTrial) return;
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function draw() {
    var t = BFTrial.state();
    if (!t.offered) { box.hidden = true; return; }
    box.hidden = false;
    if (!t.started) {
      box.innerHTML = '<div class="t"><b>2 months of Pro, free</b><span>Report and Other charging modes open for 2 months at no cost, for every user. No payment details, nothing renews.</span></div>' +
        '<button type="button" id="trialGo">Start 2 months free ›</button>';
      document.getElementById('trialGo').onclick = function () { BFTrial.start(); draw(); };
    } else if (t.active) {
      box.innerHTML = '<div class="days">' + t.daysLeft + '<small>DAYS LEFT</small></div><div class="t"><b>Pro is free until ' + esc(t.untilText) + '</b>' +
        '<span>Report and Other charging modes are open. After that date the ₹25 / 3-month subscription applies.</span></div>';
    } else {
      box.innerHTML = '<div class="t"><b>Your free Pro months ended on ' + esc(t.untilText) + '</b><span>Report and Other charging modes continue with the ₹25 / 3-month subscription.</span></div>';
    }
    var tags = document.querySelectorAll('[data-pro]');
    for (var i = 0; i < tags.length; i++) {
      if (!tags[i].getAttribute('data-orig')) tags[i].setAttribute('data-orig', tags[i].textContent);
      if (t.active) { tags[i].textContent = 'Pro · free until ' + t.untilText; tags[i].classList.add('free'); }
      else { tags[i].textContent = tags[i].getAttribute('data-orig'); tags[i].classList.remove('free'); }
    }
  }
  document.addEventListener('bftrial', draw);
  draw();
})();
