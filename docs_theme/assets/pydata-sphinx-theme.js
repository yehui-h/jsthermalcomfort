/**
 * Cycles the docs color-mode button through light, dark, and auto.
 *
 * The pydata-sphinx-theme bundle this file replaces also queried
 * #pst-search-dialog and form.bd-search, which this theme does not render.
 * Search lives in search.js. The icon shown on the button is CSS keyed off
 * html[data-mode], using the same order the old button used: when the system
 * preference is dark the cycle is auto → light → dark, otherwise
 * auto → dark → light.
 */
(function () {
  const media = window.matchMedia("(prefers-color-scheme: dark)");

  function systemTheme() {
    return media.matches ? "dark" : "light";
  }

  function applyMode(mode) {
    if (mode !== "light" && mode !== "dark" && mode !== "auto") {
      mode = "auto";
    }

    const theme = mode === "auto" ? systemTheme() : mode;
    document.documentElement.dataset.mode = mode;
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("mode", mode);
    localStorage.setItem("theme", theme);
    media.onchange = mode === "auto" ? onSchemeChange : null;
  }

  function onSchemeChange() {
    document.documentElement.dataset.theme = systemTheme();
  }

  function nextMode(current) {
    const order = media.matches
      ? ["auto", "light", "dark"]
      : ["auto", "dark", "light"];
    let index = order.indexOf(current) + 1;
    if (index === order.length) {
      index = 0;
    }
    return order[index];
  }

  function onClick() {
    const fallback = document.documentElement.dataset.defaultMode || "auto";
    const current = localStorage.getItem("mode") || fallback;
    applyMode(nextMode(current));
  }

  function onReady() {
    applyMode(document.documentElement.dataset.mode);
    document.querySelectorAll(".theme-switch-button").forEach((button) => {
      button.addEventListener("click", onClick);
    });
  }

  if (document.readyState !== "loading") {
    onReady();
  } else {
    document.addEventListener("DOMContentLoaded", onReady);
  }
})();
