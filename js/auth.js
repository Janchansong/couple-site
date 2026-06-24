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
    if (gate) gate.remove();
  }

  function showLoginGate() {
    if (document.getElementById("auth-gate")) return;

    const gate = document.createElement("div");
    gate.id = "auth-gate";
    gate.className = "auth-gate";
    gate.innerHTML = `
      <div class="auth-card">
        <p class="auth-emoji">💕</p>
        <h1 class="auth-title">我们俩</h1>
        <p class="auth-subtitle">请输入家庭密码进入</p>
        <form class="auth-form" id="auth-form">
          <input type="password" id="auth-password" class="auth-input" placeholder="家庭密码" autocomplete="current-password" required>
          <label class="auth-remember">
            <input type="checkbox" id="auth-remember" checked>
            记住我（30 天内免登录）
          </label>
          <p class="auth-error" id="auth-error" hidden>密码不对，再试一次</p>
          <button type="submit" class="btn btn-primary auth-submit">进入小站</button>
        </form>
      </div>
    `;

    document.body.appendChild(gate);

    const form = document.getElementById("auth-form");
    const input = document.getElementById("auth-password");
    const error = document.getElementById("auth-error");
    const rememberEl = document.getElementById("auth-remember");

    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      const pwd = input?.value || "";
      if (login(pwd, rememberEl?.checked)) {
        unlockPage();
      } else if (error) {
        error.hidden = false;
        input?.focus();
        input?.select();
      }
    });

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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
