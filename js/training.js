/* ==========================================================
   training.js — TRAINING screen: workout picker, set logging,
   start/finish workout, resume of an in-progress session.

   Fixed Ver1 exercise lists (no editing) live in TRAINING_WORKOUTS.
   A trainingSession is created on START WORKOUT and updated in
   place (same IndexedDB record) as sets are logged, so a reload
   or a closed tab never loses progress.
   ========================================================== */

(function (global) {
  const DB = global.AthleteDB;
  const App = global.App;

  const SETS_PER_EXERCISE = 3;
  const WEIGHT_STEP = 2.5;
  const REPS_STEP = 1;
  const SAVE_DEBOUNCE_MS = 500;

  const TRAINING_ORDER = ['A', 'B', 'C'];

  const TRAINING_WORKOUTS = {
    A: {
      label: 'Workout A',
      sub: 'LOWER + JUMP',
      exercises: ['CMJ', 'Box Jump', 'Squat', 'Romanian Deadlift', 'Bulgarian Split Squat', 'Calf Raise', 'Core']
    },
    B: {
      label: 'Workout B',
      sub: 'UPPER + POWER',
      exercises: ['Med Ball Throw', 'Bench Press', 'Lat Pulldown', 'Shoulder Press', 'Row', 'Lateral Raise', 'Face Pull', 'Core']
    },
    C: {
      label: 'Workout C',
      sub: 'BONUS',
      exercises: ['Light Jump', 'Upper Body', 'Shoulder', 'Arms', 'Core', 'Zone2']
    }
  };

  function slug(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  function exerciseId(workoutType, name) {
    return `${workoutType}-${slug(name)}`;
  }

  function fmt(n) {
    return (n === '' || n === null || n === undefined) ? '-' : String(n);
  }

  function round1(n) {
    return Math.round(n * 10) / 10;
  }

  const state = {
    session: null,       // current in-progress trainingSession, or null
    workoutChoice: 'A',  // idle-screen workout picker
    lastReference: {}     // exerciseId -> { weight, reps } from the previous session, for the "LAST" line
  };

  let container = null;
  let saveTimer = null;

  // ---------- Data access ----------

  async function getAllSessions() {
    return DB.getAll('trainingSessions');
  }

  async function findInProgress() {
    const all = await getAllSessions();
    return all.find((s) => s.status === 'in_progress') || null;
  }

  async function findLastSession(workoutType, excludeId) {
    const all = await getAllSessions();
    const candidates = all.filter((s) => s.workoutType === workoutType && s.id !== excludeId && s.status !== 'in_progress');
    candidates.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return (b.startedAt || '').localeCompare(a.startedAt || '');
    });
    return candidates[0] || null;
  }

  function buildReferenceMap(lastSession) {
    const map = {};
    if (lastSession) {
      lastSession.exercises.forEach((ex) => {
        const first = ex.sets[0];
        if (first) map[ex.exerciseId] = { weight: first.weight, reps: first.reps };
      });
    }
    return map;
  }

  function buildExercises(workoutType, lastSession) {
    const def = TRAINING_WORKOUTS[workoutType];
    return def.exercises.map((name) => {
      const id = exerciseId(workoutType, name);
      const prevEx = lastSession ? lastSession.exercises.find((e) => e.exerciseId === id) : null;
      const sets = [];
      for (let i = 0; i < SETS_PER_EXERCISE; i++) {
        let weight = '';
        let reps = '';
        if (prevEx && prevEx.sets.length) {
          const prevSet = prevEx.sets[i] || prevEx.sets[prevEx.sets.length - 1];
          weight = prevSet.weight;
          reps = prevSet.reps;
        }
        sets.push({ setNumber: i + 1, weight, reps, completed: false });
      }
      return { exerciseId: id, exerciseName: name, sets };
    });
  }

  function findSet(exerciseId_, setNumber) {
    if (!state.session) return null;
    const ex = state.session.exercises.find((e) => e.exerciseId === exerciseId_);
    if (!ex) return null;
    return ex.sets.find((s) => s.setNumber === setNumber) || null;
  }

  function saveSessionNow() {
    clearTimeout(saveTimer);
    if (state.session) DB.put('trainingSessions', state.session);
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveSessionNow, SAVE_DEBOUNCE_MS);
  }

  // ---------- Session lifecycle ----------

  async function startSession(workoutType) {
    const last = await findLastSession(workoutType, null);
    const session = {
      date: App.todayKey(),
      workoutType,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      status: 'in_progress',
      exercises: buildExercises(workoutType, last)
    };
    await DB.put('trainingSessions', session);
    state.session = session;
    state.lastReference = buildReferenceMap(last);
    renderActive();
  }

  async function finishSession() {
    if (!state.session) return;
    const allDone = state.session.exercises.every((ex) => ex.sets.every((s) => s.completed));
    state.session.status = allDone ? 'completed' : 'partial';
    state.session.finishedAt = new Date().toISOString();
    saveSessionNow();
    state.session = null;
    await loadAndRender();
  }

  // Entry point for HOME's START WORKOUT button. Resumes an in-progress
  // session if one exists; otherwise starts a fresh one for the given
  // workout (only when it's a real A/B/C training day).
  async function startFromHome(workoutId) {
    if (state.session) return;
    if (TRAINING_WORKOUTS[workoutId]) {
      await startSession(workoutId);
    }
  }

  // ---------- Rendering ----------

  function renderIdle(lastSession) {
    const def = TRAINING_WORKOUTS[state.workoutChoice];
    const lastLine = lastSession
      ? `LAST SESSION ${lastSession.date} · ${lastSession.status === 'completed' ? 'Completed' : 'Partial'}`
      : 'まだ記録がありません';

    container.innerHTML = `
      <section class="card">
        <div class="card-header-row">
          <span class="eyebrow">TRAINING</span>
          <button class="link-btn" data-action="change-workout">Change</button>
        </div>
        <h2 class="workout-name">${def.label}</h2>
        <p class="workout-sub">${def.sub}</p>
        <p class="training-last-session">${lastLine}</p>
      </section>
      <button class="start-btn" data-action="start-workout">START WORKOUT</button>
    `;
  }

  function renderSetBlock(exId, set) {
    const done = set.completed;
    return `
      <div class="set-block ${done ? 'done' : ''}" data-set="${set.setNumber}">
        <div class="set-block-head"><span class="set-label">SET ${set.setNumber}</span></div>
        <div class="field-group">
          <span class="field-label">重量 (kg)</span>
          <div class="stepper">
            <button class="stepper-btn" data-action="step" data-field="weight" data-dir="-1" aria-label="重量を減らす">−</button>
            <input class="stepper-input" data-field="weight" type="text" inputmode="decimal" value="${set.weight}">
            <button class="stepper-btn" data-action="step" data-field="weight" data-dir="1" aria-label="重量を増やす">+</button>
          </div>
        </div>
        <div class="field-group">
          <span class="field-label">回数</span>
          <div class="stepper">
            <button class="stepper-btn" data-action="step" data-field="reps" data-dir="-1" aria-label="回数を減らす">−</button>
            <input class="stepper-input" data-field="reps" type="text" inputmode="numeric" value="${set.reps}">
            <button class="stepper-btn" data-action="step" data-field="reps" data-dir="1" aria-label="回数を増やす">+</button>
          </div>
        </div>
        <button class="complete-btn ${done ? 'done' : ''}" data-action="toggle-complete">${done ? '✓ COMPLETED' : 'COMPLETE'}</button>
      </div>
    `;
  }

  function renderExerciseCard(ex) {
    const ref = state.lastReference[ex.exerciseId];
    const lastLine = ref ? `LAST ${fmt(ref.weight)}kg × ${fmt(ref.reps)}` : 'LAST —';
    const setsHtml = ex.sets.map((set) => renderSetBlock(ex.exerciseId, set)).join('');
    return `
      <section class="card exercise-card" data-exercise-id="${ex.exerciseId}">
        <h3 class="exercise-name">${ex.exerciseName}</h3>
        <p class="exercise-last">${lastLine}</p>
        ${setsHtml}
      </section>
    `;
  }

  function renderActive() {
    const def = TRAINING_WORKOUTS[state.session.workoutType];
    const exercisesHtml = state.session.exercises.map((ex) => renderExerciseCard(ex)).join('');
    container.innerHTML = `
      <section class="card">
        <span class="eyebrow">IN PROGRESS</span>
        <h2 class="workout-name">${def.label}</h2>
        <p class="workout-sub">${def.sub}</p>
      </section>
      ${exercisesHtml}
      <button class="start-btn" data-action="finish-workout">FINISH WORKOUT</button>
    `;
  }

  async function loadAndRender() {
    const [inProgress, settings] = await Promise.all([
      findInProgress(),
      DB.get('settings', 'app')
    ]);

    if (inProgress) {
      state.session = inProgress;
      state.lastReference = buildReferenceMap(await findLastSession(inProgress.workoutType, inProgress.id));
      renderActive();
    } else {
      state.session = null;
      const preferred = settings && settings.selectedWorkout;
      state.workoutChoice = TRAINING_WORKOUTS[preferred] ? preferred : state.workoutChoice;
      const last = await findLastSession(state.workoutChoice, null);
      renderIdle(last);
    }
  }

  // ---------- Events ----------

  function openWorkoutPicker() {
    const rows = TRAINING_ORDER.map((id) => {
      const def = TRAINING_WORKOUTS[id];
      const active = id === state.workoutChoice ? 'active' : '';
      return `<button class="sheet-option ${active}" data-workout="${id}">
        <span>${def.label}</span>
        <span class="sheet-option-sub">${def.sub}</span>
      </button>`;
    }).join('');

    App.openSheet(`<h3 class="sheet-title">CHOOSE WORKOUT</h3><div class="sheet-options">${rows}</div>`);

    document.querySelectorAll('.sheet-option').forEach((opt) => {
      opt.addEventListener('click', async () => {
        state.workoutChoice = opt.dataset.workout;
        App.closeSheet();
        const last = await findLastSession(state.workoutChoice, null);
        renderIdle(last);
      });
    });
  }

  function handleStep(btn) {
    const field = btn.dataset.field;
    const dir = Number(btn.dataset.dir);
    const setBlock = btn.closest('.set-block');
    const exCard = btn.closest('.exercise-card');
    const input = setBlock.querySelector(`.stepper-input[data-field="${field}"]`);
    const step = field === 'weight' ? WEIGHT_STEP : REPS_STEP;
    const current = parseFloat(input.value) || 0;
    const value = Math.max(0, round1(current + dir * step));
    input.value = String(value);

    const set = findSet(exCard.dataset.exerciseId, Number(setBlock.dataset.set));
    if (set) {
      set[field] = value;
      saveSessionNow();
    }
  }

  function handleInput(input) {
    const field = input.dataset.field;
    const setBlock = input.closest('.set-block');
    const exCard = input.closest('.exercise-card');
    const set = findSet(exCard.dataset.exerciseId, Number(setBlock.dataset.set));
    if (!set) return;
    const raw = input.value;
    let value = '';
    if (raw !== '') {
      value = field === 'weight' ? parseFloat(raw) : parseInt(raw, 10);
      if (Number.isNaN(value)) value = '';
    }
    set[field] = value;
    scheduleSave();
  }

  function handleToggleComplete(btn) {
    const setBlock = btn.closest('.set-block');
    const exCard = btn.closest('.exercise-card');
    const set = findSet(exCard.dataset.exerciseId, Number(setBlock.dataset.set));
    if (!set) return;
    set.completed = !set.completed;
    btn.textContent = set.completed ? '✓ COMPLETED' : 'COMPLETE';
    btn.classList.toggle('done', set.completed);
    setBlock.classList.toggle('done', set.completed);
    saveSessionNow();
  }

  function initEvents() {
    container.addEventListener('click', (e) => {
      if (e.target.closest('[data-action="start-workout"]')) {
        startSession(state.workoutChoice);
        return;
      }
      if (e.target.closest('[data-action="finish-workout"]')) {
        finishSession();
        return;
      }
      if (e.target.closest('[data-action="change-workout"]')) {
        openWorkoutPicker();
        return;
      }
      const stepBtn = e.target.closest('.stepper-btn');
      if (stepBtn) {
        handleStep(stepBtn);
        return;
      }
      const completeBtn = e.target.closest('.complete-btn');
      if (completeBtn) {
        handleToggleComplete(completeBtn);
      }
    });

    container.addEventListener('input', (e) => {
      const input = e.target.closest('.stepper-input');
      if (input) handleInput(input);
    });

    // blur doesn't bubble — use capture so a flush still happens
    // when the user taps away from a weight/reps field.
    container.addEventListener('blur', (e) => {
      if (e.target && e.target.classList && e.target.classList.contains('stepper-input')) {
        saveSessionNow();
      }
    }, true);
  }

  async function init() {
    container = document.getElementById('trainingBody');
    initEvents();
    await loadAndRender();
  }

  async function refresh() {
    await loadAndRender();
  }

  global.Training = { init, refresh, startFromHome };
})(window);
