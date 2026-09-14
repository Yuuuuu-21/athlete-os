/* ==========================================================
   sheet.js — the single bottom sheet used for pickers, help
   text, quick-add forms and settings.
   ========================================================== */

(function (global) {
  const AOS = global.AOS = global.AOS || {};
  const { setHTML, h } = AOS.dom;

  let overlay = null;
  let body = null;
  let onClose = null;

  function init() {
    overlay = document.getElementById('sheetOverlay');
    body = document.getElementById('sheetBody');

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
    document.getElementById('sheetHandle').addEventListener('click', close);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen()) close();
    });
  }

  function isOpen() {
    return overlay && !overlay.hidden;
  }

  // content: a string / h`` template. Returns the sheet body element
  // so callers can wire their own listeners inside it.
  function open(title, content, options) {
    const opts = options || {};

    // A fresh wrapper per open: listeners attached by the caller die
    // with it, so reopening a sheet can never double-fire an action.
    const wrapper = document.createElement('div');
    setHTML(wrapper, h`
      ${title ? h`<h2 class="sheet-title">${title}</h2>` : ''}
      ${opts.subtitle ? h`<p class="sheet-sub">${opts.subtitle}</p>` : ''}
      ${content}
    `);
    body.replaceChildren(wrapper);

    onClose = opts.onClose || null;
    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add('open'));
    return wrapper;
  }

  function close() {
    if (!isOpen()) return;
    overlay.classList.remove('open');
    const cb = onClose;
    onClose = null;
    setTimeout(() => {
      overlay.hidden = true;
      body.replaceChildren();
      if (cb) cb();
    }, 240);
  }

  // Convenience: a list of choices. `options` is
  // [{ id, title, sub, active }]; `onPick` receives the id.
  function choose(title, options, onPick, sheetOptions) {
    const rows = options.map((opt) => h`
      <button class="sheet-option ${opt.active ? 'active' : ''}" data-pick="${opt.id}">
        <span class="sheet-option-main">
          <span class="sheet-option-title">${opt.title}</span>
          ${opt.sub ? h`<span class="sheet-option-sub">${opt.sub}</span>` : ''}
        </span>
        ${opt.active ? h`<span class="sheet-option-check">${AOS.icons.check(18)}</span>` : ''}
      </button>
    `);

    const el = open(title, h`<div>${rows}</div>`, sheetOptions);
    AOS.dom.delegate(el, 'click', '[data-pick]', (e, target) => {
      const id = target.dataset.pick;
      close();
      onPick(id);
    });
    return el;
  }

  // A yes/no sheet. `onConfirm` runs after the sheet closes.
  function confirm(title, options) {
    const o = options || {};
    const el = open(title, h`
      <button class="btn ${o.danger ? 'btn-danger' : ''}" data-confirm>${o.confirmLabel || 'OK'}</button>
      <button class="btn btn-ghost btn-sm" data-cancel style="margin:10px auto 0">${o.cancelLabel || 'やめる'}</button>
    `, { subtitle: o.message });

    AOS.dom.delegate(el, 'click', '[data-cancel]', () => close());
    AOS.dom.delegate(el, 'click', '[data-confirm]', () => {
      close();
      if (o.onConfirm) o.onConfirm();
    });
    return el;
  }

  AOS.sheet = { init, open, close, choose, confirm, isOpen };
})(window);
