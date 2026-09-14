/* ==========================================================
   workout-editor.js — editing the training catalogue in-app.

   Two sheets: one for a workout (name, focus, exercise list) and
   one for a single exercise. Nothing is written until 保存 is
   pressed, so backing out of a half-finished edit changes nothing.

   The exercise form deliberately exposes 記録方法 and 部位, because
   both change how the app behaves — how a set is logged, and what
   gets cut when readiness is low.
   ========================================================== */

(function (global) {
  const AOS = global.AOS = global.AOS || {};
  const { h, delegate, toast, escape } = AOS.dom;
  const W = AOS.widgets;

  // The workout currently being edited, as a working copy.
  let draft = null;

  function metricLabel(id) {
    const m = AOS.workouts.METRICS.find((x) => x.id === id);
    return m ? m.label : id;
  }

  function typeLabel(id) {
    const t = AOS.workouts.EXERCISE_TYPES.find((x) => x.id === id);
    return t ? t.label : id;
  }

  function exerciseSummary(exercise) {
    const target = exercise.metric === 'time'
      ? `${exercise.sets} × ${AOS.dom.duration(exercise.seconds)}`
      : `${exercise.sets} × ${exercise.reps}`;
    return `${target} · ${typeLabel(exercise.type)}${exercise.core30 ? ' · 30分版に含む' : ''}`;
  }

  // ---------- workout sheet ----------

  function open(workoutId) {
    const source = workoutId ? AOS.workouts.get(workoutId) : null;

    draft = source
      ? JSON.parse(JSON.stringify(source))
      : {
        id: AOS.workouts.newWorkoutId(),
        label: '',
        sub: '',
        trainable: true,
        focusTitle: '',
        focusDesc: '',
        exercises: []
      };

    render();
  }

  function render() {
    const isNew = !AOS.workouts.WORKOUTS[draft.id];
    const builtin = AOS.workouts.isBuiltin(draft.id);
    const edited = AOS.workouts.isEdited(draft.id);

    const el = AOS.sheet.open(isNew ? 'メニューを追加' : 'メニューを編集', h`
      <label class="field">
        <span class="field-label">メニュー名</span>
        <input class="input" data-f="label" value="${draft.label}" placeholder="例: 自宅トレ">
      </label>
      <label class="field">
        <span class="field-label">サブ表示（英字が映えます）</span>
        <input class="input" data-f="sub" value="${draft.sub}" placeholder="例: HOME CIRCUIT">
      </label>
      <label class="field">
        <span class="field-label">今日の意識（見出し）</span>
        <input class="input" data-f="focusTitle" value="${draft.focusTitle}" placeholder="例: KEEP TENSION">
      </label>
      <label class="field">
        <span class="field-label">今日の意識（ひとこと）</span>
        <input class="input" data-f="focusDesc" value="${draft.focusDesc}" placeholder="例: 反動を使わず、丁寧に">
      </label>

      <div class="editor-head">
        <span class="card-title">種目（${draft.exercises.length}）</span>
        <button class="link-btn" data-add-ex>＋ 種目を追加</button>
      </div>

      ${draft.exercises.length
        ? h`<div>${draft.exercises.map((ex, i) => h`
          <div class="ex-row">
            <button class="ex-main" data-edit-ex="${i}">
              <span class="row-title">${ex.name || '(名称未設定)'}</span>
              <span class="row-sub">${exerciseSummary(ex)}</span>
            </button>
            <div class="ex-move">
              <button class="ex-move-btn" data-move="${i}" data-dir="-1" aria-label="上へ"
                      ${i === 0 ? AOS.dom.raw('disabled') : ''}>▲</button>
              <button class="ex-move-btn" data-move="${i}" data-dir="1" aria-label="下へ"
                      ${i === draft.exercises.length - 1 ? AOS.dom.raw('disabled') : ''}>▼</button>
            </div>
          </div>`)}</div>`
        : h`<p class="meal-empty">種目がありません。追加すると記録画面に出ます。</p>`}

      <button class="btn" data-save style="margin-top:18px">保存する</button>
      ${edited ? h`<button class="btn btn-ghost btn-sm" data-reset style="margin:10px auto 0">初期メニューに戻す</button>` : ''}
      ${!builtin && !isNew ? h`<button class="btn btn-danger btn-sm" data-delete style="margin:10px auto 0">このメニューを削除</button>` : ''}
      ${builtin ? h`<p class="sheet-sub" style="margin-top:14px">A・B・C は元に戻せます。追加したメニューは曜日の割り当てにも出てきます。</p>` : ''}
    `);

    bindWorkoutSheet(el);
  }

  function bindWorkoutSheet(el) {
    delegate(el, 'input', '[data-f]', (e, target) => {
      draft[target.dataset.f] = target.value;
    });

    delegate(el, 'click', '[data-add-ex]', () => {
      openExercise(null);
    });

    delegate(el, 'click', '[data-edit-ex]', (e, target) => {
      openExercise(Number(target.dataset.editEx));
    });

    delegate(el, 'click', '[data-move]', (e, target) => {
      const from = Number(target.dataset.move);
      const to = from + Number(target.dataset.dir);
      if (to < 0 || to >= draft.exercises.length) return;
      const moved = draft.exercises.splice(from, 1)[0];
      draft.exercises.splice(to, 0, moved);
      render();
    });

    delegate(el, 'click', '[data-save]', () => {
      if (!String(draft.label).trim()) {
        toast('メニュー名を入れてください');
        return;
      }
      AOS.workouts.save(draft).then(() => {
        AOS.sheet.close();
        toast('保存しました');
        AOS.router.rerender();
      });
    });

    delegate(el, 'click', '[data-reset]', () => {
      AOS.sheet.confirm('初期メニューに戻す', {
        message: 'このメニューへの変更をすべて破棄して、最初の内容に戻します。',
        confirmLabel: '戻す',
        danger: true,
        onConfirm() {
          AOS.workouts.reset(draft.id).then(() => {
            toast('戻しました');
            AOS.router.rerender();
          });
        }
      });
    });

    delegate(el, 'click', '[data-delete]', () => {
      AOS.sheet.confirm('メニューを削除', {
        message: '曜日に割り当てられている場合はレストに戻ります。過去の記録は残ります。',
        confirmLabel: '削除する',
        danger: true,
        onConfirm() {
          AOS.workouts.remove(draft.id).then(() => {
            toast('削除しました');
            AOS.router.rerender();
          });
        }
      });
    });
  }

  // ---------- exercise sheet ----------

  function openExercise(index) {
    const isNew = index === null;
    const exercise = isNew
      ? AOS.workouts.newExercise(draft.id)
      : JSON.parse(JSON.stringify(draft.exercises[index]));

    const el = AOS.sheet.open(isNew ? '種目を追加' : '種目を編集', h`
      <label class="field">
        <span class="field-label">種目名</span>
        <input class="input" data-e="name" value="${exercise.name}" placeholder="例: 自重スクワット">
      </label>

      <div class="field">
        <span class="field-label">記録方法</span>
        ${W.segmented('metric', AOS.workouts.METRICS.map((m) => ({ value: m.id, label: m.label })), exercise.metric)}
      </div>

      <div class="field">
        <span class="field-label">セット数</span>
        ${W.stepper({ name: 'sets', value: exercise.sets, unit: 'セット', step: 1, decimals: 0, min: 1, label: 'セット数' })}
      </div>

      <div class="field" data-target-reps ${exercise.metric === 'time' ? AOS.dom.raw('hidden') : ''}>
        <span class="field-label">目標回数</span>
        ${W.stepper({ name: 'reps', value: exercise.reps, unit: '回', step: 1, decimals: 0, min: 1, label: '目標回数' })}
      </div>

      <div class="field" data-target-secs ${exercise.metric === 'time' ? '' : AOS.dom.raw('hidden')}>
        <span class="field-label">目標時間</span>
        ${W.stepper({ name: 'seconds', value: exercise.seconds, unit: '秒', step: 5, decimals: 0, min: 5, label: '目標時間' })}
      </div>

      <div class="field">
        <span class="field-label">部位・種類（自動調整に使います）</span>
        <div class="type-grid" data-types>
          ${AOS.workouts.EXERCISE_TYPES.map((t) => h`
            <button type="button" class="type-btn ${t.id === exercise.type ? 'active' : ''}" data-type="${t.id}">
              <span class="type-name">${t.label}</span>
              ${t.note ? h`<span class="type-note">${t.note}</span>` : ''}
            </button>`)}
        </div>
      </div>

      <label class="field">
        <span class="field-label">意識すること（任意）</span>
        <input class="input" data-e="cue" value="${exercise.cue || ''}" placeholder="例: 反動を使わない">
      </label>

      <label class="check-line">
        <input type="checkbox" data-e-core30 ${exercise.core30 ? AOS.dom.raw('checked') : ''}>
        <span>30分版にも入れる</span>
      </label>

      <button class="btn" data-save-ex style="margin-top:16px">${isNew ? '追加する' : '保存する'}</button>
      ${isNew ? '' : h`<button class="btn btn-danger btn-sm" data-del-ex style="margin:10px auto 0">この種目を削除</button>`}
      <button class="btn btn-ghost btn-sm" data-back style="margin:10px auto 0">戻る</button>
    `);

    W.bindSteppers(el, (name, value) => {
      if (name === 'sets') exercise.sets = Math.max(1, value || 1);
      else if (name === 'reps') exercise.reps = Math.max(1, value || 1);
      else if (name === 'seconds') exercise.seconds = Math.max(5, value || 5);
    });

    W.bindSegmented(el, 'metric', (value) => {
      exercise.metric = value;
      el.querySelector('[data-target-reps]').hidden = value === 'time';
      el.querySelector('[data-target-secs]').hidden = value !== 'time';
    });

    delegate(el, 'click', '[data-type]', (e, target) => {
      exercise.type = target.dataset.type;
      el.querySelectorAll('[data-type]').forEach((b) => b.classList.toggle('active', b === target));
    });

    delegate(el, 'input', '[data-e]', (e, target) => {
      exercise[target.dataset.e] = target.value;
    });

    delegate(el, 'change', '[data-e-core30]', (e, target) => {
      exercise.core30 = target.checked;
    });

    delegate(el, 'click', '[data-save-ex]', () => {
      if (!String(exercise.name).trim()) {
        toast('種目名を入れてください');
        return;
      }
      if (isNew) draft.exercises.push(exercise);
      else draft.exercises[index] = exercise;
      render();
    });

    delegate(el, 'click', '[data-del-ex]', () => {
      draft.exercises.splice(index, 1);
      render();
    });

    delegate(el, 'click', '[data-back]', () => render());
  }

  AOS.screens = AOS.screens || {};
  AOS.screens.workoutEditor = { open };
})(window);
