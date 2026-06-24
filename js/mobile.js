(function () {
  const INSTALL_DISMISS_KEY = "couple-pwa-dismissed";
  const VIEW_MODE_KEY = "couple-view-mode";

  function getBasePath() {
    if (window.location.pathname.includes("/posts/")) return "../";
    return "./";
  }

  function isTouchDevice() {
    return "ontouchstart" in window || navigator.maxTouchPoints > 0;
  }

  function isNarrowScreen() {
    return window.matchMedia("(max-width: 768px)").matches;
  }

  function getViewPreference() {
    return localStorage.getItem(VIEW_MODE_KEY) || "auto";
  }

  function shouldUseMobileView() {
    const pref = getViewPreference();
    if (pref === "mobile") return true;
    if (pref === "desktop") return false;
    return isNarrowScreen() || (isTouchDevice() && window.innerWidth <= 1024);
  }

  function isStandalone() {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true
    );
  }

  function currentPage() {
    return window.location.pathname.split("/").pop() || "index.html";
  }

  function injectMeta() {
    const base = getBasePath();
    const head = document.head;

    const vp = document.querySelector('meta[name="viewport"]');
    if (vp) {
      vp.content =
        "width=device-width, initial-scale=1.0, maximum-scale=5.0, viewport-fit=cover";
    }

    if (!document.querySelector('meta[name="theme-color"]')) {
      const theme = document.createElement("meta");
      theme.name = "theme-color";
      theme.content = "#be4a6a";
      head.appendChild(theme);
    }

    if (!document.querySelector('meta[name="apple-mobile-web-app-capable"]')) {
      [
        ["apple-mobile-web-app-capable", "yes"],
        ["apple-mobile-web-app-status-bar-style", "default"],
        ["apple-mobile-web-app-title", "我们俩"],
        ["mobile-web-app-capable", "yes"],
        ["format-detection", "telephone=no"],
      ].forEach(([name, content]) => {
        const meta = document.createElement("meta");
        meta.name = name;
        meta.content = content;
        head.appendChild(meta);
      });
    }

    if (!document.querySelector('link[rel="manifest"]')) {
      const link = document.createElement("link");
      link.rel = "manifest";
      link.href = base + "manifest.json";
      head.appendChild(link);
    }

    if (!document.querySelector('link[rel="apple-touch-icon"]')) {
      const icon = document.createElement("link");
      icon.rel = "apple-touch-icon";
      icon.href = base + "icons/icon.svg";
      head.appendChild(icon);
    }
  }

  function applyViewMode() {
    const mobile = shouldUseMobileView();
    document.documentElement.classList.toggle("mobile-view-root", mobile);
    document.body.classList.toggle("mobile-view", mobile);
    document.body.classList.toggle("desktop-view", !mobile);

    document.querySelector(".mobile-mode-badge")?.remove();

    if (mobile) {
      ensureTabBar();
      document.body.classList.add("has-tabbar");
      initMobileBadge();
    } else {
      document.body.classList.remove("has-tabbar");
      document.querySelector(".mobile-tabbar")?.remove();
      closeMoreSheet();
    }

    updateViewToggleButton();
  }

  function ensureTabBar() {
    if (document.querySelector(".mobile-tabbar")) return;

    const base = getBasePath();
    const page = currentPage();

    const tabs = [
      { href: base + "index.html", icon: "🏠", label: "首页", match: ["index.html", ""] },
      { href: base + "menu.html", icon: "🍳", label: "点菜", match: ["menu.html"] },
      { href: base + "photos.html", icon: "📷", label: "相册", match: ["photos.html"] },
      { href: base + "calendar.html", icon: "📅", label: "日历", match: ["calendar.html"] },
      { action: "more", icon: "☰", label: "更多", match: [] },
    ];

    const nav = document.createElement("nav");
    nav.className = "mobile-tabbar";
    nav.setAttribute("aria-label", "底部导航");
    nav.innerHTML = tabs
      .map((tab) => {
        if (tab.action === "more") {
          return `<button type="button" class="tabbar-item tabbar-more" id="tabbar-more"><span class="tabbar-icon">${tab.icon}</span><span class="tabbar-label">${tab.label}</span></button>`;
        }
        const active = tab.match.includes(page) ? " active" : "";
        return `<a href="${tab.href}" class="tabbar-item${active}"><span class="tabbar-icon">${tab.icon}</span><span class="tabbar-label">${tab.label}</span></a>`;
      })
      .join("");

    document.body.appendChild(nav);
    document.getElementById("tabbar-more")?.addEventListener("click", toggleMoreSheet);
  }

  function ensureMoreSheet() {
    if (document.getElementById("mobile-more-sheet")) return;

    const base = getBasePath();
    const sheet = document.createElement("div");
    sheet.id = "mobile-more-sheet";
    sheet.className = "mobile-more-sheet";
    sheet.hidden = true;
    sheet.innerHTML = `
      <div class="mobile-more-backdrop" id="mobile-more-backdrop"></div>
      <div class="mobile-more-panel" role="dialog" aria-label="更多功能">
        <div class="mobile-more-handle"></div>
        <h3>更多</h3>
        <nav class="mobile-more-links">
          <a href="${base}blog.html">📝 博客</a>
          <a href="${base}projects.html">🎨 作品</a>
          <a href="${base}about.html">💕 关于我们</a>
          <a href="${base}contact.html">✉️ 联系</a>
          <a href="${base}settings.html">🛡️ 数据备份</a>
        </nav>
        <div class="mobile-more-actions">
          <button type="button" class="btn btn-secondary btn-block" id="btn-view-desktop">切换到电脑模式</button>
          <button type="button" class="btn btn-secondary btn-block" id="btn-view-auto">恢复自动识别</button>
        </div>
      </div>`;

    document.body.appendChild(sheet);

    document.getElementById("mobile-more-backdrop")?.addEventListener("click", closeMoreSheet);
    document.getElementById("btn-view-desktop")?.addEventListener("click", () => {
      localStorage.setItem(VIEW_MODE_KEY, "desktop");
      closeMoreSheet();
      applyViewMode();
    });
    document.getElementById("btn-view-auto")?.addEventListener("click", () => {
      localStorage.setItem(VIEW_MODE_KEY, "auto");
      closeMoreSheet();
      applyViewMode();
    });
  }

  function toggleMoreSheet() {
    ensureMoreSheet();
    const sheet = document.getElementById("mobile-more-sheet");
    if (!sheet) return;
    const open = sheet.hidden;
    sheet.hidden = !open;
    document.body.classList.toggle("more-sheet-open", open);
  }

  function closeMoreSheet() {
    const sheet = document.getElementById("mobile-more-sheet");
    if (sheet) sheet.hidden = true;
    document.body.classList.remove("more-sheet-open");
  }

  function initViewToggle() {
    const nav = document.querySelector(".nav");
    if (!nav || document.getElementById("view-mode-toggle")) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = "view-mode-toggle";
    btn.className = "view-mode-toggle";
    btn.setAttribute("aria-label", "切换观看模式");
    nav.insertBefore(btn, nav.querySelector(".theme-toggle"));

    btn.addEventListener("click", () => {
      const pref = getViewPreference();
      const mobile = shouldUseMobileView();
      if (pref === "auto" && mobile) {
        localStorage.setItem(VIEW_MODE_KEY, "desktop");
      } else if (pref === "desktop") {
        localStorage.setItem(VIEW_MODE_KEY, "mobile");
      } else {
        localStorage.setItem(VIEW_MODE_KEY, "auto");
      }
      applyViewMode();
    });

    updateViewToggleButton();
  }

  function updateViewToggleButton() {
    const btn = document.getElementById("view-mode-toggle");
    if (!btn) return;

    const pref = getViewPreference();
    const mobile = document.body.classList.contains("mobile-view");

    if (mobile) {
      btn.title = "当前：手机模式（点击切换）";
      btn.innerHTML = "📱";
      btn.classList.add("active");
    } else {
      btn.title = pref === "desktop" ? "当前：电脑模式" : "当前：电脑模式";
      btn.innerHTML = "🖥️";
      btn.classList.remove("active");
    }
  }

  function initMobileBadge() {
    if (!document.body.classList.contains("mobile-view")) return;
    if (document.querySelector(".mobile-mode-badge")) return;

    const badge = document.createElement("div");
    badge.className = "mobile-mode-badge";
    badge.textContent = "手机模式";
    document.body.appendChild(badge);
  }

  function initInstallBanner() {
    if (!document.body.classList.contains("mobile-view") || isStandalone()) return;
    if (localStorage.getItem(INSTALL_DISMISS_KEY)) return;
    if (document.querySelector(".install-banner")) return;

    const banner = document.createElement("div");
    banner.className = "install-banner";
    banner.innerHTML = `
      <div class="install-banner-text">
        <strong>添加到主屏幕</strong>
        <span class="install-hint-chrome" hidden>像 App 一样打开，用着更方便</span>
        <span class="install-hint-ios">Safari：点分享 →「添加到主屏幕」</span>
      </div>
      <div class="install-banner-actions">
        <button type="button" class="btn btn-primary btn-sm" id="btn-pwa-install" hidden>安装</button>
        <button type="button" class="install-dismiss" id="btn-pwa-dismiss" aria-label="关闭">×</button>
      </div>`;

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const chromeHint = banner.querySelector(".install-hint-chrome");
    const iosHint = banner.querySelector(".install-hint-ios");
    if (isIOS) {
      if (chromeHint) chromeHint.hidden = true;
    } else {
      if (iosHint) iosHint.hidden = true;
      if (chromeHint) chromeHint.hidden = false;
    }

    document.body.appendChild(banner);

    let deferredPrompt = null;
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredPrompt = e;
      const installBtn = document.getElementById("btn-pwa-install");
      if (installBtn) installBtn.hidden = false;
    });

    document.getElementById("btn-pwa-install")?.addEventListener("click", async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      banner.remove();
    });

    document.getElementById("btn-pwa-dismiss")?.addEventListener("click", () => {
      localStorage.setItem(INSTALL_DISMISS_KEY, "1");
      banner.remove();
    });
  }

  function initServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    window.addEventListener("load", () => {
      navigator.serviceWorker.register(getBasePath() + "sw.js").catch(() => {});
    });
  }

  function initTouchFriendly() {
    document.querySelectorAll("input, select, textarea").forEach((el) => {
      if (!el.style.fontSize) el.style.fontSize = "16px";
    });
  }

  function init() {
    injectMeta();
    applyViewMode();
    initViewToggle();
    initInstallBanner();
    initServiceWorker();
    initTouchFriendly();

    window.addEventListener("resize", () => {
      if (getViewPreference() === "auto") applyViewMode();
    });

    window.addEventListener("orientationchange", () => {
      setTimeout(applyViewMode, 200);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.CoupleMobile = { applyViewMode, getViewPreference };
})();
