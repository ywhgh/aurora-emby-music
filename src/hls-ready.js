(() => {
  const dispatchWhenReady = () => {
    if (window.Hls) {
      window.dispatchEvent(new Event("emby-music-hls-ready"));
      return true;
    }
    return false;
  };

  if (dispatchWhenReady()) {
    return;
  }

  const timer = window.setInterval(() => {
    if (dispatchWhenReady()) {
      window.clearInterval(timer);
    }
  }, 50);

  window.setTimeout(() => window.clearInterval(timer), 15000);
})();
