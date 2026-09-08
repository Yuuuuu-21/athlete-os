/* ==========================================================
   db.js — thin IndexedDB wrapper
   Ver1 stores: conditionLogs, settings
   Future stores are created now (empty) so later versions can
   start writing to them without a schema migration.
   ========================================================== */

(function (global) {
  const DB_NAME = 'athlete-os';
  const DB_VERSION = 1;

  const FUTURE_STORES = [
    'trainingSessions',   // TRAINING
    'workoutTemplates',   // TRAINING
    'bodyLogs',           // BODY
    'performanceTests',   // BODY
    'mealLogs',           // FOOD
    'volleyballLogs'      // REVIEW
  ];

  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains('conditionLogs')) {
          db.createObjectStore('conditionLogs', { keyPath: 'date' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
        FUTURE_STORES.forEach((name) => {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name, { keyPath: 'id', autoIncrement: true });
          }
        });
      };

      request.onsuccess = (event) => resolve(event.target.result);
      request.onerror = (event) => reject(event.target.error);
    });

    return dbPromise;
  }

  function get(storeName, key) {
    return openDB().then((db) => new Promise((resolve, reject) => {
      const req = db.transaction(storeName, 'readonly').objectStore(storeName).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    }));
  }

  function put(storeName, value) {
    return openDB().then((db) => new Promise((resolve, reject) => {
      const req = db.transaction(storeName, 'readwrite').objectStore(storeName).put(value);
      req.onsuccess = () => resolve(value);
      req.onerror = () => reject(req.error);
    }));
  }

  function getAll(storeName) {
    return openDB().then((db) => new Promise((resolve, reject) => {
      const req = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    }));
  }

  global.AthleteDB = { init: openDB, get, put, getAll };
})(window);
