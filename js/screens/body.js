/* ==========================================================
   body.js — body weight, the performance tests that say whether
   "becoming an athlete" is actually happening, and the same
   condition record HOME writes.
   ========================================================== */

(function (global) {
  const AOS = global.AOS = global.AOS || {};
  const { h, delegate, num, signed, parseNum, toast } = AOS.dom;
  const W = AOS.widgets;
  const dates = AOS.dates;

  const RANGES = [
    { value: 7, label: '7日' },
    { value: 30, label: '30日' },
    { value: 90, label: '90日' }
  ];

  const state = {
    dateKey: dates.today(),
    range: 30,
    testMode: 'flight',   // vertical jump: measured from slow-motion by default
    testFps: 240,
    bodyLogs: [],
    todayLog: null,
    weight: '',
    condition: Object.assign({}, AOS.condition.EMPTY),
    logged: false,
    tests: {},
    testRows: [],
    sessions: []
  };

  function settings() { return AOS.store.settings(); }

  // ---------- data ----------

  function load() {
    state.dateKey = dates.today();

    return Promise.all([
      AOS.stats.allBodyLogs(),
      AOS.condition.load(state.dateKey),
      AOS.stats.loadTests(),
      AOS.sessions.all()
    ]).then(([bodyLogs, condition, testRows, sessions]) => {
      state.sessions = sessions;
      state.bodyLogs = bodyLogs;
      state.todayLog = bodyLogs.filter((r) => r.date === state.dateKey).pop() || null;
      state.weight = state.todayLog && state.todayLog.weight !== undefined ? state.todayLog.weight : '';
      state.condition = { sleep: condition.sleep, energy: condition.energy, legs: condition.legs };
      state.logged = condition.complete;
      state.testRows = testRows;
      state.tests = AOS.stats.testSummary(testRows);
    });
  }

  // ---------- weight ----------

  function weightCard() {
    const series = AOS.stats.weightSeries(state.bodyLogs, dates.lastDays(state.range, state.dateKey));
    const latest = AOS.stats.latestWeight(state.bodyLogs);
    const shown = state.weight !== '' ? state.weight : (latest ? latest.weight : '');

    const week = AOS.stats.weightSeries(state.bodyLogs, dates.lastDays(7, state.dateKey));
    const weekAvg = week.length ? week.reduce((sum, p) => sum + p.value, 0) / week.length : null;
    const change = series.length > 1 ? series[series.length - 1].value - series[0].value : null;
    const goal = parseNum(settings().goalWeightKg);
    const toGoal = goal !== '' && shown !== '' ? Number(shown) - goal : null;

    return W.card({
      title: 'BODY WEIGHT',
      action: h`<span class="card-title">${state.todayLog && state.todayLog.weight ? '今日 記録済み' : '今日 未記録'}</span>`,
      body: h`
        <div class="weight-display">
          <span class="weight-num">${shown === '' ? '—' : num(shown)}</span>
          <span class="weight-unit">kg</span>
        </div>
        ${W.stepper({ name: 'weight', value: state.weight, unit: 'kg', step: 0.1, decimals: 1, placeholder: '体重', label: '体重' })}

        <div class="tiles" style="margin-top:14px">
          ${W.tile('7日平均', weekAvg === null ? '—' : num(weekAvg), null)}
          ${W.tile(`${state.range}日変化`, change === null ? '—' : signed(change), 'kg',
            change === null ? '' : (change < 0 ? 'delta-down' : 'delta-up'))}
          ${W.tile('目標まで', toGoal === null ? '—' : signed(toGoal), goal === '' ? '未設定' : `${num(goal)} kg`)}
        </div>

        <div style="margin-top:14px">
          ${W.segmented('range', RANGES, state.range)}
        </div>
        <div style="margin-top:10px">
          ${AOS.chart.line(series, { height: 118, title: '体重の推移', emptyText: '2日分たまるとグラフが出ます' })}
        </div>
      `
    });
  }

  // ---------- performance tests ----------

  function testRow(def) {
    const entry = state.tests[def.id] || { latest: null, best: null };
    const latest = entry.latest;
    const best = entry.best;
    const isPB = latest && best && latest.id === best.id;

    return h`
      <button class="row" data-test="${def.id}">
        <span class="row-main">
          <span class="row-title">${def.name}</span>
          <span class="row-sub">${latest ? `${dates.relativeJP(latest.date)}${isPB ? ' · 自己ベスト' : ''}` : def.hint}</span>
        </span>
        <span class="test-row-value">
          <span class="test-value">${latest ? `${num(latest.value)}` : '—'}<span class="test-pb"> ${def.unit}</span></span>
          <span class="test-pb">${best ? `PB ${num(best.value)}` : '記録なし'}</span>
        </span>
      </button>`;
  }

  // Derived from the training log with Epley's formula — no max
  // attempt, no equipment, no extra input.
  function estimatedRow(source) {
    const best = AOS.stats.estimated1RM(state.sessions, source.exerciseId);
    return h`
      <button class="row" data-derived="${source.exerciseId}">
        <span class="row-main">
          <span class="row-title">${source.label}</span>
          <span class="row-sub">${best ? `${dates.relativeJP(best.date)}の ${num(best.weight)}kg × ${best.reps} から計算` : '記録から自動で計算されます'}</span>
        </span>
        <span class="test-row-value">
          <span class="test-value">${best ? best.value : '—'}<span class="test-pb"> kg</span></span>
          <span class="test-pb">自動</span>
        </span>
      </button>`;
  }

  function testsCard() {
    return W.card({
      title: 'PERFORMANCE',
      action: h`<span class="card-title">月1で更新</span>`,
      body: h`
        <div>
          ${AOS.stats.TESTS.map(testRow)}
          ${AOS.stats.ONE_RM_SOURCES.map(estimatedRow)}
        </div>`
    });
  }

  function openTestSheet(testId) {
    const def = AOS.stats.testDef(testId);
    if (!def) return;
    const entry = state.tests[testId] || { latest: null, best: null, series: [] };
    const history = state.testRows.filter((r) => r.testId === testId).slice(0, 6);

    // Vertical jump is the one test people can't measure by eye, so it
    // gets a calculator: film it in slow motion, count the airborne
    // frames, and the height falls out of h = g*t^2/8.
    const flight = def.id === 'vertical';

    const el = AOS.sheet.open(def.name, h`
      ${flight ? h`
        <div style="margin-bottom:12px">
          ${W.segmented('mode', [
            { value: 'direct', label: 'cmを直接' },
            { value: 'flight', label: '滞空時間から' }
          ], state.testMode)}
        </div>` : ''}

      <div data-mode-direct ${flight && state.testMode === 'flight' ? AOS.dom.raw('hidden') : ''}>
        ${W.stepper({
          name: 'test',
          value: entry.latest ? entry.latest.value : '',
          unit: def.unit,
          step: def.better === 'low' ? 0.1 : 1,
          decimals: def.better === 'low' ? 2 : 1,
          label: def.name
        })}
      </div>

      ${flight ? h`
        <div data-mode-flight ${state.testMode === 'flight' ? '' : AOS.dom.raw('hidden')}>
          <div class="field">
            <span class="field-label">滞空しているコマ数</span>
            ${W.stepper({ name: 'frames', value: 120, step: 1, decimals: 0, label: 'コマ数' })}
          </div>
          <div class="field">
            <span class="field-label">撮影フレームレート</span>
            ${W.segmented('fps', [
              { value: 240, label: '240fps' },
              { value: 120, label: '120fps' },
              { value: 60, label: '60fps' }
            ], state.testFps)}
          </div>
          <p class="calc-result">滞空 <b data-flight-time>—</b> 秒 → <b data-flight-height>—</b> cm</p>
        </div>` : ''}

      <button class="btn" data-save-test style="margin-top:14px">${dates.formatJP(state.dateKey)} として記録</button>
      <p class="sheet-sub" style="margin-top:14px">${def.how}</p>
      ${entry.series.length > 1 ? h`<div style="margin-top:16px">${AOS.chart.line(entry.series, { height: 100, title: def.name })}</div>` : ''}
      ${history.length ? h`<div style="margin-top:8px">${history.map((row) => h`
        <div class="row">
          <span class="row-main">
            <span class="row-title">${num(row.value)} ${def.unit}</span>
            <span class="row-sub">${dates.formatJP(row.date)}</span>
          </span>
          <button class="meal-item-del" data-del-test="${row.id}" aria-label="削除">${AOS.icons.trash(16)}</button>
        </div>`)}</div>` : ''}
    `, { subtitle: def.hint });

    function flightValue() {
      const frames = W.stepperValue(el.querySelector('[data-stepper="frames"]'));
      const seconds = AOS.stats.flightTimeFromFrames(frames, state.testFps);
      return { seconds, height: AOS.stats.heightFromFlightTime(seconds) };
    }

    function paintFlight() {
      const result = flightValue();
      const timeEl = el.querySelector('[data-flight-time]');
      const heightEl = el.querySelector('[data-flight-height]');
      if (timeEl) timeEl.textContent = result.seconds ? result.seconds.toFixed(3) : '—';
      if (heightEl) heightEl.textContent = result.height || '—';
    }

    W.bindSteppers(el, () => paintFlight());
    if (flight) paintFlight();

    if (flight) {
      W.bindSegmented(el, 'mode', (mode) => {
        state.testMode = mode;
        el.querySelector('[data-mode-direct]').hidden = mode === 'flight';
        el.querySelector('[data-mode-flight]').hidden = mode !== 'flight';
      });
      W.bindSegmented(el, 'fps', (fps) => {
        state.testFps = Number(fps);
        paintFlight();
      });
    }

    delegate(el, 'click', '[data-save-test]', () => {
      const useFlight = flight && state.testMode === 'flight';
      const value = useFlight ? flightValue().height : W.stepperValue(el.querySelector('[data-stepper="test"]'));

      if (value === '' || !value || value <= 0) {
        toast(useFlight ? 'コマ数を入力してください' : '値を入力してください');
        return;
      }
      AOS.stats.addTest(state.dateKey, testId, value, useFlight ? 'flight' : 'direct').then(() => {
        AOS.sheet.close();
        toast(useFlight ? `${value} cm として記録しました` : '記録しました');
        AOS.router.rerender();
      });
    });

    delegate(el, 'click', '[data-del-test]', (e, target) => {
      AOS.stats.removeTest(Number(target.dataset.delTest)).then(() => {
        AOS.sheet.close();
        AOS.router.rerender();
      });
    });
  }

  // ---------- condition ----------

  // Editing condition lives on HOME. Showing it in two places made it
  // unclear which one was the real record, so this is a read-only
  // summary that takes you there.
  function conditionCard() {
    const adjust = AOS.condition.evaluate(state.condition);
    return W.card({
      title: "TODAY'S CONDITION",
      body: h`
        <button class="row" data-go-home>
          <span class="row-main">
            <span class="row-title">
              ${adjust.complete ? `${adjust.level.title} · ${adjust.score} / 15` : '今朝の記録が未完了'}
            </span>
            <span class="row-sub">
              ${adjust.complete
                ? `睡眠 ${state.condition.sleep} · 気力 ${state.condition.energy} · 脚 ${state.condition.legs}`
                : 'HOME で記録できます'}
            </span>
          </span>
          ${adjust.complete ? h`<span class="badge badge-${adjust.level.tone}">${adjust.level.status}</span>` : ''}
          <span class="row-chevron">${AOS.icons.chevron(16)}</span>
        </button>`
    });
  }

  // ---------- screen ----------

  function render() {
    return load().then(() => h`
      ${weightCard()}
      ${testsCard()}
      ${conditionCard()}
    `);
  }

  function topbar() {
    return { eyebrow: 'BODY', title: '体の記録' };
  }

  const saveWeight = AOS.dom.debounce((value) => {
    AOS.stats.saveBodyLog(state.dateKey, { weight: value === '' ? '' : Number(value) });
  }, 450);

  function bind(root) {
    const unbinds = [];
    let edited = false;

    unbinds.push.apply(unbinds, W.bindSteppers(root, (name, value, el, immediate) => {
      if (name !== 'weight') return;
      edited = true;
      state.weight = value;
      const display = root.querySelector('.weight-num');
      if (display) display.textContent = value === '' ? '—' : num(value);
      if (immediate) {
        saveWeight.flush(value);
      } else {
        saveWeight(value);
      }
    }));

    unbinds.push(delegate(root, 'click', '[data-go-home]', () => AOS.router.go('home')));

    unbinds.push(delegate(root, 'click', '[data-derived]', () => {
      AOS.sheet.open('推定1RMについて', h`
        <p class="help-text">
          限界まで挙げて測るのではなく、トレーニングで実際に挙げた重量と回数から計算しています
          （Epley式：重量 × (1 + 回数 ÷ 30)）。
        </p>
        <p class="help-text" style="margin-top:10px">
          12回を超えるセットは誤差が大きいので計算から除いています。スクワットを記録すれば自動で更新されます。
        </p>`);
    }));

    unbinds.push(W.bindSegmented(root, 'range', (value) => {
      state.range = Number(value);
      AOS.router.rerender();
    }));

    unbinds.push(delegate(root, 'click', '[data-test]', (e, target) => {
      openTestSheet(target.dataset.test);
    }));

    // Leaving the screen mid-edit must not drop the typed weight —
    // but simply visiting BODY must not create an empty row either.
    unbinds.push(() => { if (edited) saveWeight.flush(state.weight); });

    return unbinds;
  }

  AOS.screens = AOS.screens || {};
  AOS.screens.body = { id: 'body', label: 'BODY', icon: 'body', topbar, render, bind };

  AOS.router.register(AOS.screens.body);
})(window);
