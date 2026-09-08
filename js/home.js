/* ==========================================================
   home.js — HOME screen: condition, readiness, workout pick,
   duration toggle, focus, volleyball countdown, today's log.
   ========================================================== */

(function (global) {
  const DB = global.AthleteDB;
  const App = global.App;
  const Condition = global.Condition;
  const WORKOUTS = global.Workouts.WORKOUTS;
  const WORKOUT_ORDER = global.Workouts.WORKOUT_ORDER;

  const DAY_INDEX = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };

  const state = {
    condition: { sleep: 3, energy: 3, legs: 3 },
    conditionLogged: false,
    selectedWorkout: 'A',
    selectedDuration: 30,
    volleyballDay: 'Saturday',
    trainingDoneToday: false,
    weightLoggedToday: false
  };

  // Body also renders .scale-btn / .help-btn elements for the same
  // Condition fields, so every query here must stay scoped to Home's
  // own view — otherwise Home's listeners would also fire on Body's.
  let homeRoot = null;

  // ---------- Persistence ----------

  async function loadState() {
    const [condition, settings, trainingSessions, bodyLogs] = await Promise.all([
      Condition.loadToday(App.todayKey()),
      DB.get('settings', 'app'),
      DB.getAll('trainingSessions'),
      DB.getAll('bodyLogs')
    ]);

    state.condition.sleep = condition.sleep;
    state.condition.energy = condition.energy;
    state.condition.legs = condition.legs;
    state.conditionLogged = condition.logged;

    if (settings) {
      if (settings.selectedWorkout) state.selectedWorkout = settings.selectedWorkout;
      if (settings.selectedDuration) state.selectedDuration = settings.selectedDuration;
      if (settings.volleyballDay) state.volleyballDay = settings.volleyballDay;
    }

    const today = App.todayKey();
    state.trainingDoneToday = trainingSessions.some((s) => s.date === today && s.status !== 'in_progress');
    state.weightLoggedToday = bodyLogs.some((b) => b.date === today);
  }

  function computeReadiness() {
    return Condition.computeReadiness(state.condition);
  }

  async function saveCondition() {
    await Condition.save(App.todayKey(), state.condition);
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
      const group = homeRoot.querySelector(`.scale-buttons[data-field="${field}"]`);
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
    // Condition/Training/Weight wire to real data; Food stays a
    // placeholder until that screen exists.
    const items = [
      { label: 'Condition', done: state.conditionLogged, value: state.conditionLogged ? '✓' : '-' },
      { label: 'Training', done: state.trainingDoneToday, value: state.trainingDoneToday ? '✓' : '-' },
      { label: 'Weight', done: state.weightLoggedToday, value: state.weightLoggedToday ? '✓' : '-' },
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
    const data = Condition.HELP[field];
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
    homeRoot.querySelectorAll('.scale-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const field = btn.closest('.scale-buttons').dataset.field;
        state.condition[field] = Number(btn.dataset.value);
        renderCondition();
        renderReadiness();
        await saveCondition();
        renderLog();
      });
    });

    homeRoot.querySelectorAll('.help-btn').forEach((btn) => {
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
    document.getElementById('startWorkoutBtn').addEventListener('click', async () => {
      if (global.Training && global.Training.startFromHome) {
        await global.Training.startFromHome(state.selectedWorkout);
      }
      App.switchToView('training');
    });
  }

  async function refresh() {
    await loadState();
    renderAll();
  }

  async function init() {
    homeRoot = document.getElementById('viewHome');
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

  global.Home = { init, refresh };
})(window);
