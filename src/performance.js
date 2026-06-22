window.EmbyMusicPerformance = (function () {
  "use strict";

  const observers = new Map();
  const renderQueue = [];
  let rafId = null;

  function virtualScroll(container, items, renderItem, options = {}) {
    const {
      itemHeight = 60,
      bufferSize = 5,
      onLoadMore = null,
    } = options;

    if (!container) return null;

    const viewport = container.parentElement || container;
    const scrollContainer = document.createElement("div");
    scrollContainer.className = "virtual-scroll-container";
    scrollContainer.style.height = `${items.length * itemHeight}px`;

    const visibleContainer = document.createElement("div");
    visibleContainer.className = "virtual-scroll-visible";
    scrollContainer.appendChild(visibleContainer);

    container.innerHTML = "";
    container.appendChild(scrollContainer);

    let lastScrollTop = 0;
    let ticking = false;

    function updateVisibleItems() {
      const scrollTop = viewport.scrollTop;
      const viewportHeight = viewport.clientHeight;

      const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - bufferSize);
      const endIndex = Math.min(
        items.length,
        Math.ceil((scrollTop + viewportHeight) / itemHeight) + bufferSize
      );

      const fragment = document.createDocumentFragment();

      for (let i = startIndex; i < endIndex; i++) {
        const item = items[i];
        if (!item) continue;

        const itemElement = renderItem(item, i);
        itemElement.style.position = "absolute";
        itemElement.style.top = `${i * itemHeight}px`;
        itemElement.style.width = "100%";
        itemElement.style.height = `${itemHeight}px`;

        fragment.appendChild(itemElement);
      }

      visibleContainer.innerHTML = "";
      visibleContainer.appendChild(fragment);

      if (onLoadMore && endIndex >= items.length - bufferSize) {
        onLoadMore();
      }

      ticking = false;
    }

    function onScroll() {
      lastScrollTop = viewport.scrollTop;
      if (!ticking) {
        requestAnimationFrame(updateVisibleItems);
        ticking = true;
      }
    }

    viewport.addEventListener("scroll", onScroll, { passive: true });
    updateVisibleItems();

    return {
      update: (newItems) => {
        items = newItems;
        scrollContainer.style.height = `${items.length * itemHeight}px`;
        updateVisibleItems();
      },
      destroy: () => {
        viewport.removeEventListener("scroll", onScroll);
        scrollContainer.remove();
      },
    };
  }

  function batchRender(renderFn) {
    renderQueue.push(renderFn);

    if (!rafId) {
      rafId = requestAnimationFrame(() => {
        const queue = renderQueue.splice(0);
        queue.forEach((fn) => fn());
        rafId = null;
      });
    }
  }

  function intersectionObserver(elements, callback, options = {}) {
    const {
      threshold = 0.1,
      rootMargin = "0px",
      root = null,
    } = options;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          callback(entry.target, entry);
        }
      });
    }, {
      threshold,
      rootMargin,
      root,
    });

    elements.forEach((el) => observer.observe(el));
    observers.set(elements, observer);

    return () => {
      observer.disconnect();
      observers.delete(elements);
    };
  }

  function memoize(fn, keyGenerator = (...args) => JSON.stringify(args)) {
    const cache = new Map();

    return function (...args) {
      const key = keyGenerator(...args);

      if (cache.has(key)) {
        return cache.get(key);
      }

      const result = fn.apply(this, args);
      cache.set(key, result);

      if (cache.size > 100) {
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
      }

      return result;
    };
  }

  function prefetchImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(url);
      img.onerror = reject;
      img.src = url;
    });
  }

  function prefetchImages(urls, concurrency = 3) {
    const queue = [...urls];
    const results = [];
    let activeCount = 0;

    return new Promise((resolve) => {
      function processNext() {
        if (queue.length === 0 && activeCount === 0) {
          resolve(results);
          return;
        }

        while (activeCount < concurrency && queue.length > 0) {
          const url = queue.shift();
          activeCount++;

          prefetchImage(url)
            .then((loadedUrl) => {
              results.push(loadedUrl);
            })
            .catch(() => {})
            .finally(() => {
              activeCount--;
              processNext();
            });
        }
      }

      processNext();
    });
  }

  function measurePerformance(label, fn) {
    const start = performance.now();
    const result = fn();
    const end = performance.now();
    console.log(`[Performance] ${label}: ${(end - start).toFixed(2)}ms`);
    return result;
  }

  async function measureAsync(label, fn) {
    const start = performance.now();
    const result = await fn();
    const end = performance.now();
    console.log(`[Performance] ${label}: ${(end - start).toFixed(2)}ms`);
    return result;
  }

  function createPool(factory, maxSize = 10) {
    const pool = [];
    const active = new Set();

    return {
      acquire: () => {
        let item = pool.pop();
        if (!item) {
          item = factory();
        }
        active.add(item);
        return item;
      },
      release: (item) => {
        active.delete(item);
        if (pool.length < maxSize) {
          pool.push(item);
        }
      },
      clear: () => {
        pool.length = 0;
        active.clear();
      },
    };
  }

  function createLRUCache(maxSize = 50) {
    const cache = new Map();

    return {
      get: (key) => {
        if (!cache.has(key)) return undefined;
        const value = cache.get(key);
        cache.delete(key);
        cache.set(key, value);
        return value;
      },
      set: (key, value) => {
        if (cache.has(key)) {
          cache.delete(key);
        }
        cache.set(key, value);
        if (cache.size > maxSize) {
          const firstKey = cache.keys().next().value;
          cache.delete(firstKey);
        }
      },
      has: (key) => cache.has(key),
      delete: (key) => cache.delete(key),
      clear: () => cache.clear(),
      size: () => cache.size,
    };
  }

  return {
    virtualScroll,
    batchRender,
    intersectionObserver,
    memoize,
    prefetchImage,
    prefetchImages,
    measurePerformance,
    measureAsync,
    createPool,
    createLRUCache,
  };
})();
