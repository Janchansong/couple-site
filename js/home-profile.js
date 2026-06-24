(function () {
  const LEGACY_KEY = "couple-home-profile";

  const DEFAULTS = {
    label: "你好，我们是",
    nameHim: "小明",
    nameHer: "小雨",
    avatarHim: "明",
    avatarHer: "雨",
    subtitle: "一起写代码 · 一起做饭 · 一起把日子过成喜欢的样子",
    desc: "这是专属于我们两个人的小站。在这里记录旅行、生活琐事、各自的工作学习，以及那些值得留住的瞬间。",
    btnMenu: "老婆点菜 🍳",
    btnAbout: "认识我们",
    btnBlog: "读读博客",
    updatedAt: "",
  };

  function load() {
    if (window.CoupleSiteContent) {
      const hero = CoupleSiteContent.getNested(CoupleSiteContent.load(), "hero");
      if (hero?.nameHim) return { ...DEFAULTS, ...hero };
    }
    try {
      const raw = localStorage.getItem(LEGACY_KEY);
      if (!raw) return { ...DEFAULTS };
      return { ...DEFAULTS, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULTS };
    }
  }

  function save(profile) {
    const data = { ...DEFAULTS, ...profile, updatedAt: new Date().toISOString() };
    if (window.CoupleSiteContent) {
      CoupleSiteContent.save({ hero: data });
    } else {
      localStorage.setItem(LEGACY_KEY, JSON.stringify(data));
    }
    apply(data);
    window.CoupleBackup?.scheduleAutoBackup?.();
    window.CoupleSync?.push?.();
    window.dispatchEvent(new CustomEvent("couple-home-profile-updated", { detail: data }));
    return data;
  }

  function apply(profile) {
    if (window.CoupleSiteContent) {
      CoupleSiteContent.applyHero(profile || load());
      return;
    }
    const p = profile || load();
    const label = document.querySelector(".hero-label");
    const avatarHim = document.querySelector(".avatar-him");
    const avatarHer = document.querySelector(".avatar-her");
    const title = document.querySelector(".hero-title");
    const subtitle = document.querySelector(".hero-subtitle");
    const desc = document.querySelector(".hero-desc");

    if (label) label.textContent = p.label;
    if (avatarHim) avatarHim.textContent = p.avatarHim || p.nameHim?.charAt(0) || "明";
    if (avatarHer) avatarHer.textContent = p.avatarHer || p.nameHer?.charAt(0) || "雨";
    if (title) {
      title.innerHTML = `${String(p.nameHim).replace(/&/g, "&amp;")} <span class="amp">&</span> ${String(p.nameHer).replace(/&/g, "&amp;")}`;
    }
    if (subtitle) subtitle.textContent = p.subtitle;
    if (desc) desc.textContent = p.desc;
  }

  function mergeProfiles(local, remote) {
    if (!remote?.nameHim) return local;
    if (!local?.nameHim) return remote;
    const lt = new Date(local.updatedAt || 0).getTime();
    const rt = new Date(remote.updatedAt || 0).getTime();
    return rt >= lt ? { ...DEFAULTS, ...remote } : { ...DEFAULTS, ...local };
  }

  window.CoupleHomeProfile = {
    STORAGE_KEY: LEGACY_KEY,
    DEFAULTS,
    load,
    save,
    apply,
    mergeProfiles,
  };

  if (document.querySelector(".hero-couple")) {
    window.addEventListener("couple-site-content-updated", () => apply(load()));
    window.addEventListener("couple-cloud-synced", () => apply(load()));
  }
})();
