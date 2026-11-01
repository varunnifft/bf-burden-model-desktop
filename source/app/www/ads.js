/* Google AdMob banner on the Fact must know page (BF Model 3.1). Only the phone app shows it: the Android shell draws
   a native banner at the bottom of the screen (Android.adShow / adHide) while this page is open. The Windows and Mac
   apps show no ads. The unit ID is in pay-config.js (BF_ADS). */
(function () {
  'use strict';
  var A = window.BF_ADS || {}, droid = window.Android;
  if (A.on === false || !droid || !droid.adShow || !A.banner) return;
  var on = false;
  function show() { if (on) return; on = true; try { droid.adShow(A.banner); } catch (e) { } document.body.style.paddingBottom = '70px'; }
  function hide() { if (!on) return; on = false; try { droid.adHide(); } catch (e) { } }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show); else show();
  window.addEventListener('pagehide', hide);
  window.addEventListener('pageshow', show);
  document.addEventListener('visibilitychange', function () { if (document.hidden) hide(); else show(); });
})();
