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

  // ---------- nudges ----------
  // The app never rewrites the week on its own. A match dropped into
  // the middle of it simply takes that day, and these helpers let HOME
  // point out the consequences so the decision stays with the user.

  // The weekly pattern before scheduled matches and one-off changes.
  function baseWorkoutFor(dateKey) {
    return (settings().planDays || {})[dates.weekday(dateKey)] || 'REST';
  }

  // How much of tomorrow's jump this session is likely to spend.
  function legLoad(workoutId) {
    const workout = AOS.workouts.get(workoutId);
    if (!workout.exercises) return 'low';
    if (workout.exercises.some((e) => e.type === 'lower')) return 'high';
    if (workout.exercises.some((e) => e.type === 'jump')) return 'medium';
    return 'low';
  }

  // Workouts this week's plan asked for that haven't happened yet, by
  // the time they should have. Doing B on Thursday instead of Wednesday
  // counts as done — the point is the session, not the slot.
  function missedThisWeek(sessions, fromKey) {
    const today = fromKey || dates.today();
    const weekStart = dates.startOfWeek(today);

    const doneTypes = {};
    (sessions || []).forEach((session) => {
      if (session.status !== 'completed' && session.status !== 'partial') return;
      if (session.date < weekStart || session.date > dates.addDays(weekStart, 6)) return;
      doneTypes[session.workoutType] = true;
    });

    const missed = [];
    dates.weekKeys(weekStart).forEach((dateKey) => {
      // Today still has a whole day left, and HOME already shows a
      // start button for it. Only days that have passed can be missed.
      if (dateKey >= today) return;
      const base = baseWorkoutFor(dateKey);
      if (!AOS.workouts.get(base).trainable) return;
      if (doneTypes[base]) return;
      if (missed.some((m) => m.workoutId === base)) return;
      // Displaced by a match, or simply not done.
      missed.push({ workoutId: base, plannedFor: dateKey, displaced: forDate(dateKey) !== base });
    });
    return missed;
  }

  // Remaining days this week with nothing scheduled on them.
  function freeDaysAhead(fromKey) {
    const today = fromKey || dates.today();
    const weekStart = dates.startOfWeek(today);
    return dates.weekKeys(weekStart)
      .filter((dateKey) => dateKey >= today && !AOS.workouts.get(forDate(dateKey)).trainable && forDate(dateKey) !== 'VOLLEYBALL')
      .map((dateKey) => ({ dateKey, dow: dates.weekday(dateKey) }));
  }

  // Dismissals last only for the week they belong to.
  function suggestionKey(workoutId, fromKey) {
    return `${dates.startOfWeek(fromKey || dates.today())}:${workoutId}`;
  }

  function isDismissed(workoutId, fromKey) {
    return !!(settings().dismissed || {})[suggestionKey(workoutId, fromKey)];
  }

  function dismissSuggestion(workoutId, fromKey) {
    const weekStart = dates.startOfWeek(fromKey || dates.today());
    const kept = {};
    const current = settings().dismissed || {};
    Object.keys(current).forEach((key) => {
      if (key.indexOf(weekStart) === 0) kept[key] = current[key];
    });
    kept[suggestionKey(workoutId, fromKey)] = true;
    return AOS.store.update({ dismissed: kept });
  }

  AOS.plan = {
    forDate, setForDate, week, volleyball, plannedTrainingDaysThisWeek,
    scheduledDates, upcomingDates, isScheduled, addDate, removeDate,
    baseWorkoutFor, legLoad, missedThisWeek, freeDaysAhead,
    isDismissed, dismissSuggestion
  };
})(window);
