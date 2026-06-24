(function () {
  const THEME_KEY = "blog-theme";

  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = saved || (prefersDark ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(THEME_KEY, next);
  }

  function initNav() {
    const toggle = document.querySelector(".nav-toggle");
    const links = document.querySelector(".nav-links");
    if (!toggle || !links) return;

    toggle.addEventListener("click", () => {
      const open = links.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });

    links.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        links.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  function initForms() {
    const newsletter = document.getElementById("newsletter-form");
    if (newsletter) {
      newsletter.addEventListener("submit", (e) => {
        e.preventDefault();
        const msg = document.getElementById("newsletter-message");
        if (msg) {
          msg.hidden = false;
          newsletter.querySelector("input").value = "";
        }
      });
    }

    const contact = document.getElementById("contact-form");
    if (contact) {
      contact.addEventListener("submit", (e) => {
        e.preventDefault();
        const msg = document.getElementById("contact-message");
        if (msg) {
          msg.hidden = false;
          contact.reset();
        }
      });
    }
  }

  function initBlogFilter() {
    const filters = document.querySelectorAll(".filter-btn");
    const items = document.querySelectorAll(".blog-item[data-author]");
    if (!filters.length || !items.length) return;

    filters.forEach((btn) => {
      btn.addEventListener("click", () => {
        const filter = btn.dataset.filter;
        filters.forEach((b) => b.classList.toggle("active", b === btn));

        items.forEach((item) => {
          const author = item.dataset.author;
          const show = filter === "all" || author === filter;
          item.classList.toggle("hidden", !show);
        });
      });
    });
  }

  function initAnimations() {
    document.querySelectorAll(".post-card, .project-card").forEach((el) => {
      el.classList.add("fade-in");
    });
  }

  function initHomeDates() {
    const el = document.getElementById("home-dates-list");
    if (!el) return;

    const DATES_KEY = "couple-special-dates";
    const TYPE_EMOJI = { anniversary: "💕", birthday: "🎂", travel: "✈️", other: "⭐" };

    let dates;
    try {
      dates = JSON.parse(localStorage.getItem(DATES_KEY)) || [];
    } catch {
      dates = [];
    }

    function parseDate(str) {
      const [y, m, d] = str.split("-").map(Number);
      return { y, m, d };
    }

    function nextOccurrence(event) {
      const { m, d } = parseDate(event.date);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (event.yearly) {
        let occ = new Date(now.getFullYear(), m - 1, d);
        if (occ < today) occ = new Date(now.getFullYear() + 1, m - 1, d);
        return occ;
      }
      const occ = new Date(parseDate(event.date).y, m - 1, d);
      return occ >= today ? occ : null;
    }

    function daysUntil(date) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return Math.round((date - today) / 86400000);
    }

    const upcoming = dates
      .map((e) => ({ event: e, occ: nextOccurrence(e) }))
      .filter((x) => x.occ)
      .sort((a, b) => a.occ - b.occ)
      .slice(0, 3);

    if (!upcoming.length) {
      el.innerHTML =
        '<li class="home-dates-empty">还没有特殊日期，<a href="calendar.html">去日历添加</a>吧</li>';
      return;
    }

    el.innerHTML = upcoming
      .map(({ event, occ }) => {
        const days = daysUntil(occ);
        let countdown = days === 0 ? "就是今天！" : days === 1 ? "明天" : `${days} 天后`;
        const emoji = event.emoji || TYPE_EMOJI[event.type] || "⭐";
        return `
          <li class="home-date-card">
            <div class="emoji">${emoji}</div>
            <strong>${event.title}</strong>
            <span>${occ.getMonth() + 1} 月 ${occ.getDate()} 日</span>
            <span class="home-date-countdown">${countdown}</span>
          </li>`;
      })
      .join("");
  }

  initTheme();

  document.querySelector(".theme-toggle")?.addEventListener("click", toggleTheme);
  initNav();
  initForms();
  initBlogFilter();
  initAnimations();
  initHomeDates();

  window.addEventListener("couple-dates-updated", initHomeDates);
  window.addEventListener("couple-data-recovered", () => {
    initHomeDates();
    window.CouplePhotos?.refresh?.();
  });
  window.addEventListener("couple-photos-updated", () => {
    window.CouplePhotos?.refresh?.();
  });
})();
