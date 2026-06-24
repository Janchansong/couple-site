(function () {
  const TOKEN_KEY = "couple-auth-token";
  const REMEMBER_KEY = "couple-auth-remember";
  const PASSWORD_OVERRIDE_KEY = "couple-login-password";

  function getConfig() {
    return window.CoupleAuthConfig || { enabled: false };
  }

  function getPassword() {
    const override = localStorage.getItem(PASSWORD_OVERRIDE_KEY);
    if (override) return override;
    const syncCfg = window.CoupleSyncConfig;
    if (syncCfg?.loginPassword) return syncCfg.loginPassword;
    return getConfig().password || "";
  }

  function isAuthEnabled() {
    return getConfig().enabled !== false && getPassword().length > 0;
  }

  function makeToken(password) {
    return btoa(unescape(encodeURIComponent(password + ":couple-site-v1")));
  }

  function isLoggedIn() {
    if (!isAuthEnabled()) return true;
    const expected = makeToken(getPassword());
    const session = sessionStorage.getItem(TOKEN_KEY);
    const remember = localStorage.getItem(REMEMBER_KEY);
    return session === expected || remember === expected;
  }

  function login(password, remember) {
    if (password === getPassword()) {
      const token = makeToken(password);
      sessionStorage.setItem(TOKEN_KEY, token);
      if (remember) {
        localStorage.setItem(REMEMBER_KEY, token);
      } else {
        localStorage.removeItem(REMEMBER_KEY);
      }
      return true;
    }
    return false;
  }

  function logout() {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REMEMBER_KEY);
    window.location.reload();
  }

  function unlockPage() {
    document.documentElement.classList.remove("auth-locked");
    const gate = document.getElementById("auth-gate");
    if (gate) gate.hidden = true;
  }

  function showLoginGate() {
    document.documentElement.classList.add("auth-locked");
    const gate = document.getElementById("auth-gate");
    if (!gate) return;
    gate.hidden = false;

    const form = document.getElementById("auth-form");
    const input = document.getElementById("auth-password");
    const error = document.getElementById("auth-error");
    const rememberEl = document.getElementById("auth-remember");

    if (form && !form.dataset.bound) {
      form.dataset.bound = "1";
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const pwd = input?.value || "";
        if (login(pwd, rememberEl?.checked)) {
          if (error) error.hidden = true;
          unlockPage();
        } else if (error) {
          error.hidden = false;
          input?.focus();
          input?.select();
        }
      });
    }

    input?.focus();
  }

  function init() {
    if (!isAuthEnabled()) {
      unlockPage();
      return;
    }
    if (isLoggedIn()) {
      unlockPage();
      return;
    }
    showLoginGate();
  }

  function setPassword(newPassword) {
    if (!newPassword || newPassword.length < 2) return false;
    localStorage.setItem(PASSWORD_OVERRIDE_KEY, newPassword);
    const token = makeToken(newPassword);
    sessionStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(REMEMBER_KEY, token);
    return true;
  }

  window.CoupleAuth = {
    isAuthEnabled,
    isLoggedIn,
    login,
    logout,
    setPassword,
    getPasswordHint: () => (getPassword() ? "已设置" : "未设置"),
  };

  init();
})();
