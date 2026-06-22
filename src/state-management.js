window.EmbyMusicState = (function () {
  "use strict";

  const stateListeners = new Map();
  const stateHistory = [];
  const MAX_HISTORY = 50;

  function createStore(initialState = {}) {
    let state = { ...initialState };
    const listeners = new Set();

    const store = {
      getState: () => ({ ...state }),

      setState: (updates) => {
        const prevState = { ...state };
        state = { ...state, ...updates };

        stateHistory.push({
          timestamp: Date.now(),
          prevState,
          nextState: { ...state },
          updates,
        });

        if (stateHistory.length > MAX_HISTORY) {
          stateHistory.shift();
        }

        listeners.forEach((listener) => {
          try {
            listener(state, prevState);
          } catch (error) {
            console.error("State listener error:", error);
          }
        });
      },

      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },

      getHistory: () => [...stateHistory],

      reset: () => {
        const prevState = { ...state };
        state = { ...initialState };
        listeners.forEach((listener) => listener(state, prevState));
      },
    };

    return store;
  }

  function createAsyncAction(actionFn) {
    return async (...args) => {
      const actionId = `${Date.now()}-${Math.random()}`;
      const startTime = Date.now();

      try {
        const result = await actionFn(...args);
        const duration = Date.now() - startTime;

        return {
          success: true,
          result,
          duration,
          actionId,
        };
      } catch (error) {
        const duration = Date.now() - startTime;

        return {
          success: false,
          error,
          duration,
          actionId,
        };
      }
    };
  }

  function createErrorBoundary(onError) {
    return {
      wrap: (fn) => {
        return function (...args) {
          try {
            const result = fn.apply(this, args);
            if (result instanceof Promise) {
              return result.catch((error) => {
                onError(error, { fn, args });
                throw error;
              });
            }
            return result;
          } catch (error) {
            onError(error, { fn, args });
            throw error;
          }
        };
      },

      wrapAsync: (fn) => {
        return async function (...args) {
          try {
            return await fn.apply(this, args);
          } catch (error) {
            onError(error, { fn, args });
            throw error;
          }
        };
      },
    };
  }

  const errorHandlers = new Map();

  function registerErrorHandler(errorType, handler) {
    if (!errorHandlers.has(errorType)) {
      errorHandlers.set(errorType, []);
    }
    errorHandlers.get(errorType).push(handler);
  }

  function handleError(error, context = {}) {
    const errorType = error.constructor.name || "Error";
    const handlers = errorHandlers.get(errorType) || errorHandlers.get("Error") || [];

    const errorInfo = {
      message: error.message,
      stack: error.stack,
      type: errorType,
      timestamp: Date.now(),
      context,
    };

    console.error("[Error Handler]", errorInfo);

    handlers.forEach((handler) => {
      try {
        handler(errorInfo);
      } catch (handlerError) {
        console.error("Error in error handler:", handlerError);
      }
    });

    return errorInfo;
  }

  function retry(fn, options = {}) {
    const {
      maxRetries = 3,
      delay = 1000,
      backoff = 2,
      onRetry = null,
    } = options;

    return async function (...args) {
      let lastError;
      let currentDelay = delay;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          return await fn(...args);
        } catch (error) {
          lastError = error;

          if (attempt < maxRetries) {
            if (onRetry) {
              onRetry(error, attempt + 1, maxRetries);
            }

            await new Promise((resolve) => setTimeout(resolve, currentDelay));
            currentDelay *= backoff;
          }
        }
      }

      throw lastError;
    };
  }

  function createQueue(concurrency = 1) {
    const queue = [];
    let running = 0;

    async function processNext() {
      if (queue.length === 0 || running >= concurrency) {
        return;
      }

      running++;
      const { task, resolve, reject } = queue.shift();

      try {
        const result = await task();
        resolve(result);
      } catch (error) {
        reject(error);
      } finally {
        running--;
        processNext();
      }
    }

    return {
      add: (task) => {
        return new Promise((resolve, reject) => {
          queue.push({ task, resolve, reject });
          processNext();
        });
      },

      size: () => queue.length,
      running: () => running,
      clear: () => {
        queue.length = 0;
      },
    };
  }

  function createLogger(namespace = "App") {
    const logLevels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    };

    let currentLevel = logLevels.info;

    return {
      setLevel: (level) => {
        currentLevel = logLevels[level] || logLevels.info;
      },

      debug: (...args) => {
        if (currentLevel <= logLevels.debug) {
          console.debug(`[${namespace}]`, ...args);
        }
      },

      info: (...args) => {
        if (currentLevel <= logLevels.info) {
          console.info(`[${namespace}]`, ...args);
        }
      },

      warn: (...args) => {
        if (currentLevel <= logLevels.warn) {
          console.warn(`[${namespace}]`, ...args);
        }
      },

      error: (...args) => {
        if (currentLevel <= logLevels.error) {
          console.error(`[${namespace}]`, ...args);
        }
      },

      group: (label) => {
        console.group(`[${namespace}] ${label}`);
      },

      groupEnd: () => {
        console.groupEnd();
      },
    };
  }

  function createEventBus() {
    const events = new Map();

    return {
      on: (event, callback) => {
        if (!events.has(event)) {
          events.set(event, new Set());
        }
        events.get(event).add(callback);

        return () => {
          events.get(event)?.delete(callback);
        };
      },

      emit: (event, data) => {
        const callbacks = events.get(event);
        if (callbacks) {
          callbacks.forEach((callback) => {
            try {
              callback(data);
            } catch (error) {
              console.error(`Event listener error for "${event}":`, error);
            }
          });
        }
      },

      once: (event, callback) => {
        const unsubscribe = this.on(event, (data) => {
          unsubscribe();
          callback(data);
        });
        return unsubscribe;
      },

      off: (event, callback) => {
        events.get(event)?.delete(callback);
      },

      clear: (event) => {
        if (event) {
          events.delete(event);
        } else {
          events.clear();
        }
      },
    };
  }

  function validateData(data, schema) {
    const errors = [];

    Object.keys(schema).forEach((key) => {
      const rule = schema[key];
      const value = data[key];

      if (rule.required && (value === undefined || value === null || value === "")) {
        errors.push(`${key} is required`);
      }

      if (value !== undefined && value !== null) {
        if (rule.type && typeof value !== rule.type) {
          errors.push(`${key} must be of type ${rule.type}`);
        }

        if (rule.min !== undefined && value < rule.min) {
          errors.push(`${key} must be at least ${rule.min}`);
        }

        if (rule.max !== undefined && value > rule.max) {
          errors.push(`${key} must be at most ${rule.max}`);
        }

        if (rule.pattern && !rule.pattern.test(value)) {
          errors.push(`${key} does not match the required pattern`);
        }

        if (rule.validate && !rule.validate(value)) {
          errors.push(`${key} is invalid`);
        }
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  return {
    createStore,
    createAsyncAction,
    createErrorBoundary,
    registerErrorHandler,
    handleError,
    retry,
    createQueue,
    createLogger,
    createEventBus,
    validateData,
  };
})();
