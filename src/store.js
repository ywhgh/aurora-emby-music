export function createStore(initialState = {}, options = {}) {
  const state = { ...initialState };
  const listeners = new Set();
  const derived = new Map();
  const requestIdle = options.requestIdle || ((callback) => setTimeout(callback, 0));
  const cancelIdle = options.cancelIdle || clearTimeout;
  let revision = 0;
  let notifyHandle = null;

  function notify() {
    notifyHandle = null;
    listeners.forEach((listener) => listener(state, revision));
  }

  function scheduleNotify() {
    if (notifyHandle !== null) cancelIdle(notifyHandle);
    notifyHandle = requestIdle(notify, { timeout: 120 });
  }

  function set(patch) {
    const next = typeof patch === "function" ? patch(state) : patch;
    if (!next || typeof next !== "object") return state;
    let changed = false;
    Object.entries(next).forEach(([key, value]) => {
      if (!Object.is(state[key], value)) {
        state[key] = value;
        changed = true;
      }
    });
    if (changed) {
      revision += 1;
      scheduleNotify();
    }
    return state;
  }

  function subscribe(listener) {
    if (typeof listener !== "function") return () => {};
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function derive(key, dependencies, compute) {
    const deps = Array.isArray(dependencies) ? dependencies : [];
    const cached = derived.get(key);
    if (cached && deps.length === cached.deps.length && deps.every((value, index) => Object.is(value, cached.deps[index]))) {
      return cached.value;
    }
    const value = compute(state);
    derived.set(key, { deps: [...deps], value });
    return value;
  }

  function destroy() {
    if (notifyHandle !== null) cancelIdle(notifyHandle);
    notifyHandle = null;
    listeners.clear();
    derived.clear();
  }

  return { state, set, subscribe, derive, destroy };
}
