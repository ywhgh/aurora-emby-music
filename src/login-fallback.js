(() => {
  const version = "0.94.1";
  const appName = "Aurora Music";
  const sessionKey = "emby-music-web/session";
  const accountProfilesKey = "emby-music-web/account-profiles";
  const deviceKey = "emby-music-web/device-id";
  const byId = (id) => document.getElementById(id);
  const message = byId("message");
  const serverUrlInput = byId("serverUrl");
  const usernameInput = byId("username");
  const passwordInput = byId("password");
  const deviceNameInput = byId("deviceName");
  const redact = window.EmbyMusicRedact || {
    redactText: (value) => String(value || ""),
  };

  function setLoginMessage(text, type = "") {
    if (!message) {
      return;
    }
    message.textContent = redact.redactText(text);
    message.className = `message ${type}`.trim();
  }

  function normalizeServerUrl(value) {
    const trimmed = value.trim();

    if (!trimmed) {
      return "";
    }

    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;

    try {
      const url = new URL(withProtocol);
      url.hash = "";
      url.search = "";
      url.pathname = url.pathname
        .replace(/\/+$/, "")
        .replace(/\/web\/index\.html?$/i, "")
        .replace(/\/web$/i, "");
      return url.toString().replace(/\/+$/, "");
    } catch {
      return withProtocol.replace(/\/+$/, "");
    }
  }

  function buildServerUrl(serverUrl, path) {
    const baseUrl = serverUrl.replace(/\/+$/, "");
    let nextPath = path.startsWith("/") ? path : `/${path}`;

    if (/\/emby$/i.test(baseUrl) && /^\/emby(?=\/|$|\?)/i.test(nextPath)) {
      nextPath = nextPath.replace(/^\/emby(?=\/|$|\?)/i, "");
    }

    return `${baseUrl}${nextPath}`;
  }

  function getDeviceId() {
    const existing = localStorage.getItem(deviceKey);

    if (existing) {
      return existing;
    }

    const id = crypto?.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(deviceKey, id);
    return id;
  }

  function escapeHeaderValue(value) {
    return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
  }

  function authorizationHeader(deviceName) {
    const parts = [
      `Client="${escapeHeaderValue(appName)}"`,
      `Device="${escapeHeaderValue(deviceName)}"`,
      `DeviceId="${escapeHeaderValue(getDeviceId())}"`,
      `Version="${escapeHeaderValue(version)}"`,
    ];

    return `MediaBrowser ${parts.join(", ")}`;
  }

  async function requestJson(url, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(url, {
        ...options,
        signal: options.signal || controller.signal,
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("认证失败，请检查用户名或密码。");
        }

        throw new Error(`服务器返回 ${response.status} ${response.statusText || ""}`.trim());
      }

      return response.json();
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error("连接服务器超时，请检查服务器是否在线、端口是否开放。");
      }

      if (error instanceof Error && error.message) {
        throw error;
      }

      throw new Error("网络请求失败，请检查地址、协议、端口和浏览器 CORS 限制。");
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function fallbackTestServer() {
    const serverUrl = normalizeServerUrl(serverUrlInput?.value || "");

    if (!serverUrl) {
      setLoginMessage("请先填写服务器地址。", "error");
      return;
    }

    setLoginMessage("正在测试 Emby 服务器...");
    const publicInfo = await requestJson(buildServerUrl(serverUrl, "/emby/System/Info/Public"));
    const serverLabel = publicInfo.ServerName || publicInfo.LocalAddress || "Emby Server";
    const versionLabel = publicInfo.Version ? ` · Emby ${publicInfo.Version}` : "";
    setLoginMessage(`服务器连接正常：${serverLabel}${versionLabel}。`, "success");
  }

  async function fallbackConnect() {
    const serverUrl = normalizeServerUrl(serverUrlInput?.value || "");
    const username = usernameInput?.value.trim() || "";
    const password = passwordInput?.value || "";
    const deviceName = deviceNameInput?.value.trim() || `${appName} on ${navigator.platform || "Browser"}`;

    if (!serverUrl || !username || !password) {
      setLoginMessage("请填写服务器地址、用户名和密码。", "error");
      return;
    }

    setLoginMessage("正在连接 Emby 服务器...");
    const auth = await requestJson(buildServerUrl(serverUrl, "/emby/Users/AuthenticateByName"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Emby-Authorization": authorizationHeader(deviceName),
      },
      body: JSON.stringify({ Username: username, Pw: password }),
    });
    const publicInfo = await requestJson(buildServerUrl(serverUrl, "/emby/System/Info/Public")).catch(() => ({}));
    const session = {
      serverUrl,
      deviceName,
      accessToken: auth.AccessToken,
      userId: auth.User?.Id,
      userName: auth.User?.Name,
      serverId: auth.ServerId || publicInfo.Id,
      serverName: publicInfo.ServerName || publicInfo.LocalAddress || "Emby Server",
      version: publicInfo.Version || "-",
      savedAt: new Date().toISOString(),
    };

    localStorage.setItem(sessionKey, JSON.stringify(session));
    saveFallbackAccountProfile(session);
    setLoginMessage("连接成功，正在进入应用...", "success");
    const url = new URL(location.href);
    url.searchParams.set("v", version);
    url.searchParams.set("reload", String(Date.now()));
    location.replace(url.toString());
  }

  function saveFallbackAccountProfile(session) {
    if (!session?.serverUrl || !session?.userId || !session?.accessToken) {
      return;
    }

    const key = `${session.serverUrl.replace(/\/+$/, "").toLowerCase()}::${session.userId}`;
    const savedAt = new Date().toISOString();
    const profile = {
      key,
      savedAt,
      session: { ...session, savedAt },
    };

    try {
      const existing = JSON.parse(localStorage.getItem(accountProfilesKey) || "[]");
      const profiles = Array.isArray(existing) ? existing.filter((item) => item?.key !== key) : [];
      localStorage.setItem(accountProfilesKey, JSON.stringify([profile, ...profiles].slice(0, 12)));
    } catch {
      localStorage.setItem(accountProfilesKey, JSON.stringify([profile]));
    }
  }

  function scrubCredentialQuery() {
    const url = new URL(location.href);
    const serverUrl = url.searchParams.get("serverUrl");
    const username = url.searchParams.get("username");
    const password = url.searchParams.get("password");
    const deviceName = url.searchParams.get("deviceName");
    const hadPassword = url.searchParams.has("password");
    const hasCredentials = ["serverUrl", "username", "password", "deviceName"]
      .some((key) => url.searchParams.has(key));

    if (serverUrl && serverUrlInput && !serverUrlInput.value) {
      serverUrlInput.value = serverUrl;
    }
    if (username && usernameInput && !usernameInput.value) {
      usernameInput.value = username;
    }
    if (password && passwordInput && !passwordInput.value) {
      passwordInput.value = password;
    }
    if (deviceName && deviceNameInput && !deviceNameInput.value) {
      deviceNameInput.value = deviceName;
    }

    const pendingLogin = serverUrl && username && password
      ? { serverUrl, username, password, deviceName: deviceName || "" }
      : null;

    if (pendingLogin) {
      window.EmbyMusicPendingLogin = pendingLogin;
    }

    if (!hasCredentials) {
      return pendingLogin;
    }

    ["serverUrl", "username", "password", "deviceName"].forEach((key) => {
      url.searchParams.delete(key);
    });
    history.replaceState(null, "", url.toString());

    if (hadPassword) {
      setLoginMessage(pendingLogin
        ? "已移除地址栏中的密码参数，正在连接 Emby..."
        : "已移除地址栏中的密码参数，可以直接连接。");
    }

    return pendingLogin;
  }

  async function clearCacheAndReload() {
    setLoginMessage("正在清除应用缓存...");
    try {
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys
          .filter((key) => key.startsWith("emby-music-web-"))
          .map((key) => caches.delete(key)));
      }
    } finally {
      const url = new URL(location.href);
      url.searchParams.set("v", version);
      url.searchParams.set("reload", String(Date.now()));
      location.replace(url.toString());
    }
  }

  function buildFallbackDiagnostics() {
    const diagnostics = [
      "本诊断已经隐藏服务器/账号敏感信息，可用于问题排查。",
      `Aurora Music ${version}`,
      `URL: ${location.href}`,
      `Recommended action: ${getFallbackDiagnosticsGuidance()}`,
      `Fallback ready: yes`,
      `Main app ready: ${window.EmbyMusicAppReady ? "yes" : "no"}`,
      `Main app error: ${window.EmbyMusicAppError || "-"}`,
      `Server input: ${serverUrlInput?.value || "-"}`,
      `Browser network: ${navigator.onLine === false ? "offline" : "online"}`,
      `Service Worker: ${"serviceWorker" in navigator ? (navigator.serviceWorker.controller ? "controlled" : "supported") : "unsupported"}`,
      `Cache API: ${"caches" in window ? "supported" : "unsupported"}`,
      `User agent: ${navigator.userAgent}`,
    ].join("\n");

    return redact.redactText(diagnostics);
  }

  function getFallbackDiagnosticsGuidance() {
    if (!serverUrlInput?.value) {
      return "enter the Emby server address, then test the server";
    }

    if (navigator.onLine === false) {
      return "browser is offline; reconnect the network before logging in";
    }

    if (location.protocol === "file:") {
      return "file protocol may be blocked by CORS; use a local static server";
    }

    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      return "main app did not load; clear cache and reload";
    }

    return "test server first; if it succeeds, connect with username and password";
  }

  function runFallbackConnect() {
    fallbackConnect().catch((error) => {
      setLoginMessage(error instanceof Error ? error.message : "连接失败，请稍后重试。", "error");
    });
  }

  function bindFallbackLogin() {
    byId("loginVersion").textContent = `v${version}`;
    const pendingLogin = scrubCredentialQuery();

    if (pendingLogin) {
      setTimeout(() => {
        if (window.EmbyMusicAppReady || !window.EmbyMusicPendingLogin) {
          return;
        }

        fallbackConnect()
          .catch((error) => {
            setLoginMessage(error instanceof Error ? error.message : "连接失败，请稍后重试。", "error");
          })
          .finally(() => {
            window.EmbyMusicPendingLogin = null;
          });
      }, 1600);
    }

    byId("connectForm").addEventListener("submit", (event) => {
      event.preventDefault();
      if (window.EmbyMusicAppReady) {
        return;
      }
      runFallbackConnect();
    });

    byId("connectButton").addEventListener("click", (event) => {
      if (window.EmbyMusicAppReady) {
        return;
      }
      event.preventDefault();
      runFallbackConnect();
    });

    byId("testServerButton").addEventListener("click", () => {
      if (window.EmbyMusicAppReady) {
        return;
      }
      fallbackTestServer().catch((error) => {
        setLoginMessage(`服务器测试失败：${error instanceof Error ? error.message : "请稍后重试。"}`, "error");
      });
    });

    byId("copyLoginDiagnosticsButton").addEventListener("click", async () => {
      if (window.EmbyMusicAppReady) {
        return;
      }
      const diagnostics = buildFallbackDiagnostics();
      try {
        await navigator.clipboard.writeText(diagnostics);
        setLoginMessage("兜底诊断信息已复制。", "success");
      } catch {
        console.info(diagnostics);
        setLoginMessage("无法自动复制，诊断信息已输出到 Console。", "error");
      }
    });

    byId("clearLoginCacheButton").addEventListener("click", () => {
      if (window.EmbyMusicAppReady) {
        return;
      }
      clearCacheAndReload();
    });
  }

  bindFallbackLogin();
})();
