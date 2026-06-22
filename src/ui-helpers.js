window.EmbyMusicUIHelpers = (function () {
  "use strict";

  const loadingStates = new Map();
  const debounceTimers = new Map();
  const throttleTimestamps = new Map();

  function showLoading(containerId, message = "加载中...") {
    const container = document.getElementById(containerId);
    if (!container) return null;

    const existingLoader = container.querySelector(".loading-overlay");
    if (existingLoader) return existingLoader;

    const overlay = document.createElement("div");
    overlay.className = "loading-overlay";
    overlay.innerHTML = `
      <div class="loading-spinner">
        <div class="spinner-ring"></div>
        <div class="spinner-message">${message}</div>
      </div>
    `;

    container.style.position = container.style.position || "relative";
    container.appendChild(overlay);
    loadingStates.set(containerId, overlay);

    return overlay;
  }

  function hideLoading(containerId) {
    const overlay = loadingStates.get(containerId);
    if (overlay && overlay.parentNode) {
      overlay.remove();
      loadingStates.delete(containerId);
    }
  }

  function showEmptyState(containerId, options = {}) {
    const {
      icon = "search",
      title = "暂无内容",
      message = "",
      actionText = "",
      onAction = null,
    } = options;

    const container = document.getElementById(containerId);
    if (!container) return;

    const iconPaths = {
      search: '<circle cx="11" cy="11" r="7"></circle><path d="m16.2 16.2 4.1 4.1"></path>',
      music: '<path d="M9 18V6l10-2v12"></path><circle cx="7" cy="18" r="2"></circle><circle cx="17" cy="16" r="2"></circle>',
      album: '<circle cx="12" cy="12" r="8"></circle><circle cx="12" cy="12" r="2"></circle>',
      network: '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z"></path><path d="M2 12h20"></path><path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10Z"></path>',
    };

    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    emptyState.innerHTML = `
      <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        ${iconPaths[icon] || iconPaths.search}
      </svg>
      <h3 class="empty-state-title">${title}</h3>
      ${message ? `<p class="empty-state-message">${message}</p>` : ""}
      ${actionText && onAction ? `<button class="empty-state-action" type="button">${actionText}</button>` : ""}
    `;

    if (actionText && onAction) {
      const actionBtn = emptyState.querySelector(".empty-state-action");
      actionBtn?.addEventListener("click", onAction);
    }

    container.innerHTML = "";
    container.appendChild(emptyState);
  }

  function debounce(key, fn, delay = 300) {
    return function (...args) {
      const existingTimer = debounceTimers.get(key);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const timer = setTimeout(() => {
        fn.apply(this, args);
        debounceTimers.delete(key);
      }, delay);

      debounceTimers.set(key, timer);
    };
  }

  function throttle(key, fn, limit = 300) {
    return function (...args) {
      const now = Date.now();
      const lastCall = throttleTimestamps.get(key) || 0;

      if (now - lastCall >= limit) {
        throttleTimestamps.set(key, now);
        fn.apply(this, args);
      }
    };
  }

  function animateValue(element, start, end, duration = 600, formatter = (v) => v) {
    const startTime = Date.now();
    const change = end - start;

    function update() {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + change * eased;

      element.textContent = formatter(Math.round(current));

      if (progress < 1) {
        requestAnimationFrame(update);
      }
    }

    requestAnimationFrame(update);
  }

  function createToast(message, type = "info", duration = 3000) {
    const toastContainer = document.getElementById("toastContainer") || createToastContainer();

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-content">
        <span class="toast-message">${message}</span>
        <button class="toast-close" type="button" aria-label="关闭">×</button>
      </div>
    `;

    const closeBtn = toast.querySelector(".toast-close");
    closeBtn?.addEventListener("click", () => removeToast(toast));

    toastContainer.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add("toast-visible");
    });

    if (duration > 0) {
      setTimeout(() => removeToast(toast), duration);
    }

    return toast;
  }

  function createToastContainer() {
    const container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container";
    document.body.appendChild(container);
    return container;
  }

  function removeToast(toast) {
    toast.classList.remove("toast-visible");
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 300);
  }

  function lazyLoadImages(containerSelector = ".content") {
    const container = document.querySelector(containerSelector);
    if (!container) return;

    const images = container.querySelectorAll("img[data-src]");
    if (images.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target;
            const src = img.getAttribute("data-src");
            if (src) {
              img.src = src;
              img.removeAttribute("data-src");
              observer.unobserve(img);
            }
          }
        });
      },
      {
        rootMargin: "50px",
      }
    );

    images.forEach((img) => observer.observe(img));
  }

  function trapFocus(element) {
    const focusableElements = element.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    function handleTabKey(e) {
      if (e.key !== "Tab") return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement?.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement?.focus();
          e.preventDefault();
        }
      }
    }

    element.addEventListener("keydown", handleTabKey);

    return () => {
      element.removeEventListener("keydown", handleTabKey);
    };
  }

  function smoothScrollTo(element, offset = 0) {
    if (!element) return;

    const elementPosition = element.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.pageYOffset - offset;

    window.scrollTo({
      top: offsetPosition,
      behavior: "smooth",
    });
  }

  function formatFileSize(bytes) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(
        () => true,
        () => false
      );
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      try {
        const successful = document.execCommand("copy");
        document.body.removeChild(textArea);
        return Promise.resolve(successful);
      } catch (err) {
        document.body.removeChild(textArea);
        return Promise.resolve(false);
      }
    }
  }

  return {
    showLoading,
    hideLoading,
    showEmptyState,
    debounce,
    throttle,
    animateValue,
    createToast,
    lazyLoadImages,
    trapFocus,
    smoothScrollTo,
    formatFileSize,
    copyToClipboard,
  };
})();
