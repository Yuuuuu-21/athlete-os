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
    volleyballDow: 6,          // 0=Sun … 6=Sat, -1 = no recurring day
    volleyballDates: [],       // explicit "YYYY-MM-DD" practices and matches
    duration: 60,              // 30 | 60 minutes
    restSeconds: 90,
    theme: 'system',           // system | light | dark
    // Weekly plan: weekday -> workout id
    planDays: { 0: 'REST', 1: 'A', 2: 'REST', 3: 'B', 4: 'REST', 5: 'C', 6: 'VOLLEYBALL' },
    // One-off "today I'm doing something else" choices, dateKey -> workout id
    dayOverrides: {},
    // Nudges the user has waved away, "<weekStart>:<workoutId>" -> true
    dismissed: {}
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
    next.volleyballDates = Array.isArray(record.volleyballDates) ? record.volleyballDates.slice() : [];
    next.dismissed = Object.assign({}, record.dismissed);

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

  // Keep the override map from growing forever. The window is wide
  // enough to backfill a few weeks, and the day being set is always
  // kept — a backfilled date older than the cutoff used to be pruned
  // in the same write that created it.
  function setDayOverride(dateKey, workoutId) {
    const overrides = {};
    const cutoff = dates.addDays(dates.today(), -60);
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

  // ---------- the day being recorded ----------
  // HOME, FOOD, BODY and TRAINING all record against this date, so
  // yesterday's meals or a weight you forgot can be filled in later.
  // It lives in memory only: reopening the app always lands on today,
  // which keeps a morning entry from quietly going into a past day.

  let viewDate = null;   // null = today

  function currentViewDate() {
    const today = dates.today();
    if (!viewDate || viewDate >= today) return today;
    return viewDate;
  }

  function setViewDate(dateKey) {
    const today = dates.today();
    // The future can't be recorded yet.
    viewDate = !dateKey || dateKey >= today ? null : dateKey;
    emit('viewdate', currentViewDate());
    return currentViewDate();
  }

  function isViewingPast() {
    return currentViewDate() !== dates.today();
  }

  AOS.store = {
    DEFAULTS, load, settings, update, setDayOverride, applyTheme, on, off, emit, changed,
    viewDate: currentViewDate, setViewDate, isViewingPast
  };
})(window);
