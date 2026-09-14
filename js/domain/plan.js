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

  function scheduledDates() {
    return (settings().volleyballDates || []).slice().sort();
  }

  function isScheduled(dateKey) {
    return scheduledDates().indexOf(dateKey) >= 0;
  }

  // A one-off change for the day beats everything; after that an
  // explicitly scheduled match or practice beats the weekly pattern.
  function forDate(dateKey) {
    const s = settings();
    const override = (s.dayOverrides || {})[dateKey];
    if (override) return override;
    if (isScheduled(dateKey)) return 'VOLLEYBALL';
    return (s.planDays || {})[dates.weekday(dateKey)] || 'REST';
  }

  function setForDate(dateKey, workoutId) {
    return AOS.store.setDayOverride(dateKey, workoutId);
  }

  // ---------- the volleyball calendar ----------

  // Dates older than this are dropped: they stay visible in REVIEW
  // through volleyballLogs, not through the schedule.
  const KEEP_PAST_DAYS = 120;

  function saveDates(list) {
    const cutoff = dates.addDays(dates.today(), -KEEP_PAST_DAYS);
    const unique = Array.from(new Set(list.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= cutoff)));
    return AOS.store.update({ volleyballDates: unique.sort() });
  }

  function addDate(dateKey) {
    return saveDates(scheduledDates().concat([dateKey]));
  }

  function removeDate(dateKey) {
    return saveDates(scheduledDates().filter((d) => d !== dateKey));
  }

  function upcomingDates(fromKey, limit) {
    const from = fromKey || dates.today();
    const list = scheduledDates().filter((d) => d >= from);
    return limit ? list.slice(0, limit) : list;
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
  // Whichever comes first wins: an entered date, or the weekly day.
  // Returns null when neither is set.
  function volleyball(fromKey) {
    const s = settings();
    const from = fromKey || dates.today();

    const next = upcomingDates(from, 1)[0] || null;
    const dow = Number(s.volleyballDow);

    let dateKey = next;
    let fromSchedule = !!next;

    if (dow >= 0) {
      const weekly = dates.addDays(from, dates.daysUntilWeekday(dow, from));
      if (!dateKey || weekly < dateKey) {
        dateKey = weekly;
        fromSchedule = false;
      }
    }

    if (!dateKey) return null;

    const days = dates.diffDays(from, dateKey);
    const weekday = dates.weekday(dateKey);

    return {
      dow: weekday,
      days,
      dateKey,
      fromSchedule,
      weekdayJP: dates.WD_JP[weekday],
      isToday: days === 0,
      label: days === 0 ? '今日' : `あと ${days} 日`,
      when: days === 0
        ? dates.formatJP(dateKey)
        : `${dates.WD_JP[weekday]}曜 · ${dates.formatShort(dateKey)}`
    };
  }

  // Days since the last planned training day, used to nudge on HOME.
  function plannedTrainingDaysThisWeek(startKey) {
    return week(startKey).filter((d) => AOS.workouts.get(d.workoutId).trainable).length;
  }

  AOS.plan = {
    forDate, setForDate, week, volleyball, plannedTrainingDaysThisWeek,
    scheduledDates, upcomingDates, isScheduled, addDate, removeDate
  };
})(window);
