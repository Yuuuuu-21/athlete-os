/* ==========================================================
   plan.js — what is on the calendar for a given day.

   The weekly plan lives in settings (weekday -> workout id).
   A one-off change made on HOME is stored as a day override so
   swapping today's session never rewrites the weekly plan.
   ========================================================== */

(function (global) {
  const AOS = global.AOS = global.AOS || {};
  const dates = AOS.dates;

  function settings() { return AOS.store.settings(); }

  function forDate(dateKey) {
    const s = settings();
    const override = (s.dayOverrides || {})[dateKey];
    if (override) return override;
    return (s.planDays || {})[dates.weekday(dateKey)] || 'REST';
  }

  function setForDate(dateKey, workoutId) {
    return AOS.store.setDayOverride(dateKey, workoutId);
  }

  function week(startKey) {
    return dates.weekKeys(startKey).map((dateKey) => ({
      dateKey,
      workoutId: forDate(dateKey),
      dow: dates.weekday(dateKey)
    }));
  }

  // Countdown to the next volleyball session — the reason all the
  // other training exists, so it gets its own strip on HOME.
  function volleyball(fromKey) {
    const s = settings();
    const from = fromKey || dates.today();
    const dow = Number(s.volleyballDow);
    const days = dates.daysUntilWeekday(dow, from);
    const dateKey = dates.addDays(from, days);

    return {
      dow,
      days,
      dateKey,
      weekdayJP: dates.WD_JP[dow],
      isToday: days === 0,
      label: days === 0 ? '今日' : `あと ${days} 日`,
      when: days === 0 ? dates.formatJP(dateKey) : `${dates.WD_JP[dow]}曜 · ${dates.formatShort(dateKey)}`
    };
  }

  // Days since the last planned training day, used to nudge on HOME.
  function plannedTrainingDaysThisWeek(startKey) {
    return week(startKey).filter((d) => AOS.workouts.get(d.workoutId).trainable).length;
  }

  AOS.plan = { forDate, setForDate, week, volleyball, plannedTrainingDaysThisWeek };
})(window);
