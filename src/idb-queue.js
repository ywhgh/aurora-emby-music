(() => {
  const DB_NAME = "emby-music-web";
  const DB_VERSION = 1;
  const STORE_NAME = "queue-state";
  const MAX_QUEUE_TRACKS = 10000;

  function createIdbQueueStorage(indexedDb = globalThis.indexedDB) {
    function getSessionKey(session) {
      if (!session?.userId) {
        return "";
      }

      const serverUrl = session.sourceMode === "external"
        ? "source-bridge://external-source"
        : String(session.serverUrl || "").replace(/\/+$/, "").toLowerCase();
      return serverUrl ? `${serverUrl}::${session.userId}` : "";
    }

    function openDatabase() {
      if (!indexedDb) {
        return Promise.resolve(null);
      }

      return new Promise((resolve, reject) => {
        const request = indexedDb.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains(STORE_NAME)) {
            database.createObjectStore(STORE_NAME);
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }

    async function runTransaction(mode, action) {
      const database = await openDatabase();
      if (!database) {
        return null;
      }

      return new Promise((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, mode);
        const store = transaction.objectStore(STORE_NAME);
        const request = action(store);
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => database.close();
        transaction.onabort = () => database.close();
        transaction.onerror = () => database.close();
      });
    }

    async function load(session) {
      const key = getSessionKey(session);
      if (!key) {
        return null;
      }
      return runTransaction("readonly", (store) => store.get(key));
    }

    async function save(queueState) {
      const key = getSessionKey(queueState?.session);
      if (!key || !Array.isArray(queueState?.queue) || !queueState.queue.length) {
        return clear(queueState?.session);
      }

      const payload = {
        serverUrl: queueState.session.sourceMode === "external"
          ? "source-bridge://external-source"
          : queueState.session.serverUrl,
        userId: queueState.session.userId,
        serverId: queueState.session.serverId,
        queue: queueState.queue.filter((track) => track?.Id).slice(0, MAX_QUEUE_TRACKS),
        currentTrackId: queueState.currentTrackId || "",
        currentTrackIndex: Number(queueState.currentTrackIndex) || 0,
        positionSeconds: Number(queueState.positionSeconds) || 0,
        savedAt: queueState.savedAt || new Date().toISOString(),
      };
      return runTransaction("readwrite", (store) => store.put(payload, key));
    }

    async function clear(session) {
      const key = getSessionKey(session);
      if (!key) {
        return null;
      }
      return runTransaction("readwrite", (store) => store.delete(key));
    }

    return { clear, load, save };
  }

  window.EmbyMusicIdbQueue = {
    MAX_QUEUE_TRACKS,
    createIdbQueueStorage,
  };
})();
