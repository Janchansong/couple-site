(function () {
  var cfg = window.CoupleAuthConfig;
  if (!cfg || cfg.enabled === false) return;

  var pwd = localStorage.getItem("couple-login-password") || cfg.password || "";
  if (!pwd) return;

  var expected = btoa(unescape(encodeURIComponent(pwd + ":couple-site-v1")));
  var session = sessionStorage.getItem("couple-auth-token");
  var remember = localStorage.getItem("couple-auth-remember");

  if (session !== expected && remember !== expected) {
    document.documentElement.classList.add("auth-locked");
  }
})();
