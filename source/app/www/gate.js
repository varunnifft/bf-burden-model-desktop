/* First thing on every page: no saved login on this device -> the sign-up / login page. */
(function () {
  var u = null;
  try { u = JSON.parse(localStorage.getItem('bf-user') || 'null'); } catch (e) { }
  if (!u || !u.loginId) location.replace('auth.html');
})();
