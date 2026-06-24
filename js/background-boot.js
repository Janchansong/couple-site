(function () {
  var KEY = "couple-page-background";

  function apply(cfg) {
    var root = document.documentElement;
    root.classList.remove("has-page-bg");
    root.style.removeProperty("--page-bg-image");
    root.style.removeProperty("--page-bg-overlay");

    if (!cfg || cfg.mode === "default") return;

    root.classList.add("has-page-bg");
    var overlay = typeof cfg.overlay === "number" ? cfg.overlay : 0.42;
    root.style.setProperty(
      "--page-bg-overlay",
      "color-mix(in srgb, var(--bg) " + Math.round(overlay * 100) + "%, transparent)"
    );

    if (cfg.mode === "image" && cfg.image) {
      root.style.setProperty("--page-bg-image", 'url("' + cfg.image + '")');
      return;
    }

    var presets = {
      cream: "linear-gradient(160deg, #faf8f5 0%, #f0e6d8 100%)",
      pink: "linear-gradient(160deg, #fff5f7 0%, #fce7f3 50%, #fbcfe8 100%)",
      sky: "linear-gradient(160deg, #eff6ff 0%, #dbeafe 50%, #bfdbfe 100%)",
      lavender: "linear-gradient(160deg, #f5f3ff 0%, #ede9fe 50%, #ddd6fe 100%)",
      mint: "linear-gradient(160deg, #ecfdf5 0%, #d1fae5 50%, #a7f3d0 100%)",
      sunset: "linear-gradient(160deg, #fff7ed 0%, #fed7aa 40%, #fdba74 70%, #fb923c 100%)",
      ocean: "linear-gradient(160deg, #ecfeff 0%, #67e8f9 50%, #0ea5e9 100%)",
      night: "linear-gradient(160deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%)",
      cherry: "linear-gradient(160deg, #fdf2f8 0%, #f9a8d4 50%, #ec4899 100%)",
    };

    if (cfg.mode === "preset" && presets[cfg.preset]) {
      root.style.setProperty("--page-bg-image", presets[cfg.preset]);
    } else if (cfg.mode === "color" && cfg.color) {
      root.style.setProperty("--page-bg-image", "linear-gradient(180deg, " + cfg.color + " 0%, " + cfg.color + " 100%)");
    }
  }

  try {
    var raw = localStorage.getItem(KEY);
    if (raw) apply(JSON.parse(raw));
  } catch (e) {
    /* ignore */
  }
})();
