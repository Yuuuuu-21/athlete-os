/* ==========================================================
   settings.js — the settings sheet, plus backup/restore.

   Everything lives in this browser only, so an export file is
   the single way to move to a new phone or recover from a
   cleared cache. It is a first-class button, not an afterthought.
   ========================================================== */

(function (global) {
  const AOS = global.AOS = global.AOS || {};
  const { h, delegate, toast } = AOS.dom;
  const W = AOS.widgets;
  const dates = AOS.dates;

  function settings() { return AOS.store.settings(); }

  function planRow(dow) {
    const workoutId = (settings().planDays || {})[dow] || 'REST';
    const workout = AOS.workouts.get(workoutId);
    return h`
      <button class="row" data-plan-day="${dow}">
        <span class="row-main">
          <span class="row-title">${dates.WD_JP[dow]}曜日</span>
          <span class="row-sub">${workout.sub}</span>
        </span>
        <span class="row-value">${workout.label}</span>
        <span class="row-chevron">${AOS.icons.chevron(16)}</span>
      </button>`;
  }

  function open() {
    const s = settings();

    const el = AOS.sheet.open('設定', h`
      <label class="field">
        <span class="field-label">名前（あいさつに使います）</span>
        <input class="input" data-field="name" value="${s.name || ''}" placeholder="任意">
      </label>

      <p class="card-title" style="margin:20px 0 8px">週のプラン</p>
      <div>${[1, 2, 3, 4, 5, 6, 0].map(planRow)}</div>

      <p class="card-title" style="margin:20px 0 8px">バレーの曜日</p>
      ${W.segmented('vbDay', [0, 1, 2, 3, 4, 5, 6].map((dow) => ({ value: dow, label: dates.WD_JP[dow] })), s.volleyballDow)}

      <p class="card-title" style="margin:20px 0 8px">トレーニング</p>
      ${W.segmented('duration', [{ value: 30, label: '30分' }, { value: 60, label: '60分' }], s.duration)}
      <div class="field" style="margin-top:12px">
        <span class="field-label">セット間の休憩</span>
        ${W.stepper({ name: 'restSeconds', value: s.restSeconds, unit: '秒', step: 15, decimals: 0, label: '休憩時間' })}
      </div>

      <p class="card-title" style="margin:20px 0 8px">体と食事</p>
      <div class="field">
        <span class="field-label">目標体重</span>
        ${W.stepper({ name: 'goalWeightKg', value: s.goalWeightKg, unit: 'kg', step: 0.5, decimals: 1, label: '目標体重' })}
      </div>
      <div class="field">
        <span class="field-label">タンパク質（体重1kgあたり）</span>
        ${W.stepper({ name: 'proteinPerKg', value: s.proteinPerKg, unit: 'g/kg', step: 0.1, decimals: 1, label: 'タンパク質' })}
      </div>
      <div class="field">
        <span class="field-label">水分の目標（杯）</span>
        ${W.stepper({ name: 'waterGoal', value: s.waterGoal, unit: '杯', step: 1, decimals: 0, label: '水分' })}
      </div>

      <p class="card-title" style="margin:20px 0 8px">表示</p>
      ${W.segmented('theme', [
        { value: 'system', label: '自動' },
        { value: 'light', label: 'ライト' },
        { value: 'dark', label: 'ダーク' }
      ], s.theme)}

      <p class="card-title" style="margin:20px 0 8px">バックアップ</p>
      <button class="btn btn-ghost" data-action="export">データを書き出す</button>
      <button class="btn btn-ghost" data-action="import" style="margin-top:8px">ファイルから復元</button>
      <input type="file" accept="application/json,.json" data-import-input hidden>
      <button class="btn btn-danger btn-sm" data-action="reset" style="margin:16px auto 0">すべてのデータを削除</button>

      <p class="sheet-sub" style="margin-top:18px">
        記録はこの端末の中だけに保存されます。機種変更の前に必ず書き出してください。
      </p>
    `, { subtitle: '毎日の運用に合わせて調整できます' });

    bindSheet(el);
  }

  function bindSheet(el) {
    W.bindSteppers(el, (name, value) => {
      const patch = {};
      patch[name] = value === '' ? AOS.store.DEFAULTS[name] : value;
      AOS.store.update(patch);
    });

    W.bindSegmented(el, 'vbDay', (value) => {
      const dow = Number(value);
      const planDays = Object.assign({}, settings().planDays);
      // Move volleyball to the new day and free the old one.
      Object.keys(planDays).forEach((key) => {
        if (planDays[key] === 'VOLLEYBALL') planDays[key] = 'REST';
      });
      planDays[dow] = 'VOLLEYBALL';
      AOS.store.update({ volleyballDow: dow, planDays }).then(() => {
        AOS.sheet.close();
        AOS.router.rerender();
        toast('バレーの曜日を変更しました');
      });
    });

    W.bindSegmented(el, 'duration', (value) => AOS.store.update({ duration: Number(value) }));
    W.bindSegmented(el, 'theme', (value) => AOS.store.update({ theme: value }));

    delegate(el, 'input', '[data-field="name"]', (e, target) => {
      AOS.store.update({ name: target.value.trim() });
    });

    delegate(el, 'click', '[data-plan-day]', (e, target) => {
      const dow = Number(target.dataset.planDay);
      AOS.sheet.choose(`${dates.WD_JP[dow]}曜日のメニュー`, AOS.workouts.ORDER.map((id) => {
        const workout = AOS.workouts.get(id);
        return { id, title: workout.label, sub: workout.sub, active: (settings().planDays || {})[dow] === id };
      }), (id) => {
        const planDays = Object.assign({}, settings().planDays);
        planDays[dow] = id;
        const patch = { planDays };
        if (id === 'VOLLEYBALL') patch.volleyballDow = dow;
        AOS.store.update(patch).then(() => {
          AOS.router.rerender();
          open();
        });
      });
    });

    delegate(el, 'click', '[data-action="export"]', exportData);

    delegate(el, 'click', '[data-action="import"]', () => {
      el.querySelector('[data-import-input]').click();
    });

    delegate(el, 'change', '[data-import-input]', (e, target) => {
      const file = target.files && target.files[0];
      if (file) importData(file);
    });

    delegate(el, 'click', '[data-action="reset"]', () => {
      AOS.sheet.confirm('すべてのデータを削除', {
        message: 'トレーニング・体重・食事の記録がすべて消えます。取り消せません。',
        confirmLabel: '削除する',
        danger: true,
        onConfirm() {
          AOS.db.wipe()
            .then(() => AOS.store.load())
            .then(() => {
              toast('削除しました');
              AOS.router.rerender();
            });
        }
      });
    });
  }

  // ---------- backup ----------

  function exportData() {
    AOS.db.exportAll().then((payload) => {
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `athlete-os-${dates.today()}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast('書き出しました');
    });
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      let payload;
      try {
        payload = JSON.parse(reader.result);
      } catch (err) {
        toast('ファイルを読めませんでした');
        return;
      }

      AOS.sheet.confirm('データを復元', {
        message: '現在の記録は上書きされます。よろしいですか？',
        confirmLabel: '復元する',
        danger: true,
        onConfirm() {
          AOS.db.importAll(payload)
            .then(() => AOS.store.load())
            .then(() => {
              toast('復元しました');
              AOS.router.rerender();
            })
            .catch((err) => toast(err.message || '復元できませんでした'));
        }
      });
    };
    reader.readAsText(file);
  }

  AOS.screens = AOS.screens || {};
  AOS.screens.settings = { open };
})(window);
