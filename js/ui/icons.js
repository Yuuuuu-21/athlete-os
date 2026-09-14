/* ==========================================================
   icons.js — inline SVG. Everything strokes with currentColor
   so icons follow the theme and the active-nav colour.
   ========================================================== */

(function (global) {
  const AOS = global.AOS = global.AOS || {};
  const { raw } = AOS.dom;

  function svg(size, inner, filled) {
    return raw(
      `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" aria-hidden="true" ` +
      `stroke="currentColor" stroke-width="${filled ? 0 : 1.8}" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`
    );
  }

  const PATHS = {
    home: '<path d="M3.6 10.6 12 3.8l8.4 6.8"/><path d="M5.8 9.4V19a1.2 1.2 0 0 0 1.2 1.2h10a1.2 1.2 0 0 0 1.2-1.2V9.4"/><path d="M9.8 20.2v-5.4h4.4v5.4"/>',
    training: '<path d="M3 12h1.6M19.4 12H21"/><path d="M6.4 8.4v7.2M17.6 8.4v7.2"/><path d="M9.4 6.8v10.4M14.6 6.8v10.4"/><path d="M9.4 12h5.2"/>',
    body: '<circle cx="12" cy="5.2" r="2.2"/><path d="M12 7.6v6.2"/><path d="M7.4 9.6 12 8.4l4.6 1.2"/><path d="M9.6 13.8 8.2 20.4M14.4 13.8l1.4 6.6"/>',
    food: '<path d="M6.2 3.2v6.2a2.6 2.6 0 0 0 5.2 0V3.2"/><path d="M8.8 3.2v6.2"/><path d="M8.8 12v8.8"/><path d="M17.6 3.2c-1.5 1.6-2.2 3.6-2.2 5.6 0 1.6.8 2.6 2.2 2.8v9.2"/>',
    review: '<path d="M4.4 19.6V13M10.2 19.6V6.6M16 19.6v-4.4M21 19.6V9.6"/>',
    check: '<path d="m5 12.6 4.4 4.4L19 7.4"/>',
    plus: '<path d="M12 5.6v12.8M5.6 12h12.8"/>',
    minus: '<path d="M5.6 12h12.8"/>',
    chevron: '<path d="m9.5 5.5 6.2 6.5-6.2 6.5"/>',
    settings: '<path d="M3.6 7.6h9M17.2 7.6h3.2M3.6 16.4h4.4M12.6 16.4h7.8"/><circle cx="14.8" cy="7.6" r="2.4"/><circle cx="10.2" cy="16.4" r="2.4"/>',
    close: '<path d="M6 6 18 18M18 6 6 18"/>',
    trash: '<path d="M4.8 6.8h14.4"/><path d="M9.4 6.8V5.2a1 1 0 0 1 1-1h3.2a1 1 0 0 1 1 1v1.6"/><path d="M6.8 6.8 7.6 19a1 1 0 0 0 1 .9h6.8a1 1 0 0 0 1-.9l.8-12.2"/>',
    timer: '<circle cx="12" cy="13.4" r="7.4"/><path d="M12 9.6v3.8l2.4 1.6"/><path d="M9.6 2.8h4.8"/>',
    flag: '<path d="M6 21V4.2"/><path d="M6 4.8h11.4l-2 3.6 2 3.6H6"/>',
    spark: '<path d="M13.4 2.8 5.6 13.6h5.4L9.8 21.2l8-11.2h-5.4z"/>',
    edit: '<path d="M4.6 19.4h3.2L18.6 8.6a1.9 1.9 0 0 0 0-2.7l-.5-.5a1.9 1.9 0 0 0-2.7 0L4.6 16.2z"/>'
  };

  function icon(name, size) {
    return svg(size || 20, PATHS[name] || '');
  }

  AOS.icons = {
    icon,
    nav: (name) => svg(23, PATHS[name] || ''),
    check: (size) => svg(size || 20, PATHS.check),
    plus: (size) => svg(size || 20, PATHS.plus),
    minus: (size) => svg(size || 20, PATHS.minus),
    chevron: (size) => svg(size || 18, PATHS.chevron),
    settings: (size) => svg(size || 22, PATHS.settings),
    close: (size) => svg(size || 20, PATHS.close),
    trash: (size) => svg(size || 17, PATHS.trash),
    timer: (size) => svg(size || 20, PATHS.timer),
    flag: (size) => svg(size || 20, PATHS.flag),
    spark: (size) => svg(size || 20, PATHS.spark),
    edit: (size) => svg(size || 18, PATHS.edit)
  };
})(window);
