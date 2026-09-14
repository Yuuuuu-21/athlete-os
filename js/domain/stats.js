/* ==========================================================
   stats.js — everything derived from the logs: series for the
   charts, the weekly rollup behind REVIEW, and the performance
   tests that say whether "becoming an athlete" is actually
   happening.

   Body-log read/write lives here too, because weight, water and
   the weight trend are all the same record and both BODY and
   FOOD need it.
   ========================================================== */

(function (global) {
  const AOS = global.AOS = global.AOS || {};
  const db = AOS.db;
  const dates = AOS.dates;

  // ---------- performance tests ----------

  const TESTS = [
    { id: 'vertical', name: '垂直跳び', unit: 'cm', better: 'high', hint: '助走なし。両足で最大跳躍' },
    { id: 'reach', name: '最高到達点', unit: 'cm', better: 'high', hint: '助走ありのスパイク到達点' },
    { id: 'broad', name: '立ち幅跳び', unit: 'cm', better: 'high', hint: '水平方向のパワー' },
    { id: 'sprint20', name: '20m スプリント', unit: '秒', better: 'low', hint: '短い距離の加速' },
    { id: 'squat1rm', name: 'スクワット 推定1RM', unit: 'kg', better: 'high', hint: '下半身の最大筋力' }
  ];

  function testDef(testId) {
    return TESTS.find((t) => t.id === testId) || null;
  }

  function isBetter(testId, value, than) {
    const def = testDef(testId);
    if (than === null || than === undefined || than === '') return true;
    return def && def.better === 'low' ? Number(value) < Number(than) : Number(value) > Number(than);
  }

  function loadTests() {
    return db.getAll('performanceTests').then((rows) => rows.slice().sort((a, b) => (a.date < b.date ? 1 : -1)));
  }

  // latest + personal best per test id
  function testSummary(rows) {
    const summary = {};
    TESTS.forEach((def) => { summary[def.id] = { latest: null, best: null, series: [] }; });

    rows.slice().sort((a, b) => (a.date < b.date ? -1 : 1)).forEach((row) => {
      const entry = summary[row.testId];
      if (!entry) return;
      entry.series.push({ date: row.date, value: Number(row.value) });
      entry.latest = row;
      if (!entry.best || isBetter(row.testId, row.value, entry.best.value)) entry.best = row;
    });
    return summary;
  }

  function addTest(dateKey, testId, value) {
    return db.put('performanceTests', { date: dateKey, testId, value: Number(value) })
      .then((row) => { AOS.store.changed('tests'); return row; });
  }

  function removeTest(id) {
    return db.remove('performanceTests', id).then(() => AOS.store.changed('tests'));
  }

  // ---------- body log ----------

  function allBodyLogs() {
    return db.getAll('bodyLogs');
  }

  function bodyLogFor(dateKey) {
    return allBodyLogs().then((rows) => rows.filter((r) => r.date === dateKey).pop() || null);
  }

  function saveBodyLog(dateKey, patch) {
    return bodyLogFor(dateKey).then((existing) => {
      const record = Object.assign({ date: dateKey }, existing, patch);
      return db.put('bodyLogs', record);
    }).then((record) => {
      AOS.store.changed('body');
      return record;
    });
  }

  // One value per day, oldest first, gaps left out so the line
  // chart connects real measurements instead of inventing zeroes.
  function weightSeries(rows, dayKeys) {
    const byDate = {};
    rows.forEach((r) => {
      if (r.weight === '' || r.weight === null || r.weight === undefined) return;
      byDate[r.date] = Number(r.weight);
    });
    return dayKeys
      .map((dateKey) => ({ date: dateKey, value: byDate[dateKey] }))
      .filter((point) => point.value !== undefined);
  }

  function latestWeight(rows) {
    const withWeight = rows
      .filter((r) => r.weight !== '' && r.weight !== null && r.weight !== undefined)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    return withWeight[0] || null;
  }

  // Simple trailing average — day-to-day weight is mostly water.
  function movingAverage(series, window) {
    return series.map((point, i) => {
      const slice = series.slice(Math.max(0, i - window + 1), i + 1);
      const sum = slice.reduce((acc, p) => acc + p.value, 0);
      return { date: point.date, value: sum / slice.length };
    });
  }

  // ---------- condition ----------

  function readinessSeries(conditionRows, dayKeys) {
    const byDate = {};
    conditionRows.forEach((r) => { byDate[r.date] = Number(r.readinessScore); });
    return dayKeys
      .map((dateKey) => ({ date: dateKey, value: byDate[dateKey] }))
      .filter((p) => p.value !== undefined && !Number.isNaN(p.value));
  }

  // ---------- weekly rollup ----------

  function weekSummary(startKey) {
    const dayKeys = dates.weekKeys(startKey);

    return Promise.all([
      AOS.sessions.all(),
      db.getAll('conditionLogs'),
      allBodyLogs(),
      db.getAll('mealLogs'),
      db.getAll('volleyballLogs')
    ]).then(([sessions, conditions, bodyLogs, meals, vbLogs]) => {
      const inWeek = (row) => dayKeys.indexOf(row.date) >= 0;

      const weekSessions = sessions.filter((s) => inWeek(s) && s.status !== 'in_progress');
      const weekConditions = conditions.filter(inWeek);
      const weekBody = bodyLogs.filter(inWeek);
      const weekMeals = meals.filter(inWeek);
      const weekVb = vbLogs.filter(inWeek);

      const planned = dayKeys
        .map((dateKey) => ({ dateKey, workoutId: AOS.plan.forDate(dateKey) }))
        .filter((d) => AOS.workouts.get(d.workoutId).trainable);

      const volume = weekSessions.reduce((sum, s) => sum + AOS.sessions.volume(s), 0);
      const setsDone = weekSessions.reduce((sum, s) => sum + AOS.sessions.countSets(s).done, 0);

      const readiness = weekConditions.map((c) => Number(c.readinessScore)).filter((n) => !Number.isNaN(n));
      const avgReadiness = readiness.length
        ? readiness.reduce((a, b) => a + b, 0) / readiness.length
        : null;

      const weights = weightSeries(weekBody, dayKeys);
      const weightChange = weights.length > 1 ? weights[weights.length - 1].value - weights[0].value : null;

      const target = AOS.nutrition.proteinTarget(latestWeight(bodyLogs) ? Number(latestWeight(bodyLogs).weight) : null);
      const proteinByDay = {};
      weekMeals.forEach((m) => {
        proteinByDay[m.date] = (proteinByDay[m.date] || 0) + (Number(m.protein) || 0);
      });
      const proteinDaysHit = target
        ? Object.keys(proteinByDay).filter((k) => proteinByDay[k] >= target).length
        : 0;

      const days = dayKeys.map((dateKey) => {
        const workoutId = AOS.plan.forDate(dateKey);
        const session = weekSessions.find((s) => s.date === dateKey) || null;
        return {
          dateKey,
          workoutId,
          dow: dates.weekday(dateKey),
          trainable: AOS.workouts.get(workoutId).trainable,
          isVolleyball: workoutId === 'VOLLEYBALL',
          done: !!session,
          session,
          isToday: dateKey === dates.today(),
          isFuture: dateKey > dates.today()
        };
      });

      return {
        startKey,
        dayKeys,
        days,
        sessionsDone: weekSessions.length,
        sessionsPlanned: planned.length,
        setsDone,
        volume,
        avgReadiness,
        weightChange,
        weights,
        proteinDaysHit,
        proteinTarget: target,
        volleyball: weekVb
      };
    });
  }

  // Consecutive days ending today with at least a condition entry.
  function streak(conditionRows) {
    const logged = {};
    conditionRows.forEach((r) => { logged[r.date] = true; });
    let count = 0;
    let cursor = dates.today();
    // Today not being logged yet shouldn't zero out a real streak.
    if (!logged[cursor]) cursor = dates.addDays(cursor, -1);
    while (logged[cursor]) {
      count += 1;
      cursor = dates.addDays(cursor, -1);
    }
    return count;
  }

  AOS.stats = {
    TESTS, testDef, isBetter, loadTests, testSummary, addTest, removeTest,
    allBodyLogs, bodyLogFor, saveBodyLog, weightSeries, latestWeight, movingAverage,
    readinessSeries, weekSummary, streak
  };
})(window);
