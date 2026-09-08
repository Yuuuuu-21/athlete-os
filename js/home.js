/* ==========================================================
   home.js — HOME screen: condition, readiness, workout pick,
   duration toggle, focus, volleyball countdown, today's log.
   ========================================================== */

(function (global) {
  const DB = global.AthleteDB;
  const App = global.App;
  const WORKOUTS = global.Workouts.WORKOUTS;
  const WORKOUT_ORDER = global.Workouts.WORKOUT_ORDER;

  const DAY_INDEX = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };

  const CONDITION_HELP = {
    sleep: {
      title: 'SLEEP',
      levels: [
        [5, 'よく眠れた。起きた時かなりスッキリ'],
        [4, 'だいたい良好。眠気は少ない'],
        [3, '普通。少し眠い'],
        [2, '寝不足感が強い'],
        [1, 'ほとんど眠れなかった、かなり眠い']
      ]
    },
    energy: {
      title: 'ENERGY',
      levels: [
        [5, 'かなり元気。体が軽く、やる気もある'],
        [4, '普通に元気。問題なくトレーニングできそう'],
        [3, '少しだるい。でも通常生活は問題ない'],
        [2, 'かなり疲れている。集中しづらい、体が重い'],
        [1, '強い疲労感。今日は休みたいレベル']
      ]
    },
    legs: {
      title: 'LEGS',
      levels: [
        [5, '軽い。張りや筋肉痛なし'],
        [4, '少し張るが問題なし'],
        [3, '軽い筋肉痛や重さあり'],
        [2, 'かなり重い、筋肉痛が強い'],
        [1, '痛みや強い違和感があり、運動したくない']
      ]
    }
  };

  const READINESS_LEVELS = [
    { min: 12, max: 15, status: 'GREEN', desc: '今日は良い状態です', action: '通常メニューでOK' },
    { min: 8, max: 11, status: 'YELLOW', desc: '今日は通常より少し軽め', action: '重量・セット数を少し調整' },
    { min: 3, max: 7, status: 'RED', desc: '今日は疲労が溜まっています', action: '短縮または低負荷を優先' }
  ];

  function readinessLevelFor(score) {
    return READINESS_LEVELS.find((l) => score >= l.min && score <= l.max) || READINESS_LEVELS[1];
  }

  const state = {
    condition: { sleep: 3, energy: 3, legs: 3 },
    conditionLogged: false,
    selectedWorkout: 'A',
    selectedDuration: 30,
    volleyballDay: 'Saturday'
  };

  // ---------- Persistence ----------

  async function loadState() {
    const [conditionLog, settings] = await Promise.all([
      DB.get('conditionLogs', App.todayKey()),
      DB.get('settings', 'app')
    ]);

    if (conditionLog) {
      state.condition.sleep = conditionLog.sleep;
      state.condition.energy = conditionLog.energy;
      state.condition.legs = conditionLog.legs;
      state.conditionLogged = true;
    }
    if (settings) {
      if (settings.selectedWorkout) state.selectedWorkout = settings.selectedWorkout;
      if (settings.selectedDuration) state.selectedDuration = settings.selectedDuration;
      if (settings.volleyballDay) state.volleyballDay = settings.volleyballDay;
    }
  }

  function computeReadiness() {
    const score = state.condition.sleep + state.condition.energy + state.condition.legs;
    return { score, level: readinessLevelFor(score) };
  }

  async function saveCondition() {
    const { score, level } = computeReadiness();
    await DB.put('conditionLogs', {
      date: App.todayKey(),
      sleep: state.condition.sleep,
      energy: state.condition.energy,
      legs: state.condition.legs,
      readinessScore: score,
      readinessStatus: level.status
    });
    state.conditionLogged = true;
  }

  async function saveSettings() {
    await DB.put('settings', {
      key: 'app',
      selectedWorkout: state.selectedWorkout,
      selectedDuration: state.selectedDuration,
      volleyballDay: state.volleyballDay
    });
  }

  // ---------- Rendering ----------

  function renderCondition() {
    ['sleep', 'energy', 'legs'].forEach((field) => {
      const group = document.querySelector(`.scale-buttons[data-field="${field}"]`);
      if (!group) return;
      group.querySelectorAll('.scale-btn').forEach((btn) => {
        btn.classList.toggle('selected', Number(btn.dataset.value) === state.condition[field]);
      });
    });
  }

  function renderReadiness() {
    const { score, level } = computeReadiness();
    document.getElementById('readinessScore').textContent = `${score} / 15`;
    const badge = document.getElementById('readinessBadge');
    badge.textContent = level.status;
    badge.className = `readiness-badge badge-${level.status.toLowerCase()}`;
    document.getElementById('readinessDesc').textContent = level.desc;
    document.getElementById('readinessAction').textContent = level.action;
  }

  function renderWorkout() {
    const w = WORKOUTS[state.selectedWorkout];
    document.getElementById('workoutName').textContent = w.label;
    document.getElementById('workoutSub').textContent = w.sub;

    const focusTitle = document.getElementById('focusTitle');
    focusTitle.textContent = w.focusTitle;
    focusTitle.classList.toggle('accent', !!w.accent);
    document.getElementById('focusDesc').textContent = w.focusDesc;

    document.querySelectorAll('.duration-btn').forEach((btn) => {
      btn.classList.toggle('active', Number(btn.dataset.duration) === state.selectedDuration);
    });
  }

  function renderVolleyball() {
    const targetDay = DAY_INDEX[state.volleyballDay] ?? 6;
    const currentDay = new Date().getDay();
    const diff = (targetDay - currentDay + 7) % 7;

    const daysEl = document.getElementById('volleyballDays');
    const dateEl = document.getElementById('volleyballDate');

    if (diff === 0) {
      daysEl.textContent = 'VOLLEYBALL TODAY';
      dateEl.textContent = '';
    } else {
      daysEl.textContent = `${diff} DAY${diff === 1 ? '' : 'S'} TO GO`;
      dateEl.textContent = state.volleyballDay;
    }
  }

  function renderLog() {
    // Condition wires to real data; Training/Weight/Food stay as
    // placeholders until their screens exist.
    const items = [
      { label: 'Condition', done: state.conditionLogged, value: state.conditionLogged ? '✓' : '-' },
      { label: 'Training', done: false, value: '-' },
      { label: 'Weight', done: true, value: '✓' },
      { label: 'Food', done: false, value: '2 / 4' }
    ];
    document.getElementById('logList').innerHTML = items.map((item) => `
      <li class="log-item">
        <span class="log-label">${item.label}</span>
        <span class="log-value ${item.done ? 'log-done' : 'log-pending'}">${item.value}</span>
      </li>
    `).join('');
  }

  function renderAll() {
    renderCondition();
    renderReadiness();
    renderWorkout();
    renderVolleyball();
    renderLog();
  }

  // ---------- Events ----------

  function openConditionHelp(field) {
    const data = CONDITION_HELP[field];
    if (!data) return;
    const rows = data.levels.map(([num, text]) => `
      <div class="help-row">
        <span class="help-num">${num}</span>
        <span class="help-text">${text}</span>
      </div>
    `).join('');
    App.openSheet(`<h3 class="sheet-title">${data.title}</h3><div class="help-list">${rows}</div>`);
  }

  function initConditionButtons() {
    document.querySelectorAll('.scale-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const field = btn.closest('.scale-buttons').dataset.field;
        state.condition[field] = Number(btn.dataset.value);
        renderCondition();
        renderReadiness();
        await saveCondition();
        renderLog();
      });
    });

    document.querySelectorAll('.help-btn').forEach((btn) => {
      btn.addEventListener('click', () => openConditionHelp(btn.dataset.help));
    });
  }

  function initDurationButtons() {
    document.querySelectorAll('.duration-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        state.selectedDuration = Number(btn.dataset.duration);
        renderWorkout();
        await saveSettings();
      });
    });
  }

  function initWorkoutChange() {
    document.getElementById('changeWorkoutBtn').addEventListener('click', () => {
      const rows = WORKOUT_ORDER.map((id) => {
        const w = WORKOUTS[id];
        const active = id === state.selectedWorkout ? 'active' : '';
        return `<button class="sheet-option ${active}" data-workout="${id}">
          <span>${w.label}</span>
          <span class="sheet-option-sub">${w.sub}</span>
        </button>`;
      }).join('');

      App.openSheet(`<h3 class="sheet-title">CHANGE WORKOUT</h3><div class="sheet-options">${rows}</div>`);

      document.querySelectorAll('.sheet-option').forEach((opt) => {
        opt.addEventListener('click', async () => {
          state.selectedWorkout = opt.dataset.workout;
          renderWorkout();
          await saveSettings();
          App.closeSheet();
        });
      });
    });
  }

  function initStartWorkout() {
    document.getElementById('startWorkoutBtn').addEventListener('click', () => {
      const w = WORKOUTS[state.selectedWorkout];
      App.showStub(
        'TRAINING',
        'Training screen will be implemented next',
        `<p class="stub-detail">${w.label} · ${state.selectedDuration} MIN</p>`
      );
    });
  }

  async function init() {
    await loadState();
    if (!state.conditionLogged) {
      // Seed a neutral default so Readiness and Today's Log have
      // something real to show before the user taps anything.
      await saveCondition();
    }
    renderAll();
    initConditionButtons();
    initDurationButtons();
    initWorkoutChange();
    initStartWorkout();
  }

  global.Home = { init };
})(window);
