(function () {
  const STORAGE_KEY = "couple-page-background";

  const PRESETS = [
    { id: "cream", label: "暖米", swatch: "linear-gradient(135deg, #faf8f5, #f0e6d8)", value: "linear-gradient(160deg, #faf8f5 0%, #f0e6d8 100%)" },
    { id: "pink", label: "樱花", swatch: "linear-gradient(135deg, #fff5f7, #fbcfe8)", value: "linear-gradient(160deg, #fff5f7 0%, #fce7f3 50%, #fbcfe8 100%)" },
    { id: "sky", label: "晴空", swatch: "linear-gradient(135deg, #eff6ff, #bfdbfe)", value: "linear-gradient(160deg, #eff6ff 0%, #dbeafe 50%, #bfdbfe 100%)" },
    { id: "lavender", label: "薰衣草", swatch: "linear-gradient(135deg, #f5f3ff, #ddd6fe)", value: "linear-gradient(160deg, #f5f3ff 0%, #ede9fe 50%, #ddd6fe 100%)" },
    { id: "mint", label: "薄荷", swatch: "linear-gradient(135deg, #ecfdf5, #a7f3d0)", value: "linear-gradient(160deg, #ecfdf5 0%, #d1fae5 50%, #a7f3d0 100%)" },
    { id: "sunset", label: "晚霞", swatch: "linear-gradient(135deg, #fff7ed, #fb923c)", value: "linear-gradient(160deg, #fff7ed 0%, #fed7aa 40%, #fdba74 70%, #fb923c 100%)" },
    { id: "ocean", label: "海洋", swatch: "linear-gradient(135deg, #ecfeff, #0ea5e9)", value: "linear-gradient(160deg, #ecfeff 0%, #67e8f9 50%, #0ea5e9 100%)" },
    { id: "cherry", label: "蜜桃", swatch: "linear-gradient(135deg, #fdf2f8, #ec4899)", value: "linear-gradient(160deg, #fdf2f8 0%, #f9a8d4 50%, #ec4899 100%)" },
    { id: "night", label: "夜空", swatch: "linear-gradient(135deg, #1e1b4b, #4c1d95)", value: "linear-gradient(160deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%)" },
  ];

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : { mode: "default", overlay: 0.42 };
    } catch {
      return { mode: "default", overlay: 0.42 };
    }
  }

  function save(config) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    apply(config);
    window.CoupleBackup?.scheduleAutoBackup?.();
  }

  function apply(config) {
    const root = document.documentElement;
    root.classList.remove("has-page-bg");
    root.style.removeProperty("--page-bg-image");
    root.style.removeProperty("--page-bg-overlay");

    if (!config || config.mode === "default") return;

    root.classList.add("has-page-bg");
    const overlay = typeof config.overlay === "number" ? config.overlay : 0.42;
    root.style.setProperty(
      "--page-bg-overlay",
      `color-mix(in srgb, var(--bg) ${Math.round(overlay * 100)}%, transparent)`
    );

    if (config.mode === "image" && config.image) {
      root.style.setProperty("--page-bg-image", `url("${config.image}")`);
      return;
    }

    const preset = PRESETS.find((p) => p.id === config.preset);
    if (config.mode === "preset" && preset) {
      root.style.setProperty("--page-bg-image", preset.value || preset.swatch);
      return;
    }

    if (config.mode === "color" && config.color) {
      root.style.setProperty("--page-bg-image", `linear-gradient(180deg, ${config.color}, ${config.color})`);
    }
  }

  function compressImage(file, maxW, quality) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let w = img.width;
        let h = img.height;
        if (w > maxW) {
          h = Math.round((h * maxW) / w);
          w = maxW;
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  function getPreviewStyle(config) {
    if (!config || config.mode === "default") {
      return { background: "var(--bg)" };
    }
    if (config.mode === "image" && config.image) {
      return {
        backgroundImage: `url("${config.image}")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      };
    }
    if (config.mode === "preset") {
      const preset = PRESETS.find((p) => p.id === config.preset);
      if (preset) return { background: preset.swatch };
    }
    if (config.mode === "color" && config.color) {
      return { background: config.color };
    }
    return { background: "var(--bg)" };
  }

  window.CoupleBackground = {
    STORAGE_KEY,
    PRESETS,
    load,
    save,
    apply,
    compressImage,
    getPreviewStyle,
  };

  apply(load());
})();
