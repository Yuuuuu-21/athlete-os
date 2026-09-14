/* ==========================================================
   store.js — settings record + a minimal event bus.

   Screens never poll each other: they write through here and
   listen for 'data' so, for example, rating your legs on BODY
   updates the readiness ring on HOME the next time it shows.
   ========================================================== */

(function (global) {
  const AOS = global.AOS = global.AOS || {};
  const db = AOS.db;
  const dates = AOS.dates;

  const DEFAULTS = {
    key: 'app',
    name: '',
    heightCm: 175,
    goalWeightKg: '',
    proteinPerKg: 1.8,
    waterGoal: 8,
    volleyballDow: 6,          // 0=Sun … 6=Sat
    duration: 60,              // 30 | 60 minutes
    restSeconds: 90,
    theme: 'system',           // system | light | dark
    // Weekly plan: weekday -> workout id
    planDays: { 0: 'REST', 1: 'A', 2: 'REST', 3: 'B', 4: 'REST', 5: 'C', 6: 'VOLLEYBALL' },
    // One-off "today I'm doing something else" choices, dateKey -> workout id
    dayOverrides: {}
  };

  const state = { settings: Object.assign({}, DEFAULTS) };

  // ---------- event bus ----------

  const listeners = {};

  function on(event, fn) {
    (listeners[event] = listeners[event] || []).push(fn);
    return () => off(event, fn);
  }

  function off(event, fn) {
    listeners[event] = (listeners[event] || []).filter((f) => f !== fn);
  }

  function emit(event, payload) {
    (listeners[event] || []).forEach((fn) => {
      try { fn(payload); } catch (err) { console.error(err); }
    });
  }

  // ---------- settings ----------

  // Ver1 wrote { selectedWorkout, selectedDuration, volleyballDay:'Saturday' }.
  // Fold those into the current shape so an existing install keeps
  // its choices instead of silently resetting to the defaults.
  function migrate(record) {
    const next = Object.assign({}, DEFAULTS, record);
    next.planDays = Object.assign({}, DEFAULTS.planDays, record.planDays);
    next.dayOverrides = Object.assign({}, record.dayOverrides);

    if (record.selectedDuration && !record.duration) next.duration = record.selectedDuration;
    if (record.volleyballDay && record.volleyballDow === undefined) {
      const dow = dates.WD_FULL.indexOf(record.volleyballDay);
      if (dow >= 0) {
        next.volleyballDow = dow;
        next.planDays[dow] = 'VOLLEYBALL';
      }
    }
    delete next.selectedDuration;
    delete next.selectedWorkout;
    delete next.volleyballDay;
    return next;
  }

  function load() {
    return db.get('settings', 'app').then((record) => {
      state.settings = record ? migrate(record) : Object.assign({}, DEFAULTS);
      applyTheme();
      return state.settings;
    });
  }

  function settings() { return state.settings; }

  function update(patch) {
    Object.assign(state.settings, patch);
    applyTheme();
    return db.put('settings', state.settings).then(() => {
      emit('settings', state.settings);
      emit('data', { source: 'settings' });
      return state.settings;
    });
  }

  // Keep the override map from growing forever — anything older
  // than a week is history, and history lives in trainingSessions.
  function setDayOverride(dateKey, workoutId) {
    const overrides = {};
    const cutoff = dates.addDays(dates.today(), -7);
    Object.keys(state.settings.dayOverrides || {}).forEach((k) => {
      if (k >= cutoff) overrides[k] = state.settings.dayOverrides[k];
    });
    overrides[dateKey] = workoutId;
    return update({ dayOverrides: overrides });
  }

  // ---------- theme ----------

  function applyTheme() {
    const theme = state.settings.theme;
    const root = document.documentElement;
    if (theme === 'light' || theme === 'dark') root.setAttribute('data-theme', theme);
    else root.removeAttribute('data-theme');
  }

  // Any screen that writes a record calls this so the rest of the
  // app can refresh from a single place.
  function changed(source) {
    emit('data', { source });
  }

  AOS.store = { DEFAULTS, load, settings, update, setDayOverride, applyTheme, on, off, emit, changed };
})(window);
