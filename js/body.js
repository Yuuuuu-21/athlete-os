/* ==========================================================
   body.js — BODY screen: body weight logging + the same
   Condition fields shown on HOME (reads/writes the same
   conditionLogs record so the two screens never disagree).
   ========================================================== */

(function (global) {
  const DB = global.AthleteDB;
  const App = global.App;
  const Condition = global.Condition;

  const WEIGHT_STEP = 0.1;

  const state = {
    weight: '',
    todayRecord: null,
    lastWeight: null,
    lastDate: null,
    condition: { sleep: 3, energy: 3, legs: 3 }
  };

  let bodyRoot = null;    // stable container for event delegation
  let bodyContent = null; // where the dynamic cards are rendered
  let saveTimer = null;

  // ---------- Persistence ----------

  async function loadState() {
    const [bodyLogs, condition] = await Promise.all([
      DB.getAll('bodyLogs'),
      Condition.loadToday(App.todayKey())
    ]);

    const today = App.todayKey();
    const todays = bodyLogs.find((b) => b.date === today) || null;
    state.todayRecord = todays;
    state.weight = todays ? todays.weight : '';

    const past = bodyLogs
      .filter((b) => b.date !== today)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    state.lastWeight = past[0] ? past[0].weight : null;
    state.lastDate = past[0] ? past[0].date : null;

    state.condition.sleep = condition.sleep;
    state.condition.energy = condition.energy;
    state.condition.legs = condition.legs;
    state.conditionLogged = condition.logged;
  }

  function saveWeightNow() {
    clearTimeout(saveTimer);
    const record = state.todayRecord || { date: App.todayKey() };
    record.weight = state.weight;
    DB.put('bodyLogs', record);
    state.todayRecord = record;
  }

  function scheduleSaveWeight() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveWeightNow, 500);
  }

  async function saveCondition() {
    await Condition.save(App.todayKey(), state.condition);
    state.conditionLogged = true;
  }

  // ---------- Rendering ----------

  function render() {
    const lastLine = state.lastWeight != null
      ? `LAST <strong>${state.lastWeight} kg</strong> · ${state.lastDate}`
      : 'LAST —';

    bodyContent.innerHTML = `
      <section class="card">
        <h2 class="card-title">BODY WEIGHT</h2>
        <div class="weight-main">
          <span class="eyebrow">TODAY</span>
          <div class="stepper weight-stepper">
            <button class="stepper-btn" data-action="step" data-dir="-1" aria-label="体重を減らす">−</button>
            <input id="bodyWeightInput" class="stepper-input weight-input" type="text" inputmode="decimal" value="${state.weight}" placeholder="--">
            <span class="unit">kg</span>
            <button class="stepper-btn" data-action="step" data-dir="1" aria-label="体重を増やす">+</button>
          </div>
        </div>
        <p class="last-weight-line">${lastLine}</p>
      </section>

      <section class="card">
        <h2 class="card-title">TODAY'S CONDITION</h2>

        <div class="condition-row" data-field="sleep">
          <div class="condition-label-row">
            <span class="condition-label">Sleep</span>
            <button class="help-btn" data-help="sleep" aria-label="Sleep guide">?</button>
          </div>
          <div class="scale-buttons" data-field="sleep">
            <button class="scale-btn" data-value="1">1</button>
            <button class="scale-btn" data-value="2">2</button>
            <button class="scale-btn" data-value="3">3</button>
            <button class="scale-btn" data-value="4">4</button>
            <button class="scale-btn" data-value="5">5</button>
          </div>
        </div>

        <div class="condition-row" data-field="energy">
          <div class="condition-label-row">
            <span class="condition-label">Energy</span>
            <button class="help-btn" data-help="energy" aria-label="Energy guide">?</button>
          </div>
          <div class="scale-buttons" data-field="energy">
            <button class="scale-btn" data-value="1">1</button>
            <button class="scale-btn" data-value="2">2</button>
            <button class="scale-btn" data-value="3">3</button>
            <button class="scale-btn" data-value="4">4</button>
            <button class="scale-btn" data-value="5">5</button>
          </div>
        </div>

        <div class="condition-row" data-field="legs">
          <div class="condition-label-row">
            <span class="condition-label">Legs</span>
            <button class="help-btn" data-help="legs" aria-label="Legs guide">?</button>
          </div>
          <div class="scale-buttons" data-field="legs">
            <button class="scale-btn" data-value="1">1</button>
            <button class="scale-btn" data-value="2">2</button>
            <button class="scale-btn" data-value="3">3</button>
            <button class="scale-btn" data-value="4">4</button>
            <button class="scale-btn" data-value="5">5</button>
          </div>
        </div>
      </section>
    `;

    renderConditionSelection();
  }

  function renderConditionSelection() {
    ['sleep', 'energy', 'legs'].forEach((field) => {
      const group = bodyRoot.querySelector(`.scale-buttons[data-field="${field}"]`);
      if (!group) return;
      group.querySelectorAll('.scale-btn').forEach((btn) => {
        btn.classList.toggle('selected', Number(btn.dataset.value) === state.condition[field]);
      });
    });
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

  function initEvents() {
    bodyRoot.addEventListener('click', async (e) => {
      const stepBtn = e.target.closest('.stepper-btn');
      if (stepBtn) {
        const dir = Number(stepBtn.dataset.dir);
        const input = document.getElementById('bodyWeightInput');
        const current = parseFloat(input.value) || 0;
        const value = Math.max(0, Math.round((current + dir * WEIGHT_STEP) * 10) / 10);
        input.value = String(value);
        state.weight = value;
        saveWeightNow();
        return;
      }

      const scaleBtn = e.target.closest('.scale-btn');
      if (scaleBtn) {
        const field = scaleBtn.closest('.scale-buttons').dataset.field;
        state.condition[field] = Number(scaleBtn.dataset.value);
        renderConditionSelection();
        await saveCondition();
        return;
      }

      const helpBtn = e.target.closest('.help-btn');
      if (helpBtn) {
        openConditionHelp(helpBtn.dataset.help);
      }
    });

    bodyRoot.addEventListener('input', (e) => {
      if (e.target && e.target.id === 'bodyWeightInput') {
        const raw = e.target.value;
        state.weight = raw === '' ? '' : (Number.isNaN(parseFloat(raw)) ? '' : parseFloat(raw));
        scheduleSaveWeight();
      }
    });

    bodyRoot.addEventListener('blur', (e) => {
      if (e.target && e.target.id === 'bodyWeightInput') {
        saveWeightNow();
      }
    }, true);
  }

  async function refresh() {
    await loadState();
    render();
  }

  async function init() {
    bodyRoot = document.getElementById('viewBody');
    bodyContent = document.getElementById('bodyContent');
    initEvents();
    await loadState();
    render();
  }

  global.Body = { init, refresh };
})(window);
