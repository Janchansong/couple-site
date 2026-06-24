(function () {
  var cfg = window.CoupleAuthConfig;
  if (!cfg || !cfg.enabled) return;
  var token = sessionStorage.getItem("couple-auth-token");
  var remember = localStorage.getItem("couple-auth-remember");
  if (!token && !remember) {
    document.documentElement.classList.add("auth-locked");
  }
})();
