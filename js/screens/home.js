/* ==========================================================
   home.js — the daily cockpit.

   Order of the screen follows the order of the morning:
   rate how you slept -> see what that means -> see today's
   session already adjusted for it -> start.
   ========================================================== */

(function (global) {
  const AOS = global.AOS = global.AOS || {};
  const { h, delegate, num, toast } = AOS.dom;
  const W = AOS.widgets;
  const dates = AOS.dates;

  const state = {
    dateKey: dates.today(),
    condition: Object.assign({}, AOS.condition.EMPTY),
    logged: false,
    adjust: null,
    workoutId: 'REST',
    session: null,        // today's session (in progress or finished)
    bodyLog: null,
    meals: [],
    streak: 0,
    weight: '',
    lastWeight: null,
    // The morning card collapses once it has everything; `expand`
    // lets you reopen it to change an answer.
    expand: false,
    showExercises: false
  };

  function settings() { return AOS.store.settings(); }

  // ---------- data ----------

  function load() {
    state.dateKey = dates.today();
    state.workoutId = AOS.plan.forDate(state.dateKey);

    return Promise.all([
      AOS.condition.load(state.dateKey),
      AOS.sessions.forDate(state.dateKey),
      AOS.stats.bodyLogFor(state.dateKey),
      AOS.nutrition.load(state.dateKey),
      AOS.db.getAll('conditionLogs'),
      AOS.stats.allBodyLogs()
    ]).then(([condition, sessions, bodyLog, meals, conditionRows, bodyLogs]) => {
      state.lastWeight = AOS.stats.latestWeight(bodyLogs.filter((b) => b.date !== state.dateKey));
      state.logged = condition.complete;
      state.condition = { sleep: condition.sleep, energy: condition.energy, legs: condition.legs };
      state.adjust = AOS.condition.evaluate(state.condition);
      state.session = sessions.find((s) => s.status === 'in_progress') || sessions[0] || null;
      state.bodyLog = bodyLog;
      state.weight = bodyLog && bodyLog.weight !== undefined && bodyLog.weight !== null ? bodyLog.weight : '';
      state.meals = meals;
      state.streak = AOS.stats.streak(conditionRows);
    });
  }

  // ---------- what today actually requires ----------

  function hasWeight() {
    return state.weight !== '' && Number(state.weight) > 0;
  }

  // A session finished with nothing logged is recorded as 'skipped';
  // that is not a day's training done.
  function trainingDone() {
    return !!state.session && (state.session.status === 'completed' || state.session.status === 'partial');
  }

  // Condition and weight are every-day items. Training only counts on
  // a day the plan actually asks for it; food is a target, not a duty.
  function requiredItems() {
    const workout = AOS.workouts.get(state.workoutId);
    const items = [
      { id: 'condition', done: state.adjust.complete },
      { id: 'weight', done: hasWeight() }
    ];
    if (workout.trainable) items.push({ id: 'training', done: trainingDone() });
    return items;
  }

  function requiredProgress() {
    const items = requiredItems();
    return { done: items.filter((i) => i.done).length, total: items.length };
  }

  function morningDone() {
    return state.adjust.complete && hasWeight();
  }

  // Without all three ratings there is nothing to adjust from, and
  // `evaluate` already returns neutral values in that case.
  function effectiveAdjust() {
    return state.adjust;
  }

  // ---------- pieces ----------

  // One card for the whole morning: the three ratings, the weight, and
  // the readiness they produce. Previously the score sat in a card of
  // its own above the inputs, which put an untouchable summary in the
  // most prominent spot and the actual work below the fold.
  function morningCard() {
    const workout = AOS.workouts.get(state.workoutId);
    const complete = morningDone();
    const open = state.expand || !complete;

    const head = complete
      ? h`
        <div class="hero">
          ${W.ring(state.adjust.score, 15, state.adjust.level.tone, `/ 15 · ${state.adjust.level.status}`)}
          <div class="hero-main">
            <span class="badge badge-${state.adjust.level.tone}">${state.adjust.level.status}</span>
            <p class="hero-status">${state.adjust.level.title}</p>
            <p class="hero-desc">${state.adjust.level.desc}</p>
          </div>
        </div>`
      : h`
        <div class="hero">
          ${W.ring(state.adjust.complete ? state.adjust.score : '—', 15,
                   state.adjust.complete ? state.adjust.level.tone : 'line-strong',
                   state.adjust.complete ? '/ 15' : `${state.adjust.filled} / 3`)}
          <div class="hero-main">
            <p class="hero-status">今朝の記録</p>
            <p class="hero-desc">${morningPrompt()}</p>
          </div>
        </div>`;

    return W.card({
      className: 'morning-card',
      title: 'MORNING CHECK',
      action: complete
        ? h`<button class="link-btn" data-action="toggle-morning">${open ? '閉じる' : '変更'}</button>`
        : h`<span class="badge badge-quiet">${requiredProgress().done} / ${requiredProgress().total}</span>`,
      body: h`
        ${head}
        ${state.adjust.warnings.length ? h`<p class="hero-note">${state.adjust.warnings[0]}</p>` : ''}
        ${workout.trainable ? '' : h`<p class="hero-note">今日は${workout.label}。${workout.focusDesc}</p>`}

        ${open ? h`
          <div class="morning-body">
            ${W.conditionScales(state.condition)}
            <div class="morning-weight">
              <div class="scale-label-row">
                <span class="scale-label">体重</span>
                <span class="scale-hint">${weightHint()}</span>
              </div>
              ${W.stepper({ name: 'weight', value: state.weight, unit: 'kg', step: 0.1, decimals: 1, placeholder: '--', label: '体重' })}
            </div>
          </div>`
          : h`<p class="morning-summary">睡眠 ${state.condition.sleep} · 気力 ${state.condition.energy} · 脚 ${state.condition.legs} · 体重 ${num(state.weight)} kg</p>`}
      `
    });
  }

  function morningPrompt() {
    if (!state.adjust.complete) {
      return state.adjust.filled
        ? `あと ${state.adjust.remaining} つ選ぶと、今日のメニューが決まる。`
        : '3つ選んで体重を入れるだけ。今日のメニューの重さとセット数が、その場で決まる。';
    }
    return hasWeight() ? '' : '体重を入れれば今朝の記録は完了。';
  }

  function weightHint() {
    const latest = state.lastWeight;
    if (hasWeight()) return '記録済み';
    return latest ? `前回 ${num(latest.weight)} kg` : '';
  }

  function planCard() {
    const workout = AOS.workouts.get(state.workoutId);
    const adjust = effectiveAdjust();
    const duration = settings().duration;

    const prescribed = workout.trainable
      ? AOS.workouts.prescribe(workout.id, duration, adjust)
      : [];

    const adjustLine = adjust.complete && workout.trainable && adjust.level
      ? h`<div class="plan-adjust ${adjust.level.tone}">${AOS.icons.spark(16)}<span>${adjust.level.prescription}</span></div>`
      : '';

    // The list is the same every week, so it stays folded away by
    // default rather than costing a screenful of scroll every day.
    const preview = prescribed.length ? h`
      <button class="plan-toggle" data-action="toggle-exercises">
        ${state.showExercises ? '種目を隠す' : `種目を見る (${prescribed.length})`}
        ${AOS.icons.chevron(14)}
      </button>
      ${state.showExercises ? h`
        <ul class="plan-preview">
          ${prescribed.map((ex) => h`<li><span>${ex.name}</span><span>${AOS.workouts.targetLabel(ex)}</span></li>`)}
        </ul>` : ''}` : '';

    const checklist = workout.checklist ? h`
      <ul class="plan-preview">
        ${workout.checklist.map((item) => h`<li><span>${item}</span><span></span></li>`)}
      </ul>` : '';

    return W.card({
      title: 'TODAY',
      action: h`<button class="link-btn" data-action="change-workout">変更</button>`,
      body: h`
        <p class="plan-name">${workout.label}</p>
        <p class="plan-sub">${workout.sub}</p>
        ${adjustLine}
        ${workout.trainable ? h`
          <div style="margin-top:14px">
            ${W.segmented('duration', [{ value: 30, label: '30分' }, { value: 60, label: '60分' }], duration)}
          </div>` : ''}
        <div class="focus">
          <span class="eyebrow">TODAY'S FOCUS</span>
          <p class="focus-title">${workout.focusTitle}</p>
          <p class="focus-desc">${workout.focusDesc}</p>
        </div>
        ${preview}${checklist}
      `
    });
  }

  function actionButton() {
    const workout = AOS.workouts.get(state.workoutId);

    if (!workout.trainable) {
      if (workout.id === 'VOLLEYBALL') {
        return h`<button class="btn" data-action="log-volleyball">練習を記録する</button>`;
      }
      return h`<button class="btn btn-ghost" data-action="go-body">体重とコンディションを記録</button>`;
    }

    if (state.session && state.session.status === 'in_progress') {
      const counts = AOS.sessions.countSets(state.session);
      return h`<button class="btn" data-action="start">${AOS.icons.timer(18)}トレーニング再開 · ${counts.done}/${counts.total}</button>`;
    }

    if (state.session) {
      return h`
        <button class="btn btn-soft" data-action="go-training">
          ${AOS.icons.check(18)}完了 · ${AOS.sessions.summaryLine(state.session)}
        </button>`;
    }

    return h`<button class="btn" data-action="start">トレーニング開始</button>`;
  }

  function volleyballStrip() {
    const vb = AOS.plan.volleyball(state.dateKey);

    if (!vb) {
      return h`
        <button class="vb-strip vb-strip-empty" data-action="settings" style="margin-top:var(--gap)">
          <span>
            <span class="vb-label">VOLLEYBALL</span>
            <span class="vb-days">予定を入れる</span>
          </span>
          <span class="vb-when">設定 ›</span>
        </button>
      `;
    }

    return h`
      <button class="vb-strip" data-action="settings" style="margin-top:var(--gap)">
        <span>
          <span class="vb-label">VOLLEYBALL</span>
          <span class="vb-days">${vb.label}</span>
        </span>
        <span class="vb-when">${vb.when}${vb.fromSchedule ? '' : ' · 毎週'}</span>
      </button>
    `;
  }

  // Four rows that used to look equally obligatory. They aren't:
  // two are every-day, training depends on the plan, food is a target.
  function checklistCard() {
    const weightForTarget = hasWeight()
      ? Number(state.weight)
      : (state.lastWeight ? Number(state.lastWeight.weight) : null);
    const target = AOS.nutrition.proteinTarget(weightForTarget);
    const protein = Math.round(AOS.nutrition.totals(state.meals));
    const workout = AOS.workouts.get(state.workoutId);

    const items = [
      {
        label: 'コンディション',
        kind: 'required',
        done: state.adjust.complete,
        value: state.adjust.complete
          ? `${state.adjust.score} / 15`
          : (state.adjust.filled ? `${state.adjust.filled} / 3` : '未記録'),
        action: 'focus-morning'
      },
      {
        label: '体重',
        kind: 'required',
        done: hasWeight(),
        value: hasWeight() ? `${num(state.weight)} kg` : '未記録',
        action: 'focus-morning'
      },
      workout.trainable
        ? {
          label: 'トレーニング',
          kind: 'required',
          done: trainingDone(),
          value: state.session ? AOS.sessions.statusLabel(state.session.status) : '未実施',
          go: 'training'
        }
        : {
          label: 'トレーニング',
          kind: 'na',
          done: false,
          value: workout.id === 'VOLLEYBALL' ? 'バレーの日' : '休養日',
          go: 'training'
        },
      {
        label: 'タンパク質',
        kind: 'goal',
        done: !!target && protein >= target,
        value: target ? `${protein} / ${target} g` : `${protein} g`,
        go: 'food'
      }
    ];

    const progress = requiredProgress();

    return W.card({
      title: "TODAY'S LOG",
      action: state.streak > 1 ? h`<span class="badge badge-brand">${state.streak}日連続</span>` : '',
      body: h`
        <div>${items.map((item) => h`
          <button class="check-item kind-${item.kind} ${item.done ? 'done' : ''}"
                  ${item.go ? h`data-go-screen="${item.go}"` : ''}
                  ${item.action ? h`data-action="${item.action}"` : ''}>
            <span class="check-mark">${item.done ? AOS.icons.check(15) : ''}</span>
            <span class="check-label">
              ${item.label}
              ${item.kind === 'required' ? h`<span class="check-tag">毎日</span>` : ''}
              ${item.kind === 'goal' ? h`<span class="check-tag quiet">目標</span>` : ''}
            </span>
            <span class="check-value">${item.value}</span>
          </button>
        `)}</div>
        <p class="check-footer">
          ${progress.done >= progress.total
            ? '今日の必須はすべて記録済み。'
            : `毎日の記録があと ${progress.total - progress.done} つ`}
        </p>
      `
    });
  }

  // ---------- screen ----------

  function render() {
    return load().then(() => h`
      ${morningCard()}
      ${planCard()}
      ${actionButton()}
      ${volleyballStrip()}
      ${checklistCard()}
    `);
  }

  function topbar() {
    const progress = requiredProgress();
    const allDone = progress.done >= progress.total;

    return {
      eyebrow: `${dates.greeting()}${settings().name ? `, ${settings().name}` : ''}`,
      title: dates.formatJP(state.dateKey),
      action: h`
        <div class="topbar-actions">
          <span class="today-progress ${allDone ? 'done' : ''}">
            ${allDone ? AOS.icons.check(13) : ''}${progress.done} / ${progress.total}
          </span>
          <button class="icon-btn" data-action="settings" aria-label="設定">${AOS.icons.settings(22)}</button>
        </div>`
    };
  }

  function saveCondition() {
    return AOS.condition.save(state.dateKey, state.condition).then(() => AOS.router.rerender());
  }

  function openWorkoutPicker() {
    AOS.sheet.choose(
      '今日のメニュー',
      AOS.workouts.ORDER.map((id) => {
        const workout = AOS.workouts.get(id);
        return { id, title: workout.label, sub: workout.sub, active: id === state.workoutId };
      }),
      (id) => {
        AOS.plan.setForDate(state.dateKey, id).then(() => AOS.router.rerender());
      },
      { subtitle: '今日だけの変更。曜日ごとの基本プランは設定から。' }
    );
  }

  function startTraining() {
    return AOS.screens.training.begin(state.workoutId).then(() => AOS.router.go('training'));
  }

  const saveWeight = AOS.dom.debounce((value) => {
    AOS.stats.saveBodyLog(state.dateKey, { weight: value === '' ? '' : Number(value) });
  }, 450);

  function bind(root) {
    const unbinds = [];
    let weightEdited = false;

    unbinds.push.apply(unbinds, W.bindScales(root, (field, value) => {
      state.condition[field] = value;
      saveCondition();
    }));

    unbinds.push.apply(unbinds, W.bindSteppers(root, (name, value, el, immediate) => {
      if (name !== 'weight') return;
      weightEdited = true;
      state.weight = value;

      if (!immediate) {
        saveWeight(value);
        return;
      }

      // Tapping +/- or leaving the field: save and repaint so the
      // checklist and the progress badge agree with what was typed.
      // The card is pinned open so it can't collapse out from under
      // a finger that is still adjusting the number.
      saveWeight.flush(value);
      state.expand = true;
      AOS.router.rerender();
    }));

    unbinds.push(W.bindSegmented(root, 'duration', (value) => {
      AOS.store.update({ duration: Number(value) }).then(() => AOS.router.rerender());
    }));

    unbinds.push(delegate(root, 'click', '[data-action]', (e, target) => {
      const action = target.dataset.action;
      if (action === 'change-workout') openWorkoutPicker();
      else if (action === 'start') startTraining();
      else if (action === 'go-training') AOS.router.go('training');
      else if (action === 'go-body') AOS.router.go('body');
      else if (action === 'log-volleyball') AOS.router.go('review').then(() => AOS.screens.review.openVolleyballForm());
      else if (action === 'toggle-exercises') {
        state.showExercises = !state.showExercises;
        AOS.router.rerender();
      } else if (action === 'toggle-morning') {
        state.expand = !state.expand;
        AOS.router.rerender();
      } else if (action === 'focus-morning') {
        // The checklist reports the morning items; the card edits them.
        state.expand = true;
        AOS.router.rerender().then(() => {
          const card = root.querySelector('.morning-card');
          if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    }));

    unbinds.push(delegate(root, 'click', '[data-go-screen]', (e, target) => {
      AOS.router.go(target.dataset.goScreen);
    }));

    // The settings button lives in the topbar, outside the screen root.
    unbinds.push(delegate(document.getElementById('topbar'), 'click', '[data-action="settings"]', () => {
      AOS.screens.settings.open();
    }));

    unbinds.push(() => { if (weightEdited) saveWeight.flush(state.weight); });

    return unbinds;
  }

  // Arriving on HOME always starts from the compact view: yesterday's
  // expanded state is not interesting this morning.
  function onEnter() {
    state.expand = false;
    state.showExercises = false;
  }

  AOS.screens = AOS.screens || {};
  AOS.screens.home = {
    id: 'home', label: 'HOME', icon: 'home',
    topbar, render, bind, onEnter,
    notify: (message) => toast(message)
  };

  AOS.router.register(AOS.screens.home);
})(window);
