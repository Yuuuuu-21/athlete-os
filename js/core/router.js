/* ==========================================================
   router.js — screen registry, bottom nav, hash routing.

   A screen is a plain object:
     { id, label, icon, topbar(), render(), bind(root), onEnter() }
   `render` may return a string or a promise. `bind` returns the
   unbind functions produced by dom.delegate so the router can
   tear listeners down before the next screen mounts.
   ========================================================== */

(function (global) {
  const AOS = global.AOS = global.AOS || {};
  const { setHTML, h } = AOS.dom;

  const screens = [];
  const byId = {};
  let current = null;
  let unbinds = [];
  let root = null;
  let topbarEl = null;
  let navEl = null;

  function register(screen) {
    screens.push(screen);
    byId[screen.id] = screen;
  }

  function renderNav() {
    setHTML(navEl, screens.filter((s) => s.label).map((s) => h`
      <button class="nav-item ${current === s.id ? 'active' : ''}" data-go="${s.id}" aria-label="${s.label}">
        ${AOS.icons.nav(s.icon)}
        <span>${s.label}</span>
        <i class="nav-dot"></i>
      </button>
    `));
  }

  function renderTopbar(screen) {
    const bar = (screen.topbar && screen.topbar()) || { title: screen.label };
    setHTML(topbarEl, h`
      <div>
        ${bar.eyebrow ? h`<p class="topbar-eyebrow">${bar.eyebrow}</p>` : ''}
        <h1 class="topbar-title">${bar.title || ''}</h1>
      </div>
      ${bar.action || ''}
    `);
  }

  function unbindAll() {
    unbinds.forEach((fn) => { try { fn(); } catch (err) { /* noop */ } });
    unbinds = [];
  }

  function paint(screen, keepScroll) {
    return Promise.resolve(screen.render()).then((content) => {
      setHTML(root, content);
      renderTopbar(screen);
      if (screen.bind) unbinds = screen.bind(root) || [];
      if (!keepScroll) global.scrollTo({ top: 0, behavior: 'auto' });
    });
  }

  function go(id, options) {
    const screen = byId[id];
    if (!screen) return Promise.resolve();

    const same = current === id;
    unbindAll();
    if (!same) {
      const previous = byId[current];
      if (previous && previous.onLeave) previous.onLeave();
    }

    current = id;
    renderNav();
    if (!same && screen.onEnter) screen.onEnter();

    const done = paint(screen, same || !!(options && options.keepScroll));
    if (global.location.hash !== `#/${id}`) global.location.hash = `#/${id}`;
    return done;
  }

  // Re-run the current screen's render + bind. Screens use this
  // after a change that alters more than one region; small edits
  // (a tapped set, a typed weight) patch the DOM directly instead
  // so focus and caret position survive.
  function rerender() {
    if (!current) return Promise.resolve();
    return go(current, { keepScroll: true });
  }

  function currentId() { return current; }

  function fromHash() {
    const id = (global.location.hash || '').replace(/^#\//, '');
    return byId[id] ? id : screens[0].id;
  }

  function init() {
    root = document.getElementById('screen');
    topbarEl = document.getElementById('topbar');
    navEl = document.getElementById('nav');

    AOS.dom.delegate(navEl, 'click', '[data-go]', (e, target) => {
      AOS.dom.haptic(6);
      go(target.dataset.go);
    });

    global.addEventListener('hashchange', () => {
      const id = fromHash();
      if (id !== current) go(id);
    });

    global.addEventListener('scroll', () => {
      topbarEl.classList.toggle('scrolled', global.scrollY > 4);
    }, { passive: true });

    return go(fromHash());
  }

  AOS.router = { register, init, go, rerender, currentId, screens };
})(window);
