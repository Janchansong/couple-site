(function () {
  const DATES_KEY = "couple-special-dates";

  const TYPE_LABELS = {
    anniversary: "纪念日",
    birthday: "生日",
    travel: "旅行",
    other: "其他",
  };

  const TYPE_EMOJI = {
    anniversary: "💕",
    birthday: "🎂",
    travel: "✈️",
    other: "⭐",
  };

  let viewYear;
  let viewMonth;
  let editingId = null;
  let selectedDate = null;

  function loadDates() {
    try {
      return JSON.parse(localStorage.getItem(DATES_KEY)) || [];
    } catch {
      return [];
    }
  }

  function saveDates(dates) {
    localStorage.setItem(DATES_KEY, JSON.stringify(dates));
    window.dispatchEvent(new CustomEvent("couple-dates-updated"));
    window.CoupleBackup?.scheduleAutoBackup();
  }

  function showToast(msg) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = msg;
    toast.hidden = false;
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      toast.hidden = true;
    }, 2600);
  }

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function toDateStr(y, m, d) {
    return `${y}-${pad(m)}-${pad(d)}`;
  }

  function parseDate(str) {
    const [y, m, d] = str.split("-").map(Number);
    return { y, m, d };
  }

  function eventMatchesDay(event, y, m, d) {
    const { y: ey, m: em, d: ed } = parseDate(event.date);
    if (event.yearly) return em === m && ed === d;
    return ey === y && em === m && ed === d;
  }

  function getEventsOnDay(y, m, d) {
    return loadDates().filter((e) => eventMatchesDay(e, y, m, d));
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

  function formatDisplayDate(str, yearly) {
    const { y, m, d } = parseDate(str);
    const base = `${m} 月 ${d} 日`;
    return yearly ? `每年 ${base}` : `${y} 年 ${base}`;
  }

  function renderCalendar() {
    const titleEl = document.getElementById("cal-month-title");
    const daysEl = document.getElementById("cal-days");
    if (!titleEl || !daysEl) return;

    titleEl.textContent = `${viewYear} 年 ${viewMonth} 月`;

    const first = new Date(viewYear, viewMonth - 1, 1);
    const lastDay = new Date(viewYear, viewMonth, 0).getDate();
    let startWeekday = first.getDay();
    startWeekday = startWeekday === 0 ? 6 : startWeekday - 1;

    const today = new Date();
    const isCurrentMonth =
      today.getFullYear() === viewYear && today.getMonth() + 1 === viewMonth;

    let html = "";

    for (let i = 0; i < startWeekday; i++) {
      html += '<div class="cal-day cal-day-empty"></div>';
    }

    for (let d = 1; d <= lastDay; d++) {
      const events = getEventsOnDay(viewYear, viewMonth, d);
      const isToday = isCurrentMonth && today.getDate() === d;
      const dateStr = toDateStr(viewYear, viewMonth, d);
      const dots = events
        .slice(0, 3)
        .map((e) => `<i class="dot dot-${e.type}"></i>`)
        .join("");

      html += `
        <button type="button"
          class="cal-day${isToday ? " cal-day-today" : ""}${events.length ? " cal-day-has-event" : ""}"
          data-date="${dateStr}"
          aria-label="${viewMonth}月${d}日${events.length ? `，${events.length}个特殊日期` : ""}">
          <span class="cal-day-num">${d}</span>
          ${events.length ? `<span class="cal-day-dots">${dots}</span>` : ""}
        </button>`;
    }

    daysEl.innerHTML = html;
    daysEl.querySelectorAll(".cal-day[data-date]").forEach((btn) => {
      btn.addEventListener("click", () => openDayDialog(btn.dataset.date));
    });
  }

  function renderUpcoming() {
    const el = document.getElementById("upcoming-list");
    if (!el) return;

    const dates = loadDates();
    const upcoming = dates
      .map((e) => ({ event: e, occ: nextOccurrence(e) }))
      .filter((x) => x.occ)
      .sort((a, b) => a.occ - b.occ)
      .slice(0, 6);

    if (!upcoming.length) {
      el.innerHTML = '<li class="upcoming-empty">还没有特殊日期</li>';
      return;
    }

    el.innerHTML = upcoming
      .map(({ event, occ }) => {
        const days = daysUntil(occ);
        let countdown;
        if (days === 0) countdown = "就是今天！";
        else if (days === 1) countdown = "明天";
        else countdown = `${days} 天后`;

        const emoji = event.emoji || TYPE_EMOJI[event.type] || "⭐";
        return `
          <li class="upcoming-item type-${event.type}">
            <span class="upcoming-emoji">${emoji}</span>
            <div class="upcoming-info">
              <strong>${event.title}</strong>
              <span>${formatDisplayDate(event.date, event.yearly)} · ${countdown}</span>
            </div>
          </li>`;
      })
      .join("");
  }

  function renderAllDates() {
    const el = document.getElementById("all-dates-list");
    if (!el) return;

    const dates = loadDates().sort((a, b) => {
      const pa = parseDate(a.date);
      const pb = parseDate(b.date);
      if (pa.m !== pb.m) return pa.m - pb.m;
      return pa.d - pb.d;
    });

    if (!dates.length) {
      el.innerHTML =
        '<li class="all-dates-empty">点击日历上的日期，或上方表单添加第一个特殊日期吧</li>';
      return;
    }

    el.innerHTML = dates
      .map((event) => {
        const emoji = event.emoji || TYPE_EMOJI[event.type] || "⭐";
        return `
          <li class="all-dates-item type-${event.type}">
            <span class="all-dates-emoji">${emoji}</span>
            <div class="all-dates-info">
              <strong>${event.title}</strong>
              <span class="all-dates-meta">
                ${TYPE_LABELS[event.type]} · ${formatDisplayDate(event.date, event.yearly)}
              </span>
              ${event.note ? `<p class="all-dates-note">${event.note}</p>` : ""}
            </div>
            <div class="all-dates-actions">
              <button type="button" class="btn-text" data-edit="${event.id}">编辑</button>
              <button type="button" class="btn-text btn-text-danger" data-delete="${event.id}">删除</button>
            </div>
          </li>`;
      })
      .join("");

    el.querySelectorAll("[data-edit]").forEach((btn) => {
      btn.addEventListener("click", () => startEdit(btn.dataset.edit));
    });
    el.querySelectorAll("[data-delete]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (confirm("确定删除这个特殊日期吗？")) deleteDate(btn.dataset.delete);
      });
    });
  }

  function openDayDialog(dateStr) {
    selectedDate = dateStr;
    const dialog = document.getElementById("day-dialog");
    const titleEl = document.getElementById("dialog-date-title");
    const eventsEl = document.getElementById("dialog-events");
    if (!dialog || !titleEl || !eventsEl) return;

    const { y, m, d } = parseDate(dateStr);
    titleEl.textContent = `${y} 年 ${m} 月 ${d} 日`;

    const events = getEventsOnDay(y, m, d);
    if (!events.length) {
      eventsEl.innerHTML = '<li class="dialog-empty">这一天还没有记录</li>';
    } else {
      eventsEl.innerHTML = events
        .map((e) => {
          const emoji = e.emoji || TYPE_EMOJI[e.type] || "⭐";
          return `
            <li class="dialog-event type-${e.type}">
              <span>${emoji}</span>
              <div>
                <strong>${e.title}</strong>
                <span>${TYPE_LABELS[e.type]}${e.yearly ? " · 每年重复" : ""}</span>
                ${e.note ? `<p>${e.note}</p>` : ""}
              </div>
            </li>`;
        })
        .join("");
    }

    dialog.showModal();
  }

  function fillForm(dateStr) {
    const dateInput = document.getElementById("date-value");
    if (dateInput && dateStr) dateInput.value = dateStr;
  }

  function resetForm() {
    editingId = null;
    const form = document.getElementById("date-form");
    form?.reset();
    const yearly = document.getElementById("date-yearly");
    if (yearly) yearly.checked = true;
    const submit = document.getElementById("date-submit");
    const cancel = document.getElementById("date-cancel-edit");
    if (submit) submit.textContent = "保存";
    if (cancel) cancel.classList.add("hidden");
  }

  function startEdit(id) {
    const event = loadDates().find((e) => e.id === id);
    if (!event) return;

    editingId = id;
    document.getElementById("date-title").value = event.title;
    document.getElementById("date-value").value = event.date;
    document.getElementById("date-type").value = event.type;
    document.getElementById("date-emoji").value = event.emoji || "";
    document.getElementById("date-note").value = event.note || "";
    document.getElementById("date-yearly").checked = event.yearly;

    const submit = document.getElementById("date-submit");
    const cancel = document.getElementById("date-cancel-edit");
    if (submit) submit.textContent = "更新";
    if (cancel) cancel.classList.remove("hidden");

    document.getElementById("date-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
    showToast("正在编辑，改完点「更新」");
  }

  function saveDate(data) {
    const dates = loadDates();
    const duplicate = dates.find(
      (e) =>
        e.id !== editingId &&
        e.title === data.title &&
        e.date === data.date &&
        e.yearly === data.yearly
    );
    if (duplicate) {
      showToast("相同的日期已经存在了");
      return false;
    }

    if (editingId) {
      const idx = dates.findIndex((e) => e.id === editingId);
      if (idx >= 0) dates[idx] = { ...dates[idx], ...data };
      showToast("已更新");
    } else {
      dates.push({
        id: Date.now().toString(36),
        ...data,
        createdAt: new Date().toISOString(),
      });
      showToast("特殊日期已保存 💕");
    }

    saveDates(dates);
    resetForm();
    renderAll();
    return true;
  }

  function deleteDate(id) {
    saveDates(loadDates().filter((e) => e.id !== id));
    if (editingId === id) resetForm();
    renderAll();
    showToast("已删除");
  }

  function renderAll() {
    renderCalendar();
    renderUpcoming();
    renderAllDates();
  }

  function initToolbar() {
    const now = new Date();
    viewYear = now.getFullYear();
    viewMonth = now.getMonth() + 1;

    document.getElementById("cal-prev")?.addEventListener("click", () => {
      viewMonth -= 1;
      if (viewMonth < 1) {
        viewMonth = 12;
        viewYear -= 1;
      }
      renderCalendar();
    });

    document.getElementById("cal-next")?.addEventListener("click", () => {
      viewMonth += 1;
      if (viewMonth > 12) {
        viewMonth = 1;
        viewYear += 1;
      }
      renderCalendar();
    });

    document.getElementById("cal-today")?.addEventListener("click", () => {
      const n = new Date();
      viewYear = n.getFullYear();
      viewMonth = n.getMonth() + 1;
      renderCalendar();
    });
  }

  function initForm() {
    const dateInput = document.getElementById("date-value");
    if (dateInput && !dateInput.value) {
      dateInput.value = toDateStr(viewYear, viewMonth, new Date().getDate());
    }

    document.getElementById("date-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      saveDate({
        title: document.getElementById("date-title").value.trim(),
        date: document.getElementById("date-value").value,
        type: document.getElementById("date-type").value,
        emoji: document.getElementById("date-emoji").value.trim(),
        note: document.getElementById("date-note").value.trim(),
        yearly: document.getElementById("date-yearly").checked,
      });
    });

    document.getElementById("date-cancel-edit")?.addEventListener("click", resetForm);
  }

  function initDialog() {
    const dialog = document.getElementById("day-dialog");
    document.getElementById("dialog-close")?.addEventListener("click", () => dialog?.close());
    document.getElementById("dialog-add-btn")?.addEventListener("click", () => {
      dialog?.close();
      fillForm(selectedDate);
      document.getElementById("date-title")?.focus();
    });
    dialog?.addEventListener("click", (e) => {
      if (e.target === dialog) dialog.close();
    });
  }

  initToolbar();
  initForm();
  initDialog();
  renderAll();

  window.CoupleCalendar = {
    loadDates,
    nextOccurrence,
    daysUntil,
    formatDisplayDate,
    TYPE_LABELS,
    TYPE_EMOJI,
  };
})();
