window.EmbyMusicAccessibility = (function () {
  "use strict";

  const keyboardShortcuts = new Map();
  let ariaLiveRegion = null;

  function initAriaLiveRegion() {
    if (ariaLiveRegion) return;

    ariaLiveRegion = document.createElement("div");
    ariaLiveRegion.id = "aria-live-region";
    ariaLiveRegion.className = "sr-only";
    ariaLiveRegion.setAttribute("role", "status");
    ariaLiveRegion.setAttribute("aria-live", "polite");
    ariaLiveRegion.setAttribute("aria-atomic", "true");
    document.body.appendChild(ariaLiveRegion);
  }

  function announce(message, priority = "polite") {
    if (!ariaLiveRegion) {
      initAriaLiveRegion();
    }

    ariaLiveRegion.setAttribute("aria-live", priority);
    ariaLiveRegion.textContent = "";

    setTimeout(() => {
      ariaLiveRegion.textContent = message;
    }, 100);
  }

  function registerKeyboardShortcut(key, callback, options = {}) {
    const {
      ctrl = false,
      shift = false,
      alt = false,
      meta = false,
      description = "",
    } = options;

    const shortcutKey = `${ctrl ? "ctrl+" : ""}${shift ? "shift+" : ""}${alt ? "alt+" : ""}${meta ? "meta+" : ""}${key.toLowerCase()}`;

    keyboardShortcuts.set(shortcutKey, {
      callback,
      description,
      ctrl,
      shift,
      alt,
      meta,
      key: key.toLowerCase(),
    });
  }

  function handleKeyboardEvent(event) {
    const target = event.target;
    const isInputField =
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable;

    if (isInputField && !event.ctrlKey && !event.metaKey) {
      return;
    }

    const key = event.key.toLowerCase();
    const shortcutKey = `${event.ctrlKey ? "ctrl+" : ""}${event.shiftKey ? "shift+" : ""}${event.altKey ? "alt+" : ""}${event.metaKey ? "meta+" : ""}${key}`;

    const shortcut = keyboardShortcuts.get(shortcutKey);
    if (shortcut) {
      event.preventDefault();
      shortcut.callback(event);
    }
  }

  function getKeyboardShortcuts() {
    const shortcuts = [];
    keyboardShortcuts.forEach((shortcut, key) => {
      if (shortcut.description) {
        shortcuts.push({
          key,
          description: shortcut.description,
        });
      }
    });
    return shortcuts;
  }

  function enableKeyboardNavigation() {
    document.addEventListener("keydown", handleKeyboardEvent);
  }

  function disableKeyboardNavigation() {
    document.removeEventListener("keydown", handleKeyboardEvent);
  }

  function setDocumentLanguage(lang = "zh-CN") {
    document.documentElement.setAttribute("lang", lang);
  }

  function improveFormAccessibility(form) {
    if (!form) return;

    const inputs = form.querySelectorAll("input, select, textarea");
    inputs.forEach((input) => {
      const label = form.querySelector(`label[for="${input.id}"]`);

      if (!label && !input.getAttribute("aria-label")) {
        const placeholder = input.getAttribute("placeholder");
        if (placeholder) {
          input.setAttribute("aria-label", placeholder);
        }
      }

      if (input.hasAttribute("required") && !input.hasAttribute("aria-required")) {
        input.setAttribute("aria-required", "true");
      }

      if (input.type === "email" || input.type === "url") {
        if (!input.hasAttribute("aria-invalid")) {
          input.addEventListener("blur", function () {
            if (this.value && !this.validity.valid) {
              this.setAttribute("aria-invalid", "true");
            } else {
              this.removeAttribute("aria-invalid");
            }
          });
        }
      }
    });
  }

  function improveButtonAccessibility(button) {
    if (!button) return;

    if (!button.hasAttribute("aria-label") && !button.textContent.trim()) {
      const title = button.getAttribute("title");
      if (title) {
        button.setAttribute("aria-label", title);
      }
    }

    if (button.hasAttribute("disabled")) {
      button.setAttribute("aria-disabled", "true");
    }
  }

  function improveModalAccessibility(modal, options = {}) {
    if (!modal) return;

    const {
      title = "对话框",
      closeButton = null,
      onClose = null,
    } = options;

    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", modal.id + "-title");

    if (!modal.querySelector(`#${modal.id}-title`)) {
      const titleElement = document.createElement("h2");
      titleElement.id = `${modal.id}-title`;
      titleElement.className = "sr-only";
      titleElement.textContent = title;
      modal.insertBefore(titleElement, modal.firstChild);
    }

    const previousFocus = document.activeElement;

    modal.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (closeButton) {
          closeButton.click();
        }
        if (onClose) {
          onClose();
        }
      }
    });

    const focusableElements = modal.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }

    return () => {
      if (previousFocus && previousFocus.focus) {
        previousFocus.focus();
      }
    };
  }

  function setAriaExpanded(element, expanded) {
    if (!element) return;
    element.setAttribute("aria-expanded", expanded ? "true" : "false");
  }

  function setAriaPressed(element, pressed) {
    if (!element) return;
    element.setAttribute("aria-pressed", pressed ? "true" : "false");
  }

  function setAriaSelected(element, selected) {
    if (!element) return;
    element.setAttribute("aria-selected", selected ? "true" : "false");
  }

  function skipToContent(contentId = "mainView") {
    const content = document.getElementById(contentId);
    if (content) {
      content.setAttribute("tabindex", "-1");
      content.focus();
      announce("跳转到主内容区域");
    }
  }

  function addSkipLink() {
    const skipLink = document.createElement("a");
    skipLink.href = "#mainView";
    skipLink.className = "skip-link";
    skipLink.textContent = "跳到主内容";
    skipLink.addEventListener("click", (e) => {
      e.preventDefault();
      skipToContent();
    });

    document.body.insertBefore(skipLink, document.body.firstChild);
  }

  function improveTableAccessibility(table) {
    if (!table) return;

    if (!table.querySelector("thead")) {
      const firstRow = table.querySelector("tr");
      if (firstRow) {
        const thead = document.createElement("thead");
        thead.appendChild(firstRow);
        table.insertBefore(thead, table.firstChild);
      }
    }

    const headers = table.querySelectorAll("th");
    headers.forEach((header, index) => {
      if (!header.id) {
        header.id = `table-header-${index}`;
      }
    });

    const cells = table.querySelectorAll("tbody td");
    cells.forEach((cell) => {
      if (!cell.hasAttribute("headers")) {
        const columnIndex = Array.from(cell.parentElement.children).indexOf(cell);
        const header = table.querySelector(`thead th:nth-child(${columnIndex + 1})`);
        if (header && header.id) {
          cell.setAttribute("headers", header.id);
        }
      }
    });
  }

  function checkColorContrast(element) {
    if (!element) return null;

    const style = window.getComputedStyle(element);
    const color = style.color;
    const backgroundColor = style.backgroundColor;

    return {
      color,
      backgroundColor,
      warning: "Color contrast checking requires additional libraries",
    };
  }

  function enableReducedMotion() {
    document.documentElement.classList.add("reduced-motion");
  }

  function disableReducedMotion() {
    document.documentElement.classList.remove("reduced-motion");
  }

  function respectUserPreferences() {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    if (prefersReducedMotion.matches) {
      enableReducedMotion();
    }

    prefersReducedMotion.addEventListener("change", (e) => {
      if (e.matches) {
        enableReducedMotion();
      } else {
        disableReducedMotion();
      }
    });
  }

  function init() {
    initAriaLiveRegion();
    setDocumentLanguage();
    addSkipLink();
    respectUserPreferences();
  }

  return {
    init,
    announce,
    registerKeyboardShortcut,
    getKeyboardShortcuts,
    enableKeyboardNavigation,
    disableKeyboardNavigation,
    improveFormAccessibility,
    improveButtonAccessibility,
    improveModalAccessibility,
    improveTableAccessibility,
    setAriaExpanded,
    setAriaPressed,
    setAriaSelected,
    skipToContent,
    checkColorContrast,
    enableReducedMotion,
    disableReducedMotion,
  };
})();
