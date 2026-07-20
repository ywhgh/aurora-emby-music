(() => {
  "use strict";

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function appendLoading(container, text) {
    const loading = document.createElement("div");
    loading.className = "loading-state";
    loading.setAttribute("role", "status");
    loading.textContent = String(text || "正在加载...");
    container.replaceChildren(loading);
    return loading;
  }

  function appendEmpty(container, options = {}) {
    const normalized = typeof options === "string" ? { text: options } : options;
    const empty = document.createElement(normalized.tagName || "div");
    empty.className = normalized.className || "empty-state";
    empty.textContent = String(normalized.text || "");
    if (normalized.role) {
      empty.setAttribute("role", normalized.role);
    }
    container.replaceChildren(empty);
    return empty;
  }

  function setStaticMarkup(element, markup) {
    const html = String(markup || "");
    if (/<(?:script|iframe|object|embed|link|meta)\b|\bon\w+\s*=|javascript:/i.test(html)) {
      throw new TypeError("Unsafe static markup");
    }
    element.innerHTML = html;
    return element;
  }

  window.EmbyMusicDomHelpers = {
    appendEmpty,
    appendLoading,
    escapeHtml,
    setStaticMarkup,
  };
})();
