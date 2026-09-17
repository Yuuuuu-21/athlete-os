/* ==========================================================
   food.js — protein-first food logging.

   Counting everything by hand doesn't survive a busy week, so
   the screen tracks the one number that changes how training
   lands: protein, against a target derived from body weight.
   Water is a tap counter stored on the same day's body log.
   ========================================================== */

(function (global) {
  const AOS = global.AOS = global.AOS || {};
  const { h, delegate, toast } = AOS.dom;
  const W = AOS.widgets;
  const N = AOS.nutrition;
  const dates = AOS.dates;

  const state = {
    dateKey: dates.today(),
    meals: [],
    bySlot: {},
    total: 0,
    target: null,
    weight: null,
    water: 0
  };

  function settings() { return AOS.store.settings(); }

  // ---------- data ----------

  function load() {
    state.dateKey = AOS.store.viewDate();

    return Promise.all([
      N.load(state.dateKey),
      AOS.stats.allBodyLogs()
    ]).then(([meals, bodyLogs]) => {
      state.meals = meals.sort((a, b) => String(a.loggedAt || '').localeCompare(String(b.loggedAt || '')));
      state.bySlot = N.bySlot(state.meals);
      state.total = Math.round(N.totals(state.meals));

      // The target for a past day uses the weight as it was then, not
      // today's — otherwise backfilled days get judged by a later body.
      const asOf = AOS.stats.latestWeight(bodyLogs.filter((b) => b.date <= state.dateKey))
        || AOS.stats.latestWeight(bodyLogs);
      state.weight = asOf ? Number(asOf.weight) : null;
      state.target = N.proteinTarget(state.weight);

      const todayLog = bodyLogs.filter((r) => r.date === state.dateKey).pop();
      state.water = N.waterFor(todayLog);
    });
  }

  // ---------- pieces ----------

  function proteinCard() {
    const target = state.target;
    const pct = target ? (state.total / target) * 100 : 0;
    const remaining = target ? Math.max(0, target - state.total) : null;
    const tone = !target ? '' : (pct >= 100 ? 'green' : (pct >= 70 ? '' : 'amber'));

    return W.card({
      title: 'PROTEIN',
      action: h`<button class="link-btn" data-action="protein-settings">${settings().proteinPerKg} g/kg</button>`,
      body: target ? h`
        <div class="macro">
          <div class="macro-main">
            <p class="macro-value">${state.total} <span class="weight-unit">/ ${target} g</span></p>
            <p class="macro-target">
              ${remaining > 0 ? `あと ${remaining} g` : '目標達成。'}
            </p>
          </div>
        </div>
        <div style="margin-top:12px">${W.bar(pct, tone)}</div>
        <div class="tiles" style="margin-top:14px">
          ${W.tile('体重基準', `${AOS.dom.num(state.weight)} kg`, `${settings().proteinPerKg} g/kg`)}
          ${W.tile('食事数', state.meals.length, '件')}
          ${W.tile('達成率', `${Math.round(pct)}%`, null, pct >= 100 ? 'delta-up' : '')}
        </div>
      ` : h`
        <p class="macro-value">${state.total} <span class="weight-unit">g</span></p>
        <p class="macro-target">体重を記録すると目標量（体重 × ${settings().proteinPerKg} g）が出ます。</p>
        <button class="btn btn-soft btn-sm" data-action="go-body" style="margin-top:12px">体重を記録する</button>
      `
    });
  }

  function mealSlot(slot) {
    const items = state.bySlot[slot.id] || [];
    const total = Math.round(N.totals(items));

    return h`
      <div class="meal-slot">
        <div class="meal-head">
          <span class="meal-name">${slot.label}</span>
          <span class="meal-total">${total} g</span>
          <button type="button" class="meal-add" data-add-slot="${slot.id}" aria-label="${slot.label}に追加">＋</button>
        </div>
        ${items.length
          ? items.map((item) => h`
            <div class="meal-item">
              <span class="meal-item-name">${item.name}</span>
              <span class="meal-item-p">${Math.round(item.protein)} g</span>
              <button type="button" class="meal-item-del" data-del-meal="${item.id}" aria-label="削除">${AOS.icons.trash(15)}</button>
            </div>`)
          : h`<p class="meal-empty">まだ記録なし</p>`}
      </div>
    `;
  }

  function mealsCard() {
    return W.card({
      title: AOS.store.isViewingPast() ? 'MEALS' : "TODAY'S MEALS",
      body: h`<div>${N.SLOTS.map(mealSlot)}</div>`
    });
  }

  function waterCard() {
    const goal = Number(settings().waterGoal) || 8;
    const over = Math.max(0, state.water - goal);
    // Drinking more than the goal is a good thing, so the row keeps
    // growing past it instead of capping at the last dot.
    const shown = Math.max(goal, state.water);

    const dots = [];
    for (let i = 1; i <= shown; i++) {
      dots.push(h`
        <button type="button" aria-label="${i}杯目"
                class="water-dot ${i <= state.water ? 'filled' : ''} ${i > goal ? 'extra' : ''}"
                data-water="${i}"></button>`);
    }
    dots.push(h`<button type="button" class="water-dot water-add" data-water-add aria-label="1杯追加">＋</button>`);

    return W.card({
      title: 'WATER',
      action: h`<span class="card-title">${state.water} / ${goal} 杯${over ? ` (+${over})` : ''}</span>`,
      body: h`<div class="water-dots">${dots}</div>`
    });
  }

  // ---------- add sheet ----------

  function openAddSheet(slotId) {
    const el = AOS.sheet.open(`${N.slotLabel(slotId)}に追加`, h`
      <div class="chip-row">
        ${N.PRESETS.map((preset) => h`
          <button type="button" class="chip" data-preset="${preset.name}" data-protein="${preset.protein}">
            ${preset.name}<b>${preset.protein}g</b>
          </button>`)}
      </div>

      <div style="margin-top:18px">
        <label class="field">
          <span class="field-label">自由に入力</span>
          <input class="input" data-meal-name placeholder="例: 鶏むね 150g">
        </label>
        <div class="field">
          <span class="field-label">タンパク質</span>
          ${W.stepper({ name: 'protein', value: 20, unit: 'g', step: 1, decimals: 0, label: 'タンパク質' })}
        </div>
        <button class="btn" data-add-custom style="margin-top:14px">追加する</button>
      </div>
    `, { subtitle: 'よく食べるものはワンタップで。' });

    W.bindSteppers(el, () => { /* read on save */ });

    delegate(el, 'click', '[data-preset]', (e, target) => {
      N.add(state.dateKey, slotId, target.dataset.preset, Number(target.dataset.protein)).then(() => {
        AOS.sheet.close();
        AOS.router.rerender();
      });
    });

    delegate(el, 'click', '[data-add-custom]', () => {
      const name = el.querySelector('[data-meal-name]').value.trim();
      const protein = W.stepperValue(el.querySelector('[data-stepper="protein"]'));
      if (!name && protein === '') {
        toast('内容かタンパク質量を入れてください');
        return;
      }
      N.add(state.dateKey, slotId, name || '記録', protein === '' ? 0 : protein).then(() => {
        AOS.sheet.close();
        AOS.router.rerender();
      });
    });
  }

  function openProteinSettings() {
    const el = AOS.sheet.open('タンパク質の目標', h`
      ${W.stepper({ name: 'perKg', value: settings().proteinPerKg, unit: 'g/kg', step: 0.1, decimals: 1, label: '体重1kgあたり' })}
      <p class="sheet-sub" style="margin-top:12px">
        筋量を増やす時期は 1.6〜2.2 g/kg が目安。体重 ${AOS.dom.num(state.weight)} kg なら
        <b data-preview>${state.target || '—'}</b> g。
      </p>
      <button class="btn" data-save-protein>保存</button>
    `);

    W.bindSteppers(el, (name, value) => {
      const preview = el.querySelector('[data-preview]');
      if (preview && state.weight) preview.textContent = Math.round(state.weight * (value || 0));
    });

    delegate(el, 'click', '[data-save-protein]', () => {
      const value = W.stepperValue(el.querySelector('[data-stepper="perKg"]'));
      AOS.store.update({ proteinPerKg: value === '' ? 1.8 : value }).then(() => {
        AOS.sheet.close();
        AOS.router.rerender();
      });
    });
  }

  function setWater(count) {
    const next = Math.max(0, count);
    state.water = next;
    AOS.dom.haptic(6);
    return AOS.stats.saveBodyLog(state.dateKey, { water: next }).then(() => AOS.router.rerender());
  }

  // ---------- screen ----------

  function render() {
    return load().then(() => h`
      ${proteinCard()}
      ${mealsCard()}
      ${waterCard()}
    `);
  }

  function topbar() {
    return { eyebrow: 'FOOD · 食事', dateNav: true };
  }

  function bind(root) {
    const unbinds = [];

    unbinds.push(delegate(root, 'click', '[data-add-slot]', (e, target) => {
      openAddSheet(target.dataset.addSlot);
    }));

    unbinds.push(delegate(root, 'click', '[data-del-meal]', (e, target) => {
      N.remove(Number(target.dataset.delMeal)).then(() => AOS.router.rerender());
    }));

    unbinds.push(delegate(root, 'click', '[data-water]', (e, target) => {
      const tapped = Number(target.dataset.water);
      // Tapping the current last dot clears it, so an accidental tap is undoable.
      setWater(tapped === state.water ? tapped - 1 : tapped);
    }));

    unbinds.push(delegate(root, 'click', '[data-water-add]', () => setWater(state.water + 1)));

    unbinds.push(delegate(root, 'click', '[data-action]', (e, target) => {
      const action = target.dataset.action;
      if (action === 'protein-settings') openProteinSettings();
      else if (action === 'go-body') AOS.router.go('body');
    }));

    return unbinds;
  }

  AOS.screens = AOS.screens || {};
  AOS.screens.food = { id: 'food', label: 'FOOD', icon: 'food', topbar, render, bind };

  AOS.router.register(AOS.screens.food);
})(window);
