/* ==========================================================
   dom.js — tiny DOM + templating helpers.

   `h` is a tagged template that escapes every interpolation,
   so screen code can build markup from user-entered text
   (meal names, notes) without hand-escaping. Nested `h`
   results are passed through untouched.
   ========================================================== */

(function (global) {
  const AOS = global.AOS = global.AOS || {};

  const RAW = '__aosRaw__';

  function escape(value) {
    if (value === null || value === undefined || value === false) return '';
    return String(value).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  function raw(str) {
    const s = String(str);
    return { [RAW]: s, toString() { return s; } };
  }

  function isRaw(v) {
    return !!v && typeof v === 'object' && RAW in v;
  }

  function part(value) {
    if (Array.isArray(value)) return value.map(part).join('');
    if (isRaw(value)) return value[RAW];
    return escape(value);
  }

  function h(strings, ...values) {
    let out = strings[0];
    for (let i = 0; i < values.length; i++) out += part(values[i]) + strings[i + 1];
    return raw(out);
  }

  function setHTML(node, content) {
    if (node) node.innerHTML = part(content);
    return node;
  }

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function $$(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  // Event delegation. Returns an unbind function so screens that
  // re-mount don't stack duplicate listeners.
  function delegate(root, type, selector, handler, options) {
    const listener = (event) => {
      const target = event.target.closest ? event.target.closest(selector) : null;
      if (target && root.contains(target)) handler(event, target);
    };
    root.addEventListener(type, listener, options);
    return () => root.removeEventListener(type, listener, options);
  }

  // ---------- number / text formatting ----------

  function round(value, digits) {
    const f = Math.pow(10, digits || 0);
    return Math.round(value * f) / f;
  }

  // Trims trailing zeroes: 62.5 -> "62.5", 60.0 -> "60"
  function num(value, digits) {
    if (value === '' || value === null || value === undefined || Number.isNaN(value)) return '—';
    return String(round(Number(value), digits === undefined ? 1 : digits));
  }

  function signed(value, digits) {
    if (value === null || value === undefined || Number.isNaN(value)) return '—';
    const n = round(Number(value), digits === undefined ? 1 : digits);
    return (n > 0 ? '+' : '') + n;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function parseNum(text) {
    if (text === '' || text === null || text === undefined) return '';
    const n = parseFloat(String(text).replace(/[^\d.-]/g, ''));
    return Number.isNaN(n) ? '' : n;
  }

  function mmss(totalSeconds) {
    const s = Math.max(0, Math.round(totalSeconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  // Reads better than mm:ss for prescriptions: 45秒 / 20分 / 1:30
  function duration(totalSeconds) {
    const s = Math.max(0, Math.round(totalSeconds));
    if (s < 60) return `${s}秒`;
    if (s % 60 === 0) return `${s / 60}分`;
    return mmss(s);
  }

  // ---------- toast ----------

  let toastTimer = null;

  function toast(message) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => { el.hidden = true; }, 220);
    }, 1800);
  }

  // ---------- misc ----------

  function debounce(fn, wait) {
    let timer = null;
    const wrapped = (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
    wrapped.flush = (...args) => {
      clearTimeout(timer);
      fn(...args);
    };
    wrapped.cancel = () => clearTimeout(timer);
    return wrapped;
  }

  function haptic(ms) {
    if (navigator.vibrate) navigator.vibrate(ms || 8);
  }

  AOS.dom = {
    h, raw, escape, setHTML, $, $$, delegate,
    num, signed, round, clamp, parseNum, mmss, duration,
    toast, debounce, haptic
  };
})(window);
