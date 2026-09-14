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
    bodyLogs: [],
    todayLog: null,
    weight: '',
    condition: Object.assign({}, AOS.condition.NEUTRAL),
    logged: false,
    tests: {},
    testRows: []
  };

  function settings() { return AOS.store.settings(); }

  // ---------- data ----------

  function load() {
    state.dateKey = dates.today();

    return Promise.all([
      AOS.stats.allBodyLogs(),
      AOS.condition.load(state.dateKey),
      AOS.stats.loadTests()
    ]).then(([bodyLogs, condition, testRows]) => {
      state.bodyLogs = bodyLogs;
      state.todayLog = bodyLogs.filter((r) => r.date === state.dateKey).pop() || null;
      state.weight = state.todayLog && state.todayLog.weight !== undefined ? state.todayLog.weight : '';
      state.condition = { sleep: condition.sleep, energy: condition.energy, legs: condition.legs };
      state.logged = condition.logged;
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

  function testsCard() {
    return W.card({
      title: 'PERFORMANCE',
      action: h`<span class="card-title">月1で更新</span>`,
      body: h`<div>${AOS.stats.TESTS.map(testRow)}</div>`
    });
  }

  function openTestSheet(testId) {
    const def = AOS.stats.testDef(testId);
    if (!def) return;
    const entry = state.tests[testId] || { latest: null, best: null, series: [] };
    const history = state.testRows.filter((r) => r.testId === testId).slice(0, 6);

    const el = AOS.sheet.open(def.name, h`
      ${W.stepper({
        name: 'test',
        value: entry.latest ? entry.latest.value : '',
        unit: def.unit,
        step: def.better === 'low' ? 0.1 : 1,
        decimals: def.better === 'low' ? 2 : 1,
        label: def.name
      })}
      <button class="btn" data-save-test style="margin-top:14px">${dates.formatJP(state.dateKey)} として記録</button>
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

    W.bindSteppers(el, () => { /* value is read on save */ });

    delegate(el, 'click', '[data-save-test]', () => {
      const value = W.stepperValue(el.querySelector('[data-stepper="test"]'));
      if (value === '' || value <= 0) {
        toast('値を入力してください');
        return;
      }
      AOS.stats.addTest(state.dateKey, testId, value).then(() => {
        AOS.sheet.close();
        toast('記録しました');
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

  function conditionCard() {
    return W.card({
      title: "TODAY'S CONDITION",
      action: state.logged ? h`<span class="badge badge-quiet">記録済み</span>` : '',
      body: h`<div>${W.conditionScales(state.condition)}</div>`
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

    unbinds.push.apply(unbinds, W.bindSteppers(root, (name, value, el, immediate) => {
      if (name !== 'weight') return;
      state.weight = value;
      const display = root.querySelector('.weight-num');
      if (display) display.textContent = value === '' ? '—' : num(value);
      if (immediate) {
        saveWeight.flush(value);
      } else {
        saveWeight(value);
      }
    }));

    unbinds.push.apply(unbinds, W.bindScales(root, (field, value) => {
      state.condition[field] = value;
      AOS.condition.save(state.dateKey, state.condition);
    }));

    unbinds.push(W.bindSegmented(root, 'range', (value) => {
      state.range = Number(value);
      AOS.router.rerender();
    }));

    unbinds.push(delegate(root, 'click', '[data-test]', (e, target) => {
      openTestSheet(target.dataset.test);
    }));

    // Leaving the screen mid-edit must not drop the typed weight.
    unbinds.push(() => saveWeight.flush(state.weight));

    return unbinds;
  }

  AOS.screens = AOS.screens || {};
  AOS.screens.body = { id: 'body', label: 'BODY', icon: 'body', topbar, render, bind };

  AOS.router.register(AOS.screens.body);
})(window);
