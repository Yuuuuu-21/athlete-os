/* ==========================================================
   db.js — IndexedDB access layer.

   The database name, store names and key paths are unchanged
   from Ver1 on purpose: everything already logged (condition,
   body weight, training sessions) keeps working. Version 2
   only adds `date` indexes to the date-bearing stores.

   If IndexedDB is unavailable (some file:// and private-mode
   contexts), a localStorage-backed store with the same API
   takes over so the app still runs instead of dying at boot.
   ========================================================== */

(function (global) {
  const AOS = global.AOS = global.AOS || {};

  const DB_NAME = 'athlete-os';
  const DB_VERSION = 2;

  const SCHEMA = {
    conditionLogs:    { keyPath: 'date' },
    settings:         { keyPath: 'key' },
    trainingSessions: { keyPath: 'id', autoIncrement: true, indexes: ['date'] },
    workoutTemplates: { keyPath: 'id', autoIncrement: true },
    bodyLogs:         { keyPath: 'id', autoIncrement: true, indexes: ['date'] },
    performanceTests: { keyPath: 'id', autoIncrement: true, indexes: ['date'] },
    mealLogs:         { keyPath: 'id', autoIncrement: true, indexes: ['date'] },
    volleyballLogs:   { keyPath: 'id', autoIncrement: true, indexes: ['date'] }
  };

  const STORE_NAMES = Object.keys(SCHEMA);

  let backend = null;
  let openPromise = null;

  // ---------- IndexedDB backend ----------

  function upgrade(db, transaction) {
    STORE_NAMES.forEach((name) => {
      const def = SCHEMA[name];
      const store = db.objectStoreNames.contains(name)
        ? transaction.objectStore(name)
        : db.createObjectStore(name, { keyPath: def.keyPath, autoIncrement: !!def.autoIncrement });

      (def.indexes || []).forEach((field) => {
        if (!store.indexNames.contains(field)) store.createIndex(field, field, { unique: false });
      });
    });
  }

  function openIndexedDB() {
    return new Promise((resolve, reject) => {
      if (!global.indexedDB) return reject(new Error('IndexedDB unavailable'));

      let request;
      try {
        request = global.indexedDB.open(DB_NAME, DB_VERSION);
      } catch (err) {
        return reject(err);
      }

      request.onupgradeneeded = (event) => upgrade(event.target.result, event.target.transaction);
      request.onsuccess = (event) => resolve(idbBackend(event.target.result));
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('IndexedDB upgrade blocked by another tab'));
    });
  }

  function idbBackend(db) {
    function run(storeName, mode, fn) {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const request = fn(tx.objectStore(storeName));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }

    return {
      get: (store, key) => run(store, 'readonly', (s) => s.get(key)).then((v) => v || null),
      getAll: (store) => run(store, 'readonly', (s) => s.getAll()).then((v) => v || []),
      put(store, value) {
        return run(store, 'readwrite', (s) => s.put(value)).then((key) => {
          if (SCHEMA[store].autoIncrement && value.id === undefined) value.id = key;
          return value;
        });
      },
      remove: (store, key) => run(store, 'readwrite', (s) => s.delete(key)).then(() => true),
      clear: (store) => run(store, 'readwrite', (s) => s.clear()).then(() => true)
    };
  }

  // ---------- localStorage fallback ----------

  function memoryBackend() {
    const PREFIX = 'athlete-os:';
    const cache = {};

    function load(store) {
      if (cache[store]) return cache[store];
      let rows = [];
      try {
        rows = JSON.parse(global.localStorage.getItem(PREFIX + store) || '[]');
      } catch (err) {
        rows = [];
      }
      cache[store] = Array.isArray(rows) ? rows : [];
      return cache[store];
    }

    function persist(store) {
      try {
        global.localStorage.setItem(PREFIX + store, JSON.stringify(cache[store]));
      } catch (err) {
        /* quota or disabled storage — keep the in-memory copy */
      }
    }

    function keyOf(store, row) { return row[SCHEMA[store].keyPath]; }

    return {
      get: (store, key) => Promise.resolve(load(store).find((r) => keyOf(store, r) === key) || null),
      getAll: (store) => Promise.resolve(load(store).slice()),
      put(store, value) {
        const rows = load(store);
        if (SCHEMA[store].autoIncrement && value.id === undefined) {
          value.id = rows.reduce((max, r) => Math.max(max, r.id || 0), 0) + 1;
        }
        const index = rows.findIndex((r) => keyOf(store, r) === keyOf(store, value));
        if (index >= 0) rows[index] = value; else rows.push(value);
        persist(store);
        return Promise.resolve(value);
      },
      remove(store, key) {
        cache[store] = load(store).filter((r) => keyOf(store, r) !== key);
        persist(store);
        return Promise.resolve(true);
      },
      clear(store) {
        cache[store] = [];
        persist(store);
        return Promise.resolve(true);
      }
    };
  }

  // ---------- public API ----------

  function init() {
    if (openPromise) return openPromise;
    openPromise = openIndexedDB()
      .then((be) => { backend = be; return be; })
      .catch((err) => {
        console.warn('IndexedDB unavailable, falling back to localStorage:', err && err.message);
        backend = memoryBackend();
        return backend;
      });
    return openPromise;
  }

  function ready() {
    return backend ? Promise.resolve(backend) : init();
  }

  function get(store, key) { return ready().then((be) => be.get(store, key)); }
  function getAll(store) { return ready().then((be) => be.getAll(store)); }
  function put(store, value) { return ready().then((be) => be.put(store, value)); }
  function remove(store, key) { return ready().then((be) => be.remove(store, key)); }
  function clear(store) { return ready().then((be) => be.clear(store)); }

  // Rows for one day, newest stores first. Used everywhere a
  // screen asks "what happened today?".
  function byDate(store, dateKey) {
    return getAll(store).then((rows) => rows.filter((r) => r.date === dateKey));
  }

  function exportAll() {
    return Promise.all(STORE_NAMES.map((name) => getAll(name)))
      .then((results) => {
        const data = {};
        STORE_NAMES.forEach((name, i) => { data[name] = results[i]; });
        return { app: 'athlete-os', version: DB_VERSION, exportedAt: new Date().toISOString(), data };
      });
  }

  function importAll(payload, { replace = true } = {}) {
    const data = (payload && payload.data) || {};
    const names = STORE_NAMES.filter((name) => Array.isArray(data[name]));
    if (!names.length) return Promise.reject(new Error('読み込めるデータがありません'));

    return names.reduce(
      (chain, name) => chain
        .then(() => (replace ? clear(name) : null))
        .then(() => data[name].reduce((inner, row) => inner.then(() => put(name, row)), Promise.resolve())),
      Promise.resolve()
    ).then(() => names.length);
  }

  function wipe() {
    return STORE_NAMES.reduce((chain, name) => chain.then(() => clear(name)), Promise.resolve());
  }

  AOS.db = {
    STORE_NAMES, init, get, getAll, put, remove, clear, byDate,
    exportAll, importAll, wipe
  };
})(window);
