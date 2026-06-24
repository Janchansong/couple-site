(function () {
  if (!window.CoupleSiteContent) return;

  let editing = false;
  let snapshot = null;
  let activeSection = null;

  const bar = document.createElement("div");
  bar.className = "cms-edit-bar";
  bar.hidden = true;
  bar.innerHTML = `
    <div class="cms-edit-bar-inner">
      <span class="cms-edit-hint" id="cms-edit-hint">点击文字即可修改</span>
      <div class="cms-edit-actions">
        <button type="button" class="btn btn-secondary btn-sm" id="cms-btn-cancel">取消</button>
        <button type="button" class="btn btn-primary btn-sm" id="cms-btn-save">保存</button>
      </div>
    </div>
  `;

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "cms-edit-toggle";
  toggle.title = "编辑本页内容";
  toggle.textContent = "✏️ 编辑";

  function getSections() {
    return [...document.querySelectorAll("[data-edit-section]")];
  }

  function getSectionFields(section) {
    if (!section) return [];
    return [...section.querySelectorAll("[data-cms]")];
  }

  function showToast(msg) {
    let el = document.getElementById("cms-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "cms-toast";
      el.className = "cms-toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => el.classList.remove("show"), 2200);
  }

  function setEditable(on, section) {
    const fields = section ? getSectionFields(section) : document.querySelectorAll("[data-cms]");
    fields.forEach((el) => {
      if (el.closest("#auth-gate")) return;
      if (on) {
        el.setAttribute("contenteditable", "true");
        el.setAttribute("spellcheck", "false");
        el.classList.add("cms-field-editing");
      } else {
        el.removeAttribute("contenteditable");
        el.classList.remove("cms-field-editing");
      }
    });
  }

  function enterEdit(section) {
    if (editing) return;
    const fields = section ? getSectionFields(section) : document.querySelectorAll("[data-cms]");
    if (!fields.length) return;

    editing = true;
    activeSection = section || null;
    snapshot = CoupleSiteContent.collect(activeSection || document);

    document.documentElement.classList.add("cms-editing");
    bar.hidden = false;
    toggle.hidden = true;
    setEditable(true, activeSection);

    const hint = document.getElementById("cms-edit-hint");
    if (hint) {
      const name = activeSection?.dataset.editSection;
      hint.textContent = name ? `正在编辑：${name}` : "点击文字即可修改";
    }

    getSections().forEach((sec) => {
      const btn = sec.querySelector(".cms-section-edit");
      if (btn) btn.hidden = true;
    });
  }

  function exitEdit(restore) {
    if (!editing) return;
    editing = false;
    setEditable(false, activeSection);
    document.documentElement.classList.remove("cms-editing");
    bar.hidden = true;
    toggle.hidden = false;
    activeSection = null;

    if (restore && snapshot) {
      CoupleSiteContent.apply();
    }
    snapshot = null;

    getSections().forEach((sec) => {
      const btn = sec.querySelector(".cms-section-edit");
      if (btn) btn.hidden = false;
    });
  }

  function saveEdit() {
    CoupleSiteContent.save(null, activeSection || document);
    snapshot = null;
    exitEdit(false);
    showToast("已保存，云同步后会同步到另一台设备");
  }

  function initSectionButtons() {
    getSections().forEach((section) => {
      if (section.querySelector(".cms-section-edit")) return;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cms-section-edit";
      btn.textContent = "编辑";
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        enterEdit(section);
      });
      section.appendChild(btn);
    });
  }

  function init() {
    const hasCms = document.querySelector("[data-cms]");
    if (!hasCms) return;

    document.body.appendChild(bar);
    document.body.appendChild(toggle);

    toggle.addEventListener("click", () => enterEdit(null));
    document.getElementById("cms-btn-save")?.addEventListener("click", saveEdit);
    document.getElementById("cms-btn-cancel")?.addEventListener("click", () => exitEdit(true));

    initSectionButtons();

    document.addEventListener("keydown", (e) => {
      if (!editing) return;
      if (e.key === "Escape") exitEdit(true);
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        saveEdit();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
