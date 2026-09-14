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
    streak: 0
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
      AOS.db.getAll('conditionLogs')
    ]).then(([condition, sessions, bodyLog, meals, conditionRows]) => {
      state.logged = condition.complete;
      state.condition = { sleep: condition.sleep, energy: condition.energy, legs: condition.legs };
      state.adjust = AOS.condition.evaluate(state.condition);
      state.session = sessions.find((s) => s.status === 'in_progress') || sessions[0] || null;
      state.bodyLog = bodyLog;
      state.meals = meals;
      state.streak = AOS.stats.streak(conditionRows);
    });
  }

  // Without all three ratings there is nothing to adjust from, and
  // `evaluate` already returns neutral values in that case.
  function effectiveAdjust() {
    return state.adjust;
  }

  // ---------- pieces ----------

  function readinessCard() {
    const workout = AOS.workouts.get(state.workoutId);

    if (!state.adjust.complete) {
      const filled = state.adjust.filled;
      return W.card({
        title: 'READINESS',
        body: h`
          <div class="hero">
            ${W.ring(0, 15, 'line-strong', filled ? `${filled} / 3` : '未記録')}
            <div class="hero-main">
              <p class="hero-status">今朝の状態は？</p>
              <p class="hero-desc">
                ${filled
                  ? `あと ${state.adjust.remaining} つ選ぶと、今日のメニューが決まる。`
                  : '3つ選ぶだけ。今日のメニューの重さとセット数が、その場で決まる。'}
              </p>
            </div>
          </div>
        `
      });
    }

    const { score, level, warnings } = state.adjust;
    return W.card({
      title: 'READINESS',
      body: h`
        <div class="hero">
          ${W.ring(score, 15, level.tone, `/ 15 · ${level.status}`)}
          <div class="hero-main">
            <span class="badge badge-${level.tone}">${level.status}</span>
            <p class="hero-status">${level.title}</p>
            <p class="hero-desc">${level.desc}</p>
          </div>
        </div>
        ${warnings.length ? h`<p class="hero-note">${warnings[0]}</p>` : ''}
        ${workout.trainable ? '' : h`<p class="hero-note">今日は${workout.label}。${workout.focusDesc}</p>`}
      `
    });
  }

  function conditionCard() {
    return W.card({
      title: "TODAY'S CONDITION",
      action: state.adjust.complete ? h`<span class="badge badge-quiet">記録済み</span>` : '',
      body: h`<div>${W.conditionScales(state.condition)}</div>`
    });
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

    const preview = prescribed.length ? h`
      <ul class="plan-preview">
        ${prescribed.map((ex) => h`<li><span>${ex.name}</span><span>${AOS.workouts.targetLabel(ex)}</span></li>`)}
      </ul>` : '';

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

  function checklistCard() {
    const target = AOS.nutrition.proteinTarget(state.bodyLog ? Number(state.bodyLog.weight) : null);
    const protein = Math.round(AOS.nutrition.totals(state.meals));
    const workout = AOS.workouts.get(state.workoutId);

    const items = [
      {
        label: 'コンディション',
        done: state.adjust.complete,
        value: state.adjust.complete
          ? `${state.adjust.score} / 15`
          : (state.adjust.filled ? `${state.adjust.filled} / 3` : '未記録'),
        go: null
      },
      {
        label: 'トレーニング',
        done: !!state.session && state.session.status !== 'in_progress',
        value: !workout.trainable
          ? '—'
          : (state.session ? AOS.sessions.statusLabel(state.session.status) : '未実施'),
        go: 'training'
      },
      {
        label: '体重',
        done: !!(state.bodyLog && state.bodyLog.weight),
        value: state.bodyLog && state.bodyLog.weight ? `${num(state.bodyLog.weight)} kg` : '未記録',
        go: 'body'
      },
      {
        label: 'タンパク質',
        done: !!target && protein >= target,
        value: target ? `${protein} / ${target} g` : `${protein} g`,
        go: 'food'
      }
    ];

    return W.card({
      title: "TODAY'S LOG",
      action: state.streak > 1 ? h`<span class="badge badge-brand">${state.streak}日連続</span>` : '',
      body: h`<div>${items.map((item) => h`
        <button class="check-item ${item.done ? 'done' : ''}" ${item.go ? h`data-go-screen="${item.go}"` : ''}>
          <span class="check-mark">${item.done ? AOS.icons.check(15) : (item.go ? AOS.icons.chevron(14) : '')}</span>
          <span class="check-label">${item.label}</span>
          <span class="check-value">${item.value}</span>
        </button>
      `)}</div>`
    });
  }

  // ---------- screen ----------

  function render() {
    return load().then(() => h`
      ${readinessCard()}
      ${conditionCard()}
      ${planCard()}
      ${actionButton()}
      ${volleyballStrip()}
      ${checklistCard()}
    `);
  }

  function topbar() {
    return {
      eyebrow: `${dates.greeting()}${settings().name ? `, ${settings().name}` : ''}`,
      title: dates.formatJP(state.dateKey),
      action: h`<button class="icon-btn" data-action="settings" aria-label="設定">${AOS.icons.settings(22)}</button>`
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

  function bind(root) {
    const unbinds = [];

    unbinds.push.apply(unbinds, W.bindScales(root, (field, value) => {
      state.condition[field] = value;
      saveCondition();
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
    }));

    unbinds.push(delegate(root, 'click', '[data-go-screen]', (e, target) => {
      AOS.router.go(target.dataset.goScreen);
    }));

    // The settings button lives in the topbar, outside the screen root.
    unbinds.push(delegate(document.getElementById('topbar'), 'click', '[data-action="settings"]', () => {
      AOS.screens.settings.open();
    }));

    return unbinds;
  }

  AOS.screens = AOS.screens || {};
  AOS.screens.home = {
    id: 'home', label: 'HOME', icon: 'home',
    topbar, render, bind,
    notify: (message) => toast(message)
  };

  AOS.router.register(AOS.screens.home);
})(window);
