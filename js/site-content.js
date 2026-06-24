(function () {
  const STORAGE_KEY = "couple-site-content";
  const LEGACY_HERO_KEY = "couple-home-profile";

  function getNested(obj, path) {
    if (!obj || !path) return undefined;
    return path.split(".").reduce((o, k) => (o != null ? o[k] : undefined), obj);
  }

  function setNested(obj, path, value) {
    const parts = path.split(".");
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      const next = parts[i + 1];
      if (cur[p] == null) cur[p] = /^\d+$/.test(next) ? [] : {};
      cur = cur[p];
    }
    cur[parts[parts.length - 1]] = value;
    return obj;
  }

  function deepMerge(base, patch) {
    const out = { ...base };
    for (const [k, v] of Object.entries(patch || {})) {
      if (v && typeof v === "object" && !Array.isArray(v) && out[k] && typeof out[k] === "object" && !Array.isArray(out[k])) {
        out[k] = deepMerge(out[k], v);
      } else if (v !== undefined) {
        out[k] = v;
      }
    }
    return out;
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function migrateLegacyHero(data) {
    try {
      const raw = localStorage.getItem(LEGACY_HERO_KEY);
      if (!raw) return data;
      const legacy = JSON.parse(raw);
      if (!legacy?.nameHim) return data;
      const hero = getNested(data, "hero") || {};
      const lt = new Date(legacy.updatedAt || 0).getTime();
      const ht = new Date(hero.updatedAt || 0).getTime();
      if (lt > ht) {
        setNested(data, "hero", { ...hero, ...legacy });
      }
    } catch {
      /* ignore */
    }
    return data;
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : {};
      return migrateLegacyHero(data && typeof data === "object" ? data : {});
    } catch {
      return {};
    }
  }

  function persist(data) {
    data.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    const hero = getNested(data, "hero");
    if (hero?.nameHim) {
      localStorage.setItem(LEGACY_HERO_KEY, JSON.stringify(hero));
    }
  }

  function applyField(el, value) {
    if (value == null || value === "") return;
    if (el.dataset.cmsAttr) {
      el.setAttribute(el.dataset.cmsAttr, value);
    } else if (el.dataset.cmsHtml === "true") {
      el.innerHTML = value;
    } else {
      el.textContent = value;
    }
  }

  function applyHero(hero) {
    if (!hero?.nameHim) return;
    if (document.title.includes("·")) {
      document.title = `${hero.nameHim} & ${hero.nameHer} · 我们俩`;
    }
  }

  function apply(scope) {
    const data = load();
    const root = scope || document;
    root.querySelectorAll("[data-cms]").forEach((el) => {
      const val = getNested(data, el.dataset.cms);
      if (val != null && val !== "") applyField(el, val);
    });
    applyHero(getNested(data, "hero"));
  }

  function collect(scope) {
    const patch = {};
    const root = scope || document;
    root.querySelectorAll("[data-cms]").forEach((el) => {
      let val;
      if (el.dataset.cmsAttr) {
        val = el.getAttribute(el.dataset.cmsAttr) || "";
      } else if (el.dataset.cmsHtml === "true") {
        val = el.innerHTML.trim();
      } else {
        val = el.textContent.trim();
      }
      setNested(patch, el.dataset.cms, val);
    });
    return patch;
  }

  function save(patch, scope) {
    const collected = scope ? collect(scope) : collect();
    const merged = deepMerge(load(), deepMerge(patch || {}, collected));
    persist(merged);
    apply(scope);
    window.CoupleBackup?.scheduleAutoBackup?.();
    window.CoupleSync?.schedulePush?.();
    window.dispatchEvent(new CustomEvent("couple-site-content-updated", { detail: merged }));
    window.dispatchEvent(new CustomEvent("couple-home-profile-updated"));
    return merged;
  }

  function mergeContent(local, remote) {
    if (!remote || typeof remote !== "object") return local || {};
    if (!local || typeof local !== "object") return remote;
    const lt = new Date(local.updatedAt || 0).getTime();
    const rt = new Date(remote.updatedAt || 0).getTime();
    return rt >= lt ? { ...remote } : { ...local };
  }

  window.CoupleSiteContent = {
    STORAGE_KEY,
    load,
    save,
    apply,
    collect,
    getNested,
    setNested,
    mergeContent,
    applyHero,
  };

  apply();
  window.addEventListener("couple-cloud-synced", () => apply());
})();
