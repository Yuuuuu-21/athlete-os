/* ==========================================================
   widgets.js — the shared building blocks every screen uses.
   Pure markup builders plus the two behaviours (steppers and
   1-5 scales) that would otherwise be re-implemented five times.
   ========================================================== */

(function (global) {
  const AOS = global.AOS = global.AOS || {};
  const { h, raw, delegate, parseNum, clamp, round } = AOS.dom;
  const icons = AOS.icons;

  // ---------- containers ----------

  function card(options) {
    const o = options || {};
    return h`
      <section class="card ${o.className || ''}" ${o.id ? raw(`id="${o.id}"`) : ''}>
        ${o.title || o.action ? h`
          <div class="card-head">
            <h2 class="card-title">${o.title || ''}</h2>
            ${o.action || ''}
          </div>` : ''}
        ${o.body}
      </section>
    `;
  }

  function sectionHead(title, action) {
    return h`<div class="section-head"><h2 class="card-title">${title}</h2>${action || ''}</div>`;
  }

  function empty(title, text) {
    return h`<div class="empty"><p class="empty-title">${title}</p>${text ? h`<p class="empty-text">${text}</p>` : ''}</div>`;
  }

  // ---------- readiness ring ----------

  // `value` is rendered as given, so a caller can pass "—" for an
  // unmeasured state; the arc uses its numeric value, or nothing.
  function ring(value, max, tone, caption) {
    const R = 52;
    const C = 2 * Math.PI * R;
    const numeric = Number(value);
    const pct = max && Number.isFinite(numeric) ? clamp(numeric / max, 0, 1) : 0;
    const offset = C * (1 - pct);

    return h`
      <div class="ring-wrap ring">
        <svg viewBox="0 0 120 120" width="118" height="118">
          <circle class="ring-track" cx="60" cy="60" r="${R}" fill="none" stroke-width="10"></circle>
          <circle class="ring-value" cx="60" cy="60" r="${R}" fill="none" stroke-width="10"
                  style="stroke: var(--${tone}); stroke-dasharray: ${round(C, 1)}; stroke-dashoffset: ${round(offset, 1)}"></circle>
        </svg>
        <div class="ring-center">
          <span class="ring-num">${value}</span>
          <span class="ring-den">${caption || `/ ${max}`}</span>
        </div>
      </div>
    `;
  }

  // ---------- progress ----------

  function bar(pct, tone) {
    return h`<div class="bar"><div class="bar-fill ${tone || ''}" style="width: ${clamp(pct, 0, 100)}%"></div></div>`;
  }

  function tile(label, value, sub, valueClass) {
    return h`
      <div class="tile">
        <p class="tile-label">${label}</p>
        <p class="tile-value ${valueClass || ''}">${value}</p>
        ${sub ? h`<p class="tile-sub">${sub}</p>` : ''}
      </div>
    `;
  }

  // ---------- segmented control ----------

  function segmented(name, options, value) {
    return h`
      <div class="segmented" data-segmented="${name}">
        ${options.map((opt) => h`
          <button type="button" class="${String(opt.value) === String(value) ? 'active' : ''}"
                  data-seg-value="${opt.value}">${opt.label}</button>
        `)}
      </div>
    `;
  }

  function bindSegmented(root, name, onChange) {
    return delegate(root, 'click', `[data-segmented="${name}"] [data-seg-value]`, (e, target) => {
      const group = target.closest('[data-segmented]');
      group.querySelectorAll('[data-seg-value]').forEach((b) => b.classList.toggle('active', b === target));
      onChange(target.dataset.segValue);
    });
  }

  // ---------- 1-5 scale ----------

  function scaleRow(field, label, value, hint) {
    return h`
      <div class="scale-row" data-scale-row="${field}">
        <div class="scale-label-row">
          <span class="scale-label">${label}</span>
          <button type="button" class="help-btn" data-help="${field}" aria-label="${label}の目安">?</button>
          <span class="scale-hint" data-hint="${field}">${hint || ''}</span>
        </div>
        <div class="scale-btns" data-scale="${field}">
          ${[1, 2, 3, 4, 5].map((n) => h`
            <button type="button" class="scale-btn ${AOS.condition.isSet(value) && Number(value) === n ? 'selected' : ''}"
                    data-value="${n}">${n}</button>
          `)}
        </div>
      </div>
    `;
  }

  // Renders the three condition fields together.
  function conditionScales(condition) {
    return AOS.condition.FIELDS.map((field) => scaleRow(
      field.id,
      field.label,
      condition[field.id],
      AOS.condition.hintFor(field.id, condition[field.id])
    ));
  }

  // onPick(field, value). Updates the selected state and the hint
  // line in place so the tap feels instant and nothing re-renders.
  function bindScales(root, onPick) {
    const unbindPick = delegate(root, 'click', '[data-scale] .scale-btn', (e, target) => {
      const group = target.closest('[data-scale]');
      const field = group.dataset.scale;
      const value = Number(target.dataset.value);

      group.querySelectorAll('.scale-btn').forEach((b) => b.classList.toggle('selected', b === target));
      const hint = root.querySelector(`[data-hint="${field}"]`);
      if (hint) hint.textContent = AOS.condition.hintFor(field, value);

      AOS.dom.haptic(8);
      onPick(field, value);
    });

    const unbindHelp = delegate(root, 'click', '[data-help]', (e, target) => {
      openScaleHelp(target.dataset.help);
    });

    return [unbindPick, unbindHelp];
  }

  function openScaleHelp(field) {
    const levels = AOS.condition.HELP[field];
    if (!levels) return;
    const meta = AOS.condition.FIELDS.find((f) => f.id === field);
    AOS.sheet.open(meta ? meta.label : field, h`
      <div>${levels.map(([n, text]) => h`
        <div class="help-row"><span class="help-num">${n}</span><span class="help-text">${text}</span></div>
      `)}</div>
    `, { subtitle: '感覚で選んでいい。毎日同じ基準で選ぶことのほうが大事。' });
  }

  // ---------- stepper ----------

  function stepper(options) {
    const o = options || {};
    const step = o.step || 1;
    return h`
      <div class="stepper" data-stepper="${o.name}" data-step-size="${step}"
           data-min="${o.min === undefined ? 0 : o.min}" data-decimals="${o.decimals === undefined ? 1 : o.decimals}">
        <button type="button" class="stepper-btn" data-step="-1" aria-label="減らす">${icons.minus(18)}</button>
        <input class="stepper-input" type="text" inputmode="${o.decimals ? 'decimal' : 'numeric'}"
               value="${o.value === '' || o.value === null || o.value === undefined ? '' : o.value}"
               placeholder="${o.placeholder || '—'}" aria-label="${o.label || o.name}">
        ${o.unit ? h`<span class="stepper-unit">${o.unit}</span>` : ''}
        <button type="button" class="stepper-btn" data-step="1" aria-label="増やす">${icons.plus(18)}</button>
      </div>
    `;
  }

  function stepperValue(stepperEl) {
    return parseNum(stepperEl.querySelector('.stepper-input').value);
  }

  // onChange(name, value, stepperEl, viaButton)
  function bindSteppers(root, onChange) {
    const unbindClick = delegate(root, 'click', '[data-stepper] [data-step]', (e, target) => {
      const el = target.closest('[data-stepper]');
      const input = el.querySelector('.stepper-input');
      const size = Number(el.dataset.stepSize) || 1;
      const decimals = Number(el.dataset.decimals) || 0;
      const min = el.dataset.min === '' ? -Infinity : Number(el.dataset.min);
      const direction = Number(target.dataset.step);

      const current = parseNum(input.value);
      const next = Math.max(min, round((current === '' ? 0 : current) + direction * size, decimals));
      input.value = String(next);
      AOS.dom.haptic(6);
      onChange(el.dataset.stepper, next, el, true);
    });

    const unbindInput = delegate(root, 'input', '[data-stepper] .stepper-input', (e, target) => {
      const el = target.closest('[data-stepper]');
      onChange(el.dataset.stepper, parseNum(target.value), el, false);
    });

    // blur doesn't bubble, so capture it to flush pending edits
    const flush = (e) => {
      const target = e.target;
      if (target && target.classList && target.classList.contains('stepper-input')) {
        const el = target.closest('[data-stepper]');
        onChange(el.dataset.stepper, parseNum(target.value), el, true);
      }
    };
    root.addEventListener('blur', flush, true);

    return [unbindClick, unbindInput, () => root.removeEventListener('blur', flush, true)];
  }

  AOS.widgets = {
    card, sectionHead, empty, ring, bar, tile,
    segmented, bindSegmented,
    scaleRow, conditionScales, bindScales, openScaleHelp,
    stepper, stepperValue, bindSteppers
  };
})(window);
