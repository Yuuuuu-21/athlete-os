/* ==========================================================
   training.js — logging the session.

   The screen has three states: nothing started yet, a session in
   progress, and today already done. An in-progress session is
   written to IndexedDB on every change, so quitting the app
   between sets costs nothing.
   ========================================================== */

(function (global) {
  const AOS = global.AOS = global.AOS || {};
  const { h, delegate, setHTML, num, mmss, duration, toast } = AOS.dom;
  const W = AOS.widgets;
  const dates = AOS.dates;

  const state = {
    dateKey: dates.today(),
    session: null,
    todaysSessions: [],
    lastSession: null,
    reference: {},     // exerciseId -> previous session's exercise
    history: []
  };

  let rest = { timer: null, remaining: 0 };

  function settings() { return AOS.store.settings(); }

  // ---------- data ----------

  function load() {
    state.dateKey = dates.today();

    return Promise.all([
      AOS.sessions.findInProgress(),
      AOS.sessions.forDate(state.dateKey),
      AOS.sessions.history(8)
    ]).then(([inProgress, todays, history]) => {
      state.session = inProgress;
      state.todaysSessions = todays;
      state.history = history;

      const workoutId = state.session
        ? state.session.workoutType
        : AOS.plan.forDate(state.dateKey);

      return AOS.sessions.lastFor(workoutId, state.session ? state.session.id : null);
    }).then((last) => {
      state.lastSession = last;
      state.reference = {};
      if (last) {
        (last.exercises || []).forEach((ex) => { state.reference[ex.exerciseId] = ex; });
      }
    });
  }

  // Create (or resume) today's session. Called from HOME too.
  function begin(workoutId) {
    const dateKey = dates.today();
    const workout = AOS.workouts.get(workoutId);

    return AOS.sessions.findInProgress().then((existing) => {
      if (existing) return existing;
      if (!workout.trainable) return null;

      return AOS.condition.load(dateKey).then((condition) => {
        // evaluate() returns neutral values when the rating is
        // incomplete, so an unlogged morning simply gets the plain plan.
        const adjust = AOS.condition.evaluate(condition);
        const prescribed = AOS.workouts.prescribe(workoutId, settings().duration, adjust);

        return AOS.sessions.lastFor(workoutId, null).then((last) => {
          const session = AOS.sessions.build(dateKey, workoutId, prescribed, last, adjust);
          return AOS.sessions.save(session).then(() => {
            AOS.store.changed('training');
            return session;
          });
        });
      });
    });
  }

  // ---------- writing ----------

  const persist = AOS.dom.debounce(() => {
    if (state.session) AOS.sessions.save(state.session);
  }, 400);

  function persistNow() {
    persist.cancel();
    if (state.session) AOS.sessions.save(state.session);
  }

  function findExercise(exerciseId) {
    return (state.session.exercises || []).find((ex) => ex.exerciseId === exerciseId) || null;
  }

  function findSet(exerciseId, setNumber) {
    const exercise = findExercise(exerciseId);
    if (!exercise) return null;
    return exercise.sets.find((s) => s.setNumber === Number(setNumber)) || null;
  }

  // ---------- set rendering ----------

  function referenceLine(exercise, setNumber) {
    const previous = state.reference[exercise.exerciseId];
    if (!previous) return '前回の記録なし';
    const set = previous.sets[setNumber - 1] || previous.sets[previous.sets.length - 1];
    if (!set) return '前回の記録なし';

    if ((previous.metric || 'weight_reps') === 'time') return `前回 ${duration(set.seconds)}`;
    if ((previous.metric || 'weight_reps') === 'reps') return `前回 ${set.reps} 回`;
    return `前回 ${num(set.weight)}kg × ${set.reps}`;
  }

  function setValueLine(exercise, set) {
    const metric = exercise.metric || 'weight_reps';
    if (metric === 'time') return duration(set.seconds);
    if (metric === 'reps') return `${set.reps} 回`;
    return `${num(set.weight)} kg × ${set.reps}`;
  }

  function timeField(exercise, set) {
    const asMinutes = exercise.type === 'cardio';
    return asMinutes
      ? { name: 'minutes', step: 1, decimals: 0, value: Math.round((set.seconds || 0) / 60), label: '時間 (分)' }
      : { name: 'seconds', step: 5, decimals: 0, value: set.seconds || 0, label: '時間 (秒)' };
  }

  function setFields(exercise, set) {
    const metric = exercise.metric || 'weight_reps';

    if (metric === 'time') {
      const field = timeField(exercise, set);
      return h`
        <div class="set-fields single">
          <div class="field-mini">
            <span class="eyebrow">${field.label}</span>
            ${W.stepper({ name: field.name, value: field.value, step: field.step, decimals: field.decimals, label: field.label })}
          </div>
        </div>`;
    }

    if (metric === 'reps') {
      return h`
        <div class="set-fields single">
          <div class="field-mini">
            <span class="eyebrow">回数</span>
            ${W.stepper({ name: 'reps', value: set.reps, step: 1, decimals: 0, label: '回数' })}
          </div>
        </div>`;
    }

    return h`
      <div class="set-fields">
        <div class="field-mini">
          <span class="eyebrow">重量 (kg)</span>
          ${W.stepper({ name: 'weight', value: set.weight, step: 2.5, decimals: 1, label: '重量' })}
        </div>
        <div class="field-mini">
          <span class="eyebrow">回数</span>
          ${W.stepper({ name: 'reps', value: set.reps, step: 1, decimals: 0, label: '回数' })}
        </div>
      </div>`;
  }

  function setRowInner(exercise, set) {
    return h`
      <div class="set-top">
        <span class="set-tag">SET ${set.setNumber}</span>
        ${set.completed
          ? h`<span class="set-done-value">${setValueLine(exercise, set)}</span>`
          : h`<span class="set-hint">${referenceLine(exercise, set.setNumber)}</span>`}
        <button type="button" class="set-check" data-action="toggle-set"
                aria-label="${set.completed ? 'セットを未完了にする' : 'セットを完了にする'}">
          ${AOS.icons.check(18)}
        </button>
      </div>
      ${setFields(exercise, set)}
    `;
  }

  function setRow(exercise, set) {
    return h`
      <div class="set-row ${set.completed ? 'done' : ''}" data-ex="${exercise.exerciseId}" data-set="${set.setNumber}">
        ${setRowInner(exercise, set)}
      </div>`;
  }

  function exerciseCard(exercise) {
    const counts = exercise.sets.filter((s) => s.completed).length;
    const allDone = counts === exercise.sets.length;
    const target = exercise.metric === 'time'
      ? `${exercise.sets.length} × ${duration(exercise.targetSeconds || 0)}`
      : `${exercise.sets.length} × ${exercise.targetReps || '—'}`;

    return h`
      <section class="card exercise-card ${allDone ? 'done' : ''}" data-exercise="${exercise.exerciseId}">
        <div class="exercise-head">
          <h3 class="exercise-name">${exercise.exerciseName}</h3>
          <span class="badge ${allDone ? 'badge-green' : 'badge-quiet'}">${counts}/${exercise.sets.length}</span>
        </div>
        <div class="exercise-meta">
          <span>目標 <b>${target}</b></span>
          ${exercise.cue ? h`<span>${exercise.cue}</span>` : ''}
        </div>
        ${exercise.sets.map((set) => setRow(exercise, set))}
        <button type="button" class="link-btn" data-action="add-set" style="margin-top:8px">＋ セットを追加</button>
      </section>
    `;
  }

  // ---------- screen states ----------

  function activeView() {
    const session = state.session;
    const workout = AOS.workouts.get(session.workoutType);
    const counts = AOS.sessions.countSets(session);
    const pct = counts.total ? (counts.done / counts.total) * 100 : 0;

    return h`
      <div class="session-bar">
        <div class="session-bar-top">
          <span class="session-name">${workout.label}</span>
          <span class="session-count">${counts.done} / ${counts.total} セット</span>
        </div>
        ${W.bar(pct, counts.done === counts.total ? 'green' : '')}
      </div>

      ${session.exercises.map((ex) => exerciseCard(ex))}

      <button class="btn" data-action="finish" style="margin-top:var(--gap)">${AOS.icons.flag(18)}ワークアウトを終了</button>
      <button class="btn btn-ghost btn-sm" data-action="discard" style="margin:10px auto 0">記録を破棄</button>
    `;
  }

  function idleView() {
    const workoutId = AOS.plan.forDate(state.dateKey);
    const workout = AOS.workouts.get(workoutId);
    const done = state.todaysSessions.filter((s) => s.status !== 'in_progress');

    const lastLine = state.lastSession
      ? `前回 ${dates.relativeJP(state.lastSession.date)} · ${AOS.sessions.summaryLine(state.lastSession)}`
      : 'このメニューの記録はまだありません';

    const todayCard = done.length
      ? W.card({
        title: '今日の記録',
        body: h`<div>${done.map((session) => sessionRow(session))}</div>`
      })
      : '';

    return h`
      ${W.card({
        title: 'TODAY',
        action: h`<button class="link-btn" data-action="change-workout">変更</button>`,
        body: h`
          <p class="plan-name">${workout.label}</p>
          <p class="plan-sub">${workout.sub}</p>
          <p class="row-sub" style="margin-top:10px">${lastLine}</p>
          ${workout.trainable ? h`
            <ul class="plan-preview">
              ${AOS.workouts.exercisesFor(workoutId, settings().duration).map((ex) => h`
                <li><span>${ex.name}</span><span>${AOS.workouts.targetLabel(ex)}</span></li>`)}
            </ul>` : h`<p class="row-sub" style="margin-top:10px">${workout.focusDesc}</p>`}
        `
      })}

      ${workout.trainable
        ? h`<button class="btn" data-action="start">${done.length ? 'もう一度やる' : 'トレーニング開始'}</button>`
        : h`<button class="btn btn-ghost" data-action="change-workout">別のメニューをやる</button>`}

      ${todayCard}

      ${W.card({
        title: '履歴',
        body: state.history.length
          ? h`<div>${state.history.map((session) => sessionRow(session))}</div>`
          : W.empty('まだ記録がありません', '最初のセッションを始めよう')
      })}
    `;
  }

  function sessionRow(session) {
    const workout = AOS.workouts.get(session.workoutType);
    const tone = session.status === 'completed' ? 'badge-green' : (session.status === 'partial' ? 'badge-amber' : 'badge-quiet');
    return h`
      <button class="row" data-session="${session.id}">
        <span class="row-main">
          <span class="row-title">${workout.label}</span>
          <span class="row-sub">${dates.formatJP(session.date)} · ${AOS.sessions.summaryLine(session)}</span>
        </span>
        <span class="badge ${tone} session-row-badge">${AOS.sessions.statusLabel(session.status)}</span>
      </button>`;
  }

  function render() {
    return load().then(() => (state.session ? activeView() : idleView()));
  }

  function topbar() {
    if (state.session) {
      return { eyebrow: 'IN PROGRESS', title: AOS.workouts.get(state.session.workoutType).label };
    }
    return { eyebrow: 'TRAINING', title: 'トレーニング' };
  }

  // ---------- rest timer ----------

  function stopRest() {
    clearInterval(rest.timer);
    rest.timer = null;
    const el = document.getElementById('restTimer');
    if (el) el.remove();
  }

  function startRest() {
    const seconds = Number(settings().restSeconds) || 0;
    if (!seconds) return;

    stopRest();
    rest.remaining = seconds;

    const el = document.createElement('div');
    el.className = 'rest-timer';
    el.id = 'restTimer';
    document.getElementById('app').appendChild(el);

    const paint = () => setHTML(el, h`
      <span class="rest-label">REST</span>
      <span class="rest-time">${mmss(rest.remaining)}</span>
      <button type="button" class="rest-skip" data-action="skip-rest">スキップ</button>
    `);

    paint();
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-action="skip-rest"]')) stopRest();
    });

    rest.timer = setInterval(() => {
      rest.remaining -= 1;
      if (rest.remaining <= 0) {
        stopRest();
        AOS.dom.haptic([60, 40, 60]);
        toast('次のセットへ');
        return;
      }
      paint();
    }, 1000);
  }

  // ---------- interactions ----------

  function repaintRow(rowEl) {
    const exercise = findExercise(rowEl.dataset.ex);
    const set = findSet(rowEl.dataset.ex, rowEl.dataset.set);
    if (!exercise || !set) return;
    rowEl.classList.toggle('done', !!set.completed);
    setHTML(rowEl, setRowInner(exercise, set));
    repaintProgress();
  }

  function repaintProgress() {
    const bar = document.querySelector('.session-bar');
    if (!bar || !state.session) return;
    const counts = AOS.sessions.countSets(state.session);
    const fill = bar.querySelector('.bar-fill');
    const label = bar.querySelector('.session-count');
    if (fill) {
      fill.style.width = `${counts.total ? (counts.done / counts.total) * 100 : 0}%`;
      fill.classList.toggle('green', counts.done === counts.total);
    }
    if (label) label.textContent = `${counts.done} / ${counts.total} セット`;

    const card = document.querySelector(`[data-exercise]`);
    if (!card) return;
    state.session.exercises.forEach((ex) => {
      const el = document.querySelector(`[data-exercise="${ex.exerciseId}"]`);
      if (!el) return;
      const done = ex.sets.filter((s) => s.completed).length;
      const badge = el.querySelector('.exercise-head .badge');
      if (badge) {
        badge.textContent = `${done}/${ex.sets.length}`;
        badge.className = `badge ${done === ex.sets.length ? 'badge-green' : 'badge-quiet'}`;
      }
      el.classList.toggle('done', done === ex.sets.length);
    });
  }

  function toggleSet(rowEl) {
    const set = findSet(rowEl.dataset.ex, rowEl.dataset.set);
    if (!set) return;
    set.completed = !set.completed;
    AOS.dom.haptic(12);
    persistNow();
    repaintRow(rowEl);
    if (set.completed) startRest(); else stopRest();
  }

  function addSet(cardEl) {
    const exercise = findExercise(cardEl.dataset.exercise);
    if (!exercise) return;
    const last = exercise.sets[exercise.sets.length - 1];
    const copy = Object.assign({}, last, { setNumber: exercise.sets.length + 1, completed: false });
    exercise.sets.push(copy);
    persistNow();
    AOS.router.rerender();
  }

  function finishSession() {
    const counts = AOS.sessions.countSets(state.session);
    const volume = AOS.sessions.volume(state.session);

    AOS.sheet.confirm('ワークアウトを終了', {
      message: `${counts.done} / ${counts.total} セット${volume ? ` · ${volume.toLocaleString()} kg` : ''}`,
      confirmLabel: '終了して記録する',
      cancelLabel: '続ける',
      onConfirm() {
        persist.cancel();
        AOS.sessions.finish(state.session).then(() => {
          stopRest();
          toast('記録しました');
          AOS.router.rerender();
        });
      }
    });
  }

  function discardSession() {
    AOS.sheet.confirm('記録を破棄', {
      message: 'このセッションの記録を削除します。取り消せません。',
      confirmLabel: '破棄する',
      danger: true,
      onConfirm() {
        persist.cancel();
        AOS.sessions.discard(state.session).then(() => {
          state.session = null;
          stopRest();
          AOS.router.rerender();
        });
      }
    });
  }

  function openSessionDetail(sessionId) {
    const session = state.history.concat(state.todaysSessions).find((s) => String(s.id) === String(sessionId));
    if (!session) return;
    const workout = AOS.workouts.get(session.workoutType);

    AOS.sheet.open(workout.label, h`
      <div>${(session.exercises || []).map((ex) => {
        const done = ex.sets.filter((s) => s.completed);
        const line = done.length
          ? done.map((s) => setValueLine(ex, s)).join(' / ')
          : '記録なし';
        return h`
          <div class="row">
            <span class="row-main">
              <span class="row-title">${ex.exerciseName}</span>
              <span class="row-sub">${line}</span>
            </span>
          </div>`;
      })}</div>
    `, { subtitle: `${dates.formatJP(session.date)} · ${AOS.sessions.summaryLine(session)}` });
  }

  function openWorkoutPicker() {
    AOS.sheet.choose(
      '今日のメニュー',
      AOS.workouts.ORDER.map((id) => {
        const workout = AOS.workouts.get(id);
        return { id, title: workout.label, sub: workout.sub, active: id === AOS.plan.forDate(state.dateKey) };
      }),
      (id) => AOS.plan.setForDate(state.dateKey, id).then(() => AOS.router.rerender())
    );
  }

  function handleStepper(name, value, stepperEl) {
    if (!state.session) return;
    const rowEl = stepperEl.closest('.set-row');
    if (!rowEl) return;
    const set = findSet(rowEl.dataset.ex, rowEl.dataset.set);
    if (!set) return;

    if (name === 'weight') set.weight = value;
    else if (name === 'reps') set.reps = value;
    else if (name === 'seconds') set.seconds = value === '' ? 0 : value;
    else if (name === 'minutes') set.seconds = (value === '' ? 0 : value) * 60;

    persist();
  }

  function bind(root) {
    const unbinds = [];

    unbinds.push.apply(unbinds, W.bindSteppers(root, handleStepper));

    unbinds.push(delegate(root, 'click', '[data-action="toggle-set"]', (e, target) => {
      toggleSet(target.closest('.set-row'));
    }));

    unbinds.push(delegate(root, 'click', '[data-action="add-set"]', (e, target) => {
      addSet(target.closest('[data-exercise]'));
    }));

    unbinds.push(delegate(root, 'click', '[data-action]', (e, target) => {
      const action = target.dataset.action;
      if (action === 'start') begin(AOS.plan.forDate(state.dateKey)).then(() => AOS.router.rerender());
      else if (action === 'finish') finishSession();
      else if (action === 'discard') discardSession();
      else if (action === 'change-workout') openWorkoutPicker();
    }));

    unbinds.push(delegate(root, 'click', '[data-session]', (e, target) => {
      openSessionDetail(target.dataset.session);
    }));

    unbinds.push(() => { persist.cancel(); persistNow(); });

    return unbinds;
  }

  function onLeave() {
    persistNow();
    stopRest();
  }

  AOS.screens = AOS.screens || {};
  AOS.screens.training = {
    id: 'training', label: 'TRAINING', icon: 'training',
    topbar, render, bind, onLeave, begin
  };

  AOS.router.register(AOS.screens.training);
})(window);
