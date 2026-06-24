(function () {
  var pref = localStorage.getItem("couple-view-mode") || "auto";
  var mobile =
    pref === "mobile" ||
    (pref !== "desktop" &&
      (window.matchMedia("(max-width: 768px)").matches ||
        (navigator.maxTouchPoints > 0 && window.innerWidth <= 1024)));
  if (mobile) {
    document.documentElement.classList.add("mobile-view-root");
    document.addEventListener("DOMContentLoaded", function () {
      document.body.classList.add("mobile-view");
    });
  }
})();
