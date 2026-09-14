/* ==========================================================
   sessions.js — training session records.

   A session is created when you press START and updated in place
   as sets are logged, so closing the app mid-workout loses
   nothing. Previous values are carried forward and nudged up when
   the last session was completed clean — that progression is the
   difference between "recording" and "training".
   ========================================================== */

(function (global) {
  const AOS = global.AOS = global.AOS || {};
  const db = AOS.db;
  const dates = AOS.dates;

  const STORE = 'trainingSessions';

  function all() {
    return db.getAll(STORE);
  }

  function sortNewestFirst(sessions) {
    return sessions.slice().sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return String(b.startedAt || '').localeCompare(String(a.startedAt || ''));
    });
  }

  function findInProgress() {
    return all().then((rows) => sortNewestFirst(rows).find((s) => s.status === 'in_progress') || null);
  }

  function forDate(dateKey) {
    return all().then((rows) => sortNewestFirst(rows.filter((s) => s.date === dateKey)));
  }

  function history(limit) {
    return all().then((rows) => {
      const done = sortNewestFirst(rows.filter((s) => s.status !== 'in_progress'));
      return limit ? done.slice(0, limit) : done;
    });
  }

  function lastFor(workoutId, excludeId) {
    return all().then((rows) => sortNewestFirst(
      rows.filter((s) => s.workoutType === workoutId && s.id !== excludeId && s.status !== 'in_progress')
    )[0] || null);
  }

  // ---------- building a new session ----------

  function roundTo(value, step) {
    return Math.round(value / step) * step;
  }

  // Lower body tolerates a bigger jump than pressing and pulling
  // does; 5 kg on a 60 kg bench is a missed session waiting to happen.
  function stepFor(weight, type) {
    return type === 'lower' && weight >= 60 ? 5 : 2.5;
  }

  function metricOf(exercise) {
    return exercise.metric || 'weight_reps';
  }

  // Did the previous session hit every prescribed rep? Then the
  // next one starts a notch heavier.
  function clearedLastTime(previous) {
    if (!previous || !previous.sets || !previous.sets.length) return false;
    const target = Number(previous.targetReps) || 0;
    return previous.sets.every((set) => set.completed && (!target || Number(set.reps) >= target));
  }

  function seedSet(exercise, setIndex, previous, loadFactor) {
    const metric = metricOf(exercise);
    const set = { setNumber: setIndex + 1, completed: false };

    if (metric === 'time') {
      set.seconds = exercise.seconds;
      return set;
    }

    const prevSet = previous && previous.sets.length
      ? (previous.sets[setIndex] || previous.sets[previous.sets.length - 1])
      : null;

    set.reps = prevSet && prevSet.reps !== '' && prevSet.reps !== undefined ? prevSet.reps : exercise.reps;

    if (metric === 'weight_reps') {
      let weight = prevSet ? Number(prevSet.weight) || 0 : 0;
      if (weight > 0) {
        if (clearedLastTime(previous)) weight += stepFor(weight, exercise.type);
        weight = roundTo(weight * (loadFactor || 1), 2.5);
      }
      set.weight = weight > 0 ? weight : '';
    }
    return set;
  }

  function build(dateKey, workoutId, prescribed, lastSession, adjust) {
    const loadFactor = (adjust && adjust.loadFactor) || 1;

    const exercises = prescribed.map((exercise) => {
      const previous = lastSession
        ? (lastSession.exercises || []).find((e) => e.exerciseId === exercise.id)
        : null;

      const sets = [];
      for (let i = 0; i < exercise.sets; i++) sets.push(seedSet(exercise, i, previous, loadFactor));

      return {
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        metric: metricOf(exercise),
        type: exercise.type,
        cue: exercise.cue || '',
        targetReps: exercise.reps || null,
        targetSeconds: exercise.seconds || null,
        sets
      };
    });

    return {
      date: dateKey,
      workoutType: workoutId,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      status: 'in_progress',
      readinessScore: adjust ? adjust.score : null,
      loadFactor,
      exercises
    };
  }

  // ---------- writing ----------

  function save(session) {
    return db.put(STORE, session);
  }

  function finish(session) {
    const total = countSets(session);
    session.status = total.done === 0 ? 'skipped' : (total.done >= total.total ? 'completed' : 'partial');
    session.finishedAt = new Date().toISOString();
    return save(session).then((saved) => {
      AOS.store.changed('training');
      return saved;
    });
  }

  function discard(session) {
    if (!session || session.id === undefined) return Promise.resolve();
    return db.remove(STORE, session.id).then(() => AOS.store.changed('training'));
  }

  // ---------- derived ----------

  function countSets(session) {
    let done = 0;
    let total = 0;
    (session.exercises || []).forEach((ex) => {
      ex.sets.forEach((set) => {
        total += 1;
        if (set.completed) done += 1;
      });
    });
    return { done, total };
  }

  // Tonnage in kg. Bodyweight and timed work contribute nothing
  // here on purpose — this number is for comparing loaded lifts.
  function volume(session) {
    let sum = 0;
    (session.exercises || []).forEach((ex) => {
      if ((ex.metric || 'weight_reps') !== 'weight_reps') return;
      ex.sets.forEach((set) => {
        if (set.completed) sum += (Number(set.weight) || 0) * (Number(set.reps) || 0);
      });
    });
    return Math.round(sum);
  }

  function topSet(exercise) {
    let best = null;
    (exercise.sets || []).forEach((set) => {
      if (!set.completed) return;
      const weight = Number(set.weight) || 0;
      if (!best || weight > (Number(best.weight) || 0)) best = set;
    });
    return best;
  }

  function summaryLine(session) {
    const counts = countSets(session);
    const parts = [`${counts.done}/${counts.total} セット`];
    const vol = volume(session);
    if (vol > 0) parts.push(`${vol.toLocaleString()} kg`);
    return parts.join(' · ');
  }

  function statusLabel(status) {
    return { completed: '完了', partial: '一部', skipped: '中止', in_progress: '進行中' }[status] || status;
  }

  function relativeDate(session) {
    return dates.relativeJP(session.date);
  }

  AOS.sessions = {
    STORE, all, findInProgress, forDate, history, lastFor,
    build, save, finish, discard,
    countSets, volume, topSet, summaryLine, statusLabel, relativeDate, metricOf
  };
})(window);
