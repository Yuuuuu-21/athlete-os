/* ==========================================================
   app.js — boot.

   Order matters: the database opens first, settings load from
   it (the theme is applied before anything paints), then the
   sheet and router come up and the first screen renders.
   ========================================================== */

(function (global) {
  const AOS = global.AOS;

  let bootedOn = AOS.dates.today();

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (global.location.protocol === 'file:') return; // not available off a server
    global.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch((err) => {
        console.warn('Service worker registration failed', err);
      });
    });
  }

  // Left open past midnight? Everything on screen is about "today",
  // so roll it over rather than showing yesterday's plan.
  function watchDateRollover() {
    const check = () => {
      const now = AOS.dates.today();
      if (now !== bootedOn) {
        bootedOn = now;
        AOS.router.rerender();
      }
    };
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) check();
    });
    setInterval(check, 60000);
  }

  function fail(err) {
    console.error('起動に失敗しました', err);
    const screen = document.getElementById('screen');
    if (screen) {
      AOS.dom.setHTML(screen, AOS.dom.h`
        <section class="card">
          <h2 class="card-title">起動できませんでした</h2>
          <p class="row-sub">${(err && err.message) || '不明なエラー'}</p>
          <button class="btn btn-ghost btn-sm" onclick="location.reload()" style="margin-top:12px">再読み込み</button>
        </section>
      `);
    }
  }

  function boot() {
    AOS.db.init()
      .then(() => AOS.store.load())
      .then(() => {
        AOS.sheet.init();
        return AOS.router.init();
      })
      .then(() => {
        watchDateRollover();
        registerServiceWorker();
      })
      .catch(fail);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
