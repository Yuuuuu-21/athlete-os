/* ==========================================================
   app.js — app shell: greeting clock, view switching,
   bottom sheet helper, service worker registration.
   Screen-specific logic (Home, later Training/Body/Food/Review)
   lives in its own file and calls into App's helpers.
   ========================================================== */

(function (global) {
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function pad(n) { return n < 10 ? '0' + n : String(n); }

  function todayKey(d) {
    d = d || new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function formatGreetingDate(d) {
    d = d || new Date();
    return `${DAY_NAMES[d.getDay()]}, ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
  }

  function greetingTimeLabel(d) {
    d = d || new Date();
    const h = d.getHours();
    if (h < 12) return 'GOOD MORNING';
    if (h < 18) return 'GOOD AFTERNOON';
    return 'GOOD EVENING';
  }

  function renderGreeting() {
    document.getElementById('greetingTime').textContent = greetingTimeLabel();
    document.getElementById('greetingDate').textContent = formatGreetingDate();
  }

  // ---------- View switching ----------

  function showView(name) {
    document.querySelectorAll('.view').forEach((el) => {
      el.hidden = el.dataset.view !== name;
    });
  }

  function setActiveNav(navKey) {
    document.querySelectorAll('.nav-item').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.view === navKey);
    });
  }

  function goHome() {
    showView('home');
    setActiveNav('home');
  }

  function showStub(title, message, extraHtml, navKey) {
    document.getElementById('stubTitle').textContent = title;
    document.getElementById('stubMessage').textContent = message;
    document.getElementById('stubExtra').innerHTML = extraHtml || '';
    if (navKey) setActiveNav(navKey);
    showView('stub');
  }

  function initNav() {
    document.querySelectorAll('.nav-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        if (view === 'home') {
          goHome();
        } else {
          showStub(btn.dataset.label || view.toUpperCase(), 'Coming soon', '', view);
        }
      });
    });

    const back = document.getElementById('stubBack');
    if (back) back.addEventListener('click', goHome);
  }

  function initSettings() {
    const btn = document.getElementById('settingsBtn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      openSheet('<h3 class="sheet-title">SETTINGS</h3><p class="sheet-text">Coming soon</p>');
    });
  }

  // ---------- Bottom sheet ----------

  function overlayEl() { return document.getElementById('sheetOverlay'); }

  function openSheet(html) {
    document.getElementById('sheetContent').innerHTML = html;
    const overlay = overlayEl();
    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add('open'));
  }

  function closeSheet() {
    const overlay = overlayEl();
    overlay.classList.remove('open');
    setTimeout(() => { overlay.hidden = true; }, 200);
  }

  function initSheetOverlay() {
    overlayEl().addEventListener('click', (e) => {
      if (e.target === overlayEl()) closeSheet();
    });
  }

  // ---------- Service worker ----------

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch((err) => {
        console.warn('Service worker registration failed', err);
      });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initNav();
    initSettings();
    initSheetOverlay();
    renderGreeting();
    registerServiceWorker();

    AthleteDB.init()
      .then(() => { if (global.Home) global.Home.init(); })
      .catch((err) => console.error('DB init failed', err));
  });

  global.App = {
    todayKey,
    formatGreetingDate,
    greetingTimeLabel,
    showView,
    goHome,
    showStub,
    openSheet,
    closeSheet,
    DAY_NAMES
  };
})(window);
